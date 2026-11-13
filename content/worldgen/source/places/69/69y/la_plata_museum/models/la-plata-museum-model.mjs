/** La Plata Museum, photographed during W. J. Holland's 1912 expedition. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
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
  galleryFloor,
  wallEave,
  parapet,
  porticoEave,
  porticoPeak,
  rotundaPeak,
  courtCenterZ,
  courtCentersX,
  courtRadius,
} = plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  base: { slot: 'trim', graph: 'stone_granite', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.16 },
  glass: { slot: 'window', localRef: white, roughness: 0.61, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'c5b599',
    pale: 'd0c1a6',
    shade: 'ad9b80',
    stone: 'd6c8a9',
    deep: 'a0937e',
    base: 'b7afa2',
    steps: 'bab0a2',
    roof: '888d87',
    roofShade: '777d79',
    glass: '4c5150',
    door: '584c40',
    pane: '64716c',
    relief: 'b7a383',
    plinth: 'c0b6a1',
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
function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
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
    center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    normal: [uz, 0, -ux],
    at: (u, y, offset = 0) => [a[0] + ux * u + uz * offset, y, a[1] + uz * u - ux * offset],
  };
}
function rect(out, wall, slot, a, b, low, high, tint, d = 0) {
  face(
    out,
    slot,
    [wall.at(a, low, d), wall.at(b, low, d), wall.at(b, high, d), wall.at(a, high, d)],
    wall.normal,
    tint,
  );
}
function band(out, wall, slot, y, h, tint, d) {
  rect(out, wall, slot, -d, wall.length + d, y, y + h, tint, d);
}
function window(out, wall, u, y, width, height, lod, blind = false) {
  const a = u - width / 2,
    b = u + width / 2;
  if (lod > 0)
    rect(out, wall, 'stone', a - 0.11, b + 0.11, y - 0.12, y + height + 0.12, c.pale, 0.045);
  rect(
    out,
    wall,
    blind ? 'plaster' : 'glass',
    a,
    b,
    y,
    y + height,
    blind ? c.shade : c.glass,
    0.075,
  );
  if (lod > 1 && !blind) {
    rect(out, wall, 'stone', a - 0.14, b + 0.14, y - 0.14, y - 0.02, c.stone, 0.135);
    rect(out, wall, 'glass', u - 0.035, u + 0.035, y, y + height, c.pane, 0.115);
    rect(out, wall, 'glass', a, b, y + height * 0.58, y + height * 0.58 + 0.078, c.pane, 0.12);
  }
}
function gallery(out, wall, lod, isCourt = false) {
  const w = wall.length,
    [x, z] = wall.center;
  const blind = !isCourt && wall.normal[2] > 0.72 && Math.abs(x) < 35;
  if (lod === 0) {
    rect(out, wall, 'plaster', 0, w, -5.5, parapet, isCourt ? c.shade : c.wall);
    if (!isCourt) {
      band(out, wall, 'stone', 10.66, 0.58, c.stone, 0.23);
      const bays = Math.max(1, Math.round(w / 11));
      for (let i = 0; i < bays; i++)
        window(out, wall, (w * (i + 0.5)) / bays, 4.8, 1.44, 4.0, lod, blind);
    }
    return;
  }
  if (!isCourt) {
    rect(out, wall, 'base', 0, w, -5.5, galleryFloor, c.base);
    band(out, wall, 'stone', 2.8, 0.34, c.deep, 0.18);
  }
  rect(
    out,
    wall,
    'plaster',
    0,
    w,
    isCourt ? -3.8 : galleryFloor,
    wallEave,
    isCourt ? c.shade : c.wall,
  );
  band(out, wall, 'stone', 9.62, 0.27, c.pale, 0.105);
  band(out, wall, 'stone', 10.56, 0.43, c.stone, 0.23);
  band(out, wall, 'stone', 10.99, 0.29, c.pale, 0.33);
  band(out, wall, 'plaster', 11.28, parapet - 11.28, c.shade, 0.065);
  if (w < 1.2) return;
  const count = Math.max(1, Math.round(w / (isCourt ? 5.0 : 4.65)));
  for (let i = 0; i < count; i++) {
    const u = (w * (i + 0.5)) / count;
    if (!isCourt) window(out, wall, u, 1.09, Math.min(1.21, w * 0.38), 0.88, lod);
    if (blind && x > -10 && x < 13) {
      if (Math.abs(wall.at(u, 0)[0] - 2) < 10)
        window(out, wall, u, galleryFloor + 0.05, 1.87, 5.98, lod);
    } else {
      window(out, wall, u, 4.27, Math.min(blind ? 2.45 : 1.65, w * 0.69), 4.66, lod, blind);
    }
    if (lod > 0) {
      const a = u - 0.2;
      rect(out, wall, 'glass', a - 0.39, a + 0.39, 9.94, 10.26, c.deep, 0.025);
      if (i > 0) {
        const p = (w * i) / count;
        rect(out, wall, 'stone', p - 0.2, p + 0.2, 3.29, 10.0, c.pale, 0.1);
        if (lod > 1) rect(out, wall, 'stone', p - 0.31, p + 0.31, 9.46, 9.81, c.stone, 0.17);
      }
    }
  }
  if (lod > 1 && !isCourt && Math.abs(x) > 33 && z > 8) {
    for (let u = 0.58; u < w - 0.25; u += 0.75)
      rect(out, wall, 'stone', u, u + 0.21, 10.45, 10.68, c.stone, 0.28);
  }
}

function area(ring) {
  return ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - z * a;
  }, 0);
}
const oriented = (ring, outward) => (area(ring) > 0 === outward ? ring : [...ring].reverse());
const perimeter = oriented(cleanRing(outline.filter((_, i) => i < 2 || i > 4)), true);
function courts(lod) {
  const n = [6, 9, 14, 18][lod];
  return courtCentersX.map((x, i) =>
    oriented(
      Array.from({ length: n + 1 }, (_, j) => {
        const theta = Math.PI * (j / n - 0.5);
        return [
          x + (i === 0 ? -1 : 1) * courtRadius * Math.cos(theta),
          courtCenterZ + courtRadius * Math.sin(theta),
        ];
      }),
      false,
    ),
  );
}
function cap(out, perimeter, holes, y, slot, color) {
  const rings = [perimeter, ...holes],
    vertices = rings.flat();
  const starts = holes.map((_, i) =>
    rings.slice(0, i + 1).reduce((sum, ring) => sum + ring.length, 0),
  );
  const indices = earcut(vertices.flat(), starts);
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => atHeight(vertices[j], y)),
      up,
      color,
    );
  }
}
function envelope(out, lod) {
  const holes = courts(lod);
  for (const [i, ring] of [perimeter, ...holes].entries()) {
    for (let j = 0; j < ring.length; j++)
      gallery(out, edge(ring[j], ring[(j + 1) % ring.length]), lod, i > 0);
  }
  cap(out, perimeter, holes, wallEave - 0.025, 'roof', c.roof);
}
function pillar(out, x, z, y, h, r, lod) {
  const n = [6, 12, 20, 24][lod];
  if (lod === 0) {
    loft(
      out,
      'stone',
      [radialRing(y, r, r, n, [x, z]), radialRing(y + h, r * 0.72, r * 0.72, n, [x, z])],
      c.stone,
    );
    return;
  }
  box(out, 'stone', x, y, z, 2.3 * r, 0.22, 2.3 * r, c.stone);
  const sections = [
    [0.21, 1.02],
    [0.4, 0.94],
    [0.6, 0.84],
    [h * 0.53, 0.8],
    [h - 0.64, 0.69],
    [h - 0.45, 0.83],
    [h - 0.2, 1.11],
    [h, 1.13],
  ];
  loft(
    out,
    'stone',
    sections.map(([dy, k]) => radialRing(y + dy, r * k, r * k, n, [x, z])),
    c.stone,
  );
  if (lod > 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        p = (dy, k) => [x + Math.cos(a) * r * k, y + dy, z + Math.sin(a) * r * k];
      beamPath(
        out,
        'stone',
        [p(0.65, 0.845), p(h * 0.53, 0.805), p(h - 0.68, 0.705)],
        0.031,
        0.025,
        c.relief,
      );
    }
  }
}
function pediment(out, x, z, width, base, peak, depth, lod) {
  const a = x - width / 2,
    b = x + width / 2;
  box(out, 'stone', x, base - 0.27, z - depth / 2, width + 0.62, 0.4, depth + 0.18, c.stone);
  const ring = [
      [a, base, z],
      [b, base, z],
      [x, peak, z],
    ],
    back = ring.map(([u, y]) => [u, y, z - depth]);
  face(out, 'plaster', ring, [0, 0, 1], c.pale);
  face(out, 'plaster', back, [0, 0, -1], c.shade);
  for (let i = 1; i < 3; i++)
    face(out, 'roof', [ring[i], ring[(i + 1) % 3], back[(i + 1) % 3], back[i]], up, c.roofShade);
  beamPath(out, 'stone', [ring[0], ring[2], ring[1]], 0.33, 0.38, c.stone);
  if (lod > 1) {
    beamPath(
      out,
      'stone',
      [
        [a + 1.25, base + 0.26, z + 0.04],
        [x, peak - 0.37, z + 0.04],
        [b - 1.25, base + 0.26, z + 0.04],
      ],
      0.13,
      0.16,
      c.relief,
    );
  }
}
function steps(out, lod) {
  const center = 2,
    back = 28.0,
    toe = 45.0,
    width = 26.8,
    base = ground(center, toe) - 0.12;
  const footing =
    Math.min(
      base,
      ...[center - width / 2, center, center + width / 2].flatMap((x) =>
        [back, (back + toe) / 2, toe].map((z) => ground(x, z)),
      ),
    ) - 0.65;
  box(out, 'base', center, base - 0.7, 24.1, width, galleryFloor - base + 0.7, 10.6, c.steps);
  const count = [4, 10, 16, 18][lod],
    half = count / 2;
  for (let i = 0; i < count; i++) {
    const fraction = (i + 1) / count;
    const front = toe - 0.73 * i - (i >= half ? 2.25 : 0);
    box(
      out,
      'base',
      center,
      footing,
      (front + back) / 2,
      width - 0.05 * i,
      base + (galleryFloor - base) * fraction - footing,
      front - back,
      c.steps,
    );
  }
  for (const x of [center - 14.1, center + 14.1]) {
    const pedestalBase = Math.min(-1.35, ground(x, 34.45) - 0.36, ground(x, 38.45) - 0.36);
    box(out, 'base', x, pedestalBase, 36.45, 2.72, 1.57 - pedestalBase, 4.0, c.plinth);
    if (lod === 0) continue;
    box(out, 'stone', x, 1.57, 36.45, 2.94, 0.27, 4.2, c.stone);
    const n = lod > 1 ? 12 : 7,
      lat = lod > 1 ? 7 : 4;
    sphere(out, 'stone', [x, 2.66, 36.3], [0.6, 0.73, 1.2], c.plinth, n, lat);
    sphere(out, 'stone', [x, 2.86, 37.15], [0.45, 0.56, 0.63], c.stone, n, lat);
    sphere(out, 'stone', [x, 2.77, 37.59], [0.32, 0.27, 0.31], c.plinth, n, lat);
    for (const side of [-1, 1]) {
      sphere(out, 'stone', [x + side * 0.37, 2.03, 36.88], [0.24, 0.19, 0.66], c.stone, n, lat);
      sphere(out, 'stone', [x + side * 0.24, 3.24, 36.98], [0.16, 0.19, 0.15], c.plinth, n, lat);
    }
  }
}
function portico(out, lod) {
  const center = 2,
    front = 34.3;
  steps(out, lod);
  const shaft = porticoEave - galleryFloor - 1.6;
  for (const x of [-12.75, -7.66, -2.54, 2.54, 7.66, 12.75])
    pillar(out, center + x, front - 0.57, galleryFloor, shaft, 0.75, lod);
  box(out, 'plaster', center, porticoEave - 1.62, 26.6, 31.1, 1.59, 15.15, c.pale);
  box(out, 'stone', center, porticoEave - 1.52, front - 0.3, 31.45, 0.23, 0.82, c.stone);
  if (lod > 1) {
    for (let x = center - 14.9; x <= center + 15; x += 0.64)
      box(out, 'stone', x, porticoEave - 0.57, front - 0.12, 0.29, 0.27, 0.28, c.stone);
  }
  pediment(out, center, front + 0.19, 31.3, porticoEave, porticoPeak, 14.2, lod);
  for (const [x, z] of [
    [-38.5, 20.25],
    [40.7, 18.7],
  ]) {
    box(out, 'plaster', x, -2.1, z - 1.65, 8.9, 13.45, 3.88, c.pale);
    pediment(out, x, z + 0.37, 9.32, 11.36, 12.78, 4.34, lod);
    const wall = edge([x + 4.45, z + 0.31], [x - 4.45, z + 0.31]);
    for (const offset of [2.02, 4.45, 6.88]) window(out, wall, offset, 4.67, 1.49, 5.3, lod);
  }
}
function raisedRoof(out, lod) {
  for (const x of [-20.7, 22.8]) {
    box(out, 'plaster', x, 10.9, -4.33, 18.1, 2.87, 43.8, c.shade);
    box(out, 'stone', x, 13.63, -4.33, 18.5, 0.28, 44.18, c.pale);
    box(out, 'roof', x, 13.91, -4.33, 17.5, 0.27, 43.25, c.roof);
  }
  const x = 1.65,
    z = -3.05,
    n = lod === 0 ? 8 : 12;
  const rings = [
    [10.88, 13.6],
    [15.33, 13.6],
    [15.63, 13.96],
  ].map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8));
  loft(out, 'plaster', rings, c.pale);
  const roof = [
    [15.61, 14.08],
    [17.11, 8.2],
    [17.31, 4.0],
    [rotundaPeak, 2.5],
  ].map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8));
  loft(out, 'roof', roof, c.roofShade);
  if (lod > 0) {
    for (let i = 0; i < n; i++) {
      const a = rings[1][(i + 1) % n],
        b = rings[1][i],
        wall = edge([a[0], a[2]], [b[0], b[2]]);
      window(out, wall, wall.length * 0.5, 13.32, 1.1, 1.29, lod);
    }
  }
}
function build(out, lod) {
  envelope(out, lod);
  portico(out, lod);
  raisedRoof(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'la-plata-museum-model.mjs',
  camera = [-155, 75, 186],
  lookAt = [0, 7.9, 2.5];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.52],
    ['street', 'museumStreet', 0.19],
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
    'La Plata Museum’s six-column portico and paired stone cats, curved gallery wings, original open courts and central rotunda in 1912.',
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
    minimumCoverage: 0.9,
    basis: 'Native La Plata Museum way 23592480, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'stone_granite',
    'metal_standing_seam',
  ],
  qaCameras: [
    {
      name: 'corinthian-portico-and-granite-steps',
      position: [-36, 14.5, 97],
      lookAt: [2, 7.6, 24],
    },
    { name: 'curving-west-gallery-and-portico', position: [-119, 20, 83], lookAt: [-19, 7.2, 4.5] },
    { name: 'open-courts-and-raised-rotunda', position: [97, 109, -89], lookAt: [1, 8, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-la-plata-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Public-domain reference from Holland’s 1913 publication.',
};
