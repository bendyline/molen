import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'foresthill_bridge',
  anchor: [-121.038804962, 38.922359384],
  heading: 0.136354310939,
  datum: 231.4,
  ends: [-374.24, 374.17],
  halfWidth: 11.58,
  roadIds: [35184480149320],
  approachIds: [35184398278770, 35184480149350],
  bankIds: [35184447805080, 35185830431532, 35184685857809, 35184704315348, 35184515879540],
  riverId: 35184398278774,
  curve: [
    [-374.24, 0.49],
    [374.17, 0.36],
  ],
  profile: [
    [-374.24, 155.08],
    [0, 158.39],
    [374.17, 161.78],
  ],
  piers: [-132.1, 131.2],
  trussStarts: [-372.5, -132.1, 131.2, 371.6],
};

function interpolate(x, points) {
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, next] = points[i];
    if (x <= b) return y + (next - y) * Math.max(0, (x - a) / (b - a));
  }
  return points.at(-1)[1];
}
export const deckY = (x) => interpolate(x, bridgeControls.profile);
export const centerZ = (x) => interpolate(x, bridgeControls.curve);
const deckHalf = (x) =>
  interpolate(x, [
    [-374.24, 11.98],
    [-371.0, 11.58],
    [371.0, 11.58],
    [374.17, 11.98],
  ]);

function surface(slot, graph, hex) {
  const color = [0, 2, 4].map((offset) => {
    const v = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return { slot, graph, color };
}
const palette = {
  green: surface('wall', 'metal_painted', '597468'),
  trim: surface('wall', 'metal_painted', '748775'),
  dark: surface('wall', 'metal_painted', '455c52'),
  bridge: surface('foundation', 'concrete_plain', 'b5ad9f'),
  deck: surface('foundation', 'concrete_plain', '98968e'),
  sidewalk: surface('foundation', 'concrete_plain', 'b9b6a9'),
  bearing: surface('foundation', 'concrete_plain', '928a79'),
  white: surface('foundation', 'concrete_plain', 'e6dfcd'),
  yellow: surface('foundation', 'concrete_plain', 'c5a154'),
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([id, { color, ...rest }]) => [id, rest]),
);

export function buildBridgeLevel(out, level = 'master') {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error(`Unknown Foresthill Bridge detail level ${level}`);
  const { ends, piers, trussStarts } = bridgeControls;
  const p = (x, y, z) => [x, deckY(x) + y, centerZ(x) + z];
  const bar = (m, a, b, w, h = w) => beam(out, m, a, b, w, h, palette[m].color);
  const path = (m, points, w, h = w) => beamPath(out, m, points, w, h, palette[m].color);
  function face(m, points, desired) {
    let n = normalFor(...points);
    if (n.reduce((s, v, i) => s + v * desired[i], 0) < 0) {
      points = points.toReversed();
      n = normalFor(...points);
    }
    if (Math.abs(n.reduce((s, v, i) => s + v * (points[3][i] - points[0][i]), 0)) > 0.000001) {
      out.addTriangle(m, 'palette:#fff', points.slice(0, 3), n, undefined, palette[m].color);
      const tail = [points[0], points[2], points[3]];
      out.addTriangle(m, 'palette:#fff', tail, normalFor(...tail), undefined, palette[m].color);
    } else out.addQuad(m, 'palette:#fff', points, n, undefined, palette[m].color);
  }
  function top(m, a, b, lo, hi, height) {
    face(
      m,
      [p(a, height, lo(a)), p(b, height, lo(b)), p(b, height, hi(b)), p(a, height, hi(a))],
      [0, 1, 0],
    );
  }
  const station = [ends[0], -371, 0, 371, ends[1]];
  for (let i = 1; i < station.length; i++) {
    const a = station[i - 1],
      b = station[i];
    top('deck', a, b, (x) => -deckHalf(x), deckHalf, 0);
    face(
      'bridge',
      [
        p(a, -1.25, -deckHalf(a)),
        p(b, -1.25, -deckHalf(b)),
        p(b, -1.25, deckHalf(b)),
        p(a, -1.25, deckHalf(a)),
      ],
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      face(
        'bridge',
        [
          p(a, 0, side * deckHalf(a)),
          p(b, 0, side * deckHalf(b)),
          p(b, -1.25, side * deckHalf(b)),
          p(a, -1.25, side * deckHalf(a)),
        ],
        [0, 0, side],
      );
      if (tier > 0) {
        const edge = (x) => side * deckHalf(x),
          inset = () => side * 9.23;
        top('sidewalk', a, b, side === -1 ? edge : inset, side === -1 ? inset : edge, 0.14);
        face(
          'sidewalk',
          [
            p(a, 0, side * 9.23),
            p(b, 0, side * 9.23),
            p(b, 0.14, side * 9.23),
            p(a, 0.14, side * 9.23),
          ],
          [0, 0, -side],
        );
      }
    }
  }
  for (const [x, sign] of [
    [ends[0], -1],
    [ends[1], 1],
  ]) {
    const z = deckHalf(x);
    face('bridge', [p(x, 0, -z), p(x, 0, z), p(x, -1.25, z), p(x, -1.25, -z)], [sign, 0, 0]);
    const endOfTruss = x - sign * 3.1,
      y = deckY(endOfTruss),
      center = centerZ(endOfTruss);
    bar('bridge', [endOfTruss, y - 23.2, center], [endOfTruss, y - 1.07, center], 21.6, 5.8);
  }

  const depth = (span, u) => {
    if (span === 1) {
      const d = 2 * u - 1;
      return 16.7 + 27.0 * d * d;
    }
    const distance = span === 0 ? u : 1 - u;
    return 19.4 + 24.3 * distance * distance;
  };
  for (const [index, x] of piers.entries()) {
    const z = centerZ(x),
      topY = deckY(x) - 43.65;
    const ring = (y, w, d) =>
      tier === 0
        ? [
            [x - w / 2, y, z - d / 2],
            [x - w / 2, y, z + d / 2],
            [x + w / 2, y, z + d / 2],
            [x + w / 2, y, z - d / 2],
          ]
        : chamferedRectangle(x, y, z, w, d, 0.58);
    const bottom = index * 0.3;
    const footing = [ring(bottom, 16.2, 21.7), ring(bottom + 4.5, 15.8, 21.4)];
    const shaft = [
      ring(bottom + 4.5, 12.8, 16.7),
      ring(topY - 10.8, 5.8, 12.7),
      ring(topY, 7.5, 17.9),
    ];
    loft(out, 'bearing', footing, palette.bearing.color);
    loft(out, 'bridge', shaft, palette.bridge.color);
    if (tier > 0) {
      const cap = topY - 0.4;
      bar('bearing', [x, cap, z - 9.03], [x, cap, z + 9.03], 7.1, 1.44);
      for (const side of [-1, 1])
        bar('dark', [x, topY - 0.7, z + side * 8.3], [x, topY + 0.32, z + side * 8.3], 1.88, 2.18);
    }
  }

  const bayCounts = tier === 0 ? [3, 4, 3] : [7, 8, 7];
  for (let span = 0; span < 3; span++) {
    const a = trussStarts[span],
      b = trussStarts[span + 1],
      bays = bayCounts[span];
    const top = (u, z) => p(a + (b - a) * u, -2.0, z);
    function bottom(u, z) {
      if (tier > 0) return p(a + (b - a) * u, -depth(span, u), z);
      const step = u * bays,
        i = Math.floor(step),
        f = step - i;
      const y = depth(span, i / bays) * (1 - f) + depth(span, Math.min(1, (i + 1) / bays)) * f;
      return p(a + (b - a) * u, -y, z);
    }
    const subdivisions = tier === 0 ? bays : bays * 2;
    for (const side of [-1, 1]) {
      const z = side * 8.37;
      path(
        'green',
        Array.from({ length: subdivisions + 1 }, (_, i) => bottom(i / subdivisions, z)),
        0.98,
        1.39,
      );
      bar('dark', top(0, z), top(1, z), 1.16, 1.31);
      for (let i = 0; i < bays; i++) {
        const u = i / bays,
          v = (i + 1) / bays,
          w = (u + v) / 2;
        bar('green', top(u, z), bottom(w, z), 0.66, 0.77);
        bar('green', bottom(w, z), top(v, z), 0.66, 0.77);
        if (tier > 0) {
          bar('trim', top(w, z), bottom(w, z), 0.34, 0.46);
          if (i === 0) bar('green', top(u, z), bottom(u, z), 0.46, 0.54);
        }
        if (tier > 1) {
          bar('dark', top(u, z + side * 0.32), top(v, z + side * 0.32), 0.34, 0.32);
          bar('green', bottom(u, z), bottom(w, z), 0.33, 0.41);
          if (tier > 2) {
            const joint = bottom(w, z),
              head = top(u, z);
            bar(
              'trim',
              [joint[0] - 0.86, joint[1] + 0.27, joint[2] + side * 0.39],
              [joint[0] + 0.86, joint[1] + 0.27, joint[2] + side * 0.39],
              0.17,
              0.96,
            );
            bar(
              'trim',
              [head[0] - 0.58, head[1] - 0.21, head[2] + side * 0.42],
              [head[0] + 0.58, head[1] - 0.21, head[2] + side * 0.42],
              0.15,
              0.8,
            );
          }
        }
      }
      if (tier > 0) bar('green', top(1, z), bottom(1, z), 0.46, 0.54);
    }
    if (tier > 0) {
      for (let i = 0; i <= bays; i++) {
        const u = i / bays;
        bar('green', top(u, -9.7), top(u, 9.7), 0.77, 0.92);
        bar('green', bottom(u, -8.37), bottom(u, 8.37), 0.67, 0.76);
        if (i > 0 && tier > 1) {
          const v = (i - 0.5) / bays;
          bar('dark', bottom(u, -8.37), bottom(v, 8.37), 0.38, 0.48);
          bar('dark', bottom(u, 8.37), bottom(v, -8.37), 0.38, 0.48);
        }
      }
    }
  }

  const detail = [0, 0, 3.1, 0.89, 0.59][tier];
  for (const side of [-1, 1]) {
    const z = side * 11.33;
    if (tier > 0) {
      const chain = [ends[0] + 1, 0, ends[1] - 1];
      path(
        'green',
        chain.map((x) => p(x, 2.19, z)),
        0.113,
        0.13,
      );
      path(
        'trim',
        chain.map((x) => p(x, 1.09, z)),
        0.082,
        0.09,
      );
      path(
        'green',
        chain.map((x) => p(x, 0.36, z)),
        0.1,
        0.115,
      );
    }
    if (tier > 1) {
      for (let x = ends[0] + 1.4; x < ends[1] - 1; x += detail) {
        const barWidth = Math.round((x - ends[0]) / detail) % 5 === 0 ? 0.1 : 0.045;
        bar('green', p(x, 0.16, z), p(x, 2.2, z), barWidth, barWidth);
      }
      const shoulder = side * 8.48;
      top(
        'white',
        ends[0] + 0.8,
        0,
        () => shoulder - 0.062,
        () => shoulder + 0.062,
        0.024,
      );
      top(
        'white',
        0,
        ends[1] - 0.8,
        () => shoulder - 0.062,
        () => shoulder + 0.062,
        0.024,
      );
      for (let x = ends[0] + 4; x < ends[1] - 6; x += 12) {
        const lane = side * 4.47;
        top(
          'white',
          x,
          x + 4.3,
          () => lane - 0.065,
          () => lane + 0.065,
          0.024,
        );
      }
      const median = side * 0.65;
      top(
        'yellow',
        ends[0] + 1,
        0,
        () => median - 0.061,
        () => median + 0.061,
        0.025,
      );
      top(
        'yellow',
        0,
        ends[1] - 1,
        () => median - 0.061,
        () => median + 0.061,
        0.025,
      );
    }
  }
  if (tier > 0)
    path(
      'bearing',
      [ends[0] + 0.7, 0, ends[1] - 0.7].map((x) => p(x, 0.13, 0)),
      0.58,
      0.25,
    );
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
