import { dmath } from '@bendyline/molen-kernel/determinism';
import type { Bounds2 } from './geometry2d';
import { interiorRectFits } from './interior-plan';
import { interiorToWorld } from './interior-site';
import type {
  InteriorPlan,
  InteriorProfile,
  InteriorStorey,
  ParkedCarSlot,
  ParkingLayout,
  ParkingStall,
} from './interior-types';
import { hashCoord, hashString, unit01 } from './seed';
import type { Vec2 } from './types';

/** Columns stand between rows, one every three stalls, which is how long-span decks are framed. */
const STALLS_PER_BAY = 3;
const COLUMN = 0.55;
/** Stalls a plate can hold; a footprint beyond this keeps the first rows and stays drivable. */
const MAX_STALLS = 6000;
const DEFAULT_CARS = 1500;
const MAX_CARS = 3000;
/** Fewer cars the farther a driver has to climb; the open roof fills last. */
const LEVEL_FALLOFF = 0.1;
const ROOF_SHARE = 0.4;

function overlaps(a: Bounds2, b: Bounds2): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** The plate of stalls and columns every storey shares, in the interior frame. */
function* buildPlate(
  plan: InteriorPlan,
  layout: ParkingLayout,
): Generator<void, { stalls: ParkingStall[]; columns: Vec2[] }, void> {
  const site = plan.site;
  const { stallWidth, stallDepth, axis } = layout;
  const stalls: ParkingStall[] = [];
  const columns = new Map<string, Vec2>();
  const reserved = [...layout.aisles, ...layout.crossAisles, ...layout.clear];
  const rect = (u0: number, v0: number, u1: number, v1: number): Bounds2 =>
    axis === 'x' ? [u0, v0, u1, v1] : [v0, u0, v1, u1];
  const point = (u: number, v: number): Vec2 => (axis === 'x' ? [u, v] : [v, u]);
  // A shared grid lines back-to-back rows up, and their stall lines and columns with them.
  let tested = 0;
  for (const aisle of layout.aisles) {
    const [u0, v0, u1, v1] =
      axis === 'x' ? aisle : ([aisle[1], aisle[0], aisle[3], aisle[2]] as Bounds2);
    const first = Math.floor(u0 / stallWidth);
    const last = Math.ceil(u1 / stallWidth);
    for (const side of [-1, 1] as const) {
      const near = side === 1 ? v1 : v0;
      const far = near + side * stallDepth;
      for (let i = first; i < last; i++) {
        if (stalls.length >= MAX_STALLS) plan.stats.truncated = true;
        else {
          plan.stats.candidates++;
          if (++tested % 8 === 0) yield;
          const a = i * stallWidth;
          const bounds = rect(a, Math.min(near, far), a + stallWidth, Math.max(near, far));
          if (reserved.some((r) => overlaps(r, bounds)) || !interiorRectFits(site, bounds, 0.2)) {
            plan.stats.rejected++;
          } else {
            stalls.push({
              center: point(a + stallWidth / 2, (near + far) / 2),
              nose: point(0, side),
            });
            if (i % STALLS_PER_BAY === 0) {
              const at = point(a, far);
              const clear: Bounds2 = [
                at[0] - COLUMN,
                at[1] - COLUMN,
                at[0] + COLUMN,
                at[1] + COLUMN,
              ];
              if (!reserved.some((r) => overlaps(r, clear)))
                columns.set(`${at[0].toFixed(2)}:${at[1].toFixed(2)}`, at);
            }
          }
        }
      }
    }
  }
  return { stalls, columns: [...columns.values()] };
}

/** One storey's share of its stalls that hold a car, before the cap thins them evenly. */
function occupancy(profile: InteriorProfile, level: number, storey: InteriorStorey): number {
  const share = profile.density * Math.max(0.3, 1 - LEVEL_FALLOFF * level);
  return storey.open ? share * ROOF_SHARE : share;
}

/** Stalls, columns and seeded parked cars. Layout was fixed with the exterior; see the site. */
export function* generateParkingPlanSteps(
  plan: InteriorPlan,
  profile: InteriorProfile,
  maxParkedCars: number = DEFAULT_CARS,
): Generator<void, InteriorPlan, void> {
  const site = plan.site;
  const layout = site.parking as ParkingLayout;
  const limit = Math.max(0, Math.min(MAX_CARS, Math.floor(maxParkedCars)));
  if (!Number.isFinite(limit)) throw new RangeError('Interior limits must be finite');
  const storeys = site.storeys ?? plan.storeys;
  plan.storeys = storeys;
  const { stalls, columns } = yield* buildPlate(plan, layout);
  plan.circulation.push(...layout.aisles, ...layout.crossAisles, ...layout.clear);
  // Named draws: a stall keeps its car however many others the cap removes.
  const salt = hashString(plan.seed);
  const expected = storeys.reduce(
    (sum, storey, level) => sum + stalls.length * occupancy(profile, level, storey),
    0,
  );
  const thin = expected > limit ? limit / expected : 1;
  const cars: ParkedCarSlot[] = [];
  for (const [level, storey] of storeys.entries()) {
    const share = occupancy(profile, level, storey) * thin;
    for (const [index, stall] of stalls.entries()) {
      const hash = hashCoord(index, level, salt);
      if (unit01(hash, 0) >= share || cars.length >= limit) continue;
      // Most drivers nose in; a few reverse.
      const reverse = unit01(hash, 1) < 0.1 ? -1 : 1;
      const nose: Vec2 = [stall.nose[0] * reverse, stall.nose[1] * reverse];
      // Toward the aisle: columns stand at the stall's far end.
      const at: Vec2 = [
        stall.center[0] - stall.nose[0] * 0.15,
        stall.center[1] - stall.nose[1] * 0.15,
      ];
      const world = interiorToWorld(site, at);
      const origin = interiorToWorld(site, [0, 0]);
      const tip = interiorToWorld(site, nose);
      cars.push({
        id: `${level}:${index}`,
        level,
        position: [world[0], storey.floor, world[1]],
        yaw: dmath.atan2(tip[0] - origin[0], tip[1] - origin[1]),
        seed: unit01(hash, 2),
      });
    }
    yield;
  }
  plan.parking = { stalls, columns, cars };
  return plan;
}
