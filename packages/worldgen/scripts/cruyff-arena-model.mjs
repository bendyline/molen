/** Johan Cruijff ArenA: original H-frame, moving roof, raised road deck and east ETFE addition. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { cruyffPlan } from './cruyff-plan.mjs';
import { transformed } from './lighthouse-models.mjs';
import { letterAt, lettering } from './stadium-lettering.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.87, 0.89, 0.86],
  concrete = [0.61, 0.63, 0.6],
  red = [0.64, 0.018, 0.033],
  dark = [0.024, 0.039, 0.044],
  glass = [0.11, 0.18, 0.2];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  rad = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
function tri(out, slot, ps, col, n) {
  let N = normalFor(...ps);
  if (N.reduce((v, k, i) => v + k * n[i], 0) < 0) {
    ps = [...ps].reverse();
    N = normalFor(...ps);
  }
  out.addTriangle(
    slot,
    'palette:#ffffff',
    ps,
    N,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function rounded(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return rad(a, t, y);
}
function rail(out, ps, col = white) {
  for (const h of [0.52, 1.08])
    curve(
      out,
      ps.map((p) => [p[0], p[1] + h, p[2]]),
      0.027,
      col,
    );
  for (let i = 0; i < ps.length; i += 2)
    tube(out, 'metal', ps[i], [ps[i][0], ps[i][1] + 1.08, ps[i][2]], 0.027, col, 8);
}
function archY(x) {
  return 52 + 25.6 * (1 - (x / 88.5) ** 2);
}
function outer(a, y = 0) {
  return rounded(a, 95, 117, 67, y);
}
function roofPoint(a, t) {
  const p = rounded(a, 35.5, 53.5, 0),
    q = outer(a),
    v = mix(p, q, t);
  v[1] = 52 + (archY(p[0]) - 6 - 52) * (1 - t);
  return v;
}
function ring(out, fn, r = 0.07, col = white, n = 360, slot = 'metal') {
  curve(
    out,
    Array.from({ length: n + 1 }, (_, i) => fn((i * TAU) / n)),
    r,
    col,
    slot,
  );
}

function roof(out) {
  // The two actual transverse arches span177m; their planes are118m apart.
  for (const sign of [-1, 1]) {
    const z = sign * 59;
    for (let j = 0; j < 36; j++) {
      const x = -88.5 + (j * 177) / 36,
        X = -88.5 + ((j + 1) * 177) / 36,
        h = archY(x),
        H = archY(X),
        d = 1 + 5 * Math.sin((Math.PI * j) / 36),
        D = 1 + 5 * Math.sin((Math.PI * (j + 1)) / 36);
      const A = [x, h, z],
        B = [X, H, z];
      tube(out, 'metal', A, B, 0.36, white, 12);
      for (const side of [-1, 1]) {
        const C = [x, h - d, z + side * 3.2],
          E = [X, H - D, z + side * 3.2];
        tube(out, 'metal', C, E, 0.29, white, 12);
        tube(out, 'metal', A, E, 0.16, white, 10);
        tube(out, 'metal', C, B, 0.16, white, 10);
        tube(out, 'metal', C, A, 0.15, white, 10);
        tube(out, 'metal', C, [X, H - D, z - side * 3.2], 0.12, white, 8);
      }
      if (j % 3 === 0 && j > 0 && j < 36)
        tube(out, 'metal', [x, 52, z], [x, h - d, z], 0.13, white, 10);
    }
    for (const dz of [-1, 1])
      beam(out, 'metal', [-88.5, 52, z + dz * 0.7], [88.5, 52, z + dz * 0.7], 0.32, 0.62, white);
    for (let j = 0; j < 36; j++)
      tube(
        out,
        'metal',
        [-88.5 + (j * 177) / 36, 52, z - 0.7],
        [-88.5 + ((j + 1) * 177) / 36, 52, z + 0.7],
        0.08,
        white,
        8,
      );
  }
  // Longitudinal support girders, rail beds and open movable roof panels.
  for (const sign of [-1, 1]) {
    const x = sign * 35.5;
    for (let k = 0; k < 24; k++) {
      const z = -59 + (k * 118) / 24,
        Z = -59 + ((k + 1) * 118) / 24;
      tube(out, 'metal', [x, 53, z], [x, 53, Z], 0.23, white, 10);
      for (const dx of [-1, 1]) {
        tube(out, 'metal', [x + dx * 2.4, 59, z], [x + dx * 2.4, 59, Z], 0.19, white, 10);
        tube(out, 'metal', [x, 53, z], [x + dx * 2.4, 59, Z], 0.12, white, 8);
      }
      box(out, 'metal', [x - 1, 52.5, z + 0.25], [x + 1, 53, z + 1.8], white);
      box(out, 'plastic', [x - 0.45, 50.7, z + 0.3], [x + 0.45, 52.45, z + 1.4], dark);
    }
    for (let j = 0; j < 20; j++)
      for (let k = 0; k < 54; k++) {
        const a = 35.5 + (j * 37) / 20,
          b = 35.5 + ((j + 1) * 37) / 20,
          z = -59 + (k * 118) / 54,
          Z = -59 + ((k + 1) * 118) / 54;
        const A = [sign * a, archY(a) + 0.5, z],
          B = [sign * b, archY(b) + 0.5, z],
          C = [sign * b, archY(b) + 0.5, Z],
          D = [sign * a, archY(a) + 0.5, Z];
        face(out, 'translucentRoof', [A, B, C, D], [0.81, 0.87, 0.87], [0, 1, 0]);
        beam(out, 'metal', A, B, 0.048, 0.062, white);
        if (j % 2 === 0) beam(out, 'metal', A, D, 0.055, 0.08, white);
        if (k % 6 === 0) {
          const low = [A[0], A[1] - 2.1, A[2]],
            end = [B[0], B[1] - 2.1, B[2]];
          beam(out, 'metal', low, end, 0.13, 0.14, white);
          beam(out, 'metal', low, B, 0.07, 0.08, white);
        }
      }
    for (const z of [-59, 59]) {
      curve(
        out,
        Array.from({ length: 73 }, (_, j) => {
          const x = -88.5 + (j * 177) / 72;
          return [x, archY(x) + 0.36, z];
        }),
        0.07,
        [0.32, 0.36, 0.35],
      );
      for (let j = 0; j < 8; j++) {
        const x = sign * (37 + j * 4.8);
        box(
          out,
          'metal',
          [x - 0.38, archY(x) - 0.28, z - 0.48],
          [x + 0.38, archY(x) + 0.22, z + 0.48],
          [0.34, 0.38, 0.38],
        );
      }
    }
  }
  // Fifty triangular secondary roof girders follow the engineer's frame inventory.
  for (let k = 0; k < 50; k++) {
    const a = (k * TAU) / 50;
    for (let j = 0; j < 12; j++) {
      const p = roofPoint(a, j / 12),
        q = roofPoint(a, (j + 1) / 12),
        P = [p[0], p[1] - 2.3, p[2]],
        Q = [q[0], q[1] - 2.3, q[2]];
      beam(out, 'metal', p, q, 0.19, 0.25, white);
      beam(out, 'metal', P, Q, 0.14, 0.18, white);
      beam(out, 'metal', P, q, 0.09, 0.12, white);
    }
  }
  for (let i = 0; i < 400; i++)
    for (let j = 0; j < 24; j++) {
      const a = (i * TAU) / 400,
        b = ((i + 1) * TAU) / 400,
        t = j / 24,
        u = (j + 1) / 24;
      const ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      // The open panels overlap this fixed sub-roof; only the outer fixed skin is opaque.
      face(
        out,
        j < 6 ? 'translucentRoof' : 'metal',
        ps,
        j < 6 ? [0.81, 0.87, 0.85] : [0.57, 0.61, 0.6],
        [0, 1, 0],
      );
      if (i % 4 === 0) beam(out, 'metal', ps[0], ps[3], 0.038, 0.05, white);
      if (j % 3 === 0) beam(out, 'metal', ps[0], ps[1], 0.028, 0.04, white);
    }
  ring(out, (a) => outer(a, 52), 0.65, [0.48, 0.51, 0.5]);
  // The operator's4200 modules cover the opaque fixed outer ring, never the moving leaves.
  for (let row = 0; row < 7; row++)
    for (let k = 0; k < 600; k++) {
      const a = ((k + 0.5) * TAU) / 600,
        p = rounded(a, 35.5, 53.5, 0),
        q = outer(a),
        t = 0.7 + row * 0.038,
        center = mix(p, q, t),
        tangent = [Math.cos(a), -Math.sin(a)],
        radial = [Math.sin(a), Math.cos(a)],
        ps = [];
      for (const [u, v] of [
        [-0.49, -0.825],
        [0.49, -0.825],
        [0.49, 0.825],
        [-0.49, 0.825],
      ]) {
        const X = center[0] + tangent[0] * u + radial[0] * v,
          Z = center[2] + tangent[1] * u + radial[1] * v,
          A = Math.atan2(X, Z),
          P = rounded(A, 35.5, 53.5, 0),
          Q = outer(A),
          T =
            (Math.hypot(X, Z) - Math.hypot(P[0], P[2])) /
            (Math.hypot(Q[0], Q[2]) - Math.hypot(P[0], P[2])),
          V = roofPoint(A, T);
        V[1] += 0.17;
        ps.push(V);
      }
      face(out, 'glass', ps, [0.025, 0.053, 0.082], [0, 1, 0]);
      beam(out, 'metal', ps[0], ps[3], 0.022, 0.024, [0.4, 0.43, 0.45]);
      for (const f of [1 / 3, 2 / 3])
        beam(
          out,
          'metal',
          mix(ps[0], ps[3], f),
          mix(ps[1], ps[2], f),
          0.008,
          0.02,
          [0.27, 0.32, 0.38],
        );
    }
}

function seat(a, t, row) {
  return rounded(
    a,
    t ? 62 + row * 0.79 : 39 + row * 0.8,
    t ? 86 + row * 0.72 : 62 + row * 0.8,
    t ? 29 + row * 0.9 : 12,
    t ? 31 + row * 0.53 : 11.2 + row * 0.4,
  );
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, 10.5, 0]));
  box(out, 'concrete', [-40, 9.85, -62], [40, 10.49, 62], concrete);
  for (let t = 0; t < 2; t++)
    for (let row = 0; row < (t ? 35 : 27); row++)
      for (let i = 0; i < 400; i++) {
        const a = (i * TAU) / 400,
          b = ((i + 1) * TAU) / 400,
          p = seat(a, t, row),
          q = seat(b, t, row),
          r = seat(b, t, row + 1),
          s = seat(a, t, row + 1);
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        const n = Math.max(1, Math.floor(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.51));
        for (let j = 0; j < n; j++) {
          const v = mix(p, q, (j + 0.5) / n),
            f = ((((Math.atan2(v[0], v[2]) / TAU) * 40) % 1) + 1) % 1;
          if (f < 0.047 || f > 0.953) continue;
          let color = red;
          if (
            !t &&
            v[0] < -45 &&
            Math.abs(v[2]) < 38 &&
            letterAt('AJAX', (v[2] + 38) / 76, (26 - row) / 27, 0.16)
          )
            color = white;
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, color);
        }
      }
  for (let t = 0; t < 2; t++) {
    const rows = t ? 35 : 27;
    // Continuous reinforced-concrete tier soffits conceal seat backs from exterior concourses.
    for (let i = 0; i < 400; i++) {
      const a = (i * TAU) / 400,
        b = ((i + 1) * TAU) / 400;
      const p = seat(a, t, 0),
        q = seat(b, t, 0),
        r = seat(b, t, rows),
        s = seat(a, t, rows);
      const lower = (v) => [v[0], v[1] - 0.65, v[2]];
      face(out, 'concrete', [lower(p), lower(q), lower(r), lower(s)], concrete, [
        Math.sin(a),
        -1,
        Math.cos(a),
      ]);
      face(out, 'concrete', [s, r, lower(r), lower(s)], concrete, [Math.sin(a), 0, Math.cos(a)]);
      // Close the raised field-side deck between the playing slab and first stepped row.
      if (!t) {
        const P = rounded(a, 39, 62, 0, 10.49),
          Q = rounded(b, 39, 62, 0, 10.49);
        face(out, 'concrete', [P, Q, q, p], concrete, [0, 1, 0]);
      }
    }
    for (let k = 0; k < 40; k++) {
      const a = (k * TAU) / 40;
      rail(
        out,
        Array.from({ length: rows + 1 }, (_, j) => seat(a, t, j)),
      );
      const p = seat(a, t, t ? 13 : 15),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.2, 0, -0.2], [1.2, 2.6, 3], white);
      box(o, 'glass', [-1, 0, -0.23], [1, 2.3, -0.21], dark);
    }
    for (let i = 0; i < 400; i++) {
      const a = (i * TAU) / 400,
        b = ((i + 1) * TAU) / 400,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        n = [-Math.sin(a), 0, -Math.cos(a)];
      face(
        out,
        t ? 'glass' : 'concrete',
        [[p[0], p[1] - (t ? 7 : 1), p[2]], [q[0], q[1] - (t ? 7 : 1), q[2]], q, p],
        t ? glass : concrete,
        n,
      );
      beam(out, 'concrete', p, q, 0.35, 0.45, white);
      if (t) {
        const P = [p[0], p[1] - 1.1, p[2] - 0.015 * Math.cos(a)],
          Q = [q[0], q[1] - 1.1, q[2] - 0.015 * Math.cos(b)];
        face(out, 'plastic', [P, Q, [Q[0], Q[1] - 0.85, Q[2]], [P[0], P[1] - 0.85, P[2]]], red, n);
        if (i % 4 === 0)
          beam(out, 'metal', [p[0], p[1] - 7, p[2]], [p[0], p[1] - 0.3, p[2]], 0.055, 0.055, white);
      }
    }
  }
  // Suspended end screens and technical walkways are separate from the opening roof.
  for (const sign of [-1, 1]) {
    const o = transformed(out, sign > 0 ? 0 : Math.PI, [0, 45, sign * 62]);
    box(o, 'plastic', [-7.5, 0, -0.5], [7.5, 6, 0.4], red);
    box(o, 'glass', [-7.2, 0.25, -0.52], [7.2, 5.75, -0.51], dark);
    for (const x of [-6, 6]) tube(o, 'metal', [x, 6, 0], [x, 13, 0], 0.07, white, 8);
  }
  for (const sign of [-1, 1]) {
    for (let j = 0; j < 24; j++) {
      const z = -57 + (j * 114) / 24;
      box(
        out,
        'metal',
        [sign * 34.4 - 0.3, 51.2, z - 0.32],
        [sign * 34.4 + 0.3, 51.65, z + 0.32],
        white,
      );
      box(
        out,
        'glass',
        [sign * 34.4 - 0.24, 51.16, z - 0.24],
        [sign * 34.4 + 0.24, 51.2, z + 0.24],
        [0.94, 0.97, 0.94],
      );
    }
  }
}

function facade(out) {
  // Fifty concrete frames and louvered undersides remain visible on the old north/west/south sides.
  for (let k = 0; k < 50; k++) {
    const a = (k * TAU) / 50,
      p = outer(a, 0),
      r = Math.hypot(p[0], p[2]),
      bottom = rad(a, r - 14, 0),
      mid = rad(a, r - 10, 29),
      top = rad(a, r, 51.2);
    beam(out, 'concrete', bottom, mid, 0.8, 1.3, concrete);
    beam(out, 'concrete', mid, top, 0.85, 1.35, concrete);
    beam(out, 'plastic', rad(a, r - 0.55, 49.6), rad(a, r, 51.3), 0.88, 1.42, red);
  }
  for (let i = 0; i < 400; i++) {
    const a = (i * TAU) / 400,
      b = ((i + 1) * TAU) / 400,
      A = outer(a),
      B = outer(b),
      r = Math.hypot(A[0], A[2]),
      R = Math.hypot(B[0], B[2]);
    for (const y of [4.1, 8, 10.4, 16.4, 23, 29]) {
      const p = rad(a, r - 10, y),
        q = rad(b, R - 10, y),
        s = rad(a, r - 22, y),
        t = rad(b, R - 22, y);
      face(out, 'concrete', [p, q, t, s], concrete, [0, 1, 0]);
      beam(out, 'concrete', p, q, 0.3, 0.5, white);
    }
    // Light concourse ribbons with dark windows and red bay markers.
    for (const y of [16.4, 23]) {
      const n = [Math.sin(a), 0, Math.cos(a)];
      face(
        out,
        'metal',
        [
          rad(a, r - 9.8, y),
          rad(b, R - 9.8, y),
          rad(b, R - 9.8, y + 3.8),
          rad(a, r - 9.8, y + 3.8),
        ],
        white,
        n,
      );
      face(
        out,
        'glass',
        [
          rad(a, r - 9.77, y + 1.2),
          rad(b, R - 9.77, y + 1.2),
          rad(b, R - 9.77, y + 2.5),
          rad(a, r - 9.77, y + 2.5),
        ],
        glass,
        n,
      );
      if (i % 8 === 0)
        beam(out, 'plastic', rad(a, r - 9.7, y), rad(a, r - 9.7, y + 3.8), 0.65, 0.14, red);
    }
    const recess = 0;
    face(
      out,
      'metal',
      [rad(a, r - 0.16, 51), rad(b, R - 0.16, 51), rad(b, R, 52), rad(a, r, 52)],
      [0.53, 0.57, 0.55],
      [Math.sin(a), 0.4, Math.cos(a)],
    );
    // Ribbed opaque upper shell: the visible horizontal blades sit on a continuous backing.
    face(
      out,
      'metal',
      [
        rad(a, r - recess - 10.16, 30),
        rad(b, R - recess - 10.16, 30),
        rad(b, R - recess - 0.16, 51),
        rad(a, r - recess - 0.16, 51),
      ],
      [0.56, 0.59, 0.56],
      [Math.sin(a), -0.2, Math.cos(a)],
    );
    for (let j = 0; j < 26; j++) {
      const t = j / 26,
        u = (j + 0.45) / 26;
      face(
        out,
        'metal',
        [
          rad(a, r - recess - 10 + t * 10, 30 + t * 21),
          rad(b, R - recess - 10 + t * 10, 30 + t * 21),
          rad(b, R - recess - 10 + u * 10, 30 + u * 21),
          rad(a, r - recess - 10 + u * 10, 30 + u * 21),
        ],
        [0.62, 0.65, 0.62],
        [Math.sin(a), -0.2, Math.cos(a)],
      );
    }
  }
  // The road crosses below the10.5m field. Open portals and separated parking piers keep it clear.
  for (const x of [-71, -48, 48, 71])
    for (const z of [-92, -65, -37, 32, 61, 88])
      box(out, 'concrete', [x - 0.65, 0, z - 0.65], [x + 0.65, 10.4, z + 0.65], concrete);
  for (const x of [-84, 84]) {
    for (const z of [-52, 31])
      box(out, 'concrete', [x - 1.5, 0, z - 1.5], [x + 1.5, 10.4, z + 1.5], concrete);
    beam(out, 'concrete', [x, 8.8, -50], [x, 8.8, 29], 1.7, 1.1, concrete);
  }
}

// Thick rectangular facade cell with a genuine circular opening, including its reveal.
function holeCell(out, slot, cx, cy, z, hw, hh, r, depth, col) {
  const angles = [
    ...Array.from({ length: 49 }, (_, i) => (i * TAU) / 48),
    ...[-1, 1].flatMap((x) => [-1, 1].map((y) => (Math.atan2(y * hh, x * hw) + TAU) % TAU)),
  ].sort((a, b) => a - b);
  for (let i = 0; i < angles.length - 1; i++) {
    const a = angles[i],
      b = angles[i + 1],
      p = (t, radial, Z) => [cx + radial * Math.cos(t), cy + radial * Math.sin(t), Z],
      R = (t) =>
        Math.min(
          hw / Math.max(1e-9, Math.abs(Math.cos(t))),
          hh / Math.max(1e-9, Math.abs(Math.sin(t))),
        );
    face(out, slot, [p(a, r, z), p(b, r, z), p(b, R(b), z), p(a, R(a), z)], col, [0, 0, 1]);
    face(
      out,
      slot,
      [p(a, r, z - depth), p(b, r, z - depth), p(b, R(b), z - depth), p(a, R(a), z - depth)],
      col,
      [0, 0, -1],
    );
    face(out, slot, [p(a, r, z), p(a, r, z - depth), p(b, r, z - depth), p(b, r, z)], col, [
      -Math.cos((a + b) / 2),
      -Math.sin((a + b) / 2),
      0,
    ]);
  }
}
function endStairs(out, sign) {
  const o = transformed(out, sign > 0 ? 0 : Math.PI, [-3.6, 0, sign * 123]);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      holeCell(
        o,
        'concrete',
        (col - 1) * 7.5,
        8 + row * 7.6,
        5,
        3.75,
        3.8,
        2.48,
        6.4,
        [0.7, 0.71, 0.68],
      );
  box(o, 'concrete', [-11.25, 0, -1.4], [11.25, 4.2, 5], concrete);
  box(o, 'concrete', [-11.25, 27, -1.4], [11.25, 28.5, 5], concrete);
  for (const x of [-11.25, 11.05]) box(o, 'concrete', [x, 0, -8.5], [x + 0.2, 28.5, 5], concrete);
  for (const x of [-8, 0, 8]) box(o, 'glass', [x - 2.4, 0.3, 5.02], [x + 2.4, 3.6, 5.04], glass);
  for (let flight = 0; flight < 6; flight++) {
    const y = 4 + flight * 4,
      dir = flight % 2 ? 1 : -1;
    for (let j = 0; j < 24; j++) {
      const x = dir * (-9 + j * 0.75);
      box(
        o,
        'concrete',
        [Math.min(x, x + dir * 0.75), y + j / 6, -7],
        [Math.max(x, x + dir * 0.75), y + (j + 1) / 6, -3],
        concrete,
      );
    }
    rail(
      o,
      Array.from({ length: 25 }, (_, j) => [dir * (-9 + j * 0.75), y + j / 6, -2.95]),
    );
  }
  // Laces across the nine portals are part of Soeters' football-shoe treatment.
  for (let row = 0; row < 2; row++)
    for (const s of [-1, 1])
      tube(
        o,
        'metal',
        [s * 7.5, 8 + row * 7.6, 5.08],
        [-s * 7.5, 15.6 + row * 7.6, 5.08],
        0.085,
        [0.39, 0.43, 0.42],
        10,
      );
}
function cornerCore(out, sx, sz) {
  const o = transformed(out, (sx * Math.PI) / 2, [sx * 98, 0, sz * 59]);
  for (const s of [-1, 1]) {
    box(o, 'concrete', [s < 0 ? -13 : 6, 0, -4], [s < 0 ? -6 : 13, 30, 3.79], concrete);
    for (let y = 4; y < 29; y += 4.2) {
      const x = s * 9.5;
      holeCell(o, 'concrete', x, y, 4.02, 3.5, 2.1, 0.5, 0.2, [0.63, 0.65, 0.62]);
      for (let j = 0; j < 48; j++) {
        const a = (j * TAU) / 48,
          b = ((j + 1) * TAU) / 48;
        tri(
          o,
          'glass',
          [
            [x, y, 3.8],
            [x + 0.5 * Math.cos(a), y + 0.5 * Math.sin(a), 3.8],
            [x + 0.5 * Math.cos(b), y + 0.5 * Math.sin(b), 3.8],
          ],
          dark,
          [0, 0, 1],
        );
      }
    }
    box(o, 'concrete', [s < 0 ? -13 : 6, 0, 3.79], [s < 0 ? -6 : 13, 1.9, 4.02], concrete);
    box(o, 'concrete', [s < 0 ? -13 : 6, 27.1, 3.79], [s < 0 ? -6 : 13, 30, 4.02], concrete);
    for (const x of [s * 8, s * 11]) tube(o, 'metal', [x, 30, 0], [x, 60, 0], 0.32, white, 12);
    for (const z of [-1.65, 1.65])
      tube(o, 'metal', [s * 9.5, 30, z], [s * 9.5, 60, z], 0.28, white, 12);
    for (const y of [38, 47, 55]) {
      beam(o, 'metal', [s * 11, y, 0], [s * 8, y, 0], 0.2, 0.2, white);
      beam(o, 'metal', [s * 9.5, y, -1.65], [s * 9.5, y, 1.65], 0.2, 0.2, white);
    }
    loft(
      o,
      'metal',
      [
        radialRing(59.2, 1.8, 1.8, 48, [s * 9.5, 0]),
        radialRing(60.5, 3.4, 3.4, 48, [s * 9.5, 0]),
        radialRing(60.7, 3.4, 3.4, 48, [s * 9.5, 0]),
      ],
      white,
    );
  }
  box(o, 'glass', [-6, 0, -4], [6, 31, 3.1], glass);
  for (let y = 1; y < 30; y += 1.2)
    beam(o, 'metal', [-6, y, 3.15], [6, y, 3.15], 0.045, 0.045, white);
  for (let x = -6; x <= 6; x += 1.2)
    beam(o, 'metal', [x, 0, 3.15], [x, 30, 3.15], 0.04, 0.04, white);
  box(o, 'concrete', [-6, 29.5, -4], [6, 30, 4], white);
  // Each core connects the two ring concourses with diagonal enclosed escalators.
  for (const side of [-1, 1])
    for (let level = 0; level < 2; level++) {
      const a = [side * 8, 8 + level * 9.5, 0],
        b = [side * 32, 17.5 + level * 9.5, -2];
      beam(o, 'metal', a, b, 2.6, 0.5, white);
      beam(
        o,
        'glass',
        a.map((v, i) => v + (i === 1 ? 1.4 : 0)),
        b.map((v, i) => v + (i === 1 ? 1.4 : 0)),
        2.45,
        2.6,
        [0.21, 0.3, 0.26],
      );
      for (let j = 0; j <= 20; j++) {
        const p = mix(a, b, j / 20);
        beam(
          o,
          'metal',
          [p[0] - 1.25, p[1] + 2.8, p[2]],
          [p[0] + 1.25, p[1] + 2.8, p[2]],
          0.04,
          0.04,
          white,
        );
      }
    }
}

function eastSurface(z, y, bulge = 0) {
  const r = Math.abs(z) > 50 ? Math.sqrt(Math.max(0, 67 ** 2 - (Math.abs(z) - 50) ** 2)) + 28 : 95;
  return [-r - 3.8 * Math.sin((Math.PI * (y - 29)) / 23) - bulge, y, z];
}
function cushionBulge(z, y, cz, cy) {
  const u = (z - cz) / 3 + (y - cy) / 4.2,
    v = (z - cz) / 3 - (y - cy) / 4.2;
  return 0.42 * Math.max(0, Math.cos((Math.PI * u) / 2)) * Math.max(0, Math.cos((Math.PI * v) / 2));
}
function cushionNormal(p, _slot, ref) {
  if (!ref.endsWith('.etfe_film')) return;
  const row = Math.round((p[1] - 28) / 4.2);
  let best;
  for (let r = row - 1; r <= row + 1; r++) {
    const col = Math.round((p[2] + 108 - (r % 2) * 3) / 6),
      cz = -108 + col * 6 + (r % 2) * 3,
      cy = 28 + r * 4.2;
    const distance = Math.abs((p[2] - cz) / 3) + Math.abs((p[1] - cy) / 4.2);
    if (!best || distance < best.distance) best = { cz, cy, distance };
  }
  const f = (z, y) => eastSurface(z, y, cushionBulge(z, y, best.cz, best.cy))[0],
    e = 0.001;
  const dy = (f(p[2], p[1] + e) - f(p[2], p[1] - e)) / (2 * e),
    dz = (f(p[2] + e, p[1]) - f(p[2] - e, p[1])) / (2 * e);
  const n = [-1, dy, dz],
    l = Math.hypot(...n);
  return n.map((v) => v / l);
}
function easternExtension(out) {
  // Completed east-only diamond ETFE skin. Eye cutouts retain the original tower silhouettes.
  const bottom = (z) => 29 + 8 * Math.exp(-((z / 40) ** 2)),
    top = 52;
  const surface = eastSurface;
  const eyes = [-59, 59],
    inside = (z, y) =>
      y >= bottom(z) &&
      y <= top &&
      Math.abs(z) < 110 &&
      !eyes.some((e) => ((z - e) / 21) ** 2 + ((y - 42.7) / 11.9) ** 2 < 1);
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 37; col++) {
      const z = -108 + col * 6 + (row % 2) * 3,
        y = 28 + row * 4.2,
        verts = [
          [z, y - 4.2],
          [z + 3, y],
          [z, y + 4.2],
          [z - 3, y],
        ];
      for (let side = 0; side < 4; side++)
        for (let j = 0; j < 8; j++)
          for (let k = 0; k < 8 - j; k++) {
            const uv = (J, K) => {
              const a = verts[side],
                b = verts[(side + 1) % 4],
                u = J / 8,
                v = K / 8;
              return [z + (a[0] - z) * u + (b[0] - z) * v, y + (a[1] - y) * u + (b[1] - y) * v];
            };
            const A = uv(j, k),
              B = uv(j + 1, k),
              C = uv(j, k + 1),
              center = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
            const emit = (ps) => {
              const c = [
                ps.reduce((s, v) => s + v[0], 0) / 3,
                ps.reduce((s, v) => s + v[1], 0) / 3,
              ];
              if (!inside(...c)) return;
              const q = ps.map((v) => surface(v[0], v[1], cushionBulge(v[0], v[1], z, y)));
              tri(
                out,
                'etfe',
                q,
                (row + col) % 3 ? [0.82, 0.86, 0.84] : [0.68, 0.75, 0.73],
                [-1, 0, 0],
              );
            };
            if (inside(...center)) emit([A, B, C]);
            if (j + k < 7) emit([B, uv(j + 1, k + 1), C]);
          }
      for (let side = 0; side < 4; side++) {
        const a = verts[side],
          b = verts[(side + 1) % 4];
        for (let k = 0; k < 8; k++) {
          const p = mix(a, b, k / 8),
            q = mix(a, b, (k + 1) / 8);
          if (inside(...mix(p, q, 0.5)))
            tube(out, 'metal', surface(...p), surface(...q), 0.055, white, 8);
        }
      }
    }
  // Glazed oval eyes and continuous structural edge tubes close clipped diamond boundaries.
  for (const e of eyes) {
    const points = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i * TAU) / 128,
        z = e + 21 * Math.cos(a),
        y = 42.7 + 11.9 * Math.sin(a);
      if (y >= 29 && y <= 52.4) points.push(surface(z, y, 0.03));
      else if (points.length > 1) {
        curve(out, points, 0.16, white);
        points.length = 0;
      }
    }
    if (points.length > 1) curve(out, points, 0.16, white);
    for (let z = e - 20; z < e + 20; z += 1.5) {
      const h = 11.9 * Math.sqrt(Math.max(0, 1 - ((z - e) / 21) ** 2)),
        lo = 42.7 - h,
        hi = Math.min(52, 42.7 + h);
      if (hi <= lo) continue;
      const p = surface(z, lo),
        q = surface(z, hi);
      beam(out, 'metal', p, q, 0.055, 0.06, white);
    }
  }
  curve(
    out,
    Array.from({ length: 221 }, (_, i) => surface(-110 + i, bottom(-110 + i))),
    0.2,
    white,
  );
  curve(
    out,
    Array.from({ length: 221 }, (_, i) => surface(-110 + i, 52)),
    0.18,
    white,
  );
}

function westEntrance(out) {
  // Gold/silver Rolex entrance portal spans the road; the2007–12 eight-floor block stands behind.
  for (const z of [-39, 34]) box(out, 'concrete', [97, 0, z - 7], [112, 25, z + 7], white);
  box(out, 'metal', [96.5, 14, -46], [112, 27, 45.5], [0.75, 0.73, 0.59]);
  for (let z = -44; z < 45; z += 3.7)
    for (let y = 15.5; y < 26; y += 3.4) {
      box(out, 'glass', [112.02, y, z], [112.05, y + 2.35, z + 2.5], glass);
      box(
        out,
        'metal',
        [112.06, y - 0.18, z - 0.24],
        [112.15, y + 0.12, z + 2.74],
        [0.72, 0.56, 0.18],
      );
    }
  for (let floor = 0; floor < 8; floor++) {
    const y = 3 + floor * 3.6;
    box(out, 'metal', [89.5, y, -44], [96.4, y + 0.3, 44], white);
    for (const z of [-38, -27, 25, 37])
      box(out, 'glass', [96.45, y + 0.4, z - 4], [96.5, y + 3.3, z + 4], glass);
  }
  // Preserve the under-field Stramanweg entrance opening; doors flank it.
  for (const z of [-38, 36])
    for (let j = 0; j < 5; j++)
      box(out, 'glass', [112.02, 0.3, z - 5 + j * 2], [112.05, 3.2, z - 3.3 + j * 2], glass);
  const o = transformed(out, Math.PI / 2, [112.2, 27.4, 0]);
  lettering(o, 'JOHAN CRUIJFF ARENA', {
    width: 67,
    height: 1.8,
    y: 0,
    z: 0,
    color: white,
    stroke: 0.14,
  });
}
export function buildCruyff(out) {
  bowl(out);
  facade(out);
  roof(out);
  for (const s of [-1, 1]) {
    endStairs(out, s);
    for (const x of [-1, 1]) cornerCore(out, x, s);
  }
  easternExtension(out);
  westEntrance(out);
}

export const cruyffStudy = {
  id: 'N0699',
  key: 'johan_cruyff_arena',
  wikidataId: 'Q207109',
  title: 'Johan Cruyff Arena',
  build: buildCruyff,
  metricTriangleUv: true,
  smoothNormalSlots: ['roof'],
  normalAt: cushionNormal,
  size: [225, 78, 257],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Exact mapped pitch center. +Z northwest/north end, +X southwest/main entrance. Street contactY0; operator-published pitchY10.5.',
  },
  previewCamera: { position: [210, 161, 247], lookAt: [0, 33, 0] },
  visualBrief:
    'Amsterdam stadium in open-roof configuration: twin177m transverse triangular arches,118m separation, four paired dish-topped support towers, suspended50-girder roof, parked transparent sliding panels, roof solar fields, two red Ajax seating tiers, nine-hole end staircases, laced concrete cores, raised10.5m pitch above open Stramanweg portals, gold/silver west entrance and completed east-only diamond ETFE expansion with oval tower cutouts.',
  sourceFacts: {
    published:
      'Operator:78m maximum height, pitch10.5m above street,4200 solar panels,15 escalators and55,000+seats. Iv roof designer gives71x107m operating opening. Arcadis/TU Delft original structure description gives50 secondary girders and50 concrete frames,11m CHS portal supports and37x118m sliding panels. Original appendixed drawings give177m arch span and118m panel/arch separation. PPHP and Ballast Nedam document east ETFE expansion, original nine-hole stairs, gold/silver entrance and2007–12 eight-floor west addition.',
    reconstructed:
      'Pitch direction/anchor from exact OSM way57853514, outer footprint way57853253 and relation1458682. This mapped grass envelope112.36x74.52m includes pitch margins; play markings remain105x68m. Current roof/bowl sections use the published original section plus current red seats and east expansion photographs. Member profiles, tower dish heights, solar-module arrangement, row inventory and façade sub-divisions are reconstructed. Original sheet drawings are used only for the existing H-frame, not the thesis proposed replacement roof.',
  },
  referencePages: [
    'https://www.johancruijffarena.nl/en/discover-the-arena/school-presentation/',
    'https://www.iv.nl/en/projects/design-and-life-extension-of-the-roof-and-retractable-roof-structure-of-the-johan-cruijff-arena/',
    'https://books.scia.net/scia-contest-2005/96/',
    'https://repository.tudelft.nl/file/File_d6e9789b-e7ae-48b8-b19d-cb58e5a5d889',
    'https://www.ballast-nedam.com/what-we-do/projects/2020/johan-cruijff-arena',
    'https://pphp.nl/project/amsterdam-arena/',
    'https://pphp.nl/project/entreegebouw-amsterdam-arena/',
    'https://pphp.nl/project/hoofdgebouw-amsterdam-arena/',
    'https://arcam.nl/architectuur-gids/johan-cruijff-arena/',
    'https://group.vattenfall.com/nl/newsroom/archive/nieuws/2014/eerste-zonnepanelen-op-dak-amsterdam-arena',
    'https://www.nationalestaalprijs.nl/sites/default/files/Meint%20Smith/Johan%20Cruijff%20ArenA%202020_0.pdf',
    'https://www.openstreetmap.org/relation/1458682',
    'https://www.openstreetmap.org/way/57853514',
  ],
  referenceRights:
    'Original geometry, no reference photos or drawings embedded. Primary research stays under source-owner rights. OSM coordinates carry OpenStreetMap contributor attribution, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: cruyffPlan.anchor,
    heading: cruyffPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Street-contact foundations areY0. Inclined concrete-frame section corners extend0.105m below that plane as intentional embedded support geometry. Operator-published field elevation remains10.5m above it.',
    source: 'https://www.openstreetmap.org/way/57853514',
    featureIds: [
      'relation/1458682',
      'way/57853253',
      'way/57853514',
      'way/282372120',
      'way/282372125',
    ],
    notes:
      'Directed pitch fixes northwest north end, southwest main entrance and northeast ETFE façade. Distinct west portal resolves180-degree ambiguity. The operator10.5m pitch elevation is authored above streetY0, leaving the underlying road passage open; no terrain cutout is required. Cached outer footprint predates east expansion, represented as a modest upper façade projection.',
  },
  limitations: [
    'Current permanent exterior with roof parked open, no operating roof animation. Sections, glazing subdivisions, seat inventory, photovoltaics layout and structural profiles are photograph reconstructions.2026 tower paint maintenance is temporary and omitted. Independent Rainbow Offices and neighboring shopping blocks are separate map buildings. No enclosed rooms, crowds, event rigging or photographic branding.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-arch-hframe', position: [36, 84, 89], lookAt: [10, 72, 59] },
    { name: 'near-moving-roof', position: [81, 78, 13], lookAt: [54, 66, 0] },
    { name: 'near-roof-solar', position: [15, 97, 143], lookAt: [8, 59, 88] },
    { name: 'near-east-cushions', position: [-130, 43, 3], lookAt: [-97, 42, 1] },
    { name: 'near-east-eye', position: [-119, 51, 83], lookAt: [-89, 43, 59] },
    { name: 'near-dish-tower', position: [-128, 53, 101], lookAt: [-91, 45, 59] },
    { name: 'near-nine-hole-stair', position: [-1, 19, 160], lookAt: [-3.6, 16, 125] },
    { name: 'near-west-portal', position: [155, 19, 12], lookAt: [106, 13, 0] },
    { name: 'near-road-opening', position: [143, 3, -11], lookAt: [63, 4, -11] },
    { name: 'near-ajax-bowl', position: [0, 18, 0], lookAt: [-72, 30, 0] },
    { name: 'near-interior-roof', position: [0, 25, 0], lookAt: [20, 64, 59] },
    { name: 'far-current-east', position: [-251, 83, 170], lookAt: [0, 34, 0] },
  ],
};
