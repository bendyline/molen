/** Original complete Al-Kadhimiya exterior. Meters,+Y up;+X south,+Z west. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const kadhimiyaControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = kadhimiyaControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('d7c49f'),
    trim: lin('e7e1ce'),
    ground: lin('d4d1c8'),
    roof: lin('e2e0d6'),
    gold: lin('d9b85b'),
    tile: lin('3f7d98'),
    turquoise: lin('378891'),
    darkTile: lin('41647f'),
    metal: lin('44494c'),
    glass: lin('4d6178'),
    dial: lin('ddd8c5'),
  };
export const kadhimiyaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
  wall: { slot: 'wall', graph: 'brick_flemish', roughness: 0.88, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_marble', roughness: 0.65, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.38, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88, metallic: 0 },
  gold: { slot: 'trim', graph: 'metal_stainless_polished', roughness: 0.27, metallic: 0.9 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.3, metallic: 0.1 },
};
const configs = {
  skyline: { far: true, sides: 4, arch: 2, bay: 30 },
  district: { sides: 6, arch: 2, bay: 18, flat: true, bands: true },
  street: {
    sides: 10,
    arch: 3,
    bay: 12,
    arcades: true,
    flatOuter: true,
    bands: true,
    frames: true,
    balconies: true,
  },
  closeup: {
    sides: 20,
    arch: 5,
    bay: 7.5,
    arcades: true,
    bands: true,
    frames: true,
    balconies: true,
    ornament: true,
  },
  master: {
    sides: 40,
    arch: 12,
    bay: 5.2,
    arcades: true,
    bands: true,
    frames: true,
    balconies: true,
    ornament: true,
    fine: true,
  },
};
export function kadhimiyaGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  open = (r) => (r[0].every((v, i) => v === r.at(-1)[i]) ? r.slice(0, -1) : r),
  cw = (r) => (area(open(r)) < 0 ? open(r) : open(r).toReversed());
function tri(o, c, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    color,
  );
}
function quad(o, c, s, p, color, n) {
  tri(o, c, s, p.slice(0, 3), color, n);
  tri(o, c, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = 1) {
  let count = rings[0].length;
  const holes = [];
  for (const r of rings.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const ps = rings.flat(),
    ids = earcut(ps.flat(), holes);
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      s,
      ids
        .slice(i, i + 3)
        .map((i) => [ps[i][0], typeof y === 'function' ? y(...ps[i]) : y, ps[i][1]]),
      color,
      [0, up, 0],
    );
}
const face = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
      t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    return { p, q, L, t, n: [-t[1], t[0]] };
  },
  P = (f, u, y, d = 0) => [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d],
  Y = (y, p) => (typeof y === 'function' ? y(...p) : y);
function panel(o, c, f, u0, u1, y0, y1, d = 0, s = 'wall', color = C.wall) {
  if (u1 - u0 < 1e-5 || y1 - y0 < 1e-5) return;
  quad(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
const B = (o, c, p, q, w, color = C.trim, s = 'trim', depth = w) =>
  beam(o, S(c, s), p, q, w, depth, color);
function box(o, c, s, p, size, color) {
  boundsBox(
    o,
    S(c, s),
    p.map((v, i) => v - size[i] / 2),
    p.map((v, i) => v + size[i] / 2),
    color,
  );
}
function shell(o, c, ring, y0, y1, s = 'wall', color = C.wall, top = true, inside = false) {
  const r = inside ? cw(ring).toReversed() : cw(ring);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      f = face(p, q);
    quad(
      o,
      c,
      s,
      [
        [p[0], Y(y0, p), p[1]],
        [q[0], Y(y0, q), q[1]],
        [q[0], Y(y1, q), q[1]],
        [p[0], Y(y1, p), p[1]],
      ],
      color,
      [f.n[0], 0, f.n[1]],
    );
  }
  if (top) cap(o, c, [r], y1, s, color);
}
function offset(r, d) {
  r = cw(r);
  return r.map((p, i) => {
    const prev = face(r[(i + r.length - 1) % r.length], p),
      next = face(p, r[(i + 1) % r.length]),
      n = [prev.n[0] + next.n[0], prev.n[1] + next.n[1]],
      dot = n[0] * next.n[0] + n[1] * next.n[1],
      k = Math.abs(dot) > 0.15 ? d / dot : d;
    return [p[0] + n[0] * k, p[1] + n[1] * k];
  });
}
function scaled(r, k) {
  r = cw(r);
  const m = r.reduce((s, p) => s.map((v, i) => v + p[i] / r.length), [0, 0]);
  return r.map((p) => p.map((v, i) => m[i] + (v - m[i]) * k));
}
function ringLoft(o, c, r, y0, y1, k0 = 1, k1 = 1, s = 'wall', color = C.wall) {
  loft(
    o,
    S(c, s),
    [scaled(r, k0).map(([x, z]) => [x, y0, z]), scaled(r, k1).map(([x, z]) => [x, y1, z])],
    color,
  );
}
function cylinder(o, c, center, y0, y1, r0, r1, s = 'trim', color = C.trim) {
  loft(
    o,
    S(c, s),
    [
      radialRing(y0, r0, r0, c.far ? 3 : c.sides, center),
      radialRing(y1, r1, r1, c.far ? 3 : c.sides, center),
    ],
    color,
  );
}

const part = (i) => parts[i].polygons[0],
  foot = (x, z) => Math.min(a.floor - 0.35, kadhimiyaGroundY(x, z) - 0.5);
function simplify(r, e) {
  r = open(r).map((p) => p.slice());
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const p = r[(i + r.length - 1) % r.length],
        v = r[i],
        q = r[(i + 1) % r.length],
        L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 1e-6) continue;
      const t = ((v[0] - p[0]) * (q[0] - p[0]) + (v[1] - p[1]) * (q[1] - p[1])) / (L * L),
        d = Math.abs((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0])) / L;
      if (t > 0 && t < 1 && d < e) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
const archY = (h, u) =>
  h.spring +
  h.rise * Math.sqrt(Math.max(0, 1 - Math.abs((u - (h.l + h.r) / 2) / ((h.r - h.l) / 2))));
function strip(o, c, f, p, q, w, s = 'tile', color = C.tile, d = 0.06) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (L < 1e-6) return;
  const u = (-(q[1] - p[1]) * w) / (2 * L),
    v = ((q[0] - p[0]) * w) / (2 * L);
  quad(
    o,
    c,
    s,
    [
      P(f, p[0] + u, p[1] + v, d),
      P(f, q[0] + u, q[1] + v, d),
      P(f, q[0] - u, q[1] - v, d),
      P(f, p[0] - u, p[1] - v, d),
    ],
    color,
    [f.n[0], 0, f.n[1]],
  );
}
function archOpening(o, c, f, h) {
  const N = c.arch * 2,
    depth = h.through ? 0 : (h.depth ?? 1.5),
    bottom = h.floor ?? 0.3;
  panel(o, c, f, h.l, h.r, h.baseY ?? foot(...f.p), bottom, 0, 'wall', C.wall);
  for (let j = 0; j < N; j++) {
    const l = h.l + ((h.r - h.l) * j) / N,
      r = h.l + ((h.r - h.l) * (j + 1)) / N,
      y0 = archY(h, l),
      y1 = archY(h, r);
    quad(o, c, 'wall', [P(f, l, y0), P(f, r, y1), P(f, r, h.top), P(f, l, h.top)], C.wall, [
      f.n[0],
      0,
      f.n[1],
    ]);
    if (!h.through) {
      quad(
        o,
        c,
        'stone',
        [P(f, l, y0), P(f, l, y0, -depth), P(f, r, y1, -depth), P(f, r, y1)],
        C.trim,
        [0, -1, 0],
      );
      if (!h.openBack)
        quad(
          o,
          c,
          h.blue ? 'tile' : 'stone',
          [
            P(f, l, bottom, -depth),
            P(f, r, bottom, -depth),
            P(f, r, y1, -depth),
            P(f, l, y0, -depth),
          ],
          h.blue ? C.darkTile : C.trim,
          [f.n[0], 0, f.n[1]],
        );
    }
    if (c.frames || h.gate)
      strip(
        o,
        c,
        f,
        [l, y0],
        [r, y1],
        h.gate ? 0.42 : 0.15,
        h.gate || h.borderTile ? 'tile' : 'stone',
        h.gate || h.borderTile ? C.tile : C.trim,
        0.08,
      );
  }
  if (!h.through)
    for (const u of [h.l, h.r])
      quad(
        o,
        c,
        'stone',
        [P(f, u, bottom), P(f, u, h.spring), P(f, u, h.spring, -depth), P(f, u, bottom, -depth)],
        C.trim,
      );
  if (c.frames || h.gate)
    for (const u of [h.l, h.r])
      strip(
        o,
        c,
        f,
        [u, bottom],
        [u, h.spring],
        h.gate ? 0.45 : 0.16,
        h.gate || h.borderTile ? 'tile' : 'stone',
        h.gate || h.borderTile ? C.tile : C.trim,
        0.08,
      );
}
function gateInterval(f, k) {
  const dx = f.p[0] - k.center[0],
    dz = f.p[1] - k.center[1],
    n = [-k.axis[1], k.axis[0]],
    u = dx * k.axis[0] + dz * k.axis[1],
    v = dx * n[0] + dz * n[1],
    du = f.t[0] * k.axis[0] + f.t[1] * k.axis[1],
    dv = f.t[0] * n[0] + f.t[1] * n[1];
  let lo = 0,
    hi = f.L;
  for (const [p, t, r] of [
    [u, du, k.halfLength],
    [v, dv, k.radius],
  ]) {
    if (Math.abs(t) < 1e-8) {
      if (Math.abs(p) > r) return null;
    } else {
      const l = (-r - p) / t,
        h = (r - p) / t;
      lo = Math.max(lo, Math.min(l, h));
      hi = Math.min(hi, Math.max(l, h));
    }
  }
  if (hi - lo < 1e-5) return null;
  return {
    l: lo,
    r: hi,
    floor: k.floor,
    spring: k.spring,
    rise: k.rise,
    through: true,
    gate: true,
  };
}
function facade(o, c, f, y1, { inner = false, target, detail = true } = {}) {
  const gates = a.gates
      .filter((k) => k.target === target)
      .map((k) => gateInterval(f, k))
      .filter(Boolean),
    openings = gates.map((h) => ({ ...h, top: y1 }));
  if (c.arcades && detail && f.L > 4 && (!c.flatOuter || inner)) {
    const N = Math.max(1, Math.floor(f.L / c.bay)),
      bay = f.L / N;
    for (let j = 0; j < N; j++) {
      const u = (j + 0.5) * bay,
        w = Math.min(inner ? 3.2 : 2.5, bay * 0.56),
        l = u - w / 2,
        r = u + w / 2;
      if (gates.some((h) => r > h.l - 0.6 && l < h.r + 0.6)) continue;
      openings.push({
        l,
        r,
        floor: 0.35,
        spring: inner ? 4.9 : y1 > 12 ? 8 : 4.8,
        rise: inner ? 2.2 : y1 > 12 ? 3.2 : 2.5,
        top: y1,
        depth: inner ? 1.65 : 0.16,
        blue: !inner && y1 > 12,
        borderTile: !inner,
      });
    }
  }
  if ((c.flat || c.flatOuter) && !inner && detail && f.L > 4) {
    const N = Math.max(1, Math.floor(f.L / c.bay));
    for (let j = 0; j < N; j++) {
      const u = ((j + 0.5) * f.L) / N,
        w = Math.min(2.5, (f.L / N) * 0.5);
      if (gates.some((h) => u + w / 2 > h.l - 0.6 && u - w / 2 < h.r + 0.6)) continue;
      const ps = [
        P(f, u - w / 2, 0.5, 0.035),
        P(f, u + w / 2, 0.5, 0.035),
        P(f, u + w / 2, y1 > 12 ? 8 : 4.8, 0.035),
        P(f, u, y1 > 12 ? 11.2 : 7.3, 0.035),
        P(f, u - w / 2, y1 > 12 ? 8 : 4.8, 0.035),
      ];
      tri(o, c, 'tile', [ps[0], ps[1], ps[2]], y1 > 12 ? C.darkTile : C.trim, [f.n[0], 0, f.n[1]]);
      tri(o, c, 'tile', [ps[0], ps[2], ps[3]], y1 > 12 ? C.darkTile : C.trim, [f.n[0], 0, f.n[1]]);
      tri(o, c, 'tile', [ps[0], ps[3], ps[4]], y1 > 12 ? C.darkTile : C.trim, [f.n[0], 0, f.n[1]]);
    }
  }
  const ordered = openings.sort((a, b) => a.l - b.l);
  let last = 0;
  for (const h of ordered) {
    if (h.l < last - 1e-5) continue;
    panel(o, c, f, last, h.l, foot(...f.p), y1);
    archOpening(o, c, f, h);
    last = h.r;
  }
  panel(o, c, f, last, f.L, foot(...f.p), y1);
  if (c.bands) {
    for (const [y, h, col] of [
      [y1 - 1.1, 0.45, C.darkTile],
      [y1 - 0.3, 0.18, C.trim],
    ]) {
      panel(o, c, f, 0, f.L, y, y + h, 0.06, 'tile', col);
    }
    if (c.frames)
      for (let u = 0; u < f.L; u += c.bay) {
        strip(o, c, f, [u, 0.3], [u, y1 - 0.9], 0.32, 'stone', C.trim, 0.08);
      }
  }
}
function building(o, c, index, height, { target = 'sanctuary', details = true } = {}) {
  const rings = part(index).map((r, i) =>
    i ? cw(simplify(r, c.far ? 0.8 : 0.06)).toReversed() : cw(simplify(r, c.far ? 0.8 : 0.06)),
  );
  for (const [ri, r] of rings.entries())
    for (let i = 0; i < r.length; i++)
      facade(o, c, face(r[i], r[(i + 1) % r.length]), height, {
        inner: ri > 0,
        target,
        detail: details,
      });
  cap(o, c, rings, height, 'roof', C.roof);
  if (c.frames)
    for (const r of rings) {
      for (let i = 0; i < r.length; i++) {
        const f = face(r[i], r[(i + 1) % r.length]);
        B(o, c, P(f, 0, height + 0.08), P(f, f.L, height + 0.08), 0.18, C.trim, 'stone');
      }
    }
}
function revolve(o, c, center, profile, s, color) {
  loft(
    o,
    S(c, s),
    profile.map(([y, r]) => radialRing(y, r, r, c.sides, center)),
    color,
  );
}
function bulb(o, c, center, bottom, radius, top, s = 'gold', color = C.gold) {
  const H = top - bottom,
    profile = c.far
      ? [
          [bottom, radius],
          [bottom + H * 0.2, radius * 1.04],
          [bottom + H * 0.72, radius * 0.65],
          [top, 0.05],
        ]
      : [
          [bottom, radius],
          [bottom + H * 0.14, radius * 1.04],
          [bottom + H * 0.32, radius * 0.99],
          [bottom + H * 0.56, radius * 0.79],
          [bottom + H * 0.77, radius * 0.48],
          [bottom + H * 0.92, radius * 0.2],
          [top, 0.05],
        ];
  revolve(o, c, center, profile, s, color);
}
function finial(o, c, p, y0, y1, s = 'gold', color = C.gold) {
  cylinder(o, c.frames ? c : { ...c, sides: 3 }, p, y0, y1, 0.055, 0.025, s, color);
  if (c.ornament)
    for (let j = 0; j < 3; j++) {
      const y = y0 + ((y1 - y0) * (j + 0.35)) / 3;
      revolve(
        o,
        c,
        p,
        [
          [y - 0.08, 0.06],
          [y, 0.13 - j * 0.025],
          [y + 0.08, 0.06],
        ],
        s,
        color,
      );
    }
}
function domes(o, c) {
  if (c.far) {
    for (const d of a.goldDomes) {
      cylinder(o, c, d.center, 20, 24, d.radius, d.radius, 'gold', C.gold);
      bulb(o, c, d.center, 24, d.radius, 33, 'gold');
    }
    const d = a.blueDome;
    cylinder(o, c, d.center, 15, 17, d.radius, d.radius, 'tile', C.tile);
    bulb(o, c, d.center, 17, d.radius, 25, 'tile', C.turquoise);
    for (const l of a.smallRoofLanterns)
      cylinder(o, c, l.center, 20, 24.5, 0.32, 0.04, 'gold', C.gold);
    return;
  }
  for (const d of a.goldDomes) {
    revolve(
      o,
      c,
      d.center,
      [
        [20, d.radius],
        [20.3, d.radius * 1.035],
        [23.8, d.radius],
        [24, d.radius * 1.04],
      ],
      'gold',
      C.gold,
    );
    if (c.bands)
      revolve(
        o,
        c,
        d.center,
        [
          [20.4, d.radius * 1.04],
          [21.2, d.radius * 1.04],
        ],
        'tile',
        C.darkTile,
      );
    bulb(o, c, d.center, 24, d.radius, 32, 'gold');
    finial(o, c, d.center, 32, 33);
  }
  const d = a.blueDome;
  revolve(
    o,
    c,
    d.center,
    [
      [15, d.radius],
      [17, d.radius],
    ],
    'tile',
    C.tile,
  );
  bulb(o, c, d.center, 17, d.radius, 24.3, 'tile', C.turquoise);
  finial(o, c, d.center, 24.3, 25);
  for (const l of a.smallRoofLanterns) {
    cylinder(o, c, l.center, 20, 23.3, 0.25, 0.2, 'gold', C.gold);
    bulb(o, c, l.center, 23.3, 0.4, 24.2, 'gold');
    finial(o, c, l.center, 24.2, 24.5);
  }
}
function balcony(o, c, center, y, r, height = 2) {
  const N = c.fine ? 16 : c.ornament ? 12 : 8;
  for (let j = 0; j < N; j++) {
    const t = (j * Math.PI * 2) / N,
      p = [center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)];
    cylinder(o, c, p, y, y + height, 0.09, 0.09, 'stone', C.trim);
    if (c.ornament) {
      const t1 = ((j + 1) * Math.PI * 2) / N,
        q = [center[0] + r * Math.cos(t1), center[1] + r * Math.sin(t1)],
        f = face(p, q),
        w = f.L * 0.7,
        h = {
          l: (f.L - w) / 2,
          r: (f.L + w) / 2,
          floor: y,
          baseY: y,
          spring: y + height * 0.65,
          rise: height * 0.35,
          top: y + height,
          through: true,
        };
      archOpening(o, c, f, h);
    }
  }
  revolve(
    o,
    c,
    center,
    [
      [y - 0.14, r + 0.2],
      [y + 0.1, r + 0.2],
    ],
    'gold',
    C.gold,
  );
  revolve(
    o,
    c,
    center,
    [
      [y + height - 0.1, r + 0.1],
      [y + height + 0.13, r + 0.1],
    ],
    'gold',
    C.gold,
  );
}
function minarets(o, c) {
  if (c.far) {
    for (const m of a.mainMinarets) {
      revolve(
        o,
        c,
        m.center,
        [
          [0, 2.05],
          [22, 1.5],
          [24, 2.6],
        ],
        'wall',
        C.wall,
      );
      revolve(
        o,
        c,
        m.center,
        [
          [24, 2.6],
          [26, 1.1],
          [32, 1.1],
          [35, 0.05],
        ],
        'gold',
        C.gold,
      );
    }
    return;
  }
  for (const m of a.mainMinarets) {
    const p = m.center;
    revolve(
      o,
      c,
      p,
      c.far
        ? [
            [0, 2.05],
            [2, 1.7],
            [21.6, 1.5],
            [23.5, 2.6],
            [24, 2.6],
            [26, 1.25],
            [32, 1.1],
          ]
        : [
            [0, 2.05],
            [1.2, 2.05],
            [1.5, 1.75],
            [20.8, 1.5],
            [21.3, 1.7],
            [22, 1.85],
            [22.6, 2.1],
            [23.2, 2.4],
            [23.5, 2.6],
            [24, 2.6],
          ],
      'wall',
      C.wall,
    );
    if (c.balconies) balcony(o, c, p, 24, 2.25, 2);
    else cylinder(o, c, p, 24, 26, 1.4, 1.4, 'gold', C.gold);
    if (!c.far) cylinder(o, c, p, 26, 32, 1.15, 1.1, 'gold', C.gold);
    bulb(o, c, p, 32, 1.35, 34.5, 'gold');
    finial(o, c, p, 34.5, 35);
    if (c.bands)
      for (const [y0, y1, r] of [
        [3.1, 4.2, 1.75],
        [20.6, 21.3, 1.72],
        [24.05, 24.45, 2.64],
      ])
        cylinder(o, c, p, y0, y1, r, r, 'tile', C.darkTile);
    if (c.ornament) {
      for (let j = 0; j < 12; j++) {
        const t = (j * Math.PI * 2) / 12,
          n = [Math.cos(t), Math.sin(t)],
          p0 = [p[0] + 2.35 * n[0], 23.3, p[1] + 2.35 * n[1]],
          p1 = [p[0] + 1.65 * n[0], 21.5, p[1] + 1.65 * n[1]];
        B(o, c, p0, p1, 0.17, C.trim, 'stone');
      }
    }
  }
}
function gateFrame(o, c, k) {
  const n = [-k.axis[1], k.axis[0]],
    p = k.frameCenter,
    f = face(
      [p[0] - n[0] * (k.radius + 1), p[1] - n[1] * (k.radius + 1)],
      [p[0] + n[0] * (k.radius + 1), p[1] + n[1] * (k.radius + 1)],
    ),
    r = k.radius,
    N = c.arch * 2,
    mid = f.L / 2,
    head = (v) => k.spring + k.rise * Math.sqrt(Math.max(0, 1 - Math.abs((v - mid) / r)));
  const exteriorNormal = k.target === 'sanctuary' ? [0, 0, -1] : k.axis[0] ? [1, 0, 0] : [0, 0, -1];
  if (f.n[0] * exteriorNormal[0] + f.n[1] * exteriorNormal[2] < 0) {
    f.n = f.n.map((v) => -v);
  }
  for (let j = 0; j < N; j++) {
    const l = mid - r + (2 * r * j) / N,
      q = mid - r + (2 * r * (j + 1)) / N;
    strip(o, c, f, [l, head(l)], [q, head(q)], 0.65, 'tile', C.tile, 0.1);
  }
  for (const l of [mid - r, mid + r])
    strip(o, c, f, [l, k.floor], [l, k.spring], 0.75, 'tile', C.tile, 0.1);
  const top = k.target === 'sanctuary' ? 14.6 : 9.8;
  for (const l of [0.15, f.L - 0.15])
    strip(o, c, f, [l, k.floor], [l, top], 0.3, 'stone', C.trim, 0.15);
  strip(o, c, f, [0.15, top], [f.L - 0.15, top], 0.3, 'stone', C.trim, 0.15);
  if (k.closedBack) {
    const y0 = k.floor,
      w = k.radius * 1.7;
    panel(o, c, f, mid - w / 2, mid + w / 2, y0, k.spring + 1, -5, 'gold', C.gold);
  }
}
function gatewayDecks(o, c) {
  if (c.far) return;
  for (const k of a.gates.filter((k) => k.target === 'perimeter')) {
    const sign = k.axis[0] ? 1 : -1,
      near = k.center.map((v, i) => v + k.axis[i] * sign * 7),
      far = k.center.map((v, i) => v + k.axis[i] * sign * 17),
      h = kadhimiyaGroundY(...far),
      N = c.frames ? Math.max(1, Math.ceil(Math.abs(h) / (c.ornament ? 0.3 : 0.4))) : 1,
      f = face(near, far);
    for (let j = 0; j < N; j++) {
      const u = (j * f.L) / N,
        v = ((j + 1) * f.L) / N,
        top = (h * (j + 1)) / N,
        r = [
          P(f, u, 0, -k.radius),
          P(f, v, 0, -k.radius),
          P(f, v, 0, k.radius),
          P(f, u, 0, k.radius),
        ].map(([x, , z]) => [x, z]);
      shell(o, c, r, (x, z) => Math.min(foot(x, z), top - 0.25), top, 'stone', C.ground);
    }
  }
}
function clock(o, c) {
  const k = a.clock,
    p = k.center;
  if (c.far) {
    box(o, c, 'tile', [p[0], 16, p[1]], [4.4, 12, 4.4], C.tile);
    revolve(
      o,
      c,
      p,
      [
        [22, 1.8],
        [23, 1.8],
        [25.2, 0.05],
      ],
      'tile',
      C.turquoise,
    );
    return;
  }
  const r = [
    [p[0] - 2.2, p[1] - 2.2],
    [p[0] - 2.2, p[1] + 2.2],
    [p[0] + 2.2, p[1] + 2.2],
    [p[0] + 2.2, p[1] - 2.2],
  ];
  shell(o, c, r, k.base, k.dialBottom, 'tile', C.darkTile);
  shell(o, c, r, k.dialBottom, k.dialTop, 'tile', C.tile);
  if (!c.far)
    for (let i = 0; i < 4; i++) {
      const f = face(r[i], r[(i + 1) % 4]),
        u = f.L / 2,
        cy = (k.dialBottom + k.dialTop) / 2,
        radius = 1.35,
        N = c.sides,
        ps = Array.from({ length: N }, (_, j) => {
          const t = (j * Math.PI * 2) / N;
          return P(f, u + radius * Math.cos(t), cy + radius * Math.sin(t), 0.04);
        });
      for (let j = 1; j < N - 1; j++)
        tri(o, c, 'stone', [ps[0], ps[j], ps[j + 1]], C.dial, [f.n[0], 0, f.n[1]]);
      if (c.frames) {
        for (let j = 0; j < 12; j++) {
          const t = (j * Math.PI) / 6;
          strip(
            o,
            c,
            f,
            [u + radius * 0.8 * Math.sin(t), cy + radius * 0.8 * Math.cos(t)],
            [u + radius * 0.96 * Math.sin(t), cy + radius * 0.96 * Math.cos(t)],
            0.055,
            'metal',
            C.metal,
            0.07,
          );
        }
        strip(o, c, f, [u, cy], [u + 0.6, cy + 0.5], 0.09, 'metal', C.metal, 0.08);
        strip(o, c, f, [u, cy], [u - 0.8, cy + 0.3], 0.07, 'metal', C.metal, 0.08);
      }
    }
  if (c.balconies) balcony(o, c, p, k.dialTop + 0.1, 1.65, k.belfryTop - k.dialTop - 0.1);
  else cylinder(o, c, p, k.dialTop, k.belfryTop, 1.65, 1.65, 'stone', C.trim);
  bulb(o, c, p, k.belfryTop, 1.8, k.cupolaTop, 'tile', C.turquoise);
  finial(o, c, p, k.cupolaTop, k.top);
}
function paving(o, c) {
  if (c.far) {
    const top = g.elevationsMeters.reduce((v, h) => Math.max(v, h - a.originElevation), 0) + 0.23;
    cap(o, c, [open(part(36)[1])], top, 'stone', C.ground);
    return;
  }
  const r = open(part(36)[1]),
    ids = earcut(r.flat()),
    depth = c.fine || c.ornament ? 4 : c.frames ? 3 : 1,
    ground = (p) => [p[0], Math.max(0, kadhimiyaGroundY(...p) + 0.05), p[1]],
    mid = (p, q) => p.map((v, i) => (v + q[i]) / 2);
  const triangles = [],
    heights = new Map(),
    key = (p) => p[0].toFixed(6) + '/' + p[2].toFixed(6);
  function sub(p, q, r, n) {
    if (!n) {
      const ps = [p, q, r].map(ground);
      let required = 0;
      for (let i = 0; i <= 6; i++)
        for (let j = 0; j <= 6 - i; j++) {
          const w = [i / 6, j / 6, 1 - (i + j) / 6],
            x = ps.reduce((v, p, i) => v + p[0] * w[i], 0),
            z = ps.reduce((v, p, i) => v + p[2] * w[i], 0);
          required = Math.max(required, kadhimiyaGroundY(x, z) + 0.15);
        }
      for (const p of ps)
        heights.set(key(p), Math.max(heights.get(key(p)) ?? -Infinity, required + 0.08));
      triangles.push(ps);
      return;
    }
    const pq = mid(p, q),
      qr = mid(q, r),
      rp = mid(r, p);
    sub(p, pq, rp, n - 1);
    sub(pq, q, qr, n - 1);
    sub(rp, qr, r, n - 1);
    sub(pq, qr, rp, n - 1);
  }
  for (let i = 0; i < ids.length; i += 3) sub(...ids.slice(i, i + 3).map((i) => r[i]), depth);
  for (const ps of triangles)
    tri(
      o,
      c,
      'stone',
      ps.map((p) => [p[0], heights.get(key(p)), p[2]]),
      C.ground,
      [0, 1, 0],
    );
}
function portico(o, c) {
  const r = cw(simplify(part(2)[0], c.far ? 0.8 : 0.06));
  shell(o, c, r, 14.65, 15, 'roof', C.roof);
  cap(o, c, [r], 14.65, 'stone', C.trim, -1);
  const edges = [
    [
      [1.5, -19.85],
      [48.85, -19.6],
    ],
    [
      [56.05, -14.35],
      [56.1, 27.8],
    ],
    [
      [49.6, 34.25],
      [11.45, 34.3],
    ],
  ];
  for (const [p, q] of edges) {
    const f = face(p, q),
      N = Math.max(2, Math.round(f.L / (c.far ? 20 : c.frames ? 5.8 : 12)));
    for (let j = 0; j <= N; j++) {
      const u = (f.L * j) / N,
        pos = P(f, u, 0),
        x = pos[0],
        z = pos[2];
      if (z < -15 && Math.abs(x - 24.9) < 4.9) continue;
      const sides = c.far ? 4 : c.fine ? 16 : c.frames ? 8 : 6,
        rs = (y, r) => radialRing(y, r, r, sides, [x, z]);
      loft(
        o,
        S(c, 'stone'),
        c.frames
          ? [rs(foot(x, z), 0.6), rs(0.5, 0.6), rs(0.8, 0.4), rs(14.1, 0.38), rs(14.65, 0.65)]
          : [rs(foot(x, z), 0.5), rs(14.65, 0.5)],
        C.trim,
        { cap: !c.far },
      );
    }
  }
  const iw = cw([
    [20, -20.5],
    [29.8, -20.5],
    [29.8, -11.5],
    [20, -11.5],
  ]);
  for (let i = 0; i < iw.length; i++)
    facade(o, c, face(iw[i], iw[(i + 1) % iw.length]), 15, { target: 'sanctuary', detail: false });
  cap(o, c, [iw], 15, 'roof', C.roof);
}
function gateSoffit(o, c, k) {
  if (c.far) return;
  const p = k.barrelCenter,
    t = k.axis,
    n = [-t[1], t[0]],
    H = k.barrelHalfLength,
    P0 = (u, v, y) => [p[0] + t[0] * u + n[0] * v, y, p[1] + t[1] * u + n[1] * v],
    N = c.arch * 2,
    head = (v) => k.spring + k.rise * Math.sqrt(Math.max(0, 1 - Math.abs(v / k.radius)));
  for (let j = 0; j < N; j++) {
    const v = -k.radius + (2 * k.radius * j) / N,
      w = -k.radius + (2 * k.radius * (j + 1)) / N;
    quad(
      o,
      c,
      k.target === 'sanctuary' ? 'gold' : 'stone',
      [P0(-H, v, head(v)), P0(H, v, head(v)), P0(H, w, head(w)), P0(-H, w, head(w))],
      k.target === 'sanctuary' ? C.gold : C.trim,
      [0, -1, 0],
    );
  }
  for (const v of [-k.radius, k.radius])
    quad(
      o,
      c,
      'stone',
      [P0(-H, v, k.floor), P0(H, v, k.floor), P0(H, v, k.spring), P0(-H, v, k.spring)],
      C.trim,
    );
  const r = [
    P0(-H, -k.radius, 0),
    P0(H, -k.radius, 0),
    P0(H, k.radius, 0),
    P0(-H, k.radius, 0),
  ].map(([x, , z]) => [x, z]);
  shell(o, c, r, foot, k.floor, 'stone', C.ground);
}
export function buildKadhimiyaLevel(o, level) {
  const c = configs[level];
  if (!c) throw Error('Unknown Al-Kadhimiya level ' + level);
  paving(o, c);
  building(o, c, 36, 10, { target: 'perimeter' });
  for (const i of [0, 1, 20, 21]) building(o, c, i, 15);
  portico(o, c);
  building(o, c, 35, 10, { target: 'north-range' });
  building(o, c, 22, 10, { target: 'north-range', details: false });
  building(o, c, 3, 20, { target: 'upper', details: false });
  domes(o, c);
  minarets(o, c);
  clock(o, c);
  if (!c.far)
    for (const k of a.gates) {
      gateFrame(o, c, k);
      gateSoffit(o, c, k);
    }
  gatewayDecks(o, c);
}
export const buildKadhimiyaSkyline = (o) => buildKadhimiyaLevel(o, 'skyline');
export const buildKadhimiyaDistrict = (o) => buildKadhimiyaLevel(o, 'district');
export const buildKadhimiyaStreet = (o) => buildKadhimiyaLevel(o, 'street');
export const buildKadhimiyaCloseup = (o) => buildKadhimiyaLevel(o, 'closeup');
