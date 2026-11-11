/** Westport House, its limestone fronts and its lakeside terrace in April 2011. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { halfLength: X, halfDepth: Z, plinth, cornice, ridge, westTerrace } = plan;
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  terrace: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  sash: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54, metallic: 0.08 },
};
const c = Object.fromEntries(
  Object.entries({
    west: '8b8981',
    east: 'a39c8c',
    south: 'a6a091',
    north: '969285',
    dress: 'aea89b',
    reveal: '7e7b70',
    base: '817e73',
    cornice: 'a19b8c',
    light: 'c3bcb0',
    slate: '696a70',
    shade: '777569',
    glass: '515653',
    door: '4b534c',
    sash: 'd6d2c2',
    pot: '686963',
    terrace: '878376',
    paving: 'a19b8b',
  }).map(([name, value]) => [name, rgb(value)]),
);
const up = [0, 1, 0],
  rect = (a, b, y0, y1) => [
    [a, y0],
    [b, y0],
    [b, y1],
    [a, y1],
  ];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function directed(out, slot, p, normal, tint) {
  const sign = normalFor(...p).reduce((sum, v, i) => sum + v * normal[i], 0);
  const vertices = sign >= 0 ? p : p.toReversed();
  if (vertices.length === 3) triangle(out, slot, vertices, tint);
  else face(out, slot, vertices, tint);
}
function area(out, slot, outer, project, normal, tint, holes = []) {
  const points = [...outer];
  const offsets = holes.map((h) => {
    const n = points.length;
    points.push(...h);
    return n;
  });
  const ids = earcut(points.flat(), offsets);
  for (let i = 0; i < ids.length; i += 3)
    directed(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => project(...points[j])),
      normal,
      tint,
    );
}
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    r = terrain.heightsMeters[j],
    n = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * r[i] + a * r[i + 1]) +
    b * ((1 - a) * n[i] + a * n[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}
function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [dz / length, 0, -dx / length];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [
      a[0] + (u * dx) / length + normal[0] * d,
      y,
      a[1] + (u * dz) / length + normal[2] * d,
    ],
  };
}
const west = section([-X, -Z], [X, -Z]),
  east = section([X, Z], [-X, Z]);
const south = section([-X, Z], [-X, -Z]),
  north = section([X, -Z], [X, Z]);
function patch(out, s, slot, p, depth, tint) {
  directed(
    out,
    slot,
    p.map(([x, y]) => s.p(x, y, depth)),
    s.normal,
    tint,
  );
}
function strip(out, s, a, b, y, width, depth, tint = c.dress) {
  const p = s.p;
  patch(out, s, 'trim', rect(a, b, y - width, y), depth, tint);
  directed(out, 'trim', [p(a, y), p(b, y), p(b, y, depth), p(a, y, depth)], up, tint);
}
function profile({ u, low, high, w, arch = 0 }, n) {
  const a = u - w / 2,
    b = u + w / 2;
  if (!arch || n === 0) return rect(a, b, low, high);
  const spring = high - arch;
  return [
    [a, low],
    [b, low],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const angle = (Math.PI * i) / n;
      return [u + (Math.cos(angle) * w) / 2, spring + Math.sin(angle) * arch];
    }),
  ];
}
function window(out, s, w, ring, offset, lod) {
  const { u, low, high, w: width, arch = 0, door, venetian } = w;
  const { p, normal } = s,
    depth = offset + (lod >= 2 ? -0.29 : 0.015),
    left = u - width / 2,
    right = u + width / 2;
  area(out, 'glass', ring, (x, y) => p(x, y, depth), normal, door ? c.door : c.glass);
  if (lod >= 2) {
    const middle = p(u, (low + high) / 2, offset);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        mid = p(...mix(a, b, 0.5), offset);
      directed(
        out,
        'trim',
        [p(...a, offset), p(...b, offset), p(...b, depth), p(...a, depth)],
        middle.map((x, k) => x - mid[k]),
        c.reveal,
      );
    }
  }
  if (!lod) return;
  const plane = depth + 0.026;
  const grids = venetian ? [-0.28, 0, 0.28] : [0];
  for (const t of grids) {
    const x = u + t * width,
      h = high - (arch ? arch * t * t * 2.4 : 0) - 0.065;
    patch(out, s, 'sash', rect(x - 0.034, x + 0.034, low + 0.04, h), plane, c.sash);
  }
  if (high - low > 2.25)
    patch(
      out,
      s,
      'sash',
      rect(left + 0.04, right - 0.04, low + (high - low) * 0.49, low + (high - low) * 0.49 + 0.07),
      plane,
      c.sash,
    );
  for (const x of [left, right])
    patch(out, s, 'trim', rect(x - 0.1, x + 0.1, low - 0.06, high - arch), offset + 0.04, c.dress);
  if (arch) {
    const spring = high - arch;
    const arc = ring.slice(2),
      enlarged = arc.map(([x, y]) => [
        u + (x - u) * (1 + 0.32 / width),
        spring + (y - spring) * (1 + 0.16 / arch),
      ]);
    for (let i = 1; i < arc.length; i++)
      patch(
        out,
        s,
        'trim',
        [arc[i - 1], arc[i], enlarged[i], enlarged[i - 1]],
        offset + 0.045,
        c.dress,
      );
    if (venetian) {
      for (const sign of [-1, 1]) {
        const mid = u + sign * (width / 2 + 0.62);
        patch(
          out,
          s,
          'glass',
          rect(mid - 0.34, mid + 0.34, low, high - arch - 0.18),
          offset + 0.026,
          c.glass,
        );
        patch(
          out,
          s,
          'sash',
          rect(mid - 0.032, mid + 0.032, low, high - arch - 0.18),
          offset + 0.035,
          c.sash,
        );
      }
      patch(
        out,
        s,
        'sash',
        rect(left + 0.04, right - 0.04, spring - 0.055, spring + 0.052),
        plane + 0.002,
        c.sash,
      );
    }
  } else {
    patch(
      out,
      s,
      'trim',
      rect(left - 0.1, right + 0.1, high - 0.04, high + 0.14),
      offset + 0.04,
      c.dress,
    );
  }
  if (lod >= 2)
    patch(
      out,
      s,
      'trim',
      rect(left - 0.19, right + 0.19, low - 0.14, low + 0.005),
      offset + 0.075,
      c.light,
    );
}

function wall(out, s, a, b, bottom, top, windows, tint, lod, offset = 0) {
  const rings = windows.map((w) => profile(w, [0, 4, 7, 9][lod]));
  area(
    out,
    'ashlar',
    rect(a, b, bottom, top),
    (u, y) => s.p(u, y, offset),
    s.normal,
    tint,
    lod >= 2 ? rings : [],
  );
  for (const [i, w] of windows.entries()) window(out, s, w, rings[i], offset, lod);
}
function foundation(out, s) {
  for (let i = 0; i < 5; i++) {
    const a = (s.length * i) / 5,
      b = (s.length * (i + 1)) / 5,
      p = s.p;
    const foot = (u) => {
      const [x, , z] = p(u, 0);
      return p(u, Math.min(plinth - 0.12, grade(x, z) - 0.29));
    };
    directed(out, 'terrace', [foot(a), foot(b), p(b, plinth), p(a, plinth)], s.normal, c.base);
  }
}
function dressFacade(out, s, lod) {
  const L = s.length;
  strip(out, s, 0, L, cornice, 0.51, 0.34, c.cornice);
  if (!lod) return;
  strip(out, s, 0, L, cornice - 0.46, 0.24, 0.23);
  strip(out, s, 0, L, 6.01, 0.3, 0.14, c.cornice);
  if (lod >= 2)
    for (const u of [0.29, L - 0.29]) {
      for (let j = 0; j < 22; j++) {
        const y = 1.18 + j * 0.73,
          d = j % 2 === 0 ? 0.37 : 0.26;
        patch(
          out,
          s,
          'trim',
          rect(Math.max(0, u - d), Math.min(L, u + d), y, y + 0.52),
          0.095,
          c.dress,
        );
      }
    }
}

function lakeside(out, lod) {
  const L = west.length;
  const windows = [];
  for (const [i, x] of plan.westBays.entries()) {
    const u = L / 2 + x,
      end = i === 0 || i === plan.westBays.length - 1;
    windows.push({ u, w: end ? 2.2 : 1.52, low: 1.92, high: 5.17, arch: 0.21 });
    windows.push({
      u,
      w: end ? 2.27 : 1.6,
      low: 6.7,
      high: end ? 12.27 : 10.9,
      arch: end ? 1.15 : 0.22,
      venetian: end,
    });
    windows.push({
      u,
      w: end ? 3.8 : 1.54,
      low: 13.97,
      high: end ? 16.74 : 16.1,
      arch: end ? 1.15 : 0.24,
      venetian: end,
    });
  }
  wall(out, west, 0, L, plinth, cornice, windows, c.west, lod);
  foundation(out, west);
  dressFacade(out, west, lod);
}
function eastFront(out, lod) {
  const L = east.length,
    windows = [];
  for (let i = -3; i <= 3; i++) {
    const u = L / 2 + i * 5.73;
    if (i) windows.push({ u, w: 1.51, low: 0.84, high: 2.61, arch: 0.17 });
    windows.push(
      i
        ? { u, w: 1.82, low: 4.05, high: 8.79, arch: 0.18 }
        : { u, w: 2.32, low: 1.57, high: 6.82, arch: 1.02, door: true },
    );
    windows.push({ u, w: 1.55, low: 12.18, high: 15.4, arch: 0.12 });
  }
  wall(out, east, 0, L, plinth, cornice, windows, c.east, lod);
  foundation(out, east);
  dressFacade(out, east, lod);
  const u = L / 2,
    p = east.p;
  for (const sign of [-1, 1]) {
    const x = u + sign * 1.48;
    beam(out, 'trim', p(x, 1.64, 0.28), p(x, 6.43, 0.28), 0.48, 0.49, c.dress);
  }
  strip(out, east, u - 1.98, u + 1.98, 7.02, 0.44, 0.56);
  for (let i = 0; i < (lod ? 7 : 3); i++) {
    const n = lod ? 7 : 3,
      y = 0.12 + (1.45 * (i + 1)) / n,
      z = Z + (2.26 * (n - i)) / n;
    box(out, 'trim', [-2.12, -0.23, Z - 0.15], [2.12, y, z], c.dress);
  }
}

function endWalls(out, lod) {
  const L = south.length,
    m = L / 2,
    win = [];
  for (const dx of [-9.8, -4.83, 0, 4.83, 9.8])
    win.push({ u: m + dx, w: 1.35, low: 12.18, high: 14.66 });
  for (const dx of [-9.8, -4.83, 0, 4.83, 9.8])
    win.push(
      dx === 0
        ? { u: m, w: 3.26, low: 3.75, high: 9.75, arch: 1.62 }
        : { u: m + dx, w: 1.36, low: 4.51, high: 8.23 },
    );
  const a = m - 7.9,
    b = m + 7.9;
  const panels = [
    [0, a, 0],
    [a, b, 0.36],
    [b, L, 0],
  ];
  for (const [from, to, depth] of panels)
    wall(
      out,
      south,
      from,
      to,
      plinth,
      cornice,
      win.filter((w) => w.u > from && w.u < to),
      c.south,
      lod,
      depth,
    );
  foundation(out, south);
  dressFacade(out, south, lod);
  for (const u of [a, b]) {
    const p = south.p;
    directed(
      out,
      'trim',
      [p(u, plinth), p(u, cornice), p(u, cornice, 0.36), p(u, plinth, 0.36)],
      u === a ? [0, 0, 1] : [0, 0, -1],
      c.dress,
    );
  }
  const p = south.p,
    peak = 20.49,
    low = cornice - 0.03;
  patch(
    out,
    south,
    'ashlar',
    [
      [a - 0.33, low],
      [b + 0.33, low],
      [m, peak],
    ],
    0.41,
    c.south,
  );
  for (const [u, v] of [
    [a - 0.39, low],
    [b + 0.39, low],
  ]) {
    const A = p(u, v, 0.63),
      B = p(m, peak, 0.63),
      C = p(m, peak, -1.18),
      D = p(u, v, -1.18);
    directed(out, 'slate', [A, B, C, D], up, c.slate);
    if (lod) beam(out, 'trim', A, B, 0.26, 0.26, c.dress);
  }
  if (lod) {
    for (const dx of [-7.6, -2.47, 2.47, 7.6])
      patch(
        out,
        south,
        'trim',
        rect(m + dx - 0.19, m + dx + 0.19, 4.02, cornice - 0.78),
        0.411,
        c.dress,
      );
  }
  const nw = [];
  for (const dx of [-9.5, -4.65, 0, 4.65, 9.5]) {
    nw.push({ u: m + dx, w: 1.38, low: 3.36, high: 7.58 });
    nw.push({ u: m + dx, w: 1.3, low: 11.75, high: 14.65 });
  }
  wall(out, north, 0, L, plinth, cornice, nw, c.north, lod);
  foundation(out, north);
  dressFacade(out, north, lod);
}

function stack(out, x, z, w, d, h, pots, lod) {
  const low = 19.26;
  box(out, 'ashlar', [x - w / 2, low, z - d / 2], [x + w / 2, h, z + d / 2], c.south);
  box(
    out,
    'trim',
    [x - w / 2 - 0.14, h - 0.03, z - d / 2 - 0.14],
    [x + w / 2 + 0.14, h + 0.23, z + d / 2 + 0.14],
    c.dress,
  );
  const n = lod ? pots : Math.min(2, pots),
    r = lod ? 0.12 : 0.16;
  for (let i = 0; i < n; i++) {
    const a = x - w / 2 + (w * (i + 0.5)) / n;
    if (lod >= 2)
      loft(
        out,
        'trim',
        [
          [h + 0.17, r * 1.12],
          [h + 0.82, r],
          [h + 0.87, r * 1.19],
        ].map(([y, R]) => radialRing(y, R, R, lod === 3 ? 7 : 5, [a, z])),
        c.pot,
      );
    else box(out, 'trim', [a - r, h + 0.16, z - r], [a + r, h + 0.79, z + r], c.pot);
  }
}
function roof(out, lod) {
  const y = cornice - 0.19,
    a = [-X, y, -Z],
    b = [X, y, -Z],
    d = [X, y, Z],
    e = [-X, y, Z];
  const r = [-15.5, ridge, 0.1],
    s = [15.5, ridge, 0.1];
  directed(out, 'slate', [a, b, s, r], up, c.slate);
  directed(out, 'slate', [e, r, s, d], up, c.slate);
  directed(out, 'slate', [a, r, e], up, c.slate);
  directed(out, 'slate', [b, d, s], up, c.slate);
  if (lod) beam(out, 'slate', r, s, 0.2, 0.24, c.slate);
  for (const [x, z, w, d, h, pots] of [
    [-13.8, -2.4, 2.9, 1.74, 23.51, 5],
    [-7.9, 2.3, 3.6, 1.63, 22.92, 6],
    [0.3, -0.7, 8.2, 1.92, 24.03, 11],
    [12.0, 2.57, 4.64, 1.68, 22.65, 7],
    [17.02, -1.1, 2.65, 1.68, 23.48, 4],
  ])
    stack(out, x, z, w, d, h, pots, lod);
  const x0 = -3.8,
    x1 = 3.8,
    z = 11.72,
    base = 18.0;
  const attic = [
    [x0, base],
    [x1, base],
    [3.1, 18.8],
    [2.42, 18.97],
    [1.83, 19.83],
    [1.36, 20.18],
    [-1.36, 20.18],
    [-1.83, 19.83],
    [-2.42, 18.97],
    [-3.1, 18.8],
  ];
  area(out, 'ashlar', attic, (x, y) => [x, y, z], [0, 0, 1], c.east);
  for (let i = 1; i < attic.length; i++) {
    const a = attic[i],
      b = attic[(i + 1) % attic.length];
    directed(
      out,
      'slate',
      [
        [...a, z],
        [...b, z],
        [...b, z - 1.78],
        [...a, z - 1.78],
      ],
      [b[1] - a[1], a[0] - b[0], 0],
      c.slate,
    );
  }
  if (lod) {
    area(
      out,
      'glass',
      rect(-0.51, 0.51, 18.54, 19.62),
      (x, y) => [x, y, z + 0.02],
      [0, 0, 1],
      c.glass,
    );
    for (let i = 1; i < attic.length - 1; i++)
      beam(out, 'trim', [...attic[i], z + 0.09], [...attic[i + 1], z + 0.09], 0.13, 0.14, c.dress);
  }
  for (const x of [-X + 0.42, X - 0.42])
    for (const z0 of [-Z + 0.37, Z - 0.37]) {
      box(
        out,
        'trim',
        [x - 0.32, cornice, z0 - 0.32],
        [x + 0.32, cornice + 0.31, z0 + 0.32],
        c.dress,
      );
      if (lod)
        loft(
          out,
          'trim',
          [
            [cornice + 0.29, 0.13],
            [cornice + 0.5, 0.18],
            [cornice + 0.74, 0.26],
            [cornice + 0.94, 0.19],
            [cornice + 1.11, 0.11],
            [cornice + 1.22, 0.03],
          ].map(([h, r0]) => radialRing(h, r0, r0, lod >= 2 ? 7 : 5, [x, z0])),
          c.dress,
        );
    }
}

function balustrade(out, a, b, y, lod) {
  const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const n = lod >= 2 ? Math.round(len / 0.66) : lod ? Math.max(2, Math.round(len / 3.65)) : 2;
  beam(out, 'trim', [a[0], y + 0.98, a[1]], [b[0], y + 0.98, b[1]], 0.25, 0.18, c.dress);
  if (lod) beam(out, 'trim', [a[0], y + 0.14, a[1]], [b[0], y + 0.14, b[1]], 0.24, 0.16, c.dress);
  for (let i = 0; i <= n; i++) {
    const [x, z] = mix(a, b, i / n),
      r = lod >= 2 && i % 8 !== 0 ? 0.083 : 0.24;
    if (lod === 3 && r < 0.1)
      loft(
        out,
        'trim',
        [
          [y + 0.16, r * 1.22],
          [y + 0.42, r * 0.73],
          [y + 0.66, r * 1.12],
          [y + 0.89, r],
        ].map(([h, R]) => radialRing(h, R, R, 5, [x, z])),
        c.dress,
      );
    else box(out, 'trim', [x - r, y + 0.1, z - r], [x + r, y + 0.93, z + r], c.dress);
  }
}
function terrace(out, lod) {
  const y = westTerrace,
    z = -21.88,
    a = -32.25,
    b = X - 0.2,
    stairsL = 12.1,
    stairsR = 19.32;
  box(out, 'terrace', [a, -1.42, z], [b, y, -Z + 0.1], c.paving);
  for (const [p, q] of [
    [
      [a, z],
      [stairsL, z],
    ],
    [
      [stairsR, z],
      [b, z],
    ],
    [
      [b, z],
      [b, -Z],
    ],
  ])
    balustrade(out, p, q, y, lod);
  const count = lod ? 14 : 4;
  const foot = grade((stairsL + stairsR) / 2, z - 4.45) - 0.05;
  for (let i = 0; i < count; i++) {
    const top = foot + ((y - foot) * (i + 1)) / count;
    box(
      out,
      'terrace',
      [stairsL, foot - 0.35, z - (4.48 * (count - i)) / count],
      [stairsR, top, z + 0.14],
      c.dress,
    );
  }
  const h = 5.21,
    x0 = -32.38,
    x1 = -X + 0.03,
    w0 = -Z - 0.02,
    w1 = 3.13;
  const s = section([x0, w0], [x1, w0]);
  wall(
    out,
    s,
    0,
    s.length,
    y,
    h,
    [
      { u: 2.04, w: 1.3, low: y + 0.18, high: h - 0.48 },
      { u: 6.37, w: 1.3, low: y + 0.18, high: h - 0.48 },
    ],
    c.south,
    lod,
  );
  box(out, 'terrace', [x0, -0.92, w0], [x1, y, w1], c.base);
  box(out, 'terrace', [x0 + 0.05, h - 0.17, w0 + 0.03], [x1, h, w1], c.paving);
  box(out, 'ashlar', [x0, y, w0 + 0.02], [x0 + 0.18, h, w1], c.south);
  box(out, 'ashlar', [x0, y, w1 - 0.17], [x1, h, w1], c.south);
  balustrade(out, [x0, w0], [x1, w0], h, lod);
  balustrade(out, [x0, w1], [x0, w0], h, lod);
}
function build(out, lod) {
  lakeside(out, lod);
  eastFront(out, lod);
  endWalls(out, lod);
  roof(out, lod);
  terrace(out, lod);
}
export const manorSkyline = (out) => build(out, 0);
export const manorDistrict = (out) => build(out, 1);
export const manorStreet = (out) => build(out, 2);
export const manorCloseup = (out) => build(out, 3);

const recipe = 'westport-house-model.mjs',
  camera = [-59, 30, -74],
  lookAt = [-1, 9.3, -3.3];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'manorDistrict', 0.57],
    ['street', 'manorStreet', 0.19],
    ['closeup', 'manorCloseup', 0.056],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const manorModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: manorCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Grey limestone Palladian house, low slate roof with large chimney stacks, south pediment and lake-facing balustraded terraces.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-25, 28, -29],
  mediumFiContext: {
    scale: 2.15,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'Named Westport House footprint from OpenStreetMap way 102849613.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_raw',
    'slate',
    'stone_limestone_weathered',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'west-lake-terrace-and-sashes',
      position: [8.4, 13.2, -64],
      lookAt: [-3.5, 10.1, -13.2],
    },
    { name: 'south-pediment-and-stonework', position: [-62, 16, -17], lookAt: [-23, 10.6, 0.5] },
    { name: 'east-entrance-and-roof-stacks', position: [15, 19, 56], lookAt: [0, 9.7, 10.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-westport-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'manorSkyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped house outline is ODbL. The two selected Qualla photographs are CC0.',
};
