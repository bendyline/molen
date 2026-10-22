import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import {
  buildJeddahSkyline,
  jeddahRuntimeAssetId,
} from '../../worldgen/scripts/jeddah-skyline-model.mjs';
import { landmarkLodRecipeHash as baseHash } from '../scripts/authored-landmark-lods.mjs';
import { buildModelLandmarkLods, landmarkLodRecipeHash } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sg/sgg/n0644_jeddah_light');
const runtime = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/sg/sgg/n0644_jeddah_light'),
);
const faces = [];
const add = (_slot, _ref, points, normal, _uv, color) => faces.push({ points, normal, color });
buildJeddahSkyline({ addQuad: add, addTriangle: add, addConvexPolygon: add });

it('preserves a pale shaft and base with a separate bronze capsule at skyline distance', () => {
  const shaft = faces.filter(
    (f) => f.points.some((p) => p[1] === 20) && f.points.some((p) => p[1] === 77.6),
  );
  expect(shaft.length).toBeGreaterThan(0);
  expect(shaft.every((f) => f.color[0] > 0.75 && f.color[2] > 0.6)).toBe(true);
  const capsule = faces.filter((f) => f.points.every((p) => p[1] >= 81 && p[1] <= 101));
  expect(capsule.length).toBeGreaterThan(0);
  expect(capsule.every((f) => f.color[0] < 0.3)).toBe(true);
  const points = faces.flatMap((f) => f.points);
  expect(Math.max(...points.map((p) => p[1]))).toBeCloseTo(131.4, 5);
  expect(Math.max(...points.map((p) => p[0]))).toBeCloseTo(28.2, 5);
  expect(Math.max(...points.map((p) => p[2]))).toBeCloseTo(41.2, 5);
  expect(
    points.some(
      (p) => Math.abs(p[1] - 97) < 1e-6 && Math.abs(Math.hypot(p[0], p[2]) - 19.6) < 1e-6,
    ),
  ).toBe(true);
});

it('keeps the skyline surfaces outward facing, including the slender shaft', () => {
  const shaft = faces.filter(
    (f) => f.points.some((p) => p[1] === 20) && f.points.some((p) => p[1] === 77.6),
  );
  expect(shaft).toHaveLength(16);
  for (const f of shaft) {
    const center = [0, 2].map((i) => f.points.reduce((n, p) => n + p[i], 0) / f.points.length);
    expect(f.normal[0] * center[0] + f.normal[2] * center[1]).toBeGreaterThan(0);
  }
});

it('round trips the independently mapped base and retains its signed south wing', async () => {
  const spec = JSON.parse(await readFile(source + '/spec.json'));
  const bytes = await readFile(source + '/map-frame.json'),
    frame = JSON.parse(bytes);
  const result = sourceLocalFootprint(spec, bytes);
  expect(result.footprint).toHaveLength(frame.elements[0].coordinates.length);
  result.footprint.forEach((p, i) => {
    p.forEach((v, j) => {
      expect(v).toBeCloseTo(frame.elements[0].coordinates[i][j], 9);
    });
  });
  expect(frame.measurements.maximumEnvelopeDifferenceMeters).toBeLessThan(1.1);
  const south = 180 - (frame.heading * 180) / Math.PI;
  expect(south).toBeCloseTo(Number(frame.elements[2].tags['roof:direction']), 3);
  expect(frame.elements[2].localOutline.every((p) => p[1] > 5)).toBe(true);
});

it('leaves unrelated recipe fingerprints unchanged', async () => {
  const other = 'molen.worldgen.structure.n0643_phare_du_fournier';
  expect(await landmarkLodRecipeHash(other)).toBe(await baseHash(other));
  expect(await landmarkLodRecipeHash(jeddahRuntimeAssetId)).not.toBe(
    await baseHash(jeddahRuntimeAssetId),
  );
});

it('reuses all current derivatives without changing the source or detailed import', async () => {
  const before = await readFile(runtime + '/asset.json');
  const levels = await buildModelLandmarkLods(runtime + '/asset.json');
  expect(await readFile(runtime + '/asset.json')).toEqual(before);
  expect(levels.levels[0].triangles).toBeLessThanOrEqual(1000);
  expect(levels.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
});
