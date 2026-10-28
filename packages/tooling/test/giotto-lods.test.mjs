import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  giottoCloseup,
  giottoDistrict,
  giottoSkyline,
  giottoStreet,
} from '../../../content/worldgen/source/places/sr/srb/giottos_campanile/models/giotto-lods.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { nextHeritageTowers } from '../../worldgen/scripts/next-heritage-tower-models.mjs';
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

it('preserves the full campanile, cathedral-facing entrance, recessed loggias and open roof terrace', () => {
  const master = geometry(
    nextHeritageTowers.find((model) => model.id === 'giottos_campanile').build,
  );
  for (const [build, cap] of [
    [giottoSkyline, 1000],
    [giottoDistrict, 4000],
    [giottoStreet, 16000],
    [giottoCloseup, 64000],
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
    expect(max).toBeCloseTo(84.7, 4);
    // A roof ray reaches the terrace floor, not a solid cap at parapet height.
    expect(g.hit([0, 100, 0], [0, -1, 0])).toBeCloseTo(100 - 83.25, 4);
    expect(g.hit([0, 2, -30], [0, 0, 1])).toBeCloseTo(30 - 6.18, 4);
    for (const [origin, direction] of [
      [
        [0, 2, 30],
        [0, 0, -1],
      ],
      [
        [30, 2, 0],
        [-1, 0, 0],
      ],
      [
        [-30, 2, 0],
        [1, 0, 0],
      ],
    ])
      expect(g.hit(origin, direction)).toBeCloseTo(30 - 6.48, 4);
    // Both lights in every bifora and all three upper lights must stay recessed.
    // Compare to the detailed master rather than deriving expected depths from the LOD recipe.
    for (const [y, xs] of [
      [43, [-3.69, -1.81, 1.81, 3.69]],
      [59, [-3.69, -1.81, 1.81, 3.69]],
      [72, [-2.43, 0, 2.43]],
    ])
      for (const x of xs)
        for (const [origin, direction] of [
          [
            [x, y, 30],
            [0, 0, -1],
          ],
          [
            [-x, y, -30],
            [0, 0, 1],
          ],
          [
            [30, y, -x],
            [-1, 0, 0],
          ],
          [
            [-30, y, x],
            [1, 0, 0],
          ],
        ]) {
          expect(g.hit(origin, direction)).toBeCloseTo(master.hit(origin, direction), 4);
          expect(g.hit(origin, direction)).toBeGreaterThan(25);
        }
    // Mullions remain in front of the interior, rather than disappearing with the glazing.
    for (const [x, y] of [
      [2.75, 43],
      [-2.75, 59],
      [1.22, 72],
    ])
      expect(g.hit([x, y, 30], [0, 0, -1])).toBeLessThan(24);
  }
}, 120000);

it('rebuilds four budgeted shared-material browser files without changing the detailed masters', async () => {
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  expect(
    digest(
      await readFile(
        resolve('../../content/worldgen/source/places/sr/srb/giottos_campanile/models/source.glb'),
      ),
    ),
  ).toBe('f935db50e9d925e2f150160a4fa19165d8c74262d195b382202120ad8b1a9cae');
  const path = await runtimeLodFixture(
      resolve('../../content/worldgen/assets/places/sr/srb/giottos_campanile/asset.json'),
    ),
    before = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  const asset = JSON.parse(await readFile(path));
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(digest(master));
  expect(asset.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const level of asset.runtimeLods.levels) {
    expect(asset.files.variants[level.name]).toBe(level.file);
    expect(level.drawCalls).toBeLessThanOrEqual(3);
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
