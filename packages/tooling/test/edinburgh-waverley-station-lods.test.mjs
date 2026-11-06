import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  createEmptyTerrainSemanticTile,
  heightfieldFromPng,
  wgs84ToWorld,
} from '../../terrain/dist/kernel.mjs';
import { StructureModelLibrary } from '../../worldgen/dist/client.mjs';
import { emptyWorldgenStats } from '../../worldgen/dist/kernel.mjs';
import { hashBytes, modelInputHash } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve(
    '../../content/worldgen/source/places/gc/gcv/edinburgh_waverley_railway_station',
  ),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
async function triangles(path, slot) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m
        .listPrimitives()
        .filter(
          (p) =>
            !slot ||
            (Array.isArray(slot) ? slot : [slot]).includes(
              p.getMaterial()?.getExtras()?.molenSurface?.slot,
            ),
        )
        .flatMap((p) => {
          const a = p.getAttribute('POSITION').getArray(),
            ids = p.getIndices().getArray();
          return Array.from({ length: ids.length / 3 }, (_, i) =>
            Array.from(ids.slice(i * 3, i * 3 + 3), (j) => Array.from(a.slice(j * 3, j * 3 + 3))),
          );
        }),
    );
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function nearest(ts, o, d, frontOnly = false) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8 || (frontOnly && det < 0)) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

const frame = await read(source + '/map-frame.json'),
  layout = await read(source + '/layout.json');
it('pins the full Waverley station, named-POI identity, signed frame, source levels and independent mall/hotels', async () => {
  const m = await read(source + '/source.json'),
    asset = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    spec = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(asset.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + asset.files.main))).toBe(asset.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, asset.id));
  expect(frame.anchor).toEqual([-3.1904205679893494, 55.95190154504826]);
  expect(frame.heading).toBe(0.26667699929917466);
  expect(frame.mappedIdentity.wikidataId).toBe('Q800716');
  expect(frame.mappedIdentity.nativeStationPoi).toBe(17599336042612);
  expect(frame.orientationControl.uncertaintyDegrees).toBe(10);
  expect(layout.nativeMap.ownedParts).toEqual([
    803, 856, 857, 942, 1284, 1285, 1334, 1560, 2229, 2538, 2648,
  ]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(2872);
  for (const i of [1566, 1576, 849, 861, 860])
    expect(layout.nativeMap.preservedNeighbors).toContain(i);
  expect(spec.actualBounds.min[0]).toBeGreaterThan(-80);
  expect(spec.actualBounds.max[0]).toBeLessThan(310);
  expect(spec.actualBounds.min[2]).toBeGreaterThan(-65);
  expect(spec.actualBounds.max[2]).toBeLessThan(70);
  expect(spec.actualBounds.max[1]).toBeLessThanOrEqual(20.21);
  expect(spec.sourceFacts.mainRoofLayer).toBe(1);
  expect(spec.sourceFacts.nativeBookingHallHeight).toBe(8);
  expect(spec.sourceFacts.nativeEasternRangeHeight).toBe(8);
  expect(spec.sourceFacts.nativeNarrowRangeHeight).toBe(5);
  expect(spec.sourceFacts.photoProportionedMeters.lowerFloor).toBe(0.65);
  expect(spec.sourceFacts.photoProportionedMeters.upperEntrances).toBe(7.5);
  expect(spec.sourceFacts.pitchedRoofRows).toBe(5);
  expect(spec.sourceFacts.modernGlazedStairs).toBe(2);
  expect(p.entry.groundCutout.outlines).toHaveLength(10);
  expect(p.entry.buildingCutout.outlines).toHaveLength(11);
  expect(p.entry.terrainReference.anchor).toEqual([-3.185502908148687, 55.9525605904517]);
  expect(p.entry.datum).toBe('terrain');
  expect(p.entry.elevation).toBe(0);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: m,
      spec,
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
});
it('keeps all roof rows and the central opening, closed passenger ranges, upper entries and real descending stairs in six GLBs', async () => {
  const asset = await read(installed + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'import', path: installed + '/' + asset.files.main },
      ...asset.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ];
  for (const f of files) {
    const ts = await triangles(f.path),
      top = (x, z, y = 30) => y - nearest(ts, [x, y, z], [0, -1, 0], true);
    for (const [x, z, lo, hi] of [
      [-30, -45, 13.45, 13.7],
      [-30, 43, 13.45, 13.7],
      [40, -18, 12.95, 13.2],
      [200, 5.5, 12.95, 13.2],
      [200, 23, 11.45, 11.7],
    ]) {
      expect.soft(top(x, z), f.name + ' complete pitched roof row').toBeGreaterThan(lo);
      expect.soft(top(x, z)).toBeLessThan(hi);
    }
    expect
      .soft(top(85, 0), f.name + ' central roof opening preserves low booking hall')
      .toBeCloseTo(8, 2);
    expect.soft(top(115, -3), f.name + ' complete original low clerestory').toBeCloseTo(10.2, 2);
    expect.soft(top(45, -13, 8), f.name + ' complete first low internal range').toBeCloseTo(5.5, 2);
    expect.soft(top(45, 14, 8), f.name + ' complete second low internal range').toBeCloseTo(5.5, 2);
    expect.soft(top(190, -4, 9), f.name + ' closed eastern passenger range').toBeCloseTo(8, 2);
    expect.soft(top(205, 49), f.name + ' full upper Market Street office').toBeCloseTo(20, 2);
    expect.soft(top(244, 58), f.name + ' curved entry roof').toBeGreaterThan(12.1);
    expect.soft(top(244, 58)).toBeLessThan(12.4);
    expect.soft(top(-65, -42, 8), f.name + ' actual upper western entry floor').toBeCloseTo(7.5, 2);
    expect.soft(top(244, 58, 8), f.name + ' actual upper modern entry floor').toBeCloseTo(7.5, 2);
    const tread = top(235.5, 41.8, 5);
    expect.soft(tread, f.name + ' true descending modern stair').toBeGreaterThan(3.9);
    expect.soft(tread).toBeLessThan(4.6);
    expect
      .soft(top(235.5, 42), f.name + ' descending stair roof remains exposed')
      .toBeGreaterThan(7.1);
    expect
      .soft(top(235.5, 42), f.name + ' broad shed roof does not occlude the stair')
      .toBeLessThan(7.5);
    expect
      .soft(
        nearest(ts, [10, 2, -40], [0, -1, 0], true),
        f.name + ' no invented platform-area floor',
      )
      .toBe(Infinity);
    expect
      .soft(
        nearest(ts, [-48, 2, 43], [0, -1, 0], true),
        f.name + ' no filled floor under open western stair link',
      )
      .toBe(Infinity);
    if (f.name !== 'skyline') {
      const gs = await triangles(f.path, 'window');
      for (const kind of ['west', 'modern']) {
        const dir = kind === 'west' ? [-1, 0, 0] : [0, 0, 1],
          candidates = gs
            .filter((t) => dot(cross(sub(t[1], t[0]), sub(t[2], t[0])), dir) > 0)
            .map((t) => [0, 1, 2].map((i) => (t[0][i] + t[1][i] + t[2][i]) / 3))
            .filter(
              (p) =>
                p[1] > 8 &&
                p[1] < 11 &&
                (kind === 'west'
                  ? p[0] < -71 && p[2] > -56 && p[2] < -30
                  : p[2] > 61.6 && p[0] > 228 && p[0] < 260),
            );
        const visible = candidates.some((p) => {
          const o = p.map((v, i) => v + dir[i] * 20),
            d = dir.map((v) => -v),
            g = nearest(gs, o, d, true);
          return Number.isFinite(g) && Math.abs(nearest(ts, o, d, true) - g) < 0.01;
        });
        expect
          .soft(visible, f.name + ' actual visible closed ' + kind + ' entrance glazing')
          .toBe(true);
      }
    }
  }
}, 60000);
it('uses the production viewer to replace the whole passenger building and preserve all independent native neighbors', async () => {
  const map = await read(source + '/pmtiles-map.json'),
    frame = await read(source + '/map-frame.json'),
    placed = (await read(source + '/placement-report.json')).entry,
    local = ([lon, lat]) => {
      const E =
          (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
        S = -(lat - frame.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
        E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
      ];
    };
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading),
    point = ([x, z]) => [(c * x + s * z + 2000) / 4000, (-s * x + c * z + 2000) / 4000],
    all = [];
  for (const f of map.features.filter(
    (f) => f.layer === 'buildings' && ['Polygon', 'MultiPolygon'].includes(f.geometry.type),
  ))
    for (const rings of f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates
      : [f.geometry.coordinates]) {
      const p = rings.map((r) => r.map(local)),
        flat = p.flat(),
        bb = [
          Math.min(...flat.map((p) => p[0])),
          Math.min(...flat.map((p) => p[1])),
          Math.max(...flat.map((p) => p[0])),
          Math.max(...flat.map((p) => p[1])),
        ];
      all.push({
        id: 'native-' + all.length,
        kind: f.properties.kind,
        height: f.properties.height ?? 30,
        minHeight: f.properties.min_height ?? 0,
        polygons: [
          {
            outer: p[0].map(point),
            ...(p.length > 1 ? { holes: p.slice(1).map((r) => r.map(point)) } : {}),
          },
        ],
        bb,
      });
    }
  const owned = layout.nativeMap.ownedParts,
    target = owned.map((i) => all[i]),
    neighbor = all.filter((_, i) => !owned.includes(i));
  expect(all).toHaveLength((await read(source + '/mapped-parts.json')).parts.length);
  expect(target).toHaveLength(11);
  expect(neighbor).toHaveLength(2872);
  const asset = await read(installed + '/asset.json'),
    doc = await new NodeIO().readBinary(
      await readFile(installed + '/' + asset.runtimeLods.levels[0].file),
    ),
    model = new THREE.Group();
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(p.getAttribute('POSITION').getArray(), 3),
      );
      geometry.setIndex(Array.from(p.getIndices().getArray()));
      model.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    }
  const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    ),
    objects = new StructureModelLibrary(async () => model),
    seen = [],
    seenPolygons = [],
    seenContext = [],
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      sampleStructureTerrain: (coordinate) => {
        const [e, S] = wgs84ToWorld(1, ...coordinate);
        return field.sampleHeight(e * c - S * s, e * s + S * c);
      },
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Edinburgh Waverley railway station actual map replacement',
        entries: [
          {
            ...placed,
            anchor: [0, 0],
            ...(placed.terrainReference
              ? {
                  terrainReference: {
                    ...placed.terrainReference,
                    anchor: [
                      (placed.terrainReference.anchor[0] - frame.anchor[0]) *
                        Math.cos((frame.anchor[1] * Math.PI) / 180),
                      placed.terrainReference.anchor[1] - frame.anchor[1],
                    ],
                  },
                }
              : {}),
            bounds: placed.bounds.map((v, i) =>
              i % 2 === 0
                ? (v - frame.anchor[0]) * Math.cos((frame.anchor[1] * Math.PI) / 180)
                : v - frame.anchor[1],
            ),
            minLevel: 0,
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request) => {
          if (request.features?.buildings) {
            seenContext.push({
              water: request.tile.water,
              transportation: request.tile.transportation,
            });
            seen.push(request.tile.buildings.map((b) => b.id));
            seenPolygons.push(
              request.tile.buildings.map((b) => ({ id: b.id, polygons: b.polygons })),
            );
          }
          return {
            placements: [],
            records: [],
            stats: emptyWorldgenStats(),
            hash: 'sha256:empty',
            skippedByOwnership: 0,
            clippedPieces: 0,
          };
        },
        dispose() {},
      },
    });
  let root;
  try {
    const tile = createEmptyTerrainSemanticTile();
    tile.water = map.features
      .filter((f) => f.layer === 'water' && ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
      .map((f) => ({
        id: f.id,
        class: f.properties.kind,
        polygons: (f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates
          : [f.geometry.coordinates]
        ).map((rings) => ({
          outer: rings[0].map((p) => point(local(p))),
          ...(rings.length > 1
            ? { holes: rings.slice(1).map((r) => r.map((p) => point(local(p)))) }
            : {}),
        })),
      }));
    tile.transportation = map.features
      .filter(
        (f) => f.layer === 'roads' && ['LineString', 'MultiLineString'].includes(f.geometry.type),
      )
      .map((f) => ({
        id: f.id,
        class: f.properties.kind,
        subclass: f.properties.kind_detail,
        bridge: f.properties.is_bridge === true,
        lines: (f.geometry.type === 'LineString'
          ? [f.geometry.coordinates]
          : f.geometry.coordinates
        ).map((r) => r.map((p) => point(local(p)))),
      }));
    const originalContext = JSON.parse(
      JSON.stringify({ water: tile.water, transportation: tile.transportation }),
    );
    expect(originalContext.water.length).toBe(
      map.features.filter(
        (f) => f.layer === 'water' && ['Polygon', 'MultiPolygon'].includes(f.geometry.type),
      ).length,
    );
    expect(originalContext.transportation.length).toBeGreaterThan(0);
    tile.buildings = [...target, ...neighbor];
    root = await renderers.humanFeatures.createTile(tile, {
      address: { level: 14, x: 0, z: 0 },
      tileSize: 4000,
      origin: [-2000, -2000],
      pyramid: {
        name: 'edinburgh_waverley_railway_station-native-replacement',
        origin: [-2000, -2000],
        rootSize: 65536000,
        minLevel: 0,
        maxLevel: 14,
        tileResolution: 257,
        height: { min: -10, max: 300 },
        layers: [],
        skirts: false,
      },
      descriptor: {},
      heightfield: field,
      signal: new AbortController().signal,
    });
    const landmark = root?.getObjectByName('structure:' + placed.id);
    expect(landmark).toBeDefined();
    expect(
      landmark.position.y,
      'production renderer uses the single shared native terrain datum',
    ).toBeCloseTo(field.sampleHeight(315, 10), 2);
    expect(seen.length).toBeGreaterThan(0);
    expect(seenContext.at(-1)).toEqual(originalContext);
    const remaining = new Set(seen.at(-1)),
      expected = new Set(neighbor.map((b) => b.id));
    expect(
      [...expected].filter((id) => !remaining.has(id)),
      'independent native components removed',
    ).toEqual([]);
    expect(
      [...remaining].filter((id) => !expected.has(id)),
      'station components left duplicated',
    ).toEqual([]);
    for (const i of layout.nativeMap.preservedNeighbors)
      expect(neighbor.map((b) => b.id)).toContain('native-' + i);
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('rebuilds four exact budgeted tiers with existing shared graphs, no image copies and separate GPU streams', async () => {
  const r = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    asset = await read(installed + '/asset.json');
  expect(r.levels[0].bytes + r.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = r.levels.find((l) => l.name === name),
      bytes = await readFile(runtime + '/' + l.file),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(hashBytes(bytes)).toBe(asset.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of [
        'stone_granite',
        'stone_sandstone',
        'metal_painted',
        'window_grid',
        'membrane',
        'storefront',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
          ),
        ).toBe(true);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
