/** Hampden Park: individually mapped stands, retained terrace bowl and the 1999 South Stand. */
import { beam } from './authored-structure-mesh.mjs';
import { hampdenPlan } from './hampden-plan.mjs';
import { transformed } from './lighthouse-models.mjs';
import { letterAt, lettering } from './stadium-lettering.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  fieldY = -4.2,
  white = [0.82, 0.83, 0.79],
  concrete = [0.56, 0.57, 0.54],
  blue = [0.025, 0.16, 0.34],
  steel = [0.08, 0.15, 0.19],
  rust = [0.29, 0.13, 0.07],
  brick = [0.53, 0.19, 0.085],
  glass = [0.22, 0.36, 0.43],
  red = [0.68, 0.035, 0.045],
  seatBlue = [0.07, 0.24, 0.43];
const southA = 3.638,
  southB = 5.813;
function isSouth(a) {
  return a > southA && a < southB;
}
function round(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return [t * Math.sin(a), y, t * Math.cos(a)];
}
const roofPolys = ['east', 'north', 'south', 'west'].map((k) =>
  hampdenPlan[k].map(([x, z]) => [
    k === 'north'
      ? Math.min(96.5, x)
      : k === 'south'
        ? Math.max(x, -114.5 * Math.sqrt(Math.max(0.001, 1 - (z / 156) ** 2)))
        : x,
    z,
  ]),
);
function crossing(poly, a) {
  const d = [Math.sin(a), Math.cos(a)],
    r = [];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) r.push(t);
  }
  return r;
}
function roofEnds(a) {
  const hits = roofPolys.flatMap((p) => crossing(p, a)).sort((a, b) => a - b);
  if (hits.length < 2) {
    const p = round(a, 44, 85, 43),
      q = round(a, 105, 145, 67);
    return [Math.hypot(p[0], p[2]), Math.hypot(q[0], q[2])];
  }
  return [hits[0], hits.at(-1)];
}
function roofPoint(a, t, dy = 0) {
  const [lo, hi] = roofEnds(a),
    r = lo + (hi - lo) * t,
    south = isSouth(a),
    y = (south ? 26.5 : 17.3) - (south ? 3.5 : 1.4) * t;
  return [r * Math.sin(a), y + dy, r * Math.cos(a)];
}
function radialSlab(
  out,
  inner,
  outer,
  y,
  thick = 0.25,
  slot = 'concrete',
  color = concrete,
  n = 360,
  a0 = 0,
  a1 = TAU,
) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      b = a0 + ((a1 - a0) * (i + 1)) / n,
      top = [inner(a, y), inner(b, y), outer(b, y), outer(a, y)],
      bot = top.map((p) => [p[0], p[1] - thick, p[2]]);
    face(out, slot, top, color, [0, 1, 0]);
    face(out, slot, bot, color, [0, -1, 0]);
    for (const k of [0, 2]) {
      const j = (k + 1) % 4;
      face(out, slot, [bot[k], bot[j], top[j], top[k]], color, [
        top[j][2] - top[k][2],
        0,
        top[k][0] - top[j][0],
      ]);
    }
  }
}
function roof(out) {
  // Pale corrugated roof lies below the exposed weathered cantilever frames, as in the 2024 club aerial.
  for (let i = 0; i < 600; i++) {
    const a = (i * TAU) / 600,
      b = ((i + 1) * TAU) / 600;
    for (let j = 0; j < 8; j++) {
      const t = j / 8,
        u = (j + 1) / 8,
        ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      face(out, 'seam', ps, white, [0, 1, 0]);
      face(
        out,
        'seam',
        ps.map((p) => [p[0], p[1] - 0.15, p[2]]),
        white,
        [0, -1, 0],
      );
    }
    for (const t of [0, 1])
      face(
        out,
        'metal',
        [
          roofPoint(a, t, 0.25),
          roofPoint(b, t, 0.25),
          roofPoint(b, t, -0.85),
          roofPoint(a, t, -0.85),
        ],
        white,
        [Math.sin(a) * (t ? 1 : -1), 0, Math.cos(a) * (t ? 1 : -1)],
      );
  }
  for (let i = 0; i < 84; i++) {
    const a = ((i + 0.5) * TAU) / 84,
      frameColor = isSouth(a) ? rust : [0.32, 0.17, 0.11],
      width = isSouth(a) ? 1.6 : 1.15,
      p = roofPoint(a, 0.9),
      foot = [p[0], 0, p[2]];
    beam(out, 'metal', foot, [p[0], p[1] + 0.4, p[2]], 0.38, 0.42, steel);
    const lower = Array.from({ length: 13 }, (_, j) => roofPoint(a, j / 12, 0.18)),
      upper = lower.map((p, j) => [
        p[0],
        p[1] + 0.45 + (isSouth(a) ? 5 : 3.8) * Math.sin((Math.PI * j) / 12),
        p[2],
      ]);
    for (const side of [-1, 1]) {
      const shift = (p) => [
        p[0] + Math.cos(a) * width * side,
        p[1],
        p[2] - Math.sin(a) * width * side,
      ];
      curve(out, lower.map(shift), 0.12, frameColor);
      curve(out, upper.map(shift), 0.12, frameColor);
      for (let j = 0; j < 12; j++) {
        tube(out, 'metal', shift(lower[j]), shift(upper[j + 1]), 0.065, frameColor, 8);
        tube(out, 'metal', shift(upper[j]), shift(lower[j + 1]), 0.065, frameColor, 8);
      }
    }
    for (let j = 0; j < 13; j++)
      tube(
        out,
        'metal',
        [upper[j][0] - Math.cos(a) * width, upper[j][1], upper[j][2] + Math.sin(a) * width],
        [upper[j][0] + Math.cos(a) * width, upper[j][1], upper[j][2] - Math.sin(a) * width],
        0.065,
        frameColor,
        8,
      );
    if (i % 3 === 0) {
      const p = roofPoint(a, 0.03, 1.3),
        o = transformed(out, a, p);
      box(o, 'metal', [-1.5, -0.3, -0.3], [1.5, 0.7, 0.4], steel);
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 2; k++)
          box(
            o,
            'plastic',
            [-1.35 + j * 0.7, -0.2 + k * 0.43, 0.42],
            [-0.82 + j * 0.7, 0.13 + k * 0.43, 0.45],
            white,
          );
    }
  }
  for (const t of [0.22, 0.51, 0.82])
    curve(
      out,
      Array.from({ length: 337 }, (_, i) => roofPoint((i * TAU) / 336, t, 0.18)),
      0.075,
      rust,
    );
  // South roof equipment stays behind the exposed truss fields.
  for (let i = 0; i < 14; i++) {
    const a = southA + 0.1 + ((southB - southA - 0.2) * i) / 13,
      p = roofPoint(a, 0.88, 0.2),
      o = transformed(out, a, p);
    box(o, 'metal', [-1.1, 0, -1.4], [1.1, 1.3, 1.4], [0.63, 0.66, 0.64]);
    for (let j = 0; j < 6; j++)
      box(o, 'metal', [-0.95, 0.15 + j * 0.17, 1.41], [0.95, 0.21 + j * 0.17, 1.45], steel);
  }
}
function rail(out, p, q) {
  tube(out, 'metal', [p[0], p[1] + 1, p[2]], [q[0], q[1] + 1, q[2]], 0.028, steel, 8);
  tube(out, 'metal', p, [p[0], p[1] + 1, p[2]], 0.025, steel, 8);
}
function bowl(out) {
  soccerPitch(transformed(out, 0, [0, fieldY, 0]));
  const tiers = [
    { hx: 39, hz: 90, r: 39, y: fieldY + 0.4, rows: 53, run: 0.93, rise: 0.315, region: 'ring' },
    { hx: 67, hz: 109, r: 51, y: 7.2, rows: 30, run: 0.9, rise: 0.48, region: 'south' },
  ];
  for (let tier = 0; tier < tiers.length; tier++) {
    const t = tiers[tier];
    for (let row = 0; row < t.rows; row++) {
      const y = t.y + row * t.rise,
        ps = [];
      for (let i = 0; i <= 720; i++)
        ps.push(
          round(
            (i * TAU) / 720,
            t.hx + row * t.run,
            t.hz + row * t.run,
            t.r + row * t.run * 0.55,
            y,
          ),
        );
      const permitted = (a) => (t.region === 'south' ? isSouth(a) : !isSouth(a) || row < 26);
      for (let i = 0; i < 720; i++) {
        const a = (i * TAU) / 720,
          b = ((i + 1) * TAU) / 720;
        if (!permitted((a + b) / 2)) continue;
        const q = (a) =>
          round(
            a,
            t.hx + (row + 1) * t.run,
            t.hz + (row + 1) * t.run,
            t.r + (row + 1) * t.run * 0.55,
            y,
          );
        face(out, 'concrete', [ps[i], ps[i + 1], q(b), q(a)], concrete, [0, 1, 0]);
        face(
          out,
          'concrete',
          [
            [ps[i][0], y - t.rise, ps[i][2]],
            [ps[i + 1][0], y - t.rise, ps[i + 1][2]],
            ps[i + 1],
            ps[i],
          ],
          concrete,
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      }
      const ds = [0];
      for (let i = 1; i < ps.length; i++)
        ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][2] - ps[i - 1][2]));
      let j = 1;
      const count = Math.floor(ds.at(-1) / 0.53);
      for (let i = 0; i < count; i++) {
        const d = (ds.at(-1) * i) / count;
        while (ds[j] < d) j++;
        const a = ((j - 1) * TAU) / 720;
        if (!permitted(a) || Math.abs((a / TAU) * 44 - Math.round((a / TAU) * 44)) < 0.045)
          continue;
        const f = (d - ds[j - 1]) / (ds[j] - ds[j - 1]),
          p = ps[j - 1].map((v, k) => v + (ps[j][k] - v) * f),
          z = p[2],
          x = p[0];
        let color = seatBlue;
        if (
          (x > 0 && Math.abs(z) > 40 && Math.abs(z) < 70) ||
          (Math.abs(z) > 100 && Math.abs(x) > 22 && Math.abs(x) < 45) ||
          (tier === 1 && Math.abs(z) < 25)
        )
          color = red;
        if (tier === 0 && x > 0 && Math.abs(z) < 43 && row > 12 && row < 45) {
          const u = (z + 43) / 12.28,
            v = (row - 13) / 31;
          if (u >= 3 && u < 4) color = red;
          if (letterAt('HAMPDEN', u, v, 0.115)) color = white;
        }
        if (tier === 0 && Math.abs(z) > 93 && Math.abs(x) < 31) {
          const v = (row - 3) / 47,
            u = x / 31;
          if (Math.abs(v - (u + 1) / 2) < 0.075 || Math.abs(v - (1 - u) / 2) < 0.075) color = white;
        }
        chair(out, Math.atan2(-(ps[j][2] - ps[j - 1][2]), ps[j][0] - ps[j - 1][0]), p, color);
      }
    }
  }
  // South hospitality ribbon divides the two decks, with actual recessed glazing and mullions.
  for (let i = 0; i < 150; i++) {
    const a = southA + ((southB - southA) * i) / 150,
      b = southA + ((southB - southA) * (i + 1)) / 150,
      p = (a, y) => round(a, 65, 108, 50, y);
    face(out, 'glass', [p(a, 4.1), p(b, 4.1), p(b, 7), p(a, 7)], glass, [
      -Math.sin(a),
      0,
      -Math.cos(a),
    ]);
    if (i % 2 === 0) beam(out, 'metal', p(a, 4.1), p(a, 7), 0.08, 0.1, white);
  }
  for (let i = 0; i < 44; i++) {
    const a = ((i + 0.5) * TAU) / 44,
      row = isSouth(a) ? 14 : 25,
      y = fieldY + 0.4 + row * 0.315,
      p = round(a, 39 + row * 0.93, 90 + row * 0.93, 39 + row * 0.93 * 0.55, y),
      o = transformed(out, a, p);
    box(o, 'glass', [-1.25, 0, -0.15], [1.25, 2.3, 0.12], [0.035, 0.05, 0.06]);
    box(o, 'concrete', [-1.4, 2.3, -0.2], [1.4, 2.5, 0.2], concrete);
  }
  // East and west roof-suspended LED screens; event graphics are intentionally neutral.
  for (const s of [-1, 1]) {
    const o = transformed(out, s < 0 ? 0 : Math.PI, [0, 0, s * 126]);
    box(o, 'metal', [-12, 7, -0.4], [12, 13.2, 0.2], steel);
    box(o, 'glass', [-11.7, 7.25, 0.21], [11.7, 12.95, 0.25], blue);
    lettering(o, 'HAMPDEN PARK', {
      width: 20,
      height: 1.8,
      y: 9,
      z: 0.28,
      color: white,
      stroke: 0.12,
    });
    for (const x of [-10, 10]) beam(o, 'metal', [x, 13.2, 0], [x, 17, 0], 0.25, 0.3, steel);
  }
  radialSlab(
    out,
    (a, y) => round(a, 35, 62, 4, y),
    (a, y) => round(a, 39, 90, 39, y),
    fieldY + 0.01,
    0.18,
    'ground',
    [0.36, 0.35, 0.31],
  );
  // Bowl foundation and a moat wall conceal the contact-plane terrain cut.
  box(out, 'concrete', [-42, fieldY - 0.25, -94], [42, fieldY - 0.08, 94], concrete);
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360;
    face(
      out,
      'concrete',
      [
        round(a, 39, 90, 39, fieldY - 0.2),
        round(b, 39, 90, 39, fieldY - 0.2),
        round(b, 39, 90, 39, fieldY + 0.4),
        round(a, 39, 90, 39, fieldY + 0.4),
      ],
      concrete,
      [-Math.sin(a), 0, -Math.cos(a)],
    );
  }
}
function curvedWall(out, points, y0, y1, slot, color) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    face(
      out,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      color,
      [-dz, 0, dx],
    );
  }
}
function turret(out, x, z, r, h) {
  const p = (a, y) => [x + r * Math.sin(a), y, z + r * Math.cos(a)];
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      b = ((i + 1) * TAU) / 96;
    for (const [y0, y1, slot, col] of [
      [0, 4.8, 'brick', brick],
      [4.8, h - 2, 'metal', blue],
      [h - 2, h, 'glass', glass],
    ])
      face(out, slot, [p(a, y0), p(b, y0), p(b, y1), p(a, y1)], col, [Math.sin(a), 0, Math.cos(a)]);
    if (i % 4 === 0) beam(out, 'metal', p(a, 4.8), p(a, h), 0.065, 0.08, white);
    for (const y of [0.4, 4.5, h - 2, h]) {
      const o = transformed(out, a, [x, y, z]);
      box(o, 'metal', [-0.3, 0, r - 0.1], [0.3, 0.16, r + 0.22], y < 5 ? brick : white);
    }
  }
  for (let j = 1; j < 13; j++) {
    const y = 4.8 + ((h - 6.8) * j) / 13;
    curve(
      out,
      Array.from({ length: 97 }, (_, i) => p((i * TAU) / 96, y)),
      0.02,
      [0.22, 0.31, 0.37],
    );
  }
  const cap = Array.from({ length: 97 }, (_, i) => [
    x + (r + 0.35) * Math.sin((i * TAU) / 96),
    h + 0.12,
    z + (r + 0.35) * Math.cos((i * TAU) / 96),
  ]);
  for (let i = 0; i < 96; i++)
    out.addTriangle(
      'seam',
      'metric:uv',
      [[x, h + 0.12, z], cap[i], cap[i + 1]],
      [0, 1, 0],
      [
        [x, z],
        [cap[i][0], cap[i][2]],
        [cap[i + 1][0], cap[i + 1][2]],
      ],
      white,
    );
  curve(out, cap, 0.13, white);
  // The two entrance towers have shallow glazed rooflights below white circular caps.
  if (r > 6.5) {
    const light = (a, top) => [
      x + r * (top ? 0.64 : 0.82) * Math.sin(a),
      h + (top ? 1.45 : 0.23),
      z + r * (top ? 0.64 : 0.82) * Math.cos(a),
    ];
    for (let i = 0; i < 96; i++) {
      const a = (i * TAU) / 96,
        b = ((i + 1) * TAU) / 96;
      face(
        out,
        'glass',
        [light(a, false), light(b, false), light(b, true), light(a, true)],
        glass,
        [Math.sin(a), 1, Math.cos(a)],
      );
      out.addTriangle(
        'metal',
        'metric:uv',
        [[x, h + 1.45, z], light(a, true), light(b, true)],
        [0, 1, 0],
        [
          [0, 0],
          [light(a, true)[0], light(a, true)[2]],
          [light(b, true)[0], light(b, true)[2]],
        ],
        white,
      );
      if (i % 3 === 0) beam(out, 'metal', light(a, false), light(a, true), 0.075, 0.085, white);
    }
  }
  for (let i = 0; i < 32; i++) {
    const a = (i * TAU) / 32;
    tube(
      out,
      'metal',
      p(a, h),
      [x + (r + 0.32) * Math.sin(a), h + 0.8, z + (r + 0.32) * Math.cos(a)],
      0.025,
      steel,
      8,
    );
  }
  curve(
    out,
    Array.from({ length: 97 }, (_, i) => [
      x + (r + 0.32) * Math.sin((i * TAU) / 96),
      h + 0.8,
      z + (r + 0.32) * Math.cos((i * TAU) / 96),
    ]),
    0.025,
    steel,
  );
}
function facade(out) {
  // Curved south wall is brick below silver cladding; windows sit in five horizontal bands.
  const southOuter = Array.from({ length: 141 }, (_, i) => {
    const a = southA + ((southB - southA) * i) / 140,
      p = roofPoint(a, 1);
    return [p[0], p[2]];
  });
  curvedWall(out, southOuter, 0, 5, 'brick', brick);
  curvedWall(out, southOuter, 5, 22.8, 'metal', white);
  for (let i = 0; i < 140; i++) {
    const a = southA + ((southB - southA) * i) / 140,
      b = southA + ((southB - southA) * (i + 1)) / 140,
      p = roofPoint(a, 1),
      q = roofPoint(b, 1),
      norm = [Math.sin(a), 0, Math.cos(a)];
    if (i % 4 === 0)
      beam(
        out,
        'metal',
        [p[0] + norm[0] * 0.13, 0, p[2] + norm[2] * 0.13],
        [p[0] + norm[0] * 0.13, 22.5, p[2] + norm[2] * 0.13],
        0.22,
        0.3,
        blue,
      );
    if (i % 4 === 0) {
      const o = transformed(out, a, [p[0], 0, p[2]]);
      box(o, 'metal', [-1.4, 0.2, 0.12], [1.4, 2.5, 0.3], blue);
      box(o, 'plastic', [-1.3, 2.2, 0.31], [-0.7, 2.4, 0.32], [0.9, 0.72, 0.25]);
    }
    if (Math.abs(p[2]) < 92)
      for (const y of [7.2, 10.4, 13.6, 16.8, 20]) {
        face(
          out,
          'glass',
          [
            [p[0] + norm[0] * 0.13, y, p[2] + norm[2] * 0.13],
            [q[0] + norm[0] * 0.13, y, q[2] + norm[2] * 0.13],
            [q[0] + norm[0] * 0.13, y + 1.2, q[2] + norm[2] * 0.13],
            [p[0] + norm[0] * 0.13, y + 1.2, p[2] + norm[2] * 0.13],
          ],
          glass,
          norm,
        );
        for (const f of [0, 0.5]) {
          const x = p[0] + (q[0] - p[0]) * f + norm[0] * 0.18,
            z = p[2] + (q[2] - p[2]) * f + norm[2] * 0.18;
          beam(out, 'metal', [x, y, z], [x, y + 1.2, z], 0.06, 0.09, white);
        }
      }
  }
  // Two round entrance towers and four smaller circulation projections preserve the mapped ensemble.
  turret(out, -119.7, 35.6, 7.2, 25.1);
  turret(out, -119.2, -23, 7.1, 25.1);
  for (const [x, z, r, h] of [
    [-112, 65, 4.9, 19],
    [-111.4, -57.8, 4.9, 19],
    [-115.3, 46.8, 2.2, 22],
    [-114.4, -46.6, 2.2, 22],
  ])
    turret(out, x, z, r, h);
  const entry = transformed(out, -Math.PI / 2, [-115, 0, 6.3]);
  box(entry, 'glass', [-21, 2.5, 0.01], [21, 22.6, 0.25], glass);
  for (const y of [6, 10, 14, 18]) box(entry, 'metal', [-21, y, 0.28], [21, y + 0.8, 0.38], white);
  for (let x = -20; x <= 20; x += 4)
    box(entry, 'metal', [x - 0.065, 2.5, 0.26], [x + 0.065, 22.6, 0.4], white);
  for (let j = 0; j < 15; j++)
    box(entry, 'brick', [-21, j / 6, 5.5 - j * 0.36], [21, (j + 1) / 6, 6 - j * 0.36], brick);
  for (const x of [-20, -7, 7, 20]) rail(entry, [x, 0.1, 6], [x, 3, 0]);
  box(entry, 'metal', [-23, 22.8, -0.4], [23, 24.1, 0.5], blue);
  lettering(entry, 'HAMPDEN', {
    width: 27,
    height: 1.7,
    y: 22.45,
    z: 0.56,
    color: white,
    stroke: 0.14,
  });
  // Horizontal louver screens and entry canopy tie the towers together.
  for (const side of [-1, 1])
    for (let j = 0; j < 16; j++)
      box(
        entry,
        'metal',
        [side > 0 ? 9 : -23, 6 + j * 0.8, 0.6],
        [side > 0 ? 23 : -9, 6.25 + j * 0.8, 1.4],
        blue,
      );
  for (let x = -22; x <= 22; x += 4) {
    beam(entry, 'metal', [x, 3.2, 0], [x, 3.2, 6], 0.1, 0.14, steel);
    for (let z = 0; z < 6; z += 0.6)
      box(entry, 'metal', [x - 0.1, 3.25, z], [x + 3.9, 3.32, z + 0.13], white);
  }
  // End stands retain the original shallow terraces behind brick/blue perimeter walls.
  for (const [a0, a1] of [
    [0, southA],
    [southB, TAU],
  ])
    for (let i = 0; i < 220; i++) {
      const a = a0 + ((a1 - a0) * i) / 220,
        b = a0 + ((a1 - a0) * (i + 1)) / 220,
        p = roofPoint(a, 0.97),
        q = roofPoint(b, 0.97),
        n = [Math.sin(a), 0, Math.cos(a)];
      if (Math.sin(a) > 0.75 && p[2] > -48.5 && p[2] < 50) continue;
      face(
        out,
        'brick',
        [
          [p[0], 0, p[2]],
          [q[0], 0, q[2]],
          [q[0], 4.2, q[2]],
          [p[0], 4.2, p[2]],
        ],
        brick,
        n,
      );
      face(
        out,
        'metal',
        [
          [p[0], 4.2, p[2]],
          [q[0], 4.2, q[2]],
          [q[0], 15.2, q[2]],
          [p[0], 15.2, p[2]],
        ],
        blue,
        n,
      );
      if (i % 8 === 0) {
        const o = transformed(out, a, [p[0], 0, p[2]]);
        box(o, 'metal', [-1.3, 0.1, 0.05], [1.3, 2.6, 0.25], steel);
        for (let yy = 2.8; yy < 15; yy += 1.8)
          box(o, 'metal', [-1.6, yy, 0.07], [1.6, yy + 0.08, 0.13], white);
      }
    }
  // 2013 North Stand wedge follows the mapped Somerville Drive frontage.
  const backA = [100.65881, -48.52811],
    backB = [112.29419, 50.01863];
  for (let i = 0; i < 66; i++) {
    const t = i / 66,
      u = (i + 1) / 66,
      p = backA.map((v, k) => v + (backB[k] - v) * t),
      q = backA.map((v, k) => v + (backB[k] - v) * u),
      base = 2.4 + 1.6 * t,
      top = base + 9;
    face(
      out,
      'metal',
      [
        [p[0], base, p[1]],
        [q[0], base + 1.6 / 66, q[1]],
        [q[0], top + 1.6 / 66, q[1]],
        [p[0], top, p[1]],
      ],
      i % 3 ? blue : [0.12, 0.28, 0.43],
      [1, 0, 0],
    );
    face(
      out,
      'seam',
      [
        [96, 11.2, p[1]],
        [p[0], top, p[1]],
        [q[0], top + 1.6 / 66, q[1]],
        [96, 11.2, q[1]],
      ],
      white,
      [0, 1, 0],
    );
    if (i % 11 < 6)
      face(
        out,
        'concrete',
        [
          [p[0], 0, p[1]],
          [q[0], 0, q[1]],
          [q[0], base + 1.6 / 66, q[1]],
          [p[0], base, p[1]],
        ],
        concrete,
        [1, 0, 0],
      );
    else
      face(
        out,
        'metal',
        [
          [p[0] - 0.2, 0, p[1]],
          [q[0] - 0.2, 0, q[1]],
          [q[0] - 0.2, base + 1.6 / 66, q[1]],
          [p[0] - 0.2, base, p[1]],
        ],
        steel,
        [1, 0, 0],
      );
    if (i % 6 === 0)
      box(
        out,
        'plastic',
        [p[0] + 0.04, base + 0.6, p[1] - 0.045],
        [p[0] + 0.13, top - 0.6, p[1] + 0.045],
        [0.81, 0.81, 0.65],
      );
  }
  for (const [x, z, y] of [
    [100.65881, -48.52811, 11.4],
    [112.29419, 50.01863, 13],
  ])
    face(
      out,
      'metal',
      [
        [96, 0, z],
        [x, 0, z],
        [x, y, z],
        [96, 11.2, z],
      ],
      blue,
      [0, 0, z > 0 ? 1 : -1],
    );
  radialSlab(
    out,
    (a, y) => {
      const p = roofPoint(a, 0.97);
      return [p[0], y, p[2]];
    },
    (a, y) => {
      const p = roofPoint(a, 1);
      return [p[0] * 1.022, y, p[2] * 1.022];
    },
    0,
    0.2,
    'brick',
    brick,
  );
}
export function buildHampden(out) {
  bowl(out);
  facade(out);
  roof(out);
}
export const hampdenStudy = {
  id: 'N0689',
  key: 'hampden_park',
  wikidataId: 'Q193651',
  title: 'Hampden Park',
  build: buildHampden,
  metricTriangleUv: true,
  smoothNormalSlots: [],
  previewGroundless: true,
  previewCamera: { position: [-246, 143, 245], lookAt: [0, 9, 0] },
  size: [250, 40, 300],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch centroid, native +Z toward the east goal and +X toward the North Stand. Y0 is the public South Stand forecourt; the pitch is reconstructed 4.2m below it.',
  },
  visualBrief:
    'Hampden’s retained broad shallow oval terraces, low north/east/west roofs and taller two-tier South Stand; 84 exposed weathered cantilever frames above pale roof panels, brick and silver facade, round blue entrance turrets and smaller stair projections, North Stand wedge extension, red/blue seating with white Hampden lettering and saltire ends, opposing video boards and a marked football field.',
  sourceFacts: {
    basis:
      'Four individually mapped grandstands and the current pitch determine the directed plan. The operator’s current entrance photo and 2024 Rangers club aerial show exposed brown roof frames above pale roof sheets, five South Stand window bands, round blue turrets, brick bases and curved wall. The official hospitality brochure confirms the two decks/skyboxes and white HAMPDEN/saltire seating patterns. Glasgow planning report12/00988/DC records the 103m North Stand extension,9m upper facade,2.4–4m undercroft,11.2–13m total gables, blue aluminum cladding and9.2m concrete panels. Other story/roof/field heights are photographic reconstructions, not survey measurements.',
  },
  referencePages: [
    'https://www.hampdenpark.co.uk/',
    'https://www.hampdenpark.co.uk/assets/media/Hampden-Events/204156-sod-ham-hospev-brochure-2-compressed.pdf',
    'https://www.rangers.co.uk/article/scottish-gas-womens-scottish-cup-semi-final-draw/6uMdNS86oUdoBYZyUalNjF',
    'https://www.scottishfa.co.uk/en/news/hampden-park-joins-european-elite-on-the-big-screens',
    'https://onlineservices.glasgow.gov.uk/CouncillorsandCommittees/viewSelectedDocument.asp?c=P62AFQ81T1DXZ30G',
    'https://www.openstreetmap.org/way/202317415',
    'https://www.openstreetmap.org/way/202317409',
    'https://www.openstreetmap.org/way/202317413',
    'https://www.openstreetmap.org/way/202317417',
    'https://www.openstreetmap.org/way/58216903',
  ],
  referenceRights:
    'Original component-authored mesh. Published photographs/plans are evidence only; no photographic pixels, external font or downloaded model are embedded. Projected OpenStreetMap coordinates retain contributor attribution, ODbL1.0.',
  portableReviewBasis:
    'Ground-free review preserves the below-forecourt bowl; the actual world-viewer terrain cutter protects its playing field.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: hampdenPlan.anchor,
    heading: hampdenPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the public forecourt at the entrance turret feet. The relative playing-field depression is reconstructed from the exterior/terrace section; it is intentional below-contact geometry.',
    source: 'https://www.openstreetmap.org/way/202317415',
    featureIds: [
      'way/202317409',
      'way/202317413',
      'way/202317415',
      'way/202317417',
      'way/58216903',
    ],
    groundCutout: {
      outline: Array.from({ length: 180 }, (_, i) => {
        const p = roofPoint((i * TAU) / 180, 0.975);
        return [p[0], p[2]];
      }),
      basis:
        'Cut inside the enclosed stadium walls to retain the below-forecourt football floor and lower seating. The perimeter paving closes the terrain edge.',
    },
    notes:
      'The current pitch polygon supplies origin and the eastward directed long axis; the South Stand turrets sit on native−X, resolving the 180-degree ambiguity. Separate actual building ways avoid the much larger stadium parcel and neighboring Lesser Hampden. The North Stand extension retains its mapped oblique street frontage.',
  },
  limitations: [
    'Detailed current exterior in a static football configuration. Story and roof heights outside the published North Stand extension, local pitch-to-forecourt grade, frame junctions, individual chair count and minor glazing divisions are reconstructed from primary photographs. Temporary sponsor graphics, staff rooms and inaccessible enclosed interiors are outside this exterior scope. The proposed future redevelopment is not represented.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-south-entrance', position: [-155, 13, 16], lookAt: [-114, 13, 7] },
    { name: 'near-turret', position: [-141, 22, 57], lookAt: [-119, 17, 35] },
    { name: 'near-south-windows', position: [-135, 12, 90], lookAt: [-102, 12, 70] },
    { name: 'near-exposed-roof', position: [-97, 49, 58], lookAt: [-65, 25, 37] },
    { name: 'near-north-extension', position: [142, 10, 18], lookAt: [106, 7, 1] },
    { name: 'near-hampden-bowl', position: [-15, 1, 3], lookAt: [73, 7, 0] },
    { name: 'near-saltire-screen', position: [0, 3, 68], lookAt: [0, 10, 122] },
    { name: 'near-south-upper', position: [12, 6, -25], lookAt: [-84, 14, 0] },
    { name: 'far-oval', position: [182, 160, 244], lookAt: [0, 8, 0] },
  ],
};
