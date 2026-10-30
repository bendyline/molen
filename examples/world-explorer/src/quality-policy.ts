import { AdaptiveQualityController } from '@bendyline/molen-client';
import { EARTH_STICKY_QUALITY } from '@bendyline/molen-earth/client';

/**
 * Start at Balanced, then probe all six tiers using sustained frame/CPU/GPU headroom.
 * High rebuilds buildings across the view, so use the slow recovery timings from the start.
 * Keep this controller for the session: replacing it after calibration would discard failed
 * probe backoff and allow the same expensive upgrade again. Manual selections reset it.
 */
export function createExplorerQualityController(initialLevel = 3): AdaptiveQualityController {
  return new AdaptiveQualityController({
    initialLevel,
    maxLevel: 5,
    ...EARTH_STICKY_QUALITY,
  });
}
