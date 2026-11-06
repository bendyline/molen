import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  avazControls,
  avazEntryPoint,
  avazGroundY,
  avazSurfaces,
  buildAvazLevel,
} from '../../../content/worldgen/source/places/sr/srv/avaz_twist_tower/models/avaz-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/sr/srv/avaz_twist_tower'),
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

it('reconstitutes the exact completeAvaz source,signed separate142m tower/23m parent andunmodified native contacts', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(avazSurfaces);
  buildAvazLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([18.402028942, 43.860979575]);
  expect(frame.heading).toBe(1.036479916284);
  expect(frame.mappedIdentity.wikidataId).toBe('Q790278');
  expect(avazControls.bodyTop).toBe(142);
  expect(avazControls.mast.top).toBe(172);
  expect(avazControls.podiumTop).toBe(23);
  expect(avazEntryPoint(8.5, 0, 10)[2] - avazEntryPoint(8.5, 0, 0)[2]).toBeLessThan(-9.9);
  const doc = await new NodeIO().readBinary(await readFile(source + '/models/source.glb')),
    seenUv = new Map();
  let duplicateUvVertices = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      if (p.getMaterial()?.getExtras()?.molenSurface?.slot !== 'window') continue;
      const pos = p.getAttribute('POSITION').getArray(),
        uv = p.getAttribute('TEXCOORD_0').getArray();
      for (const i of new Set(p.getIndices().getArray())) {
        const [x, y, z] = pos.slice(i * 3, i * 3 + 3);
        if (x >= -25 || y < 35 || y > 75) continue;
        const key = [x, y, z].map((v) => v.toFixed(5)).join(','),
          v = Array.from(uv.slice(i * 2, i * 2 + 2)),
          old = seenUv.get(key);
        if (old) {
          duplicateUvVertices++;
          const du = v[0] - old[0];
          expect(
            du - Math.round(du),
            'continuous paired-pane U, including periodic wrap',
          ).toBeCloseTo(0, 4);
          expect(v[1], 'continuous paired-pane V').toBeCloseTo(old[1], 4);
        } else seenUv.set(key, v);
      }
    }
  expect(duplicateUvVertices).toBeGreaterThan(100);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    ts = await triangles(source + '/models/source.glb');
  for (const u of [4.2, 12.8]) {
    const p = avazEntryPoint(u, 0, 2.75),
      h = avazGroundY(p[0], p[2]);
    expect(field.sampleHeight(p[0], p[2])).toBeCloseTo(h, 2);
    expect(
      nearest(ts, [p[0], h + 1, p[2]], [0, -1, 0]),
      'actual native-sampled canopy post',
    ).toBeCloseTo(1.4, 2);
  }
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.replaceFootprint).toBe(true);
  expect(placement.elevation).toBe(545);
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
it('keeps thelargecolumn-supportedgap physicallyopen withdistinctlower/upperglass roofs,straightcore,lowcomplex and172m mast', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    expect(nearest(ts, [-33, 102, -50], [0, 0, 1]), l.name + ' actualopenfrontgap').toBe(Infinity);
    expect(
      nearest(ts, [-50, 132, 0], [1, 0, 0]),
      l.name + ' continuous dark crown neck',
    ).toBeCloseTo(13.1, 2);

    for (const [x, z, y, top] of [
      [-42, -3, 103, 99],
      [-42, -4, 140, 128.7],
      [-15.5, 8, 160, 142],
      [30, -10, 50, 23],
      [-30, 30, 50, 18],
      [-27.8, 0, 200, 172],
    ]) {
      const h = y - nearest(ts, [x, y, z], [0, -1, 0]);
      if (top === 128.7) {
        expect(h, l.name + ' sloped front roof').toBeGreaterThan(128);
        expect(h).toBeLessThan(129);
      } else expect(h, l.name + ' distinctroof ' + top).toBeCloseTo(top, 2);
    }
    expect(nearest(ts, [90, 200, 70], [0, -1, 0]), 'excludesindependentneighbors').toBe(Infinity);
    if (['street', 'closeup'].includes(l.name)) {
      expect(
        nearest(ts, [20, 60, 0], [-1, 0, 0]),
        l.name + ' actual straight-core recess',
      ).toBeCloseTo(35.75, 2);
      expect(nearest(ts, [30, 4, -10], [0, 1, 0]), l.name + ' garage slab underside').toBeCloseTo(
        3.35,
        2,
      );

      const p = avazEntryPoint(9.5, 4, 12),
        e = avazControls.entrance,
        dx = e.q[0] - e.p[0],
        dz = e.q[1] - e.p[1],
        L = Math.hypot(dx, dz);
      expect(nearest(ts, p, [dz / L, 0, -dx / L]), l.name + ' physicallyrecessedentry').toBeCloseTo(
        13.8,
        1,
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
  const target = avazControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = avazControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(118);
  expect(target).toHaveLength(avazControls.nativeMap.ownedParts.length);
  expect(target.some((p) => p.height === 142)).toBe(true);
  expect(target.some((p) => p.height === 23)).toBe(true);
  expect(target[1].height).toBe(30);

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
        title: 'Avaz Twist Tower actual map replacement',
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
        name: 'avaz-native-replacement',
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
