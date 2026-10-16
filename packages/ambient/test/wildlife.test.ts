import { describe, expect, it } from 'vitest';
import { stepWildlife, type WildlifeWorld, wildlifeCandidates } from '../src/kernel/wildlife';
import { type WildlifeSpecies, wildlifeSpeciesSchema } from '../src/kernel/wildlife-types';

const deer: WildlifeSpecies = {
  id: 'test.deer',
  version: 1,
  title: 'Deer silhouette',
  body: {
    family: 'ungulate',
    height: 1,
    length: 1.5,
    width: 0.4,
    color: '#887766',
    accent: '#ccbb99',
    details: ['antlers'],
  },
  motion: 'walk',
  speed: 1.2,
  roam: 25,
  clearance: 0,
  rest: 0.35,
  margin: 0.3,
};
const species = new Map([[deer.id, deer]]);
const world: WildlifeWorld = {
  choices: () => [{ species: deer, density: 100, habitats: ['forest'] }],
  habitat: () => ({ kind: 'forest', safe: true, height: 3, water: false }),
};
const budget = { animals: 256, radius: 400, density: 1 };

describe('ambient wildlife', () => {
  it('uses stable candidates and nested density, with strict count and altitude caps', () => {
    const all = wildlifeCandidates(world, [0, 3, 0], budget);
    expect(all.length).toBeGreaterThan(20);
    const thin = wildlifeCandidates(world, [0, 3, 0], { ...budget, density: 0.4 });
    expect(thin.length).toBeLessThan(all.length);
    expect(
      thin.every((animal) =>
        all.some(
          (other) =>
            other.id === animal.id &&
            JSON.stringify(other.position) === JSON.stringify(animal.position),
        ),
      ),
    ).toBe(true);
    expect(wildlifeCandidates(world, [0, 3, 0], { ...budget, animals: 5 })).toEqual(
      all.slice(0, 5),
    );
    expect(wildlifeCandidates(world, [0, 1000, 0], budget)).toEqual([]);
    expect(wildlifeCandidates(world, [0, 3, 0], budget)).toEqual(all);
  });

  it('checks the actual spawn point at a regional boundary and rejects roads, water and unknown ground', () => {
    for (const habitat of [
      undefined,
      { kind: 'forest', safe: false, height: 3, water: false },
      { kind: 'water', safe: true, height: 3, water: true },
    ])
      expect(wildlifeCandidates({ ...world, habitat: () => habitat }, [0, 3, 0], budget)).toEqual(
        [],
      );
    const boundary: WildlifeWorld = {
      ...world,
      choices: (x, z) => (x > 0 ? world.choices(x, z) : []),
    };
    expect(
      wildlifeCandidates(boundary, [0, 3, 0], budget).every((animal) => animal.position[0] > 0),
    ).toBe(true);
  });

  it('keeps deterministic state within its home radius and supports a plain-data restore', () => {
    const initial = wildlifeCandidates(world, [0, 3, 0], { ...budget, animals: 5 });
    const untouched = structuredClone(initial);
    let current = initial;
    for (let tick = 0; tick < 500; tick++) current = stepWildlife(current, species, world, tick);
    const restored = structuredClone(current);
    expect(stepWildlife(current, species, world, 500)).toEqual(
      stepWildlife(restored, species, world, 500),
    );
    for (const animal of current)
      expect(
        Math.hypot(animal.position[0] - animal.anchor[0], animal.position[2] - animal.anchor[1]),
      ).toBeLessThanOrEqual(deer.roam + 0.001);
    expect(initial).toEqual(untouched);
    expect(current.some((animal, i) => animal.position[0] !== initial[i]?.position[0])).toBe(true);
  });

  it('does not cross narrow exclusions or walk out of the allowed range', () => {
    const initial = wildlifeCandidates(world, [0, 3, 0], { ...budget, animals: 1 });
    const first = initial[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    first.position = [0, 3, 0];
    first.anchor = [0, 0];
    first.target = [10, 0];
    first.nextDecision = 100;
    const barrier: WildlifeWorld = {
      ...world,
      habitat: (x) => ({ kind: 'forest', safe: x < 0.02, height: 3, water: false }),
    };
    expect(stepWildlife(initial, species, barrier, 1)[0]?.position).toEqual([0, 3, 0]);
    const edge: WildlifeWorld = {
      ...world,
      choices: (x, z) => (x < 0.02 ? world.choices(x, z) : []),
    };
    expect(stepWildlife(initial, species, edge, 1)[0]?.position).toEqual([0, 3, 0]);
  });

  it('requires attributed ranges for named species', () => {
    expect(wildlifeSpeciesSchema.safeParse({ ...deer, taxon: 'Capreolus capreolus' }).success).toBe(
      false,
    );
    expect(
      wildlifeSpeciesSchema.safeParse({
        ...deer,
        taxon: 'Capreolus capreolus',
        range: 'Capreolus_capreolus',
      }).success,
    ).toBe(true);
  });
});
