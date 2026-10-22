/** Full old Pamban low railway and closed Scherzer double rolling bascule, 8 March 2015. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tc/tc8/pamban_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  concrete: rgb('c6c6b4'),
  rust: rgb('916f5d'),
  steel: rgb('c8ccc2'),
  dark: rgb('66736d'),
  hut: rgb('7ba5a4'),
  glass: rgb('607471'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  rust: { slot: 'trim', graph: 'metal_painted', roughness: 0.93, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
  dark: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.84, metallic: 0.35 },
  hut: { slot: 'wall', graph: 'metal_painted', roughness: 0.92, metallic: 0.1 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.49, metallic: 0.05 },
};
const L = plan.line[0][0],
  H = plan.line.at(-1)[0],
  A = plan.lift[0][0],
  B = plan.lift[1][0],
  M = (A + B) / 2,
  half = plan.estimatedParameters.clearLiftOpening / 2;
const zAt = (x) => {
    let i = 1;
    while (i < plan.line.length - 1 && plan.line[i][0] < x) i++;
    const a = plan.line[i - 1],
      b = plan.line[i];
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  },
  P = (x, y, z) => [x, y, zAt(x) + z];
function T(o, s, p, n) {
  p = p.map((v) => v.map(Math.fround));
  const q = normalFor(...p);
  if (q.every((v) => v === 0)) return;
  if (n && q.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((v) => [v[0] + v[2], v[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function box(o, s, x, y, z, w, h, t) {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - t / 2,
    e = z + t / 2,
    lo = y - h / 2,
    hi = y + h / 2;
  for (const [p, n] of [
    [
      [P(a, lo, c), P(b, lo, c), P(b, hi, c), P(a, hi, c)],
      [0, 0, -1],
    ],
    [
      [P(a, lo, e), P(a, hi, e), P(b, hi, e), P(b, lo, e)],
      [0, 0, 1],
    ],
    [
      [P(a, lo, c), P(a, hi, c), P(a, hi, e), P(a, lo, e)],
      [-1, 0, 0],
    ],
    [
      [P(b, lo, c), P(b, lo, e), P(b, hi, e), P(b, hi, c)],
      [1, 0, 0],
    ],
    [
      [P(a, hi, c), P(b, hi, c), P(b, hi, e), P(a, hi, e)],
      [0, 1, 0],
    ],
    [
      [P(a, lo, c), P(a, lo, e), P(b, lo, e), P(b, lo, c)],
      [0, -1, 0],
    ],
  ])
    Q(o, s, p, n);
}
function stick(o, s, a, b, w, d) {
  if (d) {
    beam(o, s, a, b, w, w, C[s]);
    return;
  }
  const v = b.map((q, i) => q - a[i]),
    n = Math.hypot(v[0], v[1]),
    u = n ? [-v[1] / n, v[0] / n, 0] : [1, 0, 0],
    p = [
      a.map((q, i) => q - (u[i] * w) / 2),
      b.map((q, i) => q - (u[i] * w) / 2),
      b.map((q, i) => q + (u[i] * w) / 2),
      a.map((q, i) => q + (u[i] * w) / 2),
    ];
  Q(o, s, p);
  Q(o, s, p.toReversed());
}
function ribbon(o, s, z, w, y, h) {
  for (let i = 1; i < plan.line.length; i++) {
    const a = plan.line[i - 1][0],
      b = plan.line[i][0];
    Q(
      o,
      s,
      [P(a, y, z - w / 2), P(b, y, z - w / 2), P(b, y, z + w / 2), P(a, y, z + w / 2)],
      [0, 1, 0],
    );
    Q(
      o,
      s,
      [
        P(a, y - h, z - w / 2),
        P(a, y - h, z + w / 2),
        P(b, y - h, z + w / 2),
        P(b, y - h, z - w / 2),
      ],
      [0, -1, 0],
    );
    for (const k of [-1, 1])
      Q(
        o,
        s,
        [
          P(a, y - h, z + (k * w) / 2),
          P(b, y - h, z + (k * w) / 2),
          P(b, y, z + (k * w) / 2),
          P(a, y, z + (k * w) / 2),
        ],
        [0, 0, k],
      );
  }
}
function supports(o, d) {
  for (const [lo, hi, n] of [
    [L, A, 113],
    [B, H, 32],
  ])
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n,
        nav = Math.abs(x - A) < 0.01 || Math.abs(x - B) < 0.01;
      if (nav) {
        box(o, 'concrete', x, -0.25, 0, 8.2, 5.5, 13.8);
        if (d > 1) box(o, 'concrete', x, 1.95, 0, 9.1, 0.65, 14.8);
        continue;
      }
      if (!d) {
        const p = [
          P(x - 0.78, -3.1, 0),
          P(x + 0.78, -3.1, 0),
          P(x + 0.78, 1.55, 0),
          P(x - 0.78, 1.55, 0),
        ];
        Q(o, 'concrete', p);
        Q(o, 'concrete', p.toReversed());
      } else {
        box(o, 'concrete', x, -0.78, 0, 1.55, 4.65, 4.1);
        if (d > 1) {
          box(o, 'concrete', x, 1.35, 0, 2.05, 0.4, 4.5);
          box(o, 'concrete', x, -2.92, 0, 2.4, 0.4, 5.1);
        }
      }
    }
}
function track(o, d) {
  for (const z of [-1.22, 1.22]) ribbon(o, 'rust', z, 0.3, 2.65, 1.15);
  for (const z of [-0.838, 0.838]) ribbon(o, 'dark', z, d === 0 ? 0.18 : 0.075, 3.15, 0.13);
  if (d > 0) {
    for (const z of [-1.22, 1.22]) for (const y of [1.52, 2.64]) ribbon(o, 'rust', z, 0.5, y, 0.08);
  }
  if (d > 1) {
    const step = d === 2 ? 1.9 : 0.72;
    for (let x = L + 0.5; x < H - 0.4; x += step) {
      if (d === 2)
        Q(
          o,
          'dark',
          [
            P(x - 0.09, 2.92, -1.45),
            P(x + 0.09, 2.92, -1.45),
            P(x + 0.09, 2.92, 1.45),
            P(x - 0.09, 2.92, 1.45),
          ],
          [0, 1, 0],
        );
      else box(o, 'dark', x, 2.84, 0, 0.2, 0.18, 2.9);
    }
    for (const [lo, hi, n] of [
      [L, A, 113],
      [B, H, 32],
    ])
      for (let i = 0; i < n; i++) {
        const x = lo + ((hi - lo) * (i + 0.5)) / n;
        for (const z of [-1.22, 1.22]) {
          box(o, 'rust', x, 2.05, z, 0.085, 1.08, 0.38);
          if (d > 2)
            for (const f of [-0.32, 0.32])
              stick(o, 'rust', P(x + f, 1.58, z + 0.18), P(x - f, 2.6, z + 0.18), 0.04, d);
        }
      }
  }
}
function refuges(o, d) {
  if (!d) return;
  const step = d === 1 ? 24 : d === 2 ? 8 : 4;
  for (const [lo, hi, n] of [
    [L, A, 113],
    [B, H, 32],
  ])
    for (let i = 1; i < n; i += step) {
      const x = lo + ((hi - lo) * i) / n,
        z = 2.3;
      box(o, 'steel', x, 2.68, z, 2.15, 0.15, 2.1);
      if (d > 1) {
        for (const xx of [-1, 1]) {
          stick(o, 'rust', P(x + xx, 1.5, 1.2), P(x + xx, 2.6, 3.35), 0.095, d);
          stick(o, 'steel', P(x + xx, 2.7, 3.3), P(x + xx, 3.65, 3.3), 0.055, d);
        }
        for (const y of [3.18, 3.65]) {
          stick(o, 'steel', P(x - 1, y, 3.3), P(x + 1, y, 3.3), 0.05, d);
          for (const xx of [-1, 1])
            stick(o, 'steel', P(x + xx, y, 1.3), P(x + xx, y, 3.3), 0.05, d);
        }
      }
    }
}
function rolling(o, d) {
  const bays = [2, 3, 6, 9][d];
  for (const side of [-1, 1]) {
    const pivot = M + side * half,
      tip = M,
      back = side < 0 ? A : B,
      high = 15.35;
    for (const z of [-2.6, 2.6]) {
      const top = (t) => 3.65 + (high - 3.65) * (1 - t),
        X = (t) => pivot + (tip - pivot) * t;
      stick(o, 'steel', P(pivot, high, z), P(tip, 3.65, z), 0.36, d);
      stick(o, 'steel', P(pivot, 3.05, z), P(tip, 3.05, z), 0.38, d);
      for (let j = 0; j < bays; j++) {
        const t = j / bays,
          u = (j + 1) / bays;
        stick(o, 'steel', P(X(t), 3.05, z), P(X(u), top(u), z), 0.21, d);
        if (d > 0) stick(o, 'steel', P(X(t), 3.05, z), P(X(t), top(t), z), 0.2, d);
      }
      stick(o, 'steel', P(back, 2.9, z), P(pivot, high, z), 0.4, d);
      const N = [2, 3, 10, 18][d],
        r = 8.1,
        centerX = pivot - side * 2.5,
        centerY = 10.9;
      for (let j = 0; j < N; j++) {
        const f = Math.PI * (0.02 + (0.58 * j) / N),
          g = Math.PI * (0.02 + (0.58 * (j + 1)) / N),
          aa = P(centerX + side * r * Math.cos(f), centerY - r * Math.sin(f), z),
          bb = P(centerX + side * r * Math.cos(g), centerY - r * Math.sin(g), z);
        stick(o, 'dark', aa, bb, 0.38, d);
        if (d > 1 && j % 2 === 0) stick(o, 'steel', P(pivot, high, z), aa, 0.14, d);
      }
      if (d > 1) {
        box(o, 'dark', back - side * 1.2, 2.4, z, 5.5, 0.24, 0.65);
        for (const yy of [4.2, 6.8, 9.4, 12])
          stick(o, 'steel', P(pivot - side * 1.8, yy, z), P(pivot + side * 1.8, yy, z), 0.12, d);
      }
    }
    for (const z of [-2.6, 2.6]) stick(o, 'steel', P(pivot, 3.1, z), P(pivot, high, z), 0.4, d);
    stick(o, 'steel', P(pivot, high, -2.6), P(pivot, high, 2.6), 0.4, d);
    box(o, 'dark', pivot + side * 1.3, 11.2, 0, 2.6, 5.2, 4.1);
    if (d > 0) {
      for (const k of [-1, 1]) {
        stick(
          o,
          'steel',
          P(pivot - side * 2, high, -2.6 * k),
          P(pivot + side * 2, high, 2.6 * k),
          0.16,
          d,
        );
      }
      for (let j = 0; j < 3; j++) {
        const x = pivot + ((tip - pivot) * j) / 3;
        stick(o, 'dark', P(x, 2.7, -2.6), P(x, 2.7, 2.6), 0.22, d);
      }
    }
  }
  const x = A + 3,
    z = -5.2;
  box(o, 'hut', x, 4.25, z, 3.8, 3.2, 3.3);
  if (d > 0) {
    box(o, 'steel', x, 5.92, z, 4.15, 0.18, 3.65);
    for (const k of [-1, 1]) {
      Q(
        o,
        'glass',
        [
          P(x - 1.28, 4.35, z + k * 1.66),
          P(x + 1.28, 4.35, z + k * 1.66),
          P(x + 1.28, 5.4, z + k * 1.66),
          P(x - 1.28, 5.4, z + k * 1.66),
        ],
        [0, 0, k],
      );
      stick(o, 'steel', P(x, 4.35, z + k * 1.68), P(x, 5.4, z + k * 1.68), 0.065, d);
    }
    for (const xx of [-1.4, 1.4]) stick(o, 'steel', P(x + xx, 1.9, z), P(x + xx, 2.7, z), 0.12, d);
  }
}
function build(o, _f, d = 3) {
  supports(o, d);
  track(o, d);
  refuges(o, d);
  rolling(o, d);
}
export const pambanBridgeSkyline = (o, f) => build(o, f, 0);
export const pambanBridgeDistrict = (o, f) => build(o, f, 1);
export const pambanBridgeStreet = (o, f) => build(o, f, 2);
export const pambanBridgeModel = {
  id: 'pamban_bridge',
  key: 'pamban_bridge',
  recipe: 'structure-pamban-bridge.mjs',
  cell: 'tc/tc8',
  title: 'Pamban Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief: plan.authoringDirection,
  camera: [-1000, 850, 1800],
  lookAt: [0, 2, 0],
  portableGroundY: -3.2,
  mediumFiContext: { scale: 8, groundY: -3.2 },
  qaCameras: [
    {
      name: 'whole-original-low-railway-from-mainland-to-island',
      position: [0, 900, 1750],
      lookAt: [0, 4, 0],
    },
    {
      name: 'closed-double-leaf-rolling-bascule-and-counterweights',
      position: [M - 48, 31, 75],
      lookAt: [M, 8, 0],
    },
    {
      name: 'piers-twin-girders-sleepers-and-refuges',
      position: [850, 14, 35],
      lookAt: [830, 2, 0],
    },
    {
      name: 'rolling-sector-open-through-truss-and-operator-hut',
      position: [A - 22, 16, -30],
      lookAt: [A + 8, 7, -1],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent2400m121x121coastalfield and4rawtilesfrozenbeforegeometry. Historicalwaterstage/seabed/pierfootingcontactunverified; no oceanorlandpad.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-pamban-bridge.mjs',
    level: 'skyline',
    export: 'pambanBridgeSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'pambanBridgeDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'pambanBridgeStreet', errorMeters: 0.26, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Wholehistoric2015-03-08oldrailwaybridgefromexactpublishedRudolph.A.furtadoownCC0original. NativeSHA1matches4608x3456bytes. Questionableassumed-creatorPDimagesandallattributionimagesunused; no newphotos/generated/copiedtextures. Ordinarygeographicasset/foldername.',
    'Fulloldnative2.06kmalignment, repeatedlowpiersandpairedgirders/single1676mmtrack, maintenancecantileverrefuges, closedtwo-leafScherzerthroughtrusses, curvingrearrollingsectors, counterweightsandattachedsmallturquoisehut. Distinct2025vertical-liftandparallelroadbridgesexcluded. No trains/boats/signs/coastslab/fenders/vegetation.',
    '145smallspanallocation/individualpierlocationsandheightsestimatedinsidenativefixedendpoints; primary12.2mclearspanisnotpierpitch. Mapped90.6moverallmovablesectionincludesrollingtails; primary66.5mclearopeningretainedseparately. Trussrisesections/backcurves/counterweights/oppositefaces/refugecensus/underwaterfootingsareboundedphotographicestimates, notengineeringsurvey.',
    'Skylinepreservesfullalignment/allpierpositions/fullclosedbasculewiththinreversiblepierfaces; highlevelsclosedvolumetricpiers/caps/feet, girderflanges, rails, sleepers/refugesandbraces. Exactgirdersection/connectionhardwareandmechanicalmotionnotmodeled; staticcloseddatedappearanceonly.',
    'Independent20mreviewgriddoesnotimply20maccuracy or2015bathymetry; rawcurrentcoastalfieldand4originaltilesretainedunchanged. Footingto-3.1m/deckrail3.15mrelativetoapproachdatumestimated. FlatQAgroundforgeometryonly, exact livehistoricalwater/groundcontactuncertified. DatedhistoricalplacementwithreplaceFootprint=false,currentWorldEligible=false.',
  ],
};
