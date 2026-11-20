import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  block,
  face,
  floorSampler,
  mix,
  palette,
  plane,
  rect,
  ring,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const color = palette({
  gray: 'b8b2a1',
  pale: 'd0cbb9',
  trim: 'beb8a5',
  marble: 'd5cfc0',
  dark: 'a9a48d',
  ashlar: 'aca38f',
  ochre: '948572',
  wall: '9b8770',
  earth: 'aaa187',
  fracture: 'b7ae98',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone_weathered', 0.96),
  detail: surface('trim', 'stone_marble', 0.93),
  foundation: surface('foundation', 'stone_ashlar', 0.95),
  rubble: surface('foundation', 'stone_drywall', 0.96),
  brick: surface('wall', 'brick', 0.94),
};
const rectAt = (x, z, w, l) => rect(x - w / 2, z - l / 2, x + w / 2, z + l / 2);

function slab(out, p, low, high, slot, shade) {
  shell(out, p, () => low, high, { wall: slot, color: shade });
}

function stoneBlank(out, x, y, z, w, h, l, shade = color.gray, slot = 'stone') {
  block(out, slot, x - w / 2, y, z - l / 2, w, h, l, shade);
}

function reliefStroke(out, coords, z, width, tint = color.trim) {
  beamPath(
    out,
    'detail',
    coords.map(([x, y]) => [x, y, z]),
    width,
    width * 0.78,
    tint,
  );
}

// An open gap in the broken crown separates its two surviving carved stones.
function carvedPanel(out, p, z, depth, shade = color.pale) {
  const indices = earcut(p.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const facePoints = indices.slice(i, i + 3).map((n) => p[n]);
    for (const s of [-1, 1]) {
      face(
        out,
        'stone',
        facePoints.map(([x, y]) => [x, y, z + s * depth * 0.5]),
        [0, 0, s],
        shade,
      );
    }
  }
  for (let i = 0; i < p.length; i++) {
    const [x, y] = p[i],
      [u, v] = p[(i + 1) % p.length];
    face(
      out,
      'detail',
      [
        [x, y, z - depth * 0.5],
        [u, v, z - depth * 0.5],
        [u, v, z + depth * 0.5],
        [x, y, z + depth * 0.5],
      ],
      [v - y, x - u, 0],
      color.gray,
    );
  }
}

function flutedPier(out, x, z, y, width, height, lod) {
  stoneBlank(out, x, y, z, width * 1.58, 0.28, width * 1.29, color.ashlar, 'foundation');
  if (lod > 0) {
    stoneBlank(out, x, y + 0.29, z, width * 1.31, 0.31, width * 1.18, color.gray);
  }
  const baseHeight = lod === 0 ? 0.28 : 0.59;
  stoneBlank(out, x, y + baseHeight, z, width, height - baseHeight, width * 0.78, color.pale);
  if (lod === 0) return;
  const side = plane(z + width * 0.39, 1);
  const lines = lod === 1 ? 3 : lod === 2 ? 5 : 7;
  for (let i = 0; i < lines; i++) {
    const u = x + mix(-0.43, 0.43, (i + 0.5) / lines) * width;
    const w = width * 0.05;
    face(
      out,
      'detail',
      [
        [u - w, y + 0.68, side.p(0, 0, 0.037)[2]],
        [u + w, y + 0.68, side.p(0, 0, 0.037)[2]],
        [u + w, y + height - 0.31, side.p(0, 0, 0.037)[2]],
        [u - w, y + height - 0.31, side.p(0, 0, 0.037)[2]],
      ],
      side.normal,
      color.trim,
    );
  }
  stoneBlank(out, x, y + height - 0.21, z, width * 1.21, 0.29, width * 0.92, color.gray, 'detail');
}

function scroll(out, x, y, z, direction, radius, lod) {
  const n = lod === 1 ? 5 : lod === 2 ? 8 : 13;
  const curve = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 1.52;
    const size = mix(radius, radius * 0.15, t);
    curve.push([x + Math.cos(a) * size * direction, y + Math.sin(a) * size]);
  }
  reliefStroke(out, curve, z, 0.085, color.pale);
}

function fountainGate(out, lod) {
  const y = d.sculptureFloor,
    z = d.gate.center[1];
  const foot = d.gate.mainOpening * 0.5;
  const bases = [
    [-8.8, 1.78, 8.2, 2.89],
    [-8, 0.39, 7.4, 1.6],
    [-7.8, -2.51, 7.51, 1.08],
  ];
  for (const [l, front, r, back] of bases) {
    slab(
      out,
      rect(l, Math.min(front, back), r, Math.max(front, back)),
      grade([(l + r) * 0.5, front]) - 0.38,
      y + (back > 2.8 ? 0.36 : 0.62),
      'foundation',
      color.ashlar,
    );
  }
  for (const s of [-1, 1]) {
    flutedPier(out, s * (foot + 0.64), z, y + 0.52, 1.32, 4.79, lod);
    const shape = [
      [0.035, 5.51],
      [0.42, 5.54],
      [1.02, 5.38],
      [1.26, 5.03],
      [1.68, 4.84],
      [2.02, 4.96],
      [2.25, 5.29],
      [2.21, 5.64],
      [1.96, 5.92],
      [1.66, 6.12],
      [1.27, 6.2],
      [0.87, 6.17],
      [0.57, 6.04],
      [0.24, 6.05],
      [0.08, 5.97],
    ].map(([x, h]) => [x * s, y + h]);
    carvedPanel(out, lod === 0 ? shape.filter((_, i) => i % 2 === 0) : shape, z - 0.09, 0.83);
    if (lod > 0) {
      reliefStroke(
        out,
        [
          [0.13, 5.88],
          [0.7, 5.9],
          [1.26, 6.06],
          [1.69, 5.99],
          [2.05, 5.66],
          [2.08, 5.32],
          [1.84, 5.07],
        ].map(([x, h]) => [x * s, y + h]),
        z + 0.36,
        0.115,
        color.gray,
      );
      scroll(out, s * 1.71, y + 5.38, z + 0.393, s, 0.31, lod);
    }
    const curve = [
      [2.26, 0.26],
      [3.29, 0.26],
      [4.15, 0.48],
      [4.69, 0.68],
      [5.52, 0.55],
      [6.42, 0.44],
      [7.73, 0.34],
      [7.72, 0.57],
      [6.7, 1.1],
      [5.62, 1.85],
      [5.13, 2.52],
      [4.48, 2.78],
      [4.06, 2.51],
      [3.7, 1.57],
      [3.11, 1.12],
      [2.35, 1.23],
    ].map(([x, h]) => [s * x, y + h]);
    carvedPanel(out, lod === 0 ? curve.filter((_, i) => i % 2 === 0) : curve, z - 0.11, 0.78, color.gray);
    if (lod > 0) {
      reliefStroke(
        out,
        [
          [4.15, 2.43],
          [4.61, 2.6],
          [5.11, 2.39],
          [5.62, 1.74],
          [6.64, 1.02],
          [7.65, 0.55],
        ].map(([x, h]) => [s * x, y + h]),
        z + 0.31,
        0.14,
        color.pale,
      );
      scroll(out, s * 4.48, y + 2.13, z + 0.34, s, 0.26, lod);
      for (const k of [2.14, 3.63, 4.77]) {
        const xx = s * k;
        reliefStroke(
          out,
          [
            [xx - 0.26, y + 0.62],
            [xx - 0.19, y + 1.22],
            [xx, y + 1.4],
            [xx + 0.22, y + 1.18],
            [xx + 0.31, y + 0.58],
          ],
          z + 0.35,
          0.083,
          color.trim,
        );
      }
    }
  }
  flutedPier(out, 4.19, z - 0.27, y + 0.5, 1.12, 4.35, lod);
  flutedPier(out, -4.45, z - 0.27, y + 0.46, 1.12, 2.13, lod);
  if (lod === 0) return;
  for (const cfg of [
    [-5.85, 2.45, 1.1, 1.3],
    [-3.8, 2.3, 0.36, 1.19],
    [2.95, 2.63, 0.4, 1.23],
    [5.4, 2.4, 0.8, 1.32],
  ]) {
    const [x, w, height, l] = cfg;
    stoneBlank(out, x, y - 0.29, 3.4, w, height, l, color.ashlar, 'foundation');
  }
  for (const [x, z, r] of [
    [-6.2, 4.6, 1.31],
    [-2.25, 3.98, 1.48],
    [2.31, 4.48, 1.31],
    [6.24, 4.6, 1.16],
  ]) {
    const b = grade([x, z]);
    ring(
      out,
      'foundation',
      [x, z],
      [
        [b - 0.11, r],
        [b + 0.26, r],
        [b + 0.43, r * 0.89],
      ],
      lod === 1 ? 9 : 14,
      color.ashlar,
    );
  }
}

function remains(out, lod) {
  const x = d.hallPosition[0],
    z = d.hallPosition[1],
    y = d.upperFloor;
  const points = rectAt(x, z, d.hall.span, d.hall.depth);
  slab(out, points, Math.min(...points.map(grade)) - 0.52, y, 'foundation', color.earth);
  slab(out, rectAt(x, z - 1.13, 21.85, 10.4), y - 0.06, y + 0.67, 'rubble', color.ochre);
  const centers = [-9.25, -4.7, 0, 4.47, 9.18];
  if (lod > 0) {
    for (const v of centers) {
      for (const u of [z - 3.15, z + 2.04]) {
        stoneBlank(out, v + x, y + 0.63, u, 1.96, 0.22, 1.76, color.ashlar, 'foundation');
        stoneBlank(out, v + x, y + 0.84, u, 1.39, 0.15, 1.31, color.gray, 'detail');
      }
    }
  }
  for (const [xOffset, zOffset, r, height] of [
    [-7.6, 1.95, 0.58, 4.31],
    [-3.72, 1.95, 0.52, 3.62],
    [3.64, 2.01, 0.53, 4.48],
    [7.85, 2.02, 0.56, 3.88],
    [1.22, -2.75, 0.49, 1.24],
    [-8.74, -2.82, 0.54, 0.83],
  ]) {
    const diameter = r * 2;
    const pos = [x + xOffset, z + zOffset];
    const b = y + 0.91;
    if (lod === 0) {
      ring(out, 'detail', pos, [[y + 0.63, r], [b + height, r * 0.88]], 5, color.marble);
      continue;
    }
    stoneBlank(
      out,
      pos[0],
      b - 0.24,
      pos[1],
      diameter * 1.45,
      0.31,
      diameter * 1.4,
      color.gray,
      'detail',
    );
    ring(
      out,
      'detail',
      pos,
      [
        [b, r * 1.08],
        [b + 0.22, r],
        [b + height, r * 0.88],
      ],
      [6, 8, 14, 20][lod],
      color.marble,
    );
    if (lod > 1) {
      const lines = lod === 2 ? 6 : 10;
      for (let i = 0; i < lines; i++) {
        const a = (i * 2 * Math.PI) / lines,
          c = Math.cos(a),
          s = Math.sin(a);
        const lo = [pos[0] + c * r, b + 0.3, pos[1] + s * r];
        const hi = [pos[0] + c * r * 0.89, b + height - 0.06, pos[1] + s * r * 0.89];
        beamPath(out, 'detail', [lo, hi], 0.04, 0.047, color.gray);
      }
    }
    stoneBlank(
      out,
      pos[0] + 0.07,
      b + height - 0.03,
      pos[1],
      r * 1.51,
      0.12,
      r * 1.55,
      color.fracture,
      'detail',
    );
  }
}

function radialSteps(centerX, centerZ, w, depth, lod) {
  const n = [7, 10, 15, 22][lod];
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i * Math.PI) / n;
    return [centerX + Math.cos(a) * w, centerZ - Math.sin(a) * depth];
  });
}

function viewScreen(out, lod) {
  const [x, z] = d.viewPosition,
    y = d.viewingFloor;
  const wallBack = z + 2.1;
  const front = z + 0.12;
  const low = grade([x, z - 2.6]) - 0.38;
  for (const [i, half] of [4.75, 4.48, 4.11].entries()) {
    slab(
      out,
      radialSteps(x, z + 0.66, half, d.view.depth * 0.55 - i * 0.269, lod),
      low,
      y + 0.14 + i * 0.205,
      'detail',
      i === 0 ? color.gray : color.marble,
    );
  }
  stoneBlank(out, x, y - 0.09, z + 1.94, d.view.width, 2.62, 1.06, color.wall, 'brick');
  stoneBlank(out, x, y + 2.48, z + 1.85, d.view.width + 0.11, 0.19, 1.15, color.ochre, 'rubble');
  for (let i = 0; i < d.view.panels; i++) {
    const x0 = (i - 2) * 1.71 + x;
    stoneBlank(out, x0, y + 0.03, front, 1.59, 0.62, 0.62, color.gray, 'detail');
    stoneBlank(out, x0, y + 0.72, front, 1.14, 1.61, 0.29, color.marble, 'detail');
    if (lod > 0) {
      const zFace = front - 0.17;
      reliefStroke(
        out,
        [
          [x0 - 0.45, y + 0.87],
          [x0 + 0.45, y + 0.87],
          [x0 + 0.45, y + 2.23],
          [x0 - 0.45, y + 2.23],
          [x0 - 0.45, y + 0.87],
        ],
        zFace,
        0.064,
        color.trim,
      );
      reliefStroke(
        out,
        [
          [x0 - 0.19, y + 1.07],
          [x0 + 0.25, y + 1.55],
          [x0 - 0.22, y + 1.91],
          [x0 + 0.05, y + 2.11],
        ],
        zFace - 0.03,
        0.051,
      );
      if (lod > 1) scroll(out, x0 - 0.09, y + 1.57, zFace - 0.042, 1, 0.27, lod);
    }
  }
  for (const s of [-1, 1]) {
    const x0 = x + s * 4.66;
    stoneBlank(out, x0, y - 0.08, front, 0.87, 0.85, 0.72, color.gray, 'detail');
    stoneBlank(out, x0, y + 0.79, front, 0.6, 2.43, 0.56, color.marble, 'detail');
    stoneBlank(
      out,
      x0 + 0.45 * s,
      y + 0.19,
      wallBack - 0.55,
      0.61,
      1.97,
      0.58,
      color.pale,
      'detail',
    );
    if (lod > 1) {
      for (const u of [-0.14, 0, 0.14]) {
        reliefStroke(
          out,
          [
            [x0 + u, y + 0.93],
            [x0 + u, y + 2.98],
          ],
          front - 0.31,
          0.042,
          color.trim,
        );
      }
    }
  }
}

function rubble(out, lod) {
  const bands = [
    [-11.1, -3.2, 5.8, 12.4],
    [-8.2, 8.1, 6.5, 4.8],
    [5.6, 6.64, 4.6, 5.4],
    [-16, -17, 8.2, 8.4],
    [12.2, -23.2, 4.2, 5.1],
    [-11.5, -33.4, 6.6, 8.2],
  ];
  const sample = (i) => ((i * 73 + 121) % 257) / 257;
  const count = [0, 5, 9, 13][lod];
  for (const [section, [x, z, w, l]] of bands.entries()) {
    for (let i = 0; i < count; i++) {
      const n = i * 14 + section * 11;
      const px = x + (sample(n) - 0.5) * w,
        pz = z + (sample(n + 5) - 0.5) * l;
      const width = 0.45 + sample(n + 2) * 1.5,
        depth = 0.26 + sample(n + 4) * 0.93;
      const h = 0.24 + sample(n + 6) * 0.47,
        angle = sample(n + 1) * Math.PI;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const plan = rectAt(0, 0, width, depth).map(([x, z]) => [
        px + c * x - s * z,
        pz + s * x + c * z,
      ]);
      const y = grade([px, pz]);
      slab(out, plan, y - 0.16, y + h, 'rubble', i % 3 === 0 ? color.fracture : color.ashlar);
    }
  }
}

function build(out, lod) {
  fountainGate(out, lod);
  remains(out, lod);
  viewScreen(out, lod);
  rubble(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [47, 40, 76];
const lookAt = [-1, 1, -4];
const recipe = 'old-summer-palace-model.mjs';
export const palaceRuinsModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace-castle-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'The independent original terrain anchors the three named sites and their open approaches. The fallen masonry and architectural terraces are estimated above the existing grade.',
  brief:
    'The present Great Fountain, Yuanyingguan and Fountain View ruins at the Old Summer Palace, including the broken Baroque arch, white marble columns, and five-panel viewing screen.',
  camera,
  lookAt,
  sunDirection: [-21, 42, 24],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'great-fountain-broken-arch', position: [8, 6.1, 22], lookAt: [0, 2.65, -1.4] },
    { name: 'yuanyingguan-column-fragments', position: [23, 12, -10], lookAt: [0, 2, -29] },
    { name: 'five-panels-and-viewing-dais', position: [-11, 5, 16], lookAt: [-1, 2.45, 32] },
    { name: 'three-ruins-on-the-axis', position: [61, 45, 30], lookAt: [0, 1.8, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-summer-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.37,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.67, surfaces },
      street: { export: 'street', errorMeters: 0.27, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Leiem’s photographs are CC0. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
