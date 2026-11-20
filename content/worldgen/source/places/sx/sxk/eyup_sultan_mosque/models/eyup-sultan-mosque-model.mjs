import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  plane,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  lime: 'c9c2a9',
  white: 'dad2b9',
  ashlar: 'b8b29d',
  marble: 'c2bcaa',
  dark: '6e6656',
  lead: '697477',
  leadFlash: '7e8787',
  glass: '4c5550',
  lintel: 'ded6bb',
  tile: '8297a1',
  gold: 'a89964',
  bronze: '5e6253',
  olive: '7d815e',
  wood: '666454',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.92),
  plaster: surface('wall', 'plaster_lime', 0.9),
  base: surface('foundation', 'stone_ashlar', 0.94),
  roof: surface('roof', 'metal_standing_seam', 0.75, 0.15),
  metal: surface('trim', 'metal_bronze_cast', 0.75, 0.19),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46 },
};
const centerOf = (points) =>
  [0, 1].map((axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length);
const courtLevel = 1.51;
const bottom = (p) => Math.min(grade(p) - 0.36, 0.62);
const ring = (p, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((2 * i + 1) * Math.PI) / n;
    return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
  });
const walls = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));
const solid = (out, p, lo, hi, slot, color) =>
  shell(out, p, typeof lo === 'number' ? () => lo : lo, hi, {
    wall: slot,
    roof: slot,
    color,
    roofColor: color,
  });
const bands = (out, p, profile, n, slot, color, cap = true) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, p, Math.PI / n)),
    color,
    { cap },
  );
function smallArch(out, w, u, low, spring, radius, rise, level, shade = c.glass) {
  arch(
    out,
    w,
    u,
    low,
    spring,
    radius,
    rise,
    0.034,
    level,
    { inner: shade, trim: c.lintel, width: 0.085 },
    { inner: 'glass', trim: 'stone' },
  );
}

function cupola(out, p, rx, rz, low, high, level, major = false) {
  const n = (major ? [12, 16, 32, 44] : [4, 8, 16, 22])[level];
  const profile =
    level <= 1
      ? [
          [0, 1],
          [0.66, 0.755],
          [1, 0.038],
        ]
      : [
          [0, 1],
          [0.31, 0.967],
          [0.57, 0.84],
          [0.79, 0.62],
          [0.94, 0.35],
          [1, 0.025],
        ];
  const rings = profile.map(([t, r]) =>
    radialRing(mix(low, high, t), rx * r, rz * r, n, p, Math.PI / n),
  );
  loft(out, 'roof', rings, c.lead, { cap: level >= 2 });
  if (major && level >= 2) {
    for (let i = 0; i < (level === 2 ? 12 : 22); i++) {
      const a = (i * Math.PI * 2) / (level === 2 ? 12 : 22);
      const xy = (t, r, da) => [
        p[0] + (rx * r + 0.048) * Math.cos(a + da),
        mix(low, high, t) + 0.048,
        p[1] + (rz * r + 0.048) * Math.sin(a + da),
      ];
      for (const [[t, r], [u, q]] of pairs(profile)) {
        face(
          out,
          'roof',
          [xy(t, r, -0.008), xy(t, r, 0.008), xy(u, q, 0.008), xy(u, q, -0.008)],
          [Math.cos(a), 0.7, Math.sin(a)],
          c.leadFlash,
        );
      }
    }
  }
}
function finial(out, p, y, scale, level) {
  const n = level < 2 ? 4 : 8;
  bands(
    out,
    p,
    [
      [y - 0.04, scale * 0.16],
      [y + scale * 0.23, scale * 0.19],
      [y + scale * 0.45, scale * 0.11],
      [y + scale * 0.75, scale * 0.036],
    ],
    n,
    'metal',
    c.gold,
  );
}
function pilaster(out, w, u, bottom, top, r) {
  panel(out, 'stone', w, u - r, u + r, bottom, top, 0.083, c.marble);
  panel(out, 'stone', w, u - r - 0.055, u + r + 0.055, top - 0.15, top + 0.04, 0.12, c.white);
}
function prayerHall(out, level) {
  const p = d.centralDome;
  const body = rect(-12.5, 10.75, 18.55, 31.32);
  const skirt = rect(-15.5, 11.15, 22.25, 31.34);
  solid(out, skirt, bottom, courtLevel, 'base', c.ashlar);
  solid(out, body, courtLevel, 10.58, 'plaster', c.lime);
  const dress = walls(body);
  for (const [i, w] of dress.entries()) {
    const count = i % 2 === 0 ? 7 : 5;
    for (let k = 0; k < count; k++) {
      const u = (w.length * (k + 0.5)) / count;
      if (i === 0 && k === 3) continue;
      smallArch(out, w, u, courtLevel + 1.46, 5.1, 0.55, 0.39, Math.max(0, level - 1));
      if (level >= 1) smallArch(out, w, u, 7.01, 8.9, 0.52, 0.35, Math.max(0, level - 1));
    }
    panel(out, 'stone', w, 0, w.length, 10.31, 10.59, 0.131, c.white);
  }
  const drumBase = 16.07,
    drumTop = 19.33;
  const o = ring(p, 8.04, level === 1 ? 12 : 16);
  const sides = level === 1 ? 12 : 16;
  solid(out, ring(p, 8.48, sides), 10.32, drumBase, 'plaster', c.lime);
  solid(out, ring(p, 8.04, sides), drumBase - 0.12, drumTop, 'stone', c.white);
  bands(
    out,
    p,
    [
      [drumTop - 0.24, 8.05],
      [drumTop - 0.03, 8.32],
      [drumTop + 0.15, 8.32],
    ],
    sides,
    'stone',
    c.white,
  );
  for (const drumWall of walls(o)) {
    const center = drumWall.length / 2;
    smallArch(out, drumWall, center, drumBase + 0.29, 18.15, 0.56, 0.56, Math.max(0, level - 1));
    if (level >= 2) {
      for (const x of [center - 0.7, center + 0.7])
        pilaster(out, drumWall, x, drumBase + 0.14, 18.9, 0.064);
    }
  }
  cupola(out, p, 8.06, 8.06, drumTop + 0.16, 25.27, level, true);
  finial(out, p, 25.23, 1.03, level);
  for (let i = 0; i < 8; i++) {
    const a = (i * 2 * Math.PI) / 8;
    const q = [p[0] + Math.cos(a) * 7.28, p[1] + Math.sin(a) * 6.03];
    const lo = 12.18,
      hi = 14.94;
    solid(out, ring(q, 3.54, level === 0 ? 4 : 10), 10.37, lo, 'plaster', c.lime);
    cupola(out, q, 3.41, 3.21, lo, hi, level);
    if (level >= 1) {
      const zz = q[1] + Math.sign(q[1] - p[1]) * 2.63;
      const w = plane(zz, q[1] > p[1] ? 1 : -1);
      smallArch(out, w, q[0], 10.92, 11.83, 0.41, 0.31, Math.max(0, level - 1));
    }
  }
  for (const x of [-10.22, 16.28])
    for (const z of [13.24, 28.92]) {
      solid(out, ring([x, z], 2.34, level === 0 ? 4 : 8), 10.46, 11.37, 'stone', c.marble);
      cupola(out, [x, z], 2.26, 2.26, 11.37, 13.41, level);
    }
  const entry = plane(10.69, -1);
  smallArch(out, entry, p[0], courtLevel, 5.52, 1.09, 0.95, level, c.dark);
  if (level >= 1) {
    panel(out, 'metal', entry, p[0] - 1.2, p[0] + 1.2, 6.59, 6.88, 0.07, c.bronze);
    for (const dir of [-1, 1]) pilaster(out, entry, p[0] + dir * 1.52, courtLevel, 6.57, 0.17);
  }
}

// Arched portals have open spans. Lintels are short spandrel panels above the curves.
function arcade(out, from, to, count, depth, floor, top, level) {
  const w = edge(from, to);
  const bay = w.length / count;
  const baseY = top - 1.53;
  const side = (p, y, offset) => w.p(p, y, offset);
  const orient = [w.normal[0], 0, w.normal[2]];
  face(
    out,
    'stone',
    [
      side(0, top, -depth * 0.56),
      side(w.length, top, -depth * 0.56),
      side(w.length, top, depth * 0.51),
      side(0, top, depth * 0.51),
    ],
    up,
    c.white,
  );
  for (let i = 0; i <= count; i++) {
    const p = side(i * bay, floor, 0);
    const profile =
      level === 1
        ? [
            [floor, 0.26],
            [baseY, 0.23],
          ]
        : [
            [floor - 0.08, 0.29],
            [floor + 0.18, 0.27],
            [baseY - 0.13, 0.205],
            [baseY, 0.28],
          ];
    bands(out, [p[0], p[2]], profile, level === 1 ? 5 : 8, 'stone', c.marble, level >= 2);
  }
  for (let i = 0; i < count; i++) {
    const mid = bay * (i + 0.5);
    const cuts = [5, 5, 10, 14][level],
      r = bay * 0.48;
    for (let j = 0; j < cuts; j++) {
      const point = (index) => {
        const t = (index * Math.PI) / cuts;
        return [mid - r * Math.cos(t), baseY + 1.11 * Math.sin(t)];
      };
      const [u, y] = point(j),
        [v, high] = point(j + 1);
      face(
        out,
        'plaster',
        [side(u, y, 0.11), side(v, high, 0.11), side(v, top, 0.11), side(u, top, 0.11)],
        orient,
        c.lime,
      );
      if (level >= 2)
        face(
          out,
          'plaster',
          [side(u, y, -0.12), side(v, high, -0.12), side(v, top, -0.12), side(u, top, -0.12)],
          orient.map((x) => -x),
          c.lime,
        );
    }
    const p = side(mid, 0, 0);
    const roofCenter = [p[0], p[2]];
    cupola(
      out,
      roofCenter,
      Math.min(bay * 0.47, depth * 0.56),
      Math.min(depth * 0.56, bay * 0.47),
      top,
      top + 1.76,
      level,
    );
  }
}
function court(out, level) {
  const outline = [
    [-16.08, -14.42],
    [22.64, -16.02],
    [22.64, 11.13],
    [-16.07, 11.13],
    [-16.2, 8.3],
  ];
  solid(out, outline, bottom, courtLevel, 'base', c.ashlar);
  arcade(out, [-9.3, 9.04], [16.43, 9.04], 5, 5.32, courtLevel, 7.01, level);
  arcade(out, [-13.33, -10.75], [-13.33, 7.15], 4, 4.03, courtLevel, 5.39, level);
  arcade(out, [18.37, 7.15], [18.37, -10.75], 4, 3.98, courtLevel, 5.39, level);
  const [w, h] = d.centralSofa;
  const sofa = rect(3.3 - w / 2, -3.3 - h / 2, 3.3 + w / 2, -3.3 + h / 2);
  solid(out, sofa, courtLevel, courtLevel + 0.39, 'stone', c.marble);
  if (level >= 1) {
    const railing = (y, slot, col) => {
      for (const e of walls(sofa)) panel(out, slot, e, 0, e.length, y, y + 0.055, 0.055, col);
    };
    for (const y of [courtLevel + 0.47, courtLevel + 1.39]) railing(y, 'metal', c.bronze);
  }
  for (const q of sofa) {
    bands(
      out,
      q,
      [
        [courtLevel + 0.21, 0.32],
        [courtLevel + 0.45, 0.32],
        [courtLevel + 1.37, 0.21],
        [courtLevel + 1.53, 0.31],
      ],
      [4, 6, 8, 10][level],
      'stone',
      c.white,
    );
  }
}
function tomb(out, level) {
  const p = [d.tombCenter[0], d.tombCenter[1] + 1.31];
  const y = 2.33;
  const r = 4.65;
  const ringShape = ring(p, r, 8);
  solid(out, ringShape, bottom, y, 'base', c.ashlar);
  solid(out, ringShape, y, 8.33, 'stone', c.marble);
  for (const w of walls(ringShape)) {
    smallArch(out, w, w.length * 0.5, y + 0.78, y + 2.63, 0.49, 0.4, Math.max(0, level - 1));
    if (level >= 1) smallArch(out, w, w.length * 0.5, y + 3.31, y + 4.42, 0.41, 0.41, level - 1);
    if (level >= 1) panel(out, 'stone', w, 0, w.length, 8.1, 8.35, 0.12, c.white);
  }
  cupola(out, p, r - 0.32, r - 0.32, 8.43, 11.97, level);
  finial(out, p, 11.95, 0.59, level);
  const wall = plane(-14.52, 1);
  block(out, 'stone', -7.2, 1.08, -15.17, 14.15, 4.63, 0.64, c.lime);
  smallArch(out, wall, -0.37, courtLevel, 3.88, 0.79, 0.72, level, c.dark);
  for (const x of [-3.72, 3.72]) {
    panel(out, 'glass', wall, x - 1.02, x + 1.02, 2.54, 4.21, 0.062, c.bronze);
    if (level >= 1) {
      for (let i = 0; i < 8; i++)
        panel(
          out,
          'metal',
          wall,
          x - 1.0 + i * 0.285,
          x - 0.966 + i * 0.285,
          2.54,
          4.21,
          0.079,
          c.gold,
        );
      panel(out, 'stone', wall, x - 1.21, x + 1.21, 4.26, 4.55, 0.12, c.tile);
    }
  }
}
function minaret(out, i, level) {
  const outline = d.towerBases[i],
    p = centerOf(d.towerShafts[i]),
    floor = Math.max(courtLevel - 0.28, grade(p));
  const at = (y) => floor + y,
    n = [6, 8, 16, 20][level];
  solid(out, outline, bottom, at(5.48), 'stone', c.lime);
  bands(
    out,
    p,
    [
      [at(5.43), 1.75],
      [at(7.07), 1.47],
      [at(8.46), 1.26],
      [at(29.85), 1.19],
    ],
    n,
    'stone',
    c.white,
    false,
  );
  for (const y of d.towerBalconies) {
    bands(
      out,
      p,
      [
        [at(y - 0.76), 1.21],
        [at(y - 0.52), 1.43],
        [at(y - 0.22), 1.74],
        [at(y + 0.27), 1.83],
      ],
      n,
      'stone',
      c.marble,
    );
    bands(
      out,
      p,
      [
        [at(y + 0.26), 1.81],
        [at(y + 0.9), 1.78],
      ],
      n,
      'stone',
      c.white,
      false,
    );
    if (level >= 2) {
      for (const w of walls(ring(p, 1.82, n)))
        panel(
          out,
          'metal',
          w,
          w.length * 0.28,
          w.length * 0.72,
          at(y + 0.38),
          at(y + 0.72),
          0.015,
          c.dark,
        );
    }
  }
  bands(
    out,
    p,
    [
      [at(30.1), 1.16],
      [at(35.8), 1.12],
      [at(37.02), 1.06],
      [at(37.37), 0.91],
    ],
    n,
    'stone',
    c.white,
    false,
  );
  bands(
    out,
    p,
    [
      [at(37.27), 0.99],
      [at(40.18), 0.63],
      [at(d.towerHeight - 0.54), 0.064],
    ],
    n,
    'roof',
    c.lead,
  );
  finial(out, p, at(d.towerHeight - 0.58), 0.71, level);
  if (level >= 1) {
    for (const w of walls(ring(p, 1.28, n)).filter((_, i) => i % 2 === 0)) {
      panel(
        out,
        'glass',
        w,
        w.length * 0.43,
        w.length * 0.57,
        at(16.07),
        at(17.55),
        0.019,
        c.glass,
      );
    }
  }
}

function outside(out, level) {
  const f = centerOf(d.fountain);
  const y = grade(f) + 0.32;
  solid(out, d.fountain, bottom, y, 'base', c.marble);
  bands(
    out,
    f,
    [
      [y, 1.16],
      [y + 1.46, 1.11],
      [y + 1.69, 1.23],
    ],
    level === 0 ? 6 : 12,
    'stone',
    c.marble,
  );
  const supports = ring(f, 2.54, 8);
  for (const p of supports) {
    const profile =
      level === 1
        ? [
            [y, 0.19],
            [y + 2.73, 0.19],
          ]
        : [
            [y, 0.22],
            [y + 0.16, 0.2],
            [y + 2.57, 0.135],
            [y + 2.73, 0.24],
          ];
    bands(out, p, profile, level === 1 ? 4 : 8, 'stone', c.marble, level >= 2);
  }
  bands(
    out,
    f,
    [
      [y + 2.71, 2.93],
      [y + 2.92, 3.06],
      [y + 3.12, 2.94],
    ],
    level === 0 ? 8 : 14,
    'plaster',
    c.dark,
  );
  cupola(out, f, 2.83, 2.83, y + 3.12, y + 4.47, level);
  finial(out, f, y + 4.43, 0.8, level);
  const porchY = 2.86;
  solid(out, d.womenSection, porchY, 5.53, 'plaster', c.lime);
  const w = edge([-39.9, 15.47], [-19.64, 15.75]);
  for (let i = 0; i < 6; i++) {
    const u = (w.length * i) / 5;
    const [x, , z] = w.p(u, 0, 0);
    if (i > 0 && i < 5)
      bands(
        out,
        [x, z],
        [
          [grade([x, z]) - 0.25, 0.21],
          [porchY, 0.17],
        ],
        level === 0 ? 4 : 8,
        'stone',
        c.marble,
      );
  }
  if (level >= 1) {
    for (const u of [2, 4.72, 7.44, 10.16, 12.88, 15.6, 18.32]) {
      panel(out, 'glass', w, u - 0.92, u + 0.92, 3.65, 4.74, 0.017, c.glass);
      panel(out, 'stone', w, u - 0.99, u + 0.99, 4.8, 4.98, 0.023, c.white);
    }
  }
  const edgeZ = 21.45;
  block(
    out,
    'base',
    -39.98,
    bottom([-39.98, edgeZ]),
    edgeZ,
    20.18,
    5.72 - bottom([-39.98, edgeZ]),
    0.35,
    c.ashlar,
  );
}
function build(out, level) {
  court(out, level);
  prayerHall(out, level);
  tomb(out, level);
  minaret(out, 0, level);
  minaret(out, 1, level);
  outside(out, level);
}
// Low-poly outline of the same buildings and roof groups.
export function skyline(out) {
  const p = d.centralDome;
  solid(out, rect(-12.5, 10.75, 18.55, 31.32), bottom, 10.58, 'plaster', c.lime);
  solid(out, ring(p, 8.15, 10), 10.47, 19.33, 'stone', c.white);
  cupola(out, p, 8.08, 8.08, 19.35, 25.27, 0, true);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const pt = [p[0] + Math.cos(a) * 7.28, p[1] + Math.sin(a) * 6.03];
    solid(out, ring(pt, 3.38, 4), 10.43, 11.35, 'stone', c.lime);
    cupola(out, pt, 3.46, 3.28, 11.27, 14.94, 0);
  }
  for (const x of [-10.22, 16.28])
    for (const z of [13.24, 28.92]) cupola(out, [x, z], 2.3, 2.3, 10.74, 13.41, 0);
  const arcades = [
    { start: [-9.3, 9.04], end: [16.43, 9.04], count: 5, top: 7.01, depth: 4.6 },
    { start: [-13.33, -10.75], end: [-13.33, 7.15], count: 4, top: 5.39, depth: 3.8 },
    { start: [18.37, -10.75], end: [18.37, 7.15], count: 4, top: 5.39, depth: 3.8 },
  ];
  for (const { start, end, count, top, depth } of arcades) {
    const w = edge(start, end);
    const pt = (u, y, d) => w.p(u, y, d);
    face(
      out,
      'stone',
      [pt(0, top, 0), pt(w.length, top, 0), pt(w.length, top, depth), pt(0, top, depth)],
      up,
      c.lime,
    );
    const width = w.length / count;
    for (let i = 0; i < count; i++) {
      const [x, , z] = pt(width * (i + 0.5), 0, depth * 0.5);
      cupola(
        out,
        [x, z],
        Math.min(width * 0.47, depth * 0.5),
        Math.min(width * 0.47, depth * 0.5),
        top,
        top + 1.75,
        0,
      );
      panel(out, 'plaster', w, i * width, i * width + 0.24, courtLevel, top, 0.011, c.lime);
    }
  }
  const tombP = [d.tombCenter[0], d.tombCenter[1] + 1.31];
  solid(out, ring(tombP, 4.65, 8), bottom, 8.4, 'stone', c.marble);
  cupola(out, tombP, 4.33, 4.33, 8.43, 11.97, 0);
  const f = centerOf(d.fountain);
  const y = grade(f);
  solid(out, d.womenSection, 2.86, 5.53, 'plaster', c.lime);
  for (const x of [-37, -27, -21])
    block(
      out,
      'stone',
      x,
      bottom([x, 15.6]),
      15.58,
      0.31,
      2.88 - bottom([x, 15.6]),
      0.31,
      c.marble,
    );
  for (const q of ring(f, 2.55, 4)) {
    const w = plane(q[1], 1);
    panel(out, 'stone', w, q[0] - 0.12, q[0] + 0.12, y - 0.19, y + 3.13, 0.013, c.marble);
  }
  cupola(out, f, 2.87, 2.87, y + 3.12, y + 4.47, 0);
  for (let i = 0; i < d.towerBases.length; i++) {
    const center = centerOf(d.towerShafts[i]),
      floor = Math.max(courtLevel - 0.28, grade(center));
    const row = (slot, profile, color) =>
      bands(
        out,
        center,
        profile.map(([y, r]) => [floor + y, r]),
        6,
        slot,
        color,
        false,
      );
    solid(out, d.towerBases[i], bottom, floor + 5.48, 'stone', c.lime);
    row(
      'stone',
      [
        [5.43, 1.72],
        [7.44, 1.33],
        [29.52, 1.18],
        [30.0, 1.82],
        [30.9, 1.78],
        [31.03, 1.15],
        [35.62, 1.13],
        [36.05, 1.77],
        [36.92, 1.68],
        [37.31, 0.99],
      ],
      c.white,
    );
    row(
      'roof',
      [
        [37.28, 0.99],
        [44.02, 0.04],
      ],
      c.lead,
    );
  }
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'eyup-sultan-mosque-model.mjs';
const camera = [-94, 58, -102],
  lookAt = [-1, 12, 3];
const errors = { district: 0.64, street: 0.26, closeup: 0.086 };
export const eyupSultanMosqueAsset = {
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
    'Original terrain in the mapped western passage beside the women’s prayer wing.',
  brief:
    'Eyüp Sultan Mosque with its eight exedras, two double-balcony minarets, portico, open arcade court, domed tomb and outside fountain.',
  camera,
  lookAt,
  sunDirection: [-52, 92, -59],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Named mosque envelope and independently mapped connected wing and fountain.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'prayer-dome-and-both-minarets', position: [54, 18, 76], lookAt: [4, 16, 16] },
    { name: 'courtyard-five-bay-portico', position: [-7, 10, -12], lookAt: [4, 10, 16] },
    { name: 'western-fountain-and-entrance-wing', position: [-62, 10, 11], lookAt: [-20, 7, 8] },
    { name: 'tomb-and-forecourt', position: [9, 16, -33], lookAt: [2, 5, -11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'eyup-sultan-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.17,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
