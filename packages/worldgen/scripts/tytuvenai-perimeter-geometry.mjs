/** The registered wall, gateway and exposed masonry around Tytuvėnai Monastery. */
import {
  arch,
  edge,
  face,
  pairs,
  palette,
  panel,
  trimBlock,
} from './montreal-museum-pavilion-geometry.mjs';
import { churchModel } from './tytuvenai-ensemble-geometry.mjs';

const c = palette({
  brick: 'a26b55',
  dark: '856451',
  stone: 'a29480',
  plaster: 'd7c7ac',
  trim: 'cbbaa0',
  tile: '9a5e49',
});

function wallSpan(out, w, a, b, baseA, baseB, hA, hB, thick, coping) {
  const offset = thick / 2;
  const lowA = baseA - 0.24,
    lowB = baseB - 0.24;
  const highA = baseA + hA,
    highB = baseB + hB;
  for (const side of [-1, 1]) {
    const d = offset * side;
    const normal = w.normal.map((n) => n * side);
    face(
      out,
      'stone',
      [w.p(a, lowA, d), w.p(b, lowB, d), w.p(b, baseB + 0.19, d), w.p(a, baseA + 0.19, d)],
      normal,
      c.stone,
    );
    face(
      out,
      'brick',
      [w.p(a, baseA + 0.19, d), w.p(b, baseB + 0.19, d), w.p(b, highB, d), w.p(a, highA, d)],
      normal,
      c.brick,
    );
    if (coping)
      face(
        out,
        'tile',
        [
          w.p(a, highA, -d * 1.14),
          w.p(b, highB, -d * 1.14),
          w.p(b, highB + 0.24),
          w.p(a, highA + 0.24),
        ],
        [0, 1, 0],
        c.tile,
      );
  }
  if (!coping)
    face(
      out,
      'brick',
      [
        w.p(a, highA, -offset),
        w.p(b, highB, -offset),
        w.p(b, highB, offset),
        w.p(a, highA, offset),
      ],
      [0, 1, 0],
      c.dark,
    );
  const n = [w.normal[2], 0, -w.normal[0]];
  for (const [u, low, high, side] of [
    [a, lowA, highA, -1],
    [b, lowB, highB, 1],
  ])
    face(
      out,
      'brick',
      [w.p(u, low, -offset), w.p(u, low, offset), w.p(u, high, offset), w.p(u, high, -offset)],
      n.map((v) => v * side),
      c.dark,
    );
}

function arcPassage(out, lod, w, u, radius, floor, spring, rise, cap, thick) {
  const n = [4, 6, 8, 12][lod],
    offset = thick / 2;
  const point = (i) => {
    const angle = (Math.PI * i) / n;
    return [u - radius * Math.cos(angle), spring + rise * Math.sin(angle)];
  };
  for (let i = 0; i < n; i++) {
    const [a, y] = point(i),
      [b, z] = point(i + 1);
    for (const side of [-1, 1]) {
      const d = side * offset,
        normal = w.normal.map((x) => x * side);
      face(
        out,
        'plaster',
        [w.p(a, y, d), w.p(b, z, d), w.p(b, cap, d), w.p(a, cap, d)],
        normal,
        c.plaster,
      );
      if (lod > 1)
        face(
          out,
          'plaster',
          [
            w.p(a, y, d + side * 0.034),
            w.p(b, z, d + side * 0.034),
            w.p(b, z + 0.13, d + side * 0.034),
            w.p(a, y + 0.13, d + side * 0.034),
          ],
          normal,
          c.trim,
        );
    }
    face(
      out,
      'plaster',
      [w.p(a, y, -offset), w.p(b, z, -offset), w.p(b, z, offset), w.p(a, y, offset)],
      [0, -1, 0],
      c.trim,
    );
  }
  const side = [w.normal[2], 0, -w.normal[0]];
  for (const s of [-1, 1]) {
    const v = u + s * radius;
    face(
      out,
      'plaster',
      [
        w.p(v, floor, -offset),
        w.p(v, floor, offset),
        w.p(v, spring, offset),
        w.p(v, spring, -offset),
      ],
      side.map((n) => n * s),
      c.trim,
    );
  }
}

function gate(out, lod, w, grade, height, thickness) {
  const main = 11.48,
    wicket = 7.97;
  const base = grade(w.p(main, 0).filter((_, i) => i !== 1));
  const cap = base + 3.25;
  const gateWest = 6.98,
    gateEast = 13.52;
  const poleRanges = [
    [gateWest, wicket - 0.49],
    [wicket + 0.49, main - 1.44],
    [main + 1.44, gateEast],
  ];
  for (const [left, right] of poleRanges) {
    const h = left === gateWest ? 2.39 : 3.25;
    wallSpan(out, w, left, right, base, base, h, h, thickness + 0.12, false);
    panel(out, 'plaster', w, left, right, base + 0.15, base + h, thickness / 2 + 0.09, c.plaster);
  }
  arcPassage(out, lod, w, main, 1.44, base, base + 2.16, 0.46, cap, thickness + 0.12);
  arcPassage(out, lod, w, wicket, 0.49, base, base + 1.74, 0.22, base + 2.39, thickness + 0.12);
  const d = thickness / 2 + 0.093;
  for (const side of [-1, 1]) {
    const n = w.normal.map((v) => v * side);
    face(
      out,
      'plaster',
      [w.p(9.34, cap, d * side), w.p(13.61, cap, d * side), w.p(main, cap + 0.76, d * side)],
      n,
      c.plaster,
    );
  }
  face(
    out,
    'tile',
    [w.p(9.34, cap, -d), w.p(9.34, cap, d), w.p(main, cap + 0.76, d), w.p(main, cap + 0.76, -d)],
    [0, 1, 0],
    c.tile,
  );
  face(
    out,
    'tile',
    [w.p(main, cap + 0.76, -d), w.p(main, cap + 0.76, d), w.p(13.61, cap, d), w.p(13.61, cap, -d)],
    [0, 1, 0],
    c.tile,
  );
  panel(out, 'plaster', w, 9.27, 13.68, cap - 0.2, cap, thickness / 2 + 0.13, c.trim);
  if (lod > 0) {
    for (const p of [9.55, 9.77, 13.04, 13.26])
      trimBlock(
        out,
        'plaster',
        w,
        p,
        p + 0.17,
        base + 0.28,
        cap - 0.21,
        thickness / 2 + 0.07,
        thickness / 2 + 0.18,
        c.trim,
      );
  }
  for (const [left, right] of [
    [0, gateWest],
    [gateEast, w.length],
  ]) {
    const at = (u) => {
      const [x, , z] = w.p(u, 0);
      return grade([x, z]);
    };
    wallSpan(out, w, left, right, at(left), at(right), height, height, thickness, true);
  }
}

function wallRemains(out, lod, w, grade, height, thick, run, lower) {
  const pieces = [2, 3, 5, 8][lod],
    step = w.length / pieces;
  for (let i = 0; i < pieces; i++) {
    const a = i * step,
      b = (i + 1) * step;
    const g = (u) => {
      const [x, , z] = w.p(u, 0);
      return grade([x, z]);
    };
    const high = (t) =>
      lower
        ? Math.max(0.21, height * (0.73 + 0.24 * Math.sin((t + 0.2 * run) * Math.PI * 3)))
        : Math.max(0.42, height * (0.74 + 0.38 * Math.sin((t + 0.3 * run) * Math.PI * 1.7)));
    const h = high((i + 0.5) / pieces);
    wallSpan(out, w, a, b, g(a), g(b), h, h, thick, false);
  }
  const x = w.length * 0.47;
  const [gx, , gz] = w.p(x, 0),
    floor = grade([gx, gz]);
  if (lower)
    panel(
      out,
      'plaster',
      w,
      x - 0.22,
      x + 0.16,
      floor + 0.2,
      floor + 0.27,
      thick / 2 + 0.022,
      c.trim,
    );
  else if (lod > 0)
    arch(
      out,
      w,
      x,
      floor + 0.25,
      floor + 0.65,
      0.38,
      0.14,
      thick / 2 + 0.019,
      lod,
      { inner: c.dark, trim: c.trim, width: 0.065 },
      { inner: 'brick', trim: 'plaster' },
    );
  else
    panel(
      out,
      'plaster',
      w,
      x - 0.22,
      x + 0.22,
      floor + 0.25,
      floor + 0.58,
      thick / 2 + 0.012,
      c.trim,
    );
}

function draw(out, lod, { lines, kind, height, thickness, gateRun }, grade) {
  const standing = kind === 'standing-wall-and-gate',
    lower = kind === 'surviving-masonry';
  for (const [run, line] of lines.entries()) {
    for (const [i, [a, b]] of pairs(line).entries()) {
      const w = edge(a, b);
      if (standing) {
        if (i === gateRun) gate(out, lod, w, grade, height, thickness);
        else wallSpan(out, w, 0, w.length, grade(a), grade(b), height, height, thickness, true);
      } else wallRemains(out, lod, w, grade, height, thickness, run + i, lower);
    }
  }
}

export function perimeterModel(url, config) {
  const slots = config.standing
    ? ['brick', 'stone', 'plaster', 'tile']
    : ['brick', 'stone', 'plaster'];
  const asset = churchModel(url, { ...config, slots }, draw);
  asset.model.category = 'landmark';
  asset.model.sourceLicense =
    'Independent reconstruction from the written Lithuanian heritage register, mapped location controls and open terrain tiles.';
  asset.model.recipeDependencies.push('tytuvenai-perimeter-geometry.mjs');
  return asset;
}
