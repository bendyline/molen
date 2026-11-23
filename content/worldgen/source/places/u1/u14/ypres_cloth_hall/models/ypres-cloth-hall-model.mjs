import fs from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const plan = read('../plan-controls.json');
const frame = read('../map-frame.json');
const { annex } = read('../native-map/ypres-cloth-hall-attached-nieuwerck.json');
const { outline, holes: courts } = frame.geometry;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92 },
  dress: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.9 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.89 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79, metallic: 0.22 },
};
const ashlar = rgb('ad9e85');
const paleStone = rgb('c0b59d');
const weatheredStone = rgb('968975');
const lowerStone = rgb('918471');
const slate = rgb('626c71');
const slateDark = rgb('4d585d');
const glass = rgb('4e5b56');
const shadow = rgb('343b35');
const door = rgb('635246');
const gold = rgb('bfab67');
const trim = rgb('666763');
const tau = 2 * Math.PI;
const d = plan.dimensions;
const eave = d.mainEavesEstimate;
const towerCenter = [3.56, 7.16];

function cap(out, slot, ring, holes, y, tint) {
  const points = [...ring];
  const starts = [];
  for (const hole of holes) {
    starts.push(points.length);
    points.push(...hole);
  }
  const triangles = earcut(points.flat(), starts);
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((index) => {
      const [x, z] = points[index];
      return [x, y, z];
    });
    tri(out, slot, a, c, b, tint);
  }
}

function block(out, slot, [x0, z0, x1, z1], base, top, tint) {
  abox(out, slot, [x0, base, z0], [x1, top, z1], tint, { bottom: false });
}

function panel(out, slot, F, lo, hi, bottom, top, depth, color) {
  quad4(
    out,
    slot,
    F.P(lo, bottom, depth),
    F.P(hi, bottom, depth),
    F.P(hi, top, depth),
    F.P(lo, top, depth),
    color,
  );
}

function arch(out, F, u, bottom, width, height, lod, options = {}) {
  const {
    tone = glass,
    slot = 'glass',
    inset = 0.045,
    trimWidth = 0.17,
    mullion = true,
    ornament = false,
  } = options;
  const half = width / 2;
  const rise = width * 0.58;
  const spring = bottom + height - rise;
  const curve = pointedArch(half, rise, lod > 1 ? 4 : 2);
  const border = [[-half, bottom], ...curve.map(([x, y]) => [x, y + spring]), [half, bottom]];
  for (let i = 0; i < border.length - 1; i++) {
    const [a, b] = border[i];
    const [c, d] = border[i + 1];
    if (i < border.length - 2)
      tri(
        out,
        slot,
        F.P(u + half, bottom, inset),
        F.P(u + c, d, inset),
        F.P(u + a, b, inset),
        tone,
      );
    if (trimWidth > 0) {
      const stretch = (x) => x * (1 + trimWidth / half);
      const enlarge = (y) => (y < spring ? y : y + (trimWidth * (y - spring)) / rise);
      quad4(
        out,
        'dress',
        F.P(u + stretch(a), enlarge(b), inset + 0.045),
        F.P(u + a, b, inset + 0.045),
        F.P(u + c, d, inset + 0.045),
        F.P(u + stretch(c), enlarge(d), inset + 0.045),
        paleStone,
      );
    }
  }
  if (mullion && lod > 1) {
    panel(
      out,
      'dress',
      F,
      u - 0.063,
      u + 0.063,
      bottom,
      spring + rise * 0.35,
      inset + 0.055,
      paleStone,
    );
    panel(
      out,
      'dress',
      F,
      u - half,
      u + half,
      bottom + 0.45 * (spring - bottom),
      bottom + 0.45 * (spring - bottom) + 0.086,
      inset + 0.055,
      paleStone,
    );
  }
  if (ornament && lod === 3) {
    for (const sign of [-1, 1]) {
      const offset = sign * width * 0.23;
      const y = spring + rise * 0.07;
      panel(
        out,
        'dress',
        F,
        u + offset - 0.037,
        u + offset + 0.037,
        spring - 0.33,
        y + 0.23,
        inset + 0.047,
        paleStone,
      );
    }
    for (const v of [-0.5, 0, 0.5])
      panel(
        out,
        'dress',
        F,
        u + v * half - 0.048,
        u + v * half + 0.048,
        spring - 0.013,
        spring + 0.095,
        inset + 0.082,
        paleStone,
      );
  }
}

const roofRanges = [
  // South market wing. The belfry stands across its ridge at the main entrance.
  {
    edge: [
      [-60.13, 14.37],
      [66.26, 14.34],
      [64.99, -0.23],
      [-59.95, -0.55],
    ],
    ridge: [
      [-59.42, 6.88],
      [64.25, 7.01],
    ],
    top: eave + 11.75,
  },
  {
    edge: [
      [-61.92, -36.44],
      [-46.76, -31.92],
      [-46.83, 7.39],
      [-60.13, 13.65],
    ],
    ridge: [
      [-53.98, -32.89],
      [-53.7, 7.05],
    ],
    top: eave + 10.95,
  },
  {
    edge: [
      [-61.77, -36.47],
      [9.81, -18.35],
      [2.16, -5.72],
      [-48.13, -18.22],
    ],
    ridge: [
      [-54.5, -26.71],
      [2.92, -13.79],
    ],
    top: eave + 10.48,
  },
  {
    edge: [
      [9.82, -18.57],
      [63.01, -18.68],
      [64.05, -5.39],
      [10.96, -5.46],
    ],
    ridge: [
      [11.56, -12.3],
      [61.35, -12.22],
    ],
    top: eave + 10.43,
  },
  {
    edge: [
      [62.96, -18.72],
      [66.26, 14.34],
      [46.56, 12.87],
      [47.2, -18.52],
    ],
    ridge: [
      [55.01, -15.65],
      [56.48, 7.73],
    ],
    top: eave + 11.6,
  },
  {
    edge: [
      [9.28, -20.36],
      [11.51, 1.3],
      [1.44, 1.05],
      [1.9, -20.25],
    ],
    ridge: [
      [5.37, -18.33],
      [6.24, -1.59],
    ],
    top: eave + 7.65,
  },
];

function roofRange(out, { edge, ridge, top }) {
  const [a, b, c, f] = edge.map(([x, z]) => [x, eave, z]);
  const [p, q] = ridge.map(([x, z]) => [x, top, z]);
  const reverse = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0;
  for (const [x, y, z] of [
    [b, a, p],
    [b, p, q],
    [c, b, q],
    [f, c, q],
    [f, q, p],
    [a, f, p],
  ])
    tri(out, 'slate', x, reverse ? z : y, reverse ? y : z, slate);
}

function frontage(out, lod) {
  const courses = [
    [0.6, 0.87],
    [4.12, 4.39],
    [7.46, 7.73],
    [13.6, 13.86],
    [15.37, 15.68],
  ];
  const wings = [
    [[-59.982, 14.139], [-3.238, 14.372], 16],
    [[10.918, 14.364], [66.061, 14.139], 16],
  ];
  for (const [a, b, count] of wings) {
    const market = wallFace(a, b);
    const west = 0.28;
    const east = market.length - 0.28;
    for (const [low, high] of courses)
      fbox(out, 'dress', market, west, east, low, high, -0.15, 0.14, weatheredStone);
    for (let i = 0; i < count; i++) {
      const u = west + ((i + 0.5) * (east - west)) / count;
      if (lod === 1) {
        panel(out, 'door', market, u - 0.67, u + 0.67, 0.87, 3.92, 0.039, door);
        panel(out, 'glass', market, u - 0.81, u + 0.81, 8.1, 12.73, 0.04, glass);
        continue;
      }
      panel(out, 'door', market, u - 0.7, u + 0.7, 0.84, 3.92, 0.055, door);
      arch(out, market, u, 4.51, 1.56, 2.57, lod, { tone: shadow });
      arch(out, market, u, 7.92, 1.97, 5.37, lod, { ornament: true });
      if (lod === 3) {
        for (const offset of [-0.56, 0.56])
          arch(out, market, u + offset, 13.95, 0.6, 1.29, 2, {
            tone: weatheredStone,
            mullion: false,
            trimWidth: 0.085,
          });
        panel(out, 'dress', market, u - 0.057, u + 0.057, 1.15, 3.82, 0.076, paleStone);
      }
    }
  }
}

function secondaryFacades(out, lod) {
  const stretches = [
    [[-59.83, 13.89], [-61.73, -34.75], 12],
    [[-61.72, -36.24], [5.82, -19.68], 12],
    [[10.49, -18.43], [62.83, -18.48], 12],
    [[-47.06, -0.2], [-6.36, 0.18], 9],
    [[-47.95, -18.45], [-47.06, -0.2], 4],
    [[1.83, -5.98], [-47.94, -18.47], 9],
    [[12.29, 0.55], [46.66, 0.94], 7],
    [[46.78, -5.44], [11.87, -5.68], 7],
  ];
  for (const [a, b, count] of stretches) {
    const F = wallFace(b, a);
    const lim = F.length;
    fbox(out, 'dress', F, 0, lim, eave - 0.6, eave - 0.31, -0.075, 0.11, weatheredStone);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * lim) / count;
      if (lod === 1) {
        panel(out, 'glass', F, u - 0.62, u + 0.62, 8.55, 12.36, 0.048, glass);
        continue;
      }
      arch(out, F, u, 7.82, 1.53, 4.58, lod, { trimWidth: 0.12 });
      if (lod === 3)
        arch(out, F, u, 1.2, 1.38, 3.54, 1, {
          tone: door,
          slot: 'door',
          mullion: false,
          trimWidth: 0.125,
        });
    }
  }
}

function roofOrnament(out, lod) {
  const [west, east] = [-59.42, 64.25];
  const y = eave + 11.75;
  const ridge = facade([west, 6.94], [1, 0]);
  fbox(out, 'metal', ridge, 0, east - west, y - 0.08, y + 0.13, -0.09, 0.09, trim);
  if (lod === 3)
    for (let u = 0.42; u < east - west; u += 0.93)
      fbox(out, 'metal', ridge, u - 0.07, u + 0.07, y + 0.07, y + 0.59, -0.04, 0.04, trim);
  for (const x of [-54, -43, -32, -21, -10, 15, 26, 37, 48, 59]) {
    const cy = eave + 4.53;
    const z = 11.55;
    const F = facade([x, z], [1, 0]);
    if (lod === 0) continue;
    fbox(out, 'stone', F, -0.61, 0.61, cy - 0.34, cy + 1.35, -1.32, 0.34, ashlar);
    panel(out, 'glass', F, -0.27, 0.27, cy + 0.06, cy + 0.96, 0.354, shadow);
    const tip = F.P(0, cy + 2.13, 0.44);
    tri(out, 'dress', F.P(-0.68, cy + 1.35, 0.44), F.P(0.68, cy + 1.35, 0.44), tip, paleStone);
    for (const s of [-1, 1]) {
      const a = F.P(s * 0.73, cy + 1.3, 0.44);
      const b = F.P(s * 0.73, cy + 1.58, -1.58);
      const c = F.P(0, cy + 2.27, -1.58);
      quad4(out, 'slate', ...(s > 0 ? [a, b, c, tip] : [b, a, tip, c]), slateDark);
    }
  }
}

function shaft(out, slot, center, profile, sides, color) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 4)),
    color,
    { cap: false },
  );
}

function turret(out, center, bottom, top, radius, lod) {
  const sides = lod === 0 ? 4 : 8;
  const shoulder = bottom + (top - bottom) * 0.62;
  shaft(
    out,
    'dress',
    center,
    [
      [bottom, radius],
      [bottom + 0.43, radius * 1.15],
      [shoulder - 0.7, radius * 0.9],
      [shoulder, radius],
    ],
    sides,
    paleStone,
  );
  shaft(
    out,
    'stone',
    center,
    [
      [shoulder, radius],
      [top - 0.72, radius * 0.19],
      [top, radius * 0.05],
    ],
    sides,
    ashlar,
  );
  if (lod < 2) return;
  const count = lod === 3 ? 9 : 5;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.25) / count;
    const y = shoulder + (top - shoulder) * t;
    const r = radius * (1 - t) * 1.02 + 0.055;
    shaft(
      out,
      'dress',
      center,
      [
        [y, r],
        [y + 0.17, r * 1.08],
        [y + 0.32, r * 0.91],
      ],
      4,
      paleStone,
    );
  }
}

function dial(out, F, u, y, r, lod) {
  const center = F.P(u, y, 0.24);
  const sides = lod === 1 ? 12 : 24;
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides;
    const b = (tau * (i + 1)) / sides;
    const P = (angle, dist, depth) =>
      F.P(u + Math.cos(angle) * dist, y + Math.sin(angle) * dist, depth);
    tri(out, 'door', center, P(a, r, 0.24), P(b, r, 0.24), shadow);
    quad4(
      out,
      'metal',
      P(a, r, 0.28),
      P(b, r, 0.28),
      P(b, r * 0.92, 0.28),
      P(a, r * 0.92, 0.28),
      gold,
    );
  }
  for (let i = 0; i < 12; i++) {
    const a = (tau * i) / 12;
    const P = (distance, side) =>
      F.P(
        u + r * (Math.cos(a) * distance - Math.sin(a) * side),
        y + r * (Math.sin(a) * distance + Math.cos(a) * side),
        0.31,
      );
    quad4(out, 'metal', P(0.65, -0.022), P(0.86, -0.022), P(0.86, 0.022), P(0.65, 0.022), gold);
  }
  for (const [theta, length] of [
    [Math.PI * 0.2, 0.66],
    [Math.PI * 0.82, 0.5],
  ]) {
    const x = Math.cos(theta) * r * length;
    const high = Math.sin(theta) * r * length;
    tri(
      out,
      'metal',
      F.P(u - 0.075, y - 0.082, 0.34),
      F.P(u + 0.075, y - 0.066, 0.34),
      F.P(u + x, y + high, 0.34),
      gold,
    );
  }
}

function belfry(out, lod) {
  const [x, z] = towerCenter;
  const lower = [x - 6.67, z - 7.01, x + 6.67, z + 7.02];
  const upper = [x - 6.31, z - 6.65, x + 6.31, z + 6.66];
  const parapet = d.towerParapetEstimate;
  block(out, 'stone', lower, -1.4, 26.09, ashlar);
  block(out, 'stone', upper, 25.93, parapet, ashlar);
  block(
    out,
    'dress',
    [x - 6.45, z - 6.75, x + 6.45, z + 6.75],
    parapet - 0.8,
    parapet + 0.08,
    paleStone,
  );
  shaft(
    out,
    'slate',
    towerCenter,
    [
      [parapet - 0.31, 7.35],
      [parapet + 1.22, 7.38],
      [58.55, 2.07],
      [61.72, 1.76],
    ],
    lod ? 8 : 4,
    slateDark,
  );
  shaft(
    out,
    'dress',
    towerCenter,
    [
      [61.33, 1.78],
      [61.64, 1.92],
      [63.05, 1.77],
      [63.4, 1.88],
    ],
    lod ? 8 : 4,
    paleStone,
  );
  shaft(
    out,
    'slate',
    towerCenter,
    [
      [63.33, 2.29],
      [65.8, 1.18],
      [68.53, 0.25],
    ],
    lod ? 8 : 4,
    slateDark,
  );
  shaft(
    out,
    'metal',
    towerCenter,
    [
      [68.49, 0.27],
      [68.89, 0.21],
      [d.belfryHeight, 0.046],
    ],
    6,
    gold,
  );
  if (lod > 0) {
    const lantern = radialRing(62.85, 1.82, 1.82, 8, towerCenter, Math.PI / 4);
    for (let i = 0; i < lantern.length; i++) {
      const [ax, , az] = lantern[i];
      const [bx, , bz] = lantern[(i + 1) % lantern.length];
      const F = wallFace([ax, az], [bx, bz]);
      panel(out, 'glass', F, 0.11, F.length - 0.11, 61.94, 63.06, 0.045, shadow);
    }
  }
  const streetEdges = [
    facade([lower[0], lower[3]], [1, 0]),
    facade([lower[2], lower[1]], [-1, 0]),
    facade([lower[2], lower[3]], [0, -1]),
    facade([lower[0], lower[1]], [0, 1]),
  ];
  const upperEdges = [
    facade([upper[0], upper[3]], [1, 0]),
    facade([upper[2], upper[1]], [-1, 0]),
    facade([upper[2], upper[3]], [0, -1]),
    facade([upper[0], upper[1]], [0, 1]),
  ];
  for (const i of [0, 1, 2, 3]) {
    const F = streetEdges[i];
    const U = upperEdges[i];
    const upperCenter = (i < 2 ? 12.62 : 13.31) * 0.5;
    const span = i < 2 ? 13.34 : 14.03;
    const u = span / 2;
    for (const y of lod === 0 ? [] : [6.89, 14.58, 24.35, 32.55, 41.58, 43.29])
      fbox(out, 'dress', F, -0.23, span + 0.23, y, y + 0.21, -0.42, lod ? 0.25 : 0.06, paleStone);
    const count = lod ? 8 : 3;
    for (let j = 0; j < count; j++) {
      const a = 1.55 + (j * (span - 3.1)) / (count - 1);
      fbox(
        out,
        'dress',
        F,
        a - 0.35,
        a + 0.35,
        parapet - 0.18,
        parapet + 0.88,
        -0.63,
        -0.05,
        paleStone,
      );
    }
    if (lod === 0) continue;
    if (i === 0 || i === 1)
      arch(out, F, u, 0.59, 3.32, 6.57, lod, { tone: shadow, mullion: false, trimWidth: 0.32 });
    for (const off of [-3.0, 0, 3.0]) {
      arch(out, F, u + off, 8.21, 1.76, 5.97, lod, { ornament: true });
      arch(out, F, u + off, 16.33, 1.9, 6.24, lod, { ornament: true });
      arch(out, U, upperCenter + off, 26.13, 1.87, 6.0, lod, { ornament: true });
      if (lod > 1)
        arch(out, U, upperCenter + off, 33.01, 2.1, 7.85, lod, {
          tone: shadow,
          mullion: off !== 0,
          ornament: true,
        });
    }
    dial(out, U, upperCenter, 36.95, 2.15, lod);
    if (lod > 1)
      for (let n = 0; n < 10; n++)
        arch(out, F, 1.52 + (n * (span - 3.04)) / 9, 14.87, 0.57, 1.22, 1, {
          tone: weatheredStone,
          trimWidth: 0.09,
          mullion: false,
        });
  }
  for (const dx of [-6.13, 6.13]) {
    for (const dz of [-6.56, 6.56]) {
      turret(out, [x + dx, z + dz], 28.0, d.towerParapetEstimate + 11.82, 0.97, lod);
      if (lod > 0)
        shaft(
          out,
          'dress',
          [x + dx, z + dz],
          [
            [0.13, 0.7],
            [14.19, 0.61],
            [26.1, 0.94],
            [42.53, 0.91],
          ],
          6,
          paleStone,
        );
    }
  }
}

function passage(out, F, width, spring, top, lod) {
  const curve = roundArch(width / 2, lod > 1 ? 9 : lod === 1 ? 5 : 3);
  const archY = ([, y]) => spring + y * 0.42;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    quad4(
      out,
      'stone',
      F.P(a[0], archY(a), 0),
      F.P(b[0], archY(b), 0),
      F.P(b[0], top, 0),
      F.P(a[0], top, 0),
      ashlar,
    );
    quad4(
      out,
      'dress',
      F.P(b[0], archY(b), -0.65),
      F.P(a[0], archY(a), -0.65),
      F.P(a[0], archY(a), 0),
      F.P(b[0], archY(b), 0),
      paleStone,
    );
  }
}

function nieuwerck(out, lod) {
  const h = 14.12;
  const span = annex.local;
  extrude(out, 'stone', span, 4.16, h, paleStone, { top: false });
  cap(out, 'slate', span, [], h, slate);
  const F = wallFace([66.04, 14.15], [72.45, 13.515]);
  const mid = F.length / 2;
  passage(out, facade([69.23, 13.846], F.along), 5.84, 2.26, 4.18, lod);
  for (const u of [0.1, F.length - 0.1])
    fbox(out, 'dress', F, u - 0.26, u + 0.26, -0.65, 14.48, -0.48, 0.25, paleStone);
  const side = wallFace([72.454, 13.515], [69.355, -17.812]);
  for (let i = 0; i < 6; i++) {
    const u = ((i + 0.5) * side.length) / 6;
    const [a, , b] = side.P(u, 0, 0);
    passage(out, facade([a, b], side.along), 4.55, 2.26, 4.18, lod);
    fbox(out, 'dress', side, u - 2.6, u - 2.16, -0.52, 4.35, -0.68, 0.23, paleStone);
    if (lod > 0)
      for (const floor of [5.85, 9.24, 12.14]) {
        for (const offset of [-0.91, 0.91])
          panel(
            out,
            'glass',
            side,
            u + offset - 0.59,
            u + offset + 0.59,
            floor,
            floor + 1.72,
            0.06,
            glass,
          );
      }
  }
  fbox(
    out,
    'dress',
    side,
    side.length - 0.28,
    side.length + 0.03,
    -0.52,
    4.35,
    -0.67,
    0.18,
    paleStone,
  );
  for (const [spanWidth, baseY, high] of [
    [5.84, 13.65, 15.62],
    [4.61, 15.5, 17.02],
    [3.12, 16.88, 18.46],
    [1.69, 18.34, 19.75],
  ])
    fbox(
      out,
      'dress',
      F,
      mid - spanWidth / 2,
      mid + spanWidth / 2,
      baseY,
      high,
      -1.08,
      0.12,
      paleStone,
    );
  tri(
    out,
    'dress',
    F.P(mid - 0.97, 19.62, 0.16),
    F.P(mid + 0.97, 19.62, 0.16),
    F.P(mid, 21.03, 0.16),
    paleStone,
  );
  if (lod > 0) {
    for (const y of [5.12, 8.34, 11.22, 13.65])
      fbox(out, 'dress', F, -0.02, F.length + 0.02, y, y + 0.22, -0.24, 0.23, weatheredStone);
    for (const y of [5.66, 8.93, 11.74, 14.86])
      for (const u of [-1.75, -0.58, 0.58, 1.75])
        panel(out, 'glass', F, mid + u - 0.38, mid + u + 0.38, y, y + 1.48, 0.27, glass);
    if (lod > 1) {
      for (const x of [-2.13, 2.13])
        for (const y of [5.66, 8.93, 11.74])
          fbox(
            out,
            'dress',
            F,
            mid + x - 0.1,
            mid + x + 0.1,
            y - 0.17,
            y + 1.69,
            -0.04,
            0.32,
            paleStone,
          );
      arch(out, F, mid, 17.03, 0.83, 1.42, lod, { trimWidth: 0.13, mullion: false });
    }
  }
}

// The distant shell keeps both courts and the full silhouette without the small pier jogs.
const skylineOutline = [0, 2, 3, 18, 19, 27, 28, 33, 34, 39, 40].map((index) => outline[index]);
const skylineCourts = [
  [0, 8, 9, 10, 11, 13].map((index) => courts[0][index]),
  [0, 1, 2, 3, 4].map((index) => courts[1][index]),
];

function build(out, lod) {
  const edge = lod === 0 ? skylineOutline : outline;
  const holes = lod === 0 ? skylineCourts : courts;
  extrude(out, 'foundation', edge, -3.2, 0.49, lowerStone, { holes, top: false });
  extrude(out, 'stone', edge, 0.49, eave, ashlar, { holes, top: false });
  cap(out, 'stone', edge, holes, eave - 0.035, ashlar);
  for (const range of roofRanges) roofRange(out, range);
  belfry(out, lod);
  nieuwerck(out, lod);
  turret(out, [-57.43, 13.06], eave - 0.93, 36.42, 0.77, lod);
  turret(out, [64.56, 12.94], eave - 0.93, 40.02, 0.98, lod);
  turret(out, [63.28, -17.43], eave - 0.71, 33.36, 0.68, lod);
  if (lod > 0) {
    frontage(out, lod);
    secondaryFacades(out, lod);
    roofOrnament(out, lod);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'ypres-cloth-hall-model.mjs';
const camera = [119, 59, 146];
const lookAt = [5, 24, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The reconstructed Ypres Cloth Hall with the market belfry, two open courts, Gothic sandstone ranges and attached Renaissance Nieuwerck.',
  camera,
  lookAt,
  sunDirection: [-33, 47, 65],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    holes: courts,
    minimumCoverage: 0.91,
    basis: 'The named Cloth Hall polygon and two open courtyards.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'market-front-and-belfry', position: [48, 16, 152], lookAt: [4, 25, 12] },
    { name: 'two-courts-and-hall-roofs', position: [-107, 103, -122], lookAt: [4, 16, -5] },
    { name: 'nieuwerck-and-gothic-frontage', position: [105, 15, 64], lookAt: [49, 13, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ypres-cloth-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.83,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.82, surfaces },
      street: { export: 'street', errorMeters: 0.27, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
