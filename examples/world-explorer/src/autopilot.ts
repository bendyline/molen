/**
 * A scripted flight for repeatable streaming checks: `?autopilot=circle&speed=250&alt=900`.
 *
 * Reproducing a streaming complaint by hand means flying the same line twice, which nobody does.
 * This flies it exactly: a straight line, or a level circle of `radius` meters, at `speed` m/s
 * from the start the URL's `lat`, `lon`, `alt` and `yaw` give, with the camera along the flight
 * path and `dive` radians below it. Set `quality=` as well, or the adaptive tier changes under the
 * measurement. `start` waits that many seconds on the spot, so the opening view can stream in and
 * the run measures flight rather than page load.
 */

export interface AutopilotPose {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export interface AutopilotOptions {
  mode: 'straight' | 'circle';
  speed: number;
  radius: number;
  dive: number;
  startSeconds: number;
  /** Circle direction: 1 turns right. */
  turn: 1 | -1;
}

export function autopilotOptions(params: URLSearchParams): AutopilotOptions | undefined {
  const mode = params.get('autopilot');
  if (mode !== 'straight' && mode !== 'circle') return undefined;
  const number = (name: string, fallback: number): number => {
    const value = Number(params.get(name) ?? fallback);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    mode,
    speed: number('speed', 250),
    radius: Math.max(1, number('radius', 4000)),
    dive: number('dive', 0.12),
    startSeconds: number('start', 8),
    turn: params.get('turn') === 'left' ? -1 : 1,
  };
}

/** The pose `seconds` into the flight, starting at `start` facing `startYaw`. */
export function autopilotPose(
  options: AutopilotOptions,
  start: readonly [number, number, number],
  startYaw: number,
  seconds: number,
): AutopilotPose {
  const flown = Math.max(0, seconds - options.startSeconds) * options.speed;
  if (options.mode === 'straight') {
    return {
      position: [
        start[0] + Math.cos(startYaw) * flown,
        start[1],
        start[2] + Math.sin(startYaw) * flown,
      ],
      yaw: startYaw,
      pitch: -options.dive,
    };
  }
  // Yaw grows clockwise seen from above, so the center of a right turn sits at yaw + 90 degrees.
  const { radius, turn } = options;
  const yaw = startYaw + (turn * flown) / radius;
  const toCenter = startYaw + (turn * Math.PI) / 2;
  const centerX = start[0] + Math.cos(toCenter) * radius;
  const centerZ = start[2] + Math.sin(toCenter) * radius;
  const fromCenter = yaw - (turn * Math.PI) / 2;
  return {
    position: [
      centerX + Math.cos(fromCenter) * radius,
      start[1],
      centerZ + Math.sin(fromCenter) * radius,
    ],
    yaw,
    pitch: -options.dive,
  };
}
