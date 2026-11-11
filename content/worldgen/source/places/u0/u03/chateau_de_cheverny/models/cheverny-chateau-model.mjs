/** Château de Cheverny, based on the circa-2010 south elevation. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  baseCourse,
  beltLines,
  wingEaves,
  pavilionEaves,
  centralEaves,
  pavilions,
  wings,
  central,
  pavilionRoofProfile,
  lanternTop,
  entry,
} = plan.section;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.73, metallic: 0.03 },
};
const colors = Object.fromEntries(
  Object.entries({
    stone: 'e1d9c4',
    base: 'c0baa9',
    course: 'd2c9b1',
    highlight: 'e9dfc7',
    slate: '585d5c',
    shade: '7f7e69',
    frame: 'afa68f',
    dark: '4b5554',
    timber: '625748',
    bronze: '70766d',
  }).map(([k, v]) => [k, rgb(v)]),
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

function medallion(out, e, u, y, radius, lod) {
  const segments = lod >= 2 ? 8 : 6,
    p = e.point(u, y, 0.052);
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments,
      b = (2 * Math.PI * (i + 1)) / segments;
    const q = (t) => e.point(u + Math.cos(t) * radius, y + Math.sin(t) * radius, 0.052);
    face(out, 'stone', [p, q(a), q(b)], e.n, colors.course);
  }
  if (lod >= 2) {
    panel(
      out,
      'stone',
      e,
      u - radius * 0.44,
      u + radius * 0.44,
      y - radius * 0.57,
      y + radius * 0.63,
      0.078,
      colors.highlight,
    );
    if (lod === 3)
      panel(
        out,
        'stone',
        e,
        u - 0.11,
        u + 0.11,
        y - radius * 0.78,
        y + radius * 0.67,
        0.091,
        colors.shade,
      );
  }
}
function sash(out, e, u, w, bottom, top, lod, archHead = false) {
  const h = w / 2,
    spring = top - w * 0.22;
  if (lod === 0) {
    panel(out, 'detail', e, u - h, u + h, bottom, top, 0.033, colors.dark);
    return;
  }
  if (archHead) {
    archPanel(
      out,
      e,
      u,
      h + 0.12,
      bottom - 0.067,
      spring,
      top + 0.13,
      0.043,
      colors.frame,
      lod >= 2 ? 8 : 4,
    );
    archPanel(out, e, u, h, bottom, spring, top, 0.073, colors.dark, lod >= 2 ? 8 : 4);
  } else {
    panel(
      out,
      'stone',
      e,
      u - h - 0.095,
      u + h + 0.095,
      bottom - 0.075,
      top + 0.14,
      0.043,
      colors.frame,
    );
    panel(out, 'detail', e, u - h, u + h, bottom, top, 0.07, colors.dark);
  }
  if (lod >= 2) {
    panel(
      out,
      'stone',
      e,
      u - h - 0.16,
      u + h + 0.16,
      bottom - 0.14,
      bottom + 0.013,
      0.137,
      colors.highlight,
    );
    panel(out, 'detail', e, u - 0.023, u + 0.023, bottom, top - 0.035, 0.087, colors.frame);
    for (const f of lod === 3 ? [0.31, 0.58, 0.79] : [0.54])
      panel(
        out,
        'detail',
        e,
        u - h,
        u + h,
        bottom + f * (top - bottom),
        bottom + f * (top - bottom) + 0.035,
        0.091,
        colors.frame,
      );
  }
}
function faces(out, lod) {
  const ring = cleanRing(outline),
    sgn = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const ts = [0, 1];
    if (Math.abs(a[0] - b[0]) > 0.45)
      for (const x of [-18.46, -4.32, 3.2, 17.32]) {
        const t = (x - a[0]) / (b[0] - a[0]);
        if (t > 0.025 && t < 0.975) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    const point = (t) => a.map((x, k) => x + (b[k] - x) * t);
    for (let j = 1; j < ts.length; j++) {
      const p = point(ts[j - 1]),
        q = point(ts[j]),
        x = (p[0] + q[0]) / 2;
      const e = edge(p, q, sgn),
        outer = x < -18.38 || x > 17.29,
        center = Math.abs(x + 0.55) < 3.8;
      const top = outer ? pavilionEaves : center ? centralEaves : wingEaves;
      panel(out, 'stone', e, 0, e.length, foundationBottom, baseCourse, 0, colors.base);
      panel(out, 'stone', e, 0, e.length, baseCourse, top, 0, colors.stone);
      for (const y of [...beltLines, top - 0.34])
        if (y < top - 0.08)
          panel(out, 'stone', e, 0, e.length, y, y + 0.15, y > 14.5 ? 0.31 : 0.097, colors.course);
      if (e.length < 2.15) continue;
      const count = Math.max(1, Math.round(e.length / (lod === 0 ? 5.1 : 3.9)));
      for (let k = 0; k < count; k++) {
        const u = (e.length * (k + 0.5)) / count,
          [localX, , z] = e.point(u, 0);
        const onEntry = e.n[2] > 0.85 && z > 7 && Math.abs(localX - entry.x) < 1.45;
        const width = outer ? 1.06 : 0.95;
        if (!onEntry) sash(out, e, u, width, 2.14, 4.84, lod, false);
        sash(out, e, u, width, 6.3, 9.48, lod, false);
        if (outer || center) sash(out, e, u, width * 0.96, 11.39, 14.08, lod, outer);
        else if (lod && e.n[2] > 0.85) medallion(out, e, u, 12.8, 0.41, lod);
        if (lod >= 2 && e.n[2] > 0.85 && k > 0)
          medallion(out, e, (k * e.length) / count, 8.12, 0.36, lod);
      }
      if (lod >= 2 && e.length > 5)
        for (const t of [0.1, 0.9])
          panel(
            out,
            'stone',
            e,
            e.length * t - 0.13,
            e.length * t + 0.13,
            baseCourse,
            top - 0.15,
            0.04,
            colors.highlight,
          );
    }
  }
}
function roundRing(x, z, y, sx, sz, segments, cornerRound = 0.58) {
  return Array.from({ length: segments }, (_, i) => {
    const t = (2 * Math.PI * (i + 0.5)) / segments;
    const a = Math.cos(t),
      b = Math.sin(t);
    return [
      x + sx * Math.sign(a) * Math.pow(Math.abs(a), cornerRound),
      y,
      z + sz * Math.sign(b) * Math.pow(Math.abs(b), cornerRound),
    ];
  });
}
function roundRoof(out, x, z, halfX, halfZ, profile, lod) {
  const n = lod === 0 ? 8 : lod === 1 ? 12 : lod === 2 ? 16 : 24;
  const bands =
    lod === 0
      ? profile.filter((_, i) => i === 0 || i === 2 || i === 4 || i === profile.length - 1)
      : profile;
  const rings = bands.map(([y, s]) => roundRing(x, z, y, halfX * s, halfZ * s, n));
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j];
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        out,
        'roof',
        [a[i], a[k], b[k], b[i]],
        [a[i][0] + a[k][0] - 2 * x, 0.2, a[i][2] + a[k][2] - 2 * z],
        colors.slate,
      );
    }
  }
  const cap = rings.at(-1),
    y = cap[0][1];
  for (let i = 0; i < n; i++)
    face(out, 'roof', [[x, y, z], cap[i], cap[(i + 1) % n]], [0, 1, 0], colors.slate);
}
function hip(out, bounds, eaves, ridge, shoulder = 0.29) {
  const [a, b, c, d] = bounds,
    x = (a + b) / 2,
    z = (c + d) / 2,
    w = (b - a) * shoulder;
  const p = [a - 0.3, eaves, c - 0.31],
    q = [b + 0.3, eaves, c - 0.31],
    r = [b + 0.3, eaves, d + 0.32],
    s = [a - 0.3, eaves, d + 0.32];
  const u = [x - w, ridge, z],
    v = [x + w, ridge, z];
  for (const points of [
    [p, q, v, u],
    [r, s, u, v],
    [s, p, u],
    [q, r, v],
  ])
    face(out, 'roof', points, [0, 1, 0], colors.slate);
}
function lantern(out, x, z, lod) {
  box(out, 'stone', x, 25.93, z, 2.85, 0.61, 2.62, colors.course);
  for (const dx of [-0.83, 0.83])
    for (const dz of [-0.78, 0.78])
      box(out, 'stone', x + dx, 26.49, z + dz, 0.19, 1.55, 0.19, colors.highlight);
  const n = lod >= 2 ? 16 : 8;
  const rim = roundRing(x, z, 27.98, 1.36, 1.26, n, 1);
  const shoulder = roundRing(x, z, 28.35, 1.21, 1.12, n, 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, 'roof', [rim[i], rim[j], shoulder[j], shoulder[i]], [0, 1, 0], colors.slate);
    face(out, 'roof', [shoulder[i], shoulder[j], [x, 28.93, z]], [0, 1, 0], colors.slate);
  }
  beam(out, 'detail', [x, 28.83, z], [x, lanternTop, z], 0.084, 0.083, colors.bronze);
}

function dormer(out, x, z, y, w, lod, direction = 1) {
  const facing = edge([x + direction * w, z], [x - direction * w, z]);
  const front = w,
    half = w * 0.5,
    d = direction * 0.96,
    shade = colors.slate;
  box(out, 'stone', x, y, z - d * 0.21, w + 0.27, 1.09, 0.64, colors.course);
  archPanel(
    out,
    facing,
    front,
    half * 0.72,
    y + 0.14,
    y + 0.77,
    y + 1.1,
    0.35,
    colors.dark,
    lod >= 2 ? 8 : 4,
  );
  const a = [x - w * 0.61, y + 0.93, z + direction * 0.37],
    b = [x + w * 0.61, y + 0.93, z + direction * 0.37],
    c = [x, y + 1.72, z + direction * 0.36];
  face(out, 'stone', [a, b, c], [0, 0, direction], colors.highlight);
  const u = [x, y + 1.67, z - d];
  for (const v of [a, b]) face(out, 'roof', [v, c, u, [v[0], y + 0.92, z - d]], [0, 1, 0], shade);
  if (lod >= 2)
    beam(
      out,
      'stone',
      [x, y + 1.63, z + direction * 0.37],
      [x, y + 1.91, z + direction * 0.37],
      0.09,
      0.09,
      colors.highlight,
    );
}
function roofs(out, lod) {
  for (const [i, p] of pavilions.entries()) {
    const { x, z, halfX, halfZ } = p;
    box(
      out,
      'stone',
      x,
      pavilionEaves - 0.21,
      z,
      2 * halfX + 0.36,
      0.32,
      2 * halfZ + 0.37,
      colors.course,
    );
    roundRoof(out, x, z, halfX, halfZ, pavilionRoofProfile, lod);
    lantern(out, x, z, lod);
    const chimneyX = x + (i ? 4.7 : 5.45);
    for (const [xx, zz, y] of [
      [chimneyX, z - 3.14, 25.3],
      [x - 4.7, z - 3.33, 25.8],
    ]) {
      box(out, 'stone', xx, 21.51, zz, 0.93, y - 21.51, 0.86, colors.stone);
      if (lod) box(out, 'stone', xx, y - 0.2, zz, 1.12, 0.22, 1.02, colors.highlight);
    }
    if (lod)
      for (const xx of [x - 4.48, x + 4.64]) dormer(out, xx, z + halfZ - 0.47, 18.1, 1.16, lod);
  }
  for (const w of wings) {
    hip(out, w, wingEaves, 21.52);
    if (lod) {
      const x = (w[0] + w[1]) / 2;
      for (const dx of lod >= 2 ? [-3.6, 0, 3.6] : [-2.9, 2.9])
        dormer(out, x + dx, w[3] - 0.22, 15.43, 1.09, lod);
      if (lod >= 2)
        for (const dx of [-2.5, 2.5]) dormer(out, x + dx, w[2] + 0.21, 15.39, 0.9, lod, -1);
    }
  }
  hip(out, central, centralEaves, 24.69, 0.13);
  const x = entry.x,
    z = entry.front + 0.17;
  const gable = [
    [-4.55, 16.9, z],
    [3.4, 16.9, z],
    [x, 20.44, z],
  ];
  face(out, 'stone', gable, [0, 0, 1], colors.stone);
  const ridge = [x, 20.68, z - 3.23];
  for (const p of [gable[0], gable[1]])
    face(out, 'roof', [p, gable[2], ridge, [p[0], 17.05, z - 3.19]], [0, 1, 0], colors.slate);
  if (lod) {
    for (const p of gable.slice(0, 2))
      beam(out, 'stone', p, gable[2], 0.21, 0.18, colors.highlight);
    const e = edge([3.35, z], [-4.53, z]);
    medallion(out, e, 3.35 - x, 18.35, 0.58, lod);
  }
  box(out, 'stone', x + 1.84, 20.7, -2.51, 0.65, 3.62, 0.72, colors.course);
  beam(out, 'detail', [x, 24.59, 0.16], [x, 27.21, 0.16], 0.073, 0.074, colors.bronze);
}
function steps(out, lod) {
  const { x, front, threshold, stepCount } = entry;
  const e = edge([3.17, front], [-4.28, front]),
    u = 3.17 - x;
  archPanel(out, e, u, 0.95, threshold, 4.61, 4.99, 0.085, colors.timber, lod >= 2 ? 8 : 4);
  for (const k of [-1, 1])
    panel(
      out,
      'stone',
      e,
      u + k * 1.09 - 0.12,
      u + k * 1.09 + 0.12,
      threshold,
      5.0,
      0.15,
      colors.highlight,
    );
  panel(out, 'stone', e, u - 1.21, u + 1.21, 4.96, 5.15, 0.21, colors.course);
  const count = lod >= 1 ? stepCount : 3,
    low = -0.24;
  for (let j = 0; j < count; j++) {
    const depth = 0.43 + (2.21 * (j + 1)) / count,
      top = threshold - ((threshold - 0.1) * j) / count;
    box(
      out,
      'stone',
      x,
      low,
      front + depth / 2,
      8.91 + (0.59 * j) / count,
      top - low,
      depth,
      colors.course,
    );
  }
  if (lod >= 2)
    for (const dx of [-4.58, 4.58])
      beam(
        out,
        'stone',
        [x + dx, threshold + 0.14, front],
        [x + dx, 0.43, front + 2.59],
        0.26,
        0.3,
        colors.base,
      );
}
function buildLevel(out, lod) {
  faces(out, lod);
  roofs(out, lod);
  steps(out, lod);
}
export const chevernySkyline = (out) => buildLevel(out, 0);
export const chevernyDistrict = (out) => buildLevel(out, 1);
export const chevernyStreet = (out) => buildLevel(out, 2);
export const chevernyCloseup = (out) => buildLevel(out, 3);

const recipe = 'cheverny-chateau-model.mjs',
  camera = [34, 23, 94],
  lookAt = [-0.6, 13.45, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'chevernyDistrict', 0.32],
    ['street', 'chevernyStreet', 0.105],
    ['closeup', 'chevernyCloseup', 0.045],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const chevernyModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: chevernyCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Château de Cheverny around 2010, with a pale limestone facade, tall square pavilions, curved slate roofs, open lanterns and a short broad front stair.',
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
    minimumCoverage: 0.94,
    basis: 'The twenty-four native cadastral vertices of the main château.',
  },
  mediumFiContext: {
    scale: 0.82,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'slate'],
  qaCameras: [
    { name: 'south-facade-and-pavilion-roofs', position: [1, 13, 87], lookAt: [0, 14, 4] },
    { name: 'north-wing-plan-and-slate-roofs', position: [-48, 47, -74], lookAt: [-3, 13, -3] },
    { name: 'central-stairs-and-limestone-bays', position: [19, 12, 47], lookAt: [1, 10, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cheverny-chateau-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'chevernySkyline',
    errorMeters: 0.57,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. French cadastral footprint through OpenStreetMap, ODbL 1.0. Exact AndrewHorne photographer-released public-domain photo.',
};
