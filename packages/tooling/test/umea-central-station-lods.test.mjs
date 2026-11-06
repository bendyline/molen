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

const source = resolve('../../content/worldgen/source/places/u7/u7q/umea_central_station'),
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
it('pins the exact station identity, signed street/platform frame, four native parts and current source bytes', async () => {
  const m = await read(source + '/source.json'),
    asset = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    spec = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(asset.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + asset.files.main))).toBe(asset.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, asset.id));
  expect(frame.anchor).toEqual([20.266860669, 63.829945769]);
  expect(frame.heading).toBe(-0.633551747851);
  expect(frame.mappedIdentity.wikidataId).toBe('Q3374603');
  expect(frame.mappedIdentity.featureIds).toContain('way/107126501');
  expect(frame.mappedIdentity.nativePrincipalId).toBe(35184479215333);
  expect(frame.orientationControl.uncertaintyDegrees).toBe(10);
  expect(layout.nativeMap.ownedParts).toEqual([62, 122, 123, 124]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(150);
  expect(spec.sourceFacts.nativeMainHeightMeters).toBe(11);
  expect(spec.sourceFacts.nativeWingHeightMeters).toBe(5);
  expect(spec.sourceFacts.authoredMaximumMeters).toBe(19.05);
  expect(p.entry.datum).toBe('terrain');
  expect(p.entry.elevation).toBe(0);
  expect(p.entry.replaceFootprint).toBe(true);
  expect(p.entry.groundCutout.minHeight).toBe(-3);
  expect(p.entry.terrainReference.anchor).toEqual([20.26675214490603, 63.82988061087494]);
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
it('keeps both wings, three gables, full roofs, rounded bay, real arch recesses, closed doors and occupied floors in all six models', async () => {
  const asset = await read(runtime + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'import', path: installed + '/' + asset.files.main },
      ...asset.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ];
  for (const f of files) {
    const ts = await triangles(f.path),
      far = f.name === 'skyline';
    expect
      .soft(40 - nearest(ts, [2, 40, 0], [0, -1, 0], true), f.name + ' complete main roof ridge')
      .toBeCloseTo(17.5, 2);
    expect
      .soft(
        40 - nearest(ts, [0, 40, 7.5], [0, -1, 0], true),
        f.name + ' tall central clock gable cap',
      )
      .toBeCloseTo(19.05, 2);
    for (const x of [-7.45, 7.3])
      expect
        .soft(40 - nearest(ts, [x, 40, 7.5], [0, -1, 0], true), f.name + ' both side gables remain')
        .toBeCloseTo(16.65, 2);
    for (const x of [-14, 14]) {
      expect
        .soft(
          40 - nearest(ts, [x, 40, -0.8245], [0, -1, 0], true),
          f.name + ' complete low wing roof',
        )
        .toBeCloseTo(9.3, 2);
      expect
        .soft(-20 + nearest(ts, [x, -20, 0], [0, 1, 0], true), f.name + ' closed wing floor')
        .toBeCloseTo(-3, 2);
      expect
        .soft(4.7 + nearest(ts, [x, 4.7, 0], [0, 1, 0], false), f.name + ' low roof underside')
        .toBeCloseTo(5.2, 2);
    }
    expect
      .soft(20 - nearest(ts, [-7.5, 9.9, 20], [0, 0, -1], true), f.name + ' closed curved bay roof')
      .toBeGreaterThan(8.4);
    expect
      .soft(
        -20 + nearest(ts, [-7.5, -20, 8], [0, 1, 0], true),
        f.name + ' closed rounded bay floor',
      )
      .toBeCloseTo(-3, 2);
    const door = 20 - nearest(ts, [0, 2, 20], [0, 0, -1], true);
    expect.soft(door, f.name + ' closed recessed entry').toBeGreaterThan(7);
    expect.soft(door).toBeLessThan(7.4);
    const glassDoor =
      20 - nearest(await triangles(f.path, 'window'), [0.4, 3.4, 20], [0, 0, -1], true);
    if (!far) {
      expect.soft(glassDoor, f.name + ' glazed closed entry transom').toBeGreaterThan(7);
      expect.soft(glassDoor).toBeLessThan(7.4);
    }
    for (const x of [-16.2, 11.952]) {
      const glass = 20 - nearest(ts, [x, 2, 20], [0, 0, -1], true);
      expect.soft(glass, f.name + ' both wings have closed glazing').toBeGreaterThan(5.3);
      expect.soft(glass).toBeLessThan(5.9);
    }
    expect
      .soft(20 - nearest(ts, [0.7, 16, 20], [0, 0, -1], true), f.name + ' clock disc survives')
      .toBeCloseTo(7.49, 2);
    if (!far)
      expect
        .soft(
          3.9 + nearest(ts, [-16.2, 3.9, 5.6], [0, 1, 0], false),
          f.name + ' true curved arch soffit',
        )
        .toBeCloseTo(4.35, 2);
    expect
      .soft(-20 + nearest(ts, [0, -20, 0], [0, 1, 0], true), f.name + ' closed central floor')
      .toBeCloseTo(-3, 2);
  }
}, 60000);
it('uses the production viewer to replace the entire historic station and preserve all independent native neighbors', async () => {
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
  expect(target).toHaveLength(4);
  expect(neighbor).toHaveLength(150);
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
      sampleStructureTerrain: (coordinate) => {
        const [e, S] = wgs84ToWorld(1, ...coordinate);
        return field.sampleHeight(e * c - S * s, e * s + S * c);
      },
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Umea Central Station actual map replacement',
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
      tileSize: 4000,
      origin: [-2000, -2000],
      pyramid: {
        name: 'umea_central_station-native-replacement',
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
    ).toBeCloseTo(field.sampleHeight(0, 9), 2);
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
        'brick',
        'stone_limestone',
        'stone_granite',
        'metal_copper',
        'wood_plain',
        'metal_painted',
        'window_punched',
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
