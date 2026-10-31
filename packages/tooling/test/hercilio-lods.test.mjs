import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  hercilioDeckY as deckY,
  hercilioFrame as frame,
  hercilioPoint as point,
} from '../../../content/worldgen/source/places/6g/6gj/hercilio_luz_bridge/models/hercilio-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/6g/6gj/hercilio_luz_bridge');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/6g/6gj/hercilio_luz_bridge/asset.json'),
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function geometry(file) {
  const bytes = await readFile(file);
  const model = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  return {
    bounds: new Box3().setFromObject(model.scene),
    hit(origin, direction, far = Infinity) {
      return (
        new Raycaster(new Vector3(...origin), new Vector3(...direction), 0, far).intersectObject(
          model.scene,
          true,
        )[0]?.distance ?? Infinity
      );
    },
  };
}

it('keeps both75m portals, two chain sides, shouldered truss, full road/platforms and clear339m water passage in all six GLBs', async () => {
  const files = [
    ['source', `${source}/models/source.glb`],
    ['master', resolve(sidecar, '../model.glb')],
    ...['skyline', 'district', 'street', 'closeup'].map((name) => [
      name,
      resolve(sidecar, '..', `model.${name}.glb`),
    ]),
  ];
  for (const [name, file] of files) {
    const g = await geometry(file);
    expect(g.bounds.max.y, name).toBeGreaterThan(75);
    expect(g.bounds.max.y, name).toBeLessThan(75.5);
    expect(g.bounds.max.x - g.bounds.min.x).toBeGreaterThan(815);
    for (const station of [
      0.1, 45, 90, 180, 225, 310, 394.5, 479.25, 564, 650, 766, 817.0521718577533,
    ]) {
      for (const z of [225, 564].includes(station) ? [0] : [-4.5, -3.07, 0, 3.07, 4.5]) {
        const target = deckY(station) + (z ? 0.08 : 0);
        const top = deckY(station) + 0.4,
          p = point(station, top, z);
        const height = top - g.hit(p, [0, -1, 0]);
        if (Math.abs(z) === 3.07) {
          // The road/walk seam carries a raised curb; test support rather than the walking-plane height.
          expect(height, `${name} supported curb seam ${station},${z}`).toBeGreaterThan(
            deckY(station) - 0.12,
          );
          expect(height).toBeLessThan(deckY(station) + 0.41);
        } else
          expect(
            Math.abs(height - target),
            `${name} continuous deck/platform ${station},${z}`,
          ).toBeLessThan(name === 'skyline' ? 0.3 : 0.12);
      }
    }
    for (const station of [225, 564]) {
      const a = point(station - 3, deckY(station) + 3, 0);
      expect(g.hit(a, frame(station).tangent, 6), `${name} open tower road portal`).toBe(Infinity);
      for (const z of [-3.5, 3.5])
        expect(100 - g.hit(point(station, 100, z), [0, -1, 0]), `${name}75m tower`).toBeGreaterThan(
          74.7,
        );
    }
    for (const station of [309.75, 394.5, 479.25]) {
      const p = point(station, 5, 20),
        normal = frame(station).normal;
      expect(
        g.hit(
          p,
          normal.map((v) => -v),
        ),
        `${name} open main water span`,
      ).toBe(Infinity);
    }
    for (const side of [-1, 1]) {
      for (const offset of name === 'skyline' ? [0] : [-0.16, 0.16])
        expect(
          100 - g.hit(point(270, 100, side * 3.25 + offset), [0, -1, 0]),
          `${name} paired chain`,
        ).toBeGreaterThan(57);
      const shoulder = 49 - g.hit(point(309.75, 49, side * 3.25), [0, -1, 0]);
      const center = 49 - g.hit(point(394.5, 49, side * 3.25), [0, -1, 0]);
      expect(shoulder - center, `${name} integrated shouldered upper chord`).toBeGreaterThan(2);
    }
  }
}, 120000);

it('keeps horizontal guard rails above the entire curved/crowned walk instead of leaving orphaned vertical bars', async () => {
  for (const name of ['master', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const station of [
      45.137, 90.137, 180.137, 300.137, 350.137, 440.137, 520.137, 620.137, 710.137, 800.137,
    ]) {
      for (const z of [-5.75, 5.75]) {
        const top = 100 - g.hit(point(station, 100, z), [0, -1, 0]);
        expect(top - deckY(station), `${name} continuous guard ${station},${z}`).toBeGreaterThan(
          0.97,
        );
        expect(top - deckY(station)).toBeLessThan(1.27);
      }
    }
  }
}, 120000);

it('retains supported bridge mouths and the independently mapped six-metre mainland cycleway connection', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const file =
      name === 'source'
        ? `${source}/models/source.glb`
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`);
    const g = await geometry(file);
    for (const [s, direction] of [
      [0, -1],
      [817.1521718577533, 1],
    ]) {
      for (const z of [-4.5, 0, 4.5]) {
        const p = point(s, 30, z),
          t = frame(s).tangent;
        const y =
          30 -
          g.hit(
            p.map((v, i) => v + direction * t[i] * 0.5),
            [0, -1, 0],
          );
        expect(y, `${name} supported mouth`).toBeGreaterThan(deckY(s) - 0.01);
        expect(y).toBeLessThan(deckY(s) + 0.1);
      }
    }
    for (const [x, z] of [
      [-411.2892, -14.3073],
      [-411.5202, -13.3755],
      [-411.7511, -12.4437],
    ]) {
      const y = 30 - g.hit([x, 30, z], [0, -1, 0]);
      expect(y, `${name} complete mapped cycleway mouth`).toBeGreaterThan(19.54);
      expect(y).toBeLessThan(19.65);
    }
  }
}, 120000);

it('rebuilds all budgeted levels with shared surfaces and separate GPU streams while preserving the detailed source', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    sourceHash = digest(await readFile(`${source}/models/source.glb`)),
    masterHash = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(sourceHash).toBe('606e1f6d458b2f5e597de1e4712e593b2ab8dc8fae59917d4c10093451f205a3');
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(sourceHash);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(masterHash);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
    expect(after.files.variants[l.name]).toBe(l.file);
    const b = await readFile(resolve(sidecar, '..', l.file));
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of [
        'metal_painted',
        'concrete_plain',
        'metal_perforated_square',
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
