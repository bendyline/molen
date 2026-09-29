/** Individually authored Arda bridge, with seven open vaults and its low humped walkway. */

import { readFileSync } from 'node:fs';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0016_dyavolski_most', 'map-frame.json')),
);
const gray = [0.39, 0.385, 0.344],
  mortar = [0.35, 0.342, 0.305];
const rnd = (s) => {
  const n = Math.sin(s * 57.817 + 81.72) * 38181.371;
  return n - Math.floor(n);
};
const tint = (s) =>
  gray.map((v, i) => v + (rnd(s) - 0.5) * 0.14 + (i === 0 ? rnd(s + 13) * 0.035 : 0));
function rubblePolygon(left, right, lowerLeft, lowerRight, upperLeft, upperRight, seed) {
  const corners = [
    [left, lowerLeft],
    [right, lowerRight],
    [right, upperRight],
    [left, upperLeft],
  ];
  return corners.flatMap((p, i) => {
    const previous = corners[(i + 3) % 4],
      next = corners[(i + 1) % 4];
    return [
      p.map((v, k) => v + (previous[k] - v) * (0.06 + 0.22 * rnd(seed + i * 7))),
      p.map((v, k) => v + (next[k] - v) * (0.07 + 0.23 * rnd(seed + i * 13))),
    ];
  });
}
const courseWobble = (x, row) => 0.032 * Math.sin(x * 2.8 + row * 7.31);
const deck = (x) => 12.08 - Math.abs(x) * 0.177;
const bottom = (x) => (Math.abs(x) < 22 ? 0 : Math.min(4.6, (Math.abs(x) - 22) * 0.47));
const arches = [
  { c: -26.45, rx: 1.34, sy: 3.57, ry: 1.26, floor: 3.57 },
  { c: -16.9, rx: 4.5, sy: 2.1, ry: 4.55, floor: 0 },
  { c: -10.75, rx: 1.09, sy: 6.54, ry: 1.47, floor: 6.54 },
  { c: 0, rx: 9.1, sy: 2.9, ry: 8.2, floor: 0 },
  { c: 10.93, rx: 1.25, sy: 6.23, ry: 1.73, floor: 6.23 },
  { c: 17.01, rx: 4.25, sy: 2.28, ry: 4.42, floor: 0 },
  { c: 26.18, rx: 1.76, sy: 3.84, ry: 1.76, floor: 3.84 },
];
const ceiling = (arch, x) =>
  arch.sy +
  arch.ry * Math.sqrt(Math.max(0, 1 - ((x - arch.c) / arch.rx) ** 2)) -
  0.1 * Math.sin(2 * Math.acos(Math.max(-1, Math.min(1, (x - arch.c) / arch.rx)))) ** 2;
function clip(poly, value) {
  const next = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = value(a),
      db = value(b);
    if (da >= 0) next.push(a);
    if (da < 0 !== db < 0) next.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return next;
}
function prism(out, poly, z0, z1, color, rough = false) {
  poly = poly
    .map((p) => p.map(Math.fround))
    .filter(
      (p, i, a) => Math.hypot(...p.map((v, k) => v - a[(i + a.length - 1) % a.length][k])) > 1e-5,
    );
  for (let i = poly.length - 1; i >= 0 && poly.length >= 3; i--) {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[i],
      c = poly[(i + 1) % poly.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-7)
      poly.splice(i, 1);
  }
  if (poly.length < 3) return;
  if (
    poly.reduce(
      (s, p, i) =>
        s + p[0] * poly[(i + 1) % poly.length][1] - p[1] * poly[(i + 1) % poly.length][0],
      0,
    ) < 0
  )
    poly.reverse();
  const a = poly.map(([x, y]) => [x, y, z0]),
    b = poly.map(([x, y]) => [x, y, z1]);
  for (const [face, n] of [
    [a.toReversed(), [0, 0, -1]],
    [b, [0, 0, 1]],
  ]) {
    const center = face[0].map((_, k) => face.reduce((s, p) => s + p[k], 0) / face.length);
    const seed = center[0] * 17 + center[1] * 29;
    const inner = rough
      ? face.map((p) =>
          p.map(
            (v, k) =>
              center[k] +
              (v - center[k]) * (0.8 + rnd(seed) * 0.13) +
              n[k] * (0.017 + rnd(seed * 13) * 0.041),
          ),
        )
      : face;
    out.addConvexPolygon('stone', 'palette:#ffffff', inner, n, (p) => [p[0], p[1]], color);
    if (rough)
      for (let i = 0; i < face.length; i++) {
        const j = (i + 1) % face.length,
          q = [face[i], face[j], inner[j], inner[i]];
        quad(
          out,
          'stone',
          q,
          normalFor(...q),
          color.map((v) => v * 0.93),
        );
      }
  }
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      q = [a[i], a[j], b[j], b[i]];
    quad(out, 'stone', q, normalFor(...q), color);
  }
}
function intervals(x, a, b) {
  const arch = arches.find((v) => Math.abs(x - v.c) < v.rx);
  const ranges = [];
  if (arch && arch.floor > 0) ranges.push([bottom(a), bottom(b), arch.floor, arch.floor]);
  ranges.push([
    arch ? ceiling(arch, a) : bottom(a),
    arch ? ceiling(arch, b) : bottom(b),
    deck(a) - 0.1,
    deck(b) - 0.1,
  ]);
  return ranges;
}
const boundaries = arches.flatMap((a) => [a.c - a.rx, a.c, a.c + a.rx]);
function slices(left, right, maxStep = 1) {
  const points = [left, right, ...boundaries.filter((x) => x > left && x < right)];
  for (let x = left + maxStep; x < right; x += maxStep) points.push(x);
  return [...new Set(points)].sort((a, b) => a - b);
}
function fillFace(out, poly, z0, z1, color, rough = false) {
  const left = Math.min(...poly.map((p) => p[0])),
    right = Math.max(...poly.map((p) => p[0]));
  const xs = slices(left, right, 10);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    const segment = clip(
      clip(poly, (p) => p[0] - a),
      (p) => b - p[0],
    );
    if (segment.length < 3) continue;
    for (const [lo0, lo1, hi0, hi1] of intervals((a + b) / 2, a + 1e-7, b - 1e-7)) {
      const lo = (x) => lo0 + ((lo1 - lo0) * (x - a)) / (b - a),
        hi = (x) => hi0 + ((hi1 - hi0) * (x - a)) / (b - a);
      const p = clip(
        clip(segment, (v) => v[1] - lo(v[0])),
        (v) => hi(v[0]) - v[1],
      );
      if (p.length >= 3) prism(out, p, z0, z1, color, rough);
    }
  }
}
function vault(out, arch) {
  const count = Math.ceil(arch.rx * 16),
    thick = arch.rx > 4 ? 0.52 : 0.24;
  const p = (t, r) => [
    arch.c - (arch.rx + r) * Math.cos(t),
    arch.sy + (arch.ry + r) * Math.sin(t) - 0.1 * Math.sin(2 * t) ** 2,
  ];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * i) / count,
      b = (Math.PI * (i + 1)) / count;
    // Whole-width barrel, then separate weathered edge voussoirs on both elevations.
    prism(out, [p(a, 0), p(b, 0), p(b, thick), p(a, thick)], -1.735, 1.735, tint(i + arch.c));
    for (const z of [-1.767, 1.767]) {
      const da = (Math.PI * (i + 0.022)) / count,
        db = (Math.PI * (i + 0.978)) / count;
      prism(
        out,
        [p(da, -0.009), p(db, -0.009), p(db, thick + 0.025), p(da, thick + 0.025)],
        z - 0.024,
        z + 0.024,
        tint(i * 17 + arch.c).map((v) => v + 0.075),
        true,
      );
    }
    // Cross-barrel stone courses, visible from below rather than a smooth extruded strip.
    for (let lane = 0; lane < 9; lane++) {
      const za = -1.71 + lane * 0.38,
        zb = Math.min(1.72, za + 0.36),
        da = (Math.PI * (i + 0.02)) / count,
        db = (Math.PI * (i + 0.98)) / count;
      prism(
        out,
        [p(da, -0.027), p(db, -0.027), p(db, 0.06), p(da, 0.06)],
        za,
        zb,
        tint(i * 31 + lane * 19 + arch.c),
      );
    }
  }
  // The lowest exposed pier faces continue below the vault springing line.
  // Their stone relief wraps into each opening instead of leaving a bare core panel.
  if (arch.floor === 0)
    for (const side of [-1, 1])
      for (let row = 0, y = 0.02; y < arch.sy - 0.035; row++, y += 0.23)
        for (let z = -1.72; z < 1.72; ) {
          const step = 0.23 + rnd(z * 31 + row * 19) * 0.27,
            end = Math.min(1.72, z + step - 0.008),
            outline = rubblePolygon(
              z,
              end,
              y,
              y + 0.01,
              Math.min(arch.sy, y + 0.215),
              Math.min(arch.sy, y + 0.21),
              z * 17 + row * 29,
            ),
            q = outline.map(([u, h]) => [arch.c + side * (arch.rx - 0.015), h, u]),
            n = [-side, 0, 0],
            color = tint(z * 31 + row * 13);
          if (normalFor(...q)[0] * n[0] < 0) q.reverse();
          const center = q[0].map((_, k) => q.reduce((sum, p) => sum + p[k], 0) / q.length),
            inner = q.map((p) =>
              p.map((v, k) => center[k] + (v - center[k]) * 0.88 + n[k] * 0.025),
            );
          out.addConvexPolygon('stone', 'palette:#ffffff', inner, n, (p) => [p[2], p[1]], color);
          for (let k = 0; k < q.length; k++) {
            const j = (k + 1) % q.length,
              edge = [q[k], q[j], inner[j], inner[k]];
            quad(out, 'stone', edge, normalFor(...edge), color);
          }
          z += step;
        }
}
function cutwater(out, x, width, height) {
  const plan = [
    [x - width / 2, 1.73],
    [x, 3.1],
    [x + width / 2, 1.73],
  ].reverse();
  const rings = [plan.map(([x, z]) => [x, 0.02, z]), plan.map(([x, z]) => [x, height, z])];
  loft(out, 'stone', rings, gray);
  out.addCap(
    'stone',
    'palette:#ffffff',
    plan,
    [],
    () => height,
    [0, 1, 0],
    (p) => p,
    gray.map((v) => v + 0.06),
  );
  for (let i = 0; i < 2; i++) {
    const a = plan[i],
      b = plan[i + 1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let row = 0, y = 0.03; y < height - 0.03; row++, y += 0.21) {
      for (let d = 0; d < length; ) {
        const step = 0.2 + rnd(row * 57 + d * 17) * 0.29,
          start = d + 0.006,
          end = Math.min(length, d + step - 0.006);
        d += step;
        if (end <= start) continue;
        const outline = rubblePolygon(
          start,
          end,
          y + courseWobble(start, row),
          y + courseWobble(end, row),
          Math.min(height, y + 0.198 + courseWobble(start, row + 1)),
          Math.min(height, y + 0.198 + courseWobble(end, row + 1)),
          row * 47 + d * 19,
        );
        const q = outline
            .map(([u, h]) => [
              a[0] + ((b[0] - a[0]) * u) / length,
              h,
              a[1] + ((b[1] - a[1]) * u) / length,
            ])
            .reverse(),
          n = normalFor(...q),
          center = q[0].map((_, k) => q.reduce((sum, p) => sum + p[k], 0) / q.length),
          color = tint(row * 53 + d * 11),
          inner = q.map((p) => p.map((v, k) => center[k] + (v - center[k]) * 0.84 + n[k] * 0.046));
        for (const p of q) for (let k = 0; k < 3; k++) p[k] += n[k] * 0.006;
        out.addConvexPolygon('stone', 'palette:#ffffff', inner, n, (p) => [p[0], p[1]], color);
        for (let k = 0; k < q.length; k++) {
          const j = (k + 1) % q.length,
            edge = [q[k], q[j], inner[j], inner[k]];
          quad(out, 'stone', edge, normalFor(...edge), color);
        }
      }
    }
  }
}
function paving(out) {
  for (let row = 0, x = -32.85; x < 32.85; row++, x += 0.23) {
    const x1 = Math.min(32.85, x + 0.22);
    for (let lane = 0, z = -1.57; z < 1.57; lane++) {
      const step = 0.2 + rnd(row * 71 + lane * 23) * 0.19,
        z1 = Math.min(1.57, z + step - 0.012);
      const q = [
        [x, deck(x), z],
        [x, deck(x), z1],
        [x1, deck(x1), z1],
        [x1, deck(x1), z],
      ];
      const n = normalFor(...q),
        color = tint(row * 13 + lane * 19).map((v) => v + 0.025);
      quad(out, 'stone', q, n, color);
      for (let i = 0; i < q.length; i++) {
        const j = (i + 1) % q.length,
          edge = [
            q[j],
            q[i],
            [q[i][0], q[i][1] - 0.065, q[i][2]],
            [q[j][0], q[j][1] - 0.065, q[j][2]],
          ];
        quad(out, 'stone', edge, normalFor(...edge), color);
      }
      z += step;
    }
    for (const side of [-1, 1]) {
      const z = side * 1.68;
      prism(
        out,
        [
          [x, deck(x) - 0.03],
          [x1, deck(x1) - 0.03],
          [x1, deck(x1) + 0.12],
          [x, deck(x) + 0.12],
        ],
        z - 0.095,
        z + 0.095,
        tint(row * 17),
        true,
      );
    }
  }
}
export function buildDyavolski(out) {
  const xs = slices(-32.85, 32.85, 0.14);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    fillFace(
      out,
      [
        [a, 0],
        [b, 0],
        [b, 13],
        [a, 13],
      ],
      -1.73,
      1.73,
      mortar,
    );
  }
  for (const a of arches) vault(out, a);
  for (const side of [-1, 1]) {
    for (let row = 0, y = 0; y < 12.15; row++) {
      const height = 0.17 + rnd(row * 71) * 0.13;
      for (let x = -32.85 - (row % 2) * 0.24; x < 32.85; ) {
        const w = 0.2 + rnd(x * 17 + row * 53) * 0.43,
          a = Math.max(-32.85, x + 0.006),
          b = Math.min(32.85, x + w - 0.006);
        if (b > a) {
          const p = rubblePolygon(
            a,
            b,
            y + courseWobble(a, row),
            y + courseWobble(b, row),
            y + height - 0.009 + courseWobble(a, row + 1),
            y + height - 0.009 + courseWobble(b, row + 1),
            x * 31 + row * 61,
          );
          fillFace(
            out,
            p,
            side * 1.765 - 0.02,
            side * 1.765 + 0.02,
            tint(x * 31 + row * 13 + side),
            true,
          );
        }
        x += w;
      }
      y += height;
    }
  }
  cutwater(out, -10.75, 3.3, 6.45);
  cutwater(out, 10.93, 3.66, 6.14);
  paving(out);
}
export const dyavolskiStudy = {
  id: 'N0016',
  key: 'dyavolski_most',
  title: 'Dyavolski Most (Devil’s Bridge)',
  wikidataId: 'Q2458142',
  build: buildDyavolski,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Individually reconstructed Arda crossing with three unequal major vaults, four separate flood openings, upstream pointed cutwaters, irregular mineral stone masonry, exposed stone soffits, steep humped cobbled walkway and extremely low stone edges.',
  refs: [
    'https://www.tourism.government.bg/sites/tourism.government.bg/files/bulletin_5_march_2019_eden_iii_edition_english.pdf',
    'https://basa-architecture.eu/_files/osnovna_tqlo_2023_compressed-1.pdf',
    'https://doi.org/10.3390/buildings14010054',
    'https://commons.wikimedia.org/wiki/File:Bulgaria-Diavolski_most-01.jpg',
    'https://commons.wikimedia.org/wiki/File:Bulgaria-Diavolski_most-02.jpg',
    'https://commons.wikimedia.org/wiki/File:DJI_vp3.jpg',
    'https://www.openstreetmap.org/way/58478181',
  ],
  sourceFacts: {
    identity: 'Exact Q2458142 Arda crossing near Ardino, not the similarly named Belasitsa bridge',
    publishedMainSpansMeters: [9, 18.2, 8.5],
    publishedWidthMeters: 3.55,
    publishedPierWidthsMeters: [3.3, 3.66],
    publishedParapetHeightMeters: 0.12,
    publishedLengthDisagreementMeters: [56, 65.7],
    mappedPathLengthMeters: 59.092,
  },
  reconstruction: {
    bodyLengthMeters: 65.7,
    mainArchRiseMeters: 8.2,
    overallHeightMeters: 12.2,
    deckGrade: 0.177,
    basis:
      'Engineering elevation and primary photographs guide arch stations and four relief openings. Mineral stone courses, exact approach bases and paving are original reconstructions. Published 18-per-mille deck grade conflicts with the visibly steep hump; the slope follows the elevation drawing and photographs.',
  },
  nativeAxes: {
    x: 'south-southeast along the mapped pedestrian crossing',
    y: 'up from reconstructed lowest pier footings near low water',
    z: 'west-southwest toward upstream Arda and pointed cutwaters',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/58478181'],
    source: 'https://www.openstreetmap.org/way/58478181',
    elevationMode: 'terrain-contact',
    notes:
      'The exact mapped59.092m path sets position and signed axis. The65.7m engineering extent includes reconstructed approaches beyond the map path endpoints; no stretch is applied. Riverbed and bedrock-bank vertical fit remains pending.',
  }),
  limitations: [
    'Tourism documents state56m length; engineering publications state65.7m, and the mapped path is59.092m. The engineering extent is retained and the disagreement remains explicit.',
    'The original stone-by-stone model is reconstructed from photos and a published elevation, not a scan or measured current survey.',
    'The original low stone edge is retained. Surrounding bedrock, trees and modern visitor shelters are terrain/scenery, not embedded into the bridge model.',
    'Actual riverbed and both approach terrain elevations need review before geographic approval.',
  ],
  camera: { position: [32, 25, 49], lookAt: [0, 6, 0], fov: 44 },
  qaCameras: [
    { name: 'seven-openings', position: [0, 7.5, 58], lookAt: [0, 6, 0], fov: 54 },
    { name: 'upstream-pier', position: [19, 8, 13], lookAt: [10.9, 5, 1.7], fov: 49 },
    { name: 'flood-opening', position: [-11, 7.7, 9], lookAt: [-10.75, 7.2, 0], fov: 43 },
    { name: 'main-soffit', position: [4, 1.6, 9], lookAt: [0, 8.3, 0], fov: 63 },
    { name: 'cobbled-hump', position: [25, 10.8, 2], lookAt: [0, 12, 0], fov: 50 },
    { name: 'rubble-masonry', position: [8.8, 8.3, 6], lookAt: [9.1, 8.5, 1.7], fov: 43 },
    { name: 'north-approach', position: [-36, 10, 10], lookAt: [-24, 5.3, 0], fov: 48 },
  ],
};
