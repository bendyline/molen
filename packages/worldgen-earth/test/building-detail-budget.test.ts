import { generateWorldgenBatch, type Vec2 } from '@bendyline/molen-worldgen/kernel';
import { expect, it } from 'vitest';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';
import { loadDefaultPack } from './helpers/pack';

/** A `columns` by `columns` grid of equal two-storey houses, 20 m apart. */
const suburb = (columns = 30) => {
  const centre = (i: number): Vec2 => [(i % columns) * 20 + 6, Math.floor(i / columns) * 20 + 5];
  const buildings = Array.from({ length: columns * columns }, (_, i) => {
    const [x, z] = centre(i);
    return {
      identity: `focus-budget:${i}`,
      labels: ['house'],
      levels: 2,
      style: 'molen.worldgen.pnw.house',
      outline: [
        [x - 6, z - 5],
        [x + 6, z - 5],
        [x + 6, z + 5],
        [x - 6, z + 5],
      ] as Vec2[],
    };
  });
  return { centre, buildings };
};

it('keeps a dense neighborhood textured and enterable within the High tile budget', async () => {
  const pack = await loadDefaultPack();
  const buildings = Array.from({ length: 240 }, (_, i) => {
    const x = (i % 20) * 20,
      z = Math.floor(i / 20) * 20;
    return {
      identity: `detail-budget:${i}`,
      labels: ['house'],
      levels: 2,
      style: 'molen.worldgen.pnw.house',
      outline: [
        [x, z],
        [x + 12, z],
        [x + 12, z + 10],
        [x, z + 10],
      ] as Vec2[],
    };
  });
  const budgets = worldgenTileBudgetForQuality('high', 0);
  const input = { buildings, pack, interiors: true, budgets };
  const result = generateWorldgenBatch(input);
  expect(result.stats.buildingsBoxed).toBe(0);
  expect(result.records.filter((r) => r.interior)).toHaveLength(buildings.length);
  expect(result.stats.materialsCollapsed).toBeLessThan(buildings.length / 4);
  expect(result.stats.vertices).toBeLessThanOrEqual(budgets.maxBuildingVertices);
  expect(result.buildings?.groups.length).toBeLessThanOrEqual(budgets.maxMaterialGroups);
  expect(generateWorldgenBatch(input).hash).toBe(result.hash);
}, 30_000); // Loads the whole default pack and generates 240 houses twice under full-suite load.

it('spends a crowded tile budget on the houses round a viewer on the ground', async () => {
  const pack = await loadDefaultPack();
  const { centre, buildings } = suburb();
  // What a WebGL host gives a finest tile: far fewer vertices than 900 detailed houses need.
  const budgets = worldgenTileBudgetForQuality('high', 0, { compactBuildings: true });
  const enterable = (focus?: { x: number; z: number; radius: number }): Set<number> => {
    const result = generateWorldgenBatch({
      buildings,
      pack,
      interiors: true,
      budgets,
      ...(focus ? { focus } : {}),
    });
    expect(result.stats.vertices).toBeLessThanOrEqual(budgets.maxBuildingVertices);
    expect(result.records).toHaveLength(buildings.length);
    return new Set(
      result.records.flatMap((record) =>
        record.interior ? [Number(record.identity.split(':')[1])] : [],
      ),
    );
  };
  const unfocused = enterable();
  expect(unfocused.size).toBeGreaterThan(40);
  expect(unfocused.size).toBeLessThan(buildings.length / 2);
  // Equal footprints queue by identity hash: the doors are scattered over the whole tile.
  const viewer = { x: 306, z: 305, radius: 140 };
  const distance = (i: number): number =>
    Math.hypot(centre(i)[0] - viewer.x, centre(i)[1] - viewer.z);
  expect([...unfocused].filter((i) => distance(i) > 140).length).toBeGreaterThan(
    unfocused.size / 2,
  );
  const focused = enterable(viewer);
  // The same budget opens about as many doors, and they are the nearest ones: everything a
  // walker can reach in half a minute, and nothing across the tile.
  expect(focused.size).toBeGreaterThan(unfocused.size * 0.8);
  // Whatever the budget has left after the viewer's surroundings still goes to the rest.
  const nearest = buildings
    .map((_, i) => i)
    .filter((i) => distance(i) <= 130)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, focused.size - 8);
  expect(nearest.length).toBeGreaterThan(40);
  for (const i of nearest) expect(focused.has(i), `house ${i}`).toBe(true);
  expect(nearest.filter((i) => unfocused.has(i)).length).toBeLessThan(nearest.length / 2);
  expect(enterable(viewer)).toEqual(focused);
}, 60_000); // Generates 900 houses three times under full-suite load.

it('keeps detail round a viewer when the coarsest tiers alone fill the tile budget', async () => {
  const pack = await loadDefaultPack();
  // A finest tile can hold more buildings than its budget has walls and roofs for: a 3 km tile
  // of a Spanish town held 11,558. Here 2,500 houses share what 2,000 coarsest tiers fill.
  const { centre, buildings } = suburb(50);
  const budgets = {
    ...worldgenTileBudgetForQuality('high', 0, { compactBuildings: true }),
    maxBuildingVertices: 60_000,
  };
  const viewer = { x: 506, z: 505, radius: 140 };
  const distance = (record: { identity: string }): number => {
    const [x, z] = centre(Number(record.identity.split(':')[1]));
    return Math.hypot(x - viewer.x, z - viewer.z);
  };
  const generate = (focus?: typeof viewer) => {
    const result = generateWorldgenBatch({
      buildings,
      pack,
      interiors: true,
      budgets,
      ...(focus ? { focus } : {}),
    });
    expect(result.stats.vertices).toBeLessThanOrEqual(budgets.maxBuildingVertices);
    return result;
  };
  const near = (result: ReturnType<typeof generate>) =>
    result.records.filter((record) => distance(record) <= 60);
  const unfocused = generate();
  // Everyone's walls and roofs spent the budget: the houses beside the viewer have no windows,
  // and none has a door (observed: 500 stand-ins, 29 houses within 60 m all at tier 2 or boxes).
  expect(unfocused.stats.buildingsBoxed).toBeGreaterThan(0);
  expect(unfocused.records.filter((record) => record.interior)).toHaveLength(0);
  expect(near(unfocused).every((record) => record.tier >= 2)).toBe(true);
  const focused = generate(viewer);
  // Half the budget waited for the viewer's surroundings (observed: the 17 nearest open, to 45 m;
  // every house within 60 m at tier 0 or 1; no stand-in within 140 m).
  const open = focused.records.filter((record) => record.interior);
  expect(open.length).toBeGreaterThan(10);
  expect(Math.max(...open.map(distance))).toBeLessThan(60);
  expect(near(focused).length).toBeGreaterThan(20);
  expect(near(focused).every((record) => record.tier <= 1)).toBe(true);
  expect(
    focused.records.filter((record) => record.roof === 'box' && distance(record) <= 140),
  ).toHaveLength(0);
  expect(generate(viewer).hash).toBe(focused.hash);
}, 60_000); // Generates 2,500 houses three times under full-suite load.
