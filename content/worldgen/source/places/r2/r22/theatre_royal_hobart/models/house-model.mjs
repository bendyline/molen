/** Entire historic theatre, classical Campbell Street entrance and full rear stage/fly tower. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building,
  B = P.basis,
  F = P.facade;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'brick', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.18 },
  trim: { slot: 'trim', graph: 'stucco', roughness: 0.9, metallic: 0 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.55, metallic: 0.2 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
};
const colors = {
  wall: rgb('c2a07a'),
  foundation: rgb('8e705b'),
  roof: rgb('727d7a'),
  trim: rgb('eadcc0'),
  window: rgb('405552'),
  door: rgb('56432e'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole house cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  box = (o, k, x0, x1, z0, z1, y0, y1) => polygon(o, k, rect(x0, x1, z0, z1), y0, y1);
function clipZ(r, z, sign) {
  const out = [],
    d = (p) => (p[1] - z) * sign;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = d(a),
      B = d(b);
    if (A >= -1e-8) out.push(a);
    if (A >= 0 !== B >= 0) {
      const t = A / (A - B);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out;
}
export const flyRing = clipZ(P.nativeBuildingRing, P.flytower.frontZ, -1),
  hallRing = clipZ(P.nativeBuildingRing, P.flytower.frontZ, 1);
function column(o, x, z, y0, y1, r, lod) {
  const sides = [4, 8, 12, 16][lod];
  for (const [a, b, R] of [
    [y0, y0 + 0.16, r * 1.4],
    [y0 + 0.16, y1 - 0.23, r],
    [y1 - 0.23, y1, r * 1.45],
  ])
    polygon(
      o,
      'trim',
      Array.from({ length: sides }, (_, i) => [
        x + R * Math.cos((i * 2 * Math.PI) / sides),
        z + R * Math.sin((i * 2 * Math.PI) / sides),
      ]),
      a,
      b,
    );
}
function frontRect(o, k, x0, x1, y0, y1, z) {
  face(
    o,
    k,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
  );
}
function archPanel(o, lod, x, z, y0, spring, r, k = 'door') {
  const n = [6, 10, 16, 24][lod],
    q = [
      [x - r, y0, z],
      [x + r, y0, z],
      [x + r, spring, z],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    q.push([x + r * Math.cos(a), spring + r * Math.sin(a), z]);
  }
  face(o, k, q, [0, 0, 1]);
  if (!lod) return;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      point = (t, R) => [x + R * Math.cos(t), spring + R * Math.sin(t), z + 0.045];
    face(o, 'trim', [point(a, r), point(a, r + 0.15), point(b, r + 0.15), point(b, r)], [0, 0, 1]);
  }
  for (const s of [-1, 1])
    beam(
      o,
      'trim',
      [x + s * (r + 0.08), y0, z + 0.045],
      [x + s * (r + 0.08), spring, z + 0.045],
      0.15,
      0.15,
      colors.trim,
    );
}
function facade(o, lod) {
  const x = B.centerX,
    z = B.frontZ + 0.04,
    w = B.width,
    L = x - w / 2,
    R = x + w / 2;
  frontRect(o, 'wall', L, R, P.floor, H.lowerTop, z);
  frontRect(o, 'trim', L, R, H.lowerTop, H.wallTop, z);
  for (const y of [H.lowerTop - 0.22, H.wallTop - 0.18, H.wallTop + 0.12])
    box(o, 'trim', L - 0.22, R + 0.22, z - 0.04, z + 0.28, y, y + 0.18);
  box(o, 'trim', L, R, z - 0.04, z + 0.22, H.wallTop + 0.3, H.frontParapetTop - 0.23);
  const piers = lod ? 11 : 5;
  for (let i = 0; i < piers; i++) {
    const u = L + 0.2 + ((w - 0.4) * i) / (piers - 1);
    box(o, 'trim', u - 0.11, u + 0.11, z - 0.03, z + 0.31, H.wallTop + 0.3, H.frontParapetTop);
  }
  for (const u of [L + 0.22, x - w / 6, x + w / 6, R - 0.22])
    for (const [y0, y1] of [
      [P.floor, H.lowerTop - 0.22],
      [H.lowerTop + 0.06, H.wallTop - 0.18],
    ]) {
      const ds = lod ? [-0.14, 0.14] : [0];
      for (const d of ds) {
        box(o, 'trim', u + d - 0.085, u + d + 0.085, z + 0.01, z + 0.15, y0, y1);
        if (lod) {
          box(o, 'trim', u + d - 0.14, u + d + 0.14, z, z + 0.23, y0, y0 + 0.16);
          box(o, 'trim', u + d - 0.14, u + d + 0.14, z, z + 0.23, y1 - 0.14, y1);
        }
      }
    }
  archPanel(o, lod, x, z + 0.04, P.floor, F.archSpring, F.centralArchRadius);
  for (const side of [-1, 1]) {
    const u = x + (side * w) / 3;
    archPanel(o, lod, u, z + 0.05, P.floor + 0.3, 2.9, 0.85, 'window');
    frontRect(
      o,
      'window',
      u - 0.8,
      u + 0.8,
      F.upperSill,
      F.upperSill + F.upperWindowHeight,
      z + 0.07,
    );
    if (lod) {
      for (const U of [u - 0.86, u, u + 0.86])
        beam(
          o,
          'trim',
          [U, F.upperSill - 0.08, z + 0.09],
          [U, F.upperSill + F.upperWindowHeight + 0.08, z + 0.09],
          0.07,
          0.09,
          colors.trim,
        );
      for (const Y of [F.upperSill - 0.08, F.upperSill + F.upperWindowHeight + 0.08])
        beam(o, 'trim', [u - 0.9, Y, z + 0.1], [u + 0.9, Y, z + 0.1], 0.12, 0.13, colors.trim);
    }
  }
  frontRect(
    o,
    'window',
    x - 0.75,
    x + 0.75,
    F.upperSill,
    F.upperSill + F.upperWindowHeight,
    z + 0.07,
  );
  const pz = z + F.porticoProjection;
  for (const side of [-1, 1])
    column(o, x + side * 1.6, pz, P.floor, F.columnTop, F.columnRadius, lod);
  box(
    o,
    'trim',
    x - F.porticoWidth / 2,
    x + F.porticoWidth / 2,
    z - 0.05,
    pz + 0.3,
    F.columnTop,
    F.pedimentBase,
  );
  const triangle = [
    [x - F.porticoWidth / 2, F.pedimentBase, pz + 0.31],
    [x + F.porticoWidth / 2, F.pedimentBase, pz + 0.31],
    [x, F.pedimentTop, pz + 0.31],
  ];
  face(o, 'trim', triangle, [0, 0, 1]);
  face(
    o,
    'trim',
    triangle.map((p) => [p[0], p[1], z - 0.05]),
    [0, 0, -1],
  );
  for (let i = 0; i < 3; i++) {
    const a = triangle[i],
      b = triangle[(i + 1) % 3];
    face(
      o,
      'trim',
      [a, b, [b[0], b[1], z - 0.05], [a[0], a[1], z - 0.05]],
      i === 0 ? [0, -1, 0] : [0, 1, 0],
    );
    if (lod) beam(o, 'trim', a, b, 0.11, 0.15, colors.trim);
  }
  for (let i = 0; i < 3; i++)
    box(
      o,
      'wall',
      x - 2.3,
      x + 2.3,
      z + F.porticoProjection + 0.3 + i * 0.3,
      z + F.porticoProjection + 0.6 + i * 0.3,
      0,
      (P.floor * (3 - i)) / 3,
    );
  if (lod > 1) {
    for (let i = 0; i < 10; i++) {
      const y = P.floor + 0.3 + (i * (H.lowerTop - P.floor - 0.5)) / 10;
      beam(
        o,
        'wall',
        [L + 0.04, y, z + 0.025],
        [R - 0.04, y, z + 0.025],
        0.018,
        0.025,
        rgb('96795b'),
      );
    }
  }
  if (lod) {
    const alphabet = {
        T: [
          [
            [0, 1],
            [1, 1],
          ],
          [
            [0.5, 1],
            [0.5, 0],
          ],
        ],
        H: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [1, 0],
            [1, 1],
          ],
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
        E: [
          [
            [1, 1],
            [0, 1],
          ],
          [
            [0, 1],
            [0, 0],
          ],
          [
            [0, 0.5],
            [0.8, 0.5],
          ],
          [
            [0, 0],
            [1, 0],
          ],
        ],
        A: [
          [
            [0, 0],
            [0.5, 1],
          ],
          [
            [0.5, 1],
            [1, 0],
          ],
          [
            [0.2, 0.4],
            [0.8, 0.4],
          ],
        ],
        R: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [0, 1],
            [1, 1],
          ],
          [
            [1, 1],
            [1, 0.5],
          ],
          [
            [1, 0.5],
            [0, 0.5],
          ],
          [
            [0.5, 0.5],
            [1, 0],
          ],
        ],
        O: [
          [
            [0, 0],
            [0, 1],
          ],
          [
            [0, 1],
            [1, 1],
          ],
          [
            [1, 1],
            [1, 0],
          ],
          [
            [1, 0],
            [0, 0],
          ],
        ],
        Y: [
          [
            [0, 1],
            [0.5, 0.5],
          ],
          [
            [1, 1],
            [0.5, 0.5],
          ],
          [
            [0.5, 0.5],
            [0.5, 0],
          ],
        ],
        L: [
          [
            [0, 1],
            [0, 0],
          ],
          [
            [0, 0],
            [1, 0],
          ],
        ],
      },
      h = 0.2,
      advance = 0.24,
      text = F.name,
      start = x - (text.length * advance) / 2;
    for (let i = 0; i < text.length; i++)
      for (const [a, b] of alphabet[text[i]] ?? []) {
        const point = (p) => [
          start + i * advance + p[0] * 0.14,
          F.columnTop + 0.1 + p[1] * h,
          pz + 0.32,
        ];
        beam(o, 'trim', point(a), point(b), 0.022, 0.025, rgb('c4a353'));
      }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'wall', P.nativeBuildingRing, H.basementBottom, P.floor);
  polygon(o, 'wall', P.nativeBuildingRing, P.floor, H.lowerTop);
  polygon(o, 'foundation', P.nativeBuildingRing, H.lowerTop, H.wallTop);
  componentEvidence.push(
    'entire-original-masonry-theatre-longitudinal-walls-basement-auditorium-foyers',
  );
  const x = B.centerX,
    l = x - B.width / 2 - 0.2,
    r = x + B.width / 2 + 0.2,
    z0 = P.flytower.frontZ,
    z1 = B.frontZ + 0.2,
    y = H.wallTop,
    top = H.mainRoofTop;
  face(
    o,
    'roof',
    [
      [l, y, z0],
      [x, top, z0],
      [x, top, z1],
      [l, y, z1],
    ],
    [0, 1, 0],
  );
  face(
    o,
    'roof',
    [
      [r, y, z1],
      [x, top, z1],
      [x, top, z0],
      [r, y, z0],
    ],
    [0, 1, 0],
  );
  face(
    o,
    'foundation',
    [
      [l, y, z1],
      [r, y, z1],
      [x, top, z1],
    ],
    [0, 0, 1],
  );
  face(
    o,
    'foundation',
    [
      [r, y, z0],
      [l, y, z0],
      [x, top, z0],
    ],
    [0, 0, -1],
  );
  if (lod) {
    beam(o, 'roof', [x, top, z0], [x, top, z1], 0.14, 0.15, colors.roof);
    for (const u of [l, r]) beam(o, 'trim', [u, y, z0], [u, y, z1], 0.14, 0.15, colors.trim);
  }
  if (lod > 1) {
    const count = lod === 2 ? 12 : 40;
    for (let i = 1; i < count; i++) {
      const z = z0 + ((z1 - z0) * i) / count;
      for (const u of [l, r])
        beam(o, 'roof', [u, y + 0.02, z], [x, top + 0.02, z], 0.025, 0.025, colors.roof);
    }
  }
  componentEvidence.push('full-auditorium-main-roof-both-complete-estimated-gable-slopes');
  polygon(o, 'foundation', flyRing, H.wallTop, P.flytower.top - 0.18);
  polygon(o, 'roof', flyRing, P.flytower.top - 0.18, P.flytower.top);
  if (lod)
    for (let i = 0; i < flyRing.length; i++) {
      const a = flyRing[i],
        b = flyRing[(i + 1) % flyRing.length];
      beam(
        o,
        'trim',
        [a[0], P.flytower.top - 0.2, a[1]],
        [b[0], P.flytower.top - 0.2, b[1]],
        0.15,
        0.2,
        colors.trim,
      );
    }
  componentEvidence.push('entire-rear-stage-full-width-fly-tower-over-eighteen-metres');
  facade(o, lod);
  componentEvidence.push(
    'two-storey-rusticated-sandstone-upper-stucco-classical-frontage-frieze-parapet',
  );
  componentEvidence.push(
    'central-arched-Tuscan-column-portico-triangular-pediment-and-plain-gilt-name',
  );
  for (const side of [-1, 1]) {
    const normal = [side, 0, 0],
      edge =
        side < 0
          ? [P.nativeBuildingRing[3], P.nativeBuildingRing[0]]
          : [P.nativeBuildingRing[2], P.nativeBuildingRing[1]];
    for (let i = 0; i < 6; i++) {
      const z = B.frontZ - 6 - i * 6.8,
        t = (z - edge[0][1]) / (edge[1][1] - edge[0][1]),
        u = edge[0][0] + t * (edge[1][0] - edge[0][0]) + side * 0.025,
        y0 = 2.1,
        y1 = 4.1;
      face(
        o,
        'window',
        [
          [u, y0, z - 0.55],
          [u, y0, z + 0.55],
          [u, y1, z + 0.55],
          [u, y1, z - 0.55],
        ],
        normal,
      );
      if (lod)
        for (const Y of [y0, y1])
          beam(o, 'wall', [u, Y, z - 0.6], [u, Y, z + 0.6], 0.13, 0.14, colors.wall);
    }
  }
  componentEvidence.push(
    'all-exterior-sidewalls-and-back-stage-envelope-retained-no-Hedberg-or-hotel-proxy',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r2/r22/theatre_royal_hobart',
  camera = [52, 38, 55],
  look = [B.centerX, 7, -18];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Theatre Royal, Hobart',
  wikidataId: 'Q3523488',
  cell: 'r2/r22',
  category: 'theatre',
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
  portableGroundY: -0.19,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_sandstone', 'brick', 'stucco', 'metal_painted', 'wood_plain'],
  qaCameras: [
    {
      name: 'whole-historic-theatre-auditorium-roof-and-rear-stage-fly-tower',
      position: camera,
      lookAt: look,
    },
    {
      name: 'whole-two-storey-classical-frontage-tuscan-portico-and-pediment',
      position: [B.centerX + 15, 8, 34],
      lookAt: [B.centerX, 4.5, B.frontZ],
    },
    {
      name: 'entire-rear-fly-tower-and-full-auditorium-sidewall',
      position: [-36, 30, -76],
      lookAt: look,
    },
    {
      name: 'complete-original-theatre-roof-and-stage-volumes',
      position: [42, 58, -30],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hobart-theatre-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural entire historic theatre exterior under repository license. Whole original numeric Protomaps/OSM-derived z15footprint/POI, not exact node survey. Stateheritage12110written construction/facade/flytower facts only; no reportphotos/maps/plans or protected pixels. Mainwall/floor/roof/flyplan heights/divisions/ornament/paint/fittings/grade explicit estimates. Plainnewprocedural name strokes, no copied artwork. No adjoiningHedberg/Hotel/campus or facadeproxy, photographic/survey/current replacement claim.',
};
