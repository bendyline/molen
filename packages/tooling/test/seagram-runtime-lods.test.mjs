import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/seagram_building');
const installed = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
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
it('preserves the detailed master and the signed Park Avenue frame independently of the rear bustle', async () => {
  const spec = await read(source + '/spec.json'),
    m = await read(source + '/map-frame.json');
  expect(hash(await readFile(source + '/models/source.glb'))).toBe(
    'sha256:708547d760a77815f7e2aa590550e632f6c64411f5f64eed88aedb66d361b819',
  );
  expect(spec.mesh.triangles).toBe(286644);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.sourceFacts.mainStructuralGrid).toEqual([5, 3]);
  expect(spec.sourceFacts.curtainWallModuleMeters).toBe(1.4097);
  expect(m.anchor).toEqual([-73.972183175, 40.75846045]);
  expect(m.heading).toBeCloseTo(-2.076276720887223, 12);
  expect(Math.sin(m.heading)).toBeLessThan(-0.8);
  expect(Math.cos(m.heading)).toBeLessThan(-0.4);
  expect(m.geometry.mainShaftRectangle).toHaveLength(4);
  expect(m.elements.map((e) => e.id).sort()).toEqual([145341258, 145341297, 289866849]);
});
it('retains the full-height rear bay, unequal lower wings, open colonnade and depressed reflecting pools in all tiers', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const level of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + level.file);
    expect(ts.flat().reduce((h, p) => Math.max(h, p[1]), 0)).toBeCloseTo(157, 3);
    for (const [x, z, y] of [
      [0, 0, 157],
      [0, -18, 157],
      [-20, -35, 20.1],
      [20, -35, 20.1],
      [0, -35, 39.6],
      [-25, 30, 1.43],
      [25, 30, 1.43],
      [0, 30, 1.8],
    ])
      expect(
        nearest(ts, [x, 200, z], [0, -1, 0]),
        level.name + ' roof/plaza ' + x + '/' + z,
      ).toBeCloseTo(200 - y, 3);
    expect(nearest(ts, [18, 5, 40], [0, 0, -1]), level.name + ' open column bay').toBeGreaterThan(
      60,
    );
    expect(nearest(ts, [18, 15, 40], [0, 0, -1]), level.name + ' enclosed office').toBeLessThan(27);
    expect(nearest(ts, [2.5, 5, 40], [0, 0, -1]), level.name + ' recessed lobby').toBeCloseTo(
      40 - ((3 * 8.4582 + 0.9144) / 2 - 2.8),
      3,
    );
  }
}, 60000);
it('rebuilds exact four-draw tiers within browser budgets with shared graphs and separate GPU streams', async () => {
  const result = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    original = await read(installed + '/asset.json');
  expect(result.levels[0].bytes + result.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = result.levels.find((l) => l.name === name),
      b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(hash(b)).toBe(original.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBe(4);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
    expect(
      g.materials
        .filter((m) => m.extras?.molenSurface)
        .map((m) => m.extras.molenSurface.ref)
        .sort(),
    ).toEqual([
      'matgraph:molen.worldgen.material.metal_bronze_cast',
      'matgraph:molen.worldgen.material.stone_granite',
    ]);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
