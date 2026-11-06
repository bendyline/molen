/** Whole original Tanna railway bore and both 1936 portals, from original PDM ministry plates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  lining: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  stone: { slot: 'door', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  arch: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.92, metallic: 0 },
  ballast: { slot: 'roof', graph: 'gravel', roughness: 0.99, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.35 },
  sleeper: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.97, metallic: 0 },
};
const C = {
  lining: rgb('bcb9af'),
  stone: rgb('a5a79f'),
  arch: rgb('c9c6b7'),
  ballast: rgb('9a988d'),
  metal: rgb('545c60'),
  sleeper: rgb('77705d'),
};
const sub = (a, b) => a.map((v, k) => v - b[k]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
export const componentEvidence = [];
function face(o, key, points, outward) {
  const q = points.map((p) => p.map(Math.fround));
  for (let j = 1; j < q.length - 1; j++) {
    let t = [q[0], q[j], q[j + 1]];
    const cr = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (Math.hypot(...cr) < 1e-8) continue;
    if (outward && dot(cr, outward) < 0) t = [t[0], t[2], t[1]];
    o.addTriangle(
      key,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((p) => [p[0] + p[2], p[1]]),
      C[key],
    );
  }
}
export function station(s) {
  const t = s / P.routeLength,
    a = P.nativeRoute[0],
    b = P.nativeRoute[1];
  return {
    x: a[0] + (b[0] - a[0]) * t,
    z: a[1] + (b[1] - a[1]) * t,
    y: P.portals[0].floor + (P.portals[1].floor - P.portals[0].floor) * t,
    V: [1, 0],
    N: [0, 1],
    s,
  };
}
const pt = (f, z, y) => [f.x + f.N[0] * z, f.y + y, f.z + f.N[1] * z];
function profile(n, offset = 0) {
  const half = P.tunnel.maxWidth / 2 + offset,
    spring = P.tunnel.springHeight,
    q = [
      [-P.tunnel.baseWidth / 2 - offset, -(offset ? P.tunnel.invertDepth : 0)],
      [-4.5 - offset, 1.6],
      [-half, spring],
    ];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    q.push([half * Math.cos(a), spring + (P.tunnel.height + offset - spring) * Math.sin(a)]);
  }
  q.push(
    [half, spring],
    [4.5 + offset, 1.6],
    [P.tunnel.baseWidth / 2 + offset, -(offset ? P.tunnel.invertDepth : 0)],
  );
  return q;
}
function shell(o, frames, inner, outer, key = 'lining') {
  const N = inner.length;
  for (const [shape, inward] of [
    [outer, false],
    [inner, true],
  ])
    for (let k = 1; k < frames.length; k++)
      for (let j = 0; j < N; j++) {
        if (inward && j === N - 1) continue; // Ballast/invert owns the interior floor.
        const i = (j + 1) % N,
          a = shape[j],
          b = shape[i],
          f = frames[k - 1],
          v = inward ? -1 : 1;
        face(
          o,
          key,
          [pt(f, ...a), pt(f, ...b), pt(frames[k], ...b), pt(frames[k], ...a)],
          [f.N[0] * -(b[1] - a[1]) * v, (b[0] - a[0]) * v, f.N[1] * -(b[1] - a[1]) * v],
        );
      }
  for (const [f, v] of [
    [frames[0], -1],
    [frames.at(-1), 1],
  ])
    for (let j = 0; j < N; j++) {
      const i = (j + 1) % N;
      face(
        o,
        key,
        [pt(f, ...outer[j]), pt(f, ...outer[i]), pt(f, ...inner[i]), pt(f, ...inner[j])],
        [v, 0, 0],
      );
    }
}
function prism(o, key, a, b, half, y0, y1) {
  const q = [
      pt(a, -half, y0),
      pt(a, half, y0),
      pt(a, half, y1),
      pt(a, -half, y1),
      pt(b, -half, y0),
      pt(b, half, y0),
      pt(b, half, y1),
      pt(b, -half, y1),
    ],
    center = [0, 1, 2].map((k) => q.reduce((s, p) => s + p[k], 0) / 8);
  for (const ids of [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ]) {
    const p = ids.map((i) => q[i]);
    face(
      o,
      key,
      p,
      [0, 1, 2].map((k) => p.reduce((s, v) => s + v[k], 0) / 4 - center[k]),
    );
  }
}
function box(o, key, p, size) {
  const a = { x: p[0] - size[0] / 2, y: p[1] - size[1] / 2, z: p[2], V: [1, 0], N: [0, 1] },
    b = { ...a, x: p[0] + size[0] / 2 };
  prism(o, key, a, b, size[2] / 2, 0, size[1]);
}
function rod(o, key, a, b, width) {
  const v = sub(b, a),
    len = Math.hypot(...v),
    u = v.map((x) => x / len),
    ref = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
    r0 = cross(u, ref),
    rl = Math.hypot(...r0),
    r = r0.map((v) => ((v / rl) * width) / 2),
    t = cross(u, r);
  const q = [a, b].flatMap((p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, k]) => p.map((v, i) => v + r[i] * s + t[i] * k)),
    ),
    center = a.map((v, i) => (v + b[i]) / 2);
  for (const ids of [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ]) {
    const p = ids.map((i) => q[i]);
    face(
      o,
      key,
      p,
      [0, 1, 2].map((k) => p.reduce((s, v) => s + v[k], 0) / 4 - center[k]),
    );
  }
}
function terminal(o, k, lod, inner) {
  const p = P.portals[k],
    s = k ? P.routeLength : 0,
    f = station(s),
    back = station(s - p.outward * p.headwallDepth),
    n = inner.length,
    outer = inner.map(([z, y], j) => [
      j <= 2
        ? -p.headwallWidth / 2
        : j >= n - 3
          ? p.headwallWidth / 2
          : ((z / (P.tunnel.maxWidth / 2)) * p.headwallWidth) / 2,
      j === 0 || j === n - 1 ? -0.6 : j < 2 || j > n - 3 ? y : p.headwallHeight,
    ]);
  // Rectangular headwall, complete sides/back and a real arch void; no opaque mouth polygon.
  shell(o, k ? [back, f] : [f, back], inner, outer, 'stone');
  const ring = inner.map(([z, y]) => [z < 0 ? z - 0.63 : z + 0.63, y < 0.1 ? y : y + 0.63]);
  const front = { ...f, x: f.x + p.outward * 0.035 },
    ringBack = { ...front, x: front.x - p.outward * 0.16 };
  shell(o, k ? [ringBack, front] : [front, ringBack], inner, ring, 'arch');
  for (const y of [p.headwallHeight - 0.72, p.headwallHeight + 0.04])
    box(
      o,
      'arch',
      [f.x - (p.outward * p.headwallDepth) / 2, f.y + y, f.z],
      [p.headwallDepth + 0.3, 0.22, p.headwallWidth + 0.5],
    );
  for (const side of [-1, 1]) {
    const a = { ...f, x: f.x + p.outward * 0.08, z: f.z + side * (p.headwallWidth / 2 - 0.25) },
      b = {
        ...f,
        x: f.x + p.outward * p.wingwallLength,
        z: f.z + side * (p.headwallWidth / 2 + p.wingwallSpread),
      };
    prism(o, 'stone', a, b, 0.36, -0.6, k ? 4.5 : 5.4);
    if (lod > 0)
      prism(
        o,
        'arch',
        { ...a, y: a.y + (k ? 4.5 : 5.4) },
        { ...b, y: b.y + (k ? 4.5 : 5.4) },
        0.43,
        0,
        0.18,
      );
  }
  if (k && lod > 0)
    for (const z of [-3.3, 3.3])
      box(o, 'arch', [front.x + p.outward * 0.03, f.y + 9.25, z + f.z], [0.12, 0.74, 2.5]);
  const apron = station(s + p.outward * P.tunnel.portalApronLength);
  prism(o, 'ballast', f, apron, 4.05, -0.24, 0);
  const gantry = station(s + p.outward * 12),
    H = 10.4,
    W = 7.25;
  for (const z of [-W, W])
    box(o, 'metal', [gantry.x, gantry.y + H / 2, gantry.z + z], [0.28, H, 0.28]);
  for (const y of [8.7, 9.5])
    box(o, 'metal', [gantry.x, gantry.y + y, gantry.z], [0.22, 0.16, W * 2]);
  if (lod > 0)
    for (let j = 0; j < 4; j++)
      rod(
        o,
        'metal',
        [gantry.x, gantry.y + 8.7 + (j % 2) * 0.8, gantry.z - W + (j * W) / 2],
        [gantry.x, gantry.y + 8.7 + ((j + 1) % 2) * 0.8, gantry.z - W + ((j + 1) * W) / 2],
        0.08,
      );
  if (lod > 0)
    for (const z of [-2.3, 2.3]) {
      box(o, 'arch', [gantry.x, gantry.y + 9.72, gantry.z + z], [0.25, 0.4, 0.25]);
      rod(
        o,
        'metal',
        [gantry.x, gantry.y + 9.3, gantry.z + z],
        [gantry.x, gantry.y + 5.75, gantry.z + z],
        0.045,
      );
    }
  // Sleeper pitch and reach are estimates; the full ballast and all rails continue through every LOD.
  if (lod > 0)
    for (let a = 0; a < 64; a += [0, 6.4, 1.6, 0.8][lod]) {
      const q = station(s + p.outward * (a - 32));
      for (const z of [-2.25, 2.25])
        box(o, 'sleeper', [q.x, q.y + 0.045, q.z + z], [0.22, 0.09, 2.2]);
    }
  componentEvidence.push({
    kind: 'complete-original-portal',
    id: p.id,
    trueOpenMouth: true,
    rectangularStoneHeadwall: true,
    archRing: true,
    wingwalls: 2,
    electrificationGantry: true,
  });
}
function trackFrames(track, lod) {
  const q = lod === 0 ? [track[0], track.at(-1)] : track;
  const first = q[0],
    last = q.at(-1),
    out = [
      { x: first[0] - 32, z: first[1], y: station(first[0] - 32 - P.nativeRoute[0][0]).y },
      ...q.map((p) => ({ x: p[0], z: p[1], y: station(p[0] - P.nativeRoute[0][0]).y })),
      { x: last[0] + 32, z: last[1], y: station(last[0] + 32 - P.nativeRoute[0][0]).y },
    ];
  return out.map((f) => ({ ...f, N: [0, 1], V: [1, 0] }));
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const n = [4, 8, 16, 24][lod],
    inner = profile(n),
    outer = profile(n, P.tunnel.linerThickness),
    first = P.portals[0].headwallDepth,
    last = P.routeLength - P.portals[1].headwallDepth,
    ss = [first, last],
    step = [Infinity, 800, 150, 64][lod];
  if (Number.isFinite(step)) for (let s = first + step; s < last; s += step) ss.push(s);
  ss.sort((a, b) => a - b);
  const frames = ss.map(station);
  shell(o, frames, inner, outer);
  for (let i = 1; i < frames.length; i++) {
    prism(o, 'ballast', frames[i - 1], frames[i], 4.05, -0.24, 0);
    if (lod > 0) prism(o, 'lining', frames[i - 1], frames[i], 0.17, -0.55, -0.29);
  }
  for (const track of P.nativeTracks) {
    const fs = trackFrames(track, lod);
    for (let i = 1; i < fs.length; i++) {
      for (const side of [-1, 1])
        prism(
          o,
          'metal',
          { ...fs[i - 1], z: fs[i - 1].z + (side * P.tunnel.railGauge) / 2 },
          { ...fs[i], z: fs[i].z + (side * P.tunnel.railGauge) / 2 },
          0.035,
          0.11,
          0.27,
        );
      rod(
        o,
        'metal',
        [fs[i - 1].x, fs[i - 1].y + 5.75, fs[i - 1].z],
        [fs[i].x, fs[i].y + 5.75, fs[i].z],
        0.04,
      );
    }
  }
  if (lod > 1)
    for (let s = 60; s < P.routeLength - 30; s += lod === 2 ? 400 : 160) {
      const f = station(s);
      rod(o, 'metal', pt(f, -3.9, 5.9), pt(f, 3.9, 5.9), 0.05);
    }
  componentEvidence.push({
    kind: 'whole-original-double-track-bore',
    trueThroughPassage: true,
    length: P.routeLength,
    tracks: 2,
    rails: 4,
    continuousLiningInvertBallast: true,
    originalTrackControls: P.nativeTracks.map((t) => t.length),
    liningStations: frames.length,
  });
  terminal(o, 0, lod, inner);
  terminal(o, 1, lod, inner);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/xn/xn4/tanna_tunnel',
  mid = station(P.routeLength / 2),
  camera = [0, mid.y + 4200, 5800],
  look = [0, mid.y, 0];
export const houseModel = {
  id: 'tanna_tunnel',
  key: 'tanna_tunnel',
  cell: 'xn/xn4',
  title: 'Tanna Tunnel — complete original double-track bore and 1936 portals',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'transport',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole original Tanna double-track railway tunnel, both full stone headwalls and open arch mouths/cornices/intrinsic wingwalls, continuous egg-section lining/invert/ballast/four rails and original portal electrification. Original1936PDM ministry portal/lining photographs and complete paired oldMainLine numerical alignment. Dimensions, finish and hidden rail grade are estimated.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.floor - 0.05,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 30000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'stone_ashlar',
    'stone_basalt_raw',
    'gravel',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-original-tanna-both1936portals', position: camera, lookAt: look },
    ...P.portals.map((p) => ({
      name: `complete1936-${p.id}-portal`,
      position: [p.center[0] + p.outward * 39, p.floor + 14, p.center[1] + 25],
      lookAt: [p.center[0], p.floor + 4.4, p.center[1]],
    })),
    {
      name: 'true-west-kannami-double-track-mouth',
      position: [P.portals[0].center[0] - 23, P.portals[0].floor + 3.7, -0.01475],
      lookAt: [P.portals[0].center[0] + 35, P.portals[0].floor + 3.7, -0.01475],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-tanna-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Original1936RailwayMinistry AtamiOffice construction plates markedPDM by NationalDietLibrary; selectednativeportalphotograph regions exclude memorialartwork/creditedaerial. Original numerical Protomaps/OpenStreetMap alignment ODbL. No borrowed mesh or photograph texture; no survey or current replacement claim.',
};
