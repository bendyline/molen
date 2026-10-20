/** Château Frontenac: individually researched connected wings, tower, roofscape and stepped plinth. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/f2/f2m/chateau_frontenac/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  wall = rgb('925f4a'),
  trim = rgb('b9b9ab'),
  roof = rgb('588476'),
  glass = rgb('30454a');
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
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
function upNormal(p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  return n;
}
function edgeFrame(o, a, b) {
  return facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
function hip(o, x, z, w, l, y, rise, color = roof) {
  const a = [x - w / 2, y, z - l / 2],
    b = [x + w / 2, y, z - l / 2],
    c = [x + w / 2, y, z + l / 2],
    d = [x - w / 2, y, z + l / 2];
  const along = l > w,
    ridge = along
      ? [
          [x, y + rise, z - l / 2 + w * 0.42],
          [x, y + rise, z + l / 2 - w * 0.42],
        ]
      : [
          [x - w / 2 + l * 0.42, y + rise, z],
          [x + w / 2 - l * 0.42, y + rise, z],
        ];
  const faces = along
    ? [
        [a, b, ridge[0]],
        [b, c, ridge[1], ridge[0]],
        [c, d, ridge[1]],
        [d, a, ridge[0], ridge[1]],
      ]
    : [
        [a, b, ridge[1], ridge[0]],
        [b, c, ridge[1]],
        [c, d, ridge[0], ridge[1]],
        [d, a, ridge[0]],
      ];
  for (const p of faces)
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      o.addTriangle(
        'roof',
        ref,
        t,
        upNormal(t),
        t.map((v) => [v[0], v[2]]),
        color,
      );
    }
  beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.17, color);
}

function win(o, x, y, z, w, h, d, arched = false) {
  if (!d) return;
  if (!arched) {
    if (d > 1) face(o, 'trim', x, y - 0.12, z - 0.008, w + 0.28, h + 0.25, trim);
    face(o, 'glass', x, y, z, w, h, glass);
    if (d === 2) return;
    if (d > 1) {
      face(o, 'trim', x, y + h * 0.36, z + 0.025, w, 0.095, trim);
      if (w > 1.75) face(o, 'trim', x, y, z + 0.03, 0.1, h, trim);
    }
    return;
  }
  const sy = y + h - (arched ? w * 0.42 : 0),
    p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, sy, z],
    ];
  if (arched) {
    const n = d > 2 ? 8 : 2;
    for (let i = 1; i <= n; i++) {
      const a = (i * Math.PI) / n;
      p.push([x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * w * 0.42, z]);
    }
  } else p.push([x - w / 2, y + h, z]);
  o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
  if (d < 2) return;
  if (d === 2) {
    face(o, 'trim', x, y - 0.08, z - 0.008, w + 0.26, h + 0.22, trim);
    face(o, 'trim', x, y + h * 0.36, z + 0.04, w, 0.095, trim);
    if (w > 1.75) face(o, 'trim', x, y, z + 0.05, 0.1, h, trim);
    return;
  }
  for (const sx of [-1, 1])
    face(o, 'trim', x + sx * (w / 2 + 0.065), y - 0.06, z + 0.03, 0.13, h + 0.12, trim);
  face(o, 'trim', x, y - 0.07, z + 0.04, w + 0.26, 0.14, trim);
  if (!arched) face(o, 'trim', x, y + h - 0.02, z + 0.04, w + 0.26, 0.16, trim);
  else {
    const n = d > 2 ? 8 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      quad(
        o,
        'trim',
        [
          [x + Math.cos(a) * (w / 2 + 0.14), sy + Math.sin(a) * (w * 0.42 + 0.14), z + 0.04],
          [x + Math.cos(b) * (w / 2 + 0.14), sy + Math.sin(b) * (w * 0.42 + 0.14), z + 0.04],
          [x + (Math.cos(b) * w) / 2, sy + Math.sin(b) * w * 0.42, z + 0.04],
          [x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * w * 0.42, z + 0.04],
        ],
        [0, 0, 1],
        trim,
      );
    }
  }
  face(o, 'trim', x, y + h * 0.36, z + 0.06, w, 0.095, trim);
  if (w > 1.75) face(o, 'trim', x, y, z + 0.065, 0.1, h, trim);
  if (d > 2) {
    face(o, 'trim', x, y - 0.17, z + 0.08, w + 0.34, 0.14, trim);
    if (w < 1.75)
      face(o, 'glass', x - w * 0.25, y + 0.1, z + 0.008, w * 0.18, h * 0.8, rgb('909790'));
  }
}
function band(o, x, y, z, w, l, d) {
  B(o, 'trim', x, y, z, w + 0.32, 0.18, l + 0.32, trim);
  if (d > 2) B(o, 'wall', x, y - 0.23, z, w + 0.17, 0.2, l + 0.17, wall);
}
function cone(o, x, z, r, y, rise, d, color = roof) {
  const n = d > 2 ? 16 : d > 0 ? 8 : 6;
  loft(
    o,
    'roof',
    [radialRing(y, r, r, n, [x, z]), radialRing(y + rise, 0.07, 0.07, n, [x, z])],
    color,
  );
  if (d > 1) B(o, 'roof', x, y + rise, z, 0.1, 1.5, 0.1, color);
}
function turret(o, x, z, r, low, top, rise, d, { stone = false, color = roof } = {}) {
  const n = d > 2 ? 16 : d > 0 ? 8 : 6;
  loft(
    o,
    stone ? 'trim' : 'wall',
    [
      radialRing(low, r * 0.78, r * 0.78, n, [x, z]),
      radialRing(low + 1.2, r, r, n, [x, z]),
      radialRing(top, r, r, n, [x, z]),
    ],
    stone ? trim : wall,
  );
  loft(
    o,
    'trim',
    [
      radialRing(top - 0.4, r + 0.1, r + 0.1, n, [x, z]),
      radialRing(top, r + 0.17, r + 0.17, n, [x, z]),
    ],
    trim,
  );
  cone(o, x, z, r + 0.32, top, rise, d, color);
  if (d)
    for (let i = 0; i < (d === 1 ? 4 : 8); i++) {
      const a = (i * Math.PI * 2) / (d === 1 ? 4 : 8),
        q = facing(o, a, x, z);
      for (let y = low + 2; y < top - 1.5; y += 3.4)
        win(q, 0, y, r + 0.035, Math.min(1.15, r * 0.75), 1.7, d);
    }
}
function gable(o, x, z, y, w, h, d) {
  const p = [
      [-w / 2, 0],
      [-w / 2, h * 0.17],
      [-w * 0.34, h * 0.17],
      [-w * 0.34, h * 0.45],
      [0, h],
      [w * 0.34, h * 0.45],
      [w * 0.34, h * 0.17],
      [w / 2, h * 0.17],
      [w / 2, 0],
    ],
    ids = earcut(p.flat());
  for (const [zz, n] of [
    [z, [0, 0, 1]],
    [z - 0.7, [0, 0, -1]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const v = ids.slice(i, i + 3).map((k) => [x + p[k][0], y + p[k][1], zz]);
      o.addTriangle(
        'trim',
        ref,
        v,
        n,
        v.map((v) => [v[0], v[1]]),
        trim,
      );
    }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      v = [
        [x + a[0], y + a[1], z],
        [x + b[0], y + b[1], z],
        [x + b[0], y + b[1], z - 0.7],
        [x + a[0], y + a[1], z - 0.7],
      ];
    quad(o, 'trim', v, normalFor(...v), trim);
  }
  if (d) {
    win(o, x, y + 0.28, z + 0.04, w * 0.4, h * 0.34, d);
    if (d > 2) win(o, x, y + h * 0.51, z + 0.04, w * 0.19, h * 0.18, d, true);
  }
}
function dormer(o, x, z, y, w, h, depth, d, color = roof) {
  B(o, 'trim', x, y, z - depth / 2, w, h, depth, trim);
  win(o, x, y + 0.15, z + 0.04, w - 0.35, h - 0.3, d);
  const a = [x - w / 2 - 0.12, y + h, z + 0.16],
    b = [x + w / 2 + 0.12, y + h, z + 0.16],
    c = [x, y + h + w * 0.58, z + 0.16],
    e = [x, y + h + w * 0.58, z - depth];
  for (const p of [
    [a, b, c],
    [a, c, e, [a[0], y + h, z - depth]],
    [b, [b[0], y + h, z - depth], e, c],
  ]) {
    const n = p.length === 3 ? [0, 0, 1] : upNormal(p);
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      o.addTriangle(
        p.length === 3 ? 'trim' : 'roof',
        ref,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        p.length === 3 ? trim : color,
      );
    }
  }
}
function roofscape(
  o,
  x,
  z,
  w,
  l,
  y,
  rise,
  d,
  { color = roof, tiers = 1, gables = false, maxwell = false } = {},
) {
  hip(o, x, z, w, l, y, rise, color);
  if (d < 2) return;
  for (const [a, span, depth] of [
    [0, w, l],
    [Math.PI, w, l],
    [Math.PI / 2, l, w],
    [-Math.PI / 2, l, w],
  ]) {
    if (
      d === 2 &&
      ((l > w && Math.abs(a) !== Math.PI / 2) || (w >= l && Math.abs(a) === Math.PI / 2))
    )
      continue;
    const q = facing(o, a, x, z),
      slope = depth > span ? span * 0.42 : depth / 2;
    const count = Math.max(1, Math.floor(span / (d === 2 ? 10 : 6)));
    for (let tier = 0; tier < (d === 2 ? 1 : tiers); tier++) {
      const frac = tier === 0 ? 0.12 : tier === 1 ? 0.47 : 0.7,
        yy = y + rise * frac,
        zz = depth / 2 - slope * frac + 0.3,
        n = Math.max(1, count - tier);
      for (let i = 0; i < n; i++) {
        if (
          maxwell &&
          d > 2 &&
          Math.abs(a) === Math.PI / 2 &&
          tier === 1 &&
          Math.abs(i - (n - 1) / 2) < 1
        )
          continue;
        const xx = ((i - (n - 1) / 2) * (span - 4) * (1 - frac * 0.8)) / n;
        dormer(q, xx, zz, yy, tier ? 1.5 : 2.2, tier ? 1.45 : 2.3, 2.7, d, color);
      }
    }
    if (gables) {
      const n = d === 2 ? 1 : span > 30 ? 3 : 1;
      for (let i = 0; i < n; i++)
        gable(
          q,
          (i - (n - 1) / 2) * span * 0.27,
          depth / 2 + 0.35,
          y - 0.3,
          span > 30 ? 4.2 : 5.1,
          5.9,
          d,
        );
    }
  }
  if (d > 2) {
    const along = l > w,
      ridge = along
        ? [
            [x, z - l / 2 + w * 0.42],
            [x, z + l / 2 - w * 0.42],
          ]
        : [
            [x - w / 2 + l * 0.42, z],
            [x + w / 2 - l * 0.42, z],
          ];
    for (const [xx, zz] of ridge) {
      B(o, 'roof', xx, y + rise, zz, 0.18, 1.3, 0.18, color);
      B(o, 'roof', xx, y + rise + 1.3, zz, 0.07, 2.1, 0.07, color);
    }
  }
}
function rows(o, w, z, lo, hi, d, { spacing = 3.4, paired = false, groundArch = false } = {}) {
  if (!d) return;
  const n = Math.max(1, Math.floor((w - 2) / (paired ? 4.1 : 3))),
    step = (w - 2) / n;
  for (let y = lo + 1.0, row = 0; y < hi - 2; y += spacing, row++)
    for (let i = 0; i < n; i++) {
      if (d === 1 && (row % 2 === 1 || i % 2 === 1)) continue;
      if (d === 2 && row % 3 === 1) continue;
      const x = (i - (n - 1) / 2) * step;
      if (paired && d > 2)
        for (const u of [-0.7, 0.7]) win(o, x + u, y, z, 1.05, 2.0, d, groundArch && row === 0);
      else win(o, x, y, z, paired ? 2.3 : 1.35, row === 0 ? 2.25 : 1.9, d, groundArch && row === 0);
    }
}
function block(
  o,
  x,
  z,
  w,
  l,
  lo,
  top,
  rise,
  d,
  { paired = false, gables = false, tiers = 1, color = roof, windows = true, maxwell = false } = {},
) {
  B(o, 'wall', x, -4, z, w, top + 4, l, wall);
  if (d) B(o, 'trim', x, -4, z, w + 0.04, lo + 4, l + 0.04, trim);
  if (d > 1)
    for (let y = lo + 4; y < top; y += 3.4) B(o, 'trim', x, y, z, w + 0.12, 0.16, l + 0.12, trim);
  if (d) band(o, x, top - 0.45, z, w, l, d);
  roofscape(o, x, z, w + 0.7, l + 0.7, top, rise, d, { color, tiers, gables, maxwell });
  if (windows)
    for (const [a, span, depth] of [
      [0, w, l],
      [Math.PI, w, l],
      [Math.PI / 2, l, w],
      [-Math.PI / 2, l, w],
    ])
      rows(facing(o, a, x, z), span, depth / 2 + 0.045, lo, top, d, { paired });
}
function archWall(o, w, depth, lo, top, d, doors) {
  const ranges = doors
    .map(([x, width]) => [x - width / 2, x + width / 2])
    .sort((a, b) => a[0] - b[0]);
  let cursor = -w / 2;
  for (const [a, b] of ranges) {
    if (a > cursor) B(o, 'wall', (a + cursor) / 2, lo, 0, a - cursor, 7, depth, wall);
    cursor = b;
  }
  if (cursor < w / 2) B(o, 'wall', (cursor + w / 2) / 2, lo, 0, w / 2 - cursor, 7, depth, wall);
  B(o, 'wall', 0, lo + 7, 0, w, top - lo - 7, depth, wall);
  for (const [x, width] of doors) {
    const r = width / 2,
      stem = lo + 3.5,
      rise = Math.min(2.6, r * 0.7),
      n = d > 1 ? 12 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n,
        xa = x + Math.cos(a) * r,
        xb = x + Math.cos(b) * r,
        ya = stem + Math.sin(a) * rise,
        yb = stem + Math.sin(b) * rise;
      for (const [zz, norm] of [
        [depth / 2, [0, 0, 1]],
        [-depth / 2, [0, 0, -1]],
      ])
        quad(
          o,
          'wall',
          [
            [xa, ya, zz],
            [xb, yb, zz],
            [xb, lo + 7, zz],
            [xa, lo + 7, zz],
          ],
          norm,
          wall,
        );
      const p = [
        [xa, ya, -depth / 2],
        [xa, ya, depth / 2],
        [xb, yb, depth / 2],
        [xb, yb, -depth / 2],
      ];
      quad(o, 'trim', p, [x - (xa + xb) / 2, -1, 0], trim);
      if (d > 1)
        for (const sign of [-1, 1]) {
          const z = sign * (depth / 2 + 0.035),
            p = [
              [x + Math.cos(a) * (r + 0.36), stem + Math.sin(a) * (rise + 0.36), z],
              [x + Math.cos(b) * (r + 0.36), stem + Math.sin(b) * (rise + 0.36), z],
              [xb, yb, z],
              [xa, ya, z],
            ];
          quad(o, 'trim', p, [0, 0, sign], trim);
        }
    }
    for (const sign of [-1, 1]) {
      B(o, 'trim', x + sign * (r + 0.17), lo, 0, 0.34, 3.5, depth + 0.1, trim);
    }
  }
}
/** Closed extrusion of a convex Y/Z profile across X. */
function roofProfile(o, points, width, color) {
  const area = points.reduce((s, a, i) => {
    const b = points[(i + 1) % points.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area < 0) points = [...points].reverse();
  loft(
    o,
    'roof',
    [-width / 2, width / 2].map((x) => points.map(([y, z]) => [x, y, z])),
    color,
  );
}
function maxwellRoofDetails(o) {
  const c = JSON.parse(fs.readFileSync(new URL('roof-vent-construction-controls.json', base))),
    copper = rgb('675f54'),
    dark = rgb('292a28'),
    edge = rgb('83745e'),
    west = c.westStack,
    east = c.eastStacks,
    bank = c.banks;
  loft(
    o,
    'roof',
    west.rings.map(([y, r]) => radialRing(y, r, r, west.sides, west.center)),
    copper,
  );
  B(o, 'roof', west.center[0], 75.2, west.center[1], 0.05, 0.3, 0.05, copper);
  // Raised diamond seams on the eight flat copper shaft faces.
  for (let k = 0; k < west.sides; k++) {
    const a = (-k * Math.PI * 2) / west.sides,
      b = (-(k + 1) * Math.PI * 2) / west.sides,
      mid = (a + b) / 2,
      pt = (t, y) => [
        west.center[0] + 0.72 * ((1 - t) * Math.cos(a) + t * Math.cos(b)) + 0.012 * Math.cos(mid),
        y,
        west.center[1] + 0.72 * ((1 - t) * Math.sin(a) + t * Math.sin(b)) + 0.012 * Math.sin(mid),
      ];
    for (let i = 0; i < 4; i++)
      for (const flip of [false, true])
        beam(
          o,
          'roof',
          pt(flip ? 0.1 : 0.9, 67.7 + i * 1.42),
          pt(flip ? 0.9 : 0.1, 69.12 + i * 1.42),
          0.025,
          0.025,
          edge,
        );
  }
  const rect = (y, w, dep) =>
    [
      [-w / 2, -dep / 2],
      [-w / 2, dep / 2],
      [w / 2, dep / 2],
      [w / 2, -dep / 2],
    ].map(([x, z]) => [x, y, z]);
  for (const [x, z] of east.centers) {
    const q = facing(o, Math.PI / 2, x, z);
    B(q, 'roof', 0, east.low, 0, east.width, east.shaftTop - east.low, east.depth, copper);
    for (const y of [68.4, 69.4, 70.3])
      B(q, 'roof', 0, y, 0, east.width + 0.05, 0.055, east.depth + 0.05, edge);
    loft(q, 'roof', [rect(east.shaftTop, 1.85, 1.9), rect(east.hoodTop, 1.05, 1.16)], copper);
    const patch = [
      [-0.82, 70.48, 0.945],
      [0.82, 70.48, 0.945],
      [0.48, 71.7, 0.62],
      [-0.48, 71.7, 0.62],
    ];
    quad(q, 'roof', patch, [0, 0.3, 1], dark);
    for (let i = 0; i < 6; i++) {
      const y = 70.6 + i * 0.18,
        t = (y - 70.4) / 1.4;
      B(q, 'roof', 0, y, 0.95 - t * 0.37 + 0.055, 1.85 - t * 0.8, 0.045, 0.1, edge);
    }
  }
  for (const a of bank.angles) {
    const q = facing(o, a),
      cheek = [
        [bank.bottom, bank.front],
        [bank.header, bank.front],
        [bank.rearTop, bank.back],
        [bank.rearTop - 0.3, bank.back],
      ];
    for (const sg of [-1, 1])
      roofProfile(facing(q, 0, sg * (bank.width / 2 + 0.06), 0), cheek, 0.12, copper);
    roofProfile(
      q,
      [
        [bank.header, bank.front + 0.04],
        [bank.header + 0.12, bank.front + 0.04],
        [bank.rearTop + 0.12, bank.back],
        [bank.rearTop, bank.back],
      ],
      bank.width + 0.24,
      copper,
    );
    B(
      q,
      'roof',
      0,
      bank.bottom,
      bank.front - 0.12,
      bank.width,
      bank.sill - bank.bottom,
      0.24,
      copper,
    );
    B(
      q,
      'roof',
      0,
      bank.openingTop,
      bank.front - 0.12,
      bank.width,
      bank.header - bank.openingTop,
      0.24,
      copper,
    );
    const gaps = [
      -bank.width / 2,
      ...bank.bayCenters.flatMap((x) => [x - bank.bayWidth / 2, x + bank.bayWidth / 2]),
      bank.width / 2,
    ];
    for (let i = 0; i < gaps.length; i += 2)
      B(
        q,
        'roof',
        (gaps[i] + gaps[i + 1]) / 2,
        bank.sill,
        bank.front - 0.12,
        gaps[i + 1] - gaps[i],
        bank.openingTop - bank.sill,
        0.24,
        copper,
      );
    for (const x of bank.bayCenters) {
      B(
        q,
        'roof',
        x,
        bank.sill,
        bank.front - 0.28,
        bank.bayWidth,
        bank.openingTop - bank.sill,
        0.08,
        dark,
      );
      for (let i = 0; i < bank.bladeCount; i++) {
        const y = bank.bladeFirstY + i * bank.bladePitch,
          z = bank.bladeFront;
        roofProfile(
          facing(q, 0, x, 0),
          [
            [y - 0.025, z + 0.15],
            [y + 0.025, z + 0.15],
            [y + 0.14, z - 0.15],
            [y + 0.09, z - 0.15],
          ],
          bank.bayWidth,
          edge,
        );
      }
    }
  }
}
export function frontenac(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base), 'utf8'));
  // Independent source footprint remains visible in the map overlay; individual blocks retain both open courts.
  // Maxwell tower: 77 m architectural skyline budget, using the cited 77 m record and photographic proportions.
  block(o, 0, 0, 20.5, 41.6, 2, 51.5, 21.5, d, {
    gables: true,
    tiers: 3,
    color: rgb('675f54'),
    maxwell: true,
  });
  if (d > 2) maxwellRoofDetails(o);
  if (d > 0)
    for (const x of [-10, 10])
      for (const z of [-20.2, 20.2])
        turret(o, x, z, 1.5, 36.5, 53.2, 9.4, d, { stone: true, color: rgb('675f54') });
  if (d === 0)
    for (const x of [-10, 10])
      for (const z of [-20.2, 20.2]) cone(o, x, z, 1.8, 53.2, 9.4, 0, rgb('675f54'));
  // Tall stone-faced north extension of the tower.
  block(o, -0.4, -31.5, 19.7, 21.5, 0.4, 37.5, 12, d, { paired: true, tiers: 2 });
  if (d > 1)
    for (const x of [-9.7, 8.9]) turret(o, x, -41.8, 1.3, 29.5, 39.4, 8, d, { stone: true });
  // Saint-Louis street wing: a true passage through the building, with flanking pedestrian openings.
  {
    const q = facing(o, 0, -33, -31.4);
    archWall(q, 44, 20.2, 0.3, 25.5, d, [
      [0, 7],
      [-6.7, 2.2],
      [6.7, 2.2],
    ]);
    if (d) band(o, -33, 25.1, -31.4, 44, 20.2, d);
    roofscape(o, -33, -31.4, 44.8, 21, 25.5, 13, d, { gables: true, tiers: 2 });
    if (d)
      for (const a of [0, Math.PI]) {
        const u = facing(q, a);
        rows(u, 44, 10.15, 7, 25.5, d, { paired: true });
        for (const x of [-18, -13, 13, 18]) win(u, x, 2, 10.15, 2, 3.4, d, true);
      }
  }
  if (d)
    for (const a of [Math.PI / 2, -Math.PI / 2])
      rows(facing(o, a, -33, -31.4), 20.2, 22.045, 0.3, 25.5, d, { paired: true });
  // Original angled northeast horseshoe and rounded Saint-Lawrence room.
  block(o, 24, -33.5, 25, 14, 0.0, 22, 11, d, { paired: true, gables: true });
  {
    const a = [39.2, -35],
      b = [52.9, -7.3],
      q = edgeFrame(o, a, b),
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    block(q, 0, 0, len, 13, -0.7, 22, 11.5, d, { paired: true, gables: true });
  }
  {
    const a = [45.2, 3.8],
      b = [32.7, 29.1],
      q = edgeFrame(o, a, b),
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    block(q, 0, 0, len, 14.3, -0.8, 19.4, 11.6, d, { paired: true, gables: true });
  }
  turret(o, 54.5, -4.5, 7.9, -3, 23.5, 14, d);
  if (d > 1) {
    // Stone corbel/frieze below the conical roof is a defining detail of the rounded room.
    loft(
      o,
      'trim',
      [
        radialRing(20.7, 7.96, 7.96, 24, [54.5, -4.5]),
        radialRing(21.7, 8.15, 8.15, 24, [54.5, -4.5]),
      ],
      trim,
    );
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        q = facing(o, a, 54.5, -4.5);
      B(q, 'trim', 0, 20, 7.98, 0.24, 0.8, 0.24, trim);
    }
  }
  turret(o, 39.3, -37.3, 5.5, -3, 25, 12, d);
  // Citadel wing and bridge along the river front.
  block(o, -17, 29.4, 57, 15.5, 0.7, 23.5, 10.4, d, { paired: true, gables: true });
  block(o, 18.4, 29.8, 14.3, 15.5, 0.3, 20.5, 9.2, d, { paired: true, gables: true });
  turret(o, 24.1, 34.7, 4.1, -3, 26, 9.5, d);
  if (d > 0)
    for (const x of [-3.3, 15.3]) turret(o, x, 35.9, 1.4, 13.8, 25.1, 6.8, d, { stone: true });
  // Projecting Citadel pavilion has a taller, stone-framed central bay.
  block(o, -2.8, 34.5, 13.8, 8.5, 0.7, 27, 10, d, { paired: true, gables: true });
  if (d > 1) {
    const q = facing(o, 0, -2.8, 34.5);
    face(q, 'trim', 0, 7.2, 4.3, 8.8, 19.8, trim);
    rows(q, 8.3, 4.35, 7.2, 27, d, { paired: true });
    const u = facing(o, 0, -47.4, 29.5);
    face(u, 'trim', 0, 10.5, 9.02, 7.4, 25.5, trim);
    rows(u, 7.0, 9.07, 10.5, 36, d, { paired: true });
  }
  // Raised Mont-Carmel range and its tall pavilion. Both sit above the river rooms.
  block(o, -47.4, 29.5, 18.1, 17.9, 6.8, 36, 18, d, { paired: true, gables: true, tiers: 2 });
  block(o, -70.2, 29.9, 35.4, 16.5, 8.1, 31.4, 11.6, d, { paired: true, gables: true, tiers: 2 });
  block(o, -86, 9.8, 15, 54, 6.6, 31.4, 13.4, d, { paired: true, gables: true, tiers: 2 });
  if (d > 0) {
    turret(o, -93.6, 37.7, 1.9, 23, 33, 7, d, { stone: true });
    turret(o, -66.7, 37.8, 2.0, 22, 33.1, 7.3, d, { stone: true });
  }
  // Later western/service ranges use lower flatter massing, leaving the main courtyard open.
  block(o, -68.3, -8, 20, 19.5, 4.2, 22, 5.2, d, { paired: false });
  block(o, -68.3, 11.3, 20, 19.2, 5.5, 22, 1.2, d, { paired: false });
  block(o, -37, 0, 11.8, 35, 2.0, 15.2, 1.2, d, { paired: false });
  B(o, 'wall', -40, 0, -19.3, 6, 15.2, 4.5, wall);
  if (d > 1) {
    // Main roof stacks and corbelled stone strips; fine heraldic carvings are deliberately simplified.
    for (const [x, z, y] of [
      [-47, 29.5, 49],
      [-65, 29.9, 40],
      [-86, 3, 42],
      [24, -33.5, 30],
      [-33, -31.4, 36],
    ]) {
      B(o, 'wall', x, y - 2, z, 1.6, 5.2, 2.1, wall);
      B(o, 'trim', x, y + 3.2, z, 1.9, 0.35, 2.4, trim);
    }
    if (d > 2)
      for (const [a, span, dep] of [
        [0, 20.5, 41.6],
        [Math.PI, 20.5, 41.6],
        [Math.PI / 2, 41.6, 20.5],
        [-Math.PI / 2, 41.6, 20.5],
      ]) {
        const q = facing(o, a);
        B(q, 'trim', 0, 36, dep / 2, span, 0.4, 0.45, trim);
        for (let x = -span / 2 + 0.7; x < span / 2 - 0.3; x += 0.8)
          B(q, 'trim', x, 35.3, dep / 2 + 0.13, 0.22, 0.65, 0.28, trim);
      }
  }
  // Short hotel terraces, not a generic enclosing base or a reconstruction of the whole Dufferin promenade.
  B(o, 'trim', 37, -4, 34.4, 17, 3.6, 4.6, trim);
  B(o, 'trim', -71, -4, 39.8, 42, 12.3, 3.6, trim);
  B(o, 'trim', -45, -4, 39.9, 10, 10.9, 3.3, trim);
  if (d > 1)
    for (const [x, y, z, w] of [
      [37, -0.4, 36.5, 17],
      [-71, 8.3, 41.5, 42],
      [-45, 6.9, 41.4, 10],
    ]) {
      B(o, 'trim', x, y, z, w, 0.2, 0.4, trim);
      B(o, 'trim', x, y + 1, z, w, 0.15, 0.26, trim);
      for (let u = -w / 2; u <= w / 2; u += 2) B(o, 'trim', x + u, y, z, 0.18, 1, 0.18, trim);
    }
}
export function frontenacSkyline(o) {
  frontenac(o, undefined, 0);
}
export function frontenacDistrict(o) {
  frontenac(o, undefined, 1);
}
export function frontenacStreet(o) {
  frontenac(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72, metallic: 0.3 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const frontenacModel = {
  id: 'chateau_frontenac',
  recipe: 'structure-chateau-frontenac.mjs',
  key: 'chateau_frontenac',
  cell: 'f2/f2m',
  title: 'Château Frontenac',
  brief:
    'Red-brick château hotel with Maxwell tower, cylindrical stone corner turrets, layered copper roofs and dormers, two open courts, a through-arched Saint-Louis entrance and stepped connected wings.',
  camera: [143, 103, 217],
  lookAt: [-16, 26, 1],
  qaCameras: [
    { name: 'front', position: [97, 69, 196], lookAt: [-14, 29, 5] },
    { name: 'back', position: [-138, 90, -185], lookAt: [-16, 27, -5] },
    { name: 'west-roof-vents', position: [-32, 72, 22], lookAt: [-3, 65, 0] },
    { name: 'east-roof-stacks', position: [30, 74, 24], lookAt: [3, 67, 4] },
  ],
  build: frontenac,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Rue Saint-Louis sidewalk [-30,-45], using independent NRCan HRDEM Mosaic ground elevations. Southwest wings occupy higher ground.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chateau-frontenac.mjs',
    level: 'skyline',
    export: 'frontenacSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'frontenacDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'frontenacStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    'New tower roof work uses five exact native photographer-own CC0 originals from2020/2022/2024 after cleared Qualla search, including native octagonal chimney/diamond seams and opposite paired hooded vent stacks. Earlier attribution/private later plan/satellite imagery excluded as current construction control. Fixed full hotel/tower/wings/roofs/retaining terrace scope retained.',
    'Built one octagonal copper-clad stack with physical diamond seams, two rectangular copper shafts with louvered tapered hoods and two five-bay physical louver banks. Three lower levels retained. All roof details, positions, sizes,12blades per bank bay and.24m recess are medium-fi authoring estimates; exact mechanical interiors are excluded.',
    'Central tower height follows the 77 m architectural record approximately; official tourism rounds to 80 m. Individual storeys, roof junctions, hidden service elevations and sculptural ornament are photographic interpretations, not a measured survey.',
    'Later western ranges are represented by massing; interiors, whole Dufferin promenade, separate kiosks, landscaping and later unverified rooftop changes are excluded.',
    'Independent NRCan DTM retains real southwest rise and river cliff. Small hotel terraces are simplified; runtime terrain may differ. Footprint suppression remains disabled.',
    'No photograph pixels embedded; roof colors preserve the differing copper patina visible in the dated references.',
  ],
};
