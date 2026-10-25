/** Taipei Guest House: original Western mansion, without its Japanese bungalow or gardens. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('d9d8d0'),
  light = rgb('eceae0'),
  dark = rgb('7d7e78'),
  slate = rgb('60636a'),
  copper = rgb('7eada0'),
  brown = rgb('98714c'),
  glass = rgb('627477');
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
function polygon(o, s, ring, y0, y1, c) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (n, p, i) => n + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      c,
    );
  }
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        c,
      );
    }
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
function column(o, x, z, y, h, d, paired = false) {
  const offsets = paired && d > 1 ? [-0.37, 0.37] : [0];
  for (const dx of offsets) {
    const xx = x + dx,
      r = paired && d <= 1 ? 0.54 : 0.26;
    if (d <= 1) {
      B(o, 'stone', xx, y, z, 0.6, h, 0.6, stone);
      continue;
    }
    if (d === 2) {
      B(o, 'stone', xx, y, z, r * 2.7, 0.2, r * 2.7, light);
      round(o, 'stone', xx, z, y + 0.2, y + h - 0.25, r, r * 0.86, light, 6);
      B(o, 'stone', xx, y + h - 0.25, z, r * 3, 0.25, r * 3, light);
      continue;
    }
    const n = d > 2 ? 12 : 6;
    B(o, 'stone', xx, y, z, r * 2.7, 0.18, r * 2.7, light);
    round(o, 'stone', xx, z, y + 0.18, y + 0.32, r * 1.2, r, light, n);
    round(o, 'stone', xx, z, y + 0.32, y + h - 0.4, r, r * 0.86, light, n);
    round(o, 'stone', xx, z, y + h - 0.4, y + h - 0.18, r * 0.9, r * 1.4, light, n);
    B(o, 'stone', xx, y + h - 0.18, z, r * 3, 0.18, r * 3, light);
    if (d > 2) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        round(
          o,
          'stone',
          xx + Math.cos(a) * r * 0.97,
          z + Math.sin(a) * r * 0.97,
          y + 0.55,
          y + h - 1.0,
          0.017,
          0.017,
          dark,
          4,
        );
      }
      for (const sign of [-1, 1])
        round(o, 'stone', xx + sign * 0.3, z, y + h - 0.4, y + h - 0.24, 0.12, 0.08, light, 8);
    }
  }
}
function rail(o, w, y, d) {
  if (d < 3) panel(o, 'stone', 0, y, 0.18, w, 0.12, stone);
  else B(o, 'stone', 0, y, 0, w, 0.12, 0.34, stone);
  B(o, 'stone', 0, y + 0.94, 0, w, 0.16, 0.42, light);
  if (d <= 1) {
    panel(o, 'stone', 0, y + 0.12, 0.02, w, 0.82, stone);
    return;
  }
  const n = Math.ceil(w / (d === 1 ? 1.1 : 0.5));
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i * w) / n;
    if (d === 1) {
      B(o, 'stone', x, y + 0.12, 0, 0.14, 0.82, 0.14, light);
      continue;
    }
    if (d === 2) {
      B(o, 'stone', x, y + 0.12, 0, 0.16, 0.82, 0.16, light);
      continue;
    }
    const sides = 8;
    round(o, 'stone', x, 0, y + 0.12, y + 0.28, 0.1, 0.16, light, sides);
    round(o, 'stone', x, 0, y + 0.28, y + 0.62, 0.16, 0.07, light, sides);
    round(o, 'stone', x, 0, y + 0.62, y + 0.94, 0.07, 0.11, light, sides);
  }
}
function archPanel(o, s, x, y, z, w, h, c, n = 10) {
  const r = w / 2,
    spring = y + h - r,
    p = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, spring, z],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    p.push([x + Math.cos(a) * r, spring + Math.sin(a) * r, z]);
  }
  o.addConvexPolygon(s, ref, p, [0, 0, 1], (p) => [p[0], p[1]], c);
}
function archTrim(o, x, y, z, w, h, d, c = light) {
  const r = w / 2,
    spring = y + h - r,
    n = d > 2 ? 14 : 8;
  if (d < 3) {
    panel(o, 'stone', x - r - 0.1, y, z + 0.09, 0.2, spring - y, c);
    panel(o, 'stone', x + r + 0.1, y, z + 0.09, 0.2, spring - y, c);
  } else {
    B(o, 'stone', x - r - 0.1, y, z, 0.2, spring - y, 0.17, c);
    B(o, 'stone', x + r + 0.1, y, z, 0.2, spring - y, 0.17, c);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      rr = r + 0.2;
    quad(
      o,
      'stone',
      [
        [x + r * Math.cos(a), spring + r * Math.sin(a), z + 0.1],
        [x + rr * Math.cos(a), spring + rr * Math.sin(a), z + 0.1],
        [x + rr * Math.cos(b), spring + rr * Math.sin(b), z + 0.1],
        [x + r * Math.cos(b), spring + r * Math.sin(b), z + 0.1],
      ],
      [0, 0, 1],
      c,
    );
  }
}
function window(o, x, y, w, h, d, arched = false) {
  if (d === 0) return;
  panel(o, 'wood', x, y, -0.006, w + 0.18, h + 0.12, brown);
  if (arched) archPanel(o, 'glass', x, y + 0.12, 0.025, w - 0.18, h - 0.18, glass, d > 2 ? 12 : 7);
  else panel(o, 'glass', x, y + 0.12, 0.025, w - 0.18, h - 0.2, glass);
  if (d > 1) {
    if (arched) archTrim(o, x, y - 0.02, 0.06, w + 0.18, h + 0.2, d);
    else {
      if (d === 2) {
        panel(o, 'stone', x - w / 2 - 0.13, y, 0.1, 0.2, h, light);
        panel(o, 'stone', x + w / 2 + 0.13, y, 0.1, 0.2, h, light);
        panel(o, 'stone', x, y + h, 0.1, w + 0.5, 0.22, light);
      } else {
        B(o, 'stone', x - w / 2 - 0.13, y, 0, 0.2, h, 0.18, light);
        B(o, 'stone', x + w / 2 + 0.13, y, 0, 0.2, h, 0.18, light);
        B(o, 'stone', x, y + h, 0, w + 0.5, 0.22, 0.25, light);
      }
    }
    if (d === 2) {
      panel(o, 'wood', x, y + 0.1, 0.065, 0.07, h - 0.2, brown);
      panel(o, 'wood', x, y + h * 0.5, 0.065, w - 0.15, 0.07, brown);
      if (arched) panel(o, 'wood', x, y + h - w / 2, 0.065, w - 0.15, 0.075, brown);
      panel(o, 'stone', x, y - 0.18, 0.23, w + 0.5, 0.2, stone);
      return;
    }
    B(o, 'wood', x, y + 0.1, 0.048, 0.07, h - 0.2, 0.03, brown);
    B(o, 'wood', x, y + h * 0.5, 0.048, w - 0.15, 0.07, 0.03, brown);
    if (arched) B(o, 'wood', x, y + h - w / 2, 0.048, w - 0.15, 0.075, 0.03, brown);
    B(o, 'stone', x, y - 0.18, 0.03, w + 0.5, 0.2, 0.4, stone);
  }
}
function archSpandrel(o, x, y, z, w, h, d) {
  const r = w / 2,
    spring = y + h - r,
    n = d === 0 ? 4 : d === 1 ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI;
    quad(
      o,
      'stone',
      [
        [x + r * Math.cos(a), spring + r * Math.sin(a), z],
        [x + r * Math.cos(b), spring + r * Math.sin(b), z],
        [x + r * Math.cos(b), y + h + 0.32, z],
        [x + r * Math.cos(a), y + h + 0.32, z],
      ],
      [0, 0, 1],
      stone,
    );
    if (d > 1) {
      const aa = [x + r * Math.cos(a), spring + r * Math.sin(a), z],
        bb = [x + r * Math.cos(b), spring + r * Math.sin(b), z];
      quad(
        o,
        'stone',
        [aa, bb, [bb[0], bb[1], z - 0.55], [aa[0], aa[1], z - 0.55]],
        [0, -1, 0],
        dark,
      );
    }
  }
  if (d > 1) archTrim(o, x, y, z + 0.03, w, h, d, stone);
}
function bands(o, w, z, ys, d) {
  for (const y of ys) {
    if (d < 3) {
      panel(o, 'stone', 0, y, z + 0.21, w, 0.2, light);
      continue;
    }
    B(o, 'stone', 0, y, z, w, 0.2, 0.4, light);
    if (d > 1) B(o, 'stone', 0, y + 0.2, z + 0.08, w, 0.08, 0.48, dark);
  }
}
function roofFace(o, p, s = 'roof', c = slate) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  o.addTriangle(
    s,
    ref,
    p,
    n,
    p.map((p) => [p[0], p[2]]),
    c,
  );
}
function mansard(o, x, z, w, depth, y, h, d, s = 'roof', c = slate, concave = false) {
  const rings = concave
    ? [
        [w / 2, depth / 2, y],
        [w * 0.38, depth * 0.38, y + h * 0.28],
        [w * 0.22, depth * 0.22, y + h * 0.73],
        [0.25, 0.25, y + h],
      ]
    : [
        [w / 2, depth / 2, y],
        [w / 2 - 2.2, depth / 2 - 2.2, y + h * 0.73],
        [Math.max(0.2, w / 2 - 5.7), 0.12, y + h],
      ];
  for (let k = 0; k < rings.length - 1; k++) {
    const [a, b, yy] = rings[k],
      [aa, bb, yyy] = rings[k + 1],
      r = [
        [-a, -b],
        [a, -b],
        [a, b],
        [-a, b],
      ],
      rr = [
        [-aa, -bb],
        [aa, -bb],
        [aa, bb],
        [-aa, bb],
      ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        p = [
          [x + r[i][0], yy, z + r[i][1]],
          [x + r[j][0], yy, z + r[j][1]],
          [x + rr[j][0], yyy, z + rr[j][1]],
          [x + rr[i][0], yyy, z + rr[i][1]],
        ];
      roofFace(o, [p[0], p[1], p[2]], s, c);
      roofFace(o, [p[0], p[2], p[3]], s, c);
      if (d > 1 && k === 0) {
        beam(o, 'metal', p[0], p[3], 0.09, 0.09, dark);
      }
    }
  }
  B(o, s, x, y + h - 0.02, z, Math.max(0.4, w - 11.4), 0.12, 0.26, c);
}
function dormer(o, x, z, y, d, arched = false) {
  if (d === 0) return;
  const q = facing(o, 0, x, z);
  B(q, 'wood', 0, y, -0.22, 1.4, 1.8, 0.8, brown);
  panel(q, 'wood', 0, y + 0.1, 0.19, 1.15, 1.5, brown);
  if (d > 1) {
    if (arched) archTrim(q, 0, y + 0.1, 0.25, 1.2, 1.5, d, brown);
    else {
      B(q, 'stone', -0.67, y, 0.18, 0.12, 1.7, 0.18, stone);
      B(q, 'stone', 0.67, y, 0.18, 0.12, 1.7, 0.18, stone);
    }
    for (let j = 0; j < 8; j++) panel(q, 'metal', 0, y + 0.18 + j * 0.17, 0.24, 1.0, 0.055, dark);
  }
  beam(q, 'roof', [-0.88, y + 1.7, 0.3], [0, y + 2.05, 0.3], 0.14, 0.14, slate);
  beam(q, 'roof', [0, y + 2.05, 0.3], [0.88, y + 1.7, 0.3], 0.14, 0.14, slate);
}
function terrace(o, x, z, w, depth, y, d) {
  B(o, 'stone', x, y, z, w, 0.25, depth, stone);
  rail(facing(o, 0, x, z + depth / 2), w, y + 0.25, d);
  rail(facing(o, Math.PI, x, z - depth / 2), w, y + 0.25, d);
  rail(facing(o, Math.PI / 2, x + w / 2, z), depth, y + 0.25, d);
  rail(facing(o, -Math.PI / 2, x - w / 2, z), depth, y + 0.25, d);
}
function loggia(o, x, z, w, a, d, recess) {
  const q = facing(o, a, x, z),
    n = Math.max(2, Math.round(w / 3.6)),
    step = w / n;
  B(q, 'stone', 0, 1.8, -recess / 2, w, 0.23, recess + 0.4, stone);
  B(q, 'stone', 0, 6.8, -recess / 2, w, 0.3, recess + 0.4, light);
  B(q, 'stone', 0, 11.9, -recess / 2, w, 0.35, recess + 0.7, light);
  for (let i = 0; i <= n; i++) {
    const xx = -w / 2 + i * step;
    B(q, 'stone', xx, 2, 0, 0.66, 4.7, 0.8, stone);
    column(q, xx, 0, 7.15, 4.75, d, true);
  }
  for (let i = 0; i < n; i++) {
    const xx = -w / 2 + (i + 0.5) * step;
    archSpandrel(q, xx, 2, 0.03, step - 0.66, 4.55, d);
    if (d > 0) {
      const rear = facing(q, 0, xx, -recess + 0.014);
      window(rear, 0, 2.35, 1.5, 3.45, d);
      window(rear, 0, 7.5, 1.5, 3.45, d, true);
    }
    rail(facing(q, 0, xx, 0.08), step - 0.72, 7.1, d);
  }
  bands(q, w, 0.04, [6.75, 11.85, 12.3], d);
}
function pavilion(o, x, z, w, depth, d, green = false) {
  B(o, 'stone', x, -0.8, z, w, 13.0, depth, stone);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const along = a === 0 || a === Math.PI ? w : depth,
      q = facing(o, a, x + (Math.sin(a) * w) / 2, z + (Math.cos(a) * depth) / 2);
    bands(q, along + 0.2, 0, [1.7, 6.6, 7.05, 11.85, 12.35], d);
    if (d > 0) {
      const count = along > 9 ? 3 : 2;
      for (let j = 0; j < count; j++) {
        const xx = -along / 2 + ((j + 0.5) * along) / count;
        window(q, xx, 2.4, 1.65, 3.25, d);
        window(q, xx, 7.55, 1.65, 3.55, d, true);
      }
      if (d > 1)
        for (let y = 2; y < 11.7; y += 0.65)
          for (const sign of [-1, 1])
            panel(q, 'metal', sign * (along / 2 - 0.42), y, 0.14, 0.8, 0.032, dark);
    }
  }
  mansard(
    o,
    x,
    z,
    w + 0.7,
    depth + 0.7,
    12.6,
    green ? 4.9 : 4.2,
    d,
    green ? 'copper' : 'roof',
    green ? copper : slate,
    green,
  );
  if (green) {
    round(o, 'copper', x, z, 17.4, 18.1, 0.21, 0.07, copper, 6);
    beam(o, 'metal', [x, 18, z], [x, 19.6, z], 0.055, 0.055, dark);
  } else for (const a of [0, Math.PI]) dormer(facing(o, a, x, z), 0, depth / 2 + 0.04, 13.0, d);
}
function roundedBay(o, d) {
  const cx = -19.2,
    cz = -15.5,
    r = 4.1,
    n = d === 0 ? 6 : d === 1 ? 10 : 20,
    ring = [
      [cx - r, cz],
      [cx + r, cz],
    ];
  for (let j = 1; j < n; j++) {
    const a = (j / n) * Math.PI;
    ring.push([cx + r * Math.cos(a), cz - r * Math.sin(a)]);
  }
  const outer = [
    [cx - 7.8, cz],
    [cx + 7.8, cz],
  ];
  for (let j = 1; j < n; j++) {
    const a = (j / n) * Math.PI;
    outer.push([cx + 7.8 * Math.cos(a), cz - 7.8 * Math.sin(a)]);
  }
  polygon(o, 'stone', outer, -0.8, 1.85, stone);
  const steps = d < 2 ? 2 : 5;
  for (let j = 0; j < steps; j++)
    B(
      o,
      'stone',
      cx,
      0.8 + (1.05 * j) / steps,
      -24.65 + (1.5 * j) / steps,
      3.4,
      1.05 / steps,
      1.5 / steps + 0.02,
      stone,
    );
  polygon(o, 'stone', ring, -0.8, 6.8, stone);
  polygon(o, 'stone', ring, 6.8, 7.1, light);
  for (let j = 0; j < n; j++) {
    const aa = (j / n) * Math.PI,
      bb = ((j + 1) / n) * Math.PI,
      m = (aa + bb) / 2,
      w = 2 * r * Math.sin((bb - aa) / 2),
      x = cx + r * Math.cos(m),
      z = cz - r * Math.sin(m),
      q = facing(o, Math.PI / 2 + m, x, z);
    if (d > 0 && j % Math.max(1, Math.floor(n / 5)) === 0) window(q, 0, 2.3, 1.9, 3.6, d, true);
    rail(q, w, 7.1, d);
  }
}
function central(o, d) {
  const x = -1.8,
    z = 11.4,
    w = 12.2;
  B(o, 'stone', x, -0.8, z, w, 13.2, 8.1, stone);
  const q = facing(o, 0, x, 15.48);
  bands(q, w + 0.4, 0.04, [1.7, 6.7, 7.15, 12.15, 12.55], d);
  for (const xx of [-3.5, 0, 3.5]) {
    window(q, xx, 2.35, 2.15, 3.85, d, true);
    window(q, xx, 7.2, 2.15, 4.25, d, true);
  }
  for (const xx of [-5.5, -1.75, 1.75, 5.5]) column(q, xx, 0.26, 7.2, 4.85, d);
  const p = [
    [-w / 2, 12.68, 0.1],
    [w / 2, 12.68, 0.1],
    [0, 14.9, 0.1],
  ];
  q.addTriangle(
    'stone',
    ref,
    p,
    [0, 0, 1],
    p.map((v) => [v[0], v[1]]),
    stone,
  );
  beam(q, 'stone', p[0], p[2], 0.28, 0.28, light);
  beam(q, 'stone', p[2], p[1], 0.28, 0.28, light);
  if (d > 1) {
    round(q, 'stone', 0, 0.3, 13.1, 13.8, 0.44, 0.24, light, 10);
    for (const sign of [-1, 1])
      for (let i = 0; i < 3; i++)
        beam(
          q,
          'stone',
          [sign * (0.6 + i * 0.55), 13.4 - i * 0.2, 0.24],
          [sign * (1.2 + i * 0.65), 13.2 - i * 0.2, 0.24],
          0.15,
          0.1,
          light,
        );
  }
  mansard(o, x, 8.5, 13.0, 13.4, 12.7, 5.35, d);
  const dorm = facing(o, 0, x, 14.1);
  B(dorm, 'wood', 0, 14.2, 0, 3.0, 3.45, 0.8, brown);
  if (d > 0) {
    archPanel(dorm, 'wood', 0, 14.2, 0.44, 2.6, 4.2, brown, 10);
    archTrim(dorm, 0, 14.15, 0.51, 3.0, 4.3, d, stone);
    for (let j = 0; j < 15; j++) panel(dorm, 'wood', 0, 14.4 + j * 0.18, 0.57, 2.5, 0.06, light);
  }
  for (const sign of [-1, 1]) {
    dormer(facing(o, 0, x + sign * 4.2, 14), 0, 0, 13.0, d, true);
  }
  // Open porte-cochere: four piers support the balcony, not an extruded front block.
  for (const xx of [-5.0, 5.0])
    for (const zz of [16.2, 21.3]) {
      B(o, 'stone', x + xx, 1.95, zz, 0.85, 4.85, 0.85, stone);
      if (d > 0) {
        B(o, 'stone', x + xx, 1.95, zz, 1.12, 0.25, 1.12, light);
        B(o, 'stone', x + xx, 6.55, zz, 1.1, 0.25, 1.1, light);
        if (d > 1)
          for (let yy = 2.4; yy < 6.5; yy += 0.6)
            for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
              panel(
                facing(o, a, x + xx + Math.sin(a) * 0.43, zz + Math.cos(a) * 0.43),
                'metal',
                0,
                yy,
                0.015,
                0.85,
                0.025,
                dark,
              );
      }
    }
  terrace(o, x, 18.75, 11.55, 7.2, 6.8, d);
  B(o, 'stone', x, 1.75, 18.75, 11.0, 0.25, 7.3, stone);
  for (let i = 0; i < 8; i++)
    B(o, 'stone', x, 0.2 + i * 0.2, 24.6 - i * 0.31, 5.5, 0.2, 0.33, stone);
}
export function taipeiGuestHouse(o, _frame, d = 3) {
  // Rectangular inner ranges sit behind the open front and north loggias.
  B(o, 'stone', -0.8, -0.8, -1, 56.6, 12.7, 17, stone);
  for (const y of [1.75, 6.7, 11.85, 12.4]) B(o, 'stone', -0.8, y, -0.2, 57.4, 0.25, 22.2, light);
  mansard(o, -0.8, -1.2, 47, 27.5, 12.7, 2.9, d);
  mansard(o, -15, 9.2, 13.8, 8.0, 12.6, 2.7, d);
  mansard(o, 13.6, 9.2, 14.8, 8.2, 12.6, 2.7, d);
  mansard(o, -0.5, -13, 26, 9.5, 12.6, 2.9, d);
  loggia(o, -15.0, 12.4, 13.4, 0, d, 4.9);
  loggia(o, 13.6, 13.3, 14.6, 0, d, 5.8);
  loggia(o, -0.5, -17.3, 25.5, Math.PI, d, 7.8);
  pavilion(o, -25.7, 8.5, 7.5, 9.8, d, true);
  pavilion(o, 24.2, 8.5, 9.3, 11.6, d);
  pavilion(o, 24.7, -14.0, 9.1, 9.4, d, true);
  pavilion(o, -21.1, -12.3, 12.3, 10.7, d);
  roundedBay(o, d);
  central(o, d);
  if (d > 0) {
    for (const a of [0, Math.PI]) {
      const q = facing(o, a, 0, a === 0 ? 12.2 : -16.6);
      for (const x of [-18, -12, 10, 16]) dormer(q, x, 0, 13.2, d);
    }
    for (const a of [-Math.PI / 2, Math.PI / 2]) {
      const x = a < 0 ? -29.11 : 27.51,
        q = facing(o, a, x, -0.2);
      for (const xx of [-6, 0, 6]) for (const y of [2.4, 7.6]) window(q, xx, y, 1.7, 3.2, d, true);
      bands(q, 21.5, 0, [1.7, 6.75, 11.85], d);
    }
  }
  if (d > 1) {
    for (const a of [0, Math.PI]) {
      const q = facing(o, a, 0, a === 0 ? 7.51 : -9.51);
      for (let y = 2.1; y < 11.8; y += 0.64) panel(q, 'metal', -0.8, y, 0.015, 56.2, 0.025, dark);
    }
    for (const x of [-16, 14]) B(o, 'stone', x, 15.1, -2.2, 0.8, 1.25, 0.9, stone);
  }
}
export function taipeiGuestHouseSkyline(o) {
  B(o, 'stone', -0.8, -0.8, -1, 56.6, 12.7, 17, stone);
  mansard(o, -0.8, -1.2, 47, 27.5, 12.7, 2.9, 0);
  mansard(o, -15, 9.2, 13.8, 8.0, 12.6, 2.7, 0);
  mansard(o, 13.6, 9.2, 14.8, 8.2, 12.6, 2.7, 0);
  mansard(o, -0.5, -13, 26, 9.5, 12.6, 2.9, 0);
  for (const [x, z, w, dep, green] of [
    [-25.7, 8.5, 7.5, 9.8, true],
    [24.2, 8.5, 9.3, 11.6, false],
    [24.7, -14, 9.1, 9.4, true],
    [-21.1, -12.3, 12.3, 10.7, false],
  ]) {
    B(o, 'stone', x, -0.8, z, w, 13, dep, stone);
    mansard(
      o,
      x,
      z,
      w + 0.7,
      dep + 0.7,
      12.6,
      green ? 4.9 : 4.2,
      0,
      green ? 'copper' : 'roof',
      green ? copper : slate,
      green,
    );
    panel(facing(o, 0, x, z + dep / 2 + 0.01), 'glass', 0, 7.5, 0.02, w * 0.55, 3.5, glass);
  }
  B(o, 'stone', -1.8, -0.8, 11.4, 12.2, 13.2, 8.1, stone);
  mansard(o, -1.8, 8.5, 13, 13.4, 12.7, 5.35, 0);
  for (const [x, z, w, a, recess] of [
    [-15, 12.4, 13.4, 0, 4.9],
    [13.6, 13.3, 14.6, 0, 5.8],
    [-0.5, -17.3, 25.5, Math.PI, 7.8],
  ]) {
    const q = facing(o, a, x, z),
      n = a === 0 ? 4 : 7;
    for (const y of [1.8, 6.8, 11.9]) B(q, 'stone', 0, y, -recess / 2, w, 0.3, recess + 0.5, light);
    for (let i = 0; i <= n; i++) B(q, 'stone', -w / 2 + (i * w) / n, 2, 0, 0.6, 9.9, 0.7, stone);
  }
  roundedBay(o, 0);
  for (const x of [-6.8, 3.2])
    for (const z of [16.2, 21.3]) B(o, 'stone', x, 1.95, z, 0.85, 4.85, 0.85, stone);
  B(o, 'stone', -1.8, 6.8, 18.75, 11.55, 1.35, 7.2, light);
  B(o, 'stone', -1.8, 1.75, 18.75, 11, 0.25, 7.3, stone);
  for (let i = 0; i < 4; i++)
    B(o, 'stone', -1.8, 0.4 + i * 0.4, 24.6 - i * 0.62, 5.5, 0.4, 0.65, stone);
}
export function taipeiGuestHouseDistrict(o) {
  taipeiGuestHouse(o, undefined, 1);
}
export function taipeiGuestHouseStreet(o) {
  taipeiGuestHouse(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  roof: landmarkSurfaces.roof,
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.75, metallic: 0.5 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.1 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const taipeiGuestHouseModel = {
  id: 'taipei_guest_house',
  key: 'taipei_guest_house',
  recipe: 'structure-taipei-guest-house.mjs',
  cell: 'ws/wsq',
  title: 'Taipei Guest House',
  brief:
    'South-facing grey classical mansion with open paired-column loggias and lower round arcades, three-arched central pavilion/pediment and balustraded entrance canopy, slate mansards/dormers, green concave corner roofs and rounded north garden bay. Japanese bungalow and garden structures excluded.',
  camera: [66, 40, 70],
  lookAt: [0, 7, 0],
  qaCameras: [
    { name: 'front', position: [0, 24, 90], lookAt: [0, 7, 7] },
    { name: 'front-detail', position: [-20, 14, 47], lookAt: [-1.8, 8, 16] },
    { name: 'back', position: [-55, 32, -68], lookAt: [0, 7, -8] },
  ],
  mediumFiContext: { scale: 0.7 },
  build: taipeiGuestHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry south forecourt[-1.8,26] gives datum15.1705m in unchanged Terrarium. Own entrance deck2m and eight low steps meet the rising forecourt; loggia floors2.03m clear the roughly.23..1.83m footprint ground. Rounded rear terrace is an architectural masonry plinth with own steps, not a fitted ground surface. Coarse urban elevation and hidden foundations remain approximate; preview only.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-taipei-guest-house.mjs',
    level: 'skyline',
    export: 'taipeiGuestHouseSkyline',
    // Skyline omits the thin corner finials, whose tops are about 1.45 m higher.
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'taipeiGuestHouseDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'taipeiGuestHouseStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior checked against two cleared published Qualla public-domain north/garden originals first, then exact creator-public-domain southeast and close roof originals. Heights, column counts, dormer distribution, fine ornament and unseen west wall are estimated rather than surveyed.',
    'Earlier attribution-licensed south hero and uncertain Gongyuan Road building are excluded from current approval. Main mansion identity and major envelope follow mapped vectors and the four inspected public-domain originals.',
    'Separate Japanese bungalow, connector, gardens, pool, garden pavilions, interiors, temporary items and fine lettering excluded. Source photographs are not redistributed.',
    'Independent Terrarium ground remains unchanged; own entrance/loggia/terrace contact is reviewed only against this bounded source preview. Other host elevation fields remain unverified and generic-footprint replacement stays disabled. Fine capitals, stone ornament, copper profile and slate courses are simplified by distance. No physical-device performance or survey accuracy claimed.',
  ],
};
