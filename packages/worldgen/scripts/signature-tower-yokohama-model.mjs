/** Yokohama Landmark Tower: tapered, four-corner lantern and folded transition floors. */
import { beam } from './authored-structure-mesh.mjs';
import { face, grid, mappedCap, mappedSolid, tri } from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const granite = [0.57, 0.565, 0.535],
  glass = [0.16, 0.205, 0.205],
  metal = [0.47, 0.5, 0.5];
const rotate = ([x, y, z], side) => {
  const a = (side * Math.PI) / 2;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
};
const shifted = (p, n, d) => p.map((v, i) => v + n[i] * d);
const levels = [
  [0, 37.2, 25, 20.5, 4.8],
  [24, 36.8, 24.6, 20.2, 5],
  [83.5, 33.16, 19.8, 16.05, 4.1],
  [126, 31.45, 18.5, 14.5, 4.3],
  [199, 29.2, 17.3, 13.4, 4.6],
  [211, 28.9, 16.9, 12.1, 9.2],
  [272, 28.05, 16.8, 12.0, 8.8],
  [296.3, 28.05, 16.8, 12, 8.8],
];
function dimensions(y) {
  for (let i = 1; i < levels.length; i++)
    if (y <= levels[i][0]) {
      const a = levels[i - 1],
        b = levels[i],
        t = (y - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t);
    }
  return levels.at(-1).slice(1);
}
function plan(y) {
  const [r, a, b, d] = dimensions(y),
    p = [];
  for (let side = 0; side < 4; side++)
    for (const [x, z] of [
      [-r, r],
      [-a, r],
      [-b, r - d],
      [b, r - d],
      [a, r],
    ]) {
      const q = rotate([x, y, z], side);
      p.push([q[0], q[2]]);
    }
  return p;
}
function point(edge, t, y) {
  const p = plan(y),
    a = p[edge],
    b = p[(edge + 1) % 20];
  return [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
}
function normal(edge, y) {
  const a = point(edge, 0, y),
    b = point(edge, 1, y),
    l = Math.hypot(b[0] - a[0], b[2] - a[2]);
  return [-(b[2] - a[2]) / l, 0, (b[0] - a[0]) / l];
}
function surface(out, edge, u0, u1, y0, y1, slot, color, depth = 0) {
  const n = normal(edge, (y0 + y1) / 2),
    p = [point(edge, u0, y0), point(edge, u1, y0), point(edge, u1, y1), point(edge, u0, y1)].map(
      (p) => shifted(p, n, depth),
    );
  face(out, slot, p, color);
  return p;
}
function reveal(out, edge, u0, u1, y0, y1, color, depth = 0.18) {
  const n = normal(edge, (y0 + y1) / 2),
    p = [point(edge, u0, y0), point(edge, u1, y0), point(edge, u1, y1), point(edge, u0, y1)],
    q = p.map((p) => shifted(p, n, -depth));
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(out, 'cladding', [p[i], p[k], q[k], q[i]], color);
  }
  return q;
}
function band(out, edge, y0, y1, projection = 0.14) {
  const n = normal(edge, (y0 + y1) / 2),
    p = [point(edge, 0, y0), point(edge, 1, y0), point(edge, 1, y1), point(edge, 0, y1)],
    q = p.map((p) => shifted(p, n, projection));
  face(out, 'cladding', q, granite);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(out, 'cladding', [p[i], q[i], q[k], p[k]], granite);
  }
  const len = Math.hypot(...p[1].map((v, i) => v - p[0][i]));
  for (let i = 1; i < Math.ceil(len / 1.25); i++) {
    const u = i / Math.ceil(len / 1.25);
    surface(
      out,
      edge,
      u - 0.0006,
      u + 0.0006,
      y0 + 0.015,
      y1 - 0.015,
      'recess',
      [0.31, 0.31, 0.3],
      projection + 0.008,
    );
  }
}
function floor(out, edge, y0, y1, hotel = false) {
  const kind = edge % 5,
    corner = kind === 0 || kind === 4,
    height = y1 - y0;
  let u0 = 0,
    u1 = 1;
  // The heavy corner piers have narrow slit windows; broad ribbons turn through the inset faces.
  if (corner) {
    u0 = kind === 0 ? 0.7 : 0.02;
    u1 = kind === 0 ? 0.98 : 0.3;
  }
  const bottom = y0 + (hotel ? 0.5 : 1.75),
    top = y1 - 0.36;
  if (bottom >= top) {
    band(out, edge, y0, y1);
    return;
  }
  if (u0 > 0) surface(out, edge, 0, u0, y0, y1, 'cladding', granite);
  if (u1 < 1) surface(out, edge, u1, 1, y0, y1, 'cladding', granite);
  surface(out, edge, u0, u1, y0, bottom, 'cladding', granite);
  surface(out, edge, u0, u1, top, y1, 'cladding', granite);
  const q = reveal(out, edge, u0, u1, bottom, top, granite, hotel ? 0.09 : 0.24);
  grid(out, q, hotel ? [0.21, 0.265, 0.27] : glass, hotel ? 1.55 : 1.7, height, 0.055, metal);
  // Closed projecting sill and fascia retain the characteristic horizontally ribbed silhouette.
  if (!corner) band(out, edge, y0, y0 + (hotel ? 0.23 : 0.36), hotel ? 0.075 : 0.24);
  else {
    for (let y = y0 + 0.55; y < y1 - 0.1; y += 1.18)
      surface(out, edge, 0, 1, y, y + 0.018, 'recess', [0.35, 0.35, 0.335], 0.006);
    for (const u of [0.25, 0.5, 0.75])
      surface(out, edge, u - 0.0008, u + 0.0008, y0, y1, 'recess', [0.36, 0.36, 0.34], 0.007);
  }
}
function folds(out, side, y0, y1, count) {
  const edge = side * 5 + 2,
    [, , b] = dimensions((y0 + y1) / 2);
  const at = (x, y, projection) => {
    const [r, , , d] = dimensions(y);
    return rotate([x, y, r - d + projection], side);
  };
  // Four triangular, creased metal/stone-like panels stand in front of recessed horizontal louvers.
  surface(out, edge, 0, 1, y0, y1, 'recess', [0.075, 0.09, 0.09], -0.24);
  for (let y = y0 + 0.25; y < y1; y += 0.46) {
    const a = at(-dimensions(y)[2], y, -0.1),
      c = at(dimensions(y)[2], y, -0.1);
    beam(out, 'metal', a, c, 0.07, 0.16, metal);
  }
  for (let i = 0; i < count; i++) {
    const x0 = -b + (i * 2 * b) / count + 0.12,
      x1 = -b + ((i + 1) * 2 * b) / count - 0.12,
      mid = (x0 + x1) / 2;
    const a = at(x0, y0 + 0.18, 0.25),
      c = at(x1, y0 + 0.18, 0.25),
      tip = at(mid, y1 - 0.18, 0.15),
      ridge = at(mid, y0 + 0.18, 1.9);
    tri(out, 'metal', [a, ridge, tip], [0.66, 0.66, 0.615]);
    tri(out, 'metal', [ridge, c, tip], [0.51, 0.54, 0.52]);
    tri(out, 'metal', [a, c, ridge], [0.42, 0.44, 0.43]);
    for (const [from, to] of [
      [a, tip],
      [tip, c],
      [a, ridge],
      [ridge, c],
      [ridge, tip],
    ])
      tube(out, 'stainless', from, to, 0.043, [0.63, 0.65, 0.64], 6);
  }
  band(out, edge, y0 - 0.55, y0 + 0.05, 0.5);
  band(out, edge, y1, y1 + 0.42, 0.18);
}
function crown(out) {
  const r = dimensions(280)[0];
  // Four L-shaped piers retain a genuinely recessed central roof, instead of a solid squared cap.
  for (let side = 0; side < 4; side++) {
    const local = [
      [-r, r],
      [-16.8, r],
      [-12, 19.25],
      [-19.25, 12],
      [-r, 16.8],
    ].map(([x, z]) => {
      const q = rotate([x, 0, z], side);
      return [q[0], q[2]];
    });
    mappedSolid(out, 'cladding', local, 280, 296.3, granite);
    for (let y = 281; y < 296; y += 1.15)
      for (let j = 0; j < local.length; j++) {
        const a = local[j],
          b = local[(j + 1) % local.length],
          n = [-(b[1] - a[1]), 0, b[0] - a[0]],
          l = Math.hypot(n[0], n[2]);
        if (l < 0.01) continue;
        const nn = n.map((v) => v / l);
        face(
          out,
          'recess',
          [
            [a[0], y, a[1]],
            [b[0], y, b[1]],
            [b[0], y + 0.023, b[1]],
            [a[0], y + 0.023, a[1]],
          ].map((p) => shifted(p, nn, 0.012)),
          [0.3, 0.315, 0.3],
        );
      }
    const edge = side * 5 + 2;
    for (const [lo, hi, depth] of [
      [280, 282.7, 0.9],
      [285.2, 287.6, 1.4],
      [289.3, 291, 0.9],
    ]) {
      band(out, edge, lo, hi, depth);
      face(
        out,
        'cladding',
        [point(edge, 0, lo), point(edge, 0, hi), point(edge, 1, hi), point(edge, 1, lo)],
        granite,
      );
    }
    for (const [lo, hi] of [
      [282.7, 285.2],
      [287.6, 289.3],
    ])
      surface(out, edge, 0, 1, lo, hi, 'recess', [0.07, 0.095, 0.1], -0.8);
  }
  mappedCap(out, 'concrete', plan(280), 280, [0.28, 0.3, 0.29]);
  // A closed mechanical roof and restrained visible plant stay below the architectural tips.
  box(out, 'concrete', [-11.5, 280, -11.5], [11.5, 286.5, 11.5], [0.37, 0.39, 0.37]);
  for (const x of [-6, 0, 6])
    for (const z of [-5, 5]) {
      box(out, 'metal', [x - 2, 286.5, z - 1.4], [x + 2, 288.6, z + 1.4], [0.4, 0.45, 0.45]);
      for (let i = 0; i < 7; i++)
        box(
          out,
          'recess',
          [x - 1.85 + i * 0.55, 288.605, z - 1.2],
          [x - 1.58 + i * 0.55, 288.63, z + 1.2],
          [0.12, 0.15, 0.15],
        );
    }
  for (const x of [-7, 7]) {
    tube(out, 'stainless', [x, 286.5, 0], [x, 294.3, 0], 0.105, metal, 10);
    for (const y of [290, 292])
      beam(out, 'metal', [x - 0.7, y, 0], [x + 0.7, y, 0], 0.06, 0.06, metal);
  }
}
function ground(out) {
  const base = plan(0);
  mappedSolid(out, 'foundation', base, 0, 0.22, [0.36, 0.37, 0.35]);
  for (let edge = 0; edge < 20; edge++) {
    const kind = edge % 5;
    if (kind === 2) {
      const q = [
        point(edge, 0, 0.22),
        point(edge, 1, 0.22),
        point(edge, 1, 14),
        point(edge, 0, 14),
      ];
      grid(out, q, [0.13, 0.19, 0.18], 1.9, 3.3, 0.12, metal);
      band(out, edge, 14, 16.1, 0.42);
      surface(out, edge, 0, 1, 16.1, 23.4, 'cladding', granite);
      // Glazed entry doors are restricted to the tower; adjoining retail wings are separate assets.
      const side = Math.floor(edge / 5),
        d = dimensions(0)[0] - dimensions(0)[3],
        width = 11.5;
      for (let i = -2; i <= 2; i++) {
        const x = i * 2.15,
          at = (xx, y, zz) => rotate([xx, y, zz], side);
        face(
          out,
          'glass',
          [
            at(x - 0.98, 0.22, d + 0.03),
            at(x + 0.98, 0.22, d + 0.03),
            at(x + 0.98, 3.7, d + 0.03),
            at(x - 0.98, 3.7, d + 0.03),
          ],
          [0.23, 0.31, 0.3],
        );
        for (const xx of [x - 0.98, x + 0.98])
          beam(
            out,
            'stainless',
            at(xx, 0.22, d + 0.11),
            at(xx, 3.7, d + 0.11),
            0.065,
            0.065,
            metal,
          );
        tube(
          out,
          'stainless',
          at(x + 0.67, 1.05, d + 0.18),
          at(x + 0.67, 1.9, d + 0.18),
          0.025,
          metal,
          6,
        );
      }
      // Shallow greenish glazed weather canopy with physical cross-bars and supported ends.
      const at = (x, y, z) => rotate([x, y, z], side);
      face(
        out,
        'glass',
        [
          at(-width, 4.5, d),
          at(width, 4.5, d),
          at(width, 4.05, d + 3.1),
          at(-width, 4.05, d + 3.1),
        ],
        [0.31, 0.39, 0.36],
      );
      for (let x = -width; x <= width + 0.01; x += width / 6)
        beam(out, 'metal', at(x, 4.5, d), at(x, 4.05, d + 3.1), 0.12, 0.17, metal);
      for (const z of [d, d + 3.1])
        beam(
          out,
          'metal',
          at(-width, z === d ? 4.5 : 4.05, z),
          at(width, z === d ? 4.5 : 4.05, z),
          0.17,
          0.2,
          metal,
        );
      for (const x of [-width, width])
        tube(out, 'stainless', at(x, 0.22, d + 2.65), at(x, 4.14, d + 2.65), 0.12, metal, 12);
    } else {
      surface(out, edge, 0, 1, 0.22, 23.4, 'cladding', granite);
      for (let y = 1.5; y < 23; y += 1.25)
        surface(out, edge, 0, 1, y, y + 0.018, 'recess', [0.33, 0.34, 0.32], 0.008);
      if (kind === 0 || kind === 4)
        for (let y = 8; y < 22; y += 5) {
          const u = kind === 0 ? 0.77 : 0.23;
          surface(out, edge, u - 0.09, u + 0.09, y, y + 0.5, 'recess', [0.12, 0.15, 0.14], 0.025);
        }
    }
  }
}
export function buildYokohama(out) {
  ground(out);
  for (const [start, end, count, hotel] of [
    [32, 120, 22, false],
    [132, 200, 17, false],
    [211, 276, 18, true],
    [276, 280, 1, true],
  ])
    for (let j = 0; j < count; j++)
      for (let edge = 0; edge < 20; edge++)
        floor(
          out,
          edge,
          start + ((end - start) * j) / count,
          start + ((end - start) * (j + 1)) / count,
          hotel,
        );
  for (const [lo, hi, count] of [
    [24, 31.58, 4],
    [121, 131.58, 4],
    [201, 210.58, 3],
  ])
    for (let side = 0; side < 4; side++) {
      folds(out, side, lo, hi, count);
      for (const j of [0, 1, 3, 4]) {
        const edge = side * 5 + j;
        for (let y = lo - 0.6; y < hi + 0.42; y += 1.2)
          band(out, edge, y, Math.min(y + 1.2, hi + 0.42), 0.03);
        if (j === 0 || j === 4)
          for (let y = lo + 1; y < hi - 1; y += 2.8) {
            const u = j === 0 ? 0.78 : 0.22;
            surface(out, edge, u - 0.1, u + 0.1, y, y + 0.64, 'recess', [0.08, 0.105, 0.1], 0.06);
          }
      }
    }
  // Narrow closures between the large transition feature and the repeating occupied floors.
  for (const [lo, hi] of [
    [23.4, 23.45],
    [31.999, 32],
    [120, 120.45],
    [131.999, 132],
    [200, 200.45],
    [210.999, 211],
  ])
    for (let edge = 0; edge < 20; edge++) surface(out, edge, 0, 1, lo, hi, 'cladding', granite);
  crown(out);
}
