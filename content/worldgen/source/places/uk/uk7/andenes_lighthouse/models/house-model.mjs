/** Whole lighthouse reconstructed from native outlines and owner construction facts. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  iron: { slot: 'wall', graph: 'metal_painted', roughness: 0.73, metallic: 0.23 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#527d83', roughness: 0.2, metallic: 0.08 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.79, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#343b3b', roughness: 0.65, metallic: 0.3 },
};
const colors = {
  iron: rgb('ad3d35'),
  concrete: rgb('b9b5aa'),
  glass: rgb('527d83'),
  wood: rgb('755137'),
  dark: rgb('343b3b'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((v, q, i) => v + q * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
const circle = (r, n = 19) =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * 2 * Math.PI) / n),
    r * Math.sin((i * 2 * Math.PI) / n),
  ]);
function shell(o, k, a, b, y0, y1, caps = true, tint = colors[k]) {
  const low = a.map((p) => [p[0], y0, p[1]]),
    high = b.map((p) => [p[0], y1, p[1]]);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      n = [(a[i][0] + a[j][0]) / 2, 0, (a[i][1] + a[j][1]) / 2];
    face(o, k, [low[i], low[j], high[j], high[i]], n, tint);
  }
  if (caps) {
    face(o, k, low, [0, -1, 0], tint);
    face(o, k, high, [0, 1, 0], tint);
  }
}
function tube(o, k, r, y0, y1, n = 19) {
  const p = circle(r, n);
  shell(o, k, p, p, y0, y1);
}
function ring(o, k, r, t, y0, y1, n = 19) {
  const outer = circle(r, n),
    inner = circle(r - t, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = outer[i],
      b = outer[j],
      c = inner[j],
      d = inner[i];
    face(
      o,
      k,
      [
        [...a.slice(0, 1), y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
    );
    face(
      o,
      k,
      [
        [c[0], y0, c[1]],
        [d[0], y0, d[1]],
        [d[0], y1, d[1]],
        [c[0], y1, c[1]],
      ],
      [-(c[0] + d[0]) / 2, 0, -(c[1] + d[1]) / 2],
    );
    face(
      o,
      k,
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [c[0], y1, c[1]],
        [d[0], y1, d[1]],
      ],
      [0, 1, 0],
    );
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [c[0], y0, c[1]],
        [d[0], y0, d[1]],
      ],
      [0, -1, 0],
    );
  }
}
function box(o, k, x, z, y0, y1, w, d) {
  const a = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  const low = a.map((p) => [p[0], y0, p[1]]),
    high = a.map((p) => [p[0], y1, p[1]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      o,
      k,
      [low[i], low[j], high[j], high[i]],
      [(a[i][0] + a[j][0]) / 2 - x, 0, (a[i][1] + a[j][1]) / 2 - z],
    );
  }
  face(o, k, low, [0, -1, 0]);
  face(o, k, high, [0, 1, 0]);
}
function beam(o, k, a, b, w) {
  const v = b.map((q, i) => q - a[i]),
    l = Math.hypot(...v),
    d = v.map((q) => q / l),
    up = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    u = cross(d, up),
    ul = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= ul;
  const q = cross(d, u),
    end = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((v, i) => v + ((u[i] * s + q[i] * t) * w) / 2)),
    A = end(a),
    B = end(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, k, [A[i], A[j], B[j], B[i]]);
  }
  face(
    o,
    k,
    A,
    d.map((q) => -q),
  );
  face(o, k, B, d);
}
const radiusAt = (y) =>
  2.91 * (1 + ((P.tower.topScale - 1) * (y - P.tower.baseY)) / (P.tower.shoulderY - P.tower.baseY));
function panel(o, k, angle, y0, y1, w, offset = 0.025) {
  const N = [Math.sin(angle), Math.cos(angle)],
    U = [N[1], -N[0]],
    p = (s, y) => [
      N[0] * (radiusAt(y) + offset) + U[0] * s,
      y,
      N[1] * (radiusAt(y) + offset) + U[1] * s,
    ];
  face(o, k, [p(-w / 2, y0), p(w / 2, y0), p(w / 2, y1), p(-w / 2, y1)], [N[0], 0, N[1]]);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const T = P.tower,
    L = P.lantern,
    segments = [19, 24, 32, 48][lod];
  shell(o, 'concrete', P.nativeBaseRing, P.nativeBaseRing, -0.2, 0.45);
  componentEvidence.push('whole-native-outer-base');
  shell(
    o,
    'iron',
    P.nativeTowerRing,
    P.nativeTowerRing.map((p) => p.map((v) => v * T.topScale)),
    T.baseY,
    T.shoulderY,
  );
  componentEvidence.push('whole-native-tower-and-forty-metre-height');
  for (const G of P.galleries) {
    tube(o, 'iron', G.radius, G.y - 0.18, G.y, 19);
    ring(o, 'iron', G.radius, 0.075, G.y + 1.03, G.y + 1.1, 19);
    if (lod > 0) ring(o, 'iron', G.radius, 0.055, G.y + 0.52, G.y + 0.575, 19);
    const posts = [2, 12, 24, 38][lod];
    for (let j = 0; j < posts; j++) {
      const a = (2 * Math.PI * j) / posts,
        x = G.radius * Math.cos(a),
        z = G.radius * Math.sin(a);
      box(o, 'dark', x, z, G.y, G.y + 1.08, 0.055, 0.055);
    }
    if (lod > 0)
      for (let j = 0; j < [0, 8, 12, 19][lod]; j++) {
        const a = (2 * Math.PI * j) / [1, 8, 12, 19][lod],
          r = radiusAt(G.y - 1.35);
        beam(
          o,
          'iron',
          [r * Math.cos(a), G.y - 1.35, r * Math.sin(a)],
          [G.radius * Math.cos(a), G.y - 0.15, G.radius * Math.sin(a)],
          0.085,
        );
      }
  }
  componentEvidence.push('both-iron-galleries-railings-and-consoles');
  tube(o, 'iron', 2.03, 34.9, L.windowBottom, 19);
  tube(o, 'glass', L.radius, L.windowBottom, L.windowTop, 19);
  const mullions = [4, 8, 12, 16][lod];
  for (let j = 0; j < mullions; j++) {
    const a = (j * 2 * Math.PI) / mullions;
    box(
      o,
      'iron',
      L.radius * Math.cos(a),
      L.radius * Math.sin(a),
      L.windowBottom,
      L.windowTop,
      0.06,
      0.06,
    );
  }
  if (lod > 0) {
    ring(o, 'iron', L.radius + 0.03, 0.075, 36.93, 37.01, 19);
    tube(o, 'glass', 0.5, 36.15, 37.65, segments);
    for (let j = 0; j < [0, 3, 7, 13][lod]; j++)
      ring(
        o,
        'glass',
        0.52,
        0.045,
        36.2 + (j * 1.35) / [1, 3, 7, 13][lod],
        36.23 + (j * 1.35) / [1, 3, 7, 13][lod],
        19,
      );
  }
  componentEvidence.push('whole-lantern-and-declared-simplified-lens');
  tube(o, 'iron', L.roofRadius, L.windowTop, L.roofBase, 19);
  shell(o, 'iron', circle(L.roofRadius, 19), circle(0.1, 19), L.roofBase, L.roofTip);
  tube(o, 'dark', 0.065, L.roofTip, T.height, 6);
  componentEvidence.push('whole-conical-metal-roof');
  panel(o, 'wood', P.entry.bearing, 0.45, 2.8, 1.05, 0.035);
  if (lod > 0) {
    for (const a of [-0.59, 0.59]) {
      const z = -radiusAt(1.6) - 0.08;
      box(o, 'iron', a, z, 0.38, 2.87, 0.09, 0.11);
    }
    box(o, 'iron', 0, -radiusAt(2.85) - 0.08, 2.8, 2.92, 1.27, 0.11);
    for (let i = 0; i < 3; i++)
      box(o, 'concrete', 0, -3.14 - i * 0.35, -0.15, 0.45 - i * 0.15, 1.55, 0.7);
  }
  componentEvidence.push('intrinsic-teak-entry-and-concrete-steps');
  if (lod > 0)
    for (let i = 0; i < 8; i++) {
      const y = 4.2 + i * 3.7,
        angles = lod === 1 ? [0, Math.PI] : [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const a of angles) {
        panel(o, 'dark', a, y - 0.58, y + 0.58, 0.61, 0.04);
        panel(o, 'glass', a, y - 0.48, y + 0.48, 0.44, 0.065);
        if (lod > 1) {
          panel(o, 'iron', a, y - 0.02, y + 0.025, 0.46, 0.074);
          for (const s of [-1, 1]) {
            const N = [Math.sin(a), Math.cos(a)],
              U = [N[1], -N[0]],
              at = (yy) => [
                N[0] * (radiusAt(yy) + 0.075) + U[0] * s * 0.27,
                yy,
                N[1] * (radiusAt(yy) + 0.075) + U[1] * s * 0.27,
              ];
            beam(o, 'iron', at(y - 0.58), at(y + 0.58), 0.055);
          }
        }
      }
    }
  if (lod > 1)
    for (let i = 1; i < 26; i++) {
      const y = T.baseY + (i * (T.shoulderY - T.baseY)) / 26;
      ring(o, 'iron', radiusAt(y) + 0.022, 0.022, y, y + 0.025, 19);
      if (lod === 3)
        for (let j = 0; j < 19; j++) {
          const a = (j * 2 * Math.PI) / 19,
            r = radiusAt(y) + 0.045;
          box(o, 'dark', r * Math.cos(a), r * Math.sin(a), y - 0.018, y + 0.018, 0.032, 0.032);
        }
    }
  componentEvidence.push('estimated-window-and-panel-detail');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/uk/uk7/andenes_lighthouse',
  camera = [43, 26, 55],
  look = [0, 20, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Andenes Lighthouse — Andøya',
  wikidataId: 'Q4753689',
  cell: 'uk/uk7',
  category: 'lighthouse',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.21,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain', 'wood_plain'],
  qaCameras: [
    { name: 'whole-forty-metre-lighthouse-and-base', position: camera, lookAt: look },
    {
      name: 'both-galleries-lantern-and-conical-roof',
      position: [13, 37, 17],
      lookAt: [0, 35.3, 0],
    },
    { name: 'rear-whole-native-tower', position: [-45, 25, -55], lookAt: look },
    {
      name: 'teak-entry-native-foundation-and-iron-panels',
      position: [9, 5, -13],
      lookAt: [0, 5, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-andenes-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.18,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.09, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.03, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Exact native outlines under ODbL; primary owner construction facts used as facts. No source prose, photographs, maps, drawings, textures or borrowed meshes incorporated. Qualla searched first, all imagery unused. Upper sections, fittings and finishes are explicitly estimated; no photographic-fidelity or surveyed-ground-contact claim.',
};
