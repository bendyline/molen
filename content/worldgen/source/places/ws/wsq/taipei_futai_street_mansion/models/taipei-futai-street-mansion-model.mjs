/** Futai Street Mansion's 2009 restored arcade, two floors and three-dormer mansard. */
import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { width, depth, ground, firstFloor, secondFloor, eaves, arcade, upper, roof } = plan.section;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  cutStone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.81, metallic: 0 },
  inset: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.65, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    stone: 'c6b99f',
    lightStone: 'cabda3',
    archStone: 'beae94',
    keyStone: '9b937e',
    paving: 'a6a292',
    aggregate: 'bfb7a2',
    timber: '6d5f4e',
    darkTrim: '594e40',
    copper: '747a83',
    edge: '666c74',
    glass: '515b5b',
    recess: '514d42',
  }).map(([key, color]) => [key, rgb(color)]),
);

const nearWall = arcade.front - arcade.depth;
const rear = -depth / 2;
const span = width / 2;

function window(out, x, sill, head, opening, z, lod, { bar = false, door = false } = {}) {
  const left = x - opening / 2;
  const right = x + opening / 2;
  const frame = door ? 0.092 : 0.084;
  box(
    out,
    'inset',
    [left, sill, z - 0.26],
    [right, head, z - 0.24],
    door ? tone.recess : tone.glass,
  );
  if (lod < 2) return;
  for (const side of [left, right])
    box(
      out,
      'timber',
      [side - frame, sill, z - 0.26],
      [side + frame, head, z + 0.023],
      tone.timber,
    );
  for (const y of [sill, head, head - (head - sill) * 0.24])
    box(
      out,
      'timber',
      [left, y - frame / 2, z - 0.25],
      [right, y + frame / 2, z + 0.018],
      tone.timber,
    );
  box(
    out,
    'cutStone',
    [left - 0.15, sill - 0.09, z - 0.04],
    [right + 0.15, sill + 0.015, z + 0.135],
    tone.lightStone,
  );
  if (lod === 3) {
    const high = bar ? sill + 0.57 : head;
    for (const offset of [-0.33, 0, 0.33])
      box(
        out,
        'timber',
        [x + offset * opening - 0.032, bar ? sill + 0.026 : sill + 0.1, z - 0.205],
        [x + offset * opening + 0.032, high, z + (bar ? 0.048 : -0.02)],
        tone.timber,
      );
    if (bar)
      box(out, 'timber', [left, high, z - 0.05], [right, high + 0.06, z + 0.069], tone.darkTrim);
  }
}

function windowedWall(out, width, lower, upper, z, xs, sill, head, opening, lod, options = {}) {
  const { slot = 'plaster', color = tone.aggregate, doorIndex = -1, bar = false } = options;
  const solid = (a, b, y0, y1) => {
    if (a < b && y0 < y1) box(out, slot, [a, y0, z - 0.36], [b, y1, z], color);
  };
  if (!lod || !xs.length) {
    solid(-width / 2, width / 2, lower, upper);
    return;
  }
  let leftEdge = -width / 2;
  for (const [i, x] of xs.entries()) {
    const door = i === doorIndex;
    const base = door ? lower + 0.018 : sill;
    const left = x - opening / 2;
    const right = x + opening / 2;
    solid(leftEdge, left, lower, upper);
    solid(left, right, lower, base);
    solid(left, right, head, upper);
    window(out, x, base, head, opening, z, lod, { door, bar });
    leftEdge = right;
  }
  solid(leftEdge, width / 2, lower, upper);
}

function pier(out, x, z, lod) {
  const half = 0.37;
  const base = [-half - 0.09, -half - 0.08];
  box(
    out,
    'cutStone',
    [x + base[0], ground, z + base[1]],
    [x - base[0], firstFloor + 0.18, z - base[1]],
    tone.keyStone,
  );
  const levels = lod > 1 ? 6 : 1;
  const step = (arcade.spring - (firstFloor + 0.18)) / levels;
  for (let i = 0; i < levels; i++) {
    const y = firstFloor + 0.18 + i * step;
    box(
      out,
      'stone',
      [x - half, y, z - half],
      [x + half, y + step - 0.008, z + half],
      i % 2 ? tone.stone : tone.lightStone,
    );
  }
  box(
    out,
    'cutStone',
    [x - half - 0.11, arcade.spring - 0.097, z - half - 0.1],
    [x + half + 0.11, arcade.spring + 0.105, z + half + 0.06],
    tone.keyStone,
  );
}

function arch(out, center, z, lod) {
  const pieces = [5, 8, 14, 20][lod];
  const spring = arcade.spring;
  const half = arcade.openingWidth / 2;
  const bottom = (angle, z) => [
    center + Math.cos(angle) * half,
    spring + Math.sin(angle) * arcade.rise,
    z,
  ];
  const outer = (angle, z) => [
    center + Math.cos(angle) * (half + 0.29),
    spring + Math.sin(angle) * (arcade.rise + 0.29),
    z,
  ];
  const flush = z - 0.42;
  for (let i = 0; i < pieces; i++) {
    const a = (Math.PI * i) / pieces;
    const b = (Math.PI * (i + 1)) / pieces;
    const inset = lod > 1 ? 0.009 : 0;
    const p = bottom(a + inset, z + 0.025);
    const q = bottom(b - inset, z + 0.025);
    const u = outer(a + inset, z + 0.025);
    const v = outer(b - inset, z + 0.025);
    face(
      out,
      'cutStone',
      [q, p, u, v],
      i === Math.floor(pieces / 2) ? tone.keyStone : tone.archStone,
    );
    const backQ = bottom(b, flush);
    const backP = bottom(a, flush);
    face(out, 'cutStone', [p, q, backQ, backP], tone.archStone);
    face(
      out,
      'stone',
      [v, u, [u[0], secondFloor - 0.07, z], [v[0], secondFloor - 0.07, z]],
      tone.stone,
    );
  }
}

function stoneArcade(out, lod) {
  const z = arcade.front;
  box(out, 'cutStone', [-span, ground, rear], [span, firstFloor, z + 0.06], tone.paving);
  for (const x of arcade.columns) pier(out, x, z - 0.35, lod);
  for (const x of arcade.spanCenters) arch(out, x, z - 0.02, lod);
  for (const side of [-1, 1]) {
    const local = transform(out, (side * Math.PI) / 2, [side * span, 0, nearWall + 1.6]);
    box(local, 'stone', [-1.5, arcade.spring + 0.06, -0.34], [1.5, secondFloor, 0], tone.stone);
    if (lod > 0) {
      for (const x of [-1.41, 1.41])
        box(
          local,
          'stone',
          [x - 0.21, firstFloor, -0.39],
          [x + 0.21, arcade.spring + 0.08, 0],
          tone.stone,
        );
    }
  }
  box(
    out,
    'cutStone',
    [-span - 0.085, secondFloor - 0.15, rear - 0.065],
    [span + 0.085, secondFloor + 0.105, z + 0.12],
    tone.keyStone,
  );
}

function elevations(out, lod) {
  const offsets = arcade.spanCenters;
  const bodyCenter = (nearWall + rear) / 2;
  const walls = [
    { angle: 0, at: [0, 0, nearWall], width: width - 0.052, xs: offsets, doorIndex: 1 },
    { angle: Math.PI, at: [0, 0, rear], width: width, xs: offsets },
    { angle: Math.PI / 2, at: [span, 0, bodyCenter], width: nearWall - rear, xs: [-2.07, 1.8] },
    { angle: -Math.PI / 2, at: [-span, 0, bodyCenter], width: nearWall - rear, xs: [-1.8, 2.07] },
  ];
  for (const side of walls)
    windowedWall(
      transform(out, side.angle, side.at),
      side.width,
      firstFloor,
      secondFloor,
      0,
      side.xs,
      0.89,
      2.92,
      1.28,
      lod,
      { slot: 'stone', color: tone.stone, doorIndex: side.doorIndex },
    );
  const upperFront = Array.from(
    { length: upper.frontSashes },
    (_, i) => (i - (upper.frontSashes - 1) / 2) * upper.frontSpacing,
  );
  const upperSides = [
    [0, [0, 0, arcade.front], width, upperFront],
    [Math.PI, [0, 0, rear], width, [-3.3, 0, 3.3]],
    [Math.PI / 2, [span, 0, 0], depth, [-3, 0, 3]],
    [-Math.PI / 2, [-span, 0, 0], depth, [-3, 0, 3]],
  ];
  for (const [angle, at, length, xs] of upperSides)
    windowedWall(
      transform(out, angle, at),
      length,
      secondFloor + 0.08,
      eaves,
      0,
      xs,
      upper.sill,
      upper.head,
      0.93,
      lod,
      { bar: angle === 0 },
    );
  for (const dx of [-span + 0.27, span - 0.27]) {
    box(
      out,
      'cutStone',
      [dx - 0.16, secondFloor + 0.05, arcade.front - 0.065],
      [dx + 0.16, eaves, arcade.front + 0.033],
      tone.keyStone,
    );
  }
}

const roofRing = (x, z, y) => [
  [-x, y, -z],
  [-x, y, z],
  [x, y, z],
  [x, y, -z],
];
function roundedWindow(out, x, centerZ, sill, width, rise, upright, lod) {
  const r = width / 2;
  const count = [5, 8, 12, 18][lod];
  const curve = (scale, z) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const angle = (Math.PI * i) / count;
      return [x + Math.cos(angle) * r * scale, sill + upright + Math.sin(angle) * rise * scale, z];
    });
  const inner = curve(1, centerZ + 0.045);
  const outer = curve(1.19, centerZ + 0.051);
  const corners =
    upright > 0
      ? [[x + r, sill, centerZ + 0.045], ...inner, [x - r, sill, centerZ + 0.045]]
      : inner;
  out.addConvexPolygon(
    'inset',
    'palette:#ffffff',
    [...corners].reverse(),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    tone.glass,
  );
  for (let i = 0; i < count; i++)
    face(out, 'timber', [outer[i + 1], inner[i + 1], inner[i], outer[i]], tone.darkTrim);
  if (upright > 0)
    for (const border of [-r, r])
      box(
        out,
        'timber',
        [x + border - 0.09, sill, centerZ - 0.06],
        [x + border + 0.09, sill + upright + 0.038, centerZ + 0.075],
        tone.darkTrim,
      );
  box(
    out,
    'timber',
    [x - r - 0.11, sill - 0.11, centerZ - 0.058],
    [x + r + 0.11, sill, centerZ + 0.12],
    tone.darkTrim,
  );
  if (lod > 1) {
    for (const offset of upright > 0 ? [-0.32, 0, 0.32] : [-0.38, 0.38])
      box(
        out,
        'timber',
        [x + offset * r - 0.035, sill, centerZ + 0.052],
        [x + offset * r + 0.035, sill + upright + rise * 0.75, centerZ + 0.098],
        tone.timber,
      );
  }
}

function dormer(out, x, lod) {
  const large = x === 0;
  const sill = large ? 7.14 : 7.59;
  const z = large ? 4.81 : 5.03;
  const width = large ? 1.45 : 1.29;
  const r = width / 2;
  const wall = large ? 1.28 : 0;
  const rise = large ? 0.64 : 0.5;
  const rear = large ? 2.78 : 3.24;
  roundedWindow(out, x, z, sill, width, rise, wall, lod);
  const facets = lod > 1 ? 14 : 7;
  const points = Array.from({ length: facets + 1 }, (_, i) => {
    const angle = (Math.PI * i) / facets;
    return [x + (r + 0.14) * Math.cos(angle), sill + wall + (rise + 0.11) * Math.sin(angle)];
  });
  for (let i = 0; i < points.length - 1; i++) {
    const [a, ay] = points[i];
    const [b, by] = points[i + 1];
    face(
      out,
      'copper',
      [
        [b, by, z + 0.07],
        [a, ay, z + 0.07],
        [a, ay - 0.17, rear],
        [b, by - 0.17, rear],
      ],
      tone.edge,
    );
  }
  if (!large) {
    box(
      out,
      'timber',
      [x - r - 0.13, sill - 0.16, rear],
      [x + r + 0.13, sill, z + 0.04],
      tone.darkTrim,
    );
  }
  for (const dx of [-r - 0.13, r + 0.13]) {
    face(
      out,
      'timber',
      [
        [x + dx, sill - 0.16, rear],
        [x + dx, sill - 0.16, z],
        [x + dx, sill + wall + 0.045, z],
        [x + dx, sill + wall - 0.11, rear],
      ],
      tone.darkTrim,
    );
    if (large && lod > 0) {
      const sign = Math.sign(dx);
      beamPath(
        out,
        'timber',
        [
          [x + dx + sign * 0.3, sill + 0.08, z + 0.04],
          [x + dx + sign * 0.1, sill + 0.41, z + 0.04],
          [x + dx, sill + 0.71, z + 0.04],
        ],
        0.12,
        0.1,
        tone.darkTrim,
      );
    }
  }
}

function mansard(out, lod) {
  const base = roofRing(span + 0.29, depth / 2 + 0.27, roof.baseY);
  const shoulder = roofRing(span - 1.75, depth / 2 - 1.74, roof.shoulderY);
  const crown = roofRing(span - 2.07, depth / 2 - 2.11, roof.roofY);
  for (let side = 0; side < 4; side++) {
    const i = (side + 1) % 4;
    face(out, 'copper', [base[side], base[i], shoulder[i], shoulder[side]], tone.copper);
    face(out, 'copper', [shoulder[side], shoulder[i], crown[i], crown[side]], tone.edge);
  }
  face(out, 'copper', crown, tone.edge);
  box(
    out,
    'timber',
    [-span - 0.28, roof.baseY - 0.19, -depth / 2 - 0.26],
    [span + 0.28, roof.baseY + 0.018, depth / 2 + 0.26],
    tone.darkTrim,
  );
  if (lod > 0) beamPath(out, 'copper', shoulder, 0.13, 0.12, tone.edge, true);
  if (lod > 1)
    for (let i = 0; i <= 17; i++) {
      const x = -span + 0.16 + (2 * (span - 0.16) * i) / 17;
      box(
        out,
        'timber',
        [x - 0.045, roof.baseY - 0.34, arcade.front - 0.12],
        [x + 0.045, roof.baseY - 0.164, arcade.front + 0.22],
        tone.timber,
      );
    }
  for (const x of roof.dormers) dormer(out, x, lod);
}

function build(out, lod) {
  elevations(out, lod);
  stoneArcade(out, lod);
  mansard(out, lod);
}
export const mansionSkyline = (out) => build(out, 0);
export const mansionDistrict = (out) => build(out, 1);
export const mansionStreet = (out) => build(out, 2);
export const mansionCloseup = (out) => build(out, 3);

const recipe = 'taipei-futai-street-mansion-model.mjs';
const camera = [15.6, 11.3, 25.4];
const lookAt = [0, 4.6, 0.7];
export const mansionModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: mansionCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Futai Street Mansion in Taipei, with a sandstone arcade, timber-framed upper storey and three-dormer copper mansard as restored in 2009.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-14, 28, 31],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_sandstone_raw',
    'plaster_lime',
    'wood_plain',
    'metal_copper',
  ],
  qaCameras: [
    { name: 'yanping-road-arcade-and-dormers', position: [5.2, 5, 23.5], lookAt: [0, 4.42, 4.5] },
    {
      name: 'arcade-intrados-and-recessed-entrance',
      position: [-7.9, 2.3, 13.2],
      lookAt: [-1.4, 2.45, 3.45],
    },
    {
      name: 'mansard-profile-and-rear-wall',
      position: [13.8, 11.1, -17.5],
      lookAt: [1.7, 5.1, -1.0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'yanping-road-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mansionSkyline',
    errorMeters: 0.43,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mansionDistrict', 0.21],
        ['street', 'mansionStreet', 0.083],
        ['closeup', 'mansionCloseup', 0.039],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Written sources credited in the evidence. OpenStreetMap geometry under ODbL 1.0.',
};
