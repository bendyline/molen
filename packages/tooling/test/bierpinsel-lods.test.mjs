import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u33/bierpinsel'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u3/u33/bierpinsel/asset.json'),
  );
async function geometry(file) {
  const b = await readFile(file),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  g.scene.updateMatrixWorld(true);
  const hit = (origin, direction) =>
    new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
      g.scene,
      true,
    )[0];
  return {
    bounds: new Box3().setFromObject(g.scene),
    hit: (origin, direction) => hit(origin, direction)?.distance ?? Infinity,
    green(origin, direction) {
      const h = hit(origin, direction);
      return h?.object.geometry.attributes.color.getY(h.face.a);
    },
  };
}

it('retains nine three-tier capsule windows, twelve branching supports, six stair flights, street access and both roof enclosures', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(42.514, 3);
    for (let i = 0; i < 9; i++)
      for (const [y, r] of [
        [22.8, 10.169565217391304],
        [28.5, 11.77],
        [33.6, 10.72],
      ]) {
        const a = ((i - 4) * Math.PI) / 6,
          origin = [20 * Math.cos(a), y, 20 * Math.sin(a)],
          direction = [-Math.cos(a), 0, -Math.sin(a)];
        expect(g.green(origin, direction), `${name} capsule glass ${i}/${y}`).toBeCloseTo(0.18, 3);
        expect(g.hit(origin, direction), `${name} recessed glazing ${i}/${y}`).toBeCloseTo(
          20 - r + 0.13,
          2,
        );
      }
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) * Math.PI) / 6,
        bend = [0.25 + 2.25 * Math.cos(a), 17.15, 1.1 + 2.25 * Math.sin(a)],
        tip = [8.7 * Math.cos(a), 23, 8.7 * Math.sin(a)],
        p = bend.map((v, j) => v + (tip[j] - v) * 0.23),
        t = [-Math.sin(a), 0, Math.cos(a)];
      expect(
        g.hit(
          p.map((v, j) => v + 2 * t[j]),
          t.map((v) => -v),
        ),
        `${name} cantilever ${i}`,
      ).toBeLessThan(2.1);
    }
    expect(10 - g.hit([0, 10, 5.5], [0, -1, 0]), `${name} attached road-level landing`).toBeCloseTo(
      6.3,
      3,
    );
    for (let i = 0; i < 6; i++) {
      const y = 6.2 + ((i + 1) * 14.2) / 6,
        x = i % 2 === 0 ? -3.85 : -9.05;
      expect(
        y + 0.1 - g.hit([x, y + 0.1, 3.9], [0, -1, 0]),
        `${name} stair landing ${i}`,
      ).toBeCloseTo(y, 3);
    }
    const heights = [-14.5, -12.5, -10.5].map((x) => 4.5 - g.hit([x, 4.5, 4.375], [0, -1, 0]));
    expect(heights[0], `${name} supported low public stair`).toBeGreaterThan(0.4);
    expect(heights[1]).toBeGreaterThan(heights[0] + 1);
    expect(heights[2]).toBeGreaterThan(heights[1] + 1);
    expect(45 - g.hit([-8.5, 45, 0], [0, -1, 0]), `${name} rear roof machine`).toBeCloseTo(
      42.51,
      2,
    );
    expect(45 - g.hit([0, 45, 0], [0, -1, 0]), `${name} D-shaped lift roof`).toBeCloseTo(42.514, 3);
    expect(g.hit([-20, 25.5, 0], [1, 0, 0]), `${name} full rear service wing`).toBeGreaterThan(4.3);
    expect(g.hit([-20, 25.5, 0], [1, 0, 0]), `${name} full rear service wing`).toBeLessThan(4.7);
  }
}, 120000);

it('rebuilds complete budgeted variants while preserving detailed masters, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '71dfb6202da0720eebe2dc54a3e1ed75ee4156c5b1eba12c9cf2f85e814f264d',
  );
  expect(master).toBe('71158897b2866bd7407af824da0f8f1e27f8a6d3b918219ed97fd662a1830b74');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 3, 3, 3][i]);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
