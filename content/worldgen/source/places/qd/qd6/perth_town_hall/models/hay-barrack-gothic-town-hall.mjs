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
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
};

const red = rgb('9c644c'),
  redDark = rgb('7f5345'),
  limestone = rgb('d4c5ae');
const shingle = rgb('4d5256'),
  dark = rgb('555451'),
  foundation = rgb('888985'),
  blue = rgb('809597');
const F = facade(site.frame.origin, site.frame.along),
  W = site.frame.width,
  D = site.frame.depth;
const point = (u, d) => {
  const [x, , z] = F.P(u, 0, d);
  return [x, z];
};
const rect = (u, d, U, V) => outwardRing([point(u, d), point(U, d), point(U, V), point(u, V)]);
const faces = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));

function panel(out, slot, f, u, U, y, Y, d, c) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
}

function block(out, slot, ring, y, Y, c) {
  extrude(out, slot, ring, y, Y, c, { top: false });
  cap(out, slot, ring, Y, c);
}

function bevelRoof(out, slot, u, v, U, V, y, Y, topU, topV, color) {
  const lower = rect(u, v, U, V);
  const upper = rect(
    (u + U - topU) / 2,
    (v + V - topV) / 2,
    (u + U + topU) / 2,
    (v + V + topV) / 2,
  );
  const P = ([x, z], y) => [x, y, z];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, slot, P(lower[i], y), P(lower[j], y), P(upper[j], Y), P(upper[i], Y), color);
  }
  cap(out, slot, upper, Y, color);
}

function arcade(out, f, start, end, count, detail) {
  const thickness = 1.06,
    cornice = 4.93,
    spring = 2.7;
  const gap = (end - start) / count,
    half = gap * 0.402;
  fbox(out, 'brick', f, 0, start, site.floor, cornice, -thickness, 0, red);
  fbox(out, 'brick', f, end, f.length, site.floor, cornice, -thickness, 0, red);
  let last = start;
  for (let j = 0; j < count; j++) {
    const u = start + (j + 0.5) * gap;
    fbox(out, 'brick', f, last, u - half, site.floor, cornice, -thickness, 0, red);
    last = u + half;
    const curve = pointedArch(half, 1.39, [1, 3, 5, 7][detail]);
    for (let i = 0; i < curve.length - 1; i++) {
      const [a, h] = curve[i],
        [b, H] = curve[i + 1];
      const A = f.P(u + a, spring + h),
        B = f.P(u + b, spring + H);
      quad4(out, 'brick', A, B, f.P(u + b, cornice), f.P(u + a, cornice), red);
      quad4(
        out,
        'brick',
        f.P(u + a, cornice, -thickness),
        f.P(u + b, cornice, -thickness),
        f.P(u + b, spring + H, -thickness),
        f.P(u + a, spring + h, -thickness),
        redDark,
      );
      quad4(
        out,
        'brick',
        f.P(u + a, spring + h, -thickness),
        f.P(u + b, spring + H, -thickness),
        B,
        A,
        redDark,
      );
      if (detail > 0) {
        const d = 0.095;
        quad4(
          out,
          'trim',
          f.P(u + a, spring + h, d),
          f.P(u + b, spring + H, d),
          f.P(u + b * 1.075, spring + H + 0.16, d),
          f.P(u + a * 1.075, spring + h + 0.16, d),
          limestone,
        );
      }
    }
    if (detail > 1) {
      for (const x of [u - half, u + half]) {
        panel(out, 'trim', f, x - 0.045, x + 0.045, site.floor, spring, 0.071, limestone);
      }
    }
  }
  fbox(out, 'brick', f, last, end, site.floor, cornice, -thickness, 0, red);
  fbox(out, 'trim', f, 0, f.length, cornice, 5.27, -0.38, 0.19, limestone);
}

function lancet(out, f, u, y, w, H, detail) {
  opening(out, f, u, y, w, H, {
    head: 'pointed',
    rise: Math.min(w * 0.48, H * 0.4),
    frameSlot: 'trim',
    glassSlot: 'glass',
    frame: limestone,
    glass: redDark,
    frameWidth: detail > 1 ? 0.094 : 0,
    frameDepth: 0.12,
    d: 0.028,
    sill: detail > 1,
    mullions: detail > 2 ? 1 : 0,
  });
}

function hall(out, detail) {
  const outer = outwardRing(site.outline);
  block(out, 'stone', outer, -2.9, site.floor, foundation);
  const north = wallFace(site.outline.at(-1), site.outline[0]);
  const west = wallFace(site.outline[0], site.outline[1]);
  arcade(
    out,
    north,
    north.length - site.northArcade[1],
    north.length - site.northArcade[0],
    7,
    detail,
  );
  arcade(out, west, ...site.westArcade, 3, detail);
  const south = wallFace(site.outline[1], site.outline.at(-2));
  const east = wallFace(site.outline.at(-2), site.outline.at(-1));
  arcade(out, south, 6.3, south.length - 6.3, 5, detail);
  arcade(out, east, 5.3, east.length - 5.3, 3, detail);
  block(out, 'brick', outer, 5.26, 10.46, red);
  const ceiling = rect(0, 0, W, D)
    .reverse()
    .map(([x, z]) => [x, 5.26, z]);
  fan(out, 'trim', ceiling, foundation);
  const roof = site.roof,
    section = rect(7.21, 5.94, 33.99, 20.27);
  block(out, 'brick', section, 10.43, roof.eaves, red);
  gableRoof(
    out,
    'roof',
    point(7.02, 13.1),
    point(34.23, 13.1),
    14.85,
    roof.eaves,
    roof.eaves + roof.rise,
    shingle,
    { endSlot: 'brick', endColor: red, overhang: 0.36 },
  );
  for (const f of [north, west, south, east]) {
    panel(out, 'trim', f, 0, f.length, 10.1, 10.43, 0.13, limestone);
    if (detail === 0) continue;
    const skipNorth = f === north ? 8.16 : 6.23;
    const low = f === west ? 8.1 : 5.57,
      high = f.length - skipNorth;
    const n = Math.max(2, Math.floor((high - low) / 3.65));
    for (let i = 0; i < n; i++) {
      const u = low + ((high - low) * (i + 0.5)) / n;
      const w = detail > 1 ? 0.71 : 1.2;
      for (const d of detail > 1 ? [-0.44, 0.44] : [0])
        lancet(out, f, u + d, 6.44, w, 2.98, detail);
      if (detail > 1) {
        panel(out, 'trim', f, u - 0.19, u + 0.19, 5.28, 6.03, 0.27, limestone);
        panel(out, 'trim', f, u - 0.46, u + 0.46, 5.19, 5.44, 0.24, limestone);
      }
    }
  }
  for (const [u, d] of [
    [W - 6.04, 0.04],
    [W - 6.04, D - 6.11],
    [0.04, D - 6.11],
  ]) {
    const plan = rect(u, d, u + 6, d + 6);
    block(out, 'brick', plan, 5.21, 13.53, red);
    bevelRoof(
      out,
      'roof',
      u - 0.11,
      d - 0.11,
      u + 6.11,
      d + 6.11,
      13.53,
      20.18,
      0.36,
      0.36,
      shingle,
    );
    if (detail > 0)
      for (const f of faces(plan)) {
        panel(out, 'trim', f, 0, f.length, 13.14, 13.53, 0.09, limestone);
        for (const q of [0.27, 0.5, 0.73]) lancet(out, f, f.length * q, 8.34, 0.75, 3.78, detail);
      }
  }
}

function dial(out, f, detail) {
  const u = f.length / 2,
    y = 24.28;
  if (detail === 0) {
    panel(out, 'trim', f, u - 1.48, u + 1.48, y - 1.54, y + 1.54, 0.07, limestone);
    return;
  }
  fbox(out, 'trim', f, u - 1.73, u + 1.73, y - 1.76, y + 1.76, 0, 0.17, limestone);
  const disk = (r, d) =>
    Array.from({ length: detail === 1 ? 12 : 24 }, (_, i) => {
      const theta = (2 * Math.PI * i) / (detail === 1 ? 12 : 24);
      return f.P(u + r * Math.cos(theta), y + r * Math.sin(theta), d);
    });
  fan(out, 'iron', disk(1.29, 0.201), dark);
  fan(out, 'glass', disk(1.11, 0.22), blue);
  if (detail > 1) {
    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6,
        cs = Math.cos(theta),
        sn = Math.sin(theta);
      const p = (r, w) => f.P(u + r * cs - w * sn, y + r * sn + w * cs, 0.231);
      quad4(out, 'iron', p(0.87, -0.033), p(1.05, -0.033), p(1.05, 0.033), p(0.87, 0.033), dark);
    }
  }
  panel(out, 'iron', f, u - 0.035, u + 0.035, y, y + 0.72, 0.241, dark);
  quad4(
    out,
    'iron',
    f.P(u, y - 0.03, 0.24),
    f.P(u + 0.57, y - 0.43, 0.24),
    f.P(u + 0.61, y - 0.37, 0.24),
    f.P(u, y + 0.03, 0.24),
    dark,
  );
}

function tower(out, detail) {
  const { size, shaft, spire, top } = site.tower,
    ring = rect(0, 0, size, size);
  block(out, 'brick', ring, site.floor, shaft, red);
  for (const f of faces(ring)) {
    for (const [y, Y] of [
      [5.08, 5.4],
      [9.82, 10.08],
      [14.52, 14.75],
      [21.66, 22.03],
      [26.36, 26.61],
      [28.84, 29.2],
    ])
      panel(out, 'trim', f, 0, f.length, y, Y, 0.125, limestone);
    dial(out, f, detail);
    if (detail === 0) continue;
    const count = detail === 1 ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const u = (f.length * (i + 1)) / (count + 1);
      lancet(out, f, u, 6.12, 1.02, 3.25, detail);
      lancet(out, f, u, 14.86, 0.95, 5.42, detail);
    }
  }
  bevelRoof(out, 'roof', -0.19, -0.19, size + 0.19, size + 0.19, shaft, spire, 0.48, 0.48, shingle);
  for (const [u, d] of [
    [0.38, 0.38],
    [size - 0.38, 0.38],
    [size - 0.38, size - 0.38],
    [0.38, size - 0.38],
  ]) {
    const c = point(u, d),
      n = [5, 7, 10, 14][detail];
    lathe(
      out,
      'brick',
      c,
      [
        [21.53, 0.24, 0.24],
        [22.02, 0.56, 0.56],
        [28.61, 0.61, 0.61],
      ],
      n,
      red,
    );
    lathe(
      out,
      'trim',
      c,
      [
        [28.52, 0.62, 0.62],
        [28.75, 0.67, 0.67],
        [30.81, 0.084, 0.084],
      ],
      n,
      limestone,
    );
  }
  const c = point(size / 2, size / 2);
  lathe(
    out,
    'iron',
    c,
    [
      [spire, 0.11, 0.11],
      [top, 0.065, 0.065],
    ],
    5,
    dark,
  );
  if (detail > 1) {
    const p = F.P(size / 2, top - 0.2, size / 2);
    tri(
      out,
      'iron',
      p,
      F.P(size / 2 + 1.38, top - 0.49, size / 2 + 0.21),
      F.P(size / 2, top - 1.05, size / 2),
      blue,
    );
  }
}

function build(out, detail) {
  hall(out, detail);
  tower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
