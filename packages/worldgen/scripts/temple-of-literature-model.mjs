/** Roofs, gates and courtyard fabric of Văn Miếu – Quốc Tử Giám. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildChineseHipRoof } from './chinese-roof-geometry.mjs';
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/w7/w7e/temple_of_literature/layout.json',
      import.meta.url,
    ),
  ),
);
export const surfaces = {
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.95 },
  roofAged: { slot: 'roof', graph: 'tile_flat', roughness: 0.95 },
  wall: { slot: 'wall', graph: 'brick_longformat', roughness: 0.97 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  limestone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.97 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 1 },
  paving: { slot: 'foundation', graph: 'clay_fired', roughness: 1 },
  lattice: { slot: 'trim', graph: 'metal_painted', metallic: 0.1, roughness: 0.81 },
};
const color = {
  roof: [0.54, 0.216, 0.097],
  roofAged: [0.29, 0.124, 0.065],
  wall: [0.44, 0.238, 0.149],
  timber: [0.49, 0.151, 0.085],
  limestone: [0.76, 0.744, 0.669],
  foundation: [0.45, 0.414, 0.355],
  paving: [0.5, 0.252, 0.137],
  lattice: [0.25, 0.36, 0.25],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t,
  negative = (a) => a.map((v) => -v);
const shade = (a, b = 0) =>
  0.91 + (((Math.imul(a + 18, 81799) ^ Math.imul(b + 15, 3709)) >>> 3) % 1021) / 5540;
function renderer(out) {
  return (slot, points, dir, tone = 1) => {
    for (let j = 1; j < points.length - 1; j++) {
      const ps = [points[0], points[j], points[j + 1]].map((p) => p.map(Math.fround));
      let n = normalFor(...ps);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((sum, v, i) => sum + v * dir[i], 0) < 0) {
        ps.reverse();
        n = negative(n);
      }
      out.addTriangle(
        slot,
        ref,
        ps,
        n,
        undefined,
        color[slot].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
function segment(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [-dz / l, 0, dx / l];
  return {
    l,
    n,
    p: (t, y, v = 0) => [mix(a[0], b[0], t) + n[0] * v, y, mix(a[1], b[1], t) + n[2] * v],
  };
}
function band(f, slot, S, bottomA, bottomB, topA, topB, width, tone = 1) {
  const h = width / 2,
    a = S.p(0, bottomA, -h),
    b = S.p(1, bottomB, -h),
    c = S.p(1, bottomB, h),
    d = S.p(0, bottomA, h);
  const A = S.p(0, topA, -h),
    B = S.p(1, topB, -h),
    C = S.p(1, topB, h),
    D = S.p(0, topA, h);
  f(slot, [a, b, B, A], negative(S.n), tone);
  f(slot, [d, c, C, D], S.n, tone);
  f(slot, [A, B, C, D], up, tone);
  f(slot, [a, d, D, A], [a[0] - b[0], 0, a[2] - b[2]], tone);
  f(slot, [b, c, C, B], [b[0] - a[0], 0, b[2] - a[2]], tone);
}
function column(f, slot, x, z, rx, rz, rings, sides, tone = 1) {
  const pts = rings.map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = ((i + 0.5) * Math.PI * 2) / sides;
      return [x + rx * r * Math.cos(a), y, z + rz * r * Math.sin(a)];
    }),
  );
  for (let j = 1; j < pts.length; j++)
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides,
        a = ((i + 1) * Math.PI * 2) / sides,
        p = pts[j - 1],
        q = pts[j];
      f(slot, [p[i], p[k], q[k], q[i]], [Math.cos(a), 0.18, Math.sin(a)], tone * shade(i, j));
    }
  f(slot, pts.at(-1), up, tone);
}
function roof(f, p, y, rise, tier, role = 'roof', scale = 1) {
  const rot = p.span === 'z',
    wide = (rot ? p.d : p.w) * scale,
    deep = (rot ? p.w : p.d) * scale;
  buildChineseHipRoof(
    f,
    {
      x: p.x,
      z: p.z,
      width: Math.max(1.45, wide - 0.62),
      depth: Math.max(1.13, deep - 0.57),
      low: y,
      rise,
      angle: rot ? Math.PI / 2 : 0,
    },
    tier >= 3 ? 2 : Math.min(tier, 1),
    role,
  );
  if (tier < 3) return;
  const ridge = Math.max(0.68, (wide - deep * 0.66) * 0.5),
    offset = rot ? [0, ridge] : [ridge, 0];
  for (const side of [-1, 1]) {
    const x = p.x + side * offset[0],
      z = p.z + side * offset[1],
      h = y + rise;
    column(
      f,
      'limestone',
      x,
      z,
      0.24,
      0.24,
      [
        [h + 0.035, 1.02],
        [h + 0.19, 0.78],
        [h + 0.41, 0.32],
      ],
      tier >= 3 ? 6 : 4,
      0.82,
    );
    if (tier >= 3) {
      const dx = rot ? 0 : side * 0.61,
        dz = rot ? side * 0.61 : 0;
      const s = segment([x, z], [x + dx, z + dz]);
      band(f, role, s, h + 0.05, h + 0.33, h + 0.22, h + 0.4, 0.14);
      if (tier === 4) {
        const t = segment([x + dx * 0.9, z + dz * 0.9], [x + dx * 1.43, z + dz * 1.43]);
        band(f, 'limestone', t, h + 0.28, h + 0.47, h + 0.39, h + 0.54, 0.092, 0.85);
      }
    }
  }
}
function skylineHall(f, p) {
  const { x, z, w, d, base, floor, eave, rise, span } = p,
    y = floor + eave;
  const r = rect(x, z, w, d).outline,
    a = r.map(([x, z]) => [x, y, z]),
    b = r.map(([x, z]) => [x, base, z]);
  const long = span === 'z',
    half = Math.max(0.28, ((long ? d : w) - (long ? w : d) * 0.66) / 2);
  const c = [x - (long ? 0 : half), y + rise, z - (long ? half : 0)],
    e = [x + (long ? 0 : half), y + rise, z + (long ? half : 0)];
  const peak = long ? [c, c, e, e] : [c, e, e, c];
  const normals = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = normals[i];
    f('wall', [b[i], b[j], a[j], a[i]], n);
    f(p.formal ? 'roof' : 'roofAged', [a[i], a[j], peak[j], peak[i]], [n[0], 1, n[2]]);
  }
  if (p.double) roof(f, { ...p, w: p.w * 0.57, d: p.d * 0.55 }, y + rise * 0.91, 3.0, 0);
}
const plinth = (f, p, h, slot = 'foundation') =>
  prism(f, slot, rect(p.x, p.z, p.w, p.d), p.base, h, false);
function hallSteps(f, p, h, tier) {
  if (tier < 1) return;
  const front = p.z - p.d / 2,
    steps = tier >= 3 ? 4 : 2,
    stepDepth = p.formal ? 0.31 : 0.21,
    w = p.formal ? p.w * 0.55 : p.w * 0.32;
  const lo = Math.min(p.floor - 0.24, p.ground - 0.22);
  for (let i = 0; i < steps; i++) {
    const y = mix(lo, h, (i + 1) / steps),
      a = front - stepDepth * (steps - i);
    prism(f, 'foundation', rect(p.x, (a + front) * 0.5, w, front - a), lo, y, false);
  }
}
function timberPosts(f, p, h, tier) {
  const y = p.floor,
    along = p.span === 'z',
    long = along ? p.d : p.w,
    short = along ? p.w : p.d;
  const count =
    tier === 1
      ? Math.max(2, Math.min(4, Math.ceil(long / 7) + 1))
      : Math.ceil(long / (tier === 2 ? 4.9 : 3.9)) + 1;
  const sides = tier === 1 && p.span === 'z' ? [p.x > 0 ? -1 : 1] : [-1, 1];
  for (const side of sides)
    for (let i = 0; i < count; i++) {
      const u = (i / (count - 1) - 0.5) * (long - 0.63),
        v = side * (short * 0.5 - 0.32);
      const x = p.x + (along ? v : u),
        z = p.z + (along ? u : v),
        r = p.formal ? 0.22 : 0.15;
      if (tier === 1) {
        if (along)
          f(
            'timber',
            [
              [x, y, z - r],
              [x, y, z + r],
              [x, h, z + r],
              [x, h, z - r],
            ],
            [side, 0, 0],
          );
        else
          f(
            'timber',
            [
              [x - r, y, z],
              [x + r, y, z],
              [x + r, h, z],
              [x - r, h, z],
            ],
            [0, 0, side],
          );
      } else if (tier === 2) prism(f, 'timber', rect(x, z, r * 1.66, r * 1.66), y, h, false);
      else {
        column(
          f,
          'timber',
          x,
          z,
          r,
          r,
          [
            [y + 0.13, 1.03],
            [h - 0.32, 0.83],
            [h, 0.91],
          ],
          tier >= 3 ? 7 : 5,
          shade(i, side),
        );
        box(f, 'limestone', x, y, z, r * 2.6, 0.19, r * 2.6);
        if (tier >= 3) box(f, 'timber', x, h - 0.42, z, r * 3.1, 0.19, r * 3.0);
      }
    }
}
function hall(f, p, tier) {
  if (tier === 0) {
    skylineHall(f, p);
    return;
  }
  const y = p.floor,
    h = y + p.eave;
  plinth(f, p, y);
  if (!p.open) {
    const depth = p.open ? p.d * 0.64 : p.d * 0.76,
      z = p.z + (p.span === 'x' ? p.d * 0.04 : 0),
      width = p.w * 0.83;
    prism(f, 'wall', rect(p.x, z, width, depth), y, h - 0.17, false);
  }
  timberPosts(f, p, h, tier);
  if (tier > 0) {
    const along = p.span === 'z',
      w = along ? p.w * 0.78 : p.w * 0.98,
      d = along ? p.d * 0.98 : p.d * 0.8;
    if (tier >= 2) box(f, 'timber', p.x, h - 0.31, p.z, w, 0.27, d);
    if (!p.open && tier >= 2) {
      const n = p.formal ? 7 : 3,
        face = p.z - p.d * 0.382;
      for (let i = 0; i < n; i++) {
        const x = p.x + ((i + 0.5 - n * 0.5) * p.w * 0.79) / n,
          doorWidth = (p.w * 0.54) / n;
        box(f, 'timber', x, y + 0.1, face - 0.035, doorWidth, h - y - 0.83, 0.105);
        if (tier >= 3)
          for (const side of [-1, 1]) {
            const s = x + side * doorWidth * 0.21;
            box(f, 'timber', s, y + 0.27, face - 0.092, 0.048, h - y - 1.08, 0.03);
          }
      }
    }
  }
  roof(f, p, h, p.rise, tier === 1 && !p.formal ? 0 : tier, p.formal ? 'roof' : 'roofAged');
  if (p.double) {
    const upper = { ...p, z: p.z + 0.16, w: p.w * 0.57, d: p.d * 0.55 };
    const lo = h + p.rise * 0.66;
    box(f, 'timber', p.x, lo, upper.z, upper.w * 0.9, 1.24, upper.d * 0.81);
    roof(f, upper, lo + 1.24, 3.0, tier);
    if (tier >= 2)
      for (let i = -4; i <= 4; i++)
        for (const side of [-1, 1]) {
          const z = upper.z + side * upper.d * 0.408;
          box(f, 'limestone', p.x + i * upper.w * 0.09, lo + 0.17, z, 0.22, 0.83, 0.074);
        }
  }
  if (p.formal || p.pavilion) hallSteps(f, p, y, tier);
}
function arch(f, p, y, tier, opening) {
  const { x, z, w, d } = p,
    top = y + p.eave,
    base = p.base,
    outerWidth = Math.max(w, 0.85),
    depth = Math.max(d, 0.55);
  const spring = y + (p.low ? 1.42 : 2.35),
    rise = p.low ? 0.56 : 0.75,
    r = opening * 0.5,
    n = tier < 2 ? 4 : tier === 2 ? 8 : 13;
  for (const side of [-1, 1]) {
    const z0 = z + side * depth * 0.42,
      dir = [0, 0, side];
    for (const lateral of [-1, 1]) {
      const a = x + lateral * r,
        b = x + lateral * outerWidth * 0.49;
      f(
        'wall',
        [
          [a, base, z0],
          [b, base, z0],
          [b, top, z0],
          [a, top, z0],
        ],
        dir,
      );
    }
    const curve = Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [x - r * Math.cos(a), spring + rise * Math.sin(a)];
    });
    for (let i = 0; i < n; i++) {
      const [a, b] = curve.slice(i, i + 2);
      f(
        'wall',
        [
          [a[0], a[1], z0],
          [b[0], b[1], z0],
          [b[0], top, z0],
          [a[0], top, z0],
        ],
        dir,
        shade(i),
      );
      if (tier > 1) {
        const a2 = (Math.PI * i) / n,
          b2 = (Math.PI * (i + 1)) / n,
          z1 = z0 + side * 0.026;
        f(
          'limestone',
          [
            [a[0], a[1], z1],
            [b[0], b[1], z1],
            [x - (r + 0.18) * Math.cos(b2), spring + (rise + 0.18) * Math.sin(b2), z1],
            [x - (r + 0.18) * Math.cos(a2), spring + (rise + 0.18) * Math.sin(a2), z1],
          ],
          dir,
          shade(i, side),
        );
      }
      if (side === 1)
        f(
          'foundation',
          [
            [a[0], a[1], z0],
            [a[0], a[1], z - depth * 0.42],
            [b[0], b[1], z - depth * 0.42],
            [b[0], b[1], z0],
          ],
          [0, -1, 0],
        );
    }
  }
  for (const side of [-1, 1])
    for (const edge of [r, outerWidth * 0.49]) {
      const u = x + side * edge,
        z0 = z - depth * 0.42,
        z1 = z + depth * 0.42;
      f(
        'wall',
        [
          [u, base, z0],
          [u, base, z1],
          [u, edge === r ? spring : top, z1],
          [u, edge === r ? spring : top, z0],
        ],
        [side * (edge === r ? -1 : 1), 0, 0],
      );
    }
}
function gate(f, p, tier) {
  const y = p.ground + 0.07,
    h = y + p.eave,
    door = p.low ? Math.max(0.66, Math.min(1.36, p.w * 0.56)) : Math.max(1.88, p.w * 0.37);
  if (p.low || p.main) arch(f, p, y, tier, door);
  else if (tier === 0) {
    for (const side of [-1, 1]) {
      const x = p.x + side * p.w * 0.39,
        S = segment([x, p.z - p.d * 0.39], [x, p.z + p.d * 0.39]);
      band(f, 'timber', S, p.base, p.base, h, h, p.w * 0.16);
    }
  } else {
    for (const side of [-1, 1])
      for (const column of [-0.46, -0.19, 0.19, 0.46]) {
        const x = p.x + p.w * column,
          z = p.z + side * p.d * 0.32,
          r = 0.21;
        if (tier < 3) prism(f, 'timber', rect(x, z, 0.35, 0.35), p.base, h, false);
        else {
          box(f, 'foundation', x, p.base, z, 0.46, y - p.base + 0.18, 0.46);
          const points = [
            [y + 0.16, 1.07],
            [h - 0.14, 0.83],
            [h, 0.94],
          ];
          roundGatePost(f, x, z, r, points, tier);
        }
      }
    if (tier > 0)
      for (const s of [-1, 1])
        box(f, 'timber', p.x, h - 0.34, p.z + s * p.d * 0.32, p.w * 0.93, 0.32, 0.26);
  }
  roof(f, p, h, p.main ? 2.25 : p.rise, tier, p.low ? 'roofAged' : 'roof');
  if (p.twoTier) {
    const upper = { ...p, w: p.w * 0.67, d: p.d * 0.65 };
    box(f, 'timber', p.x, h + 1.25, p.z, upper.w * 0.89, 0.87, upper.d * 0.74);
    roof(f, upper, h + 2.02, 1.58, tier);
  }
  if (tier >= 2 && !p.low)
    for (const side of [-1, 1]) {
      box(
        f,
        'timber',
        p.x,
        h - 0.76,
        p.z + side * p.d * 0.394,
        Math.min(2.52, p.w * 0.4),
        0.53,
        0.15,
      );
      box(
        f,
        'limestone',
        p.x,
        h - 0.84,
        p.z + side * p.d * 0.396,
        Math.min(2.56, p.w * 0.42),
        0.065,
        0.19,
      );
    }
}
function roundGatePost(f, x, z, r, profile, tier) {
  column(f, 'timber', x, z, r, r, profile, tier >= 3 ? 8 : 6);
}
function circularPanel(f, p, y, tier) {
  const r = tier === 1 ? 1.0 : 1.09,
    sides = tier === 0 ? 8 : tier === 1 ? 12 : tier === 2 ? 20 : 32;
  const half = 1.72,
    vertical = 1.28;
  const outer = [
    [-half, -vertical],
    [half, -vertical],
    [half, vertical],
    [-half, vertical],
  ];
  const hole = Array.from({ length: sides }, (_, i) => {
    const a = (i * 2 * Math.PI) / sides;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const ps = [...outer, ...hole],
    ix = earcut(ps.flat(), [4]);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a),
      out = [s, 0, c];
    const point = ([u, v], d = 2.04) => [p.x + c * u + s * d, y + v, p.z - s * u + c * d];
    for (let j = 0; j < ix.length; j += 3)
      f(
        'timber',
        ix.slice(j, j + 3).map((k) => point(ps[k])),
        out,
        1.05,
      );
    if (tier < 2) continue;
    for (let i = 0; i < sides; i++) {
      const a = hole[i],
        b = hole[(i + 1) % sides],
        w = (v) => v.map((n) => n * (1 + 0.108 / r));
      f(
        'timber',
        [point(a, 2.09), point(b, 2.09), point(w(b), 2.09), point(w(a), 2.09)],
        out,
        1.31,
      );
      f(
        'timber',
        [point(a, 2.09), point(b, 2.09), point(b, 1.95), point(a, 1.95)],
        [a[0] * -c, -a[1], a[0] * s],
        0.82,
      );
    }
    for (let k = 0; k < (tier >= 3 ? 8 : 4); k++) {
      const a = ((k + 0.5) * Math.PI) / (tier >= 3 ? 4 : 2),
        end = [Math.cos(a), Math.sin(a)],
        u = end[0],
        v = end[1];
      const ext =
        Math.min(half / Math.max(0.01, Math.abs(u)), vertical / Math.max(0.01, Math.abs(v))) -
        0.018;
      const pt = (l, t) => point([u * l - v * t, v * l + u * t], 2.11);
      f(
        'timber',
        [pt(r + 0.03, -0.044), pt(ext, -0.044), pt(ext, 0.044), pt(r + 0.03, 0.044)],
        out,
        1.46,
      );
    }
  }
}
function khue(f, p, tier) {
  const y = p.ground + 0.11,
    deck = y + 2.98,
    eave = y + p.eave;
  for (const i of [-1, 1])
    for (const j of [-1, 1]) {
      const x = p.x + i * 1.88,
        z = p.z + j * 1.8;
      box(f, 'foundation', x, p.base, z, 0.8, y - p.base + 0.29, 0.8);
      box(f, 'limestone', x, y + 0.18, z, 0.56, deck - y - 0.18, 0.57);
      if (tier >= 2) {
        const z0 = z + j * 0.292;
        box(f, 'limestone', x, y + 0.38, z0, 0.34, deck - y - 0.62, 0.039);
        if (tier >= 3)
          for (let k = 0; k < 4; k++)
            box(f, 'foundation', x, y + 0.58 + k * 0.49, z0 + j * 0.024, 0.18, 0.034, 0.009);
      }
    }
  box(f, 'timber', p.x, deck - 0.18, p.z, 4.84, 0.39, 4.74);
  for (const i of [-1, 1])
    for (const j of [-1, 1])
      box(f, 'timber', p.x + i * 2.06, deck + 0.14, p.z + j * 2.04, 0.35, eave - deck - 0.08, 0.35);
  circularPanel(f, p, deck + 1.36, tier);
  if (tier > 0)
    for (const side of [-1, 1]) {
      box(f, 'timber', p.x, deck + 0.6, p.z + side * 2.34, 4.72, 0.104, 0.14);
      box(f, 'timber', p.x + side * 2.32, deck + 0.6, p.z, 0.14, 0.104, 4.67);
      const n = tier >= 3 ? 15 : 7;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * 4.55) / n - 2.275;
        if (tier === 1) {
          const x = p.x + u,
            z = p.z + side * 2.34,
            x2 = p.x + side * 2.32,
            z2 = p.z + u;
          f(
            'timber',
            [
              [x - 0.034, deck + 0.21, z],
              [x + 0.034, deck + 0.21, z],
              [x + 0.034, deck + 0.61, z],
              [x - 0.034, deck + 0.61, z],
            ],
            [0, 0, side],
          );
          f(
            'timber',
            [
              [x2, deck + 0.21, z2 - 0.034],
              [x2, deck + 0.21, z2 + 0.034],
              [x2, deck + 0.61, z2 + 0.034],
              [x2, deck + 0.61, z2 - 0.034],
            ],
            [side, 0, 0],
          );
        } else {
          box(f, 'timber', p.x + u, deck + 0.21, p.z + side * 2.34, 0.074, 0.4, 0.074);
          box(f, 'timber', p.x + side * 2.32, deck + 0.21, p.z + u, 0.074, 0.4, 0.074);
        }
      }
    }
  roof(f, p, eave, 0.99, tier, 'roofAged');
  roof(f, { ...p, w: p.w * 0.69, d: p.d * 0.7 }, eave + 0.84, p.rise, tier, 'roofAged');
}
function stelae(f, p, tier) {
  if (tier === 0) return;
  const count = tier === 1 ? Math.ceil(p.count * 0.45) : p.count,
    sign = Math.sign(p.x);
  for (let i = 0; i < count; i++) {
    const z = p.z + ((i + 0.5 - count * 0.5) * (p.d - 0.84)) / count,
      x = p.x - sign * p.w * 0.14,
      y = p.floor + 0.02;
    if (tier >= 3) {
      column(
        f,
        'foundation',
        x,
        z,
        0.64,
        0.37,
        [
          [y, 0.94],
          [y + 0.14, 1],
          [y + 0.25, 0.78],
        ],
        tier >= 3 ? 8 : 5,
        shade(i),
      );
      column(
        f,
        'foundation',
        x - sign * 0.54,
        z,
        0.245,
        0.16,
        [
          [y + 0.01, 1],
          [y + 0.135, 0.94],
          [y + 0.19, 0.54],
        ],
        tier >= 3 ? 7 : 4,
      );
    } else if (tier === 2) prism(f, 'foundation', rect(x, z, 1.1, 0.55), y, y + 0.22, false);
    if (tier === 1) {
      f(
        'foundation',
        [
          [x, y + 0.19, z - 0.38],
          [x, y + 0.19, z + 0.38],
          [x, y + 1.37, z + 0.38],
          [x, y + 1.37, z - 0.38],
        ],
        [-sign, 0, 0],
      );
    } else if (tier === 2)
      prism(f, 'foundation', rect(x, z, 0.18, 0.77), y + 0.19, y + 1.44, false);
    else box(f, 'foundation', x, y + 0.19, z, 0.18, 1.18, 0.77);
    if (tier >= 3) {
      const ring = [
        [z - 0.38, y + 1.35],
        [z + 0.38, y + 1.35],
        [z + 0.32, y + 1.57],
        [z + 0.16, y + 1.68],
        [z - 0.17, y + 1.68],
        [z - 0.32, y + 1.56],
      ];
      for (const side of [-1, 1])
        f(
          'limestone',
          ring.map(([z, y]) => [x + side * 0.093, y, z]),
          [side, 0, 0],
          0.83,
        );
      if (tier >= 3)
        for (let k = 0; k < 6; k++)
          f(
            'foundation',
            [
              [x - sign * 0.095, y + 0.36, z - 0.21 + k * 0.078],
              [x - sign * 0.095, y + 0.36, z - 0.197 + k * 0.078],
              [x - sign * 0.095, y + 1.18, z - 0.197 + k * 0.078],
              [x - sign * 0.095, y + 1.18, z - 0.21 + k * 0.078],
            ],
            [-sign, 0, 0],
            0.77,
          );
    }
  }
}
function walls(f, tier) {
  for (const row of layout.walls)
    for (let i = 1; i < row.path.length; i++) {
      const [a, b] = row.path.slice(i - 1, i + 1),
        S = segment(a, b),
        [ya, yb] = [a[2], b[2]];
      band(
        f,
        'wall',
        S,
        ya - 1.75,
        yb - 1.75,
        ya + row.height,
        yb + row.height,
        row.width,
        shade(i),
      );
      if (tier > 0)
        band(
          f,
          'roofAged',
          S,
          ya + row.height,
          yb + row.height,
          ya + row.height + 0.135,
          yb + row.height + 0.135,
          row.width + 0.15,
        );
    }
}
function basins(f, tier) {
  for (const well of layout.wells) {
    const { center, ring, central } = well;
    if (tier === 0 && !central) continue;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        S = segment(a, b);
      const dir = S.n[0] * (center[0] - a[0]) + S.n[2] * (center[1] - a[1]);
      const p = (t, y, v) => S.p(t, y, v * Math.sign(-dir));
      const rim = central ? 0.13 : 0.09;
      const y = (t) => mix(a[2], b[2], t);
      f(
        'foundation',
        [
          p(0, y(0) - 0.48, 0.45),
          p(1, y(1) - 0.48, 0.45),
          p(1, y(1) + rim, 0.45),
          p(0, y(0) + rim, 0.45),
        ],
        negative(S.n.map((n) => n * Math.sign(dir))),
      );
      f(
        central ? 'limestone' : 'paving',
        [
          p(0, y(0) + rim, -0.16),
          p(1, y(1) + rim, -0.16),
          p(1, y(1) + rim, 0.45),
          p(0, y(0) + rim, 0.45),
        ],
        up,
      );
      if (!central || tier === 0) continue;
      const N = tier === 0 ? 4 : tier === 1 ? 6 : 9,
        high = 0.91;
      const B = segment(
        p(0, 0, 0.44).filter((_, i) => i !== 1),
        p(1, 0, 0.44).filter((_, i) => i !== 1),
      );
      band(f, 'limestone', B, y(0) + 0.1, y(1) + 0.1, y(0) + 0.35, y(1) + 0.35, 0.27);
      band(
        f,
        'limestone',
        B,
        y(0) + high - 0.16,
        y(1) + high - 0.16,
        y(0) + high,
        y(1) + high,
        0.32,
      );
      for (let j = 0; j < N; j++) {
        const u = j / N,
          [x, , z] = p(u, 0, 0.44);
        box(f, 'limestone', x, y(u) + 0.18, z, 0.39, high - 0.02, 0.39);
        if (tier > 2) {
          box(f, 'limestone', x, y(u) + high + 0.12, z, 0.49, 0.11, 0.49);
          const v = (j + 0.5) / N,
            h = 0.145,
            w = 0.237;
          const C = (s, o) => p(v + (s * w) / S.l, y(v) + 0.54 + o * h, 0.46);
          const pts = [C(-1, 0), C(0, 1), C(1, 0), C(0, -1)];
          for (let k = 0; k < 4; k++) {
            const a = pts[k],
              b = pts[(k + 1) % 4],
              a2 = a.map((n, j) => (j === 1 ? n - 0.042 : n)),
              b2 = b.map((n, j) => (j === 1 ? n - 0.042 : n));
            for (const n of [S.n, negative(S.n)]) f('lattice', [a, a2, b2, b], n);
          }
        }
      }
    }
  }
}
function paving(f, tier) {
  if (tier === 0) return;
  const stride = tier === 1 ? 3 : 1,
    p = ([x, z, y]) => [x, y + 0.245, z];
  for (const pad of layout.pads)
    for (let i = stride; i < pad.rows.length; i += stride) {
      const [a, b] = [pad.rows[i - stride], pad.rows[i]];
      for (let j = stride; j < a.length + stride - 1; j += stride) {
        const k = Math.min(j, a.length - 1);
        f('paving', [p(a[j - stride]), p(a[k]), p(b[k]), p(b[j - stride])], up, shade(i, k));
      }
    }
}
export function buildTempleOfLiteratureLevel(out, level) {
  const tier = levels[level],
    f = renderer(out);
  walls(f, tier);
  for (const p of layout.portals) gate(f, p, tier);
  if (tier > 1) for (const p of layout.posterns) gate(f, p, tier);
  khue(f, layout.khue, tier);
  const halls = tier === 0 ? layout.halls.filter((p) => p.formal || p.open) : layout.halls;
  for (const p of [...halls, ...layout.academy, ...layout.steleGates, ...layout.steles])
    hall(f, p, tier);
  for (const p of layout.steles) stelae(f, p, tier);
  basins(f, tier);
  paving(f, tier);
}
export const buildTempleOfLiteratureSkyline = (out) => buildTempleOfLiteratureLevel(out, 'skyline');
export const buildTempleOfLiteratureDistrict = (out) =>
  buildTempleOfLiteratureLevel(out, 'district');
export const buildTempleOfLiteratureStreet = (out) => buildTempleOfLiteratureLevel(out, 'street');
export const buildTempleOfLiteratureCloseup = (out) => buildTempleOfLiteratureLevel(out, 'closeup');
