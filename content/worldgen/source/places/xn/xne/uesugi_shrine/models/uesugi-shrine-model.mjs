import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [, rearHall, gate, southFence, northFence, torii] = frame.features;

const color = {
  mainRoof: rgb('4b5455'),
  copper: rgb('527168'),
  gateRoof: rgb('535e5b'),
  cedar: rgb('635044'),
  lightCedar: rgb('856e59'),
  darkCedar: rgb('37332c'),
  granite: rgb('b4b2a6'),
  gravel: rgb('9c9b92'),
  oldStone: rgb('646966'),
  glass: rgb('65706f'),
  shide: rgb('e5e1d0'),
};

const surfaces = {
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.13 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  finish: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.27 },
};

function span(points, dimension) {
  return [
    Math.min(...points.map((p) => p[dimension])),
    Math.max(...points.map((p) => p[dimension])),
  ];
}

function shape(points) {
  const [left, right] = span(points, 0);
  const [back, front] = span(points, 1);
  return { x: (left + right) / 2, z: (back + front) / 2, w: right - left, d: front - back };
}

const hall = shape(frame.geometry.outline.filter((p) => p[1] < 3));
const sanctuary = shape(rearHall.points);
const entrance = shape(gate.points);
const [toriiX, toriiZ] = torii.points[0];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const [r0, r1] = terrain.heightsMeters.slice(j, j + 2);
  return ((1 - a) * r0[i] + a * r0[i + 1]) * (1 - b)
    + ((1 - a) * r1[i] + a * r1[i + 1]) * b - terrain.modelDatumElevationMeters;
}

function box(out, slot, x, z, w, d, y0, y1, tint) {
  abox(out, slot, [x - w / 2, y0, z - d / 2], [x + w / 2, y1, z + d / 2], tint, { bottom: false });
}

function ring(p, w, d, y, corner) {
  const a = w / 2;
  const b = d / 2;
  return [
    [p.x - a, y + corner, p.z - b],
    [p.x - a, y, p.z],
    [p.x - a, y + corner, p.z + b],
    [p.x, y, p.z + b],
    [p.x + a, y + corner, p.z + b],
    [p.x + a, y, p.z],
    [p.x + a, y + corner, p.z - b],
    [p.x, y, p.z - b],
  ];
}

// The shallow outer copper field turns up at the corners, below the stronger pitched ridge.
function hippedRoof(out, p, eave, rise, sweep, tint, level) {
  const eaves = ring(p, p.w, p.d, eave, sweep);
  const spring = ring(p, p.w * 0.86, p.d * 0.79, eave + rise * 0.14, sweep * 0.54);
  const hip = ring(p, p.w * 0.64, p.d * 0.49, eave + rise * 0.48, sweep * 0.24);
  const ridge = ring(p, p.w * 0.54, Math.max(p.d * 0.039, 0.23), eave + rise, 0.028);
  loft(out, 'roof', level === 0 ? [eaves, hip, ridge] : [eaves, spring, hip, ridge], tint, { cap: false });
  quad4(out, 'roof', ridge[0], ridge[2], ridge[4], ridge[6], color.copper);

  const soffit = ring(p, p.w * 0.80, p.d * 0.77, eave - 0.25, sweep * 0.61);
  for (let i = 0; i < eaves.length; i++) {
    const j = (i + 1) % eaves.length;
    quad4(out, 'wood', eaves[j], eaves[i], soffit[i], soffit[j], color.darkCedar);
    if (level > 0) {
      beam(out, 'roof', eaves[i], eaves[j], 0.115, 0.16, color.copper);
    }
    if (level > 1) {
      const steps = level === 2 ? 4 : 8;
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.42) / steps;
        const a = eaves[i].map((v, d) => v * (1 - t) + eaves[j][d] * t);
        const b = soffit[i].map((v, d) => v * (1 - t) + soffit[j][d] * t);
        a[1] -= 0.14;
        b[1] -= 0.09;
        beam(out, 'wood', a, b, 0.072, 0.091, color.cedar);
      }
    }
  }

  box(out, 'roof', p.x, p.z, p.w * 0.56, 0.34, eave + rise - 0.10, eave + rise + 0.11, color.copper);
}

function shimenawa(out, x, z, w, y, level) {
  const count = level > 1 ? 6 : 3;
  const at = (i) => {
    const t = i / count;
    return [x + (t - 0.5) * w, y - 0.18 * 4 * t * (1 - t), z];
  };
  for (let i = 0; i < count; i++) {
    beam(out, 'wood', at(i), at(i + 1), 0.041, 0.036, color.lightCedar);
    if (i > 0 && level > 0) {
      const [a, b, c] = at(i);
      quad4(out, 'finish', [a - 0.055, b, c], [a + 0.026, b, c + 0.01],
        [a + 0.063, b - 0.20, c + 0.05], [a - 0.025, b - 0.145, c + 0.03], color.shide);
    }
  }
}

function worshipHall(out, level) {
  const w = hall.w - 1.28;
  const front = 2.56;
  const floor = 0.58;
  const eave = 4.67;
  const bayEdge = 3.41;
  const facadeLine = facade([hall.x, front], [1, 0]);
  box(out, 'stone', hall.x, hall.z + 0.54, w + 0.31, hall.d + 0.67, -0.35, floor, color.granite);
  box(out, 'wood', hall.x, hall.z - 0.75, w, hall.d - 1.25, floor, eave, color.cedar);
  box(out, 'wood', hall.x, 3.37, 7.0, 2.36, floor, floor + 0.21, color.cedar);
  box(out, 'wood', hall.x, 3.31, w + 0.03, 1.81, 4.14, 4.62, color.darkCedar);

  for (const side of [-1, 1]) {
    const center = side * (bayEdge + (w / 2 - bayEdge) / 2);
    const bayWidth = w / 2 - bayEdge - 0.10;
    if (level > 0) {
      opening(out, facadeLine, center, 1.46, bayWidth, 2.50, {
        glassSlot: 'glass', frameSlot: 'wood', glass: color.glass, frame: color.lightCedar,
        d: 0.036, frameWidth: 0.087, mullions: 2, transoms: level > 1 ? 2 : 1,
      });
      fbox(out, 'wood', facadeLine, center - bayWidth / 2, center + bayWidth / 2, floor,
        1.46, 0.018, 0.12, color.lightCedar);
    } else {
      fbox(out, 'glass', facadeLine, center - bayWidth / 2, center + bayWidth / 2, floor,
        3.96, 0.018, 0.12, color.glass);
    }
    for (const x of [side * bayEdge, side * (w / 2 - 0.08)]) {
      box(out, 'wood', hall.x + x, front + 0.12, 0.25, 0.43, floor, 4.36, color.cedar);
    }
    if (level > 1) {
      const f = facade([hall.x + side * w / 2, -3.45], [0, -side]);
      const count = level === 2 ? 5 : 9;
      for (let i = 0; i < count; i++) {
        const u = 10 * (i / (count - 1) - 0.5);
        fbox(out, 'wood', f, u - 0.07, u + 0.07, floor, 4.49, 0.01, 0.13, color.lightCedar);
      }
    }
  }
  for (const offset of level === 0 ? [] : [-2.47, 0, 2.47]) {
    const f = facade([hall.x, front - 0.69], [1, 0]);
    opening(out, f, offset, 0.88, 2.1, 2.76, {
      glassSlot: 'finish', frameSlot: 'wood', glass: color.darkCedar, frame: color.cedar,
      d: 0.027, frameWidth: 0.115, mullions: level > 1 ? 3 : 0, transoms: 1,
    });
  }
  for (const offset of [-3.55, -1.21, 1.21, 3.55]) {
    box(out, 'wood', hall.x + offset, 3.96, 0.24, 0.29, 0.67, 4.39, color.cedar);
  }
  for (let i = 0; i < 4; i++) {
    box(out, 'wood', hall.x, 4.81 - i * 0.23, 6.57, 0.42,
      -0.16, 0.03 + 0.185 * i, i % 2 === 0 ? color.lightCedar : color.cedar);
  }
  if (level > 0) shimenawa(out, hall.x, 4.23, 9.4, 3.86, level);
  hippedRoof(out, { ...hall, z: hall.z + 0.69, d: hall.d + 2.48, w: hall.w + 0.71 },
    eave, plan.dimensions.worshipHallRoofHeightM - eave, 0.62, color.mainRoof, level);
}

function rearSanctuary(out, level) {
  const g = ground(sanctuary.x, sanctuary.z);
  box(out, 'stone', sanctuary.x, sanctuary.z, sanctuary.w - 0.15, sanctuary.d - 0.31,
    g - 0.24, g + 0.68, color.granite);
  box(out, 'wood', sanctuary.x, sanctuary.z, sanctuary.w - 1.18, sanctuary.d - 1.22,
    g + 0.68, g + 3.81, color.cedar);
  // The offering passage connects two separately mapped buildings.
  box(out, 'wood', sanctuary.x, -10.55, 5.62, 2.96, g + 0.64, g + 3.7, color.darkCedar);
  hippedRoof(out, sanctuary, g + 3.68, plan.dimensions.rearSanctuaryRoofHeightAboveGradeM - 3.68,
    0.35, color.gateRoof, level);
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const f = facade([sanctuary.x + side * (sanctuary.w - 1.18) / 2, sanctuary.z], [0, -side]);
    const steps = level > 1 ? 8 : 4;
    for (let i = 0; i <= steps; i++) {
      const u = 9.7 * (i / steps - 0.5);
      fbox(out, 'wood', f, u - 0.062, u + 0.062, g + 0.71, g + 3.68, 0.008, 0.12, color.lightCedar);
    }
  }
}

function timberGate(out, level) {
  const g = ground(entrance.x, entrance.z + 2.5);
  const floor = g + 0.43;
  const eave = g + 2.89;
  box(out, 'stone', entrance.x, entrance.z, entrance.w - 0.20, 4.23, g - 0.26, floor, color.granite);
  for (const z of [entrance.z - 1.3, entrance.z + 1.38]) {
    for (const x of [-2.02, 2.02]) {
      box(out, 'wood', entrance.x + x, z, 0.29, 0.34, floor, eave, color.darkCedar);
    }
  }
  for (const x of [-2.31, 2.31]) {
    box(out, 'wood', entrance.x + x, entrance.z, 0.49, 3.52, floor + 0.05, floor + 1.48, color.cedar);
  }
  box(out, 'wood', entrance.x, entrance.z, entrance.w - 0.18, 3.18, eave - 0.45, eave - 0.06, color.darkCedar);
  hippedRoof(out, entrance, eave, plan.dimensions.courtyardEntranceRoofHeightAboveGradeM - 2.89,
    0.14, color.gateRoof, level);
  for (let i = 0; i < 3; i++) {
    box(out, 'stone', entrance.x, entrance.z + 2.58 - i * 0.24, 4.36, 0.42,
      g - 0.22, g + 0.16 + i * 0.133, color.granite);
  }
  if (level > 0) shimenawa(out, entrance.x, entrance.z + 1.78, 3.65, eave - 0.63, level);
}

function enclosure(out, feature, level) {
  for (let i = 1; i < feature.points.length; i++) {
    const from = feature.points[i - 1];
    const to = feature.points[i];
    const f = wallFace(from, to);
    const g = ground((from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    fbox(out, 'stone', f, 0, f.length, g - 0.32, g + 0.61, -0.22, 0.22, color.granite);
    fbox(out, 'wood', f, 0, f.length, g + 0.60, g + 1.93, -0.13, 0.13, color.darkCedar);
    const ridge0 = f.P(0, g + 2.37);
    const ridge1 = f.P(f.length, g + 2.37);
    const left0 = f.P(0, g + 2.16, -0.55);
    const left1 = f.P(f.length, g + 2.16, -0.55);
    const right0 = f.P(0, g + 2.16, 0.55);
    const right1 = f.P(f.length, g + 2.16, 0.55);
    quad4(out, 'roof', ridge0, ridge1, left1, left0, color.gateRoof);
    quad4(out, 'roof', ridge1, ridge0, right0, right1, color.gateRoof);
    if (level > 0) {
      tri(out, 'wood', left0, ridge0, right0, color.darkCedar);
      tri(out, 'wood', right1, ridge1, left1, color.darkCedar);
      const count = Math.max(1, Math.round(f.length / (level > 1 ? 1.85 : 3.6)));
      for (let k = 0; k < count; k++) {
        const u = (k + 0.5) * f.length / count;
        fbox(out, 'wood', f, u - 0.07, u + 0.07, g + 0.62, g + 2.2, -0.27, 0.27, color.cedar);
        if (level > 1) {
          fbox(out, 'wood', f, u + 0.22, Math.min(f.length, u + 0.275), g + 0.76, g + 1.61,
            -0.15, 0.17, color.lightCedar);
        }
      }
    }
  }
}

function stoneTorii(out, level) {
  const base = ground(toriiX, toriiZ);
  const height = plan.dimensions.stoneToriiHeightAboveGradeM;
  const sides = [6, 12, 16, 24][level];
  for (const sign of [-1, 1]) {
    const center = [toriiX + sign * 1.84, toriiZ];
    loft(out, 'stone', [radialRing(base - 0.22, 0.52, 0.48, sides, center),
      radialRing(base + 0.24, 0.49, 0.45, sides, center)], color.oldStone);
    loft(out, 'stone', [radialRing(base + 0.09, 0.36, 0.34, sides, center),
      radialRing(base + height - 0.34, 0.27, 0.27, sides, [toriiX + sign * 1.64, toriiZ])],
    color.granite);
  }
  box(out, 'stone', toriiX, toriiZ, 5.46, 0.34, base + 3.80, base + 4.21, color.granite);
  const tips = [[-3.14, 0.31], [-2.43, 0.13], [-1.36, 0.025], [0, 0],
    [1.36, 0.025], [2.43, 0.13], [3.14, 0.31]];
  for (let i = 1; i < tips.length; i++) {
    const cap = ([x, rise], face, offset) => [toriiX + x * offset, base + height + rise + face, toriiZ];
    const from = tips[i - 1];
    const to = tips[i];
    beam(out, 'stone', cap(from, -0.30, 1), cap(to, -0.30, 1), 0.52, 0.37, color.oldStone);
    if (level > 0) {
      beam(out, 'stone', cap(from, -0.055, 1.017), cap(to, -0.055, 1.017), 0.68, 0.12, color.oldStone);
    }
  }
  box(out, 'finish', toriiX, toriiZ + 0.24, 0.76, 0.12, base + 3.99, base + 5.19, color.copper);
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const x = toriiX + side * 3.25;
    box(out, 'stone', x, toriiZ, 2.51, 0.20, base + 0.91, base + 1.12, color.granite);
    for (const u of [-1, -0.5, 0, 0.5, 1]) {
      box(out, 'stone', x + u, toriiZ, 0.18, 0.24, base - 0.20, base + 1.04, color.granite);
    }
  }
}

function approach(out, level) {
  const breaks = [5.14, 9, 13, 17, 18.62, 23.91, 28, 34, 41, 48, 55, 62, 69, 76, 83, 90];
  const pathX = (z) => entrance.x + (toriiX - entrance.x) * (z - entrance.z) / (toriiZ - entrance.z);
  for (let i = 1; i < breaks.length; i++) {
    if (i === 5) continue;
    const z0 = breaks[i - 1];
    const z1 = breaks[i];
    const rows = level > 1 ? Math.ceil((z1 - z0) / 1.12) : 1;
    const cols = level > 0 ? 3 : 1;
    const point = (row, col) => {
      const z = z0 + (z1 - z0) * row / rows;
      const x = pathX(z) + 3.15 * (col / cols - 0.5);
      return [x, ground(x, z) + 0.065, z];
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        quad4(out, 'stone', point(r, c), point(r + 1, c), point(r + 1, c + 1),
          point(r, c + 1), (c + r + i) % 3 === 0 ? color.gravel : color.granite);
      }
    }
  }
}

function build(out, level) {
  worshipHall(out, level);
  rearSanctuary(out, level);
  timberGate(out, level);
  enclosure(out, southFence, level);
  enclosure(out, northFence, level);
  stoneTorii(out, level);
  approach(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'uesugi-shrine-model.mjs';
const camera = [38, 25, 45];
const lookAt = [0, 3.05, 4.1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Uesugi Shrine',
  wikidataId: plan.wikidataId,
  category: 'shinto-shrine',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'Historic Yonezawa shrine with a swept gray-green worship-hall roof, enclosed rear sanctuary, timber entrance and stone torii.',
  camera,
  lookAt,
  sunDirection: [-44, 71, 58],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis: 'Mapped worship hall with projection toward the courtyard.',
  },
  embeddedCanonicalGraphs: ['metal_standing_seam', 'stone_ashlar', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'glazed-bays-and-timber-front', position: [-10, 6.5, 15], lookAt: [0, 3.9, 1] },
    { name: 'stone-torii-and-approach', position: [-9, 6.8, 97], lookAt: [toriiX, 2.1, toriiZ] },
    { name: 'courtyard-gate-and-enclosure', position: [16, 8, 36], lookAt: [-0.5, 1.7, 18] },
    { name: 'rear-sanctuary-and-courtyard', position: [-43, 23, -36], lookAt: [0, 3.1, -7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'uesugi-shrine-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.56,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.098, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.038, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original 3D work under the repository license. Native footprints under ODbL and GSI elevations under the agency terms.',
};
