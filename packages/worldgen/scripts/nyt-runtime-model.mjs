/** Complete Times parcel, with distance-specific ceramic screens and an open woodland court. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
} from './signature-tower-expansion-models.mjs';
import { skylineNext } from './signature-tower-next-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0155_new_york_times_building',
  frame = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8')),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8')),
  parts = partsEvidence(key),
  silver = [0.67, 0.7, 0.69],
  glass = [0.33, 0.43, 0.46],
  ceramic = [1, 1, 0.96],
  green = [0.23, 0.33, 0.15],
  treeSites = [
    [-7, -8],
    [-2, -9],
    [5, -8],
    [7, -3],
    [-7, -2],
    [-3, 3],
    [4, 4],
    [-7, 6],
    [7, 7],
  ];
const plan = (m, id) =>
  partPlan(
    m,
    parts.find((p) => p.id === id),
  );
const edges = (p) =>
  p
    .map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.05);
const wall = (a, b, lo, hi) => [
  [a[0], lo, a[1]],
  [b[0], lo, b[1]],
  [b[0], hi, b[1]],
  [a[0], hi, a[1]],
];

function westernGlass(out, m, level) {
  const p = plan(m, 260282089);
  for (const { a, b } of edges(p))
    grid(
      out,
      wall(a, b, 25, 227),
      glass,
      level === 'street' ? 1.6 : 4.8,
      level === 'district' ? 8.8 : 4.4,
      level === 'skyline' ? 0 : 0.055,
      silver,
    );
  mappedCap(out, 'concrete', p, 227, [0.64, 0.66, 0.63]);
}

/** Nine illustrative multi-stem birches; the primary landscape source does not survey tree sites. */
function garden(out, m, level) {
  const hole = clockwise(m.geometry.holes[0].slice(0, -1)),
    coarse = level === 'skyline' || level === 'district',
    sides = level === 'skyline' ? 4 : coarse ? 6 : level === 'street' ? 8 : 12;
  mappedCap(out, 'foliage', hole, 0.08, green);
  // The photographed straight timber bridge sits above shallow sedge hillocks.
  box(out, 'wood', [-10.5, 0.14, -0.85], [10.4, 0.36, 0.85], [0.3, 0.24, 0.16]);
  treeSites.forEach(([x, z], i) => {
    const top = 15.24 - (i % 3) * 0.35,
      radius = 1.35 + (i % 2) * 0.25;
    if (level !== 'skyline')
      loft(
        out,
        'foliage',
        [radialRing(0.09, 2.2, 1.6, sides, [x, z]), radialRing(0.48, 0.9, 0.7, sides, [x, z])],
        green,
      );
    for (const s of coarse ? [0] : [-1, 1]) {
      if (level === 'skyline') {
        face(out, 'bark', wall([x - 0.1, z], [x + 0.1, z], 0.35, top - 2.8), [0.83, 0.83, 0.75]);
        continue;
      }
      beam(
        out,
        'bark',
        [x + s * 0.22, 0.35, z],
        [x + s * 0.48, top - 2.8, z + s * 0.2],
        0.18,
        0.18,
        [0.83, 0.83, 0.75],
      );
      if (!coarse)
        for (const d of [-1, 1])
          beam(
            out,
            'bark',
            [x + s * 0.4, top - 5, z],
            [x + d * radius * 0.75, top - 1.8, z + s * 0.75],
            0.09,
            0.09,
            [0.8, 0.81, 0.74],
          );
    }
    loft(
      out,
      'foliage',
      [
        radialRing(top - 4.8, radius * 0.55, radius * 0.5, sides, [x, z]),
        ...(level === 'skyline'
          ? []
          : [radialRing(top - 2.1, radius, radius * 0.85, sides, [x, z])]),
        radialRing(top, radius * 0.25, radius * 0.3, sides, [x, z]),
      ],
      [0.31, 0.42, 0.2],
    );
  });
}

function originalWithoutLowSideRods(out, m, omitRods = false) {
  const wrapped = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    wrapped[method] = (component, ref, points, normal, uv, color) => {
      if (component === 'cladding') {
        if (omitRods) return;
        const x = points.reduce((n, p) => n + p[0], 0) / points.length;
        if ((x < -60 || x > -12.5) && Math.max(...points.map((p) => p[1])) < 12) return;
        color = ceramic;
      }
      out[method](component, ref, points, normal, uv, color);
    };
  skylineNext.find((p) => p.id === 'N0155').build(wrapped, m);
}

function screens(out, m, level, rodsOnly = false) {
  const stride = { skyline: 16, district: 8, street: 2, closeup: 1 }[level],
    diameter = 0.0762 * stride;
  for (const id of [260282084, 260282085, 260282086, 260282088]) {
    const selected = edges(plan(m, id)).sort((a, b) => b.len - a.len)[0],
      outward = {
        260282084: [0, 0, 1],
        260282085: [0, 0, -1],
        260282086: [-1, 0, 0],
        260282088: [1, 0, 0],
      }[id],
      reverse = selected.n.reduce((s, v, i) => s + v * outward[i], 0) < 0,
      { len } = selected,
      a = reverse ? selected.b : selected.a,
      b = reverse ? selected.a : selected.b,
      n = selected.n.map((v) => (reverse ? -v : v)),
      low = id === 260282084 || id === 260282085 ? 6 : 12;
    if (!rodsOnly) {
      const count = Math.ceil(len / (level === 'skyline' ? 12 : 6));
      for (let i = 0; i <= count; i++) {
        const p = lerp(a, b, i / count);
        if (level === 'skyline' || level === 'district') {
          const aa = lerp(a, b, Math.max(0, i / count - 0.1 / len)),
            bb = lerp(a, b, Math.min(1, i / count + 0.1 / len));
          face(out, 'metal', wall(aa, bb, low, 259.8), silver);
        } else beam(out, 'metal', [p[0], low, p[1]], [p[0], 259.8, p[1]], 0.15, 0.2, silver);
        if (level === 'street')
          for (let y = 13; y < 228; y += 8.8) {
            const q = shift([p[0], y, p[1]], n, -0.8),
              r = [p[0], y, p[1]],
              f = [
                [q[0], y - 0.05, q[2]],
                [r[0], y - 0.05, r[2]],
                [r[0], y + 0.05, r[2]],
                [q[0], y + 0.05, q[2]],
              ];
            face(out, 'metal', f, silver);
            face(out, 'metal', f.toReversed(), silver);
          }
      }
    }
    // Fade above the actual roof. Strips retain rod coverage without opaque crown walls.
    for (let row = 0; 6.2 + row * 0.325 < 259.7; row += stride) {
      const y = 6.2 + row * 0.325;
      if (y < low) continue;
      const fade = Math.max(1, Math.floor((y - 224) / 6));
      if (stride === 1 && y > 228 && row % fade) continue;
      const width = y > 228 && stride > 1 ? diameter / fade : diameter;
      face(out, 'cladding', wall(a, b, y - width / 2, y + width / 2), ceramic);
    }
  }
}

export function buildNytReviewedMaster(out, m) {
  originalWithoutLowSideRods(out, m);
  westernGlass(out, m, 'street');
  garden(out, m, 'closeup');
}
export function buildNytCloseup(out) {
  originalWithoutLowSideRods(out, frame, true);
  westernGlass(out, frame, 'street');
  garden(out, frame, 'closeup');
  screens(out, frame, 'closeup', true);
}

function structure(out, level) {
  const m = frame,
    base = localOutline(m),
    holes = m.geometry.holes.map((r) => clockwise(r.slice(0, -1))),
    podium = plan(m, 260282083),
    shaft = plan(m, 138152327),
    core = plan(m, 260282082),
    far = level === 'skyline',
    district = level === 'district';
  mappedSolid(out, 'stone', base, 0, 0.25, [0.64, 0.64, 0.61], holes);
  for (const { a, b } of edges(podium))
    grid(
      out,
      wall(a, b, 0.25, 24.6),
      [0.28, 0.38, 0.41],
      far ? 99 : district ? 6.4 : 1.6,
      4.88,
      far ? 0 : 0.055,
      silver,
    );
  mappedCap(out, 'concrete', podium, 24.6, [0.58, 0.6, 0.57]);
  for (const { a, b, len, n } of edges(shaft)) {
    face(out, 'glass', wall(a, b, 0.25, 228), glass);
    if (!far) {
      const count = district ? 1 : Math.ceil(len / 1.45);
      for (let i = 0; i <= count; i++) {
        const aa = lerp(a, b, Math.max(0, i / count - 0.055 / len)),
          bb = lerp(a, b, Math.min(1, i / count + 0.055 / len));
        face(
          out,
          'metal',
          wall(aa, bb, 0.25, 228).map((p) => shift(p, n, 0.03)),
          silver,
        );
      }
    }
    if (!far)
      for (let y = 4.63; y < 228; y += district ? 8.76 : 4.38)
        face(
          out,
          'metal',
          wall(a, b, y - 0.325, y + 0.325).map((p) => shift(p, n, 0.02)),
          [0.59, 0.63, 0.65],
        );
    if (len < 6 || far) continue;
    for (const p of [a, b])
      beam(
        out,
        'metal',
        shift([p[0], 0.3, p[1]], n, 0.22),
        shift([p[0], 230, p[1]], n, 0.22),
        0.48,
        0.48,
        [0.7, 0.72, 0.71],
      );
    if (len < 17)
      for (let y = 18; y < 208; y += 17.6)
        for (const [aa, bb] of [
          [a, b],
          [b, a],
        ]) {
          const pa = shift([aa[0], y, aa[1]], n, 0.2),
            pb = shift([bb[0], y + 17.6, bb[1]], n, 0.2);
          if (district)
            face(
              out,
              'metal',
              aa === a
                ? [
                    [pa[0], pa[1] - 0.13, pa[2]],
                    [pb[0], pb[1] - 0.13, pb[2]],
                    [pb[0], pb[1] + 0.13, pb[2]],
                    [pa[0], pa[1] + 0.13, pa[2]],
                  ]
                : [
                    [pa[0], pa[1] + 0.13, pa[2]],
                    [pb[0], pb[1] + 0.13, pb[2]],
                    [pb[0], pb[1] - 0.13, pb[2]],
                    [pa[0], pa[1] - 0.13, pa[2]],
                  ],
              [0.69, 0.71, 0.7],
            );
          else beam(out, 'metal', pa, pb, 0.22, 0.25, [0.69, 0.71, 0.7]);
        }
  }
  mappedCap(out, 'concrete', shaft, 228, [0.64, 0.66, 0.63]);
  mappedSolid(out, 'metal', core, 230, 232, [0.52, 0.56, 0.57]);
  westernGlass(out, m, level);
  screens(out, m, level);
  garden(out, m, level);
  loft(
    out,
    'metal',
    [
      [232, 1.1],
      [274, 0.75],
      [300, 0.34],
      [319, 0.04],
    ].map(([y, r]) => radialRing(y, r, r, far ? 6 : 12, [-36.38, 0.32])),
    [0.7, 0.72, 0.71],
  );
}
export function buildNytStreet(out) {
  structure(out, 'street');
}
export function buildNytDistrict(out) {
  structure(out, 'district');
}
export function buildNytSkyline(out) {
  const avg = { glass, foliage: green, bark: [0.83, 0.83, 0.75] };
  const wrapped = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, points, normal, uv, color) => {
      const graph = {
          stone: 'stone_granite',
          concrete: 'concrete_plain',
          metal: 'metal_painted',
          cladding: 'tile_ceramic',
          wood: 'wood_plain',
        }[component],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        points,
        normal,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : (avg[component] ?? color),
      );
    };
  structure(wrapped, 'skyline');
}
