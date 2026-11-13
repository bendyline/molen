/** Auwal Masjid's Dorp Street facade and minaret as seen in 2024. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
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
const frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.78, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.22 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.28 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46, metallic: 0.08 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: '70796b',
    shade: '616b60',
    plinth: '63695c',
    cream: 'd7d7c4',
    stone: 'babbaa',
    bright: 'e7e4d4',
    frame: '755545',
    wood: '825b43',
    gate: 'babcae',
    glass: '596061',
    shadow: '343832',
    cap: '5b5c70',
    roof: '7e8076',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  front = [0, 0, 1],
  up = [0, 1, 0];
const tau = Math.PI * 2;

function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

const [rightGate, leftGate] = outline.slice(1, 3);
const gateSlope = (rightGate[1] - leftGate[1]) / (rightGate[0] - leftGate[0]);
const gateDepth = (x) => leftGate[1] + (x - leftGate[0]) * gateSlope;
const gatePoint = (x, y, d = 0) => [x, y, gateDepth(x) + d];

function gateWall(out, lod) {
  const {
    entranceAxis: x,
    doorWidth: width,
    floor: low,
    spring,
    archRise: rise,
    upperParapet: top,
  } = s;
  const left = x - width / 2,
    right = x + width / 2;
  const vertical = (a, b, y, h, slot, color, offset = 0) =>
    face(
      out,
      slot,
      [
        gatePoint(a, y, offset),
        gatePoint(b, y, offset),
        gatePoint(b, h, offset),
        gatePoint(a, h, offset),
      ],
      front,
      color,
    );
  vertical(leftGate[0], left, low, top, 'wall', c.wall);
  vertical(right, rightGate[0], low, top, 'wall', c.wall);
  const segments = [5, 7, 11, 16][lod];
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const t = (Math.PI * i) / segments;
    return [x - (width / 2) * Math.cos(t), spring + rise * Math.sin(t)];
  });
  const recess = -0.49;
  vertical(left, right, low, spring, 'wood', c.shadow, recess);
  for (let i = 1; i < arc.length; i++) {
    const [a, y] = arc[i - 1],
      [b, h] = arc[i];
    face(
      out,
      'wall',
      [gatePoint(a, y), gatePoint(b, h), gatePoint(b, top), gatePoint(a, top)],
      front,
      c.wall,
    );
    face(
      out,
      'wall',
      [gatePoint(a, y), gatePoint(b, h), gatePoint(b, h, recess), gatePoint(a, y, recess)],
      [0, -1, 0],
      c.shade,
    );
    face(
      out,
      'wood',
      [gatePoint(x, spring - 0.01, recess), gatePoint(a, y, recess), gatePoint(b, h, recess)],
      front,
      c.shadow,
    );
  }
  for (const [xx, inward] of [
    [left, 1],
    [right, -1],
  ]) {
    face(
      out,
      'wall',
      [
        gatePoint(xx, low),
        gatePoint(xx, spring),
        gatePoint(xx, spring, recess),
        gatePoint(xx, low, recess),
      ],
      [inward, 0, 0],
      c.shade,
    );
  }
  const z = gateDepth(x) + 0.082;
  const surroundWidth = 0.18,
    outer = width / 2 + 0.18;
  for (const sign of [-1, 1])
    box(out, 'trim', x + sign * outer, low, z, surroundWidth, 3.51, 0.13, c.bright);
  box(out, 'trim', x, low + 3.46, z, outer * 2 + surroundWidth, 0.19, 0.13, c.bright);
  box(out, 'trim', x, low - 0.11, z, width + 0.29, 0.17, 0.69, c.stone);
  if (!lod) return;
  const gateZ = z - 0.25;
  const count = lod >= 2 ? 15 : 7;
  for (let i = 0; i <= count; i++) {
    const span = (i / count - 0.5) * width * 0.94;
    const high = spring + rise * Math.sqrt(1 - Math.pow((2 * span) / width, 2)) - 0.04;
    beam(out, 'iron', [x + span, low + 0.1, gateZ], [x + span, high, gateZ], 0.044, 0.043, c.gate);
  }
  beamPath(
    out,
    'iron',
    arc.map(([a, y]) => [a, y - 0.055, gateZ]),
    0.043,
    0.043,
    c.gate,
  );
  for (const y of [low + 0.12, low + 0.58, low + 1.82]) {
    beam(out, 'iron', [left + 0.04, y, gateZ], [right - 0.04, y, gateZ], 0.06, 0.055, c.gate);
  }
  box(out, 'trim', x, low + 3.84, z - 0.026, 0.99, 0.37, 0.08, c.stone);
  if (lod >= 2) {
    for (const sign of [-1, 1]) {
      for (const h of [0.75, 1.04, 1.33]) {
        beam(
          out,
          'iron',
          [x + sign * 0.16, low + h, gateZ + 0.045],
          [x + sign * 0.85, low + h + 0.25, gateZ + 0.045],
          0.027,
          0.027,
          c.gate,
        );
      }
    }
  }
}

function facadeZ(x) {
  const candidates = outline.flatMap(([a, z], i) => {
    const [b, w] = outline[(i + 1) % outline.length];
    return Math.abs(b - a) > 0.1 && x >= Math.min(a, b) && x <= Math.max(a, b)
      ? [z + ((w - z) * (x - a)) / (b - a)]
      : [];
  });
  return Math.max(...candidates);
}

function window(out, x, y, width, height, lod, woodenDoor = false) {
  const z = facadeZ(x);
  const tint = woodenDoor ? c.wood : c.glass;
  box(out, woodenDoor ? 'wood' : 'glass', x, y, z + 0.035, width, height, 0.084, tint);
  box(out, 'trim', x, y + height, z + 0.082, width + 0.16, 0.13, 0.19, c.cream);
  if (!woodenDoor) box(out, 'trim', x, y - 0.11, z + 0.085, width + 0.13, 0.1, 0.19, c.cream);
  if (!lod) return;
  for (const dx of [-width / 2, width / 2]) {
    box(out, 'wood', x + dx, y, z + 0.08, 0.11, height, 0.13, c.frame);
  }
  if (lod >= 2) {
    const count = woodenDoor ? 3 : 4;
    for (let i = 1; i < count; i++) {
      box(out, 'wood', x, y + (height * i) / count, z + 0.084, width, 0.055, 0.065, c.frame);
    }
    if (!woodenDoor) box(out, 'wood', x, y, z + 0.08, 0.06, height, 0.08, c.frame);
  }
}

function shell(out, lod) {
  const area = outline.reduce((sum, [x, z], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - z * u;
  }, 0);
  const ring = area >= 0 ? outline : [...outline].reverse();
  const y = s.floor;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const [x, z] = a,
      [u, v] = b;
    const outward = [v - z, 0, x - u];
    const at = ([p, q], h) => [p, h, q];
    const foot = ([p, q]) => Math.min(y - 0.21, ground(p, q) - 0.22);
    const top =
      i === 0 || i === 1 || i === 2 || i === 3 || i === 4 ? s.upperParapet : s.sideParapet;
    face(out, 'wall', [at(a, foot(a)), at(b, foot(b)), at(b, y), at(a, y)], outward, c.plinth);
    if (!((a === leftGate && b === rightGate) || (a === rightGate && b === leftGate))) {
      face(
        out,
        'wall',
        [at(a, y), at(b, y), at(b, top), at(a, top)],
        outward,
        z > 2 && v > 2 ? c.wall : c.shade,
      );
    }
    beam(out, 'trim', at(a, top + 0.015), at(b, top + 0.015), 0.15, 0.12, c.cream);
    if (z > 2.9 && v > 2.9) {
      beam(out, 'trim', at(a, s.lowerCornice), at(b, s.lowerCornice), 0.16, 0.12, c.cream);
    }
  }
  const indices = earcut(ring.flat());
  if (!indices.length) throw Error('Mosque outline does not triangulate');
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      'roof',
      indices.slice(i, i + 3).map((index) => [ring[index][0], s.roofLevel, ring[index][1]]),
      up,
      c.roof,
    );
  }
  gateWall(out, lod);
  for (const [x, h, w, height, door] of [
    [-11.1, 1.22, 1.23, 1.6, false],
    [-5.02, y, 1.12, 2.45, true],
    [7.1, 0.96, 1.62, 2.78, false],
    [11.8, 1.13, 1.24, 2.18, false],
    [1.31, 4.79, 0.51, 1.68, false],
  ])
    window(out, x, h, w, height, lod, door);
  if (lod >= 1) {
    const z = gateDepth(s.entranceAxis);
    box(out, 'trim', s.entranceAxis, -0.015, z + 0.45, 2.88, 0.17, 0.71, c.stone);
    if (lod >= 2) {
      for (const x of [s.entranceAxis - 1.62, s.entranceAxis + 1.6]) {
        box(out, 'trim', x, y + 1.64, facadeZ(x) + 0.06, 0.22, 0.18, 0.13, c.stone);
      }
    }
  }
}

function minaret(out, lod) {
  const { center, radius, balcony, upperCornice, capBase, top } = s.minaret;
  const [x, z] = center,
    n = 8,
    offset = Math.PI / 8;
  const profile = (slot, rings, tint) =>
    loft(
      out,
      slot,
      rings.map(([y, scale]) => radialRing(y, radius * scale, radius * scale, n, center, offset)),
      tint,
    );
  profile(
    'wall',
    [
      [s.roofLevel - 0.22, 1.04],
      [balcony - 0.19, 1.04],
    ],
    c.wall,
  );
  profile(
    'trim',
    [
      [balcony - 0.33, 1.12],
      [balcony - 0.19, 1.25],
      [balcony, 1.28],
      [balcony + 0.13, 1.21],
    ],
    c.cream,
  );
  profile(
    'wall',
    [
      [balcony + 0.09, 0.89],
      [upperCornice - 0.25, 0.89],
    ],
    c.wall,
  );
  profile(
    'trim',
    [
      [upperCornice - 0.36, 0.93],
      [upperCornice - 0.07, 1.14],
      [upperCornice + 0.12, 1.13],
      [upperCornice + 0.18, 0.79],
    ],
    c.cream,
  );
  profile(
    'wall',
    [
      [upperCornice + 0.15, 0.7],
      [capBase, 0.68],
    ],
    c.wall,
  );
  profile(
    'trim',
    [
      [capBase - 0.08, 0.68],
      [capBase + 0.11, 0.72],
    ],
    c.cream,
  );
  profile(
    'roof',
    [
      [capBase + 0.09, 0.69],
      [capBase + 0.42, 0.78],
      [top - 0.2, 0.61],
      [top, 0.43],
    ],
    c.cap,
  );
  const windowZ = z + radius * Math.cos(Math.PI / 8) * 0.89;
  const bottom = balcony + 1.43,
    spring = balcony + 2.49,
    w = 0.72,
    rise = 0.31;
  const arc = Array.from({ length: lod >= 2 ? 10 : 6 }, (_, i) => {
    const a = (Math.PI * i) / (lod >= 2 ? 9 : 5);
    return [x - (Math.cos(a) * w) / 2, spring + Math.sin(a) * rise, windowZ + 0.047];
  });
  box(out, 'glass', x, bottom, windowZ + 0.028, w, spring - bottom + 0.02, 0.07, c.glass);
  for (let i = 1; i < arc.length; i++) {
    face(out, 'glass', [[x, spring, windowZ + 0.049], arc[i - 1], arc[i]], front, c.glass);
  }
  beamPath(
    out,
    'trim',
    [[x - w / 2, bottom, windowZ + 0.054], ...arc, [x + w / 2, bottom, windowZ + 0.054]],
    0.084,
    0.091,
    c.cream,
  );
  box(out, 'trim', x, bottom - 0.1, windowZ + 0.062, w + 0.16, 0.13, 0.19, c.cream);
  if (!lod) return;
  const rail = radialRing(balcony + 0.98, radius * 1.16, radius * 1.16, 8, center, offset);
  beamPath(out, 'iron', rail, 0.061, 0.061, c.gate, true);
  const count = lod === 1 ? 2 : lod === 2 ? 4 : 6;
  for (let i = 0; i < rail.length; i++) {
    const a = rail[i],
      b = rail[(i + 1) % rail.length];
    for (let j = 0; j < count; j++) {
      const px = a[0] + ((b[0] - a[0]) * j) / count,
        pz = a[2] + ((b[2] - a[2]) * j) / count;
      beam(out, 'iron', [px, balcony + 0.13, pz], [px, a[1], pz], 0.045, 0.045, c.gate);
    }
  }
  const lowWindowZ = z + radius * Math.cos(Math.PI / 8) * 1.04;
  box(out, 'glass', x, s.roofLevel + 0.52, lowWindowZ + 0.035, 0.52, 2.2, 0.078, c.shadow);
  for (const dx of [-0.27, 0.27])
    box(out, 'wood', x + dx, s.roofLevel + 0.52, lowWindowZ + 0.09, 0.065, 2.2, 0.085, c.frame);
  if (lod >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = offset + (tau * i) / 8;
      const xx = x + Math.cos(a) * radius * 0.69,
        zz = z + Math.sin(a) * radius * 0.69;
      box(out, 'trim', xx, capBase - 0.26, zz, 0.13, 0.22, 0.16, c.cream);
    }
    for (let i = 1; i <= 3; i++) {
      box(
        out,
        'wood',
        x,
        s.roofLevel + 0.52 + (2.2 * i) / 4,
        lowWindowZ + 0.11,
        0.55,
        0.053,
        0.052,
        c.frame,
      );
    }
  }
}

function build(out, lod) {
  shell(out, lod);
  minaret(out, lod);
}

export const mosqueSkyline = (out) => build(out, 0);
export const mosqueDistrict = (out) => build(out, 1);
export const mosqueStreet = (out) => build(out, 2);
export const mosqueCloseup = (out) => build(out, 3);

const recipe = 'auwal-mosque-model.mjs';
const camera = [28, 23, 53],
  lookAt = [0.5, 6.6, -1.3];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'mosqueDistrict', 0.29],
    ['street', 'mosqueStreet', 0.14],
    ['closeup', 'mosqueCloseup', 0.05],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const mosqueModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: mosqueCloseup,
  category: 'mosque',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Auwal Mosque in Bo-Kaap with its olive plaster, cream bands, white arched entrance grille and polygonal minaret with a dark cap.',
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
    basis: 'Named Auwal Masjid footprint from OpenStreetMap way 885400249.',
  },
  mediumFiContext: {
    scale: 0.77,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'wood_plain',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'dorp-street-front-and-minaret', position: [1.9, 5.8, 40], lookAt: [1.1, 7.5, 1.2] },
    { name: 'cream-gate-frame-and-ironwork', position: [6.4, 3.6, 15.8], lookAt: [1.3, 2.42, 4] },
    {
      name: 'balcony-arched-minaret-window-and-cap',
      position: [10.9, 14.4, 24],
      lookAt: [1.1, 12.1, 1.3],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-auwal-mosque-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mosqueSkyline',
    errorMeters: 0.69,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photo.',
};
