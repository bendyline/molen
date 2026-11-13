import { type Bounds2, ringBounds } from './geometry2d';
import { interiorRectFits } from './interior-plan';
import { interiorToLocal } from './interior-site';
import type { InteriorFixture, InteriorPlan, InteriorProfile } from './interior-types';

const HALL_ALGORITHMS: ReadonlySet<string> = new Set([
  'auditorium',
  'court',
  'concourse',
  'gallery',
  'apparatus',
]);
const MIN_DEPTH = 8;
const MIN_WIDTH = 6;

/** The largest rectangle straight in from the door, grown a side at a time while it fits. */
function hallBounds(plan: InteriorPlan): Bounds2 | undefined {
  const site = plan.site;
  const [x0, , x1, z1] = ringBounds(site.outline.map((p) => interiorToLocal(site, p)));
  const fits = (r: Bounds2): boolean => interiorRectFits(site, r, 0.3);
  let rect: Bounds2 = [-1, 0.6, 1, 3];
  if (!fits(rect)) return undefined;
  for (let grown = true, guard = 0; grown && guard < 400; guard++) {
    grown = false;
    const tries: Bounds2[] = [
      [rect[0], rect[1], rect[2], Math.min(rect[3] + 2, z1)],
      [Math.max(rect[0] - 1, x0), rect[1], rect[2], rect[3]],
      [rect[0], rect[1], Math.min(rect[2] + 1, x1), rect[3]],
    ];
    for (const attempt of tries) {
      if (attempt.every((v, i) => v === rect[i])) continue;
      if (fits(attempt)) {
        rect = attempt;
        grown = true;
      }
    }
  }
  return rect[3] - rect[1] >= MIN_DEPTH && rect[2] - rect[0] >= MIN_WIDTH ? rect : undefined;
}

/** One big room with a purpose, or undefined for another algorithm or a footprint too tight. */
export function* generateHallPlanSteps(
  plan: InteriorPlan,
  profile: InteriorProfile,
  maxFixtures: number,
): Generator<void, InteriorPlan | undefined, void> {
  if (!HALL_ALGORITHMS.has(profile.algorithm)) return undefined;
  const hall = hallBounds(plan);
  if (!hall) return undefined;
  yield;
  const [x0, z0, x1, z1] = hall;
  plan.circulation.push(hall);
  const add = (
    kind: InteriorFixture['kind'],
    bounds: Bounds2,
    id: string,
    variant?: number,
  ): void => {
    if (plan.fixtures.length >= maxFixtures) {
      plan.stats.truncated = true;
      return;
    }
    plan.stats.candidates++;
    plan.fixtures.push({ id, kind, bounds, ...(variant !== undefined ? { variant } : {}) });
  };
  const aisle = profile.aisleWidth / 2;
  if (profile.algorithm === 'auditorium') {
    // Everything faces the far end, past a foyer at the door and a central aisle.
    const focal = profile.furnishing === 'pew' ? 'altar' : 'screen';
    add(focal, [Math.max(x0 + 1, -5), z1 - 2.4, Math.min(x1 - 1, 5), z1 - 0.3], 'focus');
    const end = z1 - 4;
    let row = 0;
    for (let z = z0 + 4.5; z + profile.moduleDepth < end; z += profile.moduleDepth) {
      for (const [a, b] of [
        [x0 + 0.8, -aisle],
        [aisle, x1 - 0.8],
      ] as const)
        if (b - a >= 1.6)
          add(profile.furnishing, [a, z, b, z + profile.moduleDepth * 0.72], `${row}:${a}`);
      row++;
      if (row % 4 === 0) yield;
    }
  } else if (profile.algorithm === 'court') {
    // Regulation proportions, fitted to the room; bleachers along a long side if it has one.
    const width = Math.min(x1 - x0 - 1, 15),
      length = Math.min(z1 - z0 - 2, 28);
    const cx = (x0 + x1) / 2 + (x1 - x0 - width > 6 ? 2.2 : 0),
      cz = (z0 + z1) / 2;
    add('court-lines', [cx - width / 2, cz - length / 2, cx + width / 2, cz + length / 2], 'court');
    add('hoop', [cx - 1, cz - length / 2 + 0.2, cx + 1, cz - length / 2 + 1], 'near', 0);
    add('hoop', [cx - 1, cz + length / 2 - 1, cx + 1, cz + length / 2 - 0.2], 'far', 1);
    const side = cx - width / 2 - x0;
    if (side > 3)
      add('bleacher', [x0 + 0.3, cz - length / 2, cx - width / 2 - 0.5, cz + length / 2], 'stand');
  } else if (profile.algorithm === 'concourse') {
    // Ticket windows by the door, a gate line across the hall, and waiting benches beyond it.
    for (let x = x0 + 1; x + 3 < -aisle; x += 4)
      add('counter', [x, z0 + 1.2, x + 3, z0 + 2.2], `ticket:${x}`);
    const gates = z0 + (z1 - z0) * 0.45;
    for (let x = x0 + 0.8; x + 1 < x1; x += profile.moduleWidth)
      if (Math.abs(x + 0.5) > aisle) add('ticket-gate', [x, gates, x + 1, gates + 1], `gate:${x}`);
    for (let z = gates + 4; z + 1 < z1 - 1; z += 5)
      for (let x = x0 + 2; x + 3 < x1 - 2; x += 6)
        if (x + 3 < -aisle || x > aisle) add('bench', [x, z, x + 3, z + 0.7], `seat:${x}:${z}`);
  } else if (profile.algorithm === 'gallery') {
    // A central walk with rooms off it, each a plinth under a wall of pictures.
    const width = profile.moduleWidth,
      depth = profile.moduleDepth;
    let room = 0;
    for (const side of [-1, 1]) {
      for (let z = z0 + 2; z + depth <= z1; z += depth + profile.aisleWidth * 0.4) {
        for (let c = 0; c < 4; c++) {
          const near = side * (aisle + c * width),
            far = near + side * width;
          const bounds: Bounds2 = [Math.min(near, far), z, Math.max(near, far), z + depth];
          if (!interiorRectFits(plan.site, bounds, 0.3)) continue;
          const [a0, b0, a1, b1] = bounds;
          plan.rooms.push({ id: `g${room++}`, bounds, use: 'plinth' });
          const cx = (a0 + a1) / 2,
            cz = (b0 + b1) / 2;
          add('plinth', [cx - 0.5, cz - 0.5, cx + 0.5, cz + 0.5], `plinth:${room}`, room);
          add('painting', [a0 + 0.8, b1 - 0.22, a1 - 0.8, b1 - 0.12], `art:${room}`, room);
          yield;
        }
      }
    }
  } else if (profile.algorithm === 'apparatus') {
    // Engines side by side, nose to the doors.
    const width = 3.6;
    const count = Math.max(1, Math.floor((x1 - x0) / (width + 1)));
    const start = (x0 + x1) / 2 - (count * (width + 1)) / 2;
    const length = Math.min(9, z1 - z0 - 2);
    for (let i = 0; i < count; i++) {
      const x = start + i * (width + 1) + 0.5;
      add('fire-engine', [x + 0.4, z0 + 1.2, x + width - 0.4, z0 + 1.2 + length], `engine:${i}`, i);
    }
    for (let x = x0 + 0.6; x + 1 < x1; x += 1.4)
      if (z1 - z0 - length > 3) add('wardrobe', [x, z1 - 0.8, x + 1, z1 - 0.2], `locker:${x}`);
  }
  return plan;
}
