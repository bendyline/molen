import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';

import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  controls,
  station,
} from '../../../content/worldgen/source/places/ud/udt/saint_petersburg_dam/models/dam-model.mjs';
import { createEmptyTerrainSemanticTile } from '../../terrain/dist/kernel.mjs';
import { hashBytes, modelInputHash } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ud/udt/saint_petersburg_dam'),
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
    if (
      d[0] === 0 &&
      d[2] === 0 &&
      (o[0] < Math.min(p[0][0], p[1][0], p[2][0]) - 1e-5 ||
        o[0] > Math.max(p[0][0], p[1][0], p[2][0]) + 1e-5 ||
        o[2] < Math.min(p[0][2], p[1][2], p[2][2]) - 1e-5 ||
        o[2] > Math.max(p[0][2], p[1][2], p[2][2]) + 1e-5)
    )
      return best;
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

const frame = await read(source + '/map-frame.json');

it('pins the native A-118 corridor, eight openings and shared sea-level frame', async () => {
  const m = await read(source + '/source.json'),
    p = await read(source + '/placement-report.json'),
    a = await read(installed + '/asset.json'),
    spec = await read(source + '/spec.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(a.sourceHash);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(p.entry.anchor).toEqual([29.74833, 60.00639]);
  expect(p.entry.heading).toBe(0.78);
  expect(p.entry.datum).toBe('sea-level');
  expect(frame.mappedIdentity.featureIds).toEqual([]);
  expect(controls.length).toBeCloseTo(24395.3334, 3);
  expect(spec.sourceFacts.length).toBe(25400);
  expect(controls.crossings.map((q) => q.id)).toEqual([
    'B1',
    'B2',
    'S1',
    'B3',
    'S2',
    'B4',
    'B5',
    'B6',
  ]);
  expect(controls.crossings.reduce((sum, q) => sum + (q.bays ?? 0), 0)).toBe(64);
  expect(p.entry.groundCutout.outlines).toHaveLength(8);
  expect(p.entry.replaceFootprint).toBe(false);
  expect(p.entry.buildingCutout).toBeUndefined();
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: m,
      spec,
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
});

it('retains all 64 clear sluice openings, the open S-1 channel and S-2 bridge clearance in every GLB', async () => {
  const a = await read(installed + '/asset.json'),
    files = [
      ['source', source + '/models/source.glb'],
      ['runtime', installed + '/' + a.files.main],
      ...a.runtimeLods.levels.map((l) => [l.name, installed + '/' + l.file]),
    ];
  for (const [name, path] of files) {
    const ts = await triangles(path);
    const from = (s, d, y) => {
      const p = station(s);
      return [p.x + p.nx * d, y, p.z + p.nz * d];
    };
    const line = (s, y) => {
      const p = station(s);
      return nearest(ts, from(s, 90, y), [-p.nx, 0, -p.nz]);
    };
    for (const q of controls.crossings) {
      if (q.type === 'sluice') {
        const cell = (q.b - q.a) / q.bays;
        for (let i = 0; i < q.bays; i++) {
          expect(line(q.a + (i + 0.5) * cell, 1), name + ' ' + q.id + ' bay ' + i).toBe(Infinity);
          if (i) expect(line(q.a + i * cell, 1), name + ' ' + q.id + ' pier ' + i).toBeLessThan(80);
        }
      } else {
        expect(line(q.middle, 3), name + ' ' + q.id + ' open navigation').toBe(Infinity);
        const t = nearest(ts, from(q.middle, 5, 40), [0, -1, 0]);
        if (q.id === 'S1') expect(t, name + ' S1 remains free of any surface road').toBe(Infinity);
        else {
          expect(40 - t, name + ' S2 lift deck').toBeCloseTo(17.8, 2);
          if (name !== 'skyline') {
            const underside = nearest(ts, from(q.middle, 5, 3), [0, 1, 0]);
            expect(3 + underside, name + ' S2 navigation clearance').toBeCloseTo(16, 2);
          }
        }
      }
    }
    const kotlin = (controls.kotlin[0] + controls.kotlin[1]) / 2;
    expect(
      nearest(ts, from(kotlin, 0, 40), [0, -1, 0]),
      name + ' native Kotlin road and terrain remain',
    ).toBe(Infinity);
  }
}, 30000);

it('clips covered bridge segments while preserving tunnel and mainland routes', async () => {
  const { records } = await read(source + '/native-roads.json'),
    p = (await read(source + '/placement-report.json')).entry;
  const tile = createEmptyTerrainSemanticTile(),
    origin = [-15000, -15000],
    tileSize = 30000;
  const [lon, lat] = p.anchor;
  tile.transportation = records.map((q, i) => ({
    id: String(i),
    class: 'highway',
    subclass: 'motorway',
    bridge: q.bridge,
    tunnel: q.tunnel,
    lines: [
      q.line.map(([L, B]) => [
        (111319.490793 * Math.cos((lat * Math.PI) / 180) * (L - lon) - origin[0]) / tileSize,
        ((lat - B) * 111319.490793 - origin[1]) / tileSize,
      ]),
    ],
  }));
  const original = structuredClone(tile),
    out = withoutStructureRoads(
      tile,
      { origin, tileSize, heightfield: { sampleHeight: () => 0 } },
      [{ ...p, anchor: [0, 0] }],
      1,
      () => 0,
    );
  const byId = new Map(out.transportation.map((r) => [r.id, r]));
  const changed = tile.transportation.filter(
    (r) => JSON.stringify(r.lines) !== JSON.stringify(byId.get(r.id)?.lines),
  );
  expect(changed.length).toBeGreaterThanOrEqual(12);
  for (const r of changed) {
    expect(r.bridge && !r.tunnel).toBe(true);
    expect([6, 7, 15, 17, 20, 22, 24]).toContain(records[Number(r.id)].index);
  }
  for (const [i, r] of records.entries())
    if (r.tunnel || r.index === 10 || r.index === 26)
      expect(byId.get(String(i))).toEqual(original.transportation[i]);
  expect(tile).toEqual(original);
});

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
        'concrete_plain',
        'stone_basalt',
        'gravel',
        'metal_standing_seam',
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
