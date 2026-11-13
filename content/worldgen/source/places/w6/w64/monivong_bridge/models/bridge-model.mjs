import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const componentControls = layout.componentControls;
const concrete = { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.93 };
const paving = { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 };
const metal = { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.14 };
export const surfaces = {
  concrete,
  soffit: concrete,
  fascia: concrete,
  pier: concrete,
  seat: concrete,
  asphalt: paving,
  walk: paving,
  joint: paving,
  roadLine: paving,
  metal,
  rail: metal,
  lamp: metal,
  steel: metal,
};
const palette = {
  concrete: [0.596, 0.568, 0.506],
  soffit: [0.474, 0.457, 0.414],
  fascia: [0.67, 0.635, 0.563],
  pier: [0.57, 0.54, 0.48],
  seat: [0.664, 0.625, 0.55],
  asphalt: [0.395, 0.411, 0.414],
  walk: [0.62, 0.61, 0.57],
  joint: [0.26, 0.263, 0.254],
  roadLine: [0.889, 0.867, 0.777],
  metal: [0.57, 0.592, 0.561],
  rail: [0.637, 0.657, 0.637],
  lamp: [0.84, 0.83, 0.735],
  steel: [0.474, 0.499, 0.492],
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([r, c]) => [
    r,
    c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function station(rows, x) {
  const i = rows.findIndex((p) => p[0] >= x);
  if (i === 0) return rows[0].slice(1);
  if (i < 0) return rows.at(-1).slice(1);
  const [a, y, z] = rows[i - 1],
    [b, h, w] = rows[i],
    t = (x - a) / (b - a);
  return [mix(y, h, t), mix(z, w, t)];
}
function projection(C, x, offset, height = 0) {
  const [y, z] = station(C.deck, x),
    [a, b] = C.ends;
  const k =
    x < a + 13
      ? C.paths[0].skew * clamp(1 - (x - a) / 13, 0, 1)
      : C.paths[1].skew * clamp(1 - (b - x) / 13, 0, 1);
  const u = offset / Math.hypot(1, k);
  return [x + k * u, y + height, z + u];
}
const edgeLift = (C, x) => 0.16 * clamp(Math.min(x - C.ends[0], C.ends[1] - x) / 8.5, 0, 1);
export function girderDepth(C, x) {
  const outerDepth = clamp(Math.min(x - C.ends[0], C.ends[1] - x) / 14, 0, 1);
  const haunch = Math.max(
    ...C.piers.map((p) => Math.max(0, 1 - Math.abs(x - p.x) / (C.north ? 37 : 43))),
  );
  const seat = Math.max(...C.abutments.map((p) => Math.max(0, 1 - Math.abs(x - p.x) / 16)));
  return (
    0.32 + outerDepth * ((C.north ? 0.91 : 1.06) + (C.north ? 1.16 : 1.42) * haunch + 0.53 * seat)
  );
}
function writer(out) {
  return (role, points, normal, tint = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0) {
        p.reverse();
        n = n.map((x) => -x);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        colors[role].map((v) => v * tint),
      );
    }
  };
}
function ring(x, y, z, a, b, clipped) {
  const u = a / 2,
    v = b / 2;
  const shape = clipped
    ? [
        [-u, -v * 0.76],
        [-u * 0.62, -v],
        [u * 0.62, -v],
        [u, -v * 0.76],
        [u, v * 0.76],
        [u * 0.62, v],
        [-u * 0.62, v],
        [-u, v * 0.76],
      ]
    : [
        [-u, -v],
        [u, -v],
        [u, v],
        [-u, v],
      ];
  return shape.toReversed().map(([a, b]) => [x + a, y, z + b]);
}
function section(C, x) {
  const t = clamp(Math.min(x - C.ends[0], C.ends[1] - x) / 10, 0, 1);
  const curb = edgeLift(C, x),
    half = mix(6.02, C.carriageHalf, t),
    width = mix(6.36, C.half, t);
  return { half, width, curb };
}
function deck(f, bar, C, d) {
  const rows = C.deck.map((row) => row[0]);
  const cuts =
    d === 0
      ? rows.filter(
          (x, i) =>
            i % 3 === 0 ||
            x === rows.at(-1) ||
            C.piers.some((p) => p.x === x) ||
            C.body.includes(x),
        )
      : rows;
  const at = (x, z, y) => projection(C, x, z, y);
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i],
      A = section(C, a),
      B = section(C, b);
    f('asphalt', [at(a, -A.half, 0), at(b, -B.half, 0), at(b, B.half, 0), at(a, A.half, 0)], up);
    const lo = girderDepth(C, a),
      hi = girderDepth(C, b),
      underWidth = C.north ? 0.79 : 0.76;
    const innerA = A.width * underWidth,
      innerB = B.width * underWidth;
    f(
      'soffit',
      [at(a, -innerA, -lo), at(b, -innerB, -hi), at(b, innerB, -hi), at(a, innerA, -lo)],
      down,
    );
    for (const side of [-1, 1]) {
      const z = side * A.width,
        w = side * B.width,
        u = side * A.half,
        v = side * B.half;
      f('walk', [at(a, u, A.curb), at(b, v, B.curb), at(b, w, B.curb), at(a, z, A.curb)], up);
      f('fascia', [at(a, u, 0), at(b, v, 0), at(b, v, B.curb), at(a, u, A.curb)], [0, 0, -side]);
      const drop = 0.28;
      f(
        'fascia',
        [at(a, z, A.curb), at(b, w, B.curb), at(b, w, -drop), at(a, z, -drop)],
        [0, 0, side],
      );
      f(
        'concrete',
        [at(a, z, -drop), at(b, w, -drop), at(b, side * innerB, -hi), at(a, side * innerA, -lo)],
        [0, -0.4, side],
      );
      if (d >= 2) {
        const trim = 0.075;
        f(
          'soffit',
          [
            at(a, z, -drop - trim),
            at(b, w, -drop - trim),
            at(b, w, -drop + 0.015),
            at(a, z, -drop + 0.015),
          ],
          [0, 0, side],
        );
      }
    }
    if (d >= 2 && i % 4 === 0 && a > C.body[0] && b < C.body[1]) {
      const y = -girderDepth(C, a) + 0.14;
      for (const offset of [-0.39, 0.39])
        bar(
          'soffit',
          at(a, -A.width * 0.77, y + offset * 0.12),
          at(a, A.width * 0.77, y + offset * 0.12),
          0.18,
          0.24,
        );
    }
  }
  for (const x of C.ends) {
    const A = section(C, x),
      lo = -girderDepth(C, x),
      n = x < 0 ? [-1, 0, 0] : [1, 0, 0];
    f(
      'soffit',
      [
        at(x, -A.width, A.curb),
        at(x, A.width, A.curb),
        at(x, A.width * 0.77, lo),
        at(x, -A.width * 0.77, lo),
      ],
      n,
    );
  }
  if (d < 2) return;
  const [x0, x1] = C.ends;
  const paint = (a, b, z, w = 0.083) =>
    f(
      'roadLine',
      [
        at(a, z - w / 2, 0.017),
        at(b, z - w / 2, 0.017),
        at(b, z + w / 2, 0.017),
        at(a, z + w / 2, 0.017),
      ],
      up,
    );
  for (const side of [-1, 1])
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        z = side * (C.carriageHalf - 0.31);
      if (a > x0 + 4.2 && b < x1 - 4.2) paint(a, b, z, 0.097);
    }
  for (const z of C.north ? [0] : [-1.91, 1.91])
    for (let x = x0 + 9; x < x1 - 7; x += d === 2 ? 11.4 : 8.95)
      paint(x, Math.min(x + 3.14, x1 - 5.5), z, 0.111);
  for (const x of [...C.body, ...C.piers.map((p) => p.x)]) {
    const w = section(C, x).half;
    f(
      'joint',
      [
        at(x - 0.075, -w, 0.026),
        at(x + 0.075, -w, 0.026),
        at(x + 0.075, w, 0.026),
        at(x - 0.075, w, 0.026),
      ],
      up,
    );
  }
}
function supports(out, bar, C, d) {
  for (const P of [...C.piers, ...C.abutments]) {
    const { x, z, width, crossWidth, base, river } = P,
      [top] = station(C.deck, x),
      y = top - girderDepth(C, x) + 0.06;
    const shape = (a, b, h) => ring(x, h, z, width * a, crossWidth * b, d >= 1 && river);
    const toe = shape(1.13, 1.07, base),
      shaft = shape(1, 1, Math.min(base + 1.45, y - 0.6)),
      cap = shape(1.17, 1.11, y + 0.18);
    loft(
      out,
      'pier',
      d === 0 ? [toe, cap] : [toe, shaft, shape(0.92, 0.93, y - 0.42), cap],
      colors.pier,
    );
    if (d >= 2 && river) {
      for (const sign of [-1, 1]) {
        const offset = z + crossWidth * sign * 0.35;
        bar(
          'steel',
          [x - width * 0.22, y - 0.095, offset],
          [x + width * 0.22, y - 0.095, offset],
          0.37,
          0.47,
        );
      }
      if (d >= 3) {
        const border = shape(1.025, 1.02, Math.min(base + 3.32, y - 0.46));
        for (let i = 0; i < border.length; i++)
          bar('soffit', border[i], border[(i + 1) % border.length], 0.049, 0.064);
      }
    }
  }
}
function barriers(f, bar, C, d) {
  const [a, b] = C.ends,
    first = a + 7.6,
    last = b - 7.6;
  const railAt = (x, s, height) =>
    projection(C, x, s * (section(C, x).width - 0.24), edgeLift(C, x) + height);
  const rows = [first, ...C.deck.map((p) => p[0]).filter((x) => x > first && x < last), last];
  for (const s of [-1, 1]) {
    for (let i = 1; i < rows.length; i++) {
      const x = rows[i - 1],
        y = rows[i];
      const a = railAt(x, s, 0.075),
        b = railAt(y, s, 0.075),
        c = railAt(y, s, 0.286),
        e = railAt(x, s, 0.286);
      f('fascia', [a, b, c, e], [0, 0, s]);
      f('fascia', [a, e, c, b], [0, 0, -s]);
      if (d >= 1) {
        bar('rail', railAt(x, s, 1.01), railAt(y, s, 1.01), 0.071, 0.075);
        if (d >= 2) bar('rail', railAt(x, s, 0.627), railAt(y, s, 0.627), 0.05, 0.048);
      }
    }
    if (d >= 1) {
      const count = d === 1 ? 19 : d === 2 ? 38 : d === 3 ? 54 : 77;
      for (let i = 0; i < count; i++) {
        const x = mix(first, last, i / (count - 1)),
          foot = railAt(x, s, 0.16),
          top = railAt(x, s, 1.01);
        bar('metal', foot, top, d === 1 ? 0.084 : 0.069, 0.092);
        if (d >= 3 && i % 2 === 0)
          bar('steel', railAt(x, s, 0.072), railAt(x, s, 0.18), 0.21, 0.151);
      }
    }
  }
}
function lighting(bar, C, d) {
  if (d === 0) return;
  const [a, b] = C.ends,
    count = C.north ? (d === 1 ? 8 : 15) : d === 1 ? 7 : 12;
  for (let i = 0; i < count; i++) {
    const x = mix(a + 14, b - 14, i / (count - 1)),
      side = i % 2 === 0 ? 1 : -1,
      off = side * (section(C, x).width - 0.42);
    const at = (z, y) => projection(C, x, off - side * z, edgeLift(C, x) + y);
    const h = C.north ? 6.77 : 5.94,
      points = [
        at(0, 0),
        at(0, h - 0.76),
        at(0.17, h - 0.34),
        at(0.56, h - 0.045),
        at(1.16, h + 0.15),
      ];
    const path = d === 1 ? [points[0], points[1], points.at(-1)] : points;
    for (let j = 1; j < path.length; j++)
      bar('metal', path[j - 1], path[j], j === 1 ? 0.101 : 0.071, j === 1 ? 0.107 : 0.078);
    bar('lamp', at(1.13, h + 0.15), at(1.55, h + 0.12), 0.155, 0.21);
    if (d >= 3) bar('steel', at(0, 0), at(0, 0.31), 0.25, 0.225);
  }
}
export function buildMonivongComponent(out, level, id) {
  const C = componentControls.find((c) => c.id === id),
    d = tiers[level],
    f = writer(out),
    bar = (role, a, b, w, h) => beam(out, role, a, b, w, h, colors[role]);
  deck(f, bar, C, d);
  supports(out, bar, C, d);
  barriers(f, bar, C, d);
  lighting(bar, C, d);
}
export function buildAssembly(out, level) {
  for (const C of componentControls) {
    const a = C.heading - layout.heading,
      c = Math.cos(a),
      s = Math.sin(a),
      rotate = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
    const place = (p) => {
      const [x, y, z] = rotate(p);
      return [x + C.center[0], y, z + C.center[1]];
    };
    const shifted = {
      addTriangle: (role, ref, p, n, u, k) =>
        out.addTriangle(role, ref, p.map(place), rotate(n), u, k),
      addQuad: (role, ref, p, n, u, k) => out.addQuad(role, ref, p.map(place), rotate(n), u, k),
      addConvexPolygon: (role, ref, p, n, u, k) =>
        out.addConvexPolygon(role, ref, p.map(place), rotate(n), u, k),
    };
    buildMonivongComponent(shifted, level, C.id);
  }
}
