import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const profile = read('native-map/fort-dundas-shape-controls');
const palette = {
  timber: rgb('725d42'),
  bark: rgb('5f5141'),
  end: rgb('947956'),
  wall: rgb('9a8060'),
  upperWall: rgb('b69d77'),
  reeds: rgb('9a8355'),
  edgeReed: rgb('8e7548'),
  dark: rgb('514734'),
  earth: rgb('9c7e59'),
  bank: rgb('9a7653'),
  bed: rgb('7a6147'),
  soil: rgb('a48c65'),
};
const surfaces = {
  log: { slot: 'wall', graph: 'wood_vertical', roughness: 0.95 },
  boards: { slot: 'trim', graph: 'wood_board_batten', roughness: 0.93 },
  edges: { slot: 'door', graph: 'wood_plain', roughness: 0.95 },
  reed: { slot: 'roof', graph: 'thatch', roughness: 0.97 },
  earth: { slot: 'foundation', graph: 'gravel', roughness: 0.99 },
};
const ring = profile.palisade;
const lerp = (a, b, t) => a + (b - a) * t;
const at = ([x, z], y) => [x, y, z];
function tint(color, seed) {
  const strength = 0.91 + 0.02 * ((((seed * 29 + 17) % 11) + 11) % 11);
  return color.map((channel) => channel * strength);
}

function siteGrade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const top = terrain.heightsMeters[j];
  const bottom = terrain.heightsMeters[j + 1];
  return (
    lerp(lerp(top[i], top[i + 1], u - i), lerp(bottom[i], bottom[i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function earthwork(out, level) {
  const scaled = (point, distance) => {
    const length = Math.hypot(...point);
    return point.map((v) => v * (1 + distance / length));
  };
  const way = (point) => {
    const [x, z] = point;
    const s = Math.min(44 / Math.abs(x), 32 / Math.abs(z));
    return [s * x, s * z];
  };
  const depth = profile.ditch.depthOriginalM;
  const width = profile.ditch.widthOriginalM;
  const shelves = ring.map((point, i) => {
    const inner = scaled(point, 0.85);
    const foot = scaled(point, 1.55);
    const farFoot = scaled(point, width - 0.25);
    const lip = scaled(point, width + 0.95);
    const rim = way(point);
    const grade = profile.postGround[i];
    const dr = Math.abs(point[0]) === 38 && Math.abs(point[1]) > 26.8;
    const outer = dr ? [Math.sign(point[0]) * 44, Math.sign(point[1]) * 32] : rim;
    return [
      at(point, grade - 0.02),
      at(inner, grade - 0.14),
      at(foot, Math.min(grade, siteGrade(foot)) - depth),
      at(farFoot, Math.min(grade, siteGrade(farFoot)) - depth + 0.02),
      at(lip, siteGrade(lip)),
      at(outer, siteGrade(outer) + 0.055),
    ];
  });
  const bands = [palette.soil, palette.bank, palette.bed, palette.bank, palette.soil];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = shelves[i],
      b = shelves[j];
    tri(out, 'earth', [0, 0.045, 0], a[0], b[0], tint(palette.soil, i));
    for (let band = 0; band < bands.length; band++) {
      const color = tint(bands[band], i + band);
      tri(out, 'earth', a[band], a[band + 1], b[band + 1], color);
      tri(out, 'earth', a[band], b[band + 1], b[band], color);
    }
  }
  const pass = facade([0, 25.3], [1, 0]);
  const rise = profile.postGround[7] * 0.5 + profile.postGround[8] * 0.5;
  fbox(out, 'edges', pass, -1.64, 1.64, rise - 0.15, rise + 0.13, -2.7, 3.2, palette.timber);
  if (level >= 2)
    for (let i = 0; i < 12; i++) {
      const v = -2.52 + 0.49 * i;
      fbox(
        out,
        'boards',
        pass,
        -1.66,
        1.66,
        rise + 0.129,
        rise + 0.19,
        v,
        v + 0.465,
        tint(palette.end, i),
      );
    }
}

function upright(out, center, bottom, height, radius, n, color) {
  lathe(
    out,
    'log',
    center,
    [
      [bottom, radius, radius],
      [height - 0.2, radius, radius],
    ],
    n,
    color,
  );
  lathe(
    out,
    'edges',
    center,
    [
      [height - 0.2, radius, radius],
      [height, radius * 0.54, radius * 0.54],
    ],
    n,
    tint(palette.end, n),
    { capTop: true },
  );
}

function palisade(out, level) {
  const logSpacing = [6.7, 2.35, 0.82, 0.42][level];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const F = wallFace(ring[i], ring[j]);
    const ranges =
      i === 7
        ? [
            [0, F.length * 0.5 - 1.77],
            [F.length * 0.5 + 1.77, F.length],
          ]
        : [[0, F.length]];
    const gradeAt = (u) => lerp(profile.postGround[i], profile.postGround[j], u / F.length);
    for (const [start, end] of ranges) {
      const baseA = gradeAt(start),
        baseB = gradeAt(end);
      const rise = i % 5 ? 2.29 : 2.5;
      const a = F.P(start, baseA - 0.29, 0.025),
        b = F.P(end, baseB - 0.29, 0.025);
      const c = F.P(end, baseB + rise, 0.025),
        d = F.P(start, baseA + rise, 0.025);
      const ai = F.P(start, baseA - 0.29, -0.19),
        bi = F.P(end, baseB - 0.29, -0.19);
      const ci = F.P(end, baseB + rise, -0.19),
        di = F.P(start, baseA + rise, -0.19);
      quad4(out, 'log', a, b, c, d, tint(palette.bark, i));
      quad4(out, 'log', bi, ai, di, ci, tint(palette.timber, i + 4));
      quad4(out, 'edges', d, c, ci, di, palette.end);
      if (level === 0) continue;
      const n = Math.max(1, Math.round((end - start) / logSpacing));
      for (let k = 0; k < n; k++) {
        const u = lerp(start, end, (k + 0.5) / n);
        const p = F.P(u, 0, 0.07);
        const base = gradeAt(u);
        const cap = base + rise + 0.115 + ((i * 11 + k * 17) % 7) * 0.047;
        const r = level >= 3 ? 0.2 + ((k + i) % 4) * 0.015 : 0.23;
        upright(
          out,
          [p[0], p[2]],
          base - 0.3,
          cap,
          r,
          level >= 3 ? 6 : 4,
          tint(palette.timber, i * 3 + k * 7),
        );
      }
    }
  }
  const front = facade([0, 22.89], [1, 0]);
  const grade = (profile.postGround[7] + profile.postGround[8]) / 2;
  fbox(out, 'edges', front, -2.22, 2.22, grade + 2.51, grade + 2.87, -0.45, 0.42, palette.end);
  for (const side of [-1, 1]) {
    const p = front.P(1.94 * side, 0, 0.025);
    upright(out, [p[0], p[2]], grade - 0.52, grade + 3.1, 0.29, level >= 2 ? 8 : 5, palette.timber);
    fbox(
      out,
      'boards',
      front,
      Math.min(side * 1.52, 0),
      Math.max(side * 1.52, 0),
      grade - 0.03,
      grade + 2.26,
      -0.148,
      0.035,
      tint(palette.bark, side),
    );
    if (level)
      for (const y of [grade + 0.28, grade + 1.85])
        fbox(
          out,
          'edges',
          front,
          Math.min(side * 1.52, 0),
          Math.max(side * 1.52, 0),
          y,
          y + 0.145,
          0.035,
          0.14,
          palette.timber,
        );
  }
}

function roof(out, center, pad, h, level, hip) {
  const [x, z] = center;
  const half = h.width * 0.5 + 0.37;
  const depth = h.depth * 0.5 + 0.39;
  const eave = pad + h.eaves;
  const ridge = pad + h.ridge;
  const r = hip ? half - depth : half;
  const a = [x - half, eave, z + depth],
    b = [x + half, eave, z + depth];
  const c = [x + half, eave, z - depth],
    d = [x - half, eave, z - depth];
  const highA = [x - r, ridge, z],
    highB = [x + r, ridge, z];
  quad4(out, 'reed', a, b, highB, highA, palette.reeds);
  quad4(out, 'reed', c, d, highA, highB, palette.edgeReed);
  tri(out, hip ? 'reed' : 'boards', b, c, highB, palette.edgeReed);
  tri(out, hip ? 'reed' : 'boards', d, a, highA, palette.reeds);
  if (!level) return;
  for (const side of [-1, 1]) {
    const F = facade([x, z + side * depth], [side, 0]);
    fbox(out, 'reed', F, -half, half, eave - 0.17, eave + 0.025, -0.14, 0.06, palette.edgeReed);
  }
  abox(
    out,
    'reed',
    [x - r - 0.14, ridge - 0.09, z - 0.13],
    [x + r + 0.14, ridge + 0.17, z + 0.13],
    palette.edgeReed,
    { bottom: false },
  );
  if (level >= 2) {
    for (const side of [-1, 1])
      for (let j = 1; j < 5; j++) {
        const t = j / 5;
        const zz = z + side * depth * (1 - t);
        const y = lerp(eave, ridge, t);
        const clear = lerp(half, r, t) - 0.035;
        const ridgeStrip = [
          [x - clear, y + 0.015, zz + side * 0.08],
          [x + clear, y + 0.015, zz + side * 0.08],
          [x + clear, y + 0.063, zz - side * 0.05],
          [x - clear, y + 0.063, zz - side * 0.05],
        ];
        if (side < 0) ridgeStrip.reverse();
        quad4(out, 'reed', ...ridgeStrip, tint(palette.edgeReed, j));
      }
  }
}

function building(out, h, i, level) {
  const [x, z] = h.center;
  const w = h.width / 2,
    d = h.depth / 2;
  const edgeHeights = [
    [x - w, z - d],
    [x - w, z + d],
    [x + w, z - d],
    [x + w, z + d],
  ].map(siteGrade);
  const pad = Math.max(h.grade + 0.12, ...edgeHeights) + 0.11;
  const roofHost = pad + h.eaves;
  const color = i < 2 ? palette.upperWall : palette.wall;
  abox(out, 'boards', [x - w, pad, z - d], [x + w, roofHost, z + d], tint(color, i), {
    bottom: false,
  });
  abox(
    out,
    'edges',
    [x - w - 0.05, Math.min(...edgeHeights) - 0.31, z - d - 0.05],
    [x + w + 0.05, pad + 0.12, z + d + 0.05],
    tint(palette.bark, i),
    { bottom: false },
  );
  roof(out, h.center, pad, h, level, i < 2);
  const front = facade([x, z + d], [1, 0]);
  opening(out, front, 0, pad + 0.12, i < 2 ? 1.04 : 0.84, i < 2 ? 1.87 : 1.55, {
    glassSlot: 'edges',
    frameSlot: 'edges',
    glass: palette.dark,
    frame: palette.end,
    frameWidth: level >= 2 ? 0.09 : 0,
    frameDepth: 0.12,
    sill: false,
  });
  if (!level) return;
  const step = Math.min(0.25, pad - siteGrade([x, z + d + 0.4]));
  fbox(
    out,
    'edges',
    front,
    -0.72,
    0.72,
    pad - Math.max(0.14, step),
    pad + 0.12,
    0,
    0.53,
    palette.end,
  );
  if (i < 2) {
    for (const u of [-0.68 * w, -0.34 * w, 0.34 * w, 0.68 * w]) {
      opening(out, front, u, pad + 0.97, 0.89, 0.92, {
        glassSlot: 'edges',
        frameSlot: 'edges',
        glass: palette.dark,
        frame: palette.end,
        frameWidth: level >= 2 ? 0.1 : 0.035,
        frameDepth: 0.1,
        mullions: level >= 2 ? 2 : 0,
        sill: level >= 2,
        mullionColor: palette.bark,
      });
    }
    if (level >= 2)
      for (const u of [-w + 0.08, w - 0.08])
        fbox(out, 'edges', front, u - 0.067, u + 0.067, pad + 0.08, roofHost, 0, 0.07, palette.end);
  }
}

function build(out, level) {
  earthwork(out, level);
  palisade(out, level);
  profile.houses.forEach((house, i) => {
    building(out, house, i, level);
  });
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-dundas-model.mjs';
const camera = [-146, 91, 202];
const lookAt = [-8, 2.2, 45];
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
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: map.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'Fort Dundas in 1824 with the timber enclosure, paired thatched officers’ ranges and two sheds down the Barlow Point slope.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: profile.validFrom,
    validUntil: profile.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-52, 75, 86],
  mediumFiContext: {
    scale: 1.12,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: profile.ditch.outer,
    minHeight: -6.4,
    basis:
      'The historic ditch is defined by the documented timber enclosure and a local terrain substitution. The original field continues around its rim.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'entrance-bridge-and-ditch', position: [-16, 7.5, 42], lookAt: [-1, 1.2, 23] },
    { name: 'paired-thatched-officer-ranges', position: [18, 9, 18], lookAt: [-4, 1.9, -7] },
    { name: 'shore-side-sheds-and-ridge', position: [-106, 14, 155], lookAt: [-22, 1, 95] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-dundas-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.83,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.036, surfaces },
    },
  },
};
