import fs from 'node:fs';
import {
  beam,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const tone = {
  stone: rgb('d5cbb7'),
  trim: rgb('e2d4bd'),
  pink: rgb('c9b7a3'),
  belt: rgb('a79a85'),
  base: rgb('898985'),
  glazing: rgb('4e6465'),
  dark: rgb('5c4c3f'),
  pompeian: rgb('995749'),
  bronze: rgb('527567'),
  copper: rgb('77776a'),
  skyGlass: rgb('85999a'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86 },
  red: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.83, metallic: 0.18 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.27 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.85 },
};
const outline = frame.geometry.outline;
const rearWall = 52.78;
const stairTop = plan.dimensions.stepsRiseM;
const corniceHeight = plan.dimensions.mainEavesM;
const centerFront = facade([0, rearWall], [1, 0]);
const core = outwardRing([
  ...outline.slice(0, 3),
  [17.85, rearWall],
  [-17.97, rearWall],
  ...outline.slice(7),
]);

function stoneBand(out, f, a, b, low, high, forward, tint = tone.trim) {
  fbox(out, 'trim', f, a, b, low, high, -0.032, forward, tint);
}

function patch(out, slot, f, l, r, y0, y1, depth, color) {
  quad4(
    out,
    slot,
    f.P(l, y0, depth),
    f.P(r, y0, depth),
    f.P(r, y1, depth),
    f.P(l, y1, depth),
    color,
  );
}

function pane(out, f, x, y, w, h, level, arch = false) {
  if (level === 3) {
    opening(out, f, x, y, w, h, {
      head: arch ? 'round' : 'flat',
      glass: tone.glazing,
      frameSlot: 'trim',
      frame: tone.trim,
      frameWidth: 0.11,
      frameDepth: 0.19,
      d: 0.071,
      mullions: 2,
      transoms: 2,
      mullionColor: tone.dark,
    });
    return;
  }
  const a = w / 2;
  if (arch && level > 0) {
    fan(
      out,
      'glass',
      [
        f.P(x - a, y, 0.05),
        f.P(x + a, y, 0.05),
        ...roundArch(a, 7)
          .reverse()
          .map(([u, v]) => f.P(x + u, y + h - a + v, 0.05)),
      ],
      tone.glazing,
    );
  } else patch(out, 'glass', f, x - a, x + a, y, y + h, 0.054, tone.glazing);
  if (level === 2) {
    patch(out, 'trim', f, x - a - 0.08, x + a + 0.08, y - 0.11, y, 0.079, tone.trim);
    patch(out, 'trim', f, x - 0.035, x + 0.035, y, y + h - (arch ? a : 0), 0.079, tone.dark);
  }
}

function capital(out, f, x, base, top, r, level, slot = 'trim') {
  const [worldX, , worldZ] = f.P(x, 0, 0);
  const segments = [6, 8, 12, 20][level];
  const rings =
    level === 0
      ? [
          [base, r, r],
          [top, r * 0.88, r * 0.88],
        ]
      : [
          [base, r * 1.26, r * 1.26],
          [base + 0.18, r * 1.25, r * 1.25],
          [base + 0.45, r, r],
          [top - 1.18, r * 0.84, r * 0.84],
          [top - 0.99, r * 0.87, r * 0.87],
          [top - 0.65, r * 1.05, r * 1.05],
          [top - 0.3, r * 1.24, r * 1.24],
          [top, r * 1.25, r * 1.25],
        ];
  const profile = level === 1 ? [rings[0], rings[2], rings[3], rings[6], rings[7]] : rings;
  lathe(out, slot, [worldX, worldZ], profile, segments, tone.trim, { capTop: false });
  if (level < 2) return;
  const n = level === 3 ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    const sa = Math.sin(a),
      ca = Math.cos(a);
    beam(
      out,
      'trim',
      [worldX + r * 0.92 * ca, top - 0.81, worldZ + r * 0.92 * sa],
      [worldX + r * 1.2 * ca, top - 0.21, worldZ + r * 1.2 * sa],
      r * 0.21,
      r * 0.22,
      tone.pink,
    );
  }
}

function facadeWings(out, level) {
  extrude(out, 'base', core, -0.54, 1.43, tone.base, { top: false });
  extrude(out, 'wall', core, 1.43, corniceHeight, tone.stone, { top: false });
  for (const [i, a] of core.entries()) {
    const b = core[(i + 1) % core.length];
    const f = wallFace(a, b);
    const z = (a[1] + b[1]) / 2;
    const x = (a[0] + b[0]) / 2;
    if (f.length < 2.35 || (z > 50.1 && f.normal[1] > 0.52)) continue;
    const end = f.length;
    const count = Math.max(1, Math.round(end / (level === 0 ? 14 : 8.2)));
    if (level > 0) {
      stoneBand(out, f, 0, end, 6.93, 7.37, 0.31, tone.belt);
      stoneBand(out, f, 0, end, 16.85, 17.09, 0.25);
      stoneBand(out, f, 0, end, 19.43, 20.3, 0.57);
    }
    for (let j = 0; j < count; j++) {
      const p = ((j + 0.5) * end) / count;
      if (level === 0 && end < 6.2) continue;
      const w = Math.min(2.44, (end / count) * 0.46);
      pane(out, f, p, 1.97, w, 4.39, level, true);
      pane(out, f, p - 0.43, 10.86, w * 0.38, 4.02, level);
      if (level > 0) pane(out, f, p + 0.43, 10.86, w * 0.38, 4.02, level);
      if (level > 1 && j > 0) stoneBand(out, f, p - 3.47, p - 3.11, 1.43, 18.95, 0.24, tone.pink);
    }
    if (level > 1 && Math.abs(x) > 31.25 && end > 14) {
      stoneBand(out, f, 0, end, 18.82, 19.1, 0.31, tone.pink);
    }
  }
  for (const [left, right] of [
    [-31.3, -17.98],
    [17.86, 31.27],
  ]) {
    const f = facade([0, left < 0 ? 53.43 : 53.25], [1, 0]);
    const width = right - left;
    patch(out, 'red', f, left + 0.31, right - 0.31, 9.28, 18.95, 0.036, tone.pompeian);
    for (let j = 0; j < 3; j++) {
      const p = left + (width * (j + 0.5)) / 3;
      pane(out, f, p, 2.57, 2.39, 4.23, level, true);
      pane(out, f, p, 10.03, 3.02, 7.42, level);
    }
    const row = facade([0, 53.71], [1, 0]);
    for (let j = 0; j < 4; j++) {
      const x = left + 0.72 + ((width - 1.44) * j) / 3;
      capital(out, row, x, 9.19, 19.38, 0.37, level);
    }
    stoneBand(out, row, left, right, 8.81, 9.18, 0.9, tone.pink);
    stoneBand(out, row, left, right, 19.1, 20.26, 1.05);
    if (level > 1) {
      for (let j = 1; j < 21; j++) {
        const x = left + (width * j) / 21;
        stoneBand(out, row, x - 0.082, x + 0.082, 9.12, 10.04, 0.29);
      }
    }
  }
}

function sculptedDisk(out, f, x, y, r, level) {
  const count = level < 2 ? 8 : 16;
  const points = (radius, d) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i * 2 * Math.PI) / count;
      return f.P(x + radius * Math.cos(a), y + radius * Math.sin(a), d);
    });
  fan(out, 'trim', points(r, 0.162), tone.pink);
  fan(out, 'trim', points(r * 0.82, 0.178), tone.belt);
  const [px, , pz] = f.P(x, y, 0.23);
  if (level > 1) {
    sphere(out, 'trim', [px, y + 0.2, pz], [r * 0.28, r * 0.39, 0.13], tone.trim, 8, 5);
    sphere(out, 'trim', [px, y - 0.27, pz], [r * 0.51, r * 0.3, 0.14], tone.trim, 8, 4);
  }
}

function portico(out, level) {
  patch(out, 'red', centerFront, -17.82, 17.81, stairTop, 19.5, 0.032, tone.pompeian);
  for (const x of [-10.45, -5.23, 0, 5.23, 10.45]) {
    const w = 2.75;
    pane(out, centerFront, x, stairTop + 0.07, w, 8.09, level, true);
    if (level > 0) {
      patch(
        out,
        'door',
        centerFront,
        x - 1.23,
        x + 1.23,
        stairTop + 0.07,
        stairTop + 3.3,
        0.11,
        tone.dark,
      );
    }
    if (level > 0) {
      stoneBand(
        out,
        centerFront,
        x - w * 0.63,
        x + w * 0.63,
        stairTop + 0.12,
        stairTop + 0.37,
        0.33,
        tone.belt,
      );
      pane(out, centerFront, x, 13.18, 2.36, 4.32, level);
    }
  }
  const north = facade([0, 57.87], [1, 0]);
  const ends = [-16.74, -14.83, 14.83, 16.74];
  for (const x of ends) {
    stoneBand(out, north, x - 0.54, x + 0.54, stairTop, 19.1, 0.4, tone.pink);
    if (level > 0) {
      stoneBand(out, north, x - 0.68, x + 0.68, stairTop, stairTop + 0.52, 0.57, tone.trim);
      stoneBand(out, north, x - 0.72, x + 0.72, 18.1, 19.06, 0.69, tone.trim);
    }
  }
  for (const x of [-7.56, -2.52, 2.52, 7.56]) capital(out, north, x, stairTop, 19.09, 0.88, level);
  const halfCols = facade([0, 57.7], [1, 0]);
  for (const x of [-12.16, 12.16]) {
    if (level > 0)
      abox(out, 'wall', [x - 0.41, stairTop, 52.72], [x + 0.41, 19.42, 57.9], tone.pink);
    capital(out, halfCols, x, stairTop, 19.09, 0.76, level);
  }
  const l = -18.33,
    r = 18.33;
  abox(out, 'wall', [l, 19.03, 52.28], [r, 21.01, 58.24], tone.pink);
  stoneBand(out, north, l - 0.29, r + 0.29, 19.06, 19.49, 1.03);
  stoneBand(out, north, l - 0.57, r + 0.57, 20.54, 21.02, 1.23);
  abox(out, 'wall', [-13.1, 21.01, 52.42], [13.1, 26.38, 58.01], tone.stone);
  stoneBand(out, north, -13.28, 13.28, 25.95, 26.43, 0.65);
  for (const x of [-14.69, 14.69]) {
    abox(out, 'wall', [x - 2.73, 21.0, 52.37], [x + 2.73, 27.78, 58.52], tone.pink);
    stoneBand(out, north, x - 2.85, x + 2.85, 27.13, 27.79, 0.99);
    stoneBand(out, north, x - 2.93, x + 2.93, 22.08, 22.39, 0.78, tone.belt);
    pane(out, north, x, 22.55, 1.31, 3.7, level);
  }
  if (level > 0) {
    for (const x of [-10.38, -6.92, -3.46, 0, 3.46, 6.92, 10.38]) {
      stoneBand(out, north, x - 1.4, x + 1.4, 22.08, 25.42, 0.26, tone.pink);
      sculptedDisk(out, north, x, 23.72, 1.08, level);
    }
    for (const x of [-11.95, -5.18, 5.18, 11.95]) {
      stoneBand(out, north, x - 0.34, x + 0.34, 21.3, 22.64, 0.61);
      if (level > 1) {
        stoneBand(out, north, x - 0.2, x + 0.2, 22.55, 24.48, 0.69, tone.trim);
        const t = north.P(x, 24.72, 0.47);
        sphere(out, 'trim', t, [0.26, 0.34, 0.17], tone.trim, 7, 3);
      }
    }
    if (level > 1) {
      for (let x = -18.05; x < 18.15; x += level === 3 ? 0.4 : 0.66) {
        stoneBand(out, north, x - 0.073, x + 0.073, 20.31, 20.56, 0.69);
      }
    }
  }
  const zbase = 65.15;
  const count = [3, 9, 14, 17][level];
  for (let i = 0; i < count; i++) {
    const z = zbase - (6.0 * i) / count;
    abox(out, 'base', [-12.45, -0.09, 53.25], [12.45, (stairTop * (i + 1)) / count, z], tone.base);
  }
  for (const x of [-13.2, 13.2]) {
    abox(out, 'base', [x - 0.43, 0.1, 59.17], [x + 0.43, 1.03, 64.46], tone.base);
    abox(out, 'base', [x - 0.73, 0.01, 62.59], [x + 0.73, 2.6, 64.05], tone.base);
    abox(out, 'trim', [x - 0.8, 2.57, 62.51], [x + 0.8, 2.78, 64.11], tone.pink);
    abox(out, 'base', [x - 0.53, 1.05, 54.09], [x + 0.53, 3.15, 59.35], tone.base);
  }
}

function roof(out, x0, x1, z0, z1, y, h) {
  const x = (x1 + x0) / 2;
  const a = [x0, y, z1],
    b = [x1, y, z1],
    c = [x1, y, z0],
    d = [x0, y, z0];
  const p = [x, h, z1],
    q = [x, h, z0];
  quad4(out, 'copper', a, p, q, d, tone.copper);
  quad4(out, 'copper', p, b, c, q, tone.copper);
  tri(out, 'wall', a, b, p, tone.stone);
  tri(out, 'wall', c, d, q, tone.stone);
}

function rooflights(out, level) {
  for (const ext of [
    [-32, -16, -57.5, 52.6, 20.12, 23.61],
    [16, 31.6, -57.5, 52.6, 20.12, 23.45],
    [-16.15, 16.15, -58.45, -46.3, 20.12, 24.27],
    [-16.15, 16.15, 30.3, 52.89, 20.12, 24.29],
    [-21.2, 21.2, -47, 31.3, 19.95, 23.72],
  ])
    roof(out, ...ext);
  const slots = [
    [-21, -12],
    [-12, -3],
    [-3, 6],
    [6, 15],
    [15, 24],
  ];
  if (level === 0) slots.splice(0, 5, [-21, 24]);
  if (level === 1) slots.splice(0, 5, [-21, -6], [-6, 9], [9, 24]);
  for (const [l, r] of slots) {
    for (const [z0, z1] of [
      [-46, -34],
      [-27, -15],
      [-8, 4],
      [11, 23],
    ]) {
      const [b, y] = [24.0, 28.78];
      abox(out, 'copper', [l + 0.14, 22.91, z0], [r - 0.18, b, z1], tone.copper);
      const back = [
        [l + 0.14, b, z0],
        [r - 0.18, b, z0],
      ];
      const ridge = [
        [l + 0.14, y, z1 - 2.45],
        [r - 0.18, y, z1 - 2.45],
      ];
      quad4(out, 'copper', ridge[0], ridge[1], back[1], back[0], tone.copper);
      quad4(out, 'glass', [l + 0.14, b, z1], [r - 0.18, b, z1], ridge[1], ridge[0], tone.skyGlass);
      if (level > 1) {
        for (let j = 1; j < 6; j++) {
          const x = l + 0.14 + ((r - l - 0.32) * j) / 6;
          beam(
            out,
            'copper',
            [x, b + 0.04, z1 + 0.005],
            [x, y + 0.04, z1 - 2.452],
            0.065,
            0.074,
            tone.copper,
          );
        }
      }
    }
  }
}

function chariot(out, x, level) {
  const z = 55.69,
    y = 27.78;
  const vector = (a, b, c) => [x + a, y + b, z + c];
  const base = (a, b) => abox(out, 'bronze', vector(...a), vector(...b), tone.bronze);
  const joint = (p, q, t, w = t) =>
    beam(out, 'bronze', vector(...p), vector(...q), t, w, tone.bronze);
  const mass = (p, r) =>
    sphere(out, 'bronze', vector(...p), r, tone.bronze, level < 2 ? 6 : 10, level < 2 ? 3 : 5);
  base([-2.2, 0, -1.98], [2.2, 0.33, 2.03]);
  if (level === 0) {
    for (const px of [-0.72, 0.72]) {
      const at = (yy, zz) => vector(px, yy, zz);
      for (const triad of [
        [at(1.08, -0.56), at(1.14, 1.3), at(1.87, 1.26)],
        [at(1.08, -0.56), at(1.87, 1.26), at(1.77, -0.5)],
        [at(1.59, 1.05), at(2.75, 1.56), at(2.48, 2.02)],
        [at(1.59, 1.05), at(2.48, 2.02), at(1.43, 1.4)],
        [at(1.21, 0.7), at(0.42, 1.58), at(1.25, 1.31)],
        [at(1.15, -0.39), at(0.43, -0.55), at(1.21, -0.06)],
      ]) {
        tri(out, 'bronze', ...triad, tone.bronze);
        tri(out, 'bronze', triad[2], triad[1], triad[0], tone.bronze);
      }
    }
    joint([0, 1.07, -1.02], [0, 3.18, -0.96], 0.58, 0.56);
    for (const side of [-1, 1]) {
      const a = vector(0, 2.33, -1.2),
        b = vector(side * 1.34, 4.32, -1.36),
        c = vector(side * 0.31, 3.49, -1.41);
      tri(out, 'bronze', a, b, c, tone.bronze);
      tri(out, 'bronze', c, b, a, tone.bronze);
    }
    return;
  }
  base([-1.04, 0.31, -1.47], [1.04, 1.27, -0.42]);
  for (const px of [-1.06, 1.06]) {
    if (level > 0) mass([px, 0.68, -1.12], [0.14, 0.63, 0.63]);
    const hx = px * 0.71;
    mass([hx, 1.5, 0.64], [0.47, 0.57, 1.16]);
    mass([hx, 1.81, 1.42], [0.37, 0.69, 0.41]);
    joint([hx, 1.68, 1.04], [hx, 2.68, 1.41], 0.39, 0.44);
    joint([hx, 2.7, 1.38], [hx, 2.55, 2.02], 0.4, 0.31);
    joint([hx - 0.15, 1.38, 0.12], [hx - 0.21, 0.42, -0.03], 0.21, 0.17);
    joint([hx + 0.14, 1.37, 0.88], [hx + 0.21, 0.87, 1.54], 0.19, 0.18);
    joint([hx + 0.21, 0.87, 1.54], [hx + 0.2, 0.46, 1.51], 0.15, 0.16);
    if (level > 1) {
      joint([hx - 0.16, 1.37, 0.99], [hx - 0.23, 0.59, 0.96], 0.16);
      joint([hx + 0.17, 1.39, -0.15], [hx + 0.23, 0.49, -0.34], 0.17);
      joint([hx, 1.66, -0.42], [hx, 0.97, -0.76], 0.14);
      for (const e of [-0.145, 0.145]) joint([hx + e, 2.64, 1.62], [hx + e, 2.96, 1.55], 0.11);
    }
  }
  joint([0, 1.07, -1.02], [0, 2.9, -0.96], 0.51, 0.7);
  mass([0, 3.13, -0.94], [0.24, 0.33, 0.21]);
  for (const side of [-1, 1]) {
    joint([0, 2.68, -0.98], [side * 0.75, 3.03, -0.71], 0.23, 0.25);
    const wing = [
      vector(side * 0.17, 2.33, -1.05),
      vector(side * 0.67, 2.61, -1.33),
      vector(side * 1.28, 4.32, -1.36),
      vector(side * 0.48, 3.27, -1.4),
    ];
    quad4(out, 'bronze', ...wing, tone.bronze);
    quad4(out, 'bronze', wing[3], wing[2], wing[1], wing[0], tone.bronze);
    if (level > 1)
      for (let k = 0; k < 5; k++) {
        joint(
          [side * (0.32 + 0.047 * k), 2.71, -1.38],
          [side * (1.15 - 0.09 * k), 4.05 - 0.21 * k, -1.4],
          0.04,
          0.052,
        );
      }
  }
}

function build(out, level) {
  facadeWings(out, level);
  portico(out, level);
  rooflights(out, level);
  chariot(out, -14.69, level);
  chariot(out, 14.69, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'royal-museum-of-fine-arts-antwerp-model.mjs';
const camera = [60, 32, 136];
const lookAt = [0, 13, 33];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1890 Antwerp museum with its open Corinthian entrance porch, copper roofs and twin bronze chariots.',
  camera,
  lookAt,
  sunDirection: [29, 56, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Named historical KMSKA building outline, including external portico.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone',
    'plaster_lime',
    'metal_painted',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'leopold-de-waelplaats-elevation', position: [14, 10, 124], lookAt: [0, 13.33, 54] },
    { name: 'corinthian-portico-and-chariots', position: [17, 12, 95], lookAt: [0, 17.4, 56.2] },
    { name: 'copper-roofs-and-daylight-structures', position: [70, 77, 12], lookAt: [0, 19, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'antwerp-royal-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.73,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, native OpenStreetMap outline under ODbL and Flemish DHMVII survey under provider attribution.',
};
