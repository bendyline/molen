import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  spire,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../monastery-plan.json' with { type: 'json' };

export const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  glaze: { slot: 'roof', graph: 'tile_glazed', roughness: 0.83 },
  pave: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97 },
  shadow: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'guadalupe-arched-bays',
    roughness: 0.95,
  },
};
const stone = rgb('a3987e'),
  sand = rgb('bbb097'),
  cut = rgb('d2ba95'),
  warm = rgb('bc9a80'),
  earth = rgb('8f8378');
const tile = rgb('88634f'),
  oldTile = rgb('786758'),
  blueTile = rgb('647d77'),
  shadow = rgb('4b4842'),
  green = rgb('59654e');
const {
  center: [x, z],
  axis: [a, b],
  rings,
} = site;
const F = facade([x, z], [a, b]);
const p = (u, v) => [x + u * a - v * b, z + u * b + v * a];
const r = (u, U, v, V) => [p(u, v), p(u, V), p(U, V), p(U, v)];
const box = (out, s, u, U, v, V, y, Y, c) => fbox(out, s, F, u, U, y, Y, v, V, c);
const edges = (ring) => outwardRing(ring).map((a, i, R) => wallFace(a, R[(i + 1) % R.length]));
function caps(out) {
  return {
    ...out,
    addCap(s, ref, outer, holes, height, normal, uv, c) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('wall', ref, outer, holes, height, normal, uv, c)) return false;
      const { indices, positions } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const point = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, s, point(0), point(1), point(2), c);
      }
      return true;
    },
  };
}
function pitch(out, u0, v0, u1, v1, width, eave, rise, col = tile) {
  gableRoof(out, 'clay', p(u0, v0), p(u1, v1), width, eave, eave + rise, col, {
    overhang: 0.24,
    endSlot: 'rubble',
    endColor: sand,
  });
}
function facadeWindows(out, ring, floor, height, level, spacing = 5) {
  if (!level) return;
  for (const f of edges(ring)) {
    if (f.length < 4.4) continue;
    const n = Math.max(1, Math.round(f.length / (level === 1 ? spacing * 1.27 : spacing)));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * f.length) / n;
      if (level === 1) {
        const Y = floor + height;
        quad4(
          out,
          'shadow',
          f.P(u - 0.5, floor, 0.028),
          f.P(u + 0.5, floor, 0.028),
          f.P(u + 0.5, Y - 0.42, 0.028),
          f.P(u - 0.5, Y - 0.42, 0.028),
          shadow,
        );
        tri(
          out,
          'shadow',
          f.P(u - 0.5, Y - 0.42, 0.028),
          f.P(u + 0.5, Y - 0.42, 0.028),
          f.P(u, Y, 0.028),
          shadow,
        );
        continue;
      }
      opening(out, f, u, floor, 1.04, height, {
        head: 'pointed',
        glassSlot: 'shadow',
        frameSlot: 'cut',
        glass: shadow,
        frame: cut,
        frameWidth: level === 3 ? 0.15 : 0,
        frameDepth: 0.15,
        sill: level === 3,
        d: 0.024,
        rise: 0.44,
      });
    }
  }
}
function wing(out, id, lower, top, roofs, level) {
  const ring = rings[id];
  const options = id === 'south' ? { holes: [rings.southCourt] } : {};
  extrude(out, 'rubble', ring, lower, top, stone, options);
  if (level) extrude(out, 'cut', ring, top - 0.43, top + 0.06, cut, options);
  for (const [u0, v0, u1, v1, w, rise] of roofs)
    pitch(out, u0, v0, u1, v1, w, top, rise, id === 'guest' ? oldTile : tile);
  facadeWindows(out, ring, top - 3.7, 2.07, level);
  if (level === 3 && top - lower > 12) facadeWindows(out, ring, top - 8.2, 1.86, level, 6.7);
}
function crenellation(out, ring, top, level) {
  if (level < 2) return;
  for (const f of edges(ring)) {
    const count = Math.max(1, Math.floor(f.length / 1.65)),
      step = f.length / count;
    for (let i = 0; i < count; i++) {
      const l = i * step;
      fbox(out, 'cut', f, l, l + Math.min(0.98, step * 0.56), top, top + 0.86, -0.43, 0.024, cut);
    }
  }
}
function keep(out, u, v, du, dv, base, top, level, bell = false) {
  const plan = r(u - du, u + du, v - dv, v + dv);
  extrude(out, 'rubble', plan, base, top, stone);
  extrude(
    out,
    'cut',
    r(u - du - 0.18, u + du + 0.18, v - dv - 0.18, v + dv + 0.18),
    top - 0.78,
    top - 0.46,
    cut,
  );
  crenellation(out, plan, top, level);
  facadeWindows(out, plan, top - 5.88, bell ? 3.57 : 2.25, level, bell ? 3.5 : 5.2);
  if (!bell) return;
  const y = top + 0.54;
  for (const du of [-1.06, 1.06])
    for (const dv of [-0.92, 0.92]) {
      box(out, 'cut', u + du - 0.26, u + du + 0.26, v + dv - 0.26, v + dv + 0.26, y, y + 3.58, cut);
    }
  box(out, 'cut', u - 1.47, u + 1.47, v - 1.34, v + 1.34, y + 3.47, y + 3.77, cut);
  spire(out, 'clay', p(u, v), 1.83, 4, y + 3.76, 0.95, tile, {
    rotation: Math.atan2(b, a) + Math.PI * 0.25,
  });
}
function spiredTurret(out, u, v, rad, base, top, height, level) {
  const c = p(u, v),
    n = level > 1 ? 16 : 8;
  lathe(
    out,
    'rubble',
    c,
    [
      [base, rad, rad],
      [top - 0.68, rad, rad],
      [top, rad + 0.16, rad + 0.16],
    ],
    n,
    sand,
  );
  lathe(
    out,
    'cut',
    c,
    [
      [top, rad + 0.2, rad + 0.2],
      [top + 0.23, rad + 0.2, rad + 0.2],
    ],
    n,
    cut,
  );
  lathe(
    out,
    'glaze',
    c,
    [
      [top + 0.23, rad + 0.04, rad + 0.04],
      [top + height * 0.57, rad * 0.55, rad * 0.55],
      [top + height, 0, 0],
    ],
    n,
    blueTile,
  );
}
function arcadedBays(out, F, span, low, high, pier, count, level) {
  const step = span / count;
  if (level === 0) {
    fbox(out, 'rubble', F, 0, span, low, high, -0.31, 0.09, stone);
    return;
  }
  const archHeight = high - low,
    head = archHeight * 0.69;
  const steps = level === 1 ? 3 : level === 2 ? 8 : 13;
  for (let i = 0; i < count; i++) {
    const u = i * step,
      mid = u + step * 0.5,
      w = (step - pier) * 0.5;
    fbox(out, 'cut', F, u, u + pier, low, high, -0.32, 0.12, cut);
    const points = [];
    for (let j = 0; j <= steps; j++) {
      const a = (Math.PI * j) / steps;
      const px = mid + w * 0.97 * Math.cos(a),
        y = low + head * 0.52 + head * 0.82 * Math.sin(a);
      points.push([Math.max(u + pier, Math.min(u + step, px)), y]);
    }
    const ends = [points[0], points.at(-1)];
    for (const [x, y] of ends) {
      const l = x < mid ? u + pier : x,
        r = x < mid ? x : u + step;
      if (r - l > 0.005) fbox(out, 'cut', F, l, r, low, y, -0.32, 0.12, cut);
    }
    for (let j = 0; j < steps; j++) {
      const [x, y] = points[j],
        [X, Y] = points[j + 1];
      if (Math.abs(x - X) < 1e-5) continue;
      const l = Math.min(x, X),
        r = Math.max(x, X),
        Y0 = x < X ? y : Y,
        Y1 = x < X ? Y : y;
      quad4(
        out,
        'cut',
        F.P(l, Y0, 0.12),
        F.P(r, Y1, 0.12),
        F.P(r, high, 0.12),
        F.P(l, high, 0.12),
        warm,
      );
      if (level > 1)
        quad4(
          out,
          'rubble',
          F.P(r, Y1, -0.32),
          F.P(l, Y0, -0.32),
          F.P(l, high, -0.32),
          F.P(r, high, -0.32),
          sand,
        );
      quad4(
        out,
        'cut',
        F.P(r, Y1, 0.12),
        F.P(l, Y0, 0.12),
        F.P(l, Y0, -0.32),
        F.P(r, Y1, -0.32),
        stone,
      );
    }
  }
}
function cloister(out, level) {
  const podium = -0.55;
  const spans = [
    [[-15.38, -13.55], [16.16, -14.05], 4.65],
    [[16.16, -14.05], [16.58, 16.5], 4.82],
    [[16.58, 16.5], [-14.86, 15.34], 4.73],
    [[-14.86, 15.34], [-15.38, -13.55], 4.18],
  ];
  for (const [[u, v], [U, V], width] of spans) {
    const f = wallFace(p(u, v), p(U, V)),
      l = f.length;
    fbox(out, 'pave', f, 0, l, podium - 0.38, podium + 0.18, -width, 0.09, earth);
    fbox(out, 'rubble', f, 0, l, podium - 2, podium + 8.34, -width, -width + 0.63, stone);
    fbox(out, 'cut', f, 0, l, podium + 4.05, podium + 4.48, -width, 0.15, warm);
    fbox(out, 'cut', f, 0, l, podium + 7.91, podium + 8.44, -width, 0.24, cut);
    arcadedBays(out, f, l, podium + 0.14, podium + 4.15, 0.43, level === 1 ? 4 : 11, level);
    arcadedBays(out, f, l, podium + 4.86, podium + 8.02, 0.31, level === 1 ? 5 : 14, level);
    const g = f.P(0, podium + 8.4, -width),
      h = f.P(l, podium + 8.4, -width);
    quad4(
      out,
      'clay',
      f.P(0, podium + 8.41, 0.18),
      f.P(l, podium + 8.41, 0.18),
      [h[0], h[1] + 1.59, h[2]],
      [g[0], g[1] + 1.59, g[2]],
      oldTile,
    );
  }
  const garden = r(-12.75, 13.74, -11.35, 12.7);
  extrude(out, 'pave', garden, -1.8, -0.39, earth);
  if (level) {
    for (const d of [-1, 1])
      for (const e of [-1, 1]) {
        box(
          out,
          'pave',
          d > 0 ? 2 : -11.9,
          d > 0 ? 12.9 : -1.2,
          e > 0 ? 4.1 : -10,
          e > 0 ? 11.9 : -3.86,
          -0.39,
          -0.23,
          green,
        );
      }
  }
  const templete = rings.templete;
  extrude(out, 'pave', templete, -1.4, 0.37, earth);
  const c = p(0.42, 0.12);
  for (let i = 0; i < 4; i++) {
    const u = 0.42 + (i < 2 ? -1 : 1) * 2.16,
      v = 0.12 + (i % 2 ? -1 : 1) * 2.13;
    box(out, 'cut', u - 0.4, u + 0.4, v - 0.39, v + 0.39, 0.37, 5.32, cut);
  }
  box(out, 'cut', -2.57, 3.47, -2.81, 3.04, 5.02, 5.59, cut);
  if (level)
    for (const [u, v] of [
      [-2.49, -2.36],
      [-2.49, 2.46],
      [3.27, -2.36],
      [3.27, 2.46],
    ]) {
      spire(out, 'glaze', p(u, v), 0.66, 4, 5.32, 2.03, blueTile);
    }
  lathe(
    out,
    'clay',
    c,
    [
      [5.53, 3.38, 3.38],
      [6.44, 2.81, 2.81],
      [7.46, 1.68, 1.68],
      [8.84, 0, 0],
    ],
    level ? 8 : 4,
    tile,
  );
  if (level > 1)
    lathe(
      out,
      'cut',
      c,
      [
        [8.63, 0.19, 0.19],
        [9.31, 0.14, 0.14],
        [9.66, 0, 0],
      ],
      8,
      cut,
    );
}
function roseWindow(out, f, y, level) {
  const radius = 2.42,
    n = level > 1 ? 24 : 12;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    const q = (r, t, d) => f.P(r * Math.cos(t), y + r * Math.sin(t), d);
    tri(out, 'shadow', f.P(0, y, 0.035), q(radius, a, 0.035), q(radius, b, 0.035), shadow);
    quad4(
      out,
      'cut',
      q(radius, a, 0.08),
      q(radius + 0.29, a, 0.125),
      q(radius + 0.29, b, 0.125),
      q(radius, b, 0.08),
      cut,
    );
    if (level > 1 && i % 2 === 0) {
      const l = a + 0.04,
        h = b - 0.04;
      quad4(
        out,
        'cut',
        q(radius * 0.17, l, 0.073),
        q(radius * 0.96, l, 0.073),
        q(radius * 0.96, h, 0.073),
        q(radius * 0.17, h, 0.073),
        cut,
      );
    }
  }
}
function basilica(out, level) {
  const basilica = rings.church;
  extrude(out, 'rubble', basilica, -8.8, 19.82, sand);
  pitch(out, -22.7, 26.33, 22.7, 26.33, 13.65, 19.75, 5.44, tile);
  pitch(out, 12.1, 21.4, 12.1, 41.06, 13.6, 19.62, 7.06, oldTile);
  const frontEdge = wallFace(p(-7.08, 38.28), p(23.85, 44.4));
  const [frontX, , frontZ] = frontEdge.P(13.4, 0, 0.12);
  const front = facade([frontX, frontZ], frontEdge.along);
  fbox(out, 'rubble', front, -7.71, 7.22, -5.9, 21.07, -3.5, 0.12, sand);
  tri(
    out,
    'cut',
    front.P(-7.71, 21.07, 0.14),
    front.P(7.22, 21.07, 0.14),
    front.P(0.25, 27.04, 0.14),
    sand,
  );
  if (level) {
    opening(out, front, 0.06, -0.98, 3.34, 6.45, {
      head: 'pointed',
      glassSlot: 'shadow',
      frameSlot: 'cut',
      glass: shadow,
      frame: cut,
      frameWidth: 0.42,
      frameDepth: 0.36,
      rise: 1.44,
      sill: false,
      d: 0.17,
    });
    const rise = 11.74;
    const [px, , pz] = front.P(0.19, rise, 0.19);
    const rose = facade([px, pz], front.along);
    for (let i = 0; i < 4; i++) {
      const radii = [2.6, 2.83, 3.06, 3.26],
        h = [0.11, 0.19, 0.25, 0.32];
      const next = h[i];
      for (let j = 0; j < (level === 1 ? 8 : 18); j++) {
        const n = level === 1 ? 8 : 18,
          t = (j * 2 * Math.PI) / n,
          T = ((j + 1) * 2 * Math.PI) / n,
          r = radii[i];
        const q = (a, r, d) => rose.P(r * Math.cos(a), rise + r * Math.sin(a), d);
        quad4(
          out,
          'cut',
          q(t, r - 0.13, next),
          q(t, r + 0.11, next),
          q(T, r + 0.11, next),
          q(T, r - 0.13, next),
          i % 2 ? cut : warm,
        );
      }
    }
    roseWindow(out, rose, rise, level);
    facadeWindows(out, basilica, 12.71, 5.13, level, 7.28);
    for (const u of [-13.6, -5.3, 4.14, 13.4, 21.13]) {
      box(out, 'cut', u - 0.29, u + 0.29, 18.68, 21.62, 7.88, 21.58, warm);
      spire(out, 'cut', p(u, 18.86), 0.57, 4, 21.52, 2.03, cut);
    }
  }
  keep(out, -21.98, 28.11, 4.03, 5.71, -9.5, 29.93, level, true);
  keep(out, -28.08, -32.78, 5.18, 5.14, -10.3, 28.36, level);
  spiredTurret(out, 26.7, 27.11, 1.79, -4.11, 20.06, 4.94, level);
  spiredTurret(out, 32.04, -13.21, 1.42, -1.82, 15.91, 4.08, level);
  spiredTurret(out, 27.7, -31.48, 1.37, -1.95, 18.13, 4.57, level);
}
function buildingMasses(out, level) {
  wing(out, 'west', -11.7, 14.66, [[-23.31, -30.19, -22.06, 23.93, 12.0, 3.74]], level);
  wing(out, 'north', -5.8, 14.77, [[-15.21, -23.52, 23.46, -23.28, 8.82, 3.59]], level);
  wing(out, 'east', -2.7, 16.36, [[25.36, -22.34, 25.72, 19.1, 8.03, 3.12]], level);
  wing(out, 'annex', -9.9, 11.9, [[-17.7, -33.51, -8.96, -33.45, 9, 2.43]], level);
  wing(out, 'kitchen', -9.8, 10.5, [], level);
  wing(
    out,
    'south',
    -10.9,
    11.93,
    [
      [-31.38, 49.6, -33.18, 57.53, 3.5, 1.37],
      [-19.58, 46.94, -16.03, 51.23, 4.94, 2.06],
    ],
    level,
  );
  wing(
    out,
    'guest',
    -8.0,
    14.21,
    [
      [18.06, -74.76, 17.62, -37.71, 9.7, 4.01],
      [-2.3, -81.29, 33.51, -77.97, 9.34, 3.8],
      [-5.15, -78.67, -6.57, -50.03, 8.65, 3.15],
    ],
    level,
  );
  wing(out, 'southGuest', -7.8, 13.64, [[-7.6, -44.61, 3.92, -43.72, 9.02, 3.14]], level);
  wing(out, 'service', -1.22, 12.03, [[37.24, -68.34, 38.52, -37.63, 7.75, 3.04]], level);
  wing(out, 'newChurch', 1.83, 18.52, [[51.8, 34.1, 69.17, 23.36, 15.28, 4.68]], level);
  for (const [id, u, v, r] of [
    ['domeWest', 46.78, 36.74, 7.7],
    ['domeEast', 54.44, 53.23, 7.56],
  ]) {
    extrude(out, 'rubble', rings[id], 2.1, 18.11, sand);
    lathe(
      out,
      'clay',
      p(u, v),
      [
        [18.1, r, r],
        [20.39, r * 0.69, r * 0.69],
        [22.89, r * 0.38, r * 0.38],
        [24.29, 0.55, 0.55],
        [24.81, 0, 0],
      ],
      level > 1 ? 16 : 8,
      tile,
    );
  }
}
function build(target, level) {
  const out = caps(target);
  buildingMasses(out, level);
  cloister(out, level);
  basilica(out, level);
}
export function buildSkyline(target) {
  const out = caps(target);
  for (const [id, base, top] of [
    ['west', -11.7, 16.3],
    ['north', -5.8, 16.96],
    ['east', -2.7, 17.76],
    ['annex', -9.9, 13.3],
    ['kitchen', -9.8, 10.8],
    ['cloister', -6.3, 8.06],
    ['templete', -1.4, 6.52],
    ['south', -10.9, 13.83],
    ['guest', -8, 16.16],
    ['southGuest', -7.8, 15.2],
    ['service', -1.22, 13.43],
    ['newChurch', 1.83, 21.28],
    ['domeWest', 2.1, 20.39],
    ['domeEast', 2.1, 20.39],
  ])
    extrude(
      out,
      'rubble',
      rings[id],
      base,
      top,
      sand,
      id === 'south' ? { holes: [rings.southCourt] } : {},
    );
  extrude(out, 'rubble', rings.church, -8.8, 19.82, sand);
  pitch(out, -22.7, 26.33, 22.7, 26.33, 13.65, 19.75, 5.44);
  pitch(out, 12.1, 21.4, 12.1, 41.06, 13.6, 19.62, 7.06, oldTile);
  keep(out, -21.98, 28.11, 4.03, 5.71, -9.5, 29.93, 0, true);
  keep(out, -28.08, -32.78, 5.18, 5.14, -10.3, 28.36, 0);
  for (const [u, v, rad, y, h] of [
    [26.7, 27.11, 1.79, 20.06, 4.94],
    [32.04, -13.21, 1.42, 15.91, 4.08],
    [27.7, -31.48, 1.37, 18.13, 4.57],
  ]) {
    lathe(
      out,
      'rubble',
      p(u, v),
      [
        [0, rad, rad],
        [y, rad, rad],
        [y + h, 0, 0],
      ],
      6,
      sand,
    );
  }
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
