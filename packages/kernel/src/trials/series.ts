import { dmath as m } from '../dmath';

/** One reading of a recorded quantity: seconds since the start of the trial, and its value. */
export type TrialSample = readonly [seconds: number, value: number];

export interface Oscillation {
  /** Seconds for one full cycle; undefined when the record does not swing back and forth. */
  period: number | undefined;
  /** Damping ratio from the decay of successive swings; negative for a growing oscillation. */
  dampingRatio: number | undefined;
  /** How many times the value turned back: half-cycles seen. */
  crossings: number;
  /** Largest departure from the settled value. */
  amplitude: number;
  /** The level the value settled at: the mean of the last tenth of the record. */
  settled: number;
}

/**
 * The record's turning points: each maximum and minimum it retreats from by more than `band`,
 * and before them the extreme it started from.
 */
function turningPoints(samples: readonly TrialSample[], band: number): TrialSample[] {
  const points: TrialSample[] = [];
  const first = samples[0];
  if (!first) return points;
  let high = first;
  let low = first;
  let direction = 0;
  for (const sample of samples) {
    if (sample[1] > high[1]) high = sample;
    if (sample[1] < low[1]) low = sample;
    if (direction >= 0 && sample[1] < high[1] - band) {
      points.push(high);
      direction = -1;
      low = sample;
    } else if (direction <= 0 && sample[1] > low[1] + band) {
      points.push(low);
      direction = 1;
      high = sample;
    }
  }
  return points;
}

/**
 * Period and damping of a recorded response, from its swings between turning points, so a slow
 * drift of the level it swings about does not pass for growth or decay. A quantity that moves
 * to a new level and stays there (no oscillation) has no period.
 *
 * `released` says the record starts at rest, displaced from where it will settle: the starting
 * value is then the first free peak, and a response that returns without overshoot is reported
 * as critically damped (a damping ratio of 1).
 */
export function oscillation(
  samples: readonly TrialSample[],
  settled?: number,
  released = false,
): Oscillation {
  const count = samples.length;
  const tail = m.max(1, m.floor(count / 10));
  let level = settled ?? 0;
  if (settled === undefined) {
    for (let i = count - tail; i < count; i++) level += (samples[i]?.[1] ?? 0) / tail;
  }
  let amplitude = 0;
  let lowest = Infinity;
  let highest = -Infinity;
  for (const [, value] of samples) {
    amplitude = m.max(amplitude, m.abs(value - level));
    lowest = m.min(lowest, value);
    highest = m.max(highest, value);
  }
  // Ripples under a hundredth of the record's range are not swings.
  const points = turningPoints(samples, 0.01 * m.max(0, highest - lowest));
  // Where the trial began is a free peak only if it began at rest; the turning points after
  // it always are.
  const free = released ? points : points.slice(1);
  const [a, b, c] = free;
  let dampingRatio: number | undefined;
  let period: number | undefined;
  // Each swing is smaller than the one before by the same ratio, whatever level they are about.
  let ratio: number | undefined;
  if (a && b && c) {
    ratio = m.abs(c[1] - b[1]) / m.max(m.abs(b[1] - a[1]), 1e-12);
    period = c[0] - a[0];
  } else if (a && b) {
    period = 2 * (b[0] - a[0]);
    // One overshoot and no more: its size against the displacement it came from.
    if (released) ratio = m.abs(b[1] - level) / m.max(m.abs(a[1] - level), 1e-12);
  } else if (released && amplitude > 0) dampingRatio = 1;
  if (ratio !== undefined && ratio > 0) {
    const decrement = -m.log(ratio);
    dampingRatio = decrement / m.sqrt(m.PI * m.PI + decrement * decrement);
  }
  return {
    period,
    dampingRatio,
    crossings: m.max(0, points.length - 1),
    amplitude,
    settled: level,
  };
}

/** Rate of change of a record by central differences over `span` samples each side. */
export function rateOfChange(samples: readonly TrialSample[], span = 2): TrialSample[] {
  const rates: TrialSample[] = [];
  for (let i = span; i < samples.length - span; i++) {
    const before = samples[i - span];
    const after = samples[i + span];
    const at = samples[i];
    if (!before || !after || !at) continue;
    rates.push([at[0], (after[1] - before[1]) / (after[0] - before[0])]);
  }
  return rates;
}
