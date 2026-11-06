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

const source = resolve('../../content/worldgen/source/places/uc/ucf/kuskovo'),
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
it('pins Kuskovo source/import bytes, both complete mapped platforms, signed frame and closed floors', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    s = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.anchor).toEqual([37.795277777, 55.739722222]);
  expect(frame.heading).toBe(0.3438800795999717);
  expect(frame.mappedIdentity.wikidataId).toBe('Q4249243');
  expect(frame.mappedIdentity.platformIds).toEqual([35184448958777, 52776574397269]);
  expect(layout.nativeMap.ownedParts).toHaveLength(11);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(250);
  expect(s.sourceFacts.stairFlights).toBe(3);
  expect(s.sourceFacts.platformCount).toBe(2);
  expect(p.entry.groundCutout.outlines).toHaveLength(9);
  expect(p.entry.replaceRoads.includeTransverseBridges).toBe(true);
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
it('retains both whole pitched canopies/platforms, the office, complete crossing, both railings and open stair headroom in six GLBs', async () => {
  const { controls } = await import(
      '../../../content/worldgen/source/places/uc/ucf/kuskovo/models/station-model.mjs'
    ),
    a = await read(installed + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'import', path: installed + '/' + a.files.main },
      ...a.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ];
  for (const f of files) {
    const ts = await triangles(f.path),
      top = (x, z, y = 25) => y - nearest(ts, [x, y, z], [0, -1, 0], true);
    expect.soft(top(-60, -59, 2), f.name + ' occupied office floor').toBeCloseTo(1.25, 2);
    expect.soft(top(-120, -75, 3), f.name + ' western warehouse floor').toBeCloseTo(2.8, 2);
    expect.soft(top(-61, -59), f.name + ' whole hipped office roof').toBeGreaterThan(12.7);
    expect.soft(top(-61, -59)).toBeLessThan(12.9);
    for (const p of controls.platforms)
      for (const x of [-200, -100, 60]) {
        expect
          .soft(top(x, p.centerZ - 0.7, 5), f.name + ' entire ' + p.name + ' floor at ' + x)
          .toBeCloseTo(3.3, 2);
        expect
          .soft(top(x, p.centerZ), f.name + ' entire pitched roof ridge at ' + x)
          .toBeCloseTo(8.4, 2);
      }
    const [a, b] = controls.bridge,
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      N = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L];
    for (const t of [0.15, 0.55, 0.9]) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      expect.soft(top(x, z), f.name + ' full crossing ' + t).toBeCloseTo(9, 2);
      if (f.name !== 'skyline')
        for (const side of [-1, 1])
          expect
            .soft(
              top(x + N[0] * side * 1.65, z + N[1] * side * 1.65),
              f.name + ' bridge railing side ' + side,
            )
            .toBeGreaterThan(10.1);
    }
    for (const stair of controls.stairs.slice(1))
      for (const t of [0.2, 0.45, 0.6]) {
        const x = stair.a[0] + (stair.b[0] - stair.a[0]) * t,
          z = stair.a[1] + (stair.b[1] - stair.a[1]) * t,
          y = stair.top + (stair.bottom - stair.top) * t;
        expect
          .soft(
            nearest(ts, [x, y + 0.1, z], [0, 1, 0]),
            f.name + ' open ' + stair.name + ' headroom at ' + t,
          )
          .toBeGreaterThan(1.9);
      }
    expect
      .soft(
        nearest(ts, [-100, 0, -25], [0, -1, 0], true),
        f.name + ' no blanket slab across freight tracks',
      )
      .toBe(Infinity);
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
  expect(target).toHaveLength(11);
  expect(neighbor).toHaveLength(250);
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
    seenRoadTiles = [],
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      sampleStructureTerrain: (coordinate) => {
        const [e, S] = wgs84ToWorld(1, ...coordinate);
        return field.sampleHeight(e * c - S * s, e * s + S * c);
      },
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Kuskovo station actual map replacement',
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
      roads: {
        renderTransportation: true,
        surfaceRenderer: {
          createTileAsync: async (tile) => {
            seenRoadTiles.push(tile);
            return new THREE.Group();
          },
        },
      },
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
        name: 'kuskovo-native-replacement',
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
    ).toBeCloseTo(field.sampleHeight(-50, -70), 2);
    expect(seen.length).toBeGreaterThan(0);
    expect(seenContext.at(-1)).toEqual(originalContext);
    const actualContext = seenRoadTiles.at(-1);
    expect(actualContext.water).toEqual(originalContext.water);
    // The road renderer splits multi-line records without changing their individual lines.
    const canonicalLine = (r) => r.map((p) => p.map((v) => +v.toFixed(12))),
      ordinaryLines = (records) =>
        records
          .filter((t) => !t.bridge)
          .flatMap((t) =>
            t.lines.map((line) =>
              JSON.stringify({
                id: t.id,
                class: t.class,
                subclass: t.subclass,
                layer: t.layer,
                bridge: t.bridge,
                line: canonicalLine(line),
              }),
            ),
          )
          .sort();
    expect(ordinaryLines(actualContext.transportation)).toEqual(
      ordinaryLines(originalContext.transportation),
    );
    const bridgeLines = actualContext.transportation
        .filter((t) => t.bridge)
        .flatMap((t) => t.lines),
      existing = new Set(bridgeLines.map((r) => JSON.stringify(canonicalLine(r)))),
      fromPoint = ([u, v]) => {
        const E = u * 4000 - 2000,
          S = v * 4000 - 2000;
        return [E * c - S * s, E * s + S * c];
      },
      ring = placed.replaceRoads.outline,
      inside = ([x, z]) => {
        let yes = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i],
            b = ring[j];
          if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
            yes = !yes;
        }
        return yes;
      };
    for (const t of originalContext.transportation.filter((t) => t.bridge))
      for (const line of t.lines) {
        const p = line.map(fromPoint),
          bb = [
            Math.min(...p.map((p) => p[0])),
            Math.min(...p.map((p) => p[1])),
            Math.max(...p.map((p) => p[0])),
            Math.max(...p.map((p) => p[1])),
          ];
        if (bb[2] < -47 || bb[0] > -37 || bb[3] < -55 || bb[1] > 21)
          expect(
            existing.has(JSON.stringify(canonicalLine(line))),
            'independent bridge line changed',
          ).toBe(true);
      }
    for (const line of bridgeLines)
      for (let j = 1; j < line.length; j++) {
        const a = fromPoint(line[j - 1]),
          b = fromPoint(line[j]);
        expect(
          inside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
          'generic bridge survives beneath authored crossing',
        ).toBe(false);
      }

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
      'Kuskovo production replacement ' +
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
        'siding_lap',
        'stone_granite',
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
