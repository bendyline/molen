/** Original Grunwald suspension bridge: stone portals, flat blue bands and road/tram deck. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const data = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: linear('b9b2a3'),
  cap: linear('c6bead'),
  blue: linear('7da5c9'),
  darkBlue: linear('6388a9'),
  road: linear('646766'),
  walk: linear('bab4a5'),
  rail: linear('bfc5bf'),
  paint: linear('eee9d4'),
  lamp: linear('e8e7db'),
};
export const grunwaldSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.32 },
  rail: { slot: 'trim', graph: 'metal_stainless', roughness: 0.4, metallic: 0.7 },
  road: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  walk: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
export const grunwaldControls = {
  gates: [-63.3, 63.3],
  halfSpan: 56.25,
  bandHalfSpan: 63.3,
  bandOffset: 9.45,
  roadWidth: 11,
  deckHalfWidth: 10,
  portalClearWidth: 16,
  archSpring: 7.2,
  archRise: 4.96,
  portalTop: 16,
  bandTop: 13.44,
  bandSag: 2.56,
  sourceOrigin: data.originElevation,
};
const cfgs = {
  skyline: {
    far: true,
    arch: 5,
    upperWindows: false,
    bandSegments: 8,
    doubleBands: false,
    hangerStep: 28,
    diagonalStep: 0,
    postStep: 0,
    railSides: 0,
    courses: 0,
    rivets: 0,
    lamps: false,
    wires: false,
  },
  district: {
    arch: 8,
    upperWindows: true,
    bandSegments: 16,
    doubleBands: false,
    hangerStep: 8,
    diagonalStep: 0,
    postStep: 14,
    railSides: 4,
    courses: 0,
    rivets: 0,
    lamps: false,
    wires: false,
  },
  street: {
    arch: 16,
    upperWindows: true,
    bandSegments: 32,
    doubleBands: true,
    hangerStep: 4.5,
    diagonalStep: 4.5,
    postStep: 3,
    railSides: 6,
    courses: 0,
    rivets: 0,
    lamps: true,
    wires: true,
  },
  closeup: {
    arch: 32,
    upperWindows: true,
    bandSegments: 64,
    doubleBands: true,
    hangerStep: 4.5,
    diagonalStep: 4.5,
    postStep: 1,
    railSides: 8,
    courses: 0.9,
    rivets: 2.4,
    lamps: true,
    wires: true,
  },
  master: {
    arch: 56,
    upperWindows: true,
    bandSegments: 112,
    doubleBands: true,
    hangerStep: 4.5,
    diagonalStep: 4.5,
    postStep: 0.32,
    railSides: 12,
    courses: 0.6,
    rivets: 0.8,
    lamps: true,
    wires: true,
  },
};
function interpolate(points, x) {
  const i = points.findIndex((p) => p[0] >= x);
  if (i <= 0) return points[i === 0 ? 0 : points.length - 1][1];
  const a = points[i - 1],
    b = points[i];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}
export const grunwaldCenterZ = (x) => interpolate(data.centerline, x);
export const grunwaldDeckY = (x) => interpolate(data.deckProfile, x);
const point = (x, y, z = 0) => [x, y, grunwaldCenterZ(x) + z];
function quad(out, slot, p, color) {
  out.addQuad(
    slot,
    'palette:#ffffff',
    p,
    normalFor(p[0], p[1], p[2]),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function section(out, slot, x0, x1, yz, color) {
  let p = yz.map(([y, z]) => [x0, y, z]);
  if (normalFor(p[0], p[1], p[2])[0] < 0) p.reverse();
  loft(out, slot, [p, p.map((p) => [x1, p[1], p[2]])], color);
}
function archWall(out, slot, x0, x1, zc, base, r, raise, spring, top, n, color) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      z0 = zc - r * Math.cos(a),
      z1 = zc - r * Math.cos(b),
      y0 = base + spring + raise * Math.sin(a),
      y1 = base + spring + raise * Math.sin(b);
    section(
      out,
      slot,
      x0,
      x1,
      [
        [base + top, z0],
        [base + top, z1],
        [y1, z1],
        [y0, z0],
      ],
      color,
    );
  }
}
function archStones(out, x, zc, base, r, raise, spring, n) {
  for (const face of [-1, 1])
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * (i + 0.025)) / n,
        b = (Math.PI * (i + 0.975)) / n,
        profile = [
          [base + spring + raise * Math.sin(a), zc - r * Math.cos(a)],
          [base + spring + raise * Math.sin(b), zc - r * Math.cos(b)],
          [base + spring + (raise + 0.46) * Math.sin(b), zc - (r + 0.46) * Math.cos(b)],
          [base + spring + (raise + 0.46) * Math.sin(a), zc - (r + 0.46) * Math.cos(a)],
        ];
      section(
        out,
        'stone',
        x + face * 1.67 - 0.06,
        x + face * 1.67 + 0.06,
        profile,
        i % 3 ? C.stone : C.cap,
      );
    }
}
function rotateOut(out, angle, cx, cz) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    p = ([x, y, z]) => [cx + c * x + s * z, y, cz - s * x + c * z],
    n = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  return {
    addQuad: (slot, ref, ps, normal, uv, color) =>
      out.addQuad(slot, ref, ps.map(p), n(normal), uv, color),
    addTriangle: (slot, ref, ps, normal, uv, color) =>
      out.addTriangle(slot, ref, ps.map(p), n(normal), uv, color),
    addConvexPolygon: (slot, ref, ps, normal, uv, color) =>
      out.addConvexPolygon(slot, ref, ps.map(p), n(normal), (q) => [q[0], q[2]], color),
  };
}
function portalOut(out, base) {
  const p = (ps) => ps.map(([x, y, z]) => [x, y <= base ? y : base + (y - base) * 0.8, z]);
  return {
    addQuad: (slot, ref, ps, _normal, uv, color) => {
      const q = p(ps);
      out.addQuad(slot, ref, q, normalFor(q[0], q[1], q[2]), uv, color);
    },
    addTriangle: (slot, ref, ps, _normal, uv, color) => {
      const q = p(ps);
      out.addTriangle(slot, ref, q, normalFor(q[0], q[1], q[2]), uv, color);
    },
    addConvexPolygon: (slot, ref, ps, _normal, uv, color) => {
      const q = p(ps);
      out.addConvexPolygon(slot, ref, q, normalFor(q[0], q[1], q[2]), (v) => [v[0], v[2]], color);
    },
  };
}
function upperChamber(out, x, z, base, cfg, S) {
  if (!cfg.upperWindows) {
    box(out, S('stone'), [x - 1.65, base + 14, z - 1.45], [x + 1.65, base + 19, z + 1.45], C.stone);
    return;
  }
  box(out, 'stone', [x - 1.65, base + 14, z - 1.45], [x + 1.65, base + 14.6, z + 1.45], C.stone);
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      box(
        out,
        'stone',
        [x + a * 1.2 - 0.45, base + 14.6, z + b * 1 - 0.45],
        [x + a * 1.2 + 0.45, base + 18.8, z + b * 1 + 0.45],
        C.stone,
      );
  const n = Math.max(3, Math.floor(cfg.arch / 4));
  for (const side of [-1, 1])
    archWall(
      out,
      'stone',
      x + side * 1.4 - 0.25,
      x + side * 1.4 + 0.25,
      z,
      base,
      0.55,
      0.7,
      17.3,
      18.8,
      n,
      C.stone,
    );
  const rotated = rotateOut(out, Math.PI / 2, x, z);
  for (const side of [-1, 1])
    archWall(
      rotated,
      'stone',
      side * 1.2 - 0.25,
      side * 1.2 + 0.25,
      0,
      base,
      0.75,
      0.7,
      17.3,
      18.8,
      n,
      C.stone,
    );
}
function rustication(out, x, z, base, step) {
  if (!step) return;
  const depth = 1.65,
    width = 1.45;
  for (let y = base + 1.3, row = 0; y < base + 14 - 0.1; y += step, row++) {
    const h = Math.min(step - 0.025, base + 14 - y);
    for (const face of [-1, 1])
      for (let j = 0; j < 2; j++) {
        const zz = z - width + j * width + 0.015;
        box(
          out,
          'stone',
          [x + face * (depth + 0.026) - 0.035, y, zz],
          [x + face * (depth + 0.026) + 0.035, y + h, zz + width - 0.03],
          row % 4 ? C.stone : C.cap,
        );
        const xx = x - depth + j * depth + 0.015;
        box(
          out,
          'stone',
          [xx, y, z + face * (width + 0.026) - 0.035],
          [xx + depth - 0.03, y + h, z + face * (width + 0.026) + 0.035],
          row % 4 ? C.stone : C.cap,
        );
      }
  }
}
function portal(out, x, cfg, S) {
  const base = grunwaldDeckY(x),
    center = grunwaldCenterZ(x);
  for (const sign of [-1, 1]) {
    const z = center + sign * 9.45;
    if (cfg.far) box(out, 'far', [x - 1.8, 0, z - 1.6], [x + 1.8, base + 14, z + 1.6], C.stone);
    else {
      box(out, 'stone', [x - 2.2, 0, z - 1.95], [x + 2.2, base + 0.55, z + 1.95], C.stone);
      box(out, 'stone', [x - 1.9, base + 0.55, z - 1.7], [x + 1.9, base + 1.2, z + 1.7], C.cap);
      box(out, 'stone', [x - 1.65, base + 1.2, z - 1.45], [x + 1.65, base + 14, z + 1.45], C.stone);
    }
    upperChamber(out, x, z, base, cfg, S);
    box(
      out,
      S('stone'),
      [x - 1.8, base + 18.8, z - 1.6],
      [x + 1.8, base + 19.35, z + 1.6],
      C.stone,
    );
    box(
      out,
      S('stone'),
      [x - 1.95, base + 19.35, z - 1.75],
      [x + 1.95, base + 20, z + 1.75],
      C.cap,
    );
    rustication(out, x, z, base, cfg.courses);
    if (cfg.lamps) {
      const arm = [
        point(x - 1.85, base + 6, sign * 8.3),
        point(x - 2.6, base + 6, sign * 8.3),
        point(x - 2.8, base + 5.6, sign * 8.3),
      ];
      tubePath(out, 'steel', arm, 0.06, C.blue, cfg.railSides);
      box(
        out,
        'paint',
        [x - 3, base + 5.25, z - sign * 1.3 - 0.18],
        [x - 2.6, base + 5.55, z - sign * 1.3 + 0.18],
        C.lamp,
      );
    }
    if (cfg === cfgs.master)
      tubePath(
        out,
        'steel',
        [
          [x, base + 20, z],
          [x, base + 22, z],
        ],
        0.024,
        C.rail,
        6,
      );
  }
  archWall(out, S('stone'), x - 1.65, x + 1.65, center, base, 8, 6.2, 9, 18.7, cfg.arch, C.stone);
  box(
    out,
    S('stone'),
    [x - 1.85, base + 18.7, center - 8],
    [x + 1.85, base + 19.1, center + 8],
    C.cap,
  );
  if (cfg.courses) {
    archStones(out, x, center, base, 8, 6.2, 9, cfg.arch);
    for (const face of [-1, 1])
      for (let z = -7.5; z < 8; z += 0.95)
        box(
          out,
          'stone',
          [x + face * 1.71 - 0.07, base + 16.3, center + z - 0.14],
          [x + face * 1.71 + 0.07, base + 18.25, center + z + 0.14],
          C.cap,
        );
  }
}
export function grunwaldBandY(x) {
  const H = 63.3;
  if (Math.abs(x) <= H) return grunwaldDeckY(x) + 2.56 + 10.88 * (x / H) ** 2;
  const t = (Math.abs(x) - H) / (88 - H),
    deck = grunwaldDeckY(Math.sign(x) * H);
  return deck + 13.44 + (grunwaldDeckY(Math.sign(x) * 88) + 0.7 - deck - 13.44) * t;
}
function bands(out, cfg, S) {
  const xs = [
    -88,
    -63.3,
    ...Array.from(
      { length: cfg.bandSegments - 1 },
      (_, i) => -63.3 + ((i + 1) * 126.6) / cfg.bandSegments,
    ),
    63.3,
    88,
  ];
  for (const sign of [-1, 1])
    for (const offset of cfg.doubleBands ? [-0.22, 0.22] : [0]) {
      for (let i = 1; i < xs.length; i++) {
        const x0 = xs[i - 1],
          x1 = xs[i],
          z0 = grunwaldCenterZ(x0) + sign * 9.45 + offset,
          z1 = grunwaldCenterZ(x1) + sign * 9.45 + offset,
          y0 = grunwaldBandY(x0),
          y1 = grunwaldBandY(x1);
        loft(
          out,
          S('steel'),
          [
            [
              [x0, y0 + 0.19, z0 - 0.055],
              [x0, y0 + 0.19, z0 + 0.055],
              [x0, y0 - 0.19, z0 + 0.055],
              [x0, y0 - 0.19, z0 - 0.055],
            ],
            [
              [x1, y1 + 0.19, z1 - 0.055],
              [x1, y1 + 0.19, z1 + 0.055],
              [x1, y1 - 0.19, z1 + 0.055],
              [x1, y1 - 0.19, z1 - 0.055],
            ],
          ],
          C.blue,
        );
      }
    }
  for (const sign of [-1, 1]) {
    for (let x = -54; x < 55; x += cfg.hangerStep) {
      const z = sign * 9.45,
        y = grunwaldBandY(x);
      beam(
        out,
        S('steel'),
        point(x, grunwaldDeckY(x) - 0.9, z),
        point(x, y - 0.15, z),
        cfg.far ? 0.14 : 0.11,
        0.12,
        C.blue,
      );
      if (cfg.doubleBands) {
        box(
          out,
          'steel',
          point(x - 0.18, y - 0.12, z - 0.35),
          point(x + 0.18, y + 0.13, z + 0.35),
          C.blue,
        );
      }
    }
    for (const x of [-88, 88])
      box(
        out,
        S('steel'),
        point(x - 1.3, grunwaldDeckY(x) - 0.3, sign * 9.45 - 0.6),
        point(x + 1.3, grunwaldDeckY(x) + 0.6, sign * 9.45 + 0.6),
        C.darkBlue,
      );
    if (cfg.rivets)
      for (let x = -86; x < 87; x += cfg.rivets) {
        const y = grunwaldBandY(x);
        for (const offset of [-0.29, 0.29])
          for (const h of [-0.105, 0.105])
            box(
              out,
              'steel',
              point(x - 0.035, y + h - 0.035, sign * 9.45 + offset - 0.025),
              point(x + 0.035, y + h + 0.035, sign * 9.45 + offset + 0.025),
              C.blue,
            );
      }
  }
}
function deck(out, cfg, S) {
  const xs = [-88, -63.3, -56.25, 0, 56.25, 63.3, 88];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    for (const [slot, lo, hi, rise, color] of [
      [S('road'), -5.5, 5.5, 0, C.road],
      [S('walk'), -9, -5.5, 0.15, C.walk],
      [S('walk'), 5.5, 9, 0.15, C.walk],
    ]) {
      const ring = (x) => {
        const y = grunwaldDeckY(x) + rise;
        return [point(x, y, lo), point(x, y, hi), point(x, y - 0.75, hi), point(x, y - 0.75, lo)];
      };
      loft(out, slot, [ring(a), ring(b)], color);
    }
  }
  for (const sign of [-1, 1]) {
    const z = sign * 9.45;
    for (const h of [-1.6, -0.1])
      beam(
        out,
        S('steel'),
        point(-56.25, grunwaldDeckY(-56.25) + h, z),
        point(56.25, grunwaldDeckY(56.25) + h, z),
        0.2,
        0.22,
        C.blue,
      );
    if (cfg.diagonalStep)
      for (let x = -56.25; x < 56.2; x += cfg.diagonalStep) {
        const q = Math.min(56.25, x + cfg.diagonalStep),
          mid = (x + q) / 2;
        beam(
          out,
          'steel',
          point(x, grunwaldDeckY(x) - 1.5, z),
          point(mid, grunwaldDeckY(mid) - 0.2, z),
          0.16,
          0.18,
          C.blue,
        );
        beam(
          out,
          'steel',
          point(mid, grunwaldDeckY(mid) - 0.2, z),
          point(q, grunwaldDeckY(q) - 1.5, z),
          0.16,
          0.18,
          C.blue,
        );
      }
    if (cfg.far) continue;
    for (const h of [0.55, 1.15])
      for (const ends of [
        [-88, -65.5],
        [-61.1, 0, 61.1],
        [65.5, 88],
      ])
        tubePath(
          out,
          'rail',
          ends.map((x) => point(x, grunwaldDeckY(x) + h, sign * 8.65)),
          0.038,
          C.rail,
          cfg.railSides,
        );
    for (let x = -86; x < 87; x += cfg.postStep) {
      if (Math.abs(Math.abs(x) - 63.3) < 2.2) continue;
      box(
        out,
        'steel',
        point(x - 0.025, grunwaldDeckY(x) + 0.15, sign * 8.65 - 0.025),
        point(x + 0.025, grunwaldDeckY(x) + 1.15, sign * 8.65 + 0.025),
        C.blue,
      );
    }
  }
  if (!cfg.far)
    for (let x = -54; x < 55; x += cfg.diagonalStep || 20)
      beam(
        out,
        'steel',
        point(x, grunwaldDeckY(x) - 0.65, -9.45),
        point(x, grunwaldDeckY(x) - 0.65, 9.45),
        0.2,
        0.55,
        C.blue,
      );
  // Two mapped tram track centerlines, each with a standard1.435m pair of rails.
  for (const line of data.tramCenterlines)
    for (const offset of [-0.7175, 0.7175])
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i],
          p = [a[0], grunwaldDeckY(a[0]) + 0.035, a[1] + offset],
          q = [b[0], grunwaldDeckY(b[0]) + 0.035, b[1] + offset];
        if (cfg.far) continue;
        beam(out, 'rail', p, q, 0.065, 0.06, C.rail);
      }
  if (cfg.wires) {
    for (const sign of [-1, 1])
      tubePath(
        out,
        'steel',
        xs.map((x) => point(x, grunwaldDeckY(x) + 5.9, sign * 1.6)),
        0.014,
        C.rail,
        4,
      );
    for (const x of [-47, 0, 47]) {
      for (const sign of [-1, 1]) {
        tubePath(
          out,
          'steel',
          [
            point(x, grunwaldDeckY(x) + 0.15, sign * 7.9),
            point(x, grunwaldDeckY(x) + 6.7, sign * 7.9),
          ],
          0.065,
          C.blue,
          cfg.railSides,
        );
        box(
          out,
          'paint',
          point(x - 0.16, grunwaldDeckY(x) + 6.7, sign * 7.9 - 0.16),
          point(x + 0.16, grunwaldDeckY(x) + 7, sign * 7.9 + 0.16),
          C.lamp,
        );
      }
      beam(
        out,
        'steel',
        point(x, grunwaldDeckY(x) + 6.2, -7.9),
        point(x, grunwaldDeckY(x) + 6.2, 7.9),
        0.026,
        0.026,
        C.rail,
      );
    }
  }
}
export function buildGrunwaldLevel(out, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Grunwald tier ' + level);
  const S = (s) => (cfg.far ? 'far' : s);
  for (const x of [-63.3, 63.3]) portal(portalOut(out, grunwaldDeckY(x)), x, cfg, S);
  deck(out, cfg, S);
  bands(out, cfg, S);
}
export const buildGrunwaldSkyline = (out) => buildGrunwaldLevel(out, 'skyline');
export const buildGrunwaldDistrict = (out) => buildGrunwaldLevel(out, 'district');
export const buildGrunwaldStreet = (out) => buildGrunwaldLevel(out, 'street');
export const buildGrunwaldCloseup = (out) => buildGrunwaldLevel(out, 'closeup');
