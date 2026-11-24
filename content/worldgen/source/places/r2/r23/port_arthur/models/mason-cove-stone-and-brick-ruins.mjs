import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  sandstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.98 },
  ashlar: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.9 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96 },
};

const brick = rgb('ad866c'),
  terra = rgb('976f58'),
  pale = rgb('b4a488'),
  sand = rgb('a7a08a');
const dark = rgb('6f6050'),
  iron = rgb('57564e'),
  stone = rgb('8c8577');
const trim = [rgb('a99a81'), rgb('b6a78f'), rgb('998b73')];
const faces = (r) => r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
const center = (r) => r.reduce(([a, b], [x, z]) => [a + x / r.length, b + z / r.length], [0, 0]);

function at(f, u, v) {
  const [x, , z] = f.P(u, 0, v);
  return [x, z];
}
function plan(f, u, d, U, D) {
  return outwardRing([at(f, u, d), at(f, U, d), at(f, U, D), at(f, u, D)]);
}
function panel(out, slot, f, u, U, y, Y, d, c) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
}
function slab(out, slot, ring, y, Y, c) {
  extrude(out, slot, ring, y, Y, c, { top: false });
  cap(out, slot, ring, Y, c);
}

function wallSlice(out, slot, f, a, b, y, Y, t, color) {
  panel(out, slot, f, a, b, y, Y, 0, color);
  panel(out, slot, f, b, a, y, Y, -t, color);
  quad4(out, slot, f.P(a, Y, 0), f.P(b, Y, 0), f.P(b, Y, -t), f.P(a, Y, -t), color);
}

function punch(out, f, u, half, low, spring, limit, thickness, detail, kind, slot, color) {
  const arch =
    kind === 'pointed'
      ? pointedArch(half, Math.min(1.23, half * 1.23), [2, 2, 4, 6][detail])
      : roundArch(half, [2, 2, 6, 8][detail]).map(([x, y]) => [
          x,
          y * (kind === 'round' ? 1 : 0.29),
        ]);
  const trimDepth = 0.08;
  for (let i = 0; i < arch.length - 1; i++) {
    const [d, h] = arch[i],
      [D, H] = arch[i + 1],
      a = u + d,
      b = u + D;
    const A = f.P(a, spring + h),
      B = f.P(b, spring + H);
    quad4(out, slot, A, B, f.P(b, limit), f.P(a, limit), color);
    quad4(
      out,
      slot,
      f.P(a, limit, -thickness),
      f.P(b, limit, -thickness),
      f.P(b, spring + H, -thickness),
      f.P(a, spring + h, -thickness),
      color,
    );
    quad4(
      out,
      'ashlar',
      f.P(a, spring + h, -thickness),
      f.P(b, spring + H, -thickness),
      B,
      A,
      dark,
    );
    if (detail > 1) {
      const q = (v, y) => f.P(v, y, trimDepth);
      quad4(
        out,
        'ashlar',
        q(a, spring + h),
        q(b, spring + H),
        q(u + D * 1.13, spring + H + 0.17),
        q(u + d * 1.13, spring + h + 0.17),
        trim[i % 3],
      );
    }
  }
  quad4(
    out,
    'ashlar',
    f.P(u - half, low, 0),
    f.P(u - half, low, -thickness),
    f.P(u - half, spring, -thickness),
    f.P(u - half, spring, 0),
    dark,
  );
  quad4(
    out,
    'ashlar',
    f.P(u + half, low, -thickness),
    f.P(u + half, low, 0),
    f.P(u + half, spring, 0),
    f.P(u + half, spring, -thickness),
    dark,
  );
  if (detail > 1) {
    for (const sign of [-1, 1])
      panel(
        out,
        'ashlar',
        f,
        u + sign * half - 0.11,
        u + sign * half + 0.11,
        low,
        spring,
        0.1,
        pale,
      );
  }
}

function bays(
  out,
  f,
  a,
  b,
  y0,
  y1,
  openings,
  detail,
  { slot = 'brick', color = brick, step = 4.1, t = 0.66 } = {},
) {
  if (detail === 0) {
    if (b - a < 12.0) {
      wallSlice(out, slot, f, a, b, y0, y1, t, color);
      return;
    }
    const u = (a + b) / 2,
      half = Math.min(1.38, (b - a) * 0.16);
    const [low, spring] = openings[0];
    wallSlice(out, slot, f, a, u - half, y0, y1, t, color);
    wallSlice(out, slot, f, u + half, b, y0, y1, t, color);
    if (low - y0 > 0.015) wallSlice(out, slot, f, u - half, u + half, y0, low, t, color);
    wallSlice(out, slot, f, u - half, u + half, spring, y1, t, color);
    return;
  }
  if (detail === 1) {
    step *= 1.85;
    openings = openings.filter((_, i) => openings.length < 3 || i % 2 === 0);
  }
  const count = Math.max(1, Math.round((b - a) / step)),
    width = (b - a) / count;
  let last = a;
  for (let i = 0; i < count; i++) {
    const u = a + width * (i + 0.5),
      half = Math.min(1.03, width * 0.275);
    wallSlice(out, slot, f, last, u - half, y0, y1, t, color);
    let y = y0;
    for (const [low, spring, kind] of openings) {
      const Y = Math.min(
        y1,
        spring + (kind === 'pointed' ? half * 1.23 : kind === 'round' ? half : half * 0.29) + 0.38,
      );
      if (low - y > 0.025) wallSlice(out, slot, f, u - half, u + half, y, low, t, color);
      punch(out, f, u, half, low, spring, Y, t, detail, kind, slot, color);
      if (detail > 1 && slot === 'brick') {
        const n = detail === 2 ? 3 : 5;
        for (let j = 1; j <= n; j++) {
          const p = u - half + (2 * half * j) / (n + 1);
          panel(out, 'iron', f, p - 0.025, p + 0.025, low, spring, -0.11, iron);
        }
      }
      y = Y;
    }
    if (y1 - y > 0.02) wallSlice(out, slot, f, u - half, u + half, y, y1, t, color);
    last = u + half;
  }
  wallSlice(out, slot, f, last, b, y0, y1, t, color);
}

function chimney(out, f, u, d, y, h, w, slot = 'brick') {
  slab(out, slot, plan(f, u - w, d - w / 1.2, u + w, d + w / 1.2), y, h, terra);
  slab(
    out,
    'ashlar',
    plan(f, u - w - 0.13, d - w / 1.2 - 0.13, u + w + 0.13, d + w / 1.2 + 0.13),
    h,
    h + 0.22,
    dark,
  );
}

function penitentiary(out, { outline, grade: y }, detail) {
  const ring = outwardRing(outline),
    n = faces(ring);
  const front = wallFace(outline[1], outline[0]),
    l = front.length;
  const upper = [
    [y + 0.63, y + 2.62, 'low'],
    [y + 3.54, y + 5.33, 'low'],
    [y + 6.55, y + 8.36, 'low'],
    [y + 9.45, y + 11.27, 'low'],
  ];
  const short = upper.slice(0, 2);
  const tallEnd = l * 0.208,
    brokenStart = l * 0.405,
    wing = l * 0.547;
  const lower = [[y + 0.23, y + 1.52, 'low']];
  bays(out, front, 0, tallEnd, y - 0.66, y + 12.21, upper, detail, { step: 4.37 });
  bays(out, front, tallEnd, brokenStart, y - 0.66, y + 6.44, short, detail, { step: 4.18 });
  bays(out, front, brokenStart, wing, y - 0.66, y + 2.66, lower, detail, {
    step: 3.62,
    color: terra,
  });
  bays(out, front, wing, l, y - 0.66, y + 7.98, short, detail, { step: 4.83 });
  for (const f of n) {
    if (
      f.length > l - 0.05 &&
      Math.hypot(f.origin[0] - front.origin[0], f.origin[1] - front.origin[1]) < 0.02
    )
      continue;
    const midpoint = at(f, f.length * 0.5, 0);
    const u =
      (midpoint[0] - front.origin[0]) * front.along[0] +
      (midpoint[1] - front.origin[1]) * front.along[1];
    const high = u < 22;
    const eaves = y + (high ? 12.21 : 7.98);
    if (f.length < 2.58) {
      fbox(out, 'brick', f, 0, f.length, y - 0.57, eaves, -0.66, 0, brick);
      continue;
    }
    bays(out, f, 0, f.length, y - 0.66, eaves, high ? upper : short, detail, {
      step: 4.4,
      color: terra,
    });
    if (f.length < 25) {
      const a = f.length * 0.01,
        b = f.length * 0.99,
        m = f.length / 2;
      const z = eaves + (high ? 1.61 : 2.68);
      tri(out, 'brick', f.P(a, eaves), f.P(b, eaves), f.P(m, z), brick);
      tri(out, 'brick', f.P(b, eaves, -0.66), f.P(a, eaves, -0.66), f.P(m, z, -0.66), terra);
      quad4(out, 'ashlar', f.P(a, eaves), f.P(m, z), f.P(m, z, -0.66), f.P(a, eaves, -0.66), pale);
      quad4(out, 'ashlar', f.P(m, z), f.P(b, eaves), f.P(b, eaves, -0.66), f.P(m, z, -0.66), pale);
    }
  }
  for (const [u, h] of [
    [tallEnd - 0.67, 13.42],
    [wing + 0.47, 13.2],
    [l * 0.735, 14.5],
  ]) {
    chimney(out, front, u, -0.91, y + 0.12, y + h, 0.55);
  }
  const floor = plan(front, 0.79, -12.75, l - 0.63, -0.64);
  cap(out, 'paving', floor, y + 0.11, stone);
}

function pinnacles(out, r, y, top, detail) {
  for (const p of r) {
    const n = detail === 0 ? 4 : 6;
    const profile =
      detail === 0
        ? [
            [y - 0.17, 0.43, 0.43],
            [top, 0.048, 0.048],
          ]
        : [
            [y - 0.36, 0.43, 0.43],
            [y + 0.38, 0.47, 0.47],
            [y + 0.68, 0.42, 0.42],
            [top, 0.048, 0.048],
          ];
    lathe(out, 'sandstone', p, profile, n, sand, { rotation: Math.PI / 4 });
  }
}

function church(out, { outline, grade: y }, detail) {
  const ring = outwardRing(outline);
  const start = outline[0],
    end = outline[6];
  const f = facade(center([outline[0], outline.at(-1)]), [end[0] - start[0], end[1] - start[1]]);
  const roof = y + 8.95;
  for (const [i, F] of faces(ring).entries()) {
    const z = roof + (i % 3 === 0 ? 0.26 : 0);
    if (F.length < 3.45) fbox(out, 'sandstone', F, 0, F.length, y - 0.82, z, -0.76, 0, sand);
    else
      bays(out, F, 0, F.length, y - 0.82, z, [[y + 1.96, y + 5.89, 'pointed']], detail, {
        slot: 'sandstone',
        color: i % 3 === 0 ? pale : sand,
        step: 4.03,
        t: 0.76,
      });
  }
  const front = wallFace(outline.at(-1), outline[0]);
  tri(
    out,
    'sandstone',
    front.P(0, roof),
    front.P(front.length, roof),
    front.P(front.length / 2, y + 13.44),
    sand,
  );
  tri(
    out,
    'sandstone',
    front.P(front.length, roof, -0.76),
    front.P(0, roof, -0.76),
    front.P(front.length / 2, y + 13.44, -0.76),
    pale,
  );
  pinnacles(out, [outline[2], outline[5], outline[8]], roof, y + 12.92, detail);
  const tower = plan(f, 0.57, -3.71, 7.56, 3.71);
  const upper = y + 15.98;
  for (const F of faces(tower)) {
    bays(out, F, 0, F.length, roof - 0.3, upper, [[y + 10.14, y + 13.71, 'pointed']], detail, {
      slot: 'sandstone',
      color: sand,
      step: 8.3,
      t: 0.75,
    });
    if (detail > 0) {
      for (let i = 0; i < 5; i++) {
        const P = (F.length * (i + 0.5)) / 5;
        fbox(out, 'ashlar', F, P - 0.29, P + 0.29, upper, upper + 0.47, -0.59, 0.04, pale);
      }
    }
  }
  pinnacles(out, tower, upper, y + 20.98, detail);
  cap(out, 'paving', ring, y + 0.07, stone);
}

function guard(out, { outline, grade: y }, detail) {
  const cylinder = outline.slice(4),
    c = center(cylinder),
    frame = wallFace(outline[2], outline[1]);
  const gate = facade(outline[2], frame.along);
  const platform = plan(gate, 0, -9.14, frame.length, 1.13),
    deck = y + 3.66;
  slab(out, 'sandstone', platform, y - 0.88, deck, sand);
  for (const x of [frame.length * 0.28, frame.length * 0.5, frame.length * 0.72]) {
    const plane = facade(at(gate, 0, 1.14), frame.along);
    opening(out, plane, x, y + 0.09, 1.69, 2.52, {
      head: 'round',
      glassSlot: 'shadow',
      glass: dark,
      frameSlot: 'ashlar',
      frame: pale,
      frameWidth: detail > 1 ? 0.17 : 0,
      frameDepth: 0.15,
      sill: false,
    });
  }
  const capHeight = y + 10.31;
  const n = [10, 14, 20, 32][detail];
  const profile =
    detail === 0
      ? [
          [deck, 3.97, 3.97],
          [capHeight - 0.66, 4.28, 4.28],
        ]
      : [
          [deck, 3.97, 3.97],
          [y + 8.98, 3.97, 3.97],
          [y + 9.33, 4.22, 4.22],
          [capHeight - 0.66, 4.28, 4.28],
        ];
  lathe(out, 'sandstone', c, profile, n, sand);
  const upper = facade([c[0] + gate.normal[0] * 3.94, c[1] + gate.normal[1] * 3.94], gate.along);
  opening(out, upper, 0, deck + 0.11, 1.85, 3.36, {
    head: 'round',
    glassSlot: 'shadow',
    glass: dark,
    frameSlot: 'ashlar',
    frame: pale,
    frameWidth: detail > 1 ? 0.19 : 0,
    frameDepth: 0.19,
    sill: false,
  });
  const base = deck + 3.47;
  tri(
    out,
    'ashlar',
    upper.P(-1.2, base, 0.29),
    upper.P(1.2, base, 0.29),
    upper.P(0, base + 0.75, 0.29),
    pale,
  );
  const teeth = detail === 0 ? 9 : 14;
  for (let i = 0; i < teeth; i++) {
    const theta = (2 * Math.PI * i) / teeth,
      a = [Math.cos(theta), Math.sin(theta)];
    const f = facade([c[0] + 4.18 * a[0], c[1] + 4.18 * a[1]], [a[1], -a[0]]);
    fbox(out, 'ashlar', f, -0.4, 0.4, capHeight - 0.67, capHeight + 0.19, -0.55, 0.085, pale);
  }
  for (let i = 0; i < [4, 6, 9, 12][detail]; i++) {
    const n = [4, 6, 9, 12][detail],
      bottom = y + (3.66 * i) / n;
    fbox(
      out,
      'paving',
      gate,
      frame.length - 0.82,
      frame.length + 1.19,
      bottom - 0.26,
      bottom + 3.66 / n,
      -2.48 - 0.22 * i,
      -1.27 - 0.22 * i,
      stone,
    );
  }
}

function hospital(out, { outline, grade: y }, detail) {
  const ring = outwardRing(outline);
  const front = wallFace(outline.at(-1), outline[0]),
    l = front.length;
  const lower = y + 4.91;
  bays(out, front, 0, l, y - 0.63, lower, [[y + 0.13, y + 2.87, 'round']], detail, {
    slot: 'sandstone',
    color: pale,
    step: l / 3,
    t: 0.78,
  });
  for (const [u, top] of [
    [0.54, y + 9.32],
    [l - 0.67, y + 8.18],
  ]) {
    fbox(out, 'sandstone', front, u - 0.53, u + 0.53, y - 0.74, top, -1.02, 0.095, sand);
    fbox(out, 'ashlar', front, u - 0.62, u + 0.62, top - 0.13, top + 0.13, -1.13, 0.12, dark);
  }
  for (const [i, f] of faces(ring).entries()) {
    if (Math.abs(f.length - l) < 0.02) continue;
    const end = y + 2.31 + (i % 4) * 0.83;
    if (f.length > 4.9 && i % 2)
      bays(out, f, 0, f.length, y - 0.43, end, [[y + 0.61, y + 1.78, 'low']], detail, {
        step: 4.2,
        color: terra,
      });
    else fbox(out, 'brick', f, 0, f.length, y - 0.54, end, -0.62, 0, terra);
  }
  for (const [u, d, h] of [
    [l * 0.31, -3.6, y + 7.89],
    [l * 0.64, -4.04, y + 7.84],
  ])
    chimney(out, front, u, d, y + 0.07, h, 0.48);
}

function build(out, detail) {
  const [a, b, c, d] = site.parts;
  penitentiary(out, a, detail);
  church(out, b, detail);
  guard(out, c, detail);
  hospital(out, d, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
