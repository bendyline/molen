import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u5/u5r/tyholttarnet'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u5/u5r/tyholttarnet/asset.json'),
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

it('keeps the mapped base, five supported platforms,26 dishes, twelve-faceted pod and continuous open mast at every detail level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(124, 3);
    expect(g.hit([10, 20, 0], [-1, 0, 0]), `${name} outward concrete shaft`).toBeCloseTo(6.4, 2);
    const baseX = 8.3148 + (8.1698 - 8.3148) * (8.2521 / (8.2521 + 7.9609));
    expect(g.hit([20, 3, 0], [-1, 0, 0]), `${name} mapped base wall`).toBeCloseTo(20 - baseX, 3);
    for (const [level, y] of [29, 37.3, 45.6, 53.9, 62.2].entries()) {
      expect(g.hit([4, y + 0.7, 0], [0, -1, 0]), `${name} platform${level}`).toBeCloseTo(0.47, 2);
      const angles = level === 3 ? [0.2, 1.5, 2.8, 3.6, 4.9, 5.5] : [0.45, 1.7, 3.2, 4.5, 5.4];
      for (const [i, a0] of angles.entries()) {
        const a = a0 + level * 0.15,
          cy = y + 2 + (i % 3) * 0.68,
          hit = g.hit(rotate(a, [0, cy, 6]), rotate(a, [0, 0, -1]));
        expect(hit, `${name} independent dish${level}/${i}`).toBeGreaterThan(0.4);
        expect(hit).toBeLessThan(1.8);
      }
    }
    expect(g.hit([0, 72.65, 20], [0, 0, -1]), `${name} flared twelve-facet pod`).toBeCloseTo(
      20 - 7.2 * Math.cos(Math.PI / 12),
      2,
    );
    // Pass between ladder rungs as well as between truss members.
    expect(g.hit([0, 101.1, 5], [0, 0, -1]), `${name} open mast core`).toBe(Infinity);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        c = Math.cos(a),
        s = Math.sin(a),
        d = g.hit([5 * c, 100, 5 * s], [-c, 0, -s]);
      expect(d, `${name} mast leg${i}`).toBeGreaterThan(3.8);
      expect(d).toBeLessThan(4.3);
    }
    for (const [y, r] of [
      [87, 1.55],
      [95.5, 1.4],
      [105, 1.1],
    ])
      expect(g.hit([r * 0.8, y + 0.15, 0], [0, -1, 0]), `${name} mast platform${y}`).toBeCloseTo(
        0.07,
        2,
      );
  }
}, 120000);

it('reconstructs registered, budgeted variants while preserving both dense masters and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'a0b0f767ea45efc6c79522606c417991f1e67723ba9ddb2eea6fa7276daa4fea',
  );
  expect(master).toBe('9b67d09458e2560ba065a4b3e0512a278f1007c2a4e1953ae365e0eadf60e33d');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
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
