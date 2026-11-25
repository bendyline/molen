import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  FLAT_GROUND,
  readTurfRow,
  type ScatterExclusion,
  type TurfCover,
  type TurfRequest,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { projectWgs84 } from '../src/kernel/projection';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';
import { generateWorldgenTile } from '../src/kernel/tile-generate';
import { turfRequestFromTile } from '../src/kernel/turf';
import { loadDefaultPack } from './helpers/pack';

const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const GREEN = { open_ground: '#6e8065', grass: '#7b8b63', residential: '#7b8b63' };
const DRY = { open_ground: '#c2a878', grass: '#7f7a57', residential: '#929985' };

/** The swards a request grows, by label. */
const labels = (request: TurfRequest | undefined): string[] =>
  (request?.swards ?? []).map((sward) => sward.label).sort();

describe('the grass a tile grows', () => {
  it('knows lawns, meadows and airfields as grass, and courts, crops and woods as none', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      { class: 'park', polygons: [{ outer: rect(0, 0, 0.2, 0.2) }] },
      { class: 'grass', subclass: 'meadow', polygons: [{ outer: rect(0.2, 0, 0.4, 0.2) }] },
      { class: 'aerodrome', polygons: [{ outer: rect(0.4, 0, 0.6, 0.2) }] },
      { class: 'wood', polygons: [{ outer: rect(0.6, 0, 0.8, 0.2) }] },
      { class: 'farmland', polygons: [{ outer: rect(0.8, 0, 1, 0.2) }] },
      { class: 'pitch', polygons: [{ outer: rect(0, 0.2, 0.2, 0.4) }] },
      { class: 'runway', polygons: [{ outer: rect(0.2, 0.2, 0.4, 0.4) }] },
      // A golf course is rough; its greens are mapped over it and grow no tufts.
      { class: 'golf_course', polygons: [{ outer: rect(0, 0.5, 0.5, 1) }] },
      { class: 'grass', subclass: 'golf_green', polygons: [{ outer: rect(0.1, 0.6, 0.2, 0.7) }] },
    ];
    const request = turfRequestFromTile(tile, 1000, GREEN, [], false) as TurfRequest;
    expect(labels(request)).toEqual(['aerodrome', 'grass', 'meadow', 'park']);
    const sward = (label: string) => request.swards.find((entry) => entry.label === label);
    // A meadow stands taller than a lawn, and a lawn is the closer sward.
    expect(sward('meadow')?.height).toBeGreaterThan((sward('park')?.height ?? 0) * 2);
    expect(sward('park')?.density).toBeGreaterThan(sward('meadow')?.density ?? 0);
    expect(sward('aerodrome')?.height).toBeGreaterThan(sward('park')?.height ?? 0);
    // Every polygon is ground, in the ground's own painting order, grass or not: the green
    // lies over the course it is cut into.
    expect(request.ground).toHaveLength(9);
    const grows = request.ground.filter((polygon) => polygon.sward !== undefined);
    expect(grows).toHaveLength(4);
    const course = request.ground.findIndex((polygon) => polygon.ring[2]?.[1] === 1000);
    const green = request.ground.findIndex((polygon) => polygon.ring[0]?.[0] === 100);
    expect(request.ground[course]?.sward).toBeDefined();
    expect(request.ground[green]?.sward).toBeUndefined();
    expect(green).toBeGreaterThan(course);
    // No grass at all: no request.
    tile.landcover = [{ class: 'wood', polygons: [{ outer: rect(0, 0, 1, 1) }] }];
    expect(turfRequestFromTile(tile, 1000, GREEN, [], false)).toBeUndefined();
  });

  it('grows unmapped ground and yards only where the region paints them green', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      { class: 'residential', polygons: [{ outer: rect(0, 0, 0.5, 0.5) }] },
      { class: 'grass', polygons: [{ outer: rect(0.5, 0.5, 1, 1) }] },
    ];
    // A host with regional ecology paints the land no polygon covers as open ground.
    const temperate = turfRequestFromTile(tile, 500, GREEN, [], true) as TurfRequest;
    expect(labels(temperate)).toEqual(['grass', 'open_ground', 'residential']);
    expect(temperate.ground[0]?.ring).toEqual(rect(0, 0, 500, 500));
    expect(temperate.ground[0]?.sward).toBeDefined();
    // A desert's open ground is sand and its yards are gravel; its mapped grass is still grass.
    const desert = turfRequestFromTile(tile, 500, DRY, [], true) as TurfRequest;
    expect(labels(desert)).toEqual(['grass']);
    expect(desert.ground[0]?.sward).toBeUndefined();
    // Without the open-ground base, and without a palette at all.
    const bare = turfRequestFromTile(tile, 500, undefined, [], false) as TurfRequest;
    expect(labels(bare)).toEqual(['grass']);
    expect(bare.ground).toHaveLength(2);
    // A cultivated field is its crop's rows, and a place's outline says nothing of its ground.
    tile.landcover = [
      {
        class: 'grass',
        cultivation: { fieldId: 'a', color: '#998855' } as never,
        polygons: [{ outer: rect(0, 0, 1, 1) }],
      },
      { class: 'nature_reserve', polygons: [{ outer: rect(0, 0, 1, 1) }] },
    ];
    expect(turfRequestFromTile(tile, 500, GREEN, [], false)).toBeUndefined();
  });

  it('keeps grass off paving to the edge of what is paved beside it', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [{ class: 'grass', polygons: [{ outer: rect(0, 0, 1, 1) }] }];
    const line = (z: number): [number, number][] => [
      [0, z],
      [1, z],
    ];
    tile.transportation = [
      { class: 'minor_road', subclass: 'residential', lines: [line(0.1)] },
      { class: 'path', subclass: 'footway', lines: [line(0.3)] },
      { class: 'aeroway', subclass: 'runway', width: 45, lines: [line(0.5)] },
      { class: 'aeroway', subclass: 'taxiway', lines: [line(0.7)] },
      { class: 'minor_road', tunnel: true, lines: [line(0.9)] },
    ];
    const exclusions: ScatterExclusion[] = [
      { ring: rect(10, 10, 20, 20), radius: 6, kind: 'buildings' },
      { ring: rect(30, 10, 40, 20), radius: 1, kind: 'water' },
      {
        polyline: [[0, 5] as [number, number], [9, 5] as [number, number]],
        width: 0.2,
        radius: 0.6,
        kind: 'buildings',
      },
      // The scatter's own road line (measured again from the map) and an inferred drive.
      { polyline: line(100), width: 8, radius: 2, kind: 'roads' },
      { ring: rect(50, 10, 53, 20), radius: 0.5, kind: 'roads' },
      { ring: rect(60, 10, 61, 11), radius: 0.75 },
    ];
    const request = turfRequestFromTile(tile, 1000, GREEN, exclusions, false) as TurfRequest;
    const lines = request.clear.filter((entry) => entry.polyline !== undefined);
    const at = (z: number) =>
      lines.find((entry) => entry.polyline?.[0]?.[1] === z && (entry.width ?? 0) > 1);
    // A street: its carriageway, and its sidewalk and curb beside it.
    const street = at(100);
    expect(street?.width).toBeGreaterThan(4);
    expect(street?.width).toBeLessThan(12);
    expect(street?.radius).toBeGreaterThan(1.8);
    // A footpath is trodden a little past its edge; a runway and a taxiway are their own widths.
    expect(at(300)?.width).toBeCloseTo(2.4, 6);
    expect(at(300)?.radius).toBeLessThan(1);
    expect(at(500)?.width).toBe(45);
    expect(at(700)?.width).toBe(18);
    // Nothing for a tunnel, nor the scatter's own copy of a road.
    expect(at(900)).toBeUndefined();
    expect(lines.filter((entry) => (entry.width ?? 0) > 1)).toHaveLength(4);
    // Buildings, fences, water and drives keep the margins grass needs, not a tree's.
    const ring = (x: number) => request.clear.find((entry) => entry.ring?.[0]?.[0] === x);
    expect(ring(10)?.radius).toBeLessThan(1);
    expect(ring(30)?.radius).toBeLessThan(1);
    expect(ring(50)?.radius).toBeLessThan(0.5);
    expect(ring(60)?.radius).toBe(0.75);
    expect(lines.find((entry) => entry.width === 0.2)?.radius).toBeLessThan(0.5);
  });
});

describe('turf cover of a generated tile', () => {
  const sward = (cover: TurfCover, x: number, z: number): string | undefined => {
    const out = new Uint8Array(1);
    const column = Math.floor((x - cover.originX) / cover.cell);
    readTurfRow(cover, Math.floor((z - cover.originZ) / cover.cell), column, column + 1, out);
    return cover.swards[(out[0] as number) - 1]?.label;
  };

  it('comes with the finest tile at Balanced and High, and with no other', async () => {
    const pack = await loadDefaultPack();
    const json = async (name: string) =>
      JSON.parse(
        await readFile(new URL(`../../../content/ecology/${name}`, import.meta.url), 'utf8'),
      );
    const environment = createRegionalEnvironment(
      {
        atlas: await json('ecoregions.json'),
        catalogs: [regionalCatalogSchema.parse(await json('regional.catalog.json'))],
      },
      1,
    );
    // Sammamish, east of Seattle: temperate, and its open ground is green.
    const [x, z] = projectWgs84(-122.03, 47.61);
    const geom: TileGeometry = {
      level: 15,
      x: 0,
      z: 0,
      originX: x,
      originZ: z,
      size: 600,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const tile: TerrainSemanticTile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      { class: 'park', polygons: [{ outer: rect(0.1, 0.1, 0.6, 0.6) }] },
      { class: 'parking', polygons: [{ outer: rect(0.7, 0.7, 0.9, 0.9) }] },
    ];
    tile.water = [{ class: 'lake', polygons: [{ outer: rect(0.3, 0.3, 0.4, 0.4) }] }];
    tile.buildings = [
      { id: 7, class: 'building', polygons: [{ outer: rect(0.2, 0.2, 0.22, 0.22) }] },
    ];
    tile.transportation = [
      {
        class: 'minor_road',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    const options = { pack, environment };
    const batch = semanticTileToBatch(tile, geom, options);
    expect(labels(batch.scatter?.turf)).toEqual(['open_ground', 'park']);
    // A coarser tile asks for none: no camera near enough to see a tuft is over one.
    expect(
      semanticTileToBatch(tile, { ...geom, levelBelowMax: 1 }, options).scatter?.turf,
    ).toBeUndefined();

    const generate = (quality: 'economy' | 'balanced' | 'high', levelBelowMax = 0) =>
      generateWorldgenTile({
        tile,
        geom: { ...geom, levelBelowMax },
        ground: FLAT_GROUND,
        ...options,
        budgets: worldgenTileBudgetForQuality(quality, levelBelowMax),
        features: { buildings: false, scatter: true },
      });
    const high = generate('high');
    const cover = high.turf as TurfCover;
    expect(cover).toBeDefined();
    expect(cover.cell).toBe(1);
    expect([cover.columns, cover.rows]).toEqual([600, 600]);
    // The park's lawn, the verge beyond it, and none on the lake, the house, the road or the lot.
    expect(sward(cover, 100, 100)).toBe('park');
    expect(sward(cover, 30, 30)).toBe('open_ground');
    expect(sward(cover, 210, 210)).toBeUndefined();
    expect(sward(cover, 126, 126)).toBeUndefined();
    expect(sward(cover, 200, 300)).toBeUndefined();
    expect(sward(cover, 200, 305)).toBeUndefined();
    expect(sward(cover, 200, 312)).toBe('park');
    expect(sward(cover, 480, 480)).toBeUndefined();
    expect(high.stats.turfArea).toBeGreaterThan(320_000);
    expect(high.stats.turfArea).toBeLessThan(340_000);
    // A few kilobytes for the whole tile.
    expect(
      cover.rowStart.byteLength + cover.runSward.byteLength + cover.runEnd.byteLength,
    ).toBeLessThan(40_000);
    expect(generate('balanced').turf).toBeDefined();
    expect(generate('economy').turf).toBeUndefined();
    expect(generate('high', 1).turf).toBeUndefined();
    // The plants are the same with it or without.
    const without = generateWorldgenTile({
      tile,
      geom,
      ground: FLAT_GROUND,
      ...options,
      budgets: { ...worldgenTileBudgetForQuality('high', 0), maxTurfCells: 0 },
      features: { buildings: false, scatter: true },
    });
    expect(without.turf).toBeUndefined();
    expect(without.stats.placementsByModel).toEqual(high.stats.placementsByModel);
    // Six tiles' scatter: a few seconds on a busy machine.
  }, 30_000);
});
