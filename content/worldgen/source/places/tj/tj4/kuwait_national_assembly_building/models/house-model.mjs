/** Original Utzon Assembly: whole courtyard compound and all three canopy systems. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  normalFor,
  beam as rectangularBeam,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const F = P.baseFloorY,
  ref = 'palette:#ffffff';
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.25 },
  glass: {
    slot: 'window',
    localRef: 'palette:#3a4543',
    roughness: 0.3,
    metallic: 0.12,
    baseColorFactor: [1, 1, 1, 1],
    alphaMode: 'OPAQUE',
  },
};
const C = {
  concrete: rgb('e2ded2'),
  stone: rgb('c9beaa'),
  metal: rgb('797361'),
  glass: rgb('465450'),
};
export const partEvidence = [];
const beam = (o, k, _ref, a, b, width, color) => rectangularBeam(o, k, a, b, width, width, color);
function face(o, k, p, n) {
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], C[k]);
}
function box(o, k, a, b) {
  const [x, y, z] = a,
    [X, Y, Z] = b;
  for (const [p, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [X, y, Z],
        [x, y, Z],
        [x, Y, Z],
        [X, Y, Z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, y, Z],
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, y, z],
        [x, y, z],
      ],
      [0, -1, 0],
    ],
  ])
    face(o, k, p, n);
}
function column(o, x, z, h, lod, r = 1.35, neck = 0.85) {
  const n = [4, 6, 10, 16][lod],
    ys = lod < 2 ? [F, F + h] : [F, F + h * 0.15, F + h * 0.72, F + h],
    rs = lod < 2 ? [r, neck] : [r, r, neck, neck];
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n,
        b = (2 * Math.PI * (i + 1)) / n;
      face(
        o,
        'concrete',
        [
          [x + rs[j] * Math.cos(a), ys[j], z + rs[j] * Math.sin(a)],
          [x + rs[j] * Math.cos(b), ys[j], z + rs[j] * Math.sin(b)],
          [x + rs[j + 1] * Math.cos(b), ys[j + 1], z + rs[j + 1] * Math.sin(b)],
          [x + rs[j + 1] * Math.cos(a), ys[j + 1], z + rs[j + 1] * Math.sin(a)],
        ].reverse(),
      );
    }
  // Open neck is capped by the shell bearing; no opaque interior room substitute.
  if (lod > 1) {
    const q = Array.from({ length: n }, (_, i) => [
      x + neck * Math.cos((2 * Math.PI * i) / n),
      F + h,
      z + neck * Math.sin((2 * Math.PI * i) / n),
    ]);
    face(o, 'concrete', q, [0, 1, 0]);
  }
}
export const publicPoint = (s, t) => {
  const [a, b, c, d] = P.publicCanopy.corners;
  return [
    (a[0] * (1 - s) + b[0] * s) * (1 - t) + (d[0] * (1 - s) + c[0] * s) * t,
    (a[1] * (1 - s) + b[1] * s) * (1 - t) + (d[1] * (1 - s) + c[1] * s) * t,
  ];
};
export const publicRoofY = (s, t, bays = P.publicCanopy.bays) =>
  F +
  P.publicCanopy.frontHeight * (1 - t) +
  P.publicCanopy.rearHeight * t -
  P.publicCanopy.sag * Math.sin(Math.PI * t) +
  P.publicCanopy.fluteRise * Math.sin(Math.PI * (s * bays - Math.floor(s * bays)));
export const assemblyRoofY = (s, t, bays = P.assembly.bays) =>
  F +
  P.assembly.rearHeight * (1 - t) +
  P.assembly.frontHeight * t -
  P.assembly.sag * Math.sin(Math.PI * t) +
  P.assembly.fluteRise * Math.sin(Math.PI * (s * bays - Math.floor(s * bays)));
function shell(o, point, roof, nu, nv, thickness) {
  const at = (s, t, under = false) => {
    const [x, z] = point(s, t);
    return [x, roof(s, t) - (under ? thickness : 0), z];
  };
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const s = i / nu,
        S = (i + 1) / nu,
        t = j / nv,
        T = (j + 1) / nv,
        top = [at(s, t), at(S, t), at(S, T), at(s, T)];
      if (normalFor(...top)[1] < 0) top.reverse();
      face(o, 'concrete', top);
      face(o, 'concrete', top.map((p) => [p[0], p[1] - thickness, p[2]]).reverse());
    }
  for (let i = 0; i < nu; i++)
    for (const t of [0, 1]) {
      const s = i / nu,
        S = (i + 1) / nu;
      face(o, 'concrete', [at(s, t), at(s, t, true), at(S, t, true), at(S, t)]);
    }
  for (let j = 0; j < nv; j++)
    for (const s of [0, 1]) {
      const t = j / nv,
        T = (j + 1) / nv;
      face(o, 'concrete', [at(s, t), at(s, T), at(s, T, true), at(s, t, true)]);
    }
}
function publicHall(o, lod) {
  const B = P.publicCanopy,
    bays = lod === 0 ? 5 : B.bays,
    cross = [2, 2, 2, 3][lod],
    along = [2, 5, 10, 20][lod];
  shell(o, publicPoint, (s, t) => publicRoofY(s, t, bays), bays * cross, along, B.thickness);
  const count = [4, 12, 12, 12][lod];
  for (let i = 0; i < count; i++)
    for (const t of [0.035, 0.965]) {
      const s = 0.025 + (0.95 * i) / (count - 1),
        [x, z] = publicPoint(s, t);
      column(o, x, z, publicRoofY(s, t, bays) - F - B.thickness, lod, B.columnRadius, B.neckRadius);
    }
  const [a, b, c, d] = B.corners;
  // Intrinsic open hall floor follows the native canopy quadrilateral.
  face(
    o,
    'stone',
    [a, b, c, d].map(([x, z]) => [x, F, z]),
    [0, 1, 0],
  );
  partEvidence.push({
    part: 'public-canopy',
    nativeCorners: B.corners,
    bays,
    columns: count * 2,
    whole: true,
  });
}
function assembly(o, lod) {
  const A = P.assembly,
    bays = lod === 0 ? 5 : A.bays,
    point = (s, t) => [A.x0 + (A.x1 - A.x0) * t, A.z0 + (A.z1 - A.z0) * s];
  box(o, 'stone', [A.x0, P.foundationBase, A.z0], [A.x1, F, A.z1]);
  // Closed debating volume has an actual high shell; it is not an extra generic storey.
  box(o, 'concrete', [A.x0, F, A.z0], [A.x1, F + 8.5, A.z0 + 0.45]);
  box(o, 'concrete', [A.x0, F, A.z1 - 0.45], [A.x1, F + 8.5, A.z1]);
  box(o, 'concrete', [A.x0, F, A.z0], [A.x0 + 0.45, F + 10.5, A.z1]);
  shell(
    o,
    point,
    (s, t) => assemblyRoofY(s, t, bays),
    bays * [2, 2, 2, 3][lod],
    [2, 4, 8, 16][lod],
    A.thickness,
  );
  const count = [2, 6, 12, 12][lod];
  for (let i = 0; i < count; i++)
    for (const t of [0.025, 0.975]) {
      const s = 0.025 + (0.95 * i) / (count - 1),
        [x, z] = point(s, t);
      column(o, x, z, assemblyRoofY(s, t, bays) - F - A.thickness, lod, 1.15, 0.8);
    }
  if (lod > 0) {
    // Opaque recessed glazing, with concrete supports in front; no transparent box.
    face(
      o,
      'glass',
      [
        [A.x1 - 0.2, F + 1, A.z0 + 0.6],
        [A.x1 - 0.2, F + 1, A.z1 - 0.6],
        [A.x1 - 0.2, F + 17, A.z1 - 0.6],
        [A.x1 - 0.2, F + 17, A.z0 + 0.6],
      ],
      [1, 0, 0],
    );
    if (lod > 1)
      for (let z = A.z0 + 2; z < A.z1 - 1; z += 4)
        beam(o, 'metal', ref, [A.x1 - 0.1, F + 9, z], [A.x1 - 0.1, F + 16, z + 3.5], 0.13, C.metal);
  }
  partEvidence.push({
    part: 'assembly-hall',
    bounds: [A.x0, A.x1, A.z0, A.z1],
    bays,
    columns: count * 2,
    whole: true,
  });
}
function court(o, b, lod, index) {
  const [x, X, z, Z] = b,
    w = P.courtBand,
    h = F + P.officeHeight;
  for (const [a, c] of [
    [
      [x, F, z],
      [X, h, z + w],
    ],
    [
      [x, F, Z - w],
      [X, h, Z],
    ],
    [
      [x, F, z + w],
      [x + w, h, Z - w],
    ],
    [
      [X - w, F, z + w],
      [X, h, Z - w],
    ],
  ])
    box(o, 'concrete', a, c);
  box(o, 'stone', [x + w, F - 0.2, z + w], [X - w, F, Z - w]);
  // Real open-to-sky patio and inward facing two-level window bands.
  if (lod > 0)
    for (const y of [F + 1.6, F + 6.5]) {
      for (const [zz, n] of [
        [z + w + 0.025, [0, 0, 1]],
        [Z - w - 0.025, [0, 0, -1]],
      ])
        face(
          o,
          'glass',
          [
            [x + w + 0.8, y, zz],
            [X - w - 0.8, y, zz],
            [X - w - 0.8, y + 2.4, zz],
            [x + w + 0.8, y + 2.4, zz],
          ],
          n,
        );
      for (const [xx, n] of [
        [x + w + 0.025, [1, 0, 0]],
        [X - w - 0.025, [-1, 0, 0]],
      ])
        face(
          o,
          'glass',
          [
            [xx, y, z + w + 0.8],
            [xx, y, Z - w - 0.8],
            [xx, y + 2.4, Z - w - 0.8],
            [xx, y + 2.4, z + w + 0.8],
          ],
          n,
        );
      if (lod > 1) {
        for (let xx = x + w + 3; xx < X - w - 1; xx += 4)
          for (const zz of [z + w + 0.05, Z - w - 0.05])
            beam(o, 'metal', ref, [xx, y, zz], [xx, y + 2.4, zz], 0.12, C.metal);
      }
    }
  if (lod > 1) {
    for (const zz of [z + 0.4, Z - 0.4]) box(o, 'concrete', [x, h, zz], [X, h + 0.48, zz + 0.25]);
  }
  partEvidence.push({ part: `patio-${index}`, bounds: b, openSky: [x + w, X - w, z + w, Z - w] });
}
function mainStreet(o, lod) {
  const A = P.street,
    roof = (s, t) =>
      F +
      A.roofHeight +
      A.waveAmplitude * Math.cos(2 * Math.PI * t * A.bays) +
      0.7 * Math.sin(Math.PI * s),
    point = (s, t) => [A.x0 + (A.x1 - A.x0) * s, A.z0 + (A.z1 - A.z0) * t];
  shell(o, point, roof, [1, 2, 3, 4][lod], [4, 13, 26, 52][lod], 0.35);
  const count = [3, 7, 14, 27][lod];
  for (let i = 0; i < count; i++)
    for (const x of [A.x0 + 0.9, A.x1 - 0.9]) {
      const t = i / (count - 1),
        z = A.z0 + (A.z1 - A.z0) * t;
      column(o, x, z, roof(x === A.x0 + 0.9 ? 0.09 : 0.91, t) - F - 0.35, lod, 0.75, 0.5);
    }
  if (lod > 1) {
    for (let i = 0; i < A.bays; i++) {
      const z = A.z0 + ((i + 0.5) * (A.z1 - A.z0)) / A.bays;
      box(o, 'glass', [A.x0 + 1.7, F + 13.2, z - 0.45], [A.x1 - 1.7, F + 13.9, z + 0.45]);
    }
  }
  partEvidence.push({
    part: 'whole-covered-central-street',
    bounds: [A.x0, A.x1, A.z0, A.z1],
    columns: count * 2,
  });
}
function entrance(o, lod) {
  const A = P.street,
    z = A.z1 + 0.12;
  if (lod === 0) return;
  face(
    o,
    'glass',
    [
      [A.x0 + 0.8, F, z],
      [A.x1 - 0.8, F, z],
      [A.x1 - 0.8, F + 10.6, z],
      [A.x0 + 0.8, F + 10.6, z],
    ],
    [0, 0, 1],
  );
  for (const x of [A.x0 + 0.3, A.x1 - 0.9]) column(o, x, z + 0.7, 12, lod, 0.9, 0.65);
  for (const x of [A.x0 + 0.8, A.x1 - 0.8])
    beam(o, 'metal', ref, [x, F, z + 0.05], [x, F + 10.6, z + 0.05], 0.17, C.metal);
  if (lod > 1) {
    for (let y = F + 3.2; y < F + 10; y += 1.2) {
      const mid = (A.x0 + A.x1) / 2;
      beam(o, 'metal', ref, [A.x0 + 0.8, y, z + 0.07], [mid, y + 1, z + 0.07], 0.11, C.metal);
      beam(o, 'metal', ref, [mid, y + 1, z + 0.07], [A.x1 - 0.8, y, z + 0.07], 0.11, C.metal);
    }
    for (const x of [-17.8, -15, -12.2])
      beam(o, 'metal', ref, [x, F, z + 0.1], [x, F + 3.4, z + 0.1], 0.1, C.metal);
    beam(
      o,
      'metal',
      ref,
      [A.x0 + 0.8, F + 3.4, z + 0.1],
      [A.x1 - 0.8, F + 3.4, z + 0.1],
      0.13,
      C.metal,
    );
  }
}
export function buildHouse(o, _frame, lod = 3) {
  partEvidence.length = 0;
  const K = P.core;
  box(o, 'stone', [K.x0, P.foundationBase, K.z0], [K.x1, F, K.z1]);
  for (const [a, b] of [
    [
      [K.x0, F, K.z0],
      [K.x0 + 0.5, F + P.officeHeight, K.z1],
    ],
    [
      [K.x1 - 0.5, F, K.z0],
      [K.x1, F + P.officeHeight, K.z1],
    ],
    [
      [K.x0, F, K.z1 - 0.5],
      [P.street.x0, F + P.officeHeight, K.z1],
    ],
    [
      [P.street.x1, F, K.z1 - 0.5],
      [K.x1, F + P.officeHeight, K.z1],
    ],
  ])
    box(o, 'concrete', a, b);
  const A = P.conference;
  box(o, 'concrete', [A.x0, F, A.z0], [A.x1, F + A.height, A.z1]);
  if (lod > 1)
    for (let x = A.x0 + 5; x < A.x1 - 3; x += 8)
      box(o, 'glass', [x, F + A.height, A.z0 + 8], [x + 2, F + A.height + 0.8, A.z1 - 8]);
  P.courts.forEach((b, i) => {
    court(o, b, lod, i);
  });
  publicHall(o, lod);
  assembly(o, lod);
  mainStreet(o, lod);
  entrance(o, lod);
  partEvidence.push({
    part: 'whole-original-compound',
    bounds: K,
    excluded: 'Later curved southwest HOK extension; approximate boundary.',
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tj/tj4/kuwait_national_assembly_building',
  camera = [188, 126, -230],
  look = [0, 7, -15];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Kuwait National Assembly Building (2021)',
  wikidataId: 'Q15156679',
  cell: 'tj/tj4',
  category: 'civic',
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
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 2500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    { name: 'whole-original-assembly-canopies-and-patio-compound', position: camera, lookAt: look },
    {
      name: 'seaward-open-public-hall-shell-soffits-and-tapered-supports',
      position: [12, 10, -154],
      lookAt: [0, 12, -85],
    },
    {
      name: 'whole-original-courtyard-offices-and-chevron-entrance',
      position: [-176, 108, 192],
      lookAt: [0, 7, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-assembly-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Exact RonPrzysucha2021 StateDepartment staff entrance original/PD-USGov-DOS/official statephotos account/native release and original SHA1 bound in reference records; only entrance concrete/glazing/stone detail adopted. Primary Pritzker architectural essay and Muslimin2020 original structural research used as TEXT facts only; no protected photographs or diagrams adopted. OSM numerical merged institution envelope under ODbL, with approximate original-core/extension split explicitly recorded. Public Terrarium source bytes frozen before all main parameters. Hidden partition/heights/census/curves/grade/registration estimated. No copied artwork, emblems, people, props, phototextures or generated bitmap.',
};
