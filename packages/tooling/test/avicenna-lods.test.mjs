import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/tn/tn4/avicenna_mausoleum');
const path = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/tn/tn4/avicenna_mausoleum/asset.json'),
);
async function geometry(file) {
  const b = await readFile(file),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  g.scene.updateMatrixWorld(true);
  return {
    bounds: new Box3().setFromObject(g.scene),
    hit(origin, direction) {
      return (
        new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
          g.scene,
          true,
        )[0]?.distance ?? Infinity
      );
    },
  };
}

it('preserves twelve open ribs, ten independent entrance columns, both roof wings, ramps and open stair passage at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(28.5, 3);
    expect(g.bounds.min.x).toBeLessThan(-26.6);
    expect(g.bounds.max.x).toBeGreaterThan(39.9);
    expect(g.bounds.max.z).toBeGreaterThan(27.1);
    for (const y of [12, 21])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6 + Math.PI / 12,
          c = Math.cos(a),
          s = Math.sin(a),
          rib = g.hit([0.44 + 6 * c, y, -0.04 - 6 * s], [-c, 0, s]),
          gapAngle = a + Math.PI / 12,
          gc = Math.cos(gapAngle),
          gs = Math.sin(gapAngle),
          gap = g.hit([0.44 + 6 * gc, y, -0.04 - 6 * gs], [-gc, 0, gs]);
        expect(rib, `${name} rib${i} at${y}`).toBeGreaterThan(2.3);
        expect(rib).toBeLessThan(3.9);
        expect(gap, `${name} open gap${i} at${y}`).toBeGreaterThan(6);
      }
    for (let i = 0; i < 10; i++) {
      const x = -11.3 + (25.45 * i) / 9;
      expect(g.hit([x, 3, 23], [0, 0, -1]), `${name} column${i}`).toBeLessThan(3.1);
      if (i !== 9)
        expect(
          g.hit([x + 25.45 / 18, 3, 23], [0, 0, -1]),
          `${name} portico gap${i}`,
        ).toBeGreaterThan(5.5);
    }
    for (const x of [-12.6, 12.6]) {
      const rampY = 10 - g.hit([x, 10, -12.15], [0, -1, 0]);
      expect(rampY, `${name} rear ramp${x}`).toBeGreaterThan(2.3);
      expect(rampY).toBeLessThan(3.4);
    }
    for (const [x, z] of [
      [32, 0],
      [-24.5, 15],
    ])
      expect(10 - g.hit([x, 10, z], [0, -1, 0]), `${name} complete museum wing`).toBeCloseTo(
        5.5,
        0,
      );
    const stairY = 10 - g.hit([-20, 10, 0.25], [0, -1, 0]);
    expect(stairY, `${name} open roof stair`).toBeGreaterThan(1.6);
    expect(stairY).toBeLessThan(3.2);
  }
}, 120000);

it('reconstructs registered budgeted variants with exact detailed masters and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'bcebdae63418b9f4496ccdf7f3db2572029acb83795a5b493a5205dd73b0d37d',
  );
  expect(master).toBe('1a4392767dbcc3051a4531f1982c7e2dddf1e2de92337e9afae03fc7ab5c928b');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          norm = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(norm.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
