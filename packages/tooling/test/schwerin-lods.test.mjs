import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildSchwerinLevel,
  schwerinControls,
  schwerinGatePoint,
  schwerinGroundY,
  schwerinSurfaces,
} from '../../../content/worldgen/source/places/u3/u38/schwerin_castle/models/schwerin-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/u3/u38/schwerin_castle'),
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

it('reconstitutes the individual castle and signed native frame while retaining the terrain field', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(schwerinSurfaces);
  buildSchwerinLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([11.418599953, 53.624445004]);
  expect(frame.heading).toBe(1.323804672838);
  expect(frame.axis).toContain('+X NNE');
  expect(frame.axis).toContain('+Z ESE');
  expect(frame.mappedIdentity.wikidataId).toBe('Q573656');
  expect(schwerinControls.nativeMap.ownedParts).toHaveLength(50);
  expect(schwerinControls.towers).toHaveLength(9);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.size).toEqual([129, 129]);
  expect(grid.stepMeters).toBe(2);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const [x, z] of [
    [-29, -28],
    [29, -28],
    [-29, 19],
    [29, 19],
    [0, 28],
  ])
    expect(field.sampleHeight(x, z)).toBeCloseTo(schwerinGroundY(x, z), 2);
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(47);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
  expect(placement.buildingCutout.outlines).toHaveLength(50);
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
it('preserves the open courtyard,through passage,facing soffit,opaque roofs and distinct dome/tower skyline in each browser tier', async () => {
  const d = schwerinGatePoint(0, 0, 1).map((v, i) => v - schwerinGatePoint(0, 0, 0)[i]);
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file),
      p = schwerinGatePoint(0, 3, -3);
    if (l.name !== 'skyline') {
      const panes = await triangles(runtime + '/' + l.file, 'window');
      for (const [i, e] of schwerinControls.facades.entries()) {
        const A = e.Z,
          Z = e.A,
          length = Math.hypot(Z[0] - A[0], Z[1] - A[1]),
          N = [-(Z[1] - A[1]) / length, (Z[0] - A[0]) / length],
          n = e.bays ?? Math.max(2, Math.round(length / (l.name === 'district' ? 9 : 5.5))),
          t = (Math.floor(n / 2) + 0.5) / n,
          origin = [A[0] + (Z[0] - A[0]) * t + N[0] * 3, 15.5, A[1] + (Z[1] - A[1]) * t + N[1] * 3],
          direction = [-N[0], 0, -N[1]],
          glass = nearest(panes, origin, direction, true),
          first = nearest(ts, origin, direction, true);
        expect.soft(glass, l.name + ' outward glazing on range ' + i).toBeCloseTo(2.96, 2);
        expect
          .soft(first, l.name + ' glazing exposed ahead of masonry on range ' + i)
          .toBeGreaterThan(glass - 0.25);
      }
    }
    expect
      .soft(nearest(ts, [0, 4, 0], [0, 1, 0]), l.name + ' actual open central courtyard')
      .toBe(Infinity);
    expect.soft(nearest(ts, p, d), l.name + ' actual diagonal through passage').toBeGreaterThan(30);
    const q = schwerinGatePoint(0, 2.5, 12),
      soffit = 2.5 + nearest(ts, q, [0, 1, 0], true);
    expect.soft(soffit, l.name + ' facing barrel vault').toBeGreaterThan(6.2);
    expect.soft(soffit).toBeLessThan(6.6);
    const roof = 60 - nearest(ts, [12, 60, -32], [0, -1, 0], true);
    expect.soft(roof, l.name + ' opaque west roof deck').toBeGreaterThan(31);
    expect.soft(roof).toBeLessThan(33);
    const gold = 60 - nearest(ts, [22.65, 60, -16.45], [0, -1, 0], true),
      green = 60 - nearest(ts, [-2.9, 60, -31.5], [0, -1, 0], true);
    expect.soft(gold, l.name + ' golden dome').toBeGreaterThan(46);
    expect.soft(gold).toBeLessThan(50);
    expect.soft(green, l.name + ' separate green dome').toBeGreaterThan(36);
    expect.soft(green).toBeLessThan(38);
    for (const t of schwerinControls.towers.filter((t) => !t.small)) {
      const top = 60 - nearest(ts, [t.x, 60, t.z], [0, -1, 0], true);
      expect.soft(top, l.name + ' distinct tower ' + t.id).toBeCloseTo(t.top + 0.5, 2);
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
  const target = schwerinControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = schwerinControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(290);
  expect(target).toHaveLength(schwerinControls.nativeMap.ownedParts.length);

  expect(neighbor).toHaveLength(12);
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
        title: 'Schwerin actual map replacement',
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
        name: 'schwerin-native-replacement',
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
        'brick',
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
