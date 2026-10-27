/** Durham Gregson Street overpass: current raised rail span and separate crash beam. */
import {
  beam,
  cross,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const elevenControls = {
  originMeters: 118.61369353579312,
  ends: [-14.416, 14.416],
  width: 3.101,
  piers: [-9.5, 7.8],
  girderBottom: 3.98,
  railBedY: 4.95,
  railTopY: 5.24,
  crash: { posts: [-9.25, 7.65], z: -2.5, bottom: 3.78, top: 4.28 },
};
export const elevenSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.4 },
  wood: { slot: 'roof', graph: 'wood_plain', roughness: 1, metallic: 0 },
  ballast: { slot: 'foundation', graph: 'gravel', roughness: 1, metallic: 0 },
};
const C = elevenControls,
  W = C.width / 2;
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  steel: linear('675a51'),
  trim: linear('8a7c6b'),
  concrete: linear('b7b3a7'),
  wood: linear('796e5d'),
  ballast: linear('8f928b'),
  rail: linear('989c94'),
  yellow: linear('e7b52a'),
  dark: linear('3e4140'),
  back: linear('9c9e96'),
};
const configs = {
  skyline: { far: true, tie: 0, stiffen: 0, fence: 0, text: false, bolt: 0 },
  district: { tie: 1.8, stiffen: 3, fence: 4, text: false, bolt: 0 },
  street: { tie: 0.65, stiffen: 1.4, fence: 1.9, text: true, bolt: 0 },
  closeup: { tie: 0.55, stiffen: 1, fence: 1.4, text: true, bolt: 6 },
  master: { tie: 0.55, stiffen: 1, fence: 1.4, text: true, bolt: 8 },
};
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
const b = (o, slot, x0, x1, y0, y1, z0, z1, color) =>
  box(o, slot, [x0, y0, z0], [x1, y1, z1], color);
const face = (o, points, color, hint = [0, 0, -1]) =>
  o.addConvexPolygon('metal', 'palette:#ffffff', points, hint, null, color);
function girder(o, z, cfg) {
  const [A, B] = C.ends;
  b(o, 'metal', A, B, C.girderBottom, C.girderBottom + 0.14, z - 0.17, z + 0.17, colors.steel);
  b(o, 'metal', A, B, C.girderBottom + 0.14, 4.87, z - 0.045, z + 0.045, colors.steel);
  b(o, 'metal', A, B, 4.87, 5.01, z - 0.19, z + 0.19, colors.steel);
  if (cfg.stiffen)
    for (let x = A + 0.3; x < B; x += cfg.stiffen) {
      b(
        o,
        'metal',
        x - 0.045,
        x + 0.045,
        C.girderBottom + 0.14,
        4.87,
        z - 0.14,
        z + 0.14,
        colors.trim,
      );
      if (cfg.bolt)
        for (const y of [4.23, 4.68])
          for (const sign of [-1, 1]) {
            const ring = (zz) =>
              Array.from({ length: cfg.bolt }, (_, i) => [
                x + 0.037 * Math.cos((i / cfg.bolt) * Math.PI * 2),
                y + 0.037 * Math.sin((i / cfg.bolt) * Math.PI * 2),
                zz,
              ]);
            const ends = [z + sign * 0.14, z + sign * 0.17].sort((a, b) => a - b);
            loft(o, 'metal', ends.map(ring), colors.trim);
          }
    }
}
function diamond(o, x, y, z, cfg) {
  const points = (radius, zz) => [
    [x, y + radius, zz],
    [x - radius, y, zz],
    [x, y - radius, zz],
    [x + radius, y, zz],
  ];
  loft(o, 'metal', [points(0.86, z - 0.04), points(0.86, z + 0.04)], colors.yellow);
  face(o, points(0.8, z - 0.043), colors.dark);
  face(o, points(0.75, z - 0.046), colors.yellow);
  b(o, 'metal', x - 0.035, x + 0.035, -0.35, y + 0.3, z + 0.04, z + 0.11, colors.back);
  if (!cfg.text) return;
  const glyph = {
    1: [
      [
        [0.45, 0],
        [0.45, 1],
      ],
    ],
    2: [
      [
        [0, 1],
        [0.5, 1],
        [0.5, 0.55],
        [0, 0.45],
        [0, 0],
        [0.5, 0],
      ],
    ],
    4: [
      [
        [0, 1],
        [0, 0.5],
        [0.5, 0.5],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
    ],
    '-': [
      [
        [0, 0.5],
        [0.45, 0.5],
      ],
    ],
    "'": [
      [
        [0.25, 1],
        [0.25, 0.78],
      ],
    ],
    '"': [
      [
        [0.12, 1],
        [0.12, 0.78],
      ],
      [
        [0.38, 1],
        [0.38, 0.78],
      ],
    ],
  };
  const text = '12\'-4"',
    height = 0.285,
    step = 0.195,
    start = -(text.length * step) / 2;
  for (const [j, ch] of [...text].entries())
    for (const line of glyph[ch])
      for (let i = 1; i < line.length; i++) {
        const P = (p) => [
          x - (start + j * step + p[0] * height),
          y - 0.14 + p[1] * height,
          z - 0.058,
        ];
        beam(o, 'metal', P(line[i - 1]), P(line[i]), 0.035, 0.025, colors.dark);
      }
  for (const sign of [-1, 1]) {
    const yy = y + sign * 0.48;
    face(
      o,
      [
        [-0.09, -0.11],
        [0.09, -0.11],
        [0.09, 0.02],
        [-0.09, 0.02],
      ].map(([u, v]) => [x + u, yy + sign * v, z - 0.06]),
      colors.dark,
    );
    face(
      o,
      [
        [-0.21, 0.02],
        [0.21, 0.02],
        [0, 0.22],
      ].map(([u, v]) => [x + u, yy + sign * v, z - 0.06]),
      colors.dark,
    );
  }
}
function crashBeam(o, cfg) {
  const { posts, z, bottom, top } = C.crash,
    [a, c] = posts;
  for (const [x, sign] of [
    [a, -1],
    [c, 1],
  ]) {
    b(o, 'metal', x - 0.18, x + 0.18, -0.4, top, z - 0.2, z + 0.2, colors.steel);
    beam(o, 'metal', [x + sign * 2.4, 0, z], [x, 3.5, z], 0.25, 0.24, colors.steel);
    if (!cfg.far) {
      b(o, 'metal', x - 0.24, x + 0.24, 0.72, 1.95, z - 0.224, z - 0.204, colors.yellow);
      for (let i = 0; i < 3; i++)
        face(
          o,
          [
            [x - 0.24, 0.75 + i * 0.39, z - 0.227],
            [x + 0.24, 1 + i * 0.39, z - 0.227],
            [x + 0.24, 1.18 + i * 0.39, z - 0.227],
            [x - 0.24, 0.93 + i * 0.39, z - 0.227],
          ],
          colors.dark,
        );
    }
  }
  b(o, 'metal', a - 0.22, c + 0.22, bottom, top, z - 0.24, z + 0.24, colors.yellow);
  if (!cfg.far) {
    b(
      o,
      'metal',
      a - 0.25,
      c + 0.25,
      bottom - 0.04,
      bottom + 0.055,
      z - 0.29,
      z + 0.29,
      colors.steel,
    );
    for (const x of [a + 0.4, c - 0.4])
      b(o, 'metal', x - 0.035, x + 0.035, bottom, top, z - 0.258, z - 0.238, colors.dark);
  }
}
export function buildElevenLevel(target, level = 'master') {
  const cfg = configs[level],
    o = writer(target, cfg.far),
    [A, B] = C.ends;
  for (const x of C.piers) {
    b(o, 'concrete', x - 0.7, x + 0.7, -0.45, 3.62, -1.95, 1.95, colors.concrete);
    b(o, 'concrete', x - 0.86, x + 0.86, 3.62, 3.9, -2.1, 2.1, colors.concrete);
    for (const z of [-1.22, 1.22])
      b(o, 'metal', x - 0.38, x + 0.38, 3.9, 4.02, z - 0.22, z + 0.22, colors.steel);
  }
  for (const [a, c] of [
    [A, A + 1.05],
    [B - 1.05, B],
  ]) {
    b(o, 'concrete', a, c, -0.5, 4.82, -2.35, 2.35, colors.concrete);
    b(o, 'concrete', a - 0.35, c + 0.35, 3.9, 4.95, -2.55, 2.55, colors.concrete);
  }
  for (const z of [-1.25, 1.25]) girder(o, z, cfg);
  b(o, 'ballast', A, B, 4.67, C.railBedY, -1.08, 1.08, colors.ballast);
  if (cfg.tie) {
    for (let x = A + 0.2; x < B; x += cfg.tie) {
      b(o, 'wood', x - 0.115, x + 0.115, C.railBedY, 5.09, -1.35, 1.35, colors.wood);
      beam(o, 'metal', [x, 4.19, -1.25], [x, 4.19, 1.25], 0.13, 0.16, colors.steel);
    }
  }
  for (const z of [-0.7175, 0.7175]) {
    b(o, 'metal', A, B, 5.09, 5.14, z - 0.09, z + 0.09, colors.steel);
    b(o, 'metal', A, B, 5.14, 5.22, z - 0.025, z + 0.025, colors.rail);
    b(o, 'metal', A, B, 5.22, C.railTopY, z - 0.04, z + 0.04, colors.rail);
  }
  if (cfg.fence)
    for (const sign of [-1, 1]) {
      const z = sign * (W + 0.05);
      for (let x = A; x < B + 0.01; x += cfg.fence)
        b(o, 'metal', x - 0.045, x + 0.045, 4.95, 5.96, z - 0.045, z + 0.045, colors.trim);
      for (const y of [5.27, 5.59, 5.92])
        beam(o, 'metal', [A, y, z], [B, y, z], 0.035, 0.035, colors.steel);
    }
  for (const [end, sign] of [
    [A, -1],
    [B, 1],
  ])
    b(
      o,
      'ballast',
      Math.min(end, end + sign * 1.6),
      Math.max(end, end + sign * 1.6),
      4.6,
      4.964,
      -3.2,
      3.2,
      colors.ballast,
    );
  crashBeam(o, cfg);
  for (const x of [-10.2, 8.4]) diamond(o, x, 2.72, -5.3, cfg);
}
export const buildElevenSkyline = (b) => buildElevenLevel(b, 'skyline');
export const buildElevenDistrict = (b) => buildElevenLevel(b, 'district');
export const buildElevenStreet = (b) => buildElevenLevel(b, 'street');
export const buildElevenCloseup = (b) => buildElevenLevel(b, 'closeup');
