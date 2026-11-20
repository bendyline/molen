import controls from '../plan-controls.json' with { type: 'json' };
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  palette,
  pairs,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  wall: surface('wall', 'stone_ashlar'),
  fineStone: surface('trim', 'stone_limestone'),
  accent: surface('trim', 'brick_longformat'),
  foliage: surface('trim', 'stucco', 0.98),
  tile: surface('roof', 'tile_ceramic', 0.79),
  lead: surface('roof', 'metal_standing_seam', 0.77, 0.12),
  wood: surface('door', 'wood_plain'),
  slate: surface('window', 'window_punched', 0.66),
};
const C = palette({
  wall: 'c6aa83',
  shadow: 'a78d70',
  trim: 'dbc6a0',
  cream: 'd6c39d',
  rust: 'a36b52',
  tile: 'ac7963',
  tileLight: 'ba886a',
  red: '9b6c56',
  lead: '747a74',
  plaster: 'cabb9c',
  paving: 'ad9f82',
  wood: '645748',
  dark: '4d4b40',
  dirt: '87826c',
  orangeTree: '566245',
  cypress: '4b543d',
});
const map = controls.dimensions;
const part = (id) => map.parts.find((p) => p.id === id);
const hallIds = [1249448500, 1249448501, 1249448502, 1249448503];
const roofParts = map.parts.filter((p) => p.tags['roof:shape'] === 'gabled' && p.id !== 1323446835);
const majorTowers = new Set([282228343, 568522398, 568522399, 435905173, 1323599878]);
const arcades = {
  north: [-63.05, -103.85, 49.3, -103.8],
  west: [-62.5, -104.2, -62.46, -52.8],
  east: [49.58, -53.3, 49.71, -105.1],
  south: [49.58, -51.66, -62.4, -52.55],
};
const outer = {
  north: [-67.6, -113.95, 56.3, -113.15],
  west: [-69.78, -111.1, -69.8, 62.15],
  east: [57.45, 62.2, 57.45, -110.7],
  south: [-69.9, 63.84, 56.92, 63.32],
};

function bounds(outline) {
  return [
    Math.min(...outline.map(([x]) => x)),
    Math.min(...outline.map(([, z]) => z)),
    Math.max(...outline.map(([x]) => x)),
    Math.max(...outline.map(([, z]) => z)),
  ];
}

function gable(out, x0, z0, x1, z1, eave, ridge, axis, lod, slot = 'tile') {
  const centerX = (x0 + x1) / 2;
  const centerZ = (z0 + z1) / 2;
  const p = [
    [x0, eave, z0],
    [x1, eave, z0],
    [x1, eave, z1],
    [x0, eave, z1],
  ];
  const alongZ = axis === 'z';
  const [a, b, c, d] = alongZ ? [p[0], p[3], p[2], p[1]] : p;
  const e = alongZ ? [centerX, ridge, z0] : [x0, ridge, centerZ];
  const f = alongZ ? [centerX, ridge, z1] : [x1, ridge, centerZ];
  face(out, slot, [a, b, f, e], up, slot === 'tile' ? C.tile : C.lead);
  face(out, slot, [d, c, f, e], up, slot === 'tile' ? C.tileLight : C.lead);
  face(out, 'wall', [a, d, e], alongZ ? [0, 0, -1] : [-1, 0, 0], C.wall);
  face(out, 'wall', [b, c, f], alongZ ? [0, 0, 1] : [1, 0, 0], C.wall);
  if (lod >= 2) beam(out, slot, e, f, 0.13, 0.085, slot === 'tile' ? C.red : C.lead);
}

function mosqueRoofs(out, grade, lod) {
  for (const id of hallIds) {
    const outline = part(id).points;
    const corners = bounds(outline);
    if (lod === 0) {
      const [a, b, c, d] = corners;
      shell(out, rect(a + 0.34, b, c - 0.34, d), (p) => grade(p) - 0.42, 9.35, {
        wall: 'wall',
        color: C.wall,
        roof: 'tile',
        roofColor: C.tile,
      });
    } else {
      shell(out, outline, (p) => Math.min(grade(p) - 0.37, 8.7), 9.4, {
        wall: 'wall',
        color: C.wall,
        roof: 'tile',
        roofColor: C.tile,
      });
    }
  }
  for (const { id, tags, points } of roofParts) {
    if (lod === 0 && ![1321666780, 1321666785, 1321666789, 1323217812, 1323230457].includes(id))
      continue;
    const [x0, z0, x1, z1] = bounds(points);
    if (x1 - x0 < 1.2 || z1 - z0 < 1.2 || z0 < -53) continue;
    const top = Number(tags.height ?? 13);
    const eave = Math.max(9.42, top - Number(tags['roof:height'] ?? 3.3));
    const axis =
      tags['roof:orientation'] === 'across'
        ? x1 - x0 > z1 - z0
          ? 'z'
          : 'x'
        : x1 - x0 > z1 - z0
          ? 'x'
          : 'z';
    const inset = 0.16;
    const base = rect(x0 + inset, z0 + inset, x1 - inset, z1 - inset);
    shell(out, base, () => 9.28, eave, {
      wall: 'wall',
      color: C.wall,
      roof: 'tile',
      roofColor: C.tile,
    });
    gable(out, x0 + inset, z0 + inset, x1 - inset, z1 - inset, eave, top, axis, lod);
  }
  if (lod === 0) return;
  for (const { id, tags, points } of map.parts) {
    const top = Number(tags.height ?? 0);
    if (
      majorTowers.has(id) ||
      roofParts.some((p) => p.id === id) ||
      points.length > 12 ||
      top < 13 ||
      top > 23
    )
      continue;
    const walls = lod === 1 ? rect(...bounds(points)) : points;
    shell(out, walls, () => 9.3, top - 0.45, {
      wall: 'wall',
      color: C.wall,
      roof: 'tile',
      roofColor: C.tileLight,
    });
    if (lod >= 2 && (id % 3 === 0 || tags['roof:shape'] === 'pyramidal')) {
      const [a, b, c, d] = bounds(points);
      const center = [(a + c) / 2, top + 0.25, (b + d) / 2];
      const xy = rect(a, b, c, d);
      for (const [p, q] of pairs(closed(xy)))
        face(out, 'tile', [[p[0], top - 0.44, p[1]], [q[0], top - 0.44, q[1]], center], up, C.tile);
    }
  }
}

function wallCourse(out, grade, a, b, lod, height, width, shade = C.wall) {
  const f = edge(a, b);
  const p = (u, y, d = 0) => f.p(u, y, d);
  const start = grade(a) - 0.31,
    end = grade(b) - 0.31;
  face(
    out,
    'wall',
    [p(0, start), p(f.length, end), p(f.length, height), p(0, height)],
    f.normal,
    shade,
  );
  face(
    out,
    'wall',
    [
      p(f.length, end, -width),
      p(0, start, -width),
      p(0, height, -width),
      p(f.length, height, -width),
    ],
    f.normal.map((x) => -x),
    C.shadow,
  );
  face(
    out,
    'fineStone',
    [p(0, height), p(f.length, height), p(f.length, height, -width), p(0, height, -width)],
    up,
    C.trim,
  );
  if (lod >= 2) panel(out, 'fineStone', f, 0, f.length, height - 0.51, height - 0.25, 0.04, C.trim);
}

function portal(out, f, center, base, width, top, lod, moorish) {
  const half = width / 2;
  const spring = top - half * 0.88;
  const rtl = base + 0.22;
  const shadow = 0.105;
  panel(
    out,
    'fineStone',
    f,
    center - half - 0.5,
    center + half + 0.5,
    base,
    top + 0.92,
    0.06,
    C.trim,
  );
  arch(
    out,
    f,
    center,
    rtl,
    spring,
    half,
    top - spring,
    shadow,
    lod,
    { inner: C.wood, trim: C.trim, width: 0.38 },
    { inner: 'wood', rim: 'fineStone', trim: 'fineStone', accent: 'accent' },
  );
  if (lod <= 1) return;
  if (moorish) {
    const pieces = lod === 2 ? 9 : 15;
    for (let i = 0; i < pieces; i++) {
      const angles = [(i * Math.PI) / pieces, ((i + 1) * Math.PI) / pieces];
      const pt = (a, w) =>
        f.p(center + (half + w) * Math.cos(a), spring + (top - spring + w) * Math.sin(a), 0.198);
      face(
        out,
        i % 2 ? 'accent' : 'fineStone',
        [pt(angles[0], 0.055), pt(angles[1], 0.055), pt(angles[1], 0.37), pt(angles[0], 0.37)],
        f.normal,
        i % 2 ? C.rust : C.cream,
      );
    }
  }
  for (const d of [-half - 0.41, half + 0.41]) {
    panel(
      out,
      'wall',
      f,
      center + d - 0.12,
      center + d + 0.12,
      base + 0.1,
      top + 0.67,
      0.14,
      C.wall,
    );
    panel(
      out,
      'fineStone',
      f,
      center + d - 0.19,
      center + d + 0.19,
      top + 0.48,
      top + 0.76,
      0.21,
      C.trim,
    );
  }
  panel(
    out,
    'fineStone',
    f,
    center - half - 0.63,
    center + half + 0.63,
    top + 0.73,
    top + 1.0,
    0.17,
    C.cream,
  );
  if (lod === 3 && moorish) {
    for (const ux of [-0.17, 0.17])
      panel(
        out,
        'fineStone',
        f,
        center + ux - 0.03,
        center + ux + 0.03,
        base + 0.27,
        spring - 0.25,
        0.14,
        C.shadow,
      );
  }
}

function portalFaces(out, grade, lod) {
  if (lod === 0) return;
  for (const {
    name,
    point: [x, z],
  } of map.doors) {
    if (name.endsWith('las Palmas') || name.endsWith('Perdón')) continue;
    const side = z < -110 ? 'north' : x < -65 ? 'west' : 'east';
    const major = /San Esteban|Santa Catalina|Deanes|Baptisterio|Espíritu|San Miguel/.test(name);
    if (lod === 1 && !major) continue;
    const width = major ? 3.05 : 2.14;
    const n = side === 'north' ? [0, 0, -1] : side === 'west' ? [-1, 0, 0] : [1, 0, 0];
    const f = {
      normal: n,
      p: (u, y, d = 0) =>
        side === 'north' ? [x + u, y, z - d - 0.18] : [x + n[0] * (d + 0.63), y, z + u],
    };
    const base = grade([x, z]) + 0.03;
    portal(out, f, 0, base, width, base + (major ? 5.85 : 4.41), lod, side !== 'north');
  }
}

function buttress(out, grade, lod) {
  if (lod === 0) return;
  const mapped = map.parts.filter(
    ({ id, tags, points }) =>
      ((id >= 1321666736 && id <= 1321666764) || (id >= 1379394203 && id <= 1379394205)) &&
      points.length < 9 &&
      Number(tags.height ?? 9.7) < 11.5,
  );
  for (const { id, points } of mapped) {
    const h = id % 5 === 0 ? 10.2 : 9.04;
    const polygon = lod === 1 ? rect(...bounds(points)) : points;
    shell(out, polygon, (p) => Math.min(grade(p) - 0.37, h - 0.9), h, {
      wall: 'wall',
      color: C.wall,
      roof: 'fineStone',
      roofColor: C.trim,
    });
  }
}

function arcade(out, grade, lod, [x0, z0, x1, z1], outward, n) {
  const a = [x0, z0],
    b = [x1, z1];
  const f = edge(a, b, outward);
  const l = f.length;
  const bays = Math.max(3, Math.round(l / n));
  const pitch = l / bays;
  const eave = 8.47;
  const inner = -3.2;
  face(
    out,
    'tile',
    [f.p(0, eave), f.p(l, eave), f.p(l, eave + 0.88, inner), f.p(0, eave + 0.88, inner)],
    up,
    C.tile,
  );
  panel(out, 'fineStone', f, 0, l, 7.82, eave + 0.12, 0.06, C.trim);
  for (let i = 0; i <= bays; i++) {
    const u = i * pitch;
    const [x, , z] = f.p(u, 0);
    const base = grade([x, z]) - 0.11;
    const width = lod === 0 ? 0.38 : 0.39;
    block(out, 'wall', x - width / 2, base, z - width / 2, width, 6.35 - base, width, C.wall);
    if (lod >= 2) {
      block(out, 'fineStone', x - 0.31, base, z - 0.31, 0.62, 0.41, 0.62, C.trim);
      block(out, 'fineStone', x - 0.36, 5.74, z - 0.36, 0.72, 0.59, 0.72, C.trim);
    }
    if (i === bays || lod === 0) continue;
    const radius = Math.max(0.58, pitch / 2 - 0.23);
    const center = u + pitch / 2,
      spring = 5.86,
      peak = 7.88;
    const seg = lod === 1 ? 3 : lod === 2 ? 8 : 12;
    for (let j = 0; j < seg; j++) {
      const t0 = (Math.PI * j) / seg,
        t1 = (Math.PI * (j + 1)) / seg;
      const dx0 = radius * Math.cos(t0),
        dx1 = radius * Math.cos(t1);
      const h0 = spring + (peak - spring) * Math.sin(t0),
        h1 = spring + (peak - spring) * Math.sin(t1);
      face(
        out,
        'wall',
        [
          f.p(center + dx0, h0, 0.059),
          f.p(center + dx1, h1, 0.059),
          f.p(center + dx1, eave + 0.06, 0.059),
          f.p(center + dx0, eave + 0.06, 0.059),
        ],
        f.normal,
        j % 3 === 0 ? C.cream : C.wall,
      );
    }
  }
}

function courtPlan(out, grade, lod) {
  const wallTop = 8.92;
  for (const [key, positions] of Object.entries(outer)) {
    if (key === 'south') continue;
    const [a, b, c, d] =
      key === 'north' ? positions : [...positions.slice(2), ...positions.slice(0, 2)];
    const steps = lod === 0 ? 2 : key === 'north' ? 12 : 17;
    for (let i = 0; i < steps; i++) {
      const u = i / steps,
        v = (i + 1) / steps;
      wallCourse(
        out,
        grade,
        [a + (c - a) * u, b + (d - b) * u],
        [a + (c - a) * v, b + (d - b) * v],
        lod,
        wallTop,
        1.65,
      );
    }
  }
  for (const [key, positions] of Object.entries(arcades))
    arcade(
      out,
      grade,
      lod,
      positions,
      key === 'north' || key === 'south' ? -1 : 1,
      lod === 0 ? 24 : lod === 1 ? 8.2 : 5.3,
    );
  const court = [-62, -105, 49.4, -52.55];
  const cells = lod >= 2 ? [14, 6] : lod === 1 ? [6, 3] : [4, 2];
  const dx = (court[2] - court[0]) / cells[0],
    dz = (court[3] - court[1]) / cells[1];
  for (let x = 0; x < cells[0]; x++)
    for (let z = 0; z < cells[1]; z++) {
      const polygon = rect(
        court[0] + x * dx + 0.04,
        court[1] + z * dz + 0.04,
        court[0] + (x + 1) * dx - 0.04,
        court[1] + (z + 1) * dz - 0.04,
      );
      const pts = polygon.map(([a, b]) => [a, grade([a, b]) + 0.28, b]);
      const shade = (x + z) % 4 === 0 ? C.cream : C.paving;
      face(out, 'wall', [pts[0], pts[1], pts[2]], up, shade);
      face(out, 'wall', [pts[0], pts[2], pts[3]], up, shade);
    }
}

function towerStage(out, x, z, bottom, top, width, lod, color = C.wall) {
  block(out, 'wall', x - width / 2, bottom, z - width / 2, width, top - bottom, width, color);
  const collar = width + 0.72;
  block(out, 'fineStone', x - collar / 2, top - 0.52, z - collar / 2, collar, 0.57, collar, C.trim);
  if (lod >= 2)
    block(
      out,
      'fineStone',
      x - (collar + 0.25) / 2,
      top - 0.88,
      z - (collar + 0.25) / 2,
      collar + 0.25,
      0.12,
      collar + 0.25,
      C.shadow,
    );
}

function belfry(out, grade, lod, height) {
  const nativeTower = part(282228343).points;
  const [a, b, c, d] = bounds(nativeTower);
  const x = (a + c) / 2,
    z = (b + d) / 2;
  const base = Math.min(...nativeTower.map(grade)) - 0.52;
  towerStage(out, x, z, base, 20.4, Math.min(c - a, d - b), lod);
  towerStage(out, x, z, 20.37, 31.18, 10.8, lod, C.cream);
  const box = rect(x - 4.73, z - 4.73, x + 4.73, z + 4.73);
  const corners = pairs(closed(box));
  const above = 41.86;
  const sill = 33.76;
  block(out, 'wall', x - 4.72, 31.07, z - 4.72, 9.44, sill - 31.07, 9.44, C.wall);
  for (const [u, v] of box)
    block(out, 'wall', u - 0.22, sill, v - 0.22, 0.97, above - sill, 0.97, C.wall);
  for (const [u, v] of corners) {
    const wall = edge(u, v);
    const m = wall.length / 2;
    const [px, , pz] = wall.p(m, 0);
    block(out, 'fineStone', px - 0.34, sill, pz - 0.34, 0.68, above - sill, 0.68, C.cream);
    panel(out, 'wall', wall, 0, wall.length, above - 0.83, above, 0.1, C.wall);
    if (lod < 2) continue;
    for (const k of [m * 0.48, m * 1.52]) {
      const pieces = lod === 2 ? 5 : 9;
      for (let i = 0; i < pieces; i++) {
        const a = (Math.PI * i) / pieces,
          b = (Math.PI * (i + 1)) / pieces;
        const [l, r] = [k + m * 0.43 * Math.cos(b), k + m * 0.43 * Math.cos(a)];
        const spring = above - 2.54;
        face(
          out,
          'fineStone',
          [
            wall.p(r, spring + 1.39 * Math.sin(a), 0.118),
            wall.p(l, spring + 1.39 * Math.sin(b), 0.118),
            wall.p(l, above - 0.79, 0.118),
            wall.p(r, above - 0.79, 0.118),
          ],
          wall.normal,
          C.trim,
        );
      }
      const [bx, , bz] = wall.p(k, 0, -1.25);
      beam(out, 'lead', [bx, 39.02, bz], [bx, 41.94, bz], 0.14, 0.14, C.dark);
      ring(
        out,
        'lead',
        [bx, bz],
        [
          [37.7, 0.68],
          [38.25, 0.42],
          [38.84, 0.34],
          [39.08, 0.12],
        ],
        lod === 2 ? 6 : 10,
        C.dark,
      );
    }
  }
  towerStage(out, x, z, above - 0.06, 43.37, 9.75, lod, C.cream);
  towerStage(out, x, z, 43.31, 47.86, 6.32, lod, C.wall);
  towerStage(out, x, z, 47.8, 51.2, 4.36, lod, C.cream);
  ring(
    out,
    'lead',
    [x, z],
    [
      [51.13, 2.47],
      [52.2, 1.39],
      [52.63, 0.41],
    ],
    lod === 0 ? 8 : 16,
    C.lead,
  );
  block(out, 'fineStone', x - 0.34, 52.51, z - 0.34, 0.68, height - 52.51, 0.68, C.trim);
  if (lod >= 2) {
    const faces = pairs(closed(rect(x - 5.42, z - 5.42, x + 5.42, z + 5.42)));
    for (const [u, v] of faces) {
      const wall = edge(u, v);
      const m = wall.length / 2;
      for (const k of [m - 1.24, m + 1.24])
        for (const [y, depth] of [
          [24.1, 0.05],
          [28, 0.08],
        ])
          arch(
            out,
            wall,
            k,
            y,
            y + 0.81,
            0.55,
            0.6,
            depth,
            lod,
            { inner: C.dark, trim: C.trim, width: 0.17 },
            { inner: 'slate', trim: 'fineStone' },
          );
    }
  }
  const north = { normal: [0, 0, -1], p: (u, y, d = 0) => [-30.95 + u, y, -114.46 - d] };
  const gateBase = grade([-30.95, -114.45]) - 0.08;
  block(out, 'wall', -34.1, gateBase, -114.08, 6.8, 13.4 - gateBase, 8.24, C.wall);
  portal(out, north, 0, gateBase, 4.45, 10.55, lod, true);
  const palmsBase = grade([-30.85, -54.05]);
  const palms = { normal: [0, 0, -1], p: (u, y, d = 0) => [-30.85 + u, y, -54.05 - d] };
  portal(out, palms, 0, palmsBase, 3.25, 6.78, lod, true);
}

function centralChurch(out, lod) {
  const center = part(363610845).points;
  const cross = part(435905173).points;
  const nave = part(1323446835).points;
  const [x0, z0, x1, z1] = bounds(nave);
  const crosses = bounds(cross);
  const solid = lod === 0 ? rect(-35, -22.9, 22.7, 16.22) : center;
  shell(out, solid, () => 8.72, 22.35, {
    wall: 'wall',
    color: C.wall,
    roof: 'tile',
    roofColor: C.tile,
  });
  shell(out, rect(x0, z0, x1, z1), () => 21.89, 26.6, {
    wall: 'wall',
    color: C.cream,
    roof: 'tile',
    roofColor: C.tile,
  });
  gable(out, x0, z0, x1, z1, 26.63, 34, 'x', lod);
  for (const way of [1323600337, 1323603397]) {
    const b = bounds(part(way).points);
    shell(out, rect(...b), () => 20.15, 25.9, {
      wall: 'wall',
      color: C.cream,
      roof: 'tile',
      roofColor: C.tileLight,
    });
  }
  const [a, b, c, d] = crosses;
  const x = (a + c) / 2,
    z = (b + d) / 2;
  const oct = cross.slice();
  shell(out, oct, () => 21.5, 32.9, {
    wall: 'wall',
    color: C.cream,
    roof: 'fineStone',
    roofColor: C.trim,
  });
  ring(
    out,
    'fineStone',
    [x, z],
    [
      [32.83, 7.18],
      [33.31, 7.18],
      [33.53, 7.03],
    ],
    lod === 0 ? 8 : 16,
    C.trim,
  );
  ring(
    out,
    'lead',
    [x, z],
    [
      [33.32, 6.79],
      [35.29, 6.05],
      [37.29, 4.38],
      [39.5, 1.45],
      [40.03, 0.87],
    ],
    lod < 2 ? 8 : 16,
    C.lead,
  );
  block(out, 'fineStone', x - 0.55, 39.65, z - 0.55, 1.1, 2.1, 1.1, C.trim);
  if (lod >= 2) beam(out, 'fineStone', [x, 41.52, z], [x, 42.9, z], 0.11, 0.11, C.shadow);
  const south = part(435905405).points;
  const sb = bounds(south);
  const cx = (sb[0] + sb[2]) / 2,
    cz = (sb[1] + sb[3]) / 2;
  shell(out, south, () => 9.04, 20.76, {
    wall: 'wall',
    color: C.wall,
    roof: 'tile',
    roofColor: C.tile,
  });
  ring(
    out,
    'tile',
    [cx, cz],
    [
      [20.7, 6.7],
      [22.15, 6.06],
      [25.28, 2.1],
      [26, 0.25],
    ],
    lod === 0 ? 8 : 12,
    C.tile,
  );
  if (lod <= 1) return;
  for (const [u, v] of pairs(closed(rect(x0, z0, x1, z1)))) {
    const wall = edge(u, v);
    const n = Math.max(1, Math.floor(wall.length / 4.8));
    for (let i = 0; i < n; i++) {
      const m = ((i + 0.5) * wall.length) / n;
      arch(
        out,
        wall,
        m,
        23.56,
        24.82,
        0.72,
        0.84,
        0.04,
        lod,
        { inner: C.dark, trim: C.trim, width: 0.21 },
        { inner: 'slate', trim: 'fineStone' },
      );
    }
  }
  for (const [u, v] of pairs(closed(oct))) {
    const wall = edge(u, v, areaSign(oct));
    if (wall.length < 1.5) continue;
    arch(
      out,
      wall,
      wall.length / 2,
      28.02,
      30.39,
      0.68,
      0.94,
      0.04,
      lod,
      { inner: C.dark, trim: C.trim, width: 0.24 },
      { inner: 'slate', trim: 'fineStone' },
    );
  }
}

function courtyardTrees(out, grade, lod) {
  if (lod === 0) return;
  const trees = [-53, -43, -29, -18, -4, 8, 22, 34, 43].flatMap((x, i) =>
    [-94, -79, -63].map((z, j) => [x + (j % 2) * 0.63, z + (i % 2) * 0.4, (i + j) % 7 === 2]),
  );
  for (const [i, [x, z, tall]] of trees.entries()) {
    if (lod === 1 && i % 4) continue;
    const y = grade([x, z]) + 0.23;
    const radius = tall ? 0.92 : 2.15 + (i % 3) * 0.14;
    const height = tall ? 7.52 : 3.93 + (i % 3) * 0.27;
    const n = lod === 1 ? 6 : lod === 2 ? 9 : 12;
    if (lod >= 2)
      block(out, 'wood', x - 0.095, y, z - 0.095, 0.19, tall ? 3.35 : 2.35, 0.19, C.wood);
    ring(
      out,
      'foliage',
      [x, z],
      [
        [y + 1.38, radius * 0.48],
        [y + height * 0.6, radius],
        [y + height * 0.81, radius * 0.73],
        [y + height, 0.12],
      ],
      n,
      tall ? C.cypress : C.orangeTree,
    );
  }
}

function draw(out, lod, { belfryHeight }, grade) {
  mosqueRoofs(out, grade, lod);
  centralChurch(out, lod);
  courtPlan(out, grade, lod);
  buttress(out, grade, lod);
  portalFaces(out, grade, lod);
  belfry(out, grade, lod, belfryHeight);
  courtyardTrees(out, grade, lod);
}

const complex = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [144, 109, -173],
    lookAt: [-5, 14, -29],
    yaw: 1.78,
    sun: [350, 640, -480],
    brief:
      'The Mosque–Cathedral of Córdoba with its Orange Court, high bell tower, pale Renaissance crossing and many low terracotta roofs.',
    views: [
      { name: 'orange-court-and-bell-tower', position: [35, 27, -67], lookAt: [-33, 25, -105] },
      {
        name: 'north-wall-and-forgiveness-gate',
        position: [-17, 12, -149],
        lookAt: [-31, 17, -110],
      },
      {
        name: 'renaissance-crossing-over-mosque-roofs',
        position: [79, 64, 62],
        lookAt: [-6, 17, 2],
      },
      {
        name: 'western-arch-portals-and-buttresses',
        position: [-96, 14, 20],
        lookAt: [-70, 5.5, 23.3],
      },
      { name: 'courtyard-and-complete-roof-plan', position: [8, 232, -66], lookAt: [-3, 3, -27] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = complex;
export const model = {
  ...complex.model,
  category: 'religious',
  recipeDependencies: [...complex.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: map.outline,
    minimumCoverage: 0.9,
    basis:
      'Replace the mapped Mosque–Cathedral and its overlapping procedural parts while the authored complex is present.',
  },
  sourceLicense:
    'Independent interpretation from original geodata and published height facts. Refers to Daderot creator CC0 and public-domain archive materials. No extracted pixels.',
};
