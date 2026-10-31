import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  isabelControls as C,
  isabelCircle,
  isabelDeckY,
} from '../../../content/worldgen/source/places/ey/eye/isabel_ii_bridge/models/isabel-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ey/eye/isabel_ii_bridge');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/ey/eye/isabel_ii_bridge/asset.json'),
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(file) {
  const bytes = await readFile(file);
  const model = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  return (p, d, far = Infinity) =>
    new Raycaster(new Vector3(...p), new Vector3(...d), 0, far).intersectObject(
      model.scene,
      true,
    )[0]?.distance ?? Infinity;
}

it('keeps three open water spans, hollow circles, road/walk support and both lower quay passages in every tier', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const span of C.spans) {
      const x = (span[0] + span[1]) / 2;
      expect(hit([x, 1.4, 12], [0, 0, -1], 24), `${name}: open water span`).toBe(Infinity);
      expect(Math.abs(20 - hit([x, 20, 1], [0, -1, 0]) - isabelDeckY(x))).toBeLessThan(0.06);
    }
    for (const x of [-82.8, -55, 0, 45, 82.8]) {
      const deck = isabelDeckY(Math.max(C.west, Math.min(C.east, x)));
      expect(Math.abs(20 - hit([x, 20, 2], [0, -1, 0]) - deck), `${name}: road`).toBeLessThan(0.07);
      const curb = Math.abs(x) > 82.5 ? 0 : 0.12;
      expect(
        Math.abs(20 - hit([x, 20, 6], [0, -1, 0]) - deck - curb),
        `${name}: walk`,
      ).toBeLessThan(0.07);
    }
    for (const z of [-7.5, 0, 7.5]) {
      const west = -73.9076 + 0.04681 * z;
      for (const x of [west, 72.6]) {
        expect(
          Math.abs(1.5 - hit([x, 1.5, z], [0, -1, 0]) - 1.15),
          `${name}: quay paving`,
        ).toBeLessThan(0.015);
        expect(hit([x, 1.16, z], [0, 1, 0]), `${name}: actual passage clearance`).toBeGreaterThan(
          1.95,
        );
      }
    }
    if (!['skyline', 'district'].includes(name)) {
      const span = C.spans[1],
        ring = isabelCircle(span, span[0] + (span[1] - span[0]) * 0.23);
      expect(
        hit([ring.x + C.pierSkew * 7.55, ring.y, 8.5], [0, 0, -1], 1.1),
        `${name}: circle hollow`,
      ).toBe(Infinity);
    }
  }
}, 120000);

it('rebuilds exact budgeted shared-material tiers without changing the detailed masters or duplicating GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar));
  const src = digest(await readFile(source + '/models/source.glb'));
  const master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('2031467a44ec03e3c9ffe10db8698b61915f411ca0c8a1dda9f775f426895f1d');
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(source + '/models/source.glb'))).toBe(src);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(master);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
    const b = await readFile(resolve(sidecar, '..', l.file));
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of [
        'metal_painted',
        'stone_limestone_raw',
        'concrete_plain',
        'stone_granite',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[normal.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
