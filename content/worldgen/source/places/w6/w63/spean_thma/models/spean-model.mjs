/** Spean Thma: broken stepped corbels, displaced blocks and two entwined root/tree systems. */
import {
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import controls from './spean-controls.json' with { type: 'json' };
export const speanControls = controls;
const C = controls;
export const speanSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
  cap: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
  bark: { slot: 'trim', graph: 'wood_plain', roughness: 1, metallic: 0 },
  leaf: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
const linear = (h) =>
  h.match(/../g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const stone = linear('a9a48b'),
  cap = linear('b9ae91'),
  moss = linear('778066'),
  leaf = linear('6e8259');
const configs = {
  skyline: { course: 1, depth: 1, bevel: false, roots: 2, sides: 3, branch: 0, leaf: 0, rubble: 2 },
  district: {
    course: 5,
    depth: 2,
    bevel: false,
    roots: 5,
    sides: 5,
    branch: 2,
    leaf: 0,
    rubble: 12,
  },
  street: { course: 8, depth: 3, bevel: false, roots: 7, sides: 6, branch: 3, leaf: 2, rubble: 20 },
  closeup: {
    course: 8,
    depth: 5,
    bevel: true,
    roots: 11,
    sides: 8,
    branch: 5,
    leaf: 4,
    rubble: 32,
  },
  master: {
    course: 8,
    depth: 7,
    bevel: true,
    roots: 15,
    sides: 10,
    branch: 6,
    leaf: 6,
    rubble: 44,
  },
};
const hash = (a, b, c = 0) => {
  let v =
    Math.imul(a + 127, 374761393) ^ Math.imul(b + 71, 668265263) ^ Math.imul(c + 17, 2147483647);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};
function lerp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, z] = points[i];
    if (x <= b) return y + ((z - y) * (x - a)) / (b - a);
  }
  return points.at(-1)[1];
}
export function speanGroundY(x, z) {
  const g = C.ground;
  return lerp(
    g.zs.map((q, j) => [
      q,
      lerp(
        g.xs.map((p, i) => [p, g.heights[j][i]]),
        x,
      ),
    ]),
    z,
  );
}
function writer(target, far) {
  function emit(slot, _ref, p, hint, _uv, color) {
    const pts = p.map(([x, y, z]) => [x, y + speanGroundY(x, z), z]);
    for (let i = 1; i < pts.length - 1; i++) {
      let t = [pts[0], pts[i], pts[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((v, q, j) => v + q * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, j) => v - t[0][j]),
            t[2].map((v, j) => v - t[0][j]),
          ),
        ) < 1e-10
      )
        continue;
      target.addTriangle(
        far ? 'far' : slot,
        'palette:#ffffff',
        t,
        n,
        t.map((p) => [p[0], p[1]]),
        color,
      );
    }
  }
  return { addQuad: emit, addTriangle: emit, addConvexPolygon: emit };
}
function block(o, cfg, slot, c, size, seed = 0, tilt = 0) {
  const tone = (hash(seed, 13) - 0.5) * 0.18,
    color = (slot === 'cap' ? cap : stone).map(
      (v, i) => v * (1 + tone) + (seed % 7 === 0 ? moss[i] * 0.12 : 0),
    ),
    [x, y, z] = c,
    [w, h, d] = size;
  if (!cfg.bevel && !tilt) {
    box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color);
    return;
  }
  if (!cfg.bevel) {
    const ring = (yy) =>
      [
        [-w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
        [w / 2, -d / 2],
      ].map(([dx, dz]) => [
        x + dx * Math.cos(tilt) - dz * Math.sin(tilt),
        yy,
        z + dx * Math.sin(tilt) + dz * Math.cos(tilt),
      ]);
    loft(o, slot, [ring(y), ring(y + h)], color);
    return;
  }
  const ring = (yy, shrink) =>
    chamferedRectangle(x, yy, z, w - shrink, d - shrink, Math.min(0.06, w * 0.1, d * 0.08)).map(
      ([px, py, pz]) => {
        const dx = px - x,
          dz = pz - z;
        return [
          x + dx * Math.cos(tilt) - dz * Math.sin(tilt),
          py + (hash(seed, 31) - 0.5) * 0.025,
          z + dx * Math.sin(tilt) + dz * Math.cos(tilt),
        ];
      },
    );
  loft(
    o,
    slot,
    [ring(y, 0.025), ring(y + h * 0.23, 0), ring(y + h * 0.83, 0.012), ring(y + h, 0.06)],
    color,
  );
}
function masonry(o, cfg) {
  const length = C.bays * C.pitch;
  for (let i = 0; i <= C.bays; i++) {
    const x = (i - C.bays / 2) * C.pitch,
      collapsed = i > C.collapsedFromBay,
      max = collapsed ? 0.65 + hash(i, 9) * 0.9 : C.courses * C.courseHeight,
      n = collapsed ? Math.max(1, Math.round(cfg.course * 0.4)) : cfg.course;
    for (let j = 0; j < n; j++) {
      const cuts = [0, 0.34, 0.73, 1.06, 1.46, 1.82, 2.17, 2.49, 2.88],
        cut = (v) =>
          lerp(
            cuts.map((y, i) => [i / 8, y / 2.88]),
            v,
          ) * max,
        y = cut(j / n),
        h = cut((j + 1) / n) - y - 0.015,
        corbel = collapsed ? 0 : Math.max(0, j / n - 0.45) * 0.67,
        w = C.pitch - C.opening + 2 * corbel + (hash(i, j, 19) - 0.5) * 0.09,
        front = C.frontZ + (hash(i, j, 7) - 0.5) * 0.22 + (j > n * 0.6 ? 0.12 : 0),
        back = C.backZ;
      for (let k = 0; k < cfg.depth; k++) {
        const depth = (front - back) / cfg.depth,
          z = back + (k + 0.5) * depth;
        block(
          o,
          cfg,
          'stone',
          [x + (hash(i, j, k) - 0.5) * 0.035, y - 0.12, z],
          [w, h, depth - 0.018],
          i * 100 + j * 11 + k,
          (hash(i, j + 9, k) - 0.5) * (cfg.bevel ? 0.022 : 0),
        );
      }
    }
  }
  for (let i = 0; i < C.collapsedFromBay; i++) {
    const x = (i - (C.bays - 1) / 2) * C.pitch;
    for (let k = 0; k < cfg.depth; k++) {
      const z = C.backZ + ((k + 0.5) * (C.frontZ - C.backZ)) / cfg.depth,
        y = 2.76 + (hash(i, 73, k) - 0.5) * 0.1;
      // Missing front slabs near the broken east edge remain missing.
      if (i >= C.collapsedFromBay - 2 && z > 1.2) continue;
      block(
        o,
        cfg,
        'cap',
        [x, y, z],
        [C.pitch + 0.16, 0.38, (C.frontZ - C.backZ) / cfg.depth - 0.025],
        600 + i * 10 + k,
        (hash(i, 98, k) - 0.5) * 0.035,
      );
    }
  }
  // Displaced outer masonry, not a restored complete parapet or invented road deck.
  for (let i = 0; i < cfg.rubble; i++) {
    const right = i % 3 !== 0,
      x = right ? 4.0 + hash(i, 7) * 6 : -length / 2 - 1 + hash(i, 13) * 2,
      z = -3.8 + hash(i, 29) * 10.4,
      y = -0.05 + (i % 5 === 0 ? 0.38 : 0);
    block(
      o,
      cfg,
      i % 4 === 0 ? 'cap' : 'stone',
      [x, y, z],
      [0.65 + hash(i, 19) * 1.05, 0.23 + hash(i, 43) * 0.26, 0.55 + hash(i, 53) * 0.7],
      900 + i,
      (hash(i, 79) - 0.5) * 0.9,
    );
  }
  // Root platform includes the rough retained upper paving behind the corbel face.
  for (let i = 0; i < (cfg.bevel ? 18 : 6); i++) {
    const x = -7.8 + hash(i, 203) * 10,
      z = -2.7 + hash(i, 207) * 4.5;
    block(
      o,
      cfg,
      'cap',
      [x, 3.06 + hash(i, 211) * 0.13, z],
      [1.0 + hash(i, 215) * 0.7, 0.18, 0.65 + hash(i, 219) * 0.5],
      1200 + i,
      (hash(i, 221) - 0.5) * 0.4,
    );
  }
}
function tube(o, points, radii, sides, color, flatten = 1) {
  let previousAcross = flatten === 1 ? undefined : [0, 0, 1];
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, j) => v - a[j])),
      projected = previousAcross?.map(
        (v, k) => v - axis[k] * previousAcross.reduce((sum, q, j) => sum + q * axis[j], 0),
      ),
      across =
        projected && Math.hypot(...projected) > 0.05
          ? normalize(projected)
          : normalize(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
      other = cross(axis, across);
    previousAcross = across;
    return Array.from({ length: sides }, (_, j) => {
      const t = (j * Math.PI * 2) / sides;
      return p.map(
        (v, k) => v + radii[i] * (Math.cos(t) * across[k] * flatten + Math.sin(t) * other[k]),
      );
    });
  });
  loft(o, 'bark', rings, color);
}
function leaflet(o, center, angle, size, color) {
  const [x, y, z] = center,
    c = Math.cos(angle),
    s = Math.sin(angle),
    p = [
      [-0.5, 0],
      [-0.18, -0.32],
      [0.25, -0.25],
      [0.5, 0],
      [0.25, 0.25],
      [-0.18, 0.32],
    ].map(([a, b]) => [
      x + (a * c - b * s) * size,
      y + b * size * 0.28,
      z + (a * s + b * c) * size,
    ]);
  o.addConvexPolygon('leaf', 'palette:#ffffff', p, [0, 1, 0], () => [0, 0], color);
  o.addConvexPolygon(
    'leaf',
    'palette:#ffffff',
    [...p].reverse(),
    [0, -1, 0],
    () => [0, 0],
    color.map((v) => v * 0.88),
  );
}
function tree(o, cfg, t, index) {
  const bark = linear(t.bark),
    base = t.baseHeight,
    x = t.x,
    z = t.z;
  const roots = t.roots
    .filter(
      (_, i) => cfg.roots > 7 || i % Math.max(1, Math.floor(t.roots.length / cfg.roots)) === 0,
    )
    .slice(0, cfg.roots);
  for (const [pathIndex, path] of roots.entries()) {
    const points = [],
      radii = [],
      steps = cfg.bevel ? 3 : cfg.leaf ? 2 : 1;
    for (let i = 0; i < path.length - 1; i++)
      for (let j = 0; j < steps; j++) {
        const t = j / steps,
          a = path[Math.max(0, i - 1)],
          b = path[i],
          c = path[i + 1],
          d = path[Math.min(path.length - 1, i + 2)],
          point = b.map(
            (v, k) =>
              0.5 *
              (2 * v +
                (-a[k] + c[k]) * t +
                (2 * a[k] - 5 * v + 4 * c[k] - d[k]) * t * t +
                (-a[k] + 3 * v - 3 * c[k] + d[k]) * Math.pow(t, 3)),
          );
        points.push([x + point[0], point[1], z + point[2]]);
        const progress = (i + t) / (path.length - 1);
        radii.push((0.36 + 0.08 * (pathIndex % 3)) * (1 - progress * 0.82));
      }
    const end = path.at(-1);
    points.push([x + end[0], end[1], z + end[2]]);
    radii.push(0.055);
    tube(
      o,
      points,
      radii,
      cfg.sides,
      bark.map((v) => v * (0.9 + 0.04 * (pathIndex % 4))),
      0.4,
    );
  }
  const trunk = [
    [x, base, z],
    [x + 0.18, base + 0.85, z + 0.06],
    [x + t.lean[0] * 0.5, base + (t.forkHeight - base) * 0.67, z + t.lean[1] * 0.5],
    [x + t.lean[0], t.forkHeight, z + t.lean[1]],
  ];
  tube(o, trunk, [t.radius, t.radius * 1.14, t.radius * 0.85, t.radius * 0.5], cfg.sides, bark);
  if (index === 0 && cfg.branch)
    for (let i = 0; i < (cfg.bevel ? 5 : 3); i++)
      sphere(
        o,
        'bark',
        [x + Math.cos(i * 2.1) * 0.7, base + 0.8 + (i % 3) * 0.56, z + Math.sin(i * 2.1) * 0.7],
        [0.6, 0.75, 0.45],
        bark.map((v) => v * (0.9 + 0.06 * (i % 3))),
        cfg.sides,
        3,
      );
  if (cfg.branch)
    for (let i = 0; i < (index === 0 ? Math.min(3, cfg.branch) : cfg.branch); i++) {
      const a = (i * Math.PI * 2) / (index === 0 ? 3 : cfg.branch) + 0.7 * index,
        reach = t.spread * 0.65,
        c = Math.cos(a),
        s = Math.sin(a),
        start = trunk.at(-1),
        end = [x + c * reach, t.height - 1.2 + (i % 2) * 1.1, z + s * reach];
      tube(
        o,
        [
          start,
          [
            x + c * reach * 0.35,
            t.forkHeight + (t.height - t.forkHeight) * 0.42,
            z + s * reach * 0.35,
          ],
          [x + c * reach * 0.75, t.height * 0.82, z + s * reach * 0.75],
          end,
        ],
        [index === 0 ? 0.49 : 0.28, index === 0 ? 0.34 : 0.19, 0.15, 0.055],
        cfg.sides,
        bark,
      );
    }
  const clumps = cfg.branch ? cfg.branch + 2 : 1;
  for (let i = 0; i < clumps; i++) {
    const a = (i * Math.PI * 2) / clumps + 0.35 * index,
      reach = t.spread * 0.45,
      center = [x + Math.cos(a) * reach, t.height - 1.5 + (i % 3) * 0.75, z + Math.sin(a) * reach],
      radius = [t.spread * 0.52, 2.5, t.spread * 0.47],
      color = leaf.map((v) => v * (0.85 + 0.08 * (i % 4)));
    sphere(o, 'leaf', center, radius, color, cfg.leaf ? 8 : 5, cfg.leaf ? 4 : 2);
    if (cfg.leaf)
      for (let j = 0; j < cfg.leaf * 8; j++) {
        const ang = j * 2.399963229728653,
          dy = (hash(j, 67 + i) - 0.5) * 3.8,
          rad = Math.sqrt(Math.max(0, 1 - Math.pow(dy / 2.5, 2))),
          px = center[0] + Math.cos(ang) * radius[0] * rad,
          py = center[1] + dy,
          pz = center[2] + Math.sin(ang) * radius[2] * rad;
        for (let k = 0; k < 4; k++)
          leaflet(
            o,
            [px + (k - 1.5) * 0.17, py + 0.05 * (k % 2), pz],
            ang + k * 0.7,
            0.55,
            color.map((v) => v * (0.94 + 0.04 * k)),
          );
      }
  }
}
export function buildSpeanLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw new Error(`Unknown Spean Thma level ${level}`);
  const o = writer(target, level === 'skyline');
  masonry(o, cfg);
  for (const [t, i] of C.rootTrees.map((t, i) => [t, i])) tree(o, cfg, t, i);
}
export const buildSpeanSkyline = (o) => buildSpeanLevel(o, 'skyline');
export const buildSpeanDistrict = (o) => buildSpeanLevel(o, 'district');
export const buildSpeanStreet = (o) => buildSpeanLevel(o, 'street');
export const buildSpeanCloseup = (o) => buildSpeanLevel(o, 'closeup');
