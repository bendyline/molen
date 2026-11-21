import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  tile: 'd2d2cb',
  white: 'e1e0d8',
  band: 'abb0ab',
  grout: '9ea4a2',
  stone: 'b8b6a9',
  pavilion: 'afbab6',
  core: '7295a8',
  glass: '5f7983',
  skyGlass: '79949e',
  shadeGlass: '4e636d',
  mullion: 'a7b9b7',
  black: '586260',
  roof: '777e77',
  curb: 'a7aaa0',
});
const surfaces = {
  tile: surface('wall', 'tile_ceramic', 0.73),
  stone: surface('foundation', 'concrete_panel', 0.93),
  roof: surface('roof', 'membrane', 0.88),
  trim: surface('trim', 'metal_painted', 0.6, 0.13),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.41, metallic: 0.07 },
  solid: { slot: 'wall', localRef: 'palette:#fffffe', roughness: 0.74 },
};
const bottom = (p) => Math.min(grade(p) - 0.46, 0.08);
const inside = (p, a, v) => v * p[a] >= 0;
const lutColors = [c.glass, c.skyGlass, c.glass, c.shadeGlass, c.glass, c.skyGlass];

function clip(poly, axis, offset, sign) {
  const shifted = (p) => p.map((v, i) => (i === axis ? v - offset : v));
  const out = [];
  for (const [a, b] of pairs(closed(poly))) {
    const first = inside(shifted(a), axis, sign);
    const last = inside(shifted(b), axis, sign);
    if (first) out.push(a);
    if (first === last) continue;
    const t = (offset - a[axis]) / (b[axis] - a[axis]);
    out.push(a.map((v, i) => (i === axis ? offset : mix(v, b[i], t))));
  }
  return out;
}
function mass(out, poly, base, high, color = c.tile, wallSlot = 'tile', colorRoof = c.roof) {
  shell(out, poly, typeof base === 'number' ? () => base : base, high, {
    wall: wallSlot,
    roof: 'roof',
    color,
    roofColor: colorRoof,
  });
}
function surfacePolygon(out, slot, p, y, color) {
  const faceIndexes = earcut(p.flat());
  for (let i = 0; i < faceIndexes.length; i += 3) {
    face(
      out,
      slot,
      faceIndexes.slice(i, i + 3).map((j) => at(p[j], y)),
      up,
      color,
    );
  }
}
function cladLines(out, poly, first, last, level) {
  if (level === 0) return;
  const sign = areaSign(poly);
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b, sign);
    if (w.length < 0.2) continue;
    for (let y = first; y < last - 0.25; y += level === 1 ? 2.22 : 1.23) {
      panel(out, 'solid', w, 0, w.length, y, y + 0.095, 0.023, c.band);
    }
    if (level >= 2 && w.length > 8) {
      const bays = Math.ceil(w.length / 5.7);
      for (let i = 1; i < bays; i++) {
        const u = (w.length * i) / bays;
        panel(out, 'solid', w, u - 0.026, u + 0.026, first - 0.3, last - 0.19, 0.03, c.grout);
      }
    }
  }
}

function glassWall(
  out,
  w,
  u0,
  u1,
  y0,
  y1,
  level,
  { depth = 0.025, tilt = 0, spacing = 2.55 } = {},
) {
  const count = Math.max(1, Math.round((u1 - u0) / (spacing * [2.1, 1.4, 1, 0.75][level])));
  const point = (u, y, dd = 0) => w.p(u, y, depth + dd + (tilt * (y - y0)) / (y1 - y0));
  const pane = (slot, a, b, low, high, offset, tint) =>
    face(
      out,
      slot,
      [
        point(a, low, offset),
        point(b, low, offset),
        point(b, high, offset),
        point(a, high, offset),
      ],
      w.normal,
      tint,
    );
  for (let i = 0; i < count; i++) {
    const a = mix(u0, u1, i / count),
      b = mix(u0, u1, (i + 1) / count);
    pane('glass', a, b, y0, y1, 0, lutColors[i % lutColors.length]);
    if (level >= 1) {
      pane('trim', Math.max(u0, a - 0.039), a + 0.039, y0, y1, 0.028, c.mullion);
    }
  }
  for (const t of level >= 2 ? [0.035, 0.26, 0.51, 0.75, 0.971] : [0.035, 0.52, 0.968]) {
    const y = mix(y0, y1, t);
    pane('trim', u0, u1, y - 0.035, y + 0.035, 0.036, c.mullion);
  }
}

const east = clip(d.outline, 0, -14, 1);
const west = clip(d.outline, 0, -14, -1);
const south = clip(west, 1, 11.4, 1);
const north = clip(west, 1, 11.4, -1);
const middle = clip(north, 0, -44.35, 1);

// The west canopy crosses the approach. Keep its underside open below the lobby.
const arcade = [
  [-52.7, -32],
  [-47.3, -42],
  [-44.3, -39.5],
  [-44.5, 10.8],
  [-47.1, 12.3],
  [-50.7, 5.36],
  [-53.8, -1.7],
  [-52.8, -10.1],
  [-52.6, -23.4],
];
function courtyardArcade(out, level) {
  const top = (p) => 11.13 + 0.58 * Math.cos(((p[1] + 15) * Math.PI) / 54);
  const floor = (p) => 7.25 + Math.max(0, (-p[1] - 7) * 0.045);
  const sign = areaSign(arcade);
  const triangles = earcut(arcade.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const corners = triangles.slice(i, i + 3).map((j) => arcade[j]);
    face(
      out,
      'roof',
      corners.map((p) => at(p, top(p))),
      up,
      c.roof,
    );
    face(
      out,
      'solid',
      corners.map((p) => at(p, floor(p))),
      [0, -1, 0],
      c.black,
    );
  }
  for (const [a, b] of pairs(closed(arcade))) {
    const w = edge(a, b, sign);
    face(
      out,
      'tile',
      [at(a, floor(a)), at(b, floor(b)), at(b, top(b)), at(a, top(a))],
      w.normal,
      c.tile,
    );
    if (level >= 1) {
      for (const t of [0.08, 0.56, 0.9]) {
        const ya = mix(floor(a), top(a), t),
          yb = mix(floor(b), top(b), t);
        const line = (u, y) => w.p(u * w.length, y, 0.027);
        face(
          out,
          'solid',
          [line(0, ya), line(1, yb), line(1, yb + 0.11), line(0, ya + 0.11)],
          w.normal,
          c.white,
        );
      }
    }
  }
  const pillars = [
    [-50.5, -29.0],
    [-50.8, -21.5],
    [-51.1, -14.6],
    [-51.8, -7.8],
    [-51.9, -1.0],
    [-49.6, 5.7],
    [-47.0, 10.6],
  ];
  for (const [i, p] of pillars.entries()) {
    const y = Math.min(grade(p) - 0.24, floor(p) - 0.87);
    const width = i === 0 ? 1.32 : 0.87;
    block(
      out,
      'tile',
      p[0] - width / 2,
      y,
      p[1] - width / 2,
      width,
      floor(p) + 0.09 - y,
      width,
      c.tile,
    );
    if (level >= 1)
      for (let a = y + 1.15; a < floor(p) - 0.28; a += 1.19) {
        block(
          out,
          'trim',
          p[0] - width / 2 - 0.013,
          a,
          p[1] - width / 2 - 0.013,
          width + 0.026,
          0.082,
          width + 0.026,
          c.black,
        );
      }
  }
  const [sx, sz] = d.streetCore;
  const coreBottom = bottom(d.streetCore);
  const n = [10, 14, 20, 24][level];
  loft(
    out,
    'solid',
    [radialRing(coreBottom, 2.21, 2.21, n, [sx, sz]), radialRing(8.9, 2.21, 2.21, n, [sx, sz])],
    c.core,
  );
  const w = edge([-53.45, -31.9], [-53.45, -24.2], -1);
  block(out, 'stone', -54.03, -0.26, -31.9, 0.67, 0.34, 7.74, c.stone);
  glassWall(out, w, 0.12, w.length - 0.15, 8.67, 10.65, level, {
    depth: 0.03,
    tilt: 0.16,
    spacing: 1.6,
  });
  if (level >= 1) {
    block(out, 'solid', -54.02, 8.49, -29.0, 0.72, 0.19, 3.17, c.pavilion);
    beam(out, 'trim', [-54, 10.75, -31.62], [-54, 10.75, -24.34], 0.098, 0.165, c.white);
  }
}

const audition = [
  [-43.0, -14.6],
  [-30, -23.0],
  [-14.6, -22.6],
  [-5.7, -15.5],
  [-5.7, 14],
  [-15.8, 23.0],
  [-16.3, 35.1],
  [-41.8, 35.9],
  [-44.2, 25.0],
];
const flyTower = [
  [-36.8, 17.1],
  [-17.6, 17.0],
  [-13.6, 23],
  [-13.7, 40.1],
  [-35.5, 40.7],
  [-37.5, 36.9],
];
function auditorium(out, level) {
  mass(out, audition, 7.7, d.hallHeight, c.white);
  cladLines(out, audition, 8.42, d.hallHeight, level);
  mass(out, flyTower, 8.1, 13.79, c.tile);
  cladLines(out, flyTower, 8.98, 13.78, level);
  const side = edge([-43.0, -14.6], [-44.2, 25.0], -1);
  panel(out, 'trim', side, 12.05, 16.25, 11.07, 11.5, 0.09, c.black);
  panel(out, 'trim', side, 29.03, 31.25, 12.56, 13.84, 0.1, c.band);
  if (level >= 1) {
    for (const p of [
      [-26, -10],
      [-31, 17],
      [-22, 33],
      [-17, 0.3],
    ]) {
      block(out, 'solid', p[0], p[1] > 30 ? 13.79 : 16, p[1], 2.35, 0.47, 1.7, c.black);
    }
  }
  if (level >= 2) {
    const x = -41.52,
      z = -8.6;
    beam(out, 'trim', [x, 15.8, z], [x, 18.5, z], 0.07, 0.075, c.mullion);
    beam(out, 'trim', [x - 0.55, 16.4, z], [x + 0.55, 17.02, z], 0.055, 0.055, c.mullion);
    beam(out, 'trim', [x - 0.55, 17.21, z], [x + 0.55, 17.84, z], 0.055, 0.055, c.mullion);
  }
}
function parkTower(out, level) {
  const n = [10, 14, 18, 24][level];
  const center = d.parkCore;
  const low = bottom(center);
  const ring = (y, rad) => radialRing(y, rad, rad, n, center, Math.PI / n);
  const rings = [
    [low, 4.28, 'solid', c.core],
    [3.5, 4.33, 'solid', c.core],
    [5.8, 4.48, 'glass', c.skyGlass],
    [8.55, 4.55, 'tile', c.tile],
    [11.33, 4.48, 'tile', c.white],
    [11.8, 4.14, 'roof', c.roof],
  ];
  for (const [[y, r, slot, color], [yy, rr]] of pairs(rings)) {
    loft(out, slot, [ring(y, r), ring(yy, rr)], color, { cap: false });
  }
  surfacePolygon(
    out,
    'roof',
    ring(11.8, 4.14).map(([x, , z]) => [x, z]),
    11.8,
    c.roof,
  );
  if (level >= 1) {
    const rim = ring(5.8, 4.503);
    for (let i = 0; i < n; i += level >= 2 ? 1 : 2) {
      const [x, , z] = rim[i];
      beam(out, 'trim', [x, 5.84, z], [x, 8.56, z], 0.07, 0.079, c.mullion);
    }
  }
}
function parkAtrium(out, level) {
  const westPark = [
    [-46.31, -49.34],
    [-16.42, -50.31],
    [-15.61, -39.86],
    [-14.26, -32.33],
    [-46.4, -33],
  ];
  mass(out, westPark, bottom, 10.84, c.tile);
  const w = edge(westPark[0], westPark[1]);
  glassWall(out, w, 0.16, w.length - 0.16, 0.12, 9.87, level, {
    depth: 0.17,
    tilt: -0.11,
    spacing: 2.37,
  });
  const lipA = w.p(0.15, 9.5, 0.2);
  const lipB = w.p(w.length - 0.12, 9.5, 0.2);
  const topA = w.p(0.15, 11.44, -3.88);
  const topB = w.p(w.length - 0.12, 11.44, -3.88);
  face(out, 'glass', [lipA, lipB, topB, topA], up, c.skyGlass);
  if (level >= 1) {
    const n = level >= 2 ? 13 : 8;
    for (let i = 0; i <= n; i++) {
      const a = i / n;
      const p = lipA.map((v, index) => mix(v, lipB[index], a));
      const q = topA.map((v, index) => mix(v, topB[index], a));
      beam(out, 'trim', p, q, 0.075, 0.087, c.mullion);
    }
  }
  const ribbon = edge([-5.52, -32.77], [44.4, -34.94]);
  glassWall(out, ribbon, 0.16, ribbon.length - 0.13, 0.29, 7.55, level, {
    tilt: 0.16,
    spacing: 2.7,
  });
  const connector = edge([-45.01, -31.89], [-45.16, 8.2], -1);
  glassWall(out, connector, 0.05, connector.length - 0.15, 0.06, 7.76, level, {
    depth: 0.11,
    spacing: 2.74,
  });
}
function eastWings(out, level) {
  mass(out, east, bottom, d.eastRoof, c.tile);
  cladLines(out, east, 2.85, d.eastRoof, level);
  const rearParts = [
    [
      [16.6, -39.3],
      [30.28, -39.86],
      [31.48, -24],
      [15.23, -23.6],
    ],
    [
      [43.95, -38.28],
      [57.45, -38.76],
      [57.78, -24.59],
      [41.85, -23.68],
    ],
    [
      [73.92, -33.98],
      [99.79, -33.51],
      [100.03, -10.25],
      [82.92, 17.47],
      [68.66, 18.0],
    ],
  ];
  for (const [i, poly] of rearParts.entries()) {
    const y = i === 2 ? 11.25 : 10.48;
    mass(out, poly, 7.8, y, c.tile);
    cladLines(out, poly, 8.24, y, level);
  }
  const glazing = edge([51.7, -32.52], [97.45, -34.0]);
  glassWall(out, glazing, 0.1, glazing.length - 0.25, 0.38, 6.54, level, {
    depth: 0.09,
    spacing: 3.12,
  });
  const endBand = edge([101.2, -8.93], [80.74, 18.8]);
  glassWall(out, endBand, 1.47, 10.78, 2.25, 5.46, level, { depth: 0.031, spacing: 2.23 });
  if (level >= 1) {
    for (let i = 0; i < 5; i++) {
      block(
        out,
        'solid',
        [2.6, 19.3, 39.3, 61.6, 88.2][i],
        d.eastRoof - 0.07,
        [4.0, 1.79, -4.89, -10.38, -8.52][i],
        3.19,
        0.61,
        3.5,
        c.band,
      );
    }
  }
}
function build(out, level) {
  mass(out, middle, bottom, 8.63, c.tile);
  mass(out, south, bottom, 8.91, c.tile);
  cladLines(out, south, 2.7, 8.91, level);
  eastWings(out, level);
  auditorium(out, level);
  parkAtrium(out, level);
  parkTower(out, level);
  courtyardArcade(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'tampere-hall-model.mjs';
const camera = [-182, 72, -122],
  lookAt = [8, 5.8, -3.8];
const errors = { district: 0.62, street: 0.24, closeup: 0.079 };
export const tampereHallAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'performance-sport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Named Yliopistonkatu entry and original Finnish N2000 relief at street grade.',
  brief:
    'Tampere Hall with the raised entrance arcade, white-tiled auditorium, glass winter garden and blue park-side core.',
  camera,
  lookAt,
  sunDirection: [-96, 101, -82],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Mapped municipal concert and congress hall envelope, excluding the separate hotel.',
  },
  embeddedCanonicalGraphs: ['tile_ceramic', 'concrete_panel', 'membrane', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'street-colonnade-and-ceramic-auditorium',
      position: [-110, 16, -26],
      lookAt: [-40, 7, -7.1],
    },
    { name: 'winter-garden-and-blue-core', position: [-30, 21, -96], lookAt: [-17, 7, -34] },
    { name: 'eastern-exhibition-wings', position: [149, 42, -69], lookAt: [55, 7, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tampere-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.21,
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
    'Original mesh under repository license. © OpenStreetMap contributors. National Land Survey of Finland terrain CC BY 4.0.',
};
