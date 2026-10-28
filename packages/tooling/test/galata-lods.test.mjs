import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  galataCloseup,
  galataDistrict,
  galataSkyline,
  galataStreet,
} from '../../../content/worldgen/source/places/sx/sxk/galata_tower/models/galata-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

function geometry(build) {
  const out = new MeshBufferBuilder();
  build(out);
  const mesh = out.finalize(),
    positions = Array.from(
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
            positions[mesh.indices[i]],
            positions[mesh.indices[i + 1]],
            positions[mesh.indices[i + 2]],
            true,
            point,
          )
        )
          nearest = Math.min(nearest, point.distanceTo(ray.origin));
      return nearest;
    },
  };
}

it('keeps the full silhouette, south stair, recessed shaft windows and all fourteen arcade bays', () => {
  for (const [build, cap] of [
    [galataSkyline, 1000],
    [galataDistrict, 4000],
    [galataStreet, 16000],
    [galataCloseup, 64000],
  ]) {
    const g = geometry(build);
    expect(g.mesh.triangleCount).toBeLessThanOrEqual(cap);
    const ys = Array.from(g.mesh.positions).filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(66.9, 4);
    // The signed south stair must project beyond the round body's 8.225m radius.
    expect(30 - g.hit([0, 2.4, 30], [0, 0, -1])).toBeGreaterThan(10);
    if (build === galataSkyline) continue;
    expect(g.hit([0, 35.5, 30], [0, 0, -1])).toBeGreaterThan(22.2);
    for (let i = 0; i < 14; i++) {
      const a = (i * 2 * Math.PI) / 14,
        s = Math.sin(a),
        c = Math.cos(a);
      // An arcade center sees a recessed window, not the outer 8.3m wall.
      expect(g.hit([30 * s, 46.7, 30 * c], [-s, 0, -c])).toBeGreaterThan(22);
      expect(g.hit([30 * s, 46.7, 30 * c], [-s, 0, -c])).toBeLessThan(22.4);
    }
  }
}, 60000);

it('rebuilds the four budgeted derivatives and preserves exact detailed masters and separate GPU streams', async () => {
  const source = resolve(
    '../../content/worldgen/source/places/sx/sxk/galata_tower/models/source.glb',
  );
  expect(
    'sha256:' +
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
  ).toBe('sha256:7a506d2e3030de406497406511c51ce742a0166c514e16da348401e63b689801');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/sx/sxk/galata_tower/asset.json'),
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
    expect(level.drawCalls).toBeLessThanOrEqual(6);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 60000);
