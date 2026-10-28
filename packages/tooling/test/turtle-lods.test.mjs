import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/w7/w7e/turtle_tower'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/w7/w7e/turtle_tower/asset.json'),
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
const rotate = (a, [x, y, z]) => [
  x * Math.cos(a) + z * Math.sin(a),
  y,
  -x * Math.sin(a) + z * Math.cos(a),
];

it('retains twenty unequal pointed openings, supported east steps, every parapet, east round aperture and four curled roof tips', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(8.8, 1);
    expect(g.bounds.max.z).toBeCloseTo(4.1, 3);
    for (const [w, d, y] of [
      [6.28, 4.54, 1.45],
      [4.8, 3.64, 4.25],
    ])
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          width = side % 2 ? d : w,
          xs = side % 2 ? [-width * 0.255, width * 0.255] : [-width * 0.325, 0, width * 0.325];
        for (const x of xs)
          expect(
            g.hit(rotate(a, [x, y, 10]), rotate(a, [0, 0, -1])),
            `${name} open bay${w}/${side}/${x}`,
          ).toBeGreaterThan(11);
      }
    for (const [y, x] of [
      [2.6, 6.28 * 0.325],
      [5.02, 4.8 * 0.325],
    ]) {
      expect(g.hit([0, y, 10], [0, 0, -1]), `${name} taller central pointed head`).toBeGreaterThan(
        11,
      );
      expect(g.hit([x, y, 10], [0, 0, -1]), `${name} smaller pointed head`).toBeLessThan(8.5);
    }
    for (const [z, height] of [
      [3.75, 0.2],
      [3.1, 0.6],
      [2.6, 0.8],
    ])
      expect(2 - g.hit([0, 2, z], [0, -1, 0]), `${name} supported ascending step${z}`).toBeCloseTo(
        height,
        3,
      );
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2,
        z = side % 2 ? 3.14 : 2.27,
        parapet = g.hit(rotate(a, [1, 3.7, 10]), rotate(a, [0, 0, -1]));
      expect(parapet, `${name} brick parapet${side}`).toBeCloseTo(10 - z - 0.02, 2);
      const width = side % 2 ? 3.64 : 4.8,
        railZ = (side % 2 ? 4.8 : 3.64) / 2 + 0.1;
      expect(
        g.hit(rotate(a, [width / 3, 6.45, 10]), rotate(a, [0, 0, -1])),
        `${name} upper balustrade${side}`,
      ).toBeCloseTo(10 - railZ, 2);
    }
    expect(4 - g.hit([0, 4, 0], [0, -1, 0]), `${name} upper gallery supported floor`).toBeCloseTo(
      3.475,
      3,
    );
    expect(g.hit([0, 6.85, 10], [0, 0, -1]), `${name} open east round aperture`).toBeGreaterThan(
      10.4,
    );
    expect(g.hit([0.55, 6.85, 10], [0, 0, -1]), `${name} circle surround`).toBeCloseTo(9.05, 3);
    expect(g.hit([0, 6.85, -10], [0, 0, 1]), `${name} plain west wall`).toBeCloseTo(9.05, 3);
    for (let side = 0; side < 4; side++) {
      const p = rotate((side * Math.PI) / 2, [-1.405, 10, 1.405]);
      expect(10 - g.hit(p, [0, -1, 0]), `${name} curled tip${side}`).toBeGreaterThan(8.65);
    }
  }
}, 120000);

it('rebuilds complete budgeted variants with exact dense masters, shared materials and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '744945e16c61052b4e4e1583bc19763aeb3e57bbd9635767f882fdfe5129df1a',
  );
  expect(master).toBe('993e1cac48a2d66f1e5593b8ac3672fd4f3e165682baf89de9d50b4bf2fb422d');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 2, 4, 4][i]);
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
