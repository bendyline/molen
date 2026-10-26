/** Complete analytic browser representations; detailed source ropes/hardware remain separate. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  pivnichnyiControls as C,
  pivnichnyiExtrusion,
  pivnichnyiPlaques,
  pivnichnyiRounded,
} from '../../../../../../../../packages/worldgen/scripts/pivnichnyi-bridge-model.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const concrete = [0.62, 0.6, 0.54],
  edge = [0.75, 0.73, 0.66],
  iron = [0.31, 0.34, 0.32];
const cable = [0.16, 0.18, 0.17],
  blue = [0.35, 0.57, 0.65],
  road = C.roadHeight,
  px = C.pylonStation;
const configs = {
  skyline: { step: 132, hole: 6, arch: 3, ropes: 1, ropeSides: 3, ropeSteps: 1, posts: 0, lamp: 0 },
  district: {
    step: 66,
    hole: 10,
    arch: 6,
    ropes: 1,
    ropeSides: 4,
    ropeSteps: 3,
    posts: 64,
    lamp: 126,
  },
  street: {
    step: 24,
    hole: 20,
    arch: 10,
    ropes: 2,
    ropeSides: 4,
    ropeSteps: 6,
    posts: 8,
    lamp: 63,
  },
  closeup: {
    step: 8,
    hole: 40,
    arch: 16,
    ropes: 4,
    ropeSides: 6,
    ropeSteps: 10,
    posts: 4,
    lamp: 31.5,
  },
};
export const pivnichnyiRuntimeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  marking: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.7, metallic: 0.7 },
};
function writer(out, far) {
  const means = {
    concrete: [0.710816, 0.710816, 0.681928],
    road: [0.710816, 0.710816, 0.681928],
    iron: [0.83, 0.83, 0.83],
    marking: [0.83, 0.83, 0.83],
    copper: [0.61, 0.39, 0.25],
  };
  const emit = (slot, ref, p, hint, _uv, color) => {
    const points = p.map((p) => p.map(Math.fround));
    for (let i = 1; i + 1 < points.length; i++) {
      let tri = [points[0], points[i], points[i + 1]],
        n = normalFor(...tri);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) {
        tri = [tri[0], tri[2], tri[1]];
        n = normalFor(...tri);
      }
      out.addTriangle(
        slot,
        ref,
        tri,
        n,
        tri.map((p) => [p[0], p[2]]),
        far ? color.map((v, j) => v * (means[slot]?.[j] ?? 1)) : color,
      );
    }
  };
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [name, emit]),
  );
}
function face(out, slot, p, color) {
  out.addQuad(slot, 'palette:#ffffff', p, normalFor(...p), [], color);
}
function strip(out, slot, a, b, z0, z1, y0, y1, color, solid = true) {
  if (!solid) {
    face(
      out,
      slot,
      [
        [a, road(a) + y1, z1],
        [b, road(b) + y1, z1],
        [b, road(b) + y1, z0],
        [a, road(a) + y1, z0],
      ],
      color,
    );
    return;
  }
  loft(
    out,
    slot,
    [a, b].map((x) => [
      [x, road(x) + y1, z0],
      [x, road(x) + y1, z1],
      [x, road(x) + y0, z1],
      [x, road(x) + y0, z0],
    ]),
    color,
  );
}
function across(out, x, outline, thickness, color, holes = []) {
  const map = (p) => [x + p[2], p[1], -p[0]],
    normal = (n) => [n[2], n[1], -n[0]];
  const local = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (s, r, p, n, u, c) => out[name](s, r, p.map(map), normal(n), u, c),
    ]),
  );
  pivnichnyiExtrusion(local, 'concrete', outline, -thickness / 2, thickness / 2, color, holes);
}
function tube(out, points, radius, sides, color = cable, slot = 'iron') {
  const axis = points.at(-1).map((v, i) => v - points[0][i]),
    length = Math.hypot(...axis),
    d = axis.map((v) => v / length);
  const q = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  let u = cross(d, q);
  const m = Math.hypot(...u);
  u = u.map((v) => v / m);
  const v = cross(d, u);
  const rings = points.map((p) =>
    Array.from({ length: sides }, (_, i) =>
      p.map(
        (n, j) =>
          n +
          radius *
            (u[j] * Math.cos((2 * Math.PI * i) / sides) +
              v[j] * Math.sin((2 * Math.PI * i) / sides)),
      ),
    ),
  );
  loft(out, slot, rings, color);
}
function deck(out, c, far, near) {
  const cuts = [
    C.ends[0],
    ...C.stations.filter((x) => x > C.ends[0] && x < C.ends[1]),
    C.ends[1],
  ].sort((a, b) => a - b);
  for (let i = 1; i < cuts.length; i++) {
    const count = Math.ceil((cuts[i] - cuts[i - 1]) / c.step);
    for (let j = 0; j < count; j++) {
      const a = cuts[i - 1] + ((cuts[i] - cuts[i - 1]) * j) / count,
        b = cuts[i - 1] + ((cuts[i] - cuts[i - 1]) * (j + 1)) / count;
      strip(out, 'road', a, b, -12.55, 12.55, -0.22, 0, [0.25, 0.26, 0.25], !far);
      for (const s of [-1, 1]) {
        const walk = [s * 12.55, s * 15.7].sort((a, b) => a - b),
          girder = [s * 6.7, s * 10.9].sort((a, b) => a - b);
        strip(out, 'concrete', a, b, ...walk, -0.46, 0.22, edge, !far);
        strip(out, 'iron', a, b, ...girder, -3.05, -0.32, iron);
      }
    }
  }
  if (near)
    for (let x = C.ends[0] + 1; x < C.ends[1]; x += c.step)
      beam(out, 'iron', [x, road(x) - 1.45, -15.4], [x, road(x) - 1.45, 15.4], 0.25, 1.8, iron);
  for (const s of [-1, 1]) {
    const z = s * 15.53;
    if (far) continue;
    for (let x = C.ends[0] + 0.4; x < C.ends[1]; x += c.posts) {
      const b = Math.min(x + c.posts, C.ends[1]);
      box(
        out,
        'iron',
        [x - 0.06, road(x) + 0.2, z - 0.05],
        [x + 0.06, road(x) + 1.43, z + 0.05],
        edge,
      );
      beam(out, 'iron', [x, road(x) + 1.43, z], [b, road(b) + 1.43, z], 0.22, 0.11, blue);
      beam(out, 'iron', [x, road(x) + 0.32, z], [b, road(b) + 0.32, z], 0.065, 0.05, edge);
      if (near)
        for (let t = x + 2; t < b - 0.1; t += 2)
          beam(out, 'iron', [t, road(t) + 0.3, z], [t, road(t) + 1.38, z], 0.03, 0.03, edge);
    }
  }
  if (!far)
    for (let a = C.ends[0]; a < C.ends[1]; a += c.step) {
      const b = Math.min(a + c.step, C.ends[1]);
      beam(out, 'iron', [a, road(a) + 0.7, 0], [b, road(b) + 0.7, 0], 0.12, 0.45, edge);
    }
  if (near)
    for (const z of [-12, -9.1, -6.15, -3.18, 3.18, 6.15, 9.1, 12])
      for (let x = C.ends[0] + 2; x < C.ends[1] - 2; x += 18)
        strip(
          out,
          'marking',
          x,
          Math.min(x + 3, C.ends[1]),
          z - 0.075,
          z + 0.075,
          0.015,
          0.016,
          [0.83, 0.82, 0.72],
          false,
        );
}
function supports(out, c) {
  for (let i = 1; i <= 6; i++) {
    const x = C.stations[i],
      top = road(x) - 3.2,
      cy = top - 7.2;
    const outline = [
      [-11, 0],
      [11, 0],
      [11, top - 1.1],
      [12.8, top],
      [-12.8, top],
      [-11, top - 1.1],
    ];
    const hole = Array.from({ length: c.hole }, (_, j) => [
      4.5 * Math.cos((2 * Math.PI * j) / c.hole),
      cy + 4.5 * Math.sin((2 * Math.PI * j) / c.hole),
    ]);
    across(out, x, outline, 2.5, concrete, [hole]);
  }
  for (const x of [C.stations[0], C.stations.at(-1)])
    box(out, 'concrete', [x - 2.4, 0, -15.8], [x + 2.4, road(x) - 0.28, 15.8], concrete);
}
function pylon(out, c, far, near) {
  const crown = C.archCrown;
  const arc = Array.from({ length: c.arch + 1 }, (_, i) => [
    -3.12 * Math.cos((Math.PI * i) / c.arch),
    crown - 7.7 + 7.7 * Math.sin((Math.PI * i) / c.arch),
  ]);
  const outline = [
    [-24.8, 0],
    [-18.65, 0],
    [-3.12, crown - 7.7],
    ...arc.slice(1),
    [18.65, 0],
    [24.8, 0],
    [5.35, 88],
    [3.85, 119],
    [-3.85, 119],
    [-5.35, 88],
  ];
  const holes = C.galleryLevels.map((y) => [
    [-2.65, y - 1.3],
    [2.65, y - 1.3],
    [2.65, y + 1.3],
    [-2.65, y + 1.3],
  ]);
  across(out, px, outline, 5.3, concrete, holes);
  for (const s of [-1, 1])
    box(out, 'concrete', [px - 5.3, 0, s * 21.2 - 7], [px + 5.3, 1, s * 21.2 + 7], edge);
  box(out, 'concrete', [px - 3.4, road(px) - 4.7, -17.8], [px + 3.4, road(px) - 3, 17.8], edge);
  if (!far)
    for (const side of [-1, 1])
      for (const y of C.galleryLevels) {
        box(
          out,
          'iron',
          [px + side * 0.75 - 0.04, y - 1.24, -2.6],
          [px + side * 0.75 + 0.04, y + 1.24, 2.6],
          cable,
        );
        box(
          out,
          'concrete',
          [Math.min(px + side * 2.6, px + side * 3.25), y + 1.3, -3.13],
          [Math.max(px + side * 2.6, px + side * 3.25), y + 1.66, 3.13],
          edge,
        );
      }
  if (near)
    for (const side of [-1, 1]) {
      const shield = [
        [-2.2, 4.4],
        [2.2, 4.4],
        [2, 1.4],
        [1.3, 0.2],
        [0, -0.7],
        [-1.3, 0.2],
        [-2, 1.4],
        [-2.2, 4.4],
      ];
      for (let i = 1; i < shield.length; i++)
        beam(
          out,
          'copper',
          [px + side * 2.74, 114 + shield[i - 1][1], shield[i - 1][0]],
          [px + side * 2.74, 114 + shield[i][1], shield[i][0]],
          0.18,
          0.18,
          [0.29, 0.28, 0.19],
        );
      for (const z of [-1.2, 1.2])
        beam(
          out,
          'iron',
          [px + side * 2.7, 114.8, z],
          [px + side * 2.7, 118, z],
          0.06,
          0.065,
          cable,
        );
    }
  beam(out, 'iron', [px, 119, 0], [px, 126, 0], 0.11, 0.11, edge);
  for (const [j, color] of [
    [0, [0.97, 0.77, 0.05]],
    [1, [0.03, 0.31, 0.7]],
  ]) {
    const p = [
      [px + 0.08, 123.4 + j * 1.1, 0],
      [px + 3.68, 123.4 + j * 1.1, 0],
      [px + 3.68, 124.5 + j * 1.1, 0],
      [px + 0.08, 124.5 + j * 1.1, 0],
    ];
    face(out, 'marking', p, color);
    face(out, 'marking', p.toReversed(), color);
  }
}
function stays(out, c, far, near) {
  for (const side of [-1, 1])
    for (let tier = 0; tier < 3; tier++)
      for (const direction of [-1, 1]) {
        const x = direction < 0 ? px - [80, 145, 210][tier] : px + 84.51,
          upper = 87.2 + tier * 11,
          lower = road(x) + 1.05;
        for (let rope = 0; rope < c.ropes; rope++) {
          const spread = (rope - (c.ropes - 1) / 2) * 0.2,
            a = [px + direction * 2.79, upper, side * (1.45 + spread)],
            b = [x, lower, side * (14.05 + spread * 0.72)];
          const points = Array.from({ length: c.ropeSteps + 1 }, (_, i) => {
            const t = i / c.ropeSteps;
            return a.map((v, k) => v + (b[k] - v) * t - (k === 1 ? 0.45 * 4 * t * (1 - t) : 0));
          });
          tube(out, points, far ? 0.28 : c.ropes === 1 ? 0.2 : 0.09, c.ropeSides);
        }
        if (!far)
          box(
            out,
            'iron',
            [x - 2.1, lower - 0.35, side * 14.05 - 1.1],
            [x + 2.1, lower + 0.35, side * 14.05 + 1.1],
            [0.64, 0.57, 0.28],
          );
        if (near)
          for (const t of [0.32, 0.63, 0.88]) {
            const x0 = px + (x - px) * t,
              y = upper + (lower - upper) * t - 0.45 * 4 * t * (1 - t),
              z = side * (1.45 + 12.6 * t);
            beam(
              out,
              'iron',
              [x0, y - 0.32, z - 0.55],
              [x0, y + 0.32, z + 0.55],
              0.09,
              0.075,
              edge,
            );
          }
      }
}
function lamps(out, c, near) {
  if (!c.lamp) return;
  const poles = [];
  for (let x = C.ends[0] + 12; x < C.ends[1]; x += c.lamp) poles.push(x);
  for (const x of poles)
    for (const side of [-1, 1]) {
      const y = road(x),
        z = side * 13.7;
      beam(out, 'iron', [x, y, z], [x, y + 11.78, z], 0.18, 0.18, [0.62, 0.65, 0.6]);
      const points = Array.from({ length: near ? 5 : 3 }, (_, i) => {
        const t = i / (near ? 4 : 2);
        return [x, y + 10.35 + 1.1 * t * t, z - side * (0.1 + 2.7 * t)];
      });
      for (let i = 1; i < points.length; i++)
        beam(out, 'iron', points[i - 1], points[i], 0.095, 0.095, edge);
      box(
        out,
        'iron',
        [x - 0.15, y + 11.4, z - side * 2.8 - 0.43],
        [x + 0.15, y + 11.65, z - side * 2.8 + 0.43],
        iron,
      );
    }
  if (near)
    for (let i = 1; i < poles.length; i++)
      for (const z of [-11.8, -11.2, 11.2, 11.8]) {
        const a = poles[i - 1],
          b = poles[i];
        tube(
          out,
          [
            [a, road(a) + 6.15, z],
            [(a + b) / 2, road((a + b) / 2) + 5.92, z],
            [b, road(b) + 6.15, z],
          ],
          0.025,
          4,
        );
      }
}
export function buildPivnichnyiLevel(target, level) {
  const c = configs[level];
  if (!c) throw Error('Unknown Pivnichnyi runtime level');
  const far = level === 'skyline',
    near = level === 'closeup',
    out = writer(target, far);
  deck(out, c, far, near);
  supports(out, c);
  pylon(out, c, far, near);
  stays(out, c, far, near);
  lamps(out, c, near);
  if (near) {
    pivnichnyiPlaques(out);
    for (const side of [-1, 1])
      for (let x = C.ends[0] + 0.4; x < C.ends[1]; x += 16) {
        const y = road(x),
          z = side * 15.53;
        tube(
          out,
          Array.from({ length: 7 }, (_, i) => {
            const t = i / 6;
            return [
              x + 0.32 * Math.sin(t * Math.PI),
              y + 1.43 + 0.48 * Math.sin(t * Math.PI),
              z + side * 0.85 * t,
            ];
          }),
          0.023,
          4,
          blue,
        );
        const loop = Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          return [
            x + 0.27 * Math.cos(t * Math.PI * 2),
            y + 1.13,
            z + side * (0.62 + 0.17 * Math.sin(t * Math.PI * 2)),
          ];
        });
        pivnichnyiRounded(out, 'iron', loop, 0.018, blue, 4);
      }
  }
}
