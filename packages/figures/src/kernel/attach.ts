/**
 * `figures-attach` (late phase, before the hierarchy): entities carrying `parent` +
 * `figureAttachment` get their `localTransform` from the parent figure's evaluated socket, so
 * the kernel hierarchy composes their world transform and cascade-destroy applies unchanged.
 * `figures-riders` (late phase, after mounted-seats): a `mounted` rider whose mount is a figure
 * follows the animated seat socket instead of the rigid seat point.
 */

import { LocalTransform, Parent, Transform, type World } from '@bendyline/molen-kernel';
import {
  composeTransforms,
  dmath,
  type Quat,
  type TransformLike,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import type { EntityId } from '@bendyline/molen-schema';
import { Figure, FigureAttachment, type FigureAttachmentData } from './components';
import { poseModelSpace, socketTransform } from './pose';
import type { FigureRuntime } from './runtime';

const POS_QUANTUM = 0.005;
const ROT_QUANTUM = 0.005;
const IDENTITY: Quat = [0, 0, 0, 1];

function moved(current: TransformLike | undefined, next: TransformLike): boolean {
  if (current === undefined) return true;
  for (let i = 0; i < 3; i++) {
    if (dmath.abs((current.pos[i] as number) - (next.pos[i] as number)) > POS_QUANTUM) return true;
  }
  const a = current.rot ?? IDENTITY;
  const b = next.rot ?? IDENTITY;
  for (let i = 0; i < 4; i++) {
    if (dmath.abs((a[i] as number) - (b[i] as number)) > ROT_QUANTUM) return true;
  }
  return false;
}

/** The socket-local transform of an attachment: socket composed with the authored offset. */
export function attachmentLocal(
  socket: TransformLike,
  attachment: FigureAttachmentData,
): TransformLike {
  const offset = attachment.offset;
  if (offset === undefined) return socket;
  return composeTransforms(socket, {
    pos: (offset.pos ?? [0, 0, 0]) as Vec3,
    rot: (offset.rot ?? IDENTITY) as Quat,
  });
}

export function installAttachments(world: World, runtime: FigureRuntime): void {
  world.addSystem(
    (w, ctx) => {
      const byParent = new Map<EntityId, { id: EntityId; attachment: FigureAttachmentData }[]>();
      for (const [id, parent, attachment] of w.query(Parent, FigureAttachment)) {
        let list = byParent.get(parent.id);
        if (list === undefined) {
          list = [];
          byParent.set(parent.id, list);
        }
        list.push({ id, attachment });
      }
      for (const [parentId, children] of byParent) {
        const entry = runtime.entryFor(parentId);
        const pose = entry === undefined ? undefined : runtime.poseFor(parentId, ctx.tick);
        if (entry === undefined || pose === undefined) {
          for (const child of children) runtime.warnOnce(child.id, 'parent-not-figure');
          continue;
        }
        const model = poseModelSpace(pose);
        for (const child of children) {
          const socket = socketTransform(entry.rig, pose, child.attachment.socket, model);
          if (socket === undefined) {
            runtime.warnOnce(child.id, 'unknown-socket');
            continue;
          }
          const local = attachmentLocal(socket, child.attachment);
          const current = w.get(child.id, LocalTransform);
          if (moved(current, local)) {
            w.set(child.id, LocalTransform, { pos: local.pos, rot: local.rot ?? [0, 0, 0, 1] });
          }
        }
      }
    },
    { phase: 'late', name: 'figures-attach', priority: -10 },
  );
}

export function installRiders(world: World, runtime: FigureRuntime): void {
  world.addSystem(
    (w, ctx) => {
      for (const [rider, mounted] of w.query(Mounted)) {
        if (!w.has(mounted.vehicle, Figure)) continue;
        const mountT = w.get(mounted.vehicle, Transform);
        const socket = runtime.socketLocal(mounted.vehicle, mounted.seat, ctx.tick);
        if (mountT === undefined || socket === undefined) continue;
        const next = composeTransforms(mountT, socket);
        const current = w.get(rider, Transform);
        if (moved(current, next)) {
          w.patch(rider, Transform, { pos: next.pos, rot: next.rot ?? [0, 0, 0, 1] });
        }
      }
    },
    { phase: 'late', name: 'figures-riders', priority: 110 },
  );
}
