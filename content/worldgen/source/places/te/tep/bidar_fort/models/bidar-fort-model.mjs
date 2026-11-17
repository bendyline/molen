/** Bidar's standing laterite walls, palace precinct and approach gates in the mapped site frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const data = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = data('plan-controls.json');
const grid = data('terrain-grid.json');
const { walls, monuments, gates, gateRoutes } = plan.dimensions;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  cut: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    laterite: '9c664b',
    lower: '865b47',
    inside: '936e54',
    cut: 'ae8061',
    inset: '795943',
    pale: 'c1a587',
    plaster: 'c9b69a',
    dome: 'a69b83',
    roof: 'aa9580',
    pavement: 'aa967b',
    dirt: 'a18f70',
  }).map(([k, v]) => [k, rgb(v)]),
);

const up = [0, 1, 0];
const down = [0, -1, 0];
const reverse = (normal) => normal.map((v) => -v);
const at = ([x, z], y) => [x, y, z];
const xz = ([x, , z]) => [x, z];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const mix = (a, b, t) => a + (b - a) * t;
const interpolate = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const middle = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const segments = (path) => path.slice(1).map((b, i) => [path[i], b]);
const ring = (pts) => (dist(pts[0], pts.at(-1)) < 0.02 ? pts.slice(0, -1) : pts);
const loop = (pts) => [...pts, pts[0]];
function grade([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const near = grid.heightsMeters[j];
  const far = grid.heightsMeters[j + 1];
  return (
    mix(mix(near[i], near[i + 1], u - i), mix(far[i], far[i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function face(out, slot, points, toward, color) {
  const normal = normalFor(...points);
  const dot = normal.reduce((sum, n, i) => sum + n * toward[i], 0);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    points,
    dot < 0 ? reverse(normal) : normal,
    ([x, y, z]) => (Math.abs(normal[1]) > 0.65 ? [x, z] : [x - z * 0.73, y]),
    color,
  );
}
function edge(a, b, sign = 1) {
  const length = dist(a, b);
  const x = (b[0] - a[0]) / length;
  const z = (b[1] - a[1]) / length;
  const normal = [z * sign, 0, -x * sign];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [a[0] + x * u + normal[0] * d, y, a[1] + z * u + normal[2] * d],
  };
}
function winding(points) {
  return Math.sign(segments(loop(points)).reduce((s, [[x, z], [a, b]]) => s + x * b - z * a, 0));
}
function clean(points, tol, reach = Infinity) {
  const kept = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = kept.at(-1);
    const b = points[i + 1];
    const p = points[i];
    const base = dist(a, b);
    if (dist(a, p) < 0.025) continue;
    const bend =
      Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) /
      Math.max(base, 0.01);
    if (bend > tol || base > reach || dist(a, p) + dist(p, b) > base + 2 * tol) kept.push(p);
  }
  if (dist(kept.at(-1), points.at(-1)) > 0.025) kept.push(points.at(-1));
  return kept;
}
function panel(out, slot, w, u, v, a, b, depth, color, side = 1) {
  face(
    out,
    slot,
    [w.p(u, a, depth), w.p(v, a, depth), w.p(v, b, depth), w.p(u, b, depth)],
    side === 1 ? w.normal : reverse(w.normal),
    color,
  );
}
function cap(out, slot, points, height, color) {
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => at(points[j], height)),
      up,
      color,
    );
  }
}
function mass(out, points, bottom, top, slot, color, roof = c.roof) {
  const sign = winding(points);
  for (const [a, b] of segments(loop(points))) {
    const w = edge(a, b, sign);
    face(out, slot, [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)], w.normal, color);
  }
  cap(out, slot, points, top, roof);
}
function merlon(out, w, u, y, half, depth, turn, lod, color, rise = 0.75) {
  const profile =
    lod < 3
      ? [
          [-1, 0],
          [1, 0],
          [1, 0.66],
          [0, 1],
          [-1, 0.66],
        ]
      : [
          [-1, 0],
          [1, 0],
          [1, 0.44],
          [0.71, 0.83],
          [0, 1],
          [-0.71, 0.83],
          [-1, 0.44],
        ];
  const pt = ([x, h], side) => w.p(u + x * half, y + h * rise * half * 1.45, side);
  face(
    out,
    'stone',
    profile.map((p) => pt(p, depth + turn)),
    w.normal,
    color,
  );
  face(
    out,
    'stone',
    profile.map((p) => pt(p, depth - turn)),
    reverse(w.normal),
    color,
  );
  for (const [a, b] of segments(profile)) {
    const outward = [
      w.normal[2] * (b[1] - a[1]),
      Math.abs(b[0] - a[0]),
      -w.normal[0] * (b[1] - a[1]),
    ];
    face(
      out,
      'cut',
      [pt(a, depth + turn), pt(b, depth + turn), pt(b, depth - turn), pt(a, depth - turn)],
      outward,
      color,
    );
  }
}

// Each arch is open between the two jambs, with a separate barrel and face rings.
function arch(out, w, width, spring, rise, base, max, depths, lod, slot, color, trim = 0) {
  const h = width / 2;
  const offset = h * 0.58;
  const radius = h + offset;
  const ys = (u) =>
    (Math.sqrt(Math.max(0, radius * radius - Math.pow(Math.abs(u) + offset, 2))) /
      Math.sqrt(radius * radius - offset * offset)) *
    rise;
  const steps = [4, 4, 8, 14][lod];
  const opening = Array.from({ length: steps + 1 }, (_, i) => {
    const u = mix(-h, h, i / steps);
    return [w.length / 2 + u, base + spring + ys(u)];
  });
  for (const [side, d] of [1, -1].map((s, i) => [s, depths[i]])) {
    const n = side === 1 ? w.normal : reverse(w.normal);
    panel(out, slot, w, 0, opening[0][0], base, max, d, color, side);
    panel(out, slot, w, opening.at(-1)[0], w.length, base, max, d, color, side);
    for (const [[a, y], [b, z]] of segments(opening)) {
      face(out, slot, [w.p(a, y, d), w.p(b, z, d), w.p(b, max, d), w.p(a, max, d)], n, color);
      if (trim > 0) {
        const outer = (u, h) =>
          w.p(u + ((u - w.length / 2) * trim) / width, h + trim, d + side * 0.07);
        face(
          out,
          'cut',
          [w.p(a, y, d + side * 0.07), w.p(b, z, d + side * 0.07), outer(b, z), outer(a, y)],
          n,
          c.pale,
        );
      }
    }
    if (trim > 0) {
      const [a, y] = opening[0];
      const [b] = opening.at(-1);
      panel(out, 'cut', w, a - trim / 2, a, base, y, d + side * 0.07, c.pale, side);
      panel(out, 'cut', w, b, b + trim / 2, base, y, d + side * 0.07, c.pale, side);
    }
  }
  const intrados = [[opening[0][0], base], ...opening, [opening.at(-1)[0], base]];
  for (const [[a, y], [b, z]] of segments(intrados)) {
    const normal = [w.normal[2] * (z - y), -Math.abs(b - a), -w.normal[0] * (z - y)];
    face(
      out,
      'cut',
      [w.p(a, y, depths[0]), w.p(a, y, depths[1]), w.p(b, z, depths[1]), w.p(b, z, depths[0])],
      normal,
      c.inset,
    );
  }
}
function dome(out, pos, y, radius, height, lod, slot = 'plaster') {
  const sides = [8, 10, 16, 24][lod];
  const courses = [3, 4, 7, 11][lod];
  const vertices = (band, i) => {
    const lat = (band * Math.PI) / (2 * courses);
    const a = (i * Math.PI * 2) / sides;
    return [
      pos[0] + radius * Math.cos(lat) * Math.cos(a),
      y + height * Math.sin(lat),
      pos[1] + radius * Math.cos(lat) * Math.sin(a),
    ];
  };
  for (let j = 0; j < courses; j++) {
    for (let i = 0; i < sides; i++) {
      const a = vertices(j, i);
      const b = vertices(j, i + 1);
      const n = [a[0] - pos[0], (height * j) / courses, a[2] - pos[1]];
      const points =
        j + 1 === courses
          ? [a, b, at(pos, y + height)]
          : [a, b, vertices(j + 1, i + 1), vertices(j + 1, i)];
      face(out, slot, points, n, c.dome);
    }
  }
}
function disk(pos, r, sides) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (Math.PI * 2 * i) / sides;
    return [pos[0] + r * Math.cos(a), pos[1] + r * Math.sin(a)];
  });
}

const routes = new Map(gateRoutes.map(({ id, points }) => [id, points]));
const approach = routes.get(96196388);
const hattiApproach = routes.get(1351117445);
const axis = (a, b) => {
  const length = dist(a, b);
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
};
const gateDesigns = [
  {
    tangent: axis(gates[0].position, approach[0]),
    width: 16.2,
    length: 13.8,
    height: 13,
    opening: 4.45,
    spring: 3.05,
    rise: 2.45,
    dome: 5.8,
  },
  {
    tangent: axis(approach[4], approach[6]),
    width: 16.5,
    length: 12.7,
    height: 12.1,
    opening: 4.9,
    spring: 3.2,
    rise: 2.8,
  },
  {
    tangent: axis(hattiApproach[8], hattiApproach[6]),
    width: 12,
    length: 9.8,
    height: 9.5,
    opening: 4.45,
    spring: 2.85,
    rise: 2.2,
  },
  {
    tangent: [0.93, -0.367559756],
    width: 11,
    length: 9,
    height: 9,
    opening: 3.7,
    spring: 2.7,
    rise: 2.1,
  },
].map((spec, i) => ({ ...gates[i], ...spec }));

function portal(out, g, lod) {
  const [x, z] = g.position,
    [a, b] = g.tangent;
  const half = g.width / 2,
    depth = g.length / 2;
  const w = edge([x + b * half, z - a * half], [x - b * half, z + a * half], -1);
  const level = grade(g.position);
  const base = level - 0.66;
  const roof = level + g.height;
  if (lod === 0) {
    mass(
      out,
      [
        xz(w.p(0, 0, depth)),
        xz(w.p(w.length, 0, depth)),
        xz(w.p(w.length, 0, -depth)),
        xz(w.p(0, 0, -depth)),
      ],
      () => base,
      roof,
      'stone',
      c.laterite,
    );
  } else {
    arch(
      out,
      w,
      g.opening,
      g.spring + 0.66,
      g.rise,
      base,
      roof,
      [depth, -depth],
      lod,
      'stone',
      c.laterite,
      0.18,
    );
    for (const u of [0, w.length]) {
      face(
        out,
        'stone',
        [w.p(u, base, -depth), w.p(u, base, depth), w.p(u, roof, depth), w.p(u, roof, -depth)],
        [u === 0 ? b : -b, 0, u === 0 ? -a : a],
        c.lower,
      );
    }
    face(
      out,
      'cut',
      [
        w.p(0, roof, -depth),
        w.p(w.length, roof, -depth),
        w.p(w.length, roof, depth),
        w.p(0, roof, depth),
      ],
      up,
      c.roof,
    );
    for (const side of [1, -1]) {
      panel(
        out,
        'cut',
        w,
        0,
        w.length,
        roof - 0.49,
        roof - 0.18,
        side * (depth + 0.13),
        c.cut,
        side,
      );
      if (g.dome) {
        // The blind outer arch follows the main recess rather than filling its passage.
        const frame = edge(
          xz(w.p(half - 4.7, 0, side * (depth + 0.1))),
          xz(w.p(half + 4.7, 0, side * (depth + 0.1))),
          -1,
        );
        const curve = [
          [0.38, 5.35],
          [0.96, 7.16],
          [1.95, 8.57],
          [3.25, 9.63],
          [4.7, 10.48],
          [6.15, 9.63],
          [7.45, 8.57],
          [8.44, 7.16],
          [9.02, 5.35],
        ];
        for (const [[u, y], [v, h]] of segments(curve)) {
          face(
            out,
            'cut',
            [
              frame.p(u, level + y),
              frame.p(v, level + h),
              frame.p(v, level + h + 0.26),
              frame.p(u, level + y + 0.26),
            ],
            side === 1 ? w.normal : reverse(w.normal),
            c.cut,
          );
        }
        for (const [u, v] of [
          [0.11, 0.39],
          [9.01, 9.29],
        ])
          panel(out, 'cut', frame, u, v, level + 0.35, level + 5.65, 0, c.cut, side);
      }
      if (lod > 1) {
        for (const u of [2.0, w.length - 2.0]) {
          panel(
            out,
            'cut',
            w,
            u - 0.38,
            u + 0.38,
            level + 6.2,
            level + 7.48,
            side * (depth + 0.06),
            c.pale,
            side,
          );
          panel(
            out,
            'ashlar',
            w,
            u - 0.25,
            u + 0.25,
            level + 6.34,
            level + 7.34,
            side * (depth + 0.079),
            c.inset,
            side,
          );
        }
      }
      const count = g.dome ? 4 : 8;
      for (let i = 0; i < count; i++)
        merlon(
          out,
          w,
          ((i + 0.5) * w.length) / count,
          roof,
          g.dome ? 0.58 : 0.59,
          side * (depth - 0.28),
          0.27,
          lod,
          c.cut,
        );
    }
  }
  if (g.dome) {
    mass(
      out,
      disk(g.position, g.dome + 0.19, lod > 1 ? 16 : 8),
      () => roof - 0.06,
      roof + 0.52,
      'plaster',
      c.pale,
    );
    dome(out, g.position, roof + 0.52, g.dome, 4.55, lod);
    if (lod > 1) mass(out, disk(g.position, 0.23, 8), () => roof + 4.98, roof + 5.58, 'cut', c.cut);
  }
}

// Clip the mapped wall centerlines only under the passage of each modeled gateway.
function outsidePassage(a, b) {
  let spans = [[0, 1]];
  for (const gate of gateDesigns) {
    const [x, z] = gate.position,
      [u, v] = gate.tangent;
    const measure = ([px, pz]) => [(px - x) * u + (pz - z) * v, (px - x) * v - (pz - z) * u];
    const aa = measure(a),
      bb = measure(b);
    let low = 0,
      high = 1;
    for (const [i, radius] of [
      [0, gate.length / 2 + 2.65],
      [1, gate.opening / 2 + 1.75],
    ]) {
      const delta = bb[i] - aa[i];
      if (Math.abs(delta) < 0.0001) {
        if (Math.abs(aa[i]) >= radius) high = -1;
        continue;
      }
      const n = (-radius - aa[i]) / delta,
        p = (radius - aa[i]) / delta;
      low = Math.max(low, Math.min(n, p));
      high = Math.min(high, Math.max(n, p));
    }
    if (low >= high) continue;
    spans = spans.flatMap(([s, t]) =>
      [
        [s, Math.min(t, low)],
        [Math.max(s, high), t],
      ].filter(([p, q]) => q - p > 0.0001),
    );
  }
  return spans.map(([p, q]) => [interpolate(a, b, p), interpolate(a, b, q)]);
}

const mainWalls = new Set([548416056, 1488568528, 1488568529, 1488568530, 1488568531, 1488568532]);
const skylineWalls = new Set([
  548416056, 1488568528, 1488568529, 1488568530, 1488568531, 1488568532, 1351117405,
]);
function curtain(out, points, spec, lod) {
  const chains = [];
  for (const [a, b] of segments(points)) {
    for (const [p, q] of outsidePassage(a, b)) {
      if (dist(p, q) < 0.04) continue;
      if (chains.length && dist(chains.at(-1).at(-1), p) < 0.035) chains.at(-1).push(q);
      else chains.push([p, q]);
    }
  }
  for (const chain of chains) {
    const closed = dist(chain[0], chain.at(-1)) < 0.02;
    const normals = segments(chain).map(([a, b]) => edge(a, b).normal);
    const corners = chain.map((_, i) => {
      const a = normals[i - 1] ?? (closed ? normals.at(-1) : normals[0]);
      const b = normals[i] ?? (closed ? normals[0] : normals.at(-1));
      const dot = a[0] * b[0] + a[2] * b[2];
      if (dot < -0.88) return [b[0], b[2]];
      const k = Math.max(0.83, 1 + dot);
      return [(a[0] + b[0]) / k, (a[2] + b[2]) / k];
    });
    for (const [[a, b], i] of segments(chain).map((s, i) => [s, i])) {
      const w = edge(a, b);
      const p = (j, y, d) => [chain[j][0] + corners[j][0] * d, y, chain[j][1] + corners[j][1] * d];
      const h = spec.height;
      const width = spec.half;
      const ay = grade(a) + h;
      const by = grade(b) + h;
      for (const k of [1, -1]) {
        const q = p(i, ay, k * (width + 0.32)),
          r = p(i + 1, by, k * (width + 0.32));
        const toward = k === 1 ? w.normal : reverse(w.normal);
        const foot = (point, top) => Math.min(grade(xz(point)) - 0.68, top - 0.3);
        face(
          out,
          'stone',
          [
            [q[0], foot(q, ay), q[2]],
            [r[0], foot(r, by), r[2]],
            p(i + 1, by - (lod > 2 ? 0.22 : 0), k * width),
            p(i, ay - (lod > 2 ? 0.22 : 0), k * width),
          ],
          toward,
          spec.primary ? (k === 1 ? c.laterite : c.inside) : c.lower,
        );
        if (lod > 2)
          face(
            out,
            'cut',
            [
              p(i, ay - 0.22, k * width),
              p(i + 1, by - 0.22, k * width),
              p(i + 1, by, k * (width + 0.12)),
              p(i, ay, k * (width + 0.12)),
            ],
            toward,
            c.cut,
          );
      }
      const top = lod > 2 ? width + 0.12 : width;
      face(
        out,
        lod > 2 ? 'cut' : 'stone',
        [p(i, ay, top), p(i + 1, by, top), p(i + 1, by, -top), p(i, ay, -top)],
        up,
        c.cut,
      );
      if (!closed && (i === 0 || i === chain.length - 2)) {
        const e = i === 0 ? i : i + 1;
        const y = i === 0 ? ay : by;
        const a = p(e, y, width),
          b = p(e, y, -width);
        face(
          out,
          'stone',
          [at(xz(a), grade(xz(a)) - 0.55), at(xz(b), grade(xz(b)) - 0.55), b, a],
          [i === 0 ? w.normal[2] : -w.normal[2], 0, i === 0 ? -w.normal[0] : w.normal[0]],
          c.lower,
        );
      }
      if (lod < 2 || !spec.battlements || w.length < 2.2) continue;
      const gateArea = a[0] > 230 && a[1] > 350;
      const stride = gateArea ? (lod === 3 ? 2.68 : 7.4) : lod === 3 ? 4.0 : 17.2;
      const count = Math.max(lod === 3 ? 1 : 0, Math.floor(w.length / stride));
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count;
        merlon(out, w, t * w.length, mix(ay, by, t), 0.54, width - 0.2, 0.24, lod, c.laterite);
      }
    }
  }
}
function drawFortifications(out, lod) {
  for (const wall of walls) {
    if (lod === 0 && !skylineWalls.has(wall.id)) continue;
    const primary = mainWalls.has(wall.id);
    const outer = wall.id === 1351117405 || wall.id === 1351117420;
    const tolerance = [12.5, 7.2, 1.6, 0.19][lod];
    const points = clean(wall.points, tolerance, [195, 120, 50, 22][lod]);
    curtain(
      out,
      points,
      {
        primary,
        height: primary ? 6.15 : outer ? 2.85 : 3.65,
        half: primary ? 1.55 : outer ? 0.72 : 0.91,
        battlements: primary || wall.id === 1351117426 || wall.id === 1351117438,
      },
      lod,
    );
  }
}

function paths(out, lod) {
  if (lod === 0) return;
  for (const route of gateRoutes) {
    const isService = route.id === 260765657;
    const mapped = route.id === 96196388 ? [gates[0].position, ...route.points] : route.points;
    for (const [a, b] of segments(mapped)) {
      const w = edge(a, b);
      const n = Math.max(1, Math.ceil(w.length / [4, 16, 6.5, 4][lod]));
      for (let i = 0; i < n; i++) {
        const width = isService ? 1.72 : 1.47;
        const pt = (u, d) => {
          const p = xz(w.p(u, 0, d));
          return at(p, grade(p) + 0.1);
        };
        const u = (w.length * i) / n,
          v = (w.length * (i + 1)) / n;
        face(
          out,
          'paving',
          [pt(u, -width), pt(v, -width), pt(v, width), pt(u, width)],
          up,
          isService ? c.dirt : c.pavement,
        );
      }
    }
  }
}

const ruins = new Map([
  [507066741, 4.1],
  [507066744, 2.5],
  [1351117422, 2.6],
  [1351117428, 2.7],
]);
const bastions = new Map([
  [1351117417, 7.4],
  [1351117418, 8.3],
  [1351117419, 8.8],
]);
const buildings = new Map([
  [231204647, 8.1],
  [507066743, 7.2],
  [548428765, 6.4],
  [1341834777, 4.3],
  [1351117415, 5.1],
  [1351117416, 4.3],
  [1351117427, 14.2],
  [1351117444, 1.35],
]);
const farBuildings = new Set([
  231204647, 507066743, 1351117427, 1351117415, 1351117419, 1351117418, 1351117417,
]);
function bastion(out, points, h, lod) {
  const y = grade(middle(points)) + h;
  mass(out, points, (p) => Math.min(grade(p) - 0.95, y - 1), y, 'ashlar', c.laterite, c.inside);
  if (lod === 0) return;
  const sign = winding(points);
  for (const [a, b] of segments(loop(points))) {
    const w = edge(a, b, sign);
    panel(out, 'cut', w, 0, w.length, y - 0.54, y - 0.22, 0.07, c.cut);
    if (lod > 1) {
      const n = Math.max(1, Math.round(w.length / 2.1));
      for (let i = 0; i < n; i++)
        merlon(out, w, ((i + 0.5) * w.length) / n, y, 0.47, -0.22, 0.26, lod, c.cut, 0.9);
      for (const u of [1.05, 2.6, 4.35])
        panel(out, 'cut', w, 0, w.length, y - u - 0.08, y - u, 0.035, c.cut);
    }
  }
}
function roofless(out, points, h, lod, id) {
  const level = grade(middle(points));
  const edges = segments(loop(points)).sort(([a, b], [c, d]) => dist(c, d) - dist(a, b));
  curtain(out, loop(points), { height: h, half: 0.78, primary: false, battlements: false }, lod);
  if (lod < 2) return;
  const [a, b] = edges[0];
  const w = edge(a, b, winding(points));
  const length = Math.min(w.length * 0.69, id === 507066741 ? 40 : 27);
  const n = id === 507066741 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const from = (w.length - length) / 2 + (length * i) / n;
    const to = from + length / n;
    const start = xz(w.p(from, 0, -2.15));
    const end = xz(w.p(to, 0, -2.15));
    const span = edge(start, end);
    const base = Math.min(grade(start), grade(end), level) - 0.38;
    arch(
      out,
      span,
      span.length * 0.61,
      3.1,
      1.45,
      base,
      level + (id === 507066741 ? 8 : 5.7),
      [0.46, -0.46],
      lod,
      'stone',
      c.inside,
      0,
    );
    face(
      out,
      'cut',
      [
        span.p(0, level + (id === 507066741 ? 8 : 5.7), -0.46),
        span.p(span.length, level + (id === 507066741 ? 8 : 5.7), -0.46),
        span.p(span.length, level + (id === 507066741 ? 8 : 5.7), 0.46),
        span.p(0, level + (id === 507066741 ? 8 : 5.7), 0.46),
      ],
      up,
      c.cut,
    );
  }
}
function palace(out, points, h, lod, id) {
  const pos = middle(points),
    base = grade(pos),
    roof = base + h;
  const wall = id === 1351117427 || id === 231204647 || id === 507066743;
  mass(
    out,
    points,
    (p) => Math.min(grade(p) - 0.45, roof - 0.27),
    roof,
    wall ? 'stone' : 'ashlar',
    wall ? c.inside : c.lower,
    c.roof,
  );
  if (lod < 1 || h < 2.5) return;
  const sign = winding(points);
  for (const [a, b] of segments(loop(points))) {
    const w = edge(a, b, sign);
    if (w.length < 1) continue;
    panel(out, 'cut', w, 0, w.length, roof - 0.44, roof - 0.14, 0.08, c.cut);
    if (lod < 2 || !wall || w.length < 5) continue;
    const bays = Math.max(1, Math.floor(w.length / 4.8));
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * w.length) / bays;
      for (const from of h > 10 ? [roof - 4.1, roof - 7.8] : [roof - 3.2]) {
        panel(out, 'cut', w, u - 0.63, u + 0.63, from - 0.16, from + 1.72, 0.12, c.cut);
        panel(out, 'ashlar', w, u - 0.49, u + 0.49, from, from + 1.54, 0.15, c.inset);
      }
    }
    if (id === 1351117427) {
      for (const from of [roof - 4.56, roof - 8.12])
        panel(out, 'cut', w, 0, w.length, from, from + 0.21, 0.1, c.cut);
    }
  }
}
function mosque(out, points, lod) {
  const level = grade(middle(points));
  const roof = level + 7.55;
  if (lod === 0) mass(out, points, () => level - 0.6, roof, 'plaster', c.pale, c.roof);
  else {
    const sign = winding(points);
    const edges = segments(loop(points));
    const facade = edges
      .filter(([a, b]) => (b[1] - a[1]) * sign > 0)
      .sort(([a, b], [c, d]) => dist(c, d) - dist(a, b))[0];
    for (const line of edges) {
      const [a, b] = line,
        w = edge(a, b, sign);
      if (line !== facade) {
        face(
          out,
          'plaster',
          [at(a, grade(a) - 0.6), at(b, grade(b) - 0.6), at(b, roof), at(a, roof)],
          w.normal,
          c.pale,
        );
      } else {
        const n = 16;
        for (let i = 0; i < n; i++) {
          const p = xz(w.p((i * w.length) / n, 0, 0.04)),
            q = xz(w.p(((i + 1) * w.length) / n, 0, 0.04));
          const bay = edge(p, q, sign);
          arch(
            out,
            bay,
            bay.length * 0.7,
            3.35,
            1.46,
            level - 0.42,
            roof,
            [0, -0.83],
            lod,
            'plaster',
            c.plaster,
            lod > 1 ? 0.08 : 0,
          );
        }
        const recess = edge(xz(w.p(0, 0, -2.7)), xz(w.p(w.length, 0, -2.7)), sign);
        panel(out, 'stone', recess, 0, recess.length, level - 0.64, roof, 0, c.inset);
      }
      panel(out, 'cut', w, 0, w.length, roof - 0.31, roof, 0.09, c.cut);
    }
    cap(out, 'plaster', points, roof, c.roof);
  }
  const pos = middle(points);
  const drum = disk(pos, 6.53, lod > 0 ? 16 : 8);
  mass(out, drum, () => roof - 0.04, roof + 2.08, 'plaster', c.pale);
  dome(out, pos, roof + 2.08, 6.16, 5.65, lod);
}

function draw(out, lod) {
  drawFortifications(out, lod);
  paths(out, lod);
  for (const g of gateDesigns) portal(out, g, lod);
  for (const item of monuments) {
    const points = ring(clean(item.points, [1.5, 0.59, 0.14, 0.035][lod]));
    const id = item.id;
    if (points.length < 3) continue;
    if (id === 260765652) mosque(out, points, lod);
    else if (lod === 0 && !farBuildings.has(id)) continue;
    else if (bastions.has(id)) bastion(out, points, bastions.get(id), lod);
    else if (ruins.has(id)) roofless(out, points, ruins.get(id), lod, id);
    else palace(out, points, buildings.get(id), lod, id);
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const camera = [1040, 573, 1178];
const lookAt = [0, -8, 106];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  category: 'fortress',
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Bidar Fort with mapped laterite fortifications and moat walls, four arched gateways, the sixteen-column mosque, the palace ruins and round bastions.',
  camera,
  lookAt,
  sunDirection: [390, 550, 420],
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.82,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'gumbad-approach-dome-and-portals',
      position: [351, 7.2, 521],
      lookAt: [307, 7.4, 507],
    },
    { name: 'sherzah-battlements-and-passage', position: [443, 6.7, 481], lookAt: [402, 7.9, 504] },
    { name: 'solah-khamba-arcade-and-palace', position: [229, 24, 490], lookAt: [110, 5, 523] },
    { name: 'hatti-gate-and-curtain-walls', position: [466, 2.2, 438], lookAt: [416, -1.4, 419] },
    { name: 'western-ramparts-and-burj', position: [-498, 91, 558], lookAt: [-255, -10, 260] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 7.5,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 2.35, surfaces },
      street: { export: 'street', errorMeters: 0.75, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.26, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from two cleared CC0 Qualla originals, native OSM wall and monument data, and unchanged Terrarium elevations.',
};
