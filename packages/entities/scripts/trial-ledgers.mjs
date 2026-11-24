/**
 * The trial ledgers: published figures each aircraft and road vehicle is scored against, and
 * the few helpers calibration and the trial runner share to read them. Calibration imports this
 * module, so it loads nothing but the aircraft ledger unless asked.
 */
import { readFileSync } from 'node:fs';

const cache = new Map();
/** A JSON document from content/entities/source, read once. */
export function sourceDocument(name) {
  if (!cache.has(name))
    cache.set(
      name,
      JSON.parse(
        readFileSync(new URL(`../../../content/entities/source/${name}`, import.meta.url), 'utf8'),
      ),
    );
  return cache.get(name);
}

export const aircraftTrialLedger = () => sourceDocument('aircraft-trials.json');
export const vehicleTrialLedger = () => sourceDocument('vehicle-trials.json');

/** Scorecard key of a ledger row: the card, told apart from its siblings by its condition. */
export function cardKey(row) {
  const condition =
    row.key ??
    [
      row.altitudeM === undefined ? undefined : `${Math.round(row.altitudeM)}m`,
      row.speedKt === undefined ? undefined : `${Math.round(row.speedKt)}kt`,
    ]
      .filter(Boolean)
      .join('-');
  return condition ? `${row.card}@${condition}` : row.card;
}

/** One aircraft's fit-role rows by card name: the figures calibration may use. */
export function aircraftFitCards(id) {
  const entry = aircraftTrialLedger().aircraft.find((candidate) => candidate.id === id);
  const cards = {};
  for (const row of entry?.cards ?? []) if (row.role === 'fit') cards[row.card] ??= row;
  return cards;
}

/** One aircraft's sourced engine and propeller facts (empty when there are none). */
export function aircraftTrialData(id) {
  return aircraftTrialLedger().aircraft.find((candidate) => candidate.id === id)?.data ?? {};
}

/**
 * The throttle of a calibration anchor. A handbook cruise figure quotes a share of rated power
 * (`powerFraction`, "75% power at 8,000 ft"); an unsupercharged engine has lost that much to the
 * thin air by then, so the lever is further forward than the share.
 */
export function anchorThrottle(reference, densityRatio, ratedDensityRatio = 1, exponent = 1) {
  if (reference.powerFraction === undefined) return reference.throttle;
  const available = Math.pow(Math.min(1, densityRatio / ratedDensityRatio), exponent);
  return Math.min(1, reference.powerFraction / available);
}
