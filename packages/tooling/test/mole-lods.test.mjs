import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  moleCloseup,
  moleDistrict,
  moleRadiusAt,
  moleSkyline,
  moleStreet,
} from '../../../content/worldgen/source/places/u0/u0j/mole_antonelliana/models/mole-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { nextHeritageTowers } from '../../worldgen/scripts/next-heritage-tower-models.mjs';
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

it('retains the complete height, directed portico/rear-wing plan and curved cupola at every level', () => {
  const master = geometry(
    nextHeritageTowers.find((model) => model.id === 'mole_antonelliana').build,
  );
  for (const [build, cap] of [
    [moleSkyline, 1000],
    [moleDistrict, 4000],
    [moleStreet, 16000],
    [moleCloseup, 64000],
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
    expect(max).toBeCloseTo(167.5, 4);
    expect(g.hit([0, 20.5, -60], [0, 0, 1])).toBeCloseTo(38.7, 3);
    for (const x of [-23, 23]) expect(g.hit([x, 8, 60], [0, 0, -1])).toBeCloseTo(38.5, 3);
    for (const y of [52, 58, 64, 70, 79])
      expect(
        Math.abs(g.hit([0, y, 60], [0, 0, -1]) - master.hit([0, y, 60], [0, 0, -1])),
      ).toBeLessThan(0.12);
    for (const y of [87, 90.5, 95.5]) expect(g.hit([4.5, y, 30], [0, 0, -1])).toBeLessThan(26);
    // Columns connect to their supporting decks instead of hovering above them.
    for (const [x, y] of [
      [2.93, 107.5],
      [2.1, 114.6],
      [0.94, 147.6],
    ])
      expect(Number.isFinite(g.hit([x, y, 30], [0, 0, -1]))).toBe(true);
    if (build !== moleSkyline) expect(g.hit([18.4, 24.8, 30], [0, 0, -1])).toBeLessThan(11);
    expect(g.hit([0, 114.3, 30], [0, 0, -1])).toBeLessThan(27.2);
  }
  const near = geometry(moleCloseup),
    z = moleRadiusAt(60) + 0.055;
  // Both exposed rib sides must face outwards, not disappear through backface culling.
  expect(near.hit([2, 60, z], [-1, 0, 0])).toBeCloseTo(0.905, 2);
  expect(near.hit([0, 60, z], [1, 0, 0])).toBeCloseTo(0.705, 2);
}, 120000);

it('rebuilds four budgeted browser files while preserving exact detailed masters and separate GPU streams', async () => {
  const source = resolve(
    '../../content/worldgen/source/places/u0/u0j/mole_antonelliana/models/source.glb',
  );
  expect(
    'sha256:' +
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
  ).toBe('sha256:32e2a3603be13a04c8daa5e8e9bfaca22e2076db68475412a020276a2cb75434');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/u0/u0j/mole_antonelliana/asset.json'),
    ),
    before = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  const asset = JSON.parse(await readFile(path));
  // Hash large binaries instead of expanding millions of bytes in a deep-equality matcher.
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(digest(master));
  expect(asset.runtimeLods.levels).toEqual(before.runtimeLods.levels);
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
}, 120000);
