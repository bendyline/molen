/**
 * Turf: tufts of grass stood round the view camera on the ground a batch's `TurfCover` says grows
 * it.
 *
 * A lawn or a meadow is a tuft or two a square meter: hundreds of thousands a batch, and a camera
 * sees the few thousand within some tens of meters. So no batch holds placements for them. The
 * cover is a mask; each tuft's place, size and tone come from its position alone (a lattice
 * anchored in the world, so a tuft is the same tuft whichever batch draws it and whenever), and
 * its height from the ground the host draws. Tufts are worked out a square (`CHUNK`) at a time as
 * the camera comes within reach and forgotten when it has gone.
 *
 * Within `full` meters of the camera every tuft stands; out to `radius` they thin, each to a
 * distance of its own, shrinking over `shrink` meters before it goes, so the sward frays out into
 * the ground's own texture instead of ending on a line. Shorter grass stops sooner: a mown lawn's
 * tufts are a pixel tall well inside a meadow's reach. The near tuft draws within `detail`
 * meters, a plainer one out to `plain`, and the plainest beyond.
 *
 * Like the near placements (`./near-placements`), the object is a `THREE.LOD`: a renderer hands
 * it the view camera every frame, and each time that has moved `step` meters it writes the tufts
 * within reach into three instance batches, which exist from the start (empty and hidden). Only a
 * perspective camera chooses. The batches cast no shadows, and walk collision leaves them out.
 */

import { InstanceBatch } from '@bendyline/molen-client/instancing';
import * as THREE from 'three';
import { readTurfRow } from '../kernel/turf';
import type { TurfCover } from '../kernel/types';
import { levelMaterial } from './instanced-lod';
import type { PreparedModel } from './instanced-models';

export interface TurfOptions {
  /** Meters from the camera within which every tuft stands (default 28). */
  full?: number;
  /** Meters from the camera past which none does (default 68); between, they thin out. */
  radius?: number;
  /** Meters over which a tuft shrinks away before it goes (default 8). */
  shrink?: number;
  /** Meters within which a tuft draws as the near model (default 9). */
  detail?: number;
  /** Meters past which a tuft draws as the far model, the middle one between (default 26). */
  plain?: number;
  /** Meters the camera moves before the tufts are chosen again (default 2). */
  step?: number;
  /** Multiplier on every sward's density (default 1): fewer, not smaller, tufts below 1. */
  density?: number;
}

/** What turf is drawn with and stands on. */
export interface TurfSource {
  /**
   * The tuft's near model, the plainer one drawn past `detail` (default: the near one) and the
   * plainest, drawn past `plain` (default: the middle one).
   */
  near: PreparedModel;
  middle?: PreparedModel;
  far?: PreparedModel;
  /** Height of the drawn ground at a point of the cover's frame (local x/z; y as placements). */
  ground(x: number, z: number): number;
  /**
   * The linear color of the ground under grass of a sward's `label` at a point, written to and
   * returned as `out`: tufts take it, so a sward is its ground's color. Default: a mid green.
   */
  color?(label: string, x: number, z: number, out: THREE.Color): THREE.Color;
  /**
   * Where the cover's local origin lies in the world, so tufts keep their places across batches
   * and sessions (default the origin itself).
   */
  anchor?: readonly [x: number, z: number];
  /**
   * The highest ground under the cover, when the host has it without sampling: a camera farther
   * above it than turf reaches works nothing out and never asks for the ground. Without it the
   * ground under the camera is asked for instead.
   */
  top?(): number;
}

/** Edge of the squares tufts are worked out in, meters. */
const CHUNK = 8;
/** Floats a tuft is kept as: x, y, z, cos and sin of its turn, spread, height, r, g, b, reach. */
const STRIDE = 11;
/** Share of the lattice spacing a tuft may stand off its lattice point. */
const JITTER = 0.9;
/** Meters a tuft's root is set into the ground it stands on. */
const SINK = 0.02;
/** A tuft's spread (root to farthest tip) for its height: `SPREAD * sqrt(height)` meters. */
const SPREAD = 0.68;
/**
 * How much larger the tuft that reaches the far edge of the thinning band is than one that
 * stops at its near edge. The tufts left standing far out are the large ones, so the sward keeps
 * some of its cover as it thins; near the camera they are the big tussocks among the rest.
 */
const FAR_GROWTH = 0.7;
/**
 * The height at which a sward reaches the whole of the thinning band; shorter grass reaches a
 * share of it in proportion, down to `LEAST_BAND`.
 */
const FULL_BAND_HEIGHT = 0.3;
const LEAST_BAND = 0.45;
/** Instances a batch starts with room for, at least. */
const MIN_ROOM = 256;
/** Meters of rise or fall of the ground within reach allowed for when the camera is high above it. */
const RELIEF = 40;
const DEFAULT_GROUND = new THREE.Color(0.19, 0.25, 0.12);

interface Slot {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Model radius at unit scale, for the batch's bounds. */
  extent: number;
  batch: InstanceBatch;
  room: number;
  fill: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  reach: number;
}

const cameraPosition = new THREE.Vector3();
const inverseWorld = new THREE.Matrix4();
const scratchColor = new THREE.Color();
const instancePosition = new THREE.Vector3();
const white = new THREE.Color(1, 1, 1);

/** A 32-bit mix of two lattice coordinates and a stream. */
function hash(i: number, j: number, stream: number): number {
  let h =
    Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(stream, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const unit = (i: number, j: number, stream: number): number => hash(i, j, stream) / 4294967296;

/** How far turf reaches under `options`: see `TurfOptions`. */
export function turfReach(options: TurfOptions = {}): {
  full: number;
  radius: number;
  shrink: number;
} {
  const radius = Math.max(1, options.radius ?? 68);
  return {
    full: Math.min(radius, Math.max(0, options.full ?? 28)),
    radius,
    shrink: Math.max(0.01, options.shrink ?? 8),
  };
}

/**
 * The tufts of a `TurfCover` within reach of the view camera; see the module comment. Its frame
 * is the cover's: x/z local meters, y absolute, as a batch's placements are.
 */
export class TurfObject extends THREE.LOD {
  /** Tufts drawn after the latest choice. */
  drawn = 0;
  private readonly slots: [Slot, Slot, Slot];
  private readonly full: number;
  private readonly radius: number;
  private readonly shrink: number;
  private readonly detail: number;
  private readonly plain: number;
  private readonly step: number;
  /** Lattice spacing, meters: one candidate tuft a cell, at the densest sward's density. */
  private readonly spacing: number;
  /** Each sward's share of the lattice's candidates, and of the thinning band its tufts reach. */
  private readonly keep: number[];
  private readonly band: number[];
  private readonly anchorX: number;
  private readonly anchorZ: number;
  /** Instances are written relative to the cover's middle, so matrices stay small. */
  private readonly centerX: number;
  private readonly centerZ: number;
  /** Where the camera was at the latest choice; NaN before the first. */
  private readonly chosenAt = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  /** Tufts by square (`row * columns + column` of `CHUNK` squares); empty squares hold `null`. */
  private readonly chunks = new Map<number, Float32Array | null>();
  private readonly chunkColumns: number;
  private readonly chunkRows: number;
  private mask = new Uint8Array(0);

  constructor(
    readonly cover: TurfCover,
    private readonly source: TurfSource,
    options: TurfOptions = {},
    name = 'worldgen:turf',
  ) {
    super();
    this.name = name;
    const reach = turfReach(options);
    this.radius = reach.radius;
    this.full = reach.full;
    this.shrink = reach.shrink;
    this.detail = Math.max(0, options.detail ?? 9);
    this.plain = Math.max(this.detail, options.plain ?? 26);
    this.step = Math.max(0, options.step ?? 2);
    const scale = Math.max(0, options.density ?? 1);
    const densest = cover.swards.reduce((most, sward) => Math.max(most, sward.density), 0) * scale;
    this.spacing = densest > 0 ? 1 / Math.sqrt(densest) : Number.POSITIVE_INFINITY;
    this.keep = cover.swards.map((sward) => (densest > 0 ? (sward.density * scale) / densest : 0));
    this.band = cover.swards.map((sward) =>
      Math.min(1, Math.max(LEAST_BAND, sward.height / FULL_BAND_HEIGHT)),
    );
    this.anchorX = source.anchor?.[0] ?? 0;
    this.anchorZ = source.anchor?.[1] ?? 0;
    const width = cover.columns * cover.cell,
      depth = cover.rows * cover.cell;
    this.centerX = cover.originX + width / 2;
    this.centerZ = cover.originZ + depth / 2;
    this.chunkColumns = Math.max(1, Math.ceil(width / CHUNK));
    this.chunkRows = Math.max(1, Math.ceil(depth / CHUNK));
    const middle = source.middle ?? source.near;
    this.slots = [
      this.createSlot(source.near, `${name}:near`),
      this.createSlot(middle, `${name}:middle`),
      this.createSlot(source.far ?? middle, `${name}:far`),
    ];
  }

  private createSlot(model: PreparedModel, name: string): Slot {
    const geometry = model.geometry;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    const slot: Slot = {
      geometry,
      material: levelMaterial(model.material, geometry),
      extent:
        (geometry.boundingSphere?.radius ?? 1) + (geometry.boundingSphere?.center.length() ?? 0),
      batch: undefined as unknown as InstanceBatch,
      room: MIN_ROOM,
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
    batch.setColorAt(0, white);
    batch.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    batch.count = 0;
    batch.visible = false;
    batch.name = name;
    // Grass is too low to cast a shadow worth a second draw of every tuft.
    batch.castShadow = false;
    batch.receiveShadow = from?.receiveShadow ?? true;
    batch.userData.shadowCaster = false;
    batch.userData.walkIgnore = true;
    batch.position.set(this.centerX, 0, this.centerZ);
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
    slot.room = Math.max(needed, slot.room * 2);
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

  /** Choose and write the tufts within reach of `camera` (this object's frame). */
  choose(camera: THREE.Vector3): void {
    for (const slot of this.slots) {
      slot.fill = 0;
      slot.reach = 0;
      slot.min.set(Infinity, Infinity, Infinity);
      slot.max.set(-Infinity, -Infinity, -Infinity);
    }
    const { cover, radius, chunks } = this;
    const minX = cover.originX,
      minZ = cover.originZ,
      maxX = minX + cover.columns * cover.cell,
      maxZ = minZ + cover.rows * cover.cell;
    const beside = Math.hypot(
      Math.max(minX - camera.x, 0, camera.x - maxX),
      Math.max(minZ - camera.z, 0, camera.z - maxZ),
    );
    let drawn = 0;
    // Out of reach of the whole cover, or high above its ground: nothing is worked out. From
    // above, the squares worth working out are those within what is left of the reach across
    // the ground, so a camera coming down meets the grass a ring at a time, not all at once.
    const top = this.source.top?.();
    const above = top !== undefined ? Math.max(0, camera.y - top) : 0;
    const across = above < radius ? Math.sqrt(radius * radius - above * above) : 0;
    const within =
      Number.isFinite(this.spacing) &&
      beside < across &&
      (top !== undefined ||
        camera.y -
          this.source.ground(
            Math.min(maxX, Math.max(minX, camera.x)),
            Math.min(maxZ, Math.max(minZ, camera.z)),
          ) <
          radius + RELIEF);
    if (within) {
      const column0 = Math.max(0, Math.floor((camera.x - across - minX) / CHUNK));
      const column1 = Math.min(
        this.chunkColumns - 1,
        Math.floor((camera.x + across - minX) / CHUNK),
      );
      const row0 = Math.max(0, Math.floor((camera.z - across - minZ) / CHUNK));
      const row1 = Math.min(this.chunkRows - 1, Math.floor((camera.z + across - minZ) / CHUNK));
      const across2 = across * across;
      const span = this.radius - this.full;
      for (let row = row0; row <= row1; row++) {
        const z0 = minZ + row * CHUNK;
        const dz =
          camera.z < z0 ? z0 - camera.z : camera.z > z0 + CHUNK ? camera.z - z0 - CHUNK : 0;
        for (let column = column0; column <= column1; column++) {
          const x0 = minX + column * CHUNK;
          const dx =
            camera.x < x0 ? x0 - camera.x : camera.x > x0 + CHUNK ? camera.x - x0 - CHUNK : 0;
          if (dx * dx + dz * dz >= across2) continue;
          const key = row * this.chunkColumns + column;
          let tufts = chunks.get(key);
          if (tufts === undefined) {
            tufts = this.build(column, row);
            chunks.set(key, tufts);
          }
          if (tufts === null) continue;
          for (let at = 0; at < tufts.length; at += STRIDE) {
            const x = tufts[at] as number,
              y = tufts[at + 1] as number,
              z = tufts[at + 2] as number;
            const ox = x - camera.x,
              oy = y - camera.y,
              oz = z - camera.z;
            const distance2 = ox * ox + oy * oy + oz * oz;
            const reach = this.full + (tufts[at + 10] as number) * span;
            if (distance2 >= reach * reach) continue;
            const distance = Math.sqrt(distance2);
            const slot = this.slots[distance < this.detail ? 0 : distance < this.plain ? 1 : 2];
            if (slot.fill >= slot.room) this.grow(slot, slot.fill + 1);
            this.write(slot, tufts, at, Math.min(1, (reach - distance) / this.shrink));
            drawn++;
          }
        }
      }
      // Squares the camera has left behind are forgotten, a little past the reach they were
      // worked out for so a camera turning back does not work them out again at once.
      if (chunks.size > 0) {
        const keep = radius + 3 * CHUNK;
        for (const key of chunks.keys()) {
          const column = key % this.chunkColumns,
            row = (key - column) / this.chunkColumns;
          const x0 = minX + column * CHUNK,
            z0 = minZ + row * CHUNK;
          const dx = Math.max(x0 - camera.x, 0, camera.x - x0 - CHUNK),
            dz = Math.max(z0 - camera.z, 0, camera.z - z0 - CHUNK);
          if (dx * dx + dz * dz > keep * keep) chunks.delete(key);
        }
      }
    } else if (chunks.size > 0) chunks.clear();
    for (const slot of this.slots) this.publish(slot);
    this.drawn = drawn;
  }

  /** The tufts of one square, or null when no grass grows in it. */
  private build(column: number, row: number): Float32Array | null {
    const { cover, spacing, source } = this;
    const coverMaxX = cover.originX + cover.columns * cover.cell,
      coverMaxZ = cover.originZ + cover.rows * cover.cell;
    const x0 = cover.originX + column * CHUNK,
      z0 = cover.originZ + row * CHUNK,
      x1 = Math.min(coverMaxX, x0 + CHUNK),
      z1 = Math.min(coverMaxZ, z0 + CHUNK);
    // The cover's cells under the square, read once.
    const cell0 = Math.floor((x0 - cover.originX) / cover.cell),
      cell1 = Math.min(cover.columns, Math.ceil((x1 - cover.originX) / cover.cell)),
      line0 = Math.floor((z0 - cover.originZ) / cover.cell),
      line1 = Math.min(cover.rows, Math.ceil((z1 - cover.originZ) / cover.cell));
    const across = cell1 - cell0,
      down = line1 - line0;
    if (across <= 0 || down <= 0) return null;
    if (this.mask.length < across * down) this.mask = new Uint8Array(across * down);
    const mask = this.mask;
    let any = false;
    for (let line = 0; line < down; line++) {
      const cells = mask.subarray(line * across, (line + 1) * across);
      readTurfRow(cover, line0 + line, cell0, cell1, cells);
      if (!any) for (let i = 0; i < across; i++) if (cells[i] !== 0) any = true;
    }
    if (!any) return null;
    const out: number[] = [];
    // A tuft may stand most of a lattice cell off its point: the cells one out all round count.
    const i0 = Math.floor((x0 + this.anchorX) / spacing) - 1,
      i1 = Math.floor((x1 + this.anchorX) / spacing) + 1,
      j0 = Math.floor((z0 + this.anchorZ) / spacing) - 1,
      j1 = Math.floor((z1 + this.anchorZ) / spacing) + 1;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5 + (unit(i, j, 0) - 0.5) * JITTER) * spacing - this.anchorX;
        const z = (j + 0.5 + (unit(i, j, 1) - 0.5) * JITTER) * spacing - this.anchorZ;
        // Each tuft belongs to the one square its root stands in.
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        const cellX = Math.floor((x - cover.originX) / cover.cell) - cell0,
          cellZ = Math.floor((z - cover.originZ) / cover.cell) - line0;
        if (cellX < 0 || cellX >= across || cellZ < 0 || cellZ >= down) continue;
        const kind = (mask[cellZ * across + cellX] as number) - 1;
        const sward = cover.swards[kind];
        if (sward === undefined || unit(i, j, 2) >= (this.keep[kind] as number)) continue;
        const far = unit(i, j, 8);
        const grown = 1 + FAR_GROWTH * far;
        const height = sward.height * (0.62 + 0.8 * unit(i, j, 3)) * Math.sqrt(grown);
        const spread = SPREAD * Math.sqrt(height) * (0.8 + 0.45 * unit(i, j, 4)) * Math.sqrt(grown);
        const turn = unit(i, j, 5) * Math.PI * 2;
        const ground =
          source.color?.(sward.label, x, z, scratchColor) ?? scratchColor.copy(DEFAULT_GROUND);
        // Each tuft a little lighter or darker than its ground, and warmer or cooler.
        const light = 0.84 + 0.32 * unit(i, j, 6);
        const warmth = (unit(i, j, 7) - 0.5) * 0.14;
        out.push(
          x,
          source.ground(x, z) - SINK,
          z,
          Math.cos(turn),
          Math.sin(turn),
          spread,
          height,
          ground.r * light * (1 + warmth),
          ground.g * light,
          ground.b * light * (1 - warmth),
          far * (this.band[kind] as number),
        );
      }
    return out.length > 0 ? Float32Array.from(out) : null;
  }

  private write(slot: Slot, tufts: Float32Array, at: number, size: number): void {
    const x = (tufts[at] as number) - this.centerX,
      y = tufts[at + 1] as number,
      z = (tufts[at + 2] as number) - this.centerZ;
    const cos = tufts[at + 3] as number,
      sin = tufts[at + 4] as number;
    const wide = (tufts[at + 5] as number) * size,
      tall = (tufts[at + 6] as number) * size;
    // Matrix4.compose(position, a turn about +Y, scale), written out.
    const matrices = slot.batch.instanceMatrix.array as Float32Array;
    const m = slot.fill * 16;
    matrices[m] = cos * wide;
    matrices[m + 1] = 0;
    matrices[m + 2] = -sin * wide;
    matrices[m + 3] = 0;
    matrices[m + 4] = 0;
    matrices[m + 5] = tall;
    matrices[m + 6] = 0;
    matrices[m + 7] = 0;
    matrices[m + 8] = sin * wide;
    matrices[m + 9] = 0;
    matrices[m + 10] = cos * wide;
    matrices[m + 11] = 0;
    matrices[m + 12] = x;
    matrices[m + 13] = y;
    matrices[m + 14] = z;
    matrices[m + 15] = 1;
    const colors = slot.batch.instanceColor?.array as Float32Array | undefined;
    if (colors !== undefined) {
      const c = slot.fill * 3;
      colors[c] = tufts[at + 7] as number;
      colors[c + 1] = tufts[at + 8] as number;
      colors[c + 2] = tufts[at + 9] as number;
    }
    slot.min.min(instancePosition.set(x, y, z));
    slot.max.max(instancePosition);
    slot.reach = Math.max(slot.reach, Math.max(wide, tall) * slot.extent);
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
    for (const slot of this.slots) slot.batch.dispose();
    this.chunks.clear();
  }
}

/**
 * Stand a batch's turf round the view camera (see `TurfObject`). Add the object where the
 * batch's placements go (its frame is theirs).
 */
export function createTurf(
  cover: TurfCover,
  source: TurfSource,
  options: TurfOptions = {},
  name?: string,
): TurfObject {
  return new TurfObject(cover, source, options, name);
}

/** Whether `object` draws turf. */
export function isTurfObject(object: THREE.Object3D): object is TurfObject {
  return object instanceof TurfObject;
}
