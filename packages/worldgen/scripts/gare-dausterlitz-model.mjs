import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u09/gare_dausterlitz/layout.json',
      import.meta.url,
    ),
  ),
);
const wall = { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 };
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
  wall: [0.758, 0.714, 0.62],
  pier: [0.66, 0.617, 0.538],
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
  green: [0.318, 0.492, 0.521],
  red: [0.376, 0.223, 0.178],
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
const floorAt = (x) => grade(layout.floorProfile, x);
const railAt = (x, z = 28) =>
  grade(layout.railProfile, x) +
  Math.max(0, Math.min(1, (x - 155) / 42.7)) *
    (grade(layout.railRelief, z) - layout.railProfile.at(-1)[1]);
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
function enclosure(f, P, y, lo, roofRole, d) {
  const outline = d < 2 ? simple(P.outline, d === 0 ? 0.78 : 0.32) : P.outline;
  cap(f, roofRole, { ...P, outline }, y);
  for (const E of edges(outline)) face(f, 'wall', E, 0, E.l, lo, y);
}
function portalFacade(f, E, lo, hi, d, portal, metro) {
  const along = (point) =>
    ((point[0] - E.a[0]) * (E.b[0] - E.a[0]) + (point[1] - E.a[1]) * (E.b[1] - E.a[1])) / E.l;
  const openings = [];
  if (metro) {
    const interval = layout.metroOpening
      .map((x) => along([x, mix(E.a[1], E.b[1], (x - E.a[0]) / (E.b[0] - E.a[0]))]))
      .sort((a, b) => a - b);
    const a = Math.max(0, interval[0]),
      b = Math.min(E.l, interval[1]);
    if (b - a > 0.05) openings.push({ a, b, metro: true });
  }
  if (portal) {
    const mid = along(portal.axis === 'z' ? [portal.mid, portal.edge] : [portal.edge, portal.mid]),
      a = mid - portal.width / 2,
      b = mid + portal.width / 2;
    if (a >= 0.1 && b <= E.l - 0.1) openings.push({ a, b, metro: false });
  }
  let prior = 0;
  for (const { a, b, metro } of openings.sort((a, b) => a.a - b.a)) {
    bays(f, E, prior, a, lo, hi, d);
    face(f, 'pier', E, a, b, -8, lo);
    if (metro) {
      face(f, 'wall', E, a, b, lo, 5.54);
      face(f, 'wall', E, a, b, 12.34, hi);
    } else arched(f, E, a, b, lo, lo + 5.12, 2.05, hi, d, true, 'pale');
    prior = b;
  }
  bays(f, E, prior, E.l, lo, hi, d);
}
function plinth(f, d) {
  for (const P of layout.floors) {
    const track = P.outline.every((p) => p[0] >= 114.68);
    cap(
      f,
      track ? 'bed' : 'floor',
      d === 0 ? { ...P, outline: simple(P.outline, 0.5) } : P,
      track ? railAt : floorAt,
    );
  }
  for (const P of layout.outlines[layout.base])
    for (const E of edges(d === 0 ? simple(P.outline, 0.72) : P.outline)) {
      const [x, z] = E.a,
        [u, v] = E.b;
      const height = (x, z) => (x >= 114.68 ? railAt(x, z) : floorAt(x));
      f(
        'pier',
        [
          [x, -8, z],
          [u, -8, v],
          [u, height(u, v), v],
          [x, height(x, z), z],
        ],
        E.n,
      );
    }
  for (const p of layout.portals) {
    const at = (x, y, z) => (p.axis === 'z' ? [x, y, z] : [z, y, x]),
      inner = p.edge + p.inward * 0.48;
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
function wings(f, d) {
  for (const [name, parts] of Object.entries(layout.wings)) {
    const northSide = name === 'seine',
      y = northSide ? 10.42 : 8.63;
    for (const P of layout.wingRoofs[name])
      cap(f, 'slate', d === 0 ? { ...P, outline: simple(P.outline, 0.85) } : P, y);
    for (const P of parts)
      for (const E of edges(simple(P.outline, d >= 2 ? 0.64 : 1.02))) {
        const [x, z] = E.a,
          [u, v] = E.b,
          mid = (x + u) / 2,
          lo = floorAt(mid),
          inner = northSide ? 1.65 : 53.65;
        if (Math.abs(z - inner) < 0.15 && Math.abs(v - inner) < 0.15) continue;
        if (northSide && mid > -13.5 && mid < 26.4 && z < -39.6 && v < -39.6) continue;
        const portal = layout.portals.find(
          (p) =>
            p.axis === 'z' &&
            Math.abs(z - p.edge) < 1.5 &&
            Math.abs(v - p.edge) < 1.5 &&
            p.mid >= Math.min(x, u) &&
            p.mid <= Math.max(x, u),
        );
        portalFacade(f, E, lo, y, d, portal, Math.abs(E.n[2]) > 0.7);
      }
  }
  for (const P of layout.outlines[layout.eastWing]) enclosure(f, P, 5.4, -6.8, 'zinc', d);
  const H = layout.hall,
    E = edge([H.x0, H.z0], [H.x0, H.z1], west),
    p = layout.portals[1];
  portalFacade(f, E, -3.32, 10.57, d, p, false);
  for (const P of layout.outlines[layout.canopy]) {
    cap(f, 'zinc', P, 1.24);
    cap(f, 'under', P, 1.04, down);
    const outline = P.outline;
    for (const E of edges(outline)) face(f, 'iron', E, 0, E.l, 1.04, 1.24);
    if (d >= 1)
      for (let x = 32; x < 87; x += d >= 2 ? 7.3 : 14.7)
        box(f, 'green', x, -42.42, 0.24, 0.24, -3.17, 1.06);
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
function clockPavilion(f, bar, d) {
  const x0 = -13.1,
    x1 = 26.1,
    z0 = -42.38,
    z1 = -28.52,
    y = 10.46,
    top = 17.84,
    c = (x0 + x1) / 2;
  const E = edge([x0, z0], [x1, z0], north);
  bays(f, E, 0, E.l, -3.13, y, d, true);
  for (const [a, b, n] of [
    [[x0, z1], [x0, z0], west],
    [[x1, z0], [x1, z1], east],
  ])
    bays(f, edge(a, b, n), 0, z1 - z0, -3.13, y, d);
  band(f, 'pale', E, 0, E.l, y - 0.36, 0.47, 0.5);
  const lower = [
    [x0 - 0.19, z0 - 0.14],
    [x1 + 0.19, z0 - 0.14],
    [x1 + 0.19, z1],
    [x0 - 0.19, z1],
  ];
  const upper = [
    [x0 + 4.35, z0 + 3.85],
    [x1 - 4.35, z0 + 3.85],
    [x1 - 4.35, z1 - 3.3],
    [x0 + 4.35, z1 - 3.3],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f('slate', [at(lower[i], y), at(lower[j], y), at(upper[j], top), at(upper[i], top)], up);
  }
  f(
    'slate',
    upper.map((p) => at(p, top)),
    up,
  );
  const A = edge([c - 3.12, z0 - 0.35], [c + 3.12, z0 - 0.35], north);
  face(f, 'trim', A, 0, A.l, 10.5, 16.89);
  face(f, 'pale', A, 0.66, A.l - 0.66, 11.29, 16.69, 0.13);
  f(
    'pale',
    [A.p(-0.3, 16.61, 0.21), A.p(A.l + 0.3, 16.61, 0.21), A.p(A.l / 2, 19.03, 0.23)],
    north,
  );
  const back = -38.16;
  for (const [x, n] of [
    [c - 3.12, west],
    [c + 3.12, east],
  ])
    face(f, 'trim', edge([x, z0 - 0.35], [x, back], n), 0, back - z0 + 0.35, 10.52, 16.89);
  f('slate', [A.p(0, 16.89), A.p(A.l / 2, 19.03), [c, 19.03, back], [c - 3.12, 16.89, back]], up);
  f('slate', [A.p(A.l / 2, 19.03), A.p(A.l, 16.89), [c + 3.12, 16.89, back], [c, 19.03, back]], up);
  clockFace(f, bar, A, A.l / 2, 14.77, 1.37, d);
  if (d >= 1) {
    for (const k of [c - 3.45, c + 3.45, x0 + 1.57, x1 - 1.57]) {
      box(f, 'trim', k, z0 + 0.16, 0.74, 0.78, 10.41, 11.14);
      bar('pale', [k, 11.08, z0 + 0.14], [k - 0.19, 12.01, z0 + 0.32], 0.38, 0.36);
    }
    for (const x of [x0 + 6.5, x0 + 10.9, x1 - 10.9, x1 - 6.5]) {
      const D = edge([x - 0.36, z0 + 2.55], [x + 0.36, z0 + 2.55], north);
      f('trim', [D.p(0, 15.8), D.p(0.72, 15.8), D.p(0.36, 16.59)], north);
      face(f, 'dark', D, 0.16, 0.56, 15.77, 16.15, 0.022);
    }
  }
}
function roofAt(H, z) {
  return H.eave + (H.ridge - H.eave) * (1 - Math.abs((2 * (z - H.z0)) / (H.z1 - H.z0) - 1));
}
function hallRoof(f, bar, H, d, historic) {
  const { x0, x1, z0, z1, eave, ridge } = H,
    mid = (z0 + z1) / 2,
    span = z1 - z0;
  const bands = historic
    ? [0, 0.126, 0.313, 0.407, 0.5, 0.593, 0.687, 0.874, 1]
    : [0, 0.4, 0.5, 0.6, 1];
  for (let i = 1; i < bands.length; i++) {
    const a = z0 + span * bands[i - 1],
      b = z0 + span * bands[i],
      y = roofAt(H, a),
      h = roofAt(H, b);
    const glazed = historic ? [1, 4, 5, 8].includes(i) : [2, 3].includes(i);
    const role = glazed ? (d >= 2 ? 'clear' : 'lightGlass') : historic ? 'slate' : 'zinc';
    const points = [
      [x0, y, a],
      [x1, y, a],
      [x1, h, b],
      [x0, h, b],
    ];
    f(role, points, up);
    if (d >= 1 && !glazed)
      f(
        'under',
        points.map(([x, y, z]) => [x, y - 0.25, z]),
        down,
      );
  }
  const count = historic ? [3, 5, 11, 16, 18][d] : [2, 4, 7, 9, 11][d];
  for (let i = 0; i < count; i++) {
    const x = mix(x0 + 0.35, x1 - 0.44, i / (count - 1)),
      low = eave - 0.47,
      top = ridge - 0.38;
    if (d >= 1 || i === 0) {
      bar('iron', [x, low, z0], [x, top, mid], 0.26, 0.31);
      bar('iron', [x, top, mid], [x, low, z1], 0.26, 0.31);
    }
    if (d >= 1) {
      const tie = historic ? eave - 0.29 : eave - 0.13;
      bar('iron', [x, tie, z0], [x, tie, z1], 0.23, 0.3);
      const overMetro = historic && x > layout.metroOpening[0] && x < layout.metroOpening[1];
      if (!overMetro)
        for (const z of [z0 + 0.23, z1 - 0.23])
          box(f, 'iron', x, z, 0.43, 0.47, historic ? floorAt(x) : railAt(x, z) + 0.65, low);
      if (d >= 2) {
        const cells = historic ? (d >= 3 ? 14 : 10) : 8;
        for (let j = 1; j < cells; j++) {
          const a = mix(z0, z1, j / cells),
            b = mix(z0, z1, (j + 1) / cells),
            y = roofAt(H, a) - 0.55,
            h = roofAt(H, b) - 0.53;
          bar('iron', [x, tie, a], [x, h, b], 0.12, 0.125);
          if (j % 2 === 0 || d >= 3) bar('iron', [x, tie, a], [x, y, a], 0.13, 0.14);
        }
      }
    }
  }
  if (d >= 2) {
    const rows = historic ? (d >= 3 ? 22 : 13) : 9;
    for (let i = 1; i < rows; i++) {
      const z = mix(z0, z1, i / rows),
        y = roofAt(H, z) - 0.33;
      bar('iron', [x0, y, z], [x1, y, z], 0.12, 0.15);
    }
    if (d >= 3)
      for (let i = 0; i < 65; i++) {
        const x = mix(x0 + 0.49, x1 - 0.51, i / 64);
        for (let j = 1; j < bands.length; j++) {
          const a = z0 + span * bands[j - 1],
            b = z0 + span * bands[j];
          if (historic ? [1, 4, 5, 8].includes(j) : [2, 3].includes(j))
            bar('iron', [x, roofAt(H, a) - 0.16, a], [x, roofAt(H, b) - 0.16, b], 0.056, 0.058);
        }
      }
  }
}
function historicHall(f, bar, d) {
  const H = layout.hall,
    { x0, x1, z0, z1, eave, ridge } = H;
  hallRoof(f, bar, H, d, true);
  for (const [x, n, arrival] of [
    [x0, west, false],
    [x1, east, true],
  ]) {
    const E = edge([x, z0], [x, z1], n),
      mid = E.l / 2;
    const pane = d >= 2 ? 'clear' : 'lightGlass';
    f(pane, [E.p(0, eave), E.p(E.l, eave), E.p(mid, ridge)], n);
    if (arrival || d >= 1) face(f, pane, E, 0, E.l, arrival ? 3.6 : 10.53, eave);
    if (d >= 1) {
      band(f, 'green', E, 0, E.l, eave - 0.19, 0.34, 0.16);
      const count = d >= 3 ? 26 : d === 2 ? 18 : 8;
      for (let i = 1; i < count; i++) {
        const a = (E.l * i) / count,
          z = z0 + a,
          y = roofAt(H, z),
          lo = arrival ? 3.6 : 10.55;
        bar('green', E.p(a, lo, 0.075), E.p(a, y, 0.075), 0.127, 0.17);
      }
      if (d >= 2)
        for (const y of [6.3, 8.95, eave + 2.7, eave + 5.36, eave + 8.01]) {
          if (!arrival && y < 10.6) continue;
          const half = Math.min(mid, (mid * (ridge - y)) / (ridge - eave));
          bar('green', E.p(mid - half, y, 0.079), E.p(mid + half, y, 0.079), 0.125, 0.165);
        }
    }
  }
  for (const [z, n] of [
    [z0, south],
    [z1, north],
  ]) {
    const E = edge([x0, z], [x1, z], n);
    if (d === 0) continue;
    const count = d === 1 ? 10 : 19;
    const breaks = [
      ...Array.from({ length: count + 1 }, (_, i) => x0 + (i * E.l) / count).filter(
        (x) => x < layout.metroOpening[0] || x > layout.metroOpening[1],
      ),
      ...layout.metroOpening,
    ].sort((a, b) => a - b);
    for (let i = 1; i < breaks.length; i++) {
      const a = breaks[i - 1] - x0,
        b = breaks[i] - x0,
        mid = (a + b) / 2,
        x = x0 + mid,
        y = floorAt(x);
      const metro = layout.metroOpening[0] < x && x < layout.metroOpening[1];
      const nearGate = z === z0 ? x > 45 && x < 65 : x > 14 && x < 33;
      if (metro) {
        face(f, 'wall', E, a, b, y, 5.51);
        continue;
      }
      if (b - a < 1.7) {
        face(f, 'wall', E, a, b, nearGate ? y + 5.3 : y, eave);
        continue;
      }
      face(f, 'pier', E, a, a + 0.65, y, eave);
      if (!nearGate) face(f, 'wall', E, a + 0.65, b, y, y + 4.3);
      face(f, 'wall', E, a + 0.65, b, y + 5.3, y + 6.7);
      arched(
        f,
        E,
        a + 1.08,
        b - 0.48,
        y + 6.7,
        eave - 3.6,
        2.23,
        eave,
        d,
        false,
        'trim',
        d >= 2 ? 'clear' : 'lightGlass',
      );
      face(f, 'wall', E, a + 0.65, a + 1.08, y + 6.7, eave);
      face(f, 'wall', E, b - 0.48, b, y + 6.7, eave);
    }
  }
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
function tracks(f, path, vertical, d, axis) {
  const gradeBreaks =
    axis === 0 ? layout.railProfile.map((p) => p[0]) : layout.metro.rows.map((p) => p.z);
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
function metro(f, bar, d) {
  const M = layout.metro,
    rows = M.rows;
  const meta = (z) =>
    grade(
      rows.map((r) => [r.z, r.y]),
      z,
    );
  const station = (z) => z >= -33.8 && z <= 53.65;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      u = M.width / 2;
    const P = (r, s, h) => [r.center + s, r.y + h, r.z];
    const band = (role, p, q, y, n = up) =>
      f(role, [P(a, p, y), P(b, p, y), P(b, q, y), P(a, q, y)], n);
    band('bed', -u, u, 0);
    band('under', -u, u, -1.22, down);
    for (const side of [-1, 1]) {
      f(
        'green',
        [P(a, side * u, -1.22), P(b, side * u, -1.22), P(b, side * u, 0), P(a, side * u, 0)],
        side < 0 ? west : east,
      );
      if (station((a.z + b.z) / 2)) {
        band('deck', side * (u - 3.57), side * u, 0.86);
        f(
          'iron',
          [
            P(a, side * (u - 3.57), 0),
            P(b, side * (u - 3.57), 0),
            P(b, side * (u - 3.57), 0.86),
            P(a, side * (u - 3.57), 0.86),
          ],
          side < 0 ? east : west,
        );
        if (d >= 1) band('tactile', side * (u - 3.49), side * (u - 3.32), 0.879);
      }
      if (d >= 1) {
        bar('green', P(a, side * u, 1.15), P(b, side * u, 1.15), 0.14, 0.17);
        bar('iron', P(a, side * u, -1.23), P(b, side * u, -1.23), 0.22, 0.25);
      }
    }
  }
  for (const z of [-39.4, -15.7, 17.5, 43.5, 59.6]) {
    const x = grade(
        rows.map((r) => [r.z, r.center]),
        z,
      ),
      y = meta(z);
    for (const s of [-1, 1])
      box(f, 'green', x + s * 6.63, z, 0.58, 0.68, floorAt(x) - 0.14, y - 1.12);
    if (d >= 1) bar('iron', [x - 7.25, y - 1.26, z], [x + 7.25, y - 1.26, z], 0.49, 0.38);
  }
  if (d >= 1) for (const p of M.paths) tracks(f, p, (_, z) => meta(z), d, 1);
  if (d >= 2) {
    for (let z = -37; z < 60; z += d >= 3 ? 3.5 : 6) {
      const x = grade(
          rows.map((r) => [r.z, r.center]),
          z,
        ),
        y = meta(z);
      for (const s of [-1, 1]) {
        bar('green', [x + s * 7.88, y - 1.11, z], [x + s * 7.88, y - 0.17, z + 2.2], 0.102, 0.13);
        box(f, 'iron', x + s * 7.86, z, 0.09, 0.1, y + 0.1, y + 1.18);
      }
    }
  }
}
function platforms(f, bar, d) {
  hallRoof(f, bar, layout.shed, d, false);
  for (const { parts } of layout.platforms)
    for (const P of parts) {
      const outline = d === 0 ? simple(P.outline, 0.62) : P.outline;
      cap(f, 'deck', { ...P, outline }, (x, z) => railAt(x, z) + 0.7);
      for (const E of edges(outline)) {
        const [x, z] = E.a,
          [u, v] = E.b,
          y = railAt(x, z),
          h = railAt(u, v);
        f(
          'pier',
          [
            [x, y, z],
            [u, h, v],
            [u, h + 0.7, v],
            [x, y + 0.7, z],
          ],
          E.n,
        );
        if (d >= 1 && E.l > 7)
          stripe(
            f,
            'tactile',
            [x - E.n[0] * 0.22, y + 0.721, z - E.n[2] * 0.22],
            [u - E.n[0] * 0.22, h + 0.721, v - E.n[2] * 0.22],
            0.126,
          );
      }
    }
  for (const { path } of layout.rails) if (d >= 1) tracks(f, path, railAt, d, 0);
  if (d >= 2) {
    for (const id of layout.fixtures)
      for (const P of layout.outlines[id]) {
        const [x, z] = P.outline[0],
          base = x > 114.68 ? railAt(x, z) + 0.7 : floorAt(x);
        for (const E of edges(P.outline)) {
          face(f, 'green', E, 0, E.l, base, base + 0.42);
          face(f, 'iron', E, 0.03, 0.15, base + 0.42, base + 1.1);
          face(f, 'iron', E, 0.04, E.l - 0.04, base + 1.04, base + 1.14);
        }
      }
    for (const z of [1.2, 20.65, 40, 57.1]) {
      for (const x of [130, 161, 188]) {
        const y = railAt(x) + 0.71;
        box(f, 'iron', x, z, 0.1, 0.12, y, y + 3.6);
        box(f, 'green', x, z, 1.55, 0.13, y + 2.54, y + 3.16);
      }
    }
  }
}
export function buildAusterlitzLevel(out, level) {
  const d = tier[level],
    f = writer(out),
    bar = (role, a, b, w, h) => beam(out, role, a, b, w, h, colors[role]);
  plinth(f, d);
  wings(f, d);
  clockPavilion(f, bar, d);
  historicHall(f, bar, d);
  metro(f, bar, d);
  platforms(f, bar, d);
}

export const buildAusterlitzSkyline = (out) => buildAusterlitzLevel(out, 'skyline');
export const buildAusterlitzDistrict = (out) => buildAusterlitzLevel(out, 'district');
export const buildAusterlitzStreet = (out) => buildAusterlitzLevel(out, 'street');
export const buildAusterlitzCloseup = (out) => buildAusterlitzLevel(out, 'closeup');
