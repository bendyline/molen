/** Whole native Victoria Bridge deck, haunched concrete envelope and original flared supports. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
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
    architecturalSections: A,
  } = p.parameters;
const C = {
  concrete: rgb('dedbcf'),
  edge: rgb('eeeadd'),
  soffit: rgb('c9c8bb'),
  road: rgb('555e5e'),
  cycle: rgb('668d82'),
  white: rgb('e8e6d8'),
  metal: rgb('ced6d0'),
  dark: rgb('58645f'),
};
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.67, metallic: 0.14 },
  surface: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    roughness: 0.94,
    metallic: 0,
    alphaMode: 'OPAQUE',
  },
};
export const nativeEvidence = [],
  pierEvidence = [],
  railEvidence = [],
  lampEvidence = [],
  deckEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  clamp = (x) => Math.max(0, Math.min(1, x)),
  mix = (a, b, t) => a + (b - a) * t;
export const toWorld = (q) => [
    O[0] + U[0] * q[0] + V[0] * q[2],
    F + q[1],
    O[1] + U[1] * q[0] + V[1] * q[2],
  ],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
const R = frame.geometry.outline
    .slice(0, -1)
    .map(([x, z]) => [
      (x - O[0]) * U[0] + (z - O[1]) * U[1],
      (x - O[0]) * V[0] + (z - O[1]) * V[1],
    ]),
  S0 = Math.min(...R.map((q) => q[0])),
  S1 = Math.max(...R.map((q) => q[0]));
export function boundsAt(s) {
  const values = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    if (Math.abs(a[0] - s) < 1e-7) values.push(a[1]);
    if (s > Math.min(a[0], b[0]) + 1e-8 && s < Math.max(a[0], b[0]) - 1e-8)
      values.push(mix(a[1], b[1], (s - a[0]) / (b[0] - a[0])));
  }
  if (!values.length) throw Error(`Uncovered native deck station ${s}`);
  return [Math.min(...values), Math.max(...values)];
}
export function deckProfile(s) {
  const t = clamp(s / L);
  return A.northEndRise * t + A.camberRise * 4 * t * (1 - t);
}
export function deckY(s, z) {
  const b = boundsAt(s),
    c = (b[0] + b[1]) / 2;
  return deckProfile(s) - A.crossfall * (z - c);
}
export function girderDepth(s) {
  const stations = [A.structuralStart, ...A.pierStations, A.structuralEnd],
    depth = [A.endGirderDepth, A.haunchDepth, A.haunchDepth, A.endGirderDepth];
  if (s <= stations[0]) return depth[0];
  if (s >= stations.at(-1)) return depth.at(-1);
  const j = stations.findIndex((v, i) => i < 3 && s >= v && s <= stations[i + 1]),
    t = (s - stations[j]) / (stations[j + 1] - stations[j]),
    sag = (depth[j] + depth[j + 1]) / 2 - A.midspanDepth;
  return mix(depth[j], depth[j + 1], t) - sag * 4 * t * (1 - t);
}
function T(o, k, q, n, col = C.concrete) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
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
function B(o, k, a, b, w, d, col = C.metal) {
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function prism(o, k, r, y0, y1, col) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  for (let i = 1; i < r.length - 1; i++) {
    T(
      o,
      k,
      [
        [r[0][0], y0, r[0][1]],
        [r[i][0], y0, r[i][1]],
        [r[i + 1][0], y0, r[i + 1][1]],
      ],
      [0, -1, 0],
      col,
    );
    T(
      o,
      k,
      [
        [r[0][0], y1, r[0][1]],
        [r[i][0], y1, r[i][1]],
        [r[i + 1][0], y1, r[i + 1][1]],
      ],
      [0, 1, 0],
      col,
    );
  }
}
const unique = (a) => a.sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 1e-6);
const stationsFor = (lod) => {
  const N = [6, 14, 52, 96][lod];
  return unique([
    ...R.map((q) => q[0]),
    ...Array.from({ length: N + 1 }, (_, i) => mix(S0, S1, i / N)),
    ...A.pierStations,
    A.structuralStart,
    A.structuralEnd,
  ]);
};
const transverse = (s, u) => {
  const [a, b] = boundsAt(s);
  return mix(a, b, u);
};
function deck(o, lod) {
  const ss = stationsFor(lod),
    bands =
      lod === 0
        ? [[0, 1, 'surface', C.road, 0]]
        : [
            [0, 0.14, 'concrete', C.edge, 0.15],
            [0.14, 0.16, 'concrete', C.edge, A.kerbHeight],
            [0.16, 0.6, 'surface', C.road, 0],
            [0.6, 0.62, 'concrete', C.edge, A.kerbHeight],
            [0.62, 0.77, 'surface', C.cycle, 0.025],
            [0.77, 0.79, 'concrete', C.edge, A.kerbHeight],
            [0.79, 1, 'concrete', C.edge, 0.15],
          ],
    P = (s, u, h = 0) => {
      const z = transverse(s, u);
      return [s, deckY(s, z) + h, z];
    };
  for (let j = 0; j < ss.length - 1; j++) {
    const a = ss[j],
      b = ss[j + 1];
    for (const [u, v, k, col, h] of bands)
      Q(o, k, [P(a, u, h), P(b, u, h), P(b, v, h), P(a, v, h)], [0, 1, 0], col);
    for (const [u, sign] of [
      [0, -1],
      [1, 1],
    ]) {
      const h = lod === 0 ? 0 : 0.15;
      Q(
        o,
        'concrete',
        [P(a, u, h), P(b, u, h), P(b, u, -A.slabThickness), P(a, u, -A.slabThickness)],
        [0, 0, sign],
        C.concrete,
      );
    }
    Q(
      o,
      'concrete',
      [
        P(a, 0, -A.slabThickness),
        P(b, 0, -A.slabThickness),
        P(b, 1, -A.slabThickness),
        P(a, 1, -A.slabThickness),
      ],
      [0, -1, 0],
      C.soffit,
    );
    if (lod > 0)
      for (let i = 0; i < bands.length - 1; i++) {
        const h = bands[i][4],
          H = bands[i + 1][4],
          u = bands[i][1];
        if (h !== H)
          Q(
            o,
            'concrete',
            [P(a, u, h), P(b, u, h), P(b, u, H), P(a, u, H)],
            [0, 0, Math.sign(h - H)],
            C.edge,
          );
      }
  }
  for (const q of R) nativeEvidence.push([q[0], deckY(...q) + (lod === 0 ? 0 : 0.15), q[1]]);
  deckEvidence.push({
    nativeControls: 34,
    stations: ss.length,
    fullNativeRange: [S0, S1],
    bands: bands.map(([a, b]) => [a, b]),
    nominalStructuralLength: A.structuralEnd - A.structuralStart,
    currentBusLanes: 3,
    currentCyclewayBidirectional: true,
    exactCurrentLayoutVerified: false,
  });
}
function girder(o, lod) {
  const a = 0.6,
    b = L - 0.6,
    ss = unique([a, b, ...stationsFor(lod).filter((s) => s > a && s < b)]);
  const ring = (s) => {
    const [l, r] = boundsAt(s),
      d = girderDepth(s),
      lo = mix(l, r, 0.045),
      hi = mix(l, r, 0.955),
      bottom = deckProfile(s) - A.slabThickness - d;
    return [
      [s, deckY(s, lo) - A.slabThickness + 0.015, lo],
      [s, deckY(s, hi) - A.slabThickness + 0.015, hi],
      [s, bottom, mix(l, r, 0.86)],
      [s, bottom, mix(l, r, 0.14)],
    ];
  };
  for (let j = 0; j < ss.length - 1; j++) {
    const a = ring(ss[j]),
      b = ring(ss[j + 1]);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4,
        n = i === 0 ? [0, 1, 0] : i === 1 ? [0, -0.2, 1] : i === 2 ? [0, -1, 0] : [0, -0.2, -1];
      Q(o, 'concrete', [a[i], b[i], b[k], a[k]], n, i === 2 ? C.soffit : C.concrete);
    }
  }
  for (const [s, sgn] of [
    [a, -1],
    [b, 1],
  ])
    Q(o, 'concrete', ring(s), [sgn, 0, 0], C.concrete);
  if (lod > 1)
    for (let s = 10; s < 315; s += lod === 2 ? 12 : 5.5) {
      const [l, r] = boundsAt(s),
        y = deckProfile(s) - A.slabThickness - girderDepth(s) + 0.012;
      B(o, 'concrete', [s, y, mix(l, r, 0.15)], [s, y, mix(l, r, 0.85)], 0.035, 0.035, C.soffit);
    }
}
function chamfered(s, z, x, Z, c, lod) {
  if (lod === 0)
    return [
      [s - x, z - Z],
      [s + x, z - Z],
      [s + x, z + Z],
      [s - x, z + Z],
    ];
  return [
    [s - x + c, z - Z],
    [s + x - c, z - Z],
    [s + x, z - Z + c],
    [s + x, z + Z - c],
    [s + x - c, z + Z],
    [s - x + c, z + Z],
    [s - x, z + Z - c],
    [s - x, z - Z + c],
  ];
}
function supports(o, lod) {
  for (const s of A.pierStations) {
    const [l, r] = boundsAt(s),
      z = (l + r) / 2,
      top = deckProfile(s) - A.slabThickness - girderDepth(s) + 0.04,
      profile = [
        [A.pierBase, A.pierBaseHalfLength, A.pierBaseHalfWidth],
        [top - A.pierFlareHeight, A.pierNeckHalfLength, A.pierNeckHalfWidth],
        [top, A.pierHeadHalfLength, A.pierHeadHalfWidth],
      ],
      rings = profile.map(([y, x, Z]) =>
        chamfered(s, z, x, Z, lod === 0 ? 0 : 0.6, lod).map((q) => [q[0], y, q[1]]),
      );
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < rings[j].length; i++) {
        const k = (i + 1) % rings[j].length,
          a = rings[j],
          b = rings[j + 1],
          m = [
            (a[i][0] + a[k][0] + b[i][0] + b[k][0]) / 4,
            0,
            (a[i][2] + a[k][2] + b[i][2] + b[k][2]) / 4,
          ];
        Q(o, 'concrete', [a[i], a[k], b[k], b[i]], [m[0] - s, 0, m[2] - z], C.concrete);
      }
    for (const [j, sgn] of [
      [0, -1],
      [rings.length - 1, 1],
    ])
      for (let i = 1; i < rings[j].length - 1; i++)
        T(o, 'concrete', [rings[j][0], rings[j][i], rings[j][i + 1]], [0, sgn, 0], C.concrete);
    if (lod > 1) {
      const r = chamfered(s, z, A.pierBaseHalfLength + 0.22, A.pierBaseHalfWidth + 0.22, 0.6, lod);
      prism(o, 'concrete', r, A.pierBase, A.pierBase + 0.35, C.soffit);
    }
    pierEvidence.push({
      station: s,
      centerZ: z,
      base: A.pierBase,
      top,
      neck: top - A.pierFlareHeight,
      photoEstimated: true,
      nativeMapped: false,
      headHalfLength: A.pierHeadHalfLength,
      headHalfWidth: A.pierHeadHalfWidth,
    });
  }
  for (const s of A.abutmentStations) {
    const [l, r] = boundsAt(s),
      rr = chamfered(s, (l + r) / 2, 1.8, (r - l) / 2 - 0.5, 0.2, 0),
      top = deckProfile(s) - A.slabThickness - girderDepth(s) + 0.12;
    prism(o, 'concrete', rr, A.pierBase, top, C.soffit);
    if (lod > 0)
      prism(
        o,
        'concrete',
        chamfered(s, (l + r) / 2, 2.2, (r - l) / 2 - 0.25, 0.2, 0),
        top - 0.32,
        top + 0.12,
        C.concrete,
      );
  }
}
function railPoint(s, sign, height = 0) {
  const u = sign < 0 ? 0.008 : 0.992,
    z = transverse(s, u);
  return [s, deckY(s, z) + 0.15 + height, z];
}
function rails(o, lod) {
  const N = [7, 18, 50, 90][lod],
    posts = [3, 20, 94, 150][lod],
    s0 = 1.5,
    s1 = L - 0.5;
  for (const sign of [-1, 1]) {
    const levels =
      lod === 0 ? [A.railHeight] : lod === 1 ? [0.22, A.railHeight] : [0.2, 0.63, A.railHeight];
    for (const h of levels)
      for (let i = 0; i < N; i++) {
        const a = mix(s0, s1, i / N),
          b = mix(s0, s1, (i + 1) / N);
        B(
          o,
          'metal',
          railPoint(a, sign, h),
          railPoint(b, sign, h),
          h === A.railHeight ? 0.095 : 0.055,
          0.07,
          C.metal,
        );
      }
    for (let i = 0; i <= posts; i++) {
      const s = mix(s0, s1, i / posts);
      B(
        o,
        'metal',
        railPoint(s, sign, 0),
        railPoint(s, sign, A.railHeight),
        lod === 0 ? 0.15 : 0.09,
        0.12,
        C.metal,
      );
      if (lod > 1) {
        const infill = lod === 2 ? 2 : 5;
        for (let j = 1; j <= infill && i < posts; j++) {
          const t = mix(s, mix(s0, s1, (i + 1) / posts), j / (infill + 1));
          B(
            o,
            'metal',
            railPoint(t, sign, 0.17),
            railPoint(t, sign, A.railHeight - 0.07),
            lod === 2 ? 0.035 : 0.026,
            0.035,
            C.metal,
          );
        }
      }
    }
    railEvidence.push({ sign, posts: posts + 1, height: A.railHeight, openInfill: true });
  }
}
function markings(o, lod) {
  if (lod === 0) return;
  const patch = (a, b, u, width, col) => {
    const P = (s, u) => {
      const z = transverse(s, u);
      return [s, deckY(s, z) + 0.035, z];
    };
    Q(
      o,
      'surface',
      [P(a, u - width / 2), P(b, u - width / 2), P(b, u + width / 2), P(a, u + width / 2)],
      [0, 1, 0],
      col,
    );
  };
  for (const u of [
    A.busBand[0] + (A.busBand[1] - A.busBand[0]) / 3,
    A.busBand[0] + (2 * (A.busBand[1] - A.busBand[0])) / 3,
  ])
    for (let s = 9; s < 312; s += 8) patch(s, Math.min(s + 3.3, 315), u, 0.004, C.white);
  for (let s = 8; s < 314; s += 8)
    patch(s, s + 4.2, (A.cycleBand[0] + A.cycleBand[1]) / 2, 0.003, C.white);
  if (lod > 1)
    for (const s of [35, 112, 205, 281])
      for (let i = 0; i < 3; i++) {
        const u = A.busBand[0] + ((A.busBand[1] - A.busBand[0]) * (i + 0.5)) / 3,
          P = (s, u) => {
            const z = transverse(s, u);
            return [s, deckY(s, z) + 0.038, z];
          };
        Q(
          o,
          'surface',
          [
            P(s - 1.5, u - 0.004),
            P(s + 0.4, u - 0.004),
            P(s + 0.4, u + 0.004),
            P(s - 1.5, u + 0.004),
          ],
          [0, 1, 0],
          C.white,
        );
        T(
          o,
          'surface',
          [P(s + 0.1, u - 0.017), P(s + 1.4, u), P(s + 0.1, u + 0.017)],
          [0, 1, 0],
          C.white,
        );
      }
}
function tube(o, a, b, r, R, N) {
  const axis = sub(b, a),
    len = Math.hypot(...axis),
    v = axis.map((x) => x / len),
    u = [1, 0, 0],
    w = cross(v, u),
    wl = Math.hypot(...w),
    W = w.map((v) => v / wl),
    Qv = cross(W, v),
    ring = (c, r) =>
      Array.from({ length: N }, (_, i) => {
        const t = (i * Math.PI * 2) / N;
        return c.map((q, j) => q + Qv[j] * r * Math.cos(t) + W[j] * r * Math.sin(t));
      }),
    aa = ring(a, r),
    bb = ring(b, R);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    Q(o, 'metal', [aa[i], aa[j], bb[j], bb[i]], sub(aa[i], a), C.metal);
  }
  for (let i = 1; i < N - 1; i++) {
    T(
      o,
      'metal',
      [aa[0], aa[i], aa[i + 1]],
      v.map((x) => -x),
      C.metal,
    );
    T(o, 'metal', [bb[0], bb[i], bb[i + 1]], v, C.metal);
  }
}
function lamps(o, lod) {
  const count = [0, 3, 7, 9][lod],
    N = [4, 4, 8, 12][lod];
  for (const sign of [-1, 1])
    for (let i = 0; i < count; i++) {
      const s = 25 + ((L - 50) * (i + 0.5)) / count,
        z = transverse(s, sign < 0 ? 0.07 : 0.93),
        base = deckY(s, z) + 0.15,
        a = [s, base, z],
        b = [s, base + A.lampHeight, z],
        c = [s, base + A.lampHeight + 0.3, z - sign * 1.45];
      tube(o, a, b, 0.095, 0.06, N);
      B(o, 'metal', b, c, 0.08, 0.09, C.metal);
      B(o, 'metal', c, [s, base + A.lampHeight + 0.3, z - sign * 2.2], 0.32, 0.15, C.dark);
      lampEvidence.push({
        station: s,
        side: sign,
        base,
        height: A.lampHeight,
        originalCurrentDetailEstimate: true,
      });
    }
}
export function buildVictoriaBridgeBrisbane(o, _frame, lod = 3) {
  for (const q of [nativeEvidence, pierEvidence, railEvidence, lampEvidence, deckEvidence])
    q.length = 0;
  deck(o, lod);
  girder(o, lod);
  supports(o, lod);
  rails(o, lod);
  markings(o, lod);
  lamps(o, lod);
}
export const victoriaBridgeBrisbaneSkyline = (o) => buildVictoriaBridgeBrisbane(o, null, 0),
  victoriaBridgeBrisbaneDistrict = (o) => buildVictoriaBridgeBrisbane(o, null, 1),
  victoriaBridgeBrisbaneStreet = (o) => buildVictoriaBridgeBrisbane(o, null, 2),
  victoriaBridgeBrisbaneCloseup = (o) => buildVictoriaBridgeBrisbane(o, null, 3);
export const victoriaBridgeBrisbaneModel = {
  id: 'victoria_bridge_brisbane',
  key: 'victoria_bridge_brisbane',
  cell: 'r7/r7h',
  title: 'Victoria Bridge, Brisbane',
  wikidataId: 'Q7926597',
  category: p.category,
  recipe: 'victoria-bridge-brisbane-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildVictoriaBridgeBrisbane,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole current1969Victoria Bridge on exact34-control deck/approach outline: long cambered concrete deck/integral flares, closed tapered haunched box-girder exterior/three structural spans/two original photo-estimated flared bladepiers/modern endabutments, true open physical edge rails/kerbs/light standards and original simplified3buslane/bidirectionalcyclepath/widerwalk surfacing. Two cleared published2009creatorPD Qualla originals first/only imagery; current use corroborated by Council/structuralengineer factual text. Primary313m nominal core retained within longer native integral approaches. Exact deck/pier sections/hiddenfoundations/postrefurbbarriers/finish/currentlayout original estimates. Original sourcefield retained including invalid riverbed outliers, contactunverified/preview.',
  camera: [235, 90, 280],
  lookAt: [0, F + 1.5, 0],
  portableGroundY: F - 8.2,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 8.1 },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-opposite-three-spans-and-integral-approaches',
      position: [-260, 95, -295],
      lookAt: [0, F + 2, 0],
    },
    {
      name: 'haunched-box-soffit-and-two-flared-river-piers',
      position: toWorld([160, 1, 220]),
      lookAt: toWorld([160, 2, 0]),
    },
    {
      name: 'photo-estimated-blade-pier-neck-head-and-soffit',
      position: toWorld([84.5, -1, 45]),
      lookAt: toWorld([84.5, 0, 0]),
    },
    {
      name: 'three-bus-lanes-cycleway-walks-open-rails',
      position: toWorld([145, 40, 44]),
      lookAt: toWorld([165, 6.5, 0]),
    },
    {
      name: 'native-northeast-approach-flare-kerbs-and-lighting',
      position: toWorld([304, 30, -48]),
      lookAt: toWorld([303, 3, -1]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/victoria-bridge-brisbane-runtime-overlay.mjs',
    level: 'skyline',
    export: 'victoriaBridgeBrisbaneSkyline',
    errorMeters: 2.4,
    surfaces,
    authoredLevels: {
      district: { export: 'victoriaBridgeBrisbaneDistrict', errorMeters: 0.85, surfaces },
      street: { export: 'victoriaBridgeBrisbaneStreet', errorMeters: 0.22, surfaces },
      closeup: { export: 'victoriaBridgeBrisbaneCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Exact cleared published2009Figaro ownPD-self structural-side and Fairfieldstation own/all-rights-waived/PD-self elevatedapproach originals individually inspected/nativeSHA1matched; unchanged published guard passed. Entropyview-away/oldtruss/uncertainhistoricals excluded; no supplementals/source-or-rightsrepair/policychange/samephotobypass/copiedpixels. Original shell/camber/haunch/piers supported by these photographs; current3buslanes/bicyclepath/walks factual, exactcurrentsmallbarriers/lights/paint and hiddenunderside/footings original estimates. No operationalclearance/loadcapacity/bathymetry/survey/currenttrafficlayout certification. Oldabutment/adjacentbridges/station/vehicles/city/river/temporarywork/art/signs excluded.',
    'Original independent600m129field/one rawtile/SW14.1746m provider-relative datum frozen before floor/deck/haunch/pier choices. Once-only nativeSW7.0174/NE9.796m samples/floor-7.1572m/NErise2.7786/camber6.2m all chosen BEFORE geometry. Field includes extreme negative urban/river samples-437.4038m; not accepted as surveyedbed/waterline/foundation. No terrainfit/flatten/reacquire/reframe/retunedendlevels/modelraise. Geographic preview/replaceFootprintfalse/exactgradecontactunresolved. Flatground/syntheticneighbors are reviewfixtures.',
  ],
};
