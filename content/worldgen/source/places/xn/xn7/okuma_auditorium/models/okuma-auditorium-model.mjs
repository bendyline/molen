/** Waseda University's Ōkuma Auditorium, with its 38-meter clock tower. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const { foundationBottom, plinthTop, wallEaves, roofTop, portals, stairs, tower } = plan.section;
const hall = outline.filter((_, i) => i < 10 || i > 12);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.87, metallic: 0.09 },
  dark: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.74, metallic: 0.09 },
};
const color = Object.fromEntries(
  Object.entries({
    brick: 'c0a990',
    stone: 'd4c7ae',
    granite: '777774',
    roof: '676963',
    dark: '444b47',
    face: 'ccd9d2',
    gate: '919f97',
    copper: '5f8173',
    crown: 'aeaaa0',
    interior: '97846e',
    band: 'e1d3ba',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';

function face(out, slot, points, direction, tint = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, a, i) => sum + a * direction[i], 0) < 0) {
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
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz * sign, 0, -dx * sign],
    point: (u, y, d = 0) => [a[0] + u * dx + d * dz * sign, y, a[1] + u * dz - d * dx * sign],
  };
}

function rect(out, slot, e, a, b, low, top, depth = 0, tint = color[slot]) {
  face(
    out,
    slot,
    [
      e.point(a, low, depth),
      e.point(b, low, depth),
      e.point(b, top, depth),
      e.point(a, top, depth),
    ],
    e.n,
    tint,
  );
}

function cap(out, ring, y, slot) {
  const tmp = new MeshBufferBuilder();
  if (
    !tmp.addCap(
      slot,
      white,
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color[slot],
    )
  )
    throw Error('Cannot cap Ōkuma Auditorium');
  const { indices, positions } = tmp.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, p, [0, 1, 0]);
  }
}

function circle(out, e, u, y, r, d, lod, tint, outer = null) {
  const n = [8, 12, 18, 24][lod],
    origin = e.point(u, y, d);
  const point = (i, radius, depth) =>
    e.point(
      u + radius * Math.cos((i * 2 * Math.PI) / n),
      y + radius * Math.sin((i * 2 * Math.PI) / n),
      depth,
    );
  for (let i = 0; i < n; i++) {
    face(out, 'dark', [origin, point(i, r, d), point(i + 1, r, d)], e.n, tint);
    if (outer)
      face(
        out,
        'stone',
        [
          point(i, r, d - 0.007),
          point(i + 1, r, d - 0.007),
          point(i + 1, outer, d - 0.007),
          point(i, outer, d - 0.007),
        ],
        e.n,
        color.band,
      );
  }
}

function curve(u, w, spring, rise, t) {
  return [u + w * t, spring + rise * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.28 * Math.abs(t))];
}

function openHead(out, e, u, w, spring, rise, top, lod, slot, d = 0, tint = color[slot]) {
  const count = [4, 6, 10, 14][lod];
  for (let i = 0; i < count; i++) {
    const a = curve(u, w, spring, rise, (2 * i) / count - 1),
      b = curve(u, w, spring, rise, (2 * (i + 1)) / count - 1);
    face(
      out,
      slot,
      [e.point(...a, d), e.point(...b, d), e.point(b[0], top, d), e.point(a[0], top, d)],
      e.n,
      tint,
    );
  }
}

function framedArch(out, e, u, w, base, spring, rise, d, lod, tint = color.dark) {
  rect(out, 'dark', e, u - w, u + w, base, spring, d, tint);
  const n = [4, 6, 8, 12][lod];
  for (let i = 0; i < n; i++) {
    const a = curve(u, w, spring, rise, (2 * i) / n - 1),
      b = curve(u, w, spring, rise, (2 * (i + 1)) / n - 1);
    face(out, 'dark', [e.point(u, spring, d), e.point(...a, d), e.point(...b, d)], e.n, tint);
  }
  if (lod) {
    rect(out, 'stone', e, u - w - 0.09, u - w, base, spring, d + 0.013, color.band);
    rect(out, 'stone', e, u + w, u + w + 0.09, base, spring, d + 0.013, color.band);
  }
}

function entrance(out, e, lod) {
  const { centers, halfWidth: w, spring, rise, threshold, depth } = portals;
  const positions = centers.map((x) => x - outline[13][0]);
  let left = 0;
  rect(out, 'granite', e, 0, e.length, foundationBottom, threshold, 0);
  rect(out, 'brick', e, 0, e.length, 10.36, wallEaves, 0);
  for (const u of positions) {
    rect(out, 'brick', e, left, u - w, threshold, 10.36, 0);
    openHead(out, e, u, w, spring, rise, 10.36, lod, 'brick');
    left = u + w;
    const n = [4, 6, 10, 14][lod];
    const outer = (t) => curve(u, w + 0.22, spring + 0.01, rise + 0.24, t);
    const inner = (t) => curve(u, w, spring, rise, t);
    for (let i = 0; i < n; i++) {
      const t = (2 * i) / n - 1,
        s = (2 * (i + 1)) / n - 1,
        a = inner(t),
        b = inner(s),
        c = outer(s),
        d = outer(t);
      face(
        out,
        'stone',
        [e.point(...a, 0.115), e.point(...b, 0.115), e.point(...c, 0.115), e.point(...d, 0.115)],
        e.n,
        color.band,
      );
      const toward = i < n / 2 ? [1, -1, 0] : [-1, -1, 0];
      face(
        out,
        'stone',
        [e.point(...a, -depth), e.point(...b, -depth), e.point(...b, 0), e.point(...a, 0)],
        toward,
        color.stone,
      );
    }
    for (const sign of [-1, 1]) {
      const a = u + sign * w,
        b = u + sign * (w + 0.22);
      rect(out, 'stone', e, Math.min(a, b), Math.max(a, b), threshold, spring, 0.115, color.band);
      face(
        out,
        'stone',
        [
          e.point(a, threshold, -depth),
          e.point(a, threshold, 0),
          e.point(a, spring, 0),
          e.point(a, spring, -depth),
        ],
        [-sign, 0, 0],
      );
    }
    rect(out, 'brick', e, u - w, u + w, threshold, spring + rise, -depth, color.interior);
    rect(out, 'stone', e, u - 0.92, u + 0.92, threshold + 0.04, 4.68, -depth + 0.026, color.band);
    rect(out, 'dark', e, u - 0.76, u + 0.76, threshold + 0.07, 4.52, -depth + 0.052, color.dark);
    if (lod) {
      circle(out, e, u, 6.17, 0.68, -depth + 0.036, lod, color.dark, 0.86);
      for (const a of [-1, 1])
        rect(
          out,
          'dark',
          e,
          u + a * 0.81 - 0.037,
          u + a * 0.81 + 0.037,
          threshold + 0.09,
          4.48,
          -0.12,
          color.gate,
        );
      rect(out, 'dark', e, u - 0.81, u + 0.81, 3.94, 4.05, -0.12, color.gate);
      if (lod >= 2)
        for (let j = -4; j <= 4; j++) {
          const x = u + j * 0.169;
          rect(out, 'dark', e, x - 0.018, x + 0.018, threshold + 0.11, 4.05, -0.105, color.gate);
          if (lod === 3 && j < 4) {
            const y = threshold + 0.38 + (j % 2 ? 0.27 : 0);
            beam(
              out,
              'dark',
              e.point(x, y, -0.085),
              e.point(x + 0.169, y + 0.3, -0.085),
              0.023,
              0.023,
              color.gate,
            );
          }
        }
    }
  }
  rect(out, 'brick', e, left, e.length, threshold, 10.36, 0);
  for (const u of [positions[0] - 3.14, positions.at(-1) + 3.22])
    circle(out, e, u, 3.47, 0.36, 0.03, lod, color.dark, lod ? 0.54 : null);
  if (lod)
    for (const u of positions) {
      rect(out, 'stone', e, u - 0.25, u + 0.25, 10.14, 11.14, 0.058, color.band);
      rect(out, 'dark', e, u - 0.15, u + 0.15, 10.34, 11.02, 0.078, color.dark);
    }
  if (lod >= 2) {
    for (const u of [
      positions[0] - 2.49,
      (positions[0] + positions[1]) / 2,
      (positions[1] + positions[2]) / 2,
      positions[2] + 2.49,
    ]) {
      const [x, , z] = e.point(u, 0, 0.19);
      loft(
        out,
        'dark',
        [
          [3.14, 0.095],
          [3.23, 0.143],
          [3.91, 0.141],
          [4.14, 0.035],
        ].map(([y, r]) => radialRing(y, r, r, 6, [x, z])),
        color.copper,
      );
    }
  }
}

function grade(x, z) {
  const [u, v] = [x, z].map((p, i) => (p - terrain.origin[i]) / terrain.stepMeters),
    i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}

function auditorium(out, lod) {
  for (let i = 0; i < hall.length; i++) {
    const a = hall[i],
      b = hall[(i + 1) % hall.length];
    const front = a === outline[13] && b === outline[14];
    if (front) {
      entrance(out, edge(outline[13], outline[15], -1), lod);
    }
    if (a === outline[14] || front) continue;
    const e = edge(a, b, -1);
    rect(out, 'granite', e, 0, e.length, foundationBottom, plinthTop);
    rect(out, 'brick', e, 0, e.length, plinthTop, wallEaves);
    if (lod && e.length > 4) {
      const count = Math.max(1, Math.round(e.length / 5.8));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * e.length) / count;
        framedArch(out, e, u, 0.56, 3.6, 6.58, 0.64, 0.036, lod);
        if (lod >= 2) rect(out, 'dark', e, u - 0.35, u + 0.35, 9.04, 10.6, 0.042, color.dark);
      }
    }
  }
  for (let i = 0; i < hall.length; i++) {
    const e = edge(hall[i], hall[(i + 1) % hall.length], -1);
    rect(out, 'stone', e, 0, e.length, wallEaves - 0.55, wallEaves + 0.04, 0.11, color.band);
  }
  cap(out, hall, wallEaves, 'roof');
  const hip = (x0, x1, z0, z1, y) => [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];
  loft(
    out,
    'roof',
    [hip(-8.38, 16.92, -18.4, 15.04, wallEaves - 0.04), hip(2.81, 5.58, -13.43, 10.71, roofTop)],
    color.roof,
  );
  const z = outline[14][1],
    count = lod ? stairs.steps : 4;
  const base = grade(stairs.x, z + stairs.depth) - 0.37;
  for (let i = 0; i < count; i++) {
    const d = (stairs.depth * (i + 1)) / count,
      top = portals.threshold - ((portals.threshold - base - 0.31) * i) / count;
    box(
      out,
      'granite',
      stairs.x,
      base,
      z + d / 2 - 0.1,
      stairs.width,
      top - base,
      d,
      color.granite,
    );
  }
}

function clock(out, e, lod) {
  const y = tower.clockHeight,
    u = e.length / 2,
    r = tower.clockRadius;
  circle(out, e, u, y, r, 0.056, lod, color.face, r + 0.105);
  if (!lod) return;
  for (const a of [0.26, -0.8]) {
    const len = a > 0 ? 0.78 : 0.56;
    beam(
      out,
      'dark',
      e.point(u, y, 0.089),
      e.point(u + Math.sin(a) * len, y + Math.cos(a) * len, 0.089),
      0.049,
      0.035,
      color.dark,
    );
  }
  if (lod >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const p = (r) => e.point(u + r * Math.sin(a), y + r * Math.cos(a), 0.083);
      beam(out, 'dark', p(0.78), p(0.94), 0.046, 0.027, color.dark);
    }
}

function clockTower(out, lod) {
  const {
    bounds: [x0, x1, z0, z1],
    shaftTop,
    crownSill,
    crownHead,
    top,
  } = tower;
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2,
    w = x1 - x0,
    d = z1 - z0;
  box(out, 'granite', x, foundationBottom, z, w, plinthTop - foundationBottom, d, color.granite);
  box(out, 'brick', x, plinthTop, z, w, shaftTop - plinthTop, d, color.brick);
  box(out, 'stone', x, shaftTop - 0.49, z, w + 0.46, 0.65, d + 0.46, color.band);
  box(
    out,
    'stone',
    x,
    shaftTop + 0.08,
    z,
    w + 0.21,
    crownSill - shaftTop - 0.08,
    d + 0.21,
    color.crown,
  );
  for (const [a, b] of [
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
  ]) {
    const e = edge(a, b),
      n = e.length,
      mid = n / 2;
    clock(out, e, lod);
    if (lod) framedArch(out, e, mid, 0.57, 16.5, 19.88, 0.68, 0.036, lod);
    const archCenters = [mid - 1.72, mid + 1.72],
      r = 0.95;
    let start = 0;
    for (const u of archCenters) {
      rect(out, 'stone', e, start, u - r, crownSill, crownHead, 0, color.crown);
      openHead(out, e, u, r, crownSill + 3.19, 1.24, crownHead, lod, 'stone', 0, color.crown);
      if (lod)
        for (const sign of [-1, 1]) {
          const a = u + sign * r;
          face(
            out,
            'stone',
            [
              e.point(a, crownSill, -0.37),
              e.point(a, crownSill, 0),
              e.point(a, crownSill + 3.19, 0),
              e.point(a, crownSill + 3.19, -0.37),
            ],
            e.point(0, 0).map((v, i) => sign * (e.point(1, 0)[i] - v)),
            color.crown,
          );
        }
      start = u + r;
    }
    rect(out, 'stone', e, start, n, crownSill, crownHead, 0, color.crown);
    for (let i = 0; i < 4; i++) {
      const u = ((i + 0.5) * n) / 4;
      rect(
        out,
        'stone',
        e,
        u - 0.24,
        u + 0.24,
        crownHead - 0.02,
        crownHead + 0.55,
        0.018,
        color.crown,
      );
      if (lod >= 2) {
        rect(
          out,
          'dark',
          e,
          u - 0.24,
          u + 0.24,
          crownSill - 0.81,
          crownSill - 0.64,
          0.135,
          color.dark,
        );
        rect(
          out,
          'dark',
          e,
          u - 0.082,
          u + 0.082,
          crownSill - 0.98,
          crownSill - 0.48,
          0.136,
          color.dark,
        );
      }
    }
  }
  for (const [px, pz] of [
    [x0 + 0.33, z0 + 0.33],
    [x0 + 0.33, z1 - 0.33],
    [x1 - 0.33, z0 + 0.33],
    [x1 - 0.33, z1 - 0.33],
  ]) {
    const ring = (y, r) => [
      [px - r, y, pz - r],
      [px - r, y, pz + r],
      [px + r, y, pz + r],
      [px + r, y, pz - r],
    ];
    loft(
      out,
      'stone',
      [ring(shaftTop + 0.06, 0.405), ring(top - 0.75, 0.26), ring(top, 0.068)],
      color.crown,
    );
  }
}

function buildLevel(out, lod) {
  auditorium(out, lod);
  clockTower(out, lod);
}
export const okumaSkyline = (out) => buildLevel(out, 0);
export const okumaDistrict = (out) => buildLevel(out, 1);
export const okumaStreet = (out) => buildLevel(out, 2);
export const okumaCloseup = (out) => buildLevel(out, 3);

const recipe = 'okuma-auditorium-model.mjs',
  camera = [-51, 33, 72],
  lookAt = [-1, 14, 1];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'okumaDistrict', 0.24],
    ['street', 'okumaStreet', 0.09],
    ['closeup', 'okumaCloseup', 0.034],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const okumaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: okumaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The 2024 Ōkuma Auditorium on the Waseda campus, with three recessed Tudor arches and a 38-meter clock tower crowned by open Gothic tracery.',
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
    basis: 'Native mapped auditorium and attached clock tower footprint.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick_longformat',
    'stone_limestone',
    'stone_granite',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'west-tudor-arches-and-granite-stair', position: [-7, 14, 63], lookAt: [0, 9, 14] },
    { name: 'clock-faces-and-open-belfry', position: [-49, 29, 59], lookAt: [-14, 25, 15] },
    { name: 'curved-rear-stage-and-whole-plan', position: [51, 74, -56], lookAt: [-1, 14, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-okuma-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'okumaSkyline',
    errorMeters: 0.61,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Exact CC0 exterior photographs by Daderot and Seiichi Miyashita.',
};
