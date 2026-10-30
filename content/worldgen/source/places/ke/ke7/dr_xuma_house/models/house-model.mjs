/** Complete Empilweni dwelling: original geometric reconstruction from written construction facts. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.house;
export const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.72, metallic: 0.32 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.5, metallic: 0.18 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
};
const colors = {
  wall: rgb('a26043'),
  foundation: rgb('8e8271'),
  roof: rgb('8b918b'),
  trim: rgb('e4dcc0'),
  window: rgb('405854'),
  door: rgb('5b4933'),
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
];
function column(o, x, z, y0, y1, r, sides) {
  polygon(
    o,
    'trim',
    Array.from({ length: sides }, (_, i) => [
      x + r * Math.cos((i * Math.PI * 2) / sides),
      z + r * Math.sin((i * Math.PI * 2) / sides),
    ]),
    y0,
    y1,
  );
}
function window(o, a, b, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [dz / l, 0, -dx / l],
    p = (t, y, d = 0.027) => [a[0] + dx * t + n[0] * d, y, a[1] + dz * t + n[2] * d],
    y0 = 1.55,
    y1 = 2.85;
  face(o, 'window', [p(0, y0), p(1, y0), p(1, y1), p(0, y1)], n);
  if (!lod) return;
  for (const t of [0, 0.5, 1])
    beam(o, 'trim', p(t, y0, 0.055), p(t, y1, 0.055), 0.06, 0.07, colors.trim);
  for (const y of [y0, y1]) beam(o, 'trim', p(0, y, 0.06), p(1, y, 0.06), 0.075, 0.08, colors.trim);
  if (lod > 1) beam(o, 'trim', p(0, 2.3, 0.06), p(1, 2.3, 0.06), 0.045, 0.055, colors.trim);
}
function bay(o, x, lod) {
  const count = [4, 6, 12, 18][lod],
    r = H.bayRadius,
    z = H.bayBackZ;
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [x - r * Math.cos(t), z + H.bayProjection * Math.sin(t)];
  });
  polygon(o, 'wall', arc, P.floor, H.baySill);
  polygon(o, 'trim', arc, H.bayGlassTop, H.bayTop);
  for (let i = 0; i < count; i++) {
    const a = arc[i],
      b = arc[i + 1],
      n = [(a[0] + b[0]) / 2 - x, 0, (a[1] + b[1]) / 2 - z],
      p = (v, y) => [v[0], y, v[1]];
    face(
      o,
      'window',
      [p(a, H.baySill), p(b, H.baySill), p(b, H.bayGlassTop), p(a, H.bayGlassTop)],
      n,
    );
    if (lod && i % [1, 1, 2, 3][lod] === 0)
      beam(o, 'trim', p(a, H.baySill), p(a, H.bayGlassTop), 0.06, 0.07, colors.trim);
    if (lod > 1) beam(o, 'trim', p(a, 2.35), p(b, 2.35), 0.045, 0.06, colors.trim);
  }
  if (lod)
    for (const y of [H.baySill, H.bayGlassTop])
      for (let i = 0; i < count; i++)
        beam(
          o,
          'trim',
          [arc[i][0], y, arc[i][1]],
          [arc[i + 1][0], y, arc[i + 1][1]],
          0.07,
          0.07,
          colors.trim,
        );
}
function arch(o, lod) {
  const E = P.entrance,
    n = [6, 10, 16, 24][lod],
    z = E.z,
    depth = 0.32;
  for (const x of E.columnCenters) {
    column(o, x, z, P.floor, E.columnTop, E.columnRadius, [6, 8, 12, 16][lod]);
    if (lod) {
      polygon(o, 'trim', rect(x - 0.25, x + 0.25, z - 0.25, z + 0.25), P.floor, P.floor + 0.14);
      polygon(
        o,
        'trim',
        rect(x - 0.25, x + 0.25, z - 0.25, z + 0.25),
        E.columnTop - 0.1,
        E.columnTop + 0.08,
      );
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      p = (r, t, Z) => [E.x + r * Math.cos(t), E.archSpring + r * Math.sin(t), Z],
      r = E.archInnerRadius,
      R = E.archOuterRadius;
    for (const [Z, normal] of [
      [z + depth / 2, [0, 0, 1]],
      [z - depth / 2, [0, 0, -1]],
    ])
      face(o, 'trim', [p(r, a, Z), p(R, a, Z), p(R, b, Z), p(r, b, Z)], normal);
    face(
      o,
      'trim',
      [
        p(r, a, z - depth / 2),
        p(r, a, z + depth / 2),
        p(r, b, z + depth / 2),
        p(r, b, z - depth / 2),
      ],
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
    );
    face(
      o,
      'trim',
      [
        p(R, a, z - depth / 2),
        p(R, a, z + depth / 2),
        p(R, b, z + depth / 2),
        p(R, b, z - depth / 2),
      ],
      [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0],
    );
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', H.outline, 0.15, P.floor);
  polygon(o, 'wall', H.outline, P.floor, H.brickTop);
  polygon(o, 'trim', H.outline, H.brickTop, H.wallTop);
  componentEvidence.push('whole-single-storey-L-house-residence-and-EdwardRoad-consulting-wing');
  const V = H.roofEaves.map((p) => [p[0], H.wallTop, p[1]]),
    [A, B, C, D, E, F] = V,
    [r0, r1, r2] = H.roofRidges.map((p) => [p[0], H.roofTop, p[1]]),
    roofFaces = [
      [A, B, r0],
      [A, r0, r1, F],
      [B, C, r1, r0],
      [C, D, r2, r1],
      [F, E, r2, r1],
      [D, E, r2],
    ];
  for (const p of roofFaces) {
    face(o, 'roof', p, [0, 1, 0]);
    face(
      o,
      'roof',
      p.map((q) => [q[0], q[1] - 0.06, q[2]]),
      [0, -1, 0],
    );
  }
  if (lod) {
    for (let i = 0; i < V.length; i++)
      beam(o, 'trim', V[i], V[(i + 1) % V.length], 0.14, 0.16, colors.trim);
    for (const [a, b] of [
      [r0, r1],
      [r1, r2],
      [A, r0],
      [B, r0],
      [F, r1],
      [D, r2],
      [E, r2],
      [C, r1],
    ])
      beam(o, 'roof', a, b, 0.1, 0.09, colors.roof);
  }
  if (lod > 1) {
    const spacing = lod === 2 ? 1.4 : H.corrugationPitch;
    for (const p of roofFaces) {
      const n = normalFor(...p),
        axis = [n[2], 0, -n[0]],
        L = Math.hypot(...axis);
      if (L < 1e-8) continue;
      const U = axis.map((v) => v / L),
        d = (q) => q.reduce((s, v, i) => s + v * U[i], 0),
        lo = Math.min(...p.map(d)),
        hi = Math.max(...p.map(d));
      for (let u = lo + spacing * 0.5; u < hi; u += spacing) {
        const hits = [];
        for (let i = 0; i < p.length; i++) {
          const a = p[i],
            b = p[(i + 1) % p.length],
            da = d(a) - u,
            db = d(b) - u;
          if (da * db < 0) {
            const t = da / (da - db);
            hits.push(a.map((v, k) => v + t * (b[k] - v) + (k === 1 ? H.corrugationHeight : 0)));
          }
        }
        if (hits.length === 2 && Math.hypot(...hits[0].map((v, i) => v - hits[1][i])) > 0.1)
          beam(o, 'roof', hits[0], hits[1], 0.025, 0.025, colors.roof);
      }
    }
  }
  componentEvidence.push('complete-intersecting-hip-corrugated-tin-roof-all-six-slopes');
  polygon(o, 'foundation', rect(...P.stoep.x, ...P.stoep.z), P.stoep.foundationBottom, P.stoep.top);
  for (let i = 0; i < P.stoep.steps; i++) {
    const top = (P.floor * (i + 1)) / P.stoep.steps,
      z0 = P.stoep.z[1] + (P.stoep.steps - i - 1) * 0.3;
    polygon(o, 'foundation', rect(-1.8, 1.8, z0, z0 + 0.3), 0, top);
  }
  for (const x of H.frontBayCenters) bay(o, x, lod);
  componentEvidence.push('both-curved-front-bay-windows-with-brick-sills-and-plaster-cornices');
  const canopy = P.canopy,
    roofPoint = (x, z) => [
      x,
      canopy.innerY +
        ((z - canopy.innerZ) * (canopy.outerY - canopy.innerY)) / (canopy.outerZ - canopy.innerZ),
      z,
    ],
    cr = [
      roofPoint(canopy.x[0], canopy.innerZ),
      roofPoint(canopy.x[1], canopy.innerZ),
      roofPoint(canopy.x[1], canopy.outerZ),
      roofPoint(canopy.x[0], canopy.outerZ),
    ];
  face(o, 'roof', cr, [0, 1, 0]);
  face(
    o,
    'roof',
    cr.map((q) => [q[0], q[1] - 0.07, q[2]]),
    [0, -1, 0],
  );
  for (let i = 0; i < 4; i++) beam(o, 'trim', cr[i], cr[(i + 1) % 4], 0.12, 0.14, colors.trim);
  if (lod)
    for (let j = 0; j < canopy.brackets; j++) {
      const x = canopy.x[0] + 0.3 + (j * (canopy.x[1] - canopy.x[0] - 0.6)) / (canopy.brackets - 1);
      beam(
        o,
        'door',
        [x, canopy.innerY - 0.65, 4.05],
        roofPoint(x, 5.4).map((v, k) => v - (k === 1 ? 0.16 : 0)),
        0.075,
        0.08,
        colors.door,
      );
    }
  componentEvidence.push('whole-stoep-steps-and-separate-full-front-bracketed-lean-to-canopy');
  arch(o, lod);
  face(
    o,
    'door',
    [
      [-P.entrance.doorWidth / 2, P.floor, 4.025],
      [P.entrance.doorWidth / 2, P.floor, 4.025],
      [P.entrance.doorWidth / 2, P.floor + P.entrance.doorHeight, 4.025],
      [-P.entrance.doorWidth / 2, P.floor + P.entrance.doorHeight, 4.025],
    ],
    [0, 0, 1],
  );
  componentEvidence.push('arched-front-entrance-with-two-plain-columns');
  for (const x of [-10.2, -3.2, 3.2, 10.2]) window(o, [x + 0.65, 4], [x - 0.65, 4], lod);
  for (const x of [-8, 0, 5, 10]) window(o, [x - 0.7, -4], [x + 0.7, -4], lod);
  for (const z of [-11, -7, -1, 2]) window(o, [-12, z + 0.7], [-12, z - 0.7], lod);
  for (const z of [-11, -7]) window(o, [-4, z - 0.7], [-4, z + 0.7], lod);
  for (const z of [-1.8, 1.8]) window(o, [12, z - 0.7], [12, z + 0.7], lod);
  window(o, [-8.7, -14], [-7.3, -14], lod);
  componentEvidence.push(
    'all-exterior-residential-and-consulting-wing-facades-brick-lower-plaster-upper',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ke/ke7/dr_xuma_house',
  camera = [32, 22, 38],
  look = [0, 2, -3];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Dr Xuma House — Empilweni',
  wikidataId: 'Q20981521',
  cell: 'ke/ke7',
  category: 'historic-house',
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
  embeddedCanonicalGraphs: [
    'brick',
    'concrete_plain',
    'metal_painted',
    'plaster_lime',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-original-l-house-full-roof-front-bays-and-canopy',
      position: camera,
      lookAt: look,
    },
    {
      name: 'curved-bays-full-canopy-and-plain-column-arched-entry',
      position: [15, 5, 22],
      lookAt: [0, 2, 4],
    },
    {
      name: 'whole-rear-residence-and-edwardroad-consulting-wing-roofs',
      position: [-28, 20, -35],
      lookAt: look,
    },
    { name: 'whole-l-roof-and-all-wing-sections', position: [28, 35, -20], lookAt: [0, 2, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-empilweni-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural entire historic Empilweni dwelling under repository license. Official single-storey/brick/tinroof/twowings construction facts and explicitly transmitted FloBird1991 Lplan/bays/arch/canopy description. Original1991report not retrieved; no copied drawing/image/mesh/texture. Exact published housepoint and original native adjacent street axes only; no measured building footprint. Wholeplan dimensions/roof profile/vertical sections/detail/finish/grade are explicit bounded estimates. No detached2015centre or campusproxy, photographic/survey/current-world replacement claim.',
};
