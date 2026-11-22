/**
 * Near placements: a batch's `NearPlacements` (the plants `crowns` rules stand on the shrub crowns
 * the ground paints) drawn around the view camera only.
 *
 * A few square kilometers of desert or scrub paint tens of thousands of crowns. Drawn like the rest
 * of scatter, as instance batches across the whole batch, they cost more than a frame can spend,
 * and capped they
 * left most crowns without a plant: those faded from dark discs to bare ground as they were reached
 * (the ground gives way to the plant within about 60 m). Here every crown near the camera stands its
 * plant, and the ground's paint carries the rest. Within `full` meters of the camera every plant
 * stands; out to `radius` they thin, each at a distance of its own (its crown's `reach` byte when
 * the batch carries one, else drawn from its position), so the same plants go as the camera moves
 * away and come back as it returns, shrinking over `shrink` meters before it goes. A ground that
 * paints the crowns takes the same reach (`nearPlacementReach`) and paints each crown exactly where
 * its plant is not drawn. The near model draws within `detail` meters, the medium model beyond.
 *
 * The object is a `THREE.LOD`, so a renderer hands it the view camera every frame (as it does the
 * scatter's detail switches) and a host has nothing to call. Each time the camera has moved `step`
 * meters it walks the placement cells within reach and rewrites one instance batch per model and
 * band. Those batches exist from the start (empty and hidden), so a host that marks shadow casters
 * once, when it adds a batch's objects to its scene, marks them too; a batch that outgrows its room
 * is replaced by a larger one with the same flags. Only perspective cameras choose: a sun's orthographic shadow
 * camera sees what the view camera chose. Walk collision leaves the batches out
 * (`userData.walkIgnore`): they change as the camera moves, and a walker passes through brush.
 *
 * Related: `../kernel/scatter.ts` (`crowns` rules, `ScatterSample.near`), `../kernel/types.ts`
 * (`NearPlacements`), `./instanced-lod.ts` (the rest of the scatter, and `levelMaterial`).
 */

import { InstanceBatch } from '@bendyline/molen-client/instancing';
import * as THREE from 'three';
import { type NearPlacements, PLACEMENT_STRIDE } from '../kernel/types';
import { levelMaterial } from './instanced-lod';
import type { PreparedModel } from './instanced-models';

export interface NearPlacementOptions {
  /** Meters from the camera within which every plant stands (default 120). */
  full?: number;
  /** Meters from the camera past which none does (default 300); between, they thin out. */
  radius?: number;
  /** Meters over which a plant shrinks away before it goes (default 12). */
  shrink?: number;
  /** Meters within which a plant draws as its near model, its medium model beyond (default 50). */
  detail?: number;
  /** Meters the camera moves before the plants are chosen again (default 2). */
  step?: number;
}

/**
 * How far the near placements reach under `options`: every plant within `full`, each out to its
 * own reach up to `radius`, shrinking over `shrink`. A ground that paints the crowns the plants
 * stand on takes the same numbers (`setTerrainGroundCrownReach` in the terrain package), so it
 * paints each crown exactly where its plant is not drawn.
 */
export function nearPlacementReach(options: NearPlacementOptions = {}): {
  full: number;
  radius: number;
  shrink: number;
} {
  const radius = Math.max(1, options.radius ?? 300);
  return {
    full: Math.min(radius, Math.max(0, options.full ?? 120)),
    radius,
    shrink: Math.max(0.01, options.shrink ?? 12),
  };
}

/** A model's levels for the near placements: `medium` defaults to `near`. */
export interface NearPlacementModel {
  near: PreparedModel;
  medium?: PreparedModel;
}

/** Instances one batch starts with room for, at least. */
const MIN_ROOM = 16;

interface Slot {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Model radius at unit scale, for the batch's bounds. */
  extent: number;
  batch: InstanceBatch;
  room: number;
  /** Room the first use asks for: the model's share of a camera's reach at the mean density. */
  estimate: number;
  fill: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  reach: number;
}

const cameraPosition = new THREE.Vector3();
const inverseWorld = new THREE.Matrix4();
const color = new THREE.Color();
const instancePosition = new THREE.Vector3();

/** A plant's share of the thinning band, in [0, 1), from its position alone. */
function thinning(x: number, z: number): number {
  let h =
    Math.imul(Math.round(x * 64) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(z * 64) | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The plants of a `NearPlacements` within reach of the view camera; see the module comment. Its
 * frame is the batch's: x/z local meters, y absolute, as the placements are.
 */
export class NearPlacementObject extends THREE.LOD {
  /** Plants drawn after the latest choice. */
  drawn = 0;
  private readonly slots: (Slot | undefined)[] = [];
  private readonly full: number;
  private readonly radius: number;
  private readonly shrink: number;
  private readonly detail: number;
  private readonly step: number;
  /** Where the camera was at the latest choice; NaN before the first. */
  private readonly chosenAt = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  /** Each plant's distance from the camera past which it is not drawn. */
  private readonly reaches: Float32Array;
  /** Instances are written relative to the grid's middle, so matrices stay small. */
  private readonly anchorX: number;
  private readonly anchorZ: number;

  constructor(
    readonly placements: NearPlacements,
    models: ReadonlyMap<string, NearPlacementModel>,
    options: NearPlacementOptions = {},
    name = 'worldgen:near',
  ) {
    super();
    this.name = name;
    const reach = nearPlacementReach(options);
    this.radius = reach.radius;
    this.full = reach.full;
    this.shrink = reach.shrink;
    this.detail = Math.max(0, options.detail ?? 50);
    this.step = Math.max(0, options.step ?? 2);
    const { cell, columns, rows, originX, originZ, count, data } = placements;
    this.anchorX = originX + (columns * cell) / 2;
    this.anchorZ = originZ + (rows * cell) / 2;
    // Each plant's reach: its crown's own place in the band when the batch carries it (a ground
    // painting the crowns reads the same value), else one drawn from its position.
    this.reaches = new Float32Array(count);
    const band = this.radius - this.full;
    const shares = placements.reach;
    for (let k = 0; k < count; k++) {
      const at = k * PLACEMENT_STRIDE;
      const share =
        shares !== undefined
          ? (shares[k] as number) / 255
          : thinning(data[at] as number, data[at + 2] as number);
      this.reaches[k] = this.full + share * band;
    }
    // Room for what a camera's reach holds at the batch's mean density of each model (the
    // thinning band at about half), with headroom; a denser patch grows the batch. Every batch
    // starts small and takes that room when first used, so objects away from the camera hold little.
    const area = Math.max(1, columns * rows * cell * cell);
    const perModel = new Uint32Array(placements.models.length);
    for (let k = 0; k < count; k++) {
      const index = placements.model[k] as number;
      perModel[index] = (perModel[index] as number) + 1;
    }
    const nearArea = Math.PI * Math.min(this.detail, this.radius) ** 2;
    const reachArea =
      Math.PI * this.full ** 2 + (Math.PI * (this.radius ** 2 - this.full ** 2)) / 2;
    const farArea = Math.max(0, reachArea - nearArea);
    placements.models.forEach((ref, index) => {
      const levels = models.get(ref);
      if (levels === undefined) return;
      const density = (perModel[index] as number) / area;
      const medium =
        levels.medium !== undefined && levels.medium.geometry.getAttribute('position').count > 0
          ? levels.medium
          : levels.near;
      for (const [band, model, disc] of [
        [0, levels.near, nearArea],
        [1, medium, farArea],
      ] as const) {
        const estimate = Math.max(MIN_ROOM, Math.ceil(density * disc * 1.25));
        this.slots[index * 2 + band] = this.createSlot(model, estimate, `${name}:${ref}:${band}`);
      }
    });
  }

  private createSlot(model: PreparedModel, estimate: number, name: string): Slot {
    const geometry = model.geometry;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    const slot: Slot = {
      geometry,
      material: levelMaterial(model.material, geometry),
      extent:
        (geometry.boundingSphere?.radius ?? 1) + (geometry.boundingSphere?.center.length() ?? 0),
      batch: undefined as unknown as InstanceBatch,
      room: MIN_ROOM,
      estimate,
      fill: 0,
      min: new THREE.Vector3(),
      max: new THREE.Vector3(),
      reach: 0,
    };
    slot.batch = this.createBatch(slot, name);
    return slot;
  }

  private createBatch(slot: Slot, name: string, from?: InstanceBatch): InstanceBatch {
    const batch = new InstanceBatch(slot.geometry, slot.material, slot.room);
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // A batch drawn without colors keeps that build: give it colors before its first draw.
    batch.setColorAt(0, color.setRGB(1, 1, 1));
    batch.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    batch.count = 0;
    batch.visible = false;
    batch.name = name;
    // A host's shadow decision (made once, when it added the object) carries over to a larger batch.
    batch.castShadow = from?.castShadow ?? true;
    batch.receiveShadow = from?.receiveShadow ?? true;
    batch.userData.walkIgnore = true;
    batch.position.set(this.anchorX, 0, this.anchorZ);
    batch.updateMatrix();
    batch.matrixAutoUpdate = false;
    batch.boundingBox = new THREE.Box3();
    batch.boundingSphere = new THREE.Sphere();
    this.add(batch);
    if (from !== undefined) batch.updateMatrixWorld(true);
    return batch;
  }

  /** Make room for at least `needed` instances, keeping the ones written so far. */
  private grow(slot: Slot, needed: number): void {
    const old = slot.batch;
    slot.room = Math.max(needed, slot.estimate, slot.room * 2);
    const batch = this.createBatch(slot, old.name, old);
    (batch.instanceMatrix.array as Float32Array).set(
      (old.instanceMatrix.array as Float32Array).subarray(0, slot.fill * 16),
    );
    const colors = old.instanceColor?.array as Float32Array | undefined;
    if (colors !== undefined)
      (batch.instanceColor?.array as Float32Array).set(colors.subarray(0, slot.fill * 3));
    this.remove(old);
    old.dispose();
    slot.batch = batch;
  }

  override update(camera: THREE.Camera): void {
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return;
    // The world matrix is current here, as THREE.LOD assumes.
    const local = cameraPosition
      .setFromMatrixPosition(camera.matrixWorld)
      .applyMatrix4(inverseWorld.copy(this.matrixWorld).invert());
    if (local.distanceToSquared(this.chosenAt) < this.step * this.step) return;
    this.chosenAt.copy(local);
    this.choose(local);
  }

  /** Choose and write the plants within reach of `camera` (this object's frame). */
  choose(camera: THREE.Vector3): void {
    for (const slot of this.slots) {
      if (slot === undefined) continue;
      slot.fill = 0;
      slot.reach = 0;
      slot.min.set(Infinity, Infinity, Infinity);
      slot.max.set(-Infinity, -Infinity, -Infinity);
    }
    const { cell, columns, rows, originX, originZ, start, data, model } = this.placements;
    const radius = this.radius;
    const column0 = Math.max(0, Math.floor((camera.x - radius - originX) / cell));
    const column1 = Math.min(columns - 1, Math.floor((camera.x + radius - originX) / cell));
    const row0 = Math.max(0, Math.floor((camera.z - radius - originZ) / cell));
    const row1 = Math.min(rows - 1, Math.floor((camera.z + radius - originZ) / cell));
    const radius2 = radius * radius;
    let drawn = 0;
    for (let row = row0; row <= row1; row++) {
      const z0 = originZ + row * cell;
      const dz = camera.z < z0 ? z0 - camera.z : camera.z > z0 + cell ? camera.z - z0 - cell : 0;
      for (let column = column0; column <= column1; column++) {
        const x0 = originX + column * cell;
        const dx = camera.x < x0 ? x0 - camera.x : camera.x > x0 + cell ? camera.x - x0 - cell : 0;
        if (dx * dx + dz * dz >= radius2) continue;
        const k = row * columns + column;
        const end = start[k + 1] as number;
        for (let i = start[k] as number; i < end; i++) {
          const at = i * PLACEMENT_STRIDE;
          const x = data[at] as number,
            y = data[at + 1] as number,
            z = data[at + 2] as number;
          const ox = x - camera.x,
            oy = y - camera.y,
            oz = z - camera.z;
          const distance2 = ox * ox + oy * oy + oz * oz;
          const reach = this.reaches[i] as number;
          if (distance2 >= reach * reach) continue;
          const distance = Math.sqrt(distance2);
          const slot = this.slots[(model[i] as number) * 2 + (distance < this.detail ? 0 : 1)];
          if (slot === undefined) continue;
          if (slot.fill >= slot.room) this.grow(slot, slot.fill + 1);
          const size = Math.min(1, (reach - distance) / this.shrink);
          this.write(slot, data, at, x - this.anchorX, y, z - this.anchorZ, size);
          drawn++;
        }
      }
    }
    for (const slot of this.slots) if (slot !== undefined) this.publish(slot);
    this.drawn = drawn;
  }

  private write(
    slot: Slot,
    data: Float32Array,
    at: number,
    x: number,
    y: number,
    z: number,
    size: number,
  ): void {
    const yaw = data[at + 3] as number;
    const sx = (data[at + 4] as number) * size,
      sy = (data[at + 5] as number) * size,
      sz = (data[at + 6] as number) * size;
    const cos = Math.cos(yaw),
      sin = Math.sin(yaw);
    // Matrix4.compose(position, a turn about +Y, scale), written out.
    const matrices = slot.batch.instanceMatrix.array as Float32Array;
    const m = slot.fill * 16;
    matrices[m] = cos * sx;
    matrices[m + 1] = 0;
    matrices[m + 2] = -sin * sx;
    matrices[m + 3] = 0;
    matrices[m + 4] = 0;
    matrices[m + 5] = sy;
    matrices[m + 6] = 0;
    matrices[m + 7] = 0;
    matrices[m + 8] = sin * sz;
    matrices[m + 9] = 0;
    matrices[m + 10] = cos * sz;
    matrices[m + 11] = 0;
    matrices[m + 12] = x;
    matrices[m + 13] = y;
    matrices[m + 14] = z;
    matrices[m + 15] = 1;
    // Placement colors are sRGB-encoded, as every procedural color (see createInstancedPlacements).
    color.setRGB(
      data[at + 7] as number,
      data[at + 8] as number,
      data[at + 9] as number,
      THREE.SRGBColorSpace,
    );
    const colors = slot.batch.instanceColor?.array as Float32Array | undefined;
    if (colors !== undefined) {
      const c = slot.fill * 3;
      colors[c] = color.r;
      colors[c + 1] = color.g;
      colors[c + 2] = color.b;
    }
    slot.min.min(instancePosition.set(x, y, z));
    slot.max.max(instancePosition);
    slot.reach = Math.max(slot.reach, Math.max(sx, sy, sz) * slot.extent);
    slot.fill++;
  }

  private publish(slot: Slot): void {
    const batch = slot.batch;
    batch.count = slot.fill;
    batch.visible = slot.fill > 0;
    if (slot.fill === 0) return;
    const box = batch.boundingBox as THREE.Box3;
    box.min.copy(slot.min).subScalar(slot.reach);
    box.max.copy(slot.max).addScalar(slot.reach);
    box.getBoundingSphere(batch.boundingSphere as THREE.Sphere);
    const matrices = batch.instanceMatrix;
    matrices.clearUpdateRanges();
    matrices.addUpdateRange(0, slot.fill * 16);
    matrices.needsUpdate = true;
    const colors = batch.instanceColor;
    if (colors !== null) {
      colors.clearUpdateRanges();
      colors.addUpdateRange(0, slot.fill * 3);
      colors.needsUpdate = true;
    }
  }

  /** Release the batches; the models' geometry and materials are shared and stay. */
  dispose(): void {
    for (const slot of this.slots) slot?.batch.dispose();
    this.slots.length = 0;
  }
}

/**
 * Draw a batch's near placements around the view camera (see `NearPlacementObject`). `models`
 * holds each placement model's near and medium levels; a model it lacks is not drawn. Add the
 * object where the batch's other placements go (its frame is theirs).
 */
export function createNearPlacements(
  placements: NearPlacements,
  models: ReadonlyMap<string, NearPlacementModel>,
  options: NearPlacementOptions = {},
  name?: string,
): NearPlacementObject {
  return new NearPlacementObject(placements, models, options, name);
}

/** Whether `object` draws near placements. */
export function isNearPlacementObject(object: THREE.Object3D): object is NearPlacementObject {
  return object instanceof NearPlacementObject;
}
