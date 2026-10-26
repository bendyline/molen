import type { JsonObject } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent } from './component';
import type { World } from './world';

export interface BoostModeData extends JsonObject {
  enabled: boolean;
}

/** World-wide travel assist. Author one on a scene's settings entity. */
export const BoostMode: ComponentType<BoostModeData> = defineComponent<BoostModeData>('boostMode');

export function isBoostMode(world: World): boolean {
  return world.query(BoostMode).first()?.[1].enabled ?? false;
}

/** Stored in ECS state so checkpoints and replay preserve the mode. */
export function setBoostMode(world: World, enabled: boolean): void {
  const existing = world.query(BoostMode).first();
  if (existing) {
    if (existing[1].enabled !== enabled) world.set(existing[0], BoostMode, { enabled });
  } else if (enabled) world.spawnRaw({ boostMode: { enabled } });
}
