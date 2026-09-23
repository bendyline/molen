/**
 * `molen.figures.*`: the script-facing namespace over a figures handle (a frozen bag of functions,
 * like `terrainScriptApi`). Mutations go through components so they are replayed and hashed.
 */

import { type JsonObject, Transform } from '@bendyline/molen-kernel';
import type { Quat, TransformLike, Vec3 } from '@bendyline/molen-kernel/determinism';
import { deepMergeJson, type EntityId } from '@bendyline/molen-schema';
import {
  FIGURE_MODES,
  Figure,
  type FigureAnchor,
  type FigureAttachmentData,
  type FigureData,
  type FigureIkEffector,
  FigureIntent,
  type FigureIntentData,
  type FigureMode,
} from './components';
import type { FiguresHandle } from './install';
import { FIGURE_PRESET_IDS } from './types';

function patchIntent(
  handle: FiguresHandle,
  id: EntityId,
  patch: Partial<FigureIntentData>,
): boolean {
  const world = handle.world;
  if (!world.has(id, Figure)) return false;
  const current = world.get(id, FigureIntent) ?? {};
  const next: FigureIntentData = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) delete next[key];
    else next[key] = value;
  }
  if (Object.keys(next).length === 0) {
    if (world.has(id, FigureIntent)) world.remove(id, FigureIntent);
  } else {
    world.set(id, FigureIntent, next);
  }
  return true;
}

/** The script-api namespace for figures (`molen.figures.*`); pass via `buildWorld` capabilities. */
export function figuresScriptApi(handle: FiguresHandle): object {
  const world = handle.world;
  return {
    setMode: (id: EntityId, mode: FigureMode | null): boolean => {
      if (mode !== null && !FIGURE_MODES.includes(mode)) return false;
      return patchIntent(handle, id, { mode: mode ?? undefined });
    },
    lookAt: (id: EntityId, target: { pos: Vec3 } | { entity: string } | null): boolean =>
      patchIntent(handle, id, { lookAt: target ?? undefined }),
    pose: (id: EntityId, overrides: Record<string, Quat> | null): boolean =>
      patchIntent(handle, id, { overrides: overrides ?? undefined }),
    ik: (id: EntityId, goals: Partial<Record<FigureIkEffector, Vec3>> | null): boolean =>
      patchIntent(handle, id, { ik: goals ?? undefined }),
    attach: (
      itemId: EntityId,
      figureId: EntityId,
      socket: string,
      offset?: FigureAttachmentData['offset'],
      anchor?: FigureAnchor,
    ): boolean => handle.attach(itemId, figureId, socket, offset, anchor),
    detach: (itemId: EntityId, opts?: { keepWorld?: boolean }): boolean =>
      handle.detach(itemId, opts),
    mount: (riderId: EntityId, figureId: EntityId, seat?: string): boolean =>
      handle.mount(riderId, figureId, seat),
    dismount: (riderId: EntityId): boolean => handle.dismount(riderId),
    socket: (figureId: EntityId, name: string): TransformLike | undefined =>
      handle.socket(figureId, name),
    setDescriptor: (id: EntityId, patch: JsonObject): boolean => {
      const current = world.get(id, Figure);
      if (current === undefined) return false;
      world.set(id, Figure, deepMergeJson(current, patch) as FigureData);
      return true;
    },
    joints: (id: EntityId): string[] => handle.rigOf(id)?.joints.map((j) => j.name) ?? [],
    sockets: (id: EntityId): string[] => handle.rigOf(id)?.sockets.map((s) => s.name) ?? [],
    presets: (): string[] => [...FIGURE_PRESET_IDS],
    transformOf: (id: EntityId): TransformLike | undefined => world.get(id, Transform),
  };
}
