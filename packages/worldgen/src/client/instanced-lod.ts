/** Spatial batches keep instancing while giving the camera useful culling and detail bounds. */
import * as THREE from 'three';
import { PLACEMENT_STRIDE, type PlacementSet } from '../kernel/types';
import { createInstancedPlacements } from './instanced-box';
import type { PreparedModel } from './instanced-models';
import { SCATTER_SOLID_UV, scatterFullyLitTerm } from './scatter-material';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './screen-space-lod';

export interface InstancedPlacementLodOptions {
  /** Local meters per culling cell (default 512); `Infinity` keeps the whole set in one cell. */
  cellSize?: number;
  /**
   * Bounds the cells to a grid from the set's own lowest corner, `cellsPerAxis` cells each way:
   * placements past the grid join its edge cells, so a set never yields more than
   * `cellsPerAxis²` batches whatever frame its coordinates are in.
   */
  cellGrid?: { cellsPerAxis: number };
  /** Distance from a cell's bounds before the medium/far model takes over. */
  distances?: [number, number];
  /** Projected-detail policy; when supplied it replaces fixed distance thresholds. */
  screenSpace?: ScreenSpaceLodPolicy;
}

const cardFree = new WeakMap<THREE.BufferGeometry, boolean>();
const opaqueTwins = new WeakMap<THREE.Material, THREE.Material>();

/** True when no vertex samples the leaf atlas: every face takes the solid block (or has no UV). */
function withoutCards(geometry: THREE.BufferGeometry): boolean {
  let free = cardFree.get(geometry);
  if (free === undefined) {
    const uv = geometry.getAttribute('uv');
    free = true;
    // Atlas cards sit left of the solid block, which every closed surface samples.
    const solid = SCATTER_SOLID_UV[0] - 0.02;
    if (uv !== undefined)
      for (let i = 0; i < uv.count; i++)
        if (uv.getX(i) < solid) {
          free = false;
          break;
        }
    cardFree.set(geometry, free);
  }
  return free;
}

/** Projected error (meters, at unit instance scale) at which the medium and far levels take over. */
const LEVEL_ERRORS = [0.45, 2] as const;
/**
 * A level drawn with leaf cards hands over at this share of that error. Its cards overlap several
 * deep in every crown and, alpha tested, each layer is shaded: near crowns kept out to 175 m from a
 * rooftop camera cost a residential view about a quarter of its frame time on an Apple M2. At a
 * quarter, near crowns reach about 45 m there and medium ones about 200 m.
 */
const CARD_HANDOVER = 0.25;

function handoverError(level: number, finer: PreparedModel): number {
  const cards =
    (finer.material.alphaTest > 0 || finer.material.alphaToCoverage) &&
    !withoutCards(finer.geometry);
  return (LEVEL_ERRORS[level - 1] ?? 2) * (cards ? CARD_HANDOVER : 1);
}

/**
 * The material for a level: an alpha-tested material's opaque twin when the level has no cards.
 * A shader that can discard (alpha test, alpha to coverage) switches off hidden-surface removal
 * on GPUs that defer shading (Apple's among them), so a distant forest drawn with the card material shaded every layer of
 * crowns behind the first: on an Apple M2 that was half of a residential view's frame time.
 * The twin keeps the shader hooks and shares one program across batches.
 */
function levelMaterial(material: THREE.Material, geometry: THREE.BufferGeometry): THREE.Material {
  if (!(material.alphaTest > 0 || material.alphaToCoverage) || !withoutCards(geometry))
    return material;
  let twin = opaqueTwins.get(material);
  if (twin === undefined) {
    const opaque = material.clone();
    opaque.onBeforeCompile = material.onBeforeCompile;
    opaque.customProgramCacheKey = material.customProgramCacheKey;
    opaque.alphaTest = 0;
    opaque.alphaToCoverage = false;
    // A node material cuts its cards with nodes instead (see the scatter material).
    const nodes = opaque as THREE.Material & { alphaTestNode?: unknown; maskShadowNode?: unknown };
    if (nodes.alphaTestNode !== undefined) nodes.alphaTestNode = null;
    if (nodes.maskShadowNode !== undefined) nodes.maskShadowNode = null;
    opaque.name = `${material.name}:opaque`;
    material.addEventListener('dispose', () => opaque.dispose());
    opaqueTwins.set(material, opaque);
    twin = opaque;
  }
  return twin;
}

const unshadowedTwins = new WeakMap<THREE.Material, THREE.Material>();

/**
 * The distant level's material when `source` (the models' shared material) offers a constant shadow
 * term: a twin of `material` that never samples the sun's shadow map. The level used to switch off
 * `receiveShadow` instead, and three keys a mesh's shaders by that flag, so every batch rebuilt its
 * shaders, mid-frame, each time it crossed into the level or back out.
 */
function unshadowedMaterial(
  material: THREE.Material,
  source: THREE.Material,
): THREE.Material | undefined {
  const lit = scatterFullyLitTerm(source);
  if (lit === undefined) return undefined;
  let twin = unshadowedTwins.get(material);
  if (twin === undefined) {
    const created = material.clone() as THREE.Material & { receivedShadowNode?: () => unknown };
    created.onBeforeCompile = material.onBeforeCompile;
    created.customProgramCacheKey = material.customProgramCacheKey;
    created.receivedShadowNode = () => lit;
    created.name = `${material.name}:unshadowed`;
    material.addEventListener('dispose', () => created.dispose());
    unshadowedTwins.set(material, created);
    twin = created;
  }
  return twin;
}

/**
 * One instanced mesh whose shared geometry follows a projected-error LOD choice. WebGPU builds a
 * node program per InstancedMesh (Three keys instanced render objects by object), so a set drawn
 * as three level meshes paid three builds, about 10 ms of main thread each, for one visible draw.
 * Levels here share the attribute layout, so swapping the geometry keeps the program; a level
 * without leaf cards swaps to the material's opaque twin (one more program, built when a batch
 * first draws that level); a level without geometry hides the mesh. The distant level never
 * casts shadows.
 * Distance is measured to the batch's bounds, not its bounding sphere: a kilometer-wide batch's
 * sphere reaches hundreds of meters above the canopy, so an aerial camera stayed inside it and drew
 * every plant in the batch at near detail.
 */
class InstancedDetailSwitch extends THREE.LOD {
  private selected = 0;
  /** The level last applied to the mesh. */
  private shown = 0;
  private perspectiveAt = Number.NEGATIVE_INFINITY;
  /** The host's shadow decision for the batch, and the flag this switch last set from it. */
  private castsShadow = false;
  private appliedShadow: boolean | undefined;
  /** What the last view-camera choice saw; see `update`. */
  private readonly seen = new Float64Array(23).fill(Number.NaN);
  constructor(
    readonly policy: ScreenSpaceLodPolicy,
    readonly bounds: THREE.Box3,
    readonly mesh: THREE.InstancedMesh,
    private readonly geometries: readonly (THREE.BufferGeometry | undefined)[],
    private readonly errors: readonly number[],
    private readonly materials: readonly THREE.Material[] = [],
    /** The distant level's material skips shadow lookups itself; see `unshadowedMaterial`. */
    private readonly shadowFreeDistant = false,
  ) {
    super();
    this.add(mesh);
  }

  override getCurrentLevel(): number {
    return this.selected;
  }

  override update(camera: THREE.Camera): void {
    const perspective = camera as THREE.PerspectiveCamera;
    // WebGPU renders sun shadows by projecting the scene again from the light's orthographic
    // camera, mid-frame. Selecting for it would swap the geometry the main pass then draws, so
    // only the view camera chooses: an orthographic camera counts only when it is the view.
    const now = performance.now();
    if (perspective.isPerspectiveCamera) this.perspectiveAt = now;
    else if (now - this.perspectiveAt < 250) return;
    const height = Math.max(1, this.policy.viewportHeight);
    const error = Math.max(0.1, this.policy.maxPixelError);
    if (!perspective.isPerspectiveCamera) {
      const ortho = camera as THREE.OrthographicCamera;
      const scale = this.matrixWorld.getMaxScaleOnAxis();
      const pixelsPerMeter =
        (height * ortho.zoom) / Math.max(0.001, (ortho.top ?? 1) - (ortho.bottom ?? -1));
      let level = 0;
      for (let i = 1; i < this.geometries.length; i++) {
        const threshold = this.selected >= i ? error * 1.15 : error;
        if ((this.errors[i] ?? 0) * scale * pixelsPerMeter <= threshold) level = i;
      }
      this.selected = level;
      this.seen[0] = Number.NaN;
    } else if (this.moved(perspective, height, error)) {
      const scale = this.matrixWorld.getMaxScaleOnAxis();
      const focal = height / (2 * Math.tan((perspective.fov * Math.PI) / 360));
      const local = this.worldToLocal(cameraPosition.setFromMatrixPosition(camera.matrixWorld));
      const distance = (this.bounds.distanceToPoint(local) * scale) / perspective.zoom;
      let level = 0;
      for (let i = 1; i < this.geometries.length; i++) {
        const threshold = (scale * (this.errors[i] ?? 0) * focal) / error;
        // 15% hysteresis toward the level already shown, as THREE.LOD does.
        if (distance >= (this.selected >= i ? threshold * 0.85 : threshold)) level = i;
        else break;
      }
      this.selected = level;
    }
    // Keep the level shown while the material the chosen one draws with is still being prepared,
    // as `userData.materialReady` (a preparing renderer sets it) reports: drawing it now would build
    // its shaders mid-frame. Asking moves its preparation ahead; the choice is made again next frame.
    const wanted = this.materials[this.selected];
    const ready = this.mesh.userData.materialReady as
      | ((material: THREE.Material) => boolean)
      | undefined;
    if (
      this.selected !== this.shown &&
      this.geometries[this.selected] !== undefined &&
      wanted !== undefined &&
      wanted !== this.mesh.material &&
      ready?.(wanted) === false
    ) {
      this.selected = this.shown;
      this.seen[0] = Number.NaN;
    }
    const level = this.selected;
    this.shown = level;
    // The host marks the batch for shadows from its near geometry, possibly after a first update
    // (a renderer preparing the batch selects its level before the host publishes it): a flag
    // this switch did not set is the host's decision.
    if (this.mesh.castShadow !== this.appliedShadow) this.castsShadow = this.mesh.castShadow;
    const geometry = this.geometries[level];
    this.mesh.visible = geometry !== undefined;
    if (geometry !== undefined && this.mesh.geometry !== geometry) this.mesh.geometry = geometry;
    const material = this.materials[level];
    if (material !== undefined && this.mesh.material !== material) this.mesh.material = material;
    this.mesh.castShadow = level < this.geometries.length - 1 && this.castsShadow;
    this.appliedShadow = this.mesh.castShadow;
    // Nor does it receive them: it stands mostly past the camera-following shadow map, yet each
    // of its fragments still paid for the map's soft lookups across a whole distant tree line. A
    // shadow-free material skips them itself and the host's flag stays, as shaders are built for it.
    if (!this.shadowFreeDistant) this.mesh.receiveShadow = level < this.geometries.length - 1;
  }

  /**
   * Whether a view camera's choice could differ from the last one. Three's projection and the
   * WebGPU bundle walk both update every LOD each frame, and a still camera chooses the same level
   * frame after frame: with a few thousand batches the repeated matrix inverses were milliseconds
   * of main thread. The level's mesh state is still applied on every update, since the host may
   * set shadow flags or visibility on the batch in between. The camera's world matrix is current
   * here, as THREE.LOD itself assumes.
   */
  private moved(camera: THREE.PerspectiveCamera, height: number, error: number): boolean {
    const seen = this.seen,
      view = camera.matrixWorld.elements,
      own = this.matrixWorld.elements;
    let same =
      seen[0] === view[12] &&
      seen[1] === view[13] &&
      seen[2] === view[14] &&
      seen[3] === camera.fov &&
      seen[4] === camera.zoom &&
      seen[5] === height &&
      seen[6] === error;
    for (let i = 0; same && i < 16; i++) same = seen[7 + i] === own[i];
    if (same) return false;
    seen[0] = view[12] as number;
    seen[1] = view[13] as number;
    seen[2] = view[14] as number;
    seen[3] = camera.fov;
    seen[4] = camera.zoom;
    seen[5] = height;
    seen[6] = error;
    seen.set(own, 7);
    return true;
  }
}
const cameraPosition = new THREE.Vector3();

/** No per-frame instance uploads: LOD switches shared models, with 15% transition hysteresis. */
export function createInstancedPlacementLod(
  set: PlacementSet,
  models: readonly [PreparedModel, PreparedModel, PreparedModel],
  options: InstancedPlacementLodOptions = {},
  name = `worldgen:${set.setId}`,
): THREE.Group {
  const size = options.cellSize ?? 512;
  const distances = options.distances ?? [180, 650];
  if (
    !(size > 0) ||
    !distances.every(Number.isFinite) ||
    distances[0] < 0 ||
    distances[1] <= distances[0]
  ) {
    throw new Error('instance LOD needs a positive cell size and increasing nonnegative distances');
  }
  const cells = new Map<string, number[]>();
  const grid = options.cellGrid;
  const corner = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  if (grid !== undefined)
    for (let i = 0; i < set.count; i++) {
      const offset = i * PLACEMENT_STRIDE;
      corner[0] = Math.min(corner[0] as number, set.data[offset] as number);
      corner[1] = Math.min(corner[1] as number, set.data[offset + 2] as number);
    }
  const cellOf = (value: number, axis: 0 | 1): number => {
    if (grid === undefined) return Math.floor(value / size);
    const index = Math.floor((value - (corner[axis] as number)) / size);
    return Math.min(grid.cellsPerAxis - 1, Math.max(0, index));
  };
  for (let i = 0; i < set.count; i++) {
    const offset = i * PLACEMENT_STRIDE;
    const key = `${cellOf(set.data[offset] as number, 0)}/${cellOf(set.data[offset + 2] as number, 1)}`;
    const cell = cells.get(key) ?? [];
    cell.push(i);
    cells.set(key, cell);
  }
  const group = new THREE.Group();
  group.name = name;
  // A model that is near detail only (ground cover) draws nothing at its later levels.
  const drawn = (model: PreparedModel): boolean =>
    model.geometry.getAttribute('position').count > 0;
  if (!drawn(models[0])) return group;
  for (const [key, indices] of cells) {
    const data = new Float32Array(indices.length * PLACEMENT_STRIDE);
    indices.forEach((index, i) => {
      data.set(
        set.data.subarray(index * PLACEMENT_STRIDE, (index + 1) * PLACEMENT_STRIDE),
        i * PLACEMENT_STRIDE,
      );
    });
    const subset = { ...set, count: indices.length, data };
    const first = createInstancedPlacements(
      subset,
      models[0].geometry,
      models[0].material,
      `${name}:${key}:near`,
    );
    first.computeBoundingBox();
    const center = (first.boundingBox as THREE.Box3).getCenter(new THREE.Vector3());
    // Localize the instances around the LOD origin so floating-origin rebasing is automatic.
    for (let i = 0; i < indices.length; i++) {
      const offset = i * 16;
      first.instanceMatrix.array[offset + 12] =
        (first.instanceMatrix.array[offset + 12] as number) - center.x;
      first.instanceMatrix.array[offset + 13] =
        (first.instanceMatrix.array[offset + 13] as number) - center.y;
      first.instanceMatrix.array[offset + 14] =
        (first.instanceMatrix.array[offset + 14] as number) - center.z;
    }
    first.computeBoundingBox();
    first.computeBoundingSphere();
    // Ground cover (a near-detail-only model) is walked through and flown over, not collided
    // with: over a forest floor its ferns and shrubs were most of the 170k triangles an aircraft's
    // collision neighborhood rebuilt every 24 m of a takeoff roll.
    if (!drawn(models[1])) first.userData.walkIgnore = true;
    const radius = first.boundingSphere?.radius ?? 0;
    let largestScale = 0;
    for (let i = 0; i < indices.length; i++) {
      const offset = i * PLACEMENT_STRIDE;
      largestScale = Math.max(
        largestScale,
        Math.abs(data[offset + 4] as number),
        Math.abs(data[offset + 5] as number),
        Math.abs(data[offset + 6] as number),
      );
    }
    if (options.screenSpace) {
      const geometries: (THREE.BufferGeometry | undefined)[] = [models[0].geometry];
      const materials = [levelMaterial(models[0].material, models[0].geometry)];
      const errors = [0];
      for (let level = 1; level < models.length; level++) {
        const model = models[level] as PreparedModel;
        if (model.geometry === models[level - 1]?.geometry) continue;
        geometries.push(drawn(model) ? model.geometry : undefined);
        materials.push(levelMaterial(model.material, model.geometry));
        errors.push(handoverError(level, models[level - 1] as PreparedModel) * largestScale);
        if (!drawn(model)) break;
      }
      const last = geometries.length - 1;
      const shadowFree =
        last > 0 && geometries[last] !== undefined
          ? unshadowedMaterial(materials[last] as THREE.Material, models[0].material)
          : undefined;
      if (shadowFree !== undefined) materials[last] = shadowFree;
      first.material = materials[0] as THREE.Material;
      // The renderer prepares the materials a level swaps in (the opaque and shadow-free twins)
      // ahead of the frame that first shows them, which would otherwise build them mid-frame.
      const variants = [...new Set(materials.filter((_, level) => geometries[level]))];
      if (variants.length > 1) first.userData.materialVariants = variants;
      const bounds = (first.boundingBox as THREE.Box3).clone();
      const lod = new InstancedDetailSwitch(
        options.screenSpace,
        bounds,
        first,
        geometries,
        errors,
        materials,
        shadowFree !== undefined,
      );
      lod.name = `${name}:${key}`;
      lod.position.copy(center);
      group.add(lod);
      lod.traverse((object) => {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
      });
      continue;
    }
    const lod = options.screenSpace
      ? new ScreenSpaceLod(options.screenSpace, radius)
      : new THREE.LOD();
    lod.name = `${name}:${key}`;
    lod.position.copy(center);
    lod.updateMatrix();
    lod.matrixAutoUpdate = false;
    if (lod instanceof ScreenSpaceLod) lod.addDetail(first, 0);
    else lod.addLevel(first, 0);
    for (let level = 1; level < models.length; level++) {
      const model = models[level] as PreparedModel;
      if (model.geometry === models[level - 1]?.geometry) continue;
      if (!drawn(model)) {
        const nothing = new THREE.Group();
        nothing.name = `${name}:${key}:lod${level}`;
        nothing.visible = false;
        if (lod instanceof ScreenSpaceLod)
          lod.addDetail(
            nothing,
            handoverError(level, models[level - 1] as PreparedModel) * largestScale,
          );
        else lod.addLevel(nothing, (distances[level - 1] as number) + radius, 0.15);
        break;
      }
      const mesh = new THREE.InstancedMesh(
        model.geometry,
        levelMaterial(model.material, model.geometry),
        0,
      );
      mesh.count = first.count;
      mesh.instanceMatrix = first.instanceMatrix;
      mesh.instanceColor = first.instanceColor;
      mesh.name = `${name}:${key}:lod${level}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      // The distant level stands kilometers out, past the camera-following shadow map, yet a
      // batch kilometers across still overlaps the shadow frustum; keep it out of the shadow pass.
      if (level === models.length - 1) mesh.userData.shadowCaster = false;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      if (lod instanceof ScreenSpaceLod) {
        lod.addDetail(
          mesh,
          handoverError(level, models[level - 1] as PreparedModel) * largestScale,
        );
      } else lod.addLevel(mesh, (distances[level - 1] as number) + radius, 0.15);
      mesh.visible = false;
    }
    group.add(lod);
    lod.traverse((object) => {
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
  }
  return group;
}
