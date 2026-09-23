/**
 * `installFigures(world)`: the capability entry point. Installs the locomotion, attachment,
 * and rider systems plus the seat-following system they rely on, and returns the handle the
 * script API and hosts use (rigs, poses, sockets, attach/detach, mount/dismount).
 */

import {
  LocalTransform,
  Parent,
  Transform,
  type TransformData,
  type World,
} from '@bendyline/molen-kernel';
import { composeTransforms, type TransformLike } from '@bendyline/molen-kernel/determinism';
import { groundFieldOf } from '@bendyline/molen-kernel/terrain';
import {
  installMountedSeats,
  Mountable,
  mountEntity,
  unmountEntity,
} from '@bendyline/molen-kernel/vehicles';
import type { EntityId } from '@bendyline/molen-schema';
import { attachmentLocal, installAttachments, installRiders } from './attach';
import { type FigureAnchor, FigureAttachment, type FigureAttachmentData } from './components';
import { installLocomotion, type LocomotionOptions } from './locomotion';
import type { FigurePose } from './pose';
import { type FigureRig, figureMountable } from './rig';
import { createFigureRuntime, type FigureRuntime } from './runtime';
import type { ResolvedFigureDescriptor } from './types';

export interface FiguresOptions extends LocomotionOptions {}

export interface FiguresHandle {
  readonly world: World;
  readonly runtime: FigureRuntime;
  rigOf(id: EntityId): FigureRig | undefined;
  descriptorOf(id: EntityId): ResolvedFigureDescriptor | undefined;
  /** The entity's pose at a tick (default: the current tick). */
  poseAt(id: EntityId, tick?: number): FigurePose | undefined;
  /** A socket's world transform at a tick (default: the current tick). */
  socket(id: EntityId, name: string, tick?: number): TransformLike | undefined;
  /** Parent `itemId` to a figure socket; places it immediately so it never pops. */
  attach(
    itemId: EntityId,
    figureId: EntityId,
    socket: string,
    offset?: FigureAttachmentData['offset'],
    anchor?: FigureAnchor,
  ): boolean;
  /** Remove the attachment (and by default the parent link), keeping the world pose. */
  detach(itemId: EntityId, opts?: { keepWorld?: boolean }): boolean;
  /** Seat a rider on a figure mount (adds `mountable` from the rig when absent). */
  mount(riderId: EntityId, figureId: EntityId, seat?: string): boolean;
  dismount(riderId: EntityId): boolean;
  dispose(): void;
}

const handles = new WeakMap<World, FiguresHandle>();

/** Install the figures systems (idempotent per world) and return the handle. */
export function installFigures(world: World, opts: FiguresOptions = {}): FiguresHandle {
  const existing = handles.get(world);
  if (existing !== undefined) return existing;
  const runtime = createFigureRuntime(world);
  installLocomotion(world, runtime, opts);
  installAttachments(world, runtime);
  installMountedSeats(world);
  installRiders(world, runtime);
  const groundHeight =
    opts.groundHeight ?? ((x: number, z: number) => groundFieldOf(world)?.sampleHeight(x, z) ?? 0);

  const handle: FiguresHandle = {
    world,
    runtime,
    rigOf: (id) => runtime.entryFor(id)?.rig,
    descriptorOf: (id) => runtime.entryFor(id)?.descriptor,
    poseAt: (id, tick) => runtime.poseFor(id, tick ?? world.tick),
    socket: (id, name, tick) => runtime.socketWorld(id, name, tick ?? world.tick),
    attach(itemId, figureId, socket, offset, anchor) {
      if (itemId === figureId || !world.exists(itemId) || !world.exists(figureId)) return false;
      const entry = runtime.entryFor(figureId);
      if (entry === undefined || entry.rig.socketIndex[socket] === undefined) return false;
      const attachment: FigureAttachmentData = { socket };
      if (offset !== undefined) attachment.offset = offset;
      if (anchor !== undefined) attachment.anchor = anchor;
      world.set(itemId, Parent, { id: figureId });
      world.set(itemId, FigureAttachment, attachment);
      const socketLocal = runtime.socketLocal(figureId, socket, world.tick);
      const figureT = world.get(figureId, Transform);
      if (socketLocal !== undefined && figureT !== undefined) {
        const local = attachmentLocal(socketLocal, attachment);
        world.set(itemId, LocalTransform, { pos: local.pos, rot: local.rot ?? [0, 0, 0, 1] });
        const placed = composeTransforms(figureT, local);
        const current = world.get(itemId, Transform);
        const next: TransformData = {
          ...(current ?? {}),
          pos: placed.pos,
          rot: placed.rot ?? [0, 0, 0, 1],
        };
        world.set(itemId, Transform, next);
      }
      return true;
    },
    detach(itemId, detachOpts) {
      if (!world.has(itemId, FigureAttachment)) return false;
      world.remove(itemId, FigureAttachment);
      if (detachOpts?.keepWorld !== false) {
        world.remove(itemId, Parent);
        world.remove(itemId, LocalTransform);
      }
      return true;
    },
    mount(riderId, figureId, seat = 'saddle') {
      const entry = runtime.entryFor(figureId);
      if (entry === undefined) return false;
      if (!world.has(figureId, Mountable)) {
        world.set(figureId, Mountable, figureMountable(entry.rig));
      }
      return mountEntity(world, riderId, figureId, seat);
    },
    dismount: (riderId) => unmountEntity(world, riderId, { groundHeight }),
    dispose() {
      world.removeSystem('figures-locomotion');
      world.removeSystem('figures-attach');
      world.removeSystem('figures-riders');
      world.unregisterSnapshotProvider('figures');
      handles.delete(world);
    },
  };
  handles.set(world, handle);
  return handle;
}

/** The figures handle installed on a world, if any. */
export function figuresOf(world: World): FiguresHandle | undefined {
  return handles.get(world);
}
