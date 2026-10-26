/** Open monument, not a filled box: retain the terrace, cloud and four external lifts. */

import { beam, beamPath } from './authored-structure-mesh.mjs';
import { face, grid, skylineExpansion, tri } from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

export const grandeArcheRuntimeAssetId = 'molen.worldgen.structure.grande_arche';
const pale = [0.87, 0.86, 0.82],
  metal = [0.66, 0.7, 0.72];
const ceiling = [
  [-35, 98.47, -56],
  [35, 98.47, -56],
  [35, 98.47, 56],
  [-35, 98.47, 56],
];

export function buildGrandeArcheCurrent(out) {
  skylineExpansion.find((s) => s.id === 'grande_arche').build(out);
  // Operator photographs show a panelled underside; preserve the original recipe above.
  grid(out, ceiling, [0.28, 0.35, 0.38], 2.8, 2.8, 0.21, [0.69, 0.71, 0.7]);
}

/** Preserve every non-cloud source face; resample only the curved fabric and thin cables. */
export function buildGrandeArcheStreet(out) {
  let cloud = false,
    skippedFabric = 0,
    reachedRoof = false;
  const relay = (method, slot, ref, points, normal, uv, color) => {
    if (slot === 'canvas') {
      cloud = true;
      skippedFabric++;
      return;
    }
    if (cloud && points.every((p) => p[1] >= 110.9)) {
      cloud = false;
      reachedRoof = true;
    }
    if (!cloud) out[method](slot, ref, points, normal, uv, color);
  };
  skylineExpansion
    .find((s) => s.id === 'grande_arche')
    .build({
      addTriangle: (...args) => relay('addTriangle', ...args),
      addQuad: (...args) => relay('addQuad', ...args),
      addConvexPolygon: (...args) => relay('addConvexPolygon', ...args),
    });
  if (skippedFabric !== 5472 || !reachedRoof)
    throw new Error('Grande Arche cloud source sequence changed');
  // Retain the soffit grid; reserve its projecting 8cm beam sections for close-up.
  grid(out, ceiling, [0.28, 0.35, 0.38], 2.8, 2.8, 0.14, [0.69, 0.71, 0.7]);
  for (const [cx, cz, rx, rz, raise] of [
    [-10, 17, 19, 15, 3],
    [10, 13, 18, 19, 7],
    [-4, -10, 23, 14, 5],
  ]) {
    const n = 12,
      point = (i, r) => {
        const a = (i * Math.PI * 2) / n;
        return [
          cx + rx * r * Math.cos(a),
          24 + raise * r * r + 3 * Math.sin(a * 2) * r,
          cz + rz * r * Math.sin(a),
        ];
      };
    for (let i = 0; i < n; i++) {
      const center = [point(i, 0), point(i + 1, 0.5), point(i, 0.5)];
      tri(out, 'canvas', center, pale);
      tri(out, 'canvas', center.toReversed(), pale);
      const rim = [point(i, 0.5), point(i + 1, 0.5), point(i + 1, 1), point(i, 1)];
      face(out, 'canvas', rim, pale);
      face(out, 'canvas', rim.toReversed(), pale);
      beam(out, 'metal', point(i, 1), point(i + 1, 1), 0.07, 0.07, metal);
    }
    for (const i of [0.75, 3.75, 6.75, 9.75]) {
      const p = point(i, 1);
      beam(out, 'metal', p, [p[0] < 0 ? -35 : 35, 48, p[2]], 0.14, 0.14, metal);
    }
  }
}

export function buildGrandeArcheSkyline(out) {
  buildOpenArche(out, false);
}
export function buildGrandeArcheDistrict(out) {
  buildOpenArche(out, true);
}
function buildOpenArche(out, district) {
  const w = 53.45,
    d = 56,
    h = 110.9;
  box(out, 'cladding', [-w, 0, -d], [-35, h, d], pale);
  box(out, 'cladding', [35, 0, -d], [w, h, d], pale);
  box(out, 'cladding', [-35, 98.5, -d], [35, h, d], pale);
  box(out, 'cladding', [-35, 0, -d], [35, 12.5, 29], pale);
  for (const x of [-w - 0.03, -34.97, 34.97, w + 0.03]) {
    const p = [
      [x, 2, -54.4],
      [x, 2, 54.4],
      [x, 108.9, 54.4],
      [x, 108.9, -54.4],
    ];
    const oriented = x < -50 || (x > 0 && x < 50) ? p : p.toReversed();
    if (district) grid(out, oriented, [0.28, 0.35, 0.38], 5.6, 5.6, 0.08, [0.69, 0.71, 0.7]);
    else face(out, 'glass', oriented, [0.28, 0.35, 0.38]);
  }
  if (district) grid(out, ceiling, [0.28, 0.35, 0.38], 5.6, 5.6, 0.08, [0.69, 0.71, 0.7]);
  else face(out, 'glass', ceiling, [0.28, 0.35, 0.38]);
  const steps = district ? 50 : 25;
  for (let i = 0; i < steps; i++)
    box(
      out,
      'cladding',
      [-35, 0, 56 - ((i + 1) * 27) / steps],
      [35, ((i + 1) * 12.5) / steps, 56 - (i * 27) / steps],
      pale,
    );
  for (const x of [-5.25, -1.75, 1.75, 5.25]) {
    for (const z of [-3, 0]) beam(out, 'metal', [x, 12.5, z], [x, 98.5, z], 0.19, 0.19, metal);
    if (district)
      for (let y = 12.5; y < 98.5; y += 13.6) {
        beam(out, 'metal', [x, y, -3], [x, Math.min(y + 13.6, 98.5), 0], 0.09, 0.09, metal);
        beam(out, 'metal', [x, y, 0], [x, Math.min(y + 13.6, 98.5), -3], 0.09, 0.09, metal);
      }
    const y = 26 + (x + 5.25) * 3.7;
    box(out, 'glass', [x - 1.35, y, -4.4], [x + 1.35, y + 3.5, -1.8], [0.35, 0.47, 0.5]);
  }
  for (const [cx, cz, rx, rz, raise] of [
    [-10, 17, 19, 15, 3],
    [10, 13, 18, 19, 7],
    [-4, -10, 23, 14, 5],
  ]) {
    const n = district ? 24 : 8,
      rings = district ? 4 : 2,
      point = (i, r) => {
        const a = (i * Math.PI * 2) / n;
        return [
          cx + rx * r * Math.cos(a),
          24 + raise * r * r + 3 * Math.sin(a * 2) * r,
          cz + rz * r * Math.sin(a),
        ];
      };
    for (let i = 0; i < n; i++) {
      const center = [point(i, 0), point(i + 1, 1 / rings), point(i, 1 / rings)];
      tri(out, 'canvas', center, pale);
      tri(out, 'canvas', center.toReversed(), pale);
      for (let j = 1; j < rings; j++) {
        const rim = [
          point(i, j / rings),
          point(i + 1, j / rings),
          point(i + 1, (j + 1) / rings),
          point(i, (j + 1) / rings),
        ];
        face(out, 'canvas', rim, pale);
        face(out, 'canvas', rim.toReversed(), pale);
      }
    }
    for (const i of district ? [1.5, 7.5, 13.5, 19.5] : [0, 2, 4, 6]) {
      const p = point(i, 1);
      beam(out, 'metal', p, [p[0] < 0 ? -35 : 35, 48, p[2]], 0.07, 0.07, metal);
    }
  }
  const ring = [
    [-52.45, h + 0.8, -55],
    [-52.45, h + 0.8, 55],
    [52.45, h + 0.8, 55],
    [52.45, h + 0.8, -55],
  ];
  beamPath(out, 'metal', ring.slice(0, 4), 0.055, 0.055, metal, true);
}
