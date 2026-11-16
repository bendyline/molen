/** Two Sanam Chandra residences and the upper-floor passage connecting them. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const [castleOutline, redHouseOutline, passageOutline] = frame.geometry.polygons;
const dimensions = plan.dimensions;
const materials = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  masonry: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.84, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#4d4c40', roughness: 0.74, metallic: 0 },
};
const colors = {
  cream: rgb('d7c591'),
  stone: rgb('dfcda2'),
  foundation: rgb('938a75'),
  terracotta: rgb('a5382e'),
  roofShade: rgb('842e28'),
  timber: rgb('392a27'),
  red: rgb('9e4f3e'),
  redTrim: rgb('793b31'),
  glass: rgb('575753'),
};
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((value, index) => mix(value, b[index], t));
const white = 'palette:#ffffff';
const top = [0, 1, 0];
const north = [0, 0, 1];

function face(out, slot, points, normal, color) {
  const first = normalFor(...points);
  if (first.reduce((sum, value, index) => sum + value * normal[index], 0) < 0) {
    points = [...points].reverse();
  }
  const n = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      points.map(([x, y, z]) => [x + z, y]),
      color,
    );
}

function wall(out, slot, a, b, y0, y1, color) {
  const n = [b[1] - a[1], 0, a[0] - b[0]];
  return face(
    out,
    slot,
    [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ],
    n,
    color,
  );
}

function hipRoof(out, bounds, eave, ridge, inset, level) {
  const [x0, x1, z0, z1] = bounds;
  const middle = (z0 + z1) / 2;
  const a = [x0, eave, z0],
    b = [x1, eave, z0],
    c = [x1, eave, z1],
    d = [x0, eave, z1];
  const low = [x0 + inset, ridge, middle],
    high = [x1 - inset, ridge, middle];
  face(out, 'roof', [a, b, high, low], top, colors.roofShade);
  face(out, 'roof', [d, low, high, c], top, colors.terracotta);
  face(out, 'roof', [a, low, d], top, colors.terracotta);
  face(out, 'roof', [b, c, high], top, colors.terracotta);
  if (level > 0) {
    beam(out, 'roof', low, high, 0.13, 0.14, colors.roofShade);
  }
}

function transverseGable(out, x, half, z0, z1, eave, ridge, wallSlot, wallColor) {
  const a = [x - half, eave, z0],
    b = [x + half, eave, z0],
    c = [x + half, eave, z1],
    d = [x - half, eave, z1];
  const back = [x, ridge, z0],
    front = [x, ridge, z1];
  face(out, 'roof', [a, back, front, d], top, colors.terracotta);
  face(out, 'roof', [b, c, front, back], top, colors.roofShade);
  face(out, wallSlot, [d, c, front], north, wallColor);
  face(out, wallSlot, [a, back, b], [0, 0, -1], wallColor);
}

function window(out, at, width, height, normal, level, surround = 'masonry') {
  const [x, y, z] = at;
  const glass = [x + normal[0] * 0.045, y, z + normal[2] * 0.045];
  const across = [normal[2], 0, -normal[0]];
  function panel(slot, cx, bottom, span, rise, depth, color) {
    const point = (u, v, d) => [
      glass[0] + across[0] * u + normal[0] * d,
      glass[1] + v,
      glass[2] + across[2] * u + normal[2] * d,
    ];
    const pt = [
      point(cx - span / 2, bottom, depth),
      point(cx + span / 2, bottom, depth),
      point(cx + span / 2, bottom + rise, depth),
      point(cx - span / 2, bottom + rise, depth),
    ];
    face(out, slot, pt, normal, color);
  }
  const trim = surround === 'masonry' ? colors.stone : colors.redTrim;
  if (level > 0) panel(surround, 0, -0.11, width + 0.23, height + 0.22, 0, trim);
  panel('glass', 0, 0, width, height, 0.015, colors.glass);
  if (level > 1) {
    panel(surround, 0, 0, 0.085, height, 0.025, trim);
    panel(surround, 0, height * 0.66, width, 0.075, 0.025, trim);
  }
}

function turret(out, x, z, r, shaft, cap, level, base = 0.26) {
  const sides = [6, 10, 14, 18][level];
  const ring = (y, radius) => radialRing(y, radius, radius, sides, [x, z]);
  loft(out, 'plaster', [ring(base, r), ring(shaft - 0.46, r * 0.88)], colors.cream);
  loft(
    out,
    'masonry',
    [ring(shaft - 0.46, r * 0.88), ring(shaft - 0.24, r * 1.12), ring(shaft + 0.05, r * 1.16)],
    colors.stone,
  );
  loft(
    out,
    'roof',
    [ring(shaft + 0.051, r * 1.16), ring(shaft + cap * 0.47, r * 0.49), ring(shaft + cap, 0.034)],
    colors.terracotta,
  );
  if (level > 0) {
    beam(
      out,
      'wood',
      [x, shaft + cap - 0.04, z],
      [x, shaft + cap + 0.63, z],
      0.055,
      0.055,
      colors.timber,
    );
  }
}

function gate(out, level) {
  const opening = [
    [-1.04, 0.38],
    [1.04, 0.38],
    [1.04, 2.38],
    [0.67, 2.94],
    [0, 3.38],
    [-0.67, 2.94],
    [-1.04, 2.38],
  ];
  const point = ([x, y], z) => [x, y, z];
  box(out, 'plaster', [-1.52, 0.3, -0.08], [1.52, 4.58, 1.12], colors.cream);
  const apex = [0, 1.7, 1.13];
  for (let i = 0; i < opening.length; i++) {
    const a = opening[i],
      b = opening[(i + 1) % opening.length];
    face(out, 'glass', [point(a, 1.13), point(b, 1.13), apex], north, colors.timber);
    if (level > 0 && i !== 0) {
      beam(out, 'masonry', point(a, 1.2), point(b, 1.2), 0.17, 0.13, colors.stone);
    }
  }
  box(out, 'plaster', [-1.65, 4.18, -0.17], [1.65, 7.35, 1.57], colors.cream);
  for (const x of [-1.04, 0, 1.04]) window(out, [x, 5.04, 1.574], 0.79, 1.82, north, level, 'wood');
  for (const x of [-1.59, -0.54, 0.54, 1.59]) {
    box(out, 'wood', [x - 0.052, 4.2, 1.59], [x + 0.052, 7.35, 1.71], colors.timber);
  }
  for (const y of [4.34, 5.02, 6.92, 7.28]) {
    box(out, 'wood', [-1.65, y, 1.59], [1.65, y + 0.13, 1.72], colors.timber);
  }
  if (level > 0) {
    for (const x of [-1.05, 0, 1.05]) {
      beam(
        out,
        'wood',
        [x - 0.38, 4.46, 1.67],
        [x + 0.38, 4.97, 1.67],
        0.085,
        0.092,
        colors.timber,
      );
    }
  }
  transverseGable(out, 0, 1.88, -1.13, 1.92, 7.37, 9.12, 'plaster', colors.cream);
  if (level > 0) {
    beam(out, 'wood', [-1.86, 7.4, 1.94], [0, 9.13, 1.94], 0.12, 0.12, colors.timber);
    beam(out, 'wood', [0, 9.13, 1.94], [1.86, 7.4, 1.94], 0.12, 0.12, colors.timber);
  }
  for (let i = 0; i < 2; i++) {
    box(
      out,
      'masonry',
      [-1.28 - 0.12 * i, 0.2, 1.13],
      [1.28 + 0.12 * i, 0.38 - i * 0.09, 1.62 + i * 0.22],
      colors.stone,
    );
  }
}

function château(out, level) {
  const {
    chateauThreshold: floor,
    chateauUpperFloor: story,
    chateauEave: eave,
    chateauRidge: ridge,
  } = dimensions;
  box(out, 'masonry', [-9.57, -1.25, -8.62], [9.57, floor, 0.12], colors.foundation);
  box(out, 'plaster', [-9.52, floor, -8.61], [9.52, eave, -0.83], colors.cream);
  box(out, 'masonry', [-9.71, story - 0.19, -8.68], [9.71, story + 0.04, 0.42], colors.stone);
  box(out, 'masonry', [-9.79, eave - 0.22, -8.69], [9.79, eave + 0.06, 0.49], colors.stone);
  hipRoof(out, [-9.6, 9.6, -8.89, 0.25], eave + 0.04, ridge, 1.3, level);
  for (const [start, count, spacing] of [
    [-8.82, 3, 1.95],
    [2.74, 4, 1.56],
  ]) {
    for (let i = 0; i < count; i++) {
      const x = start + i * spacing;
      window(out, [x + spacing / 2, 1.3, -0.83], 0.73, 1.58, north, level);
      window(out, [x + spacing / 2, story + 0.56, -0.83], 0.75, 1.79, north, level);
      box(out, 'masonry', [x - 0.095, floor, 0.12], [x + 0.095, eave, 0.34], colors.stone);
      if (level > 0) {
        box(
          out,
          'masonry',
          [x - 0.18, story + 0.88, 0.08],
          [x + 0.18, story + 1.02, 0.39],
          colors.stone,
        );
        box(out, 'masonry', [x - 0.13, eave, 0.13], [x + 0.13, eave + 0.67, 0.37], colors.stone);
        box(
          out,
          'masonry',
          [x, story + 0.79, 0.19],
          [x + spacing, story + 0.9, 0.35],
          colors.stone,
        );
        for (let j = 1; j < (level > 1 ? 6 : 3); j++) {
          const v = x + (j * spacing) / (level > 1 ? 6 : 3);
          box(
            out,
            'masonry',
            [v - 0.045, story + 0.04, 0.22],
            [v + 0.045, story + 0.79, 0.31],
            colors.stone,
          );
        }
      }
    }
  }
  for (const side of level > 0 ? [-1, 1] : []) {
    for (const z of [-6.45, -4.53, -2.65]) {
      window(out, [side * 9.52, 1.27, z], 0.87, 1.73, [side, 0, 0], level);
      window(out, [side * 9.52, 4.96, z], 0.87, 1.75, [side, 0, 0], level);
    }
  }
  for (const x of level > 0 ? [-7.55, -4.65, 3.62, 6.64] : [-5, 5]) {
    window(out, [x, 1.18, -8.62], 0.95, 1.79, [0, 0, -1], level);
    window(out, [x, 5.01, -8.62], 0.95, 1.79, [0, 0, -1], level);
  }
  turret(out, -9.05, -0.12, 0.66, 8.41, 1.57, level);
  turret(out, 9.1, -0.32, 1.12, 9.17, 1.45, level);
  turret(out, -2.22, -0.68, 0.94, 10.35, 3.43, level);
  box(out, 'plaster', [1.35, floor, -1.55], [3.22, 10.47, 0.98], colors.cream);
  transverseGable(out, 2.28, 1.07, -1.71, 1.14, 10.46, 12.27, 'plaster', colors.stone);
  for (const y of [8.14, 10.3])
    box(out, 'masonry', [1.26, y, -1.63], [3.29, y + 0.14, 1.07], colors.stone);
  window(out, [2.28, 8.82, 0.99], 0.44, 0.9, north, level);
  gate(out, level);
  // The rear landing is physically continuous with the deck of the roofed bridge.
  box(out, 'wood', [-2.81, story - 0.19, -8.86], [0.5, story + 0.02, -8.28], colors.redTrim);
}

function timberResidence(out, level) {
  const { maleeThreshold: floor, maleeUpperFloor: upper, maleeEave: eave } = dimensions;
  const winding = redHouseOutline;
  for (let i = 0; i < winding.length; i++) {
    const a = winding[i],
      b = winding[(i + 1) % winding.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const normal = [(b[1] - a[1]) / length, 0, (a[0] - b[0]) / length];
    wall(out, 'masonry', a, b, 2.4, floor, colors.foundation);
    wall(out, 'wood', a, b, floor, eave, colors.red);
    const bays = Math.ceil(length / (level > 0 ? 2.45 : 4.9));
    for (let j = 0; j < bays; j++) {
      const [x, z] = between(a, b, (j + 0.5) / bays);
      if (i === 0) continue;
      if (level > 0) window(out, [x, floor + 0.6, z], 0.96, 1.66, normal, level, 'wood');
      window(out, [x, upper + 0.49, z], 1.03, 1.74, normal, level, 'wood');
    }
    if (level > 0) {
      for (const y of [upper - 0.1, eave - 0.19]) {
        beam(out, 'wood', [a[0], y, a[1]], [b[0], y, b[1]], 0.12, 0.16, colors.redTrim);
      }
    }
  }
  hipRoof(out, [-9.18, 0.66, -82.56, -65.72], eave, 13.45, 2.82, level);
  hipRoof(out, [-16.0, 8.03, -78.62, -71.14], eave - 0.27, 12.26, 2.65, level);
  transverseGable(out, -2.83, 2.55, -72.14, -65.64, eave + 0.06, 11.86, 'wood', colors.redTrim);
}

function coveredPassage(out, level) {
  // Each station uses the opposing surveyed edge. The west edge changes heading near the château.
  const [southWest, bendWest, northWest, northEast, southEast] = passageOutline;
  const bendFraction = (northWest[1] - bendWest[1]) / (northWest[1] - southWest[1]);
  const bendEast = between(northEast, southEast, bendFraction);
  const stations = [
    [northWest, northEast, 0],
    [bendWest, bendEast, bendFraction],
    [southWest, southEast, 1],
  ];
  const height = (t) => mix(dimensions.bridgeDeckNorth, dimensions.bridgeDeckSouth, t);
  const p = (edge, y) => [edge[0], y, edge[1]];
  for (let i = 1; i < stations.length; i++) {
    const [a, b, t0] = stations[i - 1],
      [c, d, t1] = stations[i];
    const y0 = height(t0),
      y1 = height(t1);
    face(out, 'wood', [p(a, y0), p(b, y0), p(d, y1), p(c, y1)], top, colors.redTrim);
    const middle0 = p(between(a, b, 0.5), y0 + 3.77);
    const middle1 = p(between(c, d, 0.5), y1 + 3.77);
    face(out, 'roof', [p(a, y0 + 2.58), middle0, middle1, p(c, y1 + 2.58)], top, colors.terracotta);
    face(out, 'roof', [p(b, y0 + 2.58), p(d, y1 + 2.58), middle1, middle0], top, colors.roofShade);
    for (const [near, far, sign] of [
      [a, c, 1],
      [b, d, -1],
    ]) {
      const normal = [sign, 0, 0];
      for (const [bottom, upper] of [
        [-0.19, 0.91],
        [2.24, 2.58],
      ]) {
        face(
          out,
          'wood',
          [p(near, y0 + bottom), p(far, y1 + bottom), p(far, y1 + upper), p(near, y0 + upper)],
          normal,
          colors.red,
        );
      }
      face(
        out,
        'glass',
        [p(near, y0 + 0.9), p(far, y1 + 0.9), p(far, y1 + 2.26), p(near, y0 + 2.26)],
        normal,
        colors.glass,
      );
      if (level > 0) {
        const bays = Math.ceil(Math.abs(far[1] - near[1]) / (level > 1 ? 2.2 : 4.7));
        for (let j = 0; j < bays; j++) {
          const t = (j + 0.5) / bays;
          const edge = between(near, far, t);
          const y = mix(y0, y1, t);
          beam(out, 'wood', p(edge, y + 0.81), p(edge, y + 2.36), 0.11, 0.12, colors.redTrim);
        }
      }
    }
  }
  for (const t of [0.12, 0.29, 0.46, 0.63, 0.8, 0.93]) {
    const [x, z] = between(
      between(northWest, northEast, 0.5),
      between(southWest, southEast, 0.5),
      t,
    );
    for (const offset of level > 0 ? [-0.91, 0.91] : [0]) {
      box(
        out,
        'masonry',
        [x + offset - 0.16, -1, z - 0.18],
        [x + offset + 0.16, height(t), z + 0.18],
        colors.foundation,
      );
    }
  }
}

function build(out, level) {
  château(out, level);
  timberResidence(out, level);
  coveredPassage(out, level);
}
export const sanamSkyline = (out) => build(out, 0);
export const sanamDistrict = (out) => build(out, 1);
export const sanamStreet = (out) => build(out, 2);
export const sanamCloseup = (out) => build(out, 3);

const recipe = 'sanam-residences-model.mjs';
const position = [-60, 47, 35];
const lookAt = [0, 5.5, -35];
export const sanamResidencesModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces: materials,
  build: sanamCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: castleOutline,
    outlines: [castleOutline, redHouseOutline, passageOutline],
    minimumCoverage: 0.995,
    basis: 'Mapped footprints of both historic residences and the attached roofed crossing.',
  },
  brief:
    'The turreted pale château and red timber royal residence, linked above the moat by a covered passage.',
  camera: position,
  lookAt,
  sunDirection: [-62, 115, 91],
  embeddedCanonicalGraphs: Object.values(materials).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 2.15,
    groundY: 0,
    cameraYaw: -0.62,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'north-turrets-and-half-timber-entrance',
      position: [22, 11, 31],
      lookAt: [0, 6.1, -2.7],
    },
    { name: 'bridge-over-the-moat', position: [-41, 17, -42], lookAt: [-1, 5.8, -34] },
    { name: 'red-teak-residence', position: [29, 16, -98], lookAt: [-4.3, 7.2, -72] },
    { name: 'connected-residences-above-the-moat', position: [50, 51, -54], lookAt: [0, 5, -39] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sanam-residences-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'sanamSkyline',
    errorMeters: 0.91,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'sanamDistrict', errorMeters: 0.37, surfaces: materials },
      street: { export: 'sanamStreet', errorMeters: 0.16, surfaces: materials },
      closeup: { export: 'sanamCloseup', errorMeters: 0.06, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original authored geometry informed by a photographer-dedicated public-domain photograph, written architectural facts, OpenStreetMap and Terrarium terrain.',
};
