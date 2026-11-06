/** Whole1870cathedral, complete native envelope and original genuinely open square belfry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.58, metallic: 0.05 },
};
const C = {
  plaster: rgb('ded8c7'),
  roof: rgb('785e49'),
  stone: rgb('b4aa96'),
  trim: rgb('d2c7b1'),
  wood: rgb('655744'),
  glass: rgb('4d6178'),
};
const R = P.nativeChurchRing,
  H = P.church,
  T = P.tower,
  x0 = Math.min(...R.map((p) => p[0])),
  x1 = Math.max(...R.map((p) => p[0]));
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
  cap(o, k, ring, lo, -1);
  cap(o, k, ring, hi);
}
const rect = (cx, cz, w, d) => [
  [cx - w / 2, cz - d / 2],
  [cx + w / 2, cz - d / 2],
  [cx + w / 2, cz + d / 2],
  [cx - w / 2, cz + d / 2],
];
const box = (o, k, cx, cz, w, d, lo, hi) => solid(o, k, rect(cx, cz, w, d), lo, hi);
function clip(r, z, side) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      aa = side * (a[1] - z) >= 0,
      bb = side * (b[1] - z) >= 0;
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, z]);
    }
  }
  return out;
}
function boundary(x, side) {
  let z = side > 0 ? -Infinity : Infinity;
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    if (
      x >= Math.min(a[0], b[0]) - 1e-5 &&
      x <= Math.max(a[0], b[0]) + 1e-5 &&
      Math.abs(b[0] - a[0]) > 1e-6
    ) {
      const q = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      z = side > 0 ? Math.max(z, q) : Math.min(z, q);
    }
  }
  return z;
}
function aisleRoofHeight(x, z, side) {
  const edge = boundary(x, side),
    inner = side * H.naveHalfWidth;
  return H.aisleWall + ((H.aisleInnerRoof - H.aisleWall) * (z - edge)) / (inner - edge);
}
function envelope(o) {
  solid(o, 'stone', R, H.foundationBottom, P.floor);
  solid(o, 'plaster', R, P.floor, H.aisleWall);
  for (const side of [-1, 1]) {
    const r = clip(R, side * H.naveHalfWidth, side);
    cap(o, 'roof', r, (x, z) => aisleRoofHeight(x, z, side));
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        o,
        'plaster',
        [
          [a[0], H.aisleWall, a[1]],
          [b[0], H.aisleWall, b[1]],
          [b[0], aisleRoofHeight(...b, side), b[1]],
          [a[0], aisleRoofHeight(...a, side), a[1]],
        ],
        undefined,
      );
    }
  }
  box(o, 'plaster', (x0 + x1) / 2, 0, x1 - x0, 2 * H.naveHalfWidth, H.aisleWall, H.naveEaves);
  for (const x of [x0, x1])
    face(
      o,
      'plaster',
      [
        [x, H.naveEaves, -H.naveHalfWidth],
        [x, H.naveEaves, H.naveHalfWidth],
        [x, H.naveRidge, 0],
      ],
      [x === x0 ? -1 : 1, 0, 0],
    );
  for (const side of [-1, 1])
    face(
      o,
      'roof',
      [
        [x0, H.naveEaves, side * H.naveHalfWidth],
        [x1, H.naveEaves, side * H.naveHalfWidth],
        [x1, H.naveRidge, 0],
        [x0, H.naveRidge, 0],
      ],
      [0, 1, side],
    );
  componentEvidence.push({
    kind: 'whole-native-six-control-church',
    controls: R.length,
    fullNave: true,
    bothCompleteAisles: true,
    allFacades: true,
    fullRoof: true,
  });
}
function wallPanel(o, B, poly) {
  const p = (a, t) => [
      B.center[0] + B.U[0] * a[0] + B.N[0] * t,
      a[1],
      B.center[1] + B.U[1] * a[0] + B.N[1] * t,
    ],
    front = poly.map((a) => p(a, 0)),
    back = poly.map((a) => p(a, -0.55));
  face(o, 'plaster', front, [B.N[0], 0, B.N[1]]);
  face(o, 'plaster', back, [-B.N[0], 0, -B.N[1]]);
  const center = [0, 1, 2].map(
    (k) => [...front, ...back].reduce((s, p) => s + p[k], 0) / (2 * poly.length),
  );
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length,
      q = [front[i], front[j], back[j], back[i]],
      n = [0, 1, 2].map((k) => q.reduce((s, p) => s + p[k], 0) / 4 - center[k]);
    face(o, 'plaster', q, n);
  }
}
const panelRect = (o, B, a, b, y0, y1) =>
  wallPanel(o, B, [
    [a, y0],
    [b, y0],
    [b, y1],
    [a, y1],
  ]);
function belfryStage(o, y, h, width, count, lod) {
  const rr = rect(...T.center, width, width),
    N = [2, 5, 8, 12][lod],
    openWidth = count === 2 ? 1.55 : 2.35,
    bottom = y + 0.65,
    spring = y + (count === 2 ? 3.25 : 3.75),
    centers = count === 2 ? [-1.8, 1.8] : [0];
  for (let side = 0; side < 4; side++) {
    const a = rr[side],
      b = rr[(side + 1) % 4],
      U = [(b[0] - a[0]) / width, (b[1] - a[1]) / width],
      B = { center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], U, N: [U[1], -U[0]] };
    let last = -width / 2;
    for (const c of centers) {
      const left = c - openWidth / 2,
        right = c + openWidth / 2;
      panelRect(o, B, last, left, y, y + h);
      panelRect(o, B, left, right, y, bottom);
      for (let j = 0; j < N; j++) {
        const aa = Math.PI - (j * Math.PI) / N,
          bb = Math.PI - ((j + 1) * Math.PI) / N,
          ua = c + (openWidth / 2) * Math.cos(aa),
          ub = c + (openWidth / 2) * Math.cos(bb),
          ya = spring + (openWidth / 2) * Math.sin(aa),
          yb = spring + (openWidth / 2) * Math.sin(bb);
        wallPanel(o, B, [
          [ua, ya],
          [ub, yb],
          [ub, y + h],
          [ua, y + h],
        ]);
      }
      // The adjoining solid pier panels already supply the opening's vertical reveals.
      last = right;
    }
    panelRect(o, B, last, width / 2, y, y + h);
  }
}
function tower(o, lod) {
  box(o, 'plaster', ...T.center, T.width, T.width, P.floor, T.lowerFloor);
  belfryStage(o, T.lowerFloor, T.lowerHeight, T.width, 2, lod);
  belfryStage(o, T.upperFloor, T.upperHeight, T.width - 0.35, 1, lod);
  for (const y of lod === 0
    ? [T.lowerFloor + T.lowerHeight, T.upperFloor + T.upperHeight]
    : [T.lowerFloor, T.lowerFloor + T.lowerHeight, T.upperFloor, T.upperFloor + T.upperHeight])
    box(o, 'trim', ...T.center, T.width + 0.3, T.width + 0.3, y - 0.12, y + 0.12);
  box(o, 'trim', ...T.center, T.width + 0.3, T.width + 0.3, T.roof - 0.3, T.roof);
  for (const side of [-1, 1]) {
    box(
      o,
      'trim',
      T.center[0] + (side * T.width) / 2,
      T.center[1],
      0.2,
      T.width,
      T.balustradeTop - 0.18,
      T.balustradeTop,
    );
    box(
      o,
      'trim',
      T.center[0],
      T.center[1] + (side * T.width) / 2,
      T.width,
      0.2,
      T.balustradeTop - 0.18,
      T.balustradeTop,
    );
  }
  if (lod === 0) {
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        box(
          o,
          'trim',
          T.center[0] + (a * T.width) / 2,
          T.center[1] + (b * T.width) / 2,
          0.16,
          0.16,
          T.roof,
          T.balustradeTop,
        );
    componentEvidence.push({
      kind: 'whole-original-square-flat-topped-tower',
      openBelfryStages: 2,
      lowerOpeningsPerFace: 2,
      upperOpeningsPerFace: 1,
      allFourFaces: true,
      top: T.balustradeTop,
    });
    return;
  }
  const posts = [0, 4, 9, 13][lod];
  for (const side of [-1, 1])
    for (let j = 0; j <= posts; j++) {
      const u = -T.width / 2 + (T.width * j) / posts;
      box(
        o,
        'trim',
        T.center[0] + u,
        T.center[1] + (side * T.width) / 2,
        0.16,
        0.16,
        T.roof,
        T.balustradeTop,
      );
      box(
        o,
        'trim',
        T.center[0] + (side * T.width) / 2,
        T.center[1] + u,
        0.16,
        0.16,
        T.roof,
        T.balustradeTop,
      );
    }
  componentEvidence.push({
    kind: 'whole-original-square-flat-topped-tower',
    openBelfryStages: 2,
    lowerOpeningsPerFace: 2,
    upperOpeningsPerFace: 1,
    allFourFaces: true,
    top: T.balustradeTop,
  });
}
function archPatch(o, k, B, cx, bottom, width, spring, lod, tint) {
  const q = [
      [cx - width / 2, bottom],
      [cx + width / 2, bottom],
      [cx + width / 2, spring],
    ],
    n = [2, 5, 8, 12][lod];
  for (let j = 1; j <= n; j++) {
    const a = (j * Math.PI) / n;
    q.push([cx + (width / 2) * Math.cos(a), spring + (width / 2) * Math.sin(a)]);
  }
  face(
    o,
    k,
    q.map(([u, y]) => [B.center[0] + B.U[0] * u, y, B.center[1] + B.U[1] * u]),
    [B.N[0], 0, B.N[1]],
    tint,
  );
}
function facadeDetails(o, lod) {
  for (const side of [-1, 1]) {
    const B = { center: [0, side * (H.naveHalfWidth + 0.025)], U: [1, 0], N: [0, side] };
    for (let i = 0; i < H.clerestoryBays; i++) {
      const x = -21 + i * 7.35;
      archPatch(o, 'glass', B, x, 15.0, 1.4, 16.0, lod);
      if (lod > 0) box(o, 'trim', x, side * (H.naveHalfWidth + 0.08), 1.7, 0.18, 14.85, 15.0);
    }
    const wall = side > 0 ? 12.67 : -13.25;
    for (let i = 0; i < 7; i++) {
      const x = -19 + i * 7.0;
      for (const y of lod === 0 ? [5.5] : [2.3, 5.6]) {
        face(
          o,
          'wood',
          [
            [x - 0.55, y, wall],
            [x + 0.55, y, wall],
            [x + 0.55, y + 1.65, wall],
            [x - 0.55, y + 1.65, wall],
          ],
          [0, 0, side],
          rgb('454842'),
        );
        if (lod > 1)
          for (let j = 0; j < 4; j++)
            box(o, 'trim', x - 0.5 + j / 3, wall + side * 0.08, 0.045, 0.06, y, y + 1.65);
      }
    }
    if (lod > 0) {
      box(o, 'trim', 0, wall, x1 - x0 - 0.3, 0.22, H.aisleWall - 0.3, H.aisleWall - 0.13);
      box(
        o,
        'trim',
        0,
        side * (H.naveHalfWidth + 0.07),
        x1 - x0,
        0.16,
        H.naveEaves - 0.25,
        H.naveEaves - 0.08,
      );
    }
  }
  // Both photographed south-side Renaissance surrounds; complete unseen west-front doors estimated.
  const B = { center: [0, 12.7], U: [1, 0], N: [0, 1] };
  for (const x of [-27, 21]) {
    archPatch(o, 'trim', { ...B, center: [0, 12.76] }, x, P.floor, 4.0, 4.6, lod);
    archPatch(o, 'wood', { ...B, center: [0, 12.79] }, x, P.floor, 2.65, 4.0, lod);
    if (lod > 0) {
      for (const side of [-1, 1]) box(o, 'trim', x + side * 2.15, 12.83, 0.4, 0.5, P.floor, 6.1);
      box(o, 'trim', x, 12.84, 5.2, 0.6, 6.1, 6.4);
      face(
        o,
        'trim',
        [
          [x - 2.5, 6.4, 13.12],
          [x + 2.5, 6.4, 13.12],
          [x, 7.8, 13.12],
        ],
        [0, 0, 1],
      );
    }
  }
  for (const z of [-9, 0, 9]) {
    const B = { center: [x0 - 0.04, z], U: [0, 1], N: [-1, 0] };
    archPatch(o, 'trim', B, 0, P.floor, 3.3, 4.4, lod);
    archPatch(o, 'wood', { ...B, center: [x0 - 0.07, z] }, 0, P.floor, 2.5, 4.0, lod);
  }
  if (lod > 0)
    for (const side of [-1, 1]) box(o, 'trim', x0 - 0.1, side * 5.9, 0.38, 0.55, P.floor, 15.3);
  componentEvidence.push({
    kind: 'whole-church-fenestration-and-doors',
    clerestoryBaysPerSide: 7,
    bothSideAisles: true,
    twoPhotographedSouthDoorPositions: true,
    unseenFacadesEstimated: true,
  });
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  envelope(o);
  tower(o, lod);
  facadeDetails(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/d3/d3f/cartagena_cathedral_colombia',
  camera = [-93, 62, 98],
  look = [0, 13, 0];
export const houseModel = {
  id: 'cartagena_cathedral_colombia',
  key: 'cartagena_cathedral_colombia',
  cell: 'd3/d3f',
  title: 'Cartagena Cathedral, Colombia — whole1870church and original bell tower',
  wikidataId: 'Q5047033',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole historical1870cathedral: complete original native footprint/allfacades, raised gabled nave and clerestory, both full aisle roofs, rear sanctuary envelope, two south entrances and original genuinely open square two-stage flat-topped belfry. Exact owning-museumPDJohnMoran1870photo and original numerical plan; unseen heights/details/palette/grade estimated. No later domed tower or nearby church substitute.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: H.foundationBottom - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 1800,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'clay_fired',
    'stone_basalt_raw',
    'stone_ashlar',
    'wood_plain',
    'window_punched',
  ],
  qaCameras: [
    {
      name: 'whole-1870-cathedral-nave-both-aisles-and-original-tower',
      position: camera,
      lookAt: look,
    },
    {
      name: 'moran1870-south-street-profile-two-doors-and-clerestory',
      position: [-48, 23, 72],
      lookAt: [0, 14, 0],
    },
    {
      name: 'whole-north-aisle-east-sanctuary-and-rear-roofs',
      position: [80, 49, -75],
      lookAt: [0, 13, 0],
    },
    {
      name: 'genuine-two-stage-open-square-belfry-original-flat-top',
      position: [-55, 33, -42],
      lookAt: [-27, 23, -9],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cathedral-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural entire1870cathedral under repository license, exact JohnMoran1870museum stereograph explicitly Publicdomain with named creator1831-1902. Numeric original OpenStreetMap church plan ODbL. Shared canonical procedural textures, no source photograph baked into materials. Hidden forms/heights/palette/grade estimated; no later tower/neighbor proxy, current replacement or survey claim.',
};
