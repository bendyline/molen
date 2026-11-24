import { normalize } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap as flatCap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95 },
  carved: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.96 },
  rail: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98 },
};

const { center, gates, dome, terraceRadius } = site;
const tau = Math.PI * 2;
const pale = rgb('c8b89d');
const silvery = rgb('a0978a');
const floor = rgb('a49785');
const sand = rgb('b7a488');
const relief = rgb('a8967b');
const dark = rgb('7f776d');
const repair = rgb('91847d');
const south = gates.find((g) => g.name === 'south');
const xz = ([x, , z]) => [x, z];

function radial(r, a) {
  return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
}
function point(r, a, y) {
  const [x, z] = radial(r, a);
  return [x, y, z];
}
function ring(out, slot, c, rows, count, color, options) {
  lathe(
    out,
    slot,
    c,
    rows.map(([y, r]) => [y, r, r]),
    count,
    color,
    options,
  );
}
function sector(a) {
  const start = gates[0].angle;
  const angle = start + ((((a - start) % tau) + tau) % tau);
  for (const [i, g] of gates.entries()) {
    const next = gates[(i + 1) % gates.length];
    const end = next.angle + (i === gates.length - 1 ? tau : 0);
    if (angle <= end) return { g, next, angle, end };
  }
  throw new Error('Could not resolve the Sanchi paving sector');
}
function grade(a, r) {
  if (r <= 19.84) return -0.13;
  const { g, next, angle, end } = sector(a);
  const t = (angle - g.angle) / (end - g.angle);
  return -0.13 + (g.grade + (next.grade - g.grade) * t + 0.13) * Math.min(1, (r - 19.84) / 4.2);
}

function courtyard(out, detail) {
  const count = detail === 0 ? 12 : detail === 1 ? 36 : 64;
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      b = ((i + 1) * tau) / count;
    const A = (r, t) => point(r, t, grade(t, r));
    quad4(out, 'paving', A(18.58, b), A(25.4, b), A(25.4, a), A(18.58, a), floor);
    quad4(
      out,
      'paving',
      point(25.4, a, -2.32),
      A(25.4, a),
      A(25.4, b),
      point(25.4, b, -2.32),
      dark,
    );
  }
}

function stoneDome(out, detail) {
  const n = [14, 24, 46, 72][detail];
  const rows = [5, 7, 14, 22][detail];
  ring(
    out,
    'ashlar',
    center,
    [
      [-1.22, 19.74],
      [0.31, 19.75],
      [0.45, 19.84],
      [3.37, 19.83],
      [3.51, 19.77],
      [dome.base, 18.29],
    ],
    n,
    dark,
    { capTop: false },
  );
  const sections = Array.from({ length: rows + 1 }, (_, i) => {
    const angle = (Math.PI * i) / (2 * rows);
    return [
      dome.base + (dome.height - dome.base) * Math.sin(angle),
      i === rows ? 0 : dome.radius * Math.pow(Math.cos(angle), 0.86),
    ];
  });
  for (let j = 0; j < rows; j++) {
    const [y, r] = sections[j],
      [Y, R] = sections[j + 1];
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n;
      const axis = (a + b) / 2;
      const weathered =
        Math.sin(axis * 3.0 + y * 0.25) * 0.53 + Math.cos(axis * 5.0 - y * 0.47) * 0.29;
      const weathering = Math.max(0, weathered - 0.28);
      const tone = Math.sin(i * 2.6 + j * 6.2) * 0.009;
      const color = repair.map((v, k) => v + (dark[k] - v) * weathering + tone);
      const A = point(r, a, y),
        B = point(r, b, y);
      if (R === 0) tri(out, 'rubble', A, point(0, a, Y), B, color);
      else {
        const ySlope = Y - y;
        const normal = normalize([ySlope * Math.cos(axis), r - R, ySlope * Math.sin(axis)]);
        const u = a * dome.radius,
          U = b * dome.radius;
        out.addQuad(
          'rubble',
          'metric:uv',
          [A, point(R, a, Y), point(R, b, Y), B],
          normal,
          [
            [u, y],
            [u, Y],
            [U, Y],
            [U, y],
          ],
          color,
        );
      }
    }
  }
}

function upperCrown(out, detail) {
  const y = dome.height - 0.43;
  const a = 0.19,
    c = Math.cos(a),
    s = Math.sin(a);
  const P = (u, z) => [center[0] + u * c - z * s, center[1] + u * s + z * c];
  const plan = [P(-2.14, -2.14), P(2.14, -2.14), P(2.14, 2.14), P(-2.14, 2.14)];
  flatCap(out, 'rail', plan, y + 0.1, pale);
  const sides = [...plan, plan[0]];
  for (let i = 0; i < 4; i++) {
    const f = wallFace(sides[i + 1], sides[i]);
    if (detail === 0) {
      fbox(out, 'rail', f, 0, f.length, y + 0.25, y + 1.17, -0.22, 0.02, pale);
      continue;
    }
    fbox(out, 'rail', f, -0.08, f.length + 0.08, y - 0.15, y + 0.14, -0.29, 0.08, pale);
    fbox(out, 'rail', f, -0.07, f.length + 0.07, y + 1.01, y + 1.24, -0.31, 0.07, pale);
    const posts = detail === 1 ? 3 : 8;
    for (let j = 0; j <= posts; j++) {
      const u = (f.length * j) / posts;
      fbox(out, 'rail', f, u - 0.071, u + 0.071, y + 0.11, y + 1.03, -0.238, 0, sand);
    }
  }
  const h = dome.height;
  ring(
    out,
    'carved',
    center,
    [
      [h + 0.01, 0.2],
      [h + 3.51, 0.13],
      [h + 3.68, 0.04],
    ],
    detail < 2 ? 8 : 16,
    sand,
  );
  const heights = [
    [h + 1.37, 1.03],
    [h + 2.23, 0.79],
    [h + 2.99, 0.59],
  ];
  for (const [Y, r] of heights) {
    ring(
      out,
      'carved',
      center,
      [
        [Y - 0.105, r * 0.54],
        [Y, r],
        [Y + 0.13, r * 0.93],
        [Y + 0.235, r * 0.58],
        [Y + 0.278, 0.17],
      ],
      detail === 0 ? 5 : detail === 1 ? 10 : 28,
      pale,
    );
  }
}

function vedika(out, outer, detail) {
  const y = outer ? 0 : dome.base;
  const { intervals, gap } = outer
    ? { intervals: gates, gap: 2.08 }
    : { intervals: [south], gap: 1.97 };
  for (const [i, g] of intervals.entries()) {
    const next = intervals[(i + 1) % intervals.length];
    const r1 = outer ? g.radius : terraceRadius - 0.28,
      r2 = outer ? next.radius : terraceRadius - 0.28;
    const a = g.angle + gap / r1;
    const b = next.angle + (i === intervals.length - 1 ? tau : 0) - gap / r2;
    const width = (a, b) => [((b - a) * (r1 + r2)) / 2, outer ? 1.08 : 0.86];
    const [meters, module] = width(a, b);
    const count = Math.max(2, Math.round(meters / (module * [11.6, 6.2, 1.98, 0.95][detail])));
    const post = (j) => {
      const t = j / count,
        theta = a + (b - a) * t,
        r = r1 + (r2 - r1) * t;
      return { q: radial(r, theta), y: outer ? grade(theta, r) : y };
    };
    for (let j = 0; j <= count; j++) {
      const { q, y: g0 } = post(j);
      const theta = a + ((b - a) * j) / count;
      const f = facade(q, [Math.sin(theta), -Math.cos(theta)]);
      const thick = outer ? 0.229 : 0.115;
      const h = outer ? 1.64 : 1.04;
      if (detail > 0) {
        fbox(out, 'rail', f, -thick, thick, g0 - 0.15, g0 + h, -thick, 0.98 * thick, sand);
      }
      if (j === count) continue;
      const w = post(j + 1);
      const f2 = wallFace(w.q, q);
      const u = f2.length;
      const Y = h + (outer ? 0.18 : 0.12);
      const B = (x, z, d) => f2.P(x, z + (x === 0 ? w.y : g0), d);
      const band = (low, high, w) => {
        const p = (v, z) => B(v, z, w),
          q = (v, z) => B(v, z, -w);
        quad4(out, 'rail', p(0, low), p(u, low), p(u, high), p(0, high), pale);
        quad4(out, 'rail', q(u, low), q(0, low), q(0, high), q(u, high), sand);
        quad4(out, 'rail', q(0, high), p(0, high), p(u, high), q(u, high), pale);
      };
      if (detail === 0) {
        band(0.31, Y, outer ? 0.215 : 0.14);
      } else {
        band(h - 0.11, Y, outer ? 0.232 : 0.143);
        const rails =
          detail === 1 ? [h * 0.28, h * 0.61] : outer ? [0.16, 0.62, 1.07] : [0.17, 0.45, 0.72];
        for (const base of rails) {
          const h = outer ? 0.292 : 0.149;
          const radius = outer ? 0.171 : 0.091;
          band(base, base + h, radius);
          if (detail > 2) band(base + 0.043, base + h - 0.039, radius + 0.039);
        }
      }
    }
  }
}

function stairs(out, detail) {
  const { center: c, along, grade } = south;
  const f = facade(c, along);
  const count = detail === 0 ? 5 : detail === 1 ? 9 : 16;
  const front = -1.8,
    back = -5.46;
  for (const [u, U] of [
    [-1.64, -0.095],
    [0.095, 1.64],
  ]) {
    for (let i = 0; i < count; i++) {
      const d = front + ((back - front) * i) / count,
        D = front + ((back - front) * (i + 1)) / count;
      const y = grade + ((dome.base - grade) * (i + 1)) / count;
      fbox(out, 'ashlar', f, u, U, -0.17, y, D, d, silvery);
      if (detail > 2)
        fbox(out, 'rail', f, u + 0.03, U - 0.03, y - 0.08, y - 0.018, d - 0.092, d + 0.063, pale);
    }
  }
  for (const u of [-1.88, 0, 1.88]) {
    const a = f.P(u - 0.145, grade + 0.12, front),
      b = f.P(u + 0.145, grade + 0.12, front);
    const c = f.P(u + 0.145, dome.base, back),
      d = f.P(u - 0.145, dome.base, back);
    const top = ([x, y, z]) => [x, y + 0.68, z];
    quad4(out, 'rail', a, d, top(d), top(a), pale);
    quad4(out, 'rail', c, b, top(b), top(c), pale);
    quad4(out, 'rail', top(a), top(d), top(c), top(b), pale);
  }
}

function flower(out, f, u, y, width, d, petals) {
  const center = f.P(u, y, d + 0.028);
  for (let i = 0; i < petals; i++) {
    const a = (i * tau) / petals,
      b = ((i + 1) * tau) / petals,
      m = (a + b) / 2;
    const p = (r, t) => f.P(u + r * Math.cos(t), y + r * Math.sin(t), d);
    tri(out, 'carved', center, p(width * 0.61, a), p(width, m), sand);
    tri(out, 'carved', center, p(width, m), p(width * 0.61, b), pale);
  }
}

function pierCapital(out, f, u, y, detail) {
  if (detail === 1) {
    fbox(out, 'carved', f, u - 0.48, u + 0.48, y - 0.05, y + 0.34, -0.33, 0.36, pale);
    return;
  }
  const c = xz(f.P(u, 0, 0.015));
  ring(
    out,
    'carved',
    c,
    [
      [y - 0.13, 0.27],
      [y, 0.45],
      [y + 0.17, 0.46],
      [y + 0.26, 0.31],
      [y + 0.36, 0.32],
    ],
    detail > 1 ? 12 : 6,
    pale,
  );
  if (detail < 2) return;
  for (const sign of [-1, 1]) {
    const dx = u + sign * 0.285;
    const center = xz(f.P(dx, 0, 0.26));
    lathe(
      out,
      'carved',
      center,
      [
        [y - 0.46, 0.08, 0.12],
        [y - 0.21, 0.088, 0.185],
        [y + 0.075, 0.185, 0.225],
        [y + 0.24, 0.225, 0.215],
        [y + 0.32, 0.146, 0.157],
        [y + 0.34, 0, 0],
      ],
      detail === 2 ? 5 : 10,
      pale,
    );
    fbox(
      out,
      'carved',
      f,
      dx - sign * 0.02 - 0.055,
      dx - sign * 0.02 + 0.055,
      y - 0.42,
      y + 0.036,
      0.31,
      0.557,
      pale,
    );
    flower(out, f, dx + sign * 0.119, y + 0.139, 0.162, 0.466, 6);
  }
}

function beam(out, f, y, length, detail) {
  const half = length / 2;
  const n = [0, 3, 6, 11][detail];
  const thickness = 0.474;
  const profile = (q) => y + 0.34 * Math.pow(Math.abs(q), 3) - 0.086 * (1 - q * q);
  const z = 0.292;
  for (let j = 0; j < n; j++) {
    const a = -1 + (j * 2) / n,
      b = -1 + ((j + 1) * 2) / n;
    const x = a * half,
      X = b * half,
      Y = profile(b),
      h = profile(a);
    const A = (u, y, d) => f.P(u, y, d);
    quad4(
      out,
      'carved',
      A(x, h, z),
      A(X, Y, z),
      A(X, Y + thickness, z),
      A(x, h + thickness, z),
      sand,
    );
    quad4(
      out,
      'carved',
      A(X, Y, -z),
      A(x, h, -z),
      A(x, h + thickness, -z),
      A(X, Y + thickness, -z),
      relief,
    );
    quad4(
      out,
      'carved',
      A(x, h + thickness, -z),
      A(x, h + thickness, z),
      A(X, Y + thickness, z),
      A(X, Y + thickness, -z),
      pale,
    );
    quad4(out, 'carved', A(X, Y, -z), A(X, Y, z), A(x, h, z), A(x, h, -z), relief);
    if (detail > 2) {
      const u = (x + X) / 2,
        y = (Y + h) / 2;
      fbox(out, 'carved', f, x + 0.03, X - 0.032, y + 0.051, y + 0.115, z - 0.011, z + 0.04, pale);
      fbox(out, 'carved', f, x + 0.032, X - 0.03, y + 0.347, y + 0.407, z - 0.011, z + 0.03, pale);
      flower(out, f, u, y + 0.226, 0.109, z + 0.049, 5);
    } else if (detail === 2) {
      flower(out, f, (x + X) / 2, (Y + h) / 2 + 0.25, 0.105, z + 0.036, 4);
    }
  }
  for (const s of [-1, 1]) {
    const u = s * half,
      Y = profile(1);
    fbox(out, 'carved', f, u - 0.075, u + 0.075, Y + 0.004, Y + 0.485, -0.295, 0.3, pale);
    if (detail > 1) {
      const c = xz(f.P(u, 0, 0.047));
      ring(
        out,
        'carved',
        c,
        [
          [Y - 0.06, 0.132],
          [Y + 0.012, 0.22],
          [Y + 0.22, 0.242],
          [Y + 0.43, 0.226],
          [Y + 0.5, 0.14],
        ],
        detail === 3 ? 16 : 8,
        pale,
      );
      if (detail > 2) flower(out, f, u, Y + 0.22, 0.176, 0.274, 7);
    }
  }
}

function gate(out, g, detail) {
  const { center: c, along, grade: y, height, pierSpan } = g;
  const f = facade(c, along);
  const h = height - 3.19;
  if (detail === 0) {
    for (const s of [-1, 1]) {
      const u = (s * pierSpan) / 2;
      fbox(out, 'carved', f, u - 0.42, u + 0.42, y - 0.06, y + h + 1.69, -0.35, 0.35, pale);
    }
    for (let k = 0; k < 3; k++) {
      const edge = 3.1 - k * 0.11,
        y0 = y + h + 0.54 + k * 0.86;
      fbox(out, 'carved', f, -edge, edge, y0, y0 + 0.47, -0.28, 0.28, sand);
    }
    return;
  }
  for (const s of [-1, 1]) {
    const u = (s * pierSpan) / 2;
    fbox(out, 'carved', f, u - 0.493, u + 0.493, y - 0.33, y + 0.267, -0.496, 0.49, sand);
    fbox(out, 'carved', f, u - 0.402, u + 0.402, y + 0.24, y + h, -0.372, 0.372, pale);
    fbox(out, 'carved', f, u - 0.478, u + 0.478, y + h - 0.16, y + h + 0.071, -0.47, 0.47, sand);
    if (detail > 0) pierCapital(out, f, u, y + h + 0.075, detail);
    if (detail > 1) {
      const count = detail > 2 ? 9 : 6;
      for (let i = 0; i < count; i++) {
        const v = y + 0.47 + (i * (h - 0.85)) / count;
        const w = (h - 0.85) / count;
        fbox(
          out,
          'carved',
          f,
          u - 0.304,
          u + 0.304,
          v,
          v + w * 0.84,
          0.355,
          0.418,
          i % 2 === 0 ? relief : sand,
        );
        flower(out, f, u, v + w * 0.43, 0.128, 0.428, 6);
        for (const z of detail === 3 ? [-0.333, 0.334] : [])
          fbox(
            out,
            'carved',
            f,
            u + z - 0.027,
            u + z + 0.027,
            v - 0.012,
            v + w * 0.86,
            0.378,
            0.443,
            sand,
          );
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    const base = y + h + 0.48 + k * 0.865;
    beam(out, f, base, 6.22 - k * 0.203, detail);
    if (k === 2) break;
    const struts =
      detail === 1 ? [-pierSpan / 2, pierSpan / 2] : [-pierSpan / 2, -0.44, 0.44, pierSpan / 2];
    for (const u of struts) {
      fbox(out, 'carved', f, u - 0.144, u + 0.144, base + 0.38, base + 0.9, -0.19, 0.22, pale);
    }
  }
  if (detail > 0) {
    const top = y + height - 0.42;
    const c = xz(f.P(0, 0, 0.035));
    ring(
      out,
      'carved',
      c,
      [
        [top - 0.41, 0.29],
        [top - 0.27, 0.242],
        [top - 0.15, 0.347],
        [top, 0.303],
        [top + 0.16, 0.07],
      ],
      detail > 1 ? 14 : 7,
      pale,
    );
    for (const s of detail === 1 ? [] : [-1, 1]) {
      const q = xz(f.P(s * 2.14, 0, 0.01));
      ring(
        out,
        'carved',
        q,
        [
          [top - 0.42, 0.16],
          [top - 0.32, 0.2],
          [top - 0.156, 0.157],
          [top + 0.041, 0.063],
        ],
        detail > 1 ? 12 : 7,
        sand,
      );
    }
  }
}

function build(out, detail) {
  courtyard(out, detail);
  stoneDome(out, detail);
  upperCrown(out, detail);
  vedika(out, true, detail);
  vedika(out, false, detail);
  stairs(out, detail);
  for (const g of gates) gate(out, g, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
