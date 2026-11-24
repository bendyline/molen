import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  walls: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96 },
  moldings: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  doors: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.97 },
  lead: { slot: 'trim', graph: 'metal_copper', roughness: 0.79 },
};

const stone = rgb('8a7e6e');
const trim = rgb('9c8f7e');
const shaft = rgb('766d60');
const shade = rgb('60584c');
const roof = rgb('7b8990');
const copper = rgb('5d7776');
const glass = rgb('51555b');
const door = rgb('514137');
const a = (site.planAngleDegrees * Math.PI) / 180;
const sin = Math.sin(a),
  cos = Math.cos(a);
const world = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const square = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const octagon = Array.from({ length: 8 }, (_, i) => [
  Math.cos(((0.5 - i) * Math.PI) / 4),
  Math.sin(((0.5 - i) * Math.PI) / 4),
]);
const [crossX, midZ] = site.crossing;
const [eastX, eastZ] = site.choir;
const yFloor = 0.21;
const lowFoundation = -6.85;

function frame(cx, cz, turn = 0) {
  const s = Math.sin(turn),
    c = Math.cos(turn);
  return (x, y, z) => world(cx + x * c - z * s, y, cz + x * s + z * c);
}

function face(out, slot, points, color, expected) {
  if (expected && normalFor(...points).reduce((s, v, i) => s + v * expected[i], 0) < 0)
    points = points.toReversed();
  for (let i = 1; i + 1 < points.length; i++) {
    const tri = [points[0], points[i], points[i + 1]],
      n = normalFor(...tri);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
  }
}

function profile(out, slot, at, levels, color, ring = square) {
  loft(
    out,
    slot,
    levels.map(([y, w, d]) => ring.map(([x, z]) => at(x * w, y, z * d))),
    color,
  );
}

function block(out, slot, at, x, y, z, w, h, d, color) {
  profile(
    out,
    slot,
    (u, v, t) => at(u + x, v, t + z),
    [
      [y, w / 2, d / 2],
      [y + h, w / 2, d / 2],
    ],
    color,
  );
}

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  block(out, slot, world, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
}

function cap(out, slot, ring, y, color) {
  const scratch = new MeshBufferBuilder(),
    up = [0, 1, 0];
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Cologne Cathedral podium ring');
  const m = scratch.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const tri = [0, 1, 2].map((j) =>
      Array.from(m.positions.slice(m.indices[i + j] * 3, m.indices[i + j] * 3 + 3)),
    );
    out.addTriangle(slot, '', tri, up, [], color);
  }
}

function footing(out, detail) {
  if (detail < 3) return;
  const points = site.outline.slice();
  const twice = points.reduce((s, [x, z], i) => {
    const p = points[(i + 1) % points.length];
    return s + x * p[1] - z * p[0];
  }, 0);
  if (twice > 0) points.reverse();
  loft(
    out,
    'footing',
    [lowFoundation, -0.035].map((y) => points.map(([x, z]) => [x, y, z])),
    stone,
    { cap: false },
  );
  cap(out, 'footing', points, -0.035, trim);
}

// Close views retain the tilted stone reveals, ledges and two or three mullions.
function pointed(out, at, width, low, high, opening, detail) {
  const { span = width * 0.68, bottom = low + 0.9, top = high - 0.85, portal = false } = opening;
  const r = span / 2,
    spring = bottom + (top - bottom) * 0.74;
  const n = detail >= 3 ? 8 : detail >= 2 ? 4 : 2;
  const curve = Array.from({ length: n + 1 }, (_, i) => {
    const u = (i / n) * 2 - 1;
    return [u * r, spring + (top - spring) * Math.pow(1 - Math.abs(u), 0.61)];
  });
  const p = (x, y, z = 0) => at(x, y, z);
  const quad = (x1, y1, x2, y2, slot = 'walls', color = stone) =>
    face(out, slot, [p(x1, y1), p(x2, y1), p(x2, y2), p(x1, y2)], color);
  quad(-width / 2, low, -r, high);
  quad(r, low, width / 2, high);
  if (bottom > low + 0.001) quad(-r, low, r, bottom);
  for (let i = 0; i < n; i++) {
    const [u, v] = curve[i],
      [x, y] = curve[i + 1];
    face(out, 'walls', [p(u, v), p(x, y), p(x, high), p(u, high)], stone);
  }
  const depth = detail >= 2 ? (portal ? 1.19 : 0.57) : 0;
  const outline = [[-r, bottom], [r, bottom], ...curve.toReversed()];
  face(
    out,
    portal ? 'doors' : 'glazing',
    outline.map(([u, v]) => p(u, v, -depth)),
    portal ? door : glass,
  );
  for (let i = 0; depth > 0 && i < outline.length; i++) {
    const [u, v] = outline[i],
      [x, y] = outline[(i + 1) % outline.length];
    face(out, 'moldings', [p(u, v), p(x, y), p(x, y, -depth), p(u, v, -depth)], shade);
    if (detail >= 2 && i !== 0)
      beam(
        out,
        'moldings',
        p(u, v, 0.056),
        p(x, y, 0.056),
        portal ? 0.32 : 0.17,
        portal ? 0.37 : 0.19,
        trim,
      );
  }
  if (detail >= 2) {
    const bars = portal ? [-0.27, 0.27] : detail === 2 ? [0] : [-0.39, 0, 0.39];
    for (const u of bars) {
      const x = u * r;
      beam(
        out,
        'moldings',
        p(x, bottom, -depth + 0.05),
        p(x, spring + 0.28 * (top - spring), -depth + 0.05),
        portal ? 0.105 : 0.123,
        0.1,
        trim,
      );
    }
    if (!portal && detail >= 3)
      for (const u of [-1, 1]) {
        beam(
          out,
          'moldings',
          p(u * r * 0.48, spring - 0.23, -depth + 0.05),
          p(0, top - 0.39, -depth + 0.05),
          0.13,
          0.095,
          trim,
        );
      }
  }
}

function triangularGable(out, at, w, lo, hi, color = stone) {
  face(out, 'moldings', [at(-w / 2, lo, 0), at(w / 2, lo, 0), at(0, hi, 0)], color);
}

function gabledRoof(out, at, length, width, eaveY, ridgeY) {
  const a = length / 2,
    b = width / 2;
  for (const sign of [-1, 1]) {
    face(
      out,
      'slate',
      [at(-a, ridgeY, 0), at(a, ridgeY, 0), at(a, eaveY, sign * b), at(-a, eaveY, sign * b)],
      roof,
      [0, 1, 0],
    );
    face(
      out,
      'moldings',
      [at(sign * a, eaveY, -b), at(sign * a, ridgeY, 0), at(sign * a, eaveY, b)],
      trim,
      at(sign, 0, 0).map((v, i) => v - at(0, 0, 0)[i]),
    );
  }
}

function pinnacle(out, at, x, z, bottom, height, width, detail) {
  const f = (u, y, v) => at(x + u, y, z + v),
    w = width / 2;
  const y = bottom,
    t = height;
  const p = (v, r) => [v, w * r, w * r];
  const levels =
    detail < 2
      ? [p(y, 1), p(y + t, 0.069)]
      : detail === 2
        ? [p(y, 1), p(y + t * 0.55, 0.78), p(y + t, 0.069)]
        : [
            p(y, 1),
            p(y + t * 0.12, 1),
            p(y + t * 0.18, 0.74),
            p(y + t * 0.51, 0.72),
            p(y + t * 0.6, 0.92),
            p(y + t * 0.73, 0.61),
            p(y + t, 0.07),
          ];
  profile(out, 'moldings', f, levels, trim);
}

function towerBase(out, tower, detail) {
  const {
      center: [x, z],
    } = tower,
    at = frame(x, z);
  const base = detail >= 3 ? yFloor : lowFoundation;
  if (detail === 0) {
    profile(
      out,
      'walls',
      at,
      [
        [base, 12.79, 13.7],
        [69, 12.45, 13.25],
        [99.8, 9.45, 9.45],
      ],
      shaft,
    );
    return;
  }
  const extents = [
    [-12.8, 13.5],
    [12.08, 13.5],
    [13.5, 12.8],
    [-13.5, 12.8],
  ];
  const baseFrame = [
    frame(x - 12.8, z, Math.PI / 2),
    frame(x + 12.08, z, -Math.PI / 2),
    frame(x, z + 13.5),
    frame(x, z - 13.5, Math.PI),
  ];
  const ranges = [
    [base, 20.1],
    [20.1, 44.6],
    [44.6, 70.4],
  ];
  for (const [side, f] of baseFrame.entries()) {
    const w = extents[side][1] * 2;
    for (const [j, [lo, hi]] of ranges.entries()) {
      const count = j === 1 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const u = ((i + (1 - count) / 2) * w) / count;
        pointed(
          out,
          (x, y, z) => f(x + u, y, z),
          w / count,
          lo,
          hi,
          {
            span: (w / count) * (j === 0 ? 0.47 : 0.6),
            bottom: j === 0 && side === 0 ? yFloor : lo + 2.2,
            top: hi - (j === 0 ? 3.8 : 2.8),
            portal: j === 0 && side === 0,
          },
          detail,
        );
      }
    }
    if (detail >= 2) {
      for (const y of [19.66, 44.27, 68.95])
        beam(out, 'moldings', f(-w / 2, y, 0.14), f(w / 2, y, 0.14), 0.55, 0.57, trim);
    }
    for (const u of detail === 1
      ? [-w * 0.46, w * 0.46]
      : [-w * 0.47, -w * 0.32, w * 0.32, w * 0.47])
      pinnacle(
        out,
        f,
        u,
        0.31,
        Math.max(base, 0),
        detail >= 2 ? 76.3 : 73.1,
        detail >= 2 ? 1.28 : 1.47,
        detail,
      );
  }
  profile(
    out,
    'moldings',
    at,
    [
      [69.94, 12.2, 12.4],
      [71.53, 12.2, 12.4],
      [73.29, 10.9, 10.9],
    ],
    trim,
  );
  const r = 10.18;
  for (let i = 0; i < 8; i++) {
    const a = octagon[i],
      b = octagon[(i + 1) % 8];
    const ux = ((a[0] + b[0]) * r) / 2,
      uz = ((a[1] + b[1]) * r) / 2;
    const direction = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const f = frame(x + ux, z + uz, direction);
    pointed(
      out,
      f,
      Math.hypot(a[0] - b[0], a[1] - b[1]) * r,
      73,
      100.8,
      { span: 4.98, bottom: 78.05, top: 98.66 },
      detail,
    );
  }
  if (detail >= 2)
    for (const [u, v] of square) pinnacle(out, at, u * 8.2, v * 8.4, 69.85, 38.27, 2.8, detail);
  profile(
    out,
    'moldings',
    at,
    [
      [99.85, 10.09, 10.09],
      [100.8, 10.09, 10.09],
    ],
    shaft,
    octagon,
  );
}

function spirePanel(out, lowerLeft, lowerRight, upperLeft, upperRight, detail, pierced) {
  const at = (u, v) =>
    lowerLeft.map(
      (n, i) =>
        (n + (lowerRight[i] - n) * u) * (1 - v) +
        (upperLeft[i] + (upperRight[i] - upperLeft[i]) * u) * v,
    );
  if (!pierced) {
    face(out, 'walls', [at(0, 0), at(1, 0), at(1, 1), at(0, 1)], shaft);
    return;
  }
  const left = 0.19,
    right = 0.81,
    base = 0.093,
    spring = 0.665;
  const strip = (u, v, w, h, color = shaft) =>
    face(out, 'walls', [at(u, v), at(w, v), at(w, h), at(u, h)], color);
  strip(0, 0, left, 1);
  strip(right, 0, 1, 1);
  strip(left, 0, right, base, stone);
  const opening =
    detail === 2
      ? [
          [left, spring],
          [0.5, 0.911],
          [right, spring],
        ]
      : [
          [left, spring],
          [0.323, 0.825],
          [0.5, 0.925],
          [0.677, 0.825],
          [right, spring],
        ];
  for (let i = 1; i < opening.length; i++) {
    const [u, v] = opening[i - 1],
      [w, h] = opening[i];
    face(out, 'walls', [at(u, v), at(w, h), at(w, 1), at(u, 1)], shade);
  }
  if (detail >= 3) {
    const n = normalFor(lowerLeft, lowerRight, upperRight);
    const hole = [[left, base], [right, base], ...opening.toReversed()];
    const back = (p) => p.map((v, i) => v - n[i] * 0.19);
    for (let i = 0; i < hole.length; i++) {
      const a = at(...hole[i]),
        b = at(...hole[(i + 1) % hole.length]);
      face(out, 'moldings', [a, b, back(b), back(a)], shade);
    }
    beam(out, 'moldings', at(0.5, base), at(0.5, 0.75), 0.12, 0.164, trim);
  }
}

function spire(out, { center: [x, z], height }, detail) {
  const at = frame(x, z),
    base = 100.74,
    top = height - 2.35;
  const r = 9.94,
    lift = top - base;
  const radial = (t) => r * (1 - t) * (0.97 + 0.03 * (1 - t)) + 0.14;
  if (detail < 2) {
    const shape =
      detail === 0
        ? [
            [base, r, r],
            [top, 0.22, 0.22],
          ]
        : [0, 0.19, 0.41, 0.64, 0.84, 1].map((t) => [base + t * lift, radial(t), radial(t)]);
    profile(out, 'walls', at, shape, shaft, octagon);
  } else {
    const levels =
      detail === 2
        ? [0, 0.17, 0.35, 0.54, 0.73, 0.87, 1]
        : [0, 0.108, 0.225, 0.347, 0.47, 0.594, 0.711, 0.81, 0.895, 0.955, 1];
    const point = (i, t) => {
      const [u, v] = octagon[i % 8];
      const r = radial(t);
      return at(u * r, base + t * lift, v * r);
    };
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < levels.length - 1; j++) {
        const t = levels[j],
          u = levels[j + 1],
          width = Math.max(0.118, 0.85 * (1 - t));
        const l = point(i, t),
          m = point(i, u),
          n = point(i + 1, t),
          o = point(i + 1, u);
        spirePanel(out, l, n, m, o, detail, j < levels.length - 3);
        beam(out, 'moldings', l, m, width, width * 0.88, stone);
        if (j < levels.length - 3) {
          if (detail >= 3) beam(out, 'moldings', l, n, width * 0.69, width * 0.62, stone);
          if (detail >= 4)
            pinnacle(
              out,
              at,
              octagon[i][0] * (radial(t) + 0.12),
              octagon[i][1] * (radial(t) + 0.12),
              base + t * lift,
              Math.min(1.47, 2.1 * (1 - t)),
              Math.max(0.19, 0.59 * (1 - t)),
              2,
            );
        }
      }
    }
  }
  pinnacle(out, at, 0, 0, top - 0.06, 2.41, detail < 2 ? 1.08 : 1.45, detail);
}

function westScreen(out, detail) {
  const x = -72.5,
    z = midZ;
  if (detail === 0) {
    box(out, 'walls', x, -58, z - 5, z + 5, lowFoundation, 62.76, stone);
    return;
  }
  const f = frame(x, z, Math.PI / 2);
  pointed(
    out,
    f,
    11.25,
    Math.max(lowFoundation, detail >= 3 ? yFloor : lowFoundation),
    20.2,
    { span: 8.1, bottom: yFloor, top: 16.2, portal: true },
    detail,
  );
  pointed(out, f, 11.25, 20.2, 62.7, { span: 8.87, bottom: 22.32, top: 60.1 }, detail);
  triangularGable(out, f, 11.2, 62.7, 69.04);
  if (detail >= 2) {
    pinnacle(out, f, -5.58, 0.51, 4, 69, 1.6, detail);
    pinnacle(out, f, 5.58, 0.51, 4, 69, 1.6, detail);
  }
}

function wallsOfBay(out, x0, x1, z0, z1, base, top, bays, detail) {
  if (detail === 0) {
    box(out, 'walls', x0, x1, z0, z1, base, top, stone);
    return;
  }
  const w = (x1 - x0) / bays;
  for (const side of [-1, 1]) {
    const z = side < 0 ? z0 : z1;
    for (let j = 0; j < bays; j++) {
      const x = x0 + (j + 0.5) * w;
      pointed(
        out,
        frame(x, z, side === 1 ? 0 : Math.PI),
        w,
        base,
        top,
        { span: w * 0.58, bottom: Math.max(base + 2.48, yFloor + 2.9), top: top - 1.24 },
        detail,
      );
    }
  }
}

function nave(out, x0, x1, bays, detail) {
  const y0 = detail >= 3 ? yFloor : lowFoundation;
  const w = x1 - x0,
    z = midZ;
  wallsOfBay(out, x0, x1, z - 22.5, z + 22.5, y0, 22.7, bays, detail);
  if (detail >= 1) box(out, 'walls', x0, x1, z - 22.45, z + 22.45, y0, 2.71, stone);
  for (const hand of [-1, 1]) {
    const low = z + hand * 22.5,
      up = z + hand * 14.15;
    face(
      out,
      'slate',
      [world(x0, 22.7, low), world(x1, 22.7, low), world(x1, 29.17, up), world(x0, 29.17, up)],
      roof,
      [0, 1, 0],
    );
    face(
      out,
      'walls',
      [world(x0, 22.6, up), world(x1, 22.6, up), world(x1, 29.45, up), world(x0, 29.45, up)],
      stone,
      world(0, 0, hand),
    );
    face(
      out,
      'slate',
      [
        world(x0, 29.45, up),
        world(x1, 29.45, up),
        world(x1, 33.77, z + hand * 7.42),
        world(x0, 33.77, z + hand * 7.42),
      ],
      roof,
      [0, 1, 0],
    );
  }
  wallsOfBay(out, x0, x1, z - 7.42, z + 7.42, 33.77, 45.89, bays, detail);
  gabledRoof(out, frame((x0 + x1) / 2, z), w, 14.85, 45.89, 61.1);
}

function transept(out, hand, detail) {
  const len = hand < 0 ? 40.1 : 39.42;
  const wall = frame(crossX, midZ + hand * len, hand === 1 ? 0 : Math.PI);
  const at = frame(crossX, midZ + (hand * len) / 2, hand === 1 ? -Math.PI / 2 : Math.PI / 2);
  const y0 = detail >= 3 ? yFloor : lowFoundation;
  gabledRoof(out, at, len, 15.25, 45.86, 61.1);
  if (detail === 0) {
    block(out, 'walls', at, 0, y0, 0, len, 46 - y0, 15.2, stone);
    block(out, 'walls', at, 0, y0, 0, len, 27.4 - y0, 37, stone);
    triangularGable(out, wall, 37.8, 45.6, 69.95);
    return;
  }
  const start = 8.25,
    n = detail < 3 ? 2 : 4;
  const sideDetail = detail === 2 ? 1 : detail;
  for (const side of [-1, 1]) {
    const u = side * 7.58,
      v = side * 18.21;
    const turn = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const L = (len - start) / n;
    for (let i = 0; i < n; i++) {
      const z = midZ + hand * (start + (i + 0.5) * L);
      pointed(out, frame(crossX + u, z, turn), L, 30.4, 45.88, {}, sideDetail);
      pointed(out, frame(crossX + v, z, turn), L, y0, 25.54, {}, sideDetail);
    }
    face(
      out,
      'slate',
      [
        world(crossX + v, 25.5, midZ),
        world(crossX + v, 25.5, midZ + hand * len),
        world(crossX + u, 30.44, midZ + hand * len),
        world(crossX + u, 30.44, midZ),
      ],
      roof,
      [0, 1, 0],
    );
    for (const x of [side * 13.44, side * 18.2]) {
      const f = (u, y, z) => wall(u + x, y, z);
      pointed(
        out,
        f,
        9.47,
        y0,
        27.45,
        { span: 5.85, bottom: yFloor, top: 20.8, portal: true },
        detail,
      );
      pinnacle(out, wall, x, 0.5, 1.34, 48.52, 1.95, detail);
    }
  }
  pointed(
    out,
    wall,
    17.82,
    y0,
    22.5,
    { span: 12.25, bottom: yFloor, top: 19.12, portal: true },
    detail,
  );
  pointed(out, wall, 17.82, 22.5, 49.2, { span: 12.76, bottom: 23.8, top: 47.4 }, detail);
  triangularGable(out, wall, 17.8, 49.16, 68.17);
  pinnacle(out, wall, 0, 0.22, 67.79, 2.16, 1.0, detail);
  if (detail >= 2)
    for (const x of [-8.93, 8.93]) pinnacle(out, wall, x, 0.14, 22.15, 38.48, 1.48, detail);
}

function choir(out, detail) {
  const y0 = detail >= 3 ? yFloor : lowFoundation;
  const count = detail === 0 ? 6 : 7;
  const pt = (r, t, y) => world(eastX + r * Math.cos(t), y, eastZ + r * Math.sin(t));
  for (let i = 0; i < count; i++) {
    const a = (i / count - 0.5) * Math.PI,
      b = ((i + 1) / count - 0.5) * Math.PI,
      t = (a + b) / 2;
    const outer = 24.26;
    const halfAngle = (b - a) / 2;
    const border = pt(outer, t, 0);
    const chord = (r) => r * Math.cos(halfAngle);
    const f = frame(
      eastX + chord(outer) * Math.cos(t),
      eastZ + chord(outer) * Math.sin(t),
      t - Math.PI / 2,
    );
    const spacing = (r) => 2 * r * Math.sin(halfAngle);
    if (detail === 0) {
      face(
        out,
        'walls',
        [pt(outer, b, y0), pt(outer, a, y0), pt(outer, a, 22.0), pt(outer, b, 22.0)],
        stone,
        border.map((n, i) => n - pt(0, 0, 0)[i]),
      );
      face(
        out,
        'walls',
        [pt(7.42, b, 31), pt(7.42, a, 31), pt(7.42, a, 45.89), pt(7.42, b, 45.89)],
        stone,
        border.map((n, i) => n - pt(0, 0, 0)[i]),
      );
    } else {
      pointed(out, f, spacing(outer), y0, 22.18, { span: spacing(outer) * 0.58 }, detail);
      const clerestory = frame(
        eastX + chord(7.58) * Math.cos(t),
        eastZ + chord(7.58) * Math.sin(t),
        t - Math.PI / 2,
      );
      pointed(out, clerestory, spacing(7.58), 31.1, 45.89, { span: spacing(7.58) * 0.71 }, detail);
    }
    for (const [r1, r2, y1, y2] of [
      [outer, 14.15, 22.15, 29.15],
      [14.15, 7.56, 29.15, 31.2],
    ]) {
      face(
        out,
        'slate',
        [pt(r1, a, y1), pt(r1, b, y1), pt(r2, b, y2), pt(r2, a, y2)],
        roof,
        [0, 1, 0],
      );
    }
    face(out, 'slate', [pt(7.62, a, 45.89), pt(7.62, b, 45.89), pt(0, t, 61.1)], roof, [0, 1, 0]);
  }
}

function brace(out, inner, outer, lo, hi, detail) {
  const n = detail === 2 ? 3 : 6;
  const dx = outer[0] - inner[0],
    dz = outer[1] - inner[1],
    l = Math.hypot(dx, dz);
  const at = frame((inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2, Math.atan2(dz, dx));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = l * (t - 0.5);
    const y = hi + (lo - hi) * t + 9.4 * t * (1 - t);
    const thickness = 0.91 + 0.29 * (1 - t);
    points.push(
      [
        [y - thickness, -0.46],
        [y, -0.46],
        [y, 0.46],
        [y - thickness, 0.46],
      ].map(([y, v]) => at(u, y, v)),
    );
  }
  loft(out, 'moldings', points, trim);
}

function buttresses(out, detail) {
  if (detail === 0) return;
  for (const { id, span } of site.abutments) {
    const radial = id >= 691247247 && id <= 691247254;
    const acrossTransept = id >= 691247255;
    const [a, b] = span.toSorted((a, b) => a[acrossTransept ? 0 : 1] - b[acrossTransept ? 0 : 1]);
    const spans = radial
      ? [span]
      : [
          [acrossTransept ? [crossX - 7.57, a[1]] : [a[0], midZ - 7.32], a],
          [acrossTransept ? [crossX + 7.57, b[1]] : [b[0], midZ + 7.32], b],
        ];
    for (let [inner, outer] of spans) {
      if (
        radial &&
        Math.hypot(inner[0] - eastX, inner[1] - eastZ) >
          Math.hypot(outer[0] - eastX, outer[1] - eastZ)
      )
        [inner, outer] = [outer, inner];
      const [x, z] = outer,
        dx = x - inner[0],
        dz = z - inner[1],
        l = Math.hypot(dx, dz);
      const at = frame(x, z, Math.atan2(dz, dx));
      const base = detail >= 3 ? yFloor : lowFoundation;
      const h = radial ? 38.4 : 40.7;
      const pierProfile =
        detail === 1
          ? [
              [base, 1.12, 0.93],
              [h, 0.64, 0.58],
            ]
          : [
              [base, 1.12, 0.93],
              [18.3, 1.12, 0.93],
              [21.5, 0.93, 0.75],
              [h, 0.64, 0.58],
            ];
      profile(out, 'walls', at, pierProfile, stone);
      pinnacle(out, at, 0, 0, h - 1.1, radial ? 6.22 : 8.26, 1.47, detail);
      if (detail === 1) {
        beam(
          out,
          'moldings',
          world(inner[0], 43.42, inner[1]),
          world(x, 35.17, z),
          1.03,
          1.18,
          trim,
        );
      } else {
        brace(out, inner, outer, 33.45, 44.05, detail);
        const lower = [inner[0] + (dx / l) * 4.15, inner[1] + (dz / l) * 4.15];
        if (detail >= 3) brace(out, lower, outer, 22.5, 31.24, detail);
        else
          beam(
            out,
            'moldings',
            world(lower[0], 31.24, lower[1]),
            world(x, 22.5, z),
            0.84,
            0.921,
            stone,
          );
      }
    }
  }
}

function crossingTurret(out, detail) {
  const at = frame(crossX, midZ),
    top = site.documentedDimensions.crossingTower;
  const rings = [
    [58, 4.56, 4.56],
    [76.04, 3.97, 3.97],
    [80.04, 3.05, 3.05],
    [100.21, 1.0, 1.0],
    [top - 0.95, 0.15, 0.15],
  ];
  if (detail === 0) {
    profile(out, 'lead', at, rings, copper, octagon);
  } else {
    profile(out, 'lead', at, rings.slice(0, 3), copper, octagon);
    for (let i = 0; i < 8; i++) {
      const [x, z] = octagon[i],
        [u, v] = octagon[(i + 1) % 8];
      beam(
        out,
        'lead',
        at(x * 3.08, 80, z * 3.08),
        at(x * 0.87, 101.1, z * 0.87),
        0.23,
        0.29,
        copper,
      );
      if (detail >= 2) {
        for (const tt of [0.25, 0.54, 0.74]) {
          const r = 3.08 - 2.21 * tt,
            y = 80 + 21.1 * tt;
          beam(out, 'lead', at(x * r, y, z * r), at(u * r, y, v * r), 0.164, 0.158, copper);
        }
      }
    }
    profile(
      out,
      'lead',
      at,
      [
        [100.58, 1.03, 1.03],
        [top - 0.64, 0.09, 0.09],
      ],
      copper,
      octagon,
    );
  }
  pinnacle(out, at, 0, 0, top - 1, 1, 0.56, detail);
}

function build(out, detail) {
  footing(out, detail);
  for (const tower of site.towers) {
    towerBase(out, tower, detail);
    spire(out, tower, detail);
  }
  westScreen(out, detail);
  const bodyDetail = detail === 2 ? 1 : detail;
  nave(out, -48.03, crossX - 7.62, 5, bodyDetail);
  nave(out, crossX + 7.62, eastX, 4, bodyDetail);
  gabledRoof(out, frame(crossX, midZ), 15.24, 14.84, 45.89, 61.1);
  transept(out, 1, detail);
  transept(out, -1, detail);
  choir(out, bodyDetail);
  buttresses(out, detail);
  crossingTurret(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
