import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { willisOutline } from '../../../content/worldgen/source/places/dp/dp3/willis_tower/models/willis-lods.mjs';
import {
  willisMapEvidence as evidence,
  willisFloorHeight as floorHeight,
  willisMappedPlan as mapPlan,
  willisTubes as tubes,
} from '../../../content/worldgen/source/places/dp/dp3/willis_tower/models/willis-tower-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/dp/dp3/willis_tower'),
  path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/dp/dp3/willis_tower/asset.json'),
  ),
  parts = [
    1178212992, 1178212993, 1178212994, 1178212995, 1178212996, 1178212997, 1178212998, 1178212999,
    1178213001, 1178226263, 1178226264,
  ];

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

function inside([x, z], plan) {
  let contained = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      contained = !contained;
  }
  return contained;
}
function boundaryDistance(p, plan) {
  return Math.min(
    ...plan.map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
        );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
    }),
  );
}
function roofProbe(plan) {
  const low = [0, 1].map((i) => Math.min(...plan.map((p) => p[i]))),
    high = [0, 1].map((i) => Math.max(...plan.map((p) => p[i])));
  let best,
    clearance = -1;
  for (let i = 0; i < 15; i++)
    for (let j = 0; j < 15; j++) {
      const p = [
        low[0] + ((i + 0.5) / 15) * (high[0] - low[0]),
        low[1] + ((j + 0.5) / 15) * (high[1] - low[1]),
      ];
      if (inside(p, plan) && boundaryDistance(p, plan) > clearance) {
        best = p;
        clearance = boundaryDistance(p, plan);
      }
    }
  if (!best) throw new Error('No interior probe for mapped podium');
  return best;
}

it('retains all nine tube heights, two527m tips, four auxiliary aerials, five western ledges, eleven podium roofs and curved skylight', async () => {
  for (const name of ['master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      resolve(path, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(527.3, 3);
    expect(g.bounds.min.x).toBeLessThan(-52);
    expect(g.bounds.max.x).toBeGreaterThan(42);
    expect(g.bounds.max.z).toBeGreaterThan(77);
    for (const [ix, iz, floors] of tubes)
      expect(
        600 - g.hit([ix * 22.86 + 9, 600, iz * 22.86 + 8], [0, -1, 0]),
        `${name} tube ${ix},${iz}`,
      ).toBeCloseTo(floorHeight(floors), 2);
    for (const [x, z, h] of [
      [-24.55, -0.1, 527.3],
      [2.25, 0, 527.3],
      [-30.86, 5, 467],
      [-15.86, -7, 460],
      [7, -5, 462],
      [8, 7, 453],
    ])
      expect(600 - g.hit([x, 600, z], [0, -1, 0]), `${name} supported mast/aerial`).toBeCloseTo(
        h,
        2,
      );
    for (const z of [-9.144, -4.572, 0, 4.572, 9.144])
      expect(g.hit([-40, 413.8, z], [1, 0, 0]), `${name} west Skydeck ledge`).toBeCloseTo(4.4, 2);
    for (const id of parts) {
      const plan = mapPlan(id),
        h = Number(evidence.elements.find((e) => e.id === id).tags.height),
        p = roofProbe(plan);
      expect(
        h + 0.25 - g.hit([p[0], h + 0.25, p[1]], [0, -1, 0]),
        `${name} mapped podium ${id}`,
      ).toBeCloseTo(h, 2);
    }
    const hill = 30 - g.hit([0.3, 30, 48.6], [0, -1, 0]);
    expect(hill, `${name} curved hill skylight`).toBeGreaterThan(name === 'district' ? 23.7 : 24.2);
    expect(hill).toBeLessThan(24.4);
    if (['master', 'closeup'].includes(name)) {
      const y = floorHeight(39) + 1.4;
      for (let i = 0; i < 10; i++) {
        const x = -11.43 + (i + 0.5) * 2.286;
        expect(g.hit([x, y, 100], [0, 0, -1]), `${name} ten-bay glazing`).toBeCloseTo(65.685, 2);
      }
      expect(
        g.hit([1.143, floorHeight(29) + 0.5, 100], [0, 0, -1]),
        `${name} real mechanical recess`,
      ).toBeGreaterThan(66.8);
    }
  }
}, 120000);

it('keeps coalesced podium boundaries within their viewing-scale tolerances', () => {
  for (const tolerance of [0.05, 0.35, 1])
    for (const id of parts) {
      const original = mapPlan(id),
        reduced = willisOutline(original, tolerance);
      expect(reduced.length).toBeGreaterThanOrEqual(3);
      expect(reduced.length).toBeLessThanOrEqual(original.length);
      for (const p of original)
        expect(boundaryDistance(p, reduced), `${id} outline ${tolerance}`).toBeLessThanOrEqual(
          tolerance + 0.001,
        );
    }
});

it('rebuilds four budgeted levels with three shared graphs and independent GPU streams while preserving the detailed masters', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '3f6c601de738c8c322671aeb2afb08f8c9c5cfdfaf2943c7c11da65da4d3cafe',
  );
  const master = digest(await readFile(resolve(path, '../model.glb')));
  expect(master).toBe('bae8f3c1a4bc2d6463b043e381bf8f1ceb2e1ce1aac8241a26fa5a002bc39198');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 6, 6, 6][i]);
    expect(a.files.variants[l.name]).toBe(l.file);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i) {
      for (const graph of ['metal_painted', 'concrete_plain', 'wood_plain'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
      expect(
        g.materials.some(
          (m) => m.name === 'clear-skydeck-glass' && m.alphaMode === 'BLEND' && m.doubleSided,
        ),
      ).toBe(true);
    }
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
