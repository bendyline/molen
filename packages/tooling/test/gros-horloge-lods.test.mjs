import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0b/gros_horloge'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u0/u0b/gros_horloge/asset.json'),
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
      const r = new Raycaster(new Vector3(...origin), new Vector3(...direction));
      return r.intersectObject(g.scene, true)[0]?.distance ?? Infinity;
    },
  };
}

it('keeps the complete ensemble, traversable street arch, two clock elevations and open bell lantern at all four levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(43, 3);
    expect(g.bounds.min.x).toBeLessThan(-10.5);
    expect(g.bounds.max.x).toBeGreaterThan(3.7);
    // Start just outside the 4.61m street barrel, clear of the attached rear workshop.
    for (const x of [-2.3, 0, 2.3])
      for (const sign of [-1, 1])
        expect(
          g.hit([x, 2, sign * 2.5], [0, 0, -sign]),
          `${name} open street barrel`,
        ).toBeGreaterThan(4.805);
    expect(g.hit([0, 6, 10], [0, 0, -1]), `${name} arch head`).toBeLessThan(8);
    for (const sign of [-1, 1])
      expect(g.hit([0, 9.7, sign * 10], [0, 0, -sign]), `${name} dial`).toBeLessThan(8);
    if (name === 'skyline' || name === 'district')
      for (const sign of [-1, 1]) {
        expect(g.hit([0, 10.3, sign * 3], [0, 0, -sign]), `${name} outward sun ray`).toBeCloseTo(
          0.77,
          3,
        );
        expect(
          g.hit([-0.45 * sign, 9.97, sign * 3], [0, 0, -sign]),
          `${name} outward hour hand`,
        ).toBeCloseTo(0.76, 3);
      }
    expect(g.hit([-6.3, 38.2, 15], [0, 0, -1]), `${name} open lantern`).toBe(Infinity);
    expect(Number.isFinite(g.hit([-6.58, 37, 15], [0, 0, -1])), `${name} retained bell`).toBe(true);
    expect(Number.isFinite(g.hit([-6.75, 38.2, 15], [0, 0, -1])), `${name} bell support`).toBe(
      true,
    );
    // Start below the adjoining belfry cornice, above the separate workshop roof.
    expect(g.hit([-2.77, 13, -4], [0, -1, 0]), `${name} workshop roof`).toBeGreaterThan(0.5);
    expect(g.hit([-2.77, 13, -4], [0, -1, 0])).toBeLessThan(3);
    expect(g.hit([2, 3, -7], [-1, 0, 0]), `${name} fountain face`).toBeLessThan(4.9);
  }
}, 120000);

it('rebuilds four budgeted registered variants, retaining exact detailed master hashes, material groups and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'b0f423686e0a51f1adbe4bf9da646892a86602b2947bf876d01eb78a5953762f',
  );
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
    expect(g.materials.length).toBe([1, 6, 7, 7][i]);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
