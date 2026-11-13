import type { RailVehicleProfile, VehicleData } from '@bendyline/molen-schema';
/**
 * `createAmbientRenderer`: draws a main-thread world's ambient agents (the Earth view's shared
 * vehicle world, or any host stepping a World itself). Cars, buses and rail cars are instanced
 * proxies with pooled full models near the camera, pedestrians are procedural figures, aircraft
 * are models or proxies. Everything lives under one group in absolute world coordinates.
 */

import type { SceneAdmission } from '@bendyline/molen-client';
import { cycleRiderPose, type FigureData } from '@bendyline/molen-figures/client';
import type { SeatData, VehicleStateData } from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { AmbientAgent, type AmbientAgentData } from '../kernel/components';
import { DEFAULT_TEMPLATES } from '../kernel/templates';
import { AmbientAircraft, type AmbientAircraftModels } from './aircraft';
import { ProxyBatches } from './batches';
import { type AmbientVehicleModels, type DetailCandidate, VehicleDetail } from './detail';
import { AmbientFigures, type WalkerView } from './figures';
import { type ProxyShape, proxyHeight, proxyShapeFor } from './proxies';

export interface AmbientRenderBudget {
  /** Cars drawn with their full model at most. */
  detailedCars: number;
  /** Full vessel models at most (default 4). */
  detailedBoats?: number;
  /** Idle detailed instances per pool (default 4); active instances have separate caps. */
  idleVehicleModels?: number;
  /** Estimated geometry/texture bytes per detail pool, including active and idle (default 32 MiB). */
  vehicleModelBytes?: number;
  /** Concurrent detailed model loads per pool (default 2). */
  vehicleLoads?: number;
  /** Animated (skinned) pedestrians at most. */
  skinnedFigures: number;
  /** Pedestrians beyond this distance (m) are not drawn. */
  figureRadius: number;
  /** Pedestrian pose evaluations per frame. */
  posesPerFrame: number;
}

export interface AmbientRendererOptions {
  world: World;
  /** Parent in absolute world coordinates (e.g. the terrain stream object). */
  parent: THREE.Object3D;
  /** Shader warm-up for new objects (e.g. `renderer.prepareObject`). */
  prepare?: (object: THREE.Object3D) => Promise<void> | void;
  /** Main-thread admission (e.g. `renderer.admission`) for building aircraft models. */
  admission?: SceneAdmission;
  /** Full vehicle models for nearby cars (absent: proxies only). */
  vehicles?: AmbientVehicleModels;
  /** Aircraft models (absent: proxies only). */
  aircraft?: AmbientAircraftModels;
  /** Body heights by type id, for proxies (the kernel stores length and width only). */
  heights?: Readonly<Record<string, number>>;
  /** Rail vehicle silhouettes by type id (`spec.rail.profile`), for train proxies. */
  railProfiles?: Readonly<Record<string, RailVehicleProfile>>;
  /**
   * Car types ridden in the open, by type id: two-wheelers and auto-rickshaws, whose driver is
   * drawn on the saddle (two-wheelers also lean into their turns and draw as two-wheelers).
   */
  riders?: Readonly<Record<string, AmbientRider>>;
  budget?: Partial<AmbientRenderBudget>;
}

/** The driver drawn on a two- or three-wheeler in traffic. */
export interface AmbientRider {
  /** The vehicle's data; `spec.cycle` or `spec.handlebar` places the hands and feet. */
  vehicle: VehicleData;
  /** The driver seat: the pelvis position in model space. */
  seat: SeatData;
}

/** Per-rider heading history: lean and bar angle follow the turn rate, tick to tick. */
interface Ridden {
  tick: number;
  yaw: number;
  rate: number;
  roll: number;
  figure: FigureData;
  seen: number;
}

export interface AmbientRenderStats {
  cars: number;
  pedestrians: number;
  trains: number;
  aircraft: number;
  boats: number;
  proxies: number;
  detailedCars: number;
  detailedBoats: number;
  figures: number;
  drawBatches: number;
}

export interface AmbientRenderer {
  readonly object: THREE.Group;
  /** Draw the current world state; `camera` is the absolute camera position. */
  update(camera: readonly [number, number, number], dt: number): void;
  setBudget(budget: Partial<AmbientRenderBudget>): void;
  setVisible(visible: boolean): void;
  stats(): AmbientRenderStats;
  dispose(): void;
}

const DEFAULT_BUDGET: AmbientRenderBudget = {
  detailedCars: 8,
  detailedBoats: 4,
  skinnedFigures: 32,
  figureRadius: 120,
  posesPerFrame: 20,
};

const FADE_TICKS = 30;
const Figure = componentHandle('figure');

export function createAmbientRenderer(options: AmbientRendererOptions): AmbientRenderer {
  const { world } = options;
  const object = new THREE.Group();
  object.name = 'ambient';
  options.parent.add(object);
  const batches = new ProxyBatches(options.prepare);
  object.add(batches.group);
  const detail =
    options.vehicles !== undefined
      ? new VehicleDetail({
          models: options.vehicles,
          parent: object,
          ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
        })
      : undefined;
  const boatDetail =
    options.vehicles !== undefined
      ? new VehicleDetail({
          models: options.vehicles,
          parent: object,
          near: 1200,
          far: 1500,
          ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
        })
      : undefined;
  const figures = new AmbientFigures(options.prepare);
  object.add(figures.group);
  const aircraft =
    options.aircraft !== undefined
      ? new AmbientAircraft(options.aircraft, object, options.prepare, options.admission)
      : undefined;
  let budget: AmbientRenderBudget = { ...DEFAULT_BUDGET, ...options.budget };
  const applyBudget = (): void => {
    detail?.setMax(budget.detailedCars);
    boatDetail?.setMax(budget.detailedBoats ?? 4);
    for (const pool of [detail, boatDetail])
      pool?.setCacheBudget({
        ...(budget.idleVehicleModels !== undefined ? { idleModels: budget.idleVehicleModels } : {}),
        ...(budget.vehicleModelBytes !== undefined ? { modelBytes: budget.vehicleModelBytes } : {}),
        ...(budget.vehicleLoads !== undefined ? { concurrentLoads: budget.vehicleLoads } : {}),
      });
    figures.setBudget({
      skinned: budget.skinnedFigures,
      radius: budget.figureRadius,
      posesPerFrame: budget.posesPerFrame,
    });
  };
  applyBudget();
  const colors = new Map<string, THREE.Color>();
  const colorOf = (hex: string | undefined): THREE.Color => {
    const key = hex ?? '#d8d8d4';
    let color = colors.get(key);
    if (color === undefined) {
      color = new THREE.Color(key);
      colors.set(key, color);
    }
    return color;
  };
  const ridden = new Map<string, Ridden>();
  let frame = 0;
  /**
   * The rider's walker for a ridden agent, and the body rotation both draw with: a two-wheeler
   * leans into its turn (a = g tan θ, eased) up to the type's lean limit.
   */
  const ride = (
    id: string,
    agent: Readonly<AmbientAgentData>,
    pos: readonly [number, number, number],
    rot: readonly [number, number, number, number],
    rider: AmbientRider,
    dt: number,
    tick: number,
  ): { rot: [number, number, number, number]; walker: WalkerView } => {
    const [qx, qy, qz, qw] = rot;
    const yaw = Math.atan2(2 * (qx * qz + qw * qy), 1 - 2 * (qx * qx + qy * qy));
    let state = ridden.get(id);
    if (state === undefined) {
      // Dressed as an adult pedestrian of the same seed would be.
      const figure = DEFAULT_TEMPLATES.pedestrian({
        id,
        kind: 'pedestrian',
        type: 'human.adult',
        seed: agent.seed,
      }).figure as FigureData | undefined;
      state = {
        tick,
        yaw,
        rate: 0,
        roll: 0,
        figure: figure ?? { preset: 'human.adult', seed: id },
        seen: frame,
      };
      ridden.set(id, state);
    } else if (tick !== state.tick) {
      let turn = yaw - state.yaw;
      if (turn > Math.PI) turn -= 2 * Math.PI;
      else if (turn < -Math.PI) turn += 2 * Math.PI;
      state.rate = turn / ((tick - state.tick) / world.tickRate);
      state.tick = tick;
      state.yaw = yaw;
    }
    state.seen = frame;
    const spec = rider.vehicle.spec;
    const maxLean = spec.cycle?.maxLean ?? 0;
    const target = Math.max(
      -maxLean,
      Math.min(maxLean, -Math.atan2(agent.speed * state.rate, 9.81)),
    );
    state.roll += (target - state.roll) * Math.min(1, dt * 4);
    let body: [number, number, number, number] = [qx, qy, qz, qw];
    if (maxLean > 0) {
      const s = Math.sin(state.roll / 2),
        c = Math.cos(state.roll / 2);
      body = [qx * c + qy * s, qy * c - qx * s, qz * c + qw * s, qw * c - qz * s];
    }
    const steer = Math.max(
      -spec.maxSteer,
      Math.min(spec.maxSteer, Math.atan2(spec.wheelbase * state.rate, Math.max(1, agent.speed))),
    );
    const seat = new THREE.Vector3(...rider.seat.position).applyQuaternion(
      new THREE.Quaternion(...body),
    );
    return {
      rot: body,
      walker: {
        id: `${id}:rider`,
        figure: state.figure,
        pos: [pos[0] + seat.x, pos[1] + seat.y, pos[2] + seat.z],
        rot: body,
        speed: 0,
        since: agent.spawnedTick,
        hidden: false,
        mode: 'sit',
        anchor: 'pelvis',
        riding: cycleRiderPose(
          rider.vehicle,
          { steer, speed: agent.speed } as VehicleStateData,
          rider.seat,
        ),
      },
    };
  };
  let lastSelect = Number.NEGATIVE_INFINITY;
  let elapsed = 0;
  let counts: AmbientRenderStats = {
    cars: 0,
    pedestrians: 0,
    trains: 0,
    aircraft: 0,
    boats: 0,
    proxies: 0,
    detailedCars: 0,
    detailedBoats: 0,
    figures: 0,
    drawBatches: 0,
  };

  return {
    object,
    update(camera, dt) {
      elapsed += dt;
      if (!object.visible) return;
      const tick = world.tick;
      frame++;
      batches.begin(camera);
      const walkers: WalkerView[] = [];
      const planes: {
        id: string;
        type: string;
        pos: readonly number[];
        rot: readonly number[];
        speed: number;
        descending: boolean;
      }[] = [];
      const candidates: DetailCandidate[] = [];
      const boatCandidates: DetailCandidate[] = [];
      const next = { cars: 0, pedestrians: 0, trains: 0, aircraft: 0, boats: 0 };
      const agentExists = (id: string): boolean => world.has(id, AmbientAgent);
      detail?.dropGone(agentExists);
      boatDetail?.dropGone(agentExists);
      for (const [id, a, t] of world.query(AmbientAgent, Transform)) {
        const agent = a as Readonly<AmbientAgentData>;
        if (agent.kind === 'pedestrian') {
          next.pedestrians++;
          const figure = world.get(id, Figure) as FigureData | undefined;
          if (figure !== undefined)
            walkers.push({
              id,
              figure,
              pos: t.pos,
              rot: t.rot,
              speed: agent.speed,
              since: agent.since,
              hidden: agent.hidden === true,
            });
          continue;
        }
        if (agent.kind === 'car') next.cars++;
        else if (agent.kind === 'train') next.trains++;
        else if (agent.kind === 'boat') next.boats++;
        else next.aircraft++;
        if (agent.hidden === true) continue;
        if (agent.kind === 'aircraft') {
          planes.push({
            id,
            type: agent.type,
            pos: t.pos,
            rot: t.rot,
            speed: agent.speed,
            descending: agent.air !== undefined && agent.air.y1 < agent.air.y0,
          });
          if (aircraft?.modelled(id) === true) continue;
        }
        if (agent.kind === 'boat') {
          const distance = Math.hypot(
            t.pos[0] - camera[0],
            t.pos[1] - camera[1],
            t.pos[2] - camera[2],
          );
          boatCandidates.push({ id, type: agent.type, color: agent.color ?? '#d8d8d4', distance });
          if (boatDetail?.has(id) === true) {
            boatDetail.update(id, t.pos, t.rot, agent.speed, dt);
            continue;
          }
        }
        const rider = agent.kind === 'car' ? options.riders?.[agent.type] : undefined;
        let rot = t.rot;
        if (rider !== undefined) {
          const ridden = ride(id, agent, t.pos, t.rot, rider, dt, tick);
          rot = ridden.rot;
          walkers.push(ridden.walker);
        }
        if (agent.kind === 'car' || agent.kind === 'train') {
          // Long vehicles count from their nearest end.
          const distance = Math.max(
            0,
            Math.hypot(t.pos[0] - camera[0], t.pos[1] - camera[1], t.pos[2] - camera[2]) -
              agent.length / 2,
          );
          if (distance < 80)
            candidates.push({ id, type: agent.type, color: agent.color ?? '#d8d8d4', distance });
          if (detail?.has(id) === true) {
            detail.update(id, t.pos, rot, agent.speed, dt);
            continue;
          }
        }
        const profile = agent.kind === 'train' ? options.railProfiles?.[agent.type] : undefined;
        const shape: ProxyShape =
          profile !== undefined
            ? `rail-${profile}`
            : rider?.vehicle.spec.cycle !== undefined
              ? 'two-wheeler'
              : rider?.vehicle.spec.bodyStyle === 'auto-rickshaw'
                ? 'three-wheeler'
                : proxyShapeFor(agent.kind, agent.length);
        const height =
          options.heights?.[agent.type] ??
          proxyHeight(shape, agent.length, agent.width, agent.type);
        const age = tick - agent.spawnedTick;
        batches.add({
          shape,
          dims: { length: agent.length, width: agent.width, height },
          pos: t.pos,
          rot,
          scale: age >= FADE_TICKS ? 1 : Math.max(0.05, age / FADE_TICKS),
          color: colorOf(agent.color),
        });
      }
      const proxies = batches.end();
      for (const [id, state] of ridden) if (state.seen !== frame) ridden.delete(id);
      figures.update(walkers, camera, tick, world.tickRate);
      aircraft?.sync(planes, dt);
      if (detail !== undefined && elapsed - lastSelect >= 0.2) {
        lastSelect = elapsed;
        detail.select(candidates, (id) => world.exists(id));
        boatDetail?.select(boatCandidates, (id) => world.exists(id));
      }
      counts = {
        ...next,
        proxies,
        detailedCars: detail?.count ?? 0,
        detailedBoats: boatDetail?.count ?? 0,
        figures: figures.count,
        drawBatches: batches.meshCount,
      };
    },
    setBudget(next) {
      budget = { ...budget, ...next };
      applyBudget();
    },
    setVisible(visible) {
      object.visible = visible;
    },
    stats: () => counts,
    dispose() {
      detail?.dispose();
      boatDetail?.dispose();
      aircraft?.dispose();
      figures.dispose();
      batches.dispose();
      object.removeFromParent();
    },
  };
}
