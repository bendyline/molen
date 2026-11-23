import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
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
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/kentucky-capitol-building-parts.json', import.meta.url)),
);
const { outline } = frame.geometry;
const { foundation, floor, eave, domeTop } = plan.dimensions;
const limestone = rgb('c0b5a0');
const pale = rgb('cbbfa9');
const granite = rgb('a79c8f');
const patina = rgb('9f9684');
const domeStone = rgb('beb6a6');
const lead = rgb('797e72');
const glass = rgb('54666b');
const bronze = rgb('5d5748');
const shadow = rgb('545046');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.89 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  slate: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  dome: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  door: { slot: 'door', graph: 'metal_bronze_cast', roughness: 0.83 },
};
const mainWalls = outline.map(([x, z]) => [
  x,
  Math.abs(x) < 11.3 && z < -23 ? -21.55 : Math.abs(x) < 10.9 && z > 24 ? 21.81 : z,
]);
const north = (x, z) => facade([x, z], [-1, 0]);
const south = (x, z) => facade([x, z], [1, 0]);
const west = (x, z) => facade([x, z], [0, 1]);
const east = (x, z) => facade([x, z], [0, -1]);

function box(out, slot, x0, x1, z0, z1, lo, hi, color) {
  abox(out, slot, [x0, lo, z0], [x1, hi, z1], color, { bottom: false });
}
function roof(out, ring, y, slot = 'slate', color = lead) {
  const triangles = earcut(ring.flat(), [], 2);
  const at = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3);
    tri(out, slot, at(a), at(c), at(b), color);
  }
}
function band(out, F, u0, u1, low, high, depth = 0.26) {
  fbox(out, 'trim', F, u0, u1, low, high, -0.02, depth, pale);
}
function light(out, F, u, y, w, h, lod, options = {}) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass,
    frame: pale,
    frameWidth: lod === 3 ? 0.1 : 0,
    frameDepth: 0.14,
    d: 0.031,
    sill: lod === 3,
    mullions: lod === 3 ? 1 : 0,
    transoms: lod === 3 ? 1 : 0,
    ...options,
  });
}

function shaft(out, x, z, y1, y2, r, lod) {
  const sides = [5, 8, 10, 14][lod];
  const ring = (h, k) => radialRing(h, r * k, r * k, sides, [x, z], Math.PI / 4);
  loft(out, 'trim', [ring(y1, 1), ring(y2, 0.84)], pale, { cap: false });
  if (lod > 0) {
    box(
      out,
      'trim',
      x - r * 1.2,
      x + r * 1.2,
      z - r * 1.2,
      z + r * 1.2,
      y1 - 0.21,
      y1 + 0.14,
      pale,
    );
    box(
      out,
      'trim',
      x - r * 1.33,
      x + r * 1.33,
      z - r * 0.92,
      z + r * 0.92,
      y2 - 0.05,
      y2 + 0.36,
      pale,
    );
  }
  if (lod !== 3) return;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const dx = r * Math.cos(a),
      dz = r * Math.sin(a);
    beam(
      out,
      'trim',
      [x + dx * 0.985, y1 + 0.26, z + dz * 0.985],
      [x + dx * 0.839, y2 - 0.16, z + dz * 0.839],
      0.05,
      0.047,
      limestone,
    );
  }
}

function mainRanges(out, lod) {
  const low = lod === 0 ? foundation : 5.83;
  if (lod > 0) extrude(out, 'base', outline, foundation, low, granite, { top: false });
  extrude(out, 'wall', mainWalls, low, eave, limestone, { top: false });
  roof(out, mainWalls, eave);
  if (lod === 0) return;
  const outer = outwardRing(mainWalls);
  for (let i = 0; i < outer.length; i++) {
    const F = wallFace(outer[i], outer[(i + 1) % outer.length]);
    if (F.length < 7.2) continue;
    band(out, F, 0.1, F.length - 0.1, 18.68, 19.48, 0.49);
    band(out, F, 0.06, F.length - 0.06, 21.12, 21.82, 0.31);
    if (lod > 1) {
      band(out, F, 0.07, F.length - 0.07, 5.58, 5.88, 0.21);
      band(out, F, 0.09, F.length - 0.09, 8.08, 8.28, 0.17);
    }
    if (
      Math.abs(F.origin[0]) < 15 &&
      F.length > 21 &&
      Math.abs(F.normal[0]) < 0.2 &&
      Math.abs(F.origin[1]) > 18
    )
      continue;
    const count = Math.max(1, Math.round(F.length / 4.27));
    for (let k = 0; k < count; k++) {
      const u = ((k + 0.5) * F.length) / count;
      light(out, F, u, 7.11, 1.58, 3.39, lod);
      light(out, F, u, 12.49, 1.6, 3.36, lod);
      light(out, F, u, 16.43, 1.18, 1.29, lod);
    }
  }
}

function wingColonnade(out, lod) {
  if (lod < 2) return;
  for (const F of [
    north(-29.1, -15.01),
    north(29.7, -14.8),
    south(-28.7, 17.0),
    south(29.32, 16.66),
  ]) {
    const ribCount = 8;
    for (let i = 0; i < ribCount; i++) {
      const u = -12.98 + (25.96 * i) / (ribCount - 1);
      fbox(out, 'trim', F, u - 0.27, u + 0.27, 6.62, 18.35, -0.1, 0.45, limestone);
      if (lod > 1) {
        fbox(out, 'trim', F, u - 0.39, u + 0.39, 6.41, 6.9, -0.07, 0.51, pale);
        fbox(out, 'trim', F, u - 0.43, u + 0.43, 18.04, 18.43, -0.06, 0.55, pale);
      }
    }
  }
}

function ceremonialFront(out, F, lod, span, backDepth, figureRelief) {
  const half = span / 2;
  const plinth = 6.37;
  const arch = 4.22;
  for (let j = 0; j < (lod === 0 ? 1 : 6); j++) {
    const widening = j * 0.16;
    fbox(
      out,
      'base',
      F,
      -half - 2.27 + widening,
      half + 2.27 - widening,
      -0.56,
      floor + (j + 1) * 0.212,
      -0.8,
      4.08 - j * 0.47,
      granite,
    );
  }
  fbox(out, 'base', F, -half, half, plinth - 0.38, plinth + 0.21, -backDepth, 0.35, granite, {
    bottom: true,
  });
  for (const side of [-1, 1])
    fbox(
      out,
      'base',
      F,
      side * half - (side < 0 ? 0 : 2.0),
      side * half + (side < 0 ? 2 : 0),
      floor,
      plinth,
      -backDepth,
      0,
      granite,
    );
  if (lod > 0) {
    for (const u of [-half * 0.59, -half * 0.2, half * 0.2, half * 0.59]) {
      light(out, F, u, 1.25, 2.14, arch, lod, {
        head: 'round',
        glass: shadow,
        glassSlot: 'door',
        d: 0.018,
        sill: false,
      });
    }
    const rearP = F.P(0, 0, -backDepth - 0.012);
    const rear = facade([rearP[0], rearP[2]], F.along);
    for (const u of [-5.94, -2.95, 0, 2.95, 5.94]) {
      light(out, rear, u, 7.29, 1.45, 3.16, lod);
      light(out, rear, u, 12.76, 1.5, 2.76, lod);
    }
  }
  for (let i = 0; i < 6; i++) {
    const [x, , z] = F.P(half * 0.85 * (i / 2.5 - 1), 0, -0.35);
    shaft(out, x, z, plinth + 0.28, 18.38, 0.61, lod);
  }
  fbox(out, 'trim', F, -half - 0.26, half + 0.26, 18.37, 20.14, -backDepth, 0.58, pale, {
    bottom: true,
  });
  band(out, F, -half - 0.45, half + 0.45, 19.73, 20.23, 0.81);
  const a = F.P(0, 0, 0.55),
    b = F.P(0, 0, -backDepth - 0.31);
  gableRoof(out, 'slate', [a[0], a[2]], [b[0], b[2]], span + 1.05, 20.17, 24.44, lead, {
    overhang: 0.08,
    endSlot: 'trim',
    endColor: pale,
  });
  if (!figureRelief || lod < 2) return;
  for (let i = 0; i < 9; i++) {
    const u = (i - 4) * 1.72;
    const h = 0.64 + 1.71 * (1 - Math.abs(u) / 8.3);
    fbox(out, 'trim', F, u - 0.26, u + 0.26, 20.39, 20.39 + h, 0.596, 0.73, patina);
  }
}

function otherRoofs(out, lod) {
  for (const part of parts.filter((o) =>
    ['1457833647', '1457833648', '1457833649', '1457833650'].includes(o.way.id),
  )) {
    if (lod === 0 && Number(part.height) === 26) continue;
    const [x0, x1, z0, z1] = [
      Math.min(...part.local.map((p) => p[0])),
      Math.max(...part.local.map((p) => p[0])),
      Math.min(...part.local.map((p) => p[1])),
      Math.max(...part.local.map((p) => p[1])),
    ];
    const top = Number(part.height);
    const rise = Number(part.tags['roof:height']);
    const lower = top - rise;
    box(out, 'wall', x0, x1, z0, z1, eave - 0.03, lower, limestone);
    const z = (z0 + z1) / 2;
    gableRoof(out, 'slate', [x0, z], [x1, z], z1 - z0, lower, top, lead, {
      overhang: 0.12,
      endSlot: 'wall',
      endColor: limestone,
    });
  }
}

function rotunda(out, lod) {
  const cx = -0.09,
    cz = 0.83;
  const sides = [12, 20, 32, 48][lod];
  const circle = (y, r) => radialRing(y, r, r, sides, [cx, cz]);
  box(out, 'wall', -13.084, 12.93, -12.26, 13.88, eave - 0.02, 29.84, limestone);
  box(out, 'trim', -13.28, 13.15, -12.49, 14.07, 28.97, 29.81, pale);
  const profile = (geometry, slot, color, cap = false) =>
    loft(
      out,
      slot,
      geometry.map(([y, r]) => circle(y, r)),
      color,
      { cap },
    );
  const drum = [
    [29.77, 9.72],
    [31.24, 10.12],
    [32.14, 9.91],
    [41.85, 9.05],
    [42.61, 10.49],
    [43.37, 10.67],
    [44.2, 9.84],
    [46.61, 8.99],
    [47.3, 8.79],
  ];
  profile(
    lod === 0 ? drum.filter((_p, i) => [0, 1, 3, 5, 8].includes(i)) : drum,
    'wall',
    domeStone,
  );
  const columns = [10, 16, 20, 20][lod];
  for (let i = 0; i < columns; i++) {
    const angle = (i * 2 * Math.PI) / columns;
    shaft(out, cx + 9.81 * Math.cos(angle), cz + 9.81 * Math.sin(angle), 32.29, 41.94, 0.4, lod);
    if (lod < 2 || i % 2 !== 0) continue;
    const outer = facade(
      [cx + 9.575 * Math.cos(angle), cz + 9.575 * Math.sin(angle)],
      [Math.sin(angle), -Math.cos(angle)],
    );
    light(out, outer, 0.25, 34.58, 0.62, 4.13, lod, {
      glass: patina,
      frameWidth: 0.06,
      sill: false,
    });
  }
  const shell = [
    [47.28, 8.84],
    [49.4, 8.63],
    [51.8, 8.05],
    [53.91, 6.99],
    [55.75, 5.62],
    [57.26, 4.05],
    [58.79, 2.67],
    [59.16, 1.57],
  ];
  profile(
    lod === 0 ? shell.filter((_p, i) => i === 0 || i === 2 || i === 4 || i === 7) : shell,
    'dome',
    domeStone,
  );
  if (lod > 1) {
    for (let i = 0; i < 16; i++) {
      const theta = (i * Math.PI) / 8;
      const point = ([y, r]) => [
        cx + (r + 0.038) * Math.cos(theta),
        y,
        cz + (r + 0.038) * Math.sin(theta),
      ];
      for (let j = 1; j < shell.length; j++) {
        beam(out, 'dome', point(shell[j - 1]), point(shell[j]), 0.052, 0.036, patina);
      }
    }
  }
  profile(
    [
      [58.99, 1.83],
      [59.23, 1.75],
      [59.69, 1.36],
    ],
    'trim',
    pale,
    true,
  );
  for (let i = 0; i < 8; i++) {
    if (lod === 0 && i % 2 !== 0) continue;
    const theta = (i * Math.PI) / 4;
    shaft(out, cx + 1.19 * Math.cos(theta), cz + 1.19 * Math.sin(theta), 59.65, 63.4, 0.16, lod);
  }
  const crown = [
    [63.39, 1.49],
    [63.74, 1.58],
    [64.1, 1.33],
    [65.01, 0.59],
    [65.19, 0.35],
    [domeTop, 0.13],
  ];
  profile(lod === 0 ? [crown[0], crown[2], crown[5]] : crown, 'trim', pale, true);
}
function build(out, lod) {
  mainRanges(out, lod);
  wingColonnade(out, lod);
  otherRoofs(out, lod);
  ceremonialFront(out, north(0.015, -27.96), lod, 22.18, 6.37, true);
  ceremonialFront(out, south(0.52, 27.96), lod, 20.47, 6.07, false);
  if (lod > 0) {
    for (const F of [west(-62.035, 1.28), east(62.29, 0.3)]) {
      band(out, F, -9.31, 9.31, 19.09, 19.88, 0.49);
      for (const u of [-6, 0, 6])
        light(out, F, u, 5.99, 1.88, 4.45, lod, { head: 'round', sill: false });
    }
  }
  rotunda(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kentucky-state-capitol-model.mjs';
const camera = [-104, 67, -155];
const lookAt = [0, 24, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Kentucky State Capitol in Frankfort with its limestone wings, Ionic north portico, domed drum and lantern.',
  camera,
  lookAt,
  sunDirection: [-55, 64, -93],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.93,
    basis: 'The native Kentucky State Capitol footprint and projecting porticoes.',
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
    { name: 'limestone-wings-and-dome', position: camera, lookAt },
    { name: 'north-portico-and-ionic-columns', position: [-1, 11, -104], lookAt: [0, 24, -9] },
    { name: 'rotunda-ribs-and-lantern', position: [-32, 54, -55], lookAt: [0, 46, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kentucky-state-capitol-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.38,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
