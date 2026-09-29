/** BC Place: 2011 cable roof over the retained eight-segment concrete stadium. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { bcplacePlan as plan } from './bcplace-plan.mjs';
import { lathe as latheY, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.87, 0.88, 0.85],
  concrete = [0.56, 0.58, 0.56],
  steel = [0.53, 0.58, 0.59],
  dark = [0.02, 0.032, 0.037],
  red = [0.59, 0.026, 0.038],
  grey = [0.43, 0.47, 0.48];
const E = (a, rx, rz, y = 0) => [Math.sin(a) * rx, y, Math.cos(a) * rz];
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const lathe = (out, slot, profile, color, n = 96) =>
  latheY(
    out,
    slot,
    profile.map(([r, y]) => [y, r]),
    color,
    n,
  );
function rounded(a, hx, hz, r, y = 0) {
  const x = Math.sin(a),
    z = Math.cos(a);
  let lo = 0,
    hi = Math.hypot(hx, hz);
  for (let i = 0; i < 28; i++) {
    const d = (lo + hi) / 2;
    if (
      Math.hypot(Math.max(0, Math.abs(d * x) - (hx - r)), Math.max(0, Math.abs(d * z) - (hz - r))) >
      r
    )
      hi = d;
    else lo = d;
  }
  return [x * lo, y, z * lo];
}
function metricFace(out, slot, points, color, expected) {
  let ps = points,
    n = normalFor(...ps.slice(0, 3));
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    ps = [...ps].reverse();
    n = normalFor(...ps.slice(0, 3));
  }
  out.addQuad(
    slot,
    'metric:uv',
    ps,
    n,
    ps.map((p) => [p[0], p[2]]),
    color,
  );
}
function rail(out, pts, h = 1.06) {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const y of [h, 0.52])
      tube(
        out,
        'metal',
        pts[i].map((v, j) => v + (j === 1 ? y : 0)),
        pts[i + 1].map((v, j) => v + (j === 1 ? y : 0)),
        0.024,
        steel,
        6,
      );
    tube(
      out,
      'metal',
      pts[i],
      pts[i].map((v, j) => v + (j === 1 ? h : 0)),
      0.026,
      steel,
      6,
    );
  }
}
function ring(out, rx, rz, y, r = 0.08, color = steel, n = 288) {
  curve(
    out,
    Array.from({ length: n + 1 }, (_, i) => E((i * TAU) / n, rx, rz, y)),
    r,
    color,
    'metal',
    8,
  );
}
function annulus(out, rx, rz, ix, iz, y, t, color = concrete) {
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288,
      p = E(a, rx, rz, y),
      q = E(b, rx, rz, y),
      P = E(a, ix, iz, y),
      Q = E(b, ix, iz, y);
    face(out, 'concrete', [p, q, Q, P], color, [0, 1, 0]);
    face(
      out,
      'concrete',
      [p.map((v, j) => v - (j === 1 ? t : 0)), q.map((v, j) => v - (j === 1 ? t : 0)), q, p],
      color,
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
}

function oldStructure(out) {
  // Concrete bowl top35m and54radial frames are documented by the seismic retrofit engineers.
  for (const y of [7.2, 14.1, 21.1, 28.2, 35]) annulus(out, 96, 116, 86, 106, y, 0.48);
  for (let i = 0; i < 54; i++) {
    const a = (i * TAU) / 54;
    beam(out, 'concrete', E(a, 91, 111, 0), E(a, 95, 115, 35), 1.05, 1.45, concrete);
    for (const tier of tiers) {
      const under = (row) => {
        const p = seat(a, tier, row);
        return [p[0], Math.max(0.7, p[1] - 1.1), p[2]];
      };
      for (let row = 0; row < tier.rows; row += 4)
        beam(out, 'concrete', under(row), under(Math.min(tier.rows, row + 4)), 0.72, 1.1, concrete);
    }
    for (const y of [7.2, 14.1, 21.1, 28.2])
      beam(out, 'concrete', E(a, 82, 102, y), E(a, 96, 116, y), 0.75, 0.72, concrete);
  }
  // Opaque silver fascia bands alternate with recessed glazing and deep concrete mullions.
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288;
    for (const [y, h, slot, c] of [
      [0.1, 7.2, 'concrete', concrete],
      [7.3, 2.2, 'metal', white],
      [9.5, 4.7, 'glass', [0.085, 0.14, 0.16]],
      [14.2, 2.5, 'metal', white],
      [16.7, 4.5, 'glass', [0.07, 0.12, 0.14]],
      [21.2, 2.4, 'metal', white],
      [23.6, 4.7, 'glass', [0.075, 0.12, 0.14]],
      [28.3, 6.7, 'metal', [0.53, 0.56, 0.57]],
    ]) {
      const rx = slot === 'glass' ? 94.8 : 96,
        rz = slot === 'glass' ? 114.8 : 116;
      face(
        out,
        slot,
        [E(a, rx, rz, y), E(b, rx, rz, y), E(b, rx, rz, y + h), E(a, rx, rz, y + h)],
        c,
        [Math.sin(a), 0, Math.cos(a)],
      );
      if (slot === 'glass')
        for (const [height, direction] of [
          [y, 1],
          [y + h, -1],
        ])
          face(
            out,
            'metal',
            [
              E(a, 96, 116, height),
              E(b, 96, 116, height),
              E(b, rx, rz, height),
              E(a, rx, rz, height),
            ],
            white,
            [0, direction, 0],
          );
    }
    if (i % 2 === 0)
      beam(
        out,
        'metal',
        E(a, 96.07, 116.07, 0),
        E(a, 96.07, 116.07, 35),
        0.06,
        0.09,
        [0.34, 0.38, 0.39],
      );
    if (i % 8 === 0) {
      const o = transformed(out, a, E(a, 96.2, 116.2, 0.2));
      box(o, 'metal', [-2.1, 0, -0.18], [2.1, 3.2, 0.18], white);
      face(
        o,
        'glass',
        [
          [-1.9, 0.12, 0.2],
          [1.9, 0.12, 0.2],
          [1.9, 3.0, 0.2],
          [-1.9, 3.0, 0.2],
        ],
        [0.06, 0.11, 0.13],
        [0, 0, 1],
      );
      for (const x of [-0.63, 0.63])
        box(o, 'metal', [x - 0.04, 0.1, 0.19], [x + 0.04, 3.05, 0.28], steel);
    }
  }
  // Eight separate exposed switchback ramp structures survive beneath the new roof.
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) * TAU) / 8,
      o = transformed(out, a, E(a, 96, 116, 0));
    for (let k = 0; k < 4; k++) {
      const y = 3.5 + k * 6.6,
        rev = k % 2 === 1;
      beam(o, 'concrete', [rev ? 14 : -14, y, 5], [rev ? -14 : 14, y + 6.1, 5], 7, 0.5, concrete);
      for (const z of [1.5, 8.5])
        rail(
          o,
          Array.from({ length: 19 }, (_, j) => [
            rev ? 14 - (j * 28) / 18 : -14 + (j * 28) / 18,
            y + (j * 6.1) / 18,
            z,
          ]),
        );
      box(o, 'concrete', [-15, y - 0.55, 0], [15, y, 1.5], concrete);
      for (const x of [-13.5, 13.5])
        beam(o, 'concrete', [x, 0, 4.5], [x, y + 6.2, 4.5], 0.72, 0.72, concrete);
    }
    box(o, 'concrete', [-15, 0, -1], [15, 0.25, 11], concrete);
  }
}

function envelope(out) {
  // 36facade bays; each bay has eight columns by four inflated ETFE cushions.
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36,
      b = ((i + 1) * TAU) / 36;
    for (let j = 0; j < 8; j++)
      for (let k = 0; k < 4; k++) {
        const F = (u, v) => {
          const ang = a + ((b - a) * (j + u)) / 8,
            t = (k + v) / 4;
          const bulge = 0.18 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          return E(ang, 96 + 14 * t + bulge, 116 + 14.5 * t + bulge, 35.15 + 12.15 * t);
        };
        for (let u = 0; u < 8; u++)
          for (let v = 0; v < 6; v++)
            face(
              out,
              'etfe',
              [
                F(u / 8, v / 6),
                F((u + 1) / 8, v / 6),
                F((u + 1) / 8, (v + 1) / 6),
                F(u / 8, (v + 1) / 6),
              ],
              [0.7, 0.8, 0.84],
              [Math.sin(a), 0, Math.cos(a)],
            );
        if (k === 0)
          curve(
            out,
            Array.from({ length: 9 }, (_, t) => F(t / 8, 0)),
            0.024,
            steel,
          );
        curve(
          out,
          Array.from({ length: 9 }, (_, t) => F(t / 8, 1)),
          0.024,
          steel,
        );
        curve(
          out,
          Array.from({ length: 5 }, (_, t) => F(0, t / 4)),
          0.025,
          steel,
        );
      }
    beam(out, 'metal', E(a, 96, 116, 35), E(a, 110, 130.5, 47.5), 0.72, 0.9, white);
    const joint = transformed(out, a, E(a, 96, 116, 35));
    box(joint, 'metal', [-0.65, -0.6, -0.22], [0.65, 0.7, 0.22], white);
    for (const x of [-0.4, 0.4])
      for (const y of [-0.32, 0.4])
        tube(joint, 'metal', [x, y, 0.23], [x, y, 0.32], 0.075, steel, 12);
  }
  ring(out, 110, 130.5, 47.5, 0.65, white);
  ring(out, 96, 116, 35, 0.4, white);
  // Horizontal ventilating louvers at the lower glazing sill.
  for (let j = 0; j < 10; j++)
    ring(out, 96.2 + j * 0.022, 116.2 + j * 0.022, 33.1 + j * 0.15, 0.052, [0.24, 0.29, 0.31]);
}

const mastBase = (a) => E(a, 96, 116, 35),
  mastTip = (a) =>
    E(
      a,
      96 + 50 * Math.sin(Math.PI / 9),
      116 + 50 * Math.sin(Math.PI / 9),
      35 + 50 * Math.cos(Math.PI / 9),
    );
const roofOuter = (a) => E(a, 110, 130.5, 47.5);
const roofInner = (a) => E(a, 42.5, 50, 55.5);
const fixed = (a, t) =>
  mix(roofOuter(a), roofInner(a), t).map((v, j) => v - (j === 1 ? 2.5 * Math.sin(Math.PI * t) : 0));
const upper = (a, t) =>
  mix(mastTip(a), E(a, 9.1, 9.1, 61.3), t).map(
    (v, j) => v - (j === 1 ? 5 * Math.sin(Math.PI * t) : 0),
  );
const lower = (a, t) =>
  mix(roofOuter(a), E(a, 9.1, 9.1, 59.6), t).map(
    (v, j) => v - (j === 1 ? 2.2 * Math.sin(Math.PI * t) : 0),
  );
function masts(out) {
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36,
      p = mastBase(a),
      q = mastTip(a);
    // Slender tapered polygonal box mast; four faces and end plates remain actual geometry.
    const across = [Math.cos(a), 0, -Math.sin(a)],
      n = [
        Math.sin(a) * Math.cos(Math.PI / 9),
        -Math.sin(Math.PI / 9),
        Math.cos(a) * Math.cos(Math.PI / 9),
      ];
    const corners = (v, w, d) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => v.map((x, k) => x + s * across[k] * w + t * n[k] * d));
    const A = corners(p, 0.78, 0.68),
      B = corners(q, 0.3, 0.31);
    for (let j = 0; j < 4; j++)
      face(out, 'metal', [A[j], A[(j + 1) % 4], B[(j + 1) % 4], B[j]], white, [
        (A[j][0] + A[(j + 1) % 4][0]) / 2 - p[0],
        (A[j][1] + A[(j + 1) % 4][1]) / 2 - p[1],
        (A[j][2] + A[(j + 1) % 4][2]) / 2 - p[2],
      ]);
    face(
      out,
      'metal',
      B,
      white,
      q.map((v, j) => v - p[j]),
    );
    beam(out, 'metal', mix(p, q, 0.245), roofOuter(a), 0.85, 0.82, white);
    for (const s of [-1, 1]) {
      const P = roofOuter(a + s * 0.023),
        T = q.map((v, j) => v + across[j] * s * 0.15);
      tube(out, 'metal', P, T, 0.085, steel, 12);
      tube(out, 'metal', P, mix(P, T, 0.045), 0.17, white, 16);
    }
    for (const f of [upper, lower])
      curve(
        out,
        Array.from({ length: 41 }, (_, j) => f(a, j / 40)),
        0.063,
        steel,
        'metal',
        12,
      );
    for (let j = 1; j <= 10; j++) {
      const t = j / 11,
        U = upper(a, t),
        L = lower(a, t);
      tube(out, 'metal', U, L, 0.025, steel, 8);
      const o = transformed(out, a, L);
      box(o, 'metal', [-0.2, -0.18, -0.18], [0.2, 0.18, 0.18], white);
    }
    // Ten real travelling carriage proxies along each radial route in the open aperture.
    for (let j = 0; j < 10; j++) {
      const p = mix(roofInner(a), E(a, 10, 10, 59.4), (j + 0.5) / 10),
        o = transformed(out, a, p);
      box(o, 'metal', [-0.15, -0.12, -0.24], [0.15, 0.12, 0.24], steel);
      for (const z of [-0.13, 0.13]) tube(o, 'metal', [-0.2, 0, z], [0.2, 0, z], 0.095, dark, 12);
    }
  }
}
function roof(out) {
  // Fixed PTFE roof has36outer and36inner fabric panels, with arched radial profiles.
  for (let i = 0; i < 36; i++)
    for (let j = 0; j < 2; j++) {
      const P = (u, v) => {
        const a = ((i + u) * TAU) / 36,
          t = (j + v) / 2,
          p = fixed(a, t);
        p[1] += 0.2 + 2.0 * Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.cos(v * TAU));
        return p;
      };
      for (let u = 0; u < 12; u++)
        for (let v = 0; v < 16; v++) {
          const ps = [
            P(u / 12, v / 16),
            P((u + 1) / 12, v / 16),
            P((u + 1) / 12, (v + 1) / 16),
            P(u / 12, (v + 1) / 16),
          ];
          metricFace(out, 'membrane', ps, white, [0, 1, 0]);
          metricFace(
            out,
            'membrane',
            ps.map((p) => [p[0], p[1] - 0.025, p[2]]),
            [0.8, 0.82, 0.8],
            [0, -1, 0],
          );
        }
      for (const v of [0, 1])
        curve(
          out,
          Array.from({ length: 25 }, (_, k) => P(k / 24, v)),
          0.07,
          steel,
        );
      if (j === 0)
        for (let k = 0; k < 24; k++) {
          const a = ((i + k / 24) * TAU) / 36,
            b = ((i + (k + 1) / 24) * TAU) / 36;
          face(
            out,
            'etfe',
            [roofOuter(a), roofOuter(b), P((k + 1) / 24, 0), P(k / 24, 0)],
            [0.7, 0.8, 0.84],
            [Math.sin(a), 0, Math.cos(a)],
          );
        }
      curve(
        out,
        Array.from({ length: 25 }, (_, k) => P(0, k / 24)),
        0.055,
        steel,
      );
    }
  // Clear glass interface shelf around the open100x85m retractable aperture.
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288,
      edge = (a) => E(a, 42.5, 50, 55.7 + 2 * Math.abs(Math.sin(a * 18))),
      inner = (a) => E(a, 39.7, 47.2, 56.3);
    face(out, 'acrylic', [edge(a), edge(b), inner(b), inner(a)], [0.66, 0.8, 0.84], [0, 1, 0]);
    if (i % 2 === 0) beam(out, 'metal', inner(a), edge(a), 0.055, 0.1, white);
  }
  for (const y of [54.6, 55.0, 55.4]) ring(out, 42.2, 49.7, y, 0.07, steel);
  // Inner catwalk, hanging speaker arrays and grouped floodlights.
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288;
    face(
      out,
      'metal',
      [E(a, 43, 50.5, 54), E(b, 43, 50.5, 54), E(b, 44.2, 51.7, 54), E(a, 44.2, 51.7, 54)],
      steel,
      [0, 1, 0],
    );
  }
  rail(
    out,
    Array.from({ length: 145 }, (_, i) => E((i * TAU) / 144, 43, 50.5, 54)),
  );
  for (let i = 0; i < 36; i++) {
    const a = ((i + 0.5) * TAU) / 36,
      o = transformed(out, a, E(a, 44.8, 52.3, 54.2));
    for (const x of [-0.6, 0, 0.6]) {
      box(o, 'metal', [x - 0.23, -0.45, -0.35], [x + 0.23, 0, 0.3], dark);
      face(
        o,
        'plastic',
        [
          [x - 0.2, -0.4, -0.36],
          [x + 0.2, -0.4, -0.36],
          [x + 0.2, -0.08, -0.36],
          [x - 0.2, -0.08, -0.36],
        ],
        white,
        [0, 0, -1],
      );
    }
    if (i % 3 === 0)
      for (let j = 0; j < 7; j++)
        box(o, 'plastic', [-0.42, -1.1 - j * 0.52, -0.8], [0.42, -0.65 - j * 0.52, -0.1], dark);
  }
  // Fabric retracts into a suspended central pod; it is never represented as an empty opening.
  lathe(
    out,
    'metal',
    [
      [8.9, 57.6],
      [9.5, 58.0],
      [9.5, 61.2],
      [8.8, 61.6],
    ],
    white,
    144,
  );
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36,
      b = ((i + 1) * TAU) / 36;
    for (let j = 0; j < 8; j++) {
      const r = 9.6 + j * 0.21,
        p = (u, v) =>
          E(
            a + (b - a) * u,
            r + v * 0.19,
            r + v * 0.19,
            60.8 + 1.3 * Math.sin(Math.PI * u) + 0.45 * Math.sin(v * Math.PI),
          );
      for (let k = 0; k < 8; k++)
        metricFace(
          out,
          'membrane',
          [p(k / 8, 0), p((k + 1) / 8, 0), p((k + 1) / 8, 1), p(k / 8, 1)],
          white,
          [0, 1, 0],
        );
    }
  }
  // Four-sided centre video cube under the pod, with open service truss and hoists.
  for (const x of [-7.5, 7.5])
    for (const z of [-5.5, 5.5]) tube(out, 'metal', [x, 49, z], [x, 58, z], 0.08, steel, 12);
  box(out, 'metal', [-8.5, 43, -6.2], [8.5, 49.3, 6.2], dark);
  for (const s of [-1, 1]) {
    face(
      out,
      'plastic',
      [
        [-8.05, 43.3, s * 6.22],
        [8.05, 43.3, s * 6.22],
        [8.05, 49.0, s * 6.22],
        [-8.05, 49.0, s * 6.22],
      ],
      [0.007, 0.016, 0.021],
      [0, 0, s],
    );
    face(
      out,
      'plastic',
      [
        [s * 8.52, 43.3, -5.85],
        [s * 8.52, 43.3, 5.85],
        [s * 8.52, 49, 5.85],
        [s * 8.52, 49, -5.85],
      ],
      [0.007, 0.016, 0.021],
      [s, 0, 0],
    );
  }
  for (const y of [43.1, 49.3]) {
    box(out, 'metal', [-8.7, y, -6.4], [8.7, y + 0.18, 6.4], white);
  }
  for (const z of [-4, 4]) {
    beam(out, 'metal', [-7.5, 51, z], [7.5, 51, z], 0.12, 0.18, steel);
    for (let j = 0; j < 6; j++)
      beam(out, 'metal', [-7.5 + j * 2.5, 51, z], [-5 + j * 2.5, 54, z], 0.1, 0.1, steel);
  }
}

const tiers = [
  { rows: 28, hx: 40.5, hz: 63, r: 12, run: 0.78, dr: 0.8, y: 1, rise: 0.39 },
  { rows: 38, hx: 66, hz: 87, r: 35, run: 0.69, dr: 0.82, y: 17, rise: 0.465 },
];
const seat = (a, t, row) => {
  if (t === tiers[1]) {
    const radius =
      1 / Math.hypot(Math.sin(a) / (t.hx + row * t.run), Math.cos(a) / (t.hz + row * t.run));
    return [Math.sin(a) * radius, t.y + row * t.rise, Math.cos(a) * radius];
  }
  return rounded(a, t.hx + row * t.run, t.hz + row * t.run, t.r + row * t.dr, t.y + row * t.rise);
};
function bowl(out) {
  soccerPitch(out);
  for (const [k, t] of tiers.entries()) {
    for (let row = 0; row < t.rows; row++)
      for (let i = 0; i < 288; i++) {
        const a = (i * TAU) / 288,
          b = ((i + 1) * TAU) / 288,
          p = seat(a, t, row),
          q = seat(b, t, row),
          P = seat(a, t, row + 1),
          Q = seat(b, t, row + 1);
        face(out, 'concrete', [p, q, [Q[0], p[1], Q[2]], [P[0], p[1], P[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[P[0], p[1], P[2]], [Q[0], p[1], Q[2]], Q, P], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        const f = i % 8;
        if (f === 0) continue;
        const n = Math.max(1, Math.floor(Math.hypot(q[0] - p[0], q[2] - p[2]) / 0.52));
        for (let j = 0; j < n; j++) {
          const h = (i * 17 + row * 7 + j * 13) % 19;
          chair(
            out,
            Math.atan2(-(q[2] - p[2]), q[0] - p[0]),
            mix(p, q, (j + 0.5) / n),
            h < 13 ? red : grey,
          );
        }
      }
    for (let i = 0; i < 36; i++) {
      const a = (i * TAU) / 36 + 0.01;
      rail(
        out,
        Array.from({ length: t.rows + 1 }, (_, j) => seat(a, t, j)),
      );
      const o = transformed(out, a, seat(a, t, k ? 12 : 19));
      box(o, 'concrete', [-1.2, 0, -0.25], [1.2, 2.4, 3], concrete);
      face(
        o,
        'plastic',
        [
          [-1.04, 0.06, -0.27],
          [1.04, 0.06, -0.27],
          [1.04, 2.2, -0.27],
          [-1.04, 2.2, -0.27],
        ],
        dark,
        [0, 0, -1],
      );
    }
    for (let i = 0; i < 288; i++) {
      const a = (i * TAU) / 288,
        b = ((i + 1) * TAU) / 288,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        P = seat(a, t, t.rows),
        Q = seat(b, t, t.rows),
        down = (p) => [p[0], p[1] - 0.55, p[2]];
      face(out, 'concrete', [down(p), down(q), down(Q), down(P)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [P, Q, down(Q), down(P)], concrete, [Math.sin(a), 0, Math.cos(a)]);
    }
  }
  const vip = (a) => {
    const lower = seat(a, tiers[0], 28),
      upper = seat(a, tiers[1], 0),
      r = Math.max(Math.hypot(lower[0], lower[2]), Math.hypot(upper[0], upper[2])) + 0.5;
    return E(a, r, r);
  };
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288,
      p = vip(a),
      q = vip(b),
      P = seat(a, tiers[1], 0),
      Q = seat(b, tiers[1], 0),
      Y = (p, y) => [p[0], y, p[2]];
    const lowerP = seat(a, tiers[0], 28),
      lowerQ = seat(b, tiers[0], 28);
    face(out, 'concrete', [Y(lowerP, 12), Y(lowerQ, 12), Y(q, 12), Y(p, 12)], concrete, [0, 1, 0]);
    face(
      out,
      'glass',
      [Y(p, 12.1), Y(q, 12.1), Y(q, 16.5), Y(p, 16.5)],
      [0.06, 0.1, 0.13],
      [-Math.sin(a), 0, -Math.cos(a)],
    );
    // The VIP ceiling is a closed concrete slab beneath the upper-tier cantilever.
    // A single upward face leaves a view through its underside from the pitch.
    face(out, 'concrete', [Y(p, 17), Y(q, 17), Q, P], white, [0, 1, 0]);
    face(out, 'concrete', [Y(p, 16.45), Y(q, 16.45), Y(Q, 16.45), Y(P, 16.45)], white, [0, -1, 0]);
    face(out, 'concrete', [Y(p, 16.45), Y(q, 16.45), Y(q, 17), Y(p, 17)], white, [
      -Math.sin(a),
      0,
      -Math.cos(a),
    ]);
    face(out, 'concrete', [Y(P, 16.45), Y(Q, 16.45), Q, P], white, [-Math.sin(a), 0, -Math.cos(a)]);
    beam(out, 'metal', Y(p, 12.0), Y(p, 16.7), 0.07, 0.1, white);
    beam(out, 'concrete', Y(p, 12.0), Y(q, 12.0), 0.35, 0.45, white);
    beam(out, 'concrete', Y(p, 16.5), Y(q, 16.5), 0.35, 0.35, white);
  }
}

export function buildBcPlace(out) {
  oldStructure(out);
  envelope(out);
  bowl(out);
  masts(out);
  roof(out);
}
export const bcplaceStudy = {
  id: 'N0705',
  key: 'bc_place',
  wikidataId: 'Q612227',
  title: 'BC Place',
  build: buildBcPlace,
  metricTriangleUv: true,
  smoothNormalSlots: ['roof', 'etfe'],
  size: [263, 83, 287],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped field centre at event slab Y0. +Z points toward the northeast goal and +X toward the northwest sideline.',
  },
  visualBrief:
    'The open 2011 BC Place roof: thirty-six outward-leaning white masts with twin backstays and paired cable nets, inflated ETFE perimeter, arched fixed PTFE panels, clear inner shelf and centre-stowed pleated membrane above a four-sided suspended screen. Retained striped concrete bowl, red/grey seating, hospitality belt and eight exposed ramp banks provide the original stadium beneath the new crown.',
  sourceFacts: {
    published:
      'SBP records 261×220m overall roof,36masts, glass/PTFE fixed roof and9500m²ETFE facade. Government release gives50m mast lengths. Engineer-authored WCEE2012_5822 describes54concrete frames, eight ramp structures,35m old bowl height and approximately82m overall height. Tony Hogg Design specifies100×85m retractable opening,36inflatable panels,360carriages and central storage pod. Engineer presentation describes20degree outward mast inclination; SURF records central node60m above field.',
    reconstructed:
      'Native event plane, detailed row counts, podium bands, ramp dimensions, member sections, fixed-roof saddle curves and seat colours are photo-scaled reconstructions. Roof is represented open with fabric gathered centrally; opening is the published85×100m ellipse envelope. Existing OSM building footprint is193×233m, smaller than the cantilevered new roof.',
  },
  referencePages: [
    'https://www.sbp.de/en/project/rehabilitation-of-bc-place-stadium/',
    'https://www.tonyhoggdesign.co.uk/site/projects_58.asp?catID=94',
    'https://archive.news.gov.bc.ca/releases/news_releases_2009-2013/2011SU0010-000190.htm',
    'https://wcee.nicee.org/wcee/article/WCEE2012_5822.pdf',
    'https://www.ism-mse.ca/en/activity/bc-place-stadium-worlds-largest-retractable-fabric-roof/',
    'https://surfarchitecture.com/bc-place-roof-replacement/',
    'https://geigerengineers.com/project/1530365687688/bc-place-stadium-revitalization-new-roof',
    'https://www.openstreetmap.org/way/24705904',
    'https://www.openstreetmap.org/way/1413962603',
  ],
  referenceRights:
    'Primary architect/engineer photographs and technical descriptions consulted; none embedded. Original authored geometry with shared canonical material graphs. OSM-derived field axis and building coordinates ©OpenStreetMap contributors,ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Native Y0 is the event slab and concrete support feet. The inclined radial frame caps extend only0.102m below that plane, representing buried support thickness rather than a model placement offset.',
    source: 'https://www.openstreetmap.org/way/1413962603',
    featureIds: ['way/24705904', 'way/1413962603'],
    notes:
      'Exact mapped long pitch edges fix the northeast goal axis and field-centre anchor. Y0 is the event slab and lower building contact; adjoining raised exterior ramp systems remain in the model. The new cantilevered roof deliberately overhangs the older mapped building footprint.',
  },
  limitations: [
    'Detailed static open-roof exterior and visible bowl. Roof motion, private rooms, sponsor artwork, temporary show equipment and exact ticket-seat inventory are excluded; members and seating are reconstructed from primary dimensional/photographic evidence.',
  ],
  previewCamera: { position: [222, 156, 253], lookAt: [0, 31, 0] },
  qaCameras: [
    { name: 'near-mast-anchor', position: [124, 50, 25], lookAt: [108, 47, 12] },
    { name: 'near-mast-cables', position: [130, 79, 31], lookAt: [103, 67, 19] },
    { name: 'near-etfe-cushions', position: [118, 43, 14], lookAt: [104, 42, 8] },
    { name: 'near-retained-concrete', position: [123, 20, 32], lookAt: [92, 19, 21] },
    { name: 'near-ramp-bank', position: [62, 14, 141], lookAt: [48, 17, 108] },
    { name: 'near-fixed-roof', position: [68, 72, 80], lookAt: [61, 52, 69] },
    { name: 'near-open-pod', position: [28, 66, 37], lookAt: [0, 60, 0] },
    { name: 'near-roof-net', position: [30, 43, 37], lookAt: [5, 63, 0] },
    { name: 'near-four-side-screen', position: [27, 35, 33], lookAt: [0, 47, 0] },
    { name: 'near-bowl', position: [0, 14, 53], lookAt: [0, 20, -68] },
    { name: 'near-glass-shelf', position: [25, 60, 20], lookAt: [32, 56.8, 36] },
    { name: 'near-hospitality', position: [0, 13, 32], lookAt: [40, 15, 43] },
    { name: 'far-false-creek', position: [258, 65, 240], lookAt: [0, 34, 0] },
  ],
  importOptions: { optimize: false },
  quality: 'detailed',
  geometrySource:
    'Original per-identity architectural reconstruction from cited engineering dimensions, primary photographs and exact OSM field/footprint.',
};
