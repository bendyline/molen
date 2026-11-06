import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// Ordinary exterior photographs establish the open suspension-like side girders,
// single curved central portal and entrance sculpture; map data establishes plan.
export const bridgeControls = {
  anchor: [17.042247684, 51.114712158],
  heading: -0.121161025961,
  datum: 110,
  deck: 113.8,
  length: 54.201,
  width: 8.415,
  trussZ: 2.25,
  outline: [
    [-27.101, -4.207],
    [25.029, -4.207],
    [25.272, -3.317],
    [25.498, -2.324],
    [26.174, 0.161],
    [26.75, 2.177],
    [26.893, 2.776],
    [27.101, 3.379],
    [26.586, 3.431],
    [26.655, 3.77],
    [-21.423, 4.207],
    [-22.289, 2.933],
    [-24.222, 0.063],
    [-26.455, -3.243],
  ],
  bankEnds: [
    [-27.101, -4.207],
    [-26.455, -3.243],
    [-24.222, 0.063],
    [-22.289, 2.933],
    [-21.423, 4.207],
  ],
  eastEnds: [
    [25.029, -4.207],
    [25.272, -3.317],
    [25.498, -2.324],
    [26.174, 0.161],
    [26.75, 2.177],
    [26.893, 2.776],
    [27.101, 3.379],
    [26.586, 3.431],
    [26.655, 3.77],
  ],
  statues: [
    { x: -28.6, z: -5.1, ground: 111.739627, church: true },
    { x: -22.92, z: 5.1, ground: 111.989794, church: false },
  ],
};
const palette = {
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.25, 0.47, 0.43] },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: [0.12, 0.17, 0.16] },
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', rgb: [0.59, 0.55, 0.46] },
  paving: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.4, 0.4, 0.37] },
  edging: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.62, 0.61, 0.56] },
  glass: { slot: 'window', graph: 'concrete_plain', rgb: [0.84, 0.83, 0.71] },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  off = bridgeControls.deck - bridgeControls.datum;
const P = (x, y, z) => [x, y + off, z],
  rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, P(x, y - h / 2, z), P(x, y + h / 2, z), d, w);
function face(o, m, points, direction) {
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  o[points.length === 3 ? 'addTriangle' : 'addQuad'](
    m,
    'palette:#ffffff',
    points,
    n,
    undefined,
    palette[m].rgb,
  );
}
function cap(o, m, poly, y, down = false) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'wall',
      'palette:#ffffff',
      poly,
      [],
      (p) => (typeof y === 'function' ? y(p) + off : y + off),
      [0, down ? -1 : 1, 0],
      (p) => p,
      palette[m].rgb,
    )
  )
    throw Error('Invalid deck polygon');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, m, points, [0, down ? -1 : 1, 0]);
  }
}
function clip(poly, value, keepGreater, axis = 1) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      A = keepGreater ? a[axis] >= value : a[axis] <= value,
      B = keepGreater ? b[axis] >= value : b[axis] <= value;
    if (A) out.push(a);
    if (A !== B) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => (k === axis ? value : v + t * (b[k] - v))));
    }
  }
  return out;
}
const bankX = (z, east = false) => {
  const c = east ? bridgeControls.eastEnds : bridgeControls.bankEnds;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1],
      b = c[i];
    if (z >= a[1] && z <= b[1]) return a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]);
  }
  return c[z < c[0][1] ? 0 : c.length - 1][0];
};
const walkHeight = ([x, z]) =>
  0.12 * Math.max(0, Math.min(1, (x - bankX(z)) / 1.5, (bankX(z, true) - x) / 1.5));
function deck(o, t) {
  const poly = bridgeControls.outline;
  cap(o, 'paving', poly, 0);
  cap(o, 'dark', poly, -0.42, true);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    face(
      o,
      'dark',
      [P(a[0], -0.42, a[1]), P(b[0], -0.42, b[1]), P(b[0], 0, b[1]), P(a[0], 0, a[1])],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (t === 0) return;
  for (const side of [-1, 1]) {
    const walk = clip(poly, side * 2.35, side > 0);
    for (let x = -28; x < 28; x += 2) {
      const strip = clip(clip(walk, x, true, 0), x + 2, false, 0);
      if (strip.length < 3) continue;
      cap(o, 'edging', strip, walkHeight);
      for (let i = 0; i < strip.length; i++) {
        const a = strip[i],
          b = strip[(i + 1) % strip.length],
          h = walkHeight(a),
          H = walkHeight(b);
        if (Math.abs(a[1]) > 2.36 || Math.abs(b[1]) > 2.36 || h + H < 0.00001) continue;
        let points = [P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], H, b[1]), P(a[0], h, a[1])];
        if (H < 0.00001) points.splice(2, 1);
        else if (h < 0.00001) points.pop();
        face(o, 'edging', points, [0, 0, -side]);
      }
    }
  }
  for (let i = 0; i <= 12; i++) {
    const x = -23.5 + (i * 49) / 12;
    box(o, 'dark', x, -0.27, 0, 0.16, 0.34, 8.05);
  }
  for (const z of [-1.8, 0, 1.8]) box(o, 'dark', 0.4, -0.35, z, 49.5, 0.22, 0.16);
}
function pier(o, t) {
  if (t === 0) {
    box(o, 'stone', 0, -3.3, 0, 2.35, 5.1, 8.8);
  } else {
    const ring = (y) =>
      [
        [-1.22, -3.7],
        [0, -5.15],
        [1.22, -3.7],
        [1.22, 3.7],
        [0, 5.15],
        [-1.22, 3.7],
      ]
        .toReversed()
        .map(([x, z]) => P(x, y, z));
    loft(o, 'stone', [ring(-6.1), ring(-0.6)], palette.stone.rgb);
    for (const y of [-4.55, -1.22, -0.65]) {
      const rings = [y - 0.09, y + 0.09].map((Y) =>
        ring(Y).map(([x, y, z]) => [x * 1.1, y, z * 1.025]),
      );
      loft(o, 'stone', rings, palette.stone.rgb);
    }
  }
  for (const east of [false, true]) {
    const chain = east ? bridgeControls.eastEnds : bridgeControls.bankEnds;
    for (const side of [-1, 1]) {
      const z = side * 3.65,
        x = bankX(z, east);
      box(o, 'stone', x + (east ? 0.5 : -0.5), -2.6, z, 1.5, 5.1, 1.45);
    }
    if (t > 0) {
      const a = chain[0],
        b = chain.at(-1);
      rod(o, 'stone', P(a[0], -0.45, a[1]), P(b[0], -0.45, b[1]), 0.75, 0.42);
    }
  }
}
// Broad I-section members at street range, coherent solids in distant tiers.
function member(o, t, a, b, w, d) {
  if (t < 2) {
    rod(o, 'steel', P(...a), P(...b), w, d);
    return;
  }
  const axis = b.map((v, i) => v - a[i]),
    len = Math.hypot(...axis),
    nx = -axis[1] / len,
    ny = axis[0] / len;
  // All side members lie in XY: offset flanges normal to their center line.
  if (Math.abs(axis[2]) > 0.001) {
    rod(o, 'steel', P(...a), P(...b), w, d);
    return;
  }
  rod(o, 'steel', P(...a), P(...b), w * 0.22, d);
  for (const s of [-1, 1]) {
    const shift = (p) => [p[0] + nx * d * 0.44 * s, p[1] + ny * d * 0.44 * s, p[2]];
    rod(o, 'steel', P(...shift(a)), P(...shift(b)), w, d * 0.13);
  }
}
function trusses(o, t) {
  const z0 = bridgeControls.trussZ,
    panels = t === 0 ? 8 : 12;
  for (const z of [-z0, z0]) {
    const a = bankX(z) + 0.3,
      b = bankX(z, true) - 0.3;
    member(o, t, [a, 0.12, z], [b, 0.12, z], 0.26, 0.3);
    member(o, t, [a, 1.53, z], [b, 1.53, z], 0.18, 0.2);
    for (let i = 0; i < panels; i++) {
      const x = a + ((b - a) * i) / panels,
        X = a + ((b - a) * (i + 1)) / panels;
      member(o, t, [x, i % 2 ? 0.2 : 1.48, z], [X, i % 2 ? 1.48 : 0.2, z], 0.12, 0.13);
      if (t > 1 && i > 0) box(o, 'steel', x, 0.83, z, 0.1, 1.28, 0.13);
    }
    for (const end of [a, b]) {
      const n = [2, 5, 8, 10, 14][t],
        high = 5.3;
      for (let i = 0; i < n; i++) {
        const u = i / n,
          v = (i + 1) / n,
          x = end * (1 - u),
          X = end * (1 - v),
          y = 1.6 + (high - 1.6) * u * u,
          Y = 1.6 + (high - 1.6) * v * v;
        member(o, t, [x, y, z], [X, Y, z], 0.24, 0.27);
        if (t > 1) member(o, t, [x, y - 0.3, z], [X, Y - 0.3, z], 0.11, 0.12);
        if (i > 0 && (t > 0 || i === 1))
          rod(o, 'steel', P(x, 1.6, z), P(x, y - 0.12, z), 0.085, 0.085);
      }
    }
    member(o, t, [0, 0.12, z], [0, 5.34, z], 0.3, 0.38);
    if (t > 1)
      for (let i = 0; i <= panels; i++) {
        const x = a + ((b - a) * i) / panels;
        box(o, 'steel', x, 0.22, z, 0.4, 0.36, 0.055);
        if (t > 2)
          for (const dx of [-0.11, 0.11])
            for (const dy of [-0.085, 0.085])
              sphere(
                o,
                'steel',
                P(x + dx, 0.22 + dy, z + 0.045 * Math.sign(z)),
                [0.034, 0.034, 0.026],
                palette.steel.rgb,
                6,
                3,
              );
      }
  }
  // One central arched lattice portal, with genuine open headroom.
  const n = [4, 8, 12, 16, 20][t],
    f = (z) => 5.28 + 1.44 * (1 - (z / z0) * (z / z0));
  for (let i = 0; i < n; i++) {
    const z = -z0 + (2 * z0 * i) / n,
      Z = -z0 + (2 * z0 * (i + 1)) / n;
    rod(o, 'steel', P(0, f(z), z), P(0, f(Z), Z), 0.18, 0.16);
    rod(o, 'steel', P(0, f(z) + 0.38, z), P(0, f(Z) + 0.38, Z), 0.18, 0.14);
    if (t > 0 || i % 2 === 0)
      rod(
        o,
        'steel',
        P(0, f(z) + (i % 2 ? 0.36 : 0), z),
        P(0, f(Z) + (i % 2 ? 0 : 0.36), Z),
        0.065,
        0.065,
      );
  }
}
function railings(o, t) {
  for (const side of [-1, 1]) {
    const za = side < 0 ? -4.04 : 4.04,
      zb = side < 0 ? -4.04 : 3.61,
      a = bankX(za) + 0.15,
      b = bankX(zb, true) - 0.15;
    rod(o, 'dark', P(a, 1.17, za), P(b, 1.17, zb), 0.08, 0.09);
    if (t === 0) continue;
    rod(o, 'steel', P(a, 0.27, za), P(b, 0.27, zb), 0.06, 0.07);
    const n = [0, 14, 54, 70, 84][t];
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        x = a + (b - a) * u,
        z = za + (zb - za) * u;
      rod(o, 'steel', P(x, 0.2, z), P(x, 1.17, z), 0.055, 0.055);
      if (t > 1 && i < n) {
        const v = (i + 0.5) / n,
          X = a + (b - a) * v,
          Z = za + (zb - za) * v;
        rod(o, 'steel', P(X, 0.27, Z), P(X, 1.04, Z), 0.031, 0.031);
      }
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
        return P(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      }),
    ),
    palette[m].rgb,
  );
}
function statue(o, t, s) {
  const { x, z } = s,
    base = s.ground - bridgeControls.deck - 0.35,
    n = [4, 6, 8, 10, 12][t];
  box(o, 'stone', x, base + 0.17, z, 1.35, 0.34, 1.25);
  box(o, 'stone', x, base + 1.13, z, 1.02, 1.58, 0.99);
  box(o, 'stone', x, base + 2, z, 1.42, 0.22, 1.34);
  if (t === 0) {
    box(o, 'stone', x, base + 2.82, z, 0.52, 1.45, 0.5);
    return;
  }
  // A robed figure in the round; the drape folds are modeled, not image planes.
  const rings = [
    [2.13, 0.4, 0.3],
    [2.5, 0.34, 0.25],
    [2.96, 0.28, 0.24],
    [3.24, 0.33, 0.23],
    [3.45, 0.25, 0.21],
  ].map(([Y, rx, rz]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i / n) * Math.PI * 2,
        fold = 1 + (i % 2 ? 0.07 : -0.07);
      return P(x + Math.cos(a) * rx * fold, Y + base, z + Math.sin(a) * rz * fold);
    }),
  );
  loft(o, 'stone', rings, palette.stone.rgb);
  sphere(
    o,
    'stone',
    P(x, base + 3.7, z),
    [0.175, 0.235, 0.17],
    palette.stone.rgb,
    n,
    Math.max(3, n / 2),
  );
  const faceDirection = 1;
  rod(
    o,
    'stone',
    P(x + 0.19, base + 3.29, z - 0.17),
    P(x + 0.38, base + 3.03, z - 0.17),
    0.17,
    0.17,
  );
  rod(
    o,
    'stone',
    P(x + 0.38, base + 3.03, z - 0.17),
    P(x + 0.35, base + 3.3, z + 0.02),
    0.15,
    0.15,
  );
  rod(
    o,
    'stone',
    P(x + 0.13, base + 3.27, z + 0.19),
    P(x + 0.32, base + 3.13, z + 0.22),
    0.16,
    0.16,
  );
  if (s.church) {
    box(o, 'stone', x + 0.36, base + 3.3, z + 0.03, 0.38, 0.27, 0.46);
    box(o, 'stone', x + 0.36, base + 3.49, z - 0.08, 0.18, 0.25, 0.18);
    turned(
      o,
      'stone',
      x,
      z,
      [
        [base + 3.88, 0.18],
        [base + 4.06, 0.2],
      ],
      n,
    );
  } else {
    turned(
      o,
      'stone',
      x,
      z,
      [
        [base + 3.87, 0.16],
        [base + 4.15, 0.04],
      ],
      n,
    );
    rod(
      o,
      'stone',
      P(x + 0.24, base + 2.43, z + 0.39),
      P(x + 0.24, base + 3.76, z + 0.39),
      0.04,
      0.04,
    );
  }
  if (t > 1) {
    for (const side of [-1, 1])
      box(o, 'stone', x + 0.522, base + 1.15, z + side * 0.28, 0.05, 1.05, 0.055);
    box(o, 'stone', x + 0.54, base + 0.68, z, 0.06, 0.05, 0.65);
  }
}
function lamp(o, t, x, z, ground) {
  const b = ground - bridgeControls.deck,
    top = b + 3.65,
    n = [4, 6, 8, 10, 12][t];
  if (t === 0) {
    rod(o, 'dark', P(x, b, z), P(x, top, z), 0.09, 0.09);
    return;
  }
  turned(
    o,
    'dark',
    x,
    z,
    [
      [b, 0.15],
      [b + 0.18, 0.15],
      [b + 0.35, 0.07],
      [top - 0.72, 0.055],
    ],
    n,
  );
  turned(
    o,
    'glass',
    x,
    z,
    [
      [top - 0.74, 0.11],
      [top - 0.65, 0.21],
      [top - 0.12, 0.17],
    ],
    n,
  );
  turned(
    o,
    'dark',
    x,
    z,
    [
      [top - 0.12, 0.24],
      [top + 0.01, 0.03],
    ],
    n,
  );
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    rod(
      o,
      'dark',
      P(x + Math.cos(a) * 0.2, top - 0.66, z + Math.sin(a) * 0.2),
      P(x + Math.cos(a) * 0.16, top - 0.12, z + Math.sin(a) * 0.16),
      0.026,
      0.026,
    );
  }
}
export function buildBridgeLevel(o, level) {
  const t = tiers[level];
  if (t === undefined) throw Error('Unknown bridge tier');
  deck(o, t);
  pier(o, t);
  trusses(o, t);
  railings(o, t);
  for (const s of bridgeControls.statues) statue(o, t, s);
  for (const s of bridgeControls.statues) lamp(o, t, s.x + 1.1, s.z * 0.8, s.ground + 0.1);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
