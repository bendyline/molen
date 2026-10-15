/** Edinburgh Castle: individual mapped buildings, Crown Square, gates and stepped batteries. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor, normalize, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0242_edinburgh_castle/review-map-parts.json',
      import.meta.url,
    ),
  ),
);
const road = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0242_edinburgh_castle/road-surface.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.57, 0.52, 0.43],
  trim = [0.66, 0.63, 0.55],
  wood = [0.67, 0.67, 0.61],
  glass = [0.12, 0.17, 0.18];
const slate = [0.26, 0.29, 0.3];
const master = (o) => !o.detail,
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  near = (o) => o.detail !== 'skyline' && o.detail !== 'district';
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
        (slot, ref, p, n, uv, color) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            color,
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
function clean(r, tolerance = 0.15) {
  const original = r.map((p) => [...p]);
  if (Math.hypot(original[0][0] - original.at(-1)[0], original[0][1] - original.at(-1)[1]) < 0.01)
    original.pop();
  const kept = original.map((_, i) => i);
  let changed = true;
  while (changed && kept.length > 4) {
    changed = false;
    for (let j = 0; j < kept.length; j++) {
      const ai = kept[(j + kept.length - 1) % kept.length],
        ci = kept[(j + 1) % kept.length],
        a = original[ai],
        c = original[ci],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        l2 = dx * dx + dz * dz;
      if (l2 < 1e-10) continue;
      let error = 0;
      for (let k = (ai + 1) % original.length; k !== ci; k = (k + 1) % original.length) {
        const b = original[k],
          t = Math.max(0, Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / l2));
        error = Math.max(error, Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz));
      }
      if (error <= tolerance) {
        kept.splice(j, 1);
        changed = true;
        break;
      }
    }
  }
  const p = kept.map((i) => original[i]);
  return area(p) < 0 ? p.reverse() : p;
}
function ring(id, detail) {
  const f = map.features.find((f) => f.id === `way/${id}`);
  if (!f) throw Error(`Missing Edinburgh part${id}`);
  return clean(
    f.points,
    id === 511343924 ? 0.08 : detail === 'skyline' ? 2.5 : detail === 'district' ? 0.3 : 0.12,
  );
}
function cap(o, p, y, slot, color) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, color);
  }
}
function prism(o, p, y0, y1, slot = 'sandstone', color = stone) {
  cap(o, p, y1, slot, color);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      slot,
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [b[0], y0, b[1]],
        [a[0], y0, a[1]],
      ],
      color,
    );
  }
}
function edges(o, p, fn) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.35) fn(edgeFrame(o, b, a), len, i);
  }
}
function rect(o, x, y, w, h, color = glass, slot = 'glass', z = 0.045) {
  face(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    color,
  );
}
function line(o, a, b, width = 0.12, slot = 'carved', color = trim) {
  if (master(o)) beam(o, slot, a, b, width, width, color);
  else {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.001) return;
    const dx = ((b[1] - a[1]) * width) / (2 * len),
      dy = ((a[0] - b[0]) * width) / (2 * len);
    const p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
    if (normalFor(...p)[2] < 0) p.reverse();
    face(o, slot, p, color);
  }
}
function band(o, p, y, width = 0.22, slot = 'carved', color = trim) {
  edges(o, p, (f, len) => {
    if (master(o)) box(f, slot, [0, y - width / 2, -0.05], [len, y + width / 2, 0.2], color);
    else rect(f, len / 2, y - width / 2, len, width, color, slot, 0.065);
  });
}
function arch(o, x, y, w, h, { color = glass, slot = 'glass', ornament = true } = {}) {
  const r = w / 2,
    spring = y + h - r,
    n = master(o) ? 12 : fine(o) ? 6 : 3;
  const p = [
    [x - r, y],
    [x + r, y],
    [x + r, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  o.addConvexPolygon(
    slot,
    'palette:#ffffff',
    p.map(([x, y]) => [x, y, 0.055]),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    color,
  );
  if (!ornament || !near(o)) return;
  for (let i = 1; i < p.length; i++) line(o, [...p[i - 1], 0.1], [...p[i], 0.1], 0.13);
  line(o, [x - r, y, 0.1], [x - r, spring, 0.1]);
  if (master(o))
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(
        o,
        'carved',
        [
          [x + (r + 0.18) * Math.cos(a), spring + (r + 0.18) * Math.sin(a), 0.12],
          [x + (r + 0.18) * Math.cos(b), spring + (r + 0.18) * Math.sin(b), 0.12],
          [x + r * Math.cos(b), spring + r * Math.sin(b), 0.12],
          [x + r * Math.cos(a), spring + r * Math.sin(a), 0.12],
        ],
        trim.map((v) => v * (0.92 + 0.02 * (i % 4))),
      );
    }
}
function window(o, x, y, w, h) {
  rect(o, x, y, w, h);
  if (o.detail === 'street') {
    line(o, [x, y, 0.12], [x, y + h, 0.12], 0.1, 'wood', wood);
    return;
  }
  if (!near(o)) return;
  for (const [a, b] of [
    [
      [x - w / 2, y],
      [x - w / 2, y + h],
    ],
    [
      [x + w / 2, y],
      [x + w / 2, y + h],
    ],
    [
      [x - w / 2, y],
      [x + w / 2, y],
    ],
    [
      [x - w / 2, y + h],
      [x + w / 2, y + h],
    ],
    [
      [x, y],
      [x, y + h],
    ],
  ])
    line(o, [...a, 0.12], [...b, 0.12], 0.1, 'wood', wood);
  if (fine(o))
    for (let yy = y + h / 3; yy < y + h - 0.1; yy += h / 3)
      line(o, [x - w / 2, yy, 0.13], [x + w / 2, yy, 0.13], 0.045, 'metal', [0.36, 0.34, 0.29]);
}
function fit(p) {
  let best;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      v = [-u[1], u[0]],
      q = p.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * v[0] + p[1] * v[1]]),
      lo = [0, 1].map((j) => Math.min(...q.map((p) => p[j]))),
      hi = [0, 1].map((j) => Math.max(...q.map((p) => p[j]))),
      score = (hi[0] - lo[0]) * (hi[1] - lo[1]);
    if (!best || score < best.score) best = { u, v, lo, hi, score };
  }
  return best;
}
function clip(p, axis, mid, sign) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = sign * (a[axis] - mid),
      db = sign * (b[axis] - mid);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
/** Gable slopes are clipped to the occupied polygon, including the bent gallery. */
function roof(
  o,
  p,
  y,
  rise,
  { slot = 'slate', color = slate, across = false, wallSlot = 'sandstone', wallColor = stone } = {},
) {
  const f = fit(p),
    q = p.map((p) => [p[0] * f.u[0] + p[1] * f.u[1], p[0] * f.v[0] + p[1] * f.v[1]]),
    long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
    axis = across ? long : 1 - long,
    mid = (f.lo[axis] + f.hi[axis]) / 2,
    half = (f.hi[axis] - f.lo[axis]) / 2;
  const height = (p) => y + rise * (1 - Math.abs(p[axis] - mid) / half),
    world = (p, y) => [p[0] * f.u[0] + p[1] * f.v[0], y, p[0] * f.u[1] + p[1] * f.v[1]];
  const ix = earcut(q.flat());
  for (let i = 0; i < ix.length; i += 3)
    for (const sign of [-1, 1]) {
      const ps = clip(
        ix.slice(i, i + 3).map((k) => q[k]),
        axis,
        mid,
        sign,
      );
      for (let j = 1; j < ps.length - 1; j++) {
        const a = [ps[0], ps[j], ps[j + 1]].map((p) => world(p, height(p)));
        if (Math.hypot(...normalFor(...a)) < 0.1) continue;
        if (normalFor(...a)[1] < 0) a.reverse();
        tri(o, slot, a, color);
      }
    }
  // Fill the raking end wall rather than leave a roof floating above an empty triangle.
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      ps = [a];
    if ((a[axis] - mid) * (b[axis] - mid) < 0) {
      const t = (mid - a[axis]) / (b[axis] - a[axis]);
      ps.push(a.map((v, j) => v + (b[j] - v) * t));
    }
    ps.push(b);
    for (let j = 1; j < ps.length; j++) {
      const a = ps[j - 1],
        b = ps[j],
        ha = height(a),
        hb = height(b);
      if (Math.max(ha, hb) < y + 0.001) continue;
      const v = [world(a, ha), world(b, hb), world(b, y), world(a, y)].filter(
        (p, i, a) => i === 0 || Math.hypot(...p.map((v, j) => v - a[i - 1][j])) > 0.001,
      );
      if (v.length >= 3) {
        if (v.length === 4 && Math.hypot(...v[0].map((n, j) => n - v[3][j])) < 0.001) v.pop();
        if (v.length === 3) tri(o, wallSlot, v, wallColor);
        else face(o, wallSlot, v, wallColor);
      }
    }
  }
  // Raised seams on copper; courses on slate/tile. Geometry belongs only in the master.
  if (master(o)) {
    const along = 1 - axis;
    for (let pos = f.lo[along] + 0.6; pos < f.hi[along]; pos += slot === 'copper' ? 0.65 : 0.5) {
      const cuts = [];
      for (let i = 0; i < q.length; i++) {
        const a = q[i],
          b = q[(i + 1) % q.length];
        if ((a[along] <= pos && b[along] > pos) || (b[along] <= pos && a[along] > pos)) {
          const t = (pos - a[along]) / (b[along] - a[along]);
          cuts.push(a.map((v, j) => v + (b[j] - v) * t));
        }
      }
      cuts.sort((a, b) => a[axis] - b[axis]);
      for (let k = 0; k + 1 < cuts.length; k += 2) {
        const a = cuts[k],
          b = cuts[k + 1],
          ps = [a];
        if (a[axis] < mid && b[axis] > mid) {
          const p = [...a];
          p[axis] = mid;
          ps.push(p);
        }
        ps.push(b);
        for (let j = 1; j < ps.length; j++)
          beam(
            o,
            slot,
            world(ps[j - 1], height(ps[j - 1]) + 0.035),
            world(ps[j], height(ps[j]) + 0.035),
            0.035,
            0.045,
            color.map((v) => v * 0.86),
          );
      }
    }
  }
}
const centroid = (p) => [0, 1].map((j) => p.reduce((s, v) => s + v[j], 0) / p.length);
const feature = (id) => map.features.find((f) => f.id === `way/${id}`);
const _simpler = (p, t) => clean(p, t);
/** Douglas-Peucker retains a global error bound for mapped open wall paths. */
function pathPoints(p, tolerance) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l2 = dx * dx + dz * dz;
  let max = 0,
    index = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const t = l2
        ? Math.max(0, Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dz) / l2))
        : 0,
      error = Math.hypot(p[i][0] - a[0] - t * dx, p[i][1] - a[1] - t * dz);
    if (error > max) {
      max = error;
      index = i;
    }
  }
  return max > tolerance
    ? [
        ...pathPoints(p.slice(0, index + 1), tolerance).slice(0, -1),
        ...pathPoints(p.slice(index), tolerance),
      ]
    : [a, b];
}
const partRing = (o, id) => ring(id, o.detail);
function crenels(o, p, y, spacing = 2.7) {
  if (!near(o)) return;
  edges(o, p, (f, len) => {
    if (o.detail === 'skyline') return;
    box(f, 'sandstone', [0, y - 0.35, -0.28], [len, y + 0.18, 0.18], stone);
    if (o.detail === 'district') return;
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = 0; i < n; i++)
      box(
        f,
        'sandstone',
        [(i * len) / n, y, -0.28],
        [(i * len) / n + (len / n) * 0.44, y + 0.9, 0.18],
        stone,
      );
  });
}
function masonry(o, p, y, h) {
  if (!master(o)) return;
  edges(o, p, (f, len, k) => {
    // Individual shallow mortar joints; continuous stone body remains behind them.
    for (let yy = y + 0.5, row = 0; yy < h - 0.1; yy += 0.57, row++) {
      rect(f, len / 2, yy, len, 0.016, [0.39, 0.36, 0.31], 'sandstone', 0.018);
      for (let x = (row % 2) * 0.63 + 0.25; x < len - 0.15; x += 1.27) {
        rect(f, x, yy - 0.5, 0.015, 0.5, [0.4, 0.37, 0.32], 'sandstone', 0.018);
        if ((row + k + Math.floor(x)) % 5 === 0)
          rect(
            f,
            x + 0.25,
            yy - 0.45,
            Math.min(0.43, len - x),
            0.39,
            stone.map((v) => v * 0.91),
            'sandstone',
            0.02,
          );
      }
    }
  });
}
function quoin(o, p, y, h) {
  if (!fine(o)) return;
  edges(o, p, (f, len) => {
    if (len < 2) return;
    for (let yy = y; yy < h - 0.5; yy += 0.65) {
      const w = Math.round(yy / 0.65) % 2 ? 0.5 : 0.8;
      for (const x of [w / 2, len - w / 2]) rect(f, x, yy, w, 0.58, trim, 'carved', 0.03);
    }
  });
}
function facade(o, p, y, eaves, rows = 2, pitch = 3.5, { arched = false } = {}) {
  if (o.detail === 'skyline') return;
  if (o.detail === 'district') {
    rows = 1;
    pitch = 12;
  }
  edges(o, p, (f, len) => {
    if (len < 2.3) return;
    const n = Math.max(1, Math.floor(len / pitch));
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) * len) / n,
          yy = y + 1.1 + (row * (eaves - y - 1.4)) / rows;
        const w = Math.min(1.25, (len / n) * 0.47),
          h = Math.min(2.05, ((eaves - y) / rows) * 0.53);
        if (arched) arch(f, x, yy, w, h, { ornament: near(o) });
        else window(f, x, yy, w, h);
        if (fine(o)) {
          line(f, [x - w / 2 - 0.15, yy - 0.14, 0.065], [x + w / 2 + 0.15, yy - 0.14, 0.065], 0.14);
          for (const dx of [-w / 2 - 0.1, w / 2 + 0.1])
            line(f, [x + dx, yy, 0.06], [x + dx, yy + h, 0.06], 0.12);
        }
      }
  });
  quoin(o, p, y, eaves);
  masonry(o, p, y, eaves);
}
function chimney(o, c, y, angle = 0, w = 1.35) {
  if (o.detail === 'skyline') return;
  const f = frame(o, c[0], 0, c[1], angle);
  box(f, 'sandstone', [-w / 2, y, -0.48], [w / 2, y + 2.9, 0.48], stone);
  box(f, 'carved', [-w / 2 - 0.12, y + 2.6, -0.59], [w / 2 + 0.12, y + 2.9, 0.59], trim);
  if (fine(o))
    for (const x of [-w * 0.24, w * 0.24])
      tube(
        f,
        'tile',
        [x, y + 2.9, 0],
        [x, y + 3.45, 0],
        0.17,
        0.14,
        master(o) ? 10 : 6,
        [0.58, 0.37, 0.25],
      );
}
function hall(
  o,
  id,
  y,
  eaves,
  rise,
  rows = 2,
  { flat = false, across = false, chimneys = true, arched = false, plan, roofPlan } = {},
) {
  const out = o;
  const floor = workingFloors[id] ?? y;
  o = grounded(out, out.detail, floor - y, y);
  const p = plan ?? partRing(o, id);
  prism(o, p, y, y + eaves);
  if (!flat) roof(o, roofPlan ?? p, y + eaves, rise, { across });
  if (o.detail === 'skyline') return;
  if (near(o)) band(o, p, y + eaves, 0.2);
  facade(o, p, y, y + eaves, rows, 3.4, { arched });
  if (chimneys && near(o) && rise > 1) {
    const f = fit(p),
      long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1;
    const axis = across ? long : 1 - long,
      along = 1 - axis;
    const size = f.hi[along] - f.lo[along],
      count = Math.max(1, Math.round(size / 14));
    for (let i = 0; i < count; i++) {
      const q = [(f.lo[0] + f.hi[0]) / 2, (f.lo[1] + f.hi[1]) / 2];
      q[along] = f.lo[along] + (size * (i + 0.5)) / count;
      const center = [q[0] * f.u[0] + q[1] * f.v[0], q[0] * f.u[1] + q[1] * f.v[1]];
      let inside = false;
      for (let j = 0, k = p.length - 1; j < p.length; k = j++) {
        const a = p[j],
          b = p[k];
        if (
          a[1] > center[1] !== b[1] > center[1] &&
          center[0] < ((b[0] - a[0]) * (center[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      if (!inside) continue;
      chimney(o, center, y + eaves + rise - 0.8, Math.atan2(-f.u[1], f.u[0]));
    }
  }
}
/** Gate passage with genuine open barrel vault, not a painted doorway. */
function portal(o, x, y, z, angle, width, depth, height, opening = 3.8) {
  const f = frame(o, x, y, z, angle),
    r = opening / 2,
    spring = 3.1,
    top = spring + r;
  box(f, 'sandstone', [-width / 2, 0, -depth / 2], [-r, height, depth / 2], stone);
  box(f, 'sandstone', [r, 0, -depth / 2], [width / 2, height, depth / 2], stone);
  box(f, 'sandstone', [-r, top, -depth / 2], [r, height, depth / 2], stone);
  const n = o.detail === 'skyline' ? 4 : master(o) ? 20 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      ax = r * Math.cos(a),
      bx = r * Math.cos(b),
      ay = spring + r * Math.sin(a),
      by = spring + r * Math.sin(b);
    for (const side of [-1, 1]) {
      const q = [
        [ax, ay, (side * depth) / 2],
        [bx, by, (side * depth) / 2],
        [bx, top, (side * depth) / 2],
        [ax, top, (side * depth) / 2],
      ];
      if (side > 0) q.reverse();
      if (Math.abs(ax - bx) > 0.001 && Math.min(ay, by) < top - 0.001) {
        if (Math.hypot(...q[1].map((v, j) => v - q[2][j])) > 0.001)
          tri(f, 'sandstone', [q[0], q[1], q[2]], stone);
        if (Math.hypot(...q[0].map((v, j) => v - q[3][j])) > 0.001)
          tri(f, 'sandstone', [q[0], q[2], q[3]], stone);
      }
    }
    face(
      f,
      'carved',
      [
        [ax, ay, -depth / 2],
        [ax, ay, depth / 2],
        [bx, by, depth / 2],
        [bx, by, -depth / 2],
      ],
      trim,
    );
  }
  if (near(o))
    for (const side of [-1, 1]) {
      const g = frame(f, 0, 0, (side * depth) / 2, side > 0 ? 0 : Math.PI);
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n;
        face(
          g,
          'carved',
          [
            [(r + 0.35) * Math.cos(a), spring + (r + 0.35) * Math.sin(a), 0.05],
            [r * Math.cos(a), spring + r * Math.sin(a), 0.05],
            [r * Math.cos(b), spring + r * Math.sin(b), 0.05],
            [(r + 0.35) * Math.cos(b), spring + (r + 0.35) * Math.sin(b), 0.05],
          ],
          trim,
        );
      }
      for (const dx of [-r - 0.2, r + 0.2]) line(g, [dx, 0, 0.06], [dx, spring, 0.06], 0.35);
    }
  return f;
}
function site(o) {
  paving(o);
  approachRoad(o);
  palaceLink(o);
  // External defensive walls are mapped polylines, not arbitrary enclosure boxes.
  const paths = [
    761574420, 761574421, 761574422, 41299990, 714452592, 41299993, 761574424, 761574425, 761574426,
  ];
  for (const id of paths) {
    const q = pathPoints(
      feature(id).points,
      o.detail === 'skyline' ? 4 : o.detail === 'district' ? 0.4 : 0.12,
    );
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1],
        b = q[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.25) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        high = id === 761574424 || id === 761574425 || (id === 41299993 && mid[0] > 14);
      const y = high ? 20.2 : defensiveFloor(mid[0], mid[1]),
        f = edgeFrame(grounded(o, o.detail, 0, y - 0.3), a, b);
      if (o.detail === 'skyline') {
        for (const side of [-1, 1]) {
          const p = [
            [0, y - 0.3, side * 0.7],
            [len, y - 0.3, side * 0.7],
            [len, y + 1.65, side * 0.7],
            [0, y + 1.65, side * 0.7],
          ];
          if (side < 0) p.reverse();
          face(f, 'sandstone', p, stone);
        }
        face(
          f,
          'sandstone',
          [
            [0, y + 1.65, 0.7],
            [len, y + 1.65, 0.7],
            [len, y + 1.65, -0.7],
            [0, y + 1.65, -0.7],
          ],
          stone,
        );
      } else box(f, 'sandstone', [0, y - 0.3, -0.7], [len, y + 1.65, 0.7], stone);
      if (fine(o)) box(f, 'carved', [0, y + 1.5, -0.78], [len, y + 1.72, 0.78], trim);
    }
  }
}

/** Bare-earth interpolation cannot represent the floor beneath an arched gate. */
export function edinburghRoadY(x, z) {
  let y = edinburghTerrainFacetY(x, z) + 0.04;
  for (const gate of [
    { x: 106.54, z: -25.61, a: -Math.PI / 2 + 0.383, floor: 0, half: 4.49 },
    { x: 34.134126998284124, z: -42.53984363196876, a: 1.0951931797477348, floor: 7, half: 4.25 },
  ]) {
    const c = Math.cos(gate.a),
      s = Math.sin(gate.a),
      u = (x - gate.x) * c - (z - gate.z) * s,
      v = (x - gate.x) * s + (z - gate.z) * c;
    if (Math.abs(u) < 4.5) {
      const t = Math.max(0, Math.min(1, (Math.abs(v) - gate.half - 0.600001) / 4));
      y = gate.floor * (1 - t) + y * t;
    }
  }
  return y;
}
function approachRoad(o) {
  for (const outline of road.surfacePieces) {
    // Every cap retains the exact terrain-mask perimeter; simplifying it exposes sky slivers.
    let p = outline;
    if (near(o)) {
      p = p.flatMap((a, i) => {
        const b = p[(i + 1) % p.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n }, (_, j) => [
          a[0] + ((b[0] - a[0]) * j) / n,
          a[1] + ((b[1] - a[1]) * j) / n,
        ]);
      });
    }
    const indices = earcut(p.flat()),
      points = p.map(([x, z]) => [x, edinburghRoadY(x, z), z]);
    for (let i = 0; i < indices.length; i += 3) {
      const q = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]];
      const f = q.map((p) => p.map(Math.fround)),
        a = f[1].map((v, k) => v - f[0][k]),
        b = f[2].map((v, k) => v - f[0][k]);
      if (Math.hypot(...cross(a, b)) < 0.00001) continue;
      if (normalFor(...f)[1] < 0) f.reverse();
      tri(o, 'carved', f, [0.52, 0.52, 0.49]);
    }
  }
  // Close the actual terrain cut beneath the wider cap; an outer-edge wall
  // leaves the inset mask edge visible where retained ground rises steeply.
  for (const outline of road.cutFaceOutlines) {
    let p = area(outline) < 0 ? [...outline].reverse() : outline;
    if (near(o))
      p = p.flatMap((a, i) => {
        const b = p[(i + 1) % p.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n }, (_, j) => [
          a[0] + ((b[0] - a[0]) * j) / n,
          a[1] + ((b[1] - a[1]) * j) / n,
        ]);
      });
    const points = p.map(([x, z]) => [
      x,
      Math.max(edinburghRoadY(x, z) + 0.15, edinburghTerrainFacetY(x, z) + 0.2),
      z,
    ]);
    for (let i = 0; i < p.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        bottom = (q) =>
          Math.min(edinburghRoadY(q[0], q[2]) - 2, edinburghTerrainFacetY(q[0], q[2]) - 2, 20);
      if (o.detail === 'skyline' && (a[0] + b[0]) / 2 < 93) continue;
      const q = [a, b, [b[0], bottom(b), b[2]], [a[0], bottom(a), a[2]]];
      // A retaining cut exposes its road-facing side; a raised deck exposes its exterior side.
      if (Math.max(a[1] - edinburghRoadY(a[0], a[2]), b[1] - edinburghRoadY(b[0], b[2])) > 0.25)
        q.reverse();
      face(o, 'sandstone', q, stone);
    }
  }
}
function palace(out) {
  const o = grounded(out, out.detail, 3, 17);
  const y = 17;
  if (o.detail === 'skyline') {
    hall(o, 290611982, y, 11, 3.7, 3, { chimneys: false });
  } else {
    // Southern palace roofs intersect in four separately mapped ranges.
    for (const id of [934778537, 934778539, 934778540, 934778541])
      hall(o, id, y, 8, 5, 3, { across: id === 934778540 || id === 934778541 });
    hall(o, 934778545, y, 11, 0, 3, { flat: true, chimneys: false });
    const p = ring(934778545, o.detail);
    crenels(o, p, y + 11);
    const ch = ring(934778538, o.detail);
    prism(o, ch, y + 8, y + 15);
    band(o, ch, y + 14.6, 0.35);
    // Corbelled palace bartizans and the small domed north-west turret.
    for (const id of [934778542, 934778543]) {
      const p = ring(id, o.detail),
        c = centroid(p);
      loft(
        o,
        'sandstone',
        [
          radialRing(y + 8, 0.3, 0.3, near(o) ? 8 : 4, c),
          radialRing(y + 10, 1.25, 1.25, near(o) ? 8 : 4, c),
          radialRing(y + 12, 1.25, 1.25, near(o) ? 8 : 4, c),
        ],
        stone,
      );
      loft(
        o,
        'slate',
        [
          radialRing(y + 12, 1.45, 1.45, near(o) ? 8 : 4, c),
          radialRing(y + 14, 0.04, 0.04, near(o) ? 8 : 4, c),
        ],
        slate,
      );
    }
    const dome = ring(934778544, o.detail),
      c = centroid(dome);
    prism(o, dome, y + 5, y + 12);
    loft(
      o,
      'metal',
      [
        radialRing(y + 12, 1.8, 1.8, near(o) ? 16 : 8, c),
        radialRing(y + 13.4, 1.4, 1.4, near(o) ? 16 : 8, c),
        radialRing(y + 14.8, 0.12, 0.12, near(o) ? 16 : 8, c),
      ],
      [0.5, 0.52, 0.49],
    );
  }
  // The octagonal stair/clock turret projects into Crown Square from the palace.
  const p = partRing(o, 511343924),
    c = [70.7, 25.1];
  prism(o, p, y, y + 20);
  if (o.detail !== 'skyline') {
    if (near(o)) for (const yy of [21, 25.5, 30, 35.8]) band(o, p, yy, 0.16);
    crenels(o, p, 36.9, 1.5);
    edges(o, p, (f, len) => {
      if (len < 1) return;
      for (const yy of [19, 23, 27]) window(f, len / 2, yy, 0.5, 0.8);
    });
    if (near(o)) {
      const f = frame(o, 68.63, 0, 25.06, -Math.PI / 2 + 0.35);
      // Clock face with separate hour markers and hands (static noon).
      const n = fine(o) ? 32 : 16,
        ps = Array.from({ length: n }, (_, i) => [
          1.02 * Math.cos((i * 2 * Math.PI) / n),
          32.8 + 1.02 * Math.sin((i * 2 * Math.PI) / n),
          0.12,
        ]);
      f.addConvexPolygon(
        'metal',
        'palette:#ffffff',
        ps,
        [0, 0, 1],
        (p) => [p[0], p[1]],
        [0.16, 0.17, 0.16],
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        line(
          f,
          [0.76 * Math.sin(a), 32.8 + 0.76 * Math.cos(a), 0.15],
          [0.94 * Math.sin(a), 32.8 + 0.94 * Math.cos(a), 0.15],
          0.07,
          'carved',
          [0.86, 0.8, 0.6],
        );
      }
      line(f, [0, 32.8, 0.17], [0, 33.6, 0.17], 0.07, 'carved', [0.86, 0.8, 0.6]);
      line(f, [0, 32.8, 0.18], [-0.46, 33.05, 0.18], 0.1, 'carved', [0.86, 0.8, 0.6]);
    }
  }
  if (o.detail === 'skyline') {
    // A tiny triangular shaft keeps the pole visible from every bearing while
    // reserving the distant budget for closed court retaining faces.
    loft(
      o,
      'metal',
      [radialRing(37, 0.09, 0.09, 3, c), radialRing(49, 0.055, 0.055, 3, c)],
      [0.82, 0.83, 0.81],
      { cap: false },
    );
  } else
    tube(
      o,
      'metal',
      [c[0], 37, c[1]],
      [c[0], 49, c[1]],
      0.09,
      0.055,
      o.detail === 'skyline' ? 4 : 8,
      [0.82, 0.83, 0.81],
    );
}
function crownSquare(out) {
  const o = grounded(out, out.detail, 3, 17);
  const y = 17;
  // Great Hall retains its own high pitched roof, south side of the open quadrangle.
  hall(o, 467503846, y, 7.2, 6.8, 1, { chimneys: false, arched: true });
  // Queen Anne range has two parallel roofs and a southern connecting range.
  if (o.detail === 'skyline') hall(o, 467503845, y, 6, 3, 2, { chimneys: false });
  else for (const id of [934778561, 934778562, 934778563, 934778536]) hall(o, id, y, 6, 3, 2);
  // National War Memorial: crenellated U-front and five-sided northern shrine.
  const p = partRing(o, 1362947349);
  prism(o, p, y, y + 11.8);
  crenels(o, p, y + 11.8, 3.2);
  const shrine = partRing(o, 1362947350);
  prism(o, shrine, y, y + 12);
  roof(o, shrine, y + 12, 4.5, { across: true });
  if (o.detail === 'skyline') return;
  band(o, p, y + 1, 0.35);
  band(o, p, y + 11.4, 0.25);
  masonry(o, p, y, y + 11.8);
  // South facade faces into Crown Square; central entrance bay projects slightly.
  const a = [46.317, 15.531],
    b = [52.581, 13.116];
  const f = edgeFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  arch(f, len / 2, y + 0.5, 2.15, 3.5, { slot: 'wood', color: [0.12, 0.13, 0.11] });
  arch(f, len / 2, y + 5.3, 2.8, 5.1, { slot: 'carved', color: [0.56, 0.53, 0.45] });
  if (near(o)) {
    for (const x of [len / 2 - 1.65, len / 2 + 1.65])
      box(f, 'carved', [x - 0.13, y + 4.5, 0.06], [x + 0.13, y + 10.6, 0.25], trim);
    box(f, 'sandstone', [len / 2 - 1.1, y + 11.7, -0.5], [len / 2 + 1.1, y + 13, 0.25], stone);
  }
  for (let i = 0; i < 5; i++)
    box(f, 'carved', [-1, y + 0.1 * i, 0.2], [len + 1, y + 0.1 * (i + 1), 2.1 - i * 0.32], trim);
  if (near(o)) {
    edges(o, p, (f, len, i) => {
      const a = p[i],
        b = p[(i + 1) % p.length],
        mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      if (len < 4 || (mx > 45 && mx < 54 && mz > 12)) return;
      for (let x = 1.4; x < len - 1; x += 3.5)
        arch(f, x, y + 1.9, 1.25, 3.3, { ornament: fine(o) });
      if (len > 7)
        arch(f, len / 2, y + 7.1, 1, 2.5, { slot: 'carved', color: stone.map((v) => v * 0.82) });
    });
    // Great Hall stepped gable copings are limited to the narrow end walls.
    const hp = ring(467503846, o.detail),
      ft = fit(hp);
    const long = ft.hi[0] - ft.lo[0] > ft.hi[1] - ft.lo[1] ? 0 : 1,
      axis = 1 - long,
      mid = (ft.lo[axis] + ft.hi[axis]) / 2,
      half = (ft.hi[axis] - ft.lo[axis]) / 2;
    for (const end of [ft.lo[long], ft.hi[long]])
      for (let i = 0; i < 12; i++) {
        const v = [0, 0];
        v[long] = end;
        v[axis] = ft.lo[axis] + ((i + 0.5) * 2 * half) / 12;
        const h = y + 7.2 + 6.8 * (1 - Math.abs(v[axis] - mid) / half);
        const x = v[0] * ft.u[0] + v[1] * ft.v[0],
          z = v[0] * ft.u[1] + v[1] * ft.v[1];
        box(o, 'carved', [x - 0.3, h - 0.05, z - 0.3], [x + 0.3, h + 0.6, z + 0.3], trim);
      }
  }
}
function lowerWards(o) {
  const sky = o.detail === 'skyline';
  hall(o, 41294347, 6, 16, 4, 4, { chimneys: !sky });
  if (sky) {
    hall(o, 41299983, 6, 12, 4, 2, { chimneys: false });
    hall(o, 41299976, 6, 12, 4, 3, { chimneys: false });
    hall(o, 41299975, 6, 9, 5, 2, { chimneys: false });
    hall(o, 41299978, 6, 3, 1.5, 1, { chimneys: false });
  } else {
    for (const id of [934778553, 934778554]) hall(o, id, 6, 12, 4, 2);
    hall(o, 934778552, 6, 7, 3, 2);
    // Three sides of Hospital Square are kept separate and its court remains open.
    for (const [id, e, r, rows] of [
      [934552936, 12, 3, 3],
      [934552937, 9, 6, 2],
      [934552941, 12, 6, 3],
      [1361820890, 12, 4, 3],
      [1361820891, 12, 4, 3],
      [934552938, 4, 2, 1],
      [934552939, 4, 2, 1],
      [934552940, 4, 4, 1],
    ])
      hall(o, id, 6, e, r, rows);
    for (const id of [934593229, 934593230, 934593231, 934593232, 934593233])
      hall(o, id, 6, 3, 1.5, 1, { chimneys: false });
    hall(o, 41299980, 6, 3.5, 2, 1, { chimneys: false });
    hall(o, 41299984, 6, 3.5, 2, 1, { chimneys: false });
  }
  if (!sky) {
    hall(o, 934778548, 10, 3, 3, 1);
    hall(o, 934778549, 10, 3, 3, 1);
    hall(o, 467503844, 10, 3.4, 2.5, 1, { chimneys: false });
    hall(o, 53532866, 17, 6, 2.2, 2, { chimneys: false });
    hall(o, 934778547, 17, 3, 4, 1, { chimneys: false });
    hall(o, 305011960, 17, 4, 0, 1, { flat: true, chimneys: false });
  }
  // St Margaret's Chapel: small Romanesque chapel distinct from the memorial.
  hall(o, 41299985, 17, 4.1, 2.5, 1, { chimneys: false, arched: true });
  if (near(o)) {
    const c = centroid(ring(41299985, o.detail));
    const f = frame(o, c[0] - 4, 21.8, c[1], -0.36);
    box(f, 'sandstone', [-0.5, 5.2, -0.25], [0.5, 7, 0.25], stone);
    arch(frame(f, 0, 0, 0.22), 0, 5.5, 0.45, 0.75, { slot: 'metal', color: [0.19, 0.19, 0.17] });
    // Reservoir railings, gun emplacements, and Mons Meg are close-view details.
    const c2 = [19, -29];
    gun(o, c2[0], 21.8, c2[1], Math.PI, 3.8, 0.4);
    for (const [x, z] of [
      [-18, -63],
      [-28, -61],
      [-38, -61],
      [-76, -64],
    ])
      gun(o, x, 6, z, Math.PI, 2.7, 0.15);
    for (const [x, z, a] of [
      [85, -9, 2.25],
      [92, -3, 1.95],
      [95, 4, 1.55],
      [94, 11, 1.2],
    ])
      gun(o, x, 20.2, z, a, 2.7, 0.15);
  }
}
function gun(o, x, y, z, a, len, r) {
  if (!near(o)) return;
  const f = frame(o, x, y, z, a),
    dark = [0.14, 0.17, 0.15];
  for (const dx of [-0.58, 0.58]) {
    tube(f, 'metal', [dx - 0.08, 0.7, 0], [dx + 0.08, 0.7, 0], 0.48, 0.48, fine(o) ? 12 : 6, dark);
    box(f, 'wood', [dx - 0.14, 0.52, -0.6], [dx + 0.14, 1, 0.8], [0.27, 0.23, 0.18]);
  }
  tube(f, 'metal', [0, 1.1, -0.6], [0, 1.3, len - 0.6], r * 1.6, r, fine(o) ? 12 : 6, dark);
  if (fine(o))
    tube(
      f,
      'metal',
      [0, 1.3, len - 0.61],
      [0, 1.3, len - 0.55],
      r * 1.12,
      r * 1.12,
      12,
      [0.08, 0.09, 0.085],
    );
}
function gates(o) {
  // East gatehouse spans the entry road; flanking crenellated bodies remain mapped.
  const f = portal(
    grounded(o, o.detail, 0),
    106.54,
    0,
    -25.61,
    -Math.PI / 2 + 0.383,
    6.12,
    8.98,
    9,
    3.8,
  );
  roof(
    f,
    [
      [-3.06, -4.49],
      [3.06, -4.49],
      [3.06, 4.49],
      [-3.06, 4.49],
    ],
    9,
    4,
  );
  for (const [id, side] of [
    [934778530, -1],
    [934778531, 1],
  ]) {
    // OSM roof parts overlap. Clip their occupied walls out of the actual central passage.
    const p = ring(id, o.detail),
      a = -Math.PI / 2 + 0.383,
      c = Math.cos(a),
      s = Math.sin(a);
    const local = p.map(([x, z]) => [
      (x - 106.54) * c - (z + 25.61) * s,
      (x - 106.54) * s + (z + 25.61) * c,
    ]);
    const plan = clip(local, 0, side * 3.06, side).map(([x, z]) => [
      106.54 + x * c + z * s,
      -25.61 - x * s + z * c,
    ]);
    hall(o, id, 0, 8, 3.8, 2, { chimneys: false, plan, roofPlan: p });
  }
  for (const id of [934778527, 934778528]) {
    const p = partRing(o, id);
    prism(grounded(o, o.detail, 0), p, 0, 5.7);
    crenels(o, p, 5.7);
  }
  if (near(o))
    for (const x of [-2.47, 2.47]) {
      const g = frame(f, 0, 0, 4.49);
      arch(g, x, 2.4, 0.8, 2.9, { slot: 'carved', color: stone.map((v) => v * 0.7) });
      // Statue niches have architectural recesses; individual figures remain a stated limitation.
      box(g, 'carved', [x - 0.45, 2.1, 0.02], [x + 0.45, 2.4, 0.4], trim);
    }
  // Argyle Tower sits above Portcullis Gate, on the route to the upper ward.
  const g = portal(
    grounded(o, o.detail, 1, 6),
    34.134126998284124,
    6,
    -42.53984363196876,
    1.0951931797477348,
    12.4,
    8.5,
    8,
    3.1,
  );
  roof(
    g,
    [
      [-6.2, -4.25],
      [6.2, -4.25],
      [6.2, 4.25],
      [-6.2, 4.25],
    ],
    8,
    5,
  );
  for (const s of [-1, 1]) {
    const h = frame(g, 0, 0, s * 4.25, s > 0 ? 0 : Math.PI);
    if (o.detail !== 'skyline') for (const x of [-2.1, 2.1]) window(h, x, 5.9, 1.1, 1.7);
  }
  if (o.detail !== 'skyline') hall(o, 53532876, 6, 4, 2, 1, { chimneys: false });
  if (o.detail !== 'skyline') hall(o, 41303926, 0, 3, 1.5, 1, { chimneys: false });
}
function buildEdinburghRuntime(out, detail) {
  const o = { ...out, detail };
  site(o);
  palace(o);
  crownSquare(o);
  lowerWards(o);
  gates(o);
}
function _originalSkyline(out) {
  buildEdinburghRuntime(out, 'skyline');
}

const grade = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0242_edinburgh_castle/site-grade.json',
      import.meta.url,
    ),
  ),
);
const means = {
  weathered: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
  sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
  carved: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
  slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
  wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
};
export function edinburghGroundY(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1, (z - g.origin[1]) / g.stepMeters)),
    i = Math.min(g.width - 2, Math.floor(u)),
    j = Math.min(g.height - 2, Math.floor(v)),
    tx = u - i,
    tz = v - j,
    at = (dx, dz) => g.heights[(j + dz) * g.width + i + dx] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - tx) + at(1, 0) * tx) * (1 - tz) + (at(0, 1) * (1 - tx) + at(1, 1) * tx) * tz
  );
}
/** Same cell diagonal as the retained regular-grid ground mesh, avoiding bilinear/faceted seams. */
export function edinburghTerrainFacetY(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1, (z - g.origin[1]) / g.stepMeters)),
    i = Math.min(g.width - 2, Math.floor(u)),
    j = Math.min(g.height - 2, Math.floor(v)),
    a = u - i,
    b = v - j,
    at = (dx, dz) => g.heights[(j + dz) * g.width + i + dx] - grade.datumMeters;
  return a + b <= 1
    ? at(0, 0) * (1 - a - b) + at(1, 0) * a + at(0, 1) * b
    : at(1, 1) * (a + b - 1) + at(1, 0) * (1 - b) + at(0, 1) * (1 - a);
}
const workingFloors = {
  41294347: 11,
  41299983: 5.1,
  934778553: 5.1,
  934778554: 5.1,
  934778552: 9.6,
  41299976: 3.8,
  41299975: 3.8,
  41299978: 3.8,
  934552936: 3.8,
  934552937: 3.8,
  934552941: 3.8,
  1361820890: 3.8,
  1361820891: 3.8,
  934552938: 3.8,
  934552939: 3.8,
  934552940: 3.8,
  934593229: 8.5,
  934593230: 8.5,
  934593231: 8.5,
  934593232: 8.5,
  934593233: 8.5,
  41299980: 4.5,
  41299984: -2.5,
  934778548: 15.3,
  934778549: 15.3,
  467503844: 9.6,
  53532866: 20.2,
  934778547: 20.2,
  305011960: 20.2,
  41299985: 21.8,
  53532876: 1,
  41303926: -1.1,
};
const defensiveFloor = (x, z) =>
  x > 75
    ? Math.max(0, (105 - x) * 0.09)
    : x > 15
      ? 7
      : x > -25
        ? z > 20
          ? 15.3
          : 10
        : x > -60
          ? 8.5
          : 3.8;
function grounded(out, detail, shift, baseY = 0) {
  return {
    detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
        name,
        (slot, ref, p, _n, uv, color) => {
          // A straight foundation edge must remain buried between its endpoints,
          // including where the sampled bare-earth surface dips below the chord.
          const toes = p.filter((v) => v[1] <= baseY + 1e-6);
          let foundationY = Infinity;
          if (toes.length === 2) {
            const [a, b] = toes,
              steps = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 2);
            for (let i = 0; i <= steps; i++) {
              const t = i / Math.max(1, steps),
                x = a[0] + (b[0] - a[0]) * t,
                z = a[2] + (b[2] - a[2]) * t;
              foundationY = Math.min(foundationY, edinburghGroundY(x, z) - 0.35);
            }
          }
          const points = p.map(([x, y, z]) => {
            const s = typeof shift === 'function' ? shift(x, z) : shift;
            return [
              x,
              y <= baseY + 1e-6
                ? Math.min(y + s - 0.35, edinburghGroundY(x, z) - 0.35, foundationY)
                : y + s,
              z,
            ];
          });
          out[name](slot, ref, points, normalFor(...points), uv, color);
        },
      ]),
    ),
  };
}

export const buildEdinburghReviewedMaster = (o) => buildEdinburghRuntime(o, 'closeup');
export const buildEdinburghReviewedCloseup = (o) => buildEdinburghRuntime(o, 'closeup');
export const buildEdinburghReviewedStreet = (o) => buildEdinburghRuntime(o, 'street');
export const buildEdinburghReviewedDistrict = (o) => buildEdinburghRuntime(o, 'district');
export function buildEdinburghReviewedSkyline(out) {
  const o = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        out[k](
          s,
          r,
          p,
          n,
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  buildEdinburghRuntime(o, 'skyline');
}

/** Tapered cylinder; explicit radii, segment count and color match this recipe's calls. */
function tube(out, slot, a, b, r0, r1, sides, color) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    other = cross(axis, across);
  const ring = (center, r) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i * 2 * Math.PI) / sides;
      return center.map((v, k) => v + r * (Math.cos(t) * across[k] + Math.sin(t) * other[k]));
    });
  loft(out, slot, [ring(a, r0), ring(b, r1)], color);
}

// Engineered paved court/battery, not a second Castle Rock landform.
const pavingOutline = [
  [44.2, 20.8],
  [62.2, 13.6],
  [66.4, 12],
  [65.4, 10.4],
  [65, 4],
  [70, -17],
  [74.5, -18.5],
  [82.4, -15.3],
  [87.6, -12.6],
  [93.2, -8],
  [96.2, -4.8],
  [98.5, -1.7],
  [99.5, 0.2],
  [100.5, 5.2],
  [100.3, 9.3],
  [98.9, 13.2],
  [96.2, 16.6],
  [87.5, 20.8],
  [78, 23],
  [75.4, 38],
  [55, 45],
];
export function edinburghPavingPerimeter(detail = 'closeup') {
  return clean(pavingOutline, detail === 'skyline' ? 2 : 0.08);
}
function paving(o) {
  const p = edinburghPavingPerimeter(o.detail),
    y = 20.2;
  cap(o, p, y, 'carved', [0.63, 0.61, 0.55]);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    let bottom = y - 0.25,
      top = y;
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
    for (let j = 0; j <= steps; j++) {
      const t = j / Math.max(1, steps);
      const ground = edinburghTerrainFacetY(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
      bottom = Math.min(bottom, ground - 0.4);
      top = Math.max(top, ground + 0.2);
    }
    const side = [
      [a[0], y, a[1]],
      [b[0], y, b[1]],
      [b[0], bottom, b[1]],
      [a[0], bottom, a[1]],
    ];
    // The court lies below some bare-earth edge samples: close that exposed
    // retaining cut toward the court, rather than leaving sky above a low cap.
    face(o, 'sandstone', side, [0.56, 0.52, 0.44]);
    if (top > y + 0.2)
      face(
        o,
        'sandstone',
        [
          [b[0], top, b[1]],
          [a[0], top, a[1]],
          [a[0], y, a[1]],
          [b[0], y, b[1]],
        ],
        [0.56, 0.52, 0.44],
      );
  }
}
/** Narrow suspended stone arch between memorial wing and palace; passage below stays open. */
function palaceLink(o) {
  const a = [67.393, 9.793],
    b = [66.734, 15.292],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    f = edgeFrame(o, a, b),
    n = o.detail === 'skyline' ? 1 : 8;
  for (let i = 0; i < n; i++) {
    const x = (i * len) / n,
      xx = ((i + 1) * len) / n,
      arch = (x) => 27.1 + 1.4 * Math.sin((Math.PI * x) / len);
    const lo = arch(x),
      hi = arch(xx),
      thick = 0.55;
    loft(
      f,
      'sandstone',
      [
        [
          [x, lo, -0.55],
          [x, lo, 0.55],
          [x, lo + thick, 0.55],
          [x, lo + thick, -0.55],
        ],
        [
          [xx, hi, -0.55],
          [xx, hi, 0.55],
          [xx, hi + thick, 0.55],
          [xx, hi + thick, -0.55],
        ],
      ],
      stone,
      { cap: false },
    );
  }
}
