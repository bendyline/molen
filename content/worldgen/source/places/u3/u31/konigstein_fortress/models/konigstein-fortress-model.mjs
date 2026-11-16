/** Königstein's plateau fortifications and western approach in the measured site frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const data = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = data('plan-controls.json');
const grid = data('terrain-grid.json');
const { buildings, outworks, ramp, perimeter, lowerWestEdges, gate, pavilion } = plan.dimensions;
const up = [0, 1, 0];
const palette = 'palette:#ffffff';
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  cut: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.92, metallic: 0 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.84, metallic: 0.02 },
  clay: { slot: 'roof', graph: 'tile_flat', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.55, metallic: 0.03 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    stone: 'a29881',
    darkStone: '8f856f',
    cut: 'bab09b',
    ashlars: '958976',
    stain: 'a19a82',
    cream: 'd3cbbb',
    neutral: 'bdb7a6',
    roof: '737879',
    clay: '976f5d',
    roofMetal: '7f837d',
    glass: '65716d',
    recess: '737368',
    timber: '9d9988',
    rail: '756f60',
    turf: '9a9d76',
    gold: 'd2b26c',
    pale: 'd3c6a8',
  }).map(([k, s]) => [k, rgb(s)]),
);
const loc = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function grade([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const near = grid.heightsMeters[j],
    far = grid.heightsMeters[j + 1];
  return (
    (near[i] * (1 - a) + near[i + 1] * a) * (1 - b) +
    (far[i] * (1 - a) + far[i + 1] * a) * b -
    grid.modelDatumElevationMeters
  );
}
function face(out, slot, points, target, color) {
  const n = normalFor(...points);
  const dot = n.reduce((s, v, i) => s + v * target[i], 0);
  out.addConvexPolygon(
    slot,
    palette,
    points,
    dot < 0 ? n.map((v) => -v) : n,
    ([x, y, z]) => (Math.abs(n[1]) > 0.6 ? [x, z] : [x - 0.6 * z, y]),
    color,
  );
}
function bendingFace(out, slot, [a, b, c, d], toward, color) {
  face(out, slot, [a, b, c], toward, color);
  face(out, slot, [a, c, d], toward, color);
}
function area(ring) {
  return (
    ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - z * a;
    }, 0) / 2
  );
}
function edge(a, b, sign = 1) {
  const length = distance(a, b),
    x = (b[0] - a[0]) / length,
    z = (b[1] - a[1]) / length;
  const normal = [sign * z, 0, -sign * x];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [a[0] + x * u + normal[0] * d, y, a[1] + z * u + normal[2] * d],
  };
}
function extent(ring) {
  return [0, 1].map((i) => [
    Math.min(...ring.map((p) => p[i])),
    Math.max(...ring.map((p) => p[i])),
  ]);
}
function simplify(ring, tolerance, minimum = 4) {
  const points = [...ring];
  for (let i = points.length - 1; i >= 0 && points.length > minimum; i--) {
    const a = points[(i + points.length - 1) % points.length],
      p = points[i],
      b = points[(i + 1) % points.length];
    const span = distance(a, b);
    const bend =
      Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) /
      Math.max(0.01, span);
    if (span < 72 && bend < tolerance && distance(a, p) + distance(p, b) < span + tolerance * 1.8)
      points.splice(i, 1);
  }
  return points;
}

function wallSections(out, path, topAt, spec, lod) {
  const { u0, u1, color, closed } = spec;
  const n = path.length,
    segmentCount = closed ? n : n - 1;
  const offsets = path.map((a, i) => {
    const before = edge(path[(i + n - 1) % n], a, 1).normal;
    const after = edge(a, path[(i + 1) % n], 1).normal;
    if (!closed && i === 0) return after;
    if (!closed && i === n - 1) return before;
    const miter = Math.max(0.72, 1 + before[0] * after[0] + before[2] * after[2]);
    return [(before[0] + after[0]) / miter, 0, (before[2] + after[2]) / miter];
  });
  const inner = (p, i, distance) => [
    p[0] - offsets[i][0] * distance,
    p[1] - offsets[i][2] * distance,
  ];
  const yTop = path.map((a, i) => topAt(a, offsets[i], i));
  for (let i = 0; i < segmentCount; i++) {
    const j = (i + 1) % n,
      a = path[i],
      b = path[j],
      w = edge(a, b);
    const t = yTop[i],
      s = yTop[j],
      ai = inner(a, i, u0),
      bi = inner(b, j, u0);
    const ao = inner(a, i, u1),
      bo = inner(b, j, u1);
    const base = (p, height) => Math.min(grade(p) - 0.5, height - 0.46);
    face(
      out,
      'stone',
      [loc(a, base(a, t)), loc(b, base(b, s)), loc(b, s - 0.24), loc(a, t - 0.24)],
      w.normal,
      color,
    );
    if (lod < 2) {
      bendingFace(
        out,
        lod === 0 ? 'stone' : 'cut',
        [loc(a, t - 0.24), loc(b, s - 0.24), loc(bi, s - 0.19), loc(ai, t - 0.19)],
        up,
        c.cut,
      );
    } else {
      bendingFace(
        out,
        'cut',
        [loc(a, t - 0.24), loc(b, s - 0.24), loc(bo, s + 0.11), loc(ao, t + 0.11)],
        up,
        c.cut,
      );
      bendingFace(
        out,
        'cut',
        [loc(ao, t + 0.11), loc(bo, s + 0.11), loc(bi, s - 0.19), loc(ai, t - 0.19)],
        up,
        c.cut,
      );
    }
    if (lod > 0) {
      const normal = w.normal.map((n) => -n);
      face(
        out,
        'stone',
        [loc(ai, base(ai, t)), loc(bi, base(bi, s)), loc(bi, s - 0.19), loc(ai, t - 0.19)],
        normal,
        c.stain,
      );
    }
    if (lod === 3 && distance(a, b) > 5.2 && i % 4 === 0) {
      const w = edge(a, b),
        x = w.length * 0.5;
      panel(
        out,
        'cut',
        w,
        x - 0.055,
        x + 0.055,
        (t + s) * 0.5 - 0.77,
        (t + s) * 0.5 - 0.28,
        0.012,
        c.ashlars,
      );
    }
  }
}

function ramparts(out, lod) {
  const path = lod < 2 ? simplify(perimeter, lod === 0 ? 5.9 : 1.1, 35) : perimeter;
  const indices = new Map(perimeter.map((point, i) => [point, i]));
  wallSections(
    out,
    path,
    (p, n) => {
      const [x, z] = p,
        y = grade(p),
        i = indices.get(p);
      if (i >= lowerWestEdges[0] && i <= lowerWestEdges[1]) return y + 1.38;
      const inset = (d) => grade([x - n[0] * d, z - n[2] * d]);
      const shoulder = Math.max(y, inset(2.1), inset(4.3), inset(7.1));
      return Math.min(shoulder, y + 11.2) + 1.05;
    },
    { u0: 1.22, u1: 0.47, color: c.stone, closed: true },
    lod,
  );
  for (const { path } of outworks) {
    wallSections(
      out,
      path,
      (p) => grade(p) + 1.9,
      { u0: 0.78, u1: 0.31, color: c.darkStone, closed: false },
      lod,
    );
  }
}

function cap(out, slot, ring, height, color) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => loc(ring[j], height(ring[j])));
    face(out, slot, p, up, color);
  }
}

function clip(ring, distance) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      da = distance(a),
      db = distance(b);
    if (da >= 0) result.push(a);
    if (da * db < 0) result.push(lerp(a, b, da / (da - db)));
  }
  return result;
}
function roofControls(ring, eave, rise, roof) {
  if (roof === 'flat') return { height: () => eave, planes: [() => eave] };
  let start = ring[0],
    end = ring[1],
    span = distance(start, end);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      n = distance(a, b);
    if (n > span) {
      start = a;
      end = b;
      span = n;
    }
  }
  const x = (end[0] - start[0]) / span,
    z = (end[1] - start[1]) / span;
  const u = ([a, b]) => x * a + z * b,
    v = ([a, b]) => -z * a + x * b;
  const lo = Math.min(...ring.map(v)),
    hi = Math.max(...ring.map(v));
  const front = Math.min(...ring.map(u)),
    back = Math.max(...ring.map(u));
  const side = (v) => (rise * v) / Math.max(0.5, (hi - lo) / 2);
  const planes = [(p) => eave + side(v(p) - lo), (p) => eave + side(hi - v(p))];
  const hip = Math.min((back - front) * 0.4, (hi - lo) * 0.49);
  if (roof === 'hip')
    planes.push(
      (p) => eave + (rise * (u(p) - front)) / Math.max(0.5, hip),
      (p) => eave + (rise * (back - u(p))) / Math.max(0.5, hip),
    );
  return { height: (p) => Math.min(...planes.map((plane) => plane(p))), planes };
}
function roofMesh(out, slot, ring, controls, color) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const original = ids.slice(i, i + 3).map((j) => ring[j]);
    for (const plane of controls.planes) {
      let p = original;
      for (const other of controls.planes)
        if (plane !== other && p.length) p = clip(p, (v) => other(v) - plane(v));
      for (let j = 2; j < p.length; j++) {
        const triangle = [p[0], p[j - 1], p[j]];
        if (Math.abs(area(triangle)) > 1e-5)
          face(
            out,
            slot,
            triangle.map((q) => loc(q, plane(q))),
            up,
            color,
          );
      }
    }
  }
}
function panel(out, slot, { p, normal }, a, b, lo, hi, depth, color) {
  if (hi - lo < 0.02 || b - a < 0.025) return;
  face(
    out,
    slot,
    [p(a, lo, depth), p(b, lo, depth), p(b, hi, depth), p(a, hi, depth)],
    normal,
    color,
  );
}

function wallShell(out, w, controls, a, b, floor, low, finish, lod) {
  const { length, normal, p } = w;
  const steps = [0, 1];
  for (const [i, plane] of controls.planes.entries())
    for (const other of controls.planes.slice(i + 1)) {
      const x = plane(a) - other(a),
        z = plane(b) - other(b);
      if (x * z < 0) steps.push(x / (x - z));
    }
  steps.sort((a, b) => a - b);
  for (let i = 1; i < steps.length; i++) {
    const start = steps[i - 1],
      end = steps[i],
      a1 = lerp(a, b, start),
      b1 = lerp(a, b, end);
    if (distance(a1, b1) < 0.00025) continue;
    const lx = Math.min(low, grade(a1) - 0.21),
      lz = Math.min(low, grade(b1) - 0.21);
    const x = start * length,
      z = end * length;
    const base = Math.min(floor, controls.height(a1) - 0.36, controls.height(b1) - 0.36);
    if (lod > 1) face(out, 'stone', [p(x, lx), p(z, lz), p(z, base), p(x, base)], normal, c.stone);
    face(
      out,
      'plaster',
      [
        p(x, lod > 1 ? base : lx),
        p(z, lod > 1 ? base : lz),
        p(z, controls.height(b1)),
        p(x, controls.height(a1)),
      ],
      normal,
      finish,
    );
  }
  if (lod > 1 && length > 3.4)
    panel(out, 'cut', w, 0, length, floor - 0.045, floor + 0.075, 0.045, c.cut);
}

function windows(out, w, building, floor, eave, level) {
  if (level < 1 || building.windows === 0 || w.length < 2.1) return;
  const rows = level === 1 ? Math.min(building.windows, 2) : building.windows,
    count = Math.max(1, Math.round(w.length / (level === 1 ? 7.6 : 3.85)));
  const spacing = Math.max(1.4, (eave - floor - 1.0) / rows);
  for (let r = 0; r < rows; r++) {
    const y = floor + 0.91 + spacing * r;
    const height = Math.min(1.43, eave - y - 0.22);
    if (height < 0.46) continue;
    for (let i = 0; i < count; i++) {
      const x = (w.length * (i + 0.5)) / count,
        p = w.p(x, y);
      if (y < grade([p[0], p[2]]) + 0.18) continue;
      const half = Math.min(w.length * 0.33, rows > 2 ? 0.45 : 0.6);
      if (level > 1)
        panel(
          out,
          'cut',
          w,
          x - half - 0.11,
          x + half + 0.11,
          y - 0.08,
          y + height + 0.1,
          0.025,
          c.cut,
        );
      panel(out, 'glass', w, x - half, x + half, y, y + height, 0.043, c.glass);
      if (level > 2) panel(out, 'wood', w, x - 0.027, x + 0.027, y, y + height, 0.055, c.rail);
    }
  }
}

function smallTower(out, center, y, width, peak, lod) {
  const [x, z] = center,
    r = width * 0.5;
  const ring = [
    [x - r, z - r],
    [x + r, z - r],
    [x + r, z + r],
    [x - r, z + r],
  ];
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % 4],
      w = edge(a, b);
    panel(out, 'plaster', w, 0, w.length, y - 0.75, peak - 2.12, 0, c.cream);
    if (lod > 0)
      panel(
        out,
        'glass',
        w,
        w.length * 0.32,
        w.length * 0.68,
        peak - 3.16,
        peak - 2.4,
        0.035,
        c.glass,
      );
    face(out, 'roof', [loc(a, peak - 2.12), loc(b, peak - 2.12), loc(center, peak)], up, c.roof);
  }
  if (lod > 1) beam(out, 'wood', loc(center, peak), loc(center, peak + 0.59), 0.065, 0.065, c.rail);
}

function portal(out, w, controls, point, lod) {
  const { p, normal, length } = w;
  const u = Math.hypot(point[0] - p(0, 0)[0], point[1] - p(0, 0)[2]);
  const half = gate.width / 2,
    left = u - half,
    right = u + half,
    foot = gate.landingY;
  const top = (x) => {
    const [a, , b] = p(x, 0);
    return controls.height([a, b]);
  };
  for (const [a, b] of [
    [0, left],
    [right, length],
  ]) {
    const [x, , z] = p(a, 0),
      [u, , v] = p(b, 0);
    face(
      out,
      'stone',
      [
        p(a, Math.min(foot - 0.48, grade([x, z]) - 0.3)),
        p(b, Math.min(foot - 0.48, grade([u, v]) - 0.3)),
        p(b, top(b)),
        p(a, top(a)),
      ],
      normal,
      c.stone,
    );
  }
  const parts = [6, 8, 14, 20][lod];
  const curve = (r, rise) =>
    Array.from({ length: parts + 1 }, (_, i) => {
      const angle = (Math.PI * i) / parts;
      return [u - r * Math.cos(angle), gate.springY + rise * Math.sin(angle)];
    });
  const arch = curve(half, gate.portalRise),
    band = curve(half + 0.32, gate.portalRise + 0.34);
  const back = -gate.depth;
  const inside = [w.p(0, 0), w.p(length, 0)];
  const tangent = inside[1].map((v, i) => (v - inside[0][i]) / length);
  for (const [a, sign] of [
    [left, 1],
    [right, -1],
  ]) {
    face(
      out,
      'ashlar',
      [p(a, foot, 0), p(a, foot, back), p(a, gate.springY, back), p(a, gate.springY, 0)],
      tangent.map((n) => n * sign),
      c.darkStone,
    );
    if (lod > 0) {
      const b = a - 0.32 * sign;
      panel(out, 'cut', w, Math.min(a, b), Math.max(a, b), foot, gate.springY, 0.09, c.cut);
    }
  }
  for (let i = 1; i < arch.length; i++) {
    const [a, y] = arch[i - 1],
      [b, z] = arch[i];
    face(out, 'stone', [p(a, y), p(b, z), p(b, top(b)), p(a, top(a))], normal, c.stone);
    face(out, 'ashlar', [p(a, y), p(b, z), p(b, z, back), p(a, y, back)], [0, -1, 0], c.darkStone);
    if (lod > 0) {
      const [d, s] = band[i - 1],
        [e, t] = band[i];
      face(
        out,
        'cut',
        [p(a, y, 0.08), p(b, z, 0.08), p(e, t, 0.08), p(d, s, 0.08)],
        normal,
        i % 3 === 0 ? c.pale : c.cut,
      );
    }
  }
  const deadEnd = [
    p(left, foot, back),
    p(right, foot, back),
    ...arch
      .slice()
      .reverse()
      .map(([x, y]) => p(x, y, back)),
  ];
  face(out, 'wood', deadEnd, normal, c.recess);
  face(
    out,
    'ashlar',
    [p(left, foot), p(right, foot), p(right, foot, back), p(left, foot, back)],
    up,
    c.darkStone,
  );
  if (lod > 1) {
    const a = left - 0.86,
      b = right + 0.86,
      y = gate.springY + gate.portalRise + 0.58;
    panel(out, 'cut', w, a, b, y - 0.21, y + 0.075, 0.11, c.pale);
    face(out, 'cut', [p(a, y, 0.09), p(b, y, 0.09), p(u, y + 1.54, 0.09)], normal, c.cut);
    beam(out, 'cut', p(a, y, 0.23), p(u, y + 1.54, 0.23), 0.17, 0.16, c.pale);
    beam(out, 'cut', p(b, y, 0.23), p(u, y + 1.54, 0.23), 0.17, 0.16, c.pale);
    const detailY = y + 2.0;
    panel(out, 'cut', w, u - 0.58, u + 0.58, detailY, detailY + 1.44, 0.13, c.cut);
    if (lod === 3)
      panel(out, 'ashlar', w, u - 0.37, u + 0.37, detailY + 0.2, detailY + 1.2, 0.16, c.ashlars);
  }
}

function foundationFloor(building) {
  if (building.type === 'gatehouse') return building.level - 1.5;
  if (building.type === 'georgenburg') return -12.1;
  return building.level + 0.13;
}
function coarseMass(out, building) {
  const original = building.outline;
  const [a, b] = original.reduce(
    ([start, end], current, i) => {
      const next = original[(i + 1) % original.length];
      return distance(current, next) > distance(start, end) ? [current, next] : [start, end];
    },
    [original[0], original[1]],
  );
  const length = distance(a, b),
    cos = (b[0] - a[0]) / length,
    sin = (b[1] - a[1]) / length;
  const local = original.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
  const [[x0, x1], [z0, z1]] = extent(local);
  const world = ([x, z]) => [x * cos - z * sin, x * sin + z * cos];
  const ring = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map(world);
  const floor = foundationFloor(building);
  const rise = building.roofRise,
    y = floor + building.height - rise;
  const slot = building.roofFinish === 'clay' ? 'clay' : 'roof';
  const col = slot === 'clay' ? c.clay : c.roof;
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % 4];
    face(
      out,
      'plaster',
      [
        loc(a, Math.min(floor - 0.47, grade(a) - 0.38)),
        loc(b, Math.min(floor - 0.47, grade(b) - 0.38)),
        loc(b, y),
        loc(a, y),
      ],
      edge(a, b).normal,
      c[building.finish],
    );
  }
  if (building.roof === 'flat') cap(out, slot, ring, () => y, col);
  else {
    const indent = building.roof === 'hip' ? Math.min((x1 - x0) * 0.37, (z1 - z0) * 0.49) : 0;
    const crest = [world([x0 + indent, (z0 + z1) / 2]), world([x1 - indent, (z0 + z1) / 2])];
    face(
      out,
      slot,
      [loc(ring[0], y), loc(ring[1], y), loc(crest[1], y + rise), loc(crest[0], y + rise)],
      up,
      col,
    );
    face(
      out,
      slot,
      [loc(ring[2], y), loc(ring[3], y), loc(crest[0], y + rise), loc(crest[1], y + rise)],
      up,
      col,
    );
    for (const [i, j, k] of [
      [0, 3, 0],
      [1, 2, 1],
    ]) {
      const normal = edge(ring[j], ring[i]).normal;
      face(
        out,
        indent > 0 ? slot : 'plaster',
        [loc(ring[i], y), loc(ring[j], y), loc(crest[k], y + rise)],
        indent > 0 ? up : normal,
        indent > 0 ? col : c[building.finish],
      );
    }
  }
  if (building.type === 'church') smallTower(out, [-10.6, -8.3], y, 3.45, y + 8.3, 0);
}

function pitchedBuilding(out, building, lod) {
  const original = building.outline;
  const ring = lod < 2 && building.type !== 'gatehouse' ? simplify(original, 0.94, 4) : original;
  const sign = Math.sign(area(ring));
  const floor = foundationFloor(building),
    eave = floor + building.height - building.roofRise;
  const control = roofControls(ring, eave, building.roofRise, building.roof);
  const wallColor = c[building.finish],
    roofSlot = building.roofFinish === 'clay' ? 'clay' : 'roof';
  const roofColor = roofSlot === 'clay' ? c.clay : c.roof;
  const f = building.type === 'gatehouse' ? gate.lastIndex : 0;
  if (f > 0) portal(out, edge(ring[0], ring[f], sign), control, ring[gate.openingIndex], lod);
  for (let i = f; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      w = edge(a, b, sign);
    wallShell(out, w, control, a, b, floor, floor - 0.49, wallColor, lod);
    if (lod > 1 || (lod === 1 && building.major)) windows(out, w, building, floor, eave, lod);
  }
  roofMesh(out, roofSlot, ring, control, roofColor);
  if (building.type === 'church') smallTower(out, [-10.6, -8.3], eave, 3.45, eave + 8.3, lod);
  if (lod > 1 && building.major && building.roof !== 'flat') {
    const bounds = extent(ring),
      [x, z] = [0, 1].map((i) => (bounds[i][0] + bounds[i][1]) / 2);
    if (building.type === 'georgenburg') {
      // The cliff-side projecting bay has its own steep slate roof.
      const bay = [
        original[5],
        original[6],
        original[7],
        original[8],
        original[9],
        original[10],
        original[4],
      ];
      const center = [0, 1].map((k) => bay.reduce((s, p) => s + p[k], 0) / bay.length);
      for (const [i, a] of bay.entries())
        face(
          out,
          'roof',
          [
            loc(a, eave + 0.48),
            loc(bay[(i + 1) % bay.length], eave + 0.48),
            loc(center, eave + 5.75),
          ],
          up,
          c.roof,
        );
    }
    if ([23267112, 23267128, 23267132, 26555283].includes(building.id)) {
      const [x0, x1] = bounds[0],
        [z0, z1] = bounds[1],
        xAxis = x1 - x0 > z1 - z0;
      const length = xAxis ? x1 - x0 : z1 - z0;
      const count = Math.max(2, Math.floor(length / 13));
      for (let i = 0; i < count; i++) {
        const d = length * ((i + 0.5) / count - 0.5);
        const q = xAxis ? [x + d, z] : [x, z + d];
        const sign = i % 2 === 0 ? 1 : -1;
        q[xAxis ? 1 : 0] += sign * 2.2;
        const h = control.height(q);
        if (h < eave + 0.55 || h > eave + building.roofRise - 0.3) continue;
        const dir = xAxis ? [0, 0, sign] : [sign, 0, 0];
        const a = xAxis ? [q[0] - 0.6, q[1] + sign * 0.64] : [q[0] + sign * 0.64, q[1] - 0.6];
        const b = xAxis ? [q[0] + 0.6, q[1] + sign * 0.64] : [q[0] + sign * 0.64, q[1] + 0.6];
        face(
          out,
          'plaster',
          [loc(a, h - 0.28), loc(b, h - 0.28), loc(b, h + 0.41), loc(a, h + 0.41)],
          dir,
          c.cream,
        );
        face(out, roofSlot, [loc(a, h + 0.41), loc(b, h + 0.41), loc(q, h + 1.14)], up, roofColor);
      }
    }
  }
}

function coveredWork(out, building, lod) {
  const ring = lod === 0 ? simplify(building.outline, 1.5, 4) : building.outline;
  const sign = Math.sign(area(ring));
  const low = [439809399, 1300901092, 1300938856, 1302241956].includes(building.id);
  const crown = (p) => grade(p) + (low ? 1.12 : 0.65);
  // The traversable upper edge remains near the measured terrain over the casemates.
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      w = edge(a, b, sign),
      h = crown(a),
      k = crown(b);
    face(
      out,
      'stone',
      [loc(a, grade(a) - 0.32), loc(b, grade(b) - 0.32), loc(b, k), loc(a, h)],
      w.normal,
      c.darkStone,
    );
    if (lod > 0 && low) {
      const width = w.length,
        capY = Math.min(h, k) - 0.05;
      panel(out, 'cut', w, 0, width, capY - 0.23, capY, 0.028, c.cut);
    }
  }
  if (!low) {
    const height = (p) => Math.max(grade(p) + 0.17, building.level + 0.26);
    cap(out, 'stone', ring, height, c.turf);
  }
}

function pavilionBody(out, building, lod) {
  const ring = building.outline,
    sign = Math.sign(area(ring));
  const center = [0, 1].map((i) => ring.reduce((s, p) => s + p[i], 0) / ring.length);
  const { base, lowerTop, wallTop, roofShoulder, roofPeak } = pavilion;
  const scaled = (p, r) => lerp(center, p, r);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      w = edge(a, b, sign);
    const trim = lod > 0 ? 'cut' : 'stone';
    face(
      out,
      'stone',
      [
        loc(a, Math.min(base - 0.45, grade(a) - 0.44)),
        loc(b, Math.min(base - 0.45, grade(b) - 0.44)),
        loc(b, base),
        loc(a, base),
      ],
      w.normal,
      c.darkStone,
    );
    panel(out, 'plaster', w, 0, w.length, base, wallTop, 0, c.gold);
    panel(out, trim, w, 0, w.length, lowerTop - 0.14, lowerTop + 0.095, 0.048, c.pale);
    panel(out, trim, w, 0, w.length, wallTop - 0.21, wallTop + 0.027, 0.053, c.pale);
    const u = w.length / 2;
    if (lod > 0 && w.length > 1.52) {
      const half = Math.min(w.length * 0.287, 0.54);
      panel(out, 'cut', w, u - half - 0.13, u + half + 0.13, 2.11, 4.34, 0.04, c.pale);
      panel(out, 'glass', w, u - half, u + half, 2.31, 4.11, 0.066, c.glass);
      if (lod > 1) {
        panel(out, 'wood', w, u - 0.036, u + 0.036, 2.31, 4.11, 0.082, c.rail);
        for (const q of [2.87, 3.52])
          panel(out, 'wood', w, u - half, u + half, q, q + 0.055, 0.086, c.rail);
        panel(out, 'cut', w, 0.08, 0.22, lowerTop + 0.16, wallTop - 0.24, 0.055, c.pale);
        if (i % 2 === 0) {
          panel(out, 'cut', w, u - 0.46, u + 0.46, base + 0.44, lowerTop - 0.36, 0.034, c.pale);
          panel(out, 'wood', w, u - 0.31, u + 0.31, base + 0.58, lowerTop - 0.49, 0.047, c.rail);
        }
      }
    }
    const levels =
      lod === 0
        ? [
            [1.05, wallTop],
            [0.72, roofShoulder],
          ]
        : [
            [1.05, wallTop],
            [1.007, wallTop + 0.51],
            [0.765, roofShoulder - 0.38],
            [0.72, roofShoulder],
          ];
    for (let j = 1; j < levels.length; j++) {
      const [k, y] = levels[j - 1],
        [r, z] = levels[j];
      face(
        out,
        'roof',
        [loc(scaled(a, k), y), loc(scaled(b, k), y), loc(scaled(b, r), z), loc(scaled(a, r), z)],
        up,
        c.roof,
      );
    }
    face(
      out,
      'roof',
      [
        loc(scaled(a, levels.at(-1)[0]), roofShoulder),
        loc(scaled(b, levels.at(-1)[0]), roofShoulder),
        loc(center, roofPeak),
      ],
      up,
      c.roofMetal,
    );
  }
  if (lod > 0)
    beam(
      out,
      'wood',
      loc(center, roofPeak - 0.01),
      loc(center, roofPeak + 1.02),
      0.11,
      0.11,
      c.rail,
    );
  if (lod > 1)
    sphere(
      out,
      'wood',
      loc(center, roofPeak + 0.24),
      [0.18, 0.18, 0.18],
      c.rail,
      lod === 3 ? 10 : 7,
      5,
    );
}

function westernRoute(out, lod) {
  const levels = new Map([
    [1300951927, [-28.9, -27.55]],
    [1300951928, [-27.55, gate.landingY]],
    [1000527946, [-29.7, -28.5]],
  ]);
  for (const item of ramp) {
    if (item.id === 23267144 || item.id === 439809414 || item.id === 494992716) continue;
    const elevated = levels.get(item.id),
      path = item.points;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        w = edge(a, b);
      const width = item.id === 1300951927 ? 1.54 : 1.23;
      const low = elevated?.[0] ?? grade(a) + 0.14,
        high = elevated?.[1] ?? grade(b) + 0.14;
      const slot = item.material === 'wood' ? 'wood' : 'cut';
      const deckColor = item.material === 'wood' ? c.timber : c.stone;
      const pos = (t, offset, dy = 0) => w.p(w.length * t, low + (high - low) * t + dy, offset);
      bendingFace(
        out,
        slot,
        [pos(0, -width), pos(1, -width), pos(1, width), pos(0, width)],
        up,
        deckColor,
      );
      if (!elevated) continue;
      for (const s of [-1, 1]) {
        const normal = w.normal.map((n) => s * n);
        face(
          out,
          slot,
          [
            pos(0, s * width, -0.22),
            pos(1, s * width, -0.22),
            pos(1, s * width),
            pos(0, s * width),
          ],
          normal,
          deckColor,
        );
        if (lod === 0) continue;
        beam(out, 'wood', pos(0, s * width, 0.78), pos(1, s * width, 0.78), 0.1, 0.1, c.rail);
        const count = Math.max(1, Math.ceil(w.length / (lod === 3 ? 1.8 : 3.1)));
        for (let j = 0; j <= count; j++) {
          const t = j / count;
          beam(out, 'wood', pos(t, s * width), pos(t, s * width, 0.8), 0.11, 0.11, c.rail);
        }
        if (lod > 1 && item.id === 1300951927)
          for (const t of [0.21, 0.5, 0.79]) {
            const q = pos(t, s * width * 0.82, -0.15),
              base = grade([q[0], q[2]]) - 0.25;
            if (base < q[1] - 0.3) beam(out, 'wood', [q[0], base, q[2]], q, 0.31, 0.31, c.timber);
          }
      }
    }
  }
}

const majorOrder = new Set([
  23267112, 23267114, 23267127, 23267128, 23267129, 23267132, 23267136, 23267145, 26555210,
  26555283, 26555378, 36971392, 174901013, 321584584, 439809393, 1300901092,
]);
const districtDetailed = new Set([23267112, 26555210, 26555283, 36971392, 174901013, 439809393]);
function draw(out, lod) {
  ramparts(out, lod);
  westernRoute(out, lod);
  for (const building of buildings) {
    if (lod === 0 && !majorOrder.has(building.id)) continue;
    if (building.type === 'pavilion') pavilionBody(out, building, lod);
    else if (building.type === 'earthwork') coveredWork(out, building, lod);
    else if (lod === 0 && building.type !== 'gatehouse') coarseMass(out, building);
    else if (lod === 1 && !districtDetailed.has(building.id)) coarseMass(out, building);
    else pitchedBuilding(out, building, lod);
  }
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const camera = [436, 269, -467],
  lookAt = [-12, -5, -12];
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
    'Königstein Fortress on the Elbe sandstone plateau, with its ramparts, western gate complex and timber ramp, 49 mapped structures, the garrison church and golden Friedrichsburg.',
  camera,
  lookAt,
  sunDirection: [-390, 550, -404],
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.78,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'western-bridge-and-dark-ramp',
      position: [-149.3, -23.65, -116.4],
      lookAt: [-126.5, -22.08, -104.5],
    },
    {
      name: 'georgenburg-and-western-works',
      position: [-215, 29, -182],
      lookAt: [-134, -3.4, -129],
    },
    {
      name: 'friedrichsburg-and-stone-parapet',
      position: [32.5, 1.62, -91.3],
      lookAt: [62, 4.0, -96],
    },
    { name: 'sandstone-cliff-and-plateau', position: [368, 115, 293], lookAt: [36, -11, 17] },
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
    errorMeters: 5.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.7, surfaces },
      street: { export: 'street', errorMeters: 0.6, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.2, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from the public-domain Qualla Friedrichsburg photo, Romzig’s CC0 original, OSM plans and unchanged GeoSN DGM source elevations.',
};
