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
  /**
   * Speed swings this fraction either side of `speed`, over `wavePeriod` seconds (default 0 and
   * 20): a pilot on the throttle, for what speed changes do to streaming.
   */
  wave?: number;
  wavePeriod?: number;
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
    wave: Math.max(0, Math.min(0.9, number('wave', 0))),
    wavePeriod: Math.max(1, number('wavePeriod', 20)),
  };
}

/** The pose `seconds` into the flight, starting at `start` facing `startYaw`. */
export function autopilotPose(
  options: AutopilotOptions,
  start: readonly [number, number, number],
  startYaw: number,
  seconds: number,
): AutopilotPose {
  const t = Math.max(0, seconds - options.startSeconds);
  // Distance at speed * (1 + wave * sin(2 pi t / period)): the flight starts at `speed`.
  const wave = options.wave ?? 0;
  const period = options.wavePeriod ?? 20;
  const flown =
    options.speed *
    (t + ((wave * period) / (2 * Math.PI)) * (1 - Math.cos((2 * Math.PI * t) / period)));
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
