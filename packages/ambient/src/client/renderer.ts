/**
 * `createAmbientRenderer`: draws a main-thread world's ambient agents (the Earth view's shared
 * vehicle world, or any host stepping a World itself). Cars, buses and rail cars are instanced
 * proxies with pooled full models near the camera, pedestrians are procedural figures, aircraft
 * are models or proxies. Everything lives under one group in absolute world coordinates.
 */

import type { FigureData } from '@bendyline/molen-figures/client';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { AmbientAgent, type AmbientAgentData } from '../kernel/components';
import { AmbientAircraft, type AmbientAircraftModels } from './aircraft';
import { ProxyBatches } from './batches';
import { type AmbientVehicleModels, type DetailCandidate, VehicleDetail } from './detail';
import { AmbientFigures, type WalkerView } from './figures';
import { proxyHeight, proxyShapeFor } from './proxies';

export interface AmbientRenderBudget {
  /** Cars drawn with their full model at most. */
  detailedCars: number;
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
  /** Full vehicle models for nearby cars (absent: proxies only). */
  vehicles?: AmbientVehicleModels;
  /** Aircraft models (absent: proxies only). */
  aircraft?: AmbientAircraftModels;
  /** Body heights by type id, for proxies (the kernel stores length and width only). */
  heights?: Readonly<Record<string, number>>;
  budget?: Partial<AmbientRenderBudget>;
}

export interface AmbientRenderStats {
  cars: number;
  pedestrians: number;
  trains: number;
  aircraft: number;
  proxies: number;
  detailedCars: number;
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
  const prepareSync = (target: THREE.Object3D): void => {
    void options.prepare?.(target);
  };
  const batches = new ProxyBatches(prepareSync);
  object.add(batches.group);
  const detail =
    options.vehicles !== undefined
      ? new VehicleDetail({
          models: options.vehicles,
          parent: object,
          ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
        })
      : undefined;
  const figures = new AmbientFigures(prepareSync);
  object.add(figures.group);
  const aircraft =
    options.aircraft !== undefined
      ? new AmbientAircraft(options.aircraft, object, options.prepare)
      : undefined;
  let budget: AmbientRenderBudget = { ...DEFAULT_BUDGET, ...options.budget };
  const applyBudget = (): void => {
    detail?.setMax(budget.detailedCars);
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
  let lastSelect = Number.NEGATIVE_INFINITY;
  let elapsed = 0;
  let counts: AmbientRenderStats = {
    cars: 0,
    pedestrians: 0,
    trains: 0,
    aircraft: 0,
    proxies: 0,
    detailedCars: 0,
    figures: 0,
    drawBatches: 0,
  };

  return {
    object,
    update(camera, dt) {
      elapsed += dt;
      if (!object.visible) return;
      const tick = world.tick;
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
      const next = { cars: 0, pedestrians: 0, trains: 0, aircraft: 0 };
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
            detail.update(id, t.pos, t.rot, agent.speed, dt);
            continue;
          }
        }
        const shape = proxyShapeFor(agent.kind, agent.length);
        const height =
          options.heights?.[agent.type] ??
          proxyHeight(shape, agent.length, agent.width, agent.type);
        const age = tick - agent.spawnedTick;
        batches.add({
          shape,
          dims: { length: agent.length, width: agent.width, height },
          pos: t.pos,
          rot: t.rot,
          scale: age >= FADE_TICKS ? 1 : Math.max(0.05, age / FADE_TICKS),
          color: colorOf(agent.color),
        });
      }
      const proxies = batches.end();
      figures.update(walkers, camera, tick, world.tickRate);
      aircraft?.sync(planes, dt);
      if (detail !== undefined && elapsed - lastSelect >= 0.2) {
        lastSelect = elapsed;
        detail.select(candidates, (id) => world.exists(id));
      }
      counts = {
        ...next,
        proxies,
        detailedCars: detail?.count ?? 0,
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
      aircraft?.dispose();
      figures.dispose();
      batches.dispose();
      object.removeFromParent();
    },
  };
}
