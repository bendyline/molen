/** Bruichladdich: individual native production/visitor roofs, kiln and uphill warehouses. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcg/bruichladdich_distillery/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    wall: rgb('deded4'),
    roof: rgb('596266'),
    paint: rgb('3e9b89'),
    glass: rgb('496169'),
    copper: rgb('d0ad5a'),
    wood: rgb('8b7050'),
  },
  pale = rgb('d6d9d2'),
  steel = rgb('9ba5a2'),
  dark = rgb('414a4d'),
  surfaces = {
    wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
    paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.12 },
    glass: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.32, metallic: 0.04 },
    copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.43, metallic: 0.78 },
    wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  },
  area = (p) =>
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) / 2,
  cw = (p) => (area(p) < 0 ? p : [...p].reverse()),
  bb = (p) => [0, 1].map((i) => [Math.min(...p.map((a) => a[i])), Math.max(...p.map((a) => a[i]))]),
  rect = (a, b, c, d) => [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ];
function tri(o, s, p, n, c = C[s]) {
  p = p.map((a) => a.map(Math.fround));
  const h = cross(
    p[1].map((v, i) => v - p[0][i]),
    p[2].map((v, i) => v - p[0][i]),
  );
  if (Math.hypot(...h) < 1e-8) return;
  if (n && h.reduce((a, v, i) => a + v * n[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    c,
  );
}
function Q(o, s, p, n, c = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, c);
  tri(o, s, [p[0], p[2], p[3]], n, c);
}
function cap(o, s, p, y, up = true, c = C[s]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [p[k][0], typeof y === 'function' ? y(...p[k]) : y, p[k][1]]),
      [0, up ? 1 : -1, 0],
      c,
    );
}
function prism(o, s, p, y0, y1, c = C[s]) {
  p = cw(p);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [-(b[1] - a[1]), 0, b[0] - a[0]],
      c,
    );
  }
  cap(o, s, p, y0, false, c);
  cap(o, s, p, y1, true, c);
}
const B = (o, s, a, b, w = 0.12, h = w, c = C[s]) => beam(o, s, a, b, w, h, c);
function box(o, s, a, b, c = C[s]) {
  prism(o, s, rect(a[0], a[2], b[0], b[2]), a[1], b[1], c);
}
function basis(a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l],
    n = [-u[1], u[0]];
  return { l, n, p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z] };
}
function face(o, s, outer, holes, f, z = 0, c = C[s]) {
  const p = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((n, a) => n + a.length, 0),
    ),
    ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.p(...p[k], z)),
      [f.n[0], 0, f.n[1]],
      c,
    );
}
function window(o, f, x, y, w, h, d, door = false) {
  const q = rect(x - w / 2, y, x + w / 2, y + h),
    depth = d >= 2 ? -0.16 : 0.01;
  face(o, door ? 'paint' : 'glass', q, [], f, depth, door ? C.paint : C.glass);
  if (d === 0) return;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4];
    if (d >= 2)
      Q(o, 'wall', [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)], null, pale);
    if (d === 3) B(o, 'paint', f.p(...a, 0.035), f.p(...b, 0.035), 0.095, 0.085);
    else {
      const ww = 0.06;
      const r =
        i % 2 === 0
          ? rect(x - w / 2 - ww, a[1] - ww, x + w / 2 + ww, a[1] + ww)
          : rect(a[0] - ww, y, a[0] + ww, y + h);
      face(o, 'paint', r, [], f, 0.035);
    }
  }
  if (!door && d >= 2) {
    B(o, 'paint', f.p(x, y, 0.025), f.p(x, y + h, 0.025), 0.055, 0.055);
    B(
      o,
      'paint',
      f.p(x - w / 2, y + h * 0.52, 0.025),
      f.p(x + w / 2, y + h * 0.52, 0.025),
      0.055,
      0.055,
    );
  }
  if (d === 3)
    B(
      o,
      'wall',
      f.p(x - w / 2 - 0.12, y - 0.08, 0.08),
      f.p(x + w / 2 + 0.12, y - 0.08, 0.08),
      0.15,
      0.16,
      pale,
    );
}
function wallBody(o, b, y, h, d) {
  const p = cw(b.outline),
    warehouse = b.tags.building === 'warehouse',
    front = b.id === 'way/366391925';
  cap(o, 'wall', p, y - 1.4, false);
  if (d > 0) cap(o, 'wall', p, y + h, true);
  for (let k = 0; k < p.length; k++) {
    const a = p[k],
      z = p[(k + 1) % p.length],
      f = basis(a, z),
      features = [],
      seaward = f.n[1] > 0.7;
    if (d > 0 && f.l > 4) {
      if (warehouse) {
        if (d >= 2 && f.l < 25 && k % 2 === 0)
          features.push({ x: f.l * 0.5, y: y + 0.08, w: 2.4, h: 3.25, door: true });
      } else {
        const count = Math.max(1, Math.floor(f.l / (front ? 3.9 : 5.8)));
        for (let i = 0; i < count; i++) {
          const x = (f.l * (i + 0.5)) / count;
          if (front || d >= 2 || i % 2 === 0)
            features.push({ x, y: y + 3.7, w: front ? 1.0 : 0.9, h: front ? 1.6 : 1.65 });
          if (+b.tags['building:levels'] === 3) features.push({ x, y: y + 6.65, w: 0.8, h: 1.45 });
          if (d >= 2) {
            const door = seaward && i === 0;
            features.push({
              x,
              y: y + (door ? 0.1 : 0.85),
              w: door ? 1.35 : 0.95,
              h: door ? 2.5 : 1.9,
              door,
            });
          }
        }
      }
    }
    if (d === 0 && front && seaward && f.l > 20)
      for (let i = 0; i < 8; i++)
        features.push({ x: (f.l * (i + 0.5)) / 8, y: y + 3.7, w: 1.1, h: 1.6 });
    const holes =
      d >= 2 ? features.map((q) => rect(q.x - q.w / 2, q.y, q.x + q.w / 2, q.y + q.h)) : [];
    face(o, 'wall', rect(0, y - 1.4, f.l, y + h), holes, f);
    for (const q of features) window(o, f, q.x, q.y, q.w, q.h, d, q.door);
    if (d >= 2 && f.l > 6) {
      B(o, 'paint', f.p(0, y + h - 0.1, 0.06), f.p(f.l, y + h - 0.1, 0.06), 0.1, 0.1, dark);
      if (d === 3) {
        B(o, 'paint', f.p(0.18, y + 0.1, 0.12), f.p(0.18, y + h - 0.1, 0.12), 0.08, 0.08, dark);
      }
    }
  }
}
function clip(p, axis, value, less) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      ina = less ? a[axis] <= value + 1e-9 : a[axis] >= value - 1e-9,
      inb = less ? b[axis] <= value + 1e-9 : b[axis] >= value - 1e-9;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
function roofPlane(o, p, region, height, eave, slot, col) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    let q = ix.slice(i, i + 3).map((k) => p[k]);
    for (const [a, v, l] of region) q = clip(q, a, v, l);
    if (q.length < 3) continue;
    cap(o, slot, q, height, true, col);
  }
  // Close boundary fascia on each clipped piece; the complete footprint remains a closed shell.
  for (let k = 0; k < p.length; k++) {
    let seg = [p[k], p[(k + 1) % p.length]],
      t0 = 0,
      t1 = 1;
    const a = seg[0],
      b = seg[1];
    for (const [axis, v, less] of region) {
      const dv = b[axis] - a[axis],
        da = (less ? 1 : -1) * (a[axis] - v),
        dd = (less ? 1 : -1) * dv;
      if (Math.abs(dd) < 1e-10) {
        if (da > 1e-8) {
          t0 = 1;
          t1 = 0;
        }
        continue;
      }
      const t = -da / dd;
      if (dd > 0) t1 = Math.min(t1, t);
      else t0 = Math.max(t0, t);
    }
    if (t1 <= t0 || t1 < 0 || t0 > 1) continue;
    seg = [Math.max(0, t0), Math.min(1, t1)].map((t) => a.map((v, i) => v + (b[i] - v) * t));
    const [a1, b1] = seg;
    Q(
      o,
      'wall',
      [
        [a1[0], eave, a1[1]],
        [b1[0], eave, b1[1]],
        [b1[0], height(...b1), b1[1]],
        [a1[0], height(...a1), a1[1]],
      ],
      [-(b[1] - a[1]), 0, b[0] - a[0]],
    );
  }
}
function roof(o, b, eave, d) {
  const p = cw(b.outline),
    bbp = bb(p),
    x0 = bbp[0][0],
    x1 = bbp[0][1],
    z0 = bbp[1][0],
    z1 = bbp[1][1],
    w = x1 - x0,
    l = z1 - z0,
    mx = (x0 + x1) / 2,
    mz = (z0 + z1) / 2,
    kiln = b.id === 'way/1355280626',
    shape = kiln
      ? 'pyramid'
      : (b.tags['roof:shape'] ?? (b.id === 'way/366391925' ? 'hipped' : 'gabled')),
    warehouse = b.tags.building === 'warehouse',
    slot = warehouse ? 'paint' : 'roof',
    col = warehouse
      ? b.tags['roof:colour'] === 'silver'
        ? rgb('aab3b4')
        : b.tags['roof:colour'] === 'black'
          ? rgb('596164')
          : rgb('7e8b8e')
      : C.roof,
    rise = kiln ? 5 : warehouse ? 2.6 : 3.2;
  const region = (a, v, less) => [a, v, less];
  if (shape === 'round') {
    const alongX = w > l,
      n = d === 0 ? 3 : d === 1 ? 6 : d === 2 ? 12 : 20,
      min = alongX ? z0 : x0,
      max = alongX ? z1 : x1;
    for (let i = 0; i < n; i++) {
      const a = min + ((max - min) * i) / n,
        b = min + ((max - min) * (i + 1)) / n,
        ya = eave + rise * Math.sin((i * Math.PI) / n),
        yb = eave + rise * Math.sin(((i + 1) * Math.PI) / n),
        axis = alongX ? 1 : 0;
      roofPlane(
        o,
        p,
        [region(axis, a, false), region(axis, b, true)],
        (x, z) => ya + ((yb - ya) * ((alongX ? z : x) - a)) / (b - a),
        eave,
        slot,
        col,
      );
    }
    return;
  }
  if (shape === 'hipped' || shape === 'pyramid') {
    const hx = Math.min(w / 2, l / 2),
      hz = hx;
    // A triangulated rectangle with ridge/end-hip break lines is clipped to each original building ring.
    const r =
        w >= l
          ? [
              [x0, z0],
              [x0, z1],
              [x0 + hx, mz],
              [x1 - hx, mz],
              [x1, z0],
              [x1, z1],
            ]
          : [
              [x0, z0],
              [x1, z0],
              [mx, z0 + hz],
              [mx, z1 - hz],
              [x0, z1],
              [x1, z1],
            ],
      facets =
        w >= l
          ? [
              [0, 1, 2],
              [0, 2, 3, 4],
              [1, 5, 3, 2],
              [4, 3, 5],
            ]
          : [
              [0, 2, 3, 4],
              [1, 5, 3, 2],
              [0, 1, 2],
              [4, 3, 5],
            ];
    const sourceTri = earcut(p.flat());
    for (const ids of facets) {
      const f = ids.map((i) => r[i]);
      const fi = earcut(f.flat());
      for (let i = 0; i < fi.length; i += 3) {
        const t = fi.slice(i, i + 3).map((k) => f[k]),
          den =
            (t[1][1] - t[2][1]) * (t[0][0] - t[2][0]) + (t[2][0] - t[1][0]) * (t[0][1] - t[2][1]);
        if (Math.abs(den) < 1e-9) continue;
        const h = t.map(
          (q) =>
            eave +
            rise *
              Math.min(1, (q[0] - x0) / hx, (x1 - q[0]) / hx, (q[1] - z0) / hz, (z1 - q[1]) / hz),
        );
        for (let j = 0; j < sourceTri.length; j += 3) {
          let q = sourceTri.slice(j, j + 3).map((k) => p[k]);
          const sign = area(t) > 0 ? 1 : -1;
          for (let k = 0; k < 3; k++) {
            const a = t[k],
              b = t[(k + 1) % 3],
              out = [];
            for (let n = 0; n < q.length; n++) {
              const c = q[n],
                d = q[(n + 1) % q.length],
                side = (v) =>
                  sign * ((b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0])),
                s = side(c),
                e = side(d);
              if (s >= -1e-8) out.push(c);
              if (s >= -1e-8 !== e >= -1e-8) {
                const u = s / (s - e);
                out.push(c.map((v, i) => v + (d[i] - v) * u));
              }
            }
            q = out;
            if (!q.length) break;
          }
          if (q.length >= 3)
            cap(
              o,
              slot,
              q,
              (x, z) => {
                const u =
                    ((t[1][1] - t[2][1]) * (x - t[2][0]) + (t[2][0] - t[1][0]) * (z - t[2][1])) /
                    den,
                  v =
                    ((t[2][1] - t[0][1]) * (x - t[2][0]) + (t[0][0] - t[2][0]) * (z - t[2][1])) /
                    den;
                return u * h[0] + v * h[1] + (1 - u - v) * h[2];
              },
              true,
              col,
            );
        }
      }
    }
    // The irregular footprint can cut a hip plane above eave level; close every such edge.
    const height = (x, z) =>
      eave +
      rise * Math.max(0, Math.min(1, (x - x0) / hx, (x1 - x) / hx, (z - z0) / hz, (z1 - z) / hz));
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      Q(
        o,
        'wall',
        [
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [b[0], height(...b), b[1]],
          [a[0], height(...a), a[1]],
        ],
        [-(b[1] - a[1]), 0, b[0] - a[0]],
      );
    }
    return;
  }
  const alongX = w >= l,
    axis = alongX ? 1 : 0,
    min = alongX ? z0 : x0,
    max = alongX ? z1 : x1,
    mid = (min + max) / 2;
  for (const [a, b] of [
    [min, mid],
    [mid, max],
  ])
    roofPlane(
      o,
      p,
      [region(axis, a, false), region(axis, b, true)],
      (x, z) => eave + rise * (1 - Math.abs((alongX ? z : x) - mid) / (mid - min)),
      eave,
      slot,
      col,
    );
}
function cylinder(o, s, a, b, r, n = 12, col = C[s]) {
  const u = b.map((v, i) => v - a[i]),
    len = Math.hypot(...u),
    axis = u.map((v) => v / len),
    v = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    vl = Math.hypot(...v),
    w = v.map((v) => v / vl),
    h = cross(axis, w),
    ring = (c) =>
      Array.from({ length: n }, (_, i) =>
        c.map((v, j) => v + r * (w[j] * Math.cos((i * tau) / n) + h[j] * Math.sin((i * tau) / n))),
      ),
    p = ring(a),
    q = ring(b);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    Q(
      o,
      s,
      [p[i], p[k], q[k], q[i]],
      p[i].map((v, j) => v - a[j]),
      col,
    );
    tri(
      o,
      s,
      [a, p[k], p[i]],
      axis.map((v) => -v),
      col,
    );
    tri(o, s, [b, q[i], q[k]], axis, col);
  }
}
function lathe(o, s, x, z, profile, n) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * tau) / n),
      y,
      z + r * Math.sin((i * tau) / n),
    ]),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        s,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [Math.cos(((i + 0.5) * tau) / n), 0, Math.sin(((i + 0.5) * tau) / n)],
      );
    }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    tri(o, s, [[x, profile[0][0], z], rings[0][k], rings[0][i]], [0, -1, 0]);
  }
}
function display(o, d) {
  const [x, z] = plan.estimatedIntrinsicDisplay.outdoorCopperStill.local,
    y = 0.4,
    n = d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 16 : 28;
  lathe(
    o,
    'copper',
    x,
    z,
    [
      [y, 1.6],
      [y + 0.65, 1.85],
      [y + 1.25, 1.95],
      [y + 2, 1.55],
      [y + 2.5, 1.05],
      [y + 4.8, 0.55],
      [y + 5.45, 0.45],
    ],
    n,
  );
  const path = [
      [x, y + 5.45],
      [x - 0.12, y + 5.85],
      [x - 0.4, y + 6.15],
      [x - 0.8, y + 6.3],
      [x - 1.15, y + 6.3],
    ],
    neckPath = d === 0 ? path.filter((_, i) => i % 2 === 0) : path,
    rings = neckPath.map((p, i) => {
      const a = neckPath[Math.max(0, i - 1)],
        b = neckPath[Math.min(neckPath.length - 1, i + 1)],
        v = [b[0] - a[0], b[1] - a[1]],
        l = Math.hypot(...v);
      return Array.from({ length: n }, (_, k) => [
        p[0] - ((0.45 * v[1]) / l) * Math.cos((k * tau) / n),
        p[1] + ((0.45 * v[0]) / l) * Math.cos((k * tau) / n),
        z + 0.45 * Math.sin((k * tau) / n),
      ]);
    });
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(o, 'copper', [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], null);
    }
  const last = rings.at(-1),
    inner = last.map((p) => [p[0] + 0.4, y + 6.3 + (p[1] - y - 6.3) * 0.72, z + (p[2] - z) * 0.72]);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    Q(o, 'copper', [last[i], last[k], inner[k], inner[i]], null);
    tri(o, 'paint', [[x - 0.75, y + 6.3, z], inner[i], inner[k]], [-1, 0, 0], dark);
  }
  if (d >= 2) {
    for (const yy of [y + 0.2, y + 2.5])
      lathe(
        o,
        'copper',
        x,
        z,
        [
          [yy, yy === y + 0.2 ? 1.72 : 1.09],
          [yy + 0.1, yy === y + 0.2 ? 1.72 : 1.09],
        ],
        n,
      );
    cylinder(
      o,
      'paint',
      [x + 1.55, y + 1.1, z + 0.3],
      [x + 2.4, y + 1.7, z + 0.5],
      0.11,
      10,
      steel,
    );
    cylinder(o, 'paint', [x - 1.7, y + 1.1, z + 0.6], [x - 1.7, y + 1.1, z + 0.95], 0.32, 12, dark);
  }
  if (d >= 1) {
    box(o, 'wood', [x - 10, 0.05, z + 1.9], [x + 10, 0.35, z + 2.6]);
    for (let i = 0; i < 12; i++) barrel(o, x - 9.2 + i * 1.67, z + 2.25, d);
  }
}
function barrel(o, x, z, d) {
  const y = 1.08,
    n = d === 1 ? 6 : d === 2 ? 10 : 16,
    profile = [
      [-0.65, 0.6],
      [-0.4, 0.72],
      [0.4, 0.72],
      [0.65, 0.6],
    ],
    rings = profile.map(([zz, r]) =>
      Array.from({ length: n }, (_, i) => [
        x + r * Math.cos((i * tau) / n),
        y + r * Math.sin((i * tau) / n),
        z + zz,
      ]),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        'wood',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [Math.cos(((i + 0.5) * tau) / n), Math.sin(((i + 0.5) * tau) / n), 0],
      );
    }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    tri(o, 'wood', [[x, y, z - 0.65], rings[0][k], rings[0][i]], [0, 0, -1]);
    tri(
      o,
      'paint',
      [[x, y, z + 0.652], rings.at(-1)[i], rings.at(-1)[k]],
      [0, 0, 1],
      rgb('33bba7'),
    );
  }
  if (d === 3)
    for (const zz of [-0.37, 0.37])
      cylinder(o, 'paint', [x, y, z + zz - 0.035], [x, y, z + zz + 0.035], 0.735, 16, dark);
}

function kiln(o, b, y, d) {
  const p = b.outline,
    bbp = bb(p),
    x = (bbp[0][0] + bbp[0][1]) / 2,
    z = (bbp[1][0] + bbp[1][1]) / 2,
    top = y + 14;
  prism(o, 'paint', rect(x - 0.75, z - 0.75, x + 0.75, z + 0.75), top - 0.1, top + 0.18, pale);
  for (const a of [-1, 1])
    for (const c of [-1, 1])
      box(
        o,
        'paint',
        [x + a * 0.66 - 0.06, top + 0.15, z + c * 0.66 - 0.06],
        [x + a * 0.66 + 0.06, top + 1.1, z + c * 0.66 + 0.06],
        pale,
      );
  const v = [
      [x - 0.86, top + 1.1, z - 0.86],
      [x + 0.86, top + 1.1, z - 0.86],
      [x + 0.86, top + 1.1, z + 0.86],
      [x - 0.86, top + 1.1, z + 0.86],
    ],
    tip = [x, top + 1.65, z];
  for (let i = 0; i < 4; i++) tri(o, 'roof', [v[i], v[(i + 1) % 4], tip], [0, 1, 0]);
  if (d >= 2)
    for (const a of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const yy = top + 0.35 + i * 0.21;
        B(o, 'paint', [x - 0.6, yy, z + a * 0.68], [x + 0.6, yy, z + a * 0.68], 0.07, 0.07, pale);
      }
}
function details(o, d) {
  const visitor = plan.buildings.find((b) => b.id === 'way/366391925'),
    y = plan.estimatedBuildingLevels[visitor.id].floorY;
  if (d >= 1)
    for (const x of [-12, 7]) {
      box(o, 'wall', [x - 0.7, y + 7.2, -3.2], [x + 0.7, y + 8.2, -1.7]);
      const f = basis([x - 0.7, -1.68], [x + 0.7, -1.68]);
      window(o, f, 0.7, y + 7.35, 0.75, 0.6, d);
      const v = [
        [x - 0.86, y + 8.2, -3.35],
        [x + 0.86, y + 8.2, -3.35],
        [x + 0.86, y + 8.2, -1.55],
        [x - 0.86, y + 8.2, -1.55],
      ];
      Q(o, 'roof', [v[0], v[3], [x, y + 8.9, -1.55], [x, y + 8.9, -3.35]], [-1, 1, 0]);
      Q(o, 'roof', [v[1], [x, y + 8.9, -3.35], [x, y + 8.9, -1.55], v[2]], [1, 1, 0]);
      tri(o, 'wall', [v[3], v[2], [x, y + 8.9, -1.55]], [0, 0, 1]);
      tri(o, 'wall', [v[0], [x, y + 8.9, -3.35], v[1]], [0, 0, -1]);
    }
  for (const [x, z, h] of [
    [-50, -7, 12.5],
    [-57, -17, 10.8],
  ]) {
    cylinder(
      o,
      'paint',
      [x, 1.2, z],
      [x, h, z],
      d === 0 ? 0.32 : 0.23,
      d === 0 ? 4 : d === 1 ? 6 : 12,
      steel,
    );
    if (d >= 2) cylinder(o, 'paint', [x, h - 0.2, z], [x, h + 0.1, z], 0.32, 12, steel);
  }
  if (d >= 2) {
    box(o, 'paint', [-54, 3.3, -5], [-43, 5.3, -2.2], steel);
    for (let k = 0; k < 6; k++)
      B(o, 'paint', [-54, 3.45 + k * 0.28, -2.15], [-43, 3.45 + k * 0.28, -2.15], 0.07, 0.08, pale);
  }
}
function build(o, _frame, d = 3) {
  for (const b of plan.buildings) {
    const y = plan.estimatedBuildingLevels[b.id].floorY,
      levels = +b.tags['building:levels'] || (b.tags.building === 'warehouse' ? 1 : 2),
      h = b.id === 'way/1355280626' ? 9 : levels === 1 ? 4.5 : 6.3;
    wallBody(o, b, y, h, d);
    roof(o, b, y + h, d);
    if (b.id === 'way/1355280626') kiln(o, b, y, d);
  }
  display(o, d);
  details(o, d);
}
export const bruichladdichSkyline = (o, f) => build(o, f, 0),
  bruichladdichDistrict = (o, f) => build(o, f, 1),
  bruichladdichStreet = (o, f) => build(o, f, 2);
export const bruichladdichModel = {
  id: 'bruichladdich_distillery',
  key: 'bruichladdich_distillery',
  recipe: 'structure-bruichladdich-distillery.mjs',
  cell: 'gc/gcg',
  title: 'Bruichladdich Distillery',
  category: 'distillery',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete22building Bruichladdich compound on original plans and approximate uphill floor terraces: whitewash/greenframeproduction and long hipped-slate visitor front/dormers, highpyramidkilnwithgenuinelyopenventcupola, chimneys/flues, separate gabled/roundroofwarehouses and opencourts; intrinsic copper swan-neck still and turquoise-ended barrel display. No villagebuildings, naturalshore/water/groundslab, people/vehicles/lettering or interiors.',
  camera: [190, 135, 175],
  lookAt: [-10, 6, -95],
  portableGroundY: -1.1,
  mediumFiContext: { scale: 1.05, groundY: -1.1 },
  qaCameras: [
    {
      name: 'complete-native-compound-and-uphill-warehouse-roofs',
      position: [180, 190, 160],
      lookAt: [-8, 8, -105],
      reviewLod: 'skyline',
    },
    {
      name: 'white-seaward-visitor-front-green-casements-and-pyramid-kiln',
      position: [-45, 25, 88],
      lookAt: [-20, 6, -20],
    },
    {
      name: 'open-copper-swan-neck-still-and-native-courtyard',
      position: [61, 15, 38],
      lookAt: [27, 4, -10],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: plan.groundReviewBasis,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bruichladdich-distillery.mjs',
    level: 'skyline',
    export: 'bruichladdichSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'bruichladdichDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'bruichladdichStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.groundReviewBasis,
    'Three exact already-published QuallaLaddie09own-workPDselforiginals inspected and nativeSHA1matched, pinned primary creator releases bound.2008wholefront/courtyard and2002widecoastalroofline control original medium-fi geometry. Unrelated/caskcloseup/otherlicensed imagery unused; no supplemental or generated bitmap, copied photograph texture or lettering.',
    'All22individualbuilding master perimeters retained, native1/2/3level and gabled/hipped/round roof tags respected. Historic frontage roof partition, kiln/cupola detail, concealed new warehouse doors/windows, section heights and small modern equipment are photographic/native estimates. Named industrial parcel is identity only, never a solid roof or ground slab; working courts stay open.',
    'Explicit approximate floor terraces use photographed connected-front thresholds and the independently frozen coarse provider field for concealed uphill warehouse estimates. Provider pixels may blend structures/vegetation; exact individual floor/footing/hostshore contact remains unverified. Original raw terrain is not flattened or fitted. Flat stageY-1.1shows architecture, not certified hillside contact.',
    'Outdoor copper still and barrel display are intrinsic photographed exterior features, with approximate courtyard registration/scale; no interior stillhouseequipment. Copper exit mouth and kiln vent cupola are real openings, other windows/doors closed behind frames. Representative simplified machinery/repeat census and unlettered turquoise barrel ends; no trademarks/signage, village buildings or natural shoreline.',
  ],
};
