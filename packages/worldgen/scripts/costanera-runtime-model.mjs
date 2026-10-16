/** Medium-fi Costanera variants; the original instanced source recipe stays unchanged. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const glass = [0.16, 0.36, 0.44],
  spandrel = [0.12, 0.27, 0.33];
const silver = [0.64, 0.69, 0.7],
  pale = [0.82, 0.83, 0.78];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const turn = ([x, y, z], angle) => [
  Math.cos(angle) * x + Math.sin(angle) * z,
  y,
  -Math.sin(angle) * x + Math.cos(angle) * z,
];
function rotated(out, angle) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (s, r, p, n, u, c) =>
        out[name](
          s,
          r,
          p.map((p) => turn(p, angle)),
          turn(n, angle),
          u,
          c,
        ),
    ]),
  );
}

// The datum at floor 60 is published. Intermediate facade allocations remain reconstructions.
const sections = [
  [0, 25.7, 22.1],
  [23.9, 25.7, 22.1],
  [90, 24.8, 20.7],
  [155, 23.4, 18.2],
  [204.5, 21.6, 15.2],
  [249.6, 19.7, 12.2],
  [261.8, 19.35, 11.9],
  [280, 18.8, 11.65],
  [300, 18.2, 11.2],
];
function section(y) {
  let i = 1;
  while (i < sections.length - 1 && y > sections[i][0]) i++;
  const a = sections[i - 1],
    b = sections[i],
    t = (y - a[0]) / (b[0] - a[0]);
  const r = a[1] + t * (b[1] - a[1]),
    end = a[2] + t * (b[2] - a[2]);
  return { r, end, b: r * 0.922, k: (end + r * 0.922) / 2 };
}
// Each quadrant contains a folded main wall and a three-face recessed corner.
function quadrant(y) {
  const { r, end: a, b, k } = section(y);
  return [
    [0, y, -r],
    [-a, y, -b],
    [-a, y, -k],
    [-k, y, -a],
    [-b, y, -a],
  ];
}
function plan(y) {
  return Array.from({ length: 4 }, (_, i) =>
    quadrant(y).map((p) => turn(p, (i * Math.PI) / 2)),
  ).flat();
}
function slab(o, y, thickness, color = pale, slot = 'concrete') {
  const lower = plan(y),
    upper = lower.map(([x, yy, z]) => [x, yy + thickness, z]);
  loft(o, slot, [lower, upper], color, { cap: false });
  for (let k = 0; k < lower.length; k++) {
    const j = (k + 1) % lower.length;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [[0, y + thickness, 0], upper[k], upper[j]],
      [0, 1, 0],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      color,
    );
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [[0, y, 0], lower[j], lower[k]],
      [0, -1, 0],
      [
        [0, 0],
        [1, 1],
        [0, 1],
      ],
      color,
    );
  }
}

const floors = [0, 5.4, 10.8, 16.2, 20, 23.9];
for (let i = 1; i <= 55; i++) floors.push(23.9 + (i * (249.6 - 23.9)) / 55);
floors.push(253.7, 261.8);
const crownRows = [261.8, 265.5, 269.8, 274.1, 278.4, 282.7, 287, 291.3, 295.65, 300];
const proud = (p, n, d) => p.map((v, i) => v + n[i] * d);
function strip(o, slot, a, b, c, d, t0, t1, color) {
  const n = normalFor(a, b, c);
  face(
    o,
    slot,
    [mix(a, d, t0), mix(b, c, t0), mix(b, c, t1), mix(a, d, t1)].map((p) => proud(p, n, 0.035)),
    color,
  );
}
function wallPoint(x, y) {
  const s = section(y);
  return [x, y, -s.r + (Math.abs(x) * (s.r - s.b)) / s.end];
}
function canopy(o, level) {
  const wall = (x, y) => wallPoint(x, y),
    outer = (x, y) => [x, y, -32.9 + Math.abs(x) * 0.025],
    near = level >= 2,
    span = 11.2,
    count = near ? 8 : 1;
  for (let i = 0; i < count; i++) {
    const x = -span + (2 * span * i) / count,
      xx = -span + (2 * span * (i + 1)) / count,
      a = wall(x, 5.15),
      b = wall(xx, 5.15),
      c = outer(xx, 5.15),
      d = outer(x, 5.15);
    face(o, near ? 'clear_glass' : 'glass', [a, b, c, d], [0.55, 0.66, 0.68]);
    if (near) {
      beam(o, 'stainless', a, d, 0.15, 0.32, silver);
      beam(o, 'stainless', wall(x, 14.5), outer(x, 5.35), 0.08, 0.08, silver);
      beam(o, 'stainless', wall(x, 0.1), wall(x, 15), 0.25, 0.23, silver);
    }
  }
  if (near) beam(o, 'metal', outer(-span, 5.15), outer(span, 5.15), 0.28, 0.32, silver);
  if (!near) return;
  for (let i = 0; i < 8; i++) {
    const x = -4.8 + i * 1.2,
      a = wall(x, 0.12),
      b = wall(x + 1.16, 0.12),
      c = wall(x + 1.16, 3.2),
      d = wall(x, 3.2),
      n = normalFor(b, a, d),
      p = [b, a, d, c].map((p) => proud(p, n, 0.08));
    face(o, 'clear_glass', p, glass);
    for (const [j, k] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ])
      beam(o, 'stainless', p[j], p[k], 0.06, 0.06, silver);
    if (level === 3)
      tube(
        o,
        'stainless',
        proud(wall(x + 0.93, 0.9), n, 0.16),
        proud(wall(x + 0.93, 1.75), n, 0.16),
        0.021,
        silver,
        8,
      );
  }
}
function mainWalls(o, level) {
  const ys =
    level === 0
      ? [0, 23.9, 90, 155, 204.5, 249.6, 261.8]
      : level === 1
        ? [...floors.filter((_, i) => i % 4 === 0 || i < 3 || i >= 60), 261.8]
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => a - b)
        : floors;
  for (let row = 0; row < ys.length - 1; row++) {
    const y0 = ys[row],
      y1 = ys[row + 1],
      p = plan(y0),
      q = plan(y1);
    for (let edge = 0; edge < 20; edge++) {
      const k = (edge + 1) % 20,
        a = p[edge],
        b = p[k],
        c = q[k],
        d = q[edge],
        clear = level >= 2 && (y1 <= 10.8 || y0 >= 253.7);
      // Leave an actual clear opening behind the eight illustrative northwestern door leaves.
      if (level >= 2 && row === 0 && (edge === 0 || edge === 19)) {
        const t = 4.8 / section(0).end;
        // Full top panel and outer-side panel. Bottom sill stays in the ground slab.
        face(o, 'clear_glass', [mix(a, d, 3.2 / y1), mix(b, c, 3.2 / y1), c, d], glass);
        const aa = edge === 0 ? mix(a, b, t) : a,
          bb = edge === 0 ? b : mix(a, b, 1 - t),
          cc = bb.map((v, i) => (i === 1 ? 3.2 : v)),
          dd = aa.map((v, i) => (i === 1 ? 3.2 : v));
        face(o, 'clear_glass', [aa, bb, cc, dd], glass);
        continue;
      }
      if (level === 0 || clear) {
        face(o, clear ? 'clear_glass' : 'glass', [a, b, c, d], glass);
      } else {
        // Adjacent glass/spandrel regions; no opaque face layered over another wall.
        face(o, 'glass', [a, b, mix(b, c, 0.73), mix(a, d, 0.73)], glass);
        face(o, 'glass', [mix(a, d, 0.73), mix(b, c, 0.73), c, d], spandrel);
      }
      if (level >= 1) strip(o, 'metal', a, b, c, d, 0.986, 1, silver);
    }
  }
  if (level < 2) return;
  // Full-height flat mullion strips, segmented only where the taper changes.
  const sectionsY = [0, 23.9, 90, 155, 204.5, 249.6, 253.7, 261.8];
  for (let j = 1; j < sectionsY.length; j++) {
    const p = plan(sectionsY[j - 1]),
      q = plan(sectionsY[j]);
    for (let e = 0; e < 20; e++) {
      const k = (e + 1) % 20,
        a = p[e],
        b = p[k],
        c = q[k],
        d = q[e],
        len = Math.hypot(...sub(b, a)),
        n = normalFor(a, b, c),
        count = Math.max(1, Math.round(len / (level === 3 ? 1.48 : 5.9))),
        w = 0.09 / len;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        if (
          j === 1 &&
          ((e === 0 && t < 4.8 / section(0).end) || (e === 19 && t > 1 - 4.8 / section(0).end))
        )
          continue;
        face(
          o,
          'metal',
          [
            mix(a, b, t),
            mix(a, b, Math.min(1, t + w)),
            mix(d, c, Math.min(1, t + w)),
            mix(d, c, t),
          ].map((p) => proud(p, n, 0.045)),
          silver,
        );
      }
    }
  }
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
function crown(o, level) {
  const rows =
    level === 0 ? [261.8, 282.7, 300] : level === 1 ? [261.8, 274.1, 282.7, 291.3, 300] : crownRows;
  for (let side = 0; side < 4; side++) {
    const out = rotated(o, (side * Math.PI) / 2);
    for (let j = 1; j < rows.length; j++) {
      const y = rows[j - 1],
        yy = rows[j],
        s = section(y),
        t = section(yy),
        p = quadrant(y),
        q = quadrant(yy);
      for (let h = 0; h < 2; h++) {
        const a = h === 0 ? [s.end, y, -s.b] : p[0],
          b = h === 0 ? p[0] : p[1],
          d = h === 0 ? [t.end, yy, -t.b] : q[0],
          c = h === 0 ? q[0] : q[1];
        face(out, level >= 2 ? 'clear_glass' : 'glass', [a, b, c, d], [0.32, 0.52, 0.58]);
        if (level < 2) face(out, 'glass', [b, a, d, c], [0.32, 0.52, 0.58]);
        if (level >= 1) strip(out, 'metal', a, b, c, d, 0.978, 1, silver);
        if (level >= 2) {
          const n = normalFor(a, b, c);
          for (let i = 0; i < 8; i++) {
            const x = i / 8,
              w = 0.075 / Math.hypot(...sub(b, a));
            face(
              out,
              'metal',
              [mix(a, b, x), mix(a, b, x + w), mix(d, c, x + w), mix(d, c, x)].map((p) =>
                proud(p, n, 0.06),
              ),
              silver,
            );
          }
        }
      }
      if (yy <= 282.7)
        for (let edge = 1; edge < 4; edge++)
          face(
            out,
            level >= 2 ? 'clear_glass' : 'glass',
            [p[edge], p[edge + 1], q[edge + 1], q[edge]],
            [0.3, 0.48, 0.53],
          );
    }
    const fp = (x, y) => {
      const s = section(y);
      return [x * s.end, y, -s.r + 1.2 + Math.abs(x) * (s.r - s.b)];
    };
    for (const x of [-0.95, 0, 0.95])
      beam(out, 'metal', fp(x, 261.8), fp(x, 299.85), 0.4, 0.38, pale);
    for (const y of level === 0 ? [265.5, 282.7, 299.8] : [265.5, 274.1, 282.7, 291.3, 299.8])
      beam(out, 'metal', fp(-0.95, y), fp(0.95, y), 0.36, 0.32, pale);
    for (const y of level === 0 ? [265.5] : [265.5, 282.7])
      for (const s of [-1, 1]) {
        const dy = level === 0 ? 34 : 17.2;
        beam(out, 'metal', fp(0, y), fp(s * 0.95, y + dy), 0.25, 0.23, pale);
        beam(out, 'metal', fp(s * 0.95, y), fp(0, y + dy), 0.25, 0.23, pale);
      }
    if (level >= 1)
      for (let y = 262.3; y < 299.5; y += level === 3 ? 1.1 : level === 2 ? 2.2 : 5.5) {
        const s = section(y),
          t = section(y + 0.15);
        for (const sign of [-1, 1]) {
          const p =
            sign === 1
              ? [
                  [s.end, y, -s.b],
                  [0, y, -s.r],
                  [0, y + 0.15, -t.r],
                  [t.end, y + 0.15, -t.b],
                ]
              : [
                  [0, y, -s.r],
                  [-s.end, y, -s.b],
                  [-t.end, y + 0.15, -t.b],
                  [0, y + 0.15, -t.r],
                ];
          const n = normalFor(...p);
          face(
            out,
            'metal',
            p.map((p) => proud(p, n, 0.04)),
            [0.65, 0.74, 0.75],
          );
        }
      }
  }
}
function reviewed(o, level) {
  mainWalls(o, level);
  crown(o, level);
  slab(o, 0, 0.2);
  if (level > 0) slab(o, 253.7, 0.2);
  slab(o, 261.6, 0.2, [0.54, 0.39, 0.23], 'wood');
  canopy(o, level);
  box(o, 'recess', [-8, 253.9, -7], [8, 266, 7], [0.23, 0.25, 0.25]);
  box(o, 'metal', [-6.5, 266, -5.5], [6.5, 269.5, 5.5], pale);
  if (level >= 2) {
    for (const y of [5.4, 10.8, 23.9, 90, 155, 204.5, 249.6]) slab(o, y, 0.2);
    box(o, 'concrete', [-8, 0.2, -7], [8, 10.7, 7], [0.57, 0.58, 0.55]);
    for (const x of [-19, -9, 9, 19])
      for (const z of [-19, 19])
        box(o, 'metal', [x - 0.34, 0.2, z - 0.34], [x + 0.34, 10.7, z + 0.34], pale);
    const ring = plan(261.8).map(([x, y, z]) => [x * 0.91, y, z * 0.91]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      beam(
        o,
        'stainless',
        a.map((v, i) => v + (i === 1 ? 1.1 : 0)),
        b.map((v, i) => v + (i === 1 ? 1.1 : 0)),
        0.06,
        0.06,
        silver,
      );
      if (level === 3)
        beam(
          o,
          'stainless',
          a,
          a.map((v, i) => v + (i === 1 ? 1.1 : 0)),
          0.06,
          0.06,
          silver,
        );
    }
  }
}
export const buildCostaneraCloseup = (o) => reviewed(o, 3);
export const buildCostaneraStreet = (o) => reviewed(o, 2);
export const buildCostaneraDistrict = (o) => reviewed(o, 1);
export function buildCostaneraReviewedSkyline(o) {
  const mean = {
    metal: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
    stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    wood: [0.825128, 0.825128, 0.825128],
  };
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, _r, p, n, u, c) =>
        o[name](
          'glass',
          'palette:#ffffff',
          p,
          n,
          u,
          mean[slot] ? c.map((v, i) => v * mean[slot][i]) : c,
        ),
    ]),
  );
  reviewed(out, 0);
}
