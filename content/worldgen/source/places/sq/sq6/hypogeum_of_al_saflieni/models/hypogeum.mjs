import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  cave: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.99 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const yellow = rgb('b2a37c'),
  pale = rgb('d6caae'),
  white = rgb('dddcd1');
const ledge = rgb('b7a78b'),
  rock = rgb('a28a69'),
  roof = rgb('9e907c'),
  dark = rgb('4b4238');
const steel = rgb('828580'),
  glass = rgb('536365'),
  ochre = rgb('975d46');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
const pt = ([x, z], y) => [x, y, z];
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const blend = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const up = [0, 1, 0],
  down = [0, -1, 0];

function face(out, slot, coords, color, toward) {
  let points = coords.map((p) => world(p).map(Math.fround));
  if (toward) {
    const normal = world(toward);
    if (normalFor(...points).reduce((sum, v, i) => sum + v * normal[i], 0) < 0)
      points = points.toReversed();
  }
  for (let i = 1; i < points.length - 1; i++) {
    const tri = [points[0], points[i], points[i + 1]],
      n = normalFor(...tri);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
  }
}

function cap(out, slot, [ring, ...holes], y, color, normal = up) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Ħal Saflieni section');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = [0, 1, 2].map((j) =>
      positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3),
    );
    face(out, slot, points, color, normal);
  }
}

function lip(out, slot, ring, low, high, color) {
  const p = area(ring) < 0 ? ring : ring.toReversed();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(out, slot, [pt(a, low), pt(b, low), pt(b, high), pt(a, high)], color);
  }
}

function solid(out, slot, ring, low, high, color, top = color) {
  lip(out, slot, ring, low, high, color);
  cap(out, slot, [ring], high, top);
}

function facade(out, detail) {
  const floor = -0.45,
    eaves = 8.29,
    facadeZ = 12.805666;
  for (const [ring] of site.annex)
    solid(out, 'limestone', ring, floor, ring.some((p) => p[0] < -1) ? 6.05 : 3.76, yellow, roof);
  solid(out, 'limestone', site.upperShell, floor, eaves, pale, roof);
  // Painted masonry begins below the upper row of vent grilles.
  const normal = [0, 0, 1];
  const panel = (x, X, y, Y, z, tint, slot = 'plaster') =>
    face(
      out,
      slot,
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      tint,
      normal,
    );
  panel(6.165, 11.287, 0.12, 5.56, facadeZ + 0.017, yellow);
  panel(6.165, 11.287, -0.33, 0.2, facadeZ + 0.023, ledge, 'limestone');
  const x = 7.83,
    r = 1.39,
    spring = 5.88;
  const segments = [5, 8, 12, 18][detail];
  panel(x - r, x + r, 0.18, spring, facadeZ + 0.027, white);
  for (let i = 0; i < segments; i++) {
    const t = (2 * i) / segments - 1,
      u = (2 * (i + 1)) / segments - 1;
    const y = spring + 1.09 * Math.sqrt(Math.max(0, 1 - t * t));
    const h = spring + 1.09 * Math.sqrt(Math.max(0, 1 - u * u));
    face(
      out,
      'plaster',
      [
        [x + t * r, spring, facadeZ + 0.027],
        [x + u * r, spring, facadeZ + 0.027],
        [x + u * r, h, facadeZ + 0.027],
        [x + t * r, y, facadeZ + 0.027],
      ],
      white,
      normal,
    );
  }
  panel(7.24, 8.36, 0.17, 2.57, facadeZ + 0.052, ledge, 'limestone');
  panel(7.34, 8.26, 0.22, 2.39, facadeZ + 0.061, dark, 'dark');
  const medallion = (rad, z) =>
    Array.from({ length: detail >= 2 ? 18 : 8 }, (_, i) => {
      const a = (2 * Math.PI * i) / (detail >= 2 ? 18 : 8);
      return [7.89 + rad * Math.cos(a), 5.47 + rad * 0.77 * Math.sin(a), z];
    });
  face(out, 'limestone', medallion(0.34, facadeZ + 0.039), ledge, normal);
  face(out, 'dark', medallion(0.269, facadeZ + 0.048), glass, normal);
  if (!detail) return;
  for (const y of [5.55, 7.51, 8.12]) {
    const a = [6.167, y, facadeZ + 0.052],
      b = [11.285, y, facadeZ + 0.052];
    beam(out, 'limestone', world(a), world(b), 0.11, 0.165, ledge);
  }
  const louver = (x, w, y, h, bars) => {
    panel(x - w / 2, x + w / 2, y, y + h, facadeZ + 0.034, glass, 'dark');
    for (let i = 1; i <= bars; i++) {
      const a = y + (i * h) / (bars + 1);
      panel(x - w / 2, x + w / 2, a, a + 0.017, facadeZ + 0.045, steel, 'iron');
    }
  };
  for (let i = 0; i < 9; i++) louver(6.51 + 0.549 * i, 0.315, 7.04, 0.36, detail >= 2 ? 4 : 1);
  louver(10.14, 0.85, 2.64, 0.72, detail >= 2 ? 11 : 3);
  panel(7.878 - 0.013, 7.878 + 0.013, 5.27, 5.67, facadeZ + 0.065, white);
  panel(7.63, 8.14, 5.46, 5.476, facadeZ + 0.065, white);
  const ramp = [
    [7.21, 0.27, 13.12],
    [7.21, 0.27, 14.29],
    [10.04, -0.03, 14.29],
    [10.04, -0.03, 13.12],
  ];
  face(out, 'iron', ramp, steel, up);
  if (detail < 2) return;
  for (const z of [13.11, 14.28]) {
    for (const x of [7.22, 8.18, 9.09, 10.03]) {
      const y = 0.27 - (x - 7.22) * 0.107;
      beam(out, 'iron', world([x, y, z]), world([x, y + 0.83, z]), 0.035, 0.035, steel);
    }
    for (const h of [0.49, 0.82])
      beam(
        out,
        'iron',
        world([7.21, 0.27 + h, z]),
        world([10.04, -0.03 + h, z]),
        0.032,
        0.035,
        steel,
      );
  }
}

function cave(out, level, detail) {
  const { floor, height } = level;
  const ceiling = floor + height;
  for (const p of level.floors) cap(out, 'cave', p, floor, rock);
  for (const p of level.ceilings) cap(out, 'cave', p, ceiling, ledge, down);
  for (const polygon of level.rings) {
    for (const [index, ring] of polygon.entries()) {
      const order = area(ring) < 0 === index > 0 ? ring : ring.toReversed();
      const section = order.map(([x, z], i) => {
        const a = order[(i + order.length - 1) % order.length],
          b = order[(i + 1) % order.length];
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          span = Math.max(0.03, Math.hypot(dx, dz));
        const offset = (h, d) => [x - (d * dz) / span, h, z + (d * dx) / span];
        const phase = 0.86 * x + 1.17 * z;
        return [
          [x, floor, z],
          offset(floor + height * (0.3 + 0.095 * Math.sin(phase)), 0.087 * Math.sin(phase * 1.39)),
          offset(
            floor + height * (0.75 + 0.076 * Math.cos(phase)),
            0.1 + 0.12 * Math.cos(phase * 0.8),
          ),
          [x, ceiling, z],
        ];
      });
      for (let i = 0; i < order.length; i++) {
        const a = order[i],
          b = order[(i + 1) % order.length];
        const mid = blend(a, b, 0.5);
        const opening = site.sections.some(({ from, to, bottom, top, width }) => {
          const dx = to[0] - from[0],
            dz = to[1] - from[1],
            span = Math.hypot(dx, dz);
          const x = mid[0] - from[0],
            z = mid[1] - from[1],
            t = (x * dx + z * dz) / (span * span);
          const y = top + (bottom - top) * t;
          return (
            t >= 0 &&
            t <= 1 &&
            Math.abs(x * dz - z * dx) / span < width * 0.48 &&
            y + 0.11 < ceiling &&
            y + 1.65 > floor
          );
        });
        if (opening) continue;
        const p = section[i],
          q = section[(i + 1) % section.length];
        const tint = blend(rock, ledge, 0.32 + 0.15 * Math.sin(a[0] * 0.7 + a[1] * 1.16));
        for (let j = 0; j < 3; j++)
          face(
            out,
            'cave',
            [p[j], q[j], q[j + 1], p[j + 1]],
            j === 2 && detail === 3 ? blend(tint, ledge, 0.2) : tint,
          );
      }
    }
  }
}

function stair(out, route, sealedEntrance) {
  const { from, to, bottom, top, width } = route;
  const dx = to[0] - from[0],
    dz = to[1] - from[1],
    span = Math.hypot(dx, dz);
  const side = [dz / span, 0, -dx / span];
  const at = (t, h, v) => [from[0] + dx * t + side[0] * v, h, from[1] + dz * t + side[2] * v];
  const n = route.steps ?? 12;
  const walk = width / 2;
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      y = top + (bottom - top) * a,
      h = top + (bottom - top) * b;
    face(
      out,
      'cave',
      [at(a, y, -walk), at(b, y, -walk), at(b, y, walk), at(a, y, walk)],
      ledge,
      up,
    );
    face(out, 'cave', [at(b, y, -walk), at(b, h, -walk), at(b, h, walk), at(b, y, walk)], rock);
  }
  for (const hand of [-1, 1]) {
    face(
      out,
      'cave',
      [
        at(0, top, hand * walk),
        at(1, bottom, hand * walk),
        at(1, bottom + 1.81, hand * walk),
        at(0, top + 1.81, hand * walk),
      ],
      rock,
      side.map((v) => -hand * v),
    );
  }
  face(
    out,
    'cave',
    [
      at(0, top + 1.81, -walk),
      at(1, bottom + 1.81, -walk),
      at(1, bottom + 1.81, walk),
      at(0, top + 1.81, walk),
    ],
    rock,
    down,
  );
  if (sealedEntrance)
    face(
      out,
      'cave',
      [at(0, top, -walk), at(0, top, walk), at(0, top + 1.81, walk), at(0, top + 1.81, -walk)],
      rock,
      [dx, 0, dz],
    );
}

function trilithon(out, origin, look, base, width, height, shell = 1) {
  const dx = look[0] - origin[0],
    dz = look[1] - origin[1],
    r = Math.hypot(dx, dz);
  const along = [dx / r, dz / r],
    side = [-along[1], along[0]];
  const at = (u, v) => origin.map((n, i) => n + side[i] * u + along[i] * v);
  const shape = (a, b, d, f) => [at(a, d), at(a, f), at(b, f), at(b, d)];
  const inner = width * 0.28,
    outer = width * 0.5;
  for (const hand of [-1, 1]) {
    const [a, b] = hand < 0 ? [-outer, -inner] : [inner, outer];
    solid(out, 'cave', shape(a, b, -0.25 * shell, 0.24 * shell), base, base + height - 0.29, pale);
  }
  solid(
    out,
    'cave',
    shape(-outer - 0.12, outer + 0.12, -0.35 * shell, 0.28 * shell),
    base + height - 0.29,
    base + height,
    pale,
  );
}

function ritualChambers(out, detail) {
  const sitePlan = site.positions;
  const [x, z] = sitePlan.holyOfHolies;
  const main = sitePlan.mainChamber;
  const center = blend(main, [x, z], 0.72);
  trilithon(out, center, [x, z], -5.9, 3.75, 2.18, 1.55);
  trilithon(out, blend(main, [x, z], 0.81), [x, z], -5.89, 2.61, 1.88, 1.15);
  trilithon(out, blend(main, [x, z], 0.94), [x, z], -5.89, 1.72, 1.63, 0.83);
  const local = (dx, dz) => [x + dx, z + dz];
  const stoneFloor = Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI * i) / 6;
    return local(1.36 * Math.cos(a), 1.08 * Math.sin(a));
  });
  solid(out, 'cave', stoneFloor, -5.91, -5.64, ledge);
  const segments = detail === 2 ? 12 : 28;
  for (let band = 0; band < 3; band++) {
    const rad = 2.14 - 0.26 * band,
      y = -4.09 + 0.27 * band;
    for (let i = 0; i < segments; i++) {
      const a = (-0.1 + (i / segments) * 1.75) * Math.PI,
        b = (-0.1 + ((i + 1) / segments) * 1.75) * Math.PI;
      const wedge = (r, u, h) => [x + r * Math.cos(u), h, z + 0.88 * r * Math.sin(u)];
      face(
        out,
        'cave',
        [wedge(rad + 0.16, a, y), wedge(rad + 0.16, b, y), wedge(rad, b, y), wedge(rad, a, y)],
        ledge,
        down,
      );
      face(
        out,
        'cave',
        [wedge(rad, a, y), wedge(rad, b, y), wedge(rad, b, y + 0.25), wedge(rad, a, y + 0.25)],
        pale,
        [Math.cos(a + Math.PI), 0, Math.sin(a + Math.PI)],
      );
    }
  }
  const pit = site.pit;
  for (let i = 0; i < pit.length; i++) {
    const a = pit[i],
      b = pit[(i + 1) % pit.length];
    face(out, 'cave', [pt(a, -7.21), pt(b, -7.21), pt(b, -5.91), pt(a, -5.91)], rock);
  }
  cap(out, 'cave', [pit], -7.21, dark);
  if (detail === 2) return;
  const [D, E] = sitePlan.decorated;
  for (const [dx, dz, sign] of [
    [-0.53, -0.7, 1],
    [1.16, 0.21, -1],
    [-1.02, 0.93, 1],
    [0.32, 1.42, -1],
  ]) {
    const spiral = Array.from({ length: 32 }, (_, i) => {
      const t = i / 31,
        a = sign * t * 2.85 * Math.PI;
      const r = 0.085 + 0.59 * t;
      return [D + dx + r * Math.cos(a), -3.06, E + dz + r * Math.sin(a)];
    });
    for (let i = 1; i < spiral.length; i++) {
      const a = spiral[i - 1],
        b = spiral[i],
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz);
      const ribbon = (p, v) => [
        p[0] + (v * dz * 0.034) / length,
        p[1],
        p[2] - (v * dx * 0.034) / length,
      ];
      face(out, 'cave', [ribbon(a, -1), ribbon(b, -1), ribbon(b, 1), ribbon(a, 1)], ochre, down);
    }
  }
}

function hypogeum(out, detail) {
  facade(out, detail);
  if (detail < 2) return;
  for (const level of site.levels) cave(out, level, detail);
  for (const [i, route] of site.sections.entries()) stair(out, route, i === 0);
  ritualChambers(out, detail);
}

export const buildSkyline = (out) => hypogeum(out, 0);
export const buildDistrict = (out) => hypogeum(out, 1);
export const buildStreet = (out) => hypogeum(out, 2);
export const buildCloseup = (out) => hypogeum(out, 3);
export const buildMaster = buildCloseup;
