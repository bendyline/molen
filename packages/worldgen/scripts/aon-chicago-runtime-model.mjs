/** Chicago Aon Center: continuous V piers, stone notches and an eastern roof mast. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'aon_center_chicago',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  white = [0.85, 0.86, 0.83],
  glass = [0.095, 0.15, 0.18],
  metal = [0.48, 0.52, 0.52];
const settings = {
  skyline: { floorStep: 0, mullions: false, ventStep: 0, mastN: 6, lattice: 0 },
  district: { floorStep: 8, mullions: false, ventStep: 1.8, mastN: 8, lattice: 0 },
  street: { floorStep: 3, mullions: true, ventStep: 0.9, mastN: 12, lattice: 4 },
  closeup: { floorStep: 1, mullions: true, ventStep: 0.3, mastN: 16, lattice: 1.6 },
};
function cleanPlan(plan) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < 0.14 &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(p) {
  return p
    .map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function build(out, level) {
  const c = settings[level],
    plan = cleanPlan(localOutline(map));
  mappedSolid(out, 'foundation', plan, 0, 0.22, white);
  for (const { a, b, len, n } of edges(plan)) {
    const at = (u, y, depth = 0) =>
      shift([a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u], n, depth);
    if (len <= 35) {
      // The photographs show solid granite returns, not office glazing around each notch.
      face(out, 'cladding', [at(0, 0.22), at(1, 0.22), at(1, 340), at(0, 340)], white);
      continue;
    }
    face(out, 'glass', [at(0, 0.22), at(1, 0.22), at(1, 340), at(0, 340)], glass);
    const count = 15,
      pitch = len / count,
      w = Math.min(0.69, pitch * 0.3),
      tx = (b[0] - a[0]) / len,
      tz = (b[1] - a[1]) / len;
    for (let i = 0; i <= count; i++) {
      const mid = lerp(a, b, i / count),
        left = [mid[0] - tx * w, mid[1] - tz * w],
        right = [mid[0] + tx * w, mid[1] + tz * w],
        apex = [mid[0] + n[0] * 0.58, mid[1] + n[2] * 0.58];
      for (const [p, q] of [
        [left, apex],
        [apex, right],
      ])
        face(
          out,
          'cladding',
          [
            [p[0], 0, p[1]],
            [q[0], 0, q[1]],
            [q[0], 340, q[1]],
            [p[0], 340, p[1]],
          ],
          white,
        );
    }
    // Bright lower lobby panes and a single upper mezzanine rail sit behind the full piers.
    face(
      out,
      'glass',
      [at(0, 0.22, 0.004), at(1, 0.22, 0.004), at(1, 10.4, 0.004), at(0, 10.4, 0.004)],
      [0.16, 0.24, 0.26],
    );
    if (c.floorStep) {
      for (let f = 0; f < 80; f += c.floorStep) {
        const y = 10.4 + (329.6 * f) / 80,
          h = Math.min(340, y + 0.4 * c.floorStep);
        face(
          out,
          'metal',
          [at(0, y, 0.012), at(1, y, 0.012), at(1, h, 0.012), at(0, h, 0.012)],
          [0.12, 0.17, 0.19],
        );
      }
      face(
        out,
        'metal',
        [at(0, 5.07, 0.025), at(1, 5.07, 0.025), at(1, 5.18, 0.025), at(0, 5.18, 0.025)],
        metal,
      );
    }
    if (c.mullions)
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count,
          half = 0.025 / len;
        face(
          out,
          'metal',
          [
            at(u - half, 0.22, 0.025),
            at(u + half, 0.22, 0.025),
            at(u + half, 340, 0.025),
            at(u - half, 340, 0.025),
          ],
          [0.24, 0.28, 0.29],
        );
      }
  }
  mappedCap(out, 'metal', plan, 340, [0.69, 0.7, 0.66]);
  for (const { a, b, n } of edges(plan))
    face(
      out,
      'cladding',
      [
        [a[0], 339.33, a[1]],
        [b[0], 339.33, b[1]],
        [b[0], 339.87, b[1]],
        [a[0], 339.87, a[1]],
      ].map((p) => shift(p, n, 0.4)),
      white,
    );
  const roof = cleanPlan(
    partPlan(
      map,
      map.elements.find((p) => p.id === 284775635),
    ),
  );
  mappedSolid(out, 'cladding', roof, 340, 346.3, [0.71, 0.73, 0.7]);
  for (const { a, b, len, n } of edges(roof)) {
    if (c.ventStep)
      for (let y = 341; y < 345.9; y += c.ventStep) {
        const at = (p, y) => shift([p[0], y, p[1]], n, 0.085);
        face(
          out,
          'metal',
          [
            at(a, y - (0.05 * c.ventStep) / 0.3),
            at(b, y - (0.05 * c.ventStep) / 0.3),
            at(b, y + (0.05 * c.ventStep) / 0.3),
            at(a, y + (0.05 * c.ventStep) / 0.3),
          ],
          [0.34, 0.4, 0.4],
        );
      }
    const count = Math.ceil(len / 2.8);
    for (let i = 0; c.ventStep && i <= count; i++) {
      const p = lerp(a, b, i / count);
      beam(out, 'cladding', [p[0], 340, p[1]], [p[0], 346.3, p[1]], 0.3, 0.3, white);
    }
  }
  for (const z of [-22.5, 20.5])
    for (const x of [-15, -5, 5, 15])
      box(out, 'metal', [x - 2, 340, z - 1.3], [x + 2, 342.2, z + 1.3], [0.5, 0.55, 0.54]);
  const [x, z] = scope.sourceFacts.antennaLocal;
  // A short, faceted transmitter radome over a three-legged steel support.
  if (c.lattice) {
    const p = Array.from({ length: 3 }, (_, i) => [
      x + Math.cos((i * Math.PI * 2) / 3) * 1.1,
      346.3,
      z + Math.sin((i * Math.PI * 2) / 3) * 1.1,
    ]);
    for (const q of p)
      beam(out, 'metal', q, [x + (q[0] - x) * 0.3, 350.2, z + (q[2] - z) * 0.3], 0.12, 0.12, metal);
    for (let y = 346.3; y < 350; y += Math.min(1.6, c.lattice)) {
      const lo = p.map((q) => [
          x + (q[0] - x) * (1 - (0.7 * (y - 346.3)) / 3.9),
          y,
          z + (q[2] - z) * (1 - (0.7 * (y - 346.3)) / 3.9),
        ]),
        hi = Math.min(350.2, y + Math.min(1.6, c.lattice));
      for (let i = 0; i < 3; i++)
        beam(
          out,
          'metal',
          lo[i],
          [
            x + (p[(i + 1) % 3][0] - x) * (1 - (0.7 * (hi - 346.3)) / 3.9),
            hi,
            z + (p[(i + 1) % 3][2] - z) * (1 - (0.7 * (hi - 346.3)) / 3.9),
          ],
          0.08,
          0.08,
          metal,
        );
    }
  } else
    loft(
      out,
      'metal',
      [
        radialRing(346.3, 1.1, 1.1, c.mastN, [x, z]),
        radialRing(350.2, 0.34, 0.34, c.mastN, [x, z]),
      ],
      metal,
    );
  loft(
    out,
    'metal',
    [
      radialRing(350.2, 0.46, 0.46, c.mastN, [x, z]),
      radialRing(361.9, 0.34, 0.34, c.mastN, [x, z]),
      radialRing(362.5, 0.12, 0.12, c.mastN, [x, z]),
    ],
    [0.74, 0.76, 0.72],
  );
}
function skylineOutput(out) {
  const result = {};
  for (const name of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    result[name] = (slot, _ref, p, n, uv, color) => {
      const mean = scope.sourceFacts.surfaceMeans[scope.surfaceOverrides[slot]?.graph] ?? [1, 1, 1];
      out[name](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    };
  return result;
}
export const buildAonChicagoSkyline = (out) => build(skylineOutput(out), 'skyline');
export const buildAonChicagoDistrict = (out) => build(out, 'district');
export const buildAonChicagoStreet = (out) => build(out, 'street');
export const buildAonChicagoCloseup = (out) => build(out, 'closeup');
export const buildAonChicagoReviewedMaster = (out) => build(out, 'closeup');
