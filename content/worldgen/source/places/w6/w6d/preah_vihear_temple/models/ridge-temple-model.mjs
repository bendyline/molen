import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.99 },
  carved: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  pavement: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 1 },
};

const stone = rgb('92816c'),
  capstone = rgb('a2947e'),
  dirty = rgb('7d7668'),
  lintel = rgb('a68d6b'),
  recess = rgb('655949');
const shades = ['a1957d', 'a39881', '9c907b', '9c907e'].map(rgb);
const box = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];

function ccw(points) {
  const area = points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? points : points.toReversed();
}

function face(out, slot, points, color, target) {
  let p = points.map((q) => q.map(Math.fround));
  if (target && normalFor(...p).reduce((sum, v, i) => sum + v * target[i], 0) < 0)
    p = p.toReversed();
  for (let i = 1; i + 1 < p.length; i++) {
    const q = [p[0], p[i], p[i + 1]],
      n = normalFor(...q);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', q, n, [], color);
  }
}

function cap(out, slot, [ring, ...holes], height, color) {
  const b = new MeshBufferBuilder();
  if (!b.addCap('trim', 'palette:#ffffff', ring, holes, height, [0, 1, 0], (p) => p, color))
    throw Error('Invalid Preah Vihear footprint');
  const { positions, indices } = b.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => 3 * indices[i + j]);
    face(
      out,
      slot,
      p.map((k) => positions.slice(k, k + 3)),
      color,
    );
  }
}

function prism(out, slot, poly, ground, height, color) {
  const [ring, ...holes] = poly;
  const level = typeof ground === 'function' ? ground : () => ground;
  const top = (p) => level(p) + height;
  for (const r of [ccw(ring), ...holes.map((h) => ccw(h).toReversed())]) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(
        out,
        slot,
        [
          [a[0], level(a), a[1]],
          [b[0], level(b), b[1]],
          [b[0], top(b), b[1]],
          [a[0], top(a), a[1]],
        ],
        color,
      );
    }
  }
  cap(out, slot, poly, top, color);
}

function block(out, slot, x0, x1, z0, z1, base, height, color) {
  prism(out, slot, [box(x0, x1, z0, z1)], base, height, color);
}

function frame(out, x, y, z, w, h, detail) {
  const d = detail === 0 ? 0.56 : 0.79;
  const shaft = 0.54 + w * 0.07;
  for (const s of [-1, 1]) {
    const x0 = x + s * (w * 0.5 + shaft * 0.46);
    block(out, 'carved', x0 - shaft / 2, x0 + shaft / 2, z - d, z + d, y, h, capstone);
    if (detail >= 2)
      for (const [v, dy] of [
        [y, 0.26],
        [y + 0.27, 0.13],
        [y + h - 0.39, 0.2],
        [y + h - 0.16, 0.17],
      ])
        block(
          out,
          'carved',
          x0 - shaft * 0.67,
          x0 + shaft * 0.67,
          z - d - 0.16,
          z + d + 0.16,
          v,
          dy,
          lintel,
        );
  }
  block(
    out,
    'carved',
    x - w * 0.5 - shaft,
    x + w * 0.5 + shaft,
    z - d - 0.13,
    z + d + 0.13,
    y + h,
    0.49,
    lintel,
  );
  if (detail >= 1)
    block(
      out,
      'carved',
      x - w * 0.5 - shaft - 0.21,
      x + w * 0.5 + shaft + 0.21,
      z - d - 0.28,
      z + d + 0.28,
      y + h + 0.42,
      0.17,
      capstone,
    );
}

function pediment(out, x, y, z, w, height, detail) {
  const s =
    detail === 0
      ? [
          [-1, 0.21],
          [0, 1],
          [1, 0.21],
        ]
      : [
          [-1, 0.54],
          [-0.86, 0.24],
          [-0.64, 0.26],
          [-0.36, 0.6],
          [0, 1],
          [0.36, 0.6],
          [0.64, 0.26],
          [0.86, 0.24],
          [1, 0.54],
        ];
  const h = (q) => q * height;
  for (let i = 1; i < s.length; i++) {
    const [a, u] = s[i - 1],
      [b, v] = s[i];
    const x0 = x + (a * w) / 2,
      x1 = x + (b * w) / 2;
    for (const k of [-1, 1])
      face(
        out,
        'carved',
        [
          [x0, y, z + k * 0.58],
          [x1, y, z + k * 0.58],
          [x1, y + h(v), z + k * 0.58],
          [x0, y + h(u), z + k * 0.58],
        ],
        lintel,
        [0, 0, k],
      );
    face(
      out,
      'rock',
      [
        [x0, y + h(u), z - 0.58],
        [x1, y + h(v), z - 0.58],
        [x1, y + h(v), z + 0.58],
        [x0, y + h(u), z + 0.58],
      ],
      dirty,
      [0, 1, 0],
    );
    if (detail >= 2)
      for (const k of [-1, 1]) {
        beam(
          out,
          'carved',
          [x0, y + h(u) - 0.12, z + k * 0.63],
          [x1, y + h(v) - 0.12, z + k * 0.63],
          0.18,
          0.28,
          capstone,
        );
        beam(
          out,
          'carved',
          [x0, y + h(u) * 0.66, z + k * 0.63],
          [x1, y + h(v) * 0.66, z + k * 0.63],
          0.16,
          0.2,
          stone,
        );
      }
  }
}

function gate(out, g, detail, index) {
  const {
    outline,
    walls,
    ground,
    width,
    eave,
    front,
    back,
    center: [x],
  } = g;
  if (detail === 0) {
    for (const passage of g.passages) cap(out, 'pavement', passage, () => ground + 0.65, capstone);
  } else prism(out, 'pavement', [outline], ground - 5.3, 5.95, capstone);
  for (const p of walls) {
    const offset = detail === 0 ? -5.3 : 0.634;
    const start = ground + offset;
    prism(out, index === 3 ? 'rubble' : 'rock', p, start, eave - offset, stone);
    if (detail >= 1) {
      prism(out, 'carved', p, start + 0.02, 0.31, capstone);
      prism(out, 'carved', p, ground + eave - 0.39, 0.53, dirty);
    }
  }
  const h = index === 3 ? 2.54 : index === 1 ? 3.38 : 3.82;
  const rise = index === 0 ? 2.48 : index === 1 ? 1.92 : index === 2 ? 3.26 : 1.49;
  frame(out, x, ground + 0.65, front, width, h, detail);
  pediment(out, x, ground + h + 1.23, front, width + 2.0, rise, detail);
  if (detail >= 2) wallDetails(out, g, detail);
  if (detail > 0) {
    frame(out, x, ground + 0.65, back, width, h - 0.15, detail);
    pediment(out, x, ground + h + 1.08, back, width + 1.65, rise * 0.82, detail);
  }
}

function wallDetails(out, { outline, eave, ground, width, center: [axis] }, detail) {
  const ring = ccw(outline);
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    const length = Math.hypot(u - x, v - z);
    if (length < 5.5) continue;
    const dx = (u - x) / length,
      dz = (v - z) / length;
    const at = (p, y, q) => [x + dx * p - dz * q, y, z + dz * p + dx * q];
    const normal = [-dz, 0, dx];
    const band = (a, b, y, h, q, slot, color) =>
      face(out, slot, [at(a, y, q), at(b, y, q), at(b, y + h, q), at(a, y + h, q)], color, normal);
    band(0, length, ground + 1.06, 0.12, 0.075, 'carved', lintel);
    band(0, length, ground + eave - 0.56, 0.29, 0.095, 'carved', dirty);
    const n = Math.max(1, Math.floor(length / 6.4));
    for (let j = 0; j < n; j++) {
      const p = (length * (j + 0.5)) / n;
      if (Math.abs(at(p, 0, 0)[0] - axis) < width / 2 + 1.42) continue;
      const y = ground + 1.74,
        h = Math.min(eave - 2.37, 2.95);
      band(p - 0.55, p + 0.55, y, h, 0.061, 'rock', recess);
      band(p - 0.69, p + 0.69, y + h, 0.19, 0.18, 'carved', capstone);
      band(p - 0.67, p + 0.67, y - 0.155, 0.155, 0.15, 'carved', lintel);
      if (detail === 3)
        for (const offset of [-0.35, -0.12, 0.12, 0.35])
          beam(
            out,
            'carved',
            at(p + offset, y, 0.12),
            at(p + offset, y + h, 0.12),
            0.095,
            0.095,
            capstone,
          );
    }
  }
}

function annex(out, p, detail) {
  const { outline, ground, height } = p;
  const x = outline.reduce((sum, p) => sum + p[0] / outline.length, 0);
  const z = outline.reduce((sum, p) => sum + p[1] / outline.length, 0);
  const inner = outline.map(([u, v]) => [x + (u - x) * 0.83, z + (v - z) * 0.67]);
  prism(out, 'pavement', [outline], ground - 4.3, 4.65, capstone);
  prism(out, 'rock', [outline, inner], ground + 0.35, height, stone);
  if (detail >= 1)
    prism(out, 'carved', [outline, inner], ground + 0.35 + height - 0.12, 0.23, dirty);
}

const upperGround = ([, z]) => 109.4 - (z - 403.65) * 0.132;

function gallery(out, court, detail) {
  const main = court.id === 1413762;
  const heights = main ? 3.58 : 2.62;
  if (detail > 0)
    prism(out, 'pavement', [court.outer, court.inner], (p) => upperGround(p) - 5.7, 6.1, capstone);
  for (const ring of court.walls) {
    const setback = detail === 0 ? 5.7 : -0.4;
    prism(out, 'rock', ring, (p) => upperGround(p) - setback, heights + setback + 0.4, stone);
    if (detail > 0) prism(out, 'carved', ring, (p) => upperGround(p) + heights + 0.24, 0.3, dirty);
  }
  for (const { x, z, width } of court.gates) {
    const y = upperGround([x, z]) + 0.4,
      h = main ? 3.5 : 2.45;
    frame(out, x, y, z, width, h, detail);
    if (main || detail > 0)
      pediment(out, x, y + h + 0.56, z, width + 1.92, main ? 2.1 : 1.2, detail);
  }
}

function approach(out, { width, points: coarse, surfacePoints, steps, id }, detail) {
  const points = detail > 0 && surfacePoints ? surfacePoints : coarse;
  const total = points.at(-1)[1] - points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0, y0] = points[i - 1],
      [x1, z1, y1] = points[i],
      dx = x1 - x0,
      dz = z1 - z0;
    const count =
      steps && detail > 0
        ? Math.max(1, Math.round((steps * dz) / total / (detail === 1 ? 4 : 1)))
        : 1;
    const lane = (t, side, y) => [x0 + t * dx + (side * width) / 2, y, z0 + t * dz];
    for (let j = 0; j < count; j++) {
      const a = j / count,
        b = (j + 1) / count;
      const low = y0 + (y1 - y0) * a,
        hi = y0 + (y1 - y0) * b;
      const stepped = steps > 0 && detail > 0;
      const tread = stepped ? hi : low;
      const p = lane(a, -1, tread),
        q = lane(a, 1, tread),
        r = lane(b, 1, hi),
        s = lane(b, -1, hi);
      const shade = shades[j % shades.length];
      face(out, 'pavement', [p, q, r, s], shade, [0, 1, 0]);
      if (stepped && hi > low + 0.001)
        face(out, 'carved', [lane(a, -1, low), lane(a, 1, low), q, p], capstone, [0, 0, -1]);
      if (detail < 2) continue;
      const bottom = ([x, y, z]) => [x, y - 3.8, z];
      face(out, 'rock', [p, s, bottom(s), bottom(p)], dirty, [-1, 0, 0]);
      face(out, 'rock', [q, bottom(q), bottom(r), r], dirty, [1, 0, 0]);
    }
    if (
      detail < 2 ||
      (surfacePoints && i % 2 === 0) ||
      ![233998173, 233998176, 234006945].includes(id)
    )
      continue;
    const countPosts = Math.ceil(dz / (id === 234006945 ? 5.1 : 8.8));
    for (let j = 0; j < countPosts; j++) {
      const t = (j + 0.5) / countPosts;
      for (const side of [-1, 1]) {
        const [x, y, z] = lane(t, side, y0 + (y1 - y0) * t);
        const rings = [
          [y - 0.17, 0.36],
          [y + 0.49, 0.28],
          [y + 0.82, 0.145],
        ].map(([h, r]) => radialRing(h, r, r, detail === 2 ? 5 : 8, [x, z]));
        loft(out, 'carved', rings, dirty);
      }
    }
  }
}

function sanctuary(out, detail) {
  const z = 472.1,
    x = -4.5,
    y = upperGround([x, z]),
    n = detail >= 2 ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const inset = (i / n) * 1.04;
    block(
      out,
      'rubble',
      x - 5.4 + inset,
      x + 5.4 - inset,
      z - 5.26 + inset,
      z + 4.52 - inset,
      y - 2.15 + (2.53 * i) / n,
      2.53 / n,
      dirty,
    );
  }
  const walls = [
    [x - 4.22, x - 2.39, z - 2.9, z + 4.2, 4.45],
    [x + 2.15, x + 4.32, z - 2.8, z + 4.2, 4.34],
    [x - 2.39, x + 2.15, z + 2.7, z + 4.2, 3.59],
  ];
  for (const [x0, x1, z0, z1, h] of walls) block(out, 'rock', x0, x1, z0, z1, y + 0.36, h, stone);
  frame(out, x, y + 0.4, z - 2.72, 2.55, 3.4, detail);
  pediment(out, x, y + 4.29, z - 2.72, 5.9, 1.91, detail);
}

function temple(out, detail) {
  for (const path of site.network) approach(out, path, detail);
  for (const [i, g] of site.gates.entries()) gate(out, g, detail, i);
  for (const p of site.annexes) annex(out, p, detail);
  for (const p of site.courts) gallery(out, p, detail);
  sanctuary(out, detail);
}

export const buildSkyline = (out) => temple(out, 0);
export const buildDistrict = (out) => temple(out, 1);
export const buildStreet = (out) => temple(out, 2);
export const buildCloseup = (out) => temple(out, 3);
export const buildMaster = buildCloseup;
