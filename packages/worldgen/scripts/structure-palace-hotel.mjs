/** Palace Hotel: 1909 street envelope, rounded corners, lightwell and layered low roofs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/9q/9q8/palace_hotel/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  brick = rgb('d0c6a6'),
  stone = rgb('ded8c3'),
  terra = rgb('c5c1ab'),
  roof = rgb('999c90'),
  iron = rgb('404a42'),
  glass = rgb('536b70'),
  dark = rgb('313e3d');
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
function prism(o, loops, low, high, color = stone, slot = 'stone', entranceCut = false) {
  const rings = loops.map((r, i) => {
    r = cleanRing(r);
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (entranceCut && Math.abs(a[0] + 39.46) < 0.0001 && Math.abs(b[0] + 39.46) < 0.0001)
        continue;
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function upNormal(p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  return n;
}
function edgeFrame(o, a, b) {
  return facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}

function arch(o, x, y, z, w, h, d, slot = 'glass', color = glass) {
  const rise = w * 0.47,
    sy = y + h - rise,
    p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, sy, z],
    ],
    n = d > 2 ? 10 : 4;
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * rise, z]);
  }
  o.addConvexPolygon(slot, ref, p, [0, 0, 1], (p) => [p[0], p[1]], color);
}
function archRim(o, x, y, z, w, h, d, width = 0.15) {
  const n = d > 2 ? 10 : 4,
    sy = y + h - w * 0.47;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    quad(
      o,
      'stone',
      [
        [x + Math.cos(a) * (w / 2 + width), sy + Math.sin(a) * (w * 0.47 + width), z],
        [x + Math.cos(b) * (w / 2 + width), sy + Math.sin(b) * (w * 0.47 + width), z],
        [x + (Math.cos(b) * w) / 2, sy + Math.sin(b) * w * 0.47, z],
        [x + (Math.cos(a) * w) / 2, sy + Math.sin(a) * w * 0.47, z],
      ],
      [0, 0, 1],
      terra,
    );
  }
  for (const s of [-1, 1])
    face(o, 'stone', x + s * (w / 2 + width / 2), y, z, width, sy - y, terra);
}
function rail(o, x, y, z, w, d) {
  for (const yy of [y, y + 0.55]) face(o, 'iron', x, yy, z, w, 0.055, iron);
  if (d < 3) return;
  for (let u = -w / 2 + 0.1; u < w / 2; u += 0.3) {
    face(o, 'iron', x + u, y, z, 0.034, 0.55, iron);
    if (Math.abs(u) < w / 2 - 0.22)
      for (const sign of [-1, 1]) {
        const xx = x + u,
          yy = y + 0.12,
          pts =
            sign === 1
              ? [
                  [xx, yy, z],
                  [xx + 0.035, yy, z],
                  [xx + 0.215, yy + 0.28, z],
                  [xx + 0.18, yy + 0.28, z],
                ]
              : [
                  [xx, yy + 0.28, z],
                  [xx + 0.035, yy + 0.28, z],
                  [xx + 0.215, yy, z],
                  [xx + 0.18, yy, z],
                ];
        quad(o, 'iron', pts, [0, 0, 1], iron);
      }
  }
}
function window(
  o,
  x,
  y,
  z,
  w,
  h,
  d,
  { arched = false, bal = true, hood = false, plain = false } = {},
) {
  if (!d) return;
  if (arched) arch(o, x, y, z, w, h, d);
  else face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2 || (d === 2 && plain)) return;
  for (const s of [-1, 1])
    face(o, 'stone', x + s * (w / 2 + 0.065), y - 0.03, z + 0.025, 0.13, h + 0.06, stone);
  face(o, 'stone', x, y - 0.11, z + 0.04, w + 0.25, 0.12, stone);
  if (arched) archRim(o, x, y, z + 0.04, w, h, d, 0.15);
  else face(o, 'stone', x, y + h, z + 0.04, w + 0.25, 0.12, stone);
  face(o, 'stone', x, y, z + 0.055, 0.065, h, stone);
  face(o, 'stone', x, y + h * 0.46, z + 0.06, w, 0.065, stone);
  if (d > 2) {
    if (!plain) B(o, 'stone', x, y - 0.19, z + 0.1, w + 0.4, 0.14, 0.3, terra);
    if (!plain) {
      face(o, 'glass', x + w * 0.32, y + 0.12, z + 0.01, w * 0.24, h * 0.7, rgb('b6b6a2'));
      if (bal) rail(o, x, y + 0.06, z + 0.22, w + 0.1, d);
    }
    if (hood) {
      B(o, 'stone', x, y + h + 0.1, z + 0.1, 0.37, 0.38, 0.26, terra);
      B(o, 'stone', x, y + h + 0.42, z + 0.17, 0.62, 0.14, 0.4, terra);
    }
  }
}
function panel(o, x, y, z, w, h, d) {
  face(o, 'stone', x, y, z, w, h, terra);
  if (d < 3) return;
  for (const s of [-1, 1])
    face(o, 'stone', x + s * (w / 2 - 0.09), y + 0.08, z + 0.035, 0.09, h - 0.16, stone);
  for (const yy of [y + 0.08, y + h - 0.16])
    face(o, 'stone', x, yy, z + 0.035, w - 0.18, 0.09, stone);
}
function crest(o, x, y, z, w, h, d) {
  const profile =
    d < 3
      ? [
          [-w / 2, 0],
          [-w * 0.25, h * 0.2],
          [0, h],
          [w * 0.25, h * 0.2],
          [w / 2, 0],
        ]
      : [
          [-w / 2, 0],
          [-w * 0.36, h * 0.19],
          [-w * 0.24, h * 0.12],
          [-w * 0.13, h * 0.52],
          [0, h],
          [w * 0.13, h * 0.52],
          [w * 0.24, h * 0.12],
          [w * 0.36, h * 0.19],
          [w / 2, 0],
        ];
  const p = profile.map((p) => [x + p[0], y + p[1], z]);
  const ix = earcut(p.flatMap((p) => [p[0], p[1]]));
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => p[j]);
    o.addTriangle(
      'stone',
      ref,
      t,
      [0, 0, 1],
      t.map((p) => [p[0], p[1]]),
      terra,
    );
    const b = t.map((p) => [p[0], p[1], z - 0.24]);
    o.addTriangle(
      'stone',
      ref,
      b,
      [0, 0, -1],
      b.map((p) => [p[0], p[1]]),
      terra,
    );
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      'stone',
      [a, b, [b[0], b[1], z - 0.24], [a[0], a[1], z - 0.24]],
      [b[1] - a[1], a[0] - b[0], 0],
      terra,
    );
  }
  if (d > 2)
    for (const s of [-1, 1])
      beam(
        o,
        'stone',
        [x, y + 0.12, z + 0.07],
        [x + s * w * 0.31, y + h * 0.25, z + 0.07],
        0.11,
        0.12,
        stone,
      );
}
function cornice(o, span, z, d, ornate = true) {
  for (const [y, h, dep] of [
    [5.9, 0.22, 0.35],
    [6.2, 0.3, 0.5],
    [28.4, 0.22, 0.25],
    [31.85, 0.25, 0.28],
    [37.05, 0.25, 0.36],
    [37.45, 0.38, 0.65],
    [38.15, 0.58, 0.42],
  ])
    if (d || [6.2, 37.45, 38.15].includes(y)) B(o, 'stone', 0, y, z, span, h, dep, terra);
  if (!ornate || d < 2) return;
  for (let x = -span / 2 + 0.6; x < span / 2; x += d > 2 ? 0.8 : 2.4)
    if (d > 2) B(o, 'stone', x, 37.05, z + 0.22, 0.16, 0.38, 0.42, terra);
    else face(o, 'stone', x, 37.05, z + 0.42, 0.16, 0.38, terra);
  for (let x = -span / 2 + 1.15; x < span / 2 - 1; x += 2.25)
    crest(o, x, 38.73, z + 0.13, 1.85, 0.63, d);
  if (d > 2) {
    for (let x = -span / 2 + 0.8; x < span / 2 - 0.5; x += 0.65) {
      face(o, 'stone', x, 28.65, z + 0.2, 0.22, 0.3, stone);
      face(o, 'stone', x, 31.98, z + 0.23, 0.18, 0.15, stone);
    }
    for (const y of [5.76, 36.76])
      for (let x = -span / 2 + 0.2; x < span / 2; x += 0.36)
        face(o, 'stone', x, y, z + 0.19, 0.14, 0.18, terra);
  }
}
function quoin(o, x, z, d) {
  if (d < 2) return;
  face(o, 'stone', x, 6.5, z, 2.7, 21.9, terra);
  for (let y = 6.5; y < 28.3; y += 0.53)
    face(o, 'stone', x, y, z + 0.02, 2.7, 0.075, rgb('a9aa9a'));
}
function facade(o, span, z, d, { kind = 'market', base = true, ornate = true } = {}) {
  cornice(o, span, z, d, ornate);
  if (!d) return;
  let xs;
  if (kind === 'market')
    xs = [
      -34.6,
      -32.5,
      -30.4,
      ...Array.from({ length: 13 }, (_, i) => -24 + i * 4),
      30.4,
      32.5,
      34.6,
    ];
  else if (kind === 'montgomery')
    xs = [
      -45, -43, -41, -34, -32, -27, -22, -17, -12, -10, -3, 2, 7, 14, 16, 21, 26, 31, 33, 40, 42,
      44,
    ];
  if (kind !== 'market' && kind !== 'montgomery') {
    const n = Math.max(2, Math.floor((span - 4) / 4.5));
    xs = Array.from({ length: n }, (_, i) => ((i - (n - 1) / 2) * (span - 5)) / n);
  }
  if (d === 1) xs = xs.filter((_, i) => i % 2 === 0);
  for (let f = 0; f < 7; f++) {
    const y = [6.95, 11.25, 15.55, 19.85, 24.15, 28.9, 33.25][f],
      h = f === 6 ? 3.05 : 2.45;
    for (const x of xs) {
      if (f === 5 && kind === 'market' && Math.abs(x) < 27) {
        for (const u of [-0.6, 0.6]) window(o, x + u, y, z + 0.04, 0.9, h, d, { plain: false });
      } else
        window(o, x, y, z + 0.04, 1.42, h, d, {
          arched: f === 6,
          hood: f === 4 || f === 6,
          plain: !ornate,
        });
    }
    if (f === 5 && d > 1 && ornate) {
      for (let i = 0; i < xs.length - 1; i++) {
        const gap = xs[i + 1] - xs[i];
        if (gap > 3.2)
          panel(o, (xs[i] + xs[i + 1]) / 2, y + 0.04, z + 0.04, Math.min(1.3, gap * 0.33), 2.25, d);
      }
    }
  }
  if (d > 1 && ornate) {
    for (const x of kind === 'market'
      ? [-27.9, 27.9]
      : kind === 'montgomery'
        ? [-37.5, 37]
        : [-span / 2 + 1.4, span / 2 - 1.4])
      quoin(o, x, z + 0.02, d);
  }
  if (!base) return;
  const n = Math.round(span / 7.5);
  for (let i = 0; i < n; i++) {
    const x = ((i - (n - 1) / 2) * (span - 6)) / n;
    if (kind === 'montgomery' && Math.abs(x) < 11) continue;
    window(o, x, -0.8, z + 0.045, kind === 'market' ? 5.2 : 4.9, 6.1, d, {
      bal: false,
      plain: true,
    });
    if (d > 1) {
      for (const u of [-1.5, 1.5]) face(o, 'iron', x + u, -0.8, z + 0.12, 0.1, 6.1, iron);
      face(o, 'iron', x, 3.9, z + 0.13, 5.2, 0.32, iron);
    }
  }
}
function canopy(o, x, z, w, d) {
  const depth = 3.7,
    low = 3.6,
    rise = 1.2,
    n = d > 2 ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * i) / n,
      v = -w / 2 + (w * (i + 1)) / n,
      ya = low + rise * Math.sqrt(Math.max(0, 1 - (4 * u * u) / (w * w))),
      yb = low + rise * Math.sqrt(Math.max(0, 1 - (4 * v * v) / (w * w))),
      p = [
        [x + u, ya, z],
        [x + v, yb, z],
        [x + v, yb, z + depth],
        [x + u, ya, z + depth],
      ];
    quad(o, 'glass', p, upNormal(p), rgb('a6b5ab'));
    for (const dz of [0, depth])
      beam(o, 'iron', [x + u, ya + 0.05, z + dz], [x + v, yb + 0.05, z + dz], 0.11, 0.12, iron);
    if (d > 2)
      beam(o, 'iron', [x + u, ya + 0.04, z], [x + u, ya + 0.04, z + depth], 0.07, 0.08, iron);
  }
  for (const sx of [-1, 1]) {
    B(o, 'iron', x + (sx * w) / 2, 1.9, z + 0.12, 0.16, 1.7, 0.18, iron);
    beam(
      o,
      'iron',
      [x + (sx * w) / 2, 2.1, z + 0.2],
      [x + (sx * w) / 2, 3.6, z + depth],
      0.12,
      0.13,
      iron,
    );
  }
  if (d > 2)
    for (const zz of [0.9, 1.8, 2.7])
      for (let i = 0; i < n; i++) {
        const u = -w / 2 + (w * i) / n,
          v = -w / 2 + (w * (i + 1)) / n;
        beam(
          o,
          'iron',
          [x + u, low + rise * Math.sqrt(Math.max(0, 1 - (4 * u * u) / (w * w))) + 0.04, z + zz],
          [x + v, low + rise * Math.sqrt(Math.max(0, 1 - (4 * v * v) / (w * w))) + 0.04, z + zz],
          0.055,
          0.07,
          iron,
        );
      }
}

/** Cut the three portal voids into the actual ground-floor wall plane. */
function entranceWall(o, c) {
  const points = [[-51.2, 0]];
  for (const [x, w] of c.portals) {
    const rise = w * c.archRiseFactor,
      spring = c.top - rise;
    points.push([x - w / 2, 0], [x - w / 2, spring]);
    for (let i = 1; i <= c.archSegments; i++) {
      const a = Math.PI - (i * Math.PI) / c.archSegments;
      points.push([x + (Math.cos(a) * w) / 2, spring + Math.sin(a) * rise]);
    }
    points.push([x + w / 2, 0]);
  }
  points.push([48.8, 0], [48.8, 6.2], [-51.2, 6.2]);
  const ids = earcut(points.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [...points[j], 0]);
    o.addTriangle(
      'stone',
      ref,
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      stone,
    );
  }
}
function entrancePortal(o, x, w, c) {
  const rise = w * c.archRiseFactor,
    spring = c.top - rise,
    arc = Array.from({ length: c.archSegments + 1 }, (_, i) => {
      const a = Math.PI - (i * Math.PI) / c.archSegments;
      return [x + (Math.cos(a) * w) / 2, spring + Math.sin(a) * rise];
    }),
    pane = [
      [x - w / 2, 0, -c.depth],
      [x + w / 2, 0, -c.depth],
      ...arc.toReversed().map((p) => [...p, -c.depth]),
    ];
  o.addConvexPolygon('glass', ref, pane, [0, 0, 1], (p) => [p[0], p[1]], glass);
  for (const sg of [-1, 1]) {
    const xx = x + (sg * w) / 2;
    quad(
      o,
      'stone',
      [
        [xx, 0, 0],
        [xx, spring, 0],
        [xx, spring, -c.depth],
        [xx, 0, -c.depth],
      ],
      [-sg, 0, 0],
      stone,
    );
    B(
      o,
      'iron',
      x + sg * (w / 2 - 0.075),
      0,
      -c.depth + c.doorFrameDepth / 2,
      0.15,
      spring,
      c.doorFrameDepth,
      iron,
    );
  }
  for (let i = 0; i < arc.length - 1; i++) {
    const a = arc[i],
      b = arc[i + 1],
      mid = Math.PI - ((i + 0.5) * Math.PI) / c.archSegments;
    quad(
      o,
      'stone',
      [
        [...a, 0],
        [...b, 0],
        [...b, -c.depth],
        [...a, -c.depth],
      ],
      [-Math.cos(mid) / (w / 2), -Math.sin(mid) / rise, 0],
      stone,
    );
    for (const drop of [0, c.transomDrop])
      beam(
        o,
        'iron',
        [a[0], a[1] - drop, -c.depth + c.doorFrameDepth / 2],
        [b[0], b[1] - drop, -c.depth + c.doorFrameDepth / 2],
        0.12,
        c.doorFrameDepth,
        iron,
      );
  }
  // A bowed transom above paired glazed leaves; exact historic sculpture is omitted.
  B(
    o,
    'iron',
    x,
    0,
    -c.depth + c.doorFrameDepth / 2,
    0.1,
    c.top - c.transomDrop,
    c.doorFrameDepth,
    iron,
  );
  for (const u of [-0.25, 0.25]) {
    const h = spring - c.transomDrop + Math.sqrt(1 - 4 * u * u) * rise;
    B(o, 'iron', x + u * w, 0, -c.depth + c.doorFrameDepth / 2, 0.07, h, c.doorFrameDepth, iron);
  }
  for (const y of [1.1, 2.15])
    B(o, 'iron', x, y, -c.depth + c.doorFrameDepth / 2, w - 0.15, 0.09, c.doorFrameDepth, iron);
}
function entrance(o, d) {
  const controls =
    d > 2 ? JSON.parse(fs.readFileSync(new URL('portal-construction-controls.json', base))) : null;
  if (controls) entranceWall(o, controls);
  for (const [x, w] of [
    [-5.7, 4.6],
    [0, 5.2],
    [5.7, 4.6],
  ]) {
    if (controls) entrancePortal(o, x, w, controls);
    else arch(o, x, -0.2, 0.07, w, 5.6, d, 'glass', dark);
    if (d > 1) {
      archRim(o, x, -0.2, 0.11, w, 5.6, d, 0.42);
      B(o, 'stone', x, 5.25, 0.22, 0.6, 0.68, 0.5, terra);
      canopy(o, x, 0.2, w + 0.65, d);
      if (!controls)
        for (const u of [-0.9, 0.9]) face(o, 'iron', x + u, 0.1, 0.16, 0.12, 3.4, iron);
    }
  }
}
function barrel(o, x, z, w, l, y, rise, d) {
  const n = d > 1 ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * i) / n,
      v = -w / 2 + (w * (i + 1)) / n,
      ya = y + rise * Math.sqrt(Math.max(0, 1 - (4 * u * u) / (w * w))),
      yb = y + rise * Math.sqrt(Math.max(0, 1 - (4 * v * v) / (w * w))),
      p = [
        [x + u, ya, z - l / 2],
        [x + v, yb, z - l / 2],
        [x + v, yb, z + l / 2],
        [x + u, ya, z + l / 2],
      ];
    quad(o, 'glass', p, upNormal(p), rgb('93a3a0'));
    if (d > 2)
      beam(o, 'iron', [x + u, ya + 0.03, z - l / 2], [x + u, ya + 0.03, z + l / 2], 0.1, 0.1, iron);
  }
  for (const sign of [-1, 1]) {
    const q = facing(o, sign > 0 ? 0 : Math.PI, x, z);
    const p = [
      [-w / 2, y, l / 2 + 0.01],
      [w / 2, y, l / 2 + 0.01],
    ];
    for (let i = 1; i < n; i++) {
      const u = w / 2 - (w * i) / n;
      p.push([u, y + rise * Math.sqrt(Math.max(0, 1 - (4 * u * u) / (w * w))), l / 2 + 0.01]);
    }
    q.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
  }
  if (d > 1)
    for (let dz = -l / 2; dz <= l / 2 + 0.01; dz += l / Math.ceil(l / (d > 2 ? 2.7 : 8)))
      for (let i = 0; i < n; i++) {
        const u = -w / 2 + (w * i) / n,
          v = -w / 2 + (w * (i + 1)) / n;
        beam(
          o,
          'iron',
          [x + u, y + rise * Math.sqrt(Math.max(0, 1 - (4 * u * u) / (w * w))) + 0.06, z + dz],
          [x + v, y + rise * Math.sqrt(Math.max(0, 1 - (4 * v * v) / (w * w))) + 0.06, z + dz],
          0.12,
          0.13,
          iron,
        );
      }
}
function courtSkylight(o, d) {
  const low = 14.8,
    high = 17.6,
    outer = [
      [-21, low, -12],
      [21, low, -12],
      [21, low, 10],
      [-21, low, 10],
    ],
    inner = [
      [-17, high, -8],
      [17, high, -8],
      [17, high, 6],
      [-17, high, 6],
    ];
  quad(o, 'glass', inner, [0, 1, 0], rgb('a2b0a9'));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      p = [outer[i], outer[j], inner[j], inner[i]];
    quad(o, 'glass', p, upNormal(p), rgb('8e9f9d'));
    if (d > 1) {
      const len = Math.hypot(outer[j][0] - outer[i][0], outer[j][2] - outer[i][2]),
        n = Math.ceil(len / (d > 2 ? 2.3 : 6));
      for (let k = 0; k <= n; k++) {
        const t = k / n,
          a = outer[i].map((v, jj) => v * (1 - t) + outer[j][jj] * t),
          b = inner[i].map((v, jj) => v * (1 - t) + inner[j][jj] * t);
        a[1] += 0.04;
        b[1] += 0.04;
        beam(o, 'iron', a, b, 0.09, 0.1, iron);
      }
    }
  }
  if (d > 1) {
    for (let x = -17; x <= 17; x += d > 2 ? 2 : 6)
      beam(o, 'iron', [x, high + 0.04, -8], [x, high + 0.04, 6], 0.08, 0.1, iron);
    for (let z = -8; z <= 6; z += d > 2 ? 2 : 7)
      beam(o, 'iron', [-17, high + 0.04, z], [17, high + 0.04, z], 0.08, 0.1, iron);
  }
}
function sign(o, d) {
  const q = facing(o, 0, 31.5, 44.9),
    w = 12;
  for (const x of [-w / 2, w / 2]) B(q, 'iron', x, 38.6, 0, 0.13, 8.2, 0.16, iron);
  for (const y of [39.2, 41.5, 44, 46.4]) B(q, 'iron', 0, y, 0, w + 0.4, 0.1, 0.13, iron);
  for (const x of [-w / 2, w / 2]) beam(q, 'iron', [x, 38, -6], [x, 46.3, 0], 0.14, 0.18, iron);
  if (!d) return;
  const glyph = {
    T: [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
    ],
    H: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
    E: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0.5],
        [0.8, 0.5],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ],
    P: [
      [
        [0, 0],
        [0, 1],
        [0.8, 1],
        [1, 0.85],
        [1, 0.6],
        [0.8, 0.5],
        [0, 0.5],
      ],
    ],
    A: [
      [
        [0, 0],
        [0.4, 1],
        [0.6, 1],
        [1, 0],
      ],
      [
        [0.2, 0.45],
        [0.8, 0.45],
      ],
    ],
    L: [
      [
        [0, 1],
        [0, 0],
        [1, 0],
      ],
    ],
    C: [
      [
        [1, 0.85],
        [0.8, 1],
        [0.2, 1],
        [0, 0.8],
        [0, 0.2],
        [0.2, 0],
        [0.8, 0],
        [1, 0.15],
      ],
    ],
  };
  for (const [text, y, size] of [
    ['THE', 43.6, 1.8],
    ['PALACE', 40.4, 1.65],
  ]) {
    const step = size * 1.22,
      start = (-(text.length - 1) * step) / 2;
    for (let i = 0; i < text.length; i++)
      for (const line of glyph[text[i]])
        for (let j = 0; j < line.length - 1; j++)
          beam(
            q,
            'stone',
            [start + i * step + (line[j][0] - 0.5) * size, y + line[j][1] * 2.25, 0.15],
            [start + i * step + (line[j + 1][0] - 0.5) * size, y + line[j + 1][1] * 2.25, 0.15],
            0.19,
            0.16,
            rgb('e0d8a6'),
          );
  }
}
function outline(d) {
  const r = 2.4,
    pts = [
      [-39.46, -51.2],
      [-39.46, 51.2 - r],
    ],
    n = d > 1 ? 6 : 3;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - ((Math.PI / 2) * i) / n;
    pts.push([-39.46 + r + Math.cos(a) * r, 51.2 - r + Math.sin(a) * r]);
  }
  pts.push([39.46 - r, 51.2]);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 - ((Math.PI / 2) * i) / n;
    pts.push([39.46 - r + Math.cos(a) * r, 51.2 - r + Math.sin(a) * r]);
  }
  pts.push([39.46, -9.6], [23.2, -9.6], [23.2, 12], [-23.2, 12], [-23.2, -51.2]);
  return pts;
}
function rim(o, loop, y, h, d, color = terra, slot = 'stone') {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (len < 0.05) continue;
    const q = edgeFrame(o, a, b);
    B(q, slot, 0, y, 0, len, h, d, color);
  }
}
export function palace(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base), 'utf8'));
  const outer = outline(d),
    hole = [
      [-21.6, 28.8],
      [23.77, 28.8],
      [23.77, 37.79],
      [-21.6, 37.79],
    ];
  prism(o, [frame.features[0].rings[0]], -5, 0, stone, 'stone');
  prism(o, [outer, hole], 0, 6.2, stone, 'stone', d > 2);
  prism(o, [outer, hole], 6.2, 37.846, brick, 'brick');
  prism(o, [outer, hole], 37.846, 37.96, roof, 'roof');
  rim(o, outer, 37.96, 0.78, 0.4);
  rim(o, hole, 37.96, 0.6, 0.32);
  B(o, 'roof', 1.085, 6.3, 33.295, 45.37, 0.15, 8.99, roof);
  // Garden Court and rear public-room roofs are lower than the surrounding guest wings.
  B(o, 'brick', 0, 0, -19.6, 46.4, 14.6, 63.2, brick);
  B(o, 'roof', 0, 14.6, -19.6, 46.4, 0.16, 63.2, roof);
  courtSkylight(o, d);
  {
    const q = facing(o, Math.PI / 2, 0, -35);
    barrel(q, 0, 0, 8, 36, 14.8, 2.3, d);
  }
  // Attached southwest pool block: the mapped 11 m tag conflicts with city elevations.
  B(o, 'brick', 31.33, 0, -30.4, 16.26, 20, 41.6, brick);
  B(o, 'roof', 31.33, 20, -30.4, 16.26, 0.16, 41.6, roof);
  barrel(o, 31.33, -34, 13.4, 31.5, 20.17, 3.8, d);
  facade(o, 74.1, 51.24, d, { kind: 'market' });
  {
    const q = facing(o, -Math.PI / 2, -39.46, 0);
    facade(q, 97.6, 0.045, d, { kind: 'montgomery' });
    entrance(q, d);
  }
  {
    const q = facing(o, Math.PI / 2, 39.46, 20.8);
    facade(q, 56.2, 0.045, d, { kind: 'annie' });
  }
  // Rounded Market corners carry one stacked window, continuous bands and large trophy.
  for (const sx of [-1, 1]) {
    const a = (sx * Math.PI) / 4,
      x = sx * (39.46 - 2.4) + (sx * 2.4) / Math.sqrt(2),
      z = 51.2 - 2.4 + 2.4 / Math.sqrt(2),
      q = facing(o, a, x, z);
    for (let f = 0; f < 7; f++)
      window(
        q,
        0,
        [6.95, 11.25, 15.55, 19.85, 24.15, 28.9, 33.25][f],
        0.05,
        1.55,
        f === 6 ? 3.05 : 2.45,
        d,
        { arched: f === 6, hood: f === 4 },
      );
    if (d > 1) {
      crest(q, 0, 38.73, 0.1, 4.4, 1.8, d);
      cornice(q, 2.8, 0, d, false);
    }
  }
  // Plain inner court and service elevations remain visibly distinct from street ornament.
  for (const [a, x, z, span] of [
    [Math.PI, 0, 12, 46.4],
    [Math.PI / 2, -23.2, -19.6, 63.2],
    [-Math.PI / 2, 23.2, 1.2, 21.6],
  ]) {
    const q = facing(o, a, x, z);
    for (let f = 0; f < 5; f++)
      for (let i = 0; i < Math.floor(span / 4); i++)
        window(
          q,
          ((i - (Math.floor(span / 4) - 1) / 2) * (span - 4)) / Math.floor(span / 4),
          16.4 + f * 4.2,
          0.045,
          1.3,
          2.05,
          d,
          { bal: false, plain: true },
        );
  }
  // Narrow Market-side lightwell.
  for (const [a, x, z, span] of [
    [0, 1.085, 28.8, 45.37],
    [Math.PI, 1.085, 37.79, 45.37],
    [Math.PI / 2, -21.6, 33.295, 8.99],
    [-Math.PI / 2, 23.77, 33.295, 8.99],
  ]) {
    const q = facing(o, a, x, z),
      n = Math.max(1, Math.floor(span / 3.6));
    for (let f = 0; f < 7; f++)
      for (let i = 0; i < n; i++)
        window(q, ((i - (n - 1) / 2) * (span - 3)) / n, 7 + f * 4.3, 0.035, 1.15, 2.05, d, {
          bal: false,
          plain: true,
        });
  }
  // Jessie Street rear faces: tall east end, lower central hall and pool annex.
  for (const [x, w, top] of [
    [-31.33, 16.26, 37.846],
    [0, 46.4, 14.6],
    [31.33, 16.26, 20],
  ]) {
    const q = facing(o, Math.PI, x, -51.2);
    for (let y = 1; y < top - 2; y += 4.3)
      for (let i = 0; i < Math.floor(w / 4); i++)
        window(
          q,
          ((i - (Math.floor(w / 4) - 1) / 2) * (w - 3)) / Math.floor(w / 4),
          y,
          0.05,
          1.5,
          2.5,
          d,
          { bal: false, plain: true },
        );
    B(q, 'stone', 0, 6.2, 0, w, 0.3, 0.45, terra);
  }
  {
    const q = facing(o, Math.PI / 2, 39.46, -30.4);
    for (let y = 1; y < 18; y += 4.8)
      for (const x of [-16, -8, 0, 8, 16])
        window(q, x, y, 0.045, 1.3, y > 10 ? 2.7 : 2.2, d, { bal: false, plain: true });
    B(q, 'stone', 0, 6.2, 0, 41.6, 0.3, 0.45, terra);
  }
  // Existing mechanical penthouses, deliberately excluding proposed antenna fixtures.
  for (const [x, z, w, l, h] of [
    [-29, 43, 9, 10, 8.7],
    [28, 25, 10, 14, 8.64],
  ]) {
    B(o, 'brick', x, 37.95, z, w, h, l, brick);
    B(o, 'roof', x, 37.95 + h, z, w + 0.3, 0.15, l + 0.3, roof);
    if (d > 1)
      for (const a of [0, Math.PI]) {
        const q = facing(o, a, x, z);
        for (const xx of [-2.5, 0, 2.5])
          window(q, xx, 39, l / 2 + 0.04, 1.45, 2.3, d, { bal: false, plain: true });
      }
  }
  if (d > 1)
    for (const [x, z, w, l] of [
      [-31, -35, 7, 17],
      [-30, 0, 6, 8],
      [29, 1, 6, 10],
      [0, 20, 9, 3],
    ]) {
      B(o, 'roof', x, 38, z, w, 1.8, l, roof);
      for (let i = 0; i < Math.floor(l / 1.6); i++)
        B(
          o,
          'iron',
          x,
          39.82,
          z + (i - (Math.floor(l / 1.6) - 1) / 2) * 1.6,
          w * 0.75,
          0.1,
          0.15,
          iron,
        );
    }
  sign(o, d);
}
export function palaceSkyline(o) {
  palace(o, undefined, 0);
}
export function palaceDistrict(o) {
  palace(o, undefined, 1);
}
export function palaceStreet(o) {
  palace(o, undefined, 2);
}
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const palaceModel = {
  id: 'palace_hotel',
  recipe: 'structure-palace-hotel.mjs',
  key: 'palace_hotel',
  cell: '9q/9q8',
  title: 'Palace Hotel, San Francisco',
  brief:
    'Cream-brick 1909 Renaissance Revival hotel with eight storeys, rounded Market corners, terracotta cornices, triple curved entrance canopies, roof lightwell and open-frame THE PALACE sign.',
  camera: [-143, 92, 161],
  lookAt: [0, 18, 0],
  qaCameras: [
    { name: 'front', position: [-116, 51, 133], lookAt: [-5, 21, 8] },
    { name: 'back', position: [128, 91, -148], lookAt: [0, 18, -4] },
    { name: 'entrance-portals', position: [-56, 8, 12], lookAt: [-39.46, 2.8, 0] },
    { name: 'curved-door-frame', position: [-44.5, 3, 1.5], lookAt: [-38.74, 3.4, 0] },
  ],
  build: palace,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'New Montgomery sidewalk [-41,0], immediately outside the central three-arch entrance.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-palace-hotel.mjs',
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'palaceDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'palaceStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'New actual entrance portals and physical curved double-door/transom framing use the exact native primary Highsmith entrance photograph under explicit photographer public-domain dedication, after a cleared Qualla imagery search. Earlier attribution/private report/satellite imagery is excluded as current construction control. Wider exterior review remains pending.',
    'Three portals now cut into the actual close-level front wall, with stone jambs/arched soffits, recessed glazing and closed metal frames. Existing widths/heights/canopies retained; .72m recess, .14m frame depth and .65m transom spacing are medium-fi estimates. Exact gilded sculpture/face/monogram is not copied.',
    'Existing city roof/parapet labels control principal heights; low-roof heights, floor spacing, hidden joins and fine terracotta ornament remain interpretations. Coarse map part heights conflict with the city elevations and are retained as evidence only.',
    'Surviving 1909 exterior and attached lower pool/court roofs included. No 1875 reconstruction, interiors or proposed telecommunications equipment. Later rooftop changes are unverified.',
    'Independent terrain remains unflattened; footprint suppression stays disabled. No photo pixels copied.',
  ],
};
