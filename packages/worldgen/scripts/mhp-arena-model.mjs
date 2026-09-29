/** Stuttgart's asymmetric cable-wheel roof,2011 inner extension and2024 main stand. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { mhpPlan } from './mhp-plan.mjs';
import { letterAt, lettering } from './stadium-lettering.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.93, 0.945, 0.94],
  steel = [0.62, 0.67, 0.67],
  concrete = [0.57, 0.59, 0.57],
  dark = [0.028, 0.036, 0.042],
  red = [0.47, 0.012, 0.025],
  glass = [0.1, 0.17, 0.19];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const roofPlan = mhpPlan.outer.map((p) => [p[0], (p[1] * 273) / 289.96678]);
function ray(poly, a) {
  const d = [Math.sin(a), Math.cos(a)];
  let hit = 0;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hit = Math.max(hit, t);
  }
  if (!hit) throw Error('Stuttgart plan ray missed');
  return hit;
}
const outer = (a) => ray(roofPlan, a),
  ground = (a) => ray(mhpPlan.outer, a),
  inner = (a) => ray(mhpPlan.inner, a),
  main = (a) => (Math.sin(a) + 1) / 2;
const upperY = (a) => 38.5 + 8.6 * main(a),
  rimY = (a) => 31 + 3.8 * main(a),
  oldY = (a) => 34.3 + 3.5 * main(a),
  newY = (a) => oldY(a) - 1.2;
function path(out, ps, r = 0.035, col = steel, slot = 'metal', sides = 8) {
  for (let i = 1; i < ps.length; i++)
    if (Math.hypot(...ps[i].map((v, k) => v - ps[i - 1][k])) > 0.0001)
      tube(out, slot, ps[i - 1], ps[i], r, col, sides);
}
function rail(out, ps) {
  for (const y of [0.52, 1.06])
    path(
      out,
      ps.map((p) => [p[0], p[1] + y, p[2]]),
      0.025,
    );
  for (let i = 0; i < ps.length; i += 3)
    tube(out, 'metal', ps[i], [ps[i][0], ps[i][1] + 1.06, ps[i][2]], 0.025, steel, 8);
}
function roofPoint(bay, u, t) {
  const a = ((bay + u) * TAU) / 40,
    r0 = inner(a),
    rOld = r0 + 14,
    r1 = outer(a),
    ext = t < 0.22,
    v = ext ? t / 0.22 : (t - 0.22) / 0.78,
    r = ext ? r0 + (rOld - r0) * v : rOld + (r1 - rOld) * v,
    y = ext ? newY(a) + (oldY(a) - newY(a)) * v : oldY(a) + (rimY(a) - oldY(a)) * v;
  return radial(
    a,
    r,
    y + Math.sin(Math.PI * u) * (ext ? 0.65 : 2.8) - 0.12 * Math.sin(Math.PI * ((v * 7) % 1)),
  );
}
function doubleRoof(out, ps) {
  face(out, 'membrane', ps, white, [0, 1, 0]);
  face(
    out,
    'membrane',
    ps.map((p) => [p[0], p[1] - 0.035, p[2]]),
    white,
    [0, -1, 0],
  );
}
function roof(out) {
  for (let bay = 0; bay < 40; bay++) {
    const a = (bay * TAU) / 40,
      b = ((bay + 1) * TAU) / 40,
      R = outer(a),
      S = outer(b),
      foot = radial(a, R - 5, 0),
      head = radial(a, R, upperY(a)),
      low = radial(a, R, rimY(a) - 0.4),
      old = radial(a, inner(a) + 14, oldY(a)),
      near = radial(a, inner(a), newY(a));
    // White inclined steel columns and the two continuous compression-ring chords.
    beam(out, 'metal', foot, head, 0.65, 0.9, white);
    beam(out, 'metal', head, radial(b, S, upperY(b)), 0.6, 1.1, white);
    beam(out, 'metal', low, radial(b, S, rimY(b) - 0.4), 0.7, 0.65, white);
    const o = transformed(out, a, foot);
    box(o, 'concrete', [-1.05, 0, -1], [1.05, 0.6, 1], concrete);
    for (const y of [rimY(a) - 0.4, upperY(a) - 0.7]) {
      const p = radial(a, R, y),
        q = radial(a, R, y + 0.5);
      tube(out, 'metal', p, q, 0.45, white, 16);
    }
    const top = (t) => {
      const p = mix(old, head, t);
      p[1] -= 3.2 * Math.sin(Math.PI * t);
      return p;
    };
    const bottom = (t) => mix(old, low, t);
    path(
      out,
      Array.from({ length: 33 }, (_, i) => top(i / 32)),
      0.045,
      steel,
      'metal',
      10,
    );
    path(
      out,
      Array.from({ length: 33 }, (_, i) => bottom(i / 32)),
      0.047,
      steel,
      'metal',
      10,
    );
    for (let j = 1; j < 8; j++) tube(out, 'metal', top(j / 8), bottom(j / 8), 0.025, steel, 8);
    // The2011 floating strut at the original inner ring supports the added canopy.
    const floating = [old[0], old[1] + 4.7, old[2]];
    tube(out, 'metal', old, floating, 0.105, white, 12);
    tube(out, 'metal', floating, near, 0.034, steel, 10);
    tube(out, 'metal', floating, head, 0.032, steel, 10);
    tube(out, 'metal', old, near, 0.037, steel, 10);
    for (let j = 0; j < 28; j++)
      for (let i = 0; i < 20; i++) {
        const t = j < 7 ? (j / 7) * 0.22 : 0.22 + ((j - 7) / 21) * 0.78,
          t1 = j < 7 ? ((j + 1) / 7) * 0.22 : 0.22 + ((j - 6) / 21) * 0.78;
        doubleRoof(out, [
          roofPoint(bay, i / 20, t),
          roofPoint(bay, (i + 1) / 20, t),
          roofPoint(bay, (i + 1) / 20, t1),
          roofPoint(bay, i / 20, t1),
        ]);
      }
    for (const t of [0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 1])
      path(
        out,
        Array.from({ length: 25 }, (_, i) => {
          const p = roofPoint(bay, i / 24, t);
          p[1] -= 0.12;
          return p;
        }),
        0.07,
        steel,
        'metal',
        10,
      );
    for (const u of [0.25, 0.5, 0.75])
      path(
        out,
        Array.from({ length: 29 }, (_, i) => {
          const p = roofPoint(bay, u, i / 28);
          p[1] += 0.02;
          return p;
        }),
        0.009,
        [0.72, 0.75, 0.73],
        'metal',
        5,
      );
  }
  // The older inner tension ring doubles as a continuous equipment catwalk.
  for (let i = 0; i < 480; i++) {
    const a = (i * TAU) / 480,
      b = ((i + 1) * TAU) / 480,
      p = radial(a, inner(a) + 13.2, oldY(a) - 1.35),
      q = radial(b, inner(b) + 13.2, oldY(b) - 1.35),
      r = radial(b, inner(b) + 14.5, oldY(b) - 1.35),
      s = radial(a, inner(a) + 14.5, oldY(a) - 1.35);
    face(out, 'metal', [p, q, r, s], steel, [0, 1, 0]);
    face(out, 'metal', [p, q, r, s], steel, [0, -1, 0]);
    for (const offset of [13.2, 14.5]) {
      const ps = [
        radial(a, inner(a) + offset, oldY(a) - 1.35),
        radial(b, inner(b) + offset, oldY(b) - 1.35),
      ];
      beam(out, 'metal', ps[0], ps[1], 0.1, 0.22, steel);
    }
  }
  for (const offset of [13.2, 14.5])
    rail(
      out,
      Array.from({ length: 481 }, (_, i) => {
        const a = (i * TAU) / 480;
        return radial(a, inner(a) + offset, oldY(a) - 1.35);
      }),
    );
  for (let i = 0; i < 420; i++) {
    const a = (i * TAU) / 420,
      o = transformed(out, a, radial(a, inner(a) + 13.1, oldY(a) - 0.9));
    box(o, 'metal', [-0.33, 0, -0.25], [0.33, 0.46, 0.2], dark);
    box(o, 'plastic', [-0.27, 0.06, -0.265], [0.27, 0.4, -0.26], white);
  }
  // Two sign frames above the long-side membrane and four retained roof light gantries.
  for (const sign of [-1, 1]) {
    const a = (sign * Math.PI) / 2,
      R = outer(a),
      o = transformed(out, a, radial(a, R, 0));
    for (const y of [rimY(a) + 0.8, rimY(a) + 4.5])
      beam(o, 'metal', [-24, y, 0], [24, y, 0], 0.12, 0.12, white);
    lettering(o, 'MHP ARENA', {
      width: 42,
      height: 3.3,
      y: rimY(a) + 1,
      z: 0.2,
      slot: 'metal',
      color: [0.025, 0.04, 0.055],
      stroke: 0.4,
    });
  }
  for (const a of [-Math.PI / 3, Math.PI / 3, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const p = radial(a, inner(a) + 10, oldY(a) + 1.2),
      o = transformed(out, a, p);
    for (const x of [-7, 7]) beam(o, 'metal', [x, 0, 0], [x, 6, 0], 0.22, 0.22, white);
    beam(o, 'metal', [-7, 5.5, 0], [7, 5.5, 0], 0.22, 0.22, white);
    for (let j = 0; j < 9; j++)
      box(o, 'metal', [-6.2 + j * 1.45, 5.65, -0.18], [-5.3 + j * 1.45, 6.35, 0.18], steel);
  }
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
  return radial(a, t, y);
}
function seat(a, tier, row) {
  const front = Math.hypot(...rounded(a, 43, 63, 7).filter((_, i) => i !== 1)),
    R = ground(a) - 12,
    west = Math.pow(Math.max(0, Math.sin(a)), 6);
  if (tier === 0) return radial(a, front + ((R - front) * 0.48 * row) / 29, -0.55 + row * 0.43);
  const f = row / 29;
  return radial(
    a,
    front + (R - front) * (0.55 + 0.45 * f),
    14.4 + west * 5 + f * (15.4 - west * 1.1),
  );
}
function seatLetterAt(text, u, v, stroke) {
  const c = text[Math.floor(u)],
    x = (u - Math.floor(u)) / 0.75;
  if (c !== 'U' && c !== 'G') return letterAt(text, u, v, stroke);
  if (x > 1 || v < 0 || v > 1) return false;
  const line =
    c === 'U'
      ? [
          [0, 1],
          [0, 0.2],
          [0.2, 0],
          [0.8, 0],
          [1, 0.2],
          [1, 1],
        ]
      : [
          [1, 0.8],
          [0.8, 1],
          [0.2, 1],
          [0, 0.8],
          [0, 0.2],
          [0.2, 0],
          [0.8, 0],
          [1, 0.2],
          [1, 0.5],
          [0.5, 0.5],
        ];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(x - a[0] - t * dx, v - a[1] - t * dy) < stroke) return true;
  }
  return false;
}
function seatColor(p, tier, row) {
  if (
    tier === 1 &&
    p[0] < -64 &&
    seatLetterAt('STUTTGART', (42 - p[2]) / 10, (row - 10) / 10, 0.115)
  )
    return white;
  if (tier === 1 && p[0] > 65 && Math.abs(p[2]) < 21 && row < 5) return white;
  return red;
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, -1.3, 0]));
  for (let t = 0; t < 2; t++)
    for (let row = 0; row < 29; row++) {
      const n = 360;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n,
          b = ((i + 1) * TAU) / n,
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
      }
      let carry = 0;
      for (let i = 1; i <= n; i++) {
        const p = seat(((i - 1) * TAU) / n, t, row + 0.34),
          q = seat((i * TAU) / n, t, row + 0.34),
          L = Math.hypot(q[0] - p[0], q[2] - p[2]);
        for (let d = 0.515 - carry; d < L; d += 0.515) {
          const v = mix(p, q, d / L),
            a = Math.atan2(v[0], v[2]),
            f = ((((a / TAU) * 36) % 1) + 1) % 1;
          if (f < 0.055 || f > 0.945) continue;
          if (t === 0 && v[2] > 70 && Math.abs(v[0]) < 43) continue;
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, seatColor(v, t, row));
        }
        carry = (carry + L) % 0.515;
      }
    }
  for (let t = 0; t < 2; t++)
    for (let k = 0; k < 36; k++) {
      const a = (k * TAU) / 36;
      rail(
        out,
        Array.from({ length: 30 }, (_, j) => seat(a, t, j)),
      );
      const o = transformed(out, a, seat(a, t, 13));
      box(o, 'concrete', [-1.18, 0, -0.1], [1.18, 2.5, 2.6], white);
      box(o, 'glass', [-1, 0.07, -0.12], [1, 2.26, -0.11], dark);
    }
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = seat(a, 1, 0),
      q = seat(b, 1, 0),
      n = [-Math.sin(a), 0, -Math.cos(a)];
    face(out, 'glass', [[p[0], p[1] - 2.35, p[2]], [q[0], q[1] - 2.35, q[2]], q, p], glass, n);
    face(
      out,
      'plastic',
      [
        [p[0] + n[0] * 0.035, p[1] - 0.55, p[2] + n[2] * 0.035],
        [q[0] + n[0] * 0.035, q[1] - 0.55, q[2] + n[2] * 0.035],
        [q[0] + n[0] * 0.035, q[1], q[2] + n[2] * 0.035],
        [p[0] + n[0] * 0.035, p[1], p[2] + n[2] * 0.035],
      ],
      red,
      n,
    );
    const z = rounded(a, 39, 58, 4, -1.28),
      z1 = rounded(b, 39, 58, 4, -1.28),
      s = seat(a, 0, 0),
      s1 = seat(b, 0, 0);
    face(
      out,
      'ground',
      [z, z1, [s1[0], -1.28, s1[2]], [s[0], -1.28, s[2]]],
      [0.42, 0.43, 0.42],
      [0, 1, 0],
    );
    face(out, 'concrete', [[s[0], -1.28, s[2]], [s1[0], -1.28, s1[2]], s1, s], concrete, n);
    const g = ground(a),
      h = ground(b),
      back = seat(a, 1, 29),
      back1 = seat(b, 1, 29);
    face(
      out,
      'concrete',
      [radial(a, g, 0), radial(b, h, 0), radial(b, h - 14, 0), radial(a, g - 14, 0)],
      concrete,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [back, back1, [back1[0], 0, back1[2]], [back[0], 0, back[2]]],
      [0.43, 0.46, 0.45],
      [Math.sin(a), 0, Math.cos(a)],
    );
  }
  // Main stand's two2024 hospitality terraces and glazed suites, with the central player tunnel.
  for (const y of [12.4, 15.9]) {
    box(out, 'concrete', [71, y - 0.3, -64], [82, y, 64], concrete);
    box(out, 'acrylic', [71.45, y + 0.2, -64], [71.48, y + 1.05, 64], [0.86, 0.94, 0.96]);
    for (let z = -62; z < 64; z += 4) {
      box(out, 'glass', [81.8, y, -0.1 + z], [81.83, y + 3.2, z + 3.8], glass);
      for (let j = 0; j < 6; j++) chair(out, Math.PI / 2, [72.2, y, z + j * 0.53], red);
    }
    rail(
      out,
      Array.from({ length: 65 }, (_, i) => [71.5, y, -64 + i * 2]),
    );
  }
  box(out, 'concrete', [40, -1.3, -3.3], [51, 2.6, 3.3], white);
  box(out, 'glass', [39.98, -1.25, -2.8], [39.99, 2.15, 2.8], dark);
  for (const sign of [-1, 1]) {
    const o = transformed(out, sign > 0 ? 0 : Math.PI, [0, 27, sign * 112]);
    box(o, 'metal', [-6.2, 0, -0.35], [6.2, 5.4, 0.2], white);
    box(o, 'glass', [-6, 0.15, -0.38], [6, 5.25, -0.36], dark);
    for (const x of [-5, 5]) tube(o, 'metal', [x, 5.4, 0], [x, 8.8, 0], 0.08, steel, 10);
  }
  for (let j = 4; j < 27; j += 4)
    for (let x = -36; x <= 36; x += 9) {
      const a = Math.atan2(x, 90),
        p = seat(a, 0, j);
      tube(out, 'metal', [p[0] - 2, p[1] + 1, p[2]], [p[0] + 2, p[1] + 1, p[2]], 0.03, steel, 8);
      for (const s of [-2, 2])
        tube(out, 'metal', [p[0] + s, p[1], p[2]], [p[0] + s, p[1] + 1, p[2]], 0.03, steel, 8);
    }
}
function facade(out) {
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      R = ground(a) - 8,
      S = ground(b) - 8,
      west = Math.sin(a) > 0.7,
      height = west ? 24 : 20;
    let floorY = 0;
    for (const y of [4.5, 9, 13.5, 18, height]) {
      if (y > height) continue;
      face(
        out,
        'concrete',
        [radial(a, R - 7, y), radial(b, S - 7, y), radial(b, S, y), radial(a, R, y)],
        concrete,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [radial(a, R, y - 0.35), radial(b, S, y - 0.35), radial(b, S, y), radial(a, R, y)],
        concrete,
        [Math.sin(a), 0, Math.cos(a)],
      );
      face(
        out,
        'glass',
        [
          radial(a, R - 1, floorY),
          radial(b, S - 1, floorY),
          radial(b, S - 1, y - 0.33),
          radial(a, R - 1, y - 0.33),
        ],
        glass,
        [Math.sin(a), 0, Math.cos(a)],
      );
      floorY = y;
    }
    if (i % 3 === 0)
      tube(out, 'metal', radial(a, R - 0.93, 0), radial(a, R - 0.93, height), 0.045, steel, 8);
  }
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72,
      R = ground(a) - 7,
      o = transformed(out, a, radial(a, R, 0));
    box(o, 'concrete', [-0.35, 0, -0.45], [0.35, 22, 0.45], concrete);
    const p = seat(a, 1, 0),
      q = seat(a, 1, 29);
    beam(
      out,
      'concrete',
      p.map((v, k) => v - (k === 1 ? 0.7 : 0)),
      q.map((v, k) => v - (k === 1 ? 0.7 : 0)),
      0.65,
      0.8,
      concrete,
    );
  }
  // Attached glazed stair enclosures differ from the cable-support columns.
  for (const sign of [-1, 1])
    for (const z of [-71, -39, 39, 71]) {
      const xs = [];
      for (let j = 1; j < mhpPlan.outer.length; j++) {
        const p = mhpPlan.outer[j - 1],
          q = mhpPlan.outer[j];
        if ((p[1] <= z && q[1] > z) || (q[1] <= z && p[1] > z))
          xs.push(p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]));
      }
      const x = (sign > 0 ? Math.max(...xs) : Math.min(...xs)) - sign * 5,
        o = transformed(out, (sign * Math.PI) / 2, [x, 0, z]);
      box(o, 'concrete', [-3.2, 0, -5], [3.2, 24, 0.1], concrete);
      box(o, 'glass', [-2.85, 0.5, 0.11], [2.85, 22.8, 0.13], glass);
      for (let j = 0; j < 12; j++)
        beam(
          o,
          'metal',
          [-2.9, 1.7 + j * 1.75, 0.2],
          [2.9, 1.7 + j * 1.75, 0.2],
          0.14,
          0.18,
          white,
        );
      beam(o, 'metal', [-3, 24, -5], [-3, 22.9, 0.2], 0.18, 0.18, white);
      beam(o, 'metal', [3, 24, -5], [3, 22.9, 0.2], 0.18, 0.18, white);
    }
  // The integrated SCHARRena is enclosed beneath the southeast/Untertürkheim curve.
  const o = transformed(out, Math.PI, [0, 0, -136]);
  box(o, 'concrete', [-46, 0, -22], [46, 8.2, 10.4], concrete);
  box(o, 'glass', [-43, 0.7, 10.42], [43, 6.8, 10.45], glass);
  lettering(o, 'SCHARRENA', {
    width: 36,
    height: 1.3,
    y: 6.8,
    z: 10.5,
    color: white,
    stroke: 0.12,
  });
}
export function buildMhp(out) {
  bowl(out);
  facade(out);
  roof(out);
}
export const mhpStudy = {
  id: 'N0697',
  key: 'mhparena',
  wikidataId: 'Q152349',
  title: 'MHPArena',
  build: buildMhp,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim', 'foundation', 'roof'],
  size: [230, 48, 290],
  previewGroundless: true,
  portableReviewBasis:
    'Portable asset views omit the fixture ground; geographic shared views cut actual terrain using the declared stadium outline so the lowered pitch remains visible.',
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center,+Z northwest toward Cannstatter Kurve,+X southwest toward the main stand;Y0 surrounding ground, pitchY-1.3.',
  },
  previewCamera: { position: [190, 147, 210], lookAt: [0, 22, 0] },
  visualBrief:
    'Stuttgart arena with inclined white supports and a tall asymmetric outer compression ring,40 double-curved membrane bays, distinct2011 inner roof extension and floating struts. Red two-tier bowl,2024 southwest main stand hospitality terraces, northwestern standing end, opposite white STUTTGART seat lettering, original catwalk,420 floodlights, diagonal stair glazing and integrated southeast SCHARRena form the specific exterior.',
  sourceFacts: {
    published:
      'Operator lists273x224m outer roof ring,47.1m main-stand and38.5m opposite-stand heights,41,750m² PVC-coated polyester roof,105x68m pitch,420 floodlights, two12x5.1m screens and60,058 capacity. Operator2011 history gives1.3m pitch lowering; structural engineer rounds1.5m. Engineer describes40 membrane fields, the original cable wheel,2011 floating-strut inner extension and2024 main-stand reconstruction of about60x160m.',
    reconstructed:
      'Directed mapped pitch and individually named stand footprints locate the exterior. OSM ground/stadium outline is290x224m, longer than the published273m roof; ground preserves map length while roof follows operator dimensions. Original field datum is treated as nominal outer contactY0, lowered fieldY-1.3. Cable sag/sections, roof camber, stair subdivisions, row inventories and local room glazing are photograph reconstructions.',
  },
  referencePages: [
    'https://www.mhparena-stuttgart.de/arena/daten-fakten',
    'https://www.mhparena-stuttgart.de/arena/baugeschichte/',
    'https://www.mhparena-stuttgart.de/aktuelles/neubau-der-haupttribuene-abgeschlossen/',
    'https://www.sbp.de/projekt/mhp-arena-umbau/',
    'https://www.sbp.de/projekt/mercedes-benz-arena-ehemals-gottlieb-daimler-stadion/',
    'https://www.sbp.de/news/neue-dachhaut-fuer-die-mercedes-benz-arena-in-stuttgart/',
    'https://www.mhparena-stuttgart.de/aktuelles/neues-dach-fuer-die-mercedes-benz-arena/',
    'https://www.openstreetmap.org/relation/9207449',
    'https://www.openstreetmap.org/way/34685362',
  ],
  referenceRights:
    'Original geometry and shared procedural material graphs. Primary photographs are research references, not embedded art. OSM-derived coordinates retain OpenStreetMap contributor attribution under ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: mhpPlan.anchor,
    heading: mhpPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is nominal outer stadium contact; the operator-documented2011 pitch lowering is represented atY-1.3. Surrounding local grades remain terrain-provider data.',
    groundCutout: {
      outline: mhpPlan.outer,
      basis:
        'Mapped stadium envelope in nativeXZ removes terrain from the lowered bowl; the authored outer ground/contact ring closes its edge.',
    },
    source: 'https://www.openstreetmap.org/way/34685362',
    featureIds: [
      'relation/9207449',
      'way/3869991',
      'way/34685363',
      'way/34685362',
      'way/1070585359',
      'way/1070585360',
      'way/1070601465',
      'way/1070601466',
      'way/1070601467',
      'way/1070601468',
    ],
    notes:
      'Pitch axis directs+Z toward northwest Cannstatter Kurve and+X toward southwest main stand. SCHARRena lies under the southeast end. Published roof dimensions govern its upper ring; mapped ground perimeter governs terrain cutout and lower envelope.',
  },
  limitations: [
    'Current completed exterior, with photograph-reconstructed section sizes, details, row distribution and local elevations. The operator mentions2026 LED renewal but still publishes12x5.1m screen dimensions; those published sizes are retained. No temporary event scenery, enclosed rooms or neighboring independent sports halls.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-upper-ring', position: [139, 49, 30], lookAt: [109, 43, 23] },
    { name: 'near-membrane-fields', position: [96, 58, 60], lookAt: [78, 36, 43] },
    { name: 'near-floating-strut', position: [67, 43, 30], lookAt: [58, 39, 30] },
    { name: 'near-inner-extension', position: [17, 23, 10], lookAt: [57, 36, 22] },
    { name: 'near-catwalk', position: [46, 29, 20], lookAt: [58, 35, 20] },
    { name: 'near-main-stand', position: [0, 6, 0], lookAt: [73, 16, 0] },
    { name: 'near-stuttgart-seats', position: [0, 9, 0], lookAt: [-82, 23, 0] },
    { name: 'near-standing-curve', position: [0, 5, 18], lookAt: [0, 8, 90] },
    { name: 'near-facade-stairs', position: [132, 17, 52], lookAt: [103, 15, 39] },
    { name: 'near-scharrena', position: [0, 12, -170], lookAt: [0, 6, -137] },
    { name: 'near-screen', position: [0, 19, 30], lookAt: [0, 30, 112] },
    { name: 'far-roof-envelope', position: [-160, 173, 195], lookAt: [0, 21, 0] },
  ],
};
