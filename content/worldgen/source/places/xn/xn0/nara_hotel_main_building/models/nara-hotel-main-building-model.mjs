import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
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
const colors = {
  plaster: rgb('dfd9cc'),
  wood: rgb('665247'),
  skirting: rgb('957157'),
  stone: rgb('9a8f7c'),
  roof: rgb('646a68'),
  ridge: rgb('4f5755'),
  shadow: rgb('3f3931'),
  glass: rgb('455350'),
  light: rgb('c8b393'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  cladding: { slot: 'trim', graph: 'wood_plain', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
};
const outline = frame.geometry.outline;
const wallRing = outwardRing([
  ...outline.slice(0, 7),
  [outline[7][0], outline[9][1]],
  ...outline.slice(9, 18),
  ...outline.slice(20),
]);
const eaves = plan.dimensions.mainEavesM;
const lowerEaves = plan.dimensions.mainLowerEavesM;

function panel(out, slot, face, x0, x1, y0, y1, d, color) {
  quad4(
    out,
    slot,
    face.P(x0, y0, d),
    face.P(x1, y0, d),
    face.P(x1, y1, d),
    face.P(x0, y1, d),
    color,
  );
}

function row(out, face, center, width, y, height, level) {
  if (level < 2) {
    const x = center - width / 2;
    if (level === 1)
      panel(
        out,
        'wood',
        face,
        x - 0.11,
        x + width + 0.11,
        y - 0.1,
        y + height + 0.1,
        0.031,
        colors.wood,
      );
    panel(out, 'glass', face, x, x + width, y, y + height, 0.053, colors.glass);
    return;
  }
  opening(out, face, center, y, width, height, {
    glass: colors.glass,
    frameSlot: 'wood',
    frame: colors.wood,
    frameWidth: 0.12,
    frameDepth: 0.17,
    d: 0.062,
    mullions: level === 3 ? 1 : 0,
    transoms: 1,
    mullionColor: colors.wood,
  });
}

function mainFacades(out, level) {
  extrude(out, 'base', wallRing, -4.25, 0.37, colors.stone, { top: false });
  extrude(out, 'wall', wallRing, 0.37, eaves, colors.plaster, { top: false });
  const annex = outwardRing(outline.slice(17, 21));
  extrude(out, 'base', annex, -1.4, 0.37, colors.stone, { top: false });
  extrude(out, 'wall', annex, 0.37, 4.42, colors.plaster, { top: false });
  for (const [i, a] of annex.entries()) {
    const f = wallFace(a, annex[(i + 1) % annex.length]);
    if ((a[0] + annex[(i + 1) % annex.length][0]) / 2 < 97) continue;
    for (const t of [0.26, 0.51, 0.77]) row(out, f, f.length * t, 1.18, 1.23, 1.89, level);
  }
  for (const [i, a] of wallRing.entries()) {
    const b = wallRing[(i + 1) % wallRing.length];
    const f = wallFace(a, b);
    if (f.length < 2.7) continue;
    const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const annexJoin = mx > 96.8 && mz > 20.65 && mz < 30.81;
    const porchWall = mx > 2.05 && mx < 14.7 && mz > 18.79 && mz < 18.85;
    if (level > 0) panel(out, 'wood', f, 0, f.length, 0.42, 0.73, 0.036, colors.wood);
    if (level > 0) {
      panel(out, 'cladding', f, 0, f.length, 4.46, 5.23, 0.028, colors.skirting);
      for (const y of [4.3, 5.23, 7.76]) {
        panel(out, 'wood', f, 0, f.length, y, y + 0.155, 0.055, colors.wood);
      }
    }
    if (porchWall || annexJoin) continue;
    const n = Math.max(1, Math.round(f.length / [7.0, 3.67, 4.0, 3.67][level]));
    if (level === 0 && f.length < 8.0) continue;
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.51) * f.length) / n;
      const w = Math.min(1.35, (f.length / n) * 0.42);
      row(out, f, x, w, 1.28, 2.01, level);
      row(out, f, x, w, 5.39, 1.89, level);
      if (level === 0) continue;
      const p = (j * f.length) / n + 0.064;
      const ymax = eaves - 0.45;
      panel(out, 'wood', f, p - 0.074, p + 0.074, 0.35, ymax, 0.078, colors.wood);
      if (level > 1 && f.length / n > 3.4) {
        const q = p + (f.length / n) * 0.78;
        panel(out, 'wood', f, q - 0.051, q + 0.051, 5.23, eaves - 0.5, 0.064, colors.wood);
      }
    }
  }
}

function upFacing(out, a, b, c, d, color) {
  const ab = [b[0] - a[0], b[2] - a[2]];
  const ac = [c[0] - a[0], c[2] - a[2]];
  if (ab[1] * ac[0] - ab[0] * ac[1] > 0) {
    tri(out, 'tile', a, b, c, color);
    tri(out, 'tile', a, c, d, color);
  } else {
    tri(out, 'tile', a, c, b, color);
    tri(out, 'tile', a, d, c, color);
  }
}

function irimoya(out, rect, base, peak, level, turn = false) {
  const [x0, x1, z0, z1] = rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const length = (turn ? z1 - z0 : x1 - x0) / 2;
  const span = (turn ? x1 - x0 : z1 - z0) / 2;
  const rise = peak - base;
  const hip = Math.min(length * 0.27, span * 0.33);
  const point = (u, y, v) => (turn ? [cx - v, y, cz + u] : [cx + u, y, cz + v]);
  const outer = level < 2 ? [-1, 1] : [-1, -0.63, 0.63, 1];
  const profile = level < 2 ? [0, 0.4, 1] : [0, 0.23, 0.4, 0.67, 1];
  const topWidth = length - hip;
  const height = (u, t) =>
    base + rise * (0.69 * t + 0.31 * t * t) + 0.41 * Math.pow(Math.abs(u), 4) * (1 - t);
  function strip(u, t, side) {
    const room = length - hip * Math.min(1, t / 0.4);
    const v = span * (1 - t) * side;
    return point(u * room, height(u, t), v);
  }
  for (const side of [-1, 1]) {
    for (let k = 1; k < outer.length; k++) {
      const a = outer[k - 1],
        b = outer[k];
      for (let j = 1; j < profile.length; j++) {
        const p = profile[j - 1],
          q = profile[j];
        upFacing(
          out,
          strip(a, p, side),
          strip(b, p, side),
          strip(b, q, side),
          strip(a, q, side),
          colors.roof,
        );
      }
      if (level > 0) {
        const dent = ([x, y, z]) => [x, y - 0.12, z];
        beam(
          out,
          'wood',
          dent(strip(a, 0, side)),
          dent(strip(b, 0, side)),
          0.17,
          0.18,
          colors.shadow,
        );
      }
    }
  }
  for (const side of [-1, 1]) {
    const lowLeft = strip(side, 0, -1),
      lowRight = strip(side, 0, 1);
    const gableLeft = strip(side, 0.4, -1),
      gableRight = strip(side, 0.4, 1);
    const ridge = point(side * topWidth, peak, 0);
    upFacing(out, lowLeft, lowRight, gableRight, gableLeft, colors.roof);
    if (side === -1) tri(out, 'wall', gableLeft, gableRight, ridge, colors.plaster);
    else tri(out, 'wall', gableRight, gableLeft, ridge, colors.plaster);
    if (level > 0) {
      for (const edge of [gableLeft, gableRight]) {
        beam(out, 'tile', edge, ridge, 0.2, 0.18, colors.ridge);
      }
      const step = level === 3 ? 0.24 : 0.39;
      beam(
        out,
        'tile',
        ridge,
        point(side * (topWidth + 0.15), peak + step, 0),
        0.25,
        0.28,
        colors.ridge,
      );
      if (level > 1) {
        beam(
          out,
          'tile',
          point(side * (topWidth + 0.15), peak + step, 0),
          point(side * (topWidth + 0.44), peak + 0.69, 0),
          0.25,
          0.27,
          colors.ridge,
        );
      }
    }
  }
  beam(out, 'tile', point(-topWidth, peak, 0), point(topWidth, peak, 0), 0.27, 0.32, colors.ridge);
}

function roofSet(out, level) {
  const volumes = [
    [[-40.5, -10.5, -6.5, 18.45], eaves, 13.43, false],
    [[-13.45, 6.0, 1.65, 18.35], eaves, 12.4, false],
    [[-3.8, 2.78, 16.13, 31.44], eaves, 11.5, true],
    [[2.84, 17.24, -10.43, 21.15], eaves, plan.dimensions.mainRoofRidgelineM, true],
    [[12.95, 30.08, -4.48, 17.0], eaves, 12.66, false],
    [[27.13, 48.12, 1.65, 26.63], eaves, 13.0, true],
    [[46.92, 75.03, 4.84, 26.63], eaves, 12.97, false],
    [[73.02, 98.04, 13.65, 35.58], eaves, 12.77, false],
    [[95.97, 108.83, 19.59, 31.83], 4.42, 8.1, false],
  ];
  for (const [extent, base, top, turned] of volumes) irimoya(out, extent, base, top, level, turned);
  if (level > 0) {
    for (const [x, z] of [
      [-25.3, -5.85],
      [-4.5, 2.15],
      [33.98, 2.15],
      [62.27, 5.4],
      [89.1, 14.17],
    ]) {
      irimoya(out, [x - 1.62, x + 1.62, z, z + 3.8], 8.92, 10.76, level === 1 ? 0 : 1, true);
    }
  }
  for (const [i, a] of wallRing.entries()) {
    const b = wallRing[(i + 1) % wallRing.length];
    const f = wallFace(a, b);
    if (f.length < 2.7) continue;
    if ((a[0] + b[0]) / 2 > 97) continue;
    const g = (x, d) => f.P(x, lowerEaves + 0.56 - 0.49 * d, d);
    const end = level === 0 ? 0.56 : 0.88;
    upFacing(out, g(0, end), g(f.length, end), g(f.length, 0), g(0, 0), colors.roof);
    if (level > 1) {
      const count = Math.max(1, Math.round(f.length / 1.3));
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * f.length) / count;
        fbox(
          out,
          'wood',
          f,
          x - 0.059,
          x + 0.059,
          lowerEaves + 0.005,
          lowerEaves + 0.087,
          0.14,
          end + 0.03,
          colors.light,
        );
      }
    }
  }
}

function entrance(out, level) {
  const x0 = 2.25,
    x1 = 14.45,
    z0 = 18.88,
    z1 = 28.79,
    cx = (x0 + x1) / 2;
  abox(out, 'base', [x0, 0.03, z0], [x1, 0.37, z1 + 0.29], colors.stone);
  for (let i = 0; i < 4; i++) {
    const z = z1 + 1.27 - i * 0.25;
    abox(out, 'base', [x0 + 0.57, -0.1, z - 0.28], [x1 - 0.58, 0.09 + i * 0.086, z], colors.stone);
  }
  for (const x of [x0 + 0.49, x1 - 0.47]) {
    for (const z of [z0 + 1.28, z1 - 0.47]) {
      abox(out, 'base', [x - 0.33, 0.32, z - 0.32], [x + 0.33, 0.82, z + 0.32], colors.stone);
      abox(out, 'wood', [x - 0.19, 0.77, z - 0.19], [x + 0.19, 5.31, z + 0.19], colors.wood);
      if (level > 0)
        for (const y of [4.62, 4.93]) {
          abox(out, 'wood', [x - 0.56, y, z - 0.4], [x + 0.56, y + 0.22, z + 0.4], colors.wood);
        }
    }
  }
  abox(out, 'wood', [x0, 4.87, z1 - 0.62], [x1, 5.15, z1 - 0.28], colors.wood);
  irimoya(
    out,
    [x0 - 0.85, x1 + 0.85, z0 - 0.24, z1 + 0.77],
    5.04,
    plan.dimensions.entranceRoofRidgelineM - 1.77,
    level,
    true,
  );
  const f = facade([0, z1 + 0.64], [1, 0]);
  const r = (u) =>
    0.31 * Math.pow(Math.abs(u), 3.25) + 0.84 * Math.pow(Math.cos((u * Math.PI) / 2), 2);
  const mantle = level === 0 ? [-1, 0, 1] : [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  for (let i = 1; i < mantle.length; i++) {
    const u = mantle[i - 1],
      v = mantle[i];
    const a = cx + u * 4.15,
      b = cx + v * 4.15;
    const y = 5.28 + r(u),
      h = 5.28 + r(v);
    quad4(out, 'wood', f.P(a, 5.09), f.P(b, 5.09), f.P(b, h), f.P(a, y), colors.wood);
    beam(out, 'tile', f.P(a, y + 0.12, 0.08), f.P(b, h + 0.12, 0.08), 0.18, 0.19, colors.ridge);
  }
  const doors = facade([0, z0], [1, 0]);
  if (level > 0) {
    for (const u of [-1, 1]) row(out, doors, cx + u, 1.44, 0.52, 2.91, level);
  } else panel(out, 'wood', doors, cx - 1.8, cx + 1.8, 0.5, 3.43, 0.057, colors.shadow);
}

function build(out, level) {
  mainFacades(out, level);
  roofSet(out, level);
  entrance(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'nara-hotel-main-building-model.mjs';
const camera = [109, 37, 133];
const lookAt = [32, 5.4, 10];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1909 timber hotel with a carriage porch and staggered, tiled wings on the crest of Daijoin Garden.',
  camera,
  lookAt,
  sunDirection: [28, 60, 53],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Historic wing extracted from the native hotel outline at the modern west-wing join.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_ashlar', 'tile_ceramic', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'carriage-court-and-irimoya-roofs', position: [45, 11, 85], lookAt: [19, 5.4, 15] },
    { name: 'carriage-porch-and-timber-grid', position: [17, 5.5, 51], lookAt: [8.8, 4.1, 25.7] },
    { name: 'pond-side-wing-profile', position: [30, 15, -84], lookAt: [25, 4.6, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'nara-hotel-main-building-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.38, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap outline under ODbL, and Geospatial Information Authority of Japan elevation data.',
};
