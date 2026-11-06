import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildRosenborgLevel,
  rosenborgControls,
  rosenborgGroundY,
  rosenborgSurfaces,
} from '../../../content/worldgen/source/places/u3/u3b/rosenborg_castle/models/rosenborg-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/u3/u3b/rosenborg_castle'),
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

it('rebuilds the individual source and signed four-tower/gatehouse frame on unchanged native terrain', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(rosenborgSurfaces);
  buildRosenborgLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([12.577432788, 55.685685066]);
  expect(frame.heading).toBe(-0.688618627761);
  expect(frame.axis).toContain('+X southeast');
  expect(frame.axis).toContain('+Z southwest');
  expect(frame.mappedIdentity.wikidataId).toBe('Q206101');
  expect(rosenborgControls.nativeMap.ownedParts).toEqual([1, 15]);
  expect(
    m.positions.reduce((h, v, i) => (i % 3 === 1 ? Math.max(h, v) : h), -Infinity),
  ).toBeCloseTo(49.2, 4);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.size).toEqual([129, 129]);
  expect(grid.stepMeters).toBe(2);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    stone = await triangles(source + '/models/source.glb', 'trim'),
    bottom = stone.flat().reduce((h, p) => Math.min(h, p[1]), Infinity);
  for (const [x, z] of [
    [-22, -5],
    [22, 5],
    [-36, -7],
    [25.03, -0.36],
    [37.15, -0.74],
  ]) {
    expect(field.sampleHeight(x, z)).toBeCloseTo(rosenborgGroundY(x, z), 2);
    expect(bottom).toBeLessThan(field.sampleHeight(x, z));
  }
  expect(rosenborgControls.geometryControls.gatehouse.floor).toBe(0.8);
  expect(0.8 - rosenborgGroundY(-36.2, -7.05)).toBeGreaterThan(0.1);
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(8);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
  expect(placement.buildingCutout.outlines).toHaveLength(2);
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
it('preserves the open gatehouse arch,real open lantern bays,distinct towers and mapped east bridge at all tiers', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file),
      n = [0.98853, 0, 0.15102],
      origin = [-36.2 - n[0] * 10, 2, -7.05 - n[2] * 10];
    expect(nearest(ts, origin, n), l.name + ' physically open gatehouse').toBeGreaterThan(15);
    expect(
      1 + nearest(ts, [-36.2, 1, -7.05], [0, 1, 0]),
      l.name + ' actual curved soffit',
    ).toBeCloseTo(4.25, 2);
    expect(
      10 - nearest(ts, [31.09, 10, -0.55], [0, -1, 0]),
      l.name + ' retained east bridge deck',
    ).toBeCloseTo(0.45, 2);
    expect(nearest(ts, [0.93, 33, 2], [0, 0, 1]), l.name + ' Great Tower lower lantern bay').toBe(
      Infinity,
    );
    for (const [x, z] of [
      [-12.75, -7.9],
      [11.75, -7.85],
    ]) {
      expect(
        nearest(ts, [x + 0.4, 26.2, z - 5], [0, 0, 1]),
        l.name + ' paired tower open lantern bay',
      ).toBe(Infinity);
      expect(
        60 - nearest(ts, [x, 60, z], [0, -1, 0]),
        l.name + ' separate paired tower/finial',
      ).toBeCloseTo(['skyline', 'district'].includes(l.name) ? 33.6 : 34.8, 3);
    }
    expect(
      60 - nearest(ts, [0.03, 60, 8.37], [0, -1, 0]),
      l.name + ' tall SW tower/finial',
    ).toBeCloseTo(['skyline', 'district'].includes(l.name) ? 48 : 49.2, 3);
    expect(
      40 - nearest(ts, [0.28, 40, -8.5], [0, -1, 0]),
      l.name + ' separate central stair dome',
    ).toBeCloseTo(21.6, 3);
    if (['street', 'closeup'].includes(l.name)) {
      const glass = await triangles(runtime + '/' + l.file, 'window');
      for (const sign of [-1, 1])
        expect(
          nearest(glass, [sign * 40, 15.1, -2.3], [-sign, 0, 0]),
          l.name + ' both end gables retain actual outward glazing',
        ).toBeLessThan(18);
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
  const target = rosenborgControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = rosenborgControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(80);
  expect(target).toHaveLength(rosenborgControls.nativeMap.ownedParts.length);

  expect(neighbor).toHaveLength(5);
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
        title: 'Rosenborg actual map replacement',
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
        name: 'rosenborg-native-replacement',
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
        'brick_flemish',
        'stone_limestone',
        'metal_copper',
        'tile_ceramic',
        'window_grid',
        'metal_painted',
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

it('keeps brick courses horizontal andcontinuous across the separate upper gatehouse arch strips', async () => {
  const doc = await new NodeIO().readBinary(await readFile(source + '/models/source.glb')),
    samples = [];
  for (const mesh of doc.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      if (
        primitive.getMaterial()?.getExtras()?.molenSurface?.ref ===
        'matgraph:molen.worldgen.material.brick_flemish'
      ) {
        const positions = primitive.getAttribute('POSITION').getArray(),
          uvs = primitive.getAttribute('TEXCOORD_0').getArray(),
          normals = primitive.getAttribute('NORMAL').getArray(),
          ids = primitive.getIndices().getArray();
        for (const i of ids) {
          const x = positions[i * 3] + 36.2,
            y = positions[i * 3 + 1],
            z = positions[i * 3 + 2] + 7.05,
            depth = x * 0.98853 + z * 0.15102,
            along = -x * 0.15102 + z * 0.98853;
          const facing = normals[i * 3] * 0.98853 + normals[i * 3 + 2] * 0.15102;
          if (
            facing < -0.99 &&
            Math.abs(y - 7.65) < 0.001 &&
            Math.abs(depth + 4.2) < 0.01 &&
            Math.abs(along) < 1.46
          )
            samples.push([uvs[i * 2], uvs[i * 2 + 1]]);
        }
      }
  expect(samples.length).toBeGreaterThan(20);
  expect(
    Math.max(...samples.map((p) => p[1])) - Math.min(...samples.map((p) => p[1])),
  ).toBeLessThan(0.0001);
  expect(
    Math.max(...samples.map((p) => p[0])) - Math.min(...samples.map((p) => p[0])),
  ).toBeGreaterThan(0.5);
});
