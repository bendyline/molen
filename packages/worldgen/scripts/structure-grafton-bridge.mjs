/** Grafton Bridge: whole Auckland crossing, asymmetric approaches and twin open concrete arches. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/rc/rck/grafton_bridge/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    concrete: rgb('c0c0b2'),
    road: rgb('555c5a'),
    metal: rgb('647570'),
    glass: rgb('b0c2bb'),
    lamp: rgb('e4e4ce'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
    road: { slot: 'roof', graph: 'gravel', roughness: 0.98, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.25 },
    glass: {
      slot: 'window',
      localRef: 'palette:#feffff',
      roughness: 0.25,
      metallic: 0,
      baseColorFactor: [1, 1, 1, 0.12],
      alphaMode: 'BLEND',
      doubleSided: true,
    },
    lamp: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.64, metallic: 0 },
  };
export function graftonBridgeGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
export const graftonBridgeDeck = (z) => A.deckWest + ((A.deckEast - A.deckWest) * (z + 150)) / 300;
export function graftonBridgeArch(z) {
  const half = A.archSpan / 2,
    R = (half * half) / (2 * A.archRise) + A.archRise / 2,
    u = z - A.archCentre;
  return (
    graftonBridgeDeck(z) -
    A.archCrownDrop -
    A.archRise +
    Math.sqrt(Math.max(0, R * R - u * u)) -
    (R - A.archRise)
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
// Grade follows the fixed source controls; no terrain sample is moved to meet the deck.
function gradedBox(o, s, x, y, z0, z1, w, h, col = C[s]) {
  const P = (q, z, d = 0) => [x + (q * w) / 2, graftonBridgeDeck(z) + y + d, z],
    a = [P(-1, z0), P(1, z0), P(1, z1), P(-1, z1)],
    b = [P(-1, z0, h), P(1, z0, h), P(1, z1, h), P(-1, z1, h)];
  Q(o, s, a, [0, -1, 0], col);
  Q(o, s, b, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], col);
  }
}
function taperedPier(o, x, z, bottom, top) {
  const ring = (y, w, l) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    a = ring(bottom, 1.75, 2.3),
    b = ring(top, 1.1, 1.5);
  Q(o, 'concrete', a, [0, -1, 0]);
  Q(o, 'concrete', b, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, 'concrete', [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
}
function haunch(o, x, z, side, y) {
  // A solid chamfer above each clear portal corner, rather than a solid transverse wall.
  const a = [
      [x, y - 1.6, z - 0.85],
      [x + side * 1.5, y, z - 0.85],
      [x, y, z - 0.85],
    ],
    b = a.map((v) => [v[0], v[1], z + 0.85]);
  T(o, 'concrete', a, [0, 0, -1]);
  T(o, 'concrete', b, [0, 0, 1]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    Q(o, 'concrete', [a[i], a[j], b[j], b[i]], [a[j][1] - a[i][1], a[i][0] - a[j][0], 0]);
  }
}
function approaches(o, d) {
  for (const ports of [A.westPorts, A.eastPorts]) {
    for (const x of [-A.ribX, A.ribX])
      gradedBox(o, 'concrete', x, -2.74, ports[0], ports.at(-1), 1.35, 2.05);
    for (const z of ports) {
      const y = graftonBridgeDeck(z);
      for (const x of [-A.ribX, A.ribX]) {
        const foot = graftonBridgeGround(x, z) - 0.55;
        if (d > 0) box(o, 'concrete', x, foot, z, 2.4, 0.7, 3);
        taperedPier(o, x, z, foot + 0.7, y - 3.15);
        if (d > 0) box(o, 'concrete', x, y - 3.2, z, 2.2, 0.65, 2.4);
        if (d > 0) haunch(o, x, z, -Math.sign(x), y - 2.8);
      }
      if (d > 0) box(o, 'concrete', 0, y - 3.15, z, 8.8, 0.8, 1.8);
    }
  }
  for (const [z0, z1] of [
    [-148, -138],
    [137.8, 148],
  ]) {
    const z = (z0 + z1) / 2,
      low = Math.min(graftonBridgeGround(-4, z), graftonBridgeGround(4, z)) - 0.6;
    box(o, 'concrete', 0, low, z, 10.9, Math.max(1, graftonBridgeDeck(z) - 0.6 - low), z1 - z0);
  }
}
function arches(o, d) {
  const n = [12, 24, 44, 72][d];
  for (const x of [-A.ribX, A.ribX]) {
    const rings = Array.from({ length: n + 1 }, (_, i) => {
      const z = A.archCentre - A.archSpan / 2 + (A.archSpan * i) / n,
        y = graftonBridgeArch(z),
        depth = 1.7 + 1.1 * Math.abs((z - A.archCentre) / (A.archSpan / 2));
      return [
        [x - A.ribWidth / 2, y - depth, z],
        [x + A.ribWidth / 2, y - depth, z],
        [x + A.ribWidth / 2, y, z],
        [x - A.ribWidth / 2, y, z],
      ];
    });
    for (let k = 1; k < rings.length; k++)
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          a = rings[k - 1],
          b = rings[k],
          norm = [
            [0, -1, 0],
            [1, 0, 0],
            [0, 1, 0],
            [-1, 0, 0],
          ][i];
        Q(o, 'concrete', [a[i], a[j], b[j], b[i]], norm);
      }
    Q(o, 'concrete', rings[0], [0, 0, -1]);
    Q(o, 'concrete', rings.at(-1), [0, 0, 1]);
    for (const offset of d === 0
      ? [-42, -26, -10, 10, 26, 42]
      : [-42, -30, -18, -6, 6, 18, 30, 42]) {
      const z = A.archCentre + offset,
        b = graftonBridgeArch(z) - 0.15,
        top = graftonBridgeDeck(z) - 0.7;
      box(o, 'concrete', x, b, z, 1.1, top - b, 1.35);
      if (d > 1) {
        box(o, 'concrete', x, top - 0.65, z, 1.8, 0.65, 2);
        box(o, 'concrete', x, b, z, 1.65, 0.4, 1.8);
      }
    }
    if (d > 0) gradedBox(o, 'concrete', x, -1.65, 4.2, 101.8, 1.0, 0.9);
  }
  for (const offset of d === 0 ? [-42, -21, 0, 21, 42] : [-42, -28, -14, 0, 14, 28, 42]) {
    const z = A.archCentre + offset,
      y = graftonBridgeArch(z) - 1.45;
    box(o, 'concrete', 0, y, z, 6.8, 1.0, 1.2);
    if (d > 1) for (const x of [-2.7, 2.7]) haunch(o, x, z, -Math.sign(x), y + 1.0);
  }
  for (const z of [4.2, 101.8]) {
    const low = Math.min(graftonBridgeGround(-4, z), graftonBridgeGround(4, z)) - 1,
      high = graftonBridgeArch(z) + 0.7;
    box(o, 'concrete', 0, low, z, 9.3, high - low, 6.7);
    box(o, 'concrete', 0, high, z, 9.8, 0.9, 7.4);
  }
}
const screenPoint = (sign, t, z) => {
  const angle = (t * Math.PI) / 2;
  return [
    sign * (5.46 - 0.95 * (1 - Math.cos(angle))),
    graftonBridgeDeck(z) + 1.05 + 2.35 * Math.sin(angle),
    z,
  ];
};
function deckAndGuards(o, d) {
  gradedBox(o, 'concrete', 0, -0.72, -148, 148, 11.2, 0.72);
  gradedBox(o, 'road', 0, 0.012, -148, 148, 7, 0.045);
  for (const sign of [-1, 1]) {
    gradedBox(o, 'concrete', sign * 4.38, 0.04, -148, 148, 1.75, 0.16);
    gradedBox(o, 'concrete', sign * 3.59, 0.04, -148, 148, 0.18, 0.23);
    gradedBox(o, 'concrete', sign * 5.3, 0.2, -148, 148, 0.5, 0.3);
    gradedBox(o, 'concrete', sign * 5.3, 1.06, -148, 148, 0.5, 0.19);
    const count = [0, 14, 130, 455][d];
    for (let i = 0; i <= count && count > 0; i++) {
      const z = -148 + (296 * i) / count;
      box(o, 'concrete', sign * 5.3, graftonBridgeDeck(z) + 0.5, z, 0.25, 0.56, 0.19);
    }
    const seg = [2, 3, 5, 8][d],
      ribs = [0, 6, 24, 74][d];
    for (let j = 0; j < seg; j++) {
      Q(
        o,
        'glass',
        [
          screenPoint(sign, j / seg, -148),
          screenPoint(sign, j / seg, 148),
          screenPoint(sign, (j + 1) / seg, 148),
          screenPoint(sign, (j + 1) / seg, -148),
        ],
        [sign, 0, 0],
      );
    }
    if (d > 0)
      for (let i = 0; i <= ribs; i++) {
        const z = -148 + (296 * i) / ribs;
        for (let j = 0; j < seg; j++)
          axial(
            o,
            'metal',
            screenPoint(sign, j / seg, z),
            screenPoint(sign, (j + 1) / seg, z),
            0.027,
            d === 1 ? 3 : 4,
          );
      }
    axial(
      o,
      'metal',
      screenPoint(sign, 1, -148),
      screenPoint(sign, 1, 148),
      d === 0 ? 0.065 : 0.035,
      d === 0 ? 3 : 4,
    );
    if (d > 1) gradedBox(o, 'metal', sign * 5.5, 0.32, -148, 148, 0.08, 0.12);
  }
  if (d > 0) {
    for (const x of [-3.35, 3.35]) gradedBox(o, 'lamp', x, 0.059, -145, 145, 0.09, 0.008);
    if (d > 1)
      for (let z = -144; z < 146; z += 8) gradedBox(o, 'lamp', 0, 0.061, z, z + 3, 0.1, 0.01);
  }
}
function globe(o, x, y, z, d) {
  const n = d < 3 ? 6 : 10,
    rows = d === 2 ? 3 : d === 3 ? 5 : 3,
    r = 0.23;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const P = (a, b) => [
          x + r * Math.cos(a) * Math.cos(b),
          y + r * Math.sin(a),
          z + r * Math.cos(a) * Math.sin(b),
        ],
        a = -Math.PI / 2 + (Math.PI * j) / rows,
        b = a + Math.PI / rows,
        u = (2 * Math.PI * i) / n,
        v = u + (2 * Math.PI) / n;
      Q(
        o,
        'lamp',
        [P(a, u), P(a, v), P(b, v), P(b, u)],
        [Math.cos((u + v) / 2), Math.sin((a + b) / 2), Math.sin((u + v) / 2)],
      );
    }
}
function lamps(o, d) {
  const zs =
    d === 0
      ? [-108, 108]
      : d === 1
        ? [-126, -63, 0, 63, 126]
        : Array.from({ length: 15 }, (_, i) => -126 + 18 * i);
  for (const z of zs)
    for (const sign of [-1, 1]) {
      const x = sign * 4.82,
        y = graftonBridgeDeck(z),
        n = d < 2 ? 3 : d === 2 ? 4 : 6;
      axial(o, 'metal', [x, y + 0.2, z], [x, y + 4.55, z], 0.065, n, 0.045);
      if (d === 0) continue;
      // Replica globe, conical hat, curved U bracket and finial from the eastern-abutment original.
      globe(o, x, y + 4.03, z, d);
      axial(o, 'metal', [x, y + 4.19, z], [x, y + 4.4, z], 0.38, n, 0.035);
      axial(o, 'metal', [x, y + 4.39, z], [x, y + 4.61, z], 0.037, n, 0.01);
      const N = d === 1 ? 3 : d === 2 ? 4 : 8;
      for (let i = 0; i < N; i++) {
        const P = (t) => [x + 0.35 * Math.cos(t), y + 4.13 - 0.47 * Math.sin(t), z],
          a = (Math.PI * i) / N,
          b = (Math.PI * (i + 1)) / N;
        axial(o, 'metal', P(a), P(b), 0.025, n);
      }
      if (d > 1) {
        box(o, 'metal', x, y + 0.2, z, 0.3, 0.22, 0.3);
        axial(o, 'metal', [x, y + 0.4, z], [x, y + 1.0, z], 0.12, n, 0.07);
      }
    }
  if (d > 0) {
    const z = -144,
      y = graftonBridgeDeck(z);
    for (const x of [-4.7, 4.7])
      axial(o, 'metal', [x, y + 0.2, z], [x, y + 5.1, z], 0.08, d === 1 ? 4 : 6);
    axial(o, 'metal', [-4.7, y + 5.1, z], [4.7, y + 5.1, z], 0.09, d === 1 ? 4 : 6);
    for (const x of [-1.75, 1.75]) box(o, 'metal', x, y + 4.55, z, 0.5, 0.65, 0.19);
  }
}
function build(o, _f, d = 3) {
  approaches(o, d);
  arches(o, d);
  deckAndGuards(o, d);
  lamps(o, d);
}
export const graftonBridgeSkyline = (o, f) => build(o, f, 0),
  graftonBridgeDistrict = (o, f) => build(o, f, 1),
  graftonBridgeStreet = (o, f) => build(o, f, 2),
  graftonBridgeCloseup = (o, f) => build(o, f, 3);
export const graftonBridgeModel = {
  id: 'grafton_bridge',
  key: 'grafton_bridge',
  cell: 'rc/rck',
  recipe: 'structure-grafton-bridge.mjs',
  title: 'Grafton Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [190, 125, 225],
  lookAt: [0, 22, 5],
  mediumFiContext: { scale: 2.1 },
  qaCameras: [
    {
      name: 'whole-296m-bridge-six-west-three-east-approaches-and-twin-mainarches',
      position: [190, 125, 225],
      lookAt: [0, 22, 5],
      reviewLod: 'skyline',
    },
    {
      name: 'twin-arches-real-open-spandrels-and-transverse-braces',
      position: [38, 13, 71],
      lookAt: [0, 29, 53],
    },
    {
      name: 'western-approach-chamfered-open-portals-and-flared-piercaps',
      position: [18, 20, -58],
      lookAt: [0, 31, -76],
    },
    {
      name: 'kerbed-walkways-baluster-openings-transparent-curved-screens-and-replica-lamps',
      position: [9, 49, 114],
      lookAt: [0, 46, 95],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-grafton-bridge.mjs',
    level: 'skyline',
    export: 'graftonBridgeSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'graftonBridgeDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'graftonBridgeStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'graftonBridgeCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole surviving Auckland bridge with primary296m length, twin97.6m arches/25.6m rise, six western/three eastern approaches. Seven individually inspected exact published Ingolfson PD-self/CC0 originals from2008-2011 control section character, actual voids, transverse braces, flared/chamfered piers, kerbed walks/concrete balusters, inward-curved transparent safety screens and replica globe lamps. Native core283m outline plus explicit endabutments; detailed pier locations/sections, footing foundations, repair infills, screening profiles/spacing and hidden hardware are medium-fi estimates, not an engineering survey.',
    'Published43.3m valley clearance defines intrinsic deckheight over the fixed valley reference; source approach heights supply grade fall only. Coarse nativeDEM does not establish absolute elevated deck/abutment contacts; compatible host valley needed. Original field/raw tiles remain unchanged. No claim of surveyed43.3m clearance at the exact sampled point or verified present-day road connection.',
    'No independent motorway/steel gantries, cemetery, city buildings, trees, vehicles or people. End signal frame is bounded2008-2011 exterior furniture without regulatory lettering or claim of current access rules. No borrowed meshes, photographic textures, generated bitmaps or non-PD imagery. Fine2026 street furniture/markings/repairs unverified.',
    'All four LODs retain whole bridge, asymmetric approaches, twin separate arches/real open spandrels/transverse braces/walkways and safety-screen silhouette. Balusters, curved screen ribs, replica lampglobes/hat/Ubrackets/finials and section hardware resolve progressively. Safety panels use local transparent glazing, canonical shared concrete/gravel/painted metal remain bound.',
  ],
};
