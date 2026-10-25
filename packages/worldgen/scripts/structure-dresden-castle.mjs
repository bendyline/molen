/** Dresden Castle: native connected palace, three courts, Hausmann tower and long arcade. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/u3/u31/dresden_castle/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  cream = rgb('d6bc8f'),
  trim = rgb('c6bca5'),
  darkStone = rgb('756d59'),
  glass = rgb('3c514a'),
  slate = rgb('a74e2f'),
  lead = rgb('535c51'),
  iron = rgb('41494f'),
  oak = rgb('63503d'),
  gold = rgb('b49a55'),
  sgraffito = rgb('777b78'),
  pale = rgb('d2d0be'),
  copper = rgb('698b74');
const area = (r) =>
  r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
function quad(o, slot, ps, n, col) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [...ps].reverse();
  rawQuad(o, slot, ps, n, col);
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
    addCap: (s, r, p, h, y, n, u, c) => o.addCap(s, r, p, h, y, n, u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
  const all = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    idx = earcut(
      all.flatMap((p) => [p[0], p[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((j) => all[j]);
    if (normalFor(...p).reduce((v, a, j) => v + a * n[j], 0) < 0) p.reverse();
    o.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
const surface = (o, s, p, z, c) =>
  flat(
    o,
    s,
    p.map((v) => [...v, z]),
    c,
  );
function panel(o, s, ps, z0, z1, c) {
  surface(o, s, ps, z1, c);
  flat(
    o,
    s,
    ps.map((v) => [...v, z0]),
    c,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, s, p, normalFor(...p), c);
  }
}
function wall(o, ps, holes, z, depth, col = cream, slot = 'stone') {
  const xmin = Math.min(...ps.map((p) => p[0])),
    xmax = Math.max(...ps.map((p) => p[0])),
    ymin = Math.min(...ps.map((p) => p[1])),
    ymax = Math.max(...ps.map((p) => p[1]));
  const partial = holes.some((r) =>
    r.some(
      ([x, y]) =>
        x <= xmin + 0.00001 || x >= xmax - 0.00001 || y <= ymin + 0.00001 || y >= ymax - 0.00001,
    ),
  );
  if (partial) slicedWall(o, slot, ps, holes, z, col);
  else
    flat(
      o,
      slot,
      ps.map((v) => [...v, z]),
      col,
      holes.map((r) => r.map((v) => [...v, z])),
    );
  if (depth <= 0) return;
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      let a = r[i],
        b = r[(i + 1) % r.length];
      if (partial) {
        let t0 = 0,
          t1 = 1;
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        for (const [p, q] of [
          [-dx, a[0] - xmin],
          [dx, xmax - a[0]],
          [-dy, a[1] - ymin],
          [dy, ymax - a[1]],
        ]) {
          if (Math.abs(p) < 1e-10) {
            if (q < 0) t1 = -1;
            continue;
          }
          const t = q / p;
          if (p < 0) t0 = Math.max(t0, t);
          else t1 = Math.min(t1, t);
        }
        if (t1 - t0 < 1e-7) continue;
        const aa = a;
        a = [aa[0] + dx * t0, aa[1] + dy * t0];
        b = [aa[0] + dx * t1, aa[1] + dy * t1];
      }
      const p = [
        [...a, z],
        [...a, z - depth],
        [...b, z - depth],
        [...b, z],
      ];
      quad(o, slot, p, normalFor(...p), darkStone);
    }
}
function outline(o, slot, ps, z, width, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const u = [(-(b[1] - a[1]) * width) / l / 2, ((b[0] - a[0]) * width) / l / 2],
      p = [
        [a[0] - u[0], a[1] - u[1], z],
        [b[0] - u[0], b[1] - u[1], z],
        [b[0] + u[0], b[1] + u[1], z],
        [a[0] + u[0], a[1] + u[1], z],
      ];
    quad(o, slot, p, [0, 0, 1], col);
  }
}
function slicedWall(o, slot, outer, holes, z, col) {
  const xmin = Math.min(...outer.map((p) => p[0])),
    xmax = Math.max(...outer.map((p) => p[0])),
    ymin = Math.min(...outer.map((p) => p[1])),
    ymax = Math.max(...outer.map((p) => p[1]));
  const xs = [xmin, xmax],
    edges = holes.map((r) => r.map((a, i) => [a, r[(i + 1) % r.length]]));
  for (const es of edges)
    for (const [a, b] of es) {
      xs.push(Math.max(xmin, Math.min(xmax, a[0])));
      for (const y of [ymin, ymax])
        if ((a[1] - y) * (b[1] - y) < 0)
          xs.push(
            Math.max(xmin, Math.min(xmax, a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]))),
          );
    }
  const xx = [...new Set(xs.map((x) => Number(x.toFixed(8))))].sort((a, b) => a - b),
    at = (edge, x) =>
      edge
        ? edge[0][1] + ((edge[1][1] - edge[0][1]) * (x - edge[0][0])) / (edge[1][0] - edge[0][0])
        : ymin;
  for (let k = 1; k < xx.length; k++) {
    const l = xx[k - 1],
      r = xx[k],
      m = (l + r) / 2;
    if (r - l < 1e-6) continue;
    const intervals = [];
    for (const es of edges) {
      const crosses = es
        .filter(([a, b]) => a[0] > m !== b[0] > m)
        .sort((a, b) => at(a, m) - at(b, m));
      for (let j = 1; j < crosses.length; j += 2) intervals.push([crosses[j - 1], crosses[j]]);
    }
    intervals.sort((a, b) => at(a[0], m) - at(b[0], m));
    const gaps = [];
    let lower = null,
      height = ymin;
    for (const [lo, hi] of intervals) {
      const low = at(lo, m),
        high = at(hi, m);
      if (high <= height || low >= ymax) continue;
      if (low > height) gaps.push([lower, lo]);
      if (high > height) {
        lower = hi;
        height = high;
      }
    }
    if (height < ymax)
      gaps.push([
        lower,
        [
          [xmin, ymax],
          [xmax, ymax],
        ],
      ]);
    for (const [a, b] of gaps) {
      const ys = (x) => [
          Math.max(ymin, Math.min(ymax, at(a, x))),
          Math.max(ymin, Math.min(ymax, at(b, x))),
        ],
        yl = ys(l),
        yr = ys(r),
        p = [
          [l, yl[0], z],
          [r, yr[0], z],
          [r, yr[1], z],
          [l, yl[1], z],
        ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const q = ids.map((i) => p[i]);
        if (
          Math.abs(
            (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]),
          ) < 1e-6
        )
          continue;
        o.addTriangle(
          slot,
          ref,
          q,
          [0, 0, 1],
          q.map((p) => [p[0], p[1]]),
          col,
        );
      }
    }
  }
}
function arch(x, bottom, w, spring, rise, segments = 12) {
  return [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    ...Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI;
      return [x + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)];
    }),
  ];
}
function circle(x, y, rx, ry, n = 20) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * 2 * Math.PI) / n),
    y + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function cylinder(o, slot, x, z, y0, y1, r0, r1, col, n = 24, cap = true) {
  loft(o, slot, [radialRing(y0, r0, r0, n, [x, z]), radialRing(y1, r1, r1, n, [x, z])], col, {
    cap,
  });
}
function finial(o, d, x, y, z, h = 1.2) {
  if (d === 0) return;
  beam(o, 'lead', [x, y, z], [x, y + h, z], d === 1 ? 0.055 : 0.035, d === 1 ? 0.055 : 0.035, lead);
  if (d === 3)
    for (const t of [0.18, 0.38, 0.64])
      sphere(
        o,
        'lead',
        [x, y + h * t, z],
        [0.09 * (1 - t / 2), 0.1, 0.09 * (1 - t / 2)],
        lead,
        6,
        4,
      );
}
function clean(r, tolerance) {
  r = r.filter(
    (p, i) => Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]) > 0.002,
  );
  const original = [...r],
    indices = new Map(original.map((p, i) => [p, i]));
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz),
        t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l) : -1,
        err = l ? Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l : Infinity;
      let chainError = 0;
      for (
        let j = (indices.get(a) + 1) % original.length;
        j !== indices.get(b);
        j = (j + 1) % original.length
      ) {
        const q = original[j],
          u = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (l * l))) : 0;
        chainError = Math.max(chainError, Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dz));
      }
      if (t >= 0 && t <= 1 && err < tolerance && chainError < tolerance) {
        r = r.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function faces(r, hole = false) {
  r = area(r) > 0 !== hole ? r : [...r].reverse();
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = a[0] - b[0],
      dz = a[1] - b[1];
    return {
      a,
      b,
      w: Math.hypot(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
      angle: Math.atan2(-dz, dx),
      normal: [-dz / Math.hypot(dx, dz), dx / Math.hypot(dx, dz)],
    };
  });
}
function cap(o, rings, y, col = lead, slot = 'roof', normalY = 1) {
  const p = rings.flat(),
    idx = earcut(
      p.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] * normalY < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      [0, normalY, 0],
      q.map((v) => [v[0], v[2]]),
      col,
    );
  }
}

function ledge(o, x, y, z, w, h, depth, col) {
  quad(
    o,
    'trim',
    [
      [x - w / 2, y, z + depth / 2],
      [x + w / 2, y, z + depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 0, 1],
    col,
  );
  quad(
    o,
    'trim',
    [
      [x - w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 1, 0],
    col,
  );
}

function window(o, d, x, y, w, h, { arched = false, wood = false, applied = false, z = 0 } = {}) {
  if (d <= 1) arched = false;
  const ps = arched ? arch(x, y, w, y + h - w / 2, w / 2, d === 3 ? 14 : 8) : rect(x, y, w, h),
    zz = z + (d >= 2 && !applied ? -0.22 : 0.035);
  surface(o, wood ? 'wood' : 'glass', ps, zz, wood ? oak : glass);
  if (d <= 1) return;
  outline(o, 'trim', ps, z + 0.05, 0.13, trim, true);
  if (!wood) {
    outline(
      o,
      'trim',
      [
        [x, y],
        [x, y + h - (arched ? w * 0.2 : 0)],
      ],
      z + 0.06,
      0.11,
      trim,
    );
    outline(
      o,
      'trim',
      [
        [x - w / 2, y + h * 0.62],
        [x + w / 2, y + h * 0.62],
      ],
      z + 0.065,
      0.1,
      trim,
    );
    if (d === 3) {
      for (const dx of [-w * 0.25, w * 0.25])
        outline(
          o,
          'inlay',
          [
            [x + dx, y],
            [x + dx, y + h - (arched ? w * 0.25 : 0)],
          ],
          zz + 0.055,
          0.028,
          iron,
        );
      for (let a = y + 0.55; a < y + h - 0.2; a += 0.65)
        outline(
          o,
          'inlay',
          [
            [x - w / 2, a],
            [x + w / 2, a],
          ],
          zz + 0.055,
          0.025,
          iron,
        );
    }
  }
}

const components = frame.authoredComponents,
  tolerances = [2.5, 0.8, 0.12, 0.03],
  portalControls = [
    {
      name: 'Grünes Tor',
      axis: 'x',
      cross: 0,
      from: -11,
      to: 11,
      width: 4.4,
      spring: 4.2,
      rise: 2.1,
    },
    {
      name: 'Löwentor',
      axis: 'z',
      cross: 30,
      from: -50,
      to: -25,
      width: 4.3,
      spring: 4.0,
      rise: 2.0,
    },
    {
      name: 'Bärengarten entrance',
      axis: 'z',
      cross: 67,
      from: 3,
      to: 39,
      width: 4.0,
      spring: 3.6,
      rise: 1.9,
    },
    {
      name: 'Georgentor road',
      axis: 'x',
      cross: -69,
      from: -30,
      to: 23,
      width: 5.6,
      spring: 4.6,
      rise: 2.7,
    },
  ];
const bodies = [
  { name: 'main', rings: components.main, top: 21.5, roofRise: 10 },
  { name: 'Georgenbau', rings: components.georgenbau, top: 22, roofRise: 11 },
  { name: 'stable wing', rings: components.stableWing, top: 9.0, roofRise: 5.2 },
  { name: 'stable low wing', rings: components.stableLowWing, top: 6.5, roofRise: 3.8 },
];
function sample(x, z) {
  const gx = (x - terrain.origin[0]) / terrain.stepMeters,
    gz = (z - terrain.origin[1]) / terrain.stepMeters,
    ix = Math.min(terrain.size[0] - 2, Math.max(0, Math.floor(gx))),
    iz = Math.min(terrain.size[1] - 2, Math.max(0, Math.floor(gz))),
    u = Math.max(0, Math.min(1, gx - ix)),
    v = Math.max(0, Math.min(1, gz - iz)),
    hs = terrain.heightsMeters;
  return (
    hs[iz][ix] * (1 - u) * (1 - v) +
    hs[iz][ix + 1] * u * (1 - v) +
    hs[iz + 1][ix] * (1 - u) * v +
    hs[iz + 1][ix + 1] * u * v -
    terrain.modelDatumElevationMeters
  );
}
const pointAt = (f, x, z = 0) => [
  f.x + Math.cos(f.angle) * x + Math.sin(f.angle) * z,
  f.z - Math.sin(f.angle) * x + Math.cos(f.angle) * z,
];
function portalsFor(f, bottom, d) {
  const out = [];
  for (const p of portalControls) {
    const axis = p.axis === 'x' ? 0 : 1,
      cross = 1 - axis,
      c = axis === 0 ? f.x : f.z,
      t = cross === 0 ? Math.cos(f.angle) : -Math.sin(f.angle);
    if (c < p.from || c > p.to || Math.abs(t) < 0.85) continue;
    const local = (p.cross - (cross === 0 ? f.x : f.z)) / t,
      w = p.width / Math.abs(t);
    if (Math.abs(local) - w / 2 > f.w / 2 - 0.00001) continue;
    out.push({
      ...p,
      x: local,
      polygon: arch(local, bottom, w, p.spring, p.rise, d === 3 ? 16 : 6),
    });
  }
  return out;
}
function windowLayout(body, f, holeIndex, d) {
  if (!d || f.w < 2.5) return [];
  const court = body.name === 'main' && holeIndex > 0,
    small = court && holeIndex > 1,
    rows =
      body.top < 10
        ? [[1.7, 2.3]]
        : [
            [1.3, 3.2],
            [7.4, 4.1],
            [14.4, 4.5],
          ],
    spacing = small ? 3.7 : d === 1 ? 7.2 : 4.8,
    n = Math.max(1, Math.floor(f.w / spacing)),
    portals = portalsFor(f, -2, d),
    southDoor = body.name === 'main' && holeIndex === 0 && f.x > 109 && f.w > 12,
    out = [];
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * f.w,
      w = Math.min(small ? 1.7 : 2.1, f.w * 0.65);
    for (const [y, h] of rows) {
      if (southDoor && y < 2 && Math.abs(x) < 5) continue;
      if (
        y + h > body.top - 0.6 ||
        portals.some((p) => Math.abs(x - p.x) < p.width / 2 + w / 2 && y < p.spring + p.rise + 0.4)
      )
        continue;
      const p = pointAt(f, x, 0.4);
      if (
        bodies.some(
          (other) =>
            other !== body &&
            inside(p, other.rings[0]) &&
            !other.rings.slice(1).some((r) => inside(p, r)),
        )
      )
        continue;
      out.push({ x, y, w, h, arched: y < 2 && !court && Math.cos(f.angle) > 0.9 });
    }
  }
  if (southDoor)
    for (const x of [-1.8, 1.8])
      out.push({ x, y: -0.45, w: 2.8, h: 4.5, wood: true, arched: false });
  return out;
}
function inside(p, r) {
  let result = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
function decoration(_o, d, q, f, ys, court, windows = null) {
  if (d < 2) return;
  for (const y of ys) {
    if (y < 6.5 && portalsFor(f, -2, d).length) continue;
    ledge(q, 0, y, 0.04, f.w, 0.2, 0.28, court ? pale : trim);
  }
  if (d !== 3 || !court || f.w < 3) return;
  const n = Math.max(1, Math.floor(f.w / 4.8));
  // Original geometric sgraffito density; no copied paintings, coats of arms or text.
  for (let j = 0; j < n; j++) {
    const x = ((j + 0.5) / n - 0.5) * f.w;
    for (const y of [5.5, 12.5, 19.8]) {
      surface(q, 'inlay', rect(x, y, Math.min(3.6, f.w * 0.8), 0.6), 0.055, sgraffito);
      const w = Math.min(0.35, f.w / 8);
      surface(
        q,
        'inlay',
        [
          [x - w, y + 0.3],
          [x, y + 0.56],
          [x + w, y + 0.3],
          [x, y + 0.04],
        ],
        0.065,
        pale,
      );
    }
    const between = x + f.w / n / 2;
    if (between + 0.5 >= f.w / 2) continue;
    if (windows?.some((w) => Math.abs(w.x - between) < w.w / 2 + 0.55)) continue;
    for (const y of [8.1, 15.1]) {
      surface(q, 'inlay', rect(between, y, 0.8, 2.7), 0.045, sgraffito);
      outline(
        q,
        'trim',
        [
          [between - 0.3, y + 0.2],
          [between + 0.3, y + 1.35],
          [between - 0.3, y + 2.5],
        ],
        0.06,
        0.08,
        pale,
      );
    }
  }
}
function body(o, d, b) {
  const rings = b.rings.map((r) => clean(r, tolerances[d]));
  cap(o, rings, -2, darkStone, 'trim', -1);
  cap(o, rings, b.top, slate, 'roof');
  rings.forEach((r, holeIndex) => {
    for (const f of faces(r, holeIndex > 0)) {
      const q = facing(o, f.angle, f.x, f.z),
        court = b.name === 'main' && holeIndex > 0,
        portals = portalsFor(f, -2, d),
        windows = windowLayout(b, f, holeIndex, d),
        recessed =
          (d === 3 && f.w >= (b.name === 'Georgenbau' ? 4.2 : 7)) ||
          (d === 2 && b.name === 'main' && holeIndex === 1 && f.w > 20),
        openings = [
          ...portals.map((p) => p.polygon),
          ...(recessed
            ? windows.map((w) =>
                w.arched
                  ? arch(w.x, w.y, w.w, w.y + w.h - w.w / 2, w.w / 2, 8)
                  : rect(w.x, w.y, w.w, w.h),
              )
            : []),
        ];
      wall(q, rect(0, -2, f.w, b.top + 2), openings, 0, 0.32, court ? pale : cream);
      if (d > 0) {
        // A separate lower stone field follows the same real openings.
        if (d >= 2 && !portals.length && !court) {
          const lowHoles = recessed
            ? windows
                .filter((w) => w.y < 2)
                .map((w) =>
                  w.arched
                    ? arch(w.x, w.y, w.w, w.y + w.h - w.w / 2, w.w / 2, 8)
                    : rect(w.x, w.y, w.w, w.h),
                )
            : [];
          wall(q, rect(0, -2, f.w, 7.5), lowHoles, 0.012, 0.32, court ? pale : darkStone, 'trim');
        }
        for (const w of windows)
          window(q, recessed ? 2 : 1, w.x, w.y, w.w, w.h, {
            arched: w.arched,
            wood: w.wood,
            applied: !recessed,
            z: !court && w.y < 2 ? 0.015 : 0,
          });
        for (const p of portals) outline(q, 'trim', p.polygon.slice(1), 0.06, 0.3, trim);
        decoration(o, d, q, f, b.top > 10 ? [5.65, 12.35, 20.8] : [6.1], court, windows);
        if (d === 3 && !court && f.w > 4) {
          for (let y = 0.15; y < 5.4; y += 0.8) {
            const gaps = [
              ...portals.map((p) => [p.x - p.width / 2 - 0.2, p.x + p.width / 2 + 0.2]),
              ...windows
                .filter((w) => w.y < 2 && y > w.y && y < w.y + w.h)
                .map((w) => [w.x - w.w / 2 - 0.1, w.x + w.w / 2 + 0.1]),
            ].sort((a, b) => a[0] - b[0]);
            let x = -f.w / 2;
            for (const [a, b] of [...gaps, [f.w / 2, f.w / 2]]) {
              if (a > x) surface(q, 'inlay', rect((x + a) / 2, y, a - x, 0.045), 0.03, sgraffito);
              x = Math.max(x, b);
            }
          }
        }
      }
    }
  });
}
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    ll = dx * dx + dz * dz;
  const t = ll ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / ll)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function subdivide(p, step, emit) {
  const ls = p.map((a, i) => Math.hypot(a[0] - p[(i + 1) % 3][0], a[1] - p[(i + 1) % 3][1]));
  const i = ls.indexOf(Math.max(...ls));
  if (ls[i] <= step) {
    emit(p);
    return;
  }
  const a = p[i],
    b = p[(i + 1) % 3],
    c = p[(i + 2) % 3],
    m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  subdivide([a, m, c], step, emit);
  subdivide([m, b, c], step, emit);
}
function roofField(o, d, b) {
  if (d > 0) {
    pitchedRanges(o, d, b);
    return;
  }
  const rings = b.rings.map((r) => clean(r, tolerances[d])),
    ps = rings.flat(),
    ids = earcut(
      ps.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ),
    edges = rings.flatMap((r) => r.map((a, i) => [a, r[(i + 1) % r.length]])),
    y = (p) =>
      b.top + Math.min(b.roofRise, Math.min(...edges.map(([a, b]) => distance(p, a, b))) * 1.05),
    step = [50, 13, 6.5, 4.5][d];
  for (let i = 0; i < ids.length; i += 3)
    subdivide(
      ids.slice(i, i + 3).map((j) => ps[j]),
      step,
      (p) => {
        if (
          Math.abs(
            (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]),
          ) < 0.0001
        )
          return;
        const q = p.map((p) => [p[0], y(p), p[1]]);
        if (normalFor(...q)[1] < 0) q.reverse();
        o.addTriangle(
          'roof',
          ref,
          q,
          normalFor(...q),
          q.map((p) => [p[0], p[2]]),
          slate,
        );
      },
    );
}
function pitchedRanges(o, d, b) {
  const ranges =
    b.name === 'main'
      ? [
          [0, 1, 1, 0, -52.7, 57, 0.4, 7.7, 10, 7],
          [1, 0, 0, 1, -6, 67, 45.4, 11.8, 10, 7],
          [0, 1, 1, 0, 5.8, 36.1, 62, 12, 10, 5],
          [0, 1, 1, 0, -33, 7, 55.8, 5.9, 8, 4],
          [1, 0, -0.168, 1, -8, 51, -44.3, 8.2, 10, 6],
          [1, 0, 0, 1, 49, 83, -37.75, 5.75, 10, 4],
          [1, 0, 0, 1, 81, 112, -34.75, 7.75, 10, 6],
          [0, 1, 1, 0, -32, 13, 103.5, 6.5, 10, 6],
          [0, 1, 1, 0, -32, 7, 85, 5, 7.5, 4],
          [1, 0, 0, 1, 72, 107, 10.15, 4.35, 7.5, 4],
        ]
      : b.name === 'Georgenbau'
        ? [
            [0, 1, 1, 0, -81.2, -53.7, -15.8, 10.9, 11, 6],
            [1, 0, 0, 1, -18, 21, -69, 12, 8.5, 5],
            [0, 1, 1, 0, -91.3, -66, 2, 9.5, 7, 5],
          ]
        : b.name === 'stable wing'
          ? [[0, 1, 1, 0.25, -114, -58, 12.5, 10, 5.2, 4]]
          : [[0, 1, 1, 0.51, -118, -75, -30.3, 1.8, 3.8, 2]];
  const y = ([x, z]) =>
    b.top +
    Math.max(
      0,
      ...ranges.map(([ax, az, bx, bz, u0, u1, vc, half, rise, hip]) => {
        const u = ax * x + az * z,
          v = bx * x + bz * z;
        return (
          rise * Math.max(0, Math.min(1 - Math.abs(v - vc) / half, (u - u0) / hip, (u1 - u) / hip))
        );
      }),
    );
  const lines =
    b.name === 'main'
      ? [
          [1, 0, 0],
          [1, 0, 55.8],
          [1, 0, 62],
          [1, 0, 85],
          [1, 0, 103.5],
          [0, 1, -37.75],
          [0, 1, -34.75],
          [0, 1, 10.15],
          [0, 1, 45.4],
        ]
      : b.name === 'Georgenbau'
        ? [
            [1, 0, -15.8],
            [0, 1, -69],
          ]
        : [];
  const clip = (ps, [a, b, c], sign) => {
      const out = [];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i],
          q = ps[(i + 1) % ps.length],
          v = (a * p[0] + b * p[1] - c) * sign,
          w = (a * q[0] + b * q[1] - c) * sign;
        if (v >= -1e-9) out.push(p);
        if (v >= 0 !== w >= 0) {
          const t = v / (v - w);
          out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
      return out;
    },
    rings = b.rings.map((r) => clean(r, tolerances[d])),
    ps = rings.flat(),
    ids = earcut(
      ps.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    );
  for (let i = 0; i < ids.length; i += 3) {
    let pieces = [ids.slice(i, i + 3).map((j) => ps[j])];
    for (const l of lines) {
      const next = [];
      for (const p of pieces) {
        for (const s of [-1, 1]) {
          const q = clip(p, l, s);
          if (q.length >= 3 && Math.abs(area(q)) > 1e-5) next.push(q);
        }
      }
      pieces = next;
    }
    for (const p of pieces)
      for (let j = 1; j < p.length - 1; j++) {
        const q = [p[0], p[j], p[j + 1]].map((p) => [p[0], y(p), p[1]]);
        if (
          Math.abs(
            (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]),
          ) < 0.0001
        )
          continue;
        if (normalFor(...q)[1] < 0) q.reverse();
        o.addTriangle(
          'roof',
          ref,
          q,
          normalFor(...q),
          q.map((p) => [p[0], p[2]]),
          slate,
        );
      }
  }
  // Native boundary gable/hip closures share every roof-control intersection.
  for (const [j, r] of rings.entries())
    for (const f of faces(r, j > 0)) {
      const ts = [0, 1];
      for (const [a, b, c] of lines) {
        const v = a * (f.b[0] - f.a[0]) + b * (f.b[1] - f.a[1]);
        if (Math.abs(v) < 1e-9) continue;
        const t = (c - a * f.a[0] - b * f.a[1]) / v;
        if (t > 1e-8 && t < 1 - 1e-8) ts.push(t);
      }
      ts.sort((a, b) => a - b);
      for (let k = 1; k < ts.length; k++) {
        const points = [ts[k - 1], ts[k]].map((t) => [
            f.a[0] + (f.b[0] - f.a[0]) * t,
            f.a[1] + (f.b[1] - f.a[1]) * t,
          ]),
          a = points[0],
          bb = points[1],
          p = [
            [a[0], b.top, a[1]],
            [bb[0], b.top, bb[1]],
            [bb[0], y(bb), bb[1]],
            [a[0], y(a), a[1]],
          ];
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const q = ids.map((i) => p[i]);
          if (
            Math.hypot(...normalFor(...q)) === 0 ||
            Math.max(...q.map((p) => p[1])) < b.top + 1e-6
          )
            continue;
          const v1 = q[1].map((v, i) => v - q[0][i]),
            v2 = q[2].map((v, i) => v - q[0][i]),
            cross = [
              v1[1] * v2[2] - v1[2] * v2[1],
              v1[2] * v2[0] - v1[0] * v2[2],
              v1[0] * v2[1] - v1[1] * v2[0],
            ];
          if (Math.hypot(...cross) < 0.00001) continue;
          if (normalFor(...q)[0] * f.normal[0] + normalFor(...q)[2] * f.normal[1] < 0) q.reverse();
          o.addTriangle(
            'stone',
            ref,
            q,
            [f.normal[0], 0, f.normal[1]],
            q.map((p) => [p[0], p[1]]),
            cream,
          );
        }
      }
    }
}
function steppedGable(o, d, { x, z, angle = 0, width = 10, eave = 21.5, peak = 34, dark = false }) {
  const q = facing(o, angle, x, z),
    w = width / 2,
    h = peak - eave,
    profile = [
      [-w, eave],
      [w, eave],
      [w, eave + h * 0.25],
      [w * 0.7, eave + h * 0.28],
      [w * 0.65, eave + h * 0.58],
      [w * 0.37, eave + h * 0.65],
      [w * 0.37, peak - 1.7],
      [0, peak],
      [-w * 0.37, peak - 1.7],
      [-w * 0.37, eave + h * 0.65],
      [-w * 0.65, eave + h * 0.58],
      [-w * 0.7, eave + h * 0.28],
      [-w, eave + h * 0.25],
    ];
  panel(q, 'trim', profile, -0.6, 0.16, dark ? darkStone : trim);
  if (!d) return;
  for (const [yy, n, ww, hh] of [
    [eave + 0.4, 3, 1.1, 2.7],
    [eave + h * 0.4, 2, 0.85, 1.6],
    [peak - 3.3, 1, 0.65, 0.9],
  ])
    for (let j = 0; j < n; j++)
      window(q, 1, (j - (n - 1) / 2) * width * 0.22, yy, ww, hh, { applied: true, z: 0.17 });
  for (const y of [eave + 0.1, eave + h * 0.3, eave + h * 0.65])
    ledge(
      q,
      0,
      y,
      0.2,
      (width * (y > eave + h * 0.6 ? 0.8 : y > eave + h * 0.2 ? 1.4 : 2)) / 2,
      0.22,
      0.6,
      dark ? darkStone : pale,
    );
  if (d >= 2) {
    outline(q, 'trim', profile, 0.2, 0.16, dark ? trim : pale);
    for (const dx of [-w * 0.9, 0, w * 0.9])
      finial(q, 1, dx, eave + h * (dx === 0 ? 1 : 0.3), 0.15, 1.1);
  }
}
function lantern(o, d, x, z, y, r, h, col = lead) {
  const n = d === 0 ? 3 : d === 1 ? 4 : 8;
  cylinder(o, 'lead', x, z, y, y + 0.3, r * 1.1, r * 1.1, col, n);
  // Separate piers and a raised cap retain real sky through the lantern.
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      xx = x + r * 0.78 * Math.cos(a),
      zz = z + r * 0.78 * Math.sin(a);
    if (d <= 1) {
      for (const angle of [0, Math.PI / 2]) {
        const q = facing(o, angle, xx, zz);
        surface(q, 'trim', rect(0, y + 0.3, r * 0.2, h * 0.68 - 0.3), 0, darkStone);
      }
    } else cylinder(o, 'trim', xx, zz, y + 0.3, y + h * 0.68, r * 0.12, r * 0.11, darkStone, 4);
  }
  loft(
    o,
    'lead',
    [
      [y + h * 0.67, r * 1.05],
      [y + h * 0.81, r * 0.9],
      [y + h * 0.95, r * 0.5],
      [y + h, r * 0.45],
    ].map(([yy, rr]) => radialRing(yy, rr, rr, n, [x, z])),
    col,
  );
}
function crown(o, d, x, z, y, r, tip, { patina = false, open = true } = {}) {
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 16,
    col = patina ? copper : lead,
    height = tip - y,
    lower = height * 0.42;
  loft(
    o,
    'lead',
    (d <= 1
      ? [
          [0, 1.04],
          [0.6, 0.65],
          [1, 0.42],
        ]
      : [
          [0, 1.04],
          [0.1, 0.95],
          [0.36, 0.78],
          [0.65, 0.48],
          [0.88, 0.38],
          [1, 0.42],
        ]
    ).map(([t, rr]) => radialRing(y + t * lower, r * rr, r * rr, n, [x, z])),
    col,
  );
  if (open) lantern(o, d, x, z, y + lower, r * 0.43, height * 0.24, col);
  else cylinder(o, 'lead', x, z, y + lower, y + height * 0.66, r * 0.4, r * 0.32, col, n);
  loft(
    o,
    'lead',
    [
      [0.66, 0.41],
      [0.72, 0.26],
      [0.77, 0.35],
      [0.84, 0.12],
      [1, 0.015],
    ].map(([t, rr]) => radialRing(y + t * height, r * rr, r * rr, n, [x, z])),
    col,
  );
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = facing(o, Math.PI / 2 - a, x + Math.cos(a) * r * 0.88, z + Math.sin(a) * r * 0.88);
      surface(q, 'glass', circle(0, y + lower * 0.27, r * 0.12, r * 0.15, 12), 0.025, glass);
      outline(
        q,
        'trim',
        circle(0, y + lower * 0.27, r * 0.16, r * 0.19, 12),
        0.045,
        0.08,
        trim,
        true,
      );
    }
}
function tower(
  o,
  d,
  f,
  { top = 27, tip = 39, radius = null, patina = false, court = false, base = -2 } = {},
) {
  const rings = [clean(f.rings[0], d <= 1 ? 1.3 : 0.18)];
  const [x, z] = f.center,
    r = radius ?? Math.min(...f.bounds.map((a) => a[1] - a[0])) / 2;
  for (const [faceIndex, face] of faces(rings[0]).entries()) {
    const q = facing(o, face.angle, face.x, face.z),
      w = Math.min(1.05, face.w * 0.65),
      bays =
        d && faceIndex % 2 === 0 && face.w > 1.3
          ? [
              [3, 2.7],
              [9, 3.4],
              [16, 4.4],
              [23, 2.1],
            ]
              .filter(([y, h]) => y >= base + 0.3 && y + h < top - 0.3)
              .map(([y, h]) => ({ x: 0, y, w, h }))
          : [];
    wall(
      q,
      rect(0, base, face.w, top - base),
      d === 3 ? bays.map((b) => rect(0, b.y, b.w, b.h)) : [],
      0,
      0.25,
      court ? pale : darkStone,
      'trim',
    );
    for (const p of bays) window(q, d === 3 ? 2 : 1, 0, p.y, p.w, p.h, { applied: d < 3 });
    if (d >= 2)
      for (const y of [6.7, 13, 21.7, top - 0.25])
        ledge(q, 0, y, 0.01, face.w + 0.16, 0.25, 0.25, court ? pale : trim);
    if (court) decoration(o, d, q, face, [6.7, 13, 21.7], true);
  }
  cap(o, rings, top, darkStone, 'trim');
  crown(o, d, x, z, top, r + 0.3, tip, { patina, open: !court });
  if (d > 0) finial(o, 1, x, tip, z, 1);
}
// Photo-led intermediate proportions; only total height and platform are published controls.
const hausmannDrumTop = 57.5;
const hausmannRoofProfile = [
  [57.5, 8],
  [60.5, 8.5],
  [65, 8.1],
  [69.5, 5.8],
  [73, 4.1],
  [74.5, 3.7],
];
const hausmannSpireProfile = [
  [82.1, 3.8],
  [83.5, 4.8],
  [85.5, 4.4],
  [87.5, 2.2],
  [90, 1.2],
  [100.27, 0.018],
];
function hausmannClock(o, d) {
  if (!d) return;
  for (const f of faces(clean(components.hausmannBase[0], 0.12))) {
    // The two faces visible in the released east/court views; other sides stay unasserted.
    if (f.w < 5 || !(f.z < -6 || f.x > 6)) continue;
    const q = facing(o, f.angle, f.x, f.z),
      y = 31.5,
      n = d === 1 ? 16 : 40;
    surface(q, 'inlay', circle(0, y, 2.15, 2.15, n), 0.06, rgb('993a31'));
    surface(q, 'inlay', circle(0, y, 1.46, 1.46, n), 0.075, rgb('86a7af'));
    outline(q, 'inlay', circle(0, y, 2.17, 2.17, n), 0.09, 0.1, gold, true);
    outline(q, 'inlay', circle(0, y, 1.5, 1.5, n), 0.095, 0.08, gold, true);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      outline(
        q,
        'inlay',
        [
          [Math.sin(a) * 1.68, y + Math.cos(a) * 1.68],
          [Math.sin(a) * 1.96, y + Math.cos(a) * 1.96],
        ],
        0.1,
        0.1,
        gold,
      );
    }
    for (const [a, length] of [
      [-1.15, 1.28],
      [1.15, 0.9],
    ])
      outline(
        q,
        'inlay',
        [
          [0, y],
          [Math.sin(a) * length, y + Math.cos(a) * length],
        ],
        0.12,
        0.12,
        gold,
      );
  }
}
function hausmann(o, d) {
  const r = components.hausmannBase[0],
    top = 39,
    b = { name: 'Hausmann base', rings: [r], top, roofRise: 0 };
  body(o, d, b);
  hausmannClock(o, d);
  const n = d === 0 ? 4 : 8;
  cylinder(o, 'trim', 0, 0, 38.5, 40.2, 7.7, 7.7, darkStone, n);
  // Octagonal exposed drum, rather than a constant-width100m extrusion.
  for (const f of faces(radialRing(0, 7.3, 7.3, 8).map((p) => [p[0], p[2]]))) {
    const q = facing(o, f.angle, f.x, f.z),
      bays = d ? [{ y: 42.5, h: 9 }] : [];
    wall(
      q,
      rect(0, 40, f.w, hausmannDrumTop - 40),
      d >= 2 ? bays.map((b) => arch(0, b.y, 2.3, b.y + b.h - 1.15, 1.15, 10)) : [],
      0,
      0.3,
      darkStone,
      'trim',
    );
    for (const b of bays) window(q, d, 0, b.y, 2.3, b.h, { arched: true });
    if (d > 0) {
      surface(q, 'glass', circle(0, 54.5, 0.72, 0.84, d === 1 ? 8 : 20), 0.035, glass);
      outline(q, 'trim', circle(0, 54.5, 0.82, 0.94, d === 1 ? 8 : 20), 0.055, 0.16, trim, true);
    }
    if (d >= 2) {
      for (const yy of [40.3, 56.7]) ledge(q, 0, yy, 0.08, f.w + 0.22, 0.3, 0.4, trim);
      for (const xx of [-f.w * 0.4, f.w * 0.4]) B(q, 'trim', xx, 40, 0.04, 0.18, 17.3, 0.16, trim);
    }
  }
  cap(
    o,
    [radialRing(hausmannDrumTop, 7.3, 7.3, n).map((p) => [p[0], p[2]])],
    hausmannDrumTop,
    darkStone,
    'trim',
  );
  loft(
    o,
    'lead',
    hausmannRoofProfile.map(([y, r]) => radialRing(y, r, r, d === 0 ? 4 : d === 1 ? 8 : 24)),
    lead,
  );
  lantern(o, d, 0, 0, 74.5, 3.8, 7.8, lead);
  loft(
    o,
    'lead',
    hausmannSpireProfile.map(([y, r]) => radialRing(y, r, r, d === 0 ? 4 : d === 1 ? 8 : 20)),
    lead,
  );
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = facing(o, Math.PI / 2 - a, Math.cos(a) * 8.28, Math.sin(a) * 8.28);
      surface(q, 'glass', circle(0, 63.5, 0.62, 0.73, 16), 0.03, glass);
      outline(q, 'trim', circle(0, 63.5, 0.75, 0.88, 16), 0.04, 0.13, trim, true);
    }
    beam(o, 'inlay', [-1.3, 98.5, 0], [1.3, 98.5, 0], 0.07, 0.07, gold);
    sphere(o, 'inlay', [0, 97.1, 0], [0.25, 0.25, 0.25], gold, 8, 4);
  }
}
function canopy(o, d) {
  const ring = components.smallCourtRoof[0],
    ps = clean(ring, 0.1),
    ids = earcut(ps.flat()),
    y = (x, z) =>
      29.4 +
      8.6 *
        Math.sin(Math.PI * Math.max(0, Math.min(1, (x - 55.6) / 28.85))) *
        Math.sin(Math.PI * Math.max(0, Math.min(1, (z + 36.63) / 44.12)));
  const step = [18, 12, 5, 2.5][d];
  for (let i = 0; i < ids.length; i += 3)
    subdivide(
      ids.slice(i, i + 3).map((j) => ps[j]),
      step,
      (p) => {
        const q = p.map(([x, z]) => [x, y(x, z), z]);
        if (normalFor(...q)[1] < 0) q.reverse();
        o.addTriangle(
          'canopy',
          'palette:#f3ffff',
          q,
          normalFor(...q),
          q.map((p) => [p[0], p[2]]),
          rgb('cadbdb'),
        );
      },
    );
  if (d > 0) {
    const count = d === 1 ? 2 : d === 2 ? 4 : 7;
    // Crossing diagonal steel ribs read as the double-curved diamond net.
    for (const sign of [-1, 1])
      for (let k = -count; k <= count; k++) {
        let previous = null;
        for (let j = 0; j <= 24; j++) {
          const u = j / 24,
            v = k / count + sign * u;
          if (v < 0 || v > 1) {
            previous = null;
            continue;
          }
          const x = 56.0 + 27.8 * u,
            z = -35.8 + 42.6 * v,
            p = [x, y(x, z) + 0.035, z];
          if (previous) {
            if (d === 3) beam(o, 'inlay', previous, p, 0.065, 0.065, rgb('a3afac'));
            else {
              const v = p.map((a, i) => a - previous[i]),
                ll = Math.hypot(v[0], v[2]),
                u = [(-v[2] / ll) * 0.045, 0, (v[0] / ll) * 0.045];
              const ps = [
                previous.map((a, i) => a - u[i]),
                p.map((a, i) => a - u[i]),
                p.map((a, i) => a + u[i]),
                previous.map((a, i) => a + u[i]),
              ];
              quad(o, 'inlay', ps, normalFor(...ps), rgb('a3afac'));
            }
          }
          previous = p;
        }
      }
  }
}
const longFaces = faces(components.longGallery[0]),
  longFront = longFaces.filter((f) => f.w > 80).find((f) => Math.sin(f.angle) > 0),
  longBack = longFaces.filter((f) => f.w > 80).find((f) => Math.sin(f.angle) < 0);
function longGallery(o, d) {
  const rings = components.longGallery,
    top = 9.8;
  cap(o, rings, top, slate, 'roof');
  cap(o, rings, -2, darkStone, 'trim', -1);
  for (const f of longFaces) {
    const q = facing(o, f.angle, f.x, f.z),
      arcade = f === longFront,
      n = f.w > 80 ? 22 : 0,
      bays = Array.from({ length: n }, (_, i) => ({
        x: ((i + 0.5) / n - 0.5) * f.w,
        w: f.w / n - 0.85,
      })),
      arches = arcade ? bays.map((b) => arch(b.x, -2, b.w, 3.65, b.w / 2, d === 3 ? 12 : 6)) : [],
      windows = d ? bays.map((b) => ({ x: b.x, w: 1.25, y: 7.1, h: 1.9 })) : [];
    wall(
      q,
      rect(0, -2, f.w, top + 2),
      [...arches, ...(d >= 2 ? windows.map((w) => rect(w.x, w.y, w.w, w.h)) : [])],
      0,
      0.4,
      arcade ? trim : cream,
      'trim',
    );
    for (const w of windows) window(q, d, w.x, w.y, w.w, w.h);
    if (d) {
      for (const y of [6.5, 9.55]) ledge(q, 0, y, 0.05, f.w, 0.25, 0.4, trim);
      if (arcade && d >= 2) {
        for (let j = 0; j <= 22; j++) {
          const x = (j / 22 - 0.5) * f.w;
          cylinder(q, 'trim', x, 0, -1, 3.7, 0.28, 0.23, trim, d === 1 ? 4 : 8);
          B(q, 'trim', x, 3.5, 0, 0.7, 0.28, 0.65, trim);
        }
        for (const b of bays)
          outline(
            q,
            'trim',
            arch(b.x, 0, b.w, 3.65, b.w / 2, d === 3 ? 12 : 6).slice(2),
            0.08,
            0.18,
            trim,
          );
      } else if (!arcade && f.w > 80) {
        // Abstract gold frieze at the real Fürstenzug band; no copied procession.
        surface(q, 'inlay', rect(0, 1.45, f.w, 4.65), 0.025, rgb('b69c59'));
        if (d >= 2)
          for (const b of bays) {
            const x = b.x;
            outline(
              q,
              'inlay',
              [
                [x - 1.2, 2],
                [x - 0.2, 3.8],
                [x + 0.7, 2.5],
                [x + 1.2, 4.8],
              ],
              0.045,
              0.11,
              rgb('76644a'),
            );
            surface(q, 'inlay', circle(x, 4.8, 0.2, 0.2, 8), 0.05, pale);
          }
      }
    }
  }
  // Native skewed gallery has paired end centres and an actual two-slope clay roof.
  const r = components.longGallery[0],
    a = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2],
    b = [(r[2][0] + r[3][0]) / 2, (r[2][1] + r[3][1]) / 2];
  for (const [j, k] of [
    [0, 3],
    [1, 2],
  ]) {
    const q = [
      [...r[j].slice(0, 1), top, r[j][1]],
      [r[k][0], top, r[k][1]],
      [b[0], 13.5, b[1]],
      [a[0], 13.5, a[1]],
    ];
    quad(
      o,
      'roof',
      q,
      normalFor(...q)[1] > 0 ? normalFor(...q) : normalFor(...q).map((v) => -v),
      slate,
    );
  }
  if (d >= 2)
    for (const t of [0.13, 0.36, 0.6, 0.83]) {
      const x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      steppedGable(o, 1, {
        x: x + 1.5,
        z,
        angle: longFront.angle,
        width: 2.8,
        eave: 11.3,
        peak: 14.5,
      });
    }
}
function smallCourtArcades(o, d) {
  if (d < 2) return;
  const ring = clean(components.main[2], 0.8);
  for (const f of faces(ring, true)) {
    if (f.w < 9) continue;
    const q = facing(o, f.angle, f.x, f.z),
      n = Math.max(2, Math.floor(f.w / 4.4));
    // Projected gallery sits inside the courtyard, leaving a real walk behind each arch.
    for (const y of [0.65, 6.7]) {
      B(q, 'trim', 0, y - 0.25, 1.0, f.w, 0.3, 2, trim);
      const openings = Array.from({ length: n }, (_, j) =>
        arch(
          ((j + 0.5) / n - 0.5) * f.w,
          y,
          f.w / n - 0.5,
          y + 3.2,
          (f.w / n - 0.5) / 2,
          d >= 2 ? 10 : 6,
        ),
      );
      if (y < 2) openings.push(...portalsFor(f, y, d).map((p) => p.polygon));
      wall(q, rect(0, y, f.w, 5.8), openings, 2, 0.25, trim, 'trim');
      for (let j = 0; j <= n; j++) {
        const x = (j / n - 0.5) * f.w,
          p = pointAt(f, x, 2);
        if (y < 2 && Math.abs(p[0] - 67) < 2.2 && p[1] >= 3 && p[1] <= 39) continue;
        cylinder(q, 'trim', x, 2, y, y + 4.8, 0.22, 0.18, trim, d >= 2 ? 8 : 4);
      }
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) / n - 0.5) * f.w,
          w = f.w / n - 0.5;
        outline(q, 'trim', arch(x, y, w, y + 3.2, w / 2, d >= 2 ? 12 : 6).slice(2), 2, 0.26, trim);
      }
    }
  }
}
function altan(o, d) {
  // Three-level open loggia on the court side of the Hausmann base.
  const q = facing(o, Math.PI / 2, 9.2, 0),
    w = 14;
  for (const y of [7.1, 13.6, 20.1]) {
    B(q, 'trim', 0, y - 0.4, -1, w, 0.4, 2, trim);
    if (d >= 2) {
      for (const x of [-6.6, -2.2, 2.2, 6.6]) {
        cylinder(q, 'trim', x, 0, y, y + 5.2, 0.22, 0.2, trim, d >= 2 ? 8 : 3);
        B(q, 'trim', x, y + 5, 0, 0.7, 0.22, 0.65, trim);
      }
      for (const x of [-4.4, 0, 4.4])
        outline(
          q,
          'trim',
          arch(x, y, 3.9, y + 3.5, 1.9, d >= 2 ? 12 : 4).slice(2),
          0.01,
          0.3,
          trim,
        );
      for (let x = -6.8; x < 6.9; x += d >= 2 ? 0.8 : 2)
        B(q, 'trim', x, y, 0.1, 0.12, 1.1, 0.12, trim);
      B(q, 'trim', 0, y + 1.1, 0.1, w, 0.14, 0.22, trim);
    }
  }
}
function courtFountain(o, d) {
  if (d < 2) return;
  const q = facing(o, Math.PI, 39, 32.6),
    y = 0.2;
  loft(
    q,
    'trim',
    [radialRing(y, 2.8, 1.3, d === 3 ? 20 : 12), radialRing(y + 0.65, 3.1, 1.5, d === 3 ? 20 : 12)],
    darkStone,
  );
  panel(
    q,
    'trim',
    [
      [-2, y + 0.6],
      [2, y + 0.6],
      [2, y + 2.3],
      [1.6, y + 3.2],
      [0, y + 3.7],
      [-1.6, y + 3.2],
      [-2, y + 2.3],
    ],
    -0.5,
    -0.2,
    trim,
  );
  for (const x of [-1, 0, 1])
    sphere(q, 'trim', [x, y + 1.7, -0.1], [0.24, 0.2, 0.23], darkStone, 8, 4);
  surface(q, 'glass', rect(0, y + 0.64, 3.7, 0.03), 0.3, rgb('607774'));
}
function paving(o, d) {
  if (d !== 3) return;
  for (const ring of components.main.slice(1)) {
    const ps = clean(ring, 0.04),
      ids = earcut(ps.flat());
    for (let i = 0; i < ids.length; i += 3)
      subdivide(
        ids.slice(i, i + 3).map((j) => ps[j]),
        8,
        (p) => {
          const q = p.map(([x, z]) => [x, sample(x, z) + 0.065, z]);
          let lift = 0;
          for (let a = 0; a <= 8; a++)
            for (let b = 0; b <= 8 - a; b++) {
              const weights = [a / 8, b / 8, 1 - (a + b) / 8],
                v = [0, 1, 2].map((k) => q.reduce((s, p, i) => s + p[k] * weights[i], 0));
              lift = Math.max(lift, sample(v[0], v[2]) - v[1] + 0.055);
            }
          for (const p of q) p[1] += lift;
          if (normalFor(...q)[1] < 0) q.reverse();
          o.addTriangle(
            'trim',
            ref,
            q,
            normalFor(...q),
            q.map((p) => [p[0], p[2]]),
            rgb('aba99a'),
          );
        },
      );
  }
}
function details(o, d) {
  if (!d) return;
  const georgPart = frame.features.find((f) => f.index === 97),
    georgFront =
      georgPart &&
      faces(clean(georgPart.rings[0], 0.5)).find(
        (f) => Math.sin(f.angle) < -0.85 && Math.abs(f.z + 69) < 3,
      );
  if (georgFront)
    steppedGable(o, d, {
      x: georgFront.x,
      z: georgFront.z,
      angle: georgFront.angle,
      width: 14,
      eave: 22,
      peak: 34.5,
    });
  // The two major west gables and shorter end gables belong to this facade.
  for (const x of [16.5, 46]) steppedGable(o, d, { x, z: 56.7, width: 12.3, peak: 35.8 });
  for (const [x, z, w] of [
    [0, 57.2, 7.5],
    [69, 36.5, 7.5],
    [85, 14.6, 7.5],
  ])
    steppedGable(o, d, { x, z, width: w, peak: 32, dark: true });
  for (const f of faces(clean(components.main[1], 0.8), true).filter((f) => f.w > 20)) {
    steppedGable(o, d, { x: f.x, z: f.z, angle: f.angle, width: 10, eave: 21.5, peak: 34.5 });
  }
  if (d >= 2) {
    for (const f of faces(clean(components.main[0], 0.8)).filter((f) => f.w > 15)) {
      const n = Math.floor(f.w / 6),
        q = facing(o, f.angle, f.x, f.z);
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) / n - 0.5) * f.w,
          p = pointAt(f, x, -1.8);
        const qq = facing(o, f.angle, p[0], p[1]);
        panel(
          qq,
          'trim',
          [
            [-1.15, 23.2],
            [1.15, 23.2],
            [1.15, 25.6],
            [0, 27.3],
            [-1.15, 25.6],
          ],
          -0.7,
          0,
          j % 3 === 0 ? darkStone : trim,
        );
        window(qq, 1, 0, 23.6, 1.05, 1.9, { applied: true });
      }
      for (let j = 0; j < Math.floor(f.w / 14); j++) {
        const p = pointAt(f, ((j + 0.5) / Math.floor(f.w / 14) - 0.5) * f.w, -5);
        B(o, 'trim', p[0], 29, p[1], 1.7, 3.3, 1.1, darkStone);
        B(o, 'trim', p[0], 32.1, p[1], 2, 0.25, 1.4, trim);
      }
      // Paired upper wooden window heads and small triangular pediments.
      const windows = windowLayout(bodies[0], f, 0, 2).filter((w) => w.y === 7.4);
      for (const w of windows)
        surface(
          q,
          'trim',
          [
            [w.x - 1.3, 12],
            [w.x + 1.3, 12],
            [w.x, 13],
          ],
          0.08,
          trim,
        );
    }
    // Two bronze tournament columns stand within the stable court.
    for (const [x, z] of [
      [36, -126],
      [43, -143],
    ]) {
      const y = sample(x, z) + 0.03;
      cylinder(o, 'trim', x, z, y, y + 0.3, 0.8, 0.8, trim, 8);
      cylinder(o, 'lead', x, z, y + 0.3, y + 5.2, 0.29, 0.23, rgb('53624a'), 12);
      sphere(o, 'lead', [x, y + 5.35, z], [0.35, 0.4, 0.35], rgb('53624a'), 12, 6);
    }
    // South double entrance: closed recessed wood leaves, not a false black hole.
    const f = faces(clean(components.main[0], 0.03)).find((f) => f.x > 109 && f.w > 12);
    if (f) {
      const q = facing(o, f.angle, f.x, f.z);
      B(q, 'trim', 0, -0.55, 0.15, 0.65, 5.2, 0.6, trim);
      B(q, 'trim', 0, 4.4, 0.05, 7.5, 0.6, 0.7, trim);
    }
  }
}
function skyline(o) {
  for (const b of bodies) {
    const rings = b.rings.map((r) => clean(r, 3));
    for (const [j, r] of rings.entries())
      for (const f of faces(r, j > 0)) {
        const q = facing(o, f.angle, f.x, f.z),
          portals = portalsFor(f, -2, 0);
        wall(
          q,
          rect(0, -2, f.w, b.top + 2),
          portals.map((p) => p.polygon),
          0,
          0,
          cream,
        );
      }
    roofField(o, 0, b);
  }
  // Roof crowns retain open four-pier lanterns; the bodies use faceted distant proxies.
  for (const [group, top, tip, r] of [
    [components.westTowers, 27, 43, 3.5],
    [components.southTowers, 25, 39, 4.6],
    [components.courtStairTowers, 24, 38, 3.3],
  ])
    for (const f of group) {
      const [x, z] = f.center;
      cylinder(o, 'trim', x, z, -2, top, r, r, darkStone, 4, false);
      if (group === components.courtStairTowers)
        cylinder(o, 'lead', x, z, top, tip, r + 0.2, 0.02, lead, 4);
      else {
        cylinder(o, 'lead', x, z, top, top + 5, r + 0.2, r * 0.4, lead, 4);
        lantern(o, 0, x, z, top + 5, r * 0.42, 4, lead);
        cylinder(o, 'lead', x, z, top + 9, tip, r * 0.4, 0.018, lead, 4);
      }
    }
  // Twenty-two open spans remain visible in silhouette, without individual columns/mouldings.
  for (const f of longFaces) {
    const q = facing(o, f.angle, f.x, f.z),
      holes =
        f === longFront
          ? Array.from({ length: 22 }, (_, j) =>
              rect(((j + 0.5) / 22 - 0.5) * f.w, -2, f.w / 22 - 0.7, 7.7),
            )
          : [];
    wall(q, rect(0, -2, f.w, 11.8), holes, 0, 0, trim, 'trim');
  }
  cap(o, components.longGallery, 9.8, slate, 'roof');
  cylinder(o, 'trim', 0, 0, 21.5, hausmannDrumTop, 7.3, 7.3, darkStone, 4);
  loft(
    o,
    'lead',
    hausmannRoofProfile
      .filter((_, i) => i !== 2 && i !== 4)
      .map(([y, r]) => radialRing(y, r, r, 4)),
    lead,
  );
  lantern(o, 0, 0, 0, 74.5, 3.8, 7.8, lead);
  loft(
    o,
    'lead',
    hausmannSpireProfile.map(([y, r]) => radialRing(y, r, r, 4)),
    lead,
  );
  canopy(o, 0);
}
function build(o, d) {
  if (d === 0) {
    skyline(o);
    return;
  }
  if (d === 1) {
    skyline(o);
    for (const b of bodies)
      for (const [j, r] of b.rings.entries())
        for (const f of faces(clean(r, 0.8), j > 0)) {
          const q = facing(o, f.angle, f.x, f.z);
          for (const w of windowLayout(b, f, j, 1))
            window(q, 1, w.x, w.y, w.w, w.h, { applied: true });
        }
    for (const x of [16.5, 46]) steppedGable(o, 1, { x, z: 56.7, width: 12.3, peak: 35.8 });
    return;
  }
  if (d === 2) {
    for (const b of bodies) {
      body(o, 2, b);
      roofField(o, 1, b);
    }
    longGallery(o, 1);
    for (const f of components.westTowers) tower(o, 1, f, { top: 27, tip: 43, radius: 3.5 });
    for (const f of components.southTowers)
      tower(o, 1, f, { top: 25, tip: 39, radius: 4.6, patina: true });
    for (const f of components.courtStairTowers)
      tower(o, 1, f, { top: 24, tip: 38, radius: 3.3, court: true });
    hausmann(o, 1);
    altan(o, 2);
    canopy(o, 1);
    details(o, 1);
    cap(o, [components.southServiceRoof[0]], 19, slate, 'roof');
    return;
  }
  for (const b of bodies) {
    body(o, d, b);
    roofField(o, d, b);
  }
  longGallery(o, d);
  for (const f of components.westTowers) tower(o, d, f, { top: 27, tip: 43, radius: 3.5 });
  for (const f of components.southTowers)
    tower(o, d, f, { top: 25, tip: 39, radius: 4.6, patina: true });
  for (const f of components.courtStairTowers)
    tower(o, d, f, { top: 24, tip: 38, radius: 3.3, court: true });
  hausmann(o, d);
  altan(o, d);
  canopy(o, d);
  smallCourtArcades(o, d);
  const service = components.southServiceRoof[0];
  cap(o, [service], 19, slate, 'roof');
  const georg = frame.features.find((f) => f.index === 121);
  tower(o, d, georg, { base: 22, top: 28, tip: 40, radius: 3.1, patina: true });
  details(o, d);
  courtFountain(o, d);
  paving(o, d);
}
export const dresdenClose = (o) => build(o, 3),
  dresdenStreet = (o) => build(o, 2),
  dresdenDistrict = (o) => build(o, 1),
  dresdenSkyline = (o) => build(o, 0);
const surfaces = {
  stone: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.94, metallic: 0 },
  lead: { slot: 'roof', graph: 'metal_copper', roughness: 0.7, metallic: 0.4 },
  glass: { slot: 'window', localRef: ref, roughness: 0.38, metallic: 0.05 },
  wood: { slot: 'door', localRef: ref, roughness: 0.84, metallic: 0 },
  inlay: { slot: 'trim', localRef: ref, roughness: 0.8, metallic: 0.1 },
  canopy: {
    slot: 'window',
    localRef: 'palette:#f3ffff',
    roughness: 0.28,
    metallic: 0,
    baseColorFactor: [1, 1, 1, 0.38],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
};
export const dresdenCastleModel = {
  id: 'dresden_castle',
  key: 'dresden_castle',
  recipe: 'structure-dresden-castle.mjs',
  cell: 'u3/u31',
  title: 'Dresden Castle',
  brief:
    'Native reconstructed castle with three actual courtyard voids,100.27m Hausmann tower/39m platform, red-blue clocks below the platform, one main arched-window tier and small upper round lights in the dark octagonal drum, substantial rounded lead roof/open lantern/upper bulb/tall needle. Two dark west corner lantern towers, two green-copper south turrets and four pointed court stair towers. Ochre exterior/rusticated ground storey and original abstract black-white Great Court sgraffito, stepped/curved gables, red tiled roofs, small roof dormers and chimneys, three-tier Altan loggia and two-storey Small Court arcades under a raised double-curved transparent ETFE diamond net. Connected Georgenbau through-gateway and100m skewed Langer Gang/22 real open arches, upper gallery windows and abstract gold frieze. Four actual through-entry routes, closed wooden south entrance, court basin and two tournament columns. Own paving follows independent unchanged GeoSN DGM. Cathedral/covered church bridge, Zwinger, Johanneum, Taschenbergpalais, gardens, temporary works and interiors excluded.',
  camera: [195, 145, 215],
  lookAt: [38, 28, -42],
  qaCameras: [
    { name: 'west-front', position: [30, 28, 143], lookAt: [29, 24, 43] },
    { name: 'great-court', position: [37, 12, 19], lookAt: [11, 18, -3] },
    { name: 'small-court', position: [73, 11, -13], lookAt: [62, 18, -8] },
    { name: 'hausmann-lantern', position: [26, 79, 32], lookAt: [0, 75, 0] },
    { name: 'hausmann-profile', position: [66, 63, -82], lookAt: [0, 63, 0] },
    { name: 'hausmann-clock', position: [21, 32, -29], lookAt: [0, 31.5, -3] },
    { name: 'etfe-roof', position: [119, 67, 29], lookAt: [69, 32, -14] },
    { name: 'georgentor', position: [-58, 11, -69], lookAt: [-6, 10, -69] },
    { name: 'long-arcade', position: [76, 12, -134], lookAt: [14, 5, -134] },
    { name: 'furstenzug-frieze', position: [-38, 13, -139], lookAt: [15, 6, -137] },
  ],
  mediumFiContext: { scale: 2.6, cameraYaw: 0, groundY: -2 },
  build: dresdenClose,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent official GeoSN original1m DGM GeoTIFF acquired before geometry. Unchanged native cell-centre Float32 heights bilinearly sampled on2m review grid;50625 values,112.3239m DHHN2016 datum at dry Great Court[30,0]. Original TIFF/worldfile/metadata/epoch retained; coarse Terrarium baseline datum121.8257m rejected and preserved. Native own-outline ground−.988..+.712m; own walls continue to−2m. Terrain unchanged; compatible host required, footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-dresden-castle.mjs',
    level: 'skyline',
    export: 'dresdenSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'dresdenDistrict', errorMeters: 3, surfaces },
      street: { export: 'dresdenStreet', errorMeters: 1.5, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Roof ridges, dome rise, bay/window counts, intermediate heights, precise geometric ornament and thresholds are photo/map interpretations, not surveyed construction drawings. Original abstract decoration replaces literal paintings, procession figures and inscriptions. Lower service-court roof form is uncertain. Translucent ETFE is a simplified material proxy; interior engineering is not reconstructed. Native Langer Gang polygon is independently retained/checked but outside the single primary magenta placement overlay.',
  ],
};
export {
  altan,
  bodies,
  body,
  build,
  canopy as canopyMesh,
  canopy,
  clean,
  components,
  courtFountain,
  details,
  distance,
  faces,
  frame,
  hausmann,
  longBack,
  longFaces,
  longFront,
  longGallery,
  paving,
  pointAt,
  portalControls,
  portalsFor,
  roofField,
  sample,
  skyline,
  smallCourtArcades,
  terrain,
  tolerances,
  tower,
  windowLayout,
};
