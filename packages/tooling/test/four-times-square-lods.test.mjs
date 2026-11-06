import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildFourTimesSquareLevel,
  fourTimesSquareControls,
  fourTimesSquareEntryPoint,
  fourTimesSquareGroundY,
  fourTimesSquareSurfaces,
} from '../../../content/worldgen/source/places/dr/dr5/4_times_square/models/four-times-square-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/dr/dr5/4_times_square'),
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

it('reconstitutes the exact complete4 Times Square source andsigned native frame without flattening terrain', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(fourTimesSquareSurfaces);
  buildFourTimesSquareLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([-73.985806121, 40.756018717]);
  expect(frame.heading).toBe(-0.511202600773);
  expect(frame.mappedIdentity.wikidataId).toBe('Q687413');
  expect(fourTimesSquareControls.bodyTop).toBe(246.5);
  expect(fourTimesSquareControls.mast.top).toBe(341);
  expect(
    fourTimesSquareEntryPoint(9.2, 0, 10)[2] - fourTimesSquareEntryPoint(9.2, 0, 0)[2],
  ).toBeCloseTo(10, 8);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const p of [
    [-38, -24],
    [20, 30],
    [39, -29],
  ])
    expect(field.sampleHeight(...p)).toBeCloseTo(fourTimesSquareGroundY(...p), 2);
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.replaceFootprint).toBe(true);
  expect(placement.elevation).toBe(17);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
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
it('retains distinct main/curved/crown/low-base roofs and341m antenna;near tiers preserve recessed entry anddisplay openings', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const core = await triangles(runtime + '/' + l.file);
    expect(
      nearest(core, [25, 20, 20], [0, 0, 1]),
      l.name + ' complete central ground-floor facade',
    ).toBeGreaterThan(8);
    expect(nearest(core, [25, 20, 20], [0, 0, 1])).toBeLessThan(10);
    expect(nearest(core, [0, 239, -20], [0, 0, 1]), l.name + ' open upper support cage').toBe(
      Infinity,
    );
    const ts = await triangles(runtime + '/' + l.file),
      roof = await triangles(runtime + '/' + l.file, l.name === 'skyline' ? undefined : 'roof');
    for (const [x, z, top] of [
      [34, -17, 200],
      [-12, -12, 220],
      [-30, 0, 35],
    ])
      expect(400 - nearest(roof, [x, 400, z], [0, -1, 0]), l.name + ' roof ' + top).toBeCloseTo(
        top,
        2,
      );
    expect(400 - nearest(ts, [8.3, 400, 2.7], [0, -1, 0]), l.name + ' antenna top').toBeCloseTo(
      341,
      2,
    );
    expect(nearest(ts, [100, 400, 0], [0, -1, 0]), l.name + ' excludes One Bryant Park').toBe(
      Infinity,
    );
    if (l.name === 'closeup')
      expect(
        240 - nearest(ts, [1.3, 240, 6.7], [0, -1, 0]),
        'roof plant actual dimensions',
      ).toBeCloseTo(227, 2);
    if (['street', 'closeup'].includes(l.name)) {
      expect(
        nearest(ts, fourTimesSquareEntryPoint(7.2, 8, 20), [0, 0, -1]),
        l.name + ' actual recessed tall portal',
      ).toBeCloseTo(21.8, 2);
      expect(
        nearest(ts, fourTimesSquareEntryPoint(7.2, 8, -0.4), [0, 1, 0]),
        l.name + ' physical portal ceiling',
      ).toBeCloseTo(5.5, 2);
      const N = l.name === 'street' ? 24 : 40,
        mod = Math.max(2, Math.round(N / 8)),
        i = Array.from({ length: N }, (_, i) => i).find(
          (i) => i % mod === 0 && i > N * 0.4 && i < N * 0.7,
        ),
        angle = (-i * 2 * Math.PI) / N,
        angle2 = (-(i + 1) * 2 * Math.PI) / N,
        p = [-32.1 + 8.15 * Math.cos(angle), -24.1 + 8.35 * Math.sin(angle)],
        q = [-32.1 + 8.15 * Math.cos(angle2), -24.1 + 8.35 * Math.sin(angle2)],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        L = Math.hypot(dx, dz),
        n = [-dz / L, dx / L],
        ray = (y) => [
          [(p[0] + q[0]) / 2 + n[0] * 3, y, (p[1] + q[1]) / 2 + n[1] * 3],
          [-n[0], 0, -n[1]],
        ];
      const panel = ray(20),
        hole = ray(22.2);
      expect(nearest(ts, ...panel), l.name + ' display solid face').toBeCloseTo(3, 2);
      expect(nearest(ts, ...hole), l.name + ' physically recessed display aperture').toBeCloseTo(
        3.3,
        2,
      );
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
  const target = fourTimesSquareControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = fourTimesSquareControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(277);
  expect(target).toHaveLength(fourTimesSquareControls.nativeMap.ownedParts.length);
  expect(target.some((p) => p.height === 341)).toBe(true);
  expect(target.some((p) => p.height === 200)).toBe(true);
  expect(target.some((p) => p.height === 35)).toBe(true);

  expect(neighbor).toHaveLength(4);
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
        title: '4 Times Square / One Five One actual map replacement',
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
        name: 'four-times-square-native-replacement',
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
it('rebuilds four exact budgeted tiers with four shared graphs, no image copies and separate GPU streams', async () => {
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
      for (const graph of ['window_grid', 'metal_painted', 'membrane', 'stone_granite'])
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
