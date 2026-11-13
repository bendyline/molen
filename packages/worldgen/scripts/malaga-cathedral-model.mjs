/** Catedral de la Encarnación, including its November 2026 roof and west pediment. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ey/eys/cathedral_basilica_of_the_virgin_of_incarnation/layout.json',
      import.meta.url,
    ),
  ),
);
export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.94 },
  steps: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  vault: { slot: 'roof', graph: 'tile_flat', roughness: 0.96 },
  underlay: { slot: 'roof', graph: 'metal_painted', roughness: 0.93 },
  timber: { slot: 'roof', graph: 'wood_plain', roughness: 0.91 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.55, roughness: 0.68 },
  recess: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.94 },
};
const colors = {
  masonry: [0.62, 0.47, 0.328],
  trim: [0.71, 0.581, 0.436],
  steps: [0.53, 0.491, 0.421],
  vault: [0.53, 0.226, 0.132],
  underlay: [0.069, 0.074, 0.071],
  timber: [0.69, 0.392, 0.172],
  metal: [0.21, 0.153, 0.108],
  recess: [0.041, 0.03, 0.023],
};
const tierIndex = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t,
  neg = (v) => v.map((n) => -n);
const shade = (i, j = 0) =>
  0.91 + (((Math.imul(i + 347, 33797) ^ Math.imul(j + 173, 17159)) >>> 6) % 1023) / 7300;
function faceWriter(out) {
  return (slot, points, dir, tone = 1) => {
    for (let j = 1; j < points.length - 1; j++) {
      const p = [points[0], points[j], points[j + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
        p.reverse();
        n = neg(n);
      }
      out.addTriangle(
        slot,
        ref,
        p,
        n,
        undefined,
        colors[slot].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
const block = (f, slot, x, z, w, d, a, b) => prism(f, slot, rect(x, z, w, d), a, b, false);
const compact = (r, threshold) =>
  r.filter((p, i) => {
    const a = r.at(i - 1),
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return l < 1.1 || Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l > threshold;
  });
function front(a, b, side = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    tx = dx / len,
    tz = dz / len;
  const n = [-tz * side, 0, tx * side],
    p = (u, y, d = 0) => [a[0] + tx * u + n[0] * d, y, a[1] + tz * u + n[2] * d];
  return { len, n, p, dir: [tx, 0, tz] };
}
function panel(f, role, F, a, b, lo, hi, d = 0, tone = 1) {
  f(role, [F.p(a, lo, d), F.p(b, lo, d), F.p(b, hi, d), F.p(a, hi, d)], F.n, tone);
}
function fascia(f, role, F, a, b, lo, hi, d, thick) {
  const p = [F.p(a, 0, d - thick), F.p(b, 0, d - thick), F.p(b, 0, d), F.p(a, 0, d)].map(
    ([x, , z]) => [x, z],
  );
  prism(f, role, { outline: p }, lo, hi, false);
}
function ellipse(f, role, x, z, rx, rz, profile, segments, phase = 0, tone = 1, flute = 0) {
  const rows = profile.map(([y, r]) =>
    Array.from({ length: segments }, (_, i) => {
      const a = phase + (2 * Math.PI * i) / segments,
        v = r * (flute ? 1 - flute * (1 + Math.cos(i * Math.PI)) * 0.5 : 1);
      return [x + rx * v * Math.cos(a), y, z + rz * v * Math.sin(a)];
    }),
  );
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < segments; i++) {
      const k = (i + 1) % segments,
        a = phase + (2 * Math.PI * (i + 0.5)) / segments,
        p = rows[j - 1],
        q = rows[j];
      f(role, [p[i], p[k], q[k], q[i]], [Math.cos(a), 0.13, Math.sin(a)], tone * shade(i, j));
    }
  f(role, rows.at(-1), up, tone);
}
function pilaster(f, F, u, lo, hi, r, tier, d = 0.55) {
  const [x, , z] = F.p(u, lo, d),
    h = hi - lo;
  if (tier === 1) {
    fascia(f, 'trim', F, u - r, u + r, lo, hi, d + r, 0.5);
    return;
  }
  const n = tier === 2 ? 6 : tier === 3 ? 14 : 20;
  block(f, 'steps', x, z, r * 2.53, r * 2.53, lo, lo + 0.37);
  const profile =
    tier === 2
      ? [
          [lo + 0.36, 1.04],
          [lo + 0.64, 0.84],
          [hi - 0.68, 0.76],
          [hi - 0.19, 1.1],
        ]
      : [
          [lo + 0.36, 1.04],
          [lo + 0.55, 1.02],
          [lo + 0.77, 0.82],
          [lo + h * 0.48, 0.83],
          [hi - 0.68, 0.72],
          [hi - 0.41, 0.93],
          [hi - 0.19, 1.1],
        ];
  ellipse(f, 'trim', x, z, r, r, profile, n, 0, 1, tier >= 3 ? 0.105 : 0);
  block(f, 'trim', x, z, r * 2.49, r * 2.49, hi - 0.2, hi + 0.08);
  if (tier >= 3)
    for (const s of [-1, 1]) {
      const a = F.p(u + s * r * 0.52, hi - 0.27, d + r * 0.8),
        b = F.p(u + s * r * 0.35, hi - 0.65, d + r * 0.56),
        c = F.p(u + s * r * 0.11, hi - 0.4, d + r * 0.98);
      f('trim', [a, b, c], F.n, 1.08);
    }
}
function archPoints(c, r, s, hi, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [c - r * Math.cos(t), s + hi * Math.sin(t)];
  });
}
/** An arched recess with real stone jamb returns and a separately shaded back. */
function niche(
  f,
  F,
  u,
  w,
  lo,
  spring,
  rise,
  tier,
  { d = 0, depth = 0.32, trim = 0.19, back = true, material = 'recess' } = {},
) {
  const n = [4, 4, 5, 12, 17][tier],
    r = w / 2,
    a = archPoints(u, r, spring, rise, n);
  const off = d - depth;
  if (back) {
    panel(f, material, F, u - r, u + r, lo, spring, off, 0.93);
    for (let i = 0; i < n; i++)
      f(material, [F.p(u, spring, off), F.p(...a[i], off), F.p(...a[i + 1], off)], F.n, 0.96);
  }
  if (tier === 1 && depth < 1) return a;
  for (const s of [-1, 1]) {
    const c = u + s * r,
      v = F.dir.map((n) => -s * n);
    f('trim', [F.p(c, lo, d), F.p(c, spring, d), F.p(c, spring, off), F.p(c, lo, off)], v, 0.87);
    if (trim)
      panel(
        f,
        'trim',
        F,
        Math.min(c, c + s * trim),
        Math.max(c, c + s * trim),
        lo,
        spring,
        d + 0.017,
        shade(s),
      );
  }
  const rim = archPoints(u, r + trim, spring, rise + trim, n);
  for (let i = 0; i < n; i++) {
    const [p, q] = a.slice(i, i + 2);
    f(
      'trim',
      [F.p(...p, off), F.p(...q, off), F.p(...q, d), F.p(...p, d)],
      [0, -1, 0],
      shade(i) * 0.88,
    );
    if (trim)
      f(
        'trim',
        [
          F.p(...p, d + 0.02),
          F.p(...q, d + 0.02),
          F.p(...rim[i + 1], d + 0.02),
          F.p(...rim[i], d + 0.02),
        ],
        F.n,
        shade(i, 2),
      );
  }
  return a;
}
function archWall(
  f,
  F,
  center,
  width,
  bottom,
  spring,
  rise,
  top,
  tier,
  d = 0,
  depth = 0.28,
  back = true,
) {
  const r = width / 2,
    a = niche(f, F, center, width, bottom, spring, rise, tier, {
      d,
      depth,
      back,
      trim: tier >= 2 ? 0.28 : 0.14,
    });
  panel(f, 'masonry', F, 0, center - r, bottom, top, d);
  panel(f, 'masonry', F, center + r, F.len, bottom, top, d);
  for (let i = 1; i < a.length; i++) {
    const [p, q] = a.slice(i - 1, i + 1);
    f('masonry', [F.p(...p, d), F.p(...q, d), F.p(q[0], top, d), F.p(p[0], top, d)], F.n);
  }
}
function disk(f, F, u, y, rx, ry, d, tier, slot = 'recess', frame = true) {
  const n = [6, 8, 14, 20, 28][tier],
    outer = rx + 0.2,
    high = ry + 0.2,
    pt = (a, b, c) => F.p(u + a * Math.cos(c), y + b * Math.sin(c), d);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      p = pt(rx, ry, a),
      q = pt(rx, ry, b);
    f(slot, [F.p(u, y, d), p, q], F.n, shade(i));
    if (frame) f('trim', [p, q, pt(outer, high, b), pt(outer, high, a)], F.n, 1.04);
  }
}
function rail(f, F, lo, tier) {
  if (tier === 0) return;
  fascia(f, 'trim', F, 0, F.len, lo, lo + 0.25, 0.18, 0.33);
  fascia(f, 'trim', F, 0, F.len, lo + 0.94, lo + 1.13, 0.18, 0.31);
  if (tier < 2) return;
  const n = Math.ceil(F.len / (tier === 2 ? 2.1 : 1.05));
  for (let j = 0; j < n; j++) {
    const u = (F.len * (j + 0.5)) / n,
      [x, , z] = F.p(u, lo, 0.035);
    if (tier === 2) panel(f, 'trim', F, u - 0.09, u + 0.09, lo + 0.24, lo + 0.96, 0.11);
    else
      ellipse(
        f,
        'trim',
        x,
        z,
        0.146,
        0.146,
        [
          [lo + 0.22, 0.98],
          [lo + 0.44, 0.65],
          [lo + 0.68, 0.99],
          [lo + 0.94, 0.59],
        ],
        4,
      );
  }
}
function steps(f, tier) {
  const s = layout.stairs,
    n = [3, 6, 11, 11, 11][tier],
    base = Math.min(...s.grade) - 0.48;
  for (let i = 0; i < n; i++) {
    const x = mix(s.x0, s.x1, i / n),
      hi = mix(Math.max(...s.grade) + 0.16, s.landing, (i + 1) / n);
    block(f, 'steps', (x + s.x1) * 0.5, (s.z0 + s.z1) * 0.5, s.x1 - x, s.z1 - s.z0, base, hi);
  }
  if (tier === 0) return;
  for (const z of [s.z0, s.z1]) {
    const F = front([s.x0 - 0.05, z], [s.x1 + 0.7, z], z === s.z0 ? -1 : 1),
      top = s.landing + 0.08;
    fascia(f, 'steps', F, 0, F.len, base, top, 0.35, 0.91);
    rail(f, F, top, tier);
  }
  if (tier >= 2)
    for (const z of [s.z0 + 4.8, s.z1 - 4.8]) {
      const F = front([s.x0 + 0.34, z], [s.x1, z]),
        count = tier === 2 ? 4 : 8;
      for (let j = 0; j < count; j++) {
        const u = (j * F.len) / count,
          y = mix(base + 0.62, s.landing, j / count);
        panel(f, 'metal', F, u, u + 0.067, y, y + 0.8, 0);
        panel(f, 'metal', F, u, u + 0.067, y, y + 0.8, 0.015);
      }
    }
}
function pediment(f, F, p, tier) {
  const u = p.center - layout.facade.z0,
    a = u - p.width / 2,
    b = u + p.width / 2,
    base = p.base,
    top = p.top;
  const profile = [
    [a, base],
    [b, base],
    [u, top],
  ];
  for (const d of [0.82, 0.82 - p.thickness])
    f(
      'masonry',
      profile.map((q) => F.p(...q, d)),
      d > 0 ? F.n : neg(F.n),
      1.1,
    );
  for (let i = 0; i < 3; i++) {
    const a = profile[i],
      b = profile[(i + 1) % 3];
    f(
      'trim',
      [
        F.p(...a, 0.82),
        F.p(...b, 0.82),
        F.p(...b, 0.82 - p.thickness),
        F.p(...a, 0.82 - p.thickness),
      ],
      up,
    );
  }
  if (tier === 0) return;
  for (const [a, b] of [
    [profile[0], profile[2]],
    [profile[2], profile[1]],
  ]) {
    const A = F.p(...a, 1.13),
      B = F.p(...b, 1.13),
      q = F.p(b[0], b[1] - 0.54, 1.13),
      p = F.p(a[0], a[1] - 0.54, 1.13);
    f('trim', [p, q, B, A], F.n, 1.11);
    f('trim', [A, B, F.p(...b, 0.84), F.p(...a, 0.84)], up);
  }
  for (const [i, v] of [-9.1, 0, 9.1].entries())
    disk(
      f,
      F,
      u + v,
      base + (i === 1 ? 3.3 : 1.77),
      i === 1 ? 1.42 : 0.82,
      i === 1 ? 1.42 : 0.82,
      0.852,
      tier,
      'masonry',
    );
  if (tier >= 3)
    for (let i = 0; i < 22; i++) {
      const s = (i + 0.5) / 22,
        x = mix(a, b, s),
        y = mix(base, top, 1 - Math.abs(s * 2 - 1));
      fascia(f, 'trim', F, x - 0.16, x + 0.16, y - 0.87, y - 0.53, 1.17, 0.34);
    }
}
function facade(f, tier) {
  const p = layout.facade,
    F = front([p.west, p.z0], [p.west, p.z1]),
    lo = p.platformY,
    h = p.top;
  block(f, 'masonry', p.back + 0.49, (p.z0 + p.z1) * 0.5, 2.23, p.z1 - p.z0, lo, h);
  if (tier === 0) {
    panel(f, 'masonry', F, 0, F.len, lo, h, 0.0);
    fascia(f, 'trim', F, 0, F.len, h - 0.79, h + 0.63, 0.65, 1.17);
    const p0 = p.pediment.center - p.z0 - p.pediment.width * 0.5;
    fascia(f, 'trim', F, p0, p0 + p.pediment.width, 43.31, p.pediment.base + 0.04, 1.01, 1.93);
    pediment(f, F, p.pediment, tier);
    return;
  }
  const boundaries = [0, 12.32, 26.72, F.len];
  for (const [i, b] of p.bays.entries()) {
    const a = boundaries[i],
      d = boundaries[i + 1],
      u = b.z - p.z0;
    const [x, , z0] = F.p(a, 0),
      [xx, , z1] = F.p(d, 0),
      Q = front([x, z0], [xx, z1]),
      c = u - a;
    const r = b.w / 2,
      spring = i === 1 ? 15.1 : 14.0,
      rise = r * 0.89,
      y1 = 22.6;
    const curve = niche(f, Q, c, b.w, lo, spring, rise, tier, {
      d: 0.04,
      depth: 2.4,
      trim: 0.48,
      back: false,
    });
    panel(f, 'masonry', Q, 0, c - r, lo, y1, 0.04);
    panel(f, 'masonry', Q, c + r, Q.len, lo, y1, 0.04);
    for (let j = 1; j < curve.length; j++) {
      const [a, b] = curve.slice(j - 1, j + 1);
      f(
        'masonry',
        [Q.p(...a, 0.04), Q.p(...b, 0.04), Q.p(b[0], y1, 0.04), Q.p(a[0], y1, 0.04)],
        Q.n,
      );
    }
    // Three working stone recesses hold the door, colored pilasters and relief medallions.
    const doorR = b.doorWidth * 0.5,
      doorTop = i === 1 ? 11.4 : 10.35,
      s = lo + 6.18;
    const doors = niche(f, Q, c, b.doorWidth, lo, s, doorTop - s, tier, {
      d: -2.34,
      depth: 0.25,
      trim: 0.34,
    });
    const rear = -2.39;
    panel(f, 'trim', Q, c - r, c - doorR, lo, spring, rear, 0.94);
    panel(f, 'trim', Q, c + doorR, c + r, lo, spring, rear, 0.94);
    for (let j = 1; j < doors.length; j++) {
      const [a, b] = doors.slice(j - 1, j + 1);
      f(
        'trim',
        [Q.p(...a, rear), Q.p(...b, rear), Q.p(b[0], spring, rear), Q.p(a[0], spring, rear)],
        Q.n,
      );
    }
    for (let j = 1; j < curve.length; j++)
      f(
        'trim',
        [Q.p(c, spring, rear), Q.p(...curve[j - 1], rear), Q.p(...curve[j], rear)],
        Q.n,
        0.92,
      );
    if (tier >= 2) {
      disk(
        f,
        Q,
        c,
        spring - 0.34,
        i === 1 ? 1.63 : 1.29,
        i === 1 ? 1.95 : 1.55,
        -2.29,
        tier,
        'masonry',
      );
      const emblemY = spring - 0.34;
      const crest = [
        [c - 0.59, emblemY + 0.93],
        [c + 0.59, emblemY + 0.93],
        [c + 0.51, emblemY - 0.12],
        [c, emblemY - 0.83],
        [c - 0.51, emblemY - 0.12],
      ];
      f(
        'trim',
        crest.map((p) => Q.p(...p, -2.25)),
        Q.n,
        1.21,
      );
      panel(f, 'masonry', Q, c - 0.48, c + 0.48, emblemY + 0.37, emblemY + 0.58, -2.22, 0.72);
      panel(f, 'masonry', Q, c - 0.082, c + 0.082, emblemY - 0.54, emblemY + 0.82, -2.21, 0.76);
      for (const v of [-1, 1])
        pilaster(f, Q, c + v * (doorR + 0.65), lo + 0.15, doorTop + 0.7, 0.42, tier, -1.91);
      for (const q of [c - r - 0.48, c + r + 0.48])
        if (q > 0 && q < Q.len) pilaster(f, Q, q, lo + 0.18, 21.93, 0.61, tier, 0.33);
    }
    panel(f, 'masonry', Q, 0, Q.len, 22.6, h, 0.02);
    if (tier >= 2) {
      for (const j of [-1, 0, 1]) {
        const u = c + j * b.w * 0.27;
        niche(f, Q, u, j === 0 ? 1.85 : 1.54, 25.3, 32.36, 1.03, tier, {
          d: 0.065,
          depth: 0.008,
          trim: 0.2,
        });
      }
      niche(f, Q, c, 1.68, 36.05, 38.75, 0.87, tier, { d: 0.064, depth: 0.009 });
      for (const s of [-1, 1]) disk(f, Q, c + s * b.w * 0.28, 37.63, 0.68, 0.74, 0.075, tier);
    } else
      for (const j of [-1, 0, 1])
        panel(
          f,
          'recess',
          Q,
          c + j * b.w * 0.24 - 0.66,
          c + j * b.w * 0.24 + 0.66,
          25.3,
          32.5,
          0.066,
        );
  }
  for (const h of [22.15, 23.05, 34.37, 42.34, 43.1])
    fascia(f, 'trim', F, 0, F.len, h, h + (h === 23.05 ? 0.72 : 0.38), 0.79, 0.93);
  const p0 = p.pediment.center - p.z0 - p.pediment.width * 0.5,
    p1 = p0 + p.pediment.width;
  fascia(f, 'trim', F, p0, p1, 43.31, p.pediment.base + 0.04, 1.01, 1.93);
  if (tier >= 2)
    for (const v of [1.5, 12.15, 26.94, F.len - 1.5])
      for (const d of [-0.45, 0.45]) pilaster(f, F, v + d, 23.89, 42.34, 0.53, tier, 0.42);
  rail(f, F, h - 0.03, tier);
  pediment(f, F, p.pediment, tier);
}
function towerRect(p, s, bevel = false) {
  const { x, z, w, d } = p,
    X = w * s * 0.5,
    Z = d * s * 0.5,
    k = bevel ? Math.min(X, Z) * 0.235 : 0;
  return bevel
    ? [
        [x - X + k, z - Z],
        [x + X - k, z - Z],
        [x + X, z - Z + k],
        [x + X, z + Z - k],
        [x + X - k, z + Z],
        [x - X + k, z + Z],
        [x - X, z + Z - k],
        [x - X, z - Z + k],
      ]
    : rect(x, z, w * s, d * s).outline;
}
function rimTower(f, p, y, depth, s, tier) {
  const r = towerRect(p, s, tier >= 3);
  prism(f, 'trim', { outline: r }, y, y + depth, false);
  if (tier >= 2)
    prism(
      f,
      'trim',
      { outline: towerRect(p, s + 0.029, tier >= 3) },
      y + depth * 0.7,
      y + depth * 0.92,
      false,
    );
}
function tower(f, p, tier) {
  const Y = p.ground,
    lo = p.base;
  const stage = [Y + 24.0, Y + 46.7],
    r = towerRect(p, 1, tier >= 1);
  prism(f, 'masonry', { outline: r }, lo, stage[1], false);
  for (const y of [Y + 2.2, ...stage]) rimTower(f, p, y, 0.92, 1.075, tier);
  if (tier > 0) {
    const raw = towerRect(p, 1);
    for (let i = 0; i < 4; i++) {
      const F = front(raw[i], raw[(i + 1) % 4], -1),
        u = F.len * 0.5;
      for (const [j, y] of [Y + 7.3, Y + 27.7, Y + 37.9].entries()) {
        const w = j === 1 ? 3.15 : 2.5;
        niche(f, F, u, w, y, y + 3.8, 1.38, tier, { d: 0.075, depth: 0.02, trim: 0.25 });
        if (tier >= 2)
          fascia(f, 'trim', F, u - w * 0.7, u + w * 0.7, y - 0.36, y - 0.03, 0.56, 0.51);
      }
      if (tier >= 2)
        for (const u of [1.36, F.len - 1.38]) {
          pilaster(f, F, u, Y + 3.35, Y + 23.75, 0.72, tier, 0.12);
          pilaster(f, F, u, Y + 25.85, Y + 46.42, 0.69, tier, 0.09);
        }
    }
  }
  if (!p.complete) {
    const r = towerRect(p, 0.95),
      n = 4;
    for (let i = 0; i < n; i++) {
      const F = front(r[i], r[(i + 1) % n], -1),
        h = stage[1] + 1.17;
      fascia(f, 'masonry', F, 0, F.len, stage[1], h, 0.39, 0.67);
      for (const j of [0, 1, 2, 3]) {
        const u = mix(0.59, F.len - 0.59, j / 3),
          [x, , z] = F.p(u, 0, 0.09);
        const q = j === 0 || j === 3 ? p.top : mix(p.top - 1.01, p.top - 0.28, shade(j, i) - 0.44);
        if (tier < 2) block(f, 'trim', x, z, 1.28, 1.27, h - 0.12, q);
        else
          ellipse(
            f,
            'masonry',
            x,
            z,
            0.71,
            0.71,
            [
              [h - 0.08, 0.98],
              [h + 0.42, 1.1],
              [q, 0.83],
            ],
            tier === 2 ? 7 : 10,
            0,
            shade(j, i),
          );
      }
    }
    return;
  }
  const levels = [
    { y0: Y + 47.45, y1: Y + 64.05, s: 0.91, arch: 4.4, oct: false },
    { y0: Y + 64.0, y1: Y + 76.0, s: 0.81, arch: 2.9, oct: true },
  ];
  for (const [j, s] of levels.entries()) {
    const r = towerRect(p, s.s, s.oct);
    for (let i = 0; i < r.length; i++) {
      const F = front(r[i], r[(i + 1) % r.length], -1),
        span = F.len,
        u = span * 0.5;
      const w = Math.min(span * 0.68, s.arch),
        bottom = s.y0 + (j === 1 ? 3.4 : 2.55),
        spring = s.y1 - 4.32,
        rise = w * 0.51;
      if (tier === 0) {
        if (span < 3.8) panel(f, 'masonry', F, 0, span, s.y0, s.y1);
        else {
          const r = w / 2,
            a = archPoints(u, r, spring, rise, 3);
          panel(f, 'masonry', F, 0, u - r, s.y0, s.y1);
          panel(f, 'masonry', F, u + r, span, s.y0, s.y1);
          panel(f, 'masonry', F, u - r, u + r, s.y0, bottom);
          for (let i = 1; i < a.length; i++) {
            const [p, q] = a.slice(i - 1, i + 1);
            f('masonry', [F.p(...p), F.p(...q), F.p(q[0], s.y1), F.p(p[0], s.y1)], F.n);
          }
        }
      } else if (j === 0 && tier >= 3) {
        const bounds = [0, span * 0.335, span * 0.665, span];
        for (let k = 0; k < 3; k++) {
          const [a, , z] = F.p(bounds[k], 0),
            [b, , t] = F.p(bounds[k + 1], 0),
            part = front([a, z], [b, t], -1);
          const middle = k === 1,
            base = middle ? bottom : bottom + 1.1;
          archWall(
            f,
            part,
            part.len * 0.5,
            middle ? 2.82 : 1.55,
            base,
            spring - (middle ? 0 : 2.07),
            middle ? 1.47 : 0.78,
            s.y1,
            tier,
            0,
            0.82,
            false,
          );
          panel(f, 'masonry', part, 0, part.len, s.y0, base);
        }
      } else {
        archWall(f, F, u, w, bottom, spring, rise, s.y1, tier, 0, 0.82, span < 3.8);
        panel(f, 'masonry', F, 0, span, s.y0, bottom);
      }
      if (tier >= 2 && span > 4.3) {
        for (const q of [1.01, span - 1.01])
          pilaster(f, F, q, s.y0 + 0.66, s.y1 - 0.42, j === 1 ? 0.42 : 0.55, tier, 0.21);
        if (j === 1) {
          disk(f, F, u, s.y0 + 2.06, 0.83, 0.83, 0.042, tier, 'steps');
          panel(f, 'metal', F, u - 0.034, u + 0.037, s.y0 + 2.01, s.y0 + 2.63, 0.059);
          panel(f, 'metal', F, u - 0.4, u + 0.05, s.y0 + 1.99, s.y0 + 2.05, 0.061);
        }
      }
    }
    rimTower(f, p, s.y1 - 0.56, 1.02, s.s + 0.07, tier);
    if (j === 0 && tier >= 2)
      for (const [i, [dx, dz]] of [
        [0, -2.4],
        [0, 2.4],
        [-2.4, 0],
        [2.4, 0],
      ].entries()) {
        const y = Y + 54.0,
          scale = i % 2 ? 0.88 : 1;
        ellipse(
          f,
          'metal',
          p.x + dx,
          p.z + dz,
          0.77 * scale,
          0.77 * scale,
          [
            [y, 1.2],
            [y + 0.28, 1.12],
            [y + 0.92, 0.75],
            [y + 1.45, 0.62],
            [y + 1.64, 0.34],
          ],
          tier >= 3 ? 12 : 7,
        );
      }
  }
  const dome = [
    [Y + 76.2, 1],
    [Y + 76.8, 0.99],
    [Y + 78.3, 0.92],
    [Y + 80.1, 0.77],
    [Y + 81.65, 0.5],
    [Y + 82.48, 0.23],
  ];
  ellipse(
    f,
    'trim',
    p.x,
    p.z,
    5.4,
    5.54,
    tier === 0 ? [dome[0], dome[2], dome[4], dome[5]] : dome,
    [8, 12, 16, 24, 32][tier],
    Math.PI / 8,
    1.0,
  );
  ellipse(
    f,
    'trim',
    p.x,
    p.z,
    1.33,
    1.37,
    [
      [Y + 82.45, 0.96],
      [Y + 83.14, 1],
      [Y + 84.08, 0.77],
      [Y + 84.72, 0.57],
      [Y + 85.3, 0.23],
    ],
    tier < 2 ? 6 : 12,
  );
  block(f, 'metal', p.x, p.z, 0.13, 0.13, Y + 85.15, p.top);
  if (tier > 0) block(f, 'metal', p.x, p.z, 0.91, 0.132, p.top - 0.96, p.top - 0.83);
}
function chapelLine(f, p, tier) {
  const F = front(...p.line, p.face),
    w = F.len,
    n = p.bays;
  if (tier === 0) return;
  const cut = (j, k) => (w * (j + k)) / n;
  for (let j = 0; j < n; j++) {
    const c = cut(j, 0.5),
      width = w / n,
      offset = 0.27,
      base = p.portal ? 3.22 : 13.8,
      y2 = p.rail - 6.88;
    if (p.portal && tier >= 2) {
      niche(f, F, c, 5.11, base, 11.58, 2.6, tier, { d: 0.7, depth: 0.16, trim: 0.48 });
      for (const s of [-1, 1]) pilaster(f, F, c + s * 3.48, base + 0.02, 18.35, 0.77, tier, 0.68);
      disk(f, F, c, 17.32, 0.84, 1.01, 0.77, tier, 'masonry');
    } else {
      const window = Math.min(width * 0.31, 2.74);
      niche(f, F, c, window, base, base + 5.1, window * 0.5, tier, {
        d: offset,
        depth: 0.012,
        trim: 0.21,
      });
      if (p.apse && tier >= 2)
        for (const s of [-1, 1])
          niche(f, F, c + s * width * 0.22, window * 0.61, base, base + 4.94, window * 0.32, tier, {
            d: offset,
            depth: 0.012,
            trim: 0.18,
          });
      if (y2 > base + 6) {
        niche(f, F, c, window * 0.86, y2 - 3.76, y2 - 1.31, 1.18, tier, {
          d: offset,
          depth: 0.014,
          trim: 0.19,
        });
        if (tier >= 2)
          for (const s of [-1, 1])
            disk(f, F, c + s * width * 0.2, y2 - 2.03, 0.61, 0.61, offset + 0.016, tier);
      }
    }
    if (tier >= 2) {
      const u = cut(j, 0.045),
        r = Math.min(0.87, width * 0.081);
      fascia(f, 'masonry', F, u - r, u + r, layout.base, p.rail + 0.26, 0.93, 0.98);
      fascia(f, 'trim', F, u - r - 0.16, u + r + 0.16, p.rail - 0.39, p.rail + 0.03, 1.1, 1.17);
    }
  }
  for (const y of [p.rail - 1.2, p.rail - 0.22]) fascia(f, 'trim', F, 0, w, y, y + 0.3, 0.54, 0.72);
  if (p.apse || p.name.startsWith('south aisle')) rail(f, F, p.rail, tier);
}
function plank(f, role, a, b, w, h) {
  const dir = b.map((v, i) => v - a[i]),
    len = Math.hypot(...dir),
    axis = dir.map((v) => v / len);
  const across = Math.hypot(axis[0], axis[2]) > 0.01 ? [-axis[2], 0, axis[0]] : [1, 0, 0];
  const n = Math.hypot(...across),
    u = across.map((x) => x / n),
    v = [
      axis[1] * u[2] - axis[2] * u[1],
      axis[2] * u[0] - axis[0] * u[2],
      axis[0] * u[1] - axis[1] * u[0],
    ];
  const pts = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => p.map((x, k) => x + u[k] * i * w * 0.5 + v[k] * j * h * 0.5));
  const A = pts(a),
    B = pts(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = A[i].map((x, k) => (x + A[j][k]) * 0.5 - a[k]);
    f(role, [A[i], A[j], B[j], B[i]], n);
  }
}
function roof(f, tier) {
  const { nave: n, apse: a, vaults } = layout.roof;
  for (const side of [-1, 1]) {
    const z = side < 0 ? n.z0 : n.z1,
      d = [0, 0.75, side],
      start = n.x0,
      end = mix(n.x0, n.x1, side < 0 ? 0.87 : 0.78);
    const P = (x, t, o = 0) => [x, mix(n.eave, n.ridge, t) + o, mix(z, n.center, t)];
    const bed = front([n.x0, z], [n.x1, z], side);
    fascia(f, 'masonry', bed, 0, bed.len, 38.25, n.eave, 0.15, 0.75);
    const parts = tier === 0 ? 1 : tier === 1 ? 6 : 17;
    for (let i = 0; i < parts; i++) {
      const x = mix(start, end, i / parts),
        y = mix(start, end, (i + 1) / parts);
      f('underlay', [P(x, 0), P(y, 0), P(y, 1), P(x, 1)], d, shade(i, side));
      if (tier >= 2) plank(f, 'underlay', P(x, 0.013, 0.016), P(x, 0.996, 0.016), 0.075, 0.045);
    }
    for (let i = 0; i < (tier === 0 ? 2 : tier === 1 ? 5 : 11); i++) {
      const num = tier === 0 ? 1 : tier === 1 ? 4 : 10,
        x = mix(end, n.x1, i / num);
      plank(f, 'timber', P(x, 0), P(x, 1), tier === 0 ? 0.46 : 0.29, tier < 2 ? 0.39 : 0.27);
      if (tier >= 2) plank(f, 'timber', P(x, 0.05), P(x, 0.84, -0.42), 0.18, 0.23);
    }
    if (tier > 0)
      for (const t of [0.05, 0.24, 0.43, 0.63, 0.84, 0.99])
        plank(f, 'timber', P(end, t, 0.06), P(n.x1, t, 0.06), 0.21, 0.22);
  }
  const ridge = [a.origin[0], a.ridge, a.origin[1]],
    foot = ([x, z]) => [x, a.eave, z];
  for (let j = 1; j < a.perimeter.length; j++) {
    const p = foot(a.perimeter[j - 1]),
      q = foot(a.perimeter[j]);
    const div = tier === 0 ? 1 : tier === 1 ? 3 : tier === 2 ? 5 : 9,
      point = (i, t) => p.map((v, k) => mix(mix(v, q[k], i / div), ridge[k], t));
    for (let i = 0; i < div; i++) {
      plank(
        f,
        'timber',
        point(i, 0),
        point(i, 1),
        tier === 0 ? 0.56 : 0.24,
        tier === 0 ? 0.49 : 0.28,
      );
      if (tier >= 3) plank(f, 'timber', point(i, 0.03), point(i, 0.61), 0.15, 0.16);
    }
    if (tier > 0)
      for (const v of [0.13, 0.3, 0.48, 0.66, 0.85])
        plank(f, 'timber', point(0, v), point(div, v), 0.185, 0.188);
  }
  plank(f, 'timber', [n.x0, n.ridge, n.center], ridge, tier === 0 ? 0.42 : 0.22, 0.23);
  if (tier === 0) return;
  for (const v of vaults) {
    const crown =
      tier === 1
        ? [
            [v.y, 1],
            [v.y + v.rise * 0.65, 0.68],
            [v.y + v.rise, 0.073],
          ]
        : [
            [v.y, 1],
            [v.y + v.rise * 0.52, 0.83],
            [v.y + v.rise * 0.88, 0.47],
            [v.y + v.rise, 0.073],
          ];
    ellipse(f, 'vault', v.x, v.z, v.rx, v.rz, crown, tier === 1 ? 6 : tier === 2 ? 10 : 20);
  }
}
export function buildMalagaLevel(out, level) {
  const tier = tierIndex[level],
    f = faceWriter(out),
    lo = layout.base;
  for (const p of layout.foundation) {
    const outline = tier === 0 ? compact(p.outline, 0.64) : p.outline;
    if (outline.length > 2) prism(f, 'steps', { outline, holes: p.holes }, lo, 0.43, false);
  }
  for (const z of layout.zones)
    for (const p of z.masks) {
      const outline = tier === 0 ? compact(p.outline, 0.58) : p.outline;
      if (outline.length > 2) prism(f, 'masonry', { outline, holes: p.holes }, lo, z.top, false);
    }
  for (const p of layout.towers) tower(f, p, tier);
  facade(f, tier);
  steps(f, tier);
  for (const p of layout.sides) chapelLine(f, p, tier);
  roof(f, tier);
}
export const buildMalagaSkyline = (out) => buildMalagaLevel(out, 'skyline');
export const buildMalagaDistrict = (out) => buildMalagaLevel(out, 'district');
export const buildMalagaStreet = (out) => buildMalagaLevel(out, 'street');
export const buildMalagaCloseup = (out) => buildMalagaLevel(out, 'closeup');
