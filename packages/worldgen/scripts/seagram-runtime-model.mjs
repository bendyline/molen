/** Independent browser tiers; the detailed Seagram recipe remains unchanged. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { clockwise, face, mappedCap, mappedSolid } from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const bay = 8.4582,
  module = 1.4097,
  column = 0.9144;
const halfX = (5 * bay + column) / 2,
  halfZ = (3 * bay + column) / 2;
const podium = 1.8,
  officeBase = 9.1,
  officeTop = 143.15,
  roof = 157;
const bronze = [0.15, 0.118, 0.074],
  glass = [0.27, 0.23, 0.205],
  granite = [0.68, 0.58, 0.53];
const rect = (x0, z0, x1, z1) =>
  clockwise([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
const main = clockwise([
  [-halfX, halfZ],
  [halfX, halfZ],
  [halfX, -halfZ],
  [1.5 * bay + column / 2, -halfZ],
  [1.5 * bay + column / 2, -halfZ - bay],
  [-1.5 * bay - column / 2, -halfZ - bay],
  [-1.5 * bay - column / 2, -halfZ],
  [-halfX, -halfZ],
]);
function edges(p) {
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], u[0]];
    return {
      len,
      at: (x, y, d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[1] * d],
    };
  });
}
function patch(out, slot, at, x0, x1, y0, y1, color, d = 0) {
  face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function solidPatch(out, at, x0, x1, y0, y1, d0, d1) {
  const a = [at(x0, y0, d1), at(x1, y0, d1), at(x1, y1, d1), at(x0, y1, d1)],
    b = [at(x0, y0, d0), at(x1, y0, d0), at(x1, y1, d0), at(x0, y1, d0)];
  face(out, 'bronze', a, bronze);
  face(out, 'bronze', b.toReversed(), bronze);
  for (let i = 0; i < 4; i++)
    face(out, 'bronze', [a[i], b[i], b[(i + 1) % 4], a[(i + 1) % 4]], bronze);
}
function curtain(out, plan, y0, y1, rows, detail, crown = false) {
  for (const [side, { len, at }] of edges(plan).entries()) {
    // Opaque continuous enclosure, without invisible rear blind slats or overlapping layers.
    patch(out, crown ? 'bronze' : 'glass', at, 0, len, y0, y1, crown ? bronze : glass);
    if (!detail.modules) continue;
    const n = Math.max(1, Math.round((len - column) / (module * detail.modules))),
      pitch = (len - column) / n;
    for (let i = 0; i <= n; i++) {
      const x = column / 2 + i * pitch;
      if (detail.iSections) {
        solidPatch(out, at, x - 0.05715, x + 0.05715, y0, y1, 0.012, 0.026);
        solidPatch(out, at, x - 0.00635, x + 0.00635, y0, y1, 0.026, 0.15);
        solidPatch(out, at, x - 0.05715, x + 0.05715, y0, y1, 0.15, 0.1644);
      } else patch(out, 'bronze', at, x - 0.065, x + 0.065, y0, y1, bronze, 0.04);
    }
    const count = crown
      ? Math.ceil((y1 - y0) / (detail.crownPitch ?? 1.1))
      : Math.max(1, Math.ceil(rows / detail.rowGroup));
    const dy = (y1 - y0) / count;
    for (let row = 0; row < count; row++) {
      const y = y0 + row * dy;
      patch(out, 'bronze', at, 0, len, y, Math.min(y1, y + (crown ? 0.075 : 0.81)), bronze, 0.025);
      if (!crown && detail.blinds)
        for (let i = 0; i < n; i++) {
          const state =
            (side * 503 + row * 37 + i) * 17 + Math.floor((side * 503 + row * 37 + i) / 7) * 3;
          const stop = state % 7 < 3 ? 0 : state % 7 < 6 ? 0.5 : 1;
          if (!stop) continue;
          patch(
            out,
            'glass',
            at,
            column / 2 + i * pitch + 0.06,
            column / 2 + (i + 1) * pitch - 0.06,
            y + dy - (dy - 0.9) * stop,
            y + dy - 0.04,
            [0.36, 0.32, 0.26],
            0.01,
          );
        }
    }
  }
}
function roofCap(out, plan, y) {
  mappedCap(out, 'stone', plan, y, [0.36, 0.35, 0.32]);
  for (const { len, at } of edges(plan))
    patch(out, 'bronze', at, 0, len, y - 0.24, y, bronze, 0.025);
}
function terrace(out, plan, y, detail) {
  roofCap(out, plan, y);
  if (!detail.rails) return;
  for (const { len, at } of edges(plan)) {
    beam(out, 'bronze', at(0, y + 0.95), at(len, y + 0.95), 0.045, 0.045, bronze);
    for (let x = 0.1; x < len; x += detail.railPitch)
      beam(out, 'bronze', at(x, y), at(x, y + 0.95), 0.035, 0.035, bronze);
    for (let x = 1.4; x < len - 1.2; x += 5.4) {
      const p = at(x, y + 0.24, -0.6);
      sphere(out, 'foliage', p, [0.8, 0.35, 0.6], [0.19, 0.29, 0.1], detail.sides, 4);
    }
  }
}
function plaza(out, detail) {
  box(out, 'stone', [-30.48, 0, -13.4], [30.48, 1.12, 43.64], granite);
  const xs = [-30.48, -28.9, -15.1, 15.1, 28.9, 30.48],
    zs = [-13.4, 24, 42.1, 43.64];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      if (j === 1 && (i === 1 || i === 3)) continue;
      box(out, 'stone', [xs[i], 1.12, zs[j]], [xs[i + 1], podium, zs[j + 1]], granite);
    }
  for (const [x0, x1] of [
    [-28.9, -15.1],
    [15.1, 28.9],
  ]) {
    mappedCap(out, 'glass', rect(x0 + 0.05, 24.05, x1 - 0.05, 42.05), 1.43, [0.18, 0.32, 0.34]);
    if (detail.poolRims)
      for (const { len, at } of edges(rect(x0, 24, x1, 42.1)))
        beam(out, 'stone', at(0, 1.65), at(len, 1.65), 0.12, 0.12, granite);
  }
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      [-14.8, podium - (i + 1) * 0.18, 43.64 + i * 0.32],
      [14.8, podium - i * 0.18, 43.96 + i * 0.32],
      granite,
    );
  box(out, 'stone', [-30.48, 0, 44.6], [30.48, 1.26, 46.8], granite);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -30.1 : 22.25,
      x1 = side < 0 ? -22.25 : 30.1;
    box(out, 'stone', [x0, 0, -12.8], [x1, podium + 0.38, 18.5], granite);
    mappedCap(
      out,
      'foliage',
      rect(x0 + 0.25, -12.55, x1 - 0.25, 18.25),
      podium + 0.39,
      [0.12, 0.21, 0.065],
    );
    if (detail.trees)
      for (let z = -8.5; z < 17; z += 7.2) {
        const x = (x0 + x1) / 2;
        loft(
          out,
          'foliage',
          [
            radialRing(podium + 0.4, 0.15, 0.15, 6, [x, z]),
            radialRing(podium + 4.5, 0.09, 0.09, 6, [x, z]),
          ],
          [0.25, 0.2, 0.14],
        );
        sphere(
          out,
          'foliage',
          [x, podium + 4.7, z],
          [2.1, 2.2, 2],
          [0.22, 0.32, 0.12],
          detail.sides,
          5,
        );
      }
    const steps = detail.steps ? 9 : 1;
    for (let i = 0; i < steps; i++) {
      const f = 9 / steps,
        z = -13.2 - i * f * 0.28,
        y = podium - (i + 1) * f * 0.18;
      box(
        out,
        'stone',
        [x0, Math.max(0, y - 0.18 * f), z - 0.28 * f],
        [x1, Math.max(0.02, y + 0.18 * (f - 1)), z],
        granite,
      );
    }
    if (detail.rails)
      for (const x of [x0 + 0.9, x1 - 0.9]) {
        beam(out, 'bronze', [x, podium + 1, -13.15], [x, 1, -16.02], 0.045, 0.045, bronze);
        for (let i = 0; i <= 5; i++) {
          const z = -13.15 - i * 0.574,
            y = Math.max(0, podium - i * 0.36);
          beam(out, 'bronze', [x, y, z], [x, y + 1, z], 0.045, 0.045, bronze);
        }
      }
  }
}
function lobby(out, detail) {
  for (let i = 0; i <= 5; i++)
    for (const z of [-halfZ + 0.46, halfZ - 0.46]) {
      const x = -2.5 * bay + i * bay;
      box(
        out,
        'bronze',
        [x - column / 2, podium, z - column / 2],
        [x + column / 2, officeBase, z + column / 2],
        bronze,
      );
    }
  for (const side of [-1, 1])
    for (let i = 1; i < 3; i++) {
      const z = -1.5 * bay + i * bay,
        x = side * (halfX - 0.46);
      box(
        out,
        'bronze',
        [x - column / 2, podium, z - column / 2],
        [x + column / 2, officeBase, z + column / 2],
        bronze,
      );
    }
  box(out, 'bronze', [-halfX, officeBase - 0.34, -halfZ], [halfX, officeBase, halfZ], bronze);
  const front = halfZ - 2.8,
    plan = rect(-bay * 1.5, -halfZ - 0.5, bay * 1.5, front);
  for (const { len, at } of edges(plan)) {
    patch(out, 'glass', at, 0, len, podium, officeBase - 0.4, [0.42, 0.4, 0.35]);
    if (detail.modules)
      for (let x = 0; x < len; x += 2.8 * detail.modules)
        patch(out, 'bronze', at, x, x + 0.07, podium, officeBase - 0.4, bronze, 0.025);
  }
  box(out, 'bronze', [-13.2, 6.45, front - 0.4], [13.2, 6.72, halfZ + 3], bronze);
  if (detail.doors)
    for (const x of [-bay, 0, bay]) {
      // Aggregated revolving-door cases remain separate from the opaque lobby wall.
      const z = front + 0.7;
      loft(
        out,
        'bronze',
        [
          radialRing(podium + 2.65, 1.11, 1.11, detail.sides, [x, z]),
          radialRing(podium + 2.78, 1.11, 1.11, detail.sides, [x, z]),
        ],
        bronze,
      );
      for (let k = 0; k < detail.sides; k++) {
        const a = (k * Math.PI * 2) / detail.sides,
          b = ((k + 1) * Math.PI * 2) / detail.sides;
        face(
          out,
          'glass',
          [
            [x + Math.cos(a), podium, z + Math.sin(a)],
            [x + Math.cos(b), podium, z + Math.sin(b)],
            [x + Math.cos(b), podium + 2.65, z + Math.sin(b)],
            [x + Math.cos(a), podium + 2.65, z + Math.sin(a)],
          ],
          [0.42, 0.4, 0.35],
        );
      }
    }
}
function build(out, detail) {
  plaza(out, detail);
  lobby(out, detail);
  curtain(out, main, officeBase, officeTop, 37, detail);
  curtain(out, main, officeTop, roof, 1, detail, true);
  roofCap(out, main, roof);
  for (const plan of [rect(-29.85, -48.2, -13.15, -21.55), rect(13.15, -47.8, 29.85, -21.55)]) {
    mappedSolid(out, 'stone', plan, 0, podium, granite);
    curtain(out, plan, podium, 20.1, 5, detail);
    terrace(out, plan, 20.1, detail);
  }
  const bustle = rect(-13.15, -48.2, 13.15, -21.55);
  mappedSolid(out, 'stone', bustle, 0, podium, granite);
  curtain(out, bustle, podium, 39.6, 10, detail);
  terrace(out, bustle, 39.6, detail);
}
export const buildSeagramSkyline = (out) => build(out, { sides: 6, modules: 0 });
export const buildSeagramDistrict = (out) =>
  build(out, { sides: 6, modules: 4, rowGroup: 3, trees: true, crownPitch: 3.5 });
export const buildSeagramStreet = (out) =>
  build(out, {
    sides: 8,
    modules: 2,
    rowGroup: 1,
    trees: true,
    rails: true,
    railPitch: 5.64,
    steps: true,
    poolRims: true,
    doors: true,
    crownPitch: 1.1,
  });
export const buildSeagramCloseup = (out) =>
  build(out, {
    sides: 12,
    modules: 1,
    rowGroup: 1,
    iSections: true,
    blinds: true,
    trees: true,
    rails: true,
    railPitch: 1.41,
    steps: true,
    poolRims: true,
    doors: true,
    crownPitch: 0.44,
  });
