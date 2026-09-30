/**
 * Node groups → junctions and movements. A node group is a node plus the node it is stitched to
 * across a tile border. For every lane arriving at the group this computes its outgoing
 * movements (turn class, target lane, connector curve), trims lanes back from junction cores, and
 * builds the junction record: arms in angular order, a conflict matrix between arm-pair
 * movements, a control type and signal phase groups.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { connectorLength, laneSample, sampleLaneBody } from './sample';
import type {
  JunctionArm,
  JunctionControl,
  LaneMovement,
  LaneSample,
  TransportClass,
  TransportEdge,
  TransportJunction,
  TransportLane,
  TransportNode,
  TurnKind,
} from './types';

/** What the builder reads from and writes to the network. */
export interface GraphStore {
  readonly traffic: 'right' | 'left';
  node(id: string): TransportNode | undefined;
  edge(id: string): TransportEdge | undefined;
  lane(id: string): TransportLane | undefined;
  junction(id: string): TransportJunction | undefined;
  setJunction(junction: TransportJunction): void;
  deleteJunction(id: string): void;
  /** Whether a mapped traffic-signal point lies within `radius` of a point. */
  signalNear(x: number, z: number, radius: number): boolean;
  /** Stop and yield signs within `radius` of a point. */
  giveWayNear(x: number, z: number, radius: number): readonly { x: number; z: number }[];
}

interface Arm {
  edge: TransportEdge;
  node: TransportNode;
  /** True when the arm leaves the node at the edge path's start. */
  atStart: boolean;
  dx: number;
  dz: number;
}

/** Monotone stand-in for atan2 in [0, 4): orders directions without transcendental math. */
export function pseudoAngle(dx: number, dz: number): number {
  const sum = dmath.abs(dx) + dmath.abs(dz);
  if (sum === 0) return 0;
  const p = dx / sum;
  return dz >= 0 ? 1 - p : 3 + p;
}

function armDirection(edge: TransportEdge, atStart: boolean): [number, number] {
  const path = edge.path;
  const reach = dmath.min(8, path.length / 2);
  const points = path.points;
  const origin = (atStart ? points[0] : points[points.length - 1]) as [number, number];
  // Walk to the point `reach` metres into the edge from this end.
  let target = origin;
  if (atStart) {
    for (let i = 1; i < points.length; i++) {
      target = points[i] as [number, number];
      if ((path.distances[i] as number) >= reach) break;
    }
  } else {
    for (let i = points.length - 2; i >= 0; i--) {
      target = points[i] as [number, number];
      if (path.length - (path.distances[i] as number) >= reach) break;
    }
  }
  const dx = target[0] - origin[0];
  const dz = target[1] - origin[1];
  const length = dmath.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
}

function armsOf(store: GraphStore, group: readonly TransportNode[], cls: TransportClass): Arm[] {
  const arms: Arm[] = [];
  for (const node of group) {
    for (const edgeId of node.edges) {
      const edge = store.edge(edgeId);
      if (edge === undefined) continue;
      let hasClass = false;
      for (const laneId of edge.lanes)
        if (store.lane(laneId)?.class === cls) {
          hasClass = true;
          break;
        }
      if (!hasClass) continue;
      for (const atStart of [true, false]) {
        if ((atStart ? edge.from : edge.to) !== node.id) continue;
        if (arms.some((a) => a.edge === edge && a.atStart === atStart)) continue;
        const [dx, dz] = armDirection(edge, atStart);
        arms.push({ edge, node, atStart, dx, dz });
      }
    }
  }
  arms.sort(
    (a, b) =>
      pseudoAngle(a.dx, a.dz) - pseudoAngle(b.dx, b.dz) ||
      (a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0) ||
      Number(a.atStart) - Number(b.atStart),
  );
  return arms;
}

function lanesAt(
  store: GraphStore,
  arm: Arm,
  cls: TransportClass,
  incoming: boolean,
): TransportLane[] {
  const out: TransportLane[] = [];
  for (const id of arm.edge.lanes) {
    const lane = store.lane(id);
    if (lane === undefined || lane.class !== cls) continue;
    // An arm at the path start receives backward lanes and emits forward lanes.
    const arriving = arm.atStart ? lane.dir === -1 : lane.dir === 1;
    if (arriving === incoming) out.push(lane);
  }
  out.sort((a, b) => a.index - b.index || (a.id < b.id ? -1 : 1));
  return out;
}

function classifyTurn(inDx: number, inDz: number, outDx: number, outDz: number): TurnKind {
  const dot = inDx * outDx + inDz * outDz;
  // +X east, +Z south: a positive cross product turns toward the travel's right.
  const cross = inDx * outDz - inDz * outDx;
  if (dot > 0.7) return 'straight';
  if (dot < -0.9) return 'uturn';
  return cross > 0 ? 'right' : 'left';
}

function segmentsCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = dx - cx;
  const sz = dz - cz;
  const denom = rx * sz - rz * sx;
  if (dmath.abs(denom) < 1e-12) return false;
  const wx = cx - ax;
  const wz = cz - az;
  const t = (wx * sz - wz * sx) / denom;
  const u = (wx * rz - wz * rx) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

interface EndPoint {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
}

/** Lane end/start samples for one rebuild (every connector at a node reuses them). */
class EndCache {
  private readonly ends = new Map<string, EndPoint>();
  private readonly starts = new Map<string, EndPoint>();
  private readonly scratch: LaneSample = laneSample();
  constructor(private readonly store: GraphStore) {}

  private take(lane: TransportLane, s: number): EndPoint | undefined {
    const edge = this.store.edge(lane.edge);
    if (edge === undefined) return undefined;
    const p = sampleLaneBody(lane, edge, s, this.scratch);
    return { x: p.x, y: p.y, z: p.z, dx: p.dx, dz: p.dz };
  }

  end(lane: TransportLane): EndPoint | undefined {
    let p = this.ends.get(lane.id);
    if (p === undefined) {
      p = this.take(lane, lane.length);
      if (p !== undefined) this.ends.set(lane.id, p);
    }
    return p;
  }

  start(lane: TransportLane): EndPoint | undefined {
    let p = this.starts.get(lane.id);
    if (p === undefined) {
      p = this.take(lane, 0);
      if (p !== undefined) this.starts.set(lane.id, p);
    }
    return p;
  }
}

function roadWeight(turn: TurnKind, target: TransportEdge): number {
  const base =
    turn === 'straight'
      ? 3
      : turn === 'right'
        ? 2
        : turn === 'left'
          ? 1.5
          : turn === 'merge'
            ? 2
            : 0.05;
  const kind =
    target.kind === 'service' || target.kind === 'living' ? 0.25 : target.speed >= 15 ? 1.4 : 1;
  return base * kind;
}

const MAX_CONFLICT_ARMS = 8;

/**
 * Rebuild trims, movements and the junction record for a node group. Call it for every group
 * whose incident edges or stitching changed.
 */
export function rebuildNodeGroup(store: GraphStore, nodeIds: readonly string[]): void {
  const group = nodeIds
    .map((id) => store.node(id))
    .filter((n): n is TransportNode => n !== undefined);
  if (group.length === 0) return;
  const groupIds = new Set(group.map((n) => n.id));
  const junctionId = [...groupIds].sort()[0] as string;
  for (const id of groupIds) if (id !== junctionId) store.deleteJunction(id);

  const roadArms = armsOf(store, group, 'road');
  const isJunction = roadArms.length >= 3;
  let maxWidth = 0;
  for (const arm of roadArms) maxWidth = dmath.max(maxWidth, arm.edge.width);
  const radius = isJunction ? dmath.min(18, maxWidth / 2 + 1.5) : 0;

  // Trim lanes on road edges back from the core (sidewalks included, so crossings form).
  const touched = new Set<TransportEdge>();
  for (const node of group)
    for (const edgeId of node.edges) {
      const edge = store.edge(edgeId);
      if (edge !== undefined) touched.add(edge);
    }
  for (const edge of touched) {
    const trim = edge.class === 'road' ? dmath.min(radius, edge.path.length * 0.45) : 0;
    for (const laneId of edge.lanes) {
      const lane = store.lane(laneId);
      if (lane === undefined) continue;
      // Forward lanes start at `from`; the lane end at this group gets the trim.
      const startHere = groupIds.has(lane.dir === 1 ? edge.from : edge.to);
      const endHere = groupIds.has(lane.dir === 1 ? edge.to : edge.from);
      if (startHere) lane.trimStart = trim;
      if (endHere) lane.trimEnd = trim;
      lane.length = dmath.max(0.1, edge.path.length - lane.trimStart - lane.trimEnd);
    }
  }

  // Junction record.
  let junction: TransportJunction | undefined;
  if (isJunction) {
    junction = buildJunction(store, junctionId, group, roadArms, radius);
    store.setJunction(junction);
  } else {
    store.deleteJunction(junctionId);
  }

  const cache = new EndCache(store);
  buildRoadMovements(store, cache, roadArms, junction);
  buildRailMovements(store, cache, armsOf(store, group, 'rail'));
  buildWalkMovements(store, cache, armsOf(store, group, 'walk'), roadArms, junction, maxWidth);
}

function buildJunction(
  store: GraphStore,
  id: string,
  group: readonly TransportNode[],
  arms: readonly Arm[],
  radius: number,
): TransportJunction {
  let cx = 0;
  let cz = 0;
  for (const node of group) {
    cx += node.x;
    cz += node.z;
  }
  cx /= group.length;
  cz /= group.length;
  const n = arms.length;
  const side = store.traffic === 'right' ? 1 : -1;
  // Each arm has an entry and an exit point on the core's rim; movements are chords between
  // them and two movements conflict when their chords cross.
  const rim: { angle: number; arm: number; exit: boolean }[] = [];
  arms.forEach((arm, k) => {
    const bx = arm.node.x + arm.dx * radius - cx;
    const bz = arm.node.z + arm.dz * radius - cz;
    const q = arm.edge.width / 4;
    // Right of the inbound travel (-dir) is (dz, -dx); right of outbound (dir) is (-dz, dx).
    rim.push({
      angle: pseudoAngle(bx + side * arm.dz * q, bz - side * arm.dx * q),
      arm: k,
      exit: false,
    });
    rim.push({
      angle: pseudoAngle(bx - side * arm.dz * q, bz + side * arm.dx * q),
      arm: k,
      exit: true,
    });
  });
  rim.sort((a, b) => a.angle - b.angle || a.arm - b.arm || Number(a.exit) - Number(b.exit));
  const entryPos = new Array<number>(n).fill(0);
  const exitPos = new Array<number>(n).fill(0);
  rim.forEach((p, i) => {
    if (p.exit) exitPos[p.arm] = i;
    else entryPos[p.arm] = i;
  });
  const m = rim.length;
  const between = (x: number, a: number, b: number): boolean =>
    x !== a && (x - a + m) % m < (b - a + m) % m;
  const keys = n * n;
  const conflicts = new Uint8Array(keys * keys);
  const capped = n > MAX_CONFLICT_ARMS;
  for (let i1 = 0; i1 < n; i1++)
    for (let o1 = 0; o1 < n; o1++)
      for (let i2 = 0; i2 < n; i2++)
        for (let o2 = 0; o2 < n; o2++) {
          const a = i1 * n + o1;
          const b = i2 * n + o2;
          let conflict: boolean;
          if (i1 === i2) conflict = false;
          else if (capped || o1 === o2 || i1 === o1 || i2 === o2) conflict = true;
          else {
            const p = entryPos[i1] as number;
            const q = exitPos[o1] as number;
            conflict =
              between(entryPos[i2] as number, p, q) !== between(exitPos[o2] as number, p, q);
          }
          conflicts[a * keys + b] = conflict ? 1 : 0;
        }

  // Opposing arms share a signal phase.
  const junctionArms: JunctionArm[] = arms.map((arm) => ({
    edge: arm.edge.id,
    node: arm.node.id,
    dx: arm.dx,
    dz: arm.dz,
    width: arm.edge.width,
    kind: arm.edge.kind,
    link: arm.edge.link,
    group: -1,
  }));
  let groups = 0;
  for (let i = 0; i < n; i++) {
    const arm = junctionArms[i] as JunctionArm;
    if (arm.group >= 0) continue;
    arm.group = groups;
    let best = -1;
    let bestDot = -0.7;
    for (let j = i + 1; j < n; j++) {
      const other = junctionArms[j] as JunctionArm;
      if (other.group >= 0) continue;
      const dot = arm.dx * other.dx + arm.dz * other.dz;
      if (dot < bestDot) {
        bestDot = dot;
        best = j;
      }
    }
    if (best >= 0) (junctionArms[best] as JunctionArm).group = groups;
    groups++;
  }

  const major = arms.some(
    (a) =>
      a.edge.width >= 10 ||
      a.edge.kind === 'trunk' ||
      a.edge.kind === 'primary' ||
      a.edge.kind === 'secondary' ||
      a.edge.kind === 'tertiary',
  );
  const minor = arms.filter(
    (a) => a.edge.kind === 'service' || a.edge.kind === 'living' || a.edge.link,
  ).length;
  // A stop or yield sign makes the arm it stands on give way.
  let signed = 0;
  for (const sign of store.giveWayNear(cx, cz, radius + 20)) {
    const sx = sign.x - cx;
    const sz = sign.z - cz;
    const length = dmath.hypot(sx, sz);
    let best: JunctionArm | undefined;
    let bestDot = Number.NEGATIVE_INFINITY;
    for (const arm of junctionArms) {
      const dot = length > 1e-6 ? (arm.dx * sx + arm.dz * sz) / length : 0;
      if (dot > bestDot) {
        bestDot = dot;
        best = arm;
      }
    }
    if (best !== undefined && best.yields !== true) {
      best.yields = true;
      signed++;
    }
  }
  let control: JunctionControl = 'none';
  if (groups >= 2 && ((n >= 4 && major) || store.signalNear(cx, cz, radius + 20)))
    control = 'signal';
  else if ((minor > 0 && minor < n) || (signed > 0 && signed < n)) control = 'yield';
  return {
    id,
    x: cx,
    z: cz,
    nodes: group.map((node) => node.id),
    arms: junctionArms,
    control,
    radius,
    conflicts,
    groups,
  };
}

function movement(
  cache: EndCache,
  from: TransportLane,
  to: TransportLane,
  turn: TurnKind,
  weight: number,
  junction: TransportJunction | undefined,
  key: number,
  crosses?: number[],
): LaneMovement | undefined {
  const a = cache.end(from);
  const b = cache.start(to);
  if (a === undefined || b === undefined) return undefined;
  const wx = b.x - a.x;
  const wz = b.z - a.z;
  const span = dmath.hypot(wx, wz);
  const cross = a.dx * b.dz - a.dz * b.dx;
  let p1: [number, number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
  if (dmath.abs(cross) > 0.05 && span > 0.01) {
    const t = (wx * b.dz - wz * b.dx) / cross;
    if (t > 0 && t < span * 2) p1 = [a.x + a.dx * t, (a.y + b.y) / 2, a.z + a.dz * t];
  }
  const p0: [number, number, number] = [a.x, a.y, a.z];
  const p2: [number, number, number] = [b.x, b.y, b.z];
  const move: Mutable<LaneMovement> = {
    to: to.id,
    turn,
    key,
    weight,
    p0,
    p1,
    p2,
    length: span < 1e-4 ? 0 : connectorLength(p0, p1, p2),
  };
  if (junction !== undefined) move.junction = junction.id;
  if (crosses !== undefined && crosses.length > 0) move.crosses = crosses;
  return move;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function buildRoadMovements(
  store: GraphStore,
  cache: EndCache,
  arms: readonly Arm[],
  junction: TransportJunction | undefined,
): void {
  const n = arms.length;
  const left = store.traffic === 'left';
  arms.forEach((inArm, i) => {
    const incoming = lanesAt(store, inArm, 'road', true);
    const nIn = incoming.length;
    for (const lane of incoming) {
      const moves: LaneMovement[] = [];
      const inDx = -inArm.dx;
      const inDz = -inArm.dz;
      const fallback: { lane: TransportLane; turn: TurnKind; o: number }[] = [];
      arms.forEach((outArm, o) => {
        if (outArm === inArm) return;
        const outgoing = lanesAt(store, outArm, 'road', false);
        const k = outgoing.length;
        if (k === 0) return;
        let turn = classifyTurn(inDx, inDz, outArm.dx, outArm.dz);
        if (turn === 'uturn') return;
        if (n === 2) turn = 'straight';
        const nearest = outgoing[dmath.min(lane.index, k - 1)] as TransportLane;
        fallback.push({ lane: nearest, turn, o });
        const outer = lane.index === nIn - 1;
        const inner = lane.index === 0;
        const nearSide = left ? 'left' : 'right';
        let target: TransportLane | undefined;
        if (turn === 'straight') target = nearest;
        else if (turn === nearSide && outer) target = outgoing[k - 1];
        else if (turn !== nearSide && inner) target = outgoing[0];
        if (target === undefined) return;
        const moveTurn: TurnKind = inArm.edge.link && turn === 'straight' ? 'merge' : turn;
        const move = movement(
          cache,
          lane,
          target,
          moveTurn,
          roadWeight(moveTurn, outArm.edge),
          n >= 3 ? junction : undefined,
          i * n + o,
        );
        if (move !== undefined) moves.push(move);
      });
      if (moves.length === 0)
        for (const f of fallback) {
          const move = movement(
            cache,
            lane,
            f.lane,
            f.turn,
            roadWeight(f.turn, store.edge(f.lane.edge) ?? inArm.edge),
            n >= 3 ? junction : undefined,
            i * n + f.o,
          );
          if (move !== undefined) moves.push(move);
        }
      if (moves.length === 0) {
        // Dead end: turn around onto the innermost lane back along the same edge.
        const back = lanesAt(store, inArm, 'road', false)[0];
        if (back !== undefined) {
          const move = movement(cache, lane, back, 'uturn', 0.05, undefined, i * n + i);
          if (move !== undefined) moves.push(move);
        }
      }
      lane.next = moves;
    }
  });
}

function buildRailMovements(store: GraphStore, cache: EndCache, arms: readonly Arm[]): void {
  for (const inArm of arms) {
    for (const lane of lanesAt(store, inArm, 'rail', true)) {
      const moves: LaneMovement[] = [];
      for (const outArm of arms) {
        if (outArm === inArm) continue;
        const dot = -inArm.dx * outArm.dx + -inArm.dz * outArm.dz;
        if (dot < 0.3) continue;
        for (const target of lanesAt(store, outArm, 'rail', false)) {
          const move = movement(cache, lane, target, 'straight', dot > 0.9 ? 1 : 0.5, undefined, 0);
          if (move !== undefined) moves.push(move);
        }
      }
      if (moves.length === 0) {
        const back = lanesAt(store, inArm, 'rail', false)[0];
        if (back !== undefined) {
          const move = movement(cache, lane, back, 'uturn', 1, undefined, 0);
          if (move !== undefined) moves.push(move);
        }
      }
      lane.next = moves;
    }
  }
}

function buildWalkMovements(
  store: GraphStore,
  cache: EndCache,
  arms: readonly Arm[],
  roadArms: readonly Arm[],
  junction: TransportJunction | undefined,
  maxRoadWidth: number,
): void {
  const reach = junction !== undefined ? maxRoadWidth + 6 : 3.5;
  const radius = junction?.radius ?? 0;
  const outgoing = new Map<Arm, TransportLane[]>();
  for (const arm of arms) outgoing.set(arm, lanesAt(store, arm, 'walk', false));
  for (const inArm of arms) {
    for (const lane of lanesAt(store, inArm, 'walk', true)) {
      const edge = store.edge(lane.edge);
      const end = cache.end(lane);
      if (edge === undefined || end === undefined) continue;
      const ex = end.x;
      const ez = end.z;
      const moves: LaneMovement[] = [];
      let reverse: TransportLane | undefined;
      let reverseDistance = Number.POSITIVE_INFINITY;
      for (const outArm of arms) {
        for (const target of outgoing.get(outArm) ?? []) {
          const start = cache.start(target);
          if (start === undefined) continue;
          const distance = dmath.hypot(start.x - ex, start.z - ez);
          const sameSide =
            edge.class !== 'road' ||
            dmath.sign(target.dir * target.offset) === dmath.sign(lane.dir * lane.offset);
          if (outArm === inArm && sameSide) {
            // Back along the same footway: only as a last resort.
            if (distance < reverseDistance) {
              reverseDistance = distance;
              reverse = target;
            }
            continue;
          }
          if (distance > reach) continue;
          const crosses: number[] = [];
          roadArms.forEach((roadArm, k) => {
            const tip = radius + roadArm.edge.width + 2;
            if (
              segmentsCross(
                ex,
                ez,
                start.x,
                start.z,
                roadArm.node.x,
                roadArm.node.z,
                roadArm.node.x + roadArm.dx * tip,
                roadArm.node.z + roadArm.dz * tip,
              )
            )
              crosses.push(k);
          });
          if (crosses.length > 1) continue;
          if (crosses.length > 0 && junction === undefined) continue;
          const turn = classifyTurn(-inArm.dx, -inArm.dz, outArm.dx, outArm.dz);
          const move = movement(
            cache,
            lane,
            target,
            turn,
            crosses.length > 0 ? 0.6 : 1,
            crosses.length > 0 ? junction : undefined,
            crosses[0] ?? 0,
            crosses,
          );
          if (move !== undefined) moves.push(move);
        }
      }
      if (moves.length === 0 && reverse !== undefined) {
        const move = movement(cache, lane, reverse, 'uturn', 0.05, undefined, 0);
        if (move !== undefined) moves.push(move);
      }
      lane.next = moves;
    }
  }
}
