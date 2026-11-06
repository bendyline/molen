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

const source = resolve('../../content/worldgen/source/places/u8/u84/peles_castle'),
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
it('binds the complete principal castle and front tower group to exact source/runtime pins and the signed relation frame', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.heading).toBeCloseTo(-0.104882802979, 12);
  expect(frame.mappedIdentity.featureIds).toEqual(['way/1454368027', 'way/1454368026']);
  expect(p.entry.elevation).toBe(928);
  expect(p.entry.datum).toBe('sea-level');
  expect(p.entry.buildingCutout.minimumCoverage).toBe(0.98);
  expect(p.entry.buildingCutout.outlines).toHaveLength(1);
  expect(layout.actualCourt.length).toBeGreaterThan(3);
  expect(layout.entries).toHaveLength(3);
  expect(layout.nativeMap.ownedParts).toHaveLength(148);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(31);
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
it('keeps the actual court and gateway open, the clock gallery hollow, the glass roof closed, and all approaches supported', async () => {
  const field = heightfieldFromPng(
    await read(source + '/terrain-review.terrain.json'),
    await readFile(source + '/terrain-review.height.png'),
  );
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file),
      glass = l.name === 'skyline' ? ts : await triangles(runtime + '/' + l.file, 'window');
    expect(
      nearest(ts, [-34, layout.floorY + 1, 22], [0, 1, 0], true),
      l.name + ' actual open court',
    ).toBe(Infinity);
    expect(
      nearest(ts, [layout.portal.x, layout.floorY + 1, 27.1], [0, 0, 1], true),
      l.name + ' through gateway',
    ).toBeGreaterThan(layout.portal.to - 27.1);
    const t = layout.clock,
      [x, z] = t.center;
    for (const sign of [-1, 1]) {
      const o = [x + sign * (t.width / 2 + 1), layout.floorY + 23, z];
      expect(
        nearest(ts, o, [-sign, 0, 0], true),
        l.name + ' real clock gallery opening',
      ).toBeGreaterThan(t.width + 1);
    }
    expect(
      nearest(ts, [x, layout.floorY + 23.4, z + t.depth / 2 + 1], [0, 0, -1], true),
      l.name + ' closed clock face',
    ).toBeLessThan(1.1);
    expect(
      60 - nearest(ts, [x, 60, z], [0, -1, 0], true),
      l.name + ' clock finial',
    ).toBeGreaterThan(46.7);
    const p = layout.polyTower;
    expect(
      60 - nearest(ts, [...p.center.slice(0, 1), 60, p.center[1]], [0, -1, 0], true),
      l.name + ' separate polygonal tower spire',
    ).toBeGreaterThan(37.6);
    expect(
      nearest(ts, [p.center[0], layout.floorY + 12, p.center[1] + 10], [0, 0, -1], true),
      l.name + ' continuous lower wall below polygonal timber stage',
    ).toBeLessThan(9);
    for (const [x, z] of [
      [-38, 7],
      [7, -18],
      [-46, 24],
      [3, 5],
    ])
      expect(
        60 - nearest(ts, [x, 60, z], [0, -1, 0], true),
        l.name + ' returned range roof',
      ).toBeGreaterThan(layout.floorY + 13);
    const g = layout.skylight;
    expect(
      60 - nearest(glass, [g.center[0], 60, g.center[1]], [0, -1, 0], true),
      l.name + ' closed glass roof',
    ).toBeCloseTo(g.topY, 3);
    expect(
      nearest(ts, [g.center[0], g.baseY - 0.7, g.center[1] + g.depth / 2 + 1], [0, 0, -1], true),
      l.name + ' solid curb below the glazed roof',
    ).toBeCloseTo(1, 3);
    const v = layout.veranda;
    expect(
      nearest(ts, [1.6, v.floorY - 1, 40], [0, 1, 0]),
      l.name + ' continuous buried veranda support',
    ).toBeCloseTo(1, 3);
    for (const e of layout.entries)
      for (const f of l.name === 'skyline' ? [-0.5, 0.5] : [-0.5, -0.25, 0, 0.25, 0.5]) {
        const X = e.center[0] + e.U[0] * e.width * f + e.N[0] * e.approachDistance,
          Z = e.center[1] + e.U[1] * e.width * f + e.N[1] * e.approachDistance;
        expect(
          40 - nearest(ts, [X, 40, Z].map(Math.fround), [0, -1, 0], true),
          l.name + ' native approach ' + e.owner,
        ).toBeCloseTo(field.sampleHeight(X, Z), 2);
      }
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
  expect(target).toHaveLength(148);
  expect(neighbor).toHaveLength(31);
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
        title: 'Peleș Castle actual map replacement',
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
        name: 'peles_castle-native-replacement',
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
    for (const i of layout.nativeMap.preservedNeighbors)
      expect(neighbor.map((b) => b.id)).toContain('native-' + i);
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('closes the four verified exterior gable gaps in the master, import and all browser tiers', async () => {
  const probes = [
      {
        p: [-47.102165, 8.6657045],
        y: 16.24443388032092,
        N: [-0.9999212066178804, 0.012553109409306443],
        roof: 'northwest-court-range',
      },
      {
        p: [-51.18608166425744, 31.76779886690949],
        y: 11.7897110036795,
        N: [0.9999937461635051, -0.003536613334734023],
        roof: 'southwest-gateway-range',
      },
      {
        p: [-55.008596, 31.754087],
        y: 11.77233887757264,
        N: [-0.9999983770435615, 0.0018016409861588906],
        roof: 'southwest-gateway-range',
      },
      {
        p: [-42.09644572881055, 31.800147884606893],
        y: 11.76930470012059,
        N: [-0.9999970248221781, 0.0024393332680050597],
        roof: 'southwest-gateway-range',
      },
    ],
    asset = await read(installed + '/asset.json'),
    cases = [
      { name: 'master', file: source + '/models/source.glb' },
      { name: 'runtime', file: installed + '/' + asset.files.main },
      ...asset.runtimeLods.levels.map((l) => ({ name: l.name, file: runtime + '/' + l.file })),
    ];
  for (const l of cases) {
    const ts = await triangles(l.file);
    for (const q of probes) {
      const hit = nearest(
        ts,
        [q.p[0] + q.N[0] * 5, q.y, q.p[1] + q.N[1] * 5],
        [-q.N[0], 0, -q.N[1]],
        true,
      );
      expect(hit, l.name + ' closed ' + q.roof + ' gable').toBeGreaterThan(
        l.name === 'skyline' ? 2.5 : 4.6,
      );
      expect(hit).toBeLessThan(l.name === 'skyline' ? 7.5 : 5.4);
    }
  }
}, 60000);
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
        'plaster_lime',
        'stone_limestone',
        'stone_granite',
        'wood_plain',
        'slate',
        'metal_copper',
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
