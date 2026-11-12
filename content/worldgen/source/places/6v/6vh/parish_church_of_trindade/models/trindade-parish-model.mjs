/** The old parish church of Trindade, Goiás, in its August 2024 paint scheme. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [mappedOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  painted: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.02 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  spire: { slot: 'roof', graph: 'slate', roughness: 0.81, metallic: 0.07 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64, metallic: 0.02 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'e3dfd5',
    cream: 'd9d1bf',
    blue: '3b75ad',
    shadeBlue: '365f89',
    vent: '517c9f',
    roof: 'a17461',
    spire: '86939e',
    stone: 'a6a095',
    clock: 'e0ded3',
    iron: '465969',
    doorway: '53564f',
    glass: '586c77',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff';
const up = [0, 1, 0];
const levels = [4.82, 8.24, 11.24];

function face(out, slot, points, facing, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, value, i) => dot + value * facing[i], 0) < 0) {
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
        [0.5, 1],
      ],
      color,
    );
}

const rectangle = ([x0, x1, z0, z1]) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const at = ([x, z], y) => [x, y, z];
function edges(ring) {
  return ring.map(([x, z], i) => {
    const q = ring[(i + 1) % ring.length],
      width = Math.hypot(q[0] - x, q[1] - z);
    const dx = (q[0] - x) / width,
      dz = (q[1] - z) / width;
    return {
      width,
      normal: [dz, 0, -dx],
      at: (u, y, p = 0) => [x + u * dx + p * dz, y, z + u * dz - p * dx],
    };
  });
}
function panel(out, slot, e, a, b, bottom, top, p, color) {
  face(
    out,
    slot,
    [e.at(a, bottom, p), e.at(b, bottom, p), e.at(b, top, p), e.at(a, top, p)],
    e.normal,
    color,
  );
}
function wall(out, ring, bottom, top, slot, color) {
  for (const e of edges(ring)) panel(out, slot, e, 0, e.width, bottom, top, 0, color);
}

function archedInset(out, e, u, bottom, spring, half, rise, lod, kind) {
  const door = kind === 'door',
    color = door ? c.doorway : c.vent;
  const count = lod ? (lod >= 2 ? 10 : 6) : 4;
  const rim = door ? 0.16 : 0.13;
  const arch = (i, w, h, d) => {
    const angle = (Math.PI * i) / count;
    return e.at(u - w * Math.cos(angle), spring + h * Math.sin(angle), d);
  };
  panel(out, 'painted', e, u - half - rim, u + half + rim, bottom - 0.06, spring, 0.055, c.blue);
  panel(out, 'inset', e, u - half, u + half, bottom, spring, 0.074, color);
  for (let i = 1; i <= count; i++) {
    const a = arch(i - 1, half, rise, 0.074),
      b = arch(i, half, rise, 0.074);
    face(out, 'inset', [e.at(u, spring, 0.074), a, b], e.normal, door ? c.glass : c.shadeBlue);
    face(
      out,
      'painted',
      [a, b, arch(i, half + rim, rise + rim, 0.074), arch(i - 1, half + rim, rise + rim, 0.074)],
      e.normal,
      c.blue,
    );
  }
  if (lod && !door) {
    for (let y = bottom + 0.17; y < spring - 0.08; y += lod >= 2 ? 0.23 : 0.4) {
      panel(out, 'painted', e, u - half + 0.04, u + half - 0.04, y, y + 0.045, 0.09, c.shadeBlue);
    }
  }
  if (lod >= 2 && door) {
    for (const x of [u - half * 0.47, u + half * 0.47]) {
      panel(
        out,
        'painted',
        e,
        x - 0.035,
        x + 0.035,
        spring - 0.06,
        spring + rise * 0.74,
        0.1,
        c.cream,
      );
    }
    panel(out, 'painted', e, u - half, u + half, spring - 0.06, spring + 0.06, 0.1, c.cream);
  }
}
function blueFrame(out, e, bottom, top, courses) {
  for (const u of [0.105, e.width - 0.105]) {
    panel(out, 'painted', e, u - 0.105, u + 0.105, bottom, top, 0.036, c.blue);
  }
  for (const y of courses) {
    panel(out, 'painted', e, 0, e.width, y - 0.094, y + 0.094, 0.045, c.blue);
  }
}

function roofPyramid(out, bounds, centerX, centerZ, lod) {
  const [x0, x1, z0, z1] = bounds;
  const outer = rectangle([x0 - 0.28, x1 + 0.28, z0 - 0.28, z1 + 0.28]);
  const eave = s.towerEave,
    top = [centerX, s.towerPeak, centerZ];
  const inner = outer.map(([x, z]) => [
    centerX + (x - centerX) * 0.84,
    centerZ + (z - centerZ) * 0.84,
  ]);
  for (const [i, e] of edges(outer).entries()) {
    const j = (i + 1) % outer.length;
    panel(out, 'wall', e, 0, e.width, eave - 0.17, eave, 0, c.cream);
    face(
      out,
      'spire',
      [
        at(outer[i], eave),
        at(outer[j], eave),
        at(inner[j], eave + 0.37),
        at(inner[i], eave + 0.37),
      ],
      up,
      c.spire,
    );
    face(out, 'spire', [at(inner[i], eave + 0.37), at(inner[j], eave + 0.37), top], up, c.spire);
    if (lod >= 2) {
      beam(out, 'spire', at(inner[i], eave + 0.39), top, 0.045, 0.047, c.spire);
    }
  }
  beam(out, 'painted', top, [centerX, s.towerPeak + 0.77, centerZ], 0.054, 0.054, c.iron);
  beam(
    out,
    'painted',
    [centerX - 0.29, s.towerPeak + 0.51, centerZ],
    [centerX + 0.29, s.towerPeak + 0.51, centerZ],
    0.051,
    0.051,
    c.iron,
  );
}

function tower(out, x0, x1, lod) {
  const z1 = s.front,
    z0 = z1 - s.towerDepth,
    bounds = [x0, x1, z0, z1],
    ring = rectangle(bounds);
  wall(out, ring, s.bottom, s.floor, 'stone', c.stone);
  wall(out, ring, s.floor, s.towerEave, 'wall', c.wall);
  for (const [i, e] of edges(ring).entries()) {
    blueFrame(out, e, s.floor, s.towerEave, levels);
    const side = i !== 2,
      u = e.width * 0.5;
    if (side && !lod) continue;
    for (const [base, spring, h] of [
      [1.54, 3.79, 0.48],
      [5.16, 7.46, 0.48],
      [8.52, 10.53, 0.47],
      [11.48, 13.26, 0.45],
    ]) {
      if (side && base < 8.4) continue;
      archedInset(out, e, u, base, spring, side ? 0.46 : 0.51, h, lod, 'louvre');
    }
  }
  roofPyramid(out, bounds, (x0 + x1) / 2, (z0 + z1) / 2, lod);
}

function clock(out, e, u, lod) {
  const center = s.clockHeight,
    n = lod >= 2 ? 24 : 8;
  for (const [r, depth, tint] of [
    [0.71, 0.045, c.blue],
    [0.61, 0.063, c.clock],
  ]) {
    const pt = (i) =>
      e.at(
        u + r * Math.cos((2 * Math.PI * i) / n),
        center + r * Math.sin((2 * Math.PI * i) / n),
        depth,
      );
    for (let i = 0; i < n; i++)
      face(out, 'painted', [e.at(u, center, depth), pt(i), pt(i + 1)], e.normal, tint);
  }
  if (!lod) return;
  for (const [du, dy] of [
    [-0.27, 0.18],
    [0.19, 0.37],
  ]) {
    beam(
      out,
      'painted',
      e.at(u, center, 0.08),
      e.at(u + du, center + dy, 0.08),
      0.045,
      0.04,
      c.iron,
    );
  }
  if (lod >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12;
      beam(
        out,
        'painted',
        e.at(u + 0.46 * Math.cos(a), center + 0.46 * Math.sin(a), 0.085),
        e.at(u + 0.53 * Math.cos(a), center + 0.53 * Math.sin(a), 0.085),
        0.035,
        0.027,
        c.iron,
      );
    }
}

function gabledRoof(out, left, right, back, front, faceBack, frontFascia) {
  for (const x of [left - 0.23, right + 0.23]) {
    face(
      out,
      'roof',
      [
        [x, s.naveEave - 0.04, back],
        [x, s.naveEave - 0.04, front],
        [0, s.naveRidge + 0.05, front],
        [0, s.naveRidge + 0.05, back],
      ],
      up,
      c.roof,
    );
    if (frontFascia) {
      beam(
        out,
        'wall',
        [x, s.naveEave, front],
        [0, s.naveRidge + 0.025, front],
        0.12,
        0.16,
        c.cream,
      );
    }
  }
  const [zBack, zFront] = faceBack;
  for (const [z, normal] of [
    [zBack, [0, 0, -1]],
    [zFront, [0, 0, 1]],
  ]) {
    if (z === null) continue;
    face(
      out,
      'wall',
      [
        [left, s.naveEave, z],
        [right, s.naveEave, z],
        [0, s.naveRidge, z],
      ],
      normal,
      c.wall,
    );
  }
}

function nave(out, lod) {
  const l = s.left + 0.35,
    r = s.right - 0.35,
    front = s.front,
    back = s.back;
  const neck = front - s.towerDepth,
    inner = s.right - s.towerWidth;
  const ring = rectangle([l, r, back, neck]);
  const porchNave = rectangle([-inner, inner, neck, front]);
  wall(out, ring, s.bottom, s.floor, 'stone', c.stone);
  wall(out, ring, s.floor, s.naveEave, 'wall', c.wall);
  for (const [i, e] of edges(ring).entries()) {
    if (i === 2) continue;
    const count = i === 0 ? 3 : 5;
    panel(out, 'painted', e, 0, e.width, s.floor, s.floor + 0.13, 0.028, c.blue);
    if (!lod) continue;
    for (let j = 0; j < count; j++) {
      const u = (e.width * (j + 0.5)) / count;
      archedInset(out, e, u, 3.63, 6.14, 0.62, 0.59, lod, 'louvre');
      if (lod >= 2 && j)
        panel(
          out,
          'painted',
          e,
          (e.width * j) / count - 0.075,
          (e.width * j) / count + 0.075,
          s.floor,
          s.naveEave,
          0.039,
          c.blue,
        );
    }
  }
  wall(out, porchNave, s.bottom, s.floor, 'stone', c.stone);
  wall(out, porchNave, s.floor, s.naveEave, 'wall', c.wall);
  gabledRoof(out, l, r, back - 0.3, neck, [back, neck], false);
  gabledRoof(out, -inner, inner, neck, front + 0.22, [null, front], true);
  const e = edges(porchNave)[2],
    u = e.width * 0.5;
  blueFrame(out, e, s.floor, s.naveEave, [4.82, 8.24]);
  archedInset(out, e, u, s.floor, 3.89, 1.0, 0.64, lod, 'door');
  for (const f of [0.32, 0.68])
    archedInset(out, e, e.width * f, 5.1, 7.41, 0.48, 0.48, lod, 'louvre');
  clock(out, e, u, lod);
  for (let i = 0; i < 3; i++) {
    const depth = 1.06 - 0.27 * i;
    box(
      out,
      'stone',
      0,
      -0.3,
      front + depth * 0.5,
      3.03,
      0.3 + ((i + 1) * s.floor) / 3,
      depth,
      c.stone,
    );
  }
  if (lod === 3) {
    for (const x of [l, r]) {
      beam(
        out,
        'painted',
        [x, s.naveEave - 0.06, back],
        [x, s.naveEave - 0.06, front - s.towerDepth],
        0.08,
        0.1,
        c.shadeBlue,
      );
    }
  }
}

function build(out, lod) {
  nave(out, lod);
  tower(out, s.left, s.left + s.towerWidth, lod);
  tower(out, s.right - s.towerWidth, s.right, lod);
}

export const trindadeSkyline = (out) => build(out, 0);
export const trindadeDistrict = (out) => build(out, 1);
export const trindadeStreet = (out) => build(out, 2);
export const trindadeCloseup = (out) => build(out, 3);
const recipe = 'trindade-parish-model.mjs',
  camera = [40, 23, 64],
  lookAt = [0, 8.2, 6.5];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'trindadeDistrict', 0.19],
    ['street', 'trindadeStreet', 0.08],
    ['closeup', 'trindadeCloseup', 0.035],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const trindadeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: trindadeCloseup,
  category: 'church',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The old parish church in Trindade, Goiás, with the blue and white façade, twin pointed roofs, arched louvres and central clock gable in August 2024.',
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
    outline: mappedOutline,
    minimumCoverage: 0.91,
    basis: 'Named church footprint, OSM way 708162767.',
  },
  mediumFiContext: {
    scale: 0.77,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'metal_painted',
    'tile_ceramic',
    'slate',
    'stone_limestone_raw',
  ],
  qaCameras: [
    { name: 'blue-and-white-clock-facade', position: [1.5, 9.5, 54], lookAt: [0, 9.3, 19] },
    { name: 'twin-spires-and-arched-louvres', position: [31, 21, 45], lookAt: [0, 12, 18] },
    { name: 'long-nave-and-tiled-roof', position: [-43, 23, -36], lookAt: [0, 8, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-trindade-parish-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'trindadeSkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and Bryanlaridma’s exact published first-party CC0 exterior.',
};
