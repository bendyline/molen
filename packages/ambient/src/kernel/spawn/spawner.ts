/**
 * Observer-driven spawning and cleanup. Agents appear on lanes in a ring around the observer
 * (outside a near radius and, close by, outside the view cone) until each class reaches its
 * density target, and are removed once they are beyond the keep radius, stuck out of sight, or
 * their lane's tile has gone.
 */

import {
  createRng,
  dmath,
  quatRotateVec3,
  type Rng,
  seedToInt,
} from '@bendyline/molen-kernel/determinism';
import { Transform, type TransformData, type World } from '@bendyline/molen-kernel/world';
import { agentRotation, agentSample, chooseNext, walkBack } from '../agents/step';
import {
  AMBIENT_KINDS,
  AmbientAgent,
  type AmbientAgentData,
  type AmbientKind,
  AmbientObserver,
  type AmbientStateData,
} from '../components';
import type { TransportNetwork } from '../graph/network';
import { laneCoordinate, laneSample, sampleLaneBody } from '../graph/sample';
import type { TransportClass, TransportEdge, TransportLane } from '../graph/types';
import { fmix32, q4, unit01 } from '../ids';
import {
  type AmbientTemplate,
  type AmbientTypes,
  type AmbientVehicleType,
  CAR_COLORS,
  pickWeighted,
} from '../templates';
import type { AmbientClassPolicy, AmbientPolicy } from './policy';

export interface ObserverView {
  x: number;
  y: number;
  z: number;
  /** Unit horizontal view direction, when known. */
  fx?: number;
  fz?: number;
  /** Density factor from the observer entity's `ambientObserver`. */
  density: number;
  /** Car spawn radius from the observer entity's `ambientObserver`. */
  radius?: number;
  /** Car despawn radius from the observer entity's `ambientObserver`. */
  keep?: number;
}

export interface SpawnEnv {
  net: TransportNetwork;
  policy: AmbientPolicy;
  tick: number;
  tickRate: number;
  types: AmbientTypes;
  templates: Readonly<Record<AmbientKind, AmbientTemplate | null>>;
  seed: number;
  ground: (x: number, z: number) => number;
}

const SPAWN_WEIGHT: Readonly<Partial<Record<string, number>>> = {
  motorway: 0.45,
  trunk: 0.7,
  service: 0.2,
  living: 0.3,
};

const LANE_CLASS: Readonly<Record<Exclude<AmbientKind, 'aircraft'>, TransportClass>> = {
  car: 'road',
  pedestrian: 'walk',
  train: 'rail',
};

/** Resolve the observer from state, an entity, or the first `ambientObserver` entity. */
export function resolveObserver(
  world: World,
  state: Readonly<AmbientStateData> | undefined,
): ObserverView | undefined {
  const fromEntity = (id: string): ObserverView | undefined => {
    const t = world.get(id, Transform);
    if (t === undefined) return undefined;
    const f = quatRotateVec3(t.rot, [0, 0, 1]);
    const length = dmath.hypot(f[0], f[2]);
    const settings = world.get(id, AmbientObserver);
    return {
      x: t.pos[0],
      y: t.pos[1],
      z: t.pos[2],
      ...(length > 1e-6 ? { fx: f[0] / length, fz: f[2] / length } : {}),
      density: settings?.density ?? 1,
      ...(settings?.radius !== undefined ? { radius: settings.radius } : {}),
      ...(settings?.despawnRadius !== undefined ? { keep: settings.despawnRadius } : {}),
    };
  };
  const observer = state?.observer;
  if (observer?.entity !== undefined) return fromEntity(observer.entity);
  if (observer?.pos !== undefined)
    return {
      x: observer.pos[0],
      y: observer.pos[1],
      z: observer.pos[2],
      ...(observer.forward !== undefined
        ? { fx: observer.forward[0], fz: observer.forward[1] }
        : {}),
      density: 1,
    };
  const first = world.query(AmbientObserver, Transform).first();
  return first !== undefined ? fromEntity(first[0]) : undefined;
}

/** The policy with an observer entity's car radius overrides applied. */
export function observerPolicy(
  policy: AmbientPolicy,
  observer: ObserverView | undefined,
): AmbientPolicy {
  if (observer?.radius === undefined && observer?.keep === undefined) return policy;
  const far = observer.radius ?? policy.car.far;
  const keep = dmath.max(
    far,
    observer.keep ?? (observer.radius !== undefined ? far * 1.3 : policy.car.keep),
  );
  return {
    ...policy,
    car: { ...policy.car, near: dmath.min(policy.car.near, far * 0.2), far, keep },
  };
}

function classPolicy(policy: AmbientPolicy, kind: AmbientKind): AmbientClassPolicy {
  return policy[kind];
}

/** Remove agents that left the ring, lost their lane, or finished their corridor. */
export function despawnAgents(
  world: World,
  env: SpawnEnv,
  observer: ObserverView | undefined,
): number {
  const { net, policy, tick, tickRate } = env;
  const leads = new Set<string>();
  const doomed = new Set<string>();
  for (const [id, a] of world.query(AmbientAgent)) if (a.consist === undefined) leads.add(id);
  // Over a (lowered) cap: the farthest agents beyond the near radius go first, a few per tick.
  const over: Record<AmbientKind, { id: string; distance: number }[]> = {
    car: [],
    pedestrian: [],
    train: [],
    aircraft: [],
  };
  for (const [id, a, t] of world.query(AmbientAgent, Transform)) {
    if (a.consist !== undefined) {
      if (!leads.has(a.consist)) doomed.add(id);
      continue;
    }
    if (observer !== undefined)
      over[a.kind].push({
        id,
        distance: dmath.hypot(t.pos[0] - observer.x, t.pos[2] - observer.z),
      });
    if (a.air !== undefined) {
      if (a.s >= a.air.length) doomed.add(id);
    } else {
      const lane = net.lane(a.lane);
      if (lane === undefined) {
        doomed.add(id);
        continue;
      }
    }
    if (observer === undefined) continue;
    const c = classPolicy(policy, a.kind);
    const distance = dmath.hypot(t.pos[0] - observer.x, t.pos[2] - observer.z);
    if (distance > c.keep) {
      doomed.add(id);
      continue;
    }
    if (distance <= c.near) continue;
    const stuck = a.state === 'wait' && tick - a.since > policy.stuckSeconds * tickRate;
    const lane = net.lane(a.lane);
    const deadEnd =
      a.air === undefined &&
      a.kind !== 'train' &&
      a.next === undefined &&
      lane !== undefined &&
      a.s >= lane.length - 0.6;
    if (stuck || deadEnd) doomed.add(id);
  }
  for (const kind of AMBIENT_KINDS) {
    const c = classPolicy(policy, kind);
    const cap = c.enabled ? c.max : 0;
    const live = over[kind].filter((x) => !doomed.has(x.id));
    if (live.length <= cap) continue;
    live.sort((x, y) => y.distance - x.distance || (x.id < y.id ? -1 : 1));
    let trim = dmath.min(4, live.length - cap);
    for (const x of live) {
      if (trim <= 0) break;
      if (x.distance <= c.near && c.enabled) continue;
      doomed.add(x.id);
      trim--;
    }
  }
  // Take whole consists with their lead.
  for (const [id, a] of world.query(AmbientAgent))
    if (a.consist !== undefined && doomed.has(a.consist)) doomed.add(id);
  for (const id of [...doomed].sort()) world.destroy(id);
  return doomed.size;
}

interface SpawnContext {
  world: World;
  env: SpawnEnv;
  observer: ObserverView;
  rng: Rng;
  occupancy: Map<string, number[]>;
  state: { nextSeq: number; spawned: number };
}

/** Spawn toward each class's density target, within the per-run budget. */
export function spawnAgents(
  world: World,
  env: SpawnEnv,
  observer: ObserverView,
  state: { nextSeq: number; spawned: number },
): void {
  const { policy, tick } = env;
  const rng = createRng(`${env.seed}:ambient:${tick}`);
  const counts: Record<AmbientKind, number> = { car: 0, pedestrian: 0, train: 0, aircraft: 0 };
  const occupancy = new Map<string, number[]>();
  for (const [, a] of world.query(AmbientAgent)) {
    if (a.consist === undefined) counts[a.kind]++;
    if (a.air !== undefined) continue;
    const list = occupancy.get(a.lane);
    if (list === undefined) occupancy.set(a.lane, [a.s]);
    else list.push(a.s);
  }
  const ctx: SpawnContext = { world, env, observer, rng, occupancy, state };
  const targets = {} as Record<AmbientKind, number>;
  for (const kind of AMBIENT_KINDS) targets[kind] = target(ctx, kind);
  let budget = policy.spawnBudget;
  for (let round = 0; round < policy.spawnBudget && budget > 0; round++) {
    let any = false;
    for (const kind of AMBIENT_KINDS) {
      if (budget <= 0) break;
      if (counts[kind] >= targets[kind]) continue;
      any = true;
      if (spawnOne(ctx, kind)) {
        counts[kind]++;
        budget--;
      }
    }
    if (!any) break;
  }
}

function target(ctx: SpawnContext, kind: AmbientKind): number {
  const c = classPolicy(ctx.env.policy, kind);
  if (!c.enabled || c.max <= 0) return 0;
  if (kind === 'aircraft') return c.max;
  const meters = ctx.env.net.grid.laneMeters(
    ctx.observer.x,
    ctx.observer.z,
    c.far,
    LANE_CLASS[kind],
  );
  const wanted = (meters / 1000) * c.perLaneKm * ctx.observer.density;
  if (kind === 'train' && meters > 400) return dmath.min(c.max, dmath.max(1, dmath.round(wanted)));
  return dmath.min(c.max, dmath.round(wanted));
}

function spawnOne(ctx: SpawnContext, kind: AmbientKind): boolean {
  if (kind === 'aircraft') return spawnAircraft(ctx);
  const { env, observer, rng } = ctx;
  const { net } = env;
  const c = classPolicy(env.policy, kind);
  const cls = LANE_CLASS[kind];
  const spans = net.grid.spansWithin(observer.x, observer.z, c.near, c.far);
  const weights: number[] = [];
  const edges: TransportEdge[] = [];
  let total = 0;
  for (const span of spans) {
    const edge = net.edge(span.edge) as TransportEdge;
    let lanes = 0;
    for (const id of edge.lanes) if (net.lane(id)?.class === cls) lanes++;
    let w = lanes * (span.d1 - span.d0);
    // Spread traffic onto city streets: wide motorways would otherwise take most spawns.
    if (kind === 'car') w *= SPAWN_WEIGHT[edge.kind] ?? 1;
    weights.push(w);
    edges.push(edge);
    total += w;
  }
  if (total <= 0) return false;
  const types = env.types[kind === 'pedestrian' ? 'pedestrian' : kind];
  for (let attempt = 0; attempt < 6; attempt++) {
    let pick = rng.next() * total;
    let index = 0;
    while (index < weights.length - 1 && pick >= (weights[index] as number)) {
      pick -= weights[index] as number;
      index++;
    }
    const span = spans[index];
    const edge = edges[index];
    if (span === undefined || edge === undefined) continue;
    const candidates = edge.lanes
      .map((id) => net.lane(id))
      .filter((l): l is TransportLane => l !== undefined && l.class === cls);
    const lane = candidates[rng.int(candidates.length)];
    if (lane === undefined) continue;
    const seq = ctx.state.nextSeq;
    const seed = fmix32(seq ^ env.seed);
    const vehicle =
      kind === 'pedestrian'
        ? undefined
        : pickWeighted(types as readonly AmbientVehicleType[], unit01(seed, 10));
    const length = kind === 'pedestrian' ? 0.5 : (vehicle?.length ?? 4.5);
    const width = kind === 'pedestrian' ? 0.5 : (vehicle?.width ?? 1.8);
    const cars = kind === 'train' ? dmath.max(1, vehicle?.cars ?? 2) : 1;
    const behind = kind === 'train' ? (cars - 1) * (length + 1) : 0;
    const d = span.d0 + rng.next() * (span.d1 - span.d0);
    const s = laneCoordinate(lane, edge, d);
    if (s < behind + length / 2 + 1 || s > lane.length - length / 2 - 1) continue;
    const sample = sampleLaneBody(lane, edge, s, laneSample());
    const dx = sample.x - observer.x;
    const dz = sample.z - observer.z;
    const distance = dmath.hypot(dx, dz);
    if (distance < c.near || distance > c.far) continue;
    const coneReach = Math.min(c.far * 0.6, env.policy.forwardConeReach);
    if (observer.fx !== undefined && observer.fz !== undefined && distance < coneReach) {
      const facing = (dx * observer.fx + dz * observer.fz) / dmath.max(distance, 1e-6);
      if (facing > env.policy.forwardConeCos) continue;
    }
    const minGap =
      kind === 'train' ? 250 : kind === 'pedestrian' ? 2.5 : length + env.policy.driver.gap + 8;
    const clearLanes = kind === 'train' ? edge.lanes : [lane.id];
    let clear = true;
    for (const id of clearLanes)
      for (const other of ctx.occupancy.get(id) ?? [])
        if (dmath.abs(other - s) < minGap + behind) clear = false;
    if (!clear) continue;
    createLaneAgent(ctx, kind, lane, edge, s, seed, vehicle, length, width, cars);
    return true;
  }
  return false;
}

function nextSeqId(ctx: SpawnContext, kind: AmbientKind): { id: string; seq: number } {
  for (;;) {
    const seq = ctx.state.nextSeq++;
    const id = `ambient:${kind}:${seq}`;
    if (!ctx.world.exists(id)) return { id, seq };
  }
}

function createLaneAgent(
  ctx: SpawnContext,
  kind: AmbientKind,
  lane: TransportLane,
  edge: TransportEdge,
  s: number,
  seed: number,
  vehicle: AmbientVehicleType | undefined,
  length: number,
  width: number,
  cars: number,
): void {
  const { env } = ctx;
  const { id } = nextSeqId(ctx, kind);
  const type =
    kind === 'pedestrian'
      ? (pickWeighted(env.types.pedestrian, unit01(seed, 10))?.preset ?? 'human.adult')
      : (vehicle?.id ?? 'proxy');
  const palette = vehicle?.colors ?? (kind === 'car' ? CAR_COLORS : undefined);
  const color =
    palette !== undefined && palette.length > 0
      ? palette[dmath.floor(unit01(seed, 11) * palette.length)]
      : undefined;
  const speed =
    kind === 'pedestrian'
      ? 1.15 + 0.5 * unit01(seed, 2)
      : kind === 'train'
        ? edge.speed * 0.5
        : dmath.min(edge.speed * 0.7, vehicle?.cruise ?? edge.speed);
  const next = chooseNext(lane, seed, 0);
  const agent: AmbientAgentData = {
    kind,
    type,
    ...(color !== undefined ? { color } : {}),
    lane: lane.id,
    s: q4(s),
    speed: q4(speed),
    ...(next !== undefined ? { next } : {}),
    seed,
    length,
    width,
    state: 'move',
    since: env.tick,
    hops: 0,
    ...(edge.tunnel ? { hidden: true } : {}),
    ...(kind === 'train' ? { trail: [] } : {}),
    spawnedTick: env.tick,
  };
  spawnWithTemplate(ctx, id, agent);
  if (kind === 'train')
    for (let k = 1; k < cars; k++) {
      const back = walkBack(env.net, lane.id, s, undefined, [], k * (length + 1));
      const { id: carId } = nextSeqId(ctx, kind);
      spawnWithTemplate(ctx, carId, {
        ...agent,
        lane: back.lane,
        s: q4(back.s),
        consist: id,
        carIndex: k,
        seed: fmix32(seed + k),
      });
    }
  ctx.occupancy.set(lane.id, [...(ctx.occupancy.get(lane.id) ?? []), s]);
}

function spawnWithTemplate(ctx: SpawnContext, id: string, agent: AmbientAgentData): void {
  const { env, world } = ctx;
  const sample = agentSample(env.net, agent, laneSample());
  if (sample === undefined) return;
  const rot = agentRotation(sample, agent.kind !== 'pedestrian');
  const transform: TransformData = {
    pos: [q4(sample.x), q4(sample.y), q4(sample.z)],
    rot: [q4(rot[0]), q4(rot[1]), q4(rot[2]), q4(rot[3])],
    teleport: true,
  };
  const template = env.templates[agent.kind];
  const extra = template?.({
    id,
    kind: agent.kind,
    type: agent.type,
    seed: agent.seed,
    ...(agent.color !== undefined ? { color: agent.color } : {}),
  });
  // A template's transform contributes its scale (a prefab sized to the agent); pose is ours.
  const scale = (extra?.transform as { scale?: [number, number, number] } | undefined)?.scale;
  if (scale !== undefined) transform.scale = scale;
  world.spawnRaw({ ...(extra ?? {}), ambientAgent: agent, transform }, id);
  ctx.state.spawned++;
}

function spawnAircraft(ctx: SpawnContext): boolean {
  const { env, observer, rng } = ctx;
  const c = env.policy.aircraft;
  const types = env.types.aircraft;
  const seed = fmix32(ctx.state.nextSeq ^ env.seed ^ 0x5a5a5a5a);
  const vehicle = pickWeighted(types, unit01(seed, 10));
  const length = vehicle?.length ?? 38;
  const width = vehicle?.width ?? 36;
  let corridor: AmbientAgentData['air'];
  let speed = vehicle?.cruise ?? 75 + 55 * rng.next();
  const runways = env.net
    .runways()
    .filter(
      (r) => dmath.hypot((r.ax + r.bx) / 2 - observer.x, (r.az + r.bz) / 2 - observer.z) < 6000,
    );
  if (runways.length > 0 && rng.next() < 0.4) {
    const runway = runways[rng.int(runways.length)] as (typeof runways)[number];
    const flip = rng.next() < 0.5;
    const ax = flip ? runway.bx : runway.ax;
    const az = flip ? runway.bz : runway.az;
    const bx = flip ? runway.ax : runway.bx;
    const bz = flip ? runway.az : runway.bz;
    const len = dmath.hypot(bx - ax, bz - az) || 1;
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    if (rng.next() < 0.5) {
      // Approach: 3° glide slope over 10 km to the touchdown zone.
      const tx = ax + dx * 300;
      const tz = az + dz * 300;
      corridor = {
        x: tx - dx * 10000,
        z: tz - dz * 10000,
        dx,
        dz,
        y0: runway.y + 524,
        y1: runway.y + 4,
        length: 10000,
      };
      speed = 70;
    } else {
      corridor = {
        x: ax + dx * 900,
        z: az + dz * 900,
        dx,
        dz,
        y0: runway.y + 25,
        y1: runway.y + 1400,
        length: 12000,
      };
      speed = 80;
    }
  } else {
    const heading = rng.next() * dmath.TAU;
    const dx = dmath.sin(heading);
    const dz = dmath.cos(heading);
    const offset = (rng.next() - 0.5) * c.far;
    const cx = observer.x - dz * offset;
    const cz = observer.z + dx * offset;
    const altitude = env.ground(cx, cz) + 450 * (1 + rng.int(3));
    corridor = {
      x: cx - dx * c.far,
      z: cz - dz * c.far,
      dx,
      dz,
      y0: altitude,
      y1: altitude,
      length: c.far * 2,
    };
  }
  const { id } = nextSeqId(ctx, 'aircraft');
  const agent: AmbientAgentData = {
    kind: 'aircraft',
    type: vehicle?.id ?? 'proxy.airliner',
    ...(vehicle?.colors?.[0] !== undefined ? { color: vehicle.colors[0] } : {}),
    lane: '',
    s: 0,
    speed: q4(speed),
    seed,
    length,
    width,
    state: 'move',
    since: env.tick,
    hops: 0,
    air: {
      x: q4(corridor.x),
      z: q4(corridor.z),
      dx: q4(corridor.dx),
      dz: q4(corridor.dz),
      y0: q4(corridor.y0),
      y1: q4(corridor.y1),
      length: corridor.length,
    },
    spawnedTick: env.tick,
  };
  spawnWithTemplate(ctx, id, agent);
  return true;
}

/** Seed integer for a world seed plus an optional salt. */
export function ambientSeed(seed: string | number, salt?: string): number {
  return seedToInt(salt !== undefined ? `${seed}:${salt}` : `${seed}:ambient`);
}
