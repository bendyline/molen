import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildSanssouciLevel,
  sanssouciColonnadeRows,
  sanssouciControls,
  sanssouciGroundY,
  sanssouciSurfaces,
} from '../../../content/worldgen/source/places/u3/u33/sanssouci_palace/models/sanssouci-model.mjs';
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

const source = resolve('../../content/worldgen/source/places/u3/u33/sanssouci_palace'),
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
    a = createArchitecturalSurfaceAuthoring(sanssouciSurfaces);
  buildSanssouciLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([13.038420787, 52.404345701]);
  expect(frame.heading).toBe(0.052172316825);
  expect(frame.axis).toContain('+X east');
  expect(frame.axis).toContain('+Z south');
  expect(frame.mappedIdentity.wikidataId).toBe('Q151330');
  expect(sanssouciControls.nativeMap.ownedParts).toEqual([
    4, 5, 8, 9, 10, 13, 15, 16, 188, 189, 190, 191, 192, 193,
  ]);
  expect(
    m.positions.reduce((h, v, i) => (i % 3 === 1 ? Math.max(h, v) : h), -Infinity),
  ).toBeCloseTo(15.05, 4);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.size).toEqual([129, 129]);
  expect(grid.stepMeters).toBe(2);
  expect(grid.tiles).toHaveLength(1);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    stone = await triangles(source + '/models/source.glb', 'trim'),
    bottom = stone.flat().reduce((h, p) => Math.min(h, p[1]), Infinity);
  for (const [x, z] of [
    [-35, -20],
    [35, 20],
    [82.7, 17.25],
    [-83.25, 19],
    [0, 25.67],
  ]) {
    expect(field.sampleHeight(x, z)).toBeCloseTo(sanssouciGroundY(x, z), 2);
    expect(bottom).toBeLessThan(field.sampleHeight(x, z));
  }
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(51);
  expect(placement.anchor).toEqual(frame.anchor);
  expect(placement.heading).toBe(frame.heading);
  expect(placement.buildingCutout.outlines).toHaveLength(14);
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
function samplePath(line, t) {
  const distances = [0];
  for (let i = 1; i < line.length; i++)
    distances.push(distances.at(-1) + Math.hypot(...sub(line[i], line[i - 1])));
  const d = t * distances.at(-1);
  let k = 1;
  while (k < distances.length - 1 && distances[k] < d) k++;
  const u = (d - distances[k - 1]) / (distances[k] - distances[k - 1]);
  return line[k - 1].map((v, i) => v + u * (line[k][i] - v));
}
it('retains the open forecourt, paired column rows, facing soffits and closed dome in every browser tier', async () => {
  for (const l of (await read(runtime + '/asset.json')).runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const [x, z] of [
      [0, 0],
      [0, -28],
    ])
      expect(nearest(ts, [x, 2, z], [0, 1, 0]), l.name + ' actual open court/gap').toBe(Infinity);
    expect(
      20 - nearest(ts, [-0.045, 20, 25.67], [0, -1, 0], true),
      l.name + ' crown cap',
    ).toBeCloseTo(15.05, 3);
    if (l.name !== 'skyline')
      expect(
        40 -
          nearest(
            await triangles(runtime + '/' + l.file, 'window'),
            [-0.045, 5, 40],
            [0, 0, -1],
            true,
          ),
        l.name + ' actual closed bowed front glazing',
      ).toBeCloseTo(31.269, 2);
    for (const index of [9, 10]) {
      const { inner, outer } = sanssouciColonnadeRows(index),
        I = samplePath(inner, 0.5),
        O = samplePath(outer, 0.5),
        width = Math.hypot(...sub(O, I)),
        D = sub(O, I).map((v) => v / width),
        origin = [I[0] - 2 * D[0], 3, I[1] - 2 * D[1]],
        dir = [D[0], 0, D[1]];
      expect(nearest(ts, origin, dir), l.name + ' open paired-row bay ' + index).toBe(Infinity);
      const wall = nearest(ts, [origin[0], 8.7, origin[2]], dir, true);
      expect(wall, l.name + ' facing inner frieze ' + index).toBeGreaterThan(1);
      expect(wall).toBeLessThan(3);
      expect(
        3 + nearest(ts, [(I[0] + O[0]) / 2, 3, (I[1] + O[1]) / 2], [0, 1, 0], true),
        l.name + ' downward facing soffit ' + index,
      ).toBeCloseTo(7.8, 3);
      for (const line of [inner, outer]) {
        const other = line === inner ? outer : inner,
          p = samplePath(line, 3 / 7),
          q = samplePath(other, 3 / 7),
          v = sub(q, p),
          len = Math.hypot(...v),
          center = p.map((n, i) => n + (0.48 * v[i]) / len),
          tangent = sub(samplePath(line, 3 / 7 + 0.01), samplePath(line, 3 / 7 - 0.01)),
          T = tangent.map((v) => v / Math.hypot(...tangent));
        const hit = nearest(
          ts,
          [center[0] + 2 * T[0], 4, center[1] + 2 * T[1]],
          [-T[0], 0, -T[1]],
          true,
        );
        expect(hit, l.name + ' each physical row ' + index).toBeGreaterThan(1.2);
        expect(hit).toBeLessThan(2);
      }
      const endI = samplePath(inner, 1),
        endO = samplePath(outer, 1),
        mid = endI.map((v, i) => (v + endO[i]) / 2),
        prev = samplePath(inner, 0.99),
        v = sub(endI, prev),
        T = v.map((n) => n / Math.hypot(...v));
      const endHit = nearest(
        ts,
        [mid[0] + 2 * T[0], 8.5, mid[1] + 2 * T[1]],
        [-T[0], 0, -T[1]],
        true,
      );
      expect(endHit, l.name + ' outward closed exposed north end ' + index).toBeGreaterThan(1.8);
      expect(endHit).toBeLessThan(2.2);
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
  const target = sanssouciControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = sanssouciControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(195);
  expect(target).toHaveLength(sanssouciControls.nativeMap.ownedParts.length);

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
        title: 'Sanssouci actual map replacement',
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
        name: 'sanssouci-native-replacement',
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
        'plaster_lime',
        'stone_limestone',
        'metal_copper',
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
