import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/mateus-palace-shape-controls');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const white = rgb('ebe6d8');
const granite = rgb('a5a095');
const stoneDark = rgb('858176');
const pale = rgb('c1baab');
const timber = rgb('534b39');
const glass = rgb('3c4847');
const openings = rgb('3e3a31');
const tiles = rgb('a26043');
const center = -9.89;
const eave = 9.9;
const front = facade([center, 1.43], [-1, 0]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function capRoof(out, x0, x1, z0, z1, y, h, longX = false) {
  const a = [x0, y, z1],
    b = [x1, y, z1];
  const c = [x1, y, z0],
    d = [x0, y, z0];
  const offset = Math.min(x1 - x0, z1 - z0) * 0.38;
  const u = longX ? [x0 + offset, y + h, (z0 + z1) / 2] : [(x0 + x1) / 2, y + h, z1 - offset];
  const v = longX ? [x1 - offset, y + h, (z0 + z1) / 2] : [(x0 + x1) / 2, y + h, z0 + offset];
  if (longX) {
    quad4(out, 'tile', a, b, v, u, tiles);
    quad4(out, 'tile', c, d, u, v, tiles);
    tri(out, 'tile', a, u, d, tiles);
    tri(out, 'tile', c, v, b, tiles);
  } else {
    quad4(out, 'tile', b, c, v, u, tiles);
    quad4(out, 'tile', d, a, u, v, tiles);
    tri(out, 'tile', a, b, u, tiles);
    tri(out, 'tile', c, d, v, tiles);
  }
  box(out, 'granite', x0, x1, z0, z1, y - 0.26, y - 0.015, pale, true);
}

function pedestal(out, x, z, y, scale, level) {
  const h = (v) => y + v * scale;
  const r = (v) => scale * v;
  if (level === 0) {
    lathe(
      out,
      'granite',
      [x, z],
      [
        [y, r(0.28), r(0.28)],
        [h(1.05), r(0.16), r(0.16)],
        [h(1.87), 0, 0],
      ],
      4,
      pale,
      { capTop: false },
    );
    return;
  }
  const half = r(0.29);
  box(out, 'granite', x - half, x + half, z - half, z + half, y, h(0.28), granite);
  const layers =
    level <= 1
      ? [
          [h(0.26), r(0.22)],
          [h(0.86), r(0.15)],
          [h(1.4), r(0.2)],
          [h(1.87), 0],
        ]
      : [
          [h(0.26), r(0.24)],
          [h(0.46), r(0.2)],
          [h(0.7), r(0.16)],
          [h(0.91), r(0.24)],
          [h(1.1), r(0.16)],
          [h(1.29), r(0.1)],
          [h(1.42), r(0.18)],
          [h(1.6), r(0.12)],
          [h(1.8), r(0.065)],
          [h(1.93), 0],
        ];
  lathe(
    out,
    'granite',
    [x, z],
    layers.map(([y, r]) => [y, r, r]),
    [4, 5, 8, 12][level],
    pale,
    { capTop: false },
  );
}

function plaque(out, f, u, y, rx, ry, d, color, n) {
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return f.P(u + rx * Math.cos(a), y + ry * Math.sin(a), d);
  });
  fan(out, 'granite', points, color);
}

function slopedTrim(out, f, a, b, y, rise, depth, width, color) {
  beam(out, 'granite', f.P(a, y, depth), f.P(b, y + rise, depth), width, width, color);
}

function window(out, f, u, y, upper, formal, level) {
  const width = upper ? 1.44 : 1.21;
  const height = upper ? 2.55 : 1.69;
  opening(out, f, u, y, width, height, {
    glassSlot: 'dark',
    frameSlot: 'granite',
    glass,
    frame: granite,
    frameWidth: level >= 2 || (formal && level === 1) ? 0.13 : 0,
    frameDepth: 0.1,
    sill: level >= 2,
    mullions: level >= 2 ? 1 : 0,
    transoms: level === 3 ? 2 : 0,
  });
  if (!formal || !upper || level === 0) return;
  const crown = y + height + 0.22;
  fbox(out, 'granite', f, u - 0.91, u + 0.91, crown - 0.08, crown + 0.04, 0.08, 0.29, pale);
  slopedTrim(out, f, u - 0.91, u, crown, 0.37, 0.2, 0.13, granite);
  slopedTrim(out, f, u, u + 0.91, crown + 0.37, -0.37, 0.2, 0.13, granite);
  fbox(out, 'granite', f, u - 0.76, u + 0.76, y - 0.2, y + 0.02, -0.04, 0.53, pale);
  fbox(out, 'granite', f, u - 0.65, u + 0.65, y + 0.52, y + 0.59, 0.39, 0.49, stoneDark);
  if (level >= 2) {
    for (const dx of [-0.52, -0.26, 0, 0.26, 0.52])
      fbox(out, 'granite', f, u + dx - 0.037, u + dx + 0.037, y, y + 0.53, 0.39, 0.48, granite);
  }
}

function panel(out, f, u0, u1, base, top, color, offset = 0) {
  quad4(
    out,
    'plaster',
    f.P(u0, base, offset),
    f.P(u1, base, offset),
    f.P(u1, top, offset),
    f.P(u0, top, offset),
    color,
  );
}

function rangeWalls(out, ring, detail) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const f = wallFace(a, b),
      length = f.length;
    const z = (a[1] + b[1]) / 2;
    const portal =
      Math.abs(a[1] - b[1]) < 0.4 && (Math.abs(z - 1.5) < 0.7 || Math.abs(z - 12.29) < 0.7);
    if (portal) {
      const u = (center - f.origin[0]) / f.along[0];
      const jamb = 1.4;
      panel(out, f, 0, u - jamb, -3.6, eave, white);
      panel(out, f, u + jamb, length, -3.6, eave, white);
      panel(out, f, u - jamb, u + jamb, 3.62, eave, white);
    } else {
      panel(out, f, 0, length, -3.6, eave, white);
    }
    if (detail > 0) {
      fbox(out, 'granite', f, 0, length, eave - 0.32, eave - 0.08, -0.09, 0.22, pale);
      if (!portal) fbox(out, 'granite', f, 0, length, -3.6, 0.23, -0.03, 0.027, stoneDark);
    }
    if (length < 5.4 || portal) continue;
    const wingEnd = z < -21;
    const garden = z > 35.5;
    const formal = wingEnd || garden || (length >= 23 && z < 7 && a[0] > -16 && b[0] < 5);
    const count = Math.max(1, Math.round(length / (wingEnd ? 5.1 : detail === 1 ? 6 : 4.4)));
    for (let j = 0; j < count; j++) {
      const u = (length * (j + 0.5)) / count;
      if (detail > 0) window(out, f, u, garden ? 0.31 : 1.02, false, false, detail);
      if (detail > 0 || formal) window(out, f, u, 5.01, true, formal, detail);
    }
    if ((wingEnd || garden) && detail >= 1) {
      for (const u of [0.23, length - 0.23])
        fbox(out, 'granite', f, u - 0.25, u + 0.25, -1.6, eave, -0.07, 0.15, granite);
    }
  }
}

function manor(out, detail) {
  rangeWalls(out, outwardRing(frame.geometry.outline), detail);
  rangeWalls(out, outwardRing(frame.geometry.holes[0]).reverse(), detail);
  capRoof(out, -26.72, -15.42, -23.51, 36.25, eave, 2.14);
  capRoof(out, -4.29, 6.98, -23.54, 36.65, eave, 2.14);
  capRoof(out, -17.93, -2.3, 0.83, 12.41, eave, 1.78, true);
  capRoof(out, -17.42, -2.4, 25.4, 36.42, eave, 1.83, true);
  for (const z of [-22.87, 35.3]) {
    for (const x of [-25.79, -15.82, -3.91, 6.16])
      pedestal(out, x, z, eave - 0.06, z < 0 ? 1.78 : 1.43, detail);
  }
  const g = facade([center, 36.41], [1, 0]);
  fbox(out, 'granite', g, -1.18, 1.18, 8.59, 10.27, 0.03, 0.41, granite);
  plaque(out, g, 0, 10.06, 1.36, 1.25, 0.1, granite, 12);
  plaque(out, g, 0, 9.96, 0.96, 0.8, 0.14, pale, 12);
  pedestal(out, center, 36.03, 11.07, 0.69, detail);
}

function stairRail(out, x0, x1, z, y0, y1, detail) {
  const from = [x0, y0 + 0.83, z],
    to = [x1, y1 + 0.83, z];
  beam(out, 'granite', from, to, 0.12, 0.135, pale);
  if (detail === 0) return;
  beam(out, 'granite', [x0, y0 + 0.1, z], [x1, y1 + 0.1, z], 0.18, 0.11, granite);
  const count = detail === 1 ? 3 : detail === 2 ? 8 : 13;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count,
      x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    if (detail === 3)
      lathe(
        out,
        'granite',
        [x, z],
        [
          [y + 0.1, 0.063, 0.063],
          [y + 0.33, 0.078, 0.078],
          [y + 0.53, 0.05, 0.05],
          [y + 0.78, 0.061, 0.061],
        ],
        5,
        granite,
        { capTop: false },
      );
    else box(out, 'granite', x - 0.05, x + 0.05, z - 0.055, z + 0.055, y + 0.1, y + 0.8, granite);
  }
}

function flight(out, start, end, low, high, z0, z1, detail) {
  const steps = [1, 6, 9, 12][detail];
  for (let i = 0; i < steps; i++) {
    const a = start + ((end - start) * i) / steps,
      b = start + ((end - start) * (i + 1)) / steps;
    box(
      out,
      'granite',
      Math.min(a, b),
      Math.max(a, b),
      z0,
      z1,
      -0.41,
      low + ((high - low) * (i + 1)) / steps,
      i % 2 === 0 ? granite : pale,
    );
  }
  stairRail(out, start, end, z0 + 0.08, low, high, detail);
}

function arrival(out, detail) {
  const landing = 3.64;
  box(out, 'granite', center - 1.63, center + 1.63, -1.48, 1.56, 3.36, landing, granite, true);
  box(out, 'granite', center - 1.4, center + 1.4, 0.08, 12.47, -0.23, 0.035, granite);
  if (detail >= 1) {
    for (const offset of [-1.48, 1.4])
      box(out, 'plaster', center + offset, center + offset + 0.08, 1.45, 12.31, 0.035, 3.63, pale);
  }
  stairRail(out, center - 1.56, center + 1.56, -1.42, landing, landing, detail);
  for (const sign of [-1, 1]) {
    const inner = center + sign * 1.72,
      outer = center + sign * 5.34;
    flight(out, inner, outer, 0.08, 1.89, -4.07, -2.72, detail);
    flight(out, outer, inner, 1.89, landing, -2.72, -1.3, detail);
    const last = center + sign * 5.94;
    box(
      out,
      'granite',
      Math.min(outer, last),
      Math.max(outer, last),
      -4.07,
      -1.29,
      -0.41,
      1.89,
      granite,
    );
    pedestal(out, outer, -3.99, 1.87, 0.64, detail);
  }
  for (const u of [-1.53, 1.53]) {
    fbox(out, 'granite', front, u - 0.18, u + 0.18, -0.1, 3.63, -0.06, 0.4, granite);
    fbox(out, 'granite', front, u - 0.17, u + 0.17, 3.64, 8.85, -0.1, 0.28, pale);
  }
  fbox(out, 'granite', front, -1.74, 1.74, 3.4, 3.7, -0.09, 0.39, granite);
  const cornice = [
    [-4.88, 8.62],
    [-3.56, 8.3],
    [-2.48, 8.33],
    [-1.48, 8.69],
    [0, 8.74],
    [1.48, 8.69],
    [2.48, 8.33],
    [3.56, 8.3],
    [4.88, 8.62],
  ];
  if (detail >= 1) {
    for (let i = 1; i < cornice.length; i++) {
      const [a, y] = cornice[i - 1],
        [b, top] = cornice[i];
      slopedTrim(out, front, a, b, y, top - y, 0.24, 0.34, granite);
    }
  } else {
    fbox(out, 'granite', front, -4.88, 4.88, 8.45, 8.69, -0.08, 0.28, granite);
  }
  opening(out, front, 0, 3.69, 1.76, 3.02, {
    glassSlot: 'dark',
    frameSlot: 'granite',
    glass: timber,
    frame: pale,
    frameWidth: detail >= 1 ? 0.2 : 0,
    frameDepth: 0.28,
    transoms: detail >= 2 ? 2 : 0,
    mullions: detail >= 2 ? 1 : 0,
  });
  if (detail >= 1)
    for (const u of [-4.43, 4.43]) {
      window(out, front, u, 4.38, false, true, detail);
      plaque(out, front, u, 7.12, 0.55, 0.66, 0.13, granite, detail >= 2 ? 12 : 8);
      plaque(out, front, u, 7.12, 0.38, 0.46, 0.15, stoneDark, detail >= 2 ? 12 : 8);
    }
  fbox(out, 'granite', front, -1.34, 1.34, 8.78, 11.62, -0.07, 0.34, pale);
  plaque(out, front, 0, 11.5, 1.42, 0.95, 0.35, granite, 12);
  plaque(out, front, 0, 10.58, 0.62, 0.78, 0.5, stoneDark, 12);
  pedestal(out, center, 1.04, 12.19, 0.73, detail);
  for (const x of [center - 4.83, center - 2.19, center + 2.19, center + 4.83])
    pedestal(out, x, 1.13, 9.77, 1.55, detail);
}

function chapel(out, detail) {
  const x = 13.15,
    z = 36.33;
  const f = facade([x, z], [-1, 0]);
  const ring = outwardRing(shape.chapel.outline);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const wall = wallFace(a, b);
    panel(out, wall, 0, wall.length, -5.22, (a[1] + b[1]) / 2 > 51.33 ? 8.48 : 10.32, white);
  }
  capRoof(out, 6.34, 20.05, 36.12, 51.52, 10.32, 2.1);
  capRoof(out, 7.92, 18.02, 51.17, 62.08, 8.48, 1.57);
  box(out, 'plaster', 11.16, 15.1, 54.06, 58.14, 8.3, 12.25, white);
  capRoof(out, 10.98, 15.28, 53.87, 58.33, 12.25, 1.04);
  box(out, 'plaster', 5.84, 7.05, 35.16, 38.14, 3.95, 7.92, white, true);
  for (const u of detail === 0 ? [-5.78, 5.78] : [-5.78, -3.3, 3.3, 5.78])
    fbox(out, 'granite', f, u - 0.33, u + 0.33, -1.75, 10.38, -0.03, 0.34, granite);
  for (const y of [1.17, 10.05, 10.38]) {
    const span = y < 2 ? 6.5 : 5.7;
    fbox(out, 'granite', f, -span, span, y - 0.14, y + 0.14, -0.06, 0.29, pale);
  }
  opening(out, f, 0, -0.69, 2.08, 4.3, {
    head: 'round',
    glassSlot: 'dark',
    frameSlot: 'granite',
    glass: openings,
    frame: granite,
    frameWidth: detail ? 0.29 : 0,
    frameDepth: 0.38,
    sill: false,
    transoms: detail === 3 ? 1 : 0,
  });
  for (const [y, w, h] of detail === 0
    ? []
    : [
        [4.16, 1.52, 2.53],
        [7.15, 1.76, 2.43],
      ]) {
    opening(out, f, 0, y, w, h, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'granite',
      glass: granite,
      frame: pale,
      frameWidth: detail >= 1 ? 0.18 : 0,
      frameDepth: 0.23,
    });
  }
  const crown = 10.46;
  fbox(out, 'plaster', f, -2.97, 2.97, crown - 0.15, crown + 1.45, -1.02, 0, white);
  plaque(out, f, 0, crown + 1.37, 2.55, 1.44, 0.05, granite, 14);
  plaque(out, f, 0, crown + 1.39, 1.97, 1.09, 0.08, white, 14);
  plaque(out, f, 0, crown + 1.28, 0.62, 0.66, 0.2, pale, 12);
  for (const lateral of [-4.85, -2.78, 2.78, 4.85])
    pedestal(out, x + lateral, z - 0.04, lateral * lateral > 20 ? 10.21 : 11.42, 1.09, detail);
  pedestal(out, x, z - 0.06, 12.82, 0.86, detail);
  box(out, 'granite', x - 0.07, x + 0.07, z - 0.11, z + 0.02, 14.18, 15.1, pale);
  box(out, 'granite', x - 0.31, x + 0.31, z - 0.11, z + 0.02, 14.72, 14.85, pale);
  for (let i = 0; i < 4; i++)
    box(
      out,
      'granite',
      x - 2.06,
      x + 2.06,
      z - 2.03 + i * 0.43,
      z + 0.24,
      -1.8,
      -1.42 + i * 0.22,
      granite,
    );
}

function build(out, detail) {
  manor(out, detail);
  arrival(out, detail);
  chapel(out, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'mateus-palace-model.mjs';
const camera = [-59, 51, -79],
  lookAt = [-6, 5.7, 15];
const arrivalCamera = [-9.9, 9.5, -71],
  arrivalTarget = [-9.9, 6, -12];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Mateus Palace in Vila Real, with a U-shaped Baroque arrival court, two stone stairs, tiled roofs and the adjoining Nossa Senhora dos Prazeres Chapel.',
  camera,
  lookAt,
  sunDirection: [-46, 68, -52],
  mediumFiContext: {
    scale: 1.24,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.87,
    basis:
      'The named palace outline retains the two advanced entrance wings and the mapped enclosed court.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-palace-front', position: arrivalCamera, lookAt: arrivalTarget },
    { name: 'return-stairs-and-crest', position: [-9.9, 4.65, -15.0], lookAt: [-9.9, 6.35, 0] },
    { name: 'chapel-and-garden', position: [35, 22, 21], lookAt: [9, 5, 42] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mateus-palace-' + reviewLod,
    position: arrivalCamera,
    lookAt: arrivalTarget,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.12,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.44, surfaces },
      street: { export: 'street', errorMeters: 0.135, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.031, surfaces },
    },
  },
};
