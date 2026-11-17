/** Quán Âm Pagoda and its Lao Tu Street gateway in Chợ Lớn. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85, metallic: 0 },
  glaze: { slot: 'trim', graph: 'tile_glazed', roughness: 0.67, metallic: 0.04 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.16 },
};
const t = Object.fromEntries(
  Object.entries({
    red: 'a34c42',
    oxblood: '8a4740',
    dark: '604638',
    clay: '97706a',
    clayRed: 'a26760',
    darkGreen: '42635e',
    teal: '56847d',
    lighter: '76958b',
    gold: 'bd9c59',
    cream: 'd1bea1',
    paleBlue: 'a0afa4',
    stone: 'aaa59b',
    deeper: '817b70',
    soft: 'b5ab99',
    pink: 'bc7770',
  }).map(([n, hex]) => [n, rgb(hex)]),
);
const mix = (a, b, u) => a + (b - a) * u;

function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function round(out, x, z, layers, slot, color, n) {
  const ring = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    });
  loft(out, slot, layers.map(ring), color);
}

function curvedRoof(
  out,
  width,
  depth,
  eave,
  rise,
  lift,
  lod,
  { green = false, decorated = false } = {},
) {
  const half = width / 2,
    front = depth / 2,
    rear = -front;
  const count = [4, 8, 12, 16][lod];
  const xAt = (i) => half * ((i / count) * 2 - 1);
  const put = (x, direction, u) => {
    const tip = Math.pow(Math.abs(x / half), 4);
    return [
      x,
      eave + rise * Math.pow(u, 1.22) + tip * lift * (0.63 + 0.37 * u),
      direction * (front * (1 - u) + 0.16 * tip * (1 - u)),
    ];
  };
  for (let i = 0; i < count; i++)
    for (const side of [-1, 1]) {
      const x = xAt(i),
        xx = xAt(i + 1);
      for (const [a, b] of lod
        ? [
            [0, 0.46],
            [0.46, 1],
          ]
        : [[0, 1]]) {
        const p = [put(x, side, a), put(xx, side, a), put(xx, side, b), put(x, side, b)];
        face(out, 'roof', side > 0 ? p : p.toReversed(), green ? t.darkGreen : t.clay);
      }
      if (lod > 1) {
        const a = put(x, side, 0),
          b = put(xx, side, 0);
        beam(out, 'glaze', a, b, 0.12, 0.13, t.teal);
      }
    }
  const ridge = Array.from({ length: count + 1 }, (_, i) => put(xAt(i), 1, 1));
  if (lod)
    beamPath(out, 'glaze', ridge, decorated ? 0.28 : 0.16, 0.2, decorated ? t.lighter : t.teal);
  for (const m of [-1, 1]) {
    const x = m * half,
      endY = eave + 0.39;
    const a = [x, endY, front],
      b = [x, endY, rear],
      c = put(x, -1, 0),
      d = put(x, 1, 1),
      f = put(x, 1, 0);
    face(out, 'wood', m > 0 ? [a, b, c, f] : [f, c, b, a], t.oxblood);
    triangle(out, 'wood', m > 0 ? [c, d, f] : [f, d, c], t.oxblood);
  }
  if (lod > 1) {
    const n = Math.max(4, Math.round(width / (lod === 2 ? 1.19 : 0.68)));
    for (let i = 0; i < n; i++) {
      const x = mix(-half, half, (i + 0.5) / n);
      for (const side of [-1, 1]) {
        const pts = [0.02, 0.43, 0.97].map((v) => {
          const p = put(x, side, v);
          return [p[0], p[1] + 0.036, p[2]];
        });
        beamPath(out, 'roof', pts, 0.102, 0.084, green ? t.teal : t.clayRed);
      }
    }
  }
  if (decorated && lod) {
    const top = (x) => eave + rise + lift * Math.pow(Math.abs(x / half), 4);
    for (const sign of [-1, 1]) {
      const lines = [
        [sign * (half - 1.81), top(sign * (half - 1.81)) + 0.17, 0],
        [sign * (half - 1.18), top(sign * (half - 1.18)) + 0.67, 0.035],
        [sign * (half - 0.55), top(sign * (half - 0.55)) + 1.03, 0.04],
        [sign * (half - 0.29), top(sign * (half - 0.29)) + 0.91, 0.045],
        [sign * (half - 0.47), top(sign * (half - 0.47)) + 0.59, 0.05],
      ];
      beamPath(out, 'glaze', lines, 0.17, 0.14, t.teal);
    }
    if (lod > 1) {
      for (let i = 0; i < 7; i++) {
        const x = width * ((i + 0.5) / 7 - 0.5),
          y = top(x),
          variant = i % 3;
        box(
          out,
          'glaze',
          [x - 0.32, y, -0.1],
          [x + 0.32, y + 0.31 + 0.09 * variant, 0.17],
          t.paleBlue,
        );
        beam(
          out,
          'glaze',
          [x - 0.38, y + 0.29, -0.06],
          [x + 0.38, y + 0.43 + 0.09 * variant, 0.12],
          0.091,
          0.16,
          t.teal,
        );
      }
    }
  }
}

function footing(out, x0, x1, z0, z1, y) {
  box(out, 'foundation', [x0, y - 1.45, z0], [x1, y + 0.24, z1], t.stone);
}

function gate(out, lod) {
  const { frontGateWidth, gateHeight } = plan.dimensions;
  const m = transform(out, -0.066, [-1.38, 0.12, -0.62]);
  const centers = [-frontGateWidth / 2 + 0.36, -3.45, 3.45, frontGateWidth / 2 - 0.36];
  footing(m, -8.05, 8.05, -1.81, 0.09, -0.18);
  for (const [i, x] of centers.entries()) {
    const y = i === 0 || i === 3 ? 4.07 : 5.43;
    box(m, 'wall', [x - 0.37, 0, -0.64], [x + 0.37, y, 0.32], t.red);
    box(m, 'glaze', [x - 0.44, 0, -0.71], [x + 0.44, 0.67, 0.4], t.teal);
    if (lod) {
      panel(m, 'glaze', x - 0.24, x + 0.24, 0.74, y - 0.64, 0.35, t.gold);
      panel(m, 'wall', x - 0.17, x + 0.17, 0.85, y - 0.75, 0.368, t.cream);
    }
  }
  for (const x of [-5.43, 5.43]) {
    const sub = transform(m, 0, [x, 0, -0.22]);
    box(sub, 'wood', [-2.52, 3.7, -0.86], [2.52, 4.32, 0.67], t.red);
    curvedRoof(sub, 5.38, 2.0, 4.32, 0.79, 0.52, lod, { green: true });
  }
  box(m, 'wood', [-3.87, 4.41, -0.87], [3.87, 5.43, 0.53], t.red);
  box(m, 'wood', [-3.44, 3.58, -0.31], [3.44, 4.26, 0.13], t.red);
  panel(m, 'glaze', -3.32, 3.32, 3.99, 4.06, 0.154, t.gold);
  panel(m, 'glaze', -3.58, 3.58, 5.14, 5.22, 0.556, t.gold);
  curvedRoof(m, 8.79, 2.52, 5.5, 0.92, gateHeight - 6.42, lod, { green: true, decorated: lod > 0 });
  for (const [left, right] of [
    [-13.27, -7.38],
    [7.38, 13.41],
  ]) {
    box(m, 'foundation', [left, -0.34, -0.64], [right, 0.38, 0.24], t.stone);
    for (const y of lod ? [0.46, 1.1, 2.64, 3.27] : [0.55, 3.1]) {
      beam(m, 'metal', [left, y, 0.05], [right, y, 0.05], 0.091, 0.09, t.teal);
    }
    const n = [3, 7, 15, 20][lod];
    for (let i = 0; i < n; i++) {
      const x = mix(left, right, (i + 0.5) / n);
      beam(
        m,
        'metal',
        [x, 0.37, 0.05],
        [x, 3.3, 0.05],
        0.039,
        0.041,
        i % 4 === 0 ? t.gold : t.darkGreen,
      );
    }
  }
  if (lod)
    for (const x of [-2.94, 2.94]) {
      round(
        m,
        x,
        0.99,
        [
          [4.38, 0.12],
          [4.52, 0.24],
          [4.92, 0.31],
          [5.14, 0.19],
          [5.28, 0.1],
        ],
        'wood',
        t.pink,
        lod === 1 ? 6 : 9,
      );
    }
}

const bounds = (points) => {
  const low = [0, 1].map((j) => Math.min(...points.map((p) => p[j])));
  const high = [0, 1].map((j) => Math.max(...points.map((p) => p[j])));
  return [low, high];
};

function hall(out, feature, index, lod) {
  const [[x0, z0], [x1, z1]] = bounds(feature.points),
    side = index >= 4;
  const floor = [0.03, 0.16, 0.18, 1.05, 0.27, 0.55][index];
  const eave = floor + [4.24, 5.17, 5.84, 5.74, 3.37, 3.33][index];
  const center = [(x0 + x1) / 2, 0, (z0 + z1) / 2],
    width = x1 - x0,
    depth = z1 - z0;
  const front = transform(out, 0, center);
  const x = width / 2,
    z = depth / 2;
  footing(front, -x - 0.12, x + 0.12, -z - 0.19, z + 0.16, floor);
  if (index === 0) {
    const left = -2.77,
      right = 2.77,
      height = eave - 0.74,
      faceZ = z - 1.14;
    box(front, 'wall', [-x, floor + 0.23, -z], [left, eave - 0.11, faceZ], t.red);
    box(front, 'wall', [right, floor + 0.23, -z], [x, eave - 0.11, faceZ], t.red);
    box(front, 'wood', [left, height, -z], [right, eave - 0.11, faceZ], t.oxblood);
    box(front, 'wood', [left, floor + 0.23, -z], [right, height, -z + 0.15], t.dark);
    if (lod)
      for (const a of [left, right]) {
        box(
          front,
          'glaze',
          [a - 0.16, floor + 0.24, faceZ - 0.22],
          [a + 0.16, height, faceZ + 0.19],
          t.darkGreen,
        );
      }
  } else {
    box(
      front,
      'wall',
      [-x, floor + 0.23, -z],
      [x, eave - 0.11, side ? z : z - 1.17],
      side ? t.soft : t.red,
    );
  }
  if (!side) {
    const count = lod ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const xpos = mix(-x + 0.29, x - 0.29, i / (count - 1));
      if (index === 0 && Math.abs(xpos) < 2.77) continue;
      box(
        front,
        'wood',
        [xpos - 0.18, floor + 0.24, z - 0.39],
        [xpos + 0.18, eave, z + 0.026],
        t.oxblood,
      );
      if (lod)
        box(
          front,
          'foundation',
          [xpos - 0.249, floor + 0.15, z - 0.42],
          [xpos + 0.249, floor + 0.57, z + 0.054],
          t.deeper,
        );
    }
    panel(front, 'wood', -x + 0.23, x - 0.23, eave - 0.67, eave - 0.14, z + 0.028, t.dark);
  } else if (lod) {
    const sideWindow = transform(front, index === 4 ? Math.PI / 2 : -Math.PI / 2, [
      index === 4 ? x : -x,
      0,
      0,
    ]);
    const count = Math.max(2, Math.floor(depth / 4.3));
    for (let i = 0; i < count; i++) {
      const cx = mix(-z, z, (i + 0.5) / count);
      panel(
        sideWindow,
        'wood',
        cx - 0.41,
        cx + 0.41,
        floor + 1.26,
        eave - 0.51,
        0.032,
        t.darkGreen,
      );
    }
  }
  const overlap = side ? 0.36 : 0.91;
  curvedRoof(
    side ? transform(front, Math.PI / 2) : front,
    (side ? depth : width) + overlap * 2,
    (side ? width : depth) + overlap * 2,
    eave,
    side ? 1.42 : [2.2, 2.35, 2.76, 2.51][index],
    side ? 0.36 : 0.68,
    lod,
    { decorated: index < 3 },
  );
}

function build(out, lod) {
  for (const [i, f] of frame.features.slice(1).entries()) hall(out, f, i, lod);
  footing(out, -13.33, 13.45, -8.13, 0.07, -0.18);
  gate(out, lod);
}
export const pagodaSkyline = (out) => build(out, 0);
export const pagodaDistrict = (out) => build(out, 1);
export const pagodaStreet = (out) => build(out, 2);
export const pagodaCloseup = (out) => build(out, 3);

const recipe = 'quan-am-temple-model.mjs';
const camera = [28, 24, 45],
  lookAt = [0, 5, -17];
export const pagodaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: pagodaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Quán Âm Pagoda’s red Lao Tu Street gate, curved ceramic roofs, and four halls and side ranges in Chợ Lớn.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-22, 43, 41],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.92,
    basis: 'Named temple parcel encloses the affected halls and side ranges.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_granite',
    'tile_ceramic',
    'tile_glazed',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'lao-tu-three-part-gateway', position: [0, 4.2, 22], lookAt: [-1.6, 4, -2] },
    { name: 'glazed-eaves-and-roof-ornament', position: [15, 11, 24], lookAt: [-1, 6, -9] },
    { name: 'four-halls-and-side-ranges', position: [27, 31, -23], lookAt: [0, 5, -22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cho-lon-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'pagodaSkyline',
    errorMeters: 0.57,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'pagodaDistrict', 0.27],
        ['street', 'pagodaStreet', 0.11],
        ['closeup', 'pagodaCloseup', 0.052],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Public building data from Overture and OpenStreetMap. The Qualla photograph of the gate was released to the public domain by DoktorMax.',
};
