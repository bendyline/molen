/** Whole original Imperial Observatory office and intrinsic crenellated granite tower. */
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
  T = P.tower,
  B = P.basis;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.58, metallic: 0.18 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
};
const colors = {
  wall: rgb('aaa596'),
  foundation: rgb('8f8b80'),
  roof: rgb('96684d'),
  trim: rgb('c4baa3'),
  window: rgb('405967'),
  door: rgb('4c4032'),
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
function strip(o, k, a, b, w, y0, y1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [-dz / l, dx / l],
    r = [
      [a[0] - (n[0] * w) / 2, a[1] - (n[1] * w) / 2],
      [b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2],
      [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2],
      [a[0] + (n[0] * w) / 2, a[1] + (n[1] * w) / 2],
    ];
  polygon(o, k, r, y0, y1);
}
function window(o, a, b, t, y, w, h, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    U = [dx / L, dz / L],
    N = [U[1], -U[0]],
    c = a.map((v, k) => v + (b[k] - v) * t),
    p = (u, Y, d = 0.035) => [c[0] + U[0] * u + N[0] * d, Y, c[1] + U[1] * u + N[1] * d];
  face(
    o,
    'window',
    [p(-w / 2, y), p(w / 2, y), p(w / 2, y + h), p(-w / 2, y + h)],
    [N[0], 0, N[1]],
  );
  if (!lod) return;
  for (const u of [-w / 2, w / 2])
    beam(o, 'trim', p(u, y, 0.09), p(u, y + h, 0.09), 0.13, 0.14, colors.trim);
  for (const Y of [y, y + h])
    beam(o, 'trim', p(-w / 2 - 0.09, Y, 0.12), p(w / 2 + 0.09, Y, 0.12), 0.16, 0.2, colors.trim);
  if (lod > 1) {
    beam(o, 'door', p(0, y, 0.075), p(0, y + h, 0.075), 0.055, 0.065, colors.door);
    beam(
      o,
      'door',
      p(-w / 2, y + h * 0.62, 0.08),
      p(w / 2, y + h * 0.62, 0.08),
      0.05,
      0.06,
      colors.door,
    );
  }
}
function entrance(o, lod) {
  const x = B.cx,
    z = B.z1 + 0.055,
    y = P.floor,
    spring = y + 2.1,
    r = 1,
    n = [6, 10, 16, 24][lod],
    q = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, spring, z],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i * Math.PI) / n;
    q.push([x + r * Math.cos(t), spring + r * Math.sin(t), z]);
  }
  face(o, 'door', q, [0, 0, 1]);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      at = (R, t) => [x + R * Math.cos(t), spring + R * Math.sin(t), z + 0.05];
    face(o, 'trim', [at(r, a), at(r + 0.25, a), at(r + 0.25, b), at(r, b)], [0, 0, 1]);
  }
  for (const side of [-1, 1])
    polygon(
      o,
      'trim',
      rect(x + side * (r + 0.125) - 0.125, x + side * (r + 0.125) + 0.125, z - 0.03, z + 0.2),
      y,
      spring,
    );
  for (let i = 0; i < 3; i++)
    polygon(
      o,
      'foundation',
      rect(x - 1.6, x + 1.6, z + 0.15 + i * 0.3, z + 0.45 + i * 0.3),
      0,
      (P.floor * (3 - i)) / 3,
    );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', P.nativeBuildingRing, H.basementBottom, P.floor);
  polygon(o, 'wall', P.nativeBuildingRing, P.floor, H.wallTop);
  componentEvidence.push(
    'whole-original-four-control-three-storey-granite-office-and-basement-exterior',
  );
  const center = [B.cx, B.cz],
    e = P.nativeBuildingRing.map((p) => {
      const dx = p[0] - center[0],
        dz = p[1] - center[1],
        l = Math.hypot(dx, dz);
      return [p[0] + (dx / l) * H.eaves, H.wallTop, p[1] + (dz / l) * H.eaves];
    }),
    [A, C, D, E] = e,
    [r0, r1] = H.roofRidges.map((p) => [p[0], H.roofTop, p[1]]),
    faces = [
      [A, C, r1, r0],
      [E, D, r1, r0],
      [A, E, r0],
      [C, D, r1],
    ];
  for (const p of faces) {
    face(o, 'roof', p, [0, 1, 0]);
    face(
      o,
      'roof',
      p.map((q) => [q[0], q[1] - 0.07, q[2]]),
      [0, -1, 0],
    );
  }
  if (lod) {
    for (let i = 0; i < e.length; i++)
      beam(o, 'trim', e[i], e[(i + 1) % e.length], 0.16, 0.15, colors.trim);
    for (const [a, b] of [
      [r0, r1],
      [A, r0],
      [E, r0],
      [C, r1],
      [D, r1],
    ])
      beam(o, 'roof', a, b, 0.13, 0.1, colors.roof);
  }
  componentEvidence.push('complete-pitched-beaver-tail-tile-roof-all-four-hip-slopes');
  polygon(o, 'wall', T.ring, P.floor, T.deck);
  polygon(o, 'roof', T.ring, T.deck - 0.1, T.deck);
  for (let i = 0; i < T.ring.length; i++) {
    const a = T.ring[i],
      b = T.ring[(i + 1) % T.ring.length],
      d = b.map((v, k) => v - a[k]);
    strip(o, 'wall', a, b, T.parapetThickness, T.deck, T.parapetTop);
    for (let j = 0; j < T.merlonsPerSide; j++) {
      const t0 = j / T.merlonsPerSide,
        t1 = (j + 0.56) / T.merlonsPerSide;
      strip(
        o,
        'wall',
        a.map((v, k) => v + d[k] * t0),
        a.map((v, k) => v + d[k] * t1),
        T.parapetThickness + 0.06,
        T.parapetTop,
        T.merlonTop,
      );
    }
    if (lod)
      beam(
        o,
        'trim',
        [a[0], T.deck - 0.17, a[1]],
        [b[0], T.deck - 0.17, b[1]],
        0.28,
        0.22,
        colors.trim,
      );
  }
  componentEvidence.push('whole-intrinsic-seven-level-granite-tower-and-closed-roof-deck');
  componentEvidence.push('all-four-sides-of-continuous-parapet-and-crenellated-castle-crown');
  for (let edge = 0; edge < 4; edge++) {
    const a = P.nativeBuildingRing[edge],
      b = P.nativeBuildingRing[(edge + 1) % 4],
      count = edge % 2 === 0 ? 5 : 2;
    for (let storey = 0; storey < H.storeys; storey++)
      for (let i = 0; i < count; i++) {
        if (edge === 2 && storey === 0 && i === 2) continue;
        const t = (i + 0.5) / count,
          center = a.map((v, k) => v + t * (b[k] - v));
        if (
          (edge === 0 || edge === 3) &&
          center[0] < Math.max(...T.ring.map((p) => p[0])) + 0.75 &&
          center[1] < Math.max(...T.ring.map((p) => p[1])) + 0.75
        )
          continue;
        window(o, a, b, (i + 0.5) / count, P.floor + storey * H.storeyHeight + 1, 1.25, 1.7, lod);
      }
  }
  for (let edge = 0; edge < T.ring.length; edge++)
    for (let storey = 0; storey < T.storeys; storey++)
      window(
        o,
        T.ring[edge],
        T.ring[(edge + 1) % T.ring.length],
        0.5,
        P.floor + 0.8 + storey * 2.95,
        0.65,
        1.25,
        lod,
      );
  if (lod > 1) {
    for (let i = 1; i < H.storeys; i++) {
      const y = P.floor + i * H.storeyHeight;
      for (let j = 0; j < 4; j++) {
        const a = P.nativeBuildingRing[j],
          b = P.nativeBuildingRing[(j + 1) % 4];
        beam(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.075, 0.085, colors.trim);
      }
    }
  }
  componentEvidence.push('all-office-and-tower-exterior-facades-with-estimated-opening-census');
  entrance(o, lod);
  componentEvidence.push('complete-front-arched-granite-entrance-closed-door-and-intrinsic-steps');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ww/wwm/qingdao_observatory',
  camera = [42, 30, 38],
  look = [1, 9, -5];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Qingdao Imperial Observatory — original office and tower',
  wikidataId: 'Q24833163',
  cell: 'ww/wwm',
  category: 'observatory',
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
    'stone_granite',
    'tile_flat',
    'stone_ashlar',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-original-granite-office-full-tile-roof-and-crenellated-tower',
      position: camera,
      lookAt: look,
    },
    {
      name: 'complete-three-storey-office-facade-and-arched-entrance',
      position: [30, 12, 28],
      lookAt: [0, 6, -2],
    },
    {
      name: 'entire-granite-tower-and-all-four-crenellated-crown-sides',
      position: [-29, 29, -34],
      lookAt: [-7, 15, -9],
    },
    { name: 'all-hip-roof-slopes-and-complete-office-rear', position: [30, 35, -32], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-qingdao-office-${reviewLod}`,
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
    'Original procedural complete ImperialObservatoryoffice and intrinsicgranitecrenellatedtower under repository license. Municipalwritten1910-1912/threeaboveground/basement/roughgranite/pitchedbeaver-tailtile/crenellated21.6mtower facts only; directoriginaltimeout/webredirectloop disclosed, no originalHTMLbyteclaim. IndependentoriginalnumericProtomaps/OSMderived wholeoffice footprint/pairednamedPOI bound toQ24833163, quantizedmap notnodesurvey. Exacttowercorner/plan/roof/sections/details/finish/grade boundedestimates. No copied image/drawing/mesh/texture/poetry, independentastronomydome/directorhouse/campus proxy, photographic/survey/currentreplacement claim.',
};
