/** Skyline resampling of the retained detailed five-petal skin; no duplicate taper recipe. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loft, radialRing } from './authored-structure-mesh.mjs';
import { face, localOutline, mappedCap, mappedSolid } from './signature-tower-expansion-models.mjs';
import { skylineNext } from './signature-tower-next-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export const lakhtaSkylineAssetId = 'molen.worldgen.structure.lakhta_centre';
const frame = JSON.parse(
  readFileSync(structureSourcePath('lakhta_centre', 'map-frame.json'), 'utf8'),
);

export function lakhtaSkinRows() {
  const triangles = [];
  skylineNext
    .find((s) => s.id === 'lakhta_centre')
    .build(
      {
        addQuad(component) {
          assert.notEqual(component, 'glass');
        },
        addConvexPolygon(component) {
          assert.notEqual(component, 'glass');
        },
        addTriangle(component, _ref, points) {
          if (component === 'glass') triangles.push(points);
        },
      },
      frame,
    );
  const rows = [];
  for (let i = 0; i < triangles.length; i += 2) {
    const [a, b] = [triangles[i], triangles[i + 1]];
    assert.deepEqual(a[0], b[0]);
    assert.deepEqual(a[2], b[1]);
    const quad = [a[0], a[1], a[2], b[2]];
    if (rows.at(-1)?.[0][0][1] !== quad[0][1]) rows.push([]);
    rows.at(-1).push(quad);
  }
  assert.equal(rows.length, 39);
  assert(rows.every((row) => row.length === 20));
  return rows;
}

export function buildLakhtaSkyline(out) {
  const plan = localOutline(frame),
    rows = lakhtaSkinRows();
  mappedSolid(out, 'wall', plan, 0, 0.25, [0.42, 0.46, 0.48]);
  for (let i = 0; i < rows.length; i += 2) {
    const first = rows[i],
      last = rows[Math.min(i + 1, rows.length - 1)];
    for (let cell = 0; cell < first.length; cell++)
      face(
        out,
        'wall',
        [first[cell][0], first[cell][1], last[cell][2], last[cell][3]],
        [0.32, 0.46, 0.53],
      );
  }
  const roof = rows
    .at(-1)
    .filter((_, i) => i % 2 === 0)
    .map((q) => [q[3][0], q[3][2]]);
  mappedCap(out, 'wall', roof, 449, [0.67, 0.72, 0.75]);
  const tips = plan.filter((_, i) => i % 2 === 0);
  const center = tips.reduce((s, p) => s.map((v, i) => v + p[i] / tips.length), [0, 0]);
  loft(
    out,
    'wall',
    [
      [448.8, 1.08],
      [452, 0.79],
      [458, 0.32],
      [462, 0.025],
    ].map(([y, r]) => radialRing(y, r, r, 8, center)),
    [0.73, 0.77, 0.79],
  );
}
