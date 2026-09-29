/** Volgograd: individually reconstructed branching salute facade and44-spoke cable roof. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { volgogradPlan as plan } from './volgograd-plan.mjs';

const TAU = Math.PI * 2,
  white = [0.85, 0.87, 0.85],
  concrete = [0.62, 0.64, 0.62],
  steel = [0.59, 0.63, 0.65],
  dark = [0.023, 0.038, 0.046],
  blue = [0.15, 0.37, 0.57],
  pale = [0.77, 0.83, 0.85];
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const rad = (a, r, y = 0) => [2.1 + Math.sin(a) * r, y, 3.15 + Math.cos(a) * r];
const E = (a, rx, rz, y) => [Math.sin(a) * rx, y, Math.cos(a) * rz];
const cone = (a, y) => rad(a, 127.5 + ((y - 8.4) / 41.1) * 24, y);
function rounded(a, hx, hz, r, y) {
  const x = Math.sin(a),
    z = Math.cos(a);
  let lo = 0,
    hi = Math.hypot(hx, hz);
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2;
    if (
      Math.hypot(Math.max(0, Math.abs(t * x) - (hx - r)), Math.max(0, Math.abs(t * z) - (hz - r))) >
      r
    )
      hi = t;
    else lo = t;
  }
  return [x * lo, y, z * lo];
}
function metricFace(out, slot, ps, color, expected) {
  let n = normalFor(...ps.slice(0, 3));
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
function rail(out, pts, height = 1.1) {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const h of [height, 0.54])
      tube(
        out,
        'metal',
        pts[i].map((v, k) => v + (k === 1 ? h : 0)),
        pts[i + 1].map((v, k) => v + (k === 1 ? h : 0)),
        0.025,
        steel,
        6,
      );
    tube(
      out,
      'metal',
      pts[i],
      pts[i].map((v, k) => v + (k === 1 ? height : 0)),
      0.03,
      steel,
      6,
    );
  }
}
function circle(out, r, y, thickness = 0.08, color = steel, n = 352) {
  curve(
    out,
    Array.from({ length: n + 1 }, (_, i) => rad((i * TAU) / n, r, y)),
    thickness,
    color,
    'metal',
    8,
  );
}
function podium(out) {
  const route = plan.walkways.find((w) => w.id === '622798144').points;
  for (let i = 1; i < route.length; i++) {
    const p = [route[i - 1][0], 8.4, route[i - 1][1]],
      q = [route[i][0], 8.4, route[i][1]],
      L = Math.hypot(q[0] - p[0], q[2] - p[2]),
      dx = (q[0] - p[0]) / L,
      dz = (q[2] - p[2]) / L;
    beam(out, 'concrete', [p[0], 8.05, p[2]], [q[0], 8.05, q[2]], 11, 0.7, concrete);
    for (const s of [-1, 1])
      rail(
        out,
        Array.from({ length: Math.ceil(L / 2) + 1 }, (_, j) => {
          const v = mix(p, q, j / Math.ceil(L / 2));
          return [v[0] + s * dz * 5.5, 8.42, v[2] - s * dx * 5.5];
        }),
      );
    for (let j = 0; j < Math.ceil(L / 13); j++) {
      const v = mix(p, q, (j + 0.5) / Math.ceil(L / 13));
      beam(out, 'concrete', [v[0], 0, v[2]], [v[0], 4.4, v[2]], 0.65, 0.75, concrete);
      for (const s of [-1, 1])
        beam(
          out,
          'concrete',
          [v[0], 4.4, v[2]],
          [v[0] + s * dz * 4.5, 7.8, v[2] - s * dx * 4.5],
          0.48,
          0.58,
          concrete,
        );
    }
    if (i % 2 === 0) {
      const v = mix(p, q, 0.5),
        a = Math.atan2(v[0] - 2.1, v[2] - 3.15),
        base = rad(a, 124, 8.05);
      beam(out, 'concrete', base, [v[0], 8.05, v[2]], 8, 0.7, concrete);
    }
  }
  for (const w of plan.walkways.filter((w) => w.tags.bridge && w.id !== '622798144')) {
    const pts = w.points.map((p) => [p[0], 0, p[1]]);
    let p = pts[0],
      q = pts.at(-1);
    if (Math.hypot(p[0], p[2]) < Math.hypot(q[0], q[2])) [p, q] = [q, p];
    const L = Math.hypot(p[0] - q[0], p[2] - q[2]),
      a = Math.atan2(q[0] - p[0], q[2] - p[2]),
      o = transformed(out, a, p),
      steps = 48;
    for (let i = 0; i < steps; i++)
      box(
        o,
        'concrete',
        [-3, Math.max(0, ((i + 1) * 8.4) / steps - 0.4), (i * L) / steps],
        [3, ((i + 1) * 8.4) / steps, ((i + 1) * L) / steps],
        concrete,
      );
    beam(o, 'concrete', [0, 0, 0], [0, 8.1, L], 6, 0.35, concrete);
    for (const x of [-3, 3])
      rail(
        o,
        Array.from({ length: 25 }, (_, i) => [x, (i * 8.4) / 24, (i * L) / 24]),
      );
    for (let i = 1; i < 5; i++)
      beam(
        o,
        'concrete',
        [0, 0, (i * L) / 5],
        [0, (i * 8.4) / 5 - 0.4, (i * L) / 5],
        0.65,
        0.65,
        concrete,
      );
  }
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352;
    face(
      out,
      'concrete',
      [rad(a, 116, 8.4), rad(b, 116, 8.4), rad(b, 129, 8.4), rad(a, 129, 8.4)],
      concrete,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [rad(a, 129, 7.7), rad(b, 129, 7.7), rad(b, 129, 8.4), rad(a, 129, 8.4)],
      concrete,
      rad(a, 1).map((v, k) => (k === 1 ? 0 : v)),
    );
    face(
      out,
      'glass',
      [rad(a, 115.5, 0.3), rad(b, 115.5, 0.3), rad(b, 115.5, 7.75), rad(a, 115.5, 7.75)],
      [0.095, 0.14, 0.16],
      [Math.sin(a), 0, Math.cos(a)],
    );
    if (i % 4 === 0) beam(out, 'concrete', rad(a, 116, 0), rad(a, 116, 8.2), 0.62, 0.62, concrete);
  }
}
function facade(out) {
  const d = TAU / 44;
  for (let i = 0; i < 44; i++) {
    const a = i * d;
    for (const s of [-1, 1]) {
      beam(out, 'metal', cone(a, 8.4), cone(a + s * d * 0.5, 28.9), 0.32, 0.48, white);
      beam(out, 'metal', cone(a + s * d * 0.5, 28.9), cone(a, 49.5), 0.32, 0.48, white);
    }
    // Slender divergent rods form the characteristic fireworks behind the main diamond grid.
    for (const s of [-1, -0.5, 0.5, 1]) {
      beam(out, 'metal', cone(a, 8.5), cone(a + s * d, 49.3), 0.115, 0.2, white);
      beam(
        out,
        'metal',
        cone(a + d * 0.5, 28.9),
        cone(a + s * d + d * 0.5, 49.3),
        0.09,
        0.15,
        white,
      );
    }
    for (const [ang, y] of [
      [a, 8.5],
      [a + d * 0.5, 28.9],
      [a, 49.3],
    ]) {
      const o = transformed(out, ang, cone(ang, y));
      box(o, 'metal', [-0.45, -0.35, -0.1], [0.45, 0.35, 0.1], white);
      for (const x of [-0.28, 0.28])
        for (const Y of [-0.22, 0.22])
          tube(o, 'metal', [x, Y, 0.11], [x, Y, 0.16], 0.045, steel, 10);
    }
    const p = cone(a, 8.4);
    box(out, 'concrete', [p[0] - 0.8, 0, p[2] - 0.8], [p[0] + 0.8, 8.4, p[2] + 0.8], concrete);
  }
  for (const y of [8.4, 28.9, 49.5]) circle(out, 127.5 + ((y - 8.4) / 41.1) * 24, y, 0.15, white);
  // Set-back translucent foyer wall leaves the structural rods fully three-dimensional.
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352,
      p = cone(a, 8.65),
      q = cone(b, 8.65),
      P = cone(a, 49.0),
      Q = cone(b, 49.0),
      inset = (p) => [2.1 + (p[0] - 2.1) * 0.985, p[1], 3.15 + (p[2] - 3.15) * 0.985];
    face(
      out,
      'acrylic',
      [inset(p), inset(q), inset(Q), inset(P)],
      [0.61, 0.73, 0.77],
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
  // Freestanding concrete concourse levels and circulation remain visible through the shell.
  for (const y of [8.4, 14.7, 21.0, 28.0])
    for (let i = 0; i < 176; i++) {
      const a = (i * TAU) / 176,
        b = ((i + 1) * TAU) / 176;
      face(
        out,
        'concrete',
        [rad(a, 112, y), rad(b, 112, y), rad(b, 123, y), rad(a, 123, y)],
        concrete,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [rad(a, 123, y - 0.35), rad(b, 123, y - 0.35), rad(b, 123, y), rad(a, 123, y)],
        concrete,
        [Math.sin(a), 0, Math.cos(a)],
      );
      if (y === 8.4 && i % 4 === 0 && i % 16 !== 0)
        beam(out, 'concrete', rad(a, 121, 8.4), rad(a, 121, 36.7), 0.65, 0.65, concrete);
    }
  for (let i = 0; i < 11; i++) {
    const a = (i * TAU) / 11,
      o = transformed(out, a, rad(a, 119, 8.45));
    for (let k = 0; k < 3; k++) {
      const rev = k % 2 === 1;
      beam(
        o,
        'concrete',
        [0, k * 6.3 - 0.1, rev ? 9.04 : -10],
        [0, k * 6.3 + 6.15, rev ? -10 : 9.04],
        6.4,
        0.3,
        concrete,
      );
      for (let j = 0; j < 34; j++)
        box(
          o,
          'concrete',
          [-3.2, k * 6.3 + j * 0.185, -10 + (rev ? 33 - j : j) * 0.56],
          [3.2, k * 6.3 + (j + 1) * 0.185, -10 + (rev ? 34 - j : j + 1) * 0.56],
          concrete,
        );
      for (const x of [-3.2, 3.2])
        rail(
          o,
          Array.from({ length: 18 }, (_, j) => [
            x,
            k * 6.3 + (j * 6.3) / 17,
            -10 + ((rev ? 17 - j : j) * 19.04) / 17,
          ]),
        );
      box(
        o,
        'concrete',
        [-3.4, k * 6.3 + 6.1, rev ? -12 : 9],
        [3.4, k * 6.3 + 6.3, rev ? -9 : 12],
        concrete,
      );
    }
  }
}
const inner = (a, y) => E(a, 64, 84, y);
function roof(out) {
  // Published44upper/lower radial cable lines, six-cable tension rings, and20m-high inner struts.
  const upper = (a, t) =>
    mix(inner(a, 47.7), rad(a, 131.5, 43.5), t).map(
      (v, j) => v - (j === 1 ? 1.0 * Math.sin(Math.PI * t) : 0),
    );
  const lower = (a, t) =>
    mix(inner(a, 27.7), rad(a, 131.5, 43.5), t).map(
      (v, j) => v - (j === 1 ? 1.6 * Math.sin(Math.PI * t) : 0),
    );
  for (let i = 0; i < 44; i++) {
    const a = (i * TAU) / 44;
    for (const f of [upper, lower])
      curve(
        out,
        Array.from({ length: 41 }, (_, j) => f(a, j / 40)),
        0.036,
        steel,
        'metal',
        12,
      );
    const mast = Array.from({ length: 25 }, (_, j) => {
      const p = inner(a, 27.7 + (j * 20) / 24),
        d = 3.1 * Math.sin((j * Math.PI) / 24);
      return [p[0] + d * Math.sin(a), p[1], p[2] + d * Math.cos(a)];
    });
    curve(out, mast, 0.17, white, 'metal', 16);
    tube(out, 'metal', inner(a, 27.7), inner(a, 47.7), 0.072, steel, 12);
    for (let j = 1; j <= 4; j++) {
      const t = j / 5;
      tube(out, 'metal', lower(a, t), upper(a, t), 0.08, white, 12);
    }
    const o = transformed(out, a, inner(a, 27.7));
    box(o, 'metal', [-0.55, -0.3, -0.22], [0.55, 0.6, 0.22], steel);
    for (const x of [-0.3, 0.3]) tube(o, 'metal', [x, 0, 0.23], [x, 0, 0.34], 0.07, dark, 12);
  }
  for (const level of [27.7, 47.7])
    for (let j = 0; j < 6; j++) {
      const r = ((j % 3) - 1) * 0.16,
        y = level + Math.floor(j / 3) * 0.16;
      curve(
        out,
        Array.from({ length: 353 }, (_, i) => E((i * TAU) / 352, 64 + r, 84 + r, y)),
        level < 30 ? 0.065 : 0.035,
        steel,
        'metal',
        10,
      );
    }
  // Membrane saddle bays sit on transverse arched battens between radial cables.
  const panels = 88,
    rings = 6;
  for (let i = 0; i < panels; i++)
    for (let j = 0; j < rings; j++) {
      const p = (u, v) => {
        const a = ((i + u) * TAU) / panels,
          t = (j + v) / rings,
          P = upper(a, t);
        P[1] += 0.28 + 1.5 * Math.sin(Math.PI * u) * (0.25 + 0.75 * Math.cos(v * TAU));
        return P;
      };
      for (let u = 0; u < 6; u++)
        for (let v = 0; v < 6; v++) {
          const ps = [
            p(u / 6, v / 6),
            p((u + 1) / 6, v / 6),
            p((u + 1) / 6, (v + 1) / 6),
            p(u / 6, (v + 1) / 6),
          ];
          metricFace(out, 'membrane', ps, white, [0, 1, 0]);
          metricFace(
            out,
            'membrane',
            ps.map((P) => [P[0], P[1] - 0.035, P[2]]),
            pale,
            [0, -1, 0],
          );
        }
      if (j === 0)
        curve(
          out,
          Array.from({ length: 13 }, (_, k) => p(k / 12, 0)),
          0.052,
          steel,
        );
      curve(
        out,
        Array.from({ length: 13 }, (_, k) => p(k / 12, 1)),
        0.052,
        steel,
      );
      curve(
        out,
        Array.from({ length: 9 }, (_, k) => p(0, k / 8)),
        0.027,
        white,
      );
    }
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352;
    const p = rad(a, 131.5, 43.78 + 1.5 * Math.abs(Math.sin(a * 44))),
      q = rad(b, 131.5, 43.78 + 1.5 * Math.abs(Math.sin(b * 44))),
      P = rad(a, 151.5, 49.5),
      Q = rad(b, 151.5, 49.5);
    face(out, 'translucentRoof', [p, q, Q, P], [0.64, 0.79, 0.83], [0, 1, 0]);
    if (i % 4 === 0) beam(out, 'metal', p, P, 0.1, 0.18, white);
    const I = E(a, 57, 77, 49.35),
      J = E(b, 57, 77, 49.35),
      inP = inner(a, 47.98 + 1.5 * Math.abs(Math.sin(a * 44))),
      inQ = inner(b, 47.98 + 1.5 * Math.abs(Math.sin(b * 44)));
    face(out, 'acrylic', [I, J, inQ, inP], [0.72, 0.83, 0.86], [0, 1, 0]);
    if (i % 2 === 0) beam(out, 'metal', I, inP, 0.055, 0.1, white);
  }
  for (const r of [131.5, 140, 151.5]) circle(out, r, 43.5 + ((r - 131.5) * 6) / 20, 0.16, white);
  // Inner maintenance catwalk and acoustic/light bars follow the oval compression space.
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352;
    face(
      out,
      'metal',
      [E(a, 62.6, 82.6, 27.75), E(b, 62.6, 82.6, 27.75), E(b, 65, 85, 27.75), E(a, 65, 85, 27.75)],
      steel,
      [0, 1, 0],
    );
  }
  for (const r of [-1.3, 1])
    rail(
      out,
      Array.from({ length: 177 }, (_, i) => E((i * TAU) / 176, 64 + r, 84 + r, 27.75)),
    );
  for (let i = 0; i < 88; i++) {
    const a = (i * TAU) / 88,
      o = transformed(out, a, inner(a, 28.8));
    for (const x of [-0.55, 0, 0.55]) {
      box(o, 'metal', [x - 0.21, -0.42, -0.45], [x + 0.21, 0, 0.1], dark);
      face(
        o,
        'plastic',
        [
          [x - 0.18, -0.38, -0.46],
          [x + 0.18, -0.38, -0.46],
          [x + 0.18, -0.05, -0.46],
          [x - 0.18, -0.05, -0.46],
        ],
        white,
        [0, 0, -1],
      );
    }
  }
  for (const s of [-1, 1]) {
    // Keep the screen in front of the maintenance ring so it is not sliced by the catwalk.
    const o = transformed(out, s > 0 ? 0 : Math.PI, [0, 0, s * 80.8]);
    box(o, 'metal', [-8.1, 23, -0.45], [8.1, 32.5, 0.45], dark);
    face(
      o,
      'plastic',
      [
        [-7.8, 23.3, -0.46],
        [7.8, 23.3, -0.46],
        [7.8, 32.2, -0.46],
        [-7.8, 32.2, -0.46],
      ],
      [0.006, 0.012, 0.017],
      [0, 0, -1],
    );
    for (const x of [-6, 6]) {
      tube(o, 'metal', [x, 32.5, 0], [x, 47, 0], 0.12, steel, 16);
      beam(o, 'metal', [x, 47, 0], [x, 47, 3.2], 0.24, 0.28, steel);
    }
  }
}
const tiers = [
  { rows: 26, hx: 43.5, hz: 63.5, r: 15, dr: 0.6, run: 0.85, y: 0.9, rise: 0.42 },
  { rows: 34, hx: 72, hz: 91.5, r: 34, dr: 1.29, run: 0.87, y: 18.1, rise: 0.56 },
];
const seat = (a, t, row) =>
  rounded(a, t.hx + row * t.run, t.hz + row * t.run, t.r + row * t.dr, t.y + row * t.rise);
function bowl(out) {
  soccerPitch(out);
  for (const [k, t] of tiers.entries()) {
    for (let row = 0; row < t.rows; row++)
      for (let i = 0; i < 352; i++) {
        const a = (i * TAU) / 352,
          b = ((i + 1) * TAU) / 352,
          p = seat(a, t, row),
          q = seat(b, t, row),
          P = seat(a, t, row + 1),
          Q = seat(b, t, row + 1);
        face(out, 'concrete', [p, q, [Q[0], p[1], Q[2]], [P[0], p[1], P[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[P[0], p[1], P[2]], [Q[0], p[1], Q[2]], Q, P], concrete, [
          Math.sin(a) * -1,
          0,
          Math.cos(a) * -1,
        ]);
        const sector = ((a / TAU) * 44) % 1;
        if (sector < 0.04 || sector > 0.96) continue;
        const n = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.51));
        for (let j = 0; j < n; j++) {
          const h =
            (Math.imul(i + 13, 73856093) ^
              Math.imul(row + 7, 19349663) ^
              Math.imul(j + 19, 83492791)) >>>
            0;
          chair(
            out,
            Math.atan2(-(q[2] - p[2]), q[0] - p[0]),
            mix(p, q, (j + 0.5) / n),
            h % 100 < (k ? 76 : 42) ? blue : pale,
          );
        }
      }
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        P = seat(a, t, t.rows),
        Q = seat(b, t, t.rows),
        down = (p) => [p[0], p[1] - 0.65, p[2]];
      face(out, 'concrete', [down(p), down(q), down(Q), down(P)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [P, Q, down(Q), down(P)], concrete, [Math.sin(a), 0, Math.cos(a)]);
    }
    for (let i = 0; i < 44; i++) {
      const a = (i * TAU) / 44;
      rail(
        out,
        Array.from({ length: t.rows + 1 }, (_, j) => seat(a + 0.009, t, j)),
      );
      const o = transformed(out, a, seat(a, t, k ? 15 : 18));
      box(o, 'concrete', [-1.25, 0, -0.35], [1.25, 2.8, 3], concrete);
      face(
        o,
        'plastic',
        [
          [-1.08, 0.04, -0.37],
          [1.08, 0.04, -0.37],
          [1.08, 2.55, -0.37],
          [-1.08, 2.55, -0.37],
        ],
        dark,
        [0, 0, -1],
      );
    }
  }
  for (let i = 0; i < 256; i++) {
    const a = (i * TAU) / 256,
      b = ((i + 1) * TAU) / 256,
      p = seat(a, tiers[0], 26),
      q = seat(b, tiers[0], 26),
      P = seat(a, tiers[1], 0),
      Q = seat(b, tiers[1], 0);
    const wallY = (p, y) => [p[0], y, p[2]];
    face(out, 'concrete', [wallY(p, 17.75), wallY(q, 17.75), Q, P], white, [0, 1, 0]);
    const vip = Math.sin(a) > 0;
    for (const y of [12.05, 14.95]) {
      face(
        out,
        vip ? 'glass' : 'concrete',
        [wallY(p, y), wallY(q, y), wallY(q, y + 2.55), wallY(p, y + 2.55)],
        vip ? [0.08, 0.14, 0.18] : [0.7, 0.74, 0.74],
        [-Math.sin(a), 0, -Math.cos(a)],
      );
      beam(out, 'metal', wallY(p, y), wallY(p, y + 2.55), 0.07, 0.1, white);
      beam(out, 'concrete', wallY(p, y - 0.1), wallY(q, y - 0.1), 0.3, 0.35, white);
    }
  }
  for (const z of [-16, 16]) {
    const o = transformed(out, Math.PI / 2, [38.7, 0.1, z]);
    for (let j = 0; j < 14; j++) chair(o, Math.PI, [j * 0.65 - 4.3, 0, 0], blue);
    for (let j = 0; j < 20; j++) {
      const a = (j * Math.PI) / 40,
        b = ((j + 1) * Math.PI) / 40,
        P = (a, x) => [x, 1.1 + 1.55 * Math.sin(a), 0.45 + 1.55 * Math.cos(a)];
      face(o, 'glassClear', [P(a, -5), P(a, 5), P(b, 5), P(b, -5)], [0.78, 0.86, 0.89], [0, 1, 1]);
      if (j % 4 === 0) beam(o, 'metal', P(a, -5), P(a, 5), 0.045, 0.045, white);
    }
  }
}
export function buildVolgograd(out) {
  podium(out);
  facade(out);
  bowl(out);
  roof(out);
}
export const volgogradStudy = {
  id: 'N0704',
  key: 'volgograd_arena',
  wikidataId: 'Q4366184',
  title: 'Volgograd Arena',
  build: buildVolgograd,
  metricTriangleUv: true,
  smoothNormalSlots: ['roof'],
  size: [403, 52, 368],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped field centre at ground-level playing surface. +Z geographic north and+X west; the elevated entry bridge/deck lies8.4m above the ground.',
  },
  visualBrief:
    'Volgograd’s inverted-cone fireworks facade: broad white diamond members, fine branching rods and exposed connection plates in front of a translucent foyer. A44-spoke cable wheel carries a white scalloped roof, blue-tinted rising perimeter canopy, clear inner lip and20m-bowed inner masts. Six-cable upper/lower tension rings, lower catwalk, hanging screens, two blue/white seating tiers, western double VIP ribbon and the mapped elevated angular access circuit distinguish this arena.',
  sourceFacts: {
    published:
      'PIARENA:49m height, two seating tiers, two western VIP levels, branching steel diamond facade and five-point access concept. Freyssinet:44radial cable lines,20m inner struts,4separator legs per radial axis, upper6×70mm and lower6×130mm tension-ring cables, radial60–70mm cables; roof lifted to48m. Maffeis documents PVC/ETFE roof/foyer construction. Primary architect photographs and cutaway drawings show completed facade and sectional organization.',
    reconstructed:
      '303m top diameter and49.5m maximum follow the published stadium envelope corroborated by completed photographs. The exact mapped building base is about256m, distinct from the wider roof; field axis and elevated footbridge are directly mapped. Native8.4m entry deck, inner-ring altitude27.7m, roof dish, branching-member sections, seating pattern and member inventories are scaled/photo reconstructions. Main structural44axes and cable bundle sizes retain primary dimensions.',
  },
  referencePages: [
    'https://piarena.ru/volgograd-arena/',
    'https://www.freyssinet.com/case-study/volgograd-arena-cable-stayed-roof/',
    'https://www.maffeis.it/index.php/portfolio-items/volgograd-stadium/',
    'https://volgogradarena.com/main/tribuni/',
    'https://www.openstreetmap.org/relation/7718662',
    'https://www.openstreetmap.org/way/539236144',
    'https://www.openstreetmap.org/way/622798144',
  ],
  referenceRights:
    'Primary architect/engineer photographs and technical text consulted, not embedded. Original component geometry and shared canonical surfaces. OSM-derived footprint/field/access-path coordinates ©OpenStreetMap contributors,ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'NativeY0is the field and supporting pier foot. Thin sloped access slabs extend at most0.18m below their endpoint; this buried slab thickness does not shift the ground contact plane.',
    source: 'https://www.openstreetmap.org/way/539236144',
    featureIds: ['relation/7718662', 'way/502041813', 'way/539236144', 'way/622798144'],
    notes:
      'Exact mapped rectangular field fixes native+Z north and+Xwest, placing the two VIP levels on the west. The mapped building base is about256m; the visibly inverted roof widens to303m. The elevated access route and radial stairs use the actual mapped bridge paths. Field and supporting piers meetY0; an8.4m elevated deck does not set terrain contact.',
  },
  limitations: [
    'Detailed permanent exterior and visible bowl; small-member inventories, stair-flight subdivisions and seat colour distribution are constrained reconstructions. Private rooms, temporary event/sponsor art and an exact ticket-seat count are excluded.',
  ],
  previewCamera: { position: [271, 157, 285], lookAt: [0, 22, 0] },
  qaCameras: [
    { name: 'near-fireworks-grid', position: [149, 26, 36], lookAt: [130, 27, 30] },
    { name: 'near-branch-joint', position: [13, 28, 152], lookAt: [12, 29, 143] },
    { name: 'near-access-deck', position: [-177, 17, 61], lookAt: [-138, 7, 60] },
    { name: 'near-foyer-stairs', position: [0, 20, 144], lookAt: [0, 19, 119] },
    { name: 'near-membrane-arches', position: [27, 66, 104], lookAt: [24, 46, 102] },
    { name: 'near-bowed-mast', position: [30, 38, 62], lookAt: [18, 39, 82] },
    { name: 'near-cable-bundles', position: [13, 32, 68], lookAt: [12, 29.3, 82] },
    { name: 'near-roof-trusses', position: [0, 27, 16], lookAt: [76, 39, 0] },
    { name: 'near-blue-white-tiers', position: [0, 5, 0], lookAt: [91, 23, 0] },
    { name: 'near-west-vip', position: [39, 13, 0], lookAt: [67, 15, 0] },
    { name: 'near-goal-screen', position: [0, 21, 40], lookAt: [0, 29, 86] },
    { name: 'far-volga-silhouette', position: [-273, 77, -213], lookAt: [0, 27, 0] },
  ],
};
