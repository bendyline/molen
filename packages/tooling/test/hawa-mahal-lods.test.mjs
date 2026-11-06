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
import { emptyWorldgenStats, encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes, modelInputHash } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ts/tsv/hawa_mahal'),
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
  layout = await read(source + '/layout.json'),
  P = (p) => p;
it('binds the complete two-court palace to exact source/runtime pins and its own signed map frame', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.heading).toBeCloseTo(1.3162197466549783, 12);
  expect(frame.mappedIdentity.featureIds).toEqual(['relation/1460207']);
  expect(p.entry.elevation).toBe(443);
  expect(p.entry.datum).toBe('sea-level');
  expect(p.entry.buildingCutout.minimumCoverage).toBe(0.98);
  expect(p.entry.buildingCutout.outlines).toHaveLength(1);
  expect(layout.courts).toHaveLength(2);
  expect(layout.rows).toHaveLength(5);
  expect(layout.nativeMap.ownedParts).toEqual([43]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(79);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: m,
      spec: await read(source + '/spec.json'),
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
});
it('keeps both courts, complete low rear range, five-tier crown, open chhatri, deep arcades and supported entry', async () => {
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const court of layout.courts) {
      const [x, z, X, Z] = court.bounds;
      for (const [u, v] of [
        [(x + X) / 2, (z + Z) / 2],
        [x + 2, z + 2],
        [X - 2, z + 2],
        [x + 2, Z - 2],
        [X - 2, Z - 2],
      ])
        expect(
          nearest(ts, [u, layout.floorY + 0.3, v], [0, 1, 0], true),
          l.name + ' roof-free court',
        ).toBe(Infinity);
    }
    expect(
      30 - nearest(ts, [-70, 30, -26], [0, -1, 0], true),
      l.name + ' complete southwest low range',
    ).toBeCloseTo(layout.floorY + layout.lowEave, 3);
    const row = layout.rows[4],
      b = row.bays.find((b) => b.index === 6);
    expect(
      30 - nearest(ts, [b.x, 30, row.frontZ + 0.88 * 0.3], [0, -1, 0], true),
      l.name + ' raised central crown',
    ).toBeGreaterThan(16.4);
    const nt = layout.northTower,
      [x, z, X, Z] = nt.bounds;
    expect(
      nearest(ts, [(x + X) / 2, layout.floorY + nt.openLo + 1.2, Z + 5], [0, 0, -1], true),
      l.name + ' genuine open north chhatri',
    ).toBe(Infinity);
    const e = layout.entry;
    expect(
      nearest(ts, [e.centerX, layout.floorY + 1.2, e.z - 5.5], [0, 0, 1], true),
      l.name + ' open west entry into rear court',
    ).toBeGreaterThan(15);
    for (const [i, u] of [-e.approachWidth, e.approachWidth].entries())
      expect(
        30 -
          nearest(
            ts,
            [e.centerX + u, 30, e.z - e.approach.distance].map(Math.fround),
            [0, -1, 0],
            true,
          ),
        l.name + ' unchanged-field threshold corner',
      ).toBeCloseTo(e.approach.outerY[i], 3);
    expect(
      10 - nearest(ts, [layout.basin.center[0], 10, layout.basin.center[1]], [0, -1, 0], true),
      l.name + ' recessed dry basin',
    ).toBeCloseTo(layout.floorY - layout.basin.depth, 3);
    if (l.name === 'skyline') continue;
    const p = layout.arcades.find((p) => p.court === 0 && p.N[1] < -0.9),
      n = Math.max(1, Math.floor(p.length / (l.name === 'district' ? 9 : 3))),
      u = (p.length * (Math.floor(n / 2) + 0.5)) / n,
      point = (offset, y) => [
        p.A[0] + p.U[0] * u + p.N[0] * offset,
        y,
        p.A[1] + p.U[1] * u + p.N[1] * offset,
      ],
      hit = nearest(ts, point(0.2, layout.floorY + 1), [-p.N[0], 0, -p.N[1]], true);
    expect(hit, l.name + ' depth to closed court arcade back').toBeGreaterThan(1.7);
    expect(hit).toBeLessThan(2.5);
    for (const gallery of layout.rows.slice(3)) {
      const x = (gallery.loX + gallery.hiX) / 2;
      const depth = nearest(
        ts,
        [x, layout.floorY + gallery.y + 1, gallery.backZ - 0.3],
        [0, 0, 1],
        true,
      );
      expect(
        depth,
        l.name + ' upper rear gallery has real depth to its closed back',
      ).toBeGreaterThan(1.3);
      expect(depth).toBeLessThan(1.9);
    }
    expect(
      layout.floorY + 1 + nearest(ts, point(-p.depth * 0.5, layout.floorY + 1), [0, 1, 0], true),
      l.name + ' actual supported arch soffit',
    ).toBeCloseTo(layout.floorY + layout.arcadeCeiling - 0.16, 2);
    if (l.name === 'district') continue;
    const r = layout.rows[2],
      bay = r.bays.find((b) => b.index === 6),
      opening = 0.64 * bay.width * 0.58,
      offset = opening * (l.name === 'street' ? 0.25 : 0.2),
      F = [bay.x + offset, layout.floorY + r.y + 1.51, r.frontZ + 0.88 + 0.5],
      d = nearest(ts, F, [0, 0, -1], true);
    expect(d, l.name + ' actual projected/recessed lattice niche').toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.15);
  }
}, 60000);
it('uses the production viewer to replace the actual native building parts while retaining nearby buildings', async () => {
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
    point = ([x, z]) => [(c * x + s * z + 500) / 1000, (-s * x + c * z + 500) / 1000],
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
  expect(target).toHaveLength(1);
  expect(neighbor).toHaveLength(79);
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
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      sampleStructureTerrain: (coordinate) => field.sampleHeight(...wgs84ToWorld(1, ...coordinate)),
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Hawa Mahal actual map replacement',
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
    tile.buildings = [...target, ...neighbor];
    root = await renderers.humanFeatures.createTile(tile, {
      address: { level: 14, x: 0, z: 0 },
      tileSize: 1000,
      origin: [-500, -500],
      pyramid: {
        name: 'hawa_mahal-native-replacement',
        origin: [-500, -500],
        rootSize: 16384000,
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
    expect(root?.getObjectByName('structure:' + placed.id)).toBeDefined();
    expect(seen.length).toBeGreaterThan(0);
    expect(
      seen.at(-1).sort(),
      JSON.stringify({ remaining: seen.at(-1), owned: target.map((p) => p.id) }),
    ).toEqual(neighbor.map((b) => b.id).sort());
    expect(neighbor.map((b) => b.id)).toContain('native-3');
    expect(neighbor.map((b) => b.id)).toContain('native-7');
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
        'stone_limestone',
        'stone_granite',
        'plaster_lime',
        'metal_painted',
        'wood_painted_lap',
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
