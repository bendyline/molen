/** Malbork Castle: mapped three-part brick complex, open courts and individual Gothic ranges. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u3/u3t/n0243_malbork_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.62, 0.29, 0.19],
  trim = [0.76, 0.64, 0.49],
  wood = [0.24, 0.18, 0.12],
  glass = [0.12, 0.17, 0.18];
const tile = [0.72, 0.31, 0.16];
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
  if (!f) throw new Error(`Missing Malbork map part ${id}`);
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
function prism(o, p, y0, y1, slot = 'brick', color = stone) {
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
  { slot = 'tile', color = tile, across = false, wallSlot = 'brick', wallColor = stone } = {},
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
function simple(p, tolerance = 0.8) {
  p = p.map((v) => [...v]);
  for (let pass = 0; pass < 200; pass++) {
    const index = p.findIndex((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length];
      const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        d > 0 &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / d < tolerance
      );
    });
    if (index < 0 || p.length <= 4) break;
    p.splice(index, 1);
  }
  return area(p) < 0 ? p.reverse() : p;
}
const plan = (o, id) => simple(ring(id), near(o) ? 0.4 : 1.1);
const polygon = (p) => (area(p) < 0 ? p.toReversed() : p);
function ringBody(o, p, hole, y, h) {
  const vertices = [...p, ...hole],
    indices = earcut(vertices.flat(), [p.length]);
  for (let i = 0; i < indices.length; i += 3) {
    const q = indices.slice(i, i + 3).map((j) => [vertices[j][0], h, vertices[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, 'brick', q, stone);
  }
  for (const boundary of [polygon(p), polygon(hole).toReversed()])
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i],
        b = boundary[(i + 1) % boundary.length];
      face(
        o,
        'brick',
        [
          [a[0], h, a[1]],
          [b[0], h, b[1]],
          [b[0], y, b[1]],
          [a[0], y, a[1]],
        ],
        stone,
      );
    }
}
function pointed(x, y, w, h, segments = 6) {
  const spring = y + h - w * 0.8660254037844386,
    r = w;
  const p = [
    [x - w / 2, y],
    [x - w / 2, spring],
  ];
  for (let i = 1; i <= segments; i++) {
    const a = Math.PI - (i * Math.PI) / 3 / segments;
    p.push([x + w / 2 + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  for (let i = 1; i <= segments; i++) {
    const a = Math.PI / 3 - (i * Math.PI) / 3 / segments;
    p.push([x - w / 2 + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  p.push([x + w / 2, y]);
  return p;
}
function gothic(o, x, y, w, h, { blind = false, pale = false, paired = false } = {}) {
  const color = blind ? stone.map((v) => v * 0.83) : glass,
    slot = blind ? 'brick' : 'glass';
  if (o.detail === 'district') {
    rect(o, x, y, w, h * 0.8, color, slot);
    return;
  }
  const p = pointed(x, y, w, h, master(o) ? 8 : o.detail === 'street' ? 2 : 3);
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [...p[j], 0.055]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, color);
  }
  if (fine(o)) {
    for (let i = 1; i < p.length; i++)
      line(
        o,
        [...p[i - 1], 0.1],
        [...p[i], 0.1],
        pale ? 0.16 : 0.13,
        pale ? 'carved' : 'brick',
        pale ? trim : stone.map((v) => v * 1.12),
      );
    line(
      o,
      [x - w / 2 - 0.12, y - 0.13, 0.09],
      [x + w / 2 + 0.12, y - 0.13, 0.09],
      0.16,
      'carved',
      trim,
    );
    if (paired && !blind) {
      line(o, [x, y, 0.12], [x, y + h * 0.81, 0.12], 0.095, 'carved', trim);
      for (const yy of [y + h * 0.36, y + h * 0.62])
        line(o, [x - w / 2, yy, 0.12], [x + w / 2, yy, 0.12], 0.07, 'metal', wood);
      const r = w * 0.18,
        cy = y + h * 0.81,
        n = master(o) ? 12 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n;
        line(
          o,
          [x + r * Math.cos(a), cy + r * Math.sin(a), 0.12],
          [x + r * Math.cos(b), cy + r * Math.sin(b), 0.12],
          0.075,
          'carved',
          trim,
        );
      }
    }
  }
}
function brickCourses(o, p, y, h) {
  if (!master(o)) return;
  edges(o, p, (f, len) => {
    for (let yy = y + 0.3, row = 0; yy < h - 0.2; yy += 0.31, row++) {
      rect(f, len / 2, yy, len, 0.012, [0.4, 0.26, 0.2], 'brick', 0.013);
      // Repeating bond is carried by the shared brick graph in runtime LODs.
      if (row % 4 === 0)
        for (let x = 0.31 + (row % 2) * 0.33; x < len - 0.12; x += 3.3)
          rect(f, x, yy - 0.29, 0.01, 0.29, [0.42, 0.27, 0.2], 'brick', 0.014);
    }
  });
}
function facade(o, p, h, { rows = 2, pitch = 4.8, church = false, palace = false, base = 0 } = {}) {
  if (o.detail === 'skyline') return;
  const low = o.detail === 'district';
  edges(o, p, (f, len) => {
    if (len < 3) return;
    const count = Math.max(
      1,
      Math.floor(len / (low ? 9 : o.detail === 'street' ? pitch * 1.25 : pitch)),
    );
    for (let row = 0; row < (low ? 1 : rows); row++)
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * len) / count,
          yy = base + 1.7 + (row * (h - base - 3)) / (rows + 0.2);
        gothic(f, x, yy, church ? 1.6 : palace ? 1.55 : 1.0, church ? 5.4 : palace ? 3.6 : 2.35, {
          pale: palace,
          paired: church || palace,
        });
      }
    if (near(o) && len > 7) {
      for (let i = 0; i <= count; i++) {
        const x = (i * len) / count;
        if (church) {
          box(f, 'brick', [x - 0.45, base, -0.1], [x + 0.45, h - 2, 1.0], stone);
          face(
            f,
            'tile',
            [
              [x - 0.48, h - 1.7, -0.15],
              [x + 0.48, h - 1.7, -0.15],
              [x + 0.48, h - 2.4, 1.05],
              [x - 0.48, h - 2.4, 1.05],
            ],
            tile,
          );
        }
      }
    }
  });
  if (near(o))
    band(
      o,
      p,
      h - 0.35,
      0.22,
      'brick',
      stone.map((v) => v * 1.08),
    );
  brickCourses(o, p, base, h);
}
function hip(o, p, y, rise) {
  const f = fit(p),
    long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
    along = long,
    across = 1 - long;
  const lo = f.lo,
    hi = f.hi,
    half = (hi[across] - lo[across]) / 2;
  const corners = [
    [lo[0], lo[1]],
    [hi[0], lo[1]],
    [hi[0], hi[1]],
    [lo[0], hi[1]],
  ];
  const r0 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2],
    r1 = [...r0];
  r0[along] = lo[along] + Math.min(half, (hi[along] - lo[along]) * 0.44);
  r1[along] = hi[along] - Math.min(half, (hi[along] - lo[along]) * 0.44);
  const world = (p, h) => [p[0] * f.u[0] + p[1] * f.v[0], h, p[0] * f.u[1] + p[1] * f.v[1]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4],
      nearA = Math.abs(a[along] - r0[along]) < Math.abs(a[along] - r1[along]) ? r0 : r1,
      nearB = Math.abs(b[along] - r0[along]) < Math.abs(b[along] - r1[along]) ? r0 : r1;
    const q = [world(a, y), world(b, y), world(nearB, y + rise)];
    if (nearA !== nearB) q.push(world(nearA, y + rise));
    if (normalFor(...q)[1] < 0) q.reverse();
    if (q.length === 3) tri(o, 'tile', q, tile);
    else face(o, 'tile', q, tile);
  }
  if (fine(o))
    beam(o, 'tile', world(r0, y + rise + 0.06), world(r1, y + rise + 0.06), 0.18, 0.16, tile);
}
function hall(
  o,
  id,
  h,
  rise,
  { hipped = false, church = false, rows = 2, footprint, base = 0 } = {},
) {
  const p = footprint ?? plan(o, id);
  prism(o, p, base, h);
  if (hipped) hip(o, p, h, rise);
  else roof(o, p, h, rise);
  facade(o, p, h, { rows, church, base });
  if (near(o) && rise > 3) {
    const f = fit(p),
      k = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
      c = [(f.lo[0] + f.hi[0]) / 2, (f.lo[1] + f.hi[1]) / 2];
    const count = Math.max(1, Math.round((f.hi[k] - f.lo[k]) / 19));
    for (let i = 0; i < count; i++) {
      c[k] = f.lo[k] + ((f.hi[k] - f.lo[k]) * (i + 0.5)) / count;
      const x = c[0] * f.u[0] + c[1] * f.v[0],
        z = c[0] * f.u[1] + c[1] * f.v[1];
      box(
        o,
        'brick',
        [x - 0.45, h + rise - 0.7, z - 0.4],
        [x + 0.45, h + rise + 1.9, z + 0.4],
        stone,
      );
      box(
        o,
        'carved',
        [x - 0.53, h + rise + 1.6, z - 0.48],
        [x + 0.53, h + rise + 1.9, z + 0.48],
        trim,
      );
    }
  }
}
function crenels(o, p, y) {
  if (!near(o)) return;
  edges(o, p, (f, len) => {
    const count = Math.max(2, Math.round(len / 2.3));
    for (let i = 0; i < count; i++)
      box(
        f,
        'brick',
        [(i * len) / count, y, -0.42],
        [((i + 0.5) * len) / count, y + 1.1, 0.05],
        stone,
      );
  });
}
function roundTower(o, id, height, rise) {
  const p = plan(o, id),
    c = centroid(p),
    rx = (Math.max(...p.map((p) => p[0])) - Math.min(...p.map((p) => p[0]))) / 2,
    rz = (Math.max(...p.map((p) => p[1])) - Math.min(...p.map((p) => p[1]))) / 2;
  const n = master(o) ? 40 : fine(o) ? 20 : near(o) ? 12 : o.detail === 'skyline' ? 6 : 8;
  const body = [radialRing(0, rx, rz, n, c), radialRing(height, rx, rz, n, c)];
  loft(o, 'brick', body, stone, true);
  // A tiny flat apex avoids zero-area cone faces while retaining a pointed tile roof.
  loft(
    o,
    'tile',
    [radialRing(height, rx + 0.2, rz + 0.2, n, c), radialRing(height + rise, 0.04, 0.04, n, c)],
    tile,
    true,
  );
  if (near(o)) {
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 6))) {
      const a = (i * Math.PI * 2) / n;
      const f = frame(o, c[0] + rx * Math.cos(a), 0, c[1] + rz * Math.sin(a), Math.PI / 2 - a);
      for (const y of [height * 0.35, height * 0.68]) gothic(f, 0, y, 0.55, 1.4);
    }
    const lip = radialRing(height - 0.4, rx + 0.1, rz + 0.1, n, c).map((p) => [p[0], p[2]]);
    band(o, lip, height - 0.4, 0.22, 'brick', stone);
  }
}
/** Pointed passage: open soffit and spandrels, never a solid wall behind a door decal. */
function passage(o, x, z, angle, width, depth, height, opening = 4.5, openingHeight = 6) {
  const f = frame(o, x, 0, z, angle),
    r = opening / 2,
    p = pointed(0, 0, opening, openingHeight, near(o) ? 6 : 2).slice(1, -1);
  box(f, 'brick', [-width / 2, 0, -depth / 2], [-r, height, depth / 2], stone);
  box(f, 'brick', [r, 0, -depth / 2], [width / 2, height, depth / 2], stone);
  box(f, 'brick', [-r, openingHeight, -depth / 2], [r, height, depth / 2], stone);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i];
    for (const side of [-1, 1]) {
      const q = [
        [a[0], a[1], (side * depth) / 2],
        [b[0], b[1], (side * depth) / 2],
        [b[0], openingHeight, (side * depth) / 2],
        [a[0], openingHeight, (side * depth) / 2],
      ];
      if (side < 0) q.reverse();
      for (let j = 1; j < 3; j++)
        if (Math.hypot(...normalFor(q[0], q[j], q[j + 1])) > 0.1)
          tri(f, 'brick', [q[0], q[j], q[j + 1]], stone);
    }
    face(
      f,
      'carved',
      [
        [a[0], a[1], -depth / 2],
        [b[0], b[1], -depth / 2],
        [b[0], b[1], depth / 2],
        [a[0], a[1], depth / 2],
      ],
      trim,
    );
  }
  for (const sign of [-1, 1])
    face(
      f,
      'brick',
      [
        [sign * r, 0, -depth / 2],
        [sign * r, p[0][1], -depth / 2],
        [sign * r, p[0][1], depth / 2],
        [sign * r, 0, depth / 2],
      ],
      stone,
    );
}
function highCastle(o) {
  // The OSM High Castle polygon includes the detached Dansker and its diagonal passage.
  // Keep those separate from the main ring, and preserve the actual inner courtyard hole.
  const outer = polygon([
    [-59.864, 11.237],
    [-57.445, 8.537],
    [-0.417, 3.717],
    [7.126, 69.73],
    [28.063, 74.911],
    [-10.316, 76.388],
    [-10.405, 55.813],
    [-56.021, 60.496],
  ]);
  const court = simple(ring(62682245), 1.0);
  ringBody(o, outer, court, 0, 22);
  const wings = [
    polygon([
      [-59.864, 11.237],
      [-45.512, 21.585],
      [-43.003, 47.284],
      [-56.021, 60.496],
    ]),
    polygon([
      [-57.445, 8.537],
      [-0.417, 3.717],
      [-14.062, 18.518],
      [-45.512, 21.585],
    ]),
    polygon([
      [-56.021, 60.496],
      [-43.003, 47.284],
      [-11.451, 44.215],
      [-10.405, 55.813],
    ]),
    polygon([
      [-14.062, 18.518],
      [-0.417, 3.717],
      [7.126, 69.73],
      [-10.316, 76.388],
      [-11.451, 44.215],
    ]),
  ];
  for (const p of wings) roof(o, p, 22, 11.5);
  facade(o, outer, 22, { rows: 3, pitch: 5.8 });
  if (near(o)) {
    edges(o, court.toReversed(), (f, len) => {
      if (len < 3) return;
      // Two open Gothic cloister levels projecting into the courtyard.
      const n = Math.max(1, Math.ceil(len / 4.1));
      for (let level = 0; level < 2; level++) {
        const y = level * 4.8;
        box(f, 'brick', [0, y, -0.15], [len, y + 0.25, 2.1], stone);
        for (let i = 0; i < n; i++) {
          const w = len / n,
            x = i * w;
          box(f, 'brick', [x, y, 0], [x + 0.33, y + 4.4, 1.95], stone);
          const arch = pointed(x + w / 2 + 0.12, y + 0.3, w - 0.6, 3.9, master(o) ? 7 : 3).slice(
            1,
            -1,
          );
          for (let j = 1; j < arch.length; j++) {
            const a = arch[j - 1],
              b = arch[j];
            const q = [
              [a[0], a[1], 2.04],
              [b[0], b[1], 2.04],
              [b[0], y + 4.5, 2.04],
              [a[0], y + 4.5, 2.04],
            ];
            if (normalFor(...q)[2] < 0) q.reverse();
            face(f, 'brick', q, stone);
            line(f, [...a, 2.07], [...b, 2.07], 0.16, 'carved', trim);
          }
        }
      }
      face(
        f,
        'tile',
        [
          [0, 10.7, -0.15],
          [len, 10.7, -0.15],
          [len, 9.5, 2.3],
          [0, 9.5, 2.3],
        ],
        tile,
      );
      for (let x = 2; x < len; x += 4.6) gothic(f, x, 13, 1.8, 4.6, { paired: true });
    });
    // Courtyard well canopy, not a filled courtyard platform.
    const c = centroid(ring(1395191026)),
      f = frame(o, c[0], 0, c[1]);
    tube(f, 'stone', [0, 0, 0], [0, 1, 0], 1.1, 1.1, 16, [0.45, 0.42, 0.35]);
    for (const x of [-1.55, 1.55])
      for (const z of [-1.55, 1.55])
        box(f, 'wood', [x - 0.1, 0, z - 0.1], [x + 0.1, 3.5, z + 0.1], wood);
    hip(
      f,
      [
        [-1.9, -1.9],
        [1.9, -1.9],
        [1.9, 1.9],
        [-1.9, 1.9],
      ],
      3.5,
      2.2,
    );
  }
  const keep = plan(o, 698944532);
  prism(o, keep, 22, 44.9);
  cap(o, keep, 44.9, 'brick', stone);
  crenels(o, keep, 44.9);
  // Preserve the 46 m reconstructed crown even where skyline omits individual merlons.
  if (!near(o)) prism(o, keep, 44.9, 46);
  if (near(o)) {
    for (const y of [24, 29, 35, 41])
      band(
        o,
        keep,
        y,
        0.24,
        'brick',
        stone.map((v) => v * 0.82),
      );
    edges(o, keep, (f, len) => {
      for (const y of [25, 30.5, 36.3, 41.8])
        for (const x of [len * 0.28, len * 0.72])
          gothic(f, x, y, 0.9, y > 40 ? 1.1 : 3, { blind: y === 25 });
    });
    brickCourses(o, keep, 22, 44.9);
  }
  // Eastern church termination and Klesza tower have independent mapped outlines.
  if (o.detail !== 'skyline') hall(o, 698944531, 19, 8, { rows: 3 });
  if (near(o)) {
    const f = frame(o, 0, 0, 73.7, 0);
    for (const x of [-6.5, 0, 6.5]) {
      box(f, 'brick', [x - 0.45, 0, 0], [x + 0.45, 24, 1.5], stone);
      box(f, 'brick', [x - 0.22, 24, 0.5], [x + 0.22, 29, 1], stone);
    }
    gothic(f, 0, 11, 3.7, 9, { paired: true, pale: true });
    // Recess reserved for the Madonna mosaic: no invented figurative sculpture.
    gothic(f, 0, 2.8, 3.8, 6.2, { blind: true });
  }
  if (o.detail !== 'skyline')
    for (const id of [1395191039, 1395191040, 1395191027]) {
      const p = plan(o, id);
      prism(o, p, 20, 29);
      crenels(o, p, 29);
    }
}
function dansker(o) {
  const tower = plan(o, 1395191028);
  prism(o, tower, 0, 21);
  hip(o, tower, 21, 8);
  facade(o, tower, 21, { rows: 3 });
  const a = [-59.4, 9.8],
    b = [-89.5, -18],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    f = edgeFrame(o, a, b);
  box(f, 'brick', [0, 12, -1.9], [len, 17, 1.9], stone);
  roof(
    f,
    [
      [0, -2.3],
      [len, -2.3],
      [len, 2.3],
      [0, 2.3],
    ],
    17,
    3.6,
  );
  const n = o.detail === 'skyline' ? 2 : 4;
  for (let i = 0; i <= n; i++)
    box(f, 'brick', [(i * len) / n - 0.65, 0, -1.7], [(i * len) / n + 0.65, 12, 1.7], stone);
  if (near(o))
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * len) / n;
      for (const sign of [-1, 1]) {
        const side = frame(f, x, 0, sign * 1.93, sign < 0 ? Math.PI : 0);
        gothic(side, 0, 13, 1.0, 2.4);
      }
      // Brick arches below the raised gallery remain open between the piers.
      const ps = pointed(x, 0, len / n - 1.3, 11.8, master(o) ? 8 : 3).slice(1, -1);
      for (let j = 1; j < ps.length; j++)
        for (const sign of [-1, 1]) {
          const a = ps[j - 1],
            b = ps[j],
            q = [
              [a[0], a[1], sign * 1.7],
              [b[0], b[1], sign * 1.7],
              [b[0], 12, sign * 1.7],
              [a[0], 12, sign * 1.7],
            ];
          if (sign < 0) q.reverse();
          face(f, 'brick', q, stone);
        }
    }
  if (o.detail !== 'skyline') hall(o, 62682241, 9, 2.8, { base: 5, rows: 1 });
}
function middleCastle(o) {
  const p = plan(o, 122122611),
    gateZ = 25.6;
  // Clip the northern cross-range around its real through-passage.
  const west = clip(p, 1, -3.8, -1),
    east = clip(p, 1, 47.8, 1);
  const north = polygon([
    [110.8, -3.8],
    [126.4, -3.8],
    [125.4, 47.8],
    [111.3, 47.8],
  ]);
  prism(o, west, 0, 16);
  roof(o, west, 16, 14);
  prism(o, east, 0, 16);
  roof(o, east, 16, 14);
  for (const q of [clip(north, 1, gateZ - 2.7, -1), clip(north, 1, gateZ + 2.7, 1)])
    prism(o, q, 0, 16);
  roof(o, north, 16, 14);
  passage(o, 118.0, gateZ, Math.PI / 2, 51.6, 15, 16, 5.4, 6.6);
  // Gate tower is taller than the cross-range, open below its roof.
  passage(o, 118, gateZ, Math.PI / 2, 9.8, 15.4, 25.5, 5.4, 6.6);
  hip(
    o,
    [
      [110.2, 20.5],
      [125.8, 20.5],
      [125.8, 30.7],
      [110.2, 30.7],
    ],
    25.5,
    9.6,
  );
  facade(o, west, 16, { rows: 2 });
  facade(o, east, 16, { rows: 2 });
  if (near(o)) {
    for (const x of [110.1, 126.0]) {
      const f = frame(o, x, 0, gateZ, x < 118 ? -Math.PI / 2 : Math.PI / 2);
      for (const y of [8, 13.5, 19, 23]) for (const u of [-2.5, 2.5]) gothic(f, u, y, 0.7, 1.8);
    }
    // North range courtyard fenestration excludes the entry opening.
    const f = frame(o, 110.2, 0, 0, -Math.PI / 2);
    for (let z = -2; z < 48; z += 5.7)
      if (Math.abs(z - gateZ) > 6) for (const y of [2, 7.2, 12.6]) gothic(f, z, y, 0.95, 2.1);
    // Eastern range repetitive buttresses and high Gothic window row.
    const a = [39.2, 72.6],
      b = [122.1, 60.1],
      f2 = edgeFrame(o, b, a),
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let u = 2; u < len; u += 6.8) {
      box(f2, 'brick', [u - 0.35, 0, -0.05], [u + 0.35, 14, 1.1], stone);
      gothic(f2, u + 2.6, 6, 1.5, 5, { paired: true });
    }
    for (const xx of [60, 78, 96, 117])
      box(o, 'brick', [xx - 0.45, 28, -14], [xx + 0.45, 32.2, -13.2], stone);
  }
  // Timber entrance bridge across the northern moat.
  const bridge = polygon([
    [136.6, 22.9],
    [159.0, 21.9],
    [159.4, 28.8],
    [137.0, 30.1],
  ]);
  prism(o, bridge, 2.9, 3.35, 'wood', wood);
  if (near(o))
    edges(o, bridge, (f, len) => {
      if (len < 10) return;
      for (let x = 0; x < len; x += 2.3)
        box(f, 'wood', [x, 3.35, -0.1], [x + 0.13, 4.5, 0.1], wood);
      box(f, 'wood', [0, 4.3, -0.1], [len, 4.48, 0.1], wood);
    });
}
function palace(o) {
  const p = plan(o, 261512837);
  prism(o, p, 0, 21.5);
  hip(o, p, 21.5, 12.5);
  facade(o, p, 21.5, { rows: 3, palace: true, pitch: 4.5 });
  if (near(o)) {
    edges(o, p, (f, len) => {
      if (len < 10) return;
      const count = Math.max(2, Math.round(len / 4.8));
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * len) / count;
        box(f, 'brick', [x - 0.34, 0, -0.02], [x + 0.34, 20.7, 1.3], stone);
        gothic(f, x, 18.2, 0.75, 1.8, { blind: true, pale: true });
        // High continuous pale clerestory band between vertical piers.
        if (i < count - 1) gothic(f, x + len / count / 2, 19.7, 1.05, 1.0, { pale: true });
      }
    });
    for (const c of [
      [29.5, -48.3],
      [45.3, -48.5],
    ]) {
      const p = [
        [c[0] - 1.4, c[1] - 1.4],
        [c[0] + 1.4, c[1] - 1.4],
        [c[0] + 1.4, c[1] + 1.4],
        [c[0] - 1.4, c[1] + 1.4],
      ];
      prism(o, p, 16, 23.2);
      hip(o, p, 23.2, 4.5);
    }
  }
  if (o.detail !== 'skyline')
    for (const [id, h, r] of [
      [261513978, 5, 5],
      [261514073, 4, 3],
      [698944522, 7, 5],
      [1112143806, 6, 3],
    ])
      hall(o, id, h, r, { rows: 1 });
}
function lowerCastle(o) {
  for (const [id, h, r, church] of [
    [62144160, 13, 11, false],
    [261513898, 11, 9, true],
    [101914542, 10, 9, false],
    [261513528, 10, 9, false],
    [101915237, 8, 7, false],
  ])
    hall(o, id, h, r, { church, rows: 2 });
  roundTower(o, 261512932, 23, 5.8);
  for (const [id, h, r] of [
    [122122609, 14, 6],
    [122123493, 13, 6],
    [122123503, 15, 7],
  ]) {
    if (id === 122123503) roundTower(o, id, h, r);
    else hall(o, id, h, r, { hipped: true, rows: 3 });
  }
  // Snycerska gate has a taller north-west chamber and lower entry on its eastern side.
  const gp = plan(o, 62144157);
  prism(o, clip(gp, 0, 166.3, -1), 0, 20.5);
  hip(o, clip(gp, 0, 166.3, -1), 20.5, 7);
  passage(o, 171.5, 121.5, -0.08, 11.6, 6.0, 9, 4.2, 5.6);
  hip(
    o,
    [
      [166, 118],
      [177.5, 117.4],
      [178, 124.6],
      [166.5, 125.5],
    ],
    9,
    4.5,
  );
  if (o.detail !== 'skyline') {
    for (const [id, h, r] of [
      [62682246, 8, 6],
      [62682251, 4.5, 4],
      [122122605, 5, 4],
      [122122604, 4, 3],
      [122122612, 4.5, 4],
      [261512865, 5, 3],
      [261512960, 6, 4],
      [261513127, 7, 6],
      [261513654, 5, 4],
      [261513946, 5, 4],
    ])
      hall(o, id, h, r, { rows: 1 });
    for (const [id, h, r] of [
      [432786363, 10, 4],
      [432786364, 14, 6],
    ])
      hall(o, id, h, r, { hipped: true, rows: 2 });
  }
  // Step gables and shallow buttresses distinguish the long Karwan armoury.
  if (near(o)) {
    const p = plan(o, 62144160),
      f = fit(p),
      long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
      axis = 1 - long;
    const world = (a, b) => {
      const q = [];
      q[long] = a;
      q[axis] = b;
      return [q[0] * f.u[0] + q[1] * f.v[0], q[0] * f.u[1] + q[1] * f.v[1]];
    };
    for (const end of [f.lo[long], f.hi[long]]) {
      const a = world(end, f.lo[axis]),
        b = world(end, f.hi[axis]),
        g = edgeFrame(o, a, b),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 0; i <= 8; i++) {
        const x = (i * len) / 8,
          h = 13 + 11 * (1 - Math.abs(x - len / 2) / (len / 2));
        box(g, 'brick', [x - 0.24, h - 0.6, -0.25], [x + 0.24, h + 1, 0.25], stone);
        if (fine(o) && i > 0 && i < 8)
          gothic(g, x, 14, Math.min(1.2, len / 12), Math.max(1, h - 15), { blind: true });
      }
    }
  }
}
function curtainWalls(o) {
  for (const f of map.features) {
    if (f.tags.barrier !== 'city_wall' || f.id === 'way/700531007') continue;
    if (o.detail === 'skyline') continue;
    let p = f.points;
    // Preserve bends while removing redundant survey points from distant walls.
    if (!near(o)) p = p.filter((_, i) => i === 0 || i === p.length - 1 || i % 3 === 0);
    const h = Number(f.tags.height) || 5.5;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.4) continue;
      const g = edgeFrame(o, a, b);
      box(g, 'brick', [0, 0, -0.48], [len, h, 0.48], stone);
      if (near(o)) {
        face(
          g,
          'tile',
          [
            [0, h + 0.4, 0],
            [len, h + 0.4, 0],
            [len, h, 0.7],
            [0, h, 0.7],
          ],
          tile,
        );
        face(
          g,
          'tile',
          [
            [0, h, -0.7],
            [len, h, -0.7],
            [len, h + 0.4, 0],
            [0, h + 0.4, 0],
          ],
          tile,
        );
        if (fine(o))
          for (let x = 2; x < len; x += 4.2) {
            const s = frame(g, x, 0, 0.49);
            gothic(s, 0, h - 2, 0.25, 0.9);
          }
      }
    }
  }
  for (const id of [122122616, 122122623]) roundTower(o, id, 12, 6);
  for (const id of [433294384, 433294386, 698944529, 699998152]) {
    if (o.detail === 'skyline') continue;
    if (id === 433294386) {
      passage(o, 135.2, 26.1, Math.PI / 2, 8.5, 3.5, 10, 4.6, 7.7);
      hip(o, plan(o, id), 10, 4);
    } else hall(o, id, 10, 4, { hipped: true, rows: 2 });
  }
  if (o.detail !== 'skyline') {
    passage(frame(o, 0, 3.3, 0), 159.2, 25.4, Math.PI / 2 - 0.05, 6.9, 0.8, 4.8, 4.7, 4.6);
    hall(o, 122122607, 4, 3.8, { rows: 1 });
    hall(o, 62682254, 6, 4, { rows: 1 });
    hall(o, 262053793, 5, 4, { rows: 1 });
    hall(o, 698944528, 6, 4, { rows: 1 });
    const p = plan(o, 62682249);
    prism(o, p, 3.8, 6.2);
    roof(o, p, 6.2, 2.4);
  }
}
export function buildMalborkRuntime(out, detail) {
  const o = { ...out, detail };
  highCastle(o);
  dansker(o);
  middleCastle(o);
  palace(o);
  lowerCastle(o);
  curtainWalls(o);
}
export function buildMalborkSkyline(out) {
  buildMalborkRuntime(out, 'skyline');
}
export const malborkStudy = {
  id: 'N0243',
  key: 'malbork_castle',
  title: 'Malbork Castle',
  category: 'castle',
  wikidataId: 'Q71279',
  mapFrame: 'map-frame.json',
  build: (out) => buildMalborkRuntime(out),
  brief:
    'Three-part brick Gothic Malbork: High Castle with an open cloister court, crenellated keep and church; elevated Dansker passage; U-shaped Middle Castle with an open gate, Grand Masters Palace; Lower Castle armoury, St Lawrence chapel, service ranges and named defensive towers.',
  sourceFacts: {
    mapIdentity:
      'Exact Q71279 relation/6436433; individual Lower Castle buildings extend beyond that relation',
    mappedFeatures: 103,
    highCastleCourtHole: 'way/62682245 in building relation/975353',
    surveyedVerticalDimensions: false,
    ownerTowerDescription:
      'The ticket site describes nearly 70 m; datum is unspecified and requires reconciliation with ground-relative reconstruction.',
  },
  reconstruction: {
    basis:
      'OSM individual building and wall coordinates plus inspected river, courtyard, main tower, palace and ground-plan references.',
    highCastleEavesMeters: 22,
    highCastleRoofMeters: 33.5,
    keepCrownMeters: 46,
    middleCastleEavesMeters: 16,
    grandMastersPalaceRoofMeters: 34,
    buttermilkTowerTopMeters: 28.8,
    verticalDatum: 'Provisional common local ground; castle terraces and moat depth not surveyed.',
  },
  scaleBasis:
    'Meter-scale attributed OSM components. Native +X runs from High Castle toward the northern Lower Castle; +Z points toward the eastern curtain. Full component envelope is never a solid replacement footprint.',
  refs: [
    'https://www.openstreetmap.org/relation/6436433',
    'https://zamek.malbork.pl/en/home/visit/history-of-the-castle/',
    'https://bilety.zamek.malbork.pl/trasy-zwiedzania.html',
    'https://commons.wikimedia.org/wiki/File:Malbork_zamek_zblizenie.jpg',
    'https://commons.wikimedia.org/wiki/File:Malbork_-_Zamek_Średni_-_Dziedziniec.JPG',
    'https://commons.wikimedia.org/wiki/File:Zamek_wysoki_wieza_glowna.jpg',
    'https://commons.wikimedia.org/wiki/File:Malbork_Castle_Exterior_1.jpg',
    'https://commons.wikimedia.org/wiki/File:Malborg_plan_przyziemia_zamku.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Photographs linked for reference; no photographic textures or third-party meshes copied.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X from High Castle toward Lower Castle',
    front: '+Z toward eastern fortifications',
    origin: 'Cached exact-QID map anchor at provisional local ground',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Component coordinates and signed orientation drafted; terrain and geographic fit pending',
    notes:
      'The source frame includes named Lower Castle components beyond the OSM main-precinct relation. Open courts, moat gaps and tower intervals must stay open.',
  }),
  geographicNote:
    'Draft geographic placement only. Site elevations, the tower datum and eastern fortifications require additional verification; no footprint replacement.',
  limitations: [
    'Maximum fidelity pending: this is an individual exterior reconstruction, not a surveyed as-built model. Vertical dimensions, irregular roof junctions and exact fenestration require further comparison.',
    'The museum ticket site describes the tower as nearly 70 m without a datum. The current 46 m ground-relative keep is provisional; do not treat it as a verified measured height.',
    'The church Madonna mosaic and figurative sculpture are not reproduced. Their recess is preserved. Exact tracery, gate decoration, decorative gables and rooftop dormers need further work.',
    'Lower Castle is represented by selected existing mapped structures and eastern walls; ruins, archaeological foundations, contemporary ticket facilities and complete outer earthworks are not included.',
    'No interiors, moat excavation, landscape, temporary works or photographic textures. The High Castle courtyard and Middle Castle court remain open.',
    'Shared brick, ceramic tile, timber, limestone, granite and painted-metal surfaces; local PBR glazing. Fine brick bonds and roof seams stay in the source master.',
  ],
  camera: { position: [-205, 170, -335], lookAt: [75, 12, 15], fov: 43 },
  qaCameras: [
    { name: 'high-castle-cloister', position: [-31, 14, 31], lookAt: [-10, 14, 35] },
    { name: 'high-castle-and-dansker', position: [-165, 68, -105], lookAt: [-39, 15, 14] },
    { name: 'middle-castle-courtyard', position: [17, 38, 29], lookAt: [115, 15, 23] },
    { name: 'grand-masters-palace', position: [-20, 29, -97], lookAt: [39, 16, -27] },
    { name: 'church-and-keep', position: [10, 50, 143], lookAt: [-10, 24, 48] },
    { name: 'north-gate-and-bridge', position: [176, 24, 50], lookAt: [115, 12, 25] },
    { name: 'lower-castle-karwan', position: [266, 36, 174], lookAt: [228, 13, 98] },
    { name: 'lower-castle-ranges', position: [336, 120, -168], lookAt: [267, 10, 2] },
    { name: 'all-three-castles-plan', position: [160, 470, 90], lookAt: [160, 0, 38] },
  ],
};
