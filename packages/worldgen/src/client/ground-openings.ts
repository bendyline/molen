/**
 * Ground a host opens under a batch's plants: what stands on the ground must not stand where the
 * host has cut it away.
 *
 * A batch's ground cover runs on over whatever lies under it, as the map's does, and its plants
 * stand at the height of the ground that cover was painted on. A host may cut that ground open
 * after the batch was made (a tunnel's mouth or an open cutting, cut down to the bore), and then a
 * plant stood at the cut-away hillside's height hangs in the opening. `GroundOpenings` is the
 * host's word on where that is; the batch's tufts (`./turf`), near plants (`./near-placements`)
 * and instanced placements (`GroundOpeningGuard`) each leave out what stands on opened ground.
 *
 * What opens the ground (another layer of the host's) may be drawn after the plants, and may come
 * and go with it, so each asks again when the host's `version` changes (or, without one, every
 * `GROUND_OPEN_RECHECK` frames). Only what `near` names is ever asked about.
 */

import * as THREE from 'three';

/**
 * Where a host opens its drawn ground under a batch, in the batch's frame (x/z local meters, y
 * absolute, as placements are).
 */
export interface GroundOpenings {
  /** Whether any of the square `x0..x1` by `z0..z1` may be opened: asked once for each square. */
  near(x0: number, z0: number, x1: number, z1: number): boolean;
  /** Whether the ground at a point is opened now: asked for each root in a square `near` named. */
  at(x: number, y: number, z: number): boolean;
  /**
   * A value that changes whenever the answers of `at` may have: what opens the ground was drawn,
   * hidden or replaced. Without it, `at` is asked again every `GROUND_OPEN_RECHECK` frames.
   */
  version?(): number;
}

/** Frames between asking again when the host gives no `version`: half a second at 60 frames. */
export const GROUND_OPEN_RECHECK = 30;

/** When to ask a host's `GroundOpenings` again; see the module comment. */
export class GroundOpeningsWatch {
  private frames = 0;
  private seen = Number.NaN;
  constructor(private readonly openings: GroundOpenings) {}

  /**
   * Whether the answers may have changed since this last said so: true the first time. Call it
   * once a frame (a view camera's).
   */
  due(): boolean {
    const version = this.openings.version?.();
    if (version !== undefined) {
      if (version === this.seen) return false;
      this.seen = version;
      return true;
    }
    if (this.frames > 0 && this.frames < GROUND_OPEN_RECHECK) {
      this.frames++;
      return false;
    }
    this.frames = 1;
    return true;
  }
}

const matrix = new THREE.Matrix4();
const chain = new THREE.Matrix4();
const root = new THREE.Vector3();

/**
 * Hides the instances of a batch's instanced placements (`targets`, as built by
 * `createInstancedPlacementLod` or `createInstancedPlacements`) whose roots stand on ground the
 * host opens, and shows them again if it closes. A hidden instance keeps its place and is drawn
 * at no size. Add it beside the targets, in the frame the openings answer in (the batch's).
 *
 * It is a `THREE.LOD`, so a renderer hands it the view camera every frame and a host has nothing
 * to call. The first time, it finds the instances in squares the openings name; after that it asks
 * about those alone, when the watch says to.
 */
export class GroundOpeningGuard extends THREE.LOD {
  /** Instances hidden after the latest answers. */
  hidden = 0;
  /** Instances it asks about: those standing where the ground may be opened. */
  watched = 0;
  private readonly watch: GroundOpeningsWatch;
  private batches?: THREE.InstancedMesh[];
  /** For each watched instance: its batch's place in `batches`, its index there, and its root. */
  private entries = new Float64Array(0);
  /** Each watched instance's own matrix, kept while it is hidden. */
  private matrices = new Float32Array(0);
  private shown = new Uint8Array(0);

  constructor(
    private readonly targets: readonly THREE.Object3D[],
    private readonly openings: GroundOpenings,
    name = 'worldgen:ground-openings',
  ) {
    super();
    this.name = name;
    this.watch = new GroundOpeningsWatch(openings);
  }

  override update(camera: THREE.Camera): void {
    // Only a view camera: a sun's shadow camera sees what the view's chose.
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera || !this.watch.due()) return;
    this.refresh();
  }

  /** Ask about every watched instance now, and hide or show each as the answer says. */
  refresh(): void {
    if (this.batches === undefined) this.collect();
    const batches = this.batches as THREE.InstancedMesh[];
    const changed = new Set<THREE.InstancedMesh>();
    let hidden = 0;
    for (let k = 0; k < this.watched; k++) {
      const e = k * 5;
      const batch = batches[this.entries[e] as number] as THREE.InstancedMesh;
      const index = this.entries[e + 1] as number;
      const open = this.openings.at(
        this.entries[e + 2] as number,
        this.entries[e + 3] as number,
        this.entries[e + 4] as number,
      );
      if (open) hidden++;
      const show = open ? 0 : 1;
      if (this.shown[k] === show) continue;
      this.shown[k] = show;
      const array = batch.instanceMatrix.array as Float32Array;
      const at = index * 16;
      if (show === 1) array.set(this.matrices.subarray(k * 16, k * 16 + 16), at);
      else {
        // No size, at its own root: every vertex at one point, so nothing is drawn or cast.
        for (let i = 0; i < 12; i++) array[at + i] = 0;
      }
      changed.add(batch);
    }
    for (const batch of changed) {
      batch.instanceMatrix.clearUpdateRanges();
      batch.instanceMatrix.needsUpdate = true;
    }
    this.hidden = hidden;
  }

  /** Find the instances standing where the ground may be opened, and keep what hiding needs. */
  private collect(): void {
    const frame = this.parent;
    const batches: THREE.InstancedMesh[] = [];
    const entries: number[] = [];
    const matrices: number[] = [];
    for (const target of this.targets)
      target.traverse((object) => {
        const batch = object as THREE.InstancedMesh;
        if (!batch.isInstancedMesh) return;
        // The batch's place in the frame: its own transform and its parents' up to the frame.
        chain.identity();
        for (let o: THREE.Object3D | null = batch; o !== null && o !== frame; o = o.parent) {
          if (o.matrixAutoUpdate) o.updateMatrix();
          chain.premultiply(o.matrix);
        }
        const array = batch.instanceMatrix.array as Float32Array;
        let slot = -1;
        for (let index = 0; index < batch.count; index++) {
          matrix.fromArray(array, index * 16);
          root.setFromMatrixPosition(matrix).applyMatrix4(chain);
          if (!this.openings.near(root.x, root.z, root.x, root.z)) continue;
          if (slot < 0) slot = batches.push(batch) - 1;
          entries.push(slot, index, root.x, root.y, root.z);
          for (let i = 0; i < 16; i++) matrices.push(array[index * 16 + i] as number);
        }
      });
    this.batches = batches;
    this.entries = Float64Array.from(entries);
    this.matrices = Float32Array.from(matrices);
    this.watched = entries.length / 5;
    this.shown = new Uint8Array(this.watched).fill(1);
  }
}

/**
 * Hide a batch's instanced placements where the host opens the ground under them (see
 * `GroundOpeningGuard`). Add the returned object beside `targets`.
 */
export function createGroundOpeningGuard(
  targets: readonly THREE.Object3D[],
  openings: GroundOpenings,
  name?: string,
): GroundOpeningGuard {
  return new GroundOpeningGuard(targets, openings, name);
}
