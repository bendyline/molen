/** Original Malo-Kalinkin Bridge: skew three-span green girders, granite drums and obelisk lanterns. */
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const maloControls = {
  west: -11.7,
  east: 11.8,
  halfWidth: 8.1,
  roadHalfWidth: 5.85,
  skew: -0.138,
  piers: [-4.35, 4.35],
  deckEnds: [3.55, 3.62],
  crown: 0.12,
};
export const maloSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.92 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.64 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
  gold: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.5 },
};
const C = maloControls,
  linear = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  col = {
    stone: linear('a4917e'),
    iron: linear('526b55'),
    road: linear('6c6c65'),
    paving: linear('b8b0a2'),
    glass: linear('d9d5c1'),
    gold: linear('ae923b'),
  },
  tiers = {
    skyline: {
      deck: 2,
      pier: 6,
      girders: 2,
      girder: 3,
      rail: 0,
      ornament: 0,
      obelisk: 0,
      stones: 0,
    },
    district: {
      deck: 4,
      pier: 8,
      girders: 2,
      girder: 6,
      rail: 4,
      ornament: 0,
      obelisk: 1,
      stones: 0,
    },
    street: {
      deck: 8,
      pier: 12,
      girders: 4,
      girder: 16,
      rail: 12,
      ornament: 1,
      obelisk: 2,
      stones: 0,
    },
    closeup: {
      deck: 16,
      pier: 24,
      girders: 6,
      girder: 32,
      rail: 24,
      ornament: 2,
      obelisk: 3,
      stones: 1,
    },
    master: {
      deck: 32,
      pier: 48,
      girders: 8,
      girder: 64,
      rail: 30,
      ornament: 3,
      obelisk: 4,
      stones: 2,
    },
  };
export const maloDeckY = (x) => {
  const t = Math.max(0, Math.min(1, (x - C.west) / (C.east - C.west)));
  return C.deckEnds[0] + (C.deckEnds[1] - C.deckEnds[0]) * t + C.crown * Math.sin(Math.PI * t);
};
const P = (x, y, z) => [x + C.skew * z, y, z];
function writer(target, far) {
  return Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, color) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]],
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((v) =>
              Math.abs(n[1]) > 0.5
                ? [v[0], v[2]]
                : Math.abs(n[0]) > 0.5
                  ? [v[2], v[1]]
                  : [v[0], v[1]],
            ),
            color,
          );
        }
      },
    ]),
  );
}
function slab(o, slot, x0, x1, z0, z1, bottom, top, color, n) {
  loft(
    o,
    slot,
    Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      return [P(x, bottom(x), z0), P(x, top(x), z0), P(x, top(x), z1), P(x, bottom(x), z1)];
    }),
    color,
  );
}
function b(o, slot, lo, hi, color) {
  const proxy = {
    addQuad: (s, r, ps, n, uv, c) =>
      o.addQuad(
        s,
        r,
        ps.map((p) => P(...p)),
        n,
        uv,
        c,
      ),
  };
  box(proxy, slot, lo, hi, color);
}
function capsule(x, y, w, z, n) {
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n;
    ring.push(P(x + w * Math.cos(a), y, z + w * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI * i) / n;
    ring.push(P(x + w * Math.cos(a), y, -z + w * Math.sin(a)));
  }
  return ring.reverse();
}
function obelisk(o, x, z, S) {
  const y = maloDeckY(x) + 0.18,
    post = P(x, y, z),
    ring = (h, w) =>
      [
        [-w / 2, -w / 2],
        [-w / 2, w / 2],
        [w / 2, w / 2],
        [w / 2, -w / 2],
      ].map(([a, b]) => P(x + a, y + h, z + b));
  if (!S.obelisk) {
    loft(o, 'stone', [ring(0, 0.8), ring(3.6, 0.3)], col.stone);
    return;
  }
  loft(
    o,
    'stone',
    [
      ring(0, 1.35),
      ring(0.2, 1.35),
      ring(0.3, 1.1),
      ring(0.65, 0.88),
      ring(1.18, 0.74),
      ring(1.27, 1.15),
      ring(1.45, 1.15),
      ring(1.55, 0.76),
      ring(3.7, 0.49),
      ring(3.78, 0.7),
    ],
    col.stone,
  );
  if (S.obelisk >= 2) {
    for (const side of [-1, 1])
      beamPath(
        o,
        'stone',
        [
          [post[0] + side * 0.5, y + 0.3, z],
          [post[0] + side * 0.33, y + 0.5, z],
          [post[0] + side * 0.24, y + 0.85, z],
          [post[0] + side * 0.4, y + 1.17, z],
        ],
        0.14,
        0.55,
        col.stone,
      );
  }
  const side = Math.sign(z),
    xx = x + C.skew * z,
    zz = z + side * 0.72;
  beamPath(
    o,
    'iron',
    [
      [xx, y + 3.54, z],
      [xx, y + 3.58, z + side * 0.4],
      [xx, y + 3.38, zz],
      [xx, y + 3.1, zz],
    ],
    0.055,
    0.06,
    col.iron,
  );
  const n = S.obelisk >= 4 ? 20 : S.obelisk >= 3 ? 12 : 6;
  sphere(o, 'glass', [xx, y + 2.88, zz], [0.22, 0.34, 0.22], col.glass, n, S.obelisk >= 3 ? 8 : 4);
  loft(
    o,
    'iron',
    [
      [2.5, 0.21],
      [2.59, 0.25],
      [2.63, 0.18],
    ].map(([h, r]) => radialRing(y + h, r, r, n, [xx, zz])),
    col.iron,
  );
  loft(
    o,
    'iron',
    [
      [3.16, 0.23],
      [3.23, 0.17],
      [3.32, 0.07],
    ].map(([h, r]) => radialRing(y + h, r, r, n, [xx, zz])),
    col.iron,
  );
  sphere(o, 'gold', [xx, y + 3.9, z], [0.09, 0.14, 0.09], col.gold, n, 4);
  if (S.obelisk >= 3)
    for (let k = 0; k < 4; k++) {
      const a = (Math.PI * k) / 2;
      beam(
        o,
        'iron',
        [xx + 0.18 * Math.cos(a), y + 2.6, zz + 0.18 * Math.sin(a)],
        [xx + 0.18 * Math.cos(a), y + 3.18, zz + 0.18 * Math.sin(a)],
        0.02,
        0.02,
        col.iron,
      );
    }
}
function rail(o, z, S) {
  if (!S.rail) return;
  const a = C.west + 0.15,
    b = C.east - 0.15,
    n = S.rail,
    step = (b - a) / n;
  for (const h of [0.25, 1.19])
    beamPath(
      o,
      'iron',
      Array.from({ length: S.deck + 1 }, (_, i) => {
        const x = a + ((b - a) * i) / S.deck;
        return P(x, maloDeckY(x) + h, z);
      }),
      0.065,
      0.075,
      col.iron,
    );
  for (let i = 0; i <= n; i++) {
    const x = a + i * step,
      y = maloDeckY(x);
    beam(o, 'iron', P(x, y + 0.2, z), P(x, y + 1.28, z), 0.05, 0.05, col.iron);
    if (i === n || !S.ornament) continue;
    const mid = x + step / 2;
    if (S.ornament === 1) {
      const ps = Array.from({ length: 7 }, (_, k) =>
        P(
          mid + step * 0.32 * Math.cos((Math.PI * k) / 3),
          y + 0.91 + 0.22 * Math.sin((Math.PI * k) / 3),
          z,
        ),
      );
      beamPath(o, 'iron', ps, 0.035, 0.035, col.iron);
    } else {
      for (const zz of [0]) {
        const ps = Array.from({ length: S.ornament === 3 ? 17 : 9 }, (_, k) => {
          const count = S.ornament === 3 ? 16 : 8,
            a = (2 * Math.PI * k) / count;
          return P(mid + step * 0.29 * Math.cos(a), y + 0.89 + 0.19 * Math.sin(a), z + zz);
        });
        beamPath(o, 'iron', ps, 0.035, 0.035, col.iron);
      }
      for (const dx of [-0.25, 0.25]) {
        const pts = Array.from({ length: 9 }, (_, k) => {
          const t = k / 8;
          return P(
            mid + step * dx + step * 0.12 * Math.sin(t * Math.PI * 2),
            y + 0.3 + 0.48 * t,
            z,
          );
        });
        beamPath(o, 'iron', pts, 0.025, 0.025, col.iron);
      }
      beam(o, 'iron', P(mid, y + 0.29, z), P(mid, y + 1.17, z), 0.032, 0.032, col.iron);
    }
  }
}
export function buildMaloLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error(level);
  const o = writer(target, level === 'skyline'),
    D = maloDeckY;
  slab(
    o,
    'road',
    C.west,
    C.east,
    -C.roadHalfWidth,
    C.roadHalfWidth,
    (x) => D(x) - 0.35,
    D,
    col.road,
    S.deck,
  );
  for (const side of [-1, 1]) {
    slab(
      o,
      'paving',
      C.west,
      C.east,
      side < 0 ? -8.1 : 5.85,
      side < 0 ? -5.85 : 8.1,
      (x) => D(x) - 0.35,
      (x) => D(x) + 0.18,
      col.paving,
      S.deck,
    );
    rail(o, side * 7.95, S);
  }
  const ends = [C.west, ...C.piers, C.east];
  for (let j = 0; j < S.girders; j++) {
    const z = -6.9 + (13.8 * j) / (S.girders - 1);
    for (let k = 1; k < ends.length; k++) {
      const a = ends[k - 1],
        b = ends[k];
      slab(
        o,
        'iron',
        a,
        b,
        z - 0.12,
        z + 0.12,
        (x) => D(x) - 0.86 + 0.09 * Math.abs(Math.sin((3 * Math.PI * (x - a)) / (b - a))),
        (x) => D(x) - 0.31,
        col.iron,
        S.girder,
      );
      if (S.obelisk >= 2) {
        slab(
          o,
          'iron',
          a,
          b,
          z - 0.19,
          z + 0.19,
          (x) => D(x) - 0.88 + 0.09 * Math.abs(Math.sin((3 * Math.PI * (x - a)) / (b - a))),
          (x) => D(x) - 0.82 + 0.09 * Math.abs(Math.sin((3 * Math.PI * (x - a)) / (b - a))),
          col.iron,
          S.girder,
        );
      }
    }
  }
  for (const x of C.piers) {
    loft(
      o,
      'stone',
      [capsule(x, -0.6, 1.24, 7.7, S.pier), capsule(x, D(x) - 0.33, 1.16, 7.7, S.pier)],
      col.stone,
    );
    for (const side of [-1, 1]) {
      const z = side * 8.0;
      // The drum coping carries the obelisk outside the sidewalk edge.
      loft(
        o,
        'stone',
        [D(x) - 0.33, D(x) + 0.18].map((y) =>
          radialRing(y, 1.18, 1.18, 2 * S.pier, [x, side * 7.7]).map((p) => P(...p)),
        ),
        col.stone,
      );
      obelisk(o, x, z, S);
      if (S.stones) {
        for (let y = 0.12; y < D(x) - 0.36; y += 0.56) {
          const radius = 1.24 + ((1.16 - 1.24) * (y + 0.6)) / (D(x) + 0.27);
          const ring = capsule(x, y, radius + 0.002, 7.7, S.pier);
          beamPath(o, 'stone', [...ring, ring[0]], 0.02, 0.02, col.road);
        }
      }
    }
  }
  for (const x of [C.west + 0.55, C.east - 0.55])
    slab(
      o,
      'stone',
      x - 0.5,
      x + 0.5,
      -8.3,
      8.3,
      () => -0.6,
      (t) => D(t) - 0.33,
      col.stone,
      1,
    );
  if (level !== 'skyline') {
    for (const center of [-1.55, 1.55])
      for (const d of [-0.762, 0.762])
        slab(
          o,
          'iron',
          C.west,
          C.east,
          center + d - 0.035,
          center + d + 0.035,
          D,
          (x) => D(x) + 0.025,
          col.iron,
          S.deck,
        );
  }
  if (S.stones > 1)
    for (let x = C.west + 0.5; x < C.east; x += 1.2)
      for (const z of [-7.95, 7.95]) {
        const y = D(x) - 0.56;
        for (const zz of [-0.14, 0.14])
          b(
            o,
            'iron',
            [x - 0.035, y, z + zz - 0.025],
            [x + 0.035, y + 0.11, z + zz + 0.025],
            col.iron,
          );
      }
}
export const buildMaloSkyline = (o) => buildMaloLevel(o, 'skyline');
export const buildMaloDistrict = (o) => buildMaloLevel(o, 'district');
export const buildMaloStreet = (o) => buildMaloLevel(o, 'street');
export const buildMaloCloseup = (o) => buildMaloLevel(o, 'closeup');
