/** Native ceremonial compound: distinct ritual halls, open courts, gates and Pan Bridge. */
import './install-deterministic-math.mjs';
import nativeFrame from '../../../content/worldgen/source/places/ws/wsq/taipei_confucius_temple/map-frame.json' with {
  type: 'json',
};
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B as fullBox, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  red = rgb('a15b4b'),
  timber = rgb('734844'),
  stone = rgb('bcb7a8'),
  orange = rgb('c58a43'),
  green = rgb('63937a'),
  blue = rgb('41637e'),
  gold = rgb('c1a464'),
  pale = rgb('ded5b7'),
  dark = rgb('3f514d');
function B(o, slot, x, y, z, w, h, depth, col) {
  if (o.lod !== 0) return fullBox(o, slot, x, y, z, w, h, depth, col);
  const skipCaps = slot === 'brick',
    stair = slot === 'stone' && w > 1 && depth < 1;
  if (!skipCaps && !stair) return fullBox(o, slot, x, y, z, w, h, depth, col);
  fullBox(
    {
      addQuad: (slot, r, p, n, u, c) => {
        if (skipCaps && Math.abs(n[1]) > 0.5) return;
        if (stair && (n[1] < -0.5 || n[2] < -0.5)) return;
        o.addQuad(slot, r, p, n, u, c);
      },
    },
    slot,
    x,
    y,
    z,
    w,
    h,
    depth,
    col,
  );
}
function withLod(out, d) {
  return new Proxy(out, {
    get(target, key) {
      if (key === 'lod') return d;
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
function poly(out, slot, outline, y0, y1, col) {
  let r = outline.slice(0, -1).map((p) => p.slice());
  if (
    r.reduce(
      (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r = r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      out,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  if (out.lod !== 0)
    out.addConvexPolygon(
      slot,
      ref,
      r.map((p) => [p[0], y0, p[1]]),
      [0, -1, 0],
      (p) => [p[0], p[2]],
      col,
    );
  out.addConvexPolygon(
    slot,
    ref,
    [...r].reverse().map((p) => [p[0], y1, p[1]]),
    [0, 1, 0],
    (p) => [p[0], p[2]],
    col,
  );
}
function facing(out, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    lod: out.lod,
    addTriangle: (slot, r, q, n, u, col) => out.addTriangle(slot, r, q.map(p), v(n), u, col),
    addQuad: (slot, r, q, n, u, col) => out.addQuad(slot, r, q.map(p), v(n), u, col),
    addConvexPolygon: (slot, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return out.addConvexPolygon(slot, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, slot, x, y, z, w, h, col) {
  quad(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    col,
  );
}
function sheet(o, slot, p, col, up = true) {
  let n = normalFor(...p.slice(0, 3));
  if (n[1] > 0 !== up) {
    p = [...p].reverse();
    n = normalFor(...p.slice(0, 3));
  }
  quad(o, slot, p, n, col);
}
function column(o, x, z, y0, y1, d, r = 0.24) {
  const sides = [3, 6, 8, 12][d];
  loft(
    o,
    'stone',
    [radialRing(y0, r, r, sides, [x, z]), radialRing(y1, r * 0.94, r * 0.94, sides, [x, z])],
    stone,
    { cap: d > 1 },
  );
  if (d >= 2 && r > 0.15) {
    loft(
      o,
      'stone',
      [radialRing(y0, 0.35, 0.35, 8, [x, z]), radialRing(y0 + 0.18, 0.3, 0.3, 8, [x, z])],
      stone,
    );
    B(o, 'wood', x, y1 - 0.24, z, 0.5, 0.25, 0.5, timber);
  }
}
function tube(o, slot, path, radius, col, d) {
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      v = b.map((n, j) => n - a[j]),
      l = Math.hypot(...v);
    const n = v.map((v) => v / l),
      q = [0, 0, 1],
      cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ],
      u = cross(n, q),
      ul = Math.hypot(...u),
      uu = u.map((x) => x / ul),
      w = cross(n, uu),
      sides = d === 3 ? 6 : 4;
    return Array.from({ length: sides }, (_, j) => {
      const a = (-j / sides) * Math.PI * 2;
      return p.map((v, k) => v + radius * (uu[k] * Math.cos(a) + w[k] * Math.sin(a)));
    });
  });
  loft(o, slot, rings, col);
}
function dragon(o, x, y, z, sign, d, size = 1) {
  if (d < 2) return;
  const steps = d === 3 ? 16 : 7,
    path = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      return [
        x + sign * size * (t * 1.1 - 0.55),
        y + size * (0.16 + 0.3 * Math.sin(t * Math.PI * 2) + 0.45 * t),
        z + size * 0.1 * Math.sin(t * Math.PI * 2),
      ];
    });
  tube(o, 'tile', path, 0.1 * size, green, d);
  const head = path.at(-1);
  sphere(
    o,
    'tile',
    [head[0] + sign * 0.08 * size, head[1] + 0.12 * size, head[2]],
    [0.2 * size, 0.16 * size, 0.13 * size],
    green,
    8,
    4,
  );
  beam(
    o,
    'wood',
    [head[0], head[1] + 0.2 * size, head[2]],
    [head[0] - sign * 0.13 * size, head[1] + 0.44 * size, head[2]],
    0.045 * size,
    0.045 * size,
    gold,
  );
  if (d === 3)
    for (let i = 2; i < steps; i += 2) {
      const p = path[i];
      beam(
        o,
        'wood',
        p,
        [p[0] - sign * 0.12 * size, p[1] + 0.18 * size, p[2]],
        0.035 * size,
        0.035 * size,
        gold,
      );
    }
}
// Shallow, original geometric relief; no claim to reproduce the photographed animal carving.
function relief(o, x, y, z, w, h, d) {
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    const n = d === 3 ? 16 : 8,
      path = Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n,
          a = (t * 1.7 - 0.15) * Math.PI;
        return [
          x + sign * (t - 0.5) * w * 0.8,
          y + Math.sin(a) * h * 0.32,
          z + 0.025 * Math.sin(t * Math.PI),
        ];
      });
    tube(o, 'stone', path, 0.035, pale, d);
  }
}
function roof(o, w, depth, y0, y1, ridgeW, ridgeDepth, d, ornate = false, gable = false) {
  const nt = [1, 1, 4, 8][d],
    nu = [1, 1, 3, 5][d],
    split = 0.42;
  const height = (u, t) =>
    y0 +
    (y1 - y0) * Math.pow(1 - t, 1.65) +
    0.55 * Math.pow(Math.abs(u), 8) * Math.pow(t, 3) +
    0.35 * Math.pow(Math.abs(u), 4) * (1 - t);
  for (let side = 0; side < 4; side++) {
    const odd = side % 2,
      ww = odd ? depth : w,
      dd = odd ? w : depth,
      rw = odd ? ridgeDepth : ridgeW,
      rd = odd ? ridgeW : ridgeDepth,
      q = facing(o, (side * Math.PI) / 2),
      point = (u, t) => {
        if (!gable) return [(u * (rw + (ww - rw) * t)) / 2, height(u, t), (rd + (dd - rd) * t) / 2];
        if (!odd)
          return [
            (u * (ridgeW + (w - ridgeW) * Math.max(0, (t - split) / (1 - split)))) / 2,
            height(u, t),
            (ridgeDepth + (depth - ridgeDepth) * t) / 2,
          ];
        const globalT = split + (1 - split) * t,
          inner = ridgeDepth + (depth - ridgeDepth) * split;
        return [
          (u * (inner + (depth - inner) * t)) / 2,
          height(u, globalT),
          (ridgeW + (w - ridgeW) * t) / 2,
        ];
      },
      ts = [
        ...new Set([
          ...Array.from({ length: nt + 1 }, (_, j) => j / nt),
          ...(gable && !odd ? [split] : []),
        ]),
      ].sort((a, b) => a - b);
    // The front/back roof has a real vertical gable break; end hips start below it.
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < ts.length - 1; j++) {
        const a = -1 + (2 * i) / nu,
          b = -1 + (2 * (i + 1)) / nu,
          p = [point(a, ts[j]), point(b, ts[j]), point(b, ts[j + 1]), point(a, ts[j + 1])];
        sheet(q, 'tile', p, orange);
        if (d >= 1)
          sheet(
            q,
            'wood',
            p.map((p) => [p[0], p[1] - 0.16, p[2]]),
            timber,
            false,
          );
      }
    if (d >= 2) {
      for (let i = 0; i < nu; i++)
        beam(
          q,
          'wood',
          point(-1 + (2 * i) / nu, 1),
          point(-1 + (2 * (i + 1)) / nu, 1),
          0.17,
          0.19,
          timber,
        );
      for (let j = 0; j < ts.length - 1; j++)
        beam(q, 'wood', point(1, ts[j]), point(1, ts[j + 1]), 0.18, 0.2, red);
      if (ww > 8) {
        const count = Math.floor(ww / (d === 3 ? 0.8 : 1.6));
        for (let k = 1; k < count; k++) {
          const u = -1 + (2 * k) / count;
          for (let j = 0; j < ts.length - 1; j++) {
            const du = 0.005,
              p = [
                point(u - du, ts[j]),
                point(u + du, ts[j]),
                point(u + du, ts[j + 1]),
                point(u - du, ts[j + 1]),
              ].map((p) => [p[0], p[1] + 0.018, p[2]]);
            sheet(
              q,
              'tile',
              p,
              orange.map((v, i) => v * (i === 0 ? 1.06 : 1.1)),
            );
          }
          if (d === 3 && k % 2 === 0) {
            const p = point(u, 1);
            loft(
              q,
              'tile',
              [
                radialRing(p[1] - 0.04, 0.075, 0.075, 6, [p[0], p[2] - 0.06]),
                radialRing(p[1] + 0.06, 0.075, 0.075, 6, [p[0], p[2] - 0.06]),
              ],
              green,
            );
          }
        }
      }
    }
  }
  // Close the finite ridge rectangle. Four hip patches alone otherwise leave a real slit.
  for (let i = 0; i < nu; i++) {
    const u = -1 + (2 * i) / nu,
      v = -1 + (2 * (i + 1)) / nu;
    sheet(
      o,
      'tile',
      [
        [(u * ridgeW) / 2, height(u, 0), -ridgeDepth / 2],
        [(v * ridgeW) / 2, height(v, 0), -ridgeDepth / 2],
        [(v * ridgeW) / 2, height(v, 0), ridgeDepth / 2],
        [(u * ridgeW) / 2, height(u, 0), ridgeDepth / 2],
      ],
      orange,
    );
  }
  if (gable) {
    const gDepth = ridgeDepth + (depth - ridgeDepth) * split,
      n = [2, 4, 6, 10][d];
    for (const sign of [-1, 1]) {
      const point = (i, upper) => {
        const u = -1 + (2 * i) / n,
          z = (u * gDepth) / 2,
          t = Math.max(0, (Math.abs(z) * 2 - ridgeDepth) / (depth - ridgeDepth));
        return [(sign * ridgeW) / 2, upper ? height(1, t) : height(u, split), z];
      };
      for (let i = 0; i < n; i++) {
        const p = [point(i, false), point(i + 1, false), point(i + 1, true), point(i, true)];
        if (i === 0) p.splice(0, 1);
        if (i === n - 1) p.splice(1, 1);
        const nrm = [sign, 0, 0],
          uv = p.map((p) => [p[2], p[1]]);
        if (normalFor(...p.slice(0, 3))[0] * sign < 0) {
          p.reverse();
          uv.reverse();
        }
        if (p.length === 3) o.addTriangle('wood', ref, p, nrm, uv, timber);
        else o.addQuad('wood', ref, p, nrm, uv, timber);
      }
    }
  }
  // Raised blue ceramic ridge faces are separate geometry, not painted roof slopes.
  if (gable || (ornate && d >= 1)) {
    for (const sign of [-1, 1]) {
      const q = sign > 0 ? o : facing(o, Math.PI),
        n = d === 0 ? 1 : d === 3 ? 12 : 6;
      for (let i = 0; i < n; i++) {
        const a = -ridgeW / 2 + (ridgeW * i) / n,
          b = -ridgeW / 2 + (ridgeW * (i + 1)) / n,
          ya = y1 + 0.05 + 0.35 * Math.pow(Math.abs((2 * a) / ridgeW), 4),
          yb = y1 + 0.05 + 0.35 * Math.pow(Math.abs((2 * b) / ridgeW), 4);
        quad(
          q,
          'tile',
          [
            [a, ya - 0.05, ridgeDepth / 2 + 0.02],
            [b, yb - 0.05, ridgeDepth / 2 + 0.02],
            [b, yb + 0.22, ridgeDepth / 2 + 0.02],
            [a, ya + 0.22, ridgeDepth / 2 + 0.02],
          ],
          [0, 0, 1],
          blue,
        );
        if (d >= 2) {
          beam(
            q,
            'tile',
            [a, ya + 0.25, ridgeDepth / 2],
            [b, yb + 0.25, ridgeDepth / 2],
            0.1,
            0.12,
            red,
          );
          if (d === 3 && i % 2 === 0) {
            const x = (a + b) / 2,
              y = (ya + yb) / 2;
            for (const dx of [-0.1, 0.1])
              sphere(
                q,
                'tile',
                [x + dx, y + 0.05, ridgeDepth / 2 + 0.07],
                [0.08, 0.09, 0.04],
                pale,
                6,
                3,
              );
          }
        }
      }
    }
  }
  if (d >= 2) {
    B(o, 'wood', 0, y1 - 0.03, 0, ridgeW, 0.22, Math.max(0.25, ridgeDepth), red);
    for (const sign of [-1, 1]) {
      const x = (sign * ridgeW) / 2,
        path = Array.from({ length: d === 3 ? 7 : 4 }, (_, i) => {
          const t = i / (d === 3 ? 6 : 3);
          return [x + sign * t * 0.8, y1 + (ornate || gable ? 0.72 : 0.2) + t * t * 1.1, 0];
        });
      tube(o, 'wood', path, 0.13, red, d);
      if (ornate) dragon(o, x, y1 + 1.0, 0, sign, d, 0.75);
    }
  }
}
function trimBoard(o, x, y, z, w, h, d) {
  face(o, 'wood', x, y, z, w, h, blue);
  if (d < 2) return;
  for (const yy of [y, y + h]) B(o, 'wood', x, yy, z + 0.04, w, 0.035, 0.07, gold);
  const count = Math.max(1, Math.floor(w / 1.5));
  for (let k = 0; k < count; k++) {
    const xx = x - w / 2 + ((k + 0.5) * w) / count;
    face(o, 'wood', xx, y + 0.18 * h, z + 0.06, 0.12, 0.65 * h, green);
    if (d === 3)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        face(
          o,
          'wood',
          xx + Math.cos(a) * h * 0.21,
          y + h * 0.5 + Math.sin(a) * h * 0.18,
          z + 0.08,
          0.075,
          0.09,
          pale,
        );
      }
  }
}
function window(o, x, y, z, w, h, d) {
  face(o, 'window', x, y, z, w, h, dark);
  if (d < 2) return;
  for (const xx of [-w / 2, w / 2]) B(o, 'wood', x + xx, y, z + 0.03, 0.055, h, 0.07, pale);
  for (const yy of [y, y + h]) B(o, 'wood', x, yy, z + 0.03, w, 0.055, 0.07, gold);
  if (d >= 2) {
    const n = Math.max(2, Math.round(w / 0.22));
    for (let i = 1; i < n; i++)
      face(o, 'wood', x - w / 2 + (i * w) / n, y, z + 0.08, 0.025, h, green);
    for (let yy = y + 0.27; yy < y + h; yy += d === 3 ? 0.27 : 0.54)
      face(o, 'wood', x, yy, z + 0.08, w, 0.025, green);
  }
}
function studDoor(o, x, z, w, floor, h, d) {
  if (!d) {
    face(o, 'wood', x, floor, z + 0.09, w, h, red);
    face(facing(o, Math.PI), 'wood', -x, floor, -z + 0.09, w, h, red);
    return;
  }
  B(o, 'wood', x, floor, z, w, h, 0.18, red);
  if (d < 2) return;
  for (const sign of [-1, 1])
    for (let row = 0; row < 13; row++)
      for (let col = 0; col < 4; col++) {
        const xx = x + sign * (0.08 + ((col + 0.4) * (w / 2 - 0.12)) / 4),
          yy = floor + 0.18 + (row * (h - 0.36)) / 13;
        if (d === 3) sphere(o, 'wood', [xx, yy, z + 0.13], [0.035, 0.035, 0.04], gold, 6, 3);
        else face(o, 'wood', xx, yy, z + 0.11, 0.045, 0.045, gold);
      }
  if (d === 3)
    for (const sign of [-1, 1])
      for (const xx of [0.2, 0.55])
        sphere(
          o,
          'wood',
          [x + (sign * xx * w) / 2, floor + h - 0.08, z + 0.13],
          [0.035, 0.035, 0.04],
          gold,
          6,
          3,
        );
}
function arch(o, cx, z, w, depth, y0, spring, r, top, d) {
  const side = (w - 2 * r) / 2;
  for (const sign of [-1, 1])
    B(o, 'brick', cx + sign * (r + side / 2), y0, z, side, top - y0, depth, red);
  const n = [2, 6, 10, 16][d];
  for (let i = 0; i < n; i++) {
    const a = -r + (2 * r * i) / n,
      b = -r + (2 * r * (i + 1)) / n,
      ya = spring + Math.sqrt(Math.max(0, r * r - a * a)),
      yb = spring + Math.sqrt(Math.max(0, r * r - b * b));
    for (const sign of [-1, 1])
      quad(
        o,
        'brick',
        [
          [cx + a, ya, z + (sign * depth) / 2],
          [cx + b, yb, z + (sign * depth) / 2],
          [cx + b, top, z + (sign * depth) / 2],
          [cx + a, top, z + (sign * depth) / 2],
        ],
        [0, 0, sign],
        red,
      );
    const p = [
      [cx + a, ya, z - depth / 2],
      [cx + b, yb, z - depth / 2],
      [cx + b, yb, z + depth / 2],
      [cx + a, ya, z + depth / 2],
    ];
    quad(o, 'stone', p, normalFor(...p.slice(0, 3)), stone);
  }
  sheet(
    o,
    'brick',
    [
      [cx - w / 2, top, z - depth / 2],
      [cx + w / 2, top, z - depth / 2],
      [cx + w / 2, top, z + depth / 2],
      [cx - w / 2, top, z + depth / 2],
    ],
    red,
  );
}
function bounds(part) {
  const { min, max } = part.bounds;
  return {
    x: (min[0] + max[0]) / 2,
    z: (min[1] + max[1]) / 2,
    w: max[0] - min[0],
    depth: max[1] - min[1],
  };
}
function stairs(o, w, z, y, d) {
  const n = d ? Math.max(2, Math.round(y / 0.18)) : 1;
  for (let i = 0; i < n; i++)
    B(o, 'stone', 0, -0.2, z + (i + 0.5) * 0.28, w, (y * (n - i)) / n + 0.2, 0.28, stone);
}
function hall(out, p, d, kind) {
  const b = bounds(p),
    o = facing(out, 0, b.x, b.z),
    main = kind === 'main',
    gate = kind === 'gate',
    rear = kind === 'rear',
    floor = main ? 1.2 : 0.6,
    w = b.w,
    depth = b.depth,
    bodyW = w - (main ? 3.2 : 2.0),
    bodyD = depth - (main ? 3.4 : 2.0),
    eave = main ? 5.7 : gate ? 4.5 : rear ? 4.3 : 3.5;
  poly(out, 'stone', p.outline, -1, floor, stone);
  if (gate) {
    // Closed ceremonial centre doors, with genuine open side routes through the end bays.
    const bayW = (w - 2.1) / 7,
      doorW = bayW * 0.92;
    for (const sign of [-1, 1])
      B(o, 'brick', sign * (bodyW / 2 - 0.45), floor, 0, 0.9, eave - floor, bodyD, red);
    B(o, 'brick', 0, eave - 0.8, 0, bodyW, 0.8, bodyD, red);
    if (p.role === 'lingxing_gate')
      for (let j = -1; j <= 1; j++) studDoor(o, j * bayW * 2, bodyD / 2, doorW, floor, 3.1, d);
  } else B(o, 'brick', 0, floor, -0.45, bodyW, eave - floor, Math.max(1, bodyD - 1), red);
  const frontZ = depth / 2 - 0.85,
    cols = !d
      ? main || rear || gate
        ? 2
        : 0
      : main || rear
        ? 6
        : gate
          ? 8
          : Math.max(3, Math.round(w / 3));
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + 1.05 + ((w - 2.1) * i) / (cols - 1);
    column(o, x, frontZ, floor, eave - 0.16, d, main ? 0.25 : 0.21);
    if (d >= 2) B(o, 'wood', x, eave - 0.4, frontZ, 0.6, 0.3, 0.65, timber);
    if (
      d >= 2 &&
      ((main && [1, cols - 2].includes(i)) ||
        (p.role === 'lingxing_gate' && [2, cols - 3].includes(i)))
    ) {
      const path = Array.from({ length: d === 3 ? 25 : 13 }, (_, j) => {
        const t = j / (d === 3 ? 24 : 12),
          a0 = t * Math.PI * 3;
        return [x + Math.cos(a0) * 0.3, floor + 0.3 + t * 2.2, frontZ + Math.sin(a0) * 0.3];
      });
      tube(o, 'stone', path, 0.07, stone, d);
    }
  }
  if (d >= 1 && !gate) {
    for (let i = 0; i < 5; i++) {
      const x = ((i - 2) * bodyW) / 5,
        ww = (bodyW / 5) * 0.85,
        z = bodyD / 2 - 0.85;
      if (main) {
        // The exterior door leaves are depicted around closed dark interior backings.
        face(o, 'window', x, floor, z - 0.015, ww, 3.1, rgb('242c2b'));
        for (const sign of [-1, 1]) {
          const px = x + sign * ww * 0.3,
            pw = ww * 0.34;
          B(o, 'wood', px, floor, z, pw, 3.1, 0.1, timber);
          face(o, 'wood', px, floor + 0.16, z + 0.06, pw * 0.82, 0.91, pale);
          window(o, px, floor + 1.25, z + 0.06, pw * 0.87, 1.55, d);
          face(o, 'wood', px, floor + 2.88, z + 0.07, pw * 0.85, 0.13, gold);
        }
      } else window(o, x, floor + 0.45, z, ww, 1.9, d);
    }
    if (main)
      for (const sign of [-1, 1]) {
        const q = facing(o, (sign * Math.PI) / 2);
        for (let i = 0; i < 7; i++)
          column(q, -depth / 2 + 1 + ((depth - 2) * i) / 6, w / 2 - 0.9, floor, eave - 0.16, d);
      }
  }
  for (const sign of [-1, 1]) {
    const q = sign > 0 ? o : facing(o, Math.PI);
    trimBoard(q, 0, eave - 0.45, depth / 2 - 0.4, w - 0.6, 0.36, d);
  }
  if (main)
    for (const sign of [-1, 1])
      stairs(facing(o, 0, sign * w * 0.31, 0), w * 0.18, depth / 2 + 0.1, floor, d);
  else stairs(o, w * 0.9, depth / 2 + 0.1, floor, d);
  if (main || gate) {
    roof(o, w + 0.5, depth + 0.5, eave, eave + 1.35, w * 0.72, depth * 0.6, d, true);
    if (d) B(o, 'wood', 0, eave + 1.1, 0, w * 0.71, 1.1, depth * 0.57, timber);
    roof(o, w * 0.84, depth * 0.78, eave + 2.15, eave + 4.65, w * 0.62, 0.28, d, true, true);
    if (main) {
      const top = eave + 4.65;
      if (!d)
        loft(
          o,
          'tile',
          [radialRing(top + 0.15, 0.35, 0.35, 3), radialRing(top + 2.15, 0.04, 0.04, 3)],
          red,
        );
      if (d)
        loft(
          o,
          'tile',
          [radialRing(top + 0.15, 0.085, 0.085, 4), radialRing(top + 2.25, 0.025, 0.025, 4)],
          red,
        );
      for (let j = 0; j < (d ? 7 : 0); j++) {
        const n = d ? 7 : 3,
          yy = top + 0.15 + (j * 2.15) / n,
          r = 0.4 * (1 - j / (n + 1));
        loft(
          o,
          'tile',
          [radialRing(yy, r, r, d ? 6 : 3), radialRing(yy + 0.13, r * 0.78, r * 0.78, d ? 6 : 3)],
          red,
        );
      }
      if (d)
        for (const sign of [-1, 1]) {
          const x = sign * w * 0.31;
          loft(
            o,
            'tile',
            [
              radialRing(top + 0.8, 0.2, 0.2, 8, [x, 0]),
              radialRing(top + 1.9, 0.18, 0.18, 8, [x, 0]),
            ],
            gold,
          );
          loft(
            o,
            'tile',
            [
              radialRing(top + 0.58, 0.32, 0.32, 8, [x, 0]),
              radialRing(top + 0.82, 0.25, 0.25, 8, [x, 0]),
            ],
            green,
          );
          if (d >= 2) dragon(o, x, top + 0.28, 0, sign, d, 0.5);
        }
      if (d === 3)
        for (const sign of [-1, 1])
          for (let i = 0; i < 36; i++) {
            const x = -w * 0.28 + (w * 0.56 * i) / 35,
              y = top + 0.38 + 0.28 * Math.pow(Math.abs(x / (w * 0.31)), 4),
              z = sign * 0.23;
            loft(
              o,
              'tile',
              [
                radialRing(y, 0.045, 0.05, 5, [x, z]),
                radialRing(y + 0.12, 0.07, 0.055, 5, [x, z]),
                radialRing(y + 0.19, 0.025, 0.035, 5, [x, z]),
              ],
              pale,
            );
          }
    }
  } else roof(o, w + 0.3, depth + 0.3, eave, eave + (rear ? 2.7 : 1.7), w * 0.7, 0.25, d, rear);
  if (d >= 2)
    for (const x of [-w / 2 + 1, 0, w / 2 - 1]) {
      B(o, 'wood', x, eave - 0.65, frontZ, 0.65, 0.22, 0.85, timber);
      B(o, 'wood', x, eave - 0.43, frontZ, 0.9, 0.18, 0.9, green);
    }
}
function wing(out, p, d) {
  const b = bounds(p),
    o = facing(out, Math.PI / 2, b.x, b.z),
    w = b.depth,
    depth = b.w,
    floor = 0.6,
    eave = 3.5;
  poly(out, 'stone', p.outline, -1, floor, stone);
  B(o, 'brick', 0, floor, 0, w, eave - floor, Math.max(1, depth - 2.8), red);
  roof(o, w + 0.2, depth + 0.3, eave, eave + 1.7, w * 0.9, 0.2, d);
  const side = p.role === 'west_wing' ? 1 : -1,
    q = side > 0 ? o : facing(o, Math.PI),
    n = d ? Math.round(w / 3.6) : 2;
  for (let i = 0; i < n; i++)
    column(q, -w / 2 + 1 + ((w - 2) * i) / (n - 1), depth / 2 - 0.6, floor, eave - 0.17, d, 0.17);
  if (d) {
    trimBoard(q, 0, eave - 0.38, depth / 2 - 0.35, w, 0.3, d);
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 3.4)
      window(q, x, 1.1, depth / 2 - 1.3, 1.3, 1.5, d);
  }
}
function smallGate(out, p, d) {
  const b = bounds(p),
    west = p.role === 'hong_gate' || p.role === 'li_gate',
    a = west ? -Math.PI / 2 : Math.PI / 2,
    o = facing(out, a, b.x, b.z),
    w = b.depth,
    depth = b.w,
    big = p.role === 'hong_gate' || p.role === 'pan_gong_gate',
    floor = 0.15;
  poly(out, 'stone', p.outline, -1, floor, stone);
  arch(o, 0, 0, w, depth, floor, 2.1, big ? 0.95 : 0.85, 4.1, d);
  roof(o, w + 0.5, depth + 0.4, 4.1, 5.2, w * 0.6, 0.25, d, big);
  if (big) {
    roof(o, w * 0.85, depth * 0.72, 5.25, 6.6, w * 0.6, 0.2, d);
    if (d)
      for (const sign of [-1, 1]) window(o, sign * w * 0.34, 2.4, depth / 2 + 0.01, 0.55, 0.7, d);
  }
  stairs(o, w * 0.75, depth / 2 + 0.05, floor, d);
}
function screen(out, p, d) {
  const b = bounds(p),
    o = facing(out, 0, b.x, b.z),
    w = b.w;
  B(o, 'brick', 0, -1, 0, w, 4.1, 0.5, red);
  roof(o, w + 0.2, 1.3, 3.1, 3.6, w * 0.91, 0.15, d);
  if (d) {
    trimBoard(o, 0, 3.12, 0.51, w, 0.48, d);
    for (const sign of [-1, 1]) {
      const q = sign > 0 ? o : facing(o, Math.PI);
      const points = Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return [Math.cos(a) * 0.8, 1.7 + Math.sin(a) * 0.8, 0.31];
      });
      q.addConvexPolygon('stone', ref, points, [0, 0, 1], (p) => [p[0], p[1]], pale);
      relief(q, 0, 1.7, 0.34, 1.3, 1.1, d);
    }
  }
}
function panBridge(out, frame, d) {
  const [x, z] = frame.controls.panPondLocal,
    o = facing(out, 0, x, z - 3.5),
    w = 8.4,
    depth = 2;
  for (let i = -1; i <= 1; i++) arch(o, i * 2.8, 0, 2.8, depth, -0.9, -0.2, 1.0, 1.1, d);
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    for (let j = 0; j < 7; j++) {
      const x = -w / 2 + (w * j) / 6,
        y = 1.1 + 0.23 * (1 - Math.pow(x / (w / 2), 2));
      column(o, x, sign * 1.0, y, y + 0.7, d, 0.09);
      loft(
        o,
        'stone',
        [
          radialRing(y + 0.7, 0.18, 0.18, 4, [x, sign]),
          radialRing(y + 0.92, 0.001, 0.001, 4, [x, sign]),
        ],
        stone,
      );
    }
    for (let j = 0; j < 6; j++)
      beam(
        o,
        'stone',
        [-w / 2 + (w * j) / 6, 1.68, sign],
        [-w / 2 + (w * (j + 1)) / 6, 1.68, sign],
        0.12,
        0.12,
        stone,
      );
    for (let j = 0; j < 24; j++)
      column(o, -w / 2 + (w * (j + 0.5)) / 24, sign, 1.15, 1.65, d, 0.045);
  }
}
// Photo/official-plan interpreted masonry enclosure; positions are bounded estimates between native gates.
function enclosure(out, d) {
  const segments = [
    [
      [-58, -34],
      [46, -34],
    ],
    [
      [-58, -34],
      [-58, 60.4],
    ],
    [
      [-58, 66.1],
      [-58, 95],
    ],
    [
      [-58, 95],
      [-10.7, 95],
    ],
    [
      [7.5, 95],
      [46, 95],
    ],
    [
      [46, -34],
      [46, 59.45],
    ],
    [
      [46, 65.71],
      [46, 95],
    ],
    [
      [-58, 80],
      [-26.865, 75.91],
    ],
    [
      [-26.865, 70.98],
      [-14.18, 57.4],
    ],
    [
      [15.92, 57.4],
      [24.997, 70.857],
    ],
    [
      [24.997, 79.112],
      [46, 79],
    ],
  ];
  for (const [a, b] of segments) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        out,
        Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    if (d === 0) {
      for (const sign of [-1, 1])
        face(sign > 0 ? q : facing(q, Math.PI), 'brick', 0, -1, 0.18, length, 3.0, red);
    } else {
      B(q, 'brick', 0, -1, 0, length, 3.0, 0.36, red);
      B(q, 'stone', 0, -1, 0, length, 1.3, 0.48, stone);
      if (d >= 2) B(q, 'wood', 0, 1.97, 0, length, 0.12, 0.5, timber);
    }
  }
}
export function taipeiConfuciusTemple(out, frame = nativeFrame, d = 3) {
  out = withLod(out, d);
  for (const p of frame.geometry.parts) {
    if (p.role === 'dacheng_hall') hall(out, p, d, 'main');
    else if (p.role === 'chongsheng_shrine') hall(out, p, d === 2 ? 1 : Math.min(d, 2), 'rear');
    else if (p.role === 'yi_gate' || p.role === 'lingxing_gate')
      hall(
        out,
        p,
        d === 2 && p.role === 'yi_gate' ? 1 : d === 3 && p.role === 'yi_gate' ? 2 : d,
        'gate',
      );
    else if (p.role === 'west_wing' || p.role === 'east_wing')
      wing(out, p, d === 2 ? 1 : Math.min(d, 2));
    else if (p.role.endsWith('_chamber')) hall(out, p, Math.min(d, 1), 'room');
    else if (p.role === 'screen_wall') screen(out, p, d === 2 ? 1 : Math.min(d, 2));
    else smallGate(out, p, d === 2 ? 1 : Math.min(d, 2));
  }
  // The central performance platform has its own physical stone front and paired approach steps.
  B(out, 'stone', 0, -1, 13, 7.6, 1.85, 5.5, stone);
  if (d >= 1) {
    face(out, 'stone', 0, 0.03, 15.77, 3.7, 0.7, pale);
    relief(out, 0, 0.36, 15.8, 3.2, 0.55, d);
  }
  panBridge(out, frame, d);
  enclosure(out, d);
}
export const taipeiConfuciusTempleSkyline = (o) => taipeiConfuciusTemple(o, nativeFrame, 0);
export const taipeiConfuciusTempleDistrict = (o) => taipeiConfuciusTemple(o, nativeFrame, 1);
export const taipeiConfuciusTempleStreet = (o) => taipeiConfuciusTemple(o, nativeFrame, 2);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.58, metallic: 0 },
  window: { slot: 'window', localRef: ref, roughness: 0.82, metallic: 0 },
};
export const taipeiConfuciusTempleModel = {
  id: 'taipei_confucius_temple',
  key: 'taipei_confucius_temple',
  recipe: 'structure-taipei-confucius-temple.mjs',
  cell: 'ws/wsq',
  title: 'Taipei Confucius Temple',
  build: taipeiConfuciusTemple,
  surfaces,
  brief:
    'Native ceremonial compound with double-eaved Dacheng Hall, seven-tier ridge pagoda and Tong Tian cylinders, separate Chongsheng rear shrine, open lower side colonnades, Yi/Lingxing gates and true side passages, four outer arched gates, south screen wall, approximate masonry enclosures and three-arch Pan Bridge. Orange ceramic roofs, red brick, gray granite columns, green/blue/gold timber and ridge ornament; own platforms and stairs only. Modern Minglun Hall, service buildings, park, pond water, interior ritual objects and temporary ceremony fixtures excluded.',
  camera: [-105, 88, 155],
  lookAt: [-7, 4, 30],
  portableGroundY: -0.15,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'medium-fi-exterior-source-preview-reviewed-in-qa',
  geographicStatus: 'bounded-preview',
  groundContactBasis:
    'Original fifteen individual native polygons and signed mainhall frame fixed before source ground/geometry. Dry frontcourtyard[0,70], outside PanPond, gives3.1712m relative provider datum. Retained published third-party claimedNLSC2024 20mDTM independently decoded;17.3m pixels interpolated at1m, original official raster/private conversion unavailable. Floors/plinths/stairs follow photographed architecture; source terrain unchanged. No generic footprint replacement or whole-campus terrain pad.',
  qaCameras: [
    { name: 'whole-compound', position: [-98, 100, 120], lookAt: [-7, 3, 30] },
    { name: 'dacheng-front', position: [0, 7, 30], lookAt: [0, 6, 0] },
    { name: 'ridge-and-swallowtails', position: [18, 17, 18], lookAt: [0, 9, 0] },
    { name: 'lingxing-gate', position: [4, 5, 87], lookAt: [1, 4, 57] },
    { name: 'yi-gate-side-passage', position: [16, 3.5, 48], lookAt: [8, 3, 34] },
    { name: 'open-main-court', position: [11, 4, 25], lookAt: [-8, 3, 6] },
    { name: 'rear-shrine', position: [4, 5, -11], lookAt: [0, 4, -25] },
    { name: 'pan-bridge-arches', position: [-9, 3.5, 82], lookAt: [0.7, 0.6, 86.6] },
    { name: 'outer-gates-and-bridge', position: [-37, 13, 106], lookAt: [-14, 2, 78] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-taipei-confucius-temple.mjs',
    level: 'skyline',
    export: 'taipeiConfuciusTempleSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'taipeiConfuciusTempleDistrict', errorMeters: 1.8, surfaces },
      street: { export: 'taipeiConfuciusTempleStreet', errorMeters: 1.6, surfaces },
    },
  },
  limitations: [
    'Approximate photographic exterior with bounded source-ground preview; source/story completion requires current QA. Native map controls are quantized, not surveyed elevations or doorway dimensions.',
    'Each native component has its own mapped location. Quantized footprints/roof-wall interpretation, hidden elevations, outergate details, roof profiles and PanBridge dimensions are photographic estimates, not survey/photogrammetry.',
    'Official42Dachengcolumns include unmodeled interior; exterior circulation and ceramic/dragon/flower carvings are deliberately simplified volumetric medium-fi. No photo pixels or baked lighting used.',
    'Third-party published ground is attributed by publisher to2024NLSC20mDTM; original official raster/private encoding unavailable.1m review grid is interpolation only. Compatible source preview and another host DEM need independent contact review.',
    'Modern Minglun Hall, toilets/services, neighboring temples, park, PanPond water, interior ritual objects, signage and temporary ceremony installations excluded.',
  ],
};
