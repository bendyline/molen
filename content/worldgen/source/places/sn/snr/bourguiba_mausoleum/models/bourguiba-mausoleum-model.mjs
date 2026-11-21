import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  plane,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  marble: 'dad9cf',
  white: 'e2e1d8',
  base: 'bfbbb0',
  plaster: 'dfd3ba',
  cream: 'd2bfa2',
  interior: '6f5946',
  gold: 'a28b56',
  goldHighlight: 'c2a369',
  green: '547d6f',
  greenHighlight: '719389',
  black: '343a37',
  greenGlass: '5a7454',
  amberGlass: '815e4e',
  blueGlass: '4b5f72',
  greyGlass: '7d8279',
});
const surfaces = {
  marble: surface('wall', 'stone_marble', 0.92),
  paving: surface('foundation', 'stone_ashlar', 0.94),
  stucco: surface('wall', 'plaster_lime', 0.88),
  copper: surface('roof', 'metal_copper', 0.6, 0.32),
  iron: surface('trim', 'metal_painted', 0.71, 0.17),
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42 },
};
const stone = (out, ring, bottom, top, color = c.marble) =>
  shell(out, ring, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: 'marble',
    roof: 'marble',
    color,
    roofColor: color,
  });
const round = (out, slot, at, profile, n, color) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, at, Math.PI / n)),
    color,
  );
const walls = (ring) => pairs(closed(ring)).map(([a, b]) => edge(a, b, areaSign(ring)));
const ground = (p) => Math.min(grade(p) - 0.28, -0.22);
const floor = 0.84;
const circular = ([x, z], radius, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = Math.PI / n + (2 * Math.PI * i) / n;
    return [x + radius * Math.cos(a), z + radius * Math.sin(a)];
  });
function dome(out, point, radius, low, high, level, color, ribColor, major = false) {
  const n = (major ? [12, 20, 32, 48] : [8, 12, 20, 28])[level];
  const profile =
    level === 0
      ? [
          [0, 1],
          [0.67, 0.78],
          [1, 0.038],
        ]
      : [
          [0, 1],
          [0.27, 0.983],
          [0.57, 0.866],
          [0.79, 0.665],
          [0.94, 0.382],
          [1, 0.023],
        ];
  round(
    out,
    'copper',
    point,
    profile.map(([t, r]) => [mix(low, high, t), radius * r]),
    n,
    color,
  );
  if (level < 2) return;
  const ribs = (major ? [0, 0, 16, 28] : [0, 0, 10, 16])[level];
  for (let i = 0; i < ribs; i++) {
    const a = (2 * Math.PI * i) / ribs;
    const bead = (r, t, delta) => [
      point[0] + (radius * r + 0.049) * Math.cos(a + delta),
      mix(low, high, t) + 0.042,
      point[1] + (radius * r + 0.049) * Math.sin(a + delta),
    ];
    for (const [[y, r], [h, p]] of pairs(profile)) {
      face(
        out,
        'copper',
        [bead(r, y, -0.009), bead(r, y, 0.009), bead(p, h, 0.009), bead(p, h, -0.009)],
        [Math.cos(a), 0.45, Math.sin(a)],
        ribColor,
      );
    }
  }
}
function finial(out, p, y, tall, level) {
  const ht = (t) => y + t * tall;
  const radii = tall * 0.2;
  if (level === 0) {
    round(
      out,
      'copper',
      p,
      [
        [ht(0), radii * 0.55],
        [ht(1), radii * 0.021],
      ],
      4,
      c.goldHighlight,
    );
    return;
  }
  round(
    out,
    'copper',
    p,
    [
      [ht(0), radii * 0.58],
      [ht(0.34), radii * 0.82],
      [ht(0.55), radii * 0.46],
      [ht(0.9), radii * 0.3],
      [ht(1), radii * 0.028],
    ],
    [4, 6, 8, 10][level],
    c.goldHighlight,
  );
  if (level < 2) return;
  for (const t of [0.24, 0.47, 0.7]) {
    round(
      out,
      'copper',
      p,
      [
        [ht(t - 0.07), radii * 0.38],
        [ht(t), radii * 0.76],
        [ht(t + 0.07), radii * 0.25],
      ],
      8,
      c.goldHighlight,
    );
  }
}
function darkArch(out, w, u, y, spring, radius, rise, level, tone = c.interior) {
  arch(
    out,
    w,
    u,
    y,
    spring,
    radius,
    rise,
    0.04,
    level,
    { inner: tone, trim: c.cream, width: 0.12 },
    { inner: 'glazing', trim: 'stucco' },
  );
}

function chamber(out, level) {
  const p = d.mainDome;
  const outline = [
    [-6.85, -25.4],
    [6.6, -25.4],
    [6.6, -5.61],
    [5.4, -5.61],
    [5.4, 0.15],
    [-5.15, 0.15],
    [-5.15, -5.61],
    [-6.85, -5.61],
  ];
  const chamberRoof = 6.84;
  stone(out, outline, floor, chamberRoof);
  const shellRadius = 5.42;
  const glassHeight = 8.6;
  const eaves = [12, 16, 24, 32][level];
  if (level === 0) {
    round(
      out,
      'marble',
      p,
      [
        [chamberRoof - 0.07, shellRadius],
        [glassHeight + 0.44, shellRadius + 0.32],
      ],
      12,
      c.white,
    );
  } else {
    round(
      out,
      'marble',
      p,
      [
        [chamberRoof - 0.07, shellRadius + 0.24],
        [chamberRoof + 0.2, shellRadius + 0.24],
        [chamberRoof + 0.41, shellRadius],
        [glassHeight, shellRadius],
      ],
      eaves,
      c.white,
    );
    round(
      out,
      'marble',
      p,
      [
        [glassHeight - 0.1, shellRadius],
        [glassHeight + 0.15, shellRadius + 0.38],
        [glassHeight + 0.44, shellRadius + 0.38],
      ],
      eaves,
      c.marble,
    );
    const glass = [c.amberGlass, c.greyGlass, c.greenGlass, c.blueGlass, c.greyGlass];
    const drum = walls(circular(p, shellRadius, eaves));
    drum.forEach((w, i) => {
      const width = Math.min(0.34, w.length * 0.26);
      panel(
        out,
        'glazing',
        w,
        w.length / 2 - width,
        w.length / 2 + width,
        chamberRoof + 0.62,
        glassHeight - 0.22,
        0.029,
        glass[i % glass.length],
      );
    });
  }
  dome(out, p, shellRadius + 0.21, glassHeight + 0.44, 14.19, level, c.gold, c.goldHighlight, true);
  finial(out, p, 14.18, 1.83, level);
  const front = plane(0.157, 1);
  darkArch(out, front, 0.1, floor, 3.95, 1.94, 1.41, level, c.black);
  for (const dir of [-1, 1])
    darkArch(out, front, dir * 4.12, floor + 1.48, 3.25, 0.51, 0.48, level);
  if (level >= 1) panel(out, 'stucco', front, -5.12, 5.38, 5.62, 5.88, 0.092, c.cream);
}
function surroundings(out, level) {
  const bodyTop = 4.42;
  stone(out, d.outline, ground, bodyTop);
  const siteBounds = [-23.7, 23.24, -35.5, 20.55];
  block(
    out,
    'paving',
    siteBounds[0],
    -0.65,
    siteBounds[2],
    siteBounds[1] - siteBounds[0],
    floor + 0.58,
    siteBounds[3] - siteBounds[2],
    c.base,
  );
  for (const p of d.sideDomes) {
    const r = 3.55;
    const pad = rect(p[0] - 5.25, p[1] - 5.72, p[0] + 5.25, p[1] + 5.92);
    stone(out, pad, bodyTop - 0.05, 5.45, c.white);
    const sides = [8, 12, 18, 24][level];
    round(
      out,
      'marble',
      p,
      [
        [5.4, r + 0.38],
        [6.24, r + 0.38],
        [6.48, r + 0.21],
      ],
      sides,
      c.marble,
    );
    dome(out, p, r + 0.26, 6.43, 10.62, level, c.green, c.greenHighlight);
    finial(out, p, 10.55, 0.71, level);
  }
  const perimeter = d.outline;
  const frontWall = (a, b) => edge(perimeter[a], perimeter[b], areaSign(perimeter));
  const arcades = [
    { wall: frontWall(2, 3), count: 6 },
    { wall: frontWall(25, 26), count: 6 },
    { wall: frontWall(7, 8), count: 11 },
    { wall: frontWall(20, 21), count: 11 },
  ];
  for (const { wall: w, count } of arcades) {
    const bays = level === 0 ? Math.ceil(count / 2) : count;
    for (let i = 0; i < bays; i++) {
      const u = (w.length * (i + 0.5)) / bays;
      const width = Math.min(1.22, (w.length / bays) * 0.32);
      if (level === 0) {
        panel(out, 'glazing', w, u - width, u + width, floor, 3.2, 0.042, c.interior);
      } else {
        darkArch(out, w, u, floor, 2.75, width, 0.81, level - 1);
      }
      if (level >= 2)
        panel(out, 'marble', w, u - width - 0.205, u - width - 0.06, floor, 2.73, 0.084, c.white);
    }
    panel(out, 'copper', w, 0, w.length, 4.01, 4.32, 0.1, c.green);
  }
}
function tower(out, outline, level) {
  const points = areaSign(outline) > 0 ? [...outline].reverse() : outline;
  const p = [0, 1].map((axis) => points.reduce((sum, v) => sum + v[axis], 0) / points.length);
  const bottom = grade(p) - 0.26;
  const top = d.towerHeight + grade(p);
  const at = (y) => top - 25 + y;
  const setBack = (scale) => points.map(([x, z]) => [mix(p[0], x, scale), mix(p[1], z, scale)]);
  const scaleRise = (y, scale) => setBack(scale).map(([x, z]) => [x, at(y), z]);
  const section = (profile, color) =>
    loft(
      out,
      'marble',
      profile.map(([y, s]) => scaleRise(y, s)),
      color,
      { cap: false },
    );
  const pedestal = 5.2;
  stone(out, points, bottom, at(0.68), c.base);
  if (level === 0) {
    section(
      [
        [0.68, 1],
        [1.72, 0.63],
        [17.35, 0.62],
        [18.82, 1.06],
        [19.95, 1.03],
      ],
      c.marble,
    );
    section(
      [
        [18.82, 0.43],
        [21.72, 0.43],
        [22.2, 0.61],
      ],
      c.white,
    );
    dome(out, p, 1.18, at(22.21), at(24.21), level, c.gold, c.goldHighlight);
    finial(out, p, at(24.19), 0.81, level);
    return;
  }
  const shaft = setBack(0.64);
  section(
    [
      [0.68, 1],
      [1.18, 1],
      [1.62, 0.71],
      [1.83, 0.64],
      [pedestal, 0.64],
      [17.18, 0.62],
    ],
    c.marble,
  );
  section(
    [
      [17.03, 0.62],
      [17.44, 0.67],
      [17.74, 0.72],
      [18.27, 0.9],
      [18.54, 1.04],
      [18.85, 1.07],
      [19.04, 1.08],
    ],
    c.white,
  );
  const sill = at(19.04),
    rail = at(20.0);
  for (const w of walls(setBack(1.04))) {
    panel(out, 'marble', w, 0, w.length, sill - 0.06, sill + 0.15, 0.021, c.marble);
    panel(out, 'marble', w, 0, w.length, rail - 0.16, rail, 0.027, c.white);
    const n = [2, 3, 4, 5][level];
    for (let i = 0; i < n; i++) {
      const u = (w.length * (i + 0.5)) / n;
      panel(out, 'marble', w, u - 0.072, u + 0.072, sill + 0.1, rail - 0.12, 0.035, c.white);
      if (level >= 2)
        panel(out, 'marble', w, u - 0.112, u + 0.112, sill + 0.17, sill + 0.34, 0.042, c.marble);
    }
  }
  section(
    [
      [18.92, 0.43],
      [21.43, 0.43],
      [21.71, 0.65],
      [22.09, 0.65],
      [22.24, 0.5],
    ],
    c.white,
  );
  const crown = 1.18;
  dome(out, p, crown, at(22.23), at(24.21), level, c.gold, c.goldHighlight);
  finial(out, p, at(24.19), 0.81, level);
  walls(shaft).forEach((w, i) => {
    const u = w.length * 0.5;
    darkArch(out, w, u, at(4.03), at(15.25), 0.117, 0.44, Math.max(0, level - 1), c.black);
    if (level >= 2) darkArch(out, w, u, at(1.89), at(3.02), 0.24, 0.27, level, c.greyGlass);
    if (level >= 2 && i % 2 === 0) {
      panel(out, 'marble', w, 0.04, 0.13, at(4.5), at(16.7), 0.046, c.white);
      panel(out, 'marble', w, w.length - 0.13, w.length - 0.04, at(4.5), at(16.7), 0.046, c.white);
    }
  });
  for (const w of walls(setBack(0.435)))
    darkArch(
      out,
      w,
      w.length * 0.5,
      at(20.03),
      at(20.77),
      0.235,
      0.34,
      Math.max(0, level - 1),
      c.black,
    );
}

function screen(out, level) {
  const z = d.gateZ + 2.6;
  const w = plane(z, 1);
  const spans = [
    [-27.3, -9.42],
    [-4.2, 4.2],
    [9.6, 27.4],
  ];
  const postCount = [5, 10, 17, 24][level];
  const gateStart = grade([0, z]) + 0.49;
  for (const [a, b] of spans) {
    const center = a === -4.2;
    const high = gateStart + (center ? 3.19 : 2.64);
    for (const y of [gateStart + 0.14, high - 0.16]) {
      panel(out, 'iron', w, a, b, y, y + 0.105, 0.01, c.black);
    }
    for (let i = 0; i <= postCount; i++) {
      const x = mix(a, b, i / postCount);
      panel(out, 'iron', w, x - 0.043, x + 0.043, gateStart, high, 0.013, c.black);
      if (level >= 2 && i < postCount) {
        const next = mix(a, b, (i + 1) / postCount);
        const stroke = (x1, y1, x2, y2) =>
          beam(out, 'iron', [x1, y1, z + 0.02], [x2, y2, z + 0.02], 0.028, 0.029, c.black);
        stroke(x, gateStart + 0.47, next, high - 0.4);
        stroke(next, gateStart + 0.47, x, high - 0.4);
      }
    }
  }
  for (const x of [-2.03, 2.03]) {
    const ring = [6, 10, 16, 22][level];
    const rim = (i) => {
      const a = (2 * Math.PI * i) / ring;
      return [x + 0.69 * Math.cos(a), gateStart + 1.54 + 0.69 * Math.sin(a), z + 0.056];
    };
    for (let i = 0; i < ring; i++) {
      if (level < 2)
        face(
          out,
          'copper',
          [rim(i), rim(i + 1), [x, gateStart + 1.54, z + 0.056]],
          [0, 0, 1],
          c.goldHighlight,
        );
      else {
        beam(out, 'copper', rim(i), rim(i + 1), 0.06, 0.032, c.goldHighlight);
        const a = (2 * Math.PI * (i + 0.5)) / ring;
        const p = [
          x + 0.34 * Math.cos(a + 1.32),
          gateStart + 1.54 + 0.34 * Math.sin(a + 1.32),
          z + 0.062,
        ];
        beam(out, 'copper', rim(i), p, 0.05, 0.029, c.goldHighlight);
      }
    }
  }
  const stepCount = level === 0 ? 2 : 4;
  for (let i = 0; i < stepCount; i++) {
    const top = mix(gateStart - 0.64, gateStart - 0.02, (i + 1) / stepCount);
    const stepZ = z + 3.5 - (3.5 * (i + 1)) / stepCount;
    const x0 = -4.68 + i * 0.105;
    const bottom = Math.min(top - 0.18, grade([0, stepZ]) - 0.23);
    block(
      out,
      'paving',
      x0,
      bottom,
      stepZ,
      2 * Math.abs(x0),
      top - bottom,
      3.5 / stepCount,
      c.base,
    );
  }
}
function build(out, level) {
  surroundings(out, level);
  chamber(out, level);
  d.polygons.slice(1).forEach((p) => {
    tower(out, p, level);
  });
  screen(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'bourguiba-mausoleum-model.mjs';
const camera = [64, 34, 92],
  lookAt = [0, 7, -3];
const errors = { district: 0.65, street: 0.28, closeup: 0.08 };
export const bourguibaMausoleumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'monument',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original SRTM relief at the mapped public approach near the main gate.',
  brief:
    'The Bourguiba Mausoleum in Monastir, its ribbed gold dome and two green cupolas framed by white marble minarets and ornamental gate.',
  camera,
  lookAt,
  sunDirection: [-63, 105, 87],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis:
      'The mapped concave U perimeter and the two separate tower bases, preserving the court and adjacent streets.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'paired-minarets-and-gold-dome', position: [0, 7, 81], lookAt: [0, 12, 1] },
    { name: 'court-arcades-and-side-cupolas', position: [41, 21, 46], lookAt: [2, 7, -9] },
    { name: 'front-filigree-and-stairs', position: [-4, 3.5, 37], lookAt: [0, 2.6, 24] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bourguiba-mausoleum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.24,
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
    'Original mesh under repository license. © OpenStreetMap contributors. NASA/NGA SRTM public-domain elevation.',
};
