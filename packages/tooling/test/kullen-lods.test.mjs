import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u60/kullen_lighthouse'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u6/u60/kullen_lighthouse/asset.json'),
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

it('retains the15m complete tower, five recessed watchroom windows, house, grounded porch, supported guard and three mounted optic panels', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(15);
    expect(g.bounds.max.x).toBeGreaterThan(15.6);
    expect(g.bounds.max.z).toBeGreaterThan(10.5);
    for (const [x, z, y] of [
      [7.87, 6.93, 3.58 + 0.66 * (1 - 1 / 4.63)],
      [4.79, 0.5, 3.2 + 0.45 * (1 - 0.21 / 1.45)],
    ])
      expect(18 - g.hit([x, 18, z], [0, -1, 0]), `${name} complete roof`).toBeCloseTo(y, 2);
    expect(g.hit([3.2, 0.01, -3], [0, 0, 1]), `${name} grounded first step`).toBeCloseTo(0.5, 2);
    expect(g.hit([7, 0.05, 0], [-1, 0, 0]), `${name} grounded porch`).toBeCloseTo(0.6, 2);
    const capital = g.hit([6.15, 2.955, -2], [0, 0, 1]);
    expect(capital, `${name} capital reaches lintel`).toBeGreaterThan(0.7);
    expect(capital).toBeLessThan(0.95);
    for (const offset of [-1, -0.5, 0, 0.5, 1]) {
      const a = Math.PI + offset,
        s = Math.sin(a),
        c = Math.cos(a);
      const d = g.hit([10 * s, 6.6, 10 * c], [-s, 0, -c]);
      expect(d, `${name} watchroom ${offset} has real depth`).toBeGreaterThan(7.05);
      expect(d).toBeLessThan(7.25);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        s = Math.sin(a),
        c = Math.cos(a);
      expect(g.hit([5 * s, 8.2, 5 * c], [-s, 0, -c]), `${name} scupper ${i}`).toBeCloseTo(1.37, 2);
      expect(
        g.hit([c + 3.3 * s, 8.1, 3.3 * c - s], [-c, 0, s]),
        `${name} volumetric scupper body`,
      ).toBeCloseTo(0.83, 2);
      const b = a + 0.025;
      expect(
        9.7 - g.hit([2.28 * Math.sin(b), 9.7, 2.28 * Math.cos(b)], [0, -1, 0]),
        `${name} upper platform beneath guard`,
      ).toBeCloseTo(9.58, 2);
    }
    if (name !== 'skyline') {
      for (const [a, y] of [
        [Math.PI + 0.8, 3.4],
        [-Math.PI / 2, 1.5],
      ]) {
        const s = Math.sin(a),
          c = Math.cos(a);
        const d = g.hit([10 * s, y, 10 * c], [-s, 0, -c]);
        expect(d, `${name} small lower tower recess`).toBeGreaterThan(7.1);
        expect(d).toBeLessThan(7.25);
      }
      for (let f = 0; f < 3; f++) {
        const a = (f * Math.PI * 2) / 3,
          s = Math.sin(a),
          c = Math.cos(a),
          p = (x, y, z) => [x * c + z * s, y, z * c - x * s];
        const lens = g.hit(p(1.1, 11.13, 1.4), [-s, 0, -c]);
        expect(lens, `${name} optic panel ${f}`).toBeGreaterThan(0.1);
        expect(lens).toBeLessThan(0.6);
        expect(
          g.hit(p(name === 'district' ? 0.67 : 0.663, 11.13, 1.4), [-s, 0, -c], true),
          `${name} visible Fresnel ring`,
        ).toBeLessThan(0.5);
        expect(g.hit(p(1.1, 9.7, 0.91), [0, 1, 0], true), `${name} optic mounting bar`).toBeCloseTo(
          0.11,
          2,
        );
        const spoke = 10 - g.hit(p(0, 10, 0.6), [0, -1, 0], true);
        expect(spoke, `${name} optic spoke connects to pedestal`).toBeGreaterThan(9.87);
        expect(spoke).toBeLessThan(9.92);
      }
    }
  }
}, 120000);

it('rebuilds budgeted complete variants with the corrected master, six shared graphs, no images and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'ac2fad4c072a157924cde402329f736cd67348d6d744188dce4f938a0771f739',
  );
  expect(master).toBe('3b88c06f1c5cb9e62f7f59c53d5c4296bc04a0d662928f3edc8acb4a4c859df2');
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
    if (l.name !== 'skyline')
      for (const graph of [
        'plaster_lime',
        'stone_ashlar',
        'tile_ceramic',
        'metal_painted',
        'stone_granite',
        'wood_plain',
      ])
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
