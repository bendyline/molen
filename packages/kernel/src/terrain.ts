import type { Vec3 } from '@bendyline/molen-schema';
import { dmath } from './dmath';
import type { World } from './world';

// Terrain as a kernel service (docs/10 M-kernel). The terrain package owns heightfields; the
// kernel owns the contract a ground field must satisfy and the systems that consume it
// (character controller, kinematics ground, scripts). Structural typing keeps the kernel free
// of a terrain dependency: `Heightfield` from @bendyline/molen-terrain/kernel satisfies
// GroundField as-is. Only `+ - * /`, `dmath.floor/sqrt` — no transcendental Math (check-dmath).

/** The minimum a terrain source must provide to act as the world's ground. */
export interface GroundField {
  /** Surface height at a world XZ (meters). */
  sampleHeight(x: number, z: number): number;
  /** Unit surface normal at a world XZ. */
  normalAt(x: number, z: number): Vec3;
  /** Grid cell size (x, z) when the field is sampled; drives the default ray-march step. */
  readonly cellSize?: [number, number];
}

export interface TerrainRayHit {
  point: Vec3;
  normal: Vec3;
  distance: number;
}

export interface TerrainOptions {
  /** Ray-march step in world units (default: half the field's cell size, else 1). */
  rayStep?: number;
  /** Cap on march steps per ray (default 4096). */
  maxRaySteps?: number;
}

/** The kernel-side terrain service: height/normal/slope queries and a heightfield ray cast. */
export interface TerrainHandle {
  readonly field: GroundField;
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number): Vec3;
  /** 1 - normal.y: 0 on flat ground, approaching 1 on cliffs. */
  slopeAt(x: number, z: number): number;
  /**
   * Cast a ray against the surface: march along `dir` in fixed steps, then bisect the first
   * above→below crossing. An origin already below the surface hits at distance 0. Returns null
   * when the ray stays above the surface for `maxDist`.
   */
  raycast(origin: Vec3, dir: Vec3, maxDist: number): TerrainRayHit | null;
}

const fields = new WeakMap<World, GroundField>();

/** The ground field registered on a world (by installTerrain), if any. */
export function groundFieldOf(world: World): GroundField | undefined {
  return fields.get(world);
}

const BISECT_STEPS = 24;

/**
 * Register a ground field on a world and get the query handle. Systems installed BEFORE this
 * call (character controller, kinematics with `ground: 'terrain'`) resolve the field lazily at
 * tick time, so install order does not matter.
 */
export function installTerrain(
  world: World,
  field: GroundField,
  opts: TerrainOptions = {},
): TerrainHandle {
  const cell = field.cellSize;
  const defaultStep = cell !== undefined ? dmath.min(cell[0], cell[1]) / 2 : 1;
  const step = opts.rayStep ?? defaultStep;
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError('terrain rayStep must be finite and greater than 0');
  }
  const maxSteps = opts.maxRaySteps ?? 4096;
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new RangeError('terrain maxRaySteps must be a positive safe integer');
  }

  fields.set(world, field);
  const above = (x: number, y: number, z: number): boolean => y > field.sampleHeight(x, z);

  function raycast(origin: Vec3, dir: Vec3, maxDist: number): TerrainRayHit | null {
    if (!Number.isFinite(maxDist) || maxDist < 0) {
      throw new RangeError('terrain raycast maxDist must be finite and nonnegative');
    }
    if (![...origin, ...dir].every(Number.isFinite)) {
      throw new RangeError('terrain raycast origin and dir must be finite');
    }
    const len = dmath.hypot(dir[0], dir[1], dir[2]);
    if (len === 0) throw new RangeError('terrain raycast dir must be non-zero');
    const dx = dir[0] / len;
    const dy = dir[1] / len;
    const dz = dir[2] / len;
    const at = (t: number): Vec3 => [origin[0] + dx * t, origin[1] + dy * t, origin[2] + dz * t];
    const hit = (t: number): TerrainRayHit => {
      const p = at(t);
      return {
        point: p,
        normal: field.normalAt(p[0], p[2]),
        distance: t,
      };
    };
    if (!above(origin[0], origin[1], origin[2])) return hit(0);
    let prev = 0;
    for (let i = 0; i < maxSteps && prev < maxDist; i++) {
      const t = dmath.min(prev + step, maxDist);
      const p = at(t);
      if (!above(p[0], p[1], p[2])) {
        // Bisect between the last above point and the first below point.
        let lo = prev;
        let hi = t;
        for (let b = 0; b < BISECT_STEPS; b++) {
          const mid = (lo + hi) / 2;
          const m = at(mid);
          if (above(m[0], m[1], m[2])) lo = mid;
          else hi = mid;
        }
        return hit(hi);
      }
      prev = t;
    }
    if (prev < maxDist)
      throw new RangeError(
        'terrain raycast exceeded maxRaySteps; increase the budget or shorten maxDist',
      );
    return null;
  }

  return {
    field,
    heightAt: (x, z) => field.sampleHeight(x, z),
    normalAt: (x, z) => field.normalAt(x, z),
    slopeAt: (x, z) => 1 - field.normalAt(x, z)[1],
    raycast,
  };
}

/** The script-api namespace for terrain (`molen.terrain.*`); pass via scripting `extensions`. */
export function terrainScriptApi(handle: TerrainHandle): object {
  return {
    heightAt: (x: number, z: number): number => handle.heightAt(x, z),
    normalAt: (x: number, z: number): Vec3 => handle.normalAt(x, z),
    slopeAt: (x: number, z: number): number => handle.slopeAt(x, z),
    raycast: (origin: Vec3, dir: Vec3, maxDist: number): TerrainRayHit | null =>
      handle.raycast(origin, dir, maxDist),
  };
}
