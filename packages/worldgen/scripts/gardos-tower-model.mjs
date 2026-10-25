/** Mapped Gardoš compound: open gallery, paired capped turrets and tall arched shaft. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildGardosTower(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    n = detail === 0 ? 8 : 16,
    ring = (x, z, radius, count = n) =>
      Array.from({ length: count }, (_, i) => [
        x + radius * Math.cos((i * Math.PI * 2) / count),
        z + radius * Math.sin((i * Math.PI * 2) / count),
      ]),
    cylinder = (role, x, z, radius, lo, hi, count = n) =>
      prism(f, role, { outline: ring(x, z, radius, count) }, lo, hi),
    polygon = (role, rings, map, normal) => {
      const ps = rings.flat(),
        holes = [];
      let offset = rings[0].length;
      for (const ring of rings.slice(1)) {
        holes.push(offset);
        offset += ring.length;
      }
      const indices = earcut(ps.flat(), holes);
      for (let i = 0; i < indices.length; i += 3)
        f(
          role,
          indices.slice(i, i + 3).map((j) => map(ps[j])),
          normal,
        );
    },
    rectangle = (s, lo, w, h) => [
      [s - w / 2, lo],
      [s + w / 2, lo],
      [s + w / 2, lo + h],
      [s - w / 2, lo + h],
    ],
    arch = (s, lo, w, spring, steps = 8) => [
      [s - w / 2, lo],
      [s + w / 2, lo],
      ...Array.from({ length: steps + 1 }, (_, i) => {
        const a = (i * Math.PI) / steps;
        return [s + (w / 2) * Math.cos(a), spring + (w / 2) * Math.sin(a)];
      }),
    ],
    solid = (role, rings, map, normal, u, front = 0, back = -0.32) => {
      polygon(role, rings, (p) => map(...p, front), normal);
      polygon(
        role,
        rings,
        (p) => map(...p, back),
        normal.map((v) => -v),
      );
      for (const [k, ring] of rings.entries()) {
        const sign =
          Math.sign(
            ring.reduce((s, a, i) => {
              const b = ring[(i + 1) % ring.length];
              return s + a[0] * b[1] - a[1] * b[0];
            }, 0),
          ) * (k ? -1 : 1);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            s = (b[1] - a[1]) * sign,
            y = (a[0] - b[0]) * sign;
          f(
            role,
            [map(...a, back), map(...b, back), map(...b, front), map(...a, front)],
            [u[0] * s, y, u[2] * s],
          );
        }
      }
    },
    edge = (a, b) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / length, 0, (b[1] - a[1]) / length],
        normal = [u[2], 0, -u[0]];
      return {
        length,
        u,
        normal,
        map: (s, y, d = 0) => [a[0] + u[0] * s + normal[0] * d, y, a[1] + u[2] * s + normal[2] * d],
      };
    },
    profile = (role, x, z, levels, count = n) => {
      for (let j = 1; j < levels.length; j++)
        for (let i = 0; i < count; i++) {
          const a = (i * Math.PI * 2) / count,
            b = ((i + 1) * Math.PI * 2) / count,
            point = (level, angle) => [
              x + level[1] * Math.cos(angle),
              level[0],
              z + level[1] * Math.sin(angle),
            ],
            lo = levels[j - 1],
            hi = levels[j],
            mid = (a + b) / 2;
          f(
            role,
            [point(lo, a), point(lo, b), point(hi, b), point(hi, a)],
            [Math.cos(mid), (lo[1] - hi[1]) / (hi[0] - lo[0]), Math.sin(mid)],
          );
        }
      const first = levels[0],
        last = levels.at(-1);
      polygon(role, [ring(x, z, first[1], count)], ([x, z]) => [x, first[0], z], [0, -1, 0]);
      polygon(role, [ring(x, z, last[1], count)], ([x, z]) => [x, last[0], z], [0, 1, 0]);
    },
    annulus = (role, x, z, inner, outer, lo, hi, start, end, steps) => {
      const points = [];
      for (let i = 0; i <= steps; i++) {
        const a = start + ((end - start) * i) / steps;
        points.push([x + outer * Math.cos(a), z + outer * Math.sin(a)]);
      }
      for (let i = steps; i >= 0; i--) {
        const a = start + ((end - start) * i) / steps;
        points.push([x + inner * Math.cos(a), z + inner * Math.sin(a)]);
      }
      prism(f, role, { outline: points }, lo, hi);
    };
  const outer =
    detail === 0
      ? [
          [-5.206, -2.567],
          [-3.97, -2.57],
          [-3.97, -4.809],
          [2.21, -4.286],
          [4.66, -2.23],
          [5.206, 0],
          [4.61, 2.35],
          [2.11, 4.34],
          [-4.03, 4.809],
          [-4.05, 2.483],
          [-5.206, 2.486],
        ]
      : r.outer;
  prism(f, 'stone', { outline: outer }, r.minGround - F - 0.35, 1.6);
  prism(f, 'wall', { outline: outer }, 1.6, r.baseTop);
  prism(f, 'stone', { outline: outer }, r.baseTop, r.galleryFloor);
  // Front closed door sits inside a projecting stepped portal, rather than an open black hole.
  const entryMap = (s, y, d = 0) => [-5.23 - d, y, s],
    entryN = [-1, 0, 0],
    entryU = [0, 0, 1];
  const door = arch(0, 0.08, 1.75, 3.2, detail > 1 ? 10 : 4);
  polygon('panel', [door], (p) => entryMap(...p, 0.02), entryN);
  if (detail) {
    const surround = arch(0, 0, 2.6, 3.2, 10);
    solid('stone', [surround, door], entryMap, entryN, entryU, 0.38, 0.04);
    for (let i = 0; i < 3; i++)
      box(f, 'stone', -5.55, 3.95 + i * 0.32, 0, 0.48, 0.34, 2.0 - i * 0.4);
    for (const z of [-1.85, 1.85]) {
      const map = (s, y, d = 0) => [-5.24 - d, y, s];
      solid(
        'stone',
        [rectangle(z, 5.2, 0.72, 1.75), rectangle(z, 5.38, 0.4, 1.3)],
        map,
        entryN,
        entryU,
        0.14,
        0.02,
      );
      polygon('glass', [rectangle(z, 5.38, 0.4, 1.3)], (p) => map(...p, 0.025), entryN);
    }
  }
  // Main shaft is a closed hollow shell with genuinely recessed arched panes.
  const shaft =
    detail === 0
      ? ring(r.shaftX, 0, r.shaftRadius, 8)
      : Array.from({ length: 8 }, (_, i) =>
          [-0.34, 0.34].map((a) => [
            r.shaftX + r.shaftRadius * Math.cos((i * Math.PI) / 4 + a),
            r.shaftRadius * Math.sin((i * Math.PI) / 4 + a),
          ]),
        ).flat();
  if (detail === 0) prism(f, 'wall', { outline: shaft }, r.galleryFloor, r.shaftTop);
  else {
    for (let i = 0; i < shaft.length; i++) {
      const e = edge(shaft[i], shaft[(i + 1) % shaft.length]),
        holes = [];
      if (i % 4 === 0) holes.push(arch(e.length / 2, 24.1, Math.min(1.55, e.length * 0.8), 27.0));
      if (detail > 1 && i % 4 === 0) holes.push(rectangle(e.length / 2, 12.0, 0.72, 2.75));
      solid(
        'wall',
        [rectangle(e.length / 2, r.galleryFloor, e.length, r.shaftTop - r.galleryFloor), ...holes],
        e.map,
        e.normal,
        e.u,
      );
      for (const hole of holes) {
        polygon('glass', [hole], (p) => e.map(...p, -0.2), e.normal);
        const x = hole.reduce((s, p) => s + p[0] / hole.length, 0),
          lo = Math.min(...hole.map((p) => p[1]));
        solid('stone', [rectangle(x, lo - 0.19, 1.55, 0.2)], e.map, e.normal, e.u, 0.28, -0.12);
      }
    }
  }
  cylinder('stone', r.shaftX, 0, r.shaftRadius, r.galleryFloor - 0.16, r.galleryFloor);
  cylinder('stone', r.shaftX, 0, 3.27, 29.5, r.headTop);
  if (detail) {
    for (const i of [2, 6, 10, 14]) {
      const e = edge(shaft[i], shaft[(i + 1) % shaft.length]);
      solid(
        'wall',
        [rectangle(e.length / 2, r.galleryTop - 0.3, 0.72, 13.1)],
        e.map,
        e.normal,
        e.u,
        0.34,
        -0.15,
      );
      solid('stone', [arch(e.length / 2, 30.1, 0.86, 30.65)], e.map, e.normal, e.u, 0.39, -0.15);
    }
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) * Math.PI) / 8,
        normal = [Math.cos(a), 0, Math.sin(a)],
        u = [-Math.sin(a), 0, Math.cos(a)],
        map = (s, y, d = 0) => [
          r.shaftX + (3.27 + d) * normal[0] + s * u[0],
          y,
          (3.27 + d) * normal[2] + s * u[2],
        ];
      polygon('metal', [arch(0, 29.67, 0.25, 29.92, 4)], (p) => map(...p, 0.025), normal);
    }
  }
  profile('roof', r.shaftX, 0, [
    [r.headTop, 3.14],
    [30.8, 3.05],
    [34.7, 0.48],
    [r.roofTop, 0.08],
  ]);
  cylinder('metal', r.shaftX, 0, 0.055, r.roofTop, r.finialTop, 6);
  // The gallery remains open between real columns; its curved and straight parts are both supported.
  const steps = detail ? 12 : 6;
  annulus(
    'stone',
    r.shaftX,
    0,
    2.95,
    4.65,
    r.baseTop,
    r.galleryFloor,
    -Math.PI / 2,
    Math.PI / 2,
    steps,
  );
  annulus(
    'stone',
    r.shaftX,
    0,
    2.95,
    4.65,
    r.galleryTop - 0.45,
    r.galleryTop,
    -Math.PI / 2,
    Math.PI / 2,
    steps,
  );
  const arcColumns = detail ? 9 : 5;
  for (let i = 0; i < arcColumns; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / (arcColumns - 1),
      x = r.shaftX + 4.4 * Math.cos(a),
      z = 4.4 * Math.sin(a);
    cylinder('stone', x, z, 0.22, r.galleryFloor, r.galleryTop - 0.45, detail > 1 ? 12 : 6);
    if (detail) {
      cylinder('stone', x, z, 0.3, r.galleryFloor, r.galleryFloor + 0.32, 8);
      cylinder('stone', x, z, 0.31, r.galleryTop - 0.75, r.galleryTop - 0.45, 8);
    }
  }
  box(f, 'stone', -3.85, r.baseTop, 0, 3.4, r.galleryFloor - r.baseTop, 5.3);
  box(f, 'stone', -3.85, r.galleryTop - 0.45, 0, 3.4, 0.45, 5.3);
  for (const z of [-4.15, 4.15]) box(f, 'stone', -1.25, r.galleryTop - 0.45, z, 3.8, 0.45, 1.0);
  for (const z of detail ? [-2.3, -0.8, 0.8, 2.3] : [-2.1, 0, 2.1])
    cylinder('stone', -5.22, z, 0.22, r.galleryFloor, r.galleryTop - 0.45, detail > 1 ? 12 : 6);
  if (detail > 1) {
    annulus('metal', r.shaftX, 0, 4.43, 4.48, 12.14, 12.2, -Math.PI / 2, Math.PI / 2, 16);
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 12;
      cylinder(
        'metal',
        r.shaftX + 4.46 * Math.cos(a),
        4.46 * Math.sin(a),
        0.035,
        r.galleryFloor,
        12.2,
        6,
      );
    }
  }
  // The two small front turrets are independent capped volumes attached to the same lower body.
  for (const z of [-3.45, 3.45]) {
    const x = -3.35;
    cylinder('wall', x, z, 1.07, r.galleryFloor - 0.3, 22.5);
    cylinder('stone', x, z, 1.18, 22.5, 23.0);
    profile('roof', x, z, [
      [23, 1.16],
      [23.45, 1.22],
      [24.1, 0.94],
      [24.65, 0.25],
      [24.8, 0.1],
    ]);
    cylinder('metal', x, z, 0.055, 24.8, 25.4, 6);
    if (detail) {
      // Narrow glazed slits and a broad stone sill read without modelling sub-pixel window bars.
      const a = z < 0 ? -Math.PI / 2 : Math.PI / 2,
        nx = Math.cos(a),
        nz = Math.sin(a),
        u = [-nz, 0, nx],
        normal = [nx, 0, nz],
        map = (s, y, d = 0) => [x + (1.07 + d) * nx + s * u[0], y, z + (1.07 + d) * nz + s * u[2]];
      polygon('glass', [rectangle(0, 19.1, 0.32, 1.8)], (p) => map(...p, 0.035), normal);
      solid('stone', [rectangle(0, 18.95, 0.53, 0.15)], map, normal, u, 0.12, 0.01);
    }
  }
}
