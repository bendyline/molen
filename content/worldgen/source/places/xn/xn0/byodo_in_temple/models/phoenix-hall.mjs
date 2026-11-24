import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  timber: { slot: 'wall', graph: 'wood_vertical', roughness: 0.85 },
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.78 },
};
const red = rgb('963e2e'),
  scarlet = rgb('b65a41'),
  shadow = rgb('612c24');
const ivory = rgb('dedbd0'),
  granite = rgb('a8a79b'),
  plinth = rgb('838073');
const tile = rgb('555058'),
  ridge = rgb('3e3d43'),
  fascia = rgb('302729'),
  gold = rgb('d6b456');

const lerp = (a, b, t) => a + (b - a) * t;
const front = facade(site.origin, site.along);
const box = (out, slot, u0, u1, y0, y1, d0, d1, color) =>
  abox(out, slot, [u0, y0, d0], [u1, y1, d1], color, { bottom: false });

function eaves(out, detail, u, d, halfWidth, halfDepth, y, rise, ridgeWidth, tall = false) {
  const n = [2, 3, 5, 12][detail],
    bands = [tall ? 2 : 1, 3, 5, 10][detail];
  function ring(t, delta = 0) {
    const gable = tall ? Math.max(0, (t - 0.49) / 0.51) : t;
    const w = lerp(halfWidth, ridgeWidth, tall ? 0.43 * t + 0.57 * gable : t);
    const depth = lerp(halfDepth, 0.15, t);
    const h = y + rise * Math.pow(t, 1.57) + delta;
    const corners = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ];
    return corners.flatMap(([a, b], i) =>
      Array.from({ length: n }, (_, j) => {
        const [c, e] = corners[(i + 1) % 4],
          uNorm = lerp(a, c, j / n),
          dNorm = lerp(b, e, j / n);
        const lift = (1 - t) * Math.pow(Math.abs(uNorm), 4) * (tall ? 0.66 : 0.31);
        return [u + w * uNorm, h + lift, d + depth * dNorm];
      }),
    );
  }
  const rings = Array.from({ length: bands + 1 }, (_, j) => ring(j / bands));
  if (detail > 0) loft(out, 'timber', [ring(0, -0.235), rings[0]], fascia, { cap: false });
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      quad4(out, 'tile', a[i], a[k], b[k], b[i], j % 3 === 0 ? ridge : tile);
    }
  }
  box(
    out,
    'tile',
    u - ridgeWidth,
    u + ridgeWidth,
    y + rise - 0.031,
    y + rise + 0.17,
    d - 0.19,
    d + 0.19,
    ridge,
  );
  if (detail < 2) return;
  for (const [i, a] of rings[0].entries()) {
    if (i % 2 === 1 && detail === 2) continue;
    const b = rings[0][(i + 1) % rings[0].length];
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.58));
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps;
      const v = a.map((x, j) => lerp(x, b[j], t));
      const w = rings[1][i].map((x, j) => lerp(x, rings[1][(i + 1) % rings[0].length][j], t));
      beam(
        out,
        'tile',
        [v[0], v[1] + 0.035, v[2]],
        [w[0], w[1] + 0.035, w[2]],
        0.095,
        0.082,
        ridge,
      );
    }
  }
}

function platform(out, u0, u1, d0, d1, height) {
  box(out, 'stone', u0, u1, site.foundationBottom, height - 0.23, d0, d1, plinth);
  box(out, 'stone', u0 - 0.055, u1 + 0.055, height - 0.23, height, d0 - 0.055, d1 + 0.055, granite);
}

function timberBay(out, detail, f, a, b, grade, lintel, { closed = false, upper = false } = {}) {
  const post = (u, r, y0, y1, d = 0) =>
    fbox(out, 'timber', f, u - r, u + r, y0, y1, d - r, d + r, red);
  const rail = (slot, color, y0, y1, d0, d1) => fbox(out, slot, f, a, b, y0, y1, d0, d1, color);
  const count = detail === 0 ? 1 : Math.max(1, Math.round((b - a) / [0, 3.45, 2.8, 2.3][detail]));
  for (let i = 0; i < count; i++) {
    const u = lerp(a, b, i / count);
    post(u, upper ? 0.11 : 0.145, grade, lintel + 0.16);
    if (detail > 1) {
      post(u, 0.223, lintel - 0.42, lintel - 0.26);
      post(u, 0.289, lintel - 0.26, lintel - 0.105);
    }
  }
  rail('timber', shadow, lintel - 0.16, lintel + 0.12, -0.16, 0.22);
  if (closed) {
    rail('lime', ivory, lintel - 0.79, lintel - 0.17, -0.146, -0.13);
    rail('timber', red, grade, lintel - 0.8, -0.167, -0.151);
  } else if (detail > 0) {
    rail(
      'timber',
      scarlet,
      grade + (upper ? 0.25 : 0.64),
      grade + (upper ? 0.36 : 0.78),
      -0.1,
      0.1,
    );
  }
  if (detail > 1) {
    const brackets = Math.max(2, Math.round((b - a) / (detail === 2 ? 1.18 : 0.74)));
    for (let i = 0; i < brackets; i++) {
      const u = lerp(a, b, (i + 0.5) / brackets);
      fbox(out, 'timber', f, u - 0.058, u + 0.058, lintel + 0.1, lintel + 0.25, -0.17, 0.31, ivory);
    }
  }
}

function walls(out, detail, u0, u1, d0, d1, floor, top, opts) {
  if (detail === 0 && opts.closed) {
    box(out, 'timber', u0, u1, floor, top - 0.67, d0, d1, red);
    box(out, 'lime', u0, u1, top - 0.67, top, d0, d1, ivory);
    return;
  }
  const ring = [
    [u0, d0],
    [u0, d1],
    [u1, d1],
    [u1, d0],
  ];
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % 4]);
    timberBay(out, detail, f, 0, f.length, floor, top, opts);
  }
}

function phoenix(out, detail, u, d, direction) {
  const y = site.ridgeHeight;
  const wing = (x, h, z) => [u + x * direction, y + h, d + z];
  if (detail === 0) {
    tri(out, 'bronze', wing(-0.36, 0, -0.12), wing(0.43, 0.51, 0), wing(-0.41, 0.31, 0.25), gold);
    tri(out, 'bronze', wing(-0.36, 0, -0.12), wing(-0.41, 0.31, 0.25), wing(0.43, 0.51, 0), gold);
    return;
  }
  const feathers = detail < 2 ? 3 : 6;
  loft(
    out,
    'bronze',
    [
      radialRing(y - 0.075, 0.17, 0.112, 7, [u, d]),
      radialRing(y + 0.17, 0.28, 0.14, 7, [u + 0.08 * direction, d]),
      radialRing(y + 0.45, 0.095, 0.095, 7, [u + 0.26 * direction, d]),
    ],
    gold,
  );
  beam(out, 'bronze', wing(0.24, 0.4, 0), wing(0.42, 0.56, 0), 0.11, 0.13, gold);
  for (const s of [-1, 1]) {
    for (let j = 0; j < feathers; j++) {
      const t = j / (feathers - 1),
        root = wing(lerp(-0.16, 0.16, t), 0.22, s * 0.07);
      const tip = wing(lerp(-0.53, -0.28, t), lerp(0.24, 0.47, t), s * lerp(0.26, 0.51, t));
      const end = wing(lerp(-0.51, -0.24, t), lerp(0.19, 0.44, t), s * lerp(0.19, 0.43, t));
      tri(out, 'bronze', root, tip, end, gold);
      tri(out, 'bronze', root, end, tip, gold);
    }
  }
  if (detail > 1) beam(out, 'bronze', wing(-0.18, 0.18, 0), wing(-0.66, 0.37, 0), 0.12, 0.07, gold);
}

function mainHall(out, detail) {
  platform(out, -8.97, 8.97, -17.35, -0.59, 1.08);
  walls(out, detail, -6.92, 6.92, -14.83, -3.3, 1.08, 5.42, { closed: true });
  walls(out, detail, -6.1, 6.1, -13.05, -3.66, 5.8, 8.38, { closed: true, upper: true });
  eaves(out, detail, 0, -8.24, 10.025, 8.24, 5.79, 1.26, 7.6);
  eaves(out, detail, 0, -8.2, 10.04, 7.41, 8.63, 4.7, 5.95, true);
  for (const s of [-1, 1]) phoenix(out, detail, s * 5.51, -8.2, s);
  for (let i = 0; i < (detail === 0 ? 1 : 4); i++)
    box(out, 'stone', -2.65, 2.65, 0.1, 0.22 + i * 0.21, -0.82, 1.08 - i * 0.43, granite);
  const atrium = facade([0, -3.15], [1, 0]);
  fbox(out, 'timber', atrium, -1.55, 1.55, 1.086, 5.18, 0, 0.13, fascia);
  for (const u of [-1.46, 0, 1.46])
    fbox(out, 'timber', atrium, u - 0.065, u + 0.065, 1.08, 5.19, 0.127, 0.19, shadow);
  if (detail > 1) {
    for (let r = 0; r < 5; r++)
      for (let i = 0; i < 8; i++) {
        const u = -1.35 + i * 0.386,
          y = 1.47 + r * 0.54;
        fbox(out, 'bronze', atrium, u - 0.047, u + 0.047, y, y + 0.082, 0.13, 0.171, gold);
      }
  }
}

function wing(out, detail, side) {
  const [d0, d1] = side < 0 ? [-10.35, -3.15] : [-11.23, -4.09];
  const a = Math.min(side * 8.7, side * 19.14),
    b = Math.max(side * 8.7, side * 19.14);
  const center = (d0 + d1) / 2,
    u = side * 21.65,
    forward = side < 0 ? 1.7 : 1.24;
  platform(out, a, b, d0 + 0.12, d1 - 0.12, 0.97);
  platform(out, u - 3.62, u + 3.62, d0 + 0.11, forward - 0.14, 1.03);
  walls(out, detail, a + 0.34, b - 0.34, d0 + 0.85, d1 - 0.8, 0.97, 4.03, {});
  walls(out, detail, u - 2.94, u + 2.94, d0 + 1.35, forward - 1.63, 1.03, 4.13, {});
  walls(out, detail, u - 2.11, u + 2.11, center - 1.45, center + 2.97, 4.83, 7.23, {
    closed: true,
    upper: true,
  });
  eaves(
    out,
    detail,
    (a + b) / 2,
    center,
    (b - a) / 2 + 0.15,
    (d1 - d0) / 2,
    4.24,
    1.36,
    (b - a) / 2 - 0.13,
  );
  eaves(out, detail, u, (d0 + forward) / 2, 3.77, (forward - d0) / 2, 4.4, 1.6, 1.83);
  eaves(out, detail, u, center + 0.58, 3.79, 3.45, 7.47, 1.59, 0.87);
  const finialSides = detail === 0 ? 4 : 8;
  loft(
    out,
    'bronze',
    [
      radialRing(9.12, 0.291, 0.291, finialSides, [u, center + 0.58]),
      radialRing(9.66, 0.021, 0.021, finialSides, [u, center + 0.58]),
    ],
    gold,
  );
}

function rearGallery(out, detail) {
  platform(out, -4.51, 3.76, -36.54, -16.82, 1.12);
  walls(out, detail, -3.42, 2.68, -35.65, -16.93, 1.12, 4.16, {});
  const span = (36.54 - 16.67) / 2;
  const rotate = facade([-0.375, -26.605], [0, -1]);
  const mapped = remap(out, rotate.P);
  eaves(mapped, detail, 0, 0, span, 4.12, 4.36, 2.2, span - 1.48);
}

function bridge(out, detail, { path: [a, b], rise }) {
  const f = wallFace(a, b);
  const n = [4, 6, 10, 14][detail],
    half = 1.04;
  const deck = (t) => 0.18 + rise * Math.sin(t * Math.PI);
  const points = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = f.length * t;
    return [f.P(u, deck(t), half), f.P(u, deck(t), -half)];
  });
  for (let i = 0; i < n; i++) {
    const [a, b] = points[i],
      [c, d] = points[i + 1];
    quad4(out, 'timber', b, a, c, d, i % 3 === 0 ? shadow : red);
  }
  if (detail === 0) return;
  for (const s of [-1, 1]) {
    const p = points.map(([a, b]) => (s < 0 ? b : a));
    beamPath(
      out,
      'timber',
      p.map((v) => [v[0], v[1] - 0.07, v[2]]),
      0.12,
      0.19,
      shadow,
    );
    beamPath(
      out,
      'timber',
      p.map((v) => [v[0], v[1] + 0.71, v[2]]),
      0.109,
      0.14,
      red,
    );
    for (const [i, v] of p.entries())
      if (i % 2 === 0) beam(out, 'timber', v, [v[0], v[1] + 0.74, v[2]], 0.109, 0.109, red);
  }
  for (const t of [0.17, 0.83])
    for (const s of [-1, 1])
      beam(
        out,
        'timber',
        f.P(f.length * t, -1.5, s * 0.74),
        f.P(f.length * t, deck(t) - 0.08, s * 0.74),
        0.21,
        0.21,
        shadow,
      );
}

function remap(out, P) {
  const emit = (method) => (slot, mat, points, normal, uv, color) => {
    const p = points.map((v) => P(...v)),
      origin = P(0, 0, 0);
    const n = P(...normal).map((v, i) => v - origin[i]);
    out[method](
      slot,
      mat,
      p,
      n,
      typeof uv === 'function' ? (_point, i) => uv(points[i], i) : uv,
      color,
    );
  };
  return {
    addTriangle: emit('addTriangle'),
    addQuad: emit('addQuad'),
    addConvexPolygon: emit('addConvexPolygon'),
  };
}

function build(out, detail) {
  const local = remap(out, front.P);
  cap(local, 'stone', site.plan, 0.12, granite);
  mainHall(local, detail);
  for (const s of [-1, 1]) wing(local, detail, s);
  rearGallery(local, detail);
  for (const span of site.bridges) bridge(out, detail, span);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
