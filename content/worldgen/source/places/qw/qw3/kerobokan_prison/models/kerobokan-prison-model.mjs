import { readFileSync } from 'node:fs';
import {
  block,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  plane,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const base = d.receptionFloor;
const facade = base + d.facadeHeight;
const tone = palette({
  plaster: 'ccc9b5',
  fascia: 'd6d4c4',
  soffit: 'b7b3a2',
  shade: '9a9484',
  sill: '958276',
  red: '8b554e',
  tile: '744d48',
  darkTile: '685c4d',
  plate: '9a8069',
  glass: '606a68',
  bronze: 'aa875a',
  masonry: 'a49a90',
  landscape: '656b54',
});
const surfaces = {
  plaster: surface('wall', 'plaster_lime', 0.91),
  concrete: surface('foundation', 'concrete_plain', 0.96),
  paving: surface('foundation', 'stone_ashlar', 0.95),
  roof: surface('roof', 'tile_flat', 0.94),
  bronze: surface('trim', 'metal_bronze_cast', 0.82, 0.17),
  glass: surface('window', 'window_grid', 0.53),
};
const box = (out, slot, [l, r, a, b], low, high, shade) =>
  block(out, slot, l, low, a, r - l, high - low, b - a, shade);

function hip(out, x, z, width, length, y, rise, color, lod) {
  const a = [x - width / 2, y, z - length / 2],
    b = [x + width / 2, y, z - length / 2];
  const c = [x + width / 2, y, z + length / 2],
    e = [x - width / 2, y, z + length / 2];
  const halfRidge = (width - length * 0.72) / 2;
  const p = [x - halfRidge, y + rise, z],
    q = [x + halfRidge, y + rise, z];
  face(out, 'roof', [a, b, q, p], up, color);
  face(out, 'roof', [e, p, q, c], up, color);
  face(out, 'roof', [b, c, q], up, color);
  face(out, 'roof', [a, p, e], up, color);
  if (lod > 1)
    box(
      out,
      'roof',
      [p[0], q[0], z - 0.055, z + 0.055],
      y + rise - 0.02,
      y + rise + 0.095,
      tone.darkTile,
    );
}

function mainMassing(out, lod) {
  const [l, r] = d.ranges;
  const recess = -3.75;
  const depth = d.width;
  const foundation = rect(l, -depth, r, recess + 0.15);
  shell(out, foundation, (p) => grade(p) - 0.33, base + 0.1, {
    wall: 'concrete',
    color: tone.sill,
  });
  box(out, 'plaster', [l, r, -depth, recess], base, facade - 0.21, tone.shade);
  box(out, 'plaster', [l, r, -depth - 0.28, -0.49], facade - 0.69, facade - 0.06, tone.soffit);
  box(out, 'plaster', [l - 0.38, r + 0.38, -0.89, 0.63], facade - 0.77, facade - 0.03, tone.fascia);
  const [left, right] = d.mainCanopy;
  box(
    out,
    'plaster',
    [left, right, -3.42, d.mainCanopyFront],
    facade - 1.06,
    facade + 0.01,
    tone.soffit,
  );
  box(
    out,
    'plaster',
    [left - 0.12, right + 0.12, d.mainCanopyFront - 0.31, d.mainCanopyFront + 0.04],
    facade - 0.88,
    facade + 0.16,
    tone.fascia,
  );
  box(
    out,
    'concrete',
    [l + 0.1, r - 0.13, recess - 0.08, recess + 0.21],
    base + 0.01,
    base + 0.48,
    tone.sill,
  );
  for (const [x, z, w, depth, extra, color] of [
    [-1.5, -7.63, 12.3, 7.9, 2.53, tone.tile],
    [14.72, -8.7, 10.6, 5.65, 1.74, tone.darkTile],
    [-15.4, -8.16, 11.6, 6.12, 1.57, tone.darkTile],
  ]) {
    box(
      out,
      'plaster',
      [x - w * 0.47, x + w * 0.47, z - depth * 0.44, z + depth * 0.44],
      facade - 0.45,
      facade + 0.26,
      tone.plaster,
    );
    hip(out, x, z, w, depth, facade + 0.275, extra, color, lod);
  }
  for (const x of [-24, -17, -10.14, 10.03, 16.82, 23.9]) {
    const z = Math.abs(x) < 11 ? 0.62 : -0.17;
    box(
      out,
      'plaster',
      [x - 0.23, x + 0.23, z - 0.26, z + 0.26],
      base,
      facade - 0.68,
      tone.plaster,
    );
    box(out, 'concrete', [x - 0.26, x + 0.26, z - 0.29, z + 0.29], base, base + 0.48, tone.red);
  }
  if (lod === 0) return;
  box(
    out,
    'plaster',
    [left - 0.1, right + 0.1, d.mainCanopyFront + 0.035, d.mainCanopyFront + 0.075],
    facade - 0.88,
    facade - 0.79,
    tone.soffit,
  );
  lettering(out, 'LAPAS DENPASAR', {
    width: 13.4,
    height: 0.53,
    y: facade - 0.55,
    z: d.mainCanopyFront + 0.12,
    stroke: 0.092,
    color: tone.bronze,
    slot: 'bronze',
  });
  if (lod > 1) {
    const front = plane(d.mainCanopyFront + 0.041, 1);
    for (const x of [-9.86, 9.21]) {
      ring(
        out,
        'concrete',
        [x, 0.78],
        [
          [base, 0.56],
          [base + 0.13, 0.59],
          [base + 0.56, 0.67],
          [base + 0.6, 0.66],
        ],
        lod === 2 ? 8 : 12,
        tone.masonry,
      );
      panel(
        out,
        'plaster',
        front,
        x - 0.32,
        x + 0.32,
        facade - 1.0,
        facade - 0.94,
        0.006,
        tone.plate,
      );
    }
  }
}

function publicWindows(out, lod) {
  const z = -3.7,
    wall = plane(z, 1);
  for (const [l, r, low, high] of [
    [-23.2, -19.1, 0.76, 2.58],
    [-17.4, -13.3, 0.76, 2.58],
    [-8.23, -5.13, 0.43, 2.93],
    [-4.93, -1.28, 0.37, 2.94],
    [-1.08, 1.18, 0.09, 2.95],
    [1.39, 4.75, 0.36, 2.94],
    [5.0, 8.15, 0.42, 2.92],
    [12.6, 15.65, 0.82, 2.59],
    [17.6, 23.5, 0.85, 2.57],
  ]) {
    panel(
      out,
      'plaster',
      wall,
      l - 0.13,
      r + 0.13,
      base + low - 0.1,
      base + high + 0.1,
      0.032,
      tone.plate,
    );
    panel(out, 'glass', wall, l, r, base + low, base + high, 0.052, tone.glass);
    if (lod < 1) continue;
    panel(
      out,
      'plaster',
      wall,
      l,
      r,
      base + mix(low, high, 0.56) - 0.027,
      base + mix(low, high, 0.56) + 0.027,
      0.069,
      tone.soffit,
    );
    for (const ratio of lod === 1 ? [0.5] : [0.33, 0.67]) {
      const x = mix(l, r, ratio);
      panel(
        out,
        'plaster',
        wall,
        x - 0.028,
        x + 0.028,
        base + low,
        base + high,
        0.073,
        tone.plaster,
      );
    }
  }
  if (lod > 1) {
    for (const [l, r] of [
      [-7.76, -5.42],
      [5.19, 7.94],
    ]) {
      panel(out, 'plaster', wall, l, r, base + 2.18, base + 2.67, 0.078, tone.soffit);
      const lines = lod === 2 ? 3 : 5;
      for (let i = 0; i < lines; i++) {
        const y = base + 2.27 + i * (0.31 / lines);
        panel(out, 'bronze', wall, l + 0.14, r - 0.14, y, y + 0.019, 0.083, tone.plate);
      }
    }
  }
}

function foreground(out, lod) {
  const spot = [-20.95, 21.72, -3.5, 2.94];
  shell(out, rect(spot[0], spot[2], spot[1], spot[3]), (p) => grade(p) - 0.11, base - 0.01, {
    wall: 'paving',
    color: tone.masonry,
  });
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    const x = sign * 11.2;
    box(out, 'paving', [x - 0.83, x + 0.83, -1.05, 0.3], base - 0.02, base + 0.42, tone.sill);
    box(out, 'concrete', [x - 0.71, x + 0.71, -0.93, 0.2], base + 0.41, base + 0.5, tone.landscape);
  }
}

function build(out, lod) {
  foreground(out, lod);
  mainMassing(out, lod);
  publicWindows(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kerobokan-prison-model.mjs';
const camera = [37, 18, 61];
const lookAt = [0, 2, -3];
export const kerobokanModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The street-facing reception slab uses the independent original ground at the documented road front.',
  brief:
    'Kerobokan Prison’s publicly visible reception façade at Jalan Gunung Tangkuban Perahu, with its long cream canopy and raised Lapas Denpasar name.',
  camera,
  lookAt,
  sunDirection: [28, 49, 50],
  mediumFiContext: {
    scale: 1,
    groundY: -0.14,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'stadium-lettering.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'public-reception-from-street', position: [3.3, 6.7, 29], lookAt: [0, 2.52, -2.4] },
    { name: 'laps-reception-nameplate', position: [8.6, 5.5, 18], lookAt: [0, 2.63, 0.3] },
    { name: 'low-hipped-roofs-and-canopy', position: [-34, 16, 25], lookAt: [2, 2.53, -4.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kerobokan-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.53, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Davidelit’s existing Qualla image was released under CC0. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
