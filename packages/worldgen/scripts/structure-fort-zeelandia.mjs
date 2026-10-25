/** Current Anping Fort: later terraced platform, arcaded hall and square lookout; separate ruins. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const ref = 'palette:#ffffff',
  defaultFrame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ws/wsj/fort_zeelandia/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  wallLayout = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ws/wsj/fort_zeelandia/surviving-wall-layout.json',
        import.meta.url,
      ),
    ),
  );
const white = rgb('e5e2d7'),
  brick = rgb('95634e'),
  stone = rgb('b8b8ae'),
  dark = rgb('343d3b'),
  glazing = rgb('627775'),
  tile = rgb('626b6b'),
  red = rgb('b15533');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  tint = (c, t) => c.map((v) => Math.min(1, v * t));
function triangle(o, s, p, c, n) {
  p = p.map((q) => q.map(Math.fround));
  let normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.5) return;
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    normal = normal.map((v) => -v);
  }
  o.addTriangle(
    s,
    ref,
    p,
    normal,
    p.map((q) => [q[0] + q[2], q[1]]),
    c,
  );
}
function quad(o, s, p, c, n) {
  triangle(o, s, [p[0], p[1], p[2]], c, n);
  triangle(o, s, [p[0], p[2], p[3]], c, n);
}
function strip(o, s, a, b, width, colour, n) {
  const axis = b.map((v, i) => v - a[i]),
    v = [
      n[1] * axis[2] - n[2] * axis[1],
      n[2] * axis[0] - n[0] * axis[2],
      n[0] * axis[1] - n[1] * axis[0],
    ],
    len = Math.hypot(...v);
  if (len < 0.0001) return;
  const offset = v.map((x) => (x * width) / len / 2);
  quad(
    o,
    s,
    [
      a.map((v, i) => v - offset[i]),
      b.map((v, i) => v - offset[i]),
      b.map((v, i) => v + offset[i]),
      a.map((v, i) => v + offset[i]),
    ],
    colour,
    n,
  );
}
function polygon(o, s, p, c, n) {
  const k = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[2]) > 0.7 ? 2 : 0,
    axes = k === 1 ? [0, 2] : k === 2 ? [0, 1] : [2, 1],
    ids = earcut(p.flatMap((q) => axes.map((i) => q[i])));
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      s,
      ids.slice(i, i + 3).map((j) => p[j]),
      c,
      n,
    );
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const rect = (x, z, hx, hz) => [
    [x - hx, z - hz],
    [x + hx, z - hz],
    [x + hx, z + hz],
    [x - hx, z + hz],
  ],
  outward = (r, i) => {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len];
  },
  expanded = (r, k) => {
    const lo = [0, 1].map((i) => Math.min(...r.map((p) => p[i]))),
      hi = [0, 1].map((i) => Math.max(...r.map((p) => p[i])));
    return r.map((p) =>
      p.map(
        (v, i) => (lo[i] + hi[i]) / 2 + (v - (lo[i] + hi[i]) / 2) * (1 + (2 * k) / (hi[i] - lo[i])),
      ),
    );
  };
function cap(o, s, r, y, c, n = [0, 1, 0]) {
  polygon(
    o,
    s,
    r.map((p) => [p[0], y, p[1]]),
    c,
    n,
  );
}
function solid(o, s, r, lo, hi, c, { topSlot = s, topColor = c } = {}) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      c,
      outward(r, i),
    );
  }
  cap(o, topSlot, r, hi, topColor);
  cap(o, s, r, lo, c, [0, -1, 0]);
}
function opening(x, y, w, h, { arched = false, rounded = false, steps = 8 } = {}) {
  if (rounded) {
    const r = 0.18;
    return [
      [x - w / 2 + r, y],
      [x + w / 2 - r, y],
      [x + w / 2, y + r],
      [x + w / 2, y + h],
      [x - w / 2, y + h],
      [x - w / 2, y + r],
    ];
  }
  if (!arched)
    return [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2, y + h],
      [x - w / 2, y + h],
    ];
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  for (let j = 0; j <= steps; j++) {
    const a = (Math.PI * j) / steps;
    p.push([x + (Math.cos(a) * w) / 2, y + h - 0.35 + Math.sin(a) * 0.35]);
  }
  return p;
}
function recess(o, map, n, poly, d, { depth = 0.22, door = false, frame = true } = {}) {
  const front = poly.map((p) => map(...p)),
    rear = front.map((p) => p.map((v, i) => v - n[i] * depth));
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    quad(o, 'plaster', [front[i], front[j], rear[j], rear[i]], white);
  }
  polygon(o, door ? 'metal' : 'glass', rear, door ? dark : glazing, n);
  if (frame && d > 0)
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      if (d > 1)
        beam(
          o,
          'metal',
          front[i].map((v, k) => v + n[k] * 0.025),
          front[j].map((v, k) => v + n[k] * 0.025),
          0.06,
          0.05,
          dark,
        );
      else {
        const a = front[i],
          b = front[j],
          dy = b[1] - a[1],
          dx = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (Math.hypot(dx, dy) > 0.04) strip(o, 'metal', a, b, 0.07, dark, n);
      }
    }
}
function panel(o, s, len, lo, hi, map, n, holes, d, c) {
  const ps = [
      [0, lo],
      [len, lo],
      [len, hi],
      [0, hi],
    ],
    polys = holes.map((h) => h.poly),
    all = [...ps, ...polys.flat()],
    starts = [];
  let off = 4;
  for (const p of polys) {
    starts.push(off);
    off += p.length;
  }
  const ids = earcut(all.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      s,
      ids.slice(i, i + 3).map((j) => map(...all[j])),
      c,
      n,
    );
  for (const h of holes) recess(o, map, n, h.poly, d, h);
}
function facade(o, r, lo, hi, d, { doors = [], windows = true } = {}) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(r, i),
      map = (x, y) => [a[0] + ((b[0] - a[0]) * x) / len, y, a[1] + ((b[1] - a[1]) * x) / len],
      holes = [];
    if (windows)
      for (const y of (d === 0 ? [8.8] : [6.0, 8.8, 11.3]).filter(
        (y) => y > lo + 0.1 && y + 1.1 < hi - 0.1,
      ))
        holes.push({ poly: opening(len * 0.5, y, 0.65, 1.1) });
    if (doors.includes(i))
      holes.push({ poly: opening(len * 0.5, lo + 0.02, 0.95, 2), door: true, depth: 0.35 });
    panel(o, 'plaster', len, lo, hi, map, n, holes, d, white);
  }
  cap(o, 'plaster', r, hi, white);
}
function roof(
  o,
  cx,
  cz,
  hx,
  hz,
  eave,
  rise,
  d,
  { colour = tile, topX = 0.12, topZ = 0.12, curl = 0.12 } = {},
) {
  const steps = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 8,
    div = d === 3 ? 4 : d === 2 ? 2 : 1,
    rings = [];
  for (let j = 0; j <= steps; j++) {
    const t = j / steps,
      x = hx + (topX - hx) * t,
      z = hz + (topZ - hz) * t,
      r = rect(cx, cz, x, z),
      ps = [];
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < div; k++) {
        const u = k / div,
          p = mix(r[i], r[(i + 1) % 4], u),
          y = eave + rise * t + curl * (1 - t) * (1 - t) * (1 + Math.pow(Math.abs(2 * u - 1), 4));
        ps.push([p[0], y, p[1]]);
      }
    rings.push(ps);
  }
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      quad(
        o,
        'roof',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        colour,
        [0, 1, 0],
      );
    }
  polygon(o, 'roof', rings.at(-1), colour, [0, 1, 0]);
  for (let i = 0; i < rings[0].length; i++) {
    const j = (i + 1) % rings[0].length,
      a = rings[0][i],
      b = rings[0][j];
    quad(o, 'plaster', [a, b, [b[0], b[1] - 0.16, b[2]], [a[0], a[1] - 0.16, a[2]]], white);
  }
  const inset = 0.8,
    outer = rect(cx, cz, hx, hz),
    inner = rect(cx, cz, hx - inset, hz - inset);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    quad(
      o,
      'plaster',
      [
        [...outer[i].slice(0, 1), eave - 0.05, outer[i][1]],
        [outer[k][0], eave - 0.05, outer[k][1]],
        [inner[k][0], eave - 0.2, inner[k][1]],
        [inner[i][0], eave - 0.2, inner[i][1]],
      ],
      white,
      [0, -1, 0],
    );
  }
  if (d > 1) {
    for (let i = 0; i < 4; i++) {
      const a = outer[i],
        b = outer[(i + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        num = Math.floor(len / (d === 3 ? 0.7 : 2.5)),
        n = outward(outer, i);
      for (let j = 1; j < num; j++) {
        const p = mix(a, b, j / num);
        beam(
          o,
          'plaster',
          [p[0] - n[0] * 0.7, eave - 0.2, p[1] - n[2] * 0.7],
          [p[0] - n[0] * 0.05, eave - 0.12, p[1] - n[2] * 0.05],
          0.09,
          0.11,
          white,
        );
      }
    }
  }
  if (d === 3)
    for (let j = 1; j < steps; j++) {
      const a = rings[j];
      for (let i = 0; i < a.length; i++) {
        const k = (i + 1) % a.length,
          b = mix(a[i], rings[j + 1][i], 0.025),
          c = mix(a[k], rings[j + 1][k], 0.025);
        quad(
          o,
          'roof',
          [
            a[i].map((v, k) => v + (k === 1 ? 0.015 : 0)),
            a[k].map((v, k) => v + (k === 1 ? 0.015 : 0)),
            c.map((v, k) => v + (k === 1 ? 0.015 : 0)),
            b.map((v, k) => v + (k === 1 ? 0.015 : 0)),
          ],
          tint(colour, 0.93),
          [0, 1, 0],
        );
      }
    }
}
function platform(o, r, d) {
  const rings = [
    [expanded(r, 3.5), -2],
    [expanded(r, 2.8), 1.3],
    [expanded(r, 2), 1.3],
    [expanded(r, 1.3), 3.0],
    [expanded(r, 0.6), 3.0],
    [r, 4.8],
  ];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < r.length; i++) {
      const k = (i + 1) % r.length,
        ra = rings[j - 1],
        rb = rings[j],
        a = [ra[0][i][0], ra[1], ra[0][i][1]],
        b = [ra[0][k][0], ra[1], ra[0][k][1]],
        c = [rb[0][k][0], rb[1], rb[0][k][1]],
        dd = [rb[0][i][0], rb[1], rb[0][i][1]],
        n = outward(r, i);
      quad(o, 'brick', [a, b, c, dd], brick, ra[1] === rb[1] ? [0, 1, 0] : n);
      if (d > 1 && rb[1] - ra[1] > 0.1) {
        const rows = Math.ceil((rb[1] - ra[1]) / (d === 3 ? 0.22 : 0.75)),
          cols = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (d === 3 ? 1.1 : 4));
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < cols; x++) {
            const u0 = x / cols + 0.02 / cols,
              u1 = (x + 1) / cols - 0.02 / cols,
              v0 = (y + 0.06) / rows,
              v1 = (y + 0.94) / rows,
              map = (u, v) => mix(mix(a, b, u), mix(dd, c, u), v).map((v, k) => v + n[k] * 0.012);
            quad(
              o,
              'brick',
              [map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)],
              tint(brick, 0.94 + ((x * 17 + y * 13 + i) % 11) * 0.012),
              n,
            );
          }
      }
    }
  cap(o, 'brick', r, 4.8, tint(brick, 0.94));
  cap(o, 'brick', rings[0][0], -2, brick, [0, -1, 0]);
}
function rail(o, r, d) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(r, i),
      num = Math.ceil(len / (d === 0 ? 8 : d === 1 ? 4.5 : 2.8));
    for (let j = 0; j < num; j++) {
      const u = (j + 0.5) / num,
        mid = mix(a, b, u),
        skip =
          (i === 2 && Math.abs(mid[0]) < 3.4) || ((i === 3 || i === 4) && Math.abs(mid[1]) < 4.5);
      if (skip) continue;
      const left = mix(a, b, j / num),
        right = mix(a, b, (j + 1) / num),
        q = facing(o, Math.atan2(n[0], n[2]), ...mid),
        w = len / num - 0.32;
      if (d <= 1) {
        for (const slope of [-1, 1])
          quad(
            q,
            'brick',
            [
              [-w / 2, 5.0 + (slope < 0 ? 0.65 : 0), 0],
              [w / 2, 5.0 + (slope > 0 ? 0.65 : 0), 0],
              [w / 2, 5.13 + (slope > 0 ? 0.65 : 0), 0],
              [-w / 2, 5.13 + (slope < 0 ? 0.65 : 0), 0],
            ],
            brick,
            [0, 0, 1],
          );
        quad(
          o,
          'concrete',
          [
            [left[0], 5.92, left[1]],
            [right[0], 5.92, right[1]],
            [right[0], 5.78, right[1]],
            [left[0], 5.78, left[1]],
          ],
          stone,
          n,
        );
      } else {
        beam(o, 'brick', [left[0], 4.8, left[1]], [left[0], 5.92, left[1]], 0.32, 0.35, brick);
        beam(o, 'concrete', [left[0], 5.86, left[1]], [right[0], 5.86, right[1]], 0.2, 0.42, stone);
        for (const cx of d === 1 ? [0] : [-w * 0.25, w * 0.25])
          for (const s of [-1, 1])
            beam(
              q,
              'brick',
              [cx - w * 0.24, 5.05 + (s < 0 ? 0.64 : 0), 0],
              [cx + w * 0.24, 5.05 + (s > 0 ? 0.64 : 0), 0],
              0.14,
              0.16,
              brick,
            );
      }
    }
  }
}
function stairs(o, d) {
  // The wide ceremonial approach is on the west; the southern flight serves a higher court.
  const westCount = d === 0 ? 4 : 27;
  for (let j = 0; j < westCount; j++) {
    const y = 0.3 + (4.5 * (j + 1)) / westCount,
      x = -22 - ((westCount - j - 0.5) * 10) / westCount;
    B(o, 'brick', x, -2, 0, 10 / westCount + 0.01, y + 2, 7.2, brick);
  }
  const southCount = d === 0 ? 3 : 19;
  for (let j = 0; j < southCount; j++) {
    const y = 1.65 + (3.15 * (j + 1)) / southCount,
      z = 22.3 + ((southCount - j - 0.5) * 7) / southCount;
    B(o, 'brick', -0.2, -2, z, 5.2, y + 2, 7 / southCount + 0.01, brick);
  }
  if (d > 0) {
    for (const z of [-4.0, 4.0]) {
      beam(o, 'metal', [-31.8, 1.35, z], [-22.2, 5.8, z], 0.11, 0.11, dark);
      for (let j = 0; j < 4; j++) {
        const x = -30.5 + j * 2.6,
          y = 0.3 + ((x + 32) * 4.5) / 10;
        B(o, 'metal', x, y, z, 0.1, 1, 0.1, dark);
      }
    }
    for (const x of [-3.1, 2.7])
      beam(o, 'metal', [x, 2.65, 29.1], [x, 5.8, 22.5], 0.09, 0.09, dark);
  }
  for (const z of [-4.25, 4.25]) B(o, 'concrete', -21.95, 4.8, z, 0.45, 2.0, 0.45, stone);
}
function arcade(o, a, b, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
    map = (x, y, z = 0) => [
      a[0] + ((b[0] - a[0]) * x) / len + n[0] * z,
      y,
      a[1] + ((b[1] - a[1]) * x) / len + n[2] * z,
    ],
    count = d === 0 ? 1 : Math.max(1, Math.round(len / 3.4)),
    w = len / count;
  for (let j = 0; j < count; j++) {
    const x0 = j * w + 0.18,
      x1 = (j + 1) * w - 0.18,
      steps = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 6 : 10,
      p = [];
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      p.push([x0 + (x1 - x0) * u, 7.62 + 0.45 * Math.sin(Math.PI * u)]);
    }
    p.push([x1, 8.55], [x0, 8.55]);
    polygon(
      o,
      'plaster',
      p.map((p) => map(...p)),
      white,
      n,
    );
    polygon(
      o,
      'plaster',
      p.map((p) => map(...p, -0.28)),
      white,
      n.map((v) => -v),
    );
    for (let k = 1; k <= steps; k++)
      quad(
        o,
        'plaster',
        [map(...p[k - 1]), map(...p[k]), map(...p[k], -0.28), map(...p[k - 1], -0.28)],
        white,
        [0, -1, 0],
      );
  }
  for (let j = 0; j <= count; j++) {
    const p = map(j * w, 5.05),
      q = facing(o, Math.atan2(n[0], n[2]), p[0], p[2]);
    B(q, 'concrete', 0, 5.05, -0.14, 0.42, 2.61, 0.44, white);
    if (d > 1) {
      B(q, 'concrete', 0, 5.05, -0.14, 0.62, 0.17, 0.6, stone);
      B(q, 'concrete', 0, 7.56, -0.14, 0.63, 0.13, 0.6, stone);
      B(q, 'concrete', 0, 7.69, -0.14, 0.56, 0.11, 0.55, stone);
    }
  }
}
function hall(o, frame, d) {
  const native = frame.features.find((f) => f.index === 0).rings[0];
  solid(o, 'concrete', native, 4.8, 5.05, stone, { topSlot: 'brick', topColor: brick });
  const core = [
    [-8.8, -3.3],
    [4.4, -3.3],
    [7.3, -1.7],
    [7.0, 7.55],
    [-9.0, 7.55],
  ];
  for (let i = 0; i < core.length; i++) {
    const a = core[i],
      b = core[(i + 1) % core.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(core, i),
      map = (x, y) => [a[0] + ((b[0] - a[0]) * x) / len, y, a[1] + ((b[1] - a[1]) * x) / len],
      count = d === 0 ? 0 : Math.floor(len / 3.2),
      holes = Array.from({ length: count }, (_, j) => ({
        poly: opening((len * (j + 0.5)) / count, 5.48, Math.min(1.1, (len / count) * 0.55), 2.05),
        door: i === 2 && j === Math.floor(count / 2),
        depth: 0.2,
      }));
    panel(o, 'plaster', len, 5.05, 8.18, map, n, holes, d, white);
    if (d > 1)
      for (const h of holes) {
        const xs = h.poly.map((p) => p[0]),
          x0 = Math.min(...xs),
          x1 = Math.max(...xs),
          y0 = 5.48,
          y1 = 7.53,
          inset = (x, y) => map(x, y).map((v, i) => v - n[i] * 0.14),
          bar = (a, b) =>
            d === 2
              ? strip(o, 'metal', a, b, 0.045, dark, n)
              : beam(o, 'metal', a, b, 0.045, 0.045, dark);
        bar(inset((x0 + x1) / 2, y0), inset((x0 + x1) / 2, y1));
        for (let j = 1; j < 5; j++)
          bar(inset(x0, y0 + ((y1 - y0) * j) / 5), inset(x1, y0 + ((y1 - y0) * j) / 5));
      }
  }
  cap(o, 'plaster', core, 8.18, white);
  for (const [a, b] of [
    [
      [-9.7, -5.0],
      [4.4, -4.5],
    ],
    [
      [9.35, -1.8],
      [8.85, 10.05],
    ],
    [
      [8.85, 10.05],
      [-10.75, 9.1],
    ],
    [
      [-10.75, 9.1],
      [-9.7, -5.0],
    ],
  ])
    arcade(o, a, b, d);
  roof(o, -0.9, 2.2, 11, 8.8, 8.2, 1.0, d, { topX: 9, topZ: 6.8 });
  roof(o, -0.9, 2.2, 9.35, 6.6, 9.15, 1.4, d, { topX: 5.5, topZ: 0.12 });
  const wing = rect(8.7, -8.3, 2.8, 5.6);
  facade(o, wing, 5.05, 8.18, d, { windows: true });
  roof(o, 8.7, -8.3, 4.4, 7.2, 8.2, 2.0, d, { topX: 0.12, topZ: 2.9 });
  if (d > 0)
    for (const x of [-9.0, 7.6])
      for (let j = 0; j < 3; j++)
        B(o, 'concrete', x, 4.8 + j * 0.08, 10.45 + (2 - j) * 0.22, 2.4, 0.08, 0.22, stone);
}
function tower(o, frame, d) {
  const [cx, cz] = frame.towerControl.center,
    q = facing(o, -frame.heading, cx, cz),
    r = rect(0, 0, 2, 2);
  facade(q, r, 4.8, 13.2, d, { doors: [2] });
  B(q, 'concrete', 0, 7.75, 0, 4.08, 0.1, 4.08, white);
  B(q, 'concrete', 0, 10.5, 0, 4.08, 0.1, 4.08, white);
  B(q, 'concrete', 0, 12.98, 0, 6.12, 0.22, 6.12, white);
  for (let side = 0; side < 4; side++) {
    const qq = facing(q, (side * Math.PI) / 2),
      map = (u, y) => {
        const h = 3 + ((y - 13.2) / 3) * 0.5;
        return [(u - 1) * h, y, h];
      },
      poly = opening(1, 13.55, 1.72, 2.33, { rounded: true }),
      holes = [{ poly, depth: 0.16 }];
    panel(qq, 'plaster', 2, 13.2, 16.2, map, [0, -0.1667, 1], holes, d, white);
    if (d > 0) {
      for (const u of [0.58, 1, 1.42])
        beam(
          qq,
          'metal',
          map(u, 13.58).map((v, i) => v + (i === 2 ? 0.025 : 0)),
          map(u, 15.86).map((v, i) => v + (i === 2 ? 0.025 : 0)),
          0.055,
          0.055,
          dark,
        );
      beam(qq, 'metal', map(0.15, 15.55), map(1.85, 15.55), 0.07, 0.06, dark);
    }
  }
  cap(q, 'plaster', rect(0, 0, 3.5, 3.5), 16.2, white);
  roof(q, 0, 0, 4, 4, 16.2, 3.3, d, { colour: red, curl: 0 });
  B(q, 'metal', 0, 19.5, 0, 0.055, 0.28, 0.055, dark);
}

function ruinedRun(o, run, d, { south = false, north = false } = {}) {
  const first = run[0],
    last = run.at(-1),
    length = Math.hypot(last[0] - first[0], last[1] - first[1]),
    angle = Math.atan2(-(last[1] - first[1]), last[0] - first[0]),
    q = facing(o, angle, first[0], first[1]),
    all = run.map((p) => [Math.hypot(p[0] - first[0], p[1] - first[1]), p[2]]),
    profile =
      d === 0
        ? [all[0], all[Math.floor(all.length / 2)], all.at(-1)].filter(
            (p, i, a) => i === 0 || p[0] - a[i - 1][0] > 0.01,
          )
        : all,
    width = (y) => (south ? 0.82 : 0.52) - 0.035 * y,
    normal = (sign) => [0, 0.035, sign],
    map = (x, y, sign = 1, depth = 0) => [x, y, sign * (width(y) - depth)],
    topAt = (x) => {
      for (let j = 1; j < all.length; j++)
        if (x <= all[j][0]) {
          const a = all[j - 1],
            b = all[j];
          return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
        }
      return all.at(-1)[1];
    },
    base = -3;
  const door = south
      ? {
          x: length * wallLayout.southDoor.fraction,
          y: wallLayout.southDoor.baseY,
          w: wallLayout.southDoor.width,
          h: wallLayout.southDoor.height,
          through: true,
        }
      : null,
    voids = [];
  if (door) voids.push(door);
  if (d > 0) {
    const count = south ? (d === 1 ? 2 : d === 2 ? 7 : 11) : north ? (d === 1 ? 2 : 5) : 0;
    for (let j = 0; j < count; j++) {
      const x = (length * (j + 0.6)) / (count + 0.4),
        y = north ? 0.35 : 2.35 + (j % 3) * 0.68,
        w = north ? 0.85 : 0.24 + ((j * 7) % 3) * 0.07,
        h = north ? 0.95 : 0.25 + ((j * 5) % 4) * 0.055;
      if (!door || Math.abs(x - door.x) > (door.w + w) / 2 + 0.2)
        voids.push({ x, y, w, h, through: false });
    }
  }
  const shape = (h) => opening(h.x, h.y, h.w, h.h),
    outer = [[0, base], [length, base], ...profile.slice().reverse()];
  for (const sign of [-1, 1]) {
    const holes = voids.filter((h) => h.through || sign === 1),
      ps = holes.map(shape),
      flat = [...outer, ...ps.flat()],
      starts = [];
    let start = outer.length;
    for (const p of ps) {
      starts.push(start);
      start += p.length;
    }
    const ids = earcut(flat.flat(), starts),
      n = normal(sign);
    for (let j = 0; j < ids.length; j += 3)
      triangle(
        q,
        'brick',
        ids.slice(j, j + 3).map((i) => map(...flat[i], sign)),
        tint(brick, 0.9),
        n,
      );
    for (const h of holes) {
      const p = shape(h),
        front = p.map((p) => map(...p, sign)),
        back = p.map((p) => (h.through ? map(...p, -sign) : map(...p, sign, 0.26)));
      if (h.through && sign === -1) continue;
      for (let j = 0; j < p.length; j++) {
        const k = (j + 1) % p.length;
        quad(q, 'brick', [front[j], front[k], back[k], back[j]], tint(brick, 0.75));
      }
      if (!h.through) polygon(q, 'brick', back, tint(brick, 0.63), n);
    }
    if (d > 0) {
      // Connected lime-plaster loss, rather than repeated decorative patches.
      // This is original bounded wear geometry; no photograph pixels are copied.
      const noise = (x, y) => {
          const ix = Math.floor(x),
            iy = Math.floor(y),
            hash = (a, b) => {
              let n =
                Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.round(length * 97) ^ sign;
              n = Math.imul(n ^ (n >>> 13), 1274126177);
              return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
            },
            smooth = (v) => v * v * (3 - 2 * v),
            u = smooth(x - ix),
            v = smooth(y - iy);
          return (
            (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
            (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
          );
        },
        field = (x, y) =>
          0.55 * noise(x / 4, y / 2) +
          0.3 * noise(x / 1.3, y / 0.8) +
          0.15 * noise(x / 0.4, y / 0.3) +
          ((0.7 * y) / topAt(x) - 0.35),
        clip = (poly, value) => {
          const out = [];
          for (let j = 0; j < poly.length; j++) {
            const a = poly[j],
              b = poly[(j + 1) % poly.length],
              va = value(a),
              vb = value(b);
            if (va >= 0) out.push(a);
            if (va < 0 !== vb < 0) out.push(a.map((v, i) => v + ((b[i] - v) * va) / (va - vb)));
          }
          return out;
        },
        withoutHole = (poly, h) => {
          const pieces = [],
            bounds = [
              (p) => h.x - h.w / 2 - 0.015 - p[0],
              (p) => p[0] - h.x - h.w / 2 - 0.015,
              (p) => h.y - 0.015 - p[1],
              (p) => p[1] - h.y - h.h - 0.015,
            ];
          let inside = poly;
          for (const bound of bounds) {
            const outside = clip(inside, bound);
            if (outside.length >= 3) pieces.push(outside);
            inside = clip(inside, (p) => -bound(p));
            if (inside.length < 3) break;
          }
          return pieces;
        },
        step = d === 1 ? 8 : d === 2 ? 2 : 0.65,
        sy = d === 1 ? 3 : d === 2 ? 1.3 : 0.6,
        xs = [
          ...new Set([
            0,
            length,
            ...all.map((p) => p[0]),
            ...Array.from({ length: Math.floor(length / step) }, (_, j) => (j + 1) * step),
          ]),
        ].sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++)
        for (let y = 0.015; y < Math.max(topAt(xs[i - 1]), topAt(xs[i])); y += sy) {
          const x0 = xs[i - 1],
            x1 = xs[i],
            y1 = y + sy,
            cell = [
              [x0, y],
              [x1, y],
              [x1, y1],
              [x0, y1],
            ].map((p) => [...p, field(...p)]);
          for (const ids of [
            [0, 1, 2],
            [0, 2, 3],
          ])
            for (const [limit, colour] of [
              [0.5, rgb('c7c2b2')],
              [0.72, rgb('777a73')],
            ]) {
              if (d === 1 && limit > 0.5) continue;
              let poly = clip(
                ids.map((j) => cell[j]),
                (p) => p[2] - limit,
              );
              poly = clip(poly, (p) => topAt(p[0]) - 0.04 - p[1]);
              if (poly.length < 3) continue;
              let pieces = [poly];
              for (const h of holes) pieces = pieces.flatMap((p) => withoutHole(p, h));
              for (const p of pieces)
                if (p.length >= 3)
                  polygon(
                    q,
                    'plaster',
                    p.map((p) => map(p[0], p[1], sign, limit === 0.5 ? -0.018 : -0.022)),
                    colour,
                    n,
                  );
            }
        }
    }
  }
  for (let j = 1; j < profile.length; j++) {
    const a = profile[j - 1],
      b = profile[j];
    quad(
      q,
      'brick',
      [map(...a, -1), map(...b, -1), map(...b, 1), map(...a, 1)],
      tint(brick, 0.8),
      [0, 1, 0],
    );
  }
  for (const [x, h, n] of [
    [0, profile[0][1], [-1, 0, 0]],
    [length, profile.at(-1)[1], [1, 0, 0]],
  ])
    quad(
      q,
      'brick',
      [map(x, base, -1), map(x, base, 1), map(x, h, 1), map(x, h, -1)],
      tint(brick, 0.77),
      n,
    );
  quad(
    q,
    'brick',
    [map(0, base, 1), map(length, base, 1), map(length, base, -1), map(0, base, -1)],
    brick,
    [0, -1, 0],
  );
  if (south) {
    for (const x of d === 0 ? [1.4] : [1.4, length * 0.47, length * 0.83]) {
      const h = Math.min(topAt(x) - 0.35, 4.4),
        a = [x - 0.9, -0.4, 1.35],
        b = [x + 0.9, -0.4, 1.35],
        c = [x + 0.35, h, 0.83],
        dd = [x - 0.35, h, 0.83];
      quad(q, 'brick', [a, b, c, dd], tint(brick, 0.84), [0, 0, 1]);
      quad(q, 'brick', [a, dd, [x - 0.35, h, 0.55], [x - 0.9, -0.4, 0.55]], brick, [-1, 0, 0]);
      quad(q, 'brick', [b, [x + 0.9, -0.4, 0.55], [x + 0.35, h, 0.55], c], brick, [1, 0, 0]);
      quad(
        q,
        'brick',
        [dd, c, [x + 0.35, h, 0.55], [x - 0.35, h, 0.55]],
        tint(brick, 0.9),
        [0, 1, 0],
      );
    }
    if (d > 1)
      for (const x of [length * 0.16, length * 0.51, length * 0.84]) {
        const z = width(4.0) + 0.05;
        B(q, 'metal', x, 3.35, z, 0.055, 1.05, 0.05, dark);
        B(q, 'metal', x, 3.53, z, 1.0, 0.055, 0.05, dark);
        const steps = d === 3 ? 10 : 5;
        for (const side of [-1, 1]) {
          let prev;
          for (let j = 0; j <= steps; j++) {
            const a = (Math.PI * j) / steps,
              p = [x + side * 0.2 + Math.cos(a) * 0.14, 4.4 + Math.sin(a) * 0.14, z];
            if (prev) beam(q, 'metal', prev, p, 0.04, 0.04, dark);
            prev = p;
          }
        }
      }
  }
  if (d > 1) {
    const spacing = d === 3 ? 0.78 : 3.0;
    for (let x = 0.2, j = 0; x < length - 0.15; x += spacing, j++) {
      if (j % 4 === 0) continue;
      const y = topAt(x) - 0.035;
      B(
        q,
        'brick',
        x,
        y,
        (((j * 17) % 7) - 3) * 0.07,
        0.2 + (j % 3) * 0.035,
        0.09 + (j % 4) * 0.025,
        0.24,
        tint(brick, 0.8 + (j % 5) * 0.045),
      );
    }
  }
}
function ruins(o, d) {
  if (wallLayout.south.length > 1) ruinedRun(o, wallLayout.south, d, { south: true });
  if (wallLayout.north.length > 1) ruinedRun(o, wallLayout.north, d, { north: true });
  for (let j = 1; j < wallLayout.southwestBastion.length; j++)
    ruinedRun(o, [wallLayout.southwestBastion[j - 1], wallLayout.southwestBastion[j]], d);
}
export function fortZeelandia(o, frame = defaultFrame, d = 3) {
  const r = frame.geometry.outline;
  platform(o, r, d);
  rail(o, r, d);
  stairs(o, d);
  hall(o, frame, d);
  tower(o, frame, d);
  ruins(o, d);
}
export const fortZeelandiaSkyline = (o) => fortZeelandia(o, undefined, 0),
  fortZeelandiaDistrict = (o) => fortZeelandia(o, undefined, 1),
  fortZeelandiaStreet = (o) => fortZeelandia(o, undefined, 2);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.08 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.32, metallic: 0.04 },
};
export const fortZeelandiaModel = {
  id: 'fort_zeelandia',
  key: 'fort_zeelandia',
  recipe: 'structure-fort-zeelandia.mjs',
  cell: 'ws/wsj',
  title: 'Fort Zeelandia',
  brief:
    'Current Anping Fort later three-tier battered brick platform with perforated railing and own broad stairs, gray double-eave tiled arcaded memorial hall and independently cardinal square white lookout with splayed glazed cabin/red pyramid roof. Separate ragged plaster/brick southern wall with real narrow gate and blind pockets/iron ties, low northern remnant and southwest broken wall remain distinct; no complete vanished Dutch fortress. Whole-model geographic/visual approval remains separate.',
  camera: [-155, 75, 140],
  lookAt: [-44, 6, -22],
  qaCameras: [
    { name: 'platform-front', position: [2, 9, 72], lookAt: [0, 6, 3] },
    { name: 'western-steps', position: [-52, 8, 9], lookAt: [-16, 5, 0] },
    { name: 'hall-arcade', position: [-14, 8, 25], lookAt: [-2, 6.8, 8] },
    { name: 'tower-cabin', position: [15, 22, 14], lookAt: [-6, 15, -13] },
    { name: 'north-and-roofs', position: [35, 27, -48], lookAt: [1, 8, -8] },
    { name: 'overhead', position: [-48, 130, 67], lookAt: [-40, 3, -20] },
    { name: 'south-wall', position: [-82, 5, 0], lookAt: [-82, 3, -18] },
    { name: 'north-remnants', position: [-30, 6, -96], lookAt: [-22, 1.7, -71] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: fortZeelandia,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent original Terrarium tile preserved before geometry:66049 fixed1m samples over256m square,3.0m lower-west-court provider datum. Original field must not be fitted/flattened; output spacing is not survey accuracy. All four actual runtime levels verify wall embedding/caps, through gate, blind recesses and native platform/hall caps;570 own stair/veranda samples clear the held-fixed field. Geographic approval remains bounded by provider and wall-trace uncertainty.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fort-zeelandia.mjs',
    level: 'skyline',
    export: 'fortZeelandiaSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'fortZeelandiaDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'fortZeelandiaStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    ...defaultFrame.limitations,
    'Whole scope now includes separate surviving southern/northern/southwest wall runs. Axes are bounded aerial/guide interpretations with3.5/4.5/5m uncertainty; original cap loss, plaster patch patterns, buttresses, tie anchors and small openings are photographic estimates. Current visual/shared/context/geographic evidence and final approval are recorded separately in qa.json.',
    'Tower ground outline uses approximate official EMAP square-footprint trace; actual red roof is displaced in aerial imagery and is not a measured ground correction. Cardinal tower is rotated independently of later platform. Terrace heights, tower shaft/cabin proportions, hall arcade bay counts and roof junctions are photographic estimates.',
    'Original photographs only constrain authored geometry/palette; no photographic pixels or copied heraldry. Modern trees, vegetation, people, temporary scaffolding, adjacent former Customs House museum and city excluded.',
    'Original independent ground remains byte-identical. Terrarium composite heights may interpolate building/vegetation; precise structural ground classification and compatibility with other host fields remain unverified.',
  ],
};
