/** Complete browser geometry on the preserved curved alignment; no destructive decimation. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  eshimaDepth as depth,
  eshimaEdge as edge,
  eshimaStudy,
  eshimaDeckHeight as height,
  eshimaPoint as p,
  eshimaPath as path,
  eshimaRoadEdge as roadEdge,
  eshimaSupports as supports,
} from '../../../../../../../../packages/worldgen/scripts/eshima-ohashi-model.mjs';

const L = 1446.2,
  concrete = [0.79, 0.79, 0.735],
  pale = [0.86, 0.855, 0.79],
  metal = [0.78, 0.79, 0.76],
  road = [0.15, 0.165, 0.175];
const means = {
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  road: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  marking: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
};
function writer(out, far) {
  const emit = (slot, ref, points, hint, _uv, color) => {
    points = points.map((v) => v.map(Math.fround));
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      out.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? color.map((v, j) => v * (means[slot]?.[j] ?? 1)) : color,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(o, slot, points, color, hint) {
  o.addQuad(slot, 'palette:#ffffff', points, hint ?? normalFor(...points), null, color);
}
function block(o, slot, a, b, y0, y1, z0, z1, color, relative = true) {
  const ring = (s) => [
    p(s, y1, z0, relative),
    p(s, y1, z1, relative),
    p(s, y0, z1, relative),
    p(s, y0, z0, relative),
  ];
  loft(o, slot, [ring(a), ring(b)], color);
}
function stations(level) {
  const values = new Set([
    ...supports,
    ...eshimaStudy.reconstruction.nativeCenterline.map((v) => (v[0] * L) / 1444.934),
    681.2,
  ]);
  for (const s of [556.2, 806.2]) for (const d of [-20, -14, 14, 20]) values.add(s + d);
  const crest = eshimaStudy.reconstruction.crestStationMeters,
    span = eshimaStudy.reconstruction.crestCurveLengthMeters;
  values.add(crest);
  const leftCrest = crest - (0.061 * span) / 0.112;
  values.add(leftCrest);
  values.add(leftCrest + span);
  for (const [a, b] of [
    [406.2, 556.2],
    [556.2, 806.2],
    [806.2, 956.2],
  ])
    for (const t of b - a > 200 ? [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] : [0.25, 0.5, 0.75])
      values.add(a + (b - a) * t);
  const step = { skyline: Infinity, district: 32, street: 18, closeup: 8 }[level];
  for (let s = step; s < L; s += step) values.add(s);
  return [...values].filter((s) => s >= 0 && s <= L).sort((a, b) => a - b);
}
function pier(o, s, level) {
  const main = s === 556.2 || s === 806.2,
    top = height(s) - (main ? 0.39 : depth(s)),
    f = path(s);
  const xy = (x, y, z) => [f.x + x * f.nz + z * f.nx, y, f.z - x * f.nx + z * f.nz];
  if (main) {
    const sides = { skyline: 8, district: 12, street: 16, closeup: 32 }[level],
      oval = (y) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (-i * Math.PI * 2) / sides;
          return xy(3.5 * Math.cos(a), y, (7.5 - (2.4 * y) / top) * Math.sin(a));
        });
    loft(o, 'concrete', [oval(0), oval(top)], concrete);
    if (level === 'closeup')
      for (let y = 2; y < top - 0.5; y += 2.5)
        loft(
          o,
          'concrete',
          [oval(y), oval(y + 0.025)].map((r) =>
            r.map((v) => [v[0] + 0.008 * f.nx, v[1], v[2] + 0.008 * f.nz]),
          ),
          [0.65, 0.66, 0.61],
          { cap: false },
        );
  } else {
    const rect = (y, width, across) =>
      [
        [-width / 2, -across / 2],
        [width / 2, -across / 2],
        [width / 2, across / 2],
        [-width / 2, across / 2],
      ]
        .reverse()
        .map(([x, z]) => xy(x, y, z));
    loft(
      o,
      'concrete',
      level === 'skyline'
        ? [rect(0, 2.45, 4.8), rect(top, 2.7, 9.6)]
        : [rect(0, 2.45, 4.8), rect(Math.max(0.4, top - 1.5), 2.1, 4.2), rect(top, 2.7, 9.6)],
      concrete,
    );
  }
}
function lamp(o, s, side, near) {
  const z = edge(s, side) - side * 0.26,
    base = p(s, 0.23, z),
    top = p(s, 8.7, z),
    elbow = p(s, 9.05, z - side * 0.3),
    head = p(s, 8.85, z - side * 1.85);
  if (near) {
    for (const [a, b, w] of [
      [base, top, 0.15],
      [top, elbow, 0.12],
      [elbow, head, 0.11],
    ])
      beam(o, 'iron', a, b, w, w, metal);
    block(
      o,
      'iron',
      s - 0.16,
      s + 0.16,
      8.75,
      8.97,
      z - side * 1.85 - 0.55,
      z - side * 1.85 + 0.55,
      metal,
    );
  } else {
    face(
      o,
      'iron',
      [p(s - 0.075, 0.23, z), p(s + 0.075, 0.23, z), p(s + 0.075, 8.7, z), p(s - 0.075, 8.7, z)],
      metal,
    );
    face(
      o,
      'iron',
      [p(s, 8.7, z), p(s, 8.85, z - side * 1.85), p(s, 8.96, z - side * 1.85), p(s, 8.81, z)],
      metal,
    );
  }
}
function build(out, level) {
  const far = level === 'skyline',
    near = level === 'street' || level === 'closeup',
    close = level === 'closeup',
    o = writer(out, far),
    ss = stations(level);
  const rings = ss.map((s) => {
    const d = depth(s),
      section = far
        ? [
            [0, edge(s, -1)],
            [0, edge(s, 1)],
            [-d, 3.15],
            [-d, -3.15],
          ]
        : [
            [0, edge(s, -1)],
            [0, edge(s, 1)],
            [-0.375, edge(s, 1)],
            [-0.75, 3.15],
            [-d, 3.15],
            [-d, -3.15],
            [-0.75, -3.15],
            [-0.375, edge(s, -1)],
          ];
    return section.map(([y, z]) => p(s, y, z));
  });
  loft(o, 'concrete', rings, concrete, { cap: false });
  for (let i = 0; i < ss.length - 1; i++) {
    const a = ss[i],
      b = ss[i + 1];
    const strip = (slot, y, z0, z1, color) =>
      face(
        o,
        slot,
        [p(a, y, z0(a)), p(a, y, z1(a)), p(b, y, z1(b)), p(b, y, z0(b))],
        color,
        [0, 1, 0],
      );
    strip(
      'road',
      0.025,
      (s) => roadEdge(s, -1),
      (s) => roadEdge(s, 1),
      road,
    );
    if (!far)
      for (const side of [-1, 1]) {
        strip(
          'concrete',
          0.17,
          (s) => (side > 0 ? roadEdge(s, 1) : edge(s, -1)),
          (s) => (side > 0 ? edge(s, 1) : roadEdge(s, -1)),
          [0.69, 0.685, 0.64],
        );
        const za = edge(a, side) - side * 0.2,
          zb = edge(b, side) - side * 0.2;
        if (near) {
          for (const h of close ? [0.32, 0.6, 0.95, 1.34] : [0.32, 1.34])
            beam(
              o,
              'iron',
              p(a, h, za),
              p(b, h, zb),
              h === 1.34 ? 0.096 : 0.07,
              h === 1.34 ? 0.096 : 0.07,
              metal,
            );
          face(
            o,
            'concrete',
            [
              p(a, 0.01, roadEdge(a, side)),
              p(b, 0.01, roadEdge(b, side)),
              p(b, 0.17, roadEdge(b, side)),
              p(a, 0.17, roadEdge(a, side)),
            ][side === 1 ? 'reverse' : 'slice'](),
            pale,
          );
          face(
            o,
            'concrete',
            [
              p(a, -0.37, edge(a, side)),
              p(b, -0.37, edge(b, side)),
              p(b, 0.22, edge(b, side)),
              p(a, 0.22, edge(a, side)),
            ][side === -1 ? 'reverse' : 'slice'](),
            pale,
          );
        } else
          face(o, 'iron', [p(a, 1.29, za), p(b, 1.29, zb), p(b, 1.39, zb), p(a, 1.39, za)], metal);
      }
    if (near) {
      strip(
        'marking',
        0.034,
        () => -0.07,
        () => 0.07,
        [0.94, 0.59, 0.1],
      );
      for (const side of [-1, 1])
        strip(
          'marking',
          0.037,
          () => side * 3.4 - 0.07,
          () => side * 3.4 + 0.07,
          [0.93, 0.92, 0.84],
        );
    }
  }
  for (const s of supports.slice(1, -1)) pier(o, s, level);
  for (const [a, b] of [
    [0, 2.2],
    [L - 2.2, L],
  ])
    block(o, 'concrete', a, b, 0, height((a + b) / 2) - 0.1, -5.65, 5.65, concrete, false);
  if (!far)
    for (const side of [-1, 1]) {
      if (near)
        for (let s = 0.65; s < L; s += close ? 2 : 12) {
          const z = edge(s, side) - side * 0.2;
          beam(o, 'iron', p(s, 0.23, z), p(s, 1.34, z), 0.09, 0.09, [0.22, 0.37, 0.32]);
        }
      for (let s = side === -1 ? 17 : 40; s < L - 10; s += level === 'district' ? 92 : 46)
        lamp(o, s, side, close);
    }
  if (near)
    for (const [station, side] of [
      [556.2, -1],
      [806.2, 1],
    ])
      for (let s = station - 13.5; s < station + 14; s += close ? 2.5 : 7) {
        beam(
          o,
          'concrete',
          p(s, -1.25, side * 3.2),
          p(s, -0.53, edge(s, side) - side * 0.15),
          0.22,
          0.42,
          concrete,
        );
        const b = Math.min(s + (close ? 2.45 : 6.95), station + 14),
          a0 = p(s, 0.23, edge(s, side) - side * 0.2),
          b0 = p(b, 0.23, edge(b, side) - side * 0.2);
        face(
          o,
          'screen',
          [
            a0,
            b0,
            b0.map((v, i) => v + (i === 1 ? 1.45 : 0)),
            a0.map((v, i) => v + (i === 1 ? 1.45 : 0)),
          ],
          [0.46, 0.7, 0.72],
        );
        beam(
          o,
          'iron',
          a0,
          a0.map((v, i) => v + (i === 1 ? 1.6 : 0)),
          0.07,
          0.07,
          [0.2, 0.37, 0.33],
        );
      }
  if (close) {
    for (const s of [60, 199.2, 351.2, 681.2, 1011.2, 1131.2, 1251.2, 1356.2])
      block(o, 'iron', s - 0.12, s + 0.12, 0.025, 0.05, -5.4, 5.4, [0.25, 0.27, 0.25]);
    for (const side of [-1, 1])
      for (let s = 14; s < L; s += 24) {
        const z = roadEdge(s, side) + side * 0.23;
        block(o, 'iron', s - 0.23, s + 0.23, 0.178, 0.195, z - 0.15, z + 0.15, [0.14, 0.16, 0.17]);
        beam(
          o,
          'iron',
          p(s, -0.6, side * 3.17),
          p(s, -depth(s) - 0.5, side * 3.17),
          0.14,
          0.14,
          [0.47, 0.49, 0.47],
        );
      }
  }
}
export const buildEshimaSkyline = (out) => build(out, 'skyline');
export const buildEshimaDistrict = (out) => build(out, 'district');
export const buildEshimaStreet = (out) => build(out, 'street');
export const buildEshimaCloseup = (out) => build(out, 'closeup');
