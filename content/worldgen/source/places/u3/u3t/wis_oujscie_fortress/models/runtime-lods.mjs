import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  panel,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  buildWisloujscie,
  wisloujscieSections,
} from '../../../../../../../../packages/worldgen/scripts/wisloujscie-model.mjs';
import plan from '../../../../../../../../packages/worldgen/scripts/wisloujscie-footprints.json' with {
  type: 'json',
};

const { arch, cleanLoop, flatPolygon, profileArc, terrainRing, tower } = wisloujscieSections;
const { features } = plan;
const wall = features['640670274'].outline;
const rampart = features['640670272'].outline;
const innerRampart = features['640670279'].outline;
const court = [
  [2, -34],
  [39, -21],
  [48, -1],
  [58, 10],
  [45, 44],
  [24, 57],
  [-27, 38],
  [-29, 9],
  [-17, -22],
];
const brick = [0.57, 0.3, 0.19],
  salmon = [0.73, 0.32, 0.27],
  pale = [0.81, 0.82, 0.72];
const timber = [0.52, 0.37, 0.22],
  tile = [0.51, 0.2, 0.14],
  stone = [0.53, 0.51, 0.44];
const dark = [0.1, 0.14, 0.12],
  green = [0.24, 0.32, 0.2];
const turn = 2 * Math.PI,
  radians = (d) => (d * Math.PI) / 180;
const point = (a, r, y = 0) => [Math.sin(a) * r, y, Math.cos(a) * r];

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  ground: { slot: 'foundation', graph: 'gravel', roughness: 1, metallic: 0 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'fort-window-glazing',
    roughness: 0.34,
    metallic: 0.06,
  },
};

function walls(out, outline, lo, hi, material, color, skipGate = false) {
  const signed = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  const side = Math.sign(signed);
  for (let i = 0; i < outline.length; i++) {
    if (skipGate && (i === 36 || i === 37)) continue;
    const [x, z] = outline[i],
      [a, b] = outline[(i + 1) % outline.length];
    if (Math.hypot(a - x, b - z) < 0.03) continue;
    face(
      out,
      material,
      [
        [x, lo, z],
        [a, lo, b],
        [a, hi, b],
        [x, hi, z],
      ],
      color,
      [(b - z) * side, 0, -(a - x) * side],
    );
  }
}

function fortTerrain(out) {
  walls(out, cleanLoop(wall), -4.35, 2.58, 'brick', brick, true);
  terrainRing(out, wall, rampart, 2.58, 4.23, [], true);
  terrainRing(out, rampart, innerRampart, 4.23, 4.23);
  terrainRing(out, innerRampart, court, 4.23, 0);
  flatPolygon(out, 'ground', court, -0.02, [0.57, 0.55, 0.43]);
}

function shortTower(out, detail) {
  const n = detail.segments;
  profileArc(
    out,
    'brick',
    [
      [0, 3.86],
      [6.27, 3.86],
    ],
    brick,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'plaster',
    [
      [6.27, 3.86],
      [22.93, 3.71],
    ],
    pale,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'brick',
    [
      [22.93, 3.71],
      [23.08, 3.77],
    ],
    brick,
    0,
    turn,
    n,
  );
  flatPolygon(
    out,
    'limestone',
    Array.from({ length: n }, (_, i) => {
      const p = point((turn * i) / n, 3.76);
      return [p[0], p[2]];
    }),
    22.93,
    [0.53, 0.54, 0.46],
  );
  const doorway = radians(-28);
  const flag = transformed(out, doorway, point(doorway, 3.48));
  beam(flag, 'metal', [0, 22.5, 0], [0, 27.43, 0], 0.058, 0.058, stone);
  for (const [y, color] of [
    [25.98, [0.79, 0.015, 0.035]],
    [26.56, [0.91, 0.92, 0.88]],
  ]) {
    const points = [
      [0, y, 0],
      [1.52, y + 0.16, 0.18],
      [1.55, y + 0.73, 0.12],
      [0, y + 0.58, 0],
    ];
    face(flag, 'metal', points, color, [0, 0, 1]);
    face(flag, 'metal', points, color, [0, 0, -1]);
  }
  if (!detail.posts) return;
  const fitRadius = (y) => 3.86 - (0.15 * (y - 6.27)) / (22.93 - 6.27);
  for (let i = 0; i < 8; i++) {
    const a = (turn * i) / 8;
    for (const y of [7.1, 11.7, 16.4, 20.3]) {
      const facade = transformed(out, a, point(a, fitRadius(y) + 0.016));
      panel(facade, 'glass', -0.14, 0.14, y, y + 0.71, 0, dark);
    }
  }
  const front = transformed(out, doorway, point(doorway, 3.9));
  panel(front, 'wood', -0.79, 0.79, 0.03, 2.72, 0, dark);
  panel(front, 'limestone', -0.94, 0.94, 3.24, 5.86, 0, pale);
}

function houses(out, detail) {
  const n = detail.segments;
  profileArc(
    out,
    'brick',
    [
      [0, 17.05],
      [11.32, 17.05],
    ],
    brick,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'brick',
    [
      [6.36, 12.25],
      [0, 12.25],
    ],
    brick,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'tiles',
    [
      [12.23, 17.47],
      [10.45, 11.85],
    ],
    tile,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'wood',
    [
      [10.37, 11.85],
      [12.15, 17.47],
    ],
    timber,
    0,
    turn,
    n,
  );
  profileArc(
    out,
    'wood',
    [
      [6.33, 16.38],
      [6.33, 12.12],
    ],
    timber,
    0,
    turn,
    n,
  );
  for (let i = 0; i < detail.posts; i++) {
    const a = (turn * i) / detail.posts;
    const upright = transformed(out, a, point(a, 12.21));
    box(upright, 'wood', [-0.11, 6.4, -0.11], [0.11, 10.45, 0.11], timber);
    if (detail.posts > 16)
      beam(upright, 'wood', [0, 8.92, 0], [0.84, 10.16, 0], 0.17, 0.16, timber);
  }
  for (let i = 0; i < 10; i++) {
    const a = radians(30.5 + i * 12.75);
    const home = transformed(out, a, point(a, 21.73));
    box(home, 'plaster', [-2.39, 0, -5.22], [2.39, 6.8, 0], salmon);
    home.addTriangle(
      'plaster',
      'palette:#fff',
      [
        [-2.39, 6.8, 0],
        [2.39, 6.8, 0],
        [0, 10.13, 0],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      salmon,
    );
    for (const x of [-2.39, 2.39]) {
      face(
        home,
        'tiles',
        [
          [x, 6.8, 0],
          [x, 6.8, -5.22],
          [0, 10.13, -5.22],
          [0, 10.13, 0],
        ],
        tile,
        [0, 1, 0],
      );
    }
    if (!detail.posts) continue;
    const upper = i % 2 ? -0.56 : 0;
    panel(home, 'glass', -0.7 - 0.68, -0.7 + 0.68, 0.58, 2.15, 0.018, dark);
    panel(home, 'wood', 1.1, 1.86, 0.04, 2.18, 0.02, dark);
    panel(home, 'glass', upper - 0.65, upper + 0.65, 3.89, 5.73, 0.018, dark);
    panel(home, 'glass', -0.52, 0.52, 7.35, 8.4, 0.018, dark);
    if (detail.posts <= 16) continue;
    for (const x of [-1.53, 0.15])
      panel(home, 'wood', x - 0.23, x + 0.23, 0.54, 2.19, 0.025, green);
    for (const y of [0.53, 3.85, 7.32])
      panel(home, 'limestone', -0.84, 0.83, y, y + 0.075, 0.035, pale);
    const chimney = transformed(out, a - radians(6.2), point(a - radians(6.2), 17.59));
    box(chimney, 'brick', [-0.31, 7.9, -0.28], [0.31, 12.6, 0.28], brick);
  }
  const lo = radians(-42),
    hi = radians(24),
    sections = detail.posts > 16 ? 12 : 6;
  profileArc(
    out,
    'plaster',
    [
      [0, 21.87],
      [6.8, 21.87],
    ],
    salmon,
    lo,
    hi,
    sections,
  );
  profileArc(
    out,
    'tiles',
    [
      [6.85, 22.17],
      [9.89, 18.52],
      [10.02, 17.02],
    ],
    tile,
    lo,
    hi,
    sections,
  );
  if (detail.posts) {
    for (let i = 0; i < 8; i++) {
      const a = lo + ((hi - lo) * (i + 0.5)) / 8;
      const front = transformed(out, a, point(a, 21.89));
      panel(front, 'glass', -0.55, 0.55, 0.65, 2.25, 0.035, dark);
      panel(front, 'glass', -0.57, 0.57, 3.94, 5.8, 0.035, dark);
    }
    const porch = transformed(out, radians(-9), point(radians(-9), 22.08));
    box(porch, 'limestone', [-1.37, 0, -1.31], [1.37, 0.55, 1.95], pale);
    box(porch, 'limestone', [-1.5, 3.57, -0.25], [1.5, 3.79, 1.25], pale);
    for (const x of [-1.15, 1.15])
      beam(porch, 'limestone', [x, 0.55, 0], [x, 3.56, 0], 0.22, 0.24, pale);
  }
}

function barracks(out) {
  for (const [id, y, roofSurface] of [
    ['185876662', 5.62, 'metal'],
    ['185876646', 2.81, 'tiles'],
  ]) {
    const outline = cleanLoop(features[id].outline);
    walls(out, outline, 0, y, 'brick', brick);
    flatPolygon(out, roofSurface, outline, y, roofSurface === 'tiles' ? tile : [0.29, 0.3, 0.28]);
  }
}

function walkway(out, a, b, width, slot, fill, rails, span) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const half = width / 2,
    end = length / 2;
  const walk = transformed(out, Math.atan2(dx, dz), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
  box(walk, slot, [-half, span ? -0.43 : -4.2, -end], [half, span ? 0.03 : 0.035, end], fill);
  if (!rails) return;
  for (const x of [-half, half]) {
    beam(walk, 'wood', [x, 0.91, -end], [x, 0.91, end], 0.09, 0.11, timber);
    for (let i = 0; i <= rails; i++) {
      const z = -end + (i * length) / rails;
      beam(walk, 'wood', [x, 0.015, z], [x, 0.91, z], 0.1, 0.1, timber);
    }
  }
  if (!span) return;
  for (const x of [-half * 0.86, half * 0.86]) {
    beam(walk, 'wood', [x, -0.1, -end * 0.8], [x, 4.75, -end * 0.8], 0.34, 0.36, timber);
    beam(walk, 'wood', [x, 4.72, -end * 1.74], [x, 4.91, end * 0.98], 0.2, 0.31, timber);
    beam(walk, 'metal', [x, 0.12, end * 0.9], [x, 4.9, end * 0.9], 0.05, 0.05, dark);
  }
  beam(
    walk,
    'wood',
    [-half * 0.9, 4.58, -end * 0.8],
    [half * 0.9, 4.58, -end * 0.8],
    0.24,
    0.24,
    timber,
  );
}

function access(out, detail) {
  for (const id of ['39965893', '304439880', '174765668']) {
    const p = features[id].outline;
    const end = p.length - 1;
    walkway(out, p[end - 1], p[end], 5.7, 'ground', [0.58, 0.55, 0.46], detail.rails, false);
  }
  const q = features['640674957'].outline;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  walkway(
    out,
    mid(q[0], q[3]),
    mid(q[1], q[2]),
    Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]),
    'wood',
    timber,
    detail.rails,
    true,
  );
  const gate = transformed(out, Math.atan2(0.905, 0.425), [60.0987, 0, 45.3311]);
  for (const x of [-3.09, 3.09]) {
    box(gate, 'limestone', [x - 1.08, 0, -0.35], [x + 1.08, 5.06, 0.63], stone);
  }
  box(gate, 'limestone', [-4.29, 4.11, -0.1], [4.29, 5.52, 0.95], stone);
  panel(gate, 'wood', -1.99, 1.99, 0.03, 4.12, -0.29, dark);
  if (detail.posts) arch(gate, 3.96, 0.03, 4.1, 0.635, 0.94, stone, 'limestone');
}

function build(out, detail) {
  fortTerrain(out);
  houses(out, detail);
  barracks(out);
  access(out, detail);
  if (detail.detailedTower) {
    tower(runtimeSurfaces(out), true);
  } else {
    shortTower(out, detail);
  }
}

const replaceSlot = { rubble: 'limestone', concrete: 'limestone', canvas: 'metal' };
function runtimeSurfaces(out) {
  return {
    addQuad: (slot, ...args) => out.addQuad(replaceSlot[slot] ?? slot, ...args),
    addTriangle: (slot, ...args) => out.addTriangle(replaceSlot[slot] ?? slot, ...args),
    addConvexPolygon: (slot, ...args) => out.addConvexPolygon(replaceSlot[slot] ?? slot, ...args),
  };
}

export const buildSkyline = (out) => build(out, { segments: 12, posts: 0, rails: 0 });
export const buildDistrict = (out) => build(out, { segments: 24, posts: 16, rails: 2 });
export const buildStreet = (out) =>
  build(out, { segments: 48, posts: 32, rails: 4, detailedTower: true });
export function buildCloseup(out) {
  buildWisloujscie(runtimeSurfaces(out), true);
}
