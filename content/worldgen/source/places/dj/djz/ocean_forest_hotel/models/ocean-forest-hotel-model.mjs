import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  spire,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  floorSampler,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const grade = floorSampler(read('terrain-grid'));
const cream = rgb('e5d7b9');
const lighter = rgb('e9ddc4');
const stone = rgb('b6a78b');
const contrastingStone = rgb('ccbea0');
const roofGray = rgb('64747a');
const red = rgb('824c42');
const copper = rgb('6f6555');
const black = rgb('3e4748');
const paintedWood = rgb('544d41');
const glass = rgb('59666a');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.09 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};
const wingHalfWidth = plan.dimensions.widthApproxM / 2;
const windowFaces = ([left, right, inland, sea]) => [
  { f: facade([left, sea], [1, 0]), span: right - left, main: true },
  { f: facade([right, inland], [-1, 0]), span: right - left, main: true },
  { f: facade([left, inland], [0, 1]), span: sea - inland, main: false },
  { f: facade([right, sea], [0, -1]), span: sea - inland, main: false },
];
function silhouetteWindow(out, f, u, y, width, high, d = 0.024, tint = glass) {
  const p = (x, h) => f.P(x, h, d);
  quad4(
    out,
    'window',
    p(u - width / 2, y),
    p(u + width / 2, y),
    p(u + width / 2, high),
    p(u - width / 2, high),
    tint,
  );
}
function block(out, bounds, bottom, top, color, slot = 'wall') {
  const [a, b, c, d] = bounds;
  const ring = rect(a, c, b, d);
  extrude(out, slot, ring, bottom, top, color, { top: false });
  cap(out, slot, ring, top, color);
}
function belt(out, [left, right, inland, sea], y, height, projection, color = contrastingStone) {
  const ring = rect(left - projection, inland - projection, right + projection, sea + projection);
  extrude(out, 'trim', ring, y, y + height, color, { top: false });
  cap(out, 'trim', ring, y + height, color);
}
function frameWindow(
  out,
  f,
  u,
  bottom,
  w,
  h,
  detail,
  { arched = false, trim = contrastingStone, tint = glass } = {},
) {
  if (!arched || detail === 0) {
    silhouetteWindow(out, f, u, bottom, w, bottom + h, 0.035, tint);
    if (detail === 2) {
      const p = (x, y) => f.P(x, y, 0.06);
      const left = u - w / 2 - 0.1;
      const right = u + w / 2 + 0.1;
      quad4(
        out,
        'trim',
        p(left, bottom - 0.095),
        p(right, bottom - 0.095),
        p(right, bottom - 0.01),
        p(left, bottom - 0.01),
        trim,
      );
      const y = bottom + h * 0.48;
      quad4(
        out,
        'trim',
        p(left + 0.1, y),
        p(right - 0.1, y),
        p(right - 0.1, y + 0.035),
        p(left + 0.1, y + 0.035),
        paintedWood,
      );
    }
    if (detail === 3) {
      fbox(
        out,
        'trim',
        f,
        u - w / 2 - 0.12,
        u + w / 2 + 0.12,
        bottom - 0.12,
        bottom - 0.016,
        0.012,
        0.13,
        trim,
      );
      fbox(
        out,
        'trim',
        f,
        u - w / 2 - 0.09,
        u + w / 2 + 0.09,
        bottom + h,
        bottom + h + 0.08,
        0.013,
        0.101,
        trim,
      );
      const y = bottom + h * 0.48;
      fbox(out, 'trim', f, u - w / 2, u + w / 2, y, y + 0.039, 0.038, 0.075, paintedWood);
      fbox(out, 'trim', f, u - 0.024, u + 0.024, bottom, bottom + h, 0.037, 0.067, paintedWood);
    }
    return;
  }
  opening(out, f, u, bottom, w, h, {
    head: 'round',
    glassSlot: 'window',
    glass: tint,
    frame: trim,
    frameWidth: detail === 3 ? 0.16 : 0,
    frameDepth: 0.14,
    sill: false,
    transoms: detail === 3 ? 1 : 0,
    d: 0.042,
  });
}
function regularWindows(
  out,
  bounds,
  floors,
  master,
  detail,
  { w = 1.0, h = 1.57, archedTop = false } = {},
) {
  if (detail === 0) return;
  for (const { f, span, main } of windowFaces(bounds)) {
    const number = master[main ? 0 : 1];
    for (const [row, y] of floors.entries()) {
      for (let column = 0; column < number; column++) {
        const center = (span * (column + 1)) / (number + 1);
        frameWindow(out, f, center, y, w, h, detail, {
          arched: archedTop && row === floors.length - 1,
        });
      }
    }
  }
}

function wings(out, detail) {
  const windowCount = [8, 14, 15, 15][detail];
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -wingHalfWidth : 10.5;
    const x1 = side < 0 ? -10.5 : wingHalfWidth;
    const wing = [x0, x1, -11.2, 11.2];
    block(out, wing, -3.9, 0.4, stone, 'stone');
    block(out, wing, 0.39, 16.02, cream);
    belt(out, wing, 3.87, 0.3, 0.2);
    belt(out, wing, 15.47, 0.3, 0.22, lighter);
    belt(out, wing, 16.05, 0.29, 0.24, lighter);
    gableRoof(out, 'roof', [x0 + 0.08, -0.45], [x1 - 0.08, -0.45], 21.1, 15.91, 17.05, roofGray, {
      overhang: 0.025,
      endSlot: 'wall',
      endColor: cream,
    });
    regularWindows(
      out,
      wing,
      [4.95, 7.9, 10.85, 13.8],
      [windowCount, [3, 5, 6, 6][detail]],
      detail,
      { w: 0.89, h: 1.47 },
    );
    const front = facade([x0, 11.2], [1, 0]);
    const back = facade([x1, -11.2], [-1, 0]);
    const wc = detail < 2 ? 7 : 11;
    for (const f of [front, back]) {
      for (let n = 1; n <= wc; n++) {
        const center = ((x1 - x0) * n) / (wc + 1);
        frameWindow(out, f, center, 0.87, 0.96, 2.26, detail, { arched: true, tint: black });
      }
    }
    if (detail === 0) continue;
    for (let i = 0; i < 5; i++) {
      const x = x0 + 6.3 + i * ((x1 - x0 - 12.6) / 4);
      abox(out, 'roof', [x - 0.31, 16.5, -3.15], [x + 0.31, 17.35, -2.55], roofGray);
      if (detail >= 2) abox(out, 'trim', [x - 0.39, 17.31, -3.22], [x + 0.39, 17.46, -2.48], stone);
    }
  }
}

function tower(out, detail) {
  const shoulders = [-15.1, 15.1, -12.85, 12.65];
  const middle = [-11.1, 11.1, -12.3, 12.75];
  const upper = [-8.8, 8.8, -9.4, 9.33];
  const high = [-7.75, 7.75, -8.45, 8.31];
  block(out, shoulders, -3.8, 17.3, cream);
  block(out, [-15.1, -9.3, -11.6, 11.75], 16.8, 23.91, lighter);
  block(out, [9.3, 15.1, -11.6, 11.75], 16.8, 23.91, lighter);
  block(out, middle, 16.93, 25.02, cream);
  block(out, upper, 24.4, 32.93, cream);
  block(out, high, 32.9, 36.45, lighter);
  for (const [unit, h, p] of [
    [shoulders, 15.92, 0.18],
    [middle, 24.49, 0.32],
    [upper, 29.98, 0.18],
    [upper, 32.72, 0.26],
    [high, 36.2, 0.23],
  ]) {
    belt(out, unit, h, 0.32, p, lighter);
  }
  regularWindows(out, shoulders, [4.78, 7.8, 10.78, 13.8], [7, 3], detail, { w: 0.92 });
  regularWindows(out, [-15.1, -9.3, -11.6, 11.75], [18.55, 21.22], [2, 4], detail, {
    w: 0.81,
    h: 1.39,
  });
  regularWindows(out, [9.3, 15.1, -11.6, 11.75], [18.55, 21.22], [2, 4], detail, {
    w: 0.81,
    h: 1.39,
  });
  regularWindows(out, middle, [17.94, 20.72, 23.01], [5, 4], detail, { w: 0.88, h: 1.44 });
  regularWindows(out, upper, [25.96, 28.43, 30.77], [5, 3], detail, {
    w: 0.91,
    h: 1.57,
    archedTop: true,
  });
  regularWindows(out, high, [34.04], [3, 2], detail, { w: 0.89, h: 1.65, archedTop: true });
  gableRoof(out, 'tile', [0, -8.45], [0, 8.31], 15.5, 36.43, 39.4, red, {
    overhang: 0.18,
    endSlot: 'wall',
    endColor: cream,
  });
  for (const sign of [-1, 1]) {
    const f = facade([0, sign * 8.5], [sign, 0]);
    frameWindow(out, f, 0, 36.44, 1.02, 1.44, detail, { arched: true, tint: black });
  }
  const center = [0, -0.33];
  lathe(
    out,
    'trim',
    center,
    [
      [38.55, 0.94, 0.89],
      [39.93, 0.87, 0.83],
      [40.09, 0.57, 0.56],
    ],
    8,
    stone,
  );
  lathe(
    out,
    'roof',
    center,
    [
      [40.05, 0.57, 0.56],
      [41.1, 0.51, 0.49],
      [41.19, 0.38, 0.37],
      [42.44, 0.3, 0.29],
    ],
    8,
    copper,
  );
  spire(out, 'roof', center, 0.33, 8, 42.44, 2.75, copper);
}

function stairApproach(out, width, startZ, depth, riser, count, low = -0.31) {
  for (let i = 0; i < count; i++) {
    const z0 = startZ + (Math.sign(depth) * i * Math.abs(depth)) / count;
    const z1 = startZ + (Math.sign(depth) * (i + 1) * Math.abs(depth)) / count;
    abox(
      out,
      'stone',
      [-width / 2, -2.4, Math.min(z0, z1)],
      [width / 2, low + (count - i) * riser, Math.max(z0, z1)],
      stone,
    );
  }
}
function portico(out, detail, sign) {
  const z = sign * (sign === 1 ? 17.7 : 15.18);
  const high = sign === 1 ? 7.4 : 6.62;
  const base = sign === 1 ? 1.36 : 0.69;
  const depth = sign === 1 ? 6.65 : 4.35;
  const width = sign === 1 ? 16.8 : 17.6;
  const closeZ = z - sign * depth;
  const minZ = Math.min(z, closeZ),
    maxZ = Math.max(z, closeZ);
  block(out, [-width / 2, width / 2, minZ, maxZ], -2.4, base, stone, 'stone');
  if (detail === 0) {
    const end = z + sign * 2.6;
    abox(
      out,
      'stone',
      [-width * 0.37, -2.4, Math.min(z, end)],
      [width * 0.37, base - 0.26, Math.max(z, end)],
      stone,
    );
  } else {
    stairApproach(out, width - 3, z, sign * (sign === 1 ? 3.75 : 2.75), 0.19, sign === 1 ? 8 : 5);
  }
  block(
    out,
    [-width / 2 - 0.18, width / 2 + 0.18, minZ - 0.12, maxZ + 0.12],
    high - 0.54,
    high,
    lighter,
    'trim',
  );
  const columns = detail === 0 ? 4 : 6;
  for (let i = 0; i < columns; i++) {
    const x = (-0.445 + (i * 0.89) / (columns - 1)) * width;
    const atZ = z - sign * 0.57;
    lathe(
      out,
      'trim',
      [x, atZ],
      detail < 2
        ? [
            [base, 0.42, 0.42],
            [high - 0.46, 0.34, 0.34],
          ]
        : [
            [base, 0.49, 0.49],
            [base + 0.21, 0.48, 0.48],
            [base + 0.27, 0.34, 0.34],
            [high - 0.96, 0.29, 0.29],
            [high - 0.8, 0.39, 0.39],
            [high - 0.46, 0.39, 0.39],
          ],
      detail === 0 ? 4 : detail === 1 ? 6 : 10,
      lighter,
    );
  }
  if (detail >= 1) {
    const backdrop = facade([0, sign === 1 ? 12.67 : -12.87], [sign, 0]);
    for (const u of [-5.9, -2.94, 0, 2.94, 5.9]) {
      frameWindow(out, backdrop, u, base + 0.15, 1.67, high - base - 1.12, detail, {
        arched: true,
        tint: black,
      });
    }
  }
  const center = (closeZ + z) / 2;
  gableRoof(
    out,
    sign === 1 ? 'tile' : 'roof',
    [0, minZ],
    [0, maxZ],
    width + 0.36,
    high,
    high + (sign === 1 ? 2 : 1.05),
    sign === 1 ? red : roofGray,
    { overhang: 0.085, endSlot: 'trim', endColor: lighter },
  );
  if (detail >= 1) {
    for (const u of [-0.5, 0.5]) {
      const d = sign * (Math.abs(center) - 1.4);
      abox(
        out,
        'trim',
        [width * u - 0.18, base, d - 0.29],
        [width * u + 0.18, high - 0.5, d + 0.29],
        contrastingStone,
      );
    }
  }
}
function arcades(out, detail) {
  for (const side of [-1, 1]) {
    const left = side < 0 ? -62 : 8.57;
    const right = side < 0 ? -8.57 : 62;
    const f = facade([left, 16.11], [1, 0]);
    const bounds = [left, right, 10.7, 16.07];
    block(out, bounds, -2.8, 4.7, cream);
    belt(out, bounds, 4.19, 0.24, 0.18, lighter);
    belt(out, bounds, 4.67, 0.18, 0.23, lighter);
    const span = right - left;
    const coverage = detail === 0 ? 7 : 12;
    for (let i = 0; i < coverage; i++) {
      const u = 1.25 + ((i + 0.5) * (span - 2.5)) / coverage;
      frameWindow(out, f, u, 0.65, detail < 1 ? 1.7 : 1.89, 2.72, detail, {
        arched: true,
        tint: black,
      });
      if (detail >= 2) {
        fbox(out, 'trim', f, u - 0.155, u + 0.155, 3.22, 3.54, 0.058, 0.16, lighter);
      }
    }
  }
}
function pavilion(out, detail, x, sign) {
  const z = sign * (sign === 1 ? 13.8 : 14.9);
  const half = sign === 1 ? 4.6 : 4.9;
  const y = sign === 1 ? 5.33 : 4.67;
  const main = [x - half, x + half, z - 4.6, z + 4.6];
  block(out, main, -2.65, y, cream);
  belt(out, main, y - 0.48, 0.22, 0.19, lighter);
  const faces = windowFaces(main);
  for (const { f, span } of faces) {
    frameWindow(out, f, span / 2, 0.71, sign === 1 ? 1.6 : 1.01, sign === 1 ? 3.12 : 2.03, detail, {
      arched: true,
      tint: black,
    });
    if (detail >= 2 && sign === 1) {
      for (const u of [span * 0.2, span * 0.8]) {
        fbox(out, 'trim', f, u - 0.19, u + 0.19, 0.41, y - 0.38, 0.004, 0.16, lighter);
      }
    }
  }
  if (sign === 1) {
    const p = [x, z + 1.01];
    lathe(
      out,
      'tile',
      p,
      detail === 0
        ? [
            [y - 0.1, 3.05, 3],
            [y + 1.64, 1.97, 1.92],
            [y + 2.2, 0.05, 0.05],
          ]
        : [
            [y - 0.1, 3.05, 3.0],
            [y + 0.21, 3.01, 2.97],
            [y + 1.03, 2.71, 2.66],
            [y + 1.67, 1.97, 1.92],
            [y + 2.05, 1.07, 1.03],
            [y + 2.2, 0.05, 0.05],
          ],
      detail === 0 ? 6 : detail === 1 ? 10 : 16,
      red,
    );
    for (const end of [-1, 1]) {
      const d = z + end * 4.62;
      const corners = [
        [x - half, y - 0.009, d],
        [x + half, y - 0.009, d],
        [x, y + 1.65, d],
      ];
      tri(out, 'trim', ...(end > 0 ? corners : [corners[1], corners[0], corners[2]]), lighter);
    }
  } else {
    gableRoof(out, 'roof', [x - 4.9, z], [x + 4.9, z], 9.2, y, y + 1.99, roofGray, {
      overhang: 0.22,
      endSlot: 'wall',
      endColor: cream,
    });
  }
}
function build(out, detail) {
  wings(out, detail);
  tower(out, detail);
  arcades(out, detail);
  portico(out, detail, 1);
  portico(out, detail, -1);
  for (const x of [-56.3, 56.3]) {
    pavilion(out, detail, x, 1);
    pavilion(out, detail, x, -1);
  }
  if (detail >= 1) {
    const z = 22.2;
    block(out, [-40.4, 40.4, 12, z], Math.min(-1.5, grade([0, z]) - 0.6), -0.01, stone, 'stone');
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'ocean-forest-hotel-model.mjs';
const camera = [94, 61, 123];
const lookAt = [0, 14, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel-commercial',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1949-01-01',
    validFrom: '1930-02-21',
    validUntil: '1974-09-13',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The pale-fronted 1949 Ocean Forest Hotel, with long five-story wings, a tiered rooftop tower and ocean-facing colonnade.',
  camera,
  lookAt,
  sunDirection: [-38, 53, 71],
  mediumFiContext: {
    scale: 1.7,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'seaside-wings-and-stepped-lantern-tower', position: camera, lookAt },
    { name: 'ocean-portico-and-domed-pavilions', position: [18, 12, 104], lookAt: [0, 12, 11] },
    { name: 'landward-roofs-and-original-entrance', position: [74, 70, -107], lookAt: [0, 13, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ocean-forest-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.73, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on the exact Qualla scans of 1935 and 1949 US public-domain Curt Teich postcards, USDA aerial mapping and native OpenStreetMap controls.',
};
