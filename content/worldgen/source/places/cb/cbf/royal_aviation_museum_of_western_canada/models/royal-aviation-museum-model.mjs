/** The purpose-built Royal Aviation Museum on Wellington Avenue at Winnipeg airport. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const load = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const frame = load('map-frame');
const terrain = load('terrain-grid');
const outline = frame.geometry.outline;
const section = plan.section;
const surfaces = {
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.85 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metalness: 0.24 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.74, metalness: 0.17 },
};
const c = Object.fromEntries(
  Object.entries({
    champagne: 'bcb6a5',
    metalLight: 'c8c0ad',
    metalShade: 'aca796',
    shadow: '897f71',
    roof: 'a29f92',
    roofShade: '99998d',
    coping: 'a9a697',
    concrete: 'aaa99e',
    footing: '929287',
    frame: '625f56',
    mullion: '656e69',
    glass: '56747b',
    glare: '68858a',
    blue: '607d83',
    glassShadow: '48646b',
    canopy: '77685a',
    warm: 'a17d60',
    road: '9a9a90',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const point = ([x, z], y) => [x, y, z];
const perimeter = (outline) =>
  outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
if (perimeter(outline) >= 0) throw Error('Expected clockwise aviation museum map ring');

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], a), mix(h[j + 1][i], h[j + 1][i + 1], a), b) -
    terrain.modelDatumElevationMeters
  );
}

function bayFace(out, slot, x0, x1, low0, low1, high0, high1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, low0, z],
      [x1, low1, z],
      [x1, high1, z],
      [x0, high0, z],
    ],
    tint,
  );
}

function volume(out, slot, x, y, z, w, h, d, tint) {
  box(out, slot, [x - w / 2, y, z], [x + w / 2, y + h, z + d], tint);
}

function glassCurtain(out, length, bottom, top, lod, withBrace) {
  const cols =
    lod === 0 ? 1 : Math.max(2, Math.round(length / (lod === 1 ? 5.7 : lod === 2 ? 2.32 : 1.92)));
  const rows = [1, 2, 4, 5][lod];
  for (let col = 0; col < cols; col++) {
    const u = col / cols,
      v = (col + 1) / cols;
    const a = u * length,
      b = v * length;
    for (let row = 0; row < rows; row++) {
      const lo = row / rows,
        hi = (row + 1) / rows;
      const span = (t, p) => mix(bottom(t), top(t), p);
      const palette = [c.glass, c.blue, c.glare, c.glassShadow];
      const tint = palette[(Math.floor(col / 3) + Math.floor(row / 2)) % palette.length];
      bayFace(out, 'glass', a, b, span(u, lo), span(v, lo), span(u, hi), span(v, hi), 0.032, tint);
      if (lod >= 2 && row > 0)
        beam(
          out,
          'trim',
          [a, span(u, lo), 0.074],
          [b, span(v, lo), 0.074],
          0.085,
          0.112,
          c.mullion,
        );
    }
    if (lod >= 1 && col > 0) {
      const x = u * length,
        h = lod === 1 ? 0.15 : lod === 2 ? 0.115 : 0.103;
      if (lod === 3)
        beam(out, 'trim', [x, bottom(u), 0.092], [x, top(u), 0.092], h, 0.125, c.mullion);
      else
        bayFace(
          out,
          'trim',
          x - h / 2,
          x + h / 2,
          bottom(u),
          bottom(u),
          top(u),
          top(u),
          0.079,
          c.mullion,
        );
    }
  }
  if (lod >= 1) {
    for (const fn of [bottom, top]) {
      beam(out, 'trim', [0, fn(0), 0.063], [length, fn(1), 0.063], 0.14, 0.16, c.frame);
    }
  }
  if (withBrace && lod >= 2) {
    for (const [u, v] of [
      [0.04, 0.31],
      [0.34, 0.63],
      [0.67, 0.965],
    ]) {
      const low = [length * u, mix(bottom(u), top(u), 0.18), -0.018];
      const high = [length * v, mix(bottom(v), top(v), 0.86), -0.018];
      beam(
        out,
        'trim',
        low.map((q, i) => (i === 2 ? 0.106 : q)),
        high.map((q, i) => (i === 2 ? 0.106 : q)),
        0.12,
        0.09,
        c.frame,
      );
    }
  }
}

function metalCourses(out, length, h0, h1, lod) {
  if (lod === 0) {
    bayFace(out, 'metal', 0, length, 0.32, 0.32, h0, h1, 0, c.champagne);
    return;
  }
  const cols = Math.max(1, Math.round(length / (lod === 1 ? 19 : lod === 2 ? 8.5 : 3.65)));
  for (let i = 0; i < cols; i++) {
    const a = i / cols,
      b = (i + 1) / cols,
      x0 = a * length,
      x1 = b * length;
    const p = mix(h0, h1, a),
      q = mix(h0, h1, b);
    const tint = i % 7 === 5 ? c.metalLight : i % 6 === 3 ? c.metalShade : c.champagne;
    bayFace(out, 'metal', x0, x1, 0.32, 0.32, p, q, 0, tint);
    if (lod >= 2 && i > 0)
      bayFace(out, 'trim', x0 - 0.015, x0 + 0.015, 0.32, 0.32, p, p, 0.009, c.shadow);
  }
  if (lod >= 2 && length > 5) {
    for (const t of [0.278, 0.516, 0.781]) {
      const p = mix(0.32, h0, t),
        q = mix(0.32, h1, t);
      bayFace(out, 'trim', 0, length, p, q, p + 0.018, q + 0.018, 0.008, c.shadow);
    }
  }
}

function glazingCorner(out, length, h0, h1, index, lod) {
  const north = index === 10;
  const u0 = north ? 0.25 : 0,
    u1 = north ? 1 : 0.78;
  const x0 = length * u0,
    x1 = length * u1;
  if (u0 > 0) metalCourses(out, x0, h0, mix(h0, h1, u0), lod);
  if (u1 < 1) metalCourses(transform(out, 0, [x1, 0, 0]), length - x1, mix(h0, h1, u1), h1, lod);
  const low = (t) => (north ? mix(6.05, 1.65, t) : mix(1.65, 5.91, t));
  const high = (t) => mix(h0, h1, mix(u0, u1, t)) - 0.59;
  const glazing = transform(out, 0, [x0, 0, 0]);
  bayFace(glazing, 'metal', 0, x1 - x0, 0.32, 0.32, low(0), low(1), 0, c.metalShade);
  bayFace(
    glazing,
    'metal',
    0,
    x1 - x0,
    high(0),
    high(1),
    high(0) + 0.59,
    high(1) + 0.59,
    0,
    c.metalLight,
  );
  glassCurtain(glazing, x1 - x0, low, high, lod, true);
}

function galleryReturn(out, length, h0, h1, lod) {
  metalCourses(out, length, h0, h1, lod);
  const segments = lod === 0 ? 1 : Math.round(length / 12);
  const margin = length * 0.125;
  for (let index = 0; index < segments; index++) {
    const a = margin + ((length - 2 * margin) * index) / segments,
      b = margin + ((length - 2 * margin) * (index + 1)) / segments;
    const side = transform(out, 0, [a, 0, 0.042]);
    glassCurtain(
      side,
      b - a,
      () => 6.12,
      () => 8.28,
      lod,
      false,
    );
  }
}

function serviceDoors(out, length, lod) {
  for (const [position, width, height] of [
    [0.32, 12.5, 6.85],
    [0.53, 12.15, 6.88],
    [0.75, 6.65, 4.55],
  ]) {
    const x = length * position,
      r = width / 2;
    bayFace(out, 'metal', x - r, x + r, 0.46, 0.46, height, height, 0.06, c.metalShade);
    if (lod === 0) continue;
    for (const a of [x - r, x + r])
      volume(out, 'trim', a, 0.46, 0.06, 0.126, height - 0.46, 0.21, c.frame);
    volume(out, 'trim', x, height, 0.05, width + 0.19, 0.17, 0.25, c.frame);
    if (lod >= 2) {
      for (let y = 0.93; y < height - 0.3; y += 0.58)
        bayFace(out, 'trim', x - r, x + r, y, y, y + 0.032, y + 0.032, 0.083, c.shadow);
      if (lod === 3) volume(out, 'trim', x, 0.9, 0.081, 0.9, 0.23, 0.044, c.frame);
    }
  }
}

function buildingEnvelope(out, lod) {
  const points = outline.map((p, i) => point(p, section.eaveHeights[i]));
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length,
      a = outline[i],
      b = outline[next];
    const h0 = points[i][1],
      h1 = points[next][1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = Math.atan2(a[1] - b[1], b[0] - a[0]);
    const side = transform(out, yaw, [a[0], 0, a[1]]);
    bayFace(
      side,
      'concrete',
      0,
      length,
      Math.min(ground(...a), 0) - 0.45,
      Math.min(ground(...b), 0) - 0.45,
      0.33,
      0.33,
      0,
      c.footing,
    );
    if (section.glazedCornerEdges.includes(i + 1)) glazingCorner(side, length, h0, h1, i, lod);
    else if (i === 1) galleryReturn(side, length, h0, h1, lod);
    else {
      metalCourses(side, length, h0, h1, lod);
      if (i === 2) serviceDoors(side, length, lod);
    }
    const tint = i % 4 === 1 ? c.roofShade : c.roof;
    triangle(out, 'roof', [points[i], points[next], section.ridge], tint);
    if (lod >= 1)
      beam(out, 'metal', points[i], points[next], lod === 1 ? 0.31 : 0.36, 0.41, c.coping);
    if (lod >= 2 && i % 2 === 0)
      beam(
        out,
        'roof',
        points[i].map((p, k) => (k === 1 ? p + 0.045 : p)),
        section.ridge.map((p, k) => (k === 1 ? p + 0.046 : p)),
        0.066,
        0.047,
        c.roofShade,
      );
  }
}

function frontDoor(out, lod) {
  const index = 9,
    a = outline[index],
    b = outline[10];
  const direction = Math.atan2(a[1] - b[1], b[0] - a[0]);
  const entry = transform(out, direction, [a[0], 0, a[1]]);
  const base = Math.max(ground(...a) + 0.1, 0.12);
  const doorCenter = 0.44,
    doorHeight = base + 3.57;
  const width = lod === 0 ? 5.55 : 6.4;
  const doors = transform(entry, 0, [doorCenter - width / 2, 0, 0.06]);
  glassCurtain(
    doors,
    width,
    () => base,
    () => doorHeight,
    lod,
    false,
  );
  const fascia = [
    [-5.3, 4.97, -0.14],
    [3.84, 4.47, -0.14],
    [6.64, 4.67, 3.47],
    [-4.5, 5.52, 3.81],
  ];
  const deck = fascia.map(([x, y, z]) => [x, y + 0.24, z]);
  face(entry, 'roof', deck.slice().reverse(), c.canopy);
  face(entry, 'metal', fascia, c.champagne);
  for (let i = 0; i < fascia.length; i++) {
    const next = (i + 1) % fascia.length;
    face(entry, 'metal', [fascia[i], fascia[next], deck[next], deck[i]], c.warm);
  }
  if (lod >= 1) {
    for (const [x, z, h] of [
      [-4.28, 3.28, 5.48],
      [5.18, 3.28, 4.74],
    ])
      beam(entry, 'trim', [x, base - 0.17, z], [x, h, z], 0.14, 0.176, c.frame);
    for (const x of [-2.34, -0.62, 1.17, 2.9])
      volume(entry, 'trim', x, base, 0.159, 0.135, 3.58, 0.09, c.mullion);
    volume(entry, 'trim', doorCenter, base + 2.25, 0.155, width, 0.115, 0.121, c.frame);
  }
  if (lod >= 2) {
    for (let step = 0; step < 2; step++) {
      const z = step * 0.63 + 0.08,
        y = base - 0.12 - step * 0.09;
      volume(entry, 'concrete', doorCenter, y - 0.7, z, 8.44 + step * 0.6, 0.7, 0.67, c.concrete);
    }
    for (const x of [-3.88, 4.65]) {
      for (const z of [0.55, 3.36])
        beam(entry, 'trim', [x, base - 0.16, z], [x, base + 1.0, z], 0.043, 0.047, c.frame);
      beam(entry, 'trim', [x, base + 1.0, 0.55], [x, base + 1.0, 3.36], 0.057, 0.048, c.frame);
    }
  }
}

function roofEquipment(out, lod) {
  if (lod < 2) return;
  for (const [x, y, z, w, d, h] of [
    [-23.2, 12.21, -20.5, 4.8, 3.3, 0.9],
    [2.7, 13.91, -13.3, 6.8, 2.1, 0.74],
    [22.7, 14.7, 12.0, 4.8, 1.95, 0.37],
  ]) {
    volume(out, 'metal', x, y - 0.43, z, w, h + 0.43, d, c.metalShade);
    volume(out, 'roof', x, y + h, z - 0.13, w + 0.22, 0.18, d + 0.26, c.coping);
    if (lod === 3)
      for (let i = 0; i < 6; i++)
        volume(out, 'trim', x, y - 0.3 + i * 0.16, z - 0.019, w - 0.32, 0.028, 0.024, c.shadow);
  }
}

function build(out, lod) {
  buildingEnvelope(out, lod);
  frontDoor(out, lod);
  roofEquipment(out, lod);
}
export const royalAviationSkyline = (out) => build(out, 0);
export const royalAviationDistrict = (out) => build(out, 1);
export const royalAviationStreet = (out) => build(out, 2);
export const royalAviationCloseup = (out) => build(out, 3);
const recipe = 'royal-aviation-museum-model.mjs';
const camera = [124, 64, 111],
  lookAt = [0, 7, 0];
export const royalAviationModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: royalAviationCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.geometryBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.82,
    basis: 'Native footprint of the current aviation museum at Wellington Avenue.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Royal Aviation Museum of Western Canada, with its tapered hangar envelope, projecting entrance canopy and vaulted glass northwest corner.',
  camera,
  lookAt,
  sunDirection: [-31, 62, 48],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.48,
    cameraYaw: 0.14,
    focus: { center: [0, 5, 0] },
    groundY: 0,
    far: 1800,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'northwest-glazed-triangle', position: [97, 14, 84], lookAt: [19, 8, 24] },
    { name: 'wellington-avenue-entry', position: [-55, 7.4, 44], lookAt: [-20, 4.3, 16] },
    { name: 'airside-and-hangar-doors', position: [64, 23, -102], lookAt: [0, 6, -22] },
    { name: 'tapered-roof-and-corner', position: [76, 93, 67], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'royalAviationSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'royalAviationDistrict', 1.24],
        ['street', 'royalAviationStreet', 0.59],
        ['closeup', 'royalAviationCloseup', 0.12],
      ].map(([key, name, errorMeters]) => [key, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry from ODbL OpenStreetMap mapping and written factual dimensions and descriptions from the museum, architect and builder.',
  limitations: plan.limitations,
};
