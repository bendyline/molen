/** Entire photographed September2019 Durham memorial remnant; historical date opt-in only. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = { stone: rgb('c0c3bf'), iron: rgb('3c4340') };
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.3 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  world = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];

export { world as toWorld };
export const partEvidence = [],
  ballEvidence = [],
  reliefEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-10) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function cap(o, k, r, y, n = 1) {
  for (const t of ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  ))
    T(
      o,
      k,
      t.map((i) => [r[i][0], y, r[i][1]]),
      [0, n, 0],
    );
}
function solid(o, k, r, y, Y, top = r) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      c = top[(i + 1) % r.length],
      d = top[i];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [c[0], Y, c[1]],
        [d[0], Y, d[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
  cap(o, k, top, Y);
  cap(o, k, r, y, -1);
}
function box(o, k, x, y, z, w, h, d) {
  solid(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, y + h);
}
const cruciform = (w, d, cx, cz) => [
  [-cx / 2, -d / 2],
  [cx / 2, -d / 2],
  [cx / 2, -cz / 2],
  [w / 2, -cz / 2],
  [w / 2, cz / 2],
  [cx / 2, cz / 2],
  [cx / 2, d / 2],
  [-cx / 2, d / 2],
  [-cx / 2, cz / 2],
  [-w / 2, cz / 2],
  [-w / 2, -cz / 2],
  [-cx / 2, -cz / 2],
];
export const lowerCross = cruciform(A.crossWidth, A.crossDepth, A.crossCoreWidth, A.crossCoreDepth);
function roughFace(o, a, b, y, Y, lod, index) {
  const n = [b[1] - a[1], 0, a[0] - b[0]],
    L = Math.hypot(n[0], n[2]),
    out = n.map((v) => v / L),
    sections = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  for (let i = 0; i < sections; i++) {
    const t = i / sections,
      u = (i + 1) / sections,
      P = [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t],
      B = [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u],
      Cq = [B[0], Y, B[2]],
      D = [P[0], Y, P[2]];
    if (!lod) Q(o, 'stone', [P, B, Cq, D], out);
    else {
      const depth = 0.012 + 0.007 * ((index + i) % 3),
        mid = P.map((v, k) => (v + Cq[k]) / 2 + out[k] * depth),
        col = rgb((index + i) % 2 ? 'b7bbb6' : 'bfc2bd');
      for (const [x, z] of [
        [P, B],
        [B, Cq],
        [Cq, D],
        [D, P],
      ])
        T(o, 'stone', [x, z, mid], out, col);
    }
  }
}
function roughCross(o, lod) {
  for (let i = 0; i < lowerCross.length; i++)
    roughFace(
      o,
      lowerCross[i],
      lowerCross[(i + 1) % lowerCross.length],
      A.slabTop,
      A.lowerBlockTop,
      lod,
      i,
    );
  cap(o, 'stone', lowerCross, A.lowerBlockTop);
  cap(o, 'stone', lowerCross, A.slabTop, -1);
}
function reliefPoint(face, u, y, depth) {
  const half =
    (A.shaftBottomDepth +
      ((A.shaftTopDepth - A.shaftBottomDepth) * (y - A.bevelTop)) / (A.shaftTop - A.bevelTop)) /
    2;
  if (face === 'front') return [u, y, half + depth];
  const xhalf =
    (A.shaftBottomWidth +
      ((A.shaftTopWidth - A.shaftBottomWidth) * (y - A.bevelTop)) / (A.shaftTop - A.bevelTop)) /
    2;
  return [face === 'left' ? -xhalf - depth : xhalf + depth, y, u];
}
function localOutput(o) {
  return {
    addTriangle(k, _r, q, n) {
      T(o, k, q, n, C[k]);
    },
    addQuad(k, _r, q, n) {
      Q(o, k, q, n, C[k]);
    },
    addConvexPolygon(k, _r, q, n) {
      for (let i = 1; i < q.length - 1; i++) T(o, k, [q[0], q[i], q[i + 1]], n, C[k]);
    },
  };
}
function reliefBeam(o, face, a, b, w, depth = 0.015) {
  const a3 = reliefPoint(face, a[0], a[1], depth),
    b3 = reliefPoint(face, b[0], b[1], depth),
    temp = localOutput(o);
  beam(temp, 'stone', a3, b3, w, w, C.stone);
}
function disk(o, face, center, radius, depth, lod) {
  const N = [12, 20, 32, 48][lod],
    front = Array.from({ length: N }, (_, i) =>
      reliefPoint(
        face,
        center[0] + radius * Math.cos((i / N) * 2 * Math.PI),
        center[1] + radius * Math.sin((i / N) * 2 * Math.PI),
        depth,
      ),
    ),
    back = front.map((q) =>
      face === 'front'
        ? [q[0], q[1], q[2] - 0.014]
        : [q[0] + (face === 'left' ? 0.014 : -0.014), q[1], q[2]],
    ),
    n = face === 'front' ? [0, 0, 1] : [face === 'left' ? -1 : 1, 0, 0];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    T(o, 'stone', [reliefPoint(face, ...center, depth), front[i], front[j]], n);
    Q(
      o,
      'stone',
      [back[i], back[j], front[j], front[i]],
      sub(front[i], reliefPoint(face, ...center, depth)),
    );
  }
}
function medallion(o, lod) {
  const N = [12, 20, 32, 48][lod],
    cy = A.sealCenterY,
    r = A.sealRadius;
  disk(o, 'front', [0, cy], r, 0.009, lod);
  for (const rr of [r, r * 0.86])
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N,
        b = (2 * Math.PI * (i + 1)) / N;
      reliefBeam(
        o,
        'front',
        [rr * Math.cos(a), cy + rr * Math.sin(a)],
        [rr * Math.cos(b), cy + rr * Math.sin(b)],
        lod ? 0.009 : 0.014,
        0.018,
      );
    }
  if (lod) {
    // Original low-relief abstraction of the photographed round seal, no copied bitmap or tiny lettering.
    for (const x of [-0.08, 0, 0.08])
      reliefBeam(o, 'front', [x, cy - 0.06], [x, cy + 0.07], 0.018, 0.026);
    reliefBeam(o, 'front', [-0.13, cy - 0.07], [0.13, cy - 0.07], 0.025, 0.026);
    reliefBeam(o, 'front', [-0.13, cy + 0.07], [0, cy + 0.13], 0.018, 0.026);
    reliefBeam(o, 'front', [0, cy + 0.13], [0.13, cy + 0.07], 0.018, 0.026);
  }
  reliefEvidence.push({ kind: 'front-round-seal', centerY: cy, radius: r });
}
function crossedFlags(o, lod) {
  for (const face of ['left', 'right']) {
    for (const s of [-1, 1]) {
      reliefBeam(o, face, [-s * 0.23, 2.24], [s * 0.22, 2.78], lod ? 0.011 : 0.018, 0.022);
      if (lod) {
        const q = [
            [s * 0.2, 2.76],
            [s * 0.035, 2.7],
            [-s * 0.03, 2.52],
            [s * 0.12, 2.58],
          ].map((v) => reliefPoint(face, ...v, 0.026)),
          n = [face === 'left' ? -1 : 1, 0, 0];
        Q(o, 'stone', q, n);
      }
    }
    reliefEvidence.push({ kind: 'paired-crossed-flag-relief', face });
  }
}
function balls(o, lod) {
  const r = A.cannonballRadius,
    centers = [
      [-r, A.crossCapTop + r, 0.72],
      [r, A.crossCapTop + r, 0.72],
      [0, A.crossCapTop + r, 0.72 - r * Math.sqrt(3)],
      [0, A.crossCapTop + r + 2 * r * Math.sqrt(2 / 3), 0.72 - r / Math.sqrt(3)],
    ];
  const local = localOutput(o);
  for (const c of centers) {
    sphere(local, 'stone', c, [r, r, r], C.stone, [6, 10, 14, 18][lod], [4, 6, 8, 10][lod]);
    ballEvidence.push({ center: c, radius: r });
  }
}
function lampFragments(o, lod) {
  for (const x of [-0.84, 0.84]) {
    const N = [6, 8, 12, 16][lod],
      circle = (r, y) =>
        Array.from({ length: N }, (_, i) => [
          x + r * Math.cos((i / N) * 2 * Math.PI),
          y,
          r * Math.sin((i / N) * 2 * Math.PI),
        ]),
      levels = [
        [0.17, A.crossCapTop],
        [0.17, A.crossCapTop + 0.035],
        [0.11, A.crossCapTop + 0.1],
        [0.095, A.crossCapTop + 0.14],
        [0.065, A.crossCapTop + 0.16],
      ];
    for (let j = 0; j < levels.length - 1; j++) {
      const a = circle(...levels[j]),
        b = circle(...levels[j + 1]);
      for (let i = 0; i < N; i++) {
        const n = [
          Math.cos(((i + 0.5) / N) * 2 * Math.PI),
          0.3,
          Math.sin(((i + 0.5) / N) * 2 * Math.PI),
        ];
        Q(o, 'iron', [a[i], a[(i + 1) % N], b[(i + 1) % N], b[i]], n);
      }
    }
    const top = circle(...levels.at(-1));
    for (let i = 0; i < N; i++)
      T(o, 'iron', [[x, levels.at(-1)[1], 0], top[i], top[(i + 1) % N]], [0, 1, 0]);
  }
}
export function buildDurhamConfederateMonument(target, _frame, lod = 3) {
  for (const a of [partEvidence, ballEvidence, reliefEvidence]) a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-intrinsic-granite-foundation-slab', () =>
    solid(
      o,
      'stone',
      rect(-A.slabWidth / 2, A.slabWidth / 2, -A.slabDepth / 2, A.slabDepth / 2),
      A.foundationBottom,
      A.slabTop,
    ),
  );
  part('twelve-corner-cruciform-rock-faced-lower-blocks', () => roughCross(o, lod));
  part('projecting-cruciform-capping-slab-plinth-and-battered-neck', () => {
    solid(
      o,
      'stone',
      cruciform(
        A.crossWidth + 0.09,
        A.crossDepth + 0.09,
        A.crossCoreWidth + 0.09,
        A.crossCoreDepth + 0.09,
      ),
      A.lowerBlockTop,
      A.crossCapTop,
    );
    box(o, 'stone', 0, A.crossCapTop, 0, A.plinthWidth, A.plinthTop - A.crossCapTop, A.plinthDepth);
    solid(
      o,
      'stone',
      rect(-0.56, 0.56, -0.505, 0.505),
      A.plinthTop,
      A.bevelTop,
      rect(
        -A.shaftBottomWidth / 2,
        A.shaftBottomWidth / 2,
        -A.shaftBottomDepth / 2,
        A.shaftBottomDepth / 2,
      ),
    );
  });
  part('whole-tapered-memorial-shaft-four-corner-strips-and-top-cap', () => {
    solid(
      o,
      'stone',
      rect(
        -A.shaftBottomWidth / 2,
        A.shaftBottomWidth / 2,
        -A.shaftBottomDepth / 2,
        A.shaftBottomDepth / 2,
      ),
      A.bevelTop,
      A.shaftTop,
      rect(-A.shaftTopWidth / 2, A.shaftTopWidth / 2, -A.shaftTopDepth / 2, A.shaftTopDepth / 2),
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * (A.shaftTopWidth / 2 - 0.018),
          z = sz * (A.shaftTopDepth / 2 - 0.018);
        box(o, 'stone', x, A.bevelTop, z, 0.028, A.shaftTop - A.bevelTop, 0.028);
      }
    box(
      o,
      'stone',
      0,
      A.shaftTop,
      0,
      A.shaftTopWidth + 0.05,
      A.capTop - A.shaftTop,
      A.shaftTopDepth + 0.05,
    );
    if (lod)
      for (const face of ['front', 'left', 'right'])
        reliefBeam(o, face, [-0.37, 2.91], [0.37, 2.91], 0.018, 0.015);
  });
  part('round-front-medallion-and-two-side-crossed-flag-reliefs', () => {
    medallion(o, lod);
    crossedFlags(o, lod);
  });
  part('all-four-intrinsic-stone-cannonballs-and-two-broken-lamp-plinths', () => {
    balls(o, lod);
    lampFragments(o, lod);
  });
}
export const durhamConfederateMonumentSkyline = (o) => buildDurhamConfederateMonument(o, null, 0),
  durhamConfederateMonumentDistrict = (o) => buildDurhamConfederateMonument(o, null, 1),
  durhamConfederateMonumentStreet = (o) => buildDurhamConfederateMonument(o, null, 2),
  durhamConfederateMonumentCloseup = (o) => buildDurhamConfederateMonument(o, null, 3);
const cam = (q) => world(q),
  camera = cam([5.4, 3.8, 6.8]),
  look = cam([0, 1.48, 0]);
export const durhamConfederateMonumentModel = {
  id: 'confederate_soldiers_monument_durham_north_carolina',
  key: 'confederate_soldiers_monument_durham_north_carolina',
  cell: 'dn/dnr',
  title: 'Confederate Soldiers Monument, Durham — September 2019',
  wikidataId: 'Q39073820',
  category: 'monument',
  recipe: 'durham-confederate-monument-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildDurhamConfederateMonument,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  appearance: p.appearance,
  groundContactBasis: p.sectionBasis,
  brief:
    'Entire photographed September2019remnant of Durham memorial: low granite slab/cruciform rock-faced blocks/cap/plinth/battered neck/tapered framed shaft/round seal/two side crossed-flag reliefs/four cannonballs/two broken lamp plinths. Three exact published WarrenLeMayCC0obliques. Soldier already absent in represented condition, whole remaining base removed2020. Historical2019-09-01date only, excluded current world. Original photo-proportioned exterior with approximate former point registration.',
  camera,
  lookAt: look,
  portableGroundY: F - 0.16,
  embeddedCanonicalGraphs: ['stone_granite', 'metal_painted'],
  mediumFiContext: {
    scale: 1,
    groundY: F - 0.16,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'whole-front-and-left-remnant', position: cam([-5, 3.4, 6]), lookAt: look },
    { name: 'whole-front-and-right-remnant', position: cam([5, 3.4, 6]), lookAt: look },
    {
      name: 'whole-rear-native-point-registered-remnant',
      position: cam([4, 3.2, -6]),
      lookAt: look,
    },
    {
      name: 'low-cruciform-base-four-cannonballs-and-lamp-fragments',
      position: cam([3.2, 2.0, 4]),
      lookAt: cam([0, 0.8, 0.3]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-remnant-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/durham-confederate-monument-runtime-overlay.mjs',
    level: 'skyline',
    export: 'durhamConfederateMonumentSkyline',
    errorMeters: 0.1,
    surfaces,
    authoredLevels: {
      district: { export: 'durhamConfederateMonumentDistrict', errorMeters: 0.055, surfaces },
      street: { export: 'durhamConfederateMonumentStreet', errorMeters: 0.025, surfaces },
      closeup: { export: 'durhamConfederateMonumentCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'All dimensions, intrinsic cross/slab proportions, shaft taper/section heights, rough faces, medallion/flag details, cannonball stack and damaged lamp fragments are bounded original photo-derived estimates. No measured native perimeter exists; geographic point/orientation/2019grade/contact remain approximate. Fine inscription typography/seal heraldry and temporary flowers/debris not reproduced. All intrinsic physical remnant parts retained.',
    'Historical appearance is only exact documented2019-09-01day; bronze figure had already gone in2017. No full intact1924reconstruction is asserted, no modern surviving structure/default-world activation. Existing courthouse/planting curb/sidewalk/trees/flagpole/benches are separate context. Current original terrain is not a historic ground survey and may meet/intersect lower base; source field/frame/floor/mainsections fixed.',
  ],
};
