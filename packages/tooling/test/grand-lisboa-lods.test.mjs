import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildLisboaLevel,
  lisboaControls,
  lisboaGroundY,
  lisboaLocal,
  lisboaSurfaces,
} from '../../../content/worldgen/source/places/we/web/grand_lisboa/models/grand-lisboa-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { StructureModelLibrary } from '../../worldgen/dist/client.mjs';
import { emptyWorldgenStats, encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/we/web/grand_lisboa'),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
async function triangles(path, materialRef) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m
        .listPrimitives()
        .filter(
          (p) => !materialRef || p.getMaterial()?.getExtras()?.molenSurface?.ref === materialRef,
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

it('rebuilds the exact source and signed rear-shaft/front-casino frame with native arch-foot contact', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(lisboaSurfaces);
  buildLisboaLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([113.543346986, 22.190822312]);
  expect(frame.heading).toBe(0.770950765704);
  expect(lisboaControls.designFrame.origin).toEqual([15.25, -12.25]);
  expect(lisboaControls.tower.height).toBe(261);
  expect(lisboaControls.tower.leafTips).toHaveLength(7);
  expect(lisboaControls.nativeMap.towerHeight).toBe(210);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    ts = await triangles(
      source + '/models/source.glb',
      'matgraph:molen.worldgen.material.stone_granite',
    ),
    native = (u, y, v) => {
      const [x, z] = lisboaLocal(u, v);
      return [x, y, z];
    };
  expect(ts.length).toBeGreaterThan(100);
  for (const i of [2, 4, 6]) {
    const theta = -Math.PI / 2 + (i * Math.PI) / 8,
      u = 43 * 1.035 * Math.sin(theta),
      v = 29 + 29.5 * 1.035 * Math.cos(theta),
      [x, z] = lisboaLocal(u, v),
      ground = lisboaGroundY(x, z);
    expect(field.sampleHeight(x, z)).toBeCloseTo(ground, 2);
    expect(
      nearest(ts, native(u, ground + 2, v + 0.7), [0, -1, 0]),
      'actual sampled arch-foot block',
    ).toBeCloseTo(1.65, 2);
  }
  const p = (await read(source + '/placement-report.json')).entry;
  expect(p.replaceFootprint).toBe(true);
  expect(p.elevation).toBe(11);
  expect(p.anchor).toEqual(frame.anchor);
  expect(p.heading).toBe(frame.heading);
}, 30000);
it('retains the waist,upper leaf fan,crown,ovoid and actual near entrance opening in every browser tier', async () => {
  const asset = await read(runtime + '/asset.json'),
    angle = lisboaControls.designFrame.angle,
    c = Math.cos(angle),
    s = Math.sin(angle),
    point = (u, y, v) => {
      const [x, z] = lisboaLocal(u, v);
      return [x, y, z];
    },
    toMinusU = [-c, 0, -s],
    toMinusV = [s, 0, -c];
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file),
      top = 270 - nearest(ts, point(0, 270, 0), [0, -1, 0]);
    expect(top, l.name + ' total crown/finial').toBeGreaterThan(260.8);
    expect(top).toBeLessThan(261.2);
    const waist = 50 - nearest(ts, point(50, 100, 0), toMinusU),
      fan = 50 - nearest(ts, point(50, 210, 0), toMinusU);
    expect(waist, l.name + ' real narrow waist').toBeGreaterThan(12);
    expect(waist).toBeLessThan(24);
    expect(fan, l.name + ' expanded upper fan').toBeGreaterThan(30);
    expect(fan).toBeLessThan(42);
    const pedestal = 50 - nearest(ts, point(50, 32, 0), toMinusU);
    expect(pedestal, l.name + ' connected lower tower pedestal').toBeGreaterThan(20);
    expect(pedestal).toBeLessThan(29);
    expect(
      Number.isFinite(nearest(ts, point(27.49, 149, 80), toMinusV)),
      l.name + ' first distinct leaf tip',
    ).toBe(true);
    expect(nearest(ts, point(28.5, 151, 80), toMinusV), l.name + ' gap above first leaf tip').toBe(
      Infinity,
    );
    expect(nearest(ts, point(0, 70, 29), [0, -1, 0]), l.name + ' complete casino top').toBeCloseTo(
      16.01,
      1,
    );
    expect(
      270 - nearest(ts, point(6, 270, 0), [0, -1, 0]),
      l.name + ' ogive crown',
    ).toBeGreaterThan(238);
    if (['street', 'closeup'].includes(l.name)) {
      const opening = nearest(ts, point(3, 8.5, 70), toMinusV);
      expect(opening, l.name + ' physical entrance opening').toBeGreaterThan(25);
      expect(opening).toBeLessThan(35);
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
    point = ([x, z]) => [(c * x + s * z + 300) / 600, (-s * x + c * z + 300) / 600],
    all = [];
  for (const f of map.features.filter((f) => f.layer === 'buildings'))
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
  const target = [0, 11].map((i) => all[i]),
    neighbor = [13, 20, 2, 9].map((i) => all[i]);
  expect(all).toHaveLength(21);
  expect(target).toHaveLength(2);
  expect(target[0].height).toBe(55);
  expect(target[1].height).toBe(210);
  expect(neighbor[0].height).toBe(75);
  expect(neighbor[1].height).toBe(165);
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
        title: 'Grand Lisboa complete landmark actual map replacement',
        entries: [{ ...placed, anchor: [0, 0], bounds: undefined, minLevel: 0 }],
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
      tileSize: 600,
      origin: [-300, -300],
      pyramid: {
        name: 'lisboa-native-replacement',
        origin: [-300, -300],
        rootSize: 9830400,
        minLevel: 0,
        maxLevel: 14,
        tileResolution: 129,
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
    expect(seen.at(-1).sort()).toEqual(neighbor.map((b) => b.id).sort());
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('rebuilds four exact budgeted tiers with shared graphs and no private images, no image copies and separate GPU streams', async () => {
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
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of [
        'window_grid',
        'metal_painted',
        'metal_bronze_cast',
        'metal_stainless_polished',
        'stone_granite',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
          ),
        ).toBe(true);
    if (name !== 'skyline') {
      const shellRef = 'matgraph:molen.worldgen.material.metal_stainless_polished';
      expect(
        g.materials.find((m) => m.extras?.molenSurface?.ref === shellRef)?.extras.molenSurface.slot,
      ).toBe('wall');
      const doc = await new NodeIO().readBinary(bytes),
        colors = new Set();
      for (const mesh of doc.getRoot().listMeshes())
        for (const p of mesh.listPrimitives()) {
          if (p.getMaterial()?.getExtras()?.molenSurface?.ref !== shellRef) continue;
          const a = p.getAttribute('COLOR_0').getArray();
          for (let i = 0; i < a.length; i += 3) colors.add(Array.from(a.slice(i, i + 3)).join(','));
        }
      expect(
        colors.size,
        name + ' preserves authored mirrored-cell colors in the tinted variant',
      ).toBeGreaterThan(3);
    }
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
