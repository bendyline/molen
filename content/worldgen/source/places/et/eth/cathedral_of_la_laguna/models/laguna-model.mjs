/** La Laguna Cathedral in the measured footprint and signed west-front frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const lagunaSurfaces = {
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.76 },
  dressed: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.72 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.82 },
  paintedRoof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.59 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.68 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.54 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.64 },
  bell: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.54, metallic: 0.65 },
};
const palette = {
  stone: '716b63',
  stoneWarm: '7c7166',
  stoneLight: '93877a',
  ash: '605a55',
  stoneDark: '535052',
  plaster: 'e0dbcd',
  plasterLight: 'eee8dc',
  plasterSide: 'd2cab9',
  paving: 'b1a89b',
  silver: 'c4bdb0',
  red: '9d3939',
  redLight: 'b64b46',
  redDark: '813336',
  tile: 'a47468',
  tileShade: '885f58',
  dark: '292729',
  iron: '514e4b',
  glass: '344658',
  glassDeep: '233242',
  glassRose: '5e404d',
  glassAmber: 'aa754e',
  door: '70483a',
  doorDark: '57392d',
  doorLight: '855643',
  bell: '77634d',
  bellDark: '56453b',
  brass: 'b69a70',
  clock: 'e2ddd3',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, v]) => [
    k,
    v.match(/../g).map((c) => {
      const s = Number.parseInt(c, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const rank = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  westNormal = [-1, 0, 0],
  tau = Math.PI * 2;
const at = ([x, z], y) => [x, y, z];
function face(out, slot, tint, ps, normal) {
  let n = normalFor(...ps);
  if (normal && n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  if (ps.length === 3) out.addTriangle(slot, ref, ps, n, undefined, color[tint]);
  else out.addQuad(slot, ref, ps, n, undefined, color[tint]);
}
function volume(out, slot, tint, x, z, rows, bevel = 0.07) {
  const rect = (y, w, d) =>
    bevel
      ? chamferedRectangle(x, y, z, w, d, bevel)
      : [
          [x - w / 2, y, z - d / 2],
          [x - w / 2, y, z + d / 2],
          [x + w / 2, y, z + d / 2],
          [x + w / 2, y, z - d / 2],
        ];
  loft(
    out,
    slot,
    rows.map(([y, w, d]) => rect(y, w, d)),
    color[tint],
  );
}
function radial(out, slot, tint, x, z, rows, n, cap = false) {
  loft(
    out,
    slot,
    rows.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, [x, z])),
    color[tint],
    { cap },
  );
}
function roofPlate(out, slot, tint, p, y) {
  for (const ids of p.triangles) {
    const [a, b, c] = ids.map((i) => p.vertices[i]);
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.0009) continue;
    face(out, slot, tint, [at(a, y), at(b, y), at(c, y)], up);
  }
}
function wallFrame([a, b], z0 = 0) {
  const [x, z] = a,
    [q, r] = b,
    L = Math.hypot(q - x, r - z),
    dx = (q - x) / L,
    dz = (r - z) / L,
    n = [dz, 0, -dx];
  return {
    p: (u, y, w = 0) => [x + (u + z0) * dx + n[0] * w, y, z + (u + z0) * dz + n[2] * w],
    n,
    L,
  };
}
const west = (x, z) => ({ p: (u, y, w = 0) => [x - w, y, z + u], n: westNormal });
function panel(out, f, slot, tint, u0, u1, y0, y1, w = 0) {
  if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
  face(out, slot, tint, [f.p(u0, y0, w), f.p(u1, y0, w), f.p(u1, y1, w), f.p(u0, y1, w)], f.n);
}
function stroke(out, f, slot, tint, [u, y], [v, h], width, w) {
  const d = Math.hypot(v - u, h - y),
    dx = ((h - y) * width * 0.5) / d,
    dy = ((u - v) * width * 0.5) / d;
  face(
    out,
    slot,
    tint,
    [
      f.p(u + dx, y + dy, w),
      f.p(u - dx, y - dy, w),
      f.p(v - dx, h - dy, w),
      f.p(v + dx, h + dy, w),
    ],
    f.n,
  );
}
const vline = (out, f, slot, tint, u, y, h, width, w) =>
  panel(out, f, slot, tint, u - width / 2, u + width / 2, y, h, w);
function hline(out, f, slot, tint, u, v, y, h, w) {
  panel(out, f, slot, tint, u, v, y - h / 2, y + h / 2, w);
}
function shape(center, spring, radius, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [center - radius * Math.cos(a), spring + rise * Math.sin(a)];
  });
}
function archFill(out, f, slot, tint, u, bottom, spring, r, yr, n, w) {
  panel(out, f, slot, tint, u - r, u + r, bottom, spring, w);
  const arc = shape(u, spring, r, yr, n);
  for (let i = 0; i < n; i++)
    face(out, slot, tint, [f.p(u, spring, w), f.p(...arc[i], w), f.p(...arc[i + 1], w)], f.n);
}
function archTrim(out, f, slot, tint, u, bottom, spring, r, rise, width, n, w) {
  panel(out, f, slot, tint, u - r - width, u - r, bottom, spring, w);
  panel(out, f, slot, tint, u + r, u + r + width, bottom, spring, w);
  const a = shape(u, spring, r, rise, n),
    b = shape(u, spring, r + width, rise + width, n);
  for (let i = 0; i < n; i++)
    face(
      out,
      slot,
      tint,
      [f.p(...a[i], w), f.p(...a[i + 1], w), f.p(...b[i + 1], w), f.p(...b[i], w)],
      f.n,
    );
}
function disc(out, f, slot, tint, u, y, r, n, w) {
  const p = (i) => f.p(u + Math.cos((tau * i) / n) * r, y + Math.sin((tau * i) / n) * r, w);
  for (let i = 0; i < n; i++) face(out, slot, tint, [f.p(u, y, w), p(i), p(i + 1)], f.n);
}
function annulus(out, f, slot, tint, u, y, r, d, n, w) {
  const p = (i, radius) =>
    f.p(u + Math.cos((tau * i) / n) * radius, y + Math.sin((tau * i) / n) * radius, w);
  for (let i = 0; i < n; i++)
    face(out, slot, tint, [p(i, r), p(i + 1, r), p(i + 1, r + d), p(i, r + d)], f.n);
}
function oculus(out, f, u, y, r, tier, w, { clock = false, plain = false } = {}) {
  const n = [6, 10, 18, 26, 32][tier];
  disc(out, f, 'metal', clock ? 'clock' : plain ? 'glassDeep' : 'glassRose', u, y, r, n, w);
  if (tier === 0) return;
  annulus(out, f, 'dressed', 'stoneWarm', u, y, r, 0.145, n, w + 0.021);
  if (clock) {
    const tip = (a, d) => [u + Math.sin(a) * r * d, y + Math.cos(a) * r * d];
    const count = tier < 2 ? 4 : 12;
    for (let i = 0; i < count; i++)
      stroke(
        out,
        f,
        'metal',
        'iron',
        tip((i * tau) / count, 0.78),
        tip((i * tau) / count, 0.92),
        0.04,
        w + 0.028,
      );
    stroke(out, f, 'metal', 'dark', [u, y], tip(0.63, 0.65), 0.054, w + 0.03);
    stroke(out, f, 'metal', 'dark', [u, y], tip(4.13, 0.43), 0.074, w + 0.031);
  } else if (tier >= 2) {
    annulus(out, f, 'metal', 'iron', u, y, r * 0.44, 0.035, n, w + 0.037);
    if (!plain) disc(out, f, 'metal', 'glassAmber', u, y, r * 0.185, n, w + 0.035);
    const count = tier === 2 ? 8 : 14;
    for (let i = 0; i < count; i++) {
      const a = (i * tau) / count,
        c = Math.cos(a),
        s = Math.sin(a);
      stroke(out, f, 'metal', 'iron', [u, y], [u + r * c, y + r * s], 0.039, w + 0.041);
    }
  }
}
function window(
  out,
  f,
  u,
  y,
  r,
  height,
  tier,
  w,
  { flat = false, paired = false, stone = 'dressed' } = {},
) {
  const n = [4, 6, 10, 14, 17][tier],
    spring = y + height - r * 0.68,
    rise = r * 0.68;
  if (tier === 0) {
    panel(out, f, 'metal', 'glassDeep', u - r, u + r, y, y + height, w + 0.018);
    return;
  }
  if (tier === 1) {
    if (flat) panel(out, f, 'metal', 'glassDeep', u - r, u + r, y, y + height, w + 0.018);
    else archFill(out, f, 'metal', 'glassDeep', u, y, spring, r, rise, 5, w + 0.018);
    hline(out, f, stone, 'stoneLight', u - r - 0.17, u + r + 0.17, y - 0.04, 0.11, w + 0.027);
    if (paired) vline(out, f, stone, 'stoneLight', u, y, spring + rise * 0.76, 0.14, w + 0.039);
    return;
  }
  if (flat) {
    panel(out, f, stone, 'stoneWarm', u - r - 0.16, u + r + 0.16, y - 0.13, y + height + 0.16, w);
    panel(out, f, 'metal', 'glassDeep', u - r, u + r, y, y + height, w + 0.021);
  } else {
    archFill(out, f, 'metal', 'glassDeep', u, y, spring, r, rise, n, w + 0.012);
    archTrim(out, f, stone, 'stoneWarm', u, y - 0.1, spring, r, rise, 0.14, n, w + 0.029);
  }
  if (tier >= 1) {
    hline(out, f, stone, 'stoneLight', u - r - 0.26, u + r + 0.26, y - 0.04, 0.11, w + 0.055);
    if (paired) vline(out, f, stone, 'stoneLight', u, y, spring + rise * 0.8, 0.16, w + 0.04);
  }
  if (tier >= 2) {
    for (const side of [-1, 1])
      vline(
        out,
        f,
        'metal',
        'iron',
        u + side * r * 0.51,
        y + 0.12,
        spring + rise * 0.57,
        0.036,
        w + 0.043,
      );
    const rows = tier === 2 ? 2 : 4;
    for (let i = 1; i <= rows; i++)
      hline(
        out,
        f,
        'metal',
        'iron',
        u - r + 0.03,
        u + r - 0.03,
        y + (i * (spring - y)) / (rows + 1),
        0.039,
        w + 0.045,
      );
  }
}
function door(out, f, u, y, r, height, tier, w) {
  const n = tier < 2 ? 5 : 12,
    spring = y + height - r * 0.53;
  if (tier === 0) {
    panel(out, f, 'wood', 'door', u - r, u + r, y, y + height, w + 0.016);
    return;
  }
  archFill(out, f, 'wood', 'door', u, y, spring, r, r * 0.53, n, w + 0.014);
  if (tier >= 2)
    archTrim(out, f, 'dressed', 'stoneWarm', u, y - 0.06, spring, r, r * 0.53, 0.21, n, w + 0.026);
  if (tier >= 1) {
    vline(out, f, 'wood', 'doorDark', u, y, spring + r * 0.44, 0.078, w + 0.052);
    hline(
      out,
      f,
      'dressed',
      'stoneLight',
      u - r - 0.21,
      u + r + 0.21,
      spring - 0.17,
      0.1,
      w + 0.064,
    );
  }
  if (tier >= 2)
    for (const sign of [-1, 1]) {
      const a = u + sign * r * 0.51;
      for (let i = 0; i < 3; i++) {
        const l = y + 0.24 + (i * (spring - y - 0.42)) / 3,
          h = l + (spring - y - 0.42) / 3 - 0.15;
        panel(out, f, 'wood', 'doorDark', a - r * 0.35, a + r * 0.35, l, h, w + 0.042);
        panel(
          out,
          f,
          'wood',
          'doorLight',
          a - r * 0.3,
          a + r * 0.3,
          l + 0.065,
          h - 0.065,
          w + 0.055,
        );
      }
      panel(
        out,
        f,
        'metal',
        'brass',
        u + sign * 0.09 - 0.024,
        u + sign * 0.09 + 0.024,
        y + 1.06,
        y + 1.19,
        w + 0.077,
      );
    }
}

function shell(out, volume, low, high, tint) {
  for (const p of volume)
    for (const [j, ring] of p.rings.entries())
      for (const [i, a] of ring.entries()) {
        const k = (i + 1) % ring.length,
          b = ring[k],
          normal = wallFrame([a, b]).n;
        const base = low === null ? p.foot[j] : undefined;
        face(
          out,
          'plaster',
          tint,
          [at(a, base?.[i] ?? low), at(b, base?.[k] ?? low), at(b, high), at(a, high)],
          normal,
        );
      }
}
function masses(out, tier) {
  const { base, upper, apse, terrace } = layout.shell;
  shell(out, base, null, 11.86, 'plasterSide');
  shell(out, upper, 11.86, 18.86, 'plaster');
  shell(out, apse, 11.86, 15.82, 'plaster');
  for (const p of terrace) roofPlate(out, 'paintedRoof', 'redDark', p, 11.89);
  for (const p of upper) roofPlate(out, 'plaster', 'plasterSide', p, 18.86);
  for (const p of apse) roofPlate(out, 'paintedRoof', 'redDark', p, 15.82);
  if (tier >= 1)
    for (const w of layout.visibleWalls) {
      const f = wallFrame([w.a, w.b]),
        span = w.length / w.count;
      hline(out, f, 'plaster', 'plasterLight', 0, w.length, 18.36, 0.48, 0.058);
      for (let i = 0; i < w.count; i++) {
        const u = (i + 0.5) * span;
        window(out, f, u, 12.54, Math.min(1.2, span * 0.195), 4.17, tier, 0.042, { paired: true });
        const g = i * span;
        panel(
          out,
          f,
          'plaster',
          'plasterSide',
          Math.max(0, g - 0.22),
          g + 0.22,
          11.86,
          18.3,
          0.051,
        );
      }
    }
  if (tier >= 1)
    for (const w of layout.arcWalls) {
      const f = wallFrame([w.a, w.b]),
        u = w.length / 2;
      window(out, f, u, 11.94, Math.min(0.84, w.length * 0.23), 3.03, tier, 0.05, { paired: true });
      hline(out, f, 'plaster', 'plasterLight', 0, w.length, 15.57, 0.22, 0.045);
    }
}

function pediment(out, f, tier) {
  const y = 20.77,
    z = layout.zCenter,
    half = 10.17,
    top = 26.31;
  face(
    out,
    'basalt',
    'stone',
    [f.p(z - half, y, 0.1), f.p(z + half, y, 0.1), f.p(z, top, 0.1)],
    f.n,
  );
  face(
    out,
    'basalt',
    'stoneWarm',
    [f.p(z - half, y, -1.62), f.p(z + half, y, -1.62), f.p(z, top, -1.62)],
    [1, 0, 0],
  );
  for (const sign of [-1, 1]) {
    const a = [z + sign * half, y],
      b = [z, top];
    face(
      out,
      'dressed',
      'stoneWarm',
      [f.p(...a, 0.103), f.p(...b, 0.103), f.p(...b, -1.62), f.p(...a, -1.62)],
      up,
    );
    stroke(out, f, 'dressed', 'stoneLight', a, b, tier === 0 ? 0.35 : 0.39, 0.18);
    if (tier >= 2)
      stroke(
        out,
        f,
        'dressed',
        'ash',
        [a[0] * 0.975 + z * 0.025, a[1] + 0.1],
        [z, top - 0.56],
        0.1,
        0.207,
      );
  }
  beam(out, 'metal', f.p(z, top - 0.02, 0.03), f.p(z, 28.5, 0.03), 0.19, 0.22, color.iron);
  beam(
    out,
    'metal',
    f.p(z - 0.66, 27.66, 0.03),
    f.p(z + 0.66, 27.66, 0.03),
    0.17,
    0.19,
    color.iron,
  );
  if (tier >= 1)
    for (const sign of [-1, 1]) {
      const p = f.p(z + sign * half, 0, -0.24);
      radial(
        out,
        'dressed',
        'stoneWarm',
        p[0],
        p[2],
        [
          [20.75, 0.43],
          [21.2, 0.43],
          [21.67, 0.33],
          [22.26, 0.16],
        ],
        8,
        true,
      );
    }
}
function band(out, f, a, b, y, w, tier) {
  hline(out, f, 'dressed', 'ash', a, b, y, 0.62, w);
  hline(out, f, 'dressed', 'stoneLight', a, b, y + 0.26, 0.16, w + 0.058);
  if (tier >= 2) {
    hline(out, f, 'dressed', 'stoneWarm', a, b, y - 0.26, 0.1, w + 0.04);
    const n = Math.floor((b - a) / 0.85);
    for (let i = 1; i < n; i++)
      hline(
        out,
        f,
        'dressed',
        'stoneLight',
        a + i * 0.85 - 0.14,
        a + i * 0.85 + 0.14,
        y + 0.035,
        0.13,
        w + 0.07,
      );
  }
}
function column(out, x, z, tier) {
  const n = [4, 6, 12, 16, 22][tier];
  if (tier >= 1)
    volume(
      out,
      'dressed',
      'stoneWarm',
      x,
      z,
      [
        [0.42, 1.73, 1.72],
        [0.63, 1.73, 1.72],
      ],
      tier >= 2 ? 0.07 : 0,
    );
  const rows =
    tier === 0
      ? [
          [0.42, 0.69],
          [10.56, 0.61],
        ]
      : tier === 1
        ? [
            [0.62, 0.69],
            [1.31, 0.52],
            [9.91, 0.45],
            [10.57, 0.64],
          ]
        : [
            [0.61, 0.75],
            [0.84, 0.66],
            [1.08, 0.57],
            [1.31, 0.49],
            [4.88, 0.506],
            [8.89, 0.435],
            [9.91, 0.427],
            [10.16, 0.64],
            [10.47, 0.68],
          ];
  radial(out, 'dressed', 'stoneWarm', x, z, rows, n, true);
  if (tier >= 2) {
    volume(
      out,
      'dressed',
      'stoneLight',
      x,
      z,
      [
        [10.39, 1.48, 1.46],
        [10.61, 1.48, 1.46],
      ],
      0.06,
    );
    if (tier >= 3)
      for (const y of [1.36, 2.48, 3.61, 4.73, 5.87, 6.99, 8.1, 9.2])
        radial(
          out,
          'dressed',
          'ash',
          x,
          z,
          [
            [y, 0.493],
            [y + 0.024, 0.495],
          ],
          n,
          false,
        );
  }
}
function approaches(out, tier) {
  for (const s of layout.steps) {
    const { a, b, y, z0, z1, base } = s;
    face(
      out,
      'dressed',
      'paving',
      [
        [a, y, z0],
        [a, y, z1],
        [b, y, z1],
        [b, y, z0],
      ],
      up,
    );
    face(
      out,
      'dressed',
      'stoneWarm',
      [
        [a, base, z0],
        [a, base, z1],
        [a, y, z1],
        [a, y, z0],
      ],
      westNormal,
    );
    if (tier >= 1)
      for (const [z, n] of [
        [z0, [0, 0, -1]],
        [z1, [0, 0, 1]],
      ])
        face(
          out,
          'dressed',
          'stoneWarm',
          [
            [a, base, z],
            [b, base, z],
            [b, y, z],
            [a, y, z],
          ],
          n,
        );
  }
  const last = layout.steps.at(-1),
    x = last.b,
    y = last.y,
    z0 = last.z0,
    z1 = last.z1;
  face(
    out,
    'dressed',
    'paving',
    [
      [x, y, z0],
      [x, y, z1],
      [-33.46, y, z1],
      [-33.46, y, z0],
    ],
    up,
  );
}
function facade(out, tier) {
  const z = layout.zCenter,
    front = west(-37.13, 0),
    rear = west(-33.473, 0);
  const edge0 = -23.78,
    edge1 = 15.65;
  // The rear wall and portico floor leave the space behind the freestanding columns open.
  panel(out, rear, 'plaster', 'plasterSide', -13.4, 5.38, 0.41, 10.64, 0.034);
  face(
    out,
    'dressed',
    'ash',
    [
      [-37.16, 10.64, -13.52],
      [-33.45, 10.64, -13.52],
      [-33.45, 10.64, 5.52],
      [-37.16, 10.64, 5.52],
    ],
    [0, -1, 0],
  );
  for (const u of [-9.05, z, 0.98])
    door(out, rear, u, 0.43, u === z ? 1.76 : 1.34, u === z ? 6.52 : 5.72, tier, 0.084);
  for (const c of [-11.57, -6.53, -1.51, 3.49]) column(out, -36.14, c, tier);
  const trim = [
    [edge0, -13.28],
    [5.21, edge1],
  ];
  for (const [a, b] of trim) {
    volume(
      out,
      'basalt',
      'stoneWarm',
      -35.43,
      (a + b) / 2,
      [
        [-0.42, 3.39, b - a],
        [10.68, 3.39, b - a],
      ],
      0,
    );
    panel(out, front, 'plaster', 'plasterLight', a + 0.57, b - 0.56, 0.71, 10.13, 0.025);
  }
  for (const u of [-14.88, 6.88]) {
    door(out, front, u, 0.56, 0.96, 4.76, tier, 0.084);
    oculus(out, front, u, 7.03, 0.86, tier, 0.099);
  }
  for (const u of [-19.51, 11.32]) window(out, front, u, 3.46, 0.9, 3.87, tier, 0.088);
  volume(
    out,
    'basalt',
    'stone',
    -35.32,
    z,
    [
      [10.64, 3.62, 39.45],
      [20.92, 3.62, 39.45],
    ],
    0,
  );
  const upper = [-19.52, -13.5, -8.96, z, 1.12, 5.65, 11.3];
  for (const [i, u] of upper.entries()) {
    const width = i === 0 || i === 6 ? 5.4 : i === 3 ? 4.86 : 3.67;
    panel(out, front, 'plaster', 'plasterLight', u - width / 2, u + width / 2, 12.35, 20.05, 0.036);
    if (i === 0 || i === 3 || i === 6)
      oculus(out, front, u, 16.27, i === 3 ? 1.59 : 1.29, tier, 0.087, { clock: i === 6 });
    else window(out, front, u, 13.81, 0.85, 4.63, tier, 0.086, { flat: true });
  }
  band(out, front, edge0, edge1, 11.2, 0.114, tier);
  band(out, front, edge0, edge1, 20.79, 0.105, tier);
  pediment(out, front, tier);
  if (tier >= 2) {
    const gate = west(-34.21, 0);
    for (const u of [-9.05, z, 0.98]) {
      const r = u === z ? 1.58 : 1.14;
      for (let i = 0; i < 9; i++)
        vline(out, gate, 'metal', 'iron', u - r + i * r * 0.25, 0.47, 2.63, 0.047, 0.03);
      for (const y of [0.67, 1.45, 2.49])
        hline(out, gate, 'metal', 'iron', u - r, u + r, y, 0.043, 0.047);
    }
  }
}

function opening(out, f, y0, y1, r, spring, rise, n, tier) {
  const m = f.L / 2;
  panel(out, f, 'basalt', 'stone', 0, m - r, y0, y1);
  panel(out, f, 'basalt', 'stone', m + r, f.L, y0, y1);
  const a = shape(m, spring, r, rise, n);
  for (let i = 0; i < n; i++) {
    const [u, y] = a[i],
      [v, h] = a[i + 1];
    face(out, 'basalt', 'stoneWarm', [f.p(u, y), f.p(v, h), f.p(v, y1), f.p(u, y1)], f.n);
    if (tier > 0)
      face(
        out,
        'dressed',
        'stoneDark',
        [f.p(u, y), f.p(v, h), f.p(v, h, -0.43), f.p(u, y, -0.43)],
        [0, -1, 0],
      );
  }
  if (tier > 0)
    for (const sign of [-1, 1]) {
      const u = m + sign * r;
      face(out, 'dressed', 'ash', [
        f.p(u, y0),
        f.p(u, spring),
        f.p(u, spring, -0.43),
        f.p(u, y0, -0.43),
      ]);
    }
  if (tier >= 1) archTrim(out, f, 'dressed', 'stoneLight', m, y0, spring, r, rise, 0.13, n, 0.032);
  if (tier >= 2) {
    hline(out, f, 'metal', 'iron', m - r, m + r, y0 + 0.62, 0.079, -0.23);
    for (let i = 1; i < 7; i++)
      vline(out, f, 'metal', 'iron', m - r + i * ((2 * r) / 7), y0, y0 + 0.62, 0.035, -0.23);
  }
}
function bell(out, x, z, y, scale, tier) {
  const shape =
    tier === 0
      ? [
          [0, 0.4],
          [-1.22, 0.94],
        ]
      : tier === 1
        ? [
            [0, 0.34],
            [-0.44, 0.58],
            [-0.89, 0.7],
            [-1.22, 0.94],
          ]
        : [
            [0, 0.34],
            [-0.23, 0.52],
            [-0.62, 0.64],
            [-1.02, 0.75],
            [-1.22, 0.94],
          ];
  const n = [3, 8, 10, 16, 20][tier];
  const rows = shape.toReversed().map(([h, r]) => [y + h * scale, r * scale]);
  radial(out, 'bell', 'bell', x, z, rows, n, false);
  if (tier >= 1)
    radial(
      out,
      'bell',
      'bellDark',
      x,
      z,
      rows.map(([h, r]) => [h - 0.014, r * 0.925]),
      n,
      false,
    );
  if (tier >= 1) {
    radial(
      out,
      'bell',
      'bell',
      x,
      z,
      [
        [y - 1.2 * scale, 0.93 * scale],
        [y - 1.12 * scale, 0.91 * scale],
      ],
      n,
      false,
    );
    beam(
      out,
      'bell',
      [x, y - 0.23 * scale, z],
      [x, y - 1.4 * scale, z],
      0.096 * scale,
      0.096 * scale,
      color.bellDark,
    );
  }
}
function tower(out, s, tier) {
  const { x, z, top } = s;
  volume(
    out,
    'basalt',
    'stone',
    x,
    z,
    [
      [-0.42, 9.16, 8.54],
      [22.02, 9.16, 8.54],
    ],
    0,
  );
  const sides = [
    [
      [x - 4.58, z - 4.27],
      [x + 4.58, z - 4.27],
    ],
    [
      [x + 4.58, z + 4.27],
      [x - 4.58, z + 4.27],
    ],
  ];
  for (const side of sides) {
    const f = wallFrame(side),
      u = f.L / 2;
    panel(out, f, 'plaster', 'plasterLight', 0.66, f.L - 0.67, 0.72, 10.22, 0.027);
    panel(out, f, 'plaster', 'plasterLight', 0.65, f.L - 0.65, 12.28, 20.26, 0.027);
    window(out, f, u, 3.31, 0.87, 3.72, tier, 0.065);
    if (tier > 0) oculus(out, f, u, 16.44, 1.17, tier, 0.078, { plain: true });
    if (tier > 0) band(out, f, 0, f.L, 11.2, 0.09, tier);
  }
  volume(
    out,
    'dressed',
    'ash',
    x,
    z,
    tier === 0
      ? [
          [21.65, 9.41, 8.94],
          [22.47, 8.6, 8.3],
        ]
      : [
          [21.65, 9.67, 9.18],
          [22.11, 9.67, 9.18],
          [22.47, 8.6, 8.3],
        ],
    tier === 0 ? 0 : 0.44,
  );
  const ring =
    tier === 0
      ? [
          [x - 4.13, z - 3.98],
          [x + 4.13, z - 3.98],
          [x + 4.13, z + 3.98],
          [x - 4.13, z + 3.98],
        ]
      : chamferedRectangle(x, 0, z, 8.45, 8.13, 1.02)
          .map(([a, , b]) => [a, b])
          .toReversed();
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      f = wallFrame([a, b]);
    if (f.L < 3) panel(out, f, 'basalt', 'stoneWarm', 0, f.L, 22.4, 31.87);
    else opening(out, f, 22.4, 31.87, f.L * 0.333, 28.78, 1.69, [3, 5, 11, 16, 20][tier], tier);
  }
  if (tier >= 1)
    beam(out, 'dressed', [x - 3.5, 30.42, z], [x + 3.5, 30.42, z], 0.32, 0.3, color.ash);
  const bells =
    tier < 2
      ? [[0, 0, 1.08]]
      : [
          [-1.28, -0.64, 1.11],
          [1.07, 0.85, 0.89],
        ];
  for (const [a, b, w] of bells) bell(out, x + a, z + b, 29.51, w, tier);
  volume(
    out,
    'dressed',
    'stoneWarm',
    x,
    z,
    tier === 0
      ? [
          [31.66, 8.93, 8.63],
          [32.55, 8.07, 7.79],
        ]
      : [
          [31.66, 8.93, 8.63],
          [32.11, 9.02, 8.72],
          [32.55, 8.07, 7.79],
        ],
    tier === 0 ? 0 : 0.62,
  );
  const facets = tier === 0 ? 6 : tier === 1 ? 8 : 12;
  const drum = radialRing(0, 3.17, 3.11, facets, [x, z])
    .map(([a, , b]) => [a, b])
    .toReversed();
  for (const [i, a] of drum.entries()) {
    const f = wallFrame([a, drum[(i + 1) % facets]]),
      u = f.L * 0.5;
    panel(out, f, 'plaster', 'plasterLight', 0, f.L, 32.51, 34.67);
    if (i % 2 === 0 && tier > 0)
      oculus(out, f, u, 33.58, Math.min(0.53, u * 0.69), tier, 0.024, { plain: true });
    if (tier >= 2) {
      panel(out, f, 'dressed', 'stoneWarm', 0.035, 0.19, 32.5, 34.67, 0.042);
      hline(out, f, 'dressed', 'stoneLight', 0, f.L, 34.49, 0.15, 0.049);
    }
  }
  const profile = [
    [34.63, 3.21],
    [34.88, 3.67],
    [35.35, 3.7],
    [35.72, 3.46],
    [36.15, 2.94],
    [36.62, 2.15],
    [37.1, 1.84],
    [37.59, 1.72],
    [37.98, 1.82],
    [38.34, 1.75],
    [38.7, 1.4],
    [38.96, 1.06],
    [39.15, 0.59],
    [39.47, 0.34],
    [39.76, 0.2],
  ];
  const rows = profile.filter((_, i) =>
    tier === 0
      ? [0, 2, 6, 9, 14].includes(i)
      : tier === 1
        ? [0, 2, 4, 6, 9, 12, 14].includes(i)
        : true,
  );
  radial(out, 'dressed', 'stoneWarm', x, z, rows, [6, 10, 16, 25, 32][tier], false);
  radial(
    out,
    'dressed',
    'stoneDark',
    x,
    z,
    tier === 0
      ? [
          [39.69, 0.23],
          [40.31, 0.1],
        ]
      : [
          [39.69, 0.23],
          [39.97, 0.37],
          [40.19, 0.29],
          [40.31, 0.1],
        ],
    tier < 2 ? 5 : 10,
    false,
  );
  beam(out, 'metal', [x, 40.28, z], [x, top, z], 0.085, 0.085, color.iron);
  if (tier >= 1)
    beam(
      out,
      'metal',
      [x, top - 0.37, z - 0.32],
      [x, top - 0.37, z + 0.32],
      0.075,
      0.074,
      color.iron,
    );
}

function cupola(out, s, tier) {
  const { x, z, rx, rz, y, height } = s,
    n = [4, 6, 13, 20, 24][tier];
  if (tier === 0) {
    if (z === layout.zCenter) {
      const base = radialRing(y, rx, rz, n, [x, z]);
      for (let i = 0; i < n; i++)
        face(out, 'paintedRoof', 'red', [base[i], base[(i + 1) % n], [x, y + height, z]], up);
      return;
    }
    radial(
      out,
      'paintedRoof',
      'red',
      x,
      z,
      [
        [y, rx, rz],
        [y + height * 0.66, rx * 0.68, rz * 0.68],
      ],
      n,
      false,
    );
    const cap = radialRing(y + height * 0.66, rx * 0.68, rz * 0.68, n, [x, z]);
    for (let i = 0; i < n; i++)
      face(out, 'paintedRoof', 'red', [cap[i], cap[(i + 1) % n], [x, y + height, z]], up);
    return;
  }
  if (tier === 1) {
    const rows = [
      [y, rx, rz],
      [y + height * 0.5, rx * 0.866, rz * 0.866],
      [y + height * 0.84, rx * 0.542, rz * 0.542],
    ];
    radial(out, 'paintedRoof', 'red', x, z, rows, n, false);
    const cap = radialRing(y + height * 0.84, rx * 0.542, rz * 0.542, n, [x, z]);
    for (let i = 0; i < n; i++)
      face(out, 'paintedRoof', 'red', [cap[i], cap[(i + 1) % n], [x, y + height, z]], up);
    return;
  }
  const body = Array.from({ length: [3, 4, 7, 10, 12][tier] }, (_, i) => {
    const a = ((Math.PI * 0.5 - 0.065) * i) / ([3, 4, 7, 10, 12][tier] - 1);
    return [y + height * Math.sin(a), rx * Math.cos(a), rz * Math.cos(a)];
  });
  radial(out, 'paintedRoof', 'red', x, z, body, n, false);
  if (tier >= 2) {
    radial(
      out,
      'paintedRoof',
      'redDark',
      x,
      z,
      [
        [y - 0.07, rx * 1.025, rz * 1.025],
        [y + 0.12, rx * 1.025, rz * 1.025],
      ],
      n,
      false,
    );
    radial(
      out,
      'paintedRoof',
      'redDark',
      x,
      z,
      [
        [y + height - 0.075, 0.27, 0.27],
        [y + height + 0.12, 0.27, 0.27],
      ],
      tier >= 2 ? 9 : 5,
      true,
    );
  }
}
function roofFinial(out, x, z, y, tier) {
  radial(
    out,
    'plaster',
    'plasterLight',
    x,
    z,
    [
      [y, 0.31],
      [y + 0.16, 0.3],
      [y + 0.45, 0.19],
      [y + 0.68, 0.33],
      [y + 0.91, 0.22],
      [y + 1.15, 0.09],
    ],
    tier >= 3 ? 10 : 6,
    true,
  );
}
function rail(out, tier) {
  if (tier === 0) return;
  for (const w of layout.visibleWalls) {
    const f = wallFrame([w.a, w.b]);
    hline(out, f, 'plaster', 'plasterLight', 0, w.length, 18.92, 0.25, 0.073);
    if (tier === 1) {
      hline(out, f, 'plaster', 'plasterSide', 0, w.length, 19.42, 0.65, 0.057);
      continue;
    }
    const bays = Math.max(1, Math.round(w.length / 4.05)),
      d = w.length / bays;
    hline(out, f, 'plaster', 'plasterLight', 0, w.length, 19.65, 0.17, 0.086);
    for (let j = 0; j <= bays; j++) {
      const u = j * d,
        p = f.p(u, 0, -0.28);
      volume(
        out,
        'plaster',
        'plasterLight',
        p[0],
        p[2],
        [
          [18.86, 0.54, 0.54],
          [19.74, 0.54, 0.54],
        ],
        0,
      );
      if (tier >= 3 && j < bays) roofFinial(out, p[0], p[2], 19.69, tier);
      if (j === bays) continue;
      const count = tier === 2 ? 4 : 8;
      for (let i = 1; i <= count; i++) {
        const x = u + (i * d) / (count + 1);
        if (tier === 2) vline(out, f, 'plaster', 'plasterLight', x, 19.04, 19.63, 0.115, 0.042);
        else {
          const p = f.p(x, 0, -0.14);
          radial(
            out,
            'plaster',
            'plasterLight',
            p[0],
            p[2],
            [
              [19.04, 0.088],
              [19.16, 0.08],
              [19.3, 0.123],
              [19.51, 0.06],
              [19.64, 0.083],
            ],
            6,
            false,
          );
        }
      }
    }
  }
}

function crossing(out, tier) {
  const { x, z, base, radius, drumBase, spring, crown, top } = layout.dome;
  const n = [8, 12, 14, 18, 20][tier],
    ring = radialRing(0, radius, radius, n, [x, z])
      .map(([a, , b]) => [a, b])
      .toReversed();
  radial(
    out,
    'plaster',
    'plasterSide',
    x,
    z,
    tier === 0
      ? [
          [base, radius + 0.42],
          [drumBase, radius],
        ]
      : [
          [base, radius + 0.43],
          [drumBase - 0.43, radius + 0.43],
          [drumBase, radius + 0.03],
        ],
    n,
    false,
  );
  for (const [i, a] of ring.entries()) {
    const f = wallFrame([a, ring[(i + 1) % n]]),
      u = f.L / 2;
    panel(out, f, 'plaster', 'plasterLight', 0, f.L, drumBase, spring);
    if (tier > 0 || i % 2 === 0)
      window(out, f, u, drumBase + 0.91, Math.min(0.86, f.L * 0.31), 4.37, tier, 0.042, {
        paired: tier >= 2,
      });
    if (tier >= 2) {
      panel(out, f, 'plaster', 'plasterSide', 0.02, 0.17, drumBase, spring, 0.08);
      hline(out, f, 'plaster', 'plasterLight', 0, f.L, drumBase + 0.52, 0.19, 0.083);
    }
  }
  if (tier >= 1)
    radial(
      out,
      'plaster',
      'plasterSide',
      x,
      z,
      [
        [spring - 0.19, radius + 0.24],
        [spring + 0.1, radius + 0.3],
        [spring + 0.27, radius + 0.05],
      ],
      n,
      false,
    );
  const roof = Array.from({ length: [3, 5, 10, 14, 18][tier] }, (_, i) => {
    const a = ((Math.PI * 0.5 - 0.107) * i) / ([3, 5, 10, 14, 18][tier] - 1);
    return [spring + (crown - spring) * Math.sin(a), radius * Math.cos(a)];
  });
  radial(out, 'tile', 'tile', x, z, roof, [6, 12, 20, 30, 36][tier], false);
  if (tier >= 2) {
    const count = tier === 2 ? 10 : 16;
    for (let i = 0; i < count; i++) {
      const a = (tau * i) / count,
        ps = roof
          .filter((_, i) => i % 2 === 0 || i === roof.length - 1)
          .map(([y, r]) => [x + (r + 0.03) * Math.cos(a), y + 0.022, z + (r + 0.03) * Math.sin(a)]);
      beamPath(out, 'tile', ps, 0.063, 0.062, color.tileShade);
    }
  }
  radial(
    out,
    'plaster',
    'plasterLight',
    x,
    z,
    tier === 0
      ? [
          [crown - 0.1, 0.89],
          [crown + 1.56, 1.01],
        ]
      : [
          [crown - 0.1, 0.89],
          [crown + 0.34, 1.07],
          [crown + 1.56, 1.01],
        ],
    tier < 2 ? 6 : 10,
    tier > 0,
  );
  if (tier >= 1) {
    const ring = radialRing(0, 1.015, 1.015, 8, [x, z])
      .map(([a, , b]) => [a, b])
      .toReversed();
    for (const [i, a] of ring.entries()) {
      const f = wallFrame([a, ring[(i + 1) % ring.length]]),
        u = f.L / 2;
      archFill(out, f, 'metal', 'glassDeep', u, crown + 0.34, crown + 1.17, 0.19, 0.19, 5, 0.025);
    }
  }
  radial(
    out,
    'tile',
    'tileShade',
    x,
    z,
    tier === 0
      ? [
          [crown + 1.54, 1.13],
          [crown + 2.53, 0.11],
        ]
      : [
          [crown + 1.54, 1.13],
          [crown + 1.99, 0.82],
          [crown + 2.33, 0.37],
          [crown + 2.53, 0.11],
        ],
    tier < 2 ? 6 : 12,
    false,
  );
  beam(out, 'metal', [x, crown + 2.51, z], [x, top, z], 0.12, 0.13, color.iron);
  beam(
    out,
    'metal',
    [x, top - 0.62, z - 0.56],
    [x, top - 0.62, z + 0.56],
    0.105,
    0.116,
    color.iron,
  );
}

export function buildLagunaLevel(out, level) {
  const tier = rank[level];
  if (tier === undefined) throw Error(`Unknown cathedral level ${level}`);
  masses(out, tier);
  approaches(out, tier);
  facade(out, tier);
  for (const t of layout.towers) tower(out, t, tier);
  for (const s of layout.cupolas) cupola(out, s, tier);
  rail(out, tier);
  crossing(out, tier);
}
export const buildLagunaSkyline = (out) => buildLagunaLevel(out, 'skyline');
export const buildLagunaDistrict = (out) => buildLagunaLevel(out, 'district');
export const buildLagunaStreet = (out) => buildLagunaLevel(out, 'street');
export const buildLagunaCloseup = (out) => buildLagunaLevel(out, 'closeup');
