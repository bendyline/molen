/** Royal Pavilion draft. The mapped wall mass, garden roof family and separate west portico. */
import { readFileSync } from 'node:fs';
import earcut from '../../../../../../../../packages/worldgen/node_modules/earcut/src/earcut.js';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.81, metallic: 0.16 },
};
const tint = {
  wall: [0.88, 0.83, 0.72],
  molding: [0.98, 0.93, 0.8],
  base: [0.64, 0.6, 0.52],
  dome: [0.92, 0.88, 0.78],
  lead: [0.26, 0.32, 0.33],
  seam: [0.38, 0.43, 0.42],
  metal: [0.42, 0.43, 0.39],
  glass: [0.35, 0.47, 0.49],
  grille: [0.68, 0.65, 0.53],
  shade: [0.35, 0.31, 0.25],
  warmGlass: [0.29, 0.19, 0.095],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const q = (out, slot, tone, a, b, c, d, n) => {
  face(out, slot, tone, [a, b, c], n);
  face(out, slot, tone, [a, c, d], n);
};
function face(out, slot, tone, vertices, desired) {
  let normal = normalFor(...vertices);
  if (normal.reduce((s, v, i) => s + v * desired[i], 0) < 0) {
    vertices = vertices.toReversed();
    normal = normalFor(...vertices);
  }
  if (Math.hypot(...normal) > 0.5)
    out.addTriangle(slot, ref, vertices, normal, undefined, tint[tone]);
}
const bar = (out, slot, tone, a, b, w, h = w) => beam(out, slot, a, b, w, h, tint[tone]);
const at = ([x, z], y) => [x, y, z];
function sweep(out, slot, tone, ring, y0, y1) {
  const signed = ring.reduce((n, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return n + x * b - a * z;
  }, 0);
  const side = Math.sign(signed);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      n = [side * (b[1] - a[1]), 0, side * (a[0] - b[0])];
    q(out, slot, tone, at(a, y0), at(b, y0), at(b, y1), at(a, y1), n);
  }
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((j) => ring[j]);
    face(
      out,
      slot,
      tone,
      points.map((p) => at(p, y1)),
      up,
    );
    face(
      out,
      slot,
      tone,
      points.map((p) => at(p, y0)),
      [0, -1, 0],
    );
  }
}
const rect = (x, z, w, d) => [
  [x - w * 0.5, z - d * 0.5],
  [x + w * 0.5, z - d * 0.5],
  [x + w * 0.5, z + d * 0.5],
  [x - w * 0.5, z + d * 0.5],
];
function lathe(out, slot, tone, x, z, rows, n, ribs = 0, cap = true) {
  const rings = rows.map(([y, r, depth = 1]) =>
    radialRing(y, r, r * depth, n, [x, z]).map(([a, h, b], i) => {
      const scale = 1 + ribs * (0.5 + 0.5 * Math.cos((i / n) * Math.PI * 2 * 12));
      return [x + (a - x) * scale, h, z + (b - z) * scale];
    }),
  );
  loft(out, slot, rings, tint[tone], { cap });
}
function windowBay(out, point, w, h, y, tier, scallops = false, tone = 'glass') {
  const n = point(0, 0, 1).map((p, i) => p - point(0, 0, 0)[i]);
  const samples = tier < 3 ? 4 : tier === 3 ? 9 : 14;
  const crown = Array.from({ length: samples + 1 }, (_, i) => {
    const t = -1 + (2 * i) / samples;
    const rise = (1 - Math.abs(t)) * (1 + 0.56 * Math.abs(t));
    const lobe =
      scallops && tier >= 2
        ? 0.033 * Math.sin((t + 1) * 4.5 * Math.PI) * Math.sin((t + 1) * 0.5 * Math.PI)
        : 0;
    return [w * 0.5 * t, y + h * (0.64 + 0.36 * rise + lobe)];
  });
  const top = crown.toReversed();
  const outline = [[-w * 0.5, y], [w * 0.5, y], ...top];
  const triangles = earcut(outline.flat());
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      'roof',
      tone,
      triangles.slice(i, i + 3).map((j) => point(...outline[j], 0.013)),
      n,
    );
  if (tier === 1) return;
  if (tier === 2) {
    const trim = [[-w * 0.5, y], ...crown, [w * 0.5, y]];
    for (let i = 1; i < trim.length; i++) {
      const [u, v] = trim[i - 1],
        [a, b] = trim[i],
        len = Math.hypot(a - u, b - v),
        dx = ((b - v) * 0.065) / len,
        dy = (-(a - u) * 0.065) / len;
      q(
        out,
        'wall',
        'molding',
        point(u - dx, v - dy, 0.055),
        point(a - dx, b - dy, 0.055),
        point(a + dx, b + dy, 0.055),
        point(u + dx, v + dy, 0.055),
        n,
      );
    }
    return;
  }
  for (const sign of [-1, 1]) {
    bar(
      out,
      'wall',
      'molding',
      point(sign * w * 0.5, y, 0.071),
      point(sign * w * 0.5, y + h * 0.64, 0.071),
      0.105,
      0.082,
    );
    if (tier >= 3)
      bar(
        out,
        'wall',
        'grille',
        point(sign * w * 0.168, y, 0.049),
        point(sign * w * 0.168, y + h * 0.85, 0.049),
        0.053,
        0.042,
      );
  }
  for (let i = 1; i < crown.length; i++)
    bar(
      out,
      'wall',
      'molding',
      point(...crown[i - 1], 0.069),
      point(...crown[i], 0.069),
      0.105,
      0.09,
    );
  bar(out, 'wall', 'molding', point(-w * 0.55, y, 0.064), point(w * 0.55, y, 0.064), 0.085, 0.12);
  bar(out, 'wall', 'grille', point(0, y, 0.063), point(0, y + h * 0.92, 0.063), 0.058, 0.055);
  if (tier >= 3)
    for (const a of [0.25, 0.49, 0.66])
      bar(
        out,
        'wall',
        'grille',
        point(-w * 0.46, y + h * a, 0.056),
        point(w * 0.46, y + h * a, 0.056),
        0.045,
        0.04,
      );
}
const splitAt = (a, b, breaks) => {
  const cuts = breaks.filter(
    (x) => x > Math.min(a[0], b[0]) + 0.22 && x < Math.max(a[0], b[0]) - 0.22,
  );
  if (b[0] < a[0]) cuts.reverse();
  return [a, ...cuts.map((x) => [x, mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]))]), b];
};
function diagonal(out, point, a, b, width, tone = 'molding') {
  const [x, y] = a,
    [u, v] = b,
    len = Math.hypot(u - x, v - y);
  if (len < 0.01) return;
  const dx = ((v - y) * width) / len,
    dy = (-(u - x) * width) / len,
    n = point(0, 0, 1).map((p, i) => p - point(0, 0, 0)[i]);
  q(
    out,
    'wall',
    tone,
    point(x - dx, y - dy, 0.13),
    point(u - dx, v - dy, 0.13),
    point(u + dx, v + dy, 0.13),
    point(x + dx, y + dy, 0.13),
    n,
  );
}
function gardenScreen(out, point, w, tier) {
  const low = 0.49,
    h = 7.4;
  windowBay(out, point, w * 0.73, h, low, tier, true);
  if (tier < 2) return;
  const y0 = low + h * 0.64;
  const stride = tier === 2 ? 0.67 : tier === 3 ? 0.39 : 0.31;
  for (let x = -w * 0.5 + 0.11; x + stride < w * 0.5 - 0.08; x += stride)
    for (let y = y0; y + stride < 8.29; y += stride) {
      const t = Math.min(1, Math.abs((x + stride * 0.5) / (w * 0.5 * 0.73))),
        crown = low + h * (0.64 + 0.36 * (1 - t) * (1 + 0.56 * t));
      if (y < crown + 0.16) continue;
      diagonal(out, point, [x, y], [x + stride, y + stride], tier === 2 ? 0.049 : 0.027);
      diagonal(out, point, [x + stride, y], [x, y + stride], tier === 2 ? 0.049 : 0.027);
    }
  for (const side of [-1, 1]) {
    const x = side * (w * 0.49 + 0.036);
    bar(
      out,
      'wall',
      'molding',
      point(x, 0.31, 0.32),
      point(x, 8.29, 0.32),
      tier === 2 ? 0.27 : 0.32,
      0.41,
    );
    if (tier >= 3)
      bar(out, 'wall', 'molding', point(x, 7.76, 0.43), point(x, 8.17, 0.43), 0.48, 0.51);
  }
}
function crest(out, point, len, y, tier) {
  if (tier < 2 || len < 2) return;
  const n = point(0, 0, 1).map((p, i) => p - point(0, 0, 0)[i]),
    step = tier === 2 ? 0.71 : tier === 3 ? 0.44 : 0.35;
  for (let x = step * 0.42; x < len - step * 0.37; x += step) {
    const w = step * 0.38,
      tip = point(x, y + 0.49, 0.09);
    face(out, 'wall', 'molding', [point(x - w, y, 0.09), point(x + w, y, 0.09), tip], n);
  }
}
function walls(out, tier) {
  const detailRing = layout.wallOutline,
    ring = tier === 0 ? detailRing.filter((p, i) => i % 3 === 0) : detailRing;
  if (tier > 0) sweep(out, 'base', 'base', ring, -2.15, 0.16);
  sweep(out, 'wall', 'wall', ring, tier === 0 ? -2.15 : 0.16, 8.65);
  const central = layout.main;
  for (const ring of layout.wingBases) sweep(out, 'wall', 'wall', ring.slice(0, -1), 8.22, 12.17);
  lathe(
    out,
    'wall',
    'wall',
    central.x,
    central.z,
    [
      [8.46, 6.52],
      [11.98, 6.52],
      [12.1, 6.41],
    ],
    tier === 0 ? 6 : tier === 1 ? 9 : 22,
    0,
    false,
  );
  if (tier >= 3)
    lathe(
      out,
      'wall',
      'molding',
      central.x,
      central.z,
      [
        [10.95, 6.5],
        [11.05, 6.68],
        [11.23, 6.66],
        [11.34, 6.51],
      ],
      28,
      0,
      false,
    );
  if (tier >= 1)
    for (const room of layout.upperRooms)
      sweep(out, 'wall', 'wall', room.ring.slice(0, -1), 8.5, room.height);
  if (tier === 0) return;
  const signed = Math.sign(
    ring.reduce((n, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return n + x * b - a * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.15) continue;
    const nx = (signed * dz) / len,
      nz = (-signed * dx) / len;
    const cuts =
      nz > 0.45 && Math.min(a[1], b[1]) > 18
        ? splitAt(a, b, [-48.3, -30, -26.2, -10.5, 4.9, 21.5, 43.1, 47])
        : [a, b];
    for (let j = 1; j < cuts.length; j++) {
      const [x, z] = cuts[j - 1],
        [u, v] = cuts[j],
        length = Math.hypot(u - x, v - z),
        ux = (u - x) / length,
        uz = (v - z) / length,
        mid = (u + x) * 0.5;
      const point = (m, h, w) => [x + ux * m + nx * w, h, z + uz * m + nz * w];
      const east = nz > 0.29 && Math.min(z, v) > 18,
        screen = east && (mid < -29 || mid > 23 || (mid > -10.7 && mid < 4.9));
      for (const [y, w, d] of tier < 2
        ? [[8.48, 0.3, 0.31]]
        : screen
          ? [
              [0.28, 0.22, 0.25],
              [8.48, 0.3, 0.31],
            ]
          : [
              [0.28, 0.22, 0.25],
              [4.74, 0.25, 0.28],
              [8.48, 0.3, 0.31],
            ]) {
        if (tier === 2 && y !== 8.48) diagonal(out, point, [0, y], [length, y], w * 0.5);
        else bar(out, 'wall', 'molding', point(0, y, 0.1), point(length, y, 0.1), w, d);
      }
      if (east) crest(out, point, length, 8.58, tier);
      const count =
        length > 3.1
          ? Math.max(1, Math.round(length / (east ? 3.65 : 3.88)))
          : east && length > 1.18
            ? 1
            : 0;
      for (let k = 0; k < count; k++) {
        const u = ((k + 0.5) * length) / count,
          bay = (l, h, w) => point(u + l, h, w),
          w = length / count;
        if (screen) {
          gardenScreen(out, bay, w * 0.92, tier);
          continue;
        }
        windowBay(out, bay, Math.min(w * 0.64, 2.0), east ? 3.71 : 3.2, 0.65, tier);
        if (tier > 1 || east) windowBay(out, bay, Math.min(w * 0.48, 1.6), 1.83, 5.46, tier);
        if (tier >= 2)
          bar(
            out,
            'wall',
            'molding',
            point(u - w * 0.47, 0.34, 0.18),
            point(u - w * 0.47, 4.48, 0.18),
            0.19,
            0.23,
          );
      }
    }
  }
}
const bulb = [
  [0, 0.76],
  [0.075, 0.85],
  [0.2, 0.98],
  [0.34, 1],
  [0.48, 0.88],
  [0.6, 0.7],
  [0.71, 0.47],
  [0.82, 0.25],
  [0.94, 0.1],
  [1, 0.044],
];
const cone = [
  [0, 1],
  [0.12, 0.79],
  [0.3, 0.53],
  [0.5, 0.31],
  [0.7, 0.19],
  [0.88, 0.12],
  [1, 0.064],
];
function roof(out, f, tier) {
  const { x, z, y, r, h, finial, type } = f,
    isCone = type === 'cone';
  const n =
    tier === 0
      ? type === 'main'
        ? 9
        : type === 'west'
          ? 4
          : type === 'bay'
            ? 5
            : 6
      : tier === 1
        ? type === 'main'
          ? 13
          : 7
        : tier === 2
          ? 19
          : tier === 3
            ? 38
            : 60;
  const profile = isCone ? cone : bulb;
  const selected =
    tier === 0
      ? profile.filter(
          (p, i) =>
            i === 0 ||
            i === profile.length - 1 ||
            i === Math.floor(profile.length * 0.37) ||
            (type !== 'west' && i === Math.floor(profile.length * 0.72)),
        )
      : tier === 1
        ? profile.filter((p, i) => i === 0 || i === profile.length - 1 || i % 2 === 0)
        : profile;
  const bed = type === 'bay' ? 8.56 : type === 'entry' ? 6.94 : y - 0.27;
  if (tier > 0 || type === 'bay' || type === 'entry')
    lathe(
      out,
      'wall',
      'molding',
      x,
      z,
      [
        [bed, r * 0.8],
        [y + 0.15, r * 0.83],
      ],
      n,
      0,
      false,
    );
  lathe(
    out,
    isCone ? 'roof' : 'wall',
    isCone ? 'lead' : 'dome',
    x,
    z,
    selected.map(([u, k]) => [y + u * h, r * k]),
    n,
    tier < 2 ? 0 : isCone ? 0.053 : 0.063,
    false,
  );
  if (tier >= 2 && ['main', 'entry', 'cone'].includes(type)) {
    const height = y + h * (isCone ? 0.31 : 0.355),
      count = type === 'main' ? 24 : 16;
    const radius = (v) => {
      const t = (height + v - y) / h,
        j = profile.findIndex((p) => p[0] >= t),
        [a, b] = profile.slice(j - 1, j + 1);
      return r * mix(a[1], b[1], (t - a[0]) / (b[0] - a[0])) * (isCone ? 1.045 : 1.057);
    };
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2,
        dx = Math.cos(a),
        dz = Math.sin(a),
        ux = -dz,
        uz = dx;
      const point = (t, v, u) => {
        const radial = radius(v) + u;
        return [x + radial * dx + t * ux, height + v, z + radial * dz + t * uz];
      };
      const wide = type === 'main' ? 0.37 : 0.25,
        tall = type === 'main' ? 0.62 : 0.34,
        n = [dx, 0, dz];
      const points = [
        point(0, -tall, 0.025),
        point(wide, 0, 0.025),
        point(0, tall, 0.025),
        point(-wide, 0, 0.025),
      ];
      q(out, 'roof', 'glass', ...points, n);
      for (let j = 0; j < 4; j++)
        if (tier >= 3) bar(out, 'wall', 'molding', points[j], points[(j + 1) % 4], 0.065, 0.068);
      if (tier >= 3) diagonal(out, point, [-wide * 0.65, 0], [wide * 0.65, 0], 0.038, 'molding');
    }
  }
  const a = y + h;
  const tip =
    tier === 0
      ? [
          [a, r * 0.051],
          [a + finial, 0.022],
        ]
      : tier === 1
        ? [
            [a, r * 0.049],
            [a + finial * 0.33, r * 0.085],
            [a + finial, 0.02],
          ]
        : [
            [a, r * 0.044],
            [a + finial * 0.19, r * 0.044],
            [a + finial * 0.32, r * 0.094],
            [a + finial * 0.45, r * 0.062],
            [a + finial * 0.65, r * 0.027],
            [a + finial, 0.018],
          ];
  lathe(
    out,
    'roof',
    'metal',
    x,
    z,
    tip,
    tier === 0 ? 4 : tier === 1 ? 5 : tier < 3 ? 8 : 12,
    0,
    false,
  );
}
function lantern(out, f, tier) {
  const { x, z, base, height, r } = f,
    h = height - base,
    y = base + h * 0.78,
    n = tier === 2 ? 8 : 16;
  if (tier === 0) {
    lathe(
      out,
      'wall',
      'wall',
      x,
      z,
      [
        [base, r],
        [y, r * 0.84],
        [y + 0.29, r * 1.16],
        [height, 0.022],
      ],
      4,
      0,
      false,
    );
    return;
  }
  if (tier === 1) {
    lathe(
      out,
      'wall',
      'wall',
      x,
      z,
      [
        [base, r],
        [y - 0.12, r * 0.88],
        [y + 0.24, r * 1.21],
      ],
      6,
      0,
      false,
    );
    lathe(
      out,
      'roof',
      'metal',
      x,
      z,
      [
        [y + 0.24, r * 0.62],
        [height - 0.62, r * 0.68],
        [height, 0.021],
      ],
      6,
      0,
      false,
    );
    return;
  }
  lathe(
    out,
    'wall',
    'wall',
    x,
    z,
    [
      [base, r * 1.28],
      [base + 0.38, r],
      [y - 0.29, r * 0.86],
      [y, r * 1.32],
    ],
    n,
  );
  const crown = height - 0.36 * h * 0.42;
  lathe(
    out,
    'wall',
    'molding',
    x,
    z,
    [
      [y - 0.08, r * 1.19],
      [y + 0.23, r * 1.28],
      [y + 0.35, r * 0.99],
    ],
    n,
  );
  for (let i = 0; i < (tier === 2 ? 4 : 8); i++) {
    const a = (i / (tier === 2 ? 4 : 8)) * Math.PI * 2,
      c = Math.cos(a) * r * 0.79,
      s = Math.sin(a) * r * 0.79;
    bar(out, 'wall', 'molding', [x + c, y + 0.34, z + s], [x + c, crown, z + s], 0.147, 0.145);
  }
  lathe(
    out,
    'roof',
    'metal',
    x,
    z,
    [
      [crown, r * 1.05],
      [crown + 0.18, r * 0.84],
      [crown + 0.48, r * 0.76],
      [height - 0.62, r * 0.36],
      [height - 0.38, r * 0.19],
      [height, 0.025],
    ],
    n,
  );
}
function portico(out, tier) {
  if (tier > 0) {
    const { path, walkWidth } = layout.porch;
    const x = layout.porch.x,
      w = walkWidth * 0.5;
    for (let i = 1; i < path.length; i++) {
      const [z, y] = path[i - 1],
        [b, c] = path[i];
      q(out, 'base', 'base', [x - w, y, z], [x + w, y, z], [x + w, c, b], [x - w, c, b], up);
    }
  }
  const p = layout.porch,
    { x, z, width, depth, roofY: y } = p;
  sweep(out, 'base', 'base', rect(x, z, width, depth), -1.1, 0.26);
  sweep(out, 'wall', 'molding', rect(x, z, width, depth), y - 0.45, y + 0.21);
  for (const [a, b] of tier === 0 ? p.pillars.filter((_, i) => i < 2 || i >= 4) : p.pillars) {
    const rows =
      tier === 0
        ? [
            [0.24, 0.44],
            [y - 0.45, 0.55],
          ]
        : tier === 1
          ? [
              [0.24, 0.49],
              [0.72, 0.36],
              [y - 0.67, 0.42],
              [y - 0.45, 0.62],
            ]
          : [
              [0.24, 0.49],
              [0.59, 0.48],
              [0.72, 0.36],
              [y - 1.04, 0.33],
              [y - 0.67, 0.42],
              [y - 0.45, 0.62],
            ];
    lathe(out, 'wall', 'wall', a, b, rows, tier === 0 ? 4 : tier === 1 ? 6 : 12, 0, false);
  }
  if (tier >= 2) {
    const point = (u, h, v) => [x + u, h, z - depth * 0.5 - v];
    const n = [0, 0, -1],
      count = tier === 2 ? 15 : 24;
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * width) / count - width * 0.5,
        w = (width / count) * 0.41;
      const a = point(u - w, y - 0.37, 0.045),
        b = point(u + w, y - 0.37, 0.045),
        c = point(u + w * 0.7, y - 0.75, 0.045),
        d = point(u - w * 0.7, y - 0.75, 0.045);
      q(out, 'wall', 'molding', a, b, c, d, n);
    }
    if (tier >= 3)
      windowBay(
        out,
        (u, h, v) => [x + u, h, -15.925 - v],
        2.47,
        4.57,
        0.29,
        tier,
        true,
        'warmGlass',
      );
  }
  if (tier >= 2)
    for (const s of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const px = x + s * (width * 0.5 - 0.18),
          pz = z - depth * 0.44 + i * depth * 0.11;
        lathe(
          out,
          'wall',
          'molding',
          px,
          pz,
          [
            [y + 0.21, 0.16],
            [y + 0.34, 0.25],
            [y + 0.59, 0.22],
            [y + 0.89, 0.028],
          ],
          tier === 2 ? 6 : 10,
        );
      }
}
export function buildPavilionLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error('Unknown Royal Pavilion level ' + level);
  walls(out, tier);
  portico(out, tier);
  for (const f of [
    layout.main,
    ...layout.gardenDomes,
    ...layout.endRoofs,
    ...layout.westDomes,
    layout.entrance,
  ])
    roof(out, f, tier);
  for (const f of layout.turrets) lantern(out, f, tier);
}

export const buildPavilionSkyline = (out) => buildPavilionLevel(out, 'skyline');
export const buildPavilionDistrict = (out) => buildPavilionLevel(out, 'district');
export const buildPavilionStreet = (out) => buildPavilionLevel(out, 'street');
export const buildPavilionCloseup = (out) => buildPavilionLevel(out, 'closeup');
