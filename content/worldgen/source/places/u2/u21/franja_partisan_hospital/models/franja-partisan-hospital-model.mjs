import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const tone = palette({
  grey: 'a39f8f',
  light: 'b1aa97',
  plank: '918a7b',
  sill: '908674',
  roof: '8d8677',
  roofLight: 'a19a84',
  roofDark: '797464',
  stone: '887f72',
  rock: '837f75',
  rockShade: '777166',
  rockLight: 'a09b8c',
  moss: '75785f',
  wood: '8a7050',
  paleWood: 'a18357',
  shade: '5f6154',
  water: '687874',
});
const surfaces = {
  walls: surface('wall', 'wood_weatherboard', 0.96),
  roof: surface('roof', 'wood_painted_shingle', 0.95),
  stone: surface('foundation', 'stone_ashlar', 0.96),
  cliff: surface('wall', 'stone_limestone_raw', 0.98),
  trim: surface('trim', 'wood_plain', 0.93),
  glass: surface('window', 'window_grid', 0.65),
};

const footway = [
  [-3, 42.5],
  [-2.4, 35.8],
  [-3.13, 27.3],
  [-0.96, 19.64],
  [0.23, 14.37],
  [-0.22, 8.45],
  [-0.75, 2.96],
  [-2.5, -4.14],
  [-2.09, -13.0],
  [-1.49, -20],
  [-0.56, -25.7],
  [1.2, -31.81],
  [5.0, -37.09],
];

function localRoom(out, points, cabinIndex, lod, heightOffset = 0) {
  const center = planarMid(points);
  const ground = points.map(grade);
  const low = Math.min(...ground);
  const firstFloor = Math.max(low + 0.49, grade(center) + 0.32) + heightOffset;
  const deck = firstFloor + 0.089;
  const fascia = deck + (cabinIndex === 0 || cabinIndex === 3 ? 2.31 : 2.13);
  const segments = pairs(closed(points));
  const direction = segments
    .map(([a, b]) => ({ a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) }))
    .sort((a, b) => b.length - a.length)[0];
  const u = (direction.b[0] - direction.a[0]) / direction.length,
    v = (direction.b[1] - direction.a[1]) / direction.length;
  const rotate = (a, y, b) => [center[0] + u * a - v * b, y, center[1] + v * a + u * b];
  const p = (a, b, y) => rotate(a, y, b);
  const proj = points.map(([x, z]) => [
    (x - center[0]) * u + (z - center[1]) * v,
    -(x - center[0]) * v + (z - center[1]) * u,
  ]);
  const us = proj.map((q) => q[0]),
    vs = proj.map((q) => q[1]);
  const ua = Math.min(...us),
    ub = Math.max(...us),
    va = Math.min(...vs),
    vb = Math.max(...vs),
    ridge = (va + vb) / 2;
  const canopy = 0.22,
    peak = fascia + Math.min(1.25, (vb - va) * 0.24);
  shell(out, points, (p) => Math.min(firstFloor - 0.19, grade(p) - 0.28), firstFloor, {
    wall: 'stone',
    color: tone.stone,
  });
  shell(out, points, () => firstFloor, fascia, {
    wall: 'walls',
    color: cabinIndex % 3 === 0 ? tone.light : tone.grey,
  });
  cap(out, 'walls', points, fascia - 0.018, tone.plank);
  for (const [outer, color] of [
    [va - canopy, tone.roofLight],
    [vb + canopy, tone.roof],
  ]) {
    face(
      out,
      'roof',
      [
        p(ua - canopy, outer, fascia),
        p(ub + canopy, outer, fascia),
        p(ub + canopy, ridge, peak),
        p(ua - canopy, ridge, peak),
      ],
      up,
      color,
    );
    if (lod > 1) {
      const count = Math.max(4, Math.round((ub - ua) / 0.82));
      for (let i = 1; i < count; i++) {
        const x = mix(ua - canopy, ub + canopy, i / count);
        face(
          out,
          'roof',
          [
            p(x - 0.017, outer, fascia + 0.015),
            p(x + 0.017, outer, fascia + 0.015),
            p(x + 0.017, ridge, peak + 0.019),
            p(x - 0.017, ridge, peak + 0.019),
          ],
          up,
          tone.roofDark,
        );
      }
    }
  }
  for (const [x, fac] of [
    [ua, -1],
    [ub, 1],
  ]) {
    face(
      out,
      'walls',
      [p(x, va, fascia), p(x, vb, fascia), p(x, ridge, peak)],
      [u * fac, 0, v * fac],
      tone.grey,
    );
  }
  const sign = areaSign(points);
  const facing = segments.map(([a, b]) => edge(a, b, sign));
  const closestToWalk = facing.reduce(
    (best, w) => {
      const p = w.p(w.length * 0.5, 0, 0.025);
      const distance = Math.min(...footway.map(([u, z]) => Math.hypot(u - p[0], z - p[2])));
      return distance < best.distance ? { w, distance } : best;
    },
    { w: facing[0], distance: Infinity },
  ).w;
  for (const w of facing) {
    const door = w === closestToWalk;
    const path = w.length * 0.5 + (door && w.length > 6 ? -1.41 : 0);
    if (door) {
      panel(out, 'trim', w, path - 0.43, path + 0.43, deck, deck + 1.77, 0.034, tone.shade);
      if (lod > 0) {
        const x = path - 0.46;
        trimBlock(out, 'trim', w, x - 0.047, x + 0.047, deck, deck + 1.82, 0.01, 0.07, tone.sill);
        trimBlock(
          out,
          'trim',
          w,
          path + 0.42,
          path + 0.5,
          deck,
          deck + 1.83,
          0.01,
          0.07,
          tone.sill,
        );
      }
    }
    if (lod === 0) continue;
    const count = Math.max(1, Math.round(w.length / (cabinIndex === 3 ? 2.04 : 2.61)));
    for (let i = 0; i < count; i++) {
      if (w.length < 1.18) continue;
      const x = ((i + 0.5) * w.length) / count;
      if (door && Math.abs(x - path) < 1.01) continue;
      const radius = w.length > 2 ? 0.33 : 0.25,
        y = deck + 0.74,
        h = 0.68;
      panel(
        out,
        'trim',
        w,
        x - radius - 0.058,
        x + radius + 0.058,
        y - 0.06,
        y + h + 0.055,
        0.035,
        tone.plank,
      );
      panel(out, 'glass', w, x - radius, x + radius, y, y + h, 0.048, tone.shade);
      if (lod > 1) {
        for (const s of [-1, 1]) {
          const u = x + s * (radius + 0.18);
          panel(
            out,
            'trim',
            w,
            u - 0.16,
            u + 0.16,
            y - 0.027,
            y + h + 0.033,
            0.067,
            cabinIndex % 2 === 0 ? tone.paleWood : tone.wood,
          );
        }
        panel(out, 'trim', w, x - 0.022, x + 0.021, y, y + h, 0.074, tone.sill);
        panel(out, 'trim', w, x - radius, x + radius, y + 0.29, y + 0.331, 0.074, tone.sill);
      }
    }
    if (lod === 3 && w.length > 1.1) {
      for (let i = 1; i < 7; i++) {
        const y = deck + i * 0.255;
        panel(out, 'trim', w, 0.1, w.length - 0.1, y, y + 0.015, 0.01, tone.plank);
      }
    }
  }
}

function timberHuts(out, lod) {
  for (const [i, hut] of d.rooms.entries()) {
    if (i === 3) {
      localRoom(out, rect(0.33, 1.1, 6.45, 8.74), i, lod);
      localRoom(out, rect(-2.47, -1.94, 4.63, 1.3), i + 1, lod, 0.11);
    } else {
      localRoom(out, hut.points, i, lod);
    }
  }
}

function boardwalk(out, lod) {
  const y = footway.map((p) => grade(p) + 0.23);
  for (const [i, [a, b]] of pairs(footway).entries()) {
    const w = edge(a, b),
      first = y[i],
      last = y[i + 1];
    const p = (u, h, s) => w.p(u, mix(first, last, u / w.length) + h, s);
    const w2 = i < 3 ? 0.88 : 0.62;
    face(
      out,
      'trim',
      [p(-0.11, 0, -w2), p(w.length + 0.12, 0, -w2), p(w.length + 0.12, 0, w2), p(-0.11, 0, w2)],
      up,
      tone.paleWood,
    );
    if (lod === 0) continue;
    for (const s of [-1, 1]) {
      const inner = s * w2;
      if (i > 3 && s < 0 && i % 2 === 0) continue;
      for (const h of [0.48, 0.91]) {
        face(
          out,
          'trim',
          [
            p(0, h - 0.055, inner),
            p(w.length, h - 0.055, inner),
            p(w.length, h + 0.055, inner),
            p(0, h + 0.055, inner),
          ],
          w.normal.map((x) => x * s),
          tone.wood,
        );
      }
      const posts = Math.max(2, Math.round(w.length / 2.85));
      for (let j = 0; j < posts; j++) {
        const u = (w.length * (j + 0.12)) / posts;
        const [x, y, z] = p(u, 0, inner),
          bot = Math.min(grade([x, z]) - 0.17, y - 0.22);
        block(out, 'trim', x - 0.065, bot, z - 0.065, 0.13, y + 0.98 - bot, 0.13, tone.wood);
      }
    }
    if (lod > 1) {
      const n = Math.round(w.length / 0.65);
      for (let i = 1; i < n; i++) {
        const u = (i * w.length) / n;
        face(
          out,
          'trim',
          [
            p(u - 0.02, 0.018, -w2),
            p(u + 0.02, 0.018, -w2),
            p(u + 0.02, 0.018, w2),
            p(u - 0.02, 0.018, w2),
          ],
          up,
          tone.sill,
        );
      }
    }
  }
}

function rock(out, [x, z, w, l, h], index, lod) {
  const y = grade([x, z]);
  const n = lod === 0 ? 5 : 7;
  const position = (i, r, j) => {
    const angle = (2 * Math.PI * (i + 0.08 * j)) / n;
    const d = (0.9 + 0.1 * Math.sin(i * 1.7 + j + index)) * r;
    const x1 = x + w * d * Math.cos(angle),
      z1 = z + l * d * Math.sin(angle);
    return [
      x1,
      j === -1
        ? Math.min(y - 0.36, grade([x1, z1]) - 0.12)
        : y + h * (j === 0 ? 0.45 : 0.8 + 0.09 * Math.sin(i + index)),
      z1,
    ];
  };
  for (let i = 0; i < n; i++) {
    const a = position(i, 0.98, -1),
      b = position(i + 1, 0.98, -1),
      c = position(i + 1, 1.03, 0),
      d = position(i, 1.03, 0),
      e = position(i, 0.55, 1),
      f = position(i + 1, 0.55, 1);
    const angle = ((i + 0.5) * 2 * Math.PI) / n,
      normal = [Math.cos(angle), 0, Math.sin(angle)];
    face(out, 'cliff', [a, b, c], normal, tone.rockShade);
    face(out, 'cliff', [a, c, d], normal, tone.rock);
    face(out, 'cliff', [d, c, f], normal, i % 3 === 0 ? tone.moss : tone.rockLight);
    face(out, 'cliff', [d, f, e], normal, tone.rock);
    face(out, 'cliff', [e, f, [x + 0.14 * w, y + h, z]], up, tone.rockLight);
  }
}

function gorge(out, lod) {
  for (const [i, p] of [
    [-13.35, 22.93, 3.31, 5.5, 5.68],
    [-13.8, 10.22, 3.82, 7.95, 9.11],
    [-10.1, -6.5, 3.33, 6.52, 7.41],
    [-8.38, -20.9, 2.66, 6.16, 5.91],
    [-4.33, -32.5, 2.31, 5.65, 4.81],
    [10.26, 17.9, 2.82, 6.07, 5.2],
    [9.55, 6.13, 2.0, 4.68, 5.12],
    [12.7, -10.7, 3.3, 7.45, 8.28],
    [15.72, -22.8, 2.42, 5.95, 6.56],
    [17.2, -35.2, 3.1, 7.51, 8.19],
  ].entries())
    rock(out, p, i, lod);
  if (lod === 0) return;
  const beds = [
    [3.4, 38.3],
    [2.68, 30.7],
    [4.65, 21.76],
    [2.48, 14.1],
    [1.53, 6.5],
    [-2.36, 0.54],
    [-3.99, -8.8],
    [-3.63, -18.21],
    [-2.82, -27.4],
    [0, -38.1],
  ];
  for (const [a, b] of pairs(beds)) {
    const w = edge(a, b),
      y0 = grade(a) + 0.032,
      y1 = grade(b) + 0.032;
    face(
      out,
      'cliff',
      [w.p(0, y0, -0.53), w.p(w.length, y1, -0.55), w.p(w.length, y1, 0.55), w.p(0, y0, 0.52)],
      up,
      tone.water,
    );
  }
}

function build(out, lod) {
  gorge(out, lod);
  timberHuts(out, lod);
  boardwalk(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'franja-partisan-hospital-model.mjs';
const camera = [41, 68, 77],
  lookAt = [2, 13, -7];
export const franjaHospitalModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The lower Pasice approach anchors the original gorge heights. Cabins and paths use sampled ground at their recorded location.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.91,
    basis:
      'The nine surviving mapped pavilion traces define the dated replacement building positions.',
  },
  brief:
    'Franja’s timber field hospital huts, weathered roofs and linked public footway in the Pasice gorge as pictured just before the 2007 flood.',
  camera,
  lookAt,
  sunDirection: [18, 61, 63],
  mediumFiContext: {
    scale: 1,
    groundY: -8.0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'timber-huts-and-pasice-gorge', position: [-7, 30, 67], lookAt: [0, 12, -8] },
    { name: 'weathered-board-cladding-and-walkway', position: [-2, 14, 28], lookAt: [1, 11, 8] },
    { name: 'mapped-huts-on-both-banks', position: [38, 57, -21], lookAt: [0, 13, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'franja-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.76,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Žiga’s exact Qualla originals were released to the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
