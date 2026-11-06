/** Original Avaz exterior: straight core, two twisting glass lobes and open support gap. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

// structure-mesh.box uses minimum/maximum corners; this helper accepts center and dimensions.
function centerBox(o, slot, center, size, color) {
  if (size.some((v) => !(v > 0))) throw Error('Positive box dimensions required');
  boundsBox(
    o,
    slot,
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}

import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: lin('7298b6'),
    white: lin('e0dfd4'),
    metal: lin('b2bec2'),
    dark: lin('465663'),
    roof: lin('9da4a4'),
    ground: lin('aaa89f'),
    red: lin('a75c52'),
  };
export const avazSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.26, metallic: 0.17 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.57, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
};
export const avazControls = a;
export function avazGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const configs = {
  skyline: { far: true, arc: 5, rows: 2, bay: 20, mast: 2, sides: 4 },
  district: { arc: 7, rows: 9, bay: 7, mast: 4, sides: 6, bands: true },
  street: { arc: 10, rows: 21, bay: 3.6, mast: 7, sides: 8, bands: true, entry: true },
  closeup: {
    arc: 14,
    rows: 29,
    bay: 2.5,
    mast: 12,
    sides: 12,
    bands: true,
    entry: true,
    frames: true,
    plant: true,
  },
  master: {
    arc: 22,
    rows: 29,
    bay: 1.6,
    mast: 20,
    sides: 20,
    bands: true,
    entry: true,
    frames: true,
    plant: true,
    returns: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => (area(r) < 0 ? r : r.toReversed());
function tri(o, c, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((v, k, i) => v + k * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    color,
  );
}
function patch(o, c, s, p, color, n) {
  tri(o, c, s, p.slice(0, 3), color, n);
  tri(o, c, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, r, y, s = 'roof', color = C.roof, normal = [0, 1, 0]) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      s,
      ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      color,
      normal,
    );
}
function face(p, q) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
    t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  return { p, q, L, t, n: [-t[1], t[0]] };
}
const P = (f, u, y, d = 0) => [
  f.p[0] + f.t[0] * u + f.n[0] * d,
  y,
  f.p[1] + f.t[1] * u + f.n[1] * d,
];
export const avazEntryPoint = (u, y, d = 0) => P(face(a.entrance.p, a.entrance.q), u, y, d);
function panel(o, c, f, u0, u1, y0, y1, d, s, color) {
  if (u1 <= u0 || y1 <= y0) return;
  patch(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
function B(o, c, p, q, w = 0.1, color = C.metal, d = w) {
  if (Math.hypot(...p.map((v, i) => v - q[i])) > 0.001) beam(o, S(c, 'metal'), p, q, w, d, color);
}
function shell(o, c, r, y0, y1, s, color) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    panel(o, c, f, 0, f.L, y0, y1, 0, s, color);
  }
  cap(o, c, r, y1);
}
export function avazGlassRoofY(x) {
  return 135 - 7 * Math.max(0, Math.min(1, (-21.3 - x) / 23));
}
export function avazGlassRing(y, upper = false, segments = 22) {
  const b = upper ? a.upperGlass : a.lowerGlass,
    t = Math.max(0, Math.min(1, (y - b.base) / (b.top - b.base))),
    angle = b.angles[0] + t * (b.angles[1] - b.angles[0]),
    [x, z] = a.glassCenter,
    vertices = [
      [7, 14],
      [-12.5, 10],
      [-14, -7],
      [5.5, -14],
    ],
    N = Math.max(1, Math.round(segments / 4)),
    r = [
      [-21.3, -10],
      [-21.3, 10],
    ];
  for (let i = 0; i < vertices.length - 1; i++)
    for (let j = 0; j < N; j++) {
      const t = j / N,
        u = vertices[i][0] + t * (vertices[i + 1][0] - vertices[i][0]),
        v = vertices[i][1] + t * (vertices[i + 1][1] - vertices[i][1]);
      r.push([
        x + u * Math.cos(angle) - v * Math.sin(angle),
        z + u * Math.sin(angle) + v * Math.cos(angle),
      ]);
    }
  const [u, v] = vertices.at(-1);
  r.push([
    x + u * Math.cos(angle) - v * Math.sin(angle),
    z + u * Math.sin(angle) + v * Math.cos(angle),
  ]);
  return cw(r);
}
function glassCap(o, c, r, y, upper, reverse = false) {
  const b = upper ? a.upperGlass : a.lowerGlass,
    t = (y - b.base) / (b.top - b.base),
    ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      'roof',
      ids.slice(i, i + 3).map((k) => {
        const [x, z] = r[k];
        return [x, y - (upper ? t * (135 - avazGlassRoofY(x)) : 0), z];
      }),
      C.roof,
      [0, reverse ? -1 : 1, 0],
    );
}
function glassBody(o, c, upper) {
  const b = upper ? a.upperGlass : a.lowerGlass,
    rows = Math.max(1, Math.round(c.rows * (upper ? 0.38 : 1))),
    rings = Array.from({ length: rows + 1 }, (_, j) => {
      const y = b.base + (j * (b.top - b.base)) / rows;
      return { y, r: avazGlassRing(y, upper, c.arc) };
    });
  const reference = rings[0].r,
    perimeter = [0];
  for (let i = 0; i < reference.length; i++) {
    const p = reference[i],
      q = reference[(i + 1) % reference.length];
    perimeter.push(perimeter.at(-1) + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  for (let j = 0; j < rows; j++) {
    const { y: y0, r: p } = rings[j],
      { y: y1, r: q } = rings[j + 1];
    for (let i = 0; i < p.length; i++) {
      const k = (i + 1) % p.length,
        N = Math.max(1, Math.ceil(Math.hypot(p[k][0] - p[i][0], p[k][1] - p[i][1]) / c.bay)),
        at = (r, u, y) => {
          const x = r[i][0] + u * (r[k][0] - r[i][0]),
            z = r[i][1] + u * (r[k][1] - r[i][1]);
          return [
            x,
            y - (upper ? ((y - b.base) / (b.top - b.base)) * (135 - avazGlassRoofY(x)) : 0),
            z,
          ];
        };
      for (let h = 0; h < N; h++) {
        const u0 = h / N,
          u1 = (h + 1) / N,
          pts = [at(p, u0, y0), at(p, u1, y0), at(q, u1, y1), at(q, u0, y1)],
          normal = normalFor(...pts.slice(0, 3));
        if (c.far) patch(o, c, 'glass', pts, C.glass);
        else {
          // Explicit continuous paired-pane UVs avoid independently projected triangle seams.
          const U = (u) =>
              ((perimeter[i] + u * (perimeter[i + 1] - perimeter[i])) / perimeter.at(-1)) *
              Math.round(perimeter.at(-1) / 3.2),
            V = (p) => (p[1] - b.base) / (76 / 29);
          o.addQuad(
            'glass',
            'metric:uv',
            pts,
            normal,
            [
              [U(u0), V(pts[0])],
              [U(u1), V(pts[1])],
              [U(u1), V(pts[2])],
              [U(u0), V(pts[3])],
            ],
            C.glass,
          );
        }
        if (c.frames) {
          B(o, c, pts[0], pts[1], 0.095, C.metal);
          B(o, c, pts[0], pts[3], 0.085, C.metal);
        } else if (c.bands) {
          const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
          patch(
            o,
            c,
            'metal',
            [pts[0], pts[1], mix(pts[1], pts[2], 0.025), mix(pts[0], pts[3], 0.025)],
            C.metal,
          );
          patch(
            o,
            c,
            'metal',
            [pts[0], mix(pts[0], pts[1], 0.025), mix(pts[3], pts[2], 0.025), pts[3]],
            C.metal,
          );
        }
        if (c.returns) {
          const inset = pts.map((v) => v.map((s, i) => s + normal[i] * 0.065));
          for (let h = 0; h < 4; h++)
            patch(o, c, 'metal', [pts[h], pts[(h + 1) % 4], inset[(h + 1) % 4], inset[h]], C.dark);
          B(
            o,
            c,
            pts[0].map((v, i) => (v + pts[3][i]) / 2),
            pts[1].map((v, i) => (v + pts[2][i]) / 2),
            0.06,
            C.metal,
          );
        }
      }
    }
  }
  glassCap(o, c, rings[0].r, b.base, upper, true);
  glassCap(o, c, rings.at(-1).r, b.top, upper);
}
function core(o, c) {
  const k = a.core,
    r = [
      [k.x0, k.z0],
      [k.x0, k.z1],
      [k.x1, k.z1],
      [k.x1, k.z0],
    ],
    front = face([k.x1, k.z1], [k.x1, k.z0]);
  for (let i = 0; i < 4; i++) {
    const f = face(r[i], r[(i + 1) % 4]);
    if (i === 2 || (i === 3 && c.entry)) continue;
    panel(o, c, f, 0, f.L, k.base, k.top, 0, 'ground', C.white);
  }
  cap(o, c, r, k.top);
  const f = front,
    u0 = 10 - k.slotHalfWidth,
    u1 = 10 + k.slotHalfWidth;
  panel(o, c, f, 0, u0, k.base, 142, 0, 'ground', C.white);
  panel(o, c, f, u1, f.L, k.base, 142, 0, 'ground', C.white);
  panel(o, c, f, u0, u1, k.base, 27, 0, 'ground', C.white);
  panel(o, c, f, u0, u1, 136, 142, 0, 'ground', C.white);
  panel(o, c, f, u0, u1, 27, 136, -k.slotRecess, 'glass', C.dark);
  for (const u of [u0, u1])
    patch(
      o,
      c,
      'ground',
      [P(f, u, 27, 0), P(f, u, 136, 0), P(f, u, 136, -k.slotRecess), P(f, u, 27, -k.slotRecess)],
      C.white,
    );
  if (c.bands) {
    for (let y = 28; y < 136; y += c.frames ? 3.1 : 6.2)
      panel(o, c, f, u0, u1, y, y + 0.1, -k.slotRecess + 0.02, 'metal', C.dark);
    for (const u of [u0 + 0.13, u1 - 0.13])
      B(o, c, P(f, u, 27, -0.9), P(f, u, 136, -0.9), 0.13, C.metal);
  }
  // Small stair-window apertures are cut into the side return, not painted onto the slot.
  if (c.entry) {
    const f = face([k.x0, k.z0], [k.x1, k.z0]),
      N = c.frames ? 35 : 18,
      step = 108 / N;
    panel(o, c, f, 0, 0.65, 23, 142, 0, 'ground', C.white);
    panel(o, c, f, 1.5, f.L, 23, 142, 0, 'ground', C.white);
    let bottom = 23;
    for (let j = 0; j < N; j++) {
      const y = 27 + j * step;
      panel(o, c, f, 0.65, 1.5, bottom, y, 0, 'ground', C.white);
      panel(o, c, f, 0.65, 1.5, y, y + 1.05, -0.22, 'glass', C.dark);
      for (const u of [0.65, 1.5])
        patch(
          o,
          c,
          'ground',
          [P(f, u, y, 0), P(f, u, y + 1.05, 0), P(f, u, y + 1.05, -0.22), P(f, u, y, -0.22)],
          C.white,
        );
      bottom = y + 1.05;
    }
    panel(o, c, f, 0.65, 1.5, bottom, 142, 0, 'ground', C.white);
  }
}
function base(o, c, ring, top, garage) {
  const r = cw(ring);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      bottom = Math.min(-7, avazGroundY(...f.p) - 0.4, avazGroundY(...f.q) - 0.4);
    panel(o, c, f, 0, f.L, bottom, 0.5, 0, 'ground', C.ground);
    if (c.far) {
      panel(o, c, f, 0, f.L, 0.5, top, 0, 'ground', C.white);
      continue;
    }
    const parking = garage || Math.max(f.p[0], f.q[0]) > -15,
      entry = !garage && f.n[1] < -0.8 && f.L > 30;
    const emit = (u0, u1, y0, y1, d, slot, color) => {
      if (!entry || !c.entry) {
        panel(o, c, f, u0, u1, y0, y1, d, slot, color);
        return;
      }
      const pts = [avazEntryPoint(4.5, 0), avazEntryPoint(12.5, 0)],
        U = (p) => (p[0] - f.p[0]) * f.t[0] + (p[2] - f.p[1]) * f.t[1],
        h0 = Math.min(...pts.map(U)),
        h1 = Math.max(...pts.map(U));
      panel(o, c, f, u0, u1, y0, Math.min(y1, 0.6), d, slot, color);
      panel(o, c, f, u0, u1, Math.max(y0, 5.5), y1, d, slot, color);
      const lo = Math.max(y0, 0.6),
        hi = Math.min(y1, 5.5);
      panel(o, c, f, u0, Math.min(u1, h0), lo, hi, d, slot, color);
      panel(o, c, f, Math.max(u0, h1), u1, lo, hi, d, slot, color);
    };
    if (parking) {
      const N = Math.max(1, Math.floor(f.L / 5.5)),
        roof = top,
        levels = garage ? [3, 7.5, 12] : [3, 8, 13, 18];
      let y = 0.5;
      for (const h of levels) {
        emit(0, f.L, y, h, 0, 'ground', C.white);
        for (let n = 0; n < N; n++) {
          const u0 = (n * f.L) / N,
            u1 = ((n + 1) * f.L) / N,
            w = Math.min(0.5, (u1 - u0) * 0.2);
          emit(u0, u0 + w, h, h + 2.8, 0, 'ground', C.white);
          emit(u1 - w, u1, h, h + 2.8, 0, 'ground', C.white);
        }
        y = h + 2.8;
      }
      emit(0, f.L, y, roof, 0, 'ground', C.white);
      if (entry && c.entry) {
        /* The independent entry vestibule projects before the slotted garage face. */
      }
    } else {
      emit(0, f.L, 0.5, top, 0, 'ground', C.white);
      const N = Math.max(1, Math.ceil(f.L / 2.2));
      for (let n = 0; n < N; n++)
        emit(((n + 0.24) * f.L) / N, ((n + 0.72) * f.L) / N, 9, 22, 0.025, 'glass', C.dark);
    }
    if (c.frames) B(o, c, P(f, 0, top + 0.7), P(f, f.L, top + 0.7), 0.08, C.metal);
  }
  cap(o, c, r, top);
  if (!c.far) cap(o, c, r, top - 0.3, 'ground', C.white, [0, -1, 0]);
  for (const y of garage ? [2.6, 7.1, 11.6, 16.1] : [2.6, 7.6, 12.6, 17.6, 22.6]) {
    if (c.far) continue;
    cap(o, c, r, y, 'ground', C.white);
    cap(o, c, r, y - 0.25, 'ground', C.white, [0, -1, 0]);
  }
}
function crown(o, c) {
  const k = a.crown;
  // The curved dark neck continues behind the sloping glass roof and supports the pale cap.
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(125, 9.1, 9.1, c.sides * 2, k.center),
      radialRing(134, 9.1, 9.1, c.sides * 2, k.center),
    ],
    C.dark,
  );
  loft(
    o,
    S(c, 'ground'),
    [
      radialRing(k.base, k.radius, k.radius, c.sides * 2, k.center),
      radialRing(k.top, k.radius, k.radius, c.sides * 2, k.center),
    ],
    C.white,
  );
  if (c.bands)
    for (let i = 0; i < c.sides * 2; i++) {
      const t = (i * 2 * Math.PI) / (c.sides * 2),
        x = k.center[0] + Math.cos(t) * (k.radius + 0.025),
        z = k.center[1] + Math.sin(t) * (k.radius + 0.025);
      B(o, c, [x, 134, z], [x, 142, z], 0.045, C.metal);
    }
}
function supports(o, c) {
  for (const [x, z] of a.supports)
    loft(
      o,
      S(c, 'ground'),
      [radialRing(99, 0.43, 0.43, c.sides, [x, z]), radialRing(105, 0.43, 0.43, c.sides, [x, z])],
      C.white,
    );
}
function antenna(o, c) {
  const k = a.mast,
    [x, z] = k.center,
    N = c.mast;
  for (let j = 0; j < N; j++) {
    const y0 = 142 + (j * 16) / N,
      y1 = 142 + ((j + 1) * 16) / N,
      r0 = 0.9 - (j * 0.5) / N,
      r1 = 0.9 - ((j + 1) * 0.5) / N,
      p = radialRing(y0, r0, r0, 3, k.center),
      q = radialRing(y1, r1, r1, 3, k.center);
    for (let i = 0; i < 3; i++) {
      const n = (i + 1) % 3;
      B(o, c, p[i], q[i], 0.1);
      if (!c.far) {
        B(o, c, p[i], p[n], 0.065);
        B(o, c, p[i], q[n], 0.06);
      }
    }
  }
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(158, 0.48, 0.48, c.sides, k.center),
      radialRing(160, 0.35, 0.35, c.sides, k.center),
    ],
    C.red,
  );
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(160, 0.16, 0.16, c.sides, k.center),
      radialRing(172, 0.08, 0.08, c.sides, k.center),
    ],
    C.metal,
  );
  if (c.plant) {
    for (const z0 of [-5, 5])
      centerBox(o, S(c, 'metal'), [x, 142.6, z + z0], [2.2, 1.2, 1.3], C.dark);
  }
}
function entrance(o, c) {
  if (!c.entry) return;
  const e = a.entrance,
    f = face(e.p, e.q),
    u0 = e.centerU - e.halfWidth,
    u1 = e.centerU + e.halfWidth,
    bottom = Math.max(0.6, avazGroundY(...e.p) + 0.3, avazGroundY(...e.q) + 0.3);
  panel(o, c, f, u0, u1, bottom, e.doorTop, -e.recess, 'glass', C.glass);
  patch(
    o,
    c,
    'ground',
    [
      P(f, u0, e.doorTop, 0),
      P(f, u1, e.doorTop, 0),
      P(f, u1, e.doorTop, -e.recess),
      P(f, u0, e.doorTop, -e.recess),
    ],
    C.white,
    [0, -1, 0],
  );
  for (const u of [u0, u1])
    patch(
      o,
      c,
      'ground',
      [
        P(f, u, bottom, 0),
        P(f, u, e.doorTop, 0),
        P(f, u, e.doorTop, -e.recess),
        P(f, u, bottom, -e.recess),
      ],
      C.white,
    );
  patch(
    o,
    c,
    'ground',
    [
      P(f, u0, bottom, e.canopyDepth),
      P(f, u1, bottom, e.canopyDepth),
      P(f, u1, bottom, -e.recess),
      P(f, u0, bottom, -e.recess),
    ],
    C.ground,
    [0, 1, 0],
  );
  patch(
    o,
    c,
    'roof',
    [
      P(f, u0 - 0.5, e.canopyTop, 0),
      P(f, u1 + 0.5, e.canopyTop, 0),
      P(f, u1 + 0.5, e.canopyTop, e.canopyDepth),
      P(f, u0 - 0.5, e.canopyTop, e.canopyDepth),
    ],
    C.white,
    [0, 1, 0],
  );
  for (const u of [u0, u0 + 2, e.centerU, u1 - 2, u1])
    B(
      o,
      c,
      P(f, u, bottom, -e.recess + 0.06),
      P(f, u, e.doorTop, -e.recess + 0.06),
      0.075,
      C.metal,
    );
  for (const u of [u0 - 0.3, u1 + 0.3]) {
    const p = P(f, u, 0, e.canopyDepth - 0.25);
    B(o, c, [p[0], avazGroundY(p[0], p[2]) - 0.4, p[2]], [p[0], e.canopyTop, p[2]], 0.15, C.metal);
  }
}
function roofDeck(o, c) {
  if (!c.plant) return;
  for (let x = -5; x < 35; x += 3) {
    centerBox(o, S(c, 'metal'), [x, 23.02, -8], [0.08, 0.025, 4.2], C.white);
  }
  for (const [x, z, w, d, h] of [
    [10, -4, 10, 5, 3],
    [35, -8, 6, 5, 2.5],
  ]) {
    centerBox(o, S(c, 'metal'), [x, 23 + h / 2, z], [w, h, d], C.white);
    if (c.returns)
      for (let y = 23.5; y < 23 + h; y += 0.3)
        centerBox(o, S(c, 'metal'), [x, y, z + d / 2 + 0.025], [w, 0.05, 0.05], C.metal);
  }
  for (const x of [35.5, 37])
    loft(
      o,
      S(c, 'metal'),
      [
        radialRing(25.5, 0.35, 0.35, c.sides, [x, -8]),
        radialRing(31, 0.35, 0.35, c.sides, [x, -8]),
      ],
      C.metal,
    );
}
export function buildAvazLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error(`Unknown level ${level}`);
  base(o, c, a.podiumOutline, 23, false);
  base(o, c, a.garageOutline, 18, true);
  core(o, c);
  glassBody(o, c, false);
  glassBody(o, c, true);
  supports(o, c);
  crown(o, c);
  antenna(o, c);
  entrance(o, c);
  roofDeck(o, c);
}
export const buildAvazSkyline = (o) => buildAvazLevel(o, 'skyline');
export const buildAvazDistrict = (o) => buildAvazLevel(o, 'district');
export const buildAvazStreet = (o) => buildAvazLevel(o, 'street');
export const buildAvazCloseup = (o) => buildAvazLevel(o, 'closeup');
