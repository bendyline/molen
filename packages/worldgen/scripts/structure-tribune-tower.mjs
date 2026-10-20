/** Historic Chicago Tribune Tower: chamfered limestone shaft and a real open buttress crown. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/dp/dp3/tribune_tower/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  stone = rgb('b8b4a5'),
  pale = rgb('d1caba'),
  shade = rgb('9b988e'),
  spandrel = rgb('625f53'),
  glass = rgb('425961'),
  iron = rgb('535a51'),
  bronze = rgb('8d805d'),
  roofColor = rgb('747973'),
  plan = frame.authoredComponents.tower;

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
function wall(o, ps, holes, z = 0, depth = 0.32, col = stone) {
  flat(
    o,
    'wall',
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
function pointedArch(x, y, w, h, n) {
  const r = w / 2,
    s = y + h * 0.62;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x + r * (1 - t), s + (y + h - s) * Math.sin((t * Math.PI) / 2)];
    }),
    ...Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n;
      return [x - r * t, y + h - (y + h - s) * (1 - Math.cos((t * Math.PI) / 2))];
    }),
  ];
}
function rose(o, d, x, y, r, z) {
  const p = Array.from({ length: 17 }, (_, i) => {
    const t = (i * Math.PI * 2) / 16,
      rr = r * (0.78 + 0.22 * Math.cos(4 * t));
    return [x + rr * Math.cos(t), y + rr * Math.sin(t)];
  });
  line(o, d > 2 ? 3 : 0, 'trim', p, z, 0.1, pale);
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
function faces(scale = 1) {
  return plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length],
      dx = (a[0] - b[0]) * scale,
      dz = (a[1] - b[1]) * scale;
    return {
      i,
      x: ((a[0] + b[0]) * scale) / 2,
      z: ((a[1] + b[1]) * scale) / 2,
      w: Math.hypot(dx, dz),
      a: Math.atan2(-dz, dx),
      wide: i % 2 === 0,
    };
  });
}
function cap(o, y, scale, col = roofColor) {
  const ps = [...plan].reverse().map(([x, z]) => [x * scale, y, z * scale]);
  for (let i = 1; i < ps.length - 1; i++) {
    const q = [ps[0], ps[i], ps[i + 1]];
    o.addTriangle(
      'roof',
      ref,
      q,
      [0, 1, 0],
      q.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function ringBand(o, y, h, scale, col = pale) {
  loft(
    o,
    'trim',
    [
      [...plan].reverse().map(([x, z]) => [x * scale, y, z * scale]),
      [...plan].reverse().map(([x, z]) => [x * scale, y + h, z * scale]),
    ],
    col,
  );
  cap(o, y + h, scale, col);
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
function pinnacle(o, d, x, y, z, h = 3.8, w = 0.7) {
  B(o, 'trim', x, y, z, w, h * 0.57, w, pale);
  const ring = (yy, s) => [
    [x - (w * s) / 2, yy, z - (w * s) / 2],
    [x - (w * s) / 2, yy, z + (w * s) / 2],
    [x + (w * s) / 2, yy, z + (w * s) / 2],
    [x + (w * s) / 2, yy, z - (w * s) / 2],
  ];
  loft(o, 'trim', [ring(y + h * 0.57, 1.18), ring(y + h * 0.92, 0.1)], pale);
  B(o, 'trim', x, y + h * 0.92, z, w * 0.24, h * 0.08, w * 0.24, pale);
  if (d > 2)
    for (const t of h < 3 ? [] : [0.27, 0.55, 0.79])
      for (const s of [-1, 1]) {
        B(o, 'trim', x + s * w * 0.46, y + h * t, z, w * 0.36, 0.15, w * 0.42, stone);
        B(o, 'trim', x, y + h * t, z + s * w * 0.46, w * 0.42, 0.15, w * 0.36, stone);
      }
}
function rail(o, d, f, y, scaleHeight = 2.25) {
  const q = transform(o, f.a, f.x, f.z),
    n = d === 0 ? 2 : Math.max(1, Math.round(f.w / 2.2)),
    step = f.w / n;
  for (const yy of [y, y + scaleHeight])
    d > 1
      ? facadeBox(q, d, 'trim', 0, yy, 0, f.w, 0.18, 0.34, pale)
      : surface(q, 'trim', rect(0, yy, f.w, 0.16), 0.08, pale);
  for (let j = 0; j <= n; j++) {
    const x = -f.w / 2 + j * step;
    d > 1
      ? facadeBox(q, d, 'trim', x, y, 0.01, 0.17, scaleHeight, 0.3, pale)
      : surface(q, 'trim', rect(x, y, 0.17, scaleHeight), 0.1, pale);
  }
  if (d > 0)
    for (let j = 0; j < n; j++) {
      const x = -f.w / 2 + (j + 0.5) * step,
        w = step * 0.8,
        h = scaleHeight * 0.74,
        p = [
          [x - w / 2, y + 0.25],
          [x, y + 0.25 + h],
          [x + w / 2, y + 0.25],
          [x, y + 0.25 + h * 0.3],
        ];
      line(q, d === 3 ? 3 : 0, 'trim', p, 0.05, 0.11, pale, true);
    }
}
function shaft(o, d) {
  for (const f of faces()) {
    const q = transform(o, f.a, f.x, f.z),
      n = f.wide ? 7 : 1,
      pitch = f.w / n,
      w = f.wide ? pitch * 0.58 : f.w * 0.53,
      cols = Array.from({ length: n }, (_, j) => (j - (n - 1) / 2) * pitch),
      holes = cols.map((x) => arch(x, 14.2, w, 84.65, d === 2 ? 5 : d > 2 ? 7 : 4));
    wall(q, rect(0, 13.2, f.w, 87.3), holes, 0, d === 0 ? 0.25 : 0.38);
    for (const x of cols) {
      surface(
        q,
        'glass',
        arch(x, 14.2, w, 84.65, d === 2 ? 5 : d > 2 ? 7 : 4),
        d === 0 ? -0.25 : -0.38,
        glass,
      );
      if (d > 1)
        for (let k = 0; k < 8; k++)
          surface(
            q,
            'glass',
            rect(x, 14.22 + k * 10.8, w, Math.min(10.76, 98.35 - (14.22 + k * 10.8))),
            -0.379,
            rgb(['6b7a7f', '4f666e', '71838a', '53666d'][(k + f.i) % 4]),
          );
      const rows = d === 0 ? [4, 11, 18] : Array.from({ length: 23 }, (_, i) => i);
      for (const j of rows) {
        const yy = 14.2 + j * 3.6;
        if (d > 1) {
          facadeBox(q, d, 'spandrel', x, yy + 2.7, -0.11, w, 0.9, 0.26, spandrel);
          if (d > 2) {
            for (const yy2 of [yy + 0.15, yy + 2.6])
              facadeBox(q, d, 'metal', x, yy2, -0.26, w, 0.045, 0.06, iron);
            for (const s of [-1, 1])
              facadeBox(q, d, 'metal', x + s * w * 0.45, yy, -0.27, 0.045, 2.7, 0.06, iron);
          }
        } else surface(q, 'spandrel', rect(x, yy + 2.7, w, d === 0 ? 1.6 : 0.9), -0.1, spandrel);
        if (d > 2) {
          surface(q, 'spandrel', rect(x, yy + 2.83, w * 0.6, 0.35), 0.03, shade);
          for (const s of [-1, 1])
            rod(
              q,
              0,
              'trim',
              [x + s * w * 0.2, yy + 2.86, 0.04],
              [x + s * w * 0.2, yy + 3.13, 0.04],
              0.045,
              pale,
            );
        }
      }
      if (d > 0) {
        facadeBox(q, d, 'metal', x, 14.2, -0.23, 0.07, 84.2, 0.1, iron);
        if (d > 2)
          for (let j = 0; j < 23; j++)
            surface(q, 'metal', rect(x, 15.48 + j * 3.6, w, 0.055), -0.25, iron);
      }
      // Main channel ends in a rounded, deeply molded Gothic head.
      if (d > 0) {
        const outline = arch(x, 93.2, w + 0.42, 5.65, d === 2 ? 5 : d > 2 ? 8 : 4);
        line(q, 0, 'trim', outline, 0.14, 0.2, pale);
      }
    }
    if (d > 0)
      for (let j = 0; j <= n; j++) {
        const x = (j - n / 2) * pitch;
        facadeBox(q, d, 'trim', x, 13.15, 0.08, 0.17, 88.6, 0.2, pale);
        if (d > 2)
          for (const s of [-1, 1])
            facadeBox(q, d, 'trim', x + s * 0.13, 14, 0.15, 0.07, 87, 0.08, shade);
      }
  }
  cap(o, 100.5, 1);
  if (d > 0) {
    ringBand(o, 13.0, 0.25, 1.015);
    ringBand(o, 100.25, 0.25, 1.015);
  }
}
function base(o, d) {
  for (const f of faces()) {
    const q = transform(o, f.a, f.x, f.z),
      n = f.wide ? 7 : 1,
      pitch = f.w / n,
      west = f.i === 6,
      holes = [],
      portals = [];
    for (let j = 0; j < n; j++) {
      const x = (j - (n - 1) / 2) * pitch,
        center = west && j === Math.floor(n / 2);
      if (center) {
        const p = pointedArch(x, -1.5, 4.6, 9.5, d > 1 ? 12 : 5);
        holes.push(p);
        portals.push({ x, p, main: true });
      } else {
        const p = rect(x, 0.3, pitch * 0.66, 4.6);
        holes.push(p);
        portals.push({ x, p, main: false });
      }
      if (d > 0)
        holes.push(
          arch(
            x,
            west && j === Math.floor(n / 2) ? 8.5 : 6.45,
            pitch * 0.62,
            west && j === Math.floor(n / 2) ? 3.6 : 5.7,
            d === 2 ? 5 : d > 2 ? 8 : 4,
          ),
        );
    }
    wall(q, rect(0, -4, f.w, 17.2), holes, 0, 0.6);
    for (const { x, p, main } of portals) {
      surface(q, 'glass', p, -0.6, glass);
      if (main) {
        surface(q, 'metal', rect(x, -1.5, 4.6, 5.0), -0.58, bronze);
      }
      if (d > 0) {
        line(q, d > 2 ? 3 : 0, 'trim', p, 0.08, main ? 0.29 : 0.13, pale, true);
        if (main)
          line(
            q,
            d > 2 ? 3 : 0,
            'trim',
            p.map(([xx, yy]) => [xx * 1.1, yy + 0.17]),
            0.2,
            0.18,
            pale,
            true,
          );
        for (const xx of [-0.35, 0.35])
          facadeBox(
            q,
            d,
            'metal',
            x + xx * (main ? 3.0 : pitch * 0.7),
            0.35,
            -0.48,
            0.065,
            3.2,
            0.1,
            bronze,
          );
        facadeBox(q, d, 'metal', x, 0.3, -0.43, 0.07, 4.5, 0.1, bronze);
        facadeBox(q, d, 'metal', x, 3.5, -0.43, main ? 5.3 : pitch * 0.6, 0.08, 0.1, bronze);
      }
    }
    for (let j = 0; j < n && d > 0; j++) {
      const x = (j - (n - 1) / 2) * pitch,
        p = arch(
          x,
          west && j === Math.floor(n / 2) ? 8.5 : 6.45,
          pitch * 0.62,
          west && j === Math.floor(n / 2) ? 3.6 : 5.7,
          d === 2 ? 5 : d > 2 ? 8 : 4,
        );
      surface(q, 'glass', p, -0.6, glass);
      line(q, 0, 'trim', p, 0.12, 0.11, pale, true);
      for (const s of d === 2 ? [0] : [-1, 0, 1])
        facadeBox(q, d, 'metal', x + s * pitch * 0.18, 6.5, -0.45, 0.06, 4.7, 0.1, iron);
      for (const yy of [8.0, 10.0])
        facadeBox(q, d, 'metal', x, yy, -0.45, pitch * 0.6, 0.055, 0.1, iron);
    }
    if (d > 1)
      for (let j = 0; j <= n; j++) {
        const x = (j - n / 2) * pitch;
        facadeBox(q, d, 'trim', x, 5.9, 0.18, 0.32, 7.5, 0.5, pale);
        if (d > 2 || j === 0 || j === n || j === Math.floor(n / 2))
          pinnacle(q, d, x, 12.65, 0.22, 2.1, 0.32);
        if (d > 2) {
          for (const s of [-1, 1])
            facadeBox(q, d, 'trim', x + s * 0.18, 6.1, 0.28, 0.085, 6.3, 0.12, pale);
          for (const yy of [6.9, 9.1, 11.3]) {
            const p = [
              [x - 0.22, yy],
              [x, yy + 0.9],
              [x + 0.22, yy],
            ];
            line(q, 0, 'trim', p, 0.48, 0.08, pale);
          }
        }
      }
    if (d > 2) {
      for (let j = 0; j < n; j++) {
        const x = (j - (n - 1) / 2) * pitch;
        for (const yy of [5.1, 12.15]) {
          line(
            q,
            0,
            'trim',
            [
              [x - pitch * 0.27, yy],
              [x, yy + 0.42],
              [x + pitch * 0.27, yy],
            ],
            0.21,
            0.1,
            pale,
          );
          facadeBox(q, d, 'trim', x, yy + 0.16, 0.22, 0.14, 0.17, 0.14, pale);
        }
        // Original foliate relief and fragment patches; no copied inscriptions or literal replicas.
        if (!(west && j === 3))
          for (const [dx, yy, k] of [
            [-0.34, 1.2, 0],
            [0.33, 3.8, 1],
          ])
            surface(
              q,
              'trim',
              rect(x + pitch * dx, yy, 0.32 + 0.15 * (j % 2), 0.28 + 0.18 * k),
              0.025,
              rgb(j % 3 === 0 ? 'b4a58f' : j % 3 === 1 ? 'a5a79a' : 'cbc4ae'),
            );
        rose(q, 0, x, 5.5, 0.32, 0.24);
      }
    }
  }
}
function crownStage(o, d, scale, y, h) {
  for (const f of faces(scale)) {
    const q = transform(o, f.a, f.x, f.z),
      n = scale < 0.5 ? 1 : f.wide ? 3 : 1,
      w = scale < 0.5 ? f.w * 0.46 : f.wide ? f.w * 0.22 : f.w * 0.52,
      holes = [];
    for (let j = 0; j < n; j++) {
      const x = ((j - (n - 1) / 2) * f.w) / (n + 0.4);
      holes.push(arch(x, y + 0.9, w, h - 2, d === 2 ? 5 : d > 2 ? 7 : 4));
    }
    wall(q, rect(0, y, f.w, h), holes, 0, 0.35);
    for (const p of holes) {
      surface(q, 'glass', p, -0.35, glass);
      if (d > 0) {
        line(q, d === 3 ? 3 : 0, 'trim', p, 0.08, 0.16, pale, true);
        const x = p[0][0] + w / 2;
        facadeBox(q, d, 'metal', x, y + 1, -0.22, 0.08, h - 2.4, 0.1, iron);
        for (let k = 1; k < Math.floor(h / 3.6); k++) {
          const yy = y + 1 + k * 3.6;
          facadeBox(q, d, 'spandrel', x, yy, -0.04, w, 0.64, 0.3, spandrel);
          if (d > 2) facadeBox(q, d, 'metal', x, yy - 1.2, -0.23, w, 0.055, 0.08, iron);
        }
      }
    }
    if (d > 1 && scale < 0.5) {
      for (const side of [-1, 1]) {
        const x = side * f.w * 0.34,
          w = f.w * 0.115;
        facadeBox(q, d, 'trim', side * (f.w * 0.245), y, 0.16, 0.28, h, 0.42, pale);
        if (d > 2) {
          const p = pointedArch(x, y + 2.0, w, h - 3.0, 7);
          surface(q, 'trim', p, 0.025, shade);
          line(q, 0, 'trim', p, 0.14, 0.09, pale);
          for (const yy of [y + 3.5, y + 7.5, y + 11.5]) {
            facadeBox(q, d, 'trim', x, yy, 0.15, w * 1.15, 0.17, 0.3, pale);
            panel(
              q,
              'trim',
              [
                [x - w * 0.26, yy + 0.18],
                [x + w * 0.26, yy + 0.18],
                [x, yy + 1.28],
              ],
              0.13,
              0.28,
              pale,
            );
          }
        }
      }
      for (const yy of [y + 6.3, y + 11.1])
        facadeBox(q, d, 'trim', 0, yy, 0.13, f.w * 0.49, 0.36, 0.48, pale);
      if (d > 2) {
        for (const yy of [y + 7.0, y + 12.1]) {
          rose(q, 0, 0, yy, 0.65, 0.34);
          for (const side of [-1, 1])
            line(
              q,
              0,
              'trim',
              pointedArch(side * f.w * 0.115, yy - 0.75, f.w * 0.21, 2.1, 6),
              0.28,
              0.13,
              pale,
            );
        }
      }
    }
    if (d > 1)
      for (const s of [-1, 1])
        facadeBox(q, d, 'trim', s * (f.w / 2 - 0.12), y, 0.11, 0.28, h, 0.3, pale);
  }
  cap(o, y + h, scale);
}
function screens(o, d) {
  for (const f of faces(1.0)) {
    const q = transform(o, f.a, f.x, f.z),
      n = f.wide ? 7 : 1,
      pitch = f.w / n;
    for (let j = 0; j < n; j++) {
      const x = (j - (n - 1) / 2) * pitch,
        center = Math.abs(j - (n - 1) / 2),
        top = f.wide ? 109.8 + (center < 1.1 ? 3.5 : center < 2.1 ? 1.3 : 0) : 108.0,
        w = pitch * 0.69,
        p = pointedArch(x, 99.2, w, top - 99.2, d > 2 ? 6 : 5);
      line(q, d > 2 ? 3 : 0, 'trim', p, 0.13, d > 2 ? 0.21 : 0.19, pale);
      facadeBox(q, d, 'trim', x - pitch * 0.48, 98.9, 0.14, 0.31, top - 98.9, 0.42, pale);
      if (d > 2) {
        const u = w * 0.24;
        for (const s of [-1, 1])
          line(
            q,
            0,
            'trim',
            pointedArch(x + s * u, 100.1, w * 0.45, top - 101.8, 4),
            0.14,
            0.1,
            pale,
          );
        rose(q, 0, x, top - 1.35, 0.48, 0.18);
        pinnacle(q, 0, x - pitch * 0.48, top - 0.1, 0.15, 1.5, 0.33);
      }
    }
  }
  if (d > 2)
    for (const f of faces(0.43)) {
      const q = transform(o, f.a, f.x, f.z);
      for (const yy of [126.0, 132.1]) {
        facadeBox(q, d, 'trim', 0, yy, 0.16, f.w, 0.32, 0.38, pale);
        const n = f.wide ? 3 : 1;
        for (let j = 0; j < n; j++) {
          const x = ((j - (n - 1) / 2) * f.w) / (n + 0.4);
          line(q, 0, 'trim', pointedArch(x, yy + 0.35, (f.w / n) * 0.67, 2.2, 5), 0.2, 0.12, pale);
          rose(q, 0, x, yy + 1.15, 0.38, 0.23);
        }
      }
    }
}
function crown(o, d) {
  crownStage(o, d, 0.61, 100.5, 17.2);
  crownStage(o, d, 0.43, 117.7, 19.2);
  screens(o, d);
  for (const f of faces(0.43)) rail(o, d, f, 136.9, 1.5);
  // Eight free-standing buttress piers and inward curved bridges with real sky below them.
  for (const [x, z] of plan) {
    const r = Math.hypot(x, z),
      L = r * 0.54,
      a = Math.atan2(z, x),
      radial = transform(o, -a, x * 0.43, z * 0.43);
    // Local X runs radially outward from inner crown to the actual native corner.
    const outer = [x * 0.97, z * 0.97];
    B(o, 'wall', outer[0], 98.8, outer[1], d === 0 ? 0.8 : 1.65, 28.3, d === 0 ? 0.8 : 1.65, stone);
    pinnacle(o, d, outer[0], 127.1, outer[1], 2.8, 0.72);
    if (d > 1) {
      B(o, 'trim', outer[0], 99, outer[1], 1.3, 1.0, 1.3, pale);
      B(o, 'trim', outer[0], 125.8, outer[1], 1.22, 0.5, 1.22, pale);
    }
    const n = d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 6 : 14,
      curve = Array.from({ length: n + 1 }, (_, j) => {
        const t = j / n;
        return [L * t, 124.7 - 13.7 * t + 3.4 * Math.sin(Math.PI * t)];
      }),
      top = curve.map(([u, y]) => [u, y + 1.1]);
    panel(radial, 'trim', [...curve, ...top.reverse()], -0.4, 0.4, pale);
    if (d > 0) {
      const railTop = (t) => 126.2 - 2.1 * t,
        bottom = (t) => 124.7 - 13.7 * t + 3.4 * Math.sin(Math.PI * t) + 1.15;
      const bays = d === 1 ? 2 : 3;
      for (let j = 0; j < bays; j++) {
        const t = (j + 0.5) / bays,
          u = t * L,
          low = bottom(t),
          hi = railTop(t),
          hh = hi - low;
        rod(radial, d === 3 ? 3 : 0, 'trim', [u, low, 0], [u, hi, 0], 0.16, pale);
        if (hh > 1.3 && d > 1) {
          const w = (L / bays) * 0.6,
            ps = arch(u, low + 0.2, w, Math.max(w / 2 + 0.1, hh - 0.55), 6);
          line(radial, d === 3 ? 3 : 0, 'trim', ps, 0.02, 0.14, pale);
        }
      }
      rod(radial, d === 3 ? 3 : 0, 'trim', [0, railTop(0), 0], [L, railTop(1), 0], 0.3, pale);
    }
    if (d > 2) {
      for (const side of [-1, 1]) {
        B(o, 'trim', outer[0] + side * 0.67, 99.2, outer[1], 0.18, 27.8, 1.7, pale);
        B(o, 'trim', outer[0], 99.2, outer[1] + side * 0.67, 1.7, 27.8, 0.18, pale);
      }
      for (const zz of [-0.43, 0.43]) line(radial, 0, 'trim', curve, zz, 0.16, pale);
    }
    if (d > 1) {
      const inner = [x * 0.43, z * 0.43];
      B(o, 'trim', inner[0], 116.8, inner[1], 1.1, 20.4, 1.1, pale);
      pinnacle(o, d, inner[0], 136.9, inner[1], 4.8, 0.6);
      for (const yy of [104.0, 111.0, 118.4, 126.0]) {
        const sc = yy < 117 ? 0.61 : 0.43,
          xx = x * sc,
          zz = z * sc;
        B(o, 'trim', xx, yy, zz, 0.65, 0.36, 0.65, pale);
        if (d > 2) {
          const len = 0.75,
            ex = x / r,
            ez = z / r;
          beam(
            o,
            'trim',
            [xx, yy + 0.1, zz],
            [xx + ex * len, yy - 0.1, zz + ez * len],
            0.17,
            0.18,
            shade,
          );
          B(o, 'trim', xx + ex * len, yy - 0.28, zz + ez * len, 0.28, 0.32, 0.25, pale);
        }
      }
    } else pinnacle(o, 0, x * 0.43, 136.9, z * 0.43, 4.8, 0.45);
    if (d > 2) {
      const xx = x * 0.61,
        zz = z * 0.61;
      B(o, 'trim', xx, 100.4, zz, 0.6, 17, 0.6, pale);
    }
  }
  cap(o, 136.9, 0.43);
  // Metal guard and fixed flagpole; time-dependent flag cloth and antennas omitted.
  if (d > 0)
    for (const f of faces(0.425)) {
      const q = transform(o, f.a, f.x, f.z);
      for (const yy of [138.3, 138.9]) surface(q, 'metal', rect(0, yy, f.w, 0.055), 0, iron);
      for (let j = 0; j < 3; j++)
        surface(q, 'metal', rect(((j - 1) * f.w) / 3, 138.3, 0.05, 0.65), 0, iron);
    }
  B(o, 'metal', 0, 136.8, 0, d === 0 ? 0.11 : 0.08, 9, 0.08, iron);
  if (d > 1) B(o, 'metal', 0, 145.72, 0, 0.15, 0.08, 0.15, bronze);
}
function skyline(o, detail = 0) {
  const rs = (s, y) => [...plan].reverse().map(([x, z]) => [x * s, y, z * s]);
  for (const [s, y, h] of [
    [1, -4, 104.5],
    [0.61, 100.5, 17.2],
    [0.43, 117.7, 19.2],
  ]) {
    loft(o, 'wall', [rs(s, y), rs(s, y + h)], stone);
    cap(o, y + h, s);
  }
  for (const f of faces()) {
    const q = transform(o, f.a, f.x, f.z),
      n = f.wide ? 7 : 1,
      w = (f.w / n) * 0.57;
    for (let j = 0; j < n; j++) {
      const x = ((j - (n - 1) / 2) * f.w) / n;
      surface(q, 'glass', rect(x, 14, w, 84), 0.025, glass);
      for (const yy of detail ? Array.from({ length: 23 }, (_, i) => 16.9 + i * 3.6) : [29, 54, 79])
        surface(q, 'spandrel', rect(x, yy, w, 1.8), 0.035, spandrel);
    }
    if (f.i === 6) surface(q, 'glass', arch(0, -2, 4.6, 10, 4), 0.03, spandrel);
  }
  for (const s of [0.61, 0.43])
    for (const f of faces(s)) {
      const q = transform(o, f.a, f.x, f.z),
        y = s === 0.61 ? 102 : 121,
        n = s < 0.5 ? 1 : f.wide ? 3 : 1;
      for (let j = 0; j < n; j++)
        surface(
          q,
          'glass',
          rect(((j - (n - 1) / 2) * f.w) / (n + 0.5), y, (f.w / n) * (s < 0.5 ? 0.46 : 0.55), 14),
          0.02,
          glass,
        );
    }
  for (const [x, z] of plan) {
    const r = Math.hypot(x, z),
      L = r * 0.54,
      q = transform(o, -Math.atan2(z, x), x * 0.43, z * 0.43);
    B(o, 'wall', x * 0.97, 98.8, z * 0.97, 0.9, 28.3, 0.9, stone);
    const c = Array.from({ length: 4 }, (_, j) => {
      const t = j / 3;
      return [L * t, 124.7 - 13.7 * t + 3.4 * Math.sin(Math.PI * t)];
    });
    panel(q, 'trim', [...c, ...c.map(([u, y]) => [u, y + 1.2]).reverse()], -0.4, 0.4, pale);
    for (const [s, y, h] of [
      [0.97, 127.1, 2.8],
      [0.43, 136.9, 4.8],
    ]) {
      const xx = x * s,
        zz = z * s;
      loft(
        o,
        'trim',
        [
          [
            [xx - 0.35, y, zz - 0.35],
            [xx - 0.35, y, zz + 0.35],
            [xx + 0.35, y, zz + 0.35],
            [xx + 0.35, y, zz - 0.35],
          ],
          [
            [xx - 0.025, y + h, zz - 0.025],
            [xx - 0.025, y + h, zz + 0.025],
            [xx + 0.025, y + h, zz + 0.025],
            [xx + 0.025, y + h, zz - 0.025],
          ],
        ],
        pale,
      );
    }
  }
  if (detail) {
    screens(o, 0);
  }
  if (detail) {
    for (const f of faces()) {
      const q = transform(o, f.a, f.x, f.z),
        n = f.wide ? 7 : 1,
        p = f.w / n;
      for (let j = 0; j < n; j++) {
        const x = (j - (n - 1) / 2) * p;
        if (!(f.i === 6 && j === 3)) surface(q, 'glass', rect(x, 0.2, p * 0.63, 4.5), 0.025, glass);
        surface(q, 'glass', arch(x, 6.5, p * 0.6, 5.7, 4), 0.025, glass);
        line(q, 0, 'trim', arch(x, 93.2, p * 0.58 + 0.42, 5.65, 4), 0.055, 0.16, pale);
      }
    }

    for (const f of faces(0.43)) rail(o, 1, f, 136.9, 1.5);
  }
  B(o, 'metal', 0, 136.8, 0, 0.11, 9, 0.08, iron);
}
function build(o, d) {
  base(o, d);
  shaft(o, d);
  crown(o, d);
}
export const tribuneTower = (o) => build(o, 3),
  tribuneTowerStreet = (o) => build(o, 2),
  tribuneTowerDistrict = (o) => skyline(o, 1),
  tribuneTowerSkyline = (o) => skyline(o);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', localRef: ref, roughness: 0.88, metallic: 0 },
  spandrel: { slot: 'trim', localRef: ref, roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.44, metallic: 0.08 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.65,
    metallic: 0.3,
    doubleSided: true,
  },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
};
export const tribuneTowerModel = {
  id: 'tribune_tower',
  key: 'tribune_tower',
  recipe: 'structure-tribune-tower.mjs',
  cell: 'dp/dp3',
  title: 'Tribune Tower',
  brief:
    'Historic Chicago TribuneTower: own native chamfered eight-sided shaft with Indiana limestone raised vertical piers, individually divided recessed glazing/dark horizontal spandrels, elaborate lower Gothic lights/inset bronze doors and pointed west mainportal, original simplified foliate relief/embedded historic fragment patches. Stepped inward central Gothic crown with round-arched glazed lights, eight independent outer buttress piers/actual curved open flying spans/pierced tracery and galleries/clustered ribs/crocketed pinnacles/small abstract gargoyles. Flat upper cap/metal guard/flagpole, no invented spire. Historic tower only; Radio/TV/printingplant/newglasswings/courtyard/newTribuneEast/neighbors/statue/interiors excluded.',
  camera: [-121, 99, 137],
  lookAt: [0, 66, 0],
  qaCameras: [
    { name: 'front', position: [-139, 62, 0], lookAt: [0, 63, 0] },
    { name: 'entry-detail', position: [-28, 5, 5], lookAt: [-14, 6, 0] },
    { name: 'lower-detail', position: [-29, 13, 22], lookAt: [-11, 10, 5] },
    { name: 'shaft-detail', position: [-30, 52, 25], lookAt: [-10, 48, 5] },
    { name: 'crown-detail', position: [-37, 121, 34], lookAt: [0, 119, 0] },
    { name: 'buttress-detail', position: [27, 126, 25], lookAt: [7, 121, 6] },
    { name: 'roof-detail', position: [25, 151, -24], lookAt: [0, 136, 0] },
    { name: 'back', position: [119, 78, -112], lookAt: [0, 66, 0] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -4 },
  build: tribuneTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Unmodified independent Terrarium terrain acquired before geometry, dry westMichiganAvenue approach[-19,0] datum; buried-4mfooting. NativeurbanDEM/thresholdengineering/otherhostdatasets approximate; no flattening or terrain fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tribune-tower.mjs',
    level: 'skyline',
    export: 'tribuneTowerSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'tribuneTowerDistrict', errorMeters: 1, surfaces },
      street: { export: 'tribuneTowerStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: frame.limitations,
};
export { base, crown, faces, sample, shaft };
