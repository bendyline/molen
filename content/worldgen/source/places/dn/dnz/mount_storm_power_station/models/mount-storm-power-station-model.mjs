/** Mount Storm Power Station’s generating campus and chimneys, fall 2000. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
const byRole = Object.fromEntries(frame.features.map((f) => [f.role, f]));
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  cladding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.08 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.25 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    concrete: '8e8275',
    stack: '9d8d76',
    short: 'a69b85',
    darkStack: '695d4c',
    steel: '68695c',
    roof: '9e9a8a',
    terrace: '7e7d6d',
    vent: 'aaa695',
    cream: 'b2a288',
    warm: 'a2947f',
    shadow: '515950',
    framework: '838072',
    black: '3a3e35',
    pale: 'b7b8ac',
  }).map(([key, value]) => [key, rgb(value)]),
);

const extrema = (ring) => [
  Math.min(...ring.map((p) => p[0])),
  Math.min(...ring.map((p) => p[1])),
  Math.max(...ring.map((p) => p[0])),
  Math.max(...ring.map((p) => p[1])),
];
const vec = (p, y) => [p[0], y, p[1]];
const crossXZ = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function prismaticVolume(out, shape, floor, height, tint) {
  const signed = shape.reduce(
    (sum, p, i) =>
      sum + p[0] * shape[(i + 1) % shape.length][1] - p[1] * shape[(i + 1) % shape.length][0],
    0,
  );
  const p = signed < 0 ? shape : shape.toReversed();
  for (const [i, a] of p.entries()) {
    const b = p[(i + 1) % p.length];
    face(out, 'cladding', [vec(a, floor), vec(b, floor), vec(b, height), vec(a, height)], tint);
  }
  const indices = earcut(p.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => p[j]);
    const top = crossXZ(a, b, c) < 0 ? [a, b, c] : [a, c, b];
    triangle(
      out,
      'roof',
      top.map((p) => vec(p, height)),
      color.roof,
    );
  }
}

function volume(out, role, tint, offset = 0) {
  const { points, properties } = byRole[role];
  const { ground, foundation } = plan.contactLevels[role];
  const top = ground + properties.heightMeters + offset;
  prismaticVolume(out, points, foundation, top, tint);
  return { extent: extrema(points), top, ground };
}

function ridgeVents(out, extent, elevation, count, lod, inset = 4.1) {
  const [x0, z0, x1, z1] = extent;
  for (let i = 0; i < count; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / count;
    box(
      out,
      'steel',
      [x0 + inset, elevation, z - 1.55],
      [x1 - inset, elevation + (lod ? 1.85 : 1.15), z + 1.55],
      color.vent,
    );
    if (lod > 1)
      box(
        out,
        'roof',
        [x0 + inset - 0.25, elevation + 1.65, z - 1.75],
        [x1 - inset + 0.25, elevation + 2.03, z + 1.75],
        color.pale,
      );
  }
}

function longHall(out, lod) {
  const { extent, top, ground } = volume(out, 'turbineHall', color.cream);
  const [x0, z0, x1, z1] = extent;
  ridgeVents(out, extent, top, [3, 6, 13, 16][lod], lod, 5.6);
  if (!lod) return;
  const longSide = transform(out, Math.PI / 2, [x1, 0, z1]);
  const span = z1 - z0;
  const bays = [0, 12, 21, 25][lod];
  for (let i = 0; i < bays; i++) {
    const a = ((i + 0.5) * span) / bays;
    face(
      longSide,
      'window',
      [
        [a - 2.3, ground + 5.5, 0.034],
        [a + 2.3, ground + 5.5, 0.034],
        [a + 2.3, ground + 12.74, 0.034],
        [a - 2.3, ground + 12.74, 0.034],
      ],
      color.shadow,
    );
    if (lod > 1) {
      box(
        longSide,
        'concrete',
        [a - 2.93, ground + 0.55, -0.01],
        [a - 2.58, top - 1.6, 0.31],
        color.framework,
      );
      box(
        longSide,
        'steel',
        [a - 0.072, ground + 5.63, 0.024],
        [a + 0.072, ground + 12.68, 0.1],
        color.vent,
      );
    }
  }
  box(
    out,
    'concrete',
    [x0 - 0.18, top - 2.28, z0 - 0.18],
    [x1 + 0.42, top - 1.77, z1 + 0.18],
    color.cream,
  );
}

function boiler(out, role, index, lod) {
  const { extent, top, ground } = volume(out, role, index === 2 ? color.warm : color.cream);
  const [x0, z0, x1, z1] = extent;
  ridgeVents(out, extent, top, [2, 3, 6, 8][lod], lod, 4.4);
  if (!lod) return;
  const count = lod === 1 ? 4 : 7;
  const wall = transform(out, -Math.PI / 2, [x0, 0, z0]);
  const span = z1 - z0;
  for (let i = 0; i <= count; i++) {
    const x = 1.9 + (i * (span - 3.8)) / count;
    box(
      wall,
      'steel',
      [x - 0.32, ground + 0.5, -0.08],
      [x + 0.32, top - 0.44, 0.64],
      color.framework,
    );
  }
  for (const y of [ground + 11.5, ground + 24.7, ground + 37.8, top - 5]) {
    box(wall, 'steel', [0.31, y, -0.03], [span - 0.33, y + 0.46, 0.85], color.steel);
    if (lod > 1) {
      for (let i = 0; i < count; i++) {
        const a = 3 + (i * (span - 5)) / count;
        face(
          wall,
          'window',
          [
            [a, y + 0.9, 0.025],
            [a + 1.61, y + 0.9, 0.025],
            [a + 1.61, y + 3.95, 0.025],
            [a, y + 3.95, 0.025],
          ],
          color.shadow,
        );
      }
    }
  }
  if (lod > 1)
    for (let i = 0; i < 3; i++) {
      const z = z0 + ((i + 0.7) * (z1 - z0)) / 3.1;
      box(out, 'steel', [x0 + 2.7, top, z - 1.8], [x0 + 8.7, top + 3.0, z + 1.8], color.vent);
    }
}

function chimney(out, f, lod) {
  const p = f.properties;
  const [x, z] = f.points[0];
  const base = plan.contactLevels[f.role];
  const n = [12, 18, 26, 40][lod];
  const top = base.ground + p.height;
  const at = (y, r) => radialRing(y, r, r, n, [x, z]);
  const long = p.flue !== undefined;
  const midpoint = (y) => p.bottomRadius + (p.radius - p.bottomRadius) * (y / p.height);
  const tint = long ? color.stack : color.short;
  const ringHeights = lod > 1 ? [0, 0.18, 0.36, 0.57, 0.74, 0.9, 0.975] : [0, 0.5, 0.975];
  loft(
    out,
    'concrete',
    [at(base.foundation, p.bottomRadius + 0.48), at(base.ground + 2.8, p.bottomRadius + 0.25)],
    color.concrete,
    { cap: false },
  );
  for (let i = 0; i < ringHeights.length - 1; i++) {
    const a = ringHeights[i] * p.height,
      b = ringHeights[i + 1] * p.height;
    const fade = lod > 1 ? 1 - (0.1 * ((i + 1) % 3)) / 2 : 1;
    loft(
      out,
      'concrete',
      [at(base.ground + a, midpoint(a)), at(base.ground + b, midpoint(b))],
      tint.map((n) => n * fade),
      { cap: false },
    );
  }
  const rim = top - p.height * 0.025;
  loft(
    out,
    'concrete',
    [at(rim, midpoint(rim - base.ground)), at(top, p.radius + 0.07)],
    color.darkStack,
    { cap: false },
  );
  const inner = p.flue ? p.flue / 2 : p.radius * 0.79;
  const shell = at(top, p.radius + 0.07),
    opening = at(top, inner);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, 'concrete', [shell[i], shell[j], opening[j], opening[i]], color.concrete);
  }
  loft(out, 'window', [at(top - 4.0, inner).toReversed(), opening.toReversed()], color.black, {
    cap: false,
  });
  const end = at(top - 4.0, inner);
  for (let i = 1; i < n - 1; i++)
    triangle(out, 'window', [end[0], end[i], end[i + 1]], color.black);
}

function ducts(out, lod) {
  const one = byRole['main-stack-1-2'].points[0];
  const three = byRole['main-stack-3'].points[0];
  for (const [start, turn, end] of [
    [
      [77, 24, -67],
      [12, 24, -50],
      [one[0], 24, one[1]],
    ],
    [
      [75, 29, 58],
      [35, 29, 55],
      [three[0], 21, three[1]],
    ],
  ]) {
    beam(out, 'steel', start, turn, lod ? 8.3 : 9.3, 6.1, color.vent);
    beam(out, 'steel', turn, end, 8.3, 6.1, color.vent);
    if (lod > 1)
      box(
        out,
        'concrete',
        [turn[0] - 1.3, -3, turn[2] - 1.45],
        [turn[0] + 1.3, turn[1] - 2.8, turn[2] + 1.45],
        color.concrete,
      );
  }
}

function coalConveyor(out, lod) {
  const group = [
    [-91, 22, -174],
    [-36, 34, -194],
    [55, 52, -104],
    [96, 55, -96],
  ];
  for (const [i, a] of group.slice(0, -1).entries()) {
    const b = group[i + 1];
    beam(out, 'cladding', a, b, 4.25, 4.1, color.pale);
    if (!lod) continue;
    for (const t of lod === 1 ? [0.5] : [0.25, 0.58, 0.83]) {
      const p = a.map((n, j) => n + (b[j] - n) * t);
      for (const s of [-1, 1]) {
        const x = p[0] + s * 2.3;
        box(
          out,
          'steel',
          [x - 0.27, -7, p[2] - 0.28],
          [x + 0.27, p[1] - 1.8, p[2] + 0.28],
          color.steel,
        );
      }
      if (lod > 1)
        beam(
          out,
          'steel',
          [p[0] - 2.3, p[1] * 0.46, p[2]],
          [p[0] + 2.3, p[1] - 1.8, p[2]],
          0.24,
          0.25,
          color.steel,
        );
    }
  }
}

function substation(out, lod) {
  if (lod === 0) return;
  const [x0, z0, x1, z1] = extrema(byRole.transformerBank.points);
  const y = plan.contactLevels.transformerBank.ground;
  const count = lod === 1 ? 5 : 11;
  for (let i = 0; i < count; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / count;
    const x = (x0 + x1) / 2;
    box(out, 'concrete', [x - 4.2, y - 1.2, z - 3.2], [x + 4.2, y + 0.4, z + 3.2], color.concrete);
    box(out, 'steel', [x - 3.1, y + 0.3, z - 2.55], [x + 3.1, y + 4.6, z + 2.55], color.framework);
    if (lod > 1)
      for (const t of [-1.8, 0, 1.8])
        box(
          out,
          'steel',
          [x + t - 0.33, y + 4.56, z - 0.4],
          [x + t + 0.33, y + 6.25, z + 0.4],
          color.darkStack,
        );
  }
}

function build(out, lod) {
  longHall(out, lod);
  ['boilerNorth', 'boilerMiddle', 'boilerSouth'].forEach((role, i) => {
    boiler(out, role, i, lod);
  });
  for (const [role, tint] of [
    ['coalFeedNorth', color.framework],
    ['exhaustWorks', color.warm],
    ['westernService', color.pale],
    ['northTransfer', color.warm],
    ['coalStockTransfer', color.warm],
    ['northeastStores', color.pale],
    ['southernService', color.roof],
  ])
    volume(out, role, tint);
  for (const f of frame.features.filter((f) => f.points.length === 1)) chimney(out, f, lod);
  ducts(out, lod);
  coalConveyor(out, lod);
  substation(out, lod);
}

export const plantSkyline = (out) => build(out, 0);
export const plantDistrict = (out) => build(out, 1);
export const plantStreet = (out) => build(out, 2);
export const plantCloseup = (out) => build(out, 3);
const recipe = 'mount-storm-power-station-model.mjs';
const camera = [360, 242, -565],
  lookAt = [36, 76, -23];
export const plantModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: plantCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The generating buildings, coal conveyor and four stacks of Mount Storm Power Station on the west bank of the cooling lake in fall 2000.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [30, 51, -22],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'metal_corrugated',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'turbine-hall-and-boiler-roofs', position: [272, 115, 106], lookAt: [84, 37, -2] },
    { name: 'stacks-and-western-ducts', position: [-191, 110, 104], lookAt: [2, 104, -2] },
    { name: 'northern-coal-conveyor', position: [119, 86, -280], lookAt: [-3, 35, -134] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mount-storm-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'plantSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'plantDistrict', 0.4],
        ['street', 'plantStreet', 0.15],
        ['closeup', 'plantCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact public-domain photographs by Raeky and geographic control from the public-domain USDA NAIP archive. OpenStreetMap data under ODbL 1.0.',
};
