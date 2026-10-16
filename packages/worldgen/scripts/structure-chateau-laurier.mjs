/** Château Laurier: mapped historic U, individual roof facets, octagonal pavilions and canal terrace. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/f2/f24/chateau_laurier/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  wall = rgb('c5c2ae'),
  trim = rgb('d1ccba'),
  roof = rgb('4d625e'),
  glass = rgb('354b51');
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
function win(o, x, y, z, w, h, d, arched = false) {
  if (!d) return;
  z += 0.08;
  if (!arched) {
    if (d > 1) face(o, 'trim', x, y - 0.12, z - 0.06, w + 0.28, h + 0.25, trim);
    face(o, 'glass', x, y, z, w, h, glass);
    if (d === 2) return;
    if (d > 1) {
      face(o, 'trim', x, y + h * 0.36, z + 0.06, w, 0.095, trim);
      if (w > 1.75) face(o, 'trim', x, y, z + 0.06, 0.1, h, trim);
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
    face(o, 'trim', x, y - 0.08, z - 0.06, w + 0.26, h + 0.22, trim);
    face(o, 'trim', x, y + h * 0.36, z + 0.04, w, 0.095, trim);
    if (w > 1.75) face(o, 'trim', x, y, z + 0.05, 0.1, h, trim);
    return;
  }
  for (const sx of [-1, 1])
    face(o, 'trim', x + sx * (w / 2 + 0.065), y - 0.06, z + 0.06, 0.13, h + 0.12, trim);
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
      face(o, 'glass', x - w * 0.25, y + 0.1, z + 0.07, w * 0.18, h * 0.8, rgb('909790'));
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
function clean(r) {
  const a = r.filter((p, i) => !i || Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) > 0.06);
  if (Math.hypot(a[0][0] - a.at(-1)[0], a[0][1] - a.at(-1)[1]) < 0.1) a.pop();
  let changed = true;
  while (changed && a.length > 3) {
    changed = false;
    for (let i = 0; i < a.length; i++) {
      const p = a[(i + a.length - 1) % a.length],
        q = a[i],
        r = a[(i + 1) % a.length];
      const cross = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
      if (Math.abs(cross) < 0.02) {
        a.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return a;
}
function cap(o, r, y, slot = 'wall', color = wall) {
  r = clean(r);
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const t = ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]);
    o.addTriangle(
      slot,
      ref,
      t,
      [0, 1, 0],
      t.map((v) => [v[0], v[2]]),
      color,
    );
  }
}
function prism(o, r, lo, hi, color = wall, slot = 'wall', top = true) {
  r = clean(r);
  let area = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area > 0) r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    quad(
      o,
      slot,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len],
      color,
    );
  }
  if (top) cap(o, r, hi, slot, color);
}
function circle(o, x, z, r, lo, hi, d) {
  loft(
    o,
    'wall',
    [radialRing(lo, r, r, d > 1 ? 16 : 8, [x, z]), radialRing(hi, r, r, d > 1 ? 16 : 8, [x, z])],
    wall,
  );
  cap(
    o,
    radialRing(hi, r, r, d > 1 ? 16 : 8, [x, z]).map((p) => [p[0], p[2]]),
    hi,
  );
}
function cone(o, x, z, r, y, rise, d) {
  const n = d > 1 ? 16 : 6;
  loft(
    o,
    'roof',
    [radialRing(y, r, r, n, [x, z]), radialRing(y + rise, 0.045, 0.045, n, [x, z])],
    roof,
  );
  if (d > 1) B(o, 'roof', x, y + rise, z, 0.09, 1, 0.09, roof);
}
function detailEdge(o, a, b, hi, d, { lo = 0, ground = true, ornate = true, roofY = hi } = {}) {
  if (!d) return;
  const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (len < 2.6) return;
  const q = edgeFrame(o, a, b),
    n = Math.max(1, Math.floor((len - 0.8) / 3.3)),
    step = (len - 0.8) / n;
  for (let row = 0, y = lo + 1.4; y < hi - 1.7; y = row === 0 ? lo + 8.6 : y + 3.5, row++) {
    if (d === 1 && row % 2) continue;
    if (d === 2 && (row % 3 === 1 || row === 6)) continue;
    for (let i = 0; i < n; i++) {
      if (d === 1 && i % 2) continue;
      const x = (i - (n - 1) / 2) * step;
      win(
        q,
        x,
        y,
        0.045,
        row === 0 ? Math.min(2.2, step * 0.68) : 1.3,
        row === 0 ? 4.1 : 2.05,
        d,
        ground && row === 0,
      );
    }
  }
  if (d > 1) {
    B(q, 'trim', 0, 7.1, 0.1, len, 0.23, 0.35, trim);
    B(q, 'trim', 0, hi - 0.25, 0.08, len, 0.28, 0.4, trim);
    if (ornate) {
      B(q, 'trim', 0, hi - 3.1, 0.08, len, 0.25, 0.35, trim);
      if (d > 2)
        for (let x = -len / 2 + 0.35; x < len / 2; x += 0.85)
          B(q, 'trim', x, hi - 3.75, 0.15, 0.23, 0.7, 0.5, trim);
    }
  }
  const entranceEdge = a[1] > 54.5 && b[1] > 54.5;
  if (d > 2 && len > 7 && ornate && !entranceEdge) {
    const n = Math.max(1, Math.floor(len / (d === 2 ? 14 : 6.7)));
    for (let i = 0; i < n; i++) {
      const x = ((i - (n - 1) / 2) * len) / n;
      gable(q, x, 0.23, roofY - 1.8, 3.1, 4.5, d);
    }
  }
}
function edges(o, r, hi, d, options = {}) {
  r = clean(r);
  let area = 0;
  r.forEach((p, i) => {
    const q = r[(i + 1) % r.length];
    area += p[0] * q[1] - q[0] * p[1];
  });
  if (area > 0) r.reverse();
  for (let i = 0; i < r.length; i++) detailEdge(o, r[i], r[(i + 1) % r.length], hi, d, options);
}
function roofFacet(o, r, heights, baseY, d, color = roof) {
  r = clean(r);
  const vv = r.map((p) => [p[0], heights(p, baseY), p[1]]),
    ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const t = ids.slice(i, i + 3).map((k) => vv[k]);
    o.addTriangle(
      'roof',
      ref,
      t,
      upNormal(t),
      t.map((p) => [p[0], p[2]]),
      color,
    );
  }
  if (d < 2) return;
  // Dormers sit on the low edge of each actual plane, with their back volume entering that roof.
  let ar = 0;
  r.forEach((p, i) => {
    const q = r[(i + 1) % r.length];
    ar += p[0] * q[1] - q[0] * p[1];
  });
  for (let i = 0; i < r.length; i++) {
    let a = r[i],
      b = r[(i + 1) % r.length];
    if (heights(a, baseY) > baseY + 0.2 || heights(b, baseY) > baseY + 0.2) continue;
    const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (len < 8) continue;
    if (ar > 0) [a, b] = [b, a];
    const q = edgeFrame(o, a, b);
    const n = Math.max(1, Math.floor(len / (d === 2 ? 15 : 7.5)));
    for (let j = 0; j < n; j++)
      dormer(q, ((j - (n - 1) / 2) * (len - 3)) / n, -1.25, baseY + 2.1, 1.6, 1.7, 3, d, color);
  }
}
function oriel(o, a, x, z, y, hi, d) {
  const q = facing(o, a, x, z);
  if (d < 2) return;
  const r = [
    [-1.7, -0.1],
    [1.7, -0.1],
    [1.7, 0.4],
    [1.05, 1.0],
    [-1.05, 1],
    [-1.7, 0.4],
  ];
  prism(q, r, y, hi, trim, 'trim');
  for (let yy = y + 0.4; yy < hi - 1; yy += 3.5) {
    win(q, 0, yy, 1.04, 1.3, 2.1, d);
    win(facing(q, Math.PI / 4, 1.4, 0.7), 0, yy, 0.07, 0.6, 2.1, d);
    win(facing(q, -Math.PI / 4, -1.4, 0.7), 0, yy, 0.07, 0.6, 2.1, d);
  }
  B(q, 'trim', 0, hi, 0.55, 3.7, 0.27, 1.4, trim);
  B(q, 'trim', 0, hi + 1.2, 1.1, 3.6, 0.14, 0.18, trim);
  if (d > 2)
    for (let x = -1.7; x < 1.7; x += 0.55) {
      beam(q, 'trim', [x, hi + 0.2, 1.1], [x + 0.5, hi + 1.1, 1.1], 0.1, 0.1, trim);
      beam(q, 'trim', [x + 0.5, hi + 0.2, 1.1], [x, hi + 1.1, 1.1], 0.1, 0.1, trim);
    }
}
function archPortico(o, x, z, w, depth, d) {
  const q = facing(o, 0, x, z),
    count = 3,
    step = w / count,
    archW = step - 1.0,
    stem = 3.8,
    rise = 1.2;
  // Actual through-open arches and a roof slab, rather than painted black doors.
  B(q, 'trim', 0, 5.1, 0, w, 1.1, depth, trim);
  B(q, 'trim', 0, 6.2, 0, w + 0.4, 0.27, depth + 0.4, trim);
  for (let i = 0; i <= count; i++) {
    const xx = -w / 2 + i * step;
    B(q, 'trim', xx, 0, depth / 2 - 0.8, 1.0, stem, 1.6, trim);
    B(q, 'trim', xx, 3.5, depth / 2 - 0.8, 1.25, 0.35, 1.85, trim);
    B(q, 'trim', xx, 0, -depth / 2 + 0.4, 1, 5.2, 0.8, trim);
  }
  for (let j = 0; j < count; j++) {
    const c = (j - (count - 1) / 2) * step,
      n = d > 1 ? 10 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n,
        xa = c + (Math.cos(a) * archW) / 2,
        xb = c + (Math.cos(b) * archW) / 2,
        ya = stem + Math.sin(a) * rise,
        yb = stem + Math.sin(b) * rise;
      for (const zz of [depth / 2, depth / 2 - 1.6])
        quad(
          q,
          'trim',
          [
            [xa, ya, zz],
            [xb, yb, zz],
            [xb, 5.2, zz],
            [xa, 5.2, zz],
          ],
          [0, 0, zz === depth / 2 ? 1 : -1],
          trim,
        );
      const p = [
        [xa, ya, depth / 2],
        [xa, ya, depth / 2 - 1.6],
        [xb, yb, depth / 2 - 1.6],
        [xb, yb, depth / 2],
      ];
      quad(q, 'trim', p, normalFor(...p), trim);
    }
  }
  if (d > 1)
    for (const xx of [-w / 2, w / 2]) B(q, 'trim', xx, 6.3, depth / 2, 0.5, 0.9, 0.5, trim);
}
export function laurier(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const f = new Map(frame.features.map((v) => [v.index, v])),
    groups = frame.authoredRoofGroups;
  const points = [],
    segments = [];
  for (const g of groups) {
    for (const i of g.parts) for (const p of f.get(i).rings[0]) points.push([p, g.eave]);
    for (const p of g.ridgePoints) points.push([p, g.ridge]);
    for (let i = 0; i < g.ridgePoints.length - 1; i++)
      segments.push([g.ridgePoints[i], g.ridgePoints[i + 1], g.ridge]);
  }
  const height = (p, eave) => {
    let y = eave;
    for (const [v, h] of points)
      if (Math.hypot(p[0] - v[0], p[1] - v[1]) < 0.13) y = Math.max(y, h);
    for (const [a, b, h] of segments) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = dx * dx + dz * dz;
      if (len < 0.001) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len));
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 0.13) y = Math.max(y, h);
    }
    return y;
  };
  const roofColor = (g) => (g.ridge === 39 ? rgb('607b70') : rgb('515e57'));
  if (d === 0) {
    for (const g of groups) {
      for (const poly of g.polygons) prism(o, poly[0], -8, g.eave, wall, 'wall', false);
      for (const i of g.parts) roofFacet(o, f.get(i).rings[0], height, g.eave, 0, roofColor(g));
    }
    for (const i of [0, 45, 50]) prism(o, f.get(i).rings[0], -8, i === 45 ? 0.5 : 8);
    for (const [x, z, r, top, rise] of [
      [-24.9, 43.6, 4.05, 43, 14],
      [33.5, -20, 4.1, 39, 14],
    ]) {
      circle(o, x, z, r, -8, top, 0);
      cone(o, x, z, r + 0.2, top, rise, 0);
    }
    B(o, 'wall', 21, 27, 29.5, 9.7, 19, 11.7, wall);
    const towerHeight = (p) =>
      Math.hypot(p[0] - 20.966, p[1] - 28.683) < 0.1 ||
      Math.hypot(p[0] - 20.983, p[1] - 30.66) < 0.1
        ? 64
        : 46;
    for (const i of [11, 12, 15, 22, 26, 31, 32, 33])
      roofFacet(o, f.get(i).rings[0], towerHeight, 46, 0);
    B(o, 'wall', 20.5, -8, 29.5, 15.5, 38, 17, wall);
    B(o, 'trim', -5.9, 5.1, 58.3, 20.4, 1.37, 10.7, trim);
    for (const x of [-16.1, -9.3, -2.5, 4.3]) B(o, 'trim', x, 0, 62.8, 1, 5.1, 1.6, trim);
    return;
  }
  // Each individually mapped range has its own eave and roof; internal overlapping walls are occluded.
  if (d === 0)
    for (const poly of frame.authoredMainShell) prism(o, poly[0], -9, 27, wall, 'wall', false);
  for (const g of groups) {
    for (const poly of g.polygons) {
      if (d > 0) prism(o, poly[0], -9, g.eave, wall, 'wall', false);
      else if (g.eave > 27) prism(o, poly[0], 27, g.eave, wall, 'wall', false);
      edges(o, poly[0], g.eave, d);
    }
    for (const i of g.parts) roofFacet(o, f.get(i).rings[0], height, g.eave, d, roofColor(g));
  }
  // Lower halls occupy the centre of the U, well below the surrounding bedrooms.
  for (const i of [0, 10, 43, 50]) {
    const top = i === 0 ? 7.5 : i === 50 ? 8.0 : 30;
    prism(o, f.get(i).rings[0], -9, top);
    edges(o, f.get(i).rings[0], top, d, { ground: true, ornate: false });
    cap(o, f.get(i).rings[0], top + 0.06, 'roof', rgb('767b73'));
  }
  // Tall octagonal tower behind the southeast entrance pavilion. Mapped roof, not a generic cone.
  const towerParts = [11, 12, 15, 22, 26, 31, 32, 33],
    outer = [
      [17.814, 23.801],
      [24.211, 23.791],
      [25.738, 25.71],
      [25.697, 33.796],
      [24.423, 35.473],
      [18.025, 35.484],
      [16.101, 33.812],
      [16.073, 25.438],
    ];
  prism(o, f.get(9).rings[0], -9, 30);
  edges(o, f.get(9).rings[0], 30, d);
  roofFacet(
    o,
    f.get(9).rings[0],
    (p) => (outer.some((v) => Math.hypot(p[0] - v[0], p[1] - v[1]) < 0.1) ? 43 : 30),
    30,
    0,
  );
  prism(o, outer, 30, 46);
  edges(o, outer, 46, d, { lo: 30, ground: false, ornate: false });
  const th = (p) =>
    Math.hypot(p[0] - 20.966, p[1] - 28.683) < 0.1 || Math.hypot(p[0] - 20.983, p[1] - 30.66) < 0.1
      ? 64
      : 46;
  for (const i of towerParts) roofFacet(o, f.get(i).rings[0], th, 46, d > 2 ? 2 : 0);
  // Slim circular towers rise above their inset corners; their conical caps dominate the street view.
  for (const [x, z, r, top, rise] of [
    [-24.9, 43.6, 4.05, 43, 14],
    [33.5, -20.0, 4.1, 39, 14],
  ]) {
    circle(o, x, z, r, -9, top, d);
    cone(o, x, z, r + 0.2, top, rise, d);
    if (d) {
      circle(o, x, z, r + 0.27, top - 4.2, top - 2.8, d);
      for (let i = 0; i < (d > 1 ? 8 : 4); i++) {
        const a = (i * Math.PI * 2) / (d > 1 ? 8 : 4),
          q = facing(o, a, x, z);
        for (let y = 2; y < top - 1.8; y += d === 1 ? 7 : 3.5) win(q, 0, y, r + 0.045, 1.1, 1.9, d);
        if (d > 2) {
          B(q, 'trim', 0, top - 5, r + 0.07, 0.25, 0.8, 0.5, trim);
          gable(q, 0, r + 0.22, top - 0.4, 1.8, 3.3, d);
        }
      }
    }
  }
  // Inset corbelled corner turrets on the canal-facing pavilion pair.
  if (d)
    for (const [x, z] of [
      [-44.7, -7.5],
      [-32.3, 21.6],
      [-30.3, -12.4],
      [-18.5, 17.2],
    ]) {
      circle(o, x, z, 1.35, 21.5, 31, d);
      cone(o, x, z, 1.55, 31, 5.6, d);
    }
  // Paired Rideau oriels and the deep three-arch carriage entrance.
  oriel(o, 0, -20.0, 55.2, 6.8, 25.5, d);
  oriel(o, 0, 8.4, 54.75, 6.8, 25.5, d);
  archPortico(o, -5.9, 58.3, 20.4, 10.7, d);
  if (d > 1)
    for (const [x, z] of [
      [-20, 55.6],
      [8.4, 55.05],
    ]) {
      gable(o, x, z, 30.0, 5.2, 7.1, d);
      for (const dx of [-0.85, 0.85]) win(o, x + dx, 30.5, z + 0.1, 1.15, 2.3, d);
      if (d > 2) {
        B(o, 'trim', x, 35.1, z + 0.04, 1.25, 1.3, 0.22, trim);
        for (const dx of [-2.35, 2.35]) {
          B(o, 'trim', x + dx, 31, z, 0.17, 2.8, 0.23, trim);
          B(o, 'trim', x + dx, 33.8, z, 0.09, 1, 0.12, trim);
        }
      }
    }

  // Mackenzie portico is the smaller side entrance beneath the transverse wing.
  archPortico(facing(o, Math.PI / 2 - 0.3, 37, -31.3), 0, 0, 12.3, 4.0, d);
  if (d > 1) {
    for (const x of [-11.9, -5.9, 0.1]) {
      win(o, x, 6.9, 52.6, 2.65, 3.1, d);
      gable(o, x, 52.6, 25.4, 3.5, 4.4, d);
    }
    for (const [x, z] of [
      [-41, -27],
      [-31, 9],
      [7, -50],
      [30, 0],
      [-17, 44],
    ]) {
      B(o, 'trim', x, 37, z, 1.35, 6, 1.6, trim);
      B(o, 'trim', x, 43, z, 1.6, 0.35, 1.85, trim);
    }
  }
  // Canal-side terrace and exposed arched lower level preserve the actual descent.
  const terrace = f.get(45).rings[0];
  prism(o, terrace, -9, 0.45, wall);
  cap(o, terrace, 0.5, 'trim', trim);
  edges(o, terrace, 0.45, d, { lo: -5.4, ground: true, ornate: false });
  const ra = [
    [-64.728, -37.621],
    [-51.271, 5.78],
    [-46.702, 20.38],
  ];
  if (d > 1)
    for (let i = 0; i < ra.length - 1; i++) {
      const a = ra[i],
        b = ra[i + 1],
        q = edgeFrame(o, a, b),
        w = Math.hypot(a[0] - b[0], a[1] - b[1]);
      B(q, 'trim', 0, 0.5, 0, w, 0.25, 0.45, trim);
      B(q, 'trim', 0, 1.55, 0, w, 0.18, 0.38, trim);
      for (let x = -w / 2; x < w / 2; x += 2.4) B(q, 'trim', x, 0.5, 0, 0.24, 1.05, 0.3, trim);
    }
  // Low glazed Rideau lounge; opaque lower base and shallow roof match the photograph.
  const lounge = f.get(68).rings[0];
  prism(o, lounge, -9, 5.2);
  cap(o, lounge, 5.28, 'roof', roof);
  edges(o, lounge, 5.2, d, { ground: false, ornate: false });
  if (d > 1) {
    const q = facing(o, 0, 24.5, 56.6);
    for (let x = -7; x <= 7; x += 2) win(q, x, 0.7, 0, 1.75, 3.6, d);
  }
}
export function laurierSkyline(o) {
  laurier(o, undefined, 0);
}
export function laurierDistrict(o) {
  laurier(o, undefined, 1);
}
export function laurierStreet(o) {
  laurier(o, undefined, 2);
}
const stone = { slot: 'wall', graph: 'stone_limestone', roughness: 0.9, metallic: 0 };
const surfaces = {
  wall: stone,
  trim: stone,
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.73, metallic: 0.3 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const laurierModel = {
  id: 'chateau_laurier',
  recipe: 'structure-chateau-laurier.mjs',
  key: 'chateau_laurier',
  cell: 'f2/f24',
  title: 'Château Laurier',
  brief:
    'Indiana-limestone railway hotel with historic U-shaped wings, steep individual copper roofs, octagonal entrance pavilions and tall rear tower, inset round turrets, corbelled cornices, three-arch portico and low canal terrace.',
  camera: [-147, 93, 198],
  lookAt: [-9, 24, 0],
  qaCameras: [
    { name: 'front', position: [-106, 63, 172], lookAt: [-7, 25, 17] },
    { name: 'back', position: [131, 98, -172], lookAt: [-7, 23, -5] },
  ],
  build: laurier,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Rideau Street sidewalk [-6,65], independent unmodified NRCan HRDEM Mosaic DTM; canal terrace descends approximately six metres.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chateau-laurier.mjs',
    level: 'skyline',
    export: 'laurierSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'laurierDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'laurierStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    'Historic 1912/1929 exterior interpreted from individually inspected Qualla 2008/2012 front and canal photographs, NCC phase/aerial study, existing west elevation in the 2020 heritage-impact report, mapped roof facets and satellite context.',
    'Mapped ridge heights of 39/45 m and 64 m main tower are approximate and agree with the existing hotel depiction beside dimensioned proposed buildings. The drawing does not provide a measured hotel survey.',
    'Fine heraldic carving, exact room-by-room openings, hidden service elevations, roof intersections and terrace limits remain simplified. Lower central halls are retained; no interiors or proposed modern addition, removed garage, separate canal buildings or landscaping.',
    'Unmodified independent NRCan ground data retains the canal drop; host runtime terrain may differ. Footprint suppression remains disabled.',
    'Photo pixels are not embedded. Copper tone follows the dated daylight images; weathering may differ today.',
  ],
};
