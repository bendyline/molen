/** Kronborg Castle: four sandstone wings, individual copper towers and mapped bastion edges. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u3/u3b/n0244_kronborg_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.77, 0.73, 0.63],
  trim = [0.86, 0.82, 0.71],
  wood = [0.24, 0.18, 0.12],
  glass = [0.12, 0.17, 0.18];
const copper = [0.25, 0.41, 0.32],
  roofCopper = [0.33, 0.32, 0.24];
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
  if (!f) throw new Error(`Missing Kronborg map part ${id}`);
  const p = f.points.map((p) => [...p]);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let more = true;
  while (more && p.length > 3) {
    more = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (l && Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < 0.35) {
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
  {
    slot = 'copper',
    color = roofCopper,
    across = false,
    wallSlot = 'sandstone',
    wallColor = stone,
  } = {},
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

const rectangle = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const segments = (o) => (master(o) ? 48 : fine(o) ? 16 : near(o) ? 8 : 4);
function column(o, x, z, y0, y1, r, slot = 'carved', color = trim, sides = 8) {
  loft(o, slot, [radialRing(y0, r, r, sides, [x, z]), radialRing(y1, r, r, sides, [x, z])], color);
}
function molding(o, p, y, scale = 1) {
  if (o.detail === 'skyline') return;
  band(o, p, y, 0.24 * scale);
  if (fine(o)) {
    band(o, p, y - 0.32 * scale, 0.11 * scale);
    band(o, p, y + 0.2 * scale, 0.13 * scale);
  }
}
function window(o, x, y, w, h, red = false) {
  if (o.detail === 'skyline') return;
  rect(o, x, y, w, h, red ? [0.39, 0.12, 0.085] : glass, red ? 'wood' : 'glass');
  if (!near(o)) return;
  for (const xx of [x - w / 2 - 0.12, x + w / 2 + 0.12])
    line(o, [xx, y - 0.12, 0.13], [xx, y + h + 0.15, 0.13], 0.21);
  for (const yy of [y - 0.12, y + h + 0.15])
    line(o, [x - w / 2 - 0.2, yy, 0.13], [x + w / 2 + 0.2, yy, 0.13], 0.2);
  if (fine(o)) {
    line(o, [x, y, 0.13], [x, y + h, 0.13], 0.09);
    for (const yy of [y + h * 0.38, y + h * 0.71])
      line(o, [x - w / 2, yy, 0.13], [x + w / 2, yy, 0.13], 0.07);
    line(o, [x - w / 2 - 0.25, y + h + 0.35, 0.14], [x, y + h + 0.7, 0.14], 0.14);
    line(o, [x, y + h + 0.7, 0.14], [x + w / 2 + 0.25, y + h + 0.35, 0.14], 0.14);
    if (master(o))
      for (const xx of [-0.25, 0.25])
        for (let yy = y + 0.35; yy < y + h; yy += 0.45)
          line(
            o,
            [x + xx * w, yy - 0.14, 0.16],
            [x + xx * w, yy + 0.14, 0.16],
            0.035,
            'metal',
            wood,
          );
  }
}
function elevation(o, p, rows = [3, 8.8, 14.9], pitch = 5.4, skip = () => false) {
  if (o.detail === 'skyline') return;
  edges(o, p, (f, len, index) => {
    if (len < 3) return;
    const count = Math.max(1, Math.floor(len / pitch));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * len) / count;
      for (const y of rows) if (!skip(index, x, y)) window(f, x, y, 1.5, y > 12 ? 3.8 : 2.4);
    }
    for (const y of [1.1, 7.7, 13.7, 20.3])
      if (rows.at(-1) + 4 > y) molding(f, rectangle(0, -0.03, len, 0), y, 0.65);
    if (master(o)) {
      // Dressed sandstone joints are source detail, never embedded raster textures.
      for (let y = 0.55; y < rows.at(-1) + 4.5; y += 0.52)
        line(f, [0, y, 0.01], [len, y, 0.01], 0.018, 'sandstone', [0.66, 0.62, 0.54]);
      for (let y = 0.55; y < rows.at(-1) + 4; y += 1.04)
        for (let x = 1 + (Math.round(y * 100) % 2) * 0.6; x < len; x += 1.25)
          line(f, [x, y, 0.015], [x, y + 0.5, 0.015], 0.016, 'sandstone', [0.66, 0.62, 0.54]);
    }
  });
}
/** Mapped wings are separate solids: both the courtyard and north passage stay open. */
function wings(o) {
  const south = rectangle(-40.896, -23.7, -22.2, 40.1),
    west = rectangle(-22.2, -40.104, 40.896, -23.7),
    northWest = rectangle(29.2, -23.7, 40.896, -4),
    northEast = rectangle(29.2, 4, 40.896, 32.5),
    east = rectangle(-22.2, 32.5, 40.896, 40.1);
  for (const p of [south, west, northWest, northEast]) prism(o, p, 0, 20.8);
  prism(o, east, 0, 18.2);
  roof(o, south, 20.8, 9.6);
  roof(o, west, 20.8, 9.0);
  roof(o, rectangle(29.2, -23.7, 40.896, 32.5), 20.8, 7.4);
  roof(o, east, 18.2, 5.9);
  gate(frame(o, 35.05, 0, 0, Math.PI / 2), 11.7, 20.8, 8, 6.3);
  for (const p of [south, west, northWest, northEast]) elevation(o, p);
  elevation(o, east, [3, 8.3, 13.5]);
  if (!near(o)) return;
  // South-facing Renaissance gables and roof chimneys, observed in aerial references.
  for (const z of [-10, 7, 25]) dormer(frame(o, -40.92, 20.8, z, -Math.PI / 2), 4.5, 7.8);
  for (const z of [-9, 15]) dormer(frame(o, 29.16, 20.8, z, -Math.PI / 2), 3.8, 6.3);
  for (const x of [-10, 10, 29]) dormer(frame(o, x, 20.8, -40.14, Math.PI), 3.5, 6.4);
  for (const z of [-12, 9, 29]) dormer(frame(o, -22.16, 20.8, z, Math.PI / 2), 3.4, 6.7);
  for (const [x, z, y] of [
    [-32, -17, 30],
    [-32, 3, 30],
    [-32, 21, 30],
    [0, -32, 29.8],
    [22, -32, 29.8],
    [35, -13, 28.2],
    [35, 11, 28.2],
  ]) {
    box(o, 'sandstone', [x - 0.65, y - 1, z - 0.7], [x + 0.65, y + 3, z + 0.7], stone);
    box(o, 'carved', [x - 0.85, y + 2.8, z - 0.9], [x + 0.85, y + 3.15, z + 0.9], trim);
    if (fine(o))
      for (const dx of [-0.3, 0.3])
        box(
          o,
          'sandstone',
          [x + dx - 0.18, y + 3.15, z - 0.2],
          [x + dx + 0.18, y + 3.55, z + 0.2],
          stone,
        );
  }
  // Chapel occupies the mapped south-east corner; pointed stained glass at ground level.
  const chapel = frame(o, -22.15, 0, 24, Math.PI / 2);
  for (const x of [-2, 2, 5.7]) churchWindow(chapel, x, 1.6, 1.55, 5.7);
  if (fine(o)) portal(frame(o, -22.08, 0, 16, Math.PI / 2), 2.4, 4.1);
}
/** Round arch: wall pieces, soffit and open passage, rather than a black rectangle. */
function gate(o, depth, height, width, archHeight) {
  const r = width / 2,
    spring = archHeight - r,
    n = master(o) ? 20 : fine(o) ? 10 : 4;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI - (i * Math.PI) / n;
    return [r * Math.cos(t), spring + r * Math.sin(t)];
  });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    for (const z of [-depth / 2, depth / 2]) {
      const q = [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], height, z],
        [a[0], height, z],
      ];
      if (z < 0) q.reverse();
      face(o, 'sandstone', q, stone);
    }
    face(
      o,
      'sandstone',
      [
        [a[0], a[1], -depth / 2],
        [b[0], b[1], -depth / 2],
        [b[0], b[1], depth / 2],
        [a[0], a[1], depth / 2],
      ],
      stone,
    );
  }
  for (const side of [-1, 1]) {
    const q = [
      [side * r, 0, -depth / 2],
      [side * r, spring, -depth / 2],
      [side * r, spring, depth / 2],
      [side * r, 0, depth / 2],
    ];
    if (side > 0) q.reverse();
    face(o, 'sandstone', q, stone);
  }
  if (near(o))
    for (const side of [-1, 1])
      portal(frame(o, 0, 0, (side * depth) / 2, side < 0 ? Math.PI : 0), width, archHeight);
}
function portal(o, w, h) {
  const r = w / 2,
    spring = h - r,
    n = master(o) ? 24 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    line(
      o,
      [r * Math.cos(a), spring + r * Math.sin(a), 0.2],
      [r * Math.cos(b), spring + r * Math.sin(b), 0.2],
      0.28,
    );
  }
  for (const side of [-1, 1]) {
    line(o, [side * r, 0, 0.2], [side * r, spring, 0.2], 0.3);
    if (fine(o)) {
      column(o, side * (r + 0.45), 0.3, 0, h + 0.25, 0.16);
      box(
        o,
        'carved',
        [side * (r + 0.45) - 0.3, h + 0.15, 0],
        [side * (r + 0.45) + 0.3, h + 0.5, 0.6],
        trim,
      );
    }
  }
  if (fine(o)) {
    rect(o, 0, h + 0.45, w + 1.6, 0.45, trim, 'carved', 0.22);
    line(o, [-r - 0.7, h + 0.9, 0.3], [0, h + 2.1, 0.3], 0.25);
    line(o, [0, h + 2.1, 0.3], [r + 0.7, h + 0.9, 0.3], 0.25);
    // Abstract heraldic shield, not a claim to reproduce the royal figurative relief.
    face(
      o,
      'carved',
      [
        [-0.6, h + 0.95, 0.32],
        [0, h + 0.55, 0.32],
        [0.6, h + 0.95, 0.32],
        [0, h + 1.65, 0.32],
      ],
      trim,
    );
  }
}
function churchWindow(o, x, y, w, h) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h - w * 0.8],
    [x, y + h],
    [x - w / 2, y + h - w * 0.8],
  ];
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'glass',
      ix.slice(i, i + 3).map((k) => [...p[k], 0.18]),
      glass,
    );
  for (let i = 0; i < p.length; i++)
    line(o, [...p[i], 0.23], [...p[(i + 1) % p.length], 0.23], 0.16);
  if (fine(o))
    for (const dx of [-w / 6, w / 6])
      line(o, [x + dx, y, 0.24], [x + dx, y + h - w * 0.45, 0.24], 0.08);
}
/** Scrolled Renaissance roof gables with shuttered windows and finials. */
function dormer(o, w, h) {
  box(o, 'sandstone', [-w / 2, 0, -1.5], [w / 2, h * 0.52, 0.15], stone);
  const p = [
    [-w / 2, h * 0.5],
    [-w * 0.42, h * 0.63],
    [-w * 0.32, h * 0.63],
    [-w * 0.32, h * 0.76],
    [-w * 0.23, h * 0.79],
    [-w * 0.16, h * 0.92],
    [0, h],
    [w * 0.16, h * 0.92],
    [w * 0.23, h * 0.79],
    [w * 0.32, h * 0.76],
    [w * 0.32, h * 0.63],
    [w * 0.42, h * 0.63],
    [w / 2, h * 0.5],
  ];
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [...p[j], 0.2]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, 'sandstone', q, stone);
  }
  for (let i = 1; i < p.length; i++) line(o, [...p[i - 1], 0.26], [...p[i], 0.26], 0.16);
  window(frame(o, 0, 0, 0.18), 0, 0.6, w * 0.44, h * 0.32, true);
  if (fine(o)) {
    for (const side of [-1, 1]) {
      column(o, side * w * 0.43, 0.1, h * 0.51, h * 0.64, 0.11, 'carved', trim, 6);
      const n = master(o) ? 20 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 1.6) / n,
          b = ((i + 1) * Math.PI * 1.6) / n,
          r = w * 0.13;
        line(
          o,
          [side * (w * 0.37 + r * Math.cos(a)), h * 0.64 + r * Math.sin(a), 0.28],
          [side * (w * 0.37 + r * Math.cos(b)), h * 0.64 + r * Math.sin(b), 0.28],
          0.11,
        );
      }
    }
    column(o, 0, 0.05, h, h + 0.65, 0.085, 'carved', trim, 6);
  }
}
function dome(o, x, z, y, r, h, color = copper) {
  const n = segments(o),
    profile =
      o.detail === 'skyline'
        ? [
            [0, 1],
            [0.48, 0.84],
            [1, 0.06],
          ]
        : [
            [0, 1],
            [0.12, 1.07],
            [0.25, 1.02],
            [0.48, 0.84],
            [0.68, 0.57],
            [0.82, 0.28],
            [1, 0.06],
          ];
  const rings = profile.map(([t, k]) => radialRing(y + t * h, r * k, r * k, n, [x, z]));
  loft(o, 'copper', rings, color);
  if (master(o))
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      for (let j = 1; j < profile.length; j++) {
        const [t0, r0] = profile[j - 1],
          [t1, r1] = profile[j];
        beam(
          o,
          'copper',
          [x + r * r0 * Math.cos(a), y + t0 * h, z + r * r0 * Math.sin(a)],
          [x + r * r1 * Math.cos(a), y + t1 * h, z + r * r1 * Math.sin(a)],
          0.045,
          0.045,
          color.map((v) => v * 0.8),
        );
      }
    }
}
function lantern(o, x, z, y, r, h, sides = 8) {
  column(o, x, z, y, y + 0.28, r * 1.15, 'copper', copper, sides);
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / sides;
    column(
      o,
      x + r * Math.cos(a),
      z + r * Math.sin(a),
      y + 0.2,
      y + h,
      r * 0.09,
      'copper',
      copper,
      master(o) ? 8 : 4,
    );
  }
  column(o, x, z, y + h - 0.22, y + h, r * 1.17, 'copper', copper, sides);
  if (master(o))
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / sides,
        b = ((i + 1.5) * Math.PI * 2) / sides;
      beam(
        o,
        'copper',
        [x + r * Math.cos(a), y + h * 0.4, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y + h * 0.4, z + r * Math.sin(b)],
        0.065,
        0.065,
        copper,
      );
    }
}
function spire(o, x, z, y, r, top) {
  loft(
    o,
    'copper',
    [
      radialRing(y, r, r, segments(o), [x, z]),
      radialRing(top - 0.8, 0.05, 0.05, segments(o), [x, z]),
    ],
    copper,
  );
  column(o, x, z, top - 0.8, top, 0.055, 'gold', [0.75, 0.56, 0.2], 4);
  if (fine(o)) {
    const g = frame(o, x, 0, z);
    face(
      g,
      'gold',
      [
        [-0.45, top - 0.7, 0],
        [0.5, top - 0.55, 0],
        [0.35, top - 0.25, 0],
        [-0.45, top - 0.4, 0],
      ],
      [0.75, 0.56, 0.2],
    );
  }
}
function towerBody(o, x, z, r, y, h, sides = 8) {
  if (o.detail === 'skyline') sides = 4;
  column(o, x, z, y, h, r, 'sandstone', stone, sides);
  const p = radialRing(0, r, r, sides, [x, z]).map(([x, _y, z]) => [x, z]);
  if (area(p) < 0) p.reverse();
  for (const yy of [y + 1, h - 1.5, h - 0.25]) molding(o, p, yy);
  if (near(o))
    edges(o, p, (f, len) => {
      for (let yy = y + 3; yy < h - 3; yy += 6.2)
        window(f, len / 2, yy, Math.min(1.1, len * 0.38), 2);
    });
}
function trumpeter(o) {
  const x = -22.2,
    z = 2.6;
  towerBody(o, x, z, 4.5, 0, 30.5);
  column(o, x, z, 30.5, 31.3, 5.05, 'carved', trim, 8);
  if (near(o)) {
    for (let i = 0; i < (master(o) ? 48 : 16); i++) {
      const a = (i * Math.PI * 2) / (master(o) ? 48 : 16);
      column(o, x + 4.8 * Math.cos(a), z + 4.8 * Math.sin(a), 31.3, 32.3, 0.1, 'carved', trim, 4);
    }
    column(o, x, z, 32.25, 32.45, 5.05, 'carved', trim, 8);
    portal(frame(o, -17.65, 0, 2.6, Math.PI / 2), 2.8, 4.5);
  }
  dome(o, x, z, 31.3, 4.6, 7);
  lantern(o, x, z, 38.3, 1.9, 5.2, near(o) ? 8 : 4);
  dome(o, x, z, 43.5, 2.6, 3.4);
  lantern(o, x, z, 46.9, 1.05, 3.4, near(o) ? 8 : 4);
  dome(o, x, z, 50.3, 1.5, 2.6);
  spire(o, x, z, 52.9, 0.7, 59);
}
function cornerTowers(o) {
  // The Cannon/Telegraph tower is the broad, flat-topped south-west tower.
  const p = rectangle(-40.896, -40.104, -22.2, -23.7);
  prism(o, p, 0, 31.6);
  molding(o, p, 30.7, 1.5);
  elevation(o, p, [4, 11.5, 20, 26.5], 5.4);
  if (near(o))
    edges(o, p, (f, len) => {
      for (let x = 0.5; x < len; x += 1.3)
        box(f, 'carved', [x, 31.6, -0.1], [x + 0.2, 32.4, 0.2], trim);
      box(f, 'carved', [0, 32.35, -0.1], [len, 32.55, 0.2], trim);
    });
  for (const [x, z, r, h, top] of [
    [34, -33, 4.6, 29.5, 45.5],
    [37.447, 34.552, 3.3, 28.5, 41.5],
    [-33.7, 35.3, 3.5, 24.5, 37],
  ]) {
    towerBody(o, x, z, r, 18, h);
    dome(o, x, z, h, r * 1.1, 5);
    lantern(o, x, z, h + 5, r * 0.44, 3.0, near(o) ? 8 : 4);
    dome(o, x, z, h + 8, r * 0.63, 2.4);
    spire(o, x, z, h + 10.4, r * 0.24, top);
  }
  // Small courtyard stair turrets become visible from district distance.
  if (o.detail === 'skyline') return;
  for (const [x, z, h] of [
    [29.2, 20.3, 27],
    [27, -22.5, 25],
    [-22.2, -23.2, 25],
    [-22.2, 32.5, 23.5],
  ]) {
    towerBody(o, x, z, 2.05, 0, h);
    dome(o, x, z, h, 2.35, 4.5, roofCopper);
  }
}
function fortress(o) {
  const water = map.features.find((f) => f.id === 'way/89169065').points,
    shore = map.features.find((f) => f.id === 'way/92931982').points;
  let p = [...water.slice(17, 35), ...shore.slice(0, 9).toReversed(), water[16]];
  if (area(p) < 0) p = p.toReversed();
  if (o.detail !== 'skyline') prism(o, p, 0, 1.2, 'stone', [0.43, 0.43, 0.4]);
  prism(o, p, o.detail === 'skyline' ? 0 : 1.2, 4.8, 'brick', [0.53, 0.27, 0.18]);
  cap(o, p, 4.81, 'foliage', [0.31, 0.38, 0.2]);
  if (near(o)) band(o, p, 4.7, 0.28, 'stone', [0.5, 0.48, 0.41]);
  // Courtyard paving, no recreation of the removed Renaissance fountain.
  prism(o, rectangle(-22.2, -23.7, 29.2, 32.5), 4.81, 5, 'stone', [0.5, 0.49, 0.43]);
  if (master(o))
    for (let z = -22; z < 32; z += 1.5)
      beam(o, 'stone', [-22.1, 5.005, z], [29.1, 5.005, z], 0.018, 0.02, [0.41, 0.4, 0.36]);
}
export function buildKronborgRuntime(out, detail) {
  const o = { ...out, detail };
  fortress(o);
  const castle = frame(o, 0, 5, 0);
  wings(castle);
  cornerTowers(castle);
  trumpeter(castle);
  if (detail !== 'skyline')
    for (const id of [370092926, 370092927, 124356392]) {
      const p = ring(id);
      prism(castle, p, 0, 3.8, 'brick', [0.56, 0.34, 0.22]);
      roof(castle, p, 3.8, 2.7);
      elevation(castle, p, [1], 3.3);
    }
}
export function buildKronborgSkyline(out) {
  buildKronborgRuntime(out, 'skyline');
}
export const kronborgStudy = {
  id: 'N0244',
  key: 'kronborg_castle',
  title: 'Kronborg Castle',
  category: 'castle',
  wikidataId: 'Q189358',
  mapFrame: 'map-frame.json',
  build: (out) => buildKronborgRuntime(out),
  brief:
    'Four sandstone Renaissance wings around an open courtyard; distinct Trumpeter, Cannon, Kings, lighthouse and Pigeon towers, copper roofs, domed stair turrets, ornate gables, north passage and mapped bastion edges.',
  sourceFacts: {
    mapIdentity: 'Exact Q189358 relation/1588209',
    mappedFeatures: 13,
    courtyardHole: 'way/113514655',
    lighthouseAnchor: 'node/1400918158',
    trumpeterAboveCourtyardMeters: 59,
    trumpeterAboveWaterMeters: 62,
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Attributed OSM coordinates; museum plan, aerial and courtyard photographs; CBS height description.',
    courtAboveWallFootMeters: 5,
    mainEavesAboveCourtMeters: 20.8,
    cannonTowerAboveCourtMeters: 32.55,
    trumpeterAboveCourtMeters: 59,
    verticalDatum:
      'Provisional fortress wall foot. The five-meter court elevation is reconstructed; terrain fitting remains pending.',
  },
  scaleBasis:
    'Meter-scale main outer ring and courtyard from exact-QID OSM relation. Native +X points approximately north and +Z east; lighthouse node and chapel identify the signed corners.',
  refs: [
    'https://www.openstreetmap.org/relation/1588209',
    'https://kronborg.dk/en/experiences/the-castle-courtyard',
    'https://kronborg.dk/en/history-of-kronborg',
    'https://research-api.cbs.dk/ws/portalfiles/portal/58852980/Lise_Llyck.pdf',
    'https://commons.wikimedia.org/wiki/File:Kronborg_-_Schlossplan.jpg',
    'https://commons.wikimedia.org/wiki/File:KronborgCastleDenmarkOct152022_03.jpg',
    'https://commons.wikimedia.org/wiki/File:Kronborg_flygfoto_1,_2021.jpg',
    'https://commons.wikimedia.org/wiki/File:Kronborg_Courtyard_2018a.jpg',
    'https://commons.wikimedia.org/wiki/File:Kronborg_Courtyard_2018b.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Linked photographs are reference only; no third-party mesh or pixels distributed.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X approximately north',
    front: '+Z approximately east',
    origin: 'Cached OSM anchor at provisional fortress wall foot',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Signed component orientation drafted; ground datum and terrain fit pending',
    notes:
      'Lighthouse occupies mapped north-east corner. The enclosing bastion extent is not an occupied replacement footprint.',
  }),
  geographicNote:
    'Draft geographic placement; keep courtyard open, preserve source orientation, and verify vertical datum against terrain before activation.',
  limitations: [
    'Maximum fidelity remains pending. Individual exterior reconstruction uses measured horizontal map coordinates and a referenced Trumpeter height; other heights and exact facade openings are proportional estimates.',
    'Royal heraldic reliefs and figurative sculpture are represented by abstract stonework, not faithful sculptural replicas. Exact gable scrolls, clock faces, roof junctions and copper replacement patches need refinement.',
    'Fortress edges follow selected mapped moat and embankment lines. Wall height is reconstructed. Full crownwork, ravelins, coastal batteries, moat excavation and surrounding garrison buildings are outside the present source scope.',
    'Four courtyard stair turrets and corner spires require further dimension checks. The five-meter courtyard datum is provisional and must not be treated as terrain-verified.',
    'No interiors, temporary scaffolding, photographic textures or recreation of the removed Renaissance fountain. Shared sandstone, limestone, copper, granite, brick, timber, metal and local PBR glazing/turf.',
  ],
  camera: { position: [-185, 120, -180], lookAt: [0, 21, 0], fov: 43 },
  qaCameras: [
    { name: 'trumpeter-courtyard', position: [75, 57, 2.6], lookAt: [-22, 34, 2.6] },
    { name: 'cannon-tower', position: [-97, 54, -90], lookAt: [-31, 22, -32] },
    { name: 'north-entry', position: [90, 20, 0], lookAt: [35, 13, 0] },
    { name: 'lighthouse-east', position: [75, 44, 100], lookAt: [36, 31, 35] },
    { name: 'chapel-and-pigeon-tower', position: [-65, 31, 82], lookAt: [-31, 20, 31] },
    { name: 'south-renaissance-gables', position: [-100, 35, 5], lookAt: [-35, 27, 5] },
    { name: 'courtyard-north-wing', position: [-17, 24, 2], lookAt: [32, 18, 5] },
    { name: 'fortress-moat-edges', position: [-147, 70, -156], lookAt: [-25, 6, -32] },
    { name: 'four-wings-plan', position: [0, 225, 8], lookAt: [0, 0, 0] },
  ],
};
