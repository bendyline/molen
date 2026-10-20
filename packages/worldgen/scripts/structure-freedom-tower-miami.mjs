/** Miami Freedom Tower: Mediterranean base, scrolled portal, setback crown and copper dome/ship vane. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/dh/dhw/freedom_tower_miami/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  stone = rgb('c6bda9'),
  pale = rgb('d8cdb8'),
  shade = rgb('a89f8c'),
  yellow = rgb('c9b473'),
  rear = rgb('bca88d'),
  glass = rgb('304d52'),
  iron = rgb('3c534e'),
  oak = rgb('634032'),
  copper = rgb('63887c'),
  roofColor = rgb('8e8f82');
function quad(o, slot, ps, n, c) {
  if (normalFor(...ps).reduce((s, v, i) => s + v * n[i], 0) < 0) ps = [...ps].reverse();
  rawQuad(o, slot, ps, n, c);
}
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
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
  const p = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    idx = earcut(
      p.flatMap((v) => [v[0], v[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => p[j]);
    if (normalFor(...q).reduce((s, v, k) => s + v * n[k], 0) < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      n,
      q.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
const rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ],
  surface = (o, slot, ps, z, col) =>
    flat(
      o,
      slot,
      ps.map((v) => [...v, z]),
      col,
    );
function wall(o, ps, holes, z = 0, depth = 0.32, col = stone, slot = 'wall') {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z]),
    col,
    holes.map((r) => r.map((p) => [...p, z])),
  );
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [
          [...a, z],
          [...a, z - depth],
          [...b, z - depth],
          [...b, z],
        ];
      quad(o, 'trim', p, normalFor(...p), shade);
    }
}
function panel(o, slot, ps, z0, z1, col) {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z1]),
    col,
  );
  flat(
    o,
    slot,
    ps.map((p) => [...p, z0]),
    col,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, slot, p, normalFor(...p), col);
  }
}
function rod(o, d, slot, a, b, w, col) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy);
    if (l < 1e-7) return;
    const u = [(-dy * w) / l / 2, (dx * w) / l / 2],
      ps = [
        [a[0] - u[0], a[1] - u[1], a[2]],
        [b[0] - u[0], b[1] - u[1], b[2]],
        [b[0] + u[0], b[1] + u[1], b[2]],
        [a[0] + u[0], a[1] + u[1], a[2]],
      ];
    quad(o, slot, ps, normalFor(...ps), col);
  }
}
function facadeBox(o, d, slot, x, y, z, w, h, depth, col) {
  if (d > 2 && slot !== 'metal' && slot !== 'spandrel') {
    B(o, slot, x, y, z, w, h, depth, col);
    return;
  }
  const front = z + depth / 2;
  surface(o, slot, rect(x, y, w, h), front, col);
  if (d > 1 && slot === 'spandrel')
    for (const yy of [y, y + h])
      quad(
        o,
        slot,
        [
          [x - w / 2, yy, z - depth / 2],
          [x + w / 2, yy, z - depth / 2],
          [x + w / 2, yy, front],
          [x - w / 2, yy, front],
        ],
        [0, yy === y ? -1 : 1, 0],
        col,
      );
}
function line(o, d, slot, ps, z, w, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++)
    rod(o, d, slot, [...ps[i - 1], z], [...ps[i % ps.length], z], w, col);
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    s = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + r * Math.cos(a), s + r * Math.sin(a)];
    }),
  ];
}
const bounds = (r) => ({
    x0: Math.min(...r.map((p) => p[0])),
    x1: Math.max(...r.map((p) => p[0])),
    z0: Math.min(...r.map((p) => p[1])),
    z1: Math.max(...r.map((p) => p[1])),
  }),
  baseBounds = bounds(frame.authoredComponents.base),
  towerBounds = bounds(frame.authoredComponents.tower),
  squareBounds = bounds(frame.authoredComponents.squareCrown);
function faces(r) {
  let area = 0;
  for (let i = 0; i < r.length; i++)
    area += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
  const p = area > 0 ? r : [...r].reverse();
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      dx = a[0] - b[0],
      dz = a[1] - b[1];
    return {
      i,
      w: Math.hypot(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
      a: Math.atan2(-dz, dx),
    };
  });
}
const rectangle = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  towerPlan = rectangle(towerBounds.x0, towerBounds.x1, towerBounds.z0, towerBounds.z1),
  squarePlan = rectangle(squareBounds.x0, squareBounds.x1, squareBounds.z0, squareBounds.z1),
  octagon = (radius, cx = 0, cz = 0.25) =>
    Array.from({ length: 8 }, (_, i) => [
      cx + radius * Math.cos(Math.PI / 8 + (i * Math.PI) / 4),
      cz + radius * Math.sin(Math.PI / 8 + (i * Math.PI) / 4),
    ]),
  lanternPlan = octagon(3.1);
function cap(o, r, y, slot = 'roof', col = roofColor) {
  let p = faces(r).map((f) => [f.x, f.z]);
  p = [...r];
  const a = p.reduce(
    (s, v, i) => s + v[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * v[1],
    0,
  );
  if (a > 0) p.reverse();
  const idx = earcut(p.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    o.addTriangle(
      slot,
      ref,
      q,
      [0, 1, 0],
      q.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function solid(o, r, y, h, slot, col) {
  const fs = faces(r);
  for (const f of fs) {
    const q = transform(o, f.a, f.x, f.z);
    surface(q, slot, rect(0, y, f.w, h), 0, col);
  }
  cap(o, r, y + h, slot, col);
}
function band(o, r, y, h, expand = 0, col = pale) {
  const b = bounds(r),
    cx = (b.x0 + b.x1) / 2,
    cz = (b.z0 + b.z1) / 2,
    rr = r.map(([x, z]) => [x + Math.sign(x - cx) * expand, z + Math.sign(z - cz) * expand]);
  solid(o, rr, y, h, 'trim', col);
}
function roofQuad(o, ps, col) {
  let n = normalFor(...ps);
  if (n[1] < 0) n = n.map((v) => -v);
  quad(o, 'roof', ps, n, col);
}
function sample(x, z) {
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
}
function ellipse(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * Math.PI * 2) / n),
    y + ry * Math.sin((i * Math.PI * 2) / n),
  ]);
}
function quatrefoil(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i * Math.PI * 2) / n,
      rr = r * (0.83 + 0.17 * Math.cos(t * 4));
    return [x + rr * Math.cos(t), y + rr * Math.sin(t)];
  });
}
function column(o, d, x, y, z, h, r = 0.22, slot = 'trim', col = pale) {
  const n = d > 2 ? 10 : d > 1 ? 6 : 4,
    levels =
      d > 1
        ? [
            [y, r * 1.3],
            [y + 0.1, r * 1.3],
            [y + 0.18, r],
            [y + h - 0.24, r * 0.91],
            [y + h - 0.16, r * 1.2],
            [y + h - 0.04, r * 1.2],
            [y + h + 0.06, r * 1.4],
          ]
        : [
            [y, r],
            [y + h, r * 0.91],
          ];
  loft(
    o,
    slot,
    levels.map(([yy, rr]) => radialRing(yy, rr, rr, n, [x, z])),
    col,
  );
}
function obelisk(o, d, x, y, z, h = 1.7, w = 0.36) {
  const r = (yy, s) => [
    [x - (w * s) / 2, yy, z - (w * s) / 2],
    [x - (w * s) / 2, yy, z + (w * s) / 2],
    [x + (w * s) / 2, yy, z + (w * s) / 2],
    [x + (w * s) / 2, yy, z - (w * s) / 2],
  ];
  loft(
    o,
    'trim',
    [r(y, 1.25), r(y + h * 0.13, 1.25), r(y + h * 0.18, 1.0), r(y + h * 0.88, 0.14)],
    pale,
  );
  if (d > 1) sphere(o, 'trim', [x, y + h * 0.95, z], [w * 0.16, w * 0.16, w * 0.16], pale, 6, 3);
}
function balustrade(o, d, f, y, h = 1.05) {
  const q = transform(o, f.a, f.x, f.z),
    n = d === 0 ? Math.max(1, Math.round(f.w / 3)) : Math.max(1, Math.round(f.w / 0.53));
  for (const yy of [y, y + h]) {
    if (d > 1) B(q, 'trim', 0, yy, 0, f.w, 0.14, 0.26, pale);
    else surface(q, 'trim', rect(0, yy, f.w, 0.13), 0.08, pale);
  }
  for (let j = 0; j <= n; j++) {
    const x = ((j - n / 2) * f.w) / n;
    if (d > 2)
      loft(
        q,
        'trim',
        [
          [y + 0.1, 0.05],
          [y + 0.25, 0.07],
          [y + h * 0.52, 0.035],
          [y + h * 0.8, 0.06],
          [y + h, 0.05],
        ].map(([yy, rr]) => radialRing(yy, rr, rr, 4, [x, 0.02])),
        pale,
      );
    else if (d > 1) surface(q, 'trim', rect(x, y + 0.1, 0.1, h - 0.1), 0.08, pale);
    else surface(q, 'trim', rect(x, y + 0.1, 0.09, h - 0.1), 0.07, pale);
  }
}
function trimWindow(o, d, p, z, divisions = 2) {
  surface(o, 'glass', p, z - 0.26, glass);
  if (d > 0) {
    line(o, 0, 'trim', p, z + 0.055, 0.1, pale, true);
    const b = {
      x0: Math.min(...p.map((p) => p[0])),
      x1: Math.max(...p.map((p) => p[0])),
      y0: Math.min(...p.map((p) => p[1])),
      y1: Math.max(...p.map((p) => p[1])),
    };
    for (let j = 1; j < divisions; j++)
      facadeBox(
        o,
        d,
        'metal',
        b.x0 + ((b.x1 - b.x0) * j) / divisions,
        b.y0,
        z - 0.16,
        0.035,
        b.y1 - b.y0 - 0.1,
        0.05,
        iron,
      );
    for (let j = 1; j < (d === 2 ? 2 : 3); j++)
      surface(
        o,
        'metal',
        rect((b.x0 + b.x1) / 2, b.y0 + ((b.y1 - b.y0) * j) / 3, b.x1 - b.x0, 0.045),
        z - 0.15,
        iron,
      );
  }
}
function corbels(o, d, r, y) {
  if (d < 1) return;
  for (const f of faces(r)) {
    const q = transform(o, f.a, f.x, f.z),
      n = Math.max(2, Math.round(f.w / 1.4));
    for (let j = 0; j < n; j++) {
      const x = ((j - (n - 1) / 2) * f.w) / n,
        p = [
          [x - 0.17, y],
          [x + 0.17, y],
          [x + 0.24, y + 0.65],
          [x - 0.24, y + 0.65],
        ];
      if (d > 2) panel(q, 'trim', p, -0.07, 0.38, pale);
      else surface(q, 'trim', p, 0.15, pale);
    }
  }
}
function shaft(o, d) {
  for (const f of faces(towerPlan)) {
    const q = transform(o, f.a, f.x, f.z),
      pitch = f.w / 3,
      holes = [];
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 9; k++) holes.push(rect((j - 1) * pitch, 18.1 + k * 4.0, 1.55, 2.35));
    wall(q, rect(0, 16.5, f.w, 36.65), holes, 0, 0.26, yellow);
    for (const p of holes) trimWindow(q, d, p, 0, 2);
    if (d > 0) {
      for (const s of [-1, 1]) {
        const x = s * (f.w / 2 - 0.43);
        facadeBox(q, d, 'trim', x, 16.5, 0.11, 0.84, 36.6, 0.24, pale);
        if (d > 2)
          for (let k = 0; k < 39; k++)
            facadeBox(q, d, 'trim', x + s * 0.28, 16.5 + k * 0.93, 0.15, 0.36, 0.44, 0.18, pale);
      }
      for (const x of [-pitch / 2, pitch / 2])
        surface(q, 'trim', rect(x, 17, 0.055, 35.9), 0.045, stone);
    }
    if (d > 1)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 9; k++) {
          const x = (j - 1) * pitch,
            y = 18.1 + k * 4;
          facadeBox(q, d, 'trim', x, y - 0.11, 0.045, 1.78, 0.13, 0.2, pale);
          if (d > 2)
            for (const s of [-1, 1])
              facadeBox(q, d, 'trim', x + s * 0.87, y - 0.06, 0.08, 0.09, 2.57, 0.2, stone);
        }
  }
  cap(o, towerPlan, 53.15);
  band(o, towerPlan, 52.9, 0.24, 0.28);
  band(o, towerPlan, 53.14, 0.22, 0.55);
  corbels(o, d, towerPlan, 52.55);
}
function front(o, d) {
  const z = baseBounds.z1,
    w =
      Math.max(...frame.authoredComponents.base.filter((p) => p[1] > 6).map((p) => p[0])) -
      Math.min(...frame.authoredComponents.base.filter((p) => p[1] > 6).map((p) => p[0])),
    cx =
      (Math.max(...frame.authoredComponents.base.filter((p) => p[1] > 6).map((p) => p[0])) +
        Math.min(...frame.authoredComponents.base.filter((p) => p[1] > 6).map((p) => p[0]))) /
      2,
    q = transform(o, 0, 0, z),
    columns = [-15.4, -11.8, -8.2, 8.2, 11.8, 15.4],
    holes = [];
  for (const x of columns) {
    holes.push(rect(x, 0.25, 1.05, 1.35));
    holes.push(rect(x, 3.55, 2.05, 5.15));
    holes.push(rect(x, 11.45, 2.05, 2.3));
  }
  const door = arch(0, 0.9144, 3.3, 6.2, d > 1 ? 14 : 6),
    upper = arch(0, 9.0, 1.75, 3.5, d === 2 ? 6 : d > 2 ? 12 : 5),
    foils = [
      quatrefoil(-4.45, 11.05, 0.8, d === 2 ? 20 : d > 2 ? 48 : 16),
      quatrefoil(4.45, 11.05, 0.8, d === 2 ? 20 : d > 2 ? 48 : 16),
    ];
  holes.push(door, upper, ...foils);
  wall(q, rect(cx, -4, w, 19.8), holes, 0, 0.34, yellow);
  for (const p of holes) trimWindow(q, d, p, 0, p === door ? 2 : 3);
  // A closed pair of oak leaves and a separate fanlight are the fixed exterior state.
  surface(q, 'wood', rect(0, 0.9144, 3.3, 4.55), -0.31, oak);
  if (d > 0) {
    for (const x of [-0.81, 0.81])
      for (let k = 0; k < 4; k++) {
        const yy = 1.1 + k * 1.04;
        facadeBox(q, d, 'wood', x, yy, -0.24, 1.3, 0.86, 0.1, rgb('754c35'));
        line(q, 0, 'wood', rect(x, yy, 1.3, 0.86), -0.17, 0.06, rgb('4e342a'), true);
      }
    facadeBox(q, d, 'metal', 0, 0.9144, -0.16, 0.07, 4.55, 0.1, iron);
    const cy = 0.9144 + 6.2 - 1.65;
    for (let j = 0; j <= 8; j++) {
      const a = (j * Math.PI) / 8;
      rod(
        q,
        d > 2 ? 3 : 0,
        'metal',
        [0, cy, -0.11],
        [1.59 * Math.cos(a), cy + 1.59 * Math.sin(a), -0.11],
        0.035,
        iron,
      );
    }
    line(q, 0, 'metal', ellipse(0, cy, 0.46, 0.46, 18), -0.1, 0.035, iron, true);
  }
  for (const x of columns)
    if (d > 0) {
      facadeBox(q, d, 'trim', x, 3.38, 0.12, 2.45, 0.22, 0.32, pale);
      facadeBox(q, d, 'trim', x, 8.73, 0.12, 2.45, 0.28, 0.32, pale);
      facadeBox(q, d, 'trim', x, 13.8, 0.12, 2.45, 0.23, 0.3, pale);
      for (const s of [-1, 1])
        facadeBox(q, d, 'trim', x + s * 1.12, 3.55, 0.11, 0.15, 5.15, 0.28, pale);
      if (d > 2) {
        for (let k = 0; k < 6; k++)
          for (const s of [-1, 1])
            facadeBox(q, d, 'trim', x + s * 1.14, 3.65 + k * 0.82, 0.15, 0.28, 0.36, 0.34, stone);
        line(
          q,
          0,
          'trim',
          [
            [x - 1.2, 14.05],
            [x - 0.5, 14.07],
            [x, 14.38],
            [x + 0.5, 14.07],
            [x + 1.2, 14.05],
          ],
          0.22,
          0.1,
          pale,
        );
      }
    }
  if (d > 0) {
    for (const x of [-17.8, -6.6, 6.6, 17.8])
      facadeBox(q, d, 'trim', x, 1.8, 0.13, 0.65, 12.45, 0.35, pale);
    for (const yy of [1.7, 9.3, 14.2]) facadeBox(q, d, 'trim', cx, yy, 0.12, w, 0.18, 0.36, pale);
  }
  // Shallow, genuinely pierced stone balconies under each group of tall hall lights.
  if (d > 0)
    for (const x of [-11.8, 11.8]) {
      B(q, 'trim', x, 3.0, 0.35, 9.1, 0.18, 0.85, pale);
      balustrade(q, d, { w: 9.1, a: 0, x, z: 0.82 }, 3.18, 0.86);
      if (d > 1)
        for (const s of [-1, 1]) B(q, 'trim', x + s * 4.5, 3.1, 0.38, 0.17, 0.9, 0.9, pale);
    }
  if (d > 1)
    for (const p of foils) {
      line(q, d > 2 ? 3 : 0, 'trim', p, 0.15, 0.15, pale, true);
      line(
        q,
        0,
        'trim',
        p.map(([x, y]) => [x, y + (y - 11.05) * 0.1]),
        0.19,
        0.08,
        pale,
        true,
      );
    }
}
function portal(o, d) {
  const z = baseBounds.z1,
    q = transform(o, 0, 0, z),
    door = arch(0, 0.9144, 3.72, 6.47, d > 1 ? 18 : 7);
  line(q, d > 2 ? 3 : 0, 'trim', door, 0.31, 0.26, pale, true);
  if (d > 1) {
    line(q, 0, 'trim', arch(0, 0.9144, 3.98, 6.65, 18), 0.42, 0.12, stone, true);
    for (const x of [-2.35, 2.35]) {
      column(q, d, x, 0.9144, 0.66, 5.7, 0.32);
      B(q, 'trim', x, 0.9144, 0.66, 0.85, 0.32, 0.85, pale);
      B(q, 'trim', x, 6.35, 0.66, 0.96, 0.32, 0.9, pale);
      if (d > 2) {
        for (const s of [-1, 1])
          rod(q, 0, 'trim', [x + s * 0.28, 6.05, 0.99], [x + s * 0.42, 6.44, 1.02], 0.1, pale);
        sphere(q, 'trim', [x, 6.55, 0.68], [0.3, 0.19, 0.28], pale, 8, 4);
      }
    }
  }
  const curve = Array.from({ length: d > 2 ? 19 : 9 }, (_, j) => {
    const t = j / (d > 2 ? 18 : 8),
      x = 1.05 + 2.4 * t,
      y = 9.2 - 2.05 * Math.sin((t * Math.PI) / 2);
    return [x, y];
  });
  for (const s of [-1, 1]) {
    const p = curve.map(([x, y]) => [s * x, y]);
    line(q, d > 2 ? 3 : 0, 'trim', p, 0.63, 0.36, pale);
    line(
      q,
      0,
      'trim',
      p.map(([x, y]) => [x, y - 0.23]),
      0.8,
      0.1,
      stone,
    );
    if (d > 0) {
      const spiral = Array.from({ length: 25 }, (_, j) => {
        const a = (j * Math.PI * 1.65) / 24,
          r = 0.61 * (1 - j / 29);
        return [s * (1.05 + r * Math.cos(a)), 9.2 + r * Math.sin(a)];
      });
      line(q, d > 2 ? 3 : 0, 'trim', spiral, 0.72, 0.18, pale);
    }
  }
  // Original abstract cartouche and restrained seated figures, without literal sculptural replicas.
  if (d > 0) {
    const p = [
      [0, 6.55],
      [-0.55, 6.9],
      [-0.75, 7.7],
      [-0.53, 8.25],
      [0, 8.55],
      [0.53, 8.25],
      [0.75, 7.7],
      [0.55, 6.9],
    ];
    panel(q, 'trim', p, 0.7, 0.96, pale);
    line(q, 0, 'trim', p, 0.99, 0.11, stone, true);
    if (d > 2)
      for (const s of [-1, 1]) {
        sphere(q, 'trim', [s * 2.05, 9.75, 0.32], [0.18, 0.22, 0.18], pale, 8, 5);
        B(q, 'trim', s * 2.05, 9.05, 0.32, 0.31, 0.53, 0.32, pale);
        beam(q, 'trim', [s * 2.05, 9.16, 0.48], [s * 2.2, 8.75, 0.68], 0.15, 0.16, pale);
      }
  }
  B(q, 'trim', 0, 8.73, 0.53, 2.25, 0.22, 1.12, pale);
  if (d > 0) {
    for (const yy of [9.0, 9.8]) B(q, 'metal', 0, yy, 1.04, 2.15, 0.045, 0.06, iron);
    for (let j = 0; j < 9; j++) {
      const x = (j - 4) * 0.24;
      rod(q, d > 2 ? 3 : 0, 'metal', [x, 9.04, 1.04], [x, 9.8, 1.04], 0.035, iron);
      if (d > 2) line(q, 0, 'metal', ellipse(x, 9.43, 0.09, 0.21, 12), 1.05, 0.025, iron, true);
    }
  }
  // The large swept cornice rises above the ordinary base parapet around a small window.
  const top = Array.from({ length: d > 2 ? 25 : 11 }, (_, j) => {
    const t = j / (d > 2 ? 24 : 10);
    return [1.55 + 7.1 * t, 18.9 - 3.2 * Math.sin((t * Math.PI) / 2)];
  });
  for (const s of [-1, 1]) {
    const p = top.map(([x, y]) => [s * x, y]);
    panel(q, 'trim', [...p, [s * 8.65, 15.2], [s * 1.55, 15.2]], -0.06, 0.18, stone);
    line(q, d > 2 ? 3 : 0, 'trim', p, 0.28, 0.23, pale);
    if (d > 1)
      for (let j = 0; j < 9; j++) {
        const t = (j + 0.5) / 9,
          x = s * (1.55 + 7.1 * t),
          y = 18.9 - 3.2 * Math.sin((t * Math.PI) / 2);
        B(q, 'trim', x, y - 0.45, 0.22, 0.25, 0.3, 0.4, pale);
      }
  }
  const small = rect(0, 17.05, 1.6, 1.82),
    shape = [
      [-1.55, 15.2],
      [1.55, 15.2],
      [1.55, 18.7],
      [0.9, 19.1],
      [0.6, 19.8],
      [0, 20.1],
      [-0.6, 19.8],
      [-0.9, 19.1],
      [-1.55, 18.7],
    ];
  wall(q, shape, [small], 0.2, 0.3, stone, 'trim');
  trimWindow(q, d, small, 0.2, 2);
  line(q, 0, 'trim', shape, 0.39, 0.13, pale, true);
  for (const x of [-6.3, 6.3])
    if (d > 0) for (const dx of [-0.38, 0, 0.38]) obelisk(q, d, x + dx, 16.3, 0.28, 1.6, 0.28);
}
function base(o, d) {
  front(o, d);
  portal(o, d);
  const b = baseBounds;
  for (const f of faces(frame.authoredComponents.base)) {
    const forward = Math.cos(f.a) > 0.98 && f.z > 6;
    if (forward || f.w < 0.001) continue;
    const q = transform(o, f.a, f.x, f.z),
      n = Math.max(1, Math.round(f.w / 4.2)),
      holes = [];
    for (let j = 0; j < n; j++) {
      const x = ((j - (n - 1) / 2) * f.w) / n;
      if (f.w > 2.6)
        for (const [y, w, h] of [
          [0.3, 1.2, 1.3],
          [3.5, 2.1, 3.9],
          [9.5, 2.1, 4.1],
        ])
          holes.push(rect(x, y, w, h));
    }
    wall(q, rect(0, -4, f.w, 19.6), holes, 0, 0.26, rear);
    for (const p of holes) trimWindow(q, d, p, 0, 3);
    if (d > 1 && f.w > 10)
      for (const yy of [2.2, 8.5, 14.6]) surface(q, 'trim', rect(0, yy, f.w, 0.08), 0.02, stone);
  }
  cap(o, frame.authoredComponents.base, 15.6);
  band(o, rectangle(b.x0, b.x1, -6.6, b.z1), 14.75, 0.6, 0.18);
  band(o, rectangle(b.x0, b.x1, -6.6, b.z1), 15.35, 0.25, 0.5);
  corbels(o, d, rectangle(b.x0, b.x1, -6.6, b.z1), 14.25);
  if (d > 0) {
    for (const f of faces(rectangle(b.x0, b.x1, -6.6, b.z1))) {
      if (Math.cos(f.a) > 0.98) {
        const q = transform(o, f.a, f.x, f.z);
        for (const x of [-12, 12]) {
          const sub = transform(q, 0, x, 0);
          const n = 7;
          for (let j = 0; j < n; j++) {
            const u = (j - 3) * 1.05,
              p = quatrefoil(u, 16.1, 0.35, d > 2 ? 24 : 8);
            line(sub, 0, 'trim', p, 0.05, 0.09, pale, true);
          }
          for (const yy of [15.6, 16.65]) B(sub, 'trim', 0, yy, 0, 8.3, 0.14, 0.28, pale);
        }
      } else balustrade(o, d, f, 15.6, 1.05);
    }
    for (const x of [b.x0, b.x1])
      for (const z of [-6.6, b.z1])
        for (const dx of [-0.45, 0, 0.45]) obelisk(o, d, x + dx, 16.7, z, 1.5, 0.26);
  }
  // Plain west printing-wing gable and stepped parapets, directly supported by the rear photograph.
  const rw = 12.4,
    z0 = b.z0,
    z1 = -8.2,
    q = transform(o, Math.PI, 0, z0),
    gable = [
      [-rw / 2, 15.6],
      [rw / 2, 15.6],
      [rw / 2, 18.6],
      [0, 21.0],
      [-rw / 2, 18.6],
    ],
    holes = Array.from({ length: 4 }, (_, j) => rect((j - 1.5) * 2.75, 16.5, 1.9, 1.25));
  wall(q, gable, holes, 0, 0.25, rear);
  for (const p of holes) trimWindow(q, d, p, 0, 3);
  const south = transform(o, 0, 0, z1);
  surface(south, 'wall', gable, 0.0, rear);
  for (const s of [-1, 1]) {
    const ps = [
      [(s * rw) / 2, 18.6, z0],
      [(s * rw) / 2, 18.6, z1],
      [0, 21, z1],
      [0, 21, z0],
    ];
    roofQuad(o, ps, roofColor);
    surface(
      transform(o, (s * Math.PI) / 2, (s * rw) / 2, (z0 + z1) / 2),
      'wall',
      rect(0, 15.6, Math.abs(z1 - z0), 3),
      0,
      rear,
    );
  }
  if (d > 0) line(q, 0, 'trim', gable, 0.08, 0.12, pale, true);
  // Own entrance terrace and six nominal risers; the independent ground is unchanged.
  B(o, 'trim', 0, -4, 7.42, 5.2, 4.9144, 1.65, stone);
  for (let j = 0; j < 6; j++) {
    const top = 0.9144 - j * 0.1524,
      z = 8.2 + j * 0.38;
    B(o, 'trim', 0, -3, z, 4.3, top + 3, 0.4, stone);
  }
  if (d > 0)
    for (const x of [-2.1, 2.1]) {
      beam(o, 'metal', [x, 1.72, 8.1], [x, 0.8, 10.12], 0.045, 0.045, iron);
      for (let j = 0; j < 4; j++)
        B(o, 'metal', x, 0.9144 - j * 0.28, 8.2 + j * 0.59, 0.045, 0.85, 0.045, iron);
    }
}
function turret(o, d, x, z) {
  const r = octagon(0.8, x, z);
  B(o, 'trim', x, 53.36, z, 1.32, 0.69, 1.32, pale);
  for (const f of faces(r)) {
    const q = transform(o, f.a, f.x, f.z),
      p = arch(0, 54.5, f.w * 0.58, 2.2, d === 2 ? 4 : d > 2 ? 6 : 3);
    wall(q, rect(0, 54.05, f.w, 3.5), f.i % 2 ? [p] : [], 0, 0.13, pale, 'trim');
    if (!(f.i % 2) && d > 2) {
      surface(q, 'trim', p, 0.01, stone);
      line(q, 0, 'trim', p, 0.05, 0.06, pale, true);
    }
  }
  cap(o, r, 57.55, 'trim', pale);
  loft(
    o,
    'copper',
    [
      [...r].reverse().map(([x, z]) => [x, 57.55, z]),
      [...r].reverse().map(([xx, zz]) => [x + (xx - x) * 0.13, 58.85, z + (zz - z) * 0.13]),
    ],
    copper,
  );
  if (d > 0) {
    B(o, 'metal', x, 58.8, z, 0.06, 1.2, 0.06, iron);
    if (d > 2)
      for (const yy of [59.1, 59.35, 59.6]) B(o, 'metal', x, yy, z, 0.35, 0.05, 0.05, iron);
  }
}
function squareCrown(o, d) {
  solid(o, squarePlan, 53.36, 0.69, 'trim', pale);
  for (const f of faces(squarePlan)) {
    const q = transform(o, f.a, f.x, f.z),
      holes = [
        arch(0, 57.7, 1.85, 2.45, d === 2 ? 6 : d > 2 ? 10 : 4),
        rect(-f.w * 0.32, 58.2, 1.45, 2.65),
        rect(f.w * 0.32, 58.2, 1.45, 2.65),
      ];
    wall(q, rect(0, 54.05, f.w, 7.35), holes, 0, 0.3, pale, 'trim');
    for (const p of holes) trimWindow(q, d, p, 0, 2);
    if (d > 0) {
      for (const x of [-f.w * 0.2, f.w * 0.2]) {
        facadeBox(q, d, 'trim', x, 54.1, 0.13, 0.28, 7.2, 0.32, pale);
        if (d > 2) {
          for (const dx of [-0.18, 0.18])
            surface(q, 'trim', rect(x + dx, 54.6, 0.07, 6.4), 0.21, stone);
        }
      }
      for (const x of [-f.w * 0.3, 0, f.w * 0.3]) {
        const p = ellipse(x, 56.6, 0.55, 0.52, d > 2 ? 24 : 8);
        line(q, 0, 'trim', p, 0.15, 0.13, stone, true);
      }
      const cartouche = ellipse(0, 61.02, 0.65, 0.83, d > 2 ? 24 : 8);
      surface(q, 'trim', cartouche, 0.2, stone);
      line(q, 0, 'trim', cartouche, 0.29, 0.12, pale, true);
    }
    if (d > 2) {
      line(q, 3, 'trim', arch(0, 57.65, 2.2, 2.7, 12), 0.18, 0.15, pale, true);
      for (const x of [-f.w * 0.32, f.w * 0.32]) {
        line(q, 0, 'trim', rect(x, 54.5, 2.04, 6.65), 0.18, 0.09, stone, true);
        for (const yy of [54.8, 57.5]) facadeBox(q, d, 'trim', x, yy, 0.15, 1.95, 0.13, 0.32, pale);
      }
      for (const side of [-1, 1]) {
        const x = side * f.w * 0.2;
        facadeBox(q, d, 'trim', x, 60.85, 0.22, 0.65, 0.23, 0.46, pale);
        for (const yy of [55.2, 57.0, 58.8]) {
          const p = ellipse(x, yy, 0.17, 0.25, 12);
          line(q, 0, 'trim', p, 0.32, 0.06, pale, true);
        }
      }
    }
    if (d > 2)
      for (const s of [-1, 1]) {
        const curl = Array.from({ length: 19 }, (_, j) => {
          const t = j / 18,
            a = t * Math.PI * 1.8,
            r = 0.48 * (1 - t * 0.65);
          return [s * (f.w * 0.28 + r * Math.cos(a)), 61.0 + r * Math.sin(a)];
        });
        line(q, 0, 'trim', curl, 0.23, 0.1, pale);
      }
  }
  cap(o, squarePlan, 61.4);
  band(o, squarePlan, 61.3, 0.25, 0.4);
  band(o, squarePlan, 61.55, 0.2, 0.65);
  corbels(o, d, squarePlan, 60.7);
  for (const f of faces(squarePlan))
    balustrade(o, d, { ...f, x: f.x * 1.06, z: f.z * 1.06, w: f.w * 1.06 }, 61.75, 1.0);
  for (const x of [squareBounds.x0 - 0.35, squareBounds.x1 + 0.35])
    for (const z of [squareBounds.z0 - 0.35, squareBounds.z1 + 0.35])
      obelisk(o, d, x, 62.9, z, 2.1, 0.42);
  if (d > 0)
    for (const f of faces(squarePlan)) {
      const q = transform(o, f.a, f.x, f.z);
      for (const x of [-f.w * 0.25, f.w * 0.25]) obelisk(q, d, x, 62.9, 0, 1.7, 0.32);
    }
  for (const x of [towerBounds.x0 + 0.25, towerBounds.x1 - 0.25])
    for (const z of [towerBounds.z0 + 0.25, towerBounds.z1 - 0.25]) turret(o, d, x, z);
}
function lantern(o, d) {
  for (const f of faces(lanternPlan)) {
    const q = transform(o, f.a, f.x, f.z),
      open = f.i % 2 === 1,
      p = arch(0, 65.0, f.w * 0.6, 6.4, d === 2 ? 6 : d > 2 ? 12 : 5),
      oc = ellipse(0, 70.7, 0.3, 0.35, d === 2 ? 10 : d > 2 ? 20 : 10),
      holes = open ? [p] : [oc];
    wall(q, rect(0, 61.75, f.w, 10.8), holes, 0, 0.28, pale, 'trim');
    if (open) {
      if (d > 0) balustrade(q, d, { w: f.w * 0.62, a: 0, x: 0, z: 0.06 }, 65.03, 0.75);
    } else {
      const niche = p.map(([x, y]) => [x * 0.88, y]);
      flat(
        q,
        'trim',
        niche.map((p) => [...p, -0.01]),
        stone,
        [oc.map((p) => [...p, -0.01])],
      );
      if (d > 0) line(q, 0, 'trim', niche, 0.07, 0.1, pale, true);
    }
    if (d > 0) {
      line(q, 0, 'trim', open ? p : oc, 0.12, 0.12, pale, true);
      facadeBox(q, d, 'trim', 0, 72.2, 0.13, f.w, 0.28, 0.5, pale);
      if (d > 2) {
        const shield = [
          [-0.28, 71.45],
          [0.28, 71.45],
          [0.3, 72.2],
          [0, 72.45],
          [-0.3, 72.2],
        ];
        panel(q, 'trim', shield, 0.16, 0.4, stone);
      }
    }
  }
  if (d > 0)
    for (const [x, z] of lanternPlan)
      column(o, d, x * 1.04, 63.7, 0.25 + (z - 0.25) * 1.04, 8.0, 0.19);
  cap(o, lanternPlan, 72.55, 'trim', pale);
  band(o, lanternPlan, 72.55, 0.24, 0.24);
  band(o, lanternPlan, 72.79, 0.2, 0.42);
  corbels(o, d, lanternPlan, 72.1);
  for (const f of faces(lanternPlan))
    balustrade(
      o,
      d,
      { ...f, x: f.x * 1.08, z: 0.25 + (f.z - 0.25) * 1.08, w: f.w * 1.08 },
      73.0,
      1.0,
    );
  for (const [x, z] of lanternPlan)
    if (d > 0) {
      if (d > 2) {
        column(o, d, x * 1.08, 73.0, 0.25 + (z - 0.25) * 1.08, 1.45, 0.16);
        sphere(
          o,
          'trim',
          [x * 1.08, 74.5, 0.25 + (z - 0.25) * 1.08],
          [0.2, 0.22, 0.2],
          pale,
          10,
          4,
        );
      } else B(o, 'trim', x * 1.08, 73.0, 0.25 + (z - 0.25) * 1.08, 0.2, 1.6, 0.2, pale);
    }
  const drum = octagon(2.35);
  for (const f of faces(drum)) {
    const q = transform(o, f.a, f.x, f.z),
      hole = rect(0, 74.33, f.w * 0.31, 0.62);
    wall(q, rect(0, 73.0, f.w, 2.5), [hole], 0, 0.18, pale, 'trim');
    surface(q, 'glass', hole, -0.18, glass);
  }
  cap(o, drum, 75.5, 'trim', pale);
}
function dome(o, d) {
  const ring = (y, r) =>
      Array.from({ length: d === 2 ? 16 : d > 2 ? 32 : 8 }, (_, i) => {
        const a = (-i * Math.PI * 2) / (d === 2 ? 16 : d > 2 ? 32 : 8);
        return [r * Math.cos(a), y, 0.25 + r * Math.sin(a)];
      }),
    rs = [
      [75.5, 2.42],
      [76.0, 2.35],
      [76.7, 2.08],
      [77.5, 1.58],
      [78.2, 0.77],
      [78.5, 0.55],
    ];
  loft(
    o,
    'copper',
    rs.map(([y, r]) => ring(y, r)),
    copper,
  );
  if (d > 1) {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      for (let k = 1; k < rs.length; k++) {
        const [y, r] = rs[k],
          [yy, rr] = rs[k - 1];
        rod(
          o,
          0,
          'copper',
          [rr * Math.cos(a), yy, 0.25 + rr * Math.sin(a)],
          [r * Math.cos(a), y, 0.25 + r * Math.sin(a)],
          0.06,
          rgb('8b9e85'),
        );
      }
    }
    for (const [y, r] of d > 2 ? rs.slice(1, -1) : [])
      for (let j = 0; j < 16; j++) {
        const a = (j * Math.PI) / 8,
          b = ((j + 1) * Math.PI) / 8;
        rod(
          o,
          0,
          'copper',
          [r * Math.cos(a), y, 0.25 + r * Math.sin(a)],
          [r * Math.cos(b), y, 0.25 + r * Math.sin(b)],
          0.025,
          iron,
        );
      }
  }
  // Tiny open beacon, a separate cap, and an original ship-shaped weather vane.
  for (let j = 0; j < 8; j += d === 2 ? 2 : 1) {
    const a = (j * Math.PI) / 4;
    column(o, d, 0.48 * Math.cos(a), 78.5, 0.25 + 0.48 * Math.sin(a), 1.35, 0.07, 'copper', copper);
  }
  loft(o, 'copper', [ring(79.84, 0.67), ring(80.5088, 0.1)], copper);
  B(o, 'metal', 0, 80.3, 0.25, 0.08, 6.0, 0.08, iron);
  if (d > 0) {
    sphere(o, 'copper', [0, 81.75, 0.25], [0.28, 0.28, 0.28], copper, 10, 5);
    for (const a of [0, Math.PI / 2])
      beam(
        o,
        'metal',
        [-0.76 * Math.cos(a), 82.3, 0.25 - 0.76 * Math.sin(a)],
        [0.76 * Math.cos(a), 82.3, 0.25 + 0.76 * Math.sin(a)],
        0.045,
        0.045,
        iron,
      );
  }
  const hull = [
    [-1.05, 83.15],
    [0.88, 83.15],
    [0.62, 82.65],
    [-0.56, 82.65],
    [-0.88, 82.82],
  ];
  panel(o, 'copper', hull, 0.16, 0.34, copper);
  B(o, 'metal', 0, 83.0, 0.25, 0.06, 3.3, 0.06, iron);
  if (d > 0) {
    for (const [x, w, h] of [
      [-0.45, 0.7, 2.2],
      [0.24, 0.72, 2.55],
    ]) {
      panel(
        o,
        'copper',
        [
          [x - w / 2, 83.25],
          [x + w / 2, 83.25],
          [x + w * 0.38, 83.25 + h],
          [x - w * 0.25, 83.25 + h - 0.18],
        ],
        0.22,
        0.28,
        copper,
      );
    }
    for (const yy of [83.35, 84.25])
      beam(o, 'metal', [-1.0, yy, 0.25], [0.95, yy + 0.12, 0.25], 0.035, 0.035, iron);
  }
}
function coarse(o, d) {
  const b = baseBounds;
  solid(o, frame.authoredComponents.base, -4, 19.6, 'wall', rear);
  solid(o, towerPlan, 16.5, 36.65, 'wall', yellow);
  band(o, towerPlan, 53.0, 0.36, 0.5);
  solid(o, squarePlan, 53.36, 8.04, 'trim', pale);
  band(o, squarePlan, 61.4, 0.35, 0.65);
  for (const f of faces(towerPlan)) {
    const q = transform(o, f.a, f.x, f.z),
      pitch = f.w / 3;
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 9; k++) {
        const x = (j - 1) * pitch,
          y = 18.1 + k * 4,
          p = rect(x, y, 1.55, 2.35);
        surface(q, 'glass', p, 0.025, glass);
        if (d) {
          line(q, 0, 'trim', p, 0.055, 0.09, pale, true);
          surface(q, 'metal', rect(x, y + 1.1, 1.55, 0.04), 0.04, iron);
        }
      }
    if (d)
      for (const side of [-1, 1])
        surface(q, 'trim', rect(side * (f.w / 2 - 0.43), 16.5, 0.84, 36.6), 0.04, pale);
  }
  for (const f of faces(frame.authoredComponents.base)) {
    if (f.w < 3) continue;
    const q = transform(o, f.a, f.x, f.z),
      front = Math.cos(f.a) > 0.98 && f.z > 6,
      n = front ? 8 : Math.max(1, Math.round(f.w / 5.5));
    for (let j = 0; j < n; j++) {
      const x = ((j - (n - 1) / 2) * f.w) / n;
      if (front && Math.abs(x) < 5) continue;
      for (const [y, w, h] of [
        [3.55, front ? 2.05 : 2.1, front ? 5.15 : 3.9],
        [11.45, 2.05, 2.3],
      ])
        surface(q, 'glass', rect(x, y, w, h), 0.025, glass);
    }
  }
  const q = transform(o, 0, 0, b.z1);
  if (d) portal(o, 1);
  else {
    surface(q, 'glass', arch(0, 0.9144, 3.3, 6.2, 4), 0.03, glass);
    surface(q, 'wood', rect(0, 0.9144, 3.3, 4.55), 0.04, oak);
    for (const sign of [-1, 1]) {
      const c = [
        [sign * 1.2, 18.9],
        [sign * 4.7, 16.6],
        [sign * 8.6, 15.7],
      ];
      line(q, 0, 'trim', c, 0.1, 0.24, pale);
    }
    for (const x of [-4.45, 4.45]) surface(q, 'glass', quatrefoil(x, 11.05, 0.8, 12), 0.03, glass);
  }
  B(o, 'trim', 0, -4, 7.42, 5.2, 4.9144, 1.65, stone);
  B(o, 'trim', 0, -3, 9.2, 4.3, 3.45, 2.25, stone);
  const rw = 12.4,
    z0 = b.z0,
    z1 = -8.2;
  for (const side of [-1, 1]) {
    const ps = [
      [(side * rw) / 2, 18.6, z0],
      [(side * rw) / 2, 18.6, z1],
      [0, 21, z1],
      [0, 21, z0],
    ];
    roofQuad(o, ps, roofColor);
    surface(
      transform(o, Math.PI, 0, z0),
      'wall',
      [
        [-rw / 2, 15.6],
        [rw / 2, 15.6],
        [rw / 2, 18.6],
        [0, 21],
        [-rw / 2, 18.6],
      ],
      0,
      rear,
    );
  }
  for (const f of faces(squarePlan)) {
    const q = transform(o, f.a, f.x, f.z);
    for (const x of [-f.w * 0.32, 0, f.w * 0.32])
      surface(q, 'glass', rect(x, 58.4, 1.4, 2.3), 0.025, glass);
    if (d) balustrade(o, 1, { ...f, x: f.x * 1.06, z: f.z * 1.06, w: f.w * 1.06 }, 61.75, 1);
  }
  for (const x of [towerBounds.x0 + 0.25, towerBounds.x1 - 0.25])
    for (const z of [towerBounds.z0 + 0.25, towerBounds.z1 - 0.25]) {
      if (d) turret(o, 0, x, z);
      else {
        B(o, 'trim', x, 53.36, z, 1.4, 4.19, 1.4, pale);
        loft(
          o,
          'copper',
          [
            radialRing(57.55, 1.0, 1.0, 4, [x, z], Math.PI / 4),
            radialRing(58.85, 0.08, 0.08, 4, [x, z], Math.PI / 4),
          ],
          copper,
        );
      }
    }
  for (const [x, z] of squarePlan)
    loft(
      o,
      'trim',
      [radialRing(62.7, 0.32, 0.32, 4, [x, z]), radialRing(65.0, 0.035, 0.035, 4, [x, z])],
      pale,
    );
  for (const f of faces(lanternPlan)) {
    const q = transform(o, f.a, f.x, f.z),
      p = arch(0, 65.0, f.w * 0.6, 6.4, 3),
      oc = ellipse(0, 70.7, 0.3, 0.35, 8);
    wall(q, rect(0, 61.75, f.w, 10.8), f.i % 2 ? [p] : d ? [oc] : [], 0, 0.28, pale, 'trim');
    if (d && f.i % 2) balustrade(q, 0, { w: f.w * 0.62, a: 0, x: 0, z: 0.06 }, 65.03, 0.75);
  }
  band(o, lanternPlan, 72.55, 0.44, 0.35);
  solid(o, octagon(2.35), 73.0, 2.5, 'trim', pale);
  if (d)
    for (const f of faces(lanternPlan))
      balustrade(
        o,
        1,
        { ...f, x: f.x * 1.08, z: 0.25 + (f.z - 0.25) * 1.08, w: f.w * 1.08 },
        73,
        1,
      );
  const ring = (y, r) => radialRing(y, r, r, 8, [0, 0.25]);
  loft(o, 'copper', [ring(75.5, 2.42), ring(77.5, 1.58), ring(78.5, 0.55)], copper);
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2;
    B(o, 'copper', 0.48 * Math.cos(a), 78.5, 0.25 + 0.48 * Math.sin(a), 0.1, 1.35, 0.1, copper);
  }
  loft(o, 'copper', [ring(79.84, 0.67), ring(80.5088, 0.1)], copper);
  B(o, 'metal', 0, 80.3, 0.25, 0.08, 6, 0.08, iron);
  panel(
    o,
    'copper',
    [
      [-1.05, 83.15],
      [0.88, 83.15],
      [0.62, 82.65],
      [-0.56, 82.65],
      [-0.88, 82.82],
    ],
    0.16,
    0.34,
    copper,
  );
  if (d) {
    panel(
      o,
      'copper',
      [
        [-0.8, 83.25],
        [-0.1, 83.25],
        [-0.15, 85.45],
        [-0.65, 85.25],
      ],
      0.22,
      0.28,
      copper,
    );
    panel(
      o,
      'copper',
      [
        [-0.12, 83.25],
        [0.6, 83.25],
        [0.55, 85.8],
        [0, 85.62],
      ],
      0.22,
      0.28,
      copper,
    );
  }
}
function build(o, d) {
  base(o, d);
  shaft(o, d);
  squareCrown(o, d);
  lantern(o, d);
  dome(o, d);
}
export const freedomTowerMiami = (o) => build(o, 3),
  freedomTowerMiamiStreet = (o) => build(o, 2),
  freedomTowerMiamiDistrict = (o) => coarse(o, 1),
  freedomTowerMiamiSkyline = (o) => coarse(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.48, metallic: 0.06 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.68,
    metallic: 0.3,
    doubleSided: true,
  },
  wood: { slot: 'door', localRef: ref, roughness: 0.86, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.62, metallic: 0.55 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.96, metallic: 0 },
};
export const freedomTowerMiamiModel = {
  id: 'freedom_tower_miami',
  key: 'freedom_tower_miami',
  recipe: 'structure-freedom-tower-miami.mjs',
  cell: 'dh/dhw',
  title: 'Freedom Tower (Miami)',
  brief:
    'Historic Miami Mediterranean tower and attached plain west printing wing. Warm yellow stucco/pale cast-stone corner quoins and deep divided windows; nine plain three-column shaft levels. East portal has semicircular oak doors/fanlight, paired columns/capitals, broken scrolled pediment/original cartouche/abstract seated figures, iron balcony, glazed quatrefoils and large swept cornice/topwindow. Pierced base balconies/parapets/obelisks, raised front terrace/six entrance risers; rear plain divided casements/stepped central gable. Bracketed crown cornices, four real open roofed corner turrets, ornate square stage with arched/rectangular lights/roundels/cartouches, pierced balustrades/obelisks. Octagonal upper lantern with real cardinal arches/alternating blind niches and oculi, engaged columns/capitals, upper balcony/small windowed drum, paneled green copper dome/open beacon and original tall globe/cardinal-cross/ship vane. No neighboring campus/plaza/statue/interiors/scaffolds/photo textures.',
  camera: [76, 57, 102],
  lookAt: [0, 33, -8],
  qaCameras: [
    { name: 'front', position: [0, 36, 110], lookAt: [0, 36, 0] },
    { name: 'entry-detail', position: [9, 7, 23], lookAt: [0, 8, 6.7] },
    { name: 'base-detail', position: [30, 16, 34], lookAt: [0, 11, 0] },
    { name: 'shaft-detail', position: [21, 39, 24], lookAt: [0, 35, 0] },
    { name: 'crown-detail', position: [23, 64, 27], lookAt: [0, 59, 0] },
    { name: 'lantern-detail', position: [14, 72, 17], lookAt: [0, 69, 0.25] },
    { name: 'dome-detail', position: [13, 84, 15], lookAt: [0, 78, 0.25] },
    { name: 'back', position: [-51, 31, -85], lookAt: [0, 18, -24] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -4 },
  build: freedomTowerMiami,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Four unchanged originalTerrarium tiles/2m reviewgrid/source4.302mpixels; dry east Biscayne approach[0,10.5]datum2.5325m. Buried-4mfooting/nominal.9144mentrance/sixrisers, groundunchanged. UrbanDEM/thresholdengineering/otherhosts remainapproximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-freedom-tower-miami.mjs',
    level: 'skyline',
    export: 'freedomTowerMiamiSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'freedomTowerMiamiDistrict', errorMeters: 1, surfaces },
      street: { export: 'freedomTowerMiamiStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: frame.limitations,
};
export {
  balustrade,
  base,
  dome,
  faces,
  front,
  lantern,
  lanternPlan,
  portal,
  sample,
  shaft,
  squareCrown,
  squarePlan,
  towerPlan,
  turret,
};
