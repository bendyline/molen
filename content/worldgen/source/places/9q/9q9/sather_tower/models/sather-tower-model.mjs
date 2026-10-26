/** Native Berkeley campanile, four clocks and genuinely open triple-arched belfry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  {
    floorY: F,
    planWidth: W,
    planDepth: D,
    axisU: U,
    axisV: V,
    architecturalSections: A,
  } = p.parameters,
  TAU = Math.PI * 2;
const C = {
  stone: rgb('deddd2'),
  trim: rgb('ece9de'),
  joint: rgb('c8c7bd'),
  green: rgb('506a60'),
  grille: rgb('48534d'),
  bell: rgb('807659'),
  dark: rgb('424e49'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.15 },
  bronze: { slot: 'roof', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.55 },
};
export const nativeEvidence = [],
  recessEvidence = [],
  archEvidence = [],
  clockEvidence = [],
  bellEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mean = (q) => q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], q[1] + F, U[1] * q[0] + V[1] * q[2]];
const direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
function rawT(o, k, q, n, col) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) throw Error('Collapsed Sather triangle');
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col ?? C.stone,
  );
}
function T(o, k, q, n, col) {
  rawT(o, k, q.map(toWorld), n && direction(n), col);
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col) {
  beam(o, k, toWorld(a), toWorld(b), w, d, col ?? C.trim);
}
function frustum(o, k, y0, y1, hx0, hz0, hx1, hz1, col = C.stone, c = [0, 0]) {
  const r = (y, x, z) => [
      [-x + c[0], y, -z + c[1]],
      [x + c[0], y, -z + c[1]],
      [x + c[0], y, z + c[1]],
      [-x + c[0], y, z + c[1]],
    ],
    a = r(y0, hx0, hz0),
    b = r(y1, hx1, hz1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = sub(mean([a[i], a[j], b[j], b[i]]), [c[0], (y0 + y1) / 2, c[1]]);
    Q(o, k, [a[i], a[j], b[j], b[i]], n, col);
  }
  Q(o, k, a, [0, -1, 0], col);
  Q(o, k, b, [0, 1, 0], col);
}
const scaleAt = (y) => 1 - ((1 - A.upperScale) * Math.min(y, A.shaftTop)) / A.shaftTop;
export function facePoint(face, t, y, offset = 0) {
  const x = (W * scaleAt(y)) / 2,
    z = (D * scaleAt(y)) / 2;
  return [
    [t, y, z + offset],
    [x + offset, y, -t],
    [-t, y, -z - offset],
    [-x - offset, y, t],
  ][face];
}
export const faceNormal = (face) =>
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, -1],
    [-1, 0, 0],
  ][face];
const halfAt = (face, y) => ((face % 2 ? D : W) * scaleAt(y)) / 2;
function faceRect(o, k, face, t0, t1, y0, y1, offset, col) {
  Q(
    o,
    k,
    [
      facePoint(face, t0, y0, offset),
      facePoint(face, t1, y0, offset),
      facePoint(face, t1, y1, offset),
      facePoint(face, t0, y1, offset),
    ],
    faceNormal(face),
    col,
  );
}
function faceSolid(o, k, face, t0, t1, y0, y1, front, back, col) {
  const a = [
      facePoint(face, t0, y0, front),
      facePoint(face, t1, y0, front),
      facePoint(face, t1, y1, front),
      facePoint(face, t0, y1, front),
    ],
    b = [
      facePoint(face, t0, y0, back),
      facePoint(face, t1, y0, back),
      facePoint(face, t1, y1, back),
      facePoint(face, t0, y1, back),
    ],
    c = mean([...a, ...b]);
  Q(o, k, a, faceNormal(face), col);
  Q(
    o,
    k,
    b,
    faceNormal(face).map((v) => -v),
    col,
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      q = [a[i], a[j], b[j], b[i]];
    Q(o, k, q, sub(mean(q), c), col);
  }
}
function nativeBase(o) {
  const r = frame.geometry.outline.slice(0, -1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      q = [
        [a[0], F, a[1]],
        [b[0], F, b[1]],
        [b[0], F + A.nativeBaseTop, b[1]],
        [a[0], F + A.nativeBaseTop, a[1]],
      ],
      n = [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2];
    rawT(o, 'stone', q.slice(0, 3), n, C.stone);
    rawT(o, 'stone', [q[0], q[2], q[3]], n, C.stone);
    for (const [y, nY] of [
      [F, -1],
      [F + A.nativeBaseTop, 1],
    ])
      rawT(
        o,
        'stone',
        [
          [0, y, 0],
          [a[0], y, a[1]],
          [b[0], y, b[1]],
        ],
        [0, nY, 0],
        C.stone,
      );
    nativeEvidence.push([a[0], F, a[1]]);
  }
}
function shaft(o, lod) {
  nativeBase(o);
  for (let face = 0; face < 4; face++) {
    const holes =
      lod === 0
        ? []
        : A.slitLevels.map((y) => ({
            t0: -A.slitWidth / 2,
            t1: A.slitWidth / 2,
            y0: y,
            y1: y + A.slitHeight,
            depth: A.slitDepth,
          }));
    if (face === 0 && lod > 0)
      holes.push({ t0: -0.56, t1: 0.56, y0: 1.15, y1: 3.45, depth: 0.3, door: true });
    const ys = [A.nativeBaseTop, A.shaftTop, ...holes.flatMap((w) => [w.y0, w.y1])]
      .sort((a, b) => a - b)
      .filter((v, i, a) => !i || v - a[i - 1] > 1e-7);
    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j],
        y1 = ys[j + 1],
        hm = (y0 + y1) / 2,
        w = holes.find((q) => hm > q.y0 && hm < q.y1),
        ts = w
          ? [
              [-1, w.t0],
              [w.t1, 1],
            ]
          : [[-1, 1]];
      for (const [a, b] of ts) {
        const t = (v, y) => (v === -1 ? -halfAt(face, y) : v === 1 ? halfAt(face, y) : v);
        Q(
          o,
          'stone',
          [
            facePoint(face, t(a, y0), y0),
            facePoint(face, t(b, y0), y0),
            facePoint(face, t(b, y1), y1),
            facePoint(face, t(a, y1), y1),
          ],
          faceNormal(face),
        );
      }
    }
    for (const w of holes) {
      const a = [
          facePoint(face, w.t0, w.y0),
          facePoint(face, w.t1, w.y0),
          facePoint(face, w.t1, w.y1),
          facePoint(face, w.t0, w.y1),
        ],
        b = a.map((q) =>
          sub(
            q,
            faceNormal(face).map((v) => v * w.depth),
          ),
        ),
        c = mean(a);
      Q(o, 'metal', b, faceNormal(face), C.dark);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          q = [a[i], a[j], b[j], b[i]];
        Q(o, 'stone', q, sub(c, mean([a[i], a[j]])), C.trim);
      }
      if (lod > 1 && !w.door)
        B(
          o,
          'metal',
          facePoint(face, 0, w.y0 + 0.07, -0.18),
          facePoint(face, 0, w.y1 - 0.07, -0.18),
          0.035,
          0.045,
          C.grille,
        );
      recessEvidence.push({ face, ...w, front: a, back: b });
    }
    if (lod === 0)
      for (const y of A.slitLevels)
        faceRect(o, 'metal', face, -0.12, 0.12, y, y + 1.12, 0.015, C.dark);
    if (lod === 3) {
      // Original individual stone skins leave recessed joints; subtract real slit/door rectangles.
      const rows = 96,
        cols = 6;
      for (let row = 0; row < rows; row++) {
        const y0 = A.nativeBaseTop + ((A.shaftTop - A.nativeBaseTop) * row) / rows + 0.018,
          y1 = A.nativeBaseTop + ((A.shaftTop - A.nativeBaseTop) * (row + 1)) / rows - 0.018,
          hw = halfAt(face, (y0 + y1) / 2);
        for (let col = 0; col < cols; col++) {
          const x0 = -hw + (col * 2 * hw) / cols + 0.014,
            x1 = -hw + ((col + 1) * 2 * hw) / cols - 0.014;
          let rects = [[x0, x1, y0, y1]];
          for (const w of holes) {
            const next = [];
            for (const [a, b, c, d] of rects) {
              if (b <= w.t0 || a >= w.t1 || d <= w.y0 || c >= w.y1) {
                next.push([a, b, c, d]);
                continue;
              }
              if (c < w.y0) next.push([a, b, c, w.y0]);
              if (d > w.y1) next.push([a, b, w.y1, d]);
              const lo = Math.max(c, w.y0),
                hi = Math.min(d, w.y1);
              if (a < w.t0) next.push([a, w.t0, lo, hi]);
              if (b > w.t1) next.push([w.t1, b, lo, hi]);
            }
            rects = next;
          }
          const tint = (row * 7 + col * 11 + face * 3) % 9,
            color = C.stone.map((v) => v * (0.975 + tint * 0.004));
          for (const [a, b, c, d] of rects)
            if (b - a > 0.006 && d - c > 0.006)
              faceSolid(o, 'stone', face, a, b, c, d, 0.027, 0.002, color);
        }
      }
    }
  }
  const y = A.shaftTop;
  frustum(
    o,
    'stone',
    y - 0.04,
    y + 0.16,
    (W * scaleAt(y)) / 2,
    (D * scaleAt(y)) / 2,
    (W * scaleAt(y)) / 2,
    (D * scaleAt(y)) / 2,
  );
}
function dial(o, lod, face) {
  const y = A.clockCenter,
    r = A.clockRadius,
    n = faceNormal(face),
    P = (x, z, off = 0.055) => facePoint(face, x, y + z, off),
    N = [12, 24, 48, 72][lod];
  if (lod > 0)
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N;
      Q(
        o,
        'stone',
        [
          P(r * Math.sin(a), r * Math.cos(a)),
          P(r * Math.sin(b), r * Math.cos(b)),
          P((r - 0.075) * Math.sin(b), (r - 0.075) * Math.cos(b)),
          P((r - 0.075) * Math.sin(a), (r - 0.075) * Math.cos(a)),
        ],
        n,
        C.trim,
      );
    }
  const stroke = (x0, y0, x1, y1, width = 0.035) => {
    const dx = x1 - x0,
      dy = y1 - y0,
      h = Math.hypot(dx, dy),
      a = (width * dy) / 2 / h,
      b = (-width * dx) / 2 / h;
    Q(
      o,
      'metal',
      [
        P(x0 + a, y0 + b, 0.082),
        P(x1 + a, y1 + b, 0.082),
        P(x1 - a, y1 - b, 0.082),
        P(x0 - a, y0 - b, 0.082),
      ],
      n,
      C.green,
    );
  };
  const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      radial = [Math.sin(a), Math.cos(a)],
      tangent = [Math.cos(a), -Math.sin(a)],
      cx = radial[0] * 2.91,
      cy = radial[1] * 2.91;
    if (lod === 0 && i % 3 !== 0) continue;
    if (lod < 2) {
      stroke(
        radial[0] * 2.67,
        radial[1] * 2.67,
        radial[0] * 3.06,
        radial[1] * 3.06,
        lod === 0 ? 0.075 : 0.045,
      );
      continue;
    }
    const txt = romans[i],
      cw = 0.18,
      gap = 0.055,
      total = txt.length * (cw + gap) - gap,
      xy = (u, v) => [cx + tangent[0] * u + radial[0] * v, cy + tangent[1] * u + radial[1] * v];
    for (let j = 0; j < txt.length; j++) {
      const x = -total / 2 + j * (cw + gap),
        lines =
          txt[j] === 'I'
            ? [[cw / 2, -0.25, cw / 2, 0.25]]
            : txt[j] === 'V'
              ? [
                  [0, 0.25, cw / 2, -0.25],
                  [cw / 2, -0.25, cw, 0.25],
                ]
              : [
                  [0, -0.25, cw, 0.25],
                  [0, 0.25, cw, -0.25],
                ];
      for (const [x0, z0, x1, z1] of lines) {
        const a = xy(x + x0, z0),
          b = xy(x + x1, z1);
        stroke(...a, ...b, 0.032);
      }
    }
  }
  for (const [a, len, w] of [
    [(24 * TAU) / 60, 2.5, 0.13],
    [((10 + 24 / 60) * TAU) / 12, 1.85, 0.2],
  ]) {
    const v = [Math.sin(a), Math.cos(a)],
      t = [v[1], -v[0]],
      q = [
        P(-v[0] * 0.38 - t[0] * w, -v[1] * 0.38 - t[1] * w, 0.12),
        P(v[0] * len, v[1] * len, 0.12),
        P(-v[0] * 0.38 + t[0] * w, -v[1] * 0.38 + t[1] * w, 0.12),
      ];
    T(o, 'metal', q, n, C.green);
  }
  if (lod > 0) {
    const nn = lod === 1 ? 6 : 12;
    for (let i = 0; i < nn; i++)
      T(
        o,
        'metal',
        [
          P(0, 0, 0.14),
          P(0.23 * Math.cos((i * TAU) / nn), 0.23 * Math.sin((i * TAU) / nn), 0.14),
          P(0.23 * Math.cos(((i + 1) * TAU) / nn), 0.23 * Math.sin(((i + 1) * TAU) / nn), 0.14),
        ],
        n,
        C.green,
      );
  }
  clockEvidence.push({
    face,
    center: facePoint(face, 0, y, 0.08),
    radius: r,
    staticTime: '10:24',
    originalNumerals: lod > 1,
  });
}
function column(o, face, t, offset, lod) {
  const N = [4, 4, 12, 20][lod],
    profile =
      lod === 0
        ? [
            [A.balustradeTop, 0.15],
            [A.archSpring, 0.15],
          ]
        : [
            [A.balustradeTop, 0.24],
            [A.balustradeTop + 0.23, 0.24],
            [A.balustradeTop + 0.36, 0.145],
            [A.archSpring - 0.35, 0.145],
            [A.archSpring - 0.18, 0.26],
            [A.archSpring, 0.26],
          ],
    c = facePoint(face, t, 0, offset);
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const [y, r] = profile[j],
        [Y, R] = profile[j + 1],
        a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N,
        P = (a, y, r) => [c[0] + r * Math.cos(a), y, c[2] + r * Math.sin(a)];
      Q(
        o,
        'stone',
        [P(a, y, r), P(b, y, r), P(b, Y, R), P(a, Y, R)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        C.trim,
      );
    }
}
function belfry(o, lod) {
  const hx = (W * A.upperScale) / 2,
    hz = (D * A.upperScale) / 2,
    bayCenters = [-2.52, 0, 2.52],
    r = A.archRadius,
    N = [3, 6, 16, 28][lod],
    outer = 0.03,
    inner = -0.65;
  frustum(
    o,
    'stone',
    A.shaftTop + 0.16,
    A.bellFloor,
    hx + 0.13,
    hz + 0.13,
    hx + 0.23,
    hz + 0.23,
    C.trim,
  );

  for (let face = 0; face < 4; face++) {
    const hw = halfAt(face, A.bellFloor);
    for (const [a, b] of [
      [-hw, -3.64],
      [3.64, hw],
    ])
      faceSolid(o, 'stone', face, a, b, A.bellFloor, A.archWallTop, outer, inner, C.stone);
    for (const [a, b] of [
      [-1.4, -1.12],
      [1.12, 1.4],
    ])
      faceSolid(o, 'stone', face, a, b, A.archSpring, A.archWallTop, outer, inner, C.trim);
    if (lod === 0) {
      faceSolid(o, 'stone', face, -3.66, 3.66, A.bellFloor, A.balustradeTop, 0.03, -0.65, C.trim);
    } else {
      faceSolid(
        o,
        'stone',
        face,
        -3.66,
        3.66,
        A.bellFloor,
        A.bellFloor + 0.22,
        0.08,
        -0.65,
        C.trim,
      );
      faceSolid(
        o,
        'stone',
        face,
        -3.66,
        3.66,
        A.balustradeTop - 0.2,
        A.balustradeTop,
        0.08,
        -0.65,
        C.trim,
      );
      const count = lod === 1 ? 8 : 24;
      for (let i = 0; i <= count; i++) {
        const t = -3.6 + (7.2 * i) / count;
        faceSolid(
          o,
          'stone',
          face,
          t - 0.055,
          t + 0.055,
          A.bellFloor + 0.22,
          A.balustradeTop - 0.2,
          -0.03,
          -0.23,
          C.trim,
        );
      }
    }
    for (const t of [-1.26, 1.26]) {
      if (lod === 0) column(o, face, t, -0.23, lod);
      else for (const d of [-0.13, -0.48]) column(o, face, t, d, lod);
    }
    for (const center of bayCenters) {
      for (let i = 0; i < N; i++) {
        const a = Math.PI - (i * Math.PI) / N,
          b = Math.PI - ((i + 1) * Math.PI) / N,
          t0 = center + r * Math.cos(a),
          t1 = center + r * Math.cos(b),
          y0 = A.archSpring + r * Math.sin(a),
          y1 = A.archSpring + r * Math.sin(b),
          q = (off) => [
            facePoint(face, t0, y0, off),
            facePoint(face, t1, y1, off),
            facePoint(face, t1, A.archWallTop, off),
            facePoint(face, t0, A.archWallTop, off),
          ];
        Q(o, 'stone', q(outer), faceNormal(face), C.trim);
        Q(
          o,
          'stone',
          q(inner),
          faceNormal(face).map((v) => -v),
          C.trim,
        );
        Q(
          o,
          'stone',
          [
            facePoint(face, t0, y0, outer),
            facePoint(face, t1, y1, outer),
            facePoint(face, t1, y1, inner),
            facePoint(face, t0, y0, inner),
          ],
          sub(
            facePoint(face, center, A.archSpring, outer),
            mean([facePoint(face, t0, y0, outer), facePoint(face, t1, y1, outer)]),
          ),
          C.trim,
        );
      }
      const bars = [0, 2, 6, 10][lod],
        rails = [0, 1, 4, 7][lod];
      for (let i = 1; i <= bars; i++) {
        const t = center - r + (2 * r * i) / (bars + 1),
          top = A.archSpring + Math.sqrt(Math.max(0, r * r - (t - center) * (t - center))) - 0.06;
        B(
          o,
          'metal',
          facePoint(face, t, A.balustradeTop, -0.28),
          facePoint(face, t, top, -0.28),
          [0, 0.045, 0.035, 0.028][lod],
          0.045,
          C.grille,
        );
      }
      for (let j = 1; j <= rails; j++) {
        const y = A.balustradeTop + ((A.archSpring - A.balustradeTop) * j) / (rails + 1);
        B(
          o,
          'metal',
          facePoint(face, center - r + 0.05, y, -0.28),
          facePoint(face, center + r - 0.05, y, -0.28),
          0.035,
          0.045,
          C.grille,
        );
      }
      archEvidence.push({
        face,
        center,
        radius: r,
        floor: A.balustradeTop,
        spring: A.archSpring,
        top: A.archWallTop,
        depth: 0.68,
      });
    }
  }
  frustum(o, 'stone', A.archWallTop, A.archWallTop + 0.26, hx, hz, hx + 0.12, hz + 0.12, C.trim);
  const bands =
    lod === 0
      ? [[71.51, 73.45, 0.33]]
      : [
          [71.51, 71.9, 0.13],
          [71.9, 72.85, 0.05],
          [72.85, 73.13, 0.24],
          [73.13, 73.45, 0.4],
        ];
  for (const [y, Y, ex] of bands)
    frustum(o, 'stone', y, Y, hx + ex, hz + ex, hx + ex, hz + ex, C.trim);
  if (lod > 1)
    for (let face = 0; face < 4; face++)
      for (let i = 0; i < 18; i++) {
        const t = -4.15 + (i * 8.3) / 17;
        faceSolid(
          o,
          'stone',
          face,
          t - 0.095,
          t + 0.095,
          72.12,
          72.67,
          0.18,
          -0.02,
          i % 2 ? C.stone : C.trim,
        );
      }
  if (lod > 0) {
    const bells = lod === 1 ? 2 : 6;
    for (let i = 0; i < bells; i++) {
      const x = ((i % 3) - 1) * 1.55,
        z = i < 3 ? -0.85 : 0.85,
        y = 64.6 + (i % 3) * 0.7,
        r = 0.42 + (i % 3) * 0.08,
        N = [0, 4, 12, 20][lod],
        prof = [
          [y + 1.05, r * 0.2],
          [y + 0.9, r * 0.42],
          [y + 0.35, r * 0.65],
          [y + 0.12, r],
          [y, r],
          [y + 0.03, r - 0.07],
          [y + 0.22, r * 0.7],
          [y + 0.8, r * 0.27],
        ];
      for (let j = 0; j < prof.length - 1; j++)
        for (let k = 0; k < N; k++) {
          const a = (k * TAU) / N,
            b = ((k + 1) * TAU) / N,
            [v, s] = prof[j],
            [Y, R] = prof[j + 1],
            P = (a, y, r) => [x + r * Math.cos(a), y, z + r * Math.sin(a)],
            sgn = j >= 5 ? -1 : 1;
          Q(
            o,
            'bronze',
            [P(a, v, s), P(b, v, s), P(b, Y, R), P(a, Y, R)],
            [sgn * Math.cos((a + b) / 2), j === 4 ? -1 : 0, sgn * Math.sin((a + b) / 2)],
            C.bell,
          );
        }
      B(o, 'metal', [x, y + 1, z], [x, 67.4, z], 0.045, 0.06, C.grille);
      if (lod > 1) B(o, 'bronze', [x, y + 0.55, z], [x, y - 0.1, z], 0.055, 0.055, C.bell);
      bellEvidence.push({ center: [x, y, z], radius: r, visibleApproximation: true });
    }
    B(o, 'metal', [-2.8, 67.4, -0.85], [2.8, 67.4, -0.85], 0.1, 0.14, C.grille);
    B(o, 'metal', [-2.8, 67.4, 0.85], [2.8, 67.4, 0.85], 0.1, 0.14, C.grille);
  }
}
function crown(o, lod) {
  const hx = (W * A.upperScale) / 2,
    hz = (D * A.upperScale) / 2;
  if (lod === 0) frustum(o, 'stone', A.corniceTop, A.parapetTop, hx, hz, hx, hz, C.stone);
  else {
    frustum(o, 'stone', A.corniceTop, A.corniceTop + 0.3, hx, hz, hx, hz, C.trim);
    for (let face = 0; face < 4; face++) {
      faceSolid(
        o,
        'stone',
        face,
        -halfAt(face, 74),
        halfAt(face, 74),
        A.parapetTop - 0.28,
        A.parapetTop,
        0.08,
        -0.32,
        C.trim,
      );
      const n = lod === 1 ? 6 : 10;
      for (let i = 0; i <= n; i++) {
        const t = -4.1 + (8.2 * i) / n;
        faceSolid(
          o,
          'stone',
          face,
          t - 0.09,
          t + 0.09,
          A.corniceTop + 0.3,
          A.parapetTop - 0.28,
          -0.03,
          -0.28,
          C.trim,
        );
      }
    }
  }
  frustum(
    o,
    'stone',
    A.parapetTop,
    A.pyramidBase,
    A.pyramidHalfWidth + 0.16,
    A.pyramidHalfWidth + 0.16,
    A.pyramidHalfWidth + 0.16,
    A.pyramidHalfWidth + 0.16,
    C.trim,
  );
  frustum(
    o,
    'stone',
    A.pyramidBase,
    A.pyramidTop,
    A.pyramidHalfWidth,
    A.pyramidHalfWidth,
    A.pyramidTopHalfWidth,
    A.pyramidTopHalfWidth,
    C.trim,
  );
  if (lod > 0)
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        B(
          o,
          'stone',
          [x * (A.pyramidHalfWidth + 0.025), A.pyramidBase, z * (A.pyramidHalfWidth + 0.025)],
          [x * (A.pyramidTopHalfWidth + 0.025), A.pyramidTop, z * (A.pyramidTopHalfWidth + 0.025)],
          0.12,
          0.12,
          C.trim,
        );
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const c = [x * (hx - 0.24), z * (hz - 0.24)];
      frustum(o, 'stone', A.pinnacleBase, A.pinnacleBase + 0.45, 0.44, 0.44, 0.44, 0.44, C.trim, c);
      frustum(
        o,
        'stone',
        A.pinnacleBase + 0.45,
        A.pinnacleStoneTop,
        0.36,
        0.36,
        0.11,
        0.11,
        C.trim,
        c,
      );
      frustum(
        o,
        'metal',
        A.pinnacleStoneTop,
        A.pinnacleTip,
        0.095,
        0.095,
        0.015,
        0.015,
        C.green,
        c,
      );
      if (lod > 1)
        for (const y of [75.25, 76.25, 77.25])
          frustum(
            o,
            'stone',
            y,
            y + 0.12,
            0.29 - (y - 75.25) * 0.04,
            0.29 - (y - 75.25) * 0.04,
            0.29 - (y - 75.25) * 0.04,
            0.29 - (y - 75.25) * 0.04,
            C.stone,
            c,
          );
    }
  frustum(o, 'stone', A.pyramidTop, A.lanternBase, 0.65, 0.65, 0.65, 0.65, C.trim);
  frustum(o, 'metal', A.lanternBase, A.lanternBase + 0.2, 0.69, 0.69, 0.69, 0.69, C.green);
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      B(
        o,
        'metal',
        [x * 0.49, A.lanternBase + 0.2, z * 0.49],
        [x * 0.49, A.lanternTop, z * 0.49],
        lod === 0 ? 0.11 : 0.075,
        0.09,
        C.green,
      );
  if (lod > 1)
    for (const y of [90.7, 91.8])
      for (let i = 0; i < 4; i++)
        B(
          o,
          'metal',
          facePoint(i, -0.5, y, -halfAt(i, y) + 0.5),
          facePoint(i, 0.5, y, -halfAt(i, y) + 0.5),
          0.055,
          0.055,
          C.green,
        );
  frustum(o, 'metal', A.lanternTop, A.lanternCap, 0.63, 0.63, 0.2, 0.2, C.green);
  frustum(o, 'metal', A.lanternCap, A.finialTop, 0.07, 0.07, 0.005, 0.005, C.green);
}
export function buildSatherTower(o, _frame, lod = 3) {
  for (const e of [nativeEvidence, recessEvidence, archEvidence, clockEvidence, bellEvidence])
    e.length = 0;
  shaft(o, lod);
  for (let face = 0; face < 4; face++) dial(o, lod, face);
  belfry(o, lod);
  crown(o, lod);
}
export const satherTowerSkyline = (o) => buildSatherTower(o, null, 0),
  satherTowerDistrict = (o) => buildSatherTower(o, null, 1),
  satherTowerStreet = (o) => buildSatherTower(o, null, 2),
  satherTowerCloseup = (o) => buildSatherTower(o, null, 3);
export const satherTowerModel = {
  id: 'sather_tower',
  key: 'sather_tower',
  cell: '9q/9q9',
  title: 'Sather Tower',
  wikidataId: 'Q357019',
  category: p.category,
  recipe: 'sather-tower-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildSatherTower,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Berkeley Campanile: native seven-control pale tapering stone tower, physical recessed shaft slits/closed doorway, four original Roman numeral clocks/hands, twelve genuine round-arched belfry openings/paired slender columns/physical iron grilles and low balustrades, bounded visible hanging bells, major cornices/upper parapet/four corner pinnacles/steep stone pyramid/open green metal lantern and finial. Published Qualla2025creatorCC0 upper original first, distinct2013creatorCC0 full-height view; original geometry only, no copied pixels. Native10.55x10.28m extent; official307ft overallheight/200ft observationfloor. Exact hidden sections/census/door/fine carving/finish/groundcontact remain original estimates.',
  camera: [115, F + 74, 140],
  lookAt: [0, F + 45, 0],
  portableGroundY: F - 0.12,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['stone_granite', 'metal_painted', 'metal_bronze_cast'],
  qaCameras: [
    {
      name: 'whole-opposite-seven-control-tower',
      position: [-116, F + 74, -134],
      lookAt: [0, F + 45, 0],
    },
    {
      name: 'four-clocks-and-open-triple-belfry',
      position: [17, F + 65, 26],
      lookAt: [0, F + 63, 0],
    },
    {
      name: 'shaft-stone-coursing-and-physical-slit',
      position: [9, F + 30, 15],
      lookAt: [0, F + 29, 0],
    },
    {
      name: 'native-base-and-closed-estimated-door',
      position: [11, F + 5, 17],
      lookAt: [0, F + 2.5, 0],
    },
    {
      name: 'pinnacles-pyramid-open-lantern-and-spike',
      position: [20, F + 94, 27],
      lookAt: [0, F + 83, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/sather-tower-runtime-overlay.mjs',
    level: 'skyline',
    export: 'satherTowerSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'satherTowerDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'satherTowerStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'satherTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Exact cleared published2025RyanSchwark selfCC0 upper original first and distinct2013Daderot selfCC0 whole-height original individually inspected/nativeSHA1matched; rejected published and conflictedhero imagery excluded without repair or same-photo bypass. Clock numerals/hands original geometry with static10:24; all four faces original estimated repetition. Carillon shapes are six approximate visible bells, not a61bell interior reconstruction. Fine sculptural friezes reduced to original geometric articulation; no copiedart/inscriptions/photos/interiorrooms/fossils/adjacentgrounds/trees.',
    'Original independent256m129x12916641sample/one rawtile/fixedSW96.7538m provider-relative field frozen before floor/section/taper/geometry. Floor1.7039m fixed once from original centre sample before geometry; no refit/flatten/reacquisition/late modelraising. Exact base/threshold/source-grade contact unresolved; geographic preview/replaceFootprint=false. Flatground/syntheticneighbors are review fixtures.',
  ],
};
