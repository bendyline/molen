import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u15/gerbrandy_tower'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u1/u15/gerbrandy_tower/asset.json'),
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
    hits: (origin, direction) =>
      new Raycaster(new Vector3(...origin), new Vector3(...direction))
        .intersectObject(g.scene, true)
        .map((h) => h.distance),
    hit: (origin, direction) => hit(origin, direction)?.distance ?? Infinity,
    green(origin, direction) {
      const h = hit(origin, direction);
      return h?.object.geometry.attributes.color.getY(h.face.a);
    },
  };
}

it('retains twelve connected guys, three mapped foundations, six open galleries, glazing and the complete372m mast', async () => {
  const map = JSON.parse(await readFile(`${source}/map-frame.json`));
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBe(372);
    const outline = map.anchors.flatMap((a) => a.outline);
    expect(g.bounds.min.x).toBeCloseTo(Math.min(...outline.map((p) => p[0])), 3);
    expect(g.bounds.max.x).toBeCloseTo(Math.max(...outline.map((p) => p[0])), 3);
    expect(g.bounds.min.z).toBeCloseTo(Math.min(...outline.map((p) => p[1])), 3);
    expect(g.bounds.max.z).toBeCloseTo(Math.max(...outline.map((p) => p[1])), 3);
    for (const anchor of map.anchors) {
      let longest = 0,
        direction;
      for (let i = 0; i < anchor.outline.length; i++) {
        const a = anchor.outline[i],
          b = anchor.outline[(i + 1) % anchor.outline.length],
          d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d > longest) {
          longest = d;
          direction = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
        }
      }
      expect(
        3 -
          g.hit(
            [anchor.center[0] - direction[1] * 0.5, 3, anchor.center[1] + direction[0] * 0.5],
            [0, -1, 0],
          ),
        `${name} anchor foundation beside the cable fittings`,
      ).toBeCloseTo(1.25, 3);
      const [x, z] = anchor.center,
        d = Math.hypot(x, z);
      for (const [i, y] of [122, 226, 302, 350].entries()) {
        const start = [(x / d) * 1.55, y, (z / d) * 1.55],
          end = [x + direction[0] * (i - 1.5), 1.2, z + direction[1] * (i - 1.5)];
        for (const t of [0.02, 0.5, 0.98]) {
          const p = start.map(
            (v, k) => v + (end[k] - v) * t - (k === 1 ? 1.3 * 4 * t * (1 - t) : 0),
          );
          // Other strands can cross this vertical ray near their shared anchor block.
          const hits = g.hits([p[0], p[1] + 1, p[2]], [0, -1, 0]);
          expect(
            hits.some((distance) => distance > 0.85 && distance < 1.15),
            `${name} connected guy ${anchor.osmWay}/${y}/${t}`,
          ).toBe(true);
        }
      }
    }
    for (const y of [62, 68, 74, 80, 86, 90]) {
      expect(
        y + 0.2 - g.hit([6.3, y + 0.2, 0], [0, -1, 0]),
        `${name} equipment floor ${y}`,
      ).toBeCloseTo(y, 3);
      expect(g.hit([6.3, y + 0.4, 0], [0, 0, -1]), `${name} open gallery air ${y}`).toBe(Infinity);
      if (name !== 'skyline') {
        const posts = name === 'master' ? 64 : name === 'closeup' ? 32 : 6,
          radius = (y === 90 ? 7.45 : 7.65) - 0.15;
        for (let i = 0; i < posts; i++) {
          const a = (i * 2 * Math.PI) / posts,
            x = radius * Math.cos(a),
            z = radius * Math.sin(a);
          expect(
            g.hit([12 * Math.cos(a), y + 0.3, 12 * Math.sin(a)], [-Math.cos(a), 0, -Math.sin(a)]),
            `${name} gallery post ${y}/${i}`,
          ).toBeLessThan(12 - radius + 0.1);
          expect(
            y + 0.01 - g.hit([x, y + 0.01, z], [0, -1, 0]),
            `${name} seated gallery post ${y}/${i}`,
          ).toBeCloseTo(y, 3);
        }
      }
    }
    for (const y of [59.5, 88, 98, 219.5]) {
      const a = (3 * Math.PI) / 32,
        p = [15 * Math.cos(a), y, 15 * Math.sin(a)],
        d = [-Math.cos(a), 0, -Math.sin(a)];
      expect(g.green(p, d), `${name} glazing ${y}`).toBeCloseTo(0.24, 2);
    }
    if (name !== 'skyline')
      for (const a of [0.28, 0.28 + Math.PI / 2, 0.28 + Math.PI, 0.28 + (3 * Math.PI) / 2]) {
        for (const y of [
          ...Array.from({ length: 18 }, (_, i) => 3.85 + i * 3),
          64.5,
          70.5,
          76.5,
          82.5,
          92.35,
        ])
          expect(
            g.green([15 * Math.cos(a), y, 15 * Math.sin(a)], [-Math.cos(a), 0, -Math.sin(a)]),
            `${name} shaft window ${a}/${y}`,
          ).toBeCloseTo(0.24, 2);
      }
    for (const [y, r] of [
      [120.15, 2.6],
      [224.15, 2.6],
      [300.15, 2.6],
      [348.15, 2.6],
      [128.18, 2.2],
      [212.18, 2.2],
      [270.18, 2.2],
      [309.18, 2.2],
    ])
      expect(
        y + 0.1 - g.hit([r * 0.62, y + 0.1, 0], [0, -1, 0]),
        `${name} mast platform ${y}`,
      ).toBeCloseTo(y, 3);
    const a = -0.88,
      stairs = [6, 7.5].map((r) => 3 - g.hit([r * Math.cos(a), 3, r * Math.sin(a)], [0, -1, 0]));
    expect(stairs[0], `${name} supported ascending entry`).toBeGreaterThan(stairs[1]);
    expect(stairs[1]).toBeGreaterThan(0);
  }
}, 120000);

it('rebuilds complete budgeted variants while preserving detailed masters, shared bindings and separate GPU uploads', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path)),
    master = digest(await readFile(resolve(path, '../model.glb')));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'e99fc388a8d5e7f2f34586b2c20b45442a0257671fec3af4c55b583844b6c3c6',
  );
  expect(master).toBe('83d27e44c0ab500e5226ea214fcd57b7e665366e8f83afa2f7cb5ab3c7a6036e');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 3, 3, 3][i]);
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
