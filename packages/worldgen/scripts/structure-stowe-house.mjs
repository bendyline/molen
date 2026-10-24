/** Stowe House: distinct north and south classical fronts and open curved colonnades. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('c9bc9c'),
  light = rgb('ded2b4'),
  shadow = rgb('a29375'),
  lead = rgb('717774'),
  dark = rgb('444c46'),
  glass = rgb('6a7c7b'),
  white = rgb('d3d5c9');
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
function line(o, s, a, b, w, c) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    x = ((-dy / l) * w) / 2,
    y = ((dx / l) * w) / 2;
  quad(
    o,
    s,
    [
      [a[0] + x, a[1] + y, a[2]],
      [b[0] + x, b[1] + y, b[2]],
      [b[0] - x, b[1] - y, b[2]],
      [a[0] - x, a[1] - y, a[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function disk(o, s, x, y, z, rx, ry, c, n = 12) {
  const p = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry, z];
  });
  o.addConvexPolygon(s, ref, p, [0, 0, 1], (p) => [p[0], p[1]], c);
}
function arch(o, s, x, y, z, w, h, c, n = 12) {
  const r = w / 2,
    ys = y + h - r,
    p = [
      [x - r, y, z],
      [x + r, y, z],
      [x + r, ys, z],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    p.push([x + r * Math.cos(a), ys + r * Math.sin(a), z]);
  }
  o.addConvexPolygon(s, ref, p, [0, 0, 1], (p) => [p[0], p[1]], c);
}
function archLine(o, x, y, z, w, h, t, c, d) {
  const r = w / 2,
    ys = y + h - r,
    n = d === 3 ? 16 : 8;
  for (const xx of [x - r, x + r]) face(o, 'stone', xx, y, z, t, h - r, c);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI;
    line(
      o,
      'stone',
      [x + r * Math.cos(a), ys + r * Math.sin(a), z],
      [x + r * Math.cos(b), ys + r * Math.sin(b), z],
      t,
      c,
    );
  }
}
function window(o, x, y, w, h, d, { arched = false } = {}) {
  if (!d) return;
  const z = 0.075;
  if (d > 1) face(o, 'wood', x, y - 0.1, 0.04, w + 0.22, h + 0.2, white);
  if (arched && d > 1) arch(o, 'glass', x, y, z, w, h, glass, d === 3 ? 12 : 6);
  else face(o, 'glass', x, y, z, w, h, glass);
  if (d === 2) {
    face(o, 'wood', x, y + h * 0.5, 0.1, w, 0.06, white);
    face(o, 'wood', x, y, 0.11, 0.05, h, white);
    face(o, 'stone', x, y - 0.18, 0.14, w + 0.38, 0.16, light);
    return;
  }
  if (d > 1) {
    face(o, 'stone', x, y - 0.18, 0.14, w + 0.38, 0.16, light);
    for (const xx of [x - w / 2, x + w / 2]) face(o, 'wood', xx, y, 0.1, 0.06, h, white);
    const max = y + h - (arched ? w / 2 : 0);
    for (let yy = y + 0.65; yy < max; yy += 0.72) face(o, 'wood', x, yy, 0.11, w, 0.045, white);
    for (const xx of [x - w / 6, x + w / 6]) face(o, 'wood', xx, y, 0.115, 0.045, max - y, white);
    if (arched && d > 2) archLine(o, x, y, 0.13, w, h, 0.09, white, d);
  }
}
const capitalControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcp/stowe_house/capital-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Closed original medium-fi acanthus stocks and continuous corner scrolls. */
function layeredCapital(o, x, top, z) {
  const c = capitalControls;
  const Q = (p) => {
    const n = normalFor(...p),
      a = n.map(Math.abs),
      axis = a.indexOf(Math.max(...a));
    o.addQuad(
      'capitalStone',
      ref,
      p,
      n,
      p.map((v) => (axis === 0 ? [v[2], v[1]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]])),
      light,
    );
  };
  for (const layer of c.leaves.layers)
    for (let i = 0; i < c.leaves.countPerLayer; i++) {
      const angle = layer.angleOffset + (i * 2 * Math.PI) / c.leaves.countPerLayer,
        co = Math.cos(angle),
        si = Math.sin(angle),
        rings = layer.profile.map(([h, r, w]) =>
          [
            [-w, -c.leaves.thickness / 2],
            [w, -c.leaves.thickness / 2],
            [w, c.leaves.thickness / 2],
            [-w, c.leaves.thickness / 2],
          ].map(([t, dr]) => [x + co * (r + dr) - si * t, top + h, z + si * (r + dr) + co * t]),
        );
      for (let j = 0; j < rings.length - 1; j++)
        for (let k = 0; k < 4; k++)
          Q([rings[j][k], rings[j][(k + 1) % 4], rings[j + 1][(k + 1) % 4], rings[j + 1][k]]);
      Q([...rings[0]].reverse());
      Q(rings.at(-1));
    }
  const v = c.volutes;
  for (let k = 0; k < v.count; k++) {
    const a = v.angleOffset + (k * 2 * Math.PI) / v.count,
      co = Math.cos(a),
      si = Math.sin(a),
      center = [x + co * v.centerRadius, top + v.heightOffset, z + si * v.centerRadius],
      point = (theta, phi) => {
        const r = v.majorRadius + v.tubeRadius * Math.cos(phi),
          t = r * Math.cos(theta),
          y = r * Math.sin(theta),
          out = v.tubeRadius * Math.sin(phi);
        return [center[0] - si * t + co * out, center[1] + y, center[2] + co * t + si * out];
      };
    for (let i = 0; i < v.segments; i++)
      for (let j = 0; j < v.sides; j++) {
        const a = (i * 2 * Math.PI) / v.segments,
          b = ((i + 1) * 2 * Math.PI) / v.segments,
          p = (j * 2 * Math.PI) / v.sides,
          q = ((j + 1) * 2 * Math.PI) / v.sides,
          points = [point(a, p), point(b, p), point(b, q), point(a, q)],
          mid = (a + b) / 2,
          axis = [
            center[0] - si * v.majorRadius * Math.cos(mid),
            center[1] + v.majorRadius * Math.sin(mid),
            center[2] + co * v.majorRadius * Math.cos(mid),
          ],
          centroid = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / 4),
          n = normalFor(...points);
        if (n.reduce((s, v, k) => s + v * (centroid[k] - axis[k]), 0) < 0) points.reverse();
        Q(points);
      }
  }
}
function column(o, x, y, z, h, r, d, order = 'ionic') {
  const sides = d === 3 ? 8 : 4;
  if (d < 3) {
    loft(
      o,
      'stone',
      [radialRing(y, r, r, sides, [x, z]), radialRing(y + h, r * 0.83, r * 0.83, sides, [x, z])],
      stone,
    );
    return;
  }
  const cap = order === 'corinthian' ? 0.85 : 0.5;
  B(o, 'stone', x, y, z, r * 2.5, 0.22, r * 2.5, light);
  loft(
    o,
    'stone',
    [
      [0.22, r * 1.12],
      [0.45, r * 1.02],
      [0.64, r],
      [h - cap, r * 0.78],
      [h - 0.16, r * 1.18],
    ].map(([a, b]) => radialRing(y + a, b, b, sides, [x, z])),
    stone,
  );
  B(o, 'stone', x, y + h - 0.17, z, r * 2.7, 0.17, r * 2.7, light);
  if (d === 3 && order === 'corinthian') layeredCapital(o, x, y + h, z);
  if (d > 2 && order === 'ionic')
    for (const sign of [-1, 1])
      B(o, 'stone', x + sign * r * 0.82, y + h - 0.43, z, r * 0.5, 0.26, r * 1.55, light);
}
function balustrade(o, w, y, d) {
  if (d < 2) {
    face(o, 'stone', 0, y, 0, w, 1.15, stone);
    return;
  }
  B(o, 'stone', 0, y, 0, w, 0.17, 0.55, light);
  B(o, 'stone', 0, y + 0.98, 0, w, 0.2, 0.6, light);
  const n = Math.round(w / 0.7);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    if (i % 8 === 0 && d > 2) B(o, 'stone', x, y + 0.17, 0, 0.45, 0.81, 0.48, stone);
    else if (d === 2) face(o, 'stone', x, y + 0.17, 0, 0.18, 0.81, stone);
    else {
      const profile = [
          [0.17, 0.15],
          [0.4, 0.09],
          [0.63, 0.17],
          [0.82, 0.09],
          [0.98, 0.14],
        ],
        p = [
          ...profile.map(([h, r]) => [x - r, y + h]),
          ...profile
            .slice()
            .reverse()
            .map(([h, r]) => [x + r, y + h]),
        ],
        ids = earcut(p.flat());
      for (const sign of [-1, 1])
        for (let j = 0; j < ids.length; j += 3) {
          const q = ids.slice(j, j + 3).map((k) => [...p[k], sign * 0.1]);
          o.addTriangle(
            'stone',
            ref,
            q,
            [0, 0, sign],
            q.map((v) => [v[0], v[1]]),
            stone,
          );
        }
    }
  }
}
function cornice(o, w, y, d) {
  if (d < 2) {
    B(o, 'stone', 0, y, 0, w + 0.7, 0.75, 0.8, light);
    return;
  }
  B(o, 'stone', 0, y, 0, w, 0.35, 0.42, stone);
  B(o, 'stone', 0, y + 0.35, 0.12, w + 0.34, 0.24, 0.65, light);
  B(o, 'stone', 0, y + 0.59, 0.2, w + 0.7, 0.16, 0.8, light);
  if (d > 2)
    for (let x = -w / 2 + 0.25; x < w / 2; x += 0.5)
      face(o, 'stone', x, y + 0.1, 0.3, 0.15, 0.18, light);
}
function pediment(o, w, y, rise, depth, d, clock = false) {
  const p = [
    [-w / 2, y, depth / 2],
    [w / 2, y, depth / 2],
    [0, y + rise, depth / 2],
  ];
  o.addTriangle(
    'stone',
    ref,
    p,
    [0, 0, 1],
    p.map((v) => [v[0], v[1]]),
    light,
  );
  o.addTriangle(
    'stone',
    ref,
    p.map((v) => [v[0], v[1], -depth / 2]),
    [0, 0, -1],
    p.map((v) => [v[0], v[1]]),
    stone,
  );
  for (const [a, b] of [
    [p[0], p[2]],
    [p[2], p[1]],
  ]) {
    const q = [[...a], [...b], [b[0], b[1], -depth / 2], [a[0], a[1], -depth / 2]];
    quad(o, 'roof', q, normalFor(...q), lead);
    beam(o, 'stone', a, b, 0.28, 0.32, light);
    if (d > 2) {
      const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        B(
          o,
          'stone',
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t - 0.26,
          depth / 2 + 0.05,
          0.15,
          0.15,
          0.22,
          stone,
        );
      }
    }
  }
  if (clock && d) {
    disk(o, 'metal', 0, y + rise * 0.4, depth / 2 + 0.18, 0.8, 0.8, dark, 16);
    disk(o, 'stone', 0, y + rise * 0.4, depth / 2 + 0.2, 0.68, 0.68, light, 16);
    if (d > 1) {
      line(
        o,
        'metal',
        [0, y + rise * 0.4, depth / 2 + 0.22],
        [0.38, y + rise * 0.4 + 0.22, depth / 2 + 0.22],
        0.05,
        dark,
      );
      line(
        o,
        'metal',
        [0, y + rise * 0.4, depth / 2 + 0.22],
        [-0.15, y + rise * 0.4 + 0.47, depth / 2 + 0.22],
        0.05,
        dark,
      );
    }
  }
}
function pavilionPanel(o, x, d) {
  if (!d) return;
  arch(o, 'stone', x, 4.5, 0.07, 7.2, 11.2, shadow, d === 3 ? 16 : 8);
  arch(o, 'stone', x, 4.5, 0.095, 6.95, 10.95, light, d === 3 ? 16 : 8);
  for (const dx of [-2.2, 0, 2.2]) window(facing(o, 0, 0, 0.2), x + dx, 4.6, 1.65, 6.2, d);
  if (d > 1) {
    for (const dx of [-1.1, 1.1]) column(o, x + dx, 4.5, 0.5, 6.55, 0.23, d);
    B(o, 'stone', x, 11.05, 0.35, 7.05, 0.35, 0.55, light);
    archLine(o, x, 4.5, 0.17, 7.2, 11.2, 0.21, stone, d);
    disk(o, 'stone', x, 13.55, 0.23, 0.78, 0.87, stone, 12);
    if (d === 3) {
      disk(o, 'stone', x, 13.55, 0.27, 0.5, 0.59, light, 10);
      B(o, 'stone', x, 12.9, 0.29, 0.4, 0.8, 0.1, shadow);
    }
  }
}
function southBlock(o, x0, x1, z0, z1, height, d, { pavilion = false, main = false } = {}) {
  B(o, 'stone', (x0 + x1) / 2, -1.8, (z0 + z1) / 2, x1 - x0, height + 1.8, z1 - z0, stone);
  B(
    o,
    'roof',
    (x0 + x1) / 2,
    height - 0.05,
    (z0 + z1) / 2,
    x1 - x0 - 0.65,
    0.18,
    z1 - z0 - 0.65,
    lead,
  );
  for (const [angle, x, z, w] of [
    [0, (x0 + x1) / 2, z1, x1 - x0],
    [Math.PI, (x0 + x1) / 2, z0, x1 - x0],
    [-Math.PI / 2, x0, (z0 + z1) / 2, z1 - z0],
    [Math.PI / 2, x1, (z0 + z1) / 2, z1 - z0],
  ]) {
    const f = facing(o, angle, x, z);
    B(f, 'stone', 0, 4.08, 0.08, w, 0.35, 0.35, light);
    cornice(f, w, height - 0.75, d);
    balustrade(f, w, height + 0.02, d);
    if (!d) continue;
    const south = angle === 0;
    if (main && south) {
      for (const dx of [-16.0, 16.0]) pavilionPanel(f, dx, d);
      for (const xx of [-20.4, -11.7, 11.7, 20.4]) {
        B(f, 'stone', xx, 4.5, 0.27, 0.8, 11.2, 0.55, light);
        if (d > 1) B(f, 'stone', xx, 15.7, 0.35, 1.2, 0.55, 0.7, light);
      }
      continue;
    }
    if (pavilion && south) {
      for (const xx of [-9, 0, 9]) pavilionPanel(f, xx, d);
      for (const xx of [-13.7, -4.5, 4.5, 13.7]) {
        B(f, 'stone', xx, 4.5, 0.25, 0.8, 11.2, 0.5, light);
        if (d > 1) B(f, 'stone', xx, 15.7, 0.35, 1.2, 0.55, 0.7, light);
      }
    } else if (!main) {
      const n = Math.max(3, Math.round(w / 3.1));
      for (let i = 0; i < n; i++) {
        const xx = -w / 2 + ((i + 0.5) * w) / n;
        window(f, xx, 4.6, 1.35, 5.5, d);
        if (d > 1) {
          face(f, 'stone', xx - w / n / 2, 4.5, 0.24, 0.35, 7, light);
          face(f, 'stone', xx, 10.75, 0.11, 1.6, 0.65, light);
        }
      }
    } else {
      const n = Math.max(3, Math.round(w / 3.25));
      for (let i = 0; i < n; i++) {
        const xx = -w / 2 + ((i + 0.5) * w) / n;
        window(f, xx, 4.5, 1.6, 4.2, d);
        window(f, xx, 10.2, 1.55, 3.5, d);
        if (d > 1) {
          face(f, 'stone', xx, 9.1, 0.1, 1.8, 0.18, light);
          if (i % 3 === 0) face(f, 'stone', xx - (w / n) * 0.45, 4.3, 0.1, 0.3, 10.5, light);
        }
      }
    }
    const n = Math.max(3, Math.round(w / 3.15));
    for (let i = 0; i < n; i++)
      window(f, -w / 2 + ((i + 0.5) * w) / n, -0.1, 1.35, 3.45, d, { arched: true });
  }
}
function southPortico(o, d) {
  const f = facing(o, 0, 4.3, 6.5);
  B(f, 'stone', 0, 3.95, 2.5, 24, 0.55, 5, stone);
  for (let i = 0; i < 6; i++) column(f, -11 + i * 4.4, 4.5, 4.55, 12.0, 0.7, d, 'corinthian');
  for (const sign of [-1, 1]) {
    const g = facing(f, sign === 1 ? Math.PI / 2 : -Math.PI / 2, sign * 12, 2.35);
    B(g, 'stone', 0, 16.5, 0, 4.9, 1.5, 0.8, stone);
    cornice(g, 4.9, 17.2, d);
  }
  const g = facing(f, 0, 0, 4.55);
  B(g, 'stone', 0, 16.5, 0, 24.3, 1.5, 1.5, stone);
  cornice(g, 24.3, 17.2, d);
  pediment(facing(g, 0, 0, 0.25), 25.3, 17.95, 3.6, 1.55, d);
  if (d) {
    for (const xx of [-7.8, 0, 7.8]) {
      window(f, xx, 4.5, 2.15, 5.7, d);
      if (d > 1) {
        B(f, 'stone', xx, 10.65, 0.1, 2.6, 0.4, 0.3, light);
        B(f, 'stone', xx, 11.05, 0.12, 1.8, 1.3, 0.15, stone);
      }
    }
  }
  const n = d > 1 ? 33 : d ? 15 : 5;
  for (let i = 0; i < n; i++) {
    const y = (4.5 * (i + 1)) / n,
      z0 = 5,
      z1 = 19.3 - (i / n) * 14.3;
    B(f, 'stone', 0, -0.12, (z0 + z1) / 2, 24.0, y + 0.12, z1 - z0, stone);
  }
  for (const sign of [-1, 1]) {
    const x = sign * 12.4;
    B(f, 'stone', x, -0.3, 7.2, 1.0, 4.8, 4.4, stone);
    B(f, 'stone', x, 3.8, 5.4, 1.3, 0.9, 1.3, light);
    B(f, 'stone', x, -0.3, 19.0, 1.25, 0.85, 1.25, stone);
    beam(f, 'stone', [x, 0.65, 19.0], [x, 5.4, 5.4], 0.45, 0.5, light);
    if (d > 1)
      for (let i = 1; i < 15; i++) {
        const t = i / 15;
        B(f, 'stone', x, 0.52 + t * 4.5, 19 - t * 13.6, 0.2, 0.8, 0.22, stone);
      }
  }
}
function northFront(o, d) {
  const f = facing(o, Math.PI, 4.3, -22.7);
  B(f, 'stone', 0, 0.25, 1.7, 16.1, 3.2, 5.4, stone);
  for (const x of [-6.2, -2.06, 2.06, 6.2]) column(f, x, 3.45, 3.9, 11.5, 0.58, d);
  B(f, 'stone', 0, 14.95, 3.9, 16.1, 1.25, 1.4, stone);
  cornice(facing(f, 0, 0, 3.9), 16.1, 15.55, d);
  pediment(facing(f, 0, 0, 4), 17, 16.3, 2.8, 1.5, d, true);
  if (d) {
    window(f, 0, 0.55, 2.6, 2.5, d, { arched: true });
    for (const xx of [-11.7, 11.7]) {
      window(f, xx, 4.5, 1.7, 4.2, d);
      disk(f, 'glass', xx, 12.3, 0.1, 1.15, 1.55, glass, 16);
      if (d > 1) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2,
            b = ((i + 1) / 16) * Math.PI * 2;
          line(
            f,
            'stone',
            [xx + 1.28 * Math.cos(a), 12.3 + 1.7 * Math.sin(a), 0.16],
            [xx + 1.28 * Math.cos(b), 12.3 + 1.7 * Math.sin(b), 0.16],
            0.2,
            light,
          );
        }
      }
    }
  }
  // Two side flights leave the central winter entrance visible.
  for (const sign of [-1, 1]) {
    const h = 3.45,
      n = d > 1 ? 19 : d ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      B(f, 'stone', sign * (14.1 - 7.3 * t), -0.75, 2.1, 7.3 / n + 0.06, h * t + 0.75, 4.2, stone);
    }
    beam(f, 'stone', [sign * 14.3, 0.4, 4.2], [sign * 6.8, 4.55, 4.2], 0.4, 0.4, light);
  }
}
function curvedColonnade(o, sign, d) {
  // Cubic controls follow the separately mapped inner and outer arc, with tapered northern join.
  const inner =
      sign < 0
        ? [
            [-17.3, -28.1],
            [-25.5, -31],
            [-30.1, -42.1],
            [-28.4, -53.1],
          ]
        : [
            [29.1, -23.4],
            [41.3, -27.3],
            [42.0, -43],
            [39.5, -55.2],
          ],
    outer =
      sign < 0
        ? [
            [-29, -18.9],
            [-37.8, -27],
            [-42, -41],
            [-40.9, -50.1],
          ]
        : [
            [35.5, -18.2],
            [45.8, -24.3],
            [49.5, -39],
            [48.3, -53.6],
          ];
  const at = (p, t) =>
    [0, 1].map(
      (k) =>
        (1 - t) * (1 - t) * (1 - t) * p[0][k] +
        3 * (1 - t) * (1 - t) * t * p[1][k] +
        3 * (1 - t) * t * t * p[2][k] +
        t * t * t * p[3][k],
    );
  const n = d === 3 ? 20 : d === 2 ? 16 : d === 1 ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n,
      a = at(inner, t),
      b = at(inner, u),
      c = at(outer, u),
      e = at(outer, t),
      ring = [a, b, c, e];
    prism(o, ring, -1.8, 1.5);
    prism(o, ring, 10.0, 10.85, 'stone', light);
    prism(o, ring, 10.85, 11.05, 'roof', lead);
    // Low hip above the open Ionic colonnade, no speculative north balustrade.
    const p = [a, b, c, e].map((v) => [v[0], 11.05, v[1]]),
      m0 = [(a[0] + e[0]) / 2, 11.75, (a[1] + e[1]) / 2],
      m1 = [(b[0] + c[0]) / 2, 11.75, (b[1] + c[1]) / 2];
    for (const q of [
      [p[0], p[1], m1, m0],
      [p[2], p[3], m0, m1],
    ]) {
      let norm = normalFor(...q);
      if (norm[1] < 0) norm = norm.map((v) => -v);
      for (let j = 1; j < q.length - 1; j++)
        o.addTriangle(
          'roof',
          ref,
          [q[0], q[j], q[j + 1]],
          normalFor(q[0], q[j], q[j + 1]).map(
            (v) => v * (normalFor(q[0], q[j], q[j + 1])[1] < 0 ? -1 : 1),
          ),
          [q[0], q[j], q[j + 1]].map((p) => [p[0], p[2]]),
          lead,
        );
    }
  }
  const nc = d === 0 ? 4 : d === 1 ? 8 : 20;
  for (let i = 0; i <= nc; i++) {
    const t = i / nc;
    for (const curve of [inner, outer]) {
      const p = at(curve, t);
      column(o, p[0], 1.5, p[1], 8.5, 0.29, d);
    }
  }
  const a = at(inner, 1),
    b = at(outer, 1);
  B(
    o,
    'stone',
    (a[0] + b[0]) / 2,
    -1.8,
    (a[1] + b[1]) / 2,
    Math.abs(a[0] - b[0]) + 1,
    12.7,
    Math.abs(a[1] - b[1]) + 1,
    stone,
  );
}
function dome(o, d) {
  const n = d === 0 ? 10 : d === 1 ? 12 : d === 2 ? 24 : 32,
    profile = [
      [18.05, 1],
      [18.6, 0.99],
      [19.5, 0.91],
      [20.6, 0.71],
      [21.4, 0.43],
      [21.75, 0.18],
    ];
  loft(
    o,
    'metal',
    profile.map(([y, s]) => radialRing(y, 8.2 * s, 10.7 * s, n, [4.3, -5.7])),
    rgb('64786d'),
  );
  loft(
    o,
    'glass',
    [radialRing(21.75, 1.45, 1.8, n, [4.3, -5.7]), radialRing(22.25, 1.4, 1.7, n, [4.3, -5.7])],
    glass,
  );
  loft(
    o,
    'metal',
    [radialRing(22.25, 1.5, 1.85, n, [4.3, -5.7]), radialRing(22.6, 0.1, 0.1, n, [4.3, -5.7])],
    lead,
  );
  if (d > 1)
    for (let i = 0; i < n; i += d === 2 ? 2 : 1) {
      const a = (i / n) * Math.PI * 2;
      for (let j = 1; j < profile.length; j++) {
        const [y, s] = profile[j],
          [py, ps] = profile[j - 1];
        beam(
          o,
          'metal',
          [4.3 + 8.2 * ps * Math.cos(a), py + 0.04, -5.7 + 10.7 * ps * Math.sin(a)],
          [4.3 + 8.2 * s * Math.cos(a), y + 0.04, -5.7 + 10.7 * s * Math.sin(a)],
          0.035,
          0.035,
          lead,
        );
      }
    }
}
export function stowe(o, _frame, d = 3) {
  southBlock(o, -17.8, 25.8, -22.7, 6.5, 18.0, d, { main: true });
  southBlock(o, -35, -17.8, -18.8, 4.4, 12.45, d);
  southBlock(o, 25.8, 48.5, -18.5, 3.2, 12.45, d);
  southBlock(o, -62.1, -34.8, -18.8, 6.3, 17.35, d, { pavilion: true });
  southBlock(o, 48.5, 78.3, -20.2, 2.8, 17.35, d, { pavilion: true });
  southBlock(o, -75, -62.1, -23.6, 2.8, 12.45, d);
  // North corner towers and shallow recessed lead-roofed attic behind the main balustrade.
  for (const x of [-13.3, 21.3]) {
    B(o, 'stone', x, 18, -17.3, 8.8, 2.0, 10.8, stone);
    B(o, 'roof', x, 20, -17.3, 9, 0.18, 11, lead);
    if (d)
      for (const angle of [0, Math.PI]) {
        const f = facing(o, angle, x, -17.3 + (angle === 0 ? 5.4 : -5.4));
        B(f, 'stone', 0, 19.7, 0.1, 9.3, 0.3, 0.4, light);
      }
  }
  southPortico(o, d);
  northFront(o, d);
  curvedColonnade(o, -1, d);
  curvedColonnade(o, 1, d);
  dome(o, d);
}
export function stoweSkyline(o) {
  for (const [x, z, w, l, h] of [
    [4, -8, 43.6, 29.2, 19.2],
    [-26.4, -7.2, 17.2, 23.2, 13.6],
    [37.15, -7.6, 22.7, 21.7, 13.6],
    [-48.45, -6.25, 27.3, 25.1, 18.5],
    [63.4, -8.7, 29.8, 23, 18.5],
    [-68.55, -10.4, 12.9, 26.4, 13.6],
  ])
    B(o, 'stone', x, -1.8, z, w, h + 1.8, l, stone);
  for (let i = 0; i < 6; i++) column(o, -6.7 + i * 4.4, 4.5, 11.05, 12, 0.7, 0);
  for (const x of [-1.9, 2.24, 6.36, 10.5]) column(o, x, 3.45, -26.6, 11.5, 0.58, 0);
  for (const [x, z, w, y, r] of [
    [4.3, 11.05, 25.3, 18, 3.6],
    [4.3, -26.7, 17, 16.3, 2.8],
  ]) {
    const f = facing(o, z < 0 ? Math.PI : 0, x, z);
    B(f, 'stone', 0, y - 1.5, 0, w, 1.5, 1.5, stone);
    pediment(f, w, y, r, 1.5, 0);
  }
  for (let i = 0; i < 3; i++) B(o, 'stone', 4.3, 0, 19 - i * 4.8, 24, (i + 1) * 1.5, 4.9, stone);
  for (const sign of [-1, 1]) {
    const inner =
        sign < 0
          ? [
              [-20, -25],
              [-28, -35],
              [-29, -51],
            ]
          : [
              [32, -22],
              [40, -35],
              [41, -54],
            ],
      outer = inner.map((p) => [p[0] + sign * 9, p[1] + 3]);
    for (let i = 0; i < 2; i++) {
      const ring = [inner[i], inner[i + 1], outer[i + 1], outer[i]];
      prism(o, ring, -1.8, 1.5);
      prism(o, ring, 10, 11.3);
    }
    for (const p of inner) column(o, p[0], 1.5, p[1], 8.5, 0.4, 0);
  }
  dome(o, 0);
}
export function stoweDistrict(o) {
  stowe(o, undefined, 1);
}
export function stoweStreet(o) {
  stowe(o, undefined, 2);
}
const surfaces = {
  capitalStone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.3 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const stoweModel = {
  id: 'stowe_house',
  key: 'stowe_house',
  recipe: 'structure-stowe-house.mjs',
  cell: 'gc/gcp',
  title: 'Stowe House',
  brief:
    'Neoclassical main house with six-column Corinthian south portico and broad stairs, triple-arched end pavilions, lower Ionic links, oval copper dome, four-column Ionic north entrance with clock pediment, corner towers and two open curved north colonnades.',
  camera: [160, 94, 175],
  lookAt: [3, 8, -14],
  qaCameras: [
    { name: 'front', position: [4, 27, 145], lookAt: [4, 9, 0] },
    { name: 'back', position: [-90, 58, -130], lookAt: [3, 8, -23] },
    { name: 'south-capital-crown', position: [1, 16.8, 15.5], lookAt: [2.1, 16.1, 11.05] },
    { name: 'south-portico-capitals', position: [18, 17.8, 24], lookAt: [4.3, 15.8, 11] },
  ],
  build: stowe,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'South garden approach [4.3,26], Y=0. Unmodified public terrain data; foundations extend to -1.8 m and principal floor is 4.5 m above the south stair approach. North curved walks are at Y=1.5; coarse host elevations are not surveyed floor levels.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-stowe-house.mjs',
    level: 'skyline',
    export: 'stoweSkyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'stoweDistrict', errorMeters: 0.27, surfaces },
      street: { export: 'stoweStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Current construction uses two exact native cleared Qualla photographer-CC0 south-front/capital-detail originals. Six close capitals use closed layered leaf stocks and corner volutes; original house/wings/steps retained. Earlier attribution/private conservation/aerial sources are historical and excluded. Broader north/hidden roof fidelity remains pending; dimensions, leaf/scroll profiles and current condition are estimates.',
    'Main house, flanking pavilions and links, north curved colonnades and south steps only; attached service courts, separate garden temples, freestanding statues and interiors excluded.',
    'Independent unmodified Terrarium terrain retained; ground beneath buildings is interpolated composite evidence. Host terrain can differ. Footprint replacement disabled.',
    'Corinthian acanthus, Ionic volutes, roundel sculpture, lions and fine carved ornament simplified or omitted. No photographic textures and no physical-device performance measurement.',
  ],
};
