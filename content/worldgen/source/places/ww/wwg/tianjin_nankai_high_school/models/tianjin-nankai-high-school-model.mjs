import {
  arch,
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  base: surface('foundation', 'stone_ashlar'),
  brick: surface('wall', 'brick'),
  timber: surface('wall', 'wood_painted_lap'),
  stone: surface('trim', 'stone_limestone_raw'),
  flat: surface('roof', 'concrete_plain'),
  tile: surface('roof', 'slate'),
  glass: surface('window', 'window_grid', 0.42, 0.1),
  door: surface('door', 'wood_vertical'),
};
const C = palette({
  footing: '898781',
  gray: '777b76',
  brick: 'a36d56',
  red: '975d48',
  edge: 'c8bd9f',
  sill: 'c2b9a6',
  dash: '73655a',
  roof: '71746d',
  ridge: '80837c',
  flat: 'a79f91',
  shadow: '555f57',
  dark: '484e4c',
  window: '67838a',
  timber: 'a28e73',
  wood: '746655',
  cream: 'ddd0af',
});
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (a) => {
  const n = Math.hypot(...a);
  return a.map((x) => x / n);
};
const midpoint = (a, b) => a.map((x, i) => (x + b[i]) * 0.5);
function walls(p) {
  const s = areaSign(p);
  return pairs(closed(p)).map(([a, b], i) => ({ a, b, i, w: edge(a, b, s) }));
}
function foundation(out, p, grade) {
  const y = Math.max(...p.map(grade)) + 0.16;
  shell(out, p, (q) => Math.min(grade(q) - 0.22, y - 0.28), y, { wall: 'base', color: C.footing });
  return y;
}
function solid(out, p, y, h, slot, color, roof = 'flat') {
  shell(out, p, () => y, h, { wall: slot, color, roof, roofColor: C.flat });
}
function patch(w, x0, x1, d0, d1) {
  return [
    [x0, d0],
    [x1, d0],
    [x1, d1],
    [x0, d1],
  ].map(([x, d]) => {
    const [a, , b] = w.p(x, 0, d);
    return [a, b];
  });
}
function hipped(out, outline, y, rise, axis, lod) {
  const n = unit(axis),
    side = [-n[1], n[0]],
    c = planarMid(outline);
  const interval = (basis) =>
    outline.reduce(
      ([min, max], p) => {
        const t = dot(delta(p, c), basis);
        return [Math.min(min, t), Math.max(max, t)];
      },
      [Infinity, -Infinity],
    );
  const [l, r] = interval(n),
    [f, b] = interval(side);
  const point = (x, z) => [c[0] + n[0] * x + side[0] * z, c[1] + n[1] * x + side[1] * z];
  const p = [
    point(l - 0.17, f - 0.2),
    point(r + 0.17, f - 0.2),
    point(r + 0.17, b + 0.2),
    point(l - 0.17, b + 0.2),
  ];
  const hip = Math.min((r - l) * 0.22, (b - f) * 0.54),
    m = (b + f) * 0.5;
  const a = at(point(l + hip, m), y + rise),
    d = at(point(r - hip, m), y + rise);
  for (const pts of [
    [at(p[0], y), at(p[1], y), d, a],
    [at(p[2], y), at(p[3], y), a, d],
    [at(p[1], y), at(p[2], y), d],
    [at(p[3], y), at(p[0], y), a],
  ])
    face(out, 'tile', pts, up, C.roof);
  if (lod > 0) {
    const q = point(l + hip, m),
      v = point(r - hip, m);
    const w = edge(q, v);
    trimBlock(
      out,
      'tile',
      w,
      0,
      w.length,
      y + rise - 0.018,
      y + rise + 0.108,
      -0.115,
      0.115,
      C.ridge,
    );
  }
}
function cornices(out, w, y, levels, lod) {
  if (lod === 0) return;
  for (const [h, thick, d] of levels)
    trimBlock(out, 'stone', w, 0, w.length, y + h, y + h + thick, 0.001, d, C.edge);
}
function window(out, w, x, y, width, h, lod, colored = false, upper = false) {
  const trim = colored ? C.edge : C.sill;
  if (upper && lod > 0)
    arch(
      out,
      w,
      x,
      y,
      y + h * 0.69,
      width * 0.5,
      h * 0.31,
      0.043,
      lod === 1 ? 0 : 2,
      { inner: C.window, trim, width: 0.105 },
      { inner: 'glass', trim: 'stone' },
    );
  else
    opening(
      out,
      w,
      x - width * 0.5,
      x + width * 0.5,
      y,
      y + h,
      'stone',
      C.window,
      'glass',
      trim,
      lod === 1 ? 0 : lod,
      0.049,
    );
  if (lod > 1) {
    panel(out, 'stone', w, x - 0.033, x + 0.033, y, y + h * 0.87, 0.085, C.shadow);
    panel(
      out,
      'stone',
      w,
      x - width * 0.5,
      x + width * 0.5,
      y + h * 0.55,
      y + h * 0.55 + 0.028,
      0.084,
      C.shadow,
    );
  }
}
function bayCenters(len, step, width) {
  const n = Math.max(1, Math.floor(len / step));
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * len) / n).filter(
    (x) => x > width * 0.5 + 0.22 && x < len - width * 0.5 - 0.22,
  );
}
function portal(out, w, center, y, lod, main) {
  const width = main ? 1.69 : 1.21,
    top = main ? 4.6 : 3.6,
    projection = main ? 1.12 : 0.43;
  const sill = patch(w, center - width - 0.54, center + width + 0.54, 0.034, projection);
  solid(out, sill, y, y + top, 'brick', C.gray);
  arch(
    out,
    w,
    center,
    y + 0.14,
    y + top * 0.69,
    width - 0.21,
    top * 0.275,
    projection + 0.041,
    Math.min(2, lod),
    { inner: C.dark, trim: C.sill, width: 0.19 },
    { inner: 'door', trim: 'stone' },
  );
  for (const dx of [-width - 0.17, width + 0.17])
    trimBlock(
      out,
      'stone',
      w,
      center + dx - 0.18,
      center + dx + 0.18,
      y + 0.05,
      y + top * 0.73,
      projection,
      projection + 0.365,
      C.sill,
    );
  trimBlock(
    out,
    'stone',
    w,
    center - width - 0.62,
    center + width + 0.62,
    y + top - 0.2,
    y + top + 0.01,
    0.16,
    projection + 0.29,
    C.sill,
  );
  if (lod > 0)
    for (const dx of [-width * 0.57, width * 0.57])
      trimBlock(
        out,
        'stone',
        w,
        center + dx - 0.035,
        center + dx + 0.035,
        y + 0.14,
        y + 2.31,
        projection + 0.046,
        projection + 0.093,
        C.edge,
      );
}
function schoolBlock(out, p, grade, lod, north) {
  const y = foundation(out, p, grade),
    h = north ? 8.15 : 8.65;
  solid(out, p, y, y + h, 'brick', C.gray);
  const principal = north ? 1 : 5;
  const fascia = walls(p);
  const long = north ? delta(p[3], p[0]) : delta(p[11], p[0]);
  hipped(out, p, y + h, Math.min(3.22, north ? 2.72 : 3.2), long, lod);
  for (const { i, w } of fascia) {
    const isFront = i === principal;
    const n0 = north && isFront ? (lod > 0 ? 3.38 : 7.1) : lod > 0 ? 3.06 : 6.3;
    const centers = bayCenters(w.length, n0, 1.5);
    const tint = north ? C.red : C.brick;
    panel(out, 'brick', w, 0, w.length, y + 0.42, y + 0.65, 0.032, tint);
    cornices(
      out,
      w,
      y,
      [
        [4.04, 0.16, 0.11],
        [h - 0.35, 0.14, 0.15],
        [h - 0.12, 0.17, 0.23],
      ],
      lod,
    );
    for (const x of centers) {
      if (!(isFront && !north)) {
        if (north && isFront && lod > 0)
          arch(
            out,
            w,
            x,
            y + 0.18,
            y + 2.69,
            Math.min(1.19, (w.length / centers.length) * 0.34),
            0.71,
            0.072,
            lod === 1 ? 0 : 2,
            { inner: C.dark, trim: C.red, width: 0.23 },
            { inner: 'door', trim: 'brick' },
          );
        else window(out, w, x, y + 1.0, 1.28, 1.83, lod, true);
      }
      window(out, w, x, y + 4.79, 1.44, 2.08, lod, true, true);
      if (lod > 1 && w.length > 4.8 && x + n0 * 0.47 < w.length - 0.14)
        trimBlock(
          out,
          'brick',
          w,
          x + n0 * 0.47 - 0.12,
          x + n0 * 0.47 + 0.12,
          y + 0.69,
          y + h - 0.39,
          0.02,
          0.12,
          tint,
        );
    }
    if (isFront && !north) portal(out, w, w.length * 0.51, y, lod, true);
  }
}
function fansun(out, p, grade, lod) {
  const y = foundation(out, p, grade),
    h = 11.65;
  solid(out, p, y, y + h, 'brick', C.brick);
  for (const { i, w } of walls(p)) {
    const front = i === 3 || i === 5;
    cornices(
      out,
      w,
      y,
      [
        [3.74, 0.14, 0.1],
        [7.92, 0.23, 0.14],
        [h - 0.33, 0.23, 0.25],
      ],
      lod,
    );
    for (const x of bayCenters(w.length, lod === 0 ? 6.2 : 3.0, 1.42)) {
      for (const h0 of lod === 0 ? [1.22, 5.0, 8.63] : [0.89, 4.88, 8.5])
        window(out, w, x, y + h0, 1.46, 2.14, lod, true);
      if (lod > 1 && x > 1.8)
        trimBlock(out, 'brick', w, x - 1.4, x - 1.19, y + 0.43, y + 11.17, 0.01, 0.15, C.red);
    }
    if (i === 3 && w.length > 15) {
      const cx = w.length * 0.5;
      for (const off of [-3.25, -1.15, 1.15, 3.25]) {
        if (lod === 0) {
          trimBlock(
            out,
            'stone',
            w,
            cx + off - 0.29,
            cx + off + 0.29,
            y + 0.18,
            y + 4.16,
            1.16,
            1.74,
            C.sill,
          );
          continue;
        }
        const [x, , z] = w.p(cx + off, 0, 1.45);
        ring(
          out,
          'stone',
          [x, z],
          [
            [y + 0.18, 0.41],
            [y + 0.48, 0.37],
            [y + 0.55, 0.29],
            [y + 3.85, 0.235],
            [y + 4.01, 0.41],
            [y + 4.18, 0.397],
          ],
          lod === 0 ? 5 : lod === 3 ? 11 : 8,
          C.sill,
        );
      }
      solid(out, patch(w, cx - 4.02, cx + 4.02, 0.07, 2.1), y + 4.16, y + 4.65, 'stone', C.sill);
      solid(out, patch(w, cx - 3.88, cx + 3.88, 0.1, 2.16), y, y + 0.18, 'stone', C.sill);
      opening(
        out,
        w,
        cx - 1.14,
        cx + 1.14,
        y + 0.23,
        y + 3.19,
        'stone',
        C.dark,
        'door',
        C.sill,
        lod,
        0.083,
      );
    }
    if (front && lod > 1) {
      const n = Math.floor(w.length / 0.53);
      for (let j = 1; j < n; j++)
        panel(
          out,
          'stone',
          w,
          j * 0.53 - 0.061,
          j * 0.53 + 0.061,
          y + 7.79,
          y + 7.91,
          0.158,
          C.edge,
        );
    }
  }
  const c = planarMid([p[3], p[4], p[15], p[16]]);
  const raised = [p[3], p[4], p[15], p[16]].map((pt) => midpoint(pt, c));
  solid(out, raised, y + h, y + h + 2.0, 'brick', C.red);
}
function auditorium(out, p, grade, lod) {
  const y = foundation(out, p, grade),
    h = 11.38;
  solid(out, p, y, y + h, 'brick', C.gray);
  for (const { i, w } of walls(p)) {
    cornices(
      out,
      w,
      y,
      [
        [0.56, 0.12, 0.13],
        [h - 0.41, 0.18, 0.17],
        [h - 0.11, 0.14, 0.19],
      ],
      lod,
    );
    if (i === 5) {
      const c = w.length * 0.5;
      for (const x of [c - 2.25, c, c + 2.25]) {
        for (let j = 0; j < (lod === 0 ? 1 : 4); j++) {
          const size = 1.61 - j * 0.105;
          trimBlock(
            out,
            'brick',
            w,
            x - size * 0.5,
            x + size * 0.5,
            y + 0.05,
            y + 3.57 - j * 0.115,
            0.016 + j * 0.018,
            0.056 + j * 0.029,
            j % 2 ? C.gray : C.dash,
          );
        }
        opening(
          out,
          w,
          x - 0.62,
          x + 0.62,
          y + 0.13,
          y + 3.12,
          'stone',
          C.wood,
          'door',
          C.dash,
          lod,
          0.178,
        );
      }
      trimBlock(out, 'stone', w, c - 4.14, c + 4.14, y + 3.7, y + 4.16, 0.06, 0.88, C.sill);
      for (const x of [c - 3.6, c - 1.12, c + 1.12, c + 3.6])
        trimBlock(out, 'brick', w, x - 0.15, x + 0.15, y + 0.22, y + 6.89, 0.015, 0.25, C.gray);
    } else if (w.length > 6) {
      for (const x of bayCenters(w.length, lod === 0 ? 8 : 4.4, 1.55))
        window(out, w, x, y + 3.5, 1.56, 3.15, lod, false, lod > 1);
    }
  }
}
function dorm(out, p, grade, lod) {
  const y = foundation(out, p, grade),
    h = 3.02,
    w = walls(p)[1].w;
  const setback = 1.22;
  const body = p.map((q, i) =>
    [1, 2].includes(i) ? [q[0] - setback * w.normal[0], q[1] - setback * w.normal[2]] : q,
  );
  solid(out, body, y, y + h, 'timber', C.timber);
  hipped(out, p, y + h, 1.48, delta(p[2], p[1]), lod);
  const n = lod === 0 ? 5 : 10;
  for (let i = 0; i < n; i++) {
    const step = w.length / n,
      x = step * (i + 0.51);
    trimBlock(out, 'stone', w, x - 0.94, x - 0.83, y + 0.02, y + h - 0.05, -0.14, 0.01, C.wood);
    if (lod > 0) {
      opening(
        out,
        w,
        x - 0.38,
        x + 0.4,
        y + 0.12,
        y + 1.97,
        'stone',
        C.wood,
        'door',
        C.sill,
        lod,
        -setback + 0.052,
      );
      if (lod > 1)
        window(
          out,
          { ...w, p: (u, v, d) => w.p(u, v, d - setback) },
          x + 1.08,
          y + 0.84,
          0.59,
          1.02,
          lod,
        );
    }
  }
}
function draw(out, lod, { polygons }, grade) {
  schoolBlock(out, polygons[0], grade, lod, false);
  schoolBlock(out, polygons[1], grade, lod, true);
  fansun(out, polygons[2], grade, lod);
  auditorium(out, polygons[3], grade, lod);
  for (const p of polygons.slice(4)) dorm(out, p, grade, lod);
}
const campus = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [180, 104, 157],
    lookAt: [-23, 2, 6],
    yaw: 0.91,
    sun: [330, 560, 410],
    brief:
      'Old Nankai school campus, including brick Boling and North buildings, Fansun Building, Ruiting Auditorium, and two Xizhai dormitory rows.',
    views: [
      { name: 'six-heritage-volumes-and-terrain', position: [183, 106, 161], lookAt: [-22, 1, 8] },
      { name: 'boling-building-arched-opening', position: [83, 13, 7], lookAt: [45, 4, -14] },
      {
        name: 'north-building-and-ruiting-auditorium',
        position: [68, 24, 32],
        lookAt: [12, 5, -31],
      },
      { name: 'fansun-columned-front', position: [69, 18, 87], lookAt: [27, 5, 66] },
      { name: 'xizhai-covered-dormitories', position: [-84, 11, 106], lookAt: [-83, 2, 66] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = campus;
export const model = { ...campus.model, category: 'education' };
