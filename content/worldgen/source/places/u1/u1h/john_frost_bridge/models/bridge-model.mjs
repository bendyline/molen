import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'john_frost_bridge',
  anchor: [5.911140932, 51.974305698],
  heading: 1.033427678263,
  datum: 4,
  ends: [-301.72, 301.96],
  halfWidth: 11.85,
  roadIds: [35184378968530, 35184378968539, 35184440220090],
  approachIds: [35184378968545, 35184536268170, 35184378967440, 35184398380190, 35184924203210],
  riverId: 35184380997340,
  bankIds: [
    35184378968280, 35184378968350, 35184378968500, 35184378968490, 35184917719260, 35184473425860,
    35184764305770, 35185292827920,
  ],
  curve: [
    [-301.72, -1.68],
    [-280.14, -0.75],
    [-42, -1.19],
    [181.66, 0.29],
    [264.37, 0.04],
    [301.96, -0.5],
  ],
  profile: [
    [-301.72, 7.12],
    [-249, 8.98],
    [-192, 9.78],
    [-130, 10.7],
    [-69, 12.0],
    [-40, 13.2],
    [10, 14.25],
    [70, 14.92],
    [130, 15.68],
    [180, 16.55],
    [224, 16.42],
    [271, 16.25],
    [293, 16.02],
    [301.96, 15.64],
  ],
  arch: [10, 130],
  approachPiers: [
    [-272, 5],
    [-243, 4],
    [-214, 5],
    [-185, 5],
    [-156, 5],
    [-127, 5],
    [-98, 5],
    [-63, 4.2],
    [216, 9.2],
    [224, 9.6],
    [252, 10.1],
    [276, 10.3],
  ],
};

function interpolate(x, points) {
  for (let i = 1; i < points.length; i++) {
    const [x0, value] = points[i - 1],
      [x1, next] = points[i];
    if (x <= x1) return value + (next - value) * Math.max(0, (x - x0) / (x1 - x0));
  }
  return points.at(-1)[1];
}

export const deckY = (x) => interpolate(x, bridgeControls.profile);
export const centerZ = (x) => interpolate(x, bridgeControls.curve);
export const deckEdges = (x) => [
  interpolate(x, [
    [-302, -11.72],
    [-45, -11.95],
    [180, -11.65],
    [302, -12.1],
  ]),
  interpolate(x, [
    [-302, 9.48],
    [-45, 9.62],
    [180, 11.48],
    [302, 11.82],
  ]),
];

function surface(slot, graph, hex) {
  const color = [0, 2, 4].map((offset) => {
    const v = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return { slot, graph, color };
}
const palette = {
  paint: surface('wall', 'metal_painted', 'd6d9d2'),
  dark: surface('wall', 'metal_painted', '525d60'),
  trim: surface('wall', 'metal_painted', 'aeb7b4'),
  orange: surface('wall', 'metal_painted', 'd9a94c'),
  paving: surface('foundation', 'concrete_plain', '737474'),
  lane: surface('foundation', 'concrete_plain', 'e1dfd2'),
  bike: surface('foundation', 'concrete_plain', 'a27366'),
  walk: surface('foundation', 'concrete_plain', 'aaa59a'),
  concrete: surface('foundation', 'concrete_plain', 'b2aca0'),
  pier: surface('foundation', 'stone_granite', '8d877d'),
  plinth: surface('foundation', 'stone_granite', '9e8978'),
};

export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([id, { color, ...binding }]) => [id, binding]),
);

export function buildBridgeLevel(out, level = 'master') {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw new Error(`Unknown John Frost Bridge detail level ${level}`);
  const {
    ends,
    arch: [archA, archB],
    approachPiers,
  } = bridgeControls;
  const p = (x, y, z) => [x, deckY(x) + y, z];
  const bar = (material, a, b, w, h = w) =>
    beam(out, material, a, b, w, h, palette[material].color);
  const path = (material, points, w, h = w) =>
    beamPath(out, material, points, w, h, palette[material].color);
  const body = (material, rings) => loft(out, material, rings, palette[material].color);
  function face(material, points, axis, sign) {
    if (normalFor(...points)[axis] * sign < 0) points.reverse();
    const add = (ring) =>
      out[ring.length === 3 ? 'addTriangle' : 'addQuad'](
        material,
        'palette:#ffffff',
        ring,
        normalFor(...ring),
        undefined,
        palette[material].color,
      );
    const n = normalFor(...points),
      r = points[3];
    if (r && Math.abs(n.reduce((sum, v, i) => sum + v * (r[i] - points[0][i]), 0)) > 0.00001) {
      add(points.slice(0, 3));
      add([points[0], points[2], points[3]]);
    } else add(points);
  }
  const lanes = (x) => [centerZ(x) - 7.15, centerZ(x) + 6.67];
  const stations = [
    ...new Set([
      ...bridgeControls.profile.map(([x]) => x),
      ...bridgeControls.curve.map(([x]) => x),
      -45,
      -40,
      180,
      290,
    ]),
  ].sort((a, b) => a - b);
  const top = (m, a, b, edge, height = 0) =>
    face(
      m,
      [
        p(a, height, edge(a)[0]),
        p(b, height, edge(b)[0]),
        p(b, height, edge(b)[1]),
        p(a, height, edge(a)[1]),
      ],
      1,
      1,
    );
  const roadEdges = (x) => lanes(x);
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    top('paving', a, b, roadEdges);
    top('bike', a, b, (x) => [deckEdges(x)[0], lanes(x)[0]]);
    top('bike', a, b, (x) => [lanes(x)[1], deckEdges(x)[1]]);
    for (const [side, index] of [
      [-1, 0],
      [1, 1],
    ]) {
      const za = deckEdges(a)[index],
        zb = deckEdges(b)[index];
      face('concrete', [p(a, 0, za), p(b, 0, zb), p(b, -0.74, zb), p(a, -0.74, za)], 2, side);
    }
    face(
      'concrete',
      [
        p(a, -0.74, deckEdges(a)[0]),
        p(b, -0.74, deckEdges(b)[0]),
        p(b, -0.74, deckEdges(b)[1]),
        p(a, -0.74, deckEdges(a)[1]),
      ],
      1,
      -1,
    );
  }
  for (const [x, sign] of [
    [ends[0], -1],
    [ends[1], 1],
  ]) {
    const [left, right] = deckEdges(x);
    face(
      'concrete',
      [p(x, 0, left), p(x, 0, right), p(x, -0.74, right), p(x, -0.74, left)],
      0,
      sign,
    );
    // The end deck tapers into the road and cycleway embankments.
    const z = centerZ(x);
    bar(
      'concrete',
      [x - sign * 0.65, deckY(x) - 2.9, z],
      [x - sign * 0.65, deckY(x) - 0.72, z],
      21.3,
      1.3,
    );
  }

  function support(x, bottom, width, depth, material) {
    const z = centerZ(x),
      top = deckY(x) - 0.74;
    const ring = (y, w, d) =>
      tier === 0
        ? [
            [x - w / 2, y, z - d / 2],
            [x - w / 2, y, z + d / 2],
            [x + w / 2, y, z + d / 2],
            [x + w / 2, y, z - d / 2],
          ]
        : chamferedRectangle(x, y, z, w, d, 0.32);
    body(material, [ring(bottom, width, depth), ring(top, width * 0.91, depth)]);
  }
  for (const [x, bottom] of approachPiers) {
    if (tier === 0) {
      support(x, bottom, 2.4, 9.4, 'concrete');
      continue;
    }
    const z = centerZ(x),
      top = deckY(x) - 1.15;
    for (const side of [-1, 1]) {
      const zz = z + side * 5.55;
      body('concrete', [
        chamferedRectangle(x, bottom, zz, 2.8, 2.65, 0.38),
        chamferedRectangle(x, top, zz, 2.18, 2.2, 0.3),
      ]);
    }
    bar('concrete', [x, top + 0.02, z - 8.15], [x, top + 0.02, z + 8.15], 2.2, 0.82);
  }
  function waterPier(x) {
    const z = centerZ(x),
      y = deckY(x) - 3.5;
    const count = [6, 10, 14, 18, 20][tier];
    function ring(height, w, d) {
      return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return [x + w * Math.cos(a), height, z - d * Math.sin(a)];
      });
    }
    body('pier', [ring(-2.4, 4.5, 10.6), ring(y - 0.6, 3.78, 9.8)]);
    body('plinth', [ring(y - 0.6, 3.85, 10), ring(y, 3.82, 9.95)]);
    if (tier > 1)
      for (const side of [-1, 1]) {
        bar('dark', p(x, -3.3, z + side * 5.7), p(x, -2.72, z + side * 5.7), 1.65, 1.45);
        bar(
          'orange',
          [x - 0.48, 7.6, z + side * 9.95],
          [x - 0.48, 8.72, z + side * 9.83],
          0.47,
          0.12,
        );
      }
  }
  waterPier(archA);
  waterPier(archB);
  support(-40, 2.4, 5.3, 19.7, 'plinth');
  support(180, 11.8, 6.15, 20.3, 'plinth');

  for (const side of [-1, 1]) {
    const z = (x) => centerZ(x) + side * 7.03;
    // The two deep plate girders run through the central and side spans.
    path(
      'paint',
      [-40, archA, 70, archB, 180].map((x) => p(x, -1.88, z(x))),
      0.83,
      3.62,
    );
    if (tier > 1) {
      path(
        'trim',
        [-40, archA, 70, archB, 180].map((x) => p(x, -3.65, z(x))),
        1.3,
        0.19,
      );
      for (let x = -34; x < 179; x += tier === 2 ? 6 : 4) {
        bar('trim', p(x, -3.28, z(x) + side * 0.35), p(x, -0.79, z(x) + side * 0.35), 0.15, 0.22);
        bar('trim', p(x, -2.08, z(x) + side * 0.43), p(x, -0.7, z(x) + side * 3.1), 0.2, 0.18);
      }
    }
    const segments = [8, 16, 22, 30, 34][tier];
    const spring = 0.57;
    function rib(u) {
      const x = archA + (archB - archA) * u;
      return p(x, spring + 17.5 * 4 * u * (1 - u), z(x));
    }
    path(
      'paint',
      Array.from({ length: segments + 1 }, (_, i) => rib(i / segments)),
      0.76,
      0.88,
    );
    const bays = tier === 0 ? 6 : 20;
    for (let i = 1; i < bays; i++) {
      const a = rib(i / bays),
        x = a[0];
      bar('paint', p(x, 0.25, z(x)), a, tier === 0 ? 0.27 : 0.22, tier === 0 ? 0.31 : 0.18);
    }
    if (tier > 1) {
      const edge = (x) => deckEdges(x)[side === -1 ? 0 : 1];
      const railRuns = [
        [ends[0], -47],
        [-43.7, 177.7],
        [181.1, ends[1]],
      ];
      for (const [start, end] of railRuns)
        for (const height of [0.34, 0.68, 1.05]) {
          const railStations = [start, ...stations.filter((x) => start < x && x < end), end];
          path(
            'trim',
            railStations.map((x) => p(x, height, edge(x) - side * 0.09)),
            height === 1.05 ? 0.082 : 0.049,
          );
        }
      const step = tier === 2 ? 4.5 : 3.15;
      for (let x = ends[0] + 2; x < ends[1] - 2; x += step) {
        if (!railRuns.some(([start, end]) => start < x && x < end)) continue;
        bar(
          'trim',
          p(x, 0.01, edge(x) - side * 0.09),
          p(x, 1.06, edge(x) - side * 0.09),
          0.074,
          0.087,
        );
      }
      for (let x = -290; x < 296; x += 29) {
        const zz = lanes(x)[side === -1 ? 0 : 1] + side * 0.2;
        bar('paint', p(x, 0.1, zz), p(x, 6.1, zz), 0.18, 0.21);
        bar('paint', p(x, 6.1, zz), p(x, 6.51, zz - side * 0.92), 0.14, 0.14);
        bar('dark', p(x, 6.51, zz - side * 0.87), p(x, 6.51, zz - side * 1.21), 0.25, 0.14);
      }
    } else if (tier === 1) {
      path(
        'trim',
        stations.map((x) => p(x, 0.98, deckEdges(x)[side === -1 ? 0 : 1])),
        0.11,
        0.13,
      );
    }
  }
  const roof = (u, side) => {
    const x = archA + (archB - archA) * u;
    return p(x, 0.57 + 17.5 * 4 * u * (1 - u), centerZ(x) + side * 7.03);
  };
  const braceCount = tier === 0 ? 4 : tier === 1 ? 8 : 16;
  for (let i = 1; i < braceCount; i++) {
    const u = i / braceCount,
      a = roof(u, -1),
      b = roof(u, 1),
      mid = roof(u + 0.75 / braceCount, 0);
    bar('paint', a, b, 0.25, 0.34);
    if (tier > 0) {
      bar('paint', a, mid, 0.2, 0.24);
      bar('paint', b, mid, 0.2, 0.24);
    }
  }

  function tower(x, z, side) {
    const y = deckY(x),
      bottom = 11.3,
      w = 4.8,
      d = 3.95;
    // Four piers around the visible through passage leave the flight open.
    for (const sign of [-1, 1]) {
      bar('plinth', [x, bottom, z + sign * 1.65], [x, y + 2.42, z + sign * 1.65], 0.92, w);
    }
    bar('concrete', [x, y + 2.11, z], [x, y + 4.76, z], d, w);
    bar('plinth', [x, y + 4.73, z], [x, y + 5.11, z], d + 0.41, w + 0.36);
    if (tier > 1) {
      bar('dark', [x, y + 3.64, z + side * 2.01], [x, y + 4.46, z + side * 2.01], 0.13, 1.18);
      bar('dark', [x + 2.44, y + 3.72, z], [x + 2.44, y + 4.45, z], 1.13, 0.13);
      bar(
        'plinth',
        [x, y + 4.51, z + side * 2.03],
        [x + 0.03, y + 4.51, z + side * 2.03],
        0.24,
        1.64,
      );
      if (side < 0) bar('dark', [x + 2.48, y + 1.15, z], [x + 2.48, y + 1.89, z], 0.72, 0.14);
    }
  }
  for (const side of [-1, 1]) tower(181.8, side === -1 ? -13.0 : 12.25, side);

  function stair(a, b, w, landingY) {
    const count = [2, 5, 14, 24, 28][tier],
      rise = a[1] - b[1],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      distance = Math.hypot(dx, dz);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count,
        y = a[1] - (rise * (i + 0.18)) / count,
        x = a[0] + dx * u,
        z = a[2] + dz * u;
      const half = distance / (2 * count) + 0.012,
        along = [dx / distance, dz / distance];
      bar(
        'plinth',
        [x - along[0] * half, y - 0.33, z - along[1] * half],
        [x + along[0] * half, y - 0.33, z + along[1] * half],
        w,
        0.66 + (rise / count) * 0.52,
      );
    }
    if (tier > 0) {
      const across = [dz / distance, -dx / distance];
      for (const side of [-1, 1]) {
        const offset = (q, y) => [
          q[0] + side * across[0] * w * 0.49,
          q[1] + y,
          q[2] + side * across[1] * w * 0.49,
        ];
        path('trim', [offset(a, 0.93), offset(b, 0.93)], 0.1, 0.11);
        const wallA = offset(a, -0.77),
          wallB = offset(b, -0.47);
        bar('plinth', wallA, wallB, 0.39, 0.72);
      }
    }
    bar(
      'plinth',
      [b[0], landingY - 0.55, b[2] - 0.78],
      [b[0], landingY - 0.55, b[2] + 0.78],
      w + 0.26,
      1.1,
    );
  }
  if (tier > 0) {
    for (const side of [-1, 1]) {
      const z = side === -1 ? -14.75 : 12.72;
      const edge = deckEdges(179.4)[side === -1 ? 0 : 1];
      bar('concrete', p(179.4, -0.21, edge + side * 0.25), p(179.4, -0.21, z), 2.95, 0.4);
      stair([179.4, deckY(179.4) - 0.02, z], [198.7, 10.8, z], 2.82, 10.8);
      const inside = side === -1 ? -10.8 : 8.7,
        outer = side === -1 ? -19.6 : 15.5;
      stair([-45.4, deckY(-45.4) - 0.08, inside], [-45.4, 11.4, outer], 2.35, 11.4);
      stair([-45.4, 11.4, outer], [-49.9, 5.7, outer], 2.25, 5.7);
    }
  }

  if (tier > 1) {
    for (const z of [-3.53, 0, 3.36]) {
      for (let x = -297; x < 298; x += 12) {
        top('lane', x, x + 4.7, (q) => [centerZ(q) + z - 0.082, centerZ(q) + z + 0.082], 0.016);
      }
    }
    for (const x of [-40, 10, 130, 180]) {
      const y = deckY(x),
        [a, b] = deckEdges(x);
      bar('dark', [x, y + 0.021, a + 0.08], [x, y + 0.021, b - 0.08], 0.16, 0.032);
    }
  }
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
