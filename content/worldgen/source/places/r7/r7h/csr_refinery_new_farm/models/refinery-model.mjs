/** Original whole historic refinery architecture; no photographic pixels become textures. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  trim: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.12 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.08 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.08 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
};
const C = {
  brick: rgb('b99a7f'),
  trim: rgb('d1b395'),
  roof: rgb('9c9d94'),
  frame: rgb('555b54'),
  glass: rgb('344442'),
  stone: rgb('948b7b'),
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0),
  rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
function T(o, k, q, v, col = C[k]) {
  q = q.map((a) => a.map(Math.fround));
  if (v && dot(cross(sub(q[1], q[0]), sub(q[2], q[0])), v) < 0) [q[1], q[2]] = [q[2], q[1]];
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
const B = (o, k, x, y, z, w, h, d, col = C[k]) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], col);
function gable(o, a) {
  const r = rect(a.x, a.z, a.w + 0.42, a.d + 0.42),
    y = a.eave,
    Y = a.ridge,
    A = [a.x - a.w / 2 - 0.21, Y, a.z],
    B = [a.x + a.w / 2 + 0.21, Y, a.z];
  Q(o, 'roof', [[r[0][0], y, r[0][1]], [r[1][0], y, r[1][1]], B, A], [0, 1, -1]);
  Q(o, 'roof', [[r[2][0], y, r[2][1]], [r[3][0], y, r[3][1]], A, B], [0, 1, 1]);
  T(o, a.metal ? 'roof' : 'brick', [[r[0][0], y, r[0][1]], A, [r[3][0], y, r[3][1]]], [-1, 0, 0]);
  T(o, a.metal ? 'roof' : 'brick', [[r[2][0], y, r[2][1]], B, [r[1][0], y, r[1][1]]], [1, 0, 0]);
  BVent(o, a);
}
function BVent(o, a) {
  if (a.id === 'connected-historic-laboratory') return;
  B(o, 'roof', a.x, a.ridge - 0.02, a.z, a.w * 0.66, 0.28, 0.55);
  B(o, 'roof', a.x, a.ridge + 0.26, a.z, a.w * 0.68, 0.12, 1.0);
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    s = y + h - r,
    a = [
      [x - r, y],
      [x + r, y],
      [x + r, s],
    ];
  for (let j = 1; j <= n; j++) {
    const t = (j * Math.PI) / n;
    a.push([x + Math.cos(t) * r, s + Math.sin(t) * r]);
  }
  return a;
}
export const partEvidence = [],
  windowEvidence = [];
function elevation(o, a, lod, side) {
  const z = a.z + (side * a.d) / 2,
    n = [2, 4, 6, 10][lod],
    base = a.base ?? 0,
    ww = a.metal ? 2.1 : a.id === 'connected-historic-laboratory' ? 2.0 : 3.0,
    h = a.metal ? 1.55 : 2.65,
    holes = [];
  const P = (q, depth = 0) => [q[0], q[1], z - side * depth],
    v = [0, 0, side],
    k = a.metal ? 'roof' : 'brick';
  for (const y of a.rows)
    for (let j = 0; j < a.columns; j++) {
      const x = a.x - a.w / 2 + (a.w * (j + 0.5)) / a.columns,
        entrance =
          side === -1 &&
          y === a.rows[0] &&
          j === a.columns - 1 &&
          ['southern-refined-sugar-store', 'central-pan-house'].includes(a.id),
        width = entrance ? 4.0 : ww,
        height = entrance ? 4.1 : h,
        bottom = entrance ? 0.15 : y;
      holes.push({
        x,
        y: bottom,
        w: width,
        h: height,
        entrance,
        shape: a.metal
          ? [
              [x - ww / 2, y],
              [x + ww / 2, y],
              [x + ww / 2, y + h],
              [x - ww / 2, y + h],
            ]
          : arch(x, bottom, width, height, n),
      });
    }
  const outer = [
    [a.x - a.w / 2, base],
    [a.x + a.w / 2, base],
    [a.x + a.w / 2, a.eave],
    [a.x - a.w / 2, a.eave],
  ];
  if (lod < 2) {
    Q(
      o,
      k,
      outer.map((q) => P(q)),
      v,
    );
  } else {
    const all = [outer, ...holes.map((h) => h.shape)].flat(),
      ix = ShapeUtils.triangulateShape(
        outer.map((q) => new Vector2(...q)),
        holes.map((h) => h.shape.map((q) => new Vector2(...q))),
      );
    for (const t of ix)
      T(
        o,
        k,
        t.map((i) => P(all[i])),
        v,
      );
  }
  for (const hole of holes) {
    const s = hole.shape,
      depth = lod >= 2 ? p.windowRecess : -0.025;
    for (let i = 1; i < s.length - 1; i++)
      T(
        o,
        'glass',
        [s[0], s[i], s[i + 1]].map((q) => P(q, depth)),
        v,
      );
    if (lod >= 2) {
      for (let i = 0; i < s.length; i++) {
        const j = (i + 1) % s.length;
        Q(o, k, [P(s[i]), P(s[j]), P(s[j], depth), P(s[i], depth)]);
      }
      const outerTrim = a.metal
        ? [
            [hole.x - hole.w / 2 - 0.1, hole.y - 0.1],
            [hole.x + hole.w / 2 + 0.1, hole.y - 0.1],
            [hole.x + hole.w / 2 + 0.1, hole.y + hole.h + 0.1],
            [hole.x - hole.w / 2 - 0.1, hole.y + hole.h + 0.1],
          ]
        : arch(hole.x, hole.y - 0.1, hole.w + 0.2, hole.h + 0.2, n);
      for (let i = 0; i < s.length; i++) {
        const j = (i + 1) % s.length;
        Q(
          o,
          'trim',
          [P(outerTrim[i], -0.025), P(outerTrim[j], -0.025), P(s[j], -0.025), P(s[i], -0.025)],
          v,
        );
      }
      const spring = a.metal ? hole.y + hole.h : hole.y + hole.h - hole.w / 2;
      for (const xx of hole.entrance ? [] : [hole.x - hole.w / 6, hole.x + hole.w / 6])
        Q(
          o,
          'frame',
          [
            [xx - 0.03, hole.y, z - side * (depth - 0.025)],
            [xx + 0.03, hole.y, z - side * (depth - 0.025)],
            [xx + 0.03, spring, z - side * (depth - 0.025)],
            [xx - 0.03, spring, z - side * (depth - 0.025)],
          ],
          v,
        );
      for (let j = 1; !hole.entrance && j < 4; j++) {
        const y = hole.y + ((spring - hole.y) * j) / 4;
        Q(
          o,
          'frame',
          [
            [hole.x - hole.w / 2, y - 0.03, z - side * (depth - 0.025)],
            [hole.x + hole.w / 2, y - 0.03, z - side * (depth - 0.025)],
            [hole.x + hole.w / 2, y + 0.03, z - side * (depth - 0.025)],
            [hole.x - hole.w / 2, y + 0.03, z - side * (depth - 0.025)],
          ],
          v,
        );
      }
    }
    windowEvidence.push({
      part: a.id,
      side,
      center: [hole.x, hole.y, z],
      width: hole.w,
      height: hole.h,
      recessDepth: lod >= 2 ? p.windowRecess : 0,
      arched: !a.metal,
      entrance: hole.entrance,
    });
  }
  if (!a.metal && lod > 0)
    for (let j = 0; j <= a.columns; j++) {
      const x = a.x - a.w / 2 + (a.w * j) / a.columns;
      B(o, 'trim', x, base, z + side * 0.12, 0.48, a.eave - base, 0.28);
      B(o, 'trim', x, a.eave - 0.35, z + side * 0.18, 0.76, 0.35, 0.44);
    }
  if (lod > 0) {
    B(o, a.metal ? 'roof' : 'trim', a.x, a.eave - 0.18, z + side * 0.12, a.w, 0.18, 0.3);
    if (!a.metal)
      for (const y of a.rows.slice(1)) B(o, 'trim', a.x, y - 0.3, z + side * 0.045, a.w, 0.13, 0.1);
  }
}
function mass(o, a, lod) {
  const x0 = a.x - a.w / 2,
    x1 = a.x + a.w / 2,
    z0 = a.z - a.d / 2,
    z1 = a.z + a.d / 2,
    y = a.base ?? 0,
    k = a.metal ? 'roof' : 'brick';
  elevation(o, a, lod, -1);
  elevation(o, a, lod, 1);
  Q(
    o,
    k,
    [
      [x0, y, z1],
      [x0, y, z0],
      [x0, a.eave, z0],
      [x0, a.eave, z1],
    ],
    [-1, 0, 0],
  );
  Q(
    o,
    k,
    [
      [x1, y, z0],
      [x1, y, z1],
      [x1, a.eave, z1],
      [x1, a.eave, z0],
    ],
    [1, 0, 0],
  );
  Q(
    o,
    k,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    [0, -1, 0],
  );
  if (!a.metal) B(o, 'stone', a.x, p.base, a.z, a.w, -p.base, a.d);
  gable(o, a);
  if (a.id === 'southern-refined-sugar-store' && lod > 0)
    for (let j = 0; j < 4; j++)
      B(o, 'trim', x1 + 0.1, 0, z0 + (a.d * (j + 0.5)) / 4, 0.25, a.eave, 0.46);
}
function lathe(o, k, x, z, profile, n, phase = Math.PI / 6) {
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = phase + (i * 2 * Math.PI) / n,
        b = phase + ((i + 1) * 2 * Math.PI) / n,
        [y, r] = profile[j - 1],
        [Y, R] = profile[j],
        q = [
          [x + r * Math.cos(a), y, z + r * Math.sin(a)],
          [x + r * Math.cos(b), y, z + r * Math.sin(b)],
          [x + R * Math.cos(b), Y, z + R * Math.sin(b)],
          [x + R * Math.cos(a), Y, z + R * Math.sin(a)],
        ];
      Q(o, k, q, [Math.cos((a + b) / 2), 0.2, Math.sin((a + b) / 2)]);
    }
}
export function buildRefinery(out, _frame, lod = 3) {
  partEvidence.length = windowEvidence.length = 0;
  let triangles = 0;
  const o = {
    addTriangle(...a) {
      triangles++;
      out.addTriangle(...a);
    },
    addQuad(...a) {
      triangles += 2;
      out.addQuad(...a);
    },
    addConvexPolygon(...a) {
      triangles += a[2].length - 2;
      out.addConvexPolygon(...a);
    },
  };
  for (const a of p.parts) {
    const before = triangles;
    mass(o, a, lod);
    partEvidence.push({ id: a.id, triangles: triangles - before });
  }
  const t = p.tower,
    before = triangles;
  lathe(
    o,
    'brick',
    t.x,
    t.z,
    [
      [t.base, t.radius],
      [t.eave, t.radius],
    ],
    6,
  );
  lathe(o, 'roof', t.x, t.z, t.roof, 6);
  lathe(o, 'frame', t.x, t.z, t.finial, [4, 6, 8, 12][lod]);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + ((i + 0.5) * Math.PI) / 3,
      n = [Math.cos(a), 0, Math.sin(a)],
      u = [-n[2], 0, n[0]],
      r = t.radius * Math.cos(Math.PI / 6) + 0.025,
      ctr = [t.x + r * n[0], 26.5, t.z + r * n[2]],
      points = [
        [-0.65, 0],
        [0.65, 0],
        [0.65, 2.2],
        [-0.65, 2.2],
      ].map(([x, y]) => [ctr[0] + u[0] * x, ctr[1] + y, ctr[2] + u[2] * x]);
    if (lod > 0) Q(o, 'glass', points, n);
    beam(
      o,
      'frame',
      [t.x + (r - 0.12) * n[0], 30.1, t.z + (r - 0.12) * n[2]],
      [t.x + 3.8 * n[0], 31.35, t.z + 3.8 * n[2]],
      0.15,
      0.15,
      C.frame,
    );
  }
  partEvidence.push({
    id: 'hexagonal-char-tower-coved-roof-and-finial',
    triangles: triangles - before,
  });
  const awning = triangles;
  Q(
    o,
    'roof',
    [
      [-2, 5.4, -8.05],
      [37, 5.4, -8.05],
      [37, 4.9, -10.4],
      [-2, 4.9, -10.4],
    ],
    [0, 1, -0.3],
  );
  Q(
    o,
    'roof',
    [
      [-2, 4.72, -10.4],
      [37, 4.72, -10.4],
      [37, 4.9, -10.4],
      [-2, 4.9, -10.4],
    ],
    [0, 0, -1],
  );
  if (lod > 0)
    for (let x = 0; x <= 36; x += 6)
      beam(o, 'frame', [x, 7.3, -8.15], [x, 4.95, -10.35], 0.055, 0.055, C.frame);
  partEvidence.push({
    id: 'own-suspended-riverfront-entrance-awning',
    triangles: triangles - awning,
  });
  const firewall = triangles;
  B(o, 'brick', 1.5, 0, 0.8, 0.5, 20.8, 18.1);
  B(o, 'trim', 1.5, 20.7, 0.8, 0.7, 0.25, 18.3);
  partEvidence.push({ id: 'five-and-eight-bay-firewall', triangles: triangles - firewall });
}
export const refinerySkyline = (o) => buildRefinery(o, null, 0),
  refineryDistrict = (o) => buildRefinery(o, null, 1),
  refineryStreet = (o) => buildRefinery(o, null, 2),
  refineryCloseup = (o) => buildRefinery(o, null, 3);
const outlines = p.parts.filter((a) => !a.metal).map((a) => rect(a.x, a.z, a.w, a.d)),
  look = [-10, 13, 0];
export const refineryModel = {
  id: 'csr_refinery_new_farm',
  key: 'csr_refinery_new_farm',
  cell: 'r7/r7h',
  title: 'CSR Refinery, New Farm — historic refining block',
  category: 'historic-industrial',
  recipe: 'refinery-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildRefinery,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole circa1902 principal CSR refining building: thirteen brick bays, four/five storeys, arched twelve-pane openings and pilasters, five/eight-bay firewall, stepped corrugated upper storeys/ventilated gables, hexagonal char tower with coved cap/brackets/finial, suspended entrance awning and connected lower laboratory. Exact published Qualla public-domain SLQ originals. Historical approximate native registration and hidden rear sections; not modern apartment conversion or entire industrial site.',
  appearance: {
    kind: 'historical',
    representedDate: p.representedDate,
    validFrom: '1898-01-01',
    validUntil: '1908-01-01',
    currentWorldEligible: false,
  },
  camera: [95, 67, -150],
  lookAt: look,
  portableGroundY: -1.5,
  mediumFiContext: {
    scale: 1.6,
    groundY: -1.6,
    far: 2000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'metal_corrugated', 'metal_painted', 'stone_limestone_raw'],
  groundCutout: {
    outline: outlines[0],
    outlines,
    additionalOutlines: outlines.slice(1),
    basis:
      'Four physical historic architectural volumes only, not property or full native modern footprint. Original field retained, historic contact unverified.',
  },
  qaCameras: [
    { name: 'whole-industrial-riverfront', position: [80, 40, -125], lookAt: look },
    { name: 'char-tower-stepped-roof', position: [-85, 42, -62], lookAt: [-43, 24, 0] },
    { name: 'arched-bays-and-laboratory', position: [-4, 13, -50], lookAt: [-13, 9, -7] },
    { name: 'whole-rear-and-roof-sections', position: [70, 55, 95], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-refinery-' + reviewLod,
    position: [80, 46, -125],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/refinery-runtime-overlay.mjs',
    level: 'skyline',
    export: 'refinerySkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'refineryDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'refineryStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'refineryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [p.geometryBasis, p.sectionBasis, ...p.limits],
};
