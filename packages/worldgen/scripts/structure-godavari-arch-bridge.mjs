/** Whole Godavari concrete bowstring railway bridge, with its separate old neighbor excluded. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tg/tg4/godavari_arch_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  L = p.wholeNativeCenterlineMeters,
  dx = p.line[1][0] - p.line[0][0],
  dz = p.line[1][1] - p.line[0][1],
  c = dx / L,
  s = dz / L,
  world = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  C = { concrete: rgb('c4c3b5'), ballast: rgb('858881'), steel: rgb('606b69') },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    ballast: { slot: 'roof', localRef: 'palette:#fffffe', roughness: 0.98, metallic: 0 },
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.2 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  unit = (v) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  };
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = world(n);
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
function bar(o, k, a, b, w, depth, n, col = C[k]) {
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
  Q(
    o,
    k,
    R[0],
    u.map((v) => -v),
    col,
  );
  Q(o, k, R[1], u, col);
}
const start = (-A.spanCount * A.spanPitch) / 2,
  spring = (i) => start + i * A.spanPitch,
  archY = (t) => A.archSpring + 4 * A.archRise * t * (1 - t),
  archDepth = (t) => A.archDepthSpring - (A.archDepthSpring - A.archDepthCrown) * 4 * t * (1 - t);
function arches(o, d) {
  const N = [3, 6, 12, 28][d];
  for (let i = 0; i < A.spanCount; i++) {
    const x0 = spring(i) + (A.spanPitch - A.bearingSpan) / 2;
    for (const sign of [-1, 1]) {
      const z = (sign * A.archSpacing) / 2,
        point = (t, dy = 0) => [x0 + t * A.bearingSpan, archY(t) + dy, z];
      for (let j = 0; j < N; j++) {
        const a = j / N,
          b = (j + 1) / N,
          dep0 = archDepth(a),
          dep1 = archDepth(b);
        if (d === 0) {
          const q = [
            point(a, -dep0 / 2),
            point(b, -dep1 / 2),
            point(b, dep1 / 2),
            point(a, dep0 / 2),
          ];
          Q(o, 'concrete', q, [0, 0, sign]);
          Q(o, 'concrete', q.toReversed(), [0, 0, -sign]);
        } else {
          const R = [a, b].map((t) =>
            [-1, 1].flatMap((sg) =>
              [-1, 1].map((v) => [
                x0 + t * A.bearingSpan,
                archY(t) + (v * archDepth(t)) / 2,
                z + (sg * A.archWidth) / 2,
              ]),
            ),
          );
          Q(o, 'concrete', [R[0][0], R[1][0], R[1][1], R[0][1]], [0, 0, -1]);
          Q(o, 'concrete', [R[0][2], R[0][3], R[1][3], R[1][2]], [0, 0, 1]);
          Q(o, 'concrete', [R[0][0], R[0][2], R[1][2], R[1][0]], [0, -1, 0]);
          Q(o, 'concrete', [R[0][1], R[1][1], R[1][3], R[0][3]], [0, 1, 0]);
        }
      }
      if (d > 1) {
        for (const t of [0, 1]) {
          const y = archY(t),
            dep = archDepth(t);
          Q(
            o,
            'concrete',
            [
              [x0 + t * A.bearingSpan, y - dep / 2, z - A.archWidth / 2],
              [x0 + t * A.bearingSpan, y - dep / 2, z + A.archWidth / 2],
              [x0 + t * A.bearingSpan, y + dep / 2, z + A.archWidth / 2],
              [x0 + t * A.bearingSpan, y + dep / 2, z - A.archWidth / 2],
            ],
            [t === 0 ? -1 : 1, 0, 0],
          );
        }
      }
      if (d > 0) {
        const ids = d === 1 ? [4, 9] : Array.from({ length: A.hangerPositions }, (_, k) => k + 1);
        for (const j of ids) {
          const t = j / (A.hangerPositions + 1),
            a = [x0 + t * A.bearingSpan, A.deckTop + 0.08, z],
            b = point(t, -archDepth(t) / 2);
          if (d < 3) ribbon(o, 'steel', a, b, d === 1 ? 0.2 : A.hangerWidth, [0, 0, sign]);
          else {
            bar(o, 'steel', a, b, A.hangerWidth, A.hangerWidth, [0, 0, 1]);
            box(
              o,
              'steel',
              a[0] - 0.14,
              a[0] + 0.14,
              A.deckTop,
              A.deckTop + 0.5,
              z - 0.14,
              z + 0.14,
            );
          }
        }
      }
    }
    if (d > 0)
      for (const t of d === 1
        ? [0.25, 0.5, 0.75]
        : d === 2
          ? [0.2, 0.4, 0.6, 0.8]
          : [0.14, 0.28, 0.42, 0.58, 0.72, 0.86]) {
        const x = x0 + t * A.bearingSpan,
          y = archY(t);
        if (d === 1)
          ribbon(
            o,
            'concrete',
            [x, y, -A.archSpacing / 2],
            [x, y, A.archSpacing / 2],
            0.55,
            [0, 1, 0],
          );
        else
          bar(
            o,
            'concrete',
            [x, y, -A.archSpacing / 2],
            [x, y, A.archSpacing / 2],
            0.65,
            0.65,
            [0, 1, 0],
          );
      }
  }
}
function deck(o, d) {
  if (d < 2)
    box(o, 'concrete', -L / 2, L / 2, A.deckBottom, A.deckTop, -A.deckWidth / 2, A.deckWidth / 2);
  else {
    for (let i = 0; i < A.spanCount; i++) {
      const a = spring(i) + 0.9,
        b = spring(i + 1) - 0.9,
        w = A.deckWidth / 2,
        v = A.boxBottomWidth / 2,
        R = (x) => [
          [x, A.deckBottom, -v],
          [x, A.deckBottom, v],
          [x, A.deckTop, w],
          [x, A.deckTop, -w],
        ],
        r = [R(a), R(b)];
      for (let j = 0; j < 4; j++)
        Q(
          o,
          'concrete',
          [r[0][j], r[0][(j + 1) % 4], r[1][(j + 1) % 4], r[1][j]],
          [
            [0, -1, 0],
            [0, 0.3, 1],
            [0, 1, 0],
            [0, 0.3, -1],
          ][j],
        );
      Q(o, 'concrete', r[0], [-1, 0, 0]);
      Q(o, 'concrete', r[1], [1, 0, 0]);
      box(o, 'steel', b, b + 1.8, A.deckTop - 0.15, A.deckTop + 0.015, -w, w);
    }
    for (const sign of [-1, 1]) {
      const a = sign < 0 ? -L / 2 : spring(A.spanCount) - 0.9,
        b = sign < 0 ? spring(0) + 0.9 : L / 2;
      box(o, 'concrete', a, b, A.deckBottom, A.deckTop, -A.deckWidth / 2, A.deckWidth / 2);
    }
    box(o, 'ballast', -L / 2, L / 2, A.deckTop, A.ballastTop, -1.75, 1.75);
    for (const sg of [-1, 1]) {
      const z = sg * (A.deckWidth / 2 + 0.1);
      box(o, 'concrete', -L / 2, L / 2, A.deckTop - 0.12, A.deckTop + 0.1, z - 0.25, z + 0.25);
      bar(
        o,
        'steel',
        [-L / 2, A.deckTop + 1.1, z],
        [L / 2, A.deckTop + 1.1, z],
        0.055,
        0.055,
        [0, 0, 1],
      );
      if (d === 3)
        bar(
          o,
          'steel',
          [-L / 2, A.deckTop + 0.55, z],
          [L / 2, A.deckTop + 0.55, z],
          0.045,
          0.045,
          [0, 0, 1],
        );
      for (let x = -L / 2; x < L / 2; x += d === 3 ? 8 : 36)
        bar(o, 'steel', [x, A.deckTop, z], [x, A.deckTop + 1.12, z], 0.06, 0.06, [0, 0, 1]);
    }
  }
  if (d > 0)
    for (const sg of [-1, 1]) {
      const z = (sg * A.railGauge) / 2;
      box(o, 'steel', -L / 2, L / 2, A.railTop - 0.16, A.railTop, z - 0.065, z + 0.065);
    }
  if (d > 1) {
    const pitch = d === 3 ? 1.7 : 8;
    for (let x = -L / 2 + 0.2; x < L / 2 - 0.2; x += pitch) {
      if (d === 3)
        box(
          o,
          'concrete',
          x - 0.12,
          x + 0.12,
          A.ballastTop,
          A.ballastTop + 0.16,
          -1.3,
          1.3,
          rgb('9b9f94'),
        );
      else
        Q(
          o,
          'concrete',
          [
            [x - 0.13, A.ballastTop + 0.07, -1.3],
            [x + 0.13, A.ballastTop + 0.07, -1.3],
            [x + 0.13, A.ballastTop + 0.07, 1.3],
            [x - 0.13, A.ballastTop + 0.07, 1.3],
          ],
          [0, 1, 0],
          rgb('a4a799'),
        );
    }
  }
}
function piers(o, d) {
  for (let i = 0; i <= A.spanCount; i++) {
    const x = spring(i);
    if (i === 0 || i === A.spanCount) {
      box(o, 'concrete', x - 2, x + 2, A.pierBottom, A.deckBottom, -4.1, 4.1, rgb('b5b6ab'));
      continue;
    }
    if (d === 0) {
      const q = [
        [x - A.pierAlong / 2, A.pierBottom, 0],
        [x + A.pierAlong / 2, A.pierBottom, 0],
        [x + A.pierAlong / 2, A.deckBottom, 0],
        [x - A.pierAlong / 2, A.deckBottom, 0],
      ];
      Q(o, 'concrete', q, [0, 0, 1], rgb('b5b6ab'));
      Q(o, 'concrete', q.toReversed(), [0, 0, -1], rgb('b5b6ab'));
    } else if (d === 1)
      box(
        o,
        'concrete',
        x - A.pierAlong / 2,
        x + A.pierAlong / 2,
        A.pierBottom,
        A.deckBottom,
        -A.pierAcross / 2,
        A.pierAcross / 2,
        rgb('b5b6ab'),
      );
    else {
      const cut = 0.55,
        w = A.pierAlong / 2,
        h = A.pierAcross / 2,
        P = [
          [-w + cut, -h],
          [w - cut, -h],
          [w, -h + cut],
          [w, h - cut],
          [w - cut, h],
          [-w + cut, h],
          [-w, h - cut],
          [-w, -h + cut],
        ];
      for (let j = 0; j < P.length; j++) {
        const a = P[j],
          b = P[(j + 1) % P.length],
          n = [b[1] - a[1], 0, a[0] - b[0]];
        Q(
          o,
          'concrete',
          [
            [x + a[0], A.pierBottom, a[1]],
            [x + b[0], A.pierBottom, b[1]],
            [x + b[0], A.pierTop - 0.7, b[1]],
            [x + a[0], A.pierTop - 0.7, a[1]],
          ],
          n,
          rgb('b5b6ab'),
        );
      }
      box(
        o,
        'concrete',
        x - A.pierCapAlong / 2,
        x + A.pierCapAlong / 2,
        A.pierTop - 0.7,
        A.pierTop,
        -A.pierCapAcross / 2,
        A.pierCapAcross / 2,
        rgb('babcb0'),
      );
      for (const dx of [-1.3, 1.3])
        for (const z of [-2, 2])
          box(o, 'steel', x + dx - 0.25, x + dx + 0.25, A.pierTop, A.deckBottom, z - 0.3, z + 0.3);
    }
  }
}
function catenary(o, d) {
  if (d < 2) return;
  const n = Math.floor(L / (A.catenaryPitch * (d === 2 ? 2 : 1)));
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (i * L) / n,
      z = (i % 2 ? 1 : -1) * 3.1;
    bar(o, 'steel', [x, A.deckTop, z], [x, A.catenaryHeight + 0.8, z], 0.12, 0.12, [0, 0, 1]);
    bar(
      o,
      'steel',
      [x, A.catenaryHeight + 0.45, z],
      [x, A.catenaryHeight + 0.15, 0],
      0.08,
      0.08,
      [0, 1, 0],
    );
  }
  for (const y of [A.catenaryHeight, A.catenaryHeight + 0.45])
    bar(o, 'steel', [-L / 2, y, 0], [L / 2, y, 0], 0.025, 0.025, [0, 0, 1]);
}
function build(o, _f, d = 3) {
  deck(o, d);
  piers(o, d);
  arches(o, d);
  catenary(o, d);
}
export const godavariSkyline = (o, f) => build(o, f, 0),
  godavariDistrict = (o, f) => build(o, f, 1),
  godavariStreet = (o, f) => build(o, f, 2),
  godavariCloseup = (o, f) => build(o, f, 3);
const camera = (name, position, lookAt) => ({
  name,
  position: world(position),
  lookAt: world(lookAt),
});
export const godavariArchBridgeModel = {
  id: 'godavari_arch_bridge',
  key: 'godavari_arch_bridge',
  cell: 'tg/tg4',
  recipe: 'structure-godavari-arch-bridge.mjs',
  title: 'Godavari Arch Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([1455, 62, 220]),
  lookAt: world([1120, 18, 0]),
  portableGroundY: -2.1,
  mediumFiContext: { scale: 1, groundY: -2.1 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-28-twin-bowstring-spans-native-both-ends', [1850, 1050, 1700], [0, 14, 0]),
    camera('opposite-whole-bridge-and-pier-openings', [-1700, 800, -1600], [0, 13, 0]),
    camera('eastern-end-repeated-arches-no-old-truss', [1460, 29, 90], [1120, 25, 0]),
    camera('paired-concrete-ribs-open-lateral-vierendeel-struts', [1345, 40, 19], [1315, 25, 0]),
    camera('twelve-hanger-pairs-tie-deck-pier-caps', [1315, 18, 68], [1315, 19, 0]),
    camera('true-deck-soffit-and-separated-pier-bearings', [1262, 5, 14], [1268, 11, 0]),
    camera('single-gauge-track-maintenance-edge-catenary', [1380, 16, 5], [1290, 16, 0]),
    camera('western-abutment-and-complete-span-rhythm', [-1435, 32, -105], [-1130, 24, 0]),
    camera('whole-native-alignment-and-28-span-distribution', [0, 2500, 10], [0, 0, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-godavari-arch-bridge.mjs',
    level: 'skyline',
    export: 'godavariSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'godavariDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'godavariStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'godavariCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole native2762.416m alignment/Q2012032/way56683928 and both original endpoints retained. Primary engineer28x97.552m pattern centered with15.48m original end allowances. All28 twin concrete parabolic spans, separate hangers/lateral Vierendeel struts/tie deck/open underside/piers/abutments/single1676mm gauge track/intrinsic maintenance edges and sparse catenary; no facade-only or single-span reduction.',
    'One exact3872x2592 Hariya1234 2011-05-12 Own/PD-own Qualla original individually inspected/nativeSHA1matched. Separate oldHavelock steel-through-truss/masonry piers overlap foreground of photo and are excluded; separate road/approach bridges excluded. Other nominalPD image has creator/grant ambiguity and is unused. Primary BBR/KDM text only; no protected drawings/images/textures/borrowed meshes/copied people/artwork/license-policy-verifier changes.',
    'Photo is sunset and hides much of new deck/piers behind old bridge. Daylight palette/arch-rise20m and rib sections/width/vertical deck level/pier supports/end offsets/rails/maintenance/catenary details are bounded original medium-fi estimates.12 hanger positions per rib modeled; dense sleepers/posts reduced intentionally byLOD. Skyline preserves28 paired arch silhouettes/native ends/deck/piers but omits fine hangers/track/struts; district retains partial hanger and lateral rhythm. No as-built survey or engineering structural analysis claimed.',
    'Independent4000m/129x129/16641-value field/25raw source tiles/PNG frozen before deck/floor/arch/pier decisions unchanged. Original source includes river low/urban artifacts and is not bathymetry or current water/rail elevation. Source and host contact unresolved/replacementfalse; isolated/shared flat appearance separate. No terrain fitting/flattening/reacquisition or river/ground slab.',
  ],
};
