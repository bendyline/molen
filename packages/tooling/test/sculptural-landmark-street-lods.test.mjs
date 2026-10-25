import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { validateAuthoredMesh } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import {
  newYorkStockExchangePedimentStatue,
  newYorkStockExchangeStreet,
} from '../../worldgen/scripts/structure-new-york-stock-exchange.mjs';
import { treviFountainStreet } from '../../worldgen/scripts/structure-trevi-fountain.mjs';
import { simplifyStaticSculpture } from '../scripts/static-sculpture-lod.mjs';

it.each([
  ['New York Stock Exchange', newYorkStockExchangeStreet],
  ['Trevi Fountain', treviFountainStreet],
])('%s stays within the street budget with the current shared figure anatomy', (name, build) => {
  const builder = new MeshBufferBuilder();
  build(builder);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, name);
  expect(mesh.triangleCount).toBeLessThanOrEqual(16000);
  expect(mesh.triangleCount).toBeGreaterThan(4000);
  expect(mesh.groups).toHaveLength(6);
});

it('refuses a sculpture reduction that cannot satisfy its distance bound', () => {
  const a = [0, 0, 0],
    b = [1, 0, 0],
    c = [0, 1, 0],
    d = [0, 0, 1];
  expect(() =>
    simplifyStaticSculpture(
      [
        [a, c, b],
        [a, b, d],
        [a, d, c],
        [b, c, d],
      ],
      1,
      0,
    ),
  ).toThrow('cannot meet');
});

it('keeps the complete eleven-figure group clear of both pediment slopes at every level', () => {
  for (const d of [0, 1, 2, 3])
    for (const [x, kind] of [
      [-13.5, 'left-end'],
      [-10.6, 'mining'],
      [-7.2, 'wife'],
      [-4.7, 'farmer'],
      [-2.1, 'child-l'],
      [0, 'integrity'],
      [2.2, 'child-r'],
      [4.7, 'mechanic'],
      [7.4, 'power'],
      [10.6, 'science'],
      [13.6, 'right-end'],
    ]) {
      const builder = new MeshBufferBuilder();
      newYorkStockExchangePedimentStatue(builder, x, kind, d);
      const mesh = builder.finalize();
      expect(mesh.triangleCount).toBeGreaterThan(0);
      for (let i = 0; i < mesh.positions.length; i += 3)
        expect(
          mesh.positions[i + 1] + Math.abs(mesh.positions[i]) * (6.75 / 16.7),
        ).toBeLessThanOrEqual(36.80001);
    }
});
