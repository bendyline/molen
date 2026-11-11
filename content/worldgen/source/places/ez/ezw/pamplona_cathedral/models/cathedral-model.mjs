/** Pamplona Cathedral and the connected Gothic cloister, with the west Neoclassical porch. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  cut: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.94 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.51 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.76, metallic: 0.18 },
  garden: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
};
const tone = {
  stone: [0.699, 0.626, 0.515],
  warm: [0.748, 0.669, 0.535],
  cut: [0.806, 0.731, 0.607],
  pale: [0.875, 0.809, 0.681],
  old: [0.614, 0.542, 0.436],
  trimShade: [0.54, 0.481, 0.385],
  tile: [0.477, 0.416, 0.334],
  tileBrown: [0.482, 0.363, 0.269],
  slate: [0.432, 0.414, 0.36],
  paving: [0.611, 0.56, 0.473],
  lower: [0.47, 0.416, 0.344],
  window: [0.149, 0.159, 0.148],
  dark: [0.135, 0.128, 0.104],
  bronze: [0.34, 0.272, 0.172],
  iron: [0.242, 0.261, 0.226],
  green: [0.31, 0.371, 0.184],
  brightGreen: [0.35, 0.415, 0.214],
  gold: [0.665, 0.48, 0.211],
};
const ranks = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const area = (ring) =>
  ring.reduce((v, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return v + x * b - a * z;
  }, 0);
function surface(out, slot, color, p, n) {
  p = p.map((v) => v.map(Math.fround));
  let normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.2) return;
  if (n && normal.reduce((sum, x, i) => sum + x * n[i], 0) < 0) {
    p = p.toReversed();
    normal = normalFor(...p);
  }
  if (p.length === 3) out.addTriangle(slot, ref, p, normal, undefined, tone[color]);
  else out.addQuad(slot, ref, p, normal, undefined, tone[color]);
}
function slab(out, slot, color, rings, y) {
  const pts = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(n);
    n += ring.length;
  }
  const indices = earcut(pts.flat(), holes);
  for (let i = 0; i < indices.length; i += 3)
    surface(
      out,
      slot,
      color,
      indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      up,
    );
}
function frame(a, b, dir = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [(dir * dz) / l, 0, (-dir * dx) / l];
  return {
    l,
    n,
    at: (u, y, d = 0) => [a[0] + (dx * u) / l + n[0] * d, y, a[1] + (dz * u) / l + n[2] * d],
  };
}
function pane(out, slot, color, { at, n }, a, b, lo, hi, d = 0) {
  surface(out, slot, color, [at(a, lo, d), at(b, lo, d), at(b, hi, d), at(a, hi, d)], n);
}
function band(out, f, a, b, lo, hi, d, tier, color = 'cut') {
  const { at } = f;
  pane(out, 'cut', color, f, a, b, lo, hi, d);
  if (tier >= 2)
    surface(
      out,
      'cut',
      'pale',
      [at(a, hi, d), at(b, hi, d), at(b, hi, -0.03), at(a, hi, -0.03)],
      up,
    );
}
function box(out, slot, color, x, z, w, d, lo, hi) {
  loft(
    out,
    slot,
    [lo, hi].map((y) =>
      rect(x, z, w, d)
        .toReversed()
        .map(([a, b]) => [a, y, b]),
    ),
    tone[color],
  );
}
function edgeRod(out, slot, color, a, b, w, d = w) {
  beam(out, slot, a, b, w, d, tone[color]);
}
function stoneColumn(out, x, z, lo, hi, r, tier) {
  if (tier <= 1) {
    box(out, 'cut', 'cut', x, z, r * 1.48, r * 1.48, lo, hi);
    return;
  }
  const n = tier === 1 ? 6 : tier === 2 ? 8 : 12;
  const profile = [
    [lo, r * 1.38],
    [lo + 0.19, r * 1.38],
    [lo + 0.32, r],
    [hi - 0.61, r * 0.76],
    [hi - 0.31, r * 1.23],
    [hi, r * 1.44],
  ];
  loft(
    out,
    'cut',
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    tone.pale,
  );
}
function archY(t, lo, spring, rise, pointed) {
  return (
    lo +
    spring +
    rise * (pointed ? Math.pow(Math.max(0, 1 - Math.abs(2 * t - 1)), 0.67) : Math.sin(Math.PI * t))
  );
}
function lancet(out, f, u, w, y, h, tier, pointed = true, depth = 0.093) {
  const { at, n } = f,
    a = u - w / 2,
    b = u + w / 2,
    spring = h * (pointed ? 0.65 : 0.74),
    rise = h - spring;
  const slot = tier >= 2 ? 'glass' : 'metal';
  pane(out, slot, 'window', f, a, b, y, y + spring, depth);
  const count = tier >= 3 ? 8 : tier === 2 ? 5 : 2;
  for (let i = 0; i < count; i++) {
    const point = (j, extra = 0) =>
      at(
        mix(a - extra, b + extra, j / count),
        archY(j / count, y, spring, rise + extra, pointed),
        depth + (extra ? 0.036 : 0),
      );
    surface(out, slot, 'window', [at(u, y + spring, depth), point(i), point(i + 1)], n);
    if (tier >= 2)
      surface(out, 'cut', 'cut', [point(i), point(i + 1), point(i + 1, 0.21), point(i, 0.21)], n);
  }
  if (tier >= 2) {
    band(out, f, a - 0.18, b + 0.18, y - 0.19, y - 0.04, depth + 0.21, 1, 'trimShade');
    if (tier >= 3) pane(out, 'metal', 'iron', f, u - 0.055, u + 0.055, y, y + spring, depth + 0.06);
  }
}
function archOpening(out, f, l, r, y, spring, rise, top, tier, pointed, depth = 0, lo = y) {
  const { at, n } = f;
  if (l > 0) pane(out, 'stone', 'stone', f, 0, l, lo, top, depth);
  if (r < f.l) pane(out, 'stone', 'stone', f, r, f.l, lo, top, depth);
  if (lo < y) pane(out, 'stone', 'old', f, l, r, lo, y, depth);
  const steps = tier >= 3 ? 10 : tier === 2 ? 6 : tier === 1 ? 3 : 2;
  for (let i = 0; i < steps; i++) {
    const a = mix(l, r, i / steps),
      b = mix(l, r, (i + 1) / steps),
      p = archY(i / steps, y, spring, rise, pointed),
      q = archY((i + 1) / steps, y, spring, rise, pointed);
    surface(
      out,
      'stone',
      'stone',
      [at(a, p, depth), at(b, q, depth), at(b, top, depth), at(a, top, depth)],
      n,
    );
    if (tier)
      surface(
        out,
        'cut',
        'cut',
        [
          at(a, p, depth + 0.06),
          at(b, q, depth + 0.06),
          at(b, q + 0.19, depth + 0.08),
          at(a, p + 0.19, depth + 0.08),
        ],
        n,
      );
    if (tier >= 2)
      surface(
        out,
        'stone',
        'trimShade',
        [at(a, p, depth), at(b, q, depth), at(b, q, depth - 0.59), at(a, p, depth - 0.59)],
        [0, -1, 0],
      );
  }
}
function roof(out, { x, z, w, d, eave, ridge }, color = 'tile') {
  const small = Math.min(w, d) * 0.37;
  const lower = rect(x, z, w, d);
  const inset = rect(x, z, w - 2 * small, d - 2 * small);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      [a, b] = lower[i],
      [c, d] = lower[j],
      [e, f] = inset[j],
      [g, h] = inset[i];
    surface(
      out,
      'tile',
      color,
      [
        [a, eave, b],
        [c, eave, d],
        [e, ridge, f],
        [g, ridge, h],
      ],
      up,
    );
  }
  slab(out, 'tile', color, [inset], ridge);
}
function gable(out, x, z, w, d, lo, eave, ridge, axis, color, tier) {
  const ring = rect(x, z, w, d);
  for (let i = 0; i < 4; i++) {
    const f = frame(ring[i], ring[(i + 1) % 4]);
    pane(out, 'stone', color, f, 0, f.l, lo, eave);
    if (tier) band(out, f, 0, f.l, eave - 0.24, eave + 0.035, 0.27, 0, 'trimShade');
  }
  const p = (a, y, b) => (axis === 'z' ? [x + a, y, z + b] : [x + b, y, z + a]);
  const [a, b] = axis === 'z' ? [w / 2, d / 2] : [d / 2, w / 2];
  for (const side of [-1, 1]) {
    surface(
      out,
      'tile',
      'tile',
      [p(side * a, eave, -b), p(side * a, eave, b), p(0, ridge, b), p(0, ridge, -b)],
      up,
    );
    surface(
      out,
      'stone',
      color,
      [p(-a, eave, side * b), p(a, eave, side * b), p(0, ridge, side * b)],
      axis === 'z' ? [0, 0, side] : [side, 0, 0],
    );
  }
}
function ringWall(out, ring, y0, y1, slot, color) {
  const dir = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const f = frame(ring[i], ring[(i + 1) % ring.length], dir);
    pane(out, slot, color, f, 0, f.l, y0, y1);
  }
}
function perimeter(out, tier) {
  const { courts, front } = layout,
    boundary = tier ? layout.boundary : layout.skyline,
    wall = tier ? layout.wall : layout.skylineWall,
    eave = 10.42,
    dir = Math.sign(area(boundary));
  for (let i = 0; i < boundary.length; i++) {
    const j = (i + 1) % boundary.length,
      a = boundary[i],
      b = boundary[j],
      f = frame(a, b, dir),
      { l, at, n } = f;
    const [x, , z] = at(l * 0.5, 0),
      porch =
        z > 45.2 && x > front.x - front.porchWidth * 0.54 && x < front.x + front.porchWidth * 0.54;
    if (porch) continue;
    surface(out, 'stone', 'old', [at(0, wall[i]), at(l, wall[j]), at(l, eave), at(0, eave)], n);
    if (tier >= 1 && l > 3.2) {
      band(out, f, 0, l, eave - 0.31, eave, 0.18, 0, 'trimShade');
      if (tier >= 2 && !(x < -24 && z > 30))
        lancet(out, f, l / 2, Math.min(1.46, l * 0.37), 3.75, 3.25, tier, false);
    }
  }
  slab(out, 'tile', 'slate', [boundary, ...courts.map((c) => c.ring)], eave);
  for (const court of courts) {
    slab(
      out,
      court === courts[1] ? 'garden' : 'paving',
      court === courts[1] ? 'green' : 'paving',
      [court.ring],
      court.y,
    );
    if (court === courts[1]) continue;
    const dir = -Math.sign(area(court.ring));
    for (let i = 0; i < court.ring.length; i++) {
      const f = frame(court.ring[i], court.ring[(i + 1) % court.ring.length], dir);
      pane(out, 'stone', 'old', f, 0, f.l, court.y, eave);
      if (tier >= 2 && f.l > 6)
        for (const j of [0.25, 0.75])
          lancet(out, f, f.l * j, 1.19, court.y + 3.38, 2.81, tier, false);
    }
  }
}
function roofDisk(out, x, z, y, r, tier, color, slot = 'cut') {
  const n = tier >= 2 ? 12 : 8;
  const rings = [
    [y - 0.23, r],
    [y, r],
  ].map(([h, a]) => radialRing(h, a, a, n, [x, z]));
  loft(out, slot, rings, tone[color]);
}
function circleFace(out, f, u, y, r, tier, rosette = false) {
  const { at, n } = f,
    count = tier >= 3 ? 24 : tier >= 2 ? 16 : 8;
  const t = (j, v, d) =>
    at(u + Math.sin((2 * Math.PI * j) / count) * v, y + Math.cos((2 * Math.PI * j) / count) * v, d);
  const d = 0.155,
    slot = rosette ? 'metal' : 'cut';
  for (let i = 0; i < count; i++) {
    surface(
      out,
      'cut',
      'pale',
      [t(i, r, d), t(i + 1, r, d), t(i + 1, r * 0.78, d + 0.06), t(i, r * 0.78, d + 0.06)],
      n,
    );
    surface(
      out,
      slot,
      rosette ? 'window' : 'paving',
      [at(u, y, d), t(i, r * 0.79, d + 0.04), t(i + 1, r * 0.79, d + 0.04)],
      n,
    );
  }
  if (tier >= 2) {
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * count;
      edgeRod(out, 'cut', 'cut', t(a, r * 0.72, d + 0.12), t(a, r * 0.19, d + 0.12), r * 0.038);
    }
    if (!rosette)
      for (const [a, v] of [
        [1, 0.45],
        [0.125, 0.62],
      ])
        edgeRod(out, 'metal', 'iron', at(u, y, d + 0.13), t(a * count, v * r, d + 0.13), 0.051);
  }
}
function belltower(out, t, tier) {
  const { x, z, tip } = t,
    ring = rect(x, z, 10.64, 10.15);
  box(out, 'stone', 'warm', x, z, 10.64, 10.15, -1.3, 28.88);
  const bands = [
    [15.22, 11.05, 10.52, 0.38],
    [16.05, 11.67, 10.93, 0.65],
    [27.82, 11.06, 10.58, 0.62],
    [28.57, 11.54, 10.95, 0.38],
    [29.02, 10.45, 10.1, 0.57],
  ];
  for (const [y, w, d, h] of tier ? bands : [bands[3]])
    box(out, 'cut', 'cut', x, z, w, d, y, y + h);
  const front = frame(ring[2], ring[3]);
  if (tier) {
    circleFace(out, front, front.l / 2, 23.73, 1.29, tier, false);
    lancet(out, front, front.l / 2, 1.42, 5.95, 4.17, tier, false);
    lancet(out, front, front.l / 2, 1.25, 13.17, 2.48, tier, false);
  }
  const r = rect(x, z, 8.4, 8.4);
  for (let i = 0; i < 4; i++) {
    const f = frame(r[i], r[(i + 1) % 4]),
      a = f.l * 0.23,
      b = f.l * 0.77;
    archOpening(out, f, a, b, 31.25, 5.29, 2.05, 40.12, tier, false, 0, 29.57);
    if (tier)
      for (const off of [a - 0.31, b + 0.31]) {
        const [x, , z] = f.at(off, 0, 0.35);
        stoneColumn(out, x, z, 30.01, 39.28, 0.35, tier >= 3 ? 2 : 1);
      }
  }
  if (tier) {
    const n = tier >= 3 ? 14 : 8;
    loft(
      out,
      'metal',
      [
        [33.21, 1.55],
        [33.41, 1.48],
        [34.39, 1.16],
        [35.55, 0.89],
        [35.78, 0.66],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      tone.bronze,
    );
    edgeRod(out, 'metal', 'iron', [x, 35.63, z], [x, 39.71, z], 0.18);
  }
  const rows = [
    [40.0, 4.77],
    [40.48, 4.77],
    [40.81, 4.41],
    [41.67, 4.42],
    [42.09, 3.86],
    [43.77, 3.41],
    [44.27, 3.21],
    [46.31, 2.56],
    [47.92, 1.48],
    [48.77, 0.58],
    [tip, 0.08],
  ];
  const selected = tier ? rows : rows.filter((_, i) => [0, 4, 8, 10].includes(i)),
    n = tier >= 3 ? 16 : tier ? 8 : 6;
  loft(
    out,
    'cut',
    selected.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8)),
    tone.cut,
  );
}
function porch(out, tier) {
  const { x, z, back, lo, w, porchWidth, towers } = layout.front;
  for (const t of towers) belltower(out, t, tier);
  const depth = z - back + 1.38;
  box(out, 'stone', 'warm', x, back - 1.12, w - 2.12, 2.87, -1.4, 18.15);
  box(out, 'cut', 'cut', x, z - depth / 2, porchWidth, depth, 16.11, 18.59);
  const count = tier >= 3 ? 7 : 5;
  for (let i = 0; i < 4; i++) {
    const a = x + (i - 1.5) * 4.61,
      at = z - 0.61;
    if (tier) stoneColumn(out, a, at, lo, 16.48, 0.71, tier);
    else
      surface(
        out,
        'cut',
        'cut',
        [
          [a - 0.55, lo, at],
          [a + 0.55, lo, at],
          [a + 0.55, 16.48, at],
          [a - 0.55, 16.48, at],
        ],
        [0, 0, 1],
      );
  }
  const zFace = z + 0.27,
    f = frame([x + porchWidth / 2, zFace], [x - porchWidth / 2, zFace]),
    { at, n, l } = f;
  const bottom = 18.42,
    peak = 23.78;
  surface(out, 'cut', 'cut', [at(0, bottom), at(l, bottom), at(l / 2, peak)], n);
  surface(
    out,
    'tile',
    'slate',
    [at(0, bottom), at(l / 2, peak), at(l / 2, peak, -depth), at(0, bottom, -depth)],
    up,
  );
  surface(
    out,
    'tile',
    'slate',
    [at(l / 2, peak), at(l, bottom), at(l, bottom, -depth), at(l / 2, peak, -depth)],
    up,
  );
  for (const [a, b] of [
    [0, l / 2],
    [l / 2, l],
  ]) {
    const p = a === 0 ? at(a, bottom, 0.17) : at(a, peak, 0.17),
      q = b === l ? at(b, bottom, 0.17) : at(b, peak, 0.17);
    edgeRod(out, 'cut', 'pale', p, q, 0.35, 0.41);
  }
  if (tier) {
    const doors = frame([x + porchWidth / 2, back + 0.35], [x - porchWidth / 2, back + 0.35]);
    for (const u of [0.18, 0.5, 0.82])
      pane(out, 'metal', 'dark', doors, doors.l * u - 1.38, doors.l * u + 1.38, lo, 7.37, 0.059);
    band(out, doors, doors.l * 0.5 - 2.1, doors.l * 0.5 + 2.1, 8.18, 12.4, 0.12, 1, 'old');
    if (tier >= 2) {
      for (let i = 0; i < count; i++) {
        const u = l * 0.5 + (i - (count - 1) / 2) * 0.86,
          p = at(u, bottom + 0.51, 0.11);
        const h = 0.35 + 0.57 * (1 - Math.abs(i - (count - 1) / 2) / (count / 2));
        sphere(out, 'cut', [p[0], p[1] + h * 0.4, p[2]], [0.37, h, 0.18], tone.trimShade, 6, 4);
      }
      edgeRod(out, 'metal', 'gold', [x, peak, z - 0.03], [x, peak + 1.86, z - 0.03], 0.14);
      edgeRod(
        out,
        'metal',
        'gold',
        [x - 0.66, peak + 1.24, z - 0.03],
        [x + 0.66, peak + 1.24, z - 0.03],
        0.14,
      );
    }
  }
}
function stair(out, tier) {
  const { x, w, front, back, y } = layout.approach,
    rows = tier ? layout.approach.rows : layout.approach.rows.filter((_, i) => i % 2 === 0);
  const head = 49.02,
    steps = [2, 3, 4, 6, 7][tier];
  const base = Math.min(...rows.map((p) => p[1])) - 0.88;
  box(out, 'paving', 'paving', x, (back + head) / 2, w, head - back, base, y);
  for (let i = 0; i < steps; i++) {
    const z = mix(front, head, i / steps),
      next = mix(front, head, (i + 1) / steps);
    for (let j = 1; j < rows.length; j++) {
      const a = rows[j - 1],
        b = rows[j],
        p = (row, i, z) => [row[0], i < 0 ? base : mix(row[1], y, i / (steps - 1)), z];
      surface(out, 'paving', 'paving', [p(a, i, z), p(b, i, z), p(b, i, next), p(a, i, next)], up);
      surface(
        out,
        'paving',
        'lower',
        [p(a, i - 1, z), p(b, i - 1, z), p(b, i, z), p(a, i, z)],
        [0, 0, 1],
      );
      if (j === 1)
        surface(
          out,
          'paving',
          'lower',
          [p(a, -1, z), p(a, -1, next), p(a, i, next), p(a, i, z)],
          [-1, 0, 0],
        );
      if (j === rows.length - 1)
        surface(
          out,
          'paving',
          'lower',
          [p(b, -1, z), p(b, -1, next), p(b, i, next), p(b, i, z)],
          [1, 0, 0],
        );
    }
  }
}
function mainChurch(out, tier) {
  const n = layout.nave,
    { x, z0, z1, half, eave, ridge } = n;
  gable(out, x, (z0 + z1) / 2, half * 2, z1 - z0, 9.9, eave, ridge, 'z', 'stone', tier);
  for (const a of n.aisles) {
    box(out, 'stone', 'stone', a.x, 7.8, a.w, 63.6, 9.86, a.high - 2.52);
    const sign = Math.sign(a.x - x),
      x1 = a.x + (sign * a.w) / 2,
      x2 = a.x - (sign * a.w) / 2;
    surface(
      out,
      'tile',
      'tile',
      [
        [x1, a.high - 2.44, -24],
        [x1, a.high - 2.44, 39.6],
        [x2, a.high, 39.6],
        [x2, a.high, -24],
      ],
      up,
    );
    const f = sign > 0 ? frame([x1, -24], [x1, 39.6]) : frame([x1, 39.6], [x1, -24]);
    if (tier) for (let j = 1; j <= 7; j++) lancet(out, f, (f.l * j) / 8, 1.65, 9.2, 4.11, tier);
  }
  const c = n.cross;
  gable(out, c.x, c.z, c.w, c.d, 10.14, c.eave, c.ridge, 'x', 'stone', tier);
  const a = n.apse,
    arc = Array.from({ length: 7 }, (_, i) => {
      const t = (Math.PI * i) / 6;
      return [a.x + Math.cos(t) * a.rx, a.z - Math.sin(t) * a.rz];
    });
  ringWall(out, arc, 10.36, eave, 'stone', 'stone');
  for (let i = 0; i < arc.length - 1; i++)
    surface(
      out,
      'tile',
      'slate',
      [
        [arc[i][0], eave, arc[i][1]],
        [arc[i + 1][0], eave, arc[i + 1][1]],
        [x, ridge, z0],
      ],
      up,
    );
  for (const sign of [-1, 1]) {
    const x1 = x + sign * half;
    const f = sign > 0 ? frame([x1, z0], [x1, z1]) : frame([x1, z1], [x1, z0]);
    for (const z of [-8.5, 2.14, 12.8, 23.45, 34.2]) {
      const u = sign > 0 ? z - z0 : z1 - z;
      if (tier) lancet(out, f, u - 3.4, 2.11, 20.1, 6.23, tier);
      const pier = x + sign * 17.1;
      if (tier) {
        box(out, 'stone', 'stone', pier, z, 1.89, 1.63, 9.86, 17.96);
        if (tier >= 2) box(out, 'cut', 'cut', pier, z, 2.17, 1.88, 17.96, 18.65);
      }
      const count = tier >= 2 ? 5 : tier === 1 ? 3 : 1;
      const section = (i) => {
        const t = i / count,
          p = mix(pier, x1, t),
          y = 17.5 + 7.29 * Math.sin(t * Math.PI * 0.5);
        return { p, y };
      };
      for (let i = 1; i <= count; i++) {
        const p = section(i - 1),
          q = section(i);
        for (const dz of [-0.42, 0.42])
          surface(
            out,
            'stone',
            'cut',
            [
              [p.p, p.y, z + dz],
              [q.p, q.y, z + dz],
              [q.p, q.y + 1.03, z + dz],
              [p.p, p.y + 1.03, z + dz],
            ],
            [0, 0, Math.sign(dz)],
          );
        surface(
          out,
          'cut',
          'pale',
          [
            [p.p, p.y + 1.03, z - 0.42],
            [q.p, q.y + 1.03, z - 0.42],
            [q.p, q.y + 1.03, z + 0.42],
            [p.p, p.y + 1.03, z + 0.42],
          ],
          up,
        );
      }
    }
    const x2 = c.x + (sign * c.w) / 2;
    const cross =
      sign > 0
        ? frame([x2, c.z - c.d / 2], [x2, c.z + c.d / 2])
        : frame([x2, c.z + c.d / 2], [x2, c.z - c.d / 2]);
    if (tier) circleFace(out, cross, cross.l / 2, 19.72, 2.12, tier, true);
    for (const off of [-c.d * 0.39, c.d * 0.39])
      box(out, 'cut', 'cut', x2, c.z + off, 0.91, 1.11, 9.9, 26.75);
    if (tier >= 2 && sign < 0) lancet(out, cross, cross.l / 2, 2.45, 9.94, 6.2, tier, true);
  }
}
function cloister(out, tier) {
  const court = layout.courts[1],
    ring = court.ring,
    eave = 10.43,
    dir = -Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const start = ring[i],
      end = ring[(i + 1) % ring.length],
      f = frame(start, end, dir),
      count = !tier ? 1 : f.l > 19 ? 6 : f.l > 7 ? 3 : 1;
    const width = f.l / count;
    for (let j = 0; j < count; j++) {
      const a = f.at(j * width, 0),
        b = f.at((j + 1) * width, 0);
      const bay = frame([a[0], a[2]], [b[0], b[2]], dir);
      const pier = width * 0.115,
        l = pier,
        r = width - pier,
        y = court.y + 0.62,
        spring = 3.65,
        rise = 1.62;
      const gallery = tier >= 2 ? y + spring + rise + 0.78 : eave;
      archOpening(out, bay, l, r, y, spring, rise, gallery, tier, true, 0, court.y);
      const low = bay.at(0.17, 0, -0.26),
        high = bay.at(width - 0.17, 0, -0.26);
      if (tier >= 2)
        for (const p of [low, high])
          box(out, 'cut', 'cut', p[0], p[2], 0.3, 0.3, court.y, y + spring + 0.16);
      if (tier >= 2) {
        for (const u of [0.34, 0.5, 0.66]) {
          const q = bay.at(width * u, 0, -0.064);
          box(out, 'cut', 'cut', q[0], q[2], 0.097, 0.11, y, y + spring * 0.83);
        }
        const count = tier >= 3 ? 10 : 6;
        for (const [a, rr, h] of [
          [0.5, 0.53, 4.23],
          [0.34, 0.29, 3.6],
          [0.66, 0.29, 3.6],
        ]) {
          for (let k = 0; k < count; k++) {
            const t = (i, r = rr) =>
              bay.at(
                width * a + Math.cos((i * Math.PI * 2) / count) * r,
                y + h + Math.sin((i * Math.PI * 2) / count) * r,
                -0.083,
              );
            if (tier >= 3) edgeRod(out, 'cut', 'pale', t(k), t(k + 1), 0.075, 0.083);
            else
              surface(
                out,
                'cut',
                'pale',
                [t(k), t(k + 1), t(k + 1, rr - 0.07), t(k, rr - 0.07)],
                bay.n,
              );
          }
        }
        band(out, bay, 0, width, gallery - 0.045, gallery + 0.21, 0.28, 1, 'pale');
        const { at } = bay;
        const [u, , v] = at(0.14, 0, -0.11);
        box(out, 'cut', 'cut', u, v, 0.27, 0.27, gallery + 0.12, eave - 0.04);
        for (const t of [0.22, 0.4, 0.58, 0.76]) {
          const q = width * t;
          pane(out, 'cut', 'cut', bay, q - 0.046, q + 0.046, gallery + 0.16, gallery + 0.78, 0.21);
        }
        band(out, bay, 0, width, gallery + 0.72, gallery + 0.88, 0.25, 1, 'cut');
        if (tier >= 3) {
          for (const end of [0.21, 0.79])
            edgeRod(
              out,
              'cut',
              'pale',
              at(width * end, gallery - 1.92, 0.11),
              at(width * 0.5, gallery + 0.45, 0.16),
              0.102,
            );
          for (const t of [0.24, 0.53, 0.81])
            edgeRod(
              out,
              'metal',
              'iron',
              at(width * t, eave - 0.09, 0),
              at(width * t, eave - 0.09, -3.22),
              0.108,
              0.15,
            );
        }
      }
      if (tier >= 2) band(out, bay, 0, width, eave - 1.14, eave - 0.96, 0.31, 1, 'pale');
      const { at } = bay;
      surface(
        out,
        'paving',
        'paving',
        [at(0, y - 0.15), at(width, y - 0.15), at(width, y - 0.15, -3.45), at(0, y - 0.15, -3.45)],
        up,
      );
      if (tier >= 2) pane(out, 'stone', 'old', bay, 0, width, court.y, eave, -3.54);
    }
  }
  const [x, z] = court.probe;
  roofDisk(out, x, z, court.y + 0.22, 1.52, tier, 'paving', 'paving');
  if (tier) {
    loft(
      out,
      'paving',
      [
        [court.y + 0.2, 0.73],
        [court.y + 0.91, 0.73],
        [court.y + 1.01, 0.84],
      ].map(([y, r]) => radialRing(y, r, r, tier >= 2 ? 12 : 8, [x, z])),
      tone.lower,
    );
    if (tier >= 2)
      for (const v of [-0.77, 0.77])
        edgeRod(out, 'metal', 'iron', [x + v, court.y + 1, z], [x, court.y + 2.91, z], 0.045);
  }
}
function annexes(out, tier) {
  for (const [i, r] of layout.roofRanges.entries()) {
    if (!tier && i % 2) continue;
    if (tier) box(out, 'stone', 'old', r.x, r.z, r.w, r.d, 10.32, r.eave);
    roof(out, r, r.x < -2 ? 'tile' : 'tileBrown');
  }
  const b = layout.chapel,
    k = layout.kitchen;
  for (const r of [b, k]) {
    box(out, 'stone', 'stone', r.x, r.z, r.w, r.d, 9.9, r.eave);
    roof(out, r, 'slate');
    if (tier)
      for (const dx of [-0.43, 0.43])
        for (const dz of [-0.43, 0.43]) {
          const x = r.x + r.w * dx,
            z = r.z + r.d * dz;
          box(out, 'cut', 'cut', x, z, 1.33, 1.42, r.eave - 2.7, r.eave + 0.88);
          const rows = [
            [r.eave + 0.82, 0.86],
            [r.eave + 1.44, 0.62],
            [r.eave + 2.86, 0.074],
          ];
          loft(
            out,
            'cut',
            rows.map(([y, s]) => radialRing(y, s, s, tier >= 2 ? 8 : 4, [x, z])),
            tone.old,
          );
        }
  }
}
export function buildPamplonaLevel(out, level) {
  const tier = ranks[level];
  if (tier === undefined) throw Error(`Unknown Pamplona Cathedral tier ${level}`);
  perimeter(out, tier);
  mainChurch(out, tier);
  annexes(out, tier);
  porch(out, tier);
  stair(out, tier);
  cloister(out, tier);
}
export const buildPamplonaSkyline = (out) => buildPamplonaLevel(out, 'skyline');
export const buildPamplonaDistrict = (out) => buildPamplonaLevel(out, 'district');
export const buildPamplonaStreet = (out) => buildPamplonaLevel(out, 'street');
export const buildPamplonaCloseup = (out) => buildPamplonaLevel(out, 'closeup');
