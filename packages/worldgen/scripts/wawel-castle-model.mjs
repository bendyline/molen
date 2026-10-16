/** Original current Wawel palace exterior from separately attributed map controls. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u2y/n0299_wawel_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
export const wawelPalette = {
  wall: '#eae1cc',
  trim: '#e9ddc7',
  brick: '#ce997a',
  roof: '#ca785c',
  darkRoof: '#7b684f',
  copper: '#b0cec5',
  stone: '#d8c7a6',
  glass: '#4d6178',
  paving: '#b6ada0',
  dark: '#756957',
  gold: '#cab874',
  fresco: '#d5ad89',
};
export const wawelSurfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
};
const colors = Object.fromEntries(
  Object.entries(wawelPalette).map(([key, h]) => [
    key,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const circle = (c, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
function face(o, p, color = 'wall', slot = 'plaster', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((p) => [p[0], p[2]]),
      colors[color],
    );
  }
}
function cap(o, p, y, color = 'stone', slot = 'stone') {
  p = clean(p);
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(o, p, y0, y1, color = 'wall', slot = 'plaster', top = false) {
  p = clean(p);
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  if (top) cap(o, p, y1, color, slot);
}
function openings(route, width, height, baseY, d) {
  return route.slice(1).map((b, i) => {
    const a = route[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return prepareOpening(
      {
        center: a.map((v, j) => (v + b[j]) / 2),
        axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
        width,
        height,
        spring: height - width / 2,
        depth: len + 0.8,
        baseY,
        bottom: 0,
        shape: 'round',
      },
      baseY,
      d,
    );
  });
}
function ridgePoint(p, r) {
  const [a, b] = r.ridge,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return [a[0] + t * dx, r.eaveY + r.rise, a[1] + t * dz];
}
/** Boundary fans retain every mapped wing edge, including clipped corners. */
function roof(o, r) {
  const p = clean(r.outline);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      aa = [a[0], r.eaveY, a[1]],
      bb = [b[0], r.eaveY, b[1]],
      ra = ridgePoint(a, r),
      rb = ridgePoint(b, r);
    face(o, [aa, bb, rb, ra], r.color ?? 'roof', 'tile', [0, 1, 0]);
  }
}
function roofHeight(r, x, z) {
  let height = -Infinity;
  roof(
    {
      addTriangle: (_s, _r, p) => {
        const [a, b, c] = p,
          den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(den) < 1e-8) return;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
          v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
        if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001)
          height = Math.max(height, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
      },
    },
    r,
  );
  return height;
}
function band(o, a, b, y, width = 0.2, height = 0.22, color = 'trim', slot = 'stone') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) return;
  const n = [((b[1] - a[1]) * width) / (2 * len), (-(b[0] - a[0]) * width) / (2 * len)];
  prism(
    o,
    [
      [a[0] + n[0], a[1] + n[1]],
      [b[0] + n[0], b[1] + n[1]],
      [b[0] - n[0], b[1] - n[1]],
      [a[0] - n[0], a[1] - n[1]],
    ],
    y,
    y + height,
    color,
    slot,
    true,
  );
}
function surfacePane(o, c, u, width, height, d, n) {
  const at = (x, y) => [c[0] + u[0] * x, y, c[2] + u[1] * x];
  face(
    o,
    [
      at(-width / 2, c[1]),
      at(width / 2, c[1]),
      at(width / 2, c[1] + height),
      at(-width / 2, c[1] + height),
    ],
    'glass',
    'glass',
    n,
  );
  if (d < 2) return;
  const edge = (x0, x1, y0, y1) =>
    face(o, [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], 'trim', 'stone', n);
  const t = 0.15;
  edge(-width / 2 - t, -width / 2, c[1] - 0.15, c[1] + height + 0.15);
  edge(width / 2, width / 2 + t, c[1] - 0.15, c[1] + height + 0.15);
  edge(-width / 2, width / 2, c[1] - 0.15, c[1]);
  edge(-width / 2, width / 2, c[1] + height, c[1] + height + 0.15);
  if (d === 3) {
    edge(-0.07, 0.07, c[1], c[1] + height);
    edge(-width / 2, width / 2, c[1] + height * 0.55 - 0.07, c[1] + height * 0.55 + 0.07);
  }
}
function facade(o, p, y0, height, d, slot = 'plaster', normalSign, skip) {
  if (!d) return;
  p = clean(p);
  const sign = normalSign ?? Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (skip?.(a, b)) continue;
    const y1 = typeof height === 'function' ? height(a.map((v, j) => (v + b[j]) / 2)) : height;
    if (len < 3.7) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], 0, -sign * u[0]],
      count = Math.floor(len / (d === 1 ? 12 : d === 2 ? 5.5 : 4.7));
    for (let j = 0; j < count; j++)
      for (let floor = 0; floor < (d === 1 ? 2 : 3); floor++) {
        const x = ((j + 0.5) * len) / count,
          y = y0 + 2.1 + (floor * (y1 - y0 - 3.8)) / 3;
        if (y + 2.25 > y1 - 0.6) continue;
        const c = [a[0] + u[0] * x + n[0] * 0.04, y, a[1] + u[1] * x + n[2] * 0.04];
        // The Berrecci portal keeps its glazing-free physical opening.
        if (c[0] < -20 && c[0] > -53 && c[2] > -23 && c[2] < -10 && floor === 0) continue;
        surfacePane(o, c, u, d === 1 ? 1.4 : 1.65, 2.25, d, n);
      }
    if (d >= 2)
      for (const y of [y0 + 5.7, y0 + 12.2, y1 - 0.4])
        if (y < y1) band(o, a, b, y, 0.15, 0.18, 'trim', slot === 'brick' ? 'brick' : 'stone');
  }
}
function boundary(o, p, y0, height, holes, inner = false, color = 'wall', slot = 'plaster', skip) {
  p = clean(p);
  const sign = Math.sign(area(p)) * (inner ? -1 : 1);
  const emit = (s, ref, p, n, uv, c, target = n) => {
    let q = p.map((p) => p.map(Math.fround));
    const nn = normalFor(...q);
    if (nn.reduce((sum, v, j) => sum + v * target[j], 0) < 0) q = [q[0], q[2], q[1]];
    const a = q[1].map((v, j) => v - q[0][j]),
      b = q[2].map((v, j) => v - q[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      return;
    o.addTriangle(s, ref, q, normalFor(...q), uv, c);
  };
  const out = {
    addTriangle: (s, r, p, n, u, c) =>
      openingBuilder(
        { addTriangle: (s, r, q, nn, u, c) => emit(s, r, q, nn, u, c, n) },
        holes,
      ).addTriangle(s, r, p, n, u, c),
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      mid = a.map((v, j) => (v + b[j]) / 2);
    if (skip?.(a, b)) continue;
    const top = typeof height === 'function' ? height(mid) : height;
    face(
      out,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  if (holes.length)
    openingReveals(
      {
        addTriangle: (_s, r, p, n, u, c) => {
          const plane = holes
            .flatMap((h) => h.planes.slice(2))
            .find((v) =>
              p.every((q) => Math.abs(q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3]) < 0.003),
            );
          emit(slot, r, p, n, u, c, plane?.slice(0, 3) ?? n);
        },
      },
      p,
      () => y0,
      (p) => (typeof height === 'function' ? height(p) : height),
      holes,
      colors[color],
    );
}
function main(o, d) {
  const outer = frame.geometry.outline;
  const inner = clean(frame.geometry.holes[0]).map((p) => [
    p[0] + (p[0] > 28 ? 3.2 : p[0] < -21 && p[1] < -15 ? -3.2 : 0),
    p[1] + (p[1] < -38 ? -3.2 : p[1] > 25 ? 2.3 : 0),
  ]);
  const exteriorHeight = ([x, z]) =>
    x > 35 && z < -26 && z > -51
      ? 30.2
      : (x < -32 && z > -25) || (x < 0 && z > -19) || (z > 28 && x < 25)
        ? 20.2
        : k.main.eaveY;
  const interiorHeight = ([x, z]) =>
    z > 26 ? k.curtain.topY : x < 0 && z > -19 ? 20.2 : k.main.eaveY;
  const towerEdge = (a, b) =>
    k.cornerTowers.some((t) => {
      const p = a.map((v, j) => (v + b[j]) / 2);
      return Math.abs(p[0] - t.center[0]) < 6.1 && Math.abs(p[1] - t.center[1]) < 6.4;
    });
  const holes = d
    ? [
        ...openings(k.gate.route, k.gate.width, k.gate.height, k.gate.baseY, d),
        ...openings(
          k.southPassage.route,
          k.southPassage.width,
          k.southPassage.height,
          k.southPassage.baseY,
          d,
        ),
      ]
    : [];
  // Draw the palace envelope once; overlapping mapped roof parts are not extra walls.
  if (d >= 2) boundary(o, outer, 0, k.courtyardAttachmentY, [], false, 'stone', 'stone');
  boundary(
    o,
    outer,
    d >= 2 ? k.courtyardAttachmentY : 0,
    exteriorHeight,
    holes,
    false,
    'wall',
    'plaster',
    towerEdge,
  );
  boundary(o, inner, k.courtyardAttachmentY, interiorHeight, holes, true);
  facade(o, outer, k.courtyardAttachmentY, exteriorHeight, d, 'plaster', undefined, towerEdge);
  facade(o, inner, k.courtyardAttachmentY, interiorHeight, d, 'plaster', -Math.sign(area(inner)));
  for (const r of k.roofs) roof(o, r);
  if (d) cap(o, frame.geometry.holes[0], k.courtyardFloorY, 'paving', 'aggregate');
}
function profile(o, c, rings, n, color = 'copper', slot = 'patina') {
  for (let j = 1; j < rings.length; j++) {
    const [y0, r0] = rings[j - 1],
      [y1, r1] = rings[j],
      a = circle(c, r0, n),
      b = circle(c, r1, n);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      face(
        o,
        [
          [a[i][0], y0, a[i][1]],
          [a[next][0], y0, a[next][1]],
          [b[next][0], y1, b[next][1]],
          [b[i][0], y1, b[i][1]],
        ],
        color,
        slot,
        [(a[i][0] + a[next][0]) / 2 - c[0], 0, (a[i][1] + a[next][1]) / 2 - c[1]],
      );
    }
  }
}
function towers(o, d) {
  for (const tower of k.cornerTowers) {
    prism(o, tower.outline, k.courtyardAttachmentY, tower.bodyY);
    facade(o, tower.outline, k.courtyardAttachmentY, tower.bodyY, d);
    const y = tower.bodyY,
      r = 5.2;
    profile(
      o,
      tower.center,
      [
        [y, r],
        [y + 0.8, 5.5],
        [y + 2.4, 4.3],
        [y + 3.6, 2.0],
        [y + 4.7, 1.5],
        [y + 7, 1.5],
        [y + 8.1, 2],
        [y + 9.1, 1.4],
        [y + tower.helmRise, 0.08],
      ],
      d === 0 ? 8 : d === 1 ? 12 : 16,
    );
    if (d) {
      for (const h of d >= 2 ? [y + 4.6, y + 7.0] : [])
        profile(
          o,
          tower.center,
          [
            [h, 1.85],
            [h + 0.18, 1.85],
          ],
          12,
        );
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2,
          n = [Math.cos(a), 0, Math.sin(a)],
          u = [-n[2], n[0]];
        surfacePane(
          o,
          [tower.center[0] + n[0] * 1.52, y + 4.8, tower.center[1] + n[2] * 1.52],
          u,
          0.6,
          1.7,
          1,
          n,
        );
      }
      prism(
        o,
        rect(...tower.center, 0.24, 0.24),
        y + tower.helmRise,
        y + tower.helmRise + 1.3,
        'gold',
        'stone',
        true,
      );
    }
  }
  const t = k.senator;
  prism(o, t.outline, t.baseY, t.eaveY, 'brick', 'brick');
  roof(o, {
    outline: t.outline,
    eaveY: t.eaveY,
    rise: t.roofRise,
    ridge: [
      [8.8, 47.2],
      [11.1, 48.2],
    ],
  });
  facade(o, t.outline, t.baseY, t.eaveY, d, 'brick');
  if (d >= 1)
    for (let i = 0; i < t.outline.length; i++) {
      const a = t.outline[i],
        b = t.outline[(i + 1) % t.outline.length];
      band(o, a, b, t.eaveY - 1.7, 0.65, 0.9, 'trim');
      if (d >= 2) {
        const mid = a.map((v, j) => (v + b[j]) / 2);
        prism(o, rect(...mid, 0.6, 0.6), t.eaveY - 2.4, t.eaveY - 1.7, 'brick', 'brick', true);
      }
    }
  const j = k.jordanka;
  prism(o, j.outline, j.baseY, j.eaveY, 'brick', 'brick');
  profile(
    o,
    j.center,
    [
      [j.eaveY, 5.1],
      [j.eaveY + j.roofRise, 0.1],
    ],
    d === 0 ? 8 : 12,
  );
  facade(o, j.outline, j.baseY, j.eaveY, d, 'brick');
}
function galleryPoint(g, x, depth, y) {
  const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]),
    u = g.b.map((v, i) => (v - g.a[i]) / len);
  let n = [-u[1], u[0]];
  if (n.reduce((s, v, i) => s + v * g.inward[i], 0) < 0) n = n.map((v) => -v);
  return [g.a[0] + u[0] * x + n[0] * depth, y, g.a[1] + u[1] * x + n[1] * depth];
}
/** Solid spandrels above physically empty archways, two galleries and tall top columns. */
function galleries(o, d) {
  const floors = [k.courtyardFloorY, 14.1, 20.5],
    top = k.main.eaveY;
  for (const g of k.galleries) {
    const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]),
      pitch = len / g.bays;
    if (!d) {
      band(o, g.a, g.b, 20.5, 0.7, 0.7);
      continue;
    }
    for (const y of floors.slice(1)) {
      const p = [
        galleryPoint(g, 0, -3.2, y),
        galleryPoint(g, len, -3.2, y),
        galleryPoint(g, len, 0.3, y),
        galleryPoint(g, 0, 0.3, y),
      ];
      face(o, p, 'stone', 'stone', [0, 1, 0]);
      band(o, g.a, g.b, y, 0.6, 0.24);
    }
    for (let i = 0; i <= g.bays; i++) {
      const c = galleryPoint(g, i * pitch, 0, 0);
      const meetsGate = g.key === 'west-north' && i === g.bays;
      if (d === 1) {
        prism(o, rect(c[0], c[2], 0.65, 0.65), floors[meetsGate ? 1 : 0], top, 'trim', 'stone');
        continue;
      }
      for (let tier = 0; tier < 3; tier++) {
        if (meetsGate && tier === 0) continue;
        const y0 = floors[tier],
          y1 = tier < 2 ? floors[tier + 1] : top;
        prism(
          o,
          circle([c[0], c[2]], tier === 2 ? 0.28 : 0.36, d === 2 ? 6 : 8),
          y0,
          y1,
          'trim',
          'stone',
          true,
        );
        if (d === 3 || tier === 2)
          for (const y of [y0, y1 - 0.25])
            prism(o, rect(c[0], c[2], 0.85, 0.85), y, y + 0.25, 'trim', 'stone', true);
      }
    }
    for (let bay = 0; bay < g.bays; bay++)
      for (let tier = 0; tier < 2; tier++) {
        const center = (bay + 0.5) * pitch,
          r = pitch / 2 - 0.34,
          y0 = floors[tier],
          yTop = floors[tier + 1] - 0.05,
          spring = y0 + (yTop - y0 - r - 0.6),
          n = d === 1 ? 2 : d === 2 ? 6 : 12;
        for (let i = 0; i < n; i++) {
          const x0 = -r + (2 * r * i) / n,
            x1 = -r + (2 * r * (i + 1)) / n,
            h0 = spring + Math.sqrt(Math.max(0, r * r - x0 * x0)),
            h1 = spring + Math.sqrt(Math.max(0, r * r - x1 * x1));
          for (const depth of [-0.32, 0.2]) {
            const v = [
                galleryPoint(g, center + x0, depth, h0),
                galleryPoint(g, center + x1, depth, h1),
                galleryPoint(g, center + x1, depth, yTop),
                galleryPoint(g, center + x0, depth, yTop),
              ],
              p = galleryPoint(g, 0, 1, 0),
              q = galleryPoint(g, 0, 0, 0),
              sign = depth > 0 ? 1 : -1;
            face(o, v, 'trim', 'stone', [(p[0] - q[0]) * sign, 0, (p[2] - q[2]) * sign]);
          }
          face(
            o,
            [
              galleryPoint(g, center + x0, -0.32, h0),
              galleryPoint(g, center + x1, -0.32, h1),
              galleryPoint(g, center + x1, 0.2, h1),
              galleryPoint(g, center + x0, 0.2, h0),
            ],
            'trim',
            'stone',
            [0, -1, 0],
          );
        }
        if (tier === 1) {
          const a = galleryPoint(g, bay * pitch, 0, 0),
            b = galleryPoint(g, (bay + 1) * pitch, 0, 0);
          band(o, [a[0], a[2]], [b[0], b[2]], y0 + 0.9, 0.24, 0.2);
          if (d === 3)
            for (let bar = 1; bar < 5; bar++) {
              const c = galleryPoint(g, (bay + bar / 5) * pitch, 0, 0);
              prism(o, rect(c[0], c[2], 0.2, 0.2), y0 + 0.15, y0 + 0.9, 'trim', 'stone', true);
            }
        }
      }
  }
  const c = k.curtain;
  cap(o, c.outline, c.topY, 'stone', 'stone');
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = c.outline[0],
        b = c.outline[7],
        p = a.map((v, j) => v + ((b[j] - v) * i) / 7);
      prism(o, rect(...p, 0.9, 0.9), c.topY, c.topY + 1.1, 'trim', 'stone', true);
    }
}
function ornaments(o, d) {
  if (d < 2) return;
  for (const r of k.roofs.filter((r) =>
    ['north', 'east', 'west-court', 'south-west'].includes(r.key),
  )) {
    const [a, b] = r.ridge,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      u = [dx / len, dz / len],
      n = [-u[1], u[0]],
      count = r.key === 'north' ? 6 : r.key === 'east' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        c = a.map((v, j) => v + (b[j] - v) * t),
        base = r.eaveY + r.rise;
      prism(o, rect(...c, 1.15, 1.4), base - 0.3, base + 3.4, 'wall', 'plaster', true);
      prism(o, rect(...c, 1.6, 1.85), base + 3.2, base + 3.65, 'trim', 'stone', true);
    }
    for (let i = 0; i < count - 1; i++) {
      const t = (i + 1) / count,
        side = r.key === 'north' ? 1 : r.key === 'east' ? 1 : -1,
        c = a.map((v, j) => v + (b[j] - v) * t + n[j] * side * 3.2),
        w = 1.75,
        dep = 1.9;
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => [
        c[0] + (u[0] * x * w) / 2 + (n[0] * z * dep) / 2,
        c[1] + (u[1] * x * w) / 2 + (n[1] * z * dep) / 2,
      ]);
      const feet = corners.map((p) => roofHeight(r, ...p));
      if (feet.some((v) => !Number.isFinite(v))) continue;
      const top = Math.max(...feet) + 1.1;
      for (let j = 0; j < 4; j++) {
        const a = corners[j],
          b = corners[(j + 1) % 4];
        face(
          o,
          [
            [a[0], feet[j] - 0.05, a[1]],
            [b[0], feet[(j + 1) % 4] - 0.05, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          'wall',
          'plaster',
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      }
      const aa = [c[0] - (n[0] * dep) / 2, top + 1, c[1] - (n[1] * dep) / 2],
        bb = [c[0] + (n[0] * dep) / 2, top + 1, c[1] + (n[1] * dep) / 2];
      face(
        o,
        [[corners[0][0], top, corners[0][1]], [corners[3][0], top, corners[3][1]], bb, aa],
        'roof',
        'tile',
        [0, 1, 0],
      );
      face(
        o,
        [[corners[1][0], top, corners[1][1]], [corners[2][0], top, corners[2][1]], bb, aa],
        'roof',
        'tile',
        [0, 1, 0],
      );
      const front = [
        c[0] + n[0] * side * (dep / 2 + 0.03),
        top - 0.9,
        c[1] + n[1] * side * (dep / 2 + 0.03),
      ];
      surfacePane(o, front, u, 0.9, 0.8, 2, [n[0] * side, 0, n[1] * side]);
    }
  }
}
export const wawelParts = { main, towers, galleries, ornaments };
export function buildWawelRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const build of Object.values(wawelParts)) build(o, d);
}
export const buildWawelSkyline = (o) => buildWawelRuntime(o, 'skyline');
export const wawelStudy = {
  id: 'N0299',
  key: 'wawel_castle',
  title: 'Wawel Castle',
  category: 'castle',
  wikidataId: 'Q18820',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildWawelRuntime(o),
  surfaceOverrides: wawelSurfaces,
  brief:
    'Current Wawel royal palace with open irregular Renaissance courtyard, two arcaded gallery tiers and tall upper columns, steep red roofs, two copper Baroque corner helms, eastern Danish/Jordanka projections, adjacent brick Senator tower and physically open Berrecci gate.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: wawelPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Open Renaissance courtyard within steep red palace roofs',
      'Two northern copper Baroque corner helms',
      'Tall brick Senator tower and southern curtain wall',
    ],
  },
  sourceFacts: {
    exactPalaceRelation: 2270819,
    courtyardHoleWay: 117749419,
    residentialWings: 3,
    lowerArcadedGalleryTiers: 2,
    upperTallColumnTier: 1,
    baroqueCornerTowers: 2,
    numericPrimaryVerticalHeightVerified: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'surface-means.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own map traces © OpenStreetMap contributors, ODbL-1.0. Primary photographs are not redistributed.',
  sourceNotice:
    'Six existing shared 256-square graphs, linear tints and central metric UV repeats. Flat glass. No embedded/new image, photo texture, downloaded model or traced printed drawing.',
  dataAttribution: '© OpenStreetMap contributors; Wawel Royal Castle; City of Kraków.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: k.courtyardAttachmentY,
    reviewStatus:
      'Inactive draft: actual hill terrain, courtyard and gate slope remain unverified.',
  }),
  geographicNote:
    'Native East/South geometry bakes heading 0 from own attributed map traces. Provisional courtyard attachment Y8.2 and Senator toe Y0 require real terrain and vertical-datum review.',
  limitations: refs.limitations,
  importReason:
    'Preserve open courtyard and galleries, steep red palace roofs, two copper northern helms, Senator tower and current gate through four source-authored detail levels.',
  mediumFiContext: { scale: '1.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [150, 115, 160], lookAt: [-2, 23, -5], fov: 42 },
  qaCameras: [
    { name: 'courtyard-galleries', position: [-3, 26, 17], lookAt: [6, 20, -31] },
    { name: 'court-plan', position: [0, 170, -5], lookAt: [0, 20, -5] },
    { name: 'northern-copper-helms', position: [8, 65, -160], lookAt: [3, 31, -50] },
    { name: 'senator-and-south-wall', position: [52, 52, 110], lookAt: [10, 24, 35] },
    { name: 'berrecci-entry', position: [-92, 24, 1], lookAt: [-40, 13, -16] },
    { name: 'eastern-pavilion', position: [118, 50, -20], lookAt: [45, 27, -23] },
  ],
};
