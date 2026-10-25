/** Royal Albert Hall's five-stage elliptical shell, roof and independently mapped porches. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcp/royal_albert_hall/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  terrain = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcp/royal_albert_hall/terrain-grid.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  brick = rgb('965744'),
  brickDark = rgb('743f36'),
  stone = rgb('b8b09b'),
  cream = rgb('d2c5a4'),
  roofgrey = rgb('81918f'),
  dark = rgb('3c4948'),
  glass = rgb('57716f'),
  mosaic = rgb('705343'),
  [RX, RZ] = frame.authoredComponents.coreRadii,
  [CX, CZ] = frame.authoredComponents.coreCenter,
  [DX, DZ] = frame.authoredComponents.domeRadii;
const grade = (x, z) => {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    terrain.modelDatumElevationMeters
  );
};
function transform(o, a, x = 0, z = 0) {
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
function roof(o, ps, col = roofgrey) {
  if (normalFor(...ps)[1] < 0) ps = [...ps].reverse();
  const n = normalFor(...ps);
  if (ps.length === 3)
    o.addTriangle(
      'roof',
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      col,
    );
  else quad(o, 'roof', ps, n, col);
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'stone') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function clipY(ps, y, above) {
  const r = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      A = above ? a[1] >= y : a[1] <= y,
      B = above ? b[1] >= y : b[1] <= y;
    if (A) r.push(a);
    if (A !== B) {
      const t = (y - a[1]) / (b[1] - a[1]);
      r.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return r;
}
function flat(o, slot, ps, col) {
  if (ps.length < 3) return;
  for (let i = 1; i < ps.length - 1; i++) {
    const p = [ps[0], ps[i], ps[i + 1]];
    if (Math.hypot(...normalFor(...p)) < 0.5) continue;
    if (normalFor(...p)[2] < 0) p.reverse();
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-8) continue;
    o.addTriangle(
      slot,
      ref,
      p,
      [0, 0, 1],
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
function arch(w, h, n, style = 'pointed') {
  if (style === 'rect')
    return [
      [-w / 2, 0],
      [w / 2, 0],
      [w / 2, h],
      [-w / 2, h],
    ];
  let top = [];
  if (style === 'round')
    top = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [(w / 2) * Math.cos(a), h - w / 2 + (w / 2) * Math.sin(a)];
    });
  else if (style === 'blunt')
    top = Array.from({ length: 2 * n + 1 }, (_, i) => {
      const x = w / 2 - (i * w) / (2 * n),
        t = Math.abs(x) / (w / 2);
      return [x, h - w * 0.3 * (0.45 * t + 0.55 * t * t)];
    });
  else if (style === 'segment')
    top = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [(w / 2) * Math.cos(a), h - w * 0.26 + w * 0.26 * Math.sin(a)];
    });
  else if (style === 'ogee')
    top = Array.from({ length: 2 * n + 1 }, (_, i) => {
      const x = w / 2 - (i * w) / (2 * n),
        t = 1 - Math.abs(x) / (w / 2);
      return [x, h - w * 0.9 + w * 0.9 * (t + 0.13 * Math.sin(2 * Math.PI * t))];
    });
  else {
    const rise = (w * Math.sqrt(3)) / 2,
      base = h - rise;
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / 3 / n;
      top.push([-w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (2 * Math.PI) / 3 + (i * Math.PI) / 3 / n;
      top.push([w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
    }
  }
  return [[-w / 2, 0], [w / 2, 0], ...top];
}
function outline(o, ps, z, col = cream, w = 0.1, slot = 'trim') {
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length];
    strip(o, slot, [...a, z], [...b, z], w, col);
  }
}
function wall(o, d, w, top, ops, { bottom = -3, stoneTop = 3.2 } = {}) {
  const split = ops.every((op) => op.y >= stoneTop);
  if (split) {
    quad(
      o,
      'base',
      [
        [-w / 2, bottom, 0],
        [w / 2, bottom, 0],
        [w / 2, stoneTop, 0],
        [-w / 2, stoneTop, 0],
      ],
      [0, 0, 1],
      stone,
    );
    bottom = stoneTop;
  }
  const holes = ops.map((op) =>
      arch(op.w, op.h, d === 3 ? 10 : d === 2 ? 3 : 2, op.style ?? 'rect').map(([x, y]) => [
        op.x + x,
        op.y + y,
      ]),
    ),
    ps = [[-w / 2, bottom], [w / 2, bottom], [w / 2, top], [-w / 2, top], ...holes.flat()],
    starts = holes.map((_, i) => 4 + holes.slice(0, i).reduce((s, p) => s + p.length, 0)),
    ids = earcut(ps.flat(), starts);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [...ps[j], 0]);
    if (split) flat(o, 'brick', p, brick);
    else {
      flat(o, 'base', clipY(p, stoneTop, false), stone);
      flat(o, 'brick', clipY(p, stoneTop, true), brick);
    }
  }
  for (let j = 0; j < ops.length; j++) {
    const op = ops[j],
      p = holes[j],
      depth = op.depth ?? (d > 1 ? 0.18 : 0.06);
    if (op.niche)
      flat(
        o,
        'brick',
        p.map((p) => [...p, -depth]),
        brickDark,
      );
    else
      flat(
        o,
        'glass',
        p.map((p) => [...p, -depth]),
        glass,
      );
    if (d > 1 || op.portal)
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          pp = [
            [...a, 0],
            [...b, 0],
            [...b, -depth],
            [...a, -depth],
          ];
        quad(o, 'trim', pp, normalFor(...pp), cream);
      }
    if (d > 1 || op.portal) outline(o, p, 0.025, cream, op.portal ? 0.18 : 0.12);
    if (d > 1 && !op.niche) {
      const x = op.x,
        y = op.y,
        h = op.h;
      if (d === 2)
        strip(
          o,
          'metal',
          [x, y, -depth + 0.025],
          [x, y + h - (op.style === 'round' ? op.w / 2 : 0), -depth + 0.025],
          0.045,
          dark,
        );
      else
        B(
          o,
          'metal',
          x,
          y,
          -depth + 0.025,
          0.045,
          h - (op.style === 'round' ? op.w / 2 : 0),
          0.04,
          dark,
        );
      for (const t of op.portal ? [0.27, 0.63] : [0.43])
        strip(
          o,
          'metal',
          [x - op.w / 2, y + h * t, -depth + 0.035],
          [x + op.w / 2, y + h * t, -depth + 0.035],
          0.045,
          dark,
        );
      if (op.style === 'round' && d === 3)
        for (const t of [-0.6, 0, 0.6]) {
          const a = Math.PI / 2 + t;
          strip(
            o,
            'metal',
            [x, y + h - op.w / 2, -depth + 0.035],
            [
              x + Math.cos(a) * op.w * 0.47,
              y + h - op.w / 2 + Math.sin(a) * op.w * 0.47,
              -depth + 0.035,
            ],
            0.035,
            dark,
          );
        }
    }
    if (op.portal && d > 0) {
      B(o, 'metal', op.x, op.y, -depth + 0.04, op.w, 2.65, 0.08, dark);
      if (d > 1)
        for (let i = 0; i < 4; i++) {
          const x = op.x + ((i - 1.5) * op.w) / 4;
          B(o, 'glass', x, op.y + 0.2, -depth + 0.09, op.w / 4 - 0.1, 2.1, 0.025, glass);
        }
    }
    if (d === 3 && op.niche) {
      B(o, 'trim', op.x, op.y + 0.3, -depth + 0.03, op.w * 0.42, op.h * 0.58, 0.05, stone);
      B(o, 'trim', op.x, op.y + op.h * 0.64, -depth + 0.08, op.w * 0.24, 0.26, 0.06, cream);
    }
  }
}
const ellipse = (rx, rz, y, n, cx = CX, cz = CZ) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [cx + rx * Math.sin(a), y, cz + rz * Math.cos(a)];
  });
function profile(o, slot, rx, rz, levels, n, col, cx = CX, cz = CZ) {
  for (let j = 1; j < levels.length; j++) {
    const a = levels[j - 1],
      b = levels[j];
    for (let i = 0; i < n; i++) {
      const t = (i * Math.PI * 2) / n,
        u = ((i + 1) * Math.PI * 2) / n,
        p = [
          [cx + (rx + a[1]) * Math.sin(t), a[0], cz + (rz + a[1]) * Math.cos(t)],
          [cx + (rx + a[1]) * Math.sin(u), a[0], cz + (rz + a[1]) * Math.cos(u)],
          [cx + (rx + b[1]) * Math.sin(u), b[0], cz + (rz + b[1]) * Math.cos(u)],
          [cx + (rx + b[1]) * Math.sin(t), b[0], cz + (rz + b[1]) * Math.cos(t)],
        ];
      quad(o, slot, p, normalFor(...p), col);
    }
  }
}
function band(o, d, y, offset = 0.18, height = 0.14, rx = RX, rz = RZ, cx = CX, cz = CZ) {
  const n = d === 0 ? 20 : d === 1 ? 30 : 60;
  profile(
    o,
    'trim',
    rx,
    rz,
    d === 3 || (d === 2 && rx === RX && [3.2, 9.8, 22.65].includes(y))
      ? [
          [y, 0],
          [y, offset],
          [y + height, offset],
          [y + height, 0],
        ]
      : [
          [y, offset],
          [y + height, offset],
        ],
    n,
    cream,
    cx,
    cz,
  );
}
/** New casting faces use a local meter basis, including the small end faces. */
function castingFace(o, slot, p, color) {
  const n = normalFor(...p),
    a = p[0],
    u = p[1].map((v, i) => v - a[i]),
    length = Math.hypot(...u),
    v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]],
    uv = p.map((p) => [
      p.reduce((s, p, i) => s + ((p - a[i]) * u[i]) / length, 0),
      p.reduce((s, p, i) => s + ((p - a[i]) * v[i]) / length, 0),
    ]);
  if (p.length === 3) o.addTriangle(slot, ref, p, n, uv, color);
  else o.addQuad(slot, ref, p, n, uv, color);
}
function belliedBaluster(o) {
  const rings = [
    [17.48, 0.065],
    [17.73, 0.12],
    [18.1, 0.04],
    [18.52, 0.065],
  ].map(([y, r]) =>
    Array.from({ length: 3 }, (_, i) => [
      r * Math.cos((-i * Math.PI * 2) / 3),
      y,
      r * Math.sin((-i * Math.PI * 2) / 3),
    ]),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) % 3;
      castingFace(
        o,
        'castBaluster',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        cream,
      );
    }
  // Both open boundaries are completely buried in the unchanged stone rail bands.
}
function corniceConsole(o) {
  const p = [
    [-0.14, 22.28],
    [0.25, 22.28],
    [0.1, 21.99],
    [-0.14, 21.99],
  ];
  if (
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) < 0
  )
    p.reverse();
  const left = p.map(([z, y]) => [-0.11, y, z]),
    right = p.map(([z, y]) => [0.11, y, z]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    castingFace(o, 'corniceConsole', [left[i], right[i], right[j], left[j]], stone);
  }
  for (let i = 1; i < p.length - 1; i++) {
    castingFace(o, 'corniceConsole', [left[0], left[i], left[i + 1]], stone);
    castingFace(o, 'corniceConsole', [right[0], right[i + 1], right[i]], stone);
  }
}
function shell(o, d) {
  const n = d === 0 ? 20 : 60,
    delta = Math.PI / n;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      angle = Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
      q = transform(
        o,
        angle,
        CX + RX * Math.cos(delta) * Math.sin(a),
        CZ + RZ * Math.cos(delta) * Math.cos(a),
      ),
      width = 2 * Math.sin(delta) * Math.hypot(RX * Math.cos(a), RZ * Math.sin(a)),
      ops = [];
    if (d > 0)
      ops.push(
        { x: 0, y: 4.8, w: 1.65, h: 4.7 },
        { x: 0, y: 11.1, w: 1.85, h: 5.2, style: 'round' },
      );
    if (d === 3 && i % 4 === 2) ops.push({ x: 0, y: 0.5, w: 1.3, h: 2.35 });
    wall(q, d, width, 17.5, ops);
    if (d > 1) {
      for (const y of [4.6, 9.5])
        if (d === 2) strip(q, 'trim', [-1.05, y + 0.09, 0.2], [1.05, y + 0.09, 0.2], 0.18, cream);
        else B(q, 'trim', 0, y, 0.1, 2.1, 0.18, 0.2, cream);
      if (d === 3)
        for (const s of [-1, 1]) {
          B(q, 'trim', s * 1.06, 4.8, 0.09, 0.15, 4.7, 0.18, cream);
          B(q, 'trim', s * 1.1, 11.0, 0.13, 0.19, 5.2, 0.25, cream);
        }
      const x = width / 2 - 0.28;
      B(q, 'trim', x, 10.6, 0.12, 0.42, 6.6, 0.32, cream);
      if (d === 2) {
        strip(q, 'trim', [x - 0.34, 16.94, 0.4], [x + 0.34, 16.94, 0.4], 0.27, cream);
        strip(q, 'trim', [x - 0.31, 10.615, 0.4], [x + 0.31, 10.615, 0.4], 0.23, cream);
      } else {
        B(q, 'trim', x, 16.8, 0.19, 0.68, 0.27, 0.45, cream);
        B(q, 'trim', x, 10.5, 0.19, 0.62, 0.23, 0.43, cream);
      }
      if (d === 3) {
        for (const dx of [-0.11, 0.11])
          strip(q, 'trim', [x + dx, 11, 0.3], [x + dx, 16.6, 0.3], 0.04, stone);
        for (const y of [11.35, 16.6]) B(q, 'trim', x, y, 0.34, 0.64, 0.12, 0.12, cream);
        for (const s of [-1, 1]) B(q, 'trim', s * 1.06, 9.55, 0.13, 0.31, 0.28, 0.28, cream);
      }
    }
  }
  const n2 = d === 0 ? 20 : d === 1 ? 30 : 60;
  profile(
    o,
    'brick',
    RX,
    RZ,
    d === 0
      ? [
          [17.4, 0],
          [22.8, 0],
        ]
      : [
          [17.4, -1.1],
          [19.8, -1.1],
          [19.8, 0],
          [22.8, 0],
        ],
    n2,
    brick,
  );
  if (d > 0)
    profile(
      o,
      'base',
      RX,
      RZ,
      [
        [17.5, -1.1],
        [17.5, 0.24],
      ],
      n2,
      stone,
    );
  for (const [y, h] of d === 0
    ? [
        [17.4, 0.22],
        [22.65, 0.15],
      ]
    : d === 1
      ? [
          [3.2, 0.18],
          [9.8, 0.13],
          [17.4, 0.17],
          [22.65, 0.18],
        ]
      : [
          [3.2, 0.22],
          [9.8, 0.18],
          [10.2, 0.12],
          [17.3, 0.2],
          [18.5, 0.12],
          [19.7, 0.14],
          [21.8, 0.13],
          [22.1, 0.23],
          [22.65, 0.17],
        ])
    band(o, d, y, 0.2, h);
  profile(
    o,
    'mosaic',
    RX + 0.025,
    RZ + 0.025,
    [
      [19.85, 0],
      [21.7, 0],
    ],
    n2,
    mosaic,
  );
  if (d > 1) {
    const count = d === 3 ? 300 : 120;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        q = transform(
          o,
          Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
          CX + (RX + (d === 3 ? 0.07 : 0.24)) * Math.sin(a),
          CZ + (RZ + (d === 3 ? 0.07 : 0.24)) * Math.cos(a),
        );
      if (d === 2) strip(q, 'trim', [0, 17.58, 0.06], [0, 18.38, 0.06], 0.095, cream);
      else belliedBaluster(q);
    }
    const count2 = d === 3 ? 150 : 30;
    for (let i = 0; i < count2; i++) {
      const a = (i * Math.PI * 2) / count2,
        q = transform(
          o,
          Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
          CX + (RX + 0.04) * Math.sin(a),
          CZ + (RZ + 0.04) * Math.cos(a),
        );
      if (d === 3) {
        const seed = i % 5,
          x = ((i % 3) - 0.8) * 0.12,
          p = [
            [-0.16, 21.05],
            [0.16, 21.05],
            [0.19, 20.52],
            [0.3, 20.0],
            [0.12, 20.0],
            [0, 20.46],
            [-0.12, 20.0],
            [-0.3, 20.0],
            [-0.15, 20.52],
          ],
          ids = earcut(p.flat());
        for (let k = 0; k < ids.length; k += 3)
          flat(
            q,
            'trim',
            ids.slice(k, k + 3).map((j) => [p[j][0] + x, p[j][1], 0.025]),
            seed % 2 ? stone : cream,
          );
        for (const side of [-1, 1])
          strip(
            q,
            'trim',
            [x + side * 0.13, 20.95, 0.025],
            [x + side * 0.43, 20.8 + (seed % 3) * 0.22, 0.025],
            0.12,
            cream,
          );
        const head = Array.from({ length: 8 }, (_, j) => [
          x + 0.13 * Math.cos((j * Math.PI) / 4),
          21.23 + 0.13 * Math.sin((j * Math.PI) / 4),
          0.025,
        ]);
        flat(q, 'trim', head, cream);
      } else strip(q, 'trim', [-0.12, 20.05, 0.03], [0.12, 21.45, 0.03], 0.19, stone);
    }
    for (let i = 0; i < 180; i++) {
      const a = (i * Math.PI) / 90,
        q = transform(
          o,
          Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
          CX + (RX + 0.22) * Math.sin(a),
          CZ + (RZ + 0.22) * Math.cos(a),
        );
      if (d === 3) corniceConsole(q);
    }
  }
  if (d > 0)
    for (let i = 0; i < 15; i++) {
      const a = (i * Math.PI * 2) / 15,
        q = transform(
          o,
          Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
          CX + RX * Math.sin(a),
          CZ + RZ * Math.cos(a),
        );
      if (d > 1) {
        B(q, 'metal', 0, 18.6, 0.03, 0.65, 1.0, 0.06, dark);
        B(q, 'trim', 0, 19.65, 0.07, 0.95, 0.15, 0.1, cream);
      }
    }
  if (d > 1)
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30,
        b = ((i + 1) * Math.PI) / 30,
        mid = (a + b) / 2;
      if (Math.abs(Math.sin(2 * mid)) < 0.4) continue;
      roof(
        o,
        [
          [CX + RX * Math.sin(a), 3.3, CZ + RZ * Math.cos(a)],
          [CX + RX * Math.sin(b), 3.3, CZ + RZ * Math.cos(b)],
          [CX + (RX + 1.4) * Math.sin(b), 3.05, CZ + (RZ + 1.4) * Math.cos(b)],
          [CX + (RX + 1.4) * Math.sin(a), 3.05, CZ + (RZ + 1.4) * Math.cos(a)],
        ],
        dark,
      );
    }
  if (d === 1)
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        q = transform(
          o,
          Math.atan2(RZ * Math.sin(a), RX * Math.cos(a)),
          CX + (RX + 0.04) * Math.sin(a),
          CZ + (RZ + 0.04) * Math.cos(a),
        );
      strip(q, 'trim', [-0.1, 20, 0.03], [0.1, 21.5, 0.03], 0.2, cream);
    }
  // Broad first-stage stone wall below grade; a low internal floor closes the base without filling any window/portal recess.
  const p = ellipse(RX - 0.7, RZ - 0.7, 0.45, d === 0 ? 20 : 60);
  for (let i = 0; i < p.length; i++)
    o.addTriangle(
      'base',
      ref,
      [[CX, 0.45, CZ], p[i], p[(i + 1) % p.length]],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      stone,
    );
  const a = ellipse(RX, RZ, 22.8, n2),
    b = ellipse(DX, DZ, 22.8, n2, 0, 0);
  for (let i = 0; i < n2; i++) roof(o, [a[i], a[(i + 1) % n2], b[(i + 1) % n2], b[i]], dark);
}
function stair(_o, d, q, width, run, top, bottom) {
  const n = d === 0 ? 2 : d === 1 ? 3 : Math.max(3, Math.ceil((top - bottom) / 0.16));
  for (let i = 0; i < n; i++)
    B(
      q,
      'base',
      0,
      -3,
      ((i + 0.5) * run) / n,
      width,
      top - ((top - bottom) * i) / n + 3,
      run / n,
      stone,
    );
  if (d > 1)
    for (const s of [-1, 1]) {
      beam(
        q,
        'metal',
        [s * width * 0.45, top + 0.9, 0],
        [s * width * 0.45, bottom + 0.9, run],
        0.045,
        0.045,
        dark,
      );
      for (const t of [0, 0.5, 1])
        beam(
          q,
          'metal',
          [s * width * 0.45, top * (1 - t) + bottom * t, t * run],
          [s * width * 0.45, top * (1 - t) + bottom * t + 0.9, t * run],
          0.045,
          0.045,
          dark,
        );
    }
}
function porch(o, d, angle, frontZ, w, small = false) {
  const x = Math.sin(angle) * frontZ,
    z = Math.cos(angle) * frontZ,
    q = transform(o, angle, x, z),
    depth = small ? 9.1 : 9.3,
    top = 17.6,
    ops = [];
  if (small) {
    ops.push({ x: 0, y: 0.55, w: 7.1, h: 9.1, style: 'round', portal: true, depth: 0.75 });
    if (d > 0) for (const x of [-4.7, 0, 4.7]) ops.push({ x, y: 11.1, w: 2.5, h: 5.0 });
    if (d > 1)
      for (const x of [-6.1, 6.1])
        ops.push({ x, y: 4.0, w: 1.45, h: 4.6, niche: true, depth: 0.13 });
  } else {
    ops.push({ x: 0, y: 0.55, w: 7.8, h: 9.35, style: 'round', portal: true, depth: 0.75 });
    if (d > 0) {
      for (const x of [-4.45, 0, 4.45]) ops.push({ x, y: 11.1, w: 2.5, h: 5.1 });
      if (d > 1)
        for (const x of [-6.1, 6.1])
          ops.push({ x, y: 4.0, w: 1.45, h: 4.6, niche: true, depth: 0.13 });
    }
  }
  wall(q, d, w, top, ops, { stoneTop: 3.2 });
  for (const side of [-1, 1]) {
    const v = transform(q, (side * Math.PI) / 2, (side * w) / 2, -depth / 2),
      ops =
        d > 1
          ? [
              { x: 0, y: 4.8, w: 1.8, h: 4.7 },
              { x: 0, y: 11.1, w: 1.9, h: 5.1, style: 'round' },
            ]
          : [];
    wall(v, d, depth, top, ops);
    if (d === 1)
      for (const [y, h] of [
        [4.8, 4.7],
        [11.1, 5.1],
      ])
        flat(
          v,
          'glass',
          [
            [-0.9, y, 0.02],
            [0.9, y, 0.02],
            [0.9, y + h, 0.02],
            [-0.9, y + h, 0.02],
          ],
          glass,
        );
    if (d > 1)
      for (const x of [-depth / 2 + 0.25, depth / 2 - 0.25])
        B(v, 'trim', x, 3.2, 0.08, 0.4, 14.1, 0.25, cream);
  }
  B(q, 'base', 0, -3, -depth / 2, w, 3.5, depth, stone);
  B(q, 'roof', 0, top, -depth / 2, w + 0.4, 0.18, depth + 0.4, dark);
  for (const [y, h] of d === 0
    ? [
        [10.2, 0.2],
        [17.55, 0.25],
      ]
    : [
        [3.2, 0.2],
        [10.2, 0.2],
        [17.55, 0.25],
        [18.5, 0.14],
      ])
    if (y !== 3.2 && !(d === 0 && y === 10.2) && !(d > 0 && y === 18.5))
      B(q, 'trim', 0, y, 0.08, w + 0.35, h, 0.4, cream);
  if (d > 0) {
    for (const x of [-w / 2 + 0.2, -5.8, -3.1, -1.55, 1.55, 3.1, 5.8, w / 2 - 0.2]) {
      if (d === 1 || d === 2) {
        if (d === 2) B(q, 'trim', x, 10.55, 0.17, 0.5, 6.5, 0.45, cream);
        else strip(q, 'trim', [x, 10.55, 0.4], [x, 17.05, 0.4], 0.5, cream);
        strip(q, 'trim', [x - 0.39, 17.05, 0.5], [x + 0.39, 17.05, 0.5], 0.31, cream);
      } else {
        B(q, 'trim', x, 10.55, 0.17, 0.5, 6.5, 0.45, cream);
        B(q, 'trim', x, 16.9, 0.22, 0.78, 0.31, 0.55, cream);
      }
      if (d === 3)
        for (const u of [-0.13, 0, 0.13])
          strip(q, 'trim', [x + u, 11, 0.405], [x + u, 16.6, 0.405], 0.04, stone);
    }
    for (const y of [17.85, 18.5]) B(q, 'trim', 0, y, 0.12, w + 0.4, 0.13, 0.42, cream);
    for (let u = -w / 2 + 0.2; u < w / 2; u += d === 3 ? 0.35 : 0.9)
      if (d === 1 || d === 2) strip(q, 'trim', [u, 18, 0.2], [u, 18.5, 0.2], 0.1, cream);
      else B(q, 'trim', u, 18.0, 0.12, 0.1, 0.5, 0.13, cream);
    if (!small && d > 1)
      for (const x of [-6.1, 6.1]) {
        B(q, 'trim', x, 8.75, 0.12, 2, 0.13, 0.22, cream);
        const p = [
          [x - 1, 8.9, 0.13],
          [x + 1, 8.9, 0.13],
          [x, 9.5, 0.13],
        ];
        flat(q, 'trim', p, cream);
      }
  }
  if (small) {
    const front = [
        [-w / 2 - 0.25, 18.65],
        [w / 2 + 0.25, 18.65],
        [0, 21.5],
      ],
      n = d === 3 ? 24 : 12,
      circle =
        d > 0
          ? Array.from({ length: n }, (_, i) => [
              0.8 * Math.cos((i * Math.PI * 2) / n),
              19.75 + 0.8 * Math.sin((i * Math.PI * 2) / n),
            ])
          : [],
      p = [...front, ...circle],
      ids = earcut(p.flat(), circle.length ? [3] : []);
    for (let i = 0; i < ids.length; i += 3)
      flat(
        q,
        'brick',
        ids.slice(i, i + 3).map((j) => [...p[j], 0.1]),
        brick,
      );
    for (const s of [-1, 1])
      beam(q, 'trim', [s * (w / 2 + 0.3), 18.65, 0.18], [0, 21.5, 0.18], 0.2, 0.22, cream);
    if (d > 0) {
      flat(
        q,
        'glass',
        circle.map((v) => [...v, -0.1]),
        glass,
      );
      outline(q, circle, 0.14, cream, 0.12);
      if (d > 1)
        for (let i = 0; i < circle.length; i++) {
          const a = circle[i],
            b = circle[(i + 1) % circle.length],
            v = [
              [...a, 0.1],
              [...b, 0.1],
              [...b, -0.1],
              [...a, -0.1],
            ];
          quad(q, 'trim', v, normalFor(...v), cream);
        }
    }
  }
  const g = grade(x + Math.sin(angle) * 2.2, z + Math.cos(angle) * 2.2) - 0.1;
  stair(o, d, transform(q, 0, 0, 0.03), small ? 10 : 8.4, 2.2, 0.55, g);
}
const domeY = (r) => 27.2 + (8.45 * (1 - r * r)) / (1 - 0.21 * 0.21),
  domePoint = (r, a, lift = 0) => [DX * r * Math.sin(a), domeY(r) + lift, DZ * r * Math.cos(a)];
function glazingRoof(o, d) {
  const n = d === 0 ? 30 : d === 1 ? 30 : d === 2 ? 60 : 210,
    rows = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 3 : 12;
  profile(
    o,
    'brick',
    DX,
    DZ,
    [
      [22.65, 0],
      [27.2, 0],
    ],
    d === 0 ? 20 : 60,
    brick,
    0,
    0,
  );
  for (const [y, h] of d === 0
    ? []
    : d === 1
      ? [
          [23.5, 0.12],
          [27.1, 0.17],
        ]
      : [
          [23.5, 0.15],
          [24.3, 0.11],
          [26.65, 0.2],
          [27.1, 0.17],
        ])
    band(o, d, y, 0.18, h, DX, DZ, 0, 0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        r = 1 - (0.79 * j) / rows,
        s = 1 - (0.79 * (j + 1)) / rows;
      roof(
        o,
        [domePoint(r, a), domePoint(r, b), domePoint(s, b), domePoint(s, a)],
        rgb(['7d918c', '8fa09a', 'a3aba3'][(i % 8 === 0 ? 1 : 0) + (j % 4 === 0 ? 1 : 0)]),
      );
    }
  if (d > 0) {
    const count = d === 3 ? 210 : d === 2 ? 60 : 30;
    for (let i = 0; i < count; i++)
      for (let j = 0; j < rows; j++) {
        const a = (i * Math.PI * 2) / count,
          p = domePoint(1 - (0.79 * j) / rows, a, 0.05),
          q = domePoint(1 - (0.79 * (j + 1)) / rows, a, 0.05);
        if (i % (count / 30) === 0 && d > 1) beam(o, 'metal', p, q, 0.1, 0.08, stone);
        else strip(o, 'roof', p, q, d === 3 ? 0.035 : 0.05, cream, [Math.sin(a), 0.5, Math.cos(a)]);
      }
    if (d > 1)
      for (let j = 1; j < rows; j++)
        for (let i = 0; i < n; i++) {
          const r = 1 - (0.79 * j) / rows,
            a = (i * Math.PI * 2) / n,
            b = ((i + 1) * Math.PI * 2) / n;
          strip(o, 'roof', domePoint(r, a, 0.06), domePoint(r, b, 0.06), 0.035, cream, [
            Math.sin(a),
            0.8,
            Math.cos(a),
          ]);
        }
  }
  // Intermediate ring of white triangular ventilation pediments, not a second dome or generic onion roof.
  if (d > 0)
    for (let i = 0; i < 30; i++) {
      const a = ((i + 0.5) * Math.PI) / 15,
        r = 0.62,
        p = domePoint(r, a, 0.05),
        q = transform(o, Math.atan2(DZ * Math.sin(a), DX * Math.cos(a)), p[0], p[2]),
        w = ((((2 * Math.PI * (DX + DZ)) / 2) * r) / 30) * 0.87,
        y = p[1];
      flat(
        q,
        'trim',
        [
          [-w / 2, y, 0],
          [w / 2, y, 0],
          [0, y + 1.05, 0],
        ],
        cream,
      );
      if (d === 2) {
        outline(
          q,
          [
            [-w / 2, y],
            [w / 2, y],
            [0, y + 1.05],
          ],
          0.06,
          stone,
          0.09,
        );
      } else if (d > 1) {
        for (const s of [-1, 1])
          beam(q, 'metal', [(s * w) / 2, y, 0.06], [0, y + 1.05, 0.06], 0.09, 0.08, stone);
        B(q, 'metal', 0, y - 0.1, 0, w, 0.12, 0.24, stone);
        if (d === 3)
          flat(
            q,
            'roof',
            [
              [-w * 0.34, y + 0.15, 0.06],
              [w * 0.34, y + 0.15, 0.06],
              [0, y + 0.85, 0.06],
            ],
            roofgrey,
          );
      }
    }
  const rx = DX * 0.21,
    rz = DZ * 0.21,
    n2 = d === 0 ? 12 : d === 1 ? 20 : 30;
  profile(
    o,
    'metal',
    rx,
    rz,
    [
      [35.65, 0],
      [36.15, 0],
    ],
    n2,
    dark,
    0,
    0,
  );
  const p = ellipse(rx, rz, 36.15, n2, 0, 0);
  for (let i = 0; i < n2; i++) roof(o, [p[i], p[(i + 1) % n2], [0, 36.6, 0]], roofgrey);
  if (d > 1) {
    profile(
      o,
      'metal',
      rx + 0.12,
      rz + 0.12,
      [
        [36.16, 0],
        [36.22, 0],
      ],
      n2,
      dark,
      0,
      0,
    );
    for (let i = 0; i < (d === 3 ? 90 : 30); i++) {
      const a = (i * Math.PI * 2) / (d === 3 ? 90 : 30),
        x = (rx + 0.12) * Math.sin(a),
        z = (rz + 0.12) * Math.cos(a);
      if (d === 2)
        strip(o, 'metal', [x, 35.65, z], [x, 36.15, z], 0.035, dark, [Math.sin(a), 0, Math.cos(a)]);
      else beam(o, 'metal', [x, 35.65, z], [x, 36.15, z], 0.035, 0.035, dark);
    }
  }
}
function build(o, d) {
  shell(o, d);
  glazingRoof(o, d);
  porch(o, d, 0, 49.9, 16.2);
  porch(o, d, Math.PI / 2, 45.7, 16.1);
  porch(o, d, -Math.PI / 2, 45.7, 16.1);
  porch(o, d, Math.PI, 51.5, 16.5, true);
}
export const royalAlbertHall = (o) => build(o, 3),
  royalAlbertHallStreet = (o) => build(o, 2),
  royalAlbertHallDistrict = (o) => build(o, 1),
  royalAlbertHallSkyline = (o) => build(o, 0);
const surfaces = {
  castBaluster: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  corniceConsole: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.17 },
  mosaic: { slot: 'trim', graph: 'brick', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.32, metallic: 0.12 },
};
export const royalAlbertHallModel = {
  id: 'royal_albert_hall',
  key: 'royal_albert_hall',
  recipe: 'structure-royal-albert-hall.mjs',
  cell: 'gc/gcp',
  title: 'Royal Albert Hall',
  brief:
    'Five-stage elliptical red-brick/buff terracotta hall, square lower and round upper window rings, pale pilasters/cornices/open balustrades, brown mosaic band with original abstract pale relief rhythm, stepped upper drum, opaque gridded glazed dome with30radial ribs/white intermediate pediment ring and low oval lantern. Three large N/E/W recessed arched porches and smaller pedimented/oculus south porch with entrance flights. No auditorium interior, adjacent college/mansions, detached chimney/memorials or photo pixels.',
  camera: [92, 68, 118],
  lookAt: [0, 15, 0],
  qaCameras: [
    { name: 'front', position: [0, 23, 96], lookAt: [0, 14, 40] },
    { name: 'front-detail', position: [-12, 11, 66], lookAt: [0, 7, 49] },
    { name: 'arcade-detail', position: [-31, 15, 49], lookAt: [-24, 12, 31] },
    { name: 'frieze-detail', position: [22, 24, 53], lookAt: [18, 21, 36] },
    { name: 'baluster-detail', position: [25, 19.8, 40], lookAt: [20.7, 18, 34.6] },
    { name: 'console-detail', position: [25, 24, 40], lookAt: [20.7, 22.15, 34.6] },
    { name: 'roof-detail', position: [40, 52, 39], lookAt: [0, 32, 5] },
    { name: 'base-detail', position: [-32, 5, 47], lookAt: [-23, 3, 32] },
    { name: 'side', position: [79, 25, -16], lookAt: [41, 9, 0] },
    { name: 'back', position: [20, 24, -88], lookAt: [0, 13, -44] },
  ],
  mediumFiContext: { scale: 2, groundY: -3 },
  build: royalAlbertHall,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Two unchanged original Terrarium tiles, dry north sidewalk[-12,49] datum18.3328m,3m review grid/source2.974m spacing. Broad native ground range within fixed below-grade foundation-3m and first-stage plinth; entry stairs continue below sample end grades. Exact thresholds/paving remain estimates; bounded preview, footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-royal-albert-hall.mjs',
    level: 'skyline',
    export: 'royalAlbertHallSkyline',
    errorMeters: 2,
    surfaces,

    authoredLevels: {
      district: { export: 'royalAlbertHallDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'royalAlbertHallStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    'Surviving2012–14 exterior plus current aerial controls form;1986 roof used only as historical comparison and2018temporary scaffolds excluded. Source photographs and primary descriptions inform exterior rather than a surveyed mesh.',
    'Native smooth-ellipse approximation of core73.314m by83.845m and roof58.394m by68.863m with four separately bounded porches; all native vertices retained as controls. Primary MOLA nominal dimensions/street-relative roof36.6m guide vertical hierarchy; database part height43.8/46.6m not treated as same surveyed datum.',
    'Sixty facade bays and30roof divisions preserve visible rhythm; exact bay positions/fine relief/thresholds/doorways and roof glazing subdivisions are original proportional estimates. Original abstract pale figures suggest frieze rhythm without reproducing its artwork or inscriptions.',
    'South lower central arched entrance is proportional reconstruction from1986roof view and2014south photograph; current lower face is partly screened by the separate1851memorial. Door9 image controls recessed threshold details rather than external door count.',
    'Glazing is intentionally opaque for the exterior library. Frieze/pilaster relief and ornamental capitals are simplified; no seating interior/basement, adjacent buildings, detached chimney/memorials, temporary scaffolds/vegetation/crowds/vehicles or photo pixels.',
    'Unchanged original terrain, dry reference18.3328m/fixed-3m foundation/estimated entry thresholds are bounded authoring pose; host terrain compatibility remains dataset-dependent.',
  ],
};
export { glazingRoof, porch, shell };
