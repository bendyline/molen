/** Present-day Torhalle and the three standing bays of the abbey church. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.9 },
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.81 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.72, metallic: 0.25 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const palette = {
  sand: 'b6a180',
  cream: 'd8c6a8',
  plaster: 'd3bfa1',
  chalk: 'e0d3b8',
  brown: 'a58269',
  rose: 'ad775f',
  red: '9e6351',
  paleRed: 'b68a70',
  roseDark: '8b5d4c',
  oldStone: 'b1a28c',
  rubble: 'b4a48a',
  rubbleDark: '968873',
  rubbleLight: 'bcac92',
  brownStone: 'a09481',
  moss: '9a9878',
  stoneDark: '827462',
  floor: 'b2a287',
  floorDark: 'a48e75',
  slate: '65696b',
  slateDark: '525a5d',
  ridge: '858982',
  tile: '926f59',
  tileDark: '7e6455',
  wood: '625046',
  woodDark: '4e453a',
  glass: '485258',
  iron: '4b4942',
  bell: '777361',
  shutter: '79715e',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((h) => {
      const s = parseInt(h, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  TAU = Math.PI * 2,
  mix = (a, b, t) => a + (b - a) * t;
const faceNormal = (s) => [0, 0, s];
const gate = { x0: -4.31, x1: 6.63, z0: -3.635, z1: 3.484, eave: 8.05, mid: 1.16 };
const church = {
  x0: -5.42,
  x1: 7.13,
  z0: -72.38,
  z1: -55.7,
  eave: 13.84,
  ridge: 20.45,
  floor: 1.94,
  mid: 0.855,
};
function tri(out, slot, tint, points, want) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, color[tint]);
}
function quad(out, slot, tint, [a, b, c, d], want) {
  tri(out, slot, tint, [a, b, c], want);
  tri(out, slot, tint, [a, c, d], want);
}
function block(out, slot, tint, min, max) {
  box(out, slot, min, max, color[tint]);
}
function panel(out, slot, tint, a, b, y, h, z, s) {
  if (b - a < 0.001 || h - y < 0.001) return;
  quad(
    out,
    slot,
    tint,
    [
      [a, y, z],
      [b, y, z],
      [b, h, z],
      [a, h, z],
    ],
    faceNormal(s),
  );
}
function level(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((n, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (n - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return mix(
    mix(heights[k], heights[k + 1], a),
    mix(heights[k + size[0]], heights[k + size[0] + 1], a),
    b,
  );
}
function polygon(out, slot, tint, ring, y) {
  const ix = earcut(ring.flat(), undefined, 2);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      tint,
      ix.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]),
      up,
    );
}
function sideWalls(out, slot, tint, ring, top, foot) {
  const sign = Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - a * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    quad(
      out,
      slot,
      tint,
      [
        [x, foot(x, z), z],
        [u, foot(u, v), v],
        [u, top, v],
        [x, top, z],
      ],
      [sign * (v - z), 0, sign * (x - u)],
    );
  }
}
function archCurve(x, cy, w, rise, z, n, pointed = false) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    if (pointed) {
      const u = (2 * i) / n - 1;
      return [x + w * u, cy + rise * Math.sqrt(1 - Math.abs(u)), z];
    }
    return [x - w * Math.cos(t), cy + rise * Math.sin(t), z];
  });
}
function archOpening(out, config, d) {
  const {
    slot,
    tint,
    x,
    y,
    spring,
    w,
    rise,
    z,
    s,
    cap,
    depth = 0.34,
    rim = 0.22,
    door,
    pointed,
    inner,
  } = config;
  const n = d === 0 ? (pointed ? 6 : 5) : d === 1 ? 9 : d === 2 ? 14 : d === 3 ? 22 : 30;
  const inside = archCurve(x, spring, w, rise, z, n, pointed),
    back = z - depth * s;
  const trim = archCurve(x, spring, w + rim, rise + rim * 0.82, z + s * 0.042, n, pointed);
  for (let i = 0; i < n; i++) {
    const p = inside[i],
      q = inside[i + 1],
      r = trim[i],
      t = trim[i + 1];
    quad(out, slot, tint, [p, q, [q[0], cap, z], [p[0], cap, z]], faceNormal(s));
    if (inner) continue;
    quad(out, slot, i % 3 === 0 ? 'paleRed' : 'rose', [p, q, t, r], faceNormal(s));
    quad(
      out,
      slot,
      'roseDark',
      [p, q, [q[0], q[1], back], [p[0], p[1], back]],
      [x - (p[0] + q[0]) * 0.5, -1, 0],
    );
  }
  if (inner) return;
  for (const side of [-1, 1]) {
    const x0 = x + side * w;
    quad(
      out,
      slot,
      'roseDark',
      [
        [x0, y, z],
        [x0, y, back],
        [x0, spring, back],
        [x0, spring, z],
      ],
      [-side, 0, 0],
    );
    panel(
      out,
      slot,
      'paleRed',
      side < 0 ? x0 - rim : x0,
      side < 0 ? x0 : x0 + rim,
      y,
      spring,
      z + s * 0.027,
      s,
    );
  }
  if (!door) return;
  const material = door === 'glass' ? 'glass' : 'wood',
    tone = door === 'glass' ? 'glass' : 'woodDark';
  panel(out, material, tone, x - w, x + w, y, spring, back, s);
  for (let i = 0; i < n; i++) {
    const p = inside[i],
      q = inside[i + 1];
    tri(
      out,
      material,
      tone,
      [
        [x, spring, back],
        [p[0], p[1], back],
        [q[0], q[1], back],
      ],
      faceNormal(s),
    );
  }
  if (d >= 2) {
    panel(out, 'wood', 'iron', x - 0.027, x + 0.027, y, spring + rise * 0.84, back + s * 0.018, s);
    if (door === 'glass')
      for (const f of [0.38, 0.72])
        panel(
          out,
          'wood',
          'iron',
          x - w,
          x + w,
          mix(y, spring, f) - 0.022,
          mix(y, spring, f) + 0.022,
          back + s * 0.018,
          s,
        );
  }
}
function openingBand(out, bounds, openings, d) {
  const { x0, x1, bottom, top, z, s, slot, tint } = bounds;
  let u = x0;
  for (const p of openings) {
    panel(out, slot, tint, u, p.x - p.w, bottom, top, z, s);
    panel(out, slot, tint, p.x - p.w, p.x + p.w, bottom, p.y, z, s);
    archOpening(out, { ...p, slot, tint, z, s, cap: top }, d);
    u = p.x + p.w;
  }
  panel(out, slot, tint, u, x1, bottom, top, z, s);
}
function course(out, slot, tint, x0, x1, y, h, z, s, depth) {
  const a = z + s * depth;
  panel(out, slot, tint, x0, x1, y, h, a, s);
  quad(
    out,
    slot,
    tint,
    [
      [x0, h, z],
      [x1, h, z],
      [x1, h, a],
      [x0, h, a],
    ],
    up,
  );
  quad(
    out,
    slot,
    tint,
    [
      [x0, y, z],
      [x1, y, z],
      [x1, y, a],
      [x0, y, a],
    ],
    [0, -1, 0],
  );
}
function shaft(out, x, z, y, h, r, d, tint) {
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : d === 3 ? 15 : 21;
  const profile =
    d <= 1
      ? [
          [y, r],
          [h, r * 0.87],
        ]
      : [
          [y, r * 1.22],
          [y + 0.12, r * 1.22],
          [y + 0.23, r],
          [h - 0.24, r * 0.89],
          [h - 0.1, r * 1.07],
          [h, r * 1.32],
        ];
  loft(
    out,
    'stone',
    profile.map(([t, k]) => radialRing(t, k, k, n, [x, z])),
    color[tint],
  );
  if (d >= 2) {
    block(
      out,
      'stone',
      'cream',
      [x - r * 1.29, h - 0.01, z - r * 1.29],
      [x + r * 1.29, h + 0.1, z + r * 1.29],
    );
    if (d >= 3)
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7,
          p = [x + Math.cos(a) * r * 0.73, h - 0.37, z + Math.sin(a) * r * 0.73],
          q = [x + Math.cos(a) * r * 1.3, h - 0.05, z + Math.sin(a) * r * 1.3];
        beam(out, 'stone', p, q, 0.074, 0.054, color.cream);
      }
  }
}
function gatePattern(out, z, s, d, windows, arches) {
  if (d === 0) return;
  const n = d === 1 ? 12 : d === 2 ? 21 : d === 3 ? 27 : 32,
    dx = (gate.x1 - gate.x0 - 0.4) / n;
  for (let j = 0; j < (d === 1 ? 4 : 7); j++)
    for (let i = 0; i < n; i++) {
      const x = gate.x0 + 0.2 + (i + 0.5 + (j % 2) * 0.28) * dx,
        y = 4.91 + (j + 0.5) * ((7.86 - 4.91) / (d === 1 ? 4 : 7));
      const h = (d === 1 ? 0.33 : 0.208) * 0.88,
        w = dx * 0.43;
      if (
        windows.some(
          (p) =>
            Math.abs(x - p.x) < p.w + w + 0.08 &&
            y + h > p.y - 0.1 &&
            y - h < p.spring + p.rise + 0.17,
        )
      )
        continue;
      const pts = Array.from({ length: 6 }, (_, k) => [
        x + Math.cos((Math.PI * k) / 3) * w,
        y + Math.sin((Math.PI * k) / 3) * h,
        z + s * 0.013,
      ]);
      const tint = ['red', 'rose', 'paleRed', 'brown', 'rose', 'rose'][(i * 7 + j * 5) % 6];
      for (let k = 1; k < pts.length - 1; k++)
        tri(out, 'stone', tint, [pts[0], pts[k], pts[k + 1]], faceNormal(s));
    }
  for (let i = 0; i < n; i++) {
    const x = gate.x0 + 0.2 + (i + 0.5) * dx,
      y = 4.37,
      r = dx * 0.46,
      h = 0.23;
    quad(
      out,
      'stone',
      i % 3 === 1 ? 'paleRed' : 'rose',
      [
        [x - r, y, z + s * 0.014],
        [x, y + h, z + s * 0.014],
        [x + r, y, z + s * 0.014],
        [x, y - h, z + s * 0.014],
      ],
      faceNormal(s),
    );
  }
  if (d >= 2) {
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < n; i++) {
        if ((i + j) % 2) continue;
        const x = gate.x0 + 0.2 + (i + 0.5) * dx,
          y = 3.06 + j * 0.255;
        const blocked = arches.some((p) => {
          const u = (x - p.x) / (p.w + p.rim + dx * 0.5);
          return (
            Math.abs(u) < 1 &&
            y - 0.108 < p.spring + (p.rise + p.rim) * Math.sqrt(Math.max(0, 1 - u * u))
          );
        });
        if (!blocked)
          panel(
            out,
            'stone',
            i % 6 === 0 ? 'brown' : 'rose',
            x - dx * 0.46,
            x + dx * 0.46,
            y - 0.107,
            y + 0.107,
            z + s * 0.014,
            s,
          );
      }
  }
}
function gateFloor(out, d) {
  const { x0, x1, z0, z1 } = gate,
    far = z1 + 0.88,
    back = z0 - 0.74;
  const floor = (z) => mix(0.205, -0.018, (z - back) / (far - back));
  const n = d === 0 ? 1 : d === 1 ? 4 : d === 2 ? 8 : 14,
    m = d === 0 ? 2 : d === 1 ? 6 : d === 2 ? 12 : 18;
  const grid = (u, v) => {
    const z = mix(back, far, v / m),
      x = mix(x0, x1, u / n);
    const edge = Math.min(1, Math.min(v, m - v) * 0.6);
    return [x, Math.max(level(x, z) + mix(0.1, 0.28, edge), floor(z)), z];
  };
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      quad(
        out,
        'stone',
        (i + 2 * j) % 7 === 0 ? 'floorDark' : 'floor',
        [grid(i, j), grid(i + 1, j), grid(i + 1, j + 1), grid(i, j + 1)],
        up,
      );
}
function tower(out, ring, d) {
  const [x, z] = ring.reduce(
    ([u, v], [a, b]) => [u + a / ring.length, v + b / ring.length],
    [0, 0],
  );
  sideWalls(out, 'rubble', 'rubble', ring, 5.42, (a, b) => level(a, b) - 0.19);
  const at = (p, t, k, shift = 0) => [mix(x, p[0], k) + shift, t, mix(z, p[1], k)];
  const shift = x < 0 ? 0.73 : -0.73,
    profile =
      d === 0
        ? [
            [5.35, 1.07, 0],
            [8.45, 0.1, shift],
          ]
        : [
            [5.36, 1.08, 0],
            [5.56, 0.98, 0],
            [6.7, 0.72, shift * 0.5],
            [7.91, 0.3, shift * 0.86],
            [8.53, 0.078, shift],
          ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = at(a, ...profile[j - 1]),
        q = at(b, ...profile[j - 1]);
      quad(
        out,
        'slate',
        i % 3 === 0 ? 'slateDark' : 'slate',
        [p, q, at(b, ...profile[j]), at(a, ...profile[j])],
        [p[0] - x, 0.42, p[2] - z],
      );
    }
  polygon(
    out,
    'slate',
    'slateDark',
    ring.map((p) => {
      const a = at(p, ...profile.at(-1));
      return [a[0], a[2]];
    }),
    profile.at(-1)[0],
  );
  if (d >= 2) {
    const side = ring.toSorted((a, b) => a[1] - b[1]).at(-1);
    panel(out, 'glass', 'glass', side[0] - 0.072, side[0] + 0.072, 1.33, 2.14, side[1] + 0.019, 1);
  }
}
function gateRoof(out, d) {
  const left = gate.x0 - 0.36,
    right = gate.x1 + 0.38;
  const profile = [
    [-4.02, 7.99],
    [-3.68, 8.3],
    [-0.12, 14.38],
    [3.59, 8.33],
    [3.96, 7.99],
  ];
  const at = (x, [z, y]) => [x, y, z];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    quad(
      out,
      'slate',
      i === 2 ? 'slateDark' : 'slate',
      [at(left, a), at(right, a), at(right, b), at(left, b)],
      up,
    );
    if (d >= 3 && i > 1 && i < 4)
      for (let j = 1; j < 14; j++) {
        const t = j / 14,
          z = mix(a[0], b[0], t),
          y = mix(a[1], b[1], t) + 0.016;
        quad(
          out,
          'slate',
          j % 4 === 0 ? 'ridge' : 'slateDark',
          [
            [left, y, z],
            [right, y, z],
            [right, y + 0.017, z + 0.011],
            [left, y + 0.017, z + 0.011],
          ],
          up,
        );
      }
  }
  for (const [x, s] of [
    [left, -1],
    [right, 1],
  ]) {
    for (let i = 1; i < profile.length; i++)
      quad(
        out,
        'rubble',
        'rubble',
        [
          at(x, profile[i - 1]),
          at(x, profile[i]),
          [x, 7.94, profile[i][0]],
          [x, 7.94, profile[i - 1][0]],
        ],
        [s, 0, 0],
      );
  }
  if (d >= 1) {
    beam(out, 'slate', [left, 14.39, -0.12], [right, 14.39, -0.12], 0.19, 0.18, color.ridge);
    for (const s of [-1, 1]) {
      const z = s * 2.58,
        x = 0.65,
        y = 10.04;
      panel(out, 'wood', 'wood', x - 0.4, x + 0.4, y, y + 0.79, z, s);
      panel(out, 'glass', 'glass', x - 0.17, x + 0.17, y + 0.14, y + 0.63, z + s * 0.019, s);
      const roof = [
        [x - 0.5, y + 0.66, z + s * 0.06],
        [x, y + 1.02, z + s * 0.06],
        [x + 0.5, y + 0.66, z + s * 0.06],
      ];
      tri(out, 'slate', 'slateDark', roof, faceNormal(s));
      for (const [i, j] of [
        [0, 1],
        [1, 2],
      ])
        quad(
          out,
          'slate',
          'slate',
          [
            roof[i],
            roof[j],
            [roof[j][0], roof[j][1] + 0.5, z - s * 0.37],
            [roof[i][0], roof[i][1] + 0.5, z - s * 0.37],
          ],
          up,
        );
    }
  }
  const x = -3.04,
    z = -0.12,
    base = 14.36,
    top = 15.85,
    w = 0.43;
  if (d === 0) {
    for (const s of [-1, 1])
      beam(out, 'wood', [x + s * w, base, z], [x + s * w, top, z], 0.12, 0.13, color.roseDark);
  } else {
    for (const s of [-1, 1])
      for (const u of [-1, 1])
        block(
          out,
          'wood',
          'roseDark',
          [x + s * w - 0.065, base, z + u * w - 0.066],
          [x + s * w + 0.065, top, z + u * w + 0.066],
        );
    block(
      out,
      'wood',
      'roseDark',
      [x - 0.53, top - 0.12, z - 0.53],
      [x + 0.53, top + 0.1, z + 0.53],
    );
    loft(
      out,
      'metal',
      [
        [14.84, 0.19],
        [14.95, 0.16],
        [15.21, 0.118],
        [15.25, 0.076],
      ].map(([y, r]) => radialRing(y, r, r, d >= 2 ? 12 : 7, [x, z])),
      color.bell,
    );
  }
  const rows =
    d === 0
      ? [
          [top, 0.53],
          [16.48, 0.35],
          [16.9, 0.069],
        ]
      : [
          [top, 0.56],
          [16.1, 0.45],
          [16.4, 0.49],
          [16.62, 0.37],
          [16.82, 0.16],
          [16.96, 0.054],
        ];
  loft(
    out,
    'slate',
    rows.map(([y, r]) => radialRing(y, r, r, d >= 2 ? 12 : 6, [x, z])),
    color.slate,
  );
  if (d >= 1) beam(out, 'metal', [x, 16.92, z], [x, 17.4, z], 0.045, 0.045, color.iron);
}
function torhalle(out, d) {
  const { x0, x1, z0, z1, eave } = gate;
  gateFloor(out, d);
  for (const [z, s] of [
    [z0, -1],
    [z1, 1],
  ]) {
    const arches = [
      [-2.4, 1.22],
      [1.16, 1.38],
      [4.69, 1.23],
    ].map(([x, w]) => ({
      x,
      w,
      y: Math.max(level(x, z), 0) + 0.025,
      spring: 2.15,
      rise: w,
      rim: 0.25,
      depth: 0.54,
    }));
    openingBand(
      out,
      { x0, x1, bottom: -0.3, top: 4.64, z, s, slot: 'stone', tint: 'cream' },
      arches,
      d,
    );
    if (d >= 1)
      openingBand(
        out,
        {
          x0,
          x1,
          bottom: -0.3,
          top: 4.64,
          z: z - s * 0.54,
          s: -s,
          slot: 'stone',
          tint: 'oldStone',
        },
        arches.map((p) => ({ ...p, inner: true })),
        d,
      );
    const windows = [-2.59, 4.91].map((x) => ({
      x,
      w: 0.32,
      y: 5.64,
      spring: 6.66,
      rise: 0.34,
      rim: 0.11,
      depth: 0.22,
      door: 'glass',
    }));
    openingBand(
      out,
      { x0, x1, bottom: 4.64, top: eave, z, s, slot: 'stone', tint: 'chalk' },
      windows,
      d,
    );
    gatePattern(out, z, s, d, windows, arches);
    course(out, 'stone', 'sand', x0 - 0.08, x1 + 0.08, 4.62, 4.86, z, s, 0.13);
    course(out, 'wood', 'woodDark', x0 - 0.22, x1 + 0.22, 7.91, 8.04, z, s, 0.23);
    for (const x of [x0 + 0.3, -0.69, 2.98, x1 - 0.32])
      shaft(out, x, z + s * 0.105, 0.1, 4.61, 0.178, d, 'rose');
    if (d >= 1) {
      const n = 9,
        spacing = (x1 - x0 - 0.7) / n;
      for (let i = 0; i <= n; i++) {
        const x = x0 + 0.35 + spacing * i;
        if (i < n)
          beamPath(
            out,
            'stone',
            [
              [x, 7.16, z + s * 0.044],
              [x + spacing * 0.5, 7.87, z + s * 0.044],
              [x + spacing, 7.16, z + s * 0.044],
            ],
            0.093,
            0.08,
            color.rose,
          );
        if (d === 1)
          panel(out, 'stone', 'roseDark', x - 0.045, x + 0.045, 4.89, 7.18, z + s * 0.025, s);
        else shaft(out, x, z + s * 0.052, 4.87, 7.19, 0.071, d, 'rose');
      }
      if (d >= 3)
        for (let i = 0; i < 34; i++) {
          const x = mix(x0 + 0.16, x1 - 0.25, i / 34),
            o = z + s * 0.145;
          beamPath(
            out,
            'stone',
            [
              [x, 4.69, o],
              [x + 0.09, 4.77, o],
              [x + 0.18, 4.7, o],
            ],
            0.033,
            0.03,
            color.chalk,
          );
        }
    }
  }
  for (const [x, s] of [
    [x0, -1],
    [x1, 1],
  ]) {
    quad(
      out,
      'rubble',
      'rubble',
      [
        [x, -0.34, z0],
        [x, -0.34, z1],
        [x, eave, z1],
        [x, eave, z0],
      ],
      [s, 0, 0],
    );
    const inside = x - s * 0.008;
    quad(
      out,
      'rubble',
      'brownStone',
      [
        [inside, -0.18, z0],
        [inside, -0.18, z1],
        [inside, 3.95, z1],
        [inside, 3.95, z0],
      ],
      [-s, 0, 0],
    );
    if (d >= 1) {
      // Recessed tower doors are visible from inside the open passage.
      const w = s < 0 ? 0.67 : 0.61,
        z = 0.03;
      quad(
        out,
        'wood',
        'woodDark',
        [
          [x - s * 0.019, 0.29, z - w * 0.5],
          [x - s * 0.019, 0.29, z + w * 0.5],
          [x - s * 0.019, 2.17, z + w * 0.5],
          [x - s * 0.019, 2.17, z - w * 0.5],
        ],
        [-s, 0, 0],
      );
    }
  }
  quad(
    out,
    'wood',
    'wood',
    [
      [x0, 3.94, z0],
      [x1, 3.94, z0],
      [x1, 3.94, z1],
      [x0, 3.94, z1],
    ],
    [0, -1, 0],
  );
  if (d >= 1)
    for (let i = 0; i < (d === 1 ? 8 : 14); i++) {
      const n = d === 1 ? 8 : 14,
        x = mix(x0 + 0.24, x1 - 0.24, i / (n - 1));
      block(out, 'wood', 'woodDark', [x - 0.071, 3.82, z0 + 0.12], [x + 0.071, 3.95, z1 - 0.12]);
    }
  const g = layout.geometry.gate;
  tower(out, g.slice(2, 9), d);
  tower(out, g.slice(11, 17), d);
  gateRoof(out, d);
}
function churchButtress(out, lo, hi, y, x1, z1, wide, d) {
  const [x0, z0] = lo,
    [x2, z2] = hi;
  const ground = Math.min(level(x0, z0), level(x2, z0), level(x2, z2), level(x0, z2)) - 0.24;
  const ring = (a, b, c, e, t) => [
    [a, t, b],
    [a, t, e],
    [c, t, e],
    [c, t, b],
  ];
  const x = x2 - x0,
    z = z2 - z0;
  const base = ring(x0, z0, x2, z2, ground);
  const middle = ring(
    mix(x0, x1, 0.25),
    mix(z0, z1, 0.3),
    mix(x2, x1, 0.25),
    mix(z2, z1, 0.25),
    mix(ground, y, 0.58),
  );
  const top = ring(x1 - wide * 0.5, z1 - z * 0.3, x1 + wide * 0.5, z1 + z * 0.23, y);
  const rings = d <= 1 ? [base, top] : [base, middle, top];
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < 4; j++) {
      const a = rings[i - 1][j],
        b = rings[i - 1][(j + 1) % 4],
        c = rings[i][(j + 1) % 4],
        e = rings[i][j];
      const n = [a[0] + b[0] - x0 - x2, 0.3, a[2] + b[2] - z0 - z2];
      quad(out, 'rubble', j % 2 ? 'rubble' : 'rubbleLight', [a, b, c, e], n);
    }
  quad(out, 'stone', 'oldStone', top, up);
  if (d >= 2) {
    const w = wide * 0.56,
      l = z * 0.3;
    block(out, 'stone', 'oldStone', [x1 - w, y - 0.16, z1 - l], [x1 + w, y + 0.06, z1 + l]);
    if (x > 2 && z > 2) {
      const y0 = mix(ground, y, 0.62),
        w = x * 0.38,
        l = z * 0.33;
      block(
        out,
        'stone',
        'brownStone',
        [mix(x0, x2, 0.5) - w, y0 - 0.07, mix(z0, z2, 0.5) - l],
        [mix(x0, x2, 0.5) + w, y0 + 0.08, mix(z0, z2, 0.5) + l],
      );
    }
  }
}
function scarArch(out, d) {
  const { mid, z1 } = church,
    s = 1,
    cy = 5.36,
    r = 1.74,
    n = d === 1 ? 10 : d === 2 ? 16 : 22;
  const inner = archCurve(mid, cy, r, 1.83, z1 + 0.013, n);
  const outer = archCurve(mid, cy, r + 0.145, 1.96, z1 + 0.027, n);
  for (let i = 0; i < n; i++) {
    const a = inner[i],
      b = inner[i + 1],
      c = outer[i + 1],
      q = outer[i];
    quad(out, 'stone', i % 5 === 0 ? 'paleRed' : 'oldStone', [a, b, c, q], faceNormal(s));
  }
  for (const x of [-1, 1])
    panel(
      out,
      'stone',
      'brownStone',
      mid + x * r - 0.069,
      mid + x * r + 0.069,
      4.75,
      cy,
      z1 + 0.021,
      s,
    );
}
function aisleBlindArch(out, x, center, s, d) {
  const width = 1.43,
    base = 3.1,
    spring = 5.12,
    head = 1.47,
    n = d === 1 ? 7 : d === 2 ? 12 : 18;
  const rim = archCurve(center, spring, width, head, 0, n),
    outer = archCurve(center, spring, width + 0.14, head + 0.14, 0, n);
  const p = ([z, y], o) => [x + s * o, y, z],
    normal = [s, 0, 0];
  const a = p([center - width, base], 0.017),
    b = p([center + width, base], 0.017);
  quad(
    out,
    'rubble',
    'rubbleDark',
    [a, b, p([center + width, spring], 0.017), p([center - width, spring], 0.017)],
    normal,
  );
  for (let i = 0; i < n; i++) {
    tri(
      out,
      'rubble',
      'rubbleDark',
      [p([center, spring], 0.018), p(rim[i], 0.018), p(rim[i + 1], 0.018)],
      normal,
    );
    quad(
      out,
      'stone',
      i % 4 === 1 ? 'paleRed' : 'oldStone',
      [p(rim[i], 0.023), p(rim[i + 1], 0.023), p(outer[i + 1], 0.052), p(outer[i], 0.052)],
      normal,
    );
  }
  if (d >= 2) {
    const [l, h] = [center - 0.32, center + 0.32],
      y = 3.73;
    quad(
      out,
      'glass',
      'glass',
      [
        [x + s * 0.035, y, l],
        [x + s * 0.035, y, h],
        [x + s * 0.035, y + 1.3, h],
        [x + s * 0.035, y + 1.3, l],
      ],
      normal,
    );
  }
}
function churchRoof(out, d) {
  const { x0, x1, z0, z1, eave, ridge, mid } = church;
  const a = z0 - 0.31,
    b = z1 + 0.37;
  for (const [x, s] of [
    [x0 - 0.34, -1],
    [x1 + 0.34, 1],
  ]) {
    const p0 = [x, eave - 0.06, a],
      p1 = [x, eave - 0.06, b],
      p2 = [mid, ridge, b],
      p3 = [mid, ridge, a];
    quad(out, 'tile', s < 0 ? 'tileDark' : 'tile', [p0, p1, p2, p3], up);
    if (d >= 1) beam(out, 'wood', p0, p1, 0.15, 0.13, color.wood);
    if (d >= 3)
      for (let i = 1; i < 21; i++) {
        const t = i / 21,
          y = mix(eave - 0.06, ridge, t) + 0.019,
          u = mix(x, mid, t);
        quad(
          out,
          'tile',
          i % 5 === 0 ? 'tile' : 'tileDark',
          [
            [u, y, a],
            [u, y, b],
            [u + s * 0.019, y + 0.018, b],
            [u + s * 0.019, y + 0.018, a],
          ],
          up,
        );
      }
  }
  if (d >= 1)
    beam(out, 'tile', [mid, ridge + 0.025, a], [mid, ridge + 0.025, b], 0.18, 0.17, color.tileDark);
}
function churchFront(out, d) {
  const { x0, x1, z0, z1, mid, floor, eave, ridge } = church;
  const y0 = Math.min(level(x0, z1), level(x1, z1), level(mid, z1)) - 0.24;
  const wall = (bottom, top, z = z1, s = 1) => ({
    x0,
    x1,
    bottom,
    top,
    z,
    s,
    slot: 'rubble',
    tint: 'rubbleLight',
  });
  openingBand(
    out,
    wall(y0, 5.23),
    [
      {
        x: mid,
        w: 1.02,
        y: floor,
        spring: 3.51,
        rise: 1.4,
        rim: 0.18,
        pointed: true,
        door: 'wood',
        depth: 0.73,
      },
    ],
    d,
  );
  panel(out, 'rubble', 'rubble', x0, x1, 5.23, 8.48, z1, 1);
  const win = {
    x: mid,
    w: 0.8,
    y: 8.67,
    spring: 11.02,
    rise: 1.54,
    rim: 0.16,
    pointed: true,
    door: 'glass',
    depth: 0.38,
  };
  openingBand(out, wall(8.48, eave), [win], d);
  if (d >= 1) {
    scarArch(out, d);
    const z = z1 - 0.18,
      x = mid;
    for (const s of [-1, 1]) {
      const v = x + s * 0.345;
      const p = [
        [v - 0.2, 9.06, z],
        [v - 0.2, 11.1, z],
        [v, 11.92, z],
        [v + 0.2, 11.1, z],
        [v + 0.2, 9.06, z],
      ];
      beamPath(out, 'stone', p, 0.062, 0.071, color.oldStone);
    }
    course(out, 'stone', 'sand', x - 0.94, x + 0.94, 8.56, 8.7, z1, 1, 0.12);
  }
  for (const [z, s] of [
    [z0, -1],
    [z1, 1],
  ]) {
    const roofEdge = eave - 0.06 + ((ridge - eave + 0.06) * 0.34) / (mid - x0 + 0.34);
    panel(out, 'rubble', 'rubbleLight', x0, x1, eave, roofEdge, z, s);
    tri(
      out,
      'rubble',
      'rubbleLight',
      [
        [x0, roofEdge, z],
        [x1, roofEdge, z],
        [mid, ridge, z],
      ],
      faceNormal(s),
    );
    if (d >= 1) {
      panel(out, 'glass', 'glass', mid - 0.18, mid + 0.18, 15.71, 17.16, z + s * 0.023, s);
      if (d >= 2)
        course(out, 'stone', 'oldStone', mid - 0.23, mid + 0.23, 15.57, 15.72, z, s, 0.05);
    }
  }
  openingBand(
    out,
    wall(y0, eave, z0, -1),
    [
      {
        x: mid,
        w: 0.63,
        y: 7.83,
        spring: 10.16,
        rise: 1.05,
        pointed: true,
        rim: 0.13,
        door: 'glass',
        depth: 0.41,
      },
    ],
    d,
  );
  // The stone threshold and its two low treads sit on the sampled west approach.
  for (const [a, b, y] of [
    [z1 - 0.67, z1 + 0.38, floor],
    [z1 + 0.38, z1 + 0.75, floor - 0.13],
  ]) {
    block(
      out,
      'stone',
      'floor',
      [mid - 1.08, Math.min(level(mid, a), y - 0.19) - 0.17, a],
      [mid + 1.08, y, b],
    );
  }
}
function abbeyChurch(out, d) {
  const { x0, x1, z0, z1, eave } = church;
  churchFront(out, d);
  for (const [x, s] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const n = d === 0 ? 1 : 7;
    for (let i = 0; i < n; i++) {
      const a = mix(z0, z1, i / n),
        b = mix(z0, z1, (i + 1) / n);
      quad(
        out,
        'rubble',
        i % 3 === 1 ? 'rubbleLight' : 'rubble',
        [
          [x, level(x, a) - 0.37, a],
          [x, level(x, b) - 0.37, b],
          [x, eave, b],
          [x, eave, a],
        ],
        [s, 0, 0],
      );
    }
    if (d >= 1) {
      for (const z of [-69.2, -64.15, -59.03]) aisleBlindArch(out, x, z, s, d);
      for (const z of [-69.55, -63.95, -58.48]) {
        const o = x + s * 0.03;
        quad(
          out,
          'glass',
          'glass',
          [
            [o, 9.86, z - 0.38],
            [o, 9.86, z + 0.38],
            [o, 11.29, z + 0.38],
            [o, 11.29, z - 0.38],
          ],
          [s, 0, 0],
        );
      }
    }
    const patchCount = d === 4 ? 63 : 36;
    if (d >= 3)
      for (let i = 0; i < patchCount; i++) {
        const z = mix(z0 + 0.5, z1 - 0.48, (i + 0.5) / patchCount),
          y = 2.54 + (9.2 * ((i * 29) % 43)) / 43,
          w = 0.19 + (0.33 * ((i * 19) % 17)) / 17;
        const o = x + s * 0.012;
        quad(
          out,
          'rubble',
          i % 4 === 2 ? 'rubbleDark' : i % 3 === 0 ? 'moss' : 'brownStone',
          [
            [o, y, z - w],
            [o, y - 0.04, z + w * 0.74],
            [o, y + 0.15, z + w],
            [o, y + 0.21, z - w * 0.83],
          ],
          [s, 0, 0],
        );
      }
  }
  churchButtress(out, [-8.17, -58.39], [-3.68, -54.57], 8.25, -5.03, -56.02, 1.44, d);
  churchButtress(out, [5.46, -58.41], [8.19, -52.07], 8.48, 6.24, -55.46, 1.28, d);
  if (d >= 1) {
    churchButtress(out, [-6.74, -74.93], [-4.35, -70.68], 6.97, -4.9, -71.58, 0.92, d);
    churchButtress(out, [5.66, -74.91], [7.03, -70.51], 6.52, 6.03, -71.98, 0.89, d);
    churchButtress(out, [7.03, -57.01], [10.19, -55.57], 6.38, 7.48, -56.3, 0.91, d);
  }
  churchRoof(out, d);
}
export function buildLevel(out, level) {
  const d = tiers[level];
  torhalle(out, d);
  abbeyChurch(out, d);
}
export const buildSkyline = (out) => buildLevel(out, 'skyline');
export const buildDistrict = (out) => buildLevel(out, 'district');
export const buildStreet = (out) => buildLevel(out, 'street');
export const buildCloseup = (out) => buildLevel(out, 'closeup');
export const buildMaster = (out) => buildLevel(out, 'master');
