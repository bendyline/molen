/** Gateway of India: original three-bay waterfront arch and its own architectural base. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import site from '../../../content/worldgen/source/places/te/te7/gateway_of_india/site-construction-controls.json' with {
  type: 'json',
};
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('b1a184'),
  light = rgb('c4b597'),
  pale = rgb('d1c7ad'),
  brown = rgb('96866c'),
  roofColor = rgb('c7c3b0');
function paving(o, ring, y, color, up = true) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]);
    o.addTriangle(
      'stone',
      ref,
      p,
      [0, up ? 1 : -1, 0],
      p.map(([x, , z]) => [x, z]),
      color,
    );
  }
}
function quayPrism(o, ring, bottom, top, color) {
  paving(o, ring, top, color);
  paving(o, ring, bottom, color, false);
  const sign = Math.sign(
    ring.reduce((sum, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      normal = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])];
    quad(
      o,
      'stone',
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      normal,
      color,
    );
  }
}
function waterfront(o, d) {
  const quay = site.quay,
    stair = site.stair,
    ring = quay.outline;
  quayPrism(o, ring, quay.masonryBase, quay.pavingLevel, stone);
  // The central projection in the shoreline vectors is a sea-access flight.
  // Its solid risers replace the old short stair stub beside the monument wall.
  const [ur, lr, ll, ul] = stair.outline,
    count = d > 1 ? stair.risers : d ? 10 : 5,
    at = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 1) / count,
      top = stair.upperLevel + (stair.lowerLevel - stair.upperLevel) * t1;
    quayPrism(
      o,
      [at(ur, lr, t0), at(ur, lr, t1), at(ul, ll, t1), at(ul, ll, t0)],
      quay.masonryBase,
      top,
      stone,
    );
  }
  if (d) {
    for (let i = 1; i < ring.length - 2; i++) {
      // Leave the stair mouth and inland return open; only actual quay edges get coping.
      const a = ring[i],
        b = ring[i + 1];
      if (Math.abs(a[0] - ur[0]) < 0.01 && Math.abs(b[0] - ul[0]) < 0.01) continue;
      beam(
        o,
        'trim',
        [a[0], quay.copingHeight / 2, a[1]],
        [b[0], quay.copingHeight / 2, b[1]],
        0.55,
        quay.copingHeight,
        light,
      );
      if (d > 1)
        beam(
          o,
          'trim',
          [a[0], quay.copingHeight + 0.045, a[1]],
          [b[0], quay.copingHeight + 0.045, b[1]],
          0.65,
          0.09,
          pale,
        );
    }
  }
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function panel(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function round(o, s, x, z, y0, y1, r0, r1, c, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    quad(
      o,
      s,
      [
        [x + r0 * Math.cos(a), y0, z + r0 * Math.sin(a)],
        [x + r0 * Math.cos(b), y0, z + r0 * Math.sin(b)],
        [x + r1 * Math.cos(b), y1, z + r1 * Math.sin(b)],
        [x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a)],
      ],
      [Math.cos((a + b) / 2), (r0 - r1) / (y1 - y0), Math.sin((a + b) / 2)],
      c,
    );
  }
}
function profile(half, spring, apex, n) {
  const c = (half * half - (apex - spring) ** 2) / (2 * half),
    r = half - c,
    top = Math.atan2(apex - spring, -c),
    left = [];
  for (let j = 0; j <= n; j++) {
    const a = (top * j) / n;
    left.push([-(c + r * Math.cos(a)), spring + r * Math.sin(a)]);
  }
  return [
    ...left,
    ...left
      .slice(0, -1)
      .reverse()
      .map(([x, y]) => [-x, y]),
  ];
}
function archMass(o, cx, z0, z1, half, width, spring, apex, top, y0, d, hall = false) {
  const n = d === 0 ? (hall ? 2 : 3) : d === 1 ? 6 : d === 2 ? 10 : 16,
    p = profile(half, spring, apex, n),
    depth = 1.8;
  for (const sign of [-1, 1]) {
    if (hall) {
      for (const z of [z0 + depth / 2, z1 - depth / 2])
        B(
          o,
          'stone',
          cx + (sign * (width + half)) / 2,
          y0,
          z,
          width - half,
          top - y0,
          depth,
          stone,
        );
      B(
        o,
        'stone',
        cx + (sign * (width + 7.3)) / 2,
        y0,
        (z0 + z1) / 2,
        width - 7.3,
        top - y0,
        z1 - z0 - depth * 2,
        stone,
      );
    } else
      B(
        o,
        'stone',
        cx + (sign * (width + half)) / 2,
        y0,
        (z0 + z1) / 2,
        width - half,
        top - y0,
        z1 - z0,
        stone,
      );
  }
  const faces = hall
      ? [
          [z1, [0, 0, 1]],
          [z1 - depth, [0, 0, -1]],
          [z0, [0, 0, -1]],
          [z0 + depth, [0, 0, 1]],
        ]
      : [
          [z1, [0, 0, 1]],
          [z0, [0, 0, -1]],
        ],
    vaults = hall
      ? [
          [z0, z0 + depth],
          [z1 - depth, z1],
        ]
      : [[z0, z1]];
  for (let j = 0; j < p.length - 1; j++) {
    const a = p[j],
      b = p[j + 1];
    for (const [z, norm] of faces)
      quad(
        o,
        'stone',
        [
          [cx + a[0], a[1], z],
          [cx + b[0], b[1], z],
          [cx + b[0], top, z],
          [cx + a[0], top, z],
        ],
        norm,
        stone,
      );
    for (const [za, zb] of vaults)
      quad(
        o,
        'stone',
        [
          [cx + a[0], a[1], za],
          [cx + b[0], b[1], za],
          [cx + b[0], b[1], zb],
          [cx + a[0], a[1], zb],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
        stone,
      );
  }
  B(o, 'stone', cx, top - 0.12, (z0 + z1) / 2, width * 2, 0.12, z1 - z0, stone);
}
function line(o, a, b, w, c = light, s = 'trim') {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    x = (-dy * w) / len / 2,
    y = (dx * w) / len / 2;
  quad(
    o,
    s,
    [
      [a[0] + x, a[1] + y, a[2]],
      [b[0] + x, b[1] + y, b[2]],
      [b[0] - x, b[1] - y, b[2]],
      [a[0] - x, a[1] - y, a[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function archRing(o, half, spring, apex, y0, d, width = 0.22) {
  const p = profile(half, spring, apex, d === 0 ? 3 : d === 1 ? 6 : d === 2 ? 10 : 16);
  for (let j = 0; j < p.length - 1; j++) line(o, [...p[j], 0.05], [...p[j + 1], 0.05], width);
  for (const sign of [-1, 1]) {
    if (d < 2) panel(o, 'trim', sign * half, y0, 0.05, width, spring - y0, light);
    else B(o, 'trim', sign * half, y0, 0.03, width, spring - y0, 0.22, light);
  }
  if (d > 1) {
    const pp = profile(half + 0.25, spring, apex + 0.27, 12);
    for (let j = 0; j < pp.length - 1; j++)
      line(o, [...pp[j], 0.07], [...pp[j + 1], 0.07], 0.055, brown);
  }
}
function rose(o, x, y, z, r, d) {
  if (d < 2) return;
  const n = d === 2 ? 8 : 12;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2,
      b = ((j + 1) / n) * Math.PI * 2;
    line(
      o,
      [x + r * Math.cos(a), y + r * Math.sin(a), z],
      [x + r * Math.cos(b), y + r * Math.sin(b), z],
      r * 0.13,
      light,
    );
  }
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * Math.PI * 2;
    line(
      o,
      [x, y, z + 0.01],
      [x + r * 0.75 * Math.cos(a), y + r * 0.75 * Math.sin(a), z + 0.01],
      r * 0.11,
      light,
    );
  }
}
function jali(o, d) {
  const half = 3.0,
    spring = 7.05,
    apex = 10.75,
    inner = profile(1.04, 3.4, 4.8, 12),
    outer = profile(half, spring, apex, 24),
    ceiling = (x, pts) => {
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j],
          b = pts[j + 1];
        if (x >= a[0] - 1e-6 && x <= b[0] + 1e-6)
          return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
      }
      return -0.5;
    };
  const step = d === 1 ? 1.0 : d === 2 ? 0.72 : 0.53,
    w = d === 1 ? 0.14 : 0.095;
  const allowed = (x, y) =>
    Math.abs(x) < half - 0.1 &&
    y > 0.4 &&
    y < ceiling(x, outer) - 0.1 &&
    !(Math.abs(x) < 1.2 && y < ceiling(Math.max(-1.04, Math.min(1.04, x)), inner) + 0.22);
  for (let x = -2.8; x < 2.9; x += step)
    for (let y = 0.65; y < 10.6; y += step) {
      if (!allowed(x, y) || !allowed(x + step * 0.6, y + step * 0.6)) continue;
      const xx = x + step * 0.3,
        yy = y + step * 0.3;
      panel(o, 'trim', xx, yy - step * 0.38, 0.06, w, step * 0.76, light);
      panel(o, 'trim', xx, yy, 0.06, step * 0.76, w, light);
      if (d > 1)
        for (const sign of [-1, 1])
          line(
            o,
            [xx - step * 0.32, yy + sign * step * 0.32, 0.065],
            [xx + step * 0.32, yy - sign * step * 0.32, 0.065],
            w * 0.64,
            light,
          );
    }
  archRing(o, 1.04, 3.4, 4.8, 0.4, d, 0.18);
  archRing(o, 3.0, 7.05, 10.75, 0.4, d, 0.25);
  for (const y of [5.5, 5.7]) B(o, 'trim', 0, y, 0.05, 6.1, 0.12, 0.23, light);
  for (const x of [-1.28, 1.28]) B(o, 'trim', x, 0.4, 0.03, 0.18, 5.0, 0.25, light);
  for (const x of [-2.6, 2.6]) rose(o, x, 10.4, 0.08, 0.22, d);
}
function oct(o, x, z, levels, d, c = stone, s = 'stone') {
  const n = d === 0 ? 4 : 8;
  for (let k = 0; k < levels.length - 1; k++) {
    const [y, r] = levels[k],
      [yy, rr] = levels[k + 1];
    round(o, s, x, z, y, yy, r, rr, c, n);
  }
}
function turret(o, x, z, d) {
  const base =
    d === 0
      ? [
          [-1.0, 1.4],
          [20.6, 1.4],
        ]
      : [
          [-1, 1.9],
          [0.4, 1.9],
          [0.65, 2.05],
          [0.85, 1.85],
          [1.1, 2.0],
          [1.3, 1.6],
          [2.0, 1.6],
          [2.1, 1.8],
          [2.35, 1.55],
          [11.6, 1.55],
          [11.8, 1.95],
          [12.1, 1.95],
          [12.3, 1.6],
          [15.8, 1.6],
          [16.0, 1.9],
          [16.25, 1.9],
          [16.45, 1.42],
          [20.6, 1.42],
        ];
  const baseLevels =
    d === 1
      ? [
          [-1, 1.8],
          [0.6, 1.8],
          [11.6, 1.5],
          [12.2, 1.9],
          [12.5, 1.4],
          [20.6, 1.4],
        ]
      : base;
  oct(
    o,
    x,
    z,
    baseLevels.map(([y, r]) => [y, Math.min(2.45, r * 1.4)]),
    d,
  );
  oct(
    o,
    x,
    z,
    [
      [20.6, 2.3],
      [20.85, 2.3],
      [21.0, 1.28],
    ],
    d,
    light,
    'trim',
  );
  if (d === 0)
    oct(
      o,
      x,
      z,
      [
        [21, 1.16],
        [23.65, 1.16],
      ],
      d,
    );
  else {
    const r = 1.16;
    const sides = d === 1 ? 4 : 8;
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / sides,
        q = facing(o, Math.PI / 2 - a, x + Math.cos(a) * r, z + Math.sin(a) * r),
        w = 2 * r * Math.tan(Math.PI / sides);
      for (const sign of [-1, 1])
        B(q, 'stone', (sign * (w + 0.42)) / 4, 21.0, 0, (w - 0.42) / 2, 2.55, 0.22, stone);
      const p = profile(0.21, 22.65, 23.16, d === 1 ? 3 : 5);
      for (let j = 0; j < p.length - 1; j++)
        quad(
          q,
          'stone',
          [
            [p[j][0], p[j][1], 0.12],
            [p[j + 1][0], p[j + 1][1], 0.12],
            [p[j + 1][0], 23.6, 0.12],
            [p[j][0], 23.6, 0.12],
          ],
          [0, 0, 1],
          stone,
        );
      if (d > 1) {
        for (const y of [21.5, 21.9, 22.3, 22.7]) {
          panel(q, 'trim', 0, y, 0.14, 0.4, 0.06, light);
          if (d > 2)
            for (const sign of [-1, 1])
              line(q, [-0.16, y, 0.145], [0.16, y + sign * 0.23, 0.145], 0.035, light);
        }
      }
    }
  }
  if (d > 1)
    for (let j = 0; j < 8; j++) {
      const a = ((j + 0.5) * Math.PI) / 4,
        q = facing(o, Math.PI / 2 - a, x + Math.cos(a) * 2.08, z + Math.sin(a) * 2.08);
      rose(q, 0, 1.65, 0.035, 0.31, d);
    }
  const crown =
    d === 0
      ? [
          [23.6, 1.5],
          [24, 1.5],
          [25.55, 0.2],
        ]
      : [
          [23.6, 1.5],
          [23.82, 1.5],
          [24.04, 1.18],
          [24.1, 1.33],
          [24.32, 0.95],
          [24.4, 1.1],
          [24.63, 0.75],
          [24.72, 0.89],
          [24.98, 0.5],
          [25.07, 0.62],
          [25.34, 0.24],
          [25.5, 0.13],
        ];
  oct(
    o,
    x,
    z,
    d === 1
      ? [
          [23.6, 1.5],
          [24, 1.5],
          [24.15, 1.15],
          [25, 0.6],
          [25.5, 0.13],
        ]
      : crown,
    d,
    light,
    'trim',
  );
  round(o, 'trim', x, z, 25.5, 25.7, 0.17, 0.22, light, d === 0 ? 4 : 8);
  round(o, 'trim', x, z, 25.7, 25.85, 0.22, 0.08, light, d === 0 ? 4 : 8);
  if (d === 0) round(o, 'metal', x, z, 25.83, 26.05, 0.035, 0.008, rgb('6e7865'), 4);
  else beam(o, 'metal', [x, 25.83, z], [x, 26.05, z], 0.03, 0.03, rgb('6e7865'));
}
function cap(o, x, z, r, base, h, d) {
  const n = d < 2 ? 8 : d === 2 ? 24 : 32,
    k = d < 2 ? 1 : d === 2 ? 5 : 6;
  for (let j = 0; j < k; j++) {
    const a = ((j / k) * Math.PI) / 2,
      b = (((j + 1) / k) * Math.PI) / 2;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        tt = ((i + 1) / n) * Math.PI * 2,
        p = [
          x + r * Math.cos(a) * Math.cos(t),
          base + h * Math.sin(a),
          z + r * Math.cos(a) * Math.sin(t),
        ],
        q = [
          x + r * Math.cos(a) * Math.cos(tt),
          base + h * Math.sin(a),
          z + r * Math.cos(a) * Math.sin(tt),
        ];
      if (j === k - 1) {
        const v = [p, q, [x, base + h, z]];
        let normal = normalFor(...v);
        if (normal[1] < 0) normal = normal.map((v) => -v);
        o.addTriangle(
          'roof',
          ref,
          v,
          normal,
          v.map((v) => [v[0], v[2]]),
          roofColor,
        );
      } else {
        const pp = [
          p,
          q,
          [
            x + r * Math.cos(b) * Math.cos(tt),
            base + h * Math.sin(b),
            z + r * Math.cos(b) * Math.sin(tt),
          ],
          [
            x + r * Math.cos(b) * Math.cos(t),
            base + h * Math.sin(b),
            z + r * Math.cos(b) * Math.sin(t),
          ],
        ];
        let normal = normalFor(...pp);
        if (normal[1] < 0) normal = normal.map((v) => -v);
        quad(o, 'roof', pp, normal, roofColor);
      }
    }
  }
}
function cornice(o, w, ys, d) {
  const levels =
    d === 0
      ? ys.length === 4
        ? []
        : [ys[0], ys.at(-1)]
      : d === 1 && ys.length === 4
        ? [ys[0], ys.at(-1)]
        : ys;
  for (const [y, depth] of levels) {
    B(o, 'trim', 0, y, 0, w, 0.18, depth, light);
    if (d > 1) B(o, 'trim', 0, y + 0.18, 0.08, w, 0.075, depth + 0.12, pale);
  }
}
function corbels(o, w, y, d) {
  if (d < 2) return;
  const n = Math.round(w / 1.35);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i * w) / n;
    const h = y > 13 ? 1.25 : 0.78;
    B(o, 'trim', x, y, 0.26, 0.24, h, 0.52, light);
    B(o, 'trim', x, y + h, 0.33, 0.42, 0.16, 0.7, light);
    if (d > 2) {
      B(o, 'trim', x, y + h * 0.35, 0.34, 0.3, h * 0.6, 0.68, light);
      rose(o, x, y + 0.28, 0.62, 0.12, d);
    }
  }
}
function plaque(o, d) {
  B(o, 'stone', 0, 17.35, 0.06, 12.0, 2.65, 0.18, light);
  if (d === 0) return;
  for (const y of [17.42, 19.8]) B(o, 'trim', 0, y, 0.18, 11.8, 0.08, 0.1, pale);
  for (const x of [-5.9, 5.9]) B(o, 'trim', x, 17.42, 0.18, 0.08, 2.46, 0.1, pale);
  if (d > 1) for (const y of [18.05, 18.67, 19.28]) panel(o, 'trim', 0, y, 0.2, 11.7, 0.025, brown);
}
function parapet(o, w, d) {
  if (d < 2) {
    B(o, 'trim', 0, 21.05, 0, w, 0.8, 0.3, stone);
    return;
  }
  const n = Math.round(w / 0.62);
  for (let j = 0; j < n; j++) {
    const x = -w / 2 + ((j + 0.5) * w) / n,
      ww = (w / n) * 0.87;
    const p = [
      [x - ww / 2, 21.05, 0.02],
      [x + ww / 2, 21.05, 0.02],
      [x + ww * 0.46, 21.62, 0.02],
      [x, 21.9, 0.02],
      [x - ww * 0.46, 21.62, 0.02],
    ];
    o.addConvexPolygon('trim', ref, p, [0, 0, 1], (p) => [p[0], p[1]], stone);
    if (d > 2) {
      line(o, [x, 21.1, 0.04], [x, 21.73, 0.04], 0.025, brown);
    }
  }
}
export function gatewayOfIndia(o, _frame, d = 3) {
  // Three open portals; the central arch opens into a tall hall rather than a low continuous tunnel.
  archMass(o, 0, -9.1, 9.15, 4.6, 9.8, 7.2, 14.1, 21.05, -1.1, d, true);
  for (const [x, w] of [
    [-15.4, 5.75],
    [16.15, 6.35],
  ]) {
    archMass(
      o,
      x,
      -6.8,
      7.1,
      d === 0 ? 1.04 : 3.0,
      w,
      d === 0 ? 3.4 : 7.05,
      d === 0 ? 4.8 : 10.75,
      16.4,
      -1.1,
      d,
    );
    for (const a of [0, Math.PI]) {
      const q = facing(o, a, x, a === 0 ? 7.11 : -6.81);
      if (d > 0) jali(q, d);
      cornice(
        q,
        w * 2,
        [
          [11.55, 0.65],
          [12.65, 1.0],
          [13.05, 0.6],
          [15.8, 0.7],
          [16.35, 1.15],
        ],
        d,
      );
      corbels(q, w * 2 - 1.0, 11.7, d);
      if (d > 1) {
        for (const xx of [-3.7, -1.85, 0, 1.85, 3.7]) {
          rose(q, xx, 14.7, 0.34, 0.45, d);
          for (const sign of [-1, 1])
            line(
              q,
              [xx - 0.5, 14.7 - sign * 0.5, 0.3],
              [xx + 0.5, 14.7 + sign * 0.5, 0.3],
              0.08,
              light,
            );
        }
      }
    }
    B(o, 'roof', x, 16.4, 0.15, w * 2, 0.2, 13.9, roofColor);
    cap(o, x, 0.15, 5.45, 16.6, 0.78, d);
    for (const a of [-Math.PI / 2, Math.PI / 2]) {
      const xx = x + Math.sin(a) * w,
        q = facing(o, a, xx, 0.15);
      cornice(
        q,
        13.9,
        [
          [11.55, 0.65],
          [12.65, 1],
          [15.8, 0.7],
          [16.35, 1.15],
        ],
        d,
      );
      if (d > 1) {
        for (const yy of [4.0, 7.0, 10.5]) panel(q, 'trim', 0, yy, 0.1, 13.5, 0.08, light);
        for (const zz of [-4, 0, 4]) rose(q, zz, 14.7, 0.15, 0.45, d);
      }
    }
  }
  for (const a of [0, Math.PI]) {
    const q = facing(o, a, 0, a === 0 ? 9.16 : -9.11);
    archRing(q, 4.6, 7.2, 14.1, 0.4, d, 0.28);
    cornice(
      q,
      19.8,
      [
        [14.65, 0.6],
        [16.25, 1.0],
        [16.8, 0.6],
        [20.45, 0.75],
        [20.9, 1.1],
      ],
      d,
    );
    corbels(q, 12.8, 14.75, d);
    plaque(q, d);
    for (const x of [-5.1, 5.1]) rose(q, x, 14.15, 0.28, 0.4, d);
    parapet(facing(q, 0, 0, 0.2), 14.5, d);
  }
  for (const sign of [-1, 1]) parapet(facing(o, (sign * Math.PI) / 2, sign * 9.35, 0), 15.4, d);
  B(o, 'roof', 0, 21.05, 0, 19.5, 0.15, 18.2, roofColor);
  cap(o, 0, 0, 7.31, 21.2, 0.85, d);
  for (const x of [-7.5, 7.5]) for (const z of [-7.7, 7.7]) turret(o, x, z, d);
  // Original monument plinth retained above its independently mapped quay.
  B(o, 'stone', 0.6, -1.25, 0.1, 45.9, 1.45, 21.0, stone);
  B(o, 'trim', 0.6, 0.2, 0.1, 46.2, 0.18, 21.3, light);
  waterfront(o, d);
}
export function gatewayOfIndiaSkyline(o) {
  gatewayOfIndia(o, undefined, 0);
}
export function gatewayOfIndiaDistrict(o) {
  gatewayOfIndia(o, undefined, 1);
}
export function gatewayOfIndiaStreet(o) {
  gatewayOfIndia(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
};
export const gatewayOfIndiaModel = {
  id: 'gateway_of_india',
  key: 'gateway_of_india',
  recipe: 'structure-gateway-of-india.mjs',
  cell: 'te/te7',
  title: 'Gateway of India',
  brief:
    'Three-bay yellow basalt waterfront gateway: tall open pointed central arch, jali-framed side doorways, four octagonal tiered turret crowns, carved piers/cornices/rosettes, upper inscription panel and lotus parapet, three shallow roof domes and own stepped base. Temporary objects and nearby buildings excluded.',
  camera: [-49, 34, 63],
  lookAt: [0, 10, 0],
  qaCameras: [
    { name: 'front', position: [0, 4.5, 62], lookAt: [0, 12, 3] },
    { name: 'front-detail', position: [-19, 15, 34], lookAt: [-1, 11, 8] },
    { name: 'back', position: [48, 31, -60], lookAt: [0, 10, -1] },
    { name: 'waterfront-platform', position: [43, 9, -48], lookAt: [0, -0.6, -19] },
    { name: 'sea-stair', position: [-14, 4, -41], lookAt: [0, -1.3, -23] },
  ],
  mediumFiContext: { scale: 0.7 },
  build: gatewayOfIndia,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Bounded physical quay placement on the retained dry-approach datum. The original shoreline vectors define the masonry deck and sea-access flight;their two openings are entirely covered by authored paving/solid stairs. Anchor,heading,original monument/base levels and all source heights are retained. Quay masonry extends below the source mean-sea-level context-2.8118;host ocean remains scene-owned. Submerged geology,tidal stage and exact civil levels are not certified.',
  groundCutout: {
    outline: site.quay.outline,
    additionalOutlines: [site.stair.outline],
    basis:
      'Mapped physical waterfront quay deck and solid sea-access flight only. No source height,monument floor,anchor,heading or dry-approach datum changes. Masonry extends below the source mean-sea-level context;no generic building pad or host-ocean mesh is embedded.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-gateway-of-india.mjs',
    level: 'skyline',
    export: 'gatewayOfIndiaSkyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'gatewayOfIndiaDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'gatewayOfIndiaStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Current exterior uses three inspected exact creator-released CC0 originals:DarshanRane2012front,AroundTheGlobe2011arch detail and Darshula2023harbor elevation. Earlier FAL/CC photographs and rights-unverified aerial imagery are excluded. Nominal26m monument scale retained;facade heights,shallow cap profiles,vaults,rear details and hidden joins are estimates. Map height tags are not measured elevations.',
    'Official48ft central-dome diameter used for the central roof control; the prose83ft apex datum is not reconciled with the shallow exterior cap seen in aerial context. Exterior cap height remains an estimate. Fine inscriptions, motifs and jali patterns are simplified native geometry.',
    'Own monument,physical immediate waterfront quay and sea stair only. Quay/stair horizontal plan follows original OSM coastline206817494. Fixed paving0,submerged masonry base-3.4,and20sea-stair risers descending to-2.65are bounded exterior estimates,not civil or tidal survey. Wider city plaza,ferry buildings/jetty,boats,people,barriers,temporary scaffolding and roof flagpole excluded. No photo pixels redistributed.',
    'Independent Terrarium terrain is unmodified and mixes coastal land/bathymetry. Physical deck/stair surfaces replace only their own modeled volumes;buried/submerged foundations are estimates and are not fitted to terrain cells. Host ocean at mean sea level is scene-owned;portable/native-ground fixtures without ocean expose submerged geometry as a diagnostic. Footprint replacement disabled. No survey,tidal-stage,exact seabed-contact or physical-device performance claim.',
  ],
};
