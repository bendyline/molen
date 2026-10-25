/** Complete Zhanqiao deck and Huilan Pavilion, original native perimeters and CC0 exterior controls. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ww/wwm/zhanqiao_pier/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2;
const C = {
    stone: rgb('b7b6a7'),
    white: rgb('dddace'),
    roof: rgb('d39947'),
    paint: rgb('8f3731'),
    glass: rgb('46575b'),
    iron: rgb('625341'),
  },
  teal = rgb('3d7c7a'),
  blue = rgb('3c7081'),
  gold = rgb('c8a44b');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  white: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.62, metallic: 0 },
  paint: { slot: 'trim', localRef: ref, roughness: 0.84, metallic: 0 },
  glass: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.44, metallic: 0.06 },
  iron: { slot: 'trim', localRef: 'palette:#fffefe', roughness: 0.67, metallic: 0.32 },
};
function tri(o, s, ps, h, col = C[s]) {
  const p = ps.map((p) => p.map(Math.fround)),
    n = cross(
      p[1].map((v, i) => v - p[0][i]),
      p[2].map((v, i) => v - p[0][i]),
    );
  if (Math.hypot(...n) < 1e-9) return;
  if (h && n.reduce((a, v, i) => a + v * h[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1] + p[2]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true, col = C[s]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function shell(o, s, a, b, y0, y1, col = C[s]) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      dx = a[j][0] - a[i][0],
      dz = a[j][1] - a[i][1],
      area = a.reduce(
        (v, p, k) => v + p[0] * a[(k + 1) % a.length][1] - a[(k + 1) % a.length][0] * p[1],
        0,
      ),
      h = area > 0 ? [dz, 0, -dx] : [-dz, 0, dx];
    Q(
      o,
      s,
      [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      h,
      col,
    );
  }
}
function prism(o, s, p, y0, y1, col = C[s]) {
  shell(o, s, p, p, y0, y1, col);
  cap(o, s, p, y0, false, col);
  cap(o, s, p, y1, true, col);
}
function scale(p, k) {
  return p.map((p) => p.map((v) => v * k));
}
function rect(x, z, w, l) {
  return [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
}
function clip(p, z, less) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      aa = less ? a[1] <= z : a[1] >= z,
      bb = less ? b[1] <= z : b[1] >= z;
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  }
  return out;
}
function circle(x, z, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i / n) * tau),
    z + r * Math.sin((i / n) * tau),
  ]);
}
function round(o, s, x, z, prof, n, col = C[s]) {
  for (let j = 1; j < prof.length; j++)
    shell(
      o,
      s,
      circle(x, z, prof[j - 1][1], n),
      circle(x, z, prof[j][1], n),
      prof[j - 1][0],
      prof[j][0],
      col,
    );
  cap(o, s, circle(x, z, prof[0][1], n), prof[0][0], false, col);
  cap(o, s, circle(x, z, prof.at(-1)[1], n), prof.at(-1)[0], true, col);
}
const B = (o, s, a, b, w, h = w, col = C[s]) => beam(o, s, a, b, w, h, col);
function span(z) {
  const xs = [];
  for (let i = 0; i < plan.outline.length; i++) {
    const a = plan.outline[i],
      b = plan.outline[(i + 1) % plan.outline.length];
    if ((a[1] <= z && b[1] > z) || (b[1] <= z && a[1] > z))
      xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
  }
  return [Math.min(...xs), Math.max(...xs)];
}
function deck(o, d) {
  const p = plan.outline;
  prism(o, 'stone', p, -0.35, 0.25);
  prism(o, 'stone', clip(p, -155, true), -3.7, -0.35);
  prism(o, 'stone', clip(p, -15, false), -3.7, -0.35);
  for (let z = -151; z < -18; z += 8) {
    const [a, b] = span(z);
    if (d === 0) {
      for (const xx of [a + 1, b - 1]) {
        const q = [
          [xx - 0.325, -6.4, z],
          [xx + 0.325, -6.4, z],
          [xx + 0.325, -0.35, z],
          [xx - 0.325, -0.35, z],
        ];
        Q(o, 'stone', q, [0, 0, 1]);
        Q(o, 'stone', q, [0, 0, -1]);
      }
    } else {
      B(o, 'stone', [a + 0.35, -0.85, z], [b - 0.35, -0.85, z], 0.7, 0.8);
      for (const xx of [a + 1, b - 1]) prism(o, 'stone', rect(xx, z, 0.65, 0.85), -6.4, -0.45);
    }
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (Math.min(a[1], b[1]) < -377) continue;
    if (d === 0) {
      Q(
        o,
        'paint',
        [
          [a[0], 0.45, a[1]],
          [b[0], 0.45, b[1]],
          [b[0], 1.3, b[1]],
          [a[0], 1.3, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        blue,
      );
      continue;
    }
    for (const y of [0.6, 1.35]) {
      if (d === 1) {
        const q = [
          [a[0], y - 0.03, a[1]],
          [b[0], y - 0.03, b[1]],
          [b[0], y + 0.03, b[1]],
          [a[0], y + 0.03, a[1]],
        ];
        Q(o, 'paint', q, [b[1] - a[1], 0, a[0] - b[0]], blue);
        Q(o, 'paint', q, [-(b[1] - a[1]), 0, -(a[0] - b[0])], blue);
      } else B(o, 'paint', [a[0], y, a[1]], [b[0], y, b[1]], 0.055, 0.055, blue);
    }
    const count = Math.max(1, Math.ceil(len / (d === 3 ? 2.7 : 5.4)));
    for (let j = 0; j <= count; j++) {
      const t = j / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (d === 3) B(o, 'paint', [x, 0.25, z], [x, 1.4, z], 0.075, 0.075, blue);
      else {
        const q = [
          [x - 0.035, 0.25, z],
          [x + 0.035, 0.25, z],
          [x + 0.035, 1.4, z],
          [x - 0.035, 1.4, z],
        ];
        Q(o, 'paint', q, [0, 0, 1], blue);
        Q(o, 'paint', q, [0, 0, -1], blue);
      }
      if (d === 3 && j < count) {
        const t2 = (j + 0.5) / count;
        B(
          o,
          'paint',
          [a[0] + (b[0] - a[0]) * t2, 0.3, a[1] + (b[1] - a[1]) * t2],
          [a[0] + (b[0] - a[0]) * t2, 1.35, a[1] + (b[1] - a[1]) * t2],
          0.035,
          0.035,
          blue,
        );
      }
    }
  }
  for (const [x, z] of [
    [24, -11.5],
    [-24, -10],
    [0.2, 11.5],
  ])
    round(
      o,
      'stone',
      x,
      z,
      [
        [-0.35, 1.05],
        [0.95, 1.05],
        [1.05, 1.15],
      ],
      d === 0 ? 6 : d === 1 ? 8 : 16,
    );
}
function globe(o, x, y, z, d) {
  if (d < 3) {
    const ring = circle(x, z, 0.21, 4);
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4];
      tri(
        o,
        'white',
        [
          [a[0], y + 0.22, a[1]],
          [b[0], y + 0.22, b[1]],
          [x, y + 0.67, z],
        ],
        [a[0] - x, 0, a[1] - z],
      );
      tri(
        o,
        'white',
        [
          [a[0], y + 0.22, a[1]],
          [x, y, z],
          [b[0], y + 0.22, b[1]],
        ],
        [a[0] - x, 0, a[1] - z],
      );
    }
    return;
  }
  round(
    o,
    'white',
    x,
    z,
    [
      [y, 0.13],
      [y + 0.15, 0.21],
      [y + 0.5, 0.18],
      [y + 0.67, 0.07],
    ],
    6,
  );
  round(
    o,
    'iron',
    x,
    z,
    [
      [y - 0.08, 0.14],
      [y, 0.2],
    ],
    4,
  );
}
function lamp(o, x, z, d) {
  if (d === 0) {
    const p = rect(x, z, 0.15, 0.15);
    shell(o, 'white', p, p, 0.25, 5.9);
    return;
  }
  if (d < 3) {
    round(
      o,
      'white',
      x,
      z,
      [
        [0.25, 0.13],
        [4.65, 0.1],
      ],
      4,
    );
    round(
      o,
      'iron',
      x,
      z,
      [
        [4.5, 0.2],
        [5.5, 0.09],
      ],
      4,
    );
    if (d === 1) {
      globe(o, x, 6.5, z, 1);
      return;
    }
  }
  const n = 8;
  if (d === 3) {
    round(
      o,
      'white',
      x,
      z,
      [
        [0.25, 0.12],
        [0.55, 0.17],
        [4.6, 0.1],
      ],
      n,
    );
    round(
      o,
      'iron',
      x,
      z,
      [
        [4.45, 0.17],
        [4.7, 0.24],
        [4.9, 0.17],
        [5.5, 0.09],
      ],
      n,
    );
  }
  const items = [
    [0, 6.5],
    [0, 5.5],
    [-0.93, 5.75],
    [0.93, 5.75],
    [-0.58, 4.95],
    [0.58, 4.95],
  ];
  for (const [xx, y] of items) {
    if (xx) {
      const p = [
        [x, 4.9, z],
        [x + xx * 0.45, 4.75, z],
        [x + xx * 0.9, 5.03, z],
        [x + xx, y, z],
      ];
      for (let k = 1; k < p.length; k++) {
        if (d === 3) B(o, 'iron', p[k - 1], p[k], 0.09, 0.09);
        else {
          const a = p[k - 1],
            b = p[k],
            q = [
              [a[0], a[1] - 0.04, a[2]],
              [b[0], b[1] - 0.04, b[2]],
              [b[0], b[1] + 0.04, b[2]],
              [a[0], a[1] + 0.04, a[2]],
            ];
          Q(o, 'iron', q, [0, 0, 1]);
          Q(o, 'iron', q, [0, 0, -1]);
        }
      }
    }
    globe(o, x + xx, y, z, d);
  }
}
function lamps(o, d) {
  const step = [60, 30, 15, 15][d];
  for (let z = -367; z < -19; z += step) {
    const [a, b] = span(z);
    lamp(o, a + 0.45, z, d);
    lamp(o, b - 0.45, z, d);
  }
  for (const [x, z] of [
    [23, -11.5],
    [-23, -10],
    [0.2, 10.8],
  ])
    lamp(o, x, z, d);
}
function face(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, depth = 0) => [a[0] + u[0] * x + n[0] * depth, y, a[1] + u[1] * x + n[1] * depth],
  };
}
function rectFace(o, f, s, x, y, w, h, depth, col = C[s]) {
  Q(
    o,
    s,
    [
      f.p(x - w / 2, y, depth),
      f.p(x + w / 2, y, depth),
      f.p(x + w / 2, y + h, depth),
      f.p(x - w / 2, y + h, depth),
    ],
    [f.n[0], 0, f.n[1]],
    col,
  );
}
function body(o, d) {
  const lower = scale(plan.pavilion, 0.58),
    upper = scale(plan.pavilion, 0.64),
    col = scale(plan.pavilion, 0.83);
  prism(o, 'stone', scale(plan.pavilion, 0.89), 0.25, 0.52);
  prism(o, 'paint', lower, 0.52, 3.65);
  prism(o, 'paint', upper, 5.95, 8.9);
  for (const [p, y0, y1] of [
    [lower, 0.9, 3.3],
    [upper, 6.25, 8.6],
  ]) {
    for (let i = 0; i < p.length; i++) {
      const f = face(p[i], p[(i + 1) % p.length]);
      const sign =
        f.n[0] * ((p[i][0] + p[(i + 1) % p.length][0]) / 2) +
        f.n[1] * ((p[i][1] + p[(i + 1) % p.length][1]) / 2);
      if (sign < 0) {
        f.n[0] *= -1;
        f.n[1] *= -1;
      }
      rectFace(o, f, 'glass', f.len / 2, y0, f.len - 0.45, y1 - y0, 0.035);
      if (d === 1) {
        for (let j = 0; j < 3; j++)
          rectFace(o, f, 'paint', (f.len * (j + 1)) / 4, y0, 0.12, y1 - y0, 0.075);
      }
      if (d > 1) {
        for (const y of [y0, y0 + (y1 - y0) / 2, y1])
          B(o, 'paint', f.p(0.18, y, 0.06), f.p(f.len - 0.18, y, 0.06), 0.09, 0.09);
        const count = d === 1 ? 3 : 6;
        for (let j = 0; j <= count; j++)
          B(
            o,
            'paint',
            f.p(0.2 + ((f.len - 0.4) * j) / count, y0, 0.07),
            f.p(0.2 + ((f.len - 0.4) * j) / count, y1, 0.07),
            0.09,
            0.09,
          );
      }
    }
  }
  if (d > 0) {
    for (let i = 0; i < col.length; i++) {
      const a = col[i],
        b = col[(i + 1) % col.length];
      for (const t of [0, 0.5]) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        if (d < 3) {
          round(
            o,
            'white',
            x,
            z,
            [
              [0.52, 0.2],
              [4.0, 0.2],
            ],
            6,
          );
          continue;
        }
        round(
          o,
          'white',
          x,
          z,
          [
            [0.52, 0.24],
            [0.72, 0.21],
            [3.35, 0.16],
            [3.55, 0.24],
            [4.0, 0.24],
          ],
          d === 3 ? 12 : 8,
        );
      }
    }
    // Original geometric color bands suggest the bracket work without copying its painted artwork.
    for (const [k, y] of [
      [0.84, 3.55],
      [0.66, 8.55],
    ]) {
      const p = scale(plan.pavilion, k);
      shell(o, 'paint', p, p, y, y + 0.3, teal);
      for (let i = 0; i < p.length; i++) {
        const f = face(p[i], p[(i + 1) % p.length]);
        for (let j = 0; j < (d === 3 ? 4 : d === 2 ? 2 : 1); j++) {
          const x = (f.len * (j + 0.5)) / (d === 3 ? 4 : d === 2 ? 2 : 1);
          rectFace(o, f, 'paint', x, y + 0.06, 0.35, 0.15, 0.045, gold);
          if (d > 1)
            B(o, 'paint', f.p(x - 0.18, y - 0.22), f.p(x + 0.18, y + 0.03), 0.1, 0.13, teal);
        }
      }
    }
  }
  if (d > 1) {
    const f = face(upper[0], upper[1]);
    rectFace(o, f, 'paint', f.len / 2, 6.1, 0.7, 1.45, 0.11, blue);
    for (const x of [f.len / 2 - 0.4, f.len / 2 + 0.4])
      B(o, 'paint', f.p(x, 6.1, 0.14), f.p(x, 7.55, 0.14), 0.07, 0.07, gold);
  }
}
function roofPoint(p, side, u, t, lower) {
  const a = p[side],
    b = p[(side + 1) % p.length],
    k = lower ? 1 - 0.38 * t : 1 - 0.97 * t,
    x = (a[0] + (b[0] - a[0]) * u) * k,
    z = (a[1] + (b[1] - a[1]) * u) * k,
    corner = Math.pow(Math.abs(2 * u - 1), 4),
    y =
      (lower ? 3.8 : 9) +
      (lower ? 2.3 : 4.4) * Math.pow(t, lower ? 1.5 : 1.25) +
      (lower ? 0.5 : 0.65) * corner * (1 - t) * (1 - t);
  return [x, y, z];
}
function roof(o, d, lower) {
  const p = plan.roofs.find((r) => r.mappedHeight === (lower ? 5 : 10)).outline,
    n = [1, 2, 5, 8][d],
    ts = d === 0 ? [0, 1] : [0, 0.18, 0.4, 0.68, 1];
  cap(o, 'paint', scale(p, 0.66), (lower ? 3.8 : 9) - 0.18, false, teal);
  for (let s = 0; s < p.length; s++) {
    for (let i = 0; i < n; i++)
      for (let j = 1; j < ts.length; j++) {
        const ps = [
          roofPoint(p, s, i / n, ts[j - 1], lower),
          roofPoint(p, s, (i + 1) / n, ts[j - 1], lower),
          roofPoint(p, s, (i + 1) / n, ts[j], lower),
          roofPoint(p, s, i / n, ts[j], lower),
        ];
        Q(o, 'roof', ps, [0, 1, 0]);
      }
    for (let i = 0; i < n; i++) {
      const a = roofPoint(p, s, i / n, 0, lower),
        b = roofPoint(p, s, (i + 1) / n, 0, lower);
      Q(
        o,
        'paint',
        [
          [a[0] * 0.66, (lower ? 3.8 : 9) - 0.18, a[2] * 0.66],
          [b[0] * 0.66, (lower ? 3.8 : 9) - 0.18, b[2] * 0.66],
          [b[0], b[1] - 0.2, b[2]],
          [a[0], a[1] - 0.2, a[2]],
        ],
        [0, -1, 0],
        teal,
      );
      Q(
        o,
        'paint',
        [[a[0], a[1] - 0.2, a[2]], [b[0], b[1] - 0.2, b[2]], b, a],
        [a[0], 0, a[2]],
        teal,
      );
    }
    if (d === 3) {
      const len = Math.hypot(
          p[(s + 1) % p.length][0] - p[s][0],
          p[(s + 1) % p.length][1] - p[s][1],
        ),
        count = Math.round(len / (d === 3 ? 0.3 : 0.6));
      for (let i = 0; i <= count; i++) {
        const u = i / count,
          side = [p[(s + 1) % p.length][0] - p[s][0], 0, p[(s + 1) % p.length][1] - p[s][1]],
          l = Math.hypot(...side),
          v = side.map((v) => (v / l) * 0.055);
        for (let j = 1; j < ts.length; j++) {
          const a = roofPoint(p, s, u, ts[j - 1], lower),
            b = roofPoint(p, s, u, ts[j], lower);
          for (const sign of [-1, 1])
            Q(
              o,
              'roof',
              [
                a.map((v2, k) => v2 + sign * v[k]),
                [a[0], a[1] + 0.07, a[2]],
                [b[0], b[1] + 0.07, b[2]],
                b.map((v2, k) => v2 + sign * v[k]),
              ],
              [0, 1, 0],
            );
        }
      }
    }
    if (d > 1) {
      for (let j = 1; j < ts.length; j++) {
        const a = roofPoint(p, s, 0, ts[j - 1], lower),
          b = roofPoint(p, s, 0, ts[j], lower);
        B(o, 'roof', [a[0], a[1] + 0.13, a[2]], [b[0], b[1] + 0.13, b[2]], 0.16, 0.2);
      }
      if (d === 3) {
        const tip = roofPoint(p, s, 0, 0, lower);
        for (let k = 0; k < 3; k++)
          B(
            o,
            'roof',
            [tip[0] * (1 - 0.035 * k), tip[1] + 0.15, tip[2] * (1 - 0.035 * k)],
            [tip[0] * (1 - 0.035 * k), tip[1] + 0.37 + k * 0.025, tip[2] * (1 - 0.035 * k)],
            0.1,
            0.1,
          );
      }
    }
  }
}
function pavilion(o, d) {
  body(o, d);
  roof(o, d, true);
  roof(o, d, false);
  round(
    o,
    'roof',
    0,
    0,
    [
      [13.35, 0.33],
      [13.65, 0.48],
      [13.85, 0.34],
      [14.25, 0.28],
      [14.4, 0.12],
    ],
    d === 0 ? 6 : 12,
  );
  if (d > 0) B(o, 'iron', [0, 14.3, 0], [0, 16.1, 0], 0.025, 0.025);
}
function build(o, _f, d = 3) {
  deck(o, d);
  pavilion(o, d);
  lamps(o, d);
}
export const zhanqiaoSkyline = (o, f) => build(o, f, 0);
export const zhanqiaoDistrict = (o, f) => build(o, f, 1);
export const zhanqiaoStreet = (o, f) => build(o, f, 2);
export const zhanqiaoPierModel = {
  id: 'zhanqiao_pier',
  key: 'zhanqiao_pier',
  recipe: 'structure-zhanqiao-pier.mjs',
  cell: 'ww/wwm',
  title: 'Zhanqiao Pier',
  category: 'pier-pavilion',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native Zhanqiao Pier: stone retained shore approach, open southern bridge/discrete supports and enlarged stone head, two-storey octagonal Huilan Pavilion with swept orange-glazed double roofs, finial/red lattice/white open lower colonnade/teal bracket bands, blue perimeter rails and six-light ornamental white/bronze posts. Original native pier/roof plans, photographic estimated sections, no natural sea/shore or city/visitors/signs.',
  camera: [52, 34, 62],
  lookAt: [0, 4, -14],
  portableGroundY: -6.8,
  mediumFiContext: { scale: 1.2, groundY: -6.8 },
  qaCameras: [
    {
      name: 'complete-native-pier-retained-approach-and-open-bridge',
      reviewLod: 'skyline',
      position: [240, 210, -220],
      lookAt: [0, 0, -190],
    },
    {
      name: 'double-swept-roofs-open-colonnade-and-lattice',
      position: [25, 17, -27],
      lookAt: [0, 6, 0],
    },
    {
      name: 'open-southern-bridge-stone-head-rails-and-lanterns',
      position: [19, 7, -78],
      lookAt: [0, -1, -67],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: plan.geometryBasis,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-zhanqiao-pier.mjs',
    level: 'skyline',
    export: 'zhanqiaoSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'zhanqiaoDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'zhanqiaoStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Current permanent architectural form interpreted from exact2009own-photographerCC0original after Qualla-first inspection: original image bytes, matching2018FlickreviewR2transfer and present primary ImageObjectCC0release are saved; immutableNSID matches both primary creator records.1914pre-pavilion imagery, unknown historic sources,1988aerial/1931plans, attribution-licensed modern images and unrelated subjects are unused. No photographic textures or copied painted designs/text/brands/visitors.',
    'Exact pier and three octagonal roof/building ways are retained. Roof-height5/10mmap tags are coarse estimates, not survey; swept eave/ridge sections and finial reach14.4mplus thin lightning rod16.1mabove shore datum by photographic interpretation. White16column portico, red/dark lattice windows, teal/gold abstract bracket bands and original symbolic ridge ornaments are representative. Hidden elevations/paintings/inscriptions and precise tile/column/lantern census are not claimed.',
    'Northern retained approach, southern open sea bridge and enlarged stone head are all modeled. The150mapproximate open span has discrete8mbents/two legs, not a continuous solid wall. Foundation depths/caps, pier-deck level, head masonry/turrets/access-stair details, blue rail subdivisions and six-light lamp spacing/sections are photographic medium-fi estimates. Far LODs simplify supports/roof curvature/windows and group lamp repeats; nominal440mprose does not override the roughly400mnative footprint.',
    'Temporary2026conservation closure/scaffolding is excluded; model represents permanent extant heritage architecture, not a live worksite. Nearby lighthouse/museum/shore promenade/buildings, natural water/beach/earth/vegetation, banners/boats/visitors and pavilion exhibitions are outside scope.',
    'Fixed paved northern shore approach precedes terrain acquisition. Deck top.25mrelative to shore datum, modeled lower supports to-6.4m; these are bounded structural estimates, not surveyed tidal/seabed elevations. Raw terrain preserved without flattening/fitting; isolated inspection groundY-6.8does not certify precise host water/ground contact. No natural sea/shore slab.',
  ],
};
