import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { listen, PLACES } from './audio-atlas';

const category = (loops: { sound: string }[], name: string) =>
  loops.filter((l) => l.sound.startsWith(`world.${name}.`)).map((l) => l.sound);
const STREET = { streetDistance: 8 };

describe('the soundscape atlas: what plays where, and when', () => {
  it('never plays cicadas in Seattle, in any month', async () => {
    for (let month = 0; month < 12; month++) {
      const { loops } = await listen(PLACES.seattle, { month, hour: 15, seconds: 20 });
      expect(category(loops, 'insects'), `month ${month}`).toEqual([]);
    }
  });

  it('plays Pacific chorus frogs on a March night by water near Seattle, not in August', async () => {
    const spring = await listen(PLACES.seattle, {
      month: 2,
      hour: 22,
      terrain: { lakeDistance: 40 },
    });
    expect(category(spring.loops, 'frogs')).toEqual(['world.frogs.pacific-chorus.852657']);
    const august = await listen(PLACES.seattle, {
      month: 7,
      hour: 22,
      terrain: { lakeDistance: 40 },
    });
    const frogs = august.loops.filter((l) => l.sound.startsWith('world.frogs.'));
    expect(frogs.every((l) => l.gain < 0.02)).toBe(true);
  });

  it('keeps eastern birds and crickets in the east', async () => {
    const seattle = await listen(PLACES.seattle, { month: 4, hour: 7 });
    expect(category(seattle.loops, 'birds').every((s) => !s.includes('north-america'))).toBe(true);
    // In Chicago a curated robin or dove may sing instead of the regional bed; either is eastern.
    const chicago = await listen(PLACES.chicago, { month: 4, hour: 7 });
    const birds = chicago.loops
      .map((l) => l.sound)
      .filter((s) => s.startsWith('world.birds.') || s.startsWith('ambience.birds.'));
    expect(birds.length).toBeGreaterThan(0);
    for (const s of birds) expect(s).toMatch(/north-america|american_robin|mourning_dove/);
  });

  it('plays cicadas in a hot Chicago or Tokyo summer and never in their winters', async () => {
    for (const place of [PLACES.chicago, PLACES.tokyo]) {
      expect(category((await listen(place, { month: 6, hour: 14 })).loops, 'insects')).toHaveLength(
        1,
      );
      expect(category((await listen(place, { month: 0, hour: 14 })).loops, 'insects')).toEqual([]);
    }
  });

  it('gives each country its own streets: Tokyo is not Bengaluru', async () => {
    const tokyo = await listen(PLACES.tokyo, { month: 4, hour: 17, terrain: STREET });
    expect(category(tokyo.loops, 'traffic')).toEqual(['world.traffic.japan.75271']);
    const delhi = await listen(PLACES.delhi, { month: 4, hour: 17, terrain: STREET });
    expect(category(delhi.loops, 'traffic')[0]).toMatch(/south-asia|asia\.439218/);
    for (const place of [PLACES.telAviv, PLACES.london, PLACES.honolulu])
      expect(
        category((await listen(place, { month: 4, hour: 17, terrain: STREET })).loops, 'traffic'),
      ).not.toContain('world.traffic.asia.439218');
  });

  it('honks constantly in Bengaluru and almost never in Tokyo', async () => {
    const horns = async (place: { latitude: number; longitude: number }) => {
      const { shots } = await listen(place, { month: 4, hour: 17, seconds: 300, terrain: STREET });
      return Object.entries(shots)
        .filter(([s]) => s.startsWith('street.horn.'))
        .reduce((n, [, c]) => n + c, 0);
    };
    const bengaluru = await horns(PLACES.bengaluru);
    const tokyo = await horns(PLACES.tokyo);
    // Five minutes beside a street at the evening peak.
    expect(bengaluru).toBeGreaterThan(40);
    expect(tokyo).toBeLessThanOrEqual(3);
  });

  it('muffles the world through a car cabin instead of switching it off', async () => {
    const open = await listen(PLACES.paris, { month: 5, hour: 12, terrain: STREET });
    const cabin = await listen(PLACES.paris, {
      month: 5,
      hour: 12,
      mode: 'drive',
      inVehicle: true,
      terrain: STREET,
    });
    expect(open.isolationDb).toBe(0);
    expect(cabin.isolationDb).toBeGreaterThanOrEqual(20);
    expect(category(cabin.loops, 'traffic')).toEqual(category(open.loops, 'traffic'));
  });

  it('rains on the roof inside a cabin', async () => {
    const { loops } = await listen(PLACES.london, {
      month: 9,
      hour: 12,
      mode: 'drive',
      inVehicle: true,
      weather: weatherProfile('rain'),
    });
    expect(loops.map((l) => l.sound)).toContain('ambience.rain.roof');
  });

  it('sounds sirens from the right country', async () => {
    const sirens = async (place: { latitude: number; longitude: number }) =>
      Object.keys(
        (
          await listen(place, {
            month: 4,
            hour: 12,
            seconds: 1800,
            terrain: { streetDistance: 40 },
          })
        ).shots,
      ).filter((s) => s.startsWith('street.siren.'));
    for (const s of await sirens(PLACES.paris)) expect(s).toBe('street.siren.europe');
    for (const s of await sirens(PLACES.tokyo)) expect(s).toBe('street.siren.japan');
  });
});
