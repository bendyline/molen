import { type Bounds2, ringBounds } from './geometry2d';
import { interiorRectFits } from './interior-plan';
import { interiorToLocal } from './interior-site';
import type {
  InteriorAtriumPlan,
  InteriorEscalator,
  InteriorFixture,
  InteriorGenerateOptions,
  InteriorPlan,
  InteriorProfile,
  InteriorShop,
} from './interior-types';
import { hashCoord, hashString, unit01 } from './seed';

const MAX_LEVELS = 3;
const STEP = 4;
/** The floor kept either side of the void, for walking past the shops. */
const WALKWAY = 3.4;
/** How far a run climbs: the angle of a real escalator, a little under one in two. */
const RUN_PER_RISE = 1.9;
const BRIDGE = 4;
const ESCALATOR_WIDTH = 1.5;
const MIN_LENGTH = 30;
const ANCHOR_DEPTH = 24;

function overlaps(a: Bounds2, b: Bounds2): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/**
 * A mall: a galleria straight in from the entrance, a cross galleria where one fits, shops down
 * both sides of each on every storey, and an anchor store closing the far end. Above the ground
 * floor the galleria's middle is a void; escalators climb it in wells split by bridges, because
 * each run has to land on a floor and the next has to start from one.
 */
export function* generateAtriumPlanSteps(
  plan: InteriorPlan,
  profile: InteriorProfile,
  options: InteriorGenerateOptions,
): Generator<void, InteriorPlan | undefined, void> {
  const site = plan.site;
  const storeys = (site.storeys ?? plan.storeys).slice(0, MAX_LEVELS);
  const [x0, , x1, z1] = ringBounds(site.outline.map((p) => interiorToLocal(site, p)));
  const half = profile.aisleWidth / 2;
  const fits = (r: Bounds2, clearance = 0.3): boolean => interiorRectFits(site, r, clearance);
  let end = 1;
  while (end + STEP <= z1 && fits([-half, 0.6, half, end + STEP])) end += STEP;
  if (end < MIN_LENGTH) return undefined;
  plan.storeys = storeys;
  const gallerias: Bounds2[] = [[-half, 0.6, half, end]];
  const voids: Bounds2[] = [];
  const crossAt = Math.round((end * 0.42) / STEP) * STEP;
  let lo = -half,
    hi = half;
  while (hi + STEP <= x1 && fits([hi, crossAt - half, hi + STEP, crossAt + half])) hi += STEP;
  while (lo - STEP >= x0 && fits([lo - STEP, crossAt - half, lo, crossAt + half])) lo -= STEP;
  const crossed = hi - half >= 24 || -half - lo >= 24;
  if (crossed) gallerias.push([lo, crossAt - half, hi, crossAt + half]);

  // Voids and escalators, up the main galleria from just past the crossing.
  const inner = half - WALKWAY;
  const escalators: InteriorEscalator[] = [];
  if (storeys.length > 1 && inner > ESCALATOR_WIDTH) {
    const rise = (storeys[1]?.floor ?? 0) - (storeys[0]?.floor ?? 0);
    const run = rise * RUN_PER_RISE;
    let z = crossed ? crossAt + half + BRIDGE : Math.max(10, end * 0.3);
    const start = Math.max(8, 6);
    if (crossed && crossAt - half - 2 > start)
      voids.push([-inner, start, inner, crossAt - half - 2]);
    else if (!crossed && z > start + 4) voids.push([-inner, start, inner, z - BRIDGE]);
    for (let lower = 0; lower + 1 < storeys.length; lower++) {
      if (z + run + BRIDGE > end - 4) break;
      voids.push([-inner, z, inner, z + run]);
      for (const side of [-1, 1] as const) {
        const a = side === 1 ? 0.2 : -0.2 - ESCALATOR_WIDTH;
        escalators.push({
          bounds: [a, z, a + ESCALATOR_WIDTH, z + run],
          lower,
          upper: lower + 1,
          axis: 'z',
          climb: 1,
        });
      }
      z += run + BRIDGE;
    }
    if (z + 6 < end - 4) voids.push([-inner, z, inner, end - 4]);
    if (crossed) {
      for (const side of [-1, 1]) {
        const a = side === 1 ? half + 2 : lo + 6;
        const b = side === 1 ? hi - 6 : -half - 2;
        if (b - a > 8) voids.push([a, crossAt - inner, b, crossAt + inner]);
      }
    }
  }
  yield;

  const shops: InteriorShop[] = [];
  const salt = hashString(plan.seed);
  const reserved: Bounds2[] = [...gallerias];
  const addShop = (bounds: Bounds2, facing: InteriorShop['facing'], anchor = false): boolean => {
    if (reserved.some((r) => overlaps(r, bounds)) || !fits(bounds, 0.25)) return false;
    shops.push({
      id: `${shops.length}`,
      bounds,
      facing,
      seed: unit01(hashCoord(shops.length, 0, salt), 0),
      anchor,
    });
    reserved.push(bounds);
    return true;
  };
  const anchor = Math.min(half + 8, 26);
  addShop([-anchor, end, anchor, end + ANCHOR_DEPTH], 'z-', true);
  const depths = [profile.moduleDepth, profile.moduleDepth * 0.75, profile.moduleDepth * 0.5];
  /** A row of shops along one side of a galleria, shallower where the building allows less. */
  const row = (
    from: number,
    to: number,
    place: (a: number, b: number, depth: number) => boolean,
  ): void => {
    let at = from;
    let index = 0;
    while (at + 6 <= to) {
      const width = profile.moduleWidth * (0.7 + 0.6 * unit01(hashCoord(index++, 1, salt), 1));
      const b = Math.min(to, at + width);
      if (!depths.some((depth) => place(at, b, depth))) {
        at += 3;
        continue;
      }
      at = b;
    }
  };
  for (const side of [-1, 1]) {
    const near = side * half;
    row(0.6, end, (a, b, depth) =>
      addShop(
        [Math.min(near, near + side * depth), a, Math.max(near, near + side * depth), b],
        side === 1 ? 'x-' : 'x+',
      ),
    );
    yield;
    if (crossed) {
      const face = crossAt + side * half;
      const bounds = (a: number, b: number, depth: number): Bounds2 => [
        a,
        Math.min(face, face + side * depth),
        b,
        Math.max(face, face + side * depth),
      ];
      for (const [from, to] of [
        [lo, -half],
        [half, hi],
      ] as const)
        row(from, to, (a, b, depth) => addShop(bounds(a, b, depth), side === 1 ? 'z-' : 'z+'));
      yield;
    }
  }
  const atrium: InteriorAtriumPlan = { gallerias, voids, shops, escalators };
  plan.atrium = atrium;
  plan.circulation.push(...gallerias);

  // Shops are stocked for what they are; the first few hold food around the crossing.
  const cap = Math.min(512, options.maxFixtures ?? 512);
  const add = (kind: InteriorFixture['kind'], rect: Bounds2, id: string, level: number): void => {
    if (plan.fixtures.length >= cap) {
      plan.stats.truncated = true;
      return;
    }
    plan.fixtures.push({ id, kind, level, bounds: rect });
  };
  // Benches and planting down the middle of the ground floor, clear of escalators.
  for (let z = 8; z + 4 < end; z += 16) {
    const bench: Bounds2 = [-1, z, 1, z + 0.7];
    if (!escalators.some((e) => overlaps(e.bounds, [-2, z - 2, 2, z + 3]))) {
      add('planter', [-0.8, z + 1.2, 0.8, z + 2.8], `planter:${z}`, 0);
      add('bench', bench, `bench:${z}`, 0);
    }
  }
  for (const [level] of storeys.entries()) {
    for (const shop of shops) {
      plan.stats.candidates++;
      const [a0, b0, a1, b1] = shop.bounds;
      const food = shop.seed < 0.14;
      const rack = shop.seed < 0.6;
      const kind: InteriorFixture['kind'] = food ? 'table' : rack ? 'rack' : 'shelf';
      const width = food ? 1.8 : 1,
        depth = food ? 1.8 : 3;
      const gap = food ? 0.9 : 1.6;
      const margin = 1.6;
      const columns = Math.min(6, Math.floor((a1 - a0 - margin) / (width + gap)));
      const rows = Math.min(4, Math.floor((b1 - b0 - margin) / (depth + gap)));
      for (let c = 0; c < columns; c++)
        for (let r = 0; r < rows; r++) {
          const x = a0 + margin / 2 + c * (width + gap),
            z = b0 + margin / 2 + r * (depth + gap);
          add(kind, [x, z, x + width, z + depth], `${level}:${shop.id}:${c}:${r}`, level);
        }
    }
    yield;
  }
  return plan;
}
