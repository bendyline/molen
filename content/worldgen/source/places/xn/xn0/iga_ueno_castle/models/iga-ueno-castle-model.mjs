import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fan,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const c = {
  plaster: rgb('dfded0'),
  cream: rgb('ebe8d8'),
  stone: rgb('807b6b'),
  stair: rgb('989282'),
  roof: rgb('4c5351'),
  edge: rgb('3f4744'),
  timber: rgb('51493b'),
  shade: rgb('3b3d33'),
  rail: rgb('7b7664'),
};
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.94 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
};

function bounds(path) {
  return [0, 1].map((d) => [
    Math.min(...path.map((p) => p[d])),
    Math.max(...path.map((p) => p[d])),
  ]);
}
const [[mainLeft, mainRight], [mainBack]] = bounds(frame.geometry.outline);
const [[littleLeft, littleRight], [, littleFront]] = bounds(frame.features[1].points);
const [[gateLeft, gateRight], [gateBack, gateFront]] = bounds(frame.features[2].points);
const main = {
  x: (mainLeft + mainRight) / 2,
  z: (mainBack + 3.61) / 2,
  w: mainRight - mainLeft,
  d: 3.61 - mainBack,
  floor: 3.6,
};
const small = {
  x: (littleLeft + littleRight) / 2,
  z: (16.43 + littleFront) / 2 - 0.9,
  w: littleRight - littleLeft,
  d: 7.53,
  floor: 1.18,
};

function boxRing(x, z, w, d, y, corner = 0) {
  const a = w / 2,
    b = d / 2;
  return [
    [x - a, y + corner, z - b],
    [x - a, y, z],
    [x - a, y + corner, z + b],
    [x, y, z + b],
    [x + a, y + corner, z + b],
    [x + a, y, z],
    [x + a, y + corner, z - b],
    [x, y, z - b],
  ];
}

function footprint(x, z, w, d) {
  return [
    [x - w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
    [x + w / 2, z - d / 2],
  ];
}

function masonry(out, p, bottom, batter) {
  const low = boxRing(p.x, p.z, p.w + batter * 2, p.d + batter * 2, bottom);
  const half = boxRing(p.x, p.z, p.w + batter * 0.54, p.d + batter * 0.54, p.floor - 1.02);
  const top = boxRing(p.x, p.z, p.w + 0.32, p.d + 0.32, p.floor);
  loft(out, 'stone', [low, half, top], c.stone, { cap: false });
  quad4(out, 'stone', top[0], top[2], top[4], top[6], c.stair);
}

function panel(out, slot, f, left, right, bottom, top, recess, color) {
  quad4(
    out,
    slot,
    f.P(left, bottom, recess),
    f.P(right, bottom, recess),
    f.P(right, top, recess),
    f.P(left, top, recess),
    color,
  );
}

function tier(out, p, low, high, level, openings) {
  const corners = footprint(p.x, p.z, p.w, p.d);
  for (let i = 0; i < 4; i++) {
    const f = wallFace(corners[i], corners[(i + 1) % 4]);
    panel(out, 'plaster', f, 0, f.length, low, high, 0, c.plaster);
    if (level > 0) panel(out, 'plaster', f, 0, f.length, low + 0.19, low + 0.31, 0.036, c.cream);
    const h = high - low;
    for (let j = 0; j < openings; j++) {
      const u = (f.length * (j + 0.5)) / openings;
      const w = Math.min(0.52, (f.length / openings) * 0.22);
      const lowSill = low + h * 0.32,
        topSill = low + h * 0.74;
      panel(out, 'detail', f, u - w, u + w, lowSill, topSill, 0.021, c.shade);
      if (level > 0)
        fbox(
          out,
          'plaster',
          f,
          u - w - 0.13,
          u + w + 0.13,
          lowSill - 0.14,
          lowSill - 0.032,
          0.009,
          0.142,
          c.cream,
        );
      if (level > 1) {
        for (let k = 1; k < (level === 2 ? 3 : 5); k++) {
          const x = u + w * ((2 * k) / (level === 2 ? 3 : 5) - 1);
          panel(out, 'timber', f, x - 0.023, x + 0.023, lowSill, topSill, 0.037, c.rail);
        }
      }
    }
  }
}

function canopy(out, p, y, rise, level) {
  const eaves = boxRing(p.x, p.z, p.w, p.d, y, 0.45);
  const ledge = boxRing(p.x, p.z, p.w * 0.91, p.d * 0.9, y + rise * 0.15, 0.27);
  const shoulder = boxRing(p.x, p.z, p.w * 0.69, p.d * 0.66, y + rise * 0.47, 0.15);
  const ridge = boxRing(p.x, p.z, p.w * 0.37, Math.max(0.7, p.d * 0.155), y + rise * 0.84, 0.08);
  loft(out, 'roof', [eaves, ledge, shoulder, ridge], c.roof, { cap: false });
  quad4(out, 'roof', ridge[0], ridge[2], ridge[4], ridge[6], c.roof);
  const soffit = boxRing(p.x, p.z, p.w * 0.81, p.d * 0.81, y - 0.33, 0.19);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    quad4(out, 'plaster', eaves[j], eaves[i], soffit[i], soffit[j], c.cream);
    if (level === 0) continue;
    beam(out, 'roof', eaves[i], eaves[j], 0.115, 0.18, c.edge);
    if (level > 1) {
      const count = level === 2 ? 3 : 6;
      for (let k = 0; k < count; k++) {
        const t = (k + 0.32) / count;
        const lerp = (a, b) => a.map((n, d) => n + (b[d] - n) * t);
        const a = lerp(eaves[i], eaves[j]),
          b = lerp(soffit[i], soffit[j]);
        a[1] -= 0.15;
        b[1] -= 0.1;
        beam(out, 'plaster', a, b, 0.079, 0.097, c.cream);
      }
    }
  }
  if (level > 0) {
    const capLeft = [p.x - p.w * 0.22, y + rise * 0.87, p.z];
    const capRight = [p.x + p.w * 0.22, y + rise * 0.87, p.z];
    beam(out, 'roof', capLeft, capRight, 0.34, 0.26, c.edge);
    for (const s of [-1, 1]) {
      const tip = s < 0 ? capLeft : capRight;
      beam(out, 'roof', tip, [tip[0] + s * 0.22, tip[1] + rise * 0.13, tip[2]], 0.18, 0.2, c.edge);
    }
  }
}

function gable(out, f, u, y, width, rise, depth, level, curved) {
  const count = [4, 6, 10, 14][level];
  const face = (t) => {
    const a = 2 * t - 1,
      base = 1 - Math.abs(a);
    const h = curved ? (1 - a * a) * (1 - a * a) : base * base;
    return [u + (a * width) / 2, y + rise * h];
  };
  for (let j = 0; j < count; j++) {
    const [x, a] = face(j / count),
      [w, b] = face((j + 1) / count);
    if (j === 0) tri(out, 'plaster', f.P(x, y, depth), f.P(w, y, depth), f.P(w, b, depth), c.cream);
    else if (j === count - 1)
      tri(out, 'plaster', f.P(x, y, depth), f.P(w, y, depth), f.P(x, a, depth), c.cream);
    else panelSlope(out, f, x, w, y, a, b, depth);
    const from = f.P(x, a + 0.087, depth + 0.21),
      to = f.P(w, b + 0.087, depth + 0.21);
    quad4(
      out,
      'roof',
      from,
      to,
      f.P(w, b + 0.19, depth - 0.63),
      f.P(x, a + 0.19, depth - 0.63),
      c.roof,
    );
    if (level > 0) beam(out, 'roof', from, to, 0.135, 0.124, c.edge);
  }
}
function panelSlope(out, f, a, b, y, topA, topB, d) {
  quad4(out, 'plaster', f.P(a, y, d), f.P(b, y, d), f.P(b, topB, d), f.P(a, topA, d), c.plaster);
}
function eastFace(p) {
  return wallFace([p.x + p.w * 0.5, p.z + p.d * 0.5], [p.x + p.w * 0.5, p.z - p.d * 0.5]);
}
function southFace(p) {
  return wallFace([p.x - p.w * 0.5, p.z + p.d * 0.5], [p.x + p.w * 0.5, p.z + p.d * 0.5]);
}

function keep(out, level) {
  masonry(out, main, -0.43, 1.11);
  const mainSpecs = [
    { w: main.w, d: main.d, y: 10.24, rise: 4.66, ratio: 1, openings: 4 },
    { w: main.w * 0.76, d: main.d * 0.76, y: 16.57, rise: 4.16, ratio: 0.76, openings: 3 },
    { w: main.w * 0.54, d: main.d * 0.56, y: 22.1, rise: 4.5, ratio: 0.54, openings: 2 },
  ];
  let floor = main.floor;
  for (const [i, s] of mainSpecs.entries()) {
    const volume = { x: main.x, z: main.z, w: s.w, d: s.d };
    tier(out, volume, floor, s.y + 0.24, level, s.openings);
    canopy(out, { ...volume, w: s.w + 2.68, d: s.d + 2.73 }, s.y, s.rise, level);
    const east = eastFace(volume);
    gable(
      out,
      east,
      east.length * 0.52,
      s.y + 0.22,
      Math.min(8.2 * s.ratio + 1.4, east.length),
      s.rise * 0.69,
      1.12,
      level,
      i !== 1,
    );
    if (i < 2) {
      const south = southFace(volume);
      gable(
        out,
        south,
        south.length * 0.5,
        s.y + 0.16,
        Math.min(6.6 * s.ratio + 1.2, south.length),
        s.rise * 0.53,
        0.9,
        level,
        i === 0,
      );
    }
    floor = s.y + s.rise * 0.62;
  }
  const door = [
    [-4.4, 3.57],
    [3.5, 3.57],
    [3.5, 6.06],
    [-4.4, 6.06],
  ];
  fan(out, 'stone', door.map(([x, z]) => [x, main.floor, z]).reverse(), c.stair);
  abox(out, 'stone', [-4.4, -0.42, 3.56], [3.5, main.floor - 0.028, 6.06], c.stone);
}
function littleKeep(out, level) {
  masonry(out, small, -0.38, 0.72);
  tier(out, small, small.floor, 5.12, level, 2);
  canopy(out, { ...small, w: small.w + 1.83, d: small.d + 1.85 }, 5.02, 2.2, level);
  const upper = { ...small, w: small.w * 0.74, d: small.d * 0.75 };
  tier(out, upper, 6.19, 8.87, level, 2);
  canopy(out, { ...upper, w: upper.w + 1.91, d: upper.d + 1.83 }, 8.72, 2.0, level);
  const e = eastFace(upper);
  gable(out, e, e.length * 0.48, 9.04, 5.0, 1.38, 0.49, level, false);
  const f = eastFace(small);
  gable(out, f, f.length * 0.46, 5.21, 5.94, 1.49, 0.51, level, true);
}

function gateway(out, level) {
  const x = (gateLeft + gateRight) / 2,
    z = (gateBack + gateFront) / 2;
  const lowX = gateLeft - 0.14,
    highX = gateRight + 0.14;
  const stairs = [4, 8, 13, 16][level];
  const start = 17.16,
    end = 6.0;
  for (let i = 0; i < stairs; i++) {
    const t = i / stairs,
      u = (i + 1) / stairs;
    const y = 0.18 + (main.floor - 0.18) * u;
    abox(
      out,
      'stone',
      [lowX - 0.28, -0.36, start + (end - start) * u],
      [highX + 0.33, y, start + (end - start) * t],
      c.stair,
      { bottom: false },
    );
  }
  const a = gateBack + 0.3,
    b = gateFront - 0.35;
  for (const u of [a, b]) {
    for (const v of [lowX, highX]) {
      abox(out, 'timber', [v - 0.13, 0.28, u - 0.15], [v + 0.13, 5.1, u + 0.15], c.timber);
    }
    abox(out, 'timber', [lowX - 0.18, 4.64, u - 0.135], [highX + 0.18, 5.05, u + 0.135], c.timber);
  }
  abox(out, 'stone', [lowX - 0.77, -0.31, b - 0.24], [lowX - 0.074, 2.26, b + 0.24], c.stone);
  abox(out, 'stone', [highX + 0.074, -0.31, b - 0.24], [highX + 0.77, 2.26, b + 0.24], c.stone);
  abox(out, 'plaster', [lowX - 0.68, 2.26, b - 0.185], [lowX - 0.066, 4.63, b + 0.185], c.plaster);
  abox(
    out,
    'plaster',
    [highX + 0.066, 2.26, b - 0.185],
    [highX + 0.68, 4.63, b + 0.185],
    c.plaster,
  );
  if (level > 0) {
    abox(out, 'timber', [lowX + 0.07, 1.13, b - 0.89], [lowX + 0.185, 4.17, b - 0.09], c.timber);
    abox(out, 'timber', [highX - 0.185, 1.13, b - 0.89], [highX - 0.07, 4.17, b - 0.09], c.timber);
  }
  canopy(
    out,
    { x, z, w: gateRight - gateLeft + 1.1, d: gateFront - gateBack + 0.77 },
    5.23,
    1.63,
    level,
  );
  if (level > 1) {
    for (const v of [lowX - 0.19, highX + 0.19]) {
      beam(out, 'detail', [v, 1.01, 16.46], [v, 4.31, 7.28], 0.072, 0.072, c.rail);
      for (let i = 1; i <= 4; i++) {
        const t = i / 5,
          y = 1.01 + 3.3 * t,
          s = 16.46 - 9.18 * t;
        beam(out, 'detail', [v, y - 0.75, s], [v, y, s], 0.058, 0.062, c.rail);
      }
    }
  }
}

function build(out, level) {
  keep(out, level);
  littleKeep(out, level);
  gateway(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'iga-ueno-castle-model.mjs';
const camera = [43, 21, 34],
  lookAt = [-0.9, 10.9, 1.3];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Iga Ueno Castle',
  wikidataId: plan.wikidataId,
  category: 'historic-castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The rebuilt three-tier Iga Ueno main keep, its smaller companion and covered gate, with white plaster and upturned tile eaves.',
  camera,
  lookAt,
  sunDirection: [45, 75, 61],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Native surveyed main keep and entry spur.',
  },
  embeddedCanonicalGraphs: ['stone_drywall', 'plaster_lime', 'tile_ceramic', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'keeps-and-connecting-gate', position: [48, 10.5, 26], lookAt: [-0.5, 9, 4.1] },
    { name: 'white-plaster-and-tiled-gables', position: [27, 24, -30], lookAt: [0.9, 14.3, -1.8] },
    { name: 'lower-keep-and-entrance-stair', position: [19, 8, 39], lookAt: [-2.75, 6.5, 9.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'iga-ueno-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.29, surfaces },
      street: { export: 'street', errorMeters: 0.117, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.039, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Native footprint and map facts under ODbL and GSI terrain under the agency terms.',
};
