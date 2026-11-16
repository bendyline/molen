/** The red-granite observation tower and ground-floor café on Pyynikki Ridge. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { section } = plan;
const [outline, shaftFootprint] = read('map-frame').geometry.polygons;
const grid = read('terrain-grid');
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  dressed: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.88, metallic: 0 },
  roofing: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.1 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68, metallic: 0.06 },
};
const tone = Object.fromEntries(
  Object.entries({
    granite: 'ab8074',
    light: 'b78c80',
    darkStone: '946f65',
    stoneTrim: 'bf9a88',
    roof: '555552',
    deck: '827c70',
    sash: '938674',
    glass: '465354',
    shadow: '554d46',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const hp = ([x, z], y) => [x, y, z];
function ground([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function panel(out, slot, p, n, color) {
  const actual = normalFor(...p);
  const points = actual.reduce((sum, x, k) => sum + x * n[k], 0) > 0 ? p : p.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, points, color);
}
function plane(out, slot, points, y, color) {
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3)
    panel(
      out,
      slot,
      indices.slice(i, i + 3).map((k) => hp(points[k], y)),
      up,
      color,
    );
}
const span = (center, width) => [center - width / 2, center + width / 2];
// Each opening has separate sill, head, recess and glass; the holes survive at lower detail.
function apertureWall(out, a, b, y0, y1, windows, color, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const n = [dz / length, 0, -dx / length];
  const at = (s, y, d = 0) => [a[0] + s * dx + n[0] * d, y, a[1] + s * dz + n[2] * d];
  const quad = (slot, l, r, bottom, top, d, tint) =>
    panel(out, slot, [at(l, bottom, d), at(r, bottom, d), at(r, top, d), at(l, top, d)], n, tint);
  let end = 0;
  for (const { center, width, bottom, top, door } of windows) {
    const [l, r] = span(center, width / length);
    const depth = 0.19;
    quad('granite', end, l, y0, y1, 0, color);
    quad('granite', l, r, y0, bottom, 0, color);
    quad('granite', l, r, top, y1, 0, color);
    quad('glazing', l, r, bottom, top, -depth, door ? tone.shadow : tone.glass);
    for (const [u, y, v, h] of [
      [l, bottom, r, bottom],
      [r, bottom, r, top],
      [r, top, l, top],
      [l, top, l, bottom],
    ]) {
      const reveal = [at(u, y), at(v, h), at(v, h, -depth), at(u, y, -depth)];
      face(out, 'dressed', reveal.toReversed(), tone.darkStone);
    }
    if (lod >= 1) {
      quad(
        'dressed',
        l - 0.055 / length,
        r + 0.055 / length,
        top,
        top + 0.105,
        0.027,
        tone.stoneTrim,
      );
      quad(
        'dressed',
        l - 0.075 / length,
        r + 0.075 / length,
        bottom - 0.081,
        bottom,
        0.061,
        tone.stoneTrim,
      );
    }
    if (lod >= 2)
      quad(
        'dressed',
        center - 0.025 / length,
        center + 0.025 / length,
        bottom,
        top,
        -depth + 0.032,
        tone.sash,
      );
    if (lod === 3 && !door)
      quad(
        'dressed',
        l,
        r,
        mix(bottom, top, 0.62),
        mix(bottom, top, 0.62) + 0.04,
        -depth + 0.032,
        tone.sash,
      );
    end = r;
  }
  quad('granite', end, 1, y0, y1, 0, color);
}
function cafe(out, lod) {
  const top = section.cafeRoof;
  const base = Math.min(...outline.map(ground), ...shaftFootprint.map(ground)) - 0.32;
  // The long walls follow the surveyed footprint; the café roof is a simple sheet roof estimate.
  const counts = new Map([
    [20, 1],
    [21, 1],
    [23, 1],
    [24, 2],
    [25, 4],
    [26, 1],
    [27, 4],
  ]);
  for (let i = 0; i < outline.length; i++) {
    if (i < 19) continue; // the round part shares the tower wall
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const count = counts.get(i) ?? 0;
    const door = i === 21 || i === 26;
    const pavement = mix(ground(a), ground(b), 0.5);
    const windows = Array.from({ length: count }, (_, j) => ({
      center: (j + 1) / (count + 1),
      width: door ? 1.35 : 0.98,
      bottom: Math.min(door ? pavement + 0.1 : pavement + 0.84, top - 1.42),
      top: top - (door ? 0.42 : 0.53),
      door,
    }));
    apertureWall(out, a, b, base, top, windows, i % 2 ? tone.granite : tone.light, lod);
    if (lod > 0) {
      const n = normalFor(hp(a, top), hp(b, top), hp(b, top + 0.15));
      panel(
        out,
        'dressed',
        [hp(a, top - 0.13), hp(b, top - 0.13), hp(b, top), hp(a, top)].map((p) =>
          p.map((t, k) => t + n[k] * 0.025),
        ),
        n,
        tone.darkStone,
      );
    }
  }
  plane(out, 'roofing', outline, top, tone.roof);
}
function tower(out, lod) {
  const n = [16, 24, 32, 40][lod];
  const ring = (y, r) => radialRing(y, r, r, n, [0, 0], Math.PI / n);
  const profile = (slot, rows, color) =>
    loft(
      out,
      slot,
      rows.map(([y, r]) => ring(y, r)),
      color,
      { cap: false },
    );
  const bottom = Math.min(...shaftFootprint.map(ground)) - 0.45;
  profile(
    'granite',
    [
      [bottom, 3.08],
      [1.28, 3.08],
      [1.53, 2.96],
      [section.lanternBase, 2.88],
    ],
    tone.granite,
  );
  profile(
    'dressed',
    [
      [section.lanternBase, 2.88],
      [19.25, 3.0],
      [19.4, 3.12],
      [19.56, 3.12],
    ],
    tone.stoneTrim,
  );
  const lantern = ring(0, 3.1)
    .map(([x, , z]) => [x, z])
    .toReversed();
  for (let i = 0; i < n; i++) {
    const windows =
      i % (n / 8) === 0
        ? [{ center: 0.5, width: [0.76, 0.58, 0.5, 0.42][lod], bottom: 20.02, top: 21.78 }]
        : [];
    apertureWall(
      out,
      lantern[i],
      lantern[(i + 1) % n],
      19.56,
      22.35,
      windows,
      i % 2 ? tone.granite : tone.light,
      lod,
    );
  }
  profile(
    'dressed',
    [
      [22.35, 3.1],
      [22.53, 3.26],
      [22.75, 3.33],
      [22.92, 3.33],
    ],
    tone.stoneTrim,
  );
  profile(
    'granite',
    [
      [22.92, 3.29],
      [24.17, 3.29],
    ],
    tone.granite,
  );
  profile(
    'dressed',
    [
      [24.17, 3.29],
      [24.24, 3.38],
      [24.43, 3.38],
    ],
    tone.stoneTrim,
  );
  const outer = ring(24.43, 3.38),
    inner = ring(24.43, 3.02);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    panel(out, 'dressed', [outer[i], outer[j], inner[j], inner[i]], up, tone.stoneTrim);
  }
  profile(
    'granite',
    [
      [24.43, 3.02],
      [23.02, 3.02],
    ],
    tone.darkStone,
  );
  plane(
    out,
    'dressed',
    inner.map(([x, , z]) => [x, z]),
    23.02,
    tone.deck,
  );
  box(out, 'granite', [-1.22, 23.01, -0.99], [0.46, 25.74, 0.78], tone.granite);
  box(out, 'roofing', [-1.29, 25.74, -1.06], [0.53, section.towerHeight, 0.85], tone.roof);
  if (lod >= 1) {
    const cuts = lod === 1 ? [7.0, 13.4] : [5.4, 9.15, 12.7, 16.4];
    for (const [j, y] of cuts.entries()) {
      const a = [-1.5, 0.66, 2.72, 1.49][j];
      const r = mix(3.08, 2.88, y / 18.9) + 0.025;
      const dir = [Math.cos(a), 0, Math.sin(a)],
        tangent = [-dir[2], 0, dir[0]];
      const p = (u, dy, d) => [
        dir[0] * (r + d) + tangent[0] * u,
        y + dy,
        dir[2] * (r + d) + tangent[2] * u,
      ];
      panel(
        out,
        'dressed',
        [p(-0.25, -0.08, 0), p(0.25, -0.08, 0), p(0.25, 0.93, 0), p(-0.25, 0.93, 0)],
        dir,
        tone.darkStone,
      );
      panel(
        out,
        'glazing',
        [p(-0.15, 0.04, 0.018), p(0.15, 0.04, 0.018), p(0.15, 0.8, 0.018), p(-0.15, 0.8, 0.018)],
        dir,
        tone.shadow,
      );
    }
  }
}
function build(out, lod) {
  tower(out, lod);
  cafe(out, lod);
}
export const towerSkyline = (out) => build(out, 0);
export const towerDistrict = (out) => build(out, 1);
export const towerStreet = (out) => build(out, 2);
export const towerCloseup = (out) => build(out, 3);
const camera = [-39, 19, 39],
  lookAt = [-4.2, 12, 0],
  recipe = 'pyynikki-observation-tower-model.mjs';
export const towerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: towerCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The round red-granite observation tower on Pyynikki Ridge, with its upper windows, open viewing deck and attached ground-floor café.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-18, 28, 14],
  portableGroundY: -0.52,
  mediumFiContext: {
    scale: 0.92,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Mapped café and tower ground-floor envelope.',
  },
  embeddedCanonicalGraphs: ['stone_granite', 'stone_ashlar', 'metal_standing_seam'],
  qaCameras: [
    { name: 'cafe-and-granite-shaft', position: [-23, 8, 27], lookAt: [-7, 6.8, 2.9] },
    { name: 'open-observation-deck-and-cornice', position: [23, 32, 18], lookAt: [0, 21.5, 0] },
    { name: 'ridge-facing-window-ring', position: [21, 16, -32], lookAt: [0, 15, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'towerSkyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'towerDistrict', 0.26],
        ['street', 'towerStreet', 0.11],
        ['closeup', 'towerCloseup', 0.043],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap outlines are ODbL. The selected reference is an own-work public-domain release by Juho Paavisto.',
};
