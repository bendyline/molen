/** Whole surviving Boggo Road Gaol compound, seven mapped buildings/roof and original brick perimeter. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { profile } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/r7/r7h/boggo_road_gaol/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('b77752'),
    stone: rgb('c5b99d'),
    roof: rgb('b9c4bf'),
    paint: rgb('d1d7cb'),
    concrete: rgb('b5b8ae'),
    dark: rgb('3e4d45'),
    glass: rgb('63776e'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.98, metallic: 0 },
    stone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.18 },
    paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.91, metallic: 0.03 },
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    dark: { slot: 'window', localRef: ref, roughness: 0.8, metallic: 0 },
    glass: { slot: 'window', localRef: ref, roughness: 0.8, metallic: 0 },
  };
function tri(o, s, p, n) {
  // A roof rim ending at its eave has a triangular last patch, not two faces.
  // Drop only faces that collapse in the actual exported Float32 representation.
  p = p.map((row) => row.map(Math.fround));
  const a = p[1].map((v, i) => v - p[0][i]),
    b = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
    1e-10
  )
    return;
  if (n && normalFor(...p).reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  const nn = normalFor(...p);
  o.addTriangle(
    s,
    ref,
    p,
    nn,
    p.map((q) => [q[0] + q[2], q[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const area = (r) =>
    r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - p[1] * r[(i + 1) % r.length][0], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
function frame(a, b, outward = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1] * outward, 0, u[0] * outward];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, r, holes, f, z = 0, back = false) {
  const all = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((v, q) => v + q.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n.map((v) => (back ? -v : v)),
    );
}
function extrusion(o, s, r, holes, f, front, back) {
  panel(o, s, r, holes, f, front);
  panel(o, s, r, holes, f, back, true);
  for (const [k, ring] of [r, ...holes].entries()) {
    const sg = (area(ring) > 0 ? 1 : -1) * (k ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      Q(
        o,
        k ? 'stone' : s,
        [f.P(...a, front), f.P(...a, back), f.P(...b, back), f.P(...b, front)],
        [f.u[0] * (b[1] - a[1]) * sg, (a[0] - b[0]) * sg, f.u[1] * (b[1] - a[1]) * sg],
      );
    }
  }
}
const block = (o, s, f, x, y, w, h, front, back) =>
    extrusion(o, s, rect(x, y, w, h), [], f, front, back),
  strip = (o, s, f, x, y, w, h, z = 0) => panel(o, s, rect(x, y, w, h), [], f, z);
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, lo, hi) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    strip(o, s, f, f.len / 2, lo, f.len, hi - lo);
  }
  cap(o, s, r, lo, false);
  cap(o, s, r, hi);
}
function arch(x, y, w, h, n) {
  const rad = w / 2,
    base = y + h - rad;
  return [
    [x - rad, y],
    [x + rad, y],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + rad * Math.cos((i / n) * Math.PI),
      base + rad * Math.sin((i / n) * Math.PI),
    ]),
  ];
}
function reveal(o, s, f, r, front, back) {
  panel(o, s, r, [], f, back);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, 'stone', [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)]);
  }
}
function bar(o, s, f, x, y, w, h, z, d) {
  if (d > 2) block(o, s, f, x, y, w, h, z + 0.025, z - 0.025);
  else {
    const r = rect(x, y, w, h);
    panel(o, s, r, [], f, z);
    panel(o, s, r, [], f, z, true);
  }
}
function light(o, f, h, d) {
  const r = h.arch ? arch(h.x, h.y, h.w, h.h, d > 2 ? 16 : 8) : rect(h.x, h.y, h.w, h.h);
  if (!d) return;
  if (d === 1) {
    panel(o, h.glass ? 'glass' : 'dark', r, [], f, 0.014);
    return;
  }
  reveal(o, h.glass ? 'glass' : 'dark', f, r, 0, -0.32);
  for (const sg of [-1, 0, 1]) {
    const xx = h.x + sg * h.w * 0.28,
      top = h.arch
        ? h.y + h.h - h.w / 2 + Math.sqrt(Math.max(0, (h.w / 2) ** 2 - (xx - h.x) ** 2))
        : h.y + h.h;
    bar(o, 'paint', f, xx, h.y, 0.035, top - h.y, -0.095, d);
  }
  bar(o, 'paint', f, h.x, h.y + h.h * 0.48, h.w, 0.035, -0.09, d);
  if (h.arch) {
    const rr = arch(h.x, h.y, h.w + 0.4, h.h + 0.2, d > 2 ? 16 : 8),
      inner = arch(h.x, h.y, h.w, h.h, d > 2 ? 16 : 8);
    panel(o, 'stone', rr, [inner], f, 0.04);
  } else {
    strip(o, 'stone', f, h.x, h.y - 0.1, h.w + 0.25, 0.15, 0.06);
    strip(o, 'stone', f, h.x, h.y + h.h, h.w + 0.25, 0.18, 0.035);
  }
}
function clip(r, n, c, less = true) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      va = a[0] * n[0] + a[1] * n[1] - c,
      vb = b[0] * n[0] + b[1] * n[1] - c,
      ia = less ? va <= 0 : va >= 0,
      ib = less ? vb <= 0 : vb >= 0;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = va / (va - vb);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out;
}
function roofBasis(r) {
  let a = r[0],
    b = r[1],
    len = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > len) {
      a = p;
      b = q;
      len = l;
    }
  }
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    v = [-u[1], u[0]],
    proj = (p) => p[0] * v[0] + p[1] * v[1],
    lo = Math.min(...r.map(proj)),
    hi = Math.max(...r.map(proj)),
    mid = (lo + hi) / 2;
  return { u, v, proj, mid, lo, hi };
}
function roof(o, r, eave, ridge, b, d, closedWalls = true) {
  const top = (p) =>
    eave + (ridge - eave) * (1 - (Math.abs(b.proj(p) - b.mid) / (b.hi - b.lo)) * 2);
  for (const side of [true, false]) {
    const q = clip(r, b.v, b.mid, side),
      ix = earcut(q.flat());
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        'roof',
        ix.slice(i, i + 3).map((k) => [q[k][0], top(q[k]), q[k][1]]),
        [0, 1, 0],
      );
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      z = r[(i + 1) % r.length],
      pts = [a];
    if ((b.proj(a) - b.mid) * (b.proj(z) - b.mid) < 0) {
      const t = (b.mid - b.proj(a)) / (b.proj(z) - b.proj(a));
      pts.push(a.map((v, k) => v + t * (z[k] - v)));
    }
    pts.push(z);
    for (let j = 0; j < pts.length - 1; j++) {
      const p = pts[j],
        q = pts[j + 1];
      if (closedWalls && Math.max(top(p), top(q)) > eave + 0.01)
        Q(o, 'brick', [
          [p[0], eave, p[1]],
          [q[0], eave, q[1]],
          [q[0], top(q), q[1]],
          [p[0], top(p), p[1]],
        ]);
      if (d > 1)
        beam(
          o,
          'paint',
          [p[0], top(p) + 0.02, p[1]],
          [q[0], top(q) + 0.02, q[1]],
          0.12,
          0.13,
          C.paint,
        );
    }
  }
  return top;
}
function band(o, f, y, width, holes, d) {
  if (!d) return;
  const gaps = holes
    .filter((h) => y >= h.y - 0.16 && y <= h.y + h.h + 0.1)
    .map((h) => [h.x - h.w / 2 - 0.04, h.x + h.w / 2 + 0.04])
    .sort((a, b) => a[0] - b[0]);
  let start = 0;
  for (const [a, b] of [...gaps, [width, width]]) {
    if (a > start) strip(o, 'stone', f, (start + a) / 2, y, a - start, 0.2, 0.026);
    start = Math.max(start, b);
  }
}
function building(o, w, d) {
  const r = cw(w.outline),
    cell = w.role === 'surviving-three-storey-cellblock',
    north = w.id === 1563719294,
    storeys = Number(w.tags['building:levels'] ?? w.tags.levels ?? 1),
    eave = cell ? 9.7 : storeys === 2 ? 7 : 4.1,
    ridge = cell ? 12.5 : storeys === 2 ? 9.2 : 6.1,
    b = roofBasis(r),
    wall = north ? 'concrete' : 'brick';
  prism(o, 'stone', r, -0.18, 0.2);
  if (!d) prism(o, wall, r, 0.2, eave);
  else
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        z = r[(i + 1) % r.length],
        f = frame(a, z),
        gable = cell && Math.abs(f.u[0] * b.u[0] + f.u[1] * b.u[1]) < 0.25,
        peak = (f.len * (b.mid - b.proj(a))) / (b.proj(z) - b.proj(a)),
        outer = gable
          ? [
              [0, 0.2],
              [f.len, 0.2],
              [f.len, eave],
              [peak, ridge],
              [0, eave],
            ]
          : rect(f.len / 2, 0.2, f.len, eave - 0.2),
        hs = [];
      if (gable) {
        for (const xx of [f.len * 0.24, f.len * 0.76])
          for (const y of [0.85, 3.7]) hs.push({ x: xx, y, w: 0.6, h: 1.15 });
        hs.push({ x: f.len / 2, y: 6.4, w: 1.8, h: 3.95, arch: true, glass: true });
      } else if (f.len > 3) {
        const count = Math.max(1, Math.round(f.len / (cell ? 2.55 : 3.6)));
        for (let j = 0; j < count; j++)
          for (let floor = 0; floor < storeys; floor++)
            hs.push({
              x: ((j + 0.5) / count) * f.len,
              y: 0.85 + floor * (cell ? 2.9 : 3.1),
              w: cell ? 0.62 : 0.9,
              h: cell ? 1.15 : 1.55,
              glass: !cell,
            });
      }
      panel(
        o,
        wall,
        outer,
        d > 1
          ? hs.map((h) =>
              h.arch ? arch(h.x, h.y, h.w, h.h, d > 2 ? 16 : 8) : rect(h.x, h.y, h.w, h.h),
            )
          : [],
        f,
      );
      for (const h of hs) light(o, f, h, d);
      for (const y of cell ? [0.45, 6.0, 8.0] : [0.45, eave - 0.45]) band(o, f, y, f.len, hs, d);
      if (f.len > 4)
        for (const x of [0.18, f.len - 0.18]) {
          if (d > 1) block(o, wall, f, x, 0.3, 0.32, eave - 0.3, 0.09, -0.02);
          else strip(o, wall, f, x, 0.3, 0.32, eave - 0.3, 0.04);
        }
    }
  roof(o, r, eave, ridge, b, d, !cell || !d);
  if (!cell && !north) {
    const center = [0, 1].map((k) => r.reduce((s, p) => s + p[k], 0) / r.length);
    for (const sg of [-1, 1]) {
      const x = center[0] + b.u[0] * sg * 4,
        z = center[1] + b.u[1] * sg * 4,
        rr = [
          [x - 0.32, z - 0.32],
          [x + 0.32, z - 0.32],
          [x + 0.32, z + 0.32],
          [x - 0.32, z + 0.32],
        ],
        lo = eave + 0.5;
      prism(o, 'brick', rr, lo, ridge + (d ? 1.35 : 1.55));
      if (d)
        prism(
          o,
          'stone',
          rr.map(([a, b]) => [x + (a - x) * 1.3, z + (b - z) * 1.3]),
          ridge + 1.35,
          ridge + 1.55,
        );
    }
  }
}
function wall(o, d) {
  const r = plan.wallRing,
    sg = area(r) > 0 ? -1 : 1;
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length], sg),
      holes = [];
    if (i === 3) holes.push({ x: f.len / 2, y: 0.03, w: 0.75, h: 2.3, door: true });
    if (i === 11) holes.push({ x: f.len * 0.42, y: 0.03, w: 3.2, h: 4.3, gate: true });
    extrusion(
      o,
      'brick',
      rect(f.len / 2, -0.2, f.len, 6.2),
      holes.map((h) => rect(h.x, h.y, h.w, h.h)),
      f,
      0.375,
      -0.375,
    );
    for (const h of holes) {
      panel(o, h.door ? 'glass' : 'dark', rect(h.x, h.y, h.w, h.h), [], f, h.door ? 0.16 : -0.2);
      if (d && h.gate) {
        for (let j = 0; j < 11; j++)
          bar(o, 'paint', f, h.x - h.w / 2 + ((j + 0.5) * h.w) / 11, h.y, 0.045, h.h, 0.05, d);
        bar(o, 'paint', f, h.x, h.y + 2.2, h.w, 0.06, 0.05, d);
      }
      if (d) {
        strip(o, 'stone', f, h.x, h.y + h.h, h.w + 0.3, 0.18, 0.42);
      }
    }
    if (d) {
      block(o, 'stone', f, f.len / 2, 5.88, f.len, 0.18, 0.47, -0.47);
      if (f.len > 5) {
        const n = Math.max(1, Math.round(f.len / 2.8));
        for (let j = 0; j < n; j++) {
          const x = ((j + 0.5) / n) * f.len;
          if (holes.some((h) => Math.abs(x - h.x) < h.w / 2 + 0.25)) continue;
          block(o, 'brick', f, x, 2.45, 0.3, 3.45, 0.49, 0.375);
        }
      }
    }
    // Only the two photographed adjacent wall runs and rounded SWcorner carry the outside gallery.
    let x0 = 0,
      x1 = 0;
    if (i === 0) {
      x0 = Math.max(0, f.len - 32);
      x1 = f.len;
    } else if (i > 0 && i < 5) x1 = f.len;
    else if (i === 5) x1 = Math.min(36, f.len);
    if (x1 > x0) {
      block(o, 'paint', f, (x0 + x1) / 2, 6.12, x1 - x0, 0.16, 1.9, 0.22);
      block(o, 'roof', f, (x0 + x1) / 2, 8.05, x1 - x0, 0.085, 2.0, 0.18);
      if (d) {
        const n = Math.max(1, Math.round((x1 - x0) / 4.2));
        for (let j = 0; j <= n; j++) {
          const x = x0 + (j / n) * (x1 - x0);
          beam(o, 'paint', f.P(x, 6.25, 1.75), f.P(x, 8.08, 1.75), 0.055, 0.055, C.paint);
          beam(o, 'paint', f.P(x, 5.0, 0.5), f.P(x, 6.12, 1.8), 0.09, 0.09, C.paint);
          if (d > 1) beam(o, 'paint', f.P(x, 6.25, 0.45), f.P(x, 6.25, 1.8), 0.09, 0.09, C.paint);
        }
        for (const y of [6.85, 7.2])
          beam(o, 'paint', f.P(x0, y, 1.75), f.P(x1, y, 1.75), 0.055, 0.055, C.paint);
      }
    }
  }
}
function watchBooth(o, d) {
  const c = plan.guardTowerCenter,
    n = d ? 8 : 6,
    r = Array.from({ length: n }, (_, i) => [
      c[0] + 1.6 * Math.cos((i / n) * Math.PI * 2),
      c[1] + 1.6 * Math.sin((i / n) * Math.PI * 2),
    ]);
  prism(o, 'paint', r, 6.18, 7.0);
  cap(o, 'paint', r, 8.28, false);
  for (let i = 0; i < n; i++) {
    const rr = cw(r),
      f = frame(rr[i], rr[(i + 1) % n]),
      h = { x: f.len / 2, y: 7.05, w: f.len - 0.16, h: 1.05, glass: true };
    panel(o, 'paint', rect(f.len / 2, 7, f.len, 1.28), d > 1 ? [rect(h.x, h.y, h.w, h.h)] : [], f);
    if (d > 1) {
      reveal(o, 'glass', f, rect(h.x, h.y, h.w, h.h), 0, -0.065);
      for (const xx of [h.x - h.w * 0.26, h.x + h.w * 0.26])
        bar(o, 'paint', f, xx, h.y, 0.035, h.h, -0.015, d);
      bar(o, 'paint', f, h.x, h.y + h.h * 0.55, h.w, 0.035, -0.012, d);
    } else if (d) panel(o, 'glass', rect(h.x, h.y, h.w, h.h), [], f, 0.012);
    if (d > 1)
      for (let y = 6.35; y < 6.95; y += 0.14)
        strip(o, 'paint', f, f.len / 2, y, f.len, 0.035, 0.018);
  }
  profile(
    o,
    [
      [8.25, 1.65, 1.65, 'paint', C.paint],
      [8.42, 1.9, 1.9, 'roof', C.roof],
      [9.3, 0.09, 0.09, 'roof', C.roof],
      [9.52, 0.035, 0.035, 'paint', C.paint],
    ],
    n,
    c,
  );
}
function shelter(o, w, d) {
  const r = cw(w.outline);
  for (const [x, z] of r) {
    const q = [
      [x - 0.06, z - 0.06],
      [x + 0.06, z - 0.06],
      [x + 0.06, z + 0.06],
      [x - 0.06, z + 0.06],
    ];
    prism(o, 'paint', q, 0.1, 3.3);
  }
  roof(o, r, 3.3, 3.75, roofBasis(r), d);
  cap(o, 'paint', r, 3.29, false);
}
function build(o, _f, d = 3) {
  for (const b of plan.buildings) {
    if (b.id === 1002265564) shelter(o, b, d);
    else building(o, b, d);
  }
  wall(o, d);
  watchBooth(o, d);
}
export const boggoSkyline = (o, f) => build(o, f, 0);
export const boggoDistrict = (o, f) => build(o, f, 1);
export const boggoStreet = (o, f) => build(o, f, 2);
export const boggoRoadModel = {
  id: 'boggo_road_gaol',
  key: 'boggo_road_gaol',
  recipe: 'structure-boggo-road-gaol.mjs',
  cell: 'r7/r7h',
  title: 'Boggo Road Gaol',
  category: 'historic-prison',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole surviving gaol: all7nativebuilding-roof plans/three3storeycellblocks/auxiliaries/northretainedblock/openroof, actual19vertex6mbrickwall/own gates and SWpaleguardbooth/facetedroof/externalcoveredcantileverwalkway. Recessedbarredlights/buffbands/archedgablegallerywindows/corrugatedpale roofs/brickchimneys. Propertyidentity34ring stays emptyyards/no sitefloor; no demolishedlargeNo1complex/modernneighbors.',
  camera: [120, 64, 132],
  lookAt: [22, 4, 8],
  portableGroundY: -0.3,
  mediumFiContext: { scale: 1.4, groundY: -0.3 },
  qaCameras: [
    {
      name: 'complete-native-three-cellblocks-and-auxiliary-roof-plan',
      position: [110, 72, -72],
      lookAt: [25, 4, 8],
    },
    {
      name: 'southwest-guardbooth-faceted-roof-covered-gallery-and-footdoor',
      position: [81, 10.5, 67],
      lookAt: [62.5, 5.4, 41],
    },
    {
      name: 'three-storey-cellblock-barred-recesses-arched-gallery-gable',
      position: [24, 12, 38],
      lookAt: [43, 7, 24],
    },
    {
      name: 'northern-retained-entry-block-gate-and-two-auxiliaries',
      position: [-43, 19, 42],
      lookAt: [-5, 4, 10],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Original240mfield/rawtiles/grid/PNG frozen beforegeometry; exactfloors/threshold/slopingwallbase/hostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-boggo-road-gaol.mjs',
    level: 'skyline',
    export: 'boggoSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'boggoDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'boggoStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Wholecurrentnamedcompoundarchitecture: all3three-storeycellblocks/2auxiliaryblocks/fullnorthernretained2storeyentry-remnantblock/openpostedshelter andactual19vertexbrickwall/guardbooth/gallery. Property34ring is identityonly, not a courtyard/site slab. No demolishedlargeNo1wings/rebuiltlostprison or modernBoggoRoadVillage/Ecosciences/houses.',
    'ExactQualla2015Shiftchange3264x1717ownCC0photo/nativeSHA1/explicitgrant only; fullreference andnativecompleteplan inspected. Itestablishes redbrickwall/pilasterrhythm/palesuspendedoutergallery/brackets/SWwindowedguardbooth/hiproof, tallcellgable/archedbarredlight/buffband/corrugatedpale roofs/chimneys. Historicalaerials/nullauthor/attribution/interior/unrelatedimages unused; no supplementalphotos/copiedpixels/generatedbitmap. Operator/historicalsocietytextfacts only, theirphotos/maps/drawingsunused.',
    'Native3/2/1storeycensus and fullfootprints retained;6mwall primaryheightcontrol. Allothersectionheights, guardbooth/window/roof sizes/gallerylength, finecellwindow/bar/chimneycensus/hiddenroofpartition/northernblockrole and finish estimated. Northernretainedblock representedwithrestrainedpaleconcretefinish without certifiedgatehouse/visitor/No1cellclassification. Functionalnorthentrygate/closedback andSWfootdoor areboundedestimates; smallcelllights are unglazed recesses with closed shadowbacks, no interiorcells/people/exhibits. Skylinecoarsens smallapertures/galleryposts/cabinpanes; district uses flatglazing/shadow and coarser details; nearlevels add real barredrecesses/archedgallerywindows/gablebands/roofrims/cabincladding.',
    'Independent240m161x161at1.5mfield/2rawtiles/grid/PNG frozen beforegeometry. FixedWNWfrontapproach[30.462559308045734,48.310764444045375], provider36.6026m, relativefield[-9.5241,3.0498] unchanged; no flattening/fitting or addedyardfloor. Modelcommonfloor/wallbase/steps/threshold and actual hostterraincontact unverified; geographicpreview/replaceFootprintfalse. No landscape/roads/temporaryworks/signage.',
  ],
};
