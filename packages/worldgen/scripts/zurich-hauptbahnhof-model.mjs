import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import { lettering } from './stadium-lettering.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0q/zurich_hauptbahnhof/layout.json',
      import.meta.url,
    ),
  ),
);
const sandstone = { slot: 'wall', graph: 'stone_sandstone', roughness: 0.91 };
const limestone = { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.91 };
const granite = { slot: 'foundation', graph: 'stone_granite', roughness: 0.91 };
const steel = { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.16 };
const metal = { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.13 };
const glazing = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.38 };
export const surfaces = {
  wall: sandstone,
  pier: sandstone,
  inside: sandstone,
  trim: limestone,
  litTrim: limestone,
  soffit: limestone,
  floor: granite,
  plaza: granite,
  ballast: granite,
  slab: granite,
  tactile: granite,
  dark: steel,
  iron: steel,
  green: steel,
  red: steel,
  white: steel,
  rail: steel,
  roof: metal,
  zinc: metal,
  roofDark: metal,
  glass: glazing,
  glassLight: glazing,
};
const palette = {
  wall: [0.72, 0.665, 0.547],
  pier: [0.67, 0.626, 0.534],
  inside: [0.69, 0.653, 0.56],
  trim: [0.77, 0.737, 0.646],
  litTrim: [0.855, 0.807, 0.687],
  soffit: [0.49, 0.47, 0.41],
  floor: [0.365, 0.37, 0.359],
  plaza: [0.64, 0.63, 0.59],
  ballast: [0.435, 0.408, 0.365],
  slab: [0.53, 0.526, 0.49],
  tactile: [0.864, 0.852, 0.78],
  dark: [0.172, 0.198, 0.204],
  iron: [0.302, 0.332, 0.319],
  green: [0.28, 0.36, 0.328],
  red: [0.69, 0.11, 0.087],
  white: [0.95, 0.943, 0.898],
  rail: [0.35, 0.371, 0.379],
  roof: [0.438, 0.464, 0.459],
  zinc: [0.62, 0.67, 0.665],
  roofDark: [0.315, 0.338, 0.327],
  glass: [0.23, 0.32, 0.365],
  glassLight: [0.597, 0.73, 0.773],
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, v]) => [
    k,
    v.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))),
  ]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  east = [1, 0, 0],
  west = [-1, 0, 0],
  north = [0, 0, -1],
  south = [0, 0, 1];
const mix = (a, b, t) => a + (b - a) * t,
  at = ([x, z], y) => [x, y, z];
const lift = (y, x, z) => (typeof y === 'function' ? y(x, z) : y);
const box = (f, role, x, z, w, d, lo, hi) => prism(f, role, rect(x, z, w, d), lo, hi, false);
const detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';

function writer(out) {
  return (role, points, dir, tint = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((sum, v, j) => sum + v * dir[j], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        color[role].map((v) => Math.min(1, v * tint)),
      );
    }
  };
}
function cap(f, role, { outline, holes = [] }, y, dir = up) {
  const rings = [outline, ...holes],
    points = rings.flat(),
    starts = [];
  let offset = outline.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const indices = earcut(points.flat(), starts);
  for (let i = 0; i < indices.length; i += 3)
    f(
      role,
      indices.slice(i, i + 3).map((j) => at(points[j], lift(y, ...points[j]))),
      dir,
    );
}
function edge(a, b, normal) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return {
    a,
    b,
    length,
    n: normal,
    p: (u, y, d = 0) => [
      a[0] + (dx * u) / length + d * normal[0],
      y,
      a[1] + (dz * u) / length + d * normal[2],
    ],
  };
}
function perimeter(ring) {
  const ccw = Math.sign(
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
    return l > 0.026 ? [edge(a, b, [(ccw * dz) / l, 0, (-ccw * dx) / l])] : [];
  });
}
function simplify(ring, tolerance = 1.45) {
  const points = ring.slice();
  while (points.length > 3) {
    const costs = points.map(([x, z], i) => {
      const [a, b] = points[(i + points.length - 1) % points.length],
        [c, d] = points[(i + 1) % points.length];
      const dx = c - a,
        dz = d - b,
        l = dx * dx + dz * dz,
        t = l ? Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / l)) : 0;
      return Math.hypot(x - a - t * dx, z - b - t * dz);
    });
    const min = Math.min(...costs);
    if (min > tolerance) break;
    points.splice(costs.indexOf(min), 1);
  }
  return points;
}
function panel(f, role, E, a, b, lo, hi, d = 0, tint = 1) {
  if (b - a > 0.016 && hi - lo > 0.016)
    f(role, [E.p(a, lo, d), E.p(b, lo, d), E.p(b, hi, d), E.p(a, hi, d)], E.n, tint);
}
function band(f, role, E, a, b, y, thickness, depth) {
  panel(f, role, E, a, b, y, y + thickness, depth);
  f(role, [E.p(a, y, 0), E.p(b, y, 0), E.p(b, y, depth), E.p(a, y, depth)], down);
  f(
    role,
    [
      E.p(a, y + thickness, 0),
      E.p(b, y + thickness, 0),
      E.p(b, y + thickness, depth),
      E.p(a, y + thickness, depth),
    ],
    up,
  );
}
function profile(E, center, w, y, rise, steps, d = 0) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / steps);
    return E.p(center + w * 0.5 * Math.cos(a), y + rise * Math.sin(a), d);
  });
}
function archedBay(
  f,
  E,
  { center, width, base, shoulder, rise, top, open = false, steps, role = 'wall', trim = false },
) {
  const a = center - width / 2,
    b = center + width / 2;
  if (!open) {
    panel(f, 'glass', E, a, b, base, shoulder, -0.012);
    if (rise > 0) f('glass', profile(E, center, width, shoulder, rise, steps, -0.012), E.n);
  }
  if (rise <= 0) panel(f, role, E, a, b, shoulder, top);
  else {
    const arc = profile(E, center, width, shoulder, rise, steps);
    for (let i = 1; i < arc.length; i++) {
      const p = arc[i - 1],
        q = arc[i];
      f(role, [p, q, [q[0], top, q[2]], [p[0], top, p[2]]], E.n);
    }
    if (trim) {
      const inside = profile(E, center, width, shoulder, rise, steps, 0.14);
      const outside = profile(E, center, width + 0.66, shoulder, rise + 0.33, steps, 0.14);
      for (let i = 1; i < inside.length; i++)
        f('litTrim', [inside[i - 1], inside[i], outside[i], outside[i - 1]], E.n);
      panel(f, 'trim', E, a - 0.33, a, base, shoulder, 0.14);
      panel(f, 'trim', E, b, b + 0.33, base, shoulder, 0.14);
    }
  }
}
function solidFacade(f, E, lo, hi, d) {
  const { length } = E;
  panel(f, 'pier', E, 0, length, -6.2, lo);
  if (d === 0 || length < 3) {
    panel(f, 'wall', E, 0, length, lo, hi);
    if (length > 10) panel(f, 'trim', E, 0, length, hi - 0.39, hi, 0.11);
    return;
  }
  if (d === 1) {
    panel(f, 'wall', E, 0, length, lo, hi);
    const count = Math.max(1, Math.round(length / 6.05)),
      bay = length / count;
    for (let i = 0; i < count; i++) {
      const c = (i + 0.5) * bay,
        w = bay * 0.3;
      panel(f, 'glass', E, c - w, c + w, lo + 0.87, lo + 4.7, 0.027);
      panel(f, 'glass', E, c - w * 0.7, c + w * 0.7, lo + 7.8, hi - 1.55, 0.028);
    }
    panel(f, 'trim', E, 0, length, lo + 6.22, lo + 6.51, 0.15);
    panel(f, 'trim', E, 0, length, hi - 0.45, hi, 0.18);
    return;
  }
  const count = Math.max(1, Math.round(length / 6.05)),
    bay = length / count;
  const lowY = lo + 6.45,
    base = lo + 0.88,
    shoulder = lo + 3.62,
    rise = 1.45,
    steps = d >= 3 ? 8 : 4;
  panel(f, 'wall', E, 0, length, lo, base);
  panel(f, 'wall', E, 0, length, lowY, hi);
  for (let i = 0; i < count; i++) {
    const a = i * bay,
      b = a + bay,
      c = a + bay / 2,
      w = bay * 0.63;
    panel(f, 'wall', E, a, c - w / 2, base, lowY);
    panel(f, 'wall', E, c + w / 2, b, base, lowY);
    archedBay(f, E, { center: c, width: w, base, shoulder, rise, top: lowY, steps, trim: d >= 2 });
    panel(f, 'glass', E, c - w * 0.36, c + w * 0.36, lo + 7.8, hi - 1.55, 0.018);
    if (d >= 2) {
      band(f, 'trim', E, c - w * 0.41, c + w * 0.41, lo + 7.57, 0.19, 0.21);
      panel(f, 'trim', E, c - 0.09, c + 0.09, lo + 7.8, hi - 1.55, 0.051);
      panel(f, 'trim', E, a + 0.15, a + 0.53, lo, hi - 0.5, 0.18);
      if (d >= 3) panel(f, 'dark', E, c - 0.075, c + 0.075, base, shoulder, 0.026);
    }
  }
  for (const h of [lo + 6.21, hi - 0.63]) band(f, 'trim', E, 0, length, h, 0.22, 0.26);
}
function gateway(f, E, g, floor, top, d) {
  const center = E.length / 2,
    width = g.width,
    shoulder = g.shoulder,
    rise = g.rise;
  const left = center - width / 2,
    right = center + width / 2;
  const crown = shoulder + rise;
  const doorway = floor + 0.015;
  panel(f, 'pier', E, 0, E.length, -6.2, doorway);
  panel(f, 'wall', E, 0, left, doorway, top);
  panel(f, 'wall', E, right, E.length, doorway, top);
  archedBay(f, E, {
    center,
    width,
    base: doorway,
    shoulder,
    rise,
    top,
    open: true,
    steps: d >= 2 ? 12 : 5,
    trim: d >= 1,
  });
  if (d >= 1) {
    for (const side of [-1, 1]) {
      const pier = center + side * (width / 2 + 0.99);
      panel(f, 'pier', E, pier - 0.48, pier + 0.48, doorway, crown + 0.34, 0.35);
      band(f, 'litTrim', E, pier - 0.69, pier + 0.69, crown + 0.34, 0.24, 0.48);
      if (d >= 2) {
        panel(f, 'trim', E, pier - 0.31, pier + 0.31, doorway + 0.38, crown + 0.33, 0.44);
        const u = center + side * (width / 2 + 3.37);
        if (u > 1.1 && u < E.length - 1.1)
          panel(f, 'glass', E, u - 0.89, u + 0.89, doorway + 0.5, doorway + 3.29, 0.028);
      }
    }
  }
}
function clock(f, E, x, y, r, d) {
  const sides = d >= 3 ? 24 : d >= 1 ? 14 : 8;
  const ring = Array.from({ length: sides }, (_, i) => {
    const a = (i * 2 * Math.PI) / sides;
    return [Math.cos(a), Math.sin(a)];
  });
  const disc = (role, scale, depth) =>
    f(
      role,
      ring.map(([a, b]) => E.p(x + a * r * scale, y + b * r * scale, depth)),
      E.n,
    );
  disc('litTrim', 1.22, 0.32);
  disc('dark', 1.02, 0.38);
  disc('white', 0.9, 0.41);
  const stick = (role, a, b, width) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy),
      ux = ((-dy / l) * width) / 2,
      uy = ((dx / l) * width) / 2;
    f(
      role,
      [
        [a[0] + ux, a[1] + uy],
        [a[0] - ux, a[1] - uy],
        [b[0] - ux, b[1] - uy],
        [b[0] + ux, b[1] + uy],
      ].map(([u, v]) => E.p(x + u, y + v, 0.435)),
      E.n,
    );
  };
  stick('dark', [0, 0], [r * 0.42, r * 0.22], 0.105 * r);
  stick('dark', [0, 0], [-r * 0.24, r * 0.67], 0.075 * r);
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        c = Math.cos(a),
        s = Math.sin(a);
      stick('dark', [c * r * 0.65, s * r * 0.65], [c * r * 0.79, s * r * 0.79], r * 0.049);
    }
}
function roofProfile(z, H) {
  const t = (z - H.z0) / (H.z1 - H.z0);
  return H.spring + (H.peak - H.spring) * Math.max(0, 1 - (2 * t - 1) * (2 * t - 1));
}
function wing(f, id, d) {
  const southWing = id === layout.southId,
    { entrance: G, floor } = layout;
  const y = 15.23,
    insideZ = southWing ? 48.79 : 6.59;
  for (const source of layout.outlines[id]) {
    const outline = d <= 1 ? simplify(source.outline, d === 0 ? 1.45 : 0.24) : source.outline;
    const roof = { ...source, outline };
    cap(f, 'roofDark', roof, y);
    for (const E of perimeter(outline)) {
      const [x, z] = E.a,
        [u, v] = E.b,
        mid = (x + u) / 2;
      if (Math.abs(z - insideZ) < 0.17 && Math.abs(v - insideZ) < 0.17) continue;
      if (southWing && mid >= 16.11 && mid <= 39.84 && z > 89.3 && v > 89.3) continue;
      if (
        !southWing &&
        z < -31.65 &&
        v < -31.65 &&
        Math.min(x, u) < G.north.center &&
        Math.max(x, u) > G.north.center
      ) {
        const t = ((G.north.center - x) / (u - x)) * E.length;
        const a = Math.max(0, t - 2.3),
          b = Math.min(E.length, t + 2.3);
        const point = (t) => {
          const [x, , z] = E.p(t, floor);
          return [x, z];
        };
        if (a > 0.12) solidFacade(f, edge(E.a, point(a), E.n), floor, y, d);
        if (E.length - b > 0.12) solidFacade(f, edge(point(b), E.b, E.n), floor, y, d);
        gateway(f, edge(point(a), point(b), E.n), G.north, floor, y, d);
        continue;
      }
      solidFacade(f, E, floor, y, d);
      if (d >= 1 && E.length > 8 && Math.abs(E.n[2]) > 0.8) {
        const a = E.length * 0.21,
          b = E.length * 0.79,
          m = E.length / 2;
        f('roof', [E.p(a, y), E.p(b, y), E.p(m, y + 1.25)], E.n);
        if (d >= 2) {
          f('trim', [E.p(a, y, 0.2), E.p(b, y, 0.2), E.p(m, y + 1.19, 0.2)], E.n);
          f(
            'roof',
            [E.p(a, y, 0.2), E.p(m, y + 1.22, 0.2), E.p(m, y + 1.22, -3.4), E.p(a, y, -3.4)],
            up,
          );
          f(
            'roof',
            [E.p(m, y + 1.22, 0.2), E.p(b, y, 0.2), E.p(b, y, -3.4), E.p(m, y + 1.22, -3.4)],
            up,
          );
        }
      }
    }
  }
}
function bahnhofplatz(f, bar, d) {
  const g = layout.entrance.south,
    c = g.center,
    width = 23.58,
    y = 15.23,
    z = g.front;
  const E = edge([c - width / 2, z], [c + width / 2, z], south),
    cx = width / 2;
  gateway(f, E, g, layout.floor, y, d);
  const wingDepth = 4.35;
  for (const [x, n] of [
    [c - width / 2, west],
    [c + width / 2, east],
  ]) {
    const A = edge([x, z - wingDepth], [x, z], n);
    panel(f, 'wall', A, 0, wingDepth, layout.floor, y);
    if (d >= 1) band(f, 'trim', A, 0, wingDepth, y - 0.49, 0.35, 0.22);
  }
  f('roof', [E.p(0, y), E.p(width, y), E.p(width, y, -wingDepth), E.p(0, y, -wingDepth)], up);
  band(f, 'trim', E, 0, width, y - 0.35, 0.49, 0.53);
  const a = 2.8,
    b = width - a;
  panel(f, 'wall', E, a, b, y + 0.14, 19.54, -0.06);
  band(f, 'litTrim', E, a - 0.45, b + 0.45, 19.52, 0.36, 0.31);
  f('roofDark', [E.p(a, 19.87), E.p(b, 19.87), E.p(b, 19.87, -3.6), E.p(a, 19.87, -3.6)], up);
  for (const [u, n] of [
    [a, west],
    [b, east],
  ])
    panel(f, 'pier', edge([E.p(u, 0)[0], z - 3.6], [E.p(u, 0)[0], z], n), 0, 3.6, y, 19.87);
  panel(
    f,
    'pier',
    edge([E.p(a, 0)[0], z - 3.6], [E.p(b, 0)[0], z - 3.6], north),
    0,
    b - a,
    y,
    19.87,
  );
  clock(f, E, cx, 17.49, 1.03, d);
  if (d >= 1) {
    for (const dx of [-7.05, -3.65, 3.65, 7.05]) {
      panel(f, 'trim', E, cx + dx - 0.32, cx + dx + 0.32, 16.2, 18.61, 0.19);
      band(f, 'litTrim', E, cx + dx - 0.53, cx + dx + 0.53, 18.58, 0.2, 0.24);
    }
    for (const x of [c - 8.27, c - 4.12, c, c + 4.12, c + 8.27]) {
      const h = x === c ? 2.3 : 1.5;
      box(f, 'trim', x, z - 0.84, 0.73, 0.74, 19.86, 20.31);
      prism(
        f,
        'trim',
        {
          outline: [
            [x - 0.36, z - 0.97],
            [x + 0.36, z - 0.97],
            [x + 0.24, z - 0.48],
            [x - 0.24, z - 0.48],
          ],
        },
        20.31,
        20.31 + h * 0.53,
        false,
      );
      bar('trim', [x, 20.31 + h * 0.45, z - 0.69], [x - 0.27, 20.31 + h, z - 0.71], 0.39, 0.38);
      if (d >= 2) {
        bar('trim', [x - 0.18, 20.74, z - 0.67], [x - 0.64, 21.02, z - 0.53], 0.19, 0.18);
        bar('trim', [x + 0.17, 20.74, z - 0.67], [x + 0.49, 21.1, z - 0.55], 0.19, 0.18);
      }
    }
  }
}
function mainHall(f, bar, d) {
  const H = layout.mainHall,
    { x0, x1, z0, z1, spring } = H,
    floor = layout.floor;
  const steps = [4, 7, 11, 16, 20][d];
  const roof = Array.from({ length: steps + 1 }, (_, i) => {
    const z = mix(z0, z1, i / steps);
    return [z, roofProfile(z, H)];
  });
  for (let i = 1; i < roof.length; i++) {
    const [a, y] = roof[i - 1],
      [b, v] = roof[i],
      material = i === Math.floor(steps / 2) ? 'zinc' : 'roof';
    const points = [
      [x0, y, a],
      [x1, y, a],
      [x1, v, b],
      [x0, v, b],
    ];
    f(material, points, up);
    f(
      'roofDark',
      points.map(([x, y, z]) => [x, y - 0.23, z]),
      down,
    );
  }
  const northE = edge([x0, z0], [x1, z0], south),
    southE = edge([x0, z1], [x1, z1], north);
  for (const E of [northE, southE]) {
    const outward = edge(
      E.a,
      E.b,
      E.n.map((v) => -v),
    );
    panel(f, 'wall', outward, 0, E.length, 15.24, spring);
    if (d === 0) {
      panel(f, 'inside', E, 0, E.length, 8.2, spring);
      panel(f, 'glass', E, 3, E.length - 3, 11.15, 15.5, 0.04);
      continue;
    }
    const bays = d === 1 ? 7 : 9,
      bay = E.length / bays;
    for (let i = 0; i < bays; i++) {
      const a = i * bay,
        b = a + bay,
        c = a + bay / 2,
        w = bay * 0.74,
        lo = floor + 0.04,
        pass = c >= 60 || Math.abs(x0 + c - 27.63) < w / 2;
      for (const [u, v] of [
        [a, c - w / 2],
        [c + w / 2, b],
      ])
        panel(f, 'inside', E, u, v, lo, spring);
      archedBay(f, E, {
        center: c,
        width: w,
        base: lo,
        shoulder: lo + 4.15,
        rise: 1.4,
        top: 7.9,
        open: pass,
        steps: d >= 2 ? 7 : 4,
        trim: d >= 2,
        role: 'inside',
      });
      panel(f, 'inside', E, c - w / 2, c + w / 2, 7.9, 9.25);
      archedBay(f, E, {
        center: c,
        width: w,
        base: 9.25,
        shoulder: 13.08,
        rise: 3.04,
        top: spring,
        steps: d >= 2 ? 8 : 4,
        trim: d >= 2,
        role: 'inside',
      });
      if (d >= 2) {
        panel(f, 'trim', E, c - 0.068, c + 0.068, 9.25, 16.06, 0.054);
        panel(f, 'trim', E, c - w / 2, c + w / 2, 12.15, 12.24, 0.058);
        band(f, 'trim', E, a, b, 8.57, 0.27, 0.21);
        panel(f, 'trim', E, a + 0.18, a + 0.51, lo, spring, 0.34);
      }
    }
  }
  for (const [x, n, open] of [
    [x0, west, true],
    [x1, east, false],
  ]) {
    const E = edge([x, z0], [x, z1], n),
      L = E.length;
    const g = (role, points, normal, tint) => {
      f(role, points, normal, tint);
      if (d >= 2)
        f(
          role,
          points.map(([px, y, z]) => [px - n[0] * 0.09, y, z]),
          normal.map((v) => -v),
          tint,
        );
    };
    for (let i = 1; i < roof.length; i++) {
      const [a, y] = roof[i - 1],
        [b, v] = roof[i];
      g(
        'inside',
        [
          [x, spring, a],
          [x, spring, b],
          [x, v, b],
          [x, y, a],
        ],
        n,
      );
    }
    for (let i = 0; i < 3; i++) {
      const a = (L * i) / 3,
        b = (L * (i + 1)) / 3,
        c = (a + b) / 2,
        w = (b - a) * 0.82;
      panel(g, 'trim', E, a, c - w / 2, open ? floor : 5.75, spring);
      panel(g, 'trim', E, c + w / 2, b, open ? floor : 5.75, spring);
      archedBay(g, E, {
        center: c,
        width: w,
        base: open ? 9.3 : 8.65,
        shoulder: 13.08,
        rise: 3.25,
        top: spring,
        steps: d >= 2 ? 12 : 5,
        trim: d >= 1,
        role: 'inside',
      });
      if (open)
        archedBay(g, E, {
          center: c,
          width: w,
          base: floor + 0.02,
          shoulder: 6.55,
          rise: 1.74,
          top: 9.3,
          steps: d >= 2 ? 9 : 5,
          open,
          trim: d >= 2,
          role: 'inside',
        });
      else panel(g, 'wall', E, c - w / 2, c + w / 2, 5.75, 8.65);
      if (d >= 1)
        for (const u of [c - w * 0.24, c, c + w * 0.24])
          panel(g, 'iron', E, u - 0.05, u + 0.05, 9, 15.05, 0.046);
    }
    if (d >= 1) band(f, 'trim', E, 0, L, 16.8, 0.24, 0.27);
  }
  const frames = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 6 : 13;
  for (let i = 0; i < frames; i++) {
    const x = mix(x0 + 0.64, x1 - 0.79, i / (frames - 1)),
      chord = 15.51;
    bar('iron', [x, chord, z0], [x, chord, z1], d >= 2 ? 0.24 : 0.31, 0.29);
    for (let j = 1; j < roof.length; j++) {
      const [zA, yA] = roof[j - 1],
        [zB, yB] = roof[j];
      if (d >= 1) bar('iron', [x, yA - 0.47, zA], [x, yB - 0.47, zB], 0.25, 0.36);
      if (d >= 2) {
        bar('iron', [x, chord, zA], [x, yB - 0.54, zB], 0.12, 0.15);
        if (j % 2 === 0) bar('iron', [x, chord, zA], [x, yA - 0.49, zA], 0.13, 0.13);
        if (i > 0 && j % 3 === 1) {
          const prev = mix(x0 + 0.64, x1 - 0.79, (i - 1) / (frames - 1));
          bar('iron', [prev, yA - 0.57, zA], [x, yA - 0.57, zA], 0.13, 0.13);
          if (d >= 3) bar('iron', [prev, yA - 0.56, zA], [x, yB - 0.57, zB], 0.09, 0.09);
        }
      }
    }
    if (d >= 1)
      for (const z of [z0 + 0.18, z1 - 0.18]) {
        bar('iron', [x, 8.84, z], [x, 18.12, z], 0.22, 0.23);
        bar('iron', [x, 9.1, z], [x, 15.3, z === z0 + 0.18 ? z + 3 : z - 3], 0.16, 0.23);
      }
  }
  if (d >= 2) {
    for (const z of [21.13, 21.4, 21.67, 32.6, 32.87, 33.14]) {
      f(
        'tactile',
        [
          [x0 + 0.5, floor + 0.014, z],
          [x1 - 1.2, floor + 0.014, z],
          [x1 - 1.2, floor + 0.014, z + 0.075],
          [x0 + 0.5, floor + 0.014, z + 0.075],
        ],
        up,
      );
    }
    box(f, 'iron', -8.6, 15.4, 1.75, 1.75, floor, 8.1);
    box(f, 'iron', -8.6, 15.4, 3.48, 3.48, 6.45, 9.04);
    for (const side of [north, east, south, west]) {
      const shift = 1.75;
      const E = side[0]
        ? edge([-8.6 + side[0] * shift, 15.4 - shift], [-8.6 + side[0] * shift, 15.4 + shift], side)
        : edge(
            [-8.6 - shift, 15.4 + side[2] * shift],
            [-8.6 + shift, 15.4 + side[2] * shift],
            side,
          );
      clock(f, E, E.length / 2, 7.76, 1.13, d);
    }
  }
}
function eastEntrance(f, d) {
  const G = layout.entrance.east,
    E = edge([G.front, -3.5], [G.front, 58.74], east),
    lo = layout.floor,
    hi = 5.8;
  const c = G.center + 3.5,
    span = 9.44;
  panel(f, 'pier', E, 0, E.length, -6.2, lo + 0.015);
  panel(f, 'wall', E, 0, E.length, 4.46, hi);
  for (let i = -3; i <= 3; i++) {
    const x = c + i * 8.08,
      a = Math.max(0, x - 3.59),
      b = Math.min(E.length, x + 3.59);
    if (i !== 0) panel(f, 'glass', E, a, b, lo + 0.1, 4.46, -0.076);
    const left = i === -3 ? 0 : Math.max(0, x - span / 2);
    panel(f, 'trim', E, left, a, lo, 4.46, 0.11);
    if (i === 3) panel(f, 'trim', E, b, E.length, lo, 4.46, 0.11);
  }
  for (const P of layout.outlines[layout.eastId]) cap(f, 'roof', P, hi);
  if (d >= 1) band(f, 'trim', E, 0, E.length, 5.48, 0.28, 0.34);
}
function railY(x, z) {
  const rows = layout.railGrade;
  const i = Math.min(
    rows.length - 1,
    Math.max(
      1,
      rows.findIndex((r) => r[0] >= x),
    ),
  );
  const a = rows[i - 1],
    b = rows[i],
    t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
  const j = z < 25 ? 1 : 2,
    v = Math.max(0, Math.min(1, z < 25 ? (z + 37) / 62 : (z - 25) / 73));
  return mix(mix(a[j], a[j + 1], v), mix(b[j], b[j + 1], v), t);
}
function slab(f, role, outline, y, wallRole, bottom, d) {
  const p = d === 0 ? { outline: simplify(outline.outline), holes: outline.holes } : outline;
  cap(f, role, p, y);
  if (wallRole)
    for (const E of perimeter(p.outline)) {
      const [x, z] = E.a,
        [u, v] = E.b,
        lo = lift(bottom, x, z),
        hi = lift(bottom, u, v);
      f(
        wallRole,
        [
          [x, lo, z],
          [u, hi, v],
          [u, lift(y, u, v), v],
          [x, lift(y, x, z), z],
        ],
        E.n,
      );
    }
}
function ribbon(f, role, a, b, width) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l = Math.hypot(dx, dz);
  if (l < 0.02) return;
  const x = (dz * width) / 2 / l,
    z = (-dx * width) / 2 / l;
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
function trainSheds(f, bar, d) {
  const sheds = layout.sheds,
    bed = layout.railSlabs;
  for (const P of bed) slab(f, 'ballast', P, railY, null, null, d);
  for (const P of layout.outlines[layout.canopyId])
    for (const E of perimeter(d === 0 ? simplify(P.outline) : P.outline)) {
      const [x, z] = E.a,
        [u, v] = E.b;
      f(
        'pier',
        [
          [x, -6.5, z],
          [u, -6.5, v],
          [u, railY(u, v), v],
          [x, railY(x, z), z],
        ],
        E.n,
      );
    }
  for (const S of sheds) {
    const roofY = (x, z) => railY(x, S.z) + 6.85 - 0.087 * Math.abs(z - S.z);
    if (d >= 2)
      for (const P of S.roofPanels) {
        cap(f, 'zinc', P, roofY);
        cap(f, 'roofDark', P, (x, z) => roofY(x, z) - 0.29, down);
      }
    for (const P of S.parts) {
      const simple = d <= 1 ? { ...P, outline: simplify(P.outline, d === 0 ? 1.45 : 0.31) } : P;
      if (d <= 1) {
        slab(f, 'zinc', simple, roofY, d === 0 ? null : 'iron', (x, z) => roofY(x, z) - 0.29, d);
        if (d === 1) cap(f, 'roofDark', simple, (x, z) => roofY(x, z) - 0.29, down);
      }
    }
    const columns = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 7 : 16;
    const p = layout.platforms.find((p) => p.z === S.z);
    const start = Math.max(-248, p.x0 + 9),
      end = -50;
    for (let i = 0; i < columns; i++) {
      const x = mix(start, end, columns === 1 ? 0.65 : i / (columns - 1)),
        z = S.z + 0.13,
        base = x >= -67 ? layout.floor : railY(x, z) + 0.65,
        y = roofY(x, z) - 0.29;
      box(f, 'iron', x, z, 0.32, 0.32, base, y);
      if (d >= 2) {
        for (const v of [Math.max(S.lo + 0.38, z - 5.2), Math.min(S.hi - 0.38, z + 5.2)])
          bar('iron', [x, y - 1.14, z], [x, roofY(x, v) - 0.34, v], 0.16, 0.19);
      }
    }
    if (d >= 2) {
      for (const z of [S.z - 0.84, S.z + 0.84]) {
        const xs = [
          start,
          ...layout.railGrade.map((row) => row[0]).filter((x) => x > start && x < end),
          end,
        ];
        for (let j = 1; j < xs.length; j++) {
          const a = xs[j - 1],
            b = xs[j];
          ribbon(f, 'glassLight', [a, roofY(a, z) + 0.033, z], [b, roofY(b, z) + 0.033, z], 0.38);
        }
      }
    }
  }
  for (const { x0, x1, z, width } of layout.platforms) {
    const xs = [Math.max(-292, x0), -260, -195, -130, x1].filter((x, i, a) => !i || x > a[i - 1]);
    const y = (x) => railY(x, z) + 0.66;
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i],
        l = z - width / 2,
        r = z + width / 2;
      f(
        'slab',
        [
          [a, y(a), l],
          [b, y(b), l],
          [b, y(b), r],
          [a, y(a), r],
        ],
        up,
      );
      if (d >= 1)
        for (const [v, n] of [
          [l, north],
          [r, south],
        ]) {
          f(
            'pier',
            [
              [a, railY(a, v), v],
              [b, railY(b, v), v],
              [b, y(b), v],
              [a, y(a), v],
            ],
            n,
          );
          if (d >= 2)
            ribbon(
              f,
              'tactile',
              [a, y(a) + 0.01, v + (z - v) * 0.067],
              [b, y(b) + 0.01, v + (z - v) * 0.067],
              0.12,
            );
        }
    }
  }
  const gradeBreaks = layout.railGrade.slice(1, -1).map(([x]) => x);
  if (d >= 1)
    for (const { path } of layout.rails)
      for (let i = 1; i < path.length; i++) {
        const [x, z] = path[i - 1],
          [u, v] = path[i];
        const splits = [
          0,
          ...gradeBreaks.map((point) => (point - x) / (u - x)),
          (25 - z) / (v - z),
          1,
        ]
          .filter((t) => t >= 0 && t <= 1)
          .sort((a, b) => a - b);
        const height = d === 1 ? 0.081 : 0.115;
        const railPoint = (t, offset) => {
          const a = mix(x, u, t);
          const b = mix(z, v, t) + offset;
          return [a, railY(a, b) + height, b];
        };
        for (let j = 1; j < splits.length; j++)
          for (const offset of d === 1 ? [0] : [-0.718, 0.718])
            ribbon(
              f,
              'rail',
              railPoint(splits[j - 1], offset),
              railPoint(splits[j], offset),
              d === 1 ? 1.24 : 0.076,
            );
        if (d >= 3) {
          const length = Math.hypot(u - x, v - z),
            count = Math.ceil(length / (d === 4 ? 1.1 : 2.55));
          for (let j = 0; j < count; j++) {
            const t = (j + 0.5) / count,
              xx = mix(x, u, t),
              zz = mix(z, v, t),
              y = railY(xx, zz) + 0.04;
            ribbon(f, 'slab', [xx, y, zz - 0.99], [xx, y, zz + 0.99], 0.18);
          }
        }
      }
}
function approach(f, d) {
  const floor = layout.floor;
  for (const P of layout.outlines[layout.baseId]) slab(f, 'floor', P, floor, 'pier', -6.4, d);
  for (const a of layout.aprons) {
    const point = (p, y, z) => (a.direction === 'east' ? [z, y, p] : [p, y, z]);
    for (let i = 1; i < a.profile.length; i++) {
      const [s, y] = a.profile[i - 1],
        [t, v] = a.profile[i];
      f(
        'plaza',
        [
          point(s, floor, a.inner),
          point(t, floor, a.inner),
          point(t, v, a.outer),
          point(s, y, a.outer),
        ],
        up,
      );
    }
  }
}
function fittings(out, f, bar, d) {
  if (d < 2) return;
  for (const id of layout.fixtures) {
    for (const P of layout.outlines[id]) {
      const [x, z] = P.outline.reduce(
        ([x, z], [u, v]) => [x + u / P.outline.length, z + v / P.outline.length],
        [0, 0],
      );
      const base = x >= -67 ? layout.floor : railY(x, z) + 0.66;
      if (id === 35185646891044 || id === 35185646891045) {
        for (const E of perimeter(P.outline)) {
          panel(f, 'iron', E, 0, E.length, base + 0.83, base + 0.96, 0.018);
          for (const [px, pz] of [E.a, E.b]) box(f, 'iron', px, pz, 0.09, 0.09, base, base + 0.96);
        }
      } else {
        prism(f, 'inside', P, base, base + (id === layout.kioskId ? 4.22 : 3.55), false);
        cap(f, 'zinc', P, base + (id === layout.kioskId ? 4.23 : 3.56));
        for (const E of perimeter(P.outline))
          if (E.length > 2.5)
            panel(f, 'glass', E, 0.36, E.length - 0.36, base + 0.95, base + 2.72, 0.02);
      }
    }
  }
  const x = -47.8,
    lo = layout.floor;
  for (const z of [-26, -8.65, 8.9, 25.9, 43.4, 61, 78.4]) {
    box(f, 'iron', x, z, 1.2, 0.18, lo + 3.3, lo + 4.24);
    box(f, 'iron', x, z, 0.09, 0.09, lo + 4.24, lo + 6.4);
  }
  const G = layout.entrance.south;
  const place = (points) => points.map(([x, y, z]) => [x + G.center, y, z]);
  const shifted = {
    addQuad: (s, r, p, n, uv, c) => out.addQuad(s, r, place(p), n, uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => out.addConvexPolygon(s, r, place(p), n, uv, c),
  };
  lettering(shifted, 'ZURICH HB', {
    width: 5.8,
    height: 0.62,
    y: 13.66,
    z: G.front + 0.066,
    slot: 'dark',
    stroke: 0.071,
    color: color.dark,
  });
  // The shared lettering helper omits Z and U. Complete the Zürich wordmark here.
  const advance = 5.8 / 'ZURICH HB'.length;
  const baseline = 13.66;
  const front = G.front + 0.066;
  const glyphs = [
    [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 1],
      [0, 0.25],
      [0.24, 0],
      [0.76, 0],
      [1, 0.25],
      [1, 1],
    ],
  ];
  const letterPoint = (letter, [u, v]) => [
    G.center + (letter - 4.5 + u * 0.75) * advance,
    baseline + v * 0.62,
    front,
  ];
  for (const [letter, glyph] of glyphs.entries()) {
    for (let i = 1; i < glyph.length; i++) {
      bar('dark', letterPoint(letter, glyph[i - 1]), letterPoint(letter, glyph[i]), 0.071, 0.071);
    }
  }
  const umlaut = edge([G.center - 5.8 / 2, front], [G.center + 5.8 / 2, front], south);
  for (const u of [0.23, 0.53]) {
    const x = (1 + u) * advance;
    panel(f, 'dark', umlaut, x - 0.035, x + 0.035, baseline + 0.705, baseline + 0.77);
  }
  for (const [x, z] of [
    [18.05, 12.1],
    [31.15, 12.1],
    [44.3, 12.1],
    [57.25, 12.1],
  ]) {
    box(f, 'iron', x, z, 0.06, 0.06, lo, lo + 2.77);
    bar('iron', [x - 0.35, lo + 2.65, z], [x + 0.35, lo + 2.65, z], 0.13, 0.14);
  }
}
export function buildZurichLevel(out, level) {
  const d = detail[level],
    f = writer(out);
  const bar = (role, a, b, w, h) => beam(out, role, a, b, w, h, color[role]);
  approach(f, d);
  wing(f, layout.northId, d);
  wing(f, layout.southId, d);
  bahnhofplatz(f, bar, d);
  eastEntrance(f, d);
  mainHall(f, bar, d);
  trainSheds(f, bar, d);
  fittings(out, f, bar, d);
}

export const buildZurichSkyline = (out) => buildZurichLevel(out, 'skyline');
export const buildZurichDistrict = (out) => buildZurichLevel(out, 'district');
export const buildZurichStreet = (out) => buildZurichLevel(out, 'street');
export const buildZurichCloseup = (out) => buildZurichLevel(out, 'closeup');
