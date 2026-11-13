/** Victoria Memorial exterior with modeled sculpture, carved profiles and four viewer tiers. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const memorialSurfaces = {
  marble: { slot: 'wall', graph: 'stone_marble' },
  granite: { slot: 'foundation', graph: 'stone_granite' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.72, roughness: 0.48 },
  water: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'Still fountain water',
    metallic: 0.27,
    roughness: 0.24,
  },
};
const palette = {
  marble: 'e4dbca',
  dressed: 'f0e7d8',
  mortar: 'b7ad9d',
  ash: 'c4b6a2',
  path: 'c7b8a4',
  granite: 'a89c8d',
  edge: 'c5b59e',
  bronze: '534639',
  bronzeLit: '6d5a42',
  bronzeDark: '39382f',
  gold: 'e6b63f',
  goldLight: 'f4ca64',
  goldShade: 'c39532',
  pool: '4a796d',
  highlight: '679687',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((c) => {
      const n = parseInt(c, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  tau = Math.PI * 2;
const pt = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const { deckTop, waterHeight, rimHeight } = layout;
function face(out, slot, tint, points, expected) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, color[tint]);
  else if (points.length === 4) out.addQuad(slot, ref, points, n, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, points, n, (p) => [p[0], p[2]], color[tint]);
}
function edgeNormal([x, z], [a, b]) {
  return normalize([b - z, 0, x - a]);
}
function profile(out, slot, tint, rings, cap = false) {
  loft(out, slot, rings, color[tint], { cap });
}
function flat(out, slot, tint, triangles, y) {
  for (const t of triangles)
    face(
      out,
      slot,
      tint,
      t.map((p) => pt(p, y)),
      up,
    );
}
function wall(out, slot, tint, a, b, y0, y1, expected) {
  face(
    out,
    slot,
    tint,
    [pt(a, y0[0]), pt(b, y0[1]), pt(b, y1), pt(a, y1)],
    expected ?? edgeNormal(a, b),
  );
}
function shell(out, slot, tint, ring, foot, y) {
  for (const [i, a] of ring.entries()) {
    const j = (i + 1) % ring.length;
    wall(out, slot, tint, a, ring[j], [foot[i], foot[j]], y);
  }
}
function rect(out, slot, tint, [x, y, z], dx, dz, h) {
  profile(
    out,
    slot,
    tint,
    [chamferedRectangle(x, y, z, dx, dz, 0.08), chamferedRectangle(x, y + h, z, dx, dz, 0.08)],
    true,
  );
}
function radial(out, slot, tint, center, rows, sides, cap = false) {
  profile(
    out,
    slot,
    tint,
    rows.map(([y, a, b = a]) => radialRing(y, a, b, sides, center)),
    cap,
  );
}
function step(out, s, tier) {
  const { x, end, half, sign, y, bottom } = s;
  const front = [
      [x, -half],
      [x, half],
    ],
    back = [
      [end, -half],
      [end, half],
    ];
  face(
    out,
    'granite',
    'path',
    [pt(front[0], y), pt(front[1], y), pt(back[1], y), pt(back[0], y)],
    up,
  );
  wall(out, 'granite', 'edge', ...front, [bottom, bottom], y, [sign, 0, 0]);
  if (tier >= 1) {
    wall(out, 'granite', 'ash', front[0], back[0], [bottom, bottom], y, [0, 0, -1]);
    wall(out, 'granite', 'ash', back[1], front[1], [bottom, bottom], y, [0, 0, 1]);
  }
}
function basins(out, tier) {
  for (const p of layout.pools) {
    const rim = tier === 0 ? p.far : p.rim,
      inside = tier === 0 ? p.farInner : p.inner,
      foot = (tier === 0 ? p.farBottom : p.bottom).map((p) => p[2]);
    shell(out, 'marble', 'marble', rim, foot, rimHeight);
    for (const [i, a] of rim.entries()) {
      const j = (i + 1) % rim.length;
      face(
        out,
        'marble',
        'dressed',
        [
          pt(a, rimHeight),
          pt(rim[j], rimHeight),
          pt(inside[j], rimHeight),
          pt(inside[i], rimHeight),
        ],
        up,
      );
      if (tier >= 1) {
        const n = edgeNormal(inside[j], inside[i]);
        wall(
          out,
          'marble',
          'ash',
          inside[i],
          inside[j],
          [waterHeight - 0.021, waterHeight - 0.021],
          rimHeight,
          n,
        );
        const trim = 0.102;
        wall(
          out,
          'granite',
          'edge',
          a,
          rim[j],
          [rimHeight - trim, rimHeight - trim],
          rimHeight,
          edgeNormal(a, rim[j]),
        );
      }
    }
    flat(out, 'water', 'pool', tier === 0 ? p.farWater : p.water, waterHeight);
  }
  for (const patch of layout.deck) {
    const ring = patch.ring.map(([x, z]) => [x, z]);
    shell(
      out,
      'granite',
      'marble',
      ring,
      patch.ring.map((p) => p[2]),
      deckTop,
    );
    flat(out, 'granite', 'path', patch.triangles, deckTop);
  }
  for (const stair of layout.stairs) step(out, stair, tier);
}
function mold(out, tier, rows) {
  for (const [i, [y, r, d = r]] of rows.entries()) {
    if (i === 0) continue;
    const [priorY, priorR, priorD = priorR] = rows[i - 1];
    const make = (h, w, z) =>
      tier === 0
        ? [
            [-w, h, -z],
            [-w, h, z],
            [w, h, z],
            [w, h, -z],
          ]
        : chamferedRectangle(0, h, 0, w * 2, z * 2, 0.29);
    profile(out, 'marble', i % 4 === 1 ? 'dressed' : 'marble', [
      make(priorY, priorR, priorD),
      make(y, r, d),
    ]);
  }
}
function frame(yaw, origin = [0, 0, 0], scale = 1) {
  const s = Math.sin(yaw),
    c = Math.cos(yaw);
  // Figure space uses +Z forward. All geographic anchors remain in monument space.
  return ([u, y, v]) => [
    origin[0] + scale * (s * u + c * v),
    origin[1] + scale * y,
    origin[2] + scale * (-c * u + s * v),
  ];
}
function sculptureFrame(yaw, origin = [0, 0, 0], scale = 1) {
  return { p: frame(yaw, origin, scale), scale, normal: [Math.cos(yaw), 0, Math.sin(yaw)] };
}
function gem(out, f, slot, tint, [x, y, z], [a, b, c]) {
  const center = f.p([x, y, z]),
    peaks = [f.p([x, y + b, z]), f.p([x, y - b, z])];
  const edge = [
    [x + a, y, z],
    [x, y, z + c],
    [x - a, y, z],
    [x, y, z - c],
  ].map(f.p);
  for (const peak of peaks)
    for (const [i, q] of edge.entries()) {
      const r = edge[(i + 1) % 4];
      const normal = q.map((v, k) => v + r[k] + peak[k] - 3 * center[k]);
      face(out, slot, tint, [peak, q, r], normal);
    }
}
function ball(out, f, slot, tint, p, r, n, m) {
  // A sphere is sampled in figure space so its facial proportions also rotate with the pose.
  const rings = Array.from({ length: m - 1 }, (_, i) => {
    const lat = -Math.PI / 2 + ((i + 1) * Math.PI) / m;
    return Array.from({ length: n }, (_, j) => {
      const a = (-j * tau) / n;
      return f.p([
        p[0] + r[0] * Math.cos(lat) * Math.cos(a),
        p[1] + r[1] * Math.sin(lat),
        p[2] + r[2] * Math.cos(lat) * Math.sin(a),
      ]);
    });
  });
  profile(out, slot, tint, rings, true);
}
function anatomy(out, f, slot, tint, points, sides, { cap = true } = {}) {
  const centers = points.map((p) => p.slice(0, 3));
  const major = normalize(centers.at(-1).map((v, i) => v - centers[0][i]));
  const guide = Math.abs(major[2]) < 0.87 ? [0, 0, 1] : [1, 0, 0];
  const rings = points.map(([x, y, z, w, d], i) => {
    const a = centers[Math.max(0, i - 1)],
      b = centers[Math.min(centers.length - 1, i + 1)],
      axis = normalize(b.map((v, k) => v - a[k]));
    const side = normalize(cross(axis, guide)),
      upward = cross(axis, side);
    return Array.from({ length: sides }, (_, j) => {
      const t = (j * tau) / sides;
      return f.p(
        [x, y, z].map((v, k) => v + side[k] * w * Math.cos(t) + upward[k] * d * Math.sin(t)),
      );
    });
  });
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j],
      center = f.p(mix(centers[j - 1], centers[j], 0.5));
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides;
      for (const triangle of [
        [a[i], a[k], b[k]],
        [a[i], b[k], b[i]],
      ]) {
        const expected = triangle[0].map(
          (_, v) => triangle[0][v] + triangle[1][v] + triangle[2][v] - 3 * center[v],
        );
        face(out, slot, tint, triangle, expected);
      }
    }
  }
  if (cap) {
    const a = f.p(centers[0]),
      b = f.p(centers.at(-1)),
      direction = b.map((v, i) => v - a[i]);
    face(
      out,
      slot,
      tint,
      rings[0],
      direction.map((v) => -v),
    );
    face(out, slot, tint, rings.at(-1), direction);
  }
}
function robe(out, f, slot, tint, rows, tier, pleat = 0.09) {
  const facets = [6, 8, 12, 20, 24][tier];
  const rings = rows.map(([y, x, z, w, d], k) =>
    Array.from({ length: facets }, (_, j) => {
      const a = (-j * tau) / facets,
        fold = 1 + pleat * Math.sin(5 * a + k * 0.54) + pleat * 0.56 * Math.cos(9 * a - k * 0.42);
      return f.p([x + Math.cos(a) * w * fold, y, z + Math.sin(a) * d * fold]);
    }),
  );
  profile(out, slot, tint, rings, true);
}
function head(out, f, slot, tint, p, tier, { crown = false, veil = false } = {}) {
  const [x, y, z] = p,
    n = [6, 8, 12, 18, 20][tier],
    m = [4, 5, 7, 10, 11][tier];
  ball(out, f, slot, tint, [x, y, z], [0.234, 0.334, 0.225], n, m);
  if (tier < 2) return;
  ball(out, f, slot, tint, [x - 0.012, y - 0.058, z + 0.19], [0.154, 0.183, 0.081], n, m - 2);
  ball(out, f, slot, tint, [x - 0.014, y - 0.015, z + 0.256], [0.056, 0.073, 0.05], 7, 5);
  const eye = tint.startsWith('gold') ? 'goldShade' : slot === 'bronze' ? 'bronzeDark' : 'mortar';
  for (const sign of [-1, 1]) {
    ball(out, f, slot, eye, [x + sign * 0.087, y + 0.045, z + 0.207], [0.052, 0.014, 0.015], 7, 4);
    ball(out, f, slot, tint, [x + sign * 0.218, y - 0.032, z - 0.008], [0.041, 0.082, 0.047], 8, 5);
  }
  ball(out, f, slot, eye, [x - 0.01, y - 0.116, z + 0.242], [0.071, 0.011, 0.014], 7, 4);
  if (veil)
    robe(
      out,
      f,
      slot,
      tint,
      [
        [y - 0.63, x, z - 0.1, 0.33, 0.21],
        [y - 0.21, x, z - 0.09, 0.28, 0.22],
        [y + 0.17, x, z - 0.04, 0.248, 0.23],
        [y + 0.29, x, z - 0.025, 0.19, 0.18],
      ],
      tier,
      0.043,
    );
  if (crown) {
    robe(
      out,
      f,
      slot,
      tint,
      [
        [y + 0.173, x, z, 0.232, 0.235],
        [y + 0.25, x, z, 0.245, 0.244],
        [y + 0.34, x, z, 0.176, 0.178],
      ],
      tier,
      0.036,
    );
    for (let j = 0; j < 7; j++) {
      const a = (j * tau) / 7,
        px = x + 0.218 * Math.cos(a),
        pz = z + 0.218 * Math.sin(a);
      beam(
        out,
        slot,
        f.p([px, y + 0.245, pz]),
        f.p([px + 0.02 * Math.cos(a), y + 0.42 + (j % 2) * 0.032, pz]),
        0.059 * f.scale,
        0.057 * f.scale,
        color[tint],
      );
    }
  }
}
function limb(out, f, slot, tint, shoulder, elbow, hand, tier) {
  const n = [5, 6, 8, 11, 13][tier],
    mid = mix(elbow, hand, 0.49);
  anatomy(
    out,
    f,
    slot,
    tint,
    [
      [...shoulder, 0.183, 0.164],
      [...mix(shoulder, elbow, 0.43), 0.147, 0.132],
      [...elbow, 0.102, 0.094],
      [...mid, 0.102, 0.084],
      [...hand, 0.066, 0.058],
    ],
    n,
  );
  if (tier >= 2) {
    ball(
      out,
      f,
      slot,
      tint,
      [hand[0], hand[1] - 0.06, hand[2] + 0.025],
      [0.087, 0.123, 0.066],
      n,
      6,
    );
    if (tier >= 3)
      for (let j = 0; j < 4; j++) {
        const x = hand[0] + (j - 1.5) * 0.039;
        beam(
          out,
          slot,
          f.p([x, hand[1] - 0.07, hand[2] + 0.055]),
          f.p([x + 0.008, hand[1] - 0.173 - (j % 2) * 0.018, hand[2] + 0.075]),
          0.026 * f.scale,
          0.028 * f.scale,
          color[tint],
        );
      }
  }
}
function wings(out, f, tint, tier) {
  const featherCount = [3, 5, 8, 12, 15][tier];
  for (const sign of [-1, 1]) {
    const q = (x, y, z) => f.p([sign * x, y, z]);
    const top = q(1.68, 3.02, -0.31),
      root = q(0.17, 1.66, -0.24),
      joint = q(0.7, 2.45, -0.33),
      tail = q(1.14, 1.9, -0.49);
    const n = normalize(f.normal.map((v, i) => v + (i === 1 ? 0.22 : 0)));
    face(out, 'bronze', tint, [root, top, joint], n);
    face(out, 'bronze', 'goldShade', [root, tail, top], n);
    face(
      out,
      'bronze',
      tint,
      [root, joint, top],
      n.map((v) => -v),
    );
    face(
      out,
      'bronze',
      'goldShade',
      [root, top, tail],
      n.map((v) => -v),
    );
    for (let i = 0; i < featherCount; i++) {
      const t = i / (featherCount - 1),
        a = q(lerp(0.23, 0.68, t), lerp(1.86, 2.49, t), -0.23),
        b = q(lerp(0.67, 1.69, t), lerp(1.44, 3.04, t), lerp(-0.43, -0.27, t));
      const ridge = mix(a, b, 0.63),
        breadth = [0, 0.094 * (1 - t * 0.35), 0.038];
      const low = ridge.map((x, k) => x - breadth[k]),
        high = ridge.map((x, k) => x + breadth[k]);
      face(out, 'bronze', i % 3 === 0 ? 'goldLight' : 'gold', [a, low, b], n);
      face(out, 'bronze', 'goldShade', [a, b, high], n);
      if (tier >= 2) {
        const offset = n.map((v) => v * 0.045 * f.scale),
          raised = ridge.map((v, k) => v + offset[k]);
        face(out, 'bronze', 'goldLight', [low, raised, b], n);
        face(out, 'bronze', 'gold', [raised, high, b], n);
      }
    }
  }
}
function standing(
  out,
  f,
  slot,
  tint,
  tier,
  { left, right, twist = 0.05, veil = false, crown = false },
) {
  const body =
    tier < 2
      ? [
          [0.01, -0.15, 0.01, 0.43, 0.38],
          [1.02, twist, 0, 0.33, 0.24],
          [1.49, twist, 0.02, 0.24, 0.2],
          [1.88, 0.03, 0.01, 0.41, 0.2],
          [2.04, 0, 0.01, 0.17, 0.15],
        ]
      : [
          [0.01, -0.15, 0.01, 0.43, 0.38],
          [0.15, -0.17, 0.05, 0.5, 0.43],
          [0.5, -0.11, 0.1, 0.41, 0.33],
          [0.84, -0.04, 0.11, 0.36, 0.3],
          [1.03, twist, 0.02, 0.32, 0.25],
          [1.24, twist + 0.025, 0.01, 0.28, 0.22],
          [1.47, twist + 0.02, 0.03, 0.24, 0.2],
          [1.65, twist, 0.04, 0.33, 0.246],
          [1.87, 0.03, 0.02, 0.39, 0.225],
          [2.04, 0, 0.005, 0.173, 0.16],
          [2.16, 0.01, 0.015, 0.136, 0.135],
        ];
  robe(out, f, slot, tint, body, tier, tier >= 2 ? 0.133 : 0.06);
  head(out, f, slot, tint, [0.015, 2.35, 0.029], tier, { veil, crown });
  limb(out, f, slot, tint, [-0.35, 1.87, 0], left[0], left[1], tier);
  limb(out, f, slot, tint, [0.37, 1.87, 0], right[0], right[1], tier);
}
function sitting(out, f, slot, tint, tier, { queen = false, direction = 1 } = {}) {
  const rows =
    tier < 2
      ? [
          [0.05, 0, 0.41, 0.55, 0.6],
          [0.55, -0.02, 0.37, 0.54, 0.56],
          [1.08, 0, 0.19, 0.5, 0.5],
          [1.69, 0.02, 0.02, 0.32, 0.255],
          [2.21, 0.03, 0.01, 0.41, 0.25],
          [2.42, 0.03, 0, 0.16, 0.18],
        ]
      : [
          [0.05, 0, 0.41, 0.54, 0.6],
          [0.24, -0.04, 0.42, 0.61, 0.64],
          [0.55, -0.05, 0.37, 0.54, 0.55],
          [0.87, -0.025, 0.3, 0.6, 0.56],
          [1.13, -0.015, 0.22, 0.46, 0.46],
          [1.4, 0.005, 0.05, 0.4, 0.29],
          [1.7, 0.02, 0, 0.33, 0.27],
          [1.96, 0.02, 0.04, 0.35, 0.277],
          [2.21, 0.03, 0.01, 0.43, 0.246],
          [2.42, 0.03, 0, 0.16, 0.18],
        ];
  robe(out, f, slot, tint, rows, tier, queen ? 0.14 : 0.1);
  head(out, f, slot, tint, [0.035, 2.68, 0.024], tier, { crown: queen, veil: queen });
  const left = queen
    ? [
        [-0.52, 1.67, 0.27],
        [-0.3, 1.31, 0.72],
      ]
    : [
        [-0.62, 1.8, 0.22],
        [-0.43, 1.65, 0.6],
      ];
  const right = queen
    ? [
        [0.58, 1.83, 0.25],
        [0.54, 2.05, 0.56],
      ]
    : [
        [0.65, 1.94, 0.19],
        [0.84, 2.3, 0.34],
      ];
  limb(out, f, slot, tint, [-0.38, 2.22, 0], left[0], left[1], tier);
  limb(out, f, slot, tint, [0.41, 2.21, 0], right[0], right[1], tier);
  if (tier >= 2) {
    const r = right[1],
      s = f.scale;
    if (queen) {
      beam(
        out,
        slot,
        f.p([r[0], r[1] - 0.38, r[2]]),
        f.p([r[0] + 0.06, r[1] + 0.84, r[2] - 0.11]),
        0.07 * s,
        0.069 * s,
        color.dressed,
      );
      ball(
        out,
        f,
        slot,
        'dressed',
        [r[0] + 0.06, r[1] + 0.86, r[2] - 0.11],
        [0.086, 0.094, 0.09],
        9,
        6,
      );
      const chain = Array.from({ length: 11 }, (_, i) => {
        const u = (i - 5) / 5;
        return f.p([u * 0.36, 1.96 + 0.23 * u * u, 0.3]);
      });
      beamPath(out, slot, chain, 0.047 * s, 0.039 * s, color.dressed);
    } else
      beam(
        out,
        slot,
        f.p([r[0], r[1] - 0.48, r[2]]),
        f.p([r[0] + 0.2 * direction, r[1] + 0.36, r[2] + 0.05]),
        0.067 * s,
        0.068 * s,
        color[tint],
      );
  }
}
function lion(out, f, tier, variant) {
  const n = [5, 8, 10, 15, 19][tier],
    shade = 'bronze',
    axis = [
      [-0.04, 0.75, -0.88, 0.33, 0.36],
      [0, 0.9, -0.5, 0.42, 0.43],
      [0, 0.99, 0.18, 0.4, 0.45],
      [0, 1.17, 0.66, 0.39, 0.49],
      [0.04, 1.23, 0.91, 0.29, 0.34],
    ];
  anatomy(out, f, 'bronze', shade, axis, n);
  robe(
    out,
    f,
    'bronze',
    'bronzeLit',
    [
      [0.89, 0.03, 0.84, 0.21, 0.24],
      [1.2, 0.03, 0.89, 0.4, 0.36],
      [1.45, 0.02, 0.94, 0.44, 0.38],
      [1.69, 0.04, 1.02, 0.31, 0.32],
    ],
    tier,
    0.15,
  );
  ball(out, f, 'bronze', shade, [0.035, 1.53, 1.19], [0.302, 0.258, 0.278], n, Math.max(4, n - 4));
  ball(
    out,
    f,
    'bronze',
    'bronzeLit',
    [0.04, 1.39, 1.41],
    [0.193, 0.156, 0.193],
    n,
    Math.max(4, n - 4),
  );
  for (const side of [-1, 1]) {
    for (const [z, h, end] of [
      [0.52, 0.82, 0.82],
      [-0.68, 0.75, -0.53],
    ]) {
      const stride = side * (variant % 2 ? 1 : -1) * 0.14;
      anatomy(
        out,
        f,
        'bronze',
        shade,
        [
          [side * 0.245, h, z, 0.157, 0.17],
          [side * 0.29, 0.52, z - 0.13, 0.122, 0.11],
          [side * 0.31, 0.21, end + stride, 0.088, 0.085],
          [side * 0.3, 0.08, end + 0.13 + stride, 0.121, 0.128],
        ],
        n,
      );
    }
    if (tier >= 2) {
      ball(
        out,
        f,
        'bronze',
        'bronzeDark',
        [0.04 + side * 0.126, 1.55, 1.366],
        [0.049, 0.032, 0.033],
        8,
        5,
      );
      ball(
        out,
        f,
        'bronze',
        shade,
        [0.04 + side * 0.223, 1.73, 1.115],
        [0.077, 0.095, 0.051],
        9,
        5,
      );
      ball(out, f, 'bronze', 'bronzeDark', [0.038, 1.42, 1.574], [0.105, 0.061, 0.029], 9, 5);
      const tufts = tier >= 3 ? 12 : 7;
      for (let j = 0; j < tufts; j++) {
        const t = j / (tufts - 1),
          a = t * Math.PI;
        anatomy(
          out,
          f,
          'bronze',
          j % 2 ? 'bronze' : 'bronzeLit',
          [
            [side * 0.29, 1.47 + 0.17 * Math.cos(a), 0.88 + 0.27 * Math.sin(a), 0.067, 0.069],
            [side * 0.39, 1.32 + 0.16 * Math.cos(a), 0.7 + 0.28 * Math.sin(a), 0.048, 0.056],
            [side * 0.36, 1.24 + 0.13 * Math.cos(a), 0.64 + 0.28 * Math.sin(a), 0.018, 0.02],
          ],
          6,
        );
      }
    }
  }
  const tail = [
    f.p([0.03, 0.93, -0.89]),
    f.p([0.24, 0.77, -1.24]),
    f.p([0.39, 0.41, -1.4]),
    f.p([0.52, 0.27, -1.14]),
    f.p([0.45, 0.31, -0.79]),
  ];
  if (tier >= 1) beamPath(out, 'bronze', tail, 0.085 * f.scale, 0.086 * f.scale, color.bronze);
}
function distantFigure(out, f, slot, tint, left, right, { seated = false } = {}) {
  const upper = seated ? 2.19 : 1.89;
  const body = seated
    ? [
        [0.02, 0, 0.36, 0.55, 0.59],
        [1.04, 0, 0.24, 0.51, 0.51],
        [1.47, 0.01, 0.06, 0.35, 0.26],
        [2.17, 0, 0, 0.4, 0.24],
        [2.41, 0, 0, 0.15, 0.16],
      ]
    : [
        [0.02, -0.11, 0.03, 0.43, 0.37],
        [0.92, -0.035, 0.02, 0.3, 0.25],
        [1.4, 0, 0.02, 0.24, 0.2],
        [1.87, 0, 0.01, 0.39, 0.24],
        [2.1, 0, 0, 0.14, 0.13],
      ];
  robe(out, f, slot, tint, body, 0, 0.035);
  const y = seated ? 2.66 : 2.34;
  gem(out, f, slot, tint, [0, y, 0.03], [0.23, 0.34, 0.225]);
  for (const [i, [elbow, hand]] of [left, right].entries()) {
    const shoulder = [i === 0 ? -0.35 : 0.35, upper, 0];
    anatomy(
      out,
      f,
      slot,
      tint,
      [
        [...shoulder, 0.15, 0.15],
        [...elbow, 0.1, 0.1],
        [...hand, 0.058, 0.065],
      ],
      4,
      { cap: false },
    );
  }
}
function statuary(out, tier) {
  for (const {
    position: [x, z],
    orientation,
    base,
    foot,
    plinth,
    i,
  } of layout.monuments) {
    if (plinth) {
      shell(
        out,
        'marble',
        'ash',
        plinth,
        plinth.map(() => foot),
        base,
      );
      face(
        out,
        'marble',
        'dressed',
        plinth.map((p) => pt(p, base)),
        up,
      );
      const [a, b] = plinth.reduce(
        ([a, b], p) => [Math.min(a, p[0]), Math.max(b, p[0])],
        [Infinity, -Infinity],
      );
      const [c, d] = plinth.reduce(
        ([a, b], p) => [Math.min(a, p[1]), Math.max(b, p[1])],
        [Infinity, -Infinity],
      );
      if (tier > 0)
        rect(
          out,
          'marble',
          'dressed',
          [(a + b) / 2, base - 0.18, (c + d) / 2],
          b - a + 0.12,
          d - c + 0.11,
          0.2,
        );
      if (tier > 0) {
        for (const side of tier === 1 ? [0] : [-1, 1]) {
          const f = sculptureFrame(orientation, [x + side * 1.48, base, z], 0.73);
          if (tier < 3)
            distantFigure(
              out,
              f,
              'marble',
              'marble',
              [
                [-0.51, 1.84, 0.24],
                [-0.33, 1.47, 0.56],
              ],
              [
                [0.63, 1.93, 0.14],
                [0.82, 2.22, 0.38],
              ],
              { seated: true },
            );
          else sitting(out, f, 'marble', 'marble', tier, { direction: side });
        }
      }
      if (tier === 0)
        gem(
          out,
          sculptureFrame(orientation, [x, base, z], 0.82),
          'marble',
          'dressed',
          [0, 1.2, 0],
          [0.68, 1.18, 0.56],
        );
      continue;
    }
    const h = base + 0.35;
    if (tier === 0) {
      const p = [
        [x - 1.88, z - 1.37],
        [x + 1.88, z - 1.37],
        [x + 1.88, z + 1.37],
        [x - 1.88, z + 1.37],
      ];
      shell(
        out,
        'marble',
        'ash',
        p,
        p.map(() => foot),
        h,
      );
      flat(
        out,
        'marble',
        'dressed',
        [
          [p[0], p[1], p[2]],
          [p[0], p[2], p[3]],
        ],
        h,
      );
    } else rect(out, 'marble', 'ash', [x, foot, z], 3.75, 2.75, h - foot);
    if (tier >= 1) rect(out, 'marble', 'dressed', [x, h - 0.095, z], 4.02, 2.96, 0.21);
    const f = sculptureFrame(
      orientation + Math.PI * 0.23,
      [x + (x > 0 ? -0.53 : 0.53), h + 0.11, z],
      1.15,
    );
    if (tier === 0) {
      gem(out, f, 'bronze', 'bronze', [0, 0.9, 0], [0.44, 0.81, 1.02]);
      gem(out, f, 'bronze', 'bronze', [0, 1.55, 0.87], [0.37, 0.47, 0.4]);
      gem(out, f, 'bronze', 'bronze', [0.26, 1.5, -0.49], [0.36, 1.4, 0.43]);
      continue;
    }
    if (tier === 1) {
      anatomy(
        out,
        f,
        'bronze',
        'bronze',
        [
          [0, 0.84, -0.93, 0.3, 0.4],
          [0, 1.02, 0.16, 0.41, 0.46],
          [0, 1.24, 0.84, 0.34, 0.41],
        ],
        5,
      );
      gem(out, f, 'bronze', 'bronzeLit', [0, 1.49, 1.07], [0.31, 0.33, 0.36]);
      for (const sign of [-1, 1])
        for (const z of [-0.7, 0.7])
          anatomy(
            out,
            f,
            'bronze',
            'bronze',
            [
              [sign * 0.24, 0.79, z, 0.16, 0.15],
              [sign * 0.28, 0.09, z + 0.19, 0.104, 0.113],
            ],
            4,
            { cap: false },
          );
    } else lion(out, f, tier === 2 ? 1 : tier, i);
    const g = sculptureFrame(
      orientation + Math.PI * 0.09,
      [x + (x > 0 ? 0.26 : -0.26), h + 0.11, z + Math.sign(z) * 0.73],
      1.18,
    );
    const poses = [
      [
        [-0.69, 2.06, 0.04],
        [-0.89, 2.69, 0.24],
        [
          [0.62, 1.44, 0.3],
          [0.79, 1.23, 0.41],
        ],
      ],
      [
        [-0.61, 1.48, 0.32],
        [-0.81, 1.32, 0.58],
        [
          [0.53, 2.09, 0.2],
          [0.76, 2.72, 0.29],
        ],
      ],
      [
        [-0.64, 2.04, 0.19],
        [-0.75, 2.38, 0.44],
        [
          [0.58, 1.53, 0.18],
          [0.71, 1.31, 0.48],
        ],
      ],
      [
        [-0.55, 1.54, 0.25],
        [-0.78, 1.24, 0.45],
        [
          [0.63, 1.96, 0.22],
          [0.87, 2.48, 0.3],
        ],
      ],
    ];
    const [a, b, right] = poses[(i - 2 + 4) % 4];
    if (tier < 3) distantFigure(out, g, 'bronze', 'bronzeLit', [a, b], right);
    else
      standing(out, g, 'bronze', 'bronzeLit', tier, {
        left: [a, b],
        right,
        twist: i % 2 ? 0.14 : -0.1,
      });
    if (tier >= 2) {
      const palm = i % 2 ? right[1] : b,
        tip = [palm[0] + (i % 2 ? 0.34 : -0.31), palm[1] + 0.68, palm[2] - 0.1];
      beam(out, 'bronze', g.p(mix(palm, tip, -0.4)), g.p(tip), 0.059, 0.067, color.bronzeLit);
      for (let j = 0; j < 5; j++) {
        const p = mix(palm, tip, 0.22 + j * 0.17);
        beam(
          out,
          'bronze',
          g.p(p),
          g.p([p[0] + (j % 2 ? -0.14 : 0.14), p[1] + 0.15, p[2] + 0.04]),
          0.027,
          0.037,
          color.bronzeLit,
        );
      }
    }
  }
}
function cartouche(out, f, tier) {
  if (tier < 2) return;
  const g = (x, y, z) => f.p([x, y, z]);
  ball(out, f, 'marble', 'dressed', [0, 0, 0], [0.62, 0.51, 0.09], tier >= 3 ? 18 : 10, 7);
  for (const sign of [-1, 1]) {
    const count = tier >= 3 ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1),
        x = sign * (0.2 + t * 1.47),
        y = 0.24 - t * 0.21,
        z = -0.03 + t * 0.03;
      const base = g(x, y, z),
        tip = g(x + sign * 0.28, y - 0.43 + t * 0.19, z + 0.13),
        lip = g(x + sign * 0.13, y - 0.18, z + 0.17);
      face(out, 'marble', i % 2 ? 'marble' : 'dressed', [base, lip, tip], f.normal);
      face(out, 'marble', 'ash', [base, tip, g(x + sign * 0.07, y - 0.28, z + 0.095)], f.normal);
    }
  }
}
function throne(out, f, tier) {
  // The base starts inside the upper marble drum and flares beneath the seated figure.
  const make = (y, width, front, back) =>
    [
      [-width, y, back],
      [-width, y, front - 0.22],
      [-width + 0.2, y, front],
      [width - 0.2, y, front],
      [width, y, front - 0.22],
      [width, y, back],
    ].map(f.p);
  const lower = make(-0.82, 0.61, 0.83, -0.57),
    middle = make(-0.31, 0.73, 0.9, -0.57),
    top = make(0.055, 0.72, 0.97, -0.6);
  profile(out, 'marble', 'marble', [lower, middle, top], true);
  if (tier >= 2) {
    profile(
      out,
      'marble',
      'dressed',
      [make(-0.055, 0.76, 1.02, -0.59), make(0.071, 0.76, 1.02, -0.59)],
      true,
    );
    for (const side of [-1, 1]) {
      const curve = [
        [0.59, -0.61, 0.68],
        [0.64, -0.47, 0.81],
        [0.68, -0.23, 0.88],
        [0.71, 0.01, 0.9],
      ].map(([u, y, z]) => f.p([u * side, y, z]));
      beamPath(out, 'marble', curve, 0.177 * f.scale, 0.133 * f.scale, color.dressed);
    }
  }
}
function pedestal(out, tier) {
  const shape = layout.shape,
    ring = tier === 0 ? shape.far : shape.exact;
  shell(
    out,
    'marble',
    'marble',
    ring,
    ring.map(() => deckTop - 0.025),
    3.01,
  );
  flat(out, 'marble', 'dressed', tier === 0 ? shape.farTriangles : shape.triangles, 3.01);
  const n = [8, 12, 18, 28, 36][tier];
  radial(
    out,
    'marble',
    'marble',
    [0, 0],
    tier < 2
      ? [
          [2.98, 6.65],
          [3.32, 6.61],
          [4.35, 5.47],
          [4.58, 4.54],
        ]
      : [
          [2.98, 6.65],
          [3.16, 6.65],
          [3.2, 6.51],
          [3.43, 6.52],
          [3.57, 6.26],
          [3.72, 6.16],
          [4.14, 5.68],
          [4.36, 5.62],
          [4.56, 4.54],
        ],
    n,
  );
  radial(
    out,
    'marble',
    'dressed',
    [0, 0],
    [
      [4.43, 4.57],
      [4.61, 4.57],
      [4.83, 4.27],
      [5.08, 4.18],
    ],
    n,
  );
  const courses =
    tier === 0
      ? [
          [4.76, 3.09],
          [6.12, 2.41],
          [13.18, 1.95],
          [16.45, 1.6],
          [17.33, 2.14],
          [18.02, 2.21],
          [18.55, 1.43],
        ]
      : [
          [4.76, 3.09],
          [5.19, 3.09],
          [5.45, 2.92],
          [6.12, 2.41],
          [7.03, 2.27],
          [12.7, 2.12],
          [13.2, 1.95],
          [14.86, 1.82],
          [16.45, 1.6],
          [16.73, 1.67],
          [16.86, 1.89],
          [17.07, 1.98],
          [17.3, 2.14],
          [17.57, 2.17],
          [17.68, 2.21],
          [18.02, 2.21],
          [18.19, 1.83],
          [18.55, 1.43],
        ];
  mold(out, tier, courses);
  for (let side = 0; side < 4; side++) {
    const yaw = (side * Math.PI) / 2,
      face = sculptureFrame(yaw);
    const C = face.p;
    if (tier >= 1) {
      const f = sculptureFrame(yaw, [Math.cos(yaw) * 2.12, 6.2, Math.sin(yaw) * 2.12], 1.65);
      throne(out, f, tier);
      if (tier === 1 || (tier === 2 && side !== 0)) {
        distantFigure(
          out,
          f,
          'marble',
          'dressed',
          [
            [-0.53, 1.7, 0.25],
            [-0.38, 1.37, 0.56],
          ],
          [
            [0.63, 1.9, 0.25],
            [0.58, 2.05, 0.46],
          ],
          { seated: true },
        );
      } else
        sitting(out, f, 'marble', 'dressed', tier, {
          queen: side === 0,
          direction: side === 1 ? 1 : -1,
        });
      if (tier >= 2) {
        const steps = 11;
        const arch = Array.from({ length: steps }, (_, i) => {
          const t = (i * Math.PI) / (steps - 1);
          return C([1.48 * Math.cos(t), 11.56 + 1.53 * Math.sin(t), 2.13]);
        });
        beamPath(out, 'marble', arch, 0.153, 0.139, color.dressed);
        for (const sign of [-1, 1]) {
          beam(
            out,
            'marble',
            C([sign * 1.48, 7.34, 2.13]),
            C([sign * 1.48, 11.56, 2.13]),
            0.15,
            0.16,
            color.dressed,
          );
          beam(
            out,
            'marble',
            C([sign * 1.63, 13.31, 2.02]),
            C([sign * 1.45, 16.59, 1.78]),
            0.13,
            0.146,
            color.ash,
          );
        }
        cartouche(out, sculptureFrame(yaw, C([0, 15.31, 1.88]), 0.73), tier);
      }
    } else if (side === 0) {
      throne(out, sculptureFrame(0, [2.12, 6.2, 0], 1.65), 0);
      gem(
        out,
        sculptureFrame(0, [3.3, 5.22, 0], 1.6),
        'marble',
        'dressed',
        [0, 1.32, 0.23],
        [0.49, 1.3, 0.41],
      );
      gem(
        out,
        sculptureFrame(0, [3.4, 5.2, 0], 1.6),
        'marble',
        'dressed',
        [0, 2.66, 0.09],
        [0.21, 0.28, 0.22],
      );
    }
  }
}
function crown(out, tier) {
  const n = [7, 12, 16, 24, 30][tier];
  radial(
    out,
    'marble',
    'dressed',
    [0, 0],
    [
      [17.95, 1.8],
      [18.44, 1.56],
      [18.79, 1.03],
      [19.02, 0.9],
    ],
    n,
  );
  if (tier >= 1) {
    for (const sign of [-1, 1]) {
      const f = sculptureFrame(sign * 1.44, [0.17, 18.08, sign * 1.13], 0.98);
      if (tier <= 2)
        distantFigure(
          out,
          f,
          'bronze',
          'gold',
          [
            [-0.5, 1.69, 0.24],
            [-0.37, 1.54, 0.51],
          ],
          [
            [0.63, 1.96, 0.16],
            [0.85, 2.29, 0.39],
          ],
          { seated: true },
        );
      else sitting(out, f, 'bronze', 'gold', tier, { direction: sign });
    }
  }
  radial(
    out,
    'bronze',
    'goldShade',
    [0, 0],
    [
      [18.91, 0.68],
      [19.28, 0.53],
      [19.76, 0.38],
    ],
    tier === 0 ? 5 : 12,
  );
  if (tier === 0) {
    const f = sculptureFrame(0);
    for (const z of [-1, 1])
      gem(out, f, 'bronze', 'gold', [z * 1.17, 19.11, 0.08], [0.62, 0.94, 0.52]);
  }
  if (tier === 0)
    gem(out, sculptureFrame(0, [0, 20.38, 0]), 'bronze', 'gold', [0, 0, 0], [0.69, 0.7, 0.69]);
  else sphere(out, 'bronze', [0, 20.38, 0], [0.69, 0.7, 0.69], color.gold, n, tier >= 2 ? 10 : 5);
  const f = sculptureFrame(0.12, [0, 20.86, 0], 1.6);
  const left = [
      [-0.48, 2.37, 0.14],
      [-0.72, 3.13, 0.24],
    ],
    right = [
      [0.59, 1.86, 0.26],
      [0.66, 2.32, 0.49],
    ];
  if (tier < 2) distantFigure(out, f, 'bronze', 'gold', left, right);
  else standing(out, f, 'bronze', 'gold', tier, { left, right, twist: -0.05, crown: true });
  wings(out, f, 'goldLight', tier);
  if (tier >= 2) {
    const wreath = Array.from({ length: 14 }, (_, i) => {
      const a = (i * tau) / 14;
      return f.p([
        0.67 + 0.178 * Math.cos(a),
        2.38 + 0.24 * Math.sin(a),
        0.53 + 0.04 * Math.sin(a),
      ]);
    });
    beamPath(out, 'bronze', wreath, 0.073, 0.06, color.goldLight, true);
    if (tier >= 3) {
      for (let i = 0; i < wreath.length; i++) {
        const b = wreath[(i + 1) % wreath.length],
          p = wreath[i];
        beam(
          out,
          'bronze',
          mix(p, b, 0.24),
          [b[0] + 0.043, b[1] + 0.082, b[2] + 0.051],
          0.033,
          0.031,
          color.gold,
        );
      }
    }
  }
}
export function buildMemorialLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw new Error(`Unknown memorial detail level: ${level}`);
  basins(out, tier);
  pedestal(out, tier);
  statuary(out, tier);
  crown(out, tier);
}
export const buildMemorialSkyline = (out) => buildMemorialLevel(out, 'skyline');
export const buildMemorialDistrict = (out) => buildMemorialLevel(out, 'district');
export const buildMemorialStreet = (out) => buildMemorialLevel(out, 'street');
export const buildMemorialCloseup = (out) => buildMemorialLevel(out, 'closeup');
