import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3z/klaipeda_lighthouse'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u3/u3z/klaipeda_lighthouse/asset.json'),
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

it('retains all ten bands and the vertical stripe, arched entry, six shaft recesses, folded shoulders, supported square gallery and visible near optic', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(40);
    expect(g.bounds.max.z).toBeCloseTo(5, 3);
    for (let j = 0; j < 10; j++) {
      const y = 6.66 + (j + 0.5) * 2.63,
        green = g.green([10, y, 0], [-1, 0, 0]);
      if (j % 2) expect(green, `${name} white band ${j}`).toBeGreaterThan(0.5);
      else expect(green, `${name} black band ${j}`).toBeLessThan(0.1);
      expect(
        g.green([-10, y, 0], [1, 0, 0]),
        `${name} continuous seaward stripe ${j}`,
      ).toBeLessThan(0.1);
    }
    expect(g.hit([0.2, 1.5, 10], [0, 0, -1]), `${name} recessed timber entry`).toBeCloseTo(6.11, 2);
    expect(g.hit([0.5, 2.95, 10], [0, 0, -1]), `${name} arched shoulder`).toBeLessThan(6.03);
    expect(g.hit([0, 2.98, 10], [0, 0, -1]), `${name} taller open arch head`).toBeGreaterThan(6.05);
    for (let i = 0; i < 6; i++) {
      const hit = g.hit([0.12, 7.6 + i * 4.52, 10], [0, 0, -1]);
      if (name === 'skyline') expect(hit, `${name} window position ${i}`).toBeCloseTo(7.4, 2);
      else {
        expect(hit, `${name} true window recess ${i}`).toBeGreaterThan(7.5);
        expect(hit).toBeLessThan(7.7);
      }
    }
    expect(2 - g.hit([0, 2, 4.8], [0, -1, 0]), `${name} lower entry step`).toBeCloseTo(0.18, 3);
    expect(2 - g.hit([0, 2, 4.4], [0, -1, 0]), `${name} upper entry step`).toBeCloseTo(0.36, 3);
    expect(10 - g.hit([10, 4.7, 0], [-1, 0, 0]), `${name} broad lower shoulder`).toBeGreaterThan(
      4.4,
    );
    expect(10 - g.hit([10, 5.9, 0], [-1, 0, 0]), `${name} second shoulder`).toBeGreaterThan(3.2);
    expect(10 - g.hit([10, 5.9, 0], [-1, 0, 0])).toBeLessThan(3.3);
    expect(
      36 - g.hit([3.6, 36, 3.6], [0, -1, 0]),
      `${name} full square gallery corner`,
    ).toBeCloseTo(35.44, 3);
    for (const x of [-3.7, 3.7])
      for (const z of [-3.7, 3.7]) {
        expect(
          35.47 - g.hit([x, 35.47, z], [0, -1, 0]),
          `${name} supported gallery corner post`,
        ).toBeCloseTo(35.44, 3);
      }
    if (name !== 'skyline') {
      const a = (3 * Math.PI) / 2 + Math.PI / 16,
        hit = g.hitOpaque(
          [10 * Math.sin(a), 36.8, 10 * Math.cos(a)],
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      expect(hit, `${name} visible supported optic pedestal between mullions`).toBeGreaterThan(
        9.63,
      );
      expect(hit).toBeLessThan(9.72);
    }
  }
}, 120000);

it('rebuilds complete budgeted variants while preserving detailed masters, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'c34dc76368216e6d6e05fb4cf37c9fd9a1520e5cd9ce8b6f7665526433c04b84',
  );
  expect(master).toBe('da10a9d3bdb44c2a96ae0f298fee4e183abe30d02d2b774b438a3539500711f9');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 6, 6, 6][i]);
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
