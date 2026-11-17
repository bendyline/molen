import { describe, expect, it } from 'vitest';
import { fnv1a, q4, unit01 } from '../src/kernel/ids';
import {
  stepWildlife,
  WILDLIFE_CELL_METERS,
  type WildlifeAgent,
  type WildlifeBudget,
  type WildlifeWorld,
  wildlifeCandidates,
} from '../src/kernel/wildlife';
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
const bird: WildlifeSpecies = {
  ...deer,
  id: 'test.bird',
  title: 'Bird silhouette',
  body: { ...deer.body, family: 'bird', height: 0.15, length: 0.18, width: 0.08, details: [] },
  motion: 'fly',
  speed: 3,
  roam: 30,
  clearance: 4,
  rest: 0,
  margin: 0.2,
};
const fish: WildlifeSpecies = {
  ...deer,
  id: 'test.fish',
  title: 'Fish silhouette',
  body: { ...deer.body, family: 'fish', height: 0.12, length: 0.35, width: 0.08, details: [] },
  motion: 'swim',
  clearance: 0.4,
  rest: 0,
  margin: 0.2,
};

/** Every cell within the radius read, every candidate weighed, then the nearest kept. */
function exhaustive(
  world: WildlifeWorld,
  observer: readonly [number, number, number],
  { animals, radius, density }: WildlifeBudget,
): WildlifeAgent[] {
  const size = WILDLIFE_CELL_METERS;
  const found: Array<{ agent: WildlifeAgent; distance: number }> = [];
  for (
    let row = Math.floor((observer[2] - radius) / size);
    row <= Math.floor((observer[2] + radius) / size);
    row++
  )
    for (
      let column = Math.floor((observer[0] - radius) / size);
      column <= Math.floor((observer[0] + radius) / size);
      column++
    )
      for (const choice of world.choices((column + 0.5) * size, (row + 0.5) * size)) {
        const species = choice.species;
        const id = `${species.id}@${species.version}/${column}/${row}`;
        const seed = fnv1a(id);
        const chance = (rule: { density: number }): number =>
          Math.min(1, (rule.density * size * size) / 1_000_000) * density;
        if (unit01(seed, 0) >= chance(choice)) continue;
        const x = q4((column + 0.15 + unit01(seed, 1) * 0.7) * size);
        const z = q4((row + 0.15 + unit01(seed, 2) * 0.7) * size);
        const distance = (x - observer[0]) ** 2 + (z - observer[2]) ** 2;
        const actual = world.choices(x, z).find((entry) => entry.species.id === species.id);
        const habitat = world.habitat(x, z, species.margin);
        if (
          distance > radius * radius ||
          actual === undefined ||
          unit01(seed, 0) >= chance(actual) ||
          habitat?.safe !== true ||
          !Number.isFinite(habitat.height) ||
          (species.motion !== 'fly' && (species.motion === 'swim') !== habitat.water) ||
          !actual.habitats.includes(habitat.kind)
        )
          continue;
        const y =
          habitat.height +
          (species.motion === 'fly'
            ? species.clearance
            : species.motion === 'swim'
              ? -species.clearance
              : 0);
        if ((y - observer[1]) ** 2 + distance > radius * radius) continue;
        found.push({
          distance,
          agent: {
            id,
            species: species.id,
            seed,
            anchor: [x, z],
            position: [x, q4(y), z],
            target: [x, z],
            heading: unit01(seed, 3) * Math.PI * 2,
            speed: 0,
            since: 0,
            nextDecision: 0,
            decisions: 0,
            phase: unit01(seed, 4),
          },
        });
      }
  return found
    .sort((a, b) => a.distance - b.distance || (a.agent.id < b.agent.id ? -1 : 1))
    .slice(0, animals)
    .map(({ agent }) => agent);
}

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

  it('reads the nearest cells first and answers as a scan of every cell does', () => {
    // Patchy ground: road stripes, a lake to the west, two densities, land with no animals.
    const patchy: WildlifeWorld = {
      choices: (x, z) =>
        x > 600
          ? []
          : [
              { species: deer, density: z > 0 ? 80 : 20, habitats: ['forest', 'grass'] },
              { species: bird, density: 100, habitats: ['forest', 'grass', 'water'] },
              { species: fish, density: 60, habitats: ['water'] },
            ],
      habitat: (x, z) => {
        const water = x < -250;
        return {
          kind: water ? 'water' : Math.floor(z / 150) % 2 === 0 ? 'forest' : 'grass',
          safe: water || Math.abs(x % 40) > 9,
          height: 3 + Math.abs(x) / 50,
          water,
        };
      },
    };
    const observers = [
      [0, 3, 0],
      [37.5, 8, -412.25],
      [-300, 3, 96],
      [590, 40, 10],
      [0, 300, 0],
      [0, 1000, 0],
    ] as const;
    let animals = 0;
    for (const observer of observers)
      for (const limits of [
        { animals: 1, radius: 400, density: 1 },
        { animals: 6, radius: 250, density: 1 },
        { animals: 16, radius: 450, density: 0.4 },
        { animals: 256, radius: 450, density: 1 },
        { animals: 32, radius: 2000, density: 1 },
      ]) {
        const scanned = exhaustive(patchy, observer, limits);
        animals += scanned.length;
        expect(wildlifeCandidates(patchy, observer, limits)).toEqual(scanned);
      }
    // 608 animals over the thirty cases when written: the comparison is not of empty answers.
    expect(animals).toBeGreaterThan(300);
    // A full cap of near animals ends the read. 81 cells are within reach here, a lookup each
    // and another for each animal in them; six animals took 31 lookups when written.
    let lookups = 0;
    const counted: WildlifeWorld = {
      choices: (x, z) => {
        lookups++;
        return world.choices(x, z);
      },
      habitat: world.habitat,
    };
    expect(wildlifeCandidates(counted, [0, 3, 0], { ...budget, animals: 6 })).toHaveLength(6);
    expect(lookups).toBeLessThan(60);
  });

  it('lets a flyer cross a road but not a building, and a walker neither', () => {
    const recipes = new Map([
      [deer.id, deer],
      [bird.id, bird],
    ]);
    // A strip across the way at x 4..8: a road, which only flight may cross, or a building.
    const strip = (road: boolean): WildlifeWorld => ({
      choices: () => [
        { species: deer, density: 100, habitats: ['forest'] },
        { species: bird, density: 100, habitats: ['forest'] },
      ],
      habitat: (x) => {
        const on = x >= 4 && x <= 8;
        return { kind: 'forest', safe: !on, overflight: on && road, height: 3, water: false };
      },
    });
    const travel = (
      crossed: WildlifeWorld,
      recipe: WildlifeSpecies,
    ): { farthest: number; over: number; alive: number } => {
      let current: WildlifeAgent[] = [
        {
          id: `${recipe.id}/crossing`,
          species: recipe.id,
          seed: 7,
          anchor: [0, 0],
          position: [0, 3 + recipe.clearance, 0],
          target: [12, 0],
          heading: 0,
          speed: 0,
          since: 0,
          nextDecision: 100_000,
          decisions: 0,
          phase: 0,
        },
      ];
      let farthest = 0,
        over = 0;
      for (let tick = 0; tick < 400; tick++) {
        current = stepWildlife(current, recipes, crossed, tick);
        const x = current[0]?.position[0] ?? Number.NaN;
        if (x >= 4 && x <= 8) over++;
        if (x > farthest) farthest = x;
      }
      return { farthest, over, alive: current.length };
    };
    // 12 m at 3 m/s: the bird is over the road for 27 of its steps and reaches the far side.
    const flown = travel(strip(true), bird);
    expect(flown.farthest).toBeGreaterThan(11.9);
    expect(flown.over).toBeGreaterThan(20);
    expect(flown.alive).toBe(1);
    expect(travel(strip(false), bird)).toMatchObject({ over: 0, alive: 1 });
    expect(travel(strip(false), bird).farthest).toBeLessThan(4);
    for (const road of [true, false]) {
      const walked = travel(strip(road), deer);
      expect(walked).toMatchObject({ over: 0, alive: 1 });
      expect(walked.farthest).toBeLessThan(4);
      expect(walked.farthest).toBeGreaterThan(3);
    }
    // Over a road is somewhere to pass, not to start from: no anchor is placed there.
    const roadOnly: WildlifeWorld = {
      choices: () => [{ species: bird, density: 100, habitats: ['forest'] }],
      habitat: () => ({ kind: 'forest', safe: false, overflight: true, height: 3, water: false }),
    };
    expect(wildlifeCandidates(roadOnly, [0, 3, 0], budget)).toEqual([]);
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
