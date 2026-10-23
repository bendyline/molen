/** Whole Gawhar Shad mausoleum: recessed cube, panelled drum and fluted bulb dome. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tq/tqh/gawhar_shad_mausoleum/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  c = Math.cos(A.workingHeading),
  s = Math.sin(A.workingHeading),
  world = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  local = (q) => [c * q[0] + s * q[1], -s * q[0] + c * q[1]],
  P = p.outline.slice(0, -1).map(local),
  C = {
    wall: rgb('bdad86'),
    brick: rgb('ac9671'),
    tile: rgb('64867d'),
    glass: rgb('4f574f'),
    metal: rgb('6d7161'),
    wood: rgb('716451'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.98, metallic: 0 },
    brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.98, metallic: 0 },
    tile: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.77, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffd', roughness: 0.72, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.05 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.96, metallic: 0 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]),
  dot = (a, b) => a.reduce((t, v, k) => t + v * b[k], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = world(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, y, up = true, col = C[k]) {
  const ids = earcut(R.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [R[j][0], y, R[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, k, R, y0, y1, col = C[k]) {
  const center = R.reduce((a, q) => a.map((v, i) => v + q[i] / R.length), [0, 0]);
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    if (dot(n, [(a[0] + b[0]) / 2 - center[0], 0, (a[1] + b[1]) / 2 - center[1]]) < 0)
      n.forEach((v, i) => {
        n[i] = -v;
      });
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
      col,
    );
  }
  flat(o, k, R, y1, true, col);
  flat(o, k, R, y0, false, col);
}
const faces = P.map((a, i) => {
  const b = P[(i + 1) % 4],
    v = sub(b, a),
    w = Math.hypot(...v),
    u = v.map((x) => x / w),
    mid = a.map((x, j) => (x + b[j]) / 2),
    n = [u[1], 0, -u[0]];
  if (dot(n, [mid[0], 0, mid[1]]) < 0)
    n.forEach((v, i) => {
      n[i] = -v;
    });
  return {
    w,
    u,
    n,
    mid,
    point: (x, y, dep = 0) => [mid[0] + u[0] * x + n[0] * dep, y, mid[1] + u[1] * x + n[2] * dep],
  };
});
function patch(o, k, f, a, b, lo, hi, dep = 0, col = C[k]) {
  Q(
    o,
    k,
    [
      f.point(a, typeof lo === 'function' ? lo(a) : lo, dep),
      f.point(b, typeof lo === 'function' ? lo(b) : lo, dep),
      f.point(b, typeof hi === 'function' ? hi(b) : hi, dep),
      f.point(a, typeof hi === 'function' ? hi(a) : hi, dep),
    ],
    f.n,
    col,
  );
}
function strip(o, k, f, a, b, y0, y1, inside, out, col = C[k]) {
  prism(
    o,
    k,
    [f.point(a, 0, inside), f.point(b, 0, inside), f.point(b, 0, out), f.point(a, 0, out)].map(
      (q) => [q[0], q[2]],
    ),
    y0,
    y1,
    col,
  );
}
const arch = (h, x) =>
  h.spring + (h.tip - h.spring) * Math.sqrt(Math.max(0, 1 - Math.abs((x - h.x) / (h.w / 2))));
function holes(f, i, d) {
  const h = [];
  if (i === 0 || i === 2 || i === 1)
    h.push({
      x: 0,
      w: A.windowWidth,
      lo: F + A.windowBottom,
      spring: F + A.windowSpring,
      tip: F + A.windowTip,
      depth: A.windowRevealDepth,
      slot: 'glass',
      kind: 'window',
    });
  if (i === 0)
    h.push({
      x: f.w / 2 - 1.9,
      w: A.doorWidth,
      lo: F,
      spring: F + A.doorHeight,
      tip: F + A.doorHeight,
      depth: 0.36,
      slot: 'wood',
      kind: 'door',
    });
  if (i === 3)
    h.push({
      x: -f.w * 0.32,
      w: 0.8,
      lo: F,
      spring: F + 2.1,
      tip: F + 2.1,
      depth: 0.3,
      slot: 'wood',
      kind: 'door',
    });
  if (i === 2)
    h.push({
      x: -f.w * 0.26,
      w: 1.3,
      lo: F,
      spring: F + 2.7,
      tip: F + 3.5,
      depth: 0.35,
      slot: 'wood',
      kind: 'door',
    });
  if (d > 0)
    for (const sg of [-1, 1])
      if (
        !h.some(
          (v) => v.kind === 'door' && Math.abs(v.x - sg * f.w * 0.37) < (v.w + f.w * 0.12) / 2,
        )
      )
        h.push({
          x: sg * f.w * 0.37,
          w: f.w * 0.12,
          lo: F + 0.7,
          spring: F + 5.9,
          tip: F + 7.05,
          depth: A.nicheDepth,
          slot: 'wall',
          kind: 'blind',
        });
  return h;
}
function walls(o, d) {
  for (const [fidx, f] of faces.entries()) {
    const H = F + A.bodyTop,
      hs = holes(f, fidx, d),
      N = [4, 6, 10, 16][d],
      xs = [-f.w / 2, f.w / 2];
    for (const h of hs) for (let j = 0; j <= N; j++) xs.push(h.x - h.w / 2 + (h.w * j) / N);
    xs.sort((a, b) => a - b);
    const x = [...new Set(xs)];
    for (let j = 0; j < x.length - 1; j++) {
      const a = x[j],
        b = x[j + 1],
        h = hs.find(
          (h) => (a + b) / 2 > h.x - h.w / 2 - 1e-6 && (a + b) / 2 < h.x + h.w / 2 + 1e-6,
        );
      if (!h) patch(o, 'wall', f, a, b, F, H);
      else {
        patch(o, 'wall', f, a, b, F, h.lo);
        patch(o, 'wall', f, a, b, (q) => arch(h, q), H);
        patch(
          o,
          h.slot,
          f,
          a,
          b,
          h.lo,
          (q) => arch(h, q),
          -h.depth,
          h.kind === 'blind' ? rgb('b3a27d') : C[h.slot],
        );
        const topA = arch(h, a),
          topB = arch(h, b);
        Q(
          o,
          'brick',
          [
            f.point(a, topA, 0),
            f.point(b, topB, 0),
            f.point(b, topB, -h.depth),
            f.point(a, topA, -h.depth),
          ],
          [0, -1, 0],
        );
        Q(
          o,
          'brick',
          [
            f.point(a, h.lo, 0),
            f.point(a, h.lo, -h.depth),
            f.point(b, h.lo, -h.depth),
            f.point(b, h.lo, 0),
          ],
          [0, 1, 0],
        );
      }
    }
    for (const h of hs) {
      for (const sg of [-1, 1]) {
        const x = h.x + (sg * h.w) / 2;
        Q(
          o,
          'brick',
          [
            f.point(x, h.lo, 0),
            f.point(x, h.lo, -h.depth),
            f.point(x, arch(h, x), -h.depth),
            f.point(x, arch(h, x), 0),
          ],
          [-sg * f.u[0], 0, -sg * f.u[1]],
        );
      }
      if (h.kind === 'window') {
        if (d > 0)
          for (let j = 1; j <= [2, 3, 5, 7][d]; j++) {
            const xx = h.x - h.w / 2 + (h.w * j) / ([2, 3, 5, 7][d] + 1),
              top = arch(h, xx);
            strip(o, 'metal', f, xx - 0.025, xx + 0.025, h.lo, top - 0.06, -0.18, -0.1);
          }
        for (const y of d === 0
          ? []
          : Array.from(
              { length: d === 3 ? 6 : 4 },
              (_, j) => h.lo + 0.4 + (j * (h.spring - h.lo - 0.55)) / (d === 3 ? 5 : 3),
            ))
          strip(
            o,
            'metal',
            f,
            h.x - h.w / 2 + 0.06,
            h.x + h.w / 2 - 0.06,
            y,
            y + 0.045,
            -0.18,
            -0.1,
          );
        if (d > 1) {
          const edges = Array.from({ length: N + 1 }, (_, j) => h.x - h.w / 2 + (h.w * j) / N);
          for (let j = 0; j < N; j++) {
            const a = edges[j],
              b = edges[j + 1];
            Q(
              o,
              'brick',
              [
                f.point(a, arch(h, a) + 0.11, 0.03),
                f.point(b, arch(h, b) + 0.11, 0.03),
                f.point(b, arch(h, b) + 0.24, 0.03),
                f.point(a, arch(h, a) + 0.24, 0.03),
              ],
              f.n,
              rgb('a28b64'),
            );
          }
        }
      }
    }
    for (const sg of [-1, 1])
      strip(
        o,
        'wall',
        f,
        (sg * f.w) / 2 - 0.16,
        (sg * f.w) / 2 + 0.16,
        F,
        H,
        -0.03,
        0.17,
        rgb('bbaa80'),
      );
    let plinthStart = -f.w / 2;
    for (const door of hs.filter((h) => h.kind === 'door').sort((a, b) => a.x - b.x)) {
      strip(o, 'brick', f, plinthStart, door.x - door.w / 2, F, F + A.plinthHeight, -0.08, 0.045);
      plinthStart = door.x + door.w / 2;
    }
    strip(o, 'brick', f, plinthStart, f.w / 2, F, F + A.plinthHeight, -0.08, 0.045);
    strip(
      o,
      'brick',
      f,
      -f.w / 2 - 0.04,
      f.w / 2 + 0.04,
      H - 0.12,
      H + 0.14,
      -0.1,
      0.18,
      rgb('c2b18a'),
    );
    if (d > 0) strip(o, 'wall', f, -f.w / 2, f.w / 2, F + 8.95, F + 9.08, -0.03, 0.045);
  }
  prism(o, 'brick', P, F + A.bodyTop - 0.16, F + A.bodyTop + 0.06);
  for (const f of faces)
    strip(
      o,
      'brick',
      f,
      -f.w / 2,
      f.w / 2,
      F + A.bodyTop,
      F + A.bodyTop + A.parapetHeight,
      -A.parapetThickness,
      0.02,
    );
}
function drum(o, d) {
  const N = [24, 48, 96, 144][d],
    r = A.drumRadius,
    lo = F + A.drumBottom,
    hi = F + A.drumTop,
    step = (2 * Math.PI) / N,
    at = (t, y, off = 0) => [(r + off) * Math.cos(t), y, (r + off) * Math.sin(t)],
    theta = Math.PI / 2,
    half = A.drumApertureWidth / (2 * r),
    ts = Array.from({ length: N }, (_, i) => i * step)
      .concat([theta - half, theta + half])
      .sort((a, b) => a - b),
    a = F + A.drumApertureBottom,
    b = F + A.drumApertureTop;
  for (let i = 0; i < ts.length; i++) {
    const t0 = ts[i],
      t1 = ts[(i + 1) % ts.length] + (i === ts.length - 1 ? 2 * Math.PI : 0),
      n = [Math.cos((t0 + t1) / 2), 0, Math.sin((t0 + t1) / 2)],
      hole = (t0 + t1) / 2 > theta - half - 1e-5 && (t0 + t1) / 2 < theta + half + 1e-5;
    for (const [y0, y1] of hole
      ? [
          [lo, a],
          [b, hi],
        ]
      : [[lo, hi]])
      Q(o, 'brick', [at(t0, y0), at(t1, y0), at(t1, y1), at(t0, y1)], n, rgb('b19c76'));
    if (hole) {
      Q(o, 'glass', [at(t0, a, -0.35), at(t1, a, -0.35), at(t1, b, -0.35), at(t0, b, -0.35)], n);
      Q(o, 'brick', [at(t0, a), at(t0, a, -0.35), at(t1, a, -0.35), at(t1, a)], [0, 1, 0]);
      Q(o, 'brick', [at(t0, b), at(t1, b), at(t1, b, -0.35), at(t0, b, -0.35)], [0, -1, 0]);
    }
    for (const [y0, y1, off] of [
      [lo, lo + 0.2, 0.13],
      [hi - 0.3, hi, 0.15],
    ])
      Q(
        o,
        'brick',
        [at(t0, y0, off), at(t1, y0, off), at(t1, y1, off), at(t0, y1, off)],
        n,
        rgb('bea981'),
      );
  }
  for (const sg of [-1, 1]) {
    const t = theta + sg * half,
      n = [-sg, 0, 0];
    Q(o, 'brick', [at(t, a), at(t, a, -0.35), at(t, b, -0.35), at(t, b)], n);
  }
  if (d > 0) {
    const bands = d === 1 ? 12 : 24;
    for (let i = 0; i < bands; i++) {
      const t = (2 * Math.PI * i) / bands,
        delta = 0.035;
      if (Math.abs(Math.atan2(Math.sin(t - theta), Math.cos(t - theta))) < half + delta) continue;
      Q(
        o,
        'brick',
        [
          at(t - delta, lo + 0.4, 0.06),
          at(t + delta, lo + 0.4, 0.06),
          at(t + delta, hi - 0.6, 0.06),
          at(t - delta, hi - 0.6, 0.06),
        ],
        [Math.cos(t), 0, Math.sin(t)],
        rgb('a9946e'),
      );
    }
  }
}
const profile = [
    [0, 0.93],
    [0.09, 1],
    [0.25, 0.98],
    [0.43, 0.89],
    [0.6, 0.73],
    [0.76, 0.51],
    [0.9, 0.27],
    [1, 0],
  ],
  baseR = (t) => {
    let i = 0;
    while (i < profile.length - 2 && t > profile[i + 1][0]) i++;
    const [a, b] = profile[i],
      v = profile[i + 1];
    return A.domeRadius * (b + ((v[1] - b) * (t - a)) / (v[0] - a));
  };
function dome(o, d) {
  const N = [24, 96, 192, 288][d],
    M = [5, 9, 14, 22][d],
    flutes = d === 0 ? 12 : A.flutes,
    pt = (t, v) => {
      const theta = 2 * Math.PI * v,
        relief =
          t === 1
            ? 0
            : A.fluteDepth *
              (0.55 + 0.45 * Math.sin(Math.PI * t)) *
              Math.pow(1 - t, 0.3) *
              (0.5 + 0.5 * Math.cos(flutes * theta)),
        r = baseR(t) + relief;
      return [r * Math.cos(theta), F + A.drumTop + t * A.domeHeight, r * Math.sin(theta)];
    };
  for (let i = 0; i < N; i++) {
    const a = i / N,
      b = (i + 1) / N,
      inner = (v) => [
        A.drumRadius * Math.cos(2 * Math.PI * v),
        F + A.drumTop,
        A.drumRadius * Math.sin(2 * Math.PI * v),
      ];
    Q(o, 'brick', [pt(0, a), pt(0, b), inner(b), inner(a)], [0, -1, 0]);
  }
  for (let j = 0; j < M; j++) {
    const t0 = j / M,
      t1 = (j + 1) / M;
    for (let i = 0; i < N; i++) {
      const v0 = i / N,
        v1 = (i + 1) / N,
        theta = (2 * Math.PI * (v0 + v1)) / 2,
        n = [Math.cos(theta), 0.25, Math.sin(theta)],
        tile = t0 < 0.23 && Math.floor((v0 + v1) * flutes) % 5 !== 0,
        k = tile ? 'tile' : 'brick',
        col = tile ? (i % 3 === 0 ? rgb('728c7e') : C.tile) : rgb('ae9974');
      if (j === M - 1)
        T(o, k, [pt(t0, v0), pt(t0, v1), pt(1, v1)], [Math.cos(theta), 1, Math.sin(theta)], col);
      else Q(o, k, [pt(t0, v0), pt(t0, v1), pt(t1, v1), pt(t1, v0)], n, col);
    }
  }
  if (d > 1) {
    const count = A.flutes;
    for (let i = 0; i < count; i++) {
      if (i % 5 === 0) continue;
      const v = (i + 0.5) / count,
        t = 0.13,
        q = pt(t, v),
        n = [Math.cos(2 * Math.PI * v), 0, Math.sin(2 * Math.PI * v)],
        u = [-n[2], 0, n[0]],
        w = 0.18,
        h = 0.35;
      Q(
        o,
        'tile',
        [
          q.map((x, k) => x + n[k] * 0.014 - u[k] * w),
          q.map((x, k) => x + n[k] * 0.014 + (k === 1 ? h : 0)),
          q.map((x, k) => x + n[k] * 0.014 + u[k] * w),
          q.map((x, k) => x + n[k] * 0.014 - (k === 1 ? h : 0)),
        ],
        n,
        rgb('9dafa0'),
      );
    }
  }
}
function build(o, _f, d = 3) {
  walls(o, d);
  drum(o, d);
  dome(o, d);
}
export const gawharSkyline = (o, f) => build(o, f, 0),
  gawharDistrict = (o, f) => build(o, f, 1),
  gawharStreet = (o, f) => build(o, f, 2),
  gawharCloseup = (o, f) => build(o, f, 3);
const camera = (name, position, lookAt) => ({
  name,
  position: world(position),
  lookAt: world(lookAt),
});
export const gawharShadMausoleumModel = {
  id: 'gawhar_shad_mausoleum',
  key: 'gawhar_shad_mausoleum',
  cell: 'tq/tqh',
  recipe: 'structure-gawhar-shad-mausoleum.mjs',
  title: 'Gawhar Shad Mausoleum',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([-38, 24, 56]),
  lookAt: world([0, 12, 0]),
  portableGroundY: -0.05,
  mediumFiContext: { scale: 0.8, groundY: -0.05 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-mausoleum-native-cube-drum-fluted-bulb-dome', [-38, 24, 56], [0, 12, 0]),
    camera('opposite-whole-tomb-hidden-faces-bounded-estimates', [38, 21, -46], [0, 12, 0]),
    camera('south-pointed-window-grille-deep-reveal-and-low-door', [2, 7, 27], [0, 6, 11.9]),
    camera('west-pointed-blind-niches-corner-pilasters', [-27, 7, 15], [-10, 5, 0]),
    camera('drum-small-square-aperture-and-panel-rhythm', [6, 18, 22], [0, 15, 0]),
    camera(
      'fluted-bulb-dome-original-neutral-turquoise-fragment-rhythm',
      [-14, 25, 20],
      [0, 21, 0],
    ),
    camera('roof-ledge-open-parapet-and-whole-native-body', [28, 39, 28], [0, 10, 0]),
    camera('low-entry-door-and-uninterrupted-plinth-gaps', [9, 3.5, 23], [8.5, 1.3, 11.9]),
    camera('whole-four-corner-footprint-and-roof-drum-domain', [0, 66, 0.01], [0, 0, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-gawhar-shad-mausoleum.mjs',
    level: 'skyline',
    export: 'gawharSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'gawharDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'gawharStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'gawharCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole surviving mausoleum/actual four-corner buildingway743807289/Q85762853; nativepersonQ464986 is not building identity. Full chamber shell/pointed window-door and blind niches/pilasters/plinth/roof/parapet, tall panelled cylindrical drum/small square aperture and full fluted bulb dome. Separate small tomb/minarets/widerMusalla/graves/site/landscape/interior burial rooms excluded.',
    'Qualla-first16families/0conflicts yielded unclear historic/art or unrelated US-government sources, all unused. Supplemental exact2435x1630 bluuurgh2001-07-15 Own/PD-self PNG/nativeSHA1matched/terminal exact rights record individually inspected. No protected UNESCO/gallery/plan pixels; conservation text only. No inscriptions/pictorial art/photo texture/borrowed mesh/generated bitmap or policy/verifier/source-body changes.',
    'Clear exterior documents2001 tan body/drum/partly exposed fluted dome with turquoise lower fragments; later UNESCO tile conservation/reproduction means exact current coverage/finish/opening census unsurveyed. This is an original weathered architectural preview, not a verified current restoration color survey. Independent body11m/drum11.25..17.2/radius6.85/dome+10.2/radius7.45/48ribs and opposite face/door-window placement/reliefs/grille/roof/section details bounded medium-fi estimates. Abstract original muted geometric fragments only.',
    'Independent400m/129x129/16641 heights/one raw tile/PNG frozen before geometry/floor/drum/dome unchanged. Source urban relief not a historical or construction survey and may contain canopy/building artifacts; precise source/host tomb footing/threshold contact unresolved/replacementfalse. Flat appearance views separate; no source flattening/fitting/reacquisition or whole-site pad.',
  ],
};
