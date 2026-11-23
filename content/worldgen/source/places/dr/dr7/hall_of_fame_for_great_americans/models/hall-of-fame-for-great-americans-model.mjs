import fs from 'node:fs';
import {
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, floor, eave, ridge } = plan.dimensions;
const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  dressed: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.91 },
  mutedMetal: { slot: 'roof', graph: 'metal_copper', roughness: 0.76 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.81 },
};
const granite = rgb('a39886');
const plinth = rgb('b5ac99');
const limestone = rgb('c5bba7');
const pale = rgb('d0c7b6');
const paver = rgb('9d7163');
const tiles = rgb('776257');
const copper = rgb('6e7c64');
const shadow = rgb('625e55');

function curve(points) {
  let length = 0;
  const stops = points.map((point, index) => {
    if (index > 0)
      length += Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]);
    return length;
  });
  return (fraction) => {
    const u = Math.max(0, Math.min(fraction, 1)) * length;
    const j = Math.max(
      1,
      stops.findIndex((stop) => u <= stop),
    );
    const t = (u - stops[j - 1]) / (stops[j] - stops[j - 1]);
    const [a, b] = [points[j - 1], points[j]];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
}
const outer = curve(outline.slice(15, 50).reverse());
const inner = curve([...outline.slice(50), ...outline.slice(0, 15)]);
const spot = (t, across) => {
  const [x, z] = outer(t),
    [u, v] = inner(t);
  return [x + (u - x) * across, z + (v - z) * across];
};
const point = (t, across, y) => {
  const [x, z] = spot(t, across);
  return [x, y, z];
};
function strip(out, slot, intervals, across1, across2, y1, y2, color) {
  for (let i = 0; i < intervals; i++) {
    const a = i / intervals,
      b = (i + 1) / intervals;
    quad4(
      out,
      slot,
      point(a, across2, y2),
      point(a, across1, y1),
      point(b, across1, y1),
      point(b, across2, y2),
      color,
    );
  }
}
function side(out, slot, intervals, across, lo, hi, color) {
  for (let i = 0; i < intervals; i++) {
    const a = i / intervals,
      b = (i + 1) / intervals;
    const [first, second] = across < 0.5 ? [a, b] : [b, a];
    quad4(
      out,
      slot,
      point(first, across, lo),
      point(second, across, lo),
      point(second, across, hi),
      point(first, across, hi),
      color,
    );
  }
}

function floorAndBase(out, mode, segments) {
  const ring =
    mode === 0
      ? outline.filter((_p, i) => i % 2 === 0 || i === 15 || i === 49 || i === 65)
      : outline;
  extrude(out, 'granite', ring, foundation, floor, granite, { top: false });
  strip(out, 'brick', segments, 0, 1, floor, floor, paver);
  for (const edge of [-0.042, 1.042]) {
    const inside = edge < 0 ? 0.073 : 0.927;
    side(out, 'dressed', segments, edge, floor - 0.52, floor + 0.13, plinth);
    strip(
      out,
      'dressed',
      segments,
      Math.min(edge, inside),
      Math.max(edge, inside),
      floor + 0.131,
      floor + 0.131,
      pale,
    );
  }
  if (mode < 2) return;
  const bays = mode === 3 ? 31 : 19;
  for (let i = 1; i < bays; i++) {
    const t = i / bays;
    const [x, z] = outer(t);
    const a = outer(t - 0.008),
      b = outer(t + 0.008);
    const W = facade([x, z], [b[0] - a[0], b[1] - a[1]]);
    opening(out, W, 0, floor - 3.19, 0.56, 1.02, {
      glassSlot: 'shadow',
      frameSlot: 'dressed',
      glass: shadow,
      frame: plinth,
      d: 0.079,
      frameWidth: mode === 3 ? 0.063 : 0,
      sill: false,
    });
  }
}
function colonnade(out, lod) {
  const count = [15, 25, 32, 32][lod];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = spot(t - 0.01, 0.5),
      b = spot(t + 0.01, 0.5);
    for (const across of [0.13, 0.87]) {
      const F = facade(spot(t, across), [b[0] - a[0], b[1] - a[1]]);
      const w = i % 8 === 0 ? 0.57 : 0.42;
      const h = eave - 0.75;
      fbox(out, 'limestone', F, -w / 2, w / 2, floor + 0.22, h, -w / 2, w / 2, limestone);
      if (lod === 0) continue;
      fbox(
        out,
        'dressed',
        F,
        -w * 0.68,
        w * 0.68,
        floor + 0.13,
        floor + 0.48,
        -w * 0.68,
        w * 0.68,
        pale,
      );
      fbox(out, 'dressed', F, -w * 0.71, w * 0.71, h - 0.34, h + 0.14, -w * 0.71, w * 0.71, pale);
      if (lod < 2 || i === count || i % 5 === 2) continue;
      fbox(out, 'dressed', F, 0.55, 1.07, floor + 0.13, floor + 0.82, -0.29, 0.29, plinth);
      if (lod === 3)
        fbox(out, 'dressed', F, 0.51, 1.11, floor + 0.77, floor + 0.86, -0.34, 0.34, pale);
    }
  }
}
function ends(out, lod) {
  for (const t of [0, 1]) {
    const outPoint = spot(t, 1.04),
      inPoint = spot(t, -0.04);
    const [a, b] = t === 0 ? [outPoint, inPoint] : [inPoint, outPoint];
    const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid = width / 2;
    const top = eave + 0.77;
    fbox(out, 'dressed', f, -0.13, width + 0.12, eave - 0.57, eave + 0.04, -0.28, 0.03, pale);
    tri(
      out,
      'limestone',
      f.P(0, eave, 0.04),
      f.P(width, eave, 0.04),
      f.P(mid, top, 0.04),
      limestone,
    );
    if (lod === 0) continue;
    for (let i = 0; i < 3; i++) {
      fbox(
        out,
        'granite',
        f,
        0.38 + i * 0.09,
        width - 0.38 - i * 0.09,
        floor - 0.77,
        floor - 0.57 + i * 0.28,
        -0.21,
        0.68 - i * 0.18,
        plinth,
      );
    }
    if (lod < 2) continue;
    for (const offset of [-0.76, 0, 0.76]) {
      fbox(
        out,
        'dressed',
        f,
        mid + offset - 0.14,
        mid + offset + 0.14,
        eave + 0.11,
        eave + 0.34,
        -0.01,
        0.063,
        pale,
      );
    }
  }
}
function shelter(out, lod, segments) {
  const lo = eave - 0.78;
  side(out, 'dressed', segments, -0.03, lo, eave, limestone);
  side(out, 'dressed', segments, 1.03, lo, eave, limestone);
  strip(out, 'tile', segments, -0.078, 0.5, eave, ridge, tiles);
  strip(out, 'tile', segments, 0.5, 1.078, ridge, eave, tiles);
  for (let i = 0; i < segments; i++) {
    const a = i / segments,
      b = (i + 1) / segments;
    quad4(
      out,
      'limestone',
      point(a, 1.03, lo),
      point(b, 1.03, lo),
      point(b, -0.03, lo),
      point(a, -0.03, lo),
      plinth,
    );
  }
  if (lod === 0) return;
  strip(out, 'mutedMetal', segments, 0.46, 0.54, ridge + 0.036, ridge + 0.036, copper);
  for (const [a, b] of [
    [-0.08, 0.004],
    [1.0, 1.082],
  ])
    strip(out, 'mutedMetal', segments, a, b, eave + 0.025, eave + 0.025, copper);
  if (lod < 2) return;
  for (const across of [-0.034, 1.034])
    side(out, 'dressed', segments, across, eave - 0.27, eave - 0.12, pale);
}
function build(out, lod) {
  const segments = [14, 25, 39, 54][lod];
  floorAndBase(out, lod, segments);
  colonnade(out, lod);
  shelter(out, lod, segments);
  ends(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'hall-of-fame-for-great-americans-model.mjs';
const camera = [-76, 33, 39];
const lookAt = [-3, 2, 0];
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
    'Stanford White’s curved limestone colonnade with its tile roof, granite podium and open gallery in the Bronx.',
  camera,
  lookAt,
  sunDirection: [-64, 47, 33],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The individually named curved center colonnade.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'crescent-over-the-granite-podium', position: camera, lookAt },
    { name: 'gallery-columns-and-end-pediment', position: [8.5, 7.8, 34], lookAt: [-13, 4.96, 14] },
    { name: 'tiled-roof-and-north-entrance', position: [-20, 13, -45], lookAt: [-4, 4.2, -15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hall-of-fame-for-great-americans-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
