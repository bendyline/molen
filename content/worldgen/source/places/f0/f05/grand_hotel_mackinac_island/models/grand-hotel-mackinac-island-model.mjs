import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, verandah, main } = plan.dimensions;
const white = rgb('e4e1cc');
const bright = rgb('e9e5d3');
const railColor = rgb('ece7d4');
const shingle = rgb('4e655b');
const plinth = rgb('9c9b84');
const floorColor = rgb('8f8a72');
const window = rgb('526365');
const stripe = rgb('c9a34b');
const mullion = rgb('d7d7c1');
const surfaces = {
  siding: { slot: 'wall', graph: 'siding_lap', roughness: 0.9 },
  roofing: { slot: 'roof', graph: 'tile_flat', roughness: 0.87 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.86 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
  fabric: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.95 },
};
const box = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
function hip(out, rect, ridge, low, top, slot = 'roofing', color = shingle) {
  const [a, b, c, d] = rect.map(([x, z]) => [x, low, z]);
  const [p, q] = ridge.map(([x, z]) => [x, top, z]);
  for (const face of [
    [b, a, p],
    [b, p, q],
    [c, b, q],
    [d, c, q],
    [d, q, p],
    [a, d, p],
  ])
    tri(out, slot, ...face, color);
}
function sash(out, F, u, y, w, h, lod) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: window,
    frame: mullion,
    frameWidth: lod === 3 ? 0.07 : 0,
    frameDepth: 0.085,
    d: 0.035,
    sill: lod === 3,
    mullions: lod > 1 ? 1 : 0,
    transoms: lod === 3 ? 1 : 0,
  });
}
function cornice(out, F, lo, hi, y, depth) {
  fbox(out, 'trim', F, lo, hi, y, y + 0.21, -0.12, depth, bright);
}
function pavilion(out, range, lod) {
  const { x, z, w, d, ledge, crest } = range;
  box(out, 'siding', x - w / 2, x + w / 2, z - d / 2, z + d / 2, range.base, ledge, white);
  const faces = [
    [facade([x, z + d / 2], [1, 0]), w],
    [facade([x + w / 2, z], [0, -1]), d],
    [facade([x, z - d / 2], [-1, 0]), w],
    [facade([x - w / 2, z], [0, 1]), d],
  ];
  for (const [F, len] of faces) {
    if (lod > 0) cornice(out, F, -len / 2, len / 2, ledge - 0.07, 0.16);
    if (lod > 0) {
      const n = Math.max(1, Math.round(len / (range.base > 17 ? 3.0 : 4.4)));
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * len) / n - len / 2;
        for (let y = range.base + 1.24; y + 1.57 < ledge - 0.16; y += 3.0)
          sash(out, F, u, y, Math.min(1.37, len / (n + 1)), 1.65, lod);
      }
    }
  }
  const loX = x - w / 2 - 0.29,
    hiX = x + w / 2 + 0.29,
    loZ = z - d / 2 - 0.32,
    hiZ = z + d / 2 + 0.32;
  const long = Math.max(0.1, (w - d) * 0.41);
  hip(
    out,
    [
      [loX, loZ],
      [hiX, loZ],
      [hiX, hiZ],
      [loX, hiZ],
    ],
    [
      [x - long, z],
      [x + long, z],
    ],
    ledge,
    crest,
  );
}
const rearWings = [
  { x: -72.24, z: -19.48, w: 29.0, d: 24.0, base: 0.51, ledge: 13.51, crest: 17.36 },
  { x: -61.9, z: -29.05, w: 18.1, d: 17.3, base: 1.68, ledge: 11.74, crest: 15.71 },
  { x: 7.21, z: -14.88, w: 26.0, d: 13.2, base: 1.14, ledge: 15.69, crest: 18.87 },
  { x: 49.93, z: -15.97, w: 21.2, d: 14.45, base: 0.94, ledge: 14.32, crest: 18.31 },
  { x: 63.88, z: 20.12, w: 15.3, d: 19.45, base: 0.65, ledge: 15.6, crest: 19.86 },
];
function hotelBody(out, lod) {
  const p = main;
  const ring = frame.geometry.outline;
  extrude(out, 'concrete', ring, foundation, floor, plinth, { top: false });
  // A single main roof keeps the continuous slope visible from the Straits.
  box(out, 'siding', p.west, p.east, p.rear, p.front, floor, p.eave, white);
  const front = facade([0, p.front], [1, 0]);
  cornice(out, front, p.west, p.east, 14.34, 0.32);
  cornice(out, front, p.west, p.east, 18.55, 0.36);
  const rect = [
    [p.west - 0.35, p.rear - 0.19],
    [p.east + 0.32, p.rear - 0.19],
    [p.east + 0.32, p.front + 0.36],
    [p.west - 0.35, p.front + 0.36],
  ];
  hip(
    out,
    rect,
    [
      [p.west + 8.9, 2.41],
      [p.east - 8.95, 2.41],
    ],
    p.eave,
    p.ridge,
  );
  const w = verandah;
  for (let i = 0; i < w.bays; i++) {
    const u = w.west + ((i + 0.5) * (w.east - w.west)) / w.bays;
    if (lod === 0 && i % 2) continue;
    const tiers = lod < 2 ? [1.61, 6.26, 15.61] : [1.62, 5.23, 8.64, 11.46, 15.62];
    for (const y of tiers)
      sash(out, front, u, y, y === 1.62 ? 1.76 : 1.39, y > 15 ? 1.52 : 1.9, lod);
  }
  if (lod > 0) {
    const back = facade([0, p.rear], [-1, 0]);
    const count = lod === 1 ? 33 : 44;
    cornice(out, back, -p.east, -p.west, p.eave - 0.23, 0.22);
    for (let i = 0; i < count; i++) {
      const u = -p.east + ((i + 0.5) * (p.east - p.west)) / count;
      for (const y of lod === 1 ? [10.1, 15.2] : [4.2, 7.1, 10.1, 13.05, 15.7])
        sash(out, back, u, y, 1.22, 1.71, lod === 2 ? 1 : lod);
    }
  }
  for (const wing of rearWings) pavilion(out, wing, lod);
  for (const [x, crest] of [
    [-31.5, 26.06],
    [-7.3, 27.3],
    [19.2, 26.51],
  ]) {
    pavilion(out, { x, z: 14.3, w: 11.2, d: 12.1, base: 17.9, ledge: 22.34, crest }, lod);
  }
  pavilion(
    out,
    { x: -7.3, z: 6.6, w: 13.75, d: 14.65, base: 22.0, ledge: 27.65, crest: 31.17 },
    lod,
  );
}
function column(out, x, z, low, high, lod, r) {
  const n = lod === 0 ? 5 : lod === 1 ? 7 : lod === 2 ? 10 : 14;
  const points = (y, rr) => radialRing(y, rr, rr, n, [x, z], Math.PI / 4);
  if (lod < 2) {
    loft(out, 'trim', [points(low, r), points(high, r * 0.75)], railColor, { cap: false });
    return;
  }
  const ringSpecs = [
    [low, r * 1.15],
    [low + 0.24, r * 1.12],
    [low + 0.28, r],
    [high - 0.22, r * 0.71],
    [high - 0.13, r * 0.89],
    [high, r * 0.97],
  ];
  loft(
    out,
    'trim',
    ringSpecs
      .filter((_, index) => lod === 3 || (index !== 1 && index !== 3))
      .map(([y, r]) => points(y, r)),
    railColor,
    { cap: false },
  );
}
function awning(out, a, b, z, lod) {
  const count = lod > 1 ? 7 : 3;
  const width = (b - a) / count;
  for (let i = 0; i < count; i++) {
    const left = a + i * width,
      right = left + width;
    const fabric = i % 2 === 0 ? stripe : bright;
    quad4(
      out,
      'fabric',
      [left, 3.18, z + 0.13],
      [right, 3.18, z + 0.13],
      [right, 3.97, z - 1.67],
      [left, 3.97, z - 1.67],
      fabric,
    );
    if (lod > 1)
      quad4(
        out,
        'fabric',
        [left, 3.01, z + 0.13],
        [right, 3.01, z + 0.13],
        [right, 3.18, z + 0.13],
        [left, 3.18, z + 0.13],
        fabric,
      );
  }
}
function handrail(out, F, u, v, y, lod) {
  fbox(out, 'trim', F, u, v, y, y + 0.1, -0.17, 0.1, railColor);
  fbox(out, 'trim', F, u, v, y + 0.68, y + 0.8, -0.16, 0.095, railColor);
  if (lod > 1) {
    for (const [a, b] of [
      [u, v],
      [v, u],
    ])
      beam(
        out,
        'trim',
        F.P(a + 0.1 * (b - a), y + 0.15, -0.025),
        F.P(a + 0.9 * (b - a), y + 0.68, -0.025),
        0.056,
        0.06,
        railColor,
      );
  }
}
function porch(out, lod) {
  const w = verandah;
  box(out, 'concrete', w.west, w.east, w.back, w.front, foundation, w.lowerDeck, plinth);
  box(
    out,
    'trim',
    w.west,
    w.east,
    w.back,
    w.front + 0.07,
    w.porchDeck - 0.27,
    w.porchDeck,
    floorColor,
  );
  box(
    out,
    'trim',
    w.west - 0.25,
    w.east + 0.19,
    w.back,
    w.front + 0.25,
    w.soffit,
    w.entablature,
    bright,
  );
  const F = facade([0, w.front - 0.2], [1, 0]);
  cornice(out, F, w.west, w.east, w.entablature - 0.11, 0.4);
  const bay = (w.east - w.west) / w.bays;
  for (let i = 0; i <= w.bays; i++) {
    const x = w.west + i * bay;
    column(out, x, w.front - 0.38, w.porchDeck, w.soffit, lod, 0.235);
    if (i === w.bays || lod === 0) continue;
    if (lod > 0) awning(out, x + 0.35, x + bay - 0.26, w.front - 0.27, lod);
    handrail(out, F, x + 0.18, x + bay - 0.18, w.porchDeck + 0.06, lod);
    if (lod === 3 && i % 3 === 1) {
      box(
        out,
        'trim',
        x + 1.12,
        x + bay - 1.11,
        w.front - 0.7,
        w.front - 0.25,
        w.porchDeck + 0.08,
        w.porchDeck + 0.45,
        rgb('557061'),
      );
    }
  }
  if (lod > 0)
    for (const endpoint of [w.west, w.east]) {
      for (let i = 1; i <= 2; i++)
        column(out, endpoint, w.front - 0.38 - i * 3.42, w.porchDeck, w.soffit, lod, 0.235);
      const S = facade([endpoint, w.front - 0.35], [0, endpoint === w.west ? 1 : -1]);
      for (const z of [0, 1]) {
        const u = (endpoint === w.west ? -1 : 1) * z * 3.38;
        handrail(out, S, Math.min(u, u + 3.17), Math.max(u, u + 3.17), w.porchDeck + 0.06, lod);
      }
    }
  const stepX = -8.58;
  if (lod > 0)
    for (let i = 0; i < 4; i++)
      box(
        out,
        'concrete',
        stepX - 3.45,
        stepX + 3.45,
        w.front - 0.06,
        w.front + 1.52 - i * 0.29,
        floor - 0.18,
        0.29 * (i + 1),
        plinth,
      );
}
function build(out, lod) {
  hotelBody(out, lod);
  porch(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'grand-hotel-mackinac-island-model.mjs';
const camera = [104, 73, 181];
const lookAt = [-12, 12, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Mackinac Island’s long white hotel, with its Doric waterfront veranda, striped awnings, green roof and central cupola.',
  camera,
  lookAt,
  sunDirection: [-25, 54, 28],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Only the connected, individually mapped Grand Hotel building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'straits-frontage-and-cupola', position: camera, lookAt },
    { name: 'dorics-cross-rails-and-striped-awnings', position: [49, 13, 59], lookAt: [16, 8, 30] },
    { name: 'green-roof-and-connected-wings', position: [-114, 82, -103], lookAt: [-13, 13, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'grand-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.61,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.64, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.077, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
