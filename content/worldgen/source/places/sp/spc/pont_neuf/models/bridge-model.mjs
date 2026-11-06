import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Individual controls come from the retained OSM outline, the current viewer
// map and two ordinary exterior photographs. Heights/sections are approximate.
export const bridgeControls = {
  anchor: [1.439072886, 43.599348416],
  heading: 0.239318600245,
  datum: 134,
  deck: 146.1,
  length: 222.892,
  width: 41.265,
  ends: [-112.3, 112.4],
  frontLeft: [-96.471, -72.974, -43.934, -8.389, 31.544, 72.6],
  frontRight: [-89.157, -65.472, -36.299, 0.035, 43.131, 83.482],
  backLeft: [-96.9, -73.981, -45.606, -9.112, 31.466, 72.065],
  backRight: [-89.544, -66.596, -37.702, -0.28, 43.054, 83.334],
  frontTips: [
    [-92.776, 20.632],
    [-69.034, 20.421],
    [-39.513, 20.061],
    [-3.971, 20.632],
    [37.736, 20.083],
    [78.093, 20.614],
  ],
  backTips: [
    [-93.222, -17.026],
    [-70.523, -16.598],
    [-42.255, -20.632],
    [-4.649, -16.991],
    [37.513, -18.793],
    [77.475, -18.174],
  ],
};
export const deckY = (x) =>
  9.5 + (2 * (x + 111.1)) / 222.2 + 1.6 * Math.max(0, 1 - (x * x) / (112 * 112));
const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  brick: { slot: 'wall', graph: 'brick', rgb: srgb('#d19a80') },
  stone: { slot: 'wall', graph: 'stone_limestone', rgb: srgb('#e2d6bf') },
  trim: { slot: 'trim', graph: 'stone_limestone', rgb: srgb('#dfd7c7') },
  base: { slot: 'foundation', graph: 'stone_granite', rgb: srgb('#beb69e') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#777a77') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#bdb5a5') },
  cycle: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#9b9386') },
  metal: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#4b4d49') },
  marker: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#e7b52a') },
  glass: { slot: 'window', graph: 'concrete_plain', rgb: srgb('#e4d9b7') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const frontZ = (x) => 12.64 - (x + 111.1) * 0.0085 + Math.max(0, x - 100.5) * 0.35;
const backZ = (x) => -9.35 - (x + 111.1) * 0.0064 - Math.max(0, x - 101.5) * 0.335;
const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, [x, y - h / 2, z], [x, y + h / 2, z], d, w);
function face(o, m, p, n, color = palette[m].rgb) {
  let N = normalFor(...p);
  if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    N = normalFor(...p);
  }
  o[p.length === 3 ? 'addTriangle' : 'addQuad'](m, 'palette:#ffffff', p, N, undefined, color);
}
function sideCap(o, m, outer, holes, z, sign) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'wall',
      'palette:#ffffff',
      outer,
      holes,
      () => 0,
      [0, 1, 0],
      (p) => p,
      palette[m].rgb,
    )
  )
    throw Error('Invalid pierced bridge wall');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) => {
      const x = mesh.positions[j * 3],
        y = mesh.positions[j * 3 + 2];
      return [x, y, typeof z === 'function' ? z(x) : z];
    });
    face(o, m, points, [0, 0, sign]);
  }
}
function shield(cx, bottom, top, w, t) {
  if (t === 0)
    return [
      [cx - w * 0.38, top],
      [cx + w * 0.38, top],
      [cx + w / 2, top - 0.6],
      [cx + w * 0.44, bottom + 0.76],
      [cx, bottom],
      [cx - w * 0.44, bottom + 0.76],
      [cx - w / 2, top - 0.6],
    ];
  const p = [
    [cx - w * 0.28, top],
    [cx + w * 0.28, top],
    [cx + w * 0.45, top - 0.28],
    [cx + w / 2, top - 0.65],
    [cx + w * 0.46, bottom + 1.0],
    [cx + w * 0.3, bottom + 0.3],
    [cx, bottom],
    [cx - w * 0.3, bottom + 0.3],
    [cx - w * 0.46, bottom + 1.0],
    [cx - w / 2, top - 0.65],
    [cx - w * 0.45, top - 0.28],
  ];
  return p;
}
function pier(o, t, i) {
  const C = bridgeControls,
    L = C.frontLeft[i],
    R = C.frontRight[i],
    l = C.backLeft[i],
    r = C.backRight[i],
    f = (L + R) / 2,
    b = (l + r) / 2;
  const zf = frontZ(f),
    zb = backZ(b),
    bottom = 3.45,
    top = Math.min(deckY(f), deckY(b)) - 2.02,
    w = Math.min(R - L, r - l) * 0.44;
  const holeF = shield(f, bottom, top, w, t),
    holeB = shield(b, bottom, top, w, t);
  const outer = (a, c) => [
    [a, -3],
    [c, -3],
    [c, deckY(c) - 0.16],
    [a, deckY(a) - 0.16],
  ];
  sideCap(o, 'brick', outer(L, R), [holeF], frontZ, 1);
  sideCap(o, 'brick', outer(l, r), [holeB], backZ, -1);
  for (let j = 0; j < holeF.length; j++) {
    const k = (j + 1) % holeF.length,
      a = holeF[j],
      c = holeF[k],
      A = holeB[j],
      B = holeB[k],
      n = [f - (a[0] + c[0]) / 2, (bottom + top) / 2 - (a[1] + c[1]) / 2, 0];
    face(
      o,
      'stone',
      [
        [a[0], a[1], frontZ(a[0])],
        [c[0], c[1], frontZ(c[0])],
        [B[0], B[1], backZ(B[0])],
        [A[0], A[1], backZ(A[0])],
      ],
      n,
    );
  }
  for (const [a, A, sign] of [
    [L, l, -1],
    [R, r, 1],
  ])
    face(
      o,
      'stone',
      [
        [a, -3, frontZ(a)],
        [A, -3, backZ(A)],
        [A, deckY(A) - 0.16, backZ(A)],
        [a, deckY(a) - 0.16, frontZ(a)],
      ],
      [sign, 0, 0],
    );
  // Cutwaters project only below the relief openings, with real triangular tips.
  for (const [a, c, z, tip, sign] of [
    [L, R, zf, C.frontTips[i], 1],
    [l, r, zb, C.backTips[i], -1],
  ]) {
    const Z = sign > 0 ? frontZ : backZ,
      poly = [[a, Z(a)], [c, Z(c)], tip],
      base = -3,
      cap = bottom - 0.34;
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3,
        A = poly[j],
        B = poly[k];
      face(
        o,
        'base',
        [
          [A[0], base, A[1]],
          [B[0], base, B[1]],
          [B[0], cap, B[1]],
          [A[0], cap, A[1]],
        ],
        [B[1] - A[1], 0, A[0] - B[0]],
      );
    }
    face(
      o,
      'base',
      poly.map(([x, z]) => [x, cap, z]),
      [0, 1, 0],
    );
    if (t > 0)
      for (const y of [0.3, 2.62]) {
        const center = [(a + c + tip[0]) / 3, (2 * z + tip[1]) / 3],
          scale = y === 0.3 ? 1.04 : 1.01;
        const edge = poly.map(([x, z]) => [
          center[0] + (x - center[0]) * scale,
          center[1] + (z - center[1]) * scale,
        ]);
        for (let j = 0; j < 3; j++) {
          const k = (j + 1) % 3,
            A = edge[j],
            B = edge[k];
          rod(o, 'stone', [A[0], y, A[1]], [B[0], y, B[1]], 0.24, 0.24);
        }
      }
    if (t > 0) {
      // Pale stone frame follows the actual shield opening; its interior stays open.
      const hole = sign > 0 ? holeF : holeB,
        cx = sign > 0 ? f : b,
        cy = (bottom + top) / 2;
      const expanded = hole.map(([x, y]) => [cx + (x - cx) * 1.32, cy + (y - cy) * 1.18]);
      for (let j = 0; j < hole.length; j++) {
        const k = (j + 1) % hole.length;
        face(
          o,
          'stone',
          [hole[j], hole[k], expanded[k], expanded[j]].map(([x, y]) => [x, y, Z(x) + sign * 0.035]),
          [0, 0, sign],
        );
      }
    }
  }
}
const span = (i, back = false) => {
  const C = bridgeControls,
    left = back ? C.backRight : C.frontRight,
    right = back ? C.backLeft : C.frontLeft;
  return [i === 0 ? -111.12 : left[i - 1], i === 6 ? 111.2 : right[i]];
};
export const archProfile = (i, u) => {
  const [a, b] = span(i),
    center = (a + b) / 2,
    half = (b - a) / 2,
    rise = Math.min(half * 0.95, deckY(center) - 1.75);
  return 0.42 + rise * Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
};
function arches(o, t) {
  const n = [4, 8, 16, 24, 32][t];
  for (let i = 0; i < 7; i++) {
    const [a, b] = span(i),
      [A, B] = span(i, true);
    for (let j = 0; j < n; j++) {
      const u = j / n,
        v = (j + 1) / n,
        xf = a + (b - a) * u,
        Xf = a + (b - a) * v,
        xb = A + (B - A) * u,
        Xb = A + (B - A) * v,
        y = archProfile(i, u),
        Y = archProfile(i, v);
      const pf = [
        [xf, y, frontZ(xf)],
        [Xf, Y, frontZ(Xf)],
        [Xf, deckY(Xf) - 0.16, frontZ(Xf)],
        [xf, deckY(xf) - 0.16, frontZ(xf)],
      ];
      const pb = [
        [xb, y, backZ(xb)],
        [Xb, Y, backZ(Xb)],
        [Xb, deckY(Xb) - 0.16, backZ(Xb)],
        [xb, deckY(xb) - 0.16, backZ(xb)],
      ];
      face(o, 'brick', pf, [0, 0, 1]);
      face(o, 'brick', pb, [0, 0, -1]);
      const material = t > 0 && j % 4 === 0 ? 'stone' : 'brick';
      face(
        o,
        material,
        [
          [xf, y, frontZ(xf)],
          [xb, y, backZ(xb)],
          [Xb, Y, backZ(Xb)],
          [Xf, Y, frontZ(Xf)],
        ],
        [0, -1, 0],
      );
      if (t > 0) {
        for (const p of [pf, pb]) {
          const side = p === pf ? 1 : -1,
            z0 = p[0][2] + side * 0.04,
            z1 = p[1][2] + side * 0.04,
            half = (p === pf ? b - a : B - A) / 2,
            rise = archProfile(i, 0.5) - 0.42;
          const outer = (x, y, u) => {
            const q = 2 * u - 1,
              n = [q / half, Math.sqrt(Math.max(0, 1 - q * q)) / rise],
              L = Math.hypot(...n);
            return [x + (n[0] / L) * 0.95, y + (n[1] / L) * 0.95];
          };
          const O = outer(p[0][0], y, u),
            Q = outer(p[1][0], Y, v);
          face(
            o,
            'stone',
            [
              [p[0][0], y, z0],
              [p[1][0], Y, z1],
              [...Q, z1],
              [...O, z0],
            ],
            [0, 0, side],
            palette.stone.rgb.map((c) => c * (j % 4 === 1 ? 0.93 : 1)),
          );
          if (t > 1) {
            rod(
              o,
              'stone',
              [p[0][0], y, z0 + side * 0.012],
              [...O, z0 + side * 0.012],
              0.035,
              0.035,
            );
          }
        }
      }
    }
    if (t > 0)
      for (const side of [-1, 1]) {
        const x = ((side > 0 ? a : A) + (side > 0 ? b : B)) / 2,
          z = (side > 0 ? frontZ(x) : backZ(x)) + side * 0.11,
          y = archProfile(i, 0.5) - 0.57;
        const diamond = [
          [x, y + 0.43],
          [x + 0.3, y],
          [x, y - 0.43],
          [x - 0.3, y],
        ];
        for (const offset of [-0.025, 0.025])
          face(
            o,
            'marker',
            diamond.map(([x, y]) => [x, y, z + offset]),
            [0, 0, Math.sign(offset)],
          );
        rod(o, 'metal', [x, y + 0.43, z], [x, archProfile(i, 0.5) + 0.02, z], 0.035, 0.035);
      }
  }
}
function endSupports(o) {
  for (const side of [-1, 1]) {
    const a = side < 0 ? -112.3 : 111.2,
      b = side < 0 ? -111.12 : 112.4;
    for (const sign of [-1, 1]) {
      const z = sign > 0 ? frontZ : backZ;
      face(
        o,
        'stone',
        [
          [a, -3, z(a)],
          [b, -3, z(b)],
          [b, deckY(b), z(b)],
          [a, deckY(a), z(a)],
        ],
        [0, 0, sign],
      );
    }
    const x = side < 0 ? a : b;
    face(
      o,
      'base',
      [
        [x, -3, backZ(x)],
        [x, -3, frontZ(x)],
        [x, deckY(x), frontZ(x)],
        [x, deckY(x), backZ(x)],
      ],
      [side, 0, 0],
    );
  }
}
function deck(o, t) {
  const C = bridgeControls,
    n = [6, 12, 24, 36, 48][t];
  for (let i = 0; i < n; i++) {
    const a = C.ends[0] + ((C.ends[1] - C.ends[0]) * i) / n,
      b = C.ends[0] + ((C.ends[1] - C.ends[0]) * (i + 1)) / n,
      y = deckY(a),
      Y = deckY(b),
      fa = frontZ(a),
      fb = frontZ(b),
      ba = backZ(a),
      bb = backZ(b);
    face(
      o,
      'road',
      [
        [a, y, ba],
        [b, Y, bb],
        [b, Y, fb],
        [a, y, fa],
      ],
      [0, 1, 0],
    );
    if (t > 0) {
      face(
        o,
        'cycle',
        [
          [a, y + 0.004, 2.3],
          [b, Y + 0.004, 2.3],
          [b, Y + 0.004, 5.75],
          [a, y + 0.004, 5.75],
        ],
        [0, 1, 0],
      );
      for (const sign of [-1, 1]) {
        const za = sign > 0 ? fa : ba,
          zb = sign > 0 ? fb : bb,
          inner = sign > 0 ? 5.9 : -5.0,
          h = (x) => 0.15 * Math.min(1, Math.max(0, Math.min(x - C.ends[0], C.ends[1] - x) / 1.6));
        face(
          o,
          'walk',
          [
            [a, y + h(a), inner],
            [b, Y + h(b), inner],
            [b, Y + h(b), zb],
            [a, y + h(a), za],
          ],
          [0, 1, 0],
        );
      }
    }
    for (const sign of [-1, 1]) {
      const za = sign > 0 ? fa : ba,
        zb = sign > 0 ? fb : bb,
        points = [
          [a, y - 0.16, za],
          [b, Y - 0.16, zb],
          [b, Y + 1.02, zb],
          [a, y + 1.02, za],
        ];
      face(o, 'stone', points, [0, 0, sign]);
      face(
        o,
        'stone',
        points.map(([x, y, z]) => [x, y, z - sign * 0.54]),
        [0, 0, -sign],
      );
      face(
        o,
        'trim',
        [
          [a, y + 1.02, za + sign * 0.1],
          [b, Y + 1.02, zb + sign * 0.1],
          [b, Y + 1.02, zb - sign * 0.66],
          [a, y + 1.02, za - sign * 0.66],
        ],
        [0, 1, 0],
      );
      if (t > 0)
        for (const h of [-0.18, -0.5])
          rod(o, 'stone', [a, y + h, za + sign * 0.03], [b, Y + h, zb + sign * 0.03], 0.18, 0.18);
    }
  }
}
function turned(o, m, x, z, rows, n) {
  loft(
    o,
    m,
    rows.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i / n) * Math.PI * 2;
        return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      }),
    ),
    palette[m].rgb,
  );
}
function lamps(o, t) {
  const xs = [-104, -77, -48, -18, 14, 47, 78, 103];
  for (const sign of [-1, 1])
    for (const x of xs) {
      const z = (sign > 0 ? frontZ(x) : backZ(x)) - sign * 0.85,
        y = deckY(x) + 0.15,
        top = y + 5.75;
      if (t === 0) {
        rod(o, 'metal', [x, y, z], [x, top, z], 0.13, 0.13);
        continue;
      }
      if (t === 1) {
        rod(o, 'metal', [x, y, z], [x, top, z], 0.1, 0.1);
        rod(o, 'metal', [x, top, z], [x, top, z - sign * 0.6], 0.08, 0.08);
        box(o, 'glass', x, top - 0.25, z - sign * 0.6, 0.28, 0.4, 0.28);
        continue;
      }
      const n = t === 2 ? 6 : t === 3 ? 8 : 10;
      turned(
        o,
        'metal',
        x,
        z,
        [
          [y, 0.19],
          [y + 0.22, 0.19],
          [y + 0.55, 0.1],
          [top - 0.3, 0.073],
          [top, 0.1],
        ],
        n,
      );
      const arm = Array.from({ length: 9 }, (_, i) => {
        const u = i / 8;
        return [x, top + 0.45 * Math.sin(u * Math.PI * 0.85), z - sign * 0.75 * u];
      });
      beamPath(o, 'metal', arm, 0.065, 0.065, palette.metal.rgb);
      turned(
        o,
        'glass',
        x,
        z - sign * 0.75,
        [
          [top - 0.42, 0.1],
          [top - 0.12, 0.22],
          [top + 0.08, 0.09],
        ],
        n,
      );
      // Two open ornamental scrolls in each vertical lamp standard.
      for (const k of [0, 1]) {
        const scroll = Array.from({ length: t === 2 ? 9 : 15 }, (_, i) => i); // fixed-count path below
        const path = scroll.map((_, j) => {
          const u = j / (scroll.length - 1),
            a = u * Math.PI * 2.1,
            r = 0.3 * (1 - u * 0.65);
          return [x, top - 1.0 - k * 0.75 + Math.sin(a) * r, z - sign * (0.18 + Math.cos(a) * r)];
        });
        beamPath(o, 'metal', path, 0.04, 0.045, palette.metal.rgb);
      }
    }
}
export function buildBridgeLevel(o, level) {
  const t = tiers[level];
  if (t === undefined) throw Error('Unknown bridge tier ' + level);
  arches(o, t);
  for (let i = 0; i < 6; i++) pier(o, t, i);
  endSupports(o);
  deck(o, t);
  lamps(o, t);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
