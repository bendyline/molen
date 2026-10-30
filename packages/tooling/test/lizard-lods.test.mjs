import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/gb/gbu/lizard_lighthouse'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/gb/gbu/lizard_lighthouse/asset.json'),
  );

async function geometry(file) {
  const b = await readFile(file),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  g.scene.updateMatrixWorld(true);
  const opaque = [];
  g.scene.traverse((o) => {
    if (o.isMesh && !o.material.transparent) opaque.push(o);
  });
  return {
    bounds: new Box3().setFromObject(g.scene),
    hit(origin, direction, opaqueOnly = false) {
      const ray = new Raycaster(new Vector3(...origin), new Vector3(...direction));
      return (
        (opaqueOnly ? ray.intersectObjects(opaque, false) : ray.intersectObject(g.scene, true))[0]
          ?.distance ?? Infinity
      );
    },
  };
}

it('keeps both octagonal towers, complete station buildings, open yards and eastern diamond lantern with its optic and foghorn', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(19);
    expect(g.bounds.min.x).toBeLessThan(-71.9);
    expect(g.bounds.max.z).toBeGreaterThan(42.6);
    const roof = (x, z) => 25 - g.hit([x, 25, z], [0, -1, 0]);
    expect(roof(-33.635, 5.67), `${name} full keeper range`).toBeCloseTo(
      7.59 + 1.52 * (1 - 1 / 4.64),
      2,
    );
    for (const [x, z] of [
      [-58.18, 10.77],
      [-7.2, 10.32],
    ])
      expect(roof(x, z), `${name} projecting gable bay`).toBeCloseTo(
        7.99 + 1.13 * (1 - 1 / 2.85),
        2,
      );
    for (const [x0, x1, z0, z1] of [
      [-60.02, -55.87, -7.63, 1.75],
      [-53.97, -49.6, -7.87, 1.97],
      [-48.05, -43.73, -9.96, 0.04],
      [-39.58, -34.77, -11.05, 0.11],
      [-30.05, -25.47, -7.83, 0.25],
      [-16.43, -12.93, -8.54, 0.22],
      [-8.86, -4.61, -8.9, 0.21],
    ]) {
      const y = roof((x0 + x1) / 2, (z0 + z1) / 2);
      expect(y, `${name} individual rear outshut`).toBeGreaterThan(4.63);
      expect(y).toBeLessThan(4.71);
    }
    for (const [x, z, low, high] of [
      [-46.545, -12.72, 4.95, 5.04],
      [-33.715, 16.14, 3.97, 4.04],
      [-33.15, 28.11, 7.63, 7.75],
    ]) {
      expect(roof(x, z), `${name} rear wing / corridor / engine house`).toBeGreaterThan(low);
      expect(roof(x, z)).toBeLessThan(high);
    }
    for (const x of [-50, -20])
      expect(g.hit([x, 2, 18], [0, -1, 0]), `${name} yard stays open`).toBe(Infinity);
    for (const [x, z] of [
      [0, 0],
      [-67.95, 2.82],
    ]) {
      const d = g.hit([x + 0.12, 7.05, z + 20], [0, 0, -1]);
      expect(d, `${name} tower window`).toBeGreaterThan(
        ['skyline', 'district'].includes(name) ? 16.5 : 16.85,
      );
      expect(d).toBeLessThan(17.1);
      expect(
        14.5 - g.hit([x + 1.2, 14.5, z + 3.48], [0, -1, 0]),
        `${name} gallery support`,
      ).toBeCloseTo(14.39, 2);
    }
    expect(roof(-67.95, 2.82), `${name} western tower has no lantern`).toBeLessThan(14.51);
    for (const x of [-58, -48, -38, -28, -18, -8])
      expect(roof(x, 4.67), `${name} tall keeper chimney`).toBeGreaterThan(11.4);
    for (const x of [-41, -26])
      expect(roof(x, 28.11), `${name} engine chimney`).toBeGreaterThan(9.9);
    if (name !== 'skyline') {
      const a = Math.PI / 8,
        s = Math.sin(a),
        c = Math.cos(a);
      const diamond = g.hit([5 * s, 15.885, 5 * c], [-s, 0, -c], true);
      expect(diamond, `${name} visible diamond crossing`).toBeGreaterThan(2.57);
      expect(diamond, `${name} visible diamond crossing`).toBeLessThan(2.72);
      const lens = g.hit([1.4, 15.7, 0], [-1, 0, 0]);
      expect(lens, `${name} visible large optic`).toBeGreaterThan(0.45);
      expect(lens).toBeLessThan(0.75);
      const horn = g.hit([-33.01, 7.12, 36], [0, 0, -1]);
      expect(horn, `${name} recessed horn mouth`).toBeGreaterThan(1.5);
      expect(horn).toBeLessThan(1.8);
    }
  }
}, 120000);

it('reproduces complete budgeted levels with four shared graphs and separate GPU streams, preserving both detailed masters', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'd8c3314032a88038fbccf6d88d9a512da937cec80299fb0c17efe12805828f9f',
  );
  expect(master).toBe('fb54cac849dca2b9a7e2d0dbe536f4a33f532df011e2e73b9b874395f3b9b243');
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
    if (l.name !== 'skyline')
      for (const graph of ['plaster_lime', 'slate', 'metal_painted', 'wood_plain'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[normal.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
