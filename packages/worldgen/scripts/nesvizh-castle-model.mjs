/** Nesvizh Castle: mapped six-sided palace court, two Baroque towers, vaulted entrance and earth bastions. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u9/u96/n0254_nesvizh_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const plaster = [0.92, 0.78, 0.43],
  trim = [0.93, 0.89, 0.74],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  tile = [0.64, 0.28, 0.16],
  glass = [0.095, 0.115, 0.105];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function points(id) {
  return map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
}
function ring(id, tolerance = 0.075) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        l &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  const ry = Math.min(w / 2, h * 0.65),
    spring = y + h - ry;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + Math.sin(angle) * ry]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'plaster', c = plaster) {
  const valid = !near(o) ? windows.filter((v) => v[5]) : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], !near(o) ? 4 : 12)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  if (o.detail === 'district')
    for (const v of windows.filter((v) => !v[5])) {
      face(
        o,
        'glass',
        [
          [v[0] - v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1], 0.025],
          [v[0] + v[2] / 2, v[1] + v[3], 0.025],
          [v[0] - v[2] / 2, v[1] + v[3], 0.025],
        ],
        glass,
      );
    }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      if (!v[5]) tri(o, 'glass', p, glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        if (!(v[5] && j === 0)) line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1 && !v[5]) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o) && !v[5])
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}

function edges(o, p, fn, closed = true) {
  for (let i = 0; i < p.length - (closed ? 0 : 1); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.02)
      fn(edgeFrame(o, closed ? b : a, closed ? a : b), len, i, closed ? b : a, closed ? a : b);
  }
}
function solid(o, p, lo, hi, slot = 'plaster', c = plaster) {
  edges(o, p, (f, len) => panel(f, len, lo, hi, [], slot, c));
  cap(o, p, hi, slot, c);
}
const center = (p) => p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
function scaled(p, k) {
  const c = center(p);
  return p.map((v) => mix(c, v, k));
}
function roofFacet(o, a, b, c, d, detailed = true) {
  const collapsed = Math.hypot(...c.map((v, i) => v - d[i])) < 0.001;
  const p = collapsed ? [a, b, c] : [a, b, c, d];
  if (normalFor(...p)[1] < 0) p.reverse();
  if (collapsed) tri(o, 'tile', p, tile);
  else face(o, 'tile', p, tile);
  if (!fine(o) || !detailed) return;
  // Tile courses are explicit in the master, with coarser strips in close-up.
  const n = normalFor(...p),
    rows = Math.max(
      1,
      Math.ceil(Math.hypot(...d.map((v, i) => v - a[i])) / (master(o) ? 0.33 : 2.2)),
    );
  for (let r = 0; r < rows; r++) {
    const aa = mix(a, d, (r + 0.04) / rows),
      bb = mix(b, c, (r + 0.04) / rows),
      cc = mix(b, c, (r + 0.96) / rows),
      dd = mix(a, d, (r + 0.96) / rows);
    const cols = Math.max(
      1,
      Math.floor(Math.hypot(...bb.map((v, i) => v - aa[i])) / (master(o) ? 0.28 : 2.8)),
    );
    for (let k = 0; k < cols; k++) {
      const u = (k + 0.04) / cols,
        v = (k + 0.96) / cols;
      const q = [mix(aa, bb, u), mix(aa, bb, v), mix(dd, cc, v), mix(dd, cc, u)].map((p) =>
        p.map((v, i) => v + n[i] * 0.024),
      );
      if (normalFor(...q)[1] < 0) q.reverse();
      face(o, 'tile', q, color(tile, 0.86 + ((r * 7 + k * 13) % 11) * 0.022));
    }
  }
}
function roofStrip(o, a, b, c, d, y, h, detail = true) {
  const u = mix(a, d, 0.5),
    v = mix(b, c, 0.5);
  roofFacet(
    o,
    [...a.slice(0, 1), y, a[1]],
    [b[0], y, b[1]],
    [v[0], y + h, v[1]],
    [u[0], y + h, u[1]],
    detail,
  );
  roofFacet(o, [c[0], y, c[1]], [d[0], y, d[1]], [u[0], y + h, u[1]], [v[0], y + h, v[1]], detail);
  tri(
    o,
    'tile',
    [
      [a[0], y, a[1]],
      [u[0], y + h, u[1]],
      [d[0], y, d[1]],
    ],
    tile,
  );
  tri(
    o,
    'tile',
    [
      [b[0], y, b[1]],
      [c[0], y, c[1]],
      [v[0], y + h, v[1]],
    ],
    tile,
  );
}
function corridorRoof(o, path, width, y, h) {
  // Mitered joined strip follows the curved northern barracks instead of roofing its enclosure.
  const sides = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)];
    const normal = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    };
    const n1 = normal(i ? p : a, i ? a : b).map((v) => (i ? -v : v)),
      n2 = normal(i === path.length - 1 ? a : p, b);
    const nn = [n1[0] + n2[0], n1[1] + n2[1]],
      l = Math.hypot(...nn);
    nn[0] /= l;
    nn[1] /= l;
    const d = width / 2 / Math.max(0.3, nn[0] * n2[0] + nn[1] * n2[1]);
    return [
      [p[0] + nn[0] * d, p[1] + nn[1] * d],
      [p[0] - nn[0] * d, p[1] - nn[1] * d],
    ];
  });
  for (let i = 1; i < path.length; i++)
    roofStrip(o, sides[i - 1][0], sides[i][0], sides[i][1], sides[i - 1][1], y, h);
}
const baseY = 4;
const inside = (p, r) => {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
};
const towerIds = new Set([
  1116912076, 1116912079, 1116912080, 1117189768, 1117255746, 1117255747, 1117255748, 1117255749,
  1117255750, 1116917499,
]);
const parts = map.features
  .filter(
    (f) =>
      f.tags['building:part'] &&
      Number(f.tags.height) > 4.5 &&
      !towerIds.has(Number(f.id.slice(4))),
  )
  .map((f) => ({
    id: Number(f.id.slice(4)),
    p: ring(Number(f.id.slice(4))),
    hi: Number(f.tags.height),
    lo: Number(f.tags.min_height ?? 0),
    rise: Number(f.tags['roof:height'] ?? 0),
    shape: f.tags['roof:shape'],
  }));
function cylinder(o, x, z, r, lo, hi, slot = 'carved', c = trim, sides = 12) {
  const p = Array.from({ length: sides }, (_, i) => [
    x + r * Math.cos((i * Math.PI * 2) / sides),
    z + r * Math.sin((i * Math.PI * 2) / sides),
  ]);
  solid(o, p, lo, hi, slot, c);
  return p;
}
function band(o, p, y, h = 0.22, k = 1.025, slot = 'carved', c = trim) {
  solid(o, scaled(p, k), y, y + h, slot, c);
}
function shapeFace(o, p, depth = 0, slot = 'carved', c = trim) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], depth]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function facade(o, p, lo, hi, { id, spacing = 3.6, floors = 3, passage = false } = {}) {
  edges(o, p, (f, len, _i, a, b) => {
    const nx = -(b[1] - a[1]) / len,
      nz = (b[0] - a[0]) / len;
    // Adjacent mapped parts share walls. Suppress hidden facade detail while keeping a closed shell.
    const exposedAt = (t) => {
      const m = mix(a, b, t);
      return !parts.some(
        (v) =>
          v.id !== id &&
          v.lo + baseY < lo + 0.5 &&
          v.hi - v.rise + baseY > hi - 0.1 &&
          inside([m[0] + nx * 0.18, m[1] + nz * 0.18], v.p),
      );
    };
    const exposed = [0.15, 0.5, 0.85].some(exposedAt);
    const windows = [];
    const n = Math.floor(len / spacing);
    if (exposed && len > 2.5 && o.detail !== 'skyline')
      for (let k = 0; k < n; k++)
        for (let r = 0; r < floors; r++) {
          const step = (hi - lo) / floors,
            h = Math.min(2.2, step * 0.59),
            y = lo + r * step + 0.55;
          if (!exposedAt((k + 0.5) / n)) continue;
          windows.push([((k + 0.5) * len) / n, y, Math.min(1.05, (len / n) * 0.4), h, false]);
        }
    if (passage && len > 6 && len < 9) windows.push([len / 2, lo, 3.4, 3.9, true, true]);
    panel(f, len, lo, hi, windows);
    if (!near(o) || !exposed) return;
    box(f, 'carved', [0, hi - 0.3, -0.13], [len, hi + 0.1, 0.18], trim);
    if (fine(o)) {
      for (let r = 1; r < floors; r++)
        box(
          f,
          'carved',
          [0, lo + ((hi - lo) * r) / floors - 0.1, -0.02],
          [len, lo + ((hi - lo) * r) / floors + 0.08, 0.16],
          trim,
        );
      for (let k = 0; k <= n; k++)
        if (n > 0) {
          const x = (k * len) / n;
          box(f, 'carved', [x - 0.13, lo + 0.15, -0.05], [x + 0.13, hi - 0.2, 0.13], trim);
        }
    }
  });
}
function clipped(p, axis, limit, positive) {
  const out = [],
    d = (v) => v[0] * axis[0] + v[1] * axis[1] - limit;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = d(a),
      db = d(b),
      ina = positive ? da >= -1e-8 : da <= 1e-8,
      inb = positive ? db >= -1e-8 : db <= 1e-8;
    if (ina) out.push(a);
    if (ina !== inb) out.push(mix(a, b, da / (da - db)));
  }
  return out;
}
function gabled(o, p, y, rise, axis = [1, 0], ornamental = false) {
  const norm = Math.hypot(...axis);
  axis = axis.map((v) => v / norm);
  const side = [-axis[1], axis[0]],
    vs = p.map((v) => v[0] * side[0] + v[1] * side[1]),
    v0 = Math.min(...vs),
    v1 = Math.max(...vs),
    vm = (v0 + v1) / 2;
  const height = (v) =>
    y + rise * Math.max(0, 1 - Math.abs((v[0] * side[0] + v[1] * side[1] - vm) / ((v1 - v0) / 2)));
  for (const sign of [false, true]) {
    const pp = clipped(p, side, vm, sign);
    const ix = earcut(pp.flat());
    for (let j = 0; j < ix.length; j += 3) {
      const q = ix.slice(j, j + 3).map((i) => [pp[i][0], height(pp[i]), pp[i][1]]);
      if (normalFor(...q)[1] < 0) q.reverse();
      tri(o, 'tile', q, tile);
    }
    if (master(o)) {
      const u = p.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        umin = Math.min(...u),
        umax = Math.max(...u);
      for (let v = (sign ? vm : v0) + 0.05; v < (sign ? v1 : vm) - 0.05; v += 0.33)
        for (let u = umin + 0.05; u < umax - 0.1; u += 0.29) {
          const corners = [
            [u, v],
            [u + 0.25, v],
            [u + 0.25, Math.min(v + 0.28, sign ? v1 : vm)],
            [u, Math.min(v + 0.28, sign ? v1 : vm)],
          ].map(([a, b]) => [axis[0] * a + side[0] * b, axis[1] * a + side[1] * b]);
          if (!corners.every((v) => inside(v, p))) continue;
          const q = corners.map((v) => [v[0], height(v) + 0.018, v[1]]);
          if (normalFor(...q)[1] < 0) q.reverse();
          face(
            o,
            'tile',
            q,
            color(tile, 0.91 + (((Math.round(u * 9 + v * 7) % 7) + 7) % 7) * 0.019),
          );
        }
    }
  }
  edges(o, p, (f, len, _i, a, b) => {
    const h0 = height(a),
      h1 = height(b);
    if (h0 > y + 0.01 || h1 > y + 0.01) {
      const q = [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], h1, b[1]],
        [a[0], h0, a[1]],
      ];
      if (h0 <= y + 0.001) tri(o, 'plaster', [q[0], q[1], q[2]], plaster);
      else if (h1 <= y + 0.001) tri(o, 'plaster', [q[0], q[1], q[3]], plaster);
      else face(o, 'plaster', q, plaster);
    }
    if (
      ornamental &&
      near(o) &&
      Math.abs((b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1]) < len * 0.15
    ) {
      const g = frame(f, 0, 0, 0.08),
        peak = rise + y;
      shapeFace(
        g,
        [
          [0, y - 0.1],
          [len, y - 0.1],
          [len / 2, peak + 0.25],
        ],
        0.02,
        'plaster',
        plaster,
      );
      line(g, [0, y, 0], [len / 2, peak + 0.25, 0], 0.22);
      line(g, [len / 2, peak + 0.25, 0], [len, y, 0], 0.22);
      if (fine(o)) {
        cylinder(
          frame(g, len / 2, y + rise * 0.38, 0, Math.PI / 2),
          0,
          0,
          0.3,
          -0.02,
          0.09,
          'metal',
          [0.17, 0.16, 0.14],
          16,
        );
      }
    }
  });
}
function dormer(o, x, y, z, a = 0) {
  if (!near(o)) return;
  const f = frame(o, x, y, z, a),
    r = 0.65,
    steps = master(o) ? 16 : 6;
  panel(f, 1.3, 0, 0.9, [[0.65, 0.12, 0.73, 0.68, true]], 'metal', [0.19, 0.17, 0.14]);
  for (let j = 0; j < steps; j++) {
    const t = (j * Math.PI) / steps,
      u = ((j + 1) * Math.PI) / steps;
    face(
      f,
      'metal',
      [
        [0.65 + Math.cos(t) * r, 0.85 + Math.sin(t) * r, 0],
        [0.65 + Math.cos(u) * r, 0.85 + Math.sin(u) * r, 0],
        [0.65 + Math.cos(u) * r, 0.85 + Math.sin(u) * r, -1.8],
        [0.65 + Math.cos(t) * r, 0.85 + Math.sin(t) * r, -1.8],
      ],
      [0.23, 0.2, 0.17],
    );
  }
  if (fine(o))
    for (let k = 0; k < 3; k++)
      line(f, [0.28 + k * 0.35, 0.15, 0.06], [0.28 + k * 0.35, 0.72, 0.06], 0.04, 'wood', wood);
}
function chimney(o, x, z, y, ornate = false) {
  if (!near(o)) return;
  const f = frame(o, x, y, z);
  box(f, 'plaster', [-0.55, 0, -0.42], [0.55, 1.5, 0.42], plaster);
  box(f, 'carved', [-0.68, 1.45, -0.55], [0.68, 1.64, 0.55], trim);
  if (ornate && fine(o))
    for (let s = -1; s <= 1; s++) {
      cylinder(f, s * 0.32, 0, 0.105, 1.6, 2, 'metal', [0.18, 0.17, 0.16], 8);
    }
  else box(f, 'metal', [-0.4, 1.64, -0.26], [0.4, 1.8, 0.26], [0.18, 0.17, 0.16]);
}
function tower(o, x, z, r, body, top) {
  const p = Array.from({ length: 8 }, (_, i) => [
    x + r * Math.cos((i * Math.PI) / 4 + Math.PI / 8),
    z + r * Math.sin((i * Math.PI) / 4 + Math.PI / 8),
  ]);
  facade(o, p, baseY + (x < 0 ? 4 : 0), baseY + body, { floors: body > 18 ? 5 : 3, spacing: 2.8 });
  if (near(o))
    for (const h of [body * 0.45, body * 0.73, body - 0.3]) band(o, p, baseY + h, 0.25, 1.025);
  const y = baseY + body,
    roofH = top - body;
  const profile =
    o.detail === 'skyline'
      ? [
          [0, 1.12],
          [0.38, 0.6],
          [0.65, 0.42],
          [0.8, 0.38],
          [1, 0.015],
        ]
      : [
          [0, 1.13],
          [0.045, 1.15],
          [0.1, 0.98],
          [0.2, 0.85],
          [0.33, 0.65],
          [0.42, 0.56],
          [0.47, 0.61],
          [0.53, 0.4],
          [0.7, 0.4],
          [0.74, 0.48],
          [0.81, 0.38],
          [0.9, 0.18],
          [1, 0.01],
        ];
  const sides = master(o) ? 40 : fine(o) ? 24 : o.detail === 'street' ? 16 : 8;
  const rings = profile.map(([h, scale]) =>
    radialRing(y + h * roofH, r * scale, r * scale, sides, [x, z]),
  );
  loft(o, 'metal', rings, [0.19, 0.16, 0.13]);
  if (near(o)) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        ff = frame(
          o,
          x + Math.sin(a) * r * 0.401,
          y + roofH * 0.57,
          z + Math.cos(a) * r * 0.401,
          a,
        );
      face(
        ff,
        'recess',
        [
          [-0.18, 0, 0.015],
          [0.18, 0, 0.015],
          [0.18, roofH * 0.11, 0.015],
          [-0.18, roofH * 0.11, 0.015],
        ],
        [0.04, 0.045, 0.04],
      );
    }
    cylinder(o, x, z, 0.055, baseY + top, baseY + top + 0.9, 'bronze', [0.67, 0.52, 0.2], 8);
    if (fine(o)) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        for (let k = 1; k < profile.length; k++) {
          const b = profile[k - 1],
            c = profile[k];
          beam(
            o,
            'metal',
            [x + Math.cos(a) * r * b[1], y + b[0] * roofH, z + Math.sin(a) * r * b[1]],
            [x + Math.cos(a) * r * c[1], y + c[0] * roofH, z + Math.sin(a) * r * c[1]],
            0.04,
            0.04,
            [0.35, 0.29, 0.22],
          );
        }
      }
    }
  }
}
function rampart(o, id) {
  const path = points(id),
    out = [],
    crest = [],
    inner = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      p = path[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = -(b[1] - a[1]) / len,
      nz = (b[0] - a[0]) / len;
    if (nx * p[0] + nz * p[1] < 0) {
      nx = -nx;
      nz = -nz;
    }
    out.push([p[0] + nx * 14, 0, p[1] + nz * 14]);
    crest.push([p[0], 8, p[1]]);
    inner.push([p[0] - nx * 7, baseY, p[1] - nz * 7]);
  }
  for (let i = 1; i < path.length; i++)
    for (const pair of [
      [out, crest],
      [crest, inner],
    ]) {
      const q = [pair[0][i - 1], pair[0][i], pair[1][i], pair[1][i - 1]];
      for (const ids of [
        [0, 1, 2],
        [2, 3, 0],
      ]) {
        const t = ids.map((j) => q[j]);
        if (normalFor(...t)[1] < 0) t.reverse();
        tri(o, 'foliage', t, [0.3, 0.4, 0.17]);
      }
    }
  for (const i of [0, path.length - 1]) {
    const q = [out[i], crest[i], inner[i]];
    if (i === 0) q.reverse();
    tri(o, 'foliage', q, [0.26, 0.34, 0.15]);
  }
}
function bridge(o) {
  const path = points(112500238),
    a = path[0],
    b = path.at(-1),
    f = edgeFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = 3,
    width = len / count;
  // Continuous deck on three true arch openings, with piers and underside vaults.
  for (const sign of [-1, 1]) {
    const g = frame(f, sign < 0 ? len : 0, 0, sign * 2.75, sign < 0 ? Math.PI : 0);
    panel(
      g,
      len,
      0,
      baseY - 0.25,
      Array.from({ length: count }, (_, k) => [
        (k + 0.5) * width,
        0.05,
        width * 0.8,
        3.35,
        true,
        true,
      ]),
      'plaster',
      plaster,
    );
    if (near(o)) {
      box(g, 'carved', [0, baseY, -0.15], [len, baseY + 0.18, 0.24], trim);
      box(g, 'metal', [0, baseY + 1, -0.12], [len, baseY + 1.06, 0.08], [0.19, 0.18, 0.16]);
      for (let x = 0.4; x < len; x += fine(o) ? 0.6 : 2)
        box(g, 'metal', [x - 0.03, baseY, -0.07], [x + 0.03, baseY + 1, 0.02], [0.19, 0.18, 0.16]);
    }
  }
  box(f, 'stone', [0, baseY - 0.25, -2.75], [len, baseY, 2.75], stone);
  if (near(o))
    for (let k = 0; k < count; k++) {
      const r = width * 0.4,
        ry = Math.min(r, 3.35 * 0.65),
        cy = 3.4 - ry;
      for (let j = 0, n = fine(o) ? 24 : 10; j < n; j++) {
        const a = (j * Math.PI) / n,
          b = ((j + 1) * Math.PI) / n;
        face(
          f,
          'carved',
          [
            [width * (k + 0.5) + r * Math.cos(a), cy + ry * Math.sin(a), -2.75],
            [width * (k + 0.5) + r * Math.cos(b), cy + ry * Math.sin(b), -2.75],
            [width * (k + 0.5) + r * Math.cos(b), cy + ry * Math.sin(b), 2.75],
            [width * (k + 0.5) + r * Math.cos(a), cy + ry * Math.sin(a), 2.75],
          ],
          trim,
        );
      }
    }
}
function gatefront(o) {
  if (!near(o)) return;
  const f = frame(o, -85.02, baseY, 0.75, -Math.PI / 2 + 0.05);
  panel(frame(f, -4.2), 8.4, 0, 6.4, [[4.2, 0, 3.3, 3.9, true, true]]);
  for (const x of [-3.6, -2.4, 2.4, 3.6]) {
    box(f, 'carved', [x - 0.19, 0, -0.18], [x + 0.19, 5.8, 0.24], trim);
    box(f, 'carved', [x - 0.35, 0.1, -0.22], [x + 0.35, 0.45, 0.3], trim);
    box(f, 'carved', [x - 0.31, 5.5, -0.22], [x + 0.31, 5.85, 0.32], trim);
  }
  for (const y of [4.7, 6.05]) box(f, 'carved', [-4.55, y, -0.2], [4.55, y + 0.22, 0.3], trim);
  shapeFace(
    f,
    [
      [-4.5, 6.28],
      [4.5, 6.28],
      [0, 8.25],
    ],
    0.08,
    'plaster',
    plaster,
  );
  line(f, [-4.5, 6.3, 0.15], [0, 8.3, 0.15], 0.22);
  line(f, [0, 8.3, 0.15], [4.5, 6.3, 0.15], 0.22);
  if (fine(o)) {
    shapeFace(
      f,
      [
        [-0.65, 5.1],
        [-0.7, 5.75],
        [0, 6.05],
        [0.7, 5.75],
        [0.65, 5.1],
        [0, 4.85],
      ],
      0.31,
      'carved',
      trim,
    );
    for (const x of [-3.3, 3.3])
      shapeFace(
        frame(f, x, 4.95, 0.3),
        [
          [-0.5, 0],
          [0.5, 0],
          [0.34, 0.62],
          [-0.34, 0.62],
        ],
        0.1,
        'metal',
        [0.23, 0.23, 0.2],
      );
  }
}
function palaceFront(o) {
  if (!near(o)) return;
  const f = frame(o, 20.64, baseY, -2.55, -Math.PI / 2 + 0.019);
  // Central risalit: three bays, balcony, paired pilasters and sculptural pediment.
  for (const x of [-3.1, -1.65, 1.65, 3.1]) {
    box(f, 'carved', [x - 0.13, 5, -0.2], [x + 0.13, 13.95, 0.16], trim);
    if (fine(o))
      for (const y of [5, 9.45, 13.7])
        box(f, 'carved', [x - 0.23, y, -0.22], [x + 0.23, y + 0.16, 0.25], trim);
  }
  for (const y of [9.5, 14]) box(f, 'carved', [-4.55, y, -0.2], [4.55, y + 0.24, 0.35], trim);
  shapeFace(
    f,
    [
      [-4.65, 14],
      [4.65, 14],
      [0, 17.15],
    ],
    0.1,
    'plaster',
    plaster,
  );
  line(f, [-4.65, 14.1, 0.2], [0, 17.22, 0.2], 0.25);
  line(f, [0, 17.22, 0.2], [4.65, 14.1, 0.2], 0.25);
  const terrace = frame(o, 16.81, baseY, -2.55, -Math.PI / 2 + 0.038);
  box(terrace, 'carved', [-8.3, 4.85, -0.12], [8.3, 5.12, 0.3], trim);
  box(terrace, 'metal', [-8.3, 6.1, 0.24], [8.3, 6.17, 0.31], [0.21, 0.2, 0.17]);
  for (let x = -8.2; x <= 8.2; x += fine(o) ? 0.32 : 1.3)
    box(terrace, 'metal', [x - 0.03, 5.1, 0.24], [x + 0.03, 6.1, 0.31], [0.21, 0.2, 0.17]);
  if (fine(o)) {
    shapeFace(
      f,
      [
        [-0.9, 14.6],
        [-1, 15.7],
        [0, 16.25],
        [1, 15.7],
        [0.9, 14.6],
        [0, 14.3],
      ],
      0.4,
      'carved',
      trim,
    );
    // Shield and crown are original geometric ornaments, not a claimed copy of the heraldic sculpture.
    shapeFace(
      f,
      [
        [-0.47, 14.95],
        [-0.47, 15.72],
        [0.47, 15.72],
        [0.47, 14.95],
        [0, 14.7],
      ],
      0.45,
      'bronze',
      [0.55, 0.4, 0.19],
    );
  }
}
function otherStructures(o) {
  const p = ring(275688059);
  facade(o, p, baseY, baseY + 4, { floors: 1, spacing: 4 });
  gabled(o, p, baseY + 4, 3, [1, -0.018], true);
  if (o.detail === 'skyline') return;
  const shed = ring(864300157);
  facade(o, shed, baseY, baseY + 3, { floors: 1, spacing: 4 });
  gabled(o, shed, baseY + 3, 1, [0, 1]);
  if (near(o)) {
    for (const id of [1117432401, 1117432402]) {
      const p = ring(id);
      solid(o, p, baseY, baseY + 10);
      loft(
        o,
        'tile',
        [
          [...p].reverse().map((v) => [v[0], baseY + 10, v[1]]),
          scaled(p, 0.02)
            .reverse()
            .map((v) => [v[0], baseY + 11, v[1]]),
        ],
        tile,
      );
    }
    const deck = ring(1117434966);
    solid(o, deck, baseY + 3.85, baseY + 4.2, 'carved', trim);
    const pergola = ring(1118413377),
      c = center(pergola);
    cap(o, scaled(pergola, 1.3), baseY + 0.05, 'stone', stone);
    for (const [x, z] of pergola) cylinder(o, x, z, 0.16, baseY, baseY + 2, 'carved', trim, 8);
    const pp = ring(864300155);
    loft(
      o,
      'metal',
      [
        [...pp].reverse().map((v) => [v[0], baseY + 2, v[1]]),
        [...pp]
          .reverse()
          .map((v) => [c[0] + (v[0] - c[0]) * 0.01, baseY + 3, c[1] + (v[1] - c[1]) * 0.01]),
      ],
      [0.27, 0.2, 0.16],
    );
  }
}
export function buildNesvizhRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  const court = ring(128279266);
  const floor = map.enclosureOutline.slice(0, -1);
  cap(o, floor, 0, 'foliage', [0.28, 0.37, 0.17]);
  for (const p of [
    [
      [-92.6071, -60.3102],
      [-56.4192, -63.0556],
      [-55.8946, -51.7364],
      [-78.4396, -30.7318],
      [-92.1999, -37.755],
    ],
    [
      [42.65, -52.9738],
      [60.0627, -65.3725],
      [82.2786, -66.4223],
      [87.2046, -59.6041],
      [82.7002, -35.5396],
      [70.3567, -33.066],
    ],
    [
      [-86.1224, 43.7104],
      [-88.8785, 65.6503],
      [-85.9467, 67.7986],
      [-61.3829, 66.1561],
      [-57.0308, 57.125],
      [-76.5878, 43.2804],
    ],
    [
      [45.2368, 56.2653],
      [53.3503, 71.4328],
      [80.0982, 72.5979],
      [88.7431, 67.5189],
      [88.9884, 43.302],
      [62, 44],
    ],
  ])
    cap(o, p, 8, 'foliage', [0.3, 0.4, 0.17]);
  const grounds = [
    [-80, -39],
    [-63, -47],
    [43, -50],
    [90, -34],
    [93, 43],
    [48, 61],
    [-58, 63],
    [-86, 41],
  ];
  solid(o, grounds, 0, baseY - 0.08, 'foliage', [0.3, 0.38, 0.18]);
  cap(o, court, baseY, 'stone', [0.6, 0.59, 0.52]);
  rampart(o, 864300139);
  rampart(o, 864300140);
  for (const part of parts) {
    if ([1117432401, 1117432402, 1117416422, 1119457665, 1120250680].includes(part.id)) continue;
    const p = part.p,
      c = center(p),
      y = baseY + part.hi - part.rise,
      lo = baseY + part.lo;
    if ([1117421828, 1117421829].includes(part.id)) {
      facade(o, p, baseY, y, { id: part.id, floors: 2, spacing: 2.8 });
      corridorRoof(
        o,
        part.id === 1117421828
          ? [
              [-56.8, -4],
              [-56.9, -28.5],
              [-55.5, -31.9],
              [-33.2, -34.5],
            ]
          : [
              [-56.4, 3.4],
              [-55.6, 33.8],
              [-53.4, 38.7],
              [-34, 35.9],
            ],
        7.3,
        y,
        2,
      );
      continue;
    }
    const floors = part.lo >= 4 ? 1 : part.hi >= 13 ? 3 : 1;
    if (part.id === 1116945517) {
      edges(o, p, (f, len) =>
        panel(
          f,
          len,
          lo,
          y,
          Array.from({ length: Math.max(1, Math.floor(len / 3.2)) }, (_, k) => {
            const n = Math.max(1, Math.floor(len / 3.2));
            return [((k + 0.5) * len) / n, lo + 0.3, Math.min(1.7, (len / n) * 0.58), 3.6, true];
          }),
        ),
      );
      cap(o, p, y, 'carved', trim);
      continue;
    }
    facade(o, p, lo, y, {
      id: part.id,
      floors,
      spacing: part.id === 1119457664 ? 2.7 : part.hi >= 13 ? 3.65 : 3.1,
    });
    if (part.shape === 'flat' || !part.rise) cap(o, p, y, 'carved', trim);
    else {
      let axis = [1, -0.075];
      if (c[0] > 10 && Math.abs(c[1]) > 12) axis = c[1] < 0 ? [0.79, 0.61] : [0.74, -0.68];
      if (part.id === 1116945516) axis = [0.02, -1];
      if ([1119457664, 1116945515].includes(part.id)) axis = [1, 0.019];
      if (part.shape === 'skillion') axis = [1, 0];
      gabled(o, p, y, part.rise, axis, [1119457664, 1116945515, 1116945516].includes(part.id));
    }
  }
  for (const id of [1117243506, 1117243507]) solid(o, ring(id), baseY, baseY + 4);
  // The gate passage remains open through the whole wing; no courtyard-filling enclosure mesh.
  tower(o, 9.8, 30.3, 4.12, 20, 33);
  tower(o, -56.5, -0.2, 4.12, 15, 26);
  otherStructures(o);
  bridge(o);
  gatefront(o);
  palaceFront(o);
  if (near(o)) {
    for (const z of [-28.5, 27.4])
      for (const x of [-28, -18, -8, 1]) dormer(o, x, baseY + 10.85, z, z < 0 ? 0 : Math.PI);
    for (const z of [-35, 35]) for (const x of [-29, -17, -4]) chimney(o, x, z, baseY + 13, true);
    for (const z of [-22, -12, 12, 24]) dormer(o, -54, baseY + 7.6, z, Math.PI / 2);
    for (const x of [-77, -69, -62]) {
      chimney(o, x, 0.5, baseY + 9, true);
      if (fine(o))
        cylinder(o, x, 0.5, 0.43, baseY + 10.4, baseY + 13, 'metal', [0.18, 0.16, 0.15], 12);
    }
    // Original coursed paving details are confined to the master; shared granite supplies distant grain.
    if (master(o))
      for (let x = -51; x < 14; x += 1.6)
        for (let z = -24; z < 23; z += 1.2) {
          const r = [
            [x, z],
            [x + 1.5, z],
            [x + 1.5, z + 1.1],
            [x, z + 1.1],
          ];
          if (r.every((v) => inside(v, court)))
            cap(
              o,
              r,
              baseY + 0.012,
              'stone',
              color(stone, 0.92 + (((Math.round(x * 5 + z * 7) % 9) + 9) % 9) * 0.02),
            );
        }
  }
}
export const buildNesvizhSkyline = (o) => buildNesvizhRuntime(o, 'skyline');
export const nesvizhStudy = {
  id: 'N0254',
  key: 'nesvizh_castle',
  title: 'Nesvizh Castle',
  category: 'castle',
  wikidataId: 'Q719422',
  mapFrame: 'map-frame.json',
  build: (o) => buildNesvizhRuntime(o),
  brief:
    'Restored ochre palace around its open irregular six-sided courtyard, distinct gate and palace towers with swept metal crowns, red tiled roofs, curved western galleries, ceremonial gate passage, stone arch bridge and grass bastions.',
  sourceFacts: {
    identity:
      'Q719422 grounds relation/14560856; palace building relation/1732915 with inner court way/128279266.',
    mappedEnvelopeMeters: [230.213, 188.624],
    mappedFeatures: 148,
    roofTipHeightAbovePalaceDatumMeters: 33,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'OSM building parts, roof heights and min-height tags plus current museum courtyard photograph and UNDP 2021 exterior photograph.',
    state: 'Restored palace exterior; historical engraving informs context only.',
    verticalDatum:
      'Provisional palace/court datum Y=4 above moat-side ground; mapped 33 m palace tower tip gives Y=37, finial Y=37.9. Earth-bank crests Y=8 are estimates.',
  },
  scaleBasis:
    'Meter-scale map parts. Individual roof sections preserve mapped floor/roof heights. Facade rhythms, ornamental profiles and terrain levels remain an original visual reconstruction.',
  refs: [
    'https://niasvizh.by/en/posetitelyam/dvortsovyy-ansambl/',
    'https://niasvizh.by/en/history/dvortsovyy_kompleks/',
    'https://niasvizh.by/upload/bg/dvorec_ekskyrsii_o_myzee.jpg',
    'https://www.undp.org/belarus/news/sustainable-mobility-helps-tourism-spearhead-green-economy-belarus-regions',
    'https://whc.unesco.org/en/list/1196/',
    'https://www.openstreetmap.org/relation/14560856',
    'https://www.openstreetmap.org/relation/1732915',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Reference photographs were inspected; no third-party photographs or meshes are embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X 27.188 degrees south of east',
    front: 'West gate and approach bridge toward native -X; +Z south-southwest',
    origin: 'Mapped grounds anchor with provisional moat-side ground datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft pending terrain heights, roof fit and directional placement review',
    notes:
      'Castle grounds include open courtyard and earth banks. Never extrude or replace the whole grounds envelope as one building.',
  }),
  geographicNote:
    'Horizontal location derives from exact identity; terrain and vertical fit are pending.',
  limitations: [
    'Maximum exterior fidelity remains pending: individual pilasters, clock faces, heraldic and figurative sculpture, exact window rhythms, dormers and roof junctions require more reference work.',
    'Ground datum, rampart slopes, bridge arches and terrace levels are inferred rather than surveyed; in-world terrain fit has not passed. Water and park trees belong to the host terrain layers.',
    'Some roof geometry and facade profiles are reconstructed; curved gallery roofs and stacked tower profiles need further photographic refinement. Palace interiors, wider park and the separate Corpus Christi Church are outside this exterior asset.',
    'Detailed source retains tiled roof courses and window reveals. Four separate runtime tiers share plaster, ceramic tile, stone, wood and metal; no embedded images. Physical device approval is pending.',
  ],
  camera: { position: [-196, 154, 163], lookAt: [0, 12, 0], fov: 43 },
  qaCameras: [
    { name: 'mapped-six-sided-courtyard', position: [0, 320, 0.2], lookAt: [0, 0, 0] },
    { name: 'west-gate-and-arch-bridge', position: [-146, 19, 24], lookAt: [-72, 13, 0] },
    { name: 'gate-tower-crown', position: [-81, 33, 34], lookAt: [-56, 22, 0] },
    { name: 'palace-central-risalit', position: [-24, 15, -2], lookAt: [23, 13, -2] },
    { name: 'southern-wing-and-tower', position: [-20, 37, 89], lookAt: [0, 18, 29] },
    { name: 'palace-tower-crown', position: [34, 43, 57], lookAt: [10, 30, 30] },
    { name: 'northern-court-gallery', position: [-12, 20, 10], lookAt: [-16, 12, -31] },
    { name: 'eastern-palace-and-service-wing', position: [128, 40, -2], lookAt: [41, 14, 0] },
    { name: 'earth-bastions-and-moat-edge', position: [-136, 23, -118], lookAt: [-55, 8, -36] },
  ],
};
