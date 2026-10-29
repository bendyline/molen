import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  wiesghaCloseup,
  wiesghaDistrict,
  wiesghaSkyline,
  wiesghaStreet,
} from '../../../content/worldgen/source/places/sq/sq6/triq_il_wiesg_a_tower/models/wiesgha-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

function geometry(build) {
  const out = new MeshBufferBuilder();
  build(out);
  const mesh = out.finalize(),
    vertices = Array.from(
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
            vertices[mesh.indices[i]],
            vertices[mesh.indices[i + 1]],
            vertices[mesh.indices[i + 2]],
            true,
            point,
          )
        )
          nearest = Math.min(nearest, point.distanceTo(ray.origin));
      return nearest;
    },
  };
}

it('retains the battered masonry, directed recessed openings, open terrace and corner shelter at every distance', () => {
  const master = geometry(wiesghaCloseup);
  for (const [build, cap] of [
    [wiesghaSkyline, 1000],
    [wiesghaDistrict, 4000],
    [wiesghaStreet, 16000],
    [wiesghaCloseup, 64000],
  ]) {
    const g = geometry(build);
    expect(g.mesh.triangleCount).toBeLessThanOrEqual(cap);
    let min = Infinity,
      max = -Infinity;
    for (let i = 1; i < g.mesh.positions.length; i += 3) {
      min = Math.min(min, g.mesh.positions[i]);
      max = Math.max(max, g.mesh.positions[i]);
    }
    expect(min).toBe(0);
    expect(max).toBeCloseTo(13.8, 4);
    // The detailed source's upper stringcourse cap forms the terrace surface at8.85m.
    expect(g.hit([0, 20, 0], [0, -1, 0])).toBeCloseTo(master.hit([0, 20, 0], [0, -1, 0]), 4);
    expect(g.hit([0, 20, 0], [0, -1, 0])).toBeGreaterThan(10.5);
    expect(g.hit([-2.69, 20, 2.69], [0, -1, 0])).toBeCloseTo(20 - 11.4, 4);
    expect(g.hit([0, 9.68, 20], [0, 0, -1])).toBeGreaterThan(20);
    expect(g.hit([1, 9.68, 20], [0, 0, -1])).toBeLessThan(17);
    for (const [o, d] of [
      [
        [0, 5.5, 20],
        [0, 0, -1],
      ],
      [
        [0, 6, -20],
        [0, 0, 1],
      ],
      [
        [-20, 6, -0.95],
        [1, 0, 0],
      ],
    ])
      expect(g.hit(o, d)).toBeCloseTo(master.hit(o, d), 4);
    // Stone courses can flatten, but the real batter cannot become a vertical box.
    for (const y of [0.9, 2.8])
      expect(
        Math.abs(g.hit([0, y, -20], [0, 0, 1]) - master.hit([0, y, -20], [0, 0, 1])),
      ).toBeLessThan(0.05);
  }
});

it('rebuilds four registered shared-material levels within budgets while preserving current detailed master bytes', async () => {
  const dir = resolve('../../content/worldgen/source/places/sq/sq6/triq_il_wiesg_a_tower'),
    digest = (b) => createHash('sha256').update(b).digest('hex');
  expect(digest(await readFile(`${dir}/models/source.glb`))).toBe(
    '0f22e10df3adf8c8009dd0bddc26dbfd0acf95fc345c8141a686f9527b7efa2d',
  );
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/sq/sq6/triq_il_wiesg_a_tower/asset.json'),
    ),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  await buildModelLandmarkLods(path, { force: true });
  const asset = JSON.parse(await readFile(path));
  expect(asset.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const level of asset.runtimeLods.levels) {
    expect(asset.files.variants[level.name]).toBe(level.file);
    expect(level.drawCalls).toBeLessThanOrEqual(4);
    const b = await readFile(resolve(path, '..', level.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 30000);
