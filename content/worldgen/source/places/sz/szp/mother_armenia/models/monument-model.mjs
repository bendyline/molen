/** Ara Harutyunyan's Mother Armenia and Rafael Israelyan's Victory Park museum pedestal. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  cross,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const palette = {
  tuff: '746d60',
  darkTuff: '625c52',
  midTuff: '797064',
  paleTuff: '81776a',
  warmTuff: '78695b',
  stoneRim: '918679',
  stoneShade: '6f6558',
  joint: '5f594f',
  tread: '999083',
  treadDark: '7e776c',
  copper: '68756a',
  lightCopper: '778779',
  darkCopper: '53665c',
  edgeCopper: '819183',
  seamCopper: '626e64',
  bronze: '55594e',
  door: '50534c',
  reveal: '4b4740',
  gold: 'bda16c',
};
const rgb = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((pair) => {
      const c = parseInt(pair, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.78 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.83 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.68, metallic: 0.32 },
};
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const TAU = 2 * Math.PI,
  UP = [0, 1, 0],
  DOWN = [0, -1, 0],
  FRONT = [0, 0, 1];
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s),
  dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const mix = (a, b, t) => a + (b - a) * t;
const average = (ps) => ps[0].map((_, i) => ps.reduce((n, p) => n + p[i], 0) / ps.length);
const figurePoint = ([x, y, z]) => [x, y + layout.statueY, z];
const sides = [5, 8, 13, 20, 27];

function tri(out, slot, tint, points, direction) {
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.99) return;
  if (direction && dot(normal, direction) < 0) {
    points = points.toReversed();
    normal = scale(normal, -1);
  }
  out.addTriangle(slot, '', points, normal, undefined, rgb[tint]);
}
function quad(out, slot, tint, [a, b, c, d], direction) {
  tri(out, slot, tint, [a, b, c], direction);
  tri(out, slot, tint, [a, c, d], direction);
}
function cap(out, slot, tint, ring, height, wanted) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => [ring[k][0], height, ring[k][1]]),
      wanted,
    );
}
function prism(out, slot, tint, ring, low, high) {
  const signed = ring.reduce((n, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return n + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      n = scale([b[1] - a[1], 0, a[0] - b[0]], Math.sign(signed));
    quad(
      out,
      slot,
      tint,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ],
      n,
    );
  }
  cap(out, slot, tint, ring, high, UP);
  cap(out, slot, tint, ring, low, DOWN);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function box(out, slot, tint, x0, y0, z0, x1, y1, z1) {
  prism(out, slot, tint, rect(x0, z0, x1, z1), y0, y1);
}

function ribbonSkin(out, slot, tint, rings, capRings = true) {
  const N = rings[0].length;
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        e = rings[j][i];
      quad(out, slot, tint, [a, b, c, e]);
    }
  if (!capRings) return;
  for (const [r, reversed] of [
    [rings[0], true],
    [rings.at(-1), false],
  ]) {
    const c = average(r);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      tri(out, slot, tint, reversed ? [c, r[next], r[i]] : [c, r[i], r[next]]);
    }
  }
}
function subset(rows, d) {
  if (d >= 2) return rows;
  const n = rows.length;
  if (d === 1) return rows.filter((_, i) => i === n - 1 || i % 2 === 0);
  return rows.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n * 0.55));
}
function sculptLimb(out, rows, d, tint = 'copper', transform = figurePoint, fold = 0.04) {
  const rs = subset(rows, d),
    N = sides[d],
    centers = rs.map(([x, y, z]) => transform([x, y, z]));
  let previous;
  const rings = centers.map((center, i) => {
    const next = centers[Math.min(i + 1, centers.length - 1)],
      before = centers[Math.max(0, i - 1)];
    const axis = normalize(sub(next, before));
    let u;
    if (previous) {
      const projected = sub(previous, scale(axis, dot(previous, axis)));
      if (Math.hypot(...projected) > 0.1) u = normalize(projected);
    }
    u ??= normalize(cross(axis, Math.abs(axis[1]) > 0.91 ? [1, 0, 0] : UP));
    previous = u;
    const v = cross(axis, u),
      width = rs[i][3],
      depth = rs[i][4] ?? width;
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        k = 1 + fold * (0.75 * Math.sin(a * 3 + 0.79 * i) + 0.25 * Math.cos(a * 7 - 0.53 * i));
      return add(center, add(scale(u, width * k * Math.cos(a)), scale(v, depth * k * Math.sin(a))));
    });
  });
  ribbonSkin(out, 'copper', tint, rings);
}

function clipSide(ring, x, sign) {
  const result = [];
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      inA = (a[0] - x) * sign >= 0,
      inB = (b[0] - x) * sign >= 0;
    if (inA) result.push(a);
    if (inA !== inB) result.push([x, mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]))]);
  }
  return result;
}
function platform(out, d) {
  const { podium, approach } = layout;
  prism(out, 'base', 'darkTuff', podium, -4.7, 2.54);
  for (const [side, x] of [
    [-1, -9.48],
    [1, 5.67],
  ]) {
    const ring = clipSide(podium, x, side);
    prism(out, 'stone', 'tuff', ring, 2.53, 4.7);
    if (d >= 1) prism(out, 'stone', 'stoneRim', ring, 4.68, 4.94);
  }
  const group = [6, 3, 1, 1, 1][d];
  for (let i = 0; i < approach.count; i += group) {
    const start = i / approach.count,
      end = (i + group) / approach.count;
    const z0 = mix(approach.topZ, approach.endZ, start),
      z1 = mix(approach.topZ, approach.endZ, end);
    const y = mix(approach.top, approach.bottom, start),
      w = approach.halfWidth;
    box(
      out,
      'base',
      i % 4 === 0 ? 'tread' : 'treadDark',
      approach.x - w,
      -4.3,
      z0,
      approach.x + w,
      y,
      z1 + 0.008,
    );
    if (d >= 2)
      box(
        out,
        'base',
        'tread',
        approach.x - w - 0.024,
        y - 0.041,
        z1 - 0.09,
        approach.x + w + 0.024,
        y + 0.012,
        z1 + 0.022,
      );
  }
  if (d >= 1)
    for (const side of [-1, 1]) {
      const x = approach.x + side * (approach.halfWidth + 0.2);
      box(out, 'stone', 'tuff', x - 0.18, -3.6, 13.49, x + 0.18, 2.57, 17.44);
      box(out, 'stone', 'stoneRim', x - 0.21, 2.57, 13.47, x + 0.21, 2.69, 17.47);
    }
}
function plane(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    width = Math.hypot(dx, dz),
    u = [dx / width, 0, dz / width],
    n = [-u[2], 0, u[0]];
  return {
    width,
    n,
    point: (x, y, depth = 0) => [a[0] + u[0] * x + n[0] * depth, y, a[1] + u[2] * x + n[2] * depth],
  };
}
function face2d(out, slot, tint, outline, at, normal, depth = 0) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => at(...outline[k], depth)),
      normal,
    );
}
function archPoint(x, spring, r, a) {
  return [x + r * Math.cos(a), spring + r * Math.sin(a)];
}
function doorway(out, p, d) {
  const { at, n, x, sill, spring, inner, outer } = p;
  const N = [7, 11, 16, 22, 28][d];
  const arc = (r) =>
    Array.from({ length: N + 1 }, (_, i) => archPoint(x, spring, r, Math.PI * (1 - i / N)));
  const innerArc = arc(inner);
  const hole = [[x - inner, sill], ...innerArc, [x + inner, sill]];
  const depth = d === 0 ? -0.62 : -1.08;
  face2d(out, 'copper', 'door', hole, at, n, depth);
  for (let i = 0; i < hole.length - 1; i++) {
    const a = hole[i],
      b = hole[i + 1],
      m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const normal = normalize(sub(at(x, Math.min(m[1], spring) - 0.22), at(...m)));
    quad(out, 'stone', 'reveal', [at(...a), at(...b), at(...b, depth), at(...a, depth)], normal);
  }
  quad(
    out,
    'base',
    'tread',
    [
      at(x - inner, sill, depth),
      at(x + inner, sill, depth),
      at(x + inner, sill, 0.31),
      at(x - inner, sill, 0.31),
    ],
    UP,
  );
  const rings = d === 0 ? 1 : d === 1 ? 2 : 3;
  for (let ring = 0; ring < rings; ring++) {
    const r0 = mix(inner, outer, ring / rings) + 0.018,
      r1 = mix(inner, outer, (ring + 1) / rings) - 0.018;
    const far = 0.095 + 0.12 * ring,
      shade = ring % 2 ? 'stoneRim' : 'midTuff';
    for (const sign of [-1, 1]) {
      const u = x + sign * r0,
        v = x + sign * r1;
      quad(
        out,
        'stone',
        shade,
        [at(u, sill, far), at(v, sill, far), at(v, spring, far), at(u, spring, far)],
        n,
      );
      quad(
        out,
        'stone',
        'darkTuff',
        [at(u, sill, 0), at(u, sill, far), at(u, spring, far), at(u, spring, 0)],
        scale(sub(at(x, 0), at(u, 0)), 0.99),
      );
    }
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * i) / N + 0.009,
        b = (Math.PI * (i + 1)) / N - 0.009;
      const points = [
        archPoint(x, spring, r0, a),
        archPoint(x, spring, r1, a),
        archPoint(x, spring, r1, b),
        archPoint(x, spring, r0, b),
      ];
      quad(
        out,
        'stone',
        i % 3 === 1 ? 'paleTuff' : shade,
        points.map((p) => at(...p, far)),
        n,
      );
      if (d >= 2) {
        const [l, r] = [points[0], points[3]];
        const down = normalize(sub(at(x, spring), at(...archPoint(x, spring, r0, (a + b) / 2))));
        quad(out, 'stone', 'darkTuff', [at(...l), at(...l, far), at(...r, far), at(...r)], down);
      }
    }
  }
  if (d >= 2) {
    for (const u of [-0.64, 0, 0.64]) {
      beam(
        out,
        'copper',
        at(x + u, sill + 0.09, depth + 0.04),
        at(x + u, spring - 0.07, depth + 0.04),
        0.05,
        0.05,
        rgb.bronze,
      );
    }
    beam(
      out,
      'copper',
      at(x - inner + 0.04, spring - 0.07, depth + 0.04),
      at(x + inner - 0.04, spring - 0.07, depth + 0.04),
      0.073,
      0.055,
      rgb.edgeCopper,
    );
    const arcBand = arc(inner - 0.13).map((v) => at(...v, depth + 0.055));
    tubePath(out, 'copper', arcBand, 0.027, rgb.bronze, 5);
  }
  if (d >= 3) {
    for (let i = 1; i < N; i += 2) {
      const a = (Math.PI * i) / N,
        r = (outer + inner) * 0.5 + 0.13,
        [u, y] = archPoint(x, spring, r, a),
        c = at(u, y, 0.37);
      for (let j = 0; j < 5; j++) {
        const w = (j * TAU) / 5,
          t = at(u + 0.091 * Math.cos(w), y + 0.091 * Math.sin(w), 0.397);
        const e = at(u + 0.144 * Math.cos(w + 0.29), y + 0.144 * Math.sin(w + 0.29), 0.372);
        tri(out, 'stone', 'stoneRim', [c, t, e], n);
      }
    }
  }
  return hole;
}
function wallPanels(out, side, y0, y1, d, portal) {
  if (d === 0) return;
  const { point: at, width, n } = side;
  const rows = Math.ceil((y1 - y0) / (d === 1 ? 2.31 : 1.05)),
    columns = Math.ceil(width / (d === 1 ? 2.22 : 1.51));
  const tones = ['midTuff', 'tuff', 'darkTuff', 'warmTuff', 'tuff', 'paleTuff', 'midTuff', 'tuff'];
  for (let j = 0; j < rows; j++) {
    const low = mix(y0, y1, j / rows) + 0.012,
      high = mix(y0, y1, (j + 1) / rows) - 0.01;
    for (let i = 0; i < columns; i++) {
      const stagger = j % 2 ? 0.38 : 0,
        from = i === 0 ? 0 : ((i + stagger) / columns) * width,
        to = i === columns - 1 ? width : ((i + 1 + stagger) / columns) * width;
      const l = from + 0.012,
        r = to - 0.012;
      if (
        portal &&
        low < portal.spring + portal.outer + 0.14 &&
        high > portal.sill &&
        r > portal.x - portal.outer - 0.04 &&
        l < portal.x + portal.outer + 0.04
      )
        continue;
      const tone = tones[(i * 11 + j * 3 + ((i * j) % 11)) % tones.length],
        depth = 0.015 + 0.014 * Math.abs(Math.sin(4.13 * i + 2.22 * j));
      quad(
        out,
        'stone',
        tone,
        [at(l, low, depth), at(r, low, depth), at(r, high, depth), at(l, high, depth)],
        n,
      );
    }
  }
}
function wingWall(out, a, b, y0, y1, d, door) {
  const side = plane(a, b),
    { width, n, point: at } = side;
  const cut = door ? doorway(out, { ...door, at, n }, d) : [];
  const wall = door
    ? [
        [0, y0],
        [door.x - door.inner, y0],
        ...cut,
        [door.x + door.inner, y0],
        [width, y0],
        [width, y1],
        [0, y1],
      ]
    : [
        [0, y0],
        [width, y0],
        [width, y1],
        [0, y1],
      ];
  face2d(out, 'stone', d === 0 ? 'tuff' : 'joint', wall, at, n);
  wallPanels(out, side, y0, y1, d, door);
  return side;
}
function slit(out, at, n, x, y) {
  const w = 0.34,
    h = 1.42;
  const outline = [
    [x - w, y],
    [x + w, y],
    [x + w, y + h],
    [x + 0.22, y + h + 0.21],
    [x - 0.22, y + h + 0.21],
    [x - w, y + h],
  ];
  face2d(out, 'stone', 'reveal', outline, at, n, 0.045);
  quad(
    out,
    'stone',
    'stoneRim',
    [
      [x - 0.49, y - 0.1],
      [x + 0.49, y - 0.1],
      [x + 0.49, y + 0.02],
      [x - 0.49, y + 0.02],
    ].map((p) => at(...p, 0.119)),
    n,
  );
  for (const sign of [-1, 1])
    beam(
      out,
      'stone',
      at(x + sign * 0.38, y, 0.11),
      at(x + sign * 0.31, y + h + 0.13, 0.11),
      0.124,
      0.116,
      rgb.paleTuff,
    );
}
function centralCrown(out, d) {
  const ring = layout.tower.map(([x, z]) => [x, z > 0 ? z + 4.49 : z]);
  const enlarge = (w) => ring.map(([x, z]) => [x + Math.sign(x) * w, z + Math.sign(z) * w]);
  prism(out, 'stone', 'tuff', ring, 21.41, 25.72);
  prism(out, 'stone', 'stoneRim', enlarge(0.63), 25.54, 25.84);
  prism(out, 'stone', 'darkTuff', enlarge(0.76), 25.84, 26.15);
  prism(out, 'stone', 'paleTuff', enlarge(1.02), 26.14, 26.48);
  prism(out, 'stone', 'stoneRim', enlarge(0.81), 26.48, 26.72);
  box(out, 'stone', 'tuff', -5.55, 26.72, -4.75, 5.34, 28.19, 4.68);
  box(out, 'stone', 'stoneRim', -5.72, 28.15, -4.91, 5.49, 28.42, 4.86);
  box(out, 'stone', 'darkTuff', -4.75, 28.42, -3.81, 4.52, 28.78, 3.97);
  box(out, 'stone', 'paleTuff', -4.96, 28.78, -3.96, 4.68, 29, 4.17);
  if (d === 0) return;
  const outline = enlarge(0.67);
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.round(L / (d === 1 ? 0.95 : 0.64));
    for (let k = 1; k < count; k++) {
      const t = k / count,
        [x, z] = a.map((v, j) => mix(v, b[j], t));
      box(
        out,
        'stone',
        k % 3 === 0 ? 'paleTuff' : 'midTuff',
        x - 0.17,
        25.52,
        z - 0.2,
        x + 0.17,
        26.02,
        z + 0.2,
      );
    }
  }
  if (d >= 2) {
    const points = [
      [-5.26, 28.68, -4.49],
      [5.12, 28.68, -4.49],
      [5.12, 28.68, 4.44],
      [-5.26, 28.68, 4.44],
      [-5.26, 28.68, -4.49],
    ];
    tubePath(out, 'copper', points, 0.042, rgb.bronze, 5);
    for (const x of [-5.26, 5.12])
      for (const z of [-4.49, -2.27, 0, 2.22, 4.44]) {
        beam(out, 'copper', [x, 28.22, z], [x, 28.68, z], 0.055, 0.055, rgb.bronze);
      }
  }
}
function highRelief(out, d) {
  if (d < 2) return;
  const x = -0.57,
    y = 22.13,
    z = 10.975;
  const at = (a, b, c = 0) => [x + a, y + b, z + c];
  for (const sign of [-1, 1]) {
    const path = Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 13;
      return at(sign * (0.06 + 0.88 * Math.sin(a)), -0.97 * Math.cos(a), 0.098);
    });
    tubePath(out, 'stone', path, 0.083, rgb.paleTuff, 5);
    for (let i = 2; i < 11; i++) {
      const [a, b, c] = path[i],
        p = [a + sign * 0.26, b + 0.13, c + 0.09],
        q = [a + sign * 0.1, b + 0.33, c + 0.05];
      tri(out, 'stone', 'stoneRim', [[a, b, c], p, q], FRONT);
    }
  }
  const p = [
    at(0, -0.65, 0.12),
    at(-0.54, -0.18, 0.1),
    at(-0.58, 0.55, 0.09),
    at(0.03, 0.74, 0.17),
    at(0.58, 0.51, 0.09),
    at(0.49, -0.15, 0.1),
  ];
  for (let i = 0; i < p.length; i++)
    tri(out, 'stone', 'paleTuff', [at(0, 0.05, 0.28), p[i], p[(i + 1) % p.length]], FRONT);
}
function museum(out, d) {
  platform(out, d);
  const r = layout.wings,
    low = 2.54,
    high = 21.82,
    p = layout.portal;
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      A = b,
      B = a,
      side = plane(A, B);
    if (i === 3) {
      // The projecting central bay continues down to the recessed portal.
      const x0 = -6.66,
        x1 = 5.84,
        z = p.z;
      const frontZ = (x) => mix(A[1], B[1], (x - A[0]) / (B[0] - A[0]));
      const west = [x0, frontZ(x0)],
        east = [x1, frontZ(x1)],
        frontA = [x0, z],
        frontB = [x1, z];
      const left = wingWall(out, A, west, low, high, d, null);
      const right = wingWall(out, east, B, low, high, d, null);
      wingWall(out, west, frontA, low, high, d, null);
      wingWall(out, frontB, east, low, high, d, null);
      const middle = wingWall(out, frontA, frontB, low, 25.58, d, {
        x: p.x - x0,
        sill: p.sill,
        spring: p.sill + p.spring,
        inner: p.inner,
        outer: p.outer,
      });
      box(out, 'stone', 'tuff', x0, high, 3.55, x1, 25.58, z - 0.004);
      if (d >= 2)
        for (const [wall, fraction] of [
          [left, 0.53],
          [middle, 0.44],
          [right, 0.48],
        ]) {
          slit(out, wall.point, wall.n, wall.width * fraction, 8.45);
        }
      continue;
    }
    const portal =
      i === 0 || i === 2
        ? { x: side.width * 0.45, sill: 4.96, spring: 6.7, inner: 0.96, outer: 1.39 }
        : null;
    const built = wingWall(out, A, B, low, high, d, portal);
    if (d >= 2) for (const x of [4.8, built.width - 4.77]) slit(out, built.point, built.n, x, 9.65);
  }
  cap(out, 'stone', 'darkTuff', r, high, UP);
  cap(out, 'stone', 'darkTuff', r, low, DOWN);
  box(out, 'stone', 'darkTuff', -6.84, 4.98, 10.47, -6.58, 22.02, p.z + 0.08);
  box(out, 'stone', 'darkTuff', 5.76, 4.98, 10.61, 6.03, 22.02, p.z + 0.09);
  for (const side of [-1, 1]) {
    const x = side === 1 ? 12.65 : -12.2;
    box(out, 'stone', 'stoneRim', x - 0.21, 21.74, -12.83, x + 0.23, 22.04, 10.55);
    if (d >= 1) {
      for (const z of [-10.1, 8.99])
        box(out, 'stone', 'midTuff', x - 0.17, 5.02, z - 0.24, x + 0.18, 21.8, z + 0.24);
      const x2 = side === 1 ? 8.86 : -9.24;
      box(out, 'stone', 'darkTuff', x2 - 0.14, 5.04, 10.04, x2 + 0.15, 21.69, 10.76);
    }
  }
  centralCrown(out, d);
  highRelief(out, d);
}

const robeRows = [
  [0.03, -0.04, -0.14, 1.54, 1.42],
  [0.46, -0.05, -0.15, 1.63, 1.44],
  [1.18, -0.06, -0.17, 1.69, 1.4],
  [2.59, -0.08, -0.18, 1.75, 1.37],
  [4.08, -0.1, -0.17, 1.79, 1.37],
  [5.79, -0.09, -0.16, 1.84, 1.38],
  [7.24, -0.09, -0.15, 1.87, 1.4],
  [8.58, -0.08, -0.15, 1.94, 1.42],
  [9.87, -0.06, -0.17, 2.01, 1.48],
  [11.18, -0.05, -0.17, 2.03, 1.51],
  [11.89, -0.05, -0.13, 1.95, 1.49],
  [12.58, -0.03, -0.13, 1.83, 1.42],
];
const trunkRows = [
  [11.44, -0.03, -0.1, 1.84, 1.45],
  [12.24, -0.01, -0.1, 1.72, 1.37],
  [13.02, 0.0, -0.11, 1.61, 1.35],
  [13.76, 0.02, -0.12, 1.65, 1.34],
  [14.53, 0.03, -0.11, 1.83, 1.39],
  [15.37, 0.04, -0.06, 2.09, 1.47],
  [16.19, 0.07, 0.01, 2.26, 1.49],
  [16.91, 0.07, 0.09, 2.47, 1.42],
  [17.42, 0.08, 0.12, 2.25, 1.3],
  [17.84, 0.1, 0.14, 1.9, 1.16],
  [18.31, 0.09, 0.16, 1.33, 0.94],
  [18.85, 0.07, 0.17, 0.78, 0.72],
  [19.3, 0.07, 0.22, 0.74, 0.71],
];
function clothedForm(out, rows, d, skirt) {
  const N = skirt ? [10, 14, 22, 33, 46][d] : sides[d];
  const rs =
    d === 0 ? rows.filter((_, i) => i % 4 === 0 || i === rows.length - 1) : subset(rows, d);
  const rings = rs.map(([y, x, z, w, h], i) =>
    Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        s = Math.sin(a),
        c = Math.cos(a);
      const fluting = skirt
        ? 0.106 * Math.sin(a * 9 - 0.32) + 0.052 * Math.cos(a * 14 + y * 0.086)
        : 0.071 * Math.cos(a * 5 + y * 0.46) + 0.037 * Math.sin(a * 8 - y * 0.37);
      const breast = skirt
        ? 0
        : Math.max(0, c) *
          Math.abs(Math.sin(a * 2)) *
          0.28 *
          Math.sin(Math.PI * Math.max(0, Math.min(1, (y - 14) / 4)));
      return figurePoint([
        x + w * s * (1 + fluting),
        y + Math.min(0.18, y * 0.11) * Math.sin(3 * a + i * 0.14),
        z + h * c * (1 + fluting) + breast,
      ]);
    }),
  );
  ribbonSkin(out, 'copper', 'copper', rings);
  if (skirt && d >= 2)
    for (const phi of [-1.18, -0.73, -0.34, 0.15, 0.57, 0.98, 1.31]) {
      const pts = rs.slice(1, -1).map(([y, x, z, w, h]) => {
        const s = Math.sin(phi),
          c = Math.cos(phi),
          f = 1 + 0.106 * Math.sin(phi * 9 - 0.32) + 0.052 * Math.cos(phi * 14 + y * 0.086);
        return figurePoint([x + w * s * f, y, z + h * c * f + 0.01]);
      });
      tubePath(
        out,
        'copper',
        pts,
        0.056,
        rgb[phi < 0 ? 'lightCopper' : 'seamCopper'],
        d >= 3 ? 6 : 4,
      );
    }
}
const hiltArm = [
  [-1.9, 17.1, 0.12, 0.86, 0.85],
  [-2.55, 17.12, 0.22, 0.81, 0.79],
  [-3.13, 16.95, 0.36, 0.74, 0.73],
  [-3.41, 16.42, 0.54, 0.68, 0.67],
  [-3.37, 15.42, 0.84, 0.61, 0.61],
  [-3.19, 14.45, 1.11, 0.51, 0.55],
  [-3.21, 13.28, 1.51, 0.4, 0.44],
  [-3.33, 12.65, 1.72, 0.4, 0.42],
  [-3.45, 12.26, 1.82, 0.46, 0.39],
];
const bladeArm = [
  [1.99, 16.94, 0.11, 0.82, 0.79],
  [2.46, 16.55, 0.22, 0.75, 0.72],
  [2.74, 15.85, 0.28, 0.62, 0.67],
  [2.89, 15.05, 0.32, 0.55, 0.58],
  [2.87, 14.26, 0.6, 0.49, 0.5],
  [2.91, 13.61, 0.92, 0.45, 0.43],
  [3.02, 12.86, 1.36, 0.39, 0.41],
  [3.23, 12.01, 1.92, 0.47, 0.38],
];
function arms(out, d) {
  sculptLimb(out, hiltArm, d);
  sculptLimb(out, bladeArm, d);
  if (d === 0) return;
  const sleeves = [
    [
      [-1.81, 17.02, 0.12, 0.92, 0.92],
      [-2.56, 17.0, 0.25, 0.91, 0.85],
      [-3.27, 16.84, 0.4, 0.78, 0.76],
      [-3.43, 16.22, 0.57, 0.66, 0.65],
    ],
    [
      [1.92, 17.03, 0.12, 0.87, 0.85],
      [2.46, 16.52, 0.22, 0.78, 0.77],
      [2.79, 15.69, 0.29, 0.64, 0.62],
    ],
  ];
  for (const arm of sleeves) sculptLimb(out, arm, d, 'lightCopper', figurePoint, 0.055);
  if (d < 2) return;
  for (const [x, y, z] of [
    [-3.45, 12.31, 1.81],
    [3.22, 12.0, 1.94],
  ]) {
    for (let i = 0; i < 4; i++) {
      const a = x + (i - 1.5) * 0.183;
      sculptLimb(
        out,
        [
          [a, y - 0.25, z - 0.27, 0.129],
          [a + 0.04, y - 0.22, z + 0.29, 0.127],
          [a + 0.07, y + 0.06, z + 0.49, 0.101],
          [a + 0.08, y + 0.24, z + 0.4, 0.087],
        ],
        1,
        'lightCopper',
      );
    }
    sculptLimb(
      out,
      [
        [x - 0.33, y - 0.19, z + 0.01, 0.165],
        [x - 0.51, y + 0.04, z + 0.18, 0.139],
        [x - 0.38, y + 0.3, z + 0.19, 0.108],
      ],
      2,
      'copper',
    );
  }
}
function head(out, d) {
  const yaw = 0.11,
    co = Math.cos(yaw),
    si = Math.sin(yaw);
  const at = ([x, y, z]) => figurePoint([0.1 + x * co + z * si, 20.18 + y, 0.19 + z * co - x * si]);
  const rows = [
    [-1.34, 0.0, 0.1, 0.49, 0.48],
    [-1.1, 0.0, 0.18, 0.58, 0.53],
    [-0.86, 0.02, 0.18, 0.66, 0.58],
    [-0.58, 0.02, 0.1, 0.73, 0.66],
    [-0.27, 0.02, 0.02, 0.78, 0.7],
    [0.02, 0.01, -0.03, 0.8, 0.73],
    [0.36, 0.01, -0.08, 0.79, 0.71],
    [0.68, -0.01, -0.1, 0.76, 0.66],
    [1.03, -0.04, -0.13, 0.65, 0.59],
    [1.36, -0.04, -0.16, 0.51, 0.47],
    [1.66, -0.04, -0.19, 0.31, 0.31],
    [1.82, -0.04, -0.2, 0.09, 0.11],
  ];
  const N = sides[d],
    rs = d === 0 ? rows.filter((_, i) => [0, 3, 6, 9, 11].includes(i)) : subset(rows, d);
  const rings = rs.map(([y, x, z, w, h]) =>
    Array.from({ length: N }, (_, i) => {
      const a = (i * TAU) / N;
      return at([x + w * Math.sin(a), y, z + h * Math.cos(a)]);
    }),
  );
  ribbonSkin(out, 'copper', 'copper', rings);
  const hair = [
    [-1.05, 0.12, -0.51, 0.57, 0.34],
    [-0.7, 0.12, -0.53, 0.66, 0.39],
    [-0.25, 0.11, -0.47, 0.75, 0.42],
    [0.18, 0.1, -0.42, 0.78, 0.47],
    [0.6, 0.06, -0.34, 0.77, 0.51],
    [1.09, 0.0, -0.26, 0.68, 0.51],
    [1.46, -0.03, -0.23, 0.48, 0.42],
    [1.75, -0.05, -0.21, 0.21, 0.24],
  ];
  const hairRings = subset(hair, d).map(([y, x, z, w, h]) =>
    Array.from({ length: N }, (_, i) => {
      const a = (i * TAU) / N,
        v = 1 + 0.033 * Math.cos(7 * a + y);
      return at([x + w * v * Math.sin(a), y, z + h * v * Math.cos(a)]);
    }),
  );
  ribbonSkin(out, 'copper', 'darkCopper', hairRings);
  if (d === 0) return;
  const tip = at([0.015, -0.31, 0.99]),
    root = at([0.01, 0.41, 0.662]),
    a = at([-0.159, -0.43, 0.663]),
    b = at([0.175, -0.42, 0.674]),
    lower = at([0.02, -0.57, 0.729]);
  for (const p of [
    [a, root, tip],
    [root, b, tip],
    [b, lower, tip],
    [lower, a, tip],
  ])
    tri(out, 'copper', 'lightCopper', p, FRONT);
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    sculptLimb(
      out,
      [
        [sign * 0.13, 0.22, 0.692, 0.077],
        [sign * 0.34, 0.29, 0.699, 0.09],
        [sign * 0.57, 0.16, 0.532, 0.057],
      ],
      2,
      'seamCopper',
      at,
    );
    sculptLimb(
      out,
      [
        [sign * 0.17, 0.07, 0.72, 0.034],
        [sign * 0.31, 0.093, 0.728, 0.038],
        [sign * 0.51, 0.032, 0.591, 0.027],
      ],
      2,
      'darkCopper',
      at,
    );
    sculptLimb(
      out,
      [
        [sign * 0.23, -0.73, 0.644, 0.033],
        [sign * 0.1, -0.697, 0.734, 0.04],
        [0, -0.69, 0.76, 0.035],
      ],
      2,
      'darkCopper',
      at,
    );
    sculptLimb(
      out,
      [
        [sign * 0.74, -0.12, -0.05, 0.112],
        [sign * 0.81, -0.26, 0.014, 0.131],
        [sign * 0.74, -0.64, 0.02, 0.071],
      ],
      2,
      'copper',
      at,
    );
  }
  sphere(
    out,
    'copper',
    at([0.008, 0.63, 0.627]),
    [0.123, 0.129, 0.053],
    rgb.gold,
    d >= 3 ? 10 : 7,
    d >= 3 ? 7 : 4,
  );
  const k = d === 2 ? 7 : d === 3 ? 12 : 17;
  for (let i = 0; i < k; i++) {
    const a = ((i + 0.3) * Math.PI) / k,
      x = 0.72 * Math.cos(a);
    const path = [
      [x, 1.19 + 0.23 * Math.sin(a), 0.4 * Math.sin(a)],
      [x * 0.92, 1.45, -0.31],
      [x * 0.98 + 0.05, 1.02, -0.65],
      [x * 0.96 + 0.09, 0.24, -0.88],
      [x * 0.68 + 0.12, -0.63, -0.86],
    ];
    tubePath(
      out,
      'copper',
      path.map(at),
      0.043,
      rgb[i % 3 === 0 ? 'seamCopper' : 'darkCopper'],
      d >= 3 ? 6 : 4,
    );
  }
}
function sword(out, d) {
  const { pommel, guard, tip } = layout.sword;
  const direction = normalize(sub(tip, pommel)),
    width = normalize(cross([0, 0, 1], direction)),
    normal = cross(direction, width);
  const length = Math.hypot(...sub(tip, pommel)),
    axis = (x, y, z = 0) =>
      figurePoint(add(pommel, add(scale(direction, x), add(scale(width, y), scale(normal, z)))));
  const crossSections = [
    [0, 0.29, 0.23],
    [0.19, 0.36, 0.25],
    [1.62, 0.26, 0.23],
    [1.79, 0.42, 0.32],
    [2.17, 0.5, 0.34],
    [3.33, 0.49, 0.35],
    [8.95, 0.43, 0.29],
    [10.44, 0.38, 0.27],
    [10.81, 0.19, 0.22],
    [length, 0.1, 0.15],
  ];
  const N = d === 0 ? 4 : 8,
    steps = d === 0 ? crossSections.filter((_, i) => [0, 3, 4, 7, 9].includes(i)) : crossSections;
  const rings = steps.map(([t, w, h]) =>
    Array.from({ length: N }, (_, i) => {
      const a = (i * TAU) / N + Math.PI / 4;
      return axis(t, w * Math.cos(a), h * Math.sin(a));
    }),
  );
  ribbonSkin(out, 'copper', 'darkCopper', rings);
  const [x, y, z] = guard;
  beam(
    out,
    'copper',
    figurePoint([x, y - 0.74, z]),
    figurePoint([x - 0.005, y + 0.68, z]),
    0.35,
    0.59,
    rgb.lightCopper,
  );
  if (d >= 2) {
    const line = [
      axis(2.11, 0.365, 0.236),
      axis(3.39, 0.356, 0.251),
      axis(8.88, 0.295, 0.225),
      axis(10.52, 0.226, 0.207),
    ];
    tubePath(out, 'copper', line, 0.055, rgb.edgeCopper, d >= 3 ? 6 : 4);
    tubePath(
      out,
      'copper',
      line.map((p) => add(p, [0, -0.59, 0])),
      0.044,
      rgb.seamCopper,
      d >= 3 ? 6 : 4,
    );
    for (let i = 1; i < 7; i++) {
      const a = axis(0.16 + i * 0.2, -0.24, 0.178),
        b = axis(0.31 + i * 0.2, 0.24, 0.178);
      beam(out, 'copper', a, b, 0.045, 0.042, rgb.seamCopper);
    }
  }
}
function shield(out, d) {
  const { center, radius } = layout.shield,
    axis = [0, 0.035, 1];
  const n = [12, 20, 30, 44, 62][d];
  const at = (x, y, z) => figurePoint(add(center, [x, y - 0.034 * z, z + 0.034 * y]));
  const profiles = [
    [radius - 0.04, -0.13],
    [radius, 0.006],
    [radius - 0.08, 0.123],
    [radius - 0.26, 0.176],
    [0.46, 0.289],
    [0.14, 0.323],
  ];
  const rows = d === 0 ? profiles.filter((_, i) => [0, 1, 3, 5].includes(i)) : profiles;
  const rings = rows.map(([r, z]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * TAU) / n;
      return at(r * Math.cos(a), r * Math.sin(a), z);
    }),
  );
  ribbonSkin(out, 'copper', 'darkCopper', rings);
  if (d === 0) return;
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8 + Math.PI / 2,
      direction = [Math.cos(a), Math.sin(a)],
      w = i % 2 ? 0.148 : 0.176,
      l = i % 2 ? 1.11 : 1.4;
    const [x, y] = direction;
    const p = at(0, 0, 0.374),
      tip = at(x * l, y * l, 0.248),
      a0 = at(x * 0.27 - y * w, y * 0.27 + x * w, 0.295),
      a1 = at(x * 0.27 + y * w, y * 0.27 - x * w, 0.295);
    tri(out, 'copper', 'edgeCopper', [p, a0, tip], axis);
    tri(out, 'copper', 'copper', [p, tip, a1], axis);
  }
  if (d >= 2) {
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      sphere(
        out,
        'copper',
        at(1.65 * Math.cos(a), 1.65 * Math.sin(a), 0.192),
        [0.066, 0.066, 0.037],
        rgb.lightCopper,
        6,
        4,
      );
    }
    const ridge = rings[3];
    tubePath(out, 'copper', [...ridge, ridge[0]], 0.031, rgb.edgeCopper, 5);
  }
}
function feet(out, d) {
  for (const sign of [-1, 1]) {
    const x = sign * 0.62;
    sculptLimb(
      out,
      [
        [x, 0.28, -0.26, 0.58, 0.26],
        [x, 0.22, 0.38, 0.59, 0.22],
        [x, 0.21, 0.95, 0.56, 0.2],
        [x, 0.18, 1.22, 0.46, 0.16],
      ],
      d,
      'darkCopper',
    );
  }
}
export function buildMonument(out, level = 'master') {
  const d = tier[level];
  if (d === undefined) throw Error('Unknown Mother Armenia LOD ' + level);
  museum(out, d);
  clothedForm(out, robeRows, d, true);
  clothedForm(out, trunkRows, d, false);
  arms(out, d);
  head(out, d);
  feet(out, d);
  sword(out, d);
  shield(out, d);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');
