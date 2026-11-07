import { type Bounds2, distancePointToSegment, ringBounds } from './geometry2d';
import { resolveInteriorProfile } from './interior-catalog';
import { interiorRectFits } from './interior-plan';
import { interiorToLocal, interiorToWorld } from './interior-site';
import type {
  BuildingOpening,
  InteriorCatalogDoc,
  InteriorSite,
  InteriorStorey,
  ParkingLayout,
  ParkingRamp,
} from './interior-types';
import type { BuildingRequest, HeightSampler, Vec2, Vec3 } from './types';

/** Wall clearance of drive lanes, and the turnaround at each end of the ramp lanes. */
const EDGE = 0.45;
const TURNAROUND = 7.2;
/** A comfortable ramp climbs one meter in seven; a tight site may steepen it to one in five. */
const RUN_PER_RISE = [7, 6, 5] as const;
const MIN_RUN = 14;
/** Aisles are measured out from the door in steps this long, in meters. */
const STEP = 2;
/** Aisles shorter than this link at one end; beyond the long one, also through the middle. */
const SHORT_AISLE = 56;
const LONG_AISLE = 90;
const ALIGNED_DOOR = 6;
/** Perimeter wall: pier width, and the bay it repeats at (three stalls). */
const PIER = 0.7;
const BAY = 7.8;
const SPANDREL = 1;
const BEAM = 0.45;
const DOOR_HEIGHT = 2.5;
const MAX_DOORS = 3;
const MAX_OPENINGS = 900;

type Frame = Pick<InteriorSite, 'outline' | 'holes' | 'entrance' | 'inward'>;
interface Door {
  edge: number;
  length: number;
  center: number;
  frame: Frame;
}
/** Structural decisions made before the roof is built, since the top ramp passes through it. */
export interface ParkingSitePlan {
  layout: ParkingLayout;
  doors: Door[];
  /** Opening the top ramp cuts in the roof, as a ring in site coordinates. */
  roofOpening: Vec2[] | undefined;
}

function overlaps(a: Bounds2, b: Bounds2): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}
function rectRing(frame: Pick<Frame, 'entrance' | 'inward'>, r: Bounds2): Vec2[] {
  const [x0, z0, x1, z1] = r;
  return (
    [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ] as Vec2[]
  ).map((p) => interiorToWorld(frame, p));
}

/**
 * Rows of stalls either side of aisles, plus a pair of ramp lanes, in the door's frame. `axis` is
 * the direction the aisles run: parallel to the entrance wall (`x`), where a lane from the door
 * reaches the first of them, or straight in from it (`z`), where the door opens onto one.
 */
function layoutFor(
  frame: Frame,
  axis: 'x' | 'z',
  shift: number,
  storeys: number,
  rise: number,
  stallWidth: number,
  stallDepth: number,
  aisleWidth: number,
): (ParkingLayout & { capacity: number }) | undefined {
  const local = ringBounds(frame.outline.map((p) => interiorToLocal(frame, p)));
  // (u, v): u along the aisles, v across them.
  const rect = (u0: number, v0: number, u1: number, v1: number): Bounds2 =>
    axis === 'x' ? [u0, v0, u1, v1] : [v0, u0, v1, u1];
  const [uMin, vMin, uMax, vMax] =
    axis === 'x' ? local : ([local[1], local[0], local[3], local[2]] as Bounds2);
  const half = aisleWidth / 2;
  const row = aisleWidth + 2 * stallDepth;
  const fits = (u0: number, v0: number, u1: number, v1: number, clearance = 0.3): boolean =>
    interiorRectFits(frame, rect(Math.min(u0, u1), v0, Math.max(u0, u1), v1), clearance);
  // Where every aisle is measured from: the door's column, or just inside its wall.
  const crossU = axis === 'x' ? 0 : EDGE + half;
  const centers: number[] = [];
  if (axis === 'x') {
    const span = vMax - vMin - 2 * EDGE;
    const count = Math.floor(span / row);
    if (count < 1) return undefined;
    const start = vMin + EDGE + (span - count * row) / 2 + stallDepth + half;
    for (let k = 0; k < count; k++) centers.push(start + k * row);
  } else {
    // The door sets the grid: it opens onto this aisle, or with a shift onto its ramp lane.
    for (let k = -32; k <= 32; k++) {
      const v = shift + k * row;
      if (v - half >= vMin && v + half <= vMax) centers.push(v);
    }
  }
  const aisles: { v: number; lo: number; hi: number }[] = [];
  for (const v of centers) {
    let lo = crossU,
      hi = crossU;
    while (hi + STEP <= uMax && fits(hi, v - half, hi + STEP, v + half)) hi += STEP;
    while (lo - STEP >= uMin && fits(lo - STEP, v - half, lo, v + half)) lo -= STEP;
    if (hi - lo >= 2 * STEP) aisles.push({ v, lo, hi });
  }
  aisles.sort((a, b) => a.v - b.v);
  if (axis === 'z' && !aisles.some((a) => a.v === shift)) return undefined;
  const nearest = aisles[0];
  if (!nearest) return undefined;
  // Only as far as the first aisle: on a small plate, a lane through every row would leave none.
  let doorLane: Bounds2 | undefined;
  if (axis === 'x') {
    doorLane = [-half, EDGE, half, nearest.v - half];
    if (doorLane[3] > doorLane[1] && !fits(-half, EDGE, half, nearest.v - half, 0.2))
      return undefined;
  }

  // Lanes take the stall rows either side of an aisle, so a U-turn at each end swings across the
  // whole aisle: lane centers are a stall depth plus an aisle apart, about the turning circle of a
  // family car. The turnarounds keep the ends of those rows free on every storey.
  let ramp: { ua: number; ub: number; v: number; direction: 1 | -1 } | undefined;
  const lanes = (v: number): [number, number] => [v - half - stallDepth, v + half + stallDepth];
  const byDoor = [...aisles].sort(
    (a, b) => Math.abs(a.v - shift) - Math.abs(b.v - shift) || a.v - b.v,
  );
  search: for (const runPerRise of RUN_PER_RISE) {
    const length = Math.max(rise * runPerRise, MIN_RUN) + 2 * TURNAROUND;
    for (const aisle of byDoor) {
      const [v0, v1] = lanes(aisle.v);
      const starts: number[] = [];
      for (let ua = aisle.lo; ua + length <= aisle.hi; ua += stallWidth) starts.push(ua);
      starts.sort(
        (a, b) => Math.abs(a + length / 2 - crossU) - Math.abs(b + length / 2 - crossU) || a - b,
      );
      for (const ua of starts) {
        const ub = ua + length;
        // Clear of the door's lane, which comes through the near row of the first aisle.
        if (doorLane && ua < doorLane[2] && doorLane[0] < ub && v0 < doorLane[3]) continue;
        if (!fits(ua, v0, ub, v1)) continue;
        // Climbing away from the way in, so the first lane's mouth meets it.
        ramp = { ua, ub, v: aisle.v, direction: (ua + ub) / 2 < crossU ? -1 : 1 };
        break search;
      }
    }
  }
  // Without its ramp a shifted door opens on the end of a row, onto nothing.
  if (shift !== 0 && ramp?.v !== shift) return undefined;
  const ramps: ParkingRamp[] = [];
  const clear: Bounds2[] = doorLane ? [doorLane] : [];
  if (ramp) {
    const { ua, ub, v, direction } = ramp;
    const [v0, v1] = lanes(v);
    clear.push(rect(ua, v0, ub, v1));
    // The door's lane carries on to the far row, to turn straight into the first ramp from it.
    if (doorLane && v === nearest.v && ua < half + TURNAROUND && ub > -half - TURNAROUND)
      clear.push([-half, EDGE, half, v1]);
    // The first lane is the one a driver meets: dead ahead of a shifted door, else the far row,
    // which a lane coming in across the aisle can turn straight into.
    const startHigh = shift <= 0;
    for (let lower = 0; lower + 1 < storeys; lower++) {
      // A scissor: each lane starts where the last one arrived, across the aisle from it.
      const first = lower % 2 === 0;
      ramps.push({
        bounds:
          first === startHigh
            ? rect(ua + TURNAROUND, v + half, ub - TURNAROUND, v1)
            : rect(ua + TURNAROUND, v0, ub - TURNAROUND, v - half),
        lower,
        upper: lower + 1,
        axis,
        climb: first ? direction : direction === 1 ? -1 : 1,
      });
    }
  }
  // Join neighbouring aisles at both ends, which makes a lap of each deck; only a long plate needs
  // to give up more of its stalls to a shortcut through the middle.
  const crossAisles: Bounds2[] = [];
  const lanesUsed = ramps.map((r) => r.bounds);
  for (let i = 0; i + 1 < aisles.length; i++) {
    const a = aisles[i] as (typeof aisles)[number],
      b = aisles[i + 1] as (typeof aisles)[number];
    if (b.v - a.v > row * 1.5) continue;
    const lo = Math.max(a.lo, b.lo) + half,
      hi = Math.min(a.hi, b.hi) - half;
    if (hi < lo) continue;
    const link = (u: number): boolean => {
      const bounds = rect(u - half, a.v + half, u + half, b.v - half);
      if (lanesUsed.some((lane) => overlaps(lane, bounds))) return false;
      if (!fits(u - half, a.v + half, u + half, b.v - half, 0.2)) return false;
      crossAisles.push(bounds);
      return true;
    };
    // A short plate cannot spare both ends, and has no lap to speak of.
    const linked = [link(lo), hi - lo > SHORT_AISLE && link(hi)].some(Boolean);
    if (hi - lo > LONG_AISLE) link((lo + hi) / 2);
    // Ends can be blocked by a notch or the ramp: then the nearest gap that fits.
    for (let reach = stallWidth; !linked && lo + reach < hi; reach += stallWidth)
      if (link(lo + reach)) break;
  }
  const area = (r: Bounds2): number => (r[2] - r[0]) * (r[3] - r[1]);
  const capacity =
    aisles.reduce((sum, a) => sum + (2 * (a.hi - a.lo)) / stallWidth, 0) -
    [...clear, ...crossAisles].reduce((sum, r) => sum + area(r), 0) / (stallWidth * stallDepth) +
    // Worth a few bays: straight in and up, rather than an S-bend inside the door.
    (shift !== 0 ? ALIGNED_DOOR : 0);
  return {
    stallWidth,
    stallDepth,
    aisleWidth,
    axis,
    aisles: aisles.map((a) => rect(a.lo, a.v - half, a.hi, a.v + half)),
    crossAisles,
    clear,
    ramps,
    aprons: [],
    capacity,
  };
}

function centerOn(length: number, width: number, along: number): number {
  return Math.max(width / 2 + 0.5, Math.min(length - width / 2 - 0.5, along));
}

/** Candidate doors: mapped entrances first, or else the walls easiest to reach from the ground. */
function doorCandidates(
  request: BuildingRequest,
  outline: readonly Vec2[],
  holes: Vec2[][],
  floor: number,
  doorWidth: number,
  ground: HeightSampler,
  seams?: ReadonlySet<number>,
): Door[] {
  const walls: { edge: number; length: number; a: Vec2; tangent: Vec2; inward: Vec2 }[] = [];
  for (let edge = 0; edge < outline.length; edge++) {
    if (seams?.has(edge)) continue;
    const a = outline[edge] as Vec2,
      b = outline[(edge + 1) % outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < doorWidth + 1) continue;
    const tangent: Vec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    walls.push({ edge, length, a, tangent, inward: [-tangent[1], tangent[0]] });
  }
  const door = (wall: (typeof walls)[number], along: number): Door => {
    const center = centerOn(wall.length, doorWidth, along);
    return {
      edge: wall.edge,
      length: wall.length,
      center,
      frame: {
        outline: outline as Vec2[],
        holes,
        entrance: [wall.a[0] + wall.tangent[0] * center, wall.a[1] + wall.tangent[1] * center],
        inward: wall.inward,
      },
    };
  };
  const doors: Door[] = [];
  for (const at of request.parking?.entrances ?? []) {
    let best: { wall: (typeof walls)[number]; distance: number } | undefined;
    for (const wall of walls) {
      const b: Vec2 = [
        wall.a[0] + wall.tangent[0] * wall.length,
        wall.a[1] + wall.tangent[1] * wall.length,
      ];
      const distance = distancePointToSegment(at, wall.a, b);
      if (!best || distance < best.distance) best = { wall, distance };
    }
    if (!best || best.distance > 8) continue;
    const { wall } = best;
    const along = (at[0] - wall.a[0]) * wall.tangent[0] + (at[1] - wall.a[1]) * wall.tangent[1];
    const candidate = door(wall, along);
    // Two nodes on one driveway are one door.
    if (
      doors.some(
        (d) =>
          Math.hypot(
            d.frame.entrance[0] - candidate.frame.entrance[0],
            d.frame.entrance[1] - candidate.frame.entrance[1],
          ) <
          doorWidth + 2,
      )
    )
      continue;
    doors.push(candidate);
  }
  if (doors.length > 0) return doors;
  const ranked = walls
    .map((wall) => {
      const mid: Vec2 = [
        wall.a[0] + (wall.tangent[0] * wall.length) / 2 - wall.inward[0] * 2,
        wall.a[1] + (wall.tangent[1] * wall.length) / 2 - wall.inward[1] * 2,
      ];
      const gap = Math.abs(floor - ground.sampleHeight(mid[0], mid[1]));
      return { wall, score: gap * 6 - Math.min(wall.length, 60) * 0.25 };
    })
    .sort((a, b) => a.score - b.score || a.wall.edge - b.wall.edge);
  return ranked.slice(0, 4).map(({ wall }) => door(wall, wall.length / 2));
}

/**
 * Choose doors and a drive layout. Pure and cheap: it tests a few dozen rectangles, leaving stalls
 * to the lazy plan. Returns undefined when the footprint cannot hold even one aisle of stalls.
 */
export function planParkingSite(
  request: BuildingRequest,
  catalog: InteriorCatalogDoc,
  outline: Vec2[],
  holes: Vec2[][],
  floor: number,
  rise: number,
  ground: HeightSampler,
  seams?: ReadonlySet<number>,
): ParkingSitePlan | undefined {
  const parking = request.parking;
  if (!parking || request.clipped || (request.minHeight ?? 0) > 0) return undefined;
  const profile = resolveInteriorProfile(['parking_garage'], catalog);
  if (profile.algorithm !== 'parking') return undefined;
  const stallWidth = profile.moduleWidth,
    stallDepth = profile.moduleDepth,
    aisleWidth = profile.aisleWidth;
  const doorWidth = aisleWidth;
  const storeys = parking.levels + 1;
  const doors = doorCandidates(request, outline, holes, floor, doorWidth, ground, seams);
  let best: { layout: ParkingLayout; door: Door; score: number } | undefined;
  for (const [index, door] of doors.slice(0, 6).entries()) {
    const local = ringBounds(outline.map((p) => interiorToLocal(door.frame, p)));
    const long = local[2] - local[0] >= local[3] - local[1] ? 'x' : 'z';
    const laneOffset = (aisleWidth + stallDepth) / 2;
    for (const [axis, shift] of [
      [long, 0],
      ...(long === 'x' ? [] : [['x', 0] as const]),
      ['z', laneOffset],
      ['z', -laneOffset],
      ...(long === 'z' ? [] : [['z', 0] as const]),
    ] as const) {
      const layout = layoutFor(
        door.frame,
        axis,
        shift,
        storeys,
        rise,
        stallWidth,
        stallDepth,
        aisleWidth,
      );
      if (!layout) continue;
      // Reachable upper decks outrank everything; then capacity; then the mapped order of doors.
      const { capacity, ...plan } = layout;
      const score = (plan.ramps.length > 0 ? 1e6 : 0) + capacity - index * 2;
      if (!best || score > best.score) best = { layout: plan, door, score };
    }
  }
  if (!best) return undefined;
  const { layout, door } = best;
  const chosen: Door[] = [door];
  const reached = (p: Vec2): boolean =>
    [...layout.aisles, ...layout.crossAisles].some(
      (r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3],
    );
  const half = doorWidth / 2;
  for (const other of doors) {
    if (chosen.length >= MAX_DOORS) break;
    if (chosen.some((d) => d === other)) continue;
    // A further door counts only if a straight lane reaches the aisles from it.
    const inward = interiorToLocal(door.frame, [
      door.frame.entrance[0] + other.frame.inward[0],
      door.frame.entrance[1] + other.frame.inward[1],
    ]);
    if (Math.abs(inward[0]) < 0.995 && Math.abs(inward[1]) < 0.995) continue;
    const start = interiorToLocal(door.frame, other.frame.entrance);
    let lane: Bounds2 | undefined;
    for (let depth = 2; depth <= 28; depth += 2) {
      const p: Vec2 = [start[0] + inward[0] * depth, start[1] + inward[1] * depth];
      if (!reached(p)) continue;
      const a: Vec2 = [start[0] + inward[0] * EDGE, start[1] + inward[1] * EDGE];
      const side: Vec2 = [-inward[1] * half, inward[0] * half];
      lane = [
        Math.min(a[0] - side[0], a[0] + side[0], p[0] - side[0], p[0] + side[0]),
        Math.min(a[1] - side[1], a[1] + side[1], p[1] - side[1], p[1] + side[1]),
        Math.max(a[0] - side[0], a[0] + side[0], p[0] - side[0], p[0] + side[0]),
        Math.max(a[1] - side[1], a[1] + side[1], p[1] - side[1], p[1] + side[1]),
      ];
      break;
    }
    if (!lane || !interiorRectFits(door.frame, lane, 0.2)) continue;
    layout.clear.push(lane);
    chosen.push(other);
  }
  const top = layout.ramps.at(-1);
  return {
    layout,
    doors: chosen,
    roofOpening: top ? rectRing(door.frame, top.bounds) : undefined,
  };
}

/** The structural site of a car park whose exterior height is now final. */
export function createParkingSite(
  request: BuildingRequest,
  plan: ParkingSitePlan,
  floor: number,
  storeys: InteriorStorey[],
  ground: HeightSampler,
  seams?: ReadonlySet<number>,
): InteriorSite {
  const primary = plan.doors[0] as Door;
  const { outline, holes } = primary.frame;
  const layout = plan.layout;
  const first = storeys[0] as InteriorStorey;
  const doorWidth = layout.aisleWidth;
  const doors: BuildingOpening[] = plan.doors.map((door) => ({
    edge: door.edge,
    start: door.center - doorWidth / 2,
    end: door.center + doorWidth / 2,
    bottom: floor - 0.06,
    top: floor + Math.min(DOOR_HEIGHT, first.ceiling - first.floor - 0.1),
    kind: 'door',
  }));
  const openings: BuildingOpening[] = [...doors];
  const roofed = storeys.filter((s) => !s.open);
  let pitch = BAY;
  const count = (p: number): number => {
    let total = 0;
    for (let edge = 0; edge < outline.length; edge++) {
      const a = outline[edge] as Vec2,
        b = outline[(edge + 1) % outline.length] as Vec2;
      if (!seams?.has(edge))
        total += Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / p));
    }
    return total * roofed.length;
  };
  while (count(pitch) > MAX_OPENINGS) pitch += BAY;
  for (let edge = 0; edge < outline.length; edge++) {
    if (seams?.has(edge)) continue;
    const a = outline[edge] as Vec2,
      b = outline[(edge + 1) % outline.length] as Vec2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < PIER * 3) continue;
    const bays = Math.max(1, Math.round((length - PIER) / pitch));
    const stride = (length - PIER) / bays;
    for (const [level, storey] of roofed.entries()) {
      const bottom = storey.floor + SPANDREL,
        top = storey.ceiling - BEAM;
      if (top - bottom < 0.5) continue;
      for (let bay = 0; bay < bays; bay++) {
        const start = PIER + bay * stride,
          end = start + stride - PIER;
        if (
          level === 0 &&
          doors.some((d) => d.edge === edge && d.start < end + 0.4 && start < d.end + 0.4)
        )
          continue;
        openings.push({ edge, start, end, bottom, top, kind: 'open' });
      }
    }
  }
  layout.aprons = plan.doors.map((door) => apron(door, doorWidth, floor, ground));
  const roof = storeys.at(-1) as InteriorStorey;
  return {
    identity: request.identity,
    labels: [
      'parking_garage',
      ...(request.interiorLabels ?? []),
      ...request.labels,
      ...(request.context ? [request.context] : []),
    ],
    outline,
    holes,
    bounds: ringBounds(outline),
    floor: floor + 0.04,
    ceiling: first.ceiling,
    storeys,
    entrance: primary.frame.entrance,
    inward: primary.frame.inward,
    openings,
    access: layout.aprons[0] ?? [],
    parking: layout,
    ...(plan.roofOpening
      ? {
          covers: [plan.roofOpening.map((p): Vec3 => [p[0], roof.floor + 0.02, p[1]])],
        }
      : {}),
  };
}

function apron(door: Door, width: number, floor: number, ground: HeightSampler): Vec3[] {
  const { entrance, inward } = door.frame;
  const tangent: Vec2 = [inward[1], -inward[0]];
  const outside = (side: number, depth: number): Vec3 => {
    const x = entrance[0] + tangent[0] * side - inward[0] * depth;
    const z = entrance[1] + tangent[1] * side - inward[1] * depth;
    return [x, depth === 0 ? floor + 0.04 : ground.sampleHeight(x, z) + 0.04, z];
  };
  const gap = Math.abs(floor - outside(0, 3)[1]);
  const depth = Math.min(20, Math.max(3, gap * 6));
  return [
    outside(-width / 2, 0),
    outside(width / 2, 0),
    outside(width / 2, depth),
    outside(-width / 2, depth),
  ];
}
