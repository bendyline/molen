/** Whole native Bridge of No Return: pierced concrete parapets and four blue entry bollards. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/wy/wyd/bridge_of_no_return/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  lo = p.axis[0][1],
  hi = p.axis.at(-1)[1],
  C = {
    concrete: rgb('979b91'),
    weathered: rgb('60665d'),
    road: rgb('aaa99d'),
    trim: rgb('abb0a1'),
    blue: rgb('79bed0'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    weathered: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.99, metallic: 0 },
    road: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    blue: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.15 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const normal = normalFor(...q);
  if (normal.every((v) => v === 0)) return;
  if (n && normal.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) => (Math.abs(N[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x0, y0, z0, x1, y1, z1, col = C[s]) {
  box(o, s, [x0, y0, z0], [x1, y1, z1], col);
}
function prism(o, s, ring, y0, y1) {
  const ix = earcut(ring.flat()),
    sign = Math.sign(
      ring.reduce(
        (v, a, i) =>
          v + a[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * a[1],
        0,
      ),
    );
  for (let i = 0; i < ix.length; i += 3)
    for (const [y, up] of [
      [y0, -1],
      [y1, 1],
    ])
      T(
        o,
        s,
        ix.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]),
        [0, up, 0],
      );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
    );
  }
}
function taperedPost(o, x, z, w, d, end = false) {
  const y0 = 0.29,
    y1 = end ? 1.38 : 1.37,
    depth = end ? 0.55 : 0.3,
    bevel = d > 1 ? 0.035 : 0;
  const ring = (r) =>
    bevel
      ? [
          [x - r + bevel, z - depth / 2],
          [x + r - bevel, z - depth / 2],
          [x + r, z - depth / 2 + bevel],
          [x + r, z + depth / 2 - bevel],
          [x + r - bevel, z + depth / 2],
          [x - r + bevel, z + depth / 2],
          [x - r, z + depth / 2 - bevel],
          [x - r, z - depth / 2 + bevel],
        ]
      : [
          [x - r, z - depth / 2],
          [x + r, z - depth / 2],
          [x + r, z + depth / 2],
          [x - r, z + depth / 2],
        ];
  const a = ring(w / 2),
    b = ring(w / 2 - (end ? 0.035 : 0));
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    Q(
      o,
      'weathered',
      [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      [a[j][1] - a[i][1], 0, a[i][0] - a[j][0]],
    );
  }
  const ix = earcut(b.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'trim',
      ix.slice(i, i + 3).map((k) => [b[k][0], y1, b[k][1]]),
      [0, 1, 0],
    );
}
function cylinder(o, x, z, y0, y1, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      A = (y, t) => [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    Q(
      o,
      'blue',
      [A(y0, a), A(y0, b), A(y1, b), A(y1, a)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    T(o, 'blue', [[x, y1, z], A(y1, a), A(y1, b)], [0, 1, 0]);
    T(o, 'blue', [[x, y0, z], A(y0, b), A(y0, a)], [0, -1, 0]);
  }
}
function deck(o, d) {
  prism(o, 'concrete', p.outline, -0.3, 0.15);
  B(o, 'road', -1.83, 0.15, lo + 0.01, 1.83, 0.168, hi - 0.01);
  for (const side of [-1, 1]) {
    const x = side * 2.07;
    B(o, 'concrete', x - 0.27, 0.15, lo, x + 0.27, 0.29, hi);
    B(o, 'weathered', side * 1.25 - 0.18, -0.95, lo + 0.45, side * 1.25 + 0.18, -0.3, hi - 0.45);
  }
  for (const z of [lo + 0.75, hi - 0.75]) {
    B(o, 'concrete', -2.36, -2.9, z - 0.65, 2.36, -0.3, z + 0.65);
    for (const side of [-1, 1])
      B(o, 'weathered', side * 2.1 - 0.18, -2.9, z - 1.9, side * 2.1 + 0.18, 0.18, z + 1.9);
  }
  for (let i = 0; i < 7; i++) {
    const z = lo + 18.1 + (i * (p.length - 36.2)) / 6;
    B(o, 'concrete', -1.9, -1.35, z - 0.3, 1.9, -0.85, z + 0.3);
    for (const x of [-1.3, 1.3]) {
      B(o, 'concrete', x - 0.25, d ? -5.3 : -5.6, z - 0.28, x + 0.25, -1.35, z + 0.28);
      if (d) B(o, 'weathered', x - 0.52, -5.6, z - 0.6, x + 0.52, -5.25, z + 0.6);
    }
  }
  if (d > 1)
    for (let i = 1; i < 8; i++) {
      const z = lo + (p.length * i) / 8;
      B(o, 'weathered', -1.8, 0.168, z - 0.011, 1.8, 0.171, z + 0.011);
      for (const side of [-1, 1])
        B(o, 'concrete', side * 1.25 - 0.19, -0.98, z - 0.18, side * 1.25 + 0.19, -0.93, z + 0.18);
    }
}
function parapets(o, d) {
  const bays = [12, 24, 48, 48][d],
    bars = [0, 4, 6, 6][d],
    step = p.length / bays;
  for (const side of [-1, 1]) {
    const x = side * 2.1;
    B(o, 'weathered', x - 0.13, 0.29, lo + 0.22, x + 0.13, 0.43, hi - 0.22);
    B(o, 'weathered', x - 0.16, 1.16, lo + 0.22, x + 0.16, 1.3, hi - 0.22);
    B(o, 'trim', x - 0.18, 1.3, lo + 0.22, x + 0.18, 1.35, hi - 0.22);
    for (let i = 0; i <= bays; i++) {
      const z = i === 0 ? lo + 0.28 : i === bays ? hi - 0.28 : lo + i * step;
      taperedPost(o, x, z, i === 0 || i === bays ? 0.49 : 0.28, d, i === 0 || i === bays);
    }
    for (let i = 0; i < bays; i++)
      for (let k = 1; k <= bars; k++) {
        const z = lo + i * step + (step * k) / (bars + 1),
          w = d === 1 ? 0.13 : 0.12;
        const tone = (((i * 13 + k * 3) % 9) - 4) * 0.007,
          col = C.weathered.map((v) => Math.max(0, v + tone));
        B(o, 'weathered', x - 0.1, 0.43, z - w / 2, x + 0.1, 1.16, z + w / 2, col);
        if (d === 3) {
          B(o, 'concrete', x - 0.104, 0.45, z - w / 2 - 0.009, x + 0.104, 1.14, z - w / 2 + 0.009);
          B(o, 'concrete', x - 0.104, 0.45, z + w / 2 - 0.009, x + 0.104, 1.14, z + w / 2 + 0.009);
        }
      }
    if (d > 1)
      for (let i = 1; i < bays; i++) {
        const z = lo + i * step;
        B(o, 'weathered', x - 0.181, 1.3501, z - 0.01, x + 0.181, 1.354, z + 0.01);
      }
  }
}
function bollards(o, d) {
  const n = [4, 8, 12, 24][d],
    z = hi - 0.7;
  for (const x of [-1.48, -0.49, 0.49, 1.48]) {
    cylinder(o, x, z, 0.168, 0.33, 0.155, n);
    cylinder(o, x, z, 0.33, 1.348, 0.115, n);
    if (d > 1) {
      cylinder(o, x, z, 1.22, 1.25, 0.12, n);
      cylinder(o, x, z, 1.335, 1.36, 0.12, n);
    }
  }
}
function build(o, _f, d = 3) {
  deck(o, d);
  parapets(o, d);
  bollards(o, d);
}
export const bridgeOfNoReturnSkyline = (o, f) => build(o, f, 0),
  bridgeOfNoReturnDistrict = (o, f) => build(o, f, 1),
  bridgeOfNoReturnStreet = (o, f) => build(o, f, 2),
  bridgeOfNoReturnCloseup = (o, f) => build(o, f, 3);
export const bridgeOfNoReturnModel = {
  id: 'bridge_of_no_return',
  key: 'bridge_of_no_return',
  cell: 'wy/wyd',
  recipe: 'structure-bridge-of-no-return.mjs',
  title: 'Bridge of No Return, Panmunjom',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [75, 46, 125],
  lookAt: [0, -0.8, 0],
  portableGroundY: -6.0,
  mediumFiContext: { scale: 1.15, groundY: -6.0 },
  qaCameras: [
    {
      name: 'whole-native-crossing-pierced-parapets-and-low-bents',
      position: [66, 24, 110],
      lookAt: [0, -0.7, 0],
    },
    {
      name: 'four-blue-entry-bollards-and-actual-parapet-slots',
      position: [-5, 3.4, 83],
      lookAt: [0, 0.8, 60],
    },
    {
      name: 'whole-low-girders-open-twin-column-bents-and-abutments',
      position: [24, -0.2, 15],
      lookAt: [0, -2.4, 6],
    },
    {
      name: 'weathered-concrete-slot-bars-posts-and-cap-rail',
      position: [5.2, 2.4, 58],
      lookAt: [2.1, 0.9, 54],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400m field frozen before any geometry at fixed east approach; raw ground unchanged. Concealed bents/abutment depths are bounded assumptions. Actual host bank/river/threshold contact remains unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bridge-of-no-return.mjs',
    level: 'skyline',
    export: 'bridgeOfNoReturnSkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'bridgeOfNoReturnDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'bridgeOfNoReturnStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'bridgeOfNoReturnCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Three published Qualla originals individually inspected/native SHA1 matched: Edward N Johnson Army Public Affairs2008/PD-USGov-Military-Army and Wbfergus own1975/1976 PD-user. Existing published PD policy passes unchanged; fourth summer Army image excluded. No copied photograph/diagram, photo texture, generated bitmap or downloaded mesh.',
    'Native whole144.68m extent and all six original perimeter vertices preserved, with both road-bridge axis halves. Straight low concrete girder/slab deck, open narrow passage, curbs, pierced concrete parapets/heavier endposts, and exactly four blue bollards. No suspension cables/towers, checkpoint buildings, MDL sign, roads, people, vehicles, trees, river water or site floor.',
    'Photo-proportioned deck0.15m/0.45m slab/0.65m girders/parapet1.15m/48panels/six bars and four1.18m entry bollards, seven representative low twin-column bents/abutments are original estimates. Vegetation hides most underside; support census/heights/foundations/landward limits and fine current cosmetics are not engineering survey. Lower supports extend to-5.6m as bounded geometry, not derived river bathymetry.',
    'Independent400m129x129/16641 samples/two original Terrarium tiles frozen before geometry; datum15.0243m, whole relative field[-5.4068,2.3288]m unchanged/no fit/flatten/reacquire. Portable/shared isolated stage Y-6m exposes low supports separately from native ground. Geographic preview/replaceFootprint=false; real host terrain/threshold and bank attachment unverified.',
  ],
};
