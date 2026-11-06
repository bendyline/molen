/** Original Baliqiao: three stone tunnels, restored slab deck and 33 paired lion posts. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { baliqiaoWallTriangles } from '../../../../../../../../packages/worldgen/scripts/baliqiao-wall-triangulation.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const data = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url))),
  grid = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: linear('c5bba4'),
  light: linear('d8ceba'),
  warm: linear('c9b18d'),
  grey: linear('b2b0a5'),
  paving: linear('c5bcaa'),
  sculpture: linear('c4beac'),
};
export const baliqiaoSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
  sculpture: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
};
export const baliqiaoControls = {
  bodyLimits: data.bodyLimits,
  approachLimits: data.approachLimits,
  bodyWidth: data.bodyWidth,
  arches: data.arches,
  lionStations: data.lionStations,
  originElevation: data.originElevation,
};
const interp = (p, x) => {
  const i = p.findIndex((p) => p[0] >= x);
  if (i <= 0) return p[i === 0 ? 0 : p.length - 1][1];
  const a = p[i - 1],
    b = p[i];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
};
export const baliqiaoDeckY = (x) =>
  Math.abs(x) <= 25 ? 9.65 - 1.6 * (x / 25) * (x / 25) : interp(data.deckProfile, x);
const H = (x, z) => {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    n = grid.size[0],
    h = grid.elevationsMeters;
  return (
    (1 - a) * (1 - b) * h[j * n + i] +
    a * (1 - b) * h[j * n + i + 1] +
    (1 - a) * b * h[(j + 1) * n + i] +
    a * b * h[(j + 1) * n + i + 1] -
    data.originElevation
  );
};
const cfgs = {
  skyline: { far: true, arch: 6, side: 4, posts: 0, lion: 0, masonry: 0, pave: 0 },
  district: { arch: 10, side: 8, posts: 2, lion: 0, masonry: 0, pave: 0 },
  street: { arch: 18, side: 12, posts: 1, lion: 1, masonry: 0, pave: 3 },
  closeup: { arch: 28, side: 20, posts: 1, lion: 2, masonry: 1.8, pave: 1.5 },
  master: { arch: 40, side: 28, posts: 1, lion: 3, masonry: 1.4, pave: 0.9 },
};
function slab(out, slot, a, b, za, zb, lo, hi, color) {
  const ring = (x) => [
    [x, lo(x), za],
    [x, hi(x), za],
    [x, hi(x), zb],
    [x, lo(x), zb],
  ];
  loft(out, slot, [ring(a), ring(b)], color);
}
const openingY = (a, x) =>
  a.spring +
  a.rise *
    Math.sqrt(Math.max(0, 1 - ((x - a.center) / a.halfSpan) * ((x - a.center) / a.halfSpan)));
export const baliqiaoSoffitY = (x) => {
  const a = data.arches.find((a) => Math.abs(x - a.center) < a.halfSpan);
  return a ? openingY(a, x) : 0;
};
function body(out, S, cfg) {
  const count = cfg.far ? 8 : cfg.arch;
  const profile = Array.from({ length: count + 1 }, (_, i) => {
    const x = -25 + (50 * i) / count;
    return [x, baliqiaoDeckY(x) - 0.16];
  });
  profile.push([25, 0]);
  for (const a of data.arches.toReversed()) {
    const n = a.center === 0 ? cfg.arch : cfg.side;
    profile.push([a.center + a.halfSpan, 0]);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI;
      profile.push([a.center + a.halfSpan * Math.cos(t), a.spring + a.rise * Math.sin(t)]);
    }
    profile.push([a.center - a.halfSpan, 0]);
  }
  profile.push([-25, 0]);
  const ring = profile.filter(
    (p, i) => !i || Math.hypot(p[0] - profile[i - 1][0], p[1] - profile[i - 1][1]) > 1e-7,
  );
  // One connected exterior shell avoids internal coplanar cap walls at each arch strip.
  for (const t of baliqiaoWallTriangles(ring))
    for (const side of [-1, 1]) {
      let points = t.map(([x, y]) => [x, y, side * 8]);
      if (normalFor(...points)[2] * side < 0) points = points.toReversed();
      out.addTriangle(
        S('stone'),
        'palette:#ffffff',
        points,
        normalFor(...points),
        points.map((p) => [p[0], p[1]]),
        C.stone,
      );
    }
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length],
      points = [
        [p[0], p[1], -8],
        [p[0], p[1], 8],
        [q[0], q[1], 8],
        [q[0], q[1], -8],
      ];
    out.addQuad(
      S('stone'),
      'palette:#ffffff',
      points,
      normalFor(...points),
      [
        [0, 0],
        [0, 16],
        [Math.hypot(q[0] - p[0], q[1] - p[1]), 16],
        [Math.hypot(q[0] - p[0], q[1] - p[1]), 0],
      ],
      C.stone,
    );
  }
  // Actual ring blocks follow the same opening; no full-height opaque facade crosses a tunnel.
  if (!cfg.far)
    for (const a of data.arches) {
      const n = a.center === 0 ? cfg.arch : cfg.side;
      for (let i = 0; i < n; i++)
        for (const side of [-1, 1]) {
          const t0 = Math.PI - (i / n) * Math.PI,
            t1 = Math.PI - ((i + 1) / n) * Math.PI,
            thick = a.center === 0 ? 0.38 : 0.3,
            p = (t, outer, z) => [
              a.center + (a.halfSpan + (outer ? thick : 0)) * Math.cos(t),
              a.spring + (a.rise + (outer ? thick : 0)) * Math.sin(t),
              z,
            ],
            z = side * 8.045;
          const ring = (zz) => [
            p(t0, false, zz),
            p(t1, false, zz),
            p(t1, true, zz),
            p(t0, true, zz),
          ];
          loft(out, S('stone'), [ring(z - 0.035), ring(z + 0.035)], i % 4 ? C.light : C.warm);
        }
    }
  if (cfg.masonry)
    for (const side of [-1, 1])
      for (let row = 0; row < 19; row++)
        for (let x = -25 + (row % 2 ? cfg.masonry / 2 : 0); x < 25; x += cfg.masonry) {
          const a = Math.max(-25, x) + 0.012,
            b = Math.min(25, x + cfg.masonry) - 0.012,
            lo = 0.03 + row * 0.5,
            hi = lo + 0.477;
          if (
            b <= a ||
            hi > Math.min(baliqiaoDeckY(a), baliqiaoDeckY(b)) - 0.25 ||
            lo < Math.max(baliqiaoSoffitY(a), baliqiaoSoffitY(b)) + 0.45
          )
            continue;
          const color = [C.stone, C.light, C.warm, C.grey][
            Math.abs(Math.trunc(x * 3) + row * 7) % 4
          ];
          box(
            {
              addQuad(...args) {
                // The opaque wall supplies the stone back. A coincident inward face
                // otherwise self-shadows across the exposed course at Earth scale.
                if (args[3][2] !== -side) out.addQuad(...args);
              },
            },
            S('stone'),
            [a, lo, side > 0 ? 8 : -8.035],
            [b, hi, side > 0 ? 8.035 : -8],
            color,
          );
        }
  if (!cfg.far)
    for (const side of [-1, 1])
      for (let x = -25; x < 25; x += 5)
        slab(
          out,
          S('stone'),
          x,
          x + 5,
          side > 0 ? 7.85 : -8.25,
          side > 0 ? 8.25 : -7.85,
          (v) => baliqiaoDeckY(v) - 0.21,
          (v) => baliqiaoDeckY(v) + 0.02,
          C.light,
        );
}
function paving(out, S, cfg) {
  const step = cfg.far ? 25 : cfg.pave || 5;
  for (let x = -25; x < 25; x += step) {
    const a = x,
      b = Math.min(25, x + step);
    slab(
      out,
      S('paving'),
      a,
      b,
      -7.65,
      7.65,
      (v) => baliqiaoDeckY(v) - 0.16,
      baliqiaoDeckY,
      C.paving,
    );
    if (cfg.pave)
      for (let z = -7.65; z < 7.6; z += 2.5)
        slab(
          out,
          S('paving'),
          a + 0.014,
          b - 0.014,
          z + 0.014,
          Math.min(7.65, z + 2.5) - 0.014,
          baliqiaoDeckY,
          (v) => baliqiaoDeckY(v) + 0.024,
          (Math.round(x * 4) + Math.round(z * 4)) % 7 === 0 ? C.warm : C.paving,
        );
  }
  if (!cfg.far)
    for (const side of [-1, 1])
      for (let x = -25; x < 25; x += 5)
        slab(
          out,
          S('paving'),
          x,
          x + 5,
          side > 0 ? 7.25 : -7.8,
          side > 0 ? 7.8 : -7.25,
          baliqiaoDeckY,
          (v) => baliqiaoDeckY(v) + 0.13,
          C.light,
        );
  for (const sign of [-1, 1]) {
    const stations = [25, 35, 45, 55, 65].map((x) => x * sign).sort((a, b) => a - b);
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1],
        b = stations[i],
        width = (x) => 7.6 - (Math.abs(x) - 25) * 0.07,
        ring = (x) => {
          const y = baliqiaoDeckY(x),
            w = width(x);
          return [
            [x, Math.min(y - 0.35, H(x, -w) - 0.4), -w],
            [x, y, -w],
            [x, y, w],
            [x, Math.min(y - 0.35, H(x, w) - 0.4), w],
          ];
        };
      loft(out, S('paving'), [ring(a), ring(b)], C.paving);
    }
  }
}
function statue(out, slot, x, y, z, side, index, detail) {
  // The sculptures are original stylized reconstructions, not replicas of individual carvings.
  const shift = (u, v, w) => [x + u, y + v, z - side * w],
    ell = (p, r, seg = 6, lat = 3) => sphere(out, slot, shift(...p), r, C.sculpture, seg, lat);
  if (detail === 1) {
    ell([0, 0.22, -0.04], [0.17, 0.2, 0.16]);
    ell([0.015, 0.46, 0.065], [0.18, 0.17, 0.16]);
    const a = shift(-0.16, 0, 0.26),
      b = shift(0.16, 0.075, -0.04);
    box(
      out,
      slot,
      a.map((v, i) => Math.min(v, b[i])),
      a.map((v, i) => Math.max(v, b[i])),
      C.sculpture,
    );
    return;
  }
  const seg = detail === 3 ? 12 : 8,
    lat = detail === 3 ? 7 : 4;
  ell([0, 0.22, -0.035], [0.18, 0.23, 0.16], seg, lat);
  ell([0.018 * ((index % 3) - 1), 0.47, 0.055], [0.18, 0.17, 0.155], seg, lat);
  for (const u of [-0.125, 0.125]) {
    ell([u, 0.12, -0.095], [0.105, 0.12, 0.13], detail === 3 ? 10 : 6, detail === 3 ? 5 : 3);
    ell([u, 0.13, 0.095], [0.052, 0.15, 0.055], detail === 3 ? 8 : 6, detail === 3 ? 5 : 3);
    ell([u, 0.035, 0.16], [0.075, 0.05, 0.115], detail === 3 ? 8 : 6, detail === 3 ? 4 : 3);
    ell([u, 0.58, 0.025], [0.058, 0.057, 0.035], detail === 3 ? 8 : 6, detail === 3 ? 4 : 3);
  }
  ell([0, 0.46, 0.198], [0.12, 0.042, 0.075], detail === 3 ? 10 : 6, 3);
  ell([0, 0.389, 0.18], [0.105, 0.025, 0.065], detail === 3 ? 10 : 6, 3);
  ell([0, 0.505, 0.24], [0.052, 0.034, 0.037], detail === 3 ? 8 : 4, 3);
  const count = detail === 3 ? 11 : 5;
  for (let i = 0; i < count; i++) {
    const t = Math.PI * 0.1 + (Math.PI * 1.8 * i) / (count - 1);
    ell(
      [Math.sin(t) * 0.17, 0.46 + Math.cos(t) * 0.16, -0.025],
      [0.058, 0.055, 0.055],
      detail === 3 ? 8 : 4,
      detail === 3 ? 4 : 3,
    );
  }
  tubePath(
    out,
    slot,
    [
      shift(0, 0.07, -0.16),
      shift(0.14, 0.11, -0.18),
      shift(0.18, 0.24, -0.15),
      shift(0.11, 0.28, -0.12),
    ],
    0.028,
    C.sculpture,
    detail === 3 ? 8 : 4,
  );
  if (detail === 3) {
    for (const u of [-0.125, 0.125])
      for (const d of [-0.035, 0, 0.035]) ell([u + d, 0.042, 0.23], [0.022, 0.024, 0.035], 6, 3);
    for (const u of [-0.075, 0.075]) ell([u, 0.52, 0.17], [0.043, 0.018, 0.03], 6, 3);
    ell([side * 0.15, 0.025, 0.195], [0.06, 0.06, 0.06], 8, 4);
  }
}
function balustrade(out, S, cfg) {
  for (const side of [-1, 1]) {
    const z = side * 7.52;
    const panelStations = cfg.far ? [-24, 0, 24] : data.lionStations;
    for (let i = 1; i < panelStations.length; i++) {
      const a = panelStations[i - 1] + 0.22,
        b = panelStations[i] - 0.22;
      slab(
        out,
        S('sculpture'),
        a,
        b,
        z - 0.12,
        z + 0.12,
        (x) => baliqiaoDeckY(x) + 0.15,
        (x) => baliqiaoDeckY(x) + 0.94,
        C.light,
      );
      if (cfg.lion > 1)
        for (const face of [-1, 1]) {
          const zz = z + face * 0.13;
          for (const h of [0.3, 0.79])
            beam(
              out,
              S('sculpture'),
              [a + 0.08, baliqiaoDeckY(a) + h, zz],
              [b - 0.08, baliqiaoDeckY(b) + h, zz],
              0.045,
              0.04,
              C.sculpture,
            );
        }
    }
    const stations = cfg.far
      ? [-24, 0, 24]
      : data.lionStations.filter((_, i) => i % cfg.posts === 0 || i === 32);
    for (const x of stations) {
      const y = baliqiaoDeckY(x);
      box(
        out,
        S('sculpture'),
        [x - 0.23, y + 0.1, z - 0.23],
        [x + 0.23, y + 1.08, z + 0.23],
        C.light,
      );
      box(
        out,
        S('sculpture'),
        [x - 0.29, y + 1.08, z - 0.28],
        [x + 0.29, y + 1.23, z + 0.28],
        C.sculpture,
      );
      if (cfg.lion)
        statue(out, S('sculpture'), x, y + 1.23, z, side, Math.round((x + 24) / 1.5), cfg.lion);
    }
  }
}
export function buildBaliqiaoLevel(out, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Baliqiao tier ' + level);
  const S = (s) => (cfg.far ? 'far' : s);
  body(out, S, cfg);
  paving(out, S, cfg);
  balustrade(out, S, cfg);
}
export const buildBaliqiaoSkyline = (out) => buildBaliqiaoLevel(out, 'skyline');
export const buildBaliqiaoDistrict = (out) => buildBaliqiaoLevel(out, 'district');
export const buildBaliqiaoStreet = (out) => buildBaliqiaoLevel(out, 'street');
export const buildBaliqiaoCloseup = (out) => buildBaliqiaoLevel(out, 'closeup');
