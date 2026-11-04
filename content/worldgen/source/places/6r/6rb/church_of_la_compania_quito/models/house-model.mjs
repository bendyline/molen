/** Whole La Compania Quito church. Original municipal written architecture, no imagery used. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.52, metallic: 0.03 },
  stone: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.6, metallic: 0.03 },
};
const C = {
  plaster: rgb('e0d9c6'),
  roof: rgb('879c69'),
  stone: rgb('a1a29c'),
  trim: rgb('aaa99d'),
  wood: rgb('655c4d'),
  glass: rgb('4d6178'),
};
const R = P.nativeChurchRing,
  H = P.church,
  F = P.facade;
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const componentEvidence = [];
function face(o, k, q, n, tint = C[k]) {
  q = q.map((p) => p.map(Math.fround));
  for (let i = 1; i < q.length - 1; i++) {
    let t = [q[0], q[i], q[i + 1]],
      v = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (Math.hypot(...v) < 1e-8) continue;
    if (n && dot(v, n) < 0) t = [t[0], t[2], t[1]];
    o.addTriangle(
      k,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((p) => [p[0] + p[2], p[1]]),
      tint,
    );
  }
}
function cap(o, k, ring, height, up = 1) {
  const tmp = new MeshBufferBuilder();
  if (
    !tmp.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, up, 0],
      (p) => p,
      C[k],
    )
  )
    throw Error('Whole church roof triangulation failed');
  const m = tmp.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const q = Array.from(m.indices.slice(i, i + 3)).map((j) => [
      m.positions[j * 3],
      0,
      m.positions[j * 3 + 2],
    ]);
    for (const p of q) p[1] = typeof height === 'function' ? height(p[0], p[2]) : height;
    face(o, k, q, [0, up, 0]);
  }
}
let currentLod = 3;
function solid(o, k, ring, lo, hi) {
  const area = ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      o,
      k,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  if (currentLod !== 0 || k === 'plaster' || lo < 0) cap(o, k, ring, lo, -1);
  cap(o, k, ring, hi);
}
const rect = (cx, cz, w, d) => [
  [cx - w / 2, cz - d / 2],
  [cx + w / 2, cz - d / 2],
  [cx + w / 2, cz + d / 2],
  [cx - w / 2, cz + d / 2],
];
const box = (o, k, cx, cz, w, d, lo, hi) => solid(o, k, rect(cx, cz, w, d), lo, hi);
function cylinder(o, k, cx, cz, r, lo, hi, n) {
  const q = Array.from({ length: n }, (_, i) => [
    cx + r * Math.cos((i * 2 * Math.PI) / n),
    cz + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
  solid(o, k, q, lo, hi);
}
function dome(o, cx, cz, rx, rz, base, rise, lod, k = 'roof') {
  const n = [4, 10, 18, 28][lod],
    m = [2, 5, 8, 12][lod];
  for (let j = 0; j < m; j++)
    for (let i = 0; i < n; i++) {
      const point = (ii, jj) => {
        const a = (ii * 2 * Math.PI) / n,
          b = (jj * Math.PI) / 2 / m;
        return [
          cx + rx * Math.cos(a) * Math.cos(b),
          base + rise * Math.sin(b),
          cz + rz * Math.sin(a) * Math.cos(b),
        ];
      };
      const q = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)],
        center = q.reduce((s, p) => s.map((v, i) => v + p[i] / 4), [0, 0, 0]);
      face(o, k, q, [center[0] - cx, ((center[1] - base) * rx) / rise, center[2] - cz]);
    }
}
function barrel(o, part, lod) {
  const r = part.ring,
    mid = r.reduce((s, p) => s + p[1] / r.length, 0),
    ends = [
      r.filter((p) => p[1] < mid).sort((a, b) => a[0] - b[0]),
      r.filter((p) => p[1] > mid).sort((a, b) => a[0] - b[0]),
    ],
    n = [4, 8, 16, 24][lod],
    row = ends.map(([a, b]) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return [
          a[0] + (b[0] - a[0]) * t,
          H.naveEaves + (H.naveCrown - H.naveEaves) * Math.sin(Math.PI * t),
          a[1] + (b[1] - a[1]) * t,
        ];
      }),
    );
  solid(o, 'plaster', r, P.floor, H.naveEaves);
  for (let i = 0; i < n; i++)
    face(o, 'roof', [row[0][i], row[0][i + 1], row[1][i + 1], row[1][i]], [0, 1, 0]);
  for (const [j, v] of [
    [0, -1],
    [1, 1],
  ])
    face(o, 'plaster', row[j], [0, 0, v]);
  componentEvidence.push({ kind: 'whole-nave-barrel', nativePart: part.id, fullLength: true });
}
function elevationSolid(o, k, poly, z, depth) {
  // Convex sub-panels make up the complete facade; the main body owns all hidden back intersections.
  for (const [zz, v] of [
    [z, -1],
    [z + depth, 1],
  ])
    face(
      o,
      k,
      poly.map(([x, y]) => [x, y, zz]),
      [0, 0, v],
    );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    face(
      o,
      k,
      [
        [...a, z],
        [...b, z],
        [...b, z + depth],
        [...a, z + depth],
      ].map(([x, y, z]) => [x, y, z]),
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
}
function archPanel(o, k, x, z, width, bottom, spring, lod) {
  const n = [4, 8, 12, 20][lod],
    r = width / 2,
    q = [
      [x - r, bottom],
      [x + r, bottom],
      [x + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    q.push([x + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  face(
    o,
    k,
    q.map(([x, y]) => [x, y, z]),
    [0, 0, -1],
  );
}
function twistedColumn(o, x, z, lod) {
  const n = [4, 6, 8, 10][lod],
    m = [1, 8, 16, 24][lod],
    lo = F.columnBase,
    hi = lo + F.columnHeight;
  box(o, 'trim', x, z, 0.95, 1.0, 0.35, lo);
  cylinder(o, 'stone', x, z, 0.48, lo - 0.13, lo + 0.16, n);
  const row = (j) => {
    const y = lo + ((hi - lo) * j) / m,
      t = Math.max(0, (j / m - 1 / 3) * 1.5),
      a = t * 4 * Math.PI,
      off = lod === 0 ? 0 : 0.13;
    return Array.from({ length: n }, (_, i) => {
      const q = (i * 2 * Math.PI) / n;
      return [
        x + off * Math.cos(a) + 0.29 * Math.cos(q),
        y,
        z + off * Math.sin(a) + 0.29 * Math.sin(q),
      ];
    });
  };
  for (let j = 0; j < m; j++) {
    const a = row(j),
      b = row(j + 1);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(o, 'stone', [a[i], a[k], b[k], b[i]], [a[i][0] - x, 0, a[i][2] - z]);
    }
  }
  cylinder(o, 'trim', x, z, 0.5, hi, hi + 0.25, n);
  box(o, 'trim', x, z, 1.03, 1.08, hi + 0.25, hi + 0.55);
}
function facade(o, lod) {
  const z = P.frontZ - 0.15,
    cx = (R[0][0] + R[1][0]) / 2,
    w = F.frontWidth;
  box(o, 'stone', cx, z + 0.6, w, 1.2, P.floor, F.lowerTop);
  for (const [y, h, ext] of [
    [0.7, 0.25, 0.4],
    [7.55, 0.35, 0.6],
    [8.15, 0.32, 0.9],
    [9.0, 0.25, 0.65],
  ])
    box(o, 'trim', cx, z + 0.48, w + ext, 1.6, y, y + h);
  box(o, 'stone', cx, z + 0.55, F.upperWidth, 1.1, F.lowerTop, F.upperTop);
  for (const side of [-1, 1]) {
    const wing = [
      [cx + (side * F.upperWidth) / 2, F.lowerTop],
      [cx + (side * w) / 2, F.lowerTop],
      [cx + side * (F.upperWidth / 2 + 2.2), 11.7],
      [cx + (side * F.upperWidth) / 2, 14.8],
    ];
    // Split the concave side scroll into convex triangles, keeping an actual shaped upper outline.
    for (let i = 1; i < wing.length - 1; i++)
      elevationSolid(o, 'stone', [wing[0], wing[i], wing[i + 1]], z + 0.14, 0.9);
    if (lod > 0) {
      cylinder(o, 'trim', cx + side * 13.0, z + 0.17, 0.6, 9.2, 10.0, 8);
      box(o, 'trim', cx + side * 8.1, z - 0.11, 0.45, 0.35, 10.0, 16.7);
    }
  }
  const poly = [
    [cx - 9.1, F.upperTop],
    [cx + 9.1, F.upperTop],
    [cx + 5.4, 18.7],
    [cx + 2.8, F.pedimentTop],
    [cx - 2.8, F.pedimentTop],
    [cx - 5.4, 18.7],
  ];
  elevationSolid(o, 'stone', poly, z + 0.05, 1.0);
  box(o, 'trim', cx, z - 0.12, 18.5, 0.5, 16.8, 17.15);
  box(o, 'trim', cx, z - 0.1, 6.2, 0.6, 19.25, 19.55);
  // Three closed real doors, a central arch and lintelled lateral entrances.
  archPanel(o, 'trim', cx, z - 0.07, 5.0, P.floor, 4.25, lod);
  archPanel(o, 'wood', cx, z - 0.095, 3.75, P.floor, 4.05, lod);
  for (const side of [-1, 1]) {
    box(o, 'trim', cx + side * 10.6, z - 0.12, 3.8, 0.35, P.floor, 5.25);
    box(o, 'wood', cx + side * 10.6, z - 0.32, 2.7, 0.12, P.floor, 4.5);
    for (const off of [-2.0, 2.0])
      box(o, 'trim', cx + side * 10.6 + off, z - 0.26, 0.5, 0.5, 0.4, 6.9);
    box(o, 'trim', cx + side * 10.6, z - 0.22, 4.7, 0.6, 5.1, 5.45);
    if (lod > 0) {
      cylinder(o, 'trim', cx + side * 10.6, z - 0.33, 0.7, 5.7, 6.3, 8);
      box(o, 'trim', cx + side * 10.6, z - 0.3, 4.4, 0.65, 6.7, 7.05);
    }
  }
  for (const side of [-1, 1])
    for (const x of [4.0, 5.45, 6.9]) twistedColumn(o, cx + side * x, z - 0.68, lod);
  archPanel(o, 'trim', cx, z - 0.1, 4.0, 10.3, 12.0, lod);
  archPanel(o, 'glass', cx, z - 0.13, 2.6, 10.7, 12.1, lod);
  if (lod > 0)
    for (const side of [-1, 1])
      for (const y of [10.8, 14.0]) {
        archPanel(o, 'plaster', cx + side * 6.4, z - 0.16, 1.5, y, y + 1.0, lod);
        cylinder(o, 'trim', cx + side * 6.4, z - 0.39, 0.24, y, y + 0.8, 6);
      }
  const gold = rgb('cfb45f');
  // The crown is a coarse original monstrance symbol, without copying sculptural relief or lettering.
  for (const [x, y, w, h] of [
    [cx, 20.0, 0.22, 1.5],
    [cx, 20.8, 1.4, 0.18],
  ])
    face(
      o,
      'plaster',
      [
        [x - w / 2, y - h / 2, z - 0.22],
        [x + w / 2, y - h / 2, z - 0.22],
        [x + w / 2, y + h / 2, z - 0.22],
        [x - w / 2, y + h / 2, z - 0.22],
      ],
      [0, 0, -1],
      gold,
    );
  componentEvidence.push({
    kind: 'complete-three-door-two-register-baroque-facade',
    doors: 3,
    mainSolomonicColumns: 6,
    columnHeight: 5,
    upperWindow: true,
    volutes: true,
    splitPedimentAndCrown: true,
  });
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  currentLod = lod;
  solid(o, 'stone', R, H.foundationBottom, P.floor);
  solid(o, 'plaster', R, P.floor, H.bodyTop);
  const native = (id) => P.nativeParts.find((p) => p.id === `buildings/${id}`),
    n = [4, 10, 18, 28][lod];
  barrel(o, native('35185045958240'), lod);
  solid(o, 'plaster', native('35185045958241').ring, H.bodyTop, H.rearWallTop);
  cap(o, 'roof', native('35185045958241').ring, H.rearWallTop + 0.1);
  solid(
    o,
    'plaster',
    Array.from({ length: n }, (_, i) => [
      H.presbyteryCenter[0] + H.presbyteryRadii[0] * Math.cos((i * 2 * Math.PI) / n),
      H.presbyteryCenter[1] + H.presbyteryRadii[1] * Math.sin((i * 2 * Math.PI) / n),
    ]),
    H.rearWallTop,
    H.presbyteryBase,
  );
  dome(o, ...H.presbyteryCenter, ...H.presbyteryRadii, H.presbyteryBase, H.presbyteryRise, lod);
  const dc = H.crossingCenter;
  cylinder(o, 'plaster', ...dc, H.crossingRadius, H.drumBottom, H.drumTop, n);
  dome(o, ...dc, H.crossingRadius, H.crossingRadius, H.drumTop, H.crossingDomeTop - H.drumTop, lod);
  for (const [id, x] of [
    ['35185490580976', -11.07767365],
    ['35185490580977', 10.32122626],
  ]) {
    const r = native(id).ring;
    cap(o, 'roof', r, H.aisleCupolaBase + 0.06);
    for (const z of H.chapelCenters) {
      dome(o, x, z, H.chapelRadius, H.chapelRadius, H.aisleCupolaBase, H.aisleCupolaRise, lod);
      cylinder(o, 'plaster', x, z, 0.55, 10.35, H.lanternTop - 0.3, n);
      dome(o, x, z, 0.7, 0.7, H.lanternTop - 0.3, 0.65, lod);
      componentEvidence.push({
        kind: 'whole-lateral-chapel-cupola-lantern',
        side: x < 0 ? 'north' : 'south',
        center: [x, z],
        nativeAislePart: id,
      });
    }
  }
  if (lod > 0) {
    for (const side of [-1, 1])
      for (const z of [-44, -30, -16]) {
        const x = side < 0 ? -15.55 : 14.47;
        box(o, 'trim', x, z, 0.12, 2.0, 4.4, 6.7);
        box(o, 'glass', x + (side < 0 ? -0.07 : 0.07), z, 0.1, 1.25, 4.65, 6.4);
      }
  }
  facade(o, lod);
  componentEvidence.push({
    kind: 'whole-nine-control-church-envelope-all-roofs',
    nativeControls: 9,
    nativeParts: 5,
    crossingDome: true,
    presbyteryVault: true,
    integralRearSacristyEnvelope: true,
    removedBellTowerExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/6r/6rb/church_of_la_compania_quito',
  camera = [77, 55, -126],
  look = [0, 9, -17];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: '6r/6rb',
  title: 'La Compañía, Quito — complete church and six chapel domes',
  wikidataId: 'Q3075573',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Complete nine-control physical church, main barrel vault, six chapel cupolas and lanterns, crossing drum/hemisphere, oblong presbytery vault and intrinsic rear/sacristy envelope. Three-door Baroque facade with six5m Solomonic columns, two registers, upper window, niches, volutes and broken pediment/crown. Municipal written architectural facts and original numeric body/roof parts; all imagery unused, estimated hidden details/sections/finish/grade.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: H.foundationBottom - 0.03,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'tile_glazed',
    'stone_basalt_raw',
    'stone_ashlar',
    'wood_plain',
    'window_punched',
  ],
  qaCameras: [
    { name: 'whole-church-three-door-facade-sixchapel-domes', position: camera, lookAt: look },
    {
      name: 'complete-north-rear-presbytery-sacristy',
      position: [-76, 48, 77],
      lookAt: [0, 10, 0],
    },
    { name: 'main-crossing-and-all-six-chapel-roofs', position: [55, 76, 18], lookAt: [0, 9, -18] },
    {
      name: 'six-solomonic-columns-two-register-facade',
      position: [1, 11, -91],
      lookAt: [0, 9, P.frontZ],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-compania-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Municipal written architectural facts only; every photograph/diagram/artwork unused. Original numerical Protomaps/OpenStreetMap fullchurch/parts ODbL. No borrowed mesh or photograph texture; hidden sections/ornament/finish/grade estimated; no surveyed contact or current replacement.',
};
