import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { buildKeriSkyline } from '../../worldgen/scripts/keri-skyline-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ud/ud9/n0640_keri_lighthouse'),
  runtime = resolve('../../content/worldgen/assets/places/ud/ud9/n0640_keri_lighthouse');
it('retains the restored drum, narrow bottle and asymmetric wing at skyline distance', () => {
  const faces = [],
    add = (_slot, _ref, points, normal, _uv, color) => faces.push({ points, normal, color });
  buildKeriSkyline({ addQuad: add, addTriangle: add, addConvexPolygon: add });
  const p = faces.flatMap((f) => f.points);
  expect(Math.max(...p.map((p) => p[1]))).toBeCloseTo(30.6, 5);
  expect(p.some((p) => p[1] === 0 && p[0] === 22.22 && p[2] === 5.51)).toBe(true);
  const waist = p.filter((p) => p[1] === 17);
  expect(waist).not.toHaveLength(0);
  expect(waist.every((p) => Math.abs(Math.hypot(p[0], p[2]) - 1.75) < 1e-6)).toBe(true);
  const drum = faces.filter(
    (f) => f.points.some((p) => p[1] === 1) && f.points.some((p) => p[1] === 13.6),
  );
  expect(drum).toHaveLength(16);
  expect(
    drum.every(
      (f) => f.color[0] > 0.65 && f.normal[0] * f.points[0][0] + f.normal[2] * f.points[0][2] > 0,
    ),
  ).toBe(true);
});
it('round trips the OSM national-map wing with the authority tower anchor', async () => {
  const spec = JSON.parse(await readFile(source + '/spec.json')),
    bytes = await readFile(source + '/map-frame.json'),
    frame = JSON.parse(bytes);
  const footprint = sourceLocalFootprint(spec, bytes).footprint;
  footprint.forEach((p, i) =>
    p.forEach((n, j) => expect(n).toBeCloseTo(frame.elements[0].coordinates[i][j], 9)),
  );
  expect(frame.measurements.wingLengthMeters).toBeCloseTo(16.58, 1);
  expect(frame.measurements.wingWidthMeters).toBeCloseTo(10.1, 1);
  expect(frame.measurements.wingLocalCenter[1]).toBeCloseTo(0.46, 1);
  expect(90 - (frame.heading * 180) / Math.PI).toBeCloseTo(102.15, 1);
  expect(frame.authorityControl.anchor).toEqual([25.02274216, 59.69871433]);
  expect(frame.authorityControl.heightMeters).toBe(30.6);
});
it('reuses the current small initial download while preserving the detailed import', async () => {
  const bytes = await readFile(runtime + '/asset.json'),
    asset = JSON.parse(bytes);
  const lods = await buildModelLandmarkLods(runtime + '/asset.json');
  expect(await readFile(runtime + '/asset.json')).toEqual(bytes);
  expect(lods.levels[0].triangles).toBeLessThanOrEqual(1000);
  expect(lods.levels[2].triangles).toBeLessThanOrEqual(16000);
  expect(lods.levels[2].errorMeters).toBeLessThan(0.1);
  expect(lods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  expect(asset.sourceHash).toBe(
    'sha256:4033d4e63ac06af4b7986481dbd1349e8f4b7596fca11187161cbbfa488ff230',
  );
});
