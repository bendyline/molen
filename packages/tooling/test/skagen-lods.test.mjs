import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u4/u4r/skagen_lighthouse'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u4/u4r/skagen_lighthouse/asset.json'),
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

it('retains the46m taper and sixteen windows, complete joined ensemble and open courtyard passages, supported gallery and visible diamond-framed optic', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(46);
    expect(g.bounds.min.x).toBeLessThan(-21.3);
    expect(g.bounds.max.x).toBeGreaterThan(21.2);
    for (const [cx, cz, roof] of [
      [0, 17.28, 10.06],
      [-17.04, 28.31, 6.3],
      [16.91, 28.31, 6.3],
      [0, 7.56, 3.77],
    ])
      expect(
        15 - g.hit([cx, 15, cz], [0, -1, 0]),
        `${name} complete ensemble roof ${cx},${cz}`,
      ).toBeCloseTo(roof, 2);
    expect(g.hit([0, 5, 28], [0, -1, 0]), `${name} open courtyard`).toBe(Infinity);
    for (const [left, right] of [
      [-12.97, -10.43],
      [10.43, 12.84],
    ]) {
      const x = (left + right) / 2;
      expect(g.hit([x, 1.2, 25], [0, 0, -1]), `${name} open side passage`).toBe(Infinity);
      expect(g.hit([x, 2.1, 25], [0, 0, -1]), `${name} tall arch center`).toBe(Infinity);
      expect(g.hit([x + 0.65, 2, 25], [0, 0, -1]), `${name} arched shoulder`).toBeCloseTo(1.88, 2);
      expect(g.hit([x, 2.5, 25], [0, 0, -1]), `${name} real spandrel`).toBeCloseTo(1.88, 2);
      for (const px of [left + 0.02, right - 0.02])
        expect(
          2.75 - g.hit([px, 2.75, 22.72], [0, -1, 0]),
          `${name} joined masonry jamb`,
        ).toBeCloseTo(2.68, 2);
    }
    const radius = (y) => (y <= 7.4 ? 3.75 : 3.75 - ((y - 7.4) * 0.82) / (37.55 - 7.4));
    for (let i = 0; i < 4; i++)
      for (const [start, angles] of [
        [8, [Math.PI - 0.55, -0.55]],
        [11.4, [Math.PI + 0.58, 0.58]],
      ])
        for (const a of angles) {
          const y = start + i * 7.12,
            r = radius(y + 0.63),
            s = Math.sin(a),
            c = Math.cos(a),
            d = g.hit([10 * s + 0.1 * c, y + 0.6, 10 * c - 0.1 * s], [-s, 0, -c]);
          if (['skyline', 'district'].includes(name)) {
            expect(d, `${name} far window position`).toBeGreaterThan(10 - r + 0.01);
            expect(d).toBeLessThan(10 - r + 0.4);
          } else {
            expect(d, `${name} real arched tower recess`).toBeGreaterThan(10 - r + 0.2);
            expect(d).toBeLessThan(10 - r + 0.4);
          }
        }
    const count =
      name === 'skyline'
        ? 8
        : name === 'master'
          ? 144
          : name === 'district'
            ? 12
            : name === 'street'
              ? 24
              : 48;
    for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 8))) {
      const a = (name === 'skyline' ? Math.PI / 8 : 0) + (i * Math.PI * 2) / count,
        s = Math.sin(a),
        c = Math.cos(a);
      expect(
        39.05 - g.hit([3.8 * s, 39.05, 3.8 * c], [0, -1, 0]),
        `${name} gallery floor under guard`,
      ).toBeGreaterThan(38.97);
    }
    if (name !== 'skyline') {
      expect(g.hitOpaque([-1.7, 40.1, 0], [1, 0, 0]), `${name} optic pedestal`).toBeCloseTo(
        1.15,
        2,
      );
      const lens = g.hit([-1.7, 40.9, 0], [1, 0, 0]);
      expect(lens, `${name} large visible optic`).toBeGreaterThan(0.55);
      expect(lens).toBeLessThan(1);
      const a = Math.PI / 12,
        s = Math.sin(a),
        c = Math.cos(a),
        levels = name === 'district' ? [41.45] : [40.33, 41.45, 42.57];
      for (const y of levels) {
        const d = g.hitOpaque([10 * s, y, 10 * c], [-s, 0, -c]);
        expect(d, `${name} diamond-tier crossing ${y}`).toBeGreaterThan(7.8);
        expect(d).toBeLessThan(8.1);
      }
    }
  }
}, 120000);
it('rebuilds complete budgeted variants while retaining the corrected detailed master, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'e296f5b3324f202c9c4a74ee477d58239adc6b2d52e073762cd39318b1aa88ea',
  );
  expect(master).toBe('bebd4d6b10ebbc9266ee05a9e1d768d3332da5233b26d3a6a901e7e95d1c1cc8');
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
    if (l.name !== 'skyline') {
      for (const graph of [
        'brick',
        'plaster_lime',
        'metal_standing_seam',
        'metal_painted',
        'stone_granite',
        'wood_plain',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
      expect(
        g.materials.find((m) => m.name === 'metal_standing_seam').extras.molenSurface.slot,
      ).toBe('roof');
    }
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
