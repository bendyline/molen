import {
  extrude,
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
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98 },
  molding: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99 },
  painted: { slot: 'trim', graph: 'plaster_lime', roughness: 0.96 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.93 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.98 },
};

const concrete = rgb('ad9b83');
const cream = rgb('c7b6a0');
const warm = rgb('b8a286');
const dark = rgb('585446');
const slate = rgb('747b71');
const teal = rgb('507a80');
const gilt = rgb('ab874b');
const [x, z] = site.frame.origin,
  [ax, az] = site.frame.along,
  [bx, bz] = site.frame.across;
const P = (u, y, v) => [x + u * ax + v * bx, y, z + u * az + v * bz];
const corners = [-1, 1].flatMap((u) => [-1, 1].map((v) => [u, v]));
const { halfWidth, spring, rise, ceiling } = site.arch;
const a = site.frame.width / 2,
  b = site.frame.depth / 2;
const plan = (u0, v0, u1, v1) =>
  outwardRing(
    [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ].map(([u, v]) => {
      const [e, , s] = P(u, 0, v);
      return [e, s];
    }),
  );
const perimeter = plan(-a, -b, a, b);
const faces = perimeter.map((p, i) => wallFace(p, perimeter[(i + 1) % 4]));
const walls = (out, slot, ring, y, Y, color) =>
  extrude(out, slot, ring, y, Y, color, { top: false });

function box(out, slot, ring, y, Y, color) {
  walls(out, slot, ring, y, Y, color);
  cap(out, slot, ring, Y, color);
}

function panel(out, slot, F, u, U, y, Y, d, color) {
  quad4(out, slot, F.P(u, y, d), F.P(U, y, d), F.P(U, Y, d), F.P(u, Y, d), color);
}

function column(out, F, u, d, y, Y, r, detail) {
  const [e, , s] = F.P(u, 0, d);
  const profile =
    detail === 0
      ? [
          [y, r],
          [Y, r],
        ]
      : [
          [y, r * 1.24],
          [y + 0.23, r * 1.24],
          [y + 0.4, r],
          [Y - 0.55, r * 0.89],
          [Y - 0.3, r * 1.23],
          [Y, r * 1.23],
        ];
  lathe(
    out,
    'molding',
    [e, s],
    profile.map(([h, w]) => [h, w, w]),
    [5, 7, 10, 12][detail],
    warm,
  );
}

function portal(out, F, detail) {
  const middle = F.length / 2;
  const inner = F.length === faces[0].length || F.length === faces[2].length ? b : a;
  const throat = Math.max(4.8, inner - halfWidth);
  const n = [6, 10, 14, 20][detail];
  const arch = (i, offset = 0, d = 0) => {
    const t = Math.PI * (1 - i / n);
    return F.P(
      middle + (halfWidth + offset) * Math.cos(t),
      spring + (rise + offset) * Math.sin(t),
      d,
    );
  };
  for (let i = 0; i < n; i++) {
    const A = arch(i),
      B = arch(i + 1);
    const y = 19.28;
    quad4(out, 'concrete', A, B, [B[0], y, B[2]], [A[0], y, A[2]], concrete);
    quad4(
      out,
      'molding',
      arch(i, 0, 0.073),
      arch(i + 1, 0, 0.073),
      arch(i + 1, 0.41, 0.12),
      arch(i, 0.41, 0.12),
      cream,
    );
    const innerA = arch(i, 0, -throat),
      innerB = arch(i + 1, 0, -throat);
    quad4(out, 'molding', innerA, innerB, B, A, cream);
    quad4(
      out,
      'painted',
      innerA,
      innerB,
      [innerB[0], ceiling, innerB[2]],
      [innerA[0], ceiling, innerA[2]],
      warm,
    );
    const lipA = arch(i, 0, -throat - 0.022),
      lipB = arch(i + 1, 0, -throat - 0.022);
    quad4(
      out,
      'painted',
      lipB,
      lipA,
      [lipA[0], ceiling, lipA[2]],
      [lipB[0], ceiling, lipB[2]],
      warm,
    );
    if (detail < 2) continue;
    const front = -0.11,
      rear = -throat + 0.11;
    quad4(
      out,
      'painted',
      arch(i, -0.024, rear),
      arch(i + 0.055, -0.024, rear),
      arch(i + 0.055, -0.024, front),
      arch(i, -0.024, front),
      warm,
    );
    for (let j = 1; j < 4; j++) {
      const v = (-throat * j) / 4;
      quad4(
        out,
        'painted',
        arch(i, -0.021, v - 0.048),
        arch(i + 1, -0.021, v - 0.048),
        arch(i + 1, -0.021, v + 0.047),
        arch(i, -0.021, v + 0.047),
        warm,
      );
      if (detail === 3) {
        const m = arch(i + 0.5, -0.035, v + throat / 8);
        const t = F.along;
        const q = (u, v) => [
          m[0] + u * t[0] + v * F.normal[0],
          m[1],
          m[2] + u * t[1] + v * F.normal[1],
        ];
        quad4(out, 'gold', q(-0.16, 0), q(0, -0.21), q(0.16, 0), q(0, 0.21), gilt);
      }
    }
  }
  for (const sign of [-1, 1]) {
    const u = middle + sign * (halfWidth + 1.06);
    column(out, F, u, 0.37, 0.71, 19.19, 0.49, detail);
    fbox(out, 'molding', F, u - 0.68, u + 0.68, 0.06, 0.79, -0.15, 0.99, cream);
    if (detail > 0) fbox(out, 'molding', F, u - 0.77, u + 0.77, 18.42, 19.16, 0, 1.03, cream);
  }
  fbox(out, 'molding', F, middle - 6.29, middle + 6.29, 19.18, 19.93, -0.08, 1.22, cream, {
    bottom: true,
  });
  fbox(out, 'molding', F, middle - 6.09, middle + 6.09, 19.93, 20.22, -0.08, 1.32, warm);
  const top = F.P(middle, 22.55, 0.88),
    left = F.P(middle - 4.93, 20.2, 0.88),
    right = F.P(middle + 4.93, 20.2, 0.88);
  tri(out, 'molding', left, right, top, cream);
  if (detail > 1) {
    for (let i = -4; i <= 4; i++) {
      const u = middle + i * 0.65,
        h = 20.88 + (4 - Math.abs(i)) * 0.22;
      tri(
        out,
        'gold',
        F.P(u - 0.27, 20.52, 0.91),
        F.P(u + 0.27, 20.52, 0.91),
        F.P(u, h, 0.94),
        gilt,
      );
    }
  }
}

function floorAndCeiling(out, detail) {
  box(out, 'footing', plan(-a - 0.51, -b - 0.51, a + 0.51, b + 0.51), -1.11, 0.12, slate);
  const w = halfWidth;
  const ceilingRing = plan(-w, -w, w, w).slice().reverse();
  fan(
    out,
    'painted',
    ceilingRing.map(([x, z]) => [x, ceiling, z]),
    teal,
  );
  for (const [u, v] of corners) {
    if (detail > 0) {
      const [e, , s] = P(u * w, 0.2, v * w);
      lathe(
        out,
        'molding',
        [e, s],
        [
          [0.14, 0.26, 0.26],
          [16.88, 0.26, 0.26],
          [17.45, 0.36, 0.36],
        ],
        [5, 7, 9, 12][detail],
        warm,
      );
    }
    const A = P(0, ceiling - 0.015, 0),
      B = P(u * w, ceiling - 0.015, v * w),
      W = 0.075;
    quad4(
      out,
      'gold',
      [A[0] - W, A[1], A[2]],
      [B[0] - W, B[1], B[2]],
      [B[0] + W, B[1], B[2]],
      [A[0] + W, A[1], A[2]],
      gilt,
    );
  }
  if (detail > 0) {
    lathe(
      out,
      'gold',
      [x, z],
      [
        [ceiling - 0.2, 0.52, 0.52],
        [ceiling - 0.085, 0.91, 0.91],
        [ceiling, 0.95, 0.95],
      ],
      [6, 8, 12, 16][detail],
      gilt,
      { capBottom: true, capTop: false },
    );
  }
}

function mainBody(out, detail) {
  floorAndCeiling(out, detail);
  for (const [u, v] of corners) {
    const lo = [u < 0 ? -a : halfWidth, v < 0 ? -b : halfWidth],
      hi = [u < 0 ? -halfWidth : a, v < 0 ? -halfWidth : b];
    walls(out, 'concrete', plan(...lo, ...hi), 0.11, 19.28, concrete);
  }
  for (const F of faces) portal(out, F, detail);
  walls(out, 'concrete', perimeter, 19.28, 26.32, concrete);
  for (const [v, y, Y] of [
    [0.39, 24.31, 24.72],
    [0.72, 25.25, 25.86],
    [1.09, 26.06, 26.72],
    [0.86, 26.72, 27.35],
    [1.14, 27.35, 28.18],
    [0.79, 28.18, site.eaves],
  ])
    box(out, 'molding', plan(-a - v, -b - v, a + v, b + v), y, Y, warm);
  if (!detail) return;
  for (const F of faces) {
    const bays = detail === 1 ? 9 : 16;
    for (let i = 0; i < bays; i++) {
      const u = (F.length * (i + 0.5)) / bays;
      const w = (F.length / bays) * 0.31;
      tri(
        out,
        'molding',
        F.P(u - w, 26.74, 0.91),
        F.P(u + w, 26.74, 0.91),
        F.P(u, 27.38, 1.15),
        cream,
      );
      panel(out, 'recess', F, u - 0.17, u + 0.17, 24.92, 25.29, 0.042, dark);
    }
  }
}

function spire(out, u, v, height, detail) {
  const center = u === 0 && v === 0;
  const [e, , s] = P(u, 0, v);
  const base = site.eaves;
  const h = height - base;
  const w = center ? 4.08 : 2.78;
  const square = plan(u - w, v - w, u + w, v + w);
  box(out, 'molding', square, base, base + h * 0.144, cream);
  const points = [
    [0.135, 1.02],
    [0.21, 1.15],
    [0.247, 0.87],
    [0.42, 0.77],
    [0.445, 0.91],
    [0.49, 0.97],
    [0.53, 0.7],
    [0.61, 0.58],
    [0.65, 0.69],
    [0.715, 0.46],
    [0.769, 0.42],
    [0.825, 0.23],
    [0.898, 0.12],
    [0.947, 0.057],
    [1, 0.013],
  ];
  const profile = points
    .filter((_, i) => detail > 0 || i % 2 === 0)
    .map(([y, r]) => [base + y * h, w * r, w * r]);
  const n = detail === 0 ? 4 : detail === 1 ? 8 : 12;
  const rotation = Math.atan2(az, ax) + Math.PI / 4;
  lathe(out, 'molding', [e, s], profile, n, warm, { rotation });
  if (!detail) return;
  const arc = [0.0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (const angle of arc) {
    const rr = w * 0.81;
    const A = P(
      u + rr * Math.cos(angle) - 0.49 * Math.sin(angle),
      base + 1.15,
      v + rr * Math.sin(angle) + 0.49 * Math.cos(angle),
    );
    const B = P(
      u + rr * Math.cos(angle) + 0.49 * Math.sin(angle),
      base + 1.15,
      v + rr * Math.sin(angle) - 0.49 * Math.cos(angle),
    );
    const F = wallFace([A[0], A[2]], [B[0], B[2]]);
    panel(out, 'recess', F, 0, F.length, base + 0.61, base + h * 0.138, 0.22, dark);
    if (detail > 1) {
      const q = F.P(F.length * 0.5, base + h * 0.31, 0.37);
      const left = F.P(0, base + h * 0.205, 0.48),
        right = F.P(F.length, base + h * 0.205, 0.48);
      tri(out, 'molding', left, right, q, cream);
    }
  }
}

function build(out, detail) {
  mainBody(out, detail);
  for (const [u, v, height] of site.spires) spire(out, u, v, height, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
