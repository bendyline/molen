import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  opening,
  quad4,
  rgb,
  ribbon,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const colors = {
  wall: rgb('d3ad78'),
  side: rgb('c7a370'),
  cream: rgb('e1d5ba'),
  white: rgb('e9dfcf'),
  ashlar: rgb('a7a094'),
  sill: rgb('c7ba9e'),
  metal: rgb('504c46'),
  ridge: rgb('6b5d50'),
  crest: rgb('44372e'),
  window: rgb('57625c'),
  wood: rgb('786146'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  detail: { slot: 'trim', graph: 'plaster_lime', roughness: 0.89 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.77, metallic: 0.09 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.8 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48 },
};
const mainLeft = -12.35,
  mainRight = 11.22,
  streetFront = 20.15;
const centerLeft = -4.94,
  centerRight = 3.84,
  centerFront = 21.14;
const centerX = (centerLeft + centerRight) / 2;
const ring = frame.geometry.outline;
const center = facade([0, centerFront], [1, 0]);

function hippedRoof(out, { left, right, back, front, y, ridge, hx, hz }, level) {
  const nearLeft = [left, y, front],
    nearRight = [right, y, front],
    rearLeft = [left, y, back],
    rearRight = [right, y, back];
  const [xl, xr] = hx,
    [zb, zf] = hz;
  const topNearLeft = [xl, ridge, zf],
    topNearRight = [xr, ridge, zf],
    topRearLeft = [xl, ridge, zb],
    topRearRight = [xr, ridge, zb];
  const planes = [
    [nearLeft, nearRight, topNearRight, topNearLeft],
    [nearRight, rearRight, topRearRight, topNearRight],
    [rearRight, rearLeft, topRearLeft, topRearRight],
    [rearLeft, nearLeft, topNearLeft, topRearLeft],
  ];
  for (const [i, points] of planes.entries()) {
    quad4(out, 'roof', ...points, i === 1 ? colors.ridge : colors.metal);
    beam(out, 'roof', points[0], points[1], 0.14, 0.17, colors.ridge);
    if (level < 2) continue;
    const count =
      level === 3
        ? Math.round(Math.hypot(points[0][0] - points[1][0], points[0][2] - points[1][2]) / 0.85)
        : 6;
    for (let k = 1; k < count; k++) {
      const t = k / count;
      const edge = (a, b) => a.map((v, j) => v + (b[j] - v) * t + (j === 1 ? 0.025 : 0));
      beam(
        out,
        'roof',
        edge(points[0], points[1]),
        edge(points[3], points[2]),
        0.036,
        0.041,
        colors.ridge,
      );
    }
  }
  abox(out, 'roof', [xl, ridge - 0.035, zb], [xr, ridge + 0.1, zf], colors.metal);
}

function trim(out, f, left, right, y, height, depth, color = colors.cream) {
  fbox(out, 'detail', f, left, right, y, y + height, -0.03, depth, color);
}

function cornice(out, f, left, right, y, level) {
  trim(out, f, left, right, y - 0.32, 0.11, 0.12, colors.sill);
  trim(out, f, left - 0.1, right + 0.1, y + 0.14, 0.16, 0.36, colors.white);
  trim(out, f, left - 0.19, right + 0.19, y + 0.3, 0.17, 0.48);
  if (level < 1) return;
  const count = Math.round((right - left) / (level > 1 ? 0.53 : 1.06));
  for (let i = 0; i < count; i++) {
    const x = left + ((i + 0.5) * (right - left)) / count;
    trim(out, f, x - 0.095, x + 0.095, y - 0.12, 0.27, 0.31);
  }
}

function sash(out, f, x, base, w, h, level, arched = false, door = false) {
  if (level < 2) {
    const slot = door ? 'door' : 'glass';
    const color = door ? colors.wood : colors.window;
    const panel = (width, rise, depth, face, tint) => {
      const half = width / 2;
      const point = (u, y) => f.P(x + u, base + y, depth);
      if (arched) {
        const crown = roundArch(half, level === 0 ? 5 : 8).reverse();
        fan(
          out,
          face,
          [point(-half, 0), point(half, 0), ...crown.map(([u, y]) => point(u, rise - half + y))],
          tint,
        );
      } else {
        quad4(
          out,
          face,
          point(-half, 0),
          point(half, 0),
          point(half, rise),
          point(-half, rise),
          tint,
        );
      }
    };
    panel(w + 0.21, h + 0.13, 0.038, 'detail', colors.white);
    panel(w, h, 0.057, slot, color);
    return;
  }
  opening(out, f, x, base, w, h, {
    head: arched ? 'round' : 'flat',
    glassSlot: door ? 'door' : 'glass',
    glass: door ? colors.wood : colors.window,
    frameSlot: 'detail',
    frame: colors.white,
    frameWidth: arched ? 0.18 : 0.12,
    frameDepth: 0.17,
    sill: !door,
    mullions: level > 1 ? (door ? 3 : 2) : 0,
    transoms: level > 1 && !door ? 2 : 0,
    mullionColor: door ? colors.sill : colors.metal,
  });
  if (level >= 2 && arched) {
    trim(out, f, x - 0.13, x + 0.13, base + h + 0.06, 0.29, 0.255);
  }
}

function decoratedSideWindow(out, f, u, level) {
  sash(out, f, u, 5.79, 1.65, 3.18, level);
  if (level === 0) return;
  if (level < 2) {
    trim(out, f, u - 0.99, u + 0.99, 8.92, 0.15, 0.17);
    return;
  }
  const ornament = facade(
    f.P(0, 0, 0.01).filter((_, i) => i !== 1),
    f.along,
  );
  opening(out, ornament, u, 8.9, 2.13, 0.8, {
    head: 'tudor',
    rise: 0.43,
    glassSlot: 'wall',
    glass: colors.wall,
    frameSlot: 'detail',
    frame: colors.cream,
    frameWidth: 0.16,
    frameDepth: 0.16,
    sill: false,
  });
  trim(out, f, u - 1.18, u + 1.18, 8.89, 0.115, 0.2);
  if (level > 1) {
    for (const side of [-1, 1]) {
      const a = u + side * 1.04;
      trim(out, f, a - 0.1, a + 0.1, 8.48, 0.38, 0.29);
    }
  }
}

function historicEnvelope(out, level) {
  extrude(out, 'base', ring, -3.12, 0.55, colors.ashlar, { top: false });
  extrude(out, 'wall', ring, 0.55, 10.63, colors.wall, { top: false });
  ribbon(out, 'detail', ring, 0.55, 0.74, colors.cream, { offset: 0.065, inset: 0.04 });
  ribbon(out, 'detail', ring, 4.53, 5.17, colors.cream, { offset: 0.061, inset: 0.045 });
  hippedRoof(
    out,
    {
      left: -13.9,
      right: 11.66,
      back: -20.73,
      front: 20.66,
      y: 10.63,
      ridge: 13.21,
      hx: [-3.12, 2.55],
      hz: [-14.0, 13.4],
    },
    level,
  );
  const tail = [
    [-8.1, -23.7],
    [-8.1, -9.5],
    [8.43, -9.5],
    [8.43, -23.7],
  ];
  extrude(out, 'wall', tail, 8.13, 14.24, colors.side, { top: false });
  hippedRoof(
    out,
    {
      left: -8.28,
      right: 8.61,
      back: -23.99,
      front: -9.2,
      y: 14.24,
      ridge: 16.2,
      hx: [-3.3, 3.68],
      hz: [-18.4, -14.4],
    },
    level,
  );
  const tip = facade([0, -24.29], [-1, 0]);
  trim(out, tip, -4.35, 3.8, -0.7, 0.2, 0.2);
  for (const u of level === 0 ? [] : [-2.32, 0.22, 2.72]) {
    sash(out, tip, u, 1.14, 1.04, 1.9, level, true);
    sash(out, tip, u, 5.5, 1.06, 2.05, level, true);
  }
}

function entrance(out, level) {
  abox(
    out,
    'detail',
    [centerLeft + 0.005, 0.53, streetFront - 0.06],
    [centerRight - 0.006, 5.31, centerFront + 0.025],
    colors.cream,
  );
  for (const relative of [-2.64, 0, 2.64]) {
    const x = centerX + relative;
    sash(out, center, x, 0.51, 1.71, 3.17, level, true, true);
    sash(out, center, x, 5.69, 1.92, 4.05, level, true);
    if (level > 2) {
      fbox(out, 'glass', center, x - 0.69, x + 0.69, 1.68, 2.62, 0.083, 0.111, colors.window);
      for (const offset of [-0.51, -0.17, 0.17, 0.51])
        fbox(
          out,
          'door',
          center,
          x + offset - 0.037,
          x + offset + 0.037,
          1.68,
          2.62,
          0.113,
          0.153,
          colors.wood,
        );
    }
  }
  for (const x of [centerLeft + 0.16, centerX - 1.33, centerX + 1.33, centerRight - 0.16]) {
    trim(out, center, x - 0.145, x + 0.145, 5.47, 4.6, 0.21);
    trim(out, center, x - 0.23, x + 0.23, 5.43, 0.16, 0.27);
    trim(out, center, x - 0.24, x + 0.24, 9.78, 0.21, 0.29);
  }
  trim(out, center, centerLeft - 0.08, centerRight + 0.08, 4.49, 0.27, 0.23);
  trim(out, center, centerLeft - 0.1, centerRight + 0.1, 4.92, 0.18, 0.24, colors.white);
  trim(out, center, centerLeft - 0.17, centerRight + 0.17, 10.15, 0.55, 0.18);
  cornice(out, center, centerLeft - 0.02, centerRight + 0.02, 10.74, level);
  abox(
    out,
    'wall',
    [centerLeft - 0.16, 10.52, 17.8],
    [centerRight + 0.16, 12.18, centerFront + 0.15],
    colors.cream,
  );
  for (const [a, b, y] of [
    [centerLeft - 0.22, centerRight + 0.22, 12.11],
    [centerLeft + 0.88, centerRight - 0.88, 12.47],
    [centerLeft + 2.63, centerRight - 2.63, 13.0],
  ]) {
    trim(out, center, a, b, y - 0.04, 0.18, 0.28, colors.white);
    abox(out, 'detail', [a, y - 0.1, 20.35], [b, y + 0.21, centerFront + 0.11], colors.cream);
    abox(
      out,
      'roof',
      [a - 0.025, y + 0.18, 20.33],
      [b + 0.025, y + 0.27, centerFront + 0.14],
      colors.metal,
    );
  }
  const steps = level === 0 ? 2 : 5;
  for (let i = 0; i < steps; i++) {
    const rise = ((i + 1) * 0.52) / steps;
    abox(
      out,
      'base',
      [centerLeft + 0.29, -0.31, centerFront + 0.06],
      [centerRight - 0.29, rise, centerFront + 1.79 - (i * 1.42) / steps],
      colors.ashlar,
    );
  }
  if (level >= 2) {
    for (const x of [centerX - 1.26, centerX + 1.32]) {
      for (const [z, y] of [
        [21.85, 1.26],
        [22.73, 1.04],
      ])
        beam(out, 'rail', [x, y - 0.7, z], [x, y, z], 0.043, 0.043, colors.crest);
      beam(out, 'rail', [x, 1.27, 21.78], [x, 1.05, 22.81], 0.052, 0.05, colors.crest);
    }
  }
}

function wings(out, level) {
  for (const [front, windows] of [
    [wallFace(ring[12], ring[13]), [2.37, 5.47]],
    [wallFace(ring[16], ring[17]), [2.1, 5.13]],
  ]) {
    for (const x of windows) {
      sash(out, front, x, 1.16, 1.32, 2.83, level);
      decoratedSideWindow(out, front, x, level);
    }
    trim(out, front, 0, front.length, 4.12, 0.28, 0.15);
    trim(out, front, 0, front.length, 9.77, 0.12, 0.13);
    cornice(out, front, 0, front.length, 10.29, level);
  }
  for (const [x, dir] of [
    [mainLeft, 1],
    [mainRight, -1],
  ]) {
    const f = facade([x, 0], [0, dir]);
    for (const z of [12.6, 16.58]) {
      sash(out, f, dir * z, 1.24, 1.26, 2.55, level);
      decoratedSideWindow(out, f, dir * z, level);
    }
    if (dir === 1 && level > 0) {
      const side = wallFace(ring[9], ring[10]);
      for (const z of [4.11, 9.35, 14.96, 18.63]) {
        sash(out, side, z, 1.25, 1.35, 2.7, level, true);
        sash(out, side, z, 5.84, 1.56, 2.84, level, true);
      }
    }
    cornice(
      out,
      f,
      Math.min(dir * 10.8, dir * streetFront),
      Math.max(dir * 10.8, dir * streetFront),
      10.28,
      level,
    );
  }
  const crest = facade([0, 13.35], [1, 0]);
  if (level > 0) {
    fbox(out, 'rail', crest, -2.92, 2.54, 13.19, 13.27, -0.03, 0.03, colors.crest);
    fbox(out, 'rail', crest, -2.92, 2.54, 13.84, 13.89, -0.03, 0.03, colors.crest);
    for (let i = 0; i <= 8; i++) {
      const x = -2.9 + i * 0.68;
      fbox(out, 'rail', crest, x - 0.024, x + 0.024, 13.2, 14.02, -0.023, 0.023, colors.crest);
      if (i < 8 && level > 1) {
        const points = [
          [x, 13.52],
          [x + 0.34, 13.77],
          [x + 0.68, 13.52],
          [x + 0.34, 13.27],
        ];
        points.forEach(([u, y], j) => {
          const [v, h] = points[(j + 1) % points.length];
          beam(out, 'rail', crest.P(u, y), crest.P(v, h), 0.032, 0.032, colors.crest);
        });
      }
    }
  }
  abox(out, 'wall', [-3.53, 12.89, 12.2], [-2.76, 14.17, 13.42], colors.side);
  abox(out, 'roof', [-3.59, 14.13, 12.15], [-2.71, 14.29, 13.48], colors.ridge);
}

function build(out, level) {
  historicEnvelope(out, level);
  entrance(out, level);
  wings(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'pori-theatre-model.mjs';
const camera = [-37, 18, 57],
  lookAt = [0, 7.2, 7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
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
    'Historic Pori Theatre with the three-arched Hallituskatu façade, pale ochre side wings and tall rear stagehouse.',
  camera,
  lookAt,
  sunDirection: [-32, 51, 58],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.87,
    basis:
      'Trimmed plan of the historic theatre based on the native footprint and the modern annex boundary.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_granite', 'metal_painted', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'hallituskatu-and-original-grade', position: [-26, 12, 52], lookAt: [0, 7.4, 15] },
    {
      name: 'three-arched-doors-and-renaissance-cornice',
      position: [-10.5, 6.8, 36.2],
      lookAt: [-0.6, 6.9, 21],
    },
    { name: 'historic-roof-and-stagehouse', position: [35, 23, -36], lookAt: [0, 9.5, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'pori-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap footprint under ODbL, National Land Survey of Finland elevation under CC BY 4.0.',
};
