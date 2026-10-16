/** Bach House in Eisenach: plastered historic house, distinct front and garden elevations. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  plaster = rgb('e0c47f'),
  red = rgb('864d44'),
  wood = rgb('554335'),
  lightwood = rgb('8a6947'),
  stone = rgb('8d7966'),
  mortar = rgb('a29582'),
  iron = rgb('404946'),
  glass = rgb('657577'),
  tile = rgb('736e60');
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
function rect(o, x0, z0, x1, z1, lo, hi, s = 'wall', c = cream) {
  B(o, s, (x0 + x1) / 2, lo, (z0 + z1) / 2, x1 - x0, hi - lo, z1 - z0, c);
}
function line(o, s, a, b, w, c) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    ox = ((-dy / l) * w) / 2,
    oy = ((dx / l) * w) / 2;
  quad(
    o,
    s,
    [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function curved(o, s, points, width, c) {
  for (let i = 1; i < points.length; i++) line(o, s, points[i - 1], points[i], width, c);
}
function outline(o, x, y, w, h, z, s, c) {
  for (const xx of [x - w / 2, x + w / 2]) face(o, s, xx, y, z, 0.035, h, c);
  for (const yy of [y, y + h]) face(o, s, x, yy, z, w, 0.035, c);
}
function noise(i, j) {
  let v = Math.imul(i + 1741, 374761393) ^ Math.imul(j + 331, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function window(
  o,
  x,
  y,
  w,
  h,
  d,
  { n = 1, shutters = false, roundels = false, grille = false } = {},
) {
  if (!d) return;
  face(o, 'wood', x, y - 0.1, 0.055, w + 0.22, h + 0.2, red);
  face(o, 'glass', x, y, 0.08, w, h, glass);
  B(o, 'stone', x, y - 0.12, 0.14, w + 0.3, 0.09, 0.22, stone);
  if (d > 1) {
    for (let j = 0; j < n; j++) {
      const a = x - w / 2 + (j * w) / n + 0.055,
        b = x - w / 2 + ((j + 1) * w) / n - 0.055;
      for (const xx of [a, b]) B(o, 'wood', xx, y, 0.16, 0.06, h, 0.08, wood);
      for (const yy of [y, y + h * 0.26, y + h * 0.74, y + h])
        B(o, 'wood', (a + b) / 2, yy, 0.16, b - a, 0.045, 0.08, wood);
      B(o, 'wood', (a + b) / 2, y, 0.17, 0.035, h, 0.07, wood);
      if (d > 2) {
        if (roundels) {
          for (let row = 0; row < 4; row++)
            for (const sign of [-1, 1]) {
              const cx = (a + b) / 2 + sign * (b - a) * 0.23,
                cy = y + ((row + 0.5) * h) / 4,
                r = Math.min((b - a) * 0.22, h * 0.105);
              curved(
                o,
                'metal',
                Array.from({ length: 9 }, (_, k) => [
                  cx + r * Math.cos((k * Math.PI) / 4),
                  cy + r * Math.sin((k * Math.PI) / 4),
                  0.235,
                ]),
                0.015,
                iron,
              );
            }
        } else {
          for (let k = 1; k < 8; k++)
            face(o, 'metal', (a + b) / 2, y + (h * k) / 8, 0.235, b - a, 0.012, iron);
          for (const sign of [-1, 1])
            face(o, 'metal', (a + b) / 2 + (sign * (b - a)) / 4, y, 0.235, 0.012, h, iron);
        }
      }
    }
  }
  if (shutters) {
    for (const s of [-1, 1]) {
      const xx = x + s * (w / 2 + w / (2 * n) + 0.11);
      B(o, 'wood', xx, y, 0, w / n - 0.08, h, 0.1, iron);
      if (d > 2)
        for (let i = 0; i < 5; i++)
          face(
            o,
            'wood',
            xx - w / (2 * n) + (i * w) / (5 * n),
            y + 0.03,
            0.06,
            0.012,
            h - 0.06,
            wood,
          );
    }
  }
  if (grille && d > 1) {
    for (let i = 0; i < 3; i++) {
      const xx = x - w * 0.32 + i * w * 0.32;
      curved(
        o,
        'metal',
        Array.from({ length: 9 }, (_, k) => [
          xx + 0.035 * Math.sin((k * Math.PI) / 2),
          y + (h * k) / 8,
          0.3,
        ]),
        0.028,
        iron,
      );
    }
    for (let i = 1; i < 4; i++)
      curved(
        o,
        'metal',
        Array.from({ length: 9 }, (_, k) => [
          x - w / 2 + (w * k) / 8,
          y + (h * i) / 4 + 0.04 * Math.sin((k * Math.PI) / 2),
          0.3,
        ]),
        0.028,
        iron,
      );
  }
}
function portal(o, d) {
  const x = 3.75,
    base = 1.25,
    w = 2.1,
    h = 2.65;
  const boundary = (pad, z) => {
    const l = x - w / 2 - pad,
      r = x + w / 2 + pad,
      lo = base - pad,
      top = base + h + pad,
      rr = 0.28 + pad;
    const pts = [
      [l, lo, z],
      [r, lo, z],
      [r, top - rr, z],
    ];
    for (let i = 1; i <= 6; i++) {
      const a = (i * Math.PI) / 12;
      pts.push([r - rr + rr * Math.cos(a), top - rr + rr * Math.sin(a), z]);
    }
    pts.push([l + rr, top, z]);
    for (let i = 1; i <= 6; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 12;
      pts.push([l + rr + rr * Math.cos(a), top - rr + rr * Math.sin(a), z]);
    }
    return pts;
  };
  const polygon = (pts, s, c) => {
    const ids = earcut(pts.flatMap((p) => [p[0], p[1]]));
    for (let i = 0; i < ids.length; i += 3) {
      const q = ids.slice(i, i + 3).map((j) => pts[j]);
      o.addTriangle(
        s,
        ref,
        q,
        [0, 0, 1],
        q.map((p) => [p[0], p[1]]),
        c,
      );
    }
  };
  polygon(boundary(0.18, 0.05), 'wood', red);
  polygon(boundary(0, 0.09), 'wood', wood);
  if (!d) return;
  B(o, 'wood', x, base, 0.15, 0.06, h - 0.1, 0.1, lightwood);
  if (d > 1) {
    for (const sign of [-1, 1]) {
      const cx = x + (sign * w) / 4;
      outline(o, cx, base + 0.15, w * 0.39, 0.67, 0.18, 'wood', lightwood);
      const p = [
        [x + sign * 0.12, base + 1.0, 0.2],
        [x + sign * (w / 2 - 0.15), base + 1.0, 0.2],
        [x + sign * (w / 2 - 0.15), base + 2.39, 0.2],
        [x + sign * 0.12, base + 2.45, 0.2],
      ];
      for (let i = 0; i < 3; i++) line(o, 'wood', p[i], p[i + 1], 0.045, lightwood);
      const ys = Array.from({ length: 13 }, (_, i) => [
        x + sign * (0.12 + ((w / 2 - 0.27) * i) / 12),
        base + 1.84 - 0.29 * Math.sin((i * Math.PI) / 24),
        0.22,
      ]);
      curved(o, 'wood', ys, 0.07, lightwood);
      line(
        o,
        'wood',
        [cx - w * 0.19, base + 0.88, 0.22],
        [cx + w * 0.19, base + 0.88, 0.22],
        0.07,
        wood,
      );
    }
    B(o, 'metal', x + 0.14, base + 1.3, 0.24, 0.065, 0.2, 0.06, iron);
    line(o, 'metal', [x + 0.13, base + 1.43, 0.3], [x + 0.34, base + 1.47, 0.3], 0.045, iron);
  }
  B(o, 'metal', x, 4.18, 0.07, 1.1, 0.52, 0.045, stone);
  if (d > 2)
    for (const xx of [x - 0.48, x + 0.48])
      for (const yy of [4.23, 4.62]) B(o, 'metal', xx, yy, 0.105, 0.035, 0.035, 0.025, iron);
}
function roofY(z) {
  const a = Math.abs(z);
  return a <= 3.8 ? 11.05 - a * 0.96 : 7.402 - (a - 3.8) * 0.6;
}
const frontDormers = [
  [-5.15, 3.7, 7.52, 1.2, 1.5],
  [0.25, 1.5, 9.4, 1.2, 1.55],
  [5.7, 3.75, 7.45, 1.2, 1.5],
];
const backDormers = [
  [-7.4, 3.4, 7.72, 1.12, 1.48],
  [-3.1, 3.45, 7.68, 1.12, 1.48],
  [2.65, 3.45, 7.68, 1.12, 1.48],
  [-5.2, 1.25, 9.65, 0.93, 1.05],
  [6.15, 1.25, 9.65, 0.93, 1.05],
];
function roof(o, d) {
  for (const sign of [-1, 1]) {
    const dormers = sign > 0 ? frontDormers : backDormers;
    const holes = dormers.map(([x, z, _y, w]) => {
      const depth = sign > 0 ? 1.4 : 1.05;
      return [
        [x - w / 2, z - depth],
        [x + w / 2, z - depth],
        [x + w / 2, z],
        [x - w / 2, z],
      ];
    });
    const f = sign > 0 ? o : facing(o, Math.PI);
    // Each pitch has a shallow flared eave, distinct from the steep upper plane.
    for (const [z0, z1] of [
      [0, 3.8],
      [3.8, 5.13],
    ]) {
      const loops = [
        [
          [-10.6, z0],
          [10.6, z0],
          [10.6, z1],
          [-10.6, z1],
        ],
        ...holes.filter((h) => h[0][1] >= z0 && h[2][1] <= z1),
      ];
      // Dormers all lie on the upper pitch; none crosses the flare seam.
      const pts = loops.flat(),
        ids = earcut(
          pts.flat(),
          loops.slice(1).map((_, i) => 4 + i * 4),
        );
      for (let i = 0; i < ids.length; i += 3) {
        const q = ids.slice(i, i + 3).map((j) => [pts[j][0], roofY(pts[j][1]), pts[j][1]]);
        let n = normalFor(...q);
        if (n[1] < 0) n = n.map((v) => -v);
        f.addTriangle(
          'roof',
          ref,
          q,
          n,
          q.map((p) => [p[0], p[2]]),
          tile,
        );
      }
    }
    if (d > 1) {
      const nx = d > 2 ? 91 : 46,
        nz = d > 2 ? 27 : 14;
      for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
          const x0 = -10.6 + (21.2 * i) / nx,
            x1 = -10.6 + (21.2 * (i + 1)) / nx,
            z0 = (5.13 * j) / nz,
            z1 = (5.13 * (j + 1)) / nz;
          if (
            holes.some(
              (h) =>
                x1 > h[0][0] - 0.05 &&
                x0 < h[1][0] + 0.05 &&
                z1 > h[0][1] - 0.04 &&
                z0 < h[2][1] + 0.04,
            )
          )
            continue;
          const v = noise(i, j),
            warm = sign > 0 ? 0.11 : 0.19,
            c =
              v < warm
                ? rgb('ae8058')
                : v < warm + 0.08
                  ? rgb('92795e')
                  : rgb(v < 0.67 ? '68675f' : '555d59');
          const p = [
            [x0, roofY(z0) + 0.035, z0],
            [x1 - 0.012, roofY(z0) + 0.035, z0],
            [x1 - 0.012, roofY(z1) + 0.04, z1],
            [x0, roofY(z1) + 0.04, z1],
          ];
          for (const ids of [
            [0, 1, 2],
            [0, 2, 3],
          ]) {
            const q = ids.map((i) => p[i]);
            let n = normalFor(...q);
            if (n[1] < 0) n = n.map((v) => -v);
            f.addTriangle(
              'roof',
              ref,
              q,
              n,
              q.map((p) => [p[0], p[2]]),
              c,
            );
          }
          if (d > 2) {
            const a = x0 + (x1 - x0) * 0.72,
              b = a + 0.045,
              q = [
                [a, roofY(z0) + 0.07, z0],
                [b, roofY(z0) + 0.07, z0],
                [b, roofY(z1) + 0.08, z1],
                [a, roofY(z1) + 0.08, z1],
              ];
            let n = normalFor(...q);
            if (n[1] < 0) n = n.map((v) => -v);
            quad(f, 'roof', q, n, c);
          }
        }
    }
    for (const a of dormers) dormer(f, ...a, d, sign < 0);
  }
  // Masonry gable ends mostly hidden by separately owned neighboring buildings.
  for (const sign of [-1, 1]) {
    const pts = [
      [sign * 10.1, 6.6, -4.7],
      [sign * 10.1, 6.6, 4.7],
      [sign * 10.1, 11.05, 0],
    ];
    o.addTriangle(
      'wall',
      ref,
      pts,
      [sign, 0, 0],
      pts.map((p) => [p[2], p[1]]),
      plaster,
    );
  }
  B(o, 'roof', 0, 11.02, 0, 21.3, 0.12, 0.18, tile);
  for (const z of [-4.97, 4.97]) {
    B(o, 'wood', 0, 6.5, z, 21, 0.14, 0.2, wood);
    if (d) B(o, 'metal', 0, 6.59, z, 21.1, 0.075, 0.16, iron);
  }
  for (const x of [-2.3, 8.55]) {
    B(o, 'stone', x, 10.7, -0.15, 0.45, 0.93, 0.48, mortar);
    if (d) B(o, 'stone', x, 11.6, -0.15, 0.52, 0.08, 0.55, stone);
  }
}
function dormer(o, x, z, base, w, h, d, shed = false) {
  const f = facing(o, 0, x, z),
    depth = shed ? 1.05 : 1.4,
    top = base + h;
  B(f, 'wood', 0, base, 0, w, h, 0.12, wood);
  window(f, 0, base + 0.1, w - 0.19, h - 0.19, d);
  for (const sign of [-1, 1])
    quad(
      f,
      'wood',
      [
        [(sign * w) / 2, base, 0],
        [(sign * w) / 2, top, 0],
        [(sign * w) / 2, top + 0.3, -depth],
        [(sign * w) / 2, roofY(z - depth), -depth],
      ],
      [sign, 0, 0],
      wood,
    );
  if (shed) {
    const p = [
      [-w * 0.65, top + 0.07, 0.17],
      [w * 0.65, top + 0.07, 0.17],
      [w * 0.65, top + 0.37, -depth],
      [-w * 0.65, top + 0.37, -depth],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(f, 'roof', p, n, tile);
  } else {
    const rise = 0.42;
    const p = [
      [-w * 0.6, top, 0.05],
      [w * 0.6, top, 0.05],
      [0, top + rise, 0.05],
    ];
    f.addTriangle(
      'wood',
      ref,
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      wood,
    );
    for (const sign of [-1, 1]) {
      const p = [
        [sign * w * 0.65, top, 0.2],
        [0, top + rise, 0.2],
        [0, top + rise, -depth],
        [sign * w * 0.65, top, -depth],
      ];
      let n = normalFor(...p);
      if (n[1] < 0) n = n.map((v) => -v);
      quad(f, 'roof', p, n, tile);
      if (d > 1)
        line(f, 'wood', [sign * w * 0.64, top, 0.24], [0, top + rise, 0.24], 0.1, lightwood);
    }
  }
}
function rear(o, d) {
  const f = facing(o, Math.PI, 0, -4.78);
  for (const [x, y, w, h, n] of [
    [-8.2, 5.5, 0.7, 0.65, 1],
    [-6.9, 4.55, 1.05, 1.55, 1],
    [-3.4, 4.55, 1.12, 1.55, 1],
    [0.4, 4.55, 1.25, 1.55, 1],
    [4.6, 4.55, 2.55, 1.55, 2],
    [-9, 3.1, 1.15, 1, 1],
    [-8.45, 1.2, 2.3, 1.05, 2],
    [-3, 2.15, 0.8, 1.1, 1],
    [2.5, 2.3, 1.2, 1.35, 1],
    [6.6, 0.95, 3.25, 2.1, 2],
  ])
    window(f, x, y, w, h, d, { n, grille: y < 4 });
  window(f, 0.15, 0.7, 1.2, 2.45, d, { grille: true });
  if (d > 1) {
    for (const [x, y, w, h] of [
      [-6.8, 3.35, 4.5, 1.0],
      [-5.3, 2.25, 2.8, 1.0],
      [4.8, 3.2, 4.6, 1.0],
      [3.8, 2.05, 2.5, 1.0],
    ]) {
      for (const yy of [y, y + h]) B(f, 'wood', x, yy, 0.13, w, 0.055, 0.06, lightwood);
      for (let i = 0, n = Math.ceil(w / 0.75); i <= n; i++)
        B(f, 'wood', x - w / 2 + (w * i) / n, y - 0.1, 0.14, 0.055, h + 0.2, 0.06, lightwood);
    }
  }
  // Small boarded projection visible at the east end of the garden elevation.
  B(o, 'wood', -9.25, 3.3, -5.0, 1.65, 3.25, 0.85, red);
  const g = facing(o, Math.PI, -9.25, -5.44);
  window(g, 0, 4.95, 0.6, 1.12, d);
  if (d > 1)
    for (let i = 0; i < 13; i++) face(g, 'wood', -0.79 + i * 0.125, 3.33, 0.04, 0.018, 3.17, wood);
  for (const sign of [-1, 1])
    beam(
      o,
      'wood',
      [-9.25 + sign * 0.65, 1.8, -4.8],
      [-9.25 + sign * 0.65, 3.3, -5.35],
      0.1,
      0.1,
      wood,
    );
}
export function bach(o, _frame, d = 3) {
  rect(o, -10.1, -4.75, 10.1, 4.4, -1.8, 6.6, 'wall', plaster);
  rect(o, -10.12, -4.77, 10.12, 4.42, -1.81, 1.0, 'stone', stone);
  // Projecting western room at first-floor level; lower wall remains recessed.
  rect(o, 5.65, 4.38, 10.1, 4.88, 2.65, 6.55, 'wall', plaster);
  roof(o, d);
  const f = facing(o, 0, 0, 4.43);
  for (const [x, y, w, h, n] of [
    [-6.8, 5.05, 4.65, 1.15, 4],
    [-1.6, 5.05, 2.3, 1.15, 2],
    [3.7, 4.9, 2.25, 1.2, 2],
    [-7.5, 2.25, 2.25, 1.65, 2],
    [-4, 2.25, 1.05, 1.65, 1],
    [-0.1, 2.25, 3.65, 1.65, 3],
    [1.9, 1.85, 0.8, 0.85, 1],
    [7.6, 1.65, 0.85, 0.75, 1],
  ])
    window(f, x, y, w, h, d, { n, roundels: x > 1 && y > 4, shutters: h < 1 });
  portal(f, d);
  const bay = facing(o, 0, 0, 4.9);
  for (const x of [6.4, 7.85, 9.3])
    window(bay, x, 3.9, 0.7, 1.35, d, { shutters: true, roundels: true });
  rear(o, d);
  if (d) {
    for (const [x, z] of [
      [-10.12, 4.5],
      [10.12, 4.5],
      [-10.12, -4.85],
      [10.12, -4.85],
    ])
      B(o, 'metal', x, 0.2, z, 0.07, 6.45, 0.07, iron);
    B(o, 'stone', 3.75, 0.75, 4.85, 2.8, 0.5, 0.8, mortar);
    for (let i = 0; i < 7; i++)
      B(o, 'stone', 4, 0.02 + i * 0.17, 7.68 - i * 0.4, 3.5, 0.17, 0.44, stone);
    if (d > 2) {
      for (let row = 0; row < 8; row++) {
        let x = -10.08,
          col = 0;
        while (x < 10.05) {
          const v = noise(col, row + 100),
            w = Math.min(0.34 + v * 0.56, 10.08 - x),
            y = -1.7 + row * 0.33;
          face(
            f,
            'stone',
            x + w / 2,
            y,
            0.018,
            Math.max(0.02, w - 0.045),
            0.24 + noise(row, col + 91) * 0.05,
            rgb(v < 0.33 ? '7d7468' : v < 0.65 ? '96816c' : '8b7c6a'),
          );
          x += w;
          col++;
        }
      }
    }
  }
}
export function bachSkyline(o) {
  bach(o, undefined, 0);
}
export function bachDistrict(o) {
  bach(o, undefined, 1);
}
export function bachStreet(o) {
  bach(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.28 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const bachModel = {
  id: 'bach_house',
  recipe: 'structure-bach-house.mjs',
  key: 'bach_house',
  cell: 'u1/u1p',
  title: 'Bach House (Eisenach)',
  brief:
    'Historic Frauenplan 21 house with ochre plaster, irregular red-bordered casements, projected upper west room, carved double door, steep weathered tile roof, three front gabled dormers and five rear shed dormers. Modern museum extension excluded.',
  camera: [27, 21, 30],
  lookAt: [0, 5, 0],
  qaCameras: [
    { name: 'front', position: [5, 8, 31], lookAt: [0, 5, 0] },
    { name: 'back', position: [-8, 15, -29], lookAt: [0, 5, 0] },
  ],
  build: bach,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent terrain at the front approach [4,8], Y=0; historic portal floor Y=1.25 reached by the front steps. Foundations extend below the falling east street level.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bach-house.mjs',
    level: 'skyline',
    export: 'bachSkyline',
    errorMeters: 0.18,
    surfaces,
    authoredLevels: {
      district: { export: 'bachDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'bachStreet', errorMeters: 0.03, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from two primary and three supplemental individually inspected Qualla originals, official museum history and aerial/map control. Hidden ends, exact dimensions and the small rear projection remain photographic estimates; no surveyed plan.',
    'Surviving historic house only. The timber frame is plastered, so no exposed frame grid is invented. Contemporary museum extension, neighboring buildings, garden landscaping, interiors and photo pixels excluded.',
    'Roof weathering, curved tile profiles, leaded glass, door carving and iron grilles are authored approximations. Small ornament is simplified with distance; no exact lettering reproduced.',
    'Independent unmodified Terrarium ground retained; urban interpolation is not survey accuracy and host terrain may differ. Footprint replacement disabled. No physical-device performance measurement claimed.',
  ],
};
