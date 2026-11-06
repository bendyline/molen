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

const source = resolve('../../content/worldgen/source/places/sr/srb/uffizi_gallery'),
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
it('binds the new complete palace source, signed native frame and exact replacement', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.heading).toBe(1.087134943276);
  expect(frame.mappedIdentity.wikidataId).toBe('Q51252');
  expect(p.entry.elevation).toBe(63);
  expect(p.entry.datum).toBe('sea-level');
  expect(p.entry.buildingCutout.minimumCoverage).toBeUndefined();
  expect(p.entry.buildingCutout.outlines).toHaveLength(1);
  expect(layout.nativeMap.ownedParts).toHaveLength(3);
  expect(layout.porticos).toHaveLength(2);
  expect(layout.bodies).toHaveLength(7);
  expect(layout.nativeMap.ownedParts).toEqual([124, 347, 349]);
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
it('preserves the open piazzale, deep closed-back porticos, three through arches, Tribune and supported threshold', async () => {
  const cs = Math.cos(layout.theta),
    sn = Math.sin(layout.theta),
    P = (u, y, v) => [cs * u - sn * v, y, sn * u + cs * v],
    U = [cs, 0, sn],
    V = [-sn, 0, cs];
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const u of [-60, -35, 0, 30, 65, 78])
      expect(
        nearest(ts, P(u, layout.floorY + 0.3, 0.5), [0, 1, 0]),
        l.name + ' roof-free piazzale ' + u,
      ).toBe(Infinity);
    for (const side of [-1, 1]) {
      const d = V.map((v) => v * side),
        distance = nearest(ts, P(10, 0.1, 0.5), d, true);
      expect(distance, l.name + ' real depth to closed portico back').toBeGreaterThan(10);
      expect(distance).toBeLessThan(12);
    }
    expect(
      0.1 + nearest(ts, P(10, 0.1, -8.5), [0, 1, 0], true),
      l.name + ' supported portico soffit',
    ).toBeCloseTo(3.2, 3);
    for (const v of layout.river.centers)
      expect(
        nearest(ts, P(-90, 0.1, v), U, true),
        l.name + ' through Arno passage ' + v,
      ).toBeGreaterThan(30);
    const [x, z] = layout.tribune.center;
    expect(40 - nearest(ts, [x, 40, z], [0, -1, 0], true), l.name + ' Tribune lantern').toBeCloseTo(
      28.35,
      2,
    );
    const ramp = layout.northApproach;
    for (const [i, v] of [ramp.bounds[1], ramp.bounds[3]].entries())
      expect(
        10 - nearest(ts, P(ramp.bounds[2], 10, v).map(Math.fround), [0, -1, 0], true),
        l.name + ' original-field corner',
      ).toBeCloseTo(ramp.outerY[i], 4);
    if (l.name === 'skyline') continue;
    const glass = (await triangles(runtime + '/' + l.file, 'window')).filter((p) =>
        p.every((q) => q[1] > layout.floorY + 0.6 && q[1] < 2.6),
      ),
      walls = await triangles(runtime + '/' + l.file, 'wall');
    for (let i = 0; i < glass.length; i += Math.max(1, Math.floor(glass.length / 24))) {
      const p = glass[i],
        center = [0, 1, 2].map((j) => p.reduce((s, q) => s + q[j] / 3, 0)),
        raw = cross(sub(p[1], p[0]), sub(p[2], p[0])),
        length = Math.hypot(...raw);
      if (length < 1e-7) continue;
      const normal = raw.map((v) => v / length),
        hit = nearest(
          walls,
          center.map((v, j) => v + normal[j] * 0.25),
          normal.map((v) => -v),
          true,
        );
      expect.soft(hit, l.name + ' exposed glazing ' + i).toBeGreaterThan(0.27);
      expect
        .soft(hit, l.name + ' seated glazing ' + i + ' at ' + JSON.stringify(center))
        .toBeLessThan(0.7);
    }
    const roofGlass = (await triangles(runtime + '/' + l.file, 'window')).filter((p) =>
        p.every((q) => q[1] > 19 && q[1] < 25.5),
      ),
      roofs = await triangles(runtime + '/' + l.file, 'roof');
    for (const p of roofGlass) {
      const q = [0, 1, 2].map((j) => p.reduce((s, v) => s + v[j] / 3, 0)),
        hit = nearest(roofs, [q[0], q[1] + 0.25, q[2]], [0, -1, 0], true);
      expect.soft(hit, l.name + ' exposed roof glazing').toBeGreaterThan(0.27);
      expect.soft(hit, l.name + ' skylight seated on its actual roof').toBeLessThan(0.7);
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
  expect(target).toHaveLength(3);
  expect(neighbor).toHaveLength(389);
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
        title: 'Uffizi actual map replacement',
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
        name: 'uffizi-native-replacement',
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
    const area = (r) =>
        Math.abs(
          r.reduce((s, p, i) => {
            const q = r[(i + 1) % r.length];
            return s + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2,
      polygonArea = (ps) =>
        ps.reduce(
          (s, p) => s + area(p.outer) - (p.holes ?? []).reduce((s, r) => s + area(r), 0),
          0,
        ),
      remaining = seenPolygons.at(-1).find((b) => b.id === 'native-391');
    expect(remaining, 'remote Vasari corridor retained').toBeDefined();
    const ratio = polygonArea(remaining.polygons) / polygonArea(all[391].polygons);
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.26);
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
        'tile_ceramic',
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
