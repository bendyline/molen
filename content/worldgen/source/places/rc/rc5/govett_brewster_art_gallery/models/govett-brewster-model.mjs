/** The historic gallery facade and native folded steel cladding at 42 Queen Street. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  steel: { slot: 'wall', graph: 'metal_stainless_polished', roughness: 0.27, metallic: 0.95 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.27 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.22 },
};
const c = Object.fromEntries(
  Object.entries({
    metal: 'd9dee2',
    lightMetal: 'edf0f1',
    steelJoint: 'a7adb1',
    white: 'e2dccb',
    stucco: 'cec7b5',
    field: 'd6cebc',
    base: 'bcb6a5',
    concrete: '9c9a94',
    roof: '606466',
    canopy: '3e3b38',
    recess: '3a3f3a',
    glass: '627169',
    darkGlass: '475853',
    cap: 'a96560',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const up = [0, 1, 0],
  forward = [0, 0, 1],
  white = 'palette:#ffffff';
const point = ([x, z], y) => [x, y, z];

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

const foot = (p) => Math.min(s.floor - 0.38, ground(p) - 0.2);
const outward = ([x, z], [u, v]) => [v - z, 0, x - u];

function roof(out, ring, y, tint) {
  const faces = earcut(ring.flat());
  for (let i = 0; i < faces.length; i += 3) {
    face(
      out,
      'roof',
      faces.slice(i, i + 3).map((index) => point(ring[index], y)),
      up,
      tint,
    );
  }
}

const distanceToSegment = ([x, z], [a, b], [p, q]) => {
  const dx = p - a,
    dz = q - b;
  const t = Math.min(1, Math.max(0, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a - t * dx, z - b - t * dz);
};

function simplify(path, threshold) {
  if (path.length <= 2) return path;
  const a = path[0],
    b = path.at(-1);
  let maxDistance = 0,
    split = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const distance = distanceToSegment(path[i], a, b);
    if (distance > maxDistance) {
      maxDistance = distance;
      split = i;
    }
  }
  if (maxDistance < threshold) return [a, b];
  return [
    ...simplify(path.slice(0, split + 1), threshold).slice(0, -1),
    ...simplify(path.slice(split), threshold),
  ];
}

function curtain(out, lod) {
  const whole = outline.slice(s.steelStart, s.steelEnd + 1);
  const path =
    lod === 3
      ? whole
      : [
          ...simplify(outline.slice(s.steelStart, 110), [0.62, 0.24, 0.09][lod]).slice(0, -1),
          ...simplify(outline.slice(109, 193), [0.62, 0.24, 0.09][lod]).slice(0, -1),
          ...simplify(outline.slice(192, s.steelEnd + 1), [0.62, 0.24, 0.09][lod]),
        ];
  const top = ([x, z]) =>
    s.steelTop + s.steelStep * (Math.floor((x + 27.5) / 3.5) / 4 - 1) - (z < -10 ? 0.21 : 0);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      normal = outward(a, b);
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      width = Math.hypot(dx, dz);
    const low = (p) => Math.max(s.floor, ground(p) + 0.045);
    const y = top(a),
      h = top(b);
    const narrowReturn = width < 0.19;
    const material = narrowReturn && lod >= 2 ? 'glass' : 'steel';
    const tint = narrowReturn && lod >= 2 ? c.steelJoint : dz * dx > 0 ? c.lightMetal : c.metal;
    face(
      out,
      'concrete',
      [point(a, foot(a)), point(b, foot(b)), point(b, low(b)), point(a, low(a))],
      normal,
      c.concrete,
    );
    face(
      out,
      material,
      [point(a, low(a)), point(b, low(b)), point(b, h), point(a, y)],
      normal,
      tint,
    );
    if (lod >= 2 && width > 0.8) {
      const at = (p, f) =>
        point([p[0] + (normal[0] * 0.014) / width, p[1] + (normal[2] * 0.014) / width], f);
      for (const floor of [5.04, 9.55]) {
        if (floor <= Math.max(low(a), low(b))) continue;
        face(
          out,
          'steel',
          [at(a, floor), at(b, floor), at(b, floor + 0.032), at(a, floor + 0.032)],
          normal,
          c.steelJoint,
        );
      }
    }
  }
  roof(out, path, s.steelRoof, c.roof);
  if (lod < 2) return;
  const roofUnits = [
    [-18.4, -2.77, 4.7, 2.64],
    [-8.68, 4.87, 3.8, 2.91],
  ];
  for (const [x, z, w, d] of roofUnits) {
    box(out, 'concrete', x, s.steelRoof, z, w, 0.51, d, c.concrete);
    box(out, 'roof', x, s.steelRoof + 0.51, z, w + 0.12, 0.12, d + 0.12, c.roof);
  }
}

function panel(out, slot, left, right, low, top, z, color) {
  face(
    out,
    slot,
    [
      [left, low, z],
      [right, low, z],
      [right, top, z],
      [left, top, z],
    ],
    forward,
    color,
  );
}

function blindArch(out, center, base, shoulder, rx, ry, z, lod) {
  const count = lod === 3 ? 14 : 8;
  panel(out, 'plaster', center - rx, center + rx, base, shoulder, z, c.field);
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const angle = (Math.PI * i) / count;
    return [center - rx * Math.cos(angle), shoulder + ry * Math.sin(angle), z];
  });
  for (let i = 1; i < path.length; i++) {
    face(out, 'plaster', [[center, shoulder - 0.035, z], path[i - 1], path[i]], forward, c.field);
  }
  if (lod < 2) return;
  const rim = path.map(([x, y]) => [center + (x - center) * 1.046, y + 0.037, z + 0.032]);
  beamPath(
    out,
    'stone',
    [[rim[0][0], base, z + 0.032], ...rim, [rim.at(-1)[0], base, z + 0.032]],
    0.048,
    0.056,
    c.white,
  );
}

function roundel(out, x, y, radius, z, lod) {
  const count = lod === 3 ? 28 : 15;
  const path = Array.from({ length: count }, (_, i) => {
    const t = (Math.PI * 2 * i) / count;
    return [x + radius * Math.cos(t), y + radius * Math.sin(t), z];
  });
  for (let i = 0; i < path.length; i++) {
    face(out, 'plaster', [[x, y, z], path[i], path[(i + 1) % path.length]], forward, c.field);
  }
  if (lod >= 2)
    beamPath(
      out,
      'stone',
      path.map(([x0, y0]) => [x0, y0, z + 0.018]),
      0.048,
      0.051,
      c.white,
      true,
    );
}

function oldGallery(out, lod) {
  const ring = [...outline.slice(s.steelEnd), ...outline.slice(0, s.steelStart + 1)];
  const [first, ...mid] = s.oldFrontIndices;
  const frontEdges = new Set([first, ...mid.slice(0, -1)]);
  for (let i = 0; i < outline.length; i++) {
    if (frontEdges.has(i) || (i >= s.steelStart && i < s.steelEnd)) continue;
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const normal = outward(a, b);
    face(
      out,
      'plaster',
      [point(a, foot(a)), point(b, foot(b)), point(b, s.oldEave), point(a, s.oldEave)],
      normal,
      c.stucco,
    );
  }
  roof(out, ring, s.oldEave - 0.04, c.roof);
  const z = s.frontZ,
    [left, right] = [outline[16][0], outline[12][0]];
  const [entryLeft, entryRight] = [10.24, 18.98],
    entryHead = 4.12;
  const front = (a, b, low, high) => panel(out, 'plaster', a, b, low, high, z, c.stucco);
  front(left, entryLeft, foot([left, z]), s.parapet);
  front(entryRight, right, foot([right, z]), s.parapet);
  front(entryLeft, entryRight, entryHead, s.parapet);
  panel(out, 'glass', entryLeft, entryRight, s.floor, entryHead, z - 0.37, c.darkGlass);
  for (const [x, n] of [
    [entryLeft, 1],
    [entryRight, -1],
  ]) {
    face(
      out,
      'stone',
      [
        [x, s.floor, z],
        [x, entryHead, z],
        [x, entryHead, z - 0.38],
        [x, s.floor, z - 0.38],
      ],
      [n, 0, 0],
      c.base,
    );
  }
  box(
    out,
    'stone',
    (entryLeft + entryRight) / 2,
    s.floor - 0.2,
    z + 0.06,
    entryRight - entryLeft,
    0.2,
    0.86,
    c.base,
  );
  box(
    out,
    'stone',
    (left + right) / 2,
    s.parapet - 0.35,
    z + 0.04,
    right - left + 0.41,
    0.25,
    0.63,
    c.white,
  );
  box(
    out,
    'stone',
    (left + right) / 2,
    s.parapet - 0.74,
    z + 0.09,
    right - left + 0.17,
    0.25,
    0.49,
    c.white,
  );
  for (const x of s.pilasterAxes) {
    box(out, 'stone', x, s.floor, z + 0.015, 0.5, s.parapet - s.floor, 0.2, c.white);
    box(out, 'stone', x, s.parapet - 0.12, z + 0.035, 0.62, 0.52, 0.33, c.white);
    if (lod) box(out, 'stone', x, s.floor, z + 0.08, 0.72, 0.8, 0.29, c.base);
  }
  box(out, 'plaster', 14.45, s.parapet - 0.06, z - 0.006, 4.48, 0.4, 0.33, c.field);
  box(out, 'stone', 14.45, s.parapet + 0.26, z + 0.01, 2.77, 0.26, 0.36, c.white);
  if (!lod) return;
  for (const x of [8.47, 14.26, 20.06]) blindArch(out, x, 5.46, 7.27, 1.01, 0.93, z + 0.016, lod);
  for (const x of [8.46, 20.01]) blindArch(out, x, 12.15, 12.73, 1.29, 0.89, z + 0.018, lod);
  roundel(out, 14.26, 12.73, 0.91, z + 0.021, lod);
  for (const y of [4.53, 8.08, 12.05]) {
    box(out, 'stone', (left + right) / 2, y, z + 0.026, right - left, 0.11, 0.13, c.white);
  }
  for (const x of [11.16, 12.78, 14.58, 16.38, 18.01]) {
    box(out, 'roof', x, s.floor, z - 0.31, 0.074, 3.81, 0.076, c.canopy);
  }
  box(
    out,
    'roof',
    (entryLeft + entryRight) / 2,
    3.13,
    z - 0.3,
    entryRight - entryLeft,
    0.072,
    0.083,
    c.canopy,
  );
  box(out, 'plaster', 14.61, 3.67, z - 0.28, 6.98, 0.27, 0.074, c.cap);
  if (lod < 2) return;
  for (let i = 0; i < 32; i++) {
    box(
      out,
      'stone',
      left + 0.31 + (i * (right - left - 0.62)) / 31,
      s.parapet - 1.02,
      z + 0.13,
      0.135,
      0.21,
      0.24,
      c.white,
    );
  }
  for (const [x, w] of [
    [7.25, 0.75],
    [22.09, 0.61],
  ]) {
    panel(out, 'glass', x - w / 2, x + w / 2, 0.73, 2.18, z + 0.03, c.glass);
    box(out, 'stone', x, 0.62, z + 0.06, w + 0.15, 0.13, 0.15, c.white);
  }
}

function canopy(out, lod) {
  const { centerX: x, width, frontZ, spring, rise } = s.canopy;
  const count = [5, 8, 12, 18][lod];
  const front = [],
    back = [];
  for (let i = 0; i <= count; i++) {
    const f = i / count,
      height = spring + rise * Math.sin(Math.PI * f);
    const u = x + width * (f - 0.5);
    front.push([u, height, frontZ - 0.16 * Math.abs(2 * f - 1)]);
    back.push([u, height + 0.13, s.frontZ - 0.05]);
  }
  for (let i = 1; i < front.length; i++) {
    const points = [front[i - 1], front[i], back[i], back[i - 1]];
    face(out, 'roof', points, up, c.canopy);
    face(
      out,
      'roof',
      points.map(([x, y, z]) => [x, y - 0.13, z]),
      [0, -1, 0],
      c.canopy,
    );
  }
  if (!lod) return;
  beamPath(out, 'roof', front, 0.1, 0.15, c.canopy);
  for (const [start, end] of [
    [front[0], 9.97],
    [front.at(-1), 19.23],
  ]) {
    beam(out, 'stone', start, [end, 6.18, s.frontZ + 0.08], 0.035, 0.039, c.white);
  }
}

function build(out, lod) {
  oldGallery(out, lod);
  curtain(out, lod);
  canopy(out, lod);
}

export const gallerySkyline = (out) => build(out, 0);
export const galleryDistrict = (out) => build(out, 1);
export const galleryStreet = (out) => build(out, 2);
export const galleryCloseup = (out) => build(out, 3);

const recipe = 'govett-brewster-model.mjs';
const camera = [30, 25, 72],
  lookAt = [1.3, 7.0, 0.7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'galleryDistrict', 0.29],
    ['street', 'galleryStreet', 0.13],
    ['closeup', 'galleryCloseup', 0.038],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const galleryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: galleryCloseup,
  category: 'museum',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'New Plymouth’s connected galleries with a cream former-theatre frontage, suspended entrance canopy and the folded polished stainless-steel walls of the Len Lye Centre.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Combined native gallery outline from OpenStreetMap way 1099645155.',
  },
  mediumFiContext: {
    scale: 0.82,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_stainless_polished',
    'plaster_lime',
    'stone_limestone',
    'concrete_panel',
    'metal_standing_seam',
  ],
  qaCameras: [
    { name: 'queen-street-theatre-and-steel', position: [35, 8.4, 51], lookAt: [1.6, 7.6, 8.4] },
    {
      name: 'folded-steel-corner-and-roofline',
      position: [-52, 19, 55],
      lookAt: [-13.2, 7.5, 4.6],
    },
    {
      name: 'old-gallery-pilasters-and-canopy',
      position: [21, 5.7, 38],
      lookAt: [14.2, 8.2, 15.1],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-govett-brewster-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'gallerySkyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact Qualla CC0 photo.',
};
