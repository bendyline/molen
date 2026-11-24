import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98 },
  cutStone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  aperture: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.98 },
};
const dusty = rgb('aa8d71'),
  terra = rgb('9c7a66'),
  gray = rgb('958b76'),
  umber = rgb('887263');
const raw = rgb('a08363'),
  bottom = rgb('847054'),
  pale = rgb('b09478'),
  dark = rgb('554940');
const floor = site.cutFloor;
const ring = outwardRing(site.outline.filter((_, i) => i !== 10));
const center = ring.reduce(([a, b], [x, z]) => [a + x / ring.length, b + z / ring.length], [0, 0]);
const scaled = (s, y) =>
  ring.map(([x, z]) => [center[0] + s * (x - center[0]), y, center[1] + s * (z - center[1])]);

function face(out, slot, f, a, b, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function recess(out, detail, f, u, w, y0, y1, arch) {
  const left = u - w / 2,
    right = u + w / 2,
    height = arch ? w * 0.6 : 0,
    d = -0.49;
  const p = f.P;
  face(out, 'aperture', f, left, right, y0, y1 - height, d, dark);
  quad4(
    out,
    'cutStone',
    p(right, y0, 0),
    p(right, y0, d),
    p(right, y1 - height, d),
    p(right, y1 - height, 0),
    umber,
  );
  quad4(
    out,
    'cutStone',
    p(left, y0, d),
    p(left, y0, 0),
    p(left, y1 - height, 0),
    p(left, y1 - height, d),
    umber,
  );
  quad4(out, 'cutStone', p(left, y0, 0), p(right, y0, 0), p(right, y0, d), p(left, y0, d), gray);
  if (!arch) {
    quad4(out, 'cutStone', p(left, y1, d), p(right, y1, d), p(right, y1, 0), p(left, y1, 0), umber);
    return;
  }
  const arc = pointedArch(w / 2, height, [3, 4, 6, 9][detail]);
  for (let i = 1; i < arc.length; i++) {
    const [a, b] = arc[i - 1],
      [c, h] = arc[i];
    const y = y1 - height + b,
      H = y1 - height + h;
    quad4(
      out,
      'rock',
      p(u + a, y, 0),
      p(u + c, H, 0),
      p(u + c, y1 + 0.09, 0),
      p(u + a, y1 + 0.09, 0),
      terra,
    );
    quad4(out, 'cutStone', p(u + a, y, d), p(u + c, H, d), p(u + c, H, 0), p(u + a, y, 0), gray);
    quad4(
      out,
      'aperture',
      p(u + a, y1 - height - 0.002, d),
      p(u + c, y1 - height - 0.002, d),
      p(u + c, H + 0.005, d),
      p(u + a, y + 0.005, d),
      dark,
    );
    if (detail > 0)
      beam(
        out,
        'cutStone',
        p(u + a * 1.136, y + 0.17, 0.1),
        p(u + c * 1.136, H + 0.17, 0.1),
        0.104,
        0.095,
        pale,
      );
  }
}

function churchSide(out, detail, f) {
  const v = site.gate.map((p, i) => p - f.origin[i]);
  const u = v[0] * f.along[0] + v[1] * f.along[1],
    d = v[0] * f.normal[0] + v[1] * f.normal[1];
  const door = Math.abs(d) < 0.045 && u > 1 && u < f.length - 1;
  const decor = f.length > 4.47;
  const yBottom = -10.78,
    yTop = -0.32;
  const holes = [];
  if (door) holes.push({ u, w: 1.37, y0: yBottom, y1: -8.29, arch: false });
  if (decor) {
    holes.push({ u: f.length / 2, w: 1.12, y0: -4.8, y1: -2.81, arch: true });
    if (detail > 1)
      holes.push({ u: f.length / 2 - 0.1, w: 0.68, y0: -7.45, y1: -6.37, arch: false });
  } else if (detail > 0 && f.length > 2.8)
    holes.push({ u: f.length / 2, w: 0.75, y0: -4.54, y1: -3.08, arch: true });
  holes.sort((a, b) => a.y0 - b.y0);
  let y = yBottom;
  for (const h of holes) {
    if (h.y0 > y + 0.004) face(out, 'rock', f, 0, f.length, y, h.y0, 0, terra);
    const top = h.y1 + (h.arch ? 0.09 : 0);
    face(out, 'rock', f, 0, h.u - h.w / 2, h.y0, top, 0, terra);
    face(out, 'rock', f, h.u + h.w / 2, f.length, h.y0, top, 0, terra);
    recess(out, detail, f, h.u, h.w, h.y0, h.y1, h.arch);
    if (detail > 1) {
      for (const a of [h.u - h.w / 2 - 0.16, h.u + h.w / 2 + 0.16])
        fbox(
          out,
          'cutStone',
          f,
          a - 0.056,
          a + 0.056,
          h.y0 + 0.03,
          h.y1 - 0.11,
          -0.018,
          0.11,
          pale,
        );
      fbox(
        out,
        'cutStone',
        f,
        h.u - h.w * 0.7,
        h.u + h.w * 0.7,
        h.y0 - 0.105,
        h.y0,
        0.01,
        0.19,
        pale,
      );
    }
    y = top;
  }
  if (y < yTop) face(out, 'rock', f, 0, f.length, y, yTop, 0, terra);
  if (detail > 0 && decor)
    for (const y of [-9.93, -6.05, -5.63, -2.22, -1.18]) {
      const w = y === -1.18 ? 0.093 : 0.063;
      face(out, 'cutStone', f, 0, f.length, y, y + w, 0.034, gray);
    }
}

function monolith(out, detail) {
  const rings = [
    [-12.13, 1.113],
    [-11.59, 1.113],
    [-11.59, 1.069],
    [-11.07, 1.069],
    [-11.07, 1.037],
    [-10.78, 1.037],
    [-10.78, 1],
  ];
  const lower = detail === 0 ? [rings[0], rings[1], rings.at(-1)] : rings;
  loft(
    out,
    'cutStone',
    lower.map(([y, s]) => scaled(s, y)),
    dusty,
    { cap: false },
  );
  for (const [i, a] of ring.entries())
    churchSide(out, detail, wallFace(a, ring[(i + 1) % ring.length]));
  for (const [a, b, y0, y1] of [
    [1, 1.028, -0.34, -0.17],
    [1.028, 1.021, -0.17, 0.013],
  ])
    loft(out, 'cutStone', [scaled(a, y0), scaled(b, y1)], gray, { cap: false });
  const profile =
    detail === 0
      ? [
          [1.021, 0.013],
          [0.82, 0.013],
          [0.81, -0.177],
          [0.59, -0.177],
          [0.58, 0.02],
        ]
      : [
          [1.021, 0.013],
          [0.89, 0.013],
          [0.887, -0.132],
          [0.765, -0.132],
          [0.76, 0.013],
          [0.618, 0.013],
          [0.614, -0.183],
          [0.482, -0.183],
          [0.475, 0.013],
        ];
  for (let j = 1; j < profile.length; j++) {
    const [a, h] = profile[j - 1],
      [b, y] = profile[j];
    const outer = scaled(a, h),
      inner = scaled(b, y);
    for (let i = 0; i < ring.length; i++) {
      const k = (i + 1) % ring.length;
      quad4(out, 'cutStone', outer[i], outer[k], inner[k], inner[i], j % 3 === 2 ? umber : gray);
    }
  }
  const [s, h] = profile.at(-1);
  cap(
    out,
    'cutStone',
    scaled(s, h).map(([x, , z]) => [x, z]),
    h,
    gray,
  );
}

function rockCourt(out, detail) {
  const r = site.excavation;
  cap(out, 'rock', r, floor, bottom);
  for (const [i, a] of r.entries()) {
    const j = (i + 1) % r.length,
      f = wallFace(a, r[j]);
    const segmentCount = Math.max(3, Math.ceil(f.length / [12, 4.1, 2.83, 1.73][detail]));
    const offsets =
      detail === 0
        ? [0, f.length]
        : Array.from({ length: segmentCount + 1 }, (_, i) => (i * f.length) / segmentCount);
    const notch = i === 3 ? f.length - 1.12 : i === 4 ? 0.96 : undefined;
    if (notch !== undefined) offsets.push(notch);
    const stops = offsets.sort((a, b) => a - b);
    for (let k = 1; k < stops.length; k++) {
      const a = stops[k - 1],
        b = stops[k];
      if (b - a < 0.003) continue;
      const opening = (i === 3 && a >= notch - 0.001) || (i === 4 && b <= notch + 0.001);
      const start = opening ? floor + 2.59 : floor;
      const levels = detail === 0 ? [0, 1] : [0, 0.24, 0.49, 0.73, 1];
      const p = (u, t) => {
        const T = u / f.length;
        const high = site.rimHeights[i] + (site.rimHeights[j] - site.rimHeights[i]) * T;
        const shift =
          detail === 0 ? 0 : Math.sin(i * 1.7 + u * 1.31 + t * 4.28) * 0.26 * Math.sin(t * Math.PI);
        return f.P(u, start + (high - start) * t, t === 1 ? 0 : shift - 0.17 * (1 - t));
      };
      for (let h = 1; h < levels.length; h++)
        quad4(
          out,
          'rock',
          p(a, levels[h - 1]),
          p(b, levels[h - 1]),
          p(b, levels[h]),
          p(a, levels[h]),
          [raw, terra, gray, dusty][(h + i + k) % 4],
        );
    }
  }
}

function approach(out, detail) {
  const f = wallFace(...site.tunnel);
  const p = f.P;
  const w = 0.93;
  const y0 = floor + 0.03,
    y1 = floor + 0.82;
  quad4(
    out,
    'cutStone',
    p(f.length, y1, w),
    p(0, y0, w),
    p(0, y0, -w),
    p(f.length, y1, -w),
    bottom,
  );
  quad4(
    out,
    'rock',
    p(0, y0, w),
    p(f.length, y1, w),
    p(f.length, y1 + 2.33, w),
    p(0, y0 + 2.57, w),
    umber,
  );
  quad4(
    out,
    'rock',
    p(f.length, y1, -w),
    p(0, y0, -w),
    p(0, y0 + 2.57, -w),
    p(f.length, y1 + 2.33, -w),
    umber,
  );
  quad4(
    out,
    'rock',
    p(0, y0 + 2.57, -w),
    p(0, y0 + 2.57, w),
    p(f.length, y1 + 2.33, w),
    p(f.length, y1 + 2.33, -w),
    umber,
  );
  face(
    out,
    'aperture',
    facade(
      [p(f.length, 0, 0)[0], p(f.length, 0, 0)[2]],
      f.normal.map((n) => -n),
    ),
    -w,
    w,
    y1,
    y1 + 2.34,
    0,
    dark,
  );
  const step = wallFace(...site.steps),
    n = [4, 6, 9, 12][detail];
  for (let i = 0; i < n; i++) {
    const a = (i * step.length) / n,
      b = ((i + 1) * step.length) / n;
    fbox(
      out,
      'cutStone',
      step,
      a,
      b,
      floor - 0.05,
      floor + 0.17 + ((i + 1) * 1.18) / n,
      -0.78,
      0.78,
      i % 2 === 0 ? dusty : gray,
    );
  }
}

function build(out, detail) {
  rockCourt(out, detail);
  monolith(out, detail);
  approach(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
