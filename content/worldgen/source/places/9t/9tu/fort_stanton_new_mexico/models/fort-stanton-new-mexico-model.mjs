import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const guardRing = frame.features[1].points;
const officeFront = facade([-5.11, -6.85], [-1, 0]);
const colors = Object.fromEntries(
  Object.entries({
    stone: 'aaa79b',
    stoneBase: 'b9b5a8',
    darkStone: '828072',
    cedar: '885c40',
    cedarEdge: '75503c',
    cedarLight: '9a704a',
    shingle: '827e72',
    paint: 'd1cfc2',
    white: 'e0d9c5',
    green: '4e5c55',
    greenLight: '657269',
    pane: '4d5b57',
    door: '785b3e',
    brick: '895647',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  cedar: { slot: 'wall', graph: 'wood_plain', roughness: 0.91 },
  wall: { slot: 'wall', graph: 'wood_plain', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'wood_plain', roughness: 0.9 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  chimney: { slot: 'wall', graph: 'brick_longformat', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};

function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}

function panel(out, slot, f, left, right, low, high, d, color) {
  quad4(
    out,
    slot,
    f.P(left, low, d),
    f.P(right, low, d),
    f.P(right, high, d),
    f.P(left, high, d),
    color,
  );
}

function window(out, f, u, floor, width, height, level, closed = false) {
  if (level === 0) {
    panel(
      out,
      'glass',
      f,
      u - width / 2,
      u + width / 2,
      floor,
      floor + height,
      0.024,
      closed ? colors.paint : colors.pane,
    );
    return;
  }
  opening(out, f, u, floor, width, height, {
    glassSlot: closed ? 'trim' : 'glass',
    frameSlot: 'trim',
    frame: colors.green,
    glass: closed ? colors.paint : colors.pane,
    frameDepth: 0.09,
    frameWidth: width < 1.1 ? 0.08 : 0.105,
    mullions: level > 1 && !closed ? 2 : 0,
    transoms: level > 1 && !closed ? 2 : 0,
    mullionColor: colors.white,
  });
}

function officeArcade(out, level) {
  const width = 20.54,
    count = plan.dimensions.adjutantFrontArcadeBays;
  const bay = width / count,
    radius = bay * 0.405;
  const base = -width / 2,
    spring = 1.46,
    bridgeTop = 3.57;
  const depth = 0.51,
    frontD = 0.045;
  const f = officeFront;

  for (let j = 0; j <= count; j++) {
    const u = base + j * bay;
    fbox(out, 'stone', f, u - 0.29, u + 0.29, -0.36, 0.73, -depth, frontD, colors.stoneBase);
    fbox(out, 'cedar', f, u - 0.25, u + 0.25, 0.7, spring + 0.04, -depth, frontD, colors.cedar);
  }
  for (let j = 0; j < count; j++) {
    const u = base + (j + 0.5) * bay;
    const cuts = [5, 8, 12, 17][level];
    const arch = (t, d) =>
      f.P(u - radius * Math.cos(Math.PI * t), spring + radius * Math.sin(Math.PI * t), d);
    for (let k = 1; k <= cuts; k++) {
      const a = arch((k - 1) / cuts, frontD),
        b = arch(k / cuts, frontD);
      const topA = [a[0], bridgeTop, a[2]],
        topB = [b[0], bridgeTop, b[2]];
      quad4(out, 'cedar', a, b, topB, topA, colors.cedar);
      quad4(
        out,
        'stone',
        b,
        a,
        arch((k - 1) / cuts, -depth),
        arch(k / cuts, -depth),
        colors.darkStone,
      );
    }
    if (j < count - 1)
      panel(
        out,
        'cedar',
        f,
        u + radius,
        u + bay - radius,
        spring,
        bridgeTop,
        frontD,
        colors.cedarEdge,
      );
    if (level > 0) {
      const piers =
        level === 1
          ? [u - 0.64, u, u + 0.64]
          : Array.from(
              { length: level === 2 ? 7 : 10 },
              (_, k) => u - 0.94 + k * (level === 2 ? 0.3 : 0.2),
            );
      for (const p of piers) {
        fbox(out, 'trim', f, p - 0.035, p + 0.035, 3.66, 4.46, -0.1, -0.024, colors.white);
      }
    }
  }
  // Two rails span the enclosed front and their timber posts rise above the top rail.
  for (const y of [3.56, 4.41]) {
    fbox(out, 'trim', f, base - 0.28, -base + 0.28, y, y + 0.11, -0.15, 0.035, colors.white);
  }
  for (let j = 0; j <= count; j++) {
    const u = base + bay * j;
    fbox(out, 'cedar', f, u - 0.19, u + 0.19, 3.59, 4.61, -0.22, 0.08, colors.cedarEdge);
    if (level > 1) {
      fbox(out, 'stone', f, u - 0.23, u + 0.23, 4.55, 4.62, -0.27, 0.12, colors.darkStone);
    }
  }
}

function fanlight(out, x, z, level) {
  const f = facade([x, z], [-1, 0]);
  const width = 2.4,
    spring = 6.43,
    rise = 1.3,
    roofRise = 2.07;
  const base = f.P(0, spring, 0.056);
  tri(
    out,
    'cedar',
    f.P(-width, spring, 0.025),
    f.P(width, spring, 0.025),
    f.P(0, spring + roofRise, 0.025),
    colors.cedar,
  );
  const n = level === 0 ? 7 : 14;
  const arc = (t) =>
    f.P(-1.48 * Math.cos(Math.PI * t), spring + 0.04 + rise * Math.sin(Math.PI * t), 0.065);
  for (let i = 0; i < n; i++) tri(out, 'glass', base, arc(i / n), arc((i + 1) / n), colors.pane);
  const a = f.P(-width, spring, 0.11),
    b = f.P(0, spring + roofRise, 0.11),
    c = f.P(width, spring, 0.11);
  beam(out, 'trim', a, b, 0.18, 0.2, colors.greenLight);
  beam(out, 'trim', b, c, 0.18, 0.2, colors.greenLight);
  if (level > 1) {
    for (let i = 0; i < n; i++) {
      beam(out, 'trim', arc(i / n), arc((i + 1) / n), 0.072, 0.074, colors.white);
      if (i % 2 === 1) beam(out, 'trim', base, arc(i / n), 0.033, 0.039, colors.white);
    }
  }
}

function office(out, level) {
  const eave = plan.dimensions.adjutantEaveHeightM;
  const ridge = plan.dimensions.adjutantGableHeightM;
  box(out, 'stone', [-15.44, -0.52, -4.64], [5.29, 3.52, 6.92], colors.stone);
  box(out, 'cedar', [-15.44, 3.46, -4.64], [5.29, eave, 6.92], colors.cedar);
  box(out, 'stone', [-20.53, -0.58, -2.68], [-15.4, 3.38, 6.91], colors.stone);
  box(out, 'cedar', [-20.53, 3.34, -2.68], [-15.4, 5.9, 6.91], colors.cedarEdge);
  box(out, 'cedar', [-15.46, 3.52, -6.96], [5.32, 3.72, -4.42], colors.cedarEdge, true);
  box(out, 'trim', [-15.56, 6.12, -7.02], [5.45, eave, -4.63], colors.white, true);
  box(out, 'trim', [-20.61, 5.83, -2.81], [-15.32, 5.98, 6.99], colors.white);
  gableRoof(out, 'roof', [-15.46, 0.04], [5.34, 0.04], 13.81, eave, ridge, colors.shingle, {
    overhang: 0.23,
    endSlot: 'cedar',
    endColor: colors.cedar,
  });
  gableRoof(out, 'roof', [-20.56, 2.13], [-15.36, 2.13], 9.58, 5.94, 7.55, colors.shingle, {
    overhang: 0.21,
    endSlot: 'cedar',
    endColor: colors.cedarEdge,
    ends: [true, false],
  });
  gableRoof(out, 'roof', [-5.27, -6.83], [-5.27, -1.01], 4.81, 6.42, 8.52, colors.shingle, {
    overhang: 0.21,
    ends: [false, false],
  });
  fanlight(out, -5.27, -6.99, level);
  officeArcade(out, level);

  const back = facade([-5.11, -4.65], [-1, 0]);
  for (const u of [-8.12, -4.87, -1.62, 1.63, 4.87, 8.12]) {
    window(out, back, u, 4.05, 1.35, 1.8, level, true);
    window(out, back, u, 0.44, 1.19, 2.23, level);
  }
  if (level === 0) return;
  const rear = facade([-5.15, 6.93], [1, 0]);
  for (const u of [-12.9, -9.2, -5.35, -1.84, 2.1, 5.8, 9.13]) {
    window(out, rear, u, 1.02, 0.96, 1.54, level);
    window(out, rear, u, 4.01, 0.93, 1.53, level, u < -8);
  }
}

function guardHouse(out, level) {
  const north = wallFace(guardRing[3], guardRing[0]);
  const south = wallFace(guardRing[1], guardRing[2]);
  const west = wallFace(guardRing[0], guardRing[1]);
  const ring = outwardRing(guardRing);
  const height = plan.dimensions.guardEaveHeightM;
  const length = north.length,
    mid = length / 2,
    halfDepth = west.length / 2;
  // The ground at the second building is thirty centimetres below the office threshold.
  const grade = -0.3,
    eave = height + grade;
  const a = north.P(0, 0, -halfDepth),
    b = north.P(length, 0, -halfDepth);
  gableRoof(
    out,
    'roof',
    [a[0], a[2]],
    [b[0], b[2]],
    west.length,
    eave,
    plan.dimensions.guardRidgeHeightM + grade,
    colors.shingle,
    { overhang: 0.32, endSlot: 'wall', endColor: colors.paint },
  );
  fbox(out, 'stone', north, 0, length, grade - 0.54, 0.0, -west.length, 0.025, colors.stoneBase);
  fbox(out, 'wall', north, 0, length, 0.0, eave, -west.length, -0.89, colors.paint);
  for (const limits of [
    [0, mid - 1.53],
    [mid + 1.53, length],
  ]) {
    fbox(out, 'wall', north, ...limits, 0.0, eave, -0.95, 0, colors.paint);
  }

  fbox(out, 'stone', north, mid - 1.61, mid + 1.61, grade - 0.1, 0.18, -0.95, 0.49, colors.stone);
  for (const du of [-1.37, 1.37]) {
    fbox(
      out,
      'trim',
      north,
      mid + du - 0.115,
      mid + du + 0.115,
      0.16,
      eave - 0.01,
      -0.24,
      0.04,
      colors.white,
    );
  }
  tri(
    out,
    'wall',
    north.P(mid - 1.83, eave, 0.14),
    north.P(mid + 1.83, eave, 0.14),
    north.P(mid, eave + 0.63, 0.14),
    colors.paint,
  );
  for (const du of [-1.84, 1.84]) {
    beam(
      out,
      'trim',
      north.P(mid + du, eave, 0.18),
      north.P(mid, eave + 0.63, 0.18),
      0.16,
      0.168,
      colors.green,
    );
  }
  const doorway = facade(
    north.P(mid, 0, -0.88).filter((_, i) => i !== 1),
    north.along,
  );
  fbox(out, 'trim', doorway, -0.53, 0.53, 0.18, 2.25, -0.04, 0.04, colors.door);
  window(out, doorway, 0, 1.21, 0.49, 0.78, level);

  for (const du of [-8.26, -5.51, -3.0, 3.0, 5.51, 8.26]) {
    window(out, north, mid + du, 0.47, 1.61, 1.66, level);
    if (level > 0) window(out, south, mid + du, 0.49, 1.2, 1.54, level);
  }
  if (level > 1) {
    for (let i = 0; i < ring.length; i++) {
      const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
      for (let y = 0.18; y < eave - 0.14; y += level === 3 ? 0.135 : 0.255) {
        if (f.length === length && f.along[0] === north.along[0]) {
          panel(out, 'wall', f, 0, mid - 1.53, y, y + 0.015, 0.012, colors.stoneBase);
          panel(out, 'wall', f, mid + 1.53, f.length, y, y + 0.015, 0.012, colors.stoneBase);
        } else panel(out, 'wall', f, 0, f.length, y, y + 0.015, 0.012, colors.stoneBase);
      }
    }
  }
  fbox(
    out,
    'chimney',
    north,
    mid + 3.54,
    mid + 4.02,
    eave + 0.5,
    eave + 2.44,
    -halfDepth - 0.5,
    -halfDepth,
    colors.brick,
  );
}

function build(out, level) {
  office(out, level);
  guardHouse(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-stanton-new-mexico-model.mjs';
const camera = [-56, 24, -48],
  lookAt = [2.1, 3.6, 0.9];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Fort Stanton (New Mexico)',
  wikidataId: plan.wikidataId,
  category: 'fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Fort Stanton’s two parade-ground guardhouses, including the former Adjutant’s Office and Library.',
  camera,
  lookAt,
  sunDirection: [-36, 56, -44],
  mediumFiContext: {
    scale: 1,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.81,
    basis: 'Mapped 832 outline, and separately mapped Second Guard House at the parade ground.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'wood_plain', 'brick_longformat'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'adjutant-arcade-and-fanlight', position: [-6, 4, -29], lookAt: [-5, 4, -1] },
    { name: 'second-guard-house-and-entry-pediment', position: [38, 5, -25], lookAt: [17, 2.0, 0] },
    { name: 'both-guardhouses-from-parade-ground', position: [18, 13, -49], lookAt: [2.3, 3, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-stanton-new-mexico-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.105, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and USGS elevation under source attribution terms.',
};
