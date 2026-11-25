import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/basilica-of-sainte-anne-de-beaupre-shape-controls');
const frontZ = site.frontWallZ + 0.15;
const front = facade([0, frontZ], [1, 0]);
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.77 },
  door: { slot: 'door', graph: 'metal_copper', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#465052', roughness: 0.57 },
};
const colors = {
  granite: rgb('aeaca3'),
  trim: rgb('c5c0b0'),
  base: rgb('98958b'),
  copper: rgb('728d7e'),
  seam: rgb('698778'),
  glass: rgb('424b4e'),
  panes: ['536163', '425756', '5b584f', '4d5260', '655857'].map(rgb),
  door: rgb('80643f'),
  gold: rgb('bf9e51'),
  shadow: rgb('555450'),
};

function rectangle(out, slot, F, x0, x1, y0, y1, depth, color) {
  quad4(
    out,
    slot,
    F.P(x0, y0, depth),
    F.P(x1, y0, depth),
    F.P(x1, y1, depth),
    F.P(x0, y1, depth),
    color,
  );
}

function outlineArch(out, F, u, spring, radius, band, depth, lod, color = colors.trim) {
  const arc = roundArch(radius, lod > 1 ? 12 : 6);
  const point = ([x, y], offset, d) =>
    F.P(u + x * (1 + offset / radius), spring + y * (1 + offset / radius), d);
  for (let i = 1; i < arc.length; i++) {
    const a = arc[i - 1],
      b = arc[i];
    quad4(
      out,
      'trim',
      point(a, 0, depth),
      point(b, 0, depth),
      point(b, band, depth),
      point(a, band, depth),
      color,
    );
    if (lod > 1)
      quad4(
        out,
        'trim',
        point(b, 0, depth),
        point(a, 0, depth),
        point(a, 0, depth - 0.14),
        point(b, 0, depth - 0.14),
        color,
      );
  }
}

function arched(out, F, u, y, width, height, lod, trim = colors.trim, glass = colors.glass) {
  if (!lod) return;
  if (lod < 2) {
    rectangle(
      out,
      'glass',
      F,
      u - width / 2,
      u + width / 2,
      y,
      y + height - width * 0.24,
      0.04,
      glass,
    );
    return;
  }
  if (lod === 2) {
    const radius = width / 2;
    const spring = y + height - radius;
    rectangle(out, 'glass', F, u - radius, u + radius, y, spring, 0.055, glass);
    const arc = roundArch(radius, 6);
    for (let i = 1; i < arc.length; i++) {
      const [x, dy] = arc[i - 1];
      const [nextX, nextY] = arc[i];
      tri(
        out,
        'glass',
        F.P(u, spring, 0.055),
        F.P(u + nextX, spring + nextY, 0.055),
        F.P(u + x, spring + dy, 0.055),
        glass,
      );
    }
    outlineArch(out, F, u, spring, radius, 0.15, 0.12, 1, trim);
    return;
  }
  opening(out, F, u, y, width, height, {
    head: 'round',
    glassSlot: 'glass',
    frameSlot: 'trim',
    frame: trim,
    glass,
    frameWidth: 0.14,
    frameDepth: 0.21,
    d: 0.054,
    sill: false,
  });
}

function band(out, F, u, width, y, depth, thickness = 0.28, color = colors.trim) {
  fbox(out, 'trim', F, u - width / 2, u + width / 2, y, y + thickness, -0.07, depth, color);
}

function rose(out, F, u, y, r, lod) {
  const n = lod > 1 ? 32 : 16;
  const p = (i, radius, d) => {
    const a = (i * Math.PI * 2) / n;
    return F.P(u + radius * Math.cos(a), y + radius * Math.sin(a), d);
  };
  for (let i = 0; i < n; i++) {
    tri(
      out,
      'glass',
      F.P(u, y, 0.067),
      p(i, r, 0.067),
      p(i + 1, r, 0.067),
      colors.panes[Math.floor(i / 4) % colors.panes.length],
    );
    quad4(
      out,
      'trim',
      p(i, r, 0.17),
      p(i, r + 0.29, 0.17),
      p(i + 1, r + 0.29, 0.17),
      p(i + 1, r, 0.17),
      colors.trim,
    );
  }
  if (lod < 2) return;
  for (let i = 0; i < n; i += 2) {
    const root = F.P(u, y, 0.22);
    tri(out, 'trim', root, p(i + 0.21, r, 0.22), p(i + 0.5, r, 0.22), colors.trim);
    tri(out, 'trim', root, p(i + 0.21, r * 0.48, 0.225), p(i + 1.15, r * 0.48, 0.225), colors.trim);
    tri(
      out,
      'trim',
      p(i + 0.5, r * 0.73, 0.229),
      p(i + 1.25, r * 0.88, 0.229),
      p(i + 1.91, r * 0.73, 0.229),
      colors.trim,
    );
  }
}

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function gable(out, F, midpoint, span, bottom, top, depth, color = colors.granite) {
  tri(
    out,
    'granite',
    F.P(midpoint - span / 2, bottom, depth),
    F.P(midpoint + span / 2, bottom, depth),
    F.P(midpoint, top, depth),
    color,
  );
}

const curved = [
  { center: [23, -21.93], radius: 3.45, type: 'east' },
  { center: [-23, -21.9], radius: 3.6, type: 'west' },
  { center: [14.25, -29.72], radius: 3.73 },
  { center: [11.3, -35.8], radius: 3.5 },
  { center: [6.6, -40.14], radius: 3.15 },
  { center: [-6.8, -40.2], radius: 3.05 },
  { center: [-11.29, -35.87], radius: 3.48 },
  { center: [-14.45, -29.9], radius: 3.48 },
  { center: [-26.49, -7.5], radius: 5.09, type: 'west' },
  { center: [26.26, -7.35], radius: 4.86, type: 'east' },
];

function chapel(out, item, lod, index) {
  const { center, radius } = item;
  const top = index >= 8 ? 19.95 : 16.15;
  const n = lod > 1 ? 16 : 10;
  lathe(
    out,
    'granite',
    center,
    [
      [5.45, radius, radius],
      [top, radius, radius],
    ],
    n,
    colors.granite,
  );
  lathe(
    out,
    'copper',
    center,
    [
      [top, radius + 0.12, radius + 0.12],
      [top + 2.5, radius * 0.72, radius * 0.72],
      [top + 3.72, 0.68, 0.68],
    ],
    n,
    colors.copper,
  );
  if (lod < 2) return;
  const az =
    item.type === 'east'
      ? 0
      : item.type === 'west'
        ? Math.PI
        : Math.atan2(center[1] + 23, center[0]);
  for (const a of [az - 0.43, az + 0.43]) {
    const x = Math.cos(a),
      z = Math.sin(a);
    arched(
      out,
      facade([center[0] + x * radius * 0.983, center[1] + z * radius * 0.983], [z, -x]),
      0,
      top - 6.3,
      0.86,
      3.3,
      lod,
    );
  }
}

function apse(out, lod) {
  const z = site.apseCenterZ;
  const steps = lod > 1 ? 18 : 10;
  const semicircle = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (-Math.PI * i) / steps;
    return [16.3 * Math.cos(a), z + 15.2 * Math.sin(a)];
  });
  extrude(out, 'granite', semicircle, 14.6, 32.7, colors.granite, {
    topSlot: 'copper',
    topColor: colors.copper,
  });
  for (let i = 1; i < semicircle.length; i++) {
    const [x, za] = semicircle[i - 1],
      [xx, zb] = semicircle[i];
    const a = [x, 32.7, za],
      b = [xx, 32.7, zb];
    tri(out, 'copper', a, b, [0, 39.05, z], colors.copper);
    if (lod > 0 && i % (lod > 1 ? 2 : 1) === 0)
      arched(
        out,
        wallFace(semicircle[i - 1], semicircle[i]),
        Math.hypot(x - xx, za - zb) / 2,
        23.2,
        1.55,
        7.5,
        lod,
      );
  }
  for (const [i, item] of curved.entries()) if (lod || i >= 8) chapel(out, item, lod, i);
}

function nave(out, lod) {
  const base = lod ? site.outline : site.baseOutline;
  extrude(out, 'granite', base, -2.85, 12.75, colors.granite, {
    topSlot: 'trim',
    topColor: colors.base,
  });
  box(out, 'granite', -20.73, 20.78, -26, 41.2, 3.2, 17.0, colors.granite);
  box(out, 'granite', -13.95, 13.95, -24.1, 46, 15.1, 32.7, colors.granite);
  gableRoof(out, 'copper', [0, -24.1], [0, 46], 27.9, 32.65, 40.25, colors.copper);
  box(out, 'granite', -26.2, 26.1, -22.35, 11.95, 4.1, 20.8, colors.granite);
  box(out, 'granite', -26.05, 26.07, -11.15, 4.65, 19.5, 34.1, colors.granite);
  gableRoof(out, 'copper', [-26.05, -3.25], [26.07, -3.25], 15.8, 34.1, 42.2, colors.copper);
  for (const side of [-1, 1]) {
    const z0 = -25.96,
      z1 = 41.3;
    const lower = side > 0 ? site.naveWallsX[1] : site.naveWallsX[0];
    quad4(
      out,
      'copper',
      [lower, 17.03, side > 0 ? z1 : z0],
      [lower, 17.03, side > 0 ? z0 : z1],
      [13.98 * side, 21.05, side > 0 ? z0 : z1],
      [13.98 * side, 21.05, side > 0 ? z1 : z0],
      colors.copper,
    );
    const aisle = facade([lower, 40.75], [0, -side]);
    const clerestory = facade([13.96 * side, 40.75], [0, -side]);
    for (const [row, x, w, h] of [
      [aisle, 13.3, 4.35, 1.04],
      [clerestory, 23.0, 7.2, 0.9],
    ]) {
      for (let i = 0; i < 6; i++) {
        const u = side * (2.72 + i * 4.8);
        if (lod) {
          arched(out, row, u - 0.76, x, h, w, lod);
          arched(out, row, u + 0.76, x, h, w, lod);
          fbox(
            out,
            'trim',
            row,
            u + 2.08,
            u + 2.57,
            x - 0.6,
            x + w + 1.35,
            -0.08,
            0.85,
            colors.trim,
          );
        }
      }
    }
    if (lod > 2) {
      for (let i = 0; i < 20; i++) {
        const z = 12.55 + i * 1.47;
        const outer = [lower, 17.065, z];
        const inner = [13.99 * side, 21.085, z];
        const span = side > 0 ? [outer, inner] : [inner, outer];
        quad4(
          out,
          'copper',
          span[0],
          span[1],
          [span[1][0], span[1][1], z + 0.06],
          [span[0][0], span[0][1], z + 0.06],
          colors.seam,
        );
      }
    }
    const t = facade([26.11 * side, -3.25], [0, -side]);
    gable(out, t, 0, 17.9, 34.08, 42.12, 0.17);
    band(out, t, 0, 18.1, 33.42, 0.38, 0.32);
    if (lod) {
      arched(out, t, 0, 13.58, 7.25, 16.2, lod);
      for (const u of [-2.52, 0, 2.52]) arched(out, t, u, 13.65, 1.68, u === 0 ? 14.8 : 13.75, lod);
      for (let k = -4; k <= 4; k++) arched(out, t, k * 1.51, 31.18, 0.72, 2.1, lod);
    }
  }
  apse(out, lod);
}

function pinnacle(out, x, z, low, height, lod) {
  const r = height * 0.15;
  const n = lod > 1 ? 8 : 5;
  lathe(
    out,
    'trim',
    [x, z],
    [
      [low, r, r],
      [low + height * 0.62, r * 0.83, r * 0.83],
    ],
    n,
    colors.trim,
  );
  lathe(
    out,
    'trim',
    [x, z],
    [
      [low + height * 0.61, r * 0.94, r * 0.94],
      [low + height, r * 0.07, r * 0.07],
    ],
    n,
    colors.granite,
  );
}

function bellTower(out, x, lod) {
  const z = site.towerZ;
  const sculpted = lod > 1;
  box(out, 'granite', x - 6.26, x + 6.26, z - 6.7, frontZ, 3, 37.85, colors.granite);
  box(out, 'granite', x - 5.13, x + 5.13, z - 5.22, z + 5.17, 37.6, 53.55, colors.granite);
  const spireFoot = 53.5;
  lathe(
    out,
    'granite',
    [x, z],
    [
      [spireFoot, 5.45, 5.45],
      [61.7, 4.96, 4.96],
      [83.45, 1.29, 1.29],
      [87.85, 0.22, 0.22],
    ],
    8,
    colors.granite,
    { rotation: Math.PI / 8 },
  );
  box(
    out,
    'door',
    x - 0.115,
    x + 0.115,
    z - 0.115,
    z + 0.115,
    87.85,
    site.spireHeightAboveApproachM,
    colors.shadow,
  );
  box(out, 'door', x - 0.83, x + 0.83, z - 0.105, z + 0.105, 89.78, 90.02, colors.shadow);
  const faces = [
    facade([x, z + 5.177], [1, 0]),
    facade([x + 5.136, z], [0, -1]),
    facade([x, z - 5.226], [-1, 0]),
    facade([x - 5.136, z], [0, 1]),
  ];
  for (const [i, F] of faces.entries()) {
    gable(out, F, 0, 9.55, 51.45, 57.3, 0.09);
    band(out, F, 0, 10.6, 37.55, 0.43, 0.68);
    if (!lod) continue;
    for (const u of [-2.18, 2.18]) {
      arched(out, F, u, 40.15, 2.24, 10.25, lod);
      if (sculpted)
        for (let q = 0; q < 12; q++) {
          const y = 40.4 + q * 0.62;
          band(out, F, u, 1.85, y, 0.128, 0.12, colors.shadow);
        }
    }
    rose(out, F, 0, 52.04, 1.47, lod);
    if (i === 0) {
      const lower = facade([x, frontZ + 0.02], [1, 0]);
      arched(out, lower, 0, 14.3, 2.12, 16.7, lod);
      for (const y of [22.8, 34.64, 36.7]) band(out, lower, 0, 12.86, y, 0.32, 0.47);
      for (let k = -3; k <= 3; k++) arched(out, lower, k * 1.31, 32.18, 0.67, 2.25, lod);
    }
  }
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) {
      if (lod || dz > 0) pinnacle(out, x + dx * 5.38, z + dz * 5.35, 34.89, 8.35, lod);
      if (lod > 1) pinnacle(out, x + dx * 4.87, z + dz * 4.67, 47.65, 7.36, lod);
    }
}

function figure(out, u, y, F, scale, lod, shade = colors.trim) {
  const p = F.P(u, 0, 0.38);
  const n = lod > 1 ? 7 : 5;
  lathe(
    out,
    'trim',
    [p[0], p[2]],
    [
      [y, 0.46 * scale, 0.35 * scale],
      [y + 1.3 * scale, 0.38 * scale, 0.25 * scale],
      [y + 2.18 * scale, 0.26 * scale, 0.19 * scale],
    ],
    n,
    shade,
  );
  lathe(
    out,
    'trim',
    [p[0], p[2]],
    [
      [y + 2.16 * scale, 0.19 * scale, 0.18 * scale],
      [y + 2.55 * scale, 0.19 * scale, 0.18 * scale],
      [y + 2.7 * scale, 0.075 * scale, 0.07 * scale],
    ],
    n,
    shade,
  );
}

function door(out, u, width, F, lod) {
  const low = 3.65,
    spring = 8.3,
    r = width / 2;
  rectangle(out, 'door', F, u - r, u + r, low, spring, 0.033, colors.door);
  const pts = roundArch(r, lod > 1 ? 10 : 6);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    tri(
      out,
      'door',
      F.P(u, spring, 0.033),
      F.P(u + b[0], spring + b[1], 0.033),
      F.P(u + a[0], spring + a[1], 0.033),
      colors.door,
    );
  }
  if (!lod) return;
  for (let i = 0; i < (lod > 1 ? 3 : 1); i++)
    outlineArch(out, F, u, spring, r + i * 0.46, 0.34, 0.28 + i * 0.18, lod);
  for (const s of [-1, 1]) {
    fbox(out, 'trim', F, u + s * r - 0.21, u + s * r + 0.21, low, spring, -0.08, 0.69, colors.trim);
    if (lod > 1) {
      fbox(
        out,
        'trim',
        F,
        u + s * (r + 0.59) - 0.1,
        u + s * (r + 0.59) + 0.1,
        low,
        spring - 0.04,
        -0.15,
        0.59,
        colors.trim,
      );
      rectangle(
        out,
        'door',
        F,
        u + s * width * 0.22 - 0.41,
        u + s * width * 0.22 + 0.41,
        low + 0.59,
        spring - 0.32,
        0.047,
        rgb('917453'),
      );
    }
  }
  band(out, F, u, width + 2.03, spring + 0.07, 0.65, 0.18);
  if (lod > 1) {
    gable(out, F, u, width + 2.1, spring + r + 1.04, spring + r + 3.1, 0.27, colors.trim);
    for (const side of [-1, 1]) figure(out, u + side * (r + 1.52), low + 0.2, F, 0.72, lod);
  }
}

function stairs(out, lod) {
  const rise = site.frontStairRiseM;
  for (const side of [-1, 1]) {
    const steps = lod > 1 ? 15 : lod ? 6 : 2;
    const center = 8.3 * side;
    for (let i = 0; i < steps; i++) {
      const d = 7.2 * (1 - i / steps);
      fbox(
        out,
        'base',
        front,
        center - 3.62,
        center + 3.62,
        -0.8,
        (rise * (i + 1)) / steps,
        Math.max(0, d - 7.2 / steps),
        d,
        i % 3 === 0 ? colors.base : colors.granite,
      );
    }
    fbox(
      out,
      'base',
      front,
      5.9 * side - 0.38,
      5.9 * side + 0.38,
      -1.1,
      0.86,
      3.7,
      7.27,
      colors.granite,
    );
    const outer = 17.35 * side;
    fbox(out, 'base', front, outer - 4.55, outer + 4.55, -1.4, rise - 0.1, -0.6, 2.85, colors.base);
    if (lod > 1)
      for (let k = -3; k <= 3; k++)
        band(out, front, outer + k * 0.94, 0.35, rise - 0.27, 3.08, 0.85);
  }
  fbox(out, 'base', front, -4.5, 4.5, -1.05, rise, -0.7, 1.97, colors.granite);
  arched(
    out,
    facade([0, frontZ + 1.975], [1, 0]),
    0,
    0.25,
    2.65,
    3.02,
    lod,
    colors.trim,
    colors.shadow,
  );
}

function frontage(out, lod) {
  const width = 24.95;
  box(out, 'granite', -12.48, 12.48, 43.7, frontZ, 3.25, 34.55, colors.granite);
  gableRoof(out, 'copper', [0, 48], [0, frontZ], width, 34.55, 45.05, colors.copper, {
    overhang: 0.07,
    endSlot: 'granite',
    endColor: colors.granite,
    ends: [false, true],
  });
  if (lod) {
    for (let i = 0; i < (lod > 1 ? 3 : 1); i++)
      outlineArch(out, front, 0, 26.65, 7.13 + i * 0.54, 0.43, 0.52 + i * 0.205, lod);
    for (const s of [-1, 1])
      for (let j = 0; j < (lod > 1 ? 4 : 2); j++) {
        const u = s * (7.84 + j * 0.56);
        fbox(
          out,
          'trim',
          front,
          u - 0.21,
          u + 0.21,
          13.1,
          26.94,
          -0.045,
          0.78 - j * 0.07,
          colors.trim,
        );
      }
    rose(out, front, 0, 26.35, 4.38, lod);
    for (let k = -5; k <= 5; k++) {
      arched(out, front, k * 0.92, 16.35, 0.47, 3.55, lod);
      const u = k * 2.15;
      const roofEdge = 45.05 - (10.5 * Math.abs(u)) / (width / 2);
      arched(out, front, u, roofEdge - 3.4, 0.59, 2.75, lod);
    }
    band(out, front, 0, 25, 12.25, 0.94, 0.49);
    band(out, front, 0, 24.98, 13.21, 0.42, 0.33);
    if (lod > 1)
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const u = side * (6.22 + i * 0.79);
          figure(out, u, 27.4 + (i % 2) * 0.42, front, 0.6, lod);
        }
      }
    figure(out, 0, 45.12, front, 1.02, lod, colors.gold);
    band(out, front, 0, 1.66, 44.86, 0.52, 0.35);
  }
  door(out, 0, 5.02, front, lod);
  for (const x of site.coreTowerX) door(out, x, 3.39, front, lod);
  stairs(out, lod);
}

function build(sink, lod) {
  const out = withFootprintCaps({
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  });
  nave(out, lod);
  for (const x of site.coreTowerX) bellTower(out, x, lod);
  frontage(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'basilica-of-sainte-anne-de-beaupre-model.mjs';
const camera = [99, 73, 154],
  lookAt = [0, 34, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'romanesque-revival-basilica',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The standing Sainte-Anne-de-Beaupré basilica with two octagonal spires, nested arches, rose window, silver granite, green copper roofs and a ten-chapel ambulatory.',
  camera,
  lookAt,
  sunDirection: [31, 48, 55],
  mediumFiContext: {
    scale: 1.04,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'river-facing-facade-and-twin-spires', position: [2, 26, 178], lookAt: [0, 41, 43] },
    { name: 'three-portals-and-rose-tracery', position: [-12, 11, 91], lookAt: [0, 17.5, 50] },
    { name: 'south-aisle-and-transept', position: [123, 39, 43], lookAt: [0, 28, -5] },
    { name: 'copper-apse-and-radiating-chapels', position: [66, 67, -111], lookAt: [0, 24, -25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sainte-anne-de-beaupre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.53, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
};
