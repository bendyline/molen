/** The 2006 exterior of Hatoyama Hall in Otowa, Tokyo. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const ground = read('terrain-grid');
const ring = frame.geometry.polygons[0];
const eaves = plan.wallEaves;
const ridge = plan.roofRidgeZ;
const core = ring.filter((_, i) => ![10, 11, 15, 16].includes(i));
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_longformat', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89, metallic: 0 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.86, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    wall: 'c2b28f',
    warm: 'c8b895',
    shaded: 'b2a183',
    gable: 'bba885',
    stone: 'd6c4a4',
    pale: 'e6ddc8',
    joints: 'b29d78',
    frame: 'dfddce',
    darkFrame: '655346',
    dark: '3b4140',
    glass: '5c7070',
    warmGlass: '736b5d',
    roof: '5a5c57',
    ridge: '6c6b60',
    steps: 'bcaf9b',
    base: 'a69b83',
    wood: '5a4438',
    red: '823f3e',
    rail: '565c55',
    patina: '5d5d47',
  }).map(([name, color]) => [name, rgb(color)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];

function grade(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = ground.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    ground.modelDatumElevationMeters
  );
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length,
    normal = [-uz, 0, ux];
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2;
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function oriented(out, slot, p, n, color) {
  const normal = normalFor(...p);
  const points = normal.reduce((v, c, i) => v + c * n[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function fill(out, s, slot, outer, color, depth = 0, holes = []) {
  const vertices = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(vertices.length);
    vertices.push(...hole);
  }
  const mesh = earcut(vertices.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((k) => s.p(...vertices[k], depth)),
      s.normal,
      color,
    );
}

function strip(out, s, slot, x0, y0, x1, y1, d0, d1, color, solid = false) {
  const points = rect(x0, y0, x1, y1);
  oriented(
    out,
    slot,
    points.map((p) => s.p(...p, d1)),
    s.normal,
    color,
  );
  if (!solid) return;
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4];
    face(out, slot, [s.p(...a, d0), s.p(...b, d0), s.p(...b, d1), s.p(...a, d1)], color);
  }
}

function opening(w, n, grow = 0) {
  const r = w.width / 2 + grow;
  if (w.spring === undefined) return rect(w.x - r, w.low - grow, w.x + r, w.high + grow);
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [w.x + Math.cos(a) * r, w.spring + Math.sin(a) * (w.high - w.spring + grow)];
  });
  return [[w.x - r, w.low - grow], [w.x + r, w.low - grow], ...arch];
}

function surround(out, s, path, outer, depth, lod, color) {
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length;
    oriented(
      out,
      'stone',
      [path[i], path[j], outer[j], outer[i]].map((p) => s.p(...p, depth)),
      s.normal,
      color,
    );
    if (lod >= 2) {
      const a = path[i],
        b = path[j];
      face(
        out,
        'stone',
        [s.p(...a, depth), s.p(...b, depth), s.p(...b, depth - 0.22), s.p(...a, depth - 0.22)],
        tint.joints,
      );
    }
  }
}

function glazed(out, s, w, lod) {
  const n = [5, 7, 10, 14][lod],
    path = opening(w, n);
  const outer = opening(w, n, w.large ? 0.19 : 0.125),
    depth = lod >= 2 ? -0.16 : 0.024;
  const frameColor = tint.frame;
  if (lod === 0) fill(out, s, 'stone', outer, tint.pale, 0.018);
  else surround(out, s, path, outer, 0.048, lod, tint.pale);
  fill(out, s, 'detail', path, tint.glass, depth - (lod === 0 ? 0.002 : 0.005));
  if (lod === 0) return;
  const cols = w.cols ?? 2,
    full = w.spring ?? w.high,
    lower = w.low + 0.025;
  for (let i = 1; i < cols; i++) {
    const u = w.x + w.width * (i / cols - 0.5);
    const upper = w.spring === undefined ? full - 0.025 : full;
    strip(out, s, 'detail', u - 0.033, lower, u + 0.033, upper, depth, 0.048, frameColor, lod >= 2);
  }
  const [a, b] = [w.x - w.width / 2 + 0.025, w.x + w.width / 2 - 0.025];
  const rail = w.spring ?? mix(w.low, w.high, 0.55);
  strip(out, s, 'detail', a, rail - 0.028, b, rail + 0.028, depth, 0.045, frameColor, lod >= 2);
  if (w.spring !== undefined && lod >= 2) {
    const top = w.high - w.spring;
    for (const offset of [-1, 0, 1]) {
      const u = w.x + offset * w.width * 0.3;
      const v = w.spring + top * (offset === 0 ? 0.985 : 0.79);
      beam(out, 'detail', s.p(w.x, w.spring, 0.044), s.p(u, v, 0.044), 0.043, 0.037, frameColor);
    }
  }
  if (lod >= 2 && !w.large)
    strip(
      out,
      s,
      'stone',
      a - 0.13,
      w.low - 0.13,
      b + 0.13,
      w.low - 0.015,
      0,
      0.125,
      tint.stone,
      true,
    );
}

function facade(out, s, windows, base, top, lod, color, slot = 'masonry') {
  const half = s.length / 2;
  const holes = lod < 2 ? [] : windows.map((w) => opening(w, lod === 2 ? 10 : 14));
  fill(out, s, slot, rect(-half, base, half, top), color, 0, holes);
  for (const w of windows) glazed(out, s, w, lod);
}

function wallWindows(i, s) {
  if (i === 9 || i === 11)
    return [
      { x: 0, width: 1.14, low: 1.64, spring: 3.37, high: 4.05, large: true },
      { x: 0, width: 1.18, low: 4.96, high: 7.4 },
    ];
  if (i === 10)
    return [-3.97, 0, 3.97].flatMap((x) => [
      {
        x,
        width: 3.05,
        low: plan.sunroomFloor + 0.13,
        spring: 3.39,
        high: 4.39,
        cols: 4,
        large: true,
      },
      { x, width: 3.12, low: 4.92, high: 7.64, cols: 4, large: true },
    ]);
  if (s.length < 2.4) return [];
  const front = [6, 7, 8, 12, 13].includes(i),
    count = Math.max(1, Math.floor(s.length / (front ? 3.55 : 3.6)));
  return Array.from({ length: count }, (_, index) => {
    const x = s.length * ((index + 0.5) / count - 0.5),
      width = Math.min(1.68, s.length / count - 0.71);
    return [
      {
        x,
        width,
        low: 1.51,
        spring: front ? 3.22 : undefined,
        high: front ? 3.88 : 3.56,
        cols: front ? 3 : 2,
      },
      { x, width: width * 0.94, low: 5.01, high: 7.29, cols: 2 },
    ];
  }).flat();
}

function rails(out, s, x0, x1, base, depth, lod) {
  const top = base + 0.64;
  for (const y of [base + 0.08, top])
    beam(out, 'detail', s.p(x0, y, depth), s.p(x1, y, depth), 0.049, 0.052, tint.rail);
  if (lod === 0) return;
  const n = Math.ceil((x1 - x0) / (lod === 1 ? 0.52 : 0.29));
  for (let i = 0; i <= n; i++) {
    const x = mix(x0, x1, i / n);
    beam(out, 'detail', s.p(x, base, depth), s.p(x, top, depth), 0.036, 0.036, tint.rail);
    if (lod === 3 && i < n) {
      const right = mix(x0, x1, (i + 1) / n),
        u = (x + right) / 2;
      const diamond = [
        [u, base + 0.51],
        [right - 0.025, base + 0.35],
        [u, base + 0.19],
        [x + 0.025, base + 0.35],
      ];
      for (let j = 0; j < 4; j++)
        beam(
          out,
          'detail',
          s.p(...diamond[j], depth),
          s.p(...diamond[(j + 1) % 4], depth),
          0.019,
          0.022,
          tint.rail,
        );
    }
  }
}

function walls(out, lod) {
  for (let i = 0; i < ring.length; i++) {
    if (i >= 14 && i <= 16) continue;
    const a = ring[(i + 1) % ring.length],
      b = ring[i],
      s = section(a, b),
      h = s.length / 2;
    const lowA = grade(...a),
      lowB = grade(...b),
      base = Math.min(lowA, lowB) - 0.46;
    const top = i >= 9 && i <= 11 ? plan.sunroomTop : eaves;
    facade(
      out,
      s,
      wallWindows(i, s),
      base,
      top,
      lod,
      i === 10 ? tint.warm : i % 4 === 0 ? tint.shaded : tint.wall,
    );
    fill(
      out,
      s,
      'footing',
      [
        [-h, lowA - 0.42],
        [h, lowB - 0.42],
        [h, lowB + 0.49],
        [-h, lowA + 0.49],
      ],
      tint.base,
      0.039,
    );
    strip(out, s, 'stone', -h, top - 0.21, h, top + 0.018, -0.03, 0.13, tint.stone, lod > 0);
    if (lod > 0) {
      strip(out, s, 'stone', -h, 4.55, h, 4.72, -0.025, 0.079, tint.stone, lod >= 2);
      if (i === 10) rails(out, s, -h + 0.32, h - 0.32, 4.94, 0.37, lod);
    }
  }
  const back = section(ring[17], ring[14]),
    h = back.length / 2;
  const upper = { x: 0, width: 2.14, low: 5.89, high: 7.55, cols: 3 };
  facade(out, back, [upper], plan.porchTop - 0.12, eaves, lod, tint.wall);
  strip(out, back, 'stone', -h, eaves - 0.21, h, eaves, -0.025, 0.13, tint.stone, lod > 0);
  topPolygon(out, 'stone', ring.slice(9, 13), () => plan.sunroomTop + 0.01, tint.stone);
  const sunRear = section(ring[12], ring[9]);
  strip(
    out,
    sunRear,
    'masonry',
    -sunRear.length / 2,
    plan.sunroomTop - 0.015,
    sunRear.length / 2,
    eaves,
    -0.04,
    0,
    tint.wall,
  );
}

function topPolygon(out, slot, p, height, color) {
  const indices = earcut(p.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((k) => [p[k][0], height(p[k][1], p[k][0]), p[k][1]]);
    oriented(out, slot, points, [0, 1, 0], color);
  }
}

function roofHalf(south) {
  const keep = (p) => (south ? p[1] >= ridge : p[1] <= ridge),
    points = [];
  for (let i = 0; i < core.length; i++) {
    const a = core[i],
      b = core[(i + 1) % core.length];
    if (keep(a)) points.push(a);
    if (keep(a) !== keep(b)) points.push([mix(a[0], b[0], (ridge - a[1]) / (b[1] - a[1])), ridge]);
  }
  return points;
}

function roofHeight(z) {
  const run = z > ridge ? 6.72 - ridge : ridge + 9.25;
  return plan.roofRidgeHeight - ((plan.roofRidgeHeight - eaves - 0.08) * Math.abs(z - ridge)) / run;
}

function dormer(out, x, z, w, lod) {
  const half = w / 2,
    y = roofHeight(z),
    h = y + 1.55,
    ridgeEnd = z - 1.92;
  const front = section([x - half, z], [x + half, z]);
  const pane = { x: 0, width: w * 0.48, low: y + 0.08, high: y + 0.78, cols: 2 };
  const outline = [
    [-half, y - 0.22],
    [half, y - 0.22],
    [half, y + 0.88],
    [0, h],
    [-half, y + 0.88],
  ];
  fill(out, front, 'masonry', outline, tint.gable, 0, lod >= 2 ? [opening(pane, 8)] : []);
  glazed(out, front, pane, lod);
  for (const sign of [-1, 1]) {
    const edge = [x + sign * half, y + 0.88, z + 0.12],
      top = [x, h, z + 0.12],
      back = [x, h, ridgeEnd];
    const heel = [x + sign * half, roofHeight(z - 0.95) - 0.012, z - 0.95];
    oriented(out, 'tile', [edge, top, back], [0, 1, 0], tint.roof);
    oriented(out, 'tile', [edge, back, heel], [0, 1, 0], tint.ridge);
    oriented(out, 'masonry', [[edge[0], y - 0.22, z], edge, heel], [sign, 0, 0], tint.shaded);
    if (lod > 0) beam(out, 'stone', edge, top, 0.087, 0.1, tint.stone);
  }
}

function roof(out, lod) {
  for (let i = 0; i < core.length; i++) {
    const a = core[(i + 1) % core.length],
      b = core[i],
      s = section(a, b),
      h = s.length / 2;
    const top = [
      [-h, roofHeight(a[1])],
      [h, roofHeight(b[1])],
    ];
    if ((a[1] - ridge) * (b[1] - ridge) < 0)
      top.splice(1, 0, [mix(-h, h, (ridge - a[1]) / (b[1] - a[1])), roofHeight(ridge)]);
    fill(
      out,
      s,
      'masonry',
      [[-h, eaves - 0.025], [h, eaves - 0.025], ...top.toReversed()],
      tint.gable,
    );
  }
  const [north, south] = [roofHalf(false), roofHalf(true)];
  topPolygon(out, 'tile', north, roofHeight, tint.roof);
  topPolygon(out, 'tile', south, roofHeight, tint.roof);
  const ends = north
    .filter((p) => p[1] === ridge)
    .map((p) => p[0])
    .sort((a, b) => a - b);
  beam(
    out,
    'tile',
    [ends[0], roofHeight(ridge) + 0.065, ridge],
    [ends.at(-1), roofHeight(ridge) + 0.065, ridge],
    0.16,
    0.14,
    tint.ridge,
  );
  for (const x of [-5.72, 0.92, 7.91]) dormer(out, x, 4.93, x === 0.92 ? 2.25 : 1.92, lod);
  if (lod >= 2) {
    for (const x of [-6.5, 9.08])
      box(out, 'masonry', [x - 0.27, 12.37, -1.65], [x + 0.26, 13.36, -1.12], tint.shaded);
    for (const x of [-6.5, 9.08])
      box(out, 'stone', [x - 0.36, 13.29, -1.72], [x + 0.35, 13.46, -1.04], tint.stone);
  }
}

const notch = (path) => [path[0], ...path.slice(2).reverse(), path[1]];

function archPortal(out, s, base, top, w, lod) {
  const h = s.length / 2,
    n = [5, 7, 12, 16][lod],
    path = opening(w, n);
  const outer = opening(w, n, 0.28);
  const faceShape = [[-h, base], ...notch(path), [h, base], [h, top], [-h, top]];
  fill(out, s, 'stone', faceShape, tint.stone);
  for (let i = 1; i < path.length; i++) {
    const j = (i + 1) % path.length;
    const a = path[i],
      b = path[j];
    oriented(
      out,
      'stone',
      [a, b, outer[j], outer[i]].map((p) => s.p(...p, 0.063)),
      s.normal,
      i % 4 === 0 ? tint.pale : tint.stone,
    );
    if (lod >= 1)
      face(
        out,
        'stone',
        [s.p(...a, 0.061), s.p(...b, 0.061), s.p(...b, -0.29), s.p(...a, -0.29)],
        tint.joints,
      );
    if (lod >= 2 && i > 1) {
      const p = path[i],
        q = outer[i];
      beam(out, 'stone', s.p(...p, 0.069), s.p(...q, 0.069), 0.021, 0.019, tint.joints);
    }
  }
  const x = w.width / 2 + 0.27;
  for (const sign of [-1, 1]) {
    const edge = sign > 0 ? [x, Math.min(h, x + 0.45)] : [Math.max(-h, -x - 0.45), -x];
    strip(
      out,
      s,
      'footing',
      edge[0],
      base - 0.05,
      edge[1],
      base + 0.49,
      -0.03,
      0.125,
      tint.steps,
      lod > 1,
    );
    if (lod >= 2)
      for (let y = base + 0.58; y < top - 0.1; y += 0.52)
        strip(out, s, 'stone', edge[0], y, edge[1], y + 0.016, 0.059, 0.068, tint.joints);
  }
  strip(out, s, 'stone', -h, top - 0.19, h, top + 0.08, -0.04, 0.17, tint.pale, lod >= 1);
}

function westPorch(out, lod) {
  const base = 0.32,
    top = plan.porchTop;
  const endpoints = [14, 15, 16].map((i) => section(ring[i + 1], ring[i]));
  for (const [i, s] of endpoints.entries()) {
    const w = {
      x: 0,
      width: i === 1 ? 3.17 : Math.min(s.length - 0.93, 3.79),
      low: base,
      spring: 2.94,
      high: i === 1 ? 4.52 : 4.18,
    };
    archPortal(out, s, base, top, w, lod);
  }
  const deck = ring.slice(14, 18);
  topPolygon(out, 'stone', deck, () => top + 0.025, tint.stone);
  topPolygon(out, 'footing', deck, () => base + 0.003, tint.steps);
  const z = (ring[15][1] + ring[16][1]) / 2;
  const frontX = Math.min(ring[15][0], ring[16][0]);
  box(
    out,
    'footing',
    [frontX - 0.65, grade(frontX - 0.53, z) - 0.16, z - 1.89],
    [frontX + 0.08, 0.18, z + 1.89],
    tint.steps,
  );
  box(out, 'stone', [frontX - 0.38, 0.1, z - 1.82], [frontX + 0.075, base, z + 1.82], tint.stone);
  const interior = section(ring[17], ring[14]);
  const door = { x: 0, width: 2.31, low: 0.36, spring: 3.16, high: 4.4 };
  const shape = opening(door, [6, 8, 10, 14][lod]);
  const h = interior.length / 2;
  fill(
    out,
    interior,
    'masonry',
    [[-h, base], ...notch(shape), [h, base], [h, top - 0.08], [-h, top - 0.08]],
    tint.shaded,
  );
  surround(out, interior, shape, opening(door, [6, 8, 10, 14][lod], 0.12), 0.055, lod, tint.stone);
  const fanlight = shape.slice(2);
  fill(out, interior, 'detail', fanlight, tint.warmGlass, -0.052);
  strip(out, interior, 'timber', -1.17, 3.1, 1.17, 3.19, -0.1, 0.021, tint.wood, lod >= 2);
  const back = interior.p(0, 0, -3.83)[0];
  const stairZ = interior.p(0, 0)[2],
    width = 1.04;
  const start = interior.p(0, 0, 0.1)[0],
    count = lod === 0 ? 4 : lod === 1 ? 7 : 13;
  const run = (back - start) / count,
    rise = 2.21 / count;
  for (let i = 0; i < count; i++) {
    const x = start + i * run,
      y = base + (i + 1) * rise;
    box(
      out,
      'footing',
      [x, base - 0.035, stairZ - width],
      [x + run + 0.005, y, stairZ + width],
      tint.steps,
    );
    box(
      out,
      'detail',
      [x - 0.002, y - 0.04, stairZ - 0.48],
      [x + run, y + 0.013, stairZ + 0.48],
      tint.red,
    );
  }
  box(
    out,
    'timber',
    [back, base, stairZ - width - 0.08],
    [back + 0.14, 4.92, stairZ + width + 0.08],
    tint.wood,
  );
  if (lod >= 1) {
    for (const sign of [-1, 1]) {
      const r = stairZ + sign * 0.89;
      beam(
        out,
        'stone',
        [start, base + 0.55, r],
        [back, base + 2.21 + 0.56, r],
        0.14,
        0.16,
        tint.steps,
      );
      for (const f of [0, 0.5, 1]) {
        const x = mix(start, back, f),
          y = base + 2.21 * f;
        box(out, 'stone', [x - 0.079, y, r - 0.082], [x + 0.081, y + 0.64, r + 0.084], tint.steps);
      }
    }
    for (const s of endpoints)
      rails(out, s, -s.length / 2 + 0.11, s.length / 2 - 0.11, top + 0.05, -0.015, lod);
  }
  if (lod >= 2) {
    for (const u of [-0.78, 0, 0.78]) {
      const y = u === 0 ? 4.36 : 4.02;
      beam(
        out,
        'timber',
        interior.p(0, 3.17, 0.016),
        interior.p(u, y, 0.016),
        0.042,
        0.042,
        tint.wood,
      );
    }
    const body = [frontX + 0.48, top + 0.51, z];
    sphere(out, 'detail', body, [0.16, 0.12, 0.31], tint.patina, 7, 4);
    const head = [body[0], body[1] + 0.22, z + 0.29];
    beam(out, 'detail', body, head, 0.115, 0.12, tint.patina);
    sphere(out, 'detail', head, [0.077, 0.074, 0.11], tint.patina, 7, 4);
    for (const side of [-1, 1]) {
      const x = body[0] + side * 0.096;
      for (const d of [-0.21, 0.19])
        beam(
          out,
          'detail',
          [x, body[1] - 0.025, z + d],
          [x, top + 0.07, z + d + 0.035],
          0.046,
          0.048,
          tint.patina,
        );
      beam(
        out,
        'detail',
        head,
        [head[0] + side * 0.11, head[1] + 0.18, head[2] - 0.06],
        0.028,
        0.028,
        tint.patina,
      );
    }
  }
}

function build(out, lod) {
  walls(out, lod);
  roof(out, lod);
  westPorch(out, lod);
}
export const otowaSkyline = (out) => build(out, 0);
export const otowaDistrict = (out) => build(out, 1);
export const otowaStreet = (out) => build(out, 2);
export const otowaCloseup = (out) => build(out, 3);
const recipe = 'hatoyama-hall-model.mjs';
const camera = [-36, 19, 42],
  lookAt = [-1.1, 5.5, 0.6];
export const otowaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: otowaCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Hatoyama Hall in Otowa with pale brick, a dormered roof, glazed garden rooms and a west arched carriage porch.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-29, 41, 49],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    outlines: [ring],
    minimumCoverage: 0.92,
    basis: 'Mapped Otowa mansion and its projecting west porch.',
  },
  embeddedCanonicalGraphs: [
    'brick_longformat',
    'stone_limestone',
    'stone_limestone_weathered',
    'tile_flat',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'garden-sunroom-and-dormers', position: [-2, 7.4, 37], lookAt: [0, 5.5, 3] },
    { name: 'west-arch-and-stair', position: [-26, 3.1, -1.25], lookAt: [-10, 2.68, -0.66] },
    { name: 'roof-and-north-return', position: [27, 21, -29], lookAt: [1, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'otowaSkyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'otowaDistrict', 0.44],
        ['street', 'otowaStreet', 0.15],
        ['closeup', 'otowaCloseup', 0.056],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprint is ODbL. The two exact Qualla originals were released to the public domain by the photographer.',
};
