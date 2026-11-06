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

const source = resolve('../../content/worldgen/source/places/sx/sxk/haydarpasa_railway_station'),
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
it('pins the full U-shaped historic station,seaward frame and source bytes without adopting the conflicting map height', async () => {
  const m = await read(source + '/source.json'),
    asset = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    spec = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(asset.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + asset.files.main))).toBe(asset.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, asset.id));
  expect(frame.anchor).toEqual([29.018828584, 40.996279957]);
  expect(frame.heading).toBe(-0.9339156946518966);
  expect(frame.mappedIdentity.wikidataId).toBe('Q800973');
  expect(frame.mappedIdentity.nativePrincipalId).toBe(35184845240709);
  expect(frame.mappedIdentity.featureIds).toEqual(['way/473151877']);
  expect(frame.orientationControl.uncertaintyDegrees).toBe(10);
  expect(layout.nativeMap.ownedParts).toEqual([28, 29, 45]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(48);
  expect(spec.sourceFacts.nativeBuildingHeight).toBe(7.25);
  expect(spec.sourceFacts.retainedBuildingLevels).toBe(8);
  expect(spec.sourceFacts.authoredMaximumMeters).toBe(45);
  expect(spec.sourceFacts.photoProportionedMeters.mainRoofRidge).toBe(33);
  expect(p.entry.datum).toBe('terrain');
  expect(p.entry.elevation).toBe(0);
  expect(p.entry.replaceFootprint).toBe(true);
  expect(p.entry.groundCutout.minHeight).toBe(-3);
  expect(p.entry.terrainReference.anchor).toEqual([29.018412342608492, 40.99604757148581]);
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
it('retains both unequal wings,open court,round towers/open lanterns,closed roofs and visible recessed glazing in all six models', async () => {
  const asset = await read(runtime + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'import', path: installed + '/' + asset.files.main },
      ...asset.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ];
  for (const f of files) {
    const ts = await triangles(f.path),
      top = (x, z) => 80 - nearest(ts, [x, 80, z], [0, -1, 0], true);
    for (const [x, z] of [
      [-30.1, 36.15],
      [30.15, 35.75],
    ]) {
      expect.soft(top(x, z), f.name + ' tower/antenna height').toBeCloseTo(45, 2);
      expect
        .soft(nearest(ts, [x, 41.5, 60], [0, 0, -1], true), f.name + ' genuine open lantern')
        .toBeGreaterThan(25);
    }
    for (const [x, z] of [
      [-27.6, 2],
      [26.8, -20],
      [0, 27.5],
    ])
      expect.soft(top(x, z), f.name + ' complete main/wing roof').toBeGreaterThan(32);
    expect
      .soft(
        nearest(ts, [0, 80, 0], [0, -1, 0], true),
        f.name + ' rail-side court has neither roof nor floor',
      )
      .toBe(Infinity);
    expect
      .soft(
        nearest(ts, [-27.6, 80, -24], [0, -1, 0], true),
        f.name + ' northwest wing stays shorter than southeast wing',
      )
      .toBe(Infinity);
    expect.soft(top(26.8, -35), f.name + ' complete long southeast return').toBeGreaterThan(26);
    const rear = -80 + nearest(ts, [27, 10, -80], [0, 0, 1], true);
    expect.soft(rear, f.name + ' closed rear of long return').toBeGreaterThan(-43);
    expect.soft(rear).toBeLessThan(-41);
    const entrance = 80 - nearest(ts, [0.2, 3.2, 80], [0, 0, -1], true);
    expect.soft(entrance, f.name + ' closed main glazed door').toBeGreaterThan(37);
    expect.soft(entrance).toBeLessThan(37.5);
    const court = -20 + nearest(ts, [0, 10.8, -20], [0, 0, 1], true);
    expect.soft(court, f.name + ' complete windowed court elevation').toBeGreaterThan(17.6);
    expect.soft(court).toBeLessThan(18.1);
    const round = 60 - nearest(ts, [-28.1, 27.7, 60], [0, 0, -1], true),
      expected = 36.15 + Math.sqrt(6.05 * 6.05 - 4);
    expect
      .soft(Math.abs(round - expected), f.name + ' curved cylindrical tower shaft')
      .toBeLessThan(0.17);
    expect
      .soft(80 - nearest(ts, [0, 28.1, 80], [0, 0, -1], true), f.name + ' clock face')
      .toBeGreaterThan(35.4);
    for (const [x, z] of [
      [0, 27],
      [-27, 0],
      [27, -20],
    ])
      expect
        .soft(
          -20 + nearest(ts, [x, -20, z], [0, 1, 0], true),
          f.name + ' closed occupied floor underside',
        )
        .toBeCloseTo(-3, 2);
    if (f.name !== 'skyline') {
      const glass = await triangles(f.path, 'window');
      for (const o of [
        [0.2, 3.2, 80],
        [9.4, 10.8, 80],
      ]) {
        const g = nearest(glass, o, [0, 0, -1], true);
        expect.soft(Number.isFinite(g), f.name + ' actual glazing').toBe(true);
        expect
          .soft(nearest(ts, o, [0, 0, -1], true), f.name + ' no solid backing over front glazing')
          .toBeCloseTo(g, 3);
      }
    }
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
  expect(target).toHaveLength(3);
  expect(neighbor).toHaveLength(48);
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
        title: 'Haydarpasa passenger building actual map replacement',
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
        name: 'haydarpasa_railway_station-native-replacement',
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
    ).toBeCloseTo(field.sampleHeight(0, 43.5), 2);
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
        'stone_limestone',
        'stone_granite',
        'slate',
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
