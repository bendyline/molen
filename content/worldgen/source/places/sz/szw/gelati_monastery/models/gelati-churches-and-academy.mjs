import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import plan from '../gelati-plan.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  rubble: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.95 },
  detail: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  cupola: { slot: 'roof', graph: 'tile_glazed', roughness: 0.85 },
  shade: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'gelati-deep-openings',
    roughness: 0.89,
  },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.88 },
};
const white = rgb('c4b79c'),
  trim = rgb('c9bba0'),
  worn = rgb('a69a80'),
  brown = rgb('926c58');
const green = rgb('728376'),
  slate = rgb('777b76'),
  shade = rgb('514d43'),
  wood = rgb('695345');

function capped(out) {
  return {
    ...out,
    addCap(s, ref, r, holes, height, normal, uv, color) {
      const m = new MeshBufferBuilder();
      if (!m.addCap('wall', ref, r, holes, height, normal, uv, color)) return false;
      const { indices, positions } = m.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, s, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}
function frame({ center: [x, z], axis: [a, b] }) {
  const F = facade([x, z], [a, b]),
    p = (u, v) => [x + a * u - b * v, z + b * u + a * v];
  return { ...F, p, rect: (u, U, v, V) => [p(u, v), p(u, V), p(U, V), p(U, v)] };
}
const edges = (ring) => {
  const r = outwardRing(ring);
  return r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
};
function block(out, s, F, u, U, v, V, y, Y, c) {
  fbox(out, s, F, u, U, y, Y, v, V, c);
}
function roof(out, f, u, U, v, V, y, Y, slot, color, cross = false) {
  const a = cross ? f.p((u + U) * 0.5, v) : f.p(u, (v + V) * 0.5);
  const b = cross ? f.p((u + U) * 0.5, V) : f.p(U, (v + V) * 0.5);
  gableRoof(out, slot, a, b, cross ? U - u : V - v, y, Y, color, {
    overhang: 0.28,
    endSlot: 'ashlar',
    endColor: white,
  });
}
function stoneArch(out, F, u, y, w, h, level, isDoor = false) {
  if (!level) return;
  opening(out, F, u, y, w, h, {
    head: 'round',
    glassSlot: isDoor ? 'wood' : 'shade',
    frameSlot: 'detail',
    glass: isDoor ? wood : shade,
    frame: trim,
    frameWidth: level > 1 ? 0.17 : 0,
    frameDepth: 0.2,
    sill: !isDoor && level > 1,
    d: 0.036,
  });
}
function apsidalWall(out, { u, v, y, lo, rad, depth, top }, f, level) {
  const n = level > 1 ? 16 : 8;
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI * (i / n - 0.5);
    return f.p(u + depth * Math.cos(t), v + rad * Math.sin(t));
  });
  extrude(out, 'ashlar', ring, lo, y, white);
  const r = outwardRing(ring);
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    tri(out, 'roof', [a[0], y, a[1]], [b[0], y, b[1]], f.P(u, top, v), brown);
  }
  const at = f.p(u + depth + 0.035, v);
  stoneArch(out, facade(at, [f.along[1], -f.along[0]]), 0, y - 3.0, 0.48, 1.67, level);
}
function dome(out, c, y, h, r, level) {
  const n = [6, 12, 16, 20][level],
    sideHeight = h * 0.61,
    shadeRoof = green;
  const circles = [
    [y - 0.15, r * 1.08, r * 1.08],
    [y + 0.38, r * 1.12, r * 1.12],
    [y + 0.82, r, r],
    [y + sideHeight - 0.24, r, r],
    [y + sideHeight, r * 1.09, r * 1.09],
  ];
  lathe(out, 'ashlar', c, circles, n, white, { capTop: false });
  lathe(
    out,
    'cupola',
    c,
    [
      [y + sideHeight, r * 1.14, r * 1.14],
      [y + h * 0.77, r * 0.76, r * 0.76],
      [y + h * 0.91, r * 0.39, r * 0.39],
      [y + h - 0.16, 0.13, 0.13],
      [y + h + 0.09, 0, 0],
    ],
    n,
    shadeRoof,
  );
  if (!level) return;
  const m = level > 1 ? n : Math.min(n, 8);
  for (let i = 0; i < m; i++) {
    const k = Math.floor((i * n) / m),
      a = (k * 2 * Math.PI) / n,
      b = ((k + 1) * 2 * Math.PI) / n;
    const p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)],
      q = [c[0] + r * Math.cos(b), c[1] + r * Math.sin(b)];
    const f = wallFace(q, p),
      w = Math.min(0.62, f.length * 0.34);
    stoneArch(out, f, f.length * 0.5, y + sideHeight * 0.28, w, sideHeight * 0.47, level);
    if (level > 1) {
      const p = f.length * 0.14;
      fbox(
        out,
        'detail',
        f,
        p - 0.09,
        p + 0.09,
        y + 0.82,
        y + sideHeight - 0.22,
        -0.056,
        0.09,
        trim,
      );
    }
  }
  if (level > 1) {
    const f = facade(c, [1, 0]);
    fbox(out, 'detail', f, -0.065, 0.065, y + h - 0.06, y + h + 0.88, -0.072, 0.072, trim);
    fbox(out, 'detail', f, -0.34, 0.34, y + h + 0.52, y + h + 0.63, -0.066, 0.066, trim);
  }
}
function principalChurch(out, c, level, large) {
  const f = frame(c),
    [u, U, v, V] = c.box,
    Y = c.grade;
  const h = large ? 1 : 0.7,
    w = U - u,
    l = V - v;
  const uc = (u + U) * 0.5,
    vc = (v + V) * 0.5;
  const mid = (a, b, t) => a + (b - a) * t;
  const y = (n) => Y + n * h;
  const nave = [u + 0.4 * h, U - 0.9 * h, mid(v, V, 0.25), mid(v, V, 0.76)];
  const tran = [mid(u, U, 0.3), mid(u, U, 0.72), v + 0.48 * h, V - 0.52 * h];
  extrude(out, 'rubble', c.ring, c.base, y(0.34), worn);
  for (const [b, h] of [
    [nave, 12.5],
    [tran, 13.1],
  ]) {
    block(out, 'ashlar', f, ...b, y(0.31), y(h), white);
    block(
      out,
      'detail',
      f,
      b[0] - 0.11,
      b[1] + 0.11,
      b[2] - 0.11,
      b[3] + 0.11,
      y(h - 0.35),
      y(h - 0.09),
      trim,
    );
  }
  roof(out, f, ...nave, y(12.48), y(17.02), 'roof', slate);
  roof(out, f, ...tran, y(13.09), y(17.18), 'roof', slate, true);
  if (!level) {
    dome(
      out,
      f.p(uc + 0.68 * h, vc + 0.13 * h),
      y(16.75),
      large ? 12.8 : 7.7,
      large ? 4.93 : 2.45,
      level,
    );
    return;
  }
  const ledges = [
    [u + 0.45 * h, mid(u, U, 0.34), v + 0.24 * h, nave[2] + 0.12 * h],
    [u + 0.32 * h, mid(u, U, 0.34), nave[3] - 0.12 * h, V - 0.23 * h],
    [tran[1] - 0.16 * h, U - 0.29 * h, v + 0.32 * h, nave[2] + 0.18 * h],
    [tran[1] - 0.16 * h, U - 0.33 * h, nave[3] - 0.16 * h, V - 0.28 * h],
  ];
  for (const [i, b] of ledges.entries()) {
    block(out, 'ashlar', f, ...b, y(0.32), y(i === 1 ? 6.39 : 5.89), white);
    roof(out, f, ...b, y(i === 1 ? 6.37 : 5.87), y(i === 1 ? 8.87 : 7.89), 'roof', brown);
  }
  apsidalWall(
    out,
    {
      u: U - 0.95 * h,
      v: vc,
      y: y(9.26),
      lo: y(0.34),
      rad: l * 0.18,
      depth: 1.44 * h,
      top: y(11.75),
    },
    f,
    level,
  );
  dome(
    out,
    f.p(uc + 0.68 * h, vc + 0.13 * h),
    y(16.75),
    large ? 12.8 : 7.7,
    large ? 4.93 : 2.45,
    level,
  );
  if (!level) return;
  const south = facade(f.p(uc, tran[3] + 0.017), f.along),
    west = facade(f.p(nave[0] - 0.015, vc), [f.along[1] * -1, f.along[0]]);
  stoneArch(out, south, 0, y(0.59), 1.36 * h, 3.14 * h, level, true);
  stoneArch(out, west, 0, y(0.63), 1.55 * h, 3.21 * h, level, true);
  for (const F of [south, west]) {
    stoneArch(out, F, 0, y(9.22), 0.84 * h, 2.48 * h, level);
    if (level > 1)
      for (const d of [-1.82, 1.82])
        fbox(out, 'detail', F, d * h - 0.1, d * h + 0.1, y(1.43), y(12.48), -0.086, 0.11, trim);
  }
  for (const side of [-1, 1]) {
    const T = facade(
      f.p(uc, side === 1 ? nave[3] + 0.021 : nave[2] - 0.021),
      f.along.map((n) => n * side),
    );
    for (const s of [-0.34, -0.21, 0.22, 0.36])
      stoneArch(out, T, s * w, y(7.19), 0.74 * h, 3.21 * h, level);
  }
}
function archFace(out, f, y, Y, n, level) {
  const half = f.length * 0.5;
  const pier = n ? f.length * 0.24 : 0;
  if (pier) {
    fbox(out, 'ashlar', f, 0, pier, y, Y, -0.41, 0, white);
    fbox(out, 'ashlar', f, f.length - pier, f.length, y, Y, -0.41, 0, white);
  }
  const lo = half - pier,
    mid = half;
  const r = pointedArch(lo, (Y - y) * 0.34, level > 1 ? 7 : 4).map(([x, t]) => [
    mid + x,
    Y - (Y - y) * 0.39 + t,
  ]);
  for (let i = 0; i < r.length - 1; i++) {
    const [a, b] = r[i],
      [c, d] = r[i + 1];
    quad4(out, 'ashlar', f.P(a, b), f.P(c, d), f.P(c, Y), f.P(a, Y), white);
    quad4(out, 'detail', f.P(c, d), f.P(a, b), f.P(a, b, -0.42), f.P(c, d, -0.42), trim);
    quad4(
      out,
      'ashlar',
      f.P(c, d, -0.42),
      f.P(a, b, -0.42),
      f.P(a, Y, -0.42),
      f.P(c, Y, -0.42),
      white,
    );
  }
}
function skylinePiers(out, f, [u, U, v, V], y, Y) {
  for (const [x, z] of [
    [u, v],
    [u, V],
    [U, v],
    [U, V],
  ]) {
    block(out, 'ashlar', f, x - 0.4, x + 0.4, z - 0.4, z + 0.4, y, Y, white);
  }
}
function belltower(out, c, level) {
  const f = frame(c),
    [u, U, v, V] = c.box,
    y = c.grade,
    ring = c.ring;
  extrude(out, 'rubble', ring, c.base, y + 5.73, worn);
  block(out, 'detail', f, u - 0.17, U + 0.17, v - 0.16, V + 0.16, y + 5.49, y + 5.88, trim);
  const high = y + 9.87;
  const upper = f.rect(u + 0.42, U - 0.42, v + 0.47, V - 0.47);
  if (level) for (const W of edges(upper)) archFace(out, W, y + 5.76, high, true, level);
  else skylinePiers(out, f, [u + 0.82, U - 0.82, v + 0.87, V - 0.87], y + 5.76, high);
  extrude(out, 'detail', upper, high, high + 0.23, trim);
  dome(out, f.p((u + U) * 0.5, (v + V) * 0.5), high + 0.16, 3.37, 1.55, level);
  if (level) {
    const W = edges(ring).sort((a, b) => b.length - a.length)[0];
    stoneArch(out, W, W.length * 0.54, y + 0.38, 1.02, 2.28, level, true);
  }
}
function nicholas(out, c, level) {
  const f = frame(c),
    [u, U, v, V] = c.box,
    Y = c.grade;
  const r = f.rect(u + 0.18, U - 0.18, v + 0.15, V - 0.16);
  if (level) for (const W of edges(r)) archFace(out, W, c.base, Y + 4.86, true, level);
  else skylinePiers(out, f, [u + 0.64, U - 0.64, v + 0.62, V - 0.62], c.base, Y + 4.86);
  extrude(out, 'detail', r, Y + 4.68, Y + 5.14, trim);
  extrude(out, 'ashlar', r, Y + 5.14, Y + 9.43, white);
  roof(out, f, u + 0.15, U - 0.16, v + 0.19, V - 0.19, Y + 9.38, Y + 12.54, 'roof', slate);
  if (level) {
    for (const F of edges(r)) stoneArch(out, F, F.length * 0.5, Y + 6.1, 0.74, 2.05, level);
    const y = Y + 0.26;
    for (let i = 0; i < 7; i++)
      block(
        out,
        'rubble',
        f,
        u - 1.88 + i * 0.27,
        u - 1.61 + i * 0.27,
        v + 1.06,
        V - 1.06,
        Y - 0.58,
        y + i * 0.12,
        worn,
      );
  }
}
function footprintRanges(out, p, level, academy) {
  const y = p.grade,
    h = academy ? 6.95 : p.height,
    f = frame(p),
    [u, U, v, V] = p.box;
  extrude(out, 'rubble', p.ring, p.base, y + 0.22, worn);
  extrude(out, 'ashlar', p.ring, y + 0.22, y + h, white);
  if (academy) {
    roof(out, f, u + 0.38, U - 0.38, v + 0.6, V - 0.37, y + h - 0.015, y + h + 4.05, 'roof', brown);
  } else {
    roof(
      out,
      f,
      u + 0.09,
      U - 0.1,
      v + 0.15,
      V - 0.14,
      y + h - 0.03,
      y + h + (V - v) * 0.29,
      'roof',
      brown,
    );
  }
  if (!level) return;
  const usable = edges(p.ring).filter((f) => f.length > (academy ? 6.35 : 4.13));
  for (const F of usable) {
    const n = Math.max(1, Math.floor(F.length / (academy ? 8.3 : 4.8)));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * F.length) / n,
        big = academy && F.length > 14.2 && i % 2 === 0;
      stoneArch(
        out,
        F,
        u,
        y + (big ? 0.38 : 1.37),
        big ? 2.35 : 0.73,
        big ? 4.22 : 1.65,
        level,
        big,
      );
    }
  }
}
function boundaryWalls(out, level) {
  for (const [a, b, y, Y] of plan.walls) {
    const f = wallFace(a, b);
    fbox(
      out,
      'rubble',
      f,
      0,
      f.length,
      Math.min(y, Y) - 1.75,
      Math.max(y, Y) + 0.96,
      -0.63,
      0,
      worn,
    );
    if (level)
      fbox(
        out,
        'detail',
        f,
        0,
        f.length,
        Math.max(y, Y) + 0.92,
        Math.max(y, Y) + 1.09,
        -0.69,
        0.045,
        trim,
      );
  }
}
function build(target, level) {
  const out = capped(target);
  principalChurch(out, plan.main, level, true);
  principalChurch(out, plan.george, level, false);
  nicholas(out, plan.nicholas, level);
  belltower(out, plan.bell, level);
  footprintRanges(out, plan.academy, level, true);
  for (const p of level ? plan.ranges : plan.ranges.slice(0, 2))
    footprintRanges(out, p, level, false);
  if (level) boundaryWalls(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
