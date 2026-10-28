import type { TerrainPyramidView } from '@bendyline/molen-terrain/client';
import { createMotionEstimator } from './prefetch';

/**
 * Predict views 2, 4, 8 and 12 seconds along a moving camera's track, at most 4 km away.
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
  let heading: { time: number; angle: number } | undefined;
  let turnRate = 0;
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
        heading = undefined;
        turnRate = 0;
        return [];
      }
      const velocity = motion.sample(nowMs, view.position);
      if (velocity === undefined) return [];
      const speed = Math.hypot(velocity[0], velocity[2]);
      // Walking/panning needs no speculative geometry; flights and fast drives do. The
      // distance cap bounds work for jets, and short steps cover the near approach first.
      if (speed < 15) {
        heading = undefined;
        turnRate = 0;
        return [];
      }
      const angle = Math.atan2(velocity[2], velocity[0]);
      if (heading && nowMs > heading.time) {
        const dt = (nowMs - heading.time) / 1000;
        const delta = Math.atan2(Math.sin(angle - heading.angle), Math.cos(angle - heading.angle));
        const rate = Math.max(-Math.PI / 12, Math.min(Math.PI / 12, delta / dt));
        turnRate += (rate - turnRate) * (1 - Math.exp(-dt / 0.35));
      }
      heading = { time: nowMs, angle };
      return [...new Set([2, 4, 8, 12].map((t) => Math.min(t, 4000 / speed)))].map((t) => {
        // Follow the measured ground track through a bank. Limit extrapolated turns to 90
        // degrees: a sharp camera movement must not spend the whole cache behind the aircraft.
        const turn = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, turnRate * t));
        const sin = Math.sin(turn),
          cos = Math.cos(turn);
        const along = Math.abs(turn) < 0.001 ? t : (sin * t) / turn;
        const across = Math.abs(turn) < 0.001 ? 0 : ((1 - cos) * t) / turn;
        return {
          ...view,
          position: [
            view.position[0] + velocity[0] * along - velocity[2] * across,
            Math.max(view.position[1] - 100, view.position[1] + velocity[1] * t),
            view.position[2] + velocity[2] * along + velocity[0] * across,
          ] as [number, number, number],
          ...(view.direction === undefined
            ? {}
            : {
                direction: [
                  view.direction[0] * cos - view.direction[2] * sin,
                  view.direction[1],
                  view.direction[2] * cos + view.direction[0] * sin,
                ] as [number, number, number],
              }),
        };
      });
    },
    reset() {
      previous = undefined;
      heading = undefined;
      turnRate = 0;
      motion.reset();
    },
  };
}
