import {
  type Bounds2,
  distancePointToRing,
  pointInPolygon,
  ringBounds,
  segmentsIntersect,
} from './geometry2d';
import { resolveInteriorProfile } from './interior-catalog';
import { generateResidentialPlanSteps } from './interior-residential';
import { interiorToLocal, interiorToWorld } from './interior-site';
import type {
  InteriorFixture,
  InteriorGenerateOptions,
  InteriorPlan,
  InteriorSite,
} from './interior-types';
import { hashCoord, hashString, unit01 } from './seed';
import type { Vec2 } from './types';

/** Whole-rectangle containment including concavities and courtyards; corners alone are unsafe. */
export function interiorRectFits(site: InteriorSite, bounds: Bounds2, clearance = 0.35): boolean {
  const [x0, z0, x1, z1] = bounds;
  const corners = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map((p) => interiorToWorld(site, p as Vec2));
  const rings = [site.outline, ...site.holes];
  for (const p of corners) {
    if (!pointInPolygon(p, site.outline, site.holes)) return false;
    if (rings.some((ring) => distancePointToRing(p, ring) < clearance)) return false;
  }
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i] as Vec2,
        b = ring[(i + 1) % ring.length] as Vec2;
      const local = interiorToLocal(site, a);
      // Also rejects a complete courtyard enclosed by a candidate rectangle.
      if (
        local[0] >= x0 - clearance &&
        local[0] <= x1 + clearance &&
        local[1] >= z0 - clearance &&
        local[1] <= z1 + clearance
      )
        return false;
      for (let j = 0; j < 4; j++) {
        if (segmentsIntersect(a, b, corners[j] as Vec2, corners[(j + 1) % 4] as Vec2)) return false;
      }
    }
  }
  return true;
}

/** Cooperative pure layout pass. Named coordinate draws keep retained modules stable under caps. */
export function* generateInteriorPlanSteps(
  site: InteriorSite,
  options: InteriorGenerateOptions,
): Generator<void, InteriorPlan, void> {
  const profile = resolveInteriorProfile(site.labels, options.catalog);
  const maxFixtures = Math.max(0, Math.min(512, Math.floor(options.maxFixtures ?? 160)));
  const maxCandidates = Math.max(0, Math.min(4096, Math.floor(options.maxCandidates ?? 1024)));
  if (!Number.isFinite(maxFixtures) || !Number.isFinite(maxCandidates))
    throw new RangeError('Interior limits must be finite');
  const seed = `interior1|${site.identity}|${profile.id}@${profile.version}`;
  const salt = hashString(seed);
  const plan: InteriorPlan = {
    identity: site.identity,
    profile: profile.id,
    seed,
    site,
    storeys: [{ floor: site.floor, ceiling: site.ceiling }],
    stairs: [],
    rooms: [],
    fixtures: [],
    circulation: [],
    stats: { candidates: 0, rejected: 0, truncated: false },
  };
  if (profile.algorithm === 'residential')
    return yield* generateResidentialPlanSteps(plan, profile, maxFixtures, maxCandidates);
  const bounds = ringBounds(site.outline.map((p) => interiorToLocal(site, p)));
  const aisle = profile.aisleWidth;
  const width = profile.moduleWidth,
    depth = profile.moduleDepth;
  const front = profile.algorithm === 'aisles' ? 4.8 : profile.algorithm === 'dining' ? 3.6 : 1.8;
  plan.circulation.push([-aisle / 2, Math.min(0, bounds[1]), aisle / 2, bounds[3]]);
  plan.circulation.push([bounds[0], 0, bounds[2], front]);
  // A row/column grid around the entry spine leaves cross aisles and a route around every pod.
  const columns = Math.min(
    128,
    Math.ceil(Math.max(Math.abs(bounds[0]), Math.abs(bounds[2])) / (width + aisle)),
  );
  const rows = Math.min(128, Math.ceil(Math.max(0, bounds[3] - front) / (depth + aisle)));
  const add = (kind: InteriorFixture['kind'], rect: Bounds2, id: string): boolean => {
    if (!interiorRectFits(site, rect)) {
      plan.stats.rejected++;
      return false;
    }
    plan.fixtures.push({ id, kind, bounds: rect });
    return true;
  };
  if (maxFixtures > 0 && (profile.algorithm === 'dining' || profile.algorithm === 'aisles')) {
    // Front counter beside, never across, the entrance route.
    add(
      profile.algorithm === 'dining' ? 'counter' : 'checkout',
      [aisle / 2 + 0.5, 1, aisle / 2 + 3.3, 2],
      'service',
    );
  }
  outer: for (let row = 0; row < rows; row++) {
    const z0 = front + row * (depth + aisle);
    plan.circulation.push([bounds[0], z0 + depth, bounds[2], z0 + depth + aisle]);
    for (let col = 0; col < columns; col++)
      for (const side of [-1, 1]) {
        if (plan.stats.candidates >= maxCandidates || plan.fixtures.length >= maxFixtures) {
          plan.stats.truncated = true;
          break outer;
        }
        plan.stats.candidates++;
        if (plan.stats.candidates % 8 === 0) yield;
        if (unit01(hashCoord(col * 2 + (side === 1 ? 1 : 0), row, salt), 0) > profile.density)
          continue;
        const near = aisle / 2 + col * (width + aisle);
        const x0 = side === 1 ? near : -near - width;
        const rect: Bounds2 = [x0, z0, x0 + width, z0 + depth];
        const id = `${row}:${col}:${side}`;
        if (profile.algorithm === 'rooms') {
          if (!interiorRectFits(site, rect, 0.45)) {
            plan.stats.rejected++;
            continue;
          }
          const kind =
            profile.id === 'house' && row === 0
              ? side === -1
                ? 'sofa'
                : 'counter'
              : profile.furnishing;
          plan.rooms.push({ id, bounds: rect, use: kind });
          // Back of room: doorway and turning area remain clear.
          add(kind, [x0 + 0.5, z0 + depth - 2.4, x0 + width - 0.5, z0 + depth - 0.45], id);
        } else add(profile.furnishing, rect, id);
      }
  }
  return plan;
}

export function generateInteriorPlan(
  site: InteriorSite,
  options: InteriorGenerateOptions,
): InteriorPlan {
  const steps = generateInteriorPlanSteps(site, options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
