/** Tung Wah Hospital's 1934 Main Block in Sheung Wan, May 2025. */
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

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  relief = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons,
  [start, end] = S.axis.map((i) => outline[i]);
const axis = end.map((v, i) => v - start[i]),
  [c, s] = axis.map((v) => v / Math.hypot(...axis));
const world = (x, y, z) => [x * c - z * s, y, x * s + z * c];
const ring = outline.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    cream: 'd6c5a3',
    shadow: 'c5b594',
    band: 'ad8070',
    buff: 'c1ab85',
    pale: 'e1d6bb',
    stone: 'c8c5b9',
    roof: '9c9c8d',
    glass: '566264',
    dark: '513d37',
    plaque: 'a78a55',
  }).map(([key, v]) => [key, rgb(v)]),
);
const up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
function ground([x, z]) {
  const [a, , b] = world(x, 0, z),
    u = (a - relief.origin[0]) / relief.stepMeters,
    v = (b - relief.origin[1]) / relief.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = relief.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    relief.modelDatumElevationMeters
  );
}
function draw(out, slot, p, dir, color) {
  const n = normalFor(...p);
  if (!n.some(Boolean)) return;
  (p.length === 3 ? triangle : face)(
    out,
    slot,
    n.reduce((sum, v, i) => sum + v * dir[i], 0) > 0 ? p : p.toReversed(),
    color,
  );
}
function wall(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = dz / len,
    nz = -dx / len;
  return {
    len,
    n: world(nx, 0, nz),
    p: (u, y, d = 0) => world(a[0] + (dx * u) / len + nx * d, y, a[1] + (dz * u) / len + nz * d),
  };
}
const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function plane(out, slot, polygon, y, color) {
  const indices = earcut(polygon.flat());
  for (let i = 0; i < indices.length; i += 3)
    draw(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => world(polygon[j][0], y, polygon[j][1])),
      up,
      color,
    );
}
function panel(out, slot, f, l, r, b, t, d, color) {
  draw(out, slot, [f.p(l, b, d), f.p(r, b, d), f.p(r, t, d), f.p(l, t, d)], f.n, color);
}
function box(out, slot, range, lo, hi, color) {
  const p = rectangle(...range);
  for (let i = 0; i < p.length; i++) {
    const f = wall(p[i], p[(i + 1) % p.length]);
    panel(out, slot, f, 0, f.len, lo, hi, 0, color);
  }
  plane(out, slot, p, hi, color);
}
function sashes(out, f, u, y, w, h, lod) {
  const r = w / 2;
  if (lod >= 1)
    panel(out, 'trim', f, u - r - 0.075, u + r + 0.075, y - 0.1, y + h + 0.11, 0.071, tone.pale);
  panel(out, 'inset', f, u - r, u + r, y, y + h, 0.09, tone.glass);
  if (lod >= 2) {
    for (const d of [-0.31, 0, 0.31])
      panel(out, 'trim', f, u + w * d - 0.022, u + w * d + 0.022, y, y + h, 0.115, tone.pale);
    for (const h0 of [0.27, 0.51, 0.75])
      panel(out, 'trim', f, u - r, u + r, y + h * h0 - 0.025, y + h * h0 + 0.025, 0.115, tone.pale);
  }
  if (lod >= 3)
    panel(out, 'trim', f, u - r - 0.14, u + r + 0.14, y - 0.13, y - 0.055, 0.14, tone.stone);
}
function block(out, lod) {
  const top = S.parapet;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      f = wall(a, b);
    let low0 = Math.min(S.floor - 0.28, ground(a) - 0.33),
      low1 = Math.min(S.floor - 0.28, ground(b) - 0.33);
    draw(
      out,
      'render',
      [f.p(0, low0), f.p(f.len, low1), f.p(f.len, top), f.p(0, top)],
      f.n,
      i < 2 ? tone.cream : tone.shadow,
    );
    for (const y of [S.floor + 0.17, 1.1, 4.15, 7.23, 10.31, 13.43, 16.31, 17.0]) {
      if (lod === 0 && y < 16.1) continue;
      panel(
        out,
        'trim',
        f,
        0,
        f.len,
        y,
        y + (y > 16.3 ? 0.28 : 0.13),
        0.065,
        y > 16.3 ? tone.pale : tone.band,
      );
    }
    if (lod === 0 || f.len < 3.3) continue;
    const n = Math.max(1, Math.round(f.len / (lod === 1 ? 5.2 : 3.1)));
    for (let j = 0; j < n; j++)
      for (const y of [1.69, 4.68, 7.76, 10.85, 13.95]) {
        sashes(out, f, (f.len * (j + 0.5)) / n, y, Math.min(1.63, (f.len / n) * 0.55), 1.81, lod);
      }
    if (lod >= 2)
      for (let j = 0; j < n; j++) {
        sashes(
          out,
          f,
          (f.len * (j + 0.5)) / n,
          -0.94,
          Math.min(1.03, (f.len / n) * 0.46),
          1.12,
          lod,
        );
      }
  }
  plane(out, 'roof', ring, top - 0.04, tone.roof);
  if (lod >= 1) {
    box(out, 'render', [-9.3, -4.5, -3.7, 0.65], top - 0.05, top + 1.51, tone.cream);
    if (lod >= 2) box(out, 'roof', [-9.48, -4.3, -3.86, 0.81], top + 1.5, top + 1.72, tone.roof);
  }
}
function porch(out, lod, x, index) {
  const z = S.streetFront,
    y = S.floor,
    front = z - S.porchDepth,
    left = x - 3.2,
    right = x + 3.2;
  const cap = y + 4.15;
  box(out, 'trim', [left - 0.15, right + 0.15, front - 0.14, z + 0.01], cap, cap + 0.36, tone.pale);
  box(
    out,
    'trim',
    [left - 0.23, right + 0.23, front - 0.19, z + 0.06],
    cap + 0.36,
    cap + 0.57,
    tone.stone,
  );
  for (const dx of [-2.12, 2.12]) {
    const [ax, , az] = world(x + dx, 0, front + 0.34);
    const n = lod === 0 ? 6 : lod === 1 ? 8 : 12;
    const rings = [
      [y, 0.37],
      [y + 0.22, 0.38],
      [y + 0.35, 0.27],
      [cap - 0.31, 0.209],
      [cap - 0.17, 0.3],
      [cap, 0.34],
    ].map(([h, r]) => radialRing(h, r, r, n, [ax, az]));
    loft(out, 'render', rings, tone.stone, { cap: false });
    if (lod >= 2)
      box(
        out,
        'trim',
        [x + dx - 0.4, x + dx + 0.4, front - 0.06, front + 0.74],
        y - 0.055,
        y + 0.14,
        tone.pale,
      );
  }
  const f = wall([left, z], [right, z]),
    center = f.len / 2;
  panel(out, 'inset', f, center - 0.85, center + 0.85, y + 0.08, y + 2.8, 0.11, tone.dark);
  if (lod >= 1) {
    panel(out, 'inset', f, center - 0.9, center + 0.9, y + 3.09, y + 3.75, 0.12, tone.dark);
    panel(out, 'trim', f, center - 0.057, center + 0.057, y + 0.12, y + 2.77, 0.14, tone.buff);
  }
  if (lod >= 2 && index === 1)
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const l = center + side * (1.06 + 0.24 * k);
        panel(out, 'trim', f, l - 0.055, l + 0.055, y + 0.89, y + 3.48, 0.105, tone.plaque);
      }
  const steps = lod === 0 ? 1 : 3;
  for (let i = 0; i < steps; i++) {
    const z1 = front + 0.04 - i * 0.29,
      z0 = z1 - 0.31;
    box(
      out,
      'trim',
      [left - i * 0.071, right + i * 0.071, z0, z1],
      y - 0.6,
      y - i * 0.17,
      tone.stone,
    );
  }
  box(out, 'trim', [left, right, front + 0.02, z + 0.02], y - 0.21, y - 0.015, tone.stone);
}
function build(out, lod) {
  block(out, lod);
  S.porchPositions.forEach((x, i) => porch(out, lod, x, i));
}
export const hospitalSkyline = (out) => build(out, 0);
export const hospitalDistrict = (out) => build(out, 1);
export const hospitalStreet = (out) => build(out, 2);
export const hospitalCloseup = (out) => build(out, 3);
const camera = world(-39, 21, -53),
  lookAt = world(0, 7, 0),
  recipe = 'tung-wah-hospital-model.mjs';
export const hospitalModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: hospitalCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The historic Main Block of Tung Wah Hospital in Sheung Wan with a six-storey cream facade, two entrance porches and small-pane windows.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: world(-19, 26, -18),
  portableGroundY: -6.2,
  mediumFiContext: {
    scale: 0.95,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: { outline, minimumCoverage: 0.87, basis: 'Named historic Main Block footprint.' },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'concrete_plain'],
  qaCameras: [
    {
      name: 'classical-assembly-hall-porch',
      position: world(12, 3.0, -19),
      lookAt: world(8.6, -1.60, -8.1),
    },
    {
      name: 'historic-main-block-and-two-porches',
      position: world(27, 13, -53),
      lookAt: world(0, 6, -3),
    },
    {
      name: 'parapet-and-banded-elevations',
      position: world(-28, 29, 30),
      lookAt: world(-1, 9, 0),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `main-block-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'hospitalSkyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'hospitalDistrict', 0.29],
        ['street', 'hospitalStreet', 0.12],
        ['closeup', 'hospitalCloseup', 0.042],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped outline is ODbL. The Qualla reference is CC0 own work by Suwm HorC POONZ.',
};
