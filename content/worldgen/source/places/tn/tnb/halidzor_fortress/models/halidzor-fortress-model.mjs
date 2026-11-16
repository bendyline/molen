/** Halidzor's standing basalt fortifications and church precinct. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const grid = read('terrain-grid.json');
const site = plan.dimensions;
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_drywall', roughness: 0.96, metallic: 0 },
  rubble: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_basalt_raw', roughness: 0.97, metallic: 0 },
  tread: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.97, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: '898279',
    retained: '827e74',
    broken: '80796f',
    ash: 'a29886',
    church: 'a2998a',
    wing: '9b9182',
    sill: 'aba291',
    dark: '5b574f',
    roof: '948e80',
    earth: '8e8470',
    stair: '9e9381',
  }).map(([k, v]) => [k, rgb(v)]),
);
const up = [0, 1, 0];
const down = [0, -1, 0];
const opposite = (v) => v.map((n) => -n);
const at = ([x, z], y) => [x, y, z];
const xz = ([x, , z]) => [x, z];
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const mid = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const pairs = (path) => path.slice(1).map((b, i) => [path[i], b]);
const closed = (ring) => [...ring, ring[0]];
function grade([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = grid.heightsMeters[j],
    b = grid.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function edge(a, b, sign = 1) {
  const length = dist(a, b);
  const x = (b[0] - a[0]) / length,
    z = (b[1] - a[1]) / length;
  const normal = [z * sign, 0, -x * sign];
  return {
    length,
    normal,
    left: [-x, 0, -z],
    right: [x, 0, z],
    p: (u, y, d = 0) => [a[0] + x * u + normal[0] * d, y, a[1] + z * u + normal[2] * d],
  };
}
function winding(points) {
  return Math.sign(pairs(closed(points)).reduce((s, [[a, b], [x, z]]) => s + a * z - b * x, 0));
}
function face(out, slot, points, target, color) {
  const normal = normalFor(...points);
  const dot = normal.reduce((sum, n, i) => sum + n * target[i], 0);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    points,
    dot < 0 ? opposite(normal) : normal,
    ([x, y, z]) => (Math.abs(normal[1]) > 0.61 ? [x, z] : [x - 0.61 * z, y]),
    color,
  );
}
function panel(out, slot, w, u, v, y, h, d, color, side = 1) {
  face(
    out,
    slot,
    [w.p(u, y, d), w.p(v, y, d), w.p(v, h, d), w.p(u, h, d)],
    side === 1 ? w.normal : opposite(w.normal),
    color,
  );
}
function cap(out, slot, polygon, y, color) {
  const ids = earcut(polygon.flat());
  for (let i = 0; i < ids.length; i += 3)
    face(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => at(polygon[j], y)),
      up,
      color,
    );
}
function solid(out, polygon, top, bottom, wallColor, slot = 'masonry', roofColor = c.roof) {
  const sign = winding(polygon);
  for (const [a, b] of pairs(closed(polygon))) {
    const w = edge(a, b, sign);
    face(
      out,
      slot,
      [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)],
      w.normal,
      wallColor,
    );
  }
  cap(out, 'roof', polygon, top, roofColor);
}
function noise(i, j) {
  let key = Math.imul(i + 19, 198491317) ^ Math.imul(j + 7, 6542989);
  key ^= key >>> 13;
  return (Math.imul(key, 5645831) >>> 0) / 4294967296;
}

function curtain(
  out,
  path,
  heights,
  width,
  lod,
  { seed = 0, westRun = -1, foundation = false } = {},
) {
  for (const [[a, b], i] of pairs(path).map((s, i) => [s, i])) {
    const w = edge(a, b);
    const low = i === westRun;
    const n = Math.max(1, Math.ceil(w.length / [10, 6, 3.7, 2.2][lod]));
    for (let j = 0; j < n; j++) {
      const u = (j * w.length) / n,
        v = ((j + 1) * w.length) / n;
      const top = (x) => {
        const t = x / w.length,
          y = grade(xz(w.p(x, 0)));
        const rough =
          lod < 2 ? 0 : (noise(Math.round(x * 0.61), seed + i) - 0.44) * (low ? 0.45 : 0.29);
        return y + (low ? mix(0.88, 0.96, t) : mix(heights[i], heights[i + 1], t)) + rough;
      };
      const A = top(u),
        B = top(v),
        k = width / 2;
      for (const side of [1, -1]) {
        const start = w.p(u, A, side * k),
          end = w.p(v, B, side * k);
        const back = side === 1 ? w.normal : opposite(w.normal);
        const foot = (p) => grade(xz(p)) - 0.56;
        face(
          out,
          'masonry',
          [at(xz(start), foot(start)), at(xz(end), foot(end)), end, start],
          back,
          low || foundation ? c.broken : side === 1 ? c.wall : c.retained,
        );
      }
      face(
        out,
        'rubble',
        [w.p(u, A, -k), w.p(v, B, -k), w.p(v, B, k), w.p(u, A, k)],
        up,
        low ? c.broken : c.wall,
      );
      if (j === 0 || j === n - 1) {
        const t = j === 0 ? u : v,
          y = top(t);
        const a = w.p(t, y, -k),
          b = w.p(t, y, k);
        face(
          out,
          'masonry',
          [at(xz(a), grade(xz(a)) - 0.56), at(xz(b), grade(xz(b)) - 0.56), b, a],
          j === 0 ? w.left : w.right,
          c.wall,
        );
      }
    }
  }
}

/** Cut the opening and model its entire masonry reveal between the two wall faces. */
function portaled(out, w, section, lod) {
  const {
    base,
    top,
    depth,
    center = w.length / 2,
    width,
    spring,
    rise,
    sill = base,
    material = 'masonry',
    color = c.church,
    framing = 0.13,
  } = section;
  const a = center - width / 2,
    b = center + width / 2;
  const divisions = rise === 0 ? 1 : [4, 6, 10, 14][lod];
  const head = Array.from({ length: divisions + 1 }, (_, i) => {
    const t = i / divisions;
    return [mix(a, b, t), spring + rise * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2)))];
  });
  for (const side of [1, -1]) {
    const d = (side * depth) / 2,
      normal = side === 1 ? w.normal : opposite(w.normal);
    panel(out, material, w, 0, a, base, top, d, color, side);
    panel(out, material, w, b, w.length, base, top, d, color, side);
    if (sill - base > 0.025) panel(out, material, w, a, b, base, sill, d, color, side);
    for (const [[u, y], [v, h]] of pairs(head)) {
      face(
        out,
        material,
        [w.p(u, y, d), w.p(v, h, d), w.p(v, top, d), w.p(u, top, d)],
        normal,
        color,
      );
      if (lod > 0 && framing > 0) {
        const q = d + side * 0.037,
          outX = (x) => x + ((x - center) * framing * 2) / width;
        face(
          out,
          'trim',
          [w.p(u, y, q), w.p(v, h, q), w.p(outX(v), h + framing, q), w.p(outX(u), y + framing, q)],
          normal,
          c.ash,
        );
      }
    }
    if (lod > 0 && framing > 0) {
      panel(out, 'trim', w, a - framing, a, sill, spring, d + side * 0.04, c.ash, side);
      panel(out, 'trim', w, b, b + framing, sill, spring, d + side * 0.04, c.ash, side);
    }
  }
  const reveal = [[a, sill], ...head, [b, sill]];
  for (const [[u, y], [v, h]] of pairs(reveal)) {
    const toward = [w.right[0] * (h - y), -Math.abs(v - u), w.right[2] * (h - y)];
    face(
      out,
      'rubble',
      [w.p(u, y, depth / 2), w.p(v, h, depth / 2), w.p(v, h, -depth / 2), w.p(u, y, -depth / 2)],
      toward,
      c.dark,
    );
  }
  if (sill > base + 0.03)
    face(
      out,
      'trim',
      [
        w.p(a, sill, -depth / 2),
        w.p(b, sill, -depth / 2),
        w.p(b, sill, depth / 2),
        w.p(a, sill, depth / 2),
      ],
      up,
      c.sill,
    );
  const pair = (u, y) => [w.p(u, y, depth / 2), w.p(u, y, -depth / 2)];
  for (const [u, toward] of [
    [0, w.left],
    [w.length, w.right],
  ]) {
    face(out, material, [...pair(u, base), ...pair(u, top).reverse()], toward, color);
  }
  face(
    out,
    'rubble',
    [
      w.p(0, top, depth / 2),
      w.p(w.length, top, depth / 2),
      w.p(w.length, top, -depth / 2),
      w.p(0, top, -depth / 2),
    ],
    up,
    c.roof,
  );
}
function steps(out, a, b, width, lod, stair) {
  const w = edge(a, b);
  const count = Math.max(1, Math.ceil(w.length / (stair ? [2.6, 1.2, 0.64, 0.43][lod] : 2.6)));
  const pt = (u, d, flat) => {
    const p = xz(w.p(u, 0, d));
    return at(p, (flat ?? grade(p)) + 0.13);
  };
  for (let i = 0; i < count; i++) {
    const u = (w.length * i) / count,
      v = (w.length * (i + 1)) / count;
    const flat = stair ? grade(xz(w.p((u + v) * 0.5, 0))) : undefined;
    const half = width / 2;
    const a = pt(u, -half, flat),
      b = pt(v, -half, flat),
      c0 = pt(v, half, flat),
      d = pt(u, half, flat);
    face(out, 'tread', [a, b, c0, d], up, stair ? c.stair : c.earth);
    if (stair && lod > 0) {
      const lower = ([x, y, z]) => [x, Math.min(y - 0.13, grade([x, z]) - 0.35), z];
      face(out, 'tread', [lower(a), lower(d), d, a], w.left, c.roof);
      face(out, 'tread', [lower(b), lower(c0), c0, b], w.right, c.roof);
      face(out, 'tread', [lower(a), lower(b), b, a], opposite(w.normal), c.roof);
      face(out, 'tread', [lower(d), lower(c0), c0, d], w.normal, c.roof);
    }
  }
}
function outerWorks(out, lod) {
  for (const wall of site.walls)
    curtain(out, wall.points, wall.heights, site.wallWidth, lod, {
      seed: wall.id % 293,
      westRun: wall.westRun,
    });
  const g = site.southernGate;
  const w = edge(g.from, g.to);
  const y = grade(g.position);
  portaled(
    out,
    w,
    {
      base: y - 1,
      top: y + g.heightAboveGrade,
      depth: site.wallWidth,
      width: g.openWidth,
      spring: y + g.springAboveGrade,
      rise: g.rise,
      framing: 0.2,
      color: c.wall,
    },
    lod,
  );
  steps(out, lerp(g.from, g.to, 0.5), [-8.5, 25.08], 1.85, lod, false);
  if (lod > 0)
    for (const route of site.paths) {
      const stair = route.kind === 'steps';
      for (const [a, b] of pairs(route.points)) steps(out, a, b, stair ? 1.25 : 1.55, lod, stair);
    }
  tower(out, site.southwestTower, lod);
}
function circle(pos, r, n, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const angle = offset + (i * 2 * Math.PI) / n;
    return [pos[0] + r * Math.cos(angle), pos[1] + r * Math.sin(angle)];
  });
}
function tower(out, spec, lod) {
  const n = [10, 16, 24, 36][lod];
  const base = grade(spec.center);
  const outer = circle(spec.center, spec.diameter / 2, n);
  const inner = circle(spec.center, spec.diameter / 2 - spec.wallWidth, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const y = (k) =>
      base +
      spec.aboveGrade +
      0.37 * Math.sin((k * 2 * Math.PI) / n) +
      (lod > 1 ? (noise(k, 12) - 0.5) * 0.25 : 0);
    const h = y(i),
      t = y(j),
      a = outer[i],
      b = outer[j],
      p = inner[i],
      q = inner[j],
      w = edge(a, b);
    face(
      out,
      'masonry',
      [at(a, grade(a) - 0.77), at(b, grade(b) - 0.77), at(b, t), at(a, h)],
      w.normal,
      c.wall,
    );
    face(
      out,
      'masonry',
      [at(p, base + 2.24), at(q, base + 2.24), at(q, t), at(p, h)],
      opposite(w.normal),
      c.retained,
    );
    face(out, 'rubble', [at(a, h), at(b, t), at(q, t), at(p, h)], up, c.broken);
  }
  cap(out, 'tread', inner, base + 2.24, c.dark);
}
function archRoom(out, polygon, bottom, roof, lod, side, width, rise = 0.76) {
  const s = winding(polygon);
  for (const [[a, b], i] of pairs(closed(polygon)).map((a, i) => [a, i])) {
    const w = edge(a, b, s);
    const y = Math.min(grade(a), grade(b), bottom) - 0.5;
    if (i === side) {
      portaled(
        out,
        w,
        {
          base: y,
          top: roof,
          depth: 0.69,
          width,
          spring: bottom + 1.45,
          rise,
          sill: bottom,
          framing: 0.11,
          color: c.wing,
        },
        lod,
      );
      if (bottom > y + 1.0)
        panel(
          out,
          'tread',
          w,
          w.length / 2 - width / 2,
          w.length / 2 + width / 2,
          y,
          bottom,
          0.22,
          c.retained,
        );
    } else face(out, 'masonry', [at(a, y), at(b, y), at(b, roof), at(a, roof)], w.normal, c.wing);
  }
  cap(out, 'roof', polygon, roof, c.roof);
}
function flatWing(out, core, spec, lod) {
  const ring = spec.footprint,
    sign = winding(ring);
  const axisX = spec.terraceFrom;
  const clipped = (limit) => {
    const points = [];
    for (const [a, b] of pairs(closed(ring))) {
      if (a[0] <= limit) points.push(a);
      if ((a[0] < limit && b[0] > limit) || (a[0] > limit && b[0] < limit))
        points.push(lerp(a, b, (limit - a[0]) / (b[0] - a[0])));
    }
    return points;
  };
  const upper = clipped(axisX);
  if (lod === 0) {
    solid(out, ring, spec.lower, (p) => grade(p) - 0.51, c.wing);
    solid(out, upper, spec.upper, () => spec.lower - 0.1, c.wing);
    return;
  }
  const outside = spec.kind === 'south' ? 3 : 1;
  archRoom(out, ring, core.floor, spec.lower, lod, outside, spec.kind === 'south' ? 3.0 : 2.9);
  const upperEdge = spec.kind === 'south' ? 1 : 2;
  archRoom(out, upper, spec.lower + 0.03, spec.upper, lod, upperEdge, 2.05, 0.62);
  // Shallow rubble copings mark the level roof platform and remain below sight lines.
  for (const [a, b] of pairs(closed(upper))) {
    if (dist(a, b) < 1.75) continue;
    const w = edge(a, b, sign);
    panel(out, 'trim', w, 0, w.length, spec.upper - 0.24, spec.upper - 0.08, 0.075, c.ash);
  }
}
function spire(out, center, y, r, h, n, color) {
  const base = circle(center, r, n, Math.PI / n);
  for (const [a, b] of pairs(closed(base))) {
    const w = edge(a, b);
    face(
      out,
      'roof',
      [at(a, y), at(b, y), at(center, y + h)],
      [w.normal[0], 0.46, w.normal[2]],
      color,
    );
  }
}
function belfry(out, church, lod) {
  const spec = church.belfry,
    base = church.roof;
  const radius = church.bellOpeningDiameter / 2;
  const orient = Math.PI / 6;
  const lowPad = circle(spec.center, radius + 0.4, 12, orient);
  solid(out, lowPad, base + 0.24, () => base - 0.03, c.ash, 'trim');
  const piers = circle(spec.center, radius + 0.02, 6, orient);
  const eaves = base + spec.openHeight + 0.28;
  if (lod === 0) {
    solid(
      out,
      circle(spec.center, radius + 0.17, 6, orient),
      eaves,
      () => base + 0.18,
      c.ash,
      'trim',
    );
  } else {
    for (const p of piers)
      solid(
        out,
        circle(p, 0.16, lod === 1 ? 4 : 8, orient),
        eaves - 0.21,
        () => base + 0.21,
        c.ash,
        'trim',
      );
    for (const [a, b] of pairs(closed(piers))) {
      const w = edge(a, b);
      // Belfry arcade uses actual arches kept clear between the stone piers.
      portaled(
        out,
        w,
        {
          base: eaves - 0.51,
          top: eaves,
          depth: 0.16,
          width: w.length * 0.73,
          spring: eaves - 0.48,
          rise: 0.28,
          framing: 0,
          color: c.ash,
          material: 'trim',
        },
        lod,
      );
    }
  }
  solid(
    out,
    circle(spec.center, radius + 0.27, 6, orient),
    eaves + 0.14,
    () => eaves - 0.035,
    c.ash,
    'trim',
  );
  spire(
    out,
    spec.center,
    eaves + 0.14,
    radius + 0.27,
    spec.peakHeight - spec.openHeight - 0.42,
    6,
    c.roof,
  );
  if (lod > 1) {
    const h = base + spec.peakHeight;
    solid(out, circle(spec.center, 0.071, 6), h + 0.4, () => h - 0.025, c.ash, 'trim');
    const [x, z] = spec.center;
    solid(
      out,
      [
        [x - 0.24, z - 0.035],
        [x + 0.24, z - 0.035],
        [x + 0.24, z + 0.035],
        [x - 0.24, z + 0.035],
      ],
      h + 0.29,
      () => h + 0.23,
      c.ash,
      'trim',
    );
  }
}
function church(out, lod) {
  const data = site.church,
    roof = data.roof;
  const core = data.core;
  const sign = winding(core);
  if (lod === 0) solid(out, core, roof, (p) => grade(p) - 0.51, c.church);
  else {
    for (const [[a, b], i] of pairs(closed(core)).map((a, i) => [a, i])) {
      const w = edge(a, b, sign);
      const base = Math.min(grade(a), grade(b), data.floor) - 0.65;
      const front = i === 1 || i === 3;
      if (front) {
        const u = xz(w.p(0, 0, -data.wallWidth / 2)),
          v = xz(w.p(w.length, 0, -data.wallWidth / 2));
        portaled(
          out,
          edge(u, v, sign),
          {
            base,
            top: roof,
            depth: data.wallWidth,
            width: i === 1 ? 0.35 : 0.43,
            sill: roof - 3.35,
            spring: roof - 2.05,
            rise: 0.19,
            framing: 0.1,
            color: c.church,
          },
          lod,
        );
        const inner = edge(
          xz(w.p(0, 0, -data.wallWidth - 0.055)),
          xz(w.p(w.length, 0, -data.wallWidth - 0.055)),
          sign,
        );
        panel(out, 'rubble', inner, 0, inner.length, base, roof, 0, c.dark);
      } else {
        face(
          out,
          'masonry',
          [at(a, grade(a) - 0.68), at(b, grade(b) - 0.68), at(b, roof), at(a, roof)],
          w.normal,
          c.church,
        );
      }
      panel(out, 'trim', w, 0, w.length, roof - 0.25, roof - 0.05, 0.085, c.ash);
    }
    cap(out, 'roof', core, roof, c.roof);
  }
  for (const wing of data.wings) flatWing(out, data, wing, lod);
  belfry(out, data, lod);
}
function tomb(out, lod) {
  const spec = site.northTomb,
    pos = mid(spec.footprint),
    base = grade(pos) + 0.2;
  const eaves = base + spec.roofHeight;
  if (lod === 0) solid(out, spec.footprint, eaves, (p) => grade(p) - 0.48, c.wing);
  else archRoom(out, spec.footprint, base, eaves, lod, 3, 1.18);
  const n = [6, 8, 12, 16][lod],
    rings = lod > 2 ? 5 : 3;
  for (let band = 0; band < rings; band++) {
    const a = (band * Math.PI) / (2 * rings),
      b = ((band + 1) * Math.PI) / (2 * rings);
    const outer = circle(pos, 1.63 * Math.cos(a), n),
      inner = circle(pos, 1.63 * Math.cos(b), n);
    const y = eaves + 1.36 * Math.sin(a),
      h = eaves + 1.36 * Math.sin(b);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        w = edge(outer[i], outer[j]);
      face(
        out,
        'roof',
        band === rings - 1
          ? [at(outer[i], y), at(outer[j], y), at(pos, h)]
          : [at(outer[i], y), at(outer[j], y), at(inner[j], h), at(inner[i], h)],
        [w.normal[0], 0.66, w.normal[2]],
        c.roof,
      );
    }
  }
}
function ruins(out, lod) {
  tomb(out, lod);
  const v = site.villageChurch;
  curtain(out, closed(v.footprint), [...v.standingHeights, v.standingHeights[0]], 1.08, lod, {
    seed: 273,
  });
  if (lod > 0) {
    const low = closed(site.refectoryTraces);
    curtain(out, low, [0.65, 0.87, 0.64, 1.07, 0.65], 0.62, lod, { seed: 171, foundation: true });
    const cells = closed(site.cellsTraces);
    curtain(out, cells, [0.5, 0.74, 0.94, 0.66, 0.5], 0.56, lod, { seed: 174, foundation: true });
  }
}

function draw(out, lod) {
  outerWorks(out, lod);
  church(out, lod);
  ruins(out, lod);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const camera = [94, 68, 98],
  lookAt = [7, -5, 1];
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
    'The partly restored Halidzor Fortress on the steep Voghji hillside, with rough basalt curtains, the open south portal, a round tower and the fortified Holy Mother of God church.',
  camera,
  lookAt,
  sunDirection: [-155, 572, 460],
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.68,
    focus: { center: [-0.75, 4.5, 12.7] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'southern-portal-and-hall', position: [-14, 6.8, 42], lookAt: [-4, 6.4, 17] },
    { name: 'church-roof-and-basalt-arcades', position: [28, 12.25, 25.5], lookAt: [4, 7.1, 13] },
    {
      name: 'round-tower-and-ruined-west-curtain',
      position: [-53, 20.9, 31],
      lookAt: [-29, 9.9, 10],
    },
    { name: 'east-terrace-and-village-church', position: [87, 21, 46], lookAt: [21, -8, 14] },
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
    errorMeters: 3.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.05, surfaces },
      street: { export: 'street', errorMeters: 0.36, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from native OpenStreetMap wall and ruin data, original Terrarium elevations, and the factual text of Armenian heritage and architectural records.',
};
