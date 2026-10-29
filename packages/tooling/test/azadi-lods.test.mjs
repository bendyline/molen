import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  azadiCloseup,
  azadiDistrict,
  azadiSkyline,
  azadiStreet,
} from '../../../content/worldgen/source/places/tn/tnk/azadi_tower/models/azadi-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { nextHeritageTowers } from '../../worldgen/scripts/next-heritage-tower-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

function geometry(build) {
  const b = new MeshBufferBuilder();
  build(b);
  const mesh = b.finalize(),
    ps = Array.from(
      { length: mesh.vertexCount },
      (_, i) => new Vector3(...mesh.positions.slice(i * 3, i * 3 + 3)),
    );
  return {
    mesh,
    hit(origin, direction) {
      const ray = new Ray(new Vector3(...origin), new Vector3(...direction)),
        point = new Vector3();
      let nearest = Infinity;
      for (let i = 0; i < mesh.indices.length; i += 3)
        if (
          ray.intersectTriangle(
            ps[mesh.indices[i]],
            ps[mesh.indices[i + 1]],
            ps[mesh.indices[i + 2]],
            true,
            point,
          )
        )
          nearest = Math.min(nearest, point.distanceTo(ray.origin));
      return nearest;
    },
  };
}
it('preserves both open arch axes, four feet and sampled master surfaces at every level', () => {
  const detailed = geometry(nextHeritageTowers.find((x) => x.id === 'azadi_tower').build);
  const probes = [
    [
      [0, 70, 0],
      [0, -1, 0],
    ],
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((z) => [
        [x * 26, 15, z * 14],
        [0, -1, 0],
      ]),
    ),
    ...[3, 8, 15, 24, 31].map((y) => [
      [70, y, 8],
      [-1, 0, 0],
    ]),
  ];
  const targets = probes.map(([o, d]) => detailed.hit(o, d));
  for (const [build, cap, allowance] of [
    [azadiSkyline, 1000, 0.8],
    [azadiDistrict, 4000, 0.4],
    [azadiStreet, 16000, 0.18],
    [azadiCloseup, 64000, 0.08],
  ]) {
    const g = geometry(build);
    expect(g.mesh.triangleCount).toBeLessThanOrEqual(cap);
    expect(g.hit([0, 20, 60], [0, 0, -1])).toBe(Infinity);
    expect(g.hit([60, 10, 0], [-1, 0, 0])).toBe(Infinity);
    for (let i = 0; i < probes.length; i++) {
      const h = g.hit(...probes[i]);
      if (Number.isFinite(targets[i])) expect(Math.abs(h - targets[i])).toBeLessThan(allowance);
      else expect(h).toBe(Infinity);
    }
    expect(70 - g.hit([0, 70, 0], [0, -1, 0])).toBeCloseTo(44.52, 4);
  }
}, 60000);

it('reconstructs four budgeted files while preserving the complete detailed source and runtime master', async () => {
  const source = resolve(
    '../../content/worldgen/source/places/tn/tnk/azadi_tower/models/source.glb',
  );
  expect(
    'sha256:' +
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
  ).toBe('sha256:8d501e27bd67ca394ebf46c8e06a5c6cb8a4bcfe1fddf2bc031122d3d8936f2f');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/tn/tnk/azadi_tower/asset.json'),
    ),
    before = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  const asset = JSON.parse(await readFile(path));
  // Keep binary preservation checks bounded in memory for multi-megabyte masters.
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(digest(master));
  expect(asset.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const level of asset.runtimeLods.levels) {
    const b = await readFile(resolve(path, '..', level.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(level.drawCalls).toBeLessThanOrEqual(3);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 60000);
