import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [13.340500295162201, 47.079574985917674],
  heading: 0.23832410381192595,
  datum: 1892.17406225,
  crestElevation: 1906.2,
  foundation: 1706.2,
  normalPool: 1902,
  crest: [
    [-338.463515, 129.109906],
    [-331.46915, 123.2789],
    [-299.98294, 97.02973],
    [-278.29784, 80.11757],
    [-273.73333, 76.83226],
    [-248.35892, 58.51476],
    [-241.43458, 54.12879],
    [-222.33264, 41.82044],
    [-182.7234, 20.89323],
    [-163.59361, 12.77668],
    [-135.8941, 2.97569],
    [-107.97471, -3.42394],
    [-84.27266, -6.24474],
    [-66.67333, -7.20023],
    [-43.7873, -6.66211],
    [-15.6034, -2.95373],
    [0, 0],
    [17.78795, 5.1584],
    [45.12458, 14.93824],
    [75.30325, 29.38416],
    [104.36115, 45.8595],
    [133.83653, 65.78418],
    [166.30352, 90.62058],
    [191.54482, 111.60914],
    [201.68284, 123.2789],
    [207.654875, 130.153242],
  ],
  airwalk: {
    poi: [-2.75278, 8.74719],
    deckY: 1902.8,
    floorOutline: [
      [-9.40025, 10.2709],
      [-7.41886, 11.58924],
      [-2.63447, 11.70535],
      [0.33484, 13.26369],
      [1.9635, 13.45011],
      [3.73058, 12.20546],
      [8.08633, 7.19559],
      [5.85, 6.9],
      [-8.85, 6.12],
    ],
    glass: [
      [-5.85, 9.28],
      [-5.5, 10.52],
      [-2.68, 10.65],
      [0.65, 12.08],
      [1.7, 12.16],
      [3, 11.19],
      [4.02, 9.94],
    ],
    deckTriangles: [
      10, 11, 12, 9, 0, 8, 9, 8, 7, 9, 7, 6, 6, 5, 4, 4, 3, 2, 2, 1, 0, 0, 9, 10, 0, 10, 12, 15, 9,
      6, 15, 6, 4, 2, 0, 12, 14, 15, 4, 4, 2, 12, 4, 12, 13, 4, 13, 14,
    ],
    glassTriangles: [1, 0, 6, 6, 5, 4, 6, 4, 3, 6, 3, 2, 6, 2, 1],
    stairs: [
      [-4.52207, 2.2493],
      [3.57879, 4.21733],
      [-6.18536, 11.67966],
      [0.33484, 13.26369],
    ],
  },
  houses: [
    {
      id: 35184604540519,
      outline: [
        [-83.29846, 58.64862],
        [-69.59718, 57.37381],
        [-68.33362, 69.39856],
        [-82.0349, 70.67337],
      ],
      height: 4.6,
      floor: 1733.6993,
    },
    {
      id: 35184604540521,
      outline: [
        [-56.84163, 91.85962],
        [-54.37125, 85.13614],
        [-51.30594, 86.29932],
        [-53.77632, 93.0228],
      ],
      height: 3.4,
      floor: 1722.4908,
    },
  ],
  buttress: {
    h: 1776.2,
    span: [-144, 37],
    toe: [-154, 58],
    radius: 35,
  },
};
const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.55, 0.542, 0.499] },
  trim: { slot: 'trim', graph: 'concrete_plain', rgb: [0.67, 0.645, 0.586] },
  deck: { slot: 'wall', graph: 'concrete_plain', rgb: [0.47, 0.47, 0.435] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.21, 0.249, 0.266] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.339, 0.367, 0.361] },
  glazing: { slot: 'window', graph: 'window_grid', rgb: [0.18, 0.239, 0.26] },
  glass: {
    slot: 'window',
    graph: 'glass_frit_triangular',
    rgb: [0.67, 0.82, 0.83],
    alphaMode: 'BLEND',
    baseColorFactor: [0.77, 0.92, 0.93, 0.28],
    doubleSided: true,
    roughness: 0.2,
  },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([m, { rgb, ...surface }]) => [m, surface]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, crestElevation: top, foundation, crest, airwalk, houses, buttress } = controls;
const first = crest[0][0],
  last = crest.at(-1)[0];
const p = (x, h, z) => [x, h - datum, z];
const profile = [
  [foundation, -51, 0.19, 50, 18],
  [1748, -50, 0.33, 34, 18.6],
  [1776.2, -49, 0.45, 27, 16.8],
  [1814, -47, 0.58, 18, 13.4],
  [1849, -45, 0.73, 11, 9.8],
  [1884, -50, 0.88, 5, 6],
  [top, -60, 1, 0, 3.8],
];
const lerp = (a, b, t) => a + (b - a) * t;
function interpolate(rows, t) {
  let i = 1;
  while (i < rows.length - 1 && t > rows[i][0]) i++;
  const [a, b] = [rows[i - 1], rows[i]],
    u = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((x, k) => lerp(x, b[k + 1], u));
}
export function archPoint(u, h, side = 0) {
  const [c, w, z, t] = interpolate(profile, h),
    [curve] = interpolate(crest, u);
  return p(c + (u + 60) * w, h, curve * w + z + side * t);
}
function face(out, m, pts, n, rgb = palette[m].rgb) {
  let normal = normalFor(...pts);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    pts = pts.toReversed();
    normal = normalFor(...pts);
  }
  const add = pts.length === 3 ? out.addTriangle : out.addQuad;
  add.call(out, m, 'palette:#ffffff', pts, normal, undefined, rgb);
}
const q = (out, m, a, b, c, d, n, rgb) => face(out, m, [a, b, c, d], n, rgb);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
function arch(out, d) {
  const rows = d === 0 ? profile.filter((_, i) => i !== 1 && i !== 4) : profile;
  const stations = crest.filter((_, i) => d > 0 || i % 2 === 0 || i === crest.length - 1);
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1][0],
      b = stations[i][0];
    for (const s of [-1, 1])
      for (let j = 1; j < rows.length; j++) {
        const [h] = rows[j - 1],
          [k] = rows[j];
        const f = (i % 4 === 0 ? 0.91 : i % 7 === 0 ? 1.1 : 1) * (k < 1777 ? 0.81 : 1);
        q(
          out,
          'body',
          archPoint(a, h, s),
          archPoint(b, h, s),
          archPoint(b, k, s),
          archPoint(a, k, s),
          [0, 0, s],
          palette.body.rgb.map((v) => v * f),
        );
      }
    q(
      out,
      'deck',
      archPoint(a, top, -1),
      archPoint(b, top, -1),
      archPoint(b, top, 1),
      archPoint(a, top, 1),
      [0, 1, 0],
    );
    const rim = (u, s, h) => {
      const [x, , z] = archPoint(u, top, s);
      return p(x, h, z - s * 0.075);
    };
    q(
      out,
      'trim',
      rim(a, -1, top),
      rim(b, -1, top),
      rim(b, -1, top + 0.9),
      rim(a, -1, top + 0.9),
      [0, 0, -1],
    );
    q(
      out,
      'trim',
      rim(b, -1, top),
      rim(a, -1, top),
      rim(a, -1, top + 0.9),
      rim(b, -1, top + 0.9),
      [0, 0, 1],
    );
    if (d > 0)
      for (const [l, r] of [
        [a, Math.min(b, airwalk.stairs[0][0])],
        [Math.max(a, airwalk.stairs[1][0]), b],
      ]) {
        if (r <= l) continue;
        rod(out, 'steel', rim(l, 1, top + 0.88), rim(r, 1, top + 0.88), 0.095, 0.108);
        if (d > 1)
          for (let x = l + 0.13; x < r; x += 3.7)
            rod(out, 'steel', rim(x, 1, top + 0.01), rim(x, 1, top + 0.88), 0.075, 0.079);
      }
  }
  for (const [x, s] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < rows.length; i++) {
      const [a] = rows[i - 1],
        [b] = rows[i];
      q(
        out,
        'body',
        archPoint(x, a, -1),
        archPoint(x, a, 1),
        archPoint(x, b, 1),
        archPoint(x, b, -1),
        [s, 0, 0],
      );
    }
  if (d > 2)
    for (let i = 2; i < crest.length - 2; i += 2) {
      const [x] = crest[i];
      const p = (u, h) => archPoint(u, h, 1).map((v, k) => (k === 2 ? v + 0.062 : v));
      for (let j = 3; j < profile.length; j++) {
        const [a] = profile[j - 1],
          [b] = profile[j];
        q(
          out,
          'body',
          p(x - 0.042, a),
          p(x + 0.042, a),
          p(x + 0.042, b),
          p(x - 0.042, b),
          [0, 0, 1],
          [0.48, 0.473, 0.442],
        );
      }
    }
}
export function buttressPoint(t, i) {
  const low = [[-154, 58], 1706.2, 93, 30],
    middle = [[-140, 49], 1726.8, 66, 24],
    shoulder = [[-132, 37], 1750.4, 53, 20],
    head = [buttress.span, buttress.h, 43.6, 15.5];
  const [span, h, z, delta] = [low, middle, shoulder, head][i];
  const x = lerp(span[0], span[1], t),
    bend = delta * (t - 0.53) * (t - 0.53) * 4;
  return p(x, h, z + bend);
}
function thrustBlock(out, d) {
  const steps = d === 0 ? 7 : d === 1 ? 12 : 20;
  for (let j = 1; j <= steps; j++) {
    const u = (j - 1) / steps,
      v = j / steps;
    for (let i = 1; i < 4; i++) {
      const A = buttressPoint(u, i - 1),
        B = buttressPoint(v, i - 1),
        C = buttressPoint(v, i),
        D = buttressPoint(u, i);
      q(
        out,
        'body',
        A,
        B,
        C,
        D,
        [0, 1, 1],
        palette.body.rgb.map((c) => c * (i === 3 ? 0.91 : 0.83)),
      );
    }
    const a = buttressPoint(u, 3),
      b = buttressPoint(v, 3);
    const c = b.map((x, i) => (i === 2 ? x - 8.8 : x)),
      e = a.map((x, i) => (i === 2 ? x - 8.8 : x));
    q(out, 'trim', a, b, c, e, [0, 1, 0]);
    if (d > 1)
      rod(
        out,
        'steel',
        a.map((x, i) => (i === 1 ? x + 0.57 : x)),
        b.map((x, i) => (i === 1 ? x + 0.57 : x)),
        0.075,
        0.083,
      );
  }
  for (const [t, s] of [
    [0, -1],
    [1, 1],
  ])
    for (let i = 1; i < 4; i++) {
      const a = buttressPoint(t, i - 1),
        b = buttressPoint(t, i);
      q(
        out,
        'body',
        a,
        b,
        b.map((x, j) => (j === 2 ? x - 14 : x)),
        a.map((x, j) => (j === 2 ? x - 14 : x)),
        [s, 0, 0],
      );
    }
}
function platform(out, d) {
  const { floorOutline, glass, deckTriangles, glassTriangles, stairs, deckY: h } = airwalk,
    deck = [...floorOutline, ...glass];
  const at = (r, H) => p(r[0], H, r[1]);
  const triangles = (m, pts, indices, H) => {
    for (let j = 0; j < indices.length; j += 3)
      face(
        out,
        m,
        indices.slice(j, j + 3).map((i) => at(pts[i], H)),
        [0, 1, 0],
      );
  };
  triangles('steel', deck, deckTriangles, h);
  triangles('glass', glass, glassTriangles, h + 0.016);
  for (const r of [floorOutline, glass])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        n = [b[1] - a[1], 0, a[0] - b[0]];
      q(out, 'steel', at(a, h - 0.29), at(b, h - 0.29), at(b, h), at(a, h), n);
      if (r === glass || i >= 6) continue;
      rod(out, 'steel', at(a, h + 1.16), at(b, h + 1.16), 0.082, 0.091);
      if (d > 0) rod(out, 'steel', at(a, h + 0.6), at(b, h + 0.6), 0.067, 0.074);
      if (d > 1) {
        rod(out, 'steel', at(a, h), at(a, h + 1.2), 0.083, 0.091);
        if (d > 2) {
          const mid = a.map((x, j) => (x + b[j]) / 2);
          rod(out, 'steel', at(mid, h + 0.11), at(mid, h + 1.17), 0.052, 0.067);
        }
      }
    }
  const [topL, topR, botL, botR] = stairs;
  const point = (a, b, t, H) =>
    at(
      a.map((x, i) => lerp(x, b[i], t)),
      H,
    );
  const N = d > 1 ? 20 : 1;
  for (let i = 1; i <= N; i++) {
    const u = (i - 1) / N,
      v = i / N,
      H = lerp(top, h, v),
      K = lerp(top, h, u);
    const a = point(topL, botL, u, d > 1 ? H : K),
      b = point(topR, botR, u, d > 1 ? H : K),
      c = point(topR, botR, v, H),
      e = point(topL, botL, v, H);
    q(out, 'steel', a, b, c, e, [0, 1, 0]);
    if (d > 1) q(out, 'steel', point(topL, botL, u, K), point(topR, botR, u, K), b, a, [0, 0, 1]);
  }
  for (const [a, b] of [
    [topL, botL],
    [topR, botR],
  ]) {
    rod(out, 'steel', at(a, top + 1.08), at(b, h + 1.08), 0.11, 0.1);
    rod(out, 'steel', at(a, top - 0.27), at(b, h - 0.26), 0.27, 0.38);
    if (d > 1)
      for (let i = 0; i <= 5; i++) {
        const t = i / 5,
          H = lerp(top, h, t);
        rod(out, 'steel', point(a, b, t, H - 0.03), point(a, b, t, H + 1.08), 0.075, 0.09);
      }
  }
  for (const [a, b] of [
    [floorOutline[0], [-10.48, 2.68]],
    [floorOutline[5], [8.22, 4.8]],
  ]) {
    rod(out, 'steel', at(b, top - 0.27), at(a, h - 0.2), 0.23, 0.28);
    rod(out, 'steel', at(b, h - 6.4), at(a, h - 0.25), 0.29, 0.38);
    if (d > 2) rod(out, 'steel', at(b, h - 6.4), at(b, top - 0.27), 0.19, 0.24);
  }
  if (d > 3) {
    const mid = glass[2].map((x, i) => (x + glass[6][i]) / 2);
    rod(out, 'steel', at(glass[2], h - 0.014), at(glass[6], h - 0.014), 0.05, 0.08);
    rod(out, 'steel', at(mid, h + 0.02), at(floorOutline[2], h + 0.02), 0.06, 0.075);
  }
}
function cabin(out, d, { outline, floor, height }) {
  const H = floor + height,
    P = ([x, z], y) => p(x, y, z);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    q(out, 'trim', P(a, floor - 2.8), P(b, floor - 2.8), P(b, H), P(a, H), n);
    if (d > 1 && i === 2) {
      const A = a.map((v, j) => lerp(v, b[j], 0.23)),
        B = a.map((v, j) => lerp(v, b[j], 0.72)),
        len = Math.hypot(n[0], n[2]);
      const W = (r, h) => p(r[0] + (n[0] * 0.1) / len, h, r[1] + (n[2] * 0.1) / len);
      q(out, 'glazing', W(A, floor + 1.2), W(B, floor + 1.2), W(B, H - 0.88), W(A, H - 0.88), n);
    }
  }
  q(out, 'roof', ...outline.map((r) => P(r, H)), [0, 1, 0]);
}
export function buildDamLevel(out, name) {
  const d = levels[name];
  if (d === undefined) throw Error('Unknown Koelnbrein Dam detail level: ' + name);
  arch(out, d);
  thrustBlock(out, d);
  platform(out, d);
  for (const h of houses) cabin(out, d, h);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
