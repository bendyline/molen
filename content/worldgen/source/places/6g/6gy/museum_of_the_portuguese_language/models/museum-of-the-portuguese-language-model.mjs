/** The Luz Station exterior shared by the railway and Museum of the Portuguese Language. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box as meshBox,
  profile,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    brick: 'a9725c',
    warm: 'b1846d',
    brickDark: '986d5a',
    stone: 'd2c3a1',
    trim: 'ded0b2',
    ivory: 'e1d5b7',
    plinth: 'a4a092',
    basalt: '858680',
    glass: '626d6a',
    dark: '66594f',
    metal: '687473',
    iron: '736c60',
    roof: '73848b',
    roofDark: '60737f',
    seam: '87949a',
    track: '8d887d',
    platform: 'b9b2a0',
    clock: 'c9d4d0',
    dial: '596867',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const palette = 'palette:#ffffff';
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.11 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.86 },
  opening: { slot: 'window', localRef: palette, roughness: 0.68 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.13 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const nfront = [0, 0, -1];
const faceAt = (z) => (u, y, p) => [u, y, z - p];
const facePanel = (out, slot, f, n, a, b, lo, hi, depth, tint) =>
  quad(out, slot, [f(a, lo, depth), f(b, lo, depth), f(b, hi, depth), f(a, hi, depth)], n, tint);

function arch(out, face, n, u, y, r, spring, rise, level, tint = c.glass) {
  const steps = [3, 3, 8, 11][level];
  const passes =
    level <= 1
      ? [[r, y, rise, 0.043, 'opening', tint]]
      : [
          [r + 0.15, y - 0.078, rise + 0.19, 0.031, 'stone', c.trim],
          [r, y, rise, 0.05, 'opening', tint],
        ];
  for (const [half, bottom, top, off, slot, color] of passes) {
    facePanel(out, slot, face, n, u - half, u + half, bottom, spring, off, color);
    const p = (a) => face(u + Math.cos(a) * half, spring + Math.sin(a) * top, off);
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps,
        b = ((i + 1) * Math.PI) / steps;
      out.addTriangle(
        slot,
        palette,
        [face(u, spring, off), p(a), p(b)],
        n,
        [
          [0.5, 0],
          [0, 1],
          [1, 1],
        ],
        color,
      );
    }
  }
  if (level >= 2) {
    facePanel(out, 'trim', face, n, u - 0.048, u + 0.048, y, spring, 0.072, c.stone);
    facePanel(out, 'trim', face, n, u - r, u + r, spring - 0.08, spring, 0.073, c.stone);
  }
}

function masonryRange(out, x0, x1, z0, z1, roof, level, formal = false) {
  box(out, 'stone', x0, x1, d.foundationY, 0.73, z0, z1, c.plinth);
  box(out, 'brick', x0, x1, 0.73, roof, z0, z1, c.brick);
  box(out, 'roof', x0, x1, roof - 0.06, roof + 0.01, z0, z1, c.roofDark);
  const tall = roof >= 13;
  const courses =
    level === 0
      ? [roof - 0.37]
      : [1.26, 5.91, 6.42, 11.65, 12.28, roof - 0.88, roof - 0.51, roof - 0.15].filter(
          (y) => y < roof,
        );
  for (const y of courses)
    box(out, 'stone', x0 - 0.17, x1 + 0.17, y, y + 0.16, z0 - 0.22, z1 + 0.22, c.stone);
  const count = Math.max(1, Math.round((x1 - x0) / (level === 0 ? 13.8 : 5.08)));
  const unit = (x1 - x0) / count;
  const faces = [
    [faceAt(z0), nfront],
    [(u, y, p) => [u, y, z1 + p], [0, 0, 1]],
  ];
  const visibleFaces = level <= 1 ? [faces[formal ? 0 : 1]] : faces;
  for (let i = 0; i < count; i++) {
    const x = x0 + unit * (i + 0.5);
    for (const [face, n] of visibleFaces) {
      const r = Math.min(1.36, unit * 0.33);
      if (level === 0) {
        facePanel(out, 'opening', face, n, x - r, x + r, 2.3, 4.89, 0.056, c.dark);
        if (tall) facePanel(out, 'opening', face, n, x - r, x + r, 8, 11.1, 0.056, c.glass);
        continue;
      }
      arch(out, face, n, x, 1.05, r, 4.24, 1.12, level, c.dark);
      if (tall) {
        arch(out, face, n, x, 7.15, r, 10.24, 0.85, level);
        arch(out, face, n, x, 13.15, r * 0.76, 15.83, 0.93, level);
      } else {
        arch(out, face, n, x, 6.56, r * 0.72, 8.06, 0.58, level);
      }
      const left = x - unit * 0.51;
      facePanel(out, 'stone', face, n, left, left + 0.43, 0.93, roof - 0.57, 0.095, c.stone);
      if (formal && level >= 2) {
        facePanel(out, 'stone', face, n, x - r - 0.23, x + r + 0.23, 6.99, 7.15, 0.18, c.ivory);
        facePanel(out, 'stone', face, n, x - r - 0.23, x + r + 0.23, 12.98, 13.16, 0.18, c.ivory);
      }
    }
  }
}

function pavilion(out, x, z, w, h, level) {
  const r = w / 2;
  box(out, 'brick', x - r, x + r, d.foundationY, h, z - r, z + r, c.warm);
  const cap = d.pavilionRoofY - (d.wingParapetY - h) * 0.7;
  if (level === 0) {
    profile(
      out,
      [
        [h - 0.02, r + 0.15, r + 0.15],
        [cap - 0.48, r * 0.52, r * 0.52, 'roof', c.roofDark],
        [cap, r * 0.18, r * 0.18, 'roof', c.roof],
      ],
      4,
      [x, z],
    );
    const north = (u, y, p) => [x + u, y, z - r - p];
    facePanel(out, 'opening', north, nfront, -0.98, 0.98, 9.6, 14.1, 0.055, c.glass);
    return;
  }
  for (const y of [5.98, 11.8, h - 0.26])
    box(out, 'stone', x - r - 0.23, x + r + 0.23, y, y + 0.22, z - r - 0.23, z + r + 0.23, c.stone);
  for (const [axis, s] of [
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
  ]) {
    if (level === 0 && axis === 1) continue;
    const face = (u, y, p) =>
      axis === 0 ? [x + u, y, z + s * (r + p)] : [x + s * (r + p), y, z + u];
    const n = axis === 0 ? [0, 0, s] : [s, 0, 0];
    arch(out, face, n, 0, 7.14, 1.32, 10.22, 0.9, level);
    arch(out, face, n, 0, 13.13, 0.95, Math.min(h - 1.3, 15.66), 0.75, level);
    if (level >= 1) {
      for (const u of [-r + 0.24, r - 0.24]) {
        facePanel(out, 'stone', face, n, u - 0.28, u + 0.28, 0.83, h, 0.2, c.trim);
      }
    }
  }
  const ridges = [
    [h - 0.02, r + 0.23, r + 0.23],
    [h + 0.46, r + 0.23, r + 0.23, 'stone', c.trim],
    [cap - 1.12, r * 0.47, r * 0.47, 'roof', c.roofDark],
    [cap - 0.59, r * 0.63, r * 0.63, 'roof', c.roof],
    [cap, r * 0.16, r * 0.16, 'roof', c.roofDark],
  ];
  profile(out, ridges, 4, [x, z]);
  if (level >= 1) {
    const pole = level === 1 ? 0.056 : 0.041;
    box(out, 'iron', x - pole, x + pole, cap - 0.04, cap + 2.38, z - pole, z + pole, c.iron);
  }
}

function dial(out, face, n, base, level) {
  const count = [7, 12, 20, 28][level];
  const radius = d.clockDialDiameter / 2;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count;
    const p = (r, a, off) => face(Math.cos(a) * r, base + Math.sin(a) * r, off);
    out.addTriangle(
      'trim',
      palette,
      [face(0, base, 0.104), p(radius, a, 0.104), p(radius, b, 0.104)],
      n,
      [
        [0.5, 0.5],
        [0, 0],
        [1, 0],
      ],
      c.clock,
    );
    if (level >= 1)
      quad(
        out,
        'stone',
        [
          p(radius, a, 0.102),
          p(radius + 0.18, a, 0.102),
          p(radius + 0.18, b, 0.102),
          p(radius, b, 0.102),
        ],
        n,
        c.stone,
      );
  }
  if (level >= 2) {
    facePanel(out, 'iron', face, n, -0.046, 0.046, base - 0.1, base + 1.11, 0.128, c.dial);
    facePanel(out, 'iron', face, n, -0.85, 0.03, base - 0.043, base + 0.062, 0.128, c.dial);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const u = radius * 0.79 * Math.cos(a),
        y = base + radius * 0.79 * Math.sin(a);
      facePanel(out, 'trim', face, n, u - 0.047, u + 0.047, y - 0.07, y + 0.07, 0.123, c.dial);
    }
  }
}

function clockTower(out, level) {
  const [x, z] = d.clockCenter;
  for (const [r, low, high] of [
    [5.18, 0.62, 33.02],
    [4.67, 32.75, 42.54],
    [3.36, 42.21, 49.48],
  ]) {
    box(out, 'brick', x - r, x + r, low, high, z - r, z + r, c.brickDark);
    box(
      out,
      'stone',
      x - r - 0.32,
      x + r + 0.32,
      high - 0.36,
      high + 0.05,
      z - r - 0.32,
      z + r + 0.32,
      c.trim,
    );
    if (level >= 1) {
      box(
        out,
        'stone',
        x - r - 0.14,
        x + r + 0.14,
        low + 0.19,
        low + 0.45,
        z - r - 0.14,
        z + r + 0.14,
        c.stone,
      );
    }
  }
  for (const [axis, s] of [
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
  ]) {
    const face = (r) => (u, y, p) =>
      axis === 0 ? [x + u, y, z + s * (r + p)] : [x + s * (r + p), y, z + u];
    const n = axis === 0 ? [0, 0, s] : [s, 0, 0];
    if (level === 0 && axis === 1) continue;
    const lower = face(5.18),
      mid = face(4.67),
      upper = face(3.36);
    for (const u of [-2.52, 0, 2.52]) {
      arch(out, lower, n, u, 21.2, 0.74, 29.4, 0.95, level);
    }
    dial(out, mid, n, 37.82, level);
    if (level >= 1) arch(out, upper, n, 0, 43.14, 1.12, 47.06, 0.85, level, c.dark);
    for (const [r, low, high] of [
      [5.18, 19.0, 32.63],
      [4.67, 33.08, 42.5],
      [3.36, 42.6, 49.1],
    ]) {
      for (const u of [-r + 0.33, r - 0.33]) {
        facePanel(out, 'stone', face(r), n, u - 0.34, u + 0.34, low, high, 0.089, c.trim);
      }
    }
  }
  profile(
    out,
    [
      [49.41, 3.08, 3.08],
      [49.81, 3.08, 3.08, 'stone', c.stone],
      [50.3, 2.69, 2.69, 'roof', c.roofDark],
      [51.33, 2.59, 2.59, 'roof', c.roof],
      [52.22, 1.65, 1.65, 'roof', c.roof],
      [53.57, 0.92, 0.92, 'roof', c.roofDark],
      [54.1, 0.31, 0.31, 'roof', c.roofDark],
      [d.clockTowerY, 0.046, 0.046, 'iron', c.iron],
    ],
    [6, 8, 12, 16][level],
    [x, z],
  );
}

function streetAwning(out, level) {
  const start = -70.92,
    end = 63.95,
    z = -30.77,
    outer = -35.96;
  quad(
    out,
    'roof',
    [
      [start, 5.82, z],
      [end, 5.82, z],
      [end, 5.4, outer],
      [start, 5.4, outer],
    ],
    [0, 1, -0.08],
    c.roof,
  );
  box(out, 'stone', start, end, 5.21, 5.56, outer - 0.06, outer + 0.12, c.trim);
  const supports = [7, 15, 24, 27][level];
  for (let i = 0; i < supports; i++) {
    const x = start + 0.55 + ((i + 0.5) * (end - start - 1.1)) / supports;
    box(out, 'iron', x - 0.085, x + 0.085, d.streetY, 5.41, outer + 0.27, outer + 0.44, c.iron);
    if (level >= 1) {
      tube(out, 'iron', [x, 3.68, outer + 0.36], [x, 5.39, outer + 2.6], 0.081, c.iron, 5);
      if (level >= 2)
        tube(
          out,
          'iron',
          [x - 0.54, 4.27, outer + 0.36],
          [x + 0.54, 4.27, outer + 0.36],
          0.049,
          c.iron,
          5,
        );
    }
  }
}

function trainShed(out, level) {
  const start = -77.32,
    end = start + d.shedLength;
  const center = 9.02,
    half = d.shedSpan / 2;
  const rise = d.shedCrownY - d.shedSpringY;
  const n = [8, 14, 23, 36][level];
  const sides = [1, 3, 5, 9][level];
  const archAt = (x, a, drop = 0) => [
    x,
    d.shedSpringY + Math.sin(a) * rise - drop,
    center + Math.cos(a) * half,
  ];
  for (let t = 0; t < n; t++) {
    const a = (t * Math.PI) / n,
      b = ((t + 1) * Math.PI) / n;
    const middle = (a + b) / 2;
    const normal = [0, Math.sin(middle), (Math.cos(middle) * rise) / half];
    for (let i = 0; i < sides; i++) {
      const x = start + ((end - start) * i) / sides,
        xx = start + ((end - start) * (i + 1)) / sides;
      quad(
        out,
        'roof',
        [archAt(x, a), archAt(xx, a), archAt(xx, b), archAt(x, b)],
        normal,
        i % 2 === 0 ? c.roof : c.roofDark,
      );
    }
    if (level >= 1) {
      for (const x of [start, end]) {
        const norm = [x === start ? -1 : 1, 0, 0];
        quad(
          out,
          'iron',
          [archAt(x, a), archAt(x, b), archAt(x, b, 0.54), archAt(x, a, 0.54)],
          norm,
          c.iron,
        );
      }
    }
  }
  for (const z of [center - half, center + half]) {
    box(out, 'iron', start, end, 8.21, 8.55, z - 0.16, z + 0.16, c.iron);
    const posts = level === 0 ? 3 : level === 1 ? 9 : 16;
    for (let i = 0; i < posts; i++) {
      const x = start + ((i + 0.5) * (end - start)) / posts;
      box(out, 'iron', x - 0.13, x + 0.13, d.trackY + 0.5, 8.42, z - 0.13, z + 0.13, c.metal);
    }
  }
  const base = d.shedCrownY - 0.58;
  box(
    out,
    'opening',
    start + 2.8,
    end - 3.2,
    base,
    base + 2.05,
    center - 1.24,
    center + 1.24,
    c.glass,
  );
  box(
    out,
    'roof',
    start + 2.4,
    end - 2.8,
    base + 1.9,
    base + 2.22,
    center - 1.49,
    center + 1.49,
    c.roofDark,
  );
  const track = d.trackY;
  box(out, 'stone', start, end, track - 0.31, track, center - half, center + half, c.track);
  for (const z of [center - 13.3, center, center + 13.3]) {
    box(
      out,
      'stone',
      start + 0.33,
      end - 0.33,
      track,
      track + 0.95,
      z - 2.15,
      z + 2.15,
      c.platform,
    );
  }
  if (level >= 2) {
    for (const z of [center - 8.0, center - 4.0, center + 4.0, center + 8.0]) {
      for (const off of [-0.68, 0.68])
        box(
          out,
          'iron',
          start,
          end,
          track + 0.04,
          track + 0.1,
          z + off - 0.044,
          z + off + 0.044,
          c.iron,
        );
    }
    const ribs = level === 2 ? 7 : 13;
    for (let i = 0; i < ribs; i++) {
      const x = start + 0.31 + (i * (end - start - 0.62)) / (ribs - 1);
      for (let t = 0; t < 12; t++) {
        tube(
          out,
          'iron',
          archAt(x, (t * Math.PI) / 12, 0.31),
          archAt(x, ((t + 1) * Math.PI) / 12, 0.31),
          0.112,
          c.iron,
          4,
        );
      }
    }
  }
}

function draw(out, level) {
  const west = outline[65][0],
    east = outline[0][0];
  masonryRange(out, west, east, -30.6, -10.88, d.mainEavesY, level, true);
  masonryRange(out, outline[42][0], outline[24][0], 22.62, 29.79, 9.9, level);
  masonryRange(out, -38, -6.75, -32.1, -12.17, 19.38, level, true);
  pavilion(out, -68.7, -24.4, 9.25, d.wingParapetY, level);
  pavilion(out, 60.2, -26.9, 8.7, d.wingParapetY, level);
  pavilion(out, 60.2, -17.1, 8.6, d.wingParapetY, level);
  pavilion(out, 72.78, -8.45, 8.9, 16.47, level);
  pavilion(out, -79.67, -7.77, 8.7, 16.75, level);
  pavilion(out, 72.85, 26.23, 8.8, 16.68, level);
  pavilion(out, -79.78, 27.16, 8.75, 16.57, level);
  clockTower(out, level);
  streetAwning(out, level);
  trainShed(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [173, 77, -144];
const lookAt = [-5, 14, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Luz Station and the Museum of the Portuguese Language, with ornate brick wings, pale arched dressings, a tall clock tower, mansard pavilions and vaulted railway platforms.',
  camera,
  lookAt,
  sunDirection: [124, 164, -139],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['brick', 'stone_limestone_raw', 'metal_standing_seam', 'metal_painted'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.84,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'station-museum-and-train-shed', position: [123, 55, -107], lookAt: [3, 14, 1] },
    { name: 'victorian-clock-and-museum-canopy', position: [16, 13, -95], lookAt: [-17, 20, -25] },
    { name: 'east-platform-vault-and-pavilions', position: [122, 16, 35], lookAt: [68, 7, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.1, surfaces },
      street: { export: 'street', errorMeters: 0.38, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction from the exact public-domain and CC0 Qualla originals, measured railway architecture, mapped station and museum outlines and original terrain.',
};
