import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { performanceLedger, referenceSpeed } from '../scripts/aircraft-performance.mjs';
import { flyLevel, flyRotorLevel, levelSpeedRoots, trimPoint } from '../scripts/flight-bench.mjs';

const types = JSON.parse(
  readFileSync(
    new URL('../../../content/entities/types/aircraft.types.json', import.meta.url),
    'utf8',
  ),
).types;
const spec = (suffix) => types[`molen.entities.aircraft.${suffix}`].components.aircraft.spec;

it('covers every shipped aircraft and distinguishes sourced anchors from estimates', () => {
  expect(performanceLedger.aircraft.map((p) => p.id).sort()).toEqual(Object.keys(types).sort());
  for (const p of performanceLedger.aircraft) {
    expect(performanceLedger.sources[p.reference.source].url).toMatch(/^https:\/\//);
    expect(p.reference.evidence).toBeTruthy();
    expect(p.reference.massKg).toBe(types[p.id].components.aircraft.spec.mass);
  }
});
describe.each(performanceLedger.aircraft)('$slug production flight integration', (p) => {
  it('accelerates toward its declared cruise/maximum anchor while holding altitude', () => {
    const s = types[p.id].components.aircraft.spec,
      target = referenceSpeed(p);
    const result = (s.airplane ? flyLevel : flyRotorLevel)(s, {
      speed: target * 0.85,
      altitude: p.reference.altitudeM,
      power: p.reference.throttle,
      seconds: 180,
    });
    expect(result.state.airspeed / target).toBeGreaterThan(1 - p.reference.tolerance);
    expect(result.state.airspeed / target).toBeLessThan(1 + p.reference.tolerance);
    expect(result.maxAltitudeError).toBeLessThan(100);
  });
});
it('checks a withheld DA42 cruise condition: 175 KTAS at 75% and 16000 ft', () => {
  // Manufacturer publishes this separately from the 190 KTAS MCP calibration anchor.
  const at = levelSpeedRoots(spec('diamond_da42'), 4877, { power: 0.75 }).at(-1);
  expect((at.speed * 3600) / 1852).toBeGreaterThan(166);
  expect((at.speed * 3600) / 1852).toBeLessThan(184);
});
it('permits F-22 dry supercruise while reheat provides additional thrust', () => {
  const jet = spec('f_22a'),
    at = trimPoint(jet, 1.5 * 295.15, 11000, { power: 0.85 });
  expect(at.excessThrust).toBeGreaterThan(0);
  expect(trimPoint(jet, at.speed, 11000, { power: 1 }).thrust).toBeGreaterThan(at.thrust);
});
it('does not extrapolate fighter calibration into runaway speed in the thin upper atmosphere', () => {
  for (const p of performanceLedger.aircraft.filter((p) => p.afterburnerThrustN)) {
    const s = types[p.id].components.aircraft.spec;
    const reference = referenceSpeed(p);
    const high = levelSpeedRoots(s, 15000).at(-1);
    expect(high?.speed ?? 0, p.id).toBeLessThan(reference * 1.1);
    const sea = levelSpeedRoots(s, 0).at(-1);
    expect(high?.speed ?? 0, p.id).toBeGreaterThan(sea.speed);
  }
});
it('slows down with gear/flaps, gains stall margin with flaps, and responds to hot air', () => {
  const plane = spec('baron_g58');
  const clean = levelSpeedRoots(plane, 2000).at(-1),
    dirty = levelSpeedRoots(plane, 2000, { gear: true, flaps: 1 }).at(-1);
  expect(dirty.speed).toBeLessThan(clean.speed * 0.85);
  let cleanMinimum = 0,
    flapMinimum = 0;
  for (let speed = 10; speed < 100; speed++) {
    if (!cleanMinimum && trimPoint(plane, speed, 0)) cleanMinimum = speed;
    if (!flapMinimum && trimPoint(plane, speed, 0, { flaps: 1 })) flapMinimum = speed;
  }
  expect(flapMinimum).toBeLessThan(cleanMinimum);
  const hot = trimPoint(plane, 90, 2000, { weather: { atmosphere: { temperatureK: 318.15 } } });
  const cool = trimPoint(plane, 90, 2000);
  expect(hot.thrust).toBeLessThan(cool.thrust);
});
it('is invariant to uniform wind and converges across external tick rates', () => {
  const plane = spec('cessna_172s'),
    config = { speed: 60, altitude: 2000, power: 0.75, seconds: 20 };
  const still = flyLevel(plane, config),
    wind = flyLevel(plane, { ...config, wind: [12, 0, -8] });
  expect(wind.state.airspeed).toBeCloseTo(still.state.airspeed, 5);
  expect(wind.transform.pos[0] - still.transform.pos[0]).toBeCloseTo(240, 4);
  const fine = flyLevel(plane, { ...config, hz: 60 });
  expect(fine.state.airspeed).toBeCloseTo(still.state.airspeed, 1);
  expect(Math.abs(fine.transform.pos[1] - still.transform.pos[1])).toBeLessThan(0.5);
});
