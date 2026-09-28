/** Khalifa's unequal 2017 compression arches and its attached museum ensemble. */
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { khalifaPlan as plan } from './khalifa-plan.mjs';
import { lathe as latheY, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = 2 * Math.PI;
const white = [0.86, 0.87, 0.83],
  steel = [0.56, 0.61, 0.61],
  concrete = [0.61, 0.58, 0.52],
  claret = [0.31, 0.025, 0.07],
  seatRed = [0.39, 0.045, 0.095],
  dark = [0.025, 0.045, 0.05],
  glazing = [0.075, 0.17, 0.18],
  brick = [0.35, 0.19, 0.12];
const E = (a, rx, rz, y = 0) => [rx * Math.sin(a), y, rz * Math.cos(a)];
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const down = (p, d) => [p[0], p[1] - d, p[2]];
const lathe = (out, slot, profile, c, n = 96) =>
  latheY(
    out,
    slot,
    profile.map(([r, y]) => [y, r]),
    c,
    n,
  );
function metricFace(out, slot, points, c, expected) {
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
    c,
  );
}
function rail(out, points, h = 1.05) {
  for (let i = 1; i < points.length; i++) {
    for (const y of [0.5, h])
      tube(out, 'metal', down(points[i - 1], -y), down(points[i], -y), 0.024, steel, 6);
    tube(out, 'metal', points[i - 1], down(points[i - 1], -h), 0.026, steel, 6);
  }
}
function slab(out, rx, rz, ix, iz, y, t = 0.3, c = concrete) {
  // Upper concourses occupy the tall side stands. Continuing them around the
  // low goal-end envelope would send horizontal concrete through the canopy.
  const occupied = (i) => y < 9.2 + 16 * Math.abs(Math.sin(((i + 0.5) * TAU) / 256));
  for (let i = 0; i < 256; i++) {
    if (!occupied(i)) continue;
    const a = (i * TAU) / 256,
      b = ((i + 1) * TAU) / 256,
      p = E(a, rx, rz, y),
      q = E(b, rx, rz, y),
      P = E(a, ix, iz, y),
      Q = E(b, ix, iz, y);
    face(out, 'concrete', [p, q, Q, P], c, [0, 1, 0]);
    face(out, 'concrete', [down(p, t), down(q, t), down(Q, t), down(P, t)], c, [0, -1, 0]);
    face(out, 'concrete', [p, q, down(q, t), down(p, t)], c, [Math.sin(a), 0, Math.cos(a)]);
    face(out, 'concrete', [P, Q, down(Q, t), down(P, t)], c, [-Math.sin(a), 0, -Math.cos(a)]);
    if (!occupied(i - 1))
      face(out, 'concrete', [p, P, down(P, t), down(p, t)], c, [-Math.cos(a), 0, Math.sin(a)]);
    if (!occupied(i + 1))
      face(out, 'concrete', [q, Q, down(Q, t), down(q, t)], c, [Math.cos(b), 0, -Math.sin(b)]);
  }
}
// New east and strengthened west arches meet at the north/south massive buttresses.
// Heights 94/66m, 270m chord, CHS1100/800 and 3.8/2.4m chord spacing are published.
const upper = (a) =>
  E(
    a,
    Math.sin(a) >= 0 ? 124 : 100,
    135,
    5 + (Math.sin(a) >= 0 ? 60.6 : 88.45) * Math.abs(Math.sin(a)),
  );
const lower = (a) => E(a, 130, 135, 5 + (Math.sin(a) >= 0 ? 27 : 43) * Math.abs(Math.sin(a)));
const inner = (a) => E(a, 53, 81, 42 - 3 * Math.sin(a));
const net = (a, t) =>
  mix(lower(a), inner(a), t).map((v, i) => v - (i === 1 ? 1.5 * Math.sin(t * Math.PI) : 0));
const innerFilm = (a) => {
  const p = inner(a),
    f = Math.max(0, -Math.cos(a));
  return [p[0] * (1 - 0.12 * f), p[1] - f, p[2] * (1 - 0.2 * f)];
};

function arches(out) {
  for (const side of [1, -1]) {
    const gap = side === 1 ? 2.4 : 3.8,
      radius = side === 1 ? 0.4 : 0.55;
    const chord = (t, d) => {
      const p = upper(side * t);
      return [p[0] + d, p[1], p[2]];
    };
    for (const d of [-gap / 2, gap / 2])
      curve(
        out,
        Array.from({ length: 181 }, (_, i) => chord((i * Math.PI) / 180, d)),
        radius,
        white,
        'metal',
        24,
      );
    curve(
      out,
      Array.from({ length: 181 }, (_, i) => lower((side * i * Math.PI) / 180)),
      side === 1 ? 0.45 : 0.55,
      white,
      'metal',
      24,
    );
    for (let i = 1; i < 58; i++) {
      const t = (i * Math.PI) / 58;
      tube(out, 'metal', chord(t, -gap / 2), chord(t, gap / 2), side === 1 ? 0.3 : 0.4, white, 16);
      if (i < 14 || i > 44) {
        tube(
          out,
          'metal',
          chord(t, -gap / 2),
          chord(((i + 1) * Math.PI) / 58, gap / 2),
          0.15,
          white,
          12,
        );
        tube(
          out,
          'metal',
          chord(t, gap / 2),
          chord(((i + 1) * Math.PI) / 58, -gap / 2),
          0.15,
          white,
          12,
        );
      }
    }
    // Cigar-section struts and X bars are retained on the west and echoed on the east.
    for (let i = 1; i < 27; i++) {
      const a = (side * i * Math.PI) / 27,
        p = lower(a),
        q = upper(a),
        ground = [p[0] * 0.92, 0, p[2] * 0.97];
      const taper = (P, Q, slot = 'metal') => {
        const v = Q.map((x, k) => x - P[k]),
          l = Math.hypot(...v),
          r0 = 0.2,
          r1 = 0.53;
        const axis = normalize(v),
          u = normalize(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])),
          w = normalize(cross(axis, u));
        const rings = Array.from({ length: 17 }, (_, j) => {
          const c = mix(P, Q, j / 16),
            r = r0 + (r1 - r0) * Math.sin((j * Math.PI) / 16);
          return Array.from({ length: 24 }, (_, k) =>
            c.map(
              (x, d) => x + r * (Math.cos((k * TAU) / 24) * u[d] + Math.sin((k * TAU) / 24) * w[d]),
            ),
          );
        });
        loft(out, slot, rings, white);
        if (l < 0.1) throw Error('collapsed Khalifa strut');
      };
      taper(ground, p);
      taper(p, q);
      if (i < 26) {
        const b = (side * (i + 1) * Math.PI) / 27,
          P = lower(b),
          Q = upper(b);
        tube(out, 'metal', p, Q, 0.055, steel, 8);
        tube(out, 'metal', P, q, 0.055, steel, 8);
      }
      const o = transformed(out, a, ground);
      box(o, 'concrete', [-1.4, 0, -1.25], [1.4, 0.6, 1.25], concrete);
      for (const x of [-0.85, 0.85])
        for (const z of [-0.7, 0.7]) tube(o, 'metal', [x, 0.6, z], [x, 0.77, z], 0.06, steel, 10);
    }
  }
  for (const z of [-135, 135]) {
    const o = transformed(out, z > 0 ? 0 : Math.PI, [0, 0, z]);
    box(o, 'concrete', [-7, 0, -5.5], [7, 3.3, 7], concrete);
    box(o, 'metal', [-3, 3.3, -1.8], [3, 4.8, 1.8], steel);
    // Sloped concrete cheek walls flank the forked arch shoes.
    for (const s of [-1, 1]) {
      const p = [s * 1.8, 3.3, 0],
        q = [s * 8.5, 0, 9.5];
      beam(o, 'concrete', p, q, 3.2, 2.1, concrete);
      box(o, 'metal', [s * 2.4 - 0.5, 3.15, -2], [s * 2.4 + 0.5, 4.0, 2.5], steel);
    }
    for (const x of [-4.8, 4.8])
      for (const zz of [-2.5, 2.5]) tube(o, 'metal', [x, 3.3, zz], [x, 3.65, zz], 0.12, steel, 12);
  }
}

function canopy(out) {
  const sectors = 58;
  // Continuous paired radial systems support one central six-cable tension ring.
  for (let i = 0; i < sectors; i++) {
    const a = ((i + 0.5) * TAU) / sectors,
      A = upper(a),
      I = inner(a),
      O = lower(a);
    curve(
      out,
      Array.from({ length: 37 }, (_, j) =>
        mix(A, I, j / 36).map((v, k) => v - (k === 1 ? 2 * Math.sin((j * Math.PI) / 36) : 0)),
      ),
      0.055,
      steel,
      'metal',
      10,
    );
    curve(
      out,
      Array.from({ length: 37 }, (_, j) => net(a, j / 36)),
      0.04,
      steel,
      'metal',
      10,
    );
    for (let j = 1; j < 10; j++) {
      const t = j / 10,
        P = net(a, t),
        Q = mix(A, I, t).map((v, k) => v - (k === 1 ? 2 * Math.sin(t * Math.PI) : 0));
      if (Math.hypot(...P.map((v, k) => v - Q[k])) > 0.15)
        tube(out, 'metal', P, Q, 0.019, steel, 8);
      tube(out, 'metal', P, down(P, -0.22), 0.1, white, 12);
    }
    const end = mix(O, I, 0.04);
    tube(out, 'metal', O, end, 0.12, white, 16);
  }
  for (let i = 0; i < sectors; i++) {
    const start = ((i + 0.5) * TAU) / sectors;
    const F = (u, v) => {
      const a = start + (u * TAU) / sectors,
        p = net(a, v);
      p[1] += 0.65 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      return p;
    };
    for (let u = 0; u < 8; u++)
      for (let v = 0; v < 20; v++) {
        const ps = [
          F(u / 8, v / 20),
          F((u + 1) / 8, v / 20),
          F((u + 1) / 8, (v + 1) / 20),
          F(u / 8, (v + 1) / 20),
        ];
        metricFace(out, 'membrane', ps, white, [0, 1, 0]);
        metricFace(
          out,
          'membrane',
          ps.map((p) => down(p, 0.03)),
          [0.74, 0.75, 0.7],
          [0, -1, 0],
        );
      }
    curve(
      out,
      Array.from({ length: 41 }, (_, j) => F(0.5, j / 40)),
      0.023,
      steel,
      'metal',
      8,
    );
  }
  for (const [dy, dx] of [
    [0, -0.1],
    [0, 0],
    [0, 0.1],
    [0.1, -0.1],
    [0.1, 0],
    [0.1, 0.1],
  ])
    curve(
      out,
      Array.from({ length: 349 }, (_, i) => {
        const a = (i * TAU) / 348,
          p = inner(a);
        return [p[0] + dx * Math.sin(a), p[1] + dy, p[2] + dx * Math.cos(a)];
      }),
      0.035,
      steel,
      'metal',
      10,
    );
  // Transparent south half-moon film, a separate local alpha surface over the cable net.
  for (let i = 0; i < 116; i++) {
    const a = Math.PI / 2 + ((i + 0.002) * Math.PI) / 116,
      b = Math.PI / 2 + ((i + 0.998) * Math.PI) / 116;
    face(
      out,
      'etfeClear',
      [inner(a), inner(b), innerFilm(b), innerFilm(a)],
      [0.85, 0.9, 0.89],
      [0, 1, 0],
    );
    if (i % 2 === 0) tube(out, 'metal', inner(a), innerFilm(a), 0.025, steel, 8);
  }
  curve(
    out,
    Array.from({ length: 117 }, (_, i) => innerFilm(Math.PI / 2 + (i * Math.PI) / 116)),
    0.046,
    steel,
    'metal',
    10,
  );
  // Narrow ring catwalk and regular floodlight clusters remain above the visual field.
  const path = [];
  for (let i = 0; i < 348; i++) {
    const a = (i * TAU) / 348,
      b = ((i + 1) * TAU) / 348,
      p = down(inner(a), 0.5),
      q = down(inner(b), 0.5),
      P = [p[0] * 1.025, p[1], p[2] * 1.017],
      Q = [q[0] * 1.025, q[1], q[2] * 1.017];
    face(out, 'metal', [p, q, Q, P], steel, [0, 1, 0]);
    if (i % 3 === 0) path.push(p);
    if (i % 6 === 0) {
      const o = transformed(out, a, P);
      for (const x of [-0.8, 0, 0.8]) {
        box(o, 'metal', [x - 0.29, -0.55, -0.4], [x + 0.29, 0.2, 0.3], dark);
        face(
          o,
          'plastic',
          [
            [x - 0.25, -0.5, -0.41],
            [x + 0.25, -0.5, -0.41],
            [x + 0.25, 0.13, -0.41],
            [x - 0.25, 0.13, -0.41],
          ],
          white,
          [0, 0, -1],
        );
      }
    }
  }
  rail(out, [...path, path[0]], 0.92);
}

function trackPoint(a, r, y = 0.01) {
  // Standard athletics oval: parallel straights and semicircular ends.
  return [Math.sin(a) * r, y, Math.cos(a) * r + Math.sign(Math.cos(a)) * 42.2];
}
function athletics(out) {
  soccerPitch(out);
  for (let lane = 0; lane < 9; lane++)
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        r = 36.5 + lane * 1.22;
      const P = (a, r) => trackPoint(a, r, 0.025);
      face(
        out,
        'plastic',
        [P(a, r), P(b, r), P(b, r + 1.22), P(a, r + 1.22)],
        lane % 2 ? [0.055, 0.26, 0.43] : [0.04, 0.22, 0.38],
        [0, 1, 0],
      );
      face(out, 'plastic', [P(a, r), P(b, r), P(b, r + 0.055), P(a, r + 0.055)], white, [0, 1, 0]);
    }
  // Two straight running sections fill the connecting gaps left by the semicircles.
  for (const s of [-1, 1])
    for (let lane = 0; lane < 9; lane++) {
      const x = s * (36.5 + lane * 1.22),
        X = s * (36.5 + (lane + 1) * 1.22);
      face(
        out,
        'plastic',
        [
          [x, 0.025, -42.2],
          [X, 0.025, -42.2],
          [X, 0.025, 42.2],
          [x, 0.025, 42.2],
        ],
        lane % 2 ? [0.055, 0.26, 0.43] : [0.04, 0.22, 0.38],
        [0, 1, 0],
      );
      face(
        out,
        'plastic',
        [
          [x, 0.031, -42.2],
          [x + s * 0.055, 0.031, -42.2],
          [x + s * 0.055, 0.031, 42.2],
          [x, 0.031, 42.2],
        ],
        white,
        [0, 1, 0],
      );
    }
  for (const s of [-1, 1])
    for (let j = 0; j < 10; j++)
      box(out, 'metal', [s * 48 - 1, 0.1, -42 + j * 8.5], [s * 48 + 1, 0.7, -37 + j * 8.5], dark);
}
const tierPoint = (a, row, upperTier) =>
  E(
    a,
    (upperTier ? 78 : 52) + row * 0.76,
    (upperTier ? 105 : 92) + row * 0.73,
    (upperTier ? 16 : 1) + row * (upperTier ? 0.48 : 0.39),
  );
const count = (a, up) =>
  up ? Math.round(6 + (Math.sin(a) >= 0 ? 21 : 36) * Math.abs(Math.sin(a)) ** 1.4) : 27;
function seating(out) {
  athletics(out);
  for (const up of [false, true]) {
    const n = 348;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        rows = Math.min(count(a, up), count(b, up));
      for (let j = 0; j < rows; j++) {
        const p = tierPoint(a, j, up),
          q = tierPoint(b, j, up),
          P = tierPoint(a, j + 1, up),
          Q = tierPoint(b, j + 1, up);
        face(out, 'concrete', [p, q, [Q[0], p[1], Q[2]], [P[0], p[1], P[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[P[0], p[1], P[2]], [Q[0], p[1], Q[2]], Q, P], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        if (i % 12 === 0) continue;
        const seats = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.53));
        for (let k = 0; k < seats; k++)
          chair(
            out,
            Math.atan2(-(q[2] - p[2]), q[0] - p[0]),
            mix(p, q, (k + 0.5) / seats),
            (i * 5 + j * 7 + k) % 13 < 9 ? seatRed : [0.78, 0.75, 0.69],
          );
      }
      const P = tierPoint(a, rows, up),
        Q = tierPoint(b, rows, up),
        p = tierPoint(a, 0, up),
        q = tierPoint(b, 0, up);
      face(out, 'concrete', [down(P, 0.6), down(Q, 0.6), down(q, 0.6), down(p, 0.6)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [P, Q, down(Q, 0.6), down(P, 0.6)], concrete, [
        Math.sin(a),
        0,
        Math.cos(a),
      ]);
      if (i % 12 === 0) {
        rail(
          out,
          Array.from({ length: rows + 1 }, (_, j) => tierPoint(a + 0.009, j, up)),
        );
        const o = transformed(out, a, tierPoint(a, Math.min(rows - 3, up ? 9 : 18), up));
        box(o, 'concrete', [-1.2, 0, -0.2], [1.2, 2.4, 3], concrete);
        face(
          o,
          'plastic',
          [
            [-1, 0.1, -0.22],
            [1, 0.1, -0.22],
            [1, 2.2, -0.22],
            [-1, 2.2, -0.22],
          ],
          dark,
          [0, 0, -1],
        );
      }
    }
  }
  // West media/hospitality band below the retained high stand, east pavilion under new seating.
  for (let i = 0; i < 348; i++) {
    const a = (i * TAU) / 348,
      b = ((i + 1) * TAU) / 348,
      p = E(a, 80, 114),
      q = E(b, 80, 114),
      P = tierPoint(a, 0, true),
      Q = tierPoint(b, 0, true);
    const Y = (p, y) => [p[0], y, p[2]];
    face(
      out,
      'concrete',
      [
        Y(tierPoint(a, 27, false), 11.53),
        Y(tierPoint(b, 27, false), 11.53),
        Y(q, 11.53),
        Y(p, 11.53),
      ],
      concrete,
      [0, 1, 0],
    );
    face(out, 'concrete', [Y(p, 11.53), Y(q, 11.53), Y(q, 15.8), Y(p, 15.8)], white, [
      -Math.sin(a),
      0,
      -Math.cos(a),
    ]);
    if (Math.abs(Math.sin(a)) > 0.63) {
      const o = transformed(out, a, p);
      face(
        o,
        'glass',
        [
          [-0.4, 0.15, -0.03],
          [0.4, 0.15, -0.03],
          [0.4, 2.75, -0.03],
          [-0.4, 2.75, -0.03],
        ],
        glazing,
        [0, 0, -1],
      );
    }
    face(out, 'concrete', [Y(p, 15.8), Y(q, 15.8), Q, P], white, [0, 1, 0]);
    face(out, 'concrete', [Y(p, 15.5), Y(q, 15.5), down(Q, 0.3), down(P, 0.3)], white, [0, -1, 0]);
  }
  // Screens sit beneath the north and south canopy, independent of the roof walkways.
  for (const s of [-1, 1]) {
    const o = transformed(out, s > 0 ? 0 : Math.PI, [0, 22, s * 96]);
    box(o, 'metal', [-9, 0, -0.6], [9, 6, 0.2], dark);
    face(
      o,
      'plastic',
      [
        [-8.65, 0.35, -0.62],
        [8.65, 0.35, -0.62],
        [8.65, 5.65, -0.62],
        [-8.65, 5.65, -0.62],
      ],
      [0.012, 0.018, 0.022],
      [0, 0, -1],
    );
    for (const x of [-7, 7]) beam(o, 'metal', [x, 0, 0], [x, -8, 0], 0.25, 0.32, steel);
  }
}

function tower(out, x, z, r, height) {
  const o = transformed(out, 0, [x, 0, z]);
  lathe(
    o,
    'glass',
    [
      [r - 0.35, 0],
      [r - 0.35, height - 5],
    ],
    glazing,
    96,
  );
  for (let y = 0.3; y < height - 4; y += 3.8)
    lathe(
      o,
      'concrete',
      [
        [r + 0.35, y],
        [r + 0.35, y + 0.35],
      ],
      white,
      96,
    );
  for (let i = 0; i < 32; i++) {
    const a = (i * TAU) / 32;
    tube(o, 'metal', E(a, r, r, 0.3), E(a, r, r, height - 5), 0.07, white, 8);
  }
  lathe(
    o,
    'metal',
    [
      [r + 1.4, height - 5],
      [r + 1.4, height - 4.6],
      [r * 0.75, height - 1.5],
    ],
    white,
    96,
  );
  lathe(
    o,
    'metal',
    [
      [r * 0.76, height - 1.5],
      [r * 0.76, height + 1.3],
    ],
    claret,
    96,
  );
  lathe(
    o,
    'glass',
    [
      [r * 0.68, height + 1.3],
      [r * 0.68, height + 4.4],
    ],
    glazing,
    96,
  );
  lathe(
    o,
    'metal',
    [
      [r * 0.73, height + 4.4],
      [r * 0.73, height + 4.65],
    ],
    white,
    96,
  );
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    tube(
      o,
      'metal',
      E(a, r * 0.69, r * 0.69, height + 1.3),
      E(a, r * 0.69, r * 0.69, height + 4.4),
      0.045,
      white,
      8,
    );
  }
}
function facade(out) {
  // The concrete lower stadium is recessive beneath the paired steel bow arches.
  for (let i = 0; i < 232; i++) {
    const a = (i * TAU) / 232,
      b = ((i + 1) * TAU) / 232,
      h = 10 + 16 * Math.abs(Math.sin(a)),
      H = 10 + 16 * Math.abs(Math.sin(b));
    const F = (a, y) => E(a, 118, 125, y);
    face(out, 'metal', [F(a, 0), F(b, 0), F(b, 5), F(a, 5)], brick, [Math.sin(a), 0, Math.cos(a)]);
    face(out, 'glass', [F(a, 5), F(b, 5), F(b, H), F(a, h)], glazing, [
      Math.sin(a),
      0,
      Math.cos(a),
    ]);
    beam(out, 'metal', F(a, 0), F(a, h), 0.09, 0.13, white);
    if (i % 4 === 0)
      for (const y of [9, 15, 21]) if (y < h) tube(out, 'metal', F(a, y), F(b, y), 0.07, white, 8);
    if (i % 8 === 0) {
      const o = transformed(out, a, F(a, 0));
      box(o, 'metal', [-1.6, 0, -0.1], [1.6, 3, 0.22], white);
      face(
        o,
        'glass',
        [
          [-1.4, 0.12, 0.24],
          [1.4, 0.12, 0.24],
          [1.4, 2.8, 0.24],
          [-1.4, 2.8, 0.24],
        ],
        glazing,
        [0, 0, 1],
      );
    }
  }
  for (const y of [7.5, 14.5, 21.5]) slab(out, 116, 123, 108, 115, y, 0.4);
  for (const a of [Math.PI * 0.2, Math.PI * 0.8, Math.PI * 1.2, Math.PI * 1.8]) {
    const o = transformed(out, a, E(a, 117, 124, 0));
    for (let k = 0; k < 3; k++) {
      const y = 2.8 + k * 6.4;
      beam(o, 'concrete', [-17, y, 5], [17, y + 5.9, 5], 5, 0.45, concrete);
      for (const z of [2.6, 7.4])
        rail(
          o,
          Array.from({ length: 18 }, (_, j) => [-17 + 2 * j, y + (j * 5.9) / 17, z]),
        );
      for (const x of [-16, 16])
        beam(o, 'concrete', [x, 0, 5], [x, y + 5.9, 5], 0.7, 0.7, concrete);
    }
  }
  // Four mapped circular stair towers, with steel ribs, stepped discs and claret crowns.
  tower(out, 123.75, -72.53, 12.0, 22);
  tower(out, 127.7, 71.42, 12.0, 22);
  tower(out, -140, -77.12, 12.1, 28);
  tower(out, -138.48, 80.51, 12.1, 28);
  // Curved western service hall, independent of the later east museum.
  for (let i = 0; i < 72; i++) {
    const z = -58 + (i * 116) / 72,
      Z = -58 + ((i + 1) * 116) / 72;
    for (let j = 0; j < 16; j++) {
      const t = (j * Math.PI) / 16,
        T = ((j + 1) * Math.PI) / 16;
      const p = (z, t) => [125 + Math.sin(t) * 23, 12 + Math.cos(t) * 10, z];
      face(out, 'metal', [p(z, t), p(Z, t), p(Z, T), p(z, T)], white, [1, 0, 0]);
    }
  }
}

function museum(out) {
  // 3-2-1 museum: curved east pavilion plus freestanding glass cylinder and five tilted rings.
  // Mapped museum way770603498 fixes the cylinder and short neck positions.
  const cx = -177,
    cz = 3.3,
    r = 20.2;
  const o = transformed(out, 0, [cx, 0, cz]);
  lathe(
    o,
    'glass',
    [
      [r, 0],
      [r, 34],
    ],
    glazing,
    144,
  );
  for (let y = 0; y <= 34; y += 4.25)
    lathe(
      o,
      'metal',
      [
        [r + 0.12, y],
        [r + 0.12, y + 0.2],
      ],
      steel,
      144,
    );
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72;
    tube(o, 'metal', E(a, r + 0.08, r + 0.08, 0), E(a, r + 0.08, r + 0.08, 34), 0.045, white, 8);
  }
  lathe(
    o,
    'metal',
    [
      [r, 34],
      [r, 34.45],
      [r - 1, 34.7],
    ],
    white,
    144,
  );
  for (let i = 0; i < 5; i++) {
    const a0 = i * 1.3,
      y = 4.5 + i * 6.6;
    const R = (a, rad, h) => [rad * Math.sin(a), y + 3.3 * Math.sin(a + a0) + h, rad * Math.cos(a)];
    for (let j = 0; j < 144; j++) {
      const a = (j * TAU) / 144,
        b = ((j + 1) * TAU) / 144;
      face(
        o,
        'metal',
        [R(a, 20.4, 0), R(b, 20.4, 0), R(b, 24.2, 0), R(a, 24.2, 0)],
        white,
        [0, 1, 0],
      );
      face(
        o,
        'metal',
        [R(a, 20.4, -0.28), R(b, 20.4, -0.28), R(b, 24.2, -0.28), R(a, 24.2, -0.28)],
        white,
        [0, -1, 0],
      );
      face(
        o,
        'metal',
        [R(a, 24.2, -0.28), R(b, 24.2, -0.28), R(b, 24.2, 0.35), R(a, 24.2, 0.35)],
        steel,
        [Math.sin(a), 0, Math.cos(a)],
      );
      if (j % 2 === 0) {
        tube(o, 'metal', R(a, 20.5, 0), R(a, 24.0, 0.65), 0.035, white, 6);
        tube(o, 'metal', R(a, 24.0, 0), R(a, 20.5, 0.65), 0.035, white, 6);
      }
    }
  }
  box(out, 'concrete', [-157, 0, -2.5], [-139, 8.5, 10], concrete);
  for (const z of [-2.55, 10.05])
    face(
      out,
      'glass',
      [
        [-157, 2, z],
        [-139, 2, z],
        [-139, 8.2, z],
        [-157, 8.2, z],
      ],
      glazing,
      [0, 0, Math.sign(z)],
    );
  for (const z of [-2.6, 10.1])
    for (let x = -155; x <= -140; x += 2.5)
      beam(out, 'metal', [x, 2, z], [x, 8.4, z], 0.07, 0.1, white);
  // East pavilion has a shallow barrel, blue glazing and raised diamond facets.
  const F = (u, v) => {
    const z = -59 + 118 * u,
      x = -125 - 22 * Math.sin(Math.PI * v),
      y = 8 + 27 * Math.sin((Math.PI * v) / 2);
    return [x, y, z];
  };
  for (let i = 0; i < 48; i++)
    for (let j = 0; j < 12; j++) {
      const p = F(i / 48, j / 12),
        q = F((i + 1) / 48, j / 12),
        P = F(i / 48, (j + 1) / 12),
        Q = F((i + 1) / 48, (j + 1) / 12);
      face(out, 'glass', [p, q, Q, P], glazing, [-1, 0, 0]);
      tube(out, 'metal', p, Q, 0.055, white, 8);
      tube(out, 'metal', q, P, 0.055, white, 8);
    }
  for (const z of [-59, 59])
    face(
      out,
      'metal',
      [
        [-125, 0, z],
        [-147, 0, z],
        [-147, 20, z],
        [-125, 35, z],
      ],
      claret,
      [0, 0, Math.sign(z)],
    );
  box(out, 'metal', [-147, 0, -59], [-124, 8, 59], brick);
}

export function buildKhalifa(out) {
  facade(out);
  seating(out);
  arches(out);
  canopy(out);
  museum(out);
}
export const khalifaStudy = {
  id: 'N0706',
  key: 'khalifa_international_stadium',
  wikidataId: 'Q772988',
  title: 'Khalifa International Stadium',
  build: buildKhalifa,
  metricTriangleUv: true,
  smoothNormalSlots: ['etfe', 'window', 'trim'],
  size: [349, 96, 350],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Exact mapped pitch centre at ground Y0; +Z north goal and +X west stand. The museum is on -X.',
  },
  visualBrief:
    'The unequal 2017 Khalifa saddle roof: paired tubular compression arches, the taller eastern bow and lower strengthened western bow, lower compression rings, radial stay/hanger network and six-cable tension ring. South transparent half-moon film, maroon/cream tiers, blue athletics oval, four ribbed circular stair turrets and the glass east museum with five tilted Olympic-inspired rings distinguish the complete ensemble.',
  sourceFacts: {
    published:
      'Maffeis engineers report 270m north-south chord,260m overall east-west plan,94m east and66m west arches; upper CHS1100/800 tubes spaced3.8/2.4m and a six70mm-cable tension ring. Birdair describes PTFE, south ETFE and lower-edge insulated membrane. Midmac confirms dismantling the previous lighting arch; the 2017 roof is distinct from the 2005 structure.',
    reconstructed:
      'Membrane form between measured arches, bowl inventory, pavilion heights and details, tower floor heights, museum ring tilts and local sections are reconstructed from primary architect/contractor photographs. The mapped north-south field axis and four annex/tower footprints fix the ensemble geography.',
  },
  referencePages: [
    'https://www.dar.com/work/project/expanding-the-khalifa-stadium%E2%80%99s-east-stand-',
    'https://www.maffeis.it/index.php/portfolio-items/khalifa-stadium/',
    'https://www.unicmi.it/index2.php?do_pdf=1&id=2554&option=com_content',
    'https://dokumen.pub/costruzioni-metalliche-2-2016nbsped.html',
    'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2006-issue-2.pdf',
    'https://www.midmac.net/project/khalifa-stadium-and-museum-total-renovation/',
    'https://www.birdair.com/birdair-portfolio/khalifa-international-stadium/',
    'https://taiyo-europe.com/?taiyo-portfolio=khalifa-international-stadium',
    'https://yearsofculture.qa/posts/get-to-know-the-3-2-1-qatar-olympic-and-sports-museum',
    'https://www.openstreetmap.org/relation/8677986',
    'https://www.openstreetmap.org/way/770643307',
  ],
  referenceRights:
    'Original geometry; copyrighted reference photographs and diagrams were consulted, never embedded. Maffeis 2016 primary journal paper consulted through its public indexed transcript and official publication metadata. Mapped coordinate derivatives ©OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Native Y0 is the event/plaza surface and column-pad top contact. The heavy sloping arch-foundation cheeks continue 1.011m below this plane as buried foundation thickness; no whole-building altitude shift is applied.',
    source: 'https://www.openstreetmap.org/way/770643307',
    featureIds: [
      'relation/8677986',
      'way/59452723',
      'way/770643307',
      'way/770521851',
      'way/770521875',
      'way/770622785',
      'way/770632113',
      'way/770603498',
      'way/770632112',
    ],
    notes:
      'Exact field axis fixes north and the asymmetric east museum. Four circular annexes use their individual mapped positions. Native Y0 is plaza and pitch contact; canopy geometry is independently constrained by engineering dimensions rather than scaled to the OSM building outline.',
  },
  limitations: [
    'Permanent detailed exterior and visible athletics bowl; private exhibits, internal rooms, sponsor artwork, event screens and exact seat inventory are excluded. Structural and skin dimensions not published in the cited papers are reconstructed from primary photographs, not claimed as fabrication measurements.',
  ],
  previewCamera: { position: [-275, 182, -261], lookAt: [-20, 31, 0] },
  qaCameras: [
    { name: 'near-east-arch', position: [-119, 101, 24], lookAt: [-100, 90, 7] },
    { name: 'near-west-arch', position: [149, 71, 29], lookAt: [123, 59, 10] },
    { name: 'near-buttress', position: [24, 17, 163], lookAt: [0, 5, 135] },
    { name: 'near-cigar-struts', position: [149, 23, 38], lookAt: [123, 36, 24] },
    { name: 'near-roof-cables', position: [-68, 62, -75], lookAt: [-39, 44, -58] },
    { name: 'near-south-film', position: [17, 60, -107], lookAt: [0, 43, -74] },
    { name: 'near-tension-ring', position: [37, 46, 74], lookAt: [25, 41, 69] },
    { name: 'near-east-museum', position: [-221, 38, 59], lookAt: [-175, 18, 1] },
    { name: 'near-museum-pavilion', position: [-185, 21, -49], lookAt: [-142, 20, -31] },
    { name: 'near-stair-turret', position: [-166, 16, 111], lookAt: [-138, 16, 80] },
    { name: 'near-bowl', position: [0, 13, 71], lookAt: [0, 18, -71] },
    { name: 'near-west-hospitality', position: [29, 14, 2], lookAt: [76, 16, 0] },
    { name: 'far-east-ensemble', position: [-287, 64, -177], lookAt: [-22, 36, 0] },
  ],
  importOptions: { optimize: false },
  quality: 'detailed',
  geometrySource:
    'Original engineering-dimension and primary-photo reconstruction, with exact map-derived field and ensemble axes.',
};
