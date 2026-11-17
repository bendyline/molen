/** Brest Fortress: surviving citadel, commemorative entrances and memorials. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.84 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.86 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.61 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.64 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.71 },
  titanium: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.54 },
};
const tints = {
  brick: [0.43, 0.18, 0.103],
  red: [0.5, 0.22, 0.128],
  stone: [0.74, 0.67, 0.52],
  white: [0.84, 0.775, 0.628],
  concrete: [0.59, 0.572, 0.529],
  granite: [0.31, 0.307, 0.277],
  plaster: [0.75, 0.65, 0.464],
  roof: [0.18, 0.258, 0.204],
  copper: [0.31, 0.4, 0.225],
  gold: [0.78, 0.556, 0.185],
  titanium: [0.58, 0.62, 0.61],
  grass: [0.346, 0.412, 0.214],
  dark: [0.136, 0.125, 0.105],
  flame: [0.923, 0.44, 0.103],
};
const tint = (name, factor = 1) => tints[name].map((c) => c * factor);
const up = [0, 1, 0];
const phase = (n) => ((n * 105 + 73) % 127) / 127;
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const at =
  ([cx, y, cz], [fx, fz]) =>
  (u, h, v) => [cx + fz * u + fx * v, y + h, cz - fx * u + fz * v];

function face(out, slot, points, color, direction) {
  let normal = normalFor(...points);
  if (direction && normal.reduce((s, x, i) => s + x * direction[i], 0) < 0) {
    points = points.toReversed();
    normal = normal.map((x) => -x);
  }
  if (Math.hypot(...normal) < 0.51) return;
  if (points.length === 3) out.addTriangle(slot, '', points, normal, undefined, color);
  else out.addQuad(slot, '', points, normal, undefined, color);
}
function plate(out, slot, outline, holes, make, normal, color) {
  const points = [...outline, ...holes.flat()];
  const starts = holes.map(
    (_, i) => outline.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0),
  );
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => make(...points[j])),
      color,
      normal,
    );
}
function hull(out, slot, ringA, ringB, color) {
  const area = ringA.reduce((s, p, k) => {
    const q = ringA[(k + 1) % ringA.length];
    return s + p[0] * q[2] - p[2] * q[0];
  }, 0);
  for (let i = 0; i < ringA.length; i++) {
    const j = (i + 1) % ringA.length;
    const n = [ringA[j][2] - ringA[i][2], 0, ringA[i][0] - ringA[j][0]].map(
      (x) => x * Math.sign(area),
    );
    face(out, slot, [ringA[i], ringB[i], ringB[j], ringA[j]], color, n);
  }
}

function localStone(out, P, slot, center, radius, color, d) {
  const sides = d === 0 ? 4 : d === 1 ? 5 : d === 2 ? 7 : 10;
  const [x, y, z] = center,
    [rx, ry, rz] = radius;
  const levels =
    d === 0
      ? [
          [-0.84, 0.53],
          [0.12, 1],
          [0.93, 0.43],
        ]
      : [
          [-0.95, 0.4],
          [-0.68, 0.78],
          [-0.21, 1],
          [0.45, 0.87],
          [0.94, 0.45],
        ];
  loft(
    out,
    slot,
    levels.map(([h, r], band) =>
      radialRing(y + h * ry, rx * r, rz * r, sides, [x, z], 0.18).map(([u, v, q], i) => {
        const n = 0.87 + 0.22 * phase(i * 3 + band * 19);
        return P(x + (u - x) * n, v + (phase(i + band) * 0.11 - 0.055) * ry, z + (q - z) * n);
      }),
    ),
    color,
  );
}

function courage(out, piece, d) {
  const P = at(piece.position, piece.front),
    color = tint('concrete', 0.99);
  // The head sits into the angular folds of the carved banner, with the left half projecting.
  const section = [
    [-24, 0],
    [-24, 8],
    [-19, 14],
    [-13, 16],
    [-8, 21],
    [0, 23],
    [8, 24],
    [17, 28],
    [22, 26],
    [23, 20],
    [23, 1],
    [19, -1],
  ];
  const rear = section.map(([x, h]) => P(x, h, -8 + Math.abs(x) * 0.1));
  const front = section.map(([x, h]) => P(x, h, 2 + 0.27 * h + phase(Math.round(h * 2))));
  for (let i = 0; i < section.length; i++) {
    const j = (i + 1) % section.length;
    const [x, h] = section[i],
      [u, v] = section[j];
    const n = normalFor(P(x, h, -10), P(u, v, -10), P(u, v, 10));
    face(
      out,
      'concrete',
      [rear[i], rear[j], front[j], front[i]],
      tint('concrete', 0.89 + phase(i) * 0.23),
      n,
    );
  }
  const direction = [piece.front[0], 0, piece.front[1]];
  plate(
    out,
    'concrete',
    section,
    [],
    (x, h) => P(x, h, -8 + Math.abs(x) * 0.1),
    direction.map((x) => -x),
    tint('concrete', 0.9),
  );
  plate(
    out,
    'concrete',
    section,
    [],
    (x, h) => P(x, h, 2 + 0.27 * h + phase(Math.round(h * 2))),
    direction,
    tint('concrete', 0.92),
  );
  if (d > 0) {
    localStone(out, P, 'concrete', [-10, 8.2, 8.0], [13.4, 7.9, 8.6], color, d);
    localStone(out, P, 'concrete', [7.65, 9, 8.8], [10.5, 8.3, 7.5], tint('concrete', 0.9), d);
  }
  localStone(out, P, 'concrete', [-7.1, 17.2, 9.25], [6.74, 10.6, 6.1], color, d);
  const chin = [
    [-6.3, 12.6, 14.65],
    [-2.38, 13.8, 13.68],
    [-1.85, 17, 13.49],
    [-2.82, 22.43, 13.8],
    [-8.54, 23.88, 13.84],
    [-12.6, 20.23, 13.01],
    [-11.71, 16.04, 13.6],
    [-9.5, 13.11, 14.98],
  ];
  const structure = [
    [-6.9, 17.9, 16.45],
    [-6.96, 14.34, 15.64],
    [-6.93, 19.8, 15.66],
  ];
  for (let i = 0; i < chin.length; i++) {
    const center = structure[i === 0 || i >= 6 ? 1 : i >= 3 && i <= 5 ? 2 : 0];
    face(
      out,
      'concrete',
      [P(...chin[i]), P(...chin[(i + 1) % chin.length]), P(...center)],
      tint('concrete', 0.92 + phase(i * 2) * 0.19),
      direction,
    );
  }
  if (d >= 1) {
    const detail = (a, b, n, f) =>
      beam(out, 'concrete', P(...a), P(...b), n, n, tint('concrete', f));
    detail([-10.45, 19.03, 15.05], [-7.54, 19.08, 15.8], 0.45, 1.01);
    detail([-6.36, 19.01, 15.92], [-3.9, 18.75, 14.99], 0.45, 0.98);
    detail([-6.72, 18.72, 16.14], [-6.5, 16.4, 17.42], 0.72, 1.04);
    detail([-8.41, 15.45, 16.0], [-5.26, 15.2, 16.41], 0.34, 0.84);
    for (const x of [-12.77, -1.25])
      localStone(out, P, 'concrete', [x, 18.05, 9.64], [1.18, 2.02, 1.14], color, d);
    localStone(
      out,
      P,
      'concrete',
      [-7.41, 23.5, 8.86],
      [6.1, 4.8, 6.22],
      tint('concrete', 1.04),
      d,
    );
    const footing = [
      [P(-22, -1, -12), P(23, -1, -12), P(23, -1, 10), P(-22, -1, 10)],
      [P(-22, 0.7, -12), P(23, 0.7, -12), P(23, 0.7, 10), P(-22, 0.7, 10)],
    ];
    hull(out, 'granite', ...footing, tint('granite', 1.12));
    if (d >= 2) {
      for (let i = 0; i < 8; i++) {
        const x = -21 + i * 5.32,
          y = 2.3 + phase(i) * 1.1;
        const r = 2.0,
          w = 2.2;
        face(
          out,
          'concrete',
          [
            P(x - w, y - 1, -8.13 + Math.abs(x - w) * 0.1),
            P(x + w, y - 1, -8.13 + Math.abs(x + w) * 0.1),
            P(x + w, y + r, -7.98 + Math.abs(x + w) * 0.1),
            P(x - w, y + r, -7.98 + Math.abs(x - w) * 0.1),
          ],
          tint('concrete', 0.82 + phase(i + 1) * 0.22),
          direction.map((v) => -v),
        );
      }
    }
  }
}

function thirst(out, piece, d) {
  const P = at(piece.position, piece.front),
    stone = tint('concrete', 0.97);
  const parts = [
    [[0, -0.17, 0], [7.86, 1.14, 10.25], 0.84],
    [[0.28, 1.83, -4.7], [3.51, 1.46, 5.33], 0.96],
    [[-0.35, 2.61, 0.67], [3.34, 1.46, 4.04], 1.03],
    [[-0.77, 3.51, 3.5], [1.28, 1.67, 1.42], 1.07],
    [[2.17, 1.18, 4], [1.23, 1.15, 4.85], 0.97],
    [[2.22, 0.91, 8.48], [1.51, 0.69, 1.25], 1.04],
    [[-2.18, 1.13, 3.49], [1.24, 1.04, 2.45], 0.93],
  ];
  for (const [p, r, v] of d === 0 ? parts.slice(0, 3) : parts)
    localStone(out, P, 'concrete', p, r, tint('concrete', v), d);
  if (d >= 1) {
    const details = [
      [[-1.66, 4.18, 4.57], [-0.69, 4.09, 4.91], 0.23],
      [[-0.71, 4.01, 4.84], [-0.51, 3.31, 5.13], 0.33],
      [[-1.12, 2.95, 4.73], [-0.34, 2.91, 4.78], 0.18],
      [[-2.93, 0.93, 3.69], [-3.4, 4.35, 4.25], 0.24],
      [[-3.25, 0.9, 1.89], [-3.55, 3.1, 4.05], 0.35],
    ];
    for (const [a, b, w] of details) beam(out, 'concrete', P(...a), P(...b), w, w, stone);
    for (let i = 0; i < 4; i++) {
      const x = 1.51 + i * 0.52;
      beam(
        out,
        'concrete',
        P(x, 1.16, 8.4),
        P(x + 0.14, 0.69, 9.46),
        0.36,
        0.36,
        tint('concrete', 0.88 + phase(i) * 0.22),
      );
    }
    const helmet = P(2.65, 0.68, 9.55);
    sphere(out, 'granite', helmet, [1.04, 0.61, 0.98], tint('granite', 1.44), d >= 2 ? 12 : 8, 6);
  }
}

function bayonet(out, piece, d) {
  const P = at(piece.position, piece.front);
  const rings = [
    [-1, 4.4],
    [0.25, 4.4],
    [3.05, 2.74],
    [77.5, 1.53],
    [104.45, 0.035],
  ];
  const cross = (y, r) =>
    [
      [0, r],
      [r * 0.64, 0],
      [0, -r],
      [-r * 0.64, 0],
    ].map(([x, z]) => P(x, y, z));
  const elevations = rings.map(([y, r]) => cross(y, r));
  loft(out, 'granite', elevations.slice(0, 2), tint('granite', 1.25));
  loft(out, 'titanium', elevations.slice(1), tint('titanium'));
  if (d >= 2)
    for (let i = 0; i < 3; i++)
      for (const j of [0, 2]) {
        const a = elevations[i + 1][j],
          b = elevations[i + 2][j];
        beam(out, 'titanium', a, b, 0.13, 0.13, tint('titanium', 1.13));
      }
}

function flameAndSlabs(out, piece, d) {
  const P = at(piece.position, piece.front),
    [x, y, z] = piece.position;
  if (d > 0) {
    loft(
      out,
      'granite',
      [-0.38, 0.28].map((h) => radialRing(y + h, 2.7, 2.7, d >= 2 ? 10 : 6, [x, z])),
      tint('granite'),
    );
    localStone(out, P, 'granite', [0, 0.58, 0], [0.36, 0.46, 0.36], tint('flame'), d);
  }
  for (let row = 0; row < 3; row++) {
    const h = -0.43 - row * 0.23;
    if (d === 0) {
      if (row === 0)
        face(
          out,
          'granite',
          [P(-21, -0.11, 4), P(21, -0.11, 4), P(21, -0.11, 24), P(-21, -0.11, 24)],
          tint('granite', 1.27),
          up,
        );
      continue;
    }
    loft(
      out,
      'granite',
      [h - 0.9, h + 0.53].map((q) =>
        chamferedRectangle(0, q, 6.2 + row * 7, 43.5, 5.4, 0.24).map(([x, y, z]) => P(x, y, z)),
      ),
      tint('granite', 1.27),
    );
    for (let i = 0; i < 12; i++) {
      const x = -20.6 + i * 3.71;
      const layer = h + 0.61,
        z = 6.2 + row * 7;
      face(
        out,
        'granite',
        [
          P(x, layer, z - 1.8),
          P(x + 3.25, layer, z - 1.8),
          P(x + 3.25, layer + 0.24, z + 2.2),
          P(x, layer + 0.24, z + 2.2),
        ],
        tint('granite', 1.09 + phase(row * 7 + i) * 0.17),
        up,
      );
      if (d >= 3 && i % 3 === row) {
        localStone(
          out,
          P,
          'concrete',
          [x + 1.6, layer + 0.22, z - 0.9],
          [0.66, 0.23, 0.53],
          tint('grass', 0.85),
          d,
        );
        localStone(
          out,
          P,
          'brick',
          [x + 1.6, layer + 0.43, z - 0.9],
          [0.21, 0.08, 0.25],
          tint('red', 1.32),
          d,
        );
      }
    }
  }
}

export function buildTowerLevel(out, level) {
  const detail = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (detail < 0) throw new Error(`Unknown Brest Fortress level ${level}`);
  for (const gate of layout.gates) gateModel(out, gate, detail);
  for (const part of layout.buildings)
    if (
      detail > 0 ||
      part.kind !== 'ruin' ||
      ['whitePalace', 'starCasemates', 'kholmEastRuins'].includes(part.name)
    )
      masonry(out, part, detail);
  for (const piece of layout.pieces) {
    const build = { church, bayonet, courage, thirst, eternalFlame: flameAndSlabs }[piece.name];
    build(out, piece, detail);
  }
}

export function buildMaster(out) {
  buildTowerLevel(out, 'master');
}
export const buildSkyline = (out) => buildTowerLevel(out, 'skyline');
export const buildDistrict = (out) => buildTowerLevel(out, 'district');
export const buildStreet = (out) => buildTowerLevel(out, 'street');
export const buildCloseup = (out) => buildTowerLevel(out, 'closeup');

function gateModel(out, gate, d) {
  const { name, center, front, width, depth, height, heights } = gate;
  const star = name === 'star',
    kholm = name === 'kholm';
  const foot = (heights[0] + heights[1]) / 2;
  const P = at([center[0], foot, center[1]], front);
  const frontN = [front[0], 0, front[1]],
    backN = frontN.map((x) => -x);
  const wall = star ? 'concrete' : 'brick',
    stone = tint(wall);
  const w = width / 2,
    half = depth / 2;
  const archWidth = kholm ? 2.74 : 2.4;
  const arcCount = d === 0 ? 5 : d === 1 ? 8 : 14;
  const crown = kholm ? 4.1 : 3.55;
  const arc = Array.from({ length: arcCount + 1 }, (_, i) => {
    const alpha = (i * Math.PI) / arcCount;
    return [archWidth * Math.cos(alpha), crown + archWidth * 0.85 * Math.sin(alpha)];
  });
  const opening = star
    ? [
        [3.9, -0.75],
        [3.9, 2],
        [9.8, 2],
        [5.2, 5.8],
        [10.9, 9.8],
        [3.4, 9.8],
        [0, 12.3],
        [-3.4, 9.8],
        [-10.9, 9.8],
        [-5.2, 5.8],
        [-9.8, 2],
        [-3.9, 2],
        [-3.9, -0.75],
      ]
    : [[archWidth, -0.75], ...arc, [-archWidth, -0.75]];
  const wallTop = kholm ? height - 1.45 : height;
  const outline = [[-w, -0.75], ...opening.toReversed(), [w, -0.75], [w, wallTop], [-w, wallTop]];
  for (const [side, n] of [
    [half, frontN],
    [-half, backN],
  ]) {
    plate(out, wall, outline, [], (x, y) => P(x, y, side), n, stone);
  }
  // The passage stays open all the way through. The existing terrain and path form its floor.
  for (let i = 1; i <= opening.length + 1; i++) {
    const a = outline[i - 1],
      b = outline[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const n = [front[1] * dy, -dx, -front[0] * dy];
    const isPassage = i >= 2 && i <= opening.length;
    face(
      out,
      isPassage ? 'granite' : wall,
      [P(...a, -half), P(...a, half), P(...b, half), P(...b, -half)],
      isPassage ? tint('granite', star ? 1 : 1.15) : stone,
      n,
    );
  }
  face(
    out,
    wall,
    [P(-w, wallTop, -half), P(w, wallTop, -half), P(w, wallTop, half), P(-w, wallTop, half)],
    stone,
    up,
  );
  for (const side of [-1, 1])
    face(
      out,
      wall,
      [
        P(side * w, -0.75, -half),
        P(side * w, -0.75, half),
        P(side * w, wallTop, half),
        P(side * w, wallTop, -half),
      ],
      stone,
      [front[1] * side, 0, -front[0] * side],
    );
  if (star) {
    for (const side of [-1, 1]) {
      const base = [
        P(side * 7, -0.38, -half),
        P(side * 16, -0.5, -half),
        P(side * 25, -0.5, half),
        P(side * 8, -0.45, half),
      ];
      const top = base.map((p, i) => [p[0], p[1] + [3.2, 4.6, 5.4, 2.6][i], p[2]]);
      hull(out, 'brick', base, top, tint('brick', 0.89));
      face(out, 'concrete', top, tint('grass'), up);
      if (d >= 2)
        for (let k = 0; k < 5; k++) {
          const x = side * (4.9 + k * 0.63);
          const pos = P(x, 1.25, half + 0.025);
          const T = at(pos, front);
          face(
            out,
            'granite',
            [T(-0.24, 0, 0), T(0.24, 0, 0), T(0.24, 0.62, 0), T(-0.24, 0.62, 0)],
            tint('granite'),
            frontN,
          );
        }
    }
    return;
  }
  if (kholm) {
    for (const side of [-1, 1]) {
      const [x, y, z] = P(side * 5.8, 0, half - 0.72);
      const layers =
        d === 0
          ? [
              [3.65, 1.36],
              [height + 1.05, 1.29],
            ]
          : [
              [3.15, 0.45],
              [3.91, 1.15],
              [4.31, 1.27],
              [height + 0.32, 1.27],
              [height + 0.46, 1.48],
              [height + 1.05, 1.48],
            ];
      const rings = layers.map(([h, r]) => radialRing(y + h, r, r, d >= 2 ? 18 : 8, [x, z]));
      loft(out, 'brick', rings, tint('red'));
      const count = d >= 2 ? 14 : d === 1 ? 8 : 4;
      for (let k = 0; k < count; k++) {
        const a = (k * 2 * Math.PI) / count;
        const X = x + 1.37 * Math.cos(a),
          Z = z + 1.37 * Math.sin(a);
        box(
          out,
          'brick',
          [X - 0.23, y + height + 1.01, Z - 0.23],
          [X + 0.23, y + height + 1.64, Z + 0.23],
          tint('red', 0.89 + phase(k) * 0.19),
        );
      }
    }
  }
  if (d >= 2) {
    const pilaster = (u, width, low, high, depth) =>
      loft(
        out,
        'brick',
        [low, high].map((y) =>
          chamferedRectangle(u, y, half + depth * 0.18, width, depth, 0.1).map(([x, h, z]) =>
            P(x, h, z),
          ),
        ),
        tint('red', 0.92),
      );
    if (kholm) {
      for (const x of [-10.8, 0, 10.8]) pilaster(x, x === 0 ? 3 : 1.7, 7.9, height - 0.1, 1.0);
      for (const x of [-10, -8, -3.6, -2, -0.5, 1.1, 3.1, 7.8, 9.7])
        pilaster(x, 0.5, wallTop - 0.12, wallTop + 0.57, 0.75);
      for (const [u, y, w, h] of [
        [0, 7.77, 0.63, 1.53],
        [-8.93, 6.07, 0.81, 1.73],
        [8.93, 6.07, 0.81, 1.73],
        [8.93, 1.45, 0.81, 1.63],
      ]) {
        const arch = (r, k) => [
          [-r, 0],
          [r, 0],
          [r, k * 0.78],
          [r * 0.61, k * 0.96],
          [0, k],
          [-r * 0.61, k * 0.96],
          [-r, k * 0.78],
        ];
        const offset = u === 0 ? 0.78 : 0.074;
        plate(
          out,
          'stone',
          arch(w + 0.18, h + 0.23),
          [],
          (x, a) => P(u + x, y + a, half + offset),
          frontN,
          tint('white'),
        );
        plate(
          out,
          'granite',
          arch(w * 0.75, h * 0.84),
          [],
          (x, a) => P(u + x, y + 0.1 + a, half + offset + 0.025),
          frontN,
          tint('dark', 0.66),
        );
      }
    } else {
      for (const x of [-5.7, 5.7]) pilaster(x, 2.1, 8.3, height + 0.64, 1.4);
      beam(
        out,
        'stone',
        P(-w, 7.55, half + 0.12),
        P(w, 7.55, half + 0.12),
        0.26,
        0.26,
        tint('stone', 0.75),
      );
      beam(
        out,
        'stone',
        P(-2.75, 4.75, half + 0.1),
        P(2.75, 4.75, half + 0.1),
        0.41,
        0.33,
        tint('stone', 0.74),
      );
      for (const x of [-1.2, -0.4, 0.4, 1.2])
        beam(
          out,
          'granite',
          P(x, height, half - 2.9),
          P(x, height + 1.9, half - 2.9),
          0.085,
          0.085,
          tint('dark'),
        );
      beam(
        out,
        'granite',
        P(-1.5, height + 1.8, half - 2.9),
        P(1.5, height + 1.8, half - 2.9),
        0.11,
        0.11,
        tint('dark'),
      );
    }
  }
  for (const side of [-1, 1]) {
    const n = frontN.map((x) => x * side);
    for (let k = 0; k < arc.length - 1; k++) {
      const [a, b] = arc.slice(k, k + 2),
        t = k / (arc.length - 1),
        r = kholm ? 0.52 : 0.4;
      const ext = ([u, h]) => [u * (1 + r / archWidth), crown + (h - crown) * (1 + r / archWidth)];
      const atEdge = (q) => P(...q, side * (half + 0.022));
      face(
        out,
        'brick',
        [atEdge(a), atEdge(b), atEdge(ext(b)), atEdge(ext(a))],
        tint('red', 0.86 + phase(k) * 0.27),
        n,
      );
      if (d >= 3 && t > 0.2 && t < 0.8) {
        const s = lerp(a, b, 0.5);
        const u = s[0] * 1.13;
        beam(
          out,
          'brick',
          P(u, s[1] + 0.25, side * (half + 0.025)),
          P(u, s[1] + 0.39, side * (half + 0.04)),
          0.045,
          0.056,
          tint('brick', 0.58),
        );
      }
    }
    for (let k = 0; k < (kholm ? (d >= 2 && side === 1 ? 0 : 9) : 5); k++) {
      const u = (k - (kholm ? 4 : 2)) * (kholm ? 1.08 : 1.8);
      const atEdge = (x, h) => P(x, h, side * (half + 0.03));
      face(
        out,
        'granite',
        [
          atEdge(u - 0.15, wallTop - 1.78),
          atEdge(u + 0.15, wallTop - 1.78),
          atEdge(u + 0.15, wallTop - 0.47),
          atEdge(u - 0.15, wallTop - 0.47),
        ],
        tint('dark'),
        n,
      );
    }
  }
  if (d >= 2)
    for (let i = 0; i < (d >= 3 ? 60 : 17); i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (archWidth + 0.6 + phase(i) * (w - archWidth - 1.35)),
        h = 1 + phase(i * 7) * (height - 2.7);
      const p = P(x, h, half + 0.045),
        r = 0.04 + phase(i * 3) * 0.13;
      const T = at(p, front);
      face(
        out,
        'brick',
        [T(-r, 0.02, 0), T(0.035, -r * 0.65, 0), T(r, r * 0.55, 0), T(-r * 0.45, r * 0.7, 0)],
        tint('brick', 0.64 + phase(i + 5) * 0.24),
        frontN,
      );
    }
}

function masonry(out, part, d) {
  const { points, height, grade, kind } = part;
  const ruined = kind === 'ruin',
    earth = kind === 'earth',
    slot = earth ? 'concrete' : 'brick';
  const roofSlot = earth ? 'concrete' : ruined ? 'brick' : 'roof';
  const contour = d === 0 && points.length >= 10 ? points.filter((_, i) => i % 2 === 0) : points;
  const base = contour.map(([x, y, z]) => [x, y - 1.55, z]);
  const upper = contour.map(([x, y, z], i) => [
    x,
    (ruined ? y : grade) + height * (ruined ? 0.64 + phase(i * 17) * 0.53 : 1),
    z,
  ]);
  hull(out, slot, base, upper, tint(earth ? 'concrete' : 'brick', ruined ? 0.92 : 1.04));
  const plan = contour.map(([x, , z]) => [x, z]);
  const ids = earcut(plan.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      out,
      roofSlot,
      ids.slice(i, i + 3).map((j) => upper[j]),
      tint(earth ? 'grass' : ruined ? 'red' : 'roof', ruined ? 0.85 : 1.06),
      up,
    );
  if (d === 0 || earth) return;
  const line = [...upper, upper[0]];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < (d === 1 ? 12 : 2)) continue;
    const axis = [(b[0] - a[0]) / length, (b[2] - a[2]) / length];
    const outward = [axis[1], -axis[0]];
    if (!ruined && d >= 2)
      beam(
        out,
        'stone',
        [a[0], a[1] - 0.23, a[2]],
        [b[0], b[1] - 0.23, b[2]],
        0.22,
        0.26,
        tint('stone', 0.84),
      );
    const count = Math.max(1, Math.floor(length / (d === 1 ? 16 : ruined ? 5.6 : 4.6)));
    for (let j = 0; j < count; j++) {
      if (ruined && (j + i) % 3 === 0) continue;
      const q = lerp(a, b, (j + 0.5) / count),
        y = q[1] - Math.min(height * 0.7, 3.0);
      const addWindow = (sign) => {
        const f = outward.map((x) => x * sign),
          P = at([q[0], y, q[2]], f),
          normal = [f[0], 0, f[1]],
          w = ruined ? 0.46 : 0.64;
        const path =
          d === 1
            ? [
                [-w, 0],
                [w, 0],
                [w, 1.55],
                [-w, 1.55],
              ]
            : [
                [-w, 0],
                [w, 0],
                [w, 1.37],
                [w * 0.65, 1.69],
                [0, 1.83],
                [-w * 0.65, 1.69],
                [-w, 1.37],
              ];
        plate(
          out,
          'granite',
          path,
          [],
          (x, h) => P(x, h, 0.028),
          normal,
          tint('dark', 0.75 + phase(i + j) * 0.42),
        );
        if (d >= 3 || (d === 2 && j % 2 === 0))
          beam(
            out,
            'stone',
            P(-w - 0.09, 0.01, 0.067),
            P(w + 0.09, 0.01, 0.067),
            0.11,
            0.12,
            tint('stone', 0.77),
          );
      };
      // Pick the side of the footprint using ring winding in the ground plane.
      const area = plan.reduce((s, p, k) => {
        const q = plan[(k + 1) % plan.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0);
      addWindow(Math.sign(area));
    }
  }
}

function church(out, piece, d) {
  const { position, front } = piece;
  const P = at(position, front),
    sides = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 16 : 22;
  const ring = (y, rx, rz, v = 0) =>
    radialRing(y, rx, rz, sides, [0, v]).map(([x, h, z]) => P(x, h, z));
  const block = (slot, w, depth, y, h, offset, color) =>
    loft(
      out,
      slot,
      [y, y + h].map((g) =>
        chamferedRectangle(0, g, offset, w, depth, 1).map(([x, Y, z]) => P(x, Y, z)),
      ),
      color,
    );
  if (d > 0) block('stone', 24, 30, -1.2, 2.1, -2, tint('stone', 0.9));
  block('plaster', 22, 28, 0.5, 10.4, -2, tint('plaster'));
  block('plaster', 26, 11, 1.1, 12.6, 0, tint('plaster', 1.03));
  loft(out, 'plaster', [ring(1, 6.7, 5.1, 12), ring(10.4, 6.7, 5.1, 12)], tint('plaster', 0.96));
  loft(
    out,
    'roof',
    [ring(10.44, 6.98, 5.35, 12), ring(12.62, 5.8, 4.8, 12), ring(13.71, 3.6, 3.2, 12)],
    tint('roof'),
  );
  if (d > 0) block('stone', 22.58, 29, 10.94, 0.5, -2, tint('white'));
  loft(
    out,
    'roof',
    [
      [0, 11.5, 14.96],
      [0, 14.45, 9.21],
      [0, 15.25, 5.8],
    ].map(([, y, r]) => ring(y, r, r * 0.94)),
    tint('roof'),
  );
  loft(out, 'plaster', [ring(13.96, 6.02, 6.02), ring(19.02, 6.02, 6.02)], tint('plaster', 1.05));
  if (d > 0) loft(out, 'stone', [ring(18.75, 6.24, 6.24), ring(19.06, 6.45, 6.45)], tint('white'));
  const dome =
    d === 0
      ? [
          [19, 6.46],
          [22, 5.52],
          [24.65, 0.62],
        ]
      : [
          [19, 6.46],
          [20.2, 6.28],
          [21.8, 5.67],
          [23.1, 4.26],
          [24.1, 2.48],
          [24.65, 0.62],
        ];
  loft(
    out,
    'copper',
    dome.map(([y, r]) => ring(y, r, r)),
    tint('copper'),
  );
  if (d > 0)
    loft(out, 'copper', [ring(24.6, 0.72, 0.72), ring(25.25, 0.34, 0.34)], tint('gold', 0.93));
  beam(out, 'copper', P(0, 25, 0), P(0, 27.3, 0), 0.13, 0.14, tint('gold'));
  beam(out, 'copper', P(-0.74, 26.6, 0), P(0.74, 26.6, 0), 0.12, 0.11, tint('gold'));
  if (d === 0) return;
  const trim = (u, y, v, n, w, h) => {
    const T = at(P(u, y, v), n),
      F = [n[0], 0, n[1]],
      inner = [
        [-w, 0],
        [w, 0],
        [w, h * 0.73],
        [w * 0.72, h * 0.91],
        [0, h],
        [-w * 0.72, h * 0.91],
        [-w, h * 0.73],
      ];
    const outer = inner.map(([x, h2]) => [x * (1 + 0.17 / w), (h2 - h * 0.5) * 1.1 + h * 0.5]);
    plate(out, 'stone', outer, [inner], (x, h2) => T(x, h2, 0.08), F, tint('white'));
    plate(out, 'granite', inner, [], (x, h2) => T(x, h2, 0.091), F, tint('dark', 1.24));
  };
  for (const z of [-10, -5.5, 5.5, 10])
    for (const k of [-1, 1]) {
      trim(k * 11.05, 3.47, z, [front[1] * k, -front[0] * k], 0.94, 4.55);
      if (d >= 2) trim(k * 11.05, 1.26, z, [front[1] * k, -front[0] * k], 0.62, 1.51);
    }
  trim(0, 1, -16.06, [-front[0], -front[1]], 2.02, 5.8);
  for (const u of [-7.5, -4.15, 4.15, 7.5])
    trim(u, 3.75, -16.06, [-front[0], -front[1]], 0.85, 3.9);
  for (let j = 0; j < 12; j++) {
    const a = (2 * Math.PI * j) / 12,
      n = [
        front[1] * Math.cos(a) + front[0] * Math.sin(a),
        -front[0] * Math.cos(a) + front[1] * Math.sin(a),
      ];
    trim(6.04 * Math.cos(a), 15.37, 6.04 * Math.sin(a), n, 0.48, 2.71);
  }
  if (d >= 2)
    for (let j = 0; j < 18; j++) {
      const a = (j * 2 * Math.PI) / 18;
      const E = (r, h) => P(r * Math.cos(a), h, r * Math.sin(a));
      for (const [[r0, h0], [r1, h1]] of [
        [
          [6.4, 19.14],
          [5.72, 21.7],
        ],
        [
          [5.72, 21.7],
          [4.26, 23.18],
        ],
        [
          [4.26, 23.18],
          [2.47, 24.21],
        ],
      ])
        beam(out, 'copper', E(r0, h0), E(r1, h1), 0.07, 0.075, tint('copper', 0.85));
    }
}
