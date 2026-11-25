import { dmath as m } from '../dmath';

/**
 * What a trial is scored against: a published figure (`tolerance` is a fraction of `value`),
 * or the band a standard allows, open on a side it does not name.
 */
export type TrialReference = { value: number; tolerance: number } | { min?: number; max?: number };

/**
 * `pass` and `fail` compare a measurement with a reference; `unscored` has a measurement and no
 * reference to hold it to; `unmeasured` is a trial the vehicle could not complete.
 */
export type TrialStatus = 'pass' | 'fail' | 'unscored' | 'unmeasured';

export interface TrialScore {
  status: TrialStatus;
  /**
   * Signed error as a fraction of the reference: 0.1 is 10% high. Against a band, how far
   * outside it the measurement fell, as a fraction of the limit it missed; 0 inside.
   */
  error?: number;
}

export function scoreTrial(measured: number | undefined, reference?: TrialReference): TrialScore {
  if (measured === undefined || !Number.isFinite(measured)) return { status: 'unmeasured' };
  if (!reference) return { status: 'unscored' };
  if (!('value' in reference)) {
    const { min, max } = reference;
    const below = min !== undefined && measured < min;
    const above = max !== undefined && measured > max;
    const missed = below ? min : above ? max : undefined;
    if (missed === undefined) return { status: 'pass', error: 0 };
    return { status: 'fail', error: (measured - missed) / m.max(m.abs(missed), 1e-9) };
  }
  const error = (measured - reference.value) / m.abs(reference.value);
  return { status: m.abs(error) <= reference.tolerance ? 'pass' : 'fail', error };
}

export interface ScorecardChange {
  /** Cards that passed in the baseline and do not pass now. */
  regressions: string[];
  /** Cards that pass now and did not in the baseline. */
  improvements: string[];
  /** Cards in one scorecard and not the other. */
  added: string[];
  removed: string[];
  passed: number;
  baselinePassed: number;
}

/**
 * Compare a run with the recorded scorecard. A scorecard is a budget, not a gate: failing cards
 * are allowed, but a card that passed may not stop passing.
 */
export function compareScorecards(
  baseline: Readonly<Record<string, { status: TrialStatus }>>,
  current: Readonly<Record<string, { status: TrialStatus }>>,
): ScorecardChange {
  const change: ScorecardChange = {
    regressions: [],
    improvements: [],
    added: [],
    removed: [],
    passed: 0,
    baselinePassed: 0,
  };
  for (const [id, card] of Object.entries(current)) {
    const before = Object.hasOwn(baseline, id) ? baseline[id] : undefined;
    if (card.status === 'pass') change.passed++;
    if (!before) change.added.push(id);
    else if (before.status === 'pass' && card.status !== 'pass') change.regressions.push(id);
    else if (before.status !== 'pass' && card.status === 'pass') change.improvements.push(id);
  }
  for (const [id, card] of Object.entries(baseline)) {
    if (card.status === 'pass') change.baselinePassed++;
    if (!Object.hasOwn(current, id)) change.removed.push(id);
  }
  return change;
}
