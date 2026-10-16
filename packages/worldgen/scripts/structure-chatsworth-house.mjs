/** Chatsworth: main courtyard house and connected north wing, orangery and belvedere. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('c8b993'),
  light = rgb('ddd0ae'),
  shadow = rgb('a49a7f'),
  lead = rgb('858a84'),
  dark = rgb('4d5350'),
  glass = rgb('71817d'),
  white = rgb('dfdfce');
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
function face(o, s, x, y, z, w, h, c) {
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
function rect(o, x0, z0, x1, z1, lo, hi, s = 'stone', c = stone) {
  B(o, s, (x0 + x1) / 2, lo, (z0 + z1) / 2, x1 - x0, hi - lo, z1 - z0, c);
}
function prism(o, ring, y0, y1, s = 'stone', c = stone) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [dz, 0, -dx],
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
        p.map((v) => [v[0], v[2]]),
        c,
      );
    }
}
function roof(o, x, z, w, l, y, rise, d) {
  const h = Math.min(w, l) * 0.38;
  const p = [
    [-w / 2, -l / 2],
    [w / 2, -l / 2],
    [w / 2, l / 2],
    [-w / 2, l / 2],
  ].map((p) => [p[0] + x, y, p[1] + z]);
  const r =
    w < l
      ? [
          [x, y + rise, z - l / 2 + h],
          [x, y + rise, z + l / 2 - h],
        ]
      : [
          [x - w / 2 + h, y + rise, z],
          [x + w / 2 - h, y + rise, z],
        ];
  const faces =
    w < l
      ? [
          [p[0], p[1], r[0]],
          [p[1], p[2], r[1], r[0]],
          [p[2], p[3], r[1]],
          [p[3], p[0], r[0], r[1]],
        ]
      : [
          [p[0], p[1], r[1], r[0]],
          [p[1], p[2], r[1]],
          [p[2], p[3], r[0], r[1]],
          [p[3], p[0], r[0]],
        ];
  for (const f of faces) {
    let n = normalFor(...f);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addConvexPolygon('roof', ref, f, n, (p) => [p[0], p[2]], lead);
  }
  if (d > 2) {
    for (const f of faces) {
      const a = f[0],
        b = f[1],
        n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.4);
      for (let i = 1; i < n; i++) {
        const t = i / n,
          p = a.map((v, j) => v + (b[j] - v) * t),
          q = f.length === 4 ? f[3].map((v, j) => v + (f[2][j] - v) * t) : f[2];
        beam(
          o,
          'roof',
          p.map((v, j) => v + (j === 1 ? 0.028 : 0)),
          q.map((v, j) => v + (j === 1 ? 0.028 : 0)),
          0.035,
          0.025,
          shadow,
        );
      }
    }
  }
}
function urn(o, x, y, z, d) {
  if (!d) return;
  if (d < 3) {
    B(o, 'stone', x, y, z, 0.42, 0.8, 0.42, light);
    return;
  }
  const profile = [
    [0, 0.34],
    [0.2, 0.18],
    [0.52, 0.2],
    [0.95, 0.48],
    [1.36, 0.45],
    [1.55, 0.25],
    [1.78, 0.28],
    [2.03, 0.09],
  ];
  loft(
    o,
    'stone',
    profile.map(([h, r]) => radialRing(y + h, r, r, 6, [x, z])),
    stone,
  );
}
function balustrade(o, w, y, d, urnXs = []) {
  if (d < 2) {
    B(o, 'stone', 0, y, 0, w, 1.38, 0.55, stone);
    return;
  }
  B(o, 'stone', 0, y, 0, w, 0.2, 0.5, shadow);
  B(o, 'stone', 0, y + 1.15, 0, w + 0.12, 0.23, 0.62, light);
  if (d > 1) {
    const count = Math.round(w / (d === 2 ? 1.1 : 0.65));
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / count;
      if (d === 2) {
        face(o, 'stone', x, y + 0.2, 0.04, 0.18, 0.95, stone);
        continue;
      }
      loft(
        o,
        'stone',
        [
          [0.2, 0.08],
          [0.65, 0.14],
          [1.15, 0.08],
        ].map(([h, r]) => radialRing(y + h, r, r, 4, [x, 0])),
        stone,
      );
    }
  } else if (d === 1) face(o, 'stone', 0, y + 0.2, 0, w, 0.95, shadow);
  for (const x of urnXs) {
    B(o, 'stone', x, y - 0.05, 0, 0.8, 1.48, 0.82, stone);
    urn(o, x, y + 1.43, 0, d);
  }
}
function window(o, x, y, w, h, d, { arch = false, pediment = false } = {}) {
  if (!d) return;
  const top = y + h;
  if (arch && d > 1) {
    const r = w / 2,
      p = [
        [x - r, y, 0.08],
        [x + r, y, 0.08],
        [x + r, top - r * 0.28, 0.08],
      ];
    for (let i = 1; i <= 8; i++) {
      const a = (i * Math.PI) / 8;
      p.push([x + r * Math.cos(a), top - r * 0.28 + Math.sin(a) * r * 0.28, 0.08]);
    }
    o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
  } else face(o, 'glass', x, y, 0.08, w, h, glass);
  if (d < 2) return;
  for (const xx of [x - w / 2 - 0.1, x + w / 2 + 0.1])
    face(o, 'stone', xx, y - 0.12, 0.27, 0.2, h + 0.24, light);
  for (const yy of [y - 0.2, top]) face(o, 'stone', x, yy, 0.28, w + 0.44, 0.18, light);
  if (d > 2) B(o, 'stone', x, y - 0.2, 0.16, w + 0.5, 0.14, 0.42, light);
  const cols = d > 2 ? 3 : 2,
    rows = d > 2 ? 5 : 3;
  for (let i = 0; i <= cols; i++)
    face(o, 'wood', x - w / 2 + (i * w) / cols, y, 0.3, 0.045, h, white);
  for (let i = 0; i <= rows; i++) face(o, 'wood', x, y + (i * h) / rows, 0.31, w, 0.045, white);
  if (d > 2) {
    face(o, 'stone', x, top + 0.18, 0.38, 0.32, 0.28, stone);
    if (pediment) pedimentCap(facing(o, 0, x, 0.12), w + 0.85, top + 0.33, 0.62, d);
  }
}
function pedimentCap(o, w, y, rise, d) {
  const p = [
    [-w / 2, y, 0.03],
    [w / 2, y, 0.03],
    [0, y + rise, 0.03],
  ];
  o.addTriangle(
    'stone',
    ref,
    p,
    [0, 0, 1],
    p.map((v) => [v[0], v[1]]),
    stone,
  );
  B(o, 'stone', 0, y - 0.16, 0.15, w + 0.25, 0.18, 0.6, light);
  for (const sign of [-1, 1])
    beam(o, 'stone', [(sign * w) / 2, y, 0.2], [0, y + rise, 0.2], 0.15, 0.28, light);
  if (d > 2)
    for (let i = 0; i < 9; i++)
      B(o, 'stone', -w * 0.4 + i * w * 0.1, y - 0.1, 0.37, 0.08, 0.11, 0.09, shadow);
}
function pilaster(o, x, y, h, d, w = 0.78) {
  if (!d) return;
  if (d < 3) face(o, 'stone', x, y, 0.18, w, h, light);
  else B(o, 'stone', x, y, 0.17, w, h, 0.34, light);
  if (d < 2) return;
  if (d === 2) {
    face(o, 'stone', x, y - 0.2, 0.2, w * 1.35, 0.27, stone);
    face(o, 'stone', x, y + h - 0.35, 0.2, w * 1.5, 0.35, stone);
    return;
  }
  B(o, 'stone', x, y - 0.2, 0.23, w * 1.35, 0.27, 0.5, stone);
  B(o, 'stone', x, y + h - 0.35, 0.24, w * 1.5, 0.35, 0.52, stone);
  if (d > 2) {
    for (let i = -2; i <= 2; i++)
      face(o, 'stone', x + i * w * 0.15, y + 0.22, 0.355, 0.035, h - 0.85, shadow);
    for (const sg of [-1, 1]) {
      loft(
        facing(o, Math.PI / 2, x + sg * w * 0.51, 0.3),
        'stone',
        [radialRing(y + h - 0.15, 0.15, 0.15, 6), radialRing(y + h - 0.05, 0.12, 0.12, 6)],
        light,
      );
    }
  }
}
function column(o, x, z, y, h, r, d) {
  B(o, 'stone', x, y, z, r * 2.6, 0.28, r * 2.6, light);
  loft(
    o,
    'stone',
    [
      [0.28, r * 1.1],
      [0.48, r],
      [h - 0.45, r * 0.85],
      [h - 0.22, r * 1.2],
    ].map(([h1, r1]) => radialRing(y + h1, r1, r1, d > 2 ? 12 : 6, [x, z])),
    stone,
  );
  B(o, 'stone', x, y + h - 0.22, z, r * 2.7, 0.22, r * 2.7, light);
}
function cornice(o, w, y, d) {
  if (d === 0) return;
  if (d === 1) {
    face(o, 'stone', 0, y, 0.03, w, 0.6, light);
    return;
  }
  B(o, 'stone', 0, y, 0, w, 0.4, 0.5, stone);
  B(o, 'stone', 0, y + 0.4, 0.05, w + 0.35, 0.32, 0.8, light);
  if (d > 2) {
    B(o, 'stone', 0, y - 0.2, 0.18, w, 0.14, 0.35, shadow);
    for (let i = 0, n = Math.floor(w / 1.15); i < n; i++)
      face(o, 'stone', -w / 2 + ((i + 0.5) * w) / n, y - 0.16, 0.45, 0.22, 0.3, light);
  }
}
function ashlar(o, w, d, top = 4.7) {
  if (d < 3) return;
  for (let y = -0.5; y < top; y += 0.52) face(o, 'stone', 0, y, 0.025, w, 0.018, shadow);
  for (let j = 0; j < Math.ceil((top + 0.5) / 0.52); j++)
    for (let i = 0; i < Math.floor(w / 1.3); i++)
      face(
        o,
        'stone',
        -w / 2 + (i + (j % 2) * 0.5) * 1.3,
        -0.5 + j * 0.52,
        0.028,
        0.018,
        0.5,
        shadow,
      );
}
function mainFacade(o, w, n, d, { west = false, south = false } = {}) {
  cornice(o, w, 17.7, d);
  balustrade(
    facing(o, 0, 0, 0.13),
    w,
    18.55,
    d,
    Array.from({ length: n + 1 }, (_, i) => -w / 2 + (i * w) / n),
  );
  if (d) B(o, 'stone', 0, 4.6, 0.12, w, 0.35, 0.32, light);
  if (d > 1) B(o, 'stone', 0, 10.5, 0.09, w, 0.24, 0.26, stone);
  ashlar(o, w, d);
  if (west) rect(o, -w / 6, 0, w / 6, 1.0, -3.2, 17.7);
  if (south)
    for (const sg of [-1, 1]) B(o, 'stone', sg * w * 0.375, -3.2, 0.26, w / 4, 20.9, 0.52, stone);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    const f = facing(
      o,
      0,
      0,
      west && Math.abs(x) < w / 6 ? 1.02 : south && Math.abs(x) > w / 4 ? 0.54 : 0,
    );
    window(f, x, 1.0, 1.85, 2.8, d, { arch: true });
    window(f, x, 5.65, 1.92, 4.05, d);
    window(f, x, 11.55, 1.92, 4.3, d);
    if (i === 0) pilaster(f, -w / 2 + 0.45, 5, 12.4, d);
    pilaster(f, -w / 2 + ((i + 1) * w) / n, 5, 12.4, d);
  }
  if (west) {
    const w1 = w / 3;
    for (const x of [-w1 / 2, -w1 / 6, w1 / 6, w1 / 2])
      if (d) column(o, x, 1.45, 4.9, 12.6, 0.48, d);
    pedimentCap(facing(o, 0, 0, 1.2), w1 + 1.5, 18.4, 3.35, d);
    if (d > 1) {
      face(o, 'wood', 0, 0.55, 1.35, 2.3, 3.65, dark);
      for (const x of [-0.65, 0.65]) B(o, 'wood', x, 0.8, 1.42, 0.92, 2.95, 0.08, shadow);
    }
  }
  if (south) {
    const ss = facing(o, 0, 0, 0);
    rect(ss, -3.8, 0.05, 3.8, 4.0, 1.8, 5.3);
    for (const sg of [-1, 1])
      for (let i = 0; i < (d > 1 ? 16 : 2); i++)
        B(
          ss,
          'stone',
          sg * (3.8 + (i + 0.5) * (d > 1 ? 0.33 : 2.64)),
          1.8,
          2.0,
          d > 1 ? 0.34 : 2.65,
          ((d > 1 ? 16 : 2) - i) * (d > 1 ? 0.22 : 1.76),
          2.5,
          stone,
        );
    if (d > 1)
      for (const sg of [-1, 1])
        beam(ss, 'stone', [sg * 3.8, 6.3, 3.5], [sg * 9.1, 2.7, 3.5], 0.23, 0.32, light);
  }
}
function mainHouse(o, d) {
  rect(o, -29, -24.5, -11.45, 26.5, -3.2, 17.7);
  rect(o, 9.8, -24.5, 28.65, 26.5, -3.2, 17.7);
  rect(o, -11.45, 11.05, 9.8, 26.5, -3.2, 17.7);
  rect(o, -11.45, -24.5, 9.8, -11.45, -3.2, 18.25);
  const bow = [
    [-13.5, -24.5],
    [-13.5, -25.5],
    [-9, -28],
    [-3, -29.0],
    [3, -29.0],
    [9, -28],
    [12.7, -25.5],
    [12.7, -24.5],
  ];
  prism(o, bow, -2, 18.25);
  roof(o, -20.2, 1, 15.7, 49, 18.1, 2.5, d);
  roof(o, 19.2, 1, 16.8, 49, 18.1, 2.6, d);
  roof(o, -0.8, 18.8, 23.8, 12.4, 18.1, 2.1, d);
  roof(o, -0.8, -18.3, 25.0, 11.8, 18.5, 2.4, d);
  mainFacade(facing(o, 0, -0.2, 26.51), 55.6, 12, d, { south: true });
  mainFacade(facing(o, Math.PI / 2, 28.66, 0), 49, 10, d);
  mainFacade(facing(o, -Math.PI / 2, -29.01, 1), 51, 9, d, { west: true });
  // North elevation follows the shallow bowed central range instead of a flat added box.
  const northSegments = [
    [[-29, -24.51], [-13.5, -24.51], 3],
    ...bow
      .slice(1, -1)
      .slice(0, -1)
      .map((p, i) => [p, bow[i + 2], 1]),
    [[12.7, -24.51], [28.65, -24.51], 3],
  ];
  for (const [a, b, n] of northSegments) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      ang = Math.atan2(a[1] - b[1], b[0] - a[0]) + Math.PI,
      f = facing(o, ang, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    cornice(f, len, 18.25, d);
    balustrade(f, len, 19.1, d, Math.abs((a[0] + b[0]) / 2) < 14 ? [] : [-len / 2, len / 2]);
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + ((i + 0.5) * len) / n;
      window(f, x, 1.1, 1.8, 2.7, d);
      window(f, x, 6.0, 1.95, 4.0, d);
      window(f, x, 11.9, 1.95, 4.3, d);
      pilaster(f, -len / 2 + 0.15, 5, 12.8, d);
    }
  }
  // Open courtyard, separately modeled elevations and paving.
  rect(o, -11.43, -11.43, 9.78, 11.03, 1.5, 1.85, 'stone', shadow);
  for (const [a, x, z, w, n] of [
    [0, -0.82, -11.44, 21.2, 5],
    [Math.PI, -0.82, 11.04, 21.2, 5],
    [Math.PI / 2, -11.44, -0.2, 22.4, 7],
    [-Math.PI / 2, 9.79, -0.2, 22.4, 7],
  ]) {
    const f = facing(o, a, x, z);
    cornice(f, w, 17.7, d);
    if (d) B(f, 'stone', 0, 4.6, 0.08, w, 0.3, 0.3, light);
    for (let i = 0; i < n; i++) {
      const xx = -w / 2 + ((i + 0.5) * w) / n;
      for (const [y, h] of [
        [2.2, 2.0],
        [6.0, 3.5],
        [11.4, 4.0],
      ])
        window(f, xx, y, 1.45, h, d, { pediment: y > 10 });
      pilaster(f, -w / 2 + (i * w) / n, 5, 12.4, d, 0.48);
    }
  }
  // Roof lanterns visible within the parapet, not added full attic floors.
  if (d) {
    for (const [x, z, w, l] of [
      [-20, -8, 6, 7],
      [-19, 12, 6, 7],
      [0, 19, 5, 6],
    ]) {
      B(o, 'roof', x, 19.9, z, w, 1.1, l, shadow);
      roof(o, x, z, w + 0.4, l + 0.4, 21, 1.7, d);
    }
    loft(
      o,
      'roof',
      [
        [19, 3.1],
        [20.6, 3.1],
        [21.3, 2.4],
        [21.8, 1.2],
        [21.95, 0.25],
      ].map(([y, r]) => radialRing(y, r, r, d > 2 ? 24 : 12, [19, -17])),
      lead,
    );
  }
}
function wingFacade(o, w, n, d, y = 3.8, h = 4.8) {
  if (!d) return;
  B(o, 'stone', 0, y - 0.5, 0.1, w, 0.35, 0.35, light);
  cornice(o, w, y + h + 1, d);
  B(o, 'stone', 0, y + h + 1.75, 0.02, w, 1.0, 0.45, stone);
  if (d > 1) B(o, 'stone', 0, y + h + 2.75, 0.05, w + 0.2, 0.18, 0.6, light);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    window(o, x, y, 1.6, h, d);
    if (i % 5 === 0 || i === n - 1) pilaster(o, x - (w / n) * 0.44, y - 0.4, h + 1.2, d, 0.62);
  }
  if (d > 1) for (let i = 0; i <= n; i += 2) urn(o, -w / 2 + (i * w) / n, y + h + 2.95, 0, d);
  ashlar(o, w, d, y - 0.5);
}
function lantern(o, x, z, w, l, y, d) {
  rect(o, x - w / 2, z - l / 2, x + w / 2, z + l / 2, y, y + 0.65, 'roof', shadow);
  roof(o, x, z, w, l, y + 0.65, 1.6, Math.min(d, 2));
  if (d > 1) {
    for (const sg of [-1, 1]) {
      const f = facing(o, sg > 0 ? Math.PI / 2 : -Math.PI / 2, x + (sg * w) / 2, z);
      for (let i = 0; i < 5; i++)
        face(f, 'glass', -l / 2 + ((i + 0.5) * l) / 5, y + 0.67, 0.04, l / 5 - 0.18, 0.6, glass);
    }
  }
}
function northWing(o, d) {
  rect(o, 12.6, -94, 28.65, -24.5, -3, 10.0);
  for (const [x0, z0, x1, z1] of [
    [-8.8, -86.7, -2, -65.1],
    [-2, -86.7, 12.6, -81],
    [-2, -70.5, 12.6, -65.1],
    [7, -81, 12.6, -70.5],
  ]) {
    rect(o, x0, z0, x1, z1, -3, 9.2);
    if (d) roof(o, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 9.25, 1.1, Math.min(d, 2));
  }
  if (d) rect(o, -2, -81, 7, -70.5, 0.8, 1.0, 'stone', shadow);
  for (const [x0, z0, x1, z1] of [
    [2, -129.2, 6, -86.7],
    [6, -129.2, 20, -117],
    [6, -96, 20, -86.7],
    [20, -129.2, 27.95, -86.7],
  ]) {
    rect(o, x0, z0, x1, z1, -3, 8.8);
    rect(o, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, 8.8, 9, 'roof', lead);
  }
  if (d) rect(o, 6, -117, 20, -96, 0.8, 1.0, 'stone', shadow);
  if (d > 1)
    for (const [a, x, z, w, n] of [
      [Math.PI / 2, -2.01, -75.75, 10.5, 3],
      [-Math.PI / 2, 7.01, -75.75, 10.5, 3],
      [0, 2.5, -81.01, 9, 2],
      [Math.PI, 2.5, -70.49, 9, 2],
      [Math.PI / 2, 5.99, -106.5, 21, 5],
      [-Math.PI / 2, 20.01, -106.5, 21, 5],
      [0, 13, -117.01, 14, 3],
      [Math.PI, 13, -95.99, 14, 3],
    ]) {
      const f = facing(o, a, x, z);
      for (let i = 0; i < n; i++) window(f, -w / 2 + ((i + 0.5) * w) / n, 3.5, 1.3, 3.6, d);
    }

  rect(o, 5.05, -146.2, 27.75, -129.2, -3, 17.2);
  rect(o, 2.3, -129.2, 5.05, -116, -2, 8.8);
  // Eastern display wing: seventeen bays, then nine-bay orangery.
  wingFacade(facing(o, Math.PI / 2, 28.67, -59.25), 69.5, 17, d, 4.05, 4.6);
  wingFacade(facing(o, Math.PI / 2, 27.97, -111.6), 35.2, 9, d, 3.5, 4.5);
  wingFacade(facing(o, -Math.PI / 2, 12.59, -44.8), 40.5, 9, d, 3.7, 4.6);
  wingFacade(facing(o, -Math.PI / 2, -8.81, -75.9), 21.6, 5, d, 3.4, 4.4);
  wingFacade(facing(o, 0, 1.9, -65.09), 21.4, 5, d, 3.4, 4.4);
  wingFacade(facing(o, Math.PI, 1.9, -86.71), 21.4, 5, d, 3.4, 4.4);
  wingFacade(facing(o, -Math.PI / 2, 2.01, -107.4), 41, 9, d, 3.2, 4.4);
  // Flat lead gallery roof, three raised skylights; garden orangery has a long glazed lantern.
  rect(o, 13, -94, 28.2, -25, 10, 10.18, 'roof', lead);
  if (d) for (const z of [-39, -59, -80]) lantern(o, 20.3, z, 8, 12, 10.2, d);

  if (d) lantern(o, 22.7, -111.1, 6.8, 34.0, 9.0, d);
  // Tower lower storeys, open top colonnades and corner pavilions.
  for (const [a, x, z, w, n] of [
    [Math.PI / 2, 27.77, -137.7, 17, 3],
    [-Math.PI / 2, 5.03, -137.7, 17, 3],
    [0, 16.4, -129.18, 22.7, 6],
    [Math.PI, 16.4, -146.22, 22.7, 6],
  ]) {
    const f = facing(o, a, x, z);
    if (d) B(f, 'stone', 0, 9.7, 0.13, w, 0.4, 0.5, light);
    cornice(f, w, 16.7, d);
    for (let i = 0; i < n; i++) {
      const xx = -w / 2 + ((i + 0.5) * w) / n;
      window(f, xx, 3.0, 1.6, 4.8, d);
      window(f, xx, 11.2, 1.55, 4.1, d);
      pilaster(f, -w / 2 + (i * w) / n, 10.4, 6.0, d, 0.6);
    }
    cornice(f, w, 23, d);
    balustrade(f, w, 23.8, d, [-w / 2, 0, w / 2]);
    if (d) {
      for (let i = 1; i < n; i++) column(f, -w / 2 + (i * w) / n, 0.06, 17.5, 5.5, 0.3, d);
    }
  }
  rect(o, 5.1, -146.2, 27.75, -129.2, 17.2, 17.5, 'roof', shadow);
  rect(o, 5, -146.3, 27.85, -129.1, 23, 23.25, 'roof', lead);
  for (const x of [6.4, 26.4])
    for (const z of [-144.85, -130.55]) {
      B(o, 'stone', x, 17.5, z, 2.7, 6.1, 2.7, stone);
      B(o, 'stone', x, 24.1, z, 3.1, 1.2, 3.1, stone);
      urn(o, x, 25.3, z, d);
    }
}
function archGate(o, x, y, w, h, d) {
  const r = w / 2,
    spring = y + h - r;
  for (const sg of [-1, 1]) B(o, 'stone', x + sg * (r + 0.4), y, 0, 0.8, h + 0.9, 3.4, stone);
  const n = d > 1 ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      p = [
        [x + r * Math.cos(a), spring + r * Math.sin(a)],
        [x + r * Math.cos(b), spring + r * Math.sin(b)],
        [x + (r + 0.85) * Math.cos(b), spring + (r + 0.85) * Math.sin(b)],
        [x + (r + 0.85) * Math.cos(a), spring + (r + 0.85) * Math.sin(a)],
      ];
    for (const z of [-1.7, 1.7]) {
      const q = p.map((v) => [v[0], v[1], z]);
      quad(o, 'stone', q, [0, 0, z > 0 ? 1 : -1], stone);
    }
    const q = [
      [p[0][0], p[0][1], -1.7],
      [p[1][0], p[1][1], -1.7],
      [p[1][0], p[1][1], 1.7],
      [p[0][0], p[0][1], 1.7],
    ];
    quad(o, 'stone', q, normalFor(...q), shadow);
  }
  B(o, 'stone', x, y + h + 0.85, 0, w + 1.7, 0.4, 3.5, light);
}
function gateRange(o, d) {
  const f = facing(o, 0, -21, -144.7);
  for (const [x, w, h] of [
    [0, 4.7, 5.8],
    [-6.6, 3.3, 4.4],
    [6.6, 3.3, 4.4],
  ])
    archGate(f, x, -0.8, w, h, d);
  for (const [x, w] of [
    [-16.1, 14.3],
    [17.3, 16.8],
  ]) {
    B(f, 'stone', x, -2.4, 0, w, 6.5, 3.4, stone);
    for (const sign of [-1, 1]) {
      const g = facing(f, sign === 1 ? 0 : Math.PI, x, sign * 1.71);
      cornice(g, w, 4.1, d);
      for (let i = 0; i < 3; i++) window(g, -w * 0.3 + i * w * 0.3, 0.1, 1.2, 2.7, d);
    }
  }
  if (d > 1)
    for (const x of [-3.0, 3.0])
      for (const dx of [-0.34, 0.34]) column(f, x + dx, 1.9, -0.8, 6.2, 0.26, d);
  for (const x of [-3, 3]) {
    B(f, 'stone', x, 6.25, 0, 1.6, 1.3, 3.7, stone);
    urn(f, x, 7.55, 0, d);
  }
}
export function chatsworth(o, _frame, d = 3) {
  mainHouse(o, d);
  northWing(o, d);
  gateRange(o, d);
}
export function chatsworthSkyline(o) {
  chatsworth(o, undefined, 0);
}
export function chatsworthDistrict(o) {
  chatsworth(o, undefined, 1);
}
export function chatsworthStreet(o) {
  chatsworth(o, undefined, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.75, metallic: 0.24 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const chatsworthModel = {
  id: 'chatsworth_house',
  recipe: 'structure-chatsworth-house.mjs',
  key: 'chatsworth_house',
  cell: 'gc/gcq',
  title: 'Chatsworth House',
  brief:
    'Sandstone quadrangular house with open court, distinct pedimented west and pilastered south/east elevations, bowed north range, balustrades and urns; long attached gallery wing, glazed orangery, tall open belvedere and three-arch return gate.',
  camera: [185, 130, 195],
  lookAt: [0, 9, -52],
  qaCameras: [
    { name: 'front', position: [-115, 49, 85], lookAt: [0, 9, 0] },
    { name: 'back', position: [125, 85, -140], lookAt: [7, 10, -75] },
  ],
  build: chatsworth,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'West approach [-33,0], Y=0, independent Terrarium datum. Basement extends below the falling west/north ground; east/south terraces partly conceal basement. Courtyard Y=1.85; main upper floor Y=5.3. No terrain flattening.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chatsworth-house.mjs',
    level: 'skyline',
    export: 'chatsworthSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'chatsworthDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'chatsworthStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from six individually inspected local Qualla photographs, four-page official visitor plan, Historic England architectural description and aerial/map context. Dimensions, hidden roof joins and fine ornament remain estimates; visitor plan is not a measured survey.',
    'Main house, courtyard, attached north wing, orangery, belvedere and west-return gateway only. Separate stables, gardens, sculpture, interiors, furnishings, vegetation and photographic pixels excluded.',
    'Independent unmodified Terrarium elevations retained. Elevations beneath structures are interpolated evidence, not a building survey; footprint replacement remains disabled.',
    'Carved capitals, pediment relief, urn ornament, window surrounds and balusters are simplified progressively with distance; no physical-device performance measurement claimed.',
  ],
};
