import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
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
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const ground = floorSampler(read('terrain-grid.json'));
const colors = palette({
  ashlar: 'c4aa86',
  ochre: 'b99771',
  darkAshlar: 'aa8c6c',
  stoneTrim: 'dbc19b',
  towerStone: 'c2a17a',
  towerShade: 'ae8c68',
  inset: '796753',
  opening: '67594b',
  arcades: 'd0b697',
  marble: 'ddd0bd',
  pavementShade: 'bfb19b',
  roof: 'b69b78',
  rooftop: 'c2a281',
  dome: 'baa386',
  olive: '798779',
  metal: '6c6554',
  water: '83a099',
});
const surfaces = {
  outer: surface('wall', 'stone_ashlar', 0.92),
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.88 },
  arcades: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
  paving: surface('foundation', 'stone_ashlar', 0.9),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
  metal: surface('trim', 'metal_painted', 0.81, 0.17),
  water: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};
const courtFloor = 2.86;

function planarSurface(out, slot, outline, y, color, hole) {
  const points = hole ? [...outline, ...hole] : outline;
  const triangles = earcut(points.flat(), hole ? [outline.length] : undefined);
  for (let i = 0; i < triangles.length; i += 3) {
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      [0, 1, 0],
      color,
    );
  }
}

function pointedHead(center, half, spring, rise, sides) {
  return Array.from({ length: sides * 2 + 1 }, (_, i) => {
    const t = i / sides - 1;
    return [center + half * t, spring + rise * (1 - t * t) * (1 - 0.38 * Math.abs(t))];
  });
}

function rangeArch(out, w, left, right, low, spring, top, ledge, depth, level, theme) {
  const c = (left + right) / 2;
  const half = (right - left) / 2 - ledge;
  const apex = Math.min(top - 0.24, spring + Math.min(2.5, half * 0.91));
  const h = pointedHead(c, half, spring, apex - spring, [1, 2, 4, 6][level]);
  const mat = theme === 'outer' ? 'outer' : 'arcades';
  const main = theme === 'outer' ? colors.ashlar : colors.arcades;
  const coordinate = (pair, b = 0) => w.p(pair[0], pair[1], b);
  if (ledge > 0.012) {
    panel(out, mat, w, left, c - half, low, top, 0, main);
    panel(out, mat, w, c + half, right, low, top, 0, main);
    panel(out, mat, w, left, c - half, low, top, -depth, main);
    panel(out, mat, w, c + half, right, low, top, -depth, main);
  }
  for (const [a, b] of pairs(h)) {
    const front = [coordinate(a), coordinate(b), w.p(b[0], top), w.p(a[0], top)];
    const rear = [
      coordinate(a, -depth),
      coordinate(b, -depth),
      w.p(b[0], top, -depth),
      w.p(a[0], top, -depth),
    ];
    face(out, mat, front, w.normal, main);
    face(
      out,
      mat,
      rear,
      w.normal.map((n) => -n),
      main,
    );
    face(out, mat, [front[0], front[1], rear[1], rear[0]], [0, -1, 0], colors.ochre);
  }
  for (const [u, sign] of [
    [c - half, 1],
    [c + half, -1],
  ]) {
    const a = w.p(u, low),
      b = w.p(u, spring),
      p = w.p(u, spring, -depth),
      q = w.p(u, low, -depth);
    face(out, mat, [a, b, p, q], [w.normal[2] * sign, 0, -w.normal[0] * sign], colors.ochre);
  }
  if (level >= 2) {
    const offset = 0.055,
      band = 0.16;
    for (const [a, b] of pairs(h)) {
      face(
        out,
        'trim',
        [
          coordinate(a, offset),
          coordinate(b, offset),
          w.p(b[0], b[1] + band, offset),
          w.p(a[0], a[1] + band, offset),
        ],
        w.normal,
        colors.stoneTrim,
      );
    }
  }
}

function niche(out, w, center, base, spring, half, rise, level) {
  panel(out, 'dark', w, center - half, center + half, base, spring, 0.04, colors.inset);
  const shape = pointedHead(center, half, spring, rise, level === 3 ? 4 : 2);
  face(
    out,
    'dark',
    shape.map(([u, h]) => w.p(u, h, 0.042)),
    w.normal,
    colors.inset,
  );
  if (level >= 2) {
    for (const [a, b] of pairs(shape)) {
      beam(
        out,
        'trim',
        w.p(a[0], a[1], 0.068),
        w.p(b[0], b[1], 0.068),
        0.1,
        0.13,
        colors.stoneTrim,
      );
    }
  }
}

function courtAndRoof(out, level) {
  planarSurface(out, 'roof', d.outline, d.roofTop, colors.roof, d.court);
  planarSurface(out, 'paving', d.court, courtFloor, colors.marble);
  const sign = areaSign(d.court);
  for (const [[a, b], i] of pairs(closed(d.court)).map((p, i) => [p, i])) {
    const w = edge(a, b, -sign);
    if (i !== 2) {
      face(
        out,
        'paving',
        [
          w.p(0, courtFloor - 0.025),
          w.p(w.length, courtFloor - 0.025),
          w.p(w.length, courtFloor - 0.025, -5.2),
          w.p(0, courtFloor - 0.025, -5.2),
        ],
        [0, 1, 0],
        colors.marble,
      );
    }
    const bays = [11, 10, 11, 10][i];
    if (level === 0) {
      panel(out, 'arcades', w, 0, w.length, 7.42, d.roofTop, 0, colors.arcades);
      for (let j = 0; j < bays; j++) {
        const u = (w.length * j) / bays;
        panel(out, 'arcades', w, u, u + 1.23, courtFloor, 7.42, 0, colors.arcades);
      }
      continue;
    }
    for (let j = 0; j < bays; j++) {
      const l = (w.length * j) / bays,
        r = (w.length * (j + 1)) / bays;
      const base = level === 0 ? 0.0 : courtFloor - 0.12;
      rangeArch(out, w, l, r, base, 6.2, d.roofTop, 0.65, 0.95, level, 'court');
      if (level >= 1) {
        panel(
          out,
          'trim',
          w,
          l,
          l + 1.29,
          courtFloor,
          courtFloor + 0.33,
          0.12,
          colors.pavementShade,
        );
      }
    }
    panel(out, 'trim', w, 0, w.length, d.roofTop - 0.22, d.roofTop + 0.15, 0.12, colors.stoneTrim);
  }
  const rearRows = level === 0 ? 0 : level === 1 ? 1 : 3;
  for (let row = 0; row < rearRows; row++) {
    const z = -71.2 - row * 6.1;
    const w = plane(z, 1),
      count = 11;
    for (let j = 0; j < count; j++) {
      const l = -40 + j * 7.27,
        r = l + 7.27;
      rangeArch(out, w, l, r, courtFloor - 0.2, 6.05, d.roofTop, 0.57, 0.8, level, 'court');
    }
  }
  if (level >= 2) {
    for (const pos of [-30, -20, -10, 0, 10, 20, 30]) {
      face(
        out,
        'trim',
        [
          [pos, courtFloor + 0.012, -62],
          [pos + 0.024, courtFloor + 0.012, -62],
          [pos + 0.024, courtFloor + 0.012, 0],
          [pos, courtFloor + 0.012, 0],
        ],
        [0, 1, 0],
        colors.pavementShade,
      );
    }
  }
}

function enclosure(out, level) {
  const sign = areaSign(d.outline);
  for (const [[a, b], i] of pairs(closed(d.outline)).map((p, i) => [p, i])) {
    if (i === 5 || i === 6) continue;
    const w = edge(a, b, sign);
    const top = d.roofTop + (i === 3 || i === 8 ? 0.4 : 0.0);
    face(
      out,
      'outer',
      [
        [a[0], Math.min(0, ground(a) - 0.45), a[1]],
        [b[0], Math.min(0, ground(b) - 0.45), b[1]],
        w.p(w.length, top),
        w.p(0, top),
      ],
      w.normal,
      i === 3 || i === 8 ? colors.ashlar : colors.ochre,
    );
    if (level >= 1) {
      panel(out, 'trim', w, 0, w.length, top - 0.51, top - 0.24, 0.12, colors.stoneTrim);
      panel(out, 'outer', w, 0, w.length, top - 0.05, top + 0.21, 0.083, colors.ashlar);
    }
    if (level >= 2 && (i === 0 || i === 12 || i === 3 || i === 8)) {
      const openings = [4, 4, 3, 3][[0, 12, 3, 8].indexOf(i)];
      for (let j = 0; j < openings; j++) {
        const x = (w.length * (j + 1)) / (openings + 1);
        niche(out, w, x, 5.65, 6.65, 0.38, 0.52, level);
      }
    }
  }
  const left = d.outline[5],
    right = d.outline[7];
  const w = edge(left, right, -1);
  const top = d.frontTop;
  rangeArch(out, w, 0, w.length, 0.44, 6.1, top - 0.52, 3.86, 3.1, level, 'outer');
  panel(out, 'outer', w, 0, w.length, top - 0.52, top, 0.19, colors.stoneTrim);
  panel(out, 'trim', w, 0.49, w.length - 0.49, top - 1.16, top - 0.98, 0.16, colors.darkAshlar);
  for (const side of [2.24, w.length - 2.24]) {
    niche(out, w, side, 2.05, 5.65, 0.68, 1.1, level);
    if (level >= 2) {
      for (let k = 0; k < 6; k++) {
        panel(
          out,
          'trim',
          w,
          side - 0.92,
          side + 0.92,
          7.42 + k * 0.27,
          7.51 + k * 0.27,
          0.064,
          colors.ochre,
        );
      }
    }
  }
  const x = d.portal[0],
    z = d.portal[1];
  for (let j = 0; j < 3; j++) {
    block(
      out,
      'paving',
      x - 3.78,
      0.1 + j * 0.17,
      z - 0.5 - j * 0.51,
      7.56,
      0.18,
      1.91,
      colors.marble,
    );
  }
  const ramp = [
    [-4.67, 0.61, z - 1.5],
    [2.55, 0.61, z - 1.5],
    [2.55, courtFloor, 1.25],
    [-4.67, courtFloor, 1.25],
  ];
  face(out, 'paving', ramp, [0, 1, 0], colors.marble);
  block(
    out,
    'outer',
    left[0] + 0.02,
    d.roofTop - 0.08,
    14.67,
    right[0] - left[0] - 0.04,
    top - d.roofTop + 0.03,
    1.41,
    colors.ashlar,
  );
}

function tower(out, t, level) {
  const [x, z] = t.center;
  const [w, p] = t.size;
  const h = t.caseHeight;
  const base = Math.min(ground(t.center) - 0.65, -0.32);
  const course = (y, scale) => [
    [x - (w * scale) / 2, y, z - (p * scale) / 2],
    [x + (w * scale) / 2, y, z - (p * scale) / 2],
    [x + (w * scale) / 2, y, z + (p * scale) / 2],
    [x - (w * scale) / 2, y, z + (p * scale) / 2],
  ];
  loft(
    out,
    'outer',
    [
      course(base, 1),
      course(h - 1.42, 0.93),
      course(h - 1.19, 0.98),
      course(h - 0.79, 0.99),
      course(h, 0.95),
    ],
    colors.towerStone,
  );
  const width = t.round ? 2.73 : 2.29;
  const baseStage = t.round ? 4.4 : 4.1;
  const rings = level === 0 ? 8 : level === 1 ? 12 : level === 2 ? 32 : 48;
  const circ = (r, y, count = rings) => radialRing(y, r, r, count, [x, z], Math.PI / 8);
  const shaftSides = t.round ? 8 : 4;
  loft(
    out,
    'outer',
    [
      circ(width * 1.12, h - 0.06, shaftSides),
      circ(width, h + 0.47, shaftSides),
      circ(width * 0.88, h + baseStage, shaftSides),
    ],
    colors.towerStone,
  );
  loft(
    out,
    'trim',
    [
      circ(width * 0.88, h + baseStage),
      circ(width * 1.17, h + baseStage + 0.38),
      circ(width * 1.16, h + baseStage + 0.77),
      circ(width * 0.91, h + baseStage + 1.05),
    ],
    colors.stoneTrim,
  );
  const y0 = h + baseStage + 0.95;
  const cupolaProfile = [
    [y0, width * 0.85],
    [y0 + 0.68, width * 0.79],
    [t.upperHeight - 1.58, width * 0.72],
    [t.upperHeight - 0.64, width * 0.51],
    [t.upperHeight - 0.21, width * 0.23],
    [t.upperHeight - 0.11, 0.083],
  ];
  const cupola = cupolaProfile.map(([y, r], j) =>
    Array.from({ length: rings }, (_, i) => {
      const a = Math.PI / 8 + (i * 2 * Math.PI) / rings;
      const flute = level >= 2 && i % (level === 2 ? 4 : 6) === 1 && j < 5 ? 0.15 : 0;
      return [x + (r + flute) * Math.cos(a), y, z + (r + flute) * Math.sin(a)];
    }),
  );
  loft(out, 'roof', cupola, colors.towerStone);
  beam(
    out,
    'metal',
    [x, t.upperHeight - 0.38, z],
    [x, t.upperHeight + 0.25, z],
    0.081,
    0.08,
    colors.metal,
  );
  if (level >= 1) {
    const faces = closed(circ(width * 1.006, h, shaftSides).map(([px, , pz]) => [px, pz]));
    for (const [a, b] of pairs(faces)) {
      const w = edge(a, b, 1);
      niche(out, w, w.length / 2, h + 1.14, h + 2.29, 0.42, 0.61, level);
    }
    const corbels = level === 1 ? 8 : 16;
    for (let j = 0; j < corbels; j++) {
      const a = (j * 2 * Math.PI) / corbels;
      const u = x + Math.cos(a) * width * 1.02,
        v = z + Math.sin(a) * width * 1.02;
      block(
        out,
        'trim',
        u - 0.26,
        h + baseStage + 0.31,
        v - 0.26,
        0.52,
        0.56,
        0.52,
        colors.towerShade,
      );
    }
    if (level >= 2) {
      for (let k = 0; k < 4; k++) {
        const sideCourse = course(h, 0.96);
        const a = sideCourse[k],
          b = sideCourse[(k + 1) % 4];
        const e = edge([a[0], a[2]], [b[0], b[2]], 1);
        for (let j = 0; j < 9; j++) {
          const u = ((j + 0.5) * e.length) / 9;
          panel(out, 'trim', e, u - 0.22, u + 0.22, h - 0.95, h - 0.5, 0.09, colors.towerShade);
        }
      }
    }
  }
}

function interiorLandmarks(out, level) {
  const {
    center: [x, z],
    base,
    radius,
    height,
  } = d.prayerDome;
  block(
    out,
    'arcades',
    x - 7.17,
    d.roofTop - 0.07,
    z - 7.12,
    14.34,
    base - d.roofTop + 0.1,
    14.24,
    colors.rooftop,
  );
  for (const cx of [-46.3, 46.0]) {
    block(out, 'arcades', cx - 5.87, d.roofTop - 0.11, -98.8, 11.74, 1.52, 12.14, colors.rooftop);
  }
  const sides = [8, 18, 30, 44][level];
  const ring = (y, r) => radialRing(y, r, r, sides, [x, z], Math.PI / 8);
  loft(
    out,
    'roof',
    [
      ring(base, radius),
      ring(base + 1.49, radius),
      ring(base + 2.48, radius * 0.99),
      ring(base + 4.44, radius * 0.82),
      ring(base + 6.15, radius * 0.57),
      ring(base + 7.42, radius * 0.18),
      ring(base + height, 0.09),
    ],
    colors.dome,
  );
  const center = [-0.8, -32.24];
  const fountain = (y, r) => radialRing(y, r, r, 8, center, Math.PI / 8);
  const round = (y, r) => radialRing(y, r, r, level < 2 ? 12 : 24, center, Math.PI / 8);
  loft(
    out,
    'paving',
    [
      fountain(courtFloor - 0.035, 5.8),
      fountain(courtFloor + 0.43, 5.8),
      fountain(courtFloor + 0.64, 5.25),
    ],
    colors.marble,
  );
  loft(
    out,
    'trim',
    [
      round(courtFloor + 0.63, 4.67),
      round(courtFloor + 1.04, 4.7),
      round(courtFloor + 1.08, 4.42),
      round(courtFloor + 0.84, 4.18),
    ],
    colors.marble,
    { cap: false },
  );
  loft(out, 'water', [round(courtFloor + 0.64, 4.2), round(courtFloor + 0.86, 4.18)], colors.water);
  if (level >= 1) {
    loft(
      out,
      'trim',
      [
        round(courtFloor + 0.8, 0.58),
        round(courtFloor + 1.17, 0.57),
        round(courtFloor + 1.32, 0.88),
        round(courtFloor + 1.45, 0.36),
      ],
      colors.marble,
    );
  }
}
function build(out, level) {
  enclosure(out, level);
  courtAndRoof(out, level);
  for (const t of d.minarets) tower(out, t, level);
  interiorLandmarks(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'al-hakim-mosque-model.mjs';
const camera = [136, 70, 121],
  lookAt = [0, 6, -34];
const errors = { district: 0.51, street: 0.14, closeup: 0.06 };
export const alHakimMosqueAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original Cairo elevation at the portal and outside walls, with the floor raised inside the named open courtyard.',
  brief:
    'The standing Al-Hakim Mosque, with two distinct Mamluk minaret crowns above Fatimid cases, a projecting portal, white-marble open courtyard and qibla dome.',
  camera,
  lookAt,
  sunDirection: [105, 127, 110],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The named mosque enclosure and projecting bases on Al-Muizz Street.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'monumental-portal-and-flanking-minarets',
      position: [30, 19, 123],
      lookAt: [1, 10, 16],
    },
    { name: 'white-marble-open-court-and-arcades', position: [-29, 22, 7], lookAt: [3, 6, -44] },
    { name: 'fatimid-cases-and-mamluk-crowns', position: [-101, 39, 61], lookAt: [-34, 16, 13] },
    { name: 'qibla-dome-and-prayer-range', position: [30, 42, -116], lookAt: [-1, 9, -60] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'al-hakim-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
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
    'Original mesh under repository license. Geographic vector data © OpenStreetMap contributors, ODbL 1.0.',
};
