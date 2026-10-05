/** Edinburgh Castle: individual mapped buildings, Crown Square, gates and stepped batteries. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcv/n0242_edinburgh_castle/map-parts.json',
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
function ring(id) {
  const f = map.features.find((f) => f.id === `way/${id}`);
  if (!f) throw new Error(`Missing Edinburgh map part ${id}`);
  const p = f.points.map((p) => [...p]);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let more = true;
  while (more && p.length > 4) {
    more = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (l && Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < 0.22) {
        p.splice(i, 1);
        more = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
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
function simpler(p, tolerance) {
  p = p.map((v) => [...v]);
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        len &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / len < tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function pathPoints(p, tolerance) {
  p = p.map((v) => [...v]);
  for (let i = 1; i < p.length - 1; ) {
    const a = p[i - 1],
      b = p[i],
      c = p[i + 1],
      len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (
      len &&
      Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / len < tolerance
    )
      p.splice(i, 1);
    else i++;
  }
  return p;
}
const partRing = (o, id) =>
  simpler(ring(id), o.detail === 'skyline' ? 1.6 : o.detail === 'district' ? 0.65 : 0.15);
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
    pitch = 5;
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
  const n = master(o) ? 20 : 8;
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
  // Stepped retaining plinths encode reconstructed courtyard levels, not a solid castle.
  const p = simpler(map.precinctOutline.slice(0, -1), o.detail === 'skyline' ? 5 : 1.4);
  const baseHeight = ([x]) => Math.max(0.1, Math.min(6, (105 - x) * 0.2));
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => [p[j][0], baseHeight(p[j]), p[j][1]]);
    if (normalFor(...t)[1] < 0) t.reverse();
    tri(o, 'weathered', t, [0.45, 0.44, 0.39]);
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      'weathered',
      [
        [a[0], baseHeight(a), a[1]],
        [b[0], baseHeight(b), b[1]],
        [b[0], 0, b[1]],
        [a[0], 0, a[1]],
      ],
      [0.39, 0.38, 0.33],
    );
  }
  const wall = feature(41299993).points;
  const upper = simpler(
    [
      [2, -31.7],
      [-8, -23],
      [-12, 4],
      [-4, 28],
      [15.555, 59.431],
      ...wall.slice(24),
      [68.818, -18.435],
      [46.056, -30.125],
      [35.735, -36.439],
      [16.856, -37.341],
    ],
    o.detail === 'skyline' ? 4 : 1,
  );
  prism(o, upper, 6, 17, 'weathered', [0.42, 0.41, 0.35]);
  cap(o, upper, 17.015, 'sandstone', [0.61, 0.59, 0.51]);
  if (o.detail === 'skyline') return;
  // A rising route into the upper ward at Foog's Gate; ordinary walking surface.
  face(
    o,
    'sandstone',
    [
      [-15, 6.1, 28],
      [-9, 6.1, 29],
      [-1, 17.08, 19],
      [-6, 17.08, 16],
    ],
    [0.61, 0.59, 0.51],
  );
  // External defensive walls are mapped polylines, not arbitrary enclosure boxes.
  const paths = [
    761574420, 761574421, 761574422, 41299990, 714452592, 41299993, 761574424, 761574425, 761574426,
  ];
  for (const id of paths) {
    const q = pathPoints(feature(id).points, o.detail === 'district' ? 1.5 : 0.12);
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1],
        b = q[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.25) continue;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        high = id === 761574424 || id === 761574425 || (id === 41299993 && mid[0] > 14);
      const y = high ? 17 : 6,
        f = edgeFrame(o, a, b);
      box(f, 'sandstone', [0, y - 0.3, -0.7], [len, y + 1.65, 0.7], stone);
      if (fine(o)) box(f, 'carved', [0, y + 1.5, -0.78], [len, y + 1.72, 0.78], trim);
    }
  }
  if (master(o)) {
    // Crown Square's pavement is geometry only at master resolution.
    const q = [
      [47, 21],
      [66, 14],
      [74, 36],
      [54, 43],
    ];
    cap(o, q, 17.045, 'carved', [0.58, 0.57, 0.52]);
    for (let z = 23; z < 38; z += 1.4)
      beam(o, 'sandstone', [51, 17.065, z], [67, 17.065, z], 0.035, 0.016, [0.44, 0.43, 0.38]);
  }
}
function palace(o) {
  const y = 17;
  if (o.detail === 'skyline') {
    hall(o, 290611982, y, 11, 3.7, 3, { chimneys: false });
  } else {
    // Southern palace roofs intersect in four separately mapped ranges.
    for (const id of [934778537, 934778539, 934778540, 934778541])
      hall(o, id, y, 8, 5, 3, { across: id === 934778540 || id === 934778541 });
    hall(o, 934778545, y, 11, 0, 3, { flat: true, chimneys: false });
    const p = ring(934778545);
    crenels(o, p, y + 11);
    const ch = ring(934778538);
    prism(o, ch, y + 8, y + 15);
    band(o, ch, y + 14.6, 0.35);
    // Corbelled palace bartizans and the small domed north-west turret.
    for (const id of [934778542, 934778543]) {
      const p = ring(id),
        c = centroid(p);
      loft(
        o,
        'sandstone',
        [
          radialRing(y + 8, 0.3, 0.3, 8, c),
          radialRing(y + 10, 1.25, 1.25, 8, c),
          radialRing(y + 12, 1.25, 1.25, 8, c),
        ],
        stone,
      );
      loft(
        o,
        'slate',
        [radialRing(y + 12, 1.45, 1.45, 8, c), radialRing(y + 14, 0.04, 0.04, 8, c)],
        slate,
      );
    }
    const dome = ring(934778544),
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
    for (const yy of [21, 25.5, 30, 35.8]) band(o, p, yy, 0.16);
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
function crownSquare(o) {
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
    const hp = ring(467503846),
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
    const c = centroid(ring(41299985));
    const f = frame(o, c[0] - 4, 17, c[1], -0.36);
    box(f, 'sandstone', [-0.5, 5.2, -0.25], [0.5, 7, 0.25], stone);
    arch(frame(f, 0, 0, 0.22), 0, 5.5, 0.45, 0.75, { slot: 'metal', color: [0.19, 0.19, 0.17] });
    // Reservoir railings, gun emplacements, and Mons Meg are close-view details.
    const c2 = [19, -29];
    gun(o, c2[0], 17, c2[1], Math.PI, 3.8, 0.4);
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
      gun(o, x, 17, z, a, 2.7, 0.15);
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
  if (o.detail === 'skyline') {
    hall(o, 41299992, 0, 9, 3, 2, { chimneys: false });
    hall(o, 41299987, 6, 8, 5, 2, { chimneys: false });
    return;
  }
  // East gatehouse spans the entry road; flanking crenellated bodies remain mapped.
  const f = portal(o, 106.54, 0, -25.61, -Math.PI / 2 + 0.383, 6.12, 8.98, 9, 3.8);
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
    const p = ring(id),
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
    prism(o, p, 0, 5.7);
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
  const g = portal(o, 34.4, 6, -43.5, -0.59, 8.5, 12.4, 8, 3.1);
  roof(
    g,
    [
      [-4.25, -6.2],
      [4.25, -6.2],
      [4.25, 6.2],
      [-4.25, 6.2],
    ],
    8,
    5,
  );
  for (const s of [-1, 1]) {
    const h = frame(g, 0, 0, s * 6.2, s > 0 ? 0 : Math.PI);
    for (const x of [-2.1, 2.1]) window(h, x, 5.9, 1.1, 1.7);
  }
  hall(o, 53532876, 6, 4, 2, 1, { chimneys: false });
  hall(o, 41303926, 0, 3, 1.5, 1, { chimneys: false });
}
export function buildEdinburghRuntime(out, detail) {
  const o = { ...out, detail };
  site(o);
  palace(o);
  crownSquare(o);
  lowerWards(o);
  gates(o);
}
export function buildEdinburghSkyline(out) {
  buildEdinburghRuntime(out, 'skyline');
}
export const edinburghStudy = {
  id: 'N0242',
  key: 'edinburgh_castle',
  title: 'Edinburgh Castle',
  category: 'castle',
  wikidataId: 'Q212065',
  build: (out) => buildEdinburghRuntime(out),
  brief:
    'Edinburgh Castle with stepped wards, open Crown Square and Hospital Square, Royal Palace and octagonal clock turret, Great Hall, Queen Anne range, Scottish National War Memorial, St Margaret chapel, New Barracks, Governors House, Half Moon and Argyle batteries, and open gate passages.',
  sourceFacts: {
    mapIdentity: 'OSM way/4301292, exact Q212065 precinct',
    mapComponents: map.features.length,
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Individual OSM component polygons and height tags, illustrated plan and inspected exterior photographs.',
    lowerWardDatumMeters: 6,
    upperWardDatumMeters: 17,
    palaceClockTopMeters: 37,
    flagpoleTopMeters: 49,
  },
  scaleBasis:
    'OSM footprints in meters; cached exact-identity precinct frame. Relative levels, roofs and opening dimensions are reconstructed, not a terrain survey.',
  refs: [
    'https://www.openstreetmap.org/way/4301292',
    'https://www.edinburghcastle.scot/media/fpanlfr2/orientation-map.pdf',
    'https://www.edinburghcastle.scot/see-and-do/highlights/the-royal-palace/',
    'https://www.edinburghcastle.scot/see-and-do/highlights/half-moon-battery/',
    'https://commons.wikimedia.org/wiki/File:Edinburgh_Castle_plan_coloured.png',
    'https://commons.wikimedia.org/wiki/File:Edinburgh_Castle_from_the_south_east.JPG',
    'https://commons.wikimedia.org/wiki/File:Façade_of_the_Scottish_National_War_Memorial,_Edinburgh_Castle,_Scotland,_UK.jpg',
  ],
  sourceDocuments: ['map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Reference photos linked only; no copied image textures or external meshes.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X toward the eastern entrance/esplanade',
    front: '+Z toward the southern palace and barracks exterior',
    origin: 'Cached exact-identity precinct center, provisional gate-level datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Mapped component frame; terrain datum, signed orientation and geographic visual fit pending',
    notes:
      'The whole precinct includes courts and batteries, not a single building footprint. Do not erase all map buildings based on the enclosing polygon.',
  }),
  geographicNote:
    'Draft placement; relative terrace levels and site terrain must be checked before geographic activation.',
  limitations: [
    'Maximum fidelity is pending. Courtyard elevations, heights, roof junctions, opening positions, and gatehouse fit are reconstructed rather than surveyed.',
    'Master includes architectural niches, stonework, window frames, guns and crenellations; statues, memorial carvings, heraldic shields and inscriptions are not faithful sculptural reproductions.',
    'Castle Rock is represented only by provisional stepped retaining plinths. No claim of terrain fit, exact geology, interiors, trees or temporary esplanade installations.',
    'The palace turret clock is static. Dormers, precisely stepped gables, decorative ridge pieces, Foogs Gate and individual roof details still need close-reference refinement.',
    'Shared sandstone, raw limestone, weathered limestone, slate, ceramic chimney pots, timber and painted metal; PBR glazing. No embedded images.',
  ],
  camera: { position: [200, 140, 195], lookAt: [5, 16, 0], fov: 42 },
  qaCameras: [
    { name: 'palace-clock-crown-square', position: [50, 29, 33], lookAt: [74, 28, 26] },
    { name: 'great-hall-and-queen-anne', position: [62, 34, 20], lookAt: [49, 24, 48] },
    { name: 'memorial-crown-square', position: [56, 27, 39], lookAt: [46, 24, 10] },
    { name: 'half-moon-battery-palace', position: [150, 56, 32], lookAt: [74, 24, 10] },
    { name: 'east-gatehouse-passage', position: [150, 9, -43], lookAt: [106.5, 5, -25.6] },
    { name: 'argyle-tower-and-chapel', position: [58, 37, -80], lookAt: [23, 19, -29] },
    { name: 'hospital-square', position: [-86, 30, -14], lookAt: [-93, 14, -32] },
    { name: 'barracks-south-exterior', position: [-60, 40, 125], lookAt: [-33, 18, 43] },
    { name: 'open-courts-and-roof-plan', position: [0, 230, 80], lookAt: [0, 8, 0] },
  ],
};
