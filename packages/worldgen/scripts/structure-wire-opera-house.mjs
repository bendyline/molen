/** Curitiba's circular tubular theater, open three-level arcade and intrinsic entrance bridge. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/6g/6gk/wire_opera_house/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  steel: rgb('a8b1a8'),
  rail: rgb('398567'),
  roof: rgb('c0c4b7'),
  core: rgb('40584d'),
  deck: rgb('868d7d'),
  foot: rgb('999486'),
};
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.15 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.15 },
  roof: { slot: 'roof', localRef: 'palette:#fffffe', roughness: 0.62, metallic: 0.04 },
  core: { slot: 'wall', localRef: 'palette:#feffff', roughness: 0.78, metallic: 0.03 },
  deck: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.86, metallic: 0.2 },
  foot: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const R = plan.radius,
  TAU = Math.PI * 2,
  start = Math.atan2(plan.bridge.at(-1)[1], plan.bridge.at(-1)[0]) - Math.PI / 24;
function T(o, s, p, n) {
  const f = p.map((q) => q.map(Math.fround)),
    cr = cross(
      f[1].map((v, k) => v - f[0][k]),
      f[2].map((v, k) => v - f[0][k]),
    );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((v, x, k) => v + x * n[k], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    C[s],
  );
  if (s === 'roof') {
    const below = [...p].reverse().map((q) => [q[0], q[1] - 0.045, q[2]]);
    o.addTriangle(
      s,
      ref,
      below,
      normalFor(...below),
      below.map((q) => [q[0] + q[2], q[1]]),
      C[s],
    );
  }
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function P(a, r = R, y = 0) {
  return [r * Math.cos(a), y, r * Math.sin(a)];
}
function cap(o, s, pts, y, up = true) {
  const ix = earcut(pts.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, pts, lo, hi) {
  cap(o, s, pts, lo, false);
  cap(o, s, pts, hi);
  const area = pts.reduce(
    (v, p, i) => v + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1],
    0,
  );
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [Math.sign(area) * (b[1] - a[1]), 0, Math.sign(area) * (a[0] - b[0])],
    );
  }
}
function tube(o, s, a, b, r, d) {
  const axis = b.map((v, k) => v - a[k]),
    L = Math.hypot(...axis);
  if (L < 1e-6) return;
  const u = axis.map((v) => v / L),
    v0 = cross(u, Math.abs(u[1]) < 0.98 ? [0, 1, 0] : [1, 0, 0]),
    l = Math.hypot(...v0),
    v = v0.map((x) => x / l),
    w = cross(u, v),
    N = [3, 3, 3, 6][d],
    ring = (p, t) => p.map((x, k) => x + r * (Math.cos(t) * v[k] + Math.sin(t) * w[k]));
  for (let i = 0; i < N; i++) {
    const f = (i * TAU) / N,
      g = ((i + 1) * TAU) / N,
      n = v.map((x, k) => Math.cos((f + g) / 2) * x + Math.sin((f + g) / 2) * w[k]);
    Q(o, s, [ring(a, f), ring(a, g), ring(b, g), ring(b, f)], n);
  }
}
function line(o, s, pts, r, d) {
  for (let i = 1; i < pts.length; i++) tube(o, s, pts[i - 1], pts[i], r, d);
}
function annulus(o, inner, outer, y, N, thick = 0.14, s = 'deck') {
  for (let i = 0; i < N; i++) {
    const a = start + (i * TAU) / N,
      b = start + ((i + 1) * TAU) / N;
    Q(o, s, [P(a, inner, y), P(b, inner, y), P(b, outer, y), P(a, outer, y)], [0, 1, 0]);
    Q(
      o,
      s,
      [
        P(a, inner, y - thick),
        P(a, outer, y - thick),
        P(b, outer, y - thick),
        P(b, inner, y - thick),
      ],
      [0, -1, 0],
    );
    Q(
      o,
      s,
      [P(a, outer, y - thick), P(a, outer, y), P(b, outer, y), P(b, outer, y - thick)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
}
function arc(o, s, a, b, y, top, r, d, rad = R) {
  const A = P(a, rad, y),
    B = P(b, rad, y),
    steps = [2, 2, 6, 14][d],
    pts = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      return [
        A[0] + (B[0] - A[0]) * t,
        y + (top - y) * Math.sin(Math.PI * t),
        A[2] + (B[2] - A[2]) * t,
      ];
    });
  line(o, s, pts, r, d);
}
function ringLine(o, s, rad, y, N, r, d) {
  line(
    o,
    s,
    Array.from({ length: N + 1 }, (_, i) => P(start + (i * TAU) / N, rad, y)),
    r,
    d,
  );
}
function rails(o, a, b, y, d) {
  const n = [1, 1, 4, 7][d];
  line(o, 'rail', [P(a, R - 0.12, y + 1.05), P(b, R - 0.12, y + 1.05)], 0.045, d);
  if (d > 1) line(o, 'rail', [P(a, R - 0.12, y + 0.28), P(b, R - 0.12, y + 0.28)], 0.035, d);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      A = P(a, R - 0.12, y),
      B = P(b, R - 0.12, y),
      p = A.map((v, k) => v + (B[k] - v) * t);
    tube(o, 'rail', p, [p[0], y + 1.05, p[2]], 0.025, d);
  }
}
function theatre(o, d) {
  const bays = d < 2 ? 12 : 24,
    N = [16, 24, 48, 96][d],
    step = TAU / bays;
  // The opaque inner shell is set well inside the open exterior galleries.
  const core = Array.from({ length: N }, (_, i) =>
    P((i * TAU) / N, 13.8).filter((_, k) => k !== 1),
  );
  prism(o, 'core', core, -4.75, 8.4);
  const base = Array.from({ length: N }, (_, i) =>
    P((i * TAU) / N, 14.6).filter((_, k) => k !== 1),
  );
  prism(o, 'deck', base, -5.15, -4.9);
  for (const y of [0, 4.25]) annulus(o, 13.8, R, y, N);
  if (d > 1) annulus(o, 13.8, R - 1.1, -4.6, N);
  for (let i = 0; i < bays; i++) {
    const a = start + i * step,
      b = a + step,
      A = P(a),
      back = A[2] < -14 && Math.abs(A[0]) < 11.3;
    if (back) continue;
    for (const offset of d > 1 ? [-0.17, 0, 0.17] : [0]) {
      const p = P(a, R + offset);
      tube(o, 'steel', [p[0], -7.1, p[2]], [p[0], 8.6, p[2]], d === 0 ? 0.22 : 0.095, d);
    }
    if (d > 1) {
      const p = P(a, R);
      prism(
        o,
        'foot',
        [
          [p[0] - 0.28, p[2] - 0.28],
          [p[0] + 0.28, p[2] - 0.28],
          [p[0] + 0.28, p[2] + 0.28],
          [p[0] - 0.28, p[2] + 0.28],
        ],
        -7.35,
        -7.1,
      );
    }
    if (d > 0) {
      for (const y of [0, 4.25]) {
        arc(o, 'steel', a, b, y, y + 3.7, 0.085, d);
        if (d > 2) arc(o, 'steel', a + 0.014, b - 0.014, y + 0.16, y + 3.5, 0.06, d, R - 0.12);
        if (i !== 0 || y !== 0) rails(o, a, b, y, d);
      }
    }
    if (i % 2 === 0) {
      arc(o, 'steel', a, a + step * 2, -7, -0.5, 0.105, d);
    }
    if (d > 0) {
      tube(o, 'steel', P(a, R, 8.6), P(a + step / 2, R, 7.7), 0.07, d);
      tube(o, 'steel', P(a + step / 2, R, 7.7), P(b, R, 8.6), 0.07, d);
    }
    if (d > 1) {
      for (const y of [3.8, 8.1]) {
        const mid = (a + b) / 2,
          c = P(mid, R - 0.1, y),
          ta = [-Math.sin(mid), 0, Math.cos(mid)],
          rr = 0.28,
          pts = Array.from({ length: (d === 3 ? 12 : 8) + 1 }, (_, k) => {
            const t = (k * TAU) / (d === 3 ? 12 : 8);
            return [
              c[0] + ta[0] * rr * Math.cos(t),
              c[1] + rr * Math.sin(t),
              c[2] + ta[2] * rr * Math.cos(t),
            ];
          });
        line(o, 'steel', pts, 0.045, d);
      }
    }
  }
  if (d === 0) {
    for (const y of [1, 5.25, 8.6]) ringLine(o, y === 8.6 ? 'steel' : 'rail', R, y, 12, 0.09, 0);
  } else for (const y of [-0.3, 4, 8.5]) ringLine(o, 'steel', R, y, d === 1 ? 16 : N, 0.09, d);
  for (let i = 0; i < N; i++) {
    const a = start + (i * TAU) / N,
      b = start + ((i + 1) * TAU) / N;
    Q(
      o,
      'roof',
      [P(a, R + 0.35, 8.6), P(b, R + 0.35, 8.6), P(b, 13.8, 9.85), P(a, 13.8, 9.85)],
      [Math.cos((a + b) / 2), 3, Math.sin((a + b) / 2)],
    );
    T(o, 'roof', [P(a, 13.8, 9.85), P(b, 13.8, 9.85), [0, 12.25, 0]], [0, 1, 0]);
  }
  if (d > 0) {
    for (let i = 0; i < 24 * (d > 2 ? 3 : d > 1 ? 2 : 1); i++) {
      const a = start + (i * TAU) / (24 * (d > 2 ? 3 : d > 1 ? 2 : 1));
      line(o, 'steel', [P(a, R + 0.35, 8.65), P(a, 13.8, 9.9), [0, 12.29, 0]], 0.035, d);
    }
    for (const [rr, y] of [
      [13.8, 9.9],
      [8, 10.9],
      [3, 11.77],
    ])
      ringLine(o, 'steel', rr, y, d === 1 ? 12 : N, 0.035, d);
  }
  // Slender entry portal sits across the same open bay as the mapped bridge.
  if (d > 0) {
    const a = start,
      b = start + TAU / 24;
    for (const off of [0, 0.18, 0.36])
      arc(o, 'steel', a + off / R, b - off / R, 0, 4.1 - off, 0.07, d, R + 0.15);
  }
  if (d > 1) {
    const a = start - TAU / 24,
      b = start;
    for (let i = 0; i < 20; i++) {
      const t = i / 20,
        y = -4.6 + 4.6 * t,
        aa = a + (b - a) * t,
        bb = a + (b - a) * (t + 1 / 20),
        r0 = 15.8,
        r1 = 17.7;
      Q(o, 'deck', [P(aa, r0, y), P(aa, r1, y), P(bb, r1, y), P(bb, r0, y)], [0, 1, 0]);
      Q(
        o,
        'deck',
        [P(bb, r0, y), P(bb, r1, y), P(bb, r1, y + 0.23), P(bb, r0, y + 0.23)],
        [Math.cos(bb), 0, Math.sin(bb)],
      );
    }
  }
}
function stage(o, d) {
  const r = plan.stage;
  prism(o, 'core', r, -4.75, 8.4);
  const m1 = [(r[0][0] + r[3][0]) / 2, (r[0][1] + r[3][1]) / 2],
    m2 = [(r[1][0] + r[2][0]) / 2, (r[1][1] + r[2][1]) / 2];
  for (const [a, b, m, n] of [
    [r[0], r[1], m1, m2],
    [r[3], r[2], m1, m2],
  ])
    Q(
      o,
      'roof',
      [
        [a[0], 8.4, a[1]],
        [b[0], 8.4, b[1]],
        [n[0], 10, n[1]],
        [m[0], 10, m[1]],
      ],
      [0, 1, 0],
    );
  for (let j = 0; j < 4; j++) {
    const a = r[j],
      b = r[(j + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = d === 0 ? 1 : Math.ceil(L / 3.6);
    if (d > 0) {
      tube(o, 'steel', [a[0], 0, a[1]], [b[0], 0, b[1]], 0.09, d);
      tube(o, 'steel', [a[0], 4.25, a[1]], [b[0], 4.25, b[1]], 0.09, d);
    }
    for (let k = 0; k < n; k++) {
      const t = k / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      tube(o, 'steel', [x, -4.8, z], [x, 8.4, z], 0.095, d);
    }
  }
}
function bridge(o, d) {
  const points = [...plan.bridge],
    end = points.at(-1);
  points.push([end[0], Math.sqrt(R * R - end[0] * end[0]) - 0.12]);
  let total = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1],
      b = points[k],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.01) continue;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [-u[1], u[0]],
      P0 = (x, y, z) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
      w = 2.1;
    prism(
      o,
      'deck',
      [P0(0, 0, -w), P0(L, 0, -w), P0(L, 0, w), P0(0, 0, w)].map((p) => [p[0], p[2]]),
      -0.18,
      0,
    );
    const bays = d === 0 ? 1 : Math.max(1, Math.round(L / 4.3));
    for (const side of [-1, 1]) {
      const z = side * w;
      tube(o, 'steel', P0(0, 1.15, z), P0(L, 1.15, z), 0.07, d);
      tube(o, 'steel', P0(0, -0.28, z), P0(L, -0.28, z), 0.08, d);
      if (d > 0) tube(o, 'steel', P0(0, -4.35, z), P0(L, -4.35, z), 0.08, d);
      for (let i = 0; i < bays; i++) {
        const x0 = (L * i) / bays,
          x1 = (L * (i + 1)) / bays,
          m = (x0 + x1) / 2;
        if (d > 0) {
          tube(o, 'steel', P0(x0, -7.1, z), P0(x0, 1.15, z), 0.075, d);
          const N = [0, 3, 8, 16][d],
            circle = Array.from({ length: N + 1 }, (_, j) => {
              const t = (j * TAU) / N;
              return P0(m + (x1 - x0) * 0.46 * Math.cos(t), -2.3 + 1.95 * Math.sin(t), z);
            });
          line(o, 'steel', circle, 0.06, d);
          const topArch = Array.from({ length: N + 1 }, (_, j) => {
            const t = j / N;
            return P0(x0 + (x1 - x0) * t, -7 + 2.6 * Math.sin(Math.PI * t), z);
          });
          line(o, 'steel', topArch, 0.065, d);
          tube(o, 'steel', P0(x0, 0.1, z), P0(m, 1.15, z), 0.055, d);
          tube(o, 'steel', P0(m, 1.15, z), P0(x1, 0.1, z), 0.055, d);
        } else tube(o, 'steel', P0(x0, -7.1, z), P0(x0, 1.15, z), 0.12, 0);
        if (d > 1) {
          const N = d === 3 ? 12 : 6;
          for (let j = 1; j < N; j++) {
            const x = x0 + ((x1 - x0) * j) / N;
            tube(o, 'rail', P0(x, 0.1, z), P0(x, 1.05, z), 0.012, d);
          }
        }
      }
    }
    if (d > 1) {
      const count = Math.ceil(L / (d === 3 ? 0.35 : 0.7));
      for (let i = 0; i <= count; i++) {
        const x = (L * i) / count;
        tube(o, 'steel', P0(x, 0.018, -w), P0(x, 0.018, w), 0.014, d);
      }
      for (let j = -1; j <= 1; j++) tube(o, 'steel', P0(0, 0.025, j), P0(L, 0.025, j), 0.014, d);
    }
    total += L;
  }
  return total;
}
function build(o, _f, d = 3) {
  theatre(o, d);
  stage(o, d);
  bridge(o, d);
}
export const wireOperaSkyline = (o, f) => build(o, f, 0);
export const wireOperaDistrict = (o, f) => build(o, f, 1);
export const wireOperaStreet = (o, f) => build(o, f, 2);
export const wireOperaHouseModel = {
  id: 'wire_opera_house',
  key: 'wire_opera_house',
  recipe: 'structure-wire-opera-house.mjs',
  cell: '6g/6gk',
  title: 'Wire Opera House',
  category: 'performance-sport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [-78, 35, 116],
  lookAt: [0, 2, 15],
  portableGroundY: -7.6,
  mediumFiContext: { scale: 1.4, groundY: -7.6 },
  qaCameras: [
    {
      name: 'round-steel-theatre-and-native-entrance-bridge',
      position: [-55, 17, 84],
      lookAt: [0, 1, 17],
    },
    {
      name: 'open-three-level-arcade-and-branching-tube-columns',
      position: [-26, 1, 27],
      lookAt: [-5, 2, 5],
    },
    {
      name: 'attached-north-stage-and-radial-shallow-roof',
      position: [38, 25, -50],
      lookAt: [0, 4, -9],
    },
    {
      name: 'entry-bridge-circle-lattice-and-grating',
      position: [-13, -1, 46],
      lookAt: [1, -1, 35],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent200mrawterrain fixedbeforegeometryatnativeouterbridgeendpoint; quarry/water/footingcontactnotcertified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-wire-opera-house.mjs',
    level: 'skyline',
    export: 'wireOperaSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'wireOperaDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'wireOperaStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'FourexactpublishedQuallaownPDselforiginals individuallyinspected/nativeSHA1matched; noquestionableimage used, no generated/copiedbitmaptexture. Currentpreservedexteriorforms follow1997/2006views; currentpaint/rearroof/renovationsunverified.',
    'LowerLODsreducecolumn/arch/rail/gratingdensity; skyline/district12bays andstreet/closeup24bays, errorsboundedfortypicaldistance. Maincircleleast-squaresfit16nativevertices residualunder0.018m,radius18.4632347473m. Native18pointwholefootprintincludesattachednorthstage. Allnativebridge/connectornodesretained andintrinsicshortjointtogalleryadded; width4.2mestimated. Structuralbaycount24/threelevels/columnbundle/archsection andconcealedrearstagevolumeestimates,notconstructiondrawings.',
    'Wholeopenoutercolonnade/annulargalleries andcentraldarkauditoriumshellat13.8mradius, shallowradialroof,lowerownfloor andstairs. PolycarbonatehasneutralopaqueaveragepanelshadingforexteriorconsistentLODs; opticaltransmission/interiorseating/performancedevicesnotreconstructed. No exterioropaqueinfillsubstituteforopenarcade.',
    'Bridgeintrinsiccircles/lowarches/railmotifanddecklatticefollowclearedviews; tinygratingaveragedontosolidthinloadbearingdecksurface toavoidmoiredensegeometry. Backstagehiddenwalls/roofsection/doorplacementsandfootingsapproximate; no inventedflytower.',
    'Independent200m101x101Terrariumfield/10201values/2rawtiles fixedbeforegeometry. SourceDEMblursquarryvegetation/waterbedandisnotlakebathymetry; no sourceflattening/fitting/grounds slab. Modelhasa bounded-7.1munderstructurefromphotographicsection. Compatiblehostwater/terrain/ownfootingsnotcertified; previewonly,replaceFootprintfalse.',
  ],
};
