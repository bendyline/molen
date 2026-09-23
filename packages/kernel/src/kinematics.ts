import type { EntityId, JsonObject, Vec3 } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform } from './component';
import { dmath } from './dmath';
import { groundFieldOf } from './terrain';
import { Mounted } from './vehicles';
import type { World } from './world';

// Opt-in 2.5D kinematic collision layer (docs/04-kernel-design.md §6). Circles/AABBs in the XZ
// plane; movement is integrate-and-sweep with slide response. Deterministic: bodies resolve in
// creation order, no persistent broad-phase state to snapshot. Install with installKinematics.
//
// Broad phase: a uniform grid rebuilt every tick (no state to snapshot). Candidates for a
// circle are a conservative SUPERSET of the colliders that can touch it, iterated in creation
// (index) order, and re-queried after every push-out. That is exactly the sequence brute force
// produces — colliders brute force would test and reject are the ones the grid never yields —
// so every floating-point operation happens in the same order and hashes are identical.

export interface ColliderData extends JsonObject {
  shape: 'circle' | 'aabb';
  radius?: number;
  halfExtents?: [number, number]; // XZ
  layer: number; // bitmask of layers this collider belongs to
  mask: number; // bitmask of layers this collider collides with
  isStatic?: boolean;
}

export interface KinematicBodyData extends JsonObject {
  vel: Vec3;
  slide: boolean;
}

export const Collider: ComponentType<ColliderData> = defineComponent<ColliderData>('collider');
export const KinematicBody: ComponentType<KinematicBodyData> =
  defineComponent<KinematicBodyData>('kinematicBody');

interface ColliderRecord {
  index: number;
  id: EntityId;
  x: number;
  z: number;
  c: ColliderData;
  /** Radius or the larger half-extent: the collider's reach on either axis. */
  extent: number;
  isStatic: boolean;
}

interface ColliderSet {
  records: ColliderRecord[];
  byId: Map<EntityId, ColliderRecord>;
  maxExtent: number;
}

const MAX_KINEMATIC_SUBSTEPS = 256;

function positiveDimension(value: number | undefined, fallback: number, label: string): number {
  const dimension = value ?? fallback;
  if (!Number.isFinite(dimension) || dimension <= 0) {
    throw new RangeError(`${label} must be finite and greater than 0`);
  }
  return dimension;
}

function colliderExtent(id: EntityId, c: ColliderData): number {
  if (c.shape === 'circle') return positiveDimension(c.radius, 0.5, `collider "${id}" radius`);
  const hx = positiveDimension(c.halfExtents?.[0], 0.5, `collider "${id}" halfExtent.x`);
  const hz = positiveDimension(c.halfExtents?.[1], 0.5, `collider "${id}" halfExtent.z`);
  return dmath.max(hx, hz);
}

function collectColliders(world: World): ColliderSet {
  const records: ColliderRecord[] = [];
  const byId = new Map<EntityId, ColliderRecord>();
  let maxExtent = 0;
  for (const [id, t, c] of world.query(Transform, Collider).without(Mounted)) {
    const extent = colliderExtent(id, c);
    const rec: ColliderRecord = {
      index: records.length,
      id,
      x: t.pos[0],
      z: t.pos[2],
      c,
      extent,
      isStatic: c.isStatic === true,
    };
    records.push(rec);
    byId.set(id, rec);
    if (extent > maxExtent) maxExtent = extent;
  }
  return { records, byId, maxExtent };
}

/** Per-tick uniform grid over collider AABBs. Rebuilt every tick; never snapshotted. */
class UniformGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly stamp: Uint32Array;
  private stampGen = 1;
  readonly cellSize: number;

  constructor(
    private readonly records: ColliderRecord[],
    maxExtent: number,
  ) {
    // Every collider spans at most 2x2 cells when cells are at least as wide as its AABB.
    this.cellSize = dmath.max(2 * maxExtent, 1e-3);
    this.stamp = new Uint32Array(records.length);
    for (const rec of records) {
      this.forCells(
        rec.x - rec.extent,
        rec.z - rec.extent,
        rec.x + rec.extent,
        rec.z + rec.extent,
        (key) => {
          const bucket = this.cells.get(key);
          if (bucket === undefined) this.cells.set(key, [rec.index]);
          else bucket.push(rec.index);
        },
      );
    }
  }

  private forCells(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    fn: (key: number) => void,
  ): void {
    const x0 = dmath.floor(minX / this.cellSize);
    const x1 = dmath.floor(maxX / this.cellSize);
    const z0 = dmath.floor(minZ / this.cellSize);
    const z1 = dmath.floor(maxZ / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        // Hash collisions only ADD candidates (still conservative). |0 keeps it an int32 key.
        fn(((cx * 73856093) ^ (cz * 19349663)) | 0);
      }
    }
  }

  /** Record indices whose AABB may overlap the circle (px, pz, r), ascending. */
  candidates(px: number, pz: number, r: number, out: number[]): number[] {
    out.length = 0;
    const gen = this.stampGen++;
    this.forCells(px - r, pz - r, px + r, pz + r, (key) => {
      const bucket = this.cells.get(key);
      if (bucket === undefined) return;
      for (const idx of bucket) {
        if (this.stamp[idx] === gen) continue;
        this.stamp[idx] = gen;
        const rec = this.records[idx] as ColliderRecord;
        // AABB reject (also what makes the superset tight).
        if (
          rec.x + rec.extent < px - r ||
          rec.x - rec.extent > px + r ||
          rec.z + rec.extent < pz - r ||
          rec.z - rec.extent > pz + r
        ) {
          continue;
        }
        out.push(idx);
      }
    });
    out.sort((a, b) => a - b);
    return out;
  }
}

function layersInteract(a: ColliderData, b: ColliderData): boolean {
  return (a.mask & b.layer) !== 0 || (b.mask & a.layer) !== 0;
}

/** Penetration of a circle at (px,pz,r) against a static collider; returns push-out vector or null. */
function resolveCircle(
  px: number,
  pz: number,
  r: number,
  other: ColliderRecord,
): { nx: number; nz: number; depth: number } | null {
  if (other.c.shape === 'circle') {
    const or = positiveDimension(other.c.radius, 0.5, `collider "${other.id}" radius`);
    const dx = px - other.x;
    const dz = pz - other.z;
    const distSq = dx * dx + dz * dz;
    const minDist = r + or;
    if (distSq >= minDist * minDist) return null;
    const dist = dmath.sqrt(distSq);
    if (dist < 1e-6) return { nx: 1, nz: 0, depth: minDist };
    return { nx: dx / dist, nz: dz / dist, depth: minDist - dist };
  }
  // AABB (XZ): closest point on the box to the circle center.
  const hx = positiveDimension(
    other.c.halfExtents?.[0],
    0.5,
    `collider "${other.id}" halfExtent.x`,
  );
  const hz = positiveDimension(
    other.c.halfExtents?.[1],
    0.5,
    `collider "${other.id}" halfExtent.z`,
  );
  const cx = dmath.clamp(px, other.x - hx, other.x + hx);
  const cz = dmath.clamp(pz, other.z - hz, other.z + hz);
  const dx = px - cx;
  const dz = pz - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq >= r * r) return null;
  const dist = dmath.sqrt(distSq);
  if (dist < 1e-6) {
    // Center inside the box: push along the least-penetration axis.
    const overlapX = hx + r - dmath.abs(px - other.x);
    const overlapZ = hz + r - dmath.abs(pz - other.z);
    if (overlapX < overlapZ) return { nx: px < other.x ? -1 : 1, nz: 0, depth: overlapX };
    return { nx: 0, nz: pz < other.z ? -1 : 1, depth: overlapZ };
  }
  return { nx: dx / dist, nz: dz / dist, depth: r - dist };
}

export interface KinematicsOptions {
  /**
   * Vertical constraint for kinematic bodies: none (default; `vel[1]` integrates freely),
   * `flat` (clamped to y = 0), or `terrain` (clamped to the world's ground field — see
   * `installTerrain` on the `/terrain` subpath).
   */
  ground?: 'flat' | 'terrain';
  /** `grid` (default) or `brute` (the O(n²) reference, kept as the test oracle). */
  broadphase?: 'grid' | 'brute';
}

/** Install the kinematic collision system (physics phase). */
export function installKinematics(world: World, opts: KinematicsOptions = {}): void {
  const useGrid = opts.broadphase !== 'brute';
  // Diagnostics for silent no-ops, emitted once per entity (deterministic: events, not console).
  const warned = new Set<EntityId>();
  const warnOnce = (w: World, id: EntityId, code: string): void => {
    if (warned.has(id)) return;
    warned.add(id);
    w.emit('kinematics-error', { entity: id, code });
  };
  const groundAt = (w: World, x: number, z: number): number | undefined => {
    if (opts.ground === 'flat') return 0;
    if (opts.ground === 'terrain') return groundFieldOf(w)?.sampleHeight(x, z) ?? 0;
    return undefined;
  };

  world.addSystem(
    (w, ctx) => {
      const { records, byId, maxExtent } = collectColliders(w);
      const grid = useGrid ? new UniformGrid(records, maxExtent) : undefined;
      const scratch: number[] = [];

      for (const [id, t, body] of w.query(Transform, KinematicBody).without(Mounted)) {
        const self = byId.get(id);
        if (self === undefined || self.c.shape !== 'circle') {
          warnOnce(w, id, 'no-circle-collider');
          continue;
        }
        if (self.isStatic) {
          warnOnce(w, id, 'static-body');
          continue;
        }
        const r = self.extent;

        // Substep so fast bodies can't tunnel through thin colliders: each substep advances
        // at most ~half the collider radius.
        const speed = dmath.hypot(body.vel[0], 0, body.vel[2]);
        if (!Number.isFinite(speed) || !Number.isFinite(body.vel[1])) {
          throw new RangeError(`kinematicBody "${id}" velocity must be finite`);
        }
        const substeps = dmath.min(
          MAX_KINEMATIC_SUBSTEPS,
          dmath.max(1, dmath.ceil((speed * ctx.dt) / (r * 0.5))),
        );
        const subDt = ctx.dt / substeps;
        let px = t.pos[0];
        let pz = t.pos[2];
        let vx = body.vel[0];
        let vz = body.vel[2];
        const collided = new Set<EntityId>();

        const resolveAgainst = (other: ColliderRecord): boolean => {
          if (other.id === id) return false;
          if (!layersInteract(self.c, other.c)) return false;
          const hit = resolveCircle(px, pz, r, other);
          if (hit === null) return false;
          px += hit.nx * hit.depth;
          pz += hit.nz * hit.depth;
          if (body.slide) {
            // Remove the velocity component into the surface; tangent motion continues.
            const vn = vx * hit.nx + vz * hit.nz;
            if (vn < 0) {
              vx -= vn * hit.nx;
              vz -= vn * hit.nz;
            }
          } else {
            vx = 0;
            vz = 0;
          }
          if (!collided.has(other.id)) {
            collided.add(other.id);
            w.emit('collision', { a: id, b: other.id, normal: [hit.nx, 0, hit.nz] });
          }
          return true;
        };

        for (let s = 0; s < substeps; s++) {
          px += vx * subDt;
          pz += vz * subDt;
          if (grid === undefined) {
            for (const other of records) resolveAgainst(other);
            continue;
          }
          // Index order with a re-query after every push-out: identical to the brute-force
          // sequence (see the header comment).
          let cursor = -1;
          for (;;) {
            const cands = grid.candidates(px, pz, r, scratch);
            let moved = false;
            for (const idx of cands) {
              if (idx <= cursor) continue;
              cursor = idx;
              if (resolveAgainst(records[idx] as ColliderRecord)) {
                moved = true;
                break;
              }
            }
            if (!moved) break;
          }
        }

        // Vertical: integrate vel[1]; optionally clamp to the ground and stop there.
        let vy = body.vel[1];
        let py = t.pos[1] + vy * ctx.dt;
        const gy = groundAt(w, px, pz);
        if (gy !== undefined && py <= gy) {
          py = gy;
          if (vy < 0) vy = 0;
        }

        w.patch(id, Transform, { pos: [px, py, pz] });
        if (vx !== body.vel[0] || vz !== body.vel[2] || vy !== body.vel[1]) {
          w.patch(id, KinematicBody, { vel: [vx, vy, vz] });
        }
      }
    },
    { phase: 'physics', name: 'kinematics' },
  );
}

export interface RayHit {
  id: EntityId;
  distance: number;
  point: Vec3;
}

/** Ray vs XZ box (slab test). Origin inside = miss (consistent with the circle branch). */
function rayBox(
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  rec: ColliderRecord,
  hx: number,
  hz: number,
): number | null {
  let tmin = Number.NEGATIVE_INFINITY;
  let tmax = Number.POSITIVE_INFINITY;
  const axes: [number, number, number, number][] = [
    [ox, dx, rec.x - hx, rec.x + hx],
    [oz, dz, rec.z - hz, rec.z + hz],
  ];
  for (const [o, d, min, max] of axes) {
    if (d === 0) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
  }
  if (tmax < 0 || tmin > tmax || tmin < 0) return null;
  return tmin;
}

/** Raycast in the XZ plane against colliders; returns the nearest hit. O(n). */
export function raycast(
  world: World,
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  mask = 0xffffffff,
): RayHit | null {
  if (!Number.isFinite(maxDist) || maxDist < 0) {
    throw new RangeError('raycast maxDist must be finite and nonnegative');
  }
  const ox = origin[0];
  const oz = origin[2];
  const len = dmath.hypot(dir[0], 0, dir[2]) || 1;
  const dx = dir[0] / len;
  const dz = dir[2] / len;
  let best: RayHit | null = null;
  for (const rec of collectColliders(world).records) {
    if ((rec.c.layer & mask) === 0) continue;
    let t: number | null;
    if (rec.c.shape === 'circle') {
      const r = rec.extent;
      // Ray-circle intersection.
      const fx = ox - rec.x;
      const fz = oz - rec.z;
      const b = fx * dx + fz * dz;
      const c = fx * fx + fz * fz - r * r;
      if (c > 0 && b > 0) continue;
      const disc = b * b - c;
      if (disc < 0) continue;
      t = -b - dmath.sqrt(disc);
      if (t < 0) continue;
    } else {
      const hx = positiveDimension(
        rec.c.halfExtents?.[0],
        0.5,
        `collider "${rec.id}" halfExtent.x`,
      );
      const hz = positiveDimension(
        rec.c.halfExtents?.[1],
        0.5,
        `collider "${rec.id}" halfExtent.z`,
      );
      t = rayBox(ox, oz, dx, dz, rec, hx, hz);
      if (t === null) continue;
    }
    if (t > maxDist) continue;
    if (best === null || t < best.distance) {
      best = { id: rec.id, distance: t, point: [ox + dx * t, origin[1], oz + dz * t] };
    }
  }
  return best;
}

/** Return entity ids whose collider overlaps a circle at (center, radius). */
export function overlapCircle(
  world: World,
  center: Vec3,
  radius: number,
  mask = 0xffffffff,
): EntityId[] {
  const r = positiveDimension(radius, 0.5, 'overlap radius');
  const { records, maxExtent } = collectColliders(world);
  const grid = new UniformGrid(records, maxExtent);
  const out: EntityId[] = [];
  for (const idx of grid.candidates(center[0], center[2], r, [])) {
    const rec = records[idx] as ColliderRecord;
    if ((rec.c.layer & mask) === 0) continue;
    if (resolveCircle(center[0], center[2], r, rec) !== null) out.push(rec.id);
  }
  return out;
}
