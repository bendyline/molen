import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import plan from '../abbey-plan.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  rubble: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97 },
  dress: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92 },
  vault: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
};
const stone = rgb('9d9584'),
  pale = rgb('b0a58e'),
  cut = rgb('b6a890'),
  aged = rgb('8e8777');
const mortar = rgb('a09a8c'),
  inner = rgb('968e7d'),
  paved = rgb('827c6f');
const F = facade([0, 0], plan.axis);
const heading = Math.atan2(plan.axis[1], plan.axis[0]);
const at = (u, v, y) => F.P(u, y, v);
const xz = (u, v) => {
  const [x, , z] = at(u, v, 0);
  return [x, z];
};
const panel = (a, b) => wallFace(xz(...a), xz(...b));
const box = (out, slot, u, U, v, V, y, Y, c) =>
  fbox(out, slot, F, u, U, y, Y, v, V, c, { bottom: true });
const LOD_STEPS = [2, 3, 4, 9];
const lerp = (a, b, t) => a + (b - a) * t;
const opposite = ([a, b]) => [-a, -b];

function archProfile(radius, rise, steps, head) {
  if (head === 'pointed') {
    const half = Math.max(2, Math.ceil(steps * 0.5));
    return Array.from({ length: half * 2 + 1 }, (_, i) => {
      const t = i / half - 1;
      return [radius * t, rise * Math.sqrt(1 - Math.abs(t))];
    });
  }
  return roundArch(radius, steps).map(([u, h]) => [u, (h * rise) / radius]);
}

/** A wall panel around a genuine opening. Sill, soffit and the two faces have separate surfaces. */
function opening(
  out,
  f,
  level,
  {
    start = 0,
    end = f.length,
    bottom,
    top,
    sill = bottom,
    spring,
    rise,
    radius,
    depth,
    color = stone,
    head = 'round',
    trim = false,
    center = (start + end) * 0.5,
    slot = 'ashlar',
  },
) {
  const p = f.P,
    left = center - radius,
    right = center + radius;
  const solid = (l, r, y, Y) => {
    if (r - l > 0.005 && Y - y > 0.005) fbox(out, slot, f, l, r, y, Y, -depth, 0, color);
  };
  solid(start, left, bottom, top);
  solid(right, end, bottom, top);
  solid(left, right, bottom, sill);
  const profile = archProfile(radius, rise, LOD_STEPS[level], head);
  for (let i = 0; i < profile.length - 1; i++) {
    const [a, h] = profile[i],
      [b, H] = profile[i + 1],
      u = center + a,
      U = center + b,
      y = spring + h,
      Y = spring + H;
    quad4(out, slot, p(u, y), p(U, Y), p(U, top), p(u, top), color);
    quad4(out, slot, p(U, Y, -depth), p(u, y, -depth), p(u, top, -depth), p(U, top, -depth), color);
    quad4(out, 'vault', p(u, y, -depth), p(U, Y, -depth), p(U, Y), p(u, y), inner);

    if (trim && level) {
      const s = 1 + Math.min(0.46, 0.245 / radius),
        d = 0.043;
      quad4(
        out,
        'dress',
        p(u, y, d),
        p(U, Y, d),
        p(center + b * s, spring + H * s, d),
        p(center + a * s, spring + h * s, d),
        cut,
      );
    }
  }
  quad4(
    out,
    'rubble',
    p(left, top),
    p(right, top),
    p(right, top, -depth),
    p(left, top, -depth),
    aged,
  );
  if (level > 2 && trim && sill + 0.02 < spring) {
    for (const [u, U] of [
      [left - 0.16, left],
      [right, right + 0.16],
    ])
      fbox(out, 'dress', f, u, U, sill, spring, -0.04, 0.047, cut);
  }
}
function arcade(out, f, level, bays, config) {
  const width = f.length / bays;
  const foot = config.bottom,
    top = config.top;
  for (let i = 0; i < bays; i++) {
    const start = i * width,
      end = start + width;
    const radius = Math.min(config.radius ?? width * 0.33, width * 0.43);
    const vary = config.rough ? Math.sin(i * 1.74) * 0.29 : 0;
    opening(out, f, level, { ...config, start, end, radius, top: top + vary });
    if (level > 2 && config.rough) {
      fbox(
        out,
        'rubble',
        f,
        start + 0.18,
        start + width * 0.29,
        top + vary - 0.12,
        top + vary + 0.24,
        -config.depth * 0.83,
        -0.11,
        aged,
      );
      fbox(
        out,
        'dress',
        f,
        start + 0.43,
        start + width * 0.31,
        foot + 0.06,
        foot + 0.18,
        -config.depth - 0.04,
        0.13,
        pale,
      );
    }
  }
}

function westFront(out, level) {
  const { west, axis, datum: y } = plan.church;
  const w = panel([west, axis - 7.16], [west, axis + 7.16]);
  opening(out, w, level, {
    bottom: y - 2.4,
    top: 7.97,
    sill: y,
    spring: 3.45,
    rise: 1.68,
    radius: 1.75,
    depth: 2.31,
    color: stone,
    trim: true,
  });
  opening(out, w, level, {
    bottom: 7.97,
    top: 22.02,
    sill: 8.21,
    spring: 15.92,
    rise: 5.03,
    radius: 3.23,
    depth: 2.06,
    color: pale,
    head: 'pointed',
    trim: true,
  });
  const p = w.P;
  const crest = [
    [0, 21.89],
    [1.75, 22.62],
    [3.82, 23.64],
    [5.22, 25.31],
    [7.13, 26.16],
    [8.22, 24.81],
    [9.2, 24.2],
    [11.0, 22.88],
    [14.32, 21.89],
  ];
  for (let i = 1; i < crest.length; i++) {
    const [u, h] = crest[i - 1],
      [U, H] = crest[i];
    quad4(out, 'rubble', p(u, 21.82), p(U, 21.82), p(U, H), p(u, h), aged);
    quad4(
      out,
      'rubble',
      p(U, 21.82, -1.85),
      p(u, 21.82, -1.85),
      p(u, h, -1.85),
      p(U, H, -1.85),
      stone,
    );
    quad4(out, 'rubble', p(u, h), p(U, H), p(U, H, -1.85), p(u, h, -1.85), aged);
  }
  for (const [start, end, top] of [
    [-0.92, 0.88, 22.9],
    [13.36, 15.11, 21.73],
  ]) {
    fbox(out, 'ashlar', w, start, end, y - 1.6, top, -2.41, 0.37, stone);
    if (level)
      for (const Y of [4.39, 8.03, 12.81, 18.73]) {
        fbox(out, 'dress', w, start - 0.057, end + 0.062, Y, Y + 0.19, -2.51, 0.48, cut);
      }
  }
  if (level > 1) {
    // Concentric reveals cast actual shadow at the entrance.
    const center = w.length * 0.5;
    for (const [radius, rise, d] of [
      [1.98, 1.9, 0.194],
      [2.22, 2.11, 0.32],
      [2.46, 2.31, 0.451],
    ]) {
      const arc = archProfile(radius, rise, LOD_STEPS[level], 'round');
      for (let i = 1; i < arc.length; i++) {
        const [u, v] = arc[i - 1],
          [U, V] = arc[i];
        beam(
          out,
          'dress',
          p(center + u, 3.44 + v, d),
          p(center + U, 3.44 + V, d),
          0.134,
          0.158,
          cut,
        );
      }
      for (const sign of [-1, 1]) {
        const x = center + sign * radius;
        fbox(out, 'dress', w, x - 0.072, x + 0.072, y, 3.45, d - 0.05, d + 0.086, cut);
      }
    }
  }
  const a = panel([west, axis - 10.95], [west, axis - 7.16]),
    b = panel([west, axis + 7.16], [west, axis + 10.35]);
  for (const f of [a, b])
    opening(out, f, level, {
      bottom: y - 1.31,
      top: 7.95,
      sill: y + 0.2,
      spring: 2.96,
      rise: 0.81,
      radius: 0.82,
      depth: 1.67,
      color: aged,
      trim: true,
    });
}

function nave(out, level) {
  const { west, north, south, axis, datum: y } = plan.church;
  westFront(out, level);
  for (const direction of [-1, 1]) {
    const v = axis + direction * 5.18,
      innerOut = v + direction * 8.1;
    const left = [west + 1.1, v],
      right = [13.75, v - 0.13];
    const f = direction < 0 ? panel(right, left) : panel(left, right);
    const bays = level > 2 ? 10 : 8;
    arcade(out, f, level, bays, {
      bottom: y - 2.03,
      top: 10.36,
      sill: y + 0.12,
      spring: 5.82,
      rise: 2.1,
      depth: 1.75,
      trim: level > 1,
      color: stone,
      radius: level ? 2.09 : 4.35,
    });
    arcade(out, f, level, bays, {
      bottom: 10.35,
      top: 18.72,
      sill: 12.31,
      spring: 15.46,
      rise: 0.79,
      depth: 1.47,
      trim: level > 1,
      color: pale,
      radius: level ? 0.72 : 1.26,
      rough: true,
    });
    if (level) {
      for (const h of [9.95, 11.64, 16.98])
        fbox(out, 'dress', f, 0, f.length, h, h + 0.255, -1.58, 0.1, cut);
      const fa =
        direction < 0
          ? panel([11.0, north], [west + 0.96, north])
          : panel([west + 0.96, south], [10.6, south]);
      arcade(out, fa, level, bays, {
        bottom: -1.5,
        top: 6.61,
        sill: 1.68,
        spring: 4.47,
        rise: 0.77,
        depth: 1.08,
        trim: level > 1,
        color: aged,
        radius: 0.69,
        rough: true,
      });
      for (let i = 1; i < bays; i++) {
        const u = (fa.length * i) / bays;
        fbox(out, 'ashlar', fa, u - 0.31, u + 0.31, -1.52, 5.92, -0.2, 0.54, stone);
      }
      if (level > 1)
        for (const u of [-32.15, -12.59, 6.87]) {
          box(
            out,
            'rubble',
            u,
            u + 1.16,
            Math.min(v, innerOut),
            Math.max(v, innerOut),
            y - 1.69,
            2.76,
            aged,
          );
        }
    }
  }
  // North transept to the tower. The chancel and Chapel of the Nine Altars remain unroofed.
  const routes = [
    [[14.57, -45.4], [14.57, -27.61], 16.55, 4, 1.51],
    [[28.23, -28.11], [28.23, -45.19], 15.1, 4, 1.52],
    [[50.81, -44.99], [50.81, -31.06], 12.81, 3, 1.47],
    [[50.74, -16.12], [50.74, -5.91], 13.01, 3, 1.49],
    [[62.24, -6.04], [62.24, -43.21], 15.19, level ? 6 : 3, 1.68],
    [[61.73, -44.02], [51.04, -44.43], 14.63, 3, 1.59],
    [[28.8, -30.21], [49.9, -30.3], 10.65, level ? 5 : 3, 1.61],
    [[47.95, -17.98], [29.02, -17.93], 9.24, level ? 5 : 3, 1.35],
  ];
  for (const [a, b, h, count, depth] of routes) {
    if (!level && h < 10) continue;
    const f = panel(a, b);
    arcade(out, f, level, count, {
      bottom: -1.45,
      top: h,
      sill: 1.8,
      spring: h * 0.61,
      rise: 1.31,
      depth,
      trim: level > 1,
      color: stone,
      radius: level ? 1.18 : 1.54,
      rough: true,
    });
  }
}
function hubyTower(out, level) {
  const { u0, u1, v0, v1, grade, height } = plan.tower;
  const shell = [
    [u0, v0],
    [u0, v1],
    [u1, v1],
    [u1, v0],
  ];
  const sides = shell.map((p, i) => panel(p, shell[(i + 1) % shell.length]));
  const upper = height - 1.61;
  box(out, 'ashlar', u0, u1, v0, v1, -1.6, grade + 0.63, stone);
  for (const f of sides) {
    opening(out, f, level, {
      bottom: grade + 0.62,
      top: 12.58,
      sill: grade + 0.64,
      spring: 5.93,
      rise: 2.87,
      radius: 2.93,
      depth: 1.79,
      head: 'pointed',
      trim: true,
      color: pale,
    });
    opening(out, f, level, {
      bottom: 12.58,
      top: 27.62,
      sill: 17.25,
      spring: 22.88,
      rise: 2.8,
      radius: 1.08,
      depth: 1.67,
      head: 'pointed',
      trim: true,
      color: stone,
    });
    opening(out, f, level, {
      bottom: 27.62,
      top: 42.31,
      sill: 30.22,
      spring: 37.09,
      rise: 4.29,
      radius: 2.36,
      depth: 1.69,
      head: 'pointed',
      trim: true,
      color: pale,
    });
    opening(out, f, level, {
      bottom: 42.31,
      top: upper,
      sill: 43.36,
      spring: 44.95,
      rise: 0.83,
      radius: 0.92,
      depth: 1.71,
      trim: level > 1,
      color: stone,
    });
    for (const y of level ? [11.73, 16.72, 28.93, 40.88, 45.76] : [28.93, 45.76]) {
      fbox(out, 'dress', f, -0.13, f.length + 0.13, y, y + 0.31, -1.84, 0.21, cut);
    }
    const bays = level ? 7 : 5;
    for (let i = 0; i < bays; i++) {
      const x = (f.length * i) / bays;
      fbox(
        out,
        'rubble',
        f,
        x,
        x + (f.length / bays) * 0.57,
        upper - 0.035,
        height,
        -1.4,
        0.1,
        aged,
      );
    }
    for (const [u, U] of [
      [-0.22, 1.05],
      [f.length - 1.05, f.length + 0.22],
    ]) {
      fbox(out, 'ashlar', f, u, U, grade, upper - 0.98, -0.42, 0.61, stone);
      fbox(out, 'dress', f, u - 0.08, U + 0.075, upper - 0.98, height + 0.22, -0.49, 0.67, cut);
    }
    if (level > 1) {
      for (const j of [-1, 0, 1]) {
        const u = f.length * 0.5 + j * 0.91;
        fbox(out, 'dress', f, u - 0.086, u + 0.086, 30.24, 38.13, -0.29, 0.08, cut);
      }
    }
  }
}

function cellarium(out, level) {
  const { u0, u1, v0, v1, grade, bays } = plan.cellarium;
  const center = (u0 + u1) * 0.5,
    count = level > 1 ? bays : 6,
    top = grade + 8.0;
  const width = (v1 - v0) / count,
    spring = grade + 3.45,
    rise = 2.37;
  box(out, 'paving', u0, u1, v0, v1, -2.33, grade + 0.07, paved);
  box(out, 'rubble', u0, u1, v0, v1, grade + 6.16, top, aged);
  for (const f of [panel([u0, v0], [u0, v1]), panel([u1, v1], [u1, v0])]) {
    for (let i = 0; i < count; i++) {
      const entry = i === 0 || i === 2 || i === count - 1;
      const width = f.length / count;
      opening(out, f, level, {
        start: i * width,
        end: (i + 1) * width,
        bottom: grade - 0.14,
        top: top + 0.23,
        sill: entry ? grade + 0.05 : grade + 0.97,
        spring: grade + 3.02 + (entry ? 0.42 : 0),
        rise: entry ? 1.13 : 0.79,
        radius: entry ? 1.34 : 1.02,
        depth: 1.16,
        color: i % 3 === 0 ? pale : stone,
        trim: true,
      });
    }
    if (level)
      for (const Y of [grade + 5.3, top - 0.17])
        fbox(out, 'dress', f, 0, f.length, Y, Y + 0.26, -1.21, 0.09, cut);
    if (level > 1)
      for (let j = 0; j < count; j++) {
        const u = (f.length * (j + 0.02)) / count,
          h = top + 0.43 + (j % 4) * 0.07;
        fbox(out, 'rubble', f, u, u + 0.39, top - 0.09, h, -0.85, -0.015, aged);
      }
  }
  for (const [f, open] of [
    [panel([u0, v1], [u1, v1]), true],
    [panel([u1, v0], [u0, v0]), false],
  ]) {
    for (let i = 0; i < 2; i++) {
      opening(out, f, level, {
        start: (f.length * i) / 2,
        end: (f.length * (i + 1)) / 2,
        bottom: grade - 0.18,
        top: top + 0.18,
        sill: open ? grade + 0.06 : grade + 1.21,
        spring: grade + 3.33,
        rise: 1.73,
        radius: open ? 1.73 : 1.49,
        depth: 1.01,
        trim: true,
        color: stone,
        head: 'pointed',
      });
    }
  }
  for (let j = 1; j < count; j++) {
    const c = xz(center, v0 + j * width);
    lathe(
      out,
      'dress',
      c,
      [
        [grade + 0.06, 0.61, 0.61],
        [grade + 0.28, 0.61, 0.61],
        [grade + 0.42, 0.45, 0.45],
        [spring - 0.28, 0.39, 0.39],
        [spring, 0.52, 0.52],
      ],
      level > 1 ? 8 : 4,
      cut,
      { rotation: heading + Math.PI / 8 },
    );
  }
  if (!level) return;
  const steps = level === 1 ? 2 : level === 2 ? 3 : 7;
  const archHeight = (t) => Math.sqrt(Math.max(0, 1 - t * t));
  for (let j = 0; j < count; j++)
    for (const [a, b] of [
      [u0 + 0.89, center],
      [center, u1 - 0.89],
    ]) {
      const start = v0 + j * width,
        end = start + width;
      const y = (x, z) => spring + rise * Math.max(archHeight(x), archHeight(z));
      const vtx = (f, g) => at(lerp(a, b, (f + 1) * 0.5), lerp(start, end, (g + 1) * 0.5), y(f, g));
      for (let v = 0; v < steps; v++)
        for (let u = 0; u < steps; u++) {
          const x = -1 + (2 * u) / steps,
            z = -1 + (2 * v) / steps,
            X = -1 + (2 * (u + 1)) / steps,
            Z = -1 + (2 * (v + 1)) / steps;
          const p = vtx(x, z),
            q = vtx(X, z),
            r = vtx(X, Z),
            s = vtx(x, Z);
          // Two planar triangles per cell preserve the varying vault normals.
          tri(out, 'vault', p, q, r, mortar);
          tri(out, 'vault', p, r, s, mortar);
        }
      if (level > 1)
        for (const sign of [-1, 1]) {
          const rib = (t) => {
            const p = vtx(t, sign * t);
            p[1] -= 0.095;
            return p;
          };
          const segments = level > 2 ? 8 : 4;
          for (let i = 0; i < segments; i++)
            beam(
              out,
              'dress',
              rib(-1 + (2 * i) / segments),
              rib(-1 + (2 * (i + 1)) / segments),
              0.128,
              0.116,
              cut,
            );
        }
    }
}

function lowRooms(out, level) {
  const profile = (ring, base, height, index, omitLast = false) => {
    const world = outwardRing(ring.map(([u, v]) => xz(u, v)));
    for (const [i, p] of world.entries()) {
      if (omitLast && i === 0) continue;
      const f = wallFace(p, world[(i + 1) % world.length]);
      const h = height * (0.69 + 0.26 * Math.abs(Math.sin((i + 1) * (index + 2) * 0.84)));
      const d = level > 1 ? 0.76 : 1.05;
      const y = base + h;
      if (f.length > 5 && i === index % world.length) {
        const m = f.length * 0.5;
        fbox(out, 'rubble', f, 0, m - 0.86, base - 1.7, y, -d, 0, aged);
        fbox(out, 'rubble', f, m + 0.86, f.length, base - 1.7, y, -d, 0, stone);
      } else fbox(out, 'rubble', f, 0, f.length, base - 1.7, y, -d, 0, aged);
      if (level > 2 && f.length > 3) {
        for (let u = 0.26; u < f.length - 0.7; u += 2.8) {
          const z = Math.max(0.1, Math.sin(index * 0.69 + i + u));
          fbox(
            out,
            'ashlar',
            f,
            u,
            u + 0.45 + z * 0.39,
            y - 0.13,
            y + 0.15 + z * 0.27,
            -d - 0.04,
            -0.084,
            stone,
          );
        }
      }
    }
  };
  profile(plan.cloister, -0.44, 1.07, 0);
  const layout = level
    ? plan.chambers
    : plan.chambers.filter((_, i) => i === 3 || i === 5 || i === 8);
  for (const [i, c] of layout.entries()) profile(c.ring, c.grade, c.height, i + 1);
  profile(plan.refectory, 0.26, 4.88, 5, true);
  const [a, b] = plan.refectory.slice(2);
  const f = panel(a, b);
  const y = 1.0;
  opening(out, f, level, {
    bottom: -1.7,
    top: 10.23,
    sill: y,
    spring: 5.53,
    rise: 2.06,
    radius: 1.98,
    head: 'pointed',
    depth: 1.27,
    color: stone,
    trim: true,
  });
  const p = f.P;
  if (level) {
    tri(out, 'rubble', p(0.31, 10.19), p(f.length - 0.23, 10.19), p(f.length * 0.48, 14.14), aged);
    tri(
      out,
      'rubble',
      p(f.length - 0.23, 10.19, -1.24),
      p(0.31, 10.19, -1.24),
      p(f.length * 0.48, 14.14, -1.24),
      stone,
    );
    for (const u of [0.74, f.length - 1.02])
      fbox(out, 'dress', f, u - 0.17, u + 0.17, -0.85, 10.4, -1.43, 0.26, cut);
  }
}

/** Low surviving connections at the Skell sit below the taller west and southern ranges. */
function riverReturns(out) {
  const walls = [
    [[-76.12, 60.02], [-53.95, 58.9], 1.72],
    [[-53.95, 58.9], [-42.95, 59.28], 2.55],
    [[-42.52, 59.28], [-26.51, 61.47], 2.26],
    [[-26.51, 61.47], [1.34, 61.55], 1.65],
    [[1.34, 61.55], [30.8, 59.54], 1.37],
    [[53.93, 53.1], [70.36, 48.12], 1.18],
    [[64.68, 32.07], [81.15, 21.63], 1.86],
    [[81.15, 21.63], [79.98, 14.81], 1.32],
  ];
  for (const [start, end, crest] of walls) {
    const f = panel(start, end);
    fbox(out, 'rubble', f, 0, f.length, -1.8, crest, -1.02, 0, aged);
    fbox(out, 'ashlar', f, 0.31, f.length * 0.58, crest - 0.13, crest + 0.24, -1.01, -0.07, stone);
  }
}
function culvert(out, run, level) {
  const { path, width, base, spring, rise, crest, wing } = run;
  const world = path.map(([u, v]) => xz(u, v));
  for (let i = 1; i < world.length; i++) {
    const f = wallFace(world[i - 1], world[i]);
    fbox(
      out,
      'rubble',
      f,
      -0.08,
      f.length + 0.08,
      spring + rise - 0.07,
      crest,
      -width * 0.5 - wing,
      width * 0.5 + wing,
      aged,
      { bottom: true },
    );
    for (const sign of [-1, 1]) {
      const d = sign * (width * 0.5 + wing * 0.5);
      fbox(
        out,
        'rubble',
        f,
        -0.08,
        f.length + 0.08,
        base - 2.6,
        crest,
        d - wing * 0.5,
        d + wing * 0.5,
        stone,
      );
    }
  }
  for (const [position, next] of [
    [world[0], world[1]],
    [world.at(-1), world.at(-2)],
  ]) {
    const flow = wallFace(position, next).along;
    const side = [-flow[1], flow[0]];
    const f = facade(position, side);
    opening(out, f, level, {
      start: -width * 0.5 - wing,
      end: width * 0.5 + wing,
      bottom: base - 2.9,
      top: crest,
      sill: base,
      spring,
      rise,
      radius: width * 0.5,
      depth: 1.41,
      trim: true,
      color: pale,
    });
  }
}

function distantTower(out, level) {
  const { u0, u1, v0, v1, grade, height } = plan.tower;
  const bodyTop = level ? 27.62 : height - 1.89;
  box(out, 'ashlar', u0, u1, v0, v1, grade - 2.8, bodyTop, stone);
  const sides = [
    panel([u0, v0], [u0, v1]),
    panel([u1, v1], [u1, v0]),
    panel([u1, v0], [u0, v0]),
    panel([u0, v1], [u1, v1]),
  ];
  for (const f of sides) {
    if (level)
      opening(out, f, level, {
        bottom: bodyTop,
        top: height - 1.69,
        sill: 30.22,
        spring: 37.09,
        rise: 4.29,
        radius: 2.36,
        depth: 1.67,
        head: 'pointed',
        color: pale,
      });
    fbox(out, 'dress', f, -0.28, f.length + 0.28, height - 2.04, height - 1.51, -0.88, 0.28, pale);
    for (let i = 0; i < 3; i++)
      fbox(
        out,
        'rubble',
        f,
        (f.length * i) / 3,
        (f.length * (i + 0.67)) / 3,
        height - 1.58,
        height,
        -1.08,
        0.19,
        aged,
      );
  }
}
function distantCulvert(out, run) {
  const { path, width, base, spring, rise, crest, wing } = run;
  const f = panel(path[0], path.at(-1));
  fbox(
    out,
    'rubble',
    f,
    0,
    f.length,
    spring + rise - 0.15,
    crest,
    -width * 0.5 - wing,
    width * 0.5 + wing,
    aged,
    { bottom: true },
  );
  for (const sign of [-1, 1]) {
    const d = sign * (width * 0.5 + wing * 0.5 + 0.06);
    fbox(out, 'ashlar', f, 0, f.length, base - 1.92, crest, d - wing * 0.5, d + wing * 0.5, stone);
  }
}
function distant(out, level) {
  westFront(out, level);
  distantTower(out, level);
  const { west, axis, datum } = plan.church;
  for (const v of [axis - 5.15, axis + 5.15]) {
    const f = panel([west + 0.41, v], [46.5, v]);
    const bays = level ? 7 : 6;
    if (level) {
      arcade(out, f, 1, bays, {
        bottom: datum - 2.61,
        top: 10.62,
        sill: datum + 0.15,
        spring: 5.84,
        rise: 1.94,
        depth: 1.66,
        color: stone,
        radius: 2.64,
      });
    } else {
      for (let i = 0; i <= bays; i++) {
        const u = (f.length * i) / bays;
        fbox(out, 'ashlar', f, u - 0.62, u + 0.62, datum - 2.6, 11.02, -1.71, 0.03, stone);
      }
    }
    fbox(out, 'ashlar', f, 0, f.length, 10.22, 17.83, -1.39, 0, pale);
  }
  const c = plan.cellarium;
  if (level) {
    cellarium(out, 1);
    lowRooms(out, 1);
  } else {
    box(out, 'rubble', c.u0, c.u1, c.v0, c.v1, c.grade - 2.61, 7.67, aged);
    const court = plan.cloister;
    for (const [i, p] of court.entries()) {
      const f = panel(p, court[(i + 1) % court.length]);
      fbox(out, 'rubble', f, 0, f.length, -1.06, 0.74, -1.19, 0, aged);
    }
  }
  const f = panel([61.5, -9.14], [62.1, -45.2]);
  arcade(out, f, level, level ? 5 : 3, {
    bottom: -1.5,
    top: 14.2,
    sill: 2.7,
    spring: 8.15,
    rise: 1.57,
    depth: 1.47,
    color: pale,
    radius: 1.3,
  });
  for (const run of plan.bridges) distantCulvert(out, run);
}
function build(target, level) {
  const out = withFootprintCaps(target);
  if (level < 2) return distant(out, level);
  nave(out, level);
  hubyTower(out, level);
  cellarium(out, level);
  lowRooms(out, level);
  riverReturns(out);
  for (const run of plan.bridges) culvert(out, run, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
