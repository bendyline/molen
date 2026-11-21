import {
  arch,
  areaSign,
  at,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  stone: surface('foundation', 'stone_ashlar'),
  brick: surface('wall', 'brick'),
  roof: surface('roof', 'slate'),
  trim: surface('trim', 'stone_limestone_raw'),
  inset: surface('door', 'wood_vertical'),
};
const C = palette({
  stone: 'a29987',
  weathered: '80786b',
  brick: 'a65f47',
  adjoining: '985c46',
  break: 'b38665',
  eave: '644e43',
  roof: '53504b',
  ridge: '676158',
  trim: 'b98a6b',
  cavity: '514136',
});

function along(a, b) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const x = Math.cos(angle);
  const z = Math.sin(angle);
  return {
    from: ([u, v]) => [x * u - z * v, z * u + x * v],
    into: ([e, s]) => [x * e + z * s, -z * e + x * s],
  };
}
function extents(poly, axes) {
  const coordinates = poly.map(axes.into);
  return [0, 1].map((i) => [
    Math.min(...coordinates.map((p) => p[i])),
    Math.max(...coordinates.map((p) => p[i])),
  ]);
}
function quad(x, z, x2, z2) {
  return [
    [x, z],
    [x2, z],
    [x2, z2],
    [x, z2],
  ];
}
function walls(poly, reversed = false) {
  const sign = areaSign(poly) * (reversed ? -1 : 1);
  return pairs(closed(poly)).map(([a, b]) => ({ a, b, w: edge(a, b, sign) }));
}
function wallSurface(out, { a, b, w }, low, high, slot, color) {
  const first = typeof low === 'function' ? low(a) : low;
  const last = typeof low === 'function' ? low(b) : low;
  face(out, slot, [at(a, first), at(b, last), at(b, high), at(a, high)], w.normal, color);
}
const baseUnder = (grade, top) => (p) => Math.min(grade(p) - 0.22, top - 0.38);
const commonGrade = (p, grade) => Math.max(grade(planarMid(p)), ...p.map(grade));
function strip(out, w, y, slot, color, thickness = 0.22, depth = 0.12) {
  trimBlock(out, slot, w, 0, w.length, y - thickness, y, 0, depth, color);
}
function slit(out, w, x, y, width, height, lod) {
  const half = width * 0.5;
  if (lod === 0) return;
  if (lod === 1) {
    panel(out, 'inset', w, x - half, x + half, y, y + height, 0.022, C.cavity);
    return;
  }
  arch(
    out,
    w,
    x,
    y,
    y + height - half * 0.46,
    half,
    half * 0.46,
    0.043,
    lod - 1,
    { inner: C.cavity, trim: C.trim, width: 0.09 },
    { inner: 'inset', trim: 'brick' },
  );
  if (lod === 3)
    trimBlock(out, 'trim', w, x - half - 0.11, x + half + 0.11, y - 0.086, y, 0.007, 0.12, C.break);
}
function roofRing(out, outer, inner, y, rise) {
  const ridge = outer.map((p, i) => p.map((v, j) => mix(v, inner[i][j], 0.56)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'roof',
      [at(outer[i], y), at(outer[j], y), at(ridge[j], y + rise), at(ridge[i], y + rise)],
      up,
      C.roof,
    );
    face(
      out,
      'roof',
      [at(inner[j], y), at(inner[i], y), at(ridge[i], y + rise), at(ridge[j], y + rise)],
      up,
      C.roof,
    );
  }
}
function facetedRoof(out, outline, y, rise, apex = planarMid(outline)) {
  for (const [a, b] of pairs(closed(outline)))
    face(out, 'roof', [at(a, y), at(b, y), at(apex, y + rise)], up, C.roof);
}
function upright(point) {
  const [x, z] = point;
  return { length: 2, normal: [0, 0, -1], p: (u, v, d) => [x + u, v, z - d] };
}
function finial(out, point, y, lod) {
  const w = upright(point);
  trimBlock(out, 'roof', w, -0.045, 0.045, y, y + 0.83, -0.045, 0.045, C.ridge);
  if (lod >= 2) {
    trimBlock(out, 'roof', w, -0.185, 0.185, y + 0.22, y + 0.39, -0.185, 0.185, C.ridge);
    panel(out, 'roof', w, 0, 0.36, y + 0.64, y + 0.78, 0.046, C.ridge);
  }
}
function keep(out, poly, court, grade, lod) {
  const axes = along(poly[0], poly[2]);
  const [[a, b], [c, d]] = extents([poly[0], poly[2], poly[4], poly[10]], axes);
  const [[e, f], [g, h]] = extents(court, axes);
  const floor = commonGrade(court, grade) + 0.2;
  const stoneTop = floor + 3.65,
    top = floor + 14.1;
  const bounds = quad(a - 0.25, c - 0.24, b + 0.23, d + 0.24).map(axes.from);
  const courtEave = quad(e + 0.15, g + 0.16, f - 0.16, h - 0.16).map(axes.from);
  roofRing(out, bounds, courtEave, top, 4.45);
  for (const wall of [...walls(poly), ...walls(court, true)]) {
    const { w } = wall;
    wallSurface(out, wall, baseUnder(grade, stoneTop), stoneTop, 'stone', C.stone);
    wallSurface(out, wall, stoneTop, top, 'brick', C.brick);
    if (w.length > 1.4 && lod > 0) {
      strip(out, w, top, 'brick', C.eave, 0.32, 0.14);
      strip(out, w, stoneTop + 5.65, 'brick', C.break, 0.13, 0.036);
    }
    if (w.length < 5.2) continue;
    const count = Math.floor(w.length / 4.2);
    for (let i = 1; i <= count; i++) {
      const x = (i * w.length) / (count + 1);
      slit(out, w, x, top - 3.1, 0.74, 1.35, lod);
      if (i % 2 || w.length > 15) slit(out, w, x, stoneTop + 1.45, 0.49, 1.23, lod);
    }
  }
  // The two visible square tower crowns stand on opposite sides of the open court.
  const [sx, sz] = axes.into(planarMid(poly.slice(5, 9)));
  const squareTowers = [
    { rect: quad(a - 0.5, c - 0.23, a + 8.45, c + 8.25), wall: top + 4.0, roof: 4.45 },
    { rect: quad(sx - 4.35, sz - 4.3, sx + 4.5, sz + 4.68), wall: top + 3.65, roof: 4.2 },
  ];
  for (const tower of squareTowers) {
    const p = tower.rect.map(axes.from),
      m = planarMid(p);
    for (const wall of walls(p)) {
      const { w } = wall;
      wallSurface(out, wall, top - 2.5, tower.wall, 'brick', C.brick);
      strip(out, w, tower.wall, 'brick', C.eave, 0.36, 0.14);
      slit(out, w, w.length * 0.51, tower.wall - 2.5, 0.94, 1.53, lod);
    }
    const eaves = p.map((corner) => corner.map((v, i) => mix(m[i], v, 1.105)));
    facetedRoof(out, eaves, tower.wall + 0.055, tower.roof, m);
    finial(out, m, tower.wall + tower.roof + 0.05, lod);
  }
}
function clip(poly, signedDistance) {
  const clipped = [];
  if (!poly.length) return clipped;
  for (const [a, b] of pairs(closed(poly))) {
    const da = signedDistance(a),
      db = signedDistance(b);
    if (da >= 0) clipped.push(a);
    if (da * db < 0) clipped.push(a.map((v, i) => mix(v, b[i], da / (da - db))));
  }
  return clipped;
}
function pitched(out, p, axis, y, rise, hip) {
  const [[a, b], [c, d]] = extents(p, axis);
  const halfWidth = (d - c) * 0.5;
  const slopes = [([, v]) => (v - c) / halfWidth, ([, v]) => (d - v) / halfWidth];
  if (hip)
    slopes.push(
      ([u]) => (u - a) / (halfWidth * 0.83),
      ([u]) => (b - u) / (halfWidth * 0.83),
    );
  const plan = p.map(axis.into);
  for (const slope of slopes) {
    let shape = plan;
    for (const other of slopes) {
      if (other !== slope) shape = clip(shape, (q) => other(q) - slope(q));
    }
    if (shape.length < 3) continue;
    const indices = triangulate(shape.flat());
    for (let i = 0; i < indices.length; i += 3) {
      const pts = indices.slice(i, i + 3).map((index) => shape[index]);
      if (
        Math.abs(
          (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) -
            (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]),
        ) < 0.00001
      )
        continue;
      face(
        out,
        'roof',
        pts.map((q) => at(axis.from(q), y + rise * slope(q))),
        up,
        C.roof,
      );
    }
  }
  return (wall) => {
    const start = axis.into(wall.a),
      end = axis.into(wall.b);
    const cuts = [0, 1];
    for (const [i, slope] of slopes.entries())
      for (const other of slopes.slice(i + 1)) {
        const atStart = slope(start) - other(start),
          atEnd = slope(end) - other(end);
        if (atStart * atEnd < 0) cuts.push(atStart / (atStart - atEnd));
      }
    cuts.sort((l, r) => l - r);
    const height = (t) =>
      y + rise * Math.min(...slopes.map((slope) => slope(start.map((v, j) => mix(v, end[j], t)))));
    const { w } = wall;
    for (const [l, r] of pairs(cuts)) {
      if ((r - l) * w.length < 0.001) continue;
      const low = Math.max(y, height(l)),
        high = Math.max(y, height(r));
      const u = l * w.length,
        v = r * w.length;
      const corners = [w.p(u, y), w.p(v, y)];
      if (high > y + 0.002) corners.push(w.p(v, high));
      if (low > y + 0.002) corners.push(w.p(u, low));
      if (corners.length > 2) face(out, 'brick', corners, w.normal, C.adjoining);
    }
  };
}
function outbuilding(out, p, direction, grade, lod, profile) {
  const y = commonGrade(p, grade);
  const base = y + profile.base,
    eave = base + profile.wall;
  const cut = pitched(out, p, direction, eave, profile.rise, profile.hip);
  for (const wall of walls(p)) {
    const { w } = wall;
    wallSurface(out, wall, baseUnder(grade, base), base, 'stone', C.weathered);
    wallSurface(out, wall, base, eave, 'brick', C.adjoining);
    cut(wall);
    if (lod > 0 && w.length > 0.55) strip(out, w, eave + 0.08, 'brick', C.eave, 0.21, 0.15);
    if (w.length > 4.25) {
      const count = Math.floor(w.length / 3.65);
      for (let i = 1; i <= count; i++) {
        const x = (i * w.length) / (count + 1);
        slit(out, w, x, eave - 2.0, 0.68, 1.11, lod);
        if (profile.wall > 5.35) slit(out, w, x, base + 0.83, 0.78, 1.22, lod);
      }
    }
  }
  if (lod > 0 && profile.chimneys) {
    const [[a, b], [c, d]] = extents(p, direction);
    for (const t of profile.chimneys) {
      const x = mix(a, b, t);
      const z = (c + d) * 0.5;
      const stack = quad(x - 0.37, z - 0.35, x + 0.37, z + 0.35).map(direction.from);
      const roofShoulder = eave + profile.rise * 0.4;
      const capY = eave + profile.rise + 1.1;
      shell(out, stack, () => roofShoulder, capY, { wall: 'brick', color: C.adjoining });
      for (const { w } of walls(stack)) strip(out, w, capY, 'roof', C.eave, 0.17, 0.065);
    }
  }
}
function gate(out, p, grade, lod) {
  const wallsForGate = walls(p);
  const base = commonGrade(p, grade) + 0.1;
  const eave = base + 5.95,
    spring = base + 2.28,
    rise = 0.76;
  const cut = pitched(out, p, along(p[0], p[4]), eave, 1.85, false);
  const tunnel = [];
  const steps = lod > 1 ? 10 : 5;
  for (const [i, wall] of wallsForGate.entries()) {
    const { w } = wall;
    cut(wall);
    if (i !== 0 && i !== 3) {
      wallSurface(out, wall, baseUnder(grade, spring), eave, 'brick', C.adjoining);
      continue;
    }
    const middle = w.length * 0.5,
      radius = 1.22;
    for (const [l, r] of [
      [0, middle - radius],
      [middle + radius, w.length],
    ]) {
      panel(out, 'brick', w, l, r, base - 0.26, eave, 0.002, C.adjoining);
      const u = w.p(l, 0),
        v = w.p(r, 0);
      const inside = edge([u[0], u[2]], [v[0], v[2]], areaSign(p));
      if (lod > 0) strip(out, inside, base + 0.57, 'stone', C.stone, 0.64, 0.12);
    }
    const sample = (j) => {
      const theta = Math.PI * (1 - j / steps);
      return [middle + radius * Math.cos(theta), spring + rise * Math.sin(theta)];
    };
    tunnel.push(Array.from({ length: steps + 1 }, (_, j) => w.p(...sample(j))));
    for (let k = 0; k < steps; k++) {
      const [u, uy] = sample(k),
        [v, vy] = sample(k + 1);
      face(
        out,
        'brick',
        [w.p(u, uy), w.p(v, vy), w.p(v, eave), w.p(u, eave)],
        w.normal,
        C.adjoining,
      );
      if (lod > 0)
        face(
          out,
          'brick',
          [
            w.p(u, uy, 0.055),
            w.p(v, vy, 0.055),
            w.p(v, vy + 0.18, 0.055),
            w.p(u, uy + 0.18, 0.055),
          ],
          w.normal,
          C.trim,
        );
    }
  }
  const [near, other] = tunnel,
    far = other.reverse();
  for (let i = 0; i < steps; i++)
    face(out, 'brick', [near[i], near[i + 1], far[i + 1], far[i]], [0, -1, 0], C.eave);
  for (const i of [0, steps]) {
    const a = near[i],
      b = far[i],
      height = base - 0.33;
    const normal = edge([a[0], a[2]], [b[0], b[2]], i === 0 ? -1 : 1).normal;
    face(out, 'brick', [a, b, [b[0], height, b[2]], [a[0], height, a[2]]], normal, C.eave);
  }
}
function cannonTower(out, p, grade, lod) {
  const reduced = lod === 0 ? p.filter((_, i) => i % 2 === 0) : p;
  const middle = planarMid(p);
  const eave = (q) => q.map((v, i) => mix(middle[i], v, 1.07));
  // The roof must clear the higher bailey grade where it joins the tower.
  const y = Math.max(...p.map((q) => grade(eave(q)))) + 0.27,
    top = y + 0.76;
  for (const [i, wall] of walls(reduced).entries()) {
    const { w } = wall;
    wallSurface(out, wall, baseUnder(grade, y), y, 'stone', C.stone);
    wallSurface(out, wall, y, top, 'brick', C.adjoining);
    if (w.length > 1.65 && i % 3 === 0 && Math.min(grade(wall.a), grade(wall.b)) < y - 2.35) {
      slit(out, w, w.length * 0.5, y - 2.22, 0.76, 0.58, lod);
      if (lod > 1 && i % 2 === 0 && Math.max(grade(wall.a), grade(wall.b)) < y - 3.64)
        slit(out, w, w.length * 0.5, y - 3.52, 0.63, 0.48, lod);
    }
  }
  facetedRoof(out, reduced.map(eave), top + 0.13, 3.45, middle);
}
function retainingWalls(out, lines, grade, lod) {
  for (const line of lines)
    for (const [a, b] of pairs(line)) {
      const w = edge(a, b);
      const upper = Math.max(grade(a), grade(b)) + 4.75;
      const outline = [
        [0, -0.06],
        [w.length, -0.06],
        [w.length, 0.51],
        [0, 0.51],
      ].map(([u, d]) => {
        const [x, , z] = w.p(u, 0, d);
        return [x, z];
      });
      shell(out, outline, baseUnder(grade, upper), upper, { wall: 'stone', color: C.weathered });
      if (lod > 0) strip(out, w, upper, 'stone', C.stone, 0.23, 0.66);
    }
}
function draw(out, lod, { polygons, stoneWalls }, grade) {
  const [keepPlan, court, ring, south, bailey, tower, passage, bakery] = polygons;
  keep(out, keepPlan, court, grade, lod);
  retainingWalls(out, stoneWalls, grade, lod);
  const west = ring.slice(4, 21);
  const north = [...ring.slice(20), ...ring.slice(0, 5)];
  const northernBailey = bailey.slice(9, 22),
    easternBailey = [...bailey.slice(21), ...bailey.slice(0, 10)];
  outbuilding(out, west, along(ring[19], ring[18]), grade, lod, {
    base: 1.13,
    wall: 5.35,
    rise: 2.6,
    hip: true,
  });
  outbuilding(out, north, along(ring[20], ring[22]), grade, lod, {
    base: 0.85,
    wall: 4.7,
    rise: 2.55,
    hip: true,
  });
  outbuilding(out, south, along(south[0], south[1]), grade, lod, {
    base: 1.0,
    wall: 6.85,
    rise: 3.0,
    hip: false,
    chimneys: [0.49],
  });
  outbuilding(out, northernBailey, along(bailey[19], bailey[21]), grade, lod, {
    base: 0.8,
    wall: 4.35,
    rise: 2.45,
    hip: true,
  });
  outbuilding(out, easternBailey, along(bailey[21], bailey[22]), grade, lod, {
    base: 0.8,
    wall: 4.05,
    rise: 2.15,
    hip: true,
  });
  outbuilding(out, bakery, along(bakery[1], bakery[2]), grade, lod, {
    base: 1.05,
    wall: 5.85,
    rise: 3.2,
    hip: false,
    chimneys: [0.25, 0.72],
  });
  gate(out, passage, grade, lod);
  cannonTower(out, tower, grade, lod);
}
const castle = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [121, 65, 117],
    lookAt: [-2, 8, -11],
    yaw: 0.96,
    sun: [370, 580, 510],
    brief:
      'Häme Castle as it stands in Hämeenlinna, with its brick keep and open court, outer bailey, Crown Bakery, and round fieldstone cannon tower.',
    views: [
      {
        name: 'lake-facing-castle-and-native-ground',
        position: [133, 50, 71],
        lookAt: [-1, 8, -9],
      },
      {
        name: 'western-bailey-and-square-towers',
        position: [-113, 35, -50],
        lookAt: [-12, 9, -13],
      },
      {
        name: 'open-courtyard-and-twin-hipped-roofs',
        position: [-37, 56, 45],
        lookAt: [-6, 11, -14],
      },
      { name: 'cannon-tower-fieldstone', position: [83, 10, 24], lookAt: [44, 5, 2] },
      { name: 'south-gate-and-crown-bakery', position: [6, 13, 66], lookAt: [-7, 7, 22] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = castle;
export const model = { ...castle.model, category: 'castle' };
