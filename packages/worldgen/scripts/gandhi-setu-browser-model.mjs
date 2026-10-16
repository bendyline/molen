/** Compact twin steel crossings, independent of the retained detailed I-section/hardware master. */
import './install-deterministic-math.mjs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const spans = [65.53, ...Array(45).fill(121.065), 65.53],
  length = spans.reduce((a, b) => a + b, 0),
  half = length / 2,
  stations = [-half],
  MEANS = {
    iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    road: [1, 1, 1],
    marking: [1, 1, 1],
  };
for (const n of spans) stations.push(stations.at(-1) + n);
const deck = (x) => 23.5 + 0.22 * Math.cos((x / half) * Math.PI),
  paint = [0.62, 0.66, 0.67],
  concrete = [0.52, 0.49, 0.43],
  asphalt = [0.12, 0.125, 0.125];
function writer(destination, far) {
  function emit(slot, ref, p, hint, _uv, color) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        a = cross(
          t[1].map((v, j) => v - t[0][j]),
          t[2].map((v, j) => v - t[0][j]),
        );
      if (Math.hypot(...a) < 1e-10) continue;
      let n = normalFor(...t);
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[1]]),
        far ? color.map((v, j) => v * (MEANS[slot]?.[j] ?? 1)) : color,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function ribbon(o, slot, a, b, width, color) {
  const d = b.map((v, i) => v - a[i]),
    l = Math.hypot(d[0], d[1]);
  if (l < 0.001) return;
  const p = [((-d[1] / l) * width) / 2, ((d[0] / l) * width) / 2, 0],
    q = [
      a.map((v, i) => v - p[i]),
      b.map((v, i) => v - p[i]),
      b.map((v, i) => v + p[i]),
      a.map((v, i) => v + p[i]),
    ];
  o.addQuad(slot, 'palette:#ffffff', q, [0, 0, 1], null, color);
  o.addQuad(slot, 'palette:#ffffff', q.toReversed(), [0, 0, -1], null, color);
}
function simplePier(o, x, lo, far, z = 0) {
  const top = deck(x) - 0.95;
  if (far) {
    ribbon(o, 'concrete', [x, lo, -5], [x, top, -5], 5.6, concrete);
    ribbon(o, 'concrete', [x, lo, 5], [x, top, 5], 5.6, concrete);
  } else box(o, 'concrete', [x - 2.8, lo, z - 3.85], [x + 2.8, top, z + 3.85], concrete);
}
function build(destination, detail) {
  const o = writer(destination, detail === 0),
    sky = detail === 0,
    district = detail === 1;
  if (sky) {
    box(o, 'road', [-half, 23.1, -9.8], [half, 23.5, 9.8], asphalt);
    for (let i = 1; i < stations.length - 1; i++) {
      const x = stations[i],
        lo = i < 11 ? 0 : i < 21 ? 4 : 10;
      ribbon(o, 'concrete', [x, lo, 0], [x, deck(x) - 0.95, 0], 5.6, concrete);
    }
    for (const z of [-10.4, 10.4]) {
      ribbon(o, 'iron', [-half, deck(-half), z], [half, deck(half), z], 0.8, paint);
      ribbon(
        o,
        'iron',
        [-half + 65.53, deck(-half + 65.53) + 9.4, z],
        [half - 65.53, deck(half - 65.53) + 9.4, z],
        0.8,
        paint,
      );
      for (let i = 0; i < spans.length; i++) {
        const a = stations[i],
          b = stations[i + 1],
          m = (a + b) / 2,
          rise = i > 0 && i < 46 ? 9.3 : 4.6;
        ribbon(o, 'iron', [a, deck(a), z], [m, deck(m) + rise, z], 0.6, paint);
        ribbon(o, 'iron', [m, deck(m) + rise, z], [b, deck(b), z], 0.6, paint);
      }
    }
    return;
  }
  for (let i = 1; i < stations.length - 1; i++) {
    const lo = i < 11 ? 0 : i < 21 ? 4 : 10;
    if (sky) simplePier(o, stations[i], lo, true);
    else
      for (const z of [-5.8, 5.8]) {
        simplePier(o, stations[i], lo, false, z);
        if (detail >= 3) {
          box(
            o,
            'concrete',
            [stations[i] - 3.1, lo, z - 4.1],
            [stations[i] + 3.1, lo + 0.5, z + 4.1],
            concrete,
          );
          box(
            o,
            'concrete',
            [stations[i] - 2.65, deck(stations[i]) - 1.65, z - 4.75],
            [stations[i] + 2.65, deck(stations[i]) - 0.95, z + 4.75],
            concrete,
          );
        }
      }
  }
  for (let i = 0; i < spans.length; i++) {
    const a = stations[i],
      b = stations[i + 1],
      full = i > 0 && i < 46,
      rise = full ? 9.3 : 4.6,
      bays = district ? 2 : detail === 2 ? 2 : full ? 16 : 8,
      step = (b - a) / bays,
      originalStep = (b - a) / (full ? 16 : 8);
    for (const z of [-5.8, 5.8]) {
      box(o, 'road', [a + 0.14, deck(a) - 0.38, z - 4], [b - 0.14, deck(b), z + 4], asphalt);
      const sides = sky || district ? [Math.sign(z)] : [-1, 1];
      for (const side of sides) {
        const zz = z + side * 4.6,
          topA = [a + originalStep, deck(a) + 0.1 + rise, zz],
          topB = [b - originalStep, deck(b) + 0.1 + rise, zz],
          lowA = [a + 0.3, deck(a) + 0.1, zz],
          lowB = [b - 0.3, deck(b) + 0.1, zz];
        if (sky || district) {
          ribbon(o, 'iron', lowA, lowB, 0.72, paint);
          ribbon(o, 'iron', topA, topB, 0.72, paint);
        } else {
          beam(o, 'iron', lowA, lowB, 0.58, 0.72, paint);
          beam(o, 'iron', topA, topB, 0.58, 0.72, paint);
        }
        for (let j = 0; j < bays; j++) {
          const x = a + j * step,
            nx = a + (j + 1) * step,
            p = [x, deck(x) + 0.1 + (j % 2 ? rise : 0), zz],
            q = [nx, deck(nx) + 0.1 + (j % 2 ? 0 : rise), zz];
          if (sky || district) ribbon(o, 'iron', p, q, 0.65, paint);
          else beam(o, 'iron', p, q, 0.46, 0.53, paint);
        }
      }
      if (detail >= 2) {
        const roofBays = detail >= 3 ? 4 : 1;
        for (let j = 0; j < roofBays; j++) {
          const x = a + (j * (b - a)) / roofBays,
            nx = a + ((j + 1) * (b - a)) / roofBays;
          if (full)
            for (const s of [-1, 1])
              beam(
                o,
                'iron',
                [x, deck(x) + 0.1 + rise, z + s * 4.6],
                [nx, deck(nx) + 0.1 + rise, z - s * 4.6],
                0.23,
                0.28,
                paint,
              );
        }
        const floors = detail >= 3 ? 4 : 1;
        for (let j = 0; j <= floors; j++) {
          const x = a + (j * (b - a)) / floors;
          beam(
            o,
            'iron',
            [x, deck(x) - 0.9, z - 4.7],
            [x, deck(x) - 0.9, z + 4.7],
            0.42,
            1.05,
            [0.25, 0.29, 0.3],
          );
        }
      }
    }
  }
  for (const x of [-half, half])
    for (const z of [-5.8, 5.8])
      box(o, 'concrete', [x - 1.9, 10, z - 4.6], [x + 1.9, deck(x) - 0.4, z + 4.6], concrete);
  for (const z of [-11.55, 11.55]) {
    box(o, 'concrete', [-half, 23.3, z - 0.7], [half, 23.7, z + 0.7], concrete);
    if (detail >= 2) {
      beam(o, 'iron', [-half, 24.4, z - 0.6], [half, 24.4, z - 0.6], 0.09, 0.12, paint);
      beam(o, 'iron', [-half, 24.4, z + 0.6], [half, 24.4, z + 0.6], 0.09, 0.12, paint);
    }
  }
  if (detail >= 3) {
    for (let x = -half + 1; x < half; x += 64)
      for (const z of [-12, 12]) {
        box(o, 'iron', [x - 0.05, deck(x), z - 0.05], [x + 0.05, deck(x) + 7, z + 0.05], paint);
        box(
          o,
          'marking',
          [x - 0.35, deck(x) + 7, z - 0.25],
          [x + 0.35, deck(x) + 7.3, z + 0.25],
          [0.8, 0.81, 0.76],
        );
      }
    for (let x = -half + 2; x < half; x += 24)
      for (const z of [-5.8, 5.8])
        o.addQuad(
          'marking',
          'palette:#ffffff',
          [
            [x, deck(x) + 0.02, z - 0.075],
            [x, deck(x) + 0.02, z + 0.075],
            [x + 4, deck(x + 4) + 0.02, z + 0.075],
            [x + 4, deck(x + 4) + 0.02, z - 0.075],
          ],
          [0, 1, 0],
          null,
          [0.83, 0.84, 0.79],
        );
  }
}
export const buildGandhiSetuSkyline = (out) => build(out, 0);
export const buildGandhiSetuDistrict = (out) => build(out, 1);
export const buildGandhiSetuStreet = (out) => build(out, 2);
export const buildGandhiSetuCloseup = (out) => build(out, 3);
