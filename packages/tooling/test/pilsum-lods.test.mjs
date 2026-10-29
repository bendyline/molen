import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  pilsumCloseup,
  pilsumDistrict,
  pilsumSkyline,
  pilsumStreet,
} from '../../../content/worldgen/source/places/u1/u1t/pilsum_lighthouse/models/pilsum-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('keeps all seven daymark bands visible, both sector windows recessed and the full rod height', () => {
  for (const [build, cap] of [
    [pilsumSkyline, 1000],
    [pilsumDistrict, 4000],
    [pilsumStreet, 16000],
    [pilsumCloseup, 64000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const m = b.finalize();
    expect(m.triangleCount).toBeLessThanOrEqual(cap);
    const points = Array.from(
      { length: m.vertexCount },
      (_, i) => new Vector3(...m.positions.slice(i * 3, i * 3 + 3)),
    );
    expect(Math.min(...points.map((p) => p.y))).toBe(0);
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(12.45, 5);
    function hit(angle, y) {
      const ray = new Ray(
          new Vector3(3.2 * Math.sin(angle), y, 3.2 * Math.cos(angle)),
          new Vector3(-Math.sin(angle), 0, -Math.cos(angle)),
        ),
        p = new Vector3();
      let distance = Infinity,
        vertex;
      for (let i = 0; i < m.indices.length; i += 3)
        if (
          ray.intersectTriangle(
            points[m.indices[i]],
            points[m.indices[i + 1]],
            points[m.indices[i + 2]],
            true,
            p,
          ) &&
          p.distanceTo(ray.origin) < distance
        ) {
          distance = p.distanceTo(ray.origin);
          vertex = m.indices[i];
        }
      return { distance, color: Array.from(m.colors.slice(vertex * 3, vertex * 3 + 3)) };
    }
    for (let i = 0; i < 7; i++) {
      const h = hit(0.35, 0.3 + ((i + 0.5) * (10.15 - 0.3)) / 7),
        expected = i % 2 ? [0.97, 0.67, 0.012] : [0.76, 0.038, 0.022];
      expect(h.distance).toBeGreaterThan(0.9);
      expect(h.distance).toBeLessThan(1.15);
      for (let c = 0; c < 3; c++)
        expect(Math.abs(h.color[c] - Math.round(expected[c] * 255))).toBeLessThanOrEqual(1);
    }
    for (const angle of [2.1, 3.56]) {
      const d = hit(angle, 8.7).distance;
      expect(d).toBeGreaterThan(1.1);
      expect(d).toBeLessThan(1.6);
    }
  }
});

it('rebuilds all levels deterministically without altering the detailed source or runtime master', async () => {
  const source = resolve(
    '../../content/worldgen/source/places/u1/u1t/pilsum_lighthouse/models/source.glb',
  );
  expect(
    'sha256:' +
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
  ).toBe('sha256:bf019c4ec154dbe528cf0b4eacbc6639f4bd72deaa93bc93a3756bf1f5c3993a');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/u1/u1t/pilsum_lighthouse/asset.json'),
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
    expect(level.drawCalls).toBeLessThanOrEqual(4);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const pa = g.accessors[p.attributes.POSITION],
          na = g.accessors[p.attributes.NORMAL];
        expect(pa.bufferView).not.toBe(na.bufferView);
        expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 20000);
