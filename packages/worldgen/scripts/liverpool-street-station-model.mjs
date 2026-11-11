import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcp/liverpool_street_station/layout.json',
      import.meta.url,
    ),
  ),
);
const wall = { slot: 'wall', graph: 'brick_flemish', roughness: 0.91 };
const trim = { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92 };
const ground = { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 };
const iron = { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.15 };
const slate = { slot: 'roof', graph: 'slate', roughness: 0.86 };
const zinc = { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0.13 };
const glass = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.39 };
export const surfaces = {
  wall,
  pier: wall,
  trim,
  pale: trim,
  shadow: trim,
  slate,
  zinc,
  under: zinc,
  floor: ground,
  paving: ground,
  bed: ground,
  deck: ground,
  tactile: ground,
  iron,
  green: iron,
  red: iron,
  dark: iron,
  white: iron,
  glass,
  lightGlass: glass,
  clear: {
    slot: 'window',
    localRef: 'palette:#d2e7ed',
    baseColorFactor: [1, 1, 1, 0.33],
    alphaMode: 'BLEND',
    doubleSided: true,
    roughness: 0.31,
  },
};
const palette = {
  wall: [0.72, 0.51, 0.35],
  pier: [0.64, 0.43, 0.3],
  trim: [0.78, 0.732, 0.617],
  pale: [0.865, 0.817, 0.705],
  shadow: [0.54, 0.501, 0.409],
  slate: [0.268, 0.294, 0.33],
  zinc: [0.606, 0.639, 0.636],
  under: [0.449, 0.471, 0.45],
  floor: [0.585, 0.56, 0.509],
  paving: [0.622, 0.605, 0.56],
  bed: [0.458, 0.433, 0.403],
  deck: [0.56, 0.548, 0.509],
  tactile: [0.872, 0.754, 0.388],
  iron: [0.31, 0.366, 0.379],
  green: [0.247, 0.393, 0.387],
  red: [0.481, 0.204, 0.177],
  dark: [0.209, 0.235, 0.229],
  white: [0.936, 0.916, 0.831],
  glass: [0.223, 0.34, 0.408],
  lightGlass: [0.58, 0.747, 0.771],
  clear: [0.8, 0.875, 0.912],
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([role, c]) => [
    role,
    c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))),
  ]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  north = [0, 0, -1],
  south = [0, 0, 1],
  west = [-1, 0, 0],
  east = [1, 0, 0];
const mix = (a, b, t) => a + (b - a) * t,
  at = ([x, z], y) => [x, y, z];
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const box = (f, role, x, z, w, d, a, b) => prism(f, role, rect(x, z, w, d), a, b, false);
function writer(out) {
  return (role, points, dir, tint = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const tri = [points[0], points[i], points[i + 1]].map((p) => p.map(Math.fround));
      let n = normalFor(...tri);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
        tri.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        'palette:#ffffff',
        tri,
        n,
        undefined,
        colors[role].map((c) => c * tint),
      );
    }
  };
}
function grade(rows, x) {
  const idx = rows.findIndex((p) => p[0] >= x);
  if (idx === 0) return rows[0][1];
  if (idx < 0) return rows.at(-1)[1];
  const [a, y] = rows[idx - 1],
    [b, z] = rows[idx];
  return mix(y, z, (x - a) / (b - a));
}
const railAt = (x) => grade(layout.railGrade, x);
function cap(f, role, P, y, n = up) {
  const rings = [P.outline, ...(P.holes ?? [])],
    pts = rings.flat(),
    starts = [];
  let len = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(len);
    len += h.length;
  }
  const ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix.slice(i, i + 3).map((j) => at(pts[j], typeof y === 'function' ? y(...pts[j]) : y)),
      n,
    );
}
function simple(ring, t = 0.42) {
  const r = ring.slice();
  while (r.length > 3) {
    const distances = r.map(([x, z], i) => {
      const [a, b] = r[(i + r.length - 1) % r.length],
        [c, d] = r[(i + 1) % r.length],
        dx = c - a,
        dz = d - b,
        l = dx * dx + dz * dz;
      const u = l ? Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / l)) : 0;
      return Math.hypot(x - a - u * dx, z - b - u * dz);
    });
    const min = Math.min(...distances);
    if (min > t) break;
    r.splice(distances.indexOf(min), 1);
  }
  return r;
}
function edge(a, b, n) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    a,
    b,
    n,
    l,
    p: (t, y, d = 0) => [mix(a[0], b[0], t / l) + d * n[0], y, mix(a[1], b[1], t / l) + d * n[2]],
  };
}
function edges(ring) {
  const side = Math.sign(
    ring.reduce((s, [x, z], i) => {
      const [u, v] = ring[(i + 1) % ring.length];
      return s + x * v - z * u;
    }, 0),
  );
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return l > 0.05 ? [edge(a, b, [(side * dz) / l, 0, (-side * dx) / l])] : [];
  });
}
function face(f, role, E, a, b, y, h, d = 0, tint = 1) {
  if (b - a > 0.018 && h - y > 0.018)
    f(role, [E.p(a, y, d), E.p(b, y, d), E.p(b, h, d), E.p(a, h, d)], E.n, tint);
}
function band(f, role, E, a, b, y, h, d) {
  face(f, role, E, a, b, y, y + h, d);
  if (d > 0.02) {
    f(role, [E.p(a, y), E.p(b, y), E.p(b, y, d), E.p(a, y, d)], down);
    f(role, [E.p(a, y + h), E.p(b, y + h), E.p(b, y + h, d), E.p(a, y + h, d)], up);
  }
}
function arch(E, a, b, shoulder, rise, n, d = 0) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / n);
    return E.p((a + b) / 2 + ((b - a) / 2) * Math.cos(angle), shoulder + rise * Math.sin(angle), d);
  });
}
function arched(
  f,
  E,
  a,
  b,
  base,
  shoulder,
  rise,
  top,
  d,
  open = false,
  frame = 'trim',
  pane = 'glass',
) {
  const n = d >= 3 ? 12 : d === 2 ? 8 : 4,
    arc = arch(E, a, b, shoulder, rise, n);
  if (!open) {
    face(f, pane, E, a, b, base, shoulder, -0.024);
    f(pane, arch(E, a, b, shoulder, rise, n, -0.024), E.n);
  }
  for (let i = 1; i < arc.length; i++) {
    const p = arc[i - 1],
      q = arc[i];
    f('wall', [p, q, [q[0], top, q[2]], [p[0], top, p[2]]], E.n);
  }
  if (d < 1) return;
  const inside = arch(E, a, b, shoulder, rise, n, 0.14),
    out = arch(E, a - 0.22, b + 0.22, shoulder, rise + 0.25, n, 0.14);
  for (let i = 1; i < inside.length; i++)
    f(frame, [inside[i - 1], inside[i], out[i], out[i - 1]], E.n);
  face(f, frame, E, a - 0.22, a, base, shoulder, 0.14);
  face(f, frame, E, b, b + 0.22, base, shoulder, 0.14);
  if (!open && d >= 2) {
    for (const t of [0.25, 0.5, 0.75]) {
      const x = mix(a, b, t);
      face(f, 'red', E, x - 0.062, x + 0.062, base, shoulder + rise * 0.82, 0.044);
    }
    for (const y of [mix(base, shoulder, 0.48), shoulder])
      face(f, 'red', E, a, b, y - 0.049, y + 0.049, 0.052);
  }
}
function bays(f, E, from, to, lo, hi, d, central = false) {
  const length = to - from;
  if (length < 0.05) return;
  face(f, 'pier', E, from, to, -8, lo);
  if (d === 0 || length < 4) {
    face(f, 'wall', E, from, to, lo, hi);
    if (length > 8) face(f, 'trim', E, from, to, hi - 0.5, hi, 0.12);
    return;
  }
  const count = Math.max(1, Math.round(length / (central ? 6.45 : 7.3)));
  const step = length / count,
    y = lo + 1.28,
    shoulder = lo + 4.1,
    top = lo + 6.05,
    upper = hi - 1.26;
  face(f, 'wall', E, from, to, lo, y);
  if (d === 1) {
    face(f, 'wall', E, from, to, y, hi);
    for (let i = 0; i < count; i++) {
      const a = from + i * step,
        c = a + step / 2;
      face(f, 'glass', E, c - step * 0.29, c + step * 0.29, y, shoulder + 0.6, 0.023);
      face(f, 'glass', E, c - step * 0.29, c + step * 0.29, top + 0.52, upper, 0.023);
    }
  } else {
    face(f, 'wall', E, from, to, top, hi);
    for (let i = 0; i < count; i++) {
      const l = from + i * step,
        r = l + step,
        a = l + step * 0.18,
        b = r - step * 0.18,
        c = (a + b) / 2;
      face(f, 'wall', E, l, a, y, top);
      face(f, 'wall', E, b, r, y, top);
      arched(f, E, a, b, y, shoulder, 1.31, top, d);
      if (upper > top + 0.69) {
        face(f, 'glass', E, a, b, top + 0.5, upper, 0.041);
        for (const p of [a, c, b]) face(f, 'red', E, p - 0.076, p + 0.076, top + 0.5, upper, 0.094);
        band(f, 'trim', E, a - 0.17, b + 0.17, top + 0.3, 0.19, 0.23);
        if (d >= 3 && central) band(f, 'pale', E, a - 0.32, b + 0.32, upper + 0.03, 0.24, 0.29);
      }
      if (central || d >= 3) face(f, 'trim', E, l + 0.14, l + 0.48, lo, hi - 0.57, 0.22);
    }
  }
  for (const [h, w] of [
    [top - 0.15, 0.26],
    [hi - 0.47, 0.34],
  ])
    band(f, 'trim', E, from, to, h, w, 0.27);
}
function stripe(f, role, a, b, width) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l = Math.hypot(dx, dz);
  if (l < 0.03) return;
  const x = (dz * width) / (2 * l),
    z = (-dx * width) / (2 * l);
  f(
    role,
    [
      [a[0] + x, a[1], a[2] + z],
      [b[0] + x, b[1], b[2] + z],
      [b[0] - x, b[1], b[2] - z],
      [a[0] - x, a[1], a[2] - z],
    ],
    up,
  );
}
function tracks(f, path, d) {
  const axis = 0,
    vertical = railAt;
  const gradeBreaks = layout.railGrade.map((p) => p[0]);
  for (let i = 1; i < path.length; i++) {
    const [x, z] = path[i - 1],
      [u, v] = path[i],
      p = path[i - 1][axis],
      q = path[i][axis];
    const t = [
      0,
      ...gradeBreaks.map((a) => (a - p) / (q - p)).filter((s) => s > 0 && s < 1),
      1,
    ].sort((a, b) => a - b);
    const dx = u - x,
      dz = v - z,
      l = Math.hypot(dx, dz);
    if (l < 0.03) continue;
    const at = (t, w, h) => {
      const x1 = mix(x, u, t) + (w * dz) / l,
        z1 = mix(z, v, t) - (w * dx) / l;
      return [x1, vertical(x1, z1) + h, z1];
    };
    for (let j = 1; j < t.length; j++)
      for (const w of d <= 1 ? [0] : [-0.7175, 0.7175])
        stripe(f, 'dark', at(t[j - 1], w, 0.087), at(t[j], w, 0.087), d <= 1 ? 1.27 : 0.073);
    if (d >= 3) {
      const count = Math.ceil(l / (d >= 4 ? 1.09 : 2.28));
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count;
        stripe(f, 'under', at(t, -0.99, 0.045), at(t, 0.99, 0.045), 0.19);
      }
    }
  }
}
function clockFace(f, bar, E, center, y, r, d) {
  const n = d >= 2 ? 22 : 9;
  for (const [role, scale, z] of [
    ['dark', 1.14, 0.29],
    ['white', 0.98, 0.32],
  ]) {
    f(
      role,
      Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return E.p(center + r * scale * Math.cos(a), y + r * scale * Math.sin(a), z);
      }),
      E.n,
    );
  }
  bar(
    'dark',
    E.p(center, y, 0.355),
    E.p(center + r * 0.39, y + r * 0.36, 0.355),
    r * 0.077,
    r * 0.071,
  );
  bar(
    'dark',
    E.p(center, y, 0.355),
    E.p(center - r * 0.14, y + r * 0.64, 0.355),
    r * 0.058,
    r * 0.059,
  );
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        c = Math.cos(a),
        s = Math.sin(a);
      face(
        f,
        'dark',
        E,
        center + r * c * 0.78 - 0.037,
        center + r * c * 0.78 + 0.037,
        y + r * s * 0.78 - 0.037,
        y + r * s * 0.78 + 0.037,
        0.352,
      );
    }
}

function shell(f, P, role, top, bottom, d) {
  const outline = d === 0 ? simple(P.outline, 0.68) : P.outline;
  cap(f, role, { ...P, outline }, top);
  for (const E of edges(outline)) {
    const [x, z] = E.a,
      [u, v] = E.b,
      lo = typeof bottom === 'function' ? bottom(x, z) : bottom,
      y = typeof top === 'function' ? top(x, z) : top,
      w = typeof top === 'function' ? top(u, v) : top;
    f(
      'pier',
      [
        [x, lo, z],
        [u, typeof bottom === 'function' ? bottom(u, v) : bottom, v],
        [u, w, v],
        [x, y, z],
      ],
      E.n,
    );
  }
}
function stationFloors(f, d) {
  const { railBed, railGrade, head, mezz, upper, lower } = layout;
  for (let i = 1; i < railGrade.length; i++) {
    const [x, y] = railGrade[i - 1],
      [u, h] = railGrade[i];
    const a = railBed[0][1],
      b = railBed[2][1];
    f(
      'bed',
      [
        [x, y, a],
        [u, h, a],
        [u, h, b],
        [x, y, b],
      ],
      up,
    );
    for (const [z, n] of [
      [a, north],
      [b, south],
    ])
      f(
        'pier',
        [
          [x, -5.2, z],
          [u, -5.2, z],
          [u, h, z],
          [x, y, z],
        ],
        n,
      );
  }
  for (const P of head) shell(f, P, 'floor', lower, -5.2, d);
  shell(f, { outline: layout.eastConnector }, 'floor', lower, -5.2, d);
  for (const P of mezz) shell(f, P, 'paving', upper, upper - 0.42, d);
  for (const p of layout.portals) {
    const at = (x, y, z) => (p.axis === 'z' ? [x, y, z] : [z, y, x]),
      inner = p.edge + p.inward * 0.41;
    for (let i = 1; i < p.profile.length; i++) {
      const [a, y] = p.profile[i - 1],
        [b, h] = p.profile[i];
      f(
        'paving',
        [at(a, p.floor, inner), at(b, p.floor, inner), at(b, h, p.outer), at(a, y, p.outer)],
        up,
      );
    }
  }
}
function runStairs(f, bar, d) {
  const count = [2, 8, 18, 27, 27][d];
  for (const S of layout.stairs) {
    const l = S.z - S.width / 2,
      r = S.z + S.width / 2;
    for (let i = 0; i < count; i++) {
      const a = mix(S.start, S.end, i / count),
        b = mix(S.start, S.end, (i + 1) / count),
        hi = mix(S.upper, S.lower, i / count),
        lo = mix(S.upper, S.lower, (i + 1) / count);
      f(
        'paving',
        [
          [a, hi, l],
          [b, hi, l],
          [b, hi, r],
          [a, hi, r],
        ],
        up,
      );
      f(
        'pier',
        [
          [b, lo, l],
          [b, lo, r],
          [b, hi, r],
          [b, hi, l],
        ],
        east,
      );
      for (const [z, n] of [
        [l, north],
        [r, south],
      ])
        f(
          'pier',
          [
            [a, S.lower - 0.21, z],
            [b, S.lower - 0.21, z],
            [b, hi, z],
            [a, hi, z],
          ],
          n,
        );
      if (d >= 2)
        stripe(
          f,
          'trim',
          [b - 0.062, hi + 0.012, l + 0.03],
          [b - 0.062, hi + 0.012, r - 0.03],
          0.09,
        );
    }
    if (d >= 1)
      for (const z of [l + 0.16, r - 0.16]) {
        bar('green', [S.start, S.upper + 0.97, z], [S.end, S.lower + 0.97, z], 0.084, 0.091);
        const posts = d >= 2 ? 7 : 4;
        for (let i = 0; i < posts; i++) {
          const t = i / (posts - 1),
            x = mix(S.start, S.end, t),
            y = mix(S.upper, S.lower, t);
          box(f, 'iron', x, z, 0.084, 0.084, y, y + 1.02);
        }
      }
  }
  if (d >= 1) {
    const E = edge([-90.64, -61.44], [-90.64, 56.28], east),
      intervals = layout.stairs.map((s) => [
        s.z - s.width * 0.5 + 61.44,
        s.z + s.width * 0.5 + 61.44,
      ]);
    let start = 0;
    for (const [a, b] of [...intervals, [E.l, E.l]]) {
      face(f, d >= 2 ? 'clear' : 'green', E, start, a, layout.upper + 0.12, layout.upper + 0.97);
      bar('green', E.p(start, layout.upper + 1.03), E.p(a, layout.upper + 1.03), 0.082, 0.105);
      if (d >= 2)
        for (let j = start + 0.22; j < a; j += 2.35)
          box(f, 'green', E.a[0], E.a[1] + j, 0.086, 0.085, layout.upper, layout.upper + 1.03);
      start = b;
    }
  }
}
function archHeight(S, v) {
  const u = Math.max(0, Math.min(1, (v - S.z0) / (S.z1 - S.z0)));
  return S.eave + (S.peak - S.eave) * Math.sin(Math.PI * u);
}
function shedRoof(f, bar, S, d, transverse = false) {
  const { x0, x1, z0, z1, eave, entrance = false } = S;
  const to = (x, y, z) => (transverse ? [z, y, x] : [x, y, z]);
  const slices = [6, 8, 12, 20, 24][d];
  const curve = Array.from({ length: slices + 1 }, (_, i) => mix(z0, z1, i / slices));
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1],
      b = curve[i],
      y = archHeight(S, a),
      h = archHeight(S, b),
      t = (i - 0.5) / slices;
    const glass = entrance || (t > 0.22 && t < 0.78);
    const roof = glass ? (d >= 2 ? 'clear' : 'lightGlass') : transverse ? 'zinc' : 'slate';
    const p = [to(x0, y, a), to(x1, y, a), to(x1, h, b), to(x0, h, b)];
    f(roof, p, up);
    if (d >= 1 && !glass)
      f(
        'under',
        p.map(([x, y, z]) => [x, y - 0.18, z]),
        down,
      );
  }
  const rings = transverse ? [2, 2, 4, 8, 10][d] : [2, 3, 5, 12, 15][d];
  for (let i = 0; i < rings; i++) {
    const x = mix(x0 + 0.32, x1 - 0.34, i / (rings - 1)),
      rim = i === rings - 1 && !transverse;
    if (d === 0 && i > 0 && !rim) continue;
    for (let j = 1; j < curve.length; j++) {
      const a = curve[j - 1],
        b = curve[j],
        ya = archHeight(S, a) - 0.28,
        yb = archHeight(S, b) - 0.28;
      const ra = to(x, ya, a),
        rb = to(x, yb, b);
      if (d >= 1 || entrance)
        bar(
          entrance ? 'white' : rim ? 'pale' : 'green',
          ra,
          rb,
          rim ? 0.31 : 0.198,
          rim ? 0.55 : 0.24,
        );
      if (!entrance && d >= 2 && j % 2 === 1) {
        const lowA = to(x, ya - 0.86, a),
          lowB = to(x, yb - 0.86, b);
        bar('iron', lowA, lowB, 0.13, 0.14);
        bar('iron', lowA, rb, 0.078, 0.104);
        if (d >= 3) bar('red', ra, lowA, 0.084, 0.105);
      }
    }
    if (d >= 1 && !transverse) {
      const z = z0 + 0.31,
        base = railAt(x) + 0.71;
      box(f, 'pale', x, z, 0.48, 0.49, base, eave - 1.92);
      box(f, 'red', x, z, 0.7, 0.68, eave - 1.92, eave - 1.65);
      box(f, 'green', x, z, 0.91, 0.75, eave - 1.65, eave - 0.27);
      if (d >= 2) {
        for (const m of [-0.89, 0.89])
          bar('green', [x, eave - 1.66, z], [x + m, eave - 0.31, z], 0.103, 0.145);
        bar('green', [x, eave - 1.66, z], [x, eave + 1.19, z + 2.08], 0.15, 0.19);
        if (d >= 3) box(f, 'trim', x, z, 0.64, 0.64, base, base + 0.3);
      }
    }
  }
  if (d >= 2) {
    for (const z of curve.filter((_, i) => i % 2 === 0)) {
      const y = archHeight(S, z) - 0.21;
      bar(entrance ? 'white' : 'green', to(x0, y, z), to(x1, y, z), 0.098, 0.116);
    }
    const glazingFrames = transverse ? 17 : d === 3 ? 33 : 44;
    if (d >= 3 && !entrance)
      for (let i = 0; i < glazingFrames; i++) {
        const x = mix(x0 + 0.47, x1 - 0.45, i / (glazingFrames - 1));
        for (let j = 1; j < curve.length; j++) {
          if (j % 2 === 0) continue;
          const a = curve[j - 1],
            b = curve[j];
          bar(
            'iron',
            to(x, archHeight(S, a) - 0.099, a),
            to(x, archHeight(S, b) - 0.099, b),
            0.037,
            0.047,
          );
        }
      }
  }
  if (!transverse) {
    const x = x1,
      n = east;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1],
        b = curve[i],
        y = archHeight(S, a),
        h = archHeight(S, b),
        w = d >= 2 ? 0.71 : 0.53;
      f(
        'pale',
        [
          [x, y - w, a],
          [x, h - w, b],
          [x, h, b],
          [x, y, a],
        ],
        n,
      );
      if (d >= 3)
        box(
          f,
          'pale',
          x - 0.037,
          (a + b) / 2,
          0.105,
          0.12,
          (y + h) * 0.5 - w - 0.22,
          (y + h) * 0.5 - w + 0.02,
        );
    }
  }
}
function trainHall(f, bar, d) {
  for (const S of layout.sheds) shedRoof(f, bar, S, d);
  const C = layout.concourse;
  shedRoof(f, bar, { x0: C.z0, x1: C.z1, z0: C.x0, z1: C.x1, eave: C.eave, peak: C.peak }, d, true);
  const first = layout.sheds[0],
    last = layout.sheds.at(-1);
  const E = edge([first.x0, first.z0], [first.x1, first.z0], north);
  const wallY = 7.72,
    n = d === 0 ? 4 : d === 1 ? 11 : 20;
  for (let i = 0; i < n; i++) {
    const a = (E.l * i) / n,
      b = (E.l * (i + 1)) / n,
      w = (b - a) * 0.19;
    face(f, 'pier', E, a, a + w, -5.15, wallY);
    face(f, 'wall', E, a + w, b, -5.15, 0.67);
    arched(
      f,
      E,
      a + w,
      b,
      0.67,
      wallY - 2.47,
      1.72,
      wallY,
      d,
      false,
      'pale',
      d >= 2 ? 'clear' : 'lightGlass',
    );
  }
  if (d >= 1) {
    band(f, 'pale', E, 0, E.l, wallY - 0.16, 0.28, 0.22);
    const L = edge([last.x0, last.z1], [last.x1, last.z1], south);
    band(f, 'iron', L, 0, L.l, last.eave - 0.23, 0.22, 0.29);
    for (const x of [last.x0 + 1, -47.8, -24.4, 2.9, 29.2, 55.6, 80.9, 109.7])
      box(f, 'pale', x, last.z1, 0.46, 0.42, railAt(x) + 0.71, last.eave - 0.3);
  }
}
function gateline(f, E, p, y, d) {
  const along = (v) =>
    p.axis === 'z'
      ? (v - E.a[0]) * Math.sign(E.b[0] - E.a[0])
      : (v - E.a[1]) * Math.sign(E.b[1] - E.a[1]);
  const a = along(p.mid) - p.width / 2,
    b = along(p.mid) + p.width / 2,
    lo = layout.upper;
  if (a < 0 || b > E.l) return bays(f, E, 0, E.l, lo, y, d);
  bays(f, E, 0, a, lo, y, d);
  bays(f, E, b, E.l, lo, y, d);
  arched(f, E, a, b, lo, lo + 3.14, 1.48, y, d, true, 'pale');
}
function headhouse(f, d) {
  const p = layout.portals[2],
    lo = layout.upper;
  for (const P of layout.head)
    for (const E of edges(simple(P.outline, d >= 2 ? 0.21 : 0.48))) {
      const [x, z] = E.a,
        [u, v] = E.b;
      if (Math.abs(x - layout.concourse.x1) < 0.4 && Math.abs(u - layout.concourse.x1) < 0.4)
        continue;
      if (Math.min(z, v) > 55.9 && Math.max(x, u) < -88.8) continue;
      if (Math.max(z, v) < -61.8) continue;
      if (Math.abs(x - p.edge) < 1 && Math.abs(u - p.edge) < 1) {
        gateline(f, E, p, 9.84, d);
        continue;
      }
      bays(f, E, 0, E.l, lo, 9.84, d);
    }
  const b = layout.portals[0],
    E = edge([-122.79, b.edge], [-91.7, b.edge], north),
    mid = b.mid - E.a[0];
  const a = mid - b.width / 2,
    c = mid + b.width / 2;
  for (const [p, q] of [
    [0, a],
    [c, E.l],
  ])
    face(f, 'wall', E, p, q, lo, 10.74);
  face(f, 'iron', E, a, c, 7.33, 8.01, 0.039);
  face(f, d >= 2 ? 'clear' : 'lightGlass', E, a, c, 8.01, 12.78, 0.015);
  const T = [E.p(a, 7.52), E.p(c, 7.52), E.p(c + 0.92, 6.52, 1.84), E.p(a - 0.92, 6.52, 1.84)];
  f('zinc', T, up);
  if (d >= 1) {
    for (let i = 0; i <= 6; i++) {
      const k = mix(a, c, i / 6);
      face(f, 'green', E, k - 0.078, k + 0.078, 7.88, 12.8, 0.071);
    }
    for (const k of [a - 0.17, c + 0.17]) face(f, 'pale', E, k - 0.27, k + 0.27, lo, 10.66, 0.24);
  }
  const base = [
    [-128, -62.58],
    [-109.6, -62.58],
    [-109.6, -43.7],
    [-128, -43.7],
  ];
  f(
    'slate',
    base.map((p) => at(p, 9.83)),
    up,
  );
  for (const P of layout.outlines[layout.liverpoolRoof]) cap(f, 'slate', P, 9.88);
  for (const id of layout.liverpoolTurrets)
    for (const P of layout.outlines[id]) {
      shell(f, P, 'slate', 15.48, 9.67, d);
      if (d >= 2)
        for (const E of edges(P.outline))
          if (E.l > 2.2) {
            face(f, 'glass', E, E.l * 0.22, E.l * 0.78, 11.29, 14.41, 0.035);
            band(f, 'trim', E, E.l * 0.19, E.l * 0.81, 11.12, 0.15, 0.22);
            band(f, 'pale', E, 0, E.l, 14.94, 0.22, 0.18);
          }
    }
  if (d >= 2) {
    for (const z of [-48.1, -13.6, 20.2, 45.5]) {
      box(f, 'wall', -104.8, z, 2.9, 2.44, lo, 7.57);
      face(
        f,
        'glass',
        edge([-103.32, z - 1.16], [-103.32, z + 1.16], east),
        0.18,
        2.17,
        lo + 0.63,
        7.16,
        0.016,
      );
    }
  }
}
function bishopsgate(f, bar, d) {
  const P = layout.portals[1],
    lo = P.floor,
    front = P.edge,
    left = -110.03,
    right = -88.98;
  const E = edge([left, front], [right, front], south);
  gateline(f, E, P, 13.57, d);
  const c = E.l / 2;
  f('wall', [E.p(0, 13.55), E.p(E.l, 13.55), E.p(c, 19.03)], south);
  for (const [a, b] of [
    [
      [left, front],
      [left, 44.75],
    ],
    [
      [right, 44.75],
      [right, front],
    ],
  ]) {
    const W = edge(a, b, a[0] === left ? west : east);
    bays(f, W, 0, W.l, lo, 13.56, d);
  }
  const a = [left, 13.56, front],
    b = [right, 13.56, front],
    g = [(left + right) / 2, 19.03, front],
    a2 = [left, 13.56, 44.75],
    b2 = [right, 13.56, 44.75],
    g2 = [g[0], 19.03, 44.75];
  f('slate', [a, g, g2, a2], up);
  f('slate', [g, b, b2, g2], up);
  if (d >= 1) {
    for (let i = -2; i <= 2; i++) {
      const x = c + i * 2.04,
        hi = 15.94 - Math.abs(i) * 0.63;
      face(f, 'lightGlass', E, x - 0.58, x + 0.58, 12.01, hi, 0.065);
      f('lightGlass', arch(E, x - 0.58, x + 0.58, hi, 0.62, d >= 2 ? 8 : 4, 0.067), E.n);
    }
  }
  for (const [x, clock] of [
    [-108.38, false],
    [-90.74, true],
  ]) {
    const z = front - 2.11,
      w = 4.33,
      h = clock ? 24.06 : 22.59;
    box(f, 'wall', x, z, w, w, lo, h);
    box(f, 'trim', x, z, w + 0.36, w + 0.36, h - 0.44, h - 0.17);
    const top = h + 5.66,
      lower = rect(x, z, w + 0.18, w + 0.18).outline,
      upper = rect(x, z, 1.63, 1.63).outline;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f('slate', [at(lower[i], h), at(lower[j], h), at(upper[j], top), at(upper[i], top)], up);
    }
    cap(f, 'slate', { outline: upper }, top);
    box(f, 'trim', x, z, 1.69, 1.69, top, top + 0.98);
    box(f, 'slate', x, z, 1.89, 1.89, top + 0.98, top + 1.27);
    box(f, 'iron', x, z, 0.13, 0.13, top + 1.27, top + 2.51);
    const T = edge([x - w / 2, z + w / 2], [x + w / 2, z + w / 2], south);
    if (clock) clockFace(f, bar, T, T.l / 2, h - 4.18, 1.12, d);
    else if (d >= 1) {
      const center = T.l / 2;
      for (const u of [-0.65, 0, 0.65])
        face(f, 'trim', T, center + u - 0.13, center + u + 0.13, h - 5.02, h - 3.77, 0.09);
      band(f, 'pale', T, center - 1.0, center + 1.0, h - 4.34, 0.24, 0.2);
    }
    if (d >= 1)
      for (const y of [lo + 4.91, lo + 9.43, h - 6.41]) band(f, 'trim', T, 0, T.l, y, 0.17, 0.17);
  }
  for (const A of layout.outlines[layout.canopy]) {
    const xs = A.outline.map((p) => p[0]),
      zs = A.outline.map((p) => p[1]),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      arch = { x0: z0, x1: z1, z0: x0, z1: x1, eave: 6.2, peak: 10.13, entrance: true };
    shedRoof(f, bar, arch, d, true);
    const count = d === 0 ? 2 : d === 1 ? 3 : 7;
    for (const x of [x0 + 0.27, x1 - 0.26])
      for (let i = 0; i < count; i++)
        box(f, 'white', x, mix(z0 + 0.26, z1 - 0.29, i / (count - 1)), 0.2, 0.23, lo, arch.eave);
  }
}
function platforms(f, bar, d) {
  for (const p of layout.platforms)
    for (const P of p.parts) {
      const outline = d === 0 ? simple(P.outline, 0.41) : P.outline;
      cap(f, 'deck', { ...P, outline }, (x) => railAt(x) + 0.71);
      for (const E of edges(outline)) {
        const [x, z] = E.a,
          [u, v] = E.b,
          y = railAt(x),
          h = railAt(u);
        f(
          'pier',
          [
            [x, y, z],
            [u, h, v],
            [u, h + 0.71, v],
            [x, y + 0.71, z],
          ],
          E.n,
        );
        if (d >= 1 && E.l > 8)
          stripe(
            f,
            'tactile',
            [x - E.n[0] * 0.21, y + 0.725, z - E.n[2] * 0.21],
            [u - E.n[0] * 0.21, h + 0.725, v - E.n[2] * 0.21],
            0.112,
          );
      }
      if (d >= 2 && p.z < 38) {
        for (const x of [-42, 12, 66]) {
          const y = railAt(x) + 0.72,
            z = p.z;
          box(f, 'iron', x, z, 0.085, 0.085, y, y + 3.33);
          box(f, 'green', x, z, 1.49, 0.145, y + 2.63, y + 3.21);
        }
      }
    }
  if (d >= 1) for (const r of layout.rails) tracks(f, r.path, d);
  const E = edge([-79.51, 38.6], [110.75, 38.6], south);
  if (d >= 1) band(f, 'iron', E, 0, E.l, 4.88, 0.3, 0.27);
  if (d >= 2) {
    for (const z of [42.5, 57.8, 73.7])
      for (const x of [-62.9, -8.7, 48.3, 99.2]) {
        const y = railAt(x) + 0.71;
        box(f, 'pale', x, z, 0.36, 0.36, y, 4.98);
        bar('iron', [x, 4.95, z - 3.56], [x, 4.95, z + 3.61], 0.25, 0.32);
      }
  }
  for (const id of layout.shafts)
    for (const P of layout.outlines[id]) {
      const x = P.outline.reduce((s, p) => s + p[0] / P.outline.length, 0),
        y = x < -89 ? layout.upper : railAt(x) + 0.71;
      if (d >= 2) shell(f, P, 'zinc', y + 2.19, y, d);
    }
}
export function buildLiverpoolLevel(out, level) {
  const d = tier[level],
    f = writer(out),
    bar = (role, a, b, w, h) => beam(out, role, a, b, w, h, colors[role]);
  stationFloors(f, d);
  runStairs(f, bar, d);
  trainHall(f, bar, d);
  headhouse(f, d);
  bishopsgate(f, bar, d);
  platforms(f, bar, d);
}

export const buildLiverpoolSkyline = (out) => buildLiverpoolLevel(out, 'skyline');
export const buildLiverpoolDistrict = (out) => buildLiverpoolLevel(out, 'district');
export const buildLiverpoolStreet = (out) => buildLiverpoolLevel(out, 'street');
export const buildLiverpoolCloseup = (out) => buildLiverpoolLevel(out, 'closeup');
