/** Executed Rostov Arena:46 stayed roof consoles, vaulted membrane and mapped elevated approaches. */
import earcut from 'earcut';
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { rostovPlan } from './rostov-plan.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.92, 0.935, 0.92],
  pale = [0.74, 0.76, 0.73],
  concrete = [0.53, 0.55, 0.53],
  steel = [0.61, 0.65, 0.65],
  dark = [0.03, 0.04, 0.055],
  blue = [0.025, 0.22, 0.48],
  yellow = [0.97, 0.73, 0.025];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)],
  clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function ray(poly, a) {
  const d = [Math.sin(a), Math.cos(a)],
    hits = [];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hits.push(t);
  }
  if (!hits.length) throw Error('Rostov envelope ray missed');
  return Math.max(...hits);
}
const outer = (a) => ray(rostovPlan.outer, a);
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
function continuous(out, ps, r, color = steel, sides = 8, slot = 'metal') {
  const rings = ps.map((p, i) => {
    const before = ps[Math.max(0, i - 1)],
      after = ps[Math.min(ps.length - 1, i + 1)],
      axis = normalize(after.map((v, k) => v - before[k])),
      u = normalize(cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) =>
      p.map(
        (x, k) => x + r * (u[k] * Math.cos((j * TAU) / sides) + v[k] * Math.sin((j * TAU) / sides)),
      ),
    );
  });
  loft(out, slot, rings, color);
}
function tri(out, slot, ps, col, n) {
  let p = ps,
    normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  out.addTriangle(
    slot,
    'palette:#ffffff',
    p,
    normal,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function rail(out, ps) {
  for (const y of [0.55, 1.1])
    continuous(
      out,
      ps.map((p) => [p[0], p[1] + y, p[2]]),
      0.025,
      steel,
      6,
    );
  for (let j = 0; j < ps.length; j += 3)
    beam(out, 'metal', ps[j], [ps[j][0], ps[j][1] + 1.1, ps[j][2]], 0.04, 0.04, steel);
}
// Equal arc stations along the rectangular opening yield the photographed fan of46 consoles at rounded corners.
const path = Array.from({ length: 1841 }, (_, i) => rounded((i * TAU) / 1840, 49, 70, 6)),
  dist = [0];
for (let i = 1; i < path.length; i++)
  dist.push(dist.at(-1) + Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]));
function angleAt(u) {
  const target = (((u % 1) + 1) % 1) * dist.at(-1);
  let i = 1;
  while (dist[i] < target) i++;
  const t = (target - dist[i - 1]) / (dist[i] - dist[i - 1]),
    p = mix(path[i - 1], path[i], t);
  return Math.atan2(p[0], p[2]);
}
function roofPoint(u, t, bulge = true) {
  const a = angleAt(u),
    p = rounded(a, 49, 70, 6),
    r = Math.hypot(p[0], p[2]) + (outer(a) - Math.hypot(p[0], p[2])) * t;
  return radial(
    a,
    r,
    34 +
      6 * t +
      1.65 * Math.sin(Math.PI * t) +
      (bulge
        ? 1.35 * Math.sin(Math.PI * ((u * 46) % 1)) * (0.75 + 0.25 * Math.sin(Math.PI * t))
        : 0),
  );
}
function roof(out) {
  const U = 46 * 14,
    T = 64;
  for (let i = 0; i < U; i++)
    for (let j = 0; j < T; j++) {
      const p = [
        roofPoint(i / U, j / T),
        roofPoint((i + 1) / U, j / T),
        roofPoint((i + 1) / U, (j + 1) / T),
        roofPoint(i / U, (j + 1) / T),
      ];
      face(out, 'membrane', p, white, [0, 1, 0]);
      face(
        out,
        'membrane',
        p.map((p) => [p[0], p[1] - 0.05, p[2]]),
        white,
        [0, -1, 0],
      );
    }
  for (let i = 0; i < 46; i++) {
    const u = i / 46,
      a = angleAt(u),
      mast = roofPoint(u, 0.91, false),
      tip = [mast[0], 51.48, mast[2]],
      base = radial(a, outer(a) - 5, 6),
      end = roofPoint(u, 0, false);
    tube(out, 'metal', base, tip, 0.25, white, 24);
    const pl = transformed(out, a, base);
    box(pl, 'concrete', [-1.1, -0.1, -1.1], [1.1, 0.8, 1.1], pale);
    for (const s of [-1, 1]) {
      const q = roofPoint(u + s * 0.012, 0.98, false);
      tube(out, 'metal', tip, [q[0], q[1] - 0.4, q[2]], 0.021, steel, 10);
    }
    for (const t of [0.11, 0.48]) {
      const q = roofPoint(u, t, false);
      tube(out, 'metal', tip, [q[0], q[1] - 0.5, q[2]], 0.021, steel, 10);
    }
    continuous(
      out,
      Array.from({ length: 25 }, (_, j) =>
        roofPoint(u, j / 24, false).map((v, k) => v - (k === 1 ? 0.45 : 0)),
      ),
      0.24,
      white,
      14,
    );
    for (let j = 0; j < 8; j++) {
      const p = roofPoint(u, j / 8, false),
        q = roofPoint(u, (j + 1) / 8, false);
      beam(out, 'metal', [p[0], p[1] - 0.85, p[2]], [q[0], q[1] - 0.85, q[2]], 0.38, 0.95, white);
      const o = transformed(out, a, [p[0], p[1] - 0.75, p[2]]);
      box(o, 'metal', [-0.46, -0.7, -0.45], [0.46, 0.1, 0.45], steel);
      for (const x of [-0.34, 0.34])
        for (const y of [-0.5, -0.18])
          tube(o, 'metal', [x, y, -0.48], [x, y, -0.54], 0.047, [0.36, 0.38, 0.38], 6);
    }
    // Transverse tube arches carry each tensioned fabric strip.
    for (let j = 0; j <= 8; j++)
      continuous(
        out,
        Array.from({ length: 15 }, (_, k) =>
          roofPoint((i + k / 14) / 46, j / 8).map((v, l) => v - (l === 1 ? 0.09 : 0)),
        ),
        0.065,
        white,
        8,
      );
    // Outer maintenance ladder lies along each radial seam, between the membrane vaults.
    const steps = 22;
    for (let k = 0; k < steps; k++) {
      const p = roofPoint(u, 0.55 + (0.42 * k) / steps, false),
        o = transformed(out, a, [p[0], p[1] + 0.08, p[2]]);
      box(o, 'metal', [-0.39, 0, -0.025], [0.39, 0.04, 0.025], steel);
    }
    for (const side of [-1, 1])
      continuous(
        out,
        Array.from({ length: 14 }, (_, k) => {
          const p = roofPoint(u, 0.55 + (0.42 * k) / 13, false);
          return [p[0] + side * 0.43 * Math.cos(a), p[1] + 0.12, p[2] - side * 0.43 * Math.sin(a)];
        }),
        0.035,
        steel,
        8,
      );
    // Circular lights are attached to the inside service catwalk, not floating beneath the membrane.
    const o = transformed(out, a, [end[0], 31.9, end[2]]);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) {
      tube(o, 'metal', [x, -0.1, 0.1], [x, -0.1, -0.28], 0.3, dark, 16);
      tube(o, 'plastic', [x, -0.1, -0.28], [x, -0.1, -0.3], 0.265, [0.92, 0.96, 0.94], 16);
    }
  }
  const ring = Array.from({ length: 369 }, (_, i) => roofPoint(i / 368, 0, false));
  for (let i = 0; i < 368; i++) {
    const a = ring[i],
      b = ring[i + 1],
      aa = normalize([a[0], 0, a[2]]),
      bb = normalize([b[0], 0, b[2]]);
    face(
      out,
      'metal',
      [
        [a[0] - 0.7 * aa[0], 31.4, a[2] - 0.7 * aa[2]],
        [b[0] - 0.7 * bb[0], 31.4, b[2] - 0.7 * bb[2]],
        [b[0] + 0.9 * bb[0], 31.4, b[2] + 0.9 * bb[2]],
        [a[0] + 0.9 * aa[0], 31.4, a[2] + 0.9 * aa[2]],
      ],
      steel,
      [0, 1, 0],
    );
  }
  for (let i = 0; i < 368; i++) {
    const a = ring[i],
      b = ring[i + 1],
      aa = normalize([a[0], 0, a[2]]),
      bb = normalize([b[0], 0, b[2]]);
    const p = [a[0] - 0.7 * aa[0], 31.4, a[2] - 0.7 * aa[2]],
      q = [b[0] - 0.7 * bb[0], 31.4, b[2] - 0.7 * bb[2]],
      r = [b[0] + 0.9 * bb[0], 31.4, b[2] + 0.9 * bb[2]],
      t = [a[0] + 0.9 * aa[0], 31.4, a[2] + 0.9 * aa[2]];
    const lower = (p) => [p[0], 31.05, p[2]];
    face(out, 'metal', [p, q, r, t].map(lower), steel, [0, -1, 0]);
    face(
      out,
      'metal',
      [lower(p), lower(q), q, p],
      steel,
      aa.map((v) => -v),
    );
    face(out, 'metal', [lower(t), lower(r), r, t], steel, aa);
    if (i % 8 === 0)
      for (const side of [-0.65, 0.85]) {
        const p = [a[0] + side * aa[0], 32.5, a[2] + side * aa[2]],
          q = roofPoint(i / 368, 0, false);
        tube(out, 'metal', p, [p[0], q[1] - 0.25, p[2]], 0.038, steel, 8);
      }
  }
  rail(
    out,
    ring.map((p) => [
      p[0] - 0.7 * normalize([p[0], 0, p[2]])[0],
      31.4,
      p[2] - 0.7 * normalize([p[0], 0, p[2]])[2],
    ]),
  );
  for (const t of [0, 1])
    continuous(
      out,
      Array.from({ length: 369 }, (_, i) => roofPoint(i / 368, t, false)),
      0.18,
      steel,
      12,
    );
}
function seatPoint(a, row) {
  const r0 = Math.hypot(...rounded(a, 44, 63, 11).filter((_, i) => i !== 1)),
    r1 = outer(a) - 16,
    t = row / 61,
    gap = row >= 28 ? 3 : 0,
    gap2 = row >= 34 ? 1.8 : 0;
  return radial(
    a,
    r0 + (r1 - r0 - 4.8) * t + gap + gap2,
    1.1 + 29 * t + (row >= 28 ? 1.8 : 0) + (row >= 34 ? 0.8 : 0),
  );
}
function screenGap(a, row) {
  return (
    row >= 40 &&
    [Math.PI / 4, Math.PI * 1.25].some(
      (t) => Math.abs(Math.atan2(Math.sin(a - t), Math.cos(a - t))) < 0.115,
    )
  );
}
function bowl(out) {
  const n = 460;
  for (let row = 0; row < 61; row++) {
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n;
      if (screenGap((a + b) / 2, row)) continue;
      const p = seatPoint(a, row),
        q = seatPoint(b, row),
        r = seatPoint(b, row + 1),
        s = seatPoint(a, row + 1);
      face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], pale, [0, 1, 0]);
      face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
    }
    const ps = Array.from({ length: n + 1 }, (_, i) => seatPoint((i * TAU) / n, row + 0.4));
    let carry = 0;
    for (let i = 1; i < ps.length; i++) {
      const p = ps[i - 1],
        q = ps[i],
        L = Math.hypot(q[0] - p[0], q[2] - p[2]);
      for (let d = 0.52 - carry; d < L; d += 0.52) {
        const v = mix(p, q, d / L),
          a = Math.atan2(v[0], v[2]),
          sector = ((((a / TAU) * 40) % 1) + 1) % 1;
        if (
          sector < 0.065 ||
          sector > 0.935 ||
          screenGap(a, row) ||
          (row >= 28 && row < 32) ||
          (row < 9 && Math.abs(Math.sin(2 * a)) > 0.985)
        )
          continue;
        const col =
          sector < 0.13 || sector > 0.87 || row === 27 || row === 33 || row > 57 ? yellow : blue;
        chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, col);
      }
      carry = (carry + L) % 0.52;
    }
  }
  for (let k = 0; k < 40; k++) {
    const a = (k * TAU) / 40;
    rail(
      out,
      Array.from({ length: 62 }, (_, j) => seatPoint(a, j)),
    );
    for (const row of [17, 43]) {
      if (screenGap(a, row)) continue;
      const o = transformed(out, a, seatPoint(a, row));
      box(o, 'concrete', [-1.35, 0, -0.13], [1.35, 2.55, 2], pale);
      box(o, 'glass', [-1.1, 0.1, -0.17], [1.1, 2.3, -0.14], dark);
      for (const x of [-1.4, 1.4])
        box(o, 'plastic', [x - 0.1, 0, -0.2], [x + 0.1, 2.6, -0.15], yellow);
    }
  }
  for (let i = 0; i < 368; i++) {
    const a = (i * TAU) / 368,
      b = ((i + 1) * TAU) / 368,
      p = seatPoint(a, 28),
      q = seatPoint(b, 28);
    face(
      out,
      'glass',
      [p, q, [q[0], q[1] + 2.5, q[2]], [p[0], p[1] + 2.5, p[2]]],
      [0.14, 0.2, 0.23],
      [-Math.sin(a), 0, -Math.cos(a)],
    );
    if (i % 2 === 0) beam(out, 'metal', p, [p[0], p[1] + 2.5, p[2]], 0.07, 0.1, white);
    const r = rounded(a, 39, 57.5, 3),
      s = rounded(b, 39, 57.5, 3),
      t = seatPoint(a, 0),
      v = seatPoint(b, 0);
    face(out, 'concrete', [[t[0], 0, t[2]], [v[0], 0, v[2]], s, r], pale, [0, 1, 0]);
  }
  for (const a of [Math.PI / 4, Math.PI * 1.25]) {
    const p = seatPoint(a, 47),
      o = transformed(out, a, [p[0], p[1] + 0.5, p[2]]);
    box(o, 'metal', [-7.7, 0, -0.55], [7.7, 9.4, 0.55], steel);
    box(o, 'glass', [-7.5, 0.2, -0.59], [7.5, 9.2, -0.56], dark);
    for (const x of [-6, 6]) tube(o, 'metal', [x, 9.4, 0], [x, 12, 0], 0.13, white, 10);
  }
  const field = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, ps, n, uv, color) =>
        out[name](
          slot,
          ref,
          slot === 'turf'
            ? ps.map((p) => [clamp(p[0], -39, 39), p[1], clamp(p[2], -57.5, 57.5)])
            : ps,
          n,
          uv,
          color,
        ),
    ]),
  );
  soccerPitch(field);
  rail(
    out,
    Array.from({ length: 369 }, (_, i) => seatPoint((i * TAU) / 368, 0)),
  );
}
function envelope(out) {
  const n = 460;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      R = outer(a) - 0.6,
      S = outer(b) - 0.6;
    face(
      out,
      'metal',
      [radial(a, R, 19.8), radial(b, S, 19.8), radial(b, S, 39.5), radial(a, R, 39.5)],
      white,
      [Math.sin(a), 0, Math.cos(a)],
    );
    if (i % 2 === 0)
      tube(
        out,
        'metal',
        radial(a, R + 0.02, 19.8),
        radial(a, R + 0.02, 39.5),
        0.018,
        [0.57, 0.6, 0.6],
        6,
      );
    for (const y of [6, 12, 18]) {
      const p = radial(a, R - 3, y),
        q = radial(b, S - 3, y);
      face(
        out,
        'glass',
        [p, q, [q[0], y + 5.3, q[2]], [p[0], y + 5.3, p[2]]],
        [0.14, 0.19, 0.22],
        [Math.sin(a), 0, Math.cos(a)],
      );
      face(
        out,
        'concrete',
        [radial(a, R - 8, y), radial(b, S - 8, y), radial(b, S + 1.7, y), radial(a, R + 1.7, y)],
        pale,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [
          radial(a, R - 3, y - 0.7),
          radial(b, S - 3, y - 0.7),
          radial(b, S - 3, y),
          radial(a, R - 3, y),
        ],
        pale,
        [Math.sin(a), 0, Math.cos(a)],
      );
      face(
        out,
        'concrete',
        [
          radial(a, R - 8, y - 0.7),
          radial(b, S - 8, y - 0.7),
          radial(b, S + 1.7, y - 0.7),
          radial(a, R + 1.7, y - 0.7),
        ],
        concrete,
        [0, -1, 0],
      );
      if (i % 5 === 0) {
        const o = transformed(out, a, radial(a, R - 2, y));
        box(o, 'concrete', [-0.35, 0, -0.35], [0.35, 6, 0.35], pale);
      }
    }
    face(
      out,
      'concrete',
      [radial(a, R - 1, 6), radial(b, S - 1, 6), radial(b, S + 6.5, 6), radial(a, R + 6.5, 6)],
      pale,
      [0, 1, 0],
    );
    face(
      out,
      'concrete',
      [
        radial(a, R + 6.5, 5.55),
        radial(b, S + 6.5, 5.55),
        radial(b, S + 6.5, 6),
        radial(a, R + 6.5, 6),
      ],
      concrete,
      [Math.sin(a), 0, Math.cos(a)],
    );
    face(
      out,
      'concrete',
      [
        radial(a, R - 4.15, 0),
        radial(b, S - 4.15, 0),
        radial(b, S - 4.15, 5.3),
        radial(a, R - 4.15, 5.3),
      ],
      pale,
      [Math.sin(a), 0, Math.cos(a)],
    );
    if (i % 8 === 0) {
      tube(out, 'concrete', radial(a, R + 3, 0), radial(a, R + 3, 5.6), 0.45, pale, 12);
      const o = transformed(out, a, radial(a, R - 4, 0));
      box(o, 'glass', [-1.2, 0, -0.1], [1.2, 2.8, 0.1], dark);
    }
  }
  // The small facade LED nodes are repeated physical front faces; daytime shell is white, with no baked event artwork.
  for (let i = 0; i < 844; i++) {
    const a = (i * TAU) / 844,
      R = outer(a) - 0.57,
      o = transformed(out, a, radial(a, R, 20));
    for (let j = 0; j < 64; j++) {
      const y = (j * 19) / 64;
      face(
        o,
        'metal',
        [
          [-0.038, y, 0],
          [0.038, y, 0],
          [0.038, y + 0.045, 0],
          [-0.038, y + 0.045, 0],
        ],
        [0.6, 0.65, 0.66],
        [0, 0, 1],
      );
    }
  }
  rail(
    out,
    Array.from({ length: 369 }, (_, i) => radial((i * TAU) / 368, outer((i * TAU) / 368) + 6, 6)),
  );
  // The operator locates the27x15m external media screen on the west facade (+X).
  const o = transformed(out, Math.PI / 2, [116.65, 21.2, 0]);
  box(o, 'metal', [-13.75, 0, -0.35], [13.75, 15.5, 0.35], steel);
  box(o, 'glass', [-13.5, 0.25, 0.36], [13.5, 15.25, 0.39], dark);
}
function approaches(out) {
  for (const ramp of rostovPlan.stands) {
    const poly = ramp.outline.slice(0, -1),
      height = (p) =>
        6 * (1 - clamp((Math.hypot(...p) - outer(Math.atan2(p[0], p[1]))) / 58, 0, 1)),
      ps = poly.map((p) => [p[0], height(p), p[1]]),
      ix = earcut(poly.flat());
    for (let i = 0; i < ix.length; i += 3) {
      const v = ix.slice(i, i + 3).map((k) => ps[k]);
      tri(out, 'concrete', v, pale, [0, 1, 0]);
      tri(
        out,
        'concrete',
        v.map((p) => [p[0], p[1] - 0.38, p[2]]),
        concrete,
        [0, -1, 0],
      );
    }
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i],
        q = ps[(i + 1) % ps.length];
      if (Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.05) continue;
      face(out, 'concrete', [[p[0], p[1] - 0.38, p[2]], [q[0], q[1] - 0.38, q[2]], q, p], pale);
      const L = Math.hypot(p[0] - q[0], p[2] - q[2]);
      if (L > 1)
        rail(
          out,
          Array.from({ length: Math.max(2, Math.ceil(L / 1.5)) }, (_, j) =>
            mix(p, q, j / (Math.max(2, Math.ceil(L / 1.5)) - 1)),
          ),
        );
      if (i % 3 === 0 && p[1] > 1)
        tube(out, 'concrete', [p[0], 0, p[2]], [p[0], p[1] - 0.4, p[2]], 0.4, pale, 12);
    }
  }
  for (const a of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const R = outer(a) + 6.5,
      o = transformed(out, a, radial(a, R, 0));
    for (let i = 0; i < 33; i++)
      box(
        o,
        'concrete',
        [-7, (i * 6) / 33, 20 - i * 0.6],
        [7, ((i + 1) * 6) / 33, 20 - (i - 1) * 0.6],
        pale,
      );
    for (const x of [-6.7, 0, 6.7])
      rail(
        o,
        Array.from({ length: 34 }, (_, i) => [x, (i * 6) / 33, 20 - i * 0.6]),
      );
  }
}
export function buildRostov(out) {
  bowl(out);
  roof(out);
  envelope(out);
  approaches(out);
}
export const rostovStudy = {
  id: 'N0694',
  key: 'rostov_arena',
  wikidataId: 'Q4439101',
  title: 'Rostov Arena',
  build: buildRostov,
  metricTriangleUv: true,
  smoothNormalSlots: ['roof', 'trim'],
  size: [370, 52, 315],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Exact mapped playing-field center. +Z follows its north-northwest axis, +X faces the west main entrance. Y0 is the playing-field and outer approach ground reference.',
  },
  previewCamera: { position: [257, 180, 245], lookAt: [0, 22, 0] },
  visualBrief:
    'The executed2018 Rostov Arena has a rounded rectangular white vessel,46 stayed roof consoles and a ridged membrane canopy. Three blue seating tiers have yellow aisle borders, corner access breaks, hospitality glazing and northwest/southeast screens. Physical facade LED points, west media screen, five-level concourse structure, elevated ring terrace and six separately mapped approach ramps establish its individual exterior.',
  sourceFacts: {
    published:
      'The resident club specifies a105x68m field,115x78m grass area, three spectator tiers, five floors, a40m main building,852x19m media facade with54000 LED points, a27x15m west screen and two15x9m northwest/southeast screens. The executed structural engineer describes46 stayed consoles and arched tube supports beneath the membrane. Macalloy identifies M42 roof tension rods.',
    reconstructed:
      'Exact OSM stadium body, ground opening, pitch and six elevated approaches establish plan and orientation. Roof opening,51.48m mast tips, membrane camber, console sections, seated row counts, podium heights and local ramp grades are reconstructed from primary completed photographs; the club40m height sets the shell scale. Facade diode count is represented by54016 repeated nodes; tiny panel perforations are below the authored geometry scale.',
  },
  referencePages: [
    'https://fc-rostov.ru/more/rostov-arena',
    'https://steel-project.ru/project/stadion-rostov-arena',
    'https://macalloy.com/project/fifa-world-cup-arenas-in-russia-2018/',
    'https://www.crocusgroup.ru/projects/civil-construction/stadiony-k-chempionatu-mira-po-futbolu-2018-goda-v-kaliningrade-i-rostove-na-donu/',
    'https://www.openstreetmap.org/relation/5379619',
    'https://www.openstreetmap.org/way/361352677',
  ],
  referenceRights:
    'Original component-authored geometry and shared procedural materials. Primary reference photographs are research evidence only and no image pixels or external meshes are embedded. OSM plan coordinates are OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: rostovPlan.anchor,
    heading: rostovPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the playing-field and outer ground plane; elevated spectator terrace and approach ramps rise to6m. Shallow support footings and ramp undersides can extend below this reference plane.',
    source: 'https://www.openstreetmap.org/way/361352677',
    featureIds: [
      'relation/5379619',
      'way/361352721',
      'way/361355030',
      'way/361355031',
      'way/361355032',
      'way/361355034',
      'way/361486542',
      'way/361486546',
    ],
    notes:
      'Exact playing-field bearing resolves north-northwest axis and places the main entrance/media screen on+X west. The broad original QID-tagged estate parcel is excluded as a footprint; actual stadium multipolygon and six elevated approaches determine the authored plan.',
  },
  limitations: [
    'Published exterior in the completed2018 structural state. Precise chair inventory, joint and panel subdivisions, membrane prestress and concourse/ramp vertical levels remain photo reconstruction. Enclosed service rooms, event graphics and the wider riverside park are outside the asset.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-membrane-vaults', position: [65, 57, 12], lookAt: [81, 41, 30] },
    { name: 'near-console-stays', position: [147, 58, 25], lookAt: [105, 47, 20] },
    { name: 'near-catwalk-lights', position: [20, 25, 0], lookAt: [48, 32, 20] },
    { name: 'near-main-screen', position: [162, 27, 10], lookAt: [116, 29, 0] },
    { name: 'near-seating', position: [0, 7, 0], lookAt: [-78, 17, 20] },
    { name: 'near-internal-screen', position: [0, 24, 0], lookAt: [65, 27, 83] },
    { name: 'near-media-facade', position: [135, 32, -22], lookAt: [116, 30, -17] },
    { name: 'near-west-ramp', position: [178, 12, 38], lookAt: [140, 5, 21] },
    { name: 'near-concourse', position: [127, 10, 40], lookAt: [112, 13, 40] },
    { name: 'near-roof-joints', position: [85, 34, 14], lookAt: [92, 39, 14] },
    { name: 'far-roof-structure', position: [-210, 188, 195], lookAt: [0, 24, 0] },
  ],
};
