/** The two grades and cement ornament of Horodecki House, Kyiv, in 2008. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireWorldgen('earcut');
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const dim = plan.dimensions;
const outline = frame.geometry.polygons[0];
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    body: 'aba89e',
    light: 'b9b4a8',
    dark: '918b7d',
    low: '9a948b',
    cement: 'b1a99b',
    figure: 'b7b1a4',
    shadow: '82796b',
    roof: '6f716c',
    glass: '4d5454',
    blue: '6e7779',
    door: '655344',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const at = (p, y) => [p[0], y, p[1]];
const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const negativeWinding =
  outline.reduce((s, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) < 0;
const top = dim.wallTop;
const rect = (out, slot, x0, x1, y0, y1, z, tint) => {
  if (x1 > x0 + 0.001 && y1 > y0 + 0.001)
    face(
      out,
      slot,
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      tint,
    );
};
function flat(out, ring, y, tint) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const [a, b, c] = ids.slice(i, i + 3).map((j) => ring[j]);
    const vertices = area(a, b, c) < 0 ? [a, b, c] : [a, c, b];
    triangle(
      out,
      'roof',
      vertices.map((p) => at(p, y)),
      tint,
    );
  }
}

function opening(out, a, b, low, high, lod, tint) {
  if (lod === 1) {
    rect(out, 'inset', a, b, low, high, 0.014, tint);
    return;
  }
  const depth = -0.26;
  rect(out, 'inset', a, b, low, high, depth, tint);
  face(
    out,
    'trim',
    [
      [a, low, depth],
      [b, low, depth],
      [b, low, 0],
      [a, low, 0],
    ],
    color.cement,
  );
  face(
    out,
    'trim',
    [
      [a, low, 0],
      [a, low, depth],
      [a, high, depth],
      [a, high, 0],
    ],
    color.dark,
  );
  face(
    out,
    'trim',
    [
      [b, low, depth],
      [b, low, 0],
      [b, high, 0],
      [b, high, depth],
    ],
    color.light,
  );
  face(
    out,
    'trim',
    [
      [a, high, 0],
      [b, high, 0],
      [b, high, depth],
      [a, high, depth],
    ],
    color.shadow,
  );
  if (lod > 2) {
    box(out, 'trim', [a - 0.14, low - 0.14, -0.04], [b + 0.14, low + 0.02, 0.14], color.light);
    const cx = (a + b) / 2,
      h = low + (high - low) * 0.68;
    rect(out, 'trim', cx - 0.037, cx + 0.037, low, high, depth + 0.017, color.dark);
    rect(out, 'trim', a, b, h, h + 0.06, depth + 0.019, color.light);
  }
}

function windowBand(out, width, count, y, height, band, lod, tint, door = false) {
  rect(out, 'concrete', 0, width, band, y, 0, tint);
  const gap = width / (count + 1);
  let edge = 0;
  for (let i = 1; i <= count; i++) {
    const cx = gap * i;
    const w = (door ? 1.11 : 0.95) * Math.min(1.55, gap * 0.7);
    const a = cx - w / 2,
      b = cx + w / 2;
    if (lod > 1) rect(out, 'concrete', edge, a, y, y + height, 0, tint);
    opening(
      out,
      a,
      b,
      y,
      y + height,
      lod,
      door ? color.door : i % 3 === 1 ? color.blue : color.glass,
    );
    edge = b;
  }
  if (lod > 1) rect(out, 'concrete', edge, width, y, y + height, 0, tint);
  return y + height;
}

function trimBands(out, span, levels, lod) {
  if (!lod) return;
  if (lod === 1) {
    for (const y of levels) rect(out, 'trim', 0, span, y - 0.12, y + 0.14, 0.033, color.light);
    return;
  }
  for (const y of levels) {
    box(out, 'trim', [0, y - 0.12, -0.018], [span, y + 0.14, 0.17], color.light);
  }
}

function edgeWall(out, i, lod) {
  const p = outline[i],
    q = outline[(i + 1) % outline.length];
  const [a, b] = negativeWinding ? [p, q] : [q, p];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const wall = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const westFront = i === 9,
    rightFront = i === 7;
  const high = westFront ? dim.westernFrontParapet : top;
  const downhill = (p[1] + q[1]) / 2 < 11.5;
  const wallColor = downhill ? color.low : color.body;
  if (lod < 2 || len < 2.8) rect(wall, 'concrete', 0, len, dim.footing, high, 0, wallColor);
  if (lod && len >= 2.8) {
    const n = westFront || rightFront ? 3 : Math.max(1, Math.round(len / (lod === 1 ? 5.4 : 3.75)));
    const lower = downhill ? dim.lowerFloors : [];
    const floors = [...lower, ...dim.upperFloors];
    let band = dim.footing;
    for (const [j, y] of floors.entries()) {
      const height = y < 0 ? 1.85 : j === lower.length ? 2.46 : 2.67;
      const lowerEdge = lod === 1 ? y : band;
      band = windowBand(wall, len, n, y, height, lowerEdge, lod, wallColor, rightFront && j === 0);
    }
    if (lod > 1) rect(wall, 'concrete', 0, len, band, high, 0, wallColor);
    trimBands(wall, len, [0.55, 4.33, 8.28, high - 0.42], lod);
    if (lod > 1 && downhill) trimBands(wall, len, [-6.99, -3.55], lod);
  }
  box(wall, 'trim', [-0.025, high - 0.38, -0.36], [len + 0.025, high - 0.04, 0.185], color.cement);
  if (lod > 2 && len > 5)
    for (let j = 1; j <= Math.floor(len / 0.85); j++) {
      const x = j * 0.8;
      box(
        wall,
        'trim',
        [x - 0.086, high - 0.67, 0.012],
        [x + 0.086, high - 0.4, 0.112],
        color.cement,
      );
    }
}

function pilaster(out, x, z, base, y, width, lod) {
  const radius = width / 2;
  box(
    out,
    'trim',
    [x - radius - 0.16, base, z - radius - 0.1],
    [x + radius + 0.16, base + 0.34, z + radius + 0.1],
    color.light,
  );
  if (!lod)
    box(
      out,
      'trim',
      [x - radius, base + 0.3, z - radius],
      [x + radius, y - 0.31, z + radius],
      color.cement,
    );
  else
    loft(
      out,
      'trim',
      [
        radialRing(base + 0.29, radius, radius, lod > 1 ? 14 : 7, [x, z]),
        radialRing(y - 0.41, radius * 0.85, radius * 0.85, lod > 1 ? 14 : 7, [x, z]),
      ],
      color.light,
      { cap: false },
    );
  box(
    out,
    'trim',
    [x - radius - 0.19, y - 0.4, z - radius - 0.12],
    [x + radius + 0.19, y, z + radius + 0.17],
    color.cement,
  );
  if (lod > 1)
    for (const side of [-1, 1])
      sphere(
        out,
        'trim',
        [x + side * radius * 0.75, y - 0.46, z + radius * 0.76],
        [radius * 0.56, radius * 0.66, radius * 0.63],
        color.figure,
        7,
        4,
      );
}

function mermaid(out, x, z, y, scale, facing, lod) {
  const m = transform(out, facing, [x, y, z]);
  const n = [5, 7, 9, 12][lod],
    s = (a) => a * scale;
  const r = (h, x, z, dx, dz) => radialRing(s(h), s(dx), s(dz), n, [s(x), s(z)]);
  loft(
    m,
    'trim',
    [
      r(0.03, -0.16, 0.01, 0.45, 0.45),
      r(0.37, 0.23, 0.36, 0.33, 0.26),
      r(0.84, 0.32, 0.28, 0.24, 0.22),
      r(1.3, 0.04, 0.02, 0.27, 0.22),
      r(1.68, -0.08, -0.03, 0.29, 0.21),
      r(1.91, -0.06, -0.015, 0.15, 0.13),
    ],
    color.figure,
  );
  const head = [s(-0.06), s(2.1), 0];
  if (lod) sphere(m, 'trim', head, [s(0.22), s(0.29), s(0.21)], color.figure, n, lod > 1 ? 5 : 3);
  else box(m, 'trim', [s(-0.2), s(1.89), s(-0.14)], [s(0.08), s(2.32), s(0.14)], color.figure);
  if (lod) {
    const hand = [s(0.48), s(2.58), s(0.14)];
    const bend = [s(0.35), s(1.98), s(0.19)];
    beam(m, 'trim', [s(0.12), s(1.68), s(0.02)], bend, s(0.15), s(0.15), color.figure);
    beam(m, 'trim', bend, hand, s(0.11), s(0.11), color.figure);
    beam(
      m,
      'trim',
      [s(-0.26), s(1.62), s(0.06)],
      [s(-0.54), s(1.15), s(0.44)],
      s(0.14),
      s(0.14),
      color.figure,
    );
  }
  if (lod > 1) {
    const start = [s(0.28), s(0.33), s(0.34)];
    beamPath(
      m,
      'trim',
      [start, [s(0.8), s(0.42), s(0.42)], [s(1.06), s(0.83), s(0.31)]],
      s(0.23),
      s(0.21),
      color.cement,
    );
  }
}

function creature(out, x, z, y, lod, turned = false) {
  const m = transform(out, turned ? Math.PI : 0, [x, y, z]);
  if (lod < 2) {
    box(m, 'trim', [-0.3, 0, -0.35], [0.31, 0.44, 0.27], color.figure);
    return;
  }
  const facets = lod === 2 ? 6 : 9;
  sphere(m, 'trim', [0, 0.24, 0], [0.35, 0.28, 0.39], color.figure, facets, 3);
  sphere(m, 'trim', [0, 0.43, 0.31], [0.23, 0.2, 0.21], color.figure, facets, 3);
  if (lod > 2)
    for (const side of [-1, 1]) {
      beam(
        m,
        'trim',
        [side * 0.2, 0.27, -0.06],
        [side * 0.45, 0.08, 0.21],
        0.16,
        0.16,
        color.figure,
      );
      sphere(m, 'trim', [side * 0.126, 0.54, 0.42], [0.065, 0.074, 0.066], color.cement, 6, 3);
    }
}

function crest(out, a, b, y, lod, flip = false) {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], y, a[1]]);
  const n = Math.max(2, Math.ceil(span / 1.58));
  for (let j = 0; j < n; j++) {
    const x = ((j + 0.5) * span) / n;
    if (lod < 2 && j % 2) continue;
    creature(m, x, 0.025, 0, lod, flip);
    if (lod > 2 && j % 2 === 0)
      sphere(m, 'trim', [x, 0.11, 0.24], [0.47, 0.13, 0.13], color.figure, 8, 3);
  }
}

function portico(out, lod) {
  const z = 21.51,
    x0 = -2.52,
    x1 = 8.02,
    roof = dim.porticoCanopy;
  const start = dim.mainEntry;
  box(out, 'concrete', [x0, start - 0.29, 18.4], [x1, start + 0.02, z + 1.13], color.light);
  for (const x of [-2.15, 1.03, 4.54, 7.26])
    pilaster(out, x, z, start, roof - 0.16, lod ? 0.61 : 0.78, lod);
  box(
    out,
    'trim',
    [x0 - 0.14, roof - 0.42, 18.49],
    [x1 + 0.18, roof + 0.02, z + 0.57],
    color.light,
  );
  box(out, 'roof', [x0 - 0.16, roof + 0.01, 18.44], [x1 + 0.19, roof + 0.22, z + 0.68], color.roof);
  rect(out, 'timber', 0.49, 3.15, start + 0.06, start + 3.13, 20.27, color.door);
  if (lod) crest(out, [x0 - 0.03, z + 0.29], [x1 + 0.04, z + 0.29], roof + 0.21, lod);
  const count = [2, 4, 7, 8][lod];
  for (let i = 0; i < count; i++)
    box(
      out,
      'trim',
      [0.06 - i * 0.14, -0.49, z + 1.12 + i * 0.29],
      [3.85 + i * 0.14, start - i * 0.16, z + 1.42 + i * 0.29],
      color.cement,
    );
}

function bankova(out, lod) {
  const left = -13.8,
    right = -3.25,
    z = 22.185;
  const west = dim.westernFrontParapet;
  box(
    out,
    'concrete',
    [left + 0.28, top - 0.21, 11.57],
    [right + 0.16, west - 0.02, z - 0.08],
    color.body,
  );
  box(
    out,
    'roof',
    [left + 0.31, west - 0.1, 11.72],
    [right + 0.09, west - 0.035, z - 0.09],
    color.roof,
  );
  for (const x of [-13.18, -10.8, -6.27, -3.78]) {
    if (lod) pilaster(out, x, z - 0.01, 4.32, 8.31, 0.45, lod);
    if (lod > 1) pilaster(out, x, z - 0.035, 8.42, 11.6, 0.28, lod);
  }
  if (lod) {
    crest(out, [left + 0.19, z], [right + 0.03, z], west, lod, false);
    crest(out, [8.04, 18.94], [12.1, 12.35], top - 0.02, lod, true);
  }
  for (const [x, zz, y, s, f] of [
    [-13.37, 22.0, west, 1.19, 0.35],
    [-3.55, 22.03, west, 1.25, 0.12],
    [7.97, 19.06, top, 1.02, -0.32],
    [11.86, 11.2, top, 1.1, 1.28],
    [11.48, -23.91, top, 0.91, 2.57],
    [-6.29, -23.21, top, 0.88, -2.73],
  ])
    mermaid(out, x, zz, y, s, f, lod);
  if (lod > 1) {
    for (const [x, yy] of [
      [-12.14, 9.84],
      [-7.02, 9.84],
      [9.91, 7.27],
      [10.78, 3.0],
    ]) {
      const offset = x < 0 ? 22.32 : 16.21;
      sphere(out, 'trim', [x, yy, offset], [0.29, 0.36, 0.23], color.figure, 10, 5);
      beamPath(
        out,
        'trim',
        [
          [x - 0.54, yy + 0.24, offset],
          [x - 0.35, yy - 0.24, offset + 0.08],
          [x, yy - 0.56, offset + 0.24],
          [x + 0.38, yy - 0.29, offset + 0.12],
          [x + 0.56, yy + 0.19, offset],
        ],
        0.11,
        0.12,
        color.figure,
      );
    }
  }
  portico(out, lod);
}

function build(out, lod) {
  for (let i = 0; i < outline.length; i++) edgeWall(out, i, lod);
  flat(out, outline, top - 0.28, color.roof);
  box(out, 'roof', [-4.6, top - 0.33, -19.94], [9.5, top + 0.63, 11.12], color.roof);
  if (lod) {
    for (const [x, z] of [
      [-2.8, 3.3],
      [3.71, -11.2],
      [8.59, -14.44],
    ])
      box(
        out,
        'concrete',
        [x - 0.46, top + 0.59, z - 0.58],
        [x + 0.46, top + 1.21, z + 0.58],
        color.dark,
      );
    crest(out, [11.93, -22.5], [12.06, -10.1], top, lod, true);
  }
  bankova(out, lod);
}
export const houseSkyline = (out) => build(out, 0);
export const houseDistrict = (out) => build(out, 1);
export const houseStreet = (out) => build(out, 2);
export const houseCloseup = (out) => build(out, 3);
const recipe = 'house-with-chimaeras-model.mjs';
const camera = [-42, 24, 71],
  lookAt = [0, 5, 3];
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: houseCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kyiv’s House with Chimaeras in 2008, with the Bankova portico, steep downhill wing and sculptural roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-28, 43, 35],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'stone_limestone_raw', 'slate', 'wood_plain'],
  qaCameras: [
    { name: 'bankova-entrance-and-statuary', position: [2.5, 12, 53], lookAt: [-2.0, 8.1, 18.4] },
    {
      name: 'cement-cornice-and-roof-figures',
      position: [-27, 20.5, 45],
      lookAt: [-6, 14.2, 17.7],
    },
    { name: 'ivan-franko-square-downhill-wing', position: [-32, 2, -57], lookAt: [0, 1, -9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bankova-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'houseDistrict', 0.26],
        ['street', 'houseStreet', 0.1],
        ['closeup', 'houseCloseup', 0.042],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Nejix’s exact exterior photograph was released to the public domain by the photographer. OpenStreetMap building geometry under ODbL 1.0.',
};
