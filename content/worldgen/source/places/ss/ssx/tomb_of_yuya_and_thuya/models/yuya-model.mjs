/** Whole, hollow KV46: original dimensioned excavation plan and independent native frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  native = JSON.parse(fs.readFileSync(new URL('../native-controls.json', import.meta.url))),
  D = p.dimensions,
  S = p.stations,
  Y = p.levels,
  H = p.ceilingParameters;
export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  worn: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
};
const C = { rock: rgb('c6b99f'), worn: rgb('b7aa8d') },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  lift = (a, y) => [a[0], y, a[1]],
  clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const metricOutline = [
  [-0.675, 0],
  [0.675, 0],
  [0.675, 0.25],
  [0.875, 0.25],
  [0.865, S.corridorEnd],
  [0.65, S.corridorEnd],
  [0.65, S.lowerStairStart],
  [1.38, S.lowerStairStart],
  [1.38, S.lowerStairEnd],
  [0.6, S.lowerStairEnd],
  [0.6, S.lastDoor],
  [7.82, S.lastDoor],
  [7.82, S.chamberFarNorth],
  [-1.72, S.chamberFarNear],
  [-1.72, S.lastDoor],
  [-0.6, S.lastDoor],
  [-0.6, S.lowerStairEnd],
  [-1.38, S.lowerStairEnd],
  [-1.38, S.lowerStairStart],
  [-0.65, S.lowerStairStart],
  [-0.65, S.corridorEnd],
  [-0.865, S.corridorEnd],
  [-0.875, 0.25],
  [-0.675, 0.25],
];
function T(o, k, q, v, col = C[k]) {
  q = q.map((a) => a.map(Math.fround));
  const n = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...n) < 1e-9) return;
  if (v && dot(n, v) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
function poly(o, k, r, y, up = 1) {
  if (r.length < 3) return;
  const pts = r.map((q) => new Vector2(...q));
  for (const t of ShapeUtils.triangulateShape(pts, []))
    T(
      o,
      k,
      t.map((i) => lift(r[i], typeof y === 'function' ? y(r[i]) : y)),
      [0, up, 0],
    );
}
function clip(r, axis, k, sign) {
  if (!r.length) return [];
  let out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = (a[axis] - k) * sign,
      db = (b[axis] - k) * sign;
    if (da >= -1e-9) out.push(a);
    if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
      const t = da / (da - db);
      out.push(mix(a, b, t));
    }
  }
  out = out.filter((q, i) => !i || Math.hypot(...sub(q, out[i - 1])) > 1e-8);
  if (out.length > 1 && Math.hypot(...sub(out[0], out.at(-1))) < 1e-8) out.pop();
  return out;
}
const slice = (r, z, Z, x = -Infinity, X = Infinity) => {
  let q = clip(clip(r, 1, z, 1), 1, Z, -1);
  if (Number.isFinite(x)) q = clip(q, 0, x, 1);
  if (Number.isFinite(X)) q = clip(q, 0, X, -1);
  return q;
};
export function smoothFloor(z) {
  if (z <= S.corridorStart) return Y.firstDoor;
  if (z < S.corridorEnd)
    return (
      Y.firstDoor + ((Y.corridorEnd - Y.firstDoor) * (z - S.corridorStart)) / D.corridorProjected
    );
  if (z <= S.lowerStairStart) return Y.corridorEnd;
  if (z < S.lowerStairEnd)
    return Y.corridorEnd - (D.lowerStairDrop * (z - S.lowerStairStart)) / D.lowerStairGoing;
  if (z < S.lastDoor) return Y.lowerLanding;
  return Y.chamber;
}
export function ceiling(x, z, lod = 3) {
  let y;
  if (z < S.corridorStart) y = Y.firstDoor + H.firstPortalClearance;
  else if (z < S.corridorEnd) {
    const t = (z - S.corridorStart) / D.corridorProjected;
    y =
      smoothFloor(z) +
      H.corridorStartClearance +
      (H.corridorEndClearance - H.corridorStartClearance) * t;
  } else if (z < S.lowerStairStart) y = Y.corridorEnd + H.corridorEndClearance;
  else if (z < S.lowerStairEnd) {
    const t = (z - S.lowerStairStart) / D.lowerStairGoing;
    y =
      smoothFloor(z) +
      H.corridorEndClearance +
      (D.lastDoorHeight - H.corridorEndClearance) * t +
      H.lowerStairRoughHump * Math.sin(t * Math.PI);
  } else if (z < S.lastDoor) y = Y.lowerLanding + D.lastDoorHeight;
  else {
    const t = clamp((z - S.lastDoor) / (S.chamberFarNorth - S.lastDoor), 0, 1);
    y = H.chamberSpring + H.chamberCenterRise * Math.sin(t * Math.PI);
  }
  return (
    y + (lod >= 2 ? H.surfaceIrregularity * Math.sin(x * 3.7 + z * 2.3) * Math.sin(z * 4.1) : 0)
  );
}
function floorEdge(x, z, lod) {
  if (z >= S.lowerStairStart - 1e-7 && z <= S.lowerStairEnd + 1e-7) {
    if (Math.abs(x) > D.lowerStairWidth / 2 + 1e-6)
      return smoothFloor(z) + D.nicheLedgeHeightEstimate;
    if (lod === 0) return smoothFloor(z);
    const j = clamp(
      Math.ceil(((z - S.lowerStairStart) / D.lowerStairGoing) * D.lowerRisers - 1e-6),
      1,
      D.lowerRisers,
    );
    return Y.corridorEnd - (D.lowerStairDrop * j) / D.lowerRisers;
  }
  return smoothFloor(z);
}
function slab(o, r, fn, k = 'worn') {
  poly(o, k, r, fn);
  poly(o, 'rock', r, (q) => fn(q) - 0.28, -1);
}
export const partEvidence = [],
  stairEvidence = [],
  doorEvidence = [];
function floorSystem(o, lod) {
  for (const [z, Z] of [
    [0, S.corridorStart],
    [S.corridorStart, S.corridorEnd],
    [S.corridorEnd, S.lowerStairStart],
    [S.lowerStairEnd, S.lastDoor],
    [S.lastDoor, S.chamberFarNorth],
  ])
    slab(o, slice(metricOutline, z, Z), (q) =>
      smoothFloor(z === S.lastDoor ? S.lastDoor : clamp(q[1], z + 1e-7, Z - 1e-7)),
    );
  const n = lod === 0 ? 1 : D.lowerRisers;
  for (let j = 0; j < n; j++) {
    const z = S.lowerStairStart + (D.lowerStairGoing * j) / n,
      Z = S.lowerStairStart + (D.lowerStairGoing * (j + 1)) / n,
      y = Y.corridorEnd - (D.lowerStairDrop * (j + 1)) / n,
      fn = lod === 0 ? (q) => smoothFloor(q[1]) : () => y;
    slab(o, slice(metricOutline, z, Z, -D.lowerStairWidth / 2, D.lowerStairWidth / 2), fn);
    for (const [x, X] of [
      [-Infinity, -D.lowerStairWidth / 2],
      [D.lowerStairWidth / 2, Infinity],
    ])
      slab(
        o,
        slice(metricOutline, z, Z, x, X),
        (q) => smoothFloor(q[1]) + D.nicheLedgeHeightEstimate,
      );
    if (lod > 0) {
      const yy = Y.corridorEnd - (D.lowerStairDrop * j) / n;
      Q(
        o,
        'worn',
        [
          [-0.82, yy, z],
          [0.82, yy, z],
          [0.82, y, z],
          [-0.82, y, z],
        ],
        [0, 0, -1],
      );
      stairEvidence.push({
        flight: 'lower',
        index: j,
        z,
        Z,
        y,
        previous: yy,
        width: D.lowerStairWidth,
      });
    }
    for (const x of [-0.82, 0.82])
      Q(
        o,
        'rock',
        [
          [x, fn([x, z]), z],
          [x, fn([x, Z]), Z],
          [x, smoothFloor(Z) + 0.8, Z],
          [x, smoothFloor(z) + 0.8, z],
        ],
        [Math.sign(x) * -1, 0, 0],
      );
  }
  // The section shows a one-metre floor drop beyond the chamber doorway.
  Q(
    o,
    'rock',
    [
      [-0.6, Y.lowerLanding, S.lastDoor],
      [0.6, Y.lowerLanding, S.lastDoor],
      [0.6, Y.chamber, S.lastDoor],
      [-0.6, Y.chamber, S.lastDoor],
    ],
    [0, 0, 1],
  );
}
function wallSystem(o, lod) {
  for (let i = 1; i < metricOutline.length; i++) {
    const a = metricOutline[i],
      b = metricOutline[(i + 1) % metricOutline.length],
      v = sub(b, a),
      L = Math.hypot(...v);
    if (L < 1e-8) continue;
    const N = [-v[1] / L, 0, v[0] / L],
      parts = lod < 2 ? 1 : Math.max(1, Math.ceil(L / 1.2)),
      off = (q) => [
        q[0] - N[0] * D.rockShellThicknessEstimate,
        q[1] - N[2] * D.rockShellThicknessEstimate,
      ];
    for (let j = 0; j < parts; j++) {
      const A = mix(a, b, j / parts),
        B = mix(a, b, (j + 1) / parts),
        aa = off(A),
        bb = off(B),
        y = floorEdge(...A, lod) - 0.3,
        Y0 = floorEdge(...B, lod) - 0.3,
        h = ceiling(...A, lod) + 0.14,
        H0 = ceiling(...B, lod) + 0.14;
      Q(o, 'rock', [lift(A, y), lift(B, Y0), lift(B, H0), lift(A, h)], N);
      Q(
        o,
        'rock',
        [lift(aa, y - 0.28), lift(aa, h + 0.18), lift(bb, H0 + 0.18), lift(bb, Y0 - 0.28)],
        N.map((x) => -x),
      );
      Q(o, 'rock', [lift(A, h), lift(B, H0), lift(bb, H0 + 0.18), lift(aa, h + 0.18)], [0, 1, 0]);
      Q(o, 'rock', [lift(A, y), lift(aa, y - 0.28), lift(bb, Y0 - 0.28), lift(B, Y0)], [0, -1, 0]);
    }
  }
}
function roofSystem(o, lod) {
  const stations = [
      0,
      S.corridorStart,
      S.corridorEnd,
      S.lowerStairStart,
      S.lowerStairEnd,
      S.lastDoor,
      S.chamberFarNorth,
    ],
    step = lod >= 2 ? 0.7 : 2.5;
  for (let i = 0; i < stations.length - 1; i++) {
    const z = stations[i],
      Z = stations[i + 1],
      n = Math.max(1, Math.ceil((Z - z) / step));
    for (let j = 0; j < n; j++) {
      const low = z + ((Z - z) * j) / n,
        high = z + ((Z - z) * (j + 1)) / n,
        cell = slice(metricOutline, low, high),
        fn = (q) => ceiling(q[0], clamp(q[1], z + 1e-6, Z - 1e-6), lod);
      poly(o, 'rock', cell, fn, -1);
      poly(o, 'rock', cell, (q) => fn(q) + 0.32);
    }
  }
  for (const [z, width] of [
    [S.corridorStart, 1.75],
    [S.lastDoor, 1.2],
  ]) {
    const a = ceiling(-width / 2, z - 1e-6, lod),
      b = ceiling(-width / 2, z + 1e-6, lod),
      A = ceiling(width / 2, z - 1e-6, lod),
      B = ceiling(width / 2, z + 1e-6, lod);
    Q(
      o,
      'rock',
      [
        [-width / 2, a, z],
        [width / 2, A, z],
        [width / 2, B, z],
        [-width / 2, b, z],
      ],
      [0, 0, 1],
    );
    Q(
      o,
      'rock',
      [
        [-width / 2, a + 0.32, z],
        [width / 2, A + 0.32, z],
        [width / 2, B + 0.32, z],
        [-width / 2, b + 0.32, z],
      ],
      [0, 0, -1],
    );
  }
}
function entrySystem(o, lod) {
  const n = lod === 0 ? 1 : D.upperRisers;
  for (let j = 0; j < n; j++) {
    const z = -4 + (4 * j) / n,
      Z = -4 + (4 * (j + 1)) / n,
      y = (-4.2 * (j + 1)) / n,
      yy = (-4.2 * j) / n;
    if (lod === 0)
      slab(
        o,
        [
          [-0.88, z],
          [0.88, z],
          [0.88, Z],
          [-0.88, Z],
        ],
        (q) => (-4.2 * (q[1] + 4)) / 4,
      );
    else {
      slab(
        o,
        [
          [-0.88, z],
          [0.88, z],
          [0.88, Z],
          [-0.88, Z],
        ],
        () => y,
      );
      Q(
        o,
        'worn',
        [
          [-0.88, yy, z],
          [0.88, yy, z],
          [0.88, y, z],
          [-0.88, y, z],
        ],
        [0, 0, -1],
      );
      stairEvidence.push({ flight: 'upper', index: j, z, Z, y, previous: yy, width: 1.76 });
    }
  }
  // Original map entry extent surrounds the rock cheeks; the top and doorway remain open.
  for (const sign of [-1, 1]) {
    const n = lod < 2 ? 4 : 12;
    for (let j = 0; j < n; j++) {
      const z = -4 + (4 * j) / n,
        Z = -4 + (4 * (j + 1)) / n,
        y = (-4.2 * (j + 1)) / n - 0.35,
        x = sign * 0.88,
        outer = sign > 0 ? 1.14 : -1.68,
        top = 0.12 + (lod >= 2 ? 0.035 * Math.sin(j * 1.7) : 0);
      Q(
        o,
        'rock',
        [
          [x, y, z],
          [x, y, Z],
          [x, top, Z],
          [x, top, z],
        ],
        [-sign, 0, 0],
      );
      Q(
        o,
        'rock',
        [
          [outer, y, z],
          [outer, top, z],
          [outer, top, Z],
          [outer, y, Z],
        ],
        [sign, 0, 0],
      );
      Q(
        o,
        'rock',
        [
          [x, top, z],
          [outer, top, z],
          [outer, top, Z],
          [x, top, Z],
        ],
        [0, 1, 0],
      );
    }
  }
  // Rock-cut first portal: plain cheeks and lintel; no speculative modern gate.
  for (const [x, X] of [
    [-1.68, -0.675],
    [0.675, 1.14],
  ])
    box(o, 'rock', [x, Y.firstDoor, -0.12], [X, 0.12, 0.14], C.rock);
  box(o, 'rock', [-0.675, Y.firstDoor + D.firstDoorHeight, -0.12], [0.675, 0.12, 0.14], C.rock);
  doorEvidence.push({
    id: 'first-rock-cut-door',
    width: 1.35,
    height: 2.1,
    z: 0.04,
    floor: Y.firstDoor,
  });
  doorEvidence.push({
    id: 'intermediate-throat',
    width: 1.3,
    height: 2.04,
    z: 9.4,
    floor: Y.corridorEnd,
  });
  doorEvidence.push({ id: 'burial-door', width: 1.2, height: 2.1, z: 13.6, floor: Y.lowerLanding });
}
export function buildYuya(target, _frame, lod = 3) {
  partEvidence.length = 0;
  stairEvidence.length = 0;
  doorEvidence.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(k, r, q, v, uv, c) {
        o.addTriangle(k, r, q.slice(0, 3), v, uv.slice(0, 3), c);
        o.addTriangle(k, r, [q[0], q[2], q[3]], v, [uv[0], uv[2], uv[3]], c);
      },
      addConvexPolygon(k, r, q, v, uv, c) {
        for (let j = 1; j < q.length - 1; j++)
          o.addTriangle(k, r, [q[0], q[j], q[j + 1]], v, [q[0], q[j], q[j + 1]].map(uv), c);
      },
    },
    part = (id, fn) => {
      const n = count;
      fn();
      partEvidence.push({ id, triangles: count - n });
    };
  part('whole-rock-cut-floors-17-lower-risers-recess-ledges-and-chamber-step', () =>
    floorSystem(o, lod),
  );
  part('whole-T-plan-rock-cut-sidewalls', () => wallSystem(o, lod));
  part('closed-underground-rock-ceilings-and-intrados', () => roofSystem(o, lod));
  part('15-riser-exterior-entry-flight-rock-cheeks-and-first-portal', () => entrySystem(o, lod));
}
export const yuyaSkyline = (o) => buildYuya(o, null, 0),
  yuyaDistrict = (o) => buildYuya(o, null, 1),
  yuyaStreet = (o) => buildYuya(o, null, 2),
  yuyaCloseup = (o) => buildYuya(o, null, 3);
const look = [1, -6.2, 7],
  outlines = [native.upper];
export const yuyaModel = {
  id: 'tomb_of_yuya_and_thuya',
  key: 'tomb_of_yuya_and_thuya',
  cell: 'ss/ssx',
  title: 'Tomb of Yuya and Thuya (KV46)',
  wikidataId: 'Q1719159',
  category: 'rock-cut-tomb',
  recipe: 'yuya-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildYuya,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole KV46 rock-cut tomb:15-riseropenentrance/firstportal, longslopingplaincorridor,17-riserlowerstair/pairedside-recesses, shortlowerlanding/1.20mdoorway, irregulartransverseburialchamber/one-metresectionfloorstep andclosedrockceilings. Original1907dimensionedplan/section andcurrentnativewholeT-plan/entrancecontext; ancientcarvedarchitectureonly, no furnishedtableau/genericmausoleum/naturalhill. Currentweathering/visitorhardware/ceilingroughness/nicheledgeprofile/floorstepinterpretation/groundcontact approximate.',
  camera: [29, 16, -31],
  lookAt: look,
  portableGroundY: -12.7,
  mediumFiContext: {
    scale: 1.7,
    groundY: -12.7,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 1800,
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw'],
  groundCutout: {
    outline: outlines[0],
    outlines,
    additionalOutlines: [],
    basis:
      'Actualmappedexteriorentrystairextentonly. Closedsubterraneancorridor/chamberretainoriginaloverburdenfield; no chamberwideopenpit/hillflattening. Approximatecurrentgroundcontactnotverified.',
  },
  qaCameras: [
    { name: 'whole-architectural-envelope', position: [27, 10, -24], lookAt: look },
    { name: 'entry-flight-and-rock-cut-portal', position: [0.1, 1.7, -7], lookAt: [0, -2.6, -0.5] },
    { name: 'inside-sloping-corridor', position: [0, -3.5, 1], lookAt: [0, -6, 8.5] },
    {
      name: 'inside-lower-stair-and-paired-recesses',
      position: [0, -5.8, 10.4],
      lookAt: [0, -9.8, 13.7],
    },
    {
      name: 'inside-transverse-burial-chamber',
      position: [-0.8, -10.1, 15.8],
      lookAt: [7, -10.1, 15.8],
    },
    {
      name: 'burial-chamber-return-and-floor-step',
      position: [6.8, -10.5, 16.2],
      lookAt: [0.1, -9.7, 13.8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-tomb-' + reviewLod,
    position: [27, 10, -24],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/yuya-runtime-overlay.mjs',
    level: 'skyline',
    export: 'yuyaSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'yuyaDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'yuyaStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'yuyaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [p.geometryBasis, p.sectionBasis, ...p.limits],
};
