import { type Bounds2, ringBounds } from './geometry2d';
import { interiorRectFits } from './interior-plan';
import { interiorToLocal } from './interior-site';
import type {
  InteriorFurniture,
  InteriorPlan,
  InteriorProfile,
  InteriorRoom,
  InteriorRoomUse,
} from './interior-types';
import { hashString, unit01 } from './seed';

/** A connected domestic program, not a repeated bed grid. Conservative inscribed banks keep
 * partitions and the entire stair opening inside irregular footprints and away from courtyards.
 * The entrance hallway is never consumed by stairs, fixtures, or room walls. */
export function* generateResidentialPlanSteps(
  plan: InteriorPlan,
  profile: InteriorProfile,
  maxFixtures: number,
  maxCandidates: number,
): Generator<void, InteriorPlan, void> {
  const site = plan.site;
  const salt = hashString(plan.seed);
  const config = profile.residential ?? {
    upstairs: true,
    stairWidth: 1.3,
    runPerRise: 1.65,
    minRoomWidth: 2.4,
  };
  const bounds = ringBounds(site.outline.map((p) => interiorToLocal(site, p)));
  const hall = Math.max(1.6, profile.aisleWidth) / 2;
  const back = Math.min(18, bounds[3] - 0.4);
  const banks: Bounds2[] = [];
  // Bounded search preserves the entrance-connected portion of concave footprints. Shrink
  // depth before width: a missing rear wing must not eliminate the front living rooms.
  for (const side of [-1, 1]) {
    let bank: Bounds2 | undefined;
    search: for (let depth = back; depth >= 5.6; depth -= 0.5) {
      const extent = Math.min(9, side < 0 ? -bounds[0] - 0.4 : bounds[2] - 0.4);
      for (let width = extent - hall; width >= config.minRoomWidth; width -= 0.4) {
        if (plan.stats.candidates >= maxCandidates) {
          plan.stats.truncated = true;
          break search;
        }
        plan.stats.candidates++;
        if (plan.stats.candidates % 8 === 0) yield;
        const rect: Bounds2 =
          side < 0 ? [-hall - width, 0.4, -hall, depth] : [hall, 0.4, hall + width, depth];
        if (interiorRectFits(site, rect)) {
          bank = rect;
          break search;
        }
        plan.stats.rejected++;
      }
    }
    if (bank) banks.push(bank);
  }
  plan.circulation.push([-hall, Math.min(0, bounds[1]), hall, back]);
  const right = banks.find((b) => b[0] > 0);
  const upper = site.storeys?.[1];
  const rise = upper ? upper.floor - site.floor : 0;
  const run = rise * config.runPerRise;
  const stairStart = 1.6;
  const stairEnd = stairStart + run;
  // One connected upper floor; no inaccessible slabs are generated when stairs cannot fit.
  const upstairs =
    config.upstairs &&
    upper !== undefined &&
    rise >= 2.5 &&
    rise <= 4 &&
    right !== undefined &&
    right[2] - right[0] >= config.stairWidth + 0.7 &&
    right[3] >= stairEnd + 1.5 + 2.6 &&
    banks.length === 2;
  if (upstairs && upper && right) {
    plan.storeys.push(upper);
    plan.stairs.push({
      bounds: [right[0] + 0.25, stairStart, right[0] + 0.25 + config.stairWidth, stairEnd],
      lower: 0,
      upper: 1,
      steps: Math.ceil(rise / 0.18),
    });
  }
  const room = (
    program: InteriorRoomUse,
    rect: Bounds2,
    level: number,
    side: number,
    index: number,
  ): InteriorRoom => {
    const id = `${level}:${side}:${index}:${program}`;
    const r: InteriorRoom = {
      id,
      program,
      level,
      bounds: rect,
      use:
        program === 'bedroom'
          ? 'bed'
          : program === 'kitchen'
            ? 'kitchen'
            : program === 'bathroom'
              ? 'vanity'
              : 'sofa',
      door: {
        side: side < 0 ? 'right' : 'left',
        at: rect[1] + Math.min(1.4, (rect[3] - rect[1]) / 2),
      },
    };
    plan.rooms.push(r);
    return r;
  };
  for (let level = 0; level < plan.storeys.length; level++) {
    for (const bank of banks) {
      const side = bank[0] < 0 ? -1 : 1;
      // A long stairwell gets its own landing; other banks use a seed-varied room division.
      const split =
        upstairs && side > 0
          ? stairEnd + 1.5
          : bank[1] + (bank[3] - bank[1]) * (0.49 + unit01(salt, 4) * 0.09);
      const front: Bounds2 = [bank[0], bank[1], bank[2], split];
      const rear: Bounds2 = [bank[0], split, bank[2], bank[3]];
      const a: InteriorRoomUse =
        upstairs && side > 0
          ? 'stairwell'
          : level > 0
            ? 'bedroom'
            : side < 0
              ? 'living'
              : 'kitchen';
      const b: InteriorRoomUse =
        side > 0 ? 'bathroom' : level > 0 || !upstairs ? 'bedroom' : 'kitchen';
      room(a, front, level, side, 0);
      room(b, rear, level, side, 1);
    }
  }
  for (const r of plan.rooms) {
    furnish(r);
    yield;
  }
  function furnish(r: InteriorRoom): void {
    if (r.program === 'stairwell') return;
    const [x0, z0, x1, z1] = r.bounds;
    const mid = (x0 + x1) / 2,
      depth = z1 - z0;
    const variant = Math.floor(unit01(hashString(`${plan.seed}|${r.id}`), 0) * 4);
    const placed: Bounds2[] = [];
    const add = (kind: InteriorFurniture, x: number, z: number, w: number, d: number): void => {
      if (plan.fixtures.length >= maxFixtures || plan.stats.candidates >= maxCandidates) {
        plan.stats.truncated = true;
        return;
      }
      plan.stats.candidates++;
      const rect: Bounds2 = [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
      if (
        rect[0] < x0 + 0.16 ||
        rect[2] > x1 - 0.16 ||
        rect[1] < z0 + 0.16 ||
        rect[3] > z1 - 0.16 ||
        !interiorRectFits(site, rect) ||
        (kind !== 'rug' &&
          placed.some(
            (p) =>
              rect[0] < p[2] + 0.12 &&
              rect[2] > p[0] - 0.12 &&
              rect[1] < p[3] + 0.12 &&
              rect[3] > p[1] - 0.12,
          ))
      ) {
        plan.stats.rejected++;
        return;
      }
      // Door turning space is one meter deep inside the room. Furnish from the far wall inward.
      const door = r.door;
      if (
        kind !== 'rug' &&
        door &&
        rect[1] < door.at + 0.65 &&
        rect[3] > door.at - 0.65 &&
        (door.side === 'left' ? rect[0] < x0 + 1.1 : rect[2] > x1 - 1.1)
      ) {
        plan.stats.rejected++;
        return;
      }
      plan.fixtures.push({
        id: `${r.id}:${kind}:${placed.length}`,
        kind,
        bounds: rect,
        level: r.level ?? 0,
        variant,
      });
      if (kind !== 'rug') placed.push(rect);
    };
    const outer = x0 < 0 ? x0 + 0.6 : x1 - 0.6;
    if (r.program === 'bedroom') {
      const bw = variant === 1 ? 1.05 : 1.6;
      add('bed', mid, z1 - 1.24, bw, 2.05);
      add('wardrobe', outer, z0 + 0.58, 0.8, 0.65);
      add('dresser', outer, z0 + 1.7, 0.75, 0.6);
      add('rug', mid, z1 - 1.9, Math.min(x1 - x0 - 0.4, 2.2), Math.min(depth - 0.4, 2.7));
      add('plant', x0 < 0 ? x0 + 0.45 : x1 - 0.45, z1 - 0.5, 0.45, 0.45);
    } else if (r.program === 'living') {
      add('sofa', mid, z1 - 0.75, Math.min(2.5, x1 - x0 - 0.45), 1.05);
      add('coffee-table', mid, z1 - 2.02, 1.15, 0.6);
      add('rug', mid, z1 - 1.8, Math.min(2.8, x1 - x0 - 0.4), Math.min(2.3, depth - 0.4));
      add('bookcase', outer, z0 + 0.62, 0.85, 0.45);
      add('plant', outer, z0 + 1.6, 0.5, 0.5);
    } else if (r.program === 'kitchen') {
      add('kitchen', mid, z1 - 0.58, Math.min(3.6, x1 - x0 - 0.4), 0.72);
      add('table', mid, z1 - 2.65, Math.min(2.2, x1 - x0 - 0.5), 1.9);
      add('plant', outer, z0 + 0.55, 0.5, 0.5);
    } else if (r.program === 'bathroom') {
      add('shower', x0 + 0.76, z1 - 0.77, 1.12, 1.12);
      add('toilet', x1 - 0.6, z1 - 0.68, 0.62, 0.92);
      add('vanity', outer, z0 + 0.6, 0.78, 0.62);
    }
  }
  return plan;
}
