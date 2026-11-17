/** Carved limestone chambers at the six mapped Ivanovo cliff sites. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98 },
  masonry: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  soil: { slot: 'roof', graph: 'stone_drywall', roughness: 0.98 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  painting: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83 },
};
const colors = {
  rock: [0.72, 0.674, 0.55],
  darkRock: [0.625, 0.567, 0.456],
  pale: [0.79, 0.753, 0.659],
  soil: [0.325, 0.372, 0.257],
  shade: [0.39, 0.375, 0.294],
  moss: [0.37, 0.42, 0.282],
  masonry: [0.653, 0.612, 0.501],
  timber: [0.5, 0.309, 0.189],
  iron: [0.27, 0.302, 0.252],
  roof: [0.234, 0.296, 0.277],
  plaster: [0.68, 0.607, 0.449],
  ochre: [0.74, 0.544, 0.264],
  red: [0.52, 0.277, 0.193],
  black: [0.27, 0.305, 0.261],
  sage: [0.38, 0.444, 0.351],
  cream: [0.73, 0.668, 0.508],
  blue: [0.311, 0.367, 0.352],
};
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const blend = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const scale = (tint, amount) => colors[tint].map((v) => v * amount);
const phase = (x, y) => ((((x * 1237 + y * 911 + 45937) % 997) + 997) % 997) / 997;
const sections = layout.sections;
function emit(out, slot, p, c, want) {
  if (p.length === 3) {
    const a = p[0],
      b = p[1],
      d = p[2];
    const u = b.map((v, i) => v - a[i]),
      w = d.map((v, i) => v - a[i]);
    if (
      Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) <
      0.00003
    )
      return;
  }
  let normal = normalFor(...p);
  if (want && normal.reduce((v, x, i) => v + x * want[i], 0) < 0) {
    p = p.toReversed();
    normal = normal.map((v) => -v);
  }
  if (p.length === 4) {
    emit(out, slot, [p[0], p[1], p[2]], c, want);
    emit(out, slot, [p[0], p[2], p[3]], c, want);
    return;
  }
  out.addTriangle(slot, '', p, normal, undefined, c);
}
function stitch(out, slot, rows, c, n) {
  for (let i = 1; i < rows.length; i++)
    for (let j = 1; j < rows[i].length; j++) {
      const a = rows[i - 1][j - 1],
        b = rows[i - 1][j],
        f = rows[i][j],
        e = rows[i][j - 1];
      const tint = scale(c, 0.875 + phase(j, i) * 0.2);
      emit(out, slot, [a, b, f], tint, n);
      emit(out, slot, [a, f, e], tint, n);
    }
}
function polygon(out, slot, outer, holes, map, c, normal) {
  const points = [...outer, ...holes.flat()],
    indices = [];
  let offset = outer.length;
  for (const hole of holes) {
    indices.push(offset);
    offset += hole.length;
  }
  const triangles = earcut(points.flat(), indices);
  for (let i = 0; i < triangles.length; i += 3) {
    const ids = triangles.slice(i, i + 3),
      p = ids.map((j) => map(...points[j]));
    if (Math.hypot(...normalFor(...p)) < 0.5) continue;
    emit(out, slot, p, scale(c, 0.91 + phase(ids[1], ids[2]) * 0.16), normal);
  }
}
const countFor = (d) => [2, 6, 12, 24, 24][d];
const sample = (row, i, n) => row[Math.round((i * 24) / n)];
function wrap(out, s) {
  const point = ([x, y, z]) => [
    s.center[0] + s.right[0] * x + s.front[0] * z,
    s.lip + y,
    s.center[1] + s.right[1] * x + s.front[1] * z,
  ];
  const direction = ([x, y, z]) => [
    s.right[0] * x + s.front[0] * z,
    y,
    s.right[1] * x + s.front[1] * z,
  ];
  return {
    addTriangle(slot, ref, p, n, uv, c) {
      out.addTriangle(slot, ref, p.map(point), direction(n), uv, c);
    },
    addQuad(slot, ref, p, n, uv, c) {
      out.addQuad(slot, ref, p.map(point), direction(n), uv, c);
    },
    addConvexPolygon(slot, ref, p, n, uv, c) {
      out.addConvexPolygon(slot, ref, p.map(point), direction(n), uv, c);
    },
  };
}
const edgeFade = (x, half) => Math.pow(Math.max(0, Math.cos(((x / half) * Math.PI) / 2)), 0.62);
const faceZ = (x, y, s) => {
  const taper = edgeFade(x, s.half);
  const calm = Math.max(
    0,
    Math.min(1, (Math.abs(x) - 5.5) / 2.2, (Math.abs(y - 1.8) - 1.36) / 1.2),
  );
  return (
    taper *
    (0.32 * Math.sin(x * 0.82 + y * 0.64) +
      0.52 * Math.sin(x * 0.329 - y * 0.21) +
      0.17 * Math.sin(x * 1.18 + y * 0.38) +
      0.095 * Math.sin(x * 2.9 + y * 3.9)) *
    calm
  );
};
function archRing({ x, w, h, rise, y = 0, seed = 0 }, d) {
  const k = d === 0 ? 2 : d <= 2 ? 6 : d === 3 ? 10 : 13,
    u = w / 2;
  const arc = Array.from({ length: k + 1 }, (_, i) => {
    const a = (Math.PI * i) / k;
    const noise = (phase(i, seed) - 0.5) * Math.sin(a) * (seed ? 0.24 : 0.06);
    return [x + u * Math.cos(a), y + h + Math.sin(a) * rise + noise];
  });
  return [[x - u, y + 0.015], [x + u, y + 0.015], ...arc];
}
function openings(s, i) {
  const [x, w, h, rise] = s.portal;
  const data = [
    {
      x,
      w,
      h,
      rise,
      y: 0,
      seed: i === 0 ? 0 : i + 1,
      depth: s.modern ? 10.9 : Math.min(5.2, s.depth - 2.8),
    },
  ];
  switch (i) {
    case 0:
      data.push(
        { x: -3.8, w: 2.73, h: 0.78, rise: 0.28, y: 4.17, seed: 2, depth: 2.6 },
        { x: 1.0, w: 0.91, h: 1.05, rise: 0.39, y: 0.95, seed: 0, depth: 6.0 },
        { x: 3.02, w: 0.91, h: 1.05, rise: 0.38, y: 0.95, seed: 0, depth: 6.0 },
      );
      break;
    case 1:
      data.push({ x: -3.01, w: 1.58, h: 1.24, rise: 0.28, y: 0.54, seed: 4, depth: 2.65 });
      break;
    case 2:
      data.push(
        { x: 2.91, w: 1.39, h: 1.18, rise: 0.19, y: 0.62, seed: 3, depth: 4.4 },
        { x: 4.88, w: 0.83, h: 1.22, rise: 0.37, y: 0.51, seed: 8, depth: 3.8 },
      );
      break;
    case 3:
      data.push({ x: -2.44, w: 1.44, h: 1.26, rise: 0.32, y: 0.48, seed: 1, depth: 2.54 });
      break;
    case 4:
      data.push(
        { x: 2.75, w: 1.18, h: 1.02, rise: 0.92, y: 1.43, seed: 6, depth: 2.3 },
        { x: -3.84, w: 1.13, h: 1.11, rise: 0.3, y: 0.61, seed: 4, depth: 2.32 },
      );
      break;
    case 5:
      data.push({ x: -3.47, w: 1.1, h: 0.75, rise: 0.55, y: 1.11, seed: 3, depth: 2.19 });
      break;
  }
  return data;
}
function cliff(out, s, d, holes) {
  const half = s.half,
    n = countFor(d),
    xs = Array.from({ length: n + 1 }, (_, j) => half * ((2 * j) / n - 1));
  const base = xs.map((x, i) => {
    const g = (sample(s.heights[3], i, n) + sample(s.heights[4], i, n)) / 2 - s.lip;
    return blend([g], [s.modern ? -4.4 : -3.4], edgeFade(x, half))[0];
  });
  const crest = xs.map((x, i) => {
    const native = sample(s.heights[3], i, n) - s.lip + 0.35;
    const h =
      s.top + 0.86 * Math.sin(x * 0.449) + 0.43 * Math.sin(x * 1.72) + 0.36 * Math.cos(x * 2.46);
    return blend([native], [h], Math.pow(edgeFade(x, half), 0.57))[0];
  });
  const front = (x, y) => {
    const lip = faceZ(x, y, s);
    return [x, y, lip];
  };
  const keyXs = [
    ...new Set([...xs, -6.2, -4.9, -2.6, 0, 2.4, 4.8, 6.3].filter((x) => Math.abs(x) <= half)),
  ].sort((a, b) => a - b);
  const interpolate = (x, values) => {
    if (x === half) return values.at(-1);
    const f = ((x / half + 1) * n) / 2,
      i = Math.floor(f),
      u = f - i;
    return values[i] + (values[i + 1] - values[i]) * u;
  };
  const shell = keyXs
    .map((x) => [x, interpolate(x, base)])
    .concat(keyXs.toReversed().map((x) => [x, interpolate(x, crest)]));
  const material = (x, y) => {
    const t =
      0.5 +
      0.22 * Math.sin(y * 2.96) +
      0.18 * Math.sin(x * 0.75 - y * 0.69) +
      0.1 * Math.cos(x * 2.3 + y * 3.5);
    return colors.darkRock.map((v, i) => v + (colors.pale[i] - v) * t);
  };
  if (d === 0) polygon(out, 'rock', shell, holes, front, 'rock', [0, 0, 1]);
  else {
    const rim = [...shell, ...holes.flat()],
      starts = [];
    let last = shell.length;
    for (const hole of holes) {
      starts.push(last);
      last += hole.length;
    }
    const raw = earcut(rim.flat(), starts);
    const mesh = [];
    for (let j = 0; j < raw.length; j += 3) mesh.push(raw.slice(j, j + 3).map((i) => rim[i]));
    // Densify the constrained face to carry the layered rock relief across each portal.
    // Splitting every shared edge at the same point keeps adjoining triangles watertight.
    const rounds = d === 1 ? 1 : d === 2 ? 2 : 3;
    function tri(a, b, c, steps) {
      if (steps === 0) {
        const x = (a[0] + b[0] + c[0]) / 3,
          y = (a[1] + b[1] + c[1]) / 3;
        emit(
          out,
          'rock',
          [a, b, c].map(([u, v]) => front(u, v)),
          material(x, y),
          [0, 0, 1],
        );
        return;
      }
      const ab = blend(a, b, 0.5),
        bc = blend(b, c, 0.5),
        ca = blend(c, a, 0.5);
      tri(a, ab, ca, steps - 1);
      tri(ab, b, bc, steps - 1);
      tri(ca, bc, c, steps - 1);
      tri(ab, bc, ca, steps - 1);
    }
    for (const [a, b, c] of mesh) tri(a, b, c, rounds);
  }
  const top = xs.map((x, i) => front(x, crest[i])),
    toe = xs.map((x, i) => front(x, base[i]));
  const row = (i) => xs.map((x, k) => [x, sample(s.heights[i], k, n) - s.lip + 0.1, s.rows[i]]);
  const upper = [];
  for (const i of d === 0 ? [0, 2] : [0, 1, 2]) {
    const p = row(i);
    for (let j = 0; j < p.length; j++) {
      const t = [0, 0.28, 0.72][i] * edgeFade(xs[j], half);
      p[j][1] += Math.max(0, crest[j] - p[j][1]) * t;
    }
    upper.push(p);
  }
  upper.push(top);
  stitch(out, 'soil', upper, 'moss', [0, 1, 0]);
  const lower = d === 0 ? [toe, row(6), row(7)] : [toe, row(5), row(6), row(7)];
  for (let i = 1; i < lower.length - 1; i++)
    for (let j = 0; j < xs.length; j++) {
      const f = edgeFade(xs[j], half) * [0, 0.43, 0.21][i];
      lower[i][j][1] = blend([lower[i][j][1]], [base[j]], f)[0];
    }
  stitch(out, 'soil', lower, 'moss', [0, 1, 0]);
  for (const j of [0, n]) {
    const skirt = [...upper, ...lower].map((r) => r[j]);
    for (let i = 1; i < skirt.length; i++) {
      const a = skirt[i - 1],
        b = skirt[i];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.02) continue;
      emit(out, 'soil', [a, b, [b[0], b[1] - 1.15, b[2]], [a[0], a[1] - 1.15, a[2]]], colors.soil, [
        j === 0 ? -1 : 1,
        0,
        0,
      ]);
    }
  }
  if (d < 2) return;
  // Thin stratified ledges give the crown and side buttresses relief without filling the entrances.
  for (let i = 0; i < (d >= 3 ? 19 : 9); i++) {
    const x = (phase(i, 14) * 2 - 1) * (half * 0.85);
    const localTop = interpolate(x, crest);
    const wide = (0.46 + phase(i, 13) * 1.5) * edgeFade(x, half);
    const y = Math.max(5.65 + (s.modern ? 0.25 : 0), localTop - (0.22 + phase(i, 3) * 1.3));
    if (y + 0.19 >= localTop || (!s.modern && y < 5.3)) continue;
    const z = faceZ(x, y, s),
      h = 0.15 + phase(i, 7) * 0.36;
    const point = (a, b, c) => [x + a * wide, y + b * h, z + c * wide];
    const tips = [
      point(-1, -0.38, 0.02),
      point(-0.76, 0.57, 0.09),
      point(0.66, 0.36, 0.06),
      point(1, -0.49, 0.04),
    ];
    const f = point(0.13, -0.18, 0.38 + phase(i, 12) * 0.38);
    for (let j = 1; j < tips.length; j++)
      emit(
        out,
        'rock',
        [tips[j - 1], tips[j], f],
        scale(j === 1 ? 'darkRock' : 'pale', 0.86 + (i % 4) * 0.06),
        [0, 0, 1],
      );
  }
}
function cave(out, s, shape, ring, d, index) {
  const { x, y = 0, depth } = shape;
  const profile = d === 0 ? [0, 1] : d === 1 ? [0, 0.37, 1] : [0, 0.16, 0.48, 0.78, 1];
  const edgeSteps = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 8;
  const boundary = ring.flatMap((a, i) =>
    Array.from({ length: edgeSteps }, (_, j) =>
      blend(a, ring[(i + 1) % ring.length], j / edgeSteps),
    ),
  );
  const rings = profile.map((f, k) =>
    boundary.map(([u, v], i) => {
      const widened = index === 0 && (s.modern || shape.w > 3) ? 0.46 : 0.07;
      const t = 1 + widened * Math.sin(f * Math.PI * 0.74);
      const q = x + (u - x) * t + 0.12 * (phase(k, 19) - 0.5) * Math.sin(f * Math.PI);
      const height =
        y +
        (v - y) * (1 + 0.125 * Math.sin(f * Math.PI)) +
        0.08 * (phase(i, k) - 0.5) * Math.sin(Math.PI * f);
      return [q, height, (1 - f) * faceZ(u, v, s) - depth * f];
    }),
  );
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < boundary.length; j++) {
      const k = (j + 1) % boundary.length,
        a = rings[i - 1][j],
        b = rings[i - 1][k],
        c = rings[i][k],
        e = rings[i][j];
      const tint = scale(j === 0 ? 'pale' : 'rock', 0.78 + phase(i, j) * 0.26);
      const inward = [x - (a[0] + b[0]) / 2, y + 0.8 - (a[1] + b[1]) / 2, 0];
      emit(out, 'rock', [a, b, c], tint, inward);
      emit(out, 'rock', [a, c, e], tint, inward);
    }
  const wall = rings.at(-1),
    outline = wall.map((p) => p.slice(0, 2));
  polygon(
    out,
    'rock',
    outline,
    [],
    (a, b) => [a, b, -depth],
    d === 0 ? 'shade' : 'darkRock',
    [0, 0, 1],
  );
  if (index === 0 && d >= 2 && s.paint > 0) painted(out, s, shape, d);
}
function painted(out, s, shape, d) {
  const { x, depth, w } = shape,
    side = -1,
    wallX = x + (s.modern ? 0.55 : 0.47) * w,
    top = s.modern ? 2.17 : 1.5;
  const n = Math.round(s.modern ? 10 : 5);
  const start = 1.26,
    end = depth - 0.14,
    span = (end - start) / n;
  for (let i = 0; i < n; i++) {
    const a = start + i * span,
      b = a + span * 0.98,
      xx = wallX + 0.07 * Math.sin(i * 0.72);
    const p = (z, y) => [xx, y, -z],
      c = ['blue', 'sage', 'black', 'blue', 'plaster'][i % 5];
    const shade = (name, k = 1) => scale(name, 0.93 + phase(i, 11) * 0.1 * k);
    const patch = (slot, z1, z2, y1, y2, name) =>
      emit(out, slot, [p(z1, y1), p(z2, y1), p(z2, y2), p(z1, y2)], shade(name), [side, 0, 0]);
    patch('painting', a, b, 0.38, top, c);
    const ring = (z, y, r, outer) =>
      Array.from({ length: 8 }, (_, j) =>
        p(
          z + r * Math.cos((j * Math.PI) / 4),
          y + (outer ? 0.92 : 1) * r * Math.sin((j * Math.PI) / 4),
        ),
      );
    const zz = (a + b) / 2 - 0.053,
      cy = top - 0.49,
      r = Math.min(0.235, span * 0.31);
    const disk = ring(zz, cy, r, true),
      tint = shade('ochre');
    for (let j = 0; j < disk.length; j++)
      emit(
        out,
        'painting',
        [
          [xx - 0.009, cy, -zz],
          disk[j].map((v, k) => (k === 0 ? v - 0.01 : v)),
          disk[(j + 1) % disk.length].map((v, k) => (k === 0 ? v - 0.01 : v)),
        ],
        tint,
        [side, 0, 0],
      );
    const cloth = ['red', 'cream', 'ochre', 'sage'][i % 4],
      q = (z, y) => [xx - 0.014, y, -z];
    const robe = [
      q(zz - r * 0.28, cy - r * 0.86),
      q(zz + r * 0.35, cy - r * 0.85),
      q(zz + r * 0.8, 0.52),
      q(zz - r * 0.73, 0.52),
    ];
    emit(out, 'painting', robe, shade(cloth), [side, 0, 0]);
    if (d >= 3) {
      const face = ring(zz, cy - 0.027, r * 0.57, false);
      for (let j = 0; j < face.length; j++)
        emit(
          out,
          'painting',
          [
            [xx - 0.016, cy - 0.027, -zz],
            face[j].map((v, k) => (k === 0 ? v - 0.016 : v)),
            face[(j + 1) % face.length].map((v, k) => (k === 0 ? v - 0.016 : v)),
          ],
          shade('plaster'),
          [side, 0, 0],
        );
      for (const f of [-0.23, 0.17])
        emit(
          out,
          'painting',
          [q(zz + f * r, 0.55), q(zz + (f + 0.09) * r, 0.62), q(zz + (f + 0.055) * r, cy - r)],
          shade('cream', 0.7),
          [side, 0, 0],
        );
    }
  }
  for (let i = 0; i < (s.modern ? 6 : 2); i++) {
    const lo = 1.18 + (i * (depth - 1.5)) / (s.modern ? 6 : 2),
      hi = lo + ((depth - 1.5) / (s.modern ? 6 : 2)) * 0.88;
    const y = top + 0.04,
      cg = ['ochre', 'plaster', 'red'][i % 3],
      a = x - 0.45 * w,
      b = x + 0.45 * w;
    emit(
      out,
      'painting',
      [
        [a, y, -lo],
        [a, y, -hi],
        [b, y, -hi],
        [b, y, -lo],
      ],
      scale(cg, 0.86),
      [0, -1, 0],
    );
    emit(
      out,
      'painting',
      [
        [a + 0.11, y - 0.009, -lo - 0.14],
        [a + 0.11, y - 0.009, -hi + 0.14],
        [b - 0.11, y - 0.009, -hi + 0.14],
        [b - 0.11, y - 0.009, -lo - 0.14],
      ],
      scale(i % 2 ? 'sage' : 'cream', 0.88),
      [0, -1, 0],
    );
  }
}
function woodRail(out, path, d) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = d === 0 ? 1 : Math.max(1, Math.ceil(length / (d === 1 ? 2.3 : 1.0)));
    const piece = (t, y) => blend(a, b, t).map((v, i) => (i === 1 ? v + y : v));
    beam(out, 'timber', piece(0, 1.02), piece(1, 1.02), 0.113, 0.144, colors.timber);
    if (d >= 1) beam(out, 'timber', piece(0, 0.57), piece(1, 0.57), 0.088, 0.093, colors.timber);
    for (let j = 0; j < n; j++)
      beam(out, 'timber', piece(j / n, -0.08), piece(j / n, 1.09), 0.125, 0.128, colors.timber);
  }
  beam(
    out,
    'timber',
    path.at(-1),
    path.at(-1).map((v, i) => v + (i === 1 ? 1.09 : 0)),
    0.125,
    0.128,
    colors.timber,
  );
}
function terrace(out, s, d) {
  const z = 1.55,
    x = -3.85;
  const main = [
    [-8.2, -0.18, 0],
    [-8.2, -0.18, 2.25],
    [4.4, -0.18, 2.25],
    [4.4, -0.18, 0],
  ];
  const stone = main.map(([x, , z]) => [x, z]);
  loft(
    out,
    'masonry',
    [-1.12, -0.17].map((y) => stone.map(([x, z]) => [x, y, z])),
    colors.masonry,
  );
  woodRail(
    out,
    [
      [-8.2, -0.17, 2.22],
      [4.4, -0.17, 2.22],
    ],
    d,
  );
  // Restored exterior wall around the entrance and the two narrow openings.
  for (const [a, b, low, high] of [
    [-8.2, -5.5, 0, 2.35],
    [-2.1, 0.53, 0, 2.41],
    [1.46, 2.54, 0, 2.41],
    [3.47, 4.36, 0, 2.41],
    [0.54, 3.48, 0, 0.9],
  ]) {
    box(out, 'masonry', [a, low, 0.011], [b, high, 0.4], colors.masonry);
  }
  for (const u of [1.0, 3.02]) {
    if (d === 0) continue;
    for (const off of [-0.28, 0, 0.28])
      beam(
        out,
        'iron',
        [u + off, 0.94, 0.455],
        [u + off, 2.2 - Math.abs(off) * 0.65, 0.455],
        0.035,
        0.033,
        colors.iron,
      );
    for (const y of [1.14, 1.6])
      beam(out, 'iron', [u - 0.4, y, 0.448], [u + 0.4, y, 0.448], 0.041, 0.034, colors.iron);
  }
  for (const t of [-1, 1]) {
    const u = x + t * 1.58;
    beam(out, 'timber', [u, -0.11, z], [u, 2.63, z], 0.141, 0.166, colors.timber);
    beam(out, 'timber', [u, 2.63, z], [u, 2.94, -0.18], 0.122, 0.123, colors.timber);
  }
  const roof = [
    [-6.12, 2.58, 2.01],
    [-3.85, 2.88, 2.2],
    [-1.59, 2.58, 2.01],
  ];
  const rear = roof.map(([x, y]) => [x, y + 0.42, -0.23]);
  for (let j = 1; j < roof.length; j++) {
    emit(out, 'roof', [roof[j - 1], roof[j], rear[j]], colors.roof, [0, 1, 0]);
    emit(out, 'roof', [roof[j - 1], rear[j], rear[j - 1]], colors.roof, [0, 1, 0]);
  }
  const lowest = s.nearbyPath.at(-1);
  const steps = [
    [4.4, -0.17, 2.25],
    [7.65, -0.95, 3.56],
    [10.25, -1.66, 5.4],
    [10.05, -1.94, 7.35],
  ];
  const [px, pz, py] = lowest;
  if (Math.hypot(px - 10.05, pz - 7.35) < 10 && Number.isFinite(py))
    steps.push([px, py - s.lip + 0.04, pz]);
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1],
      b = steps[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      l = Math.hypot(dx, dz);
    if (l < 0.05) continue;
    const off = [(-0.71 * dz) / l, 0, (0.71 * dx) / l],
      one = d === 0 ? 1 : Math.max(2, Math.ceil(Math.abs(b[1] - a[1]) / 0.177));
    const p = (k, t, sign, delta = 0) =>
      blend(a, b, k).map((v, j) =>
        j === 1 ? a[1] + (b[1] - a[1]) * t + delta : v + off[j] * sign,
      );
    for (let j = 0; j < one; j++) {
      const l = j / one,
        r = (j + 1) / one;
      emit(
        out,
        'masonry',
        [p(l, l, 1), p(r, l, 1), p(r, l, -1), p(l, l, -1)],
        colors.masonry,
        [0, 1, 0],
      );
      if (one > 1)
        emit(out, 'masonry', [p(r, l, -1), p(r, r, -1), p(r, r, 1), p(r, l, 1)], colors.darkRock, [
          dx,
          0,
          dz,
        ]);
    }
    woodRail(out, [p(0, 0, 1), p(1, 1, 1)], d);
  }
}
function buildLevel(out, level) {
  const d = tier[level];
  for (const [i, s] of sections.entries()) {
    const local = wrap(out, s),
      shapes = openings(s, i),
      rings = shapes.map((shape) => archRing(shape, d));
    cliff(local, s, d, rings);
    for (const [j, shape] of shapes.entries()) cave(local, s, shape, rings[j], d, j);
    if (s.modern) terrace(local, s, d);
  }
}
export const buildSkyline = (out) => buildLevel(out, 'skyline');
export const buildDistrict = (out) => buildLevel(out, 'district');
export const buildStreet = (out) => buildLevel(out, 'street');
export const buildCloseup = (out) => buildLevel(out, 'closeup');
export const buildMaster = (out) => buildLevel(out, 'master');
export const buildTowerLevel = buildLevel;
