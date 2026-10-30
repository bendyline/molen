import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3e/kolobrzeg_lighthouse'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u3/u3e/kolobrzeg_lighthouse/asset.json'),
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
    hitOpaque(origin, direction) {
      const objects = [];
      g.scene.traverse((o) => {
        if (o.isMesh && !o.material.transparent) objects.push(o);
      });
      return (
        new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObjects(
          objects,
          false,
        )[0]?.distance ?? Infinity
      );
    },
    hit: (origin, direction) => hit(origin, direction)?.distance ?? Infinity,
    green(origin, direction) {
      const h = hit(origin, direction);
      return h?.object.geometry.attributes.color.getY(h.face.a);
    },
  };
}

it('preserves the broad fort and entrance, arched windows, eight open columns, supported galleries and the26m lantern cap', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(26);
    expect(g.bounds.max.z).toBeGreaterThan(9.65);
    expect(g.hit([0.2, 1.2, 10], [0, 0, -1]), `${name} timber entrance inset`).toBeCloseTo(2.02, 2);
    expect(
      g.hit([0, 2.3, 10], [0, 0, -1]),
      `${name} open center of shallow entry arch`,
    ).toBeGreaterThan(1.9);
    expect(g.hit([0.7, 2.3, 10], [0, 0, -1]), `${name} lower arch shoulder`).toBeLessThan(1.8);
    const a = Math.PI / 4,
      origin = [10 * Math.sin(a), 12, 10 * Math.cos(a)],
      direction = [-Math.sin(a), 0, -Math.cos(a)];
    expect(g.hit(origin, direction), `${name} complete broad brick shaft`).toBeGreaterThan(5.7);
    expect(g.hit(origin, direction)).toBeLessThan(6.1);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      for (const y of [7.05, 10.23, 13.41]) {
        const x = 0.15,
          z = 10,
          origin = [x * Math.cos(a) + z * Math.sin(a), y + 0.6, -x * Math.sin(a) + z * Math.cos(a)],
          dir = [-Math.sin(a), 0, -Math.cos(a)],
          d = g.hit(origin, dir);
        if (name === 'skyline') {
          expect(d, `${name} distance window card`).toBeGreaterThan(5.75);
          expect(d).toBeLessThan(5.9);
        } else {
          expect(d, `${name} true narrow window recess`).toBeGreaterThan(6);
          expect(d).toBeLessThan(6.3);
        }
      }
    if (name !== 'skyline') {
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5,
          x = 0.15,
          z = 10,
          origin = [x * Math.cos(a) + z * Math.sin(a), 3.5, -x * Math.sin(a) + z * Math.cos(a)],
          dir = [-Math.sin(a), 0, -Math.cos(a)],
          d = g.hit(origin, dir);
        expect(d, `${name} true upper gunport ${i}`).toBeGreaterThan(2);
        expect(d).toBeLessThan(2.3);
      }
      for (let i = 0; i < 16; i++) {
        const a = i * 0.34,
          y = 19.54 + i * 0.17,
          d = g.hit([0.85 * Math.sin(a), y + 0.13, 0.85 * Math.cos(a)], [0, -1, 0]);
        expect(d, `${name} visible spiral tread ${i}`).toBeCloseTo(0.06, 2);
      }
      for (let i = 1; i < 15; i++) {
        const a = (i + 0.5) * 0.34,
          y = 19.47 + (i + 0.5) * 0.17 - 0.06,
          s = Math.sin(a),
          c = Math.cos(a),
          d = g.hitOpaque([1.6 * s, y, 1.6 * c], [-s, 0, -c]);
        expect(d, `${name} continuous helical support ${i}`).toBeGreaterThan(0.6);
        expect(d).toBeLessThan(0.9);
      }
      expect(g.hit([-1.2, 23.8, 0], [1, 0, 0]), `${name} compact optic lens`).toBeGreaterThan(0.65);
      expect(g.hit([-1.2, 23.8, 0], [1, 0, 0])).toBeLessThan(0.8);
      expect(g.hitOpaque([-1.2, 23.2, 0], [1, 0, 0]), `${name} optic pedestal`).toBeCloseTo(
        0.94,
        2,
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * Math.PI) / 4,
        s = Math.sin(a),
        c = Math.cos(a),
        d = g.hitOpaque([10 * s, 20.8, 10 * c], [-s, 0, -c]);
      expect(d, `${name} column ${i}`).toBeGreaterThan(6.65);
      expect(d).toBeLessThan(6.95);
      const gap = a + Math.PI / 8,
        ds = Math.sin(gap),
        dc = Math.cos(gap),
        open = g.hitOpaque([10 * ds, 20.8, 10 * dc], [-ds, 0, -dc]);
      expect(open, `${name} open inter-column bay ${i}`).toBeGreaterThan(8);
      for (const offset of [-0.12, 0, 0.12]) {
        const x = 3.12 * s + offset * c,
          z = 3.12 * c - offset * s,
          d = g.hit([x, 22.175, z], [0, 1, 0]);
        expect(d, `${name} supported capital ${i}`).toBeLessThan(0.03);
      }
    }
    for (const [r, y] of [
      [4.3, 19.7],
      [3.1, 22.6],
    ]) {
      const d = g.hit([r, y, 0], [0, -1, 0]);
      expect(d, `${name} full gallery floor`).toBeLessThan(0.35);
    }
  }
}, 120000);
it('rebuilds complete budgeted variants while retaining corrected detailed masters, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'c823f9372dbfed61c53f9e7047703c0f76525c4b7730d6aa875e76cee3fd39d3',
  );
  expect(master).toBe('6e8c3079d0fccc86244270e82b0440a2ec6fe0093fe5e7f9b03e4803b80c63bf');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 8, 8, 8][i]);
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
