/**
 * Per-world figure runtime: descriptor to rig resolution cached on the frozen component object,
 * pose evaluation with the entity's intent and anchor, and once-per-entity diagnostics. Shared
 * by the locomotion, attachment, and rider systems and by the script API. Never part of world
 * state: everything here is derived from components.
 */

import {
  type ComponentType,
  componentHandle,
  type JsonObject,
  Parent,
  Transform,
  type World,
} from '@bendyline/molen-kernel';
import { dmath, type TransformLike, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import type { EntityId } from '@bendyline/molen-schema';
import {
  Figure,
  type FigureAnchor,
  FigureAttachment,
  type FigureData,
  FigureIntent,
  FigureState,
} from './components';
import { descriptorKey, resolveFigureDescriptor } from './descriptor';
import {
  evaluatePose,
  type FigurePose,
  figureToWorld,
  socketTransform,
  worldToFigure,
} from './pose';
import { deriveRig, type FigureRig } from './rig';
import { figureSeed } from './seed';
import type { ResolvedFigureDescriptor } from './types';

export interface FigureEntry {
  key: string;
  rig: FigureRig;
  descriptor: ResolvedFigureDescriptor;
  seed: number;
}

export interface FigureRuntime {
  readonly world: World;
  /** The resolved rig of a figure entity (cached), or undefined when it has no valid `figure`. */
  entryFor(id: EntityId): FigureEntry | undefined;
  /** The entity's pose at a tick, with its intent, look-at, and anchor applied (memoized per tick). */
  poseFor(id: EntityId, tick: number): FigurePose | undefined;
  /** A socket's figure-space transform under the entity's current pose. */
  socketLocal(id: EntityId, socket: string, tick: number): TransformLike | undefined;
  /** A socket's world-space transform. */
  socketWorld(id: EntityId, socket: string, tick: number): TransformLike | undefined;
  /** Emit `figures-error` once per (entity, code). */
  warnOnce(id: EntityId, code: string): void;
}

const Vehicle: ComponentType<JsonObject> = componentHandle('vehicle');

export function createFigureRuntime(world: World): FigureRuntime {
  const rigsByKey = new Map<string, FigureRig>();
  const entries = new WeakMap<FigureData, FigureEntry | null>();
  const warned = new Set<string>();
  const poseCache = new Map<EntityId, { tick: number; pose: FigurePose }>();
  let poseCacheTick = Number.NaN;

  const warnOnce = (id: EntityId, code: string): void => {
    const key = `${id} ${code}`;
    if (warned.has(key)) return;
    warned.add(key);
    world.emit('figures-error', { entity: id, code });
  };

  const entryFor = (id: EntityId): FigureEntry | undefined => {
    const figure = world.get(id, Figure);
    if (figure === undefined) return undefined;
    const cached = entries.get(figure);
    if (cached !== undefined) return cached ?? undefined;
    let entry: FigureEntry | null = null;
    try {
      const descriptor = resolveFigureDescriptor(figure);
      const key = descriptorKey(descriptor);
      let rig = rigsByKey.get(key);
      if (rig === undefined) {
        rig = deriveRig(descriptor);
        rigsByKey.set(key, rig);
      }
      entry = { key, rig, descriptor, seed: figureSeed(descriptor.seed, id) };
    } catch {
      warnOnce(id, 'invalid-descriptor');
    }
    entries.set(figure, entry);
    return entry ?? undefined;
  };

  const anchorFor = (id: EntityId): FigureAnchor | undefined => {
    const attachment = world.get(id, FigureAttachment);
    if (attachment !== undefined && world.has(id, Parent)) return attachment.anchor ?? 'origin';
    const mounted = world.get(id, Mounted);
    if (mounted === undefined) return undefined;
    if (world.has(mounted.vehicle, Figure)) return 'pelvis';
    return world.has(mounted.vehicle, Vehicle) ? 'eye' : 'pelvis';
  };

  const poseFor = (id: EntityId, tick: number): FigurePose | undefined => {
    if (tick !== poseCacheTick) {
      poseCache.clear();
      poseCacheTick = tick;
    }
    const cached = poseCache.get(id);
    if (cached !== undefined) return cached.pose;
    const entry = entryFor(id);
    if (entry === undefined) return undefined;
    const figure = world.get(id, Figure);
    const state = world.get(id, FigureState);
    const intent = world.get(id, FigureIntent);
    const t = world.get(id, Transform);
    let lookTarget: Vec3 | undefined;
    if (intent?.lookAt !== undefined && t !== undefined) {
      const target = intent.lookAt;
      let point: Vec3 | undefined;
      if ('pos' in target) point = target.pos;
      else point = world.get(target.entity, Transform)?.pos;
      if (point !== undefined) lookTarget = worldToFigure(t, point);
    }
    const lookWeight =
      state?.lookAtTick !== undefined ? dmath.smoothstep((tick - state.lookAtTick) / 12) : 1;
    const pose = evaluatePose(entry.rig, state, tick, {
      tickRate: world.tickRate,
      seed: entry.seed,
      blendTicks: figure?.blendTicks,
      lookTarget,
      lookWeight,
      overrides: intent?.overrides,
      ik: intent?.ik,
      anchor: anchorFor(id),
    });
    poseCache.set(id, { tick, pose });
    return pose;
  };

  const socketLocal = (id: EntityId, socket: string, tick: number): TransformLike | undefined => {
    const entry = entryFor(id);
    const pose = poseFor(id, tick);
    if (entry === undefined || pose === undefined) return undefined;
    return socketTransform(entry.rig, pose, socket);
  };

  const socketWorld = (id: EntityId, socket: string, tick: number): TransformLike | undefined => {
    const local = socketLocal(id, socket, tick);
    const t = world.get(id, Transform);
    if (local === undefined || t === undefined) return undefined;
    return figureToWorld(t, local);
  };

  return { world, entryFor, poseFor, socketLocal, socketWorld, warnOnce };
}
