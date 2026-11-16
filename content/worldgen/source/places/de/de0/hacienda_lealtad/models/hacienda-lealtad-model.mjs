/** Timber and masonry coffee estate in the Lares hills. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grid = read('terrain-grid.json');
const surfaces = {
  timber: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.91, metallic: 0 },
  joinery: { slot: 'trim', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97, metallic: 0 },
  brick: { slot: 'door', graph: 'brick_flemish', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87, metallic: 0.13 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    boards: 'a27d56',
    warm: 'b69469',
    darkWood: '60483a',
    railing: '715139',
    railLight: '896649',
    grey: '888d87',
    greenGrey: '747d76',
    steel: '686d69',
    brick: 'a0654c',
    stone: '77736a',
    footing: '807464',
    joints: '433b33',
    glass: '455051',
    terrace: 'a27358',
  }).map(([name, value]) => [name, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
function ground(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = grid.heightsMeters[j],
    b = grid.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function surface(y, a, b, c, d) {
  return [
    [a, y[0], b],
    [a, y[1], d],
    [c, y[2], d],
    [c, y[3], b],
  ];
}

function foundation(out, x0, x1, z0, z1, top, color) {
  const lower = (x, z) => Math.min(top - 0.08, ground(x, z) - 0.44);
  const foot = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  for (let i = 0; i < foot.length; i++) {
    const [ax, az] = foot[i],
      [bx, bz] = foot[(i + 1) % foot.length];
    face(
      out,
      'stone',
      [
        [ax, lower(ax, az), az],
        [ax, top, az],
        [bx, top, bz],
        [bx, lower(bx, bz), bz],
      ],
      color,
    );
  }
}

function gable(out, x0, x1, z0, z1, wallTop, rise, lod, roofColor, sideColor) {
  const c = (x0 + x1) / 2;
  const ridgeY = wallTop + rise;
  const eave = wallTop - 0.06;
  const roofThickness = 0.22;
  const a = [x0, eave, z0],
    b = [x0, eave, z1],
    d = [x1, eave, z1],
    e = [x1, eave, z0];
  const i = [c, ridgeY, z0],
    j = [c, ridgeY, z1];
  face(out, 'roof', [a, b, j, i], roofColor);
  face(out, 'roof', [i, j, d, e], roofColor);
  for (const [start, end] of [
    [a, b],
    [d, e],
  ]) {
    box(
      out,
      'joinery',
      [start[0] - 0.067, eave - roofThickness, Math.min(start[2], end[2])],
      [start[0] + 0.067, eave - 0.025, Math.max(start[2], end[2])],
      colors.darkWood,
    );
  }
  triangle(out, 'timber', [a, i, e], sideColor);
  triangle(out, 'timber', [b, d, j], sideColor);
  if (lod > 0) {
    for (const [m, n] of [
      [a, i],
      [i, e],
      [b, j],
      [j, d],
    ])
      beam(out, 'joinery', m, n, 0.11, 0.18, colors.darkWood);
    beam(out, 'roof', [c, ridgeY + 0.02, z0], [c, ridgeY + 0.02, z1], 0.14, 0.13, colors.steel);
  }
}

function framedOpening(out, x, y, z, width, height, lod, shutters) {
  const w = width / 2;
  const e = y + height;
  box(out, 'inset', [x - w, y, z - 0.04], [x + w, e, z + 0.07], colors.glass);
  if (lod === 0) return;
  for (const side of [-1, 1]) {
    const a = x + side * (w + 0.045);
    box(
      out,
      'joinery',
      [a - 0.047, y - 0.05, z - 0.035],
      [a + 0.047, e + 0.06, z + 0.103],
      colors.darkWood,
    );
    if (shutters) {
      const x0 = Math.min(a, a + side * width * 0.34),
        x1 = Math.max(a, a + side * width * 0.34);
      box(out, 'joinery', [x0, y + 0.02, z + 0.04], [x1, e - 0.02, z + 0.112], colors.railLight);
      if (lod > 1)
        for (let j = 1; j <= [0, 0, 4, 10][lod]; j++) {
          const yy = y + 0.11 + ((height - 0.22) * j) / ([0, 0, 4, 10][lod] + 1);
          box(
            out,
            'joinery',
            [x0 + 0.06, yy, z + 0.109],
            [x1 - 0.05, yy + 0.021, z + 0.133],
            colors.darkWood,
          );
        }
    }
  }
  for (const yy of [y - 0.06, e + 0.045])
    box(
      out,
      'joinery',
      [x - w - 0.12, yy, z - 0.04],
      [x + w + 0.12, yy + 0.073, z + 0.117],
      colors.darkWood,
    );
}

function balcony(out, z0, z1, x0, x1, y, roof, lod, isMain) {
  box(out, 'joinery', [x0, y - 0.18, z0], [x1, y, z1], colors.darkWood);
  const posts = isMain ? 6 : 5;
  for (let i = 0; i <= posts; i++) {
    const z = mix(z0 + 0.11, z1 - 0.11, i / posts);
    const w = lod > 1 ? 0.09 : 0.125;
    box(
      out,
      'joinery',
      [x0 + 0.08 - w, y - 0.08, z - w],
      [x0 + 0.08 + w, roof - 0.08, z + w],
      colors.railing,
    );
    if (lod > 1 && i > 0 && i < posts) {
      const sign = i % 2 === 0 ? 1 : -1;
      beam(
        out,
        'joinery',
        [x0 + 0.08, roof - 0.58, z],
        [x0 + 0.08, roof - 0.2, z + sign * 0.41],
        0.085,
        0.083,
        colors.railing,
      );
    }
  }
  for (const y0 of [y + 0.25, y + 0.88]) {
    box(out, 'joinery', [x0 - 0.025, y0, z0], [x0 + 0.21, y0 + 0.095, z1], colors.railLight);
    for (const z of [z0, z1 - 0.15])
      box(out, 'joinery', [x0, y0, z], [x1, y0 + 0.095, z + 0.15], colors.railing);
  }
  if (lod > 0) {
    const div = Math.ceil((z1 - z0) / (lod === 1 ? 1.22 : lod === 2 ? 0.44 : 0.29));
    for (let i = 1; i < div; i++) {
      const z = mix(z0, z1, i / div);
      box(
        out,
        'joinery',
        [x0 + 0.045, y + 0.28, z - 0.029],
        [x0 + 0.115, y + 0.9, z + 0.029],
        colors.railing,
      );
    }
  }
}

function building(out, range, lod) {
  const ring = frame.features.find((f) => f.id === 'way/' + range.way).points;
  const [x0, z0] = [0, 1].map((k) => Math.min(...ring.map((p) => p[k])));
  const [x1, z1] = [0, 1].map((k) => Math.max(...ring.map((p) => p[k])));
  const x = (x0 + x1) * 0.5,
    z = (z0 + z1) * 0.5;
  const main = range.kind === 'house',
    store = range.kind === 'store',
    two = range.stories === 2;
  const foot = ground(x0 + 0.7, z) + 0.22;
  const upper = two
    ? Math.max(foot + 2.85, ground(x1 - 0.7, z) + 0.41)
    : Math.max(foot + 0.64, ground(x1 - 0.7, z) + 0.38);
  const top = upper + (main ? 2.89 : two ? 2.55 : 2.48);
  const faceX = x0 + Math.max(0.48, range.porchDepth);
  const east = x1 - 0.5,
    near = z0 + 0.63,
    far = z1 - 0.6;
  const board = main ? colors.boards : colors.warm;
  foundation(out, faceX, east, near, far, two ? upper - 0.15 : upper, colors.stone);
  if (two) box(out, 'brick', [faceX, upper - 0.25, near], [east, upper + 0.14, far], colors.brick);
  box(
    out,
    store ? 'stone' : 'timber',
    [faceX, upper - 0.02, near],
    [east, top - 0.055, far],
    store ? colors.footing : board,
  );
  if (range.porchDepth > 0) {
    balcony(out, z0 + 0.26, z1 - 0.22, x0 + 0.32, faceX + 0.1, upper + 0.1, top, lod, main);
    if (lod > 0) {
      for (const zPost of [
        z0 + 0.55,
        z0 + 0.28 * (z1 - z0),
        z0 + 0.51 * (z1 - z0),
        z0 + 0.73 * (z1 - z0),
        z1 - 0.5,
      ]) {
        const xPost = x0 + 0.52;
        const bottom = ground(xPost, zPost) - 0.13;
        if (bottom < upper - 0.14)
          box(
            out,
            'brick',
            [xPost - 0.27, bottom, zPost - 0.27],
            [xPost + 0.27, upper - 0.12, zPost + 0.27],
            colors.brick,
          );
      }
    }
  }
  gable(out, x0, x1, z0, z1, top, range.ridge, lod, main ? colors.grey : colors.greenGrey, board);
  if (!lod) return;
  const westFacade = transform(out, -Math.PI / 2, [faceX, 0, z]);
  const eastFacade = transform(out, Math.PI / 2, [east, 0, z]);
  const bays = two ? 5 : lod > 1 && z1 - z0 > 8 ? 3 : 2;
  for (let i = 0; i < bays; i++) {
    const p = mix(-(far - near) * 0.5, (far - near) * 0.5, (i + 0.5) / bays);
    const middle = two && i === Math.floor(bays / 2);
    const width = middle ? 1.23 : 1.02;
    const sill = upper + (middle ? 0.15 : 0.9);
    framedOpening(westFacade, p, sill, 0.025, width, middle ? 2.03 : 1.12, lod, !middle);
    if (lod > 1) framedOpening(eastFacade, p, upper + 0.83, 0.025, 0.92, 1.04, lod, i % 2 === 0);
    if (two) {
      const y0 = Math.max(upper - 2.56, ground(faceX, z + p) + 0.11);
      const height = upper - 0.37 - y0;
      if (height > 0.77)
        framedOpening(westFacade, p, y0, 0.034, middle ? 1.86 : 1.19, height, lod, false);
    }
  }
  if (lod > 1)
    for (const sign of [-1, 1]) {
      const side = transform(out, sign > 0 ? 0 : Math.PI, [x, 0, sign > 0 ? far : near]);
      for (const j of [-0.21, 0.22])
        framedOpening(side, j * (x1 - x0), upper + 0.91, 0.04, 0.81, 1.13, lod, true);
      if (main) {
        const r = (x0 + x1) / 2 - x;
        framedOpening(side, r, top + 0.35, 0.55, 0.61, 0.66, lod, false);
      }
    }
}

function dryingCourt(out, lod) {
  const {
    center: [x, z],
    width,
    length,
  } = plan.dryingCourt;
  const x0 = x - width / 2,
    x1 = x + width / 2,
    z0 = z - length / 2,
    z1 = z + length / 2;
  const top = ground(x1 - 0.4, z + 2) + 0.57;
  const ys = [top + 0.04, top - 0.2, top - 0.16, top + 0.08];
  const roof = surface(ys, x0, z0, x1, z1);
  face(out, 'brick', roof, colors.terrace);
  const perimeter = [...roof].reverse();
  for (let edge = 0; edge < perimeter.length; edge++) {
    const a = perimeter[edge];
    const b = perimeter[(edge + 1) % perimeter.length];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (lod > 1 ? 3.8 : 7.8));
    const point = (step) => a.map((value, axis) => mix(value, b[axis], step / count));
    const footing = ([x, y, z]) => [x, Math.min(ground(x, z) - 0.42, y - 0.055), z];
    for (let step = 0; step < count; step++) {
      const start = point(step);
      const finish = point(step + 1);
      face(out, 'stone', [footing(start), start, finish, footing(finish)], colors.footing);
    }
  }
  if (lod > 0) {
    for (const dz of [-length / 2 + 0.2, length / 2 - 0.2])
      box(
        out,
        'stone',
        [x0, top - 0.17, z + dz - 0.11],
        [x1, top + 0.2, z + dz + 0.11],
        colors.stone,
      );
    const rise = top - ground(x1 + 2.35, z - 4);
    const steps = Math.max(2, Math.min(9, Math.ceil(rise / 0.19)));
    for (let i = 0; i < steps; i++) {
      const xx = x1 + 2.35 * (i / steps);
      box(
        out,
        'stone',
        [xx, top - Math.max(0.65, rise + 0.2), z - 5.4],
        [x1 + 2.35 * ((i + 1) / steps), top - 0.16 - (Math.max(rise, 0.29) * i) / steps, z - 2.6],
        colors.footing,
      );
    }
  }
  if (lod > 1) {
    for (const portal of [-7.2, 0.6, 8.4]) {
      const p = z + portal;
      const y0 = ground(x0 - 0.1, p) + 0.08;
      if (y0 < top - 0.63) {
        box(
          out,
          'inset',
          [x0 - 0.1, y0, p - 0.48],
          [x0 - 0.025, top - 0.36, p + 0.48],
          colors.joints,
        );
        beam(
          out,
          'brick',
          [x0 - 0.14, top - 0.33, p - 0.5],
          [x0 - 0.14, top - 0.33, p + 0.5],
          0.18,
          0.26,
          colors.brick,
        );
      }
    }
  }
}

function waterWheel(out, lod) {
  if (lod === 0) return;
  const x = -10.1,
    z = 11.6,
    base = ground(x, z);
  const y = base + 1.64,
    r = 1.63,
    steps = [0, 10, 16, 24][lod];
  const at = (a, radius, level = z) => [x + radius * Math.cos(a), y + radius * Math.sin(a), level];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps,
      b = (2 * Math.PI * (i + 1)) / steps;
    for (const side of [-1, 1]) {
      const band = z + 0.24 * side;
      beam(out, 'joinery', at(a, r, band), at(b, r, band), 0.105, 0.16, colors.darkWood);
      if (i % Math.max(1, steps / 8) <= 0.05)
        beam(out, 'joinery', [x, y, band], at(a, r - 0.05, band), 0.079, 0.1, colors.railing);
    }
    if (lod > 1) {
      face(
        out,
        'joinery',
        [
          at(a, r - 0.3, z - 0.24),
          at(a, r, z - 0.24),
          at(a, r, z + 0.24),
          at(a, r - 0.3, z + 0.24),
        ],
        colors.railLight,
      );
    }
  }
  for (const k of [-1, 1]) {
    const p = z + k * 0.62;
    box(
      out,
      'brick',
      [x - 0.44, base - 0.28, p - 0.21],
      [x + 0.44, y + 0.09, p + 0.21],
      colors.footing,
    );
  }
  beam(out, 'joinery', [x, y, z - 0.83], [x, y, z + 0.83], 0.13, 0.13, colors.joints);
}

function build(out, lod) {
  for (const range of plan.ranges) building(out, range, lod);
  dryingCourt(out, lod);
  waterWheel(out, lod);
}
export const haciendaLealtadSkyline = (out) => build(out, 0);
export const haciendaLealtadDistrict = (out) => build(out, 1);
export const haciendaLealtadStreet = (out) => build(out, 2);
export const haciendaLealtadCloseup = (out) => build(out, 3);

const recipe = 'hacienda-lealtad-model.mjs';
const camera = [-74, 33, -62],
  lookAt = [-4, 5, -2];
export const haciendaLealtadModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'residence',
  build: haciendaLealtadCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    outlines: frame.geometry.polygons,
    minimumCoverage: 0.84,
    basis: 'Masks only the individually mapped roof envelopes used by the hacienda model.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Lares hillside coffee estate with a timber and brick casa grande, corrugated zinc roof, timber coffee-range balcony, stepped dependencies and a masonry glácil.',
  camera,
  lookAt,
  sunDirection: [-120, 108, -85],
  portableGroundY: -2.3,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.81,
    cameraYaw: 0.17,
    focus: { center: [-5, 6, -3] },
    groundY: -2.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'hacienda-and-drying-court-from-west', position: camera, lookAt },
    { name: 'casa-grande-porch-and-waterwheel', position: [-29, 9.5, 24], lookAt: [-4, 5, 2] },
    {
      name: 'coffee-range-and-hillside-foundations',
      position: [-30, 14, -45],
      lookAt: [0, 5, -23],
    },
    { name: 'hacienda-roofs-and-secondary-buildings', position: [35, 30, 69], lookAt: [-2, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'estate-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'haciendaLealtadSkyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'haciendaLealtadDistrict', 0.68],
        ['street', 'haciendaLealtadStreet', 0.27],
        ['closeup', 'haciendaLealtadCloseup', 0.085],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by public-domain USDA and USGS photography. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
