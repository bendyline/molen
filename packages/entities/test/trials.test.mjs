import { readFileSync } from 'node:fs';
import { compareScorecards } from '@bendyline/molen-kernel/trials';
import { describe, expect, it } from 'vitest';
import {
  aircraftTrialRows,
  checkTrialLedger,
  FLIGHT_CARDS,
  ROAD_CARDS,
  TRIAL_DOMAINS,
  vehicleTrialRows,
} from '../scripts/trial-cards.mjs';
import { aircraftTrialLedger, vehicleTrialLedger } from '../scripts/trial-ledgers.mjs';

const short = (id) => id.slice(id.lastIndexOf('.') + 1);
const recorded = (domain) => JSON.parse(readFileSync(TRIAL_DOMAINS[domain].scorecard, 'utf8'));
/** The recorded cards of one vehicle, by the name its scorecard keys start with. */
const cardsOf = (scorecard, name) =>
  Object.fromEntries(Object.entries(scorecard.cards).filter(([key]) => key.startsWith(`${name}/`)));

describe('trial ledgers', () => {
  it('declare a source, a role and an evidence class behind every published figure', () => {
    const aircraft = aircraftTrialLedger();
    expect(checkTrialLedger(aircraft, FLIGHT_CARDS, aircraft.aircraft)).toEqual([]);
    const vehicles = vehicleTrialLedger();
    expect(checkTrialLedger(vehicles, ROAD_CARDS, vehicles.vehicles)).toEqual([]);
  });

  it('keeps fitted figures apart from the ones that check them', () => {
    const aircraft = aircraftTrialLedger().aircraft.flatMap((entry) => entry.cards);
    // A check is worth something only while calibration cannot see it.
    expect(aircraft.filter((row) => row.role === 'check').length).toBeGreaterThan(60);
    expect(aircraft.filter((row) => row.role === 'fit').length).toBeGreaterThan(60);
    for (const row of vehicleTrialLedger().vehicles.flatMap((entry) => entry.cards))
      expect(row.role).toBe('check');
  });
});

// Each aircraft flies its cards in a second or two locally, several times that on CI runners.
describe.each([...aircraftTrialRows().keys()].map(short))('%s flight trials', (name) => {
  it('passes every card the recorded scorecard says it passes', () => {
    const run = TRIAL_DOMAINS.aircraft.run([name]);
    const change = compareScorecards(cardsOf(recorded('aircraft'), name), run.cards);
    expect(change.regressions).toEqual([]);
    // A card added to or dropped from the ledger must be recorded: pnpm aircraft:trials --write
    expect([change.added, change.removed]).toEqual([[], []]);
  }, 60000);
});

describe('road vehicle trials', () => {
  it('passes every card the recorded scorecard says it passes', () => {
    expect(vehicleTrialRows().size).toBeGreaterThan(120);
    const run = TRIAL_DOMAINS.vehicles.run();
    const change = compareScorecards(recorded('vehicles').cards, run.cards);
    expect(change.regressions).toEqual([]);
    // A card added to or dropped from the ledger must be recorded: pnpm vehicles:trials --write
    expect([change.added, change.removed]).toEqual([[], []]);
  }, 120000);
});
