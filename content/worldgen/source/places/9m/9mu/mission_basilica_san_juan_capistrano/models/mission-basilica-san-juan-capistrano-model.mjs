import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const color = palette({
  white: 'e3ded0',
  shade: 'c7c1b0',
  stone: 'aaa69c',
  shadow: '838477',
  red: '9e543f',
  redDark: '864536',
  gold: 'a58e5a',
  dark: '435051',
  wood: '4a3c31',
  glass: '647477',
  edge: '57594d',
});
const surfaces = {
  plaster: surface('wall', 'plaster_lime', 0.96),
  stone: surface('trim', 'stone_ashlar', 0.91),
  roof: surface('roof', 'clay_fired', 0.93),
  glazing: surface('window', 'storefront', 0.64, 0.03),
  wood: surface('door', 'wood_plain', 0.92),
  bronze: surface('trim', 'metal_painted', 0.79, 0.24),
};
const plaster = { wall: 'plaster', roof: 'plaster', color: color.white, roofColor: color.shade };
const profile = [
  [-1, 0],
  [-0.9, 0.12],
  [-0.8, 0.35],
  [-0.68, 0.6],
  [-0.54, 0.82],
  [-0.43, 0.78],
  [-0.32, 0.84],
  [-0.24, 1.12],
  [-0.12, 1.42],
  [0, 1.53],
  [0.12, 1.42],
  [0.24, 1.12],
  [0.32, 0.84],
  [0.43, 0.78],
  [0.54, 0.82],
  [0.68, 0.6],
  [0.8, 0.35],
  [0.9, 0.12],
  [1, 0],
];
const archColors = { inner: color.dark, trim: color.stone, width: 0.105 };
const archSlots = { inner: 'glazing', trim: 'stone' };

function radial(center, radius, count, phase = Math.PI / 8) {
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / count;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
  });
}
function roofSection(out, p, q, y, high, tint = color.red) {
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    face(out, 'roof', [at(p[i], y), at(p[j], y), at(q[j], high), at(q[i], high)], up, tint);
  }
}
function crown(out, center, sections, count, slot, tint, phase = Math.PI / 8) {
  for (const [[height, r], [top, rt]] of pairs(sections)) {
    const lower = radial(center, r, count, phase);
    const upper = radial(center, rt, count, phase);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const w = edge(lower[i], lower[j]);
      face(
        out,
        slot,
        [at(lower[i], height), at(lower[j], height), at(upper[j], top), at(upper[i], top)],
        [w.normal[0], Math.abs(r - rt) > 0.2 ? 0.25 : 0, w.normal[2]],
        tint,
      );
    }
  }
  const [top, r] = sections.at(-1);
  cap(out, slot, radial(center, r, count, phase), top, tint);
}
function cornice(out, poly, y, h) {
  shell(out, poly, () => y, y + h, { wall: 'stone', color: color.stone, roofColor: color.stone });
}
function hipped(out, bounds, y, eaves, top, majorX = false) {
  const outline = rect(...bounds);
  shell(out, outline, () => y, eaves, plaster);
  const midX = (bounds[0] + bounds[2]) / 2;
  const midZ = (bounds[1] + bounds[3]) / 2;
  const w = (bounds[2] - bounds[0]) / 2,
    d = (bounds[3] - bounds[1]) / 2;
  const upper = rect(
    midX - w * (majorX ? 0.82 : 0.12),
    midZ - d * (majorX ? 0.14 : 0.82),
    midX + w * (majorX ? 0.82 : 0.12),
    midZ + d * (majorX ? 0.14 : 0.82),
  );
  roofSection(out, outline, upper, eaves - 0.03, top);
  cap(out, 'roof', upper, top, color.redDark);
}
function cross(out, center, y, stem, width, depth, tint = color.edge) {
  block(out, 'bronze', center[0] - depth / 2, y, center[1] - depth / 2, depth, stem, depth, tint);
  block(
    out,
    'bronze',
    center[0] - width / 2,
    y + stem * 0.67,
    center[1] - depth / 2,
    width,
    depth,
    depth,
    tint,
  );
}
function archWithReveal(out, w, u, y, spring, r, rise, depth, lod) {
  const count = [4, 6, 8, 12][lod];
  const positions = Array.from({ length: count + 1 }, (_, i) => {
    const a = (Math.PI * i) / count;
    return [u + r * Math.cos(a), spring + rise * Math.sin(a)];
  });
  const front = ([x, h]) => w.p(x, h);
  const back = ([x, h]) => w.p(x, h, -depth);
  const openingShape = [[u - r, y], [u + r, y], ...positions];
  const points = openingShape.map(back);
  face(out, 'glazing', points, w.normal, color.dark);
  for (const [a, b] of pairs(closed(openingShape)))
    face(out, 'stone', [front(a), front(b), back(b), back(a)], w.normal, color.shadow);
  return positions;
}
function bellStage(out, center, r, y, top, lod) {
  const poly = radial(center, r, 8);
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b);
    const x = w.length / 2,
      wr = x * 0.6;
    if (lod === 0) {
      panel(out, 'plaster', w, 0, w.length, y, top, 0, color.white);
      panel(out, 'glazing', w, x - wr, x + wr, y + 0.62, top - 0.68, 0.026, color.dark);
      continue;
    }
    const low = y + 0.66,
      spring = top - 1.47,
      rise = 0.83;
    const ar = archWithReveal(out, w, x, low, spring, wr, rise, 0.44, lod);
    panel(out, 'plaster', w, 0, x - wr, y, top, 0, color.white);
    panel(out, 'plaster', w, x + wr, w.length, y, top, 0, color.white);
    panel(out, 'plaster', w, x - wr, x + wr, y, low, 0, color.white);
    for (const [a, b] of pairs(ar))
      face(
        out,
        'plaster',
        [w.p(...a), w.p(...b), w.p(b[0], top), w.p(a[0], top)],
        w.normal,
        color.white,
      );
    panel(
      out,
      'stone',
      w,
      x - wr - 0.15,
      x + wr + 0.15,
      low - 0.08,
      low + 0.03,
      0.096,
      color.stone,
    );
    if (lod > 1) {
      const h = spring + 0.13;
      const bell = w.p(x, h, -0.25);
      ring(
        out,
        'bronze',
        [bell[0], bell[2]],
        [
          [h - 0.78, 0.31],
          [h - 0.65, 0.27],
          [h - 0.22, 0.18],
          [h - 0.11, 0.14],
        ],
        lod === 3 ? 8 : 6,
        color.gold,
      );
      beam(
        out,
        'bronze',
        w.p(x - 0.38, h - 0.07, -0.23),
        w.p(x + 0.38, h - 0.07, -0.23),
        0.075,
        0.08,
        color.edge,
      );
    }
  }
  cap(out, 'stone', poly, top, color.stone);
}
function tower(out, d, lod, ground) {
  const y = d.floor,
    [cx, cz] = d.towerCenter;
  const square = rect(cx - 3.75, cz - 4.85, cx + 3.75, cz + 4.55);
  shell(out, square, (p) => Math.min(ground(p) - 0.2, y - 0.22), y + 14.8, plaster);
  cornice(out, rect(cx - 3.92, cz - 4.98, cx + 3.91, cz + 4.73), y + 14.59, 0.46);
  const towerLower = radial(d.towerCenter, 3.62, 8);
  shell(out, towerLower, () => y + 14.68, y + 16.15, plaster);
  cornice(out, radial(d.towerCenter, 3.76, 8), y + 15.85, 0.54);
  bellStage(out, d.towerCenter, 3.43, y + 16.21, y + 21.59, lod);
  cornice(out, radial(d.towerCenter, 3.67, 8), y + 21.44, 0.54);
  bellStage(out, d.towerCenter, 3.14, y + 21.91, y + 26.36, lod);
  cornice(out, radial(d.towerCenter, 3.37, 8), y + 26.24, 0.41);
  crown(
    out,
    d.towerCenter,
    [
      [y + 26.55, 3.19],
      [y + 27.14, 3.1],
      [y + 28.25, 2.65],
      [y + 29.15, 1.74],
      [y + 29.59, 0.77],
    ],
    lod === 0 ? 8 : lod === 1 ? 12 : 16,
    'roof',
    color.red,
  );
  shell(out, radial(d.towerCenter, 0.77, 8), () => y + 29.48, y + 30.35, plaster);
  crown(
    out,
    d.towerCenter,
    [
      [y + 30.29, 0.87],
      [y + 30.82, 0.21],
    ],
    8,
    'roof',
    color.redDark,
  );
  cross(out, d.towerCenter, y + 30.68, d.towerTop - 30.68, 0.65, 0.095);
}
function mainDome(out, d, lod) {
  const center = d.cupolaCenter,
    y = d.floor,
    n = [12, 16, 24, 32][lod];
  const oct = radial(center, 7.25, 8);
  shell(out, oct, () => y + 13.76, y + 16.98, plaster);
  cornice(out, radial(center, 7.38, 8), y + 16.61, 0.42);
  const drum = radial(center, 6.78, 8);
  shell(out, drum, () => y + 16.81, y + 18.48, plaster);
  if (lod > 0)
    for (const [a, b] of pairs(closed(drum))) {
      const w = edge(a, b),
        x = w.length / 2;
      arch(out, w, x, y + 17.05, y + 17.78, 0.66, 0.41, 0.022, lod, archColors, archSlots);
    }
  cornice(out, radial(center, 6.87, 16), y + 18.44, 0.23);
  const dome = [
    [y + 18.58, 6.82],
    [y + 19.52, 6.78],
    [y + 20.79, 6.37],
    [y + 22.03, 5.35],
    [y + 23.06, 3.95],
    [y + 23.64, 2.2],
    [y + 23.8, 0.78],
  ];
  crown(out, center, lod === 0 ? dome.filter((_, i) => i % 2 === 0) : dome, n, 'roof', color.red);
  const lantern = radial(center, 0.96, 8);
  shell(out, lantern, () => y + 23.69, y + 24.85, plaster);
  crown(
    out,
    center,
    [
      [y + 24.74, 1.02],
      [y + 25.22, 0.11],
    ],
    8,
    'roof',
    color.redDark,
  );
  cross(out, center, y + 25.13, d.domeTop - 25.13, 0.61, 0.085);
}
function frontTrim(out, w, center, y, depth, lod) {
  const outline = lod === 0 ? profile.filter((_, i) => i % 2 === 0 || i === 9) : profile;
  const points = outline.map(([v, h]) => [center + v * 8.13, y + 15.05 + h * 2.25]);
  const wallPoly = [
    [center - 8.13, y - 0.24],
    [center + 8.13, y - 0.24],
    ...points.slice().reverse(),
  ];
  const triangles = earcut(wallPoly.flat());
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      'plaster',
      triangles.slice(i, i + 3).map((j) => w.p(...wallPoly[j], depth)),
      w.normal,
      color.white,
    );
  for (const [a, b] of pairs(points)) {
    face(
      out,
      'stone',
      [
        w.p(a[0], a[1] - 0.22, depth + 0.05),
        w.p(b[0], b[1] - 0.22, depth + 0.05),
        w.p(...b, depth + 0.05),
        w.p(...a, depth + 0.05),
      ],
      w.normal,
      color.stone,
    );
    face(
      out,
      'stone',
      [
        w.p(...a, depth + 0.06),
        w.p(...b, depth + 0.06),
        w.p(b[0], b[1], depth - 0.58),
        w.p(a[0], a[1], depth - 0.58),
      ],
      up,
      color.stone,
    );
  }
  for (const side of [-1, 1]) {
    const x = center + side * 7.67;
    panel(out, 'stone', w, x - 0.46, x + 0.46, y + 0.24, y + 14.85, depth + 0.06, color.stone);
    panel(out, 'stone', w, x - 0.58, x + 0.58, y + 0.21, y + 0.64, depth + 0.085, color.shadow);
    panel(out, 'stone', w, x - 0.58, x + 0.58, y + 14.59, y + 15.04, depth + 0.08, color.shadow);
    if (lod > 1)
      panel(out, 'stone', w, x - 0.27, x + 0.27, y + 0.74, y + 14.45, depth + 0.1, color.shade);
  }
  const roseY = y + 11.44,
    n = [10, 14, 20, 28][lod];
  const rose = Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return [center + 1.12 * Math.cos(t), roseY + 1.12 * Math.sin(t)];
  });
  face(
    out,
    'glazing',
    rose.map((p) => w.p(...p, depth + 0.035)),
    w.normal,
    color.dark,
  );
  for (const [a, b] of pairs(closed(rose))) {
    const outer = ([u, v]) => [center + (u - center) * 1.18, roseY + (v - roseY) * 1.18];
    face(
      out,
      'stone',
      [
        w.p(...a, depth + 0.059),
        w.p(...b, depth + 0.059),
        w.p(...outer(b), depth + 0.065),
        w.p(...outer(a), depth + 0.065),
      ],
      w.normal,
      color.stone,
    );
  }
  if (lod > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const p = w.p(center + 0.97 * Math.cos(a), roseY + 0.97 * Math.sin(a), depth + 0.075);
      const q = w.p(center + 0.25 * Math.cos(a), roseY + 0.25 * Math.sin(a), depth + 0.075);
      beam(out, 'stone', p, q, 0.052, 0.041, color.stone);
    }
  }
  arch(out, w, center, y + 14.11, y + 15.4, 0.56, 0.54, depth + 0.051, lod, archColors, archSlots);
  const portalDepth = depth + 0.09;
  arch(
    out,
    w,
    center,
    y + 0.56,
    y + 4.03,
    2.8,
    2.62,
    portalDepth,
    lod,
    { ...archColors, width: 0.48 },
    { inner: 'wood', trim: 'stone' },
  );
  panel(
    out,
    'wood',
    w,
    center - 2.3,
    center + 2.3,
    y + 0.65,
    y + 4.02,
    portalDepth + 0.08,
    color.wood,
  );
  panel(
    out,
    'stone',
    w,
    center - 2.77,
    center + 2.77,
    y + 3.91,
    y + 4.1,
    portalDepth + 0.1,
    color.stone,
  );
  if (lod > 1) {
    for (let i = 0; i <= 12; i++) {
      const a = (Math.PI * i) / 12;
      const p = w.p(center + 2.53 * Math.cos(a), y + 4.05 + 2.33 * Math.sin(a), portalDepth + 0.09);
      const q = w.p(center + 0.42 * Math.cos(a), y + 4.05 + 0.42 * Math.sin(a), portalDepth + 0.09);
      beam(out, 'stone', p, q, lod === 3 ? 0.115 : 0.083, 0.07, color.shadow);
    }
    for (const x of [-2.3, -1.13, 0, 1.13, 2.3])
      panel(
        out,
        'stone',
        w,
        center + x - 0.037,
        center + x + 0.037,
        y + 0.66,
        y + 3.9,
        portalDepth + 0.097,
        color.stone,
      );
  }
}
function footprint(out, d, lod, ground) {
  const y = d.floor;
  const s = areaSign(d.outline);
  for (const [i, [a, b]] of pairs(closed(d.outline)).entries()) {
    const w = edge(a, b, s);
    const h = [0, 1, 2, 3, 14, 15, 16, 17].includes(i) ? y + 9.2 : y + 6.45;
    face(
      out,
      'plaster',
      [
        at(a, Math.min(ground(a) - 0.27, y - 0.3)),
        at(b, Math.min(ground(b) - 0.27, y - 0.3)),
        at(b, h),
        at(a, h),
      ],
      w.normal,
      color.white,
    );
    panel(out, 'stone', w, 0, w.length, y + 0.18, y + 0.46, 0.02, color.stone);
    if (lod > 0 && w.length > 4 && i !== 2) {
      const n = Math.max(1, Math.floor(w.length / 4.6));
      for (let k = 0; k < n; k++) {
        const u = (w.length * (k + 0.5)) / n;
        opening(
          out,
          w,
          u - 0.58,
          u + 0.58,
          y + 2.2,
          y + 4.72,
          'stone',
          color.glass,
          'glazing',
          color.stone,
          lod,
          0.028,
        );
      }
    }
  }
  cap(out, 'roof', d.outline, y + 6.44, color.redDark);
}
function sacristyRoofs(out, y, lod) {
  hipped(out, [13, 6.18, 23.63, 30.7], y + 6.2, y + 7.37, y + 8.44);
  hipped(out, [-5.35, 23, 13, 30.75], y + 6.2, y + 7.55, y + 8.49, true);
  hipped(out, [12.18, -2.94, 16.91, 5.2], y + 6.2, y + 7.28, y + 8.18);
  if (lod > 0) {
    const w = edge([23.63, 6.18], [23.63, 29.85]);
    for (const x of [3.5, 8, 12.5, 17, 21.5])
      panel(out, 'stone', w, x - 0.68, x + 0.68, y + 4.94, y + 5.09, 0.031, color.stone);
  }
}
function draw(out, lod, d, ground) {
  const y = d.floor;
  footprint(out, d, lod, ground);
  sacristyRoofs(out, y, lod);
  hipped(out, [-3.65, -31.38, 12.02, 15.9], y + 8.8, y + d.mainEaves, y + d.naveCrown);
  hipped(out, [-15.56, 5.75, 20.93, 19.91], y + 6.34, y + 12.45, y + 14.82, true);
  hipped(out, [-3.46, 16.12, 12.05, 26.43], y + 7.44, y + 13.1, y + 15.51);
  if (lod > 0) {
    for (const wall of [
      { w: edge([12.02, -29], [12.02, 5.9]), a: 5.4, b: 30 },
      { w: edge([-3.65, 5.9], [-3.65, -29]), a: 2, b: 29 },
    ]) {
      panel(out, 'stone', wall.w, 0, wall.w.length, y + 14.91, y + 15.13, 0.07, color.stone);
      for (let j = wall.a; j < wall.b; j += 6.2)
        arch(out, wall.w, j, y + 10.34, y + 12.62, 0.79, 0.79, 0.026, lod, archColors, archSlots);
    }
  }
  const front = edge([-4.01, d.facadeZ - 0.77], [12.98, d.facadeZ + 0.039]);
  const center = ((d.facadeAxis + 4.01) * Math.hypot(16.99, 0.809)) / 16.99;
  frontTrim(out, front, center, y, 0.045, lod);
  cross(out, [d.facadeAxis, d.facadeZ + 0.06], y + 18.41, 1.13, 0.86, 0.095);
  for (let i = 0; i < [1, 2, 3, 4][lod]; i++)
    block(
      out,
      'stone',
      d.facadeAxis - 2.84,
      y - 0.23,
      d.facadeZ - 0.65 - 0.46 * i,
      5.68,
      0.72 - 0.14 * i,
      0.5,
      color.stone,
    );
  tower(out, d, lod, ground);
  mainDome(out, d, lod);
}

const basilica = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-68, 53, -85],
    lookAt: [3, 12, -1],
    yaw: 0.75,
    sun: [-90, 170, -105],
    brief:
      'The standing 1986 Mission Basilica, identified by its white Mission Revival frontage, stacked octagonal bell stages and terracotta central cupola.',
    views: [
      { name: 'mission-revival-front-and-belfry', position: [-31, 15, -61], lookAt: [1, 13, -27] },
      {
        name: 'mission-parapet-rose-and-fan-portal',
        position: [1.5, 8, -49],
        lookAt: [4.6, 8.9, -31],
      },
      { name: 'cupola-and-cross-shaped-wings', position: [-34, 30, 41], lookAt: [2, 12, 7] },
      { name: 'octagonal-terracotta-bell-tower', position: [-22, 24, -48], lookAt: [-8, 22, -24] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = basilica;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...basilica.model,
  category: 'religious',
  recipeDependencies: [...basilica.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent exterior reconstruction from public-domain Qualla references, mapped church outline and original USGS bare-earth elevations.',
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.93,
    basis:
      'Replaces only the high-overlap mapped footprint of the current basilica; nearby mission property stays visible.',
  },
};
