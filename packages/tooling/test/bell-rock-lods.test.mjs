import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  bellRockCloseup,
  bellRockDistrict,
  bellRockSkyline,
  bellRockStreet,
} from '../../../content/worldgen/source/places/gf/gfn/bell_rock_lighthouse/models/bell-rock-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('retains the full tower, attached landing and SSE solar bay at every level', () => {
  for (const [build, cap] of [
    [bellRockSkyline, 1000],
    [bellRockDistrict, 4000],
    [bellRockStreet, 16000],
    [bellRockCloseup, 64000],
  ]) {
    const builder = new MeshBufferBuilder();
    build(builder);
    const mesh = builder.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(cap);
    const ps = Array.from(
      { length: mesh.positions.length / 3 },
      (_, i) => new Vector3(...mesh.positions.slice(i * 3, i * 3 + 3)),
    );
    expect(Math.min(...ps.map((p) => p.y))).toBe(0);
    expect(Math.max(...ps.map((p) => p.y))).toBe(36);
    expect(Math.max(...ps.map((p) => Math.abs(p.x)))).toBeCloseTo(6.4008, 4);
    function distance(origin, direction) {
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
    }
    expect(20 - distance([0, 20, 5.2], [0, -1, 0])).toBeCloseTo(9.16, 2);
    expect(distance([0, 5, 10], [0, 0, -1])).toBeLessThan(5.3);
    const a = Math.PI / 8,
      s = Math.sin(a),
      c = Math.cos(a);
    expect(distance([10 * s, 32.2, 10 * c], [-s, 0, -c])).toBeLessThan(6);
    expect(distance([-10 * s, 32.2, -10 * c], [s, 0, c])).toBeGreaterThan(6.5);
  }
});

it('reconstructs four budgeted derivatives while preserving the detailed master bytes', async () => {
  const source = resolve(
    '../../content/worldgen/source/places/gf/gfn/bell_rock_lighthouse/models/source.glb',
  );
  expect(
    'sha256:' +
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
  ).toBe('sha256:3e1b1a80e38729b081093e6ec442064546d7b152805ac31e6df4c30e7de2197d');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/gf/gfn/bell_rock_lighthouse/asset.json'),
    ),
    before = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  const asset = JSON.parse(await readFile(path));
  expect(await readFile(resolve(path, '../model.glb'))).toEqual(master);
  expect(asset.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const level of asset.runtimeLods.levels) {
    const b = await readFile(resolve(path, '..', level.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(level.drawCalls).toBeLessThanOrEqual(8);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives)
        expect(g.bufferViews[g.accessors[p.attributes.POSITION].bufferView].byteStride ?? 12).toBe(
          12,
        );
  }
}, 20000);
