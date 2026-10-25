/** Whole original Paraná Friendship Bridge: native full route and engineered concrete box arch. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/6g/6g3/friendship_bridge_brazil_paraguay/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  L = plan.axis[0][0],
  H = plan.axis.at(-1)[0],
  half = 303 / 2;
const C = {
  concrete: rgb('bec5b6'),
  road: rgb('a6afa3'),
  roof: rgb('91a5a1'),
  trim: rgb('778e87'),
  foundation: rgb('9ea99e'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.92, metallic: 0.14 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.94, metallic: 0.05 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
};
function T(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  const q = normalFor(...p);
  if (q.every((v) => v === 0)) return;
  if (n && q.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, [p[0], p[1], p[2]], n);
  T(o, s, [p[0], p[2], p[3]], n);
}
const zAt = (x) => {
    let i = 1;
    while (i < plan.axis.length - 1 && plan.axis[i][0] < x) i++;
    const a = plan.axis[i - 1],
      b = plan.axis[i];
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  },
  roadY = (x) => 1.8 * (1 - (x * x) / (H * H)),
  P = (x, y, z) => [x, y, zAt(x) + z],
  archY = (x) => -3.3 - (53 * x * x) / (half * half),
  archDepth = (x) => 3 + (3.5 * x * x) / (half * half);
function stations(d, lo = L, hi = H) {
  const v = new Set([lo, hi, ...plan.axis.map((p) => p[0]).filter((x) => x > lo && x < hi)]);
  if (!d) {
    for (const x of [-half, half]) if (x > lo && x < hi) v.add(x);
  } else
    for (
      let x = Math.ceil(lo / [0, 35, 18, 8][d]) * [0, 35, 18, 8][d];
      x < hi;
      x += [0, 35, 18, 8][d]
    )
      v.add(x);
  return [...v].sort((a, b) => a - b);
}
function ribbon(o, s, xs, z0, z1, top, bottom) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      ta = top(a),
      tb = top(b),
      ba = bottom(a),
      bb = bottom(b);
    Q(o, s, [P(a, ta, z0), P(b, tb, z0), P(b, tb, z1), P(a, ta, z1)], [0, 1, 0]);
    Q(o, s, [P(a, ba, z0), P(a, ba, z1), P(b, bb, z1), P(b, bb, z0)], [0, -1, 0]);
    Q(o, s, [P(a, ba, z0), P(b, bb, z0), P(b, tb, z0), P(a, ta, z0)], [0, 0, -1]);
    Q(o, s, [P(a, ba, z1), P(a, ta, z1), P(b, tb, z1), P(b, bb, z1)], [0, 0, 1]);
  }
  for (const x of [xs[0], xs.at(-1)])
    Q(
      o,
      s,
      [P(x, bottom(x), z0), P(x, top(x), z0), P(x, top(x), z1), P(x, bottom(x), z1)],
      [x === xs[0] ? -1 : 1, 0, 0],
    );
}
function stick(o, s, a, b, w, d) {
  if (d > 1) beam(o, s, a, b, w, w, C[s]);
  else {
    const v = b.map((v, i) => v - a[i]),
      h = Math.hypot(v[0], v[1]),
      u = h ? [-v[1] / h, v[0] / h, 0] : [1, 0, 0],
      p = [
        a.map((v, i) => v - (u[i] * w) / 2),
        b.map((v, i) => v - (u[i] * w) / 2),
        b.map((v, i) => v + (u[i] * w) / 2),
        a.map((v, i) => v + (u[i] * w) / 2),
      ];
    Q(o, s, p);
    Q(o, s, [...p].reverse());
  }
}
function cylinder(o, s, x, z, y0, y1, r, d) {
  const n = [4, 8, 8, 20][d];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      A = (y, t) => P(x + r * Math.cos(t), y, z + r * Math.sin(t));
    Q(
      o,
      s,
      [A(y0, a), A(y0, b), A(y1, b), A(y1, a)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    if (d) {
      T(o, s, [P(x, y1, z), A(y1, a), A(y1, b)], [0, 1, 0]);
      T(o, s, [P(x, y0, z), A(y0, b), A(y0, a)], [0, -1, 0]);
    }
  }
}
function deck(o, d) {
  const xs = stations(d);
  ribbon(o, 'concrete', xs, -6.75, 6.75, roadY, (x) => roadY(x) - 1.1);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    Q(
      o,
      'road',
      [
        P(a, roadY(a) + 0.012, -4.75),
        P(b, roadY(b) + 0.012, -4.75),
        P(b, roadY(b) + 0.012, 4.75),
        P(a, roadY(a) + 0.012, 4.75),
      ],
      [0, 1, 0],
    );
  }
  for (const [z0, z1] of [
    [-6.75, -4.75],
    [4.75, 6.75],
  ])
    ribbon(o, 'concrete', xs, z0, z1, (x) => roadY(x) + 0.18, roadY);
  if (d > 1) {
    for (const side of [-1, 1])
      ribbon(
        o,
        'concrete',
        xs,
        side * 4.75 - 0.07,
        side * 4.75 + 0.07,
        (x) => roadY(x) + 0.28,
        (x) => roadY(x) + 0.18,
      );
    for (const x of [-half, plan.axis[1][0], half])
      stick(o, 'trim', P(x, roadY(x) + 0.025, -4.74), P(x, roadY(x) + 0.025, 4.74), 0.045, d);
  }
}
function structure(o, d) {
  const n = [12, 32, 72, 120][d],
    xs = Array.from({ length: n + 1 }, (_, i) => -half + (303 * i) / n);
  ribbon(o, 'concrete', xs, -4.75, 4.75, archY, (x) => archY(x) - archDepth(x));
  for (let x = -135; x <= 135; x += 30) {
    for (const z of [-3.35, 3.35])
      cylinder(o, 'concrete', x, z, archY(x) - 1, roadY(x) - 1.05, 0.7, d);
    if (d > 1)
      ribbon(
        o,
        'concrete',
        [x - 0.65, x + 0.65],
        -4.9,
        4.9,
        (q) => roadY(q) - 1.0,
        (q) => roadY(q) - 1.45,
      );
  }
  for (const x of [-half, half]) {
    ribbon(
      o,
      'foundation',
      [x - 6.5, x + 6.5],
      -5.6,
      5.6,
      () => -54.8,
      () => -70,
    );
    for (const z of [-3.2, 3.2]) cylinder(o, 'concrete', x, z, -54.8, roadY(x) - 1.0, 1.65, d);
    if (d)
      ribbon(
        o,
        'concrete',
        [x - 2.8, x + 2.8],
        -6.4,
        6.4,
        (q) => roadY(q) - 1,
        (q) => roadY(q) - 2.5,
      );
  }
  for (const x of [-247, -207, -177, 177, 207, 247]) {
    const y = -9 - (H - Math.abs(x)) * 0.32;
    for (const z of [-3.4, 3.4]) cylinder(o, 'concrete', x, z, y, roadY(x) - 1, 0.9, d);
    if (d > 1)
      ribbon(
        o,
        'foundation',
        [x - 2, x + 2],
        -5.2,
        5.2,
        () => y + 0.2,
        () => y - 2.3,
      );
  }
  for (const side of [-1, 1]) {
    const x = side > 0 ? H : L;
    ribbon(
      o,
      'foundation',
      [x - 0.9, x + 0.9],
      -6.8,
      6.8,
      () => -0.05,
      () => -6.4,
    );
  }
}
function rail(o, d) {
  const xs = stations(d);
  for (const side of [-1, 1]) {
    const z = side * 6.62;
    for (const y of [0.55, 1.18]) {
      if (d > 1)
        ribbon(
          o,
          'concrete',
          xs,
          z - 0.1,
          z + 0.1,
          (x) => roadY(x) + y + 0.085,
          (x) => roadY(x) + y - 0.085,
        );
      else
        for (let i = 1; i < xs.length; i++) {
          const a = xs[i - 1],
            b = xs[i],
            p = [
              P(a, roadY(a) + y - 0.09, z),
              P(b, roadY(b) + y - 0.09, z),
              P(b, roadY(b) + y + 0.09, z),
              P(a, roadY(a) + y + 0.09, z),
            ];
          Q(o, 'concrete', p, [0, 0, side]);
          Q(o, 'concrete', [...p].reverse(), [0, 0, -side]);
        }
    }
    const count = Math.ceil((H - L) / [40, 12, 5, 2.4][d]);
    for (let k = 0; k <= count; k++) {
      const x = L + ((H - L) * k) / count;
      stick(
        o,
        'concrete',
        P(x, roadY(x) + 0.18, z),
        P(x, roadY(x) + 1.27, z),
        d > 1 ? 0.23 : 0.3,
        d,
      );
    }
  }
}
function canopy(o, path, d) {
  if (path.covered !== 'yes') return;
  const side = path.line.reduce((s, p) => s + p[1], 0) > 0 ? 1 : -1,
    lo = Math.min(...path.line.map((p) => p[0])),
    hi = Math.max(...path.line.map((p) => p[0])),
    zc = side * 5.75,
    az = zc - 0.95,
    bz = zc + 0.95,
    n = [2, 4, 4, 12][d],
    sxs = new Set([lo, hi, ...path.line.map((p) => p[0])]);
  if (d > 1) for (let x = Math.ceil(lo / 18) * 18; x < hi; x += 18) sxs.add(x);
  const xs = [...sxs].sort((a, b) => a - b),
    rise = (z) => 2.7 + 0.4 * Math.sin((Math.PI * (z - az)) / (bz - az));
  for (let i = 1; i < xs.length; i++)
    for (let k = 0; k < n; k++) {
      const a = xs[i - 1],
        b = xs[i],
        z0 = az + ((bz - az) * k) / n,
        z1 = az + ((bz - az) * (k + 1)) / n,
        p = [
          P(a, roadY(a) + rise(z0), z0),
          P(b, roadY(b) + rise(z0), z0),
          P(b, roadY(b) + rise(z1), z1),
          P(a, roadY(a) + rise(z1), z1),
        ];
      Q(o, 'roof', p, [0, 1, 0]);
      if (d)
        Q(
          o,
          'roof',
          p.map((p) => p.map((v, k) => v - (k === 1 ? 0.07 : 0))),
          [0, -1, 0],
        );
    }
  const count = Math.ceil((hi - lo) / [80, 18, 12, 5][d]);
  for (let k = 0; k <= count; k++) {
    const x = lo + ((hi - lo) * k) / count;
    for (const z of d ? [az, bz] : [side > 0 ? bz : az])
      stick(o, 'trim', P(x, roadY(x) + 0.18, z), P(x, roadY(x) + 2.7, z), 0.08, d);
    if (d)
      for (let j = 0; j < n; j++) {
        const z0 = az + ((bz - az) * j) / n,
          z1 = az + ((bz - az) * (j + 1)) / n;
        stick(
          o,
          'trim',
          P(x, roadY(x) + rise(z0) - 0.06, z0),
          P(x, roadY(x) + rise(z1) - 0.06, z1),
          0.055,
          d,
        );
      }
  }
  if (d) {
    const z = side > 0 ? bz : az;
    for (const y of [1.3, 1.95, 2.6])
      for (let i = 1; i < xs.length; i++)
        stick(
          o,
          'trim',
          P(xs[i - 1], roadY(xs[i - 1]) + y, z),
          P(xs[i], roadY(xs[i]) + y, z),
          d > 1 ? 0.025 : 0.04,
          Math.min(d, 1),
        );
    if (d > 1) {
      const step = d > 2 ? 0.5 : 2.5;
      for (let x = lo + 0.2; x < hi; x += step)
        stick(o, 'trim', P(x, roadY(x) + 1.27, z), P(x, roadY(x) + 2.65, z), 0.018, 1);
    }
  }
}
function build(o, _f, d = 3) {
  deck(o, d);
  structure(o, d);
  rail(o, d);
  for (const path of plan.sidePaths) canopy(o, path, d);
}
export const friendshipBridgeBrazilParaguaySkyline = (o, f) => build(o, f, 0);
export const friendshipBridgeBrazilParaguayDistrict = (o, f) => build(o, f, 1);
export const friendshipBridgeBrazilParaguayStreet = (o, f) => build(o, f, 2);
export const friendshipBridgeBrazilParaguayModel = {
  id: 'friendship_bridge_brazil_paraguay',
  key: 'friendship_bridge_brazil_paraguay',
  recipe: 'structure-friendship-bridge-brazil-paraguay.mjs',
  cell: '6g/6g3',
  title: 'Friendship Bridge (Brazil–Paraguay)',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole original Friendship Bridge: both complete native national halves/full554.1388mroute,13.5mdeck/9.5mconcrete road/raised walks, single fixed three-cell box-arch exterior on circular spandrel columns, massive intrinsic springing bases and approach supports, two-course concrete rail from cleared QuallaCC0detail, native three covered side-path halves and one open half, representative curved metal pedestrian covers/open security grids. Primary owner/engineering dimensions and native whole geography; box/support/canopy fine profiles and ground contact are estimates. No newer Integration Bridge/river/city/border posts/traffic/painted lettering.',
  camera: [340, 165, 480],
  lookAt: [0, -24, 0],
  portableGroundY: -75,
  mediumFiContext: { scale: 1.4, groundY: -75 },
  qaCameras: [
    {
      name: 'whole-both-national-halves-fixed-box-arch-and-covered-walks',
      position: [180, 118, 415],
      lookAt: [0, -22, 0],
    },
    {
      name: 'single-box-arch-circular-spandrel-columns-and-open-channel',
      position: [85, -21, 190],
      lookAt: [0, -28, 0],
    },
    {
      name: 'two-course-concrete-rail-covered-walkway-and-open-screen',
      position: [85, 7, 20],
      lookAt: [82, 2.6, 5.8],
    },
    {
      name: 'paraguay-uncovered-north-walk-and-complete-western-approach',
      position: [-220, 10, -28],
      lookAt: [-225, 1.5, -5.5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent1536mfield frozen before geometry at actual Brazil endpoint-plus3mapproach. Raw composite DEM has implausible inland pits; those are not river bathymetry or a footing control. Ground/river/footing/host contact unverified; isolated fixture groundY-75is not modeled geography.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-friendship-bridge-brazil-paraguay.mjs',
    level: 'skyline',
    export: 'friendshipBridgeBrazilParaguaySkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'friendshipBridgeBrazilParaguayDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'friendshipBridgeBrazilParaguayStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exact published2012Monocletophat1234000x3000QuallaCC0own-work original controls ONLY the concrete rail/post profile/material. Full35source families inventoried without conflicts; all other city/inauguration/attribution/unrelated sources excluded. Native category search produced no additional accepted whole-bridge image. No claim of an inspected arch overview; arch/deck/support construction follows original geographic data and primary owner/engineering text, with bounded original geometry. No copied photograph/diagram/generated bitmap, painted text/national-color panels, city/river/traffic/border-post assets.',
    'Owner gives13.5moverall/9.5mroad,303march and78mcentralheight; public technical text gives53mrise, one fixed three-cell box section and circular supports.303maxis/290mclear definitions differ; model uses303mspringing axes with estimated intrinsic springing bases, without stretching full554.1388mnative route. Closed exterior box represents three-cell structure; internal cells are not an exposed cutaway. Box9.5mouterwidth/3–6.5mdepth, supports/station/census, foundation depths,1.8mhumpback, current neutral finish and metal-cover/screen profiles remain engineering estimates.78mreported height is not asserted as normal-water clearance.',
    'Both national polygons/all original side paths/endpoint-border axis retained in controls. Mapped core is only about10–11mwide; owner-width structural deck/walk overhangs are explicitly reconstructed around the unchanged native road. Three native covered=yeshalves are covered; Paraguay north path1090783193covered=noremains open. Exact post2016cover asymmetry/current details and footing contact are not a survey; no different newer Integration Bridge substituted.',
    'Independent1536m129x129at12mfield/16641samples from6original Terrarium tiles; fixed Brazil dry approach before geometry. Provider149.1233m/whole relative[-1717.1609,34.8767]m; original grid/PNG unchanged without fitting/clipping/flattening. Implausible absolute minimum-1568.0376minthis inland river field is suspected composite/nodata error, not physical riverbed; never used for bridge or foundation geometry. True river/approach/footing/host contact unverified. Geographic preview only, replaceFootprint=false; compatible host terrain needed.',
  ],
};
