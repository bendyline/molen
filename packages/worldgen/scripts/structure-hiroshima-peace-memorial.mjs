/** The preserved Genbaku Dome ruin: perforated masonry and bare steel, never reconstructed roofs. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  brick = rgb('94776c'),
  plaster = rgb('b4b2a4'),
  stone = rgb('aaa99a'),
  pale = rgb('c1bfae'),
  dark = rgb('55524d'),
  rust = rgb('796d65');
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
function face(o, s, ps, c, n = [0, 0, 1]) {
  o.addConvexPolygon(s, ref, ps, n, (p) => [p[0], p[1]], c);
}
function rect(o, s, x, y, z, w, h, c, n = [0, 0, 1]) {
  if (w < 0.001 || h < 0.001) return;
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    n,
    c,
  );
}
function strut(o, a, b, w, d, c = dark) {
  if (d === 0) {
    const v = b.map((x, i) => x - a[i]),
      l = Math.hypot(v[0], v[1]) || Math.hypot(v[0], v[2]),
      off =
        Math.abs(v[2]) < 0.01 ? [((-v[1] / l) * w) / 2, ((v[0] / l) * w) / 2, 0] : [w / 2, 0, 0],
      p = [
        a.map((v, i) => v + off[i]),
        b.map((v, i) => v + off[i]),
        b.map((v, i) => v - off[i]),
        a.map((v, i) => v - off[i]),
      ],
      n = normalFor(...p);
    if (Math.hypot(...n) < 0.5) return;
    quad(o, 'metal', p, n, c);
    quad(
      o,
      'metal',
      [...p].reverse(),
      n.map((v) => -v),
      c,
    );
  } else beam(o, 'metal', a, b, w, w, c);
}
function clipRegion(p, f) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      fa = f(a),
      fb = f(b);
    if (fa >= -1e-8) out.push(a);
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) {
      const u = fa / (fa - fb);
      out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
    }
  }
  return out;
}
function clipTop(p, x0, x1, t0, t1) {
  return clipRegion(p, ([x, y]) => t0 + ((t1 - t0) * (x - x0)) / (x1 - x0) - y);
}
function wall(
  o,
  a,
  b,
  top,
  holes,
  d,
  { coat = true, thickness = 0.62, seed = 0, survivingPlaster = [] } = {},
) {
  if (
    d === 0 ||
    (d === 1 && Math.max(...top.map((p) => p[1])) - Math.min(...top.map((p) => p[1])) < 0.6)
  )
    top = [top[0], top.at(-1)];
  if (d === 0 && holes.length > 3) {
    const rows = new Map();
    for (const h of holes) {
      const key = `${h[2]}/${h[3]}`;
      let r = rows.get(key);
      if (!r) {
        r = [...h];
        rows.set(key, r);
      } else {
        r[0] = Math.min(r[0], h[0]);
        r[1] = Math.max(r[1], h[1]);
      }
    }
    holes = [...rows.values()];
  }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = facing(o, -Math.atan2(b[1] - a[1], b[0] - a[0]), a[0], a[1]);
  const profile = top.map(([u, h]) => [u * len, h]);
  const at = (x) => {
    for (let i = 1; i < profile.length; i++)
      if (x <= profile[i][0] + 1e-7) {
        const [a, b] = [profile[i - 1], profile[i]];
        return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      }
    return profile.at(-1)[1];
  };
  const xs = [
      ...new Set(
        [0, len, ...profile.map((p) => p[0]), ...holes.flatMap((h) => [h[0], h[1]])].filter(
          (x) => x >= 0 && x <= len,
        ),
      ),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([
        -0.85,
        Math.max(...top.map((p) => p[1])) + 0.1,
        ...holes.flatMap((h) => [h[2], h[3]]),
      ]),
    ].sort((a, b) => a - b);
  const solid = (x, y) =>
    x >= -1e-8 &&
    x <= len + 1e-8 &&
    y >= -0.85000001 &&
    y <= at(x) + 1e-8 &&
    !holes.some((h) => x > h[0] + 1e-8 && x < h[1] - 1e-8 && y > h[2] + 1e-8 && y < h[3] - 1e-8);
  const cells = xs.slice(0, -1).map((x, i) =>
    ys.slice(0, -1).map((y, j) => {
      const x1 = xs[i + 1],
        y1 = ys[j + 1],
        inside = solid((x + x1) / 2, (y + y1) / 2),
        full = inside && y1 <= Math.min(at(x), at(x1)) + 1e-8;
      return { full, used: false };
    }),
  );
  const patches = [];
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const c = cells[i][j];
      if (c.used) continue;
      if (c.full) {
        let ii = i + 1;
        while (ii < xs.length - 1 && cells[ii][j].full && !cells[ii][j].used) ii++;
        let jj = j + 1;
        while (
          jj < ys.length - 1 &&
          Array.from({ length: ii - i }, (_, k) => cells[i + k][jj]).every((c) => c.full && !c.used)
        )
          jj++;
        for (let k = i; k < ii; k++) for (let l = j; l < jj; l++) cells[k][l].used = true;
        patches.push([
          [xs[i], ys[j]],
          [xs[ii], ys[j]],
          [xs[ii], ys[jj]],
          [xs[i], ys[jj]],
        ]);
      } else {
        const x0 = xs[i],
          x1 = xs[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1],
          x = (x0 + x1) / 2,
          y = (y0 + y1) / 2;
        if (holes.some((h) => x > h[0] && x < h[1] && y > h[2] && y < h[3])) continue;
        const p = clipTop(
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ],
          x0,
          x1,
          at(x0),
          at(x1),
        );
        const area =
          Math.abs(
            p.reduce((s, a, i) => {
              const b = p[(i + 1) % p.length];
              return s + a[0] * b[1] - b[0] * a[1];
            }, 0),
          ) / 2;
        if (area > 1e-5) patches.push(p);
      }
    }
  for (const p of patches) {
    const material = coat ? 'plaster' : 'brick',
      colour = coat ? plaster : brick;
    face(
      q,
      material,
      p.map(([x, y]) => [x, y, thickness / 2]),
      colour,
    );
    face(q, material, p.map(([x, y]) => [x, y, -thickness / 2]).reverse(), colour, [0, 0, -1]);
  }
  // Reference-estimated surviving plaster on the exposed southern brick return.
  // Clip it to solid wall cells so the painted layer cannot close a real opening.
  if (d > 1 && survivingPlaster.length)
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i],
          x1 = xs[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1];
        if (
          holes.some(
            (h) =>
              (x0 + x1) / 2 > h[0] &&
              (x0 + x1) / 2 < h[1] &&
              (y0 + y1) / 2 > h[2] &&
              (y0 + y1) / 2 < h[3],
          )
        )
          continue;
        let p = survivingPlaster;
        for (const f of [([x]) => x - x0, ([x]) => x1 - x, ([, y]) => y - y0, ([, y]) => y1 - y])
          p = clipRegion(p, f);
        p = clipTop(p, x0, x1, at(x0), at(x1));
        const area =
          Math.abs(
            p.reduce((sum, a, k) => {
              const b = p[(k + 1) % p.length];
              return sum + a[0] * b[1] - b[0] * a[1];
            }, 0),
          ) / 2;
        if (p.length >= 3 && area > 1e-5)
          face(
            q,
            'plaster',
            p.map(([x, y]) => [x, y, thickness / 2 + 0.012]),
            plaster,
          );
      }
  const edges = [];
  // Emit only exposed reveals/edges. Internal subdivisions have no hidden coplanar faces.
  if (d > 0)
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i],
          x1 = xs[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1],
          x = (x0 + x1) / 2,
          y = (y0 + y1) / 2;
        if (holes.some((h) => x > h[0] && x < h[1] && y > h[2] && y < h[3])) continue;
        const p = clipTop(
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ],
          x0,
          x1,
          at(x0),
          at(x1),
        );
        if (p.length < 3) continue;
        for (let k = 0; k < p.length; k++) {
          const a = p[k],
            b = p[(k + 1) % p.length],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            l = Math.hypot(dx, dy);
          if (l < 1e-6) continue;
          if (solid((a[0] + b[0]) / 2 + (dy / l) * 0.001, (a[1] + b[1]) / 2 - (dx / l) * 0.001))
            continue;
          edges.push([a, b]);
        }
      }
  const lines = new Map();
  for (const [a, b] of edges) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      ux = (b[0] - a[0]) / l,
      uy = (b[1] - a[1]) / l,
      c = -uy * a[0] + ux * a[1],
      key = [ux, uy, c].map((v) => v.toFixed(5)).join('/');
    let group = lines.get(key);
    if (!group) {
      group = { ux, uy, c, ranges: [] };
      lines.set(key, group);
    }
    group.ranges.push([ux * a[0] + uy * a[1], ux * b[0] + uy * b[1]]);
  }
  for (const { ux, uy, c, ranges } of lines.values()) {
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged.at(-1);
      if (last && r[0] <= last[1] + 1e-5) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    }
    for (const [a, b] of merged) {
      const p = (t) => [ux * t - uy * c, uy * t + ux * c],
        aa = p(a),
        bb = p(b),
        points = [
          [aa[0], aa[1], thickness / 2],
          [aa[0], aa[1], -thickness / 2],
          [bb[0], bb[1], -thickness / 2],
          [bb[0], bb[1], thickness / 2],
        ];
      quad(q, 'brick', points, normalFor(...points), brick);
    }
  }
  if (d > 1 && coat)
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i],
          x1 = xs[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1],
          xx = x0 + (x1 - x0) * 0.17,
          ww = (x1 - x0) * 0.63,
          hh = Math.min(0.8, (y1 - y0) * 0.65),
          bottom = Math.max(y0, y1 - hh - 0.12);
        if (y1 < 5 || (i * 3 + j + seed) % 5 !== 0 || hh < 0.08) continue;
        const pp = [
          [xx, bottom],
          [xx + ww, bottom + 0.12],
          [xx + ww * 0.86, bottom + hh],
          [xx + ww * 0.24, bottom + hh * 0.79],
        ];
        if (pp.every((p) => solid(...p)))
          face(
            q,
            'brick',
            pp.map(([x, y]) => [x, y, thickness / 2 + 0.015]),
            brick,
          );
      }
  if (d > 1) {
    for (const h of holes) {
      const x = (h[0] + h[1]) / 2,
        w = h[1] - h[0];
      if (h[3] > 0.1 && h[3] < at(x) - 0.12) {
        if (d === 2) rect(q, 'stone', x, h[3], thickness / 2 + 0.06, w + 0.16, 0.13, stone);
        else B(q, 'stone', x, h[3], thickness / 2 + 0.055, w + 0.16, 0.13, 0.17, stone);
        if (h[2] > 0.2)
          if (d === 2)
            rect(q, 'stone', x, h[2] - 0.12, thickness / 2 + 0.06, w + 0.13, 0.12, stone);
          else B(q, 'stone', x, h[2] - 0.12, thickness / 2 + 0.055, w + 0.13, 0.12, 0.15, stone);
      }
    }
  }
  if (d > 2) {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i],
        b = profile[i + 1],
        n = Math.max(1, Math.ceil((b[0] - a[0]) / 0.55));
      for (let k = 0; k < n; k++) {
        const x = a[0] + ((k + 0.5) * (b[0] - a[0])) / n,
          y = at(x),
          ww = ((b[0] - a[0]) / n) * 0.82;
        B(q, 'brick', x, y - 0.12, 0, ww, 0.15 + ((k + seed) % 3) * 0.06, thickness + 0.07, brick);
      }
    }
  }
  return { q, len };
}
const holes = (len, n, rows, width = 1.7) =>
  Array.from({ length: n }, (_, i) =>
    rows.map(([lo, hi]) => {
      const x = ((i + 0.5) * len) / n;
      return [x - width / 2, x + width / 2, lo, hi];
    }),
  ).flat();
function outerRuin(o, d) {
  const outline = [
    [-22.6, -2.8],
    [-20.83, -20.55],
    [-11, -19.45],
    [5.24, -18.75],
    [21.24, -19.36],
    [23.23, 5.51],
    [22.87, 7.19],
    [22.13, 8.3],
    [19.65, 9.28],
    [16.55, 9.62],
    [14.01, 8.57],
    [12.73, 6.29],
    [3.89, 6.41],
  ];
  // Low outer ranges and rear courtyard survive without roofs or upper floors.
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i],
      b = outline[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 4.1)),
      hs = d === 0 ? [] : holes(len, n, [[0.15, 3.15]], Math.min(2.1, (len / n) * 0.58));
    wall(
      o,
      a,
      b,
      [
        [0, 3.9],
        [0.33, 4.05],
        [0.68, 3.82],
        [1, 4.0],
      ],
      hs,
      d,
      { seed: i },
    );
  }
  // Curved north-west end: two storeys, then the isolated taller broken end pier.
  const curve = [
      [-23.44, 4.59],
      [-22.68, 5.76],
      [-21.98, 7.17],
      [-20.88, 7.91],
      [-18.57, 8.91],
      [-15.76, 8.75],
      [-13.48, 7.48],
      [-12.93, 6.09],
    ],
    heights = [13.4, 11.8, 8.7, 8.5, 8.55, 8.8, 8.7];
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i],
      b = curve[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    wall(
      o,
      a,
      b,
      [
        [0, heights[i]],
        [1, heights[i] + (i === 0 ? 0.2 : -0.2)],
      ],
      holes(
        len,
        1,
        [
          [0.1, 3.2],
          [4.8, 7.5],
        ],
        Math.min(len * 0.62, 1.9),
      ),
      d,
      { seed: 3 + i },
    );
  }
  wall(
    o,
    [-22.6, -2.8],
    [-23.44, 4.59],
    [
      [0, 8.5],
      [0.58, 8.65],
      [1, 13.4],
    ],
    holes(
      7.44,
      d === 0 ? 1 : 2,
      [
        [0.1, 3.2],
        [4.8, 7.5],
      ],
      1.7,
    ),
    d,
  );
  wall(
    o,
    [-12.93, 6.09],
    [-8.06, 6.88],
    [
      [0, 8.4],
      [0.55, 8.8],
      [1, 8.5],
    ],
    holes(
      4.93,
      2,
      [
        [0.1, 3.2],
        [4.8, 7.5],
      ],
      1.55,
    ),
    d,
  );
  wall(
    o,
    [-8.06, 6.88],
    [-4.24, 6.69],
    [
      [0, 13.2],
      [0.3, 13.65],
      [0.55, 13.3],
      [0.82, 13.9],
      [1, 13.4],
    ],
    holes(
      3.83,
      1,
      [
        [0.1, 3.2],
        [4.8, 8.1],
        [10.1, 12.4],
      ],
      2.15,
    ),
    d,
    { coat: false },
  );
  // Surviving high return walls flank the dome; their tops remain broken.
  wall(
    o,
    [-12.6, 5.9],
    [-12.1, -2.3],
    [
      [0, 8.7],
      [0.23, 9.1],
      [0.49, 13.2],
      [0.7, 13.8],
      [1, 13.4],
    ],
    holes(
      8.22,
      2,
      [
        [0.1, 3.2],
        [4.8, 8.1],
        [10.0, 12.3],
      ],
      2.0,
    ),
    d,
    { coat: false },
  );
  wall(
    o,
    [-12.1, -2.3],
    [-4.5, -1.7],
    [
      [0, 13.4],
      [0.28, 13.1],
      [0.57, 13.7],
      [0.84, 13.4],
      [1, 13.0],
    ],
    holes(
      7.62,
      2,
      [
        [0.1, 3.2],
        [4.8, 8.1],
        [10, 12.4],
      ],
      2.0,
    ),
    d,
  );
  wall(
    o,
    [4.2, -1.8],
    [12.35, -1.85],
    [
      [0, 12.2],
      [0.22, 13.1],
      [0.47, 12.2],
      [0.7, 11.5],
      [1, 10.8],
    ],
    holes(
      8.15,
      2,
      [
        [0.1, 3.2],
        [4.8, 8.1],
        [9.6, 11.1],
      ],
      2.05,
    ),
    d,
    { coat: false, seed: 7 },
  );
  wall(
    o,
    [12.35, -1.85],
    [12, -9.1],
    [
      [0, 10.8],
      [0.12, 9.4],
      [0.3, 8.5],
      [0.7, 8.3],
      [1, 8.0],
    ],
    holes(
      7.26,
      2,
      [
        [0.1, 3.2],
        [4.8, 7.5],
      ],
      1.9,
    ),
    d,
    { coat: false },
  );
  // Conservative low rear partitions inside the mapped ruin; hidden details are interpreted.
  if (d > 1) {
    wall(
      o,
      [-11, -19.45],
      [-11.7, -8.9],
      [
        [0, 4.0],
        [1, 4.0],
      ],
      holes(10.57, 2, [[0.1, 3.1]], 2.0),
      d,
    );
    wall(
      o,
      [-11.7, -8.9],
      [-21.9, -9.7],
      [
        [0, 3.8],
        [1, 4.0],
      ],
      holes(10.23, 2, [[0.1, 3.1]], 1.9),
      d,
    );
  }
  // Recognizable grey stone bands remain on the front; they do not close any openings.
  if (d > 0) {
    for (const [a, b] of [
      [
        [-12.9, 6.2],
        [-4.3, 6.75],
      ],
      [
        [4.1, 6.42],
        [12.7, 6.35],
      ],
    ]) {
      const q = facing(o, -Math.atan2(b[1] - a[1], b[0] - a[0]), a[0], a[1]),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const y of [3.65, 8.45]) {
        if (a[0] > 0 && y > 4) continue;
        B(q, 'stone', len / 2, y, 0.08, len, 0.18, 0.82, stone);
      }
    }
  }
}
function vestibule(o, d) {
  wall(
    o,
    [-4.13, 10.43],
    [3.8, 10.67],
    [
      [0, 16.4],
      [0.13, 17],
      [0.26, 16.7],
      [0.38, 14.7],
      [0.68, 14.9],
      [0.83, 17.1],
      [1, 16.8],
    ],
    [
      [2.25, 5.75, -0.85, 3.35],
      [2.0, 6.0, 4.8, 8.5],
      [2.0, 6.0, 10.5, 13.6],
    ],
    d,
    { coat: true, thickness: 0.7 },
  );
  for (const sign of [-1, 1]) {
    const x = sign < 0 ? -4.1 : 3.85;
    wall(
      o,
      [x, 10.45],
      [x, 3.7],
      [
        [0, 16.5],
        [0.18, 16.1],
        [0.33, 16.5],
        [0.5, 15.5],
        [0.7, 15.9],
        [1, 16.0],
      ],
      holes(
        6.75,
        d === 0 ? 1 : 2,
        [
          [0.1, 3.2],
          [4.8, 8.5],
          [10.5, 13.6],
        ],
        d === 0 ? 3.6 : 1.8,
      ),
      d,
      {
        coat: sign < 0,
        survivingPlaster:
          sign > 0
            ? [
                [0.05, 0.5],
                [6.65, 0.5],
                [6.3, 5.3],
                [4.5, 8.6],
                [3.3, 7.8],
                [2.2, 9.1],
                [0.2, 8.5],
              ]
            : [],
      },
    );
  }
  if (d > 0) {
    for (const x of [-3.55, 3.25]) {
      B(o, 'stone', x, -0.8, 10.8, 1.02, 17.6, 0.53, stone);
      for (const y of [3.42, 9.05, 14.1, 16.55]) B(o, 'stone', x, y, 10.87, 1.35, 0.25, 0.68, pale);
      if (d > 1) {
        for (const y of [1, 1.7, 2.4]) B(o, 'stone', x, y, 11.09, 1.05, 0.035, 0.05, dark);
        B(o, 'stone', x, 10.0, 11.08, 0.08, 3.4, 0.06, pale);
        B(o, 'stone', x + 0.28, 10.0, 11.08, 0.08, 3.4, 0.06, pale);
      }
    }
    B(o, 'stone', -0.14, 3.4, 10.83, 8.5, 0.28, 0.93, stone);
    for (const y of [3.7, 3.93]) B(o, 'stone', -0.14, y, 10.93, 8.65, 0.14, 1.0, pale);
    for (const x of [-0.82, 0.55]) {
      B(o, 'stone', x, 4.8, 10.82, 0.16, 3.7, 0.26, stone);
      B(o, 'stone', x, 10.5, 10.82, 0.16, 3.1, 0.26, stone);
    }
    if (d > 1) {
      for (let i = 0; i < 14; i++)
        B(o, 'stone', -4.15 + i * 0.615, 3.47, 11.34, 0.16, 0.23, 0.12, pale);
      for (const x of [-2.1, 1.85])
        for (let j = 0; j < 5; j++)
          B(o, 'stone', x, 0.12 + j * 0.62, 10.89, 0.55, 0.55, 0.18, stone);
    }
  }
}
function drum(o, d) {
  const n = d < 2 ? 8 : 16,
    rx = 4.35,
    rz = 5.37;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2,
      p = [rx * Math.cos(a), rz * Math.sin(a)],
      q = [rx * Math.cos(b), rz * Math.sin(b)],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      w = len * (d === 0 ? 0.64 : 0.62);
    wall(
      o,
      p,
      q,
      [
        [0, 20.8],
        [1, 20.8],
      ],
      [
        ...(d === 0 ? [] : [[len / 2 - w / 2, len / 2 + w / 2, 3.7, 7.6]]),
        [len / 2 - w / 2, len / 2 + w / 2, 10.1, 14.0],
        [len / 2 - w / 2, len / 2 + w / 2, 17.25, 19.8],
      ],
      d,
      { coat: true, thickness: 0.48, seed: i },
    );
    if (d > 0) {
      const a = -Math.atan2(q[1] - p[1], q[0] - p[0]),
        s = facing(o, a, p[0], p[1]);
      for (const [y, h, depth] of d === 1
        ? [
            [8.2, 0.19, 0.72],
            [20.55, 0.28, 0.94],
          ]
        : [
            [8.2, 0.19, 0.72],
            [14.7, 0.16, 0.65],
            [16.6, 0.2, 0.69],
            [20.1, 0.27, 0.86],
            [20.55, 0.28, 0.94],
          ])
        B(s, 'stone', len / 2, y, 0, len + 0.05, h, depth, stone);
      if (d > 1) B(s, 'stone', 0, 16.6, 0.3, 0.22, 3.7, 0.17, pale);
      if (d > 2) {
        for (let k = 0; k < 3; k++)
          rect(s, 'plaster', len / 2, 15.1 + k * 0.25, 0.254, len * 0.8, 0.035, dark);
      }
    }
  }
  // No opaque roof: bent-looking, lightly rusted meridians with open diagonal cross bracing.
  const ribs = d < 2 ? 8 : 16,
    bands = d === 0 ? 3 : d === 1 ? 4 : 7,
    point = (a, t) => [
      rx * Math.cos(t) * Math.cos(a),
      20.85 + 4.1 * Math.sin(t),
      rz * Math.cos(t) * Math.sin(a),
    ];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    for (let j = 0; j < bands; j++)
      strut(
        o,
        point(a, ((j / bands) * Math.PI) / 2),
        point(a, (((j + 1) / bands) * Math.PI) / 2),
        d === 0 ? 0.105 : 0.075,
        d,
        rust,
      );
  }
  const rings = d === 0 ? [0.32, 0.68] : d === 1 ? [0.14, 0.4, 0.7] : [0, 0.16, 0.36, 0.57, 0.76];
  for (const t of rings) {
    const segments = d < 2 ? ribs : 32;
    for (let i = 0; i < segments; i++)
      strut(
        o,
        point((i / segments) * Math.PI * 2, (t * Math.PI) / 2),
        point(((i + 1) / segments) * Math.PI * 2, (t * Math.PI) / 2),
        0.065,
        d,
        rust,
      );
  }
  if (d > 1)
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 3; j++) {
        const a = (i / 16) * Math.PI * 2,
          b = ((i + 1) / 16) * Math.PI * 2,
          t = 0.12 + j * 0.2,
          tt = t + 0.19;
        strut(o, point(a, (t * Math.PI) / 2), point(b, (tt * Math.PI) / 2), 0.045, d, rust);
        if (d > 2)
          strut(o, point(b, (t * Math.PI) / 2), point(a, (tt * Math.PI) / 2), 0.042, d, rust);
      }
}
function conservation(o, d) {
  if (d === 0) return;
  // Structural preservation rods remain deliberately distinguishable from the original masonry.
  for (const [a, b] of [
    [
      [-12.1, 11.9, -2.0],
      [-7.3, 0.3, -10.1],
    ],
    [
      [12.2, 7.6, -8.8],
      [6.4, 0.3, -13.3],
    ],
    [
      [-20.8, 3.8, -19.6],
      [-11.6, 3.8, -9.3],
    ],
    [
      [4.7, 12, -1.7],
      [12.1, 7.9, -8.8],
    ],
    [
      [-12.5, 7.9, 5.9],
      [-4.5, 7.9, -1.7],
    ],
  ])
    strut(o, a, b, 0.11, d);
  for (const sign of [-1, 1])
    for (const x of [sign * 7.2, sign * 10.5]) strut(o, [x, 0.4, 5.9], [x, 7.8, -1.8], 0.07, d);
  if (d > 1) {
    // A small surviving south-court spiral stair, distinct from the destroyed main stair.
    const x = 8.6,
      z = -5.4;
    strut(o, [x, -0.5, z], [x, 4.1, z], 0.1, d);
    for (let i = 0; i < 22; i++) {
      const a = i * 0.49,
        y = 0.16 + i * 0.165,
        p = [x + 0.18 * Math.cos(a), y, z + 0.18 * Math.sin(a)],
        q = [x + 1.02 * Math.cos(a), y, z + 1.02 * Math.sin(a)];
      beam(o, 'metal', p, q, 0.19, 0.07, dark);
    }
    for (let i = 0; i < 46; i++) {
      const x = -19 + (i % 10) * 4.05 + 0.32 * Math.sin(i * 2),
        z = -17 + Math.floor(i / 10) * 4.9 + 0.21 * Math.cos(i * 3);
      if (Math.abs(x) < 5 && z > -6) continue;
      if (x > -12 && x < 12 && z > -15 && z < -8) continue;
      B(o, 'brick', x, -0.15, z, 0.42 + (i % 3) * 0.16, 0.21 + (i % 4) * 0.1, 0.35, brick);
    }
  }
}
export function hiroshimaPeaceMemorial(o, _frame, d = 3) {
  outerRuin(o, d);
  vestibule(o, d);
  drum(o, d);
  conservation(o, d);
}
export function hiroshimaPeaceMemorialSkyline(o) {
  hiroshimaPeaceMemorial(o, undefined, 0);
}
export function hiroshimaPeaceMemorialDistrict(o) {
  hiroshimaPeaceMemorial(o, undefined, 1);
}
export function hiroshimaPeaceMemorialStreet(o) {
  hiroshimaPeaceMemorial(o, undefined, 2);
}
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.22 },
};
export const hiroshimaPeaceMemorialModel = {
  id: 'hiroshima_peace_memorial',
  key: 'hiroshima_peace_memorial',
  recipe: 'structure-hiroshima-peace-memorial.mjs',
  cell: 'wy/wyn',
  title: 'Hiroshima Peace Memorial',
  brief:
    'Preserved roofless exhibition hall ruin: asymmetrical jagged red-brick/grey plaster walls, actual open window and doorway holes, curved front end bays, projecting stone entrance, tall perforated oval masonry drum, bare skeletal steel dome, open rear courtyard and preservation braces. No reconstruction of original roofs or floors.',
  camera: [-50, 34, 64],
  lookAt: [0, 10, -2],
  qaCameras: [
    { name: 'front', position: [0, 11, 69], lookAt: [0, 11, 0] },
    { name: 'front-detail', position: [-18, 17, 34], lookAt: [-1, 15, 4] },
    { name: 'south-detail', position: [42, 16, 18], lookAt: [2, 11, -1] },
    { name: 'back', position: [46, 28, -54], lookAt: [0, 9, -4] },
  ],
  mediumFiContext: { scale: 0.7 },
  build: hiroshimaPeaceMemorial,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry river-facing path[0,13] gives datum4.4071m in preserved official GSI1A elevation tiles. Unmodified mapped ground spans about-0.525..+0.468m across the ruin. Wall foundations reach-.85m without exposed undersides; doorway and low window thresholds remain visible. Bounded64m land-side review excludes the river bed. Generic-footprint replacement disabled; other host terrain remains host-dependent.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hiroshima-peace-memorial.mjs',
    level: 'skyline',
    export: 'hiroshimaPeaceMemorialSkyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'hiroshimaPeaceMemorialDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'hiroshimaPeaceMemorialStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Original medium-fi representation of the preserved ruin, reviewed first against three cleared public-domain Qualla photographs and a verified creator-CC0 riverfront original. Mapped vector parts control the generalized envelope and courtyard. Earlier attribution-licensed imagery, uncleared official drawings and aerial imagery are excluded from current approval. Nominal25m height and roughly11m by8m by4m dome dimensions guide scale from official text. Wall heights, jagged outlines, masonry patches, hidden windows and exact steel/bracing layout remain estimates, not a measured conservation survey.',
    'No original complete roofs, floors or main staircase reconstructed. Small surviving south-court spiral stair and modern preservation rods are simplified. River walls, surrounding city, park trees/fences/signs and temporary protective coverings excluded.',
    'Photographic pixels not redistributed. GSI independent elevation sources retained unchanged for the bounded64m land-side ground review. Current foundations/contact and signed orientation reviewed as a preview; river bed and other host terrain compatibility remain unverified. Footprint replacement disabled.',
  ],
};

export { conservation, drum, outerRuin, vestibule };
