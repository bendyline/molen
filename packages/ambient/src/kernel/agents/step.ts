/**
 * The per-tick agent step. Everything it needs is rebuilt from components each tick (lane
 * occupancy, junction grants, armed crossings), so world state plus the network fully determine
 * the next tick and a keyframe restores exactly.
 *
 * Order: gather → occupancy → armed crossings → junction grants → cars → pedestrians → trains
 * (leads, then their cars) → aircraft → write changed agents and transforms.
 */

import { dmath, lookRotation, type Quat } from '@bendyline/molen-kernel/determinism';
import { Transform, type TransformData, type World } from '@bendyline/molen-kernel/world';
import { AmbientAgent, type AmbientAgentData } from '../components';
import type { TransportNetwork } from '../graph/network';
import {
  laneCoordinate,
  laneEdgeDistance,
  laneSample,
  sampleConnector,
  sampleLaneBody,
} from '../graph/sample';
import type {
  LaneMovement,
  LaneSample,
  TransportEdge,
  TransportJunction,
  TransportLane,
} from '../graph/types';
import { fnv1a, q4, unit01 } from '../ids';
import type { AmbientPolicy } from '../spawn/policy';
import { idmAcceleration, stoppingDistance } from './idm';
import { allRed, type SignalTiming, signalColor, signalTiming } from './signals';

/** A solid thing agents must not drive into (the player's car, a parked aircraft). */
export interface AmbientSolid {
  x: number;
  z: number;
  radius: number;
}

export interface AgentEnv {
  net: TransportNetwork;
  policy: AmbientPolicy;
  tick: number;
  tickRate: number;
  dt: number;
  /** Solids cars yield to (queried from the world by the caller). */
  solids: readonly AmbientSolid[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Ref {
  id: string;
  a: Readonly<AmbientAgentData>;
  w: Mutable<AmbientAgentData>;
  lane: TransportLane | undefined;
  edge: TransportEdge | undefined;
  slot: number;
  teleport: boolean;
}

const TURN_SPEED: Readonly<Record<string, number>> = {
  left: 7,
  right: 5.5,
  uturn: 3,
  merge: 12,
  straight: 99,
};

const timings = new WeakMap<TransportJunction, SignalTiming>();
function timingOf(junction: TransportJunction, tickRate: number): SignalTiming {
  let timing = timings.get(junction);
  if (timing === undefined) {
    timing = signalTiming(junction, tickRate);
    timings.set(junction, timing);
  }
  return timing;
}

/** Pick the next lane at a lane's end (seeded by the agent and its hop count). */
export function chooseNext(lane: TransportLane, seed: number, hops: number): string | undefined {
  const moves = lane.next;
  if (moves.length === 0) return undefined;
  if (moves.length === 1) return (moves[0] as LaneMovement).to;
  let total = 0;
  for (const move of moves) total += move.weight;
  let target = unit01(seed, 1000 + hops) * total;
  for (const move of moves) {
    target -= move.weight;
    if (target < 0) return move.to;
  }
  return (moves[moves.length - 1] as LaneMovement).to;
}

/** Where an agent is: its lane body, or the connector curve into its lane. */
export function agentSample(
  net: TransportNetwork,
  agent: Readonly<AmbientAgentData>,
  out: LaneSample,
): LaneSample | undefined {
  if (agent.air !== undefined) {
    const air = agent.air;
    const t = air.length > 0 ? dmath.clamp(agent.s / air.length, 0, 1) : 0;
    out.x = air.x + air.dx * agent.s;
    out.z = air.z + air.dz * agent.s;
    out.y = air.y0 + (air.y1 - air.y0) * t;
    out.dx = air.dx;
    out.dz = air.dz;
    out.grade = air.length > 0 ? (air.y1 - air.y0) / air.length : 0;
    return out;
  }
  const lane = net.lane(agent.lane);
  if (lane === undefined) return undefined;
  const edge = net.edge(lane.edge);
  if (edge === undefined) return undefined;
  if (agent.s < 0) {
    const move = net.movement(agent.prev, agent.lane);
    if (move !== undefined && move.length > 0)
      return sampleConnector(move, (agent.s + move.length) / move.length, out);
    return sampleLaneBody(lane, edge, 0, out);
  }
  return sampleLaneBody(lane, edge, agent.s, out);
}

/** Rotation for an agent facing along a sample (with pitch unless flat). */
export function agentRotation(sample: LaneSample, pitch: boolean): Quat {
  return lookRotation([sample.dx, pitch ? sample.grade : 0, sample.dz]);
}

/** Advance every ambient agent one tick. */
export function stepAgents(world: World, env: AgentEnv): void {
  const { net } = env;
  const refs: Ref[] = [];
  for (const [id, a] of world.query(AmbientAgent)) {
    const lane = a.air === undefined ? net.lane(a.lane) : undefined;
    refs.push({
      id,
      a,
      w: { ...a },
      lane,
      edge: lane !== undefined ? net.edge(lane.edge) : undefined,
      slot: 0,
      teleport: false,
    });
  }

  // Lane occupancy, sorted by position along the lane.
  const occupancy = new Map<string, Ref[]>();
  for (const ref of refs) {
    if (ref.lane === undefined) continue;
    const list = occupancy.get(ref.lane.id);
    if (list === undefined) occupancy.set(ref.lane.id, [ref]);
    else list.push(ref);
  }
  for (const list of occupancy.values()) {
    list.sort((x, y) => x.a.s - y.a.s || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    list.forEach((ref, i) => {
      ref.slot = i;
    });
  }

  // Pedestrians on crossings and trains near level crossings arm road stops; pedestrians on
  // junction crossings block car movements into and out of the crossed arm.
  const armed = new Set<string>();
  const crossingArms = new Map<string, Set<number>>();
  for (const ref of refs) {
    const { a, lane, edge } = ref;
    if (lane === undefined || edge === undefined) continue;
    if (a.kind === 'pedestrian') {
      if (a.s < 0) {
        const move = net.movement(a.prev, a.lane);
        if (move?.junction !== undefined && move.crosses !== undefined) {
          let arms = crossingArms.get(move.junction);
          if (arms === undefined) {
            arms = new Set();
            crossingArms.set(move.junction, arms);
          }
          for (const k of move.crosses) arms.add(k);
        }
      }
      if (edge.kind === 'crossing') for (const c of net.crossingsOf(edge.id)) armed.add(c.id);
    } else if (a.kind === 'train') {
      const d = laneEdgeDistance(lane, edge, a.s);
      for (const c of net.crossingsOf(edge.id))
        if (c.kind === 'level-crossing' && dmath.abs(d - c.otherS) < 90) armed.add(c.id);
    }
  }

  const granted = junctionGrants(refs, crossingArms, env);
  const consistSize = new Map<string, number>();
  for (const ref of refs)
    if (ref.a.consist !== undefined)
      consistSize.set(ref.a.consist, (consistSize.get(ref.a.consist) ?? 0) + 1);

  for (const ref of refs) {
    if (ref.lane === undefined || ref.edge === undefined) continue;
    if (ref.a.kind === 'car') stepRoad(ref, occupancy, granted, armed, env);
    else if (ref.a.kind === 'pedestrian') stepWalker(ref, occupancy, env);
    else if (ref.a.kind === 'train' && ref.a.consist === undefined)
      stepTrainLead(ref, occupancy, env, consistSize.get(ref.id) ?? 0);
  }
  // Train cars follow their (already moved) lead.
  const byId = new Map<string, Ref>();
  for (const ref of refs) byId.set(ref.id, ref);
  for (const ref of refs) {
    if (ref.a.kind !== 'train' || ref.a.consist === undefined) continue;
    const lead = byId.get(ref.a.consist);
    if (lead !== undefined) placeTrainCar(ref, lead, env);
  }
  for (const ref of refs) if (ref.a.air !== undefined) stepAircraft(ref, env);

  // Write back what changed.
  const sample = laneSample();
  for (const ref of refs) {
    const { a, w } = ref;
    w.s = q4(w.s);
    w.speed = q4(w.speed);
    if (!agentChanged(a, w) && !ref.teleport) continue;
    world.set(ref.id, AmbientAgent, w);
    if (agentSample(net, w, sample) === undefined) continue;
    const current = world.get(ref.id, Transform);
    const pos: [number, number, number] = [q4(sample.x), q4(sample.y), q4(sample.z)];
    const rot = agentRotation(sample, w.kind !== 'pedestrian');
    const next: TransformData = {
      pos,
      rot: [q4(rot[0]), q4(rot[1]), q4(rot[2]), q4(rot[3])],
      ...(current?.scale !== undefined ? { scale: current.scale } : {}),
      ...(ref.teleport ? { teleport: true } : {}),
    };
    world.set(ref.id, Transform, next);
  }
}

function agentChanged(a: Readonly<AmbientAgentData>, w: AmbientAgentData): boolean {
  return (
    a.s !== w.s ||
    a.speed !== w.speed ||
    a.lane !== w.lane ||
    a.state !== w.state ||
    a.next !== w.next ||
    a.prev !== w.prev ||
    a.served !== w.served ||
    a.hidden !== w.hidden ||
    a.trail !== w.trail
  );
}

function setState(
  w: Mutable<AmbientAgentData>,
  state: AmbientAgentData['state'],
  tick: number,
): void {
  if (w.state !== state) {
    w.state = state;
    w.since = tick;
  }
}

/** Move to the next lane(s) while `s` runs past the lane end. */
function advanceLanes(ref: Ref, env: AgentEnv): void {
  const { net } = env;
  const w = ref.w;
  let lane = ref.lane as TransportLane;
  for (let guard = 0; guard < 8 && w.s >= lane.length; guard++) {
    if (w.next === undefined) {
      w.s = lane.length;
      w.speed = 0;
      return;
    }
    const move = net.movement(lane.id, w.next);
    const nextLane = net.lane(w.next);
    if (move === undefined || nextLane === undefined) {
      delete w.next;
      w.s = lane.length;
      w.speed = 0;
      return;
    }
    w.s = w.s - lane.length - move.length;
    if (w.kind === 'train' && w.consist === undefined)
      w.trail = [lane.id, ...(w.trail ?? [])].slice(0, 6);
    w.prev = lane.id;
    w.lane = nextLane.id;
    w.hops += 1;
    const chosen = chooseNext(nextLane, w.seed, w.hops);
    if (chosen === undefined) delete w.next;
    else w.next = chosen;
    lane = nextLane;
    ref.lane = nextLane;
    ref.edge = net.edge(nextLane.edge);
    if (ref.edge !== undefined) {
      if (ref.edge.tunnel) w.hidden = true;
      else delete w.hidden;
    }
  }
}

interface Approach {
  ref: Ref;
  move: LaneMovement;
  distance: number;
  committed: boolean;
  minor: boolean;
}

function junctionGrants(
  refs: readonly Ref[],
  crossingArms: ReadonlyMap<string, Set<number>>,
  env: AgentEnv,
): Set<string> {
  const { net, policy } = env;
  const occupied = new Map<string, number[]>();
  const approaches = new Map<string, Approach[]>();
  for (const ref of refs) {
    const { a, lane } = ref;
    if (a.kind !== 'car' || lane === undefined) continue;
    if (a.s < 0) {
      const inMove = net.movement(a.prev, a.lane);
      if (inMove?.junction !== undefined) {
        const list = occupied.get(inMove.junction);
        if (list === undefined) occupied.set(inMove.junction, [inMove.key]);
        else list.push(inMove.key);
      }
    }
    if (a.next === undefined) continue;
    const move = net.movement(a.lane, a.next);
    if (move?.junction === undefined) continue;
    const distance = lane.length - a.s - a.length / 2;
    const horizon = stoppingDistance(a.speed, policy.driver.brake) + a.speed * 2 + 6;
    if (distance > horizon) continue;
    const committed = distance < stoppingDistance(a.speed, policy.driver.brake * 1.6) - 0.2;
    const inEdge = ref.edge;
    const minor =
      inEdge !== undefined &&
      (inEdge.kind === 'service' || inEdge.kind === 'living' || inEdge.link);
    const list = approaches.get(move.junction);
    const entry = { ref, move, distance, committed, minor };
    if (list === undefined) approaches.set(move.junction, [entry]);
    else list.push(entry);
  }
  const granted = new Set<string>();
  const deadlockTicks = policy.deadlockSeconds * env.tickRate;
  for (const id of [...approaches.keys()].sort()) {
    const junction = net.junction(id);
    const list = approaches.get(id) as Approach[];
    if (junction === undefined) {
      for (const entry of list) granted.add(entry.ref.id);
      continue;
    }
    const n = junction.arms.length;
    const keys = n * n;
    const inside = occupied.get(id) ?? [];
    const taken = [...inside];
    const walkers = crossingArms.get(id);
    const timing = junction.control === 'signal' ? timingOf(junction, env.tickRate) : undefined;
    const penalty = junction.control === 'yield' ? 25 : 0;
    const gives = (x: Approach): number =>
      x.minor || junction.arms[dmath.floor(x.move.key / n)]?.yields === true ? penalty : 0;
    list.sort(
      (x, y) =>
        Number(y.committed) - Number(x.committed) ||
        x.distance + gives(x) - (y.distance + gives(y)) ||
        (x.ref.id < y.ref.id ? -1 : 1),
    );
    const conflictsWith = (set: readonly number[], key: number): boolean => {
      for (const other of set) if (junction.conflicts[other * keys + key] === 1) return true;
      return false;
    };
    for (const entry of list) {
      const key = entry.move.key;
      const inArm = dmath.floor(key / n);
      const outArm = key % n;
      if (entry.committed) {
        granted.add(entry.ref.id);
        taken.push(key);
        continue;
      }
      let signalOk = true;
      if (timing !== undefined) {
        const arm = junction.arms[inArm];
        signalOk =
          arm !== undefined &&
          signalColor(junction, arm.group, env.tick, env.tickRate, timing) === 'green';
      }
      const blocked = walkers !== undefined && (walkers.has(outArm) || walkers.has(inArm));
      let ok = signalOk && !blocked && !conflictsWith(taken, key);
      if (
        !ok &&
        signalOk &&
        !blocked &&
        entry.ref.a.state === 'wait' &&
        env.tick - entry.ref.a.since > deadlockTicks &&
        !conflictsWith(inside, key)
      )
        ok = true;
      if (ok) {
        granted.add(entry.ref.id);
        taken.push(key);
      }
    }
  }
  return granted;
}

function leaderOnLane(ref: Ref, occupancy: ReadonlyMap<string, Ref[]>): Ref | undefined {
  const list = occupancy.get(ref.a.lane);
  if (list === undefined) return undefined;
  return list[ref.slot + 1];
}

function firstOnLane(laneId: string, occupancy: ReadonlyMap<string, Ref[]>): Ref | undefined {
  return occupancy.get(laneId)?.[0];
}

function stepRoad(
  ref: Ref,
  occupancy: ReadonlyMap<string, Ref[]>,
  granted: ReadonlySet<string>,
  armed: ReadonlySet<string>,
  env: AgentEnv,
): void {
  const { net, policy, dt } = env;
  const { a, w } = ref;
  const lane = ref.lane as TransportLane;
  const edge = ref.edge as TransportEdge;
  const p = policy.driver;
  const factor = 0.88 + 0.24 * unit01(a.seed, 1);
  let v0 = edge.speed * factor;
  const remaining = lane.length - a.s;
  const move = a.next !== undefined ? net.movement(a.lane, a.next) : undefined;
  if (move !== undefined && remaining < 35)
    v0 = dmath.min(v0, (TURN_SPEED[move.turn] ?? 99) + dmath.max(0, remaining - 8) * 0.3);
  if (a.s < 0) {
    const inMove = net.movement(a.prev, a.lane);
    if (inMove !== undefined) v0 = dmath.min(v0, TURN_SPEED[inMove.turn] ?? 99);
  }
  // Curvature ahead on the lane body.
  if (a.s >= 0 && remaining > 4) {
    const here = sampleLaneBody(lane, edge, a.s, scratchA);
    const hx = here.dx;
    const hz = here.dz;
    const ahead = sampleLaneBody(lane, edge, dmath.min(lane.length, a.s + 12), scratchB);
    const dot = dmath.clamp(hx * ahead.dx + hz * ahead.dz, -1, 1);
    if (dot < 0.995) {
      const angle = dmath.acos(dot);
      const radius = 12 / dmath.max(angle, 1e-3);
      v0 = dmath.min(v0, dmath.sqrt(2.5 * radius));
    }
  }

  let gap = Number.POSITIVE_INFINITY;
  let leaderSpeed = 0;
  let hardLimit = Number.POSITIVE_INFINITY;
  const leader = leaderOnLane(ref, occupancy);
  if (leader !== undefined) {
    gap = leader.a.s - a.s - (leader.a.length + a.length) / 2;
    leaderSpeed = leader.a.speed;
    hardLimit = leader.a.s - (leader.a.length + a.length) / 2 - 0.3;
  } else if (a.next === undefined || move === undefined) {
    gap = remaining - a.length / 2;
    hardLimit = lane.length;
  } else if (move.junction !== undefined && !granted.has(ref.id)) {
    gap = remaining - a.length / 2 - 0.5;
    hardLimit = dmath.max(a.s, lane.length - a.length / 2 - 0.2);
  } else {
    const next = firstOnLane(a.next, occupancy);
    if (next !== undefined) {
      gap = remaining + move.length + next.a.s - (next.a.length + a.length) / 2;
      leaderSpeed = next.a.speed;
    }
  }
  // Armed crossings (pedestrians on a crossing, a train at a level crossing) ahead on this lane.
  for (const stop of lane.stops) {
    if (!armed.has(stop.id)) continue;
    const at = laneCoordinate(lane, edge, stop.d);
    const ahead = at - a.s - a.length / 2;
    if (ahead < -0.5 || ahead > 60) continue;
    const g = ahead - 3;
    if (g < gap) {
      gap = g;
      leaderSpeed = 0;
    }
  }
  // Solids (the player's car) near the lane ahead.
  if (env.solids.length > 0) {
    const here = agentSample(net, a, scratchA);
    if (here !== undefined)
      for (const solid of env.solids) {
        const rx = solid.x - here.x;
        const rz = solid.z - here.z;
        const forward = rx * here.dx + rz * here.dz;
        if (forward <= 0 || forward > 40) continue;
        const lateral = dmath.abs(rx * here.dz - rz * here.dx);
        if (lateral > a.width / 2 + solid.radius + 0.3) continue;
        const g = forward - a.length / 2 - solid.radius;
        if (g < gap) {
          gap = g;
          leaderSpeed = 0;
        }
      }
  }

  const accel = idmAcceleration(a.speed, v0, gap, a.speed - leaderSpeed, p);
  let v = dmath.max(0, a.speed + accel * dt);
  let s = a.s + v * dt;
  if (s > hardLimit) {
    s = dmath.max(a.s, hardLimit);
    v = dmath.min(v, leaderSpeed);
  }
  w.s = s;
  w.speed = v;
  advanceLanes(ref, env);
  setState(w, w.speed < 0.1 ? 'wait' : 'move', env.tick);
}

const scratchA: LaneSample = laneSample();
const scratchB: LaneSample = laneSample();

/** Whether a pedestrian may start across a crossing movement or a mapped crossing. */
function crossingClear(
  move: LaneMovement,
  occupancy: ReadonlyMap<string, Ref[]>,
  env: AgentEnv,
  walkerSpeed: number,
): boolean {
  const { net } = env;
  const nextLane = net.lane(move.to);
  const nextEdge = nextLane !== undefined ? net.edge(nextLane.edge) : undefined;
  if (nextEdge?.kind === 'crossing') {
    for (const c of net.crossingsOf(nextEdge.id)) {
      if (c.kind !== 'crossing') continue;
      const road = net.edge(c.road);
      if (road === undefined) continue;
      const reach = 15 + (road.speed * 1.5 * walkerSpeed) / 1.4;
      for (const laneId of road.lanes) {
        const lane = net.lane(laneId);
        if (lane === undefined || lane.class !== 'road') continue;
        for (const car of occupancy.get(laneId) ?? []) {
          const d = laneEdgeDistance(lane, road, car.a.s);
          const ahead = lane.dir === 1 ? c.roadS - d : d - c.roadS;
          if (ahead > -3 && ahead < reach && (car.a.speed > 0.5 || ahead < 4)) return false;
        }
      }
    }
    return true;
  }
  if (move.crosses === undefined || move.junction === undefined) return true;
  const junction = net.junction(move.junction);
  if (junction === undefined) return true;
  if (junction.control === 'signal') {
    const timing = timingOf(junction, env.tickRate);
    if (allRed(junction, env.tick, env.tickRate, timing)) return false;
    for (const k of move.crosses) {
      const arm = junction.arms[k];
      if (arm === undefined) continue;
      if (signalColor(junction, arm.group, env.tick, env.tickRate, timing) !== 'red') return false;
    }
  }
  // Unsignalised (or as a safety net): no car approaching on, or turning into, a crossed arm.
  for (const k of move.crosses) {
    const arm = junction.arms[k];
    if (arm === undefined) continue;
    const edge = net.edge(arm.edge);
    if (edge === undefined) continue;
    for (const laneId of edge.lanes) {
      const lane = net.lane(laneId);
      if (lane === undefined || lane.class !== 'road') continue;
      for (const car of occupancy.get(laneId) ?? []) {
        if (lane.end === arm.node) {
          const remaining = lane.length - car.a.s;
          if (remaining < 15 + car.a.speed * 1.5 && (car.a.speed > 0.5 || remaining < 3))
            return false;
        } else if (lane.start === arm.node && car.a.s < 2) return false;
      }
    }
  }
  return true;
}

function stepWalker(ref: Ref, occupancy: ReadonlyMap<string, Ref[]>, env: AgentEnv): void {
  const { net, dt, tick, tickRate } = env;
  const { a, w } = ref;
  const lane = ref.lane as TransportLane;
  const edge = ref.edge as TransportEdge;
  const pace = 1.15 + 0.5 * unit01(a.seed, 2);
  if (a.state === 'idle') {
    const idleTicks = (3 + 15 * unit01(a.seed, 3000 + a.hops)) * tickRate;
    if (tick - a.since < idleTicks) {
      w.speed = 0;
      return;
    }
    setState(w, 'move', tick);
  }
  let v = pace;
  const leader = leaderOnLane(ref, occupancy);
  if (leader !== undefined) {
    const gap = leader.a.s - a.s;
    if (gap < 0.6) v = 0;
    else if (gap < 1.4) v = dmath.min(v, leader.a.speed);
  }
  const s = a.s + v * dt;
  // Bus stops: sometimes wait a while.
  for (const stop of lane.stops) {
    if (stop.kind !== 'bus' || a.served === stop.id) continue;
    const at = laneCoordinate(lane, edge, stop.d);
    if (a.s <= at && s >= at) {
      w.served = stop.id;
      if (unit01(a.seed, fnv1a(stop.id)) < 0.35) {
        w.s = at;
        w.speed = 0;
        setState(w, 'idle', tick);
        return;
      }
    }
  }
  if (s >= lane.length && a.next !== undefined) {
    const move = net.movement(a.lane, a.next);
    if (move !== undefined && !crossingClear(move, occupancy, env, pace)) {
      w.s = dmath.max(a.s, lane.length);
      w.speed = 0;
      setState(w, 'wait', tick);
      return;
    }
  }
  w.s = s;
  w.speed = v;
  const hops = w.hops;
  advanceLanes(ref, env);
  if (w.hops !== hops && unit01(a.seed, 5000 + w.hops) < 0.05) {
    setState(w, 'idle', tick);
    w.speed = 0;
    return;
  }
  setState(w, v < 0.05 ? 'wait' : 'move', tick);
}

function stepTrainLead(
  ref: Ref,
  occupancy: ReadonlyMap<string, Ref[]>,
  env: AgentEnv,
  cars: number,
): void {
  const { net, policy, dt, tick, tickRate } = env;
  const { a, w } = ref;
  const lane = ref.lane as TransportLane;
  const edge = ref.edge as TransportEdge;
  const p = policy.rail;
  if (a.state === 'dwell') {
    const terminus = a.served === `terminus:${a.lane}`;
    const station = terminus ? undefined : lane.stops.find((stop) => stop.id === a.served);
    const dwellTicks =
      (terminus ? 30 : (station?.dwell ?? 20 + 20 * unit01(a.seed, 7000 + a.hops))) * tickRate;
    if (tick - a.since < dwellTicks) {
      w.speed = 0;
      return;
    }
    setState(w, 'move', tick);
    if (terminus) {
      ref.teleport = true;
      reverseConsist(ref, env, cars);
      return;
    }
  }
  const v0 = edge.speed * (0.92 + 0.08 * unit01(a.seed, 1));
  const remaining = lane.length - a.s;
  let gap = Number.POSITIVE_INFINITY;
  let leaderSpeed = 0;
  const leader = leaderOnLane(ref, occupancy);
  if (leader !== undefined) {
    gap = leader.a.s - a.s - (leader.a.length + a.length) / 2;
    leaderSpeed = leader.a.speed;
  } else if (a.next !== undefined) {
    const next = firstOnLane(a.next, occupancy);
    const move = net.movement(a.lane, a.next);
    if (next !== undefined && move !== undefined) {
      gap = remaining + move.length + next.a.s - (next.a.length + a.length) / 2;
      leaderSpeed = next.a.speed;
    }
  }
  // Opposing traffic on the same track.
  for (const laneId of edge.lanes) {
    if (laneId === lane.id) continue;
    for (const other of occupancy.get(laneId) ?? []) {
      const theirs = laneCoordinate(
        lane,
        edge,
        laneEdgeDistance(net.lane(laneId) as TransportLane, edge, other.a.s),
      );
      const g = theirs - a.s - (other.a.length + a.length) / 2 - 20;
      if (g > -a.length && g < gap) {
        gap = dmath.max(0.01, g);
        leaderSpeed = 0;
      }
    }
  }
  // Stations: stop at the next unserved one.
  let stationAt: { at: number; id: string } | undefined;
  for (const stop of lane.stops) {
    if (stop.kind !== 'station' || stop.id === a.served) continue;
    const at = laneCoordinate(lane, edge, stop.d);
    if (at < a.s - 1) continue;
    if (stationAt === undefined || at < stationAt.at) stationAt = { at, id: stop.id };
  }
  if (stationAt !== undefined) {
    const g = stationAt.at - a.s + p.gap;
    if (g < gap) {
      gap = g;
      leaderSpeed = 0;
    }
  }
  const terminus = a.next === undefined || net.movement(a.lane, a.next)?.turn === 'uturn';
  if (terminus) {
    const g = remaining - a.length / 2 - 1 + p.gap;
    if (g < gap) {
      gap = g;
      leaderSpeed = 0;
    }
  }
  const accel = idmAcceleration(a.speed, v0, gap, a.speed - leaderSpeed, p);
  const v = dmath.max(0, a.speed + accel * dt);
  w.speed = v;
  w.s = a.s + v * dt;
  if (stationAt !== undefined && dmath.abs(stationAt.at - w.s) < 1.5 && v < 0.4) {
    w.speed = 0;
    w.served = stationAt.id;
    setState(w, 'dwell', tick);
    return;
  }
  if (terminus && remaining - a.length / 2 < 3 && v < 0.3) {
    w.speed = 0;
    w.served = `terminus:${a.lane}`;
    setState(w, 'dwell', tick);
    return;
  }
  if (terminus) w.s = dmath.min(w.s, lane.length - a.length / 2);
  advanceLanes(ref, env);
  setState(w, w.speed < 0.1 ? 'wait' : 'move', tick);
}

/** Step back `distance` metres from a lane position along the lead's trail. */
export function walkBack(
  net: TransportNetwork,
  laneId: string,
  s: number,
  prev: string | undefined,
  trail: readonly string[],
  distance: number,
): { lane: string; s: number; prev?: string } {
  let current = laneId;
  let pos = s;
  let before = prev;
  let index = 0;
  let remaining = distance;
  for (let guard = 0; guard < 12; guard++) {
    const move = net.movement(before, current);
    const floor = -(move?.length ?? 0);
    if (pos - remaining >= floor || before === undefined || move === undefined)
      return {
        lane: current,
        s: dmath.max(floor, pos - remaining),
        ...(before !== undefined ? { prev: before } : {}),
      };
    remaining -= pos - floor;
    const back = net.lane(before);
    if (back === undefined) return { lane: current, s: floor, prev: before };
    current = before;
    pos = back.length;
    index++;
    before = trail[index];
  }
  return { lane: current, s: pos, ...(before !== undefined ? { prev: before } : {}) };
}

function placeTrainCar(ref: Ref, lead: Ref, env: AgentEnv): void {
  const { w } = ref;
  const spacing = (ref.a.length + lead.w.length) / 2 + 1;
  const back = walkBack(
    env.net,
    lead.w.lane,
    lead.w.s,
    lead.w.prev,
    lead.w.trail ?? [],
    spacing * (ref.a.carIndex ?? 1),
  );
  w.lane = back.lane;
  w.s = back.s;
  if (back.prev !== undefined) w.prev = back.prev;
  else delete w.prev;
  w.speed = lead.w.speed;
  w.state = lead.w.state;
  w.since = lead.w.since;
  if (lead.teleport) ref.teleport = true;
  const lane = env.net.lane(back.lane);
  const edge = lane !== undefined ? env.net.edge(lane.edge) : undefined;
  if (edge?.tunnel === true) w.hidden = true;
  else delete w.hidden;
}

function reverseLane(net: TransportNetwork, laneId: string): TransportLane | undefined {
  const lane = net.lane(laneId);
  if (lane === undefined) return undefined;
  const edge = net.edge(lane.edge);
  if (edge === undefined) return undefined;
  for (const id of edge.lanes) {
    const other = net.lane(id);
    if (other !== undefined && other.class === lane.class && other.dir !== lane.dir) return other;
  }
  return undefined;
}

/** Turn a consist around at a terminus: the tail becomes the head, travelling back. */
function reverseConsist(ref: Ref, env: AgentEnv, cars: number): void {
  const { net } = env;
  const w = ref.w;
  // The consist covers the lead's lane and the lanes in its trail; find where its tail is.
  const chain = [w.lane, ...(w.trail ?? [])];
  const tail = walkBack(net, w.lane, w.s, w.prev, w.trail ?? [], cars * (w.length + 1));
  const tailIndex = dmath.max(0, chain.indexOf(tail.lane));
  const headLane = reverseLane(net, tail.lane);
  if (headLane === undefined) return;
  // Lanes from the tail back toward the old head, reversed, are the new head's trail.
  const trail: string[] = [];
  for (let i = tailIndex - 1; i >= 0; i--) {
    const reversed = reverseLane(net, chain[i] as string);
    if (reversed !== undefined) trail.push(reversed.id);
  }
  w.lane = headLane.id;
  w.s = headLane.length - dmath.max(0, tail.s);
  w.trail = trail;
  if (trail[0] !== undefined) w.prev = trail[0];
  else delete w.prev;
  w.hops += 1;
  const chosen = chooseNext(headLane, w.seed, w.hops);
  if (chosen === undefined) delete w.next;
  else w.next = chosen;
  ref.lane = headLane;
  ref.edge = net.edge(headLane.edge);
  delete w.served;
}

function stepAircraft(ref: Ref, env: AgentEnv): void {
  const { w } = ref;
  w.s = ref.a.s + ref.a.speed * env.dt;
  setState(w, 'move', env.tick);
}
