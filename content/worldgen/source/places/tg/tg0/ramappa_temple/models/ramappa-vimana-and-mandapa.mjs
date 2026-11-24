import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../ramappa-plan.json' with { type: 'json' };

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.89 },
  dark: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.82 },
  tower: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.96 },
};
const red = rgb('a78970'),
  pale = rgb('ba9f83'),
  muted = rgb('947a65'),
  dark = rgb('564d44'),
  bronze = rgb('635951');
const weathered = rgb('a99887'),
  brick = rgb('af9b86'),
  roof = rgb('bcb1a0');
const [X, Z] = site.center,
  [a, b] = site.axis,
  F = facade([X, Z], [a, b]);
const p = (u, v) => [X + u * a - v * b, Z + u * b + v * a];
const rect = (u, U, v, V) => [p(u, v), p(u, V), p(U, V), p(U, v)];
const box = (out, slot, u, U, v, V, y, Y, c) => fbox(out, slot, F, u, U, y, Y, v, V, c);
const transformed = ([x, z], u, v, scale) => [u + (x - u) * scale, v + (z - v) * scale];
const shaped = (r, center, k) => r.map((t) => p(...transformed(t, ...center, k)));
const faces = (r) => {
  const q = outwardRing(r);
  return q.map((a, i) => wallFace(a, q[(i + 1) % q.length]));
};
function capMesh(out) {
  return {
    ...out,
    addCap(s, ref, r, holes, height, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('wall', ref, r, holes, height, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, s, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}
function dais(out, rs, ground, level) {
  const y = ground + 0.18;
  const bands = level
    ? [
        [1, ground - 1.28, y + 0.1, 'foundation', muted],
        [0.993, y + 0.09, y + 0.3, 'trim', weathered],
        [0.963, y + 0.29, y + 0.66, 'foundation', red],
        [0.975, y + 0.65, y + 0.83, 'trim', muted],
        [0.941, y + 0.82, y + 1.28, 'foundation', red],
        [0.957, y + 1.27, y + 1.51, 'trim', weathered],
      ]
    : [
        [1, ground - 1.28, y + 0.4, 'foundation', muted],
        [0.951, y + 0.39, y + 1.51, 'trim', red],
      ];
  for (const [scale, a, b, s, color] of bands)
    extrude(out, s, shaped(rs, [0, 0], scale), a, b, color);
}
function pillar(out, u, v, y, Y, width, level) {
  const cap = 0.6 * width,
    c = p(u, v);
  if (!level) {
    const w = width * 0.38;
    box(out, 'trim', u - w, u + w, v - w, v + w, y, Y - 0.24, muted);
    box(out, 'trim', u - cap, u + cap, v - cap, v + cap, Y - 0.25, Y, pale);
    return;
  }
  box(out, 'trim', u - cap, u + cap, v - cap, v + cap, y, y + 0.3, pale);
  box(
    out,
    'dark',
    u - width * 0.42,
    u + width * 0.42,
    v - width * 0.42,
    v + width * 0.42,
    y + 0.29,
    y + 0.73,
    dark,
  );
  if (level < 2) {
    box(
      out,
      'trim',
      u - width * 0.34,
      u + width * 0.34,
      v - width * 0.34,
      v + width * 0.34,
      y + 0.71,
      Y - 0.33,
      muted,
    );
  } else {
    lathe(
      out,
      'dark',
      c,
      [
        [y + 0.7, width * 0.41, width * 0.41],
        [y + 1.0, width * 0.31, width * 0.31],
        [Y - 0.79, width * 0.3, width * 0.3],
        [Y - 0.56, width * 0.41, width * 0.41],
        [Y - 0.31, width * 0.48, width * 0.48],
      ],
      level === 3 ? 12 : 8,
      bronze,
    );
  }
  box(out, 'trim', u - cap, u + cap, v - cap, v + cap, Y - 0.34, Y, pale);
}
function corbelFigure(out, u, v, dx, dz, y, level) {
  const A = F.P(u, y - 0.55, v),
    B = F.P(u + dx * 0.38, y - 0.14, v + dz * 0.38),
    C = F.P(u + dx * 0.62, y + 0.32, v + dz * 0.62);
  beam(out, 'dark', A, B, 0.24, 0.27, dark);
  beam(out, 'dark', B, C, 0.34, 0.26, dark);
  const c = p(u + dx * 0.62, v + dz * 0.62);
  lathe(
    out,
    'dark',
    c,
    [
      [y + 0.25, 0.1, 0.1],
      [y + 0.4, 0.16, 0.14],
      [y + 0.56, 0.112, 0.11],
      [y + 0.62, 0, 0],
    ],
    level === 3 ? 9 : 6,
    dark,
  );
  beam(out, 'dark', C, F.P(u + dx * 0.93, y + 0.62, v + dz * 0.93), 0.13, 0.14, bronze);
}
function threshold(out, u, v, side, y, w, level) {
  const n = level >= 2 ? 6 : 4,
    step = side === 'east' ? 0.32 : 0.29;
  for (let i = 0; i < n; i++) {
    const length = (n - i) * step,
      height = y + ((i + 1) * 1.48) / n;
    if (side === 'east') {
      box(
        out,
        'trim',
        u + length - step,
        u + length,
        v - w / 2,
        v + w / 2,
        y - 0.29,
        height,
        weathered,
      );
    } else {
      const A = v + length - step,
        B = v + length;
      box(
        out,
        'trim',
        u - w / 2,
        u + w / 2,
        side === 'south' ? A : 2 * v - B,
        side === 'south' ? B : 2 * v - A,
        y - 0.29,
        height,
        weathered,
      );
    }
  }
}
function hall(out, level) {
  const ring = site.mainLocal,
    y = site.grade,
    floor = y + 1.68;
  dais(out, ring, y, level);
  const pillars = [
    [-5.8, -8.22],
    [-2.02, -8.22],
    [1.74, -8.22],
    [5.38, -8.22],
    [-5.8, 8.16],
    [-2.02, 8.16],
    [1.74, 8.16],
    [5.38, 8.16],
    [9.75, -3.74],
    [9.75, 0.24],
    [9.75, 3.79],
    [-2.02, -3.48],
    [-2.02, 3.44],
    [4.02, -3.48],
    [4.02, 3.44],
  ];
  const ceiling = y + 5.95;
  const selected = level ? pillars : pillars.filter((_, i) => i % 2 === 0 || i === 2);
  for (const [i, [u, v]] of selected.entries()) {
    pillar(out, u, v, floor, ceiling, 0.94, level);
    if (level > 1 && (Math.abs(v) > 7.9 || u > 9)) {
      const dx = u > 9 ? 1 : 0,
        dz = Math.abs(v) > 7.9 ? Math.sign(v) : 0;
      corbelFigure(out, u, v, dx, dz, ceiling - 0.72, level);
    }
  }
  box(out, 'sandstone', -12, -7.0, -4.68, 4.6, floor, ceiling, red);
  const phases = level
    ? [
        [0.836, ceiling - 0.08, ceiling + 0.39, 'sandstone', muted],
        [0.878, ceiling + 0.38, ceiling + 0.7, 'trim', pale],
        [0.902, ceiling + 0.69, ceiling + 0.97, 'foundation', red],
        [0.849, ceiling + 0.96, ceiling + 1.32, 'roof', roof],
      ]
    : [[0.89, ceiling - 0.05, ceiling + 1.31, 'roof', roof]];
  for (const [s, a, b, slot, shade] of phases)
    extrude(out, slot, shaped(ring, [0, 0], s), a, b, shade, {
      topSlot: slot === 'roof' ? 'roof' : slot,
      topColor: shade,
    });
  if (level) {
    for (const e of faces(shaped(ring, [0, 0], 0.855))) {
      const n = Math.floor(e.length / 2.8);
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) * e.length) / n;
        fbox(
          out,
          'trim',
          e,
          x - 0.18,
          x + 0.18,
          ceiling + 1.28,
          ceiling + 1.49,
          -0.16,
          0.085,
          weathered,
        );
      }
    }
  }
  threshold(out, site.extents[1] - 0.24, 0.22, 'east', y, 2.52, level);
  threshold(out, -0.1, site.extents[3] - 0.32, 'south', y, 2.37, level);
  threshold(out, -0.25, site.extents[2] + 0.34, 'north', y, 2.27, level);
}
function vimana(out, level) {
  const c = [-8.88, 0.16],
    y = site.grade + 7.18,
    depth = 5.26,
    width = 5.04;
  const radii = [1, 0.923, 0.811, 0.724, 0.618, 0.512, 0.398];
  const belt =
    level === 0
      ? [
          [0, 1, 2.31],
          [2, 0.811, 2.07],
          [4, 0.618, 2.29],
          [6, 0.398, 2.1],
        ]
      : radii.map((r, i) => [i, r, 1.17 + i * 0.08]);
  let Y = y;
  for (const [i, f, h] of belt) {
    const u = c[0],
      v = c[1],
      w = width * f,
      l = depth * f;
    const ring = rect(u - w, u + w, v - l, v + l);
    extrude(out, 'tower', ring, Y, Y + h, brick);
    extrude(
      out,
      'trim',
      rect(u - w - 0.11, u + w + 0.11, v - l - 0.1, v + l + 0.1),
      Y + h - 0.25,
      Y + h - 0.08,
      i % 2 ? weathered : pale,
    );
    if (level > 0) {
      const count = i < 4 ? 3 : 2;
      for (const side of faces(ring)) {
        for (let j = 0; j < count; j++) {
          const mid = ((j + 0.5) * side.length) / count,
            w = Math.min(0.57, side.length / (count * 3));
          fbox(out, 'sandstone', side, mid - w, mid + w, Y + 0.14, Y + h * 0.68, -0.04, 0.19, pale);
          if (level >= 2) {
            const q = (x, y, d) => side.P(x, y, d);
            tri(
              out,
              'trim',
              q(mid - w - 0.105, Y + h * 0.66, 0.22),
              q(mid + w + 0.105, Y + h * 0.66, 0.22),
              q(mid, Y + h * 0.9, 0.22),
              weathered,
            );
            opening(out, side, mid, Y + 0.24, w * 0.92, h * 0.34, {
              head: 'pointed',
              glassSlot: 'dark',
              frameSlot: 'trim',
              glass: dark,
              frame: pale,
              frameWidth: level === 3 ? 0.065 : 0,
              frameDepth: 0.223,
              d: 0.198,
              sill: false,
              rise: h * 0.13,
            });
          }
        }
      }
    }
    Y += h;
  }
  const q = p(...c),
    n = level > 1 ? 12 : 8;
  lathe(
    out,
    'trim',
    q,
    [
      [Y - 0.1, 2.03, 2.16],
      [Y + 0.27, 2.04, 2.17],
      [Y + 1.1, 1.5, 1.56],
      [Y + 1.66, 0.86, 0.86],
      [Y + 1.86, 0.29, 0.29],
      [Y + 2.12, 0.07, 0.07],
      [Y + 2.25, 0, 0],
    ],
    n,
    pale,
  );
}
function courtyard(out, level) {
  for (const [p, q] of site.wallSpans) {
    const f = wallFace(p, q);
    fbox(out, 'foundation', f, 0, f.length, -1.81, 1.24, -0.78, 0, muted);
    if (level) fbox(out, 'trim', f, 0, f.length, 1.24, 1.4, -0.83, 0.045, weathered);
  }
  for (const part of site.annexes) {
    extrude(out, 'foundation', part.ring, part.foot, part.grade + 0.56, muted);
    extrude(out, 'trim', part.ring, part.grade + 0.56, part.grade + 0.83, pale);
    const [x, z] = part.center;
    if (part.id === site.nandi) {
      const g = part.grade;
      const n = level > 1 ? 12 : 7;
      const f = facade(part.center, [a, b]);
      const walk = outwardRing(part.ring);
      for (let i = 0; i < walk.length; i++) {
        const face = wallFace(walk[i], walk[(i + 1) % walk.length]);
        fbox(
          out,
          'sandstone',
          face,
          0.07,
          face.length - 0.07,
          g + 0.81,
          g + 1.75,
          -0.53,
          0.01,
          red,
        );
        if (level)
          fbox(out, 'trim', face, 0.12, face.length - 0.12, g + 1.74, g + 1.95, -0.56, 0.045, pale);
      }
      lathe(
        out,
        'dark',
        [x, z],
        [
          [g + 0.83, 1.28, 0.82],
          [g + 1.12, 1.31, 0.83],
          [g + 1.72, 1.04, 0.61],
          [g + 2.13, 0.48, 0.31],
          [g + 2.34, 0.075, 0.075],
        ],
        n,
        dark,
      );
      const h = f.P(-1.01, g + 1.35, 0.0);
      lathe(
        out,
        'dark',
        [h[0], h[2]],
        [
          [g + 1.17, 0.36, 0.42],
          [g + 1.61, 0.5, 0.49],
          [g + 1.91, 0.41, 0.36],
          [g + 2.13, 0.043, 0.043],
        ],
        n,
        bronze,
      );
    } else if (level) {
      for (const face of faces(part.ring)) {
        if (face.length < 1.7) continue;
        fbox(
          out,
          'sandstone',
          face,
          0.12,
          face.length - 0.12,
          part.grade + 0.8,
          part.grade + 1.72,
          -0.44,
          0.019,
          red,
        );
      }
    } else {
      extrude(out, 'sandstone', part.ring, part.grade + 0.81, part.grade + 1.7, red, {
        top: false,
      });
    }
  }
}
function build(target, level) {
  const out = capMesh(target);
  hall(out, level);
  vimana(out, level);
  courtyard(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
