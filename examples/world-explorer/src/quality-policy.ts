import { AdaptiveQualityController } from '@bendyline/molen-client';
import { EARTH_STICKY_QUALITY } from '@bendyline/molen-earth/client';

/** The highest tier Auto reaches by itself. `?tier=5` still pins Ultra for measurement. */
export const EXPLORER_AUTO_CEILING = 4;

/**
 * Start at Balanced, then probe up to High using sustained frame/CPU/GPU headroom.
 * High rebuilds buildings across the view, so use the slow recovery timings from the start.
 * Keep this controller for the session: replacing it after calibration would discard failed
 * probe backoff and allow the same expensive upgrade again. Manual selections reset it.
 *
 * Auto stops at High. Ultra's frames fit a fast desktop at rest (15 of 16.7 ms), so the controller
 * climbed into it, but its view alone holds most of the terrain cache: on a 32-thread workstation
 * with a 2 GiB cache, a circling flight rebuilt 63% of its tiles after eviction, a 90-degree look
 * took 20 s to fill in, and the page froze for over a second. Frame times show none of that, so
 * the controller is also told when streaming is strained (see `streamStrain`), and a level needs
 * frame work under 0.6 of the target before stepping up rather than 0.9.
 */
export function createExplorerQualityController(initialLevel = 3): AdaptiveQualityController {
  return new AdaptiveQualityController({
    initialLevel,
    maxLevel: EXPLORER_AUTO_CEILING,
    upgradeWorkFraction: 0.6,
    ...EARTH_STICKY_QUALITY,
  });
}

/** Cumulative stream counters and cache pressure, as the explorer samples them. */
export interface StreamStrainSample {
  nowMs: number;
  builtTiles: number;
  rebuiltTiles: number;
  residentBytes: number;
  displayedBytes: number;
  maxResidentBytes: number | undefined;
}

/**
 * Whether the current level asks for more than the terrain cache can hold: over the last ten
 * seconds half or more of the tiles built had been built before and evicted, or the view
 * itself fills most of a full cache, so nothing just left can stay warm. Both come from the
 * level's own demand (a lower level selects fewer, coarser tiles), not from a slow network.
 */
export function createStreamStrainMeter(): (sample: StreamStrainSample) => boolean {
  const history: StreamStrainSample[] = [];
  return (sample) => {
    history.push(sample);
    while (history.length > 1 && sample.nowMs - (history[0] as StreamStrainSample).nowMs > 10_000)
      history.shift();
    const oldest = history[0] as StreamStrainSample;
    const built = sample.builtTiles - oldest.builtTiles;
    const rebuilt = sample.rebuiltTiles - oldest.rebuiltTiles;
    const thrashing = built >= 20 && rebuilt / built >= 0.5;
    const cap = sample.maxResidentBytes;
    const crowded =
      cap !== undefined &&
      cap > 0 &&
      sample.residentBytes >= cap * 0.97 &&
      sample.displayedBytes >= cap * 0.6;
    return thrashing || crowded;
  };
}
