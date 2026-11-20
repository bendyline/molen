import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  pairs,
  panel,
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  ashlar: 'c6c2b2',
  pale: 'd1cdbb',
  stone: 'b9b8a9',
  base: 'aaa89b',
  red: '99634f',
  coral: 'b8816d',
  shadow: 'b1a999',
  glass: '485450',
  grille: 'bcbdb1',
  drum: 'bdbeb0',
  lead: '647581',
  ridge: '7a8993',
  brass: 'a19663',
  stoneCap: '969891',
  paving: 'b2ac9c',
  marble: 'b5b6ae',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.93),
  footing: surface('foundation', 'stone_ashlar', 0.94),
  brick: surface('wall', 'brick_longformat', 0.93),
  roof: surface('roof', 'metal_standing_seam', 0.72, 0.22),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.01 },
  trim: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.75 },
};
const floor = d.prayerFloor;
const sunk = (p) => Math.min(grade(p) - 0.33, floor - 1.36);
const wEast = 14.163,
  wWest = -14.159,
  qibla = -26.449,
  north = 26.448;
const body = rect(-11.25, -4.5, 11.25, qibla);
const courtBounds = [-7.16, 1.903, 7.162, 19.446];
const rad = ([x, z], r, a) => [x + Math.cos(a) * r, z + Math.sin(a) * r];
const walls = (outline) => pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const solid = (out, outline, lo, hi, slot, color) =>
  shell(out, outline, typeof lo === 'number' ? () => lo : lo, hi, {
    wall: slot,
    roof: slot,
    color,
    roofColor: color,
  });
const round = (out, slot, p, rows, n, color) =>
  loft(
    out,
    slot,
    rows.map(([y, r]) => radialRing(y, r, r, n, p, Math.PI / n)),
    color,
  );
const wall = (x0, z0, x1, z1, sign = 1) => edge([x0, z0], [x1, z1], sign);

function course(out, w, u0, u1, from, to, level, depth = 0.052) {
  if (level === 0) return;
  for (let y = from; y <= to; y += level === 1 ? 0.89 : 0.53) {
    panel(out, 'brick', w, u0, u1, y, y + 0.119, depth, c.red);
  }
}
function cornice(out, w, y, depth = 0.19, width = 0.22, color = c.pale) {
  trimBlock(out, 'trim', w, 0, w.length, y - width * 0.6, y + width * 0.4, 0.003, depth, color);
}

function opening(
  out,
  w,
  u,
  bottom,
  spring,
  r,
  rise,
  level,
  { trim = true, depth = 0.065, grille = false } = {},
) {
  arch(
    out,
    w,
    u,
    bottom,
    spring,
    r,
    rise,
    depth,
    trim && level >= 2 ? level : 0,
    { inner: c.glass, trim: c.pale, width: 0.117 },
    { inner: 'glass', trim: 'trim' },
  );
  if (level >= 2 && grille) {
    const spacing = level === 3 ? 0.21 : 0.29;
    const h = spring + rise;
    for (let y = bottom + 0.18; y < h - 0.105; y += spacing * 0.89) {
      const v = Math.max(0, y - spring) / rise;
      const width = r * Math.sqrt(Math.max(0, 1 - v * v)) - 0.085;
      if (width < 0.065) continue;
      panel(out, 'trim', w, u - width, u + width, y - 0.018, y + 0.018, depth + 0.018, c.grille);
    }
    for (let x = -r + 0.2; x < r - 0.13; x += spacing) {
      const top = spring + rise * Math.sqrt(Math.max(0, 1 - (x / r) * (x / r))) - 0.065;
      panel(
        out,
        'trim',
        w,
        u + x - 0.017,
        u + x + 0.017,
        bottom + 0.018,
        top,
        depth + 0.021,
        c.grille,
      );
    }
  }
}
function circle(out, w, u, y, r, level, depth = 0.073) {
  const n = [6, 8, 12, 16][level];
  const circle = (scale, z) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return w.p(u + Math.cos(a) * r * scale, y + Math.sin(a) * r * scale, z);
    });
  const a = circle(1, depth);
  face(out, 'glass', a, w.normal, c.glass);
  if (level >= 2) {
    const b = circle(1.19, depth + 0.028);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      face(out, 'trim', [a[i], a[j], b[j], b[i]], w.normal, c.pale);
    }
  }
}
function dome(out, p, rx, rz, lo, hi, level, major = false) {
  const n = major ? [10, 16, 28, 40][level] : [4, 4, 11, 16][level];
  const profile =
    level < 2
      ? [
          [0, 1],
          [0.68, 0.73],
          [1, 0.038],
        ]
      : [
          [0, 1],
          [0.26, 0.96],
          [0.55, 0.82],
          [0.78, 0.62],
          [0.94, 0.32],
          [1, 0.037],
        ];
  const rings = profile.map(([t, r]) =>
    radialRing(mix(lo, hi, t), r * rx, r * rz, n, p, Math.PI / n),
  );
  loft(out, 'roof', rings, c.lead);
  if (major && level >= 2) {
    const cuts = level === 2 ? 12 : 22;
    for (let i = 0; i < cuts; i++) {
      const a = (2 * Math.PI * i) / cuts;
      for (const [[t, r], [u, q]] of pairs(profile)) {
        const point = (h, r) => [
          p[0] + Math.cos(a) * (rx * r + 0.027),
          mix(lo, hi, h) + 0.026,
          p[1] + Math.sin(a) * (rz * r + 0.027),
        ];
        beam(out, 'roof', point(t, r), point(u, q), 0.031, 0.037, c.ridge);
      }
    }
  }
}
function finial(out, p, y, scale = 1) {
  const h = (q) => y + scale * q;
  round(
    out,
    'trim',
    p,
    [
      [h(-0.02), 0.136 * scale],
      [h(0.25), 0.15 * scale],
      [h(0.5), 0.071 * scale],
      [h(0.65), 0.111 * scale],
      [h(0.78), 0.034 * scale],
    ],
    5,
    c.brass,
  );
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = (0.1 + 0.43 * i) * Math.PI;
    return [p[0] + Math.sin(a) * 0.19 * scale, h(0.96 - Math.cos(a) * 0.18), p[1]];
  });
  for (const [a, b] of pairs(points))
    beam(out, 'trim', a, b, 0.033 * scale, 0.031 * scale, c.brass);
}
function roofDrum(out, level) {
  const center = d.mainCenter;
  const roofHeight = floor + d.mainDomeInteriorHeight + 0.29;
  const radius = d.mainDomeDiameter / 2;
  const n = [10, 12, 16, 16][level];
  round(
    out,
    'stone',
    center,
    [
      [d.prayerEaves - 0.12, 7.72],
      [d.drumBottom - 0.47, 6.96],
      [d.drumBottom + 0.055, 6.84],
    ],
    8,
    c.ashlar,
  );
  const ring = Array.from({ length: n }, (_, i) =>
    rad(center, radius + 0.23, ((i + 0.5) * 2 * Math.PI) / n),
  );
  round(
    out,
    'stone',
    center,
    [
      [d.drumBottom, 6.86],
      [d.drumBottom + 0.34, 6.62],
      [d.drumTop, 6.53],
    ],
    n,
    c.drum,
  );
  for (const [i, w] of walls(ring).entries()) {
    if (level === 0 && i % 2 === 0) continue;
    const u = w.length * 0.5;
    opening(
      out,
      w,
      u,
      d.drumBottom + 0.93,
      d.drumTop - 0.7,
      Math.min(0.62, w.length * 0.32),
      0.54,
      level,
      { depth: 0.11, grille: true },
    );
    if (level >= 2) {
      cornice(out, w, d.drumBottom + 0.23, 0.2, 0.22, c.shadow);
      cornice(out, w, d.drumTop - 0.03, 0.18, 0.18);
      trimBlock(
        out,
        'trim',
        w,
        0.04,
        0.16,
        d.drumBottom + 0.45,
        d.drumTop - 0.07,
        0,
        0.12,
        c.ashlar,
      );
    }
  }
  dome(out, center, radius + 0.34, radius + 0.34, d.drumTop, roofHeight, level, true);
  if (level >= 1) finial(out, center, roofHeight, 0.93);
}
function prayerHall(out, level) {
  solid(out, body, floor, d.prayerEaves, 'stone', c.ashlar);
  for (const [i, w] of walls(body).entries()) {
    const west = i === 1 || i === 3;
    cornice(out, w, d.prayerEaves, 0.37, 0.35, c.shadow);
    if (level >= 1) {
      cornice(out, w, floor + 2.71, 0.18, 0.27, c.shadow);
      cornice(out, w, 9.97, 0.16, 0.165);
      course(out, w, 0.057, w.length - 0.05, floor + 0.64, 12.73, level);
    }
    const points = west ? [0.14, 0.38, 0.65, 0.87] : [0.19, 0.5, 0.81];
    for (const u0 of points) {
      const u = u0 * w.length;
      if (level === 0) {
        panel(out, 'glass', w, u - 0.57, u + 0.57, floor + 1.5, floor + 3.53, 0.087, c.glass);
        continue;
      }
      opening(out, w, u, floor + 0.56, 4.55, 0.42, 0.42, level, { depth: 0.072 });
      panel(out, 'trim', w, u - 0.7, u + 0.7, 5.72, 8.22, 0.071, c.pale);
      panel(out, 'glass', w, u - 0.57, u + 0.57, 5.91, 8.04, 0.086, c.glass);
      opening(out, w, u, 9.01, 11.7, 0.5, 0.69, level, { grille: true });
      if (west && i !== 2) circle(out, w, u, 12.77, 0.34, level);
    }
  }
  const projections = [
    [-5.0, 5.0, -26.41],
    [-9.2, -7.25, -26.29],
    [7.25, 9.2, -26.29],
  ];
  for (const [l, r, z] of projections) {
    const p = rect(l, z + 0.27, r, z - 0.16);
    solid(out, p, 5.58, 14.1, 'stone', c.ashlar);
    const w = wall(l, z - 0.16, r, z - 0.16);
    course(out, w, 0, w.length, 5.84, 13.71, level);
    cornice(out, w, 14.08, 0.25, 0.28);
    if (r - l >= 7)
      for (const t of [0.2, 0.5, 0.8]) {
        opening(out, w, w.length * t, 8.41, t === 0.5 ? 12.03 : 11.09, 0.47, 0.55, level, {
          grille: true,
          depth: 0.08,
        });
      }
  }
  const halfDomes = [
    [-6.62, -6.74, 3.66, 4.31, 13.21, 17.19],
    [6.62, -6.74, 3.66, 4.31, 13.21, 17.19],
    [-6.56, -20.18, 3.65, 4.29, 13.29, 17.21],
    [6.56, -20.18, 3.65, 4.29, 13.29, 17.21],
    [0, -7.51, 4.92, 4.87, 15.26, 18.81],
    [0, -21.61, 5.54, 4.42, 15.23, 18.7],
  ];
  for (const [x, z, rx, rz, y, hi] of halfDomes) {
    const p = [x, z];
    if (level >= 1)
      round(
        out,
        'brick',
        p,
        [
          [y - 0.78, rx - 0.03],
          [y, rx],
        ],
        10,
        c.coral,
      );
    dome(out, p, rx, rz, y, hi, level);
  }
  if (level >= 1) {
    for (const x of [-9.87, -6.04, 6.15, 9.73]) {
      const p = [x, qibla + 0.67];
      round(
        out,
        'stone',
        p,
        [
          [12.58, 0.62],
          [14.05, 0.64],
          [14.76, 0.49],
        ],
        level === 1 ? 7 : 12,
        c.pale,
      );
      dome(out, p, 0.56, 0.56, 14.74, 15.45, level);
    }
  }
  roofDrum(out, level);
}

function arcade(out, w, lo, hi, count, { domes, level }) {
  const h = (hi - lo) * 0.34;
  const spring = hi - h - 0.35;
  for (let i = 0; i < count; i++) {
    const step = w.length / count,
      u = i * step,
      mid = u + step * 0.5;
    const r = step * 0.39;
    panel(out, 'stone', w, u, mid - r, lo, hi, 0.01, c.stone);
    panel(out, 'stone', w, mid + r, u + step, lo, hi, 0.01, c.stone);
    const pieces = [2, 3, 7, 10][level];
    const p = (a, offset = 0) => [
      mid + Math.cos(a) * (r + offset),
      spring + Math.sin(a) * (h + offset),
    ];
    for (let j = 0; j < pieces; j++) {
      const a = (Math.PI * j) / pieces,
        b = (Math.PI * (j + 1)) / pieces;
      const A = p(a),
        B = p(b);
      face(out, 'stone', [w.p(...A), w.p(...B), w.p(B[0], hi), w.p(A[0], hi)], w.normal, c.ashlar);
      if (level >= 2) {
        const C = p(b, 0.13),
          D = p(a, 0.13);
        face(
          out,
          'trim',
          [w.p(...A, 0.055), w.p(...B, 0.055), w.p(...C, 0.068), w.p(...D, 0.068)],
          w.normal,
          j % 2 === 0 ? c.pale : c.coral,
        );
      }
    }
    if (level >= 1 && domes) {
      const cp = w.p(mid, hi, -3.27);
      dome(out, [cp[0], cp[2]], Math.min(step * 0.49, 1.78), 1.64, hi - 0.035, hi + 1.3, level);
    }
  }
  if (level >= 1) cornice(out, w, hi, 0.24, 0.22);
}
function innerCourt(out, level) {
  const [l, z0, r, z1] = courtBounds;
  const top = 8.57;
  const edgeRing = rect(l, z1, r, z0);
  const sign = areaSign(edgeRing);
  for (const [i, [a, b]] of pairs(closed(edgeRing)).entries()) {
    const count = level === 0 ? 2 : i % 2 === 0 ? 5 : 4;
    arcade(out, edge(b, a, sign), floor, top, count, { domes: true, level });
  }
  const ranges = [
    rect(wEast - 4.87, north, wEast, -0.13),
    rect(wWest, north, wWest + 4.89, -0.13),
    rect(wWest, north, wEast, 22.37),
    rect(wWest, 0.44, wEast, -4.5),
  ];
  for (const p of ranges) solid(out, p, floor, top, 'stone', c.ashlar);
  if (level >= 1) {
    const line = wall(wEast, north, wEast, -0.13, -1);
    course(out, line, 0.05, line.length - 0.05, floor + 1.0, 8.03, level);
    for (const p of [
      rect(wWest, z1, l, z0),
      rect(r, z1, wEast, z0),
      rect(wWest, north, wEast, z1),
      rect(wWest, z0, wEast, -4.5),
    ])
      solid(out, p, top - 0.22, top - 0.02, 'stone', c.shadow);
  }
  const front = wall(wEast, north, wWest, north);
  if (level >= 1) course(out, front, 0.052, front.length - 0.052, floor + 0.58, 8.46, level);
  opening(out, front, front.length / 2, floor, 5.39, 1.22, 1.09, level, { depth: 0.087 });
  if (level >= 1) {
    for (const u of [2.65, 6.96, 11.05, 17.31, 21.25, 25.47]) {
      opening(out, front, u, 5.35, 6.85, 0.61, 0.54, level, { depth: 0.084, grille: true });
    }
  }
  for (const [x, outside] of [
    [wWest, -1],
    [wEast, 1],
  ]) {
    const w = outside === 1 ? wall(x, qibla + 0.65, x, -0.7) : wall(x, -0.7, x, qibla + 0.65);
    arcade(out, w, floor, 7.34, level === 0 ? 2 : 6, { domes: false, level });
    solid(
      out,
      rect(Math.min(x, x - outside * 3.14), -0.62, Math.max(x, x - outside * 3.14), qibla + 0.63),
      7.3,
      7.74,
      'stone',
      c.pale,
    );
  }
  const p = [0, 10.77],
    n = [6, 8, 12, 16][level];
  round(
    out,
    'footing',
    p,
    [
      [floor - 0.02, 2.38],
      [floor + 0.23, 2.27],
      [floor + 0.36, 1.46],
      [floor + 0.8, 1.36],
    ],
    n,
    c.marble,
  );
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const p2 = rad(p, 1.56, (2 * Math.PI * i) / 8);
      round(
        out,
        'trim',
        p2,
        [
          [floor + 0.27, 0.13],
          [floor + 3.05, 0.135],
        ],
        level === 1 ? 5 : 8,
        c.pale,
      );
    }
    dome(out, p, 2.0, 2.0, floor + 3.04, floor + 4.51, level);
    finial(out, p, floor + 4.51, 0.44);
  }
}
function lowerSite(out, level) {
  solid(out, d.outline, sunk, floor, 'footing', c.base);
  for (const [i, w] of walls(d.outline).entries()) {
    if (level >= 1) cornice(out, w, floor - 0.07, 0.15, 0.23, c.shadow);
    if (i === 3) continue;
    const n = i === 1 ? 5 : 8;
    for (let j = 0; j < n; j++) {
      const u = (w.length * (j + 0.5)) / n;
      if (level >= 1)
        opening(out, w, u, 0.63, 1.58, 0.43, 0.42, level, { trim: false, depth: 0.095 });
    }
  }
  const w = wall(wEast, north, wWest, north);
  const n = [4, 6, 8, 10][level];
  for (let i = 0; i < n; i++) {
    const z = north + 5.11 - ((i + 1) * 5.11) / n;
    const width = 7.44 - 3.32 * (i / n);
    const g = Math.min(grade([0, z]) - 0.19, -0.22);
    const y = mix(0.0, floor, (i + 1) / n);
    block(out, 'footing', -width * 0.5, g, z, width, y - g, 5.11 / n + 0.02, c.paving);
  }
  if (level >= 1) {
    for (const sign of [-1, 1]) {
      const c0 = 3.62 * sign,
        c1 = 2.08 * sign;
      beam(
        out,
        'footing',
        [c0, 0.48, north + 4.81],
        [c1, floor + 0.35, north - 0.17],
        0.27,
        0.39,
        c.base,
      );
    }
    cornice(out, w, floor - 0.22, 0.18, 0.27);
  }
}
function minaret(out, p, top, level) {
  const n = [5, 8, 16, 24][level];
  const g = Math.min(floor - 0.18, grade(p));
  if (level === 0) {
    round(
      out,
      'stone',
      p,
      [
        [g - 0.27, 1.88],
        [floor + 4.43, 1.85],
        [floor + 5.54, 1.13],
        [top - 10.97, 0.92],
        [top - 10.08, 1.71],
        [top - 9.2, 1.7],
        [top - 9.16, 0.82],
        [top - 3.02, 0.68],
        [top - 1.2, 0.3],
        [top, 0.043],
      ],
      5,
      c.pale,
    );
    return;
  }
  round(
    out,
    'stone',
    p,
    [
      [g - 0.27, 1.89],
      [floor + 4.42, 1.88],
      [floor + 5.01, 1.41],
      [floor + 5.54, 1.14],
    ],
    n,
    c.pale,
  );
  round(
    out,
    'stone',
    p,
    [
      [floor + 5.47, 1.13],
      [top - 9.89, 0.89],
    ],
    n,
    c.ashlar,
  );
  const y = top - 10.3;
  round(
    out,
    'stone',
    p,
    [
      [y - 0.68, 0.9],
      [y - 0.36, 1.11],
      [y - 0.08, 1.44],
      [y + 0.21, 1.7],
      [y + 0.42, 1.73],
      [y + 1.09, 1.63],
      [y + 1.17, 1.74],
    ],
    n,
    c.pale,
  );
  round(
    out,
    'stone',
    p,
    [
      [y + 1.08, 0.83],
      [top - 3.47, 0.67],
      [top - 3.02, 0.74],
    ],
    n,
    c.ashlar,
  );
  round(
    out,
    'trim',
    p,
    [
      [top - 3.08, 0.76],
      [top - 2.63, 0.63],
      [top - 2.24, 0.38],
      [top - 1.91, 0.46],
      [top - 1.56, 0.42],
      [top - 1.1, 0.153],
    ],
    n,
    c.stoneCap,
  );
  if (level >= 1) {
    finial(out, p, top - 1.16, 1.12);
    const count = [0, 4, 13, 19][level];
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      const q0 = rad(p, 1.69, a),
        q1 = rad(p, 1.655, a + 0.14);
      beam(out, 'trim', at(q0, y + 0.46), at(q1, y + 1.03), 0.064, 0.061, c.shadow);
      if (level >= 2) beam(out, 'trim', at(q1, y + 0.46), at(q0, y + 1.04), 0.063, 0.064, c.shadow);
    }
  } else {
    round(
      out,
      'trim',
      p,
      [
        [top - 1.1, 0.133],
        [top, 0.043],
      ],
      5,
      c.brass,
    );
  }
}
function build(out, level) {
  lowerSite(out, level);
  prayerHall(out, level);
  innerCourt(out, level);
  for (const [i, p] of d.minarets.entries()) minaret(out, p, d.minaretTops[i], level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'laleli-mosque-model.mjs';
const camera = [67, 49, 79],
  lookAt = [0, 12.8, 0];
const errors = { district: 0.44, street: 0.16, closeup: 0.069 };
export const laleliMosqueAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Native mapped court axis and original relief beneath the northwestern steps.',
  brief:
    'Laleli Mosque with striped masonry, elevated prayer hall, open domed court, two minarets and the tall lead dome.',
  camera,
  lookAt,
  sunDirection: [70, 101, -62],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis:
      'Exact named Laleli Camii outer polygon. The interior courtyard remains open in the model.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_ashlar',
    'brick_longformat',
    'metal_standing_seam',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'striped-qibla-wall-and-lantern-drum', position: [-31, 11, -52], lookAt: [0, 14, -17] },
    { name: 'arcaded-court-and-northwest-steps', position: [30, 27, 49], lookAt: [0, 9, 8] },
    { name: 'main-dome-and-two-single-balconies', position: [-37, 36, 23], lookAt: [0, 19, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'laleli-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense: 'Original mesh under repository license. © OpenStreetMap contributors.',
};
