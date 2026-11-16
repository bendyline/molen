/** 'forest_of_remembrance': terraced paths, granite moat, timber bridges and memorial planting. */
import { createRequire } from 'node:module';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

const requireWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireWorldgen('earcut');
const clip = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
)('polygon-clipping');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;
const blend = (x) => x * x * (3 - 2 * x);
const seal = (ring) => [...ring, ring[0]];
const ringShape = (ring) => [seal(ring)];
const unit = (x, z) => {
  const length = Math.hypot(x, z);
  return length ? [x / length, z / length] : [0, 0];
};
const normals = (a, b) => unit(a[1] - b[1], b[0] - a[0]);

function bounds(polygons) {
  const xy = polygons.flat(2);
  return [0, 1].map((k) => [Math.min(...xy.map((p) => p[k])), Math.max(...xy.map((p) => p[k]))]);
}

function sampleGrade(grid, x, z) {
  const u = clamp((x - grid.origin[0]) / grid.step, 0, grid.width - 1.0001);
  const v = clamp((z - grid.origin[1]) / grid.step, 0, grid.height - 1.0001);
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const k = j * grid.width + i;
  return mix(
    mix(grid.values[k], grid.values[k + 1], a),
    mix(grid.values[k + grid.width], grid.values[k + grid.width + 1], a),
    b,
  );
}

function legs(path) {
  return path.points
    .slice(1)
    .map((end, i) => {
      const start = path.points[i];
      const dx = end[0] - start[0],
        dz = end[1] - start[1];
      return { start, end, dx, dz, length2: dx * dx + dz * dz, width: path.width };
    })
    .filter((s) => s.length2 > 0);
}

function nearest(x, z, segments) {
  let hit = { distance: Infinity, y: 0, width: 0 };
  for (const { start, end, dx, dz, length2, width } of segments) {
    const a = x - start[0],
      b = z - start[1];
    const t = clamp((a * dx + b * dz) / length2, 0, 1);
    const distance = Math.hypot(a - dx * t, b - dz * t);
    if (distance < hit.distance) hit = { distance, y: mix(start[2], end[2], t), width };
  }
  return hit;
}

function offsetCorner(a, b, c, amount) {
  const [ax, az] = normals(a, b),
    [bx, bz] = normals(b, c);
  const [x, z] = unit(ax + bx, az + bz);
  const distance = amount / Math.max(0.62, x * bx + z * bz);
  return [b[0] + x * distance, b[1] + z * distance];
}

function walkShape(path) {
  const points = path.points.map(([x, z]) => [x, z]);
  const loop = points[0].every((v, k) => v === points.at(-1)[k]);
  if (loop) points.pop();
  const edge = (side) =>
    points.map((point, i) => {
      const a = points[i - 1] ?? (loop ? points.at(-1) : point.map((v, k) => v * 2 - points[1][k]));
      const c = points[i + 1] ?? (loop ? points[0] : point.map((v, k) => v * 2 - points.at(-2)[k]));
      return offsetCorner(a, point, c, (side * path.width) / 2);
    });
  const left = edge(1),
    right = edge(-1);
  if (!loop) return [ringShape([...left, ...right.toReversed()])];
  return clip.xor(ringShape(left), ringShape(right));
}

function triangulate(face, role, polygons, height, color) {
  for (const rings of polygons) {
    const open = rings.map((ring) => ring.slice(0, -1));
    const points = open.flat(),
      holes = [];
    let next = open[0].length;
    for (const ring of open.slice(1)) {
      holes.push(next);
      next += ring.length;
    }
    const triangles = earcut(points.flat(), holes);
    for (let i = 0; i < triangles.length; i += 3) {
      const positions = triangles.slice(i, i + 3).map((k) => {
        const [x, z] = points[k];
        return [x, height(x, z), z];
      });
      face(role, positions, [0, 1, 0], color?.(positions[0][0], positions[0][2]));
    }
  }
}

function meshGround(face, role, polygons, height, step, color) {
  if (!step) {
    triangulate(face, role, polygons, height, color);
    return;
  }
  const [[west, east], [north, south]] = bounds(polygons);
  for (let z = Math.floor(north / step) * step; z < south; z += step) {
    for (let x = Math.floor(west / step) * step; x < east; x += step) {
      const square = [
        [x, z],
        [x + step, z],
        [x + step, z + step],
        [x, z + step],
      ];
      triangulate(face, role, clip.intersection(polygons, ringShape(square)), height, color);
    }
  }
}

function boxBeam(face, role, a, b, width, depth) {
  const [dx, dy, dz] = b.map((v, k) => v - a[k]);
  const [nx, nz] = normals([a[0], a[2]], [b[0], b[2]]);
  const ring = ([x, y, z]) => [
    [x - (nx * width) / 2, y, z - (nz * width) / 2],
    [x + (nx * width) / 2, y, z + (nz * width) / 2],
    [x + (nx * width) / 2, y - depth, z + (nz * width) / 2],
    [x - (nx * width) / 2, y - depth, z - (nz * width) / 2],
  ];
  const start = ring(a),
    end = ring(b);
  face(role, start, [-dx, -dy, -dz]);
  face(role, end, [dx, dy, dz]);
  const outward = [
    [0, 1, 0],
    [nx, 0, nz],
    [0, -1, 0],
    [-nx, 0, -nz],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(role, [start[i], start[j], end[j], end[i]], outward[i]);
  }
}

function addBridge(face, detail, bridge) {
  const [[x, z], [endX, endZ]] = bridge.endpoints;
  const [startY, endY] = bridge.deck;
  const length = Math.hypot(endX - x, endZ - z);
  const [nx, nz] = normals([x, z], [endX, endZ]);
  const at = (t, s, lift = 0) => [
    mix(x, endX, t) + nx * s,
    mix(startY, endY, t) + lift,
    mix(z, endZ, t) + nz * s,
  ];
  boxBeam(face, 'timber', at(0, 0, -0.013), at(1, 0, -0.013), bridge.width, 0.25);
  if (!detail) {
    for (const s of [-1, 1]) {
      const offset = s * (bridge.width / 2 - 0.065);
      face(
        'timber',
        [
          at(0.02, offset, 0.9),
          at(0.98, offset, 0.9),
          at(0.98, offset, 1.04),
          at(0.02, offset, 1.04),
        ],
        [nx * s, 0, nz * s],
      );
    }
    return;
  }
  const n = Math.ceil(length / 0.245);
  if (detail > 1)
    for (let i = 0; i < n; i++) {
      const t = i / n,
        e = (i + 0.97) / n,
        w = bridge.width / 2;
      const tint = 0.87 + 0.16 * (0.5 + 0.5 * Math.sin(i * 13.7));
      face('timber', [at(t, -w), at(e, -w), at(e, w), at(t, w)], [0, 1, 0], tint);
    }
  for (const side of [-1, 1]) {
    const s = side * (bridge.width / 2 - 0.065);
    for (const [level, width] of detail
      ? [
          [0.5, 0.055],
          [1.02, 0.13],
        ]
      : [[1.02, 0.12]]) {
      boxBeam(face, 'timber', at(0.02, s, level), at(0.98, s, level), width, width * 0.7);
    }
    const posts = detail > 1 ? Math.ceil(length / 1.52) : 3;
    for (let i = 0; i <= posts; i++) {
      const t = mix(0.025, 0.975, i / posts),
        p = at(t, s, 1.04);
      const lengthFraction = (detail ? 0.12 : 0.15) / (2 * length);
      boxBeam(
        face,
        'timber',
        at(t - lengthFraction, s, 1.04),
        at(t + lengthFraction, s, 1.04),
        detail ? 0.12 : 0.15,
        p[1] - at(t, s)[1],
      );
    }
  }
}

function column(face, detail, r, surface) {
  const [x, z] = r.center;
  const base = surface(x, z);
  const n = [8, 12, 36, 48][detail];
  const horizontal = (y, radius, flutes = false) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      const d = radius * (flutes && i % 3 === 1 ? 0.905 : 1);
      return [x + d * Math.cos(a), y, z + d * Math.sin(a)];
    });
  const foot = horizontal(base, 0.31),
    bottom = horizontal(base + 0.15, 0.29, detail > 1);
  const top = horizontal(base + r.height - 0.07, 0.245, detail > 1),
    cap = horizontal(base + r.height, 0.247);
  const levels = detail ? [foot, bottom, top, cap] : [foot, cap];
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = levels[j - 1],
        b = levels[j];
      face('granite', [a[i], a[k], b[k], b[i]], [a[i][0] - x, 0, a[i][2] - z], 1.12);
    }
  face('granite', cap, [0, 1, 0], 1.14);
}

function crown(face, role, center, radii, turn, segments, profile, tint) {
  const [x, y, z] = center;
  const rings = profile.map(([height, factor, shift]) =>
    Array.from({ length: segments }, (_, j) => {
      const a = turn + (j * 2 * Math.PI) / segments,
        wobble = 1 + 0.085 * Math.sin(j * 12.43 + turn);
      return [
        x + radii[0] * (Math.cos(a) * factor * wobble + shift),
        y + radii[1] * height,
        z + radii[2] * Math.sin(a) * factor * wobble,
      ];
    }),
  );
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      b = rings[i],
      peak = profile[i][1] < 0.001;
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments,
        normal = [(a[j][0] + a[k][0]) / 2 - x, radii[0] * 0.1, (a[j][2] + a[k][2]) / 2 - z];
      const jitter = 0.93 + 0.12 * (0.5 + 0.5 * Math.sin(j * 11 + i * 5 + turn));
      face(
        role,
        peak ? [a[j], a[k], b[k]] : [a[j], a[k], b[k], b[j]],
        normal,
        tint.map((c) => c * jitter),
      );
    }
  }
}

function trees(face, detail, plants, surface) {
  const cypressProfiles = [
    [
      [0.08, 0.8, 0],
      [0.57, 1.0, 0.09],
      [1, 0, 0.21],
    ],
    [
      [0.05, 0.77, 0],
      [0.61, 1.0, 0.08],
      [1, 0, 0.21],
    ],
    [
      [0.05, 0.78, 0],
      [0.27, 1.0, 0.035],
      [0.75, 0.82, 0.12],
      [1, 0, 0.28],
    ],
    [
      [0.05, 0.7, 0],
      [0.24, 1.0, 0.025],
      [0.54, 0.96, 0.08],
      [0.78, 0.73, 0.14],
      [0.91, 0.41, 0.2],
      [1, 0, 0.28],
    ],
  ];
  const oliveProfile = [
    [-0.68, 0.6, 0],
    [-0.15, 1, 0],
    [0.44, 0.87, 0.12],
    [0.9, 0, 0.16],
  ];
  for (const [i, tree] of plants.entries()) {
    const olive = tree.species === 'olive';
    if (!detail && (olive ? i % 3 : i % 5)) continue;
    const [x, z] = tree.point,
      y = surface(x, z);
    const { height, spread, turn } = tree;
    const shade = 0.77 + 0.3 * (0.5 + 0.5 * Math.cos(turn * 5.7));
    if (!olive) {
      const tint = [0.075, 0.132, 0.043].map((c) => c * shade);
      crown(
        face,
        'vegetation',
        [x, y, z],
        [spread, height, spread],
        turn,
        [3, 3, 6, 8][detail],
        cypressProfiles[detail],
        tint,
      );
      continue;
    }
    if (detail) {
      const sides = detail > 1 ? 6 : 4;
      const trunk = Array.from({ length: sides }, (_v, k) => {
        const q = (k * 2 * Math.PI) / sides;
        return [x + 0.113 * Math.cos(q), z + 0.113 * Math.sin(q)];
      });
      prism(face, 'timber', { outline: trunk }, y, y + height * 0.64, false);
    }
    const branches =
      detail < 2
        ? [[0, 0.07, 0, 1]]
        : [
            [-0.53, 0.03, 0.11, 0.68],
            [0.48, 0.13, 0.27, 0.68],
            [0.1, 0.25, -0.52, 0.65],
            [-0.09, 0.5, 0.08, 0.64],
          ];
    for (const [i, [dx, dy, dz, scale]] of branches.entries()) {
      const tint = [0.189 - i * 0.008, 0.233 - i * 0.005, 0.145 - i * 0.006].map((c) => c * shade);
      crown(
        face,
        'vegetation',
        [x + dx * spread, y + (0.72 + dy * 0.24) * height, z + dz * spread],
        [spread * scale, height * (detail < 2 ? 0.39 : 0.28), spread * scale * 0.92],
        turn + i * 1.71,
        [4, 4, 6, 8][detail],
        oliveProfile,
        tint,
      );
    }
  }
}

export function buildForest(face, detail, site) {
  const grade = (x, z) => sampleGrade(site.roughSlope, x, z);
  const outer = (x, z) => grade(x, z) + 0.4;
  const parcel = legs({ width: 0, points: seal(site.parcel).map(([x, z]) => [x, z, 0]) });
  const externalRoutes = site.outsidePaths.flatMap(legs);
  const apronY = (x, z) => {
    const path = nearest(x, z, externalRoutes);
    const toPath = 1 - blend(clamp((path.distance - path.width / 2) / 1.15, 0, 1));
    const toEdge = blend(clamp(nearest(x, z, parcel).distance / 1.8, 0, 1));
    return grade(x, z) + mix(0.43 * toPath + 0.012, 0.4, toEdge);
  };
  const routes = site.paths.flatMap(legs);
  const bank = legs({
    width: 0,
    points: seal(site.innerBank).map(([x, z]) => [x, z, outer(x, z)]),
  });
  const pathY = (x, z) => nearest(x, z, routes).y;
  const groundY = (x, z) => {
    const route = nearest(x, z, routes),
      rim = nearest(x, z, bank);
    if (route.distance < route.width / 2 + 0.08 && rim.distance > 0.27) return route.y - 0.012;
    // Lower the land toward the moat and blend the higher terrain between turns of the spiral.
    const free = grade(x, z) + clamp(rim.distance * 0.34, 0.4, 5.35);
    const h = mix(route.y, free, blend(clamp((route.distance - route.width / 2) / 4.8, 0, 1)));
    return mix(rim.y, h, blend(clamp(rim.distance / 2.25, 0, 1)));
  };
  const paths = clip.intersection(site.land, clip.union(...site.paths.map(walkShape)));
  const grass = clip.difference(site.land, paths);
  const g = detail < 2 ? (detail ? 8 : 0) : detail === 2 ? 4.8 : 2.65;
  const clearings = site.bridges.flatMap(({ endpoints, width }) =>
    walkShape({ points: endpoints, width: width + 0.16 }),
  );
  const greens = (x, z) => 0.91 + 0.13 * (0.5 + 0.5 * Math.cos(x * 0.27 + z * 0.47));
  meshGround(face, 'turf', grass, groundY, g, greens);
  meshGround(face, 'gravel', paths, (x, z) => Math.min(pathY(x, z), groundY(x, z) + 0.03), g);
  meshGround(face, 'gravel', site.apron, apronY, detail > 1 ? 4.9 : 0);
  triangulate(face, 'gravel', [ringShape(site.causeway)], (x, z) => grade(x, z) + 0.43);
  triangulate(face, 'water', [ringShape(site.water)], () => site.waterY);
  for (const [index, a] of site.water.entries()) {
    const b = site.water[(index + 1) % site.water.length],
      [nx, nz] = normals(a, b);
    const isInner = index < site.innerBank.length - 1;
    const h = isInner ? outer : apronY;
    const ha = h(...a),
      hb = h(...b),
      edge = (p, y) => [p[0], y, p[1]];
    const before = site.water[(index + site.water.length - 1) % site.water.length];
    const after = site.water[(index + 2) % site.water.length];
    const bottomA = offsetCorner(before, a, b, 0.49);
    const bottomB = offsetCorner(a, b, after, 0.49);
    face(
      'granite',
      [
        edge(bottomA, site.waterY - 0.02),
        edge(bottomB, site.waterY - 0.02),
        edge(b, hb),
        edge(a, ha),
      ],
      [nx, 0.22, nz],
    );
    if (detail) {
      const backA = offsetCorner(before, a, b, -0.2);
      const backB = offsetCorner(a, b, after, -0.2);
      // Open the coping at the timber approaches so the stone lip does not cross the deck.
      if (
        clearings.some(
          (opening) => clip.intersection(opening, ringShape([a, b, backB, backA])).length,
        )
      )
        continue;
      const start = edge(backA, ha + 0.085),
        end = edge(backB, hb + 0.085);
      const inA = edge(a, ha + 0.085),
        inB = edge(b, hb + 0.085);
      face('granite', [inA, inB, end, start], [0, 1, 0], 1.12);
      face('granite', [edge(a, ha), edge(b, hb), inB, inA], [nx, 0, nz]);
    }
  }
  for (const bridge of site.bridges) addBridge(face, detail, bridge);
  column(face, detail, site.shaft, groundY);
  if (detail) {
    // Dark plaque on the low north lip, at the photographed approach.
    boxBeam(
      face,
      'darkStone',
      [-8.4, outer(-8.4, -39.4) + 0.05, -39.4],
      [-3.9, outer(-3.9, -41.2) + 0.05, -41.2],
      0.34,
      0.045,
    );
    for (const [x, z] of site.benches) {
      const y = groundY(x, z);
      boxBeam(face, 'timber', [x - 0.82, y + 0.45, z], [x + 0.82, y + 0.45, z], 0.41, 0.1);
      for (const a of [x - 0.53, x + 0.53]) {
        boxBeam(face, 'granite', [a - 0.055, y + 0.36, z], [a + 0.055, y + 0.36, z], 0.31, 0.36);
      }
    }
  }
  trees(face, detail, site.trees, groundY);
}
