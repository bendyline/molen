import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildHolyroodLevel,
  holyroodControls,
  holyroodGroundY,
  holyroodSurfaces,
} from '../../../content/worldgen/source/places/gc/gcv/holyrood_palace/models/holyrood-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/gc/gcv/holyrood_palace'),
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

it('reconstitutes the individual palace source and signed native frame without changing terrain', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(holyroodSurfaces);
  buildHolyroodLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([-3.172065299, 55.952732505]);
  expect(frame.heading).toBe(-1.280290712416);
  expect(frame.axis).toContain('+X SSE');
  expect(frame.axis).toContain('+Z WSW');
  expect(frame.mappedIdentity.wikidataId).toBe('Q505950');
  expect(holyroodControls.nativeMap.ownedParts).toEqual([
    58, 59, 60, 61, 62, 63, 64, 65, 66, 73, 74, 75, 115, 116, 124,
  ]);
  expect(
    m.positions.reduce((h, v, i) => (i % 3 === 1 ? Math.max(h, v) : h), -Infinity),
  ).toBeCloseTo(28.25, 4);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.size).toEqual([129, 129]);
  expect(grid.stepMeters).toBe(2);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    stone = await triangles(source + '/models/source.glb'),
    bottom = stone.flat().reduce((h, p) => Math.min(h, p[1]), Infinity);
  for (const [x, z] of [
    [-29, -28],
    [29, -28],
    [-29, 19],
    [29, 19],
    [0, 28],
  ]) {
    expect(field.sampleHeight(x, z)).toBeCloseTo(holyroodGroundY(x, z), 2);
    expect(bottom).toBeLessThan(field.sampleHeight(x, z));
  }
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(41);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
  expect(placement.buildingCutout.outlines).toHaveLength(15);
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
it('keeps the court,west passage and four actual galleries open with facing soffits in every browser tier', async () => {
  const parts = await read(source + '/mapped-parts.json');
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    expect
      .soft(nearest(ts, [0, 3, 0], [0, 1, 0]), l.name + ' actual open central court')
      .toBe(Infinity);
    expect
      .soft(
        nearest(ts, [-0.45, 2.7, 40], [0, 0, -1]),
        l.name + ' front passage crosses court to rear gallery',
      )
      .toBeGreaterThan(59);
    for (const e of holyroodControls.geometryControls.courtEdges) {
      const x = (e.A[0] + e.Z[0]) / 2,
        z = (e.A[1] + e.Z[1]) / 2,
        N = e.N,
        origin = [x - 2 * N[0], 2.7, z - 2 * N[1]],
        d = [N[0], 0, N[1]],
        hit = nearest(ts, origin, d, true);
      if (e.lower)
        expect.soft(hit, l.name + ' inner gate bay continues all the way outside').toBe(Infinity);
      else {
        expect
          .soft(hit, l.name + ' actual gallery reaches deep closed back wall ' + e.id)
          .toBeGreaterThan(4.85);
        expect.soft(hit).toBeLessThan(5.1);
      }
      const soffit = 2.7 + nearest(ts, [x + N[0] * 0.2, 2.7, z + N[1] * 0.2], [0, 1, 0], true);
      expect.soft(soffit, l.name + ' curved/simplified facing soffit ' + e.id).toBeGreaterThan(4.1);
      expect.soft(soffit).toBeLessThan(4.5);
      expect
        .soft(
          2.7 +
            nearest(ts, [x + N[0] * 1.5 + (e.lower ? 3 : 0), 2.7, z + N[1] * 1.5], [0, 1, 0], true),
          l.name + ' deep gallery ceiling ' + e.id,
        )
        .toBeCloseTo(5.9, 3);
    }
    for (let i = 0; i < holyroodControls.geometryControls.courtEdges.length; i++) {
      const edges = holyroodControls.geometryControls.courtEdges,
        e = edges[i],
        f = edges[(i + 1) % edges.length],
        A = e.Z.map((v, k) => v + 3 * e.N[k]),
        Z = f.A.map((v, k) => v + 3 * f.N[k]),
        M = A.map((v, k) => (v + Z[k]) / 2),
        v = [-M[0], -3 - M[1]],
        n = Math.hypot(...v),
        N = v.map((x) => x / n);
      const hit = nearest(ts, [M[0] + 0.8 * N[0], 2.7, M[1] + 0.8 * N[1]], [-N[0], 0, -N[1]], true);
      expect.soft(hit, l.name + ' closed facing gallery corner return ' + i).toBeGreaterThan(0.5);
      expect.soft(hit).toBeLessThan(0.9);
    }
    if (['street', 'closeup'].includes(l.name))
      expect
        .soft(
          nearest(ts, [-0.3, 15.3, 18], [0, 0, 1]),
          l.name + ' actual opening between crown hoops',
        )
        .toBe(Infinity);
    expect
      .soft(
        35 - nearest(ts, [4, 35, -27], [0, -1, 0], true),
        l.name + ' closed lead upper roof deck',
      )
      .toBeCloseTo(23, 3);
    for (const x of [-7, 7])
      expect
        .soft(35 - nearest(ts, [x, 35, -27], [0, -1, 0], true), l.name + ' each rear cupola finial')
        .toBeCloseTo(27.6, 3);
    for (const i of [59, 60, 61, 62, 63, 64]) {
      const b = parts.parts[i].bounds,
        x = (b[0] + b[2]) / 2,
        z = (b[1] + b[3]) / 2;
      expect
        .soft(
          35 - nearest(ts, [x, 35, z], [0, -1, 0], true),
          l.name + ' each actual turret cone/finial ' + i,
        )
        .toBeCloseTo(24.9, 3);
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
  const target = holyroodControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = holyroodControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(125);
  expect(target).toHaveLength(holyroodControls.nativeMap.ownedParts.length);

  expect(neighbor).toHaveLength(9);
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
        title: 'Holyrood actual map replacement',
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
        name: 'holyrood-native-replacement',
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
        'stone_sandstone',
        'stone_limestone',
        'slate',
        'metal_painted',
        'window_grid',
        'wood_painted_lap',
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
