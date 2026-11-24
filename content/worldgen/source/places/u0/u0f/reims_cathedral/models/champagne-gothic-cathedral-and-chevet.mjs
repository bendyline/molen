import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.99 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};

const warm = rgb('c4b394'),
  pale = rgb('d1c4a9'),
  stone = rgb('b6aa92'),
  darkStone = rgb('8a806d');
const pavement = rgb('a49a85'),
  slate = rgb('666c69'),
  metal = rgb('6a6a5c'),
  glass = rgb('454e55');
const stained = ['536573', '68615d', '5b665b', '55565f'].map(rgb);
const [ax, az] = site.along,
  [bx, bz] = site.across;
const world = (u, v) => [u * ax + v * bx, u * az + v * bz];
const P = (u, y, v) => [u * ax + v * bx, y, u * az + v * bz];
const F = facade(site.frame.origin, site.frame.along);
const edges = (r) => r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
const center = (r) => r.reduce(([a, b], [x, z]) => [a + x / r.length, b + z / r.length], [0, 0]);
const rectangle = (u, v, U, V) => outwardRing([world(u, v), world(U, v), world(U, V), world(u, V)]);
const westTowers = new Set(site.towers.map((p) => p.id));
const raised = new Set(site.raisedParts.map((p) => p.id));

function flat(out, slot, f, a, b, low, high, d, color) {
  quad4(out, slot, f.P(a, low, d), f.P(b, low, d), f.P(b, high, d), f.P(a, high, d), color);
}

function mass(out, slot, plan, y, Y, color, topSlot = slot, topColor = color) {
  const r = outwardRing(cleanRing(plan));
  extrude(out, slot, r, y, Y, color, { top: false });
  cap(out, topSlot, r, Y, topColor);
}

function lancet(out, f, u, low, width, height, detail) {
  opening(out, f, u, low, width, height, {
    head: 'pointed',
    rise: Math.min(height * 0.34, width * 0.66),
    glassSlot: 'glass',
    glass,
    frameSlot: 'trim',
    frame: pale,
    frameWidth: detail === 3 ? 0.115 : 0,
    frameDepth: 0.215,
    mullions: detail === 3 ? 1 : 0,
    sill: detail === 3,
    d: 0.038,
  });
  if (detail === 2)
    flat(out, 'trim', f, u - width * 0.55, u + width * 0.55, low - 0.13, low, 0.13, pale);
}

function tracery(out, f, u, y, r, d, detail) {
  const n = [8, 16, 24, 36][detail];
  const polar = (angle, rad, h) => f.P(u + rad * Math.cos(angle), y + rad * Math.sin(angle), d + h);
  const ring = (rad, depth) =>
    Array.from({ length: n }, (_, i) => polar((i * 2 * Math.PI) / n, rad, depth));
  fan(out, 'glass', ring(r, 0), glass);
  const ins = ring(r * 0.942, 0.1),
    outs = ring(r * 1.055, 0.15);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad4(out, 'trim', ins[i], outs[i], outs[j], ins[j], pale);
  }
  if (!detail) return;
  const blades = [8, 10, 14, 18][detail],
    core = r * 0.18;
  for (let i = 0; i < blades; i++) {
    const a = (2 * Math.PI * i) / blades,
      b = a + (2 * Math.PI) / blades;
    if (detail > 1) {
      const p = polar(a + 0.15, r * 0.84, 0.031),
        q = polar(b - 0.15, r * 0.84, 0.031);
      const x = polar(b - 0.08, core * 1.31, 0.03),
        z = polar(a + 0.08, core * 1.31, 0.03);
      quad4(out, 'glass', z, p, q, x, stained[i % stained.length]);
    }
    beam(
      out,
      'trim',
      polar(a, core, 0.086),
      polar(a, r * 0.937, 0.085),
      r * 0.026,
      r * 0.023,
      pale,
    );
    if (detail > 1) {
      beam(
        out,
        'trim',
        polar(a, r * 0.61, 0.08),
        polar((a + b) * 0.5, r * 0.858, 0.081),
        r * 0.015,
        r * 0.016,
        pale,
      );
      beam(
        out,
        'trim',
        polar((a + b) * 0.5, r * 0.858, 0.084),
        polar(b, r * 0.61, 0.08),
        r * 0.015,
        r * 0.016,
        pale,
      );
    }
  }
  fan(out, 'trim', ring(core, 0.127), warm);
  fan(out, 'glass', ring(core * 0.72, 0.139), stained[1]);
}

function archOpening(out, f, u, half, low, spring, top, depth, detail) {
  const profile = pointedArch(half, half * 1.16, [1, 2, 5, 7][detail]);
  for (let k = 0; k < profile.length - 1; k++) {
    const [a, y] = profile[k],
      [b, Y] = profile[k + 1];
    const A = f.P(u + a, spring + y),
      B = f.P(u + b, spring + Y);
    quad4(out, 'stone', A, B, f.P(u + b, top), f.P(u + a, top), stone);
    quad4(
      out,
      'trim',
      f.P(u + a, spring + y, -depth),
      f.P(u + b, spring + Y, -depth),
      B,
      A,
      darkStone,
    );
    if (detail > 0) {
      const layers = detail === 1 ? 1 : detail === 2 ? 2 : 3;
      for (let i = 0; i < layers; i++) {
        const r = 1.015 + i * 0.065,
          w = r + 0.041,
          d = 0.14 - i * 0.028;
        quad4(
          out,
          'trim',
          f.P(u + a * r, spring + y * r + 0.036, d),
          f.P(u + b * r, spring + Y * r + 0.036, d),
          f.P(u + b * w, spring + Y * w + 0.14, d + 0.055),
          f.P(u + a * w, spring + y * w + 0.14, d + 0.055),
          i % 2 ? warm : pale,
        );
      }
    }
  }
  for (const sign of [-1, 1]) {
    const x = u + sign * half,
      A = f.P(x, low),
      B = f.P(x, spring);
    const C = f.P(x, spring, -depth),
      D = f.P(x, low, -depth);
    if (sign < 0) quad4(out, 'trim', A, D, C, B, warm);
    else quad4(out, 'trim', D, A, B, C, warm);
  }
}

function portals(out, detail) {
  const frontY = 20.44;
  const doors = [
    [-12.04, 2.63, 8.92],
    [0, 3.69, 10.74],
    [12.04, 2.63, 8.92],
  ];
  mass(out, 'base', site.apron, -1.18, 0.73, pavement);
  for (let i = 0; i < 3; i++)
    fbox(out, 'trim', F, -17.46, 17.46, 0.64, 0.78 + 0.175 * i, -0.23, 2.8 - 0.55 * i, pavement);
  const west = rectangle(-93.01, -22.3, -82.07, 17.82);
  mass(out, 'stone', west, 0.71, 42, stone);
  let cursor = -19.78;
  for (const [u, w, spring] of doors) {
    fbox(out, 'stone', F, cursor, u - w, 1.16, frontY, -3.84, 0.045, warm);
    archOpening(out, F, u, w, 1.16, spring, frontY, 3.46, detail);
    flat(
      out,
      'glass',
      F,
      u - w * 0.8,
      u + w * 0.8,
      1.2,
      Math.min(8.22, spring - 0.25),
      -3.18,
      glass,
    );
    tracery(out, F, u, spring + 0.1, w * 0.68, -3.11, detail);
    const L = F.P(u - w - 1.1, frontY - 0.68, 0.24),
      R = F.P(u + w + 1.1, frontY - 0.68, 0.24);
    const T = F.P(u, frontY + (u === 0 ? 4.59 : 2.44), 0.34);
    tri(out, 'trim', L, R, T, warm);
    if (detail > 1) {
      beam(out, 'trim', L, T, 0.21, 0.26, pale);
      beam(out, 'trim', T, R, 0.21, 0.26, pale);
    }
    cursor = u + w;
  }
  fbox(out, 'stone', F, cursor, 19.78, 1.16, frontY, -3.84, 0.045, warm);
  fbox(out, 'stone', F, -19.78, 19.78, frontY, 42, -3.86, 0.014, stone);
  tracery(out, F, 0, 30.67, 5.43, 0.13, detail);
  if (detail > 1) {
    const roseGable = pointedArch(7.11, 12.73, detail === 3 ? 12 : 7);
    for (const [i, [a, y]] of roseGable.slice(0, -1).entries()) {
      const [b, Y] = roseGable[i + 1];
      for (const [width, d, color] of [
        [1, 0.18, pale],
        [1.1, 0.28, warm],
        [1.22, 0.15, pale],
      ]) {
        const point = (x, h, scale) => F.P(x * width * scale, 25.64 + h * width * scale, d);
        quad4(
          out,
          'trim',
          point(a, y, 1),
          point(b, Y, 1),
          point(b, Y, 1.037),
          point(a, y, 1.037),
          color,
        );
      }
    }
    for (const sign of [-1, 1]) {
      for (const u of [12.03, 15.22]) {
        lancet(out, F, u * sign, 24.36, 2.32, 12.05, detail);
      }
      fbox(out, 'trim', F, sign * 13.64 - 0.16, sign * 13.64 + 0.16, 22.2, 38.65, 0, 0.38, pale);
      fbox(out, 'trim', F, sign * 13.64 - 0.48, sign * 13.64 + 0.48, 23.6, 23.92, 0, 0.49, warm);
    }
    fbox(out, 'trim', F, -17.97, 17.97, 40.35, 40.71, -0.08, 0.32, pale);
  }
  const galleryY = 42;
  fbox(out, 'trim', F, -9.89, 9.89, galleryY - 0.07, 47.84, -0.91, 0.09, warm);
  if (detail > 0) {
    const count = detail === 1 ? 7 : 13;
    const dx = 18.84 / count;
    for (let i = 0; i < count; i++) {
      const u = -9.42 + dx * (i + 0.5);
      lancet(out, F, u, 42.67, dx * 0.69, 4.57, detail);
      if (detail > 1) fbox(out, 'trim', F, u - 0.16, u + 0.16, 42.9, 45.48, 0.13, 0.43, pale);
    }
  }
  for (const u of [-18.2, -8.18, 8.18, 18.2]) {
    fbox(out, 'trim', F, u - 0.58, u + 0.58, 1.14, 39.22, -1.65, 0.93, pale);
    if (detail > 0) {
      const p = F.P(u, 0, 0.53);
      lathe(
        out,
        'trim',
        [p[0], p[2]],
        [
          [37.82, 0.61, 0.61],
          [39.18, 0.49, 0.49],
          [44.12, 0.07, 0.07],
        ],
        6,
        pale,
      );
    }
  }
}

function belfry(out, shape, detail) {
  const r = outwardRing(shape.outline),
    y = shape.minHeight,
    Y = shape.height;
  mass(out, 'stone', r, y, y + 10.65, stone);
  for (const f of edges(r)) {
    const a = f.length / 2;
    const half = f.length * 0.255,
      low = y + 11.72,
      spring = Y - 5.31;
    if (detail === 0) {
      flat(out, 'stone', f, 0, a - half, y + 10.64, Y - 1.08, 0, stone);
      flat(out, 'stone', f, a + half, f.length, y + 10.64, Y - 1.08, 0, stone);
      flat(out, 'stone', f, a - half, a + half, y + 10.64, low, 0, stone);
      flat(out, 'stone', f, a - half, a + half, spring, Y - 1.08, 0, stone);
      continue;
    }
    fbox(out, 'stone', f, 0, a - half, y + 10.64, Y - 1.08, -0.96, 0, stone);
    fbox(out, 'stone', f, a + half, f.length, y + 10.64, Y - 1.08, -0.96, 0, stone);
    fbox(out, 'stone', f, a - half, a + half, y + 10.64, low, -0.96, 0, stone);
    archOpening(out, f, a, half, low, spring, Y - 1.08, 0.96, detail);
    if (detail > 0) {
      fbox(out, 'trim', f, a - 0.077, a + 0.077, low, spring + 0.76, -0.22, 0.13, pale);
      for (const q of [0.13, 0.87])
        flat(
          out,
          'trim',
          f,
          f.length * q - 0.075,
          f.length * q + 0.075,
          48.41,
          Y - 1.09,
          0.14,
          pale,
        );
    }
  }
  cap(out, 'roof', r, Y - 1.08, slate);
  for (const [x, z] of r) {
    lathe(
      out,
      'trim',
      [x, z],
      [
        [Y - 4.18, 0.38, 0.38],
        [Y - 1.3, 0.58, 0.58],
        [Y, 0.13, 0.13],
      ],
      detail === 0 ? 4 : 6,
      pale,
    );
  }
}

function chapel(out, outline, y, Y, detail) {
  const r = outwardRing(cleanRing(outline));
  mass(out, 'stone', r, y, Y, stone, 'roof', slate);
  if (detail === 0) return;
  for (const f of edges(r)) {
    if (f.length < 1.83) continue;
    const n = Math.max(1, Math.round(f.length / (detail === 1 ? 7.85 : 5.75)));
    if (Y - y > 4.7)
      for (let i = 0; i < n; i++) {
        const a = (f.length * (i + 0.5)) / n,
          w = Math.min(1.68, (f.length / n) * 0.58);
        const bottom = y + (Y - y) * 0.29,
          h = Math.min(9.5, (Y - y) * 0.55);
        if (detail === 1)
          flat(out, 'glass', f, a - w / 2, a + w / 2, bottom, bottom + h, 0.034, glass);
        else lancet(out, f, a, bottom, w, h, detail);
      }
    flat(out, 'trim', f, 0, f.length, Y - 0.45, Y - 0.25, 0.089, pale);
  }
}

function raisedRoof(out, shape, detail) {
  const [u, v, U, V] = shape.bounds,
    r = outwardRing(cleanRing(shape.outline));
  const top = shape.height;
  const y = top - (shape.roof === 'gabled' ? 16.1 : 8.9);
  if (shape.id === 778266646) {
    const [x, z] = center(r);
    lathe(
      out,
      'roof',
      [x, z],
      [
        [top - 9.8, 1.29, 1.29],
        [top - 6.62, 1.04, 1.04],
        [top - 0.24, 0.18, 0.18],
        [top, 0.075, 0.075],
      ],
      [5, 7, 10, 13][detail],
      metal,
    );
    return;
  }
  chapel(out, r, 12.64, y, detail);
  if (shape.roof === 'gabled') {
    const longitudinal = U - u > V - v;
    const path = longitudinal
      ? [world(u, (v + V) / 2), world(U, (v + V) / 2)]
      : [world((u + U) / 2, v), world((u + U) / 2, V)];
    gableRoof(out, 'roof', path[0], path[1], longitudinal ? V - v : U - u, y, top, slate, {
      overhang: 0.28,
      endSlot: 'stone',
      endColor: warm,
    });
  } else {
    const c = center(r),
      t = r.map(([x, z]) => [c[0] + (x - c[0]) * 0.057, c[1] + (z - c[1]) * 0.057]);
    const p = (a, y) => [a[0], y, a[1]];
    for (const [i, a] of r.entries()) {
      const j = (i + 1) % r.length;
      quad4(out, 'roof', p(a, y), p(r[j], y), p(t[j], top), p(t[i], top), slate);
    }
    cap(out, 'roof', t, top, slate);
  }
}

function buttress(out, { height, outline, bounds }, detail) {
  const r = outwardRing(cleanRing(outline)),
    [u, v, U, V] = bounds;
  const X = (u + U) * 0.5,
    Z = (v + V) * 0.5;
  const finial = height - (height === 44 ? 5.65 : 4.11);
  mass(out, 'stone', r, -1.07, finial, stone);
  const c = center(r);
  const sides = detail === 0 ? 4 : 6;
  lathe(
    out,
    'trim',
    c,
    [
      [finial, 0.62, 0.62],
      [height - 0.19, 0.115, 0.115],
      [height, 0.063, 0.063],
    ],
    sides,
    pale,
  );
  if (X < -84 || Math.abs(Z + 2.2) < 11.8) return;
  const dist = Z + 2.2,
    edge = -2.2 + Math.sign(dist) * Math.min(10.42, Math.abs(dist) * 0.66);
  const spans = detail < 2 ? [height - 4.24] : [height - 11.78, height - 4.24];
  for (const base of spans) {
    const n = [1, 1, 6, 9][detail];
    const arch = (t) =>
      P(
        X,
        base + (height >= 44 ? 9.35 : 6.23) * t + Math.sin(t * Math.PI) * 0.82,
        Z + (edge - Z) * t,
      );
    for (let i = 0; i < n; i++) {
      const a = arch(i / n),
        b = arch((i + 1) / n);
      beam(out, 'trim', a, b, detail === 0 ? 0.92 : 0.74, height >= 44 ? 0.84 : 0.72, pale);
    }
  }
}

function build(out, detail) {
  const foot =
    detail === 0
      ? [rectangle(-82.31, -17.29, 32.84, 13.4), rectangle(-24.85, -28.4, 3.78, 23.9)]
      : site.westBody;
  for (const r of foot) mass(out, 'base', r, -2.91, 11.96, stone, 'roof', slate);
  portals(out, detail);
  for (const shape of site.towers) belfry(out, shape, detail);
  for (const shape of site.raisedParts) raisedRoof(out, shape, detail);
  for (const shape of site.parts) {
    if (
      raised.has(shape.id) ||
      westTowers.has(shape.id) ||
      site.portalIds.includes(shape.id) ||
      shape.id === 778266640 ||
      shape.id === 778266636
    )
      continue;
    if (shape.height === 32 || shape.height === 44) {
      const selected =
        detail === 0
          ? shape.id % 2 === 0 && (shape.height === 44 || shape.id % 3 === 0)
          : detail > 1 || shape.height === 44 || shape.id % 2 === 0;
      if (selected) buttress(out, shape, detail);
    } else if (shape.height >= [26, 20, 13, 13][detail])
      chapel(out, shape.outline, 1.1, shape.height, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
