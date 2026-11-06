/** Complete original single bore and both portals. Original field/frame/sections are fixed inputs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  road: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.18 },
  red: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0 },
};
const C = {
  concrete: rgb('c2bfb4'),
  road: rgb('646766'),
  metal: rgb('4c5353'),
  red: rgb('b81d18'),
};
const sub = (a, b) => a.map((v, k) => v - b[k]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
export const componentEvidence = [];
function face(o, k, q, n) {
  q = q.map((p) => p.map(Math.fround));
  for (let j = 1; j < q.length - 1; j++) {
    let t = [q[0], q[j], q[j + 1]],
      cr = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (Math.hypot(...cr) < 1e-8) continue;
    if (n && dot(cr, n) < 0) t = [t[0], t[2], t[1]];
    o.addTriangle(
      k,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((p) => [p[0] + p[2], p[1]]),
      C[k],
    );
  }
}
export function station(s) {
  s = Math.max(0, Math.min(P.routeLength, s));
  let i = 0;
  while (i < P.stations.length - 2 && P.stations[i + 1] < s) i++;
  const a = P.nativeRoute[i],
    b = P.nativeRoute[i + 1],
    t = (s - P.stations[i]) / (P.stations[i + 1] - P.stations[i]);
  const T = [b[0] - a[0], b[1] - a[1]],
    L = Math.hypot(...T),
    V = T.map((v) => v / L);
  return {
    x: a[0] + (b[0] - a[0]) * t,
    z: a[1] + (b[1] - a[1]) * t,
    y: P.portals[0].floor + ((P.portals[1].floor - P.portals[0].floor) * s) / P.routeLength,
    V,
    N: [-V[1], V[0]],
    s,
  };
}
const pt = (f, z, y) => [f.x + f.N[0] * z, f.y + y, f.z + f.N[1] * z];
function profile(n, half, height, bottom = 0) {
  const spring = height - half,
    q = [
      [-half, bottom],
      [-half, spring],
    ];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    q.push([half * Math.cos(a), spring + half * Math.sin(a)]);
  }
  q.push([half, spring], [half, bottom]);
  return q;
}
function shell(o, frames, inner, outer, caps = true) {
  const N = inner.length;
  for (const [profile, inward] of [
    [outer, false],
    [inner, true],
  ]) {
    for (let k = 1; k < frames.length; k++)
      for (let j = 0; j < N; j++) {
        if (inward && j === N - 1) continue; // The paved deck owns the floor surface.
        const i = (j + 1) % N,
          a = profile[j],
          b = profile[i],
          dz = -(b[1] - a[1]),
          dy = b[0] - a[0],
          f = frames[k - 1],
          v = inward ? -1 : 1;
        face(
          o,
          'concrete',
          [pt(f, ...a), pt(f, ...b), pt(frames[k], ...b), pt(frames[k], ...a)],
          [f.N[0] * dz * v, dy * v, f.N[1] * dz * v],
        );
      }
  }
  if (caps)
    for (const [f, v] of [
      [frames[0], -1],
      [frames.at(-1), 1],
    ])
      for (let j = 0; j < N; j++) {
        const i = (j + 1) % N;
        face(
          o,
          'concrete',
          [pt(f, ...outer[j]), pt(f, ...outer[i]), pt(f, ...inner[i]), pt(f, ...inner[j])],
          [v * f.V[0], 0, v * f.V[1]],
        );
      }
}
function prism(o, k, a, b, half, y0, y1) {
  const q = [
    pt(a, -half, y0),
    pt(a, half, y0),
    pt(a, half, y1),
    pt(a, -half, y1),
    pt(b, -half, y0),
    pt(b, half, y0),
    pt(b, half, y1),
    pt(b, -half, y1),
  ];
  const center = [0, 1, 2].map((k) => q.reduce((s, p) => s + p[k], 0) / 8);
  for (const ids of [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 2, 6, 5],
  ]) {
    const points = ids.map((i) => q[i]),
      normal = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / 4 - center[k]);
    face(o, k, points, normal);
  }
}
function box(o, k, center, size) {
  const a = {
      x: center[0] - size[0] / 2,
      y: center[1] - size[1] / 2,
      z: center[2],
      V: [1, 0],
      N: [0, 1],
    },
    b = { ...a, x: center[0] + size[0] / 2 };
  prism(o, k, a, b, size[2] / 2, 0, size[1]);
}
function terminal(o, k, lod, inner) {
  const p = P.portals[k],
    s = k ? P.routeLength : 0,
    into = k ? -1 : 1,
    f = station(s),
    back = station(s + into * p.headwallDepth),
    n = [4, 8, 16, 24][lod];
  const outer = profile(n, p.headwallWidth / 2, p.headwallHeight, -0.45);
  shell(o, k ? [back, f] : [f, back], inner, outer);
  for (const side of [-1, 1]) {
    // Integral splayed wing walls are estimated; the ground remains the original independent field.
    const a = { ...f, x: f.x + f.V[0] * p.outward * 0.05, z: f.z + f.V[1] * p.outward * 0.05 },
      b = {
        ...f,
        x: f.x + f.V[0] * p.outward * p.wingwallLength,
        z: f.z + f.V[1] * p.outward * p.wingwallLength,
      };
    a.x += f.N[0] * side * (p.headwallWidth / 2 - 0.25);
    a.z += f.N[1] * side * (p.headwallWidth / 2 - 0.25);
    b.x += f.N[0] * side * (p.headwallWidth / 2 + p.wingwallSpread);
    b.z += f.N[1] * side * (p.headwallWidth / 2 + p.wingwallSpread);
    prism(o, 'concrete', a, b, 0.25, -0.4, 3.3);
  }
  const apron = { ...f, x: f.x + f.V[0] * p.outward * 10, z: f.z + f.V[1] * p.outward * 10 };
  prism(o, 'road', f, apron, 2.375, -0.22, 0);
  const pole = pt(f, 3.35, 1.8);
  pole[0] += f.V[0] * p.outward * p.signalOffset;
  pole[2] += f.V[1] * p.outward * p.signalOffset;
  box(o, 'metal', pole, [0.14, 3.6, 0.14]);
  const head = [pole[0], f.y + 3.5, pole[2]];
  box(o, 'metal', head, [0.26, 0.95, 0.42]);
  const red = [
    head[0] + f.V[0] * p.outward * 0.15,
    head[1] + 0.24,
    head[2] + f.V[1] * p.outward * 0.15,
  ];
  box(o, 'red', red, [0.07, 0.22, 0.22]);
  if (lod > 0) {
    const lamp = [head[0], head[1] - 0.24, head[2]];
    box(o, 'metal', lamp, [0.32, 0.23, 0.5]);
  }
  componentEvidence.push({
    kind: 'complete-terminal',
    id: p.id,
    center: p.center,
    floor: p.floor,
    trueOpenMouth: true,
    wingwalls: 2,
    signal: true,
  });
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const n = [4, 8, 16, 24][lod],
    h = P.tunnel.baseWidth / 2,
    inner = profile(n, h, P.tunnel.height),
    outer = profile(
      n,
      h + P.tunnel.linerThickness,
      P.tunnel.height + P.tunnel.linerThickness,
      -0.35,
    );
  const first = P.portals[0].headwallDepth,
    last = P.routeLength - P.portals[1].headwallDepth;
  const maxStep = [Infinity, 200, 80, 32][lod],
    ss = [first, last, ...P.stations.filter((s) => s > first && s < last)];
  if (Number.isFinite(maxStep)) for (let s = first + maxStep; s < last; s += maxStep) ss.push(s);
  ss.sort((a, b) => a - b);
  const unique = ss.filter((s, i) => !i || s - ss[i - 1] > 0.01),
    frames = unique.map(station);
  shell(o, frames, inner, outer);
  for (let i = 1; i < frames.length; i++)
    prism(o, 'road', frames[i - 1], frames[i], h, -P.tunnel.deckThickness, 0);
  componentEvidence.push({
    kind: 'whole-continuous-single-bore',
    stations: frames.length,
    from: 0,
    to: P.routeLength,
    trueThroughPassage: true,
    height: P.tunnel.height,
    baseWidth: P.tunnel.baseWidth,
  });
  terminal(o, 0, lod, inner);
  terminal(o, 1, lod, inner);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/63/63j/las_raices_tunnel',
  mid = station(P.routeLength / 2),
  camera = [0, mid.y + 2800, 4000],
  look = [0, mid.y, 0];
export const houseModel = {
  id: 'las_raices_tunnel',
  key: 'las_raices_tunnel',
  cell: '63/63j',
  title: 'Las Raíces Tunnel — complete existing bore and both portals',
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
    'Whole original single-bore road tunnel, both open portal headwalls/integral wingwalls and traffic signals, complete continuous underground horseshoe liner and paved deck. Primary ministry numerical facts and complete original numeric alignment; estimated portal architecture and grade. No imagery used.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.floor - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 24000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-original-single-bore-both-portals', position: camera, lookAt: look },
    ...P.portals.map((p) => ({
      name: `complete-${p.id}-mouth-headwall-wingwalls-signal`,
      position: [p.center[0] + p.outward * 25, p.floor + 10, p.center[1] + 14],
      lookAt: [p.center[0], p.floor + 3, p.center[1]],
    })),
    {
      name: 'true-northwest-continuous-tunnel-mouth',
      position: [P.portals[0].center[0] - 16, P.portals[0].floor + 2.6, 0],
      lookAt: [P.portals[0].center[0] + 25, P.portals[0].floor + 2.6, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-las-raices-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole existing single-bore tunnel geometry under repository license. Original numeric Protomaps/OpenStreetMap route data ODbL; primary Ministry written construction facts only. All imagery/figures unused; portal architecture/liner/grade/finish explicitly estimated. No borrowed mesh, protected photo trace, surveyed contact or current replacement claim.',
};
