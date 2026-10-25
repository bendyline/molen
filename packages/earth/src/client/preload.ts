import type { TerrainPyramidView } from '@bendyline/molen-terrain/client';
import { createMotionEstimator, extrapolateTrack } from './prefetch';

/**
 * Predict views 4, 8 and 12 seconds along a moving camera's track, at most 4 km away.
 * Positions are in the Earth adapter's metric world frame (already scaled from Mercator).
 * Feed the results to `TerrainPyramidStream.update(view, futureViews)` for hidden terrain,
 * semantic-layer and GPU preparation, independently of the optional byte cache.
 */
export function createEarthTilePreloader(): {
  views(nowMs: number, view: TerrainPyramidView, steady: boolean): TerrainPyramidView[];
  reset(): void;
} {
  const motion = createMotionEstimator({ smoothingSeconds: 0.5 });
  let previous: { time: number; position: readonly number[] } | undefined;
  return {
    views(nowMs, view, steady) {
      const jumped =
        previous !== undefined &&
        (nowMs - previous.time > 2000 ||
          Math.hypot(...view.position.map((value, i) => value - (previous?.position[i] ?? value))) >
            2000);
      previous = { time: nowMs, position: [...view.position] };
      if (!steady || jumped) {
        motion.reset();
        return [];
      }
      const velocity = motion.sample(nowMs, view.position);
      if (velocity === undefined) return [];
      const speed = Math.hypot(velocity[0], velocity[2]);
      // Walking/panning needs no speculative geometry; flights and fast drives do. The
      // distance cap bounds work for jets, and short steps cover the near approach first.
      if (speed < 15) return [];
      const scale = Math.min(1, 4000 / (speed * 12));
      return extrapolateTrack(
        view.position,
        velocity,
        [4, 8, 12].map((t) => t * scale),
        {
          minY: view.position[1] - 100,
        },
      ).map(({ position }) => ({ ...view, position }));
    },
    reset() {
      previous = undefined;
      motion.reset();
    },
  };
}
