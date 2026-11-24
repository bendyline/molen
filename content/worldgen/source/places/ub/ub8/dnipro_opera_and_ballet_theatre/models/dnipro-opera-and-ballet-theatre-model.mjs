import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const [, main, southWing, northWing, auditorium, stage, canopy] = frame.features;
const colors = {
  limestone: rgb('c4bca9'),
  light: rgb('cfcbba'),
  warm: rgb('b4a794'),
  ground: rgb('9d998c'),
  bronze: rgb('686047'),
  metal: rgb('565952'),
  roof: rgb('666962'),
  backdrop: rgb('405050'),
  lower: rgb('414c47'),
  clerestory: rgb('9ca9a1'),
  glazing: [rgb('a2b2ad'), rgb('a7b6ae'), rgb('b0bab2'), rgb('a4b0ac')],
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  platform: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.9, metallic: 0.09 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.29, metallic: 0.09 },
};

const front = 19.852;
const left = -20.66;
const right = 22.4;
const lobby = facade([left, front], [1, 0]);
const base = facade([left, 17.92], [1, 0]);
const width = right - left;

function volume(out, slot, outline, bottom, top, color, topSlot, topColor = color) {
  extrude(out, slot, outline, bottom, top, color, { top: false });
  if (!topSlot) return;
  const ids = triangulate(outline.flat());
  const pos = (i) => [outline[i][0], top, outline[i][1]];
  for (let i = 0; i < ids.length; i += 3) {
    tri(out, topSlot, pos(ids[i]), pos(ids[i + 2]), pos(ids[i + 1]), topColor);
  }
}

function panel(out, surface, f, a, b, y0, y1, offset, tint) {
  quad4(
    out,
    surface,
    f.P(a, y0, offset),
    f.P(b, y0, offset),
    f.P(b, y1, offset),
    f.P(a, y1, offset),
    tint,
  );
}

function block(out, slot, lo, hi, tint) {
  abox(out, slot, lo, hi, tint, { bottom: false });
}

function steps(out, level) {
  const count = level > 0 ? 4 : 2;
  for (let i = 0; i < count; i++) {
    const z = 21.56 - (i * 2.23) / count;
    block(
      out,
      'platform',
      [left - 0.48, -0.44, z - 1.05],
      [right + 0.44, 0.12 + (0.48 * i) / count, z + 1.01],
      colors.ground,
    );
  }
  block(out, 'platform', [left - 0.24, -0.37, 16.55], [right + 0.27, 0.56, 20.62], colors.ground);
}

function plazaLobby(out, level) {
  const ring = main.points.map(([x, z]) => [x, Math.min(z, 17.9)]);
  volume(out, 'platform', frame.geometry.outline, -2.85, 0.18, colors.ground);
  volume(out, 'stone', ring, 0.18, 3.75, colors.limestone);
  volume(
    out,
    'stone',
    main.points,
    3.75,
    plan.dimensions.lobbyHeightM,
    colors.limestone,
    'roof',
    colors.roof,
  );
  volume(out, 'stone', canopy.points, 3.76, 4.52, colors.light, 'roof', colors.roof);
  steps(out, level);

  fbox(out, 'stone', lobby, 0, width, 4.19, 5.28, 0.004, 0.26, colors.light);
  fbox(out, 'stone', lobby, 0, width, 13.36, 15.22, 0.004, 0.22, colors.light);
  panel(out, 'glass', lobby, 0.1, width - 0.09, 5.26, 13.39, 0.065, colors.backdrop);
  panel(out, 'glass', base, 0.45, width - 0.56, 0.56, 3.76, 0.05, colors.lower);

  const bays = 18;
  const cell = width / bays;
  if (level > 0) {
    for (let i = 0; i < bays; i++) {
      const x = i * cell;
      const side = x + 0.21;
      const end = x + cell - 0.19;
      panel(out, 'glass', lobby, side, end, 5.44, 7.18, 0.115, colors.clerestory);
      panel(out, 'glass', lobby, side, end, 7.23, 10.6, 0.12, colors.glazing[i % 4]);
      panel(out, 'glass', lobby, side, end, 11.34, 13.22, 0.12, colors.glazing[(i + 1) % 4]);
      panel(
        out,
        'glass',
        base,
        side + 0.085,
        end - 0.085,
        0.62,
        3.54,
        0.1,
        i % 4 === 0 ? colors.backdrop : colors.lower,
      );
      if (level > 1) {
        for (const y of [5.34, 7.2, 10.75, 11.2, 13.22]) {
          fbox(out, 'frame', lobby, side, end, y, y + 0.085, 0.12, 0.19, colors.metal);
        }
        fbox(out, 'frame', base, side, side + 0.115, 0.55, 3.75, 0.1, 0.22, colors.metal);
      }
      if (level > 2 && i % 2 === 0) {
        fbox(
          out,
          'frame',
          base,
          x + cell * 0.51,
          x + cell * 0.55,
          1.2,
          2.13,
          0.11,
          0.24,
          colors.bronze,
        );
      }
    }
  }
  for (let i = 0; i <= bays; i += level === 0 ? 2 : 1) {
    const x = i * cell;
    fbox(out, 'frame', lobby, x - 0.075, x + 0.075, 4.87, 13.49, 0.078, 0.5, colors.bronze);
    if (level > 1 && i > 0 && i < bays) {
      tri(
        out,
        'frame',
        lobby.P(x - 0.072, 4.9, 0.51),
        lobby.P(x + 0.075, 4.9, 0.51),
        lobby.P(x - 0.011, 4.48, 0.18),
        colors.bronze,
      );
    }
  }
}

function longSideWindows(out, level) {
  if (level === 0) return;
  for (const x of [-20.69, 22.44]) {
    const side = facade([x, -12.8], [0, -Math.sign(x)]);
    const count = level > 1 ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * 56) / count - 28;
      for (const [low, high] of [
        [2, 3.24],
        [6.5, 9.66],
      ]) {
        panel(out, 'glass', side, u - 1.18, u + 1.18, low, high, 0.055, colors.glazing[i % 4]);
      }
      if (level > 1) {
        fbox(out, 'stone', side, u - 1.46, u + 1.46, 6.28, 6.5, 0, 0.22, colors.light);
      }
    }
  }
}

function roofs(out, level) {
  const blocks = [
    [auditorium, 15.15, plan.dimensions.auditoriumHeightM, colors.warm],
    [stage, 15.15, plan.dimensions.stageTowerHeightM, colors.limestone],
    [northWing, -1.95, plan.dimensions.serviceWingHeightM, colors.warm],
    [southWing, -1.95, plan.dimensions.serviceWingHeightM, colors.warm],
  ];
  for (const [part, y0, y1, tint] of blocks) {
    const ring = outwardRing(part.points);
    volume(out, 'stone', ring, y0, y1 - 0.19, tint);
    volume(out, 'stone', ring, y1 - 0.19, y1, colors.light, 'roof', colors.roof);
    if (level === 0) continue;
    for (let i = 0; i < ring.length; i++) {
      const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
      if (f.length < 9.7) continue;
      const pitch = part === stage ? 4.7 : 3.8;
      const count = Math.max(2, Math.round(f.length / pitch));
      for (let n = 0; n < count; n++) {
        const u = ((n + 0.5) * f.length) / count;
        panel(
          out,
          'glass',
          f,
          u - 0.57,
          u + 0.57,
          y1 - 4.7,
          part === auditorium ? y1 - 1.63 : y1 - 1.94,
          0.06,
          colors.lower,
        );
        if (level > 1 && part !== auditorium) {
          fbox(out, 'stone', f, u - 0.74, u + 0.74, y1 - 4.79, y1 - 4.6, 0, 0.21, colors.light);
        }
      }
    }
  }
  if (level > 1) {
    block(out, 'roof', [-10.0, 28.65, -41.2], [-6.12, 29.35, -30.2], colors.metal);
    block(out, 'roof', [5.3, 28.65, -39.5], [8.2, 29.2, -29.7], colors.metal);
    block(out, 'roof', [4.4, 17.97, -16.6], [8.6, 18.64, -6.4], colors.roof);
  }
}

function build(out, level) {
  plazaLobby(out, level);
  longSideWindows(out, level);
  roofs(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'dnipro-opera-and-ballet-theatre-model.mjs';
const camera = [59, 36, 79];
const lookAt = [0, 11.1, -20.4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Dnipro Opera and Ballet Theatre',
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Dnipro’s 1974 theatre with its overhanging glazed gallery, horizontal stone cladding and taller stage house.',
  camera,
  lookAt,
  sunDirection: [-27, 62, 49],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis: 'Native opera-house multipolygon and stepped service footprint.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'concrete_panel', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-entrance-and-glazed-gallery', position: [-39, 6.5, 76], lookAt: [0, 8, 19] },
    { name: 'auditorium-and-stage-house', position: [74, 43, -19], lookAt: [0, 13, -15] },
    { name: 'rear-service-wings', position: [-48, 31, -108], lookAt: [0, 10, -45] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'dnipro-opera-and-ballet-theatre-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.294, surfaces },
      street: { export: 'street', errorMeters: 0.106, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.049, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, native map under ODbL, and Mapzen open elevation tiles under their published attribution.',
};
