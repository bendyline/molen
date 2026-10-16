/** Malbork Castle: mapped three-part brick complex, open courts and individual Gothic ranges. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

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
function ring(id) {
  const f = map.features.find((f) => f.id === `way/${id}`);
  if (!f) throw Error(`Missing Malbork part${id}`);
  return clean(f.points, 0.12);
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
const simple = (p, t) => clean(p, t);
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
      Math.floor(len / (low ? 9 : o.detail === 'street' ? pitch * 1.9 : pitch)),
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
  const out = o;
  o = grounded(out, out.detail, (workingFloors[id] ?? base) - base, base);
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
function roundTower(out, id, height, rise) {
  const o = grounded(out, out.detail, workingFloors[id] ?? 0);
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
    p = pointed(0, 0, opening, openingHeight, o.detail === 'street' ? 2 : near(o) ? 6 : 2).slice(
      1,
      -1,
    );
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
function highCastle(out) {
  const o = grounded(out, out.detail, 0);
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
    // Gallery runs follow the four principal courtyard corners; small mapped recesses
    // stay in the occupied body but do not create overlapping sliver-sized bays.
    const galleryCourt = polygon([
      [-14.062, 18.518],
      [-11.451, 44.215],
      [-43.003, 47.284],
      [-45.512, 21.585],
    ]);
    edges(o, galleryCourt.toReversed(), (f, len) => {
      if (len < 3) return;
      // Two open Gothic cloister levels projecting into the courtyard.
      const n = Math.max(1, Math.ceil(len / 4.1));
      for (let level = 0; level < 2; level++) {
        const y = level * 4.8;
        box(f, 'brick', [0, y, -0.15], [len, y + 0.25, 2.1], stone);
        for (let i = 0; i < n; i++) {
          const w = len / n,
            x = i * w;
          // Full-depth open bay: jambs, both spandrels and the pointed soffit.
          // The occupied range behind the gallery remains its rear wall.
          passage(frame(f, 0, y + 0.25, 0), x + w / 2, 1.05, 0, w, 2.1, 4.55, w - 0.66, 3.9);
          const arch = pointed(
            x + w / 2,
            y + 0.25,
            w - 0.66,
            3.9,
            o.detail === 'street' ? 2 : 6,
          ).slice(1, -1);
          for (let j = 1; j < arch.length; j++)
            line(f, [...arch[j - 1], 2.115], [...arch[j], 2.115], 0.16, 'carved', trim);
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
    loft(
      f,
      'stone',
      [radialRing(0, 1.1, 1.1, 16), radialRing(1, 1.1, 1.1, 16)],
      [0.45, 0.42, 0.35],
      { cap: true },
    );
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
  prism(o, keep, 22, 48.4);
  cap(o, keep, 48.4, 'brick', stone);
  crenels(o, keep, 48.4);
  // Preserve the 46 m reconstructed crown even where skyline omits individual merlons.
  if (!near(o)) prism(o, keep, 48.4, 49.5);
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
    brickCourses(o, keep, 22, 48.4);
  }

  const kc = centroid(keep);
  loft(
    o,
    'metal',
    [
      radialRing(49.4, 0.075, 0.075, o.detail === 'skyline' ? 3 : 6, kc),
      radialRing(58.5, 0.075, 0.075, o.detail === 'skyline' ? 3 : 6, kc),
    ],
    [0.34, 0.34, 0.34],
    { cap: false },
  );
  if (near(o))
    face(
      o,
      'wood',
      [
        [kc[0], 57, kc[1]],
        [kc[0] + 1.7, 56.6, kc[1]],
        [kc[0] + 1.7, 55.8, kc[1]],
        [kc[0], 56.2, kc[1]],
      ],
      [0.66, 0.23, 0.18],
    );
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
function dansker(out) {
  const o = grounded(out, out.detail, 0),
    towerOut = grounded(out, out.detail, -10.4);
  const tower = plan(o, 1395191028);
  prism(towerOut, tower, 0, 27.8);
  hip(towerOut, tower, 27.8, 8);
  facade(towerOut, tower, 27.8, { rows: 3 });
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
  if (o.detail !== 'skyline') hall(out, 62682241, 9, 2.8, { base: 5, rows: 1 });
}
function middleCastle(out) {
  const o = grounded(out, out.detail, -3.8),
    gateOut = grounded(out, out.detail, -4.7);
  const p = plan(o, 122122611),
    gateZ = 26.14;
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
  passage(gateOut, 118.0, gateZ, Math.PI / 2 - 0.0535, 51.6, 15, 16, 5.4, 6.6);
  // Gate tower is taller than the cross-range, open below its roof.
  passage(gateOut, 118, gateZ, Math.PI / 2 - 0.0535, 9.8, 15.4, 25.5, 5.4, 6.6);
  hip(
    gateOut,
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
  // Continuous narrow approach: true open Middle gate, outer portal, then covered mapped bridge.
  const roadZ = (x) =>
    x <= 126.6 ? 26.54 + (x - 125.42) * 0.05355 : 26.603 - (x - 126.6) * 0.0404;
  const roadHeight = (x) =>
    x <= 126.6
      ? -4.7
      : x <= 136.6
        ? -4.7 - (x - 126.6) * 0.05
        : -5.2 - ((Math.min(x, 159.4) - 136.6) * 1.8) / 22.8;
  for (const [xa, xb, width, slot] of [
    [107, 126.6, 4.8, 'stone'],
    [126.6, 136.6, 4.5, 'stone'],
    [136.6, 159.4, 6.2, 'wood'],
  ]) {
    const za = roadZ(xa),
      zb = roadZ(xb),
      ya = roadHeight(xa),
      yb = roadHeight(xb),
      pa = [
        [xa, ya, za - width / 2],
        [xb, yb, zb - width / 2],
        [xb, yb, zb + width / 2],
        [xa, ya, za + width / 2],
      ];
    face(out, slot, pa.toReversed(), slot === 'wood' ? wood : [0.48, 0.44, 0.36]);
    for (let i = 0; i < 4; i++) {
      const a = pa[i],
        b = pa[(i + 1) % 4];
      face(
        out,
        slot,
        [a, b, [b[0], b[1] - 0.45, b[2]], [a[0], a[1] - 0.45, a[2]]],
        slot === 'wood' ? wood : [0.48, 0.44, 0.36],
      );
    }
    if (near(o) && slot === 'wood')
      for (const sign of [-1, 1]) {
        for (let x = xa; x <= xb; x += 2.3) {
          const z = roadZ(x) + (sign * width) / 2,
            y = roadHeight(x);
          box(out, 'wood', [x - 0.06, y, z - 0.06], [x + 0.06, y + 1.15, z + 0.06], wood);
        }
        beam(
          out,
          'wood',
          [xa, ya + 1, za + (sign * width) / 2],
          [xb, yb + 1, zb + (sign * width) / 2],
          0.13,
          0.13,
          wood,
        );
      }
  }
}
function palace(out) {
  const o = grounded(out, out.detail, -9.4);
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
      hall(out, id, h, r, { rows: 1 });
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
  const go = grounded(o, o.detail, workingFloors[62144157]);
  prism(go, clip(gp, 0, 166.3, -1), 0, 20.5);
  hip(go, clip(gp, 0, 166.3, -1), 20.5, 7);
  passage(go, 171.5, 121.5, -0.08, 11.6, 6.0, 9, 4.2, 5.6);
  hip(
    go,
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
      const g = edgeFrame(
        grounded(o, o.detail, (x, z) => malborkGroundY(x, z) + 0.2),
        a,
        b,
      );
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
      passage(grounded(o, o.detail, -5.2), 135.2, 26.1, Math.PI / 2, 8.5, 3.5, 10, 4.6, 7.7);
      hip(grounded(o, o.detail, -5.2), plan(o, id), 10, 4);
    } else hall(o, id, 10, 4, { hipped: true, rows: 2 });
  }
  if (o.detail !== 'skyline') {
    passage(
      frame(grounded(o, o.detail, -7), 0, 0, 0),
      159.2,
      25.4,
      Math.PI / 2 - 0.05,
      6.9,
      0.8,
      4.8,
      4.7,
      4.6,
    );
    hall(o, 122122607, 4, 3.8, { rows: 1 });
    hall(o, 62682254, 6, 4, { rows: 1 });
    hall(o, 262053793, 5, 4, { rows: 1 });
    hall(o, 698944528, 6, 4, { rows: 1 });
    const p = plan(o, 62682249);
    const q = grounded(o, o.detail, workingFloors[62682249] - 3.8, 3.8);
    prism(q, p, 3.8, 6.2);
    roof(q, p, 6.2, 2.4);
  }
}
function buildMalborkRuntime(out, detail) {
  const o = { ...out, detail };
  highCastle(o);
  dansker(o);
  middleCastle(o);
  palace(o);
  lowerCastle(o);
  curtainWalls(o);
}
function _oldSkyline(out) {
  buildMalborkRuntime(out, 'skyline');
}

const grade = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u3/u3t/n0243_malbork_castle/site-grade.json',
      import.meta.url,
    ),
  ),
);
const workingFloors = grade.workingFloors,
  means = {
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    carved: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  };
export function malborkGroundY(x, z) {
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
              foundationY = Math.min(foundationY, malborkGroundY(x, z) - 0.35);
            }
          }
          const points = p.map(([x, y, z]) => {
            const s = typeof shift === 'function' ? shift(x, z) : shift;
            return [
              x,
              y <= baseY + 1e-6
                ? Math.min(y + s - 0.35, malborkGroundY(x, z) - 0.35, foundationY)
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

export const buildMalborkReviewedMaster = (o) => buildMalborkRuntime(o, 'closeup');
export const buildMalborkReviewedCloseup = (o) => buildMalborkRuntime(o, 'closeup');
export const buildMalborkReviewedStreet = (o) => buildMalborkRuntime(o, 'street');
export const buildMalborkReviewedDistrict = (o) => buildMalborkRuntime(o, 'district');
export function buildMalborkReviewedSkyline(out) {
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
  buildMalborkRuntime(o, 'skyline');
}
