import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.08 },
  gilding: { slot: 'trim', graph: 'metal_copper', roughness: 0.54, metallic: 0.36 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const white = rgb('d3cbb7'),
  limestone = rgb('afa697'),
  brick = rgb('a36c66');
const pink = rgb('bc8c80'),
  green = rgb('557765'),
  greenLight = rgb('658775');
const grey = rgb('7c8285'),
  gold = rgb('bea060'),
  windows = rgb('595550');
const base = rgb('b2aa96');
const up = [0, 1, 0],
  down = [0, -1, 0];
const identity = (p) => p;
const box = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const pt = ([x, z], y) => [x, y, z];
const flat = (y) => () => y;
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function interval(steps, n) {
  const i = Math.max(
    0,
    Math.min(
      steps.length - 2,
      steps.findLastIndex((v) => v <= n),
    ),
  );
  return [i, Math.max(0, Math.min(1, (n - steps[i]) / (steps[i + 1] - steps[i])))];
}

function grade(x, z) {
  const { samples, x: columns, z: rows } = site.grade;
  const [a, t] = interval(columns, x),
    [b, u] = interval(rows, z);
  const h = samples[b][a] + t * (samples[b][a + 1] - samples[b][a]);
  const j = samples[b + 1][a] + t * (samples[b + 1][a + 1] - samples[b + 1][a]);
  return h + u * (j - h) - site.terrainDatum;
}

function frame(p) {
  const [x, z] = p.center,
    a = (p.angle * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const y = grade(x, z);
  return ([u, v, w]) => [x + u * c - w * s, y + v, z + u * s + w * c];
}

function face(out, f, slot, coords, tint, direction) {
  const points = coords.map((p) => f(p).map(Math.fround));
  const v = direction && f(direction).map((v, i) => v - f([0, 0, 0])[i]);
  for (let i = 1; i < points.length - 1; i++) {
    const tri = [points[0], points[i], points[i + 1]],
      n = normalFor(...tri);
    if (Math.hypot(...n) < 0.9) continue;
    if (v && n.reduce((sum, a, i) => sum + a * v[i], 0) < 0)
      out.addTriangle(
        slot,
        '',
        [tri[0], tri[2], tri[1]],
        n.map((v) => -v),
        [],
        tint,
      );
    else out.addTriangle(slot, '', tri, n, [], tint);
  }
}

function cap(out, f, slot, [ring, ...holes], height, tint, direction = up) {
  const scratch = new MeshBufferBuilder();
  if (!scratch.addCap('wall', 'palette:#ffffff', ring, holes, height, up, (p) => p, tint))
    throw Error('Invalid Novodevichy roof outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
    face(out, f, slot, p, tint, direction);
  }
}

function sides(out, f, slot, input, low, high, tint, hole = false) {
  const ring = area(input) < 0 !== hole ? input : input.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(out, f, slot, [pt(a, low(a)), pt(b, low(b)), pt(b, high(b)), pt(a, high(a))], tint);
  }
}

function solid(out, f, slot, ring, low, high, tint, roof = slot, top = tint) {
  sides(out, f, slot, ring, flat(low), flat(high), tint);
  cap(out, f, roof, [ring], flat(high), top);
}

function simple(ring, min = 1.04) {
  const p = [...ring];
  for (let i = p.length - 1; i >= 0 && p.length > 4; i--) {
    const a = p[(i + p.length - 1) % p.length],
      b = p[(i + 1) % p.length],
      q = p[i];
    const x = b[0] - a[0],
      z = b[1] - a[1],
      u = q[0] - a[0],
      v = q[1] - a[1];
    const t = (u * x + v * z) / (x * x + z * z);
    if (t >= 0 && t <= 1 && Math.hypot(u - t * x, v - t * z) < min) p.splice(i, 1);
  }
  return p;
}

function circle(x, z, r, n = 8, angle = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = angle + (2 * Math.PI * i) / n;
    return [x + r * Math.cos(a), z + r * Math.sin(a)];
  });
}

function loft(out, f, slot, profiles, tint) {
  for (let j = 1; j < profiles.length; j++) {
    const [low, a] = profiles[j - 1],
      [high, b] = profiles[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      face(out, f, slot, [pt(a[i], low), pt(b[i], high), pt(b[k], high), pt(a[k], low)], tint);
    }
  }
}

function window(out, f, from, to, low, w, h, detail) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const [x, z] = blend(from, to, 0.5),
    dx = (to[0] - from[0]) / len,
    dz = (to[1] - from[1]) / len;
  const normal = [-dz, 0, dx];
  const p = (u, y, d = 0) => [
    x + dx * u + normal[0] * (d + 0.037),
    y,
    z + dz * u + normal[2] * (d + 0.037),
  ];
  const center = low + h * 0.69;
  if (detail === 1) {
    const r = w / 2;
    face(
      out,
      f,
      'glass',
      [p(-r, low), p(r, low), p(r, center), p(0, low + h), p(-r, center)],
      windows,
      normal,
    );
    return;
  }
  const rim = (slot, r, tint, depth = 0) => {
    const n = detail >= 3 ? 8 : 5;
    face(
      out,
      f,
      slot,
      [p(-r, low, depth), p(r, low, depth), p(r, center, depth), p(-r, center, depth)],
      tint,
      normal,
    );
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n;
      const u = r * Math.cos(a),
        v = r * Math.cos(b);
      face(
        out,
        f,
        slot,
        [
          p(u, center, depth),
          p(v, center, depth),
          p(v, center + h * 0.31 * Math.sin(b), depth),
          p(u, center + h * 0.31 * Math.sin(a), depth),
        ],
        tint,
        normal,
      );
    }
  };
  if (detail >= 2) rim('lime', w * 0.64, white);
  rim('glass', w / 2, windows, 0.019);
}

function facade(out, f, raw, height, detail) {
  if (!detail || height < 5.2) return;
  const ring = area(raw) < 0 ? raw : raw.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const n = Math.floor(length / (detail === 1 ? 8.1 : 4.95));
    for (let j = 0; j < n; j++) {
      const p = blend(a, b, j / n),
        q = blend(a, b, (j + 1) / n);
      window(out, f, p, q, height * 0.47, 1.05, Math.min(2.15, height * 0.24), detail);
      if (detail >= 2 && height > 8.4) window(out, f, p, q, height * 0.14, 0.89, 1.46, 1);
    }
  }
}

function existingRoof(out, f, p, eave, rise, detail, slot, tint) {
  if (!detail) {
    solid(
      out,
      f,
      slot,
      simple(p.plan, 4.31),
      -2.75,
      eave + Math.min(1.24, rise * 0.46),
      tint,
      'iron',
      green,
    );
    return;
  }
  const [, , z, Z] = p.bounds,
    m = (z + Z) / 2;
  const y = ([, v]) => eave + rise * Math.max(0, 1 - Math.abs((v - m) / ((Z - z) / 2)));
  const polygon = p.plan.flatMap((a, i) => {
    const b = p.plan[(i + 1) % p.plan.length];
    return (a[1] - m) * (b[1] - m) < 0 ? [a, blend(a, b, (m - a[1]) / (b[1] - a[1]))] : [a];
  });
  sides(out, f, slot, polygon, flat(-2.75), y, tint);
  for (const slope of p.roofs) cap(out, f, 'iron', [detail ? slope : simple(slope)], y, green);
}

function cross(out, f, x, z, y, h, detail) {
  const w = detail === 0 ? 0.15 : 0.11;
  beam(out, 'gilding', f([x, y, z]), f([x, y + h, z]), w, w, gold);
  beam(
    out,
    'gilding',
    f([x - h * 0.31, y + h * 0.64, z]),
    f([x + h * 0.31, y + h * 0.64, z]),
    w,
    w,
    gold,
  );
  if (detail >= 2) {
    beam(
      out,
      'gilding',
      f([x - h * 0.15, y + h * 0.86, z]),
      f([x + h * 0.15, y + h * 0.86, z]),
      w * 0.8,
      w * 0.8,
      gold,
    );
    beam(
      out,
      'gilding',
      f([x - h * 0.21, y + h * 0.34, z]),
      f([x + h * 0.21, y + h * 0.44, z]),
      w * 0.8,
      w * 0.8,
      gold,
    );
  }
}

function dome(out, f, x, z, b, r, h, detail, metal = gold) {
  const n = (r <= 1.55 ? [4, 6, 8, 12] : [4, 8, 16, 24])[detail],
    drumHeight = h * 0.48,
    shellY = b + drumHeight;
  const drum = circle(x, z, r * 0.59, n);
  sides(out, f, 'lime', drum, flat(b), flat(shellY), white);
  if (detail >= 2 && drumHeight > 1.35) {
    const ring = drum.toReversed();
    for (let i = 0; i < n; i += n / 4)
      window(out, f, ring[i], ring[(i + 1) % n], b + 0.21, 0.37, drumHeight * 0.72, 1);
  }
  const profiles =
    detail === 0
      ? [
          [0, 0.71],
          [0.29, 1],
        ]
      : detail === 1
        ? [
            [0, 0.71],
            [0.25, 1],
            [0.52, 0.78],
            [0.79, 0.3],
          ]
        : [
            [0, 0.68],
            [0.1, 0.88],
            [0.26, 1],
            [0.42, 0.91],
            [0.59, 0.66],
            [0.77, 0.36],
            [0.94, 0.13],
            [0.98, 0.081],
          ];
  const rings = profiles.map(([y, t]) => [shellY + y * h, circle(x, z, r * t, n)]);
  const slot = metal === gold ? 'gilding' : 'iron';
  loft(out, f, slot, rings, metal);
  const [y, a] = rings.at(-1);
  for (let i = 0; i < n; i++)
    face(out, f, slot, [pt(a[i], y), pt(a[(i + 1) % n], y), [x, shellY + h, z]], metal, up);
  if (detail >= 2 || (detail === 1 && r >= 1.7))
    cross(out, f, x, z, shellY + h, Math.min(2.4, r * 0.73), detail);
}

function hip(out, f, x, X, z, Z, y, h, tint = green) {
  const rw = Math.min((X - x) * 0.23, (Z - z) * 0.36);
  const outer = box(x, X, z, Z);
  const inner = box(x + rw, X - rw, (z + Z) * 0.5 - 0.09, (z + Z) * 0.5 + 0.09);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      f,
      'iron',
      [pt(outer[i], y), pt(outer[j], y), pt(inner[j], y + h), pt(inner[i], y + h)],
      tint,
      up,
    );
  }
  cap(out, f, 'iron', [inner], flat(y + h), tint);
}

function towerCladding(out, p, detail) {
  const f = frame(p),
    main = p.plan;
  const ring = detail ? main : simple(main, 1.56);
  const scale = (ring, r) => ring.map(([x, z]) => [x * r, z * r]);
  const ground = (p.height ?? 10) * 0.74;
  const top = ground + 4.35;
  sides(out, f, 'lime', ring, flat(-2.9), flat(ground), white);
  const crown = scale(ring, 1.04);
  solid(out, f, 'brick', crown, ground, top, brick, 'iron', green);
  if (!detail) return;
  const outline = area(crown) < 0 ? crown : crown.toReversed();
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const n =
      detail === 1 ? 1 : Math.max(1, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / 2.63));
    for (let j = 0; j < n; j++) {
      const l = blend(a, b, j / n),
        r = blend(a, b, (j + 1) / n);
      const c = blend(l, r, 0.1),
        d = blend(l, r, 0.18);
      const normal = [c[0] + d[0], 0, c[1] + d[1]];
      const lift = ([x, z], y) => [x * 1.013, y, z * 1.013];
      if (detail >= 2)
        face(
          out,
          f,
          'lime',
          [lift(c, ground), lift(d, ground), lift(d, top + 0.48), lift(c, top + 0.48)],
          white,
          normal,
        );
      face(
        out,
        f,
        'lime',
        [lift(l, top - 0.46), lift(r, top - 0.46), lift(r, top + 0.09), lift(l, top + 0.09)],
        white,
        normal,
      );
      if (detail >= 2) window(out, f, l, r, ground + 0.78, 0.58, 1.92, 1);
    }
  }
}

function fortifiedWall(out, polygon, detail) {
  const ring = detail ? polygon[0] : simple(polygon[0], 1.71);
  const wallBase = ([x, z]) => grade(x, z) - 2.15;
  const top = ([x, z]) => grade(x, z) + 6.1;
  sides(out, identity, 'lime', ring, wallBase, top, white);
  for (const hole of polygon.slice(1))
    sides(out, identity, 'lime', hole, wallBase, top, white, true);
  cap(out, identity, 'stone', [ring, ...polygon.slice(1)], top, base);
  if (detail < 2) return;
  const p = area(ring) < 0 ? ring : ring.toReversed();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 8) continue;
    const dx = (b[0] - a[0]) / length,
      dz = (b[1] - a[1]) / length;
    const n = Math.ceil(length / (detail === 2 ? 3.87 : 2.35));
    for (let j = 0; j < n; j++) {
      const i0 = blend(a, b, (j + 0.23) / n),
        i1 = blend(a, b, (j + 0.68) / n);
      const base = (outPoint) => pt(outPoint, top(outPoint)),
        peak = (outPoint) => pt(outPoint, top(outPoint) + 0.68);
      const k0 = [i0[0] + dz * 0.44, i0[1] - dx * 0.44],
        k1 = [i1[0] + dz * 0.44, i1[1] - dx * 0.44];
      face(out, identity, 'lime', [base(i0), base(i1), peak(i1), peak(i0)], white);
      face(out, identity, 'lime', [peak(i0), peak(i1), peak(k1), peak(k0)], white, up);
    }
  }
}

function smallBuilding(out, p, detail) {
  const f = frame(p),
    h = p.body ?? Math.max(3.6, (p.height ?? 8.9) - 1.4);
  const plan = detail ? p.plan : simple(p.plan, 2.02);
  existingRoof(
    out,
    f,
    p,
    h,
    Math.min(3.07, (p.bounds[3] - p.bounds[2]) * 0.29),
    detail,
    'lime',
    white,
  );
  facade(out, f, plan, h, detail);
  if (detail && (p.kind === 'chapel' || p.id === 9335358)) {
    dome(
      out,
      f,
      0.13,
      0.26,
      h + 1.18,
      p.kind === 'chapel' ? 1.34 : 1.92,
      p.kind === 'chapel' ? 2.1 : 3.53,
      detail,
    );
  }
}

function gates(out, p, detail) {
  const f = frame(p),
    { center, left, right, shell, chamber } = p.gate;
  const h = p.body;
  for (const ring of shell) solid(out, f, 'lime', detail ? ring : simple(ring), -2.6, h, white);
  const ends = (x) => {
    const z = chamber.filter((p) => Math.abs(p[0] - x) < 0.008).map((p) => p[1]);
    return [Math.min(...z), Math.max(...z)];
  };
  const A = ends(left),
    B = ends(right);
  const n = [2, 5, 10, 16][detail];
  const at = (t, side, y) => [left + t * (right - left), y, A[side] + (B[side] - A[side]) * t];
  const arch = (t) => 2.42 + 1.45 * Math.sqrt(1 - Math.pow(2 * t - 1, 2));
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      u = arch(a),
      w = arch(b);
    for (const s of [0, 1])
      face(out, f, 'lime', [at(a, s, u), at(b, s, w), at(b, s, h), at(a, s, h)], white, [
        0,
        0,
        s ? 1 : -1,
      ]);
    face(out, f, 'stone', [at(a, 0, u), at(b, 0, w), at(b, 1, w), at(a, 1, u)], limestone, down);
  }
  cap(out, f, 'lime', [chamber], flat(h), white);
  const dx = p.id === 3134995 ? -0.48 : 0.1;
  const base = box(-9.02 + dx, 9.47 + dx, -4.65, 4.86);
  solid(out, f, 'brick', base, h, h + 9.17, brick);
  hip(out, f, -9.11 + dx, 9.56 + dx, -4.78, 4.99, h + 9.13, 2.37);
  if (detail >= 2) facade(out, f, base, h + 8.7, detail);
  const tops =
    p.id === 3134995
      ? [
          [0, 0, 2.07],
          [-5.8, -2.27, 1.25],
          [-5.8, 2.28, 1.25],
          [5.8, -2.27, 1.25],
          [5.8, 2.28, 1.25],
        ]
      : [
          [0, 0, 1.77],
          [-5.6, 0, 1.27],
          [5.6, 0, 1.27],
        ];
  for (const [x, z, r] of detail ? tops : tops.slice(0, 1))
    dome(out, f, x + dx, z, h + 10.6, r, 2.95, detail, gold);
}

function apses(out, p, detail) {
  const f = frame(p),
    plan = detail ? p.plan : simple(p.plan, 3.6);
  solid(out, f, 'lime', plan, -2.88, 9.24, white, 'iron', green);
  const cube = box(-16.55, 11.7, -14.5, 15.2);
  solid(out, f, 'lime', cube, 9.21, 22.65, white);
  hip(out, f, -17.12, 12.05, -15.0, 15.7, 22.63, 3.66, green);
  if (detail) {
    const [x, X, z, Z] = [-16.55, 11.7, -14.5, 15.2];
    for (const [u, v, axis, side] of [
      [x, X, 0, 1],
      [x, X, 0, -1],
      [z, Z, 1, 1],
      [z, Z, 1, -1],
    ]) {
      const edge = axis ? (side < 0 ? x : X) : side < 0 ? z : Z;
      const p = (a, y, d) => (axis ? [edge + side * d, y, a] : [a, y, edge + side * d]);
      const n = axis ? [side, 0, 0] : [0, 0, side];
      for (let i = 0; i < 3; i++) {
        const t = u + ((v - u) * (i + 0.5)) / 3,
          r = (v - u) / 6 - 0.25;
        const crown = 23.0,
          spring = 21.12;
        const nseg = detail >= 2 ? 10 : 6;
        for (let j = 0; j < nseg; j++) {
          const a = j / nseg,
            b = (j + 1) / nseg;
          const y = (k) => spring + (crown - spring + 1.92) * Math.sin(Math.PI * k);
          const str = (k) => t + r * (k * 2 - 1);
          face(
            out,
            f,
            'lime',
            [
              p(str(a), spring, 0.16),
              p(str(b), spring, 0.16),
              p(str(b), y(b), 0.16),
              p(str(a), y(a), 0.16),
            ],
            white,
            n,
          );
        }
      }
    }
    const rotated = cube.toReversed();
    const ring = area(rotated) < 0 ? rotated : rotated.toReversed();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      for (let j = 0; j < 3; j++)
        window(out, f, blend(a, b, j / 3), blend(a, b, (j + 1) / 3), 13.75, 1.95, 5.11, detail);
    }
  }
  const y = 24.54;
  for (const x of [-10.7, 5.83])
    for (const z of [-8.73, 9.22]) dome(out, f, x, z, y, 4.02, 5.46, detail, grey);
  dome(out, f, -2.49, 0.25, y + 1.66, 5.59, 8.61, detail);
}

function belfry(out, p, detail) {
  const f = frame(p);
  const ring = area(p.plan) < 0 ? p.plan : p.plan.toReversed();
  const scale = (r) => ring.map(([x, z]) => [x * r, z * r]);
  const profiles = [
    [0, 14, 1],
    [14, 28.9, 0.79],
    [28.9, 44.6, 0.66],
    [44.6, 59.7, 0.54],
    [59.7, 65.16, 0.33],
  ];
  if (!detail) {
    for (const [i, [low, high, r]] of profiles.entries()) {
      const outline = scale(r).filter((_, j) => j % 2 === 0);
      const tint = i === 1 || i === 3 ? pink : brick;
      sides(out, f, 'brick', outline, flat(i === 0 ? -2.1 : low), flat(high - 0.7), tint);
      solid(
        out,
        f,
        'lime',
        outline.map(([x, z]) => [x * 1.085, z * 1.085]),
        high - 0.7,
        high + 0.38,
        white,
      );
    }
    dome(out, f, 0, 0, 64.55, 3.17, 4.28, detail);
    return;
  }
  for (const [i, [low, high, r]] of profiles.entries()) {
    const perimeter = scale(r);
    if (i !== 1 && i !== 3) solid(out, f, 'brick', perimeter, i === 0 ? -2.1 : low, high, brick);
    else {
      const inner = scale(r * 0.78);
      cap(out, f, 'stone', [perimeter], flat(low + 0.31), limestone);
      cap(out, f, 'lime', [perimeter], flat(high - 0.48), white, down);
      for (let j = 0; j < perimeter.length; j++) {
        const k = (j + 1) % perimeter.length,
          a = perimeter[j],
          b = perimeter[k],
          u = inner[j],
          v = inner[k];
        const n = [a[0] + b[0], 0, a[1] + b[1]];
        for (const [l, R] of detail === 1
          ? [[0, 0.214]]
          : [
              [0, 0.214],
              [0.786, 1],
            ]) {
          const A = blend(a, b, l),
            B = blend(a, b, R),
            D = blend(u, v, l),
            E = blend(u, v, R);
          solid(out, f, 'brick', [A, B, E, D], low + 0.19, high, brick);
        }
        const segments = [0, 2, 6, 10][detail];
        const arch = (t) => high - 5.48 + 3.46 * Math.sin(t * Math.PI);
        for (let d = 0; d < segments; d++) {
          const t = d / segments,
            w = (d + 1) / segments;
          const L = 0.214 + t * 0.572,
            R = 0.214 + w * 0.572;
          const a0 = blend(a, b, L),
            a1 = blend(a, b, R),
            b0 = blend(u, v, L),
            b1 = blend(u, v, R);
          const y = arch(t),
            Y = arch(w);
          face(out, f, 'brick', [pt(a0, y), pt(a1, Y), pt(a1, high), pt(a0, high)], brick, n);
          face(out, f, 'lime', [pt(a0, y), pt(b0, y), pt(b1, Y), pt(a1, Y)], white, down);
        }
      }
    }
    const band = scale(r * 1.05);
    solid(
      out,
      f,
      i === 4 ? 'iron' : 'lime',
      band,
      high - 0.43,
      high + 0.32,
      i === 4 ? green : white,
    );
    for (let j = 0; j < perimeter.length; j++) {
      const a = perimeter[j],
        b = perimeter[(j + 1) % perimeter.length];
      const pin = blend(a, b, 0.067);
      if (detail >= 2)
        beam(
          out,
          'lime',
          f([pin[0] * 1.024, low + 0.48, pin[1] * 1.024]),
          f([pin[0] * 1.024, high - 0.36, pin[1] * 1.024]),
          0.255,
          0.33,
          white,
        );
      if (i === 2 || i === 0 || i === 4)
        window(
          out,
          f,
          a,
          b,
          low + 2.23,
          Math.min(2.9, Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.62),
          Math.min(6.46, (high - low) * 0.48),
          detail,
        );
      if (i === 2 && detail >= 2) {
        const [x, z] = blend(a, b, 0.5),
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          span = Math.hypot(dx, dz);
        const n = [-dz / span, 0, dx / span];
        const circle = (r, k) =>
          Array.from({ length: 10 }, (_, j) => {
            const t = (j * 2 * Math.PI) / 10;
            return [
              x + (dx * r * Math.cos(t)) / span + n[0] * k,
              high - 3.57 + r * Math.sin(t),
              z + (dz * r * Math.cos(t)) / span + n[2] * k,
            ];
          });
        face(out, f, 'lime', circle(1.15, 0.04), white, n);
        face(out, f, 'glass', circle(0.87, 0.055), windows, n);
      }
    }
  }
  dome(out, f, 0, 0, 64.55, 3.17, 4.28, detail);
}

function refectory(out, p, detail) {
  smallBuilding(out, p, detail);
  const f = frame(p);
  const shrine = box(-20.95, -3.65, -10.8, 9.78);
  solid(out, f, 'brick', shrine, 7.72, detail ? 16.05 : 18.23, brick, 'iron', green);
  if (detail) hip(out, f, -21.36, -3.23, -11.12, 10.12, 16.04, 3.19);
  dome(out, f, -11.96, -0.63, 18.21, 3.33, 6.11, detail);
}

function monastery(out, detail) {
  for (const p of [...site.walls, [site.eastCurtain]]) fortifiedWall(out, p, detail);
  for (const p of [...site.components, site.westCorner]) {
    if (p.kind === 'perimeter-tower') towerCladding(out, p, detail);
    else if (p.id === 20597062) belfry(out, p, detail);
    else if (p.id === 9328168) apses(out, p, detail);
    else if (p.id === 128945765) refectory(out, p, detail);
    else if (p.gate) gates(out, p, detail);
    else smallBuilding(out, p, detail);
  }
}
export const buildSkyline = (out) => monastery(out, 0);
export const buildDistrict = (out) => monastery(out, 1);
export const buildStreet = (out) => monastery(out, 2);
export const buildCloseup = (out) => monastery(out, 3);
export const buildMaster = buildCloseup;
