/** Roskilde Cathedral, the July 2019 exterior. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  grid = read('terrain-grid');
const [outer, memorial] = read('map-frame').geometry.polygons;
const [a, b] = S.axis.map((i) => outer[i]);
const d = b.map((v, i) => v - a[i]),
  [sin, cos] = d.map((v) => v / Math.hypot(...d)).toReversed();
const site = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const inverse = ([x, z]) => [x * cos + z * sin, -x * sin + z * cos];
const rings = outer.map(inverse),
  up = [0, 1, 0],
  base = S.datum;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96, metallic: 0 },
  brickTrim: { slot: 'trim', graph: 'brick_longformat', roughness: 0.95, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.11 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    brick: 'a47764',
    warm: 'aa7762',
    darkBrick: '8d6354',
    arch: 'b18a73',
    deep: '634b43',
    stone: 'a59a80',
    lead: '66686a',
    darkLead: '515559',
    copper: '626f69',
    glazing: '465359',
    shade: '4d4c48',
    gold: 'a28a51',
    bronze: '6e6952',
  }).map(([name, val]) => [name, rgb(val)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const interpolate = (a, b, f) => a.map((v, i) => mix(v, b[i], f));
const corners = ([l, r, n, s]) => [
  [l, n],
  [r, n],
  [r, s],
  [l, s],
];
function draw(out, slot, points, want, color) {
  const normal = normalFor(...points);
  if (!normal.some(Boolean)) return;
  const p = normal.reduce((sum, v, i) => sum + v * want[i], 0) > 0 ? points : points.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, p, color);
}
function area(out, slot, outline, transform, normal, color, holes = []) {
  const v = outline.concat(...holes),
    off = [];
  holes.reduce((n, p) => {
    off.push(n);
    return n + p.length;
  }, outline.length);
  const idx = earcut(v.flat(), off);
  for (let i = 0; i < idx.length; i += 3)
    draw(
      out,
      slot,
      idx.slice(i, i + 3).map((k) => transform(...v[k])),
      normal,
      color,
    );
}
function grade(x, z) {
  const [a, , b] = site(x, 0, z);
  const u = (a - grid.origin[0]) / grid.stepMeters,
    v = (b - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function wallFrame(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  return {
    len: l,
    n: site(dz / l, 0, -dx / l),
    p: (u, y, t = 0) => site(a[0] + (u * dx + t * dz) / l, y, a[1] + (u * dz - t * dx) / l),
  };
}
const rect = (left, right, low, high) => [
  [left, low],
  [right, low],
  [right, high],
  [left, high],
];
function facade(out, slot, f, l, r, b, t, depth, color) {
  area(out, slot, rect(l, r, b, t), (x, y) => f.p(x, y, depth), f.n, color);
}
function block(out, slot, range, lo, hi, color, cover = true) {
  const p = corners(range);
  for (let i = 0; i < p.length; i++) {
    const f = wallFrame(p[i], p[(i + 1) % p.length]);
    facade(out, slot, f, 0, f.len, lo, hi, 0, color);
  }
  if (cover)
    draw(
      out,
      slot,
      p.map(([x, z]) => site(x, hi, z)),
      up,
      color,
    );
}
function windowContour(x, b, w, h, n, roundness) {
  const r = w / 2,
    shoulder = b + h * 0.72;
  return [
    [x - r, b],
    [x + r, b],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const theta = (i / n) * Math.PI,
        k = Math.sin(theta);
      return [x + r * Math.cos(theta), shoulder + (b + h - shoulder) * Math.pow(k, roundness)];
    }),
  ];
}
function illuminatedWall(out, f, bottom, top, openings, lod, color = tone.brick) {
  if (lod === 0) {
    facade(out, 'brick', f, 0, f.len, bottom, top, 0, color);
    return;
  }
  if (lod === 1) {
    facade(out, 'brick', f, 0, f.len, bottom, top, 0, color);
    for (const [x, b, w, h, r] of openings) {
      const shape = windowContour(x, b, w, h, 4, r);
      area(out, 'inset', shape, (u, y) => f.p(u, y, 0.031), f.n, tone.glazing);
    }
    return;
  }
  const opts = openings.map(([x, b, w, h, r]) => ({
    x,
    b,
    w,
    h,
    r,
    outer: windowContour(x, b - 0.13, w + 0.29, h + 0.29, lod >= 2 ? 8 : 4, r),
    inner: windowContour(x, b, w, h, lod >= 2 ? 8 : 4, r),
  }));
  area(
    out,
    'brick',
    rect(0, f.len, bottom, top),
    (u, y) => f.p(u, y),
    f.n,
    color,
    opts.map((s) => s.outer),
  );
  for (const { x, b, w, h, outer, inner } of opts) {
    area(out, 'brickTrim', outer, (v, y) => f.p(v, y, 0.023), f.n, tone.darkBrick, [inner]);
    area(out, 'inset', inner, (v, y) => f.p(v, y, -0.18), f.n, tone.glazing);
    for (let i = 1; i < inner.length; i++) {
      const u = inner[i],
        v = inner[(i + 1) % inner.length],
        p = [f.p(...u, 0.023), f.p(...v, 0.023), f.p(...v, -0.18), f.p(...u, -0.18)];
      face(out, 'brickTrim', p.toReversed(), tone.deep);
    }
    if (lod >= 2) {
      facade(
        out,
        'brickTrim',
        f,
        x - w / 2 - 0.06,
        x + w / 2 + 0.06,
        b - 0.14,
        b - 0.05,
        0.085,
        tone.arch,
      );
      facade(
        out,
        'brickTrim',
        f,
        x - 0.044,
        x + 0.044,
        b + 0.025,
        b + h - 0.045,
        -0.09,
        tone.stone,
      );
      if (lod >= 3)
        for (const y of [b + h * 0.41, b + h * 0.7])
          facade(out, 'brickTrim', f, x - w * 0.49, x + w * 0.49, y, y + 0.052, -0.08, tone.stone);
    }
  }
}
function pitched(out, range, y, peak, lod, across = false, hip = false) {
  const p = corners(range),
    [l, r, n, s] = range;
  const t = across
    ? [
        [mix(l, r, 0.5), n],
        [mix(l, r, 0.5), s],
      ]
    : [
        [l, mix(n, s, 0.5)],
        [r, mix(n, s, 0.5)],
      ];
  if (hip)
    t.forEach((v, i) =>
      v.forEach((k, j) => (v[j] = mix(k, (t[0][j] + t[1][j]) / 2, i ? 0.24 : 0.2))),
    );
  const e = p.map(([x, z]) => site(x, y, z)),
    c = t.map(([x, z]) => site(x, peak, z));
  const sets = across
    ? [
        [e[0], c[0], c[1], e[3]],
        [c[0], e[1], e[2], c[1]],
      ]
    : [
        [e[0], e[1], c[1], c[0]],
        [c[0], c[1], e[2], e[3]],
      ];
  const ends = across
    ? [
        [e[0], e[1], c[0]],
        [e[2], e[3], c[1]],
      ]
    : [
        [e[1], e[2], c[1]],
        [e[3], e[0], c[0]],
      ];
  sets.forEach((q, i) => draw(out, 'roof', q, up, i ? tone.lead : tone.darkLead));
  ends.forEach((q, i) => {
    const edge = across ? [i ? 2 : 0, i ? 3 : 1] : [i ? 3 : 1, i ? 0 : 2],
      f = wallFrame(p[edge[0]], p[edge[1]]);
    draw(out, hip ? 'roof' : 'brick', q, hip ? up : f.n, hip ? tone.lead : tone.warm);
    if (!hip && lod >= 2) {
      for (const side of [-1, 1]) {
        const j = side < 0 ? 0 : 1;
        draw(
          out,
          'brickTrim',
          [
            q[j],
            q[2],
            q[2].map((v, k) => v + (k === 1 ? 0.17 : 0)),
            q[j].map((v, k) => v + (k === 1 ? 0.17 : 0)),
          ],
          f.n,
          tone.arch,
        );
      }
    }
  });
}
function churchBody(out, lod) {
  const eave = S.eaves;
  const p = corners(S.nave);
  for (let i = 0; i < 4; i++) {
    const f = wallFrame(p[i], p[(i + 1) % 4]),
      windows = [];
    if (i % 2 === 0)
      for (let k = 0; k < 11; k++) {
        const x = ((k + 0.5) * f.len) / 11;
        windows.push([x, 19.8, 1.4, 4.21, 0.63]);
      }
    illuminatedWall(out, f, base, eave, windows, lod);
  }
  pitched(
    out,
    [S.nave[0] - 0.32, S.nave[1] + 0.65, S.nave[2] - 0.36, S.nave[3] + 0.36],
    eave,
    S.naveRidge,
    lod,
  );
  const tr = corners(S.transept);
  for (let i = 0; i < 4; i++) {
    const f = wallFrame(tr[i], tr[(i + 1) % 4]),
      windows =
        i % 2 === 0
          ? [[f.len * 0.5, 16.9, 3.2, 8.0, 0.48]]
          : [
              [f.len * 0.14, 16, 1.58, 5.85, 0.55],
              [f.len * 0.86, 16, 1.58, 5.85, 0.55],
            ];
    illuminatedWall(out, f, base, eave, windows, lod, tone.warm);
  }
  pitched(out, S.transept, eave, S.naveRidge - 0.85, lod, true);
}
function apse(out, lod) {
  const [x, z] = S.apseCenter,
    [rx, rz] = S.apseRadius;
  const arc = (i, n, r) => [
    x + rx * r * Math.cos(mix(-Math.PI / 2, Math.PI / 2, i / n)),
    z + rz * r * Math.sin(mix(-Math.PI / 2, Math.PI / 2, i / n)),
  ];
  const n = [8, 10, 12, 14][lod];
  const cap = (radius, y, rise) => {
    for (let i = 0; i < n; i++) {
      const a = arc(i, n, radius),
        b = arc(i + 1, n, radius);
      draw(
        out,
        'roof',
        [site(a[0], y, a[1]), site(b[0], y, b[1]), site(x, y + rise, z)],
        up,
        i % 2 ? tone.lead : tone.darkLead,
      );
    }
  };
  for (const [r, lo, hi, rows] of [
    [
      1,
      base,
      18.7,
      [
        [4.3, 5.9],
        [11.2, 5.95],
      ],
    ],
    [0.67, 16.85, 27.1, [[22.3, 3.66]]],
  ]) {
    for (let i = 0; i < n; i++) {
      const p = arc(i, n, r),
        q = arc(i + 1, n, r),
        f = wallFrame(p, q);
      const windows =
        f.len > 1.2
          ? rows.map(([y, h]) => [f.len * 0.5, y, Math.min(1.34, f.len * 0.58), h, 0.89])
          : [];
      illuminatedWall(out, f, lo, hi, windows, lod, i % 2 ? tone.warm : tone.brick);
      if (lod > 1) facade(out, 'brickTrim', f, 0, f.len, hi - 0.59, hi - 0.28, 0.088, tone.arch);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = arc(i, n, 1),
      b = arc(i, n, 0.67),
      c = arc(i + 1, n, 0.67),
      d = arc(i + 1, n, 1);
    draw(
      out,
      'roof',
      [
        site(a[0], 18.7, a[1]),
        site(d[0], 18.7, d[1]),
        site(c[0], 20.55, c[1]),
        site(b[0], 20.55, b[1]),
      ],
      up,
      tone.lead,
    );
  }
  cap(0.67, 27.1, 5.3);
}
function annexes(out, lod) {
  // The exact outline is kept as the lower shell. The named annexes rise individually above it.
  const clean =
    lod === 0 ? rings.filter((p, i) => i % 2 === 0 || [57, 90, 95, 105, 106].includes(i)) : rings;
  const polygon =
    clean.reduce((sum, p, i) => {
      const q = clean[(i + 1) % clean.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0) > 0
      ? clean
      : clean.toReversed();
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      f = wallFrame(a, b);
    const baseStart = grade(...a) - 0.38,
      baseEnd = grade(...b) - 0.38,
      top = 10;
    const windowBase = Math.max(baseStart, baseEnd) + 1.5,
      windowHeight = Math.min(5.4, top - windowBase - 1.1);
    if (lod >= 1 && f.len >= 2.65 && windowHeight > 1.1) {
      const count = Math.max(1, Math.round(f.len / 6.5)),
        openings = Array.from({ length: count }, (_, j) => [
          (f.len * (j + 0.5)) / count,
          windowBase,
          Math.min(1.74, (f.len / count) * 0.48),
          windowHeight,
          0.69,
        ]);
      const wallBase = Math.max(baseStart, baseEnd);
      illuminatedWall(out, f, wallBase, top, openings, lod, tone.warm);
      if (Math.abs(baseStart - baseEnd) > 0.012) {
        const points = [f.p(0, baseStart), f.p(f.len, baseEnd)];
        if (baseEnd < wallBase) points.push(f.p(f.len, wallBase));
        if (baseStart < wallBase) points.push(f.p(0, wallBase));
        draw(out, 'brick', points, f.n, tone.warm);
      }
    } else
      draw(
        out,
        'brick',
        [f.p(0, baseStart), f.p(f.len, baseEnd), f.p(f.len, top), f.p(0, top)],
        f.n,
        tone.warm,
      );
  }
  area(out, 'roof', polygon, (x, z) => site(x, 10, z), up, tone.lead);
  for (const chapel of S.chapels) {
    const [e, r] = chapel.roof,
      p = corners(chapel.rect),
      front = chapel.front === 'north' ? 0 : 2;
    for (let j = 0; j < 4; j++) {
      const f = wallFrame(p[j], p[(j + 1) % 4]),
        count = j === front ? 3 : 2;
      const win = Array.from({ length: count }, (_, i) => [
        (f.len * (i + 1)) / (count + 1),
        10.14,
        Math.min(2.04, (f.len / (count + 1)) * 0.59),
        Math.min(5.05, e - 10.48),
        0.51,
      ]);
      illuminatedWall(out, f, 10, e, win, lod, j === front ? tone.warm : tone.brick);
    }
    pitched(out, chapel.rect, e, r, lod, true, chapel.type === 'hip');
    if (chapel.type === 'stepped') {
      const f = wallFrame(p[front], p[(front + 1) % 4]),
        n = lod ? 6 : 4;
      for (let j = 0; j < n; j++) {
        const w = f.len * (0.5 - (j * 0.44) / n),
          x = f.len / 2;
        facade(
          out,
          'brickTrim',
          f,
          x - w,
          x + w,
          e + (j * (r - e)) / n,
          e + ((j + 1) * (r - e)) / n,
          0.08,
          tone.warm,
        );
        if (lod >= 2)
          facade(
            out,
            'brickTrim',
            f,
            x - w,
            x + w,
            e + ((j + 1) * (r - e)) / n - 0.11,
            e + ((j + 1) * (r - e)) / n + 0.04,
            0.15,
            tone.arch,
          );
      }
    }
  }
  const [mn, mx, sz, nz] = [-17, -10.7, 15.5, 22.8];
  block(out, 'brick', [mn, mx, sz, nz], base, 15.4, tone.warm, false);
  pitched(out, [mn, mx, sz, nz], 15.4, 18.0, lod, true);
}
function tapered(out, x, z, rows, n, slot, color) {
  const ring = (y, r, w = 0) =>
    Array.from({ length: n }, (_, i) => {
      const theta = Math.PI / 8 + (i * 2 * Math.PI) / n;
      return site(
        x + (r + (i % 2 ? w : 0)) * Math.cos(theta),
        y,
        z + (r + (i % 2 ? w : 0)) * Math.sin(theta),
      );
    });
  for (let k = 1; k < rows.length; k++) {
    const a = ring(...rows[k - 1]),
      b = ring(...rows[k]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        p = ((i + 0.5) * 2 * Math.PI) / n + Math.PI / 8;
      draw(
        out,
        slot,
        [a[i], a[j], b[j], b[i]],
        site(Math.cos(p), 0, Math.sin(p)),
        i % 2 ? color : slot === 'roof' ? tone.darkLead : tone.darkBrick,
      );
    }
  }
}
function spires(out, lod) {
  const width = S.westTowerWidth,
    eave = S.westTowerEave,
    top = S.westSpireFinial;
  for (const [x, z] of S.westTowers) {
    const r = width / 2,
      range = [x - r, x + r, z - r, z + r],
      p = corners(range);
    for (let i = 0; i < 4; i++) {
      const f = wallFrame(p[i], p[(i + 1) % 4]);
      const w =
        i === 3
          ? [
              [2.6, 17.9, 1.2, 4.8, 0.57],
              [7.65, 17.9, 1.2, 4.8, 0.57],
            ]
          : [[f.len * 0.5, 18.2, 2.12, 4.95, 0.61]];
      w.push([f.len * 0.29, 26.7, 1.46, 5.84, 0.61], [f.len * 0.71, 26.7, 1.46, 5.84, 0.61]);
      illuminatedWall(out, f, base, eave, w, lod, i === 3 ? tone.warm : tone.brick);
    }
    block(
      out,
      'brickTrim',
      [x - r - 0.23, x + r + 0.23, z - r - 0.23, z + r + 0.23],
      eave - 0.23,
      eave + 0.36,
      tone.darkBrick,
    );
    tapered(
      out,
      x,
      z,
      [
        [eave + 0.26, 5.72],
        [eave + 2.8, 4.46],
        [eave + 5.68, 3.2],
        [top - 2.8, 0.25],
        [top - 1.98, 0.1],
      ],
      lod ? 8 : 6,
      'roof',
      tone.copper,
    );
    tapered(
      out,
      x,
      z,
      [
        [top - 1.99, 0.085],
        [top, 0.036],
      ],
      6,
      'roof',
      tone.gold,
    );
  }
  const west = wallFrame([-45.25, 5.8], [-45.25, -5.45]),
    mid = west.len / 2;
  illuminatedWall(
    out,
    west,
    base,
    eave - 9.3,
    [
      [mid, base + 0.14, 4.01, 8.46, 0.42],
      [mid, 12.1, 3.7, 8.7, 0.44],
    ],
    lod,
    tone.warm,
  );
  if (lod === 0) {
    const p = windowContour(mid, base + 0.14, 4.01, 8.46, 6, 0.42);
    area(out, 'inset', p, (u, y) => west.p(u, y, 0.02), west.n, tone.bronze);
  }
  const centre = S.crossSpireFinial;
  tapered(
    out,
    2.1,
    -0.2,
    [
      [S.naveRidge - 1, 2.38],
      [39.0, 2.38],
      [40.5, 2.65],
      [42.0, 2.35],
      [centre - 1.58, 0.075],
    ],
    8,
    'roof',
    tone.lead,
  );
  tapered(
    out,
    2.1,
    -0.2,
    [
      [centre - 1.72, 0.074],
      [centre, 0.026],
    ],
    6,
    'roof',
    tone.gold,
  );
}
function memorialWall(out) {
  const p = memorial.map(inverse),
    y = Math.min(...p.map(([x, z]) => grade(x, z))) - 0.1;
  for (let i = 1; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      f = wallFrame(a, b);
    facade(out, 'brick', f, 0, f.len, y - 0.55, y + 1.62, 0, tone.warm);
    const q = wallFrame(b, a);
    facade(out, 'brick', q, 0, q.len, y - 0.55, y + 1.62, -0.35, tone.warm);
    draw(
      out,
      'ground',
      [
        f.p(0, y + 1.62),
        f.p(f.len, y + 1.62),
        f.p(f.len, y + 1.62, -0.35),
        f.p(0, y + 1.62, -0.35),
      ],
      up,
      tone.stone,
    );
  }
}
function build(out, lod) {
  annexes(out, lod);
  churchBody(out, lod);
  apse(out, lod);
  spires(out, lod);
  memorialWall(out);
}
export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);
const camera = site(-97, 74, 113),
  lookAt = site(1, 25, -3),
  recipe = 'roskilde-cathedral-model.mjs';
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: cathedralCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Roskilde Cathedral’s Gothic brick nave, paired west spires, smaller Margrete spire, rounded apse and separately roofed royal chapels.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: site(-19, 30, 28),
  portableGroundY: -2.0,
  mediumFiContext: {
    scale: 0.93,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.86,
    basis: 'Named OSM cathedral and attached chapel outline.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'brick_longformat',
    'stone_limestone',
    'metal_standing_seam',
  ],
  qaCameras: [
    { name: 'rounded-east-apse-and-transept', position: site(79, 20, 50), lookAt: site(21, 20, 3) },
    {
      name: 'west-tower-pair-and-royal-entrance',
      position: site(-101, 19, -31),
      lookAt: site(-37, 34, 1),
    },
    {
      name: 'brick-chapels-and-margrete-spire',
      position: site(50, 60, -77),
      lookAt: site(-5, 27, -6),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cathedralDistrict', 0.42],
        ['street', 'cathedralStreet', 0.18],
        ['closeup', 'cathedralCloseup', 0.071],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The OpenStreetMap outlines are ODbL. Two Qualla photographs are CC0 own works by Sintakso.',
};
