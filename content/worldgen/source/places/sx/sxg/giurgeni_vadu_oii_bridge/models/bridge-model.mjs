import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const bridgeControls = {
  id: 'giurgeni_vadu_oii_bridge',
  anchor: [27.876716086, 44.75420563],
  heading: -0.215051031643,
  datum: 3,
  ends: [-750, 750],
  width: 17.148,
  halfWidth: 8.574,
  roadHalfWidth: 6.75,
  centerZ: 0,
  foundationY: -4,
  profile: [
    [-750, 10.5],
    [-360, 20.5],
    [-240, 22],
    [-80, 23],
    [80, 23],
    [240, 22],
    [360, 20.5],
    [750, 9.5],
  ],
  coreEnds: [-360, 360],
  mainPiers: [-240, -80, 80, 240],
  approachPiers: [
    -725, -675, -635, -595, -555, -515, -475, -435, -395, 395, 435, 475, 515, 555, 595, 635, 675,
    715,
  ],
  shorePiers: [-360, 360],
  lampStep: 45,
  underRoutes: [
    { id: 35185191543150, station: -711.661959044 },
    { id: 35185191543160, station: -278.208165915 },
  ],
  ownedRoadId: 35184384985535,
};
const interp = (ps, x) => {
  for (let i = 1; i < ps.length; i++)
    if (x <= ps[i][0]) {
      const a = ps[i - 1],
        b = ps[i],
        u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + u * (b[1] - a[1]);
    }
  return ps.at(-1)[1];
};
export const deckY = (x) => {
  const ps = bridgeControls.profile;
  if (x <= ps[0][0]) return ps[0][1];
  if (x >= ps.at(-1)[0]) return ps.at(-1)[1];
  const slope = (i) => (ps[i + 1][1] - ps[i][1]) / (ps[i + 1][0] - ps[i][0]),
    tangent = (i) => {
      if (i === 0) return slope(0);
      if (i === ps.length - 1) return slope(i - 1);
      const a = slope(i - 1),
        b = slope(i);
      return a * b <= 0 ? 0 : Math.sign(a) * Math.min(Math.abs(a), Math.abs(b));
    };
  for (let i = 1; i < ps.length; i++)
    if (x <= ps[i][0]) {
      const a = ps[i - 1],
        b = ps[i],
        h = b[0] - a[0],
        u = (x - a[0]) / h;
      return (
        (2 * u * u * u - 3 * u * u + 1) * a[1] +
        (u * u * u - 2 * u * u + u) * h * tangent(i - 1) +
        (-2 * u * u * u + 3 * u * u) * b[1] +
        (u * u * u - u * u) * h * tangent(i)
      );
    }
  return ps.at(-1)[1];
};
export const girderDepth = (x) => {
  const C = bridgeControls;
  if (Math.abs(x) >= 360) return 1.45;
  const d = Math.min(...C.mainPiers.map((p) => Math.abs(p - x)));
  return 2.15 + 4.05 * Math.pow(Math.max(0, 1 - d / 54), 1.6);
};
const linear = (hex) =>
    [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    concrete: { slot: 'wall', graph: 'concrete_plain', rgb: linear('#bab5a4') },
    steel: { slot: 'trim', graph: 'metal_painted', rgb: linear('#81867c') },
    lamp: { slot: 'trim', graph: 'metal_painted', rgb: linear('#5a645d') },
    rail: { slot: 'trim', graph: 'metal_painted', rgb: linear('#969b8e') },
    mesh: {
      slot: 'trim',
      graph: 'metal_expanded_diamond',
      doubleSided: true,
      alphaMode: 'MASK',
      alphaCutoff: 0.3,
      rgb: linear('#81897a'),
    },
    road: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#747c7c') },
    walk: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#a9ac9e') },
    mark: { slot: 'foundation', graph: 'concrete_plain', rgb: linear('#deded0') },
  };
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildBridgeLevel(o, level = 'master') {
  const C = bridgeControls,
    t = tiers[level],
    face = (m, p, n, tint = 1) => {
      let N = normalFor(...p);
      if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
        p = p.toReversed();
        N = normalFor(...p);
      }
      if (
        p.length === 4 &&
        Math.abs(p[3].reduce((d, v, i) => d + (v - p[0][i]) * N[i], 0)) > 0.000001
      ) {
        face(m, [p[0], p[1], p[2]], n, tint);
        face(m, [p[0], p[2], p[3]], n, tint);
        return;
      }
      o[p.length === 3 ? 'addTriangle' : p.length === 4 ? 'addQuad' : 'addConvexPolygon'](
        m,
        'palette:#ffffff',
        p,
        N,
        undefined,
        palette[m].rgb.map((v) => v * tint),
      );
    },
    rod = (m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
  const box = (m, x0, x1, z0, z1, y0, y1) => {
    const a = [x0, y0, z0],
      b = [x1, y0, z0],
      c = [x1, y0, z1],
      d = [x0, y0, z1],
      A = [x0, y1, z0],
      B = [x1, y1, z0],
      D = [x0, y1, z1],
      E = [x1, y1, z1];
    for (const [p, n] of [
      [
        [a, b, c, d],
        [0, -1, 0],
      ],
      [
        [A, D, E, B],
        [0, 1, 0],
      ],
      [
        [a, A, B, b],
        [0, 0, -1],
      ],
      [
        [d, c, E, D],
        [0, 0, 1],
      ],
      [
        [a, d, D, A],
        [-1, 0, 0],
      ],
      [
        [b, B, E, c],
        [1, 0, 0],
      ],
    ]) {
      if (t === 0 && n[1] === -1 && y0 === C.foundationY) continue;
      face(m, p, n);
    }
  };
  const frustum = (m, x, base, top, y0, y1) => {
    const a = base.map(([X, Z]) => [x + X, y0, Z]),
      b = top.map(([X, Z]) => [x + X, y1, Z]);
    if (t > 0) face(m, a, [0, -1, 0]);
    face(m, b, [0, 1, 0]);
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length,
        n = [(a[i][0] + a[j][0]) / 2 - x, 0, (a[i][2] + a[j][2]) / 2];
      face(m, [a[i], a[j], b[j], b[i]], n);
    }
  };
  const coreMid = [-300, -160, 0, 160, 300],
    xs = [
      ...new Set([
        ...C.profile.map((p) => p[0]),
        ...C.mainPiers,
        ...coreMid,
        ...Array.from(
          { length: [0, 4, 16, 32, 48][t] },
          (_, i) => -750 + ((i + 1) / ([0, 4, 16, 32, 48][t] + 1)) * 1500,
        ),
      ]),
    ].sort((a, b) => a - b);
  const run = (m, z0, z1, low, high, caps = true) => {
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        y = deckY(a),
        Y = deckY(b),
        lo = typeof low === 'function' ? low(a) : low,
        LO = typeof low === 'function' ? low(b) : low,
        hi = typeof high === 'function' ? high(a) : high,
        HI = typeof high === 'function' ? high(b) : high;
      face(
        m,
        [
          [a, y + hi, z0],
          [b, Y + HI, z0],
          [b, Y + HI, z1],
          [a, y + hi, z1],
        ],
        [0, 1, 0],
      );
      if (low !== high) {
        face(
          m,
          [
            [a, y + lo, z0],
            [a, y + lo, z1],
            [b, Y + LO, z1],
            [b, Y + LO, z0],
          ],
          [0, -1, 0],
        );
        for (const [z, s] of [
          [z0, -1],
          [z1, 1],
        ])
          face(
            m,
            [
              [a, y + lo, z],
              [b, Y + LO, z],
              [b, Y + HI, z],
              [a, y + hi, z],
            ],
            [0, 0, s],
          );
      }
    }
    if (caps && low !== high)
      for (const [x, n] of [
        [-750, -1],
        [750, 1],
      ]) {
        const y = deckY(x),
          lo = typeof low === 'function' ? low(x) : low,
          hi = typeof high === 'function' ? high(x) : high;
        face(
          m,
          [
            [x, y + lo, z0],
            [x, y + lo, z1],
            [x, y + hi, z1],
            [x, y + hi, z0],
          ],
          [n, 0, 0],
        );
      }
  };
  run('concrete', -8.574, 8.574, -0.4, -0.08);
  run('road', -6.75, 6.75, 0, 0, false);
  for (const side of [-1, 1]) {
    const a = side * 6.75,
      b = side * 8.55;
    run('walk', Math.min(a, b), Math.max(a, b), 0.12, 0.12, false);
    if (t > 0) run('concrete', side * 6.82 - 0.08, side * 6.82 + 0.08, -0.08, 0.18);
  }
  if (t < 2) {
    run('steel', -6.8, 6.8, (x) => -girderDepth(x), -0.4);
  } else
    for (const z of [-4.1, 4.1]) run('steel', z - 2.55, z + 2.55, (x) => -girderDepth(x), -0.4);
  // Four tall, cutwater-ended river piers; smaller land-viaduct bents are distinct.
  for (const x of C.mainPiers) {
    const bottom = [
        [-4, -4.2],
        [-2.2, -6.4],
        [2.2, -6.4],
        [4, -4.2],
        [4, 4.2],
        [2.2, 6.4],
        [-2.2, 6.4],
        [-4, 4.2],
      ],
      top = bottom.map(([X, Z]) => [X * 0.67, Z * 0.77]),
      y = deckY(x) - girderDepth(x);
    frustum('concrete', x, bottom, top, C.foundationY, y - 0.7);
    box('concrete', x - 3.2, x + 3.2, -7.1, 7.1, y - 0.7, y - 0.15);
    if (t > 1) {
      box('concrete', x - 5, x + 5, -7.1, 7.1, C.foundationY, C.foundationY + 0.9);
      for (const z of [-4.1, 4.1]) box('steel', x - 0.9, x + 0.9, z - 0.65, z + 0.65, y - 0.15, y);
    }
  }
  for (const x of [...C.approachPiers, ...C.shorePiers]) {
    const y = deckY(x) - girderDepth(x);
    if (t < 2) box('concrete', x - 1.4, x + 1.4, -4.3, 4.3, C.foundationY, y - 0.55);
    else {
      frustum(
        'concrete',
        x,
        [
          [-1.6, -4.6],
          [1.6, -4.6],
          [1.6, 4.6],
          [-1.6, 4.6],
        ],
        [
          [-1.1, -3.6],
          [1.1, -3.6],
          [1.1, 3.6],
          [-1.1, 3.6],
        ],
        C.foundationY,
        y - 0.55,
      );
      if (t > 2) box('concrete', x - 2.6, x + 2.6, -5.2, 5.2, C.foundationY, C.foundationY + 0.65);
    }
    box('concrete', x - 1.6, x + 1.6, -7.1, 7.1, y - 0.55, y - 0.1);
  }
  for (const x of C.ends)
    box('concrete', x - 2, x + 2, -8.574, 8.574, C.foundationY, deckY(x) - 1.5);
  // The shared alpha-tested expanded-metal graph supplies the railing infill.
  for (const side of [-1, 1]) {
    const z = side * 8.26;
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      for (const offset of [-0.012, 0.012])
        face(
          'mesh',
          [
            [a, deckY(a) + 0.25, z + offset],
            [b, deckY(b) + 0.25, z + offset],
            [b, deckY(b) + 1.1, z + offset],
            [a, deckY(a) + 1.1, z + offset],
          ],
          [0, 0, Math.sign(offset)],
        );
      if (t > 0)
        rod('rail', [a, deckY(a) + 1.14, z], [b, deckY(b) + 1.14, z], t === 1 ? 0.14 : 0.09, 0.08);
      if (t > 1)
        rod(
          'rail',
          [a, deckY(a) + 0.48, side * 7.05],
          [b, deckY(b) + 0.48, side * 7.05],
          0.17,
          0.1,
        );
    }
    if (t > 1)
      for (let x = -749; x < 750; x += [0, 0, 12, 3, 2.5][t])
        rod('rail', [x, deckY(x) + 0.12, z], [x, deckY(x) + 1.14, z], 0.1, 0.09);
  }
  if (t > 0) {
    const spacing = t === 1 ? 135 : 45,
      steps = t === 1 ? 1 : t === 2 ? 3 : 5;
    for (let x = -730; x < 740; x += spacing)
      for (const side of [-1, 1]) {
        const z = side * 7.85,
          y = deckY(x),
          stem = 8.5;
        if (t > 2) box('lamp', x - 0.13, x + 0.13, z - 0.09, z + 0.09, y + 6.5, y + 7.25);
        rod('rail', [x, y + 0.12, z], [x, y + stem, z], t === 1 ? 0.24 : 0.15, 0.15);
        for (const arm of [0, 1]) {
          const H = arm === 0 ? 2.0 : 1.1,
            L = arm === 0 ? 2.1 : 3.0;
          for (let i = 0; i < steps; i++) {
            const u = i / steps,
              v = (i + 1) / steps,
              point = (u) => [x, y + stem + H * (1 - (1 - u) * (1 - u)), z - side * L * u];
            rod('rail', point(u), point(v), t === 1 ? 0.2 : 0.09, 0.09);
          }
          if (t < 3)
            box(
              'lamp',
              x - 0.22,
              x + 0.22,
              z - side * L - 0.45,
              z - side * L + 0.45,
              y + stem + H - 0.08,
              y + stem + H + 0.06,
            );
          else {
            const ring = Array.from({ length: 8 }, (_, j) => {
              const a = (j / 8) * Math.PI * 2;
              return [Math.cos(a) * 0.23, z - side * L + Math.sin(a) * 0.45];
            });
            frustum(
              'lamp',
              x,
              ring,
              ring.map(([X, Z]) => [X * 0.84, z - side * L + (Z - (z - side * L)) * 0.92]),
              y + stem + H - 0.08,
              y + stem + H + 0.06,
            );
          }
        }
      }
  }
  if (t > 1) {
    for (const z of [-0.14, 0.14, -6.35, 6.35])
      for (let i = 1; i < xs.length; i++) {
        const a = xs[i - 1],
          b = xs[i];
        face(
          'mark',
          [
            [a, deckY(a) + 0.006, z - 0.055],
            [b, deckY(b) + 0.006, z - 0.055],
            [b, deckY(b) + 0.006, z + 0.055],
            [a, deckY(a) + 0.006, z + 0.055],
          ],
          [0, 1, 0],
        );
      }
    for (let x = -748; x < 748; x += 12)
      for (const z of [-3.35, 3.35])
        face(
          'mark',
          [
            [x, deckY(x) + 0.006, z - 0.055],
            [x + 5, deckY(x + 5) + 0.006, z - 0.055],
            [x + 5, deckY(x + 5) + 0.006, z + 0.055],
            [x, deckY(x) + 0.006, z + 0.055],
          ],
          [0, 1, 0],
        );
  }
  if (t > 1)
    for (let x = -730; x < 740; x += t === 2 ? 70 : 35) {
      const y = deckY(x) - Math.min(girderDepth(x), 2.15);
      rod('steel', [x, y + 0.13, -6.6], [x, y + 0.13, 6.6], 0.2, 0.28);
      if (t > 2)
        for (const side of [-1, 1]) {
          rod(
            'steel',
            [x, y + 0.13, side * 6.5],
            [x + 1.4, deckY(x + 1.4) - 0.45, side * 6.5],
            0.1,
            0.1,
          );
        }
    }
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
