/** Oviedo Cathedral. West portico, perforated south tower, nave and connected cloister. */
import { readFileSync } from 'node:fs';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import earcut from './polygon-triangulation.mjs';
export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ez/eze/metropolitan_cathedral_basilica_of_the_holy_saviour_oviedo/layout.json',
      import.meta.url,
    ),
  ),
);

const wall = { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 };
const trim = { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92 };
const dark = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.47 };
const paint = { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.17 };
export const surfaces = {
  wall,
  light: wall,
  trim,
  carve: trim,
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  glass: dark,
  amber: dark,
  blue: dark,
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.92 },
  metal: paint,
  bronze: paint,
};
const colors = {
  wall: [0.69, 0.568, 0.394],
  light: [0.73, 0.636, 0.485],
  trim: [0.79, 0.682, 0.482],
  carve: [0.66, 0.566, 0.397],
  base: [0.45, 0.405, 0.322],
  tile: [0.421, 0.211, 0.123],
  glass: [0.102, 0.143, 0.151],
  amber: [0.302, 0.205, 0.101],
  blue: [0.131, 0.229, 0.316],
  wood: [0.205, 0.123, 0.067],
  metal: [0.093, 0.104, 0.093],
  bronze: [0.286, 0.296, 0.202],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  c = Math.cos(layout.angle),
  s = Math.sin(layout.angle),
  tau = Math.PI * 2;
const range = (n) => Array.from({ length: n }, (_, i) => i),
  mix = (a, b, t) => a + (b - a) * t;
const tune = (i, j = 0) =>
  0.925 + (((Math.imul(i + 37, 30323) ^ Math.imul(j + 73, 87211)) >>> 7) % 181) / 1150;
function world([x, y, z]) {
  return [c * x - s * z, y, s * x + c * z];
}
function writer(out) {
  return (r, poly, dir, tone = 1) => {
    const vs = poly.map((p) => world(p).map(Math.fround)),
      wanted = world(dir);
    for (let i = 1; i < vs.length - 1; i++) {
      const p = [vs[0], vs[i], vs[i + 1]];
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((a, v, j) => a + v * wanted[j], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        r,
        'palette:#ffffff',
        p,
        n,
        undefined,
        colors[r].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
const rod = (o, r, a, b, w, d = w) => beam(o, r, world(a), world(b), w, d, colors[r]);
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function cap(f, r, rings, y, n = up) {
  const offsets = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    offsets.push(k);
    k += h.length;
  }
  const v = rings.flat(),
    indices = earcut(v.flat(), offsets);
  for (let i = 0; i < indices.length; i += 3)
    f(
      r,
      indices.slice(i, i + 3).map((j) => [v[j][0], typeof y === 'number' ? y : y(v[j]), v[j][1]]),
      n,
    );
}
function side(a, b, sign = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz),
    nx = (sign * dz) / w,
    nz = (-sign * dx) / w;
  return {
    a,
    b,
    w,
    n: [nx, 0, nz],
    point: (u, y, d = 0) => [a[0] + (dx * u) / w + nx * d, y, a[1] + (dz * u) / w + nz * d],
  };
}
const west = (x, a, b) => side([x, a], [x, b], -1);
function panel(f, r, s, a, b, lo, hi, d = 0, tone = 1) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  f(r, [s.point(a, lo, d), s.point(b, lo, d), s.point(b, hi, d), s.point(a, hi, d)], s.n, tone);
}
function ledge(f, r, s, a, b, lo, hi, from, to) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  const outline = [
    [a, from],
    [b, from],
    [b, to],
    [a, to],
  ].map(([u, d]) => {
    const [x, , z] = s.point(u, 0, d);
    return [x, z];
  });
  prism(f, r, { outline }, lo, hi, false);
}
function arc(u, r, spring, rise, n) {
  const k = 0.54,
    m = Math.sqrt(1 - Math.pow(k / (1 + k), 2));
  return range(n + 1).map((i) => {
    const t = -Math.cos((Math.PI * i) / n),
      v = (Math.abs(t) + k) / (1 + k);
    return [u + r * t, spring + (rise * Math.sqrt(Math.max(0, 1 - v * v))) / m];
  });
}
function archFill(f, r, s, u, radius, lo, spring, rise, d, n) {
  panel(f, r, s, u - radius, u + radius, lo, spring, d);
  const a = arc(u, radius, spring, rise, n);
  for (let i = 1; i < a.length; i++)
    f(r, [s.point(u, spring, d), s.point(...a[i - 1], d), s.point(...a[i], d)], s.n);
}
function archivolt(f, s, u, r, spring, rise, d, w, n, role = 'trim') {
  const a = arc(u, r, spring, rise, n),
    b = arc(u, r + w, spring, rise + w, n);
  for (let i = 1; i < a.length; i++) {
    f(
      role,
      [s.point(...a[i - 1], d), s.point(...a[i], d), s.point(...b[i], d), s.point(...b[i - 1], d)],
      s.n,
      tune(i),
    );
  }
}
function openings(f, s, portals, base, top, tier, thickness = 0.62) {
  let last = 0;
  const n = [2, 4, 8, 12, 16][tier];
  for (const p of portals) {
    const { u, r, threshold, spring, rise } = p,
      l = u - r,
      h = u + r;
    panel(f, 'wall', s, last, l, base, top);
    panel(f, 'base', s, l, h, base, threshold);
    const a = arc(u, r, spring, rise, n);
    for (let i = 1; i < a.length; i++) {
      const [x, y] = a[i - 1],
        [w, z] = a[i];
      f('wall', [s.point(x, y), s.point(w, z), s.point(w, top), s.point(x, top)], s.n);
      if (tier >= 2)
        f(
          'carve',
          [s.point(x, y), s.point(w, z), s.point(w, z, -thickness), s.point(x, y, -thickness)],
          down,
        );
    }
    if (tier >= 1) {
      archivolt(f, s, u, r, spring, rise, 0.055, 0.2, n);
      for (const d of [-1, 1]) {
        const v = u + d * r;
        panel(f, 'trim', s, v - 0.11, v + 0.11, threshold, spring, 0.057);
        const ray = s.point(v + d * 0.18, 0),
          p = s.point(v, 0);
        if (tier >= 2)
          f(
            'carve',
            [
              s.point(v, threshold),
              s.point(v, spring),
              s.point(v, spring, -thickness),
              s.point(v, threshold, -thickness),
            ],
            ray.map((v, i) => p[i] - v),
          );
      }
    }
    last = h;
  }
  panel(f, 'wall', s, last, s.w, base, top);
}
function lancet(f, o, s, u, y, w, h, tier, role = 'glass', bars = 2) {
  const n = [4, 5, 7, 10, 14][tier],
    r = w * 0.5,
    spring = y + h * 0.67,
    rise = h * 0.33;
  archFill(f, role, s, u, r, y, spring, rise, 0.018, n);
  if (tier <= 1) return;
  archivolt(f, s, u, r, spring, rise, 0.085, 0.16, n);
  for (const v of [u - r, u + r]) panel(f, 'trim', s, v - 0.09, v + 0.09, y - 0.1, spring, 0.086);
  if (tier >= 2)
    for (let i = 1; i < bars + 1; i++) {
      const x = u - r + (w * i) / (bars + 1);
      panel(f, 'carve', s, x - 0.043, x + 0.043, y, spring + h * 0.105, 0.066);
    }
  if (tier >= 3) {
    const p = s.point(u, spring + 0.26, 0.087),
      a = s.point(u - r * 0.44, spring - 0.05, 0.087),
      b = s.point(u + r * 0.44, spring - 0.05, 0.087);
    rod(o, 'trim', a, p, 0.062);
    rod(o, 'trim', p, b, 0.062);
  }
}
function rose(f, o, s, u, y, r, tier, clock = false) {
  const N = [10, 14, 20, 26, 32][tier],
    D = 0.14;
  const point = (rad, a, d) => s.point(u + rad * Math.cos(a), y + rad * Math.sin(a), d);
  for (let i = 0; i < N; i++) {
    const a = (tau * i) / N,
      b = (tau * (i + 1)) / N;
    f(
      clock ? 'metal' : i % 4 === 0 ? 'amber' : i % 4 === 1 ? 'blue' : 'glass',
      [s.point(u, y, D), point(r, a, D), point(r, b, D)],
      s.n,
    );
    f(
      'trim',
      [
        point(r, a, D + 0.045),
        point(r, b, D + 0.045),
        point(r + 0.25, b, D + 0.045),
        point(r + 0.25, a, D + 0.045),
      ],
      s.n,
    );
  }
  if (tier === 0) return;
  if (clock) {
    for (const [a, d] of [
      [1.19, 0.68],
      [3.65, 0.48],
    ])
      rod(o, 'bronze', s.point(u, y, 0.3), point(r * d, a, 0.3), 0.081);
    if (tier >= 2)
      for (const i of range(12)) {
        const a = (tau * i) / 12;
        rod(o, 'bronze', point(r * 0.79, a, 0.28), point(r * 0.91, a, 0.28), 0.055);
      }
    return;
  }
  const spokes = tier === 1 ? 8 : 12;
  for (const i of range(spokes)) {
    const a = (tau * i) / spokes,
      b = (tau * (i + 0.5)) / spokes,
      d = (tau * (i + 1)) / spokes;
    const A = point(r * 0.24, a, D + 0.1),
      B = point(r * 0.71, a, D + 0.1),
      C = point(r * 0.93, b, D + 0.1),
      E = point(r * 0.71, d, D + 0.1);
    rod(o, 'trim', A, B, 0.091);
    rod(o, 'trim', B, C, 0.12);
    rod(o, 'trim', C, E, 0.12);
  }
}
function pitched(f, poly, y, rise, axis) {
  const u = Math.min(...poly.map((p) => p[axis])),
    v = Math.max(...poly.map((p) => p[axis])),
    mid = (u + v) * 0.5;
  const g = (p) => y + rise * Math.max(0, 1 - Math.abs(p[axis] - mid) / ((v - u) * 0.5));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      d = (mid - a[axis]) / (b[axis] - a[axis]);
    const line = d > 0.0001 && d < 0.9999 ? [a, a.map((x, j) => mix(x, b[j], d)), b] : [a, b];
    for (let k = 1; k < line.length; k++) {
      const A = line[k - 1],
        B = line[k],
        F = side(A, B);
      if (F.w < 0.02) continue;
      f(
        'wall',
        [
          [A[0], y, A[1]],
          [B[0], y, B[1]],
          [B[0], g(B), B[1]],
          [A[0], g(A), A[1]],
        ],
        F.n,
      );
    }
  }
  return g;
}
function chapelVolumes(f, o, tier) {
  for (const V of layout.volumes) {
    const { ring, roof, eave, rise, bottom, axis, mid, half } = V;
    prism(f, 'wall', { outline: ring }, bottom, eave, false);
    const at = (p) => eave + rise * Math.max(0, 1 - Math.abs(p[axis] - mid) / half);
    pitched(f, ring, eave, rise, axis);
    for (const h of roof) cap(f, 'tile', [h], at);
    if (tier === 0) continue;
    for (let i = 0; i < ring.length; i++) {
      const s = side(ring[i], ring[(i + 1) % ring.length]);
      if (s.w < 4.4) continue;
      const n = Math.max(1, Math.floor(s.w / (tier === 1 ? 8.5 : 5.5)));
      for (const j of range(n)) {
        const u = (s.w * (j + 0.5)) / n;
        lancet(f, o, s, u, eave - 5.8, 1.64, 3.41, tier);
      }
      if (tier >= 2) ledge(f, 'trim', s, 0, s.w, eave - 0.38, eave - 0.17, -0.04, 0.2);
    }
  }
}
function nave(f, o, tier) {
  const n = layout.nave,
    { x0, x1, z0, z1, mid, eave, rise } = n;
  block(f, 'wall', (x0 + x1) * 0.5, (z0 + z1) * 0.5, x1 - x0, z1 - z0, layout.base + 12, eave);
  for (const [z, y] of [
    [z0, eave],
    [z1, eave],
  ]) {
    f(
      'tile',
      [
        [x0, y, z],
        [x1, y, z],
        [x1, eave + rise, mid],
        [x0, eave + rise, mid],
      ],
      up,
    );
  }
  for (const [x, d] of [
    [x0, -1],
    [x1, 1],
  ])
    f(
      'wall',
      [
        [x, eave, z0],
        [x, eave, z1],
        [x, eave + rise, mid],
      ],
      [d, 0, 0],
    );
  const A = layout.apse;
  prism(f, 'wall', { outline: A.lower }, -2.8, A.base, false);
  const inner = A.lower.map((p) => p.map((v, i) => mix(A.center[i], v, 0.69)));
  prism(f, 'light', { outline: inner }, A.base - 0.12, A.shoulder, false);
  for (let i = 0; i < A.lower.length; i++) {
    const j = (i + 1) % A.lower.length,
      p = A.lower[i],
      q = A.lower[j],
      r = inner[i],
      s = inner[j];
    const at = (p, y) => [p[0], y, p[1]];
    f('tile', [at(p, A.base), at(q, A.base), at(s, A.base + 3.9), at(r, A.base + 3.9)], up);
    f('tile', [at(r, A.shoulder), at(s, A.shoulder), at(A.center, A.ridge)], up);
    if (tier >= 1 && i < inner.length - 1) {
      const F = side(r, s);
      if (F.w > 2.85)
        lancet(
          f,
          o,
          F,
          F.w * 0.5,
          A.shoulder - 7.2,
          Math.min(F.w * 0.62, 3.1),
          5.55,
          tier,
          i % 2 ? 'blue' : 'glass',
        );
    }
  }
  for (const [H, sign] of [
    [layout.aisleNorth, -1],
    [layout.aisleSouth, 1],
  ]) {
    const { x0: a, x1: b, z0: k, z1: l, eave: y, high } = H,
      out = sign < 0 ? k : l,
      inside = sign < 0 ? l : k;
    block(f, 'wall', (a + b) * 0.5, (k + l) * 0.5, b - a, l - k, -2.75, y);
    f(
      'tile',
      [
        [a, y, out],
        [b, y, out],
        [b, high, inside],
        [a, high, inside],
      ],
      up,
    );
    for (const [x, sgn] of [
      [a, -1],
      [b, 1],
    ])
      f(
        'wall',
        [
          [x, y, out],
          [x, y, inside],
          [x, high, inside],
        ],
        [sgn, 0, 0],
      );
    if (tier === 0) continue;
    const F = side([a, out], [b, out], -sign),
      F2 = side([a, inside], [b, inside], -sign),
      count = tier === 1 ? 5 : 8;
    for (const i of range(count)) {
      const u = (F.w * (i + 0.49)) / count;
      if (tier >= 2) lancet(f, o, F, u, y - 6.45, 2.05, 4.85, tier);
      lancet(f, o, F2, u, eave - 7.5, 2.2, 5.47, tier, i % 3 === 1 ? 'blue' : 'glass');
      const x = mix(a, b, (i + 0.91) / count),
        z = out + sign * 0.58,
        lo = y - 2.54;
      if (i % 2 === 0) {
        block(f, 'light', x, z, 1.06, 1.39, -2.51, y + 1.21);
        if (tier >= 2) {
          const at = (t) => [
            x,
            mix(y + 0.8, eave - 3.2, t) - 0.95 * Math.sin(Math.PI * t),
            mix(z, inside, t),
          ];
          const sections = tier >= 3 ? 6 : 3;
          for (let j = 0; j < sections; j++)
            rod(o, 'trim', at(j / sections), at((j + 1) / sections), 0.62, 0.57);
          block(f, 'trim', x, z, 0.89, 0.91, lo, y + 1.52);
        }
      }
    }
  }
  const B = layout.holy;
  block(
    f,
    'light',
    (B.x0 + B.x1) * 0.5,
    (B.z0 + B.z1) * 0.5,
    B.x1 - B.x0,
    B.z1 - B.z0,
    -2.1,
    B.eave,
  );
  for (const k of [B.z0, B.z1]) {
    const m = (B.z0 + B.z1) * 0.5;
    f(
      'tile',
      [
        [B.x0, B.eave, k],
        [B.x1, B.eave, k],
        [B.x1, B.roof, m],
        [B.x0, B.roof, m],
      ],
      up,
    );
  }
  for (const [x, sign] of [
    [B.x0, -1],
    [B.x1, 1],
  ])
    f(
      'wall',
      [
        [x, B.eave, B.z0],
        [x, B.eave, B.z1],
        [x, B.roof, (B.z0 + B.z1) * 0.5],
      ],
      [sign, 0, 0],
    );
  if (tier >= 1) {
    const F = side([B.x0, B.z1], [B.x1, B.z1], -1);
    for (const u of [3.2, 6.2, 9.2]) lancet(f, o, F, u, B.eave - 5.32, 1.3, 3.9, tier, 'amber');
  }
}
function portico(f, o, tier) {
  for (const [i, P] of layout.portals.entries()) {
    const [a, b] = layout.portalBands[i],
      s = west(P.front, a, b),
      u = P.z - a,
      r = P.width / 2,
      depth = P.back - P.front;
    const portal = { u, r, threshold: P.threshold, spring: P.spring, rise: P.rise };
    openings(f, s, [portal], -2.55, P.top, tier, depth);
    const n = [4, 6, 8, 12, 16][tier],
      ring = [
        [P.front, a],
        [P.back, a],
        [P.back, b],
        [P.front, b],
      ];
    cap(f, 'tile', [ring], P.top + 0.09);
    const back = west(P.back, a, b);
    panel(f, 'wall', back, 0, u - r, P.threshold, P.top);
    panel(f, 'wall', back, u + r, back.w, P.threshold, P.top);
    if (tier === 0) panel(f, 'wood', back, u - r, u + r, P.threshold, P.spring + 0.51);
    else archFill(f, 'wood', back, u, r, P.threshold, P.spring, P.rise, 0, n);
    if (i === 1) {
      const y = P.top - 3.25;
      rose(f, o, s, u, y, 2.32, tier);
      const peak = P.top + 0.93;
      f(
        'tile',
        [
          [P.front, P.top + 0.1, a],
          [P.back, P.top + 0.1, a],
          [P.back, peak, (a + b) * 0.5],
          [P.front, peak, (a + b) * 0.5],
        ],
        up,
      );
      f(
        'tile',
        [
          [P.front, P.top + 0.1, b],
          [P.back, P.top + 0.1, b],
          [P.back, peak, (a + b) * 0.5],
          [P.front, peak, (a + b) * 0.5],
        ],
        up,
      );
    }
    const landing = rect(P.front - 0.6, P.z, 1.51, P.width + 0.47);
    if (tier === 0) cap(f, 'base', [landing.outline], P.threshold - 0.018);
    else prism(f, 'base', landing, P.threshold - 0.96, P.threshold - 0.018, false);
    if (tier === 0) continue;
    for (const side of [-1, 1]) {
      const v = u + side * (r + 0.43);
      ledge(f, 'trim', s, v - 0.21, v + 0.21, P.threshold, P.spring + 0.15, -0.17, 0.3);
      if (tier >= 2)
        for (const w of [0.47, 0.74]) {
          const x = u + side * (r + w);
          ledge(
            f,
            'carve',
            s,
            x - 0.09,
            x + 0.09,
            P.threshold + 0.06,
            P.spring - 0.14,
            -0.055,
            0.16,
          );
        }
    }
    for (const w of tier >= 2 ? [0.29, 0.61] : [0.28]) {
      archivolt(f, s, u, r + w, P.spring, P.rise + w, 0.08 + w * 0.12, 0.14, n, 'carve');
    }
    if (tier >= 3 && i === 1)
      for (const sg of [-1, 1])
        for (const j of range(4)) {
          const y = P.threshold + 1.0 + j * 0.96,
            v = u + sg * (r + 0.62);
          const A = s.point(v, y, 0.25),
            B = s.point(v, y + 0.52, 0.25);
          rod(o, 'trim', A, B, 0.19, 0.18);
          sphere(
            o,
            'trim',
            world(s.point(v, y + 0.57, 0.26)),
            [0.125, 0.135, 0.125],
            colors.trim,
            6,
            4,
          );
        }
  }
}
function octagon(x, z, r, n, phase = Math.PI / 8) {
  return range(n).map((i) => [
    x + r * Math.cos(phase + (tau * i) / n),
    z + r * Math.sin(phase + (tau * i) / n),
  ]);
}
function collar(f, x, z, y, r, h, n = 8) {
  const p = octagon(x, z, r, n);
  prism(f, 'trim', { outline: p }, y, y + h, false);
}
function spire(f, o, T, tier) {
  const { x, z, spireBase: lo, spireTop: hi, top } = T;
  const segments = [1, 2, 5, 8, 11][tier],
    n = 8;
  const rings = range(segments + 1).map((i) => {
    const t = i / segments,
      y = mix(lo, hi, t),
      r = 0.18 + 4.7 * Math.pow(1 - t, 1.105);
    return octagon(x, z, r, n).map(([a, b]) => [a, y, b]);
  });
  for (let i = 1; i < rings.length; i++) {
    const A = rings[i - 1],
      B = rings[i],
      t = (i - 1) / segments;
    for (const j of range(n)) {
      const k = (j + 1) % n,
        w = mix(0.43, 0.14, t);
      rod(o, 'trim', A[j], B[j], w);
      if (tier === 0) continue;
      const mid = A[j].map((v, k) => mix(v, A[(j + 1) % n][k], 0.5)),
        upper = B[j].map((v, k) => mix(v, B[(j + 1) % n][k], 0.5));
      rod(o, 'carve', A[j], upper, w * 0.59);
      rod(o, 'carve', A[k], upper, w * 0.59);
      if (tier >= 2) {
        rod(o, 'trim', A[j], mid, w * 0.73);
        rod(o, 'trim', mid, A[k], w * 0.73);
        if (tier >= 3 && i <= rings.length * 0.67) {
          const L = A[j].map((v, k) => mix(v, mid[k], 0.31)),
            R = A[(j + 1) % n].map((v, k) => mix(v, mid[k], 0.31));
          const cap = upper.map((v, k) => mix(v, mid[k], 0.19));
          rod(o, 'trim', L, cap, w * 0.63);
          rod(o, 'trim', R, cap, w * 0.63);
        }
        const tip = A[j].map((v, k) => mix(v, B[j][k], 0.54));
        rod(
          o,
          'carve',
          tip,
          [tip[0] + (tip[0] - x) * 0.115, tip[1] + w * 0.68, tip[2] + (tip[2] - z) * 0.115],
          w * 0.66,
        );
      }
    }
  }
  collar(f, x, z, lo - 0.45, 5.03, 0.52);
  const finial = hi + 0.54;
  rod(o, 'bronze', [x, hi - 0.1, z], [x, top, z], 0.095);
  if (tier > 0) {
    rod(o, 'bronze', [x - 0.49, finial, z], [x + 0.49, finial, z], 0.082);
    sphere(o, 'bronze', world([x, hi + 0.16, z]), [0.17, 0.18, 0.17], colors.bronze, 8, 5);
  }
}
function tower(f, o, tier) {
  const T = layout.tower,
    { x, z, front, rear, width: w, base, parapet } = T;
  const core = rect(x, z, rear - front, w).outline,
    lower = base + 14.52,
    upper = base + 45.65;
  prism(f, 'wall', { outline: core }, lower, upper, false);
  // Return walls sit behind the outer jambs and leave the whole lower porch open.
  for (const v of [z - w * 0.5, z + w * 0.5]) {
    const F = side([front, v], [rear, v], v < z ? 1 : -1);
    panel(f, 'wall', F, 0, F.w, -2.55, lower);
  }
  for (const [i, a] of core.entries()) {
    const b = core[(i + 1) % core.length],
      s = side(a, b),
      mid = s.w * 0.5,
      westFace = i === 3;
    const u =
      tier === 0
        ? [{ u: mid, r: 1.63, threshold: upper + 1.42, spring: upper + 6.63, rise: 1.41 }]
        : [-1.81, 1.81].map((d) => ({
            u: mid + d,
            r: 1.32,
            threshold: upper + 1.1,
            spring: upper + 6.67,
            rise: 1.4,
          }));
    openings(f, s, u, upper, parapet, tier, 0.42);
    if (westFace || tier >= 1) {
      lancet(f, o, s, mid, base + 18.2, 3.53, 9.02, tier, 'glass', 3);
      lancet(f, o, s, mid, base + 32.5, 3.47, 7.65, tier, 'glass', 3);
      if (westFace) rose(f, o, s, mid, base + 35.55, 1.11, tier, true);
    }
    if (tier >= 2) {
      for (const u of [0.71, s.w - 0.71]) {
        for (const [lo, hi] of [
          [base + 1.1, base + 14.8],
          [base + 15.2, base + 28.8],
          [base + 29.15, base + 42.07],
          [base + 42.38, parapet - 0.42],
        ]) {
          ledge(f, 'carve', s, u - 0.26, u + 0.26, lo, hi, -0.08, 0.56);
          ledge(f, 'trim', s, u - 0.38, u + 0.38, hi - 0.22, hi, -0.095, 0.67);
          if (tier >= 3)
            for (let k = 1; k <= 3; k++) {
              const y = mix(lo, hi, k / 4);
              panel(f, 'trim', s, u - 0.3, u + 0.3, y - 0.075, y + 0.075, 0.572);
            }
        }
      }
      for (const [lo, rise, w] of [
        [base + 27.9, 1.91, 2.13],
        [base + 40.7, 1.65, 1.82],
      ]) {
        const A = s.point(mid - w, lo, 0.193),
          B = s.point(mid, lo + rise, 0.25),
          C = s.point(mid + w, lo, 0.193);
        rod(o, 'trim', A, B, 0.19);
        rod(o, 'trim', B, C, 0.19);
      }
      if (tier >= 3)
        for (const j of range(8)) {
          const u = (s.w * (j + 0.5)) / 8;
          ledge(f, 'trim', s, u - 0.29, u + 0.29, parapet - 0.31, parapet + 0.52, -0.15, 0.39);
        }
    }
    if (tier >= 1)
      for (const yy of [base + 15.2, base + 28.88, base + 42.11, upper + 0.38, parapet - 0.38]) {
        ledge(f, 'trim', s, -0.05, s.w + 0.05, yy, yy + 0.29, -0.09, 0.2);
      }
  }
  for (const a of core) {
    const b = a.map((v, i) => mix([T.x, T.z][i], v, 1.055));
    const x = b[0],
      z = b[1],
      y = parapet + 1.1;
    block(f, 'light', x, z, 1.25, 1.25, -2.42, parapet);
    const ring = octagon(x, z, 0.89, 4, Math.PI / 4);
    if (tier >= 2)
      for (const yy of [base + 11.2, base + 24.3, base + 39.2, base + 50.1, y]) {
        collar(f, x, z, yy, 0.99, 0.3, 4);
      }
    for (let i = 0; i < 4; i++) {
      const p = ring[i],
        q = ring[(i + 1) % 4];
      f(
        'trim',
        [
          [p[0], y, p[1]],
          [q[0], y, q[1]],
          [x, y + 4.35, z],
        ],
        up,
      );
    }
    if (tier >= 3)
      for (const j of range(5)) {
        const yy = y + j * 0.67,
          r = 0.89 * (1 - j * 0.15);
        for (const [dx, dz] of [
          [-1, 0],
          [0, -1],
          [1, 0],
          [0, 1],
        ])
          rod(
            o,
            'carve',
            [x + dx * r, yy, z + dz * r],
            [x + dx * (r + 0.2), yy + 0.24, z + dz * (r + 0.2)],
            0.15,
          );
      }
  }
  cap(f, 'trim', [core], parapet);
  spire(f, o, T, tier);
}
function cloister(f, o, tier) {
  const { outer, inner, base, top, ridge } = layout.cloister;
  for (let i = 0; i < outer.length; i++) {
    const s = side(outer[i], outer[(i + 1) % outer.length]);
    panel(f, 'wall', s, 0, s.w, base, top);
    if (tier >= 1 && s.w > 9)
      for (const j of range(Math.round(s.w / 5.5))) {
        const u = (s.w * (j + 0.5)) / Math.round(s.w / 5.5);
        lancet(f, o, s, u, top - 5.75, 1.55, 3.76, tier);
      }
  }
  const holes = [inner.toReversed()];
  cap(f, 'tile', [outer, ...holes], (p) => {
    const close = Math.min(
      ...inner.map((a, i) => {
        const b = inner[(i + 1) % inner.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = Math.max(
            0,
            Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
          );
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
      }),
    );
    return close < 0.11 ? top + 0.03 : ridge;
  });
  for (let i = 0; i < inner.length; i++) {
    const s = side(inner[i], inner[(i + 1) % inner.length], -1),
      n = tier === 0 ? 2 : Math.round(s.w / 2.83);
    const threshold = layout.base + 0.32,
      spring = threshold + 3.3,
      rise = 1.65;
    const p = range(n).map((j) => ({
      u: (s.w * (j + 0.5)) / n,
      r: (s.w / n) * 0.375,
      threshold,
      spring,
      rise,
    }));
    openings(f, s, p, base, top, tier, 0.58);
    if (tier >= 2) ledge(f, 'trim', s, 0, s.w, top - 0.34, top - 0.16, -0.13, 0.2);
  }
}
export function buildOviedoLevel(out, level) {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error('Unknown Oviedo Cathedral LOD ' + level);
  const f = writer(out);
  chapelVolumes(f, out, tier);
  nave(f, out, tier);
  portico(f, out, tier);
  tower(f, out, tier);
  cloister(f, out, tier);
}
export const buildOviedoSkyline = (out) => buildOviedoLevel(out, 'skyline');
export const buildOviedoDistrict = (out) => buildOviedoLevel(out, 'district');
export const buildOviedoStreet = (out) => buildOviedoLevel(out, 'street');
export const buildOviedoCloseup = (out) => buildOviedoLevel(out, 'closeup');
