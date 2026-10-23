/** Whole native Khufu pyramid: weathered limestone courses and truncated summit. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/st/stq/great_pyramid_of_giza/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  P = p.outline.slice(0, -1),
  C = { stone: rgb('b9ad90'), dark: rgb('4c4c40'), wood: rgb('8a8270') },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
    dark: { slot: 'window', localRef: 'palette:#fffffd', roughness: 1, metallic: 0 },
    wood: { slot: 'trim', graph: 'wood_plain', roughness: 1, metallic: 0 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]),
  dot = (a, b) => a.reduce((t, v, k) => t + v * b[k], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
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
  const ix = earcut(R.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      k,
      ix.slice(i, i + 3).map((j) => [R[j][0], y, R[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function beam(o, k, a, b, width, col = C[k]) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((x) => x / L),
    r = Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    n = cross(u, r),
    nl = Math.hypot(...n),
    e = n.map((x) => ((x / nl) * width) / 2),
    g = cross(u, e),
    c = [];
  for (const q of [a, b])
    for (const [s, t] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      c.push(q.map((v, i) => v + s * e[i] + t * g[i]));
  for (let j = 0; j < 4; j++) {
    const next = (j + 1) % 4;
    Q(o, k, [c[j], c[next], c[4 + next], c[4 + j]], cross(sub(c[next], c[j]), v), col);
  }
  Q(
    o,
    k,
    [c[0], c[3], c[2], c[1]],
    u.map((v) => -v),
    col,
  );
  Q(o, k, c.slice(4), u, col);
}
const edge = (a, b) => {
    const u = sub(b, a),
      w = Math.hypot(...u),
      n = [u[1] / w, 0, -u[0] / w];
    return { a, b, w, n };
  },
  edges = P.map((a, i) => edge(a, P[(i + 1) % P.length])),
  scale = (y) => 1 - ((1 - A.summitScale) * (y - F)) / A.survivingHeight,
  at = (e, t, y, k = scale(y), depth = 0) => [
    (e.a[0] + (e.b[0] - e.a[0]) * t) * k - e.n[0] * depth,
    y,
    (e.a[1] + (e.b[1] - e.a[1]) * t) * k - e.n[2] * depth,
  ],
  entry = (x, w, y, h) => ({
    t: (x - P[4][0]) / (P[0][0] - P[4][0]),
    half: w / (2 * edges[4].w),
    lo: F + y,
    hi: F + y + h,
  }),
  holes = [
    entry(
      A.northOriginalEntryCenter,
      A.originalEntryWidth,
      A.northOriginalEntryFloor,
      A.originalEntryHeight,
    ),
    entry(
      A.northRobberEntryCenter,
      A.robberEntryWidth,
      A.northRobberEntryFloor,
      A.robberEntryHeight,
    ),
  ];
function mass(o, d) {
  const M = A.courseCounts[d],
    H = A.survivingHeight;
  for (let row = 0; row < M; row++) {
    const y0 = F + (H * row) / M,
      y1 = F + (H * (row + 1)) / M,
      k0 = scale(y0),
      k1 = scale(y1);
    for (const [i, e] of edges.entries()) {
      const N = Math.max(1, Math.ceil((e.w * k0) / A.stonePanelMeters[d])),
        hs = i === 4 ? holes.filter((h) => h.lo <= y1 && h.hi >= y0) : [],
        ts = Array.from({ length: N + 1 }, (_, j) => j / N);
      for (const h of hs) ts.push(h.t - h.half, h.t + h.half);
      ts.sort((a, b) => a - b);
      const xx = [...new Set(ts)].filter((t) => t >= 0 && t <= 1),
        ys = [y0, y1];
      for (const h of hs) for (const y of [h.lo, h.hi]) if (y > y0 && y < y1) ys.push(y);
      ys.sort((a, b) => a - b);
      for (let j = 0; j < xx.length - 1; j++) {
        const a = xx[j],
          b = xx[j + 1],
          mid = (a + b) / 2,
          hash = ((row * 73856093) ^ (i * 19349663) ^ (j * 83492791)) >>> 0,
          c = rgb(['b6aa8c', 'bdb094', 'b7ac91', 'b2a78d', 'c0b398', 'b9af95', 'b4aa90'][hash % 7]);
        for (let k = 0; k < ys.length - 1; k++) {
          const lo = ys[k],
            hi = ys[k + 1],
            h = hs.find(
              (h) =>
                mid > h.t - h.half + 1e-8 &&
                mid < h.t + h.half - 1e-8 &&
                (lo + hi) / 2 > h.lo &&
                (lo + hi) / 2 < h.hi,
            );
          if (h)
            Q(
              o,
              'dark',
              [
                at(e, a, lo, k0, A.revealDepth),
                at(e, b, lo, k0, A.revealDepth),
                at(e, b, hi, k0, A.revealDepth),
                at(e, a, hi, k0, A.revealDepth),
              ],
              e.n,
            );
          else
            Q(
              o,
              'stone',
              [at(e, a, lo, k0), at(e, b, lo, k0), at(e, b, hi, k0), at(e, a, hi, k0)],
              e.n,
              c,
            );
        }
        // Real horizontal treads between courses, interrupted through the two north rebates.
        if (
          !hs.some(
            (h) => mid > h.t - h.half + 1e-8 && mid < h.t + h.half - 1e-8 && y1 > h.lo && y1 < h.hi,
          )
        )
          Q(
            o,
            'stone',
            [at(e, a, y1, k0), at(e, b, y1, k0), at(e, b, y1, k1), at(e, a, y1, k1)],
            [0, 1, 0],
            c,
          );
        else
          Q(
            o,
            'dark',
            [
              at(e, a, y1, k0, A.revealDepth),
              at(e, b, y1, k0, A.revealDepth),
              at(e, b, y1, k1, A.revealDepth),
              at(e, a, y1, k1, A.revealDepth),
            ],
            [0, 1, 0],
          );
      }
      for (const h of hs) {
        const lo = Math.max(y0, h.lo),
          hi = Math.min(y1, h.hi);
        if (hi <= lo) continue;
        for (const sg of [-1, 1]) {
          const t = h.t + sg * h.half;
          Q(
            o,
            'stone',
            [
              at(e, t, lo, k0),
              at(e, t, lo, k0, A.revealDepth),
              at(e, t, hi, k0, A.revealDepth),
              at(e, t, hi, k0),
            ],
            [-sg * (e.b[0] - e.a[0]), 0, -sg * (e.b[1] - e.a[1])],
            rgb('b4a98e'),
          );
        }
      }
    }
  }
  flat(o, 'stone', P, F, false);
  flat(
    o,
    'stone',
    P.map((v) => v.map((x) => x * A.summitScale)),
    F + H,
  );
  for (const h of holes)
    for (const [y, up] of [
      [h.lo, true],
      [h.hi, false],
    ]) {
      const e = edges[4],
        row = Math.min(M - 1, Math.floor(((y - F) / H) * M)),
        k = scale(F + (H * row) / M);
      Q(
        o,
        'stone',
        [
          at(e, h.t - h.half, y, k),
          at(e, h.t + h.half, y, k),
          at(e, h.t + h.half, y, k, A.revealDepth),
          at(e, h.t - h.half, y, k, A.revealDepth),
        ],
        [0, up ? 1 : -1, 0],
      );
    }
}
function entryChevrons(o, d) {
  if (d === 0) return;
  const e = edges[4],
    h = holes[0],
    w = 4.8;
  for (let j = 0; j < 2; j++) {
    const y = h.hi + 0.45 + j * 1.45,
      k = scale(y),
      center = at(e, h.t, y, k, -0.32),
      apex = [center[0], y + 2.0, center[2] + 1.35];
    for (const sg of [-1, 1]) {
      const end = [center[0] + (sg * w) / 2, y, center[2]];
      beam(o, 'stone', end, apex, 0.48, rgb('c6bba0'));
    }
  }
}
function mast(o, d) {
  if (d < 2) return;
  const y = F + A.survivingHeight;
  beam(o, 'wood', [0, y, 0], [0, y + 4.2, 0], 0.16);
  if (d === 3) for (const sg of [-1, 1]) beam(o, 'wood', [sg * 1.5, y, 0.7], [0, y + 3.5, 0], 0.06);
}
function build(o, _frame, d = 3) {
  mass(o, d);
  entryChevrons(o, d);
  mast(o, d);
}
export const gizaSkyline = (o, f) => build(o, f, 0),
  gizaDistrict = (o, f) => build(o, f, 1),
  gizaStreet = (o, f) => build(o, f, 2),
  gizaCloseup = (o, f) => build(o, f, 3);
const camera = (name, position, lookAt) => ({ name, position, lookAt });
export const greatPyramidModel = {
  id: 'great_pyramid_of_giza',
  key: 'great_pyramid_of_giza',
  cell: 'st/stq',
  recipe: 'structure-great-pyramid-of-giza.mjs',
  title: 'Great Pyramid of Giza',
  category: 'archaeological',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [350, 215, 390],
  lookAt: [0, 58, 0],
  portableGroundY: -0.05,
  mediumFiContext: { scale: 5, groundY: -0.05 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-surviving-weathered-limestone-pyramid', [350, 215, 390], [0, 58, 0]),
    camera('whole-north-native-faces-and-bounded-entry-details', [250, 180, -360], [0, 55, 0]),
    camera('exposed-core-stepped-courses-and-original-block-rhythm', [135, 25, 170], [75, 16, 81]),
    camera('north-entrance-rebates-and-chevron-estimates', [10, 24, -145], [7, 18, -96]),
    camera('truncated-summit-and-estimated-small-survey-mast', [26, 165, 35], [0, 137, 0]),
    camera('whole-five-native-base-controls-and-course-domain', [0, 510, 0.01], [0, 0, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-great-pyramid-of-giza.mjs',
    level: 'skyline',
    export: 'gizaSkyline',
    errorMeters: 3.0,
    surfaces,
    authoredLevels: {
      district: { export: 'gizaDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'gizaStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'gizaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole surviving Khufu pyramidway4420397/Q37200/allfive native basecontrols. Complete weathered core faces/real stepped course treads/small truncated summit and bounded two north entryrebates/chevron estimates. Neighboring Khafre/Menkaure/queens pyramids/temples/Sphinx/wholeGiza site/ground slab/private interiors excluded; no hypothetical polished white casing/pyramidion.',
    'One exact1656x1242 Qualla DanielCsörföly2007-02 Own/PD-self photograph/nativeSHA1matched/clear namedcreator allrightsreleased nativegrant individually inspected after51familyQuallasearch/0conflicts. No supplementalimages needed, unrelatedCC0 masonrydiagram/museumfragment/interiors/portraits skippedwithoutpixels. No protected plan/photo pixels/borrowedmesh/generatedbitmap/copied inscriptions or sourcebody/policy changes.',
    'Nativeheight138.8m retained for current mass, original bounded floor+.12/summit5.2% of base/24,60,128,203course levels/irregular original muted blockcolor rhythm. Nativebase224–229m approximates survey230.3m rather than inventing a replacement footprint. Individualstone/coursecensus/rear/currentfinish/basal casing remnants omitted or estimated. Northrebates/chevrons not seen in selected view: estimated centers+7/+5m east,height17/7m,width2.6/2m/depth1.6m. Small4.2m survey mast supported by Qualla story text, precise fixture/braces unsurveyed.',
    'Independent1000m129x12916641-value field/fourrawtiles/PNG frozen before floor/course/summit geometry unchanged. Source contains pyramid/building/plateau relief and is not archaeological foundation survey; exact source/host contact unresolved/replacementfalse. Flat appearance separate; no terrain fitting/flattening/reacquisition or whole-sitepad.',
  ],
};
