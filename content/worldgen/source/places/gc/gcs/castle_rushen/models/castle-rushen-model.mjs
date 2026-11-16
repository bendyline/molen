/** Limestone keep, harbour curtain, gate buildings and round bastion at Castle Rushen. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
const [curtain, keepOutline, court, gatehouse, ward, barbican, bastion] = frame.geometry.polygons;
const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.82, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: '939189',
    dark: '6f706b',
    gate: '888983',
    stone: 'aaa69a',
    facing: '969388',
    slate: '606365',
    glass: '3d4345',
    wood: '594d3e',
    red: '915537',
    lead: 'aaa8a1',
    flag: 'a75951',
  }).map(([n, hex]) => [n, rgb(hex)]),
);

function signedArea(ring) {
  return ring.reduce((area, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return area + x * zz - xx * z;
  }, 0);
}
const wind = (ring, outer) => (signedArea(ring) < 0 === outer ? ring : ring.toReversed());
const point = (v, y) => [v[0], y, v[1]];

function roof(out, outline, y, tint, holes = []) {
  const all = [...outline, ...holes.flat()];
  const offsets = holes.map((_, i) => outline.length + holes.slice(0, i).flat().length);
  const triangles = earcut(all.flat(), offsets);
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((j) => all[j]);
    const order = signedArea([a, b, c]) < 0 ? [a, b, c] : [a, c, b];
    triangle(
      out,
      'slate',
      order.map((p) => point(p, y)),
      tint,
    );
  }
}

function stoneRing(out, outer, low, high, tint, holes = []) {
  for (const [ri, ring] of [outer, ...holes].entries()) {
    const outline = wind(ring, ri === 0);
    for (const [i, a] of outline.entries()) {
      const b = outline[(i + 1) % outline.length];
      face(out, 'limestone', [point(a, low), point(b, low), point(b, high), point(a, high)], tint);
    }
  }
  roof(out, outer, high, color.slate, holes);
}

function wallCoordinates(out, a, b) {
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  return transform(out, angle, [a[0], 0, a[1]]);
}

function crenels(out, a, b, y, thickness, gap, height, lod) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (width < 0.54) return;
  const space = Math.max(1, Math.round(width / ([2.45, 1.41, 1, 1][lod] * gap)));
  const side = wallCoordinates(out, a, b),
    step = width / space;
  for (let j = 0; j < space; j++) {
    const left = (j + 0.24) * step,
      right = (j + 0.77) * step;
    if (!lod) {
      face(
        side,
        'limestone',
        [
          [left, y, 0.14],
          [right, y, 0.14],
          [right, y + height, 0.14],
          [left, y + height, 0.14],
        ],
        color.wall,
      );
      face(
        side,
        'limestone',
        [
          [left, y + height, 0.14],
          [right, y + height, 0.14],
          [right, y + height, -thickness],
          [left, y + height, -thickness],
        ],
        color.stone,
      );
    } else box(side, 'limestone', [left, y, -thickness], [right, y + height, 0.14], color.wall);
    if (lod > 1)
      box(
        side,
        'ashlar',
        [left - 0.018, y + height - 0.11, -thickness - 0.018],
        [right + 0.018, y + height, 0.192],
        color.stone,
      );
  }
}

function hole(out, cx, y, w, h, z, lod, rounded = false, door = false) {
  const left = cx - w / 2,
    right = cx + w / 2,
    slot = door ? 'timber' : 'accent',
    tint = door ? color.wood : color.glass;
  const panel = (slot, x0, x1, y0, y1, zz, t) =>
    face(
      out,
      slot,
      [
        [x0, y0, zz],
        [x1, y0, zz],
        [x1, y1, zz],
        [x0, y1, zz],
      ],
      t,
    );
  if (lod) panel('ashlar', left - 0.14, right + 0.14, y - 0.12, y + h + 0.11, z, color.stone);
  if (!rounded || !lod) panel(slot, left, right, y, y + h, z + 0.021, tint);
  else {
    const spring = y + h - w * 0.34;
    panel(slot, left, right, y, spring, z + 0.021, tint);
    const segments = lod > 2 ? 12 : 8;
    for (let i = 0; i < segments; i++) {
      const at = (a) => [cx + (Math.cos(a) * w) / 2, spring + Math.sin(a) * w * 0.34, z + 0.021];
      triangle(
        out,
        slot,
        [[cx, spring, z + 0.021], at((i * Math.PI) / segments), at(((i + 1) * Math.PI) / segments)],
        tint,
      );
    }
  }
  if (lod > 1 && w > 0.71)
    panel('ashlar', cx - 0.034, cx + 0.034, y + 0.04, y + h * 0.87, z + 0.037, color.facing);
}

function tower(out, center, width, depth, angle, eave, lod) {
  const side = transform(out, angle, [center[0], 0, center[1]]);
  const x = width / 2,
    z = depth / 2;
  box(side, 'limestone', [-x, 12.16, -z], [x, eave, z], color.wall);
  box(
    side,
    'ashlar',
    [-x - 0.08, eave - 0.26, -z - 0.09],
    [x + 0.08, eave - 0.09, z + 0.08],
    color.facing,
  );
  const corners = [
    [-x, z],
    [x, z],
    [x, -z],
    [-x, -z],
  ];
  for (const [i, a] of corners.entries()) {
    const b = corners[(i + 1) % corners.length],
      faceOut = wallCoordinates(side, a, b);
    crenels(side, a, b, eave, 0.64, 1.24, 0.93, lod);
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const u of lod ? [0.3, 0.69] : [0.5])
      hole(faceOut, span * u, eave - 3.26, 0.44, 1.14, 0.018, lod);
    if (lod > 1 && i % 2 === 0) hole(faceOut, span / 2, eave - 6.9, 0.72, 1.53, 0.02, lod, true);
  }
}

function innerCastle(out, lod) {
  const roofY = plan.dimensions.keepCurtainHeight;
  const outline = wind(keepOutline, true);
  stoneRing(out, outline, -2.0, roofY, color.wall, [court]);
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length],
      span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (span < 1.0) continue;
    const side = wallCoordinates(out, a, b);
    if (lod) {
      for (let j = 0; j < Math.max(1, Math.round(span / 4.2)); j++) {
        const x = ((j + 0.53) * span) / Math.max(1, Math.round(span / 4.2));
        hole(side, x, 12.0, 0.46, 1.16, 0.024, lod);
        if (lod > 1) hole(side, x, 5.4 + (i % 3) * 0.6, 0.83, 1.72, 0.03, lod, i % 3 === 0);
      }
    }
    if (lod) crenels(out, a, b, roofY, 0.48, 1.72, 0.86, lod);
  }
  const north = plan.dimensions.highestTower - 0.93;
  for (const [center, w, d, height] of [
    [[8.4, 2.34], 12.3, 9.37, north],
    [[-2.45, 8.4], 6.35, 7.07, 19.67],
    [[3.1, 24.82], 6.2, 6.67, 20.28],
    [[17.83, 15.19], 6.41, 7.1, 20.34],
  ])
    tower(out, center, w, d, -0.318, height, lod);
  if (lod > 1) {
    beam(
      out,
      'timber',
      [10.75, north - 0.04, 0.11],
      [10.75, north + 2.77, 0.11],
      0.054,
      0.054,
      color.dark,
    );
    face(
      out,
      'accent',
      [
        [10.75, north + 2.65, 0.13],
        [12.11, north + 2.43, 0.13],
        [12.1, north + 1.72, 0.13],
        [10.75, north + 1.86, 0.13],
      ],
      color.flag,
    );
  }
}

function enclosure(out, lod) {
  const outline = lod ? curtain : [0, 5, 6, 10, 14, 18, 22, 25, 47, 50, 54].map((i) => curtain[i]);
  const outer = wind(outline, true);
  for (const [i, a] of outer.entries()) {
    const b = outer[(i + 1) % outer.length];
    const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if ((a[0] > 44 && b[0] > 44) || width < 0.16) continue;
    const side = wallCoordinates(out, a, b),
      averageX = (a[0] + b[0]) / 2;
    const base = averageX > 29 ? -4.65 : -2.68;
    const level = plan.dimensions.siteCurtainHeight + (averageX > 29 ? -0.93 : 0);
    box(side, 'limestone', [0, base, -1.24], [width, level, 0.14], color.gate);
    if (lod > 1 && width > 6) crenels(out, a, b, level, 0.67, 1.58, 0.69, lod);
  }
  stoneRing(out, gatehouse, -4.1, 10.52, color.gate);
  stoneRing(out, ward, -3.12, 6.82, color.wall);
  stoneRing(out, barbican, -4.28, 5.42, color.gate);
  stoneRing(out, bastion, -1.6, 3.98, color.wall);
  for (const [perimeter, h] of [
    [gatehouse, 10.52],
    [barbican, 5.42],
    [bastion, 3.98],
  ]) {
    const line = wind(perimeter, true);
    for (const [i, a] of line.entries()) {
      const b = line[(i + 1) % line.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 2.2) continue;
      const wall = wallCoordinates(out, a, b);
      if (lod) crenels(out, a, b, h, 0.41, 1.42, 0.74, lod);
      if (lod && len > 6) {
        hole(wall, len * 0.66, h - 2.97, 0.58, 1.18, 0.03, lod);
        if (len > 10) hole(wall, len * 0.23, h - 2.97, 0.65, 1.32, 0.03, lod);
      }
    }
  }
  const entry = transform(out, Math.PI / 2, [41.03, 0.01, 1.05]);
  box(entry, 'limestone', [-3.78, -3.3, -5.65], [-1.38, 5.82, 0.25], color.gate);
  box(entry, 'limestone', [1.38, -3.3, -5.65], [3.72, 5.82, 0.25], color.gate);
  const bottom = plan.dimensions.entranceGrade;
  const steps = [4, 7, 11, 15][lod],
    radius = 1.39;
  const at = (a, offset, z) => [
    (radius + offset) * Math.cos(a),
    1.72 + (1.22 + offset) * Math.sin(a),
    z,
  ];
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    const p = at(a, 0.23, 0.28),
      q = at(b, 0.23, 0.28);
    face(entry, 'limestone', [q, p, [p[0], 5.81, p[2]], [q[0], 5.81, q[2]]], color.gate);
    face(
      entry,
      'ashlar',
      [at(b, 0, 0.29), at(a, 0, 0.29), at(a, 0.23, 0.29), at(b, 0.23, 0.29)],
      color.stone,
    );
    face(
      entry,
      'limestone',
      [at(a, 0, -5.55), at(b, 0, -5.55), at(b, 0, 0.29), at(a, 0, 0.29)],
      color.dark,
    );
  }
  box(entry, 'timber', [-1.33, bottom, -2.28], [1.34, 1.72, -2.19], color.wood);
  if (lod)
    for (let i = 0; i < 7; i++) {
      const x = -1.28 + i * 0.4;
      beam(entry, 'timber', [x, bottom, -2.17], [x, 1.72, -2.17], 0.05, 0.015, color.dark);
    }
}

function build(out, lod) {
  enclosure(out, lod);
  innerCastle(out, lod);
}
export const castleSkyline = (out) => build(out, 0);
export const castleDistrict = (out) => build(out, 1);
export const castleStreet = (out) => build(out, 2);
export const castleCloseup = (out) => build(out, 3);

const recipe = 'castle-rushen-model.mjs';
const camera = [87, 35, 102],
  lookAt = [13, 9, 0];
export const castleModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: castleCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Castle Rushen’s limestone keep with four crenellated towers, the curtain and separate harbour gate buildings in Castletown.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [42, 57, -24],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: curtain,
    minimumCoverage: 0.92,
    basis: 'Mapped curtain footprint surrounds the castle mass and gate structures.',
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'stone_ashlar', 'slate', 'wood_plain'],
  qaCameras: [
    { name: 'harbour-gates-and-keep', position: [74, 12, -44], lookAt: [13, 9, 3] },
    { name: 'crenellated-limestone-towers', position: [51, 26, 47], lookAt: [8, 14, 9] },
    { name: 'keep-court-and-outer-curtain', position: [-39, 63, -44], lookAt: [10, 7, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'castletown-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'castleSkyline',
    errorMeters: 0.67,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'castleDistrict', 0.31],
        ['street', 'castleStreet', 0.12],
        ['closeup', 'castleCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data under ODbL. The exact harbour photograph from Qualla was released to the public domain by Paul Dyer.',
};
