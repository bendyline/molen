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
import site from '../abbey-plan.json' with { type: 'json' };

export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.85 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', name: 'mustair-recesses', roughness: 0.91 },
};
const white = rgb('d9d4c8'),
  cream = rgb('cfc4aa'),
  stone = rgb('b3a68c'),
  worn = rgb('a29988');
const slate = rgb('6c6e70'),
  shed = rgb('777573'),
  trim = rgb('bdb29e'),
  night = rgb('514d4b'),
  wood = rgb('685748');
const {
  origin: [x, z],
  axis: [a, b],
  rings,
} = site;
const p = (u, v) => [x + u * a - v * b, z + u * b + v * a];
const F = facade([x, z], [a, b]);
const ring = (u, U, v, V) => [p(u, v), p(u, V), p(U, V), p(U, v)];
const box = (out, s, u, U, v, V, y, Y, c) => fbox(out, s, F, u, U, y, Y, v, V, c);
const faces = (r) => outwardRing(r).map((q, i, rs) => wallFace(q, rs[(i + 1) % rs.length]));

function meshWithCaps(out) {
  return {
    ...out,
    addCap(slot, ref, r, holes, grade, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('wall', ref, r, holes, grade, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, slot, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}
function roof(out, u, v, U, V, w, top, rise, color = slate) {
  gableRoof(out, 'slate', p(u, v), p(U, V), w, top, top + rise, color, {
    overhang: 0.24,
    endSlot: 'lime',
    endColor: white,
  });
}
function windows(out, r, eaves, level, windowHeight = 1.2) {
  if (level < 2) return;
  for (const f of faces(r)) {
    if (f.length < 4.4) continue;
    const n = Math.floor(f.length / 4.4);
    for (let i = 0; i < n; i++) {
      const u = (f.length * (i + 0.5)) / n;
      opening(out, f, u, eaves - 2.53, 0.66, windowHeight, {
        glassSlot: 'shade',
        frameSlot: 'trim',
        glass: night,
        frame: trim,
        frameWidth: level === 3 ? 0.095 : 0,
        frameDepth: 0.11,
        sill: level === 3,
        d: 0.028,
      });
    }
  }
}
function range(out, key, y, Y, roofRows, level) {
  const r = rings[key];
  extrude(out, 'lime', r, y, Y, white);
  if (level > 1) extrude(out, 'trim', r, y, y + 0.7, worn);
  for (const [u, v, U, V, w, rise = 2.2] of roofRows) roof(out, u, v, U, V, w, Y, rise);
  windows(out, r, Y, level);
}
function hip(out, r, top, rise, color = slate) {
  const xy = r.reduce(([x, z], [u, v]) => [x + u / r.length, z + v / r.length], [0, 0]);
  const corners = outwardRing(r);
  for (const [i, A] of corners.entries()) {
    const B = corners[(i + 1) % corners.length];
    tri(out, 'slate', [A[0], top, A[1]], [B[0], top, B[1]], [xy[0], top + rise, xy[1]], color);
  }
}
function curvedApse(out, u, v, depth, span, lo, top, rise, level) {
  const count = [6, 9, 14, 18][level];
  const pts = Array.from({ length: count + 1 }, (_, i) => {
    const theta = -Math.PI / 2 + (i * Math.PI) / count;
    return p(u + depth * Math.cos(theta), v + span * Math.sin(theta));
  });
  extrude(out, 'lime', pts, lo, top, cream);
  const topApex = F.P(u - 0.3, top + rise, v);
  const ring = outwardRing(pts);
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i],
      B = ring[(i + 1) % ring.length];
    tri(out, 'slate', [A[0], top, A[1]], [B[0], top, B[1]], topApex, slate);
  }
  if (level) {
    const f = facade(p(u + depth + 0.026, v), [b, -a]);
    opening(out, f, 0, top - 3.52, 0.44, 1.84, {
      head: 'pointed',
      glassSlot: 'shade',
      frameSlot: 'trim',
      glass: night,
      frame: trim,
      frameWidth: level > 1 ? 0.1 : 0,
      sill: level > 1,
      d: 0.02,
      rise: 0.28,
    });
  }
}
function archStory(out, plan, bottom, top, level) {
  for (const f of faces(plan)) {
    const mid = f.length * 0.5,
      h = bottom + 0.79,
      w = 1.25,
      rise = 1.75;
    const spring = top - rise - 0.33;
    const arch = pointedArch(w, rise, level === 3 ? 8 : 4).map(([x, y]) => [mid + x, spring + y]);
    fbox(out, 'stone', f, 0, mid - w, bottom, top, -0.37, 0, stone);
    fbox(out, 'stone', f, mid + w, f.length, bottom, top, -0.37, 0, stone);
    fbox(out, 'stone', f, mid - w, mid + w, bottom, h, -0.37, 0, stone);
    for (let i = 0; i < arch.length - 1; i++) {
      const [u, y] = arch[i],
        [U, Y] = arch[i + 1];
      quad4(out, 'stone', f.P(u, y), f.P(U, Y), f.P(U, top), f.P(u, top), stone);
      quad4(
        out,
        'trim',
        f.P(U, Y, -0.37),
        f.P(u, y, -0.37),
        f.P(u, top, -0.37),
        f.P(U, top, -0.37),
        worn,
      );
      quad4(out, 'trim', f.P(U, Y), f.P(u, y), f.P(u, y, -0.37), f.P(U, Y, -0.37), cream);
    }
    if (level > 2) {
      for (const d of [-1, 1])
        fbox(out, 'trim', f, mid + d * w - 0.1, mid + d * w + 0.1, h, spring, -0.09, 0.08, trim);
    }
  }
}
function clock(out, frame, y, level) {
  if (!level) return;
  const size = 1.19,
    m = frame.length * 0.5;
  fbox(out, 'trim', frame, m - size, m + size, y - size, y + size, -0.02, 0.1, white);
  const n = level > 1 ? 24 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const q = (r, t) => frame.P(m + r * Math.cos(t), y + r * Math.sin(t), 0.111);
    tri(out, 'trim', frame.P(m, y, 0.111), q(0.86, a), q(0.86, b), cream);
    quad4(out, 'shade', q(0.84, a), q(0.9, a), q(0.9, b), q(0.84, b), night);
  }
  if (level > 1) {
    fbox(out, 'shade', frame, m - 0.027, m + 0.027, y - 0.08, y + 0.73, 0.112, 0.119, night);
    tri(
      out,
      'shade',
      frame.P(m - 0.04, y - 0.035, 0.13),
      frame.P(m + 0.51, y + 0.26, 0.13),
      frame.P(m + 0.04, y + 0.035, 0.13),
      night,
    );
  }
}
function tower(out, level) {
  const t = ring(-1.19, 6.96, 9.93, 18.33);
  extrude(out, 'stone', t, -2.5, 20.14, stone);
  extrude(out, 'trim', ring(-1.31, 7.08, 9.81, 18.45), 17.94, 18.17, trim);
  archStory(out, t, 20.14, 25.53, level);
  extrude(out, 'trim', ring(-1.43, 7.2, 9.68, 18.57), 25.49, 25.88, trim);
  roof(out, -1.21, 14.11, 6.95, 14.11, 8.33, 25.87, 1.65);
  const east = wallFace(p(6.96, 18.33), p(6.96, 9.93));
  clock(out, east, 16.33, level);
  if (level > 1) {
    const c = p(2.84, 14.2);
    lathe(
      out,
      'trim',
      c,
      [
        [20.85, 0.56, 0.56],
        [21.02, 0.59, 0.59],
        [21.29, 0.49, 0.49],
        [22.32, 0.33, 0.33],
        [22.49, 0.08, 0.08],
      ],
      12,
      wood,
    );
  }
}
function keep(out, level) {
  const r = ring(2.85, 10.78, -20.82, -8.08);
  extrude(out, 'lime', r, -1.9, 16.1, white);
  roof(out, 2.87, -14.48, 10.77, -14.48, 12.7, 16.08, 4.21);
  for (const U of [2.89, 10.83]) {
    const n = level ? 8 : 5,
      w = 12.7,
      step = w / n;
    for (let i = 0; i < n; i++) {
      const v = -20.83 + (i + 0.5) * step;
      const base = 16.08 + 4.21 * (1 - Math.abs(v + 14.48) / (w * 0.5));
      box(out, 'lime', U - 0.2, U + 0.2, v - step * 0.5, v + step * 0.5, 15.85, base + 0.29, white);
      if (level > 1)
        box(
          out,
          'trim',
          U - 0.23,
          U + 0.23,
          v - step * 0.5,
          v + step * 0.5,
          base + 0.24,
          base + 0.32,
          trim,
        );
    }
  }
  windows(out, r, 16.1, level);
  if (level > 1) windows(out, r, 12.28, level);
}
function church(out, level) {
  const nave = ring(-9.78, 10.73, -7.55, 9.81);
  extrude(out, 'lime', nave, -2.5, 12.17, white);
  roof(out, -9.78, 1.12, 10.74, 1.12, 17.34, 12.17, 6.13);
  const shoulders = [
    [-9.83, -8.0, -7.42, 9.8, 7.83],
    [7.0, 13.07, 9.76, 14.54, 7.15],
    [10.79, 12.36, -13.26, -7.53, 7.91],
  ];
  for (const [u, U, v, V, h] of shoulders) {
    box(out, 'lime', u, U, v, V, -2.4, h, cream);
    roof(out, u, (v + V) * 0.5, U, (v + V) * 0.5, V - v, h, 1.6, shed);
  }
  for (const [v, span, depth, height, rise] of [
    [-6.08, 1.89, 2.04, 8.01, 2.94],
    [1.25, 3.31, 3.41, 8.73, 3.44],
    [7.37, 1.83, 2.31, 7.78, 2.74],
  ]) {
    curvedApse(out, 10.72, v, depth, span, -1.92, height, rise, level);
  }
  if (level)
    for (const u of [-6, -1, 4.15, 8.26]) {
      for (const [v, sign] of [
        [9.84, 1],
        [-7.59, -1],
      ]) {
        const f = facade(p(u, v), [a * sign, b * sign]);
        opening(out, f, 0, 7.46, 0.83, 2.89, {
          head: 'round',
          glassSlot: 'shade',
          frameSlot: 'trim',
          frameWidth: level === 3 ? 0.13 : 0,
          frame: cream,
          glass: night,
          d: 0.062,
        });
      }
    }
}
function chapel(out, level) {
  const r = ring(-0.73, 4.98, 47.68, 55.76);
  extrude(out, 'lime', r, -4.5, 4.37, white);
  roof(out, -0.74, 51.75, 5.12, 51.75, 8.03, 4.37, 2.88);
  for (const [v, X] of [
    [49.48, 2.03],
    [53.1, 3.3],
    [56.19, 2.24],
  ])
    curvedApse(out, 4.62, v, X, 1.78, -4.65, 3.46, 1.01, level);
}
function ranges(out, level) {
  range(out, 'westA', -2.9, 10.67, [[-13.16, -18.24, -12.14, 2.47, 3.8]], level);
  range(out, 'westB', -1.7, 12.03, [[-9.6, -14.23, 2.77, -14.23, 13.5]], level);
  range(out, 'northCourtHall', -0.24, 12.59, [[-36.96, -20.96, -14.19, -20.96, 8.1]], level);
  range(out, 'gateWing', -2.8, 8.9, [[-48.3, 43.48, -4.88, 50.51, 7.96]], level);
  range(out, 'eastHall', -3.1, 11.07, [[-6.43, 17.77, -6.45, 45.41, 5.36]], level);
  range(out, 'westHall', -0.73, 11.05, [[-55.44, -26.44, -52.17, 44.98, 6.64]], level);
  if (!level) return;
  range(out, 'gardenShed', 1.05, 5.88, [[-45.94, -55.75, -43.25, -55.17, 3.63]], level);
  range(out, 'gardenShed2', 2.19, 6.14, [[-48.51, -51.58, -42.47, -50.62, 3.6]], level);
  for (const g of ['gardenStore', 'gardenStore2']) {
    range(out, g, 2.1, 5.7, [], level);
    if (level) hip(out, rings[g], 5.68, 0.8, shed);
  }
}
function walls(out, level) {
  for (const { a, b, base, top } of site.walls) {
    const f = wallFace(a, b);
    fbox(out, 'stone', f, 0, f.length, base, top, -0.43, 0, stone);
    if (level) fbox(out, 'slate', f, 0, f.length, top, top + 0.18, -0.51, 0.08, shed);
  }
  for (const [u, U, v, V, base, top] of [
    [-56.18, 11.57, -74.78, -72.03, 1.5, 7.43],
    [8.12, 11.46, -72.1, -20.81, -1.93, 6.39],
    [-56.11, -53.42, -72.04, -42.88, 1.6, 7.57],
  ]) {
    const outline = ring(u, U, v, V);
    extrude(out, 'stone', outline, base, top, stone);
    hip(out, outline, top, 0.55, shed);
  }
  if (level > 1) {
    const r = ring(-69.85, -64.24, -1.6, 0.01);
    extrude(out, 'stone', r, 2.1, 3.23, stone);
    roof(out, -69.86, -0.77, -64.23, -0.77, 1.67, 3.25, 0.49, shed);
  }
}
function build(target, level) {
  const out = meshWithCaps(target);
  church(out, level);
  tower(out, level);
  keep(out, level);
  chapel(out, level);
  ranges(out, level);
  walls(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
