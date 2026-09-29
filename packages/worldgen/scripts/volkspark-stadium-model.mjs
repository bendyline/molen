/** Volksparkstadion: mapped forty-bay cable wheel and the renewed2024 membrane roof. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { volksparkPlan } from './volkspark-plan.mjs';

const TAU = Math.PI * 2;
const white = [0.91, 0.93, 0.91],
  steel = [0.36, 0.41, 0.42],
  concrete = [0.59, 0.61, 0.59];
const blue = [0.012, 0.055, 0.32],
  black = [0.023, 0.03, 0.037],
  glass = [0.12, 0.2, 0.23];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
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
  if (!hit) throw Error('Volkspark mapped polygon ray missed');
  return hit;
}
const outer = (a) => ray(volksparkPlan.outer, a),
  inner = (a) => ray(volksparkPlan.inner, a);
const anchors = volksparkPlan.outer
  .slice(0, -1)
  .filter((_, i) => i % 2 === 1)
  .map((p) => [p[0], 41, p[1]]);
function path(out, ps, r = 0.035, color = steel, slot = 'metal', sides = 8) {
  for (let i = 1; i < ps.length; i++)
    if (Math.hypot(...ps[i].map((v, k) => v - ps[i - 1][k])) > 0.0001)
      tube(out, slot, ps[i - 1], ps[i], r, color, sides);
}
function rail(out, ps, color = steel) {
  for (const y of [0.55, 1.08])
    path(
      out,
      ps.map((p) => [p[0], p[1] + y, p[2]]),
      0.023,
      color,
    );
  for (let i = 0; i < ps.length; i += 3)
    tube(out, 'metal', ps[i], [ps[i][0], ps[i][1] + 1.08, ps[i][2]], 0.025, color, 8);
}
function roofPoint(bay, u, t) {
  const p = mix(anchors[bay % 40], anchors[(bay + 1) % 40], u),
    a = Math.atan2(p[0], p[2]);
  const r = Math.hypot(p[0], p[2]),
    near = radial(a, inner(a), 42),
    far = radial(a, r + 1.1 * Math.sin(Math.PI * u), 41);
  const v = mix(near, far, t);
  v[1] += Math.sin(Math.PI * u) * (0.65 + 2.35 * t) - 0.16 * Math.sin(Math.PI * ((t * 8) % 1));
  return v;
}
function roof(out) {
  for (let b = 0; b < 40; b++) {
    // The transverse steel bows form barrel fields between the radial cable pairs.
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 20; i++) {
        const ps = [
          roofPoint(b, i / 20, j / 32),
          roofPoint(b, (i + 1) / 20, j / 32),
          roofPoint(b, (i + 1) / 20, (j + 1) / 32),
          roofPoint(b, i / 20, (j + 1) / 32),
        ];
        face(out, 'membrane', ps, white, [0, 1, 0]);
        face(
          out,
          'membrane',
          ps.map((p) => [p[0], p[1] - 0.045, p[2]]),
          white,
          [0, -1, 0],
        );
      }
    for (let j = 0; j <= 8; j++)
      path(
        out,
        Array.from({ length: 25 }, (_, i) => {
          const p = roofPoint(b, i / 24, j / 8);
          p[1] -= 0.12;
          return p;
        }),
        0.075,
        steel,
        'metal',
        10,
      );
    for (const u of [0.25, 0.5, 0.75])
      path(
        out,
        Array.from({ length: 33 }, (_, i) => {
          const p = roofPoint(b, u, i / 32);
          p[1] += 0.014;
          return p;
        }),
        0.009,
        [0.72, 0.75, 0.72],
        'metal',
        5,
      );
    const mast = anchors[b],
      angle = Math.atan2(mast[0], mast[2]),
      R = Math.hypot(mast[0], mast[2]),
      front = radial(angle, inner(angle), 42),
      head = radial(angle, R, 59.5),
      back = radial(angle, R + 10, 41);
    tube(out, 'metal', [mast[0], 0, mast[2]], mast, 0.39, steel, 20);
    tube(out, 'metal', mast, head, 0.21, steel, 16);
    tube(out, 'metal', radial(angle, R, 35.3), back, 0.17, steel, 12);
    tube(out, 'metal', mast, back, 0.2, steel, 12);
    tube(out, 'metal', head, back, 0.036, steel, 10);
    const next = anchors[(b + 1) % 40],
      na = Math.atan2(next[0], next[2]),
      nR = Math.hypot(next[0], next[2]);
    tube(out, 'metal', back, radial(na, nR + 10, 41), 0.29, steel, 16);
    // Paired roof cables plus the narrow radial maintenance bridge and cross bracing.
    const upper = (t) => {
      const p = mix(front, head, t);
      p[1] -= 5.2 * Math.sin(Math.PI * t);
      return p;
    };
    const lower = (t) => mix(front, mast, t);
    path(
      out,
      Array.from({ length: 41 }, (_, i) => upper(i / 40)),
      0.045,
      steel,
      'metal',
      10,
    );
    path(
      out,
      Array.from({ length: 41 }, (_, i) => lower(i / 40)),
      0.05,
      steel,
      'metal',
      10,
    );
    const tangent = [Math.cos(angle), 0, -Math.sin(angle)];
    for (let j = 0; j <= 8; j++) {
      const p = upper(j / 8),
        q = lower(j / 8);
      if (j > 0) tube(out, 'metal', p, q, 0.026, steel, 8);
      if (j > 0 && j < 8) tube(out, 'metal', p, lower((j + 1) / 8), 0.016, steel, 6);
      for (const side of [-1, 1]) {
        const s = q.map((v, k) => v + tangent[k] * side * 0.45);
        s[1] -= 0.55;
        tube(out, 'metal', s, [s[0], s[1] + 0.8, s[2]], 0.023, steel, 6);
      }
    }
    for (let j = 0; j < 16; j++) {
      const p = lower(j / 16),
        q = lower((j + 1) / 16),
        p0 = p.map((v, k) => v - tangent[k] * 0.45),
        p1 = p.map((v, k) => v + tangent[k] * 0.45),
        q0 = q.map((v, k) => v - tangent[k] * 0.45),
        q1 = q.map((v, k) => v + tangent[k] * 0.45);
      for (const v of [p0, p1, q0, q1]) v[1] -= 0.55;
      face(out, 'metal', [p0, p1, q1, q0], steel, [0, 1, 0]);
      face(out, 'metal', [p0, p1, q1, q0], steel, [0, -1, 0]);
      beam(out, 'metal', p0, q0, 0.09, 0.16, steel);
      beam(out, 'metal', p1, q1, 0.09, 0.16, steel);
      for (const side of [-1, 1])
        tube(
          out,
          'metal',
          p.map((v, k) => v + tangent[k] * side * 0.45 + (k === 1 ? 0.25 : 0)),
          q.map((v, k) => v + tangent[k] * side * 0.45 + (k === 1 ? 0.25 : 0)),
          0.025,
          steel,
          6,
        );
    }
  }
  const ring = Array.from({ length: 401 }, (_, i) => {
    const a = (i * TAU) / 400;
    return radial(a, inner(a), 40.1);
  });
  for (const offset of [0, 1.1]) {
    const ps = ring.map((p) => {
      const a = Math.atan2(p[0], p[2]);
      return radial(a, Math.hypot(p[0], p[2]) + offset, p[1]);
    });
    rail(out, ps);
    path(out, ps, 0.08, steel, 'metal', 10);
  }
  for (let i = 0; i < 400; i++) {
    const a = (i * TAU) / 400,
      b = ((i + 1) * TAU) / 400;
    face(
      out,
      'metal',
      [
        radial(a, inner(a), 40),
        radial(b, inner(b), 40),
        radial(b, inner(b) + 1.1, 40),
        radial(a, inner(a) + 1.1, 40),
      ],
      steel,
      [0, 1, 0],
    );
  }
  // The operator describes300 heads, each with ten LED units, and30 line arrays.
  for (let i = 0; i < 300; i++) {
    const a = (i * TAU) / 300,
      o = transformed(out, a, radial(a, inner(a) + 1.4, 40.1));
    box(o, 'metal', [-0.34, 0, -0.24], [0.34, 0.4, 0.24], black);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 2; y++)
        box(
          o,
          'plastic',
          [-0.29 + x * 0.12, 0.05 + y * 0.16, -0.249],
          [-0.205 + x * 0.12, 0.16 + y * 0.16, -0.243],
          white,
        );
  }
  for (let i = 0; i < 30; i++) {
    const b = (i * 40) / 30,
      bi = Math.floor(b),
      p = roofPoint(bi, b - bi, 0.38),
      o = transformed(out, Math.atan2(p[0], p[2]), p);
    for (let j = 0; j < 8; j++)
      box(
        o,
        'metal',
        [-0.48, -1.1 - j * 0.34, (0.02 * j * j) / 8],
        [0.48, -0.78 - j * 0.34, 0.42 + (0.02 * j * j) / 8],
        black,
      );
    tube(o, 'metal', [0, 0, 0], [0, -1.1, 0.16], 0.032, steel, 8);
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
const tiers = [
  { rows: 24, depth: 18.72, y: 1, slope: 20, offset: 0 },
  { rows: 12, depth: 9.6, y: 9.714, slope: 30, offset: 21.02 },
  { rows: 27, depth: 22.41, y: 16.957, slope: 35, offset: 32.42 },
];
function seat(a, tier, row) {
  const t = tiers[tier],
    start = Math.hypot(...rounded(a, 42, 60, 8).filter((_, i) => i !== 1)),
    end = outer(a) - 9;
  return radial(
    a,
    start + ((end - start) * (t.offset + (t.depth * row) / t.rows)) / 54.83,
    t.y + ((t.depth * row) / t.rows) * Math.tan((t.slope * Math.PI) / 180),
  );
}
const letters = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['11111', '10000', '10000', '11111', '00001', '00001', '11111'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
};
function seatColor(p, tier, row) {
  if (p[0] > 60 && tier === 2) {
    const c = Math.floor((p[2] + 41) / 5),
      r = 6 - Math.floor((row - 7) / 2.3),
      g = letters['HSV'[Math.floor(c / 6)]];
    if (g?.[r]?.[c % 6] === '1') return white;
  }
  if (p[0] > 35 && Math.abs(p[2]) < 19 && tier === 0) {
    const x = Math.abs(p[2] / 14),
      y = Math.abs((row - 12) / 9),
      d = x + y;
    if (d > 0.76 && d < 1) return white;
    if (d < 0.67) return black;
  }
  return blue;
}
function bowl(out) {
  soccerPitch(out);
  for (let tier = 0; tier < 3; tier++)
    for (let row = 0; row < tiers[tier].rows; row++) {
      const n = 352;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n,
          b = ((i + 1) * TAU) / n,
          p = seat(a, tier, row),
          q = seat(b, tier, row),
          r = seat(b, tier, row + 1),
          s = seat(a, tier, row + 1);
        face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], concrete, [0, 1, 0]);
        face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]);
      }
      let carry = 0;
      for (let i = 1; i <= n; i++) {
        const p = seat(((i - 1) * TAU) / n, tier, row + 0.3),
          q = seat((i * TAU) / n, tier, row + 0.3),
          L = Math.hypot(q[0] - p[0], q[2] - p[2]);
        for (let d = 0.5 - carry; d < L; d += 0.5) {
          const v = mix(p, q, d / L),
            a = Math.atan2(v[0], v[2]),
            f = ((((a / TAU) * 28) % 1) + 1) % 1;
          if (f < 0.045 || f > 0.955) continue;
          // The north lower stand is the permanent standing terrace.
          if (tier === 0 && v[2] > 65 && Math.abs(v[0]) < 37) continue;
          chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, seatColor(v, tier, row));
        }
        carry = (carry + L) % 0.5;
      }
    }
  for (let t = 0; t < 3; t++)
    for (let i = 0; i < 28; i++) {
      const a = (i * TAU) / 28;
      rail(
        out,
        Array.from({ length: tiers[t].rows + 1 }, (_, j) => seat(a, t, j)),
      );
      const p = seat(a, t, Math.floor(tiers[t].rows * 0.5)),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.2, 0, -0.1], [1.2, 2.55, 2.4], concrete);
      box(o, 'glass', [-1.04, 0.08, -0.125], [1.04, 2.33, -0.115], black);
    }
  // Ribbon fascia and hospitality glazing separate the tiers.
  for (let t = 1; t < 3; t++)
    for (let i = 0; i < 352; i++) {
      const a = (i * TAU) / 352,
        b = ((i + 1) * TAU) / 352,
        p = seat(a, t, 0),
        q = seat(b, t, 0),
        n = [-Math.sin(a), 0, -Math.cos(a)];
      face(out, 'plastic', [[p[0], p[1] - 0.9, p[2]], [q[0], q[1] - 0.9, q[2]], q, p], blue, n);
      if (Math.abs(Math.sin(a)) > 0.75)
        face(
          out,
          'glass',
          [
            [p[0], p[1] - 1.7, p[2] + 0.005],
            [q[0], q[1] - 1.7, q[2] + 0.005],
            [q[0], q[1] - 0.95, q[2] + 0.005],
            [p[0], p[1] - 0.95, p[2] + 0.005],
          ],
          glass,
          n,
        );
    }
  for (let row = 3; row < 24; row += 4)
    for (let x = -32; x < 33; x += 8) {
      const a = Math.atan2(x, 75),
        p = seat(a, 0, row);
      tube(out, 'metal', [p[0] - 2, p[1] + 1, p[2]], [p[0] + 2, p[1] + 1, p[2]], 0.035, steel, 8);
      for (const dx of [-2, 2])
        tube(out, 'metal', [p[0] + dx, p[1], p[2]], [p[0] + dx, p[1] + 1, p[2]], 0.035, steel, 8);
    }
  // Two62m² screens in the diagonally opposite corner stands, below the roof.
  for (const a of [-Math.PI / 4, (3 * Math.PI) / 4]) {
    const o = transformed(out, a, radial(a, outer(a) - 18, 29));
    box(o, 'metal', [-5.35, 0, -0.3], [5.35, 6.4, 0.2], steel);
    box(o, 'glass', [-5.1, 0.16, -0.33], [5.1, 6.24, -0.31], black);
    for (const x of [-4, 4]) tube(o, 'metal', [x, 6.4, 0], [x, 12, 0], 0.09, steel, 10);
  }
}
function facade(out) {
  const n = 400;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      R = outer(a) - 5,
      S = outer(b) - 5;
    for (const y of [4.8, 9.6, 14.4, 19.2, 23.8]) {
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
        [radial(a, R, y - 0.4), radial(b, S, y - 0.4), radial(b, S, y), radial(a, R, y)],
        concrete,
        [Math.sin(a), 0, Math.cos(a)],
      );
      if (y < 20)
        face(
          out,
          'glass',
          [
            radial(a, R - 1, y - 4.8),
            radial(b, S - 1, y - 4.8),
            radial(b, S - 1, y - 0.38),
            radial(a, R - 1, y - 0.38),
          ],
          glass,
          [Math.sin(a), 0, Math.cos(a)],
        );
    }
    if (i % 2 === 0)
      tube(out, 'metal', radial(a, R - 0.94, 0.5), radial(a, R - 0.94, 19), 0.035, white, 6);
    for (const y of [6.1, 10.9, 15.7])
      path(out, [radial(a, R - 0.92, y), radial(b, S - 0.92, y)], 0.035, white, 'metal', 6);
    // Sloping underside of the upper tier, exposed behind the column frame.
    const p = seat(a, 2, 0),
      q = seat(b, 2, 0),
      r = seat(b, 2, 27),
      s = seat(a, 2, 27);
    face(
      out,
      'concrete',
      [p, q, r, s].map((v) => [v[0], v[1] - 0.65, v[2]]),
      [0.42, 0.45, 0.44],
      [0, -1, 0],
    );
  }
  for (let k = 0; k < 80; k++) {
    const a = (k * TAU) / 80,
      R = outer(a) - 5,
      o = transformed(out, a, radial(a, R, 0));
    box(o, 'concrete', [-0.32, 0, -0.35], [0.32, 32.5, 0.35], concrete);
    const nextAngle = ((k + 1) * TAU) / 80;
    for (const y of [4.8, 9.6, 14.4, 19.2, 23.8, 30.2])
      beam(
        out,
        'metal',
        radial(a, R - 0.2, y - 4.6),
        radial(nextAngle, outer(nextAngle) - 5.2, y),
        0.12,
        0.12,
        steel,
      );
    beam(
      out,
      'concrete',
      seat(a, 2, 0).map((v, k) => v - (k === 1 ? 0.7 : 0)),
      seat(a, 2, 27).map((v, k) => v - (k === 1 ? 0.7 : 0)),
      0.65,
      0.8,
      concrete,
    );
  }
  // Twenty-one stair cores: local sections and exact spacing reconstructed from the visible façade.
  for (let k = 0; k < 21; k++) {
    const a = ((k + 0.35) * TAU) / 21,
      R = outer(a) - 2,
      o = transformed(out, a, radial(a, R, 0));
    box(o, 'concrete', [-3.15, 0, -6], [3.15, 26.5, 0.15], white);
    for (let j = 0; j < 6; j++)
      for (const x of [-1.95, 0.25]) {
        box(o, 'glass', [x, 2 + j * 3.9, 0.16], [x + 1.7, 3.7 + j * 3.9, 0.18], glass);
        beam(
          o,
          'metal',
          [x + 0.85, 2 + j * 3.9, 0.19],
          [x + 0.85, 3.7 + j * 3.9, 0.19],
          0.035,
          0.05,
          white,
        );
      }
    box(o, 'glass', [-1, 0, 0.18], [1, 2.4, 0.2], blue);
  }
  // East entrance stair and current diamond emblem; temporary roof sponsors are excluded.
  const a = -Math.PI / 2,
    R = outer(a),
    o = transformed(out, a, radial(a, R - 1, 0));
  for (let i = 0; i < 30; i++)
    box(o, 'concrete', [-8, 0, 1 + i * 0.3], [8, 4.8 - i * 0.16, 1 + (i + 1) * 0.3], concrete);
  box(o, 'plastic', [-3.4, 31, -0.3], [3.4, 36, 0.0], blue);
  face(
    o,
    'plastic',
    [
      [0, 31.5, 0.015],
      [2.4, 33.5, 0.015],
      [0, 35.5, 0.015],
      [-2.4, 33.5, 0.015],
    ],
    white,
    [0, 0, 1],
  );
  face(
    o,
    'plastic',
    [
      [0, 32.25, 0.02],
      [1.5, 33.5, 0.02],
      [0, 34.75, 0.02],
      [-1.5, 33.5, 0.02],
    ],
    black,
    [0, 0, 1],
  );
}
export function buildVolkspark(out) {
  bowl(out);
  facade(out);
  roof(out);
}
export const volksparkStudy = {
  id: 'N0696',
  key: 'volksparkstadion',
  wikidataId: 'Q150933',
  title: 'Volksparkstadion',
  build: buildVolkspark,
  metricTriangleUv: true,
  size: [225, 60, 260],
  smoothNormalSlots: ['trim', 'foundation', 'roof'],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped football pitch center, +Z toward the north stand, +X west; Y0 field and exterior ground.',
  },
  previewCamera: { position: [-205, 123, 210], lookAt: [0, 26, 0] },
  visualBrief:
    'Hamburg stadium with forty barrel-shaped membrane roof fields on a cable-wheel, forty tall masts and external triangular compression brackets. Three blue seating tiers with white HSV lettering, north standing terrace, western diamond seat pattern,21 white staircase cores, exposed grandstand undersides, five glazed façade levels, diagonal screens,300 ten-cell roof lights and30 hanging audio arrays distinguish the completed2024 exterior.',
  sourceFacts: {
    published:
      'Structural engineer sbp specifies40 radial cable trusses and40 masts for the original roof; its2024 refurbishment dimensions are240x200m overall,59.5m high and about62m roof depth. The operator states44m roof above pitch,105x68m field, three tiers at20/30/35degrees,21 staircases,45cm seats with5cm gaps, two62m² video screens,300 lights with ten LED units each,30 audio arrays and a~1m catwalk at40m. Current capacity57,000; approved60,000 expansion is planned to startOctober2026 and is not yet modeled.',
    reconstructed:
      'Exact OSM roof envelope, inner aperture and directed pitch axis set geometry. Mast anchors follow alternate mapped roof scallops. Cable sag, mast sections, barrel curvature, row counts, staircase spacing, glazing subdivisions, core sizes and local façade details follow engineer/operator photographs; they are not fabrication drawings. Native ground is nominal stadium contact, without surrounding landscaped grades.',
  },
  referencePages: [
    'https://www.sbp.de/projekt/volksparkstadion-hamburg/',
    'https://www.sbp.de/en/project/modernisation-volksparkstadion-hamburg/',
    'https://www.hsv.de/volkspark/geschichte-des-volksparkstadions',
    'https://nachhaltigkeitsbericht.hsv.de/2023-24/hoch-hinaus/',
    'https://www.hsv.de/en/stadium/volksparkstadion',
    'https://www.hsv.de/en/news/more-space-for-fans-expansion-of-volksparkstadion-gets-underway',
    'https://www.hsv.de/fileadmin/user_upload/Bilder_HSV.de/Volksparkstadion/Stadionplan_Volksparkstadion.pdf',
    'https://www.openstreetmap.org/relation/1686446',
    'https://www.openstreetmap.org/way/123124326',
  ],
  referenceRights:
    'Original geometry and canonical shared procedural surfaces; reference photographs are research only. OpenStreetMap contributors, ODbL1.0, for plan coordinates.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: volksparkPlan.anchor,
    heading: volksparkPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    source: 'https://www.openstreetmap.org/way/123124326',
    featureIds: ['relation/1686446', 'way/19617443', 'way/123124325', 'way/123124326'],
    notes:
      'Actual pitch long edge directs+Z north. The exact roof multipolygon supplies outer scallops and inner aperture; white HSV seating is west, standing terrace north and principal entrance facade east.',
  },
  limitations: [
    'Completed2024 exterior in shared Molen style; cable sizes/sag, façade subdivision and seat/core inventories are photo reconstructions. Changing event graphics, roof sponsor lettering, enclosed rooms, future October2026 capacity works and the surrounding transport/park district are excluded.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-roof-barrels', position: [-89, 67, 54], lookAt: [-71, 44, 43] },
    { name: 'near-mast-bracket', position: [-126, 43, 23], lookAt: [-105, 44, 18] },
    { name: 'near-cable-wheel', position: [-56, 35, 26], lookAt: [-73, 42, 32] },
    { name: 'near-catwalk-lights', position: [-29, 37, 10], lookAt: [-35, 40, 10] },
    { name: 'near-east-entrance', position: [-136, 15, 0], lookAt: [-101, 16, 0] },
    { name: 'near-staircore', position: [-133, 18, 48], lookAt: [-102, 16, 37] },
    { name: 'near-west-seats', position: [0, 12, 0], lookAt: [78, 23, 0] },
    { name: 'near-north-terrace', position: [0, 4, 18], lookAt: [0, 7, 72] },
    { name: 'near-screen', position: [0, 23, 0], lookAt: [-68, 33, 71] },
    { name: 'near-speakers', position: [-49, 35, 12], lookAt: [-55, 41, 12] },
    { name: 'far-roof-envelope', position: [155, 176, 165], lookAt: [0, 25, 0] },
  ],
};
