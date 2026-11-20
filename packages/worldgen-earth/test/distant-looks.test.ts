import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  webMercatorScaleAtLatitude,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import {
  type DistantLook,
  distantBuildingLook,
  emptyWorldgenStats,
  packIdentity,
  queueBuildings,
  selectStyle,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { distantBuildingLooks } from '../src/kernel/distant-looks';
import { buildingLabels, contextLabelAt } from '../src/kernel/labels';
import { MAP_OVERRIDE_STYLE_TAG, MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';
import { createRegionResolver } from '../src/kernel/region';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const atlas = await loadDefaultAtlas();
const pack = await loadDefaultPack();
const metersPerUnit = webMercatorScaleAtLatitude(47.6);
const regions = createRegionResolver(atlas, { metersPerUnit });

/** One level above the finest over downtown Seattle: generalized footprints, no tenants. */
function downtown(): TileGeometry {
  const [x, z] = wgs84ToWebMercator(-122.335, 47.607);
  return {
    level: 13,
    x: 1300,
    z: 2850,
    originX: x * metersPerUnit,
    originZ: z * metersPerUnit,
    size: 1600,
    metersPerUnit,
    levelBelowMax: 1,
  };
}

function square(x: number, z: number, w: number): [number, number][] {
  return [
    [x, z],
    [x + w, z],
    [x + w, z + w],
    [x, z + w],
  ];
}

describe('distant building shells', () => {
  it("take the look of the style the building's own generation chooses", () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildingsGeneralized = true;
    tile.landcover.push({ class: 'commercial', polygons: [{ outer: square(0, 0, 0.5) }] });
    tile.landcover.push({ class: 'residential', polygons: [{ outer: square(0.5, 0.5, 0.5) }] });
    const buildings: TerrainBuildingFeature[] = [
      { id: 1, class: 'building', subclass: 'office', height: 140, levels: 36 },
      { id: 2, class: 'building', subclass: 'commercial', height: 24, levels: 6 },
      { id: 3, class: 'building', subclass: 'apartments', height: 40, levels: 12 },
      { id: 4, class: 'building', subclass: 'hotel', height: 60, levels: 16 },
      { id: 5, class: 'building', subclass: 'house', height: 7, levels: 2 },
      { id: 6, class: 'building', height: 9 },
    ].map((feature, i) => ({
      ...feature,
      polygons: [{ outer: square(0.05 + (i % 3) * 0.3, 0.05 + Math.floor(i / 3) * 0.55, 0.04) }],
    }));
    tile.buildings = buildings;
    const geom = downtown();
    const samples = new Map<string, (DistantLook | undefined)[]>();
    const looks = distantBuildingLooks(tile, geom, { pack, atlas, regions, samples });
    const batch = semanticTileToBatch(tile, geom, { pack, atlas, regions });
    const queue = queueBuildings(batch, emptyWorldgenStats());
    expect(queue).toHaveLength(buildings.length);
    for (const item of queue) {
      const feature = buildings.find((entry) => item.request.identity === `f:${entry.id}`);
      if (feature === undefined) throw new Error(`no feature for ${item.request.identity}`);
      const look = looks(feature, 0);
      // One of the looks worked out from that same style's recipe.
      const drawn = [...samples]
        .filter(([key]) => key.startsWith(`${item.styleId}|`))
        .flatMap(([, entries]) => entries);
      expect(drawn.length, item.styleId).toBeGreaterThan(0);
      expect(drawn, item.styleId).toContainEqual(look);
    }
    // Not one shared tone: a glass tower, flats and a house each keep their own.
    const walls = new Set(buildings.map((feature) => JSON.stringify(looks(feature, 0)?.wall)));
    expect(walls.size).toBeGreaterThan(3);
    expect(looks(buildings[0] as TerrainBuildingFeature, 1)).toBeUndefined();
    // Samples are kept for the next tile: asking again works nothing out anew.
    const kept = samples.size;
    distantBuildingLooks(tile, geom, { pack, atlas, regions, samples })(
      buildings[0] as TerrainBuildingFeature,
      0,
    );
    expect(samples.size).toBe(kept);
  });

  it('remembers style choices without changing one', () => {
    // Buildings alike in labels, land use and the rules' bounds share a choice; any difference a
    // rule can see (area across a bound, a known height, storeys) must still choose afresh.
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover.push({ class: 'commercial', polygons: [{ outer: square(0, 0, 0.5) }] });
    tile.landcover.push({ class: 'residential', polygons: [{ outer: square(0.5, 0, 0.5) }] });
    const kinds = [undefined, 'house', 'apartments', 'commercial', 'office', 'retail', 'church'];
    const features: TerrainBuildingFeature[] = Array.from({ length: 140 }, (_, i) => {
      const side = 0.002 + (i % 9) * 0.0035;
      const x = 0.02 + (i % 14) * 0.07;
      const z = 0.05 + Math.floor(i / 14) * 0.09;
      return {
        id: i,
        class: 'building',
        ...(kinds[i % kinds.length] !== undefined ? { subclass: kinds[i % kinds.length] } : {}),
        ...(i % 3 === 0 ? { height: 4 + (i % 23) * 5 } : {}),
        ...(i % 4 === 0 ? { levels: 1 + (i % 17) } : {}),
        polygons: [{ outer: square(x, z, side) }],
      };
    });
    tile.buildings = features;
    const geom = downtown();
    const samples = new Map<string, (DistantLook | undefined)[]>();
    const looks = distantBuildingLooks(tile, geom, { pack, samples });
    const rules = pack.root.defaults.rules;
    for (const feature of features) {
      const polygon = feature.polygons[0] as { outer: [number, number][] };
      const side = (polygon.outer[1]?.[0] ?? 0) - (polygon.outer[0]?.[0] ?? 0);
      const centre: [number, number] = [
        (polygon.outer[0]?.[0] ?? 0) + side / 2,
        (polygon.outer[0]?.[1] ?? 0) + side / 2,
      ];
      const labels = buildingLabels(feature);
      const context = contextLabelAt(centre, tile.landcover);
      const expected = selectStyle(
        rules,
        {
          labels,
          ...(context !== undefined ? { context } : {}),
          areaM2: side * side * geom.size * geom.size,
          perimeterM: 0,
          vertexCount: 4,
          hasHoles: false,
          elongation: 1,
          rectangularity: 1,
          ...(feature.height !== undefined ? { height: feature.height } : {}),
          ...(feature.levels !== undefined ? { levels: feature.levels } : {}),
          wings: 1,
        },
        pack.root.defaults.style,
        `f:${feature.id}`,
      ).style;
      const look = looks(feature, 0);
      const drawn = [...samples]
        .filter(([key]) => key.startsWith(`${expected}|`))
        .flatMap(([, entries]) => entries);
      expect(drawn, `building ${feature.id} (${expected})`).toContainEqual(look);
    }
  });

  it('gives the footprints of one merged feature their own looks from its style', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover.push({ class: 'residential', polygons: [{ outer: square(0, 0, 1) }] });
    // A generalized tile merges a street of houses into one feature with many footprints.
    const street: TerrainBuildingFeature = {
      id: 7,
      class: 'building',
      polygons: Array.from({ length: 40 }, (_, i) => ({
        outer: square(0.02 + (i % 10) * 0.05, 0.1 + Math.floor(i / 10) * 0.05, 0.006),
      })),
    };
    tile.buildings = [street];
    const looks = distantBuildingLooks(tile, downtown(), { pack, atlas, regions });
    const walls = new Set(
      street.polygons.map((_, index) => JSON.stringify(looks(street, index)?.wall)),
    );
    expect(walls.has(JSON.stringify(undefined))).toBe(false);
    expect(walls.size).toBeGreaterThan(2);
  });

  it("draws a host's building in the style its host declared", () => {
    const tile = createEmptyTerrainSemanticTile();
    const host: TerrainBuildingFeature = {
      id: 'override:lot:tower',
      class: 'building',
      subclass: 'house',
      height: 90,
      tags: {
        [MAP_OVERRIDE_TAG]: 'true',
        [MAP_OVERRIDE_STYLE_TAG]: 'molen.worldgen.use.skyscraper',
      },
      polygons: [{ outer: square(0.4, 0.4, 0.03) }],
    };
    tile.buildings = [host];
    const look = distantBuildingLooks(tile, downtown(), { pack, atlas, regions })(host, 0);
    const skyscraper = pack.archstyles['molen.worldgen.use.skyscraper'];
    if (skyscraper === undefined) throw new Error('no skyscraper style');
    const size = downtown().size;
    expect(look).toEqual(
      distantBuildingLook(skyscraper, packIdentity(pack), {
        identity: 'f:override:lot:tower',
        labels: buildingLabels(host),
        outline: square(0.4, 0.4, 0.03).map(([x, z]) => [x * size, z * size]),
        height: 90,
        style: 'molen.worldgen.use.skyscraper',
      }),
    );
  });
});
