import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.93 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  cornice: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  door: { slot: 'door', graph: 'wood_vertical', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const granite = rgb('b89c8f');
const light = rgb('c6aa96');
const dark = rgb('927969');
const stone = rgb('b0a090');
const iron = rgb('bbaa9b');
const roof = rgb('67666c');
const pane = rgb('515662');
const recess = rgb('44404b');
const timber = rgb('655345');
const bright = rgb('d6c5b4');
const tau = 2 * Math.PI;

function bay(out, f, u, y, width, h, detail, twin = false) {
  const a = u - width / 2,
    b = u + width / 2;
  const panel = (slot, u, U, y, Y, d, tone) =>
    quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), tone);
  panel('glass', a, b, y, y + h, 0.046, y > 22 ? recess : pane);
  if (detail < 2) return;
  if (detail === 2) {
    panel('cornice', a - 0.15, b + 0.15, y - 0.11, y - 0.018, 0.091, light);
    panel('cornice', a - 0.15, b + 0.15, y + h + 0.014, y + h + 0.13, 0.095, light);
    if (twin) panel('cornice', u - 0.06, u + 0.06, y, y + h, 0.097, stone);
    return;
  }
  fbox(out, 'cornice', f, a - 0.17, b + 0.17, y - 0.151, y - 0.025, 0, 0.263, light);
  fbox(out, 'cornice', f, a - 0.17, b + 0.17, y + h + 0.022, y + h + 0.185, 0, 0.142, light);
  for (const q of twin ? [a, u, b] : [a, b])
    fbox(out, 'cornice', f, q - 0.055, q + 0.062, y - 0.021, y + h + 0.052, 0.036, 0.157, stone);
  fbox(out, 'cornice', f, a, b, y + h * 0.64 - 0.021, y + h * 0.64 + 0.055, 0.037, 0.135, stone);
}

function wallWindows(out, f, detail, primary) {
  const count = Math.max(1, Math.round((f.length - 0.82) / (primary ? 3.36 : 3.85)));
  const stride = f.length / count;
  const row = primary
    ? [
        [3.19, 2.54],
        [9.1, 4.43],
        [17.68, 4.65],
        [24.8, 2.63],
      ]
    : [
        [3.17, 2.47],
        [9.11, 4.25],
        [17.43, 4.31],
        [24.83, 2.63],
      ];
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * stride;
    for (const [j, [y, h]] of row.entries()) {
      if (detail === 1 && j === 0) continue;
      bay(
        out,
        f,
        u,
        y,
        (primary ? 1.4 : 1.37) * (j === 3 ? 1.06 : 1),
        h,
        detail,
        primary || j === 1,
      );
    }
    if (detail > 1 && i > 0 && primary) {
      const x = i * stride;
      fbox(out, 'granite', f, x - 0.187, x + 0.188, 6.3, 23.25, 0.008, 0.29, light);
      fbox(out, 'cornice', f, x - 0.278, x + 0.279, 22.87, 23.43, 0.158, 0.385, light);
    }
  }
}

function exterior(out, detail) {
  const { body, outline, portal, grade } = site;
  if (detail > 0)
    for (const ring of body) extrude(out, 'plinth', ring, grade - 3.2, 1.38, dark, { top: false });
  for (const band of site.bands) {
    for (const ring of band.body)
      extrude(out, 'granite', ring, detail === 0 ? grade - 3.2 : 1.38, band.height, granite, {
        top: false,
      });
    for (const ring of band.cap) cap(out, 'roof', ring, band.height, roof);
  }
  const ring = outwardRing(outline);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    if (f.length < 3.1 || detail === 0) continue;
    const [x, z] = xz(f.P(f.length / 2, 0));
    const u = x * F.along[0] + z * F.along[1],
      d = x * F.normal[0] + z * F.normal[1];
    if (d > 35.7 && Math.abs(u - portal.center) < 11.9) continue;
    const primary = Math.abs(u - portal.center) > 55 || d < -20 || d > 23.9;
    wallWindows(out, f, detail, primary);
    const top = u < -2.49 || u > 45.135 ? 28.12 : 31.75;
    for (const [y, h, depth] of [
      [6.28, 0.32, 0.21],
      [15.06, 0.34, 0.22],
      [23.94, 0.45, 0.24],
      [top - 0.87, 1.04, 0.32],
      [top - 0.19, 0.49, 0.45],
    ]) {
      if (detail === 1 && h < 0.5) continue;
      fbox(out, 'cornice', f, 0, f.length, y, y + h, 0.01, depth, light);
    }
  }
  const z = portal.face;
  const x = portal.center;
  const w = portal.half;
  const ts = detail === 0 ? 7 : detail === 1 ? 11 : detail === 2 ? 17 : 25;
  const A = (a, r = w) => [x + r * Math.cos(a), portal.spring + r * Math.sin(a)];
  for (let i = 0; i < ts; i++) {
    const a = (i * Math.PI) / ts,
      b = ((i + 1) * Math.PI) / ts;
    const [u, y] = A(a),
      [U, Y] = A(b);
    quad4(out, 'granite', P(U, Y, z), P(u, y, z), P(u, 31.75, z), P(U, 31.75, z), granite);
    quad4(out, 'granite', P(u, y, z), P(U, Y, z), P(U, Y, portal.back), P(u, y, portal.back), dark);
    if (detail > 0) {
      const [q, r] = A(a, w + 0.92),
        [Q, R] = A(b, w + 0.92);
      quad4(
        out,
        'cornice',
        P(U, Y, z + 0.102),
        P(u, y, z + 0.102),
        P(q, r, z + 0.14),
        P(Q, R, z + 0.14),
        light,
      );
    }
  }
  for (const left of [true, false]) {
    const side = left ? x - w : x + w;
    const outer = left ? 2.24 : 39.38;
    const a = Math.min(outer, side),
      b = Math.max(outer, side);
    fbox(out, 'granite', F, a, b, portal.spring, 31.75, z - 0.14, z, granite);
    for (const u of [left ? a + 1.37 : b - 1.37, left ? b - 0.42 : a + 0.42]) {
      if (detail === 0) continue;
      fbox(out, 'cornice', F, u - 0.23, u + 0.23, 1.15, 30.91, z + 0.032, z + 0.29, light);
    }
    if (detail > 0) {
      const q = (a + b) / 2;
      for (const [y, h] of [
        [4.1, 2.65],
        [9.37, 4.15],
        [18.41, 4.28],
        [25.44, 2.97],
      ])
        bay(out, facade(xz(P(0, 0, z)), F.along), q, y, 2.41, h, detail, true);
    }
  }
  const back = facade(xz(P(0, 0, portal.back + 0.05)), F.along);
  for (const u of [x - 3.72, x, x + 3.72]) {
    fbox(out, 'door', back, u - 0.93, u + 0.93, portal.sill, 4.91, 0.018, 0.139, timber);
    for (const y of [6.59, 11.66, 17.37])
      if (detail > 0) bay(out, back, u, y, 1.69, 3.32, detail, true);
  }
  if (detail > 1) {
    for (const [a, b] of [
      [2.25, x - w - 0.16],
      [x + w + 0.16, 39.37],
    ])
      for (const y of [6.39, 15.09, 22.94]) {
        fbox(out, 'cornice', F, a, b, y, y + 0.38, z + 0.005, z + 0.261, light);
      }
    for (const [y, h, d] of [
      [22.98, 0.23, 0.28],
      [28.95, 0.53, 0.34],
      [30.71, 0.74, 0.63],
      [31.59, 0.35, 0.75],
    ])
      fbox(out, 'cornice', F, 2.21, 39.4, y, y + h, z + 0.004, z + d, light);
  }
  const steps = detail === 0 ? 2 : detail === 1 ? 4 : 8;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    fbox(
      out,
      'plinth',
      F,
      x - 12.48 + t * 0.86,
      x + 12.48 - t * 0.88,
      grade - 0.91,
      grade + ((portal.sill - grade) * (i + 1)) / steps,
      z - 0.27,
      z + 5.61 - 4.51 * t,
      stone,
    );
  }
}

function wingRoofs(out, detail) {
  for (const [i, [a, c, b, d]] of site.roofWings.entries()) {
    const y = i < 4 ? 28.1 : 31.73,
      x = (a + b) * 0.5;
    const peak = i === 0 || i === 3 ? 34.11 : i < 4 ? 31.2 : i === 5 ? 35.8 : 35.32;
    const u = Math.min(5, (b - a) * 0.19),
      v = Math.min(5, (d - c) * 0.23);
    const A = P(a + 0.48, y, d - 0.46),
      B = P(b - 0.48, y, d - 0.46),
      C = P(b - 0.48, y, c + 0.46),
      D = P(a + 0.48, y, c + 0.46);
    const aa = P(a + u, peak, d - v),
      bb = P(b - u, peak, d - v),
      cc = P(b - u, peak, c + v),
      dd = P(a + u, peak, c + v);
    quad4(out, 'roof', A, B, bb, aa, roof);
    quad4(out, 'roof', B, C, cc, bb, roof);
    quad4(out, 'roof', C, D, dd, cc, roof);
    quad4(out, 'roof', D, A, aa, dd, roof);
    quad4(out, 'roof', aa, bb, cc, dd, roof);
    if (detail > 0 && (i === 0 || i === 3)) {
      const at = xz(P(x, peak, (c + d) * 0.5));
      lathe(
        out,
        'iron',
        at,
        [
          [peak, 0.62, 0.62],
          [peak + 1.76, 0.16, 0.16],
          [peak + 2.99, 0, 0],
        ],
        8,
        iron,
      );
    }
  }
  const x = site.portal.center,
    z = site.portal.face;
  fbox(out, 'granite', F, x - 11.65, x + 11.65, 31.7, 36.87, z - 4.4, z - 0.47, granite);
  tri(
    out,
    'cornice',
    P(x - 11.82, 36.87, z - 0.36),
    P(x + 11.82, 36.87, z - 0.36),
    P(x, 41.74, z - 0.36),
    light,
  );
  tri(
    out,
    'granite',
    P(x - 10.55, 37.2, z - 0.29),
    P(x + 10.55, 37.2, z - 0.29),
    P(x, 41.13, z - 0.29),
    granite,
  );
  if (detail > 0) {
    tri(
      out,
      'roof',
      P(x + 11.82, 36.87, z - 4.55),
      P(x - 11.82, 36.87, z - 4.55),
      P(x, 41.74, z - 4.55),
      roof,
    );
    quad4(
      out,
      'roof',
      P(x, 41.74, z - 0.36),
      P(x + 11.82, 36.87, z - 0.36),
      P(x + 11.82, 36.87, z - 4.55),
      P(x, 41.74, z - 4.55),
      roof,
    );
    quad4(
      out,
      'roof',
      P(x - 11.82, 36.87, z - 0.36),
      P(x, 41.74, z - 0.36),
      P(x, 41.74, z - 4.55),
      P(x - 11.82, 36.87, z - 4.55),
      roof,
    );
    const o = Array.from({ length: 14 }, (_, i) => {
      const a = (i * tau) / 14;
      return P(x + 1.05 * Math.cos(a), 38.96 + 0.91 * Math.sin(a), z - 0.26);
    });
    fan(out, 'glass', o, recess);
    for (const [y, h] of [
      [32.11, 0.29],
      [34.51, 0.31],
      [36.49, 0.36],
    ])
      fbox(out, 'cornice', F, x - 11.66, x + 11.66, y, y + h, z - 0.46, z - 0.11, light);
    if (detail > 1)
      for (let i = -3; i <= 3; i++) {
        const u = x + i * 2.48;
        const disk = Array.from({ length: 10 }, (_, j) => {
          const a = (j * tau) / 10;
          return P(u + 0.53 * Math.cos(a), 33.54 + 0.51 * Math.sin(a), z - 0.245);
        });
        fbox(out, 'granite', F, u - 0.97, u + 0.97, 32.53, 34.43, z - 0.47, z - 0.29, light);
        fan(out, 'cornice', disk, stone);
      }
  }
}

function dome(out, detail) {
  const {
    center: [u, d],
    outerRadius: r,
  } = site.dome;
  const at = xz(P(u, 0, d));
  const sides = [9, 20, 32, 56][detail];
  const cylinder = (slot, profile, tint, top = false, n = sides) =>
    lathe(
      out,
      slot,
      at,
      profile.map(([y, r]) => [y, r, r]),
      n,
      tint,
      { capTop: top, rotation: Math.atan2(F.along[1], F.along[0]) },
    );
  cylinder(
    'iron',
    [
      [31.69, 12.14],
      [39.47, r],
      [40.3, r + 0.21],
      [41.12, r - 0.02],
    ],
    iron,
  );
  cylinder(
    'iron',
    [
      [40.92, r - 1.85],
      [50.12, r - 2.06],
      [51.94, r + 0.38],
      [53.21, r + 0.35],
    ],
    iron,
  );
  cylinder(
    'iron',
    [
      [53.2, 11.1],
      [59.13, 10.6],
      [60.67, 10.39],
    ],
    iron,
  );
  const profiles = [
    [60.54, 10.24],
    [62.28, 10.18],
    [65.41, 9.52],
    [69.1, 8.41],
    [72.55, 6.46],
    [76.18, 3.73],
    [78.48, 2.03],
  ];
  cylinder('iron', detail === 0 ? profiles.filter((_, i) => i % 2 === 0) : profiles, iron);
  cylinder(
    'iron',
    [
      [78.3, 2.43],
      [79.45, 2.41],
      [79.68, 1.9],
      [85.39, 1.77],
      [85.81, 2.08],
    ],
    iron,
  );
  cylinder(
    'iron',
    [
      [85.77, 2.08],
      [86.91, 1.48],
      [87.38, 0.68],
    ],
    iron,
    true,
  );
  const n = [8, 16, 20, 24][detail];
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      c = Math.cos(a),
      s = Math.sin(a);
    const radial = (range) => xz(P(u + range * c, 0, d + range * s));
    const [x, z] = radial(r - 0.38);
    const shaft = detail === 0 ? 4 : detail === 1 ? 5 : 10;
    lathe(
      out,
      'cornice',
      [x, z],
      detail === 0
        ? [
            [41.0, 0.43, 0.43],
            [51.51, 0.42, 0.42],
          ]
        : [
            [41.0, 0.43, 0.43],
            [49.9, 0.32, 0.32],
            [51.51, 0.45, 0.45],
          ],
      shaft,
      light,
      { capTop: false },
    );
    if (detail > 0) {
      const glassSide = facade(radial(r - 1.38), [
        s * F.along[0] - c * F.normal[0],
        s * F.along[1] - c * F.normal[1],
      ]);
      bay(out, glassSide, -0.68, 42.35, 0.91, 5.8, 0);
      const upper = facade(radial(10.88), glassSide.along);
      bay(out, upper, 0, 54.22, 1.14, 3.79, Math.min(1, detail), true);
      const small = facade(radial(9.72), glassSide.along);
      if (i % 2 === 0 || detail > 1)
        bay(out, small, 0, 63.4, 0.78, 2.16, Math.min(1, detail), false);
      if (detail > 1) {
        for (let j = 1; j < profiles.length; j++) {
          const [y0, r0] = profiles[j - 1],
            [y1, r1] = profiles[j];
          const X = radial(r0 + 0.049),
            Z = radial(r1 + 0.049);
          beam(out, 'iron', [X[0], y0, X[1]], [Z[0], y1, Z[1]], 0.105, 0.11, light);
        }
      }
    }
  }
  const lanternBays = detail < 2 ? 6 : 10;
  if (detail > 0)
    for (let i = 0; i < lanternBays; i++) {
      const a = (i * tau) / lanternBays,
        c = Math.cos(a),
        s = Math.sin(a);
      const f = facade(xz(P(u + 1.96 * c, 0, d + 1.96 * s)), [
        s * F.along[0] - c * F.normal[0],
        s * F.along[1] - c * F.normal[1],
      ]);
      bay(out, f, 0, 80.14, 0.71, 4.36, Math.min(1, detail));
    }
}

function figure(out, detail) {
  const {
    center: [u, d],
    height,
  } = site.dome;
  const at = xz(P(u, 0, d));
  const base = height - 4.78;
  const n = detail < 2 ? 6 : 12;
  lathe(
    out,
    'cornice',
    at,
    [
      [base, 0.52, 0.36],
      [base + 0.44, 0.47, 0.32],
      [base + 1.22, 0.37, 0.29],
      [base + 2.51, 0.27, 0.21],
      [base + 3.04, 0.35, 0.25],
      [base + 3.44, 0.19, 0.16],
    ],
    n,
    bright,
  );
  lathe(
    out,
    'cornice',
    xz(P(u + 0.02, 0, d + 0.035)),
    [
      [base + 3.34, 0.15, 0.16],
      [base + 3.56, 0.21, 0.21],
      [base + 3.77, 0.19, 0.19],
      [base + 3.92, 0.12, 0.12],
    ],
    n,
    bright,
  );
  beam(
    out,
    'cornice',
    P(u + 0.27, base + 3.12, d),
    P(u + 1.11, base + 4.39, d + 0.12),
    0.21,
    0.23,
    bright,
  );
  beam(
    out,
    'cornice',
    P(u - 0.26, base + 3.08, d),
    P(u - 0.54, base + 2.14, d + 0.29),
    0.23,
    0.21,
    bright,
  );
  const starY = height - 0.27;
  const center = P(u + 1.14, starY, d + 0.15);
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (tau * i) / 10,
      r = i % 2 === 0 ? 0.27 : 0.131;
    return P(u + 1.14 + r * Math.cos(a), starY + r * Math.sin(a), d + 0.15);
  });
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    tri(out, 'cornice', center, rays[i], rays[j], bright);
    tri(out, 'cornice', center, rays[j], rays[i], bright);
  }
}

function build(out, detail) {
  exterior(out, detail);
  wingRoofs(out, detail);
  dome(out, detail);
  figure(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
