import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  opening,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const map = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  foundation,
  nativeMeanRadius: radius,
  archRiseEstimate: archTop,
  corniceHeightEstimate: cornice,
  capHeightEstimate: summit,
  sailRadiusEstimate: reach,
} = plan.dimensions;
const style = {
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  cap: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  ribs: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.82 },
  sails: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
  turf: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.98 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.93 },
};
const limestone = rgb('a19a83');
const limestoneBright = rgb('b0a693');
const sandstone = rgb('9f9179');
const voussoirs = rgb('b4a489');
const baseStone = rgb('81786a');
const shade = rgb('6f695e');
const iron = rgb('475154');
const paleMetal = rgb('c1c6c4');
const wood = rgb('d5d9d4');
const grass = rgb('777f58');
const center = [0, 0];
const tau = 2 * Math.PI;

function ring(y, r, sides) {
  return radialRing(y, r, r, sides, center, 0);
}

function shell(out, slot, points, tone, sides, cap = false) {
  loft(
    out,
    slot,
    points.map(([y, r]) => ring(y, r, sides)),
    tone,
    { cap },
  );
}

function ringTop(out, slot, y, radius, inner, sides, color) {
  const outside = ring(y, radius, sides);
  const inside = ring(y, inner, sides);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    quad4(out, slot, outside[i], outside[j], inside[j], inside[i], color);
  }
}

function platform(out, lod) {
  const sides = [12, 24, 38, 55][lod];
  const outer = radius + 1.54;
  shell(
    out,
    'base',
    [
      [foundation, outer - 0.16],
      [0.16, outer],
      [0.36, outer],
    ],
    baseStone,
    sides,
  );
  shell(
    out,
    'turf',
    [
      [0.32, outer - 0.05],
      [0.4, outer - 0.05],
    ],
    grass,
    sides,
    true,
  );
  if (lod >= 2)
    for (const y of [0.025, 0.17]) {
      shell(
        out,
        'base',
        [
          [y, outer + 0.018],
          [y + 0.031, outer + 0.018],
        ],
        limestone,
        sides,
      );
    }
}

const polar = (angle, r, y) => [Math.sin(angle) * r, y, Math.cos(angle) * r];

function arcVolume(out, slot, first, last, inner, outer, bottom, top, color, ends = false) {
  const [y0, y1] = bottom;
  const [z0, z1] = top;
  const a = polar(first, outer, y0),
    b = polar(last, outer, y1);
  const c = polar(last, outer, z1),
    d = polar(first, outer, z0);
  const e = polar(first, inner, y0),
    f = polar(last, inner, y1);
  const g = polar(last, inner, z1),
    h = polar(first, inner, z0);
  quad4(out, slot, a, b, c, d, color);
  quad4(out, slot, f, e, h, g, color);
  quad4(out, slot, e, f, b, a, color);
  quad4(out, slot, d, c, g, h, color);
  if (ends) {
    quad4(out, slot, e, a, d, h, color);
    quad4(out, slot, b, f, g, c, color);
  }
}

function arcade(out, lod) {
  const spring = 3.8;
  const inner = radius - 0.91;
  const opening = 0.376;
  const rise = 1.88;
  const steps = [4, 10, 14, 20][lod];
  const course = archTop + 0.23;
  for (let i = 0; i < 6; i++) {
    const baseAngle = (i * tau) / 6;
    const start = baseAngle + opening;
    const end = baseAngle + tau / 6 - opening;
    arcVolume(
      out,
      'limestone',
      start,
      end,
      inner,
      radius,
      [0.39, 0.39],
      [course, course],
      limestone,
      true,
    );
    for (const [bottom, top, width] of [
      [0.43, 0.72, 0.13],
      [0.72, 0.99, 0.072],
      [3.56, 3.68, 0.061],
      [3.68, 3.83, 0.102],
    ]) {
      if (lod === 0 && bottom > 0.73) continue;
      arcVolume(
        out,
        'limestone',
        start - 0.025,
        end + 0.025,
        inner - width * 0.5,
        radius + width,
        [bottom, bottom],
        [top, top],
        limestoneBright,
        true,
      );
    }
    const arch = (f) => spring + rise * Math.sqrt(Math.max(0, 1 - f * f));
    for (let j = 0; j < steps; j++) {
      const u = -1 + (2 * j) / steps,
        v = -1 + (2 * (j + 1)) / steps;
      const a = baseAngle + opening * u,
        b = baseAngle + opening * v;
      const y = arch(u),
        z = arch(v);
      const accent = Math.min(0.32, course - Math.max(y, z) - 0.026);
      arcVolume(out, 'sandstone', a, b, inner, radius, [y, z], [course, course], sandstone);
      if (lod >= 1 && accent > 0.008) {
        const tone = j % 3 === 1 ? limestoneBright : voussoirs;
        arcVolume(
          out,
          'limestone',
          a + 0.0005,
          b - 0.0005,
          inner - 0.031,
          radius + 0.053,
          [y - 0.014, z - 0.014],
          [y + accent, z + accent],
          tone,
        );
      }
    }
  }
}

function windows(out, lod) {
  if (lod === 0) return;
  const r = radius - 0.035;
  for (const [angle, width, y, height, cross] of [
    [-0.455, 1.17, 7.02, 1.57, true],
    [0.455, 1.17, 7.02, 1.57, true],
    [Math.PI - 0.47, 0.57, 7.32, 1.15, false],
    [Math.PI + 0.47, 0.57, 7.32, 1.15, false],
  ]) {
    const f = facade(
      [Math.sin(angle) * (r + 0.04), Math.cos(angle) * (r + 0.04)],
      [Math.cos(angle), -Math.sin(angle)],
    );
    opening(out, f, 0, y, width, height, {
      glassSlot: 'dark',
      frameSlot: 'limestone',
      glass: shade,
      frame: limestoneBright,
      frameWidth: 0.16,
      frameDepth: 0.11,
      d: 0.05,
      mullions: cross ? 1 : 0,
      transoms: cross ? 1 : 0,
    });
    if (lod >= 2)
      fbox(
        out,
        'limestone',
        f,
        -width * 0.65,
        width * 0.65,
        y - 0.23,
        y - 0.09,
        0.02,
        0.19,
        limestoneBright,
      );
  }
}

const capProfile = [
  [cornice - 0.18, radius + 0.19],
  [cornice + 0.09, radius + 0.26],
  [cornice + 0.31, radius + 0.22],
  [cornice + 0.59, radius * 0.932],
  [cornice + 1.03, radius * 0.764],
  [cornice + 1.44, radius * 0.558],
  [cornice + 1.68, radius * 0.321],
  [summit - 0.48, 0.37],
  [summit - 0.37, 0.1],
];

function dressedTower(out, lod) {
  const sides = [9, 20, 33, 52][lod];
  const base = archTop + 0.18;
  shell(
    out,
    'sandstone',
    [
      [base, radius],
      [cornice - 0.43, radius - 0.045],
    ],
    sandstone,
    sides,
  );
  shell(
    out,
    'limestone',
    [
      [archTop - 0.015, radius + 0.013],
      [base, radius + 0.115],
      [base + 0.11, radius + 0.119],
      [base + 0.2, radius + 0.02],
    ],
    limestoneBright,
    sides,
  );
  shell(
    out,
    'limestone',
    [
      [cornice - 0.61, radius - 0.015],
      [cornice - 0.48, radius + 0.08],
      [cornice - 0.32, radius + 0.09],
      [cornice - 0.19, radius + 0.19],
      [cornice - 0.07, radius + 0.208],
    ],
    limestoneBright,
    sides,
  );
  if (lod >= 2) {
    shell(
      out,
      'sandstone',
      [
        [base - 0.015, radius - 0.91],
        [cornice - 0.56, radius - 0.92],
      ],
      shade,
      sides,
    );
    ringTop(out, 'limestone', base + 0.1, radius + 0.09, radius - 0.92, sides, limestone);
  }
  windows(out, lod);
  const rows = lod === 0 ? [0, 2, 4, 6, 8].map((i) => capProfile[i]) : capProfile;
  shell(out, 'cap', rows, paleMetal, sides, true);
  if (lod >= 1) {
    const count = [0, 10, 14, 18][lod];
    for (let i = 0; i < count; i++) {
      const angle = (i * tau) / count;
      beamPath(
        out,
        'ribs',
        capProfile.slice(2).map(([y, r]) => polar(angle, r + 0.044, y + 0.023)),
        lod === 3 ? 0.054 : 0.078,
        0.062,
        iron,
      );
    }
    shell(
      out,
      'cap',
      [
        [summit - 0.66, 0.225],
        [summit - 0.45, 0.225],
        [summit - 0.35, 0.142],
        [summit, 0.048],
      ],
      paleMetal,
      12,
      true,
    );
  } else {
    beam(out, 'ribs', [0, summit - 0.5, 0], [0, summit, 0], 0.087, 0.081, iron);
  }
  if (lod >= 2) {
    const f = facade([0, -3.52], [-1, 0]);
    fbox(out, 'cap', f, -1.03, 1.03, cornice + 0.23, cornice + 1.06, -0.91, 0.21, paleMetal);
    const edge = Array.from({ length: 9 }, (_, i) => {
      const a = (Math.PI * i) / 8;
      return f.P(1.05 * Math.cos(a), cornice + 1.06 + 0.34 * Math.sin(a), 0.24);
    });
    for (let i = 1; i < edge.length; i++) {
      const a = edge[i - 1],
        b = edge[i],
        c = [b[0], b[1] - 0.01, b[2] + 0.72],
        d = [a[0], a[1] - 0.01, a[2] + 0.72];
      quad4(out, 'cap', d, c, b, a, paleMetal);
    }
    for (const u of [-0.6, 0, 0.6])
      fbox(out, 'dark', f, u - 0.21, u + 0.21, cornice + 0.43, cornice + 0.94, 0.23, 0.26, shade);
  }
}

function sails(out, lod) {
  const axisY = cornice + 1.105;
  const hubZ = radius + 0.55;
  const sailAzimuth = 0.22;
  const rotor = (x, y, d) => [
    x * Math.cos(sailAzimuth) + d * Math.sin(sailAzimuth),
    y,
    -x * Math.sin(sailAzimuth) + d * Math.cos(sailAzimuth),
  ];
  beam(
    out,
    'ribs',
    rotor(0, axisY - 0.24, radius - 1.16),
    rotor(0, axisY, hubZ + 0.37),
    0.38,
    0.36,
    iron,
  );
  const outer = reach;
  const inner = 2.46;
  const width = 2.04;
  for (let i = 0; i < 4; i++) {
    const theta = (i * Math.PI) / 2 + 0.54;
    const c = Math.cos(theta),
      s = Math.sin(theta);
    const p = (r, t, d = 0) => rotor(r * c - t * s, axisY + r * s + t * c, hubZ + d - r * 0.031);
    beam(out, 'sails', p(0.16, 0), p(outer, 0), 0.257, 0.285, wood);
    beam(out, 'sails', p(inner, width * 0.85), p(outer, width), 0.071, 0.064, wood);
    const n = [1, 8, 13, 19][lod];
    for (let j = 0; j <= n; j++) {
      const f = j / n,
        r = inner + (outer - inner) * f;
      beam(out, 'sails', p(r, 0), p(r, width * (0.85 + 0.15 * f)), 0.05, 0.054, wood);
    }
    if (lod >= 1) {
      const grids = lod === 1 ? [0.52] : [0.33, 0.66];
      for (const f of grids)
        beam(
          out,
          'sails',
          p(inner, width * 0.85 * f, 0.029),
          p(outer, width * f, 0.029),
          0.055,
          0.052,
          wood,
        );
    }
    if (lod === 3) beam(out, 'ribs', p(0.19, 0, 0.153), p(0.93, 0, 0.152), 0.082, 0.043, iron);
  }
}

function build(out, lod) {
  platform(out, lod);
  arcade(out, lod);
  dressedTower(out, lod);
  sails(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'chesterton-windmill-model.mjs';
const camera = [22, 11, 32];
const lookAt = [0, 8.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces: style,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Chesterton’s stone tower windmill with an open six-arch arcade and four white lattice sails.',
  camera,
  lookAt,
  sunDirection: [38, 63, 64],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: map.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'The native circular mill footprint.',
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(style).flatMap(({ graph }) => graph ?? []))],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'stone-arcade-and-four-sails', position: [14, 8, 27], lookAt },
    { name: 'open-arches-and-limestone-piers', position: [-10, 3.4, 16], lookAt: [0, 4.5, 0] },
    { name: 'rear-dormer-and-ribbed-cap', position: [-15, 13, -20], lookAt: [0, 8.35, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'chesterton-windmill-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.42,
    surfaces: style,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.18, surfaces: style },
      street: { export: 'street', errorMeters: 0.063, surfaces: style },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces: style },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
