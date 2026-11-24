import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.93 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};

const buff = rgb('b9a996');
const pale = rgb('c7bba7');
const ash = rgb('a69b8c');
const gray = rgb('7c7467');
const dark = rgb('47433c');
const glass = rgb('5b5148');
const wood = rgb('774e3b');
const slate = rgb('585d5c');
const F = facade(site.frame.origin, site.frame.along);
const mid = -1.02;
const ledge = 4.43;
const towerTop = 20.16;
const grade = -1.36;
const xz = ([x, , z]) => [x, z];
const P = (u, y, d = 0) => F.P(u, y, d);
const at = ([u, d]) => xz(P(u, 0, d));
const rect = (u, d, U, D) =>
  [
    [u, d],
    [U, d],
    [U, D],
    [u, D],
  ].map(at);

function block(out, slot, ring, y, Y, color, roof = slot, tint = color) {
  extrude(out, slot, ring, y, Y, color, { top: false });
  cap(out, roof, ring, Y, tint);
}

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), color);
}

function archTrim(out, f, u, y, h, rise, width, depth, steps) {
  const a = roundArch(h, steps);
  for (let i = 0; i < steps; i++) {
    const p = (i, s, d) => f.P(u + a[i][0] * s, y + a[i][1] * s * rise, d);
    quad4(
      out,
      'trim',
      p(i, 1, depth),
      p(i + 1, 1, depth),
      p(i + 1, 1 + width / h, depth),
      p(i, 1 + width / h, depth),
      pale,
    );
    quad4(out, 'trim', p(i, 1, 0), p(i + 1, 1, 0), p(i + 1, 1, depth), p(i, 1, depth), ash);
  }
}

function archWall(out, f, a, b, y, Y, bays, depth, steps, ornament) {
  let last = a;
  for (const { u, h, spring, rise = 1 } of bays) {
    const x = u - h,
      X = u + h;
    if (x - last > 1e-4) panel(out, 'wall', f, last, x, y, Y, 0, buff);
    const arc = roundArch(h, steps).map(([x, dy]) => [u + x, spring + dy * rise]);
    for (let i = 0; i + 1 < arc.length; i++) {
      const [u, y] = arc[i],
        [U, h] = arc[i + 1];
      quad4(out, 'wall', f.P(u, y), f.P(U, h), f.P(U, Y), f.P(u, Y), buff);
      quad4(out, 'trim', f.P(u, y), f.P(u, y, -depth), f.P(U, h, -depth), f.P(U, h), ash);
    }
    quad4(out, 'trim', f.P(x, y), f.P(x, y, -depth), f.P(x, spring, -depth), f.P(x, spring), ash);
    quad4(out, 'trim', f.P(X, y, -depth), f.P(X, y), f.P(X, spring), f.P(X, spring, -depth), ash);
    if (ornament) archTrim(out, f, u, spring, h, rise, 0.235, 0.086, steps);
    last = X;
  }
  if (b - last > 1e-4) panel(out, 'wall', f, last, b, y, Y, 0, buff);
}

function sash(
  out,
  f,
  u,
  y,
  w,
  h,
  detail,
  { color = glass, recess = 0, mullions = true, surface = 'glass' } = {},
) {
  opening(out, f, u, y, w, h, {
    head: 'round',
    glassSlot: surface,
    glass: color,
    frameSlot: 'trim',
    frame: pale,
    frameWidth: detail > 1 ? 0.13 : 0,
    frameDepth: 0.12,
    d: recess + 0.016,
    sill: false,
    mullions: detail > 1 && mullions ? 1 : 0,
    transoms: detail > 1 && mullions ? 1 : 0,
  });
}

function roof(out, u, U, d, D, y, Y) {
  const m = (u + U) / 2;
  quad4(out, 'roof', P(m, Y, D), P(u, y, D), P(u, y, d), P(m, Y, d), slate);
  quad4(out, 'roof', P(U, y, D), P(m, Y, D), P(m, Y, d), P(U, y, d), slate);
  tri(out, 'wall', P(u, y, d), P(U, y, d), P(m, Y, d), buff);
  tri(out, 'wall', P(U, y, D), P(u, y, D), P(m, Y, D), buff);
}

function masonryBody(out, detail) {
  const outline = site.local;
  const f = [[-10.582, -6.8], [8.437, -6.8], ...outline.slice(8), ...outline.slice(0, 5)].map(at);
  block(out, 'base', f, grade, 0.3, gray);
  block(out, 'wall', f, 0.3, 9.79, buff, 'roof', slate);
  roof(out, -10.72, 8.56, -6.62, -40.24, 9.77, 13.79);
  roof(out, -15.7, -10.58, -15.87, -40.13, 9.38, 10.9);
  roof(out, 8.52, 10.65, -16.44, -40.2, 9.23, 10.83);
  if (detail === 0) return;
  const ring = outwardRing(f);
  for (const [i, a] of ring.entries()) {
    const w = wallFace(a, ring[(i + 1) % ring.length]);
    if (w.length < 12 || Math.abs(w.normal[0] * F.normal[0] + w.normal[1] * F.normal[1]) > 0.95)
      continue;
    const count = Math.round(w.length / 5.55);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.52) * w.length) / count;
      sash(out, w, u, 4.14, 1.4, 3.85, detail);
      if (detail > 1) {
        fbox(out, 'base', w, u - 2.07, u - 1.72, 0.23, 6.64, -0.02, 0.44, ash);
        fbox(out, 'trim', w, u - 2.1, u - 1.69, 6.61, 6.89, -0.04, 0.49, pale);
      }
    }
  }
}

function rail(out, f, u, U, y, detail) {
  const height = 0.67;
  if (detail === 0) {
    fbox(out, 'trim', f, u, U, y, y + height, -0.19, 0.06, pale);
    return;
  }
  const count = Math.round((U - u) / (detail > 1 ? 0.37 : 0.63));
  fbox(out, 'trim', f, u, U, y, y + 0.108, -0.24, 0.055, pale);
  fbox(out, 'trim', f, u, U, y + height - 0.115, y + height, -0.25, 0.061, pale);
  for (let i = 0; i <= count; i++) {
    const x = u + (i * (U - u)) / count;
    fbox(out, 'trim', f, x - 0.048, x + 0.048, y + 0.108, y + height - 0.105, -0.223, 0.026, pale);
  }
}

function crossBand(out, f, len, y, detail) {
  fbox(out, 'base', f, 0, len, y - 0.104, y + 0.08, -0.15, 0.16, gray);
  if (detail === 0) {
    fbox(out, 'trim', f, 0.05, len - 0.05, y + 0.075, y + 0.7, -0.19, 0.096, ash);
    return;
  }
  fbox(out, 'trim', f, 0, len, y + 0.63, y + 0.78, -0.26, 0.125, ash);
  const count = 5;
  const steps = detail === 1 ? 4 : detail === 2 ? 8 : 16;
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * len) / count,
      m = y + 0.37;
    const h = len / count / 2;
    const ring = Array.from({ length: steps }, (_, k) => {
      const t = (k * 2 * Math.PI) / steps;
      const a = Math.cos(t),
        b = Math.sin(t),
        r = 0.157 + 0.047 * Math.cos(4 * t);
      const reach = Math.min(h / Math.max(0.001, Math.abs(a)), 0.28 / Math.max(0.001, Math.abs(b)));
      return [
        [u + a * r, m + b * r],
        [u + a * reach, m + b * reach],
      ];
    });
    for (let j = 0; j < steps; j++) {
      const [i, o] = ring[j],
        [I, O] = ring[(j + 1) % steps];
      const p = ([u, y], d) => f.P(u, y, d);
      quad4(out, 'trim', p(i, 0.085), p(o, 0.085), p(O, 0.085), p(I, 0.085), ash);
      if (detail > 1) {
        quad4(out, 'trim', p(I, -0.18), p(O, -0.18), p(o, -0.18), p(i, -0.18), ash);
        quad4(out, 'trim', p(i, 0.085), p(I, 0.085), p(I, -0.18), p(i, -0.18), gray);
      }
    }
  }
}

function tower(out, t, detail) {
  const { low: u, high: U, u: c } = t;
  const offset = U - u;
  const lower = rect(u, -5.85, U, 0.015);
  block(out, 'wall', lower, grade, ledge, buff);
  const upperF = facade(xz(P(u, 0, 0)), F.along);
  const steps = [3, 5, 8, 10][detail];
  archWall(
    out,
    upperF,
    0,
    offset,
    ledge,
    8.7,
    [{ u: offset / 2, h: 1.4, spring: 6.52 }],
    2.15,
    steps,
    detail > 1,
  );
  panel(out, 'wall', upperF, 0, offset, ledge, 8.699, -2.23, ash);
  for (const [lo, hi] of [
    [u, u + 0.65],
    [U - 0.65, U],
  ])
    fbox(out, 'base', F, lo, hi, ledge, 8.7, -5.87, 0.075, ash);
  if (detail > 0) rail(out, F, c - 1.42, c + 1.42, ledge + 0.02, detail);
  block(out, 'wall', rect(u + 0.21, -5.67, U - 0.21, -0.035), 8.7, 14.42, buff);
  const crown = rect(u + 0.4, -5.43, U - 0.4, -0.115);
  block(out, 'wall', crown, 14.39, towerTop, pale, 'base', gray);
  for (const [y, l] of [
    [ledge, 0.18],
    [8.72, 0.22],
    [14.39, 0.2],
    [towerTop, 0.185],
  ]) {
    block(out, 'base', rect(u - 0.005, -5.77, U + 0.018, 0.087), y - l, y, gray);
  }
  if (detail > 0) {
    sash(out, F, c, 9.29, 0.83, 3.38, detail, {
      recess: -0.017,
      color: rgb('663e34'),
      mullions: false,
    });
    for (const v of [c - 0.78, c + 0.78]) {
      sash(out, F, v, 15.18, 0.97, 3.88, detail, { recess: -0.094, mullions: false });
      const slats = detail === 1 ? 5 : 14;
      for (let j = 0; j < slats; j++) {
        const y = 15.29 + (j * 3.43) / slats;
        fbox(out, 'base', F, v - 0.449, v + 0.449, y, y + 0.069, -0.086, -0.047, ash);
      }
    }
  }
  for (const xx of [u + 0.36, U - 0.36])
    for (const d of [-5.44, -0.036]) {
      const c = xz(P(xx, 0, d));
      radial(
        out,
        c,
        [
          [20.12, 0.25],
          [21.37, 0.23],
          [21.57, 0.11],
          [22.24, 0],
        ],
        detail > 1 ? 8 : 4,
      );
    }
  const w = outwardRing(crown);
  for (const [i, p] of w.entries()) {
    const f = wallFace(p, w[(i + 1) % w.length]);
    crossBand(out, f, f.length, towerTop, detail);
  }
  if (detail > 1) {
    for (const x of [u + 0.105, U - 0.59]) {
      for (const [y, Y] of [
        [0.1, 4.54],
        [4.49, 8.83],
        [8.75, 14.48],
      ]) {
        fbox(out, 'trim', F, x, x + 0.425, y, Y, -0.044, 0.248, ash);
      }
    }
    for (let j = 1; j <= 6; j++) {
      const x = u + (offset * j) / 7;
      fbox(out, 'trim', F, x - 0.111, x + 0.111, 19.82, 20.105, -0.14, 0.08, pale);
    }
  }
}

function radial(out, center, rings, sides) {
  lathe(
    out,
    'trim',
    center,
    rings.map(([y, r]) => [y, r, r]),
    sides,
    pale,
  );
}

function arm(out, a, b, width) {
  const [u, y] = a,
    [U, Y] = b;
  const dx = (-(Y - y) * width) / Math.hypot(U - u, Y - y),
    dy = ((U - u) * width) / Math.hypot(U - u, Y - y);
  const p = (a, b, d) => P(a, b, d - 3.53);
  const front = [
    p(u - dx, y - dy, 0.1),
    p(U - dx, Y - dy, 0.1),
    p(U + dx, Y + dy, 0.1),
    p(u + dx, y + dy, 0.1),
  ];
  const back = front.map(([x, y, z]) => [x - F.normal[0] * 0.2, y, z - F.normal[1] * 0.2]);
  quad4(out, 'trim', ...front, pale);
  quad4(out, 'trim', ...back.slice().reverse(), pale);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'trim', front[i], back[i], back[j], front[j], pale);
  }
}

function central(out, detail) {
  const a = -5.09,
    b = 3.06;
  const n = detail === 0 ? 3 : detail === 1 ? 5 : 10;
  archWall(
    out,
    F,
    a,
    b,
    0.12,
    ledge,
    [
      { u: -4.28, h: 0.57, spring: 2.49 },
      { u: mid, h: 2.14, spring: 2.61, rise: 0.57 },
      { u: 2.26, h: 0.56, spring: 2.49 },
    ],
    3.15,
    n,
    detail > 1,
  );
  archWall(
    out,
    F,
    a,
    b,
    ledge + 0.04,
    8.79,
    [
      { u: -4.23, h: 0.67, spring: 6.61 },
      { u: mid, h: 1.88, spring: 6.61 },
      { u: 2.24, h: 0.65, spring: 6.62 },
    ],
    2.82,
    n,
    detail > 1,
  );
  if (detail > 0) {
    for (const s of [-1, 1]) {
      const a = P(mid, 9.27, 0.24);
      const b = P(mid + s * 2.04, 8.21, 0.24);
      const high = ([x, y, z]) => [x, y + 0.175, z];
      const face = [a, b, high(b), high(a)];
      quad4(out, 'trim', ...(s > 0 ? face : face.reverse()), pale);
      fbox(
        out,
        'trim',
        F,
        mid + s * 2.04 - 0.11,
        mid + s * 2.04 + 0.11,
        6.55,
        8.36,
        0,
        0.194,
        pale,
      );
    }
  }
  for (const [y, d, Y] of [
    [0.07, -3.27, ledge],
    [ledge, -2.91, 8.75],
  ]) {
    panel(out, 'wall', F, a, b, y, Y, d, detail === 0 ? gray : ash);
    const f = facade(xz(P(0, 0, d + 0.02)), F.along);
    sash(out, f, mid, y + 0.096, 1.46, 2.24, detail, {
      color: wood,
      mullions: false,
      surface: 'wood',
    });
  }
  const treads = rect(a, -3.28, b, 2.84);
  block(out, 'base', treads, -1.1, 0.128, ash);
  block(out, 'trim', rect(a, -3.25, b, 0.09), ledge - 0.292, ledge + 0.024, ash);
  block(out, 'wall', rect(a, -6.92, b, -2.96), 8.76, 12.68, buff);
  roof(out, a - 0.04, b + 0.04, -2.81, -8.92, 12.65, 15.13);
  const f = facade(xz(P(0, 0, -2.929)), F.along);
  if (detail > 0) {
    for (const x of [-2.38, mid, 0.34]) sash(out, f, x, 8.91, 0.94, 2.1, detail);
    if (detail > 1) {
      const gableFace = facade(xz(P(0, 0, -2.81)), F.along);
      const flags = Array.from({ length: 20 }, (_, i) => {
        const t = (i * Math.PI) / 10;
        return gableFace.P(mid + 0.48 * Math.cos(t), 13.15 + 0.48 * Math.sin(t), 0.037);
      });
      const inset = flags.map((_, i) => {
        const t = (i * Math.PI) / 10;
        return gableFace.P(mid + 0.36 * Math.cos(t), 13.15 + 0.36 * Math.sin(t), 0.052);
      });
      fan(out, 'glass', inset, wood);
      for (const [i, v] of flags.entries()) {
        const j = (i + 1) % flags.length;
        quad4(out, 'trim', inset[i], v, flags[j], inset[j], pale);
      }
      const n = 3;
      for (let j = 0; j < n; j++) {
        const a = (j * 2 * Math.PI) / n;
        const pts = Array.from({ length: 8 }, (_, i) => {
          const t = (i * Math.PI) / 4;
          return gableFace.P(
            mid + 0.142 * Math.cos(a) + 0.127 * Math.cos(t),
            13.15 + 0.142 * Math.sin(a) + 0.127 * Math.sin(t),
            0.074,
          );
        });
        fan(out, 'base', pts, dark);
      }
    }
    rail(out, F, a + 0.09, b - 0.09, ledge + 0.06, detail);
  }
  if (detail > 0) {
    const pedestal = xz(P(mid, 0, -3.53));
    radial(
      out,
      pedestal,
      [
        [15.05, 0.38],
        [15.2, 0.42],
        [15.44, 0.28],
        [15.6, 0.23],
      ],
      detail > 1 ? 10 : 6,
    );
    radial(
      out,
      pedestal,
      [
        [15.59, 0.22],
        [15.96, 0.196],
        [16.37, 0.136],
        [16.75, 0.185],
        [16.98, 0.148],
        [17.05, 0.084],
        [17.08, 0.112],
        [17.24, 0.126],
        [17.32, 0.05],
      ],
      detail > 1 ? 10 : 6,
    );
    for (const s of [-1, 1]) {
      arm(out, [mid + s * 0.14, 16.83], [mid + s * 0.44, 16.92], 0.071);
      arm(out, [mid + s * 0.44, 16.92], [mid + s * 0.76, 17.14], 0.058);
    }
  }
}

function stairs(out, detail) {
  const sides = [
    [-11.05, -9.24],
    [7.09, 8.77],
  ];
  const steps = detail === 0 ? 5 : 14;
  for (const [u, U] of sides) {
    for (let i = 0; i < steps; i++) {
      const y = 0.16 + ((ledge - 0.16) * (i + 1)) / steps;
      const d = 1.62 - (i * 8.42) / steps,
        D = 1.62 - ((i + 1) * 8.42) / steps;
      fbox(out, 'trim', F, u, U, -0.19, y, D, d, ash);
      if (detail > 1)
        fbox(out, 'base', F, u + 0.07, U - 0.07, y - 0.063, y - 0.025, d - 0.065, d + 0.055, gray);
    }
  }
}

function build(out, detail) {
  masonryBody(out, detail);
  for (const t of site.towers) tower(out, t, detail);
  central(out, detail);
  stairs(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
