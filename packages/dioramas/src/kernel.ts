import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import {
  buildWorld,
  Transform,
  takeDelta,
  takeKeyframe,
  type World,
} from '@bendyline/molen-kernel';
import { type Vec3, validate } from '@bendyline/molen-schema';
import type { DioramaBounds, DioramaDefinition, DioramaPlayback } from './types';

export type { DioramaBounds, DioramaDefinition, DioramaPlayback } from './types';

export function validateDioramaBounds(bounds: DioramaBounds): void {
  if (bounds.min.length !== 3 || bounds.max.length !== 3)
    throw new Error('Diorama bounds must have three coordinates');
  for (let axis = 0; axis < 3; axis++) {
    const min = bounds.min[axis];
    const max = bounds.max[axis];
    if (
      min === undefined ||
      max === undefined ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max
    )
      throw new Error('Diorama bounds need finite min < max on every axis');
  }
}

/**
 * A diorama is a normal scripted world in local meters. It owns its RNG, entity ids, timers,
 * script state and figures. Discarding one cannot leave systems in the surrounding world.
 * Scripts use the normal trust contract; bounds and budgets are authoring guards, not a sandbox.
 */
export function createDiorama(definition: DioramaDefinition): DioramaPlayback {
  validateDioramaBounds(definition.bounds);
  const bounds = structuredClone(definition.bounds);
  const budget = definition.maxEntities ?? 512;
  if (!Number.isSafeInteger(budget) || budget < 1)
    throw new Error('Diorama maxEntities must be a positive integer');
  const checked = validate('scene', definition.scene);
  if (!checked.ok) throw new Error(checked.formatted);
  const scene = checked.value;
  if (scene.physics?.engine === 'rapier' || scene.terrain || scene.ambient)
    throw new Error(
      'Dioramas support scripted/kinematic scenes; terrain, ambient networks and Rapier belong to the host',
    );
  // Include component-less entities in the budget; all visible origins stay in the local box.
  const guard = (world: World): void => {
    if (world.entityCount > budget) throw new Error(`Diorama exceeds its ${budget}-entity budget`);
    for (const [id, transform] of world.query(Transform)) {
      const pos = transform.pos.map((value, axis) =>
        Math.max(bounds.min[axis] as number, Math.min(bounds.max[axis] as number, value)),
      ) as Vec3;
      if (pos.some((value, axis) => value !== transform.pos[axis]))
        world.set(id, Transform, { ...transform, pos });
    }
  };
  let world: World | undefined = buildWorld(scene, undefined, {
    capabilities: [(w) => ({ figures: figuresScriptApi(installFigures(w)) })],
  });
  guard(world);
  let accumulator = 0;
  let tick = world.tick;
  const tickRate = world.tickRate;
  return {
    get tick() {
      return tick;
    },
    tickRate,
    keyframe() {
      if (!world) throw new Error('Diorama is disposed');
      return takeKeyframe(world);
    },
    advance(seconds) {
      if (!world) return undefined;
      if (!Number.isFinite(seconds) || seconds < 0)
        throw new Error('Diorama elapsed time must be finite and nonnegative');
      accumulator += Math.min(seconds, 0.2) * tickRate;
      const steps = Math.floor(accumulator + 1e-9);
      if (steps === 0) return undefined;
      accumulator = Math.max(0, accumulator - steps);
      const baseTick = tick;
      for (let n = 0; n < steps; n++) {
        world.step();
        guard(world);
      }
      tick = world.tick;
      return takeDelta(world, baseTick);
    },
    dispose() {
      world = undefined;
      accumulator = 0;
    },
  };
}
