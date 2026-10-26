/**
 * Aircraft overhead: content models (propellers or fans turning) when the host supplies them,
 * otherwise instanced proxies drawn by the vehicle batches.
 */

import type { SceneAdmission } from '@bendyline/molen-client';
import { type AircraftVisual, createAircraftVisual } from '@bendyline/molen-client/aircraft';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Node names the aircraft visual moves or toggles; everything else on an ambient copy is still. */
function movingNodes(spec: AircraftSpec): Set<string> {
  const visual = spec.visual;
  return new Set([
    ...visual.rotors.map((binding) => binding.node),
    ...visual.gearNodes,
    ...visual.flaps.map((binding) => binding.node),
    ...visual.ailerons.map((binding) => binding.node),
    ...(visual.controlStick !== undefined ? [visual.controlStick.node] : []),
    ...(visual.collective !== undefined ? [visual.collective.node] : []),
    ...(visual.animation?.bindings.map((binding) => binding.node) ?? []),
  ]);
}

/**
 * A float copy of an attribute (quantized and interleaved ones included), its points moved by
 * `points` or its directions turned by `directions` and renormalized. Read straight from the
 * array: per-component accessors made copying an airliner's parts tens of milliseconds.
 */
function transformedCopy(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  points?: THREE.Matrix4,
  directions?: THREE.Matrix3,
): Float32Array {
  const { count, itemSize } = attribute;
  const interleaved = (attribute as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute;
  const data = interleaved ? (attribute as THREE.InterleavedBufferAttribute).data : undefined;
  const array = (data?.array ?? attribute.array) as ArrayLike<number>;
  const stride = data?.stride ?? itemSize;
  const offset = interleaved ? (attribute as THREE.InterleavedBufferAttribute).offset : 0;
  const divisor = !attribute.normalized
    ? 1
    : array instanceof Int8Array ||
        array instanceof Uint8Array ||
        array instanceof Uint8ClampedArray
      ? array instanceof Int8Array
        ? 127
        : 255
      : array instanceof Int16Array || array instanceof Uint16Array
        ? array instanceof Int16Array
          ? 32767
          : 65535
        : array instanceof Int32Array
          ? 2147483647
          : array instanceof Uint32Array
            ? 4294967295
            : 1;
  const signed =
    array instanceof Int8Array || array instanceof Int16Array || array instanceof Int32Array;
  const out = new Float32Array(count * itemSize);
  for (let i = 0, o = 0; i < count; i++, o += itemSize) {
    const base = offset + i * stride;
    for (let c = 0; c < itemSize; c++) {
      const value = (array[base + c] ?? 0) / divisor;
      out[o + c] = signed && value < -1 ? -1 : value;
    }
  }
  if (itemSize < 3) return out;
  if (points !== undefined) {
    const e = points.elements;
    for (let o = 0; o < out.length; o += itemSize) {
      const x = out[o] ?? 0;
      const y = out[o + 1] ?? 0;
      const z = out[o + 2] ?? 0;
      out[o] = (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0);
      out[o + 1] = (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0);
      out[o + 2] = (e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z + (e[14] ?? 0);
    }
  } else if (directions !== undefined) {
    const e = directions.elements;
    for (let o = 0; o < out.length; o += itemSize) {
      const x = out[o] ?? 0;
      const y = out[o + 1] ?? 0;
      const z = out[o + 2] ?? 0;
      const nx = (e[0] ?? 0) * x + (e[3] ?? 0) * y + (e[6] ?? 0) * z;
      const ny = (e[1] ?? 0) * x + (e[4] ?? 0) * y + (e[7] ?? 0) * z;
      const nz = (e[2] ?? 0) * x + (e[5] ?? 0) * y + (e[8] ?? 0) * z;
      const length = Math.hypot(nx, ny, nz) || 1;
      out[o] = nx / length;
      out[o + 1] = ny / length;
      out[o + 2] = nz / length;
    }
  }
  return out;
}

/**
 * Drop the cabin (the spec's interior nodes) from an ambient copy, which is never seen from
 * inside. Its animated instruments are moving parts the merge keeps: hundreds of separate digits
 * and needles on each aircraft overhead, every one updated and culled in every frame.
 */
function withoutCabin(model: THREE.Object3D, spec: AircraftSpec): void {
  const names = new Set(spec.visual.interior?.nodes ?? []);
  if (names.size === 0) return;
  const cabin: THREE.Object3D[] = [];
  model.traverse((node) => {
    if (names.has(node.name)) cabin.push(node);
  });
  for (const node of cabin) node.removeFromParent();
}

/** The merge, yielding after each part so a caller can spread it over several tasks. */
function* mergeSteps(model: THREE.Object3D, spec: AircraftSpec): Generator<void, void> {
  withoutCabin(model, spec);
  const moving = movingNodes(spec);
  model.updateMatrixWorld(true);
  // Moving parts keep their nodes, but the still meshes beneath one turn with it: a propeller's
  // blades, each a mesh per material, merge in the propeller's own frame.
  const roots: Array<{ root: THREE.Object3D; minimum: number }> = [{ root: model, minimum: 1 }];
  model.traverse((object) => {
    if (object !== model && moving.has(object.name)) roots.push({ root: object, minimum: 2 });
  });
  for (const { root, minimum } of roots) yield* mergeUnder(root, moving, minimum);
}

/**
 * Merge the still meshes under `root`, down to the next moving part, into one mesh per material
 * in `root`'s frame. Materials with fewer than `minimum` meshes stay as they are.
 */
function* mergeUnder(
  root: THREE.Object3D,
  moving: ReadonlySet<string>,
  minimum: number,
): Generator<void, void> {
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const transform = new THREE.Matrix4();
  const normalTransform = new THREE.Matrix3();
  const groups = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>();
  const visit = (object: THREE.Object3D): void => {
    if (object !== root && moving.has(object.name)) return;
    for (const child of object.children) visit(child);
    if (object === root) return;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || (mesh as THREE.SkinnedMesh).isSkinnedMesh)
      return;
    const source = mesh.geometry;
    if (source.morphAttributes.position !== undefined) return;
    const names = ['position', 'normal', 'color'].filter((name) => source.getAttribute(name));
    const key = `${mesh.material.uuid}|${names.sort().join()}|${source.index !== null}`;
    const group = groups.get(key) ?? { material: mesh.material, meshes: [] };
    group.meshes.push(mesh);
    groups.set(key, group);
  };
  visit(root);
  const merged: THREE.Mesh[] = [];
  for (const { material, meshes } of groups.values()) {
    if (meshes.length < minimum) continue;
    const parts: THREE.BufferGeometry[] = [];
    for (const mesh of meshes) {
      const source = mesh.geometry;
      transform.multiplyMatrices(toRoot, mesh.matrixWorld);
      normalTransform.getNormalMatrix(transform);
      // Float copies: quantized (KHR_mesh_quantization) attributes cannot hold transformed values.
      const geometry = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'color'] as const) {
        const attribute = source.getAttribute(name);
        if (attribute === undefined) continue;
        const copy = transformedCopy(
          attribute,
          name === 'position' ? transform : undefined,
          name === 'normal' ? normalTransform : undefined,
        );
        geometry.setAttribute(name, new THREE.BufferAttribute(copy, attribute.itemSize));
      }
      if (source.index !== null) geometry.setIndex(source.index.clone());
      parts.push(geometry);
      mesh.removeFromParent();
      yield;
    }
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    yield;
    if (geometry === null) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `ambient-merged:${material.name}`;
    merged.push(mesh);
  }
  for (const mesh of merged) root.add(mesh);
}

/**
 * An aircraft overhead is seen from hundreds of meters, so its hundreds of still parts (fuselage,
 * wings, canopy frame, cockpit) merge into one mesh per material: a copy costs a draw per
 * material plus its moving parts, instead of one per part (281 for the P-51). Moving parts keep
 * their nodes and bindings. The cabin is dropped and the visual built without the interior, which
 * is never seen from inside overhead. Exported for tests.
 */
export function mergeStaticAircraftParts(model: THREE.Object3D, spec: AircraftSpec): void {
  for (const _ of mergeSteps(model, spec));
}

/** Main-thread time (ms) a template merge takes before giving the frame back. */
const MERGE_SLICE_MS = 3;

/** The merge in slices: an airliner's still parts held a frame for 40-60 ms in one go. */
async function mergeStaticAircraftPartsSliced(
  model: THREE.Object3D,
  spec: AircraftSpec,
): Promise<void> {
  const steps = mergeSteps(model, spec);
  for (;;) {
    const start = performance.now();
    while (performance.now() - start < MERGE_SLICE_MS) if (steps.next().done === true) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export interface AmbientAircraftModels {
  load(type: string): Promise<THREE.Object3D | undefined>;
  /** The aircraft spec (rotor and gear bindings) of a type, if it is an aircraft type. */
  aircraft(type: string): AircraftSpec | undefined;
}

interface Active {
  visual: AircraftVisual;
  rotor: number;
  /** Gear and flap travel, 0..1 (NaN until first seen): an approach lowers both at the type's rates. */
  gear: number;
  flaps: number;
  spec: AircraftSpec;
}

/** Move toward a selection at `time` seconds for full travel; 0, unset or a first sight is instant. */
function travel(position: number, selected: boolean, time: number | undefined, dt: number): number {
  const target = selected ? 1 : 0;
  if (time === undefined || time <= 0 || Number.isNaN(position)) return target;
  const step = dt / time;
  return position + Math.max(-step, Math.min(step, target - position));
}

const INPUT: AircraftInputData = {
  power: 0.8,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brake: false,
  engine: true,
  gear: false,
  flaps: false,
} as AircraftInputData;

export class AmbientAircraft {
  private readonly active = new Map<string, Active>();
  private readonly loading = new Set<string>();
  private readonly missing = new Set<string>();
  private disposed = false;
  /**
   * One parsed and merged model per type. Each aircraft is a clone sharing its geometry and
   * materials: a jet's spawn rings replace distant traffic every few seconds, and parsing and
   * merging the model again for each one held the main thread for tens of milliseconds.
   */
  private readonly templates = new Map<string, Promise<THREE.Object3D | undefined>>();

  constructor(
    private readonly models: AmbientAircraftModels,
    private readonly parent: THREE.Object3D,
    private readonly prepare?: (object: THREE.Object3D) => Promise<void> | void,
    private readonly admission?: SceneAdmission | undefined,
  ) {}

  /** Whether a type draws as a model (otherwise the caller draws a proxy). */
  modelled(id: string): boolean {
    return this.active.has(id);
  }

  /** Keep models for live aircraft; returns ids that still need a proxy this frame. */
  sync(
    live: readonly {
      id: string;
      type: string;
      pos: readonly number[];
      rot: readonly number[];
      speed: number;
      descending: boolean;
    }[],
    dt: number,
  ): void {
    const seen = new Set<string>();
    for (const plane of live) {
      seen.add(plane.id);
      const entry = this.active.get(plane.id);
      if (entry === undefined) {
        if (!this.missing.has(plane.type) && !this.loading.has(plane.id))
          void this.load(plane.id, plane.type);
        continue;
      }
      entry.rotor = (entry.rotor + dt * 40) % (Math.PI * 2);
      const airplane = entry.spec.airplane;
      entry.gear = travel(entry.gear, plane.descending, airplane?.gearTransitTime, dt);
      entry.flaps = travel(entry.flaps, plane.descending, airplane?.flapTransitTime, dt);
      const object = entry.visual.object;
      object.position.set(plane.pos[0] ?? 0, plane.pos[1] ?? 0, plane.pos[2] ?? 0);
      object.quaternion.set(
        plane.rot[0] ?? 0,
        plane.rot[1] ?? 0,
        plane.rot[2] ?? 0,
        plane.rot[3] ?? 1,
      );
      entry.visual.update(
        {
          rotorAngle: entry.rotor,
          airspeed: plane.speed,
          altitudeAGL: 500,
          yaw: 0,
          pitch: 0,
          roll: 0,
          rpm: 2400,
          verticalSpeed: 0,
          gearPosition: entry.gear,
          flapPosition: entry.flaps,
        } as unknown as AircraftStateData,
        { ...INPUT, gear: plane.descending, flaps: plane.descending },
        plane.pos[1] ?? 0,
      );
    }
    for (const [id, entry] of this.active)
      if (!seen.has(id)) {
        // Its geometry and materials belong to the type's template.
        entry.visual.object.removeFromParent();
        this.active.delete(id);
      }
  }

  private template(type: string, spec: AircraftSpec): Promise<THREE.Object3D | undefined> {
    let template = this.templates.get(type);
    if (template === undefined) {
      template = this.models.load(type).then(async (model) => {
        if (model !== undefined) await mergeStaticAircraftPartsSliced(model, spec);
        return model;
      });
      this.templates.set(type, template);
      template.catch(() => this.templates.delete(type));
    }
    return template;
  }

  private async load(id: string, type: string): Promise<void> {
    const spec = this.models.aircraft(type);
    if (spec === undefined) {
      this.missing.add(type);
      return;
    }
    this.loading.add(id);
    try {
      const template = await this.template(type, spec);
      if (template === undefined) {
        this.missing.add(type);
        return;
      }
      if (this.disposed) return;
      // Cloning the template and binding its parts is admitted: a new airliner was 12 ms of a frame.
      const create = (): AircraftVisual => {
        const created = createAircraftVisual(template.clone(true), {
          ...spec,
          visual: { ...spec.visual, interior: undefined },
        });
        created.object.traverse((object) => {
          object.userData.walkIgnore = true;
          (object as THREE.Mesh).castShadow = false;
        });
        return created;
      };
      const visual = this.admission
        ? await this.admission.run(create, { label: 'ambient-aircraft' })
        : create();
      if (this.disposed) return;
      // Hidden until its shaders are built, as detailed cars are: drawn while they were still
      // compiling, a passing airliner held a frame for a quarter of a second on WebGL.
      visual.object.visible = false;
      this.parent.add(visual.object);
      await this.prepare?.(visual.object);
      if (this.disposed) {
        visual.object.removeFromParent();
        return;
      }
      visual.object.visible = true;
      this.active.set(id, { visual, rotor: 0, gear: Number.NaN, flaps: Number.NaN, spec });
    } catch {
      this.missing.add(type);
    } finally {
      this.loading.delete(id);
    }
  }

  get count(): number {
    return this.active.size;
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.active.values()) entry.visual.object.removeFromParent();
    this.active.clear();
    for (const template of this.templates.values())
      void template.then(
        (model) => {
          model?.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              material.dispose();
          });
        },
        () => {},
      );
    this.templates.clear();
  }
}
