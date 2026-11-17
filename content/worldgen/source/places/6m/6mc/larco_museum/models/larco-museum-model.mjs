/** The Museo Larco casona and its north garden approach in the native site frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const ring = cleanRing(frame.geometry.outline);
const area = ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0);
if (area > 0) ring.reverse();
const capIndices = earcut(ring.flat());
const approach = frame.features.find(({ role }) => role === 'public ramp and approach').points;
const {
  floorHeightApproximate: floor,
  roofHeightApproximate: top,
  portalCenterLocal: [doorX, front],
} = plan.dimensions;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  clay: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  cement: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.14 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    plaster: 'e7dfce',
    base: 'd0c7b4',
    light: 'eee7d7',
    shade: 'c5bca9',
    roof: '969287',
    timber: '594a3d',
    warmWood: '6a5443',
    window: '4a5a58',
    shadow: '332f2a',
    clay: 'a16a53',
    clayLight: 'bb8b6b',
    paving: 'ae8e76',
    iron: '4a4942',
    brass: 'b7a281',
    leaf: '536344',
    leafLight: '6a7952',
    burgundy: '9d485e',
    flower: 'bd6474',
    red: 'b84541',
    white: 'ece8dc',
  }).map(([key, value]) => [key, rgb(value)]),
);

function frontPlane(out, slot, left, right, low, high, z, color) {
  if (right - left < 0.001 || high - low < 0.001) return;
  face(
    out,
    slot,
    [
      [left, low, z],
      [right, low, z],
      [right, high, z],
      [left, high, z],
    ],
    color,
  );
}

function slab(out, slot, lo, hi, color) {
  const at = ([x, z], y) => [x, y, z];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(out, slot, [at(a, lo), at(b, lo), at(b, hi), at(a, hi)], color);
  }
  for (let i = 0; i < capIndices.length; i += 3) {
    const [a, b, c] = capIndices.slice(i, i + 3).map((index) => ring[index]);
    const clockwise = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0;
    const [p, q, r] = clockwise ? [a, b, c] : [a, c, b];
    triangle(out, slot, [at(p, hi), at(q, hi), at(r, hi)], color);
    triangle(out, slot, [at(p, lo), at(r, lo), at(q, lo)], color);
  }
}

function shell(out, lod) {
  const sill = floor;
  const doorway = [doorX - 1.35, doorX + 1.35];
  const wallHeight = 6.8;
  slab(out, 'plaster', -0.82, sill, tint.base);
  slab(out, 'cement', wallHeight - 0.06, wallHeight + 0.04, tint.roof);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const isFront = Math.abs(a[1] - front) < 0.04 && Math.abs(b[1] - front) < 0.04;
    const [p, q] = [a, b];
    if (isFront) {
      const lo = Math.min(p[0], q[0]),
        hi = Math.max(p[0], q[0]);
      const split = lo < doorX && hi > doorX;
      if (split) {
        frontPlane(out, 'plaster', lo, doorway[0], sill, wallHeight, front, tint.plaster);
        frontPlane(out, 'plaster', doorway[1], hi, sill, wallHeight, front, tint.plaster);
        frontPlane(out, 'plaster', ...doorway, 5.45, wallHeight, front, tint.plaster);
      } else frontPlane(out, 'plaster', lo, hi, sill, wallHeight, front, tint.plaster);
    } else
      face(
        out,
        'plaster',
        [
          [p[0], sill, p[1]],
          [q[0], sill, q[1]],
          [q[0], wallHeight, q[1]],
          [p[0], wallHeight, p[1]],
        ],
        tint.plaster,
      );
    beam(out, 'plaster', [p[0], 6.96, p[1]], [q[0], 6.96, q[1]], 0.44, 0.33, tint.light);
    if (lod > 0)
      beam(out, 'plaster', [p[0], 6.83, p[1]], [q[0], 6.83, q[1]], 0.21, 0.25, tint.shade);
    if (lod > 1) {
      beam(out, 'clay', [p[0], 7.14, p[1]], [q[0], 7.14, q[1]], 0.075, 0.25, tint.clayLight);
      if (!isFront && Math.hypot(q[0] - p[0], q[1] - p[1]) > 8) {
        const dx = q[0] - p[0],
          dz = q[1] - p[1];
        const length = Math.hypot(dx, dz);
        const nx = -dz / length,
          nz = dx / length;
        for (const fraction of [0.22, 0.5, 0.78]) {
          const x = p[0] + dx * fraction + nx * 0.025,
            z = p[1] + dz * fraction + nz * 0.025;
          beam(out, 'plaster', [x, floor + 0.04, z], [x, floor + 3.91, z], 0.12, 0.18, tint.base);
        }
      }
    }
  }
  const x = doorX,
    z = front;
  const d = z - 0.55;
  frontPlane(out, 'timber', ...doorway, sill, 5.45, d, tint.timber);
  face(
    out,
    'plaster',
    [
      [doorway[0], sill, z],
      [doorway[0], sill, d],
      [doorway[0], 5.45, d],
      [doorway[0], 5.45, z],
    ],
    tint.shade,
  );
  face(
    out,
    'plaster',
    [
      [doorway[1], sill, d],
      [doorway[1], sill, z],
      [doorway[1], 5.45, z],
      [doorway[1], 5.45, d],
    ],
    tint.shade,
  );
  face(
    out,
    'plaster',
    [
      [doorway[0], 5.45, d],
      [doorway[1], 5.45, d],
      [doorway[1], 5.45, z],
      [doorway[0], 5.45, z],
    ],
    tint.shade,
  );
  for (const sign of [-1, 1]) {
    const p = x + sign * 1.66;
    box(out, 'plaster', [p - 0.29, sill, z - 0.04], [p + 0.29, 5.76, z + 0.29], tint.light);
    if (lod > 0) {
      for (const [level, w, dep] of [
        [sill, 0.66, 0.42],
        [5.54, 0.7, 0.42],
        [5.7, 0.75, 0.48],
      ]) {
        box(
          out,
          'plaster',
          [p - w / 2, level, z - 0.05],
          [p + w / 2, level + 0.11, z + dep],
          tint.light,
        );
      }
      const panelX = x + sign * 0.69;
      for (const yy of [2.52, 3.47, 4.46]) {
        box(
          out,
          'timber',
          [panelX - 0.56, yy, d + 0.006],
          [panelX + 0.56, yy + 0.73, d + 0.087],
          tint.warmWood,
        );
        if (lod > 1) {
          box(
            out,
            'timber',
            [panelX - 0.46, yy + 0.09, d + 0.085],
            [panelX + 0.46, yy + 0.65, d + 0.103],
            tint.timber,
          );
        }
      }
      box(
        out,
        'iron',
        [x + sign * 0.19 - 0.04, 3.43, d + 0.105],
        [x + sign * 0.19 + 0.04, 3.62, d + 0.195],
        tint.brass,
      );
    }
  }
  box(out, 'plaster', [x - 2.27, 5.71, z - 0.21], [x + 2.27, 6.05, z + 0.57], tint.light);
  box(out, 'plaster', [x - 2.45, 6.04, z - 0.2], [x + 2.45, 6.25, z + 0.69], tint.light);
  if (lod > 0) {
    box(out, 'plaster', [x - 2.29, 5.77, z + 0.54], [x + 2.29, 5.86, z + 0.64], tint.shade);
    box(out, 'plaster', [x - 2.34, 6.28, z - 0.19], [x + 2.34, 6.42, z + 0.6], tint.shade);
  }
  const pediment = [
    [0.2, top],
    [0.55, top - 0.06],
    [0.91, top - 0.2],
    [1.22, top - 0.39],
    [1.51, top - 0.5],
    [1.93, top - 0.53],
    [2.24, top - 0.69],
    [2.47, top - 0.93],
    [2.49, 6.35],
  ];
  for (const sign of [-1, 1]) {
    const section = sign === 1 ? pediment : [...pediment].reverse();
    for (let i = 0; i < section.length - 1; i++) {
      if (lod === 0 && i % 2 !== 0) continue;
      const j = Math.min(section.length - 1, i + (lod === 0 ? 2 : 1));
      const [a, ay] = section[i],
        [b, by] = section[j];
      const u = x + a * sign,
        v = x + b * sign;
      if (Math.abs(v - u) < 0.001) continue;
      face(
        out,
        'plaster',
        [
          [u, 6.33, z + 0.22],
          [v, 6.33, z + 0.22],
          [v, by, z + 0.22],
          [u, ay, z + 0.22],
        ],
        tint.light,
      );
      face(
        out,
        'plaster',
        [
          [u, ay, z + 0.22],
          [v, by, z + 0.22],
          [v, by, z - 0.21],
          [u, ay, z - 0.21],
        ],
        tint.plaster,
      );
      if (lod > 0)
        beam(out, 'plaster', [u, ay, z + 0.24], [v, by, z + 0.24], 0.13, 0.21, tint.light);
    }
  }
  if (lod > 0) {
    for (const sign of [-1, 1]) {
      const xLamp = x + sign * 3.37;
      beam(out, 'iron', [xLamp, 5.05, z], [xLamp, 5.28, z + 0.31], 0.048, 0.048, tint.iron);
      box(out, 'iron', [xLamp - 0.085, 4.88, z + 0.27], [xLamp + 0.085, 5.19, z + 0.44], tint.iron);
      box(
        out,
        'accent',
        [xLamp - 0.05, 4.91, z + 0.325],
        [xLamp + 0.05, 5.12, z + 0.445],
        tint.brass,
      );
    }
  }
  const pole = z - 0.41;
  column(out, 'iron', x, pole, 7.0, 10.32, 0.034, tint.iron, lod > 1 ? 8 : 5);
  for (let i = 0; i < 3; i++) {
    const l = x + 0.02 + i * 0.49,
      r = l + 0.49;
    const span = 1.48;
    const curve = (xx) => Math.sin(((xx - x) / span) * Math.PI * 1.2) * 0.16;
    const frontFlag = [
      [l, 8.97 - (l - x) * 0.09, pole + curve(l)],
      [r, 8.97 - (r - x) * 0.09, pole + curve(r)],
      [r, 10.15 - (r - x) * 0.14, pole + curve(r)],
      [l, 10.15 - (l - x) * 0.14, pole + curve(l)],
    ];
    face(out, 'accent', frontFlag, i === 1 ? tint.white : tint.red);
    face(out, 'accent', [...frontFlag].reverse(), i === 1 ? tint.white : tint.red);
  }
}

function ramp(out, lod) {
  const start = approach[0],
    turn = approach[1],
    finish = approach[2];
  const wall = 23.28;
  const p = [start[0] - 1.7, floor, start[1] + 0.03],
    q = [start[0] + 1.7, floor, start[1] + 0.03];
  const r = [start[0] + 1.7, floor, wall],
    s = [start[0] - 1.7, floor, wall];
  face(out, 'clay', [p, s, r, q], tint.paving);
  const plateau = [start[0] + 1.7, floor, 19.44],
    lower = [finish[0], 0.16, 19.74];
  const far = [finish[0], 0.16, wall + 0.28];
  face(out, 'clay', [plateau, r, far, lower], tint.paving);
  const skirt = -0.78;
  face(out, 'plaster', [[s[0], skirt, s[2]], [r[0], skirt, r[2]], r, s], tint.plaster);
  face(out, 'plaster', [[r[0], skirt, r[2]], [far[0], skirt, far[2]], far, r], tint.plaster);
  face(
    out,
    'plaster',
    [[far[0], skirt, far[2]], [lower[0], skirt, lower[2]], lower, far],
    tint.base,
  );
  const raised = (v, dy) => [v[0], v[1] + dy, v[2]];
  for (const [a, b] of [
    [s, r],
    [r, far],
  ]) {
    beam(out, 'plaster', raised(a, 0.27), raised(b, 0.27), 0.53, 0.24, tint.plaster);
    beam(out, 'clay', raised(a, 0.57), raised(b, 0.57), 0.11, 0.31, tint.clay);
  }
  if (lod > 0) {
    const x = turn[0] - 1.65;
    for (let i = 0; i < 4; i++) {
      const p = 19.65 + i * 0.75;
      box(out, 'plaster', [x - 0.17, floor, p], [x + 0.17, floor + 0.55, p + 0.14], tint.light);
    }
  }
}

function garden(out, lod) {
  if (lod === 0) return;
  const flowers = [
    [-17.5, 24.2],
    [-11.3, 24.21],
    [-5.9, 24.45],
    [0.8, 24.47],
    [7.3, 24.47],
    [13.6, 24.63],
  ];
  const points = lod === 1 ? 2 : lod === 2 ? 4 : 6;
  for (const [x, z] of flowers) {
    const y = Math.max(-0.18, 0.14 - x * 0.014);
    for (let i = 0; i < points; i++) {
      const pos = x + (i - (points - 1) / 2) * 0.46;
      const h = 0.56 + (i % 3) * 0.15;
      sphere(
        out,
        'accent',
        [pos, y + 0.32, z + (i % 2) * 0.3],
        [0.5, h, 0.61],
        i % 3 === 0 ? tint.leafLight : tint.leaf,
        lod > 1 ? 7 : 5,
        4,
      );
      if (lod > 1) {
        const size = 0.18 + (i % 3) * 0.075;
        sphere(
          out,
          'accent',
          [pos + 0.12, y + 0.53 + h * 0.37, z + 0.28],
          [size, 0.18, size * 1.15],
          i % 2 ? tint.burgundy : tint.flower,
          6,
          4,
        );
      }
    }
  }
  const sides = lod > 1 ? 12 : 8;
  const bands = [
    [0.02, 0.24],
    [0.17, 0.34],
    [0.4, 0.39],
    [0.62, 0.31],
    [0.69, 0.21],
    [0.74, 0.24],
    [0.78, 0.24],
    [0.78, 0.17],
    [0.63, 0.15],
  ];
  for (const [x, z, y] of [
    [-8.3, 27.4, 0.04],
    [6.5, 24.8, 0.28],
  ]) {
    loft(
      out,
      'clay',
      bands.map(([h, r]) => radialRing(y + h, r, r, sides, [x, z])),
      tint.clay,
      { cap: false },
    );
  }
  if (lod > 1) {
    for (const [x, z] of [
      [-12, 18.8],
      [4.9, 18.82],
      [11.5, 18.82],
    ]) {
      const bands = [
        [0, 0.21],
        [0.34, 0.28],
        [0.37, 0.25],
      ];
      loft(
        out,
        'clay',
        bands.map(([h, r]) => radialRing(floor + h, r, r, sides, [x, z + 0.3])),
        tint.clay,
      );
      sphere(out, 'accent', [x, floor + 0.55, z + 0.3], [0.45, 0.39, 0.32], tint.leaf, 6, 5);
    }
  }
}

function build(out, lod) {
  shell(out, lod);
  ramp(out, lod);
  garden(out, lod);
}
export const larcoSkyline = (out) => build(out, 0);
export const larcoDistrict = (out) => build(out, 1);
export const larcoStreet = (out) => build(out, 2);
export const larcoCloseup = (out) => build(out, 3);
const recipe = 'larco-museum-model.mjs';
const camera = [35, 15, 72],
  lookAt = [-2, 4.1, 8];
export const larcoModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: larcoCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'reviewed-source-map-frame',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The white viceregal mansion of Lima’s Museo Larco, its raised garden approach, split curved portal and warm terracotta coping.',
  appearance: { kind: 'standing', representedDate: plan.representedDate },
  camera,
  lookAt,
  sunDirection: [-33, 38, 47],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'tile_ceramic',
    'concrete_plain',
    'wood_plain',
    'metal_painted',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'raised-garden-entry', position: [0, 5.8, 35], lookAt: [doorX, 5.22, front] },
    { name: 'ramp-and-garden-terrace', position: [-25, 5.9, 46], lookAt: [2, 3.3, 20] },
    { name: 'roofline-and-rear-rooms', position: [37, 24, -46], lookAt: [0, 4, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'casona-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'larcoSkyline',
    errorMeters: 0.46,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'larcoDistrict', 0.23],
        ['street', 'larcoStreet', 0.11],
        ['closeup', 'larcoCloseup', 0.051],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. Cherimoya.lima’s native courtyard photograph is CC0. OpenStreetMap footprint and approach are ODbL 1.0.',
};
