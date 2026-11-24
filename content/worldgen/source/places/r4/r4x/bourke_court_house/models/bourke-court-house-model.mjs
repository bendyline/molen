import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.93 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.83 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.8 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};
const plaster = rgb('d6c8ac');
const clinker = rgb('89634d');
const red = rgb('986d53');
const mortar = rgb('aa8e71');
const slate = rgb('767a77');
const grey = rgb('778083');
const pale = rgb('ccbf9e');
const wood = rgb('615b48');
const glass = rgb('464b43');
const interior = rgb('77705b');
const floor = 1.03;

function hip(out, box, eave, crest, inset, color = slate, material = 'slate') {
  const [x0, x1, z0, z1] = box;
  const points = [
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
    [x0, eave, z0],
  ];
  if (z1 - z0 > x1 - x0) points.push(points.shift());
  const [a, b, c, d] = points;
  const l = [
    a[0] + (b[0] - a[0]) * inset + (d[0] - a[0]) / 2,
    crest,
    a[2] + (b[2] - a[2]) * inset + (d[2] - a[2]) / 2,
  ];
  const r = [
    b[0] + (a[0] - b[0]) * inset + (c[0] - b[0]) / 2,
    crest,
    b[2] + (a[2] - b[2]) * inset + (c[2] - b[2]) / 2,
  ];
  quad4(out, material, a, b, r, l, color);
  tri(out, material, b, c, r, color);
  quad4(out, material, c, d, l, r, color);
  tri(out, material, d, a, l, color);
}

function rectangularWall(out, box, y0, y1, material, color) {
  abox(out, material, [box[0], y0, box[2]], [box[1], y1, box[3]], color, { bottom: false });
}

function chimney(out, x, z, base, top, level) {
  const box = [x - 0.41, x + 0.41, z - 0.32, z + 0.32];
  rectangularWall(out, box, base, top - 0.31, 'render', plaster);
  rectangularWall(out, [x - 0.49, x + 0.49, z - 0.41, z + 0.41], top - 0.31, top, 'brick', red);
  if (level >= 2) {
    const f = facade([x, z + 0.411], [1, 0]);
    for (const u of [-0.21, 0.19])
      fbox(out, 'timber', f, u - 0.09, u + 0.09, top - 0.25, top - 0.07, 0, 0.012, wood);
  }
}

function windows(out, F, windows, level) {
  for (const { u, y, width, height, round, door } of windows) {
    opening(out, F, u, y, width, height, {
      head: round ? 'round' : 'flat',
      glassSlot: 'glass',
      glass,
      frameSlot: 'brick',
      frame: red,
      frameWidth: level >= 1 ? (round ? 0.14 : 0.2) : 0,
      frameDepth: 0.09,
      sill: level >= 1 && !door,
      mullions: level >= 2 ? (round ? 3 : 1) : 0,
      transoms: level >= 2 && !door ? 1 : 0,
      mullionColor: pale,
    });
  }
}

function pavilion(out, box, options, level) {
  const { eave, roof, faces = [] } = options;
  const [x0, x1, z0, z1] = box;
  rectangularWall(out, box, -0.55, floor + 0.2, 'brick', clinker);
  rectangularWall(out, box, floor + 0.2, eave, 'render', plaster);
  rectangularWall(
    out,
    [x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06],
    eave - 0.2,
    eave - 0.02,
    'timber',
    wood,
  );
  hip(out, [x0 - 0.4, x1 + 0.4, z0 - 0.4, z1 + 0.4], eave, roof, 0.26);
  if (level === 0) return;
  for (const { z, x, sign, positions, round } of faces) {
    const F = z === undefined ? facade([x, 0], [0, -sign]) : facade([0, z], [sign, 0]);
    windows(
      out,
      F,
      positions.map((u) => ({
        u,
        y: 1.86,
        width: round ? 1.92 : 1.18,
        height: 2.23,
        round,
      })),
      level,
    );
    const low = z === undefined ? Math.min(-sign * z0, -sign * z1) : Math.min(sign * x0, sign * x1);
    const high =
      z === undefined ? Math.max(-sign * z0, -sign * z1) : Math.max(sign * x0, sign * x1);
    if (level >= 2) {
      for (const edge of [low + 0.2, high - 0.2]) {
        const steps = 6;
        for (let j = 0; j < steps; ++j) {
          const y = floor + 0.12 + ((eave - floor - 0.32) * j) / steps;
          const h = (eave - floor - 0.32) / steps;
          const w = j % 2 === 0 ? 0.24 : 0.36;
          fbox(out, 'brick', F, edge - w, edge + w, y, y + h - 0.015, 0, 0.062, red);
        }
      }
    }
  }
}

function roofVent(out, x, z, direction, level) {
  const face = z + 0.86 * direction;
  const shell = direction > 0 ? face - 1.64 : face + 1.64;
  gableRoof(out, 'slate', [x, shell], [x, face], 2.72, 9.8, 11.17, slate, {
    overhang: 0.095,
    endSlot: 'timber',
    endColor: wood,
  });
  const F = facade([x, face], [direction, 0]);
  opening(out, F, 0, 9.86, 2.21, 1.16, {
    head: 'round',
    glassSlot: 'timber',
    glass: interior,
    frameSlot: 'timber',
    frame: pale,
    frameWidth: level >= 1 ? 0.07 : 0,
    frameDepth: 0.078,
    sill: false,
  });
  if (level >= 2)
    for (const [dy, w] of [
      [0.24, 1.89],
      [0.43, 1.72],
      [0.62, 1.42],
      [0.81, 1.13],
    ])
      fbox(out, 'timber', F, -w / 2, w / 2, 9.86 + dy, 9.92 + dy, 0.057, 0.103, wood);
}

function lantern(out, x, z, base, size, level, ridgeRise) {
  const r = size / 2;
  rectangularWall(out, [x - r, x + r, z - r, z + r], base, base + 0.16, 'brick', mortar);
  const width = 0.09 + size * 0.024;
  const top = base + 0.62 + size * 0.18;
  const inset = r - 0.2;
  for (const dx of [-inset, inset]) {
    for (const dz of [-inset, inset]) {
      rectangularWall(
        out,
        [x + dx - width, x + dx + width, z + dz - width, z + dz + width],
        base + 0.13,
        top,
        'timber',
        wood,
      );
      if (level >= 1)
        rectangularWall(
          out,
          [
            x + dx - width - 0.06,
            x + dx + width + 0.06,
            z + dz - width - 0.06,
            z + dz + width + 0.06,
          ],
          top - 0.17,
          top - 0.04,
          'timber',
          pale,
        );
    }
  }
  const rim = r + 0.85;
  rectangularWall(out, [x - rim, x + rim, z - rim, z + rim], top - 0.1, top, 'timber', pale);
  hip(out, [x - rim, x + rim, z - rim, z + rim], top, top + ridgeRise, 0.46, grey, 'metal');
}

function tower(out, level) {
  const x = -17.8;
  const z = 11.91;
  const core = [x - 2.0, x + 2.0, z - 1.74, z + 1.74];
  rectangularWall(out, core, -0.45, 1.43, 'brick', clinker);
  rectangularWall(out, core, 1.43, 10.98, 'render', plaster);
  rectangularWall(out, [x - 2.07, x + 2.07, z - 1.81, z + 1.81], 10.65, 11.04, 'brick', red);
  const sides = [
    facade([x, core[3]], [1, 0]),
    facade([core[0], z], [0, 1]),
    facade([x, core[2]], [-1, 0]),
    facade([core[1], z], [0, -1]),
  ];
  for (const [index, F] of sides.entries()) {
    if (index < 2) {
      windows(
        out,
        F,
        [
          { u: 0, y: 2.04, width: 0.91, height: 2.36 },
          { u: 0, y: 8.06, width: 0.5, height: 1.14 },
        ],
        level,
      );
    }
    if (level >= 1) {
      const r = index % 2 === 0 ? 2 : 1.74;
      const count = [0, 4, 7, 12][level];
      for (const u of [-r + 0.26, r - 0.26]) {
        for (let j = 0; j < count; ++j) {
          const y = 1.44 + j * (9.2 / count);
          fbox(
            out,
            'brick',
            F,
            u - (j % 2 ? 0.19 : 0.28),
            u + (j % 2 ? 0.19 : 0.28),
            y,
            y + 9.2 / count - 0.012,
            0,
            0.066,
            red,
          );
        }
      }
    }
  }
  lantern(out, x, z, 11.02, 3.94, level, 0.68);
}

function courtyardWall(out, F, length, level) {
  if (level === 0) {
    const bay = length / 3;
    for (const u of [0, 2 * bay])
      fbox(out, 'render', F, u, u + bay, -0.13, 1.76, -0.07, 0.14, plaster);
    for (const u of [0, bay, 2 * bay])
      fbox(out, 'timber', F, u - 0.07, u + 0.07, 1.75, 4.29, -0.01, 0.14, wood);
    return;
  }
  const bays = 3;
  for (let i = 0; i < bays; ++i) {
    const u = (length * i) / bays;
    const w = length / bays;
    fbox(out, 'brick', F, u - 0.15, u + 0.15, -0.25, 2.48, -0.1, 0.21, red);
    fbox(out, 'timber', F, u - 0.074, u + 0.074, 2.34, 4.3, -0.053, 0.137, wood);
    if (i === 1) continue;
    fbox(out, 'brick', F, u + 0.16, u + w - 0.14, -0.19, 0.91, -0.08, 0.14, red);
    const steps = [4, 7, 12, 16][level];
    for (let j = 0; j < steps; ++j) {
      const t = j / steps,
        next = (j + 1) / steps;
      const a = u + 0.16 + (w - 0.3) * t,
        b = u + 0.16 + (w - 0.3) * next;
      const y0 = 2.3 - 0.95 * Math.sin(Math.PI * t),
        y1 = 2.3 - 0.95 * Math.sin(Math.PI * next);
      quad4(
        out,
        'render',
        F.P(a, 0.9, 0.13),
        F.P(b, 0.9, 0.13),
        F.P(b, y1, 0.13),
        F.P(a, y0, 0.13),
        plaster,
      );
      quad4(
        out,
        'render',
        F.P(b, 0.9, -0.07),
        F.P(a, 0.9, -0.07),
        F.P(a, y0, -0.07),
        F.P(b, y1, -0.07),
        plaster,
      );
      quad4(
        out,
        'brick',
        F.P(a, y0, 0.16),
        F.P(b, y1, 0.16),
        F.P(b, y1, -0.09),
        F.P(a, y0, -0.09),
        red,
      );
    }
  }
}

function courtroom(out, level) {
  const box = [-5.92, 12.8, -10.7, 8.37];
  rectangularWall(out, box, -0.54, floor + 0.18, 'brick', clinker);
  rectangularWall(out, box, floor + 0.1, 7.98, 'render', plaster);
  rectangularWall(out, [-6.05, 12.94, -10.8, 8.46], 7.96, 8.15, 'timber', wood);
  hip(out, [-6.7, 13.44, -11.42, 9.16], 8.2, 11.81, 0.31);
  chimney(out, -3.34, -5.45, 8.84, 12.05, level);
  chimney(out, 10.14, -6.44, 8.64, 11.18, level);
  const east = facade([0, 8.38], [1, 0]);
  const south = facade([-5.93, 0], [0, 1]);
  const west = facade([0, -10.71], [-1, 0]);
  const north = facade([12.81, 0], [0, -1]);
  for (const [F, centres] of [
    [east, [-2.85, 2.7, 8.22]],
    [west, [-9.6, -4.43, 0.83]],
    [south, [-6.54, -1.18, 4.04]],
    [north, [-4.47, 0.7, 5.7]],
  ]) {
    if (level === 0 && F !== east) continue;
    windows(
      out,
      F,
      centres.map((u) => ({ u, y: 5.66, width: 2.66, height: 2.07, round: true })),
      level === 1 && F !== east ? 0 : level,
    );
    if (level >= 2)
      for (const u of centres.flatMap((v) => [v - 1.86, v + 1.86]))
        fbox(out, 'timber', F, u - 0.1, u + 0.1, 5.45, 8.18, 0.02, 0.17, wood);
  }
  roofVent(out, 0.62, 2.37, 1, level);
  roofVent(out, 7.34, 2.37, 1, level);
  lantern(out, 3.44, -1.21, 11.4, 1.78, level, 0.52);
  if (level >= 1) {
    rectangularWall(out, [3.41, 3.48, -1.25, -1.18], 12.85, 13.65, 'metal', grey);
  }
}

function entrance(out, level) {
  const box = [-1.55, 6.79, 8.36, 13.16];
  rectangularWall(out, box, -0.42, floor + 0.16, 'brick', clinker);
  rectangularWall(out, box, floor + 0.14, 4.36, 'render', plaster);
  hip(out, [-2.02, 7.2, 8.08, 13.61], 4.41, 5.65, 0.28);
  const F = facade([0, 13.17], [1, 0]);
  windows(
    out,
    F,
    [-0.17, 2.49, 5.1].map((u) => ({ u, y: 1.42, width: 2.08, height: 2.29, round: true })),
    level,
  );
  for (const u of [-1.38, 1.14, 3.84, 6.32])
    fbox(out, 'brick', F, u - 0.105, u + 0.105, 0.05, 4.35, 0, 0.139, red);
  const steps = level >= 1 ? 5 : 2;
  for (let j = 1; j <= steps; ++j) {
    const pos = j / steps;
    abox(out, 'brick', [-1.71, 0.0, 13.15], [-0.2, pos * floor, 15.52 - pos * 2.13], mortar);
  }
}

function build(out, level) {
  pavilion(
    out,
    [-20.47, -1.71, 5.72, 14.63],
    {
      eave: 4.68,
      roof: 6.76,
      faces: [
        { z: 14.63, sign: 1, positions: [-14.05, -11.02, -7.94, -4.83] },
        { x: -20.47, sign: -1, positions: [7.64, 10.75, 13.72] },
      ],
    },
    level,
  );
  pavilion(
    out,
    [7.09, 18.03, 5.37, 14.43],
    {
      eave: 4.61,
      roof: 7.35,
      faces: [
        { z: 14.43, sign: 1, positions: [9.47, 12.13, 15.67], round: true },
        { x: 18.03, sign: 1, positions: [-7.53, -11.67] },
      ],
    },
    level,
  );
  pavilion(
    out,
    [-20.82, -6.23, -13.42, -2.95],
    {
      eave: 4.4,
      roof: 6.66,
      faces: [
        { x: -20.82, sign: -1, positions: [-10.93, -7.62, -4.64] },
        { z: -13.42, sign: -1, positions: [8.0, 12.7, 17.8] },
      ],
    },
    level,
  );
  pavilion(
    out,
    [-5.88, 19.28, -15.28, -7.7],
    {
      eave: 4.52,
      roof: 6.32,
      faces: [
        { z: -15.28, sign: -1, positions: [-15.9, -11.2, -1.3, 2.6] },
        { x: 19.28, sign: 1, positions: [9.23, 12.34] },
      ],
    },
    level,
  );
  pavilion(
    out,
    [10.76, 17.93, -7.73, 5.75],
    {
      eave: 4.42,
      roof: 6.61,
      faces: [{ x: 17.93, sign: 1, positions: [-3.81, -0.48, 3.13, 6.09] }],
    },
    level,
  );
  courtroom(out, level);
  entrance(out, level);
  tower(out, level);
  chimney(out, -14.46, -10.09, 5.65, 7.98, level);
  chimney(out, 13.09, 10.44, 6.06, 8.34, level);
  rectangularWall(out, [-20.52, -15.26, -2.93, 5.71], -0.31, floor, 'brick', clinker);
  hip(out, [-20.91, -14.95, -3.31, 6.08], 4.29, 5.52, 0.27);
  courtyardWall(out, facade([-15.24, 5.67], [0, -1]), 8.57, level);
  courtyardWall(out, facade([-15.18, -2.93], [1, 0]), 8.84, level);
  courtyardWall(out, facade([-6.4, 5.73], [-1, 0]), 8.8, level);
  courtyardWall(out, facade([-20.55, -2.93], [0, 1]), 8.68, level);
  if (level >= 2) {
    const F = facade([0, 14.64], [1, 0]);
    for (let j = 0; j < 19; ++j) {
      const u = -20.12 + j * 0.98;
      fbox(out, 'timber', F, u - 0.05, u + 0.05, 4.49, 4.73, -0.12, 0.26, pale);
    }
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'bourke-court-house-model.mjs';
const camera = [-48, 16, 49];
const lookAt = [-1.2, 5.2, -0.2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'court-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Bourke Court House with the open corner lantern, slate-roofed courtroom, its arched clerestory and open shaded courtyard.',
  camera,
  lookAt,
  sunDirection: [-28, 37, 51],
  mediumFiContext: {
    scale: 0.91,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis:
      'Replace the building envelope of OpenStreetMap relation 18988583 without altering the underlying terrain.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'oxley-richard-corner', position: camera, lookAt },
    { name: 'court-hall-and-north-pavilion', position: [28, 12.3, 43], lookAt: [1.4, 5.8, 1.5] },
    { name: 'garden-court-and-roof-plan', position: [-30, 27.5, -31], lookAt: [-3.8, 4.7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bourke-court-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.043, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on three public-domain NSW State Archives originals, OSM building geometry and open Geoscience Australia data.',
};
