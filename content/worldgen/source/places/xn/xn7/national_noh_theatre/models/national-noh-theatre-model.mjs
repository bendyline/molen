import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { rings } = JSON.parse(
  fs.readFileSync(new URL('../native-map/noh-tokyo-building-rings.json', import.meta.url)),
);
const { outline } = frame.geometry;
const { foundation, floor, eave, ridge } = plan.dimensions;
const gray = rgb('b4b1a4');
const pale = rgb('c9c6b8');
const slate = rgb('646d71');
const ridgeSlate = rgb('737c7d');
const fascia = rgb('555a56');
const pane = rgb('515e5d');
const mullion = rgb('888d85');
const base = rgb('a09c91');
const beamColor = rgb('665d4d');
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_panel', roughness: 0.92 },
  light: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  dark: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  paved: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  matte: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
  glass: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.57 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
};
function box(out, slot, x, y, z, w, h, d, color, bottom = false) {
  abox(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color, { bottom });
}
function roofCap(out, ring, y) {
  const list = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < list.length; i += 3)
    tri(out, 'roof', p(list[i]), p(list[i + 2]), p(list[i + 1]), slate);
}
function glassBay(out, F, u, lo, w, h, lod) {
  opening(out, F, u, lo, w, h, {
    glassSlot: lod === 0 ? 'matte' : 'glass',
    frameSlot: 'rail',
    glass: pane,
    frame: mullion,
    d: 0.035,
    frameWidth: lod >= 2 ? 0.077 : 0,
    frameDepth: 0.106,
    sill: false,
    mullions: lod > 0 ? Math.round(w / 1.5) : 0,
    transoms: lod === 3 && h > 2.6 ? 1 : 0,
  });
}
function volumes(out, lod) {
  for (const [i, ring] of rings.entries()) {
    const h = i === 0 ? eave : [5.02, 5.85][i - 1];
    extrude(out, 'paved', ring, foundation, floor, base, { top: false });
    extrude(out, 'wall', ring, floor, h, gray, { top: false });
    roofCap(out, ring, h);
    if (lod === 0) continue;
    const r = outwardRing(ring);
    for (let j = 0; j < r.length; j++) {
      const F = wallFace(r[j], r[(j + 1) % r.length]);
      if (F.length < 6 || (i === 1 && F.normal[0] < -0.8)) continue;
      fbox(out, 'dark', F, 0.09, F.length - 0.09, h - 0.46, h + 0.07, 0.002, 0.19, fascia);
      const count = Math.round(F.length / (i === 0 ? 7.7 : 5.7));
      for (let k = 0; k < count; k++) {
        const w = F.length / count,
          u = (k + 0.5) * w;
        glassBay(out, F, u, floor + 0.28, w * (i === 0 ? 0.46 : 0.59), i === 0 ? 2.28 : 2.96, lod);
        if (lod < 2) continue;
        fbox(
          out,
          'light',
          F,
          u - w * 0.47,
          u - w * 0.4,
          floor + 0.32,
          h - 0.49,
          -0.022,
          0.18,
          pale,
        );
      }
    }
  }
}
function roofRing(x, z, y, width, depth) {
  const a = width / 2,
    b = depth / 2;
  return [
    [x - a, y, z - b],
    [x - a, y, z + b],
    [x + a, y, z + b],
    [x + a, y, z - b],
  ];
}
function hippedRoof(out, x, z, w, d, low, high, lod) {
  const xRidge = w > d;
  const topW = xRidge ? w - d * 0.58 : 0.19;
  const topD = xRidge ? 0.19 : d - w * 0.65;
  const shoulder = low + (high - low) * 0.38;
  loft(
    out,
    'roof',
    [
      roofRing(x, z, low, w, d),
      roofRing(x, z, shoulder, w * 0.73 + topW * 0.27, d * 0.73 + topD * 0.27),
      roofRing(x, z, high, topW, topD),
    ],
    slate,
    { cap: true },
  );
  box(out, 'dark', x, low - 0.29, z, w - 0.08, 0.3, d - 0.08, fascia, true);
  box(out, 'roof', x, high - 0.035, z, topW + 0.09, 0.126, topD + 0.09, ridgeSlate);
  if (lod < 2) return;
  const n = Math.floor((xRidge ? topW : topD) / (lod === 3 ? 1.08 : 2.36));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5;
    for (const s of [-1, 1]) {
      const at = xRidge
        ? [x + u * w, low + 0.057, z + s * (d / 2 - 0.033)]
        : [x + s * (w / 2 - 0.033), low + 0.057, z + u * d];
      const elbow = xRidge
        ? [x + u * (w * 0.73 + topW * 0.27), shoulder + 0.032, z + s * d * 0.365]
        : [x + s * w * 0.365, shoulder + 0.032, z + u * (d * 0.73 + topD * 0.27)];
      const end = xRidge
        ? [x + u * topW, high + 0.026, z + s * (topD * 0.45)]
        : [x + s * (topW * 0.45), high + 0.026, z + u * topD];
      beam(out, 'roof', at, elbow, 0.035, 0.033, ridgeSlate);
      beam(out, 'roof', elbow, end, 0.034, 0.033, ridgeSlate);
    }
  }
}
function entry(out, lod) {
  const F = facade([-34.65, -20.49], [0, 1]);
  const door = facade([-34.565, -20.49], [0, 1]);
  const spans = [
    [-5.03, 4.24],
    [-0.25, 3.67],
    [4.62, 4.02],
  ];
  for (const [u, w] of spans) glassBay(out, door, u, floor + 0.12, w, 3.59, lod);
  fbox(out, 'paved', F, -8.43, 7.72, floor - 0.21, floor + 0.037, 0.023, 3.19, base);
  fbox(out, 'dark', F, -8.49, 7.89, 4.82, 5.19, -0.139, 3.16, fascia, { bottom: true });
  for (const x of [-7.65, -2.47, 2.42, 6.91]) {
    fbox(out, 'light', F, x - 0.22, x + 0.22, floor + 0.06, 4.86, 2.7, 3.11, pale);
    if (lod > 1) fbox(out, 'dark', F, x - 0.135, x + 0.135, 4.69, 4.88, 1.64, 2.77, beamColor);
  }
  if (lod < 2) return;
  for (let i = -9; i < 10; i++) {
    const u = i * 0.77;
    fbox(out, 'light', F, u - 0.02, u + 0.02, floor - 0.01, floor + 0.008, 0.13, 2.9, pale);
  }
}
function build(out, lod) {
  volumes(out, lod);
  hippedRoof(out, 14.39, 1.41, 37.65, 76.19, eave + 0.17, ridge, lod);
  hippedRoof(out, -13.2, 17.12, 31.62, 45.28, eave + 0.13, 12.81, lod);
  hippedRoof(out, -25.84, -18.38, 20.65, 21.25, 5.04, 9.79, lod);
  hippedRoof(out, -20.23, -34.32, 24.15, 9.36, 5.8, 8.43, lod);
  entry(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'national-noh-theatre-model.mjs';
const camera = [-93, 38, -85];
const lookAt = [-1, 6, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The National Noh Theatre in Sendagaya, with broad gray hipped roofs and a recessed entry porch on pale piers.',
  camera,
  lookAt,
  sunDirection: [-59, 55, -42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    outlines: rings,
    minimumCoverage: 0.91,
    basis: 'Mapped auditorium and two separate entrance-side ranges.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'auditorium-and-repeated-hipped-roofs', position: camera, lookAt },
    { name: 'recessed-porch-and-pale-piers', position: [-55, 8, -29], lookAt: [-28, 4.9, -20] },
    { name: 'southern-wall-and-main-ridge', position: [-62, 27, 76], lookAt: [0, 7, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-noh-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.08,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.056, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
