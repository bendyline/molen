/** The post-renovation Lei Cheng Uk Han Tomb Museum in January 2008. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  normalFor,
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
const { galleryEave, galleryCoping, entryX, entryThreshold, rampEndZ, canopy, mound, tunnel } =
  plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.87, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.14 },
  fabric: { slot: 'roof', graph: 'fabric_canvas', roughness: 0.89, metallic: 0, doubleSided: true },
  inset: { slot: 'window', localRef: white, roughness: 0.68, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    burgundy: '806568',
    roof: '745b55',
    lining: 'ad8f81',
    wall: 'c4c6bc',
    white: 'd9d9c9',
    plaque: '839997',
    relief: 'a9b5a9',
    greenGray: '829591',
    dark: '414d46',
    pane: '67766a',
    stone: 'a1a49b',
    coping: '998881',
    steel: 'adb7ab',
    canvas: 'e0e1d2',
    soil: 'a4916e',
    turf: '848c66',
    ramp: 'a6a28f',
    stripe: 'c7b682',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
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
function face(out, slot, p, expected, color) {
  let normal = normalFor(...p);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      p,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
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
    normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}
function rect(out, wall, slot, a, b, low, high, color, d = 0) {
  face(
    out,
    slot,
    [wall.at(a, low, d), wall.at(b, low, d), wall.at(b, high, d), wall.at(a, high, d)],
    wall.normal,
    color,
  );
}
function ringWall(out, ring, low, high, slot, color) {
  for (let i = 0; i < ring.length; i++) {
    const w = edge(ring[i], ring[(i + 1) % ring.length]);
    rect(out, w, slot, 0, w.length, low, high, color);
  }
}
function cap(out, ring, y, slot, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      up,
      color,
    );
}

const gallery = cleanRing(outline).reverse();
const front = edge(outline[1], outline[0]);
function galleryBuilding(out, lod) {
  ringWall(out, gallery, 1.24, galleryEave, 'plaster', c.wall);
  ringWall(out, gallery, -1.21, 1.24, 'granite', c.burgundy);
  const eave = gallery.map(([x, z]) => [4.4 + 1.05 * (x - 4.4), 6.0 + 1.06 * (z - 6.0)]);
  ringWall(out, eave, galleryEave - 0.48, galleryCoping, 'steel', c.roof);
  cap(out, eave, galleryCoping, 'steel', c.roof);
  if (lod > 0) {
    const inset = eave.map(([x, z]) => [4.4 + 0.982 * (x - 4.4), 6 + 0.982 * (z - 6)]);
    ringWall(out, inset, galleryEave - 0.69, galleryEave - 0.47, 'steel', c.lining);
  }
  // Tonkin Street reliefs and glazing project beyond the continuous gallery wall.
  const center = outline[1][0] - entryX;
  rect(
    out,
    front,
    'inset',
    center - 1.23,
    center + 1.23,
    entryThreshold - 0.06,
    3.6,
    c.dark,
    0.038,
  );
  if (lod > 0) {
    for (const u of [center - 1.23, center, center + 1.23])
      rect(out, front, 'steel', u - 0.035, u + 0.035, entryThreshold, 3.62, c.greenGray, 0.073);
    rect(out, front, 'steel', center - 1.22, center + 1.22, 3.03, 3.09, c.greenGray, 0.076);
  }
  for (const [a, b] of [
    [0.62, center - 1.58],
    [center + 1.57, front.length - 0.62],
  ]) {
    rect(out, front, 'granite', a - 0.09, b + 0.09, 1.47, 3.32, c.greenGray, 0.068);
    rect(out, front, 'granite', a, b, 1.56, 3.23, c.plaque, 0.106);
    if (lod < 2) continue;
    const spacing = lod === 3 ? 0.72 : 1.02;
    for (let u = a + 0.44; u < b - 0.39; u += spacing) {
      const relief = [
        [-0.27, -0.2],
        [-0.22, 0.12],
        [0.05, 0.25],
        [0.24, 0.03],
        [0.1, -0.1],
      ];
      beamPath(
        out,
        'granite',
        relief.map(([dx, dy]) => front.at(u + dx, 2.38 + dy, 0.133)),
        0.052,
        0.042,
        c.relief,
      );
      if (lod === 3) rect(out, front, 'granite', u - 0.29, u + 0.29, 1.79, 1.84, c.relief, 0.141);
    }
  }
}
function entranceRamp(out, lod) {
  const x = entryX,
    near = rampEndZ,
    far = 12.37,
    r = 1.27;
  const yNear = ground(x, near) + 0.065,
    yFar = entryThreshold;
  const a = [x - r, yNear, near],
    b = [x + r, yNear, near],
    d = [x - r, yFar, far],
    e = [x + r, yFar, far];
  face(out, 'granite', [a, b, e, d], up, c.ramp);
  for (const [p, q, n] of [
    [a, d, [-1, 0, 0]],
    [b, e, [1, 0, 0]],
  ]) {
    const bottom = (v) => [v[0], Math.min(v[1] - 0.18, ground(v[0], v[2]) - 0.25), v[2]];
    face(out, 'granite', [p, q, bottom(q), bottom(p)], n, c.stone);
    if (lod > 0) {
      const top = ([x, y, z]) => [x, y + 0.81, z];
      beam(out, 'steel', top(p), top(q), 0.06, 0.058, c.steel);
      for (const t of [0.02, 0.47, 0.98]) {
        const pos = p.map((v, i) => lerp(v, q[i], t));
        beam(out, 'steel', pos, top(pos), 0.053, 0.05, c.steel);
      }
    }
  }
  if (lod > 1)
    for (let f = 0.06; f < 0.96; f += lod === 3 ? 0.077 : 0.14) {
      const p = a.map((v, i) => lerp(v, d[i], f)),
        q = b.map((v, i) => lerp(v, e[i], f));
      beam(
        out,
        'granite',
        [p[0] + 0.11, p[1] + 0.008, p[2]],
        [q[0] - 0.11, q[1] + 0.008, q[2]],
        0.027,
        0.019,
        c.stripe,
      );
    }
}
function ellipse(center, radii, factor, angle) {
  return [
    center[0] + radii[0] * factor * Math.cos(angle),
    center[1] + radii[1] * factor * Math.sin(angle),
  ];
}
function burialMound(out, lod) {
  const n = [10, 16, 22, 28][lod],
    rings = [1, 0.77, 0.46, 0.18];
  const point = (r, i) => {
    const a = (2 * Math.PI * (i % n)) / n;
    const [x, z] = ellipse(mound.center, mound.radii, r, a);
    const base = ground(x, z) + 0.11;
    const y = lerp(mound.crown, base, r * r);
    return [x, y, z];
  };
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = rings[j],
        b = rings[j + 1],
        color = j === 0 && i > n * 0.07 && i < n * 0.45 ? c.soil : c.turf;
      face(out, 'inset', [point(a, i), point(a, i + 1), point(b, i + 1), point(b, i)], up, color);
    }
  for (let i = 0; i < n; i++)
    face(
      out,
      'inset',
      [
        point(rings.at(-1), i),
        point(rings.at(-1), i + 1),
        [mound.center[0], mound.crown, mound.center[1]],
      ],
      up,
      c.turf,
    );

  const { centerX: x, frontZ: z, sill } = tunnel,
    radius = 0.94,
    spring = sill + 1.02;
  box(out, 'granite', x + 0.7, sill - 1.1, z - 0.2, 5.54, 1.13, 0.7, c.stone);
  box(out, 'steel', x + 0.7, sill - 0.05, z + 0.06, 5.7, 0.27, 0.28, c.burgundy);
  const arc = Array.from({ length: n / 2 + 1 }, (_, i) => {
    const a = (Math.PI * i) / (n / 2);
    return [x + radius * Math.cos(a), spring + radius * Math.sin(a), z + 0.24];
  });
  face(
    out,
    'inset',
    [
      [x - radius, sill, z + 0.24],
      [x + radius, sill, z + 0.24],
      [x + radius, spring, z + 0.24],
      [x - radius, spring, z + 0.24],
    ],
    [0, 0, 1],
    c.dark,
  );
  for (let i = 1; i < arc.length - 1; i++)
    face(out, 'inset', [arc[0], arc[i], arc[i + 1]], [0, 0, 1], c.dark);
  const outerArc = arc.map(([u, y, v]) => [
    x + (u - x) * 1.1,
    spring + (y - spring) * 1.11,
    v - 0.05,
  ]);
  for (let i = 0; i < outerArc.length - 1; i++) {
    const a = outerArc[i],
      b = outerArc[i + 1];
    const back = ([u, y]) => [u, y, -1.98];
    face(out, 'steel', [a, b, back(b), back(a)], [(a[0] + b[0]) / 2 - x, 0.9, 0], c.roof);
  }
  beamPath(
    out,
    'steel',
    [[x + radius, sill, z + 0.29], ...arc, [x - radius, sill, z + 0.29]],
    0.14,
    0.17,
    c.burgundy,
  );
  if (lod > 0) box(out, 'steel', x, sill, z + 0.34, 0.056, 1.78, 0.09, c.steel);
}
function shelter(out, lod) {
  const n = [10, 14, 20, 24][lod],
    near = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      [x, z] = ellipse(canopy.center, canopy.radii, 1, a);
    near.push([x, canopy.eave + 0.28 * Math.cos(2 * a), z]);
  }
  const peak = [canopy.center[0] + 0.25, canopy.crown, canopy.center[1] - 0.26];
  for (let i = 0; i < n; i++) face(out, 'fabric', [near[i], near[(i + 1) % n], peak], up, c.canvas);
  beamPath(out, 'steel', near, 0.09, 0.095, c.steel, true);
  for (const direction of [0.18, 0.93, 2.14, 3.33, 4.46, 5.52]) {
    const [x, z] = ellipse(canopy.center, canopy.radii, 0.91, direction);
    const bottom = ground(x, z) - 0.29,
      y = canopy.eave + 0.22 * Math.cos(2 * direction);
    box(out, 'steel', x, bottom, z, 0.135, y - bottom, 0.135, c.steel);
    if (lod > 0)
      beam(
        out,
        'steel',
        [x, y - 0.11, z],
        [peak[0], peak[1] - 0.21, peak[2]],
        0.066,
        0.061,
        c.steel,
      );
  }
  if (lod > 1)
    for (let i = 0; i < n; i += lod === 3 ? 2 : 4) {
      const p = near[i],
        q = near[(i + Math.round(n * 0.38)) % n];
      beam(
        out,
        'steel',
        [p[0], p[1] - 0.35, p[2]],
        [q[0], q[1] - 0.3, q[2]],
        0.038,
        0.041,
        c.greenGray,
      );
    }
}
function build(out, lod) {
  galleryBuilding(out, lod);
  entranceRamp(out, lod);
  burialMound(out, lod);
  shelter(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'lei-cheng-uk-han-tomb-museum-model.mjs',
  camera = [30, 18, 43],
  lookAt = [4, 4.4, 2.5];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.32],
    ['street', 'museumStreet', 0.115],
    ['closeup', 'museumCloseup', 0.036],
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
    'The low relief-fronted gallery at Tonkin Street and the white protective canopy above the grass-covered Han burial mound and glass viewing passage.',
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
    basis: 'Mapped exhibition gallery way 186494552, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_granite', 'metal_painted', 'fabric_canvas'],
  qaCameras: [
    {
      name: 'tonkin-street-gallery-reliefs-and-ramp',
      position: [-0.4, 5.2, 34.3],
      lookAt: [4.6, 3.65, 10],
    },
    {
      name: 'raised-canopy-and-tomb-approach',
      position: [-13, 8.8, 3.6],
      lookAt: [6.8, 5.32, -3.5],
    },
    {
      name: 'gallery-and-sheltered-mound-overview',
      position: [27, 27, -28],
      lookAt: [4.9, 4.5, 0.4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-lei-cheng-uk-han-tomb-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Three exact public-domain Qualla photographs.',
};
