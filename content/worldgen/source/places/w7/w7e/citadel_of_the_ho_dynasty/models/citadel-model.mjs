import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  voussoir: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 1 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 1 },
};

const shade = rgb('848480'),
  dark = rgb('6d716b'),
  curb = rgb('8d8c80');
const earth = rgb('777957'),
  grass = rgb('767f55');
const courses = ['8f9087', '8b8d84', '92928a', '878982', '93958d', '868884', '8e9089'].map(rgb);

function writer(out, g) {
  const {
    center: [x, z],
    ground,
    across: [a, b],
    forward: [c, d],
  } = g;
  const point = ([u, y, v]) => [x + a * u + c * v, ground + y, z + b * u + d * v];
  const normal = ([u, y, v]) => [a * u + c * v, y, b * u + d * v];
  return (slot, points, color, axis) => {
    let p = points.map((q) => point(q).map(Math.fround));
    const goal = normal(axis);
    if (normalFor(...p).reduce((s, n, i) => s + n * goal[i], 0) < 0) p = p.toReversed();
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
    }
  };
}

function panel(face, at, width, height, axis, detail) {
  const rows = Math.ceil(height / (detail === 3 ? 1.09 : 1.5));
  const cols = Math.ceil(width / (detail === 3 ? 2.32 : 2.78));
  const unit = width / cols;
  for (let i = 0; i < rows; i++) {
    const y = (height * i) / rows,
      h = (height * (i + 1)) / rows;
    const offset = i % 2 === 0 ? 0 : -unit * 0.5;
    for (let j = 0; j <= cols; j++) {
      const a = Math.max(0, offset + j * unit),
        b = Math.min(width, offset + (j + 1) * unit);
      if (b - a < 0.13) continue;
      const u = a + 0.012,
        v = b - 0.012,
        q = 0.029 + 0.007 * ((i + 2 * j) % 4);
      const p = [
        at(u, y + 0.012, q),
        at(v, y + 0.012, q),
        at(v, h - 0.012, q),
        at(u, h - 0.012, q),
      ];
      face('rock', p, courses[(i * 9 + j * 13) % courses.length], axis);
    }
  }
}

function pier(face, a, b, near, far, top, detail) {
  if (b - a < 0.02) return;
  const y = -3.4;
  face(
    'rock',
    [
      [a, y, near],
      [a, y, far],
      [a, top, far],
      [a, top, near],
    ],
    shade,
    [-1, 0, 0],
  );
  face(
    'rock',
    [
      [b, y, far],
      [b, y, near],
      [b, top, near],
      [b, top, far],
    ],
    shade,
    [1, 0, 0],
  );
  face(
    'rock',
    [
      [a, top, near],
      [a, top, far],
      [b, top, far],
      [b, top, near],
    ],
    curb,
    [0, 1, 0],
  );
  for (const [z, s] of [
    [near, -1],
    [far, 1],
  ]) {
    face(
      'rock',
      [
        [a, y, z],
        [b, y, z],
        [b, top, z],
        [a, top, z],
      ],
      detail >= 2 ? dark : shade,
      [0, 0, s],
    );
    if (detail >= 2)
      panel(face, (p, y, q) => [a + p, y - 0.24, z + q * s], b - a, top + 0.223, [0, 0, s], detail);
  }
}

function vault(face, { offset, width, clear }, near, far, top, detail) {
  const r = width / 2,
    rise = r * 0.95,
    spring = clear - rise;
  const count = [6, 10, 18, 28][detail];
  const arch = (i, thickness = 0) => {
    const t = Math.PI * (1 - i / count);
    return [offset + Math.cos(t) * (r + thickness), spring + Math.sin(t) * (rise + thickness)];
  };
  for (let i = 0; i < count; i++) {
    const [x0, y0] = arch(i),
      [x1, y1] = arch(i + 1);
    for (const [z, s] of [
      [near, -1],
      [far, 1],
    ]) {
      face(
        'rock',
        [
          [x0, y0, z],
          [x1, y1, z],
          [x1, top, z],
          [x0, top, z],
        ],
        shade,
        [0, 0, s],
      );
      if (detail >= 1) {
        const [u0, v0] = arch(i + 0.018, 0.51),
          [u1, v1] = arch(i + 0.982, 0.51);
        const [a, p] = arch(i + 0.018),
          [b, q] = arch(i + 0.982);
        const side = z + s * 0.038;
        face(
          'voussoir',
          [
            [a, p, side],
            [b, q, side],
            [u1, v1, side],
            [u0, v0, side],
          ],
          courses[(i * 3) % courses.length],
          [0, 0, s],
        );
      }
    }
    face(
      'voussoir',
      [
        [x0, y0, near],
        [x1, y1, near],
        [x1, y1, far],
        [x0, y0, far],
      ],
      curb,
      [0, -1, 0],
    );
    face(
      'rock',
      [
        [x0, top, near],
        [x0, top, far],
        [x1, top, far],
        [x1, top, near],
      ],
      curb,
      [0, 1, 0],
    );
  }
}

function curtainWall(face, g, side, detail) {
  const [left, right, near, far] = g.bounds;
  const a = side < 0 ? left : right,
    b = a + g.curtain * side;
  const base = far + 0.23,
    inside = near + 1.28;
  const h0 = Math.min(4.74, g.crest - 0.88),
    h1 = h0 - 0.42;
  const bottom = -3.45;
  face(
    'rubble',
    [
      [a, bottom, base],
      [b, bottom, base],
      [b, h1, base - 0.44],
      [a, h0, base - 0.27],
    ],
    shade,
    [0, 0, 1],
  );
  face(
    'earth',
    [
      [a, h0, base - 0.27],
      [b, h1, base - 0.44],
      [b, h1 + 0.25, inside + 1.12],
      [a, h0 + 0.28, inside + 0.9],
    ],
    grass,
    [0, 1, 0],
  );
  face(
    'earth',
    [
      [a, h0 + 0.28, inside + 0.9],
      [b, h1 + 0.25, inside + 1.12],
      [b, bottom, inside - 2.7],
      [a, bottom, inside - 2.7],
    ],
    earth,
    [0, 0, -1],
  );
  face(
    'rubble',
    [
      [b, bottom, base],
      [b, bottom, inside - 2.7],
      [b, h1 + 0.25, inside + 1.12],
      [b, h1, base - 0.44],
    ],
    dark,
    [side, 0, 0],
  );
  if (detail >= 2) {
    const min = Math.min(a, b),
      max = Math.max(a, b);
    const plane = (x, y) => {
      const t = (x - a) / (b - a),
        height = h0 + (h1 - h0) * t;
      return base - ((0.27 + 0.17 * t) * (y - bottom)) / (height - bottom) + 0.034;
    };
    for (let k = 0; k < 3; k++) {
      const lo = 0.47 + k * 1.04,
        hi = lo + 0.83;
      const n = Math.ceil((max - min) / 2.5);
      for (let i = 0; i < n; i++) {
        const x0 = min + ((max - min) * i) / n + 0.021,
          x1 = min + ((max - min) * (i + 1)) / n - 0.018;
        face(
          'rubble',
          [
            [x0, lo, plane(x0, lo)],
            [x1, lo, plane(x1, lo)],
            [x1, hi, plane(x1, hi)],
            [x0, hi, plane(x0, hi)],
          ],
          courses[(i + k * 4) % courses.length],
          [0, 0, 1],
        );
      }
    }
  }
}

function gateway(out, g, detail) {
  const face = writer(out, g);
  const [left, right, near, far] = g.bounds,
    top = g.crest;
  let cursor = left;
  for (const opening of g.openings) {
    const x0 = opening.offset - opening.width / 2,
      x1 = opening.offset + opening.width / 2;
    pier(face, cursor, x0, near, far, top, detail);
    vault(face, opening, near, far, top, detail);
    cursor = x1;
  }
  pier(face, cursor, right, near, far, top, detail);
  for (const side of [-1, 1]) curtainWall(face, g, side, detail);
  if (detail >= 1) {
    for (const [z, d] of [
      [near, -1],
      [far, 1],
    ]) {
      face(
        'voussoir',
        [
          [left, top - 0.26, z + d * 0.061],
          [right, top - 0.26, z + d * 0.061],
          [right, top - 0.056, z + d * 0.061],
          [left, top - 0.056, z + d * 0.061],
        ],
        curb,
        [0, 0, d],
      );
    }
  }
}

function citadel(out, detail) {
  for (const g of site.gates) gateway(out, g, detail);
}

export const buildSkyline = (out) => citadel(out, 0);
export const buildDistrict = (out) => citadel(out, 1);
export const buildStreet = (out) => citadel(out, 2);
export const buildCloseup = (out) => citadel(out, 3);
export const buildMaster = buildCloseup;
