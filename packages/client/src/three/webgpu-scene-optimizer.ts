import * as THREE from 'three';
import { BundleGroup, type WebGPURenderer } from 'three/webgpu';
import { WebGpuInstanceBuffers } from './webgpu-instance-buffers';

type Sample = unknown;
type DrawStats = { drawCalls: number; triangles: number };
const STABLE_CAMERA_FRAMES = 8;

/** A tile-sized command cache. The owner checks its draw state before every render. */
class RenderGroup extends BundleGroup {
  eligible = true;
  samples: Sample[] = [];
  cursor = 0;
  changed = false;
  stats: DrawStats = { drawCalls: 0, triangles: 0 };
  recordedVersion = -1;
  recordingFrame = -1;
  write(value: Sample): void {
    if (this.samples[this.cursor] !== value) this.changed = true;
    this.samples[this.cursor++] = value;
  }
  writeArray(values: readonly Sample[]): void {
    for (let i = 0; i < values.length; i++) this.write(values[i]);
  }
}

/**
 * Uses Three render bundles and a pinned, version-aware instance upload adapter.
 * Bundles are restricted to opaque, unskinned content with ordinary object callbacks. Re-recording
 * on camera changes deliberately keeps Three's frustum culling, sorting and LOD decisions intact.
 */
export class WebGpuSceneOptimizer {
  private readonly instances: WebGpuInstanceBuffers;
  private readonly renderHook: NonNullable<ReturnType<WebGPURenderer['getRenderObjectFunction']>>;
  private readonly groups = new WeakSet<THREE.Object3D>();
  private active: RenderGroup[] = [];
  private frame = 0;
  private stableCameraFrames = 0;
  private cameraState: (number | THREE.Camera)[] = [];
  private readonly frameSize = new THREE.Vector2();
  private readonly matrixSamples = new WeakMap<
    THREE.Matrix4,
    { elements: Float64Array; revision: number }
  >();
  private readonly restoreRefresh: () => void;
  private materialSamples = new Map<THREE.Material, number>();
  private readonly videoMaterials = new WeakSet<THREE.Material>();
  private readonly materialStates = new WeakMap<
    THREE.Material,
    { sample: Sample[]; revision: number }
  >();

  constructor(private readonly renderer: WebGPURenderer) {
    this.instances = new WebGpuInstanceBuffers(renderer);
    // r184 refreshes the first object of EVERY material observer each frame, even in a static
    // bundle. Instanced meshes each have their own observer. Our command snapshot supplies the
    // missing change detection; node/animated materials and new render objects still refresh.
    type RenderObject = {
      bundle: THREE.Object3D | null;
      getMonitor(): {
        hasNode: boolean;
        hasAnimation: boolean;
        renderObjects: WeakMap<object, unknown>;
      };
    };
    const nodes = (
      renderer as unknown as { _nodes: { needsRefresh(object: RenderObject): boolean } }
    )._nodes;
    const refresh = nodes.needsRefresh;
    nodes.needsRefresh = (object): boolean => {
      const group = object.bundle as RenderGroup | null;
      if (
        group !== null &&
        this.groups.has(group) &&
        group.eligible &&
        group.version === group.recordedVersion &&
        !renderer.getMRT()?.has('velocity')
      ) {
        const monitor = object.getMonitor();
        if (!monitor.hasNode && !monitor.hasAnimation && monitor.renderObjects.has(object))
          return false;
      }
      return refresh.call(nodes, object);
    };
    this.restoreRefresh = () => {
      nodes.needsRefresh = refresh;
    };
    this.renderHook = (...args) => {
      const object = args[0];
      let parent: THREE.Object3D | null = object.parent;
      while (parent !== null && !this.groups.has(parent)) parent = parent.parent;
      const group = parent as RenderGroup | null;
      const before = renderer.info.render;
      const draws = before.drawCalls;
      const triangles = before.triangles;
      renderer.renderObject(...args);
      if (group?.isBundleGroup) {
        if (group.recordingFrame !== this.frame) {
          group.recordingFrame = this.frame;
          group.stats = { drawCalls: 0, triangles: 0 };
        }
        group.stats.drawCalls += before.drawCalls - draws;
        group.stats.triangles += before.triangles - triangles;
      }
    };
    renderer.setRenderObjectFunction(this.renderHook);
  }

  createGroup(): THREE.Group {
    const group = new RenderGroup();
    this.groups.add(group);
    return group;
  }

  /** Update matrices once; Renderer suppresses Three's duplicate scene traversal for this frame. */
  prepare(scene: THREE.Scene, camera: THREE.Camera): void {
    this.frame++;
    this.active = [];
    this.materialSamples.clear();
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate) camera.updateMatrixWorld();
    const cameraState = [
      camera,
      camera.layers.mask,
      ...camera.matrixWorld.elements,
      ...camera.projectionMatrix.elements,
    ];
    const sameCamera =
      cameraState.length === this.cameraState.length &&
      cameraState.every((value, i) => value === this.cameraState[i]);
    this.stableCameraFrames =
      this.frame <= 2
        ? STABLE_CAMERA_FRAMES
        : sameCamera
          ? Math.min(STABLE_CAMERA_FRAMES, this.stableCameraFrames + 1)
          : 0;
    // Recording new bundles on every moving frame costs more than normal draw submission.
    // Three finalizes the WebGPU camera coordinate system during the first actual render, so the
    // first two prepares are initialization rather than motion. After that, a fixed-step camera
    // can repeat each pose for several render frames while it is still moving; wait long enough
    // to cover a 30 Hz simulation on a 240 Hz display before treating the view as settled.
    const cacheView = this.stableCameraFrames >= STABLE_CAMERA_FRAMES;
    this.cameraState = cameraState;
    this.renderer.getDrawingBufferSize(this.frameSize);
    const view: Sample[] = [
      camera,
      camera.layers.mask,
      scene.overrideMaterial,
      scene.fog,
      scene.environment,
      scene.environmentIntensity,
      this.renderer.toneMapping,
      this.renderer.toneMappingExposure,
      this.renderer.outputColorSpace,
      this.frameSize.x,
      this.frameSize.y,
      this.renderer.getPixelRatio(),
    ];
    view.push(...camera.matrixWorld.elements, ...camera.projectionMatrix.elements);
    if (scene.fog instanceof THREE.Fog)
      view.push(
        scene.fog.near,
        scene.fog.far,
        scene.fog.color.r,
        scene.fog.color.g,
        scene.fog.color.b,
      );
    if (scene.fog instanceof THREE.FogExp2)
      view.push(scene.fog.density, scene.fog.color.r, scene.fog.color.g, scene.fog.color.b);
    view.push(
      scene.environment?.version,
      scene.environmentRotation.x,
      scene.environmentRotation.y,
      scene.environmentRotation.z,
    );
    const lights: Sample[] = [];
    const visit = (object: THREE.Object3D, group?: RenderGroup): void => {
      if (group !== undefined && cacheView) {
        group.write(object);
        group.write(object.visible);
        group.write(object.layers.mask);
      }
      if (!object.visible) return;
      // Collect lights in this same walk, including lights outside managed chunks.
      if (object instanceof THREE.Light) {
        lights.push(object, ...object.matrixWorld.elements);
        for (const value of Object.values(object)) this.sampleValue(lights, value);
      }
      if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight) {
        lights.push(...object.target.matrixWorld.elements);
        this.sampleValue(lights, object.target.position);
      }
      if (object instanceof THREE.LOD && object.autoUpdate) object.update(camera);
      if (object instanceof THREE.InstancedMesh) this.instances.track(object.instanceMatrix);
      if (this.groups.has(object)) {
        const own = object as RenderGroup;
        // Three does not recursively execute nested bundles. Disable the outer cache.
        if (group !== undefined) this.disable(group);
        group = own;
        own.cursor = 0;
        own.changed = false;
        own.writeArray(view);
        // Shadow passes and scene overrides have their own render lists and callbacks.
        own.eligible =
          cacheView &&
          !this.renderer.shadowMap.enabled &&
          scene.overrideMaterial === null &&
          scene.onBeforeRender === THREE.Object3D.prototype.onBeforeRender &&
          this.renderer.getRenderObjectFunction() === this.renderHook &&
          this.renderer.xr?.isPresenting !== true;
        this.active.push(own);
      }
      if (group !== undefined && cacheView) {
        group.write(object.renderOrder);
        group.write(object.frustumCulled);
        group.write(object.matrixWorld);
        group.write(this.sampleMatrix(object.matrixWorld));
        if (
          object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
          object.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
          object instanceof THREE.SkinnedMesh ||
          object instanceof THREE.Sprite ||
          object instanceof THREE.Light ||
          'isClippingGroup' in object
        )
          this.disable(group);
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Line ||
          object instanceof THREE.Points
        ) {
          const geometry: THREE.BufferGeometry = object.geometry;
          group.write(geometry);
          group.write(geometry.index);
          group.write(geometry.index?.version);
          group.write(geometry.drawRange.start);
          group.write(geometry.drawRange.count);
          for (const name in geometry.attributes) {
            const attribute = geometry.attributes[name];
            if (attribute === undefined) continue;
            group.write(name);
            group.write(attribute);
            group.write('version' in attribute ? attribute.version : attribute.data.version);
          }
          for (const draw of geometry.groups) {
            group.write(draw.start);
            group.write(draw.count);
            group.write(draw.materialIndex);
          }
          if (object instanceof THREE.Mesh && object.morphTargetInfluences !== undefined)
            this.disable(group);
          if (object instanceof THREE.InstancedMesh) {
            group.write(object.count);
            group.write(object.instanceMatrix);
            group.write(object.instanceMatrix.version);
            group.write(object.instanceColor);
            group.write(object.instanceColor?.version);
          }
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (
              !material.depthTest ||
              !material.depthWrite ||
              material.transparent ||
              (material.clippingPlanes?.length ?? 0) > 0 ||
              (material as THREE.MeshPhysicalMaterial).transmission > 0 ||
              material instanceof THREE.ShaderMaterial
            )
              this.disable(group);
            group.write(material);
            group.write(this.sampleMaterial(material));
            if (this.videoMaterials.has(material)) this.disable(group);
          }
        }
      }
      for (const child of object.children) visit(child, group);
    };
    visit(scene);
    for (const group of this.active) {
      group.writeArray(lights);
      this.setEnabled(group, group.eligible);
      if (group.changed || group.cursor !== group.samples.length) group.needsUpdate = true;
      group.samples.length = group.cursor;
    }
  }

  /** Three counts command recording, not cached execution; retain the actual recorded workload. */
  finish(): void {
    for (const group of this.active) {
      if (!group.isBundleGroup) continue;
      if (group.recordedVersion === group.version && group.recordingFrame !== this.frame) {
        this.renderer.info.render.drawCalls += group.stats.drawCalls;
        this.renderer.info.render.triangles += group.stats.triangles;
      } else if (group.recordingFrame !== this.frame) {
        group.stats = { drawCalls: 0, triangles: 0 };
      }
      group.recordedVersion = group.version;
    }
  }

  private sampleMatrix(matrix: THREE.Matrix4): number {
    let sample = this.matrixSamples.get(matrix);
    if (sample === undefined) {
      sample = { elements: new Float64Array(matrix.elements), revision: 0 };
      this.matrixSamples.set(matrix, sample);
    } else {
      for (let i = 0; i < 16; i++) {
        if (sample.elements[i] !== matrix.elements[i]) {
          sample.elements.set(matrix.elements);
          sample.revision++;
          break;
        }
      }
    }
    return sample.revision;
  }

  private setEnabled(group: RenderGroup, enabled: boolean): void {
    // The public type flag is readonly in TS; Three uses it to opt into bundle projection.
    if (group.isBundleGroup !== enabled) {
      Object.assign(group, { isBundleGroup: enabled });
      group.needsUpdate = true;
    }
  }

  private disable(group: RenderGroup): void {
    group.eligible = false;
  }

  private sampleMaterial(material: THREE.Material): number {
    const cached = this.materialSamples.get(material);
    if (cached !== undefined) return cached;
    const sample: Sample[] = [];
    this.videoMaterials.delete(material);
    for (const value of Object.values(material)) {
      if (value instanceof THREE.VideoTexture) this.videoMaterials.add(material);
      this.sampleValue(sample, value);
    }
    const previous = this.materialStates.get(material);
    let revision = previous?.revision ?? 0;
    if (
      previous === undefined ||
      sample.length !== previous.sample.length ||
      sample.some((value, i) => value !== previous.sample[i])
    )
      revision++;
    this.materialStates.set(material, { sample, revision });
    this.materialSamples.set(material, revision);
    return revision;
  }

  private sampleValue(sample: Sample[], value: unknown): void {
    if (value instanceof THREE.Color) sample.push(value.r, value.g, value.b);
    else if (value instanceof THREE.Vector2) sample.push(value.x, value.y);
    else if (value instanceof THREE.Vector3) sample.push(value.x, value.y, value.z);
    else if (value instanceof THREE.Texture)
      sample.push(
        value,
        value.version,
        ...value.matrix.elements,
        value.offset.x,
        value.offset.y,
        value.repeat.x,
        value.repeat.y,
        value.rotation,
      );
    else sample.push(value);
  }

  dispose(): void {
    this.restoreRefresh();
    this.instances.dispose();
    this.active = [];
    this.materialSamples.clear();
  }
}
