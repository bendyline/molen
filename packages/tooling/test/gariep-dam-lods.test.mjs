import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';

import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { controls } from '../../../content/worldgen/source/places/kd/kdd/gariep_dam/models/dam-model.mjs';
import { createEmptyTerrainSemanticTile } from '../../terrain/dist/kernel.mjs';
import { hashBytes, modelInputHash } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/kd/kdd/gariep_dam'),
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

it('pins the exact signed barrier plan and single standard terrain datum', async () => {
  const manifest = await read(source + '/source.json'),
    asset = await read(installed + '/asset.json'),
    spec = await read(source + '/spec.json'),
    p = await read(source + '/placement-report.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(asset.sourceHash);
  expect(hashBytes(await readFile(installed + '/' + asset.files.main))).toBe(asset.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, asset.id));
  expect(frame.mappedIdentity.featureIds).toEqual(['way/174344884']);
  expect(p.entry.heading).toBe(-1.242090458781);
  expect(p.entry.anchor).toEqual([25.505942247, -30.624113651]);
  expect(spec.sourceFacts.terrainDatum).toBeCloseTo(1260.965851, 5);
  expect(spec.sourceFacts.retainedHeight).toBe(88);
  expect(spec.sourceFacts.retainedLength).toBe(914);
  expect(spec.sourceFacts.selectedCrestLength).toBeCloseTo(851.685, 3);
  expect(p.entry.groundCutout.outlines[0]).toEqual(frame.geometry.outline);
  expect(p.entry.groundCutout.outlines).toHaveLength(6);
  expect(p.entry.groundCutout.outlines[5]).toEqual(frame.geometry.nearTailwater.outline);
  expect(Math.max(...p.entry.groundCutout.outlines[5].map((point) => point[1]))).toBe(235);
  expect(p.entry.replaceFootprint).toBe(false);
  expect(p.entry.buildingCutout).toBeUndefined();
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: manifest,
      spec,
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
});

it('preserves fifteen through-bays, the complete crest deck and paired outlet openings in all six GLBs', async () => {
  const a = await read(installed + '/asset.json'),
    files = [
      ['source', source + '/models/source.glb'],
      ['runtime', installed + '/' + a.files.main],
      ...a.runtimeLods.levels.map((l) => [l.name, installed + '/' + l.file]),
    ];
  for (const [name, path] of files) {
    const ts = await triangles(path);
    const [a, b] = controls.archSpan,
      step = (b - a) / controls.bays;
    for (let i = 0; i < controls.bays; i++) {
      const x = a + (i + 0.5) * step;
      expect(nearest(ts, [x, 2, 120], [0, 0, -1]), name + ' open bay ' + i).toBe(Infinity);
      expect(
        nearest(ts, [a + i * step, 2, 120], [0, 0, -1]),
        name + ' structural pier ' + i,
      ).toBeLessThan(300);
    }
    for (let i = 1; i < controls.crest.length; i++) {
      const p = controls.crest[i - 1],
        q = controls.crest[i],
        x = (p[0] + q[0]) / 2,
        z = (p[1] + q[1]) / 2;
      const top = 25 - nearest(ts, [x, 25, z], [0, -1, 0]);
      const y = i === 1 ? (controls.deck + controls.westTieHeight) / 2 : controls.deck;
      expect(Math.abs(top - y), name + ' crest segment ' + i).toBeLessThan(0.15);
    }
    for (const x of [92.5, 102.5])
      expect(nearest(ts, [x, -50, 55], [0, 0, -1]), name + ' circular mouth ' + x).toBeGreaterThan(
        28,
      );
  }
}, 30000);

it('replaces only the modeled crest bridge and leaves the downstream bridge and every other native road', async () => {
  const { records } = await read(source + '/native-roads.json'),
    placed = (await read(source + '/placement-report.json')).entry;
  const tile = createEmptyTerrainSemanticTile(),
    context = { origin: [-1500, -1500], tileSize: 3000, heightfield: { sampleHeight: () => 1261 } };
  const c = Math.cos(placed.heading),
    s = Math.sin(placed.heading);
  tile.transportation = records.map((r) => ({
    id: String(r.index),
    class: r.properties.kind,
    subclass: r.properties.kind_detail,
    bridge: r.properties.is_bridge === true,
    tunnel: r.properties.is_tunnel === true,
    lines: [
      r.points.map(([x, z]) => [(x * c + z * s + 1500) / 3000, (-x * s + z * c + 1500) / 3000]),
    ],
  }));
  const original = structuredClone(tile);
  const result = withoutStructureRoads(
    tile,
    context,
    [{ ...placed, anchor: [0, 0] }],
    1,
    () => 1260.965851,
  );
  expect(result.transportation.map((r) => r.id)).not.toContain('21');
  expect(result.transportation.map((r) => r.id)).toContain('31');
  expect(result.transportation).toEqual(original.transportation.filter((r) => r.id !== '21'));
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
      for (const graph of ['concrete_plain', 'metal_standing_seam', 'metal_painted', 'window_grid'])
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
