/** Original845 United Nations Plaza exterior. Meters,+X NNE,+Z entrance/ESE. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: linear('b5a28e'),
    frame: linear('635e55'),
    gold: linear('ddb964'),
    stone: linear('8d8c85'),
    roof: linear('767773'),
    dark: linear('474d4f'),
  };
export const trumpSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.1 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.16, metallic: 0.2 },
  frame: { slot: 'wall', graph: 'metal_painted', roughness: 0.43, metallic: 0.48 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.3, metallic: 0.72 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.86, metallic: 0 },
};
export const trumpControls = a;
export function trumpGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const config = {
  skyline: { far: true },
  district: { stripes: 8, floors: 10 },
  street: { panes: true, rows: 40, longBays: 24, shortBays: 14, entry: true },
  closeup: {
    panes: true,
    rows: 80,
    longBays: 24,
    shortBays: 14,
    relief: true,
    entry: true,
    sign: true,
    roof: true,
  },
  master: {
    panes: true,
    rows: 80,
    longBays: 24,
    shortBays: 14,
    relief: true,
    reveals: true,
    entry: true,
    sign: true,
    roof: true,
    dense: true,
  },
};
const S = (c, n) => (c.far ? 'far' : n);
function rect(o, slot, p, q, y0, y1, n, color, uv) {
  const points = [
    [...p.slice(0, 1), y0, p[1]],
    [q[0], y0, q[1]],
    [q[0], y1, q[1]],
    [p[0], y1, p[1]],
  ];
  o.addQuad(
    slot,
    uv ? 'metric:uv' : 'palette:#ffffff',
    points,
    n,
    uv ?? [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
const faces = [
  { p: [a.tower.minX, a.tower.maxZ], q: [a.tower.maxX, a.tower.maxZ], n: [0, 0, 1], long: true },
  { p: [a.tower.maxX, a.tower.minZ], q: [a.tower.minX, a.tower.minZ], n: [0, 0, -1], long: true },
  { p: [a.tower.minX, a.tower.minZ], q: [a.tower.minX, a.tower.maxZ], n: [-1, 0, 0] },
  { p: [a.tower.maxX, a.tower.maxZ], q: [a.tower.maxX, a.tower.minZ], n: [1, 0, 0] },
];
function surface(o, c, f, u0, u1, y0, y1, offset, color, slot = 'glass', uv) {
  const P = (u) => [
    f.p[0] + (f.q[0] - f.p[0]) * u + f.n[0] * offset,
    f.p[1] + (f.q[1] - f.p[1]) * u + f.n[2] * offset,
  ];
  rect(o, S(c, slot), P(u0), P(u1), y0, y1, f.n, color, uv);
}
function foundation(o, c) {
  const t = a.tower,
    f = a.foundation,
    e = a.entrance,
    polys = [
      [
        [f.minX, f.minZ],
        [f.maxX, f.minZ],
        [f.maxX, t.maxZ],
        [f.minX, t.maxZ],
      ],
      [
        [e.minX, t.maxZ],
        [e.maxX, t.maxZ],
        [e.maxX, e.frontZ],
        [e.minX, e.frontZ],
      ],
    ];
  for (const raw of polys) {
    const r = raw.toReversed(),
      top = r.map(([x, z]) => [x, f.landingY, z]),
      low = r.map(([x, z]) => [x, Math.min(-0.45, trumpGroundY(x, z) - 0.55), z]);
    loft(o, S(c, 'stone'), [low, top], C.stone);
  }
}
function curtainWall(o, c) {
  const t = a.tower;
  box(o, S(c, 'frame'), [t.minX, t.glazingBaseY, t.minZ], [t.maxX, t.glazingTopY, t.maxZ], C.frame);
  for (const [fi, f] of faces.entries()) {
    if (c.far) {
      surface(o, c, f, 0, 1, t.glazingBaseY, t.glazingTopY, 0.025, linear('45494c'));
      continue;
    }
    if (!c.panes) {
      for (let i = 0; i < c.stripes; i++) {
        const u0 = i / c.stripes,
          u1 = (i + 1) / c.stripes;
        surface(
          o,
          c,
          f,
          u0 + 0.001,
          u1 - 0.001,
          t.glazingBaseY,
          t.glazingTopY,
          0.04,
          C.glass,
          'glass',
          [
            [0, 0],
            [1, 0],
            [1, 80],
            [0, 80],
          ],
        );
      }
      for (let j = 1; j < c.floors; j++) {
        const y = t.glazingBaseY + ((t.glazingTopY - t.glazingBaseY) * j) / c.floors;
        surface(o, c, f, 0, 1, y - 0.08, y + 0.08, 0.065, C.frame, 'frame');
      }
      continue;
    }
    const bays = f.long ? c.longBays : c.shortBays,
      L = Math.hypot(f.q[0] - f.p[0], f.q[1] - f.p[1]),
      du = 0.07 / L,
      dy = (t.glazingTopY - t.glazingBaseY) / c.rows;
    for (let row = 0; row < c.rows; row++)
      for (let k = 0; k < bays; k++) {
        const u0 = k / bays + du,
          u1 = (k + 1) / bays - du,
          y0 = t.glazingBaseY + row * dy + 0.08,
          y1 = t.glazingBaseY + (row + 1) * dy - 0.08,
          v = ((row * 17 + k * 13 + fi * 7) % 19) / 19,
          tint = C.glass.map((x) => x * (0.82 + v * 0.25));
        surface(o, c, f, u0, u1, y0, y1, 0.065, tint, 'glass', [
          [0.025, 0.035],
          [0.975, 0.035],
          [0.975, 0.965],
          [0.025, 0.965],
        ]);
        if (c.reveals) {
          const P = (u, y, d) => [
              f.p[0] + (f.q[0] - f.p[0]) * u + f.n[0] * d,
              y,
              f.p[1] + (f.q[1] - f.p[1]) * u + f.n[2] * d,
            ],
            rim = [
              [u0, y0],
              [u1, y0],
              [u1, y1],
              [u0, y1],
            ];
          for (let j = 0; j < 4; j++) {
            const p = rim[j],
              q = rim[(j + 1) % 4],
              ps = [P(...p, 0.065), P(...q, 0.065), P(...q, 0.14), P(...p, 0.14)];
            quad(o, 'frame', ps, normalFor(...ps), C.frame);
          }
        }
      }
    if (c.relief) {
      for (let k = 0; k <= bays; k++) {
        const u = k / bays,
          half = (k % 4 === 0 ? 0.065 : 0.035) / L;
        surface(
          o,
          c,
          f,
          Math.max(0, u - half),
          Math.min(1, u + half),
          t.glazingBaseY,
          t.glazingTopY,
          0.15,
          C.frame,
          'frame',
        );
      }
      for (let row = 1; row < c.rows; row++) {
        const y = t.glazingBaseY + row * dy;
        surface(o, c, f, 0, 1, y - 0.045, y + 0.045, 0.145, C.frame, 'frame');
      }
    }
  }
}
function crown(o, c) {
  const t = a.tower,
    s = S(c, 'frame');
  if (!c.roof) {
    box(o, s, [t.minX, 260.6, t.minZ], [t.maxX, 262, t.maxZ], C.frame);
    return;
  }
  // A perimeter parapet leaves the roof well and low plant visible from above.
  for (const [lo, hi] of [
    [
      [t.minX, 260.6, t.minZ],
      [t.maxX, 262, t.minZ + 0.45],
    ],
    [
      [t.minX, 260.6, t.maxZ - 0.45],
      [t.maxX, 262, t.maxZ],
    ],
    [
      [t.minX, 260.6, t.minZ + 0.45],
      [t.minX + 0.45, 262, t.maxZ - 0.45],
    ],
    [
      [t.maxX - 0.45, 260.6, t.minZ + 0.45],
      [t.maxX, 262, t.maxZ - 0.45],
    ],
  ])
    box(o, s, lo, hi, C.frame);
  box(o, 'frame', [-21.9, 261.35, -14.75], [21.9, 261.55, 8.42], C.roof);
  for (const [x, z, w, d, h] of [
    [-6, -5, 9, 6, 0.38],
    [8, -4, 8, 7, 0.36],
  ]) {
    box(o, 'frame', [x - w / 2, 261.55, z - d / 2], [x + w / 2, 261.55 + h, z + d / 2], C.roof);
    if (c.dense)
      for (let k = 0; k < 12; k++)
        box(
          o,
          'frame',
          [x - w / 2 + 0.15, 261.55 + h, z - d / 2 + 0.2 + (k * (d - 0.4)) / 12],
          [x + w / 2 - 0.15, 261.6 + h, z - d / 2 + 0.25 + (k * (d - 0.4)) / 12],
          C.dark,
        );
  }
}
function revolving(o, c, x) {
  const e = a.entrance,
    r = e.doorRadius,
    zc = e.backZ + 0.5,
    N = c.dense ? 32 : 20,
    y0 = a.foundation.landingY,
    y1 = e.doorY;
  // Only the visible side arcs enclose the rotor;the central entrance arc stays physically open.
  for (let j = 0; j < N; j++) {
    const a0 = (Math.PI * j) / N,
      a1 = (Math.PI * (j + 1)) / N;
    if (a0 > Math.PI * 0.3 && a1 < Math.PI * 0.7) continue;
    const p = [x + r * Math.cos(a0), zc + r * Math.sin(a0)],
      q = [x + r * Math.cos(a1), zc + r * Math.sin(a1)],
      ps = [
        [p[0], y0, p[1]],
        [q[0], y0, q[1]],
        [q[0], y1, q[1]],
        [p[0], y1, p[1]],
      ];
    quad(o, 'glass', ps, normalFor(...ps), C.glass);
    quad(o, 'glass', ps.toReversed(), normalFor(...ps.toReversed()), C.glass);
  }
  for (const y of [y0 + 0.05, y1])
    loft(
      o,
      'gold',
      [
        Array.from({ length: N }, (_, i) => [
          x + r * Math.cos((-i * Math.PI * 2) / N),
          y - 0.06,
          zc + r * Math.sin((-i * Math.PI * 2) / N),
        ]),
        Array.from({ length: N }, (_, i) => [
          x + r * Math.cos((-i * Math.PI * 2) / N),
          y + 0.06,
          zc + r * Math.sin((-i * Math.PI * 2) / N),
        ]),
      ],
      C.gold,
    );
  beam(o, 'gold', [x, y0, zc], [x, y1, zc], 0.08, 0.08, C.gold);
  for (let k = 0; k < 3; k++) {
    const angle = 0.35 + (k * Math.PI * 2) / 3,
      p = [x, y0 + 0.15, zc],
      q = [x + Math.cos(angle) * r * 0.94, y0 + 0.15, zc + Math.sin(angle) * r * 0.94],
      ps = [p, q, [q[0], y1 - 0.12, q[2]], [p[0], y1 - 0.12, p[2]]];
    quad(o, 'glass', ps, normalFor(...ps), C.glass);
    quad(o, 'glass', ps.toReversed(), normalFor(...ps.toReversed()), C.glass);
    beam(o, 'gold', q, [q[0], y1 - 0.12, q[2]], 0.06, 0.06, C.gold);
    beam(o, 'gold', [x, 1.8, zc], [q[0], 1.8, q[2]], 0.06, 0.06, C.gold);
  }
}
const glyph = {
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.8, 1],
      [1, 0.8],
      [0.8, 0.55],
      [0, 0.55],
    ],
    [
      [0.5, 0.55],
      [1, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.15],
      [0.2, 0],
      [0.8, 0],
      [1, 0.15],
      [1, 1],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.45],
      [1, 1],
      [1, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.8, 1],
      [1, 0.8],
      [0.8, 0.55],
      [0, 0.55],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.2, 0],
      [0.5, 0.55],
      [0.8, 0],
      [1, 1],
    ],
  ],
  O: [
    [
      [0.2, 0],
      [0, 0.2],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.65, 1],
      [1, 0.75],
      [1, 0.25],
      [0.65, 0],
      [0, 0],
    ],
  ],
  8: [
    [
      [0.2, 0.5],
      [0, 0.7],
      [0.2, 1],
      [0.8, 1],
      [1, 0.7],
      [0.8, 0.5],
      [0.2, 0.5],
      [0, 0.2],
      [0.2, 0],
      [0.8, 0],
      [1, 0.2],
      [0.8, 0.5],
    ],
  ],
  4: [
    [
      [0.8, 0],
      [0.8, 1],
      [0, 0.3],
      [1, 0.3],
    ],
  ],
  5: [
    [
      [1, 1],
      [0, 1],
      [0, 0.55],
      [0.8, 0.55],
      [1, 0.35],
      [0.8, 0],
      [0, 0],
    ],
  ],
};
function sign(o, text, width, y, z, height) {
  const pitch = width / text.length,
    w = pitch * 0.75;
  for (let i = 0; i < text.length; i++)
    for (const line of glyph[text[i]] ?? [])
      for (let j = 1; j < line.length; j++) {
        const P = (p) => [(i - text.length / 2) * pitch + p[0] * w, y + p[1] * height, z];
        beam(o, 'gold', P(line[j - 1]), P(line[j]), 0.035, 0.035, C.gold);
      }
}
function entrance(o, c) {
  const t = a.tower,
    e = a.entrance,
    s = S(c, 'glass');
  // The lobby has door apertures rather than an opaque wall behind the revolving doors.
  for (const f of faces.slice(1))
    surface(o, c, f, 0, 1, 0.65, t.glazingBaseY, 0.02, C.glass, 'glass', [
      [0, 0],
      [8, 0],
      [8, 2],
      [0, 2],
    ]);
  const f = faces[0],
    L = t.maxX - t.minX,
    cuts = c.entry ? [t.minX, -5.9, -3.1, 3.1, 5.9, t.maxX] : [t.minX, t.maxX];
  if (c.entry) {
    for (const [lo, hi] of [
      [cuts[0], cuts[1]],
      [cuts[2], cuts[3]],
      [cuts[4], cuts[5]],
    ])
      surface(
        o,
        c,
        f,
        (lo - t.minX) / L,
        (hi - t.minX) / L,
        0.65,
        e.doorY,
        0.025,
        C.glass,
        'glass',
        [
          [0, 0],
          [Math.max(1, (hi - lo) / 2), 0],
          [Math.max(1, (hi - lo) / 2), 1],
          [0, 1],
        ],
      );
    surface(o, c, f, 0, 1, e.doorY, t.glazingBaseY, 0.025, C.glass, 'glass', [
      [0, 0],
      [24, 0],
      [24, 1],
      [0, 1],
    ]);
  } else surface(o, c, f, 0, 1, 0.65, t.glazingBaseY, 0.025, C.glass, 'glass');
  box(
    o,
    S(c, 'gold'),
    [e.minX, e.canopyBottomY, e.backZ],
    [e.maxX, e.canopyTopY, e.frontZ],
    C.gold,
  );
  if (!c.entry) return;
  // An opaque inner recess closes the view without sealing the actual entry apertures.
  box(o, 'frame', [t.minX + 0.1, 0.65, 3], [t.maxX - 0.1, t.glazingBaseY, 3.2], C.dark);
  // Individual canopy coffers/soffit panels and suspended triangular braces.
  const cols = c.dense ? 12 : 8;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < 3; j++) {
      const dx = (e.maxX - e.minX) / cols,
        dz = (e.frontZ - e.backZ) / 3;
      box(
        o,
        'glass',
        [e.minX + i * dx + 0.1, e.canopyBottomY - 0.08, e.backZ + j * dz + 0.12],
        [e.minX + (i + 1) * dx - 0.1, e.canopyBottomY - 0.035, e.backZ + (j + 1) * dz - 0.12],
        linear('eedba2'),
      );
    }
  for (const x of [-11, -7, 0, 7, 11]) {
    beam(o, 'gold', [x, 8.15, e.backZ + 0.04], [x, 6.35, e.frontZ - 0.15], 0.11, 0.11, C.gold);
    beam(o, 'gold', [x, 0.65, e.backZ + 0.1], [x, 5.9, e.backZ + 0.1], 0.16, 0.16, C.gold);
  }
  for (const x of e.doorCenters) revolving(o, c, x);
  for (const x of [-10, 10]) {
    box(o, 'gold', [x - 1.05, 0.65, e.backZ + 0.08], [x + 1.05, 3.8, e.backZ + 0.18], C.gold);
    box(o, 'glass', [x - 0.95, 0.75, e.backZ + 0.19], [x + 0.95, 3.7, e.backZ + 0.23], C.glass);
    beam(
      o,
      'gold',
      [x + 0.6, 1.3, e.backZ + 0.28],
      [x + 0.6, 2.2, e.backZ + 0.28],
      0.055,
      0.055,
      C.gold,
    );
  }
  if (c.sign) {
    sign(o, 'THE TRUMP WORLD TOWER', 23, 6.02, e.frontZ + 0.06, 0.3);
    sign(o, '845', 1.25, 2.0, e.backZ + 0.12, 0.8);
  }
  const z0 = e.frontZ,
    z1 = z0 + 3.3,
    base = trumpGroundY(0, z1) + 0.1,
    top = a.foundation.landingY,
    steps = Math.max(1, Math.ceil((top - base) / 0.19));
  for (let i = 0; i < steps; i++) {
    const z = z0 + ((z1 - z0) * i) / steps,
      y = top + ((base - top) * i) / steps;
    box(
      o,
      'stone',
      [-10, base - 0.2, z],
      [10, y, z0 + ((z1 - z0) * (i + 1)) / steps + 0.015],
      C.stone,
    );
  }
  for (const x of [-10.3, 10.3]) {
    beam(o, 'gold', [x, top + 0.95, z0], [x, base + 0.95, z1], 0.05, 0.05, C.gold);
    for (let j = 0; j < 4; j++) {
      const q = j / 3,
        z = z0 + (z1 - z0) * q,
        y = top + (base - top) * q;
      beam(o, 'gold', [x, y, z], [x, y + 0.95, z], 0.045, 0.045, C.gold);
    }
  }
}
export function buildTrumpLevel(o, level = 'master') {
  const c = config[level];
  if (!c) throw Error('Unknown Trump World Tower level:' + level);
  foundation(o, c);
  curtainWall(o, c);
  crown(o, c);
  entrance(o, c);
}
export const buildTrumpSkyline = (o) => buildTrumpLevel(o, 'skyline');
export const buildTrumpDistrict = (o) => buildTrumpLevel(o, 'district');
export const buildTrumpStreet = (o) => buildTrumpLevel(o, 'street');
export const buildTrumpCloseup = (o) => buildTrumpLevel(o, 'closeup');
