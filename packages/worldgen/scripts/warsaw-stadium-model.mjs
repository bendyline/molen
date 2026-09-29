/** Warsaw: mapped72-column plan, two cable rings, floating needle and woven expanded-metal basket. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { lathe as latheY, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { warsawPlan as plan } from './warsaw-plan.mjs';

const TAU = Math.PI * 2,
  white = [0.87, 0.88, 0.85],
  steel = [0.72, 0.75, 0.74],
  red = [0.61, 0.018, 0.027],
  concrete = [0.58, 0.6, 0.57],
  dark = [0.027, 0.042, 0.046];
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const lathe = (out, slot, profile, color, count) =>
  latheY(
    out,
    slot,
    profile.map(([r, y]) => [y, r]),
    color,
    count,
  );
const rad = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];
const angle = (p) => Math.atan2(p[0], p[1]);
const ellipse = (a, rx, rz, y) => [Math.sin(a) * rx, y, Math.cos(a) * rz];
const angles = plan.columns.map(angle);
const loop = (points) => points.slice(0, -1);
function radius(a, points) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      vx = q[0] - p[0],
      vz = q[1] - p[1],
      d = dx * vz - dz * vx;
    if (Math.abs(d) < 1e-9) continue;
    const r = (p[0] * vz - p[1] * vx) / d,
      t = (p[0] * dz - p[1] * dx) / d;
    if (r > 0 && t >= -1e-6 && t <= 1 + 1e-6) best = Math.min(best, r);
  }
  if (!Number.isFinite(best)) throw Error('Warsaw outline ray missed');
  return best;
}
const roofR = (a) => radius(a, loop(plan.roof));
const innerR = (a) => radius(a, loop(plan.glassOuter));
const clearR = (a) => radius(a, loop(plan.roofOpening));
const ringY = (a) => 51.5 + 1.8 * Math.sin(2 * a) ** 2;
const tipY = (a) => 65.6 + 2.6 * Math.sin(2 * a) ** 2;
const lowerY = (a, t) => ringY(a) * (1 - t) + 48.1 * t - 3.3 * Math.sin(Math.PI * t);
const upperY = (a, t) => tipY(a) * (1 - t) + 56.2 * t - 5.5 * Math.sin(Math.PI * t);
const roofPoint = (a, t, dy = 0) =>
  rad(a, (roofR(a) - 10) * (1 - t) + innerR(a) * t, lowerY(a, t) + 1.4 + dy);
function rounded(a, hx, hz, r, y = 0) {
  const x = Math.sin(a),
    z = Math.cos(a);
  let lo = 0,
    hi = Math.hypot(hx, hz);
  for (let i = 0; i < 30; i++) {
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
function rail(out, pts, h = 1.06) {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const y of [h, h * 0.5])
      tube(
        out,
        'metal',
        pts[i].map((v, j) => v + (j === 1 ? y : 0)),
        pts[i + 1].map((v, j) => v + (j === 1 ? y : 0)),
        0.022,
        steel,
        6,
      );
    tube(
      out,
      'metal',
      pts[i],
      pts[i].map((v, j) => v + (j === 1 ? h : 0)),
      0.028,
      steel,
      6,
    );
  }
}
function annulus(out, rx, rz, width, y, color = concrete) {
  for (let i = 0; i < 256; i++) {
    const a = (i * TAU) / 256,
      b = ((i + 1) * TAU) / 256,
      p = ellipse(a, rx, rz, y),
      q = ellipse(b, rx, rz, y),
      P = ellipse(a, rx - width, rz - width, y),
      Q = ellipse(b, rx - width, rz - width, y);
    face(out, 'concrete', [p, q, Q, P], color, [0, 1, 0]);
    face(out, 'concrete', [p, q, [q[0], y - 0.5, q[2]], [p[0], y - 0.5, p[2]]], color, rad(a, 1));
  }
}
function site(out) {
  // The published sections retain an earth berm around the new bowl: street0, pitch8, main concourse18m.
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288,
      r = roofR(a) - 6,
      R = roofR(b) - 6,
      outer = roofR(a) + 36,
      Outer = roofR(b) + 36;
    face(
      out,
      'turf',
      [rad(a, r, 18), rad(b, R, 18), rad(b, Outer, 0), rad(a, outer, 0)],
      [0.24, 0.3, 0.17],
      [Math.sin(a), 1, Math.cos(a)],
    );
    face(
      out,
      'concrete',
      [
        rad(a, r - 14, 18.04),
        rad(b, R - 14, 18.04),
        rad(b, R + 1.5, 18.04),
        rad(a, r + 1.5, 18.04),
      ],
      [0.57, 0.58, 0.54],
      [0, 1, 0],
    );
  }
  for (let i = 0; i < 18; i++) {
    const a = (i * TAU) / 18,
      r = roofR(a) - 6,
      run = 42,
      o = transformed(out, a, rad(a, r, 0));
    for (let j = 0; j < 100; j++)
      box(
        o,
        'concrete',
        [-4, 0, (j * run) / 100],
        [4, 18.16 - j * 0.18, ((j + 1) * run) / 100],
        concrete,
      );
    for (const x of [-4, 0, 4])
      rail(
        o,
        Array.from({ length: 21 }, (_, k) => [x, 18.16 - k * 0.9, (k * run) / 20]),
      );
  }
  for (const y of [18.5, 25.5, 32, 39.5, 47]) annulus(out, 116, 137, 19, y);
  for (let i = 0; i < 192; i++) {
    const a = (i * TAU) / 192,
      b = ((i + 1) * TAU) / 192,
      p = ellipse(a, 113, 134, 18.5),
      q = ellipse(b, 113, 134, 18.5);
    face(
      out,
      'glass',
      [p, q, [q[0], 46.6, q[2]], [p[0], 46.6, p[2]]],
      [0.13, 0.19, 0.2],
      rad(a, 1),
    );
    beam(out, 'metal', p, [p[0], 46.8, p[2]], 0.12, 0.18, white);
  }
  for (let i = 0; i < 72; i++) {
    const a = angles[i],
      r = Math.hypot(...plan.columns[i]),
      o = transformed(out, a, rad(a, r - 5, 18));
    for (let level = 0; level < 3; level++)
      for (let j = 0; j < 42; j++)
        box(
          o,
          'concrete',
          [-3, level * 8.4 + j * 0.2, -12 + j * 0.31],
          [3, level * 8.4 + (j + 1) * 0.2, -11.69 + j * 0.31],
          concrete,
        );
  }
}
function skinPoint(a, y, row) {
  const r = roofR(a) - 10 + (y - 18) * 0.2 + 1.0 * Math.sin(a * 36) * Math.pow(-1, row);
  return rad(a, r, y);
}
function wovenSkin(out) {
  for (let i = 0; i < 72; i++) {
    const a = angles[i],
      b = i === 71 ? angles[0] + TAU : angles[i + 1];
    for (let row = 0; row < 19; row++)
      for (let j = 0; j < 4; j++) {
        const A = a + ((b - a) * j) / 4 + 0.0005,
          B = a + ((b - a) * (j + 1)) / 4 - 0.0005;
        const y0 = 21.3 + row * 1.48,
          y1 = y0 + 1.405;
        const warp = (q) => 1.8 * Math.sin(2 * q) ** 2;
        const p = [
          skinPoint(A, y0 + warp(A), row),
          skinPoint(B, y0 + warp(B), row),
          skinPoint(B, y1 + warp(B), row),
          skinPoint(A, y1 + warp(A), row),
        ];
        const band = (Math.imul(i * 4 + j + 7, 19349663) ^ Math.imul(row + 9, 73856093)) >>> 0;
        const color = band % 100 < 90 - row * 4.5 ? red : white;
        const n = normalFor(...p.slice(0, 3)),
          uv = [
            [0, y0],
            [Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]), y0],
            [Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]), y1],
            [0, y1],
          ];
        const normal = rad((A + B) / 2, 1);
        if (n.reduce((s, v, k) => s + v * normal[k], 0) > 0)
          out.addQuad('diamond', 'metric:uv', p, n, uv, color);
        else
          out.addQuad(
            'diamond',
            'metric:uv',
            [...p].reverse(),
            n.map((v) => -v),
            [...uv].reverse(),
            color,
          );
        // Both sides share exactly the same alpha apertures; cassette frame and stand-offs are geometry.
        const inside = p.map((q) => {
          const r = Math.hypot(q[0], q[2]);
          return [(q[0] * (r - 0.035)) / r, q[1], (q[2] * (r - 0.035)) / r];
        });
        const ni = normalFor(...inside.slice(0, 3));
        if (ni.reduce((s, v, k) => s + v * normal[k], 0) > 0)
          out.addQuad(
            'diamond',
            'metric:uv',
            [...inside].reverse(),
            ni.map((v) => -v),
            [...uv].reverse(),
            color,
          );
        else out.addQuad('diamond', 'metric:uv', inside, ni, uv, color);
        for (let k = 0; k < 4; k++) beam(out, 'metal', p[k], p[(k + 1) % 4], 0.045, 0.035, color);
        if (j === 0 || j === 3) {
          const mid = mix(p[0], p[3], 0.5),
            inside = rad((A + B) / 2, Math.hypot(...plan.columns[i]), mid[1]);
          tube(out, 'metal', mid, inside, 0.025, steel, 8);
        }
      }
  }
}
function roofSystem(out) {
  for (let i = 0; i < 72; i++) {
    const a = angles[i],
      col = plan.columns[i],
      r = Math.hypot(...col),
      tip = rad(a, roofR(a), tipY(a)),
      foot = [col[0], 18.4, col[1]],
      ring = [col[0], ringY(a), col[1]];
    tube(out, 'metal', foot, ring, 0.508, steel, 48);
    tube(out, 'metal', ring, tip, 0.47, steel, 40);
    tube(out, 'metal', foot, tip, 0.254, steel, 32);
    const o = transformed(out, a, foot);
    box(o, 'concrete', [-1.5, -0.4, -1.5], [1.5, 0, 1.5], concrete);
    box(o, 'metal', [-0.86, 0, -0.86], [0.86, 0.13, 0.86], steel);
    for (const x of [-0.63, 0.63])
      for (const z of [-0.63, 0.63]) tube(o, 'metal', [x, 0.13, z], [x, 0.32, z], 0.055, steel, 8);
    const next = (i + 1) % 72,
      b = angles[next],
      qcol = plan.columns[next],
      qring = [qcol[0], ringY(b), qcol[1]],
      qtip = rad(b, roofR(b), tipY(b));
    tube(out, 'metal', ring, qring, 0.91, steel, 40);
    tube(out, 'metal', ring, qtip, 0.095, steel, 12);
    tube(out, 'metal', qring, tip, 0.095, steel, 12);
    if (i % 18 < 2) {
      tube(out, 'metal', foot, qring, 0.11, steel, 12);
      tube(out, 'metal', [qcol[0], 18.4, qcol[1]], ring, 0.11, steel, 12);
    }
    const inner = innerR(a);
    for (let j = 0; j < 16; j++) {
      const t = j / 16,
        T = (j + 1) / 16;
      for (const upper of [false, true]) {
        const rr = (upper ? roofR(a) : r) * (1 - t) + inner * t,
          RR = (upper ? roofR(a) : r) * (1 - T) + inner * T,
          fn = upper ? upperY : lowerY;
        tube(
          out,
          'metal',
          rad(a, rr, fn(a, t)),
          rad(a, RR, fn(a, T)),
          upper ? 0.058 : 0.064,
          [0.28, 0.32, 0.32],
          10,
        );
      }
    }
    for (let j = 1; j <= 7; j++) {
      const t = j / 8,
        rr = r * (1 - t) + inner * t;
      const upperT = (roofR(a) - rr) / (roofR(a) - inner);
      tube(out, 'metal', rad(a, rr, lowerY(a, t)), rad(a, rr, upperY(a, upperT)), 0.026, steel, 8);
    }
    tube(out, 'metal', tip, [tip[0], tip[1] + 0.8, tip[2]], 0.11, white, 16);
  }
  // Membrane panels have shallow transverse arches between radial cable lines.
  for (let i = 0; i < 432; i++)
    for (let j = 0; j < 20; j++) {
      const a = -Math.PI + (i * TAU) / 432,
        b = -Math.PI + ((i + 1) * TAU) / 432,
        t = j / 20,
        T = (j + 1) / 20;
      const f = (q, u) =>
        roofPoint(q, u, 0.75 * Math.abs(Math.sin(q * 36)) * Math.sin(Math.PI * u));
      const p = [f(a, t), f(b, t), f(b, T), f(a, T)];
      face(out, 'membrane', p, white, [0, 1, 0]);
      face(
        out,
        'membrane',
        p.map((q) => [q[0], q[1] - 0.05, q[2]]),
        [0.81, 0.82, 0.78],
        [0, -1, 0],
      );
      if (i % 6 === 0) tube(out, 'metal', f(a, t), f(a, T), 0.032, steel, 6);
    }
  for (let i = 0; i < 288; i++) {
    const a = (i * TAU) / 288,
      b = ((i + 1) * TAU) / 288;
    const outer = (q) => rad(q, innerR(q), 49.5),
      inner = (q) => rad(q, clearR(q), 49.2);
    face(out, 'glassClear', [outer(a), outer(b), inner(b), inner(a)], [0.8, 0.9, 0.93], [0, 1, 0]);
    if (i % 2 === 0) beam(out, 'metal', outer(a), inner(a), 0.065, 0.12, steel);
    for (const frac of [0, 0.25, 0.5, 0.75, 1])
      tube(
        out,
        'metal',
        mix(inner(a), outer(a), frac),
        mix(inner(b), outer(b), frac),
        0.024,
        steel,
        6,
      );
    for (const y of [48.1, 56.2])
      tube(out, 'metal', rad(a, innerR(a), y), rad(b, innerR(b), y), 0.12, [0.3, 0.33, 0.33], 12);
    const p = rad(a, innerR(a) + 1.5, 48.5),
      q = rad(b, innerR(b) + 1.5, 48.5);
    beam(out, 'metal', p, q, 1.2, 0.14, [0.3, 0.34, 0.33]);
    if (i % 4 === 0) {
      rail(out, [p, q]);
      const o = transformed(out, a, p);
      box(o, 'metal', [-0.5, 0.1, -0.4], [0.5, 0.4, 0.4], dark);
      box(o, 'plastic', [-0.45, 0.08, -0.35], [0.45, 0.1, 0.35], [0.95, 0.96, 0.84]);
    }
    // Peripheral canopy between compression ring and the top of the woven basket.
    face(
      out,
      'membrane',
      [
        rad(a, roofR(a) - 10, ringY(a)),
        rad(b, roofR(b) - 10, ringY(b)),
        rad(b, roofR(b) - 3.2, 50.9),
        rad(a, roofR(a) - 3.2, 50.9),
      ],
      white,
      [0, 1, 0],
    );
  }
  for (let i = 0; i < 60; i++) {
    const a = (i * TAU) / 60,
      r = innerR(a);
    tube(out, 'metal', rad(a, r, 48.1), rad(a, r, 56.2), 0.12, steel, 20);
    const outer = rad(a, r, 56.2),
      center = rad(a, 8.5, 70.8),
      pts = Array.from({ length: 21 }, (_, j) => {
        const t = j / 20,
          p = mix(outer, center, t);
        p[1] -= 1.7 * Math.sin(Math.PI * t);
        return p;
      });
    curve(out, pts, 0.032, [0.24, 0.29, 0.29], 'metal', 8);
  }
  // The operable roof is shown parked centrally, keeping permanent field and cable structure visible.
  lathe(
    out,
    'metal',
    [
      [0.82, 38],
      [0.82, 79],
    ],
    white,
    64,
  );
  lathe(
    out,
    'membrane',
    [
      [8.8, 64.4],
      [10.4, 68.5],
      [10.4, 69],
      [8.8, 69],
    ],
    white,
    96,
  );
  lathe(
    out,
    'metal',
    [
      [10.65, 69],
      [10.65, 69.22],
      [2.0, 71.4],
    ],
    steel,
    96,
  );
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72;
    beam(out, 'metal', rad(a, 10.7, 67.8), rad(a, 10.7, 69.8), 0.1, 0.09, white);
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    curve(out, [rad(a, innerR(a), 48.1), rad(a, 1.2, 39)], 0.073, [0.27, 0.3, 0.3], 'metal', 12);
    const o = transformed(out, (i * Math.PI) / 2, [0, 0, 0]);
    box(o, 'metal', [-7.2, 43, 6.4], [7.2, 51.3, 7.2], dark);
    box(o, 'plastic', [-6.8, 43.35, 7.22], [6.8, 50.95, 7.26], [0.006, 0.012, 0.014]);
    beam(o, 'metal', [-7, 43, 7], [7, 43, 7], 0.25, 0.25, steel);
    for (const x of [-6, 6]) {
      tube(o, 'metal', [x, 44, 6], [0, 39, 0], 0.12, steel, 16);
      tube(o, 'metal', [x, 51, 6], [0, 59, 0], 0.12, steel, 16);
    }
  }
  for (let j = 0; j < 6; j++)
    lathe(
      out,
      'plastic',
      [
        [0.82 - j * 0.12, 79 + (j * 29) / 6],
        [0.82 - (j + 1) * 0.12, 79 + ((j + 1) * 29) / 6],
      ],
      j % 2 ? white : red,
      48,
    );
}
function seat(a, t, row) {
  return rounded(
    a,
    t ? 66 + row * 0.83 : 39 + row * 0.8,
    t ? 88 + row * 0.83 : 60 + row * 0.8,
    t ? 45 + row * 0.65 : 12 + row * 0.22,
    t ? 28 + row * 0.46 : 8.8 + row * 0.4,
  );
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, 8.1, 0]));
  for (let t = 0; t < 2; t++) {
    const rows = t ? 37 : 28;
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < 400; i++) {
        const a = (i * TAU) / 400,
          b = ((i + 1) * TAU) / 400,
          p = seat(a, t, row),
          q = seat(b, t, row),
          r = seat(b, t, row + 1),
          s = seat(a, t, row + 1);
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, rad(a, -1));
        const sector = ((a / TAU) * 36) % 1;
        if (sector < 0.05 || sector > 0.95) continue;
        const n = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.5));
        for (let j = 0; j < n; j++) {
          const v = mix(p, q, (j + 0.5) / n),
            noise =
              (Math.imul(i + 13, 73856093) ^
                Math.imul(row + 5, 19349663) ^
                Math.imul(j + 11, 83492791)) >>>
              0;
          chair(
            out,
            Math.atan2(-(q[2] - p[2]), q[0] - p[0]),
            v,
            noise % 100 < (t ? 35 : 82) ? red : white,
          );
        }
      }
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        r = seat(b, t, rows),
        s = seat(a, t, rows),
        down = (p) => [p[0], p[1] - 0.7, p[2]];
      face(out, 'concrete', [down(p), down(q), down(r), down(s)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [s, r, down(r), down(s)], concrete, rad(a, 1));
    }
    for (let i = 0; i < 36; i++) {
      const a = (i * TAU) / 36;
      rail(
        out,
        Array.from({ length: rows + 1 }, (_, j) => seat(a + 0.008, t, j)),
      );
      const o = transformed(out, a, seat(a, t, t ? 12 : 17));
      box(o, 'concrete', [-1.35, 0, -1], [1.35, 2.9, 2.6], concrete);
      box(o, 'plastic', [-1.15, 0.03, -1.04], [1.15, 2.6, -1.02], dark);
    }
  }
  for (const y of [20.8, 24.6])
    for (let i = 0; i < 256; i++) {
      const a = (i * TAU) / 256,
        b = ((i + 1) * TAU) / 256,
        p = rounded(a, 63.5, 84.5, 19, y),
        q = rounded(b, 63.5, 84.5, 19, y);
      face(
        out,
        'glass',
        [p, q, [q[0], y + 2.65, q[2]], [p[0], y + 2.65, p[2]]],
        [0.08, 0.12, 0.13],
        rad(a, -1),
      );
      beam(out, 'metal', p, [p[0], y + 2.7, p[2]], 0.065, 0.09, white);
      const P = rounded(a, 62.1, 83.1, 19, y - 0.25),
        Q = rounded(b, 62.1, 83.1, 19, y - 0.25);
      face(out, 'concrete', [P, Q, q, p], white, [0, 1, 0]);
      beam(out, 'metal', [P[0], y + 1.05, P[2]], [Q[0], y + 1.05, Q[2]], 0.06, 0.09, white);
    }
  for (const z of [-16, 16]) {
    const o = transformed(out, Math.PI / 2, [37.1, 8.2, z]);
    for (let j = 0; j < 15; j++) chair(o, Math.PI, [j * 0.62 - 4.5, 0, 0], red);
    for (let i = 0; i < 22; i++) {
      const a = (i * Math.PI) / 44,
        b = ((i + 1) * Math.PI) / 44,
        f = (a, x) => [x, 1.15 + 1.55 * Math.sin(a), 0.5 + 1.55 * Math.cos(a)];
      face(o, 'glassClear', [f(a, -5), f(a, 5), f(b, 5), f(b, -5)], [0.8, 0.88, 0.9], [0, 1, 1]);
      if (i % 4 === 0) beam(o, 'metal', f(a, -5), f(a, 5), 0.04, 0.04, steel);
    }
  }
}
export function buildWarsaw(out) {
  site(out);
  bowl(out);
  roofSystem(out);
  wovenSkin(out);
}
export const warsawStudy = {
  id: 'N0702',
  key: 'kazimierz_gorski_national_stadium',
  wikidataId: 'Q179693',
  title: 'Kazimierz Górski National Stadium',
  build: buildWarsaw,
  metricTriangleUv: true,
  smoothNormalSlots: [],
  embeddedCanonicalGraphs: ['metal_expanded_diamond'],
  size: [390, 109, 390],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped roof centre at external street datum. +Z follows the roof major axis northwest. Field8m and main entry18m above street follow the scaled architect sections.',
  },
  previewCamera: { position: [258, 157, 307], lookAt: [0, 41, 0] },
  visualBrief:
    'Warsaw’s red-and-white woven expanded-metal basket on the inherited earth berm;72independent columns, an undulating compression ring, projecting crown struts and façade ties; two radial cable levels joined by504hangers, inner flying masts, clear glazed inner roof ring, a floating red/white needle and parked central membrane garage with four video screens. Two distinct red/white seating tiers, double hospitality ribbons, concourse stairs and fixed scalloped PTFE roof remain visible.',
  sourceFacts: {
    published:
      'SBP:310×280m principal structure,72columns and inclined struts,72upper+72lower cables,72×7hangers,60flying masts and60retractable-roof cables. Primary SBP2013maintenance manual printedpp26–39 shows load paths,4lower needle ties,56%open expanded aluminium and a4.6m membrane garage. Columns1016mm, compression ring1820mm and facade ties508mm are documented steel sizes. GMP completed photographs and scaled cross/longitudinal sections define the berm and bowl.',
    reconstructed:
      'OSM roof5173816, glass rings311295050/51 and72column/tip footprints define plan. The roof PCA fixes the northwest major axis. Published geodesic zero and local street differ;8m pitch/street and18m main-concourse/street offsets are reconstructed from architect section scale. Mild roof-ring undulation, cable sag, seating row counts, red/white panel distribution and detailed stairs are photograph reconstructions. Diamond0.12×0.04m pitch is reconstructed;56% openness is measured evidence. Retractable roof shown parked, static.',
  },
  referencePages: [
    'https://www.gmp.de/en/projects/519/national-stadium-in-warsaw',
    'https://www.sbp.de/en/project/national-stadium-warsaw/',
    'https://www.jskarchitects.com/projekty/sportowe/stadion-narodowy%2C5',
    'https://www.hsh.info/varsav12.htm',
    'https://www.pgenarodowy.pl/upload/editor/file/20190911_Zalacznik_2_OPZ_Podrecznik_uzytkownika_konstrukcja_dachu_i_fasady.pdf',
    'https://www.openstreetmap.org/way/5173816',
    'https://www.openstreetmap.org/relation/4166727',
  ],
  referenceRights:
    'Primary engineer/architect photographs and drawings consulted, not embedded. Original geometry and canonical procedural surfaces; OSM-derived coordinates ©OpenStreetMap contributors,ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'NativeY0is external street at the retained earth-berm foot; scaled architect sections place field about8m and main elevated concourse18m above street. Ground plane is not the playing field. Model contains the berm and external access stairs.',
    source: 'https://www.openstreetmap.org/way/5173816',
    featureIds: [
      'way/5173816',
      'way/311295050',
      'way/311295051',
      'way/316556318',
      'relation/4166727',
    ],
    notes:
      'Exact fixed-roof footprint replaces the577m leisure estate polygon. Roof PCA establishes the major axis, and architect plan supplies the symmetric northwest +Z pitch convention. The retained earth berm is reconstructed as a continuous sloped envelope from published sections; the separate mapped base contains ramp/service cut-ins and is preserved as reference, not copied as a jagged slope. Remote estate paving and service buildings remain ordinary map geometry.',
  },
  limitations: [
    'Permanent exterior and visible bowl; detailed member/seat inventories, mesh fabrication pitch and red/white panel mosaic are reconstructed. Closed rooms, temporary event graphics, sponsor lettering and retractable roof motion are excluded.',
  ],
  qaCameras: [
    { name: 'near-woven-basket', position: [143, 33, 20], lookAt: [127, 33, 18] },
    { name: 'near-diamond-apertures', position: [134, 37, 3], lookAt: [125.8, 37, 3] },
    { name: 'near-stair-and-skin', position: [124, 26, 25], lookAt: [122, 34, 15] },
    { name: 'near-compression-ring', position: [137, 59, 25], lookAt: [119, 54, 20] },
    { name: 'near-crown-stays', position: [149, 69, 10], lookAt: [125, 61, 8] },
    { name: 'near-floating-needle', position: [35, 80, 40], lookAt: [0, 68, 0] },
    { name: 'near-video-cross', position: [22, 42, 25], lookAt: [0, 45, 0] },
    { name: 'near-fixed-membrane', position: [46, 73, 113], lookAt: [44, 50, 105] },
    { name: 'near-glass-ring', position: [35, 57, 8], lookAt: [49, 49, 8] },
    { name: 'near-bowl', position: [0, 14, 0], lookAt: [65, 30, 0] },
    { name: 'near-hospitality', position: [35, 22, 0], lookAt: [63, 23, 0] },
    { name: 'near-berm-access', position: [8, 6, 193], lookAt: [0, 16, 153] },
    { name: 'far-vistula', position: [255, 101, 222], lookAt: [0, 45, 0] },
  ],
};
