/** The freestanding 1983 Stanford Clock Tower, represented in February 2009. */
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
  frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const {
  towerHalf,
  platformTop,
  baseOpeningHead,
  shaftBottom,
  shaftTop,
  clockCenter,
  clockRadius,
  belfryBottom,
  belfryHead,
  towerTop,
  pergola,
} = plan.section;
const concrete = { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 };
const surfaces = {
  stone: concrete,
  terrace: concrete,
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.73, metallic: 0.41 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.63, metallic: 0.04 },
};
const colors = Object.fromEntries(
  Object.entries({
    stone: 'bcad8c',
    inset: 'b4a486',
    trim: 'bdab8b',
    stoneShade: '9c8a67',
    terrace: 'bdb2a1',
    stepEdge: '946e57',
    glaze: '586364',
    joinery: '45433a',
    clock: '4c5756',
    highlight: '747b73',
    bronze: '586e62',
    bronzeShadow: '394c45',
    cap: '51584c',
    ceiling: '55594b',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
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
        [0.5, 1],
      ],
      tint,
    );
}

const sideFrames = [
  { n: [0, 0, 1], point: (u, y, d) => [u, y, d] },
  { n: [0, 0, -1], point: (u, y, d) => [-u, y, -d] },
  { n: [1, 0, 0], point: (u, y, d) => [d, y, -u] },
  { n: [-1, 0, 0], point: (u, y, d) => [-d, y, u] },
];
function patch(out, slot, e, x0, x1, y0, y1, d, tint) {
  face(
    out,
    slot,
    [e.point(x0, y0, d), e.point(x1, y0, d), e.point(x1, y1, d), e.point(x0, y1, d)],
    e.n,
    tint,
  );
}
function stoneShaft(out, lod) {
  const h = towerHalf,
    panelEdge = 1.43;
  for (const e of sideFrames) {
    for (const s of [-1, 1]) {
      const a = s < 0 ? -h : panelEdge,
        b = s < 0 ? -panelEdge : h;
      patch(out, 'stone', e, a, b, platformTop, shaftTop, h, colors.stone);
    }
    patch(out, 'stone', e, -panelEdge, panelEdge, baseOpeningHead, shaftBottom, h, colors.trim);
    patch(out, 'stone', e, -panelEdge, panelEdge, shaftBottom, shaftTop, h - 0.06, colors.inset);
    patch(out, 'stone', e, -h, h, shaftTop, belfryBottom, h, colors.stone);
    patch(
      out,
      'detail',
      e,
      -panelEdge,
      panelEdge,
      platformTop + 0.15,
      baseOpeningHead,
      h - 0.24,
      colors.glaze,
    );
    patch(
      out,
      'terrace',
      e,
      -panelEdge,
      panelEdge,
      platformTop,
      platformTop + 0.15,
      h - 0.16,
      colors.terrace,
    );
    if (lod) {
      for (const s of [-1, 1]) {
        const u = s * panelEdge;
        patch(
          out,
          'stone',
          e,
          u - 0.035,
          u + 0.035,
          shaftBottom + 0.05,
          shaftTop - 0.09,
          h + 0.012,
          colors.stoneShade,
        );
        patch(
          out,
          'detail',
          e,
          u - 0.04,
          u + 0.04,
          platformTop + 0.15,
          baseOpeningHead,
          h - 0.195,
          colors.joinery,
        );
      }
      patch(
        out,
        'detail',
        e,
        -0.045,
        0.045,
        platformTop + 0.15,
        baseOpeningHead,
        h - 0.202,
        colors.joinery,
      );
      patch(
        out,
        'detail',
        e,
        -panelEdge,
        panelEdge,
        baseOpeningHead - 0.062,
        baseOpeningHead,
        h - 0.205,
        colors.joinery,
      );
    }
    if (lod >= 2) {
      for (const y of [shaftBottom + 0.09, shaftTop - 0.095])
        patch(
          out,
          'stone',
          e,
          -panelEdge,
          panelEdge,
          y - 0.028,
          y + 0.028,
          h - 0.042,
          colors.stoneShade,
        );
      for (const s of [-1, 1]) {
        const u = s * panelEdge;
        face(
          out,
          'stone',
          [
            e.point(u, platformTop + 0.15, h),
            e.point(u, baseOpeningHead, h),
            e.point(u, baseOpeningHead, h - 0.24),
            e.point(u, platformTop + 0.15, h - 0.24),
          ],
          e.point(-s, 0, 0),
          colors.stoneShade,
        );
      }
    }
  }
  box(out, 'stone', 0, belfryBottom - 0.28, 0, 2 * h, 0.3, 2 * h, colors.stoneShade);
  const corner = 0.75;
  for (const x of [-h + corner / 2, h - corner / 2])
    for (const z of [-h + corner / 2, h - corner / 2])
      box(
        out,
        'stone',
        x,
        belfryBottom,
        z,
        corner,
        belfryHead - belfryBottom,
        corner,
        colors.stone,
      );
  box(out, 'stone', 0, belfryHead, 0, 2 * h, towerTop - belfryHead, 2 * h, colors.stone);
  box(out, 'detail', 0, towerTop - 0.04, 0, 2 * h + 0.048, 0.066, 2 * h + 0.048, colors.cap);
  if (lod >= 2) {
    for (const e of sideFrames) {
      patch(
        out,
        'stone',
        e,
        -h + corner,
        h - corner,
        belfryBottom,
        belfryBottom + 0.088,
        h + 0.015,
        colors.trim,
      );
      patch(
        out,
        'stone',
        e,
        -h + corner,
        h - corner,
        belfryHead - 0.072,
        belfryHead + 0.009,
        h + 0.015,
        colors.trim,
      );
    }
  }
}
function dial(out, e, lod) {
  const n = lod === 0 ? 16 : lod === 1 ? 24 : 36,
    d = towerHalf + 0.045;
  const r = clockRadius,
    w = lod === 0 ? 0.12 : 0.075;
  const p = (t, length, depth = d) =>
    e.point(Math.sin(t) * length, clockCenter + Math.cos(t) * length, depth);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(out, 'bronze', [p(a, r - w), p(a, r), p(b, r), p(b, r - w)], e.n, colors.clock);
  }
  for (let i = 0; i < 12; i++) {
    const t = (i * 2 * Math.PI) / 12,
      half = i % 3 === 0 ? 0.037 : 0.022;
    face(
      out,
      'bronze',
      [
        p(t - half, r - 0.235),
        p(t - half, r - 0.04),
        p(t + half, r - 0.04),
        p(t + half, r - 0.235),
      ],
      e.n,
      colors.clock,
    );
    if (lod === 3 && i % 3 === 0)
      face(
        out,
        'bronze',
        [
          p(t + 0.07, r - 0.21),
          p(t + 0.07, r - 0.042),
          p(t + 0.091, r - 0.042),
          p(t + 0.091, r - 0.21),
        ],
        e.n,
        colors.highlight,
      );
  }
  for (const [theta, length, width] of [
    [-0.38, 0.73, 0.051],
    [0.72, 0.56, 0.084],
  ]) {
    if (lod === 0) {
      const [x, y] = [Math.sin(theta) * length, clockCenter + Math.cos(theta) * length];
      face(
        out,
        'bronze',
        [
          e.point(-width, clockCenter - 0.061, d),
          e.point(width, clockCenter - 0.061, d),
          e.point(x + width * 0.44, y, d),
          e.point(x - width * 0.44, y, d),
        ],
        e.n,
        colors.clock,
      );
    } else {
      beam(
        out,
        'bronze',
        e.point(0, clockCenter, d + 0.011),
        p(theta, length, d + 0.011),
        width,
        0.036,
        colors.clock,
      );
    }
  }
}
function bell(out, x, z, r, lod) {
  const steps = lod >= 2 ? 12 : 6;
  const profile = [
    [belfryHead - 0.4, 0.22],
    [belfryHead - 0.71, 0.54],
    [belfryHead - 1.39, 0.74],
    [belfryHead - 1.66, 0.98],
    [belfryHead - 1.72, 1],
  ];
  const rings = profile.map(([y, f]) =>
    Array.from({ length: steps }, (_, i) => {
      const t = (2 * Math.PI * i) / steps;
      return [x + r * f * Math.cos(t), y, z + r * f * Math.sin(t)];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < steps; i++) {
      const k = (i + 1) % steps,
        a = rings[j - 1],
        b = rings[j];
      face(
        out,
        'bronze',
        [a[i], a[k], b[k], b[i]],
        [b[i][0] + b[k][0] - 2 * x, 0, b[i][2] + b[k][2] - 2 * z],
        colors.bronze,
      );
    }
  const lip = rings.at(-1),
    y = lip[0][1] - 0.012;
  for (let i = 0; i < steps; i++)
    face(out, 'bronze', [[x, y, z], lip[i], lip[(i + 1) % steps]], [0, -1, 0], colors.bronzeShadow);
  if (lod >= 2)
    beam(
      out,
      'bronze',
      [x, belfryHead - 1.63, z],
      [x, belfryHead - 1.94, z],
      0.13,
      0.12,
      colors.bronzeShadow,
    );
}
function towerBase(out, lod) {
  const bottom = -0.16;
  for (const [width, top] of [
    [7.18, 0.22],
    [6.59, 0.41],
    [6.02, platformTop],
  ]) {
    box(out, 'terrace', 0, bottom, 0, width, top - bottom, width, colors.terrace);
    if (lod >= 1)
      box(out, 'terrace', 0, top - 0.058, 0, width + 0.055, 0.058, width + 0.055, colors.stepEdge);
  }
  for (const { bounds, axis, roof } of pergola) {
    const [a, b, c, d] = bounds,
      x = (a + b) / 2,
      z = (c + d) / 2;
    const w = b - a,
      l = d - c;
    box(out, 'terrace', x, -0.15, z, w + 0.27, platformTop + 0.15, l + 0.27, colors.terrace);
    box(out, 'stone', x, roof - 0.23, z, w + 0.1, 0.25, l + 0.1, colors.stone);
    box(out, 'terrace', x, roof + 0.016, z, w + 0.16, 0.078, l + 0.16, colors.terrace);
    for (const pos of lod ? [0.19, 0.52, 0.84] : [0.28, 0.82])
      for (const s of [-1, 1]) {
        const px = axis === 'x' ? a + pos * w : x + s * (w / 2 - 0.32);
        const pz = axis === 'z' ? c + pos * l : z + s * (l / 2 - 0.32);
        box(out, 'stone', px, platformTop, pz, 0.34, roof - platformTop - 0.23, 0.34, colors.trim);
        if (lod >= 2) box(out, 'stone', px, roof - 0.36, pz, 0.43, 0.16, 0.43, colors.trim);
      }
    if (lod === 3)
      for (let i = 1; i < 6; i++) {
        const q = i / 6;
        if (axis === 'x')
          box(out, 'detail', a + q * w, roof - 0.31, z, 0.112, 0.094, l - 0.18, colors.ceiling);
        else box(out, 'detail', x, roof - 0.31, c + q * l, w - 0.18, 0.094, 0.112, colors.ceiling);
      }
  }
}
function buildLevel(out, lod) {
  towerBase(out, lod);
  stoneShaft(out, lod);
  for (const e of sideFrames) dial(out, e, lod);
  if (lod) {
    box(out, 'bronze', 0, belfryHead - 0.39, 0, 2.94, 0.31, 0.28, colors.bronzeShadow);
    bell(out, -0.65, -0.35, 0.52, lod);
    bell(out, 0.61, 0.17, 0.62, lod);
    if (lod >= 2) {
      bell(out, 0.1, -0.66, 0.36, lod);
      bell(out, -0.31, 0.62, 0.44, lod);
    }
  } else bell(out, 0, 0, 0.62, lod);
}
export const stanfordSkyline = (out) => buildLevel(out, 0);
export const stanfordDistrict = (out) => buildLevel(out, 1);
export const stanfordStreet = (out) => buildLevel(out, 2);
export const stanfordCloseup = (out) => buildLevel(out, 3);

const recipe = 'stanford-clock-tower-model.mjs',
  camera = [-19, 13, -24],
  lookAt = [1.25, 7.3, 1.8];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'stanfordDistrict', 0.145],
    ['street', 'stanfordStreet', 0.048],
    ['closeup', 'stanfordCloseup', 0.018],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const stanfordClockModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: stanfordCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Stanford Clock Tower in February 2009, with tan inset panels, four open belfry faces, bronze dials, glazed base and adjoining colonnades.',
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
    basis:
      'Estimated extent of the freestanding shaft and two attached pergola arms, anchored to the campus intersection.',
  },
  mediumFiContext: {
    scale: 0.96,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_bronze_cast'],
  qaCameras: [
    { name: 'lasuen-mall-clock-face-and-steps', position: [-10, 8, -23], lookAt: [0, 7.65, 0] },
    { name: 'open-belfry-and-bronze-bells', position: [-8, 13.8, -11], lookAt: [0, 12.65, 0] },
    { name: 'two-pergola-arms-and-glazed-base', position: [18, 10, 18], lookAt: [2.5, 4.7, 2.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-stanford-clock-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'stanfordSkyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Public-domain USGS USDA NAIP map, OpenStreetMap ODbL 1.0 campus grid and the exact public-domain Stacalusa photograph.',
};
