/** Original Łazienkowski exterior: five river spans, land viaducts and lower cycle decks. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const alignment = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  concrete: linear('c5c2b7'),
  steel: linear('b9c0bd'),
  road: linear('646766'),
  rail: linear('c5ced0'),
  pole: linear('555f60'),
  paint: linear('eee9d4'),
  path: linear('777d77'),
};
export const lazienkowskiSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.3 },
  road: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
export const lazienkowskiControls = {
  minX: -430,
  maxX: 430,
  width: 27.76,
  riverStart: -155.5,
  riverEnd: 267.5,
  riverPiers: [-79, 11, 101, 191],
  riverSpans: [76.5, 90, 90, 90, 76.5],
  girderZ: [-10.894, -4.78, 4.78, 10.894],
  girderDepth: 3.8,
  originElevation: 74,
  cycleWidth: 3.4,
  cycleTop: 8.8,
};
const cfgs = {
  skyline: {
    far: true,
    deckSegments: 4,
    approachStep: 90,
    crossStep: 0,
    lampStep: 0,
    railStep: 0,
    baluster: 0,
  },
  district: {
    deckSegments: 6,
    approachStep: 90,
    crossStep: 90,
    lampStep: 120,
    railStep: 0,
    baluster: 0,
  },
  street: {
    deckSegments: 30,
    approachStep: 45,
    crossStep: 18,
    lampStep: 40,
    railStep: 12,
    baluster: 0,
  },
  closeup: {
    deckSegments: 56,
    approachStep: 45,
    crossStep: 9,
    lampStep: 40,
    railStep: 8,
    baluster: 1.8,
  },
  master: {
    deckSegments: 86,
    approachStep: 45,
    crossStep: 6,
    lampStep: 40,
    railStep: 2,
    baluster: 0.22,
  },
};
const interpolate = (p, x) => {
  const i = p.findIndex((p) => p[0] >= x);
  if (i <= 0) return p[i === 0 ? 0 : p.length - 1][1];
  const a = p[i - 1],
    b = p[i];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
};
export const lazienkowskiDeckY = (x) => interpolate(alignment.deckProfile, x);
const groundY = (x) => Math.max(0, interpolate(alignment.terrainProfile, x) - 74);
function slab(out, slot, a, b, za, zb, depth, color) {
  const y0 = lazienkowskiDeckY(a),
    y1 = lazienkowskiDeckY(b);
  loft(
    out,
    slot,
    [
      [
        [a, y0 - depth, za],
        [a, y0 - depth, zb],
        [a, y0, zb],
        [a, y0, za],
      ],
      [
        [b, y1 - depth, za],
        [b, y1 - depth, zb],
        [b, y1, zb],
        [b, y1, za],
      ],
    ],
    color,
  );
}
function iGirder(out, slot, a, b, z, color, far) {
  slab(out, slot, a, b, z - 0.12, z + 0.12, 3.8, color);
  if (far) return;
  const y0 = lazienkowskiDeckY(a),
    y1 = lazienkowskiDeckY(b);
  for (const offset of [0.2, 3.8])
    loft(
      out,
      slot,
      [
        [
          [a, y0 - offset - 0.12, z - 0.42],
          [a, y0 - offset - 0.12, z + 0.42],
          [a, y0 - offset, z + 0.42],
          [a, y0 - offset, z - 0.42],
        ],
        [
          [b, y1 - offset - 0.12, z - 0.42],
          [b, y1 - offset - 0.12, z + 0.42],
          [b, y1 - offset, z + 0.42],
          [b, y1 - offset, z - 0.42],
        ],
      ],
      color,
    );
}
function riverPier(out, slot, x, color) {
  const y0 = groundY(x),
    top = lazienkowskiDeckY(x) - 4.05;
  // Broad transverse concrete pier with chamfered cutwater ends, not an opaque river wall.
  const ring = (y, s) =>
    [
      [-2.6, -10],
      [-2.1, -12],
      [2.1, -12],
      [2.6, -10],
      [2.6, 10],
      [2.1, 12],
      [-2.1, 12],
      [-2.6, 10],
    ].map(([a, z]) => [x + a * s, y, z * s]);
  loft(out, slot, [ring(y0, 0.92), ring(top, 1)], color);
}
function approachPier(out, slot, x, color, far) {
  const top = lazienkowskiDeckY(x) - 1.65,
    base = groundY(x);
  if (top - base < 0.5) return;
  if (far) {
    box(out, slot, [x - 0.9, base, -8], [x + 0.9, top, 8], color);
    return;
  }
  for (const z of [-8, 0, 8])
    box(out, slot, [x - 0.8, base, z - 0.8], [x + 0.8, top, z + 0.8], color);
  box(out, slot, [x - 1.3, top - 0.85, -11.8], [x + 1.3, top, 11.8], color);
}
function pathSlab(out, slot, points, width, depth, color) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      len = Math.hypot(dx, dz),
      nx = ((-dz / len) * width) / 2,
      nz = ((dx / len) * width) / 2;
    const ring = (p) => [
      [p[0] - nx, p[1] - depth, p[2] - nz],
      [p[0] + nx, p[1] - depth, p[2] + nz],
      [p[0] + nx, p[1], p[2] + nz],
      [p[0] - nx, p[1], p[2] - nz],
    ];
    loft(out, slot, [ring(a), ring(b)], color);
  }
}
function railing(out, slot, points, cfg, color) {
  if (cfg.far) return;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    for (const y of cfg === cfgs.district ? [1.18] : [0.55, 1.18])
      beam(
        out,
        slot,
        [a[0], a[1] + y, a[2]],
        [b[0], b[1] + y, b[2]],
        cfg.baluster ? 0.07 : 0.1,
        0.085,
        color,
      );
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = cfg.railStep ? Math.ceil(length / cfg.railStep) : 0;
    for (let j = 0; j < n; j++) {
      const t = j / n,
        p = a.map((v, k) => v + (b[k] - v) * t);
      box(
        out,
        slot,
        [p[0] - 0.045, p[1], p[2] - 0.045],
        [p[0] + 0.045, p[1] + 1.22, p[2] + 0.045],
        color,
      );
    }
    if (cfg.baluster) {
      const n = Math.ceil(length / cfg.baluster);
      for (let j = 1; j < n; j++) {
        const t = j / n,
          p = a.map((v, k) => v + (b[k] - v) * t);
        box(
          out,
          slot,
          [p[0] - 0.016, p[1] + 0.04, p[2] - 0.016],
          [p[0] + 0.016, p[1] + 1.17, p[2] + 0.016],
          color,
        );
      }
    }
  }
}
function lowerPaths(out, slot, cfg) {
  for (const path of alignment.cyclePaths) {
    const points = path.points.map(([x, z], i) => [x, path.heights[i], z]);
    pathSlab(out, slot, points, 3.4, 0.35, C.steel);
    if (cfg.far) continue;
    // Edge offsets follow the actual signed path, including the bank access bends.
    for (const sign of [-1, 1]) {
      const edge = points.map((p, i) => {
        const a = points[Math.max(0, i - 1)],
          b = points[Math.min(points.length - 1, i + 1)],
          d = Math.hypot(b[0] - a[0], b[2] - a[2]);
        return [
          p[0] - ((b[2] - a[2]) / d) * 1.65 * sign,
          p[1],
          p[2] + ((b[0] - a[0]) / d) * 1.65 * sign,
        ];
      });
      railing(out, slot, edge, cfg, C.rail);
    }
    // Sparse underside supports on the access ramps; full bridge paths use suspended brackets.
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (Math.abs(p[2]) < 18) continue;
      const base = Math.min(p[1] - 0.5, Math.max(0, groundY(p[0]) - 1));
      box(
        out,
        slot,
        [p[0] - 0.35, base, p[2] - 0.35],
        [p[0] + 0.35, p[1] - 0.35, p[2] + 0.35],
        C.concrete,
      );
    }
  }
  if (cfg.far || !cfg.crossStep) return;
  for (let x = -110; x <= 270; x += cfg.crossStep)
    for (const z of [-12.2, 13.5]) {
      const y = 8.8;
      beam(
        out,
        slot,
        [x, y - 0.38, z],
        [x, lazienkowskiDeckY(x) - 0.45, z > 0 ? 10.894 : -10.894],
        0.14,
        0.18,
        C.steel,
      );
      beam(out, slot, [x, y - 0.38, z - 1.7], [x, y - 0.38, z + 1.7], 0.18, 0.2, C.steel);
    }
}
function lamp(out, slot, x, z, cfg) {
  const y = lazienkowskiDeckY(x) + 0.1;
  if (cfg === cfgs.district) {
    box(out, slot, [x - 0.09, y, z - 0.09], [x + 0.09, y + 10, z + 0.09], C.pole);
    return;
  }
  const sides = cfg === cfgs.street ? 4 : 8;
  tubePath(
    out,
    slot,
    [
      [x, y, z],
      [x, y + 10.6, z],
    ],
    0.09,
    C.pole,
    sides,
  );
  for (const sign of [-1, 1]) {
    const end = [x, y + 9.9, z + sign * 2.8];
    beam(out, slot, [x, y + 9.9, z], end, 0.07, 0.08, C.pole);
    box(
      out,
      slot,
      [end[0] - 0.22, end[1] - 0.08, end[2] - 0.45],
      [end[0] + 0.22, end[1] + 0.08, end[2] + 0.45],
      C.pole,
    );
  }
}
export function buildLazienkowskiLevel(out, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Łazienkowski tier ' + level);
  const S = (s) => (cfg.far ? 'far' : s);
  const breaks = [-430, -155.5, 267.5, 430];
  for (let j = 1; j < breaks.length; j++) {
    const a = breaks[j - 1],
      b = breaks[j],
      n = Math.max(1, Math.round(((b - a) / 860) * cfg.deckSegments));
    for (let i = 0; i < n; i++) {
      const x = a + ((b - a) * i) / n,
        q = a + ((b - a) * (i + 1)) / n;
      slab(out, S('concrete'), x, q, -13.88, 13.88, j === 2 ? 0.32 : 1.6, C.concrete);
      // Wearing surface is a separate shallow slab above the structural deck.
      const py = lazienkowskiDeckY(x),
        qy = lazienkowskiDeckY(q);
      loft(
        out,
        S('road'),
        [
          [
            [x, py, -11.9],
            [x, py, 11.9],
            [x, py + 0.035, 11.9],
            [x, py + 0.035, -11.9],
          ],
          [
            [q, qy, -11.9],
            [q, qy, 11.9],
            [q, qy + 0.035, 11.9],
            [q, qy + 0.035, -11.9],
          ],
        ],
        C.road,
      );
    }
  }
  for (const z of lazienkowskiControls.girderZ)
    iGirder(out, S('steel'), -155.5, 267.5, z, C.steel, cfg.far);
  for (const x of lazienkowskiControls.riverPiers) riverPier(out, S('concrete'), x, C.concrete);
  for (const [a, b] of [
    [-410, -160],
    [280, 425],
  ])
    for (let x = a; x <= b; x += cfg.approachStep)
      approachPier(out, S('concrete'), x, C.concrete, cfg.far);
  for (const x of [-155.5, 267.5]) approachPier(out, S('concrete'), x, C.concrete, cfg.far);
  if (!cfg.far) {
    for (const z of [-13.48, 13.48])
      railing(
        out,
        S('steel'),
        alignment.deckProfile.map(([x, y]) => [x, y + 0.1, z]),
        cfg,
        C.rail,
      );
    // Three traffic lanes per direction with a protected central median.
    for (const z of [-0.55, 0.55]) {
      for (let i = 1; i < alignment.deckProfile.length; i++) {
        const a = alignment.deckProfile[i - 1],
          b = alignment.deckProfile[i];
        beam(out, S('steel'), [a[0], a[1] + 0.55, z], [b[0], b[1] + 0.55, z], 0.12, 0.32, C.steel);
      }
    }
    if (cfg.crossStep)
      for (let x = -151; x < 267; x += cfg.crossStep) {
        beam(
          out,
          S('steel'),
          [x, lazienkowskiDeckY(x) - 1, -11.2],
          [x, lazienkowskiDeckY(x) - 1, 11.2],
          0.14,
          0.7,
          C.steel,
        );
        if (level === 'master' || level === 'closeup')
          for (const z of lazienkowskiControls.girderZ)
            box(
              out,
              S('steel'),
              [x - 0.08, lazienkowskiDeckY(x) - 3.7, z - 0.35],
              [x + 0.08, lazienkowskiDeckY(x) - 0.2, z + 0.35],
              C.steel,
            );
      }
    for (let x = -410; x < 430; x += cfg.lampStep)
      for (const z of [-12.8, 12.8]) lamp(out, S('steel'), x, z, cfg);
    if (level !== 'district') {
      const mark = (a, b, z, width) =>
        out.addQuad(
          'paint',
          'palette:#ffffff',
          [
            [a, lazienkowskiDeckY(a) + 0.048, z - width / 2],
            [a, lazienkowskiDeckY(a) + 0.048, z + width / 2],
            [b, lazienkowskiDeckY(b) + 0.048, z + width / 2],
            [b, lazienkowskiDeckY(b) + 0.048, z - width / 2],
          ],
          [0, 1, 0],
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ],
          C.paint,
        );
      for (let x = -425; x < 425; x += 10) for (const z of [-8, -4, 4, 8]) mark(x, x + 4, z, 0.12);
      for (const z of [-11.2, 11.2])
        for (let x = -430; x < 430; x += 20) mark(x, Math.min(430, x + 20), z, 0.1);
    }
  }
  lowerPaths(out, S('steel'), cfg);
  if (level === 'closeup' || level === 'master')
    for (const z of [-2.5, 2.5])
      tubePath(
        out,
        'steel',
        [
          [-155.5, 11.6, z],
          [267.5, 11.6, z],
        ],
        0.3,
        C.steel,
        level === 'master' ? 12 : 8,
      );
}
export const buildLazienkowskiSkyline = (out) => buildLazienkowskiLevel(out, 'skyline');
export const buildLazienkowskiDistrict = (out) => buildLazienkowskiLevel(out, 'district');
export const buildLazienkowskiStreet = (out) => buildLazienkowskiLevel(out, 'street');
export const buildLazienkowskiCloseup = (out) => buildLazienkowskiLevel(out, 'closeup');
