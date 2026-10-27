/** Original Kokushkin Bridge: panel girder, Empire ironwork and granite end cheeks. */
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import C from './kokushkin-controls.json' with { type: 'json' };
export const kokushkinControls = C;
export const kokushkinSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.25 },
};
const linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  paint = linear(C.paint),
  edge = linear('34675a'),
  stone = linear(C.stone),
  paving = linear('aaa59a'),
  road = linear('626663'),
  white = linear('e7e4d8'),
  red = linear('ba3333'),
  black = linear('303837');
const levels = {
  skyline: { curve: 2, bars: 0, ring: 0, small: 0, swag: 0, leaves: 0, ribs: 0 },
  district: { curve: 4, bars: 2, ring: 6, small: 0, swag: 0, leaves: 0, ribs: 3 },
  street: { curve: 8, bars: 5, ring: 10, small: 4, swag: 2, leaves: 3, ribs: 5 },
  closeup: { curve: 12, bars: 7, ring: 20, small: 8, swag: 4, leaves: 8, ribs: 9 },
  master: { curve: 18, bars: 7, ring: 28, small: 10, swag: 5, leaves: 12, ribs: 11 },
};
export const kokushkinPoint = ([x, y, z]) => [x - C.shear * z, y, z];
export function kokushkinDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, y] = C.profile[i - 1],
      [b, v] = C.profile[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (v - y);
  }
  return C.profile.at(-1)[1];
}
function writer(target, far) {
  function emit(slot, _ref, points, hint, _uv, color) {
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      t = t.map(kokushkinPoint);
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        t.map((p) => [p[0], p[1]]),
        color,
      );
    }
  }
  return { addTriangle: emit, addQuad: emit, addConvexPolygon: emit };
}
function slab(o, slot, a, b, z0, z1, offset, depth, color) {
  const cuts = [a, ...C.profile.map((p) => p[0]).filter((x) => x > a && x < b), b];
  loft(
    o,
    slot,
    cuts.map((x) => {
      const y = kokushkinDeckY(x) + offset;
      return [
        [x, y - depth, z0],
        [x, y - depth, z1],
        [x, y, z1],
        [x, y, z0],
      ].reverse();
    }),
    color,
  );
}
function ring(o, x, y, z, r, width, n, color = paint) {
  beamPath(
    o,
    'metal',
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [x + r * Math.cos(a), y + r * Math.sin(a), z];
    }),
    width,
    width,
    color,
    true,
  );
}
function diamond(o, x, y, z, w, h, width, color = paint) {
  beamPath(
    o,
    'metal',
    [
      [x - w / 2, y, z],
      [x, y + h / 2, z],
      [x + w / 2, y, z],
      [x, y - h / 2, z],
    ],
    width,
    width,
    color,
    true,
  );
}
function leafyWreath(o, cfg, x, y, z) {
  ring(o, x, y, z, 0.285, 0.035, cfg.ring);
  if (!cfg.leaves) return;
  for (let i = 0; i < cfg.leaves; i++) {
    const a = (i * Math.PI * 2) / cfg.leaves,
      px = x + 0.29 * Math.cos(a),
      py = y + 0.29 * Math.sin(a),
      dx = 0.075 * Math.cos(a + 0.65),
      dy = 0.075 * Math.sin(a + 0.65);
    beam(o, 'metal', [px - dx, py - dy, z], [px + dx, py + dy, z], 0.058, 0.045, edge);
  }
  ring(o, x, y, z + 0.012, 0.075, 0.023, Math.max(6, cfg.small));
  for (const s of [-1, 1]) {
    beam(o, 'metal', [x + s * 0.105, y, z], [x + s * 0.44, y, z], 0.045, 0.05, paint);
    beam(o, 'metal', [x, y + s * 0.11, z], [x, y + s * 0.23, z], 0.045, 0.05, paint);
  }
  if (cfg.small > 4)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        o,
        'metal',
        [x + 0.08 * Math.cos(a), y + 0.08 * Math.sin(a), z],
        [x + 0.15 * Math.cos(a), y + 0.15 * Math.sin(a), z],
        0.025,
        0.035,
        edge,
      );
    }
}
function railing(target, cfg, z) {
  const o = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (...args) => {
        args[2] = args[2].map(([x, y, z]) => [x, y + 0.17, z]);
        return target[name](...args);
      },
    ]),
  );
  const [a, b] = C.spanEnds;
  if (!cfg.bars) {
    slab(o, 'metal', a, b, z - 0.035, z + 0.035, 1.18, 0.73, paint);
    return;
  }
  const pitch = (b - a) / C.railingPanels;
  for (const h of [0.25, 0.98, 1.22])
    beamPath(
      o,
      'metal',
      C.profile.filter((p) => p[0] >= a && p[0] <= b).map(([x, y]) => [x, y + h, z]),
      0.05,
      0.075,
      edge,
    );
  for (let i = 0; i <= C.railingPanels; i++) {
    const x = a + i * pitch,
      base = kokushkinDeckY(x);
    box(
      o,
      'metal',
      [x - 0.065, base + 0.17, z - 0.055],
      [x + 0.065, base + 1.24, z + 0.055],
      paint,
    );
    if (i === C.railingPanels) continue;
    const mid = x + pitch / 2,
      cy = kokushkinDeckY(mid) + 0.61;
    leafyWreath(o, cfg, mid, cy, z);
    for (let j = 0; j < cfg.bars; j++) {
      const u = x + ((j + 1) * pitch) / (cfg.bars + 1),
        y = kokushkinDeckY(u);
      beam(o, 'metal', [u, y + 0.25, z], [u, y + 0.98, z], 0.028, 0.045, paint);
      if (cfg.small) {
        ring(o, u, y + 0.145, z, 0.058, 0.022, cfg.small);
        ring(o, u, y + 1.16, z, 0.047, 0.021, cfg.small);
        const v = x + ((j + 2) * pitch) / (cfg.bars + 1);
        if (j < cfg.bars - 1) {
          const p = Array.from({ length: cfg.swag + 1 }, (_, k) => {
            const t = k / cfg.swag,
              xx = u + (v - u) * t;
            return [xx, kokushkinDeckY(xx) + 1.1 - 0.075 * Math.sin(t * Math.PI), z];
          });
          beamPath(o, 'metal', p, 0.032, 0.04, edge);
        }
      }
    }
    if (cfg.small) {
      diamond(o, x + pitch * 0.5, base + 1.1, z, 0.055, 0.13, 0.025, edge);
    }
  }
}
function fascia(o, cfg, z) {
  const [a, b] = C.spanEnds,
    pitch = (b - a) / 8;
  slab(o, 'metal', a, b, z - 0.09, z + 0.09, -0.17, 0.7, paint);
  if (!cfg.ring) return;
  for (let i = 0; i < 8; i++) {
    const lo = a + i * pitch + 0.08,
      hi = a + (i + 1) * pitch - 0.08,
      y = kokushkinDeckY((lo + hi) / 2) - 0.51,
      zz = z + Math.sign(z) * 0.1;
    beamPath(
      o,
      'metal',
      [
        [lo, y - 0.27, zz],
        [lo, y + 0.27, zz],
        [hi, y + 0.27, zz],
        [hi, y - 0.27, zz],
      ],
      0.025,
      0.027,
      edge,
      true,
    );
    if (i % 2 === 0) ring(o, (lo + hi) / 2, y, zz, 0.19, 0.028, cfg.ring);
    else diamond(o, (lo + hi) / 2, y, zz, 0.82, 0.3, 0.027, edge);
    box(o, 'metal', [lo - 0.12, y - 0.2, z - 0.13], [lo - 0.02, y + 0.4, z + 0.13], edge);
    if (cfg.small)
      for (const k of [-1, 1])
        beam(
          o,
          'metal',
          [lo - 0.1, y - 0.12, zz],
          [lo - 0.1, y + 0.3, zz + k * 0.11],
          0.04,
          0.04,
          paint,
        );
  }
}
function abutment(o, cfg, end) {
  const side = end ? 1 : -1,
    x = C.spanEnds[end],
    outer = x + side * 3.7;
  box(
    o,
    'stone',
    [Math.min(x, outer), -0.6, -C.halfWidth],
    [Math.max(x, outer), 3.32, C.halfWidth],
    stone,
  );
  if (cfg.ring) {
    const xx = x - side * 0.004,
      joint = stone.map((v) => v * 0.62);
    for (let row = 0; row < 4; row++) {
      const y = 0.1 + row * 0.8;
      o.addQuad(
        'stone',
        'palette:#ffffff',
        [
          [xx, y, -C.halfWidth],
          [xx, y, C.halfWidth],
          [xx, y + 0.018, C.halfWidth],
          [xx, y + 0.018, -C.halfWidth],
        ],
        [-side, 0, 0],
        [],
        joint,
      );
      for (let z = -C.halfWidth + 0.7 + (row % 2) * 0.7; z < C.halfWidth - 0.2; z += 1.4)
        o.addQuad(
          'stone',
          'palette:#ffffff',
          [
            [xx, y + 0.018, z],
            [xx, y + 0.79, z],
            [xx, y + 0.79, z + 0.018],
            [xx, y + 0.018, z + 0.018],
          ],
          [-side, 0, 0],
          [],
          joint,
        );
    }
  }
  for (const zsign of [-1, 1]) {
    const z = zsign * C.halfWidth,
      points = Array.from({ length: cfg.curve + 1 }, (_, i) => {
        const t = i / cfg.curve;
        return [x + side * (0.65 + 1.65 * t * t), 3.75, z + zsign * 3.0 * t];
      });
    loft(
      o,
      'stone',
      points.map((p) => {
        const ring = [
          [p[0] - 0.35, -0.6, p[2]],
          [p[0] + 0.35, -0.6, p[2]],
          [p[0] + 0.35, p[1], p[2]],
          [p[0] - 0.35, p[1], p[2]],
        ];
        return zsign < 0 ? ring.reverse() : ring;
      }),
      stone,
    );
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      beam(o, 'stone', a, b, 0.86, 0.19, paving);
      if (cfg.ring)
        for (let row = 0; row < 4; row++) {
          const y = 0.1 + row * 0.8,
            xa = a[0] - side * 0.354,
            xb = b[0] - side * 0.354;
          o.addQuad(
            'stone',
            'palette:#ffffff',
            [
              [xa, y, a[2]],
              [xb, y, b[2]],
              [xb, y + 0.018, b[2]],
              [xa, y + 0.018, a[2]],
            ],
            [-side, 0, 0],
            [],
            stone.map((v) => v * 0.62),
          );
        }
    }
    box(
      o,
      'stone',
      [x + side * 0.65 - 0.43, 3.63, z - 0.44],
      [x + side * 0.65 + 0.43, 4.79, z + 0.44],
      stone,
    );
    box(
      o,
      'stone',
      [x + side * 0.65 - 0.48, 4.79, z - 0.49],
      [x + side * 0.65 + 0.48, 4.91, z + 0.49],
      paving,
    );
  }
}
function marker(o, z) {
  const mid = (C.spanEnds[0] + C.spanEnds[1]) / 2,
    y = kokushkinDeckY(mid),
    s = Math.sign(z),
    zz = z + s * 0.145;
  box(o, 'metal', [mid - 0.27, y - 1.08, zz - 0.025], [mid + 0.27, y - 0.48, zz + 0.025], red);
  box(
    o,
    'metal',
    [mid - 0.22, y - 1.03, zz + s * 0.03 - 0.012],
    [mid + 0.22, y - 0.53, zz + s * 0.03 + 0.012],
    white,
  );
  o.addConvexPolygon(
    'metal',
    'palette:#ffffff',
    [
      [mid - 0.23, y + 0.52, zz],
      [mid, y + 0.89, zz],
      [mid + 0.23, y + 0.52, zz],
      [mid, y + 0.15, zz],
    ],
    [0, 0, s],
    () => [0, 0],
    white,
  );
  const seg = { 2: [0, 1, 3, 4, 6], 6: [0, 2, 3, 4, 5, 6] },
    coords = [
      [-0.05, 0.1, 0.05, 0.1],
      [0.05, 0, 0.05, 0.1],
      [-0.05, 0, -0.05, 0.1],
      [-0.05, 0, 0.05, 0],
      [-0.05, -0.1, -0.05, 0],
      [0.05, -0.1, 0.05, 0],
      [-0.05, -0.1, 0.05, -0.1],
    ];
  for (const [digit, dx] of [
    [2, -0.1],
    [6, 0.1],
  ])
    for (const k of seg[digit]) {
      const [a, b, c, d] = coords[k];
      beam(
        o,
        'metal',
        [mid + s * (dx + a), y - 0.77 + b, zz + s * 0.05],
        [mid + s * (dx + c), y - 0.77 + d, zz + s * 0.05],
        0.018,
        0.012,
        black,
      );
    }
  box(
    o,
    'metal',
    [mid - 0.018, y - 0.87, zz + s * 0.05 - 0.005],
    [mid + 0.002, y - 0.85, zz + s * 0.05 + 0.005],
    black,
  );
}
export function buildKokushkinLevel(target, level = 'master') {
  const cfg = levels[level];
  if (!cfg) throw Error('Unknown Kokushkin LOD');
  const o = writer(target, level === 'skyline');
  slab(o, 'road', -C.halfLength, C.halfLength, -4.7, 4.7, 0, 0.26, road);
  for (const s of [-1, 1]) {
    slab(
      o,
      'stone',
      -C.halfLength,
      C.halfLength,
      s < 0 ? -C.halfWidth : 4.7,
      s < 0 ? -4.7 : C.halfWidth,
      0.17,
      0.33,
      paving,
    );
    fascia(o, cfg, s * (C.halfWidth - 0.1));
    railing(o, cfg, s * (C.halfWidth - 0.1));
    if (cfg.small) marker(o, s * (C.halfWidth - 0.1));
  }
  for (let i = 0; i < cfg.ribs; i++) {
    const z = -5.9 + (11.8 * i) / Math.max(1, cfg.ribs - 1);
    slab(o, 'metal', ...C.spanEnds, z - 0.05, z + 0.05, -0.27, 0.55, paint);
  }
  for (const i of [0, 1]) abutment(o, cfg, i);
  if (cfg.small)
    for (let x = -9; x <= 9; x += 3)
      slab(o, 'road', x, x + 1.0, -0.045, 0.045, 0.006, 0.006, white);
}
export const buildKokushkinSkyline = (o) => buildKokushkinLevel(o, 'skyline');
export const buildKokushkinDistrict = (o) => buildKokushkinLevel(o, 'district');
export const buildKokushkinStreet = (o) => buildKokushkinLevel(o, 'street');
export const buildKokushkinCloseup = (o) => buildKokushkinLevel(o, 'closeup');
