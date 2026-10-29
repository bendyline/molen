import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  laboeCloseup,
  laboeDistrict,
  laboeSkyline,
  laboeStreet,
} from '../../../content/worldgen/source/places/u1/u1x/laboe_naval_memorial/models/laboe-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

function geometry(build) {
  const b = new MeshBufferBuilder();
  build(b);
  const mesh = b.finalize(),
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

it('preserves the curved inland body, pointed seaward spine, two terraces and distinct entrance doors at every distance', () => {
  const master = geometry(laboeCloseup);
  for (const [build, cap, error] of [
    [laboeSkyline, 1000, 0.5],
    [laboeDistrict, 4000, 0.25],
    [laboeStreet, 16000, 0.08],
    [laboeCloseup, 64000, 0.00001],
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
    expect(max).toBeCloseTo(72, 4);
    for (const y of [7, 9, 12, 17, 24, 35, 52])
      expect(
        Math.abs(g.hit([40, y, 0], [-1, 0, 0]) - master.hit([40, y, 0], [-1, 0, 0])),
      ).toBeLessThan(error);
    expect(g.hit([-2, 100, 0], [0, -1, 0])).toBeCloseTo(100 - 62.4, 3);
    expect(g.hit([-13, 100, 0], [0, -1, 0])).toBeCloseTo(100 - 70.85, 3);
    for (const z of [-4.1, 4.1])
      expect(g.hit([40, 1.5, z], [-1, 0, 0])).toBeCloseTo(master.hit([40, 1.5, z], [-1, 0, 0]), 4);
    // There are two narrow door recesses, with solid wall between them.
    expect(g.hit([40, 1.5, 0], [-1, 0, 0])).toBeLessThan(g.hit([40, 1.5, 4.1], [-1, 0, 0]));
    for (const z of [-9.1, 9.1]) expect(g.hit([17.4, 8, z], [0, -1, 0])).toBeCloseTo(8 - 2.94, 4);
    for (const [x, y] of [
      [-8.25, 11.75],
      [-6.87, 21.41],
      [-5.49, 55.22],
    ])
      for (const sign of [-1, 1]) {
        const o = [x, y, sign * 30],
          d = [0, 0, -sign];
        expect(Math.abs(g.hit(o, d) - master.hit(o, d))).toBeLessThan(
          build === laboeSkyline ? 0.4 : 0.0001,
        );
      }
    expect(
      Math.abs(g.hit([-30, 35, 0], [1, 0, 0]) - master.hit([-30, 35, 0], [1, 0, 0])),
    ).toBeLessThan(0.05);
  }
});

it('rebuilds four registered browser files within budgets while preserving exact source/runtime master digests and separate GPU streams', async () => {
  const dir = resolve('../../content/worldgen/source/places/u1/u1x/laboe_naval_memorial'),
    digest = (b) => createHash('sha256').update(b).digest('hex');
  expect(digest(await readFile(`${dir}/models/source.glb`))).toBe(
    '0c4c7dbf292dc6727cd83a0c10a27bc90223d80b5b5c36f750e4dc59511559ac',
  );
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/u1/u1x/laboe_naval_memorial/asset.json'),
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
  for (const l of asset.runtimeLods.levels) {
    expect(asset.files.variants[l.name]).toBe(l.file);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 30000);
