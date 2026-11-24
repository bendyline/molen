import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
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
const { foundation, floor, bodyEave, eastTower, westTower } = plan.dimensions;
const outline = outwardRing(frame.geometry.outline),
  courts = frame.geometry.holes;
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
};
const stone = rgb('bda98f');
const pale = rgb('d0b99b');
const base = rgb('9c8b78');
const roof = rgb('8f756a');
const glazing = rgb('57575a');
const dark = rgb('4b4238');
const iron = rgb('4a4c46');

function cap(out, outer, holes, y, slot, color) {
  const points = outer.concat(...holes),
    starts = [];
  let size = outer.length;
  for (const ring of holes) {
    starts.push(size);
    size += ring.length;
  }
  const triangles = earcut(points.flat(), starts);
  const p = (index) => [points[index][0], y, points[index][1]];
  for (let i = 0; i < triangles.length; i += 3)
    tri(out, slot, p(triangles[i]), p(triangles[i + 2]), p(triangles[i + 1]), color);
}

function moulding(out, F, x0, x1, y, h, d = 0.28) {
  fbox(out, 'trim', F, x0, x1, y - h, y, -0.01, d, pale);
}
function light(
  out,
  F,
  u,
  y,
  w,
  h,
  lod,
  { head = 'flat', color = glazing, depth = 0.06, mullions = 0 } = {},
) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: pale,
    head,
    d: depth,
    frameWidth: lod === 3 || (lod === 2 && head === 'flat') ? 0.15 : 0,
    frameDepth: 0.19,
    sill: lod > 1 && head === 'flat',
    mullions: lod > 1 ? mullions : 0,
    transoms: lod === 3 && w > 0.8 ? 1 : 0,
  });
}

function gallery(out, F, from, to, period, lod) {
  const n = Math.ceil((to - from) / period);
  for (let i = 0; i < n; i++) {
    if (lod === 0 && i % 2 !== 0) continue;
    const u = from + ((to - from) * (i + 0.5)) / n;
    light(out, F, u, 16.19, 0.73, 1.67, lod, { head: lod > 1 ? 'round' : 'flat', color: dark });
    if (lod > 1) moulding(out, F, u + 0.38, u + 0.51, 17.37, 1.08, 0.15);
  }
}
function gothicWindow(out, F, u, y, w, lod) {
  if (lod < 2) {
    light(out, F, u, y, w, 4.2, lod, { head: lod === 0 ? 'flat' : 'pointed' });
    return;
  }
  for (const shift of [-0.51, 0, 0.51])
    light(out, F, u + (w * shift) / 1.6, y, 0.43, 4.17, lod, { head: 'pointed' });
  moulding(out, F, u - w * 0.69, u + w * 0.69, y + 4.29, 0.13, 0.21);
  moulding(out, F, u - w * 0.69, u + w * 0.69, y, 0.2, 0.29);
}

function centralBody(out, lod) {
  extrude(out, 'base', outline, foundation, floor, base, { holes: courts, top: false });
  extrude(out, 'ashlar', outline, floor, bodyEave, stone, { holes: courts, top: false });
  cap(out, outline, courts, bodyEave, 'roof', roof);
  for (let i = 0; i < outline.length; i++) {
    const F = wallFace(outline[i], outline[(i + 1) % outline.length]);
    const outside = F.normal[1];
    moulding(out, F, 0, F.length, bodyEave + 0.08, 0.25, 0.31);
    if (Math.abs(outside) < 0.75 || F.length < 6) continue;
    quad4(
      out,
      'roof',
      F.P(0, bodyEave + 0.08, 0.37),
      F.P(F.length, bodyEave + 0.08, 0.37),
      F.P(F.length, bodyEave + 0.74, -2.55),
      F.P(0, bodyEave + 0.74, -2.55),
      roof,
    );

    const gate = outside > 0.75 && F.origin[0] < 1 && F.origin[0] + F.along[0] * F.length > 1;
    const gateU = F.length * 0.47;
    if (gate) {
      const u = gateU;
      light(out, F, u, 0.54, 3.38, 6.35, lod, { head: 'round', color: dark });
      if (lod > 0) moulding(out, F, u - 2.1, u + 2.1, 7.17, 0.25, 0.29);
    }
    const bodyRange = [-22.1, 12.14]
      .map((x) => (x - F.origin[0]) / F.along[0])
      .sort((a, b) => a - b);
    const [from, to] = [Math.max(0.17, bodyRange[0]), Math.min(F.length - 0.16, bodyRange[1])];
    if (to - from > 0.8) gallery(out, F, from, to, 1.16, lod);

    const count = Math.max(1, Math.round(F.length / 4.3));
    for (let j = 0; j < count; j++) {
      const u = (F.length * (j + 0.5)) / count;
      if (F.origin[0] + F.along[0] * u > 12.4 || F.origin[0] + F.along[0] * u < -22.55) continue;
      gothicWindow(out, F, u, 9.37, 1.78, lod);
      if (!gate || Math.abs(u - gateU) > 2.43)
        light(out, F, u, 2.07, 1.15, 2.58, lod, { mullions: 1 });
    }
  }
}

function crest(out, F, span, y, lod) {
  if (lod === 0) {
    moulding(out, F, -span, span, y + 1.24, 1.14, 0.28);
    fbox(out, 'trim', F, -0.15, 0.15, y + 1.18, y + 2.43, 0, 0.27, pale);
    return;
  }
  moulding(out, F, -span, span, y + 0.19, 0.27, 0.27);
  moulding(out, F, -span, span, y + 1.24, 0.15, 0.31);
  const count = Math.round((span * 2) / (lod === 0 ? 3.0 : lod === 1 ? 2.2 : 0.49));
  for (let i = 0; i <= count; i++) {
    const u = -span + (i * span * 2) / count;
    const dx = lod < 2 ? 0.067 : 0.084;
    fbox(out, 'trim', F, u - dx, u + dx, y + 0.18, y + 1.2, 0.01, 0.22, pale);
  }
  for (const u of [-span, 0, span]) {
    fbox(out, 'trim', F, u - 0.15, u + 0.15, y + 1.19, y + 1.94, 0.01, 0.28, pale);
    const p = F.P(u, y + 2.43, 0.17);
    const points = [
      F.P(u - 0.19, y + 1.9, -0.01),
      F.P(u + 0.19, y + 1.9, -0.01),
      F.P(u + 0.19, y + 1.9, 0.34),
      F.P(u - 0.19, y + 1.9, 0.34),
    ];
    for (let i = 0; i < 4; i++) tri(out, 'trim', points[(i + 1) % 4], points[i], p, pale);
  }
}
function tower(out, side, lod) {
  const eastSide = side === 1;
  const x0 = eastSide ? 12.31 : -33.03,
    x1 = eastSide ? 22.53 : -21.95;
  const z0 = eastSide ? -8.23 : -10.55,
    z1 = eastSide ? 10.98 : 10.6;
  const top = (eastSide ? eastTower : westTower) - 2.43;
  const ring = [
    [x0, z1],
    [x1, z1],
    [eastSide ? 23.15 : x1, z0],
    [x0, z0],
  ];
  extrude(out, 'ashlar', ring, bodyEave - 0.11, top, stone, { top: false });
  cap(out, ring, [], top, 'trim', pale);
  for (const [i, ordinal] of (eastSide ? [1, 0, 2, 3] : [3, 0, 2, 1]).entries()) {
    const edge = wallFace(ring[ordinal], ring[(ordinal + 1) % 4]);
    const half = edge.length / 2;
    const middle = edge.P(half, 0);
    const F = facade([middle[0], middle[2]], edge.along);
    for (const y of lod > 0 ? [21.57, 22.77, top - 0.71] : [22.77])
      moulding(out, F, -half, half, y, 0.28, y > 22 ? 0.41 : 0.28);
    crest(out, F, half, top, lod);
    if (lod === 0 && i > 1) continue;
    for (const u of [-half * 0.62, 0, half * 0.62]) {
      light(out, F, u, 23.57, 1.1, 2.76, lod, { mullions: 1 });
      if (i > 2) continue;
      light(out, F, u, 16.73, 0.87, 2.39, lod);
      if (i !== 0) continue;
      light(out, F, u, 8.21, 1.43, 4.25, lod, { mullions: 1 });
      if (lod > 0) {
        const Y = 12.63;
        tri(
          out,
          'trim',
          F.P(u - 1.04, Y, 0.19),
          F.P(u + 1.04, Y, 0.19),
          F.P(u, Y + 0.61, 0.25),
          pale,
        );
        moulding(out, F, u - 1.09, u + 1.09, Y + 0.075, 0.11);
        light(out, F, u, 4.12, 1.08, 1.94, lod);
      }
    }
    if (eastSide && i === 0) {
      const rail = 8.35;
      fbox(out, 'trim', F, -3.17, 3.17, rail - 0.27, rail, 0, 1.16, pale);
      for (const y of [rail + 0.18, rail + 1.07])
        fbox(out, 'iron', F, -3.14, 3.14, y - 0.04, y, 1.07, 1.14, iron);
      if (lod > 1)
        for (let j = -7; j <= 7; j++) {
          const u = j * 0.441;
          fbox(out, 'iron', F, u - 0.026, u + 0.026, rail + 0.18, rail + 1.07, 1.07, 1.14, iron);
        }
    }
  }
}
function courtyards(out, lod) {
  for (const ring of courts) {
    cap(out, ring, [], floor, 'base', base);
    if (lod === 0) continue;
    const inner = outwardRing(ring).reverse();
    for (let i = 0; i < inner.length; i++) {
      const F = wallFace(inner[i], inner[(i + 1) % inner.length]);
      const w = F.length / 3;
      for (let j = 0; j < 3; j++) {
        light(out, F, (j + 0.5) * w, 2.13, 1.25, 4.78, lod, {
          head: lod === 1 ? 'flat' : 'pointed',
          color: dark,
        });
        light(out, F, (j + 0.5) * w, 10.16, 0.95, 3.16, lod, {
          head: lod === 1 ? 'flat' : 'pointed',
        });
      }
      moulding(out, F, 0, F.length, 8.2, 0.2);
    }
  }
  if (lod < 2) return;
  const stairs = facade([3.19, 3.52], [1, 0]);
  for (let i = 0; i < 18; i++) {
    const u = i * 0.39,
      y = floor + (i + 1) * 0.271;
    fbox(out, 'base', stairs, u, u + 0.4, floor, y, -1.89, 0, base);
    fbox(out, 'trim', stairs, u + 0.07, u + 0.18, y, y + 0.81, -1.95, -1.86, pale);
  }
  beam(
    out,
    'trim',
    stairs.P(0, floor + 1.03, -1.89),
    stairs.P(7.01, floor + 5.78, -1.89),
    0.18,
    0.17,
    pale,
  );
}
function build(out, lod) {
  centralBody(out, lod);
  tower(out, -1, lod);
  tower(out, 1, lod);
  courtyards(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'palace-of-the-generalitat-valenciana-model.mjs';
const camera = [65, 26, 59];
const lookAt = [-2, 13, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Palau de la Generalitat in València, with the old and new stone towers, Gothic street frontage, and two courtyards.',
  camera,
  lookAt,
  sunDirection: [44, 45, 26],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The mapped footprint of the old and new palace ranges.',
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
    { name: 'old-tower-and-cavallers', position: camera, lookAt },
    { name: 'plaza-balcony-and-balustrade', position: [44, 13, 2], lookAt: [20, 14.6, 1] },
    { name: 'new-tower-and-open-courtyards', position: [-56, 44, -43], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'generalitat-palace-' + reviewLod,
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
