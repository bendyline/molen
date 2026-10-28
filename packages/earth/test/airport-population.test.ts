import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { haversineDistance } from '../src/client/airfields';
import { EarthAirportPopulation, planAirportApron } from '../src/client/airport-population';
import type { EarthAirport, EarthAirportLayout, EarthAirports } from '../src/client/airports';
import { ENTITY_TYPES } from './entity-types';

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'));
const layout = read('airports/layouts/kbfi.json') as EarthAirportLayout;
const airport = (read('airports/cells/2-5.json') as EarthAirport[]).find(
  (a) => a.id === 'KBFI',
) as EarthAirport;
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};

describe('airport apron population', () => {
  it('fits a mixed Boeing Field fleet to real apron polygons without overlapping aircraft', () => {
    const stands = planAirportApron(airport, layout, ENTITY_TYPES);
    expect(stands.length).toBeGreaterThan(8);
    expect(stands.some((s) => s.type.endsWith('.cessna_172s'))).toBe(true);
    expect(stands.some((s) => s.type.endsWith('.boeing_737_800'))).toBe(true);
    expect(stands.some((s) => s.type.endsWith('.citation_cj4'))).toBe(true);
    expect(planAirportApron(airport, layout, ENTITY_TYPES)).toEqual(stands);
    for (const [i, a] of stands.entries())
      for (const b of stands.slice(i + 1))
        expect(haversineDistance(a, b)).toBeGreaterThan(a.radius + b.radius);
    expect(
      planAirportApron(
        airport,
        { ...layout, tile: { ...layout.tile, landcover: [] } },
        ENTITY_TYPES,
      ),
    ).toEqual([]);
  });
  it('selects airline and small-airport fleets without spawning military aircraft', () => {
    const ga = planAirportApron(
      { ...airport, type: 'small_airport' },
      { ...layout, profile: undefined },
      ENTITY_TYPES,
    );
    const airline = planAirportApron(
      { ...airport, type: 'large_airport' },
      { ...layout, profile: undefined },
      ENTITY_TYPES,
    );
    expect(ga.length).toBeGreaterThan(0);
    expect(airline.length).toBeGreaterThan(0);
    expect(
      ga.every((s) => /cessna_172s|pa_28_180|cessna_182t|cirrus_sr22t|diamond_da42/.test(s.type)),
    ).toBe(true);
    expect(
      airline.every((s) => /boeing_737_800|airbus_a320neo|a220_300|embraer_e175/.test(s.type)),
    ).toBe(true);
  });
  it('retains a boarded aircraft, never refills its stand, and evicts unclaimed aircraft', async () => {
    const stands = planAirportApron(airport, layout, ENTITY_TYPES);
    const observer = stands[0];
    if (!observer) throw new Error('No stands');
    const poses = new Map<
      string,
      { latitude: number; longitude: number; occupied: boolean; speed: number }
    >();
    const spawn = vi.fn((stand) => {
      poses.set(stand.id, { ...stand, occupied: false, speed: 0 });
      return true;
    });
    const remove = vi.fn((id) => poses.delete(id));
    const data: EarthAirports = {
      layouts: [layout],
      attribution: [],
      at: async () => [airport],
      augment: async (tile) => tile,
    };
    const population = new EarthAirportPopulation(data, ENTITY_TYPES, {
      spawn,
      remove,
      pose: (id) => poses.get(id),
    });
    for (let n = 0; n < 20; n++) {
      population.update(n * 1000, observer);
      await flush();
    }
    expect(spawn.mock.calls.length).toBeLessThanOrEqual(12);
    const id = spawn.mock.calls[0]?.[0].id;
    const taken = poses.get(id);
    if (!taken) throw new Error('No spawned aircraft');
    taken.occupied = true;
    population.update(21000, observer);
    await flush();
    population.update(22000, { latitude: 0, longitude: 0 });
    await flush();
    expect(poses.has(id)).toBe(true);
    expect([...poses.keys()]).toEqual([id]);
    taken.occupied = false;
    for (let n = 23; n < 28; n++) {
      population.update(n * 1000, observer);
      await flush();
    }
    expect(spawn.mock.calls.filter(([stand]) => stand.id === id)).toHaveLength(1);
    population.dispose();
    expect(poses.has(id)).toBe(true);
  });
  it('cancels an aircraft that finishes loading after disposal', async () => {
    let complete: (() => void) | undefined;
    const remove = vi.fn();
    const population = new EarthAirportPopulation(
      { layouts: [layout], attribution: [], at: async () => [airport], augment: async (t) => t },
      ENTITY_TYPES,
      {
        spawn: () =>
          new Promise<boolean>((resolve) => {
            complete = () => resolve(true);
          }),
        remove,
        pose: () => undefined,
      },
    );
    const observer = planAirportApron(airport, layout, ENTITY_TYPES)[0];
    if (!observer) throw new Error('No stands');
    population.update(0, observer);
    await flush();
    expect(complete).toBeDefined();
    population.dispose();
    complete?.();
    await flush();
    expect(remove).toHaveBeenCalled();
  });
});
