/** Marcel Dourgnon's Egyptian Museum on Tahrir Square, Cairo, in May 2019. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid'),
  [outline] = read('map-frame').geometry.polygons;
const {
  bodyEave,
  bodyParapet,
  mainPortalTop,
  portalCenter,
  portalFaceZ,
  portalRecessZ,
  portalSpring,
  portalRadius,
  frontPavilions,
  roofRotunda,
} = plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.18 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
  glass: { slot: 'window', localRef: white, roughness: 0.44, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'c9806a',
    light: 'd28b72',
    shade: 'b57460',
    relief: 'b08069',
    course: 'bc7966',
    cornice: 'b37660',
    pinkTrim: 'ca967d',
    pale: 'cbb7a0',
    deep: 'a58d78',
    stone: 'b6a89b',
    roof: '858779',
    skylight: '84908c',
    steel: '555a50',
    green: '43534b',
    glass: '45544e',
    pane: '697a70',
    door: '363f36',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const atHeight = ([x, z], y) => [x, y, z];
function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}
function face(out, slot, vertices, expected, tint) {
  let normal = normalFor(...vertices);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    vertices = [...vertices].reverse();
    normal = normalFor(...vertices);
  }
  if (vertices.length === 4) quad(out, slot, vertices, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      vertices,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  return {
    length,
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}
function rect(out, wall, slot, a, b, low, high, color, depth = 0) {
  face(
    out,
    slot,
    [
      wall.at(a, low, depth),
      wall.at(b, low, depth),
      wall.at(b, high, depth),
      wall.at(a, high, depth),
    ],
    wall.normal,
    color,
  );
}
function band(out, wall, slot, y, h, color, depth) {
  rect(out, wall, slot, -depth, wall.length + depth, y, y + h, color, depth);
}
function archPoints(u, y, radius, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [u - radius * Math.cos(a), y + rise * Math.sin(a)];
  });
}
function curveBand(out, wall, u, y, radius, rise, width, depth, count, color) {
  const inner = archPoints(u, y, radius, rise, count);
  const outer = archPoints(u, y, radius + width, rise + width, count);
  for (let i = 0; i < count; i++) {
    const shape = [inner[i], inner[i + 1], outer[i + 1], outer[i]].map((p) => wall.at(...p, depth));
    face(out, 'stone', shape, wall.normal, color);
  }
}
function archWindow(out, wall, u, bottom, w, h, lod) {
  if (lod === 0 && w < 5.0) {
    rect(out, wall, 'glass', u - w / 2, u + w / 2, bottom, bottom + h * 0.88, c.glass, 0.025);
    return;
  }
  const r = w / 2,
    spring = bottom + h - r * 0.8,
    rise = r * 0.8,
    count = [4, 6, 9, 12][lod];
  rect(out, wall, 'glass', u - r, u + r, bottom, spring, c.glass, 0.025);
  const arc = archPoints(u, spring, r, rise, count).map((p) => wall.at(...p, 0.025));
  for (let i = 1; i < arc.length - 1; i++)
    face(out, 'glass', [arc[0], arc[i], arc[i + 1]], wall.normal, c.glass);
  if (lod > 0) {
    curveBand(out, wall, u, spring, r, rise, 0.18, 0.05, count, c.pinkTrim);
    rect(out, wall, 'stone', u - r - 0.15, u + r + 0.15, bottom - 0.13, bottom, c.cornice, 0.09);
    for (const f of lod > 1 ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.35, 0.35]) {
      const x = u + r * f,
        top = spring + rise * Math.sqrt(1 - f * f);
      rect(out, wall, 'steel', x - 0.032, x + 0.032, bottom, top - 0.02, c.steel, 0.062);
    }
    for (let y = bottom + 0.54; y < spring; y += lod === 3 ? 0.56 : 0.96)
      rect(out, wall, 'steel', u - r, u + r, y, y + 0.035, c.pane, 0.057);
  }
}
function pilaster(out, wall, x, low, high, width) {
  rect(out, wall, 'plaster', x - width / 2, x + width / 2, low, high, c.light, 0.14);
  rect(
    out,
    wall,
    'stone',
    x - width * 0.63,
    x + width * 0.63,
    high - 0.24,
    high + 0.12,
    c.pinkTrim,
    0.21,
  );
  rect(
    out,
    wall,
    'stone',
    x - width * 0.68,
    x + width * 0.68,
    low - 0.05,
    low + 0.21,
    c.cornice,
    0.21,
  );
}

const perimeter = cleanRing(outline);
const area = perimeter.reduce((sum, [x, z], i) => {
  const [a, b] = perimeter[(i + 1) % perimeter.length];
  return sum + x * b - z * a;
}, 0);
if (area < 0) perimeter.reverse();
function body(out, lod) {
  const cap = earcut(perimeter.flat());
  for (let i = 0; i < cap.length; i += 3)
    face(
      out,
      'roof',
      cap.slice(i, i + 3).map((index) => atHeight(perimeter[index], bodyEave)),
      up,
      c.roof,
    );
  for (let j = 0; j < perimeter.length; j++) {
    const a = perimeter[j],
      b = perimeter[(j + 1) % perimeter.length],
      wall = edge(a, b),
      w = wall.length;
    if (wall.z > 60.5 && Math.abs(wall.x) < 10.8 && wall.normal[2] > 0.75) continue;
    const yBase = Math.min(-2.1, ground(...a) - 0.45, ground(...b) - 0.45);
    const front = wall.normal[2] > 0.5 && wall.z > 54;
    const rear = wall.normal[2] < -0.5 && wall.z < -54;
    const rearCenter = rear && Math.abs(wall.x) < 7;
    const pavilion = (front && Math.abs(wall.x) > 44 && wall.z > 62) || (rear && wall.z < -60);
    const top = pavilion ? bodyParapet + 0.65 : bodyParapet;
    rect(out, wall, 'plaster', 0, w, yBase, top, pavilion ? c.light : c.wall);
    band(out, wall, 'stone', yBase, 1.0 - yBase, c.stone, 0.025);
    if (lod > 0) band(out, wall, 'stone', 7.37, 0.22, c.cornice, 0.072);
    band(out, wall, 'stone', top - 0.88, 0.31, c.cornice, 0.27);
    band(out, wall, 'stone', top - 0.57, 0.2, c.pinkTrim, 0.34);
    if (lod > 1 && (front || rear)) {
      for (let y = 2.0; y < top - 0.8; y += 0.96)
        band(out, wall, 'plaster', y, 0.028, c.course, 0.012);
      for (let u = 0.46; u < w - 0.25; u += 0.76)
        rect(out, wall, 'stone', u, u + 0.24, top - 1.05, top - 0.82, c.cornice, 0.33);
    }
    if (w < 3.7) continue;
    if (rearCenter) {
      archWindow(out, wall, w / 2, 7.22, Math.min(7.7, w * 0.62), 6.1, lod);
      if (lod > 0) {
        for (const u of [w * 0.22, w * 0.78]) pilaster(out, wall, u, 1.12, top - 1.6, 0.79);
        rect(out, wall, 'glass', w / 2 - 1.6, w / 2 + 1.6, 2.24, 5.86, c.glass, 0.039);
      }
      continue;
    }
    const n = Math.max(1, Math.round(w / ([11, 8.4, 0, 0][lod] || (front ? 6.15 : 5.9))));
    for (let i = 0; i < n; i++) {
      const u = (w * (i + 0.5)) / n,
        width = Math.min(2.9, (w * 0.54) / n);
      if (front) {
        archWindow(out, wall, u, 2.23, width, 4.63, lod);
        if (lod > 0) {
          rect(out, wall, 'stone', u - 0.83, u + 0.83, 9.23, 11.24, c.pinkTrim, 0.055);
          rect(out, wall, 'stone', u - 0.67, u + 0.67, 9.4, 11.07, c.pale, 0.095);
        }
      } else {
        archWindow(out, wall, u, 8.77, width, 4.44, lod);
        if (lod > 0 && !pavilion)
          rect(out, wall, 'glass', u - width * 0.29, u + width * 0.29, 2.66, 5.39, c.glass, 0.044);
      }
      if (lod > 0 && i > 0 && (front || pavilion))
        pilaster(out, wall, (w * i) / n, 1.45, top - 1.43, 0.67);
    }
  }
}

function column(out, x, z, low, top, lod) {
  const n = [6, 9, 14, 18][lod],
    r = 0.49;
  const levels = [
    [low, 1.15],
    [low + 0.23, 1.0],
    [top - 0.37, 0.84],
    [top, 1.19],
  ];
  loft(
    out,
    'stone',
    levels.map(([y, k]) => radialRing(y, r * k, r * k, n, [x, z])),
    c.pale,
  );
  box(out, 'stone', x, top - 0.12, z, 1.19, 0.22, 0.91, c.pinkTrim);
  if (lod > 1)
    for (const d of [-1, 1])
      sphere(out, 'stone', [x + d * 0.45, top - 0.1, z + 0.37], [0.2, 0.19, 0.13], c.deep, 8, 4);
}
function relief(out, x, z, lod) {
  box(out, 'stone', x, 9.0, z, 2.14, 4.05, 0.3, c.pinkTrim);
  box(out, 'stone', x, 9.24, z + 0.17, 1.71, 3.56, 0.12, c.deep);
  if (lod > 0) {
    sphere(out, 'stone', [x, 11.03, z + 0.36], [0.44, 1.38, 0.21], c.pale, 8, 5);
    sphere(out, 'stone', [x, 12.52, z + 0.37], [0.23, 0.28, 0.18], c.pale, 8, 5);
    if (lod > 1)
      beam(
        out,
        'stone',
        [x - 0.31, 11.81, z + 0.43],
        [x + 0.49, 11.23, z + 0.39],
        0.2,
        0.14,
        c.pale,
      );
  }
}
function entrance(out, lod) {
  const lo = portalCenter - 11.6,
    hi = portalCenter + 11.6,
    r = portalRadius,
    bottom = 1.28;
  const wall = edge([hi, portalFaceZ], [lo, portalFaceZ]),
    u = wall.length / 2;
  const inner = portalRecessZ - portalFaceZ,
    count = [8, 12, 18, 23][lod];
  const arch = archPoints(u, portalSpring, r, r, count);
  rect(out, wall, 'plaster', 0, u - r, -2.0, mainPortalTop, c.wall);
  rect(out, wall, 'plaster', u + r, wall.length, -2.0, mainPortalTop, c.wall);
  for (let i = 0; i < count; i++) {
    const [a, ya] = arch[i],
      [b, yb] = arch[i + 1];
    face(
      out,
      'plaster',
      [wall.at(a, ya), wall.at(b, yb), wall.at(b, mainPortalTop), wall.at(a, mainPortalTop)],
      wall.normal,
      c.wall,
    );
    face(
      out,
      'stone',
      [wall.at(a, ya, inner), wall.at(b, yb, inner), wall.at(b, yb), wall.at(a, ya)],
      [0, -1, 0],
      c.deep,
    );
  }
  for (const d of [-1, 1]) {
    const x = u + d * r;
    const n = wall.at(u, 0).map((v, i) => v - wall.at(x, 0)[i]);
    face(
      out,
      'stone',
      [
        wall.at(x, bottom),
        wall.at(x, portalSpring),
        wall.at(x, portalSpring, inner),
        wall.at(x, bottom, inner),
      ],
      n,
      c.pinkTrim,
    );
    relief(out, portalCenter + d * 8.51, portalFaceZ + 0.08, lod);
    column(
      out,
      portalCenter + d * 4.56,
      portalRecessZ + 0.63,
      bottom + 0.02,
      portalSpring - 0.18,
      lod,
    );
    pilaster(out, wall, u + d * 9.7, bottom, 15.51, 1.05);
  }
  rect(out, wall, 'stone', u - r, u + r, bottom, portalSpring, c.deep, inner);
  const arc = arch.map((p) => wall.at(...p, inner));
  for (let i = 1; i < count; i++)
    face(out, 'stone', [arc[0], arc[i], arc[i + 1]], wall.normal, c.deep);
  for (const [offset, width, depth, color] of [
    [0, 0.43, 0.062, c.pale],
    [0.43, 0.3, 0.125, c.pinkTrim],
    [0.73, 0.25, 0.18, c.cornice],
  ])
    curveBand(out, wall, u, portalSpring, r + offset, r + offset, width, depth, count, color);
  for (const [y, h, d] of [
    [15.36, 0.24, 0.37],
    [16.39, 0.31, 0.52],
    [16.7, 0.25, 0.69],
    [17.92, 0.33, 0.33],
  ]) {
    box(out, 'stone', portalCenter, y, portalFaceZ - 1.35, 23.9 + d, h, 3.0 + d, c.cornice);
  }
  box(out, 'stone', portalCenter, 16.95, portalFaceZ - 1.64, 12.51, 0.56, 3.76, c.pinkTrim);
  box(out, 'stone', portalCenter, 6.87, portalRecessZ + 0.28, 7.05, 0.29, 0.4, c.pale);
  rect(out, wall, 'glass', u - 2.73, u + 2.73, bottom + 0.12, 6.77, c.door, inner + 0.03);
  for (const d of [-1, 1]) {
    box(
      out,
      'stone',
      portalCenter + d * 2.85,
      bottom,
      portalRecessZ + 0.12,
      0.33,
      5.63,
      0.27,
      c.pale,
    );
  }
  if (lod > 1) {
    for (let x = portalCenter - 10.6; x <= portalCenter + 10.7; x += 0.65)
      box(out, 'stone', x, 16.19, portalFaceZ + 0.18, 0.28, 0.27, 0.39, c.cornice);
    for (let x = -2.94; x <= 2.94; x += 0.98)
      for (const y of [8.7, 9.78, 10.86])
        sphere(
          out,
          'glass',
          [portalCenter + x, y, portalRecessZ + 0.065],
          [0.22, 0.22, 0.08],
          c.door,
          7,
          3,
        );
    sphere(
      out,
      'stone',
      [portalCenter, 14.05, portalFaceZ + 0.23],
      [0.34, 0.63, 0.25],
      c.pale,
      8,
      5,
    );
  }
  const toe = portalFaceZ + 4.3,
    wide = 12.0,
    base = ground(portalCenter, toe);
  const footing =
    Math.min(
      base,
      ground(portalCenter - 6, toe),
      ground(portalCenter + 6, toe),
      ground(portalCenter - 6, portalFaceZ),
      ground(portalCenter + 6, portalFaceZ),
    ) - 0.44;
  const steps = [3, 5, 7, 8][lod];
  for (let i = 0; i < steps; i++) {
    const front = toe - (4.12 * i) / steps,
      back = portalRecessZ;
    const top = lerp(base, bottom + 0.06, (i + 1) / steps);
    box(
      out,
      'stone',
      portalCenter,
      footing,
      (front + back) / 2,
      wide,
      top - footing,
      front - back,
      c.stone,
    );
  }
}

function skylight(out, x, z, w, d, y, height, lod) {
  const left = x - w / 2,
    right = x + w / 2,
    near = z + d / 2,
    far = z - d / 2;
  const ridge0 = [x, y + height, far],
    ridge1 = [x, y + height, near];
  face(out, 'glass', [[left, y, far], [left, y, near], ridge1, ridge0], up, c.skylight);
  face(out, 'glass', [[right, y, near], [right, y, far], ridge0, ridge1], up, c.skylight);
  face(out, 'roof', [[left, y, far], [right, y, far], ridge0], [0, 0, -1], c.roof);
  face(out, 'roof', [[left, y, near], [right, y, near], ridge1], [0, 0, 1], c.roof);
  if (lod > 0) beam(out, 'steel', ridge0, ridge1, 0.105, 0.12, c.steel);
  if (lod > 1) {
    for (let t = far + 0.54; t < near; t += lod === 3 ? 2.08 : 3.66)
      for (const a of [left, right])
        beam(out, 'steel', [a, y + 0.036, t], [x, y + height + 0.05, t], 0.071, 0.09, c.steel);
  }
}
function roofs(out, lod) {
  for (const [x, z] of frontPavilions) {
    box(out, 'plaster', x, bodyEave, z, 15.3, 1.4, 8.2, c.light);
    box(out, 'stone', x, bodyEave + 1.32, z, 15.9, 0.32, 8.8, c.cornice);
  }
  for (const x of [-20, 20]) {
    box(out, 'roof', x, bodyEave, -6.0, 20.4, 0.51, 96.3, c.roof);
    for (const z of [-42, -19, 4, 27, 46])
      skylight(out, x, z, 12.3, z === 46 ? 12.5 : 17.1, 15.25, 2.03, lod);
  }
  skylight(out, 0, -16.1, 14.15, 73.7, 15.15, 2.4, lod);
  const [x, z, r] = roofRotunda,
    n = lod > 1 ? 16 : 8;
  loft(
    out,
    'plaster',
    [radialRing(14.73, r, r, n, [x, z]), radialRing(17.2, r, r, n, [x, z])],
    c.light,
  );
  loft(
    out,
    'glass',
    [
      [17.18, r + 0.13],
      [18.53, 6.8],
      [19.3, 3.88],
      [19.57, 1.37],
    ].map(([y, radius]) => radialRing(y, radius, radius, n, [x, z])),
    c.skylight,
  );
}
function build(out, lod) {
  body(out, lod);
  entrance(out, lod);
  roofs(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'egyptian-museum-model.mjs',
  camera = [-160, 84, 199],
  lookAt = [0, 8.6, 2];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.56],
    ['street', 'museumStreet', 0.2],
    ['closeup', 'museumCloseup', 0.055],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Egyptian Museum’s salmon Beaux-Arts exterior, recessed Tahrir Square arch, dark rear gallery windows and skylit roofs.',
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
    minimumCoverage: 0.91,
    basis: 'Named OpenStreetMap Egyptian Museum footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_sandstone_raw',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'tahrir-arch-and-ionic-portal', position: [5, 10.6, 111], lookAt: [0, 9.9, 60] },
    {
      name: 'south-corner-pavilions-and-salmon-wings',
      position: [106, 31, 141],
      lookAt: [12, 9.8, 39],
    },
    {
      name: 'rear-arched-windows-and-gallery-skylights',
      position: [-99, 35, -118],
      lookAt: [0, 10.5, -26],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-egyptian-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 1.08,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Two exact Qualla CC0 originals and one first-party public-domain photograph.',
};
