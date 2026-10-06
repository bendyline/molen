/** Hofburg Palace: individually mapped wings, open courts and authored imperial facades. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2e/n0245_hofburg_palace/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.79, 0.76, 0.66],
  trim = [0.86, 0.82, 0.71],
  wood = [0.24, 0.18, 0.12],
  glass = [0.12, 0.17, 0.18];
const copper = [0.25, 0.41, 0.32];
const master = (o) => !o.detail,
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  near = (o) => o.detail !== 'skyline' && o.detail !== 'district';
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) => {
  const q = p.map((p) => p.map(Math.fround)),
    a = q[1].map((v, j) => v - q[0][j]),
    b = q[2].map((v, j) => v - q[0][j]);
  if (
    Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
    1e-5
  )
    return;
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
};
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
const cream = [0.83, 0.8, 0.66],
  redRoof = [0.35, 0.27, 0.2];
const inside = (p, r) => {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
};
function clean(points, tolerance = 0.35) {
  const p = points.map((p) => [...p]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        l &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < tolerance &&
        Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) <
          l + tolerance * 2
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
const feature = (id) => map.features.find((f) => f.id === `way/${id}`);
function rings(id, o) {
  const tol =
    o.detail === 'skyline' ? 9 : o.detail === 'district' ? 3 : o.detail === 'street' ? 1.2 : 0.4;
  const outer = clean(feature(id).points, tol);
  const relation = map.buildingRelations.find((r) => r.outer.includes(`way/${id}`));
  const holes =
    relation?.holes ??
    map.buildingRelations[0].holes.filter((id) => {
      const pts = map.features.find((f) => f.id === id).points;
      const c = pts.reduce((s, p) => s.map((v, j) => v + p[j] / pts.length), [0, 0]);
      return inside(c, outer);
    });
  return [
    outer,
    ...holes
      .map((id) => clean(map.features.find((f) => f.id === id).points, tol))
      .filter((r) => Math.abs(area(r)) > (o.detail === 'skyline' ? 300 : 8)),
  ];
}
function edges(o, p, fn) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.05) fn(edgeFrame(o, b, a), len, i, b, a);
  }
}
function allEdges(o, rs, fn) {
  for (const [j, r] of rs.entries()) edges(o, j ? r.toReversed() : r, fn);
}
function triangles(rs) {
  const p = rs.flat(),
    holes = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  return Array.from({ length: ix.length / 3 }, (_, i) =>
    ix.slice(i * 3, i * 3 + 3).map((j) => p[j]),
  );
}
function cap(o, rs, y, slot, color) {
  for (const t of triangles(rs)) {
    const q = t.map(([x, z]) => [x, y, z]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, color);
  }
}
function arcPoints(x, y, r, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI - (i * Math.PI) / n;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
}
function openingWall(o, len, y0, y1, slot, color, cut) {
  if (!cut || cut.x + cut.w / 2 < 0 || cut.x - cut.w / 2 > len) {
    rect(o, len / 2, y0, len, y1 - y0, color, slot, 0);
    return;
  }
  const l = Math.max(0, cut.x - cut.w / 2),
    r = Math.min(len, cut.x + cut.w / 2),
    spring = cut.h - cut.w / 2;
  if (l > 0) rect(o, l / 2, y0, l, y1 - y0, color, slot, 0);
  if (r < len) rect(o, (r + len) / 2, y0, len - r, y1 - y0, color, slot, 0);
  const n = o.detail === 'skyline' ? 2 : o.detail === 'district' ? 4 : master(o) ? 16 : 8;
  const a = Array.from({ length: n + 1 }, (_, i) => {
    const x = l + ((r - l) * i) / n;
    return [x, spring + Math.sqrt(Math.max(0, (cut.w / 2) ** 2 - (x - cut.x) ** 2))];
  });
  for (let i = 1; i < a.length; i++) {
    const p = a[i - 1],
      q = a[i];
    face(
      o,
      slot,
      [
        [p[0], p[1], 0],
        [q[0], q[1], 0],
        [q[0], y1, 0],
        [p[0], y1, 0],
      ],
      color,
    );
    if (near(o))
      face(
        o,
        slot,
        [
          [p[0], p[1], -0.8],
          [q[0], q[1], -0.8],
          [q[0], q[1], 0],
          [p[0], p[1], 0],
        ],
        trim,
      );
  }
}
const passage = { x: 145, z: 0, half: 3.7, depth: 48 };
function passageCut(a, b, style) {
  if (!['michaeler', 'chancery'].includes(style)) return;
  const n = [Math.SQRT1_2, -Math.SQRT1_2],
    u = [Math.SQRT1_2, Math.SQRT1_2],
    da = (a[0] - passage.x) * n[0] + (a[1] - passage.z) * n[1],
    db = (b[0] - passage.x) * n[0] + (b[1] - passage.z) * n[1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (
    Math.min(da, db) > passage.half ||
    Math.max(da, db) < -passage.half ||
    Math.abs(db - da) / len < 0.2
  )
    return;
  const d = ((a[0] + b[0]) / 2 - passage.x) * u[0] + ((a[1] + b[1]) / 2 - passage.z) * u[1];
  if (Math.abs(d) > passage.depth) return;
  return { x: (-da / (db - da)) * len, w: (2 * passage.half * len) / Math.abs(db - da), h: 9 };
}
function prism(o, rs, y0, y1, slot = 'limestone', color = stone, style = '', top = true) {
  if (top) cap(o, rs, y1, slot, color);
  allEdges(o, rs, (f, len, _i, a, b) =>
    openingWall(f, len, y0, y1, slot, color, passageCut(a, b, style)),
  );
}
function column(o, x, z, y0, y1, r, slot = 'carved', color = trim, sides = 8) {
  loft(o, slot, [radialRing(y0, r, r, sides, [x, z]), radialRing(y1, r, r, sides, [x, z])], color);
}
function minRect(p) {
  let best;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!l) continue;
    const u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l],
      v = [-u[1], u[0]],
      q = p.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * v[0] + p[1] * v[1]]),
      lo = [0, 1].map((j) => Math.min(...q.map((p) => p[j]))),
      hi = [0, 1].map((j) => Math.max(...q.map((p) => p[j]))),
      score = (hi[0] - lo[0]) * (hi[1] - lo[1]);
    if (!best || score < best.score) best = { u, v, lo, hi, score };
  }
  return best;
}
/** Continuous hip field sampled in a shared horizontal grid; court holes remain empty. */
function roof(o, rs, y, rise, slot = 'tile', color = redRoof) {
  const boundary = rs.flatMap((r) => r.map((a, i) => [a, r[(i + 1) % r.length]]));
  const height = (p) =>
    y +
    Math.min(
      rise,
      Math.min(
        ...boundary.map(([a, b]) => {
          const dx = b[0] - a[0],
            dz = b[1] - a[1],
            d = dx * dx + dz * dz,
            t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d));
          return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) * 1.3;
        }),
      ),
    );
  const clip = (p, axis, v, sign) => {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        da = sign * (a[axis] - v),
        db = sign * (b[axis] - v);
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push(a.map((v, j) => v + t * (b[j] - v)));
      }
    }
    return out;
  };
  const step = o.detail === 'district' ? 30 : o.detail === 'street' ? 18 : master(o) ? 2 : 12;
  for (const t of triangles(rs)) {
    const lo = [0, 1].map((j) => Math.floor(Math.min(...t.map((p) => p[j])) / step)),
      hi = [0, 1].map((j) => Math.ceil(Math.max(...t.map((p) => p[j])) / step));
    for (let x = lo[0]; x < hi[0]; x++)
      for (let z = lo[1]; z < hi[1]; z++) {
        let ps = t;
        for (const [axis, v, sign] of [
          [0, x * step, 1],
          [0, (x + 1) * step, -1],
          [1, z * step, 1],
          [1, (z + 1) * step, -1],
        ]) {
          ps = clip(ps, axis, v, sign);
          if (ps.length < 3) break;
        }
        for (let i = 1; i < ps.length - 1; i++) {
          const q = [ps[0], ps[i], ps[i + 1]].map(([x, z]) => [x, height([x, z]), z]);
          if (Math.hypot(...normalFor(...q)) < 0.1) continue;
          if (normalFor(...q)[1] < 0) q.reverse();
          tri(o, slot, q, color);
        }
      }
  }
}
function archWindow(o, x, y, w, h, slot = 'glass', color = glass) {
  if (o.detail === 'district') {
    rect(o, x, y, w, h, color, slot);
    return;
  }
  const r = w / 2,
    spring = y + h - r,
    ps = [
      [x - r, y, 0.055],
      [x + r, y, 0.055],
      ...arcPoints(x, spring, r, master(o) ? 18 : fine(o) ? 8 : 3)
        .toReversed()
        .map(([x, y]) => [x, y, 0.055]),
    ];
  for (let i = 1; i < ps.length - 1; i++) tri(o, slot, [ps[0], ps[i], ps[i + 1]], color);
  if (fine(o)) {
    line(o, [x - r - 0.12, y, 0.16], [x - r - 0.12, spring, 0.16], 0.2);
    line(o, [x + r + 0.12, y, 0.16], [x + r + 0.12, spring, 0.16], 0.2);
    const a = arcPoints(x, spring, r + 0.12, master(o) ? 24 : 8);
    for (let i = 1; i < a.length; i++) line(o, [...a[i - 1], 0.16], [...a[i], 0.16], 0.24);
  }
  if (fine(o)) {
    line(o, [x, y, 0.2], [x, y + h, 0.2], 0.08, 'wood', wood);
    line(o, [x - r, y + h * 0.4, 0.2], [x + r, y + h * 0.4, 0.2], 0.09, 'wood', wood);
  }
}
function window(o, x, y, w, h, ornate = false) {
  rect(o, x, y, w, h);
  if (!fine(o)) return;
  for (const xx of [x - w / 2 - 0.13, x + w / 2 + 0.13])
    line(o, [xx, y - 0.15, 0.15], [xx, y + h + 0.15, 0.15], 0.2);
  for (const yy of [y - 0.15, y + h + 0.15])
    line(o, [x - w / 2 - 0.3, yy, 0.18], [x + w / 2 + 0.3, yy, 0.18], 0.24);
  if (fine(o)) {
    line(o, [x, y, 0.19], [x, y + h, 0.19], 0.09, 'wood', wood);
    for (let yy = y + h / (master(o) ? 3 : 1); yy < y + h - 0.1; yy += h / (master(o) ? 3 : 1))
      line(o, [x - w / 2, yy, 0.19], [x + w / 2, yy, 0.19], 0.085, 'wood', wood);
    if (ornate) {
      line(o, [x - w / 2 - 0.3, y + h + 0.55, 0.2], [x, y + h + 1.15, 0.2], 0.2);
      line(o, [x, y + h + 1.15, 0.2], [x + w / 2 + 0.3, y + h + 0.55, 0.2], 0.2);
    }
  }
  if (master(o)) {
    box(o, 'carved', [x - w / 2 - 0.2, y - 0.3, -0.06], [x + w / 2 + 0.2, y - 0.1, 0.4], trim);
    if (ornate)
      for (const dx of [-w * 0.4, w * 0.4])
        box(
          o,
          'carved',
          [x + dx - 0.13, y + h + 0.2, 0.05],
          [x + dx + 0.13, y + h + 0.65, 0.3],
          trim,
        );
  }
}
function cornice(o, rs, y) {
  if (o.detail === 'skyline' || o.detail === 'district') return;
  for (const r of rs) band(o, r, y, 0.4);
  if (fine(o)) for (const r of rs) band(o, r, y - 0.5, 0.18);
}
function balustrade(o, rs, y) {
  if (!near(o)) return;
  allEdges(o, rs, (f, len) => {
    if (len < 2) return;
    line(f, [0, y + 1.2, 0.1], [len, y + 1.2, 0.1], 0.24);
    if (master(o))
      for (let x = 0.5; x < len; x += 1.4) {
        column(f, x, 0, y, y + 1.1, 0.13, 'carved', trim, 6);
        column(f, x, 0, y + 0.32, y + 0.75, 0.23, 'carved', trim, 6);
      }
  });
}
function facade(o, rs, eaves, style) {
  if (o.detail === 'skyline') return;
  const imperial = ['neue', 'michaeler', 'chancery', 'library'].includes(style);
  const floors =
    o.detail === 'district' ? [13] : style === 'neue' ? [2, 14, 23] : [1.7, 8.5, 16, 22];
  allEdges(o, rs, (f, len, _i, a, b) => {
    if (len < 3.5) return;
    const pitch = o.detail === 'district' ? 10 : imperial ? 5.8 : 5.1,
      n = Math.max(1, Math.floor(len / pitch));
    const cut = passageCut(a, b, style);
    for (let i = 0; i < n; i++) {
      const x = (len * (i + 0.5)) / n;
      for (const yy of floors) {
        if (yy + 3 > eaves) continue;
        if (cut && Math.abs(x - cut.x) < cut.w * 0.65 && yy < cut.h) continue;
        if ((style === 'neue' && yy === 2) || (style === 'michaeler' && yy === 8.5))
          archWindow(f, x, yy, Math.min(2.9, (len / n) * 0.55), style === 'neue' ? 6.7 : 6.4);
        else
          window(
            f,
            x,
            yy,
            Math.min(2.3, (len / n) * 0.52),
            yy > 20 ? 1.8 : 3.9,
            imperial && yy === 8.5,
          );
      }
      if (near(o) && imperial) {
        const xx = (len * i) / n;
        if (xx < 0.4) continue;
        const bottom = style === 'neue' ? 12 : 10,
          top = Math.min(eaves - 1, 24.3);
        if (top > bottom) {
          if (master(o)) {
            box(f, 'carved', [xx - 0.45, bottom, -0.05], [xx + 0.45, top, 0.48], trim);
            box(f, 'carved', [xx - 0.68, top - 0.8, -0.1], [xx + 0.68, top + 0.1, 0.7], trim);
            box(f, 'carved', [xx - 0.63, bottom, -0.1], [xx + 0.63, bottom + 0.5, 0.68], trim);
          } else rect(f, xx, bottom, 0.7, top - bottom, trim, 'carved', 0.08);
        }
      }
    }
    if (master(o)) {
      for (let yy = 0.55; yy < Math.min(eaves, 9); yy += 0.75) {
        const draw = (a, b) => {
          if (b - a > 0.01)
            line(f, [a, yy, 0.04], [b, yy, 0.04], 0.055, 'carved', [0.56, 0.55, 0.48]);
        };
        if (cut && yy < cut.h) {
          const r = cut.w / 2,
            spring = cut.h - r,
            half = yy <= spring ? r : Math.sqrt(Math.max(0, r * r - (yy - spring) ** 2));
          draw(0, Math.max(0, cut.x - half));
          draw(Math.min(len, cut.x + half), len);
        } else draw(0, len);
      }
      if (['leopold', 'amalien', 'stallburg'].includes(style) && len > 12)
        for (let x = 4; x < len - 3; x += 8.5) {
          box(f, 'plaster', [x - 0.55, eaves + 2.4, -4], [x + 0.55, eaves + 7, -2.8], cream);
          box(f, 'carved', [x - 0.7, eaves + 6.6, -4.15], [x + 0.7, eaves + 7.15, -2.65], trim);
        }
    }
  });
  for (const y of o.detail === 'street' ? [eaves] : [eaves, imperial ? 11 : 7.1]) cornice(o, rs, y);
  if (imperial) balustrade(o, rs, eaves + 0.15);
}
const wings = [
  // Outlines and named courtyards are from the attributed OSM snapshot.
  [293340885, 23, 8, 'amalien', 'plaster', 'tile'],
  [293340843, 20, 11, 'leopold', 'plaster', 'tile'],
  [293340881, 24, 7, 'chancery', 'limestone', 'tile'],
  [293340892, 25, 6, 'michaeler', 'limestone', 'copper'],
  [293340846, 23, 8, 'swiss', 'plaster', 'tile'],
  [293340852, 24, 7, 'riding', 'plaster', 'tile'],
  [93659168, 23, 8, 'stallburg', 'plaster', 'tile'],
  [293340845, 24, 7, 'redouten', 'plaster', 'tile'],
  [293340835, 24, 7, 'festsaal', 'plaster', 'tile'],
  [293340836, 26, 5, 'library', 'limestone', 'copper'],
  [293340834, 24, 7, 'augustiner', 'plaster', 'tile'],
  [293340833, 24, 7, 'monastery', 'plaster', 'tile'],
  [1212887960, 24, 7, 'monastery', 'plaster', 'tile'],
  [293340860, 22, 6, 'monastery', 'plaster', 'tile'],
  [293340844, 23, 6, 'albertina', 'plaster', 'copper'],
  [293340869, 31, 3.5, 'neue', 'limestone', 'copper'],
  [293340857, 31, 4.5, 'corps', 'limestone', 'copper'],
];
function palaceWings(o) {
  for (const [id, eaves, rise, style, wall, roofSlot] of wings) {
    const rs = rings(id, o);
    prism(o, rs, 0, eaves, wall, wall === 'plaster' ? cream : stone, style, o.detail !== 'skyline');
    if (o.detail === 'skyline')
      prism(o, rs, eaves, eaves + rise * 0.45, roofSlot, roofSlot === 'tile' ? redRoof : copper);
    else roof(o, rs, eaves, rise, roofSlot, roofSlot === 'tile' ? redRoof : copper);
    facade(o, rs, eaves, style);
  }
}
function dome(o, id, base, rise, finial = 0) {
  const r = clean(feature(id).points, 0.25),
    xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    x = (Math.max(...xs) + Math.min(...xs)) / 2,
    z = (Math.max(...zs) + Math.min(...zs)) / 2,
    rx = (Math.max(...xs) - Math.min(...xs)) / 2,
    rz = (Math.max(...zs) - Math.min(...zs)) / 2;
  const sides = o.detail === 'skyline' ? 4 : o.detail === 'district' ? 6 : master(o) ? 64 : 16,
    steps = o.detail === 'skyline' ? 2 : o.detail === 'district' ? 3 : master(o) ? 20 : 8;
  const lower = base - (id === 1022701010 ? 9 : 3.4);
  loft(
    o,
    'carved',
    [radialRing(lower, rx, rz, sides, [x, z]), radialRing(base, rx, rz, sides, [x, z])],
    trim,
  );
  const dr = Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((i / steps) * Math.PI) / 2;
    return radialRing(
      base + Math.sin(a) * rise,
      Math.max(0.04, rx * Math.cos(a)),
      Math.max(0.04, rz * Math.cos(a)),
      sides,
      [x, z],
    );
  });
  loft(o, 'copper', dr, copper);
  if (near(o)) {
    for (let i = 0; i < (master(o) ? 12 : fine(o) ? 6 : 0); i++) {
      const a = (i / (master(o) ? 12 : 6)) * Math.PI * 2;
      let prev;
      for (let j = 0; j <= steps; j++) {
        const v = ((j / steps) * Math.PI) / 2,
          p = [
            x + (rx + 0.065) * Math.cos(v) * Math.cos(a),
            base + Math.sin(v) * rise,
            z + (rz + 0.065) * Math.cos(v) * Math.sin(a),
          ];
        if (prev) beam(o, 'gold', prev, p, 0.07, 0.07, [0.73, 0.56, 0.21]);
        prev = p;
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        nx = Math.cos(a) / rx,
        nz = Math.sin(a) / rz,
        angle = Math.atan2(nx, nz),
        f = frame(
          o,
          x + rx * Math.cos(a) + Math.sin(angle) * 0.15,
          0,
          z + rz * Math.sin(a) + Math.cos(angle) * 0.15,
          angle,
        );
      archWindow(
        f,
        0,
        lower + 0.5,
        Math.min(1.7, (Math.PI * (rx + rz)) / 32),
        Math.max(1.5, base - lower - 1),
      );
    }
    column(o, x, z, base - 0.45, base, Math.max(rx, rz) * 1.01, 'gold', [0.73, 0.56, 0.21], sides);
  }
  if (finial) {
    column(
      o,
      x,
      z,
      base + rise,
      base + rise + finial,
      0.2,
      'gold',
      [0.73, 0.56, 0.21],
      o.detail === 'skyline' ? 4 : 8,
    );
    if (fine(o))
      column(o, x, z, base + rise + 0.2, base + rise + 0.65, 0.48, 'gold', [0.73, 0.56, 0.21], 8);
  }
}
function amalienClock(o) {
  const x = 180.2,
    z = -112,
    sides = o.detail === 'skyline' ? 4 : 8;
  column(o, x, z, 25, 31, 2.65, 'copper', [0.22, 0.32, 0.28], sides);
  const onion = (y, r, h) =>
    loft(
      o,
      'copper',
      [
        [y, r * 0.65],
        [y + h * 0.18, r],
        [y + h * 0.45, r * 1.08],
        [y + h * 0.78, r * 0.6],
        [y + h, r * 0.18],
      ].map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
      copper,
    );
  onion(31, 3.05, 3);
  column(o, x, z, 34, 37, 1.55, 'copper', copper, sides);
  onion(37, 1.9, 2);
  column(o, x, z, 39, 40.1, 0.13, 'gold', [0.75, 0.58, 0.25], 4);
  if (!near(o)) return;
  // The clock faces the Inner Burghof, toward the south-east (+Z, -X).
  const f = frame(o, x - 5.7, 0, z + 5.7, -Math.PI / 4);
  rect(f, 0, 23.2, 5, 5.4, trim, 'carved', 0.18);
  const n = master(o) ? 64 : 24,
    ps = Array.from({ length: n }, (_, i) => [
      1.75 * Math.cos((i / n) * Math.PI * 2),
      26.25 + 1.75 * Math.sin((i / n) * Math.PI * 2),
      0.23,
    ]);
  for (let i = 0; i < n; i++)
    tri(f, 'carved', [[0, 26.25, 0.23], ps[i], ps[(i + 1) % n]], [0.95, 0.92, 0.78]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    line(
      f,
      [1.35 * Math.sin(a), 26.25 + 1.35 * Math.cos(a), 0.25],
      [1.62 * Math.sin(a), 26.25 + 1.62 * Math.cos(a), 0.25],
      0.1,
      'metal',
      [0.16, 0.18, 0.16],
    );
  }
  line(f, [0, 26.25, 0.28], [0, 27.55, 0.28], 0.12, 'metal', [0.12, 0.13, 0.12]);
  line(f, [0, 26.25, 0.28], [-0.85, 26.8, 0.28], 0.16, 'metal', [0.12, 0.13, 0.12]);
  rect(f, 0, 18.4, 3.7, 3.9, [0.75, 0.65, 0.38], 'carved', 0.21);
  if (fine(o))
    for (let i = -4; i <= 4; i++)
      line(f, [0, 22, 0.27], [i * 0.4, 18.5, 0.27], 0.04, 'metal', [0.23, 0.23, 0.19]);
}
function church(o) {
  const rs = rings(116758234, o);
  prism(o, rs, 0, 22.5, 'plaster', cream);
  if (o.detail === 'skyline') prism(o, rs, 22.5, 30, 'slate', [0.27, 0.29, 0.27]);
  else roof(o, rs, 22.5, 11, 'slate', [0.3, 0.31, 0.29]);
  if (near(o))
    allEdges(o, rs, (f, len) => {
      if (len < 9) return;
      const n = Math.floor(len / 7);
      for (let i = 0; i < n; i++) {
        const x = (len * (i + 0.5)) / n;
        archWindow(f, x, 8, 2.5, 10);
        if (master(o)) box(f, 'carved', [x - 3.4, 0, -0.1], [x - 2.4, 19, 1.3], trim);
      }
    });
  const tower = rings(1023577649, o);
  prism(o, tower, 0, 48, 'plaster', cream);
  const r = tower[0],
    x = (Math.min(...r.map((p) => p[0])) + Math.max(...r.map((p) => p[0]))) / 2,
    z = (Math.min(...r.map((p) => p[1])) + Math.max(...r.map((p) => p[1]))) / 2;
  const sides = o.detail === 'skyline' ? 4 : 8;
  loft(
    o,
    'slate',
    [radialRing(48, 3.35, 3.35, sides, [x, z]), radialRing(65.8, 0.05, 0.05, sides, [x, z])],
    [0.26, 0.31, 0.29],
  );
  column(o, x, z, 65.7, 66, 0.07, 'metal', [0.28, 0.29, 0.25], 4);
  if (near(o)) {
    cornice(o, tower, 47);
    allEdges(o, tower, (f, len) => archWindow(f, len / 2, 38, Math.min(2.4, len * 0.5), 6.5));
  }
}
function palmHouse(o) {
  const rs = rings(28798683, o);
  prism(o, rs, 0, 3.2, 'stone', [0.55, 0.54, 0.43]);
  const f = minRect(rs[0]),
    long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
    axis = 1 - long,
    half = (f.hi[axis] - f.lo[axis]) / 2,
    mid = (f.hi[axis] + f.lo[axis]) / 2;
  const world = (u, v, y) => {
    const p = long === 0 ? [u, v] : [v, u];
    return [p[0] * f.u[0] + p[1] * f.v[0], y, p[0] * f.u[1] + p[1] * f.v[1]];
  };
  // Long barrel conservatory with a taller central cross pavilion.
  if (o.detail === 'skyline') {
    prism(o, rs, 3.2, 10, 'glass', [0.24, 0.4, 0.32]);
    return;
  }
  const n = master(o) ? 24 : fine(o) ? 10 : 6;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI,
      b = ((j + 1) / n) * Math.PI;
    const v = (ang) => mid + half * Math.cos(ang),
      y = (ang) => 4 + 6.5 * Math.sin(ang);
    face(
      o,
      'glass',
      [
        world(f.lo[long], v(a), y(a)),
        world(f.hi[long], v(a), y(a)),
        world(f.hi[long], v(b), y(b)),
        world(f.lo[long], v(b), y(b)),
      ],
      [0.22, 0.38, 0.3],
    );
  }
  allEdges(o, rs, (f, len) => rect(f, len / 2, 3.2, len, 2.4, [0.22, 0.38, 0.3], 'glass', 0.01));
  if (near(o))
    for (let u = f.lo[long] + 1; u < f.hi[long]; u += master(o) ? 1.4 : fine(o) ? 4 : 12) {
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI,
          b = ((j + 1) / n) * Math.PI;
        beam(
          o,
          'metal',
          world(u, mid + half * Math.cos(a), 4.08 + 6.5 * Math.sin(a)),
          world(u, mid + half * Math.cos(b), 4.08 + 6.5 * Math.sin(b)),
          0.09,
          0.09,
          [0.27, 0.44, 0.35],
        );
      }
    }
}
function neuePavilions(o) {
  for (const [id, eaves, rise] of [
    [1041903648, 38.5, 3.5],
    [1105055547, 31.5, 4],
    [1105055548, 31.5, 3.5],
    [1105055549, 32, 3],
  ]) {
    if (o.detail === 'skyline' && id !== 1041903648) continue;
    const rs = rings(id, o);
    prism(o, rs, 30, eaves, 'limestone', stone);
    if (o.detail === 'skyline') prism(o, rs, eaves, eaves + rise * 0.5, 'copper', copper);
    else roof(o, rs, eaves, rise, 'copper', copper);
    cornice(o, rs, eaves);
  }
  if (fine(o))
    allEdges(o, rings(293340869, o), (f, len, _i, a, b) => {
      const mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2,
        nx = -(b[1] - a[1]) / len,
        nz = (b[0] - a[0]) / len;
      if (mx > 10 || mx < -175 || mz > 0 || len < 2.5 || (nx - nz) * Math.SQRT1_2 < 0.6) return;
      const n = Math.max(1, Math.round(len / 5.5));
      for (let i = 0; i < n; i++) {
        const x = (i * len) / n;
        column(f, x, 0.55, 12, 29.3, 0.48, 'carved', trim, master(o) ? 24 : 6);
        if (master(o)) {
          column(f, x, 0.55, 12, 12.5, 0.7, 'carved', trim, 8);
          column(f, x, 0.55, 28.7, 29.4, 0.72, 'carved', trim, 8);
        }
      }
    });
  const rs = rings(682997388, o);
  prism(o, rs, 13.3, 15, 'carved', trim);
  if (near(o)) balustrade(o, rs, 15);
}
function michaelerColumns(o) {
  if (!fine(o)) return;
  for (const id of [
    1108356879, 1108356880, 1108356881, 1108356882, 1108356883, 1108356884, 1108356885, 1108356886,
    1108356887, 1108356888, 1108356889, 1108356890, 1108356891, 1108356892, 1108356893, 1108356894,
  ]) {
    const p = feature(id).points.slice(0, -1);
    const cx = p.reduce((n, q) => n + q[0] / p.length, 0),
      cz = p.reduce((n, q) => n + q[1] / p.length, 0),
      radius = Math.max(...p.map((q) => Math.hypot(q[0] - cx, q[1] - cz)));
    const profiles = master(o)
      ? [
          [10, radius * 1.4],
          [10.4, radius * 1.4],
          [10.8, radius],
          [19, radius * 0.88],
          [19.3, radius * 1.35],
          [20, radius * 1.5],
        ]
      : [
          [10, radius],
          [20, radius],
        ];
    loft(
      o,
      'carved',
      profiles.map(([y, r]) => radialRing(y, r, r, master(o) ? 24 : 8, [cx, cz])),
      trim,
    );
  }
}
export function buildHofburgRuntime(out, detail) {
  const o = { ...out, detail };
  palaceWings(o);
  michaelerColumns(o);
  church(o);
  palmHouse(o);
  dome(o, 1022701010, 40, 9, 3);
  dome(o, 1022701011, 33.5, 5, 1.2);
  dome(o, 1022701012, 33.5, 5, 1.2);
  dome(o, 1022701013, 35.5, 7, 0.7);
  amalienClock(o);
  neuePavilions(o);
  if (detail !== 'skyline') {
    // Bastei terrace is below Albertina, rather than a filled palace courtyard.
    prism(o, rings(91858419, o), 0, 7.8, 'stone', [0.58, 0.57, 0.48]);
    prism(o, rings(227023529, o), 14.75, 15, 'metal', [0.36, 0.39, 0.37]);
  }
}
export function buildHofburgSkyline(out) {
  buildHofburgRuntime(out, 'skyline');
}
export const hofburgStudy = {
  id: 'N0245',
  key: 'hofburg_palace',
  title: 'Hofburg Palace',
  category: 'castle',
  wikidataId: 'Q46242',
  mapFrame: 'map-frame.json',
  build: (out) => buildHofburgRuntime(out),
  brief:
    'Individually mapped Hofburg wings around open courts, curved Neue Burg, Michaeler copper domes, Amalien clock turret, library dome, riding school and Stallburg courtyard, Augustinian spire, Albertina terrace and Palmenhaus.',
  sourceFacts: {
    mapIdentity: 'Exact Q46242 relation/3898175 and named component relations',
    mappedFeatures: 123,
    mainCourtyardHoles: 25,
    michaelerDomeOfficialHeight: 'over 50 m',
    augustinerSpireMapHeightMeters: 66,
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Attributed OSM parts and heights, official heritage wing descriptions and visually inspected exterior photographs.',
    michaelerDomeMeters: 52,
    augustinerSpireMeters: 66,
    wingHeights: 'OSM totals where present; eaves and roof split reconstructed',
    verticalDatum:
      'Provisional common palace ground. Albertina bastion and pavement grades require terrain fitting.',
  },
  scaleBasis:
    'Meter-scale individual component outlines in the exact Hofburg map frame. Courtyard holes retained. Native +X approximately north; +Z east.',
  refs: [
    'https://www.openstreetmap.org/relation/3898175',
    'https://www.burghauptmannschaft.at/Themen/Hofburg-Wien/',
    'https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Michaelertrakt.html',
    'https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Neue-Burg.html',
    'https://www.burghauptmannschaft.at/Liegenschaften/Liegenschaften/Wien/Hofburg-Wien-/Amalientrakt.html',
    'https://commons.wikimedia.org/wiki/File:Hofburg_Vienna_plan.svg',
    'https://commons.wikimedia.org/wiki/File:Wien_Hofburg_Michaelertrakt.jpg',
    'https://commons.wikimedia.org/wiki/File:Wien_Hofburg_Neue_Burg_Heldenplatz.jpg',
    'https://commons.wikimedia.org/wiki/File:Leopoldinischer_Trakt_Vienna_August_2006_002.jpg',
    'https://commons.wikimedia.org/wiki/File:Amalienburg_Vienna_Oct._2006_004.jpg',
    'https://commons.wikimedia.org/wiki/File:Reichskanzleitrakt_Vienna_June_2006_336.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Photographs are linked reference only; no third-party pixels or meshes distributed.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X approximately north',
    front: '+Z approximately east',
    origin: 'Exact OSM anchor at provisional common palace ground',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Signed map frame drafted; component terrain and road clearance pending',
    notes: 'Main envelope includes open courts and is not an occupied replacement footprint.',
  }),
  geographicNote:
    'Draft only. Verify multi-wing ground contact, Michaeler passage and Albertina bastion against terrain before activating.',
  limitations: [
    'Maximum exterior fidelity remains pending. Roof junctions, facade opening positions and repeated ornament are reconstructed; map heights are not a survey.',
    'Individual imperial statues, fountains, heraldic reliefs, equestrian monuments and detailed capitals are not faithfully sculpted; no generic stand-in is counted as those monuments.',
    'Court roof ridges and compound wing intersections need refinement. Michaeler passage is reconstructed and requires pedestrian/road alignment review.',
    'Palmenhaus central pavilion, Albertina basements and canopy supports, Swiss portal decoration, Stallburg arcades and small court stair towers require further detail.',
    'Ground datum is provisional. No interiors, temporary equipment or neighbouring Michaelerkirche included.',
  ],
  camera: { position: [420, 275, 370], lookAt: [0, 18, 0] },
  qaCameras: [
    { name: 'michaeler-three-domes', position: [264, 70, 121], lookAt: [157, 23, 18] },
    { name: 'neue-burg-curved-front', position: [11, 63, -183], lookAt: [-101, 20, -93] },
    { name: 'amalien-clock', position: [124, 40, -58], lookAt: [179, 22, -111] },
    { name: 'inner-burg-and-chancellery', position: [94, 55, -94], lookAt: [155, 17, -51] },
    { name: 'swiss-court-roofs', position: [93, 120, 49], lookAt: [63, 16, -6] },
    { name: 'stallburg-and-riding-school', position: [180, 100, 175], lookAt: [103, 15, 101] },
    { name: 'library-and-augustiner', position: [25, 108, 215], lookAt: [-43, 21, 100] },
    { name: 'albertina-and-palmenhaus', position: [-302, 98, 162], lookAt: [-155, 14, 130] },
    { name: 'complete-open-courtyard-plan', position: [15, 580, 15], lookAt: [0, 0, 0] },
  ],
};
