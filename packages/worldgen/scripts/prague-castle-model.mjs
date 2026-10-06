/** Prague Castle: individually mapped palaces, cathedral, churches and northern defences. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2f/n0240_prague_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.64, 0.59, 0.47],
  trim = [0.82, 0.77, 0.63],
  pale = [0.88, 0.85, 0.73];
const plaster = [0.88, 0.8, 0.57],
  red = [0.61, 0.22, 0.12],
  tiles = [0.67, 0.27, 0.14];
const slate = [0.34, 0.37, 0.34],
  glass = [0.13, 0.18, 0.17],
  copper = [0.28, 0.47, 0.36];
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const master = (o) => !o.detail;
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const triangle = (o, s, p, c) =>
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
    rotate = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
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
              const q = rotate(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rotate(n),
            uv,
            color,
          ),
      ]),
    ),
  };
}
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function clean(r, tolerance = 0.15) {
  const p = r.map((p) => [...p]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        l = Math.hypot(dx, dz);
      if (
        l &&
        Math.abs(dx * (a[1] - b[1]) - (a[0] - b[0]) * dz) / l < tolerance &&
        Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) <
          l + 2 * tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function feature(id) {
  const f = map.features.find((f) => f.id === id);
  if (!f) throw new Error(`Missing Prague footprint ${id}`);
  return f;
}
function rings(id, tolerance = 0.15) {
  const f = feature(id);
  return [...f.rings.outer, ...f.rings.inner].map((p) => clean(p, tolerance));
}
function cap(o, rs, y, slot, color) {
  const p = rs.flat(),
    holes = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]);
    if (normalFor(...t)[1] < 0) t.reverse();
    triangle(o, slot, t, color);
  }
}
function prism(o, rs, y0, y1, slot = 'limestone', color = stone) {
  cap(o, rs, y1, slot, color);
  for (const [j, r0] of rs.entries()) {
    const r = j ? [...r0].reverse() : r0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
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
}
function lineFrame(o, a, b) {
  return frame(o, a[0], 0, a[1], Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
}
function band(o, rs, y, width = 0.35, slot = 'carved', color = trim) {
  for (const [j, r0] of rs.entries()) {
    const r = j ? [...r0].reverse() : r0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      const f = lineFrame(o, b, a);
      if (master(o))
        box(f, slot, [0, y - width / 2, -width * 0.3], [len, y + width / 2, width * 0.7], color);
      else
        face(
          f,
          slot,
          [
            [0, y - width / 2, 0.09],
            [len, y - width / 2, 0.09],
            [len, y + width / 2, 0.09],
            [0, y + width / 2, 0.09],
          ],
          color,
        );
    }
  }
}
function rect(o, x, y, w, h, d = 0.08, c = glass, slot = 'glass') {
  face(
    o,
    slot,
    [
      [x - w / 2, y, d],
      [x + w / 2, y, d],
      [x + w / 2, y + h, d],
      [x - w / 2, y + h, d],
    ],
    c,
  );
}
function stroke(o, p, width = 0.13, slot = 'carved', color = trim, closed = false) {
  for (let i = 1; i < p.length + (closed ? 1 : 0); i++) {
    const a = p[i - 1],
      b = p[i % p.length];
    if (Math.hypot(...b.map((v, j) => v - a[j])) < 0.001) continue;
    if (master(o)) beam(o, slot, a, b, width, width, color);
    else {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.001) continue;
      const dx = ((b[1] - a[1]) * width) / 2 / len,
        dy = (-(b[0] - a[0]) * width) / 2 / len;
      const q = [
        [a[0] - dx, a[1] - dy, a[2]],
        [b[0] - dx, b[1] - dy, b[2]],
        [b[0] + dx, b[1] + dy, b[2]],
        [a[0] + dx, a[1] + dy, a[2]],
      ];
      if (normalFor(...q)[2] < 0) q.reverse();
      face(o, slot, q, color);
    }
  }
}
function arch(
  o,
  x,
  y,
  w,
  h,
  { pointed = true, lights = 2, slot = 'glass', color = glass, detail = true } = {},
) {
  const r = w / 2,
    spring = y + h - (pointed ? r * 1.1 : r),
    segments = master(o) ? 10 : fine(o) ? 4 : 2;
  const p = [
    [x - r, y],
    [x + r, y],
    [x + r, spring],
  ];
  for (let i = 1; i <= segments * 2; i++) {
    const a = (Math.PI * i) / (segments * 2);
    p.push([x + r * Math.cos(a), spring + (y + h - spring) * Math.sin(a)]);
  }
  if (pointed) {
    p[3 + segments - 1][1] = y + h + 0.2 * r;
  }
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((k) => [...p[k], 0.11]);
    if (normalFor(...t)[2] < 0) t.reverse();
    triangle(o, slot, t, color);
  }
  if (!fine(o) || !detail) return;
  stroke(
    o,
    p.map((p) => [...p, 0.21]),
    0.16,
    'carved',
    trim,
    true,
  );
  for (let i = 1; i < lights; i++)
    stroke(
      o,
      [
        [x - r + (w * i) / lights, y, 0.23],
        [x - r + (w * i) / lights, spring, 0.23],
      ],
      0.095,
    );
  if (h > 5)
    stroke(
      o,
      [
        [x - r, y + h * 0.45, 0.23],
        [x + r, y + h * 0.45, 0.23],
      ],
      0.1,
    );
  if (master(o) && lights > 1) {
    const rad = w / (lights * 2.8);
    for (let i = 0; i < lights - 1; i++)
      circle(o, x - r + (w * (i + 1)) / lights, spring + 0.4 * r, rad, 0.09, 'carved', trim);
  }
}
function circle(o, x, y, r, width = 0.12, slot = 'carved', color = trim, filled = false) {
  const n = master(o) ? 32 : fine(o) ? 20 : 12,
    p = Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((2 * Math.PI * i) / n),
      y + r * Math.sin((2 * Math.PI * i) / n),
      0.24,
    ]);
  if (filled)
    for (let i = 0; i < n; i++) triangle(o, slot, [[x, y, 0.23], p[i], p[(i + 1) % n]], color);
  else stroke(o, p, width, slot, color, true);
}
function window(o, x, y, w = 1.5, h = 2.6) {
  rect(o, x, y, w, h);
  if (!fine(o)) return;
  stroke(
    o,
    [
      [x - w / 2 - 0.14, y - 0.14, 0.17],
      [x + w / 2 + 0.14, y - 0.14, 0.17],
      [x + w / 2 + 0.14, y + h + 0.14, 0.17],
      [x - w / 2 - 0.14, y + h + 0.14, 0.17],
    ],
    0.2,
    'plaster',
    pale,
    true,
  );
  // Sub-pixel sash bars stay in the preserved master; close-up keeps the masonry surround.
  if (!master(o)) return;
  stroke(
    o,
    [
      [x, y, 0.19],
      [x, y + h, 0.19],
    ],
    0.075,
    'wood',
    pale,
  );
  stroke(
    o,
    [
      [x - w / 2, y + h * 0.64, 0.19],
      [x + w / 2, y + h * 0.64, 0.19],
    ],
    0.075,
    'wood',
    pale,
  );
  if (master(o)) {
    box(o, 'carved', [x - w / 2 - 0.27, y - 0.27, -0.02], [x + w / 2 + 0.27, y - 0.08, 0.48], pale);
    box(
      o,
      'plaster',
      [x - w / 2 - 0.25, y + h + 0.12, -0.02],
      [x + w / 2 + 0.25, y + h + 0.35, 0.34],
      pale,
    );
  }
}
function fenestrate(
  o,
  rs,
  h,
  { spacing = 3.9, levels = 3, width = 1.5, kind = 'rect', skip = 0 } = {},
) {
  for (const [j, r0] of rs.entries()) {
    const r = j ? [...r0].reverse() : r0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < spacing * 0.85) continue;
      const f = lineFrame(o, b, a),
        n = Math.max(1, Math.floor(len / spacing));
      for (let k = 0; k < n; k++) {
        if (skip && k % skip) continue;
        const x = (len * (k + 0.5)) / n;
        for (let l = 0; l < levels; l++) {
          const y = 1.3 + (l * (h - 2.5)) / levels;
          if (kind === 'arch')
            arch(f, x, y, Math.min(width, len * 0.7), Math.min(4.5, h / levels - 1), {
              pointed: false,
            });
          else window(f, x, y, width, Math.min(2.8, h / levels - 1.2));
        }
      }
    }
  }
}
function hip(o, x0, x1, z0, z1, y, rise, { slot = 'tile', color = tiles, gable = false } = {}) {
  const cz = (z0 + z1) / 2,
    inset = gable ? 0 : Math.min((z1 - z0) / 2, (x1 - x0) * 0.25),
    a = [x0 + inset, y + rise, cz],
    b = [x1 - inset, y + rise, cz];
  const quads = [
    [[x0, y, z0], a, b, [x1, y, z0]],
    [[x1, y, z1], b, a, [x0, y, z1]],
  ];
  for (let p of quads) {
    if (normalFor(...p)[1] < 0) p = p.reverse();
    face(o, slot, p, color);
  }
  for (let p of [
    [[x0, y, z0], [x0, y, z1], a],
    [[x1, y, z1], [x1, y, z0], b],
  ]) {
    if (normalFor(...p)[1] < 0) p = p.reverse();
    triangle(o, gable ? 'plaster' : slot, p, gable ? plaster : color);
  }
  if (master(o)) {
    beam(o, slot, a, b, 0.24, 0.24, color);
  }
}
function pitched(o, a, b, w, y, rise, opts = {}) {
  const f = lineFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  hip(f, 0, len, -w / 2, w / 2, y, rise, opts);
}
function bounds(p) {
  return [
    Math.min(...p.map((p) => p[0])),
    Math.min(...p.map((p) => p[1])),
    Math.max(...p.map((p) => p[0])),
    Math.max(...p.map((p) => p[1])),
  ];
}
function roofFor(o, rs, y, rise, slot = 'tile', color = tiles) {
  // Clip four reconstructed roof slopes to the mapped occupied polygon, including holes.
  // An enclosing rectangle alone creates unsupported wedges over narrow lanes and courts.
  const p = rs[0];
  let a = p[0],
    b = p[1],
    max = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length],
      l = Math.hypot(q[0] - p[i][0], q[1] - p[i][1]);
    if (l > max) {
      max = l;
      a = p[i];
      b = q;
    }
  }
  const angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
    c = Math.cos(angle),
    s = Math.sin(angle);
  const q = p.map((p) => [
      (p[0] - a[0]) * c - (p[1] - a[1]) * s,
      (p[0] - a[0]) * s + (p[1] - a[1]) * c,
    ]),
    [x0, z0, x1, z1] = bounds(q);
  const local = frame(o, a[0], 0, a[1], angle);
  const convert = (p) => [
    (p[0] - a[0]) * c - (p[1] - a[1]) * s,
    (p[0] - a[0]) * s + (p[1] - a[1]) * c,
  ];
  const rr = rs.map((r) => r.map(convert)),
    flat = rr.flat(),
    holes = [];
  let count = rr[0].length;
  for (const r of rr.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const indices = earcut(flat.flat(), holes, 2);
  const inset = Math.min((z1 - z0) / 2, (x1 - x0) * 0.25),
    cz = (z0 + z1) / 2;
  const left = [x0 + inset, y + rise, cz],
    right = [x1 - inset, y + rise, cz];
  const slopes = [
    [[x0, y, z0], left, right, [x1, y, z0]],
    [[x1, y, z1], right, left, [x0, y, z1]],
    [[x0, y, z1], left, [x0, y, z0]],
    [[x1, y, z0], right, [x1, y, z1]],
  ];
  function clip(p, r) {
    const edge = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let i = 0; i < r.length && p.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        out = [];
      for (let j = 0; j < p.length; j++) {
        const u = p[j],
          v = p[(j + 1) % p.length],
          du = edge(a, b, u),
          dv = edge(a, b, v);
        if (du >= -1e-8) out.push(u);
        if ((du > 1e-8 && dv < -1e-8) || (du < -1e-8 && dv > 1e-8)) {
          const t = du / (du - dv);
          out.push([u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1])]);
        }
      }
      p = out;
    }
    return p;
  }
  for (const slope of slopes) {
    const outline = slope.map((p) => [p[0], p[2]]);
    if (area(outline) < 0) outline.reverse();
    const n = normalFor(...slope),
      base = slope[0];
    for (let i = 0; i < indices.length; i += 3) {
      const polygon = clip(
        indices.slice(i, i + 3).map((k) => flat[k]),
        outline,
      );
      if (polygon.length < 3 || Math.abs(area(polygon)) < 1e-7) continue;
      const points = polygon.map(([x, z]) => [
        x,
        base[1] - (n[0] * (x - base[0]) + n[2] * (z - base[2])) / n[1],
        z,
      ]);
      for (let j = 1; j < points.length - 1; j++) {
        const t = [points[0], points[j], points[j + 1]];
        if (normalFor(...t)[1] < 0) t.reverse();
        if (Math.abs(area(t.map((p) => [p[0], p[2]]))) > 1e-7) triangle(local, slot, t, color);
      }
    }
  }
  const height = ([x, z]) =>
    y +
    rise *
      Math.max(
        0,
        Math.min(
          (z - z0) / ((z1 - z0) / 2),
          (z1 - z) / ((z1 - z0) / 2),
          (x - x0) / inset,
          (x1 - x) / inset,
          1,
        ),
      );
  for (const [j, r0] of rr.entries()) {
    const r = j ? [...r0].reverse() : r0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        times = [0, 1];
      for (const [axis, k] of [
        [0, x0 + inset],
        [0, x1 - inset],
        [1, cz],
      ]) {
        const t = (k - a[axis]) / (b[axis] - a[axis]);
        if (t > 1e-7 && t < 1 - 1e-7) times.push(t);
      }
      times.sort((a, b) => a - b);
      for (let k = 1; k < times.length; k++) {
        const at = (t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
          u = at(times[k - 1]),
          v = at(times[k]),
          uy = height(u),
          vy = height(v);
        if (Math.max(uy, vy) - y < 1e-5) continue;
        if (uy - y > 1e-5)
          triangle(
            local,
            'plaster',
            [
              [u[0], uy, u[1]],
              [v[0], vy, v[1]],
              [u[0], y, u[1]],
            ],
            plaster,
          );
        if (vy - y > 1e-5)
          triangle(
            local,
            'plaster',
            [
              [v[0], vy, v[1]],
              [v[0], y, v[1]],
              [u[0], y, u[1]],
            ],
            plaster,
          );
      }
    }
  }
}
function mapped(
  o,
  id,
  h,
  { slot = 'plaster', color = plaster, roof = 0, windows = true, levels = 3 } = {},
) {
  const rs = rings(id, ['skyline', 'district'].includes(o.detail) ? 2 : 0.22);
  prism(o, rs, 0, h, slot, color);
  if (roof) roofFor(o, rs, h, roof);
  if (!['skyline', 'district'].includes(o.detail)) {
    if (windows) fenestrate(o, rs, h, { levels, skip: o.detail === 'street' ? 2 : 0 });
    if (fine(o)) {
      band(o, rs, h - 0.4, 0.5, 'plaster', pale);
      for (let k = 1; k < levels; k++) band(o, rs, (k * h) / levels, 0.18, 'plaster', pale);
    }
  }
  return rs;
}
function spire(o, x, z, y, h, r = 1, slot = 'carved', color = trim) {
  const segments = master(o) ? 8 : 4;
  loft(
    o,
    slot,
    [radialRing(y, r, r, segments, [x, z]), radialRing(y + h, 0.015, 0.015, segments, [x, z])],
    color,
  );
  if (master(o) && h > 3)
    for (let k = 1; k < 6; k++)
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2,
          rr = r * (1 - k / 6);
        box(
          o,
          slot,
          [x + Math.cos(a) * rr - 0.12, y + (h * k) / 6 - 0.15, z + Math.sin(a) * rr - 0.12],
          [x + Math.cos(a) * rr + 0.12, y + (h * k) / 6 + 0.15, z + Math.sin(a) * rr + 0.12],
          color,
        );
      }
}
function pinnacle(o, x, z, y, h = 5) {
  box(o, 'carved', [x - 0.4, y, z - 0.4], [x + 0.4, y + h * 0.45, z + 0.4], trim);
  spire(o, x, z, y + h * 0.45, h * 0.55, 0.54);
}
function onion(o, x, z, y, h, r) {
  const profile = [
    [0, 0.95],
    [0.12, 1.08],
    [0.28, 0.92],
    [0.43, 0.5],
    [0.5, 0.35],
    [0.66, 0.35],
    [0.71, 0.55],
    [0.79, 0.6],
    [0.9, 0.25],
    [1, 0.02],
  ];
  const n = master(o) ? 24 : fine(o) ? 12 : 8;
  loft(
    o,
    'copper',
    profile.map(([yy, rr]) => radialRing(y + h * yy, r * rr, r * rr, n, [x, z])),
    copper,
  );
  if (master(o))
    for (let i = 0; i < n; i += 2) {
      const a = (-2 * Math.PI * i) / n;
      for (let j = 1; j < profile.length; j++) {
        const p = profile[j - 1],
          q = profile[j];
        beam(
          o,
          'copper',
          [x + r * p[1] * Math.cos(a), y + h * p[0], z + r * p[1] * Math.sin(a)],
          [x + r * q[1] * Math.cos(a), y + h * q[0], z + r * q[1] * Math.sin(a)],
          0.075,
          0.075,
          [0.19, 0.32, 0.23],
        );
      }
    }
}
function cross(o, x, z, y, h = 1.5) {
  tube(o, 'metal', [x, y, z], [x, y + h, z], 0.055, [0.72, 0.61, 0.3], 4);
  beam(
    o,
    'metal',
    [x - h * 0.22, y + h * 0.7, z],
    [x + h * 0.22, y + h * 0.7, z],
    0.08,
    0.08,
    [0.72, 0.61, 0.3],
  );
}

function palaceRanges(o) {
  mapped(o, 'relation/3367557', 25, { roof: 0, levels: 4 });
  // Axes are manually traced within the individual western/southern palace ranges.
  const roofs = [
    [[-247, -72], [-163, -62], 21, 25, 8],
    [[-235, -59], [-224, 64], 16, 25, 7],
    [[-175, -59], [-171, 65], 19, 25, 7],
    [[-223, 64], [-169, 65], 17, 25, 7],
    [[-168, 66], [-126, 78], 17, 25, 7],
    [[-126, 78], [-77, 59], 17, 25, 7],
    [[-79, 59], [-38, 38], 17, 25, 7],
    [[-43, 27], [24, 25], 29, 25, 12],
    [[-31, 37], [-31, 61], 12, 25, 7],
    [[-276, 6], [-234, -4], 13, 21, 5],
    [[-274, 6], [-270, 31], 12, 21, 5],
    [[-269, 31], [-236, 22], 12, 21, 5],
    [[-266, 69], [-224, 59], 13, 25, 7],
  ];
  for (const [a, b, w, y, r] of roofs) pitched(o, a, b, w, y, r);
  for (const [id, h, levels] of [
    ['relation/28649', 23, 4],
    ['relation/3367881', 20, 4],
    ['relation/3367852', 13, 3],
    ['relation/28652', 15, 3],
    ['relation/15317896', 15, 3],
  ])
    mapped(o, id, h, { levels });
  for (const [a, b, w, y, r] of [
    [[42, 21], [188, -2], 13, 23, 6],
    [[48, -3], [193, -23], 12, 23, 6],
    [[50, -4], [52, 18], 10, 23, 6],
    [[91, -10], [94, 11], 10, 23, 6],
    [[141, -18], [143, 5], 10, 23, 6],
    [[190, -21], [192, -2], 10, 23, 6],
    [[202, -19], [268, -10], 10, 20, 5],
    [[205, 4], [237, 3], 11, 20, 5],
    [[238, 3], [267, -7], 10, 20, 5],
    [[205, -17], [206, 2], 9, 20, 5],
    [[234, -15], [235, 3], 9, 20, 5],
    [[48, -66], [91, -65], 15, 15, 5],
    [[49, -62], [49, -34], 10, 15, 5],
    [[51, -31], [89, -31], 10, 15, 5],
    [[87, -64], [88, -31], 10, 15, 5],
    [[102, -61], [124, -60], 12, 15, 5],
    [[125, -60], [125, -25], 12, 15, 5],
    [[104, -31], [125, -25], 12, 15, 5],
    [[213, -55], [260, -55], 12, 13, 5],
  ])
    pitched(o, a, b, w, y, r);
  if (!['skyline', 'district'].includes(o.detail)) {
    // The south façade's rusticated lower storey and ordered pilasters.
    const a = [-121, 88],
      b = [-75, 69],
      f = lineFrame(o, a, b),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let x = 2; x < len; x += 5.2) {
      if (fine(o)) box(f, 'plaster', [x - 0.24, 0, -0.12], [x + 0.24, 25, 0.38], pale);
    }
    // Palace roof stacks stand on their ridge/roof plane rather than floating above it.
    if (fine(o))
      for (const [a, b, w, y, r] of roofs.slice(0, 9)) {
        const f = lineFrame(o, a, b),
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let x = 7; x < len - 3; x += 13) {
          box(
            f,
            'plaster',
            [x - 0.6, y + r * 0.4, -w * 0.23],
            [x + 0.6, y + r + 2, -w * 0.23 + 1.2],
            pale,
          );
          box(
            f,
            'carved',
            [x - 0.8, y + r + 1.8, -w * 0.23 - 0.2],
            [x + 0.8, y + r + 2.2, -w * 0.23 + 1.4],
            trim,
          );
        }
      }
  }
}
function cathedral(o) {
  const low = ['skyline', 'district'].includes(o.detail);
  prism(o, rings('relation/15317899', low ? 2 : 0.18), 0, 15);
  // Main nave, choir and crossing use their mapped parts, including the polygonal apse.
  for (const id of ['way/565398669', 'way/565398673', 'way/279536188']) {
    const rs = rings(id, low ? 1 : 0.15);
    prism(o, rs, 15, 40);
    roofFor(o, rs, 40, 15, 'slate', slate);
  }
  if (!low) {
    // Individually mapped radiating chapels. Their hipped roofs sit below the clerestory.
    for (const f of map.features.filter(
      (f) => f.id.startsWith('way/532171') && f.tags.height === '22',
    )) {
      const rs = rings(f.id, 0.12);
      prism(o, rs, 0, 15);
      roofFor(o, rs, 15, 7, 'slate', slate);
      const r = rs[0];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz);
        const cx = (a[0] + b[0]) / 2 + 75,
          cz = (a[1] + b[1]) / 2 + 29;
        if (len > 3 && (dz * cx - dx * cz) / (len * Math.hypot(cx, cz)) > 0.65)
          arch(lineFrame(o, b, a), len / 2, 3.6, Math.min(4.2, len * 0.68), 9.2, { lights: 3 });
      }
    }
    const apse = rings('way/565398673', 0.15)[0];
    for (let i = 0; i < apse.length; i++) {
      const a = apse[i],
        b = apse[(i + 1) % apse.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((a[0] + b[0]) / 2 > -34 && len > 2)
        arch(lineFrame(o, b, a), len / 2, 24, Math.min(4.2, len * 0.68), 12, { lights: 2 });
    }
    if (fine(o))
      for (const degrees of [-70, -35, 0, 35, 70]) {
        const a = (degrees * Math.PI) / 180,
          outer = [-32 + 17 * Math.cos(a), -29 + 19 * Math.sin(a)],
          inner = [-32 + 3.7 * Math.cos(a), -29 + 6 * Math.sin(a)];
        box(
          o,
          'carved',
          [outer[0] - 0.4, 0, outer[1] - 0.4],
          [outer[0] + 0.4, 21, outer[1] + 0.4],
          trim,
        );
        pinnacle(o, outer[0], outer[1], 21, 5);
        const bend = [outer[0] * 0.65 + inner[0] * 0.35, outer[1] * 0.65 + inner[1] * 0.35];
        beam(o, 'carved', [outer[0], 20, outer[1]], [bend[0], 30, bend[1]], 0.65, 0.85, trim);
        beam(o, 'carved', [bend[0], 30, bend[1]], [inner[0], 35, inner[1]], 0.65, 0.85, trim);
        pinnacle(o, inner[0], inner[1], 40, 5);
      }
    for (const z of [-34.6, -22]) {
      const f = frame(o, 0, 0, z, z < -30 ? Math.PI : 0);
      for (let x = -122; x < -33; x += 7.2) {
        if (Math.abs(x + 79) < 10) continue;
        arch(f, z < -30 ? -x : x, 25, 4.5, 12, { lights: 3 });
      }
    }
    // Lower aisle windows and flying buttresses are independent from the nave wall.
    for (const [outer, inner] of [
      [-49, -34.6],
      [-8, -22],
    ])
      for (let x = -125; x < -30; x += 7.2) {
        if (Math.abs(x + 79) < 9 || (outer > -20 && x > -105 && x < -86)) continue;
        const f = frame(o, x, 0, outer, outer < -30 ? Math.PI : 0);
        arch(f, 0, 3.8, 4.2, 9.3, { lights: 3 });
        if (o.detail === 'street') continue;
        box(o, 'carved', [x + 2.9, 0, outer - 0.7], [x + 3.7, 20, outer + 0.7], trim);
        pinnacle(o, x + 3.3, outer, 20, 5);
        const zz = [outer, outer * 0.72 + inner * 0.28, outer * 0.4 + inner * 0.6, inner],
          yy = [19, 28, 32, 35];
        for (let j = 1; j < zz.length; j++)
          beam(
            o,
            'carved',
            [x + 3.3, yy[j - 1], zz[j - 1]],
            [x + 3.3, yy[j], zz[j]],
            0.65,
            0.85,
            trim,
          );
        pinnacle(o, x + 3.3, inner, 40, 5.2);
        if (master(o))
          for (let j = 1; j < zz.length; j++)
            beam(
              o,
              'carved',
              [x + 3.3, yy[j - 1] - 4.2, zz[j - 1]],
              [x + 3.3, yy[j] - 5, zz[j]],
              0.45,
              0.55,
              trim,
            );
      }
    for (const z of [-50.8, 3.1]) {
      const f = frame(o, -78.7, 0, z, z < 0 ? Math.PI : 0);
      arch(f, 0, 17, 9.5, 20, { lights: 5 });
      if (z > 0)
        for (const x of [-4, 0, 4])
          arch(f, x, 0, 3.5, 8, { lights: 1, slot: 'wood', color: [0.22, 0.16, 0.1] });
    }
  }
  // West towers: squared bases, eight-sided belfries, stone openwork spires.
  for (const [x, z] of [
    [-134.35, -37.6],
    [-133.95, -16.5],
  ]) {
    box(o, 'limestone', [x - 4.6, 0, z - 4.7], [x + 4.6, 60, z + 4.7], stone);
    loft(
      o,
      'limestone',
      [
        radialRing(60, 4.2, 4.2, 8, [x, z], Math.PI / 8),
        radialRing(65, 3.1, 3.1, 8, [x, z], Math.PI / 8),
      ],
      stone,
    );
    spire(o, x, z, 65, 20, 2.4, 'limestone', stone);
    if (!low)
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          f = frame(o, x + Math.sin(a) * 4.72, 0, z + Math.cos(a) * 4.72, a);
        arch(f, 0, 21, 5.3, 15, { lights: 3 });
        arch(f, 0, 43, 5.2, 13, { lights: 2 });
        if (fine(o)) {
          for (const xx of [-4.1, 4.1])
            box(f, 'carved', [xx - 0.25, 0, -0.1], [xx + 0.25, 60, 0.55], trim);
        }
      }
    if (fine(o))
      for (const dx of [-3.8, 3.8])
        for (const dz of [-3.8, 3.8]) pinnacle(o, x + dx, z + dz, 45, 10);
  }
  if (!low) {
    const west = frame(o, -139.4, 0, -27.15, -Math.PI / 2);
    arch(west, 0, 1, 7.4, 13, { slot: 'wood', color: [0.19, 0.16, 0.11], lights: 2 });
    circle(west, 0, 29.3, 5.6, 0.2, 'glass', glass, true);
    circle(west, 0, 29.3, 5.7, 0.24);
    if (fine(o)) {
      circle(west, 0, 29.3, 1.1, 0.14);
      for (let j = 0; j < 12; j++) {
        const a = (2 * Math.PI * j) / 12;
        stroke(
          west,
          [
            [Math.cos(a) * 1.1, 29.3 + Math.sin(a) * 1.1, 0.35],
            [Math.cos(a) * 5.3, 29.3 + Math.sin(a) * 5.3, 0.35],
          ],
          0.11,
        );
        circle(west, Math.cos(a) * 3.85, 29.3 + Math.sin(a) * 3.85, 1.02, 0.1);
      }
      for (const x of [-6, 6]) pinnacle(west, x, 0, 36, 8);
      stroke(
        west,
        [
          [-6.1, 39, 0.3],
          [0, 49, 0.3],
          [6.1, 39, 0.3],
        ],
        0.45,
      );
    }
  }
  // Great south tower. City authority gives a 99.3 m summit and a double lantern roof.
  const x = -95.18,
    z = -11.4;
  box(o, 'limestone', [x - 7.15, 0, z - 7.1], [x + 7.15, 62, z + 7.1], stone);
  box(o, 'carved', [x - 7.5, 60.5, z - 7.45], [x + 7.5, 62, z + 7.45], trim);
  onion(o, x, z, 62, 34.3, 5.5);
  cross(o, x, z, 96.3, 3);
  for (const dx of [-6.1, 6.1])
    for (const dz of [-6.1, 6.1]) {
      box(o, 'carved', [x + dx - 0.7, 61, z + dz - 0.7], [x + dx + 0.7, 65, z + dz + 0.7], trim);
      onion(o, x + dx, z + dz, 65, 7, 1.3);
    }
  if (!low)
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2,
        f = frame(o, x + Math.sin(a) * 7.18, 0, z + Math.cos(a) * 7.18, a);
      arch(f, 0, 8, 8, 23, { lights: 3 });
      arch(f, 0, 38, 7.6, 17, { lights: 2 });
      if (fine(o)) {
        circle(f, 0, 51, 2.125, 0.1, 'glass', [0.13, 0.17, 0.15], true);
        circle(f, 0, 51, 2.13, 0.14);
        circle(f, 0, 34.5, 1.925, 0.1, 'glass', [0.18, 0.2, 0.17], true);
        circle(f, 0, 34.5, 1.93, 0.14);
        for (const yy of [51, 34.5]) {
          stroke(
            f,
            [
              [0, yy, 0.42],
              [0.9, yy + 1.3, 0.42],
            ],
            0.07,
            'metal',
            pale,
          );
          stroke(
            f,
            [
              [0, yy, 0.43],
              [-1.3, yy + 0.2, 0.43],
            ],
            0.07,
            'metal',
            pale,
          );
        }
        for (const xx of [-6.5, 6.5])
          box(f, 'carved', [xx - 0.23, 0, -0.1], [xx + 0.23, 60, 0.5], trim);
        for (let xx = -6; xx <= 6; xx += 1)
          box(f, 'carved', [xx - 0.08, 62, 0.05], [xx + 0.08, 63.7, 0.2], trim);
      }
    }
  // Slender crossing fleche has a separate lantern and spire.
  box(o, 'metal', [-80.65, 53, -30.4], [-77.65, 62, -27.4], slate);
  spire(o, -79.15, -28.9, 62, 18, 2.1, 'slate', slate);
}
function basilica(o) {
  const low = ['skyline', 'district'].includes(o.detail);
  prism(o, rings('relation/3372132', low ? 1.5 : 0.18), 0, 12, 'limestone', pale);
  pitched(o, [48, -17.7], [89, -18.7], 11, 18, 6);
  box(o, 'limestone', [48, 12, -23], [89, 18, -12], pale);
  for (const [z, w] of [
    [-27.1, 5],
    [-11, 6.3],
  ]) {
    const x = 79.6;
    box(o, 'limestone', [x - w / 2, 0, z - w / 2], [x + w / 2, 29, z + w / 2], pale);
    spire(o, x, z, 29, 11.5, w * 0.68, 'limestone', pale);
    cross(o, x, z, 40.5, 0.5);
    if (!low)
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          f = frame(o, x + (Math.sin(a) * w) / 2, 0, z + (Math.cos(a) * w) / 2, a);
        for (const y of [20, 25])
          for (const xx of [-1.25, 0, 1.25])
            arch(f, xx, y, 0.88, 2.8, { pointed: false, lights: 1 });
        if (fine(o))
          for (const y of [19.4, 24.4, 28.6])
            box(f, 'carved', [-w / 2 - 0.15, y, -0.1], [w / 2 + 0.15, y + 0.28, 0.3], pale);
      }
  }
  if (!low) {
    // The west Baroque screen is red plaster with pale orders, independent of Romanesque towers.
    const f = frame(o, 47, 0, -17.6, -Math.PI / 2);
    box(f, 'plaster', [-12, 0, -0.4], [12, 12, 0.02], red);
    box(f, 'plaster', [-6, 12, -0.4], [6, 21, 0.02], red);
    triangle(
      f,
      'plaster',
      [
        [-6, 21, 0.05],
        [6, 21, 0.05],
        [0, 25, 0.05],
      ],
      red,
    );
    arch(f, 0, 0.4, 2.8, 5, { pointed: false, lights: 1, slot: 'wood', color: [0.23, 0.14, 0.09] });
    arch(f, 0, 7, 3.7, 7, { pointed: false, lights: 2 });
    for (const xx of [-8.8, 8.8]) window(f, xx, 5, 1.6, 3.7);
    for (const xx of [-4.8, 4.8]) arch(f, xx, 5, 1.8, 5, { pointed: false, lights: 1 });
    if (fine(o)) {
      for (const xx of [-11, -6.1, -3.1, 3.1, 6.1, 11])
        box(f, 'plaster', [xx - 0.22, 0, 0.06], [xx + 0.22, 12, 0.4], pale);
      for (const xx of [-5.5, 5.5])
        box(f, 'plaster', [xx - 0.23, 12, 0.06], [xx + 0.23, 21, 0.4], pale);
      for (const y of [1, 12, 13, 21])
        box(f, 'plaster', [y <= 12 ? -12 : -6, y, 0.08], [y <= 12 ? 12 : 6, y + 0.36, 0.46], pale);
      stroke(
        f,
        [
          [-6, 21, 0.35],
          [0, 25, 0.35],
          [6, 21, 0.35],
        ],
        0.32,
        'plaster',
        pale,
      );
      window(f, 0, 16, 2.8, 3.5);
    }
  }
  onion(o, 50, -17.7, 23, 3, 0.7);
  cross(o, 50, -17.7, 26, 0.8);
}
function smallerBuildings(o) {
  const buildings = [
    ['relation/15317894', 16, 5, 3],
    ['relation/15317897', 12, 5, 2],
    ['relation/15317898', 10, 4, 2],
    ['relation/28650', 8, 5, 2],
    ['relation/3367568', 8, 4, 2],
    ['relation/3367569', 8, 4, 2],
    ['relation/3372143', 10, 5, 2],
    ['relation/3367616', 9, 4, 2],
    ['relation/3367617', 9, 4, 2],
    ['way/26426852', 15, 5, 3],
    ['way/26426928', 9, 5, 2],
    ['way/26426929', 10, 5, 2],
    ['way/26426883', 12, 5, 3],
    ['way/26426884', 12, 5, 3],
    ['way/26426933', 13, 5, 3],
    ['way/26426934', 12, 5, 3],
    ['way/26426932', 12, 5, 3],
    ['relation/3372133', 18, 7, 2],
    ['relation/3367922', 14, 8, 2],
  ];
  for (const [id, h, r, levels] of buildings) mapped(o, id, h, { roof: r, levels });
  if (fine(o)) {
    const old = frame(o, -129, 0, 17.9, 0);
    for (const x of [-6, 0, 6]) rect(old, x, 7, 3.8, 4, 0.12, [0.68, 0.36, 0.25], 'plaster');
  }
  // Plecnik's obelisk is a separate freestanding object in the third courtyard.
  box(o, 'carved', [-135.7, 0, 23.98], [-131.7, 1, 27.98], pale);
  loft(
    o,
    'cladding',
    [
      [
        [-134.7, 1, 24.98],
        [-134.7, 1, 26.9],
        [-132.78, 1, 26.9],
        [-132.78, 1, 24.98],
      ],
      [
        [-134, 17.5, 25.7],
        [-134, 17.5, 26.18],
        [-133.5, 17.5, 26.18],
        [-133.5, 17.5, 25.7],
      ],
    ],
    pale,
  );
}
const laneIds = [
  3367729, 3367733, 3367731, 3367732, 3367730, 3367808, 3367809, 3367811, 3367810, 3367807, 3367816,
  3367817, 3367815, 3367814, 3367845, 3367846, 3367847, 3367844, 3367843,
];
function defences(o) {
  const low = ['skyline', 'district'].includes(o.detail);
  const pp = rings('relation/3367566', low ? 1 : 0.15);
  prism(o, pp, 0, 27, 'limestone', pale);
  const p = bounds(pp[0]),
    x = (p[0] + p[2]) / 2,
    z = (p[1] + p[3]) / 2;
  spire(o, x, z, 27, 8, 9.1, 'tile', tiles);
  if (!low) fenestrate(o, pp, 26, { spacing: 7, levels: 3, width: 1.1, kind: 'arch' });
  mapped(o, 'relation/3367715', 17, { slot: 'limestone', color: pale, roof: 5, levels: 3 });
  mapped(o, 'relation/3367850', 22, {
    slot: 'limestone',
    color: [0.43, 0.42, 0.35],
    roof: 7,
    levels: 3,
  });
  mapped(o, 'relation/3367883', 7, { roof: 3, levels: 1 });
  const colors = [
    [0.85, 0.75, 0.49],
    [0.69, 0.33, 0.24],
    [0.73, 0.8, 0.76],
    [0.34, 0.57, 0.69],
    [0.89, 0.7, 0.55],
    [0.82, 0.8, 0.68],
  ];
  for (const [i, id] of laneIds.entries()) {
    const rs = rings(`relation/${id}`, low ? 1 : 0.12);
    prism(o, rs, 0, 6.5, 'plaster', colors[i % colors.length]);
    roofFor(o, rs, 6.5, 2.3);
    if (!low) {
      const [x0, , x1, z1] = bounds(rs[0]),
        f = frame(o, (x0 + x1) / 2, 0, z1, 0);
      arch(f, -(x1 - x0) * 0.22, 0.1, 1.05, 2.25, {
        pointed: false,
        lights: 1,
        slot: 'wood',
        color: [0.21, 0.16, 0.09],
      });
      window(f, (x1 - x0) * 0.23, 1.1, 1.15, 1.35);
      if (fine(o)) window(f, 0, 4.4, 0.55, 0.85);
    }
  }
  // Defensive gallery remains above the houses; compact rectangular slots face north.
  if (!low) {
    pitched(o, [154, -74], [256, -70], 3.8, 7.5, 1.5);
    if (fine(o)) {
      const f = lineFrame(o, [256, -72.4], [154, -76.4]);
      for (let x = 2; x < 101; x += 3) rect(f, x, 5.1, 0.25, 1.4);
    }
  }
}
export const pragueParts = { palaceRanges, cathedral, basilica, smallerBuildings, defences };
export function buildPragueRuntime(out, detail) {
  const o = { ...out, detail };
  for (const fn of Object.values(pragueParts)) fn(o);
}
export function buildPragueSkyline(out) {
  const o = { ...out, detail: 'skyline' };
  // Distant model keeps court holes and the cathedral's three unequal tower silhouettes.
  for (const [id, h] of [
    ['relation/3367557', 25],
    ['relation/28649', 23],
    ['relation/3367881', 20],
    ['relation/28652', 15],
    ['relation/15317896', 15],
  ])
    prism(o, rings(id, 7), 0, h, 'plaster', plaster);
  for (const [a, b, w, y, rise] of [
    [[-247, -72], [-163, -62], 21, 25, 8],
    [[-235, -59], [-224, 64], 16, 25, 7],
    [[-175, -59], [-171, 65], 19, 25, 7],
    [[-223, 64], [-169, 65], 17, 25, 7],
    [[-168, 66], [-126, 78], 17, 25, 7],
    [[-126, 78], [-77, 59], 17, 25, 7],
    [[-79, 59], [-38, 38], 17, 25, 7],
    [[-43, 27], [24, 25], 29, 25, 12],
    [[42, 21], [188, -2], 13, 23, 6],
    [[48, -3], [193, -23], 12, 23, 6],
    [[202, -19], [268, -10], 10, 20, 5],
    [[205, 4], [267, -7], 11, 20, 5],
    [[48, -66], [91, -65], 15, 15, 5],
    [[49, -62], [49, -34], 10, 15, 5],
    [[51, -31], [89, -31], 10, 15, 5],
    [[87, -64], [88, -31], 10, 15, 5],
  ])
    pitched(o, a, b, w, y, rise);
  box(o, 'limestone', [-137, 0, -46], [-27, 17, -9], stone);
  box(o, 'limestone', [-139, 17, -35], [-29, 40, -22], stone);
  pitched(o, [-139, -28.5], [-29, -28.5], 13, 40, 15, { slot: 'slate', color: slate });
  for (const z of [-37.6, -16.5]) {
    box(o, 'limestone', [-138.8, 0, z - 4.6], [-129.6, 65, z + 4.6], stone);
    spire(o, -134.2, z, 65, 20, 3, 'limestone', stone);
  }
  box(o, 'limestone', [-102.3, 0, -18.5], [-88, 62, -4.3], stone);
  onion(o, -95.15, -11.4, 62, 34.3, 5.5);
  cross(o, -95.15, -11.4, 96.3, 3);
  box(o, 'limestone', [-85, 0, -51], [-72, 42, 3], stone);
  spire(o, -79, -29, 53, 27, 2, 'slate', slate);
  box(o, 'limestone', [47, 0, -27], [94, 19, -7], pale);
  for (const z of [-27.1, -11]) {
    box(o, 'limestone', [77, 0, z - 3], [82, 29, z + 3], pale);
    spire(o, 79.5, z, 29, 12, 4, 'limestone', pale);
  }
  for (const [x, z, r, y] of [
    [-71, -82, 9, 27],
    [144, -73, 7, 17],
    [260, -33, 6, 22],
  ]) {
    box(o, 'limestone', [x - r, 0, z - r], [x + r, y, z + r], pale);
    spire(o, x, z, y, 8, r, 'tile', tiles);
  }
  box(o, 'plaster', [153, 0, -76], [258, 8, -66], plaster);
}
export const pragueStudy = {
  id: 'N0240',
  key: 'prague_castle',
  title: 'Prague Castle',
  category: 'castle',
  wikidataId: 'Q193369',
  build: (out) => buildPragueRuntime(out),
  brief:
    'Mapped castle complex with open second and third courtyards, St Vitus Cathedral and its unequal Gothic and Baroque towers, St George Basilica, royal palace ranges, Rosenberg and Lobkowicz palaces, Powder and Black towers and the small Golden Lane houses.',
  sourceFacts: {
    cathedralSouthTowerHeightMeters: 99.3,
    stGeorgeTowerHeightMeters: 41,
    cathedralCompletion: 1929,
    footprints: 'Individual OpenStreetMap relations and ways, retrieved 2026-10-04',
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Individual mapped polygons with court holes, separately reconstructed elevations and roofs from the official visitor plan and inspected exterior photographs.',
    verticalDatum: 'Provisional shared base; actual sloping site levels are pending.',
    roofProfiles:
      'Individually arranged palace roof runs; cathedral mapped nave, choir and chapel parts. Minor roofs use oriented enclosing rectangles.',
  },
  scaleBasis:
    'Meter-scale map coordinates in the cached signed precinct frame. Municipal published tower heights constrain the main vertical landmarks; palace levels, roof rises and smaller detail are estimates.',
  refs: [
    'https://www.openstreetmap.org/relation/3312247',
    'https://www.hrad.cz/en/prague-castle-for-visitors/castle-map',
    'https://www.hrad.cz/en/prague-castle-for-visitors/objects-for-visitors/st.-vitus-cathedral-10330',
    'https://www.hrad.cz/en/prague-castle-for-visitors/objects-for-visitors/old-royal-palace-10332',
    'https://virtualni.praha.eu/towers/cathedral-of-st-vitus-at-prague-castle',
    'https://virtualni.praha.eu/towers/basilica-of-st-george-at-the-prague-castle',
    'https://commons.wikimedia.org/wiki/File:Panoramic_view_of_St._Vitus_Cathedral_and_Prague_Castle_grounds.jpg',
    'https://commons.wikimedia.org/wiki/File:West_facade_of_St._Vitus_Cathedral-Prague.jpg',
    'https://commons.wikimedia.org/wiki/File:Bazilika_Svat%C3%A9ho_Ji%C5%99%C3%AD-Prague.JPG',
  ],
  sourceDocuments: ['map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Individual map geometry derives from © OpenStreetMap contributors, ODbL-1.0; map-parts.json records source, date, meter frame and tags. Photographs are linked only; no photographic pixels or third-party mesh are included.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X from western palace toward the eastern gate',
    front: '+Z toward the southern gardens',
    origin: 'Cached OSM precinct center; provisional base datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Individual horizontal map parts; terrain datum and full geographic fit pending',
    notes:
      'Retain cached signed heading and anchor. The precinct includes open courts; never replace its complete polygon with a building. Real cross-site terrain and roof alignment need review before activation.',
  }),
  geographicNote:
    'Draft geographic registration; original mapped meter frame retained. Cross-site heights and terrain contact must be checked before enabling automatic footprint replacement.',
  limitations: [
    'Maximum exterior fidelity remains pending. Reconstructed exterior is not surveyed as-built geometry; smaller elevations, roof valleys, facade bay spacing and ground levels need verification.',
    'Cathedral rose tracery, buttresses, portal carvings, saints, heraldic lion and Golden Gate mosaic are incomplete. Geometry indicates architectural form without claiming individually reproduced sculpture.',
    'Golden Lane colors and roof profiles are approximate; its small houses and northern gallery use mapped plan positions. Daliborka and north-facing defensive details need additional source coverage.',
    'No interiors, gardens, terrain hill, temporary scaffolding or copied photographs. Palace courtyard holes remain empty and require host terrain.',
    'Canonical shared limestone, raw limestone, lime plaster, ceramic tile, slate, copper, painted metal, wood and granite graphs are reused; glazing is local PBR.',
  ],
  camera: { position: [-250, 220, 390], lookAt: [-12, 24, 0], fov: 42 },
  qaCameras: [
    { name: 'west-courtyards', position: [-365, 125, 155], lookAt: [-170, 18, 0] },
    { name: 'cathedral-west', position: [-248, 76, -28], lookAt: [-133, 47, -27] },
    { name: 'south-tower-and-golden-gate', position: [-132, 46, 80], lookAt: [-85, 40, -14] },
    { name: 'cathedral-north', position: [-91, 59, -138], lookAt: [-80, 29, -28] },
    { name: 'cathedral-choir', position: [83, 81, -33], lookAt: [-45, 37, -29] },
    { name: 'saint-george-west', position: [1, 39, -17], lookAt: [72, 19, -18] },
    { name: 'eastern-palaces', position: [215, 118, 155], lookAt: [150, 13, -20] },
    { name: 'golden-lane', position: [176, 7.8, -65], lookAt: [204, 3.5, -67] },
    { name: 'open-courts-plan', position: [0, 590, 80], lookAt: [0, 0, 0] },
  ],
};
