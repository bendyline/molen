/** The reinforced-concrete Feldstraße bunker before its rooftop conversion. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireWorldgen('earcut');
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const dim = plan.dimensions;
const [_, canopy] = frame.geometry.polygons;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.18 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    body: '888883',
    cold: '7e807f',
    turret: '777772',
    dark: '5a5b54',
    deck: '787971',
    roof: '696964',
    joint: '797972',
    edge: '93948e',
    liner: 'a39f91',
    window: '41484a',
    light: '677174',
    curb: 'a19581',
    door: '62645e',
    red: '875f55',
  }).map(([key, value]) => [key, rgb(value)]),
);
const y = (p, h) => [p[0], h, p[1]];
const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const ringArea = (ring) =>
  ring.reduce(
    (sum, p, i) =>
      sum + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
    0,
  );

function flat(out, ring, height, slot, tint, top = true) {
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((index) => ring[index]);
    const corners = area(a, b, c) < 0 === top ? [a, b, c] : [a, c, b];
    triangle(
      out,
      slot,
      corners.map((p) => y(p, height)),
      tint,
    );
  }
}

function exposedRing(out, ring, bottom, top, slot, tint) {
  const points = ringArea(ring) < 0 ? ring : ring.toReversed();
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length];
    face(out, slot, [y(a, bottom), y(b, bottom), y(b, top), y(a, top)], tint);
  }
}

function slab(out, ring, low, high, slot, tint, cap = color.deck) {
  exposedRing(out, ring, low, high, slot, tint);
  flat(out, ring, low, slot, color.dark, false);
  flat(out, ring, high, slot, cap);
}

function panel(out, slot, a, b, low, high, depth, tint) {
  if (b - a > 0.002 && high - low > 0.002)
    face(
      out,
      slot,
      [
        [a, low, depth],
        [b, low, depth],
        [b, high, depth],
        [a, high, depth],
      ],
      tint,
    );
}

function aperture(out, x, low, high, width, lod, door, index) {
  const [a, b] = [x - width / 2, x + width / 2];
  const slot = door ? 'steel' : 'glass';
  const tint = door
    ? index % 2
      ? color.red
      : color.door
    : index % 5 === 0
      ? color.light
      : color.window;
  if (lod === 1) {
    panel(out, slot, a, b, low, high, 0.017, tint);
    return;
  }
  const depth = door ? -0.3 : -0.48;
  panel(out, slot, a, b, low, high, depth, tint);
  face(
    out,
    'trim',
    [
      [a, low, depth],
      [b, low, depth],
      [b, low, 0],
      [a, low, 0],
    ],
    color.liner,
  );
  face(
    out,
    'trim',
    [
      [a, low, 0],
      [a, low, depth],
      [a, high, depth],
      [a, high, 0],
    ],
    color.edge,
  );
  face(
    out,
    'trim',
    [
      [b, low, depth],
      [b, low, 0],
      [b, high, 0],
      [b, high, depth],
    ],
    color.liner,
  );
  face(
    out,
    'trim',
    [
      [a, high, 0],
      [b, high, 0],
      [b, high, depth],
      [a, high, depth],
    ],
    color.dark,
  );
  if (lod === 3) {
    if (!door) {
      panel(
        out,
        'steel',
        a,
        b,
        low + (high - low) * 0.52,
        low + (high - low) * 0.52 + 0.065,
        depth + 0.02,
        color.curb,
      );
      box(out, 'trim', [a - 0.07, low - 0.1, -0.23], [b + 0.07, low, 0.09], color.edge);
    } else {
      const center = (a + b) / 2;
      panel(out, 'trim', center - 0.024, center + 0.024, low, high, depth + 0.02, color.dark);
    }
  }
}

function elevation(out, a, b, wallIndex, lod) {
  const top = dim.wallTop;
  const floor = -1.55;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const side = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const tint = wallIndex % 5 === 0 ? color.cold : color.body;
  if (!lod || span < 6) {
    panel(side, 'concrete', 0, span, floor, top, 0, tint);
    return;
  }
  if (lod === 1) panel(side, 'concrete', 0, span, floor, top, 0, tint);
  const middle = wallIndex % 5 === 0;
  const service = wallIndex === 0 || wallIndex === 10 || wallIndex === 16;
  const rows = [
    { low: 0.18, high: 3.16, count: service ? 2 : 0, width: 2.34, door: true },
    { low: 5.28, high: 7.24, count: 3, width: 0.84 },
    { low: 10.57, high: 12.55, count: middle ? 4 : 3, width: 0.92 },
    { low: 15.86, high: 17.79, count: middle ? 4 : 3, width: 0.9 },
    { low: 21.13, high: 23.08, count: middle ? 4 : 3, width: 0.89 },
    { low: 26.5, high: 28.43, count: middle ? 4 : 3, width: 0.94 },
  ];
  let prior = floor;
  for (const [rowIndex, { low, high, count, width, door }] of rows.entries()) {
    if (!count) continue;
    if (lod > 1) panel(side, 'concrete', 0, span, prior, low, 0, tint);
    let right = 0;
    for (let i = 0; i < count; i++) {
      const x = ((i + 1) * span) / (count + 1) + (middle && rowIndex > 0 ? 0.18 : 0);
      if (lod > 1) panel(side, 'concrete', right, x - width / 2, low, high, 0, tint);
      aperture(side, x, low, high, width, lod, door, wallIndex + i + rowIndex);
      right = x + width / 2;
    }
    if (lod > 1) panel(side, 'concrete', right, span, low, high, 0, tint);
    prior = high;
  }
  if (lod > 1) {
    panel(side, 'concrete', 0, span, prior, top, 0, tint);
    for (const h of [4.6, 9.87, 15.18, 20.47, 25.83, 31.35])
      panel(side, 'trim', 0, span, h, h + 0.035, 0.015, color.joint);
    if (service) box(side, 'trim', [span * 0.3, -0.31, 0], [span * 0.7, 0.24, 1.4], color.deck);
  }
}

function rotated([a, b], turns) {
  return [
    [a, b],
    [-b, a],
    [-a, -b],
    [b, -a],
  ][turns];
}
const { coreHalfSpan: c, cornerHalfSpan: d, cornerStart: b } = dim;
const quarter = [
  [-b, -c],
  [b, -c],
  [b, -d],
  [d, -d],
  [d, -b],
];
// Negative winding makes the wall walk face out. Keep the index identifying each bay.
const body = [0, 1, 2, 3].flatMap((turns) => quarter.map((p) => rotated(p, turns)));
const turretCenters = [
  [-25.3, -25.1],
  [25.2, -25.4],
  [25.3, 25.1],
  [-25.2, 25.2],
];

function octagon(x, z, r) {
  const cut = r * 0.37;
  return [
    [x - r + cut, z - r],
    [x + r - cut, z - r],
    [x + r, z - r + cut],
    [x + r, z + r - cut],
    [x + r - cut, z + r],
    [x - r + cut, z + r],
    [x - r, z + r - cut],
    [x - r, z - r + cut],
  ];
}

function build(out, lod) {
  body.forEach((p, i) => elevation(out, body[(i + 1) % body.length], p, i, lod));
  slab(out, canopy, dim.wallTop - 0.08, dim.platformTop, 'concrete', color.body);
  for (const [x, z] of turretCenters) {
    const radius = dim.turretRadius;
    const block = octagon(x, z, radius);
    exposedRing(out, block, dim.platformTop, dim.turretTop - 0.18, 'concrete', color.turret);
    slab(
      out,
      octagon(x, z, radius + 0.13),
      dim.turretTop - 0.18,
      dim.turretTop,
      'trim',
      color.body,
      color.roof,
    );
    if (lod > 1) flat(out, octagon(x, z, radius - 0.47), dim.turretTop + 0.009, 'trim', color.deck);
  }
  if (lod) {
    for (const [x, z, w, h] of [
      [-7, 7, 12, 2.3],
      [3, -10, 9.8, 1.95],
      [4, 15, 6.2, 1.6],
    ]) {
      box(
        out,
        'concrete',
        [x - w / 2, dim.platformTop, z - 1.9],
        [x + w / 2, dim.platformTop + h, z + 1.9],
        color.body,
      );
      box(
        out,
        'trim',
        [x - w / 2 - 0.12, dim.platformTop + h, z - 2.03],
        [x + w / 2 + 0.12, dim.platformTop + h + 0.12, z + 2.03],
        color.roof,
      );
    }
  }
}

export const bunkerSkyline = (out) => build(out, 0);
export const bunkerDistrict = (out) => build(out, 1);
export const bunkerStreet = (out) => build(out, 2);
export const bunkerCloseup = (out) => build(out, 3);

const recipe = 'heiligengeistfeld-flak-tower-model.mjs';
const camera = [-109, 53, -115];
const lookAt = [0, 17, 0];
export const bunkerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: bunkerCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Hamburg’s former Flakturm IV on Feldstraße in its 2006 media-bunker appearance, with four large concrete bastions, projecting gun emplacements and rows of postwar window cuts.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-26, 45, -27],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'feldstrasse-bastions', position: [-67, 13, -62], lookAt: [-6, 18, -12] },
    { name: 'concrete-canopy-and-turrets', position: [-71, 63, 84], lookAt: [-4, 28, 2] },
    { name: 'bunker-wall-window-cuts', position: [-53, 21, 6], lookAt: [-35, 20, -18] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'feldstrasse-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'bunkerSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'bunkerDistrict', 0.27],
        ['street', 'bunkerStreet', 0.1],
        ['closeup', 'bunkerCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap outline under ODbL 1.0. San Andreas independently released the exact 2006 Qualla reference to the public domain.',
};
