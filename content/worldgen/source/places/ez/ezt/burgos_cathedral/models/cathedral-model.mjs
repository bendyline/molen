/** Burgos Cathedral, with mapped roof volumes and the exterior Gothic fabric. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const cathedralSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw' },
  trim: { slot: 'trim', graph: 'stone_limestone_raw' },
  foundation: { slot: 'foundation', graph: 'stone_limestone_weathered' },
  tile: { slot: 'roof', graph: 'tile_flat' },
  slate: { slot: 'roof', graph: 'slate' },
  glass: { slot: 'trim', graph: 'metal_painted' },
  wood: { slot: 'door', graph: 'wood_plain' },
};
const swatches = {
  wall: 'd7c8ab',
  court: 'dfd2b8',
  light: 'e5d8bd',
  pale: 'eee1c8',
  shadow: 'a79980',
  base: 'aa9c83',
  pink: 'c2a68d',
  tile: 'a66b4e',
  slate: '6c7773',
  blue: '586975',
  dark: '47514d',
  amber: '7f7056',
  green: '546960',
  ruby: '744e49',
  wood: '644a3d',
};
const color = Object.fromEntries(
  Object.entries(swatches).map(([k, hex]) => [
    k,
    hex.match(/../g).map((v) => {
      const n = parseInt(v, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  tau = Math.PI * 2,
  at = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function face(out, slot, tint, p, wanted) {
  if (p.length === 4) {
    face(out, slot, tint, p.slice(0, 3), wanted);
    face(out, slot, tint, [p[0], p[2], p[3]], wanted);
    return;
  }
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.9) return;
  if (n.reduce((a, v, i) => a + v * wanted[i], 0) < 0) {
    p = p.toReversed();
    n = normalFor(...p);
  }
  if (p.length === 3) out.addTriangle(slot, ref, p, n, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, p, n, (q) => [q[0], q[2]], color[tint]);
}
function frame([x, z], [a, b]) {
  const l = Math.hypot(a - x, b - z),
    dx = (a - x) / l,
    dz = (b - z) / l;
  return { l, n: [dz, 0, -dx], p: (u, y, w = 0) => [x + dx * u + dz * w, y, z + dz * u - dx * w] };
}
function panel(out, f, slot, tint, a, b, y, h, w = 0) {
  if (b - a < 0.008 || h - y < 0.008) return;
  face(out, slot, tint, [f.p(a, y, w), f.p(b, y, w), f.p(b, h, w), f.p(a, h, w)], f.n);
}
function cap(out, slot, tint, r, y) {
  const n = earcut(r.flat());
  for (let i = 0; i < n.length; i += 3)
    face(
      out,
      slot,
      tint,
      n.slice(i, i + 3).map((j) => at(r[j], y)),
      up,
    );
}
function shell(out, slot, tint, r, y, h, close = false) {
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = frame(a, b);
    panel(out, f, slot, tint, 0, f.l, y, h);
  }
  if (close) cap(out, slot, tint, r, h);
}
function prism(out, slot, tint, [x, z], w, d, y, h, c = 0.1) {
  loft(
    out,
    slot,
    [chamferedRectangle(x, y, z, w, d, c), chamferedRectangle(x, h, z, w, d, c)],
    color[tint],
  );
}
function stroke(out, f, slot, tint, [x, y], [a, b], thick, w) {
  const dx = a - x,
    dy = b - y,
    len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  const u = (-dy * thick) / (2 * len),
    v = (dx * thick) / (2 * len);
  face(
    out,
    slot,
    tint,
    [f.p(x - u, y - v, w), f.p(a - u, b - v, w), f.p(a + u, b + v, w), f.p(x + u, y + v, w)],
    f.n,
  );
}
function pointed(center, spring, r, rise, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps,
      x = Math.cos(t);
    return [center + r * x, spring + rise * Math.pow(1 - Math.abs(x), 0.63)];
  });
}
function arch(
  out,
  f,
  u,
  y,
  w,
  h,
  tier,
  { depth = 0.05, tint = 'blue', slot = 'glass', trim = 0.17, recess = false } = {},
) {
  const r = w / 2,
    spring = y + h * 0.6,
    rise = h * 0.4,
    n = tier >= 3 ? 10 : tier >= 2 ? 5 : 4;
  const a = pointed(u, spring, r, rise, n),
    b = pointed(u, spring, r + trim, rise + trim, n);
  face(
    out,
    slot,
    tint,
    [[u - r, y], [u + r, y], ...a].map(([x, z]) => f.p(x, z, depth)),
    f.n,
  );
  const outer = depth + (recess ? 0.45 : 0.067);
  for (let i = 1; i < a.length; i++) {
    const q = [a[i - 1], a[i], b[i], b[i - 1]].map(([x, z]) => f.p(x, z, outer));
    face(out, 'trim', 'light', q, f.n);
    if (recess)
      face(out, 'trim', 'shadow', [f.p(...a[i - 1], depth), f.p(...a[i], depth), q[1], q[0]], up);
  }
  panel(out, f, 'trim', 'pale', u - r - trim, u - r, y, spring, outer);
  panel(out, f, 'trim', 'pale', u + r, u + r + trim, y, spring, outer);
  if (recess)
    for (const s of [-1, 1]) {
      const x = u + s * r;
      face(
        out,
        'trim',
        'shadow',
        [f.p(x, y, depth), f.p(x, spring, depth), f.p(x, spring, outer), f.p(x, y, outer)],
        f.n,
      );
    }
  if (slot === 'glass' && tier >= 2) {
    panel(out, f, 'trim', 'light', u - 0.041, u + 0.041, y + 0.1, y + h - 0.37, depth + 0.086);
    panel(out, f, 'trim', 'light', u - r, u + r, y - 0.09, y + 0.04, depth + 0.13);
    if (tier >= 3) {
      const len = h * 0.68;
      for (const sign of [-1, 1]) {
        panel(
          out,
          f,
          'trim',
          'pale',
          u + sign * r * 0.47 - 0.024,
          u + sign * r * 0.47 + 0.024,
          y + 0.08,
          y + len,
          depth + 0.09,
        );
        stroke(
          out,
          f,
          'trim',
          'light',
          [u + sign * r * 0.91, spring + 0.11],
          [u + sign * 0.055, spring + rise * 0.74],
          0.06,
          depth + 0.097,
        );
      }
    }
  }
}
function rose(out, f, u, y, r, tier, w = 0.19) {
  const n = [12, 18, 28, 42, 48][tier];
  const polar = (i, d) => [u + Math.cos((i * tau) / n) * d, y + Math.sin((i * tau) / n) * d];
  for (let i = 0; i < n; i++) {
    const a = polar(i, r),
      b = polar(i + 1, r);
    face(
      out,
      'glass',
      tier >= 2 ? ['blue', 'dark', 'green', 'amber', 'ruby'][Math.floor(i / 2) % 5] : 'blue',
      [f.p(u, y, w), f.p(...a, w), f.p(...b, w)],
      f.n,
    );
    face(
      out,
      'trim',
      'light',
      [
        f.p(...a, w + 0.052),
        f.p(...b, w + 0.052),
        f.p(...polar(i + 1, r + 0.23), w + 0.1),
        f.p(...polar(i, r + 0.23), w + 0.1),
      ],
      f.n,
    );
    if (tier >= 1 && i % 2 === 0) {
      stroke(out, f, 'trim', 'pale', polar(i, r * 0.2), polar(i, r), 0.1, w + 0.083);
      if (tier >= 2) {
        stroke(
          out,
          f,
          'trim',
          'light',
          polar(i, r * 0.62),
          polar(i + 1, r * 0.79),
          0.075,
          w + 0.084,
        );
        stroke(
          out,
          f,
          'trim',
          'light',
          polar(i + 1, r * 0.79),
          polar(i + 2, r * 0.62),
          0.075,
          w + 0.084,
        );
      }
    }
  }
  if (tier >= 1) {
    for (const d of tier >= 2 ? [0.24, 0.6, 0.87] : [0.56]) {
      for (let i = 0; i < n; i += 2)
        stroke(out, f, 'trim', 'light', polar(i, r * d), polar(i + 2, r * d), 0.078, w + 0.087);
    }
  }
}
function pinnacle(out, [x, z], base, top, w, tier) {
  const d = top - base;
  if (d < 0.12) return;
  const n = tier >= 2 ? 8 : 4;
  const rows =
    tier >= 2
      ? [
          [base, w * 0.52],
          [base + d * 0.13, w * 0.54],
          [base + d * 0.2, w * 0.43],
          [base + d * 0.43, w * 0.39],
          [base + d * 0.51, w * 0.29],
          [top - d * 0.11, w * 0.12],
          [top, 0.045],
        ]
      : [
          [base, w * 0.52],
          [base + d * 0.35, w * 0.4],
          [top, 0.034],
        ];
  loft(
    out,
    'trim',
    rows.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 4)),
    color.light,
    { cap: false },
  );
  if (tier >= 3) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      for (let j = 0; j < 4; j++) {
        const t = 0.45 + j * 0.119,
          r = w * (0.43 - 0.31 * t),
          y = base + d * t;
        const p = [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
        beam(
          out,
          'trim',
          p,
          [p[0] + Math.cos(a) * w * 0.21, y + d * 0.042, p[2] + Math.sin(a) * w * 0.21],
          w * 0.105,
          w * 0.105,
          color.pale,
        );
      }
    }
  }
}
function floors(out, tier) {
  for (const v of layout.volumes) {
    const { sides, roof } = tier < 2 && !(tier === 1 && v.eave >= 26) ? v.far : v.near;
    for (const [a, b, y, h] of sides) {
      const f = frame(a, b);
      face(
        out,
        'stone',
        v.name.includes('court') ? 'court' : 'wall',
        [f.p(0, v.floor), f.p(f.l, v.floor), f.p(f.l, h), f.p(0, y)],
        f.n,
      );
    }
    for (const p of roof) face(out, v.roofSlot, v.roofSlot, p, up);
    if (tier === 0) continue;
    for (const [i, a] of v.ring.entries()) {
      const b = v.ring[(i + 1) % v.ring.length],
        f = frame(a, b);
      if (f.l < 0.44 || (tier === 1 && (v.eave < 26 || f.l < 3.5))) continue;
      panel(out, f, 'foundation', 'base', 0, f.l, v.floor, 3.1, 0.013);
      panel(out, f, 'trim', 'pale', 0, f.l, v.eave - 0.54, v.eave - 0.17, 0.1);
      if (
        tier >= 2 &&
        f.l > (tier === 2 ? 5.7 : 4.1) &&
        v.visibleEdges[i] &&
        !v.name.includes('transept')
      ) {
        const count = Math.max(1, Math.floor(f.l / (tier === 2 ? 7.0 : 5.0)));
        for (let j = 0; j < count; j++) {
          const x = (f.l * (j + 0.5)) / count;
          arch(out, f, x, v.eave - 7.2, Math.min(1.82, f.l * 0.36), 5.1, tier, {
            depth: 0.058,
            trim: 0.14,
            tint: v.name.includes('chapel') ? 'green' : 'blue',
          });
          if (tier >= 3 && count > 1 && j < count - 1) {
            const u = (f.l * (j + 1)) / count;
            panel(out, f, 'trim', 'light', u - 0.15, u + 0.15, v.eave - 8.45, v.eave - 0.57, 0.18);
          }
        }
      }
    }
  }
}
function openBelfry(out, f, low, high, tier) {
  const L = f.l;
  if (L < 6) {
    panel(out, f, 'stone', 'wall', 0, L, low, high);
    return;
  }
  const centers = [L * 0.29, L * 0.71],
    r = L * 0.138,
    spring = high - 3.32,
    crown = high - 1.08;
  panel(out, f, 'stone', 'wall', 0, centers[0] - r, low, high);
  panel(out, f, 'stone', 'wall', centers[0] + r, centers[1] - r, low, high);
  panel(out, f, 'stone', 'wall', centers[1] + r, L, low, high);
  for (const u of centers) {
    const profile = pointed(u, spring, r, crown - spring, [4, 4, 6, 10, 10][tier]);
    for (let i = 1; i < profile.length; i++) {
      const [a, y] = profile[i - 1],
        [b, h] = profile[i];
      face(out, 'stone', 'wall', [f.p(a, y), f.p(b, h), f.p(b, high), f.p(a, high)], f.n);
      if (tier >= 2) stroke(out, f, 'trim', 'pale', [a, y], [b, h], 0.18, 0.16);
      if (tier >= 2)
        face(out, 'trim', 'shadow', [f.p(a, y), f.p(b, h), f.p(b, h, -0.56), f.p(a, y, -0.56)], up);
    }
    for (const sign of [-1, 1]) {
      const x = u + sign * r;
      if (tier >= 2)
        face(
          out,
          'trim',
          'shadow',
          [f.p(x, low), f.p(x, spring), f.p(x, spring, -0.65), f.p(x, low, -0.65)],
          f.n,
        );
      if (tier >= 2) panel(out, f, 'trim', 'light', x - 0.105, x + 0.105, low, spring, 0.18);
    }
    if (tier >= 2) {
      panel(out, f, 'glass', 'dark', u - r, u + r, low + 0.09, spring, -1.1);
      for (let j = 0; j < 5; j++)
        panel(
          out,
          f,
          'trim',
          'shadow',
          u - r + 0.09,
          u + r - 0.09,
          low + 0.42 + j * 0.63,
          low + 0.5 + j * 0.63,
          -0.31,
        );
      panel(out, f, 'trim', 'light', u - 0.065, u + 0.065, low, spring + 0.6, 0.075);
    }
  }
}
function lattice(out, a, b, normal, width, tier) {
  const direction = b.map((v, i) => v - a[i]);
  const across = normalize(cross(normal, direction)).map((v) => v * width * 0.5);
  const q = (p, s, depth) => p.map((v, i) => v + s * across[i] + depth * normal[i]);
  const front = [q(a, -1, 0.038), q(a, 1, 0.038), q(b, 1, 0.038), q(b, -1, 0.038)];
  face(out, 'trim', 'light', front, normal);
  if (tier >= 2) {
    const back = [q(a, -1, -0.038), q(a, 1, -0.038), q(b, 1, -0.038), q(b, -1, -0.038)];
    face(
      out,
      'trim',
      'shadow',
      back,
      normal.map((v) => -v),
    );
    if (tier >= 3)
      for (const [i, j] of [
        [0, 3],
        [1, 2],
      ])
        face(
          out,
          'trim',
          'pale',
          [front[i], front[j], back[j], back[i]],
          across.map((v) => (i === 0 ? -v : v)),
        );
  }
}
function spire(out, site, tier) {
  const [x, z] = site.center,
    N = 8,
    n = tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 5 : tier === 3 ? 7 : 8;
  const y0 = 48.0,
    top = site.top - 1.08;
  const point = (j, i, side = 0) => {
    const t = j / n,
      a = ((i + side) * tau) / N + Math.PI / 8,
      r = 3.06 * (1 - 0.965 * t);
    return [x + Math.cos(a) * r, y0 + (top - y0) * t, z + Math.sin(a) * r];
  };
  for (let i = 0; i < N; i++) {
    const a = point(0, i),
      b = point(n, i);
    if (tier === 0)
      face(
        out,
        'trim',
        'light',
        [point(0, i, -0.29), point(0, i, 0.29), b],
        normalize([a[0] - x, 0.15, a[2] - z]),
      );
    else if (tier === 1) lattice(out, a, b, normalize([a[0] - x, 0.15, a[2] - z]), 0.29, tier);
    else beam(out, 'trim', a, b, 0.26, 0.25, color.light);
    for (let j = 0; j < n; j++) {
      const A = point(j, i),
        B = point(j, i + 1),
        C = point(j + 1, i + 1),
        D = point(j + 1, i);
      const normal = normalize([A[0] + B[0] - 2 * x, 0.05, A[2] + B[2] - 2 * z]),
        band = j === 0 ? 0.3 : 0.17;
      const side = [...normal];
      side[1] = 0.16;
      const thick = (p, h) => [p[0], p[1] + h, p[2]];
      face(
        out,
        'trim',
        'pale',
        [thick(A, -band), thick(B, -band), thick(B, band), thick(A, band)],
        normal,
      );
      const mid = mix(mix(A, B, 0.5), mix(C, D, 0.5), 0.47);
      if (tier === 0) {
        face(out, 'trim', 'light', [A, thick(A, 0.52), mid], side);
        face(out, 'trim', 'light', [B, mid, thick(B, 0.52)], side);
      } else {
        const thickness = tier === 1 ? 0.15 : 0.137;
        for (const p of [A, B, C, D]) lattice(out, p, mid, normal, thickness, tier);
        if (tier >= 3) {
          const left = mix(A, D, 0.49),
            right = mix(B, C, 0.49);
          lattice(out, left, mid, normal, 0.106, tier);
          lattice(out, right, mid, normal, 0.106, tier);
          if (j % 2 === 0) {
            lattice(out, mix(A, D, 0.36), mix(A, B, 0.39), normal, 0.082, tier);
            lattice(out, mix(B, C, 0.36), mix(B, A, 0.39), normal, 0.082, tier);
          }
        }
      }
    }
  }
  if (tier === 0) {
    const r = 0.26,
      b = [
        [x - r, 73.89, z],
        [x + r, 73.89, z],
        [x, 73.89, z - r],
        [x, 73.89, z + r],
      ];
    face(out, 'trim', 'light', [b[0], b[1], [x, 75, z]], [0, 0, 1]);
    face(out, 'trim', 'light', [b[2], b[3], [x, 75, z]], [1, 0, 0]);
  } else {
    pinnacle(out, site.center, top - 0.3, site.top, 0.66, tier);
    if (tier >= 2)
      beam(out, 'trim', [x - 0.34, 74.47, z], [x + 0.34, 74.47, z], 0.062, 0.065, color.pale);
  }
}
function tower(out, site, tier) {
  const r = site.body,
    [x, z] = site.center;
  shell(out, 'stone', 'wall', r, site.floor, 29.7);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = frame(a, b);
    if (tier === 0) {
      panel(out, f, 'stone', 'wall', 0, f.l, 29.7, 48);
      continue;
    }
    openBelfry(out, f, 29.68, 39.02, tier === 2 ? 1 : tier);
    openBelfry(out, f, 39.15, 48.0, tier);
    for (const y of [12.02, 26.72, 29.41, 38.74, 47.62])
      panel(out, f, 'trim', 'light', 0, f.l, y, y + 0.43, 0.2);
    if (f.l > 6.0) {
      arch(out, f, f.l * 0.5, 15.0, 2.82, 9.8, tier, { depth: 0.072, trim: 0.19 });
      for (const u of [0.36, f.l - 0.36]) {
        panel(out, f, 'trim', 'pale', u - 0.18, u + 0.18, 6.9, 28.84, 0.27);
        panel(out, f, 'trim', 'pale', u - 0.26, u + 0.26, 28.39, 29.02, 0.34);
      }
    }
  }
  if (tier >= 1) {
    cap(out, 'stone', 'shadow', r, 29.66);
    cap(out, 'stone', 'wall', r, 48.0);
    for (const p of r) pinnacle(out, mix(p, [x, z], 0.088), 46.1, 55.25, 1.3, tier);
  }
  spire(out, site, tier);
}
function crenels(out, f, y, tier) {
  if (tier < 2) return;
  const count = Math.floor(f.l / (tier === 2 ? 1.25 : 0.91));
  for (let i = 0; i < count; i++) {
    const a = (f.l * (i + 0.12)) / count,
      b = (f.l * (i + 0.68)) / count;
    panel(out, f, 'trim', 'pale', a, b, y, y + 0.58, 0.16);
    if (tier >= 3)
      stroke(out, f, 'trim', 'shadow', [a + 0.055, y + 0.09], [b - 0.055, y + 0.44], 0.054, 0.174);
  }
}
function portal(out, f, u, bottom, w, h, tier) {
  const trim = tier >= 2 ? 0.48 : 0.29,
    woodWidth = w * 0.66;
  arch(out, f, u, bottom, w, h, tier, {
    slot: 'stone',
    tint: 'pink',
    depth: 0.26,
    trim,
    recess: true,
  });
  panel(
    out,
    f,
    'wood',
    'wood',
    u - woodWidth / 2,
    u + woodWidth / 2,
    bottom,
    bottom + h * 0.61,
    0.303,
  );
  if (tier >= 1) {
    for (const side of [-1, 1]) {
      const offset = side * woodWidth * 0.5;
      panel(
        out,
        f,
        'trim',
        'light',
        u + offset - 0.105,
        u + offset + 0.105,
        bottom,
        bottom + h * 0.64,
        0.53,
      );
    }
    panel(
      out,
      f,
      'trim',
      'pale',
      u - woodWidth * 0.58,
      u + woodWidth * 0.58,
      bottom + h * 0.61,
      bottom + h * 0.67,
      0.58,
    );
  }
  if (tier >= 2) {
    const hood = pointed(u, bottom + h * 0.59, w * 0.51, h * 0.44, 12);
    for (let i = 1; i < hood.length; i++)
      stroke(out, f, 'trim', 'pale', hood[i - 1], hood[i], 0.17, 0.83);
    const bars = tier >= 3 ? 9 : 4;
    for (let i = 1; i < bars; i++) {
      const x = u - woodWidth * 0.5 + (woodWidth * i) / bars;
      panel(out, f, 'wood', 'dark', x - 0.019, x + 0.019, bottom + 0.12, bottom + h * 0.6, 0.314);
    }
    for (const side of [-1, 1]) {
      const a = u + side * w * 0.57;
      arch(out, f, a, bottom + 2.18, 1.04, 2.55, tier, {
        depth: 0.51,
        trim: 0.11,
        tint: 'shadow',
        slot: 'stone',
      });
      const p = f.p(a, bottom + 3.17, 0.72);
      loft(
        out,
        'trim',
        [
          [p[1] - 0.71, 0.21],
          [p[1] - 0.07, 0.18],
          [p[1] + 0.36, 0.21],
        ].map(([y, r]) => radialRing(y, r, r, 6, [p[0], p[2]])),
        color.pale,
        { cap: false },
      );
      sphere(out, 'trim', f.p(a, bottom + 3.71, 0.72), [0.104, 0.158, 0.11], color.light, 7, 5);
    }
  }
}
function west(out, tier) {
  const f = frame([-49.675, 1.62], [-49.675, -26.95]),
    u = 13.96;
  panel(out, f, 'stone', 'wall', 0, f.l, 1.93, 12.1);
  if (tier === 0) {
    panel(out, f, 'stone', 'wall', 8.98, 19.4, 12.08, 40.7);
    rose(out, f, u, 24.25, 3.64, 0, 0.12);
    for (const [a, w, h] of [
      [4.65, 3.2, 6.4],
      [u, 4.7, 7.9],
      [23.24, 3.2, 6.4],
    ])
      arch(out, f, a, 2.0, w, h, 0, { depth: 0.17, slot: 'wood', tint: 'wood', trim: 0.19 });
    return;
  }
  panel(out, f, 'stone', 'wall', 8.55, 19.5, 12.08, 40.7);
  for (const [a, w, h] of [
    [4.65, 3.35, 7.48],
    [u, 5.24, 9.01],
    [23.24, 3.35, 7.48],
  ])
    portal(out, f, a, 2.05, w, h, tier);
  for (const y of [12.22, 18.93, 29.84, 39.65])
    panel(out, f, 'trim', 'pale', 8.55, 19.5, y, y + 0.38, 0.42);
  arch(out, f, u, 18.27, 8.52, 12.1, tier, {
    depth: 0.2,
    slot: 'stone',
    tint: 'pink',
    trim: 0.3,
    recess: true,
  });
  rose(out, f, u, 24.25, 3.64, tier, 0.44);
  for (const v of [11.47, 16.45])
    arch(out, f, v, 30.5, 3.28, 8.94, tier, { depth: 0.2, trim: 0.24, tint: 'dark' });
  if (tier >= 2) {
    for (const x of [9.67, 12.03, 13.96, 15.91, 18.28]) {
      panel(out, f, 'trim', 'pale', x - 0.1, x + 0.1, 31.0, 37.81, 0.43);
      if (tier >= 3) {
        const p = f.p(x, 34.88, 0.62);
        sphere(out, 'trim', p, [0.143, 0.19, 0.128], color.pale, 7, 5);
        panel(out, f, 'trim', 'light', x - 0.123, x + 0.123, 33.94, 34.7, 0.7);
      }
    }
  }
  crenels(out, frame([-49.91, -7.02], [-49.91, -18.8]), 40.69, tier);
}
function sarmental(out, tier) {
  const f = frame([5.7, 17.82], [-8.37, 17.82]),
    u = 7.1;
  panel(out, f, 'stone', 'wall', 0, f.l, 1.6, 34.2);
  if (tier >= 1) {
    portal(out, f, u, 2.31, 4.15, 10.3, tier);
    for (const y of [14.45, 28.47, 33.97]) panel(out, f, 'trim', 'pale', 0, f.l, y, y + 0.37, 0.3);
    for (const x of [2.89, 7.1, 11.25])
      arch(out, f, x, 28.92, 2.65, 4.48, tier, { depth: 0.17, trim: 0.16, tint: 'dark' });
    crenels(out, f, 34.25, tier);
  }
  rose(out, f, u, 22.03, 2.75, tier, 0.32);
  if (tier >= 1) for (const x of [-7.6, 5.13]) pinnacle(out, [x, 17.4], 31.24, 42.9, 1.43, tier);
}
function lantern(out, tier) {
  const l = layout.lantern,
    r = l.ring;
  shell(out, 'stone', 'wall', r, 28.3, 52.85, true);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = frame(a, b);
    if (tier >= 1 && f.l > 1.55) {
      for (const y of [34.43, 39.62, 48.7, 51.73])
        panel(out, f, 'trim', 'pale', 0, f.l, y, y + 0.39, 0.21);
      const count = f.l > 4 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const x = (f.l * (j + 0.5)) / count,
          w = Math.min(1.65, f.l * 0.41);
        arch(out, f, x, 40.05, w, 8.13, tier, { depth: 0.065, trim: 0.17, tint: 'dark' });
        if (tier >= 3)
          arch(out, f, x, 35.02, w * 0.74, 3.6, tier, { depth: 0.064, trim: 0.13, tint: 'blue' });
      }
      crenels(out, f, 52.82, tier);
    }
  }
  for (const [i, p] of l.pinnacles.entries()) {
    if (tier === 0) {
      const [x, z] = p.center;
      face(
        out,
        'trim',
        'light',
        [
          [x - 0.57, 49.4, z],
          [x + 0.57, 49.4, z],
          [x, 65, z],
        ],
        [0, 0, 1],
      );
      face(
        out,
        'trim',
        'light',
        [
          [x, 49.4, z - 0.57],
          [x, 49.4, z + 0.57],
          [x, 65, z],
        ],
        [1, 0, 0],
      );
    } else {
      if (tier >= 2) prism(out, 'stone', 'wall', p.center, 1.43, 1.42, 29.4, 53.2, 0.23);
      pinnacle(out, p.center, tier === 1 ? 50.9 : 52.1, 65, 1.6, tier);
      if (tier >= 2) {
        const [x, z] = p.center,
          neighbor = l.pinnacles[(i + 1) % l.pinnacles.length].center;
        if (Math.hypot(x - neighbor[0], z - neighbor[1]) < 5.9)
          beam(
            out,
            'trim',
            [x, 49.71, z],
            [neighbor[0], 49.71, neighbor[1]],
            0.22,
            0.31,
            color.light,
          );
      }
    }
  }
  if (tier >= 2)
    for (const p of l.buttresses) prism(out, 'stone', 'shadow', p, 0.96, 0.89, 31.0, 49.7, 0.16);
}
function condestable(out, tier) {
  if (tier === 0) return;
  const chapel = layout.condestable,
    r = chapel.ring;
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      f = frame(a, b);
    if (f.l < 3) continue;
    panel(out, f, 'trim', 'pale', 0, f.l, 27.49, 28.07, 0.18);
    arch(out, f, f.l * 0.5, 17.02, Math.min(3.05, f.l * 0.56), 9.47, tier, {
      depth: 0.084,
      trim: 0.25,
      tint: 'green',
    });
    if (tier >= 3) {
      crenels(out, f, 28.08, tier);
      const [x, z] = a;
      prism(out, 'stone', 'wall', [x, z], 0.7, 0.69, 7, 27.43, 0.14);
    }
  }
  for (const p of chapel.pinnacles) pinnacle(out, p, 25.72, 42.5, 1.52, tier);
}
function buttresses(out, tier) {
  if (tier < 2) return;
  for (const [i, b] of layout.buttresses.entries()) {
    if (tier === 2 && (i % 3 !== 0 || b.top < 27)) continue;
    const h = b.top,
      w = b.w,
      d = b.d;
    const body = h - (h > 24 ? 3.9 : 1.67);
    prism(out, 'stone', 'wall', b.site, w, d, b.foot, body, 0.11);
    if (tier >= 3)
      prism(out, 'trim', 'light', b.site, w * 1.08, d * 1.08, body - 0.36, body + 0.17, 0.12);
    if (h >= 24) pinnacle(out, b.site, body + 0.01, h, Math.min(w, d) * 0.79, tier === 2 ? 1 : 2);
  }
}
function court(out, tier) {
  if (tier === 0) return;
  for (const [i, a] of layout.courtWall.entries()) {
    const b = layout.courtWall[(i + 1) % layout.courtWall.length],
      f = frame(a, b);
    panel(out, f, 'stone', 'court', 0, f.l, -3.92, 10.5, 0.1);
    if (f.l < 2.7 || tier === 1 || (tier === 2 && i % 2 === 1)) continue;
    const count = Math.max(1, Math.round(f.l / 3.21));
    for (let j = 0; j < count; j++) {
      const x = (f.l * (j + 0.5)) / count;
      arch(out, f, x, 1.55, Math.min(1.82, f.l * 0.63), 5.73, tier, {
        depth: 0.22,
        trim: 0.22,
        recess: tier >= 2,
        tint: 'dark',
      });
      if (tier >= 2 && j > 0)
        panel(
          out,
          f,
          'trim',
          'pale',
          (f.l * j) / count - 0.12,
          (f.l * j) / count + 0.12,
          1.5,
          9.05,
          0.49,
        );
    }
    panel(out, f, 'trim', 'pale', 0, f.l, 9.75, 10.15, 0.27);
  }
}
function approaches(out, tier) {
  const t = layout.terrace;
  shell(out, 'foundation', 'base', tier === 0 ? t.far : t.ring, t.foot, t.top);
  for (const p of tier === 0 ? t.farRoof : t.roof) face(out, 'foundation', 'light', p, up);
  for (const s of layout.stairs) {
    const p = (a, u, y) => (s.dir === 'x' ? [a, y, s.center + u] : [s.center + u, y, a]);
    const [a, b, w] = [s.a, s.b, s.half],
      normal = s.dir === 'x' ? [-1, 0, 0] : [0, 0, 1];
    face(
      out,
      'foundation',
      'light',
      [p(a, -w, s.y), p(a, w, s.y), p(b, w, s.y), p(b, -w, s.y)],
      up,
    );
    face(
      out,
      'foundation',
      'base',
      [p(a, -w, s.foot), p(a, w, s.foot), p(a, w, s.y), p(a, -w, s.y)],
      normal,
    );
    if (tier >= 2)
      for (const sign of [-1, 1]) {
        const u = sign * w;
        face(
          out,
          'foundation',
          'shadow',
          [p(a, u, s.foot), p(b, u, s.foot), p(b, u, s.y), p(a, u, s.y)],
          s.dir === 'x' ? [0, 0, sign] : [sign, 0, 0],
        );
      }
  }
}
export function buildCathedralLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw new Error(`Unknown Burgos Cathedral detail level ${level}`);
  floors(out, tier);
  approaches(out, tier);
  for (const t of layout.towers) tower(out, t, tier);
  west(out, tier);
  sarmental(out, tier);
  lantern(out, tier);
  condestable(out, tier);
  buttresses(out, tier);
  court(out, tier);
}
export const buildCathedralSkyline = (out) => buildCathedralLevel(out, 'skyline');
export const buildCathedralDistrict = (out) => buildCathedralLevel(out, 'district');
export const buildCathedralStreet = (out) => buildCathedralLevel(out, 'street');
export const buildCathedralCloseup = (out) => buildCathedralLevel(out, 'closeup');
