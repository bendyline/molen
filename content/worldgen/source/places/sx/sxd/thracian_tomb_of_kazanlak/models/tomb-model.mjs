/** Original pavilion, brick vault, and source-master chamber of the Thracian Tomb of Kazanlak. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone' },
  dressed: { slot: 'trim', graph: 'stone_limestone_raw' },
  brick: { slot: 'wall', graph: 'brick_stack' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  metal: { slot: 'trim', graph: 'metal_painted' },
  paving: { slot: 'foundation', graph: 'stone_granite' },
  plaster: { slot: 'wall', localRef: 'palette:#c9bba3', roughness: 1 },
};
const palette = {
  stone: 'c3b8a2',
  chalk: 'ded6bf',
  ashlar: 'bab39f',
  warmStone: 'cbbba0',
  jamb: 'a19a86',
  brick: 'b3785e',
  rust: 'a15c44',
  worn: '8f644f',
  tile: 'b77659',
  tileDark: 'a56750',
  fascia: 'e4dfce',
  iron: '4c4b44',
  grille: '3c3e3c',
  door: '555452',
  sign: '7b503a',
  letters: 'e3d8bc',
  flag: 'bcb3a1',
  sill: 'c6bda5',
  corbel: 'ab7257',
  ivory: 'd9cfad',
  red: 'a8533b',
  terracotta: 'bc795b',
  gold: 'bd985a',
  umber: '7d5b47',
  ochre: 'bb8963',
  sage: '7f8270',
  blue: '7f8493',
  linen: 'ede1c3',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, v]) => [
    k,
    v.match(/../g).map((pair) => {
      const x = parseInt(pair, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const lod = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  front = [0, 0, 1],
  back = [0, 0, -1];
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = 2 * Math.PI;

function face(out, slot, tint, points, desired, project) {
  points = points.filter((p, i) => !points.slice(0, i).some((q) => p.every((v, j) => v === q[j])));
  if (points.length < 3) return;
  const n = normalFor(points[0], points[1], points[2]);
  if (Math.hypot(...n) < 0.99) return;
  const flip = n.reduce((sum, v, i) => sum + v * desired[i], 0) < 0;
  const verts = flip ? points.toReversed() : points;
  const normal = flip ? n.map((v) => -v) : n;
  const uv = project ? verts.map(project) : undefined;
  const ref = uv ? 'metric:uv' : '';
  if (verts.length === 4) out.addQuad(slot, ref, verts, normal, uv, color[tint]);
  else out.addTriangle(slot, ref, verts, normal, uv, color[tint]);
}
function box(out, slot, tint, x0, y0, z0, x1, y1, z1) {
  const a = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    b = a.map(([x, , z]) => [x, y1, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      slot,
      tint,
      [a[i], a[j], b[j], b[i]],
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
    );
  }
  face(out, slot, tint, b, up);
  face(out, slot, tint, a, down);
}
function cover(out, slot, tint, points, normal) {
  const tris = earcut(points.flatMap(([x, , z]) => [x, z]));
  for (let i = 0; i < tris.length; i += 3)
    face(
      out,
      slot,
      tint,
      tris.slice(i, i + 3).map((k) => points[k]),
      normal,
    );
}

// The side walls use the mapped perimeter. The sloped base remains below the local terrain.
function walls(out, detail) {
  const { ring, pavilionBase, base, hall } = layout;
  for (let i = 0; i < ring.length; i++) {
    if (i === 4) continue;
    const j = (i + 1) % ring.length,
      [x, z] = ring[i],
      [X, Z] = ring[j],
      n = [Z - z, 0, x - X];
    face(
      out,
      'stone',
      i === 0 ? 'ashlar' : 'stone',
      [
        [x, base, z],
        [X, base, Z],
        [X, hall.eaves, Z],
        [x, hall.eaves, z],
      ],
      n,
    );
    if (Math.min(pavilionBase[i], pavilionBase[j]) < base - 0.005) {
      face(
        out,
        'dressed',
        'jamb',
        [
          [x, pavilionBase[i], z],
          [X, pavilionBase[j], Z],
          [X, base, Z],
          [x, base, z],
        ],
        n,
      );
    }
  }
  const [x, z] = ring[5],
    [X, Z] = ring[4];
  face(
    out,
    'dressed',
    'jamb',
    [
      [x, pavilionBase[5], z],
      [X, pavilionBase[4], Z],
      [X, base, Z],
      [x, base, z],
    ],
    front,
  );
  if (detail > 0) {
    for (const o of layout.openings)
      box(
        out,
        'dressed',
        'sill',
        o.x - o.r - 0.16,
        base - 0.03,
        layout.front - 0.42,
        o.x + o.r + 0.16,
        base + 0.06,
        layout.front + 0.15,
      );
  }
}

function opening(out, spec, detail) {
  const { x, r, spring } = spec,
    z = layout.front,
    base = layout.base,
    eaves = layout.hall.eaves;
  const depth = 0.47,
    segments = [5, 9, 16, 22, 30][detail],
    arch = (t) => [x + r * Math.cos(t), spring + r * Math.sin(t)];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * i) / segments,
      b = (Math.PI * (i + 1)) / segments,
      [ax, ay] = arch(a),
      [bx, by] = arch(b);
    face(
      out,
      'stone',
      'stone',
      [
        [ax, ay, z],
        [bx, by, z],
        [bx, eaves, z],
        [ax, eaves, z],
      ],
      front,
    );
    face(
      out,
      'dressed',
      'jamb',
      [
        [ax, ay, z - depth],
        [bx, by, z - depth],
        [bx, by, z],
        [ax, ay, z],
      ],
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
    );
    if (detail > 0) {
      const ring = 0.25,
        gap = 0.012,
        a1 = a + gap,
        b1 = b - gap;
      const point = (t, R, Z) => [x + R * Math.cos(t), spring + R * Math.sin(t), Z];
      face(
        out,
        'dressed',
        i % 4 === 1 ? 'warmStone' : 'chalk',
        [
          point(a1, r, z + 0.027),
          point(b1, r, z + 0.027),
          point(b1, r + ring, z + 0.027),
          point(a1, r + ring, z + 0.027),
        ],
        front,
      );
    }
  }
  for (const s of [-1, 1]) {
    const u = x + s * r;
    face(
      out,
      'dressed',
      'jamb',
      [
        [u, base, z - depth],
        [u, base, z],
        [u, spring, z],
        [u, spring, z - depth],
      ],
      [-s, 0, 0],
    );
  }
  // Recessed blackened iron grills and the dark inner hall.
  box(
    out,
    'metal',
    'door',
    x - r,
    base,
    z - depth - 0.34,
    x + r,
    spring + r + 0.15,
    z - depth - 0.25,
  );
  if (detail === 0) return;
  const bars = detail === 1 ? 5 : 9,
    w = detail === 1 ? 0.044 : 0.029;
  for (let i = 0; i < bars; i++) {
    const a = lerp(-0.88, 0.88, i / (bars - 1)),
      u = x + a * r,
      top = spring + r * Math.sqrt(1 - a * a);
    box(out, 'metal', 'grille', u - w, base + 0.07, z - 0.24, u + w, top, z - 0.199);
  }
  for (const y of [base + 0.32, 0.06, 0.7, spring + 0.12]) {
    const span = y <= spring ? r : Math.sqrt(r * r - (y - spring) * (y - spring));
    box(out, 'metal', 'iron', x - span, y - 0.018, z - 0.205, x + span, y + 0.018, z - 0.171);
  }
}
function facade(out, detail) {
  const { front: z, base, hall, openings } = layout;
  const rect = (a, b) =>
    face(
      out,
      'stone',
      'stone',
      [
        [a, base, z],
        [b, base, z],
        [b, hall.eaves, z],
        [a, hall.eaves, z],
      ],
      front,
    );
  let edge = layout.ring[5][0];
  for (const o of openings) {
    rect(edge, o.x - o.r);
    opening(out, o, detail);
    edge = o.x + o.r;
  }
  rect(edge, layout.ring[4][0]);
  if (detail > 1) {
    for (const x of [layout.ring[5][0] + 0.16, layout.ring[4][0] - 0.16])
      for (let i = 0; i < 11; i++) {
        const y = base + i * 0.324,
          width = i % 2 ? 0.25 : 0.19;
        box(
          out,
          'dressed',
          i % 4 === 0 ? 'chalk' : 'ashlar',
          x - width,
          y,
          z - 0.045,
          x + width,
          y + 0.307,
          z + 0.042,
        );
      }
  }
}

function roof(out, body, detail, gable, chimney) {
  const { near, far, eaves, ridge, west, east } = body,
    m = (west + east) / 2;
  const z0 = near - 0.17,
    z1 = far + 0.2;
  for (const [z, n] of [
    [near, back],
    [far, front],
  ])
    face(
      out,
      'stone',
      'stone',
      [
        [west, eaves, z],
        [east, eaves, z],
        [m, ridge, z],
      ],
      n,
    );
  for (const s of [-1, 1]) {
    const edge = s < 0 ? west - 0.2 : east + 0.2,
      L = Math.hypot(edge - m, ridge - eaves);
    const A = [m, ridge, z0],
      B = [m, ridge, z1],
      C = [edge, eaves, z1],
      D = [edge, eaves, z0];
    const roofUv = ([x, y, z]) => [z, Math.hypot(x - m, y - ridge)];
    face(out, 'tile', 'tile', [A, B, C, D], up, roofUv);
    box(out, 'dressed', 'fascia', edge - 0.047, eaves - 0.16, z0, edge + 0.047, eaves + 0.025, z1);
    for (const [a, b] of [
      [A, D],
      [B, C],
    ]) {
      if (!gable && a === B) continue;
      beam(
        out,
        'dressed',
        a.map((v, i) => (i === 1 ? v - 0.09 : v)),
        b.map((v, i) => (i === 1 ? v - 0.09 : v)),
        0.099,
        0.11,
        color.fascia,
      );
    }
    if (detail > 1) {
      // Model only the exposed ends of the overlapping S tiles. The shared roof graph carries their courses.
      const count = Math.ceil((z1 - z0) / 0.31);
      for (let i = 0; i < count; i++) {
        const t0 = lerp(z0, z1, i / count),
          t1 = lerp(z0, z1, (i + 1) / count);
        for (let j = 0; j < 4; j++) {
          const point = (f) => [
            lerp(m, edge, (L - 0.18) / L),
            eaves + 0.055 + 0.05 * Math.sin(f * TAU),
            lerp(t0, t1, f),
          ];
          const a = point(j / 4),
            b = point((j + 1) / 4),
            tip = ([x, y, z]) => [edge + s * 0.044, y - 0.078, z];
          face(out, 'tile', i % 7 === 0 ? 'tileDark' : 'tile', [a, b, tip(b), tip(a)], up, roofUv);
        }
      }
      box(
        out,
        'metal',
        'iron',
        edge - 0.032,
        eaves - 0.15,
        z0 + 0.05,
        edge + 0.041,
        eaves - 0.1,
        z1 - 0.05,
      );
      const pipeX = edge - s * 0.09,
        pipeZ = z1 - 0.58;
      beam(
        out,
        'metal',
        [pipeX, eaves - 0.11, pipeZ],
        [pipeX, layout.base + 0.34, pipeZ],
        0.056,
        0.06,
        color.iron,
      );
    }
  }
  box(out, 'tile', 'tileDark', m - 0.085, ridge - 0.035, z0, m + 0.085, ridge + 0.095, z1);
  if (chimney) {
    box(
      out,
      'brick',
      'brick',
      m + 0.58,
      ridge - 0.62,
      near + 1.13,
      m + 1.2,
      ridge + 0.58,
      near + 1.82,
    );
    box(
      out,
      'tile',
      'tileDark',
      m + 0.51,
      ridge + 0.58,
      near + 1.06,
      m + 1.27,
      ridge + 0.71,
      near + 1.89,
    );
  }
}

function brickVault(out, detail) {
  const v = layout.vault,
    N = [5, 9, 14, 20, 24][detail];
  const base = Math.min(...layout.porticoStations.map((p) => p[2]));
  const panel = (u, y, w, side) => {
    if (side === 0) return [v.x + u, y, v.z + w];
    if (side === 1) return [v.x - w, y, v.z + u];
    if (side === 2) return [v.x - u, y, v.z - w];
    return [v.x + w, y, v.z - u];
  };
  const normal = (side) =>
    [
      [0, 0, 1],
      [-1, 0, 0],
      [0, 0, -1],
      [1, 0, 0],
    ][side];
  const pier = v.half - v.radius;
  for (const [x, z, y] of layout.porticoStations)
    box(out, 'brick', 'brick', x - pier / 2, y, z - pier / 2, x + pier / 2, v.spring, z + pier / 2);
  for (let side = 0; side < 4; side++) {
    const P = (u, y, w = v.half) => panel(u, y, w, side);
    for (const s of [-1, 1]) {
      const a = s * v.radius,
        b = s * v.half;
      face(out, 'brick', 'brick', [P(a, base), P(b, base), P(b, v.top), P(a, v.top)], normal(side));
    }
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * i) / N,
        b = (Math.PI * (i + 1)) / N;
      const at = (t, r, w = v.half) => P(r * Math.cos(t), v.spring + r * Math.sin(t), w);
      const A = at(a, v.radius),
        B = at(b, v.radius),
        inner = v.radius + 0.14;
      face(
        out,
        'brick',
        'brick',
        [A, B, P(v.radius * Math.cos(b), v.top), P(v.radius * Math.cos(a), v.top)],
        normal(side),
      );
      const a0 = at(a, v.radius, inner),
        b0 = at(b, v.radius, inner);
      const n = normal(side),
        u = [n[2], 0, -n[0]],
        t = (a + b) / 2;
      face(
        out,
        'brick',
        'worn',
        [A, B, b0, a0],
        [-u[0] * Math.cos(t), -Math.sin(t), -u[2] * Math.cos(t)],
      );
      if (detail > 0) {
        const r = v.radius + 0.27,
          g = 0.013,
          w = v.half + 0.026;
        face(
          out,
          'brick',
          i % 5 === 0 ? 'worn' : i % 3 === 0 ? 'rust' : 'brick',
          [at(a + g, v.radius, w), at(b - g, v.radius, w), at(b - g, r, w), at(a + g, r, w)],
          normal(side),
        );
      }
    }
  }
  // The surviving brick courses rise into a low cloister vault. Its four faces remain open.
  const segments = [8, 12, 20, 28, 36][detail],
    rows = [2, 3, 5, 7, 9][detail];
  const crown = (i, j, inset) => {
    const a = (TAU * i) / segments,
      t = j / rows,
      c = Math.cos(a),
      s = Math.sin(a);
    const r = lerp((v.half - inset) / Math.max(Math.abs(c), Math.abs(s)), 0.16, t);
    return [
      v.x + c * r,
      v.top + (v.crown - v.top) * Math.sin(Math.PI * t * 0.5) - inset * 0.59,
      v.z + s * r,
    ];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      face(
        out,
        'brick',
        j % 3 === 0 ? 'worn' : 'brick',
        [crown(i, j, 0), crown(i + 1, j, 0), crown(i + 1, j + 1, 0), crown(i, j + 1, 0)],
        up,
      );
      face(
        out,
        'brick',
        'worn',
        [
          crown(i, j, 0.16),
          crown(i + 1, j, 0.16),
          crown(i + 1, j + 1, 0.16),
          crown(i, j + 1, 0.16),
        ],
        down,
      );
    }
  cover(
    out,
    'brick',
    'worn',
    Array.from({ length: segments }, (_, i) => crown(i, rows, 0)),
    up,
  );
  cover(
    out,
    'brick',
    'worn',
    Array.from({ length: segments }, (_, i) => crown(i, rows, 0.16)),
    down,
  );
}

const signGlyphs = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [15, 16, 16, 16, 16, 16, 15],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  R: [30, 17, 17, 30, 20, 18, 17],
  T: [31, 4, 4, 4, 4, 4, 4],
};
function signLine(out, text, x, y, z, step) {
  const left = x - ((6 * text.length - 1) * step) / 2;
  for (let j = 0; j < text.length; j++) {
    const glyph = signGlyphs[text[j]];
    if (!glyph) continue;
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++) {
        if (!(glyph[row] & (16 >> col))) continue;
        const a = left + (j * 6 + col) * step,
          b = y + (6 - row) * step;
        face(
          out,
          'dressed',
          'letters',
          [
            [a, b, z],
            [a + step, b, z],
            [a + step, b + step, z],
            [a, b + step, z],
          ],
          front,
        );
      }
  }
}
function forecourt(out, detail) {
  const p = layout.paving.map(([x, z, y]) => [x, y, z]);
  cover(out, 'paving', 'flag', p, up);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      out,
      'paving',
      'flag',
      [a, b, [b[0], b[1] - 0.24, b[2]], [a[0], a[1] - 0.24, a[2]]],
      [b[2] - a[2], 0, a[0] - b[0]],
    );
  }
  if (detail < 2) return;
  box(out, 'dressed', 'sill', -4.71, layout.base - 0.19, 15.36, 4.73, layout.base + 0.005, 15.82);
  const x = 5.83,
    y = -1.78,
    z = 17.96;
  for (const s of [-1, 1])
    box(
      out,
      'metal',
      'sign',
      x + s * 0.69 - 0.023,
      y - 0.25,
      z - 0.025,
      x + s * 0.69 + 0.023,
      y + 1.2,
      z + 0.024,
    );
  box(out, 'metal', 'sign', x - 0.73, y + 0.41, z - 0.024, x + 0.73, y + 1.19, z + 0.03);
  if (detail > 2) {
    for (const [line, offset, step] of [
      ['THRACIAN', 1.0, 0.024],
      ['TOMB', 0.77, 0.028],
      ['ORIGINAL', 0.51, 0.021],
    ])
      signLine(out, line, x, y + offset, z + 0.031, step);
  }
}

const profile = [
  [0, 1.32],
  [0.79, 1.29],
  [1.24, 1.24],
  [1.44, 1.2],
  [1.63, 1.14],
  [1.88, 1.05],
  [2.15, 0.94],
  [2.42, 0.8],
  [2.66, 0.64],
  [2.83, 0.51],
  [3.04, 0.37],
  [3.24, 0.23],
];
const paintedBands = [
  [0, 0.79, 'red'],
  [0.79, 1.24, 'red'],
  [1.24, 1.26, 'red'],
  [1.26, 1.43, 'ivory'],
  [1.43, 1.46, 'red'],
  [1.46, 1.63, 'linen'],
  [1.63, 1.88, 'linen'],
  [1.88, 2.15, 'linen'],
  [2.15, 2.4, 'linen'],
  [2.4, 2.44, 'red'],
  [2.44, 2.51, 'gold'],
  [2.51, 2.58, 'blue'],
  [2.58, 2.67, 'ivory'],
  [2.67, 2.83, 'ivory'],
  [2.83, 3.04, 'ivory'],
  [3.04, 3.24, 'ivory'],
];
function chamberRadius(y) {
  const i = profile.findIndex(([h]) => h >= y);
  if (i <= 0) return profile[i === 0 ? 0 : profile.length - 1][1];
  const [a, r] = profile[i - 1],
    [b, s] = profile[i];
  return lerp(r, s, (y - a) / (b - a));
}
function chamber(out) {
  const c = layout.chamber,
    N = 100,
    aperture = Math.asin(c.doorWidth / (2 * c.radius));
  const P = (a, y, inset = 0) => {
    const r = chamberRadius(y) - inset;
    return [c.x + r * Math.sin(a), c.floor + y, c.z + r * Math.cos(a)];
  };
  const normal = (a) => [-Math.sin(a), -0.24, -Math.cos(a)];
  for (const [y, Y, tint] of paintedBands)
    for (let i = 0; i < N; i++) {
      const a = TAU * (i / N - 0.5),
        b = TAU * ((i + 1) / N - 0.5);
      if (Y <= c.doorHeight && Math.abs((a + b) / 2) < aperture) continue;
      face(out, 'plaster', tint, [P(a, y), P(b, y), P(b, Y), P(a, Y)], normal((a + b) / 2));
    }
  cover(
    out,
    'paving',
    'flag',
    Array.from({ length: N }, (_, i) => P((i * TAU) / N, 0)),
    up,
  );
  cover(
    out,
    'dressed',
    'jamb',
    Array.from({ length: N }, (_, i) => P((i * TAU) / N, c.height)),
    down,
  );
  const art = (a, tint, coords) => {
    const verts = coords.map(([x, y]) => P(a + x, y, 0.018));
    for (let i = 1; i + 1 < verts.length; i++)
      face(out, 'plaster', tint, [verts[0], verts[i], verts[i + 1]], normal(a));
  };
  const ellipse = (a, y, rx, ry, tint) =>
    art(
      a,
      tint,
      Array.from({ length: 10 }, (_, i) => [
        rx * Math.cos((i * TAU) / 10),
        y + ry * Math.sin((i * TAU) / 10),
      ]),
    );
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        ellipse(a + side * 0.027, 1.34, 0.023, 0.025, 'red');
        ellipse(a, 1.34 + side * 0.035, 0.023, 0.024, 'blue');
      }
      ellipse(a, 1.34, 0.018, 0.019, 'gold');
    } else {
      art(a, 'gold', [
        [-0.048, 1.39],
        [-0.02, 1.32],
        [0.022, 1.32],
        [0.047, 1.39],
        [0.015, 1.35],
        [-0.014, 1.35],
      ]);
      art(a, 'red', [
        [-0.045, 1.39],
        [-0.023, 1.34],
        [-0.037, 1.3],
        [-0.049, 1.3],
      ]);
      art(a, 'red', [
        [0.045, 1.39],
        [0.049, 1.3],
        [0.037, 1.3],
        [0.023, 1.34],
      ]);
    }
    art(a, 'red', [
      [-0.12, 2.46],
      [0.12, 2.46],
      [0.017, 2.5],
    ]);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10 + 0.21,
      tint = ['terracotta', 'gold', 'umber', 'blue', 'sage'][i % 5],
      side = i % 2 === 0 ? 1 : -1;
    const neck = i < 2 ? 2.1 : 2.2;
    ellipse(a, neck + 0.063, 0.05, 0.052, 'ochre');
    art(a, tint, [
      [-0.062, neck],
      [-0.087, 1.72],
      [-0.133, 1.51],
      [0.11, 1.51],
      [0.061, 1.76],
      [0.066, neck],
    ]);
    art(a, 'linen', [
      [-0.03, neck],
      [0.019, neck],
      [0.05, 1.55],
      [-0.012, 1.55],
    ]);
    art(a + side * 0.055, 'ochre', [
      [0, neck - 0.06],
      [side * 0.086, neck - 0.18],
      [side * 0.166, neck - 0.119],
      [side * 0.165, neck - 0.166],
      [side * 0.076, neck - 0.222],
      [0, neck - 0.124],
    ]);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3 + 0.4;
    ellipse(a, 2.79, 0.23, 0.067, 'umber');
    ellipse(a + 0.21, 2.87, 0.077, 0.045, 'terracotta');
    art(a, 'ochre', [
      [0.12, 2.79],
      [0.26, 2.86],
      [0.25, 2.91],
      [0.15, 2.84],
    ]);
    for (const x of [-0.15, -0.045, 0.07, 0.15])
      art(a + x, 'umber', [
        [0, 2.77],
        [0.035, 2.77],
        [-0.03, 2.7],
        [-0.065, 2.7],
      ]);
    ellipse(a - 0.31, 2.76, 0.075, 0.033, 'red');
    ellipse(a - 0.31, 2.76, 0.046, 0.02, 'ivory');
  }
  for (const [room, stone] of [
    [c.passage, false],
    [c.forecourt, true],
  ]) {
    const { start, end, width, height } = room,
      slot = stone ? 'stone' : 'brick',
      tint = stone ? 'ashlar' : 'corbel',
      r = width / 2;
    cover(
      out,
      'paving',
      'flag',
      [
        [c.x - r, c.floor, start],
        [c.x + r, c.floor, start],
        [c.x + r, c.floor, end],
        [c.x - r, c.floor, end],
      ],
      up,
    );
    for (const s of [-1, 1]) {
      const x = c.x + s * r;
      const nearTop = c.floor + height - (stone ? 0 : 0.51),
        farTop = stone ? c.floor + 0.94 : nearTop;
      face(
        out,
        slot,
        tint,
        [
          [x, c.floor, start],
          [x, c.floor, end],
          [x, farTop, end],
          [x, nearTop, start],
        ],
        [-s, 0, 0],
      );
      if (stone) continue;
      for (let i = 0; i < 6; i++) {
        const y = c.floor + height - 0.51 + i * 0.085,
          w = x - (s * r * i) / 7;
        box(
          out,
          slot,
          tint,
          Math.min(w, x) - 0.027,
          y,
          start,
          Math.max(w, x) + 0.027,
          y + 0.085,
          end,
        );
      }
    }
    if (!stone)
      face(
        out,
        slot,
        tint,
        [
          [c.x - r, c.floor + height, start],
          [c.x + r, c.floor + height, start],
          [c.x + r, c.floor + height, end],
          [c.x - r, c.floor + height, end],
        ],
        down,
      );
  }
  for (const [z, r, h] of [
    [c.passage.start, 0.61, c.doorHeight],
    [c.passage.end, 0.53, 1.77],
  ]) {
    for (const s of [-1, 1]) {
      const a = c.x + (s * c.doorWidth) / 2,
        b = c.x + s * (r + 0.08);
      box(
        out,
        'dressed',
        'chalk',
        Math.min(a, b),
        c.floor,
        z - 0.105,
        Math.max(a, b),
        c.floor + h + 0.25,
        z + 0.1,
      );
    }
    box(
      out,
      'dressed',
      'chalk',
      c.x - r,
      c.floor + h,
      z - 0.105,
      c.x + r,
      c.floor + h + 0.26,
      z + 0.1,
    );
  }
  box(
    out,
    'stone',
    'ashlar',
    c.x - 1.1,
    c.floor,
    c.forecourt.end,
    c.x + 1.1,
    c.floor + 0.94,
    c.forecourt.end + 0.18,
  );
}

export function buildTomb(out, level = 'master') {
  const detail = lod[level];
  if (detail === undefined) throw new Error('Unknown Kazanlak tomb level ' + level);
  walls(out, detail);
  facade(out, detail);
  roof(out, layout.hall, detail, true, false);
  roof(out, layout.annex, detail, false, true);
  brickVault(out, detail);
  forecourt(out, detail);
  if (level === 'master') chamber(out);
}
export const buildTombSkyline = (out) => buildTomb(out, 'skyline');
export const buildTombDistrict = (out) => buildTomb(out, 'district');
export const buildTombStreet = (out) => buildTomb(out, 'street');
export const buildTombCloseup = (out) => buildTomb(out, 'closeup');
