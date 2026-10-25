/** Surviving main chancery: native plan and cleared1950sQualla aerial, approximate exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/tn/tnk/tehran_former_us_embassy/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const brick = rgb('9e7560'),
  pale = rgb('cbc8b6'),
  base = rgb('aaa79a'),
  roof = rgb('7b8680'),
  glass = rgb('586d6b'),
  frameColor = rgb('aeb7aa'),
  door = rgb('465956');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.08 },
};
const ref = 'palette:#ffffff';
function facade(out, d, a, b, entry = false) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    n = [t[1], -t[0]],
    p = (u, y, depth = 0) => [a[0] + t[0] * u + n[0] * depth, y, a[1] + t[1] * u + n[1] * depth];
  const openings = entry
    ? [
        { u: length / 2, w: 3.4, y0: 0.55, y1: 3.45, door: true },
        { u: length / 2, w: 3.4, y0: 5.0, y1: 7.45 },
      ]
    : Array.from({ length: Math.max(1, Math.floor(length / 3.35)) }, (_, i) => {
        const count = Math.max(1, Math.floor(length / 3.35));
        return [1.35, 5.05].map((y0) => ({
          u: ((i + 0.5) * length) / count,
          w: 1.4,
          y0,
          y1: y0 + 2.05,
        }));
      }).flat();
  const panel = (u0, u1, y0, y1, depth, color, slot = 'brick') => {
    if (u1 - u0 < 1e-6 || y1 - y0 < 1e-6) return;
    const ps = [p(u0, y0, depth), p(u0, y1, depth), p(u1, y1, depth), p(u1, y0, depth)];
    quad(out, slot, ps, normalFor(...ps), color);
  };
  if (d === 0) {
    panel(0, length, 0.55, 8.8, 0, brick);
    return;
  }
  const xs = [
      ...new Set([0, length, ...openings.flatMap((o) => [o.u - o.w / 2, o.u + o.w / 2])]),
    ].sort((a, b) => a - b),
    ys = [...new Set([0.55, 8.8, ...openings.flatMap((o) => [o.y0, o.y1])])].sort((a, b) => a - b);
  for (let x = 0; x < xs.length - 1; x++)
    for (let y = 0; y < ys.length - 1; y++) {
      const u = (xs[x] + xs[x + 1]) / 2,
        v = (ys[y] + ys[y + 1]) / 2;
      if (openings.some((o) => Math.abs(u - o.u) < o.w / 2 && v > o.y0 && v < o.y1)) continue;
      panel(xs[x], xs[x + 1], ys[y], ys[y + 1], 0, brick);
    }
  for (const o of openings) {
    const l = o.u - o.w / 2,
      r = o.u + o.w / 2,
      ring = [
        [l, o.y0],
        [l, o.y1],
        [r, o.y1],
        [r, o.y0],
      ],
      depth = -0.19;
    panel(l, r, o.y0, o.y1, depth, o.door ? door : glass, 'glass');
    for (let i = 0; i < 4; i++) {
      const aa = ring[i],
        bb = ring[(i + 1) % 4],
        q = [p(aa[0], aa[1]), p(bb[0], bb[1]), p(bb[0], bb[1], depth), p(aa[0], aa[1], depth)];
      quad(out, 'trim', q, normalFor(...q), pale);
      if (d > 1)
        beam(out, 'trim', p(aa[0], aa[1], 0.025), p(bb[0], bb[1], 0.025), 0.075, 0.075, pale);
    }
    if (d > 1) {
      beam(
        out,
        'trim',
        p(l - 0.08, o.y0 - 0.08, 0.1),
        p(r + 0.08, o.y0 - 0.08, 0.1),
        0.13,
        0.2,
        pale,
      );
      beam(
        out,
        'trim',
        p(o.u, o.y0, depth + 0.025),
        p(o.u, o.y1, depth + 0.025),
        0.045,
        0.055,
        frameColor,
      );
      if (d > 2)
        for (const f of [0.34, 0.67])
          beam(
            out,
            'trim',
            p(l, o.y0 + (o.y1 - o.y0) * f, depth + 0.025),
            p(r, o.y0 + (o.y1 - o.y0) * f, depth + 0.025),
            0.04,
            0.04,
            frameColor,
          );
    }
  }
}
function hip(out) {
  const x0 = Math.min(...plan.body.map((p) => p[0])) - 0.3,
    x1 = Math.max(...plan.body.map((p) => p[0])) + 0.3,
    z0 = Math.min(...plan.body.map((p) => p[1])) - 0.3,
    z1 = Math.max(...plan.body.map((p) => p[1])) + 0.3,
    zm = (z0 + z1) / 2,
    run = (z1 - z0) / 2,
    e = plan.eaveMeters,
    h = plan.ridgeMeters;
  for (let p of [
    [
      [x0, e, z0],
      [x1, e, z0],
      [x1 - run, h, zm],
      [x0 + run, h, zm],
    ],
    [
      [x1, e, z1],
      [x0, e, z1],
      [x0 + run, h, zm],
      [x1 - run, h, zm],
    ],
    [
      [x0, e, z1],
      [x0, e, z0],
      [x0 + run, h, zm],
    ],
    [
      [x1, e, z0],
      [x1, e, z1],
      [x1 - run, h, zm],
    ],
  ]) {
    if (normalFor(...p)[1] < 0) p = p.reverse();
    out.addConvexPolygon('roof', ref, p, normalFor(...p), (p) => [p[0], p[2]], roof);
  }
}
function footing(out) {
  const ring = plan.outline,
    idx = earcut(ring.flat());
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      p = [
        [a[0], -0.18, a[1]],
        [b[0], -0.18, b[1]],
        [b[0], 0.55, b[1]],
        [a[0], 0.55, a[1]],
      ];
    quad(out, 'trim', p, [b[1] - a[1], 0, a[0] - b[0]], base);
  }
  for (const [y, normal] of [
    [-0.18, [0, -1, 0]],
    [0.55, [0, 1, 0]],
  ])
    for (let i = 0; i < idx.length; i += 3) {
      let p = idx.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
      if (normalFor(...p)[1] * normal[1] < 0) p = p.reverse();
      out.addTriangle(
        'trim',
        ref,
        p,
        normal,
        p.map((p) => [p[0], p[2]]),
        base,
      );
    }
}
function build(out, _frame, d = 3) {
  footing(out);
  for (let i = 0; i < 3; i++) facade(out, d, plan.body[i], plan.body[i + 1]);
  facade(out, d, plan.body[3], plan.entry[0]);
  facade(out, d, plan.entry[0], plan.entry[3], true);
  facade(out, d, plan.entry[3], plan.body[0]);
  const width = Math.max(...plan.body.map((p) => p[0])) - Math.min(...plan.body.map((p) => p[0])),
    depth = 17.0;
  B(out, 'trim', 0, 8.58, -0.12, width + 0.35, 0.24, depth + 0.1, pale);
  hip(out);
  // Tall pale portico and square attic are visible in the archival aerial.
  const x0 = Math.min(...plan.entry.map((p) => p[0])),
    x1 = Math.max(...plan.entry.map((p) => p[0])),
    cx = (x0 + x1) / 2,
    z0 = Math.min(...plan.entry.map((p) => p[1])),
    z1 = Math.max(...plan.entry.map((p) => p[1])),
    cz = (z0 + z1) / 2,
    w = x1 - x0,
    dep = z1 - z0;
  for (const x of [x0 + 0.5, x1 - 0.5]) B(out, 'trim', x, 0.55, cz, 0.95, 8.25, dep, pale);
  for (const x of [cx - 2.05, cx + 2.05]) {
    B(out, 'trim', x, 0.55, z0 + 0.32, 0.6, 8.15, 0.6, pale);
    if (d > 0) {
      B(out, 'trim', x, 0.55, z0 + 0.32, 0.82, 0.32, 0.82, pale);
      B(out, 'trim', x, 8.42, z0 + 0.32, 0.82, 0.3, 0.82, pale);
    }
  }
  B(out, 'trim', cx, 8.7, cz, w + 0.35, 0.5, dep + 0.3, pale);
  B(out, 'trim', cx, 9.2, cz, w, 3.9, dep, pale);
  B(out, 'trim', cx, 12.88, cz, w + 0.35, 0.3, dep + 0.3, pale);
  if (d > 0) {
    const ring = Array.from({ length: d === 1 ? 12 : 24 }, (_, i) => [
      cx + Math.cos((i * Math.PI * 2) / (d === 1 ? 12 : 24)) * 0.55,
      11.3 + Math.sin((i * Math.PI * 2) / (d === 1 ? 12 : 24)) * 0.55,
      z0 - 0.025,
    ]).reverse();
    out.addConvexPolygon('glass', ref, ring, [0, 0, -1], (p) => [p[0], p[1]], door);
    for (let i = 0; i < 3; i++) {
      const dd = 1.8 - i * 0.5;
      B(out, 'trim', cx, i * 0.17, z0 - dd / 2, 5.7, 0.17, dd, base);
    }
    if (d > 1)
      for (const x of [cx - 2.95, cx + 2.95])
        beam(out, 'trim', [x, 0.15, z0 - 1.65], [x, 0.7, z0 - 0.2], 0.07, 0.07, pale);
  }
}
export const tehranEmbassySkyline = (out, frame) => build(out, frame, 0);
export const tehranEmbassyDistrict = (out, frame) => build(out, frame, 1);
export const tehranEmbassyStreet = (out, frame) => build(out, frame, 2);
export const tehranEmbassyModel = {
  id: 'tehran_former_us_embassy',
  key: 'tehran_former_us_embassy',
  recipe: 'structure-tehran-former-us-embassy.mjs',
  cell: 'tn/tnk',
  title: 'Former United States Embassy, Tehran',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving long two-storey brick main1951chancery on its native plan, shallow grey hipped roof, recessed pale-framed sash rhythm, raised tall pale columned entrance portico with square attic and simplified round medallion, bounded entrance treads. Main building only; detached campus buildings, gardens/stadium, perimeter mural walls and interiors excluded.',
  camera: [83, 47, -100],
  lookAt: [0, 5.5, 0],
  portableGroundY: 0,
  mediumFiContext: { scale: 1.0 },
  qaCameras: [
    { name: 'north-portico-and-sashes', position: [23, 11, -34], lookAt: [-1, 6, -7] },
    { name: 'rear-and-hip-roof', position: [45, 24, 48], lookAt: [0, 6, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native surviving main chancery plan and northern entrance projection fix center and heading. Open front-ground reference17m north of center is outside physical stair/portico. Source urban DEM unchanged; exact restored paving/ground contact remains approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tehran-former-us-embassy.mjs',
    level: 'skyline',
    export: 'tehranEmbassySkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'tehranEmbassyDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'tehranEmbassyStreet', errorMeters: 0.09, surfaces },
    },
  },
  limitations: [
    'Native mapped surviving main building controls approximately75m length/17m depth and northern portico projection. About8.8m eaves,11.3m ridge and13.1m entry attic are photographic estimates, not a building survey.',
    'Only the already cleared published1950spublic-domain aerial is used. It is distant and black-and-white; brick/roof colors, exact window counts/panes, rear openings and restored current details are medium-fi interpretations. Round entry emblem is a simplified disc, not a copied photograph or detailed seal.',
    'Main original chancery only. The old aerial is not authority to reconstruct every historical campus structure; detached structures, grounds, perimeter propaganda/mural walls, flags and interiors excluded. Surviving main-building model is not a functioning diplomatic mission.',
    'Flat inspection floor isolates architecture. Original urban source terrain is preserved as placement evidence; exact paving/foundation and cross-provider height contact are not certified. No photographic pixels embedded.',
  ],
};
