/** Whole curved spillway, forebay wall and intrinsic north intake/powerhouse. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, architecturalSections: A } = p.parameters;
const C = {
  wall: rgb('acaea5'),
  foundation: rgb('939b91'),
  gate: rgb('384648'),
  rail: rgb('949c96'),
  board: rgb('303b3a'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  gate: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.35 },
  rail: { slot: 'trim', graph: 'metal_stainless', roughness: 0.6, metallic: 0.7 },
  board: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
};
export const toWorld = (q) => [q[0], F + q[1], q[2]],
  direction = (q) => q,
  native = frame.features[0].outline.slice(0, -1),
  partEvidence = [],
  nativeEvidence = [],
  gateEvidence = [],
  openingEvidence = [],
  sectionEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, holes = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) > 1e-6) beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, { top = true, bottom = false, col = C[k] } = {}) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      col,
    );
  }
  if (top) cap(o, k, r, Y, true, col);
  if (bottom) cap(o, k, r, y, false, col);
}
const path = p.nativeIdentity.upstreamBoundaryIndices.map((i) => native[i]),
  distances = [0];
for (let i = 1; i < path.length; i++)
  distances.push(distances.at(-1) + Math.hypot(...sub(path[i], path[i - 1])));
export const pathLength = distances.at(-1);
export function station(s) {
  s = Math.max(0, Math.min(pathLength, s));
  let i = 0;
  while (i < path.length - 2 && distances[i + 1] < s) i++;
  const a = path[i],
    b = path[i + 1],
    L = distances[i + 1] - distances[i],
    u = sub(b, a).map((v) => v / L),
    n = [-u[1], u[0]],
    t = (s - distances[i]) / L;
  return { q: a.map((v, k) => v + (b[k] - v) * t), u, n };
}
export function point(s, d, y) {
  const f = station(s);
  return [f.q[0] - f.n[0] * d, y, f.q[1] - f.n[1] * d];
}
export function width(s) {
  const f = station(Math.max(0.01, Math.min(pathLength - 0.01, s))),
    v = f.n.map((x) => -x),
    hits = [],
    cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < native.length; i++) {
    const a = native[i],
      b = native[(i + 1) % native.length],
      e = sub(b, a),
      den = cross2(v, e);
    if (Math.abs(den) < 1e-8) continue;
    const aq = sub(a, f.q),
      t = cross2(aq, e) / den,
      u = cross2(aq, v) / den;
    if (t > 0.02 && u >= -1e-7 && u <= 1 + 1e-7) hits.push(t);
  }
  return hits.length ? Math.min(...hits) : 7;
}
export const spillwayStart = A.wastegateRun,
  spillwayEnd = pathLength - 4,
  spillwayLength = spillwayEnd - spillwayStart;
const deckD = 0.25,
  smooth = (t) => 3 * t * t - 2 * Math.pow(t, 3);
export function profile(s, t, height = A.crest) {
  const w = width(s);
  return point(s, 0.8 + (w - 0.8) * t, height * (1 - smooth(t)));
}
function apron(o) {
  solid(o, 'foundation', native, A.foundationBottom, 0);
  for (const q of native) nativeEvidence.push(toWorld([q[0], 0, q[1]]));
}
function curtain(o, lod) {
  const anchors = [...distances, spillwayStart, spillwayEnd].sort((a, b) => a - b),
    ss = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i],
      b = anchors[i + 1],
      N = Math.max(1, Math.ceil((b - a) / [10000, 12, 4, 1.5][lod]));
    for (let j = 0; j < N; j++) ss.push(a + ((b - a) * j) / N);
  }
  ss.push(pathLength);
  for (let i = 0; i < ss.length - 1; i++) {
    const a = ss[i],
      b = ss[i + 1],
      f = station((a + b) / 2),
      N = [1, 3, 7, 12][lod],
      h = (a + b) / 2 < spillwayStart ? 1 : A.crest;
    Q(
      o,
      'wall',
      [point(a, 0, 0), point(b, 0, 0), point(b, 0, h), point(a, 0, h)],
      [f.n[0], 0, f.n[1]],
    );
    Q(o, 'wall', [point(a, 0, h), point(b, 0, h), point(b, 0.8, h), point(a, 0.8, h)], [0, 1, 0]);
    for (let j = 0; j < N; j++)
      Q(
        o,
        'wall',
        [
          profile(a, j / N, h),
          profile(b, j / N, h),
          profile(b, (j + 1) / N, h),
          profile(a, (j + 1) / N, h),
        ],
        [-f.n[0], 1, -f.n[1]],
      );
    sectionEvidence.push({ a, b, profileSegments: N, toeWidth: width((a + b) / 2), crest: F + h });
  }
  for (const s of [0, pathLength]) {
    const f = station(s),
      n = [...f.u.map((v) => v * (s === 0 ? -1 : 1))];
    Q(
      o,
      'wall',
      [point(s, 0, 0), point(s, width(s), 0), point(s, 0.8, A.crest), point(s, 0, A.crest)],
      [n[0], 0, n[1]],
    );
  }
}
function panelSegment(o, k, a, b, y, Y, d, thickness = 0.15) {
  const f = station((a + b) / 2);
  Q(o, k, [point(a, d, y), point(b, d, y), point(b, d, Y), point(a, d, Y)], [f.n[0], 0, f.n[1]]);
  Q(
    o,
    k,
    [
      point(a, d + thickness, y),
      point(a, d + thickness, Y),
      point(b, d + thickness, Y),
      point(b, d + thickness, y),
    ],
    [-f.n[0], 0, -f.n[1]],
  );
  for (const [s, sign] of [
    [a, -1],
    [b, 1],
  ])
    Q(
      o,
      k,
      [point(s, d, y), point(s, d, Y), point(s, d + thickness, Y), point(s, d + thickness, y)],
      [sign * f.u[0], 0, sign * f.u[1]],
    );
  for (const [h, sign] of [
    [y, -1],
    [Y, 1],
  ])
    Q(
      o,
      k,
      [point(a, d, h), point(b, d, h), point(b, d + thickness, h), point(a, d + thickness, h)],
      [0, sign, 0],
    );
}
function thinPanel(o, k, a, b, y, Y, d, thickness = 0.15) {
  const ss = [a, ...distances.filter((s) => s > a + 1e-6 && s < b - 1e-6), b];
  for (let i = 0; i < ss.length - 1; i++) panelSegment(o, k, ss[i], ss[i + 1], y, Y, d, thickness);
}
function flashboards(o, lod) {
  const L = spillwayLength / A.flashboards;
  for (let j = 0; j < A.flashboards; j++) {
    const a = spillwayStart + j * L + 0.09,
      b = spillwayStart + (j + 1) * L - 0.09;
    thinPanel(o, 'board', a, b, A.crest, A.crest + A.flashboardHeight, 0.05);
    gateEvidence.push({
      kind: 'flashboard',
      index: j,
      center: toWorld(point((a + b) / 2, 0.05, A.crest + A.flashboardHeight / 2)),
      a,
      b,
    });
    if (lod > 1) {
      for (let k = 1; k < [0, 0, 3, 7][lod]; k++)
        B(
          o,
          'gate',
          point(a, 0.26, A.crest + (A.flashboardHeight * k) / [1, 1, 3, 7][lod]),
          point(b, 0.26, A.crest + (A.flashboardHeight * k) / [1, 1, 3, 7][lod]),
          0.06,
          0.08,
        );
      for (const s of [a + 0.25, b - 0.25])
        B(
          o,
          'gate',
          point(s, 0.26, A.crest + 0.2),
          point(s, 0.26, A.crest + A.flashboardHeight - 0.2),
          0.08,
          0.08,
        );
    }
  }
  for (let j = 0; j <= A.flashboards; j++) {
    const s = spillwayStart + j * L;
    if (lod === 0) {
      const f = station(s);
      Q(
        o,
        'gate',
        [
          point(s - 0.09, 0, A.crest - 0.15),
          point(s + 0.09, 0, A.crest - 0.15),
          point(s + 0.09, 0, A.deckY),
          point(s - 0.09, 0, A.deckY),
        ],
        [f.n[0], 0, f.n[1]],
      );
    } else {
      B(o, 'gate', point(s, 0.18, A.crest - 0.15), point(s, 0.18, A.deckY), 0.16, 0.22);
      B(o, 'gate', point(s, 0.18, A.crest + 0.05), point(s, 1.3, A.deckY - 0.3), 0.12, 0.14);
    }
  }
}
function wastegates(o, lod) {
  const L = A.wastegateRun / A.wastegateCount;
  for (let j = 0; j < A.wastegateCount; j++) {
    const a = j * L + 0.28,
      b = (j + 1) * L - 0.28;
    thinPanel(o, 'gate', a, b, 1, A.crest + A.flashboardHeight, 0.3, 0.22);
    gateEvidence.push({
      kind: 'wastegate',
      index: j,
      center: toWorld(point((a + b) / 2, 0.3, 6)),
      a,
      b,
    });
    if (lod > 0)
      for (const t of [0.25, 0.5, 0.75])
        B(o, 'rail', point(a, 0.6, 1 + 12 * t), point(b, 0.6, 1 + 12 * t), 0.09, 0.1);
  }
  for (let j = 0; j <= A.wastegateCount; j++) {
    const s = j * L;
    B(o, 'wall', point(s, 0.9, 0), point(s, 0.9, A.deckY), 0.48, 1.8);
    if (lod > 1) {
      B(o, 'gate', point(s, 0.3, A.deckY + 0.2), point(s, 0.3, A.deckY + 1.4), 0.14, 0.14);
      B(
        o,
        'gate',
        point(s - 0.4, 0.3, A.deckY + 1.4),
        point(s + 0.4, 0.3, A.deckY + 1.4),
        0.1,
        0.1,
      );
    }
  }
}
function walkway(o, lod) {
  for (let i = 0; i < distances.length - 1; i++) {
    const a = distances[i],
      b = distances[i + 1],
      f = station((a + b) / 2);
    Q(
      o,
      'gate',
      [
        point(a, deckD, A.deckY),
        point(b, deckD, A.deckY),
        point(b, deckD + A.deckWidth, A.deckY),
        point(a, deckD + A.deckWidth, A.deckY),
      ],
      [0, 1, 0],
    );
    if (lod > 0) {
      Q(
        o,
        'gate',
        [
          point(a, deckD, A.deckY - A.deckThickness),
          point(a, deckD + A.deckWidth, A.deckY - A.deckThickness),
          point(b, deckD + A.deckWidth, A.deckY - A.deckThickness),
          point(b, deckD, A.deckY - A.deckThickness),
        ],
        [0, -1, 0],
      );
      for (const d of [deckD, deckD + A.deckWidth]) {
        B(
          o,
          'rail',
          point(a, d, A.deckY + A.railHeight),
          point(b, d, A.deckY + A.railHeight),
          0.065,
          0.065,
        );
        B(o, 'rail', point(a, d, A.deckY + 0.48), point(b, d, A.deckY + 0.48), 0.04, 0.04);
      }
    } else
      Q(
        o,
        'rail',
        [
          point(a, deckD, A.deckY + 0.85),
          point(b, deckD, A.deckY + 0.85),
          point(b, deckD, A.deckY + 1.05),
          point(a, deckD, A.deckY + 1.05),
        ],
        [f.n[0], 0, f.n[1]],
      );
  }
  if (lod > 0) {
    const N = Math.ceil(pathLength / [1, 10, 5, 3][lod]);
    for (let j = 0; j <= N; j++)
      for (const d of [deckD, deckD + A.deckWidth]) {
        const s = (pathLength * j) / N;
        B(o, 'rail', point(s, d, A.deckY), point(s, d, A.deckY + A.railHeight), 0.05, 0.05);
      }
  }
}
export const forebayRing = [...native.slice(5, 10), ...native.slice(27, 30)],
  intakeRing = [...native.slice(0, 6), ...native.slice(29)],
  hallRing = [
    native[0],
    native[31],
    native[30],
    [native[30][0] - A.powerhouseHallWidth, native[30][1]],
    [native[31][0] - A.powerhouseHallWidth, native[31][1]],
    [native[0][0] - A.powerhouseHallWidth, native[0][1]],
  ];
function forebay(o, lod) {
  solid(o, 'wall', forebayRing, 0, A.crest);
  if (lod > 0) {
    for (let i = 5; i < 9; i++) {
      const a = native[i],
        b = native[i + 1];
      B(o, 'rail', [a[0], A.crest + 1, a[1]], [b[0], A.crest + 1, b[1]], 0.07, 0.07);
      const N = Math.ceil(Math.hypot(...sub(b, a)) / 5);
      for (let j = 0; j < N; j++) {
        const q = a.map((v, k) => v + ((b[k] - v) * j) / N);
        B(o, 'rail', [q[0], A.crest, q[1]], [q[0], A.crest + 1, q[1]], 0.06, 0.06);
      }
    }
  }
}
function wallOpening(o, lod, f, l, r, y, Y, door = false) {
  const P = (t, h, d = 0) => [
      f.a[0] + f.u[0] * t + f.n[0] * d,
      h,
      f.a[1] + f.u[1] * t + f.n[1] * d,
    ],
    plane = (k, a, b, c, d, v = 0, col) =>
      Q(o, k, [P(a, c, v), P(b, c, v), P(b, d, v), P(a, d, v)], [f.n[0], 0, f.n[1]], col);
  if (lod === 0) {
    plane('gate', l, r, y, Y, 0.012, rgb('27383d'));
    return;
  }
  const D = A.windowDepth;
  plane('gate', l, r, y, Y, -D, rgb('27383d'));
  for (const [a, sign] of [
    [l, 1],
    [r, -1],
  ])
    Q(o, 'wall', [P(a, y), P(a, Y), P(a, Y, -D), P(a, y, -D)], [f.u[0] * sign, 0, f.u[1] * sign]);
  for (const [h, sign] of [
    [y, 1],
    [Y, -1],
  ])
    Q(o, 'wall', [P(l, h), P(r, h), P(r, h, -D), P(l, h, -D)], [0, sign, 0]);
  if (lod > 1) {
    const N = door ? 2 : 3;
    for (let k = 1; k < N; k++)
      B(
        o,
        'gate',
        P(l + ((r - l) * k) / N, y, -D + 0.04),
        P(l + ((r - l) * k) / N, Y, -D + 0.04),
        0.07,
        0.07,
      );
    for (const h of [y + (Y - y) * 0.35, y + (Y - y) * 0.7])
      B(o, 'gate', P(l, h, -D + 0.04), P(r, h, -D + 0.04), 0.055, 0.055);
  }
  openingEvidence.push({
    front: toWorld(P((l + r) / 2, (y + Y) / 2)),
    normal: [f.n[0], 0, f.n[1]],
    back: toWorld(P((l + r) / 2, (y + Y) / 2, -D)),
    depth: D,
  });
}
function hall(o, lod) {
  const s = area(hallRing) > 0 ? 1 : -1;
  for (let i = 0; i < hallRing.length; i++) {
    const a = hallRing[i],
      b = hallRing[(i + 1) % hallRing.length],
      delta = sub(b, a),
      L = Math.hypot(...delta),
      u = delta.map((v) => v / L),
      n = [s * u[1], -s * u[0]],
      f = { a, b, u, n },
      P = (t, h) => [a[0] + u[0] * t, h, a[1] + u[1] * t],
      plane = (l, r, y, Y) => Q(o, 'wall', [P(l, y), P(r, y), P(r, Y), P(l, Y)], [n[0], 0, n[1]]);
    const N = Math.max(1, Math.floor(L / 6)),
      w = Math.min(2.25, (L / (N + 1)) * 0.5),
      y = A.intakeRoof + 0.8,
      Y = A.powerhouseRoof - 0.8;
    let last = 0;
    for (let j = 1; j <= N; j++) {
      const c = (L * j) / (N + 1),
        l = c - w / 2,
        r = c + w / 2;
      if (lod === 0) continue;
      plane(last, l, A.intakeRoof, A.powerhouseRoof);
      plane(l, r, A.intakeRoof, y);
      plane(l, r, Y, A.powerhouseRoof);
      wallOpening(o, lod, f, l, r, y, Y);
      last = r;
    }
    if (lod === 0) plane(0, L, A.intakeRoof, A.powerhouseRoof);
    else plane(last, L, A.intakeRoof, A.powerhouseRoof);
  }
  cap(o, 'wall', hallRing, A.powerhouseRoof);
  if (lod > 0)
    for (let i = 0; i < hallRing.length; i++) {
      const a = hallRing[i],
        b = hallRing[(i + 1) % hallRing.length];
      B(
        o,
        'wall',
        [a[0], A.powerhouseRoof + 0.15, a[1]],
        [b[0], A.powerhouseRoof + 0.15, b[1]],
        0.3,
        0.3,
      );
    }
}
export function buildBlackEagleDam(target, _frame, lod = 3) {
  for (const a of [partEvidence, nativeEvidence, gateEvidence, openingEvidence, sectionEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-native-thirty-two-control-intrinsic-foundation', () => apron(o));
  part('curved-concrete-gravity-spillway-and-ogee', () => curtain(o, lod));
  part('twenty-five-removable-flashboard-bays-and-supports', () => flashboards(o, lod));
  part('eight-wastegates-and-physical-piers', () => wastegates(o, lod));
  part('continuous-maintenance-walkway', () => walkway(o, lod));
  part('intrinsic-north-forebay-wall', () => forebay(o, lod));
  part('whole-north-intake-block-and-generator-hall', () => {
    solid(o, 'wall', intakeRing, 0, A.intakeRoof);
    hall(o, lod);
  });
}
export const blackEagleDamSkyline = (o) => buildBlackEagleDam(o, null, 0),
  blackEagleDamDistrict = (o) => buildBlackEagleDam(o, null, 1),
  blackEagleDamStreet = (o) => buildBlackEagleDam(o, null, 2),
  blackEagleDamCloseup = (o) => buildBlackEagleDam(o, null, 3);
const cam = (x, y, z) => toWorld([x, y, z]);
export const blackEagleDamModel = {
  id: 'black_eagle_dam',
  key: 'black_eagle_dam',
  cell: 'c8/c82',
  title: 'Black Eagle Dam',
  wikidataId: 'Q4920713',
  category: 'dam',
  recipe: 'black-eagle-dam-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBlackEagleDam,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole native32-control1927BlackEagleDam: lowcurvedconcretegravityspillway/ogee,25removableflashboardbays and uprightsteelposts,8wastegates, continuousnarrowmaintenancewalkway, intrinsicforebaywall and northintake/powerhouse. ExactpublishedTim1965PD1988image first; nativewholeplan/generator and primaryFERCdimensions. Hiddenpowerhouse roof/openings and currentupgrades bounded engineeringestimates. Naturalwaterfalls/river/water/siteground/old1891dam/RyanDam excluded.',
  camera: cam(400, 240, 400),
  lookAt: cam(-10, 8, 0),
  portableGroundY: F - 0.8,
  mediumFiContext: { cameraYaw: 1.1, groundY: F - 0.3, scale: 2.5 },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'concrete_boardformed',
    'metal_painted',
    'metal_stainless',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-curved-dam-forebaywall-and-north-powerhouse',
      position: cam(330, 210, 360),
      lookAt: cam(0, 7, -10),
    },
    {
      name: 'whole-native-thirty-two-control-plan',
      position: cam(0, 540, 0.1),
      lookAt: cam(0, 7, 0),
    },
    {
      name: 'flashboards-posts-maintenancebridge-and-ogee',
      position: cam(15, 40, 55),
      lookAt: point(130, 2, 11),
    },
    {
      name: 'wastegates-north-junction-and-forebaywall',
      position: cam(10, 45, -25),
      lookAt: point(15, 2, 8),
    },
    {
      name: 'intrinsic-north-intake-and-powerhouse',
      position: cam(130, 70, -200),
      lookAt: cam(55, 12, -130),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/black-eagle-dam-runtime-overlay.mjs',
    level: 'skyline',
    export: 'blackEagleDamSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'blackEagleDamDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'blackEagleDamStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'blackEagleDamCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Exactpublished1988PDphoto predates2025-2026spillwayupgrades; clearphoto croppedleftend and mainlyhidpowerhouse. Native32controlwholeenvelope/generator and primaryFERCtext bound fullphysicalscope. Powerhousehall partition/roof/openingcensus and currentmachinery/finishes are originalestimates, not survey/currentphotogrammetry. Do notclaim exact2026operationaldevice reconstruction.',
    'No naturalrockfalls/river/water/entirereservoir or downstreamtailrace/sitepad/otherfacilities. Olddam and RyanDam not substitutes. Original512m129field/nativeframe/floor/mainsectionsfixed beforegeometry, no fitting or lateradjustment. Contactunverified/preview/replacementfalse; reviewground/syntheticneighbors are fixtures.',
  ],
};
