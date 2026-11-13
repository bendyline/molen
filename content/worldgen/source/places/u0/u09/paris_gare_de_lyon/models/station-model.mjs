import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildClockTower, towerSurfaces } from './clock-tower.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const stationSurfaces = {
  ...towerSurfaces,
  roofing: { slot: 'roof', graph: 'metal_standing_seam' },
  shedGlass: { slot: 'roof', graph: 'window_grid' },
  paving: towerSurfaces.trim,
  cladding: { slot: 'wall', graph: 'concrete_panel' },
};
const detailOf = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const palette = {
  limestone: '#cfbea3',
  trim: '#e3d8c3',
  slate: '#6c747a',
  glass: '#5a666e',
  metal: '#5c625c',
  roofing: '#81908c',
  shedGlass: '#bdc9c2',
  paving: '#b7ab96',
  cladding: '#c3bfb4',
  dark: '#5c554b',
  warm: '#bca995',
  shadow: '#787a70',
  brass: '#b2945b',
  annexGlass: '#71858a',
  white: '#e1dbcf',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, hex]) => [
    k,
    [...hex.slice(1).matchAll(/../g)].map(([pair]) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  pt = ([x, z], y) => [x, y, z],
  mix = (a, b, t) => a + (b - a) * t;
function face(out, slot, points, expected, tint = slot) {
  const n = normalFor(...points.slice(0, 3)),
    forward = n.reduce((s, v, i) => s + v * expected[i], 0) > 0;
  out.addConvexPolygon(
    slot,
    ref,
    forward ? points : points.toReversed(),
    forward ? n : n.map((v) => -v),
    (p) => [p[0], p[2]],
    colors[tint],
  );
}
const block = (out, slot, x0, z0, x1, z1, y0, y1, tint = slot) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], colors[tint]);
function edge(a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    x = (b[0] - a[0]) / l,
    z = (b[1] - a[1]) / l;
  return { l, n: [z, 0, -x], p: (u, y, w = 0) => [a[0] + u * x + w * z, y, a[1] + u * z - w * x] };
}
function panel(out, f, slot, a, b, c, d, w = 0, tint = slot) {
  if (b - a < 0.03 || d - c < 0.03) return;
  face(
    out,
    slot,
    [
      [a, c],
      [b, c],
      [b, d],
      [a, d],
    ].map(([u, y]) => f.p(u, y, w)),
    f.n,
    tint,
  );
}
function trimBand(out, f, a, b, y, h, w) {
  panel(out, f, 'trim', a, b, y, y + h, w);
  for (const [top, sign] of [
    [y, -1],
    [y + h, 1],
  ])
    face(out, 'trim', [f.p(a, top), f.p(b, top), f.p(b, top, w), f.p(a, top, w)], [0, sign, 0]);
}
function window(out, f, u, y, w, h, detail, tint = 'glass') {
  const a = u - w / 2,
    b = u + w / 2;
  panel(out, f, 'glass', a, b, y, y + h, 0.037, tint);
  if (detail >= 2) {
    trimBand(out, f, a - 0.16, b + 0.16, y - 0.17, 0.12, 0.12);
    panel(out, f, 'trim', a - 0.15, b + 0.15, y + h + 0.02, y + h + 0.19, 0.095);
    panel(out, f, 'metal', u - 0.045, u + 0.045, y, y + h, 0.056);
  }
}
function arch(out, f, u, r, spring, base, top, detail) {
  const n = detail >= 3 ? 16 : detail >= 2 ? 11 : 6,
    depth = -0.44;
  const curve = (radius, rise) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [u - radius * Math.cos(a), spring + rise * Math.sin(a)];
    });
  const inner = curve(r, r * 0.73),
    outer = curve(r + 0.37, r * 0.73 + 0.31);
  panel(out, f, 'glass', u - r, u + r, base, spring, depth);
  face(
    out,
    'glass',
    inner.map((p) => f.p(...p, depth)),
    f.n,
  );
  for (let i = 1; i < inner.length; i++) {
    const [a, b] = [inner[i - 1], inner[i]];
    face(
      out,
      'limestone',
      [a, b, [b[0], top], [a[0], top]].map((p) => f.p(...p)),
      f.n,
    );
    face(
      out,
      'trim',
      [a, b, outer[i], outer[i - 1]].map((p) => f.p(...p, 0.135)),
      f.n,
    );
    face(out, 'trim', [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)], [0, -1, 0]);
  }
  for (const sign of [-1, 1]) {
    const x = u + sign * r;
    face(
      out,
      'trim',
      [f.p(x, base), f.p(x, spring), f.p(x, spring, depth), f.p(x, base, depth)],
      [-sign * f.n[2], 0, sign * f.n[0]],
    );
    panel(out, f, 'trim', sign < 0 ? x - 0.31 : x, sign < 0 ? x : x + 0.31, base, spring, 0.134);
  }
  if (detail >= 2) {
    for (const q of [-0.49, 0, 0.49])
      panel(
        out,
        f,
        'metal',
        u + q * r - 0.055,
        u + q * r + 0.055,
        base,
        spring + r * 0.49,
        depth + 0.03,
      );
    panel(out, f, 'metal', u - r, u + r, spring - 0.058, spring + 0.064, depth + 0.03);
    trimBand(out, f, u - r - 0.15, u + r + 0.15, base - 0.18, 0.15, 0.26);
  }
}
function frontBuilding(out, detail) {
  const x0 = -108.03,
    x1 = -92.58,
    z0 = 1.2,
    z1 = 89.15,
    f = edge([x0, z1], [x0, z0]);
  const top = 23.54;
  for (const [a, b] of [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
  ]) {
    const e = edge(a, b);
    panel(out, e, 'limestone', 0, e.l, -6.4, top);
    if (detail && e.l < 30)
      for (let u = 2; u < e.l - 1; u += 3.75) {
        window(out, e, u, 5.55, 1.24, 3.08, detail);
        window(out, e, u, 16.45, 1.4, 3.39, detail);
      }
  }
  panel(out, f, 'limestone', 0, f.l, -6.4, 5.85);
  const centers = [14, 26.35, 38.7, 51.05, 63.4, 75.75].map((z) => z1 - z).sort((a, b) => a - b);
  let from = 0;
  for (const u of centers) {
    panel(out, f, 'limestone', from, u - 4.02, 5.85, 16.93);
    if (detail) arch(out, f, u, 4.02, 11.35, 5.85, 16.93, detail);
    else {
      panel(out, f, 'glass', u - 4.02, u + 4.02, 5.85, 13.83, -0.016);
      panel(out, f, 'limestone', u - 4.02, u + 4.02, 13.83, 16.93);
    }
    from = u + 4.02;
    if (detail)
      for (const off of [-2.7, 0, 2.7]) window(out, f, u + off, 18.16, 1.25, 2.91, detail);
  }
  panel(out, f, 'limestone', from, f.l, 5.85, 16.93);
  panel(out, f, 'limestone', 0, f.l, 16.93, top);
  for (const [y, h] of [
    [4.92, 0.33],
    [16.95, 0.36],
    [21.64, 0.31],
    [22.81, 0.61],
  ])
    trimBand(out, f, 0, f.l, y, h, 0.41);
  if (detail)
    for (const u of centers) {
      for (const off of [-2.7, 0, 2.7]) window(out, f, u + off, -1.0, 1.77, 4.25, detail, 'dark');
      if (detail >= 2)
        for (const off of [-5.04, 5.04])
          trimBand(out, f, u + off - 0.26, u + off + 0.26, 5.54, 11.25, 0.25);
    }
  const roof0 = [
    [x0 - 0.25, z0 - 0.32],
    [x1 + 0.22, z0 - 0.32],
    [x1 + 0.22, z1 + 0.25],
    [x0 - 0.25, z1 + 0.25],
  ];
  const roof1 = [
    [x0 + 3.6, z0 + 3.4],
    [x1 - 3.3, z0 + 3.4],
    [x1 - 3.3, z1 - 3.4],
    [x0 + 3.6, z1 - 3.4],
  ];
  for (let i = 0; i < 4; i++)
    face(
      out,
      'slate',
      [
        pt(roof0[i], top),
        pt(roof0[(i + 1) % 4], top),
        pt(roof1[(i + 1) % 4], 29.76),
        pt(roof1[i], 29.76),
      ],
      [0, 1, 0],
    );
  face(
    out,
    'slate',
    roof1.map((p) => pt(p, 29.76)),
    [0, 1, 0],
  );
  if (detail >= 2)
    for (const u of centers) {
      const z = z1 - u;
      block(out, 'trim', -106.53, z - 1.02, -104.0, z + 1.02, 25.11, 27.72);
      block(out, 'slate', -106.66, z - 1.16, -103.94, z + 1.16, 27.72, 27.91);
      const f = edge([-106.57, z + 1.05], [-106.57, z - 1.05]);
      arch(out, f, 1.05, 0.62, 26.74, 25.41, 27.66, 2);
    }
  const p = layout.canopy,
    y = 4.75;
  face(
    out,
    'roofing',
    p.map((a) => pt(a, y)),
    [0, 1, 0],
  );
  face(
    out,
    'metal',
    p.map((a) => pt(a, y - 0.15)),
    [0, -1, 0],
  );
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      out,
      'metal',
      [pt(a, y - 0.15), pt(b, y - 0.15), pt(b, y), pt(a, y)],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  for (const z of detail ? [8, 18.5, 29, 39.5, 50, 60.5, 71, 77] : [8, 31, 54, 77])
    block(out, 'metal', -112.22, z - 0.11, -111.96, z + 0.11, -4.6, y - 0.11);
  const apron = layout.rampProfile;
  for (let i = 1; i < apron.length; i++) {
    const [z0, y0] = apron[i - 1],
      [z1, y1] = apron[i];
    face(
      out,
      'paving',
      [
        [-116.1, y0, z0],
        [-116.1, y1, z1],
        [-107.9, -0.98, z1],
        [-107.9, -0.98, z0],
      ],
      [0, 1, 0],
    );
  }
}
function cap(out, shape, slot, tint) {
  for (const t of shape.triangles)
    face(
      out,
      slot,
      t.map((i) => {
        const [x, z, y] = shape.vertices[i];
        return [x, y, z];
      }),
      [0, 1, 0],
      tint,
    );
}
function volumes(out, detail) {
  for (const v of layout.volumes) {
    const y = v.vertices[0][2],
      stone = v.appearance === 'stone';
    cap(out, v, stone ? 'slate' : 'roofing', stone ? 'slate' : 'roofing');
    for (const r of v.rings)
      for (let i = 0; i < r.length; i++) {
        const f = edge(r[i], r[(i + 1) % r.length]);
        panel(out, f, stone ? 'limestone' : 'cladding', 0, f.l, -7.4, y);
        if (!detail || f.l < 4) continue;
        if (stone) {
          for (const level of [5, 11.5, 18.6, 23.45])
            panel(out, f, 'trim', 0, f.l, level, level + 0.27, 0.053);
          const n = Math.max(1, Math.round(f.l / (detail === 1 ? 6.3 : 4.15)));
          for (let j = 0; j < n; j++)
            for (const q of [1.7, 8.02, 14.5, 19.7])
              window(out, f, (f.l * (j + 0.5)) / n, q, 1.5, 2.63, detail);
        } else {
          for (const q of y > 20 ? [2.5, 8.2, 14.1, 19.8] : [2.3, 7.8]) {
            panel(out, f, 'glass', 0.28, f.l - 0.28, q, q + 3.42, 0.06, 'annexGlass');
            panel(out, f, 'trim', 0, f.l, q + 3.48, q + 3.68, 0.11);
          }
        }
      }
  }
}
function roofPoint(x, span, a, drop = 0) {
  const { hall } = layout,
    t = Math.max(0, Math.min(1, (x - hall.start) / (hall.end - hall.start)));
  const z0 = mix(hall.front[span], hall.back[span], t),
    z1 = mix(hall.front[span + 1], hall.back[span + 1], t);
  const roof = mix(24.13, hall.peak, Math.max(0, Math.min(1, (x + 93.22) / (hall.start + 93.22))));
  return [
    x,
    hall.eave + (roof - hall.eave) * Math.sin(a) - drop,
    (z0 + z1) / 2 - ((z1 - z0) / 2) * Math.cos(a),
  ];
}
function hallRoof(out, detail) {
  const { hall, posts } = layout,
    n = [7, 9, 13, 24, 28][detail];
  for (const [x0, x1] of [
    [-93.22, hall.start],
    [hall.start, hall.end],
  ])
    for (let span = 0; span < 2; span++)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n,
          u = (i + 0.5) / n;
        const gl = (u > 0.23 && u < 0.43) || (u > 0.57 && u < 0.77),
          slot = gl ? 'shedGlass' : 'roofing';
        for (const [drop, sign] of [
          [0, 1],
          [0.19, -1],
        ]) {
          face(
            out,
            slot,
            [
              roofPoint(x0, span, a, drop),
              roofPoint(x1, span, a, drop),
              roofPoint(x1, span, b, drop),
              roofPoint(x0, span, b, drop),
            ],
            [0, sign, 0],
            drop && !gl ? 'shadow' : slot,
          );
        }
        for (const [x, sign] of [
          [x0, -1],
          [x1, 1],
        ]) {
          if (x === hall.start) continue;
          face(
            out,
            'metal',
            [
              roofPoint(x, span, a),
              roofPoint(x, span, b),
              roofPoint(x, span, b, 0.19),
              roofPoint(x, span, a, 0.19),
            ],
            [sign, 0, 0],
          );
        }
      }
  for (const [i, r] of posts.entries()) {
    if ((detail === 0 && i % 5 !== 0) || (detail === 1 && i % 3 !== 0 && i !== 15)) continue;
    for (const [j, z] of r.z.entries()) {
      const y = r.feet[j],
        w = j === 1 ? 0.35 : 0.39;
      block(out, 'metal', r.x - w, z - w, r.x + w, z + w, y, hall.eave + 0.09);
      if (detail >= 2)
        block(out, 'trim', r.x - w - 0.13, z - w - 0.12, r.x + w + 0.13, z + w + 0.12, y, y + 0.69);
    }
    if (detail === 0) continue;
    for (let span = 0; span < 2; span++)
      for (let j = 0; j < n; j++) {
        const p = roofPoint(r.x, span, (j * Math.PI) / n, 0.42),
          q = roofPoint(r.x, span, ((j + 1) * Math.PI) / n, 0.42);
        beam(out, 'metal', p, q, 0.18, 0.29, colors.metal);
        if (detail >= 3) {
          const a = roofPoint(r.x, span, (j * Math.PI) / n, 0.81),
            b = roofPoint(r.x, span, ((j + 1) * Math.PI) / n, 0.81);
          beam(out, 'metal', a, b, 0.13, 0.15, colors.metal);
          beam(out, 'metal', j % 2 ? a : p, j % 2 ? q : b, 0.095, 0.12, colors.metal);
        }
      }
  }
  if (detail >= 2)
    for (let span = 0; span < 2; span++)
      for (const i of [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1]) {
        const a = roofPoint(hall.start, span, i * Math.PI, 0.31),
          b = roofPoint(hall.end, span, i * Math.PI, 0.31);
        beam(out, 'metal', a, b, 0.15, 0.19, colors.metal);
      }
}
function publicDecks(out, detail) {
  const {
    x: [x0, x1],
    z: [z0, z1],
    floorY,
  } = layout.concourse;
  block(out, 'paving', x0, z0, x1, z1, -5.6, floorY);
  if (!detail) return;
  for (const platform of detail === 1 ? layout.districtPlatforms : layout.platforms) {
    cap(out, platform, 'paving', 'paving');
    if (detail < 2) continue;
    const outer = platform.rings[0];
    for (let i = 0; i < outer.length; i++) {
      const [x, z, y] = platform.vertices[i],
        [a, b, h] = platform.vertices[(i + 1) % outer.length];
      face(
        out,
        'paving',
        [
          [x, y - 1.12, z],
          [a, h - 1.12, b],
          [a, h, b],
          [x, y, z],
        ],
        [b - z, 0, x - a],
        'warm',
      );
    }
  }
}
export function buildStationLevel(out, level) {
  const detail = detailOf[level];
  if (detail === undefined) throw Error('Unknown Gare de Lyon level ' + level);
  buildClockTower(out, detail);
  frontBuilding(out, detail);
  volumes(out, detail);
  hallRoof(out, detail);
  publicDecks(out, detail);
}
export const buildStationSkyline = (out) => buildStationLevel(out, 'skyline');
export const buildStationDistrict = (out) => buildStationLevel(out, 'district');
export const buildStationStreet = (out) => buildStationLevel(out, 'street');
export const buildStationCloseup = (out) => buildStationLevel(out, 'closeup');
