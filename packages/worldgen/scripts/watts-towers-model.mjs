/** Original Watts Towers exterior, from City Archives engineering drawings, NPS and LACMA conservation records. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cross, loft, normalize, radialRing, sphere } from './authored-structure-mesh.mjs';
import { annulus, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(
  readFileSync(structureSourcePath('n0613_watts_towers', 'map-frame.json'), 'utf8'),
);
const tau = Math.PI * 2,
  stucco = [0.56, 0.565, 0.52],
  cream = [0.78, 0.76, 0.65],
  rose = [0.64, 0.48, 0.4];
const palette = [
  [0.87, 0.87, 0.79],
  [0.04, 0.28, 0.29],
  [0.09, 0.34, 0.15],
  [0.025, 0.13, 0.3],
  [0.63, 0.39, 0.13],
  [0.65, 0.26, 0.18],
  [0.38, 0.56, 0.53],
  [0.79, 0.67, 0.38],
  [0.22, 0.24, 0.21],
  [0.7, 0.57, 0.65],
];
const rand = (n) => {
  const x = Math.sin(n * 12.9898 + 31.417) * 43758.5453;
  return x - Math.floor(x);
};
let serial = 1;
const lerp = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);
function tube(out, points, r = 0.047, color = stucco, mosaic = true, sides = 8) {
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1],
      b = points[j],
      axis = normalize(b.map((v, i) => v - a[i]));
    if (Math.hypot(...b.map((v, i) => v - a[i])) < 1e-5) continue;
    const u = normalize(cross(axis, Math.abs(axis[1]) < 0.94 ? [0, 1, 0] : [1, 0, 0])),
      v = cross(axis, u),
      k = serial++;
    const ring = (p, t) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = (tau * i) / sides;
        const rr = r * (1 + 0.055 * Math.sin(k * 0.8 + i * 1.8 + t));
        return p.map((n, d) => n + rr * (u[d] * Math.cos(angle) + v[d] * Math.sin(angle)));
      });
    const aa = ring(a, 0),
      bb = ring(b, 1);
    loft(out, 'concrete', [aa, bb], color);
    if (mosaic && a[1] < 19) {
      for (let s = 0; s < sides; s++)
        if (rand(k * 3 + s * 71) > (a[1] < 5 ? 0.23 : 0.63)) {
          const sn = (s + 1) % sides,
            t0 = 0.12 + rand(k + s) * 0.18,
            t1 = 0.6 + rand(k * 2 + s) * 0.28;
          const p = [
            lerp(aa[s], bb[s], t0),
            lerp(aa[sn], bb[sn], t0 + 0.025),
            lerp(aa[sn], bb[sn], t1),
            lerp(aa[s], bb[s], t1 - 0.06),
          ];
          const n = normalize(p[0].map((q, i) => q - lerp(a, b, t0)[i]));
          face(
            out,
            'glass',
            p.map((q) => q.map((z, i) => z + n[i] * 0.003)),
            palette[Math.floor(rand(k + s * 7) * palette.length)],
          );
        }
    }
  }
}
function path(out, fn, n, r = 0.05, col = stucco, mosaic = true) {
  tube(
    out,
    Array.from({ length: n + 1 }, (_, i) => fn(i / n)),
    r,
    col,
    mosaic,
  );
}
function ring(out, x, y, z, r, thick = 0.046, col = stucco, mosaic = true) {
  path(
    out,
    (t) => [
      x + Math.cos(t * tau) * r,
      y + 0.025 * Math.sin(t * tau * 3),
      z + Math.sin(t * tau) * r,
    ],
    Math.max(16, Math.ceil(r * 30)),
    thick,
    col,
    mosaic,
  );
}
function vertical(out, x, z, y0, y1, r = 0.055) {
  path(
    out,
    (t) => [x + 0.017 * Math.sin(t * 11), y0 + (y1 - y0) * t, z + 0.012 * Math.sin(t * 17)],
    Math.ceil((y1 - y0) / 0.32),
    r,
  );
}
function mosaicFace(out, pts, seed, scale = 0.13) {
  const a = pts[0],
    b = pts[1],
    d = pts[3],
    u = b.map((n, i) => n - a[i]),
    v = d.map((n, i) => n - a[i]);
  const nx = Math.ceil(Math.hypot(...u) / scale),
    ny = Math.ceil(Math.hypot(...v) / scale);
  const normal = normalize(cross(u, v));
  for (let row = 0; row < ny; row++)
    for (let col = 0; col < nx; col++) {
      const id = seed + row * nx + col,
        t0 = (col + 0.09) / nx,
        t1 = (col + 0.93) / nx,
        s0 = (row + 0.1) / ny,
        s1 = (row + 0.91) / ny;
      const p = (t, s) => a.map((n, i) => n + u[i] * t + v[i] * s + normal[i] * 0.006);
      const q = [
        p(t0 + (rand(id + 1) * 0.15) / nx, s0),
        p(t1, s0 + (rand(id + 2) * 0.17) / ny),
        p(t1 - (rand(id + 3) * 0.14) / nx, s1),
        p(t0, s1 - (rand(id + 4) * 0.16) / ny),
      ];
      const color = palette[Math.floor(rand(id) * palette.length)];
      if (rand(id + 831) < 0.31) {
        triangle(out, 'glass', [q[0], q[1], q[3]], color);
        triangle(
          out,
          'glass',
          [q[1], q[2], q[3]],
          palette[Math.floor(rand(id + 13) * palette.length)],
        );
      } else face(out, 'glass', q, color);
    }
}
function mosaicCylinder(out, x, z, r, y0, y1, seed, scale = 0.12) {
  const count = Math.max(16, Math.ceil((tau * r) / scale));
  for (let i = 0; i < count; i++) {
    const a = (-i * tau) / count,
      b = (-(i + 1) * tau) / count;
    mosaicFace(
      out,
      [
        [x + Math.cos(a) * r, y0, z + Math.sin(a) * r],
        [x + Math.cos(b) * r, y0, z + Math.sin(b) * r],
        [x + Math.cos(b) * r, y1, z + Math.sin(b) * r],
        [x + Math.cos(a) * r, y1, z + Math.sin(a) * r],
      ],
      seed + i * 87,
      scale,
    );
  }
}
function base(out, x, z, r, h, kind) {
  const profiles =
    kind === 'west'
      ? [
          [0, r],
          [0.2, r],
          [0.24, r * 0.89],
          [0.62, r * 0.89],
          [0.68, r * 0.75],
          [1.13, r * 0.75],
          [1.21, r * 0.56],
          [h, r * 0.2],
        ]
      : kind === 'center'
        ? [
            [0, r],
            [0.31, r],
            [0.5, r * 0.95],
            [1.15, r * 0.76],
            [1.87, r * 0.43],
            [h, 0.24],
          ]
        : [
            [0, r],
            [0.22, r],
            [0.33, r * 0.79],
            [h, r * 0.65],
          ];
  loft(
    out,
    'concrete',
    profiles.map(([y, rr]) => radialRing(y, rr, rr, 64, [x, z])),
    stucco,
  );
  for (let j = 1; j < profiles.length; j++) {
    const [ya, ra] = profiles[j - 1],
      [yb, rb] = profiles[j];
    for (let i = 0; i < 64; i++) {
      const a = (-i * tau) / 64,
        b = (-(i + 1) * tau) / 64;
      mosaicFace(
        out,
        [
          [x + Math.cos(a) * ra, ya, z + Math.sin(a) * ra],
          [x + Math.cos(b) * ra, ya, z + Math.sin(b) * ra],
          [x + Math.cos(b) * rb, yb, z + Math.sin(b) * rb],
          [x + Math.cos(a) * rb, yb, z + Math.sin(a) * rb],
        ],
        i * 129 + j * 17,
        0.12,
      );
    }
  }
  // LACMA close views show raised shells and bottle ends embedded between the flat ceramic shards.
  for (let row = 0; row < Math.floor(h / 0.16); row++) {
    const y = 0.14 + row * 0.16;
    const index = profiles.findIndex(([yy]) => yy > y);
    if (index < 1) continue;
    const [ya, ra] = profiles[index - 1],
      [yb, rb] = profiles[index];
    const rr = ra + ((rb - ra) * (y - ya)) / (yb - ya),
      count = Math.max(12, Math.floor((tau * rr) / 0.15));
    for (let j = 0; j < count; j++) {
      const a = (tau * (j + 0.32 * (row % 2))) / count,
        id = j + row * 117;
      if (rand(id) < 0.43) continue;
      const o = transform(out, Math.PI / 2 - a, [
        x + Math.cos(a) * (rr + 0.006),
        y,
        z + Math.sin(a) * (rr + 0.006),
      ]);
      sphere(
        o,
        rand(id + 66) < 0.23 ? 'glass' : 'carvedstone',
        [0, 0, 0],
        [0.03 + rand(id + 2) * 0.012, 0.03 + rand(id + 3) * 0.012, 0.025],
        rand(id + 66) < 0.23 ? [0.045, 0.22, 0.09] : cream,
        8,
        4,
      );
    }
  }
  if (kind === 'west')
    for (let k = 0; k < 4; k++) {
      const w = 1.2 - k * 0.13,
        y = k * 0.19;
      box(
        out,
        'concrete',
        [x - w / 2, y, z + r - 0.13 - k * 0.25],
        [x + w / 2, y + 0.19, z + r + 0.26 - k * 0.25],
        [0.61, 0.39, 0.28],
      );
      mosaicFace(
        out,
        [
          [x - w / 2, y, z + r + 0.27 - k * 0.25],
          [x + w / 2, y, z + r + 0.27 - k * 0.25],
          [x + w / 2, y + 0.18, z + r + 0.27 - k * 0.25],
          [x - w / 2, y + 0.18, z + r + 0.27 - k * 0.25],
        ],
        k * 79,
        0.095,
      );
    }
}
function lattice(
  out,
  { x, z, y0, height, radius, legs, bands, phase = 0, thin = 0.044, inner = false },
) {
  const rr = (t) => radius * Math.pow(1 - t, 1.03) + 0.018;
  for (let j = 0; j < legs; j++) {
    const a = (j * tau) / legs + phase;
    path(
      out,
      (t) => {
        const r = rr(t);
        return [
          x + Math.cos(a + 0.018 * Math.sin(t * 7 + j)) * r,
          y0 + (height - y0) * t,
          z + Math.sin(a + 0.018 * Math.sin(t * 7 + j)) * r,
        ];
      },
      Math.ceil((height - y0) / 0.27),
      thin,
    );
  }
  for (let i = 0; i < bands; i++) {
    const t = (i / (bands - 1)) * 0.976,
      y = y0 + (height - y0) * t,
      r = rr(t);
    ring(out, x, y, z, r, thin * 0.84);
    if (i < bands - 1 && !inner && i % 2 === 0) {
      const t2 = ((i + 1) / (bands - 1)) * 0.976,
        y2 = y0 + (height - y0) * t2,
        r2 = rr(t2);
      for (let j = 0; j < legs; j += 2) {
        const a = (j * tau) / legs + phase,
          b = ((j + 1) * tau) / legs + phase;
        path(
          out,
          (v) =>
            lerp(
              [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
              [x + Math.cos(b) * r2, y2, z + Math.sin(b) * r2],
              v,
            ),
          3,
          thin * 0.62,
        );
      }
    }
  }
  vertical(out, x, z, height - 0.5, height + 0.08, thin * 0.7);
}
function principal(out, name) {
  const [x, z] = map.components[name].local;
  const west = name === 'west',
    center = name === 'center';
  const h = west ? 30.327 : center ? 29.5148 : 17.3736,
    r = west ? 2.286 : center ? 2.0574 : 1.3716;
  base(out, x, z, r, west ? 2.43 : center ? 2.4384 : 0.9144, name);
  lattice(out, {
    x,
    z,
    y0: 0.85,
    height: h - 0.08,
    radius: r * 0.96,
    legs: west ? 16 : center ? 8 : 6,
    bands: west ? 46 : center ? 49 : 32,
    phase: 0.2,
    thin: west ? 0.052 : 0.047,
  });
  lattice(out, {
    x,
    z,
    y0: 1.2,
    height: west ? 26.6 : center ? 22.6 : 15.2,
    radius: r * 0.57,
    legs: 8,
    bands: west ? 42 : 38,
    phase: 0.43,
    thin: 0.032,
    inner: true,
  });
  if (center || west)
    lattice(out, {
      x,
      z,
      y0: 1.8,
      height: center ? 19.81 : 21.0,
      radius: r * 0.29,
      legs: 8,
      bands: 31,
      phase: 0.1,
      thin: 0.031,
      inner: true,
    });
  vertical(out, x, z, 1.6, h, 0.033);
  if (west) {
    for (let i = 0; i < 18; i++) {
      const y = 3.55 + i * 1.28,
        rr = r * (1 - y / h) + 0.6,
        angle = 0.1 * Math.sin(i * 0.85);
      path(
        out,
        (t) => {
          const a = t * tau,
            q = Math.cos(a) * rr;
          return [x + q * Math.cos(angle), y + Math.sin(a) * 0.86, z + q * Math.sin(angle)];
        },
        50,
        0.047,
        stucco,
        true,
      );
    }
  }
  if (center)
    for (let a = 0; a < 8; a++) {
      const angle = (a * tau) / 8;
      path(
        out,
        (t) => {
          const q = Math.sin(t * tau) * 0.36,
            rr = r * 0.84 + 0.43 * Math.cos(t * tau);
          return [
            x + Math.cos(angle) * rr - Math.sin(angle) * q,
            5.6 + Math.sin(t * tau) * 0.86,
            z + Math.sin(angle) * rr + Math.cos(angle) * q,
          ];
        },
        36,
        0.05,
      );
    }
  // The north-face ladders are discrete bands rather than an opaque cone.
  for (let y = 2; y < h * 0.94; y += 0.53) {
    const rr = r * Math.pow(1 - y / h, 1.03),
      w = rr * 0.7;
    path(out, (t) => [x - w + 2 * w * t, y, z - rr], 2, 0.031);
  }
}
function heart(out, x, y, z, w, h, angle = 0, r = 0.035) {
  path(
    out,
    (t) => {
      const a = t * tau,
        s = Math.sin(a),
        u = (w * s * s * s) / 2,
        v =
          (h * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))) /
          30;
      return [x + u * Math.cos(angle), y + v, z + u * Math.sin(angle)];
    },
    52,
    r,
    cream,
  );
}
function connection(out) {
  const a = map.components.center.local,
    b = map.components.east.local,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    ang = Math.atan2(dz, dx),
    cx = (a[0] + b[0]) / 2,
    cz = (a[1] + b[1]) / 2;
  for (let i = 0; i < 15; i++) {
    const y = 3.2 + i * 0.84,
      w = len - 1.4 + i * 0.067;
    path(
      out,
      (t) => [
        cx + (t - 0.5) * w * Math.cos(ang),
        y + Math.sin(t * Math.PI) * 0.23,
        cz + (t - 0.5) * w * Math.sin(ang),
      ],
      12,
      0.041,
    );
    heart(out, cx, y + 0.14, cz, 0.62, 0.71, ang, 0.03);
  }
  vertical(out, cx, cz, 2.8, 16.1, 0.026);
}
function spire(out, x, z, y, h, kind = 0) {
  const o = transform(out, 0, [x, y, z]);
  const profiles =
    kind === 1
      ? [
          [0, 0.33],
          [0.4, 0.52],
          [0.8, 0.18],
          [1.15, 0.5],
          [1.5, 0.16],
          [1.85, 0.41],
          [2.2, 0.1],
        ]
      : [
          [0, 0.23],
          [0.25, 0.37],
          [0.5, 0.17],
          [0.9, 0.44],
          [1.35, 0.19],
          [1.6, 0.31],
          [2.0, 0.12],
        ];
  loft(
    o,
    'concrete',
    profiles.map(([yy, r]) => radialRing(yy, r, r, 24)),
    stucco,
  );
  for (let i = 0; i < profiles.length - 1; i++) {
    const [ya, ra] = profiles[i];
    mosaicCylinder(o, 0, 0, ra, ya, ya + 0.15, 54 + i * 151, 0.09);
  }
  const baseY = 2.05;
  for (let k = 0; k < 4; k++) {
    const phi = (k * tau) / 4;
    path(
      o,
      (t) => {
        const rad = 0.31 * (1 - t) + 0.045;
        return [Math.cos(phi) * rad, baseY + (h - baseY) * t, Math.sin(phi) * rad];
      },
      Math.ceil(h * 3),
      0.042,
    );
  }
  for (let k = 0; k < 10; k++)
    ring(o, 0, baseY + ((h - baseY) * k) / 10, 0, 0.31 * (1 - k / 10) + 0.045, 0.034);
  heart(o, 0, h + 0.32, 0, 0.45, 0.55, 0, 0.036);
}
function gazebo(out) {
  const [x, z] = map.components.gazebo.local,
    r = 2.8956,
    o = transform(out, 0, [x, 0, z]);
  // Bussard's 1959 section measures 19 ft diameter and 40 ft overall, overriding a conflicting popular 30 ft caption.
  annulus(o, 'concrete', r - 0.33, r, 0, 0.54, stucco, 72);
  annulus(o, 'concrete', r - 0.54, r - 0.04, 0.5, 0.66, cream, 72);
  mosaicCylinder(o, 0, 0, r, 0.03, 0.53, 144, 0.105);
  for (let i = 0; i < 18; i++) {
    const a = (i * tau) / 18;
    path(
      o,
      (t) => {
        const radius = r * Math.cos((t * Math.PI) / 2);
        return [
          Math.cos(a) * radius,
          0.65 + Math.sin((t * Math.PI) / 2) * 3.3,
          Math.sin(a) * radius,
        ];
      },
      24,
      0.079,
    );
  }
  for (const y of [1.1, 2.15, 3.13, 3.64]) {
    const rr = r * Math.sqrt(1 - ((y - 0.65) / 3.3) ** 2);
    ring(o, 0, y, 0, rr, 0.056);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i * tau) / 18;
    if (Math.sin(a) > 0.9) continue;
    path(o, (t) => [Math.cos(a) * r, 0.6 + t * 0.92, Math.sin(a) * r], 4, 0.07);
  }
  const se = transform(o, 0, [0, 0, r]);
  heart(se, 0, 2.3, 0.05, 1.3, 1.5, 0, 0.076);
  vertical(se, -0.52, 0, 0.45, 2.2, 0.08);
  vertical(se, 0.52, 0, 0.45, 2.2, 0.08);
  // Open multi-bay central gazebo spire, with broad oval lobes and hollow egg cages.
  vertical(o, 0, 0, 3.78, 11.9, 0.085);
  for (const [y, rx, ry] of [
    [4.65, 0.66, 0.55],
    [6.04, 0.56, 0.83],
    [7.98, 0.52, 0.92],
    [9.79, 0.38, 0.9],
    [11.28, 0.22, 0.48],
  ]) {
    for (const a of [0, Math.PI / 2])
      path(
        o,
        (t) => [
          Math.cos(t * tau) * rx * Math.cos(a),
          y + Math.sin(t * tau) * ry,
          Math.cos(t * tau) * rx * Math.sin(a),
        ],
        40,
        0.056,
      );
    ring(o, 0, y, 0, rx, 0.046);
  }
  heart(o, 0, 12.0, 0, 0.38, 0.38, 0, 0.035);
  // The documented three-tier fountain has individual tiled stems and dishes, not a solid cone.
  for (const [y, r0] of [
    [0.5, 0.67],
    [1.4, 0.51],
    [2.31, 0.32],
  ]) {
    loft(
      o,
      'concrete',
      [
        radialRing(y, 0.14, 0.14, 40),
        radialRing(y + 0.11, r0, r0, 40),
        radialRing(y + 0.22, r0 * 0.96, r0 * 0.96, 40),
      ],
      cream,
    );
    mosaicCylinder(o, 0, 0, r0, y + 0.1, y + 0.22, 21 + y * 19, 0.07);
  }
  vertical(o, 0, 0, 0.1, 2.82, 0.13);
}
function wallPanel(out, width, h, seed, north = false) {
  const n = 20,
    thick = 0.15;
  for (let i = 0; i < n; i++) {
    const xa = -width / 2 + (width * i) / n,
      xb = -width / 2 + (width * (i + 1)) / n,
      ha = h + 0.2 * Math.sin((i * Math.PI) / n),
      hb = h + 0.2 * Math.sin(((i + 1) * Math.PI) / n);
    face(
      out,
      'plaster',
      [
        [xa, 0, thick],
        [xb, 0, thick],
        [xb, hb, thick],
        [xa, ha, thick],
      ],
      rose,
    );
    face(
      out,
      'plaster',
      [
        [xb, 0, -thick],
        [xa, 0, -thick],
        [xa, ha, -thick],
        [xb, hb, -thick],
      ],
      rose,
    );
    face(
      out,
      'concrete',
      [
        [xa, ha, thick],
        [xb, hb, thick],
        [xb, hb, -thick],
        [xa, ha, -thick],
      ],
      cream,
    );
  }
  box(out, 'concrete', [-width / 2, 0, -thick], [width / 2, 0.3, thick], stucco);
  for (const side of [-1, 1]) {
    const o = transform(out, side < 0 ? Math.PI : 0);
    if (side > 0 && !north) {
      mosaicFace(
        o,
        [
          [-width * 0.45, 0.35, 0.156],
          [width * 0.45, 0.35, 0.156],
          [width * 0.45, h * 0.64, 0.156],
          [-width * 0.45, h * 0.64, 0.156],
        ],
        seed,
        0.13,
      );
    } else {
      for (let i = 0; i < 9; i++) {
        const xa = -width * 0.46 + (width * 0.92 * i) / 9,
          xb = xa + (width * 0.92) / 9,
          yt = h - 0.31 + 0.25 * Math.sin(((i + 0.5) * Math.PI) / 9);
        mosaicFace(
          o,
          [
            [xa, yt, 0.156],
            [xb, yt, 0.156],
            [xb, yt + 0.25, 0.156],
            [xa, yt + 0.25, 0.156],
          ],
          seed + i * 13,
          0.09,
        );
      }
    }
    path(
      o,
      (t) => [-width / 2 + width * t, h + 0.2 * Math.sin(t * Math.PI), 0.17],
      24,
      0.031,
      cream,
    );
  }
  for (const x of [-width / 2, width / 2]) {
    box(out, 'concrete', [x - 0.074, 0, -0.2], [x + 0.074, h + 0.25, 0.2], stucco);
    mosaicFace(
      out,
      [
        [x - 0.078, 0.16, 0.206],
        [x + 0.078, 0.16, 0.206],
        [x + 0.078, h + 0.2, 0.206],
        [x - 0.078, h + 0.2, 0.206],
      ],
      seed + 317,
      0.065,
    );
  }
}
function siteWalls(out) {
  const outline = map.geometry.outline;
  // 31 documented panels run along the street; the surviving house doorway is kept open.
  const w = (outline[3][0] - outline[0][0]) / 31;
  for (let i = 0; i < 31; i++) {
    if (i === 6 || i === 7) continue;
    wallPanel(
      transform(out, 0, [outline[0][0] + (i + 0.5) * w, 0, 5]),
      w,
      1.84 + Math.sin(i * 0.9) * 0.07,
      101 + i * 131,
    );
  }
  const gateX = outline[0][0] + 7 * w;
  for (const x of [gateX - w, gateX + w]) vertical(out, x, 5, 0, 2.77, 0.11);
  path(
    out,
    (t) => [gateX - w + 2 * w * t, 2.14 + Math.sin(t * Math.PI) * 0.58, 5],
    32,
    0.09,
    cream,
  );
  for (let j = 0; j < 15; j++) {
    const x = gateX - w + ((j + 0.5) * 2 * w) / 15;
    vertical(out, x, 5, 0.1, 2.04 + 0.28 * Math.sin((j * Math.PI) / 15), 0.014);
  }
  for (let seg = 0; seg < 3; seg++) {
    const a = outline[seg],
      b = outline[seg + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.ceil(len / 1.55),
      theta = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let j = 0; j < count; j++) {
      const center = lerp(a, b, (j + 0.5) / count);
      wallPanel(
        transform(out, theta, [center[0], 0, center[1]]),
        len / count,
        seg === 0 ? 1.71 : 1.95,
        1771 + seg * 400 + j * 97,
        true,
      );
    }
  }
}
function ship(out) {
  const [x, z] = map.components.ship.local,
    o = transform(out, 0, [x, 0, z - 0.35]);
  const hull = [
    [-2.2, -0.61],
    [-1.5, -0.83],
    [1.28, -0.66],
    [2.37, 0],
    [1.28, 0.66],
    [-1.5, 0.83],
    [-2.2, 0.61],
  ].reverse();
  loft(o, 'concrete', [hull.map(([x, z]) => [x, 0, z]), hull.map(([x, z]) => [x, 1.16, z])], cream);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    mosaicFace(
      o,
      [
        [a[0], 0.06, a[1]],
        [b[0], 0.06, b[1]],
        [b[0], 1.13, b[1]],
        [a[0], 1.13, a[1]],
      ],
      i * 111,
      0.12,
    );
  }
  for (const y of [1.18, 1.72, 2.25])
    for (const s of [-1, 1])
      path(
        o,
        (t) => [
          -2.1 + 4.35 * t,
          y + 0.22 * Math.sin(t * Math.PI),
          s * (0.66 + 0.07 * Math.sin(t * Math.PI)),
        ],
        24,
        0.085,
        cream,
      );
  spire(o, -1.28, 0, 1.1, 5.25, 1);
  spire(o, 1.25, 0, 1.1, 4.15, 0);
  for (const x of [-1.95, -0.48, 0.24, 2.06]) spire(o, x, 0, 1.1, 1.9, 1);
}
function houseRemains(out) {
  // The house burned in the 1950s. Retain only its documented facade, posts, chimney and canopy.
  const x = -14.4,
    z = 3.5,
    w = 6.1;
  const facade = transform(out, 0, [x, 0, z]);
  box(facade, 'plaster', [-w / 2, 0, -0.18], [-1.0, 2.85, 0.18], cream);
  box(facade, 'plaster', [0.2, 0, -0.18], [w / 2, 2.85, 0.18], cream);
  box(facade, 'plaster', [-1, 2.32, -0.18], [0.2, 2.85, 0.18], cream);
  for (const a of [-2.74, -1.7, 0.51, 1.55, 2.64]) {
    box(facade, 'concrete', [a - 0.075, 0, 0.16], [a + 0.075, 3.24, 0.35], stucco);
    mosaicFace(
      facade,
      [
        [a - 0.08, 0.1, 0.356],
        [a + 0.08, 0.1, 0.356],
        [a + 0.08, 3.2, 0.356],
        [a - 0.08, 3.2, 0.356],
      ],
      a * 333,
      0.09,
    );
  }
  for (let i = 0; i < 4; i++) {
    const xx = x + w / 2;
    vertical(out, xx, -7.3 + i * 2.7, 0, 3.08, 0.12);
    path(
      out,
      (t) => [xx, -0.05 + 2.75 + Math.sin(t * Math.PI) * 0.42, -7.3 + i * 2.7 + 2.7 * t],
      18,
      0.06,
    );
  }
  const chimney = transform(out, 0, [-10.45, 0, -4.8]);
  box(chimney, 'concrete', [-0.59, 0, -0.51], [0.59, 4.26, 0.51], stucco);
  for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
    mosaicFace(
      transform(chimney, ang),
      [
        [-0.49, 0.15, 0.6],
        [0.49, 0.15, 0.6],
        [0.49, 4.15, 0.6],
        [-0.49, 4.15, 0.6],
      ],
      73 + ang * 49,
      0.11,
    );
  box(chimney, 'concrete', [-0.72, 3.92, -0.64], [0.72, 4.17, 0.64], cream);
  // Arched canopy, winding top ribbon, heart finials and two tiled mailboxes beside the historic entrance.
  for (let j = 0; j < 5; j++) {
    const xx = x - 2.7 + j * 1.2;
    path(out, (t) => [xx, 2.65 + 0.84 * Math.sin(t * Math.PI), z - 0.3 - 2.65 * t], 24, 0.079);
    heart(out, xx, 3.66, z - 1.72, 0.39, 0.53, 0, 0.045);
  }
  for (const zz of [z - 0.31, z - 1.63, z - 2.96])
    path(out, (t) => [x - 2.9 + 5.8 * t, 2.76 + 0.17 * Math.sin(t * Math.PI * 4), zz], 30, 0.06);
  for (const xx of [x - 1.1, x + 0.5]) {
    box(out, 'concrete', [xx - 0.28, 1.12, z + 0.24], [xx + 0.28, 1.53, z + 0.71], cream);
    mosaicFace(
      out,
      [
        [xx - 0.28, 1.12, z + 0.715],
        [xx + 0.28, 1.12, z + 0.715],
        [xx + 0.28, 1.53, z + 0.715],
        [xx - 0.28, 1.53, z + 0.715],
      ],
      xx * 4,
      0.085,
    );
  }
  // Shallow decorated fish pond and barbecue survive in the former garden.
  const pond = transform(out, 0, [-17.2, 0, -6.9]);
  annulus(pond, 'concrete', 0.9, 1.13, 0, 0.3, cream, 40);
  mosaicCylinder(pond, 0, 0, 1.13, 0.03, 0.3, 193, 0.08);
  loft(
    pond,
    'glass',
    [radialRing(0.08, 0.89, 0.89, 40), radialRing(0.09, 0.89, 0.89, 40)],
    [0.12, 0.24, 0.23],
  );
  const oven = transform(out, 0, [-17.8, 0, -2.4]);
  box(oven, 'concrete', [-0.75, 0, -0.54], [0.75, 0.85, 0.54], stucco);
  sphere(oven, 'concrete', [0, 0.84, 0], [0.7, 0.55, 0.49], cream, 24, 12);
  box(oven, 'shadow', [-0.27, 0.84, 0.452], [0.27, 1.2, 0.5], [0.12, 0.1, 0.075]);
  mosaicFace(
    oven,
    [
      [-0.7, 0.04, 0.55],
      [0.7, 0.04, 0.55],
      [0.7, 0.82, 0.55],
      [-0.7, 0.82, 0.55],
    ],
    994,
    0.13,
  );
}
function overheads(out) {
  // Low sweeping connecting bands are recorded independently of the taller heart ladder between east and center.
  for (const [x, z] of [
    map.components.west.local,
    map.components.center.local,
    map.components.east.local,
  ]) {
    for (const end of [
      [x - 3.1, 4.87],
      [x + 2.15, 4.87],
      [x - 1.0, z - 3],
    ])
      path(
        out,
        (t) => [x + (end[0] - x) * t, 2.5 + 1.05 * Math.sin(t * Math.PI), z + (end[1] - z) * t],
        24,
        0.064,
        stucco,
      );
  }
}
function build(out) {
  serial = 1;
  const ring = [...map.geometry.outline].reverse();
  // Thin original concrete court follows the state parcel and has no invented enclosing building mass.
  loft(
    out,
    'concrete',
    [ring.map(([x, z]) => [x, 0, z]), ring.map(([x, z]) => [x, 0.075, z])],
    [0.6, 0.585, 0.52],
    { cap: false },
  );
  // The northern parcel kink is concave: explicit triangles keep its top outward and fully covered.
  const floor = map.geometry.outline;
  for (const ids of [
    [0, 2, 1],
    [0, 3, 2],
  ]) {
    triangle(
      out,
      'concrete',
      ids.map((i) => [floor[i][0], 0.075, floor[i][1]]),
      [0.6, 0.585, 0.52],
    );
    triangle(
      out,
      'concrete',
      [...ids].reverse().map((i) => [floor[i][0], 0, floor[i][1]]),
      [0.6, 0.585, 0.52],
    );
  }
  // Hand-inscribed floor arcs are subtle narrow relief, not an applied photograph.
  for (let j = 0; j < 14; j++) {
    const x = -18 + j * 1.9,
      z = 1.0;
    path(
      out,
      (t) => [x + 0.51 * Math.cos(t * tau), 0.083, z + 0.51 * Math.sin(t * tau)],
      36,
      0.008,
      [0.39, 0.37, 0.31],
      false,
    );
  }
  siteWalls(out);
  principal(out, 'west');
  principal(out, 'center');
  principal(out, 'east');
  connection(out);
  gazebo(out);
  ship(out);
  houseRemains(out);
  overheads(out);
  const [a, b] = [map.components.towerA.local, map.components.towerB.local];
  spire(out, a[0], a[1], 0, 6.4, 1);
  spire(out, b[0], b[1], 0, 5.5, 0);
  spire(out, -17.9, -10.8, 0, 4.1, 1);
}
export const wattsTowers = {
  id: 'n0613_watts_towers',
  planId: 'N0613',
  title: 'Watts Towers',
  wikidata: 'Q445256',
  authoringFile: 'watts-towers-model.mjs',
  groundNormalize: true,
  build,
  front: 'Native +X follows the eastward E 107th Street boundary; +Z faces south toward the street',
  origin: 'State-parcel frame close to West Tower, Y=0 at the sculpture court',
  brief:
    'Complete Rodia sculpture ensemble with three independently constructed nested open spires, West Tower’s 16 legs and 18 projecting oval loops, center/east heart ladder, stepped mosaic bases, open Gazebo with fountain and articulated spire, Ship with ornamental masts, A/B/garden spires, overhead bands, scalloped decorated perimeter walls, surviving house facade and canopy, chimney, fish pond and barbecue. Individual colored ceramic/glass pieces are original geometry over shared metric stucco.',
  refs: [
    'https://www.parks.ca.gov/?page_id=613',
    'https://gis.parks.ca.gov/server/rest/services/EnterpriseGIS/CSPBoundaries_Portal/FeatureServer/0',
    'https://npgallery.nps.gov/NRHP/GetAsset/NHLS/77000297_text',
    'https://npgallery.nps.gov/NRHP/GetAsset/NHLS/77000297_photos',
    'https://www.pbssocal.org/shows/lost-la/how-the-watts-towers-escaped-demolition',
    'https://www.lacma.org/sites/default/files/ARG2005ConservationReport.pdf',
    'https://www.lacma.org/marvin-rand-images',
    'https://www.lacma.org/sites/default/files/WestTower.pdf',
    'https://www.lacma.org/sites/default/files/CenterTower_0.pdf',
    'https://www.lacma.org/sites/default/files/EastTower_0.pdf',
    'https://www.lacma.org/sites/default/files/Ship_0.pdf',
    'https://www.lacma.org/sites/default/files/NorthWall_0.pdf',
    'https://www.lacma.org/sites/default/files/SouthWallInt.pdf',
    'https://www.wattstowers.org/contact-us',
  ],
  facts: {
    westHeightMeters: 30.327,
    westDiameterMeters: 4.572,
    westExteriorLegs: 16,
    westExteriorLoops: 18,
    centerHeightMeters: 29.5148,
    centerDiameterMeters: 4.1148,
    centerOuterLegs: 8,
    centerIntermediateLegs: 8,
    eastHeightMeters: 17.3736,
    eastDiameterMeters: 2.7432,
    eastOuterLegs: 6,
    eastInnerLegs: 8,
    gazeboDiameterMeters: 5.7912,
    gazeboHeightMeters: 12.192,
    southWallPanelCount: 31,
    sourceHeightDiscrepancy:
      'NPS 1990 nomination gives Center 97 ft 10 in / East 55 ft; the indexed LACMA/ARG 2005 conservation text gives 96 ft 10 in / 57 ft. The latter contemporary conservation dimensions are used; the source is indexed but its current direct PDF link returns 404.',
    gazeboDiscrepancy:
      'Bussard June 1959 measured section says 19 ft diameter; a popular later exhibit caption says 30 ft. The dimensioned primary section governs.',
  },
  scaleBasis:
    'West 99 ft 6 in and 15 ft base; Center 96 ft 10 in and 13 ft 6 in; East 57 ft and 9 ft base from the indexed ARG/LACMA conservation report, checked against NPS nomination and Bussard/Goldstone 1959 engineering drawings reproduced by the Los Angeles city archivist. Gazebo 19 ft diameter, 40 ft height and 3 ft wall from Bussard’s measured drawing. The official State Parks parcel fixes the ensemble extent and compass axis; internal centers are proportional readings of admitted city-hearing Exhibit B. Conservation photographs govern distinct framing, decorated bases and surviving smaller components.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash:
      'sha256:' +
      createHash('sha256')
        .update(readFileSync(structureSourcePath('n0613_watts_towers', 'map-frame.json')))
        .digest('hex'),
    status: 'preview-proposal',
    evidence: map.basis,
    limitations:
      'State GIS boundary is a parcel rather than a component survey. Interior positions and secondary sculpture dimensions are proportional reconstruction. The burned house is represented by surviving exterior remnants only, not its lost building volume.',
  },
  limits: [
    'Original exterior reconstruction, not a conservation replica: every mosaic shard, shell, bottle bottom and embossed imprint is not copied; deterministic small colored pieces preserve material scale, palette and distribution. Published framing counts, different tower silhouettes and named components are retained.',
    'Individual component centers, irregular tube bends, secondary sculpture heights and small ornament are proportional from primary plans/photographs rather than a laser survey. Conflicting source heights are recorded explicitly.',
    'The 1950s house volume is absent, as in the surviving monument. Nearby arts-center buildings, temporary conservation scaffolding and the outer modern security fence are outside this sculpture asset.',
  ],
  cameras: [
    { name: 'street-ensemble', position: [30, 20, 48], lookAt: [-1, 13, 0] },
    { name: 'north-ensemble', position: [24, 21, -48], lookAt: [-2, 13, -1] },
    { name: 'west-loops', position: [9, 18, 17], lookAt: [0.2, 17, 0.6] },
    { name: 'center-east-hearts', position: [12, 10, 16], lookAt: [7.5, 9, 1.8] },
    { name: 'tower-bases-mosaic', position: [9, 4, 10], lookAt: [3.5, 1.4, 1] },
    { name: 'gazebo-and-fountain', position: [-5.9, 2.8, 2], lookAt: [-5.9, 1.8, -2.2] },
    { name: 'gazebo-spire', position: [-22, 9, -14], lookAt: [-5.9, 6.1, -2.2] },
    { name: 'ship-and-masts', position: [23, 6, 10], lookAt: [14.4, 3, 3.2] },
    { name: 'street-wall-and-canopy', position: [-15, 4, 12], lookAt: [-13, 2, 2] },
    { name: 'aerial-site', position: [-6, 70, 45], lookAt: [-2, 8, -2] },
    { name: 'far-silhouette', position: [60, 26, 85], lookAt: [-1, 13, -1] },
  ],
};
