/** Whole Dona Ana railway bridge, paired polygonal trusses and both full native approaches. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ku/kub/dona_ana_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  D = p.parameters.deckY,
  L = p.mainLengthMeters,
  mid = p.mainLine[0].map((v, i) => (v + p.mainLine[1][i]) / 2),
  c = (p.mainLine[1][0] - p.mainLine[0][0]) / L,
  s = (p.mainLine[1][1] - p.mainLine[0][1]) / L,
  rotate = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  world = (q) => {
    const v = rotate(q);
    return [v[0] + mid[0], v[1], v[2] + mid[1]];
  },
  local = (q) => [
    c * (q[0] - mid[0]) + s * (q[1] - mid[1]),
    -s * (q[0] - mid[0]) + c * (q[1] - mid[1]),
  ],
  line = p.line.map(local),
  C = {
    steel: rgb('7c8072'),
    concrete: rgb('b4b4a6'),
    ballast: rgb('7e8278'),
    wood: rgb('827258'),
  },
  surfaces = {
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.12 },
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    ballast: { slot: 'roof', localRef: 'palette:#fffffe', roughness: 1, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = rotate(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((t, v, i) => t + v * n[i], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function box(o, k, x0, x1, y0, y1, z0, z1, col = C[k]) {
  const a = [x0, y0, z0],
    b = [x1, y0, z0],
    cc = [x1, y1, z0],
    d = [x0, y1, z0],
    e = [x0, y0, z1],
    f = [x1, y0, z1],
    g = [x1, y1, z1],
    h = [x0, y1, z1];
  for (const [q, n] of [
    [
      [a, d, cc, b],
      [0, 0, -1],
    ],
    [
      [e, f, g, h],
      [0, 0, 1],
    ],
    [
      [a, b, f, e],
      [0, -1, 0],
    ],
    [
      [d, h, g, cc],
      [0, 1, 0],
    ],
    [
      [a, e, h, d],
      [-1, 0, 0],
    ],
    [
      [b, cc, g, f],
      [1, 0, 0],
    ],
  ])
    Q(o, k, q, n, col);
}
function ribbon(o, k, a, b, w, n, col = C[k]) {
  if (Math.hypot(...sub(b, a)) < 1e-7) return;
  const u = unit(cross(n, sub(b, a))).map((v) => (v * w) / 2),
    q = [
      a.map((v, i) => v + u[i]),
      b.map((v, i) => v + u[i]),
      b.map((v, i) => v - u[i]),
      a.map((v, i) => v - u[i]),
    ];
  Q(o, k, q, n, col);
  Q(
    o,
    k,
    q.toReversed(),
    n.map((v) => -v),
    col,
  );
}
function bar(o, k, a, b, w, depth, n, col = C[k], caps = true) {
  if (Math.hypot(...sub(b, a)) < 1e-7) return;
  const u = unit(sub(b, a)),
    v = unit(cross(n, u)),
    z = cross(u, v),
    ring = (q) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => q.map((x, k) => x + (v[k] * i * w + z[k] * j * depth) / 2)),
    R = [ring(a), ring(b)];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      nn = R[0][i].map((v, k) => v - a[k]);
    Q(o, k, [R[0][i], R[0][j], R[1][j], R[1][i]], nn, col);
  }
  if (caps) {
    Q(
      o,
      k,
      R[0],
      u.map((v) => -v),
      col,
    );
    Q(o, k, R[1], u, col);
  }
}
const lengths = [
    ...Array(A.shortSpanCount).fill(A.shortSpanMeters),
    ...Array(A.longSpanCount).fill(A.longSpanMeters),
  ],
  slack = (L - lengths.reduce((s, n) => s + n, 0)) / 2,
  stations = lengths.reduce(
    (a, n) => {
      a.push(a.at(-1) + n);
      return a;
    },
    [-L / 2 + slack],
  ),
  top = (t, H) =>
    H *
    (t <= 0.125
      ? (t / 0.125) * 0.85
      : t >= 0.875
        ? ((1 - t) / 0.125) * 0.85
        : t <= 0.5
          ? 0.85 + ((t - 0.125) / 0.375) * 0.27
          : 0.85 + ((0.875 - t) / 0.375) * 0.27);
function member(o, k, a, b, width, n, d, col = C[k]) {
  if (d < 3) ribbon(o, k, a, b, width, n, col);
  else bar(o, k, a, b, width, width, n, col);
}
function trusses(o, d) {
  for (let i = 0; i < lengths.length; i++) {
    const x0 = stations[i] + 0.28,
      B = lengths[i] - 0.56,
      H = i < A.shortSpanCount ? A.shortTrussHeight : A.longTrussHeight,
      profile =
        d === 0
          ? [0, 0.2, 0.8, 1]
          : d === 1
            ? [0, 0.25, 0.75, 1]
            : d === 2
              ? [0, 0.125, 0.5, 0.875, 1]
              : Array.from({ length: 9 }, (_, j) => j / 8),
      zs = d === 0 ? [0] : [-A.trussSpacing / 2, A.trussSpacing / 2];
    for (const z of zs) {
      const point = (t, h = top(t, H)) => [x0 + B * t, D + 0.22 + h, z];
      for (let j = 0; j < profile.length - 1; j++) {
        const a = point(profile[j]),
          b = point(profile[j + 1]);
        if (d === 2) bar(o, 'steel', a, b, A.chordWidth, A.chordWidth, [0, 0, 1], C.steel, false);
        else member(o, 'steel', a, b, d < 2 ? 0.4 : A.chordWidth, [0, 0, 1], d);
      }
      if (d === 2) bar(o, 'steel', point(0, 0), point(1, 0), 0.26, 0.26, [0, 0, 1], C.steel, false);
      else member(o, 'steel', point(0, 0), point(1, 0), 0.3, [0, 0, 1], d);
      if (d > 0) {
        const N = d === 1 ? 2 : 8;
        for (let j = 1; j < N; j++)
          member(o, 'steel', point(j / N, 0), point(j / N), A.memberWidth, [0, 0, 1], d);
        for (let j = 0; j < N; j++) {
          const a = j < N / 2 ? point(j / N, 0) : point(j / N),
            b = j < N / 2 ? point((j + 1) / N) : point((j + 1) / N, 0);
          member(o, 'steel', a, b, d === 1 ? 0.24 : 0.17, [0, 0, 1], d);
        }
      }
    }
    if (d > 1) {
      const N = d === 2 ? 4 : 8;
      for (let j = 1; j < N; j++) {
        const t = j / N,
          x = x0 + B * t,
          y = D + 0.22 + top(t, H);
        member(
          o,
          'steel',
          [x, y, -A.trussSpacing / 2],
          [x, y, A.trussSpacing / 2],
          0.18,
          [0, 1, 0],
          d,
        );
        if (j < N - 1) {
          const xx = x0 + (B * (j + 1)) / N,
            yy = D + 0.22 + top((j + 1) / N, H);
          for (const sg of [-1, 1])
            member(
              o,
              'steel',
              [x, y, (sg * A.trussSpacing) / 2],
              [xx, yy, (-sg * A.trussSpacing) / 2],
              0.12,
              [0, 1, 0],
              d,
            );
        }
      }
      for (const t of [0.125, 0.875])
        bar(
          o,
          'steel',
          [x0 + B * t, D + 0.22 + top(t, H), -A.trussSpacing / 2],
          [x0 + B * t, D + 0.22 + top(t, H), A.trussSpacing / 2],
          0.3,
          0.36,
          [0, 1, 0],
        );
      for (const t of [0.2, 0.4, 0.6, 0.8])
        member(
          o,
          'steel',
          [x0 + B * t, D - 0.38, -A.deckWidth / 2],
          [x0 + B * t, D - 0.38, A.footwayCenter + A.footwayWidth / 2],
          0.3,
          [0, 1, 0],
          d,
        );
    }
  }
}
function pier(o, x, z, d) {
  if (d === 0)
    ribbon(o, 'concrete', [x, A.pierBottom, z], [x, D - 0.72, z], A.pierWidth, [0, 0, 1]);
  else {
    box(
      o,
      'concrete',
      x - A.pierWidth / 2,
      x + A.pierWidth / 2,
      A.pierBottom,
      D - 0.9,
      z - A.pierDepth / 2,
      z + A.pierDepth / 2,
    );
    if (d > 1)
      box(
        o,
        'concrete',
        x - A.pierWidth / 2 - 0.32,
        x + A.pierWidth / 2 + 0.32,
        D - 1.0,
        D - 0.6,
        z - A.pierDepth / 2 - 0.18,
        z + A.pierDepth / 2 + 0.18,
      );
  }
}
function deckSegment(o, a, b, d, main = false) {
  const u = unit([b[0] - a[0], 0, b[1] - a[1]]),
    v = [-u[2], 0, u[0]],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    point = (t, y, z = 0) => [
      a[0] + (b[0] - a[0]) * t + v[0] * z,
      y,
      a[1] + (b[1] - a[1]) * t + v[2] * z,
    ];
  bar(
    o,
    'steel',
    point(0, D - A.deckThickness / 2, d === 0 ? 0.55 : 0),
    point(1, D - A.deckThickness / 2, d === 0 ? 0.55 : 0),
    d === 0 ? 6.8 : A.deckWidth,
    A.deckThickness,
    [0, 1, 0],
  );
  if (d > 0) {
    bar(o, 'ballast', point(0, D + 0.04), point(1, D + 0.04), A.deckWidth - 0.5, 0.1, [0, 1, 0]);
    bar(
      o,
      'steel',
      point(0, D - 0.05, A.footwayCenter),
      point(1, D - 0.05, A.footwayCenter),
      A.footwayWidth,
      0.15,
      [0, 1, 0],
    );
  }
  if (d > 0) {
    for (const sg of [-1, 1])
      bar(
        o,
        'steel',
        point(0, D + 0.21, (sg * A.railGauge) / 2),
        point(1, D + 0.21, (sg * A.railGauge) / 2),
        0.08,
        0.14,
        [0, 1, 0],
        rgb('535950'),
      );
    for (const y of [D + 0.12, D + 1.15]) {
      if (d === 1)
        ribbon(
          o,
          'steel',
          point(0, y, A.footwayCenter + A.footwayWidth / 2),
          point(1, y, A.footwayCenter + A.footwayWidth / 2),
          0.07,
          [0, 0, 1],
        );
      else
        bar(
          o,
          'steel',
          point(0, y, A.footwayCenter + A.footwayWidth / 2),
          point(1, y, A.footwayCenter + A.footwayWidth / 2),
          0.065,
          0.065,
          [0, 1, 0],
        );
    }
    if (d > 1) {
      const N = Math.ceil(len / (d === 2 ? 20 : 8));
      for (let j = 0; j <= N; j++)
        member(
          o,
          'steel',
          point(j / N, D + 0.1, A.footwayCenter + A.footwayWidth / 2),
          point(j / N, D + 1.17, A.footwayCenter + A.footwayWidth / 2),
          0.06,
          [1, 0, 0],
          d,
        );
      const count = Math.ceil(len / (d === 2 ? 20 : 5));
      for (let j = 0; j < count; j++)
        bar(
          o,
          'wood',
          point((j + 0.5) / count, D + 0.115, -1.08),
          point((j + 0.5) / count, D + 0.115, 1.08),
          0.18,
          0.14,
          u,
        );
    }
  }
  if (!main) {
    const N = Math.ceil(len / (d === 0 ? 100 : A.approachPierPitch));
    for (let j = 0; j < N; j++) {
      const q = point(j / N, 0);
      pier(o, q[0], q[2], d);
    }
  }
}
function build(o, _frame, d = 3) {
  trusses(o, d);
  for (let i = 0; i < line.length - 1; i++)
    deckSegment(o, line[i], line[i + 1], d, i === line.length - 3);
  for (const x of stations) pier(o, x, 0, d);
  for (const q of [line[0], line.at(-1)])
    box(o, 'concrete', q[0] - 3, q[0] + 3, A.pierBottom, D - 0.7, q[1] - 4, q[1] + 4);
}
export const donaAnaSkyline = (o, f) => build(o, f, 0),
  donaAnaDistrict = (o, f) => build(o, f, 1),
  donaAnaStreet = (o, f) => build(o, f, 2),
  donaAnaCloseup = (o, f) => build(o, f, 3);
const camera = (name, pos, look) => ({ name, position: world(pos), lookAt: world(look) }),
  sample = stations[18] + 40;
export const donaAnaBridgeModel = {
  id: 'dona_ana_bridge',
  key: 'dona_ana_bridge',
  cell: 'ku/kub',
  recipe: 'structure-dona-ana-bridge.mjs',
  title: 'Dona Ana Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([-200, 350, 4400]),
  lookAt: world([-225, 5, 0]),
  portableGroundY: -14.5,
  mediumFiContext: { scale: 46, groundY: -14.5, far: 18000 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-main-crossing-and-both-full-native-approaches', [-200, 350, 4400], [-225, 5, 0]),
    camera('opposite-whole-bridge-forty-paired-truss-spans', [0, 420, -4550], [-225, 5, 0]),
    camera(
      'one-long-span-open-polygonal-truss-web-and-footway',
      [sample, 33, 100],
      [sample, 12, 0],
    ),
    camera(
      'intrinsic-rail-gauge-pedestrian-lane-and-crossbearers',
      [sample + 22, 17, 22],
      [sample, 8.3, 1],
    ),
    camera(
      'southwest-full-approach-bends-and-bounded-pier-repeat',
      [line[0][0] + 260, 90, 850],
      [line[0][0] + 260, 3, 0],
    ),
    camera(
      'north-east-abutment-short-approach-and-open-underdeck',
      [L / 2 + 90, 35, 160],
      [L / 2 + 45, 3, 0],
    ),
    camera(
      'whole-native-seven-station-alignment-no-second-footbridge',
      [-220, 4700, 0.01],
      [-220, 0, 0],
    ),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-dona-ana-bridge.mjs',
    level: 'skyline',
    export: 'donaAnaSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'donaAnaDistrict', errorMeters: 2.2, surfaces },
      street: { export: 'donaAnaStreet', errorMeters: 0.8, surfaces },
      closeup: { export: 'donaAnaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole actual native mainrailbridge32776288/Q1239603 and connected564mSW410111566/114mNE410111569 approaches, allnativeends/bends retained,3674m fullphysicalextent. Complete40pairedpolygonalsteelthroughtrusses inside2997m mainends, deck/concretepiers/abutments/current1067mmrail/noelectrification/intrinsicfootway. Co-located path570690312 samebridge, no secondfootbridge. No neighboringroadbridge/landscape/river/sitepad/privateinteriors.',
    'Qualla-first11families/0conflicts. One exact886x570USAID officialgovernmentwork2000 original/nativeSHA1matched/PD-USGov-USAID and reviewedofficialFlickrUnitedStatesGovernmentWork, personallyinspected/existingunchangedpolicy passed. TransferredPD-author source unpinned/skippedwithoutpixels, othernativecategoryOGL/CCBY/CCBYSA unused. Sourceflooddamage/deckcollapse/crane excluded from current wholebridge; reference controls structuralfamily, later finish/repairs hidden estimates. No supplementalpixels/borrowedmesh/phototexture/generatedbitmap/imagerypolicy changes.',
    'After independentground frozen: deck+8m/pierbottom-14m/shaft3.4x7.8,33nominal80m+7nominal50m mainspans with6.536m totalnativeendoffset. Seven50mspans groupedSW as originalestimatedordering, not measuredpierstations. Polygonalupperchord11.4m/short8.2/frame4.5m/mainrailbed5.7m/.72mdeck, intrinsic1.15mfootwaycenter+3.35/1067mmgauge. Approach24mbeam-pierpitch/hiddenconnections/currentpaint/census estimated. Sleepers/footrailposts sampled by detailbudget; full40truss stations retained, skyline centralopen trussribbon and pierprofiles, district pairedopenframes, nearfullsolidmembers/topbracing/rails.',
    'Independent4000m129x12916641-value field/20rawtiles/PNG frozen before all deck/pier/geometry unchanged, fixedexteriordatum49m. Publicsource river/urbanrelief not bathymetry or railwayfoundation survey; exact source/host footing/deck/riverbankcontact unresolved/replacementfalse. Appearanceflatstage separate; no terrainfitting/flattening/reacquisition or whole-sitepad.',
  ],
};
