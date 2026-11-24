import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/melrose-house-shape-controls');
const outline = outwardRing(shape.outline);
const front = wallFace(...shape.front);
const west = wallFace(...shape.rightSide);
const east = wallFace(...shape.leftSide);
const eave = shape.estimatedHeights.mainEave;
const parkEdge = shape.front[0][1];
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
  timber: { slot: 'trim', graph: 'metal_painted', roughness: 0.85 },
};
const putty = rgb('d1c2aa');
const chalk = rgb('e3dcc8');
const sill = rgb('b8ab95');
const shade = rgb('ada18b');
const masonry = rgb('7d6254');
const copper = rgb('8c583d');
const porchGreen = rgb('525e54');
const dark = rgb('454c48');
const plinth = rgb('9c9280');

function band(out, f, y, h, d, color = chalk, a = 0, b = f.length) {
  fbox(out, 'trim', f, a, b, y, y + h, -0.1, d, color);
}

function sash(out, f, u, y, w, h, level, { depth = 0.028, arch = false } = {}) {
  if (level === 1) {
    quad4(
      out,
      'window',
      f.P(u - w / 2, y, depth),
      f.P(u + w / 2, y, depth),
      f.P(u + w / 2, y + h, depth),
      f.P(u - w / 2, y + h, depth),
      dark,
    );
    return;
  }
  opening(out, f, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'window',
    frameSlot: 'trim',
    glass: dark,
    frame: chalk,
    d: depth,
    mullions: level === 3 ? 2 : 1,
    transoms: 1,
    frameWidth: 0.106,
    frameDepth: 0.11,
    sill: true,
  });
  if (level === 3 && !arch)
    band(out, f, y + h + 0.16, 0.16, 0.19, chalk, u - w * 0.64, u + w * 0.64);
}

function dutchGable(out, u, halfWidth, peak, level, curved) {
  const shapePoints = curved
    ? [
        [1, 0],
        [0.88, 0.08],
        [0.79, 0.21],
        [0.64, 0.26],
        [0.59, 0.45],
        [0.45, 0.52],
        [0.39, 0.67],
        [0.29, 0.73],
        [0.22, 0.88],
        [0.12, 0.96],
        [0, 1],
      ]
    : [
        [1, 0],
        [0.91, 0.1],
        [0.78, 0.27],
        [0.64, 0.31],
        [0.52, 0.52],
        [0.38, 0.6],
        [0.23, 0.78],
        [0, 1],
      ];
  const base = eave - 0.5,
    rise = peak - base;
  for (let i = 1; i < shapePoints.length; i++) {
    const [a, ya] = shapePoints[i - 1],
      [b, yb] = shapePoints[i];
    const xl = u - a * halfWidth,
      xr = u + a * halfWidth,
      il = u - b * halfWidth,
      ir = u + b * halfWidth;
    const lowY = base + rise * ya,
      upperY = base + rise * yb;
    if (b > 0)
      quad4(
        out,
        'wall',
        front.P(il, lowY, 0.12),
        front.P(ir, lowY, 0.12),
        front.P(ir, upperY, 0.12),
        front.P(il, upperY, 0.12),
        putty,
      );
    tri(
      out,
      'wall',
      front.P(xl, lowY, 0.12),
      front.P(il, lowY, 0.12),
      front.P(il, upperY, 0.12),
      putty,
    );
    tri(
      out,
      'wall',
      front.P(ir, lowY, 0.12),
      front.P(xr, lowY, 0.12),
      front.P(ir, upperY, 0.12),
      putty,
    );
    for (const dir of [-1, 1]) {
      const left = dir < 0 ? [xl, il] : [ir, xr],
        ys = dir < 0 ? [lowY, upperY] : [upperY, lowY];
      const [p, q] = left,
        [h, k] = ys;
      quad4(
        out,
        'trim',
        front.P(p, h - 0.115, 0.25),
        front.P(q, k - 0.115, 0.25),
        front.P(q, k + 0.045, 0.25),
        front.P(p, h + 0.045, 0.25),
        chalk,
      );
      quad4(
        out,
        'trim',
        front.P(q, k + 0.045, -0.32),
        front.P(p, h + 0.045, -0.32),
        front.P(p, h + 0.045, 0.25),
        front.P(q, k + 0.045, 0.25),
        chalk,
      );
    }
  }
  if (level >= 1)
    sash(out, front, u, base + 0.82, 1.32, 1.57, level, { depth: 0.28, arch: !curved });
  if (level >= 2) {
    const [x, , z] = front.P(u, 0, 0.17);
    lathe(
      out,
      'metal',
      [x, z],
      [
        [peak, 0.075, 0.075],
        [peak + 0.24, 0.12, 0.12],
        [peak + 0.47, 0.07, 0.07],
        [peak + 0.8, 0, 0],
      ],
      6,
      porchGreen,
    );
  }
}

function chimney(out, x, z, y, wide, level) {
  abox(
    out,
    'brick',
    [x - wide * 0.5, 7.95, z - 0.49],
    [x + wide * 0.5, y - 0.18, z + 0.49],
    masonry,
  );
  abox(
    out,
    'trim',
    [x - wide * 0.58, y - 0.28, z - 0.59],
    [x + wide * 0.58, y - 0.07, z + 0.59],
    chalk,
  );
  if (level >= 1) {
    for (const off of [-0.27, 0.27])
      lathe(
        out,
        'brick',
        [x + off, z],
        [
          [y - 0.11, 0.146, 0.146],
          [y + 0.47, 0.13, 0.13],
          [y + 0.57, 0.168, 0.168],
        ],
        level === 3 ? 8 : 5,
        masonry,
      );
  }
}

function lantern(out, level) {
  const at = [-0.52, 4.65],
    radius = 1.41;
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i / 8) * 2 * Math.PI;
    return [at[0] + Math.cos(a) * radius, at[1] + Math.sin(a) * radius];
  });
  extrude(out, 'wall', ring, 7.68, 11.0, putty, { top: false });
  lathe(
    out,
    'trim',
    at,
    [
      [10.89, 1.46, 1.46],
      [11.1, 1.55, 1.55],
      [11.23, 1.42, 1.42],
    ],
    8,
    chalk,
  );
  lathe(
    out,
    'roof',
    at,
    [
      [11.15, 1.42, 1.42],
      [11.54, 1.24, 1.24],
      [12.39, 0.83, 0.83],
      [13.11, 0.4, 0.4],
      [13.53, 0.06, 0.06],
    ],
    level === 0 ? 8 : 12,
    copper,
  );
  lathe(
    out,
    'metal',
    at,
    [
      [13.48, 0.065, 0.065],
      [13.85, 0, 0],
    ],
    6,
    porchGreen,
  );
  if (level >= 1) {
    const walls = outwardRing(ring);
    for (let i = 0; i < walls.length; i++) {
      const f = wallFace(walls[i], walls[(i + 1) % walls.length]);
      sash(out, f, f.length * 0.5, 9.58, 0.46, 0.97, level, { arch: true });
    }
  }
}

function bay(out, level) {
  const x0 = -3.9,
    x1 = -0.66,
    z = parkEdge;
  const ring = outwardRing([
    [x0, z - 0.05],
    [x1, z - 0.05],
    [x1 + 0.32, z + 0.5],
    [x1 - 0.29, z + 1.57],
    [x0 + 0.46, z + 1.57],
    [x0 - 0.35, z + 0.49],
  ]);
  extrude(out, 'wall', ring, 0.3, 6.91, putty, { top: false });
  extrude(out, 'trim', ring, 6.88, 7.08, chalk, { top: false });
  fan(
    out,
    'trim',
    ring.map(([x, z]) => [x, 7.08, z]),
    chalk,
  );
  if (level === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (f.origin[1] < z + 0.05 || f.normal[1] < 0.39) continue;
    band(out, f, 4.3, 0.2, 0.125);
    band(out, f, 6.78, 0.15, 0.13);
    const n = f.length > 1.4 ? 3 : 1;
    for (let j = 0; j < n; j++)
      sash(
        out,
        f,
        ((j + 0.5) * f.length) / n,
        4.57,
        Math.min(0.76, f.length / (n + 1)),
        1.96,
        level,
      );
    if (level >= 2) {
      const count = Math.floor(f.length / 0.24);
      for (let j = 1; j <= count; j++) {
        const u = (j * f.length) / (count + 1);
        fbox(out, 'trim', f, u - 0.035, u + 0.035, 4.5, 4.73, 0.07, 0.165, sill);
      }
    }
  }
}

function veranda(out, f, start, end, level) {
  const deck = 0.61,
    depth = 2.54,
    y = shape.estimatedHeights.porchEave;
  fbox(out, 'trim', f, start, end, -0.62, deck, -0.08, depth, plinth);
  quad4(
    out,
    'roof',
    f.P(start - 0.15, y, depth + 0.27),
    f.P(end + 0.15, y, depth + 0.27),
    f.P(end + 0.15, y + 1.06, -0.03),
    f.P(start - 0.15, y + 1.06, -0.03),
    porchGreen,
  );
  fbox(
    out,
    'trim',
    f,
    start - 0.15,
    end + 0.15,
    y - 0.13,
    y + 0.06,
    depth + 0.16,
    depth + 0.28,
    chalk,
  );
  if (level === 0) return;
  const supports = 4,
    span = (end - start) / (supports - 1);
  for (let i = 0; i < supports; i++) {
    const u = start + i * span;
    fbox(out, 'timber', f, u - 0.09, u + 0.09, deck, y - 0.02, depth - 0.13, depth + 0.05, chalk);
    fbox(out, 'trim', f, u - 0.16, u + 0.16, deck, deck + 0.22, depth - 0.2, depth + 0.11, sill);
    fbox(
      out,
      'timber',
      f,
      u - 0.14,
      u + 0.14,
      y - 0.28,
      y - 0.13,
      depth - 0.18,
      depth + 0.09,
      chalk,
    );
    if (level >= 2 && i < supports - 1) {
      fbox(
        out,
        'metal',
        f,
        u + 0.12,
        u + span - 0.12,
        deck + 0.64,
        deck + 0.7,
        depth - 0.1,
        depth - 0.03,
        chalk,
      );
      for (let j = 1; j <= 8; j++) {
        const at = u + (j * span) / 9;
        fbox(
          out,
          'metal',
          f,
          at - 0.021,
          at + 0.021,
          deck,
          deck + 0.64,
          depth - 0.085,
          depth - 0.051,
          chalk,
        );
      }
      if (level === 3) {
        for (const [x, dx] of [
          [u, 1],
          [u + span, -1],
        ])
          tri(
            out,
            'metal',
            f.P(x + dx * 0.11, y - 0.17, depth - 0.01),
            f.P(x + dx * 0.11, y - 0.83, depth - 0.01),
            f.P(x + dx * 0.63, y - 0.17, depth - 0.01),
            chalk,
          );
      }
    }
  }
}

function wallDetails(out, level) {
  for (let i = 0; i < outline.length; i++) {
    const f = wallFace(outline[i], outline[(i + 1) % outline.length]);
    band(out, f, 0.28, 0.23, 0.16, plinth);
    band(out, f, 3.43, 0.17, 0.13, sill);
    band(out, f, eave - 0.2, 0.19, 0.23);
    if (level === 0 || f.length < 3.5 || f.normal[1] > 0.95) continue;
    const count = Math.max(1, Math.round(f.length / 3.33));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * f.length) / count;
      sash(out, f, u, 0.91, 1.18, 2.14, level, { arch: j % 3 === 1 });
      sash(out, f, u, 4.23, 1.24, 1.99, level);
    }
  }
  if (level === 0) return;
  for (const u of [3.2, 7.58, 15.53, 20.8, 24.5]) {
    sash(out, front, u, 4.29, 1.43, 2.16, level);
    if (u !== 15.53) sash(out, front, u, 1.05, 1.37, 2.22, level, { arch: u > 20 });
  }
  opening(out, front, 16.4, 0.44, 1.9, 2.73, {
    head: 'round',
    glassSlot: 'timber',
    frameSlot: 'trim',
    glass: porchGreen,
    frame: chalk,
    d: 0.09,
    frameWidth: 0.17,
    mullions: 1,
    sill: false,
  });
  for (let i = 0; i < 4; i++) {
    const depth = 0.4 + (4 - i) * 0.24;
    fbox(out, 'trim', front, 15.1, 17.69, -0.49, 0.09 + i * 0.14, 0.06, depth, plinth);
  }
  if (level >= 2) {
    for (const u of [0.3, 5.3, 14.06, 19.23, 26.91])
      for (let j = 0; j < 12; j++)
        band(
          out,
          front,
          0.68 + j * 0.52,
          0.25,
          j % 2 === 0 ? 0.17 : 0.135,
          chalk,
          u - 0.25,
          u + 0.25,
        );
  }
}

function build(out, level) {
  extrude(out, 'wall', outline, -1.15, eave, putty, { top: false });
  gableRoof(
    out,
    'roof',
    [-13.76, 0.41],
    [13.73, 0.41],
    19.42,
    eave,
    shape.estimatedHeights.mainRidge,
    copper,
    {
      overhang: 0.28,
      endSlot: 'wall',
      endColor: putty,
    },
  );
  gableRoof(out, 'roof', [-8.13, parkEdge], [-8.13, 0.45], 8.44, eave, 9.63, copper, {
    overhang: 0.12,
  });
  gableRoof(out, 'roof', [7.42, parkEdge], [7.42, 0.41], 8.66, eave, 10.62, copper, {
    overhang: 0.12,
  });
  gableRoof(out, 'roof', [0.03, -11.76], [0.03, 0.41], 11.24, eave, 10.66, copper, {
    overhang: 0.16,
    endSlot: 'wall',
    endColor: putty,
    ends: [true, false],
  });
  wallDetails(out, level);
  dutchGable(out, 5.63, 4.91, 9.97, level, true);
  dutchGable(out, 21.18, 4.78, 11.16, level, false);
  lantern(out, level);
  chimney(out, -11.11, 1.93, 10.78, 1.22, level);
  chimney(out, -4.05, -2.8, 10.14, 1.06, level);
  chimney(out, 9.99, -4.42, 11.0, 1.15, level);
  bay(out, level);
  veranda(out, west, 2.71, 16.63, level);
  veranda(out, east, 1.44, 7.54, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'melrose-house-model.mjs';
const camera = [31.5, 20, 46],
  lookAt = [0, 5.4, 1.1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
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
    'The park-facing Victorian mansion with paired shaped Dutch gables, a pointed turret, brick chimneys, glazed bay and side verandas.',
  camera,
  lookAt,
  sunDirection: [-39, 48, 22],
  mediumFiContext: {
    scale: 1.05,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Suppress the mapped historical house within the wider museum property.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'burgers-park-gables', position: [-17, 10, 32], lookAt: [0, 6.2, 10] },
    { name: 'west-veranda-and-stonework', position: [23, 6.3, 6], lookAt: [13, 2.7, 0.8] },
    { name: 'rear-wing-and-roof', position: [14, 18, -27], lookAt: [0, 6, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'melrose-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.43,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.5, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
};
