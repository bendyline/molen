/** The divided highway crossing of the Don beside the separate railway lift bridge. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  asphalt: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.21 },
};
const palette = {
  road: '686768',
  roadEdge: '76716b',
  white: 'e3e1d4',
  joint: '5e5d57',
  soffit: '958c7a',
  fascia: '806c56',
  rail: 'aab2ac',
  rust: '925739',
  post: '717a77',
  wire: '6d7472',
  foot: 'aaa396',
  concrete: 'a49e90',
  pierDark: '837f71',
  wet: '766c5e',
  bearing: '4d504c',
  light: 'e3e4d0',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, v]) => [
    key,
    v.match(/../g).map((p) => {
      const x = parseInt(p, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0],
  down = [0, -1, 0];
const { a, b, rows, piers } = layout;
const mix = (a, b, t) => a + (b - a) * t;
function at(x) {
  const i = rows.findIndex((r) => r[0] >= x);
  if (i <= 0) return rows[i < 0 ? rows.length - 1 : 0];
  const p = rows[i - 1],
    q = rows[i],
    t = (x - p[0]) / (q[0] - p[0]);
  return p.map((v, j) => mix(v, q[j], t));
}
function pt(x, lateral, lift = 0) {
  const [, y, p, w, e, q] = at(x);
  const lanes = [p, w, e, q],
    n = Math.floor(lateral);
  const z =
    lateral < 0
      ? p + lateral
      : lateral > 3
        ? q + lateral - 3
        : n === 3
          ? q
          : mix(lanes[n], lanes[n + 1], lateral - n);
  return [x, y + lift, z];
}
function quad(out, slot, key, [a, b, c, d], want) {
  for (let p of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...p);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
      p = p.toReversed();
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', p, n, undefined, colors[key]);
  }
}
function strip(out, slot, key, x, u, l, h, m, v, n = up) {
  quad(out, slot, key, [pt(x, l, h), pt(u, l, h), pt(u, m, v), pt(x, m, v)], n);
}
const roadStart = 0.13,
  roadEnd = 2.8;
const rim = [-0.97, 3.98];
const middle = [1.42, 1.56];
function crossSection(out, x, d) {
  const direction = x === a ? -1 : 1;
  const [l, u] = rim;
  quad(
    out,
    'concrete',
    'soffit',
    [pt(x, l, -0.52), pt(x, u, -0.52), pt(x, u, 0.16), pt(x, l, 0.16)],
    [direction, 0, 0],
  );
  if (d > 0)
    for (const [l, u] of [
      [0.37, 0.9],
      [2.1, 2.68],
    ]) {
      quad(
        out,
        'concrete',
        'pierDark',
        [pt(x, l, -2.1), pt(x, u, -2.1), pt(x, u, -0.51), pt(x, l, -0.51)],
        [direction, 0, 0],
      );
    }
}
function deck(out, d) {
  const stations = d === 0 ? rows.filter((_, i) => i % 4 === 0 || i === rows.length - 1) : rows;
  for (let i = 1; i < stations.length; i++) {
    const x = stations[i - 1][0],
      u = stations[i][0];
    strip(out, 'asphalt', 'road', x, u, roadStart, 0, roadEnd, 0);
    strip(out, 'concrete', 'foot', x, u, rim[0], 0.16, roadStart, 0.16);
    strip(out, 'concrete', 'foot', x, u, roadEnd, 0.16, rim[1], 0.16);
    for (const [lo, sign] of [
      [rim[0], -1],
      [rim[1], 1],
    ])
      strip(out, 'concrete', 'fascia', x, u, lo, -0.51, lo, 0.16, [0, 0, sign]);
    strip(out, 'concrete', 'soffit', x, u, rim[0], -0.52, rim[1], -0.52, down);
    for (const [l, r] of [
      [0.37, 0.9],
      [2.1, 2.68],
    ]) {
      const z0 = l + 0.06,
        z1 = r - 0.06;
      strip(out, 'concrete', 'soffit', x, u, l, -0.49, z0, -2.1, [0, 0, -1]);
      strip(out, 'concrete', 'fascia', x, u, r, -0.49, z1, -2.1, [0, 0, 1]);
      strip(out, 'concrete', 'pierDark', x, u, z0, -2.1, z1, -2.1, down);
    }
    if (d >= 1) {
      strip(out, 'concrete', 'roadEdge', x, u, roadStart, 0.16, roadStart, 0, [0, 0, 1]);
      strip(out, 'concrete', 'roadEdge', x, u, roadEnd, 0.16, roadEnd, 0, [0, 0, -1]);
      strip(out, 'concrete', 'soffit', x, u, middle[0], 0.18, middle[1], 0.18);
      for (const [u0, side] of [
        [middle[0], -1],
        [middle[1], 1],
      ])
        strip(out, 'concrete', 'fascia', x, u, u0, 0, u0, 0.18, [0, 0, side]);
    }
  }
  for (const x of [a, b]) crossSection(out, x, d);
  if (d >= 1) {
    for (const l of [roadStart + 0.017, roadEnd - 0.018, 1.36, 1.62]) {
      for (let i = 1; i < stations.length; i++)
        strip(
          out,
          'asphalt',
          'white',
          stations[i - 1][0],
          stations[i][0],
          l - 0.006,
          0.012,
          l + 0.006,
          0.012,
        );
    }
    const spacing = d === 1 ? 24 : 13.4;
    for (let x = a + 3.2; x < b - 5; x += spacing)
      for (const c of [0.69, 1.13, 1.86, 2.28]) {
        strip(
          out,
          'asphalt',
          'white',
          x,
          x + (d === 1 ? 6 : 4.0),
          c - 0.0048,
          0.016,
          c + 0.0048,
          0.016,
        );
      }
  }
  if (d >= 2)
    for (const x of [
      a + 0.37,
      b - 0.43,
      ...piers.filter((_, i) => i === 2 || i === 5).map((p) => p.x),
    ]) {
      strip(out, 'metal', 'bearing', x - 0.08, x + 0.08, roadStart, 0.013, roadEnd, 0.013);
    }
}
function tapered(out, key, rings) {
  loft(
    out,
    'concrete',
    rings.map(([x, y, z, w, d, c]) => chamferedRectangle(x, y, z, w, d, c)),
    colors[key],
  );
}
function pier(out, p, d) {
  const y = at(p.x)[1] - 2.06,
    { x, center: z, base } = p;
  if (d === 0) {
    tapered(out, 'concrete', [
      [x, base, z, 3.75, 15, 0.15],
      [x, y, z, 3.75, 15, 0.15],
    ]);
    return;
  }
  const span = p.end ? 16.5 : 19.25;
  tapered(out, p.river ? 'wet' : 'pierDark', [
    [x, base, z, 4.32, span, 0.49],
    [x, base + 0.65, z, 4.1, span - 0.4, 0.44],
  ]);
  for (const s of [-1, 1]) {
    const z0 = z + s * 5.95,
      h = y - base;
    tapered(out, 'concrete', [
      [x, base + 0.55, z0, 3.6, 4.83, 0.44],
      [x, base + Math.min(2.1, h * 0.2), z0, 3.25, 4.6, 0.45],
      [x, y - 0.74, z0, 2.98, 4.4, 0.44],
      [x, y - 0.49, z0, 3.64, 6.07, 0.48],
      [x, y - 0.26, z0, 3.84, 6.85, 0.4],
    ]);
    if (d >= 2) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const X = x + sx * 0.88,
            Z = z0 + sz * 1.56;
          loft(
            out,
            'metal',
            [
              chamferedRectangle(X, y - 0.27, Z, 0.92, 1.4, 0.09),
              chamferedRectangle(X, y + 0.13, Z, 0.87, 1.38, 0.09),
            ],
            colors.bearing,
          );
        }
      if (p.river && p.grade < 2.3) {
        const top = Math.min(base + 1.37, y - 1);
        tapered(out, 'wet', [
          [x, base + 0.645, z0, 3.58, 4.84, 0.44],
          [x, top, z0, 3.5, 4.77, 0.43],
        ]);
      }
    } else
      tapered(out, 'bearing', [
        [x, y - 0.27, z0, 3.47, 5.5, 0.39],
        [x, y + 0.03, z0, 3.53, 5.41, 0.39],
      ]);
  }
}
function railing(out, d) {
  const stakes = rows.filter((_, i) => i % (d <= 1 ? 2 : 1) === 0 || i === rows.length - 1);
  for (const [l, s] of [
    [rim[0] + 0.09, -1],
    [rim[1] - 0.09, 1],
    [middle[0], -1],
    [middle[1], 1],
  ]) {
    const outer = l < 0 || l > 3,
      height = outer ? 1.22 : 0.84;
    for (let i = 1; i < stakes.length; i++) {
      const x = stakes[i - 1][0],
        u = stakes[i][0];
      strip(out, 'metal', outer ? 'rust' : 'rail', x, u, l, height - 0.13, l, height, [0, 0, s]);
      if (d >= 1) strip(out, 'metal', 'post', x, u, l - 0.034, height, l + 0.034, height);
      if (d >= 2) strip(out, 'metal', 'rail', x, u, l, height - 0.48, l, height - 0.39, [0, 0, s]);
    }
    if (d <= 1) continue;
    const spacing = d === 2 ? 9.5 : d === 3 ? 4.1 : 2.94;
    for (let x = a + 1.3; x < b - 0.6; x += spacing) {
      const p = pt(x, l, outer ? 0.16 : 0.18),
        q = pt(x, l, height);
      beam(out, 'metal', p, q, 0.088, 0.091, colors.post);
    }
  }
}
function lamps(out, d) {
  if (d === 0) return;
  const step = d === 1 ? 58 : 32.2;
  for (let x = a + 18; x < b - 6; x += step)
    for (const s of [-1, 1]) {
      const l = s === -1 ? -0.71 : 3.73,
        p = pt(x, l, 0.16);
      const points = [
        p,
        [p[0], p[1] + 8.1, p[2]],
        [p[0], p[1] + 8.95, p[2] - s * 0.46],
        [p[0], p[1] + 9.2, p[2] - s * 1.46],
      ];
      if (d === 1) {
        const n = [0, 0, s];
        quad(
          out,
          'metal',
          'post',
          [
            [x - 0.075, p[1], p[2]],
            [x + 0.075, p[1], p[2]],
            [x + 0.075, p[1] + 8.8, p[2]],
            [x - 0.075, p[1] + 8.8, p[2]],
          ],
          n,
        );
        quad(
          out,
          'metal',
          'post',
          [
            points[1],
            points[3],
            [x, points[3][1] + 0.13, points[3][2]],
            [x, points[1][1] + 0.13, points[1][2]],
          ],
          [1, 0, 0],
        );
        continue;
      }
      beamPath(out, 'metal', points, 0.106, 0.107, colors.rail);
      const t = points.at(-1);
      loft(
        out,
        'metal',
        [
          radialRing(t[1] - 0.071, 0.12, 0.29, 8, [x, t[2]]),
          radialRing(t[1] + 0.064, 0.124, 0.28, 8, [x, t[2]]),
        ],
        colors.light,
      );
      if (d >= 3)
        loft(
          out,
          'metal',
          [
            radialRing(p[1], 0.205, 0.175, 8, [x, p[2]]),
            radialRing(p[1] + 0.38, 0.12, 0.112, 8, [x, p[2]]),
          ],
          colors.post,
        );
    }
}
export function buildBridgeLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error('Unknown Temernitsky detail level');
  deck(out, d);
  for (const p of piers) pier(out, p, d);
  railing(out, d);
  lamps(out, d);
}
export const buildSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildStreet = (out) => buildBridgeLevel(out, 'street');
export const buildCloseup = (out) => buildBridgeLevel(out, 'closeup');
export const buildMaster = (out) => buildBridgeLevel(out, 'master');
