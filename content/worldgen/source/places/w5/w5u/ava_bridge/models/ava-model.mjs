/** Ava Bridge in its photographed intact 2010 state. Photo-led exterior, not an engineering survey. */
import {
  beam,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const avaControls = {
  originMeters: 62,
  waterY: 0.601600646972656,
  halfLength: 606.3854712625238,
  mappedHalfLength: 604.8854712625238,
  nominalHalfLength: 564,
  mainHalfLength: 483,
  spans: 9,
  halfWidth: 6.4,
  trussZ: 2.4,
  profile: [
    [-604.8854712625238, 15.12],
    [-564, 17.7],
    [-483, 19],
    [483, 19.7],
    [564, 19.75],
    [604.8854712625238, 20.62],
  ],
};
export const avaSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  masonry: { slot: 'wall', graph: 'brick', roughness: 0.97, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 1, metallic: 0 },
};
const C = avaControls;
const linear = (hex) =>
  hex.match(/../g).map((h) => {
    const s = Number.parseInt(h, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  steel: linear('dedbd0'),
  dark: linear('657071'),
  brick: linear('b76a4d'),
  footing: linear('c8b28c'),
  concrete: linear('c2bfb2'),
  road: linear('666764'),
  sleeper: linear('897961'),
};
function baseDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const [a, y] = C.profile[i - 1],
      [b, z] = C.profile[i];
    if (x <= b) return y + Math.max(0, Math.min(1, (x - a) / (b - a))) * (z - y);
  }
  return C.profile.at(-1)[1];
}
// Only the final bank aprons follow present-day native paving/ground. The main historical
// crossing keeps its photo-led grade. These source controls avoid burying the landing in
// the coarse DEM without moving the map or claiming a surveyed 2010 bank reconstruction.
const bankZ = [-6.4, -5.8, -4, 0, 4, 5.8, 6.4];
export const avaBankHeights = [
  [16.67, 16.648988, 16.590097, 16.413864, 16.142141, 15.781186, 15.76],
  [19.84, 19.93174, 20.196533, 21.068238, 21.353684, 21.518751, 21.56],
];
const bankBlend = (x) =>
  Math.max(0, Math.min(1, (Math.abs(x) - 590) / (C.mappedHalfLength + 0.1 - 590)));
function bankHeight(x, z) {
  const values = avaBankHeights[x < 0 ? 0 : 1];
  for (let i = 1; i < bankZ.length; i++)
    if (z <= bankZ[i]) {
      const t = Math.max(0, Math.min(1, (z - bankZ[i - 1]) / (bankZ[i] - bankZ[i - 1])));
      return values[i - 1] * (1 - t) + values[i] * t;
    }
  return values.at(-1);
}
export function avaDeckHeight(x, z = 0, coarse = false) {
  const t = bankBlend(x),
    base = baseDeckY(Math.sign(x) * Math.min(Math.abs(x), 590));
  const end = coarse
    ? z < 0
      ? bankHeight(x, -6.4) * (-z / 6.4) + bankHeight(x, 0) * (1 + z / 6.4)
      : bankHeight(x, 0) * (1 - z / 6.4) + (bankHeight(x, 6.4) * z) / 6.4
    : bankHeight(x, z);
  return base * (1 - t) + end * t;
}
export const avaDeckY = (x) => avaDeckHeight(x, 0);
export const avaWalkOffset = (x) => 0.16 * (1 - bankBlend(x));
export const avaPierStations = () =>
  Array.from({ length: C.spans + 1 }, (_, i) => -483 + (i * 966) / C.spans);
export function avaTrussRise(t) {
  const points = [
    [0, 0.6],
    [0.1, 10.7],
    [0.2, 13.2],
    [0.4, 15.3],
    [0.5, 15.6],
    [0.6, 15.3],
    [0.8, 13.2],
    [0.9, 10.7],
    [1, 0.6],
  ];
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, z] = points[i];
    if (t <= b) return y + ((z - y) * (t - a)) / (b - a);
  }
  return 0.6;
}
function writer(out, far) {
  function emit(slot, _ref, p, hint, _uv, tint) {
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) t = [t[0], t[2], t[1]];
      const area = cross(
        t[1].map((v, j) => v - t[0][j]),
        t[2].map((v, j) => v - t[0][j]),
      );
      if (Math.hypot(...area) < 1e-9) continue;
      out.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        far ? tint.map((v) => v * 0.65) : tint,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
/** A solid-sided, open-web truss card: keeps a broad silhouette without subpixel depth. */
function card(out, a, b, width, color) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  let across = normalize(cross(axis, [0, 0, 1]));
  if (Math.hypot(...across) < 0.1) across = [1, 0, 0];
  const points = [
    a.map((v, i) => v - (across[i] * width) / 2),
    b.map((v, i) => v - (across[i] * width) / 2),
    b.map((v, i) => v + (across[i] * width) / 2),
    a.map((v, i) => v + (across[i] * width) / 2),
  ];
  for (const ring of [points, [...points].reverse()])
    out.addQuad(
      'steel',
      'palette:#ffffff',
      ring,
      normalFor(...ring),
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      color,
    );
}
function section(out, a, b, width, depth, color, flanged) {
  if (!flanged) return beam(out, 'steel', a, b, width, depth, color);
  const axis = normalize(b.map((v, i) => v - a[i])),
    across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    other = cross(axis, across);
  beam(out, 'steel', a, b, width * 0.24, depth * 0.78, color);
  for (const sign of [-1, 1])
    beam(
      out,
      'steel',
      a.map((v, i) => v + sign * other[i] * depth * 0.44),
      b.map((v, i) => v + sign * other[i] * depth * 0.44),
      width,
      depth * 0.12,
      color,
    );
}
function deck(out, a, b, z0, z1, offset, depth, color, coarse = false) {
  const ya = avaDeckHeight(a, z0, coarse) + offset * (1 - bankBlend(a)),
    yb = avaDeckHeight(b, z0, coarse) + offset * (1 - bankBlend(b)),
    yc = avaDeckHeight(a, z1, coarse) + offset * (1 - bankBlend(a)),
    yd = avaDeckHeight(b, z1, coarse) + offset * (1 - bankBlend(b));
  loft(
    out,
    'concrete',
    [
      [
        [a, ya - depth, z0],
        [a, ya, z0],
        [a, yc, z1],
        [a, yc - depth, z1],
      ],
      [
        [b, yb - depth, z0],
        [b, yb, z0],
        [b, yd, z1],
        [b, yd - depth, z1],
      ],
    ],
    color,
  );
}
function pier(out, x, far) {
  const top = avaDeckY(x) - 1.2;
  if (far) {
    box(out, 'concrete', [x - 2.7, -0.4, -4.7], [x + 2.7, 5, 4.7], colors.footing);
    box(out, 'masonry', [x - 2.1, 5, -4], [x + 2.1, top, 4], colors.brick);
    return;
  }
  loft(
    out,
    'concrete',
    [chamferedRectangle(x, -0.4, 0, 6.7, 10.4, 1.8), chamferedRectangle(x, 4.6, 0, 6, 9.8, 1.65)],
    colors.footing,
  );
  loft(
    out,
    'masonry',
    [
      chamferedRectangle(x, 4.6, 0, 5.8, 9.5, 1.5),
      chamferedRectangle(x, top - 0.4, 0, 4.9, 8.5, 1.4),
    ],
    colors.brick,
  );
  for (const y of [5, 10.6, top - 0.2])
    loft(
      out,
      'masonry',
      [
        chamferedRectangle(x, y - 0.13, 0, 6, 9.7, 1.6),
        chamferedRectangle(x, y + 0.13, 0, 6, 9.7, 1.6),
      ],
      colors.brick,
    );
  box(out, 'concrete', [x - 3.1, top, -5.1], [x + 3.1, top + 0.32, 5.1], colors.concrete);
  for (const side of [-1, 1])
    box(
      out,
      'steel',
      [x - 0.7, top + 0.32, side * C.trussZ - 0.6],
      [x + 0.7, top + 0.74, side * C.trussZ + 0.6],
      colors.dark,
    );
}
export function buildAvaLevel(out, level = 'master') {
  const far = level === 'skyline',
    district = level === 'district',
    near = !far && !district,
    close = level === 'closeup' || level === 'master',
    master = level === 'master';
  const o = writer(out, far),
    stations = avaPierStations(),
    cuts = [
      ...new Set([
        -C.halfLength,
        -C.mappedHalfLength - 0.1,
        -590,
        -564,
        ...stations,
        564,
        590,
        C.mappedHalfLength + 0.1,
        C.halfLength,
      ]),
    ].sort((a, b) => a - b);
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i];
    const zs =
      Math.abs(a) >= 564 || Math.abs(b) >= 564
        ? far || district
          ? [-6.4, 0, 6.4]
          : bankZ
        : [-6.4, 6.4];
    for (let j = 1; j < zs.length; j++)
      deck(o, a, b, zs[j - 1], zs[j], 0, 0.6, colors.road, far || district);
    if (!far)
      for (const side of [-1, 1]) {
        deck(o, a, b, side < 0 ? -6.4 : 5.45, side < 0 ? -5.45 : 6.4, 0.16, 0.22, colors.concrete);
        section(
          o,
          [a, avaDeckY(a) - 0.76, side * 2.4],
          [b, avaDeckY(b) - 0.76, side * 2.4],
          0.5,
          1.1,
          colors.dark,
          close,
        );
      }
  }
  for (const x of stations) pier(o, x, far || district);
  if (!far)
    for (const x of [-564, -537, -510, 510, 537, 564]) {
      const y = avaDeckY(x) - 0.6;
      box(
        o,
        'masonry',
        [x - 1.6, Math.max(-0.3, 7 + Math.abs(x) * 0.012), -4.2],
        [x + 1.6, y, 4.2],
        colors.brick,
      );
    }
  for (let span = 0; span < C.spans; span++) {
    const a = stations[span] + 0.7,
      b = stations[span + 1] - 0.7,
      n = far ? 4 : district ? 6 : 10;
    const point = (i, side, top) => {
      const t = i / n,
        x = a + (b - a) * t;
      return [x, avaDeckY(x) + (top ? avaTrussRise(t) : 0.65), side * C.trussZ];
    };
    for (const side of [-1, 1]) {
      const member = (p, q, w, d) =>
        far || district
          ? card(o, p, q, far ? Math.max(w, 0.85) : Math.max(w, 0.46), colors.steel)
          : section(o, p, q, w, d, colors.steel, close);
      member(point(0, side, false), point(n, side, false), 0.42, 0.62);
      for (let i = 0; i < n; i++) {
        member(point(i, side, true), point(i + 1, side, true), 0.48, 0.62);
        if (!far || i === 1) member(point(i, side, false), point(i + 1, side, true), 0.28, 0.38);
        if (!far && i > 0) member(point(i, side, false), point(i, side, true), 0.26, 0.38);
        if (near && i > 0 && i < n - 1 && (close || i === 4))
          member(point(i, side, true), point(i + 1, side, false), 0.2, 0.3);
      }
      if (close)
        for (let i = 1; i < n; i++) {
          const [x, y, z] = point(i, side, true);
          box(
            o,
            'steel',
            [x - 0.55, y - 0.42, z - 0.11],
            [x + 0.55, y + 0.42, z + 0.11],
            colors.steel,
          );
          if (master)
            for (const dx of [-0.32, 0, 0.32])
              for (const dy of [-0.23, 0.23])
                box(
                  o,
                  'steel',
                  [x + dx - 0.055, y + dy - 0.055, z + side * 0.14 - 0.035],
                  [x + dx + 0.055, y + dy + 0.055, z + side * 0.14 + 0.035],
                  colors.dark,
                );
        }
    }
    if (!far)
      for (let i = 1; i < n; i++) {
        const l = point(i, -1, true),
          r = point(i, 1, true);
        if (district) {
          if (i % 2 === 0) beam(o, 'steel', l, r, 0.27, 0.3, colors.steel);
        } else {
          section(o, l, r, 0.28, 0.42, colors.steel, close);
          const x = l[0],
            y = avaDeckY(x) - 0.72;
          beam(o, 'steel', [x, y, -6.4], [x, y, 6.4], 0.32, 0.38, colors.dark);
          if (close && i < n - 1) {
            beam(o, 'steel', l, point(i + 1, 1, true), 0.13, 0.16, colors.steel);
            beam(o, 'steel', r, point(i + 1, -1, true), 0.13, 0.16, colors.steel);
          }
        }
      }
  }
  if (!far)
    for (const side of [-1, 1]) {
      for (let i = 1; i < cuts.length; i++) {
        const a = cuts[i - 1],
          b = cuts[i],
          z = side * 6.25;
        for (const y of near ? [0.6, 1.32] : [1.32])
          beam(
            o,
            'steel',
            [a, avaDeckHeight(a, z, district) + y, z],
            [b, avaDeckHeight(b, z, district) + y, z],
            district ? 0.2 : 0.09,
            district ? 0.2 : 0.09,
            colors.steel,
          );
        // The rails and the central track remain separate geometry from the road decks.
        beam(
          o,
          'steel',
          [a, avaDeckY(a) + 0.12, side * 0.5],
          [b, avaDeckY(b) + 0.12, side * 0.5],
          district ? 0.18 : 0.075,
          0.12,
          colors.dark,
        );
      }
      if (near) {
        const spacing = close ? 2.9 : 10.5;
        for (let x = -C.halfLength; x < C.halfLength; x += spacing)
          beam(
            o,
            'steel',
            [x, avaDeckHeight(x, side * 6.25) + avaWalkOffset(x), side * 6.25],
            [x, avaDeckHeight(x, side * 6.25) + 1.32, side * 6.25],
            0.08,
            0.08,
            colors.steel,
          );
      }
    }
  if (close)
    for (let x = -C.halfLength + 0.6; x < C.halfLength; x += master ? 0.8 : 2.4)
      box(
        o,
        'concrete',
        [x - 0.12, avaDeckY(x) + 0.015, -1.15],
        [x + 0.12, avaDeckY(x) + 0.07, 1.15],
        colors.sleeper,
      );
}
export const buildAvaSkyline = (out) => buildAvaLevel(out, 'skyline');
export const buildAvaDistrict = (out) => buildAvaLevel(out, 'district');
export const buildAvaStreet = (out) => buildAvaLevel(out, 'street');
export const buildAvaCloseup = (out) => buildAvaLevel(out, 'closeup');
