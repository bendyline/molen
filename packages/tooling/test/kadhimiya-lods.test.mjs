import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildKadhimiyaLevel,
  kadhimiyaControls,
  kadhimiyaGroundY,
  kadhimiyaSurfaces,
} from '../../../content/worldgen/source/places/sv/svz/al_kadhimiya_mosque/models/kadhimiya-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { StructureModelLibrary } from '../../worldgen/dist/client.mjs';
import { emptyWorldgenStats, encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sv/svz/al_kadhimiya_mosque'),
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
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reconstitutes the full individual source,signed sanctuary plan and unmodified standard terrain', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(kadhimiyaSurfaces);
  buildKadhimiyaLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([44.338190184, 33.380223622]);
  expect(frame.heading).toBe(-1.565873163556);
  expect(frame.axis).toContain('+X almost due south');
  expect(frame.axis).toContain('+Z almost due west');
  expect(Math.cos(frame.heading)).toBeGreaterThan(0);
  expect(Math.sin(frame.heading)).toBeLessThan(0);
  expect(frame.mappedIdentity.wikidataId).toBe('Q154116');
  expect(kadhimiyaControls.perimeter.polygons[0]).toHaveLength(3);
  expect(kadhimiyaControls.nativeMap.ownedParts).toHaveLength(22);
  expect(m.positions.reduce((n, v, i) => (i % 3 === 1 ? Math.max(n, v) : n), -Infinity)).toBe(35);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.size).toEqual([129, 129]);
  expect(grid.stepMeters).toBe(4);
  expect(grid.tiles).toHaveLength(2);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    foundation = await triangles(source + '/models/source.glb', 'foundation');
  for (const [x, z] of [
    [1.5, -19.85],
    [56.05, -14.35],
  ]) {
    const h = field.sampleHeight(x, z);
    expect(h).toBeCloseTo(kadhimiyaGroundY(x, z), 2);
    expect(
      foundation.some((t) => t.some((p) => Math.hypot(p[0] - x, p[2] - z) < 0.8 && p[1] < h - 0.2)),
    ).toBe(true);
  }
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(50);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
  expect(placement.buildingCutout.outlines).toHaveLength(22);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: await read(source + '/source.json'),
      spec: await read(source + '/spec.json'),
      placement,
      geographicReviewed: true,
    }),
  ).toBeDefined();
}, 30000);
it('preserves the open court,four mapped gates,actual columned porch,twin gold and blue domes,minarets and clock at every tier', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const [x, z] of [
      [65, 0],
      [60, -40],
      [40, 45],
    ])
      expect(nearest(ts, [x, 20, z], [0, 1, 0]), l.name + ' open sky above court').toBe(Infinity);
    for (const k of kadhimiyaControls.gates.filter((k) => k.target === 'perimeter')) {
      const horizontal = k.axis[0] !== 0,
        o = horizontal ? [112, 2, k.center[1]] : [k.center[0], 2, -77],
        dir = horizontal ? [-1, 0, 0] : [0, 0, 1];
      expect(nearest(ts, o, dir), l.name + ' mapped open ' + k.name).toBeGreaterThan(
        horizontal ? 25 : 24,
      );
      if (['street', 'closeup'].includes(l.name)) {
        const [x, z] = k.barrelCenter;
        expect(
          1 + nearest(ts, [x, 1, z], [0, 1, 0]),
          l.name + ' physical pointed soffit',
        ).toBeCloseTo(k.spring + k.rise, 2);
      }
    }
    for (const d of kadhimiyaControls.goldDomes)
      expect(
        70 - nearest(ts, [d.center[0], 70, d.center[1]], [0, -1, 0]),
        l.name + ' separate gold dome/finial',
      ).toBeCloseTo(33, 2);
    const d = kadhimiyaControls.blueDome;
    expect(70 - nearest(ts, [d.center[0], 70, d.center[1]], [0, -1, 0])).toBeCloseTo(25, 2);
    for (const d of kadhimiyaControls.mainMinarets)
      expect(
        70 - nearest(ts, [d.center[0], 70, d.center[1]], [0, -1, 0]),
        l.name + ' native minaret',
      ).toBeCloseTo(35, 2);
    expect(
      70 - nearest(ts, [99.7, 70, 6.6], [0, -1, 0]),
      l.name + ' south middle-gate clock',
    ).toBeCloseTo(25.2, 2);
    for (const [x, z, roof] of [
      [-20, 20, 15],
      [-70, 20, 10],
      [-98, 44, 10],
      [-15, -40, 15],
    ])
      expect(
        50 - nearest(ts, [x, 50, z], [0, -1, 0]),
        l.name + ' full range/perimeter roof',
      ).toBeCloseTo(roof, 2);
    expect(
      nearest(ts, [10, 8, -30], [0, 0, 1]),
      l.name + ' physically open porch bay',
    ).toBeGreaterThan(16.5);
    if (['street', 'closeup'].includes(l.name)) {
      expect(
        nearest(ts, [7.41875, 8, -30], [0, 0, 1]),
        l.name + ' separate physical porch column',
      ).toBeLessThan(11.5);
    }
    if (l.name !== 'skyline') {
      const paving = await triangles(runtime + '/' + l.file, 'foundation');
      for (const [x, z] of [
        [50, -8],
        [53, 0],
        [51, 10],
        [54, 17],
      ])
        expect(
          7 - nearest(paving, [x, 7, z], [0, -1, 0]),
          l.name + ' marble paving covers the unchanged native field',
        ).toBeGreaterThanOrEqual(Math.max(0, kadhimiyaGroundY(x, z)) + 0.02);
    }
    if (l.name === 'closeup') {
      const m = kadhimiyaControls.mainMinarets[0];
      expect(
        nearest(ts, [m.center[0] + 0.75, 25, m.center[1] - 4], [0, 0, 1]),
        'open minaret balcony;no filled shaft below the arch floor',
      ).toBeGreaterThan(8);
      expect(
        nearest(ts, [100.1, 19.4, 2.6], [0, 0, 1]),
        'open clock belfry above the dial stage',
      ).toBeGreaterThan(8);
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
  const target = kadhimiyaControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = kadhimiyaControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(37);
  expect(target).toHaveLength(kadhimiyaControls.nativeMap.ownedParts.length);

  expect(neighbor).toHaveLength(6);
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
  const objects = new StructureModelLibrary(async () => model),
    seen = [],
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Al-Kadhimiya Mosque actual map replacement',
        entries: [
          {
            ...placed,
            anchor: [0, 0],
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
          if (request.features?.buildings) seen.push(request.tile.buildings.map((b) => b.id));
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
    const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    );
    root = await renderers.humanFeatures.createTile(tile, {
      address: { level: 14, x: 0, z: 0 },
      tileSize: 1000,
      origin: [-500, -500],
      pyramid: {
        name: 'kadhimiya-native-replacement',
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
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('rebuilds four exact budgeted tiers with six shared graphs, no image copies and separate GPU streams', async () => {
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
        'brick_flemish',
        'stone_marble',
        'tile_mosaic',
        'membrane',
        'metal_stainless_polished',
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
