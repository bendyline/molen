import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const bridgeControls = {
  id: 'daughters_of_jacob_bridge',
  anchor: [35.62827075, 33.01037395],
  heading: 0.10662267622,
  datum: 65,
  ends: [-24.5, 24.5],
  width: 13.2,
  roadHalfWidth: 5.4,
  centerZ: 0.11,
  deckHeights: [5.4, 5.1],
  crown: 0.08,
  foundationY: -4,
  protectedIds: [35184802951610],
};
export const deckY = (x) => {
  const C = bridgeControls,
    u = Math.max(0, Math.min(1, (x - C.ends[0]) / (C.ends[1] - C.ends[0])));
  return C.deckHeights[0] + u * (C.deckHeights[1] - C.deckHeights[0]) + C.crown * 4 * u * (1 - u);
};
const linear = (hex) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    concrete: { slot: 'wall', graph: 'concrete_plain', rgb: linear('#b9b6a9') },
    steel: { slot: 'trim', graph: 'metal_painted', rgb: linear('#81a9b9') },
    rail: { slot: 'trim', graph: 'metal_painted', rgb: linear('#c2c6be') },
    road: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#737b7c') },
    walk: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#a6aa9f') },
    white: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#deded0') },
    yellow: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#cab987') },
  };
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildBridgeLevel(out, level = 'master') {
  const C = bridgeControls,
    t = tiers[level],
    face = (m, p, n) => {
      let N = normalFor(...p);
      if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
        p = p.toReversed();
        N = normalFor(...p);
      }
      out[p.length === 3 ? 'addTriangle' : 'addQuad'](
        m,
        'palette:#ffffff',
        p,
        N,
        undefined,
        palette[m].rgb,
      );
    },
    rod = (m, a, b, w, d = w) => beam(out, m, a, b, w, d, palette[m].rgb),
    strip = (m, a, b, z, Z, low, high) => {
      z += C.centerZ;
      Z += C.centerZ;
      const y = deckY(a),
        Y = deckY(b);
      for (const [p, n] of [
        [
          [
            [a, y + high, z],
            [b, Y + high, z],
            [b, Y + high, Z],
            [a, y + high, Z],
          ],
          [0, 1, 0],
        ],
        [
          [
            [a, y + low, z],
            [a, y + low, Z],
            [b, Y + low, Z],
            [b, Y + low, z],
          ],
          [0, -1, 0],
        ],
        [
          [
            [a, y + low, z],
            [b, Y + low, z],
            [b, Y + high, z],
            [a, y + high, z],
          ],
          [0, 0, -1],
        ],
        [
          [
            [a, y + low, Z],
            [a, y + high, Z],
            [b, Y + high, Z],
            [b, Y + low, Z],
          ],
          [0, 0, 1],
        ],
        [
          [
            [a, y + low, z],
            [a, y + high, z],
            [a, y + high, Z],
            [a, y + low, Z],
          ],
          [-1, 0, 0],
        ],
        [
          [
            [b, Y + low, z],
            [b, Y + low, Z],
            [b, Y + high, Z],
            [b, Y + high, z],
          ],
          [1, 0, 0],
        ],
      ])
        face(m, p, n);
    };
  const prism = (m, x0, x1, z0, z1, y0, y1) => {
      const y = deckY(x0),
        Y = deckY(x1);
      strip(m, x0, x1, z0, z1, y0 - y, y1 - Y);
    },
    n = [1, 3, 8, 12, 16][t],
    xs = Array.from({ length: n + 1 }, (_, i) => C.ends[0] + (i / n) * (C.ends[1] - C.ends[0]));
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    strip('concrete', a, b, -6.6, 6.6, -0.42, -0.1);
    strip('road', a, b, -5.4, 5.4, -0.1, 0);
    for (const side of [-1, 1]) {
      const z = side * 5.92;
      strip(
        'walk',
        a,
        b,
        Math.min(side * 5.4, side * 6.58),
        Math.max(side * 5.4, side * 6.58),
        -0.1,
        0.12,
      );
      strip('concrete', a, b, side * 5.4 - 0.065, side * 5.4 + 0.065, -0.1, 0.17);
      // Muted blue fascia, longitudinal plate girders, and continuous pale roadside rails.
      const beamZ = side * 5.82;
      strip('steel', a, b, beamZ - 0.065, beamZ + 0.065, -1.58, -0.42);
      if (t > 0) {
        strip('steel', a, b, beamZ - 0.3, beamZ + 0.3, -1.63, -1.52);
        strip('steel', a, b, beamZ - 0.24, beamZ + 0.24, -0.54, -0.43);
      }
      for (const y of t === 0 ? [0.82] : [0.65, 0.94])
        rod(
          'rail',
          [a, deckY(a) + y, side * 5.7 + C.centerZ],
          [b, deckY(b) + y, side * 5.7 + C.centerZ],
          t < 2 ? 0.16 : 0.11,
          0.08,
        );
      rod(
        'rail',
        [a, deckY(a) + 1.1, side * 6.43 + C.centerZ],
        [b, deckY(b) + 1.1, side * 6.43 + C.centerZ],
        t < 2 ? 0.11 : 0.065,
        0.06,
      );
      if (t > 1)
        rod(
          'rail',
          [a, deckY(a) + 0.57, side * 6.43 + C.centerZ],
          [b, deckY(b) + 0.57, side * 6.43 + C.centerZ],
          0.045,
          0.045,
        );
    }
  }
  for (const x of C.ends) {
    const a = x === C.ends[0] ? x - 0.5 : x - 2,
      b = x === C.ends[0] ? x + 2 : x + 0.5;
    prism('concrete', a, b, -6.6, 6.6, C.foundationY, deckY(x) - 1.68);
    if (t > 0)
      for (const side of [-1, 1]) {
        const z = side * 5.82;
        prism('steel', x - 0.65, x + 0.65, z - 0.42, z + 0.42, deckY(x) - 1.68, deckY(x) - 1.58);
      }
  }
  if (t > 0) {
    const step = [0, 6, 3, 2, 1.5][t];
    for (let x = -23.8; x < 24; x += step)
      for (const side of [-1, 1]) {
        rod(
          'rail',
          [x, deckY(x) + 0.12, side * 5.7 + C.centerZ],
          [x, deckY(x) + 1.01, side * 5.7 + C.centerZ],
          t === 1 ? 0.15 : 0.105,
          0.11,
        );
        rod(
          'rail',
          [x, deckY(x) + 0.12, side * 6.43 + C.centerZ],
          [x, deckY(x) + 1.1, side * 6.43 + C.centerZ],
          t === 1 ? 0.11 : 0.065,
          0.065,
        );
      }
    for (let x = -21; x <= 21; x += 7) {
      rod(
        'steel',
        [x, deckY(x) - 1.28, -5.82 + C.centerZ],
        [x, deckY(x) - 1.28, 5.82 + C.centerZ],
        0.18,
        0.45,
      );
      if (t > 1)
        for (const side of [-1, 1])
          strip('steel', x - 0.07, x + 0.07, side * 5.82 - 0.13, side * 5.82 + 0.13, -1.54, -0.43);
    }
  }
  if (t > 1) {
    for (let x = -23; x < 22; x += 5.5)
      strip('white', x, Math.min(x + 2.7, 24.5), -0.055, 0.055, 0.004, 0.008);
    for (const side of [-1, 1])
      strip('yellow', -24.5, 24.5, side * 5.03 - 0.055, side * 5.03 + 0.055, 0.004, 0.008);
  }
  if (t > 2) {
    for (let x = -21; x <= 21; x += 7)
      for (const side of [-1, 1]) {
        strip('steel', x - 0.24, x + 0.24, side * 5.82 - 0.08, side * 5.82 + 0.08, -1.54, -0.43);
        for (const y of [-1.36, -0.77])
          for (const X of [x - 0.13, x + 0.13])
            rod(
              'rail',
              [X, deckY(X) + y, side * 5.92 + C.centerZ],
              [X, deckY(X) + y, side * 5.98 + C.centerZ],
              0.052,
              0.052,
            );
      }
  }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
