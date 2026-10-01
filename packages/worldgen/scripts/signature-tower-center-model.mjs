/** The Center: the eight-corner steel tower, suspended wings and silver pyramid crown. */
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  lerp,
  mappedCap,
  mappedSolid,
  rotatedBuilder,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const silver = [0.65, 0.7, 0.73],
  blue = [0.22, 0.34, 0.43],
  dark = [0.045, 0.071, 0.09],
  stone = [0.52, 0.56, 0.54];
const hx = 21.1,
  hz = 21.43,
  wing = 8.92,
  low = 35.4,
  high = 276.0;
const rect = (a, b, c, d) =>
  clockwise([
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ]);
function cleanPlan(points) {
  const p = points.map((v) => v.slice());
  for (let changed = true; changed && p.length > 3; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (len > 0.001 && area / len < 0.012) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return clockwise(p);
}
const lobbyBounds = [-20, 12.3, -8.5, 29.95];
function clipHalf(plan, axis, value, sign) {
  const result = [];
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      da = (a[axis] - value) * sign,
      db = (b[axis] - value) * sign;
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return result;
}
function galleryCap(out, plan, y, reverse = false) {
  // The tall entrance atrium cuts through both gallery slabs, rather than hiding the escalators inside them.
  for (const ids of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    const t = ids.map((i) => plan[i]);
    const pieces = [clipHalf(t, 0, -20, -1), clipHalf(t, 0, -8.5, 1)];
    const middle = clipHalf(clipHalf(t, 0, -20, 1), 0, -8.5, -1);
    pieces.push(clipHalf(middle, 1, 12.3, -1), clipHalf(middle, 1, 29.95, 1));
    for (const p of pieces)
      if (p.length >= 3) {
        const area = p.reduce(
          (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
          0,
        );
        if (Math.abs(area) > 0.0001) mappedCap(out, 'stone', cleanPlan(p), y, stone, [], reverse);
      }
  }
}
function outsideSegments(a, b) {
  const ts = [0, 1];
  for (const [axis, value] of [
    [0, lobbyBounds[0]],
    [0, lobbyBounds[2]],
    [1, lobbyBounds[1]],
    [1, lobbyBounds[3]],
  ]) {
    if (Math.abs(b[axis] - a[axis]) < 1e-8) continue;
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    if (t > 0 && t < 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const result = [];
  for (let i = 1; i < ts.length; i++) {
    const p = a.map((v, k) => v + (b[k] - v) * ts[i - 1]),
      q = a.map((v, k) => v + (b[k] - v) * ts[i]);
    const x = (p[0] + q[0]) / 2,
      z = (p[1] + q[1]) / 2;
    if (x > -20 && x < -8.5 && z > 12.3 && z < 29.95) continue;
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.02) result.push([p, q]);
  }
  return result;
}
const edges = (p) =>
  p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return {
      length,
      at: (x, y, d = 0) => [a[0] + u[0] * x - u[1] * d, y, a[1] + u[1] * x + u[0] * d],
    };
  });
function patch(out, slot, at, x0, x1, y0, y1, color, d = 0) {
  face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function frameEdge(out, a, b, w = 0.045, color = silver) {
  beam(out, 'metal', a, b, w, w, color);
}
function facade(out, plan, y0, y1, rows, { neon = true, fine = false, skip = [] } = {}) {
  for (const [side, { length, at }] of edges(plan).entries()) {
    if (skip.includes(side)) continue;
    const n = Math.max(1, Math.round(length / 1.43)),
      pitch = length / n,
      dy = (y1 - y0) / rows;
    patch(out, 'recess', at, 0, length, y0, y1, dark, -0.08);
    for (let row = 0; row < rows; row++) {
      const a = y0 + row * dy,
        b = a + dy,
        mechanical = (a >= 141 && a < 149) || (a >= 248 && a < 256);
      const tint = mechanical
        ? [0.075, 0.095, 0.11]
        : blue.map((c) => c * (1 + (((row * 7 + side * 3) % 5) - 2) * 0.012));
      for (let j = 0; j < n; j++) {
        const x = j * pitch,
          xx = x + pitch;
        patch(out, 'glass', at, x + 0.027, xx - 0.027, a + 0.15, b - 0.095, tint);
        patch(out, 'metal', at, x, xx, a, a + 0.145, [0.43, 0.5, 0.54]);
        frameEdge(out, at(x, a, 0.032), at(x, b, 0.032), fine ? 0.032 : 0.04);
      }
      frameEdge(out, at(0, b, 0.055), at(length, b, 0.055), fine ? 0.045 : 0.07);
      if (mechanical)
        for (let y = a + 0.28; y < b - 0.1; y += 0.19)
          frameEdge(out, at(0, y, 0.065), at(length, y, 0.065), 0.032, [0.14, 0.18, 0.2]);
      // Daylight housings of the horizontal neon bands; animated colors are not frozen into the model.
      if (neon && (row > 42 || (row > 24 && row % 2 === 0) || row % 4 === 0)) {
        frameEdge(out, at(0, b - 0.21, 0.12), at(length, b - 0.21, 0.12), 0.055, [0.72, 0.73, 0.7]);
        for (let x = 0.65; x < length; x += 2.9)
          beam(out, 'metal', at(x, b - 0.3, 0.085), at(x, b - 0.14, 0.13), 0.18, 0.045, silver);
      }
    }
    frameEdge(out, at(length, y0, 0.04), at(length, y1, 0.04), 0.075);
  }
}
function trianglePanes(out, vertices, color = blue, { underside = false } = {}) {
  const [a, b, c] = vertices,
    count = Math.max(3, Math.ceil(Math.hypot(...c.map((v, i) => v - a[i])) / 1.5));
  for (let row = 0; row < count; row++) {
    const lo = row / count,
      hi = (row + 1) / count;
    const p = lerp(a, c, lo),
      q = lerp(b, c, lo),
      r = lerp(b, c, hi),
      s = lerp(a, c, hi);
    if (row === count - 1) tri(out, 'glass', underside ? [p, c, q] : [p, q, c], color);
    else face(out, 'glass', underside ? [p, s, r, q] : [p, q, r, s], color);
    frameEdge(out, p, q, 0.043);
  }
  const divisions = Math.max(2, Math.round(Math.hypot(...b.map((v, i) => v - a[i])) / 1.45));
  for (let j = 0; j <= divisions; j++) frameEdge(out, lerp(a, b, j / divisions), c, 0.035);
}
function shoulder(out) {
  // Four triangular additions are hung from the square body; both lower and upper half-pyramids are real void-bounding slopes.
  for (let k = 0; k < 4; k++) {
    const d = k % 2 === 0 ? hz : hx;
    const p = clockwise([
      [-wing, d],
      [0, d + wing],
      [wing, d],
    ]);
    const target = rotatedBuilder(out, (k * Math.PI) / 2);
    facade(target, p, 45.3, 260.8, 55, { skip: [2] });
    const a = [-wing, 260.8, d],
      b = [0, 260.8, d + wing],
      c = [wing, 260.8, d],
      peak = [0, 270, d];
    trianglePanes(target, [a, b, peak]);
    trianglePanes(target, [b, c, peak]);
    const aa = [-wing, 45.3, d],
      bb = [0, 45.3, d + wing],
      cc = [wing, 45.3, d],
      base = [0, low, d];
    trianglePanes(target, [aa, bb, base], [0.2, 0.27, 0.31], { underside: true });
    trianglePanes(target, [bb, cc, base], [0.2, 0.27, 0.31], { underside: true });
    for (const [u, v] of [
      [a, b],
      [b, c],
      [a, peak],
      [b, peak],
      [c, peak],
      [aa, bb],
      [bb, cc],
      [aa, base],
      [bb, base],
      [cc, base],
    ])
      frameEdge(target, u, v, 0.115);
  }
}
function roofStage(out, outer, inner, y0, y1) {
  const a = rect(-outer[0], -outer[1], outer[0], outer[1]),
    b = rect(-inner[0], -inner[1], inner[0], inner[1]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      p = [a[i][0], y0, a[i][1]],
      q = [a[j][0], y0, a[j][1]],
      r = [b[j][0], y1, b[j][1]],
      s = [b[i][0], y1, b[i][1]];
    grid(out, [p, q, r, s], [0.35, 0.48, 0.55], 1.5, 1.15, 0.04, silver);
    frameEdge(out, p, q, 0.12);
    frameEdge(out, q, r, 0.12);
  }
}
function crown(out) {
  roofStage(out, [hx, hz], [13.6, 13.85], high, 282.2);
  const plan = rect(-13.6, -13.85, 13.6, 13.85);
  // Closed sliding BMU doors repeat on each facade; no temporary construction crane is added.
  for (const { length, at } of edges(plan)) {
    const door0 = length * 0.29,
      door1 = length * 0.52;
    for (const [a, b] of [
      [0, door0],
      [door1, length],
    ])
      grid(
        out,
        [at(a, 282.2), at(b, 282.2), at(b, 291), at(a, 291)],
        blue,
        1.4,
        2.2,
        0.055,
        silver,
      );
    patch(out, 'glass', at, door0, door1, 282.2, 291, [0.12, 0.19, 0.24], -0.04);
    for (const x of [door0, (door0 + door1) / 2, door1])
      frameEdge(out, at(x, 282.2, 0.065), at(x, 291, 0.065), 0.085);
    for (const y of [282.2, 290.94]) frameEdge(out, at(door0, y, 0.1), at(door1, y, 0.1), 0.11);
    frameEdge(out, at(0, 282.26, 0.05), at(length, 282.26, 0.05), 0.16);
  }
  roofStage(out, [13.6, 13.85], [0.95, 0.95], 291, 302);
  mappedCap(out, 'metal', rect(-0.95, -0.95, 0.95, 0.95), 302, silver);
  // Central mast, stiffening collar, ladder and two open spoked saucer frames from the original construction close-up.
  loft(
    out,
    'metal',
    [
      radialRing(299, 0.73, 0.73, 40),
      radialRing(312, 0.54, 0.54, 40),
      radialRing(326, 0.36, 0.36, 40),
      radialRing(335, 0.19, 0.19, 40),
      radialRing(346, 0.055, 0.055, 40),
    ],
    [0.81, 0.83, 0.81],
  );
  for (const [cy, r] of [
    [315.8, 3.6],
    [328.8, 2.25],
  ]) {
    torus(out, 'metal', [0, cy, 0], r, 0.105, silver, 72, 10);
    torus(out, 'metal', [0, cy - 0.8, 0], r * 0.91, 0.085, silver, 72, 10);
    for (let k = 0; k < 12; k++) {
      const t = (k * Math.PI) / 6,
        p = [Math.cos(t) * r, cy, Math.sin(t) * r];
      frameEdge(out, [0, cy - 6.8, 0], p, 0.08);
      frameEdge(out, p, [Math.cos(t) * r * 0.91, cy - 0.8, Math.sin(t) * r * 0.91], 0.06);
      frameEdge(out, [0, cy, 0], p, 0.075);
    }
    // The broad curved collars are a thin metal shell, open around the central mast.
    const outer = radialRing(cy, r, r, 72),
      inner = radialRing(cy + 1.1, 0.56, 0.56, 72);
    loft(out, 'metal', [outer, inner], [0.75, 0.78, 0.77], { cap: false });
    const down = (r) => r.map((p) => [p[0], p[1] - 0.065, p[2]]);
    loft(out, 'metal', [down(inner), down(outer)], [0.64, 0.69, 0.69], { cap: false });
    loft(out, 'metal', [down(outer), outer], silver, { cap: false });
    loft(out, 'metal', [inner, down(inner)], silver, { cap: false });
  }
  for (const z of [0.76, 1.16]) frameEdge(out, [-0.32, 302, z], [-0.32, 334, z], 0.045);
  for (let y = 302.25; y < 334; y += 0.32)
    frameEdge(out, [-0.32, y, 0.76], [-0.32, y, 1.16], 0.035);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    frameEdge(
      out,
      [Math.cos(a) * 2.6, 329.8, Math.sin(a) * 2.6],
      [Math.cos(a) * 0.34, 334.5, Math.sin(a) * 0.34],
      0.06,
    );
  }
}
function pool(out, x, z) {
  const p = rect(x - 3.4, z - 3.4, x + 3.4, z + 3.4);
  mappedSolid(out, 'stone', p, 0.18, 0.52, [0.19, 0.24, 0.23]);
  mappedCap(out, 'glass', rect(x - 3.14, z - 3.14, x + 3.14, z + 3.14), 0.55, [0.12, 0.3, 0.29]);
  for (const { length, at } of edges(p))
    beam(out, 'stone', at(0, 0.66), at(length, 0.66), 0.34, 0.3, stone);
}
function bamboo(out, x, z, seed) {
  for (let k = 0; k < 7; k++) {
    const a = k * 2.399 + seed,
      h = 7.8 + (k % 4) * 0.68,
      xx = x + Math.cos(a) * 0.46,
      zz = z + Math.sin(a) * 0.46;
    loft(
      out,
      'wood',
      [radialRing(0.65, 0.045, 0.045, 8, [xx, zz]), radialRing(h, 0.03, 0.03, 8, [xx + 0.12, zz])],
      [0.27, 0.38, 0.17],
    );
    for (let y = 1.2; y < h; y += 0.45)
      torus(out, 'wood', [xx + (0.12 * y) / h, y, zz], 0.046, 0.011, [0.42, 0.46, 0.2], 10, 4);
    for (let j = 0; j < 6; j++) {
      const t = j * 2.2 + a,
        base = [xx + 0.1, h - 2 + j * 0.24, zz],
        end = [xx + Math.cos(t) * 1.15, h - 1.8 + j * 0.24, zz + Math.sin(t) * 1.15];
      frameEdge(out, base, end, 0.015, [0.23, 0.32, 0.15]);
      for (let i = 1; i < 6; i++) {
        const p = lerp(base, end, i / 6),
          q = [p[0] + Math.sin(t) * 0.22, p[1] + 0.12, p[2] - Math.cos(t) * 0.22],
          r = [p[0] + Math.cos(t) * 0.44, p[1] - 0.12, p[2] + Math.sin(t) * 0.44];
        tri(out, 'foliage', [p, q, r], [0.13, 0.3, 0.12]);
        tri(out, 'foliage', [r, q, p], [0.16, 0.32, 0.14]);
      }
    }
  }
}
function base(out, m) {
  // Ground columns are distinct from the projected star skin and retain the public space below the tower.
  const footprint = rect(-31, -31, 31, 31);
  mappedSolid(out, 'stone', footprint, 0, 0.2, stone);
  for (const x of [-18, 18])
    for (const z of [-18, 18]) {
      pool(out, x, z);
      const p = rect(x - 2, z - 2, x + 2, z + 2);
      mappedSolid(out, 'metal', p, 0.25, low, [0.58, 0.67, 0.68]);
      for (const { length, at } of edges(p)) {
        for (let y = 0.8; y < low; y += 1.35)
          frameEdge(out, at(0, y, 0.014), at(length, y, 0.014), 0.035, [0.29, 0.35, 0.37]);
        frameEdge(out, at(length / 2, 0.3, 0.015), at(length / 2, low, 0.015), 0.04);
      }
    }
  for (let k = 0; k < 4; k++) {
    const t = rotatedBuilder(out, (k * Math.PI) / 2);
    beam(t, 'metal', [-18, 8, 18], [18, 27, 18], 1.15, 1.5, [0.54, 0.62, 0.65]);
    beam(t, 'metal', [18, 8, 18], [-18, 27, 18], 1.15, 1.5, [0.54, 0.62, 0.65]);
    beam(t, 'metal', [-18, 27, 18], [18, 27, 18], 1.2, 1.5, silver);
  }
  const lower = rect(-hx, -hz, hx, hz);
  mappedSolid(out, 'metal', lower, 26.7, 27.25, [0.28, 0.35, 0.39]);
  facade(out, lower, 27.25, low, 2, { fine: true });
  mappedCap(out, 'metal', lower, low, silver);
  // Compact central lift enclosure; perimeter braces and reflecting ponds remain exposed.
  const core = rect(-8.8, -8.8, 8.8, 8.8);
  facade(out, core, 0.2, 26.7, 6, { fine: true, neon: false });
  mappedCap(out, 'metal', lower, low, [0.39, 0.47, 0.51], [], true);

  const gallery = cleanPlan(m.geometry.parts.find((p) => p.id === 148461575).outline.slice(0, -1));
  // Low mapped gallery is a C-shaped strip: do not fill the courtyard enclosed by its inner curve.
  mappedSolid(out, 'stone', gallery, 0, 0.22, stone);
  for (const [bottom, top] of [
    [5.5, 6],
    [11, 11.3],
  ]) {
    galleryCap(out, gallery, bottom, true);
    galleryCap(out, gallery, top);
  }
  for (let i = 0; i < gallery.length; i++)
    for (const [a, b] of outsideSegments(gallery[i], gallery[(i + 1) % gallery.length])) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      const p = [
        a,
        b,
        [b[0] - n[0] * 0.04, b[1] - n[1] * 0.04],
        [a[0] - n[0] * 0.04, a[1] - n[1] * 0.04],
      ];
      facade(out, p, 6, 11, 2, { fine: true, neon: false, skip: [1, 2, 3] });
      const { at } = edges(p)[0];
      for (const [bottom, top] of [
        [5.5, 6],
        [11, 11.3],
      ])
        patch(out, 'stone', at, 0, len, bottom, top, stone);
      frameEdge(out, at(0, 12.35), at(len, 12.35), 0.055);
      for (let x = 0.1; x < len; x += 1.45) frameEdge(out, at(x, 11.3), at(x, 12.35), 0.045);
      for (let x = 0.7; x < len - 0.5; x += 5)
        beam(out, 'metal', at(x, 0, -0.38), at(x, 5.6, -0.38), 0.42, 0.42, silver);
    }
  // The mapped SW entrance is offset west of the tower's front point.
  const lobby = rect(-20, 12.3, -8.5, 29.95);
  const transparent = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    transparent[method] = (slot, ...args) =>
      out[method](slot === 'glass' ? 'clear_glass' : slot, ...args);
  for (const { length, at } of edges(lobby))
    grid(
      transparent,
      [at(0, 0.22), at(length, 0.22), at(length, 14.5), at(0, 14.5)],
      [0.52, 0.69, 0.71],
      1.45,
      2.25,
      0.065,
      silver,
    );
  grid(
    transparent,
    [
      [-20, 14.5, 29.95],
      [-8.5, 14.5, 29.95],
      [-8.5, 19.7, 12.3],
      [-20, 19.7, 12.3],
    ],
    [0.55, 0.68, 0.71],
    1.4,
    1.5,
    0.075,
    silver,
  );
  // Sloped atrium roof has glazed side triangles and a taller rear closing panel.
  for (const x of [-20, -8.5]) {
    const p = [
      [x, 14.5, 29.95],
      [x, 14.5, 12.3],
      [x, 19.7, 12.3],
    ];
    trianglePanes(transparent, x === -20 ? p : p.toReversed(), [0.55, 0.68, 0.71]);
  }
  grid(
    transparent,
    [
      [-8.5, 14.5, 12.3],
      [-20, 14.5, 12.3],
      [-20, 19.7, 12.3],
      [-8.5, 19.7, 12.3],
    ],
    [0.55, 0.68, 0.71],
    1.4,
    1.3,
    0.055,
    silver,
  );
  // Twin escalator runs are visible through the glazed entrance atrium.
  for (const x of [-17.0, -13.5]) {
    beam(out, 'metal', [x, 0.6, 28.3], [x, 11.5, 12.8], 1.75, 0.75, [0.28, 0.33, 0.34]);
    for (let k = 0; k < 41; k++) {
      const t = k / 41,
        y = 0.55 + t * 10.85,
        z = 28.25 - t * 15.4;
      box(
        out,
        'recess',
        [x - 0.71, y - 0.1, z - 0.22],
        [x + 0.71, y + 0.05, z + 0.22],
        [0.12, 0.14, 0.15],
      );
    }
    for (const s of [-1, 1])
      beam(
        out,
        'metal',
        [x + s * 0.9, 1.6, 28.3],
        [x + s * 0.9, 12.5, 12.8],
        0.07,
        0.07,
        [0.18, 0.22, 0.24],
      );
  }
  // Framed entry doors sit on the documented main entrance; no invented tenant signs.
  for (const x of [-16.1, -14.45, -12.8, -11.15]) {
    box(out, 'metal', [x - 0.035, 0.22, 30.015], [x + 0.035, 2.85, 30.09], silver);
    face(
      out,
      'clear_glass',
      [
        [x, 0.26, 30.04],
        [x + 1.55, 0.26, 30.04],
        [x + 1.55, 2.8, 30.04],
        [x, 2.8, 30.04],
      ],
      [0.65, 0.78, 0.77],
    );
  }
  box(out, 'metal', [-16.15, 2.85, 29.94], [-9.45, 3.0, 30.1], silver);
  // Slender bamboo gardens rather than arbitrary trees across the street entrances.
  for (const [x, z, n] of [
    [-25, -4, 5],
    [25, 1, 4],
    [5, 25, 5],
    [3, -25, 4],
  ]) {
    box(out, 'stone', [x - 1.4, 0.22, z - 1.7], [x + 1.4, 0.6, z + 1.7], stone);
    for (let i = 0; i < n; i++)
      bamboo(out, x + ((i % 2) - 0.5) * 1.2, z + (Math.floor(i / 2) - 1) * 1.0, i);
  }
  // Forecourt stairs and roof-garden benches remain within the tower's owned gallery strip.
  for (let k = 0; k < 4; k++)
    box(
      out,
      'stone',
      [-20, 0.0, 30.1 + k * 0.36],
      [-8.1, 0.22 - 0.045 * k, 30.1 + (k + 1) * 0.36],
      stone,
    );
  for (const [x, z] of [
    [-43, -15],
    [-44, 4],
    [38, -12],
    [31, -28],
  ]) {
    box(out, 'stone', [x - 2, 11.3, z - 0.5], [x + 2, 11.8, z + 0.5], [0.51, 0.57, 0.54]);
    box(out, 'wood', [x - 2.1, 11.8, z - 0.56], [x + 2.1, 11.92, z + 0.56], [0.32, 0.26, 0.16]);
    box(out, 'stone', [x - 2, 11.3, z + 1.2], [x + 2, 11.95, z + 3.1], stone);
    for (let j = 0; j < 3; j++) {
      const t = rotatedBuilder(out, 0, [x - 1.2 + j * 1.2, 11.35, z + 2.1]);
      // Short bamboo shoots on the gallery roof contrast with the tall ground-level groves.
      for (let k = 0; k < 8; k++) {
        const a = k * 2.399,
          p = [Math.cos(a) * 0.32, 0.6, Math.sin(a) * 0.32],
          q = [Math.cos(a) * 0.6, 1.7 + (k % 3) * 0.23, Math.sin(a) * 0.6];
        beam(t, 'wood', p, q, 0.025, 0.025, [0.22, 0.34, 0.13]);
        for (let h = 0; h < 3; h++) {
          const c = lerp(p, q, 0.45 + h * 0.17),
            u = [c[0] + Math.sin(a) * 0.26, c[1] + 0.14, c[2] - Math.cos(a) * 0.26],
            v = [c[0] + Math.cos(a) * 0.35, c[1] - 0.05, c[2] + Math.sin(a) * 0.35];
          tri(t, 'foliage', [c, u, v], [0.18, 0.34, 0.14]);
          tri(t, 'foliage', [v, u, c], [0.16, 0.3, 0.12]);
        }
      }
    }
  }
}
function buildCenter(out, m) {
  base(out, m);
  const main = rect(-hx, -hz, hx, hz);
  facade(out, main, low, high, 61);
  shoulder(out);
  crown(out);
}
export const centerStudy = {
  id: 'N0206',
  key: 'the_center',
  title: 'The Center',
  wikidataId: 'Q130478',
  height: 346,
  mapFrame: 'map-frame.json',
  build: buildCenter,
  brief:
    'Hong Kong’s silver-blue eight-pointed steel tower: four suspended triangular wings with paired half-pyramid terminations, two refuge bands, stepped glass crown and open spoked mast, above exposed braced columns, pools and a mapped curving retail gallery.',
  sourceFacts: {
    architect: 'Dennis Lau & Ng Chun Man (DLN)',
    completed: 1998,
    heightMeters: 346,
    occupiedHeightMeters: 275,
    physicalFloors: 73,
    typicalFloorAreaSquareMeters: 2070,
    steelFrame: true,
    plan: 'Two square systems at45degrees; four projecting triangular wings',
    publicBase:
      'Elevated superstructure and retail gallery; four principal columns standing in reflecting pools',
  },
  reconstruction: {
    geometry:
      'DLN’s floorplan and original construction elevation govern the star, four half-pyramids, stepped cleaning floor and exposed mast. Independently mapped tower, gallery, roof facets and SW entrance retain their signed positions. Lower and upper face datums follow the published elevation proportions inside the confirmed346m tip and275m occupied datum; coarse map roof heights are checks, not a survey.',
    facade:
      'Silver-blue unitized panes, fine transoms, physical neon housings, dark refuge/louver bands, BMU sliding panels and broad sloping roof panes. Open spoked mast collars and its ladder are based on the construction photographer’s close-up. Ground columns, X braces, pools, atrium/escalators and bamboo retain public permeability.',
  },
  refs: [
    'https://www.building.com.hk/comprofile/20120504dln.pdf',
    'https://www.building.hk/photoessay/center/crfront.html',
    'https://www.building.hk/photoessay/center/photos/crinside16.html',
    'https://www.building.hk/photoessay/center/photos/crinside20.html',
    'https://www.building.hk/photoessay/center/photos/crinside13.html',
    'https://www.building.hk/photoessay/center/photos/crinside14.html',
    'https://www.building.hk/photoessay/center/photos/crinside18.html',
    'https://www.polyucee.hk/cecspoon/lwbt/Guide_Book/Guide_Book_01/Chapter_4b.pdf',
    'https://www.skyscrapercenter.com/building/building/343',
    'https://www.e-architect.com/hong-kong/center-skyscraper-hong-kong',
    'https://www.openstreetmap.org/way/148228888',
    'https://www.openstreetmap.org/way/148461575',
  ],
  nativeAxes: {
    up: '+Y',
    front: '+Z southwest toward Queen’s Road',
    longAxis: '+X southeast along the main frontage',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact star center is independent of the irregular low gallery. Native+Z faces213.31degrees toward Queen’s Road; the mapped main entrance lies at[-12.84,+29.96]m. Four lower wing voids and the C-shaped retail gallery are retained. All ground-contact columns/paving useY0; published facade and roof photographs corroborate the signed plan phase.',
  }),
  limitations: [
    commonLimit,
    'The346m tip and275m occupied height are published. Intermediate floor/roof datums, individual pane schedules, neon housing spacing, mast collar dimensions and atrium fit-out are reconstructed from primary exterior/elevation images. Map height tags are coarse. Operational gondolas, programmed night-light colors, tenant signs, hidden steel core and neighboring buildings are excluded.',
  ],
  camera: { position: [168, 179, 286], lookAt: [0, 159, 0], fov: 43 },
  qaCameras: [
    { name: 'queens-road', position: [75, 68, 136], lookAt: [-8, 57, 0] },
    { name: 'star-and-crown', position: [126, 312, 147], lookAt: [0, 270, 0] },
    { name: 'silver-curtain', position: [43, 125, 45], lookAt: [17, 118, 21] },
    { name: 'suspended-half-pyramid', position: [42, 31, 54], lookAt: [0, 44, 28] },
    { name: 'upper-half-pyramid', position: [41, 268, 59], lookAt: [0, 263, 27] },
    { name: 'bmu-doors', position: [34, 293, 47], lookAt: [-3, 287, 13.8] },
    { name: 'spoked-mast', position: [23, 323, 33], lookAt: [0, 322, 0] },
    { name: 'open-column-base', position: [40, 8, 45], lookAt: [5, 13, 14] },
    { name: 'entrance-and-escalators', position: [-28, 10, 49], lookAt: [-14, 8, 21] },
    { name: 'gallery-garden', position: [-69, 24, 24], lookAt: [-27, 8, -3] },
    { name: 'roof-gallery', position: [67, 57, -85], lookAt: [8, 10, -19] },
    { name: 'far-tower', position: [348, 260, 472], lookAt: [0, 156, 0] },
  ],
};
