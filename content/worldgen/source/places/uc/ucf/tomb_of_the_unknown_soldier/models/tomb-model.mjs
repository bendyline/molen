/** The Alexander Garden memorial in its local map frame. */
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
export const tombSurfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.64 },
  polished: { slot: 'trim', graph: 'stone_granite', roughness: 0.29 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.43, metallic: 0.75 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.55 },
  flame: { slot: 'trim', localRef: 'palette:#ffffff', name: 'Eternal flame', roughness: 1 },
};

const hexes = {
  sand: 'aa9589',
  sandPale: 'b09a90',
  sandDark: 'a28e84',
  joint: '8c7d78',
  grey: 'a9a3a0',
  greyPale: 'b8b3ad',
  greyDark: '8c8885',
  riser: '6d6260',
  porphyry: '704943',
  porphyryTop: '8b6055',
  lip: '9b766b',
  darkBase: '343331',
  black: '252427',
  blackLit: '333136',
  burner: '302d28',
  brass: 'a98553',
  brassLit: 'd3b484',
  brassDark: '6b533c',
  brown: '49362c',
  cast: '565b50',
  castLit: '747567',
  castDark: '444841',
  rim: '77796b',
  amber: 'e47321',
  flameLight: 'ffcf4c',
  flameWhite: 'ffe9a1',
};
const color = Object.fromEntries(
  Object.entries(hexes).map(([key, hex]) => [
    key,
    hex.match(/../g).map((c) => {
      const s = Number.parseInt(c, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tierByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  front = [0, 0, -1],
  tau = Math.PI * 2;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function face(out, slot, tint, points, toward) {
  let normal = normalFor(...points);
  if (toward && normal.reduce((sum, n, i) => sum + n * toward[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, normal, undefined, color[tint]);
  else if (points.length === 4) out.addQuad(slot, ref, points, normal, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, points, normal, undefined, color[tint]);
}

function surface(out, slot, tint, x0, x1, z0, z1, y0, y1 = y0) {
  face(
    out,
    slot,
    tint,
    [
      [x0, y0, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y0, z0],
    ],
    up,
  );
}

function rect(out, slot, tint, x, z, rows, chamfer = 0.04) {
  loft(
    out,
    slot,
    rows.map(([y, w, d]) => chamferedRectangle(x, y, z, w, d, chamfer)),
    color[tint],
  );
}

function skirt(out, a, b, bottomA, bottomB, normal) {
  face(out, 'granite', 'riser', [a, b, [b[0], bottomB, b[2]], [a[0], bottomA, a[2]]], normal);
}

function paving(out, tier) {
  const { top, half, frontZ, rearZ, sidePanels, steps, dark, sideAccess } = layout.paving;
  const { x0: toe, x1: inner, z0: south, z1: north, y0: toeY, foot } = sideAccess;
  for (const [a, b, c, d] of [
    [-half, inner, frontZ, south],
    [-half, inner, north, rearZ],
    [inner, dark.x0, frontZ, rearZ],
    [dark.x1, half, frontZ, rearZ],
    [dark.x0, dark.x1, frontZ, dark.z0],
    [dark.x0, dark.x1, dark.z1, rearZ],
  ]) {
    if (tier < 2) surface(out, 'granite', 'sand', a, b, c, d, top);
    else {
      const nx = Math.ceil((b - a) / 1.34),
        nz = Math.ceil((d - c) / 1.17);
      surface(out, 'granite', 'joint', a, b, c, d, top - 0.005);
      for (let ix = 0; ix < nx; ix++)
        for (let iz = 0; iz < nz; iz++) {
          const x = a + ((b - a) * ix) / nx,
            z = c + ((d - c) * iz) / nz;
          const tint = ['sand', 'sandPale', 'sand', 'sandDark'][(ix * 3 + iz * 7) % 4];
          surface(
            out,
            'granite',
            tint,
            x + 0.006,
            x + (b - a) / nx - 0.006,
            z + 0.006,
            z + (d - c) / nz - 0.006,
            top,
          );
        }
    }
  }
  const { x0, x1, z0, z1 } = dark;
  surface(out, 'polished', 'black', x0, x1, z0, z1, top + 0.006);
  for (const [a, b] of [
    [x0, x0 + 0.1],
    [x1 - 0.1, x1],
  ])
    surface(out, 'polished', 'blackLit', a, b, z0, z1, top + 0.015);
  for (const [a, b] of [
    [z0, z0 + 0.1],
    [z1 - 0.1, z1],
  ])
    surface(out, 'polished', 'blackLit', x0 + 0.1, x1 - 0.1, a, b, top + 0.015);

  const mid = (toe + inner) * 0.5,
    treadY = (toeY + top) * 0.5;
  surface(out, 'granite', 'grey', toe, mid, south, north, toeY);
  surface(out, 'granite', 'greyPale', mid, inner, south, north, treadY);
  skirt(out, [toe, toeY, north], [toe, toeY, south], foot, foot, [-1, 0, 0]);
  skirt(out, [mid, treadY, north], [mid, treadY, south], toeY, toeY, [-1, 0, 0]);
  skirt(out, [inner, top, north], [inner, top, south], treadY, treadY, [-1, 0, 0]);
  for (const [z, sign] of [
    [south, 1],
    [north, -1],
  ]) {
    skirt(out, [-half, top, z], [mid, top, z], toeY, toeY, [0, 0, sign]);
    skirt(out, [mid, top, z], [inner, top, z], treadY, treadY, [0, 0, sign]);
  }

  for (const [i, s] of steps.entries()) {
    const { z0, z1, y0, y1, bottom, half: width } = s;
    const tint = i % 2 ? 'grey' : 'greyPale',
      xs = [-width, 0, width];
    for (let j = 0; j < 2; j++) {
      const a = [xs[j], y0[j], z0],
        b = [xs[j + 1], y0[j + 1], z0],
        c = [xs[j + 1], y1[j + 1], z1],
        d = [xs[j], y1[j], z1];
      face(out, 'granite', tint, [a, b, d], up);
      face(out, 'granite', tint, [b, c, d], up);
      skirt(out, a, b, bottom, bottom, front);
    }
    skirt(out, [-width, y1[0], z1], [-width, y0[0], z0], bottom, bottom, [-1, 0, 0]);
    skirt(out, [width, y0[2], z0], [width, y1[2], z1], bottom, bottom, [1, 0, 0]);
    if (tier >= 2 && i > 1)
      surface(out, 'granite', 'greyDark', -width, width, z0 + 0.04, z0 + 0.115, y0[1] + 0.003);
  }
  for (const panel of sidePanels) {
    const { a, b, foot } = panel;
    skirt(out, [a[0], top, a[1]], [b[0], top, b[1]], foot[0], foot[1], panel.normal);
  }
}

function sarcophagus(out, tier) {
  const { x, z, width, depth, base, top } = layout.assembly.stoneBox;
  rect(
    out,
    'polished',
    'darkBase',
    x,
    z,
    [
      [base - 0.11, width - 0.11, depth - 0.13],
      [base + 0.16, width - 0.11, depth - 0.13],
    ],
    0.08,
  );
  rect(
    out,
    'polished',
    'porphyry',
    x,
    z,
    [
      [base + 0.16, width, depth],
      [top - 0.055, width, depth],
      [top, width - 0.09, depth - 0.09],
    ],
    0.07,
  );
  if (tier >= 2) {
    surface(
      out,
      'polished',
      'porphyryTop',
      x - width / 2 + 0.1,
      x + width / 2 - 0.1,
      z - depth / 2 + 0.1,
      z + depth / 2 - 0.1,
      top + 0.004,
    );
    for (const sign of [-1, 1]) {
      const edge = z + sign * (depth / 2 - 0.024);
      face(
        out,
        'polished',
        'lip',
        [
          [x - width / 2 + 0.08, top - 0.085, edge],
          [x + width / 2 - 0.08, top - 0.085, edge],
          [x + width / 2 - 0.08, top - 0.039, edge - sign * 0.015],
          [x - width / 2 + 0.08, top - 0.039, edge - sign * 0.015],
        ],
        [0, 0, sign],
      );
    }
  }
}

function flagPoint(u, t, detail) {
  const center = layout.assembly.flag,
    scale = Math.sin(Math.PI * u);
  const turn = Math.max(0, (t - 0.55) / 0.45);
  const folds = Math.sin(25 * t + 2.2 * scale + 0.43 * Math.sin(9 * u)),
    crossFold = Math.sin(19 * u - 5 * t);
  const rippleY = (detail >= 2 ? 0.022 : 0.014) * (folds + crossFold * 0.44) * scale;
  const rippleZ = (detail >= 2 ? 0.049 : 0.024) * folds * scale * Math.sin(turn * Math.PI * 0.88);
  const seat = Math.max(
    layout.assembly.stoneBox.top + 0.041,
    center.y + (0.025 + 0.023 * Math.sin(u * 16)) * Math.sin(Math.PI * t) + rippleY,
  );
  return [
    center.x + (u - 0.5) * (3.75 + 0.32 * t) + 0.16 * t * t,
    seat - turn * (0.075 + 0.76 * scale),
    center.z + 1.67 * (1 - Math.min(1, t / 0.55)) - turn * (0.12 + 0.09 * scale) + rippleZ,
  ];
}

function banner(out, tier) {
  const across = [6, 12, 26, 44, 56][tier],
    along = [4, 7, 15, 26, 31][tier];
  const rows = Array.from({ length: along + 1 }, (_, j) =>
    Array.from({ length: across + 1 }, (_, i) => flagPoint(i / across, j / along, tier)),
  );
  for (let j = 0; j < along; j++)
    for (let i = 0; i < across; i++) {
      const a = rows[j][i],
        b = rows[j][i + 1],
        c = rows[j + 1][i + 1],
        d = rows[j + 1][i];
      const n = j / along > 0.52 ? front : up;
      face(out, 'bronze', 'cast', [a, b, d], n);
      face(out, 'bronze', 'cast', [b, c, d], n);
      if (tier >= 3) {
        const back = [a, b, d].map((p) => [p[0], p[1] - 0.022, p[2] + 0.014]);
        face(
          out,
          'bronze',
          'castDark',
          back,
          n.map((v) => -v),
        );
        face(
          out,
          'bronze',
          'castDark',
          [b, c, d].map((p) => [p[0], p[1] - 0.022, p[2] + 0.014]),
          n.map((v) => -v),
        );
      }
    }
  if (tier >= 1) beamPath(out, 'bronze', rows.at(-1), 0.045, 0.034, color.rim);
  if (tier >= 2)
    for (let i = 0; i < across; i++) {
      const point = flagPoint((i + 0.5) / across, 1, tier),
        end = [point[0] + 0.014, point[1] - 0.048, point[2] - 0.008];
      beam(out, 'bronze', point, end, 0.016, 0.017, color.castLit);
    }
}

function helmet(out, tier) {
  const { x, y, z } = layout.assembly.helmet;
  const n = [8, 12, 20, 32, 36][tier],
    rings = [0, 0.2, 0.43, 0.64, 0.83, 1.03, 1.25, 1.43];
  const levels = rings.filter((_, i) => tier >= 2 || i % 2 === 0 || i === rings.length - 1);
  const pts = levels.map((t) =>
    Array.from({ length: n }, (_, i) => {
      const a = (tau * i) / n,
        tilt = 0.021 * Math.cos(a),
        flare = 1 + 0.12 * Math.max(0, -Math.sin(a)) * (1 - t / 1.57);
      return [
        x + Math.cos(a) * 0.34 * Math.cos(t) * flare,
        y + 0.33 * Math.sin(t) + tilt,
        z + Math.sin(a) * 0.39 * Math.cos(t) * flare,
      ];
    }),
  );
  for (let j = 1; j < pts.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = pts[j - 1][i],
        b = pts[j - 1][k],
        c = pts[j][k],
        d = pts[j][i];
      const normal = [(a[0] + b[0]) / 2 - x, 0.06, (a[2] + b[2]) / 2 - z];
      face(out, 'bronze', 'cast', [a, b, d], normal);
      face(out, 'bronze', 'cast', [b, c, d], normal);
    }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    face(out, 'bronze', 'castLit', [pts.at(-1)[i], pts.at(-1)[k], [x, y + 0.356, z]], up);
  }
  if (tier >= 1) {
    beamPath(out, 'bronze', pts[0], 0.029, 0.025, color.rim, true);
    if (tier >= 2)
      for (const dx of [-0.255, 0.255])
        loft(
          out,
          'bronze',
          [
            radialRing(y + 0.057, 0.023, 0.023, 8, [x + dx, z - 0.1]),
            radialRing(y + 0.076, 0.023, 0.023, 8, [x + dx, z - 0.1]),
          ],
          color.castLit,
        );
  }
}

function laurel(out, tier) {
  const { x, y, z } = layout.assembly.helmet;
  const points = Array.from({ length: [5, 9, 16, 26, 34][tier] }, (_, i) => i);
  const line = points.map((i) => {
    const t = i / (points.length - 1);
    return [
      x + 0.22 + 1.19 * t,
      y + 0.006 + 0.025 * Math.sin(Math.PI * t),
      z - 0.22 + 0.58 * t + 0.14 * Math.sin(Math.PI * t),
    ];
  });
  beamPath(out, 'bronze', line, 0.035, 0.026, color.castDark);
  if (tier === 0) return;
  for (let i = 1; i < line.length - 1; i++)
    for (const s of [-1, 1]) {
      const a = line[i],
        span = (0.24 - (0.1 * i) / line.length) * s;
      const tip = [a[0] + 0.105, a[1] + 0.037, a[2] + span],
        mid = mix(a, tip, 0.48);
      const left = [mid[0] - 0.049, mid[1] + 0.004, mid[2] + 0.018],
        right = [mid[0] + 0.046, mid[1], mid[2] - 0.019];
      face(out, 'bronze', 'castLit', [a, left, tip], up);
      face(out, 'bronze', 'cast', [a, tip, right], up);
      if (tier >= 3) beam(out, 'bronze', [a[0], a[1] + 0.006, a[2]], tip, 0.006, 0.007, color.rim);
    }
}

function flame(out, x, y, z, tier) {
  const plumes =
    tier === 0
      ? [[0, 0, 0.57, 0.105]]
      : [
          [0, 0, 0.61, 0.11],
          [-0.083, 0.028, 0.38, 0.065],
          [0.072, 0.018, 0.46, 0.072],
        ];
  for (const [offset, dz, height, radius] of plumes) {
    const stages = tier < 2 ? 4 : 9,
      n = tier < 2 ? 5 : 9;
    const rings = Array.from({ length: stages }, (_, j) => {
      const t = j / stages,
        r = radius * (0.52 + 0.48 * Math.sin(t * 3.3)) * (1 - t * 0.81);
      return radialRing(
        y + t * height,
        r,
        r * 0.74,
        n,
        [x + offset + 0.085 * t * Math.sin(t * 5 + offset), z + dz - 0.108 * t * t],
        t * 1.8,
      );
    });
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          tint = j > stages * 0.6 ? 'amber' : (i + j) % 3 === 0 ? 'flameWhite' : 'flameLight';
        const a = rings[j - 1][i],
          b = rings[j - 1][k],
          c = rings[j][k],
          d = rings[j][i];
        const normal = [(a[0] + b[0]) / 2 - (x + offset), 0, (a[2] + b[2]) / 2 - (z + dz)];
        face(out, 'flame', tint, [a, b, d], normal);
        face(out, 'flame', tint, [b, c, d], normal);
      }
    for (let i = 0; i < n; i++) {
      const ring = rings.at(-1),
        p = ring[i],
        q = ring[(i + 1) % n];
      face(
        out,
        'flame',
        'amber',
        [p, q, [x + offset + 0.085 * Math.sin(5 + offset), y + height, z + dz - 0.108]],
        [p[0] - x - offset, 0.25, p[2] - z - dz],
      );
    }
  }
}

function star(out, tier) {
  const { x, z, radius } = layout.assembly.star,
    y = layout.paving.top + 0.044;
  const point = (i, r, h) => [
    x + Math.sin((i * Math.PI) / 5) * r,
    y + h,
    z - Math.cos((i * Math.PI) / 5) * r,
  ];
  const outer = Array.from({ length: 10 }, (_, i) =>
    point(i, i % 2 ? radius * 0.44 : radius, 0.009),
  );
  const center = Array.from({ length: 10 }, (_, i) => point(i, 0.158, 0.124));
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10,
      a = outer[i],
      b = outer[j],
      c = center[j],
      d = center[i];
    const tint = i % 2 ? 'brass' : 'brassDark';
    face(out, 'bronze', tint, [a, b, d], up);
    face(out, 'bronze', tint, [b, c, d], up);
    face(
      out,
      'steel',
      'burner',
      [a, b, [b[0], y - 0.036, b[2]], [a[0], y - 0.036, a[2]]],
      [a[0] + b[0] - 2 * x, 0, a[2] + b[2] - 2 * z],
    );
    if (tier >= 2)
      beam(
        out,
        'bronze',
        [a[0], a[1] + 0.016, a[2]],
        [d[0], d[1] + 0.014, d[2]],
        0.027,
        0.021,
        color.brassLit,
      );
  }
  face(
    out,
    'steel',
    'burner',
    center.map((p) => [p[0], y + 0.027, p[2]]),
    up,
  );
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10,
      a = center[i],
      b = center[j];
    face(
      out,
      'steel',
      'burner',
      [a, b, [b[0], y + 0.027, b[2]], [a[0], y + 0.027, a[2]]],
      [2 * x - a[0] - b[0], 0, 2 * z - a[2] - b[2]],
    );
  }
  flame(out, x, y + 0.032, z, tier);
}

function hood(out, [x, z], tier) {
  const y = layout.paving.top,
    n = [5, 8, 14, 20, 22][tier];
  const shape = Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [x + Math.cos(a) * 0.64, y + 1.71 + Math.sin(a) * 0.61, z];
  });
  const posts = [[x + 0.64, y + 0.08, z], ...shape, [x - 0.64, y + 0.08, z]];
  for (const depth of [0, 0.66])
    beamPath(
      out,
      'bronze',
      posts.map(([a, b, c]) => [a, b, c + depth]),
      0.073,
      0.063,
      color.brass,
    );
  for (let i = 0; i < n; i++) {
    const a = shape[i],
      b = shape[i + 1];
    face(
      out,
      'steel',
      'brown',
      [a, b, [b[0], b[1], z + 0.66], [a[0], a[1], z + 0.66]],
      [a[0] + b[0] - 2 * x, 0.5, 0],
    );
    const inner = [a, b, [b[0], b[1], z + 0.66], [a[0], a[1], z + 0.66]].map(([px, py, pz]) => [
      x + (px - x) * 0.97,
      py - 0.017,
      pz,
    ]);
    face(out, 'steel', 'brown', inner, [2 * x - a[0] - b[0], -0.5, 0]);
  }
  for (const side of [-1, 1]) {
    const a = x + side * 0.64;
    face(
      out,
      'steel',
      'brown',
      [
        [a, y + 0.12, z + 0.23],
        [a, y + 1.71, z + 0.23],
        [a, y + 1.71, z + 0.66],
        [a, y + 0.12, z + 0.66],
      ],
      [side, 0, 0],
    );
    if (tier >= 1)
      beam(out, 'bronze', [a, y + 0.07, z], [a, y + 0.07, z + 0.66], 0.09, 0.065, color.brassDark);
  }
  for (const [depth, sign] of [
    [0.66, 1],
    [0.642, -1],
  ]) {
    face(
      out,
      'steel',
      'brown',
      [
        [x - 0.64, y + 0.12, z + depth],
        [x + 0.64, y + 0.12, z + depth],
        [x + 0.64, y + 1.71, z + depth],
        [x - 0.64, y + 1.71, z + depth],
      ],
      [0, 0, sign],
    );
    face(
      out,
      'steel',
      'brown',
      shape.map(([a, b]) => [a, b, z + depth]),
      [0, 0, sign],
    );
  }
  if (tier >= 2)
    beamPath(
      out,
      'bronze',
      shape.map(([a, b]) => [a, b + 0.016, z - 0.041]),
      0.025,
      0.019,
      color.brassLit,
    );
}

// Bronze inlay strokes run along the pavement at the same scale as the photographed letters.
const glyphs = {
  И: ['00 02', '00 22', '20 22'],
  М: ['00 02 11 22 20'],
  Я: ['20 22 02 01 21', '00 21'],
  Т: ['02 22', '12 10'],
  В: ['00 02 12 21 11 00', '01 11 21 20 10 00'],
  О: ['00 02 12 22 20 10 00'],
  Ё: ['20 00 02 22', '01 11', '13 13', '03 03'],
  Н: ['00 02', '01 21', '20 22'],
  Е: ['20 00 02 22', '01 11'],
  З: ['02 12 21 11 20 10 00'],
  С: ['22 02 00 20'],
  П: ['00 02 22 20'],
  Д: ['00 02 12 20', '00 20'],
  Г: ['00 02 22'],
  Б: ['22 02 00 20 21 01'],
  Р: ['00 02 22 21 01'],
};

function inscription(out, tier) {
  if (tier < 2) return;
  const rows = ['ИМЯ ТВОЁ НЕИЗВЕСТНО', 'ПОДВИГ ТВОЙ БЕССМЕРТЕН'];
  const y = layout.paving.top + 0.013,
    spacing = 0.235;
  for (const [j, row] of rows.entries())
    for (const [i, char] of [...row].entries()) {
      const x = (row.length / 2 - i) * spacing,
        z = -3.7 - j * 0.35;
      const point = (code) => [x - Number(code[0]) * 0.069, y, z + Number(code[1]) * 0.099];
      const strokes = char === 'Й' ? [...glyphs.И, '03 13'] : (glyphs[char] ?? []);
      for (const stroke of strokes) {
        const p = stroke.split(' ').map(point);
        for (let k = 1; k < p.length; k++) {
          const a = p[k - 1],
            b = p[k],
            dx = b[0] - a[0],
            dz = b[2] - a[2],
            len = Math.hypot(dx, dz);
          if (len < 0.0001) {
            surface(
              out,
              'bronze',
              'brassLit',
              a[0] - 0.01,
              a[0] + 0.01,
              a[2] - 0.01,
              a[2] + 0.01,
              y,
            );
            continue;
          }
          const u = (dz / len) * 0.01,
            v = (-dx / len) * 0.01;
          face(
            out,
            'bronze',
            'brassLit',
            [
              [a[0] + u, y, a[2] + v],
              [a[0] - u, y, a[2] - v],
              [b[0] - u, y, b[2] - v],
              [b[0] + u, y, b[2] + v],
            ],
            up,
          );
        }
      }
    }
}

export function buildTombLevel(out, level) {
  const tier = tierByLevel[level];
  if (tier === undefined) throw new Error(`Unknown memorial detail level ${level}`);
  paving(out, tier);
  sarcophagus(out, tier);
  banner(out, tier);
  helmet(out, tier);
  laurel(out, tier);
  star(out, tier);
  for (const site of layout.assembly.guardHoods) hood(out, site, tier);
  inscription(out, tier);
}

export const buildTombSkyline = (out) => buildTombLevel(out, 'skyline');
export const buildTombDistrict = (out) => buildTombLevel(out, 'district');
export const buildTombStreet = (out) => buildTombLevel(out, 'street');
export const buildTombCloseup = (out) => buildTombLevel(out, 'closeup');
