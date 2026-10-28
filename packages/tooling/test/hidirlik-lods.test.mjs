import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sw/swt/hidirlik_tower'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/sw/swt/hidirlik_tower/asset.json'),
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
const rotate = (a, [x, y, z]) => [
  x * Math.cos(a) + z * Math.sin(a),
  y,
  -x * Math.sin(a) + z * Math.cos(a),
];
const radial = (a, y) => [
  [12 * Math.cos(a), y, 12 * Math.sin(a)],
  [-Math.cos(a), 0, -Math.sin(a)],
];

it('retains recessed and blocked doorways, twelve fasces, all merlons, open roof, southern window and a two-sided vector flag', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(17.2, 3);
    expect(g.hit([0, 1.5, 20], [0, 0, -1]), `${name} recessed northeast entry`).toBeGreaterThan(
      11.6,
    );
    expect(g.hit([7, 1.5, 20], [0, 0, -1]), `${name} front wall`).toBeLessThan(11.3);
    expect(
      g.hit(rotate(Math.PI / 2, [0, 1.65, 20]), rotate(Math.PI / 2, [0, 0, -1])),
      `${name} blocked northwest doorway`,
    ).toBeCloseTo(11.35, 2);
    for (const sign of [-1, 1])
      for (let i = 0; i < 6; i++) {
        expect(
          g.hit([sign * (1.64 + i * 0.8), 1.5, 20], [0, 0, -1]),
          `${name} fasces ${sign}/${i}`,
        ).toBeLessThan(11.18);
      }
    expect(15 - g.hit([5, 15, 5], [0, -1, 0]), `${name} open paved roof`).toBeCloseTo(12.24, 3);
    expect(7 - g.hit([8.3, 7, 8.3], [0, -1, 0]), `${name} supported podium terrace`).toBeCloseTo(
      6.635,
      3,
    );
    expect(15 - g.hit([0, 15, 0], [0, -1, 0]), `${name} central pedestal`).toBeCloseTo(13.12, 3);
    for (let i = 0; i < 12; i++) {
      expect(
        g.hit(...radial(((i + 0.45) * Math.PI) / 12, 13.2)),
        `${name} merlon ${i}`,
      ).toBeLessThan(4.2);
      expect(
        g.hit(...radial(((i + 0.94) * Math.PI) / 12, 13.2)),
        `${name} crenel ${i}`,
      ).toBeGreaterThan(12);
    }
    expect(g.hit(...radial(-Math.PI / 2, 13.2)), `${name} surviving southern infill`).toBeLessThan(
      4.2,
    );
    expect(g.hit(...radial(-2.695, 13.2)), `${name} real southern window`).toBeGreaterThan(12);
    expect(g.hit(...radial(-2.695, 13.85)), `${name} southern window lintel`).toBeLessThan(4.2);
    for (const side of [-1, 1])
      for (const [u, v, white] of [
        [0.36, 0.55, true],
        [0.99, 0.55, true],
        [0.71, 0.55, false],
        [1.4, 0.8, false],
      ]) {
        const green = g.green([u - 0.5, 16.94 - v, side * 2], [0, 0, -side]);
        expect(green, `${name} vector flag ${side}/${u}`).toBeDefined();
        if (white) expect(green).toBeGreaterThan(0.7);
        else expect(green).toBeLessThan(0.1);
      }
  }
}, 120000);

it('rebuilds complete budgeted variants while preserving detailed masters, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '11be190e693c630ea30f2d6485d6a89706be4a0a670bbb96f5af84c2a369edad',
  );
  expect(master).toBe('d87189883148a11aaaaf489c746fa2642263aa2ed2641536514c6633e84b6125');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 4, 4, 4][i]);
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
