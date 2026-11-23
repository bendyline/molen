import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor } = plan.dimensions;
const outline = outwardRing(frame.geometry.outline);
const courts = frame.geometry.holes;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.7 },
};
const rubble = rgb('a59a83');
const grit = rgb('b8a88b');
const shade = rgb('8f8571');
const lead = rgb('686b69');
const glass = rgb('494e45');
const oak = rgb('4d4438');
const clamp = (t) => Math.max(0, Math.min(1, t));
const eave = (x) => 11.2 + 5.15 * clamp((x + 35) / 74);
const north = (x, z) => facade([x, z], [-1, 0]);

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function roofCap(out, ring, holes, height, slot = 'roof', color = lead) {
  const points = ring.concat(...holes);
  const starts = [];
  let cursor = ring.length;
  for (const h of holes) {
    starts.push(cursor);
    cursor += h.length;
  }
  const tris = earcut(points.flat(), starts);
  const p = (idx) => {
    const [x, z] = points[idx];
    return [x, height(x, z), z];
  };
  for (let i = 0; i < tris.length; i += 3)
    tri(out, slot, p(tris[i]), p(tris[i + 2]), p(tris[i + 1]), color);
}

function sill(out, F, u, w, y, lod) {
  fbox(out, 'trim', F, u - w * 0.57, u + w * 0.57, y - 0.145, y + 0.014, 0, 0.195, grit);
  if (lod > 1) fbox(out, 'trim', F, u - w * 0.56, u + w * 0.56, y - 0.19, y - 0.12, 0, 0.254, grit);
}
function openingAt(
  out,
  F,
  u,
  y,
  w,
  h,
  lod,
  { head = 'flat', bars = 0, color = glass, glassDepth = 0.039 } = {},
) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    frame: grit,
    glass: color,
    head,
    d: glassDepth,
    frameDepth: 0.14,
    frameWidth: lod > 1 ? 0.103 : 0,
    sill: false,
    mullions: lod > 0 ? bars : 0,
    transoms: lod > 1 && bars > 0 ? 1 : 0,
  });
  if (lod > 1 && head === 'flat') sill(out, F, u, w, y, lod);
}
function crenels(out, F, top, lod, d = 0.31) {
  const base = (u) => top(F.P(u, 0)[0]);
  const size = F.length;
  const p = (u, dy, dep) => F.P(u, base(u) + dy, dep);
  quad4(
    out,
    'trim',
    p(0, -0.28, 0.13),
    p(size, -0.28, 0.13),
    p(size, 0.36, 0.13),
    p(0, 0.36, 0.13),
    grit,
  );
  if (lod === 0 && size < 6) return;
  const n = Math.max(1, Math.round(size / (lod === 0 ? 3.2 : 2.36)));
  for (let i = 0; i < n; i++) {
    const mid = (size * (i + 0.5)) / n;
    const w = Math.min(0.61, (size / n) * 0.31);
    if (lod < 2) {
      quad4(
        out,
        'wall',
        p(mid - w, 0.32, 0.13),
        p(mid + w, 0.32, 0.13),
        p(mid + w, 0.98, 0.13),
        p(mid - w, 0.98, 0.13),
        rubble,
      );
      continue;
    }
    fbox(out, 'wall', F, mid - w, mid + w, base(mid) + 0.32, base(mid) + 0.98, -d, 0.125, rubble);
    if (lod > 1)
      fbox(
        out,
        'trim',
        F,
        mid - w - 0.065,
        mid + w + 0.065,
        base(mid) + 0.93,
        base(mid) + 1.06,
        -d - 0.045,
        0.17,
        grit,
      );
  }
}
function lattice(out, F, u, y, w, h) {
  const width = w / 5;
  for (let col = 0; col < 5; col++) {
    const x = u - w / 2 + width * col;
    for (let row = 0; row < 3; row++) {
      const b = y + (row * h) / 3,
        t = b + h / 3;
      beam(out, 'trim', F.P(x, b, 0.115), F.P(x + width, t, 0.115), 0.041, 0.043, grit);
      beam(out, 'trim', F.P(x + width, b, 0.118), F.P(x, t, 0.118), 0.041, 0.043, grit);
    }
  }
}
function gardenFront(out, F, lod) {
  const n = Math.max(1, Math.round(F.length / 5.0));
  for (let i = 0; i < n; i++) {
    const u = (F.length * (i + 0.5)) / n;
    const x = F.P(u, 0)[0],
      gt = eave(x),
      east = x > 0;
    const w = Math.min(F.length / n - 0.48, east ? 3.63 : 2.23);
    if (w < 0.53) continue;
    openingAt(out, F, u, gt - (east ? 5.78 : 5.81), w, east ? 3.87 : 2.91, lod, {
      bars: east ? 4 : 2,
    });
    if (lod > 0) openingAt(out, F, u, gt - 8.74, Math.min(w * 0.58, 2.08), 2.26, lod, { bars: 1 });
    if (lod === 3 && east && w > 2.4) lattice(out, F, u, gt - 5.68, w - 0.11, 3.64);
  }
}

function perimeter(out, lod) {
  extrude(out, 'stone', outline, foundation, floor, shade, { holes: courts, top: false });
  for (const ring of [outline, ...courts.map((h) => outwardRing(h).reverse())])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        F = wallFace(a, b);
      quad4(
        out,
        'wall',
        [a[0], floor, a[1]],
        [b[0], floor, b[1]],
        [b[0], eave(b[0]), b[1]],
        [a[0], eave(a[0]), a[1]],
        rubble,
      );
      if (ring !== outline) {
        if (lod > 0 && F.length > 4)
          openingAt(out, F, F.length * 0.5, eave(F.P(F.length / 2, 0)[0]) - 4.05, 1.43, 1.95, lod, {
            bars: 2,
          });
        continue;
      }
      crenels(out, F, eave, lod);
      if (F.normal[1] > 0.43 && F.length > 2.5) gardenFront(out, F, lod);
      else if (F.length > 8) {
        const count = Math.round(F.length / 7);
        for (let j = 0; j < count; j++) {
          const u = (F.length * (j + 0.5)) / count,
            x = F.P(u, 0)[0];
          openingAt(out, F, u, eave(x) - 4.2, 1.68, 2.04, lod, { bars: 2 });
          if (lod > 0) openingAt(out, F, u, eave(x) - 8.2, 0.9, 1.31, lod, { bars: 1 });
        }
      }
    }
  roofCap(out, outline, courts, (x) => eave(x) - 0.15);
  roofCap(out, courts[0], [], (x) => 2.12 + clamp((x + 28) / 18) * 1.21, 'stone', shade);
  roofCap(out, courts[1], [], (x) => 5.52 + clamp((x - 3) / 24) * 1.07, 'stone', shade);
}
function tower(out, rect, top, lod, entrance) {
  const [[x0, z1], [x1], [, z0]] = rect;
  extrude(out, 'wall', rect, 3, top, rubble, { top: false });
  roofCap(out, rect, [], () => top - 0.08);
  const plain = () => top;
  for (let i = 0; i < rect.length; i++) {
    const F = wallFace(rect[i], rect[(i + 1) % rect.length]);
    crenels(out, F, plain, lod, 0.46);
    const u = F.length / 2;
    openingAt(out, F, u, top - 3.7, 1.44, 1.81, lod, { bars: 2 });
    if (lod > 0) openingAt(out, F, u, top - 7.11, 1.47, 1.97, lod, { bars: 2 });
  }
  if (!entrance) return;
  const facade = north((x0 + x1) / 2, z0);
  openingAt(out, facade, 0, 0.51, 3.16, 5.91, lod, { head: 'tudor', color: oak });
  if (lod > 0) {
    openingAt(out, facade, 0, top - 10.58, 1.32, 2.0, lod, { bars: 2 });
    fbox(out, 'trim', facade, -1.11, 1.11, top - 5.18, top - 4.51, 0.01, 0.14, grit);
  }
}
function chimney(out, x, z, y, h, w, lod) {
  block(out, 'wall', x - w / 2, x + w / 2, z - w * 0.34, z + w * 0.34, y, y + h, rubble);
  block(
    out,
    'trim',
    x - w * 0.6,
    x + w * 0.6,
    z - w * 0.43,
    z + w * 0.43,
    y + h - 0.23,
    y + h,
    grit,
  );
  if (lod > 1)
    for (const dx of [-w * 0.23, w * 0.23])
      block(
        out,
        'wall',
        x + dx - 0.09,
        x + dx + 0.09,
        z - 0.095,
        z + 0.095,
        y + h - 0.02,
        y + h + 0.29,
        shade,
      );
}

function primaryRanges(out, lod) {
  tower(
    out,
    [
      [-36.97, -20.74],
      [-27.35, -20.74],
      [-27.35, -31.51],
      [-36.97, -31.51],
    ],
    18.17,
    lod,
    true,
  );
  tower(
    out,
    [
      [27.47, -20.33],
      [34.27, -20.33],
      [32.4, -31.25],
      [24.99, -31.25],
    ],
    21.86,
    lod,
    false,
  );
  gableRoof(out, 'roof', [-2.54, -25.4], [-2.54, 7.54], 7.43, 13.13, 17.82, lead, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: rubble,
  });
  gableRoof(out, 'roof', [-35.8, 13.02], [-24.1, 12.22], 6.24, 11.22, 13.73, lead, {
    overhang: 0.22,
    endSlot: 'wall',
    endColor: rubble,
  });
  const x = -32.82,
    z = 9.41;
  const bell = (y, r) => radialRing(y, r, r, 8, [x, z], Math.PI / 8);
  loft(out, 'wall', [bell(9.1, 1.25), bell(15.31, 1.21)], rubble);
  loft(out, 'trim', [bell(15.13, 1.36), bell(15.52, 1.31), bell(16.22, 1.09)], grit);
  const view = facade([x, z + 1.1], [1, 0]);
  openingAt(out, view, 0, 13.13, 0.56, 1.38, lod, { head: 'pointed' });
  for (const [cx, cz, h, w] of [
    [-23, -26, 3.4, 2.03],
    [-15, -28, 3.15, 1.65],
    [-6, -15.55, 5.02, 2.21],
    [-5.77, -6.6, 4.89, 2.0],
    [5.2, -25.2, 3.9, 1.79],
    [30, -8, 4.98, 1.6],
    [38.95, 1.75, 3.07, 1.21],
  ]) {
    chimney(out, cx, cz, eave(cx) - 0.21, h, w, lod);
  }
}
function build(out, lod) {
  perimeter(out, lod);
  primaryRanges(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'haddon-hall-model.mjs';
const camera = [87, 45, 111];
const lookAt = [0, 10, -7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Haddon Hall on its Derbyshire bluff, with two courts, gate tower, chapel, cross-range and the transomed Long Gallery.',
  camera,
  lookAt,
  sunDirection: [34, 47, 27],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The mapped fortified manor footprint.',
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
    { name: 'south-garden-front-and-long-gallery', position: camera, lookAt },
    { name: 'long-gallery-bays-and-parapets', position: [41, 14, 46], lookAt: [17, 10.1, 6] },
    { name: 'gate-tower-and-two-courtyards', position: [-80, 47, -70], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'haddon-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
