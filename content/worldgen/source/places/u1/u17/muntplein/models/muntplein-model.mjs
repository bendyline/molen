/** Muntplein/Muntsluis: mapped plaza, open canal tunnel, brick heads and green iron rails. */
import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const muntpleinControls = JSON.parse(
  readFileSync(new URL('../geometry-controls.json', import.meta.url), 'utf8'),
);
export const muntpleinSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.3 },
};
const C = muntpleinControls;
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = Object.fromEntries(
  Object.entries({
    brick: '76544b',
    stone: 'a9a69a',
    road: '686668',
    paving: '9c6e60',
    green: '365c57',
    steel: '777b79',
    grout: '726e68',
    dark: '4c5450',
  }).map(([k, v]) => [k, linear(v)]),
);
const configs = {
  skyline: { far: true, posts: 0, rails: 1, rounds: 4, rivets: 0, relief: false, tracks: false },
  district: { posts: 2.8, rails: 3, rounds: 6, rivets: 0, relief: false, tracks: true },
  street: { posts: 1.4, rails: 3, rounds: 10, rivets: 0, relief: false, tracks: true },
  closeup: { posts: 1.4, rails: 3, rounds: 16, rivets: 0.48, relief: true, tracks: true },
  master: { posts: 1.4, rails: 3, rounds: 24, rivets: 0.24, relief: true, tracks: true },
};
export const muntpleinDeckY = () => C.deckY;
const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function triangulatePlan(poly) {
  const signed = poly.reduce(
    (n, a, i) => n + a[0] * poly[(i + 1) % poly.length][1] - a[1] * poly[(i + 1) % poly.length][0],
    0,
  );
  const indices = poly.map((_, i) => i),
    result = [],
    sign = Math.sign(signed);
  while (indices.length > 3) {
    let found = false;
    for (let j = 0; j < indices.length; j++) {
      const a = indices[(j + indices.length - 1) % indices.length],
        b = indices[j],
        c = indices[(j + 1) % indices.length];
      if (sign * area2(poly[a], poly[b], poly[c]) < 1e-8) continue;
      if (
        indices.some(
          (i) =>
            ![a, b, c].includes(i) &&
            [
              area2(poly[a], poly[b], poly[i]),
              area2(poly[b], poly[c], poly[i]),
              area2(poly[c], poly[a], poly[i]),
            ].every((v) => sign * v >= -1e-8),
        )
      )
        continue;
      result.push([poly[a], poly[b], poly[c]]);
      indices.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid plaza polygon');
  }
  result.push(indices.map((i) => poly[i]));
  return result;
}
function writer(target, far) {
  const emit = (slot, _ref, p, hint, _uv, tint) => {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-9
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(o, slot, p, color, hint) {
  o.addConvexPolygon(slot, 'palette:#ffffff', p, hint, null, color);
}
function prism(o, slot, p, bottom, top, color) {
  for (const tri of triangulatePlan(p)) {
    face(
      o,
      slot,
      tri.map(([x, z]) => [x, top, z]),
      color,
      [0, 1, 0],
    );
    face(
      o,
      slot,
      tri.map(([x, z]) => [x, bottom, z]),
      color,
      [0, -1, 0],
    );
  }
  const signed = p.reduce(
    (n, a, i) => n + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
    0,
  );
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      hint = [Math.sign(signed) * (b[1] - a[1]), 0, -Math.sign(signed) * (b[0] - a[0])];
    face(
      o,
      slot,
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      color,
      hint,
    );
  }
}
function strip(a, b, width) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]),
    nx = ((-(b[1] - a[1]) / d) * width) / 2,
    nz = (((b[0] - a[0]) / d) * width) / 2;
  return [
    [a[0] + nx, a[1] + nz],
    [b[0] + nx, b[1] + nz],
    [b[0] - nx, b[1] - nz],
    [a[0] - nx, a[1] - nz],
  ];
}
function clip(subject, triangle) {
  let result = subject;
  const sign = Math.sign(area2(...triangle));
  for (let i = 0; i < 3; i++) {
    const a = triangle[i],
      b = triangle[(i + 1) % 3],
      input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length],
        u = sign * area2(a, b, p),
        v = sign * area2(a, b, q);
      if (u >= 0) result.push(p);
      if (u >= 0 !== v >= 0) {
        const t = u / (u - v);
        result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
  }
  return result;
}
function pavedPath(o, line, width, slot, color, y) {
  for (let i = 1; i < line.length; i++) {
    if (Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]) < 0.01) continue;
    for (const tri of triangulatePlan(C.outline)) {
      const p = clip(strip(line[i - 1], line[i], width), tri);
      if (
        p.length >= 3 &&
        Math.abs(
          p.reduce(
            (n, a, j) => n + a[0] * p[(j + 1) % p.length][1] - a[1] * p[(j + 1) % p.length][0],
            0,
          ),
        ) > 1e-7
      )
        prism(o, slot, p, y - 0.012, y, color);
    }
  }
}
function round(o, slot, p, r, y0, y1, n, color) {
  const ring = (y) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((-i / n) * Math.PI * 2),
      y,
      p[1] + r * Math.sin((-i / n) * Math.PI * 2),
    ]);
  loft(o, slot, [ring(y0), ring(y1)], color);
}
function mouth(o, a, b, cfg) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length,
    P = (t, y, n = 0) => [a[0] + t * dx - dz * n, y, a[1] + t * dz + dx * n],
    Y = C.deckY;
  beam(o, 'iron', P(0, Y - 0.29), P(length, Y - 0.29), 0.36, 0.5, colors.green);
  for (const y of [Y - 0.52, Y - 0.06])
    beam(o, 'iron', P(0, y), P(length, y), 0.48, 0.055, colors.green);
  for (let k = 0; k < cfg.rails; k++) {
    const y = Y + 0.3 + (cfg.rails === 1 ? 0.7 : k * 0.35);
    beam(o, 'iron', P(0.2, y), P(length - 0.2, y), 0.1, 0.1, colors.green);
  }
  if (cfg.posts)
    for (let t = 0.5; t < length; t += cfg.posts)
      beam(o, 'iron', P(t, Y), P(t, Y + 1.04), 0.105, 0.105, colors.green);
  for (const t of [0.6, length - 0.6]) {
    const p = P(t, 0);
    round(o, 'brick', [p[0], p[2]], 0.55, Y - 2.7, Y + 0.6, cfg.rounds, colors.brick);
    round(o, 'stone', [p[0], p[2]], 0.66, Y + 0.58, Y + 1.12, cfg.rounds, colors.stone);
    round(o, 'stone', [p[0], p[2]], 0.73, Y - 2.7, Y - 2.35, cfg.rounds, colors.stone);
  }
  // Low broad brick/stone central panel photographed on both canal faces.
  prism(
    o,
    'brick',
    strip(
      P(length / 2 - 1.05, 0).filter((_, i) => i !== 1),
      P(length / 2 + 1.05, 0).filter((_, i) => i !== 1),
      0.55,
    ),
    Y,
    Y + 0.62,
    colors.brick,
  );
  prism(
    o,
    'stone',
    strip(
      P(length / 2 - 1.1, 0).filter((_, i) => i !== 1),
      P(length / 2 + 1.1, 0).filter((_, i) => i !== 1),
      0.64,
    ),
    Y + 0.6,
    Y + 1.1,
    colors.stone,
  );
  if (cfg.relief)
    for (const side of [-1, 1])
      for (let j = -3; j <= 3; j++) {
        const x = length / 2 + j * 0.2;
        beam(
          o,
          'stone',
          P(x, Y + 0.64, side * 0.326),
          P(x + j * 0.1, Y + 1.015, side * 0.326),
          0.018,
          0.018,
          colors.grout,
        );
        for (const branch of [-1, 1])
          beam(
            o,
            'stone',
            P(x + j * 0.055, Y + 0.83, side * 0.326),
            P(x + j * 0.07 + branch * 0.12, Y + 0.94, side * 0.326),
            0.015,
            0.015,
            colors.grout,
          );
      }
  if (cfg.rivets)
    for (let t = 0.25; t < length - 0.1; t += cfg.rivets)
      for (const side of [-1, 1])
        for (const y of [Y - 0.4, Y - 0.15]) {
          const p = P(t, y, side * 0.192);
          box(
            o,
            'iron',
            [p[0] - 0.022, y - 0.022, p[2] - 0.022],
            [p[0] + 0.022, y + 0.022, p[2] + 0.022],
            colors.green,
          );
        }
}
export function buildMuntpleinLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Muntplein level');
  const o = writer(target, cfg.far),
    Y = C.deckY;
  prism(o, 'paving', C.outline, Y - 0.52, Y, colors.paving);
  // The canal remains open beneath the broad plaza. Long side abutments never cross its mouths.
  for (const indices of [
    [6, 0, 1, 2],
    [3, 4, 5],
  ])
    for (let i = 1; i < indices.length; i++) {
      const a = C.outline[indices[i - 1]],
        b = C.outline[indices[i]];
      prism(o, 'brick', strip(a, b, 0.78), -1, Y - 0.08, colors.brick);
      prism(o, 'stone', strip(a, b, 0.94), Y - 0.14, Y + 0.04, colors.stone);
    }
  for (const [a, b] of [
    [C.outline[2], C.outline[3]],
    [C.outline[5], C.outline[6]],
  ])
    mouth(o, a, b, cfg);
  if (!cfg.far) {
    for (const path of C.roadPaths) pavedPath(o, path, 3.4, 'paving', colors.road, Y + 0.012);
    if (cfg.tracks)
      for (const path of C.tramPaths)
        for (const side of [-1, 1]) {
          const shifted = path.map((p, i) => {
            const a = path[Math.max(0, i - 1)],
              b = path[Math.min(path.length - 1, i + 1)],
              d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            return [
              p[0] - ((b[1] - a[1]) / d) * side * 0.718,
              p[1] + ((b[0] - a[0]) / d) * side * 0.718,
            ];
          });
          pavedPath(o, shifted, 0.11, 'iron', colors.dark, Y + 0.018);
          if (level !== 'district') pavedPath(o, shifted, 0.055, 'iron', colors.steel, Y + 0.023);
        }
  }
}
export const buildMuntpleinSkyline = (o) => buildMuntpleinLevel(o, 'skyline');
export const buildMuntpleinDistrict = (o) => buildMuntpleinLevel(o, 'district');
export const buildMuntpleinStreet = (o) => buildMuntpleinLevel(o, 'street');
export const buildMuntpleinCloseup = (o) => buildMuntpleinLevel(o, 'closeup');
