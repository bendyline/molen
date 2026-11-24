import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cap } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const outline = frame.geometry.outline;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.91 },
  scallop: { slot: 'wall', graph: 'wood_painted_shingle', roughness: 0.93 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84 },
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.93 },
  red: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
};
const butter = rgb('dcba75');
const honey = rgb('cda35e');
const opposite = rgb('e5c888');
const cream = rgb('eae1c4');
const dark = rgb('5d6b67');
const warmWood = rgb('8d674f');
const masonry = rgb('a17358');
const terra = rgb('a35243');
const brick = rgb('a65342');
const porchWood = rgb('a79a7f');
const stainedGlass = ['7d382c', '7c7540', '526681', '7b5839', '4d7362'].map(rgb);

const main = [
  [-9.16, 3.2],
  [-6.39, 3.2],
  [-6.39, 10.42],
  [-5.38, 11.42],
  [-2.53, 11.42],
  [-1.1, 10.05],
  [5.19, 10.05],
  [6.69, 11.95],
  [8.13, 13.19],
  [11.37, 13.19],
  [12.94, 11.9],
  [12.94, -3.0],
  [-9.16, -3.0],
];
const entryBay = [
  [-1.47, 9.71],
  [-1.47, 12.73],
  [-0.33, 14.12],
  [5.58, 14.12],
  [6.91, 12.76],
  [6.91, 9.73],
];
const upperRoom = [
  [0.55, 8.9],
  [0.55, 12.35],
  [1.38, 13.18],
  [4.02, 13.18],
  [4.83, 12.35],
  [4.83, 8.9],
];
const courtRange = [outline[0], outline[1], [-9.298, -1.36], [-2.66, -1.36]];
const eastRange = [[13.312, 0.37], outline[9], outline[10], [6.253, 0.37]];

function shell(out, slot, shape, bottom, top, color, roofed = true) {
  extrude(out, slot, shape, bottom, top, color, { top: false });
  if (!roofed) cap(out, slot, shape, top, color);
}
function faces(shape) {
  const points = outwardRing(shape);
  return points.map((a, i) => wallFace(a, points[(i + 1) % points.length]));
}
function panel(out, slot, f, l, r, b, t, d, color) {
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), color);
}
function strip(out, f, y, h, depth, color = cream) {
  fbox(out, 'trim', f, 0, f.length, y, y + h, -0.09, depth, color);
}
function window(out, f, u, b, w, h, lod, { door = false, stained = false } = {}) {
  const left = u - w / 2,
    right = u + w / 2,
    top = b + h;
  panel(out, door ? 'trim' : 'glass', f, left, right, b, top, 0.026, door ? warmWood : dark);
  if (!lod) return;
  const trim = lod === 3 ? 0.113 : 0.075;
  if (lod === 1) {
    panel(out, 'trim', f, left - trim, left, b, top, 0.057, cream);
    panel(out, 'trim', f, right, right + trim, b, top, 0.057, cream);
    panel(out, 'trim', f, left - trim, right + trim, top, top + 0.09, 0.057, cream);
    return;
  }
  for (const x of [left - trim / 2, right + trim / 2])
    fbox(out, 'trim', f, x - trim / 2, x + trim / 2, b, top, 0.01, 0.112, cream);
  fbox(out, 'trim', f, left - trim, right + trim, b - 0.09, b, 0.013, 0.157, cream);
  fbox(out, 'trim', f, left - trim, right + trim, top, top + 0.1, 0.008, 0.134, cream);
  if (lod < 2) return;
  if (door) {
    panel(out, 'glass', f, left + 0.18, right - 0.18, b + h * 0.39, top - 0.15, 0.041, dark);
    return;
  }
  panel(out, 'trim', f, left, right, b + h * 0.48, b + h * 0.48 + 0.041, 0.043, cream);
  panel(out, 'trim', f, u - 0.024, u + 0.024, b, top, 0.046, cream);
  if (lod === 3 && stained) {
    for (let i = 0; i < 7; i++) {
      const x = left + (i * w) / 7;
      panel(
        out,
        'glass',
        f,
        x + 0.011,
        x + w / 7 - 0.011,
        top - 0.21,
        top - 0.03,
        0.056,
        stainedGlass[i % 5],
      );
    }
  }
}

function roof(out, shape, center, eave, high, inset, color = terra) {
  const order = outwardRing(shape);
  const p = (a, y, k) => [
    center[0] + (a[0] - center[0]) * k,
    y,
    center[1] + (a[1] - center[1]) * k,
  ];
  for (let i = 0; i < order.length; i++) {
    const a = order[i],
      b = order[(i + 1) % order.length];
    quad4(out, 'red', p(a, eave, 1), p(b, eave, 1), p(b, high, inset), p(a, high, inset), color);
  }
  cap(
    out,
    'red',
    order.map((a) => [
      center[0] + (a[0] - center[0]) * inset,
      center[1] + (a[1] - center[1]) * inset,
    ]),
    high,
    color,
  );
}
function cornice(out, shape, y, lod) {
  if (!lod) return;
  for (const f of faces(shape)) {
    strip(out, f, y - 0.16, 0.16, 0.13);
    if (lod >= 2) strip(out, f, y, 0.11, 0.19, honey);
  }
}
function herringbone(out, f, y0, y1, lod) {
  if (lod < 2 || f.length < 0.48) return;
  const count = Math.floor(f.length / 0.34);
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * f.length) / count;
    const y = i % 2 === 0 ? y0 : y0 + 0.09;
    panel(out, 'trim', f, u - 0.019, u + 0.019, y, y1, 0.037, honey);
  }
}

function mainWalls(out, lod) {
  for (const shape of [main, courtRange, eastRange])
    shell(out, 'brick', shape, -0.85, 0.68, masonry);
  shell(out, 'siding', main, 0.64, 7.46, butter, false);
  for (const f of faces(main)) {
    const front = f.normal[1] > 0.3;
    if (f.length < 1.02) continue;
    const bays = Math.max(1, Math.floor(f.length / 2.16));
    const w = f.length / bays;
    if (lod && (front || Math.abs(f.normal[0]) > 0.6)) strip(out, f, 3.59, 0.18, 0.14, opposite);
    for (let j = 0; j < bays; j++) {
      const u = (j + 0.5) * w;
      const dim = Math.min(1.01, w * 0.66);
      window(out, f, u, 1.45, dim, 1.92, lod, { stained: front });
      if (lod || front)
        window(out, f, u, 4.68, dim * 0.9, 1.78, lod, { door: front && f.length > 4.5 && j === 1 });
    }
    if (front) herringbone(out, f, 6.62, 7.19, lod);
  }
  cornice(out, main, 7.49, lod);
  gableRoof(out, 'red', [-5.14, 2.23], [9.21, 2.23], 10.95, 7.48, 11.08, terra, {
    overhang: 0.34,
    endSlot: 'scallop',
    endColor: opposite,
  });
  gableRoof(out, 'red', [4.3, -2.57], [4.3, 11.64], 14.67, 7.51, 11.87, terra, {
    overhang: 0.35,
    endSlot: 'scallop',
    endColor: opposite,
  });
  const rightBay = [
    [5.91, 9.24],
    [5.91, 11.7],
    [7.92, 13.49],
    [11.51, 13.49],
    [13.17, 11.87],
    [13.17, 8.5],
  ];
  roof(out, rightBay, [9.67, 9.81], 7.44, 9.26, 0.27);
  const leftBay = [
    [-6.61, 7.14],
    [-6.61, 10.4],
    [-5.43, 11.72],
    [-2.44, 11.72],
    [-0.95, 10.26],
    [-0.95, 6.98],
  ];
  roof(out, leftBay, [-3.82, 8.46], 7.46, 9.12, 0.24);
}

function rail(out, f, bottom, lod, span) {
  const [left, right] = span ?? [0, f.length];
  if (lod === 0) {
    panel(out, 'trim', f, left, right, bottom + 0.66, bottom + 0.78, 0.024, cream);
    return;
  }
  for (const y of [bottom + 0.07, bottom + 0.72])
    fbox(out, 'trim', f, left, right, y, y + 0.095, 0.027, 0.146, cream);
  const count = Math.max(2, Math.ceil((right - left) / (lod === 3 ? 0.235 : 0.39)));
  for (let i = 0; i < count; i++) {
    const x = left + ((i + 0.5) * (right - left)) / count;
    const r = lod === 3 ? 0.026 : 0.031;
    fbox(out, 'trim', f, x - r, x + r, bottom + 0.15, bottom + 0.72, 0.043, 0.102, cream);
    if (lod === 3 && i % 3 === 0)
      fbox(
        out,
        'trim',
        f,
        x - 0.045,
        x + 0.045,
        bottom + 0.38,
        bottom + 0.52,
        0.041,
        0.11,
        opposite,
      );
  }
}
function stairs(out, c, z, width, bottom, top, steps) {
  const y = (top - bottom) / steps;
  for (let i = 0; i < steps; i++) {
    const dz = (steps - i) * 0.235;
    abox(
      out,
      'trim',
      [c - width / 2, bottom, z - 0.22],
      [c + width / 2, bottom + (i + 1) * y, z + dz],
      porchWood,
      { bottom: false },
    );
  }
}

function porch(out, lod) {
  for (const floor of [0.87, 4.35, 7.36]) {
    shell(out, 'trim', entryBay, floor - 0.17, floor, porchWood, false);
    for (const f of faces(entryBay)) {
      if (f.normal[1] < 0.09 || f.length < 1.25) continue;
      if (floor < 1 && f.normal[1] > 0.85) {
        rail(out, f, floor, lod, [0, 1.39]);
        rail(out, f, floor, lod, [f.length - 1.39, f.length]);
      } else rail(out, f, floor, lod);
    }
  }
  stairs(out, 2.63, 14.06, 3.09, 0.18, 0.88, 4);
  for (const x of [-0.66, 5.98]) {
    const radius = 0.26;
    tower(out, 'brick', [x, 12.96], 0.38, 8, -0.35, 0.88, masonry, { top: false });
    tower(out, 'trim', [x, 12.96], radius, 8, 0.87, 9.15, cream, {
      rotation: Math.PI / 8,
      top: false,
    });
    for (const y of [0.91, 4.14, 7.18, 8.7]) {
      if (lod || y === 0.91)
        tower(out, 'trim', [x, 12.96], radius + 0.08, 8, y, y + 0.23, opposite, {
          rotation: Math.PI / 8,
          top: false,
        });
    }
    if (lod >= 2) {
      for (const dx of [-1, 1]) {
        beam(out, 'trim', [x, 8.36, 12.96], [x + dx * 0.4, 8.71, 12.96], 0.107, 0.112, cream);
        beam(
          out,
          'trim',
          [x + dx * 0.4, 8.71, 12.96],
          [x + dx * 0.7, 8.87, 12.96],
          0.09,
          0.108,
          cream,
        );
      }
    }
  }
  shell(out, 'scallop', upperRoom, 7.4, 9.51, opposite);
  for (const f of faces(upperRoom))
    if (f.normal[1] > 0.3)
      window(out, f, f.length / 2, 7.88, Math.min(1.08, f.length * 0.64), 1.37, lod, {
        stained: true,
      });
  const canopy = [
    [-1.87, 9.62],
    [-1.87, 12.94],
    [-0.45, 14.44],
    [5.67, 14.44],
    [7.38, 12.77],
    [7.38, 9.62],
  ];
  roof(out, canopy, [2.77, 9.95], 9.08, 12.35, 0.15);
  cornice(out, canopy, 9.07, lod);
  if (lod > 1) {
    const f = facade([-0.35, 10.08], [1, 0]);
    window(out, f, 3.02, 0.89, 1.37, 2.47, lod, { door: true });
  }
}

function porteCochere(out, lod) {
  const x0 = -9.27,
    x1 = -5.99,
    z0 = 1.12,
    z1 = 8.48;
  for (const z of [z0, z1]) {
    tower(out, 'trim', [x0, z], 0.147, 8, 0.36, 3.08, cream, { top: false });
    if (lod) tower(out, 'trim', [x0, z], 0.21, 8, 0.37, 0.61, honey, { top: false });
  }
  gableRoof(out, 'red', [x0 - 0.26, 4.78], [x1, 4.78], 7.48, 3.11, 5.73, terra, {
    overhang: 0.25,
    endSlot: 'scallop',
    endColor: opposite,
    ends: [true, false],
  });
  if (!lod) return;
  const f = facade([x0 - 0.3, z0], [0, 1]);
  const p = (u, y) => f.P(u, y, 0.018);
  beam(out, 'trim', p(0, 3.21), p(3.65, 5.66), 0.095, 0.148, cream);
  beam(out, 'trim', p(3.65, 5.66), p(7.32, 3.19), 0.095, 0.148, cream);
  beam(out, 'trim', p(3.65, 3.39), p(3.65, 5.63), 0.078, 0.132, cream);
  if (lod >= 2) {
    const points = roundArch(1.54, 9).map(([u, y]) => p(u + 3.65, 3.2 + y * 0.65));
    for (let i = 1; i < points.length; i++)
      beam(out, 'trim', points[i - 1], points[i], 0.083, 0.12, cream);
  }
}
function rearWing(out, shape, mark, lod) {
  const top = mark < 0 ? 4.43 : 5.1;
  shell(out, 'siding', shape, 0.68, top, butter);
  for (const f of faces(shape)) {
    if (!lod && f.normal[1] >= 0) continue;
    const n = Math.max(1, Math.floor(f.length / 2.63));
    for (let i = 0; i < n; i++)
      window(out, f, ((i + 0.5) * f.length) / n, 1.4, 0.96, 1.85, lod, {
        stained: f.normal[1] < -0.5,
      });
  }
  const x = mark < 0 ? -5.98 : 9.81;
  const z = mark < 0 ? -18.18 : -13.48;
  gableRoof(
    out,
    'red',
    [x, z],
    [x, mark < 0 ? -1.36 : 0.38],
    mark < 0 ? 6.65 : 7.09,
    top,
    top + 2.03,
    terra,
    { overhang: 0.22, endSlot: 'scallop', endColor: opposite },
  );
  cornice(out, shape, top, lod);
}
function chimney(out, x, z, bottom, y, split, lod) {
  const shaft = (x, z, w, d, b, t) =>
    abox(out, 'brick', [x - w / 2, b, z - d / 2], [x + w / 2, t, z + d / 2], brick, {
      bottom: false,
    });
  if (split) {
    shaft(x, z, 1.43, 0.73, bottom, y - 1.23);
    for (const dx of [-0.44, 0.44]) shaft(x + dx, z, 0.57, 0.72, y - 1.25, y);
  } else shaft(x, z, 0.8, 0.69, bottom, y);
  if (!lod) return;
  for (const dx of split ? [-0.44, 0.44] : [0]) {
    shaft(x + dx, z, split ? 0.67 : 0.97, 0.83, y - 0.22, y - 0.038);
    if (lod > 1)
      tower(out, 'red', [x + dx, z], 0.193, 8, y - 0.05, y + 0.28, brick, { top: false });
  }
}
function build(out, lod) {
  mainWalls(out, lod);
  rearWing(out, courtRange, -1, lod);
  rearWing(out, eastRange, 1, lod);
  porch(out, lod);
  porteCochere(out, lod);
  chimney(out, 0.19, 1.98, 7.15, 12.65, true, lod);
  chimney(out, -4.32, 4.65, 7.12, 10.68, false, lod);
  chimney(out, 10.06, -3.97, 5.18, 9.44, false, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'lapham-patterson-house-model.mjs';
const camera = [29, 17, 50];
const lookAt = [1.2, 5.7, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Thomasville’s Lapham–Patterson House, with pale ochre timber siding, polygonal front bays, a three-level open porch and a red roof over the linked rear ranges.',
  camera,
  lookAt,
  sunDirection: [-26, 48, 76],
  mediumFiContext: {
    scale: 1.49,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The mapped Lapham–Patterson House and its two connected ranges.',
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'wood_painted_shingle',
    'brick_flemish',
    'shingle_cedar',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'dawson-street-porch-and-red-roof', position: camera, lookAt },
    { name: 'polygonal-porch-and-bays', position: [-7, 5.3, 32], lookAt: [2, 6.4, 10.2] },
    { name: 'carriage-porch-and-rear-court', position: [-35, 15, -38], lookAt: [1, 5, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lapham-patterson-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.39,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.105, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on firsthand CC0 Qualla sources, public-domain USDA imagery and native USGS terrain, with OpenStreetMap geometry under ODbL.',
};
