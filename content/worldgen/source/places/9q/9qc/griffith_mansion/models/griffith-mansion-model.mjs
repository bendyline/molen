/** June 2009 exterior of the Griffith Mansion in Yolo, California. */
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
const plan = read('plan-controls');
const frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  baseCourse,
  storyLine,
  wallEaves,
  roofRidge,
  mainBounds,
  bayCenters,
  rearBounds,
  sideBounds,
  frontPorch,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.94, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.72, metallic: 0.04 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'dedfd7',
    wood: 'e6e6dc',
    trim: 'c3c5ba',
    stone: 'a1a19a',
    roof: '535759',
    pane: '535e60',
    frame: '939991',
    door: '414742',
    rail: 'e3e2d7',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff';
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
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
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    point: (u, y, p = 0) => [a[0] + u * dx + p * n[0], y, a[1] + u * dz + p * n[2]],
  };
}
function edges(ring) {
  const sign = Math.sign(area(ring));
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, e, a, b, bottom, top, p, tint) {
  face(
    out,
    slot,
    [e.point(a, bottom, p), e.point(b, bottom, p), e.point(b, top, p), e.point(a, top, p)],
    e.n,
    tint,
  );
}
const arch = (center, half, spring, top, count) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [center - half * Math.cos(t), spring + (top - spring) * Math.sin(t)];
  });
function archPanel(out, e, center, half, bottom, spring, top, p, tint, count) {
  panel(out, 'detail', e, center - half, center + half, bottom, spring, p, tint);
  const a = arch(center, half, spring, top, count);
  const hub = e.point(center, spring, p);
  for (let i = 1; i < a.length; i++)
    face(out, 'detail', [hub, e.point(...a[i - 1], p), e.point(...a[i], p)], e.n, tint);
}

function window(out, e, u, w, bottom, top, lod) {
  const h = w / 2,
    spring = top - w * 0.28;
  if (lod === 0) {
    panel(out, 'detail', e, u - h, u + h, bottom, top, 0.031, colors.pane);
    return;
  }
  const segments = lod >= 2 ? 8 : 4;
  archPanel(out, e, u, h + 0.091, bottom - 0.075, spring, top + 0.12, 0.034, colors.trim, segments);
  archPanel(out, e, u, h, bottom, spring, top, 0.063, colors.pane, segments);
  panel(
    out,
    'detail',
    e,
    u - h,
    u + h,
    bottom + (top - bottom) * 0.47,
    bottom + (top - bottom) * 0.47 + 0.052,
    0.083,
    colors.frame,
  );
  if (lod >= 2) {
    panel(out, 'detail', e, u - 0.022, u + 0.022, bottom, top - 0.06, 0.084, colors.frame);
    panel(
      out,
      'wood',
      e,
      u - h - 0.15,
      u + h + 0.15,
      bottom - 0.11,
      bottom + 0.007,
      0.115,
      colors.wood,
    );
    panel(out, 'wood', e, u - 0.067, u + 0.067, top + 0.07, top + 0.22, 0.091, colors.wood);
  }
}
const rectangle = ([x0, x1, z0, z1]) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const bay = (x) => [
  [x - 2.02, 5.38],
  [x + 2.02, 5.38],
  [x + 2.02, 6.44],
  [x + 1.21, 7.25],
  [x - 1.21, 7.25],
  [x - 2.02, 6.44],
];
const [x0, x1, z0, z1] = mainBounds;
const mainRing = [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  ...[...bayCenters].reverse().flatMap((x) => [[x + 2.02, z1], ...bay(x).slice(2), [x - 2.02, z1]]),
  [x0, z1],
];
function shell(out, ring, eaves, levels, lod, selectBays) {
  for (const [i, e] of edges(ring).entries()) {
    panel(out, 'stone', e, 0, e.length, foundationBottom, baseCourse, 0, colors.stone);
    panel(out, 'wall', e, 0, e.length, baseCourse, eaves, 0, colors.wall);
    panel(out, 'wood', e, 0, e.length, eaves - 0.22, eaves + 0.035, 0.095, colors.wood);
    if (levels === 2)
      panel(out, 'wood', e, 0, e.length, storyLine - 0.118, storyLine + 0.074, 0.061, colors.trim);
    if (lod && e.length >= 1.1) {
      for (const u of [0, e.length - 0.093])
        panel(out, 'wood', e, u, u + 0.093, baseCourse, eaves, 0.051, colors.wood);
    }
    for (const [u, w] of selectBays(i, e.length)) {
      window(out, e, u, w, 1.18, 3.43, lod);
      if (levels === 2) window(out, e, u, w, 4.68, Math.min(7.19, eaves - 0.4), lod);
    }
    if (lod >= 2 && e.length > 1.6) {
      const count = Math.round(e.length / (lod === 3 ? 1.28 : 2.28));
      for (let j = 0; j < count; j++) {
        const u = (e.length * (j + 0.5)) / count;
        const a = e.point(u, eaves - 0.36, 0.12),
          b = e.point(u, eaves - 0.1, 0.3);
        beam(out, 'wood', a, b, lod === 3 ? 0.095 : 0.11, 0.12, colors.trim);
      }
    }
  }
}
function bayWindows(i, len) {
  if (i === 0 || i === 1 || i === mainRing.length - 1)
    return [0.21, 0.5, 0.78].map((t) => [t * len, 0.9]);
  if (i === 5 || i === 11) return [0.28, 0.72].map((t) => [t * len, 0.67]);
  if ([4, 6, 10, 12].includes(i)) return [[len / 2, 0.59]];
  return [];
}
function hip(out, bounds, base, top, overhang = 0.23) {
  const [l, r, b, f] = bounds,
    c = (b + f) / 2;
  const a = [l - overhang, base, b - overhang],
    d = [r + overhang, base, b - overhang],
    e = [r + overhang, base, f + overhang],
    g = [l - overhang, base, f + overhang];
  const shoulder = Math.min((r - l) * 0.39, (f - b) * 0.43);
  const p = [l + shoulder, top, c],
    q = [r - shoulder, top, c];
  for (const points of [
    [a, d, q, p],
    [g, e, q, p],
    [a, g, p],
    [d, e, q],
  ])
    face(out, 'roof', points, [0, 1, 0], colors.roof);
}
function bayRoof(out, x) {
  const source = bay(x).map(([px, pz]) => [x + (px - x) * 1.14, 6.3 + (pz - 6.3) * 1.14]);
  const lower = source.map(([px, pz]) => [px, wallEaves, pz]);
  const upper = source.map(([px, pz]) => [x + (px - x) * 0.36, 8.52, 2.58 + (pz - 6.3) * 0.31]);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    face(out, 'roof', [lower[i], lower[j], upper[j], upper[i]], [0, 1, 0], colors.roof);
  }
  for (let i = 1; i < upper.length - 1; i++)
    face(out, 'roof', [upper[0], upper[i], upper[i + 1]], [0, 1, 0], colors.roof);
}
function bays(count, length, width) {
  return Array.from({ length: count }, (_, i) => [((i + 1) * length) / (count + 1), width]);
}
function house(out, lod) {
  shell(out, mainRing, wallEaves, 2, lod, bayWindows);
  shell(out, rectangle(rearBounds), 7.16, 2, lod, (i, length) =>
    i === 0 ? bays(3, length, 0.81) : i === 3 ? bays(2, length, 0.77) : [],
  );
  shell(out, rectangle(sideBounds), 4.03, 1, lod, (i, length) =>
    i === 1 ? bays(2, length, 0.98) : i === 0 ? bays(1, length, 0.91) : [],
  );
  hip(out, mainBounds, wallEaves, roofRidge, 0.41);
  hip(out, rearBounds, 7.16, 8.35, 0.25);
  hip(out, sideBounds, 4.03, 4.88, 0.21);
  for (const x of bayCenters) bayRoof(out, x);
  for (const [x, z] of [
    [-5.19, -2.4],
    [4.07, -2.8],
  ]) {
    box(out, 'wood', x, 8.33, z, 0.57, 1.37, 0.72, colors.wood);
    if (lod) box(out, 'wood', x, 9.54, z, 0.67, 0.21, 0.82, colors.trim);
  }
}

function column(out, x, z, bottom, top, lod) {
  const shaft = lod >= 2 ? 8 : 4;
  const profile =
    lod >= 2
      ? [
          [bottom, 0.12],
          [bottom + 0.22, 0.145],
          [bottom + 0.29, 0.103],
          [top - 0.29, 0.092],
          [top - 0.15, 0.142],
          [top, 0.18],
        ]
      : [
          [bottom, 0.116],
          [top - 0.2, 0.097],
          [top, 0.161],
        ];
  const rings = profile.map(([y, r]) =>
    Array.from({ length: shaft }, (_, i) => {
      const t = (2 * Math.PI * (i + 0.5)) / shaft;
      return [x + Math.cos(t) * r, y, z + Math.sin(t) * r];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < shaft; i++) {
      const k = (i + 1) % shaft,
        a = rings[j - 1],
        b = rings[j];
      face(
        out,
        'wood',
        [a[i], a[k], b[k], b[i]],
        [a[i][0] + a[k][0] - 2 * x, 0, a[i][2] + a[k][2] - 2 * z],
        colors.wood,
      );
    }
  if (lod === 3)
    for (const [dx, dz] of [
      [0.105, 0],
      [-0.105, 0],
      [0, 0.105],
      [0, -0.105],
    ])
      beam(
        out,
        'wood',
        [x + dx, top - 0.28, z + dz],
        [x + dx * 1.57, top - 0.11, z + dz * 1.57],
        0.065,
        0.059,
        colors.trim,
      );
}
function balustrade(out, a, b, y0, y1, lod) {
  for (const y of [y0, y1])
    beam(out, 'wood', [a[0], y, a[1]], [b[0], y, b[1]], 0.092, 0.084, colors.rail);
  const count =
    lod === 0
      ? 3
      : Math.max(3, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (lod === 1 ? 0.68 : 0.41)));
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t,
      w = i === 0 || i === count ? 0.13 : 0.051;
    box(out, 'wood', x, y0, z, w, y1 - y0, w, colors.rail);
  }
}
function verandahs(out, lod) {
  const { width, deck, front, canopy, railTop } = frontPorch,
    back = mainBounds[3] - 0.04,
    depth = front - back,
    mid = (front + back) / 2;
  box(out, 'stone', 0, foundationBottom, mid, width, deck - foundationBottom, depth, colors.stone);
  box(out, 'wood', 0, canopy - 0.21, mid, width + 0.27, 0.32, depth + 0.21, colors.wood);
  for (const x of lod ? [-2.02, -1.46, 1.46, 2.02] : [-2, 2])
    column(out, x, front - 0.13, deck, canopy - 0.2, lod);
  balustrade(out, [-2.1, front], [2.1, front], canopy + 0.1, railTop, lod);
  if (lod >= 1)
    for (const x of [-2.1, 2.1]) balustrade(out, [x, back], [x, front], canopy + 0.1, railTop, lod);
  const door = edge([2.4, back + 0.06], [-2.4, back + 0.06]);
  archPanel(out, door, 2.4, 0.84, deck, 2.46, 2.93, 0.032, colors.door, lod ? 6 : 4);
  window(out, door, 2.4, 0.96, 4.79, 7.08, lod);
  if (lod >= 2)
    for (const x of [2.12, 2.68])
      panel(out, 'detail', door, x - 0.035, x + 0.035, 1.62, 1.8, 0.062, colors.frame);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      0,
      -0.13,
      front + 0.14 * (i + 1),
      2.08,
      deck + 0.13 - 0.145 * i,
      0.28 * (i + 1),
      colors.stone,
    );

  const sideFront = 4.54,
    sideBack = 2.55,
    sideMid = (sideFront + sideBack) / 2;
  box(
    out,
    'stone',
    10.11,
    foundationBottom,
    sideMid,
    3.87,
    deck - foundationBottom,
    sideFront - sideBack,
    colors.stone,
  );
  box(out, 'wood', 10.11, 3.7, sideMid, 4.07, 0.24, sideFront - sideBack + 0.19, colors.wood);
  for (const x of [8.36, 10.1, 11.86]) column(out, x, sideFront - 0.12, deck, 3.69, lod);
  balustrade(
    out,
    [10.1, sideFront - 0.12],
    [11.86, sideFront - 0.12],
    deck + 0.1,
    deck + 0.93,
    lod,
  );
  if (lod)
    balustrade(out, [11.86, sideBack], [11.86, sideFront - 0.12], deck + 0.1, deck + 0.93, lod);
}
function buildLevel(out, lod) {
  house(out, lod);
  verandahs(out, lod);
}
export const griffithSkyline = (out) => buildLevel(out, 0);
export const griffithDistrict = (out) => buildLevel(out, 1);
export const griffithStreet = (out) => buildLevel(out, 2);
export const griffithCloseup = (out) => buildLevel(out, 3);

const recipe = 'griffith-mansion-model.mjs',
  camera = [26, 13, 30],
  lookAt = [0.5, 4.45, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'griffithDistrict', 0.16],
    ['street', 'griffithStreet', 0.055],
    ['closeup', 'griffithCloseup', 0.021],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const griffithModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: griffithCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The June 2009 Griffith Mansion in Yolo, with twin polygonal bays, white Italianate siding, arched sash and a columned porch.',
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
      'The approximate house-wall envelope reconstructed from the georeferenced public-domain roof and dated exterior references.',
  },
  mediumFiContext: {
    scale: 0.86,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['wood_painted_lap', 'wood_plain', 'stone_granite', 'shingle_asphalt'],
  qaCameras: [
    { name: 'italianate-front-and-polygonal-bays', position: [0, 7, 31], lookAt: [0.65, 4.55, 5] },
    { name: 'garden-elevation-and-rear-roofs', position: [-21, 15, -26], lookAt: [-0.5, 4, -4] },
    { name: 'porch-columns-and-balcony', position: [11, 7, 21], lookAt: [2, 3.95, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-griffith-mansion-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'griffithSkyline',
    errorMeters: 0.32,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Roof controls from public-domain USGS USDA NAIP orthoimagery. Three exact public-domain photographs by Greg Ciro Tornincasa.',
};
