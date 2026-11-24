import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = outwardRing(frame.geometry.outline);
const { foundation, baseEave, shaftCenter, shaftWidth, deckBottom, deckTop } = plan.dimensions;
const [cx, cz] = shaftCenter;
const offWhite = rgb('dfded2');
const light = rgb('ebebe3');
const shade = rgb('d0cdc0');
const base = rgb('c4b7a1');
const seam = rgb('bbbdb4');
const rust = rgb('be583a');
const red = rgb('cf6948');
const dark = rgb('5a615b');
const pane = rgb('697c7b');
const shadePane = rgb('4c6260');
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_panel', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
};
const square = (r) =>
  outwardRing([
    [cx - r, cz - r],
    [cx + r, cz - r],
    [cx + r, cz + r],
    [cx - r, cz + r],
  ]);
function top(out, ring, y, color) {
  const indices = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, 'roof', p(indices[i]), p(indices[i + 2]), p(indices[i + 1]), color);
}
function roofBand(out, r, y, h, color) {
  abox(out, 'roof', [cx - r, y, cz - r], [cx + r, y + h, cz + r], color, { bottom: true });
}
function window(out, f, u, y, w, h, lod, tint = pane) {
  opening(out, f, u, y, w, h, {
    glassSlot: 'glazing',
    frameSlot: 'trim',
    glass: tint,
    frame: offWhite,
    d: 0.035,
    frameWidth: lod === 3 ? 0.077 : 0,
    sill: false,
    mullions: lod > 0 ? Math.max(0, Math.round(w / 1.1) - 1) : 0,
    transoms: lod > 1 && h > 2.3 ? 1 : 0,
  });
}
function visitorBase(out, lod) {
  extrude(out, 'base', outline, foundation, 0.43, base, { top: false });
  extrude(out, 'wall', outline, 0.38, baseEave, shade, { top: false });
  top(out, outline, baseEave + 0.003, shade);
  if (lod === 0) return;
  for (let i = 0; i < outline.length; i++) {
    const f = wallFace(outline[i], outline[(i + 1) % outline.length]);
    const length = f.length;
    if (length < 1.7) continue;
    fbox(
      out,
      'trim',
      f,
      0.035,
      length - 0.035,
      baseEave - 0.16,
      baseEave + 0.14,
      -0.065,
      0.14,
      dark,
    );
    if (length < 3.3) continue;
    const count = Math.ceil(length / 6.7),
      span = length / count;
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) * span;
      const front = f.normal[0] < -0.7;
      window(
        out,
        f,
        u,
        front ? 0.42 : 1.32,
        span * (front ? 0.76 : 0.5),
        front ? 2.65 : 1.28,
        lod,
        j % 2 ? pane : shadePane,
      );
      if (front && lod > 1)
        fbox(out, 'roof', f, u - span * 0.43, u + span * 0.43, 3.28, 3.5, -0.08, 0.75, light);
    }
  }
}

function tower(out, lod) {
  const ring = square(shaftWidth / 2);
  const shoulder = deckTop - 2.6;
  const fasciaBottom = deckTop - 1.91;
  const outer = 4.94;
  const deck = square(outer);
  extrude(out, 'wall', ring, baseEave - 0.12, shoulder + 0.11, offWhite, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const n = f.length;
    const u = n / 2;
    fbox(out, 'trim', f, u - 0.33, u + 0.33, baseEave, shoulder + 0.05, -0.016, 0.18, rust);
    if (lod > 0) {
      fbox(out, 'trim', f, u - 0.14, u + 0.14, baseEave + 0.04, shoulder + 0.05, 0.119, 0.288, red);
      for (const p of [0.62, 1.72, n - 1.72, n - 0.62]) {
        window(out, f, p, deckBottom + 1.52, 0.86, 1.07, lod, shadePane);
      }
    }
    const d = wallFace(deck[i], deck[(i + 1) % deck.length]);
    const middle = d.length / 2;
    const fin = 0.26;
    quad4(
      out,
      'trim',
      f.P(u - fin, shoulder, 0.286),
      f.P(u + fin, shoulder, 0.286),
      d.P(middle + fin, fasciaBottom - 0.019, 0.043),
      d.P(middle - fin, fasciaBottom - 0.019, 0.043),
      rust,
    );
    fbox(
      out,
      'trim',
      d,
      middle - fin,
      middle + fin,
      fasciaBottom - 0.02,
      deckTop - 0.59,
      0.014,
      0.05,
      rust,
    );
    if (lod < 2) continue;
    for (let y = baseEave + 3.38; y < deckBottom - 1.1; y += 3.42) {
      quad4(
        out,
        'trim',
        f.P(0.06, y, 0.016),
        f.P(n - 0.06, y, 0.016),
        f.P(n - 0.06, y + 0.032, 0.016),
        f.P(0.06, y + 0.032, 0.016),
        seam,
      );
    }
    if (lod === 3) {
      for (const u of [1.65, n - 1.65]) {
        quad4(
          out,
          'trim',
          f.P(u, baseEave + 0.08, 0.016),
          f.P(u + 0.019, baseEave + 0.08, 0.016),
          f.P(u + 0.019, deckBottom - 0.21, 0.016),
          f.P(u, deckBottom - 0.21, 0.016),
          seam,
        );
      }
    }
  }
  const shaped = (r, y) => square(r).map(([x, z]) => [x, y, z]);
  loft(out, 'wall', [shaped(shaftWidth / 2, shoulder), shaped(outer, fasciaBottom)], light, {
    cap: false,
  });
  roofBand(out, outer, fasciaBottom, 1.34, light);
  extrude(out, 'trim', deck, deckTop - 0.59, deckTop - 0.15, dark, { top: false });
  roofBand(out, outer + 0.04, deckTop - 0.15, 0.15, dark);
  for (let i = 0; i < deck.length; i++) {
    const f = wallFace(deck[i], deck[(i + 1) % deck.length]);
    const s = f.length;
    const count = lod === 0 ? 2 : lod === 1 ? 4 : 5;
    for (let j = 0; j < count; j++)
      window(
        out,
        f,
        ((j + 0.5) * s) / count,
        deckTop - 0.52,
        (s / count) * 0.93,
        0.33,
        lod,
        j % 4 === 0 ? shadePane : pane,
      );
  }
  if (lod === 0) return;
  roofBand(out, 1.07, deckTop, 0.75, offWhite);
  if (lod > 1) {
    for (const offset of [-2.09, 2.08]) {
      abox(
        out,
        'wall',
        [cx + offset - 0.16, deckTop, cz - 2.03],
        [cx + offset + 0.16, deckTop + 1.14, cz - 1.77],
        light,
        { bottom: false },
      );
    }
  }
  for (const [x, z, h] of [
    [cx + 0.72, cz, 2.55],
    [cx - 0.67, cz + 0.42, 1.65],
    [cx - 0.1, cz - 0.61, 2.25],
  ]) {
    beam(out, 'trim', [x, deckTop + 0.31, z], [x, deckTop + h, z], 0.09, 0.09, dark);
    if (lod === 3)
      beam(
        out,
        'trim',
        [x - 0.44, deckTop + h - 0.25, z],
        [x + 0.46, deckTop + h - 0.25, z],
        0.049,
        0.051,
        dark,
      );
  }
}

function build(out, lod) {
  visitorBase(out, lod);
  tower(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'florida-citrus-tower-model.mjs';
const camera = [60, 29, -103];
const lookAt = [0, 33, 0];
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
    'The white Florida Citrus Tower with long orange fins, a projecting glazed observation room, and the connected visitor base.',
  camera,
  lookAt,
  sunDirection: [-20, 61, -57],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The individually named tower and visitor-base footprint.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'tower-and-visitor-base', position: camera, lookAt },
    { name: 'projecting-glazed-observation-deck', position: [19, 63, -25], lookAt: [cx, 65.2, cz] },
    { name: 'entrance-and-shaft', position: [-35, 8, -37], lookAt: [-10, 13, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'florida-citrus-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.057, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
