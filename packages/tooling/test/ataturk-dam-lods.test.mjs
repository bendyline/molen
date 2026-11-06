import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const polygonClipping = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);

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

const source = resolve('../../content/worldgen/source/places/sy/sye/ataturk_dam'),
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
    if (
      d[0] === 0 &&
      d[2] === 0 &&
      (o[0] < Math.min(p[0][0], p[1][0], p[2][0]) - 1e-5 ||
        o[0] > Math.max(p[0][0], p[1][0], p[2][0]) + 1e-5 ||
        o[2] < Math.min(p[0][2], p[1][2], p[2][2]) - 1e-5 ||
        o[2] > Math.max(p[0][2], p[1][2], p[2][2]) + 1e-5)
    )
      return best;
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

import { controls } from '../../../content/worldgen/source/places/sy/sye/ataturk_dam/models/dam-model.mjs';

it('pins the exact-Q curved dam,signed reservoir frame,retained dimensions and common datum', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    s = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.anchor).toEqual([38.317982723, 37.480715157]);
  expect(frame.heading).toBe(-0.684533163628);
  expect(frame.mappedIdentity.wikidataId).toBe('Q753776');
  expect(frame.mappedIdentity.featureIds).toEqual(['way/45183487']);
  expect(layout.nativeMap.ownedParts).toEqual([24, 25]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(100);
  expect(s.sourceFacts.retainedHeight).toBe(169);
  expect(s.sourceFacts.retainedLength).toBe(1820);
  expect(s.sourceFacts.selectedPlanExtent).toBeCloseTo(1842.967, 3);
  expect(s.sourceFacts.exposedPenstocks).toBe(8);
  expect(s.sourceFacts.interpretedGateBays).toBe(6);
  expect(s.sourceFacts.terrainDatum).toBe(530);
  expect(p.entry.groundCutout.outlines).toHaveLength(5);
  expect(p.entry.replaceRoads).toBeUndefined();
  const water = await read(source + '/native-water.json');
  expect(new Set(water.layers.map((l) => l.elevation))).toEqual(new Set([0, -143]));
  expect(controls.crestPath).toContainEqual([41.1835, -290.0173]);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: m,
      spec: s,
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
});
it('keeps the entire curved crest,eight visible individual penstocks,powerhouse/control roofs and full spillway in six GLBs', async () => {
  const a = await read(installed + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'runtime', path: installed + '/' + a.files.main },
      ...a.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ],
    bezier = (ps, t) => {
      const u = 1 - t;
      return [0, 1, 2].map(
        (i) =>
          u * u * u * ps[0][i] +
          3 * u * u * t * ps[1][i] +
          3 * u * t * t * ps[2][i] +
          t * t * t * ps[3][i],
      );
    };
  for (const f of files) {
    const ts = await triangles(f.path),
      top = (x, z, Y = 50) => Y - nearest(ts, [x, Y, z], [0, -1, 0]),
      check = (n, v, lo, hi) => {
        expect.soft(v, f.name + ' ' + n).toBeGreaterThanOrEqual(lo);
        expect.soft(v, f.name + ' ' + n).toBeLessThanOrEqual(hi);
      };
    for (const i of [30, 75, 120, 170, 200]) {
      const p = controls.sections[i];
      check('whole curved crest ' + p.x, top(p.x, p.crest), 12, 16);
    }
    for (const [i, pipe] of controls.penstocks.entries())
      for (const t of [0.2, 0.5, 0.8]) {
        const p = bezier(pipe.path, t);
        check(
          'individual exposed penstock ' + i + ' at ' + t,
          top(p[0], p[2], p[1] + 20) - p[1],
          f.name === 'skyline' ? -5 : 0.8,
          6,
        );
      }
    for (const t of [0.35, 0.5, 0.65]) {
      const p = bezier(controls.penstocks[0].path, t);
      check(
        'closed rock-bank excavation face ' + t,
        nearest(ts, [p[0], p[1] + 10, p[2] - 10], [0, 0, -1]),
        0.1,
        300,
      );
    }
    for (const [name, poly, height] of [
      ['powerhouse', controls.powerhouse[0], 12],
      ['control house', controls.controlHouse[0], 13],
    ]) {
      const r = poly[0].slice(0, -1),
        p = [0, 1].map((i) => r.reduce((n, p) => n + p[i], 0) / r.length);
      check(
        name + ' whole roof',
        top(...p),
        controls.floor + height + 0.49,
        controls.floor + height + 0.51,
      );
    }
    const s = controls.spillway;
    for (const t of [0.25, 0.5, 0.75]) {
      const A = s.start[0].map((v, i) => (v + s.start[1][i]) / 2),
        B = s.end[0].map((v, i) => (v + s.end[1][i]) / 2),
        p = A.map((v, i) => v + (B[i] - v) * t),
        expected = -4 - 138 * (t * t * (3 - 2 * t));
      check('spillway length ' + t, top(...p) - expected, -5, 7);
    }
    // A downhill line of sight reaches each closed gate before hitting the lower chute.
    for (let k = 0; k < 6; k++) {
      const A = s.start[0],
        B = s.start[1],
        u = (k + 0.5) / 6,
        p = A.map((v, i) => v + (B[i] - v) * u),
        dx = B[0] - A[0],
        dz = B[1] - A[1],
        L = Math.hypot(dx, dz),
        F = [-dz / L, dx / L],
        o = [p[0] + F[0] * 20, 14, p[1] + F[1] * 20],
        direction = [-F[0] * 20, -10, -F[1] * 20],
        D = Math.hypot(...direction);
      check(
        'visible gate face ' + k,
        nearest(
          ts,
          o,
          direction.map((v) => v / D),
        ),
        20,
        23.5,
      );
    }
    // The actual stilling-basin center remains open through to native water.
    const p = s.end[0].map((v, i) => (v + s.end[1][i]) / 2);
    expect(nearest(ts, [p[0] - 50, -136, p[1] + 75], [0, -1, 0]), f.name + ' open basin').toBe(
      Infinity,
    );
  }
}, 30000);
it('uses the production viewer to replace the powerhouse and control building and preserve all independent native neighbors', async () => {
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
        // Match the production decoder: omit unsupported negative basement heights.
        ...(f.properties.height >= 0 ? { height: f.properties.height } : {}),
        // The production MVT decoder omits negative basement min_height values.
        ...(f.properties.min_height >= 0 ? { minHeight: f.properties.min_height } : {}),
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
  expect(target).toHaveLength(2);
  expect(neighbor).toHaveLength(100);
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
        title: 'Ataturk Dam actual map replacement',
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
        name: 'ataturk_dam-native-replacement',
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
    ).toBeCloseTo(field.sampleHeight(0, -700), 2);
    expect(seen.length).toBeGreaterThan(0);
    expect(seenContext.at(-1)).toEqual(originalContext);
    const remaining = new Set(seen.at(-1)),
      expected = new Set(neighbor.map((b) => b.id));
    expect(
      [...expected].filter((id) => !remaining.has(id)),
      'independent native components removed',
    ).toEqual([]);
    const actual = seenPolygons.at(-1),
      area = (ps) =>
        ps.reduce(
          (n, p) =>
            n +
            p.reduce(
              (a, r, i) =>
                a +
                (i ? -1 : 1) *
                  Math.abs(
                    r.reduce((s, b, j) => {
                      const q = r[(j + 1) % r.length];
                      return s + b[0] * q[1] - b[1] * q[0];
                    }, 0) / 2,
                  ),
              0,
            ),
          0,
        ),
      masks = placed.buildingCutout.outlines.map((r) => [r.map(point)]);
    for (const n of neighbor)
      expect(
        actual.find((b) => b.id === n.id)?.polygons,
        'independent footprint changed ' + n.id,
      ).toEqual(n.polygons);
    const fragments = actual.filter((b) => !expected.has(b.id));
    for (const b of fragments) {
      expect(target.some((t) => t.id === b.id)).toBe(true);
      const p = b.polygons.map((p) => [p.outer, ...(p.holes ?? [])]),
        overlap = polygonClipping.intersection(p, ...[polygonClipping.union(...masks)]);
      expect(
        area(overlap),
        'duplicate station geometry survives inside model replacement',
      ).toBeLessThan(1e-10);
    }
    console.log(
      'Ataturk Dam production replacement ' +
        JSON.stringify({
          removed: all.length - actual.length,
          partialStationFragments: fragments.map((f) => f.id),
          independentPreserved: neighbor.length,
        }),
    );
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
        'concrete_plain',
        'stone_basalt',
        'gravel',
        'metal_standing_seam',
        'metal_painted',
        'window_grid',
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
