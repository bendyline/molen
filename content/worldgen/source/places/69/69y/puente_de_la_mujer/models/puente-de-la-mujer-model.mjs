/** Whole native bridge route, original blade pylon and closed-position cable-stayed shell. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  {
    floorY: F,
    authoringOrigin: O,
    axisU: U,
    axisV: V,
    axisLength: L,
    nativeRouteStations: R,
    receivingSupport: RS,
    architecturalSections: A,
  } = p.parameters;
const C = {
    steel: rgb('e4e5dc'),
    edge: rgb('f1f0e5'),
    concrete: rgb('d2d1c1'),
    deck: rgb('9b9b8b'),
    wire: rgb('687773'),
    collar: rgb('626c61'),
    joint: rgb('6e756c'),
  },
  planks = ['999b8b', 'a2a395', 'a7a698', 'a1a192', '939987'].map(rgb);
export const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.12 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  deck: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
export const nativeEvidence = [],
  pylonEvidence = [],
  cableEvidence = [],
  pierEvidence = [],
  railEvidence = [],
  deckEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t,
  clamp = (t) => Math.max(0, Math.min(1, t));
export const toWorld = (q) => [
    O[0] + U[0] * q[0] + V[0] * q[2],
    F + q[1],
    O[1] + U[1] * q[0] + V[1] * q[2],
  ],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
export function centerV(s) {
  for (let i = 1; i < R.length; i++)
    if (s <= R[i][0] + 1e-8)
      return mix(R[i - 1][1], R[i][1], clamp((s - R[i - 1][0]) / (R[i][0] - R[i - 1][0])));
  return R.at(-1)[1];
}
export function deckY(s) {
  const t = clamp(s / L);
  return A.eastEndRise * t + A.camberRise * 4 * t * (1 - t);
}
export function girderDepth(s) {
  const q = (s - A.pivotStation) / 14;
  return A.deckThickness + A.sideDepth * (0.3 + 0.7 * Math.exp(-q * q));
}
export function pylonRange(y) {
  const t = clamp(y / A.pylonHeight),
    front = A.pivotStation - A.pylonLean * t - 2 * Math.sin(Math.PI * t),
    back = front + A.pylonTipWidth + (A.pylonBaseBackspan - A.pylonTipWidth) * Math.pow(1 - t, 2.4);
  return [front, back];
}
const py = () => deckY(A.pivotStation) + 0.04,
  pv = () => centerV(A.pivotStation) + A.pylonCenterV;
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
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
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function loft(o, k, rings, col = C[k], cap = true) {
  const signs = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 4; i++)
      Q(
        o,
        k,
        [rings[j - 1][i], rings[j - 1][(i + 1) % 4], rings[j][(i + 1) % 4], rings[j][i]],
        signs[i],
        col,
      );
  if (cap)
    for (const [r, n] of [
      [rings[0], [0, -1, 0]],
      [rings.at(-1), [0, 1, 0]],
    ])
      Q(o, k, r, n, col);
}
function rod(o, k, a, b, r, N, col = C[k]) {
  const axis = normalize(sub(b, a)),
    u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    P = (c, t) => c.map((x, i) => x + r * (u[i] * Math.cos(t) + v[i] * Math.sin(t)));
  for (let i = 0; i < N; i++) {
    const t = (i * Math.PI * 2) / N,
      q = ((i + 1) * Math.PI * 2) / N,
      n = u.map((x, j) => x * Math.cos((t + q) / 2) + v[j] * Math.sin((t + q) / 2));
    Q(o, k, [P(a, t), P(a, q), P(b, q), P(b, t)], n, col);
    T(
      o,
      k,
      [a, P(a, t), P(a, q)],
      axis.map((x) => -x),
      col,
    );
    T(o, k, [b, P(b, t), P(b, q)], axis, col);
  }
}
function cylinder(o, k, s, z, rings, N, col = C[k]) {
  const ring = ([y, r]) =>
      Array.from({ length: N }, (_, i) => [
        s + r * Math.cos((i * Math.PI * 2) / N),
        y,
        z + r * Math.sin((i * Math.PI * 2) / N),
      ]),
    rs = rings.map(ring);
  for (let j = 1; j < rs.length; j++)
    for (let i = 0; i < N; i++) {
      const k2 = (i + 1) % N,
        t = ((i + 0.5) * Math.PI * 2) / N;
      Q(
        o,
        k,
        [rs[j - 1][i], rs[j - 1][k2], rs[j][k2], rs[j][i]],
        [Math.cos(t), 0, Math.sin(t)],
        col,
      );
    }
  for (const [j, n] of [
    [0, -1],
    [rs.length - 1, 1],
  ])
    for (let i = 0; i < N; i++)
      T(o, k, [[s, rings[j][0], z], rs[j][i], rs[j][(i + 1) % N]], [0, n, 0], col);
}
function stations(lod) {
  return [
    ...new Set([
      0,
      L,
      ...R.map((q) => q[0]),
      A.coreStart,
      A.coreEnd,
      A.pivotStation,
      ...A.sidePierStations,
      ...Array.from(
        { length: [8, 20, 56, 112][lod] + 1 },
        (_, i) => (L * i) / [8, 20, 56, 112][lod],
      ),
    ]),
  ]
    .sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6);
}
function deck(o, lod) {
  const ss = stations(lod),
    half = A.deckWidth / 2;
  for (let i = 1; i < ss.length; i++) {
    const a = ss[i - 1],
      b = ss[i],
      va = centerV(a),
      vb = centerV(b),
      ya = deckY(a),
      yb = deckY(b),
      da = girderDepth(a),
      db = girderDepth(b);
    for (const side of [-1, 1]) {
      Q(
        o,
        'deck',
        [
          [a, ya + 0.04, va],
          [b, yb + 0.04, vb],
          [b, yb + 0.04, vb + side * (half - 0.16)],
          [a, ya + 0.04, va + side * (half - 0.16)],
        ],
        [0, 1, 0],
        C.deck,
      );
      Q(
        o,
        'steel',
        [
          [a, ya, va + side * half],
          [b, yb, vb + side * half],
          [b, yb - db, vb + side * (half - 0.5)],
          [a, ya - da, va + side * (half - 0.5)],
        ],
        [0, -0.3, side],
        C.steel,
      );
      Q(
        o,
        'steel',
        [
          [a, ya - da, va],
          [b, yb - db, vb],
          [b, yb - db, vb + side * (half - 0.5)],
          [a, ya - da, va + side * (half - 0.5)],
        ],
        [0, -1, 0],
        C.steel,
      );
      Q(
        o,
        'steel',
        [
          [a, ya, va + side * half],
          [b, yb, vb + side * half],
          [b, yb + 0.16, vb + side * half],
          [a, ya + 0.16, va + side * half],
        ],
        [0, 0, side],
        C.edge,
      );
      Q(
        o,
        'steel',
        [
          [a, ya + 0.16, va + side * half],
          [b, yb + 0.16, vb + side * half],
          [b, yb + 0.16, vb + side * (half - 0.16)],
          [a, ya + 0.16, va + side * (half - 0.16)],
        ],
        [0, 1, 0],
        C.edge,
      );
      Q(
        o,
        'steel',
        [
          [a, ya + 0.16, va + side * (half - 0.16)],
          [b, yb + 0.16, vb + side * (half - 0.16)],
          [b, yb + 0.04, vb + side * (half - 0.16)],
          [a, ya + 0.04, va + side * (half - 0.16)],
        ],
        [0, 0, -side],
        C.edge,
      );
    }
  }
  for (const [s, n] of [
    [0, -1],
    [L, 1],
  ]) {
    const v = centerV(s),
      y = deckY(s),
      d = girderDepth(s);
    Q(
      o,
      'steel',
      [
        [s, y, v - half],
        [s, y, v + half],
        [s, y - d, v + half - 0.5],
        [s, y - d, v - half + 0.5],
      ],
      [n, 0, 0],
      C.steel,
    );
  }
  if (lod >= 2) {
    const step = lod === 2 ? 1.2 : A.plankPitch;
    for (let s = 0.09, i = 0; s < L - 0.1; s += step, i++) {
      const e = Math.min(L - 0.06, s + step - 0.018),
        v = centerV(s),
        w = centerV(e);
      for (const side of [-1, 1])
        Q(
          o,
          'deck',
          [
            [s, deckY(s) + 0.05, v],
            [e, deckY(e) + 0.05, w],
            [e, deckY(e) + 0.05, w + side * (half - 0.18)],
            [s, deckY(s) + 0.05, v + side * (half - 0.18)],
          ],
          [0, 1, 0],
          planks[i % planks.length],
        );
    }
  }
  for (const [i, q] of R.entries())
    nativeEvidence.push({
      nativeNodeId: frame.nativeRoute.nodeIds[i],
      kind: 'actual-native-route-control',
      s: q[0],
      v: q[1],
      local: [q[0], deckY(q[0]) + 0.04, q[1]],
    });
  deckEvidence.push({
    fullLength: L,
    coreLength: A.rotatingCoreLength,
    core: [A.coreStart, A.coreEnd],
    nativeRouteControls: 4,
    deckEdgeMapped: false,
    currentDeckFinishEstimated: true,
  });
  if (lod >= 2)
    for (let s = 4; s < L - 2; s += [0, 0, 6, 2.5][lod])
      B(
        o,
        'steel',
        [s, deckY(s) - girderDepth(s) + 0.1, centerV(s) - 2.7],
        [s, deckY(s) - girderDepth(s) + 0.1, centerV(s) + 2.7],
        0.12,
        0.22,
        C.steel,
      );
  if (lod === 3)
    for (let s = 2; s < L - 1; s += 1.8)
      for (const sign of [-1, 1])
        rod(
          o,
          'steel',
          [s, deckY(s) - 0.58, centerV(s) + sign * 2.69],
          [s, deckY(s) - 0.58, centerV(s) + sign * 2.75],
          0.055,
          6,
          C.joint,
        );
}
function pylon(o, lod) {
  const N = [6, 18, 48, 96][lod],
    rings = [];
  for (let i = 0; i <= N; i++) {
    const y = (A.pylonHeight * i) / N,
      [a, b] = pylonRange(y),
      h = mix(A.pylonBaseHalfThickness, A.pylonTopHalfThickness, i / N),
      v = pv();
    const Y = (s) => py() + y + (deckY(s) - deckY(A.pivotStation)) * Math.pow(1 - clamp(y / 5), 2);
    rings.push([
      [a, Y(a), v - h],
      [b, Y(b), v - h],
      [b, Y(b), v + h],
      [a, Y(a), v + h],
    ]);
  }
  loft(o, 'steel', rings, C.edge);
  pylonEvidence.push({
    height: A.pylonHeight,
    lean: A.pylonLean,
    pivot: A.pivotStation,
    baseV: pv(),
    rangeAtBase: pylonRange(0),
    rangeAtTip: pylonRange(A.pylonHeight),
    originalProfileEstimate: true,
    mappedPylon: false,
  });
  if (lod >= 2) {
    const [a, b] = pylonRange(A.pylonHeight);
    rod(
      o,
      'steel',
      [(a + b) / 2, py() + A.pylonHeight, pv()],
      [(a + b) / 2, py() + A.pylonHeight + 0.26, pv()],
      0.035,
      6,
      C.wire,
    );
  }
  if (lod === 3)
    for (let i = 1; i < 14; i++) {
      const y = (A.pylonHeight * i) / 14,
        [a, b] = pylonRange(y),
        h = mix(A.pylonBaseHalfThickness, A.pylonTopHalfThickness, y / A.pylonHeight);
      for (const sign of [-1, 1])
        B(
          o,
          'steel',
          [a + 0.03, py() + y, pv() + sign * (h + 0.003)],
          [b - 0.03, py() + y, pv() + sign * (h + 0.003)],
          0.018,
          0.018,
          C.steel,
        );
    }
}
function stays(o, lod) {
  const N = [5, 7, 9, 9][lod];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1),
      y = A.pylonHeight * mix(0.96, 0.56, t),
      [s] = pylonRange(y),
      a = [s + 0.1, py() + y, pv()],
      ss = mix(A.coreStart + 2, A.pivotStation - 31, t),
      b = [ss, deckY(ss) + 0.2, centerV(ss) - 2.2];
    rod(o, 'steel', a, b, [0.075, 0.06, 0.045, 0.045][lod], [3, 4, 6, 8][lod], C.wire);
    if (lod >= 2) {
      cylinder(
        o,
        'steel',
        b[0],
        b[2],
        [
          [b[1] - 0.04, 0.16],
          [b[1] + 0.15, 0.12],
        ],
        8,
        C.edge,
      );
      rod(o, 'steel', a, mix3(a, b, 0.05), 0.1, 8, C.steel);
    }
    cableEvidence.push({ a, b, visible: true, originalCensusEstimate: true });
  }
}
const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function supports(o, lod) {
  const N = [8, 12, 24, 40][lod],
    s = A.pivotStation,
    v = centerV(s),
    head = deckY(s) - 0.6;
  cylinder(
    o,
    'concrete',
    s,
    v,
    [
      [A.pierBase, A.pivotBottomRadius],
      [-3.5, 2.2],
      [head - 0.45, A.pivotTopRadius],
      [head, A.pivotTopRadius],
    ],
    N,
    C.concrete,
  );
  if (lod > 0) {
    cylinder(
      o,
      'steel',
      s,
      v,
      [
        [-5.6, 1.9],
        [-3.8, 2.2],
      ],
      N,
      C.collar,
    );
    for (let i = 0; i < [0, 2, 4, 7][lod]; i++) {
      const y = -3.6 + i * 0.35;
      cylinder(
        o,
        'concrete',
        s,
        v,
        [
          [y, 2.24 + i * 0.08],
          [y + 0.055, 2.24 + i * 0.08],
        ],
        N,
        C.concrete,
      );
    }
  }
  pierEvidence.push({
    kind: 'original-inferred-main-turntable',
    s,
    v,
    base: A.pierBase,
    top: head,
    mappedFootprint: false,
  });
  for (const s of A.sidePierStations) {
    const v = centerV(s),
      head = deckY(s) - 0.65;
    cylinder(
      o,
      'concrete',
      s,
      v,
      [
        [A.pierBase, 0.82],
        [-3.5, A.sidePierRadius],
        [head, 1.45],
      ],
      N,
      C.concrete,
    );
    if (lod >= 1)
      cylinder(
        o,
        'steel',
        s,
        v,
        [
          [-5.3, 0.94],
          [-3.7, A.sidePierRadius + 0.04],
        ],
        N,
        C.collar,
      );
    pierEvidence.push({
      kind: 'original-photo-estimated-side-support',
      s,
      v,
      base: A.pierBase,
      top: head,
      mappedFootprint: false,
    });
  }
  cylinder(
    o,
    'concrete',
    RS[0],
    RS[1],
    [
      [A.pierBase, 0.85],
      [A.receivingPierTop - 0.3, A.receivingPierRadius],
      [A.receivingPierTop, A.receivingPierRadius],
    ],
    N,
    C.concrete,
  );
  if (lod >= 1)
    cylinder(
      o,
      'steel',
      RS[0],
      RS[1],
      [
        [A.receivingPierTop, 0.65],
        [A.receivingPierTop + 0.12, 0.65],
      ],
      N,
      C.wire,
    );
  nativeEvidence.push({
    kind: 'actual-native-remote-receiving-support-point',
    s: RS[0],
    v: RS[1],
    local: [RS[0], A.receivingPierTop, RS[1]],
  });
  pierEvidence.push({
    kind: 'native-remote-receiving-support-original-section',
    s: RS[0],
    v: RS[1],
    base: A.pierBase,
    top: A.receivingPierTop,
    mappedPoint: true,
    mappedFootprint: false,
  });
  for (const s of [0, L]) {
    const y = deckY(s),
      v = centerV(s),
      w = 3.6,
      rings = [
        [
          [s - 1.1, A.abutmentBottom, v - w],
          [s + 1.1, A.abutmentBottom, v - w],
          [s + 1.1, A.abutmentBottom, v + w],
          [s - 1.1, A.abutmentBottom, v + w],
        ],
        [
          [s - 1.1, y - 0.55, v - w],
          [s + 1.1, y - 0.55, v - w],
          [s + 1.1, y - 0.55, v + w],
          [s - 1.1, y - 0.55, v + w],
        ],
      ];
    loft(o, 'concrete', rings, C.concrete);
  }
}
function rails(o, lod) {
  const count = [4, 22, 64, 112][lod],
    segments = [4, 18, 48, 112][lod],
    ss = [
      ...new Set([
        ...R.map((q) => q[0]),
        ...Array.from({ length: segments + 1 }, (_, i) => (L * i) / segments),
      ]),
    ]
      .sort((a, b) => a - b)
      .filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-6),
    heights =
      lod === 0 ? [A.railHeight] : lod === 1 ? [0.52, A.railHeight] : [0.26, 0.64, A.railHeight];
  for (const sign of [-1, 1]) {
    for (let i = 0; i <= count; i++) {
      const s = 0.25 + ((L - 0.5) * i) / count,
        v = centerV(s) + sign * A.railHalfwidth,
        y = deckY(s) + 0.14;
      B(
        o,
        'steel',
        [s, y, v],
        [s, y + A.railHeight, v + sign * 0.16],
        lod === 0 ? 0.1 : 0.055,
        lod === 0 ? 0.1 : 0.055,
        C.steel,
      );
    }
    for (const h of heights)
      for (let i = 1; i < ss.length; i++) {
        const a = ss[i - 1],
          b = ss[i],
          v = centerV(a) + sign * (A.railHalfwidth + (0.16 * h) / A.railHeight),
          w = centerV(b) + sign * (A.railHalfwidth + (0.16 * h) / A.railHeight);
        B(
          o,
          'steel',
          [a, deckY(a) + 0.14 + h, v],
          [b, deckY(b) + 0.14 + h, w],
          h === A.railHeight ? 0.065 : 0.035,
          h === A.railHeight ? 0.065 : 0.035,
          C.steel,
        );
      }
    railEvidence.push({ sign, posts: count + 1, heights, openInfill: true });
  }
  if (lod >= 2)
    for (const s of [A.coreStart, A.coreEnd])
      for (const side of [-1, 1])
        B(
          o,
          'steel',
          [s, deckY(s) + 0.08, centerV(s) + side * 2.8],
          [s + 0.1, deckY(s) + 0.08, centerV(s) + side * 0.2],
          0.1,
          0.08,
          C.joint,
        );
}
export function buildPuenteDeLaMujer(o, _frame, lod = 3) {
  nativeEvidence.length = 0;
  pylonEvidence.length = 0;
  cableEvidence.length = 0;
  pierEvidence.length = 0;
  railEvidence.length = 0;
  deckEvidence.length = 0;
  deck(o, lod);
  pylon(o, lod);
  stays(o, lod);
  supports(o, lod);
  rails(o, lod);
}
export const puenteDeLaMujerSkyline = (o) => buildPuenteDeLaMujer(o, null, 0),
  puenteDeLaMujerDistrict = (o) => buildPuenteDeLaMujer(o, null, 1),
  puenteDeLaMujerStreet = (o) => buildPuenteDeLaMujer(o, null, 2),
  puenteDeLaMujerCloseup = (o) => buildPuenteDeLaMujer(o, null, 3);
export const puenteDeLaMujerModel = {
  id: 'puente_de_la_mujer',
  key: 'puente_de_la_mujer',
  cell: '69/69y',
  title: 'Puente de la Mujer',
  wikidataId: 'Q2336867',
  category: p.category,
  recipe: 'puente-de-la-mujer-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildPuenteDeLaMujer,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole closed-position Puente de la Mujer: full native170.8816m bridge/endapproach open route and intrinsic remote receiving-supportpoint, curved inclined white39m blade-pylon/flared sweptroot, original102m rotatingcore decomposition/cablefan, slightly cambered graydeck, closed tapered underside/ribs/flanges, true open lean-out rails, flared mainturntable/two photo-estimated sidepiers/native remote receivingpier/endbearings. Exact4routecontrols+remote point retained; no invented native deck/pylon/pier polygons or adjacent mappedbridgearea substitution. Two cleared published2011HermannLuyken own/self-CC0 opposite-side originals only. Pylonprofile/width/corepivot inference/cable-rail census/currentdeckfinish/hiddenmechanics/footings/precisebank-water-contact are original estimates; static medium-fi exterior/preview/replacementfalse, no operationalmotion certification.',
  camera: [160, F + 62, 150],
  lookAt: [0, F + 13, -16],
  portableGroundY: F + A.pierBase - 0.2,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F + A.pierBase - 0.1 },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-opposite-blade-pylon-full-deck-and-remote-receiving-pier',
      position: [-165, F + 61, -165],
      lookAt: [-2, F + 12, -5],
    },
    {
      name: 'inclined-swept-blade-root-and-main-flared-turntable',
      position: [60, F + 16, -72],
      lookAt: toWorld([A.pivotStation, 9, pv()]),
    },
    {
      name: 'whole-native-centerline-route-endapproaches-and-remote-support-plan',
      position: [0.1, F + 240, 0.15],
      lookAt: [0, F + 1, 0],
    },
    {
      name: 'under-deck-closed-soffit-ribs-and-open-support-spans',
      position: [-25, F - 2, 24],
      lookAt: [20, F - 1, -23],
    },
    {
      name: 'walkable-gray-deck-planks-open-rails-cables-and-rotating-joint',
      position: toWorld([A.coreStart - 12, 6, 15]),
      lookAt: toWorld([A.coreStart + 25, 3, -1]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/puente-de-la-mujer-runtime-overlay.mjs',
    level: 'skyline',
    export: 'puenteDeLaMujerSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'puenteDeLaMujerDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'puenteDeLaMujerStreet', errorMeters: 0.17, surfaces },
      closeup: { export: 'puenteDeLaMujerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Two exact clearedpublished2011HermannLuyken own/self-CC0 opposite-side Qualla originals individually inspected/nativeSHA1matched; unchanged imagery inventory passed. Third ship-porthole image clearCC0 but occluded/redundant, unselected. No supplemental/questionable source/rightsrepair/reclassification/guardchanges/sourcepixels. Designer102mcore/39mpylon/90degrotation factual support only; no protected plans/photos copied. Original static closed bridge shell; no animated/operational rotation/certified load or surveyed reconstruction.',
    'Original independent400m129x12916641sample/one rawtile field/nativefullcomponentbboxanchor/heading0/SW8.1625mproviderdatum frozen before floor/sections/geometry. Once-only westshore floor1.4482m retained; raw east source2.258m/delta-7.3527m is not a surveyed structuralgrade. Before geometry/render, photo-estimated-.35m structural east rise/1.2mcamber chosen; no fieldfit/flatten/reacquire/reframe/late raising. Native support point is for open-position receivingpier, not mainpylon. Width/piersections/footings/pylon/core subdivisions/precisewaterline-bed-bank-contact/currentfinish remain bounded estimates; geographicpreview/replacementfalse. Flat lowground/contextneighbors are reviewfixtures only.',
  ],
};
