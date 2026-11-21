import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  brick: '88624f',
  red: '9b6f56',
  faded: '837465',
  ash: '837c6a',
  sill: 'a39a80',
  tile: '806655',
  wood: 'a28b68',
  timber: '615748',
  frame: '464c46',
  dark: '3d443e',
  bark: '817564',
  root: '968775',
  upper: '657647',
  blade: '6e7e4d',
  middle: '536440',
  shadow: '465738',
});
const surfaces = {
  walls: surface('wall', 'brick_longformat', 0.95),
  stone: surface('foundation', 'stone_ashlar', 0.94),
  tiles: surface('roof', 'tile_ceramic', 0.92),
  timber: surface('trim', 'wood_plain', 0.97),
  bark: surface('trim', 'wood_log', 0.96),
  steel: surface('trim', 'metal_bronze_cast', 0.86, 0.17),
  foliage: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.99 },
};
function taper(out, slot, a, b, from, to, sides, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const axis = [dx / length, dy / length, dz / length];
  const across =
    Math.hypot(dx, dz) > 0.01 ? [dz / Math.hypot(dx, dz), 0, -dx / Math.hypot(dx, dz)] : [1, 0, 0];
  const normal = [
    axis[1] * across[2] - axis[2] * across[1],
    axis[2] * across[0] - axis[0] * across[2],
    axis[0] * across[1] - axis[1] * across[0],
  ];
  const ring = (p, r) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i * Math.PI * 2) / sides;
      return p.map((v, j) => v + r * (Math.cos(t) * across[j] + Math.sin(t) * normal[j]));
    });
  loft(out, slot, [ring(a, from), ring(b, to)], color, { cap: false });
}
function wallStrip(out, w, u, v, lowA, lowB, highA, highB, slot, color, closeEnds = true) {
  const half = 0.25;
  const a = w.p(u, lowA, -half),
    b = w.p(v, lowB, -half),
    q = w.p(u, lowA, half),
    r = w.p(v, lowB, half);
  const A = w.p(u, highA, -half),
    B = w.p(v, highB, -half),
    Q = w.p(u, highA, half),
    R = w.p(v, highB, half);
  const inverse = w.normal.map((n) => -n);
  face(out, slot, [q, r, R, Q], w.normal, color);
  face(out, slot, [b, a, A, B], inverse, color);
  face(out, slot, [Q, R, B, A], up, color);
  if (closeEnds) {
    face(out, slot, [a, q, Q, A], [-w.normal[2], 0, w.normal[0]], color);
    face(out, slot, [r, b, B, R], [w.normal[2], 0, -w.normal[0]], color);
  }
}
function wallEdge(out, w, floor, heights, index, side, level) {
  const gable = heights[1] > heights[0];
  const top = (u) => mix(heights[0], heights[1], 1 - Math.abs((2 * u) / w.length - 1));
  const spacing = side % 2 === 0 ? 5.45 : 5.05;
  const cells = level === 0 ? 2 : Math.max(2, Math.round(w.length / spacing));
  const step = w.length / cells;
  const base = (u) => {
    const p = w.p(u, 0);
    return Math.min(grade([p[0], p[2]]) - 0.24, floor - 0.21);
  };
  const shade = [c.red, c.brick, c.faded, c.brick, c.faded][index];
  for (let cell = 0; cell < cells; cell++) {
    const a = step * cell,
      b = step * (cell + 1),
      m = (a + b) * 0.5;
    const broken = index > 0 && (index * 3 + cell + side * 2) % 7 === 0;
    const high = (u) => top(u) - (broken ? 0.74 + 0.23 * ((cell + side) % 3) : 0);
    const segment = (u, v, lo, hi, material = 'walls', color = shade) =>
      wallStrip(out, w, u, v, lo(u), lo(v), hi(u), hi(v), material, color);
    if (level === 0 || (level === 1 && (cell + side) % 2 === 1)) {
      segment(a, b, base, high);
      continue;
    }
    const fullDoor =
      (index === 0 && side === 2 && cell === Math.floor(cells / 2)) ||
      ((cell + 2 * index + side) % 6 === 2 && level > 1);
    const doorway = fullDoor ? 0.73 : 0.47;
    const low = fullDoor ? floor : floor + 1.18,
      lintel = fullDoor ? floor + 2.33 : floor + 2.25;
    const material = fullDoor ? 'stone' : 'walls';
    if (broken && cell === 1 && index > 1) {
      segment(a, b, base, () => floor + 0.58);
      continue;
    }
    if (Math.min(high(m - doorway), high(m + doorway)) < lintel + 0.22) {
      segment(a, b, base, high);
      continue;
    }
    segment(a, m - doorway, base, high);
    segment(m + doorway, b, base, high);
    if (!fullDoor) {
      segment(m - doorway, m + doorway, base, () => low);
      if (level >= 2) {
        for (const sign of [-1, 1]) {
          const v = w.p(m, low - 0.09, sign * 0.25);
          const tuck = w.p(m, low - 0.09, sign * 0.31);
          beam(
            out,
            'stone',
            [v[0], v[1], v[2]],
            [tuck[0], tuck[1], tuck[2]],
            doorway * 2.3,
            0.14,
            c.sill,
          );
        }
      }
    }
    segment(m - doorway, m + doorway, () => lintel, high, material, fullDoor ? c.sill : shade);
    if (level >= 2 && fullDoor) {
      panel(
        out,
        'stone',
        w,
        m - doorway - 0.095,
        m + doorway + 0.095,
        lintel - 0.07,
        lintel + 0.12,
        0.267,
        c.sill,
      );
    }
  }
  if (!gable || level < 2) return;
  for (const side of [-1, 1]) {
    const a = w.p(w.length * (side === 1 ? 0.12 : 0.88), top(w.length * 0.12) - 0.1, 0.28);
    const b = w.p(w.length * 0.5, heights[1] - 0.16, 0.28);
    beam(out, 'timber', a, b, 0.05, 0.08, c.timber);
  }
}
function house(out, room, index, level) {
  const [x0, z0, x1, z1] = room.bounds,
    poly = rect(...room.bounds);
  const floor = grade([(x0 + x1) * 0.5, (z0 + z1) * 0.5]) + 0.24;
  for (const [[a, b], i] of pairs(closed(poly)).map((p, i) => [p, i])) {
    const gable = room.axis === 'x' ? i % 2 === 1 : i % 2 === 0;
    wallEdge(
      out,
      edge(a, b, areaSign(poly)),
      floor,
      [floor + room.height, floor + (gable ? room.ridge : room.height)],
      index,
      i,
      level,
    );
  }
  if (index === 0) {
    const ym = floor + room.height,
      top = floor + room.ridge,
      mid = (z0 + z1) * 0.5;
    const patches = [
      { start: x0 - 0.22, end: x0 + 7.5 },
      { start: x1 - 5.5, end: x1 + 0.22 },
    ];
    for (const { start, end } of patches) {
      face(
        out,
        'tiles',
        [
          [start, ym, z0 - 0.22],
          [end, ym, z0 - 0.22],
          [end, top, mid],
          [start, top, mid],
        ],
        up,
        c.tile,
      );
      face(
        out,
        'tiles',
        [
          [start, top, mid],
          [end, top, mid],
          [end, ym, z1 + 0.22],
          [start, ym, z1 + 0.22],
        ],
        up,
        c.tile,
      );
    }
    if (level >= 2) {
      for (const x of [-12, -6, 0, 6, 12]) {
        beam(out, 'timber', [x, ym - 0.06, z0], [x, top - 0.16, mid], 0.15, 0.13, c.timber);
        beam(out, 'timber', [x, top - 0.16, mid], [x, ym - 0.06, z1], 0.15, 0.13, c.timber);
        beam(out, 'timber', [x, ym - 0.45, z0], [x, ym - 0.45, z1], 0.14, 0.12, c.timber);
      }
    }
  }
  if (index > 0 && level >= 2) {
    const y = floor + room.height - 0.31;
    for (const t of [0.16, 0.43, 0.76]) {
      const z = mix(z0 + 0.42, z1 - 0.42, t);
      beam(
        out,
        'timber',
        [x0, y, z],
        [mix(x0, x1, 0.37), y + 0.23, z - 0.18],
        0.15,
        0.14,
        c.timber,
      );
      beam(
        out,
        'timber',
        [x1, y, z + 0.13],
        [mix(x1, x0, 0.24), y + 0.19, z - 0.08],
        0.16,
        0.14,
        c.timber,
      );
    }
  }
}
function crown(out, p, rx, rz, height, level, index) {
  const sides = [4, 5, 8, 10][level];
  const profile =
    level === 0
      ? [
          [-0.55, 0.58],
          [0, 1],
          [0.6, 0.06],
        ]
      : level === 1
        ? [
            [-0.58, 0.48],
            [0.11, 1],
            [0.48, 0.75],
            [0.66, 0.06],
          ]
        : [
            [-0.58, 0.47],
            [-0.22, 0.87],
            [0.16, 1],
            [0.51, 0.71],
            [0.68, 0.058],
          ];
  const rings = profile.map(([y, r], j) =>
    radialRing(p[1] + height * y, rx * r, rz * r, sides, [p[0], p[2]], index * 0.73).map(
      ([x, y, z], k) => {
        const scale = 1 + 0.105 * Math.sin((index + 1.13) * (k + 1.2) * 1.83 + j * 0.69);
        return [p[0] + (x - p[0]) * scale, y, p[2] + (z - p[2]) * scale];
      },
    ),
  );
  loft(out, 'foliage', rings, [c.middle, c.upper, c.shadow, c.blade][index % 4]);
}
function banyan(out, tree, index, level) {
  const [x, z] = tree.center,
    [rx, rz] = tree.span;
  const base = grade(tree.center) - 0.19,
    top = base + tree.height;
  const n = [4, 4, 7, 9][level];
  const trunk = [
    [x, base, z],
    [x - 0.38, base + 2.05, z + 0.29],
    [x + 0.32, base + 4.3, z - 0.22],
    [x - 0.45, top - 3.18, z + 0.53],
  ];
  const radii = [0.87, 0.67, 0.59, 0.26];
  for (const [[a, b], i] of pairs(trunk).map((row, i) => [row, i]))
    taper(out, 'bark', a, b, radii[i], radii[i + 1], n, c.bark);
  const branches = [
    [-0.64, -0.34],
    [0.38, -0.72],
    [0.62, 0.33],
    [-0.37, 0.65],
    [-0.74, 0.26],
    [0.36, 0.69],
  ];
  const count = [3, 4, 6, 6][level];
  for (const [i, [u, v]] of branches.slice(0, count).entries()) {
    const a = trunk[(i % 2) + 1];
    const b = [x + u * rx * 0.49, top - 4.0 + (i % 3) * 0.55, z + v * rz * 0.55];
    const tip = [x + u * rx, top - 1.7 + (i % 3) * 0.36, z + v * rz];
    taper(out, 'bark', a, b, 0.39 - i * 0.028, 0.22, n, c.bark);
    if (level > 0) taper(out, 'bark', b, tip, 0.235, 0.055, n, c.bark);
    crown(out, [tip[0], tip[1] + 0.32, tip[2]], rx * 0.57, rz * 0.59, 3.25, level, i + index);
    if (level >= 2)
      crown(
        out,
        [x + u * rx * 0.63, top - 0.36 + (i % 2) * 0.83, z + v * rz * 0.57],
        rx * 0.41,
        rz * 0.49,
        2.18,
        level,
        i + index + 1,
      );
    if (level > 0) {
      const rootCount = [0, 0, 3, 5][level];
      for (let j = 0; j < rootCount; j++) {
        const px = b[0] + ((tip[0] - b[0]) * (j + 0.75)) / (rootCount + 1.2);
        const pz = b[2] + ((tip[2] - b[2]) * (j + 0.75)) / (rootCount + 1.2);
        const lean = j % 2 === 0 ? 0.23 : -0.29,
          ground = grade([px + lean, pz + 0.3]) - 0.08;
        const path = [
          [px, b[1] + 0.27 + j * 0.24, pz],
          [px + lean, (b[1] + ground) * 0.53, pz + 0.11],
          [px + lean * 0.65, ground, pz + 0.3],
        ];
        taper(out, 'bark', path[0], path[1], 0.072, 0.048, 5, c.root);
        taper(out, 'bark', path[1], path[2], 0.051, 0.073, 5, c.root);
      }
    }
  }
  if (level < 2) return;
  const rootRows = [
    [-3.1, 1.0],
    [1.85, 3.2],
    [-1.9, -2.68],
    [2.65, -1.6],
    [0.85, 3.5],
  ];
  for (const [i, [u, v]] of rootRows.entries()) {
    const a = [x, base + 1.88 + (i % 3) * 0.32, z],
      b = [x + u * 0.58, base + 0.55, z + v * 0.57];
    const p = [x + u, grade([x + u, z + v]) - 0.08, z + v];
    taper(out, 'bark', a, b, 0.38 - i * 0.03, 0.19, n, c.bark);
    taper(out, 'bark', b, p, 0.21, 0.06, n, c.root);
  }
}
function rootsAcrossWalls(out, level) {
  if (level < 2) return;
  for (const [i, [x, za, zb]] of [
    [-12.23, -6, 7],
    [-1.1, -12, 0],
    [9.3, -2, 13],
  ].entries()) {
    const rootCount = level === 2 ? 5 : 10;
    for (let j = 0; j < rootCount; j++) {
      const z = mix(za, zb, (j + 0.5) / rootCount),
        b = grade([x, z]);
      const lean = 0.17 * Math.sin(j * 1.83 + i);
      const root = [
        [x + lean, b - 0.06, z + 0.16],
        [x + lean + 0.07, b + 1.16, z - 0.12],
        [x + 0.12, b + 2.78, z + 0.19],
        [x - 0.72, b + 4.0 + (j % 4) * 0.3, z - 1.65],
      ];
      for (const [a, b] of pairs(root))
        taper(
          out,
          'bark',
          a,
          b,
          0.066 + (j % 3) * 0.027,
          0.048 + (j % 3) * 0.021,
          5,
          j % 3 === 0 ? c.bark : c.root,
        );
    }
  }
}
const deckPoint = ([x, z, h]) => [x, grade([x, z]) + h, z];
function deckSegment(out, a, b, level, width = 1.48) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    len = Math.hypot(dx, dz),
    nx = dz / len,
    nz = -dx / len;
  const point = (t, side, y) => [
    mix(a[0], b[0], t) + nx * side,
    mix(a[1], b[1], t) + y,
    mix(a[2], b[2], t) + nz * side,
  ];
  const rise = Math.abs(b[1] - a[1]),
    steps = level > 0 && rise > 1.4 ? Math.ceil(rise / 0.185) : 1;
  const y0 = Math.min(a[1], b[1]);
  for (let k = 0; k < steps; k++) {
    const t = k / steps,
      u = (k + 1) / steps,
      low = y0 + (rise * (b[1] > a[1] ? k : steps - k - 1)) / steps;
    const hi = steps === 1 ? 0 : low + rise / steps;
    const p = (at, side, offset) => {
      const q = point(at, side, offset);
      if (steps > 1) q[1] = hi + offset;
      return q;
    };
    const p1 = p(t, -width * 0.5, 0),
      p2 = p(u, -width * 0.5, 0),
      p3 = p(u, width * 0.5, 0),
      p4 = p(t, width * 0.5, 0);
    face(out, 'timber', [p1, p2, p3, p4], up, c.wood);
    if (steps > 1) {
      const edgeT = b[1] > a[1] ? t : u;
      const normal = [
        (-Math.sign(b[1] - a[1]) * dx) / len,
        0,
        (-Math.sign(b[1] - a[1]) * dz) / len,
      ];
      face(
        out,
        'timber',
        [
          p(edgeT, -width * 0.5, -rise / steps),
          p(edgeT, width * 0.5, -rise / steps),
          p(edgeT, width * 0.5, 0),
          p(edgeT, -width * 0.5, 0),
        ],
        normal,
        c.wood,
      );
    }
  }
  if (level === 0) return;
  for (const side of [-width * 0.52, width * 0.52]) {
    beam(out, 'steel', point(0, side, -0.17), point(1, side, -0.17), 0.091, 0.2, c.frame);
    if (Math.max(a[1] - grade([a[0], a[2]]), b[1] - grade([b[0], b[2]])) < 1.1) continue;
    const n = level === 1 ? 1 : Math.max(2, Math.round(len / 1.4));
    beam(out, 'steel', point(0, side, 0.91), point(1, side, 0.91), 0.043, 0.051, c.frame);
    if (level >= 2)
      beam(out, 'steel', point(0, side, 0.5), point(1, side, 0.5), 0.027, 0.032, c.frame);
    for (let i = 0; i <= n; i++) {
      beam(
        out,
        'steel',
        point(i / n, side, -0.045),
        point(i / n, side, 0.91),
        0.039,
        0.043,
        c.frame,
      );
    }
  }
  if (level > 0) {
    for (const t of level === 1 ? [0.5] : [0.22, 0.71]) {
      const p = point(t, 0, -0.19);
      const base = grade([p[0], p[2]]) - 0.09;
      if (p[1] < base + 0.33) continue;
      beam(out, 'steel', [p[0], base, p[2]], p, 0.101, 0.165, c.frame);
    }
  }
}
function platform(out, values, level) {
  const [x, y, z] = deckPoint(values),
    w = level === 0 ? 1.26 : 1.44;
  block(out, 'timber', x - w, y - 0.15, z - w, w * 2, 0.19, w * 2, c.wood);
  const corners = rect(x - w, z - w, x + w, z + w);
  const outline = closed(corners);
  for (const [[a, b], i] of pairs(outline).map((items, i) => [items, i])) {
    const [u, v] = a,
      [p, q] = b,
      postTop = y + 2.22;
    if (level > 0 || i % 2 === 0) {
      beam(out, 'steel', [u, grade(a) - 0.08, v], [u, postTop, v], 0.077, 0.086, c.frame);
      beam(out, 'steel', [u, postTop, v], [p, postTop, q], 0.087, 0.07, c.frame);
    }
    if (level === 0 || i === 1) continue;
    beam(out, 'steel', [u, y + 0.97, v], [p, y + 0.97, q], 0.065, 0.053, c.frame);
    if (level < 2) continue;
    for (const t of [0.17, 0.33, 0.5, 0.67, 0.83]) {
      const X = mix(u, p, t),
        Z = mix(v, q, t);
      beam(out, 'steel', [X, y + 0.07, Z], [X, y + 2.19, Z], 0.017, 0.018, c.frame);
      if (level === 3) {
        const levelY = y + t * 2.16;
        beam(out, 'steel', [u, levelY, v], [p, levelY, q], 0.014, 0.014, c.frame);
      }
    }
  }
}
function build(out, level) {
  for (const [i, warehouse] of d.warehouses.entries()) house(out, warehouse, i, level);
  for (const [i, tree] of d.banyans.entries()) banyan(out, tree, i, level);
  rootsAcrossWalls(out, level);
  const deck = d.deck
    .slice(0, -1)
    .concat([[d.bridgeRoute[0][0], d.bridgeRoute[0][1], 4.72]])
    .map(deckPoint);
  for (const [a, b] of pairs(deck)) deckSegment(out, a, b, level);
  for (const p of d.platforms) platform(out, p, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'anping-tree-house-model.mjs';
const camera = [54, 31, 56],
  lookAt = [-2, 4, 0];
const errors = { district: 0.65, street: 0.22, closeup: 0.077 };
export const anpingTreeHouseAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-site-and-estimated-outline',
  groundContactBasis:
    'Original coastal terrain at the visitor approach and along the former warehouse floors.',
  brief:
    'Five partly roofless former red-brick warehouses in Tainan with three broad banyan groups, aerial roots and raised timber walks on black steel.',
  camera,
  lookAt,
  sunDirection: [24, 96, 70],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'brick-front-and-banyan-crowns', position: [30, 13, 44], lookAt: [0, 4, 7] },
    { name: 'open-roof-walks-and-observation-towers', position: [40, 25, -19], lookAt: [3, 5, -6] },
    {
      name: 'roots-over-brick-and-granite',
      position: [-9.55, 5.85, 9.4],
      lookAt: [-12.4, 2.55, -2.6],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'anping-tree-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.14,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
