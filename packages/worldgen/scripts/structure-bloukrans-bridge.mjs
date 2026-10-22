/** Bloukrans N2 concrete deck arch, from two cleared local public-domain NJR ZA photographs. */
import './install-deterministic-math.mjs';
import { beam, loft } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const concrete = rgb('bdbfb3'),
  edge = rgb('c5c7b9'),
  soffit = rgb('afb3a9'),
  asphalt = rgb('616865'),
  mark = rgb('c9c8b4'),
  steel = rgb('465650'),
  rail = rgb('9ba79b');
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.18 },
  road: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
};
const spring = 136,
  deckHalf = 225.5,
  archY = (x) => -6 - 62 * (x / spring) * (x / spring),
  thickness = (x) => 3.8 + 2.4 * (x / spring) * (x / spring);
function arch(out, d) {
  const n = [20, 44, 80, 144][d],
    rings = [];
  for (let i = 0; i <= n; i++) {
    const x = -spring + (2 * spring * i) / n,
      y = archY(x),
      t = thickness(x),
      w = 6.2 + 1.3 * Math.abs(x / spring);
    rings.push([
      [x, y, -w],
      [x, y, w],
      [x, y - t, w],
      [x, y - t, -w],
    ]);
  }
  loft(out, 'concrete', rings, concrete);
  for (const sign of [-1, 1]) B(out, 'concrete', sign * 137, -77, 0, 9, 9.2, 16.2, soffit);
}
function build(out, _frame, d = 3) {
  arch(out, d);
  B(out, 'concrete', 0, -2.2, 0, 451, 2.2, 16, concrete);
  B(out, 'road', 0, 0.005, 0, 451, 0.035, 13.6, asphalt);
  // Two rows of open spandrel columns, not an opaque wall beneath the roadway.
  const xs = Array.from({ length: 17 }, (_, i) => -136 + i * 17);
  for (const x of xs)
    for (const z of [-5.55, 5.55]) {
      const bottom = archY(x) - 0.07;
      B(out, 'concrete', x, bottom, z, d === 0 ? 1.5 : 1.35, -2.2 - bottom, 1.7, edge);
      if (d > 1) {
        B(out, 'concrete', x, -3.0, z, 2.05, 0.8, 2.35, concrete);
        B(out, 'concrete', x, bottom, z, 1.9, 0.5, 2.3, concrete);
      }
    }
  for (const sign of [-1, 1]) {
    for (const [x, y] of [
      [157, -49],
      [181, -31],
      [205, -13],
    ])
      for (const z of [-5.55, 5.55]) B(out, 'concrete', sign * x, y, z, 1.7, -2.2 - y, 1.85, edge);
    B(out, 'concrete', sign * 223, -6.8, 0, 5, 6.7, 17, soffit);
  }
  // Pale concrete parapets with an open horizontal slit and regularly spaced posts.
  for (const z of [-7.55, 7.55]) {
    B(out, 'concrete', 0, 0.04, z, 451, 0.35, 0.6, edge);
    B(out, 'concrete', 0, 0.94, z, 451, 0.24, 0.36, edge);
    if (d === 0) continue;
    const step = d === 1 ? 12 : d === 2 ? 5 : 2.7,
      n = Math.ceil(451 / step);
    for (let i = 0; i <= n; i++)
      B(out, 'concrete', -deckHalf + (i * 451) / n, 0.36, z, 0.33, 0.58, 0.32, edge);
  }
  if (d > 0) {
    for (const z of [-6.55, 6.55]) B(out, 'road', 0, 0.043, z, 451, 0.012, 0.13, mark);
    if (d > 1)
      for (let x = -220; x < 220; x += 9)
        for (const z of [-0.12, 0.12]) B(out, 'road', x, 0.045, z, 4, 0.015, 0.065, mark);
  }
  if (d > 0) {
    // Narrow under-deck access catwalk and central operating platform; no people or logos.
    B(out, 'metal', -68, -4.35, -7.6, 136, 0.22, 1.45, steel);
    B(out, 'metal', 0, -5.65, -3.1, 17, 0.28, 11.0, steel);
    const step = d === 1 ? 17 : d === 2 ? 8.5 : 4.25;
    for (let x = -136; x <= 0.01; x += step) {
      beam(out, 'metal', [x, -2.2, -6.7], [x, -4.35, -8.15], 0.08, 0.08, steel);
      beam(out, 'metal', [x, -4.3, -8.2], [x, -3.15, -8.2], 0.045, 0.045, rail);
    }
    for (const y of [-3.16, -3.75])
      beam(out, 'metal', [-136, y, -8.2], [0, y, -8.2], 0.065, 0.065, rail);
    for (const z of [-8.55, 2.35]) {
      beam(out, 'metal', [-8.4, -4.35, z], [8.4, -4.35, z], 0.06, 0.06, rail);
      for (const x of [-8.4, -4.2, 0, 4.2, 8.4])
        beam(out, 'metal', [x, -5.5, z], [x, -4.35, z], 0.055, 0.055, rail);
    }
    if (d > 1) {
      for (let x = -8.5; x < 8.5; x += 1.05)
        beam(out, 'metal', [x, -5.7, -8.5], [x, -2.7, -8.5], 0.055, 0.055, steel);
      for (const y of [-5.65, -2.75])
        beam(out, 'metal', [-8.5, y, -8.5], [8.5, y, -8.5], 0.07, 0.07, steel);
      for (let x = -8.5; x < 8.4; x += 2.1)
        beam(out, 'metal', [x, -5.6, -8.5], [x + 2.1, -2.8, -8.5], 0.04, 0.04, steel);
    }
  }
  if (d > 1)
    for (let x = -220; x < 225; x += 22.4)
      for (const z of [-7.99, 7.99]) B(out, 'concrete', x, -2.18, z, 0.045, 2.13, 0.025, soffit);
}
export const bloukransBridgeSkyline = (out, frame) => build(out, frame, 0);
export const bloukransBridgeDistrict = (out, frame) => build(out, frame, 1);
export const bloukransBridgeStreet = (out, frame) => build(out, frame, 2);
export const bloukransBridgeModel = {
  id: 'bloukrans_bridge',
  key: 'bloukrans_bridge',
  recipe: 'structure-bloukrans-bridge.mjs',
  cell: 'k9/k9b',
  title: 'Bloukrans Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    '451m N2 concrete deck arch bridge with272m single broad arch, approximately62m arch rise, paired open vertical spandrel columns, approach piers and abutments, two-lane charcoal roadway, pale slotted concrete parapets, narrow under-deck catwalk and central bungee platform. River gorge and detached visitor buildings are excluded;216m river clearance is a site fact, not an invented line of tall piers.',
  camera: [290, 125, 380],
  lookAt: [0, -30, 0],
  portableGroundY: -81,
  mediumFiContext: { scale: 3.2, groundY: -81 },
  qaCameras: [
    { name: 'arch-and-spandrels', position: [25, -18, 230], lookAt: [0, -38, 0] },
    { name: 'road-and-parapets', position: [160, 28, 55], lookAt: [25, 0, 0] },
    { name: 'catwalk-and-platform', position: [15, 5, -40], lookAt: [-8, -4, -5] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native mapped N2 bridge centerline fixes centroid and heading; dry eastern N2 approach240m from center defines deck-level datum. Source terrain remains unchanged. Flat inspection stage is below the arch so the open span is visible; host ravine and springing contact remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bloukrans-bridge.mjs',
    level: 'skyline',
    export: 'bloukransBridgeSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'bloukransBridgeDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'bloukransBridgeStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    'Primary ACI1981 construction abstract and Qualla agree on451m total length,272m arch span and216m river clearance. Native mapped bridge centerline includes about12m of end transition beyond the reported bridge length; it controls centroid/heading, not a rescaling of the whole structure.',
    'Two inspected public-domain NJR ZA Qualla originals control the single broad concrete arch, repeated paired columns, slab/parapets and under-deck bungee platform. Rise,16m width, precise bay count, section thickness, hidden faces, platform/catwalk dimensions and bank-pier foundations are photographic medium-fi estimates. No engineering drawing or non-public-domain imagery used.',
    'Static exterior only: no traffic, people, operator logos, active bungee ropes or detached visitor facilities. No navigable internal structural box or engineering-grade collision.',
    'Bank reference and source terrain are approximate. Actual216m gorge/forest/river are supplied by the host landscape, not authored into the bridge. Gorge/rock contact is not surveyed and no source elevation is fitted to the model. Original photos remain in Qualla and are not textures.',
  ],
};
