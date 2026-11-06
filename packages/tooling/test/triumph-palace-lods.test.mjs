import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildTriumphLevel,
  triumphControls,
  triumphGroundY,
  triumphSurfaces,
} from '../../../content/worldgen/source/places/uc/ucf/triumph_palace/models/triumph-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/uc/ucf/triumph_palace'),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
async function triangles(path) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m.listPrimitives().flatMap((p) => {
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

it('rebuilds the exact complete source with all mapped height parts, signed frame and native contact', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    layout = await read(source + '/layout.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(triumphSurfaces);
  buildTriumphLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([37.520704895, 55.798195219]);
  expect(frame.heading).toBe(1.388390533861);
  expect(layout.parts).toHaveLength(32);
  expect(layout.spire.center).toEqual([31.75, -0.25]);
  expect(layout.spire.topY).toBe(264);
  expect(layout.columns).toHaveLength(188);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const [x, z] of layout.podium.flat(2)) {
    expect(triumphGroundY(x, z)).toBeLessThan(0);
    expect(field.sampleHeight(x, z)).toBeCloseTo(triumphGroundY(x, z), 2);
  }
  const ts = await triangles(source + '/models/source.glb');
  for (const portico of layout.porticos) {
    const [x, z] = portico.center,
      outer = z + portico.side * 12,
      ground = field.sampleHeight(x, outer);
    expect(nearest(ts, [x, ground + 3, outer - portico.side * 0.1], [0, -1, 0])).toBeCloseTo(
      2.88,
      1,
    );
  }
  const p = (await read(source + '/placement-report.json')).entry;
  expect(p.replaceFootprint).toBe(true);
  expect(p.elevation).toBe(160);
  expect(p.anchor).toEqual(frame.anchor);
  expect(p.heading).toBe(frame.heading);
}, 30000);
it('keeps every wing and both court relationships, with physically open near colonnades', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const [x, z, top] of [
      [31.75, -0.25, 264],
      [5, 0, 165],
      [62, 0, 165],
      [-112, 35, 80],
      [-112, -35, 80],
      [-68, 41, 60],
      [-68, -41, 60],
      [-18, 35, 100],
      [-18, -35, 100],
      [84, 37, 100],
      [84, -37, 100],
      [116, 32, 50],
      [116, -32, 50],
    ]) {
      const hit = nearest(ts, [x, 280, z], [0, -1, 0]);
      expect(Number.isFinite(hit), l.name + ' complete wing').toBe(true);
      expect(Math.abs(280 - hit - top), l.name + ' mapped top at ' + x + ',' + z).toBeLessThan(1.2);
    }
    expect(nearest(ts, [-80, 200, 0], [0, -1, 0]), l.name + ' low roof court').toBeCloseTo(190, 1);
    expect(nearest(ts, [115, 200, 0], [0, -1, 0]), l.name + ' open end court').toBe(Infinity);
    if (['street', 'closeup'].includes(l.name)) {
      const outside = triumphControls.columns.filter((p) => p[1] < -52).sort((a, b) => a[0] - b[0]),
        x = (outside[3][0] + outside[4][0]) / 2;
      expect(
        nearest(ts, [x, 4, -56], [0, 0, 1]),
        l.name + ' actual arcade opening',
      ).toBeGreaterThan(4);
      expect(nearest(ts, [x, 4, -52], [0, 1, 0]), l.name + ' canopy underside').toBeCloseTo(4, 2);
    }
    if (l.name === 'closeup')
      expect(
        nearest(ts, [8, 64, -16.25], [0, 0, 1]),
        'window remains present through the60–65m map band',
      ).toBeLessThan(1.99);
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
  const target = all.filter(
      (f) =>
        f.kind === 'building_part' &&
        f.bb[0] >= -134 &&
        f.bb[2] <= 134 &&
        f.bb[1] >= -56 &&
        f.bb[3] <= 56,
    ),
    neighbor = all
      .filter(
        (f) =>
          f.kind === 'building' &&
          (f.bb[0] > 145 || f.bb[2] < -145 || f.bb[1] > 70 || f.bb[3] < -70) &&
          f.bb.every((v) => Math.abs(v) < 240),
      )
      .slice(0, 4);
  expect(target).toHaveLength(32);
  expect(neighbor.length).toBeGreaterThan(0);
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
        title: 'Triumph Palace actual map replacement',
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
        name: 'triumph-native-replacement',
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
it('rebuilds four exact budgeted tiers with five shared graphs, no image copies and separate GPU streams', async () => {
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
        'stone_travertine',
        'plaster_lime',
        'window_grid',
        'metal_painted',
        'stone_granite',
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
