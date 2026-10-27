/** Kuradisild, Tartu: open concrete rib arch, paneled parapets and two distinct oval plaques. */
import {
  beam,
  cross,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const kuradisildControls = {
  originMeters: 71.1,
  ends: [-12.487462442700435, 11.676002584774675],
  width: 4,
  deckY: 5.75,
  archHalfSpan: 10.35,
  springY: 0.65,
  archRise: 4.5,
  ribDepth: 0.42,
  ribHalfWidth: 0.18,
  ribs: [-1.62, 1.62],
};
export const kuradisildSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  plain: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.75, metallic: 0.75 },
};
const C = kuradisildControls,
  A = C.ends[0],
  B = C.ends[1],
  W = C.width / 2,
  Y = C.deckY;
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = Object.fromEntries(
  Object.entries({
    body: '9b9281',
    arch: '928b7c',
    trim: 'aaa28e',
    paving: '928a7b',
    bronze: '4c6558',
    relief: '7d8a70',
    letter: '514e40',
    date: 'c7c1ad',
    lamp: 'd9d4bf',
  }).map(([k, v]) => [k, linear(v)]),
);
const configs = {
  skyline: { far: true, curve: 5, posts: 4, panels: 0, portrait: 0, wreath: 0, text: false },
  district: { curve: 12, posts: 8, panels: 1, portrait: 8, wreath: 0, text: false },
  street: { curve: 24, posts: 8, panels: 1, portrait: 12, wreath: 12, text: true },
  closeup: { curve: 40, posts: 8, panels: 1, portrait: 20, wreath: 22, text: true },
  master: { curve: 64, posts: 8, panels: 1, portrait: 32, wreath: 32, text: true },
};
export const kuradisildDeckY = () => Y;
export function kuradisildArchY(x) {
  const t = x / C.archHalfSpan;
  return C.springY + C.archRise * (1 - t * t);
}
export function kuradisildFacetedArchY(x, steps) {
  const step = (2 * C.archHalfSpan) / steps;
  const index = Math.min(steps - 1, Math.max(0, Math.floor((x + C.archHalfSpan) / step)));
  const a = -C.archHalfSpan + index * step;
  const t = (x - a) / step;
  return kuradisildArchY(a) * (1 - t) + kuradisildArchY(a + step) * t;
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
const b = (o, slot, a, c, y0, y1, z0, z1, color) => box(o, slot, [a, y0, z0], [c, y1, z1], color);
function oval(o, slot, x, y, z, rx, ry, depth, n, color) {
  const ring = (zz) =>
    Array.from({ length: n }, (_, i) => [
      x + rx * Math.cos((i / n) * Math.PI * 2),
      y + ry * Math.sin((i / n) * Math.PI * 2),
      zz,
    ]);
  loft(o, slot, [ring(z - depth / 2), ring(z + depth / 2)], color);
}
function rib(o, z, cfg) {
  const rings = Array.from({ length: cfg.curve + 1 }, (_, i) => {
    const x = -C.archHalfSpan + (i / cfg.curve) * C.archHalfSpan * 2,
      y = kuradisildArchY(x);
    return [
      [x, y - C.ribDepth, z - C.ribHalfWidth],
      [x, y, z - C.ribHalfWidth],
      [x, y, z + C.ribHalfWidth],
      [x, y - C.ribDepth, z + C.ribHalfWidth],
    ];
  });
  loft(o, 'concrete', rings, colors.arch);
  for (let i = 0; i <= cfg.posts; i++) {
    const x = -9.6 + (i / cfg.posts) * 19.2,
      y = kuradisildFacetedArchY(x, cfg.curve);
    b(o, 'concrete', x - 0.12, x + 0.12, y - 0.06, Y - 0.22, z - 0.15, z + 0.15, colors.body);
    b(o, 'plain', x - 0.21, x + 0.21, Y - 0.36, Y - 0.23, z - 0.23, z + 0.23, colors.trim);
  }
}
const glyph = {
  A: [
    [
      [0, 0],
      [0.3, 1],
      [0.6, 0],
    ],
    [
      [0.12, 0.4],
      [0.48, 0.4],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [0.6, 0],
    ],
  ],
  E: [
    [
      [0.6, 1],
      [0, 1],
      [0, 0],
      [0.6, 0],
    ],
    [
      [0, 0.5],
      [0.5, 0.5],
    ],
  ],
  X: [
    [
      [0, 0],
      [0.6, 1],
    ],
    [
      [0, 1],
      [0.6, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [0.6, 0],
      [0.6, 1],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.45, 1],
      [0.6, 0.8],
      [0.6, 0.2],
      [0.45, 0],
      [0, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.6, 0.75],
      [0.5, 0.5],
      [0, 0.5],
    ],
    [
      [0.25, 0.5],
      [0.6, 0],
    ],
  ],
  O: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
      [0.6, 0],
      [0, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.5, 1],
      [0.6, 0.75],
      [0.5, 0.5],
      [0, 0.5],
    ],
  ],
  I: [
    [
      [0.3, 0],
      [0.3, 1],
    ],
    [
      [0.05, 0],
      [0.55, 0],
    ],
    [
      [0.05, 1],
      [0.55, 1],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.3, 0.5],
      [0.6, 1],
      [0.6, 0],
    ],
  ],
  1: [
    [
      [0.05, 0.75],
      [0.3, 1],
      [0.3, 0],
    ],
    [
      [0.05, 0],
      [0.55, 0],
    ],
  ],
  3: [
    [
      [0, 1],
      [0.6, 1],
      [0.6, 0],
      [0, 0],
    ],
    [
      [0.1, 0.5],
      [0.6, 0.5],
    ],
  ],
  6: [
    [
      [0.6, 1],
      [0, 1],
      [0, 0],
      [0.6, 0],
      [0.6, 0.5],
      [0, 0.5],
    ],
  ],
  9: [
    [
      [0.6, 0.5],
      [0, 0.5],
      [0, 1],
      [0.6, 1],
      [0.6, 0],
      [0, 0],
    ],
  ],
};
function text(o, string, x, y, z, h) {
  const step = 0.85 * h,
    start = x - (step * (string.length - 1)) / 2 - 0.3 * h,
    sign = z < 0 ? -1 : 1;
  for (const [j, ch] of [...string].entries())
    for (const line of glyph[ch] ?? [])
      for (let i = 1; i < line.length; i++) {
        const P = (p) => [sign * (start + j * step + p[0] * h), y + p[1] * h, z];
        beam(o, 'bronze', P(line[i - 1]), P(line[i]), 0.022, 0.015, colors.letter);
      }
}
function plaques(o, side, cfg) {
  const z = side * (W - 0.16),
    front = z + side * 0.22,
    cy = Y + 0.57,
    n = cfg.portrait || 8;
  // Faceted concrete halo rises above the parapet; no separate floating plaque support.
  oval(o, 'concrete', 0, cy, z, 0.76, 0.79, 0.4, Math.max(8, n), colors.trim);
  if (!cfg.portrait) return;
  oval(o, 'bronze', 0, cy, front, 0.6, 0.65, 0.035, n, colors.bronze);
  if (side > 0) {
    const zz = front + 0.06;
    sphere(
      o,
      'bronze',
      [0.04, cy + 0.15, zz],
      [0.2, 0.27, 0.07],
      colors.relief,
      n,
      Math.max(4, Math.floor(n / 2)),
    );
    sphere(o, 'bronze', [0.23, cy + 0.15, zz], [0.08, 0.055, 0.05], colors.relief, n, 4);
    b(o, 'bronze', -0.03, 0.12, cy - 0.25, cy - 0.02, zz - 0.015, zz + 0.04, colors.relief);
    sphere(o, 'bronze', [-0.04, cy - 0.32, zz], [0.33, 0.16, 0.055], colors.relief, n, 4);
  } else {
    oval(o, 'plain', 0, cy, front - 0.025, 0.47, 0.54, 0.024, n, colors.date);
    if (cfg.text) {
      text(o, '1613', 0, cy + 0.13, front - 0.0375, 0.19);
      text(o, '1913', 0, cy - 0.2, front - 0.0375, 0.19);
    }
    if (cfg.wreath)
      for (let j = 0; j < cfg.wreath; j++) {
        const t = (j / cfg.wreath) * Math.PI * 2,
          x = 0.54 * Math.cos(t),
          y = cy + 0.6 * Math.sin(t),
          dx = 0.07 * Math.cos(t),
          dy = 0.055 * Math.sin(t),
          p = [
            [x - dx, y - dy, front - 0.012],
            [x - 0.045 * Math.sin(t), y + 0.045 * Math.cos(t), front - 0.032],
            [x + dx, y + dy, front - 0.012],
            [x + 0.045 * Math.sin(t), y - 0.045 * Math.cos(t), front - 0.032],
          ];
        o.addConvexPolygon('bronze', 'palette:#ffffff', p, [0, 0, -1], null, colors.relief);
      }
  }
}
export function buildKuradisildLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Kuradisild level');
  const o = writer(target, cfg.far);
  b(o, 'plain', A, B, Y - 0.24, Y, -W, W, colors.body);
  b(o, 'plain', A, B, Y - 0.015, Y + 0.016, -W + 0.25, W - 0.25, colors.paving);
  for (const z of C.ribs) rib(o, z, cfg);
  for (const x of [-9.6, -4.8, 0, 4.8, 9.6])
    beam(o, 'concrete', [x, Y - 0.35, -1.8], [x, Y - 0.35, 1.8], 0.22, 0.24, colors.body);
  for (const side of [-1, 1]) {
    const z = side * (W - 0.16);
    b(o, 'concrete', A, B, Y - 0.04, Y + 1.05, z - 0.18, z + 0.18, colors.body);
    b(o, 'plain', A - 0.04, B + 0.04, Y - 0.06, Y + 0.1, z - 0.24, z + 0.24, colors.trim);
    b(o, 'plain', A - 0.04, B + 0.04, Y + 1.01, Y + 1.12, z - 0.23, z + 0.23, colors.trim);
    if (cfg.panels)
      for (let x = A + 0.95; x < B - 0.45; x += 1.65) {
        if (Math.abs(x) < 1.03) continue;
        for (const facing of [-1, 1]) {
          const zz = z + facing * 0.19;
          for (const yy of [Y + 0.24, Y + 0.86])
            b(o, 'plain', x - 0.58, x + 0.58, yy, yy + 0.055, zz - 0.022, zz + 0.022, colors.trim);
          for (const xx of [x - 0.58, x + 0.525])
            b(o, 'plain', xx, xx + 0.055, Y + 0.24, Y + 0.91, zz - 0.022, zz + 0.022, colors.trim);
        }
      }
    plaques(o, side, cfg);
    if (cfg.text && side > 0)
      text(o, 'ALEXANDRO PRIMO', 0, 4.83, C.ribs.at(-1) + C.ribHalfWidth + 0.006, 0.17);
  }
  for (const side of [-1, 1]) {
    const a = side < 0 ? A : -0 + 10.35,
      bx = side < 0 ? -10.35 : B;
    b(o, 'concrete', a, bx, -0.25, Y - 0.06, -W - 0.15, W + 0.15, colors.body);
    b(
      o,
      'plain',
      side < 0 ? -11.1 : 9.7,
      side < 0 ? -9.7 : 11.1,
      -0.3,
      0.85,
      -W - 0.35,
      W + 0.35,
      colors.trim,
    );
    b(
      o,
      'plain',
      side < 0 ? A - 1.1 : B - 0.3,
      side < 0 ? A + 0.3 : B + 1.1,
      Y - 0.24,
      Y + 0.014,
      -W - 0.35,
      W + 0.35,
      colors.paving,
    );
  }
  if (level === 'street' || level === 'closeup' || level === 'master')
    for (const x of [-3.5, 3.5]) {
      // Under-deck utility lamps: shallow shade and bracket, no private emissive texture.
      beam(o, 'bronze', [x, Y - 0.25, 0], [x, Y - 0.66, 0], 0.06, 0.06, colors.bronze);
      sphere(
        o,
        'plain',
        [x, Y - 0.68, 0],
        [0.22, 0.1, 0.22],
        colors.lamp,
        Math.max(8, cfg.portrait),
        5,
      );
    }
}
export const buildKuradisildSkyline = (o) => buildKuradisildLevel(o, 'skyline');
export const buildKuradisildDistrict = (o) => buildKuradisildLevel(o, 'district');
export const buildKuradisildStreet = (o) => buildKuradisildLevel(o, 'street');
export const buildKuradisildCloseup = (o) => buildKuradisildLevel(o, 'closeup');
