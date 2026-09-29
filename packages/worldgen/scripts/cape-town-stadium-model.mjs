/** Cape Town's glass cable-wheel, silver veil, three-tier bowl and raised entry podium. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { capePlan } from './cape-town-plan.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, face } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.88, 0.91, 0.9],
  concrete = [0.64, 0.64, 0.6],
  silver = [0.69, 0.72, 0.71],
  dark = [0.032, 0.047, 0.052],
  glass = [0.13, 0.19, 0.2];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  rad = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
function triangle(out, slot, ps, color, expected) {
  let n = normalFor(...ps);
  if (n.reduce((v, k, i) => v + k * expected[i], 0) < 0) {
    ps = [...ps].reverse();
    n = normalFor(...ps);
  }
  out.addTriangle(
    slot,
    'palette:#ffffff',
    ps,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}
function ray(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let hit = 0;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) hit = Math.max(hit, t);
  }
  if (!hit) throw Error('Cape Town plan ray missed');
  return hit;
}
const outer = (a) => ray(capePlan.outer, a),
  inner = (a) => ray(capePlan.inner, a),
  crown = (a) => 44 - 6 * Math.cos(2 * a);
function path(out, ps, r = 0.025, col = white, slot = 'metal', sides = 8) {
  for (let i = 1; i < ps.length; i++) tube(out, slot, ps[i - 1], ps[i], r, col, sides);
}
function rail(out, ps) {
  for (const y of [0.52, 1.06])
    path(
      out,
      ps.map((p) => [p[0], p[1] + y, p[2]]),
    );
  for (let i = 0; i < ps.length; i += 3)
    tube(out, 'metal', ps[i], [ps[i][0], ps[i][1] + 1.06, ps[i][2]], 0.025, white, 8);
}
function roofPoint(a, t) {
  const R = outer(a),
    r = inner(a),
    y = 44 + (crown(a) - 44) * t - 2.4 * Math.sin(Math.PI * t);
  return rad(a, r + (R - r) * t, y);
}
function soffit(a, t) {
  const p = roofPoint(a, t);
  p[1] -= 1.3 + 5.5 * (1 - t);
  return p;
}
function panelT(a, j) {
  const span = outer(a) - inner(a);
  return j <= 6 ? ((j / 6) * 16) / span : (16 + ((j - 6) / 19) * (span - 19)) / span;
}
function roof(out) {
  // The measured 72 radial reinforced-concrete frames carry the compression ring.
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72,
      b = ((i + 1) * TAU) / 72,
      R = outer(a),
      p = rad(a, R - 20, 0),
      q = rad(a, R - 2.6, crown(a) - 0.8),
      o = transformed(out, a, p);
    beam(out, 'concrete', p, q, 0.8, 3, concrete);
    box(o, 'concrete', [-0.75, 0, -1.6], [0.75, 0.8, 1.6], concrete);
    beam(
      out,
      'metal',
      rad(a, R - 0.5, crown(a) - 0.75),
      rad(b, outer(b) - 0.5, crown(b) - 0.75),
      1.2,
      2.2,
      white,
    );
    const lip = roofPoint(a, panelT(a, 25)),
      nextLip = roofPoint(b, panelT(b, 25));
    beam(out, 'metal', lip, nextLip, 0.12, 0.18, white);
    beam(out, 'metal', lip, rad(a, R - 0.6, crown(a) + 0.2), 0.13, 0.15, white);
    beam(out, 'metal', lip, rad(b, outer(b) - 0.6, crown(b) + 0.2), 0.11, 0.12, white);
    // The glass girders ride above the radial cable. Their inner 16 m is an exposed cantilever.
    const segments = 24;
    for (let j = 0; j < segments; j++) {
      const t = j / segments,
        u = (j + 1) / segments,
        A = roofPoint(a, t),
        B = roofPoint(a, u),
        C = soffit(a, t),
        D = soffit(a, u);
      beam(out, 'metal', A, B, 0.16, 0.24, white);
      tube(out, 'metal', C, D, 0.0425, silver, 10);
      if (j % 2 === 0) {
        beam(out, 'metal', C, A, 0.12, 0.13, white);
        beam(out, 'metal', C, B, 0.1, 0.12, white);
      } else beam(out, 'metal', D, A, 0.1, 0.12, white);
    }
    for (let k = 0; k < 5; k++)
      for (let j = 0; j < 25; j++) {
        const a0 = ((i + k / 5) * TAU) / 72,
          a1 = ((i + (k + 1) / 5) * TAU) / 72,
          t = panelT(a0, j),
          u = panelT(a0, j + 1),
          clear = j < 6;
        const ps = [
          roofPoint(a0, t),
          roofPoint(a1, panelT(a1, j)),
          roofPoint(a1, panelT(a1, j + 1)),
          roofPoint(a0, u),
        ];
        face(
          out,
          clear ? 'acrylic' : 'enamelGlass',
          ps,
          clear ? [0.9, 0.95, 0.94] : [0.87, 0.9, 0.86],
          [0, 1, 0],
        );
        // Glass joints and clamp nodes are geometry; no unique image maps are embedded.
        if (k === 0) beam(out, 'metal', ps[0], ps[3], 0.05, 0.045, silver);
        beam(out, 'metal', ps[0], ps[1], 0.044, 0.042, silver);
        if (j % 5 === 0 && k % 2 === 0)
          box(
            out,
            'metal',
            [ps[0][0] - 0.045, ps[0][1] + 0.018, ps[0][2] - 0.045],
            [ps[0][0] + 0.045, ps[0][1] + 0.07, ps[0][2] + 0.045],
            silver,
          );
        if (!clear) {
          const low = [
            soffit(a0, t),
            soffit(a1, panelT(a1, j)),
            soffit(a1, panelT(a1, j + 1)),
            soffit(a0, u),
          ];
          face(out, 'membrane', low, white, [0, -1, 0]);
        }
      }
    // Horizontal stabilizing ring trusses remain legible behind the transparent inner glass.
    const rr = inner(a) + 16,
      ss = inner(b) + 16,
      A = rad(a, rr, 39.7),
      B = rad(b, ss, 39.7),
      C = rad(a, rr, 35.8),
      D = rad(b, ss, 35.8);
    beam(out, 'metal', A, B, 0.18, 0.2, white);
    beam(out, 'metal', C, D, 0.18, 0.2, white);
    beam(out, 'metal', A, D, 0.13, 0.13, white);
    const inward = [-Math.sin(a), 0, -Math.cos(a)];
    face(out, 'membrane', [rad(a, rr, 34.2), rad(b, ss, 34.2), D, C], white, inward);
    const catA = rad(a, rr - 0.6, 34),
      catB = rad(b, ss - 0.6, 34),
      catC = rad(b, ss + 0.6, 34),
      catD = rad(a, rr + 0.6, 34);
    face(out, 'metal', [catA, catB, catC, catD], silver, [0, 1, 0]);
    face(out, 'metal', [catA, catB, catC, catD], silver, [0, -1, 0]);
    for (let k = 0; k < 5; k++) {
      const c = ((i + (k + 0.5) / 5) * TAU) / 72,
        rr = inner(c) + 15.75,
        v = transformed(out, c, rad(c, rr, 35.2));
      box(v, 'metal', [-0.48, -0.35, -0.2], [0.48, 0.35, 0.4], dark);
      tube(v, 'plastic', [0, 0, -0.225], [0, 0, -0.21], 0.27, white, 16);
    }
  }
  for (let k = 0; k < 8; k++)
    path(
      out,
      Array.from({ length: 361 }, (_, i) => {
        const a = (i * TAU) / 360;
        return rad(a, inner(a) + 16 + (k % 4) * 0.11, 34.5 + Math.floor(k / 4) * 0.13);
      }),
      0.049,
      silver,
      'metal',
      10,
    );
  for (let k = 0; k <= 25; k++)
    path(
      out,
      Array.from({ length: 361 }, (_, i) => roofPoint((i * TAU) / 360, panelT((i * TAU) / 360, k))),
      0.024,
      silver,
    );
}
function veilPoint(a, t) {
  const r = outer(a) - 13 + 13 * t - 0.22 * Math.sin(Math.PI * t * 12);
  return rad(a, r, 12 + (crown(a) - 12) * t);
}
function envelope(out) {
  // The silver-coated open fabric is optically translucent, with twelve horizontal support bands.
  for (let i = 0; i < 360; i++)
    for (let j = 0; j < 36; j++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        t = j / 36,
        u = (j + 1) / 36,
        ps = [veilPoint(a, t), veilPoint(b, t), veilPoint(b, u), veilPoint(a, u)];
      face(out, 'veil', ps, [0.8, 0.82, 0.79], [Math.sin(a), 0, Math.cos(a)]);
    }
  for (let j = 0; j <= 12; j++)
    path(
      out,
      Array.from({ length: 721 }, (_, i) => {
        const p = veilPoint((i * TAU) / 720, j / 12);
        p[0] += Math.sin((i * TAU) / 720) * 0.15;
        p[2] += Math.cos((i * TAU) / 720) * 0.15;
        return p;
      }),
      0.105,
      white,
      'metal',
      10,
    );
  for (let i = 0; i < 72; i++) {
    const a = (i * TAU) / 72,
      ps = Array.from({ length: 37 }, (_, j) => veilPoint(a, j / 36));
    path(out, ps, 0.035, silver);
    for (let j = 0; j < 12; j++) {
      const p = veilPoint(a, j / 12),
        q = rad(a, outer(a) - 16, p[1]);
      beam(out, 'metal', q, p, 0.08, 0.12, white);
    }
    const R = outer(a) - 14,
      o = transformed(out, a, rad(a, R, 8.5));
    box(o, 'glass', [-3.4, 0, -0.4], [3.4, 3.45, -0.37], glass);
    for (const x of [-3.5, 0, 3.5])
      box(o, 'metal', [x - 0.055, 0, -0.33], [x + 0.055, 3.5, -0.3], white);
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
  return rad(a, t, y);
}
function seat(a, t, row) {
  const r = Math.hypot(...rounded(a, 42, 68, 9).filter((_, i) => i !== 1)),
    R = outer(a) - 12;
  if (t === 0) return rad(a, r + row * 0.79, 0.7 + row * 0.37);
  if (t === 1) return rad(a, r + 25 + row * 0.81, 15.2 + row * 0.48);
  const f = row / 20;
  return rad(a, r + 46 + (R - r - 46) * f, 29.1 + f * (4.1 + 7.4 * Math.sin(a) ** 2));
}
function rugbyPitch(out) {
  for (let i = 0; i < 24; i++)
    box(
      out,
      'turf',
      [-38, 0, -62 + (i * 124) / 24],
      [38, 0.025, -62 + ((i + 1) * 124) / 24],
      i % 2 ? [0.29, 0.4, 0.13] : [0.34, 0.44, 0.16],
    );
  for (const z of [-58, -50, -28, 0, 28, 50, 58])
    box(out, 'plastic', [-34, 0.027, z - 0.06], [34, 0.03, z + 0.06], white);
  for (const x of [-34, 34])
    box(out, 'plastic', [x - 0.06, 0.027, -58], [x + 0.06, 0.03, 58], white);
  for (const z of [-40, 40])
    for (let x = -33; x < 34; x += 7)
      box(out, 'plastic', [x, 0.027, z - 0.06], [Math.min(x + 5, 34), 0.03, z + 0.06], white);
  for (const x of [-29, 29])
    for (let z = -49; z < 50; z += 10)
      box(out, 'plastic', [x - 0.06, 0.027, z], [x + 0.06, 0.03, Math.min(z + 5, 50)], white);
  for (const sign of [-1, 1]) {
    for (const x of [-2.8, 2.8]) {
      tube(out, 'metal', [x, 0, sign * 50], [x, 14, sign * 50], 0.06, white, 12);
      box(
        out,
        'plastic',
        [x - 0.18, 0, sign * 50 - 0.18],
        [x + 0.18, 1.7, sign * 50 + 0.18],
        [0.13, 0.17, 0.2],
      );
    }
    tube(out, 'metal', [-2.8, 3, sign * 50], [2.8, 3, sign * 50], 0.055, white, 10);
  }
}
function bowl(out) {
  rugbyPitch(out);
  const rows = [30, 25, 20],
    cols = [
      [0.59, 0.62, 0.59],
      [0.75, 0.76, 0.71],
      [0.44, 0.48, 0.47],
      [0.82, 0.82, 0.76],
    ];
  for (let t = 0; t < 3; t++)
    for (let row = 0; row < rows[t]; row++) {
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360,
          p = seat(a, t, row),
          q = seat(b, t, row),
          r = seat(b, t, row + 1),
          s = seat(a, t, row + 1);
        if (t === 2 && Math.abs(p[2]) < 58 && Math.abs(p[0]) > 83 && row > 4) continue;
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
        const L = Math.hypot(q[0] - p[0], q[2] - p[2]),
          n = Math.max(1, Math.floor(L / 0.51));
        for (let j = 0; j < n; j++) {
          const v = mix(p, q, (j + 0.5) / n),
            angle = Math.atan2(v[0], v[2]),
            f = ((((angle / TAU) * 36) % 1) + 1) % 1;
          if (f < 0.047 || f > 0.953) continue;
          const col = cols[(i * 17 + row * 7 + j * 3) % cols.length];
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, col);
        }
      }
    }
  for (let t = 0; t < 3; t++) {
    for (let k = 0; k < 36; k++) {
      const a = (k * TAU) / 36;
      if (t === 2 && Math.abs(Math.cos(a)) < 0.58) continue;
      rail(
        out,
        Array.from({ length: rows[t] + 1 }, (_, j) => seat(a, t, j)),
      );
      const p = seat(a, t, Math.floor(rows[t] * 0.47)),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.15, 0, -0.1], [1.15, 2.6, 3], white);
      box(o, 'glass', [-0.95, 0.1, -0.13], [0.95, 2.34, -0.12], dark);
    }
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        n = [-Math.sin(a), 0, -Math.cos(a)];
      face(
        out,
        t === 0 ? 'concrete' : 'glass',
        [[p[0], Math.max(0, p[1] - 2.8), p[2]], [q[0], Math.max(0, q[1] - 2.8), q[2]], q, p],
        t === 0 ? concrete : glass,
        n,
      );
      if (t > 0) {
        beam(out, 'concrete', p, q, 0.5, 0.5, white);
      }
    }
  }
  // Suites added after2010 replace temporary upper seats on the east/west long sides.
  for (const sign of [-1, 1])
    for (const y of [31, 34.6, 38.2]) {
      const o = transformed(out, (sign * Math.PI) / 2, [sign * 96, 0, 0]);
      box(o, 'concrete', [-58, y - 0.3, -8], [58, y, 7], concrete);
      box(o, 'glass', [-58, y, -1], [58, y + 3.2, -0.97], glass);
      for (let x = -56; x < 58; x += 4) {
        box(o, 'metal', [x - 0.045, y, -0.93], [x + 0.045, y + 3.2, -0.9], white);
        for (let k = 0; k < 6; k++) chair(o, Math.PI, [x + k * 0.52, y, -3], cols[1]);
      }
      rail(
        o,
        Array.from({ length: 59 }, (_, i) => [-58 + i * 2, y, -4.3]),
      );
    }
  // Two permanent scoreboards at the ends, with frame and maintenance brackets.
  for (const sign of [-1, 1]) {
    const o = transformed(out, sign > 0 ? 0 : Math.PI, [0, 30.5, sign * 115]);
    box(o, 'metal', [-9.2, 0, -0.45], [9.2, 6.1, 0.25], white);
    box(o, 'glass', [-9, 0.2, -0.48], [9, 5.9, -0.47], dark);
    for (const x of [-7, 7]) beam(o, 'metal', [x, 6.1, 0], [x, 8, 0], 0.15, 0.15, white);
  }
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = rounded(a, 38, 62, 3, 0.026),
      q = rounded(b, 38, 62, 3, 0.026),
      r = seat(b, 0, 0),
      s = seat(a, 0, 0);
    face(
      out,
      'ground',
      [p, q, [r[0], 0.026, r[2]], [s[0], 0.026, s[2]]],
      [0.48, 0.49, 0.46],
      [0, 1, 0],
    );
  }
}
function podium(out) {
  for (let i = 0; i < 720; i++) {
    const a = (i * TAU) / 720,
      b = ((i + 1) * TAU) / 720,
      R = ray(capePlan.podium, a),
      S = ray(capePlan.podium, b),
      r = outer(a) - 19,
      s = outer(b) - 19;
    const p = rad(a, R, 8.5),
      q = rad(b, S, 8.5);
    face(out, 'concrete', [rad(a, r, 8.5), rad(b, s, 8.5), q, p], concrete, [0, 1, 0]);
    face(out, 'concrete', [[p[0], 0, p[2]], [q[0], 0, q[2]], q, p], concrete, [
      Math.sin(a),
      0,
      Math.cos(a),
    ]);
    if (i % 8 === 0) {
      const o = transformed(out, a, rad(a, R + 0.02, 0));
      box(o, 'glass', [-1.3, 0.7, 0], [1.3, 3.4, 0.02], dark);
    }
  }
  for (const st of capePlan.steps) {
    const p = [st.top[0], 8.5, st.top[1]],
      q = [st.bottom[0], 0, st.bottom[1]],
      dx = q[0] - p[0],
      dz = q[2] - p[2],
      L = Math.hypot(dx, dz),
      ux = dz / L,
      uz = -dx / L;
    const near = capePlan.steps
        .filter((s) => s !== st)
        .map((s) => Math.hypot(s.top[0] - st.top[0], s.top[1] - st.top[1]))
        .sort((a, b) => a - b)[0],
      W = Math.min(13, Math.max(4, near)) * 0.48;
    const point = (t, side, y) => [p[0] + dx * t + ux * side, y, p[2] + dz * t + uz * side];
    for (let j = 0; j < 50; j++) {
      const t = j / 50,
        u = (j + 1) / 50,
        y = 8.5 * (1 - t),
        v = 8.5 * (1 - u),
        ps = [point(t, -W, y), point(t, W, y), point(u, W, y), point(u, -W, y)];
      face(out, 'concrete', ps, concrete, [0, 1, 0]);
      face(out, 'concrete', [ps[3], ps[2], point(u, W, v), point(u, -W, v)], concrete, [dx, 0, dz]);
    }
    for (const side of [-W, 0, W])
      rail(
        out,
        Array.from({ length: 26 }, (_, j) => point(j / 25, side, 8.5 * (1 - j / 25))),
      );
    for (const side of [-W, W])
      triangle(
        out,
        'concrete',
        [point(0, side, 8.5), point(1, side, 0), point(0, side, 0)],
        concrete,
        [ux * side, 0, uz * side],
      );
  }
  // Seven levels of concourses, visible through the silver fabric, with cantilevered escape stairs.
  for (const y of [4, 8.5, 12, 17, 21, 25, 29])
    for (let i = 0; i < 144; i++) {
      const a = (i * TAU) / 144,
        b = ((i + 1) * TAU) / 144,
        R = outer(a) - 16,
        S = outer(b) - 16;
      face(
        out,
        'concrete',
        [rad(a, R - 8, y), rad(b, S - 8, y), rad(b, S, y), rad(a, R, y)],
        concrete,
        [0, 1, 0],
      );
      beam(out, 'concrete', rad(a, R, y - 0.2), rad(b, S, y - 0.2), 0.3, 0.4, concrete);
    }
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) * TAU) / 24,
      R = outer(a) - 17,
      o = transformed(out, a, rad(a, R, 8.5));
    for (let j = 0; j < 5; j++) {
      const y = j * 3.8,
        sg = j % 2 ? 1 : -1;
      box(o, 'concrete', [-3.8, y, -4], [3.8, y + 0.25, 0], concrete);
      for (let k = 0; k < 22; k++) {
        const z = -4 + (k * 4) / 22,
          v = y + 0.25 + (k * 3.55) / 22;
        box(
          o,
          'concrete',
          [sg > 0 ? 0.2 : -3.4, v, z],
          [sg > 0 ? 3.4 : -0.2, v + 0.18, z + 0.22],
          concrete,
        );
      }
      rail(
        o,
        Array.from({ length: 12 }, (_, k) => [
          sg * 3.5,
          y + 0.25 + (k * 3.55) / 11,
          -4 + (k * 4) / 11,
        ]),
      );
    }
  }
}
export function buildCapeTown(out) {
  bowl(out);
  podium(out);
  roof(out);
  envelope(out);
}
export const capeTownStudy = {
  id: 'N0698',
  key: 'cape_town_stadium',
  wikidataId: 'Q173559',
  title: 'Cape Town Stadium',
  build: buildCapeTown,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim', 'foundation', 'roof'],
  size: [450, 50, 435],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center; +Z north-northwest, +X west-southwest. Field and outer street contactY0; raised podiumY8.5 reconstructed from sections.',
  },
  previewCamera: { position: [245, 182, 230], lookAt: [0, 23, 0] },
  visualBrief:
    'Silver translucent abalone-shell envelope, twelve horizontal facade profiles, 72 inclined concrete pylons and an undulating glass cable-wheel roof. Clear16m inner cantilever,9,000 glass panel cells, ring-of-fire lights, a pearly three-tier bowl with post2010 upper hospitality boxes, and three mapped grand-stair banks on the elevated street-grid podium give Cape Town its specific appearance.',
  sourceFacts: {
    published:
      'gmp and the operator describe290x265m dimensions,50m maximum height, a16m clear inner glass strip,9000 laminated16mm panels and a three-tier bowl. The operator lists360 floodlights,100x68m rugby field with8m in-goals, and hospitality suites added in2020/21. Structural engineering evidence records72 radial concrete frames and3x0.8m pylons. Architect sections resolve higher long sides and lower ends.',
    reconstructed:
      'Mapped roof/pitch and21 stair centerlines fix site placement. The mapped roof is283x261m versus rounded published290x265m, and its actual footprint is retained. Podium edge is interpolated from mapped stair tops and roof perimeter; its8.5m rise, detailed truss camber, balcony subdivisions and individual seating distribution are section/photo reconstructions. The translucent fabric uses local PBR alpha while opaque architectural surfaces reuse canonical graphs.',
  },
  referencePages: [
    'https://www.gmp.de/en/projects/501/cape-town-stadium',
    'https://www.sbp.de/en/project/cape-town-stadium/',
    'https://www.dhlstadium.co.za/venues/stadium-bowls',
    'https://thestormers.com/wp-content/uploads/2021/11/DHL-Stadium-Fast-Facts-03-Oct-2021-2.pdf',
    'https://constructalia.arcelormittal.com/en/case_study_gallery/south_africa/arcelormittal-steel-for-cape-town-stadium',
    'https://www.idc-online.com/technical_references/pdfs/civil_engineering/Cape_Town_Stadium_structural_challenges.pdf',
    'https://www.openstreetmap.org/relation/8706182',
    'https://www.openstreetmap.org/way/44948355',
  ],
  referenceRights:
    'Original authored geometry; primary photos and architect sections used as research, not embedded art. OSM-derived plan coordinates are attributed to OpenStreetMap contributors under ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: capePlan.anchor,
    heading: capePlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Street and pitchY0 define contact. Inclined concrete pylon sections extend0.64m below theirY0 centerline into the ground and capped foundations; this is intentional embedded support geometry, not an elevated field.',
    source: 'https://www.openstreetmap.org/way/44948355',
    featureIds: [
      'relation/8706182',
      'way/626140250',
      'way/626138763',
      'way/44948355',
      ...capePlan.steps.map((s) => `way/${s.id}`),
    ],
    notes:
      'Exact mapped pitch directs+Z north-northwest and+X west-southwest. Three asymmetric mapped stair groups resolve180-degree ambiguity. Terrain contact is the outside street/field datum; the podium is elevated, consistent with architect sections.',
  },
  limitations: [
    'Current permanent exterior in shared Molen style, including post2010 upper hospitality volumes. Suite subdivisions, seat inventory, local podium height, roof camber and hidden members are reconstructions. Transparent glass and fabric retain local PBR to preserve alpha; no claim of full optical transmission simulation. Temporary sponsor wraps, event scenery, neighboring independent sports buildings and enclosed rooms are omitted.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-silver-veil', position: [154, 25, 18], lookAt: [129, 29, 17] },
    { name: 'near-glass-panels', position: [83, 56, 27], lookAt: [71, 44, 20] },
    { name: 'near-inner-cantilever', position: [7, 30, 6], lookAt: [59, 41, 22] },
    { name: 'near-ring-of-fire', position: [41, 33, 13], lookAt: [60, 36, 15] },
    { name: 'near-upper-hospitality', position: [0, 18, 0], lookAt: [99, 34, 0] },
    { name: 'near-pearly-bowl', position: [0, 7, 0], lookAt: [-75, 18, 10] },
    { name: 'near-rugby-pitch', position: [17, 4, 30], lookAt: [0, 4, 50] },
    { name: 'near-grand-stairs', position: [19, 13, -230], lookAt: [13, 8, -180] },
    { name: 'near-west-podium', position: [224, 18, 0], lookAt: [157, 9, 0] },
    { name: 'near-scoreboard', position: [0, 21, 44], lookAt: [0, 33, 115] },
    { name: 'far-wave-profile', position: [0, 58, -310], lookAt: [0, 26, 0] },
    { name: 'far-roof-shell', position: [-182, 204, 184], lookAt: [0, 24, 0] },
  ],
};
