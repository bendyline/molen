import {
  areaSign,
  at,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  ground: surface('foundation', 'concrete_panel'),
  brick: surface('wall', 'brick'),
  metal: surface('wall', 'metal_corrugated', 0.83, 0.08),
  roof: surface('roof', 'metal_standing_seam', 0.77, 0.11),
  flashed: surface('trim', 'metal_painted'),
  steel: surface('door', 'metal_painted'),
  glass: surface('window', 'window_grid', 0.48, 0.12),
};
const C = palette({
  concrete: '9b9584',
  sill: 'aaa394',
  base: '898778',
  brick: 'a47259',
  darkBrick: '916650',
  zinc: '9daaaa',
  silver: 'a6b2b0',
  oldZinc: '929f9f',
  roof: 'afb5ad',
  roofAlt: 'a5aea7',
  eave: '788888',
  rail: '6b7774',
  shutter: '657475',
  glaze: '697f80',
  white: 'ede8d6',
  sign: '485f63',
});
const along = (a, b, t) => a.map((x, i) => mix(x, b[i], t));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const delta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const length = (d) => Math.hypot(...d);

function clip(points, scalar, limit, multiplier) {
  const result = [];
  for (const [a, b] of pairs(closed(points))) {
    const va = (scalar(a) - limit) * multiplier,
      vb = (scalar(b) - limit) * multiplier;
    if (va >= 0) result.push(a);
    if ((va > 0 && vb < 0) || (va < 0 && vb > 0)) result.push(along(a, b, va / (va - vb)));
  }
  return result;
}
function roofSection(out, outline, axis, width, h, floor, lod) {
  const line = [];
  for (let i = 0; i <= 2 * h.bays; i++) line.push((width * i) / (2 * h.bays));
  const height = (v) => {
    const phase = Math.max(0, Math.min(h.bays, (v / width) * h.bays));
    const i = phase - Math.floor(phase);
    return floor + h.eaves + h.roofRise * (1 - Math.abs(2 * i - 1));
  };
  const limits = [-500, ...line, 500];
  for (let i = 0; i < limits.length - 1; i++) {
    const low = limits[i],
      high = limits[i + 1];
    const p = clip(clip(outline, axis, low, 1), axis, high, -1);
    if (p.length < 3) continue;
    const triangles = triangulate(p.flat());
    for (let j = 0; j < triangles.length; j += 3) {
      const pts = triangles.slice(j, j + 3).map((k) => at(p[k], height(axis(p[k]))));
      face(out, 'roof', pts, up, i % 2 ? C.roof : C.roofAlt);
    }
  }
  if (lod > 0) {
    for (const [i, v] of line.entries()) {
      if (i === 0 || i === line.length - 1) continue;
      const strip = clip(clip(outline, axis, v - 0.1, 1), axis, v + 0.1, -1);
      const triangles = triangulate(strip.flat());
      for (let j = 0; j < triangles.length; j += 3)
        face(
          out,
          'flashed',
          triangles.slice(j, j + 3).map((k) => at(strip[k], height(axis(strip[k])) + 0.065)),
          up,
          C.eave,
        );
    }
  }
  return { height, line };
}
function breakpoints(a, b, axis, line) {
  const x = axis(a),
    y = axis(b);
  if (Math.abs(x - y) < 0.001) return [0, 1];
  return [
    0,
    ...line
      .map((v) => (v - x) / (y - x))
      .filter((t) => t > 0.0001 && t < 0.9999)
      .sort((a, b) => a - b),
    1,
  ];
}
function gate(out, w, center, y, lod, rail) {
  const half = rail ? 2.28 : 2.06;
  const u = center - half,
    v = center + half,
    h = rail ? 5.1 : 3.3;
  opening(
    out,
    w,
    u,
    v,
    y + 0.065,
    y + h,
    'flashed',
    rail ? C.shutter : C.glaze,
    rail ? 'steel' : 'glass',
    C.eave,
    lod,
    0.107,
  );
  if (lod === 0) return;
  for (const x of [u, v])
    trimBlock(out, 'flashed', w, x - 0.1, x + 0.1, y + 0.02, y + h + 0.12, 0.1, 0.24, C.eave);
  trimBlock(out, 'flashed', w, u - 0.12, v + 0.12, y + h - 0.08, y + h + 0.13, 0.09, 0.29, C.eave);
  if (rail && lod > 1) {
    const n = lod === 2 ? 7 : 15;
    for (let i = 1; i < n; i++)
      panel(
        out,
        'flashed',
        w,
        u + 0.08,
        v - 0.08,
        y + (i * h) / n,
        y + (i * h) / n + 0.02,
        0.14,
        C.rail,
      );
  }
  if (!rail) {
    for (const x of [center - 1.22, center, center + 1.22])
      panel(out, 'flashed', w, x - 0.027, x + 0.027, y + 0.065, y + h, 0.15, C.sill);
    panel(out, 'flashed', w, u, v, y + 2.52, y + 2.61, 0.15, C.sill);
  }
}
const marks = {
  T: [31, 4, 4, 4, 4, 4, 4],
  R: [30, 17, 17, 30, 20, 18, 17],
  A: [14, 17, 17, 31, 17, 17, 17],
  N: [17, 25, 25, 21, 19, 19, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  P: [30, 17, 17, 30, 16, 16, 16],
  O: [14, 17, 17, 17, 17, 17, 14],
  M: [17, 27, 21, 21, 17, 17, 17],
  U: [17, 17, 17, 17, 17, 17, 14],
  E: [31, 16, 16, 30, 16, 16, 31],
};
function nameboard(out, w, center, y, lod) {
  const title = 'TRANSPORT MUSEUM',
    cell = 0.091,
    width = title.length * 6 * cell;
  const left = center - width * 0.5;
  trimBlock(
    out,
    'flashed',
    w,
    left - 0.22,
    left + width + 0.23,
    y - 0.12,
    y + 0.74,
    0.09,
    0.3,
    C.sign,
  );
  if (lod === 0) return;
  for (let i = 0; i < title.length; i++) {
    const glyph = marks[title[i]];
    if (!glyph) continue;
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++) {
        if ((glyph[row] & (16 >> col)) === 0) continue;
        const a = left + (i * 6 + col) * cell,
          b = y + (6 - row) * cell;
        panel(out, 'flashed', w, a, a + cell, b, b + cell, 0.32, C.white);
      }
  }
}

function draw(
  out,
  lod,
  { outline, corners, gate: entryNode, railEnds, municipalMeters, shedProfile: h },
  grade,
) {
  const [a, b, c] = corners;
  const east = delta(a, b).map((v) => v / length(delta(a, b))),
    south = [-east[1], east[0]];
  const axis = (p) => dot(delta(p, b), south);
  const width = 0.5 * (axis(c) + municipalMeters[1]),
    floor = -2.1;
  const { height, line } = roofSection(out, outline, axis, width, h, floor, lod);
  const sign = areaSign(outline);
  const sides = pairs(closed(outline)).map(([a, b], i) => ({ a, b, i, w: edge(a, b, sign) }));
  const projected = (a, b, p) => {
    const d = delta(b, a);
    return dot(delta(p, a), d) / length(d);
  };
  const candidate = (obj, p) => ({
    ...obj,
    u: projected(obj.a, obj.b, p),
    distance: Math.abs(dot(delta(p, obj.a), [obj.w.normal[0], obj.w.normal[2]])),
  });
  const closest = (p, filter) =>
    sides
      .filter(filter)
      .map((s) => candidate(s, p))
      .sort((x, y) => distanceScore(x) - distanceScore(y))[0];
  const distanceScore = (s) => s.distance + 2 * Math.max(0, -s.u, s.u - s.w.length);
  const entry = closest(entryNode, (s) => s.w.length > 35 && s.w.normal[0] > 0.5);
  const entranceCenter = Math.min(entry.w.length - 9, Math.max(9, entry.u));
  const chosen = new Map();
  for (const e of railEnds) {
    const side = closest(e, (s) => s.w.length > 7 && s.w.normal[0] < -0.4);
    const center = Math.min(side.w.length - 2.4, Math.max(2.4, side.u));
    const p = side.w.p(center, 0);
    const other = [...chosen.values()].flat();
    if (other.some((q) => Math.hypot(q.p[0] - p[0], q.p[2] - p[2]) < 5.2)) continue;
    chosen.set(side.i, [...(chosen.get(side.i) ?? []), { center, p }]);
  }
  for (const { a, b, i, w } of sides) {
    const pad = lod > 1 ? 14 : 24;
    const segments = Math.max(1, Math.ceil(w.length / pad));
    for (let j = 0; j < segments; j++) {
      const t0 = j / segments,
        t1 = (j + 1) / segments,
        p = along(a, b, t0),
        q = along(a, b, t1);
      face(
        out,
        'ground',
        [
          at(p, Math.min(grade(p) - 0.32, floor - 0.5)),
          at(q, Math.min(grade(q) - 0.32, floor - 0.5)),
          at(q, floor + 0.36),
          at(p, floor + 0.36),
        ],
        w.normal,
        C.concrete,
      );
    }
    const isEntry = i === entry.i;
    const brink = isEntry ? 4.2 : chosen.has(i) ? 1.52 : 2.28;
    panel(
      out,
      'brick',
      w,
      0,
      w.length,
      floor + 0.36,
      floor + brink,
      0.003,
      isEntry ? C.brick : C.darkBrick,
    );
    for (const [v0, v1] of pairs(breakpoints(a, b, axis, line))) {
      const p = along(a, b, v0),
        q = along(a, b, v1),
        h0 = height(axis(p)),
        h1 = height(axis(q));
      face(
        out,
        'metal',
        [at(p, floor + brink), at(q, floor + brink), at(q, h1), at(p, h0)],
        w.normal,
        C.zinc,
      );
      face(
        out,
        'flashed',
        [
          w.p(w.length * v0, h0 - 0.17, 0.032),
          w.p(w.length * v1, h1 - 0.17, 0.032),
          w.p(w.length * v1, h1 + 0.045, 0.032),
          w.p(w.length * v0, h0 + 0.045, 0.032),
        ],
        w.normal,
        C.eave,
      );
    }
    if (lod > 0 && w.length > 3.2) {
      const n = Math.max(1, Math.round(w.length / (lod === 1 ? 13 : lod === 2 ? 7.7 : 4.75)));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          u = t * w.length;
        const high = height(axis(along(a, b, t))) - 0.2;
        if (j % 3 !== 2 || lod === 3)
          panel(
            out,
            'flashed',
            w,
            u - 0.032,
            u + 0.032,
            floor + brink + 0.035,
            high,
            0.037,
            j % 3 ? C.eave : C.silver,
          );
      }
      if (lod > 1 && !isEntry && !chosen.has(i) && w.length > 65) {
        for (let j = 1; j <= 6; j++) {
          const u = (w.length * j) / 7;
          opening(
            out,
            w,
            u - 1.22,
            u + 1.22,
            floor + 2.82,
            floor + 3.91,
            'flashed',
            C.glaze,
            'glass',
            C.eave,
            lod,
            0.064,
          );
        }
      }
    }
    for (const g of chosen.get(i) ?? []) gate(out, w, g.center, floor, lod, true);
    if (isEntry) {
      const x = entranceCenter;
      trimBlock(
        out,
        'brick',
        w,
        x - 5.25,
        x + 5.25,
        floor + 0.1,
        floor + 4.69,
        0.05,
        0.083,
        C.brick,
      );
      gate(out, w, x, floor, lod, false);
      nameboard(out, w, x, floor + 3.61, lod);
      trimBlock(
        out,
        'ground',
        w,
        x - 3.36,
        x + 3.36,
        floor - 0.21,
        floor + 0.03,
        0.07,
        1.75,
        C.sill,
      );
      if (lod > 1)
        for (const s of [-1, 1])
          trimBlock(
            out,
            'flashed',
            w,
            x + s * 2.73 - 0.058,
            x + s * 2.73 + 0.058,
            floor + 0.02,
            floor + 1.11,
            1.05,
            1.18,
            C.eave,
          );
    }
  }
}
const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [198, 77, 160],
    lookAt: [42, 1, -24],
    yaw: 0.73,
    sun: [-290, 430, 380],
    brief:
      'The former PX goods shed in George: its long, shallow metal roof, corrugated walls, rail bays and brick museum entrance.',
    views: [
      { name: 'visitor-entry-and-terrain', position: [177, 21, 70], lookAt: [105, 2, -10] },
      { name: 'rail-doors-and-ribbed-cladding', position: [-119, 21, 49], lookAt: [-20, 1, -7] },
      { name: 'shed-profile-and-roof', position: [164, 81, -131], lookAt: [44, 2, -28] },
      { name: 'entry-sign-and-brickwork', position: [160, 8, 29], lookAt: [130, 0, -2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
export const model = museum.model;
