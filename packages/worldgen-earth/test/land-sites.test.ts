/**
 * Golf course layouts: laid out on a world grid from a seed, clipped to the mapped course, the
 * same in every tile that sees a piece of it.
 */
import {
  createEmptyTerrainSemanticTile,
  pointInPolygon,
  polygonArea,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { LAND_SITE_COLORS, prepareLandSites } from '../src/kernel/land-sites';
import { scatterRequestFromTile, type TileGeometry } from '../src/kernel/semantic-adapter';

const SIZE = 1000;
function geometry(x = 0, z = 0, overrides: Partial<TileGeometry> = {}): TileGeometry {
  return {
    level: 15,
    x,
    z,
    originX: 4_000_000 + x * SIZE,
    originZ: 3_000_000 + z * SIZE,
    size: SIZE,
    metersPerUnit: 1,
    levelBelowMax: 0,
    ...overrides,
  };
}
const rectangle = (u0: number, v0: number, u1: number, v1: number): TerrainSemanticPolygon => ({
  outer: [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ],
});
/** A tile under one course, as a vector source cuts it: the tile and its clip buffer. */
function course(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({
    id: 7,
    class: 'golf_course',
    polygons: [rectangle(-1 / 64, -1 / 64, 65 / 64, 65 / 64)],
  });
  return tile;
}
const added = (tile: TerrainSemanticTile) =>
  tile.landcover.filter((feature) => String(feature.id).startsWith('site:'));
const kinds = (tile: TerrainSemanticTile) => added(tile).map((feature) => feature.class);
/** The added class drawn at a point: the last feature there, as the ground paints them. */
function classAt(tile: TerrainSemanticTile, point: [number, number]): string | undefined {
  let found: string | undefined;
  for (const feature of added(tile))
    if (feature.polygons.some((polygon) => pointInPolygon(point, polygon))) found = feature.class;
  return found;
}

describe('golf course layouts', () => {
  it('lays fairways, greens, tees and bunkers over a mapped course, and nothing elsewhere', () => {
    const source = course(),
      before = structuredClone(source);
    const tile = prepareLandSites(source, geometry());
    expect(source).toEqual(before);
    expect(kinds(tile)).toEqual(['golf_fairway', 'golf_green', 'golf_tee', 'golf_bunker']);
    expect(tile.landcover.slice(0, source.landcover.length)).toEqual(source.landcover);
    for (const kind of kinds(tile)) expect(LAND_SITE_COLORS[kind]).toMatch(/^#[0-9a-f]{6}$/);
    const total = (kind: string) =>
      added(tile)
        .filter((feature) => feature.class === kind)
        .flatMap((feature) => feature.polygons)
        .reduce((sum, polygon) => sum + polygonArea(polygon) * SIZE * SIZE, 0);
    // A square kilometre of course: fairways over a fifth to a half of it, a green for most
    // holes. Observed: 28.9 hectares of fairway, 34 greens of up to 643 m² (41 m² where the
    // tile edge cuts one), 0.89 hectares of bunker.
    expect(total('golf_fairway')).toBeGreaterThan(200_000);
    expect(total('golf_fairway')).toBeLessThan(500_000);
    const greens = added(tile).find((feature) => feature.class === 'golf_green')?.polygons ?? [];
    expect(greens.length).toBeGreaterThan(20);
    for (const green of greens) {
      const area = polygonArea(green) * SIZE * SIZE;
      // Whole greens only, apart from those the tile edge cuts.
      const cut = green.outer.some(([u, v]) => u < 0 || v < 0 || u > 1 || v > 1);
      if (!cut) expect(area).toBeGreaterThan(250);
      expect(area).toBeLessThan(900);
    }
    expect(total('golf_bunker')).toBeGreaterThan(2_000);
    expect(total('golf_bunker')).toBeLessThan(40_000);

    const plain = createEmptyTerrainSemanticTile();
    plain.landcover.push({ class: 'park', polygons: [rectangle(0, 0, 1, 1)] });
    expect(prepareLandSites(plain, geometry())).toBe(plain);
    expect(prepareLandSites(source, geometry(), false)).toBe(source);
  });

  it('reproduces a visit exactly, whatever order the map lists its land', () => {
    const first = prepareLandSites(course(), geometry());
    expect(prepareLandSites(course(), geometry())).toEqual(first);
    const shuffled = course();
    shuffled.landcover.unshift({ class: 'residential', polygons: [rectangle(0, 0, 1, 1)] });
    expect(added(prepareLandSites(shuffled, geometry()))).toEqual(added(first));
    // Preparing a prepared tile adds nothing more.
    expect(prepareLandSites(first, geometry())).toBe(first);
    expect(added(prepareLandSites(course(), geometry(), { seed: 5 }))).not.toEqual(added(first));
  });

  it('draws the same course on both sides of a tile edge', () => {
    const west = prepareLandSites(course(), geometry(0, 0));
    const east = prepareLandSites(course(), geometry(1, 0));
    const south = prepareLandSites(course(), geometry(0, 1));
    let covered = 0;
    // Points in the strip both tiles see: their own edge and the neighbour's clip buffer.
    for (let across = -12; across <= 12; across += 4)
      for (let along = 1; along < SIZE; along += 3) {
        const a = classAt(west, [1 + across / SIZE, along / SIZE]);
        expect(classAt(east, [across / SIZE, along / SIZE])).toBe(a);
        const b = classAt(west, [along / SIZE, 1 + across / SIZE]);
        expect(classAt(south, [along / SIZE, across / SIZE])).toBe(b);
        if (a !== undefined || b !== undefined) covered++;
      }
    expect(covered).toBeGreaterThan(200);
  });

  it('keeps the layout in place when the frame is scaled for another latitude', () => {
    const reference = added(prepareLandSites(course(), geometry()));
    const scaled = added(
      prepareLandSites(
        course(),
        geometry(0, 0, {
          originX: 4_000_000 * 0.8,
          originZ: 3_000_000 * 0.8,
          size: SIZE * 0.8,
          metersPerUnit: 0.8,
        }),
      ),
    );
    expect(scaled.map((feature) => feature.class)).toEqual(reference.map((f) => f.class));
    for (const [index, feature] of scaled.entries()) {
      const expected = reference[index]?.polygons ?? [];
      expect(feature.polygons.length).toBe(expected.length);
      for (const [k, polygon] of feature.polygons.entries())
        for (const [n, [u, v]] of polygon.outer.entries()) {
          expect(u).toBeCloseTo(expected[k]?.outer[n]?.[0] as number, 9);
          expect(v).toBeCloseTo(expected[k]?.outer[n]?.[1] as number, 9);
        }
    }
  });

  it('stays on the course and off its water, woods, sand and buildings', () => {
    const tile = createEmptyTerrainSemanticTile();
    // The course is the middle of the tile; a pond, a wood, a mapped bunker and a clubhouse sit
    // in it, and a housing estate and a park are drawn under or over the same ground.
    tile.landcover.push(
      { class: 'residential', polygons: [rectangle(0, 0, 1, 1)] },
      { class: 'park', polygons: [rectangle(0.1, 0.1, 0.9, 0.9)] },
      { class: 'golf_course', polygons: [rectangle(0.2, 0.2, 0.8, 0.8)] },
      { class: 'wood', polygons: [rectangle(0.3, 0.3, 0.4, 0.7)] },
      { class: 'sand', polygons: [rectangle(0.6, 0.3, 0.62, 0.34)] },
    );
    tile.water.push({ class: 'water', polygons: [rectangle(0.45, 0.45, 0.55, 0.6)] });
    tile.buildings.push({ class: 'building', polygons: [rectangle(0.7, 0.7, 0.74, 0.73)] });
    const prepared = prepareLandSites(tile, geometry());
    expect(kinds(prepared)).toContain('golf_fairway');
    expect(kinds(prepared)).toContain('golf_green');
    const blocked = [
      rectangle(0.3, 0.3, 0.4, 0.7),
      rectangle(0.6, 0.3, 0.62, 0.34),
      rectangle(0.45, 0.45, 0.55, 0.6),
      rectangle(0.7, 0.7, 0.74, 0.73),
    ];
    let onCourse = 0;
    for (let u = 0.005; u < 1; u += 0.01)
      for (let v = 0.005; v < 1; v += 0.01) {
        const drawn = classAt(prepared, [u, v]);
        if (drawn === undefined) continue;
        onCourse++;
        expect(u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8).toBe(true);
        expect(blocked.some((polygon) => pointInPolygon([u, v], polygon))).toBe(false);
      }
    expect(onCourse).toBeGreaterThan(300);
  });

  it('keeps fairways and greens two levels out, and nothing on coarser tiles', () => {
    expect(kinds(prepareLandSites(course(), geometry(0, 0, { levelBelowMax: 1 })))).toContain(
      'golf_bunker',
    );
    const far = prepareLandSites(course(), geometry(0, 0, { levelBelowMax: 2 }));
    expect(kinds(far)).toEqual(['golf_fairway', 'golf_green']);
    // The outlines a coarser level keeps are the finest level's own.
    const near = prepareLandSites(course(), geometry());
    expect(added(far)[1]).toEqual(added(near)[1]);
    const coarse = course();
    expect(prepareLandSites(coarse, geometry(0, 0, { levelBelowMax: 3 }))).toBe(coarse);
  });

  it('labels the added ground so no rule for the course plants on it', () => {
    const request = scatterRequestFromTile(
      prepareLandSites(course(), geometry()),
      geometry(),
      { roads: 2, buildings: 2, water: 1 },
      1,
    );
    const labels = [...new Set(request.polygons.map((polygon) => polygon.label))];
    expect(labels).toEqual([
      'open_ground',
      'golf_course',
      'golf_fairway',
      'golf_green',
      'golf_tee',
      'golf_bunker',
    ]);
  });
});
