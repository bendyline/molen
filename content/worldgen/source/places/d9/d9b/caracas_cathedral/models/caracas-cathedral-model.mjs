/** Caracas Cathedral, the Metropolitan Cathedral of Saint Anne at Plaza Bolívar. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box as meshBox,
  prism,
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const perimeter = [...outline].reverse();
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    plaster: 'ded6c3',
    pale: 'e5dcc6',
    limestone: 'c7bfa9',
    stone: 'b4ac98',
    plinth: 'a69f90',
    ochre: 'c3ac8b',
    clay: 'a66650',
    clayDark: '97614f',
    tile: 'b27a60',
    shadow: '6b6255',
    timber: '725744',
    glass: '676a64',
    bright: 'e8e2ce',
    clock: 'c7c2af',
    clockMark: '615c54',
    metal: '716b57',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.96 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.96 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.87 },
  dark: { slot: 'window', localRef: palette, roughness: 0.78 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const flat = (out, slot, locate, normal, u0, u1, y0, y1, offset, tint) => {
  const p = [
    [u0, y0, offset],
    [u1, y0, offset],
    [u1, y1, offset],
    [u0, y1, offset],
  ].map((v) => locate(...v));
  quad(out, slot, p, normal, tint);
};

function arched(out, locate, normal, u, y, r, spring, rise, level, tint) {
  const steps = [4, 7, 11, 16][level];
  const panels =
    level === 0
      ? [[r, y, rise, 0.04, 'dark', tint]]
      : [
          [r + 0.17, y - 0.11, rise + 0.17, 0.027, 'stone', c.limestone],
          [r, y, rise, 0.049, 'dark', tint],
        ];
  for (const [half, base, arch, depth, slot, color] of panels) {
    const p = (a) => locate(u + half * Math.cos(a), spring + arch * Math.sin(a), depth);
    flat(out, slot, locate, normal, u - half, u + half, base, spring, depth, color);
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI) / steps;
      const b = ((i + 1) * Math.PI) / steps;
      out.addTriangle(
        slot,
        palette,
        [locate(u, spring, depth), p(a), p(b)],
        normal,
        [
          [0.5, 0],
          [0, 1],
          [1, 1],
        ],
        color,
      );
    }
  }
  if (level >= 2)
    flat(out, 'trim', locate, normal, u - 0.045, u + 0.045, y + 0.08, spring, 0.061, c.stone);
}

function pitched(out, x0, x1, z0, z1, eave, rise, level, tint = c.clay) {
  const middle = (z0 + z1) / 2;
  const r = (z1 - z0) / 2;
  for (const s of [-1, 1]) {
    const side = middle + s * r;
    const normal = [0, r / Math.hypot(r, rise), (s * rise) / Math.hypot(r, rise)];
    quad(
      out,
      'roof',
      [
        [x0, eave, side],
        [x1, eave, side],
        [x1, eave + rise, middle],
        [x0, eave + rise, middle],
      ],
      normal,
      tint,
    );
    for (const [x, dir] of [
      [x0, -1],
      [x1, 1],
    ]) {
      out.addTriangle(
        'plaster',
        palette,
        [
          [x, eave, side],
          [x, eave, middle],
          [x, eave + rise, middle],
        ],
        [dir, 0, 0],
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        c.plaster,
      );
    }
    if (level < 2) continue;
    const joints = level === 3 ? 15 : 8;
    for (let i = 1; i < joints; i++) {
      const t = i / joints;
      const z = middle + s * r * t;
      const y = eave + rise * (1 - t) + 0.042;
      quad(
        out,
        'roof',
        [
          [x0, y, z],
          [x1, y, z],
          [x1, y - 0.012, z + s * 0.045],
          [x0, y - 0.012, z + s * 0.045],
        ],
        normal,
        c.tile,
      );
    }
  }
}

function body(out, level) {
  prism(out, 'stone', perimeter, d.foundationY, 1.42, c.plinth);
  prism(out, 'plaster', perimeter, 1.41, d.baseEaves, c.plaster);
  const sections = [
    { z0: -22.65, z1: -14.35, x0: -37.82, x1: 36.45, eave: 9.36, rise: 1.96 },
    { z0: -14.59, z1: -6.42, x0: -37.48, x1: 36.27, eave: 11.82, rise: 2.56 },
    {
      z0: -6.77,
      z1: 5.95,
      x0: -38.08,
      x1: 36.88,
      eave: d.highEaves,
      rise: d.naveRidge - d.highEaves,
    },
    { z0: 5.78, z1: 14.4, x0: -37.48, x1: 37.05, eave: 11.71, rise: 2.76 },
    { z0: 14.1, z1: 22.7, x0: -37.96, x1: 36.51, eave: 9.39, rise: 1.99 },
  ];
  sections.forEach(({ x0, x1, z0, z1, eave, rise }, i) => {
    if (eave > d.baseEaves + 0.12)
      box(
        out,
        'plaster',
        x0 + 0.23,
        x1 - 0.24,
        d.baseEaves - 0.1,
        eave,
        z0 + 0.18,
        z1 - 0.18,
        c.plaster,
      );
    pitched(out, x0, x1, z0, z1, eave, rise, level, i % 2 ? c.clayDark : c.clay);
    box(out, 'trim', x0, x1, eave - 0.19, eave + 0.05, z0 - 0.08, z0 + 0.12, c.limestone);
  });
  for (const side of [-1, 1]) {
    const a = outline[side === 1 ? 4 : 3];
    const b = outline[side === 1 ? 0 : 1];
    const z = (x) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    const bays = level === 0 ? 5 : 10;
    for (let i = 0; i < bays; i++) {
      const x = -33 + ((i + 0.5) * 65) / bays;
      const loc = (u, y, depth) => [x + u, y, z(x + u) + side * (0.04 + depth)];
      const height = side === 1 ? 6.14 : 5.25;
      arched(out, loc, [0, 0, side], 0, 3.03, 0.87, height, 0.86, level, c.glass);
      if (level >= 2) {
        const pier = x + (65 / bays) * 0.47;
        const zz = z(pier);
        box(out, 'plaster', pier - 0.25, pier + 0.25, 1.46, 8.91, zz - 0.2, zz + 0.2, c.pale);
      }
    }
  }
}

function westFace(out, level) {
  const x = d.frontX;
  const center = -4.8;
  const face = (u, y, offset) => [x + 1.03 + offset, y, center + u];
  const y0 = d.entryY;
  const widths = [32.1, 25.45, 15.6];
  const [lower, middle, upper] = widths.map((w) => w / 2);
  const baseZ = center - lower;
  const capZ = center + lower;
  box(out, 'stone', x - 0.22, x + 1.25, d.foundationY, 1.35, baseZ, capZ, c.stone);
  box(out, 'plaster', x - 0.21, x + 1.02, 1.33, 11.8, baseZ, capZ, c.pale);
  box(out, 'plaster', x - 0.92, x + 1.02, 11.65, 18.15, center - middle, center + middle, c.pale);
  box(out, 'plaster', x - 1.41, x + 1.02, 17.98, 22.98, center - upper, center + upper, c.pale);
  const g = [
    [-upper, 22.93],
    [-upper * 0.78, 23.44],
    [-upper * 0.44, 24.07],
    [-upper * 0.23, 25.24],
    [0, d.facadeCrest],
    [upper * 0.23, 25.24],
    [upper * 0.44, 24.07],
    [upper * 0.78, 23.44],
    [upper, 22.93],
  ];
  for (let i = 0; i < g.length - 1; i++) {
    const [a, ay] = g[i];
    const [b, by] = g[i + 1];
    const verge = (u, y) => face(u, y, -0.003);
    out.addTriangle(
      'plaster',
      palette,
      [verge(0, 22.64), verge(a, ay), verge(b, by)],
      [1, 0, 0],
      [
        [0.5, 0],
        [0, 1],
        [1, 1],
      ],
      c.pale,
    );
    const p = (u, y) => face(u, y, 0.15);
    quad(
      out,
      'trim',
      [p(a, ay - 0.11), p(b, by - 0.11), p(b, by + 0.13), p(a, ay + 0.13)],
      [1, 0, 0],
      c.limestone,
    );
  }
  for (const [u, r, lowerY, spring, rise] of [
    [-10.0, 1.28, 1.43, 5.92, 1.35],
    [0, 2.34, 1.43, 7.45, 2.08],
    [10.0, 1.28, 1.43, 5.92, 1.35],
  ]) {
    arched(out, face, [1, 0, 0], u, lowerY, r, spring, rise, level, c.timber);
    if (level >= 2) {
      for (const j of [-1, 1]) {
        const z = center + u + j * (r + 0.34);
        box(out, 'stone', x + 0.93, x + 1.31, 1.47, spring, z - 0.16, z + 0.16, c.limestone);
      }
    }
  }
  arched(out, face, [1, 0, 0], 0, 13.18, 1.65, 16.41, 0.97, level, c.glass);
  for (const u of [-7.46, 7.46])
    arched(out, face, [1, 0, 0], u, 13.44, 0.86, 16.3, 0.58, level, c.shadow);
  arched(out, face, [1, 0, 0], 0, 20.0, 0.84, 21.59, 0.62, level, c.shadow);
  for (const [y, width] of [
    [11.33, lower],
    [17.73, middle],
    [22.51, upper],
  ]) {
    box(
      out,
      'stone',
      x - 0.16,
      x + 1.27,
      y,
      y + 0.25,
      center - width - 0.18,
      center + width + 0.18,
      c.limestone,
    );
    box(
      out,
      'trim',
      x - 0.2,
      x + 1.42,
      y + 0.25,
      y + 0.46,
      center - width - 0.32,
      center + width + 0.32,
      c.bright,
    );
  }
  if (level >= 1) {
    for (const [y, top, offsets] of [
      [1.66, 10.96, [-15.6, -12.23, -5.2, 5.2, 12.23, 15.6]],
      [12.02, 17.65, [-12.3, -5.6, 5.6, 12.3]],
      [18.19, 22.43, [-7.4, -4.5, 4.5, 7.4]],
    ]) {
      for (const u of offsets) {
        const z = center + u;
        box(out, 'plaster', x + 0.83, x + 1.31, y, top, z - 0.27, z + 0.27, c.bright);
        box(
          out,
          'stone',
          x + 0.92,
          x + 1.4,
          top - 0.37,
          top + 0.05,
          z - 0.34,
          z + 0.34,
          c.limestone,
        );
      }
    }
  }
  const steps = level === 0 ? 2 : 5;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    box(
      out,
      'stone',
      x + 0.92,
      x + 2.9 - t * 1.72,
      -1.0,
      (y0 * (i + 1)) / steps,
      center - 3.72,
      center + 3.72,
      c.stone,
    );
  }
  box(
    out,
    'trim',
    x + 0.99,
    x + 1.16,
    d.facadeCrest - 0.2,
    d.facadeCrest + 1.36,
    center - 0.07,
    center + 0.07,
    c.metal,
  );
  box(
    out,
    'trim',
    x + 0.99,
    x + 1.16,
    d.facadeCrest + 0.6,
    d.facadeCrest + 0.73,
    center - 0.48,
    center + 0.48,
    c.metal,
  );
}

function clock(out, loc, n, base, level) {
  const count = [8, 14, 24, 32][level];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    const b = ((i + 1) * Math.PI * 2) / count;
    const p = (r, a, offset) => loc(r * Math.cos(a), base + r * Math.sin(a), offset);
    out.addTriangle(
      'dark',
      palette,
      [loc(0, base, 0.055), p(1.28, a, 0.055), p(1.28, b, 0.055)],
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
        'trim',
        [p(1.28, a, 0.048), p(1.39, a, 0.048), p(1.39, b, 0.048), p(1.28, b, 0.048)],
        n,
        c.shadow,
      );
  }
  if (level >= 2) {
    flat(out, 'trim', loc, n, -0.033, 0.033, base - 0.23, base + 0.85, 0.069, c.clockMark);
    flat(out, 'trim', loc, n, -0.69, 0.07, base - 0.032, base + 0.032, 0.071, c.clockMark);
  }
}

function tower(out, level) {
  const x = d.towerX;
  const z = d.towerZ;
  const h = d.towerWidth / 2;
  const top = d.towerCorniceY;
  box(out, 'plaster', x - h, x + h, d.foundationY, top, z - h, z + h, c.plaster);
  for (const [y, over, depth] of [
    [8.92, 0.2, 0.32],
    [16.4, 0.27, 0.34],
    [22.55, 0.32, 0.39],
    [top - 0.75, 0.54, 0.27],
    [top - 0.49, 0.76, 0.44],
  ]) {
    if (level === 0 && y < 10) continue;
    box(
      out,
      'stone',
      x - h - over,
      x + h + over,
      y,
      y + depth,
      z - h - over,
      z + h + over,
      c.limestone,
    );
  }
  for (const [axis, s] of [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
  ]) {
    if (level === 0 && axis === 0 && s === -1) continue;
    const loc = (u, y, v) =>
      axis === 0 ? [x + s * (h + v), y, z + u] : [x + u, y, z + s * (h + v)];
    const n = axis === 0 ? [s, 0, 0] : [0, 0, s];
    arched(out, loc, n, 0, 17.31, 1.06, 20.38, 1.12, level, c.shadow);
    if (axis === 0 || s === 1) clock(out, loc, n, 26.49, level);
    if (level >= 1) {
      for (const u of [-h + 0.57, h - 0.57]) {
        flat(out, 'stone', loc, n, u - 0.31, u + 0.31, 23.05, 29.9, 0.106, c.bright);
        flat(out, 'trim', loc, n, u - 0.35, u + 0.35, 29.6, 30.07, 0.124, c.limestone);
      }
    }
  }
  const p = [
    top - 0.06,
    top + 0.33,
    top + 2.63,
    top + 3.08,
    top + 4.61,
    top + 5.3,
    d.towerTopY - 0.89,
  ];
  profile(
    out,
    [
      [p[0], 3.45, 3.45],
      [p[1], 3.45, 3.45, 'stone', c.limestone],
      [p[2], 3.22, 3.22, 'plaster', c.plaster],
      [p[3], 3.46, 3.46, 'trim', c.limestone],
      [p[4], 2.52, 2.52, 'roof', c.ochre],
      [p[5], 1.69, 1.69, 'roof', c.ochre],
      [p[6], 0.25, 0.25, 'roof', c.limestone],
      [d.towerTopY - 0.03, 0.09, 0.09, 'trim', c.metal],
    ],
    [8, 12, 16, 24][level],
    [x, z],
  );
  if (level >= 1) {
    for (const [axis, s] of [
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
    ]) {
      const loc = (u, y, v) =>
        axis === 0 ? [x + s * (3.45 + v), y, z + u] : [x + u, y, z + s * (3.45 + v)];
      arched(
        out,
        loc,
        axis === 0 ? [s, 0, 0] : [0, 0, s],
        0,
        top + 0.53,
        0.57,
        top + 1.53,
        0.61,
        level,
        c.shadow,
      );
    }
  }
}

function draw(out, level) {
  body(out, level);
  westFace(out, level);
  tower(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [105, 47, -94];
const lookAt = [5, 14, 0];
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
    'Santa Ana Cathedral in Caracas with broad tile roofs, white stepped Baroque entrance and the historic clock and bell tower.',
  camera,
  lookAt,
  sunDirection: [167, 157, 83],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stucco', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.83,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'bolivar-square-and-cathedral', position: [101, 49, -66], lookAt: [10, 13, 0] },
    { name: 'baroque-front-and-clock', position: [96, 14, -18], lookAt: [37, 17, 2] },
    { name: 'north-wall-and-tiled-naves', position: [-10, 52, 103], lookAt: [-9, 15, 2] },
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
    errorMeters: 1.9,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.82, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact public-domain Lessmann photograph in Qualla, the mapped footprint, original terrain and the modern architectural inventory.',
};
