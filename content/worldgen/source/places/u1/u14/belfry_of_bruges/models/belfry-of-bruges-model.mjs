/** Belfort-Hal in Bruges. +Z faces Markt. Dimensions are in metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box,
  prism,
  profile,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92, metallic: 0 },
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0.07 },
};
const color = Object.fromEntries(
  Object.entries({
    brick: '865f51',
    towerBrick: '858174',
    pale: 'a9a391',
    mid: '949080',
    slate: '51575a',
    stone: 'aaa18a',
    darker: '7a756a',
    dark: '363938',
    gilding: 'c1a458',
    green: '647268',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function panel(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function window(out, x, z, base, width, height, lod, { pointed = true, framed = true } = {}) {
  const radius = width / 2,
    spring = base + height - radius * 1.2;
  if (!lod) {
    panel(out, 'accent', x - radius, x + radius, base, base + height, z + 0.03, color.dark);
    return;
  }
  const arc = (angle, inset, plane) => [
    x + (radius + inset) * Math.cos(angle),
    spring + Math.pow(Math.sin(angle), pointed ? 0.66 : 1) * (radius * 1.2 + inset),
    plane,
  ];
  const sill = 0.13;
  if (framed)
    panel(
      out,
      'trim',
      x - radius - sill,
      x + radius + sill,
      base - sill,
      spring,
      z + 0.02,
      color.mid,
    );
  panel(out, 'accent', x - radius, x + radius, base, spring, z + 0.055, color.dark);
  const steps = [0, 4, 7, 10][lod];
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    triangle(
      out,
      'accent',
      [[x, spring, z + 0.055], arc(a, 0, z + 0.055), arc(b, 0, z + 0.055)],
      color.dark,
    );
    if (framed)
      face(
        out,
        'trim',
        [
          arc(b, 0, z + 0.047),
          arc(a, 0, z + 0.047),
          arc(a, sill, z + 0.047),
          arc(b, sill, z + 0.047),
        ],
        color.pale,
      );
  }
  if (lod > 1) {
    panel(out, 'trim', x - 0.044, x + 0.044, base, spring + radius * 0.68, z + 0.074, color.pale);
    if (lod > 2)
      panel(
        out,
        'trim',
        x - radius,
        x + radius,
        base + height * 0.43,
        base + height * 0.43 + 0.048,
        z + 0.076,
        color.mid,
      );
  }
}

function floor(out, width, centerZ, y0, y1, slot, tint) {
  const r = width / 2;
  box(out, slot, [-r, y0, centerZ - r], [r, y1, centerZ + r], tint);
}

function eave(out, footprint, y, rise, crosswise) {
  const at = (p, h) => [p[0], h, p[1]];
  const [a, b, c, d] = footprint;
  const mid = (p, q) => p.map((n, k) => (n + q[k]) / 2);
  const r = crosswise ? mid(a, d) : mid(a, b),
    s = crosswise ? mid(b, c) : mid(d, c);
  const ra = at(r, y + rise),
    rb = at(s, y + rise);
  if (crosswise) {
    face(out, 'slate', [at(a, y), at(b, y), rb, ra], color.slate);
    face(out, 'slate', [at(c, y), at(d, y), ra, rb], color.slate);
    triangle(out, 'brick', [at(d, y), at(a, y), ra], color.brick);
    triangle(out, 'brick', [at(b, y), at(c, y), rb], color.brick);
  } else {
    face(out, 'slate', [at(b, y), at(c, y), rb, ra], color.slate);
    face(out, 'slate', [at(d, y), at(a, y), ra, rb], color.slate);
    triangle(out, 'brick', [at(a, y), at(b, y), ra], color.brick);
    triangle(out, 'brick', [at(c, y), at(d, y), rb], color.brick);
  }
}

function hall(out, lod) {
  const wings = [
    {
      points: [
        [-21.35, 0],
        [-7, 0],
        [-7, -17],
        [-20.35, -17],
      ],
      eaveY: 12.2,
      rise: 7.3,
      crosswise: true,
    },
    {
      points: [
        [7, 0],
        [21.24, 0],
        [22.1, -17],
        [7, -17],
      ],
      eaveY: 12.2,
      rise: 7.3,
      crosswise: true,
    },
    {
      points: [
        [-20.36, -16.95],
        [-6.52, -16.95],
        [-3.76, -67.1],
        [-17.1, -69.25],
      ],
      eaveY: 12.05,
      rise: 7.1,
      crosswise: false,
    },
    {
      points: [
        [9.61, -17.1],
        [22.11, -17.1],
        [24.3, -66.99],
        [11.25, -67.15],
      ],
      eaveY: 12.05,
      rise: 7.1,
      crosswise: false,
    },
    {
      points: [
        [-17.23, -65],
        [24.46, -65],
        [25.23, -84.9],
        [-16.68, -75.22],
      ],
      eaveY: 12.02,
      rise: 7.35,
      crosswise: true,
    },
  ];
  for (const { points, eaveY, rise, crosswise } of wings) {
    // The survey lengths run around the open court rather than across it.
    prism(out, 'brick', points.toReversed(), -0.8, eaveY, color.brick);
    eave(out, points, eaveY, rise, crosswise);
    if (lod)
      for (const [index, a] of points.entries()) {
        const b = points[(index + 1) % points.length];
        const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (width < 12) continue;
        const side = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [
          (a[0] + b[0]) / 2,
          0,
          (a[1] + b[1]) / 2,
        ]);
        const rows = Math.round(width / (lod === 1 ? 7.8 : 3.55));
        for (let i = 0; i < rows; i++) {
          const x = width * ((i + 0.5) / rows - 0.5);
          window(side, x, 0.025, 6.25, 1.55, 3.39, lod === 1 ? 0 : lod, { pointed: true });
          if (lod > 1) window(side, x, 0.026, 1.53, 1.1, 2.31, lod, { pointed: false });
        }
      }
  }
  for (const [left, right] of [
    [-21.5, -7.0],
    [7.02, 21.36],
  ]) {
    box(out, 'trim', [left, 11.16, -0.24], [right, 11.39, 0.3], color.pale);
    box(out, 'brick', [left, 11.38, -0.17], [right, 13.41, 0.18], color.brick);
    const merlons = lod ? 9 : 5;
    for (let i = 0; i < merlons; i++) {
      const x = left + ((right - left) * (i + 0.5)) / merlons;
      box(out, 'brick', [x - 0.35, 13.35, -0.2], [x + 0.35, 14.12, 0.19], color.brick);
      if (lod)
        window(out, x, 0.221, 11.77, 0.49, 1.24, Math.min(lod, 1), {
          pointed: false,
          framed: false,
        });
    }
  }
  for (const x of lod ? [-21.05, -7.42, 7.47, 21.0] : [-21.05, 21.0]) {
    profile(
      out,
      [
        [9.14, 0.7, 0.7],
        [13.08, 0.7, 0.7, 'brick', color.brick],
        [13.39, 0.84, 0.84, 'trim', color.mid],
        [15.58, 0.77, 0.77, 'brick', color.brick],
      ],
      lod ? 6 : 4,
      [x, -0.73],
    );
    if (lod)
      for (const side of [-1, 1])
        box(
          out,
          'brick',
          [x + side * 0.42 - 0.15, 15.55, -1.18],
          [x + side * 0.42 + 0.15, 16.27, -0.32],
          color.brick,
        );
  }
}

function pinnacle(out, x, z, y, top, lod) {
  const height = top - y;
  const sides = lod > 1 ? 6 : 4;
  const rings = (levels) =>
    levels.map(([elevation, radius]) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = (-i * Math.PI * 2) / sides;
        return [x + Math.cos(angle) * radius, elevation, z + Math.sin(angle) * radius];
      }),
    );
  const levels = lod
    ? [
        [y, 0.59],
        [y + height * 0.26, 0.59],
        [y + height * 0.42, 0.42],
        [top - 0.26, 0.11],
        [top, 0.058],
      ]
    : [
        [y, 0.54],
        [top, 0.045],
      ];
  loft(out, 'trim', rings(levels), color.mid);
  if (lod > 1) {
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      for (let i = 1; i < 4; i++) {
        const h0 = y + height * (0.37 + 0.13 * i);
        const r = 0.56 - 0.09 * i;
        beam(
          out,
          'trim',
          [x + dx * r, h0, z + dz * r],
          [x + dx * (r + 0.16), h0 + 0.29, z + dz * (r + 0.16)],
          0.055,
          0.06,
          color.pale,
        );
      }
    }
  }
}

function clock(out, x, y, z, r, lod, tint = color.gilding) {
  const n = lod === 0 ? 9 : lod === 1 ? 12 : 24;
  const point = (a, rr, depth) => [x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + depth];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    triangle(out, 'accent', [[x, y, z], point(b, r, 0), point(a, r, 0)], color.dark);
  }
  if (lod)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const p = point(a, r * 0.7, 0.032),
        q = point(a, r * 0.89, 0.032);
      if (lod > 1) beam(out, 'accent', p, q, 0.082, 0.076, tint);
      else
        triangle(
          out,
          'accent',
          [point(a - 0.052, r * 0.87, 0.023), p, point(a + 0.052, r * 0.87, 0.023)],
          tint,
        );
    }
  for (const [angle, length] of [
    [2.6, 0.74],
    [-0.78, 0.49],
  ]) {
    const [a, b] = [point(angle, length * r, 0.051), [x, y, z + 0.051]];
    if (lod) beam(out, 'accent', a, b, 0.095, 0.042, tint);
    else triangle(out, 'accent', [a, [b[0] - 0.11, b[1], b[2]], [b[0] + 0.11, b[1], b[2]]], tint);
  }
}

function squareTower(out, lod) {
  const facade = transform(out, 0, [0, 0, -7.07]);
  floor(facade, 14.15, 0, -0.82, 29.41, 'brick', color.towerBrick);
  floor(facade, 13.22, 0, 28.98, 50.63, 'brick', color.towerBrick);
  floor(facade, 14.7, 0, 24.7, 29.31, 'brick', color.brick);
  for (const [width, y, h] of [
    [14.26, 12.12, 0.22],
    [14.37, 18.59, 0.25],
    [14.48, 22.55, 0.29],
    [15.0, 25.13, 0.33],
    [15.01, 29.16, 0.42],
    [13.58, 34.9, 0.25],
    [13.65, 46.91, 0.27],
    [13.9, 49.61, 0.48],
  ]) {
    if (lod || y > 24) floor(facade, width, 0, y, y + h, 'trim', color.mid);
  }
  const front = 7.086;
  window(facade, 0, front, -0.02, 3.1, 5.47, lod);
  if (lod) {
    window(facade, 0, front, 9.78, 2.67, 4.38, lod);
    window(facade, 0, front, 19.19, 2.18, 3.16, lod, { pointed: false });
    box(facade, 'trim', [-1.73, 18.95, 7.0], [1.73, 19.28, 7.81], color.pale);
    for (const x of [-3.3, 3.3]) window(facade, x, front, 10.3, 1.76, 3.48, lod);
  }
  clock(facade, 0, 34.06, 6.67, 1.08, lod, color.green);

  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const side = transform(facade, angle);
    const lowerCount = lod > 1 ? 8 : lod === 1 ? 6 : 4;
    for (let i = 0; i < lowerCount; i++) {
      const x = -6.38 + (12.76 * (i + 0.5)) / lowerCount;
      window(side, x, 7.38, 25.62, 1.03, 2.94, Math.min(lod, 1), { pointed: false, framed: false });
      if (lod > 1) beam(side, 'brick', [x, 24.61, 7.1], [x, 25.54, 7.41], 0.23, 0.24, color.brick);
    }
    for (const x of lod ? [-2.56, -0.86, 0.86, 2.56] : [-1.65, 1.65])
      window(side, x, 6.64, 40.24, 1.16, 5.43, lod, { pointed: true });
    const topCount = lod ? 8 : 3;
    for (let i = 0; i < topCount; i++) {
      const x = -6.1 + (12.2 * (i + 0.5)) / topCount;
      window(side, x, 6.683, 48.24, 0.86, 1.74, Math.min(lod, 1), { pointed: true, framed: true });
    }
  }
  for (const x of [-6.54, 6.54])
    for (const z of [-6.54, 6.54]) {
      pinnacle(facade, x, z, 48.8, 60.8, lod);
      if (lod) {
        const dirX = Math.sign(x),
          dirZ = Math.sign(z);
        beam(
          facade,
          'stone',
          [x, 53.9, z],
          [dirX * 4.4, 55.12, dirZ * 4.4],
          0.55,
          0.47,
          color.stone,
        );
        if (lod > 1)
          beam(
            facade,
            'stone',
            [dirX * 4.4, 55.12, dirZ * 4.4],
            [dirX * 3.48, 56.91, dirZ * 3.48],
            0.46,
            0.42,
            color.stone,
          );
        pinnacle(facade, x * 1.084, z * 1.084, 25.1, 32.09, Math.min(lod, 1));
      }
    }
}

function lantern(out, lod) {
  const center = [0, -7.07],
    a0 = Math.PI / 8;
  const ring = (r) =>
    Array.from({ length: 8 }, (_, i) => [
      center[0] + r * Math.cos(a0 + (i * Math.PI) / 4),
      center[1] + r * Math.sin(a0 + (i * Math.PI) / 4),
    ]);
  const radius = 5.03,
    octagon = ring(radius);
  const band = (slot, r, low, high, tint) => {
    const outline = ring(r).toReversed();
    loft(
      out,
      slot,
      [low, high].map((y) => outline.map(([x, z]) => [x, y, z])),
      tint,
    );
  };
  band('stone', radius, 49.82, 80.43, color.stone);
  band('trim', 5.18, 50.39, 50.8, color.pale);
  if (lod) {
    band('trim', 5.18, 67.42, 67.6, color.mid);
    band('trim', 5.4, 79.04, 79.33, color.pale);
  }
  const crown = ring(5.39);
  band('trim', 5.39, 80.4, 80.76, color.pale);
  for (let i = 0; i < crown.length; i++) {
    const a = octagon[i],
      b = octagon[(i + 1) % octagon.length];
    const direction = -Math.atan2(a[1] - b[1], a[0] - b[0]);
    const [x, z] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const side = transform(out, direction, [x, 0, z]);
    window(side, 0, 0.037, 69.0, 2.3, 8.23, lod, { pointed: false });
    if (lod) {
      window(side, 0, 0.04, 52.5, 0.56, 2.92, lod);
      box(side, 'trim', [-1.39, 68.75, -0.085], [1.39, 68.96, 0.14], color.mid);
    }
    if (i % 2 === 0) clock(side, 0, 61.84, 0.067, 1.39, lod);

    const before = crown[i],
      after = crown[(i + 1) % crown.length];
    beam(
      out,
      'trim',
      [before[0], 81.65, before[1]],
      [after[0], 81.65, after[1]],
      0.21,
      0.24,
      color.pale,
    );
    if (lod) {
      const pointsPerSide = lod > 1 ? 5 : 2;
      for (let k = 1; k <= pointsPerSide; k++) {
        const u = k / (pointsPerSide + 1);
        const vx = before[0] + (after[0] - before[0]) * u,
          vz = before[1] + (after[1] - before[1]) * u;
        beam(out, 'trim', [vx, 80.72, vz], [vx, 81.61, vz], 0.13, 0.14, color.pale);
      }
    }
    pinnacle(out, before[0], before[1], 80.4, plan.dimensions.officialHeight, lod);
  }
}

function build(out, lod) {
  hall(out, lod);
  const h = frame.heading,
    c = Math.cos(h),
    s = Math.sin(h);
  const slope =
    plan.dimensions.officialSoutheastLean / (Math.SQRT2 * plan.dimensions.officialHeight);
  const tower = transform(out, 0, [0, 0, 0], [slope * (c - s), slope * (c + s)]);
  squareTower(tower, lod);
  lantern(tower, lod);
}

export const belfrySkyline = (out) => build(out, 0);
export const belfryDistrict = (out) => build(out, 1);
export const belfryStreet = (out) => build(out, 2);
export const belfryCloseup = (out) => build(out, 3);

const recipe = 'belfry-of-bruges-model.mjs';
const camera = [-51, 48, 99];
const lookAt = [0, 38, -27];
export const belfryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: belfryCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Belfry of Bruges and its market halls in 2005, with a corbelled brick gallery, paired Gothic openings, an octagonal sandstone lantern and openwork crown.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-27, 44, 41],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[1],
    minimumCoverage: 0.9,
    basis: 'Mapped outer perimeter of the Markt halls and connected market belfry.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_sandstone', 'stone_limestone', 'slate'],
  qaCameras: [
    { name: 'markt-front-and-square-stages', position: [-31, 17, 65], lookAt: [0, 25, -4] },
    { name: 'octagonal-bell-lantern-and-clocks', position: [-34, 67, 39], lookAt: [0, 64, -7] },
    { name: 'open-courtyard-and-hall-roofs', position: [39, 70, -103], lookAt: [0, 16, -37] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bruges-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'belfrySkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'belfryDistrict', 0.29],
        ['street', 'belfryStreet', 0.12],
        ['closeup', 'belfryCloseup', 0.056],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap reference data under ODbL. Julien Bertrand released the exact Qualla photo to the public domain.',
};
