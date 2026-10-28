/** Whole six-span Big Four Bridge with both intrinsic pedestrian approaches. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  [N, S] = p.mainCentreline,
  L = Math.hypot(S[0] - N[0], S[1] - N[1]),
  U = [(S[0] - N[0]) / L, (S[1] - N[1]) / L],
  V = [-U[1], U[0]],
  TAU = Math.PI * 2;
const C = { steel: rgb('414444'), deck: rgb('b7b4a5'), pier: rgb('b5b0a0') };
export const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.18 },
  deck: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  pier: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  M = (s, y, z = 0) => [N[0] + U[0] * s + V[0] * z, F + y, N[1] + U[1] * s + V[1] * z];
export const spanStations = [0];
for (const w of A.spanWeights)
  spanStations.push(spanStations.at(-1) + (L * w) / A.spanWeights.reduce((s, x) => s + x, 0));
function T(o, k, q, n) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) throw Error('Collapsed bridge face');
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    C[k],
  );
}
function Q(o, k, q, n) {
  T(o, k, q.slice(0, 3), n);
  T(o, k, [q[0], q[2], q[3]], n);
}
function beam(o, k, a, b, w, h = w, cap = true) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    P = (c, x, y) => c.map((n, i) => n + (u[i] * x * w) / 2 + (v[i] * y * h) / 2),
    r = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = u.map((x, k) => x * (r[i][0] + r[j][0]) + v[k] * (r[i][1] + r[j][1]));
    Q(o, k, [P(a, ...r[i]), P(a, ...r[j]), P(b, ...r[j]), P(b, ...r[i])], n);
  }
  if (cap) {
    Q(
      o,
      k,
      r.map((t) => P(a, ...t)),
      d.map((x) => -x),
    );
    Q(
      o,
      k,
      r.map((t) => P(b, ...t)),
      d,
    );
  }
}
function pier(o, s, base, top, lod) {
  const count = [4, 8, 12, 16][lod],
    r = [];
  for (let i = 0; i < count; i++) {
    const t = (i * TAU) / count;
    r.push([Math.cos(t) * 2.4, Math.sin(t) * 5.3]);
  }
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count,
      a = r[i],
      b = r[j],
      at = M(s + a[0], base, a[1]),
      bt = M(s + b[0], base, b[1]),
      au = M(s + a[0] * 0.8, top, a[1] * 0.8),
      bu = M(s + b[0] * 0.8, top, b[1] * 0.8),
      n = [
        U[0] * (a[0] + b[0]) + V[0] * (a[1] + b[1]),
        0,
        U[1] * (a[0] + b[0]) + V[1] * (a[1] + b[1]),
      ];
    Q(o, 'pier', [at, bt, bu, au], n);
    T(o, 'pier', [M(s, base), bt, at], [0, -1, 0]);
    T(o, 'pier', [M(s, top), au, bu], [0, 1, 0]);
  }
  beam(o, 'pier', M(s, top, -5), M(s, top, 5), 5.3, 0.7, lod > 0);
}
function join(ids) {
  const a = [];
  for (const id of ids) {
    const r = p.rampCentrelines.find((r) => r.way === id).points;
    if (a.length && Math.hypot(a.at(-1)[0] - r[0][0], a.at(-1)[1] - r[0][1]) > 1e-6)
      throw Error('Disconnected native ramp');
    a.push(...r.slice(a.length ? 1 : 0));
  }
  return a;
}
function rampRoute(points, fromY, toY) {
  let total = 0;
  const at = [0];
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    at.push(total);
  }
  return points.map((q, i) => [q[0], F + fromY + ((toY - fromY) * at[i]) / total, q[1]]);
}
export const southRamp = rampRoute(join([272654900, 81267445, 754148707]), 0, A.deckY),
  northRamp = rampRoute(join([288093618, 357203779, 1458826459, 1453383804]), A.deckY, 0);
function simplify(r, tol) {
  if (!tol || r.length < 3) return r;
  const a = r[0],
    b = r.at(-1),
    v = sub(b, a),
    d = dot(v, v);
  let best = -1,
    index = 0;
  for (let i = 1; i < r.length - 1; i++) {
    const t = Math.max(0, Math.min(1, dot(sub(r[i], a), v) / d)),
      q = a.map((x, j) => x + v[j] * t),
      e = Math.hypot(...sub(r[i], q));
    if (e > best) {
      best = e;
      index = i;
    }
  }
  return best > tol
    ? [...simplify(r.slice(0, index + 1), tol).slice(0, -1), ...simplify(r.slice(index), tol)]
    : [a, b];
}
export const lodRampEvidence = [];
function ramp(o, original, lod, name) {
  const r = simplify(original, [5.5, 1.6, 0, 0][lod]),
    half = A.rampWidth / 2,
    edge = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[Math.max(0, i - 1)],
      b = r[Math.min(r.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      l = Math.hypot(dx, dz),
      n = [-dz / l, 0, dx / l];
    edge.push({
      left: r[i].map((x, j) => x + n[j] * half),
      right: r[i].map((x, j) => x - n[j] * half),
      n,
    });
  }
  for (let i = 0; i < r.length - 1; i++) {
    const a = edge[i],
      b = edge[i + 1],
      down = (q) => q.map((x, j) => x - (j === 1 ? A.deckThickness : 0));
    Q(o, 'deck', [a.left, a.right, b.right, b.left], [0, 1, 0]);
    Q(o, 'deck', [down(a.left), down(a.right), down(b.right), down(b.left)], [0, -1, 0]);
    Q(o, 'deck', [a.left, b.left, down(b.left), down(a.left)], a.n);
    Q(
      o,
      'deck',
      [a.right, b.right, down(b.right), down(a.right)],
      a.n.map((x) => -x),
    );
    if (lod > 0)
      for (const side of ['left', 'right']) {
        for (const h of lod <= 2 ? [A.guardHeight] : [0.35, A.guardHeight])
          beam(
            o,
            'steel',
            a[side].map((x, j) => x + (j === 1 ? h : 0)),
            b[side].map((x, j) => x + (j === 1 ? h : 0)),
            0.1,
            0.11,
            lod >= 3,
          );
        if (lod >= 2 && i % (lod === 2 ? 3 : 2) === 0)
          beam(
            o,
            'steel',
            a[side],
            a[side].map((x, j) => x + (j === 1 ? A.guardHeight : 0)),
            0.11,
            0.11,
          );
      }
  }
  for (const i of [0, r.length - 1]) {
    const e = edge[i],
      q = [
        e.left,
        e.right,
        e.right.map((x, j) => x - (j === 1 ? A.deckThickness : 0)),
        e.left.map((x, j) => x - (j === 1 ? A.deckThickness : 0)),
      ],
      d = unit(sub(r[i === 0 ? 1 : i], r[i === 0 ? 0 : i - 1]));
    Q(
      o,
      'deck',
      q,
      d.map((x) => x * (i === 0 ? -1 : 1)),
    );
  }
  const step = [Math.max(1, Math.floor(r.length / 3)), Math.max(1, Math.floor(r.length / 8)), 4, 3][
    lod
  ];
  for (let i = step; i < r.length - 1; i += step) {
    const q = r[i];
    if (q[1] - F > 2)
      beam(o, 'steel', [q[0], F, q[2]], [q[0], q[1] - A.deckThickness, q[2]], 0.65, 0.65, lod > 0);
  }
  lodRampEvidence.push({
    lod,
    name,
    nativeControls: original.length,
    renderControls: r.length,
    from: r[0],
    to: r.at(-1),
  });
}
export function buildBigFourBridge(o, _frame, lod = 3) {
  const cap = lod > 0;
  beam(
    o,
    'deck',
    M(0, A.deckY - 0.325),
    M(L, A.deckY - 0.325),
    A.walkwayWidth,
    A.deckThickness,
    cap,
  );
  for (let i = 0; i < 7; i++) pier(o, spanStations[i], A.pierBaseYs[i], A.pierTop, lod);
  for (let s = 0; s < 6; s++) {
    const a = spanStations[s],
      b = spanStations[s + 1],
      count = [4, 4, 12, 12][lod],
      H = A.trussHeights[s],
      height = (t) => (t === 0 || t === 1 ? 0 : H * (1 - 0.45 * (2 * t - 1) * (2 * t - 1))),
      top = Array.from({ length: count + 1 }, (_, i) => [
        a + ((b - a) * i) / count,
        A.deckY + height(i / count),
      ]);
    for (const z of [-A.trussHalfWidth, A.trussHalfWidth]) {
      beam(o, 'steel', M(a, A.deckY - 0.55, z), M(b, A.deckY - 0.55, z), 0.55, 0.85, cap);
      for (let i = 0; i < count; i++)
        beam(o, 'steel', M(...top[i], z), M(...top[i + 1], z), lod === 0 ? 1.2 : 0.6, 0.7, cap);
      if (lod > 0) {
        for (let i = 1; i < count; i++)
          beam(o, 'steel', M(top[i][0], A.deckY, z), M(...top[i], z), 0.4, 0.45);
        for (let i = 0; i < count; i++) {
          const j = i < count / 2 ? i + 1 : i;
          beam(
            o,
            'steel',
            M(a + ((b - a) * (i + (i < count / 2 ? 0 : 1))) / count, A.deckY, z),
            M(...top[j], z),
            0.37,
            0.43,
          );
        }
        if (lod >= 2 && s >= 1 && s <= 3)
          for (let i = 1; i < count - 1; i++) {
            const mid = (top[i][0] + top[i + 1][0]) / 2,
              yy = A.deckY + H * 0.47;
            beam(o, 'steel', M(top[i][0], A.deckY, z), M(mid, yy, z), 0.2, 0.23);
            beam(o, 'steel', M(mid, yy, z), M(...top[i + 1], z), 0.2, 0.23);
            if (lod >= 3) beam(o, 'steel', M(mid, A.deckY, z), M(mid, yy, z), 0.18, 0.2);
          }
        if (lod >= 3)
          for (let i = 1; i < count; i++) {
            const q = top[i];
            beam(o, 'steel', M(q[0], q[1] - 0.5, z - 0.05), M(q[0], q[1] + 0.5, z - 0.05), 1, 0.12);
            for (const h of [-0.3, 0, 0.3])
              beam(
                o,
                'steel',
                M(q[0] - 0.24, q[1] + h, z - 0.14),
                M(q[0] + 0.24, q[1] + h, z - 0.14),
                0.07,
                0.09,
              );
          }
      }
    }
    if (lod > 0)
      for (let i = 1; i < count; i++) {
        beam(
          o,
          'steel',
          M(...top[i], -A.trussHalfWidth),
          M(...top[i], A.trussHalfWidth),
          0.33,
          0.4,
        );
        if (lod >= 2 && i < count - 1) {
          beam(
            o,
            'steel',
            M(...top[i], -A.trussHalfWidth),
            M(...top[i + 1], A.trussHalfWidth),
            0.2,
            0.22,
          );
          beam(
            o,
            'steel',
            M(...top[i], A.trussHalfWidth),
            M(...top[i + 1], -A.trussHalfWidth),
            0.2,
            0.22,
          );
        }
      }
    if (lod >= 2) {
      const n = lod === 2 ? 12 : 24;
      for (let i = 0; i <= n; i++) {
        const station = a + ((b - a) * i) / n;
        for (const z of [-3.15, 3.15])
          beam(
            o,
            'steel',
            M(station, A.deckY, z),
            M(station, A.deckY + A.guardHeight, z),
            0.1,
            0.1,
          );
      }
      for (const z of [-3.15, 3.15])
        for (const y of [0.35, A.guardHeight])
          beam(o, 'steel', M(a, A.deckY + y, z), M(b, A.deckY + y, z), 0.11, 0.11);
      for (let i = 0; i <= count; i++)
        beam(
          o,
          'steel',
          M(a + ((b - a) * i) / count, A.deckY - 0.9, -4.2),
          M(a + ((b - a) * i) / count, A.deckY - 0.9, 4.2),
          0.35,
          0.45,
        );
    }
  }
  ramp(o, southRamp, lod, 'Louisville spiral');
  ramp(o, northRamp, lod, 'Jeffersonville curved approach');
}
export const bigFourBridgeSkyline = (o) => buildBigFourBridge(o, null, 0),
  bigFourBridgeDistrict = (o) => buildBigFourBridge(o, null, 1),
  bigFourBridgeStreet = (o) => buildBigFourBridge(o, null, 2),
  bigFourBridgeCloseup = (o) => buildBigFourBridge(o, null, 3);
export const bigFourBridgeModel = {
  id: 'big_four_bridge',
  key: 'big_four_bridge',
  cell: 'dn/dng',
  title: 'Big Four Bridge',
  wikidataId: 'Q4905727',
  category: p.category,
  recipe: 'big-four-bridge-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBigFourBridge,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole six-span Big Four pedestrian bridge on exact778.1m native rivercentreline: one shortnorth/three longer Pennsylvania middles/two shortsouth Parker spans, dark polygonal upperchords/verticals/diagonal and secondarybracing/realstructuralvoids/upperlateralcrossbracing, pale6m walkway/physicalrails, five riverpiers/two endsupports, actual integral Louisville spiral and Jeffersonville descending curved ramp centrelines with deck/rails/columns. Two exactpublished2024creatorCC0 and2012creatorPD-self originals. Span boundaries/membersections/height/supportdetails/rivetcensus/currentfinefinish unsurveyed originalestimates. Parks/neighborbridges/river/temporary2012equipment/boats/people/arttext/photo pixels excluded.',
  camera: [900, 400, 1050],
  lookAt: [-50, 20, -80],
  portableGroundY: F - 10.2,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 10.1 },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain', 'stone_limestone'],
  qaCameras: [
    {
      name: 'whole-downstream-six-spans-and-both-approaches',
      position: [-1150, 380, 500],
      lookAt: [-50, 22, -100],
    },
    {
      name: 'louisville-spiral-ramp-deck-rails-and-supports',
      position: [450, 140, 515],
      lookAt: [205, 12, 320],
    },
    {
      name: 'jeffersonville-long-curved-ramp-and-north-end',
      position: [-500, 165, -680],
      lookAt: [-235, 12, -490],
    },
    {
      name: 'pennsylvania-throughtruss-open-panels-and-upper-crossbracing',
      position: M(355, 48, 75),
      lookAt: M(355, 30, 0),
    },
    { name: 'north-pier-cap-steel-endpost-and-deck', position: M(5, 18, 30), lookAt: M(3, 17, 0) },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/big-four-bridge-runtime-overlay.mjs',
    level: 'skyline',
    export: 'bigFourBridgeSkyline',
    errorMeters: 6,
    surfaces,
    authoredLevels: {
      district: { export: 'bigFourBridgeDistrict', errorMeters: 2.2, surfaces },
      street: { export: 'bigFourBridgeStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'bigFourBridgeCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Two exactpublished2024Huskydaddyown-selfCC0 wholebridge/spiral and2012Nyttendown-PDself northpier/steel detail originals only. WesternsidePD photo inspected but unselected under unchanged publishedguard; no supplemental/reclassification/source repair. Current pedestrian conversion established by2024photo,2012temporaryconstruction/containers/crane/fences excluded. Six spans and both integral approaches retained, no detail-only substitute. Exacthiddenmember profiles/fasteners/census/spanstations/underwaterfoundations/height/currentfinefinish are original estimates. No operational/engineering/hydraulicclearance or traversal claim.',
    'Original1600m129x12916641sample field/four rawtiles/fixednorthground135.0347m providerrelative datum frozen beforeallsections/geometry. No terrainfit/flatten/reacquire/modelraising. Exact bank/ramp/pier contact unresolved, preview/replaceFootprint=false. Flatground/syntheticneighbors are reviewfixtures only.',
  ],
};
