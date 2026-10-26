/** Whole main dam; native perimeter and primary engineering elevations stay fixed. */
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
  { floorY: F, architecturalSections: A, axisU: U, axisV: V } = p.parameters,
  datum = p.terrainFrozenBeforeGeometry.datum;
export const native = frame.features[0].outline.slice(0, -1),
  toWorld = (q) => [q[0], F + q[1], q[2]],
  direction = (q) => q,
  elevation = (rl) => rl - datum - F;
const C = {
  wall: rgb('aba99e'),
  foundation: rgb('91948a'),
  gate: rgb('626e6c'),
  rail: rgb('aaaead'),
  dark: rgb('3c4645'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  gate: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.4 },
  rail: { slot: 'trim', graph: 'metal_stainless', roughness: 0.5, metallic: 0.8 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
export const partEvidence = [],
  nativeEvidence = [],
  gateEvidence = [],
  sectionEvidence = [],
  bridgeEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
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
const area = native.reduce((s, a, i) => s + cross2(a, native[(i + 1) % native.length]), 0),
  sign = area > 0 ? 1 : -1;
function cap(o, k, ring, y) {
  for (const ids of ShapeUtils.triangulateShape(
    ring.map((q) => new Vector2(...q)),
    [],
  ))
    T(
      o,
      k,
      ids.map((i) => [ring[i][0], y, ring[i][1]]),
      [0, 1, 0],
    );
}
function apron(o) {
  cap(o, 'foundation', native, A.apronTop);
  for (let i = 0; i < native.length; i++) {
    const a = native[i],
      b = native[(i + 1) % native.length];
    Q(
      o,
      'foundation',
      [
        [a[0], A.foundationBottom, a[1]],
        [b[0], A.foundationBottom, b[1]],
        [b[0], 0, b[1]],
        [a[0], 0, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
    nativeEvidence.push({ point: toWorld([a[0], 0, a[1]]), id: 116794508 });
  }
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
    hits = [];
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
  return hits.length ? Math.min(...hits) : 9.14;
}
export const banks = [
  {
    kind: 'auxiliary',
    start: A.auxiliaryBankStart,
    length: A.auxiliaryBankLength,
    count: A.auxiliaryGateCount,
    height: A.auxiliaryGateHeight,
  },
  {
    kind: 'service',
    start: A.serviceBankStart,
    length: A.serviceBankLength,
    count: A.serviceGateCount,
    height: A.serviceGateHeight,
  },
].map((b) => ({
  ...b,
  end: b.start + b.length,
  pier: (b.length - b.count * A.gateClearWidth) / (b.count + 1),
}));
const bankAt = (s) => banks.find((b) => s > b.start + 1e-5 && s < b.end - 1e-5),
  crest = (s) => elevation(bankAt(s) ? A.spillwayCrestRL : A.topRL),
  deckWidth = (s) => Math.min(A.topWidth, width(s) * 0.8),
  smooth = (t) => 3 * t * t - 2 * Math.pow(t, 3);
export function profile(s, t, bank = bankAt(s)) {
  const w = width(s),
    d = deckWidth(s),
    h = elevation(bank ? A.spillwayCrestRL : A.topRL);
  return point(s, d + (w - d) * t, h * (1 - (bank ? smooth(t) : t)));
}
function mainBody(o, lod) {
  const anchors = [...distances, ...banks.flatMap((b) => [b.start, b.end])].sort((a, b) => a - b),
    ss = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i],
      b = anchors[i + 1],
      N = Math.max(1, Math.ceil((b - a) / [10000, 10000, 45, 20][lod]));
    for (let j = 0; j < N; j++) ss.push(a + ((b - a) * j) / N);
  }
  ss.push(pathLength);
  for (let i = 0; i < ss.length - 1; i++) {
    const a = ss[i],
      b = ss[i + 1],
      mid = (a + b) / 2,
      bank = bankAt(mid),
      h = elevation(bank ? A.spillwayCrestRL : A.topRL),
      da = deckWidth(a),
      db = deckWidth(b),
      f = station(mid),
      n = f.n;
    Q(o, 'wall', [point(a, 0, 0), point(b, 0, 0), point(b, 0, h), point(a, 0, h)], [n[0], 0, n[1]]);
    if (bank)
      Q(o, 'wall', [point(a, 0, h), point(b, 0, h), point(b, db, h), point(a, da, h)], [0, 1, 0]);
    const N = bank ? [1, 4, 8, 14][lod] : 1;
    for (let j = 0; j < N; j++)
      Q(
        o,
        'wall',
        [
          profile(a, j / N, bank),
          profile(b, j / N, bank),
          profile(b, (j + 1) / N, bank),
          profile(a, (j + 1) / N, bank),
        ],
        [-n[0], 1, -n[1]],
      );
    // The continuous crest bridge is supported by the complete abutments and all gate piers.
    const y = elevation(A.topRL),
      z = y - A.deckThickness;
    Q(o, 'wall', [point(a, 0, y), point(b, 0, y), point(b, db, y), point(a, da, y)], [0, 1, 0]);
    if (bank)
      for (const r of [0, 1])
        Q(
          o,
          'wall',
          [point(a, r * da, z), point(b, r * db, z), point(b, r * db, y), point(a, r * da, y)],
          [n[0] * (r ? -1 : 1), 0, n[1] * (r ? -1 : 1)],
        );
    if (bank && lod > 0)
      Q(o, 'wall', [point(a, 0, z), point(a, da, z), point(b, db, z), point(b, 0, z)], [0, -1, 0]);
    if (lod > 0)
      for (const r of [0.1, 0.9]) {
        B(
          o,
          'rail',
          point(a, r * da, y + A.railHeight),
          point(b, r * db, y + A.railHeight),
          0.12,
          0.12,
        );
        if (lod > 1) B(o, 'rail', point(a, r * da, y + 0.5), point(b, r * db, y + 0.5), 0.06, 0.06);
      }
    bridgeEvidence.push({
      a,
      b,
      top: toWorld([0, y, 0])[1],
      width: (da + db) / 2,
      bank: bank?.kind ?? null,
    });
    sectionEvidence.push({ a, b, bank: bank?.kind ?? null, crest: h, toeWidth: width(mid) });
  }
  for (const b of banks)
    for (const [s, sgn] of [
      [b.start, 1],
      [b.end, -1],
    ]) {
      const h = elevation(A.topRL),
        y = elevation(A.spillwayCrestRL),
        d = deckWidth(s),
        w = width(s),
        f = station(s),
        n = [sgn * f.u[0], 0, sgn * f.u[1]];
      Q(o, 'wall', [point(s, 0, y), point(s, d, y), point(s, d, h), point(s, 0, h)], n);
      T(o, 'wall', [point(s, d, y), point(s, w, 0), point(s, d, h)], n);
    }
  // Close the two abutment ends; no fabricated underground galleries.
  for (const s of [0, pathLength]) {
    const w = width(s),
      d = deckWidth(s),
      h = crest(s),
      f = station(s),
      n = f.u.map((v) => v * (s === 0 ? -1 : 1));
    Q(o, 'wall', [point(s, 0, 0), point(s, w, 0), point(s, d, h), point(s, 0, h)], [n[0], 0, n[1]]);
  }
  // Intrinsic low stilling-basin divider/toe walls, not off-site infrastructure.
  if (lod > 1)
    for (const b of banks)
      for (let j = 0; j <= b.count; j++) {
        const s = b.start + b.pier / 2 + j * (A.gateClearWidth + b.pier),
          N = lod === 2 ? 4 : 9;
        for (let k = 0; k < N; k++) {
          const a = profile(s, k / N, b),
            z = profile(s, (k + 1) / N, b);
          a[1] += 0.38;
          z[1] += 0.38;
          B(o, 'foundation', a, z, 0.55, 0.75);
        }
      }
  if (lod > 1) {
    const N = Math.ceil(pathLength / (lod === 2 ? 15 : 5));
    for (let j = 0; j <= N; j++)
      for (const r of [0.1, 0.9]) {
        const s = (pathLength * j) / N,
          y = elevation(A.topRL),
          d = deckWidth(s);
        B(o, 'rail', point(s, r * d, y), point(s, r * d, y + A.railHeight), 0.09, 0.09);
      }
  }
}
function pier(o, s, w, lod) {
  const a = s - w / 2,
    b = s + w / 2,
    d = Math.min(deckWidth(a), deckWidth(b)),
    y = elevation(A.spillwayCrestRL),
    Y = elevation(A.topRL) - A.deckThickness;
  for (const r of [0, 1]) {
    const f = station(s),
      n = f.n.map((v) => v * (r ? -1 : 1));
    Q(
      o,
      'wall',
      [point(a, r * d, y), point(b, r * d, y), point(b, r * d, Y), point(a, r * d, Y)],
      [n[0], 0, n[1]],
    );
  }
  for (const [t, sgn] of [
    [a, -1],
    [b, 1],
  ]) {
    const f = station(t);
    Q(
      o,
      'wall',
      [point(t, 0, y), point(t, d, y), point(t, d, Y), point(t, 0, Y)],
      [sgn * f.u[0], 0, sgn * f.u[1]],
    );
  }
  if (lod > 0) {
    Q(o, 'wall', [point(a, 0, Y), point(b, 0, Y), point(b, d, Y), point(a, d, Y)], [0, 1, 0]);
  }
}
function gate(o, b, j, lod) {
  const a = b.start + b.pier + j * (A.gateClearWidth + b.pier),
    z = a + A.gateClearWidth,
    s = (a + z) / 2,
    h = b.height,
    y = elevation(A.spillwayCrestRL),
    N = [1, 4, 8, 16][lod],
    f = station(s),
    n = f.n;
  const depth = (t) =>
      2 + A.gateRadius - Math.sqrt(A.gateRadius * A.gateRadius - Math.pow(h * (t - 0.5), 2)),
    P = (t, k, back = 0) => point(k, depth(t) + back, y + h * t);
  for (let i = 0; i < N; i++) {
    const t = i / N,
      T = (i + 1) / N;
    Q(o, 'gate', [P(t, a), P(t, z), P(T, z), P(T, a)], [n[0], 0, n[1]]);
    Q(
      o,
      'gate',
      [
        P(t, a, A.gateThickness),
        P(T, a, A.gateThickness),
        P(T, z, A.gateThickness),
        P(t, z, A.gateThickness),
      ],
      [-n[0], 0, -n[1]],
    );
    if (lod > 0)
      for (const k of [a, z])
        Q(
          o,
          'gate',
          [P(t, k), P(T, k), P(T, k, A.gateThickness), P(t, k, A.gateThickness)],
          [f.u[0] * (k === a ? -1 : 1), 0, f.u[1] * (k === a ? -1 : 1)],
        );
  }
  if (lod > 0)
    for (const t of [0, 1])
      Q(
        o,
        'gate',
        [P(t, a), P(t, a, A.gateThickness), P(t, z, A.gateThickness), P(t, z)],
        [0, t ? 1 : -1, 0],
      );
  // Gate edge shadow is authored depth, with no photograph texture.
  Q(
    o,
    'dark',
    [
      point(a, 1.25, y - 0.12),
      point(z, 1.25, y - 0.12),
      point(z, 1.25, y + 0.04),
      point(a, 1.25, y + 0.04),
    ],
    [n[0], 0, n[1]],
  );
  if (lod > 1) {
    for (const k of [a + 0.8, z - 0.8]) {
      const hinge = point(k, 20, y + h * 0.5);
      for (const t of [0.12, 0.88]) B(o, 'gate', P(t, k, 0.7), hinge, 0.38, 0.5);
    }
    for (let i = 1; i < [0, 0, 4, 9][lod]; i++) {
      const t = i / [1, 1, 4, 9][lod];
      B(o, 'gate', P(t, a, 0.48), P(t, z, 0.48), 0.22, 0.3);
    }
    if (lod > 2)
      for (const k of [a + 4.5, a + 9.15, a + 13.8])
        for (let i = 0; i < N; i++)
          B(o, 'gate', P(i / N, k, 0.5), P((i + 1) / N, k, 0.5), 0.15, 0.2);
  }
  gateEvidence.push({
    kind: b.kind,
    index: j,
    a,
    b: z,
    center: s,
    clearWidth: A.gateClearWidth,
    height: h,
    baseRL: A.spillwayCrestRL,
    topRL: A.spillwayCrestRL + h,
    profileSegments: N,
    frontMid: toWorld(P(0.5, s)),
  });
}
export function buildSardarSarovarDam(target, _frame, lod = 3) {
  for (const a of [partEvidence, nativeEvidence, gateEvidence, sectionEvidence, bridgeEvidence])
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
  part('whole-thirty-four-control-intrinsic-dam-apron', () => apron(o));
  part('actual-curved-gravity-body-ogee-abutments-and-continuous-crest-bridge', () =>
    mainBody(o, lod),
  );
  part('all-thirty-radial-gates-and-their-physical-piers', () => {
    for (const b of banks) {
      for (let j = 0; j <= b.count; j++)
        pier(o, b.start + b.pier / 2 + j * (A.gateClearWidth + b.pier), b.pier, lod);
      for (let j = 0; j < b.count; j++) gate(o, b, j, lod);
    }
  });
}
export const sardarSarovarDamSkyline = (o) => buildSardarSarovarDam(o, null, 0),
  sardarSarovarDamDistrict = (o) => buildSardarSarovarDam(o, null, 1),
  sardarSarovarDamStreet = (o) => buildSardarSarovarDam(o, null, 2),
  sardarSarovarDamCloseup = (o) => buildSardarSarovarDam(o, null, 3);
const cam = (u, y, v) => toWorld([U[0] * u + V[0] * v, y, U[1] * u + V[1] * v]);
export const sardarSarovarDamModel = {
  id: 'sardar_sarovar_dam',
  key: 'sardar_sarovar_dam',
  cell: 'te/teu',
  title: 'Sardar Sarovar Dam',
  wikidataId: 'Q2120392',
  category: 'dam',
  recipe: 'sardar-sarovar-dam-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildSardarSarovarDam,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole main Sardar Sarovar concrete gravity dam: actual34-control native physical perimeter and curved upstreamedge,23service plus7auxiliary radialgates, real openings between tallpiers, continuous9.14m nominalcrestbridge, slopingogee/chutes and intrinsicapron/dividers/abutments. Currentprimary121.92spillway/146.50top elevations; exactpublished2006ownPD concreteprofile photo first, currentinstalledgate/bridge profiles and bankchainages are bounded originalengineering estimates. Separateproject/powerhouses/reservoir/dykes/tempworks excluded.',
  camera: cam(-950, 720, -1700),
  lookAt: cam(0, 40, 50),
  portableGroundY: F - 0.8,
  mediumFiContext: { cameraYaw: -1.2, groundY: F - 0.8, scale: 12 },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'concrete_boardformed',
    'metal_painted',
    'metal_stainless',
  ],
  qaCameras: [
    {
      name: 'whole-curved-dam-thirty-gates-and-intrinsic-stilling-apron',
      position: cam(-850, 700, -1550),
      lookAt: cam(0, 45, 30),
    },
    {
      name: 'whole-native-thirty-four-control-plan',
      position: cam(0, 2200, 0.1),
      lookAt: cam(0, 20, 0),
    },
    {
      name: 'service-radial-gates-piers-crestbridge-and-ogee',
      position: point(760, 260, elevation(A.topRL) + 100),
      lookAt: point(760, 6, elevation(130)),
    },
    {
      name: 'auxiliary-seven-bay-spillway-and-stilling-basin',
      position: point(380, 550, elevation(A.topRL) + 160),
      lookAt: point(390, 40, elevation(115)),
    },
    {
      name: 'upstream-gate-plates-and-complete-crest',
      position: cam(700, 650, 1600),
      lookAt: cam(20, 55, 80),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/sardar-sarovar-dam-runtime-overlay.mjs',
    level: 'skyline',
    export: 'sardarSarovarDamSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'sardarSarovarDamDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'sardarSarovarDamStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'sardarSarovarDamCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Only exact published AceFighter19 PD-self2006original used: concreteprofile evidence predates completed2017gates/bridge; no temporarycranes/cables/rebar or protectedmodernphoto pixels copied. Currentgateprofile/finish, bankchainages and finehidden details are original bounded engineering estimates, not survey or photogrammetry. All30closedgates retained at allfourLODs; fine ribs/rails simplified withdistance.',
    '163m is greatestheight above deepestfoundation, not exposedheight aboveground. No fictitious underground chambers/powerplant or water surface. Intrinsic footprint is physicalmain dam, not entireprojectrelation.',
    'Original independentfield contains severe negative reservoir artifacts, retainedunchanged; source has no surveyedprovider-to-localRL tie. Contactunverified/previewonly/replacementfalse. Flatground and syntheticneighbors in captures are reviewfixtures.',
  ],
};
