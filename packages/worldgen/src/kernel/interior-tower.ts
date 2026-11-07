import { type Bounds2, ringBounds } from './geometry2d';
import { interiorRectFits } from './interior-plan';
import { interiorToLocal } from './interior-site';
import type {
  InteriorCell,
  InteriorElevator,
  InteriorFixture,
  InteriorGenerateOptions,
  InteriorPlan,
  InteriorProfile,
  InteriorTowerPlan,
  InteriorTowerProgram,
} from './interior-types';
import { hashCoord, hashString, unit01 } from './seed';

/** Up to this many storeys are built outright; a taller stack builds those near the viewer. */
const ALL_BUILT = 4;
const MAX_ROWS = 24;
const CAR = 2.5;
const CAR_DEPTH = 2.4;
const STEP = 2;
const DEFAULT_PROGRAM: InteriorTowerProgram = { plate: 'open', elevators: 2, lobby: 8 };

function overlaps(a: Bounds2, b: Bounds2): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** Which storeys a viewer on `focus` needs: always the way out, and the floors around them. */
export function towerLevels(count: number, focus: number): number[] {
  if (count <= ALL_BUILT) return Array.from({ length: count }, (_, level) => level);
  const on = Math.max(0, Math.min(count - 1, Math.round(focus)));
  return [...new Set([0, on - 1, on, on + 1])]
    .filter((level) => level >= 0 && level < count)
    .sort((a, b) => a - b);
}

/**
 * One plate of corridors and rooms, built from the door's frame: a spine straight in from the
 * entrance, crossed by corridors a double row of rooms apart, with the lift core beside the spine
 * near the middle of the plate. A plate too narrow to cross puts its rooms on the spine.
 */
function layOut(
  plan: InteriorPlan,
  profile: InteriorProfile,
  program: InteriorTowerProgram,
  stacked: boolean,
): Omit<InteriorTowerPlan, 'levels'> | undefined {
  const site = plan.site;
  const [x0, z0, x1, z1] = ringBounds(site.outline.map((p) => interiorToLocal(site, p)));
  const corridor = profile.aisleWidth,
    half = corridor / 2,
    width = profile.moduleWidth,
    depth = profile.moduleDepth;
  const fits = (r: Bounds2, clearance = 0.3): boolean => interiorRectFits(site, r, clearance);
  let end = 1;
  while (end + STEP <= z1 && fits([-half, 0.6, half, end + STEP])) end += STEP;
  if (end < 5) return undefined;
  const corridors: Bounds2[] = [[-half, 0.6, half, end]];
  const row = corridor + 2 * depth;
  const crossings: { z: number; lo: number; hi: number }[] = [];
  for (let k = 0; k < MAX_ROWS; k++) {
    const z = Math.max(0.5, z0 + 0.45) + depth + half + k * row;
    if (z > end - half) break;
    let lo = -half,
      hi = half;
    while (hi + STEP <= x1 && fits([hi, z - half, hi + STEP, z + half])) hi += STEP;
    while (lo - STEP >= x0 && fits([lo - STEP, z - half, lo, z + half])) lo -= STEP;
    if (hi - half < width && -half - lo < width) continue;
    crossings.push({ z, lo, hi });
    corridors.push([lo, z - half, hi, z + half]);
  }

  // The core: lifts either side of the spine, on the crossing nearest the plate's middle.
  const elevators: InteriorElevator[] = [];
  const reserved: Bounds2[] = [...corridors];
  if (stacked && program.elevators > 0) {
    const middle = (z0 + z1) / 2;
    const banks = [1, -1] as const;
    const each = Math.ceil(program.elevators / 2);
    const length = each * CAR;
    const placed = (side: 1 | -1, center: number): boolean => {
      const a = side === 1 ? half : -half - CAR_DEPTH;
      const shaft: Bounds2 = [a, center - length / 2, a + CAR_DEPTH, center + length / 2];
      if (!fits(shaft, 0.2) || reserved.some((r) => overlaps(r, shaft))) return false;
      reserved.push(shaft);
      for (let i = 0; i < each && elevators.length < program.elevators; i++)
        elevators.push({
          id: `${side}:${i}`,
          bounds: [a, shaft[1] + i * CAR, a + CAR_DEPTH, shaft[1] + (i + 1) * CAR],
          facing: side === 1 ? 'x-' : 'x+',
        });
      return true;
    };
    const search = Math.max(z1 - z0, 4);
    outer: for (let offset = 0; offset < search; offset += STEP)
      for (const direction of [1, -1])
        for (const side of banks)
          if (placed(side, middle + direction * offset)) {
            if (elevators.length < program.elevators)
              placed(side === 1 ? -1 : 1, middle + direction * offset);
            break outer;
          }
  }

  const cells: InteriorCell[] = [];
  const add = (cell: Omit<InteriorCell, 'open'>): void => {
    if (reserved.some((r) => overlaps(r, cell.bounds))) return;
    if (!fits(cell.bounds, 0.2)) return;
    cells.push({
      ...cell,
      open: program.plate === 'open',
      ...(cell.bounds[1] < program.lobby ? { upperOnly: true } : {}),
    });
    reserved.push(cell.bounds);
  };
  // Rooms on the crossings, working out from the spine.
  for (const [index, { z, lo, hi }] of crossings.entries()) {
    for (const side of [1, -1] as const) {
      const near = z + side * half,
        far = near + side * depth;
      for (const direction of [1, -1] as const) {
        const from = direction === 1 ? half : -half,
          reach = direction === 1 ? hi : lo;
        for (let i = 0; i < 64; i++) {
          const a = from + direction * i * width,
            b = a + direction * width;
          if (direction === 1 ? b > reach : b < reach) break;
          add({
            id: `${index}:${side}:${direction}:${i}`,
            bounds: [Math.min(a, b), Math.min(near, far), Math.max(a, b), Math.max(near, far)],
            facing: side === 1 ? 'z-' : 'z+',
          });
        }
      }
    }
  }
  // Whatever of the spine has no crossing beside it faces rooms of its own.
  for (const direction of [1, -1] as const) {
    const near = direction * half,
      far = near + direction * depth;
    for (let i = 0; i < 64; i++) {
      const a = 0.6 + i * width;
      if (a + width > end) break;
      add({
        id: `s:${direction}:${i}`,
        bounds: [Math.min(near, far), a, Math.max(near, far), a + width],
        facing: direction === 1 ? 'x-' : 'x+',
      });
    }
  }
  return { corridors, cells, elevators };
}

/** Furnish one room, working from its door: `u` across the room, `v` from the door to the back. */
function furnish(
  cell: InteriorCell,
  plate: InteriorTowerProgram['plate'],
  salt: number,
  place: (kind: InteriorFixture['kind'], rect: Bounds2, id: string, variant?: number) => void,
): void {
  const [x0, z0, x1, z1] = cell.bounds;
  const alongX = cell.facing === 'z-' || cell.facing === 'z+';
  const span = alongX ? x1 - x0 : z1 - z0,
    deep = alongX ? z1 - z0 : x1 - x0;
  const rect = (u0: number, v0: number, u1: number, v1: number): Bounds2 => {
    const fromLow = cell.facing === 'z-' || cell.facing === 'x-';
    const a = fromLow ? v0 : deep - v1,
      b = fromLow ? v1 : deep - v0;
    return alongX ? [x0 + u0, z0 + a, x0 + u1, z0 + b] : [x0 + a, z0 + u0, x0 + b, z0 + u1];
  };
  const variant = Math.floor(unit01(hashString(cell.id) ^ salt, 3) * 4);
  if (plate === 'open') {
    // Back-to-back desk pairs with a walkway between each.
    const columns = Math.floor((span - 0.6) / 1.9),
      rows = Math.floor((deep - 1.2) / 2.2);
    for (let c = 0; c < columns; c++)
      for (let r = 0; r < rows; r++) {
        const u = 0.3 + c * 1.9,
          v = 0.9 + r * 2.2;
        place('desk', rect(u, v, u + 1.7, v + 1.9), `${c}:${r}`, variant);
      }
  } else if (plate === 'guest') {
    const bed = Math.min(1.9, span - 0.8);
    place('bed', rect((span - bed) / 2, deep - 2.2, (span + bed) / 2, deep - 0.15), 'bed', variant);
    place('dresser', rect(0.1, 1.6, 0.7, Math.min(3.1, deep - 2.4)), 'desk', variant);
  } else if (plate === 'flat') {
    place('bed', rect(0.2, deep - 2.2, 2, deep - 0.15), 'bed', variant);
    if (span > 3.8)
      place('sofa', rect(span - 2.4, deep - 1.2, span - 0.2, deep - 0.2), 'sofa', variant);
    place('kitchen', rect(0.1, 0.8, Math.min(span - 0.2, 2.4), 1.5), 'kitchen', variant);
    if (span > 5)
      place('coffee-table', rect(span - 1.9, deep - 2.5, span - 0.7, deep - 1.7), 'table');
  } else if (plate === 'ward') {
    const bed = Math.min(1.1, (span - 1.2) / 2);
    for (const [index, u] of [0.2, span - 0.2 - bed].entries())
      place('bed', rect(u, deep - 2.2, u + bed, deep - 0.15), `bed${index}`, variant);
  } else {
    // Teacher's desk at the front, then rows of pupils facing it.
    place('desk', rect(span / 2 - 0.8, 0.5, span / 2 + 0.8, 1.5), 'front', variant);
    const columns = Math.floor((span - 0.8) / 1.4),
      rows = Math.floor((deep - 2.6) / 1.4);
    for (let c = 0; c < columns; c++)
      for (let r = 0; r < rows; r++) {
        const u = 0.4 + c * 1.4,
          v = 2.2 + r * 1.4;
        place('desk', rect(u, v, u + 1.2, v + 1.2), `${c}:${r}`, variant);
      }
  }
}

/**
 * Multi-storey floor plates, or undefined when no spine fits. Each storey is the same plate, and a
 * tall stack keeps only the ground floor and the storeys around `focus`, so a sixty-storey tower
 * costs what a four-storey one does; a host asks for another floor as the lift arrives.
 */
export function* generateTowerPlanSteps(
  plan: InteriorPlan,
  profile: InteriorProfile,
  options: InteriorGenerateOptions,
): Generator<void, InteriorPlan | undefined, void> {
  const site = plan.site;
  const program = profile.tower ?? DEFAULT_PROGRAM;
  const all = site.storeys ?? plan.storeys;
  const plate = layOut(plan, profile, program, all.length > 1);
  if (!plate) return undefined;
  yield;
  // Without a lift, upper floors could only be seen, never reached.
  const stack = plate.elevators.length > 0 ? all : all.slice(0, 1);
  const levels = towerLevels(stack.length, options.focus ?? 0);
  plan.storeys = levels.map((level) => stack[level] ?? (all[0] as (typeof all)[number]));
  plan.tower = { ...plate, levels };
  plan.circulation.push(...plate.corridors);
  const cap = Math.min(512, 200 * levels.length);
  const salt = hashString(plan.seed);
  let tested = 0;
  outer: for (const [storey, level] of levels.entries()) {
    if (level === 0) {
      const add = (kind: InteriorFixture['kind'], rect: Bounds2, id: string): void => {
        plan.fixtures.push({ id, kind, level: storey, bounds: rect });
      };
      const half = profile.aisleWidth / 2;
      if (program.lobby > 0 && interiorRectFits(site, [half + 0.6, 2, half + 3.6, 3], 0.2))
        add('reception', [half + 0.6, 2, half + 3.6, 3], 'reception');
      for (const [i, z] of [4.5, 6.5].entries()) {
        const rect: Bounds2 = [-half - 2.2, z, -half - 0.4, z + 0.9];
        if (z + 1 < program.lobby && interiorRectFits(site, rect, 0.2))
          add('sofa', rect, `lobby:${i}`);
      }
    }
    for (const cell of plate.cells) {
      if (level === 0 && cell.upperOnly) continue;
      plan.stats.candidates++;
      if (++tested % 8 === 0) yield;
      // Named draws: leaving a room empty does not depend on which floors are built.
      if (unit01(hashCoord(hashString(cell.id), level, salt), 0) > profile.density) continue;
      furnish(cell, program.plate, salt, (kind, rect, id, variant) => {
        if (plan.fixtures.length >= cap) {
          plan.stats.truncated = true;
          return;
        }
        plan.fixtures.push({
          id: `${level}:${cell.id}:${id}`,
          kind,
          level: storey,
          bounds: rect,
          ...(variant !== undefined ? { variant } : {}),
        });
      });
      if (plan.fixtures.length >= cap) break outer;
    }
  }
  return plan;
}
