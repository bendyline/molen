/** Hotel Ponce de Leon: individually researched courtyard hotel, towers and dining wings. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/dj/djq/ponce_de_leon_hotel/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  wall = rgb('e5ddc8'),
  brick = rgb('aa6955'),
  roof = rgb('a95c43'),
  wood = rgb('baa06b'),
  glass = rgb('465d60'),
  metal = rgb('50756e');
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
function prism(o, loops, low, high, color = wall, slot = 'wall') {
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
function hip(o, x, z, w, l, y, rise) {
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
        roof,
      );
    }
  beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.17, roof);
}
function archShape(o, x, y, z, w, h, d, col = glass, slot = 'glass') {
  const r = w / 2,
    sy = y + h - r,
    p = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, sy, z],
    ],
    n = d > 2 ? 12 : d > 1 ? 6 : 2;
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + Math.cos(a) * r, sy + Math.sin(a) * r, z]);
  }
  o.addConvexPolygon(slot, ref, p, [0, 0, 1], (p) => [p[0], p[1]], col);
}
function archBand(o, x, y, z, w, h, d, t = 0.3) {
  const r = w / 2,
    sy = y + h - r,
    n = d > 2 ? 12 : 3;
  for (const u of [-1, 1]) face(o, 'brick', x + u * (r + t / 2), y, z, t, h - r, brick);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    quad(
      o,
      'brick',
      [
        [x + r * Math.cos(a), sy + r * Math.sin(a), z],
        [x + r * Math.cos(b), sy + r * Math.sin(b), z],
        [x + (r + t) * Math.cos(b), sy + (r + t) * Math.sin(b), z],
        [x + (r + t) * Math.cos(a), sy + (r + t) * Math.sin(a), z],
      ],
      [0, 0, 1],
      brick,
    );
  }
}
function window(o, x, y, z, w, h, d, arched = false) {
  if (!d) return;
  if (arched) archShape(o, x, y, z, w, h, d);
  else face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2) return;
  if (arched) archBand(o, x, y, z + 0.025, w, h, d, 0.22);
  else {
    for (const xx of [-w / 2 - 0.12, w / 2 + 0.12])
      face(o, 'brick', x + xx, y - 0.16, z + 0.025, 0.24, h + 0.32, brick);
    for (const yy of [y - 0.16, y + h]) face(o, 'brick', x, yy, z + 0.026, w + 0.5, 0.16, brick);
  }
  face(o, 'wood', x, y, z + 0.04, 0.08, h, wood);
  if (d > 2) face(o, 'wood', x, y + h * 0.66, z + 0.045, w, 0.09, wood);
  if (d > 2) {
    for (const xx of [-w / 4, w / 4]) face(o, 'wood', x + xx, y, z + 0.045, 0.045, h, wood);
    for (const yy of [h * 0.22, h * 0.44, h * 0.83])
      face(o, 'wood', x, y + yy, z + 0.05, w, 0.045, wood);
  }
}
function rail(o, x, y, z, w, d, slot = 'wood') {
  const col = slot === 'wood' ? wood : brick;
  B(o, slot, x, y, z, w, 0.16, 0.22, col);
  B(o, slot, x, y + 1.0, z, w, 0.15, 0.23, col);
  if (d > 1)
    for (let u = -w / 2 + 0.22; u < w / 2; u += d > 2 ? 0.32 : 0.6) {
      face(o, slot, x + u, y + 0.15, z, 0.065, 0.85, col);
      if (d > 2) face(o, slot, x + u, y + 0.33, z + 0.01, 0.13, 0.38, col);
    }
}
function arcade(o, L, n, y, h, d, { depth = 3, columns = false } = {}) {
  const step = L / n,
    w = step - (columns ? 0.38 : 0.6),
    r = w / 2,
    sy = y + h - r;
  B(o, 'wall', 0, y - 0.25, -depth / 2, L, 0.25, depth + 0.35, wall);
  if (!d) {
    B(o, 'wall', 0, y, -0.25, L, h, 0.5, wall);
    return;
  }
  if (d === 1) {
    B(o, 'wall', 0, y, -0.25, L, h, 0.5, wall);
    for (let i = 0; i < n; i++) archShape(o, -L / 2 + step * (i + 0.5), y, 0.015, w, h - 0.12, d);
    return;
  }
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + i * step;
    B(
      o,
      columns ? 'brick' : 'wall',
      x,
      y,
      -0.2,
      columns ? 0.34 : 0.6,
      sy - y,
      0.7,
      columns ? brick : wall,
    );
    if (d > 2) B(o, 'brick', x, sy - 0.12, -0.18, columns ? 0.65 : 0.82, 0.2, 0.83, brick);
  }
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + step * (i + 0.5),
      segments = d > 2 ? 8 : 4;
    for (let j = 0; j < segments; j++) {
      const a = (j * Math.PI) / segments,
        b = ((j + 1) * Math.PI) / segments,
        xx = [x + r * Math.cos(a), x + r * Math.cos(b)],
        yy = [sy + r * Math.sin(a), sy + r * Math.sin(b)];
      for (const z of [0.15, -0.55])
        quad(
          o,
          'wall',
          [
            [xx[0], yy[0], z],
            [xx[1], yy[1], z],
            [xx[1], y + h + 0.1, z],
            [xx[0], y + h + 0.1, z],
          ],
          [0, 0, z > 0 ? 1 : -1],
          wall,
        );
      quad(
        o,
        'wall',
        [
          [xx[0], yy[0], -0.55],
          [xx[1], yy[1], -0.55],
          [xx[1], yy[1], 0.15],
          [xx[0], yy[0], 0.15],
        ],
        [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
        wall,
      );
    }
    archBand(o, x, y, 0.17, w, h, d, 0.28);
  }
}
function woodGallery(o, L, n, y, h, d, { projected = false } = {}) {
  if (d === 1) {
    face(o, 'glass', 0, y, 0.02, L, h, glass);
    for (let i = 0; i <= n; i++) face(o, 'wood', -L / 2 + (i * L) / n, y, 0.04, 0.18, h, wood);
    return;
  }
  const depth = projected ? 1.65 : 2.2;
  B(o, 'wood', 0, y, -depth / 2, L, 0.24, depth + 0.2, wood);
  if (!d) return;
  const step = L / n;
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + i * step;
    B(o, 'wood', x, y, 0, 0.18, h, 0.22, wood);
    if (d > 2) {
      B(o, 'wood', x, y + h - 0.25, 0, 0.65, 0.18, 0.3, wood);
      for (const s of [-1, 1])
        beam(
          o,
          'wood',
          [x, y + h - 0.7, -0.02],
          [x + s * 0.48, y + h - 0.18, -0.02],
          0.11,
          0.12,
          wood,
        );
    }
  }
  if (projected) rail(o, 0, y + 0.22, 0.08, L, d);
  else B(o, 'wall', 0, y + 0.22, -0.05, L, 0.8, 0.3, wall);
  B(o, 'wood', 0, y + h - 0.1, 0, L, 0.18, 0.25, wood);
  if (d > 2 && projected)
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * step;
      beam(o, 'wood', [x, y - 1.0, -1.25], [x, y - 0.15, 0.02], 0.2, 0.25, wood);
    }
  const p = [
    [-L / 2 - 0.25, y + h, 0.6],
    [L / 2 + 0.25, y + h, 0.6],
    [L / 2 + 0.25, y + h + 0.55, -depth - 0.3],
    [-L / 2 - 0.25, y + h + 0.55, -depth - 0.3],
  ];
  quad(o, 'roof', p, upNormal(p), roof);
}
function quoins(o, w, y0, y1, z, d) {
  if (d < 2) return;
  for (const x of [-w / 2 + 0.22, w / 2 - 0.22]) {
    face(o, 'brick', x, y0, z, 0.44, y1 - y0, brick);
    if (d > 2)
      for (let y = y0; y < y1; y += 0.9)
        face(o, 'brick', x + (x < 0 ? 0.12 : -0.12), y, z + 0.01, 0.7, 0.4, brick);
  }
}
function chimney(o, x, z, y, d) {
  if (d < 3) {
    B(o, 'brick', x, y, z, 1.4, 6.4, 1.4, brick);
    return;
  }
  B(o, 'brick', x, y, z, 1.2, 5.3, 1.25, brick);
  B(o, 'brick', x, y + 4.7, z, 1.65, 0.35, 1.65, brick);
  B(o, 'brick', x, y + 5.3, z, 1.4, 0.3, 1.4, brick);
  if (d > 1) {
    for (const u of [-0.45, 0.45]) B(o, 'brick', x + u, y + 5.6, z, 0.35, 0.75, 0.6, brick);
    B(o, 'wall', x, y + 6.3, z, 1.6, 0.14, 1.4, wall);
  }
}
function dormer(o, x, y, z, w, d) {
  if (d < 2) return;
  B(o, 'wall', x, y, z - 0.65, w, 1.7, 1.4, wall);
  window(o, x, y + 0.15, z + 0.07, w - 0.25, 1.35, d === 2 ? 1 : d);
  const p = [
    [x - w / 2 - 0.2, y + 1.75, z + 0.25],
    [x + w / 2 + 0.2, y + 1.75, z + 0.25],
    [x + w / 2 + 0.2, y + 2.35, z - 1.7],
    [x - w / 2 - 0.2, y + 2.35, z - 1.7],
  ];
  quad(o, 'roof', p, upNormal(p), roof);
}
function tower(o, x, z, d) {
  B(o, 'wall', x, -2, z, 7.4, 33.2, 7.4, wall);
  B(o, 'brick', x, 31.0, z, 8, 0.35, 8, brick);
  const n = d > 1 ? 12 : 6;
  for (let k = 0; k < 4; k++) {
    const f = facing(
      o,
      (k * Math.PI) / 2,
      x + Math.sin((k * Math.PI) / 2) * 3.71,
      z + Math.cos((k * Math.PI) / 2) * 3.71,
    );
    quoins(f, 7.4, 0, 31.1, 0.02, d);
    window(f, 0, 18, 0.04, 1.25, 2.5, d);
    window(f, 0, 27, 0.04, 2.65, 3.5, d, true);
    if (d > 1) {
      B(f, 'brick', 0, 26.7, 0.45, 4.1, 0.3, 1.2, brick);
      rail(f, 0, 27, 0.99, 4.1, d, 'brick');
      if (d > 2)
        for (let u = -1.5; u <= 1.5; u += 0.6)
          beam(f, 'brick', [u, 25.3, 0.02], [u, 26.65, 0.95], 0.2, 0.28, brick);
    }
    const g = facing(
      o,
      (k * Math.PI) / 2,
      x + Math.sin((k * Math.PI) / 2) * 3.85,
      z + Math.cos((k * Math.PI) / 2) * 3.85,
    );
    arcade(g, 7.7, 4, 31.35, 4.8, d, { depth: 0.8, columns: true });
    if (d > 1) rail(g, 0, 31.5, 0.15, 7.7, d, 'brick');
  }
  B(o, 'brick', x, 36.2, z, 8.3, 0.45, 8.3, brick);
  if (d > 1)
    for (let k = 0; k < 4; k++) {
      const f = facing(
        o,
        (k * Math.PI) / 2,
        x + Math.sin((k * Math.PI) / 2) * 4,
        z + Math.cos((k * Math.PI) / 2) * 4,
      );
      rail(f, 0, 36.65, 0.0, 8, d, 'brick');
    }
  loft(
    o,
    'wall',
    [
      radialRing(36.65, 3.05, 3.05, 8, [x, z], Math.PI / 8),
      radialRing(40.8, 3.05, 3.05, 8, [x, z], Math.PI / 8),
    ],
    wall,
  );
  if (d > 1)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        f = facing(o, a, x + Math.sin(a) * 3.07, z + Math.cos(a) * 3.07);
      window(f, 0, 38, 0.02, 1.45, 1.65, d, true);
    }
  loft(
    o,
    'roof',
    [radialRing(40.8, 3.6, 3.6, n, [x, z]), radialRing(48.1, 0.08, 0.08, n, [x, z])],
    roof,
  );
  B(o, 'metal', x, 48.1, z, 0.13, 2.192, 0.13, metal);
  if (d > 1)
    loft(
      o,
      'metal',
      [
        [48.2, 0.13],
        [48.7, 0.3],
        [49.05, 0.13],
      ].map(([y, r]) => radialRing(y, r, r, 8, [x, z])),
      metal,
    );
}
function mirador(o, x, z, d) {
  B(o, 'wall', x, -2, z, 7.5, 23.0, 7.5, wall);
  hip(o, x, z, 9.8, 9.8, 21, 1.6);
  if (!d) return;
  for (let k = 0; k < 4; k++) {
    const f = facing(
      o,
      (k * Math.PI) / 2,
      x + Math.sin((k * Math.PI) / 2) * 3.76,
      z + Math.cos((k * Math.PI) / 2) * 3.76,
    );
    quoins(f, 7.5, 0, 21, 0.01, d);
    if (d > 1) for (const yy of [6.3, 11.7, 16.7]) face(f, 'brick', 0, yy, 0.015, 7.5, 0.16, brick);
    if (d > 1) for (const y of [1.2, 7.6, 12.2]) window(f, 0, y, 0.025, 1.8, 3.1, d, y < 2);
    window(f, 0, 17.6, 0.025, 3.2, 2.8, d, true);
    if (d > 2) for (const u of [-2.3, 2.3]) B(f, 'wood', u, 17.4, 0.1, 0.22, 3.3, 0.25, wood);
  }
}
function main(o, d) {
  // Side-room cores are set back behind open courtyard loggias and third-floor timber galleries.
  for (const side of [-1, 1]) {
    const court = side < 0 ? -22.55 : 19.4,
      outer = side < 0 ? -46.3 : 42.6,
      cx = (outer + court + side * 3.3) / 2;
    B(o, 'wall', cx, -2, 18.3, Math.abs(outer - court) - 3.3, 18.8, 38.2, wall);
    B(o, 'wall', (court + outer) / 2, 6.4, 18.3, Math.abs(outer - court), 5.6, 38.2, wall);
    hip(o, (court + outer) / 2, 18.3, Math.abs(outer - court) + 1.1, 39.2, 16.0, 5.3);
    const front = facing(o, side < 0 ? Math.PI / 2 : -Math.PI / 2, court, 18.3);
    arcade(front, 38.2, 9, 0.55, 5.85, d, { depth: 3.4 });
    woodGallery(front, 38.2, 14, 12, 3.8, d);
    if (d)
      for (let i = 0; i < 9; i++) {
        const x = -17 + i * 4.25;
        window(front, x, 7.6, 0.04, 1.55, 3.15, d);
        if (d > 2) {
          face(front, 'brick', x, 10.9, 0.06, 2.3, 0.5, brick);
          archShape(front, x, 11.15, 0.07, 1.5, 0.65, d, brick, 'brick');
        }
        window(front, x, 1.25, -3.25, 1.65, 3.3, d, true);
        if (d > 1) window(front, x, 12.4, -3.25, 1.5, 2.7, d === 2 ? 1 : d);
      }
    const back = facing(o, side < 0 ? -Math.PI / 2 : Math.PI / 2, outer, 18.3);
    if (d)
      for (let i = 0; i < 9; i++)
        for (const y of [1.3, 7.5, 12.3])
          window(back, -17 + i * 4.25, y, 0.04, 1.6, 3.0, d, d > 1 && y < 2);
    if (d)
      for (const u of [-13, -5, 3, 11]) {
        dormer(front, u, 16.6, -1.5, 2.6, d);
        dormer(back, u, 16.6, -1.5, 2.6, d);
      }
    for (const z of [8, 25]) if (d) chimney(o, cx, z, 19.4, d);
    // Broader ends on King Street, with third-floor projecting balconies and four miradors.
    const fx = side < 0 ? -39.1 : 36.1;
    B(o, 'wall', fx, -2, 42.1, 33.5, 18, 16.1, wall);
    hip(o, fx, 42.4, 34.4, 17.6, 16, 4.8);
    const street = facing(o, 0, fx, 50.2);
    woodGallery(facing(street, 0, 0, 1.55), 18.6, 7, 12.1, 3.7, d, { projected: true });
    if (d)
      for (let i = 0; i < 7; i++) {
        const u = -8.4 + i * 2.8;
        window(street, u, 1.25, 0.04, 1.7, 4.3, d, true);
        window(street, u, 7.4, 0.04, 1.55, 3.2, d, true);
        if (d > 1) window(street, u, 12.3, 0.04, 1.5, 2.9, d === 2 ? 1 : d);
      }
    if (d > 1) {
      for (const yy of [6.3, 11.7]) face(street, 'brick', 0, yy, 0.07, 33.5, 0.18, brick);
    }
    // Exposed ends of the broad street ranges retain conservative window rhythms.
    if (d > 1)
      for (const ss of [-1, 1]) {
        const f = facing(o, (ss * Math.PI) / 2, fx + ss * 16.76, 39.0);
        for (const u of [-2.1, 1.7])
          for (const y of [1.3, 7.6, 12.2]) window(f, u, y, 0.03, 1.5, 3.0, d === 2 ? 1 : d);
      }
    for (const u of [-5.5, 0, 5.5]) dormer(street, u, 17, -1.5, 2.6, d);
    for (const x of side < 0 ? [-52.2, -26.2] : [23.4, 49.0]) mirador(o, x, 46.6, d);
    if (d) for (const x of [fx - 5, fx + 5]) chimney(o, x, 42, 19.1, d);
    // Northern ends of side wings.
    B(o, 'wall', side < 0 ? -39.9 : 36.5, -2, -12.2, 24.8, 23, 18.9, wall);
    hip(o, side < 0 ? -39.9 : 36.5, -12.2, 26.0, 20, 21, 3.5);
    for (const k of [0, 1, 2, 3]) {
      const xx = side < 0 ? -39.9 : 36.5,
        ang = (k * Math.PI) / 2,
        ww = k % 2 ? 18.9 : 24.8,
        dist = k % 2 ? 12.4 : 9.45,
        ff = facing(o, ang, xx + Math.sin(ang) * dist, -12.2 + Math.cos(ang) * dist);
      if (d)
        for (let u = -ww / 2 + 2; u < ww / 2 - 1; u += 4.1)
          for (const y of [1.3, 7.5, 12.5, 17.1])
            window(ff, u, y, 0.025, 1.5, 2.7, d === 2 ? 1 : d);
    }
  }
  // Central block, recessed rooms behind its front arcade, upper gallery and terrace.
  B(o, 'wall', -1.2, -2, -12.4, 53, 26.3, 17.9, wall);
  B(o, 'wall', -1.2, 6.4, -0.75, 41, 5.6, 5.7, wall);
  B(o, 'wall', -1.2, 16.2, -0.75, 41, 7.0, 5.7, wall);
  const front = facing(o, 0, -1.2, 2.13);
  for (const s of [-1, 1]) {
    const q = facing(front, 0, s * 14.1, 0);
    arcade(q, 13, 3, 0.55, 5.85, d);
    woodGallery(q, 13, 5, 12, 3.8, d);
  }
  B(front, 'wall', 0, -2, -1.8, 14.8, 14.0, 3.6, wall);
  B(front, 'wall', 0, 16.2, -1.8, 14.8, 7.0, 3.6, wall);
  B(front, 'wall', 0, 12, -3.5, 14.8, 4.2, 0.6, wall);
  if (d) {
    window(front, 0, 0.6, 0.07, 5.5, 6.0, d, true);
    for (const x of [-6.15, 6.15]) archShape(front, x, 2.8, 0.08, 1.45, 1.45, d);
    for (const x of [-4.5, 0, 4.5])
      for (const u of [-0.95, 0.95]) window(front, x + u, 7.5, 0.06, 1.7, 4.0, d, true);
    woodGallery(front, 14.8, 5, 12.0, 3.8, d);
    if (d > 1) for (const x of [-5, 0, 5]) window(front, x, 12.4, -3.18, 1.6, 2.8, d === 2 ? 1 : d);
    if (d > 1)
      for (const yy of [6.3, 11.7, 16.0]) face(front, 'brick', 0, yy, 0.09, 41, 0.17, brick);
    for (const x of [-18, -12, -6, 0, 6, 12, 18]) window(front, x, 18, 0.05, 1.45, 2.65, d);
  }
  if (d > 1) {
    const rear = facing(o, Math.PI, -1.2, -21.37);
    for (let i = 0; i < 11; i++)
      for (const y of [1.3, 7.5, 12.7, 18.2])
        window(rear, -23 + i * 4.6, y, 0.03, 1.6, 3.1, d === 2 ? 1 : d);
  }
  hip(o, -1.2, -17.0, 53.7, 9.8, 24.3, 2.2);
  // Flat terrace and its pierced Gothic crest are intentionally simplified.
  B(o, 'wall', -1.2, 23.15, -6.0, 43, 0.3, 15, wall);
  if (d > 1)
    for (const s of [-1, 1]) {
      const q = facing(o, 0, s * 15.3 - 1.2, 2.0);
      rail(q, 0, 23.45, 0, 11, d, 'brick');
      if (d > 2)
        for (let x = -5; x <= 5; x += 0.8) {
          const p = [
            [x - 0.32, 24.4, 0.03],
            [x + 0.32, 24.4, 0.03],
            [x, 25.0, 0.03],
          ];
          q.addTriangle(
            'wall',
            ref,
            p,
            [0, 0, 1],
            p.map((v) => [v[0], v[1]]),
            wall,
          );
        }
    }
  B(o, 'wall', 0, 23.4, -10.8, 19.2, 5.3, 19.7, wall);
  hip(o, 0, -10.8, 21.4, 21.4, 28.7, 1.6);
  if (d)
    for (let k = 0; k < 4; k++) {
      const f = facing(
        o,
        (k * Math.PI) / 2,
        Math.sin((k * Math.PI) / 2) * 9.62,
        -10.8 + Math.cos((k * Math.PI) / 2) * 9.9,
      );
      for (let i = 0; i < 8; i++) window(f, -6.1 + i * 1.75, 24.0, 0.03, 1.35, 3.5, d, true);
      if (d > 1) rail(f, 0, 24.0, 0.08, 14.1, d, 'brick');
    }
  const n = d > 1 ? 24 : 8;
  loft(
    o,
    'wall',
    [radialRing(29.2, 5.7, 5.7, n, [0.1, -10.8]), radialRing(31.0, 5.7, 5.7, n, [0.1, -10.8])],
    wall,
  );
  loft(
    o,
    'roof',
    [
      [31, 5.9],
      [31.8, 5.4],
      [32.5, 4.4],
      [33.1, 3.0],
      [33.5, 1.1],
    ].map(([y, r]) => radialRing(y, r, r, n, [0.1, -10.8])),
    roof,
  );
  loft(
    o,
    'metal',
    [
      radialRing(33.5, 1.0, 1.0, d > 1 ? 8 : 4, [0.1, -10.8]),
      radialRing(36.0, 1.0, 1.0, d > 1 ? 8 : 4, [0.1, -10.8]),
    ],
    metal,
  );
  if (d > 1)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        f = facing(o, a, 0.1 + Math.sin(a) * 1.01, -10.8 + Math.cos(a) * 1.01);
      window(f, 0, 33.8, 0.02, 0.42, 1.8, 1);
    }
  loft(
    o,
    'metal',
    [
      [36, 0.0 + 1.2],
      [36.5, 0.8],
      [36.9, 0.12],
    ].map(([y, r]) => radialRing(y, r, r, n, [0.1, -10.8])),
    metal,
  );
  B(o, 'metal', 0.1, 36.8, -10.8, 0.08, 0.8, 0.08, metal);
  for (const x of [-24.7, 22.3]) tower(o, x, -0.75, d);
  if (d) for (const x of [-12.7, 12.5]) chimney(o, x, -8, 26.2, d);
}
function entrance(o, d) {
  const cx = -1.3,
    z = 46.1;
  for (const s of [-1, 1]) {
    const f = facing(o, 0, cx + s * 13.1, z + 3.3);
    arcade(f, 16.7, 5, 0.45, 5.8, d, { depth: 6.2 });
    hip(o, cx + s * 13.1, z, 17.5, 7.5, 6.3, 1.0);
  }
  const f = facing(o, 0, cx, z + 4.0);
  arcade(f, 9.5, 1, 0.45, 7.6, d, { depth: 8.1 });
  B(o, 'brick', cx, 8.15, z, 10.3, 0.35, 9.1, brick);
  B(o, 'wall', cx, 8.5, z, 10.3, 1.9, 9.1, wood);
  hip(o, cx, z, 11.7, 10.3, 10.4, 2.0);
  if (d > 2) {
    for (let i = 0; i < 5; i++) archBand(f, -4 + i * 2, 8.6, 0.8, 1.7, 1.25, d, 0.08);
  }
  if (d < 2) return;
  // Fountain is a distinct architectural object on the courtyard axis; sculptural animals simplified away.
  const n = d > 1 ? 24 : 8,
    x = -1.3,
    zz = 23;
  loft(
    o,
    'wall',
    [
      [0, 0.0 + 5.0],
      [0.3, 5],
      [0.5, 4.7],
    ].map(([y, r]) => radialRing(y, r, r, n, [x, zz])),
    wall,
  );
  loft(
    o,
    'brick',
    [
      [0.4, 1.1],
      [0.8, 0.85],
      [6.8, 0.32],
      [7.1, 0.5],
    ].map(([y, r]) => radialRing(y, r, r, d > 1 ? 12 : 5, [x, zz])),
    brick,
  );
  if (d > 1) {
    loft(
      o,
      'wall',
      [
        [0.9, 1.4],
        [1.3, 1.8],
        [1.5, 1.8],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, zz])),
      wall,
    );
  }
}
function dining(o, frame, d) {
  const feature = (n) => frame.features.find((f) => f.number === n).rings;
  // Actual carriageways beneath the two connecting bridges are kept open.
  for (const [z, l] of [
    [-25.4, 8.1],
    [-59.3, 9.0],
  ]) {
    B(o, 'wall', -2.1, 4.4, z, 26.1, 7.8, l, wall);
    hip(o, -2.1, z, 27.0, l + 0.7, 12.2, 1.3);
    if (d)
      for (const s of [-1, 1]) {
        const f = facing(o, (s * Math.PI) / 2, -2.1 + s * 13.1, z);
        for (const x of [-2.3, 0, 2.3]) window(f, x, 5.7, 0.03, 1.85, 4.8, d, true);
        rail(f, 0, 4.6, 0.08, l, d);
      }
  }
  B(o, 'wall', -2.1, -2, -42.3, 26.1, 18.6, 25.4, wall);
  hip(o, -2.1, -42.3, 27.4, 26.6, 16.6, 4.3);
  for (const num of [22, 25]) {
    const rings = feature(num),
      r = cleanRing(rings[0]);
    prism(o, [r], -2, 4.5);
    const xx = num === 22 ? -15.2 : 11.25,
      zz = -42.3;
    const arc = r.filter((p) => Math.abs(p[0] - xx) > 0.7);
    const full = num === 22 ? [[xx, -29.6], ...arc, [xx, -54.7]] : [[xx, -55], ...arc, [xx, -30.5]];
    // Roof fan covers the semi-round veranda without closing the adjacent carriage passage.
    for (let i = 0; i < full.length - 1; i++) {
      const a = full[i],
        b = full[i + 1],
        p = [
          [xx, 12.8, zz],
          [a[0], 11.1, a[1]],
          [b[0], 11.1, b[1]],
        ];
      o.addTriangle(
        'roof',
        ref,
        p,
        upNormal(p),
        p.map((v) => [v[0], v[2]]),
        roof,
      );
    }
    for (let i = 0; i < full.length - 1; i++) {
      const a = full[i],
        b = full[i + 1],
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let f = edgeFrame(o, b, a);
      const normal = [-(a[1] - b[1]), a[0] - b[0]];
      if (normal[0] * (mid[0] - xx) + normal[1] * (mid[1] - zz) < 0) f = edgeFrame(o, a, b);
      const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (w < 0.2) continue;
      B(f, 'wood', 0, 4.5, -0.05, w, 6.5, 0.25, wood);
      if (d) {
        window(f, 0, 5.0, 0.11, w - 0.35, 5.35, d);
        rail(f, 0, 4.6, 0.17, w, d);
        if (d > 2) {
          B(f, 'wood', -w / 2, 4.5, 0.25, 0.22, 6.5, 0.3, wood);
          beam(f, 'wood', [-w / 2, 10, 0.27], [-w / 2 + 0.5, 10.9, 0.27], 0.18, 0.18, wood);
        }
      }
    }
  }
  if (d)
    for (const s of [-1, 1]) {
      const f = facing(o, (s * Math.PI) / 2, -2.1 + s * 13.1, -42.3);
      for (const x of [-10, -5, 0, 5, 10]) window(f, x, 13.3, 0.03, 2.2, 2.6, d, true);
    }
  // Kenan Hall: original service block, nine bays by three; surrounding later buildings excluded.
  B(o, 'wall', -2.1, -2, -75.0, 59.9, 24.5, 22.0, wall);
  hip(o, -2.1, -75, 61, 23, 22.5, 4.3);
  if (d)
    for (let k = 0; k < 4; k++) {
      const w = k % 2 ? 22 : 59.9,
        dist = k % 2 ? 29.95 : 11,
        ang = (k * Math.PI) / 2,
        f = facing(o, ang, -2.1 + Math.sin(ang) * dist, -75 + Math.cos(ang) * dist),
        n = k % 2 ? 3 : 9;
      for (let i = 0; i < n; i++)
        for (const y of [1.2, 6.8, 12.3, 17.7])
          window(f, -w / 2 + (w * (i + 0.5)) / n, y, 0.03, 1.8, 3.1, d === 2 ? 1 : d);
      for (let i = 0; i < (k % 2 ? 1 : 5); i++)
        dormer(f, (i - ((k % 2 ? 1 : 5) - 1) / 2) * 8.5, 23.3, -2, 2.5, d);
    }
  if (d) for (const x of [-27, 23]) for (const z of [-81, -68]) chimney(o, x, z, 24, d);
}
function ponce(o, _frame, d = 3) {
  const frame = _frame ?? JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  main(o, d);
  entrance(o, d);
  dining(o, frame, d);
}
export function ponceSkyline(o) {
  for (const [x, z, w, l, y, r] of [
    [-34.5, 17.5, 24, 43, 16, 5.3],
    [31, 17.5, 24, 43, 16, 5.3],
    [-39.1, 42.4, 33.5, 16.7, 16, 4.8],
    [36.1, 42.4, 33.5, 16.7, 16, 4.8],
    [-39.9, -12.2, 24.8, 18.9, 21, 3.5],
    [36.5, -12.2, 24.8, 18.9, 21, 3.5],
    [-1.2, -10, 53, 24, 24.3, 0.5],
    [-2.1, -42.3, 26.1, 25.4, 16.6, 4.3],
    [-2.1, -75, 59.9, 22, 22.5, 4.3],
  ]) {
    B(o, 'wall', x, -2, z, w, y + 2, l, wall);
    hip(o, x, z, w + 0.8, l + 0.8, y, r);
  }
  for (const x of [-52.2, -26.2, 23.4, 49]) {
    B(o, 'wall', x, 16, 46.6, 7.5, 5, 7.5, wall);
    hip(o, x, 46.6, 9.8, 9.8, 21, 1.6);
  }
  for (const x of [-24.7, 22.3]) {
    B(o, 'wall', x, 0, -0.75, 7.4, 36.5, 7.4, wall);
    B(o, 'brick', x, 31, -0.75, 8.3, 0.5, 8.3, brick);
    B(o, 'brick', x, 36.5, -0.75, 8.3, 0.4, 8.3, brick);
    loft(
      o,
      'wall',
      [radialRing(36.9, 3.05, 3.05, 8, [x, -0.75]), radialRing(40.8, 3.05, 3.05, 8, [x, -0.75])],
      wall,
    );
    loft(
      o,
      'roof',
      [radialRing(40.8, 3.6, 3.6, 8, [x, -0.75]), radialRing(48.1, 0.08, 0.08, 8, [x, -0.75])],
      roof,
    );
    B(o, 'metal', x, 48.1, -0.75, 0.13, 2.192, 0.13, metal);
  }
  B(o, 'wall', 0, 24.3, -10.8, 19.2, 4.4, 19.7, wall);
  hip(o, 0, -10.8, 21.4, 21.4, 28.7, 1.6);
  loft(
    o,
    'roof',
    [
      [29.4, 5.9],
      [31.8, 5.4],
      [33.5, 1.1],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0.1, -10.8])),
    roof,
  );
  B(o, 'metal', 0.1, 33.5, -10.8, 1.5, 4.1, 1.5, metal);
  for (const x of [-14.4, 11.8]) {
    B(o, 'wall', x, 0, 46.1, 16.7, 6.3, 6.2, wall);
    hip(o, x, 46.1, 17.5, 7.5, 6.3, 1.0);
  }
  B(o, 'wall', -1.3, 0, 46.1, 9.5, 10.4, 8.1, wall);
  hip(o, -1.3, 46.1, 11.7, 10.3, 10.4, 2.0);
  for (const z of [-25.4, -59.3]) B(o, 'wall', -2.1, 4.4, z, 26.1, 7.8, 8.8, wall);
  for (const sign of [-1, 1]) {
    const xx = sign < 0 ? -15.2 : 11.25,
      points = [];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 6;
      points.push([xx + sign * Math.cos(a) * 11.4, -42.3 + Math.sin(a) * 12.6]);
    }
    prism(o, [points], -2, 11.1);
    for (let i = 0; i < 6; i++) {
      const p = [
        [xx, 12.8, -42.3],
        [points[i][0], 11.1, points[i][1]],
        [points[i + 1][0], 11.1, points[i + 1][1]],
      ];
      o.addTriangle(
        'roof',
        ref,
        p,
        upNormal(p),
        p.map((v) => [v[0], v[2]]),
        roof,
      );
    }
  }
}
export function ponceDistrict(o) {
  ponce(o, undefined, 1);
}
export function ponceStreet(o) {
  ponce(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const ponceModel = {
  id: 'ponce_de_leon_hotel',
  recipe: 'structure-ponce-de-leon-hotel.mjs',
  key: 'ponce_de_leon_hotel',
  cell: 'dj/djq',
  title: 'Ponce de Leon Hotel',
  brief:
    'U-shaped Spanish Renaissance hotel with open courtyard loggias, ochre timber galleries, paired water towers, central solarium dome, four King Street miradors and curved dining verandas.',
  camera: [143, 104, 171],
  lookAt: [-1, 13, -16],
  qaCameras: [
    { name: 'front', position: [78, 51, 151], lookAt: [-1, 17, 8] },
    { name: 'back', position: [-122, 75, -166], lookAt: [-1, 13, -43] },
  ],
  build: ponce,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'King Street approach [-1.3,53] outside entry pavilion, independent terrain evidence.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ponce-de-leon-hotel.mjs',
    level: 'skyline',
    export: 'ponceSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'ponceDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'ponceStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior based on six individually inspected local Qualla originals, NPS architectural description and mapped component footprints.',
    'NPS 165-foot tower height governs overall skyline; inconsistent lower map height tags are retained as source evidence. Other vertical dimensions, roof joins and hidden elevations remain estimates.',
    'Main hotel, dining oval and connected original service block included. Separate boiler house/chimney, Artists Studios, later college facilities, interior decoration, fine sculpture and exact inscriptions excluded.',
    'Dated local photographs govern finishes; temporary roof-restoration works visible in current satellite context are excluded. Independent terrain remains unflattened and host-dependent.',
  ],
};
