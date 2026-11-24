import { readFileSync } from 'node:fs';
import {
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const geometry = read('native-map/citadel-of-tripoli-shape-controls');
const colors = {
  limestone: rgb('aa9980'),
  warm: rgb('a38f73'),
  ashlar: rgb('beae91'),
  crown: rgb('b1a28a'),
  foot: rgb('998b74'),
  mortar: rgb('867964'),
  shadow: rgb('564e41'),
  paving: rgb('a19783'),
  plaster: rgb('c6bda8'),
  timber: rgb('544439'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  frame: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  court: { slot: 'roof', graph: 'earth_rammed', roughness: 0.99 },
  museum: { slot: 'window', graph: 'plaster_lime', roughness: 0.94 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.92 },
};

const ring = geometry.curtainOutline;
const grades = geometry.wallNativeGrades;
// Continuous parapet and individual taller returns follow the successive bays of the surveyed outline.
const crest = [
  13.1, 13.0, 13.5, 13.3, 14.7, 16.6, 16.6, 15.0, 14.6, 17.0, 17.3, 17.3, 13.1, 13.1, 13.1, 12.0,
  12.0, 16.5, 16.5, 15.0, 14.9, 12.1, 15.0, 15.1, 12.2, 13.1, 15.8, 18.0, 18.1, 15.6, 14.3, 16.8,
  16.2, 14.9, 15.0, 18.5, 18.2, 16.9, 16.9,
];
const tint = (color, seed) => {
  const value = 0.942 + 0.013 * ((((seed * 47 + 11) % 9) + 9) % 9);
  return color.map((channel) => channel * value);
};
const lerp = (a, b, w) => a + (b - a) * w;

const inset = ring.map((v, i) => {
  const before = wallFace(ring[(i + ring.length - 1) % ring.length], v).normal;
  const after = wallFace(v, ring[(i + 1) % ring.length]).normal;
  const sum = [before[0] + after[0], before[1] + after[1]];
  const magnitude = Math.hypot(...sum) || 1;
  const n = sum.map((u) => u / magnitude);
  const miter = Math.min(3.7, 2.05 / Math.max(0.51, n[0] * after[0] + n[1] * after[1]));
  return [v[0] - n[0] * miter, v[1] - n[1] * miter];
});

function archWall(out, F, width, bottom, spring, rise, top, depth, level) {
  const half = width * 0.5;
  const passageWidth = half - (level ? 0.68 : 0.52);
  const d = 0.08;
  const color = colors.limestone;
  fbox(out, 'wall', F, -half, -passageWidth, bottom - 1.2, top, -depth, 0, color, {
    bottom: false,
  });
  fbox(out, 'wall', F, passageWidth, half, bottom - 1.2, top, -depth, 0, color, { bottom: false });
  fbox(
    out,
    'footing',
    F,
    -passageWidth,
    passageWidth,
    bottom - 0.26,
    bottom + 0.015,
    -depth,
    0.12,
    colors.paving,
  );
  const n = level >= 2 ? 8 : level ? 4 : 3;
  const arch = pointedArch(passageWidth, rise, n);
  const lip = (point, offset, distance) =>
    F.P(point[0] * (1 + offset / passageWidth), spring + point[1] * (1 + offset / rise), distance);
  for (let i = 0; i + 1 < arch.length; i++) {
    const a = arch[i],
      b = arch[i + 1];
    const aFront = lip(a, 0, 0),
      bFront = lip(b, 0, 0);
    const aBack = lip(a, 0, -depth),
      bBack = lip(b, 0, -depth);
    quad4(out, 'wall', aFront, bFront, F.P(b[0], top, 0), F.P(a[0], top, 0), color);
    quad4(out, 'wall', bBack, aBack, F.P(a[0], top, -depth), F.P(b[0], top, -depth), colors.mortar);
    quad4(out, 'frame', bFront, aFront, aBack, bBack, tint(colors.mortar, i));
    if (level) {
      quad4(
        out,
        'frame',
        lip(a, 0, d),
        lip(b, 0, d),
        lip(b, 0.32, d + 0.018),
        lip(a, 0.32, d + 0.018),
        tint(colors.ashlar, i),
      );
    }
  }
  const end = Math.min(depth, 3.9);
  quad4(
    out,
    'frame',
    F.P(-passageWidth, top, -end),
    F.P(-passageWidth, top, 0),
    F.P(passageWidth, top, 0),
    F.P(passageWidth, top, -end),
    colors.crown,
  );
  if (!level) return;
  for (const x of [-passageWidth, passageWidth])
    fbox(out, 'frame', F, x - 0.2, x + 0.2, bottom, spring + 0.015, 0, 0.09, colors.ashlar);
}

function curtain(out, level) {
  const at = ([x, z], y) => [x, y, z];
  for (let i = 0; i < ring.length; i++) {
    if (i === 13) continue;
    const j = i === 12 ? 14 : (i + 1) % ring.length;
    const a = ring[i],
      b = ring[j];
    const F = wallFace(a, b);
    if (i === 12) {
      const p = geometry.gates[1].point;
      archWall(out, facade(p, F.along), F.length + 0.09, 0.065, 3.06, 2.3, crest[i], 3.9, level);
      continue;
    }
    const innerA = inset[i],
      innerB = inset[j];
    const lowerA = grades[i] - 1.8,
      lowerB = grades[j] - 1.8;
    const innerBaseA = Math.min(crest[i] - 1.2, Math.max(5.8, grades[i] + 4.3));
    const innerBaseB = Math.min(crest[j] - 1.2, Math.max(5.8, grades[j] + 4.3));
    const highA = crest[i],
      highB = crest[j];
    const shade = tint(i % 3 ? colors.limestone : colors.warm, i);
    quad4(out, 'wall', at(a, lowerA), at(b, lowerB), at(b, highB), at(a, highA), shade);
    quad4(
      out,
      'wall',
      at(innerB, innerBaseB),
      at(innerA, innerBaseA),
      at(innerA, highA),
      at(innerB, highB),
      tint(colors.warm, i + 3),
    );
    tri(out, 'frame', at(a, highA), at(b, highB), at(innerB, highB), tint(colors.crown, i));
    tri(out, 'frame', at(a, highA), at(innerB, highB), at(innerA, highA), tint(colors.crown, i));
    if (!level) continue;
    if (F.length >= 5) {
      const plinthA = (highA - lowerA) * 0.21 + lowerA;
      const plinthB = (highB - lowerB) * 0.21 + lowerB;
      const v = (u, y, d) => F.P(u, y, d);
      quad4(
        out,
        'footing',
        v(0, lowerA, 0.25),
        v(F.length, lowerB, 0.25),
        v(F.length, plinthB, 0.055),
        v(0, plinthA, 0.055),
        tint(colors.foot, i + 2),
      );
      tri(
        out,
        'frame',
        v(0, plinthA, 0.055),
        v(F.length, plinthB, 0.055),
        v(F.length, plinthB + 0.135, 0),
        colors.warm,
      );
      tri(
        out,
        'frame',
        v(0, plinthA, 0.055),
        v(F.length, plinthB + 0.135, 0),
        v(0, plinthA + 0.135, 0),
        colors.warm,
      );
    }
    if (level >= 2 && F.length >= 5.9) {
      const count = Math.floor(F.length / 5.65);
      for (let bay = 0; bay < count; bay++) {
        const u = F.length * ((bay + 0.53) / count);
        const base = lerp(highA, highB, u / F.length) - (i % 3 ? 3.62 : 4.15);
        if (i === 0 || i === 1 || i === 3 || i === 4 || i === 25 || i === 26 || i >= 33) {
          fbox(out, 'wall', F, u - 0.22, u + 0.22, base, base + 0.98, 0.01, 0.025, colors.shadow);
          fbox(
            out,
            'frame',
            F,
            u - 0.37,
            u + 0.37,
            base - 0.125,
            base - 0.015,
            0,
            0.14,
            colors.ashlar,
          );
        }
        if (level >= 3)
          fbox(
            out,
            'wall',
            F,
            u - 0.44,
            u + 0.37,
            base - 3.27,
            base - 3.05,
            0,
            0.045,
            tint(colors.ashlar, bay * 17 + i),
          );
      }
    }
  }
}

function entrance(out, level) {
  const outer = geometry.gates[0];
  const [x, z] = outer.point;
  const a = facade([x, z], [0.972, -0.24]);
  const foundation = outer.ground + 0.05;
  archWall(out, a, 7.1, foundation, foundation + 2.81, 2.36, foundation + 7.7, 2.8, level);
  const shoulders = [
    [-6.9, -3.53],
    [3.53, 7.7],
  ];
  for (const [i, [lo, hi]] of shoulders.entries()) {
    fbox(
      out,
      'wall',
      a,
      lo,
      hi,
      foundation - 1.4,
      foundation + 4.8 - i * 0.7,
      -2.4,
      0,
      colors.warm,
    );
    fbox(
      out,
      'frame',
      a,
      lo,
      hi,
      foundation + 4.76 - i * 0.7,
      foundation + 5.01 - i * 0.7,
      -2.53,
      0.12,
      colors.crown,
    );
  }
  const inner = wallFace(ring[12], ring[14]);
  const F = facade(geometry.gates[1].point, inner.along);
  fbox(out, 'frame', F, -1.1, 1.1, 6.83, 7.36, 0, 0.18, colors.ashlar);
  if (level) {
    const stairs = [4, 7, 10, 12][level];
    const landing = geometry.visitorPassage[4];
    const landingHeight = geometry.visitorPassageGrades[4];
    for (let i = 0; i < stairs; i++) {
      const travel = 0.27 + (0.73 * (i + 1)) / stairs;
      const y = lerp(foundation, landingHeight, travel) + 0.14;
      const step = facade(
        [lerp(x, landing[0], travel), lerp(z, landing[1], travel)],
        [0.99, 0.013],
      );
      const halfDepth = (5.4 * 0.77) / stairs;
      fbox(
        out,
        'footing',
        step,
        -1.34,
        1.34,
        y - 0.48,
        y,
        -halfDepth,
        halfDepth + 0.06,
        tint(colors.paving, i),
      );
    }
  }
}

function masonryWing(out, ring, pad, rise, level, material = 'wall') {
  const oriented = outwardRing(ring);
  const top = pad + rise;
  fan(
    out,
    'frame',
    oriented.map(([x, z]) => [x, top, z]),
    colors.crown,
  );
  for (let i = 0; i < oriented.length; i++) {
    const F = wallFace(oriented[i], oriented[(i + 1) % oriented.length]);
    fbox(
      out,
      material,
      F,
      0,
      F.length,
      pad - 1.6,
      top,
      -0.66,
      0,
      material === 'museum' ? colors.plaster : colors.limestone,
    );
    if (!level) continue;
    fbox(out, 'frame', F, 0, F.length, top - 0.17, top + 0.24, -0.75, 0.14, colors.crown);
    if (F.length < 7.4) continue;
    const count = Math.min(6, Math.max(1, Math.round(F.length / 6.15)));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * F.length) / count;
      opening(out, F, u, pad + 0.06, 1.85, Math.min(3.8, rise - 1.1), {
        head: 'pointed',
        rise: 0.84,
        glassSlot: 'wall',
        frameSlot: 'frame',
        glass: colors.shadow,
        frame: colors.ashlar,
        frameWidth: level >= 2 ? 0.17 : 0,
        frameDepth: 0.13,
        sill: false,
      });
    }
  }
}

function terraceWalls(out, level) {
  const lanes = [
    {
      edge: [
        [-26.4, -62.2],
        [-23.1, 22.1],
      ],
      height: 9.5,
      pad: 5.2,
    },
    {
      edge: [
        [22.6, 38],
        [17.4, -6],
      ],
      height: 9.8,
      pad: 5.85,
    },
    {
      edge: [
        [15.3, -50.8],
        [-12.5, -55.6],
      ],
      height: 12.65,
      pad: 6.25,
    },
    {
      edge: [
        [-17.3, 45.2],
        [-7.3, 35.1],
      ],
      height: 9.25,
      pad: 4.35,
    },
  ];
  for (const { edge, height, pad } of lanes) {
    const F = wallFace(...edge);
    fbox(out, 'wall', F, 0, F.length, pad - 2, height, -1.25, 0, colors.warm);
    if (!level) continue;
    fbox(out, 'frame', F, 0, F.length, height - 0.035, height + 0.235, -1.33, 0.15, colors.crown);
    if (level >= 2) {
      for (let u = 4.7; u < F.length - 2; u += 7.8)
        opening(out, F, u, pad, 1.45, 2.2, {
          head: 'round',
          glassSlot: 'wall',
          frameSlot: 'frame',
          glass: colors.shadow,
          frame: colors.ashlar,
          sill: false,
          frameWidth: 0.12,
          frameDepth: 0.11,
        });
    }
  }
  masonryWing(out, geometry.museumWing, 7.1, 6.9, level, 'museum');
  masonryWing(
    out,
    [
      [-23.8, -61.5],
      [-10.2, -61],
      [-10.5, -52.2],
      [-23.3, -51.4],
    ],
    7.0,
    4.8,
    level,
  );
  masonryWing(
    out,
    [
      [15.1, -55.8],
      [20.4, -54.7],
      [19.9, -45.9],
      [14.2, -47.3],
    ],
    8.1,
    4.25,
    level,
  );
}

function build(out, level) {
  curtain(out, level);
  entrance(out, level);
  terraceWalls(out, level);
  if (level) {
    const scuff = facade([-15.8, -20.8], [-0.06, 0.998]);
    fbox(out, 'court', scuff, -19.8, 21.6, 7.22, 7.275, -1.4, 1.3, colors.paving);
    const door = facade([3.25, -27.4], [0.056, -0.998]);
    fbox(out, 'door', door, -0.75, 0.75, 7.11, 9.1, 0, 0.075, colors.timber);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'citadel-of-tripoli-model.mjs';
const camera = [-122, 83, 116];
const lookAt = [0, 7, -7];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-fortress',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The Citadel of Tripoli on its river ridge, with stepped limestone curtain walls, projecting towers, pointed portals and the courtyard museum wing.',
  camera,
  lookAt,
  sunDirection: [-49, 73, 53],
  mediumFiContext: {
    scale: 1.13,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.89,
    basis:
      'The mapped named castle outline and the included museum wing define the area occupied by the model.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'two-pointed-entrance-portals', position: [-2.6, 3.15, 82], lookAt: [-3.6, 2.65, 58] },
    { name: 'inner-gate-and-ashlar-arch', position: [-13, 3.0, 55.2], lookAt: [-1.5, 2.55, 55.3] },
    { name: 'river-curtain-and-bastions', position: [-105, 44, -72], lookAt: [-19, 9, -18] },
    { name: 'interior-terraces-and-museum', position: [24, 60, -26], lookAt: [-6, 8, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'citadel-of-tripoli-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.78,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.032, surfaces },
    },
  },
};
