import { readFileSync } from 'node:fs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedSolid,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const plans = new Map(frame.parts.map((p) => [p.id, clockwise(p.outline)]));
const part = (id) => plans.get(52776561689000 + id);
const spirePart = (id) => plans.get(35184636679000 + id);
const outer = part(303),
  connector = part(305),
  shaft = part(323),
  lantern = spirePart(247);

export const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone' },
  ashlar: { slot: 'foundation', graph: 'stone_granite' },
  roof: { slot: 'roof', graph: 'metal_painted' },
  alloy: { slot: 'trim', graph: 'metal_copper' },
  pane: { slot: 'window', localRef: 'palette:#ffffff', name: 'Inset blue-gray glass' },
  oak: { slot: 'door', graph: 'wood_plain' },
};
const cream = [0.85, 0.77, 0.63],
  ivory = [0.96, 0.88, 0.73],
  brown = [0.61, 0.48, 0.4];
const blue = [0.081, 0.134, 0.167],
  gray = [0.43, 0.45, 0.41],
  green = [0.23, 0.49, 0.32];
const gold = [0.67, 0.51, 0.24],
  oak = [0.66, 0.43, 0.25];

function midpoint(plan) {
  return plan.reduce(([x, z], p) => [x + p[0] / plan.length, z + p[1] / plan.length], [0, 0]);
}
function resized(plan, factor) {
  const center = midpoint(plan);
  return plan.map((p) => p.map((v, i) => center[i] + (v - center[i]) * factor));
}
function enclosingRectangle(plan) {
  const x = plan.map((p) => p[0]),
    z = plan.map((p) => p[1]);
  const left = Math.min(...x),
    right = Math.max(...x),
    rear = Math.min(...z),
    front = Math.max(...z);
  return [
    [left, rear],
    [left, front],
    [right, front],
    [right, rear],
  ];
}
function edges(plan) {
  return plan.map((a, i) => [a, plan[(i + 1) % plan.length]]);
}
function wall(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const point = (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d];
  const panel = (slot, left, low, right, high, d, color) =>
    face(
      out,
      slot,
      [point(left, low, d), point(right, low, d), point(right, high, d), point(left, high, d)],
      color,
    );
  const relief = (slot, left, low, right, high, d, color, back = 0) => {
    panel(slot, left, low, right, high, d, color);
    face(
      out,
      slot,
      [point(left, low, back), point(left, low, d), point(left, high, d), point(left, high, back)],
      color,
    );
    face(
      out,
      slot,
      [
        point(right, low, d),
        point(right, low, back),
        point(right, high, back),
        point(right, high, d),
      ],
      color,
    );
    face(
      out,
      slot,
      [
        point(left, high, d),
        point(right, high, d),
        point(right, high, back),
        point(left, high, back),
      ],
      color,
    );
  };
  return { point, panel, relief, length };
}

function cornice(out, plan, y, level, height = 0.68) {
  mappedSolid(out, 'limestone', resized(plan, 1.016), y, y + height, ivory);
  if (level >= 2)
    mappedSolid(
      out,
      'limestone',
      resized(plan, 1.027),
      y + height * 0.61,
      y + height * 1.17,
      ivory,
    );
}

function fenestration(out, plan, bottom, top, floors, pitch, level, main = false) {
  const rise = (top - bottom) / floors;
  for (const [index, [a, b]] of edges(plan).entries()) {
    const f = wall(out, a, b);
    if (f.length < (level === 3 ? 2.3 : 3.45)) continue;
    const bays = Math.max(1, Math.round(f.length / pitch));
    const span = f.length / bays;
    for (let i = 0; i < bays; i++) {
      const x = (i + 0.5) * span,
        half = Math.min(0.7, span * 0.225);
      if (level === 0) {
        f.panel('roof', x - half, bottom, x + half, top, 0.21, [0.56, 0.51, 0.43]);
        continue;
      }
      if (main || level === 3) {
        f.panel(
          'roof',
          x - half - 0.11,
          bottom - 0.02,
          x + half + 0.11,
          top,
          0.075,
          [0.59, 0.49, 0.35],
        );
        const margin = Math.min(span * 0.145, 0.53);
        const pilaster = level === 3 ? f.relief : f.panel;
        pilaster(
          'limestone',
          i * span + 0.08,
          bottom - 0.32,
          i * span + margin,
          top + 0.48,
          0.31,
          ivory,
        );
      }
      for (let row = 0; row < floors; row++) {
        const y = bottom + (row + 0.18) * rise,
          high = y + 0.55 * rise;
        const variation = 0.012 * ((7 * i + 3 * row + index) % 6);
        f.panel(
          'pane',
          x - half,
          y,
          x + half,
          high,
          0.164,
          blue.map((v) => v + variation),
        );
        if (level >= 2 && (main || level === 3)) {
          f.panel('limestone', x - half - 0.16, y - 0.11, x + half + 0.16, y, 0.224, ivory);
          f.panel('oak', x - 0.035, y, x + 0.035, high, 0.238, oak);
        }
      }
    }
  }
}

function ornament(out, x, z, y, h, level, capped = true) {
  const polygon = level === 3 ? 8 : 4;
  if (level < 2) {
    loft(
      out,
      capped ? 'roof' : 'limestone',
      [
        radialRing(y, 0.48, 0.48, polygon, [x, z], Math.PI / 4),
        radialRing(y + h, 0.039, 0.039, polygon, [x, z], Math.PI / 4),
      ],
      capped ? green : ivory,
    );
    return;
  }
  const stoneRings = [
    [0, 0.53],
    [h * 0.32, 0.49],
    [h * 0.59, 0.34],
  ].map(([dy, r]) => radialRing(y + dy, r, r, polygon, [x, z], Math.PI / 4));
  loft(out, 'limestone', stoneRings, ivory);
  const tip = [
    [h * 0.53, 0.37],
    [h * 0.76, 0.26],
    [h, 0.034],
  ].map(([dy, r]) => radialRing(y + dy, r, r, polygon, [x, z], Math.PI / 4));
  loft(out, capped ? 'roof' : 'limestone', tip, capped ? green : cream);
}

/** Construct the masonry above an arch and its short reveal at the chosen depth. */
function arch(
  out,
  f,
  x,
  bottom,
  spring,
  half,
  rise,
  top,
  depth,
  level,
  { door = false, jamb = 0.3 } = {},
) {
  const n = level === 3 ? 10 : 6;
  const path = Array.from({ length: n + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / n);
    return [x + half * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
  const d = depth + 0.42;
  for (let i = 1; i < path.length; i++) {
    const [a, y] = path[i - 1],
      [b, h] = path[i];
    face(
      out,
      'limestone',
      [f.point(a, y, d), f.point(b, h, d), f.point(b, top, d), f.point(a, top, d)],
      cream,
    );
    face(
      out,
      'limestone',
      [f.point(b, h, d), f.point(a, y, d), f.point(a, y, depth), f.point(b, h, depth)],
      ivory,
    );
    if (door) {
      const p = [f.point(a, spring, depth), f.point(b, spring, depth)];
      if (i < n) p.push(f.point(b, h, depth));
      if (i > 1) p.push(f.point(a, y, depth));
      if (p.length === 3) tri(out, 'oak', p, oak);
      else face(out, 'oak', p, oak);
    }
  }
  if (level === 3 && door) {
    beamPath(
      out,
      'limestone',
      path.map(([u, y]) => f.point(u, y, d + 0.08)),
      0.17,
      0.17,
      ivory,
    );
  }
  f.relief('limestone', x - half - jamb, bottom, x - half, top, d, ivory, depth);
  f.relief('limestone', x + half, bottom, x + half + jamb, top, d, ivory, depth);
  if (door) {
    f.panel('oak', x - half, bottom, x + half, spring, depth, oak);
    f.panel(
      'pane',
      x - half * 0.73,
      bottom + 0.66,
      x + half * 0.73,
      spring - 0.31,
      depth + 0.12,
      blue,
    );
    for (const u of [x - 0.37, x, x + 0.37])
      f.panel('oak', u - 0.04, bottom + 0.53, u + 0.04, spring - 0.27, depth + 0.19, oak);
    const lintel = spring - 0.95;
    f.panel('oak', x - half * 0.82, lintel, x + half * 0.82, lintel + 0.12, depth + 0.19, oak);
  }
}

function bayCrown(out, plan, y, top, level) {
  if (level <= 1) {
    mappedSolid(out, 'limestone', plan, y, top, cream);
  } else {
    mappedSolid(out, 'limestone', plan, y - 0.04, y + 0.49, ivory);
    mappedSolid(out, 'limestone', plan, top - 0.45, top, ivory);
  }
  for (const [a, b] of edges(plan)) {
    const f = wall(out, a, b);
    if (f.length < 2.9) continue;
    const n = Math.max(1, Math.round(f.length / 3.25));
    for (let i = 0; i < n; i++) {
      const span = f.length / n,
        u = (i + 0.5) * span;
      if (level <= 1) {
        if (level === 1)
          f.panel('pane', u - span * 0.25, y + 0.48, u + span * 0.25, top - 1.39, 0.18, blue);
        continue;
      }
      arch(out, f, u, y + 0.37, top - 2.53, span * 0.29, 1.01, top - 0.2, -0.49, level, {
        jamb: span * 0.21,
      });
      if (level === 3)
        f.panel('limestone', u - span * 0.26, y + 0.41, u + span * 0.26, y + 1.37, 0.006, ivory);
    }
  }
  cornice(out, plan, top - 0.1, level, 0.46);
  if (level >= 1) {
    for (const [x, z] of resized(plan, 0.89)) ornament(out, x, z, top + 0.26, 1.46, level);
  }
}

function portal(out, plan, height, ground, front, level) {
  const order = front ? 1 : -1;
  const [a, b] = edges(plan).reduce((best, e) =>
    order * (e[0][1] + e[1][1] - best[0][1] - best[1][1]) > 0 ? e : best,
  );
  const f = wall(out, a, b),
    mid = f.length / 2;
  if (level <= 1) {
    for (const i of [-1, 0, 1])
      f.panel(
        'oak',
        mid + i * 4.2 - 1.13,
        ground + 0.34,
        mid + i * 4.2 + 1.13,
        ground + 4.05,
        0.21,
        oak,
      );
  } else {
    for (const i of [-1, 0, 1]) {
      const x = mid + i * 4.32;
      arch(out, f, x, ground + 1.08, ground + 5.28, 1.38, 1.55, ground + 8.28, 0.19, level, {
        door: true,
      });
      f.relief('limestone', x - 2.15, ground + 1.08, x - 1.5, ground + 8.37, 0.62, ivory, 0.13);
      f.relief('limestone', x + 1.5, ground + 1.08, x + 2.15, ground + 8.37, 0.62, ivory, 0.13);
      if (level === 3) {
        const rosette = f.point(x, ground + 7.58, 0.73);
        tube(out, 'limestone', rosette, f.point(x, ground + 7.58, 0.85), 0.53, ivory, 10);
      }
    }
  }
  f.panel('limestone', mid - 7.1, ground + 8.35, mid + 7.1, ground + 8.78, 0.68, ivory);
  const steps = level === 0 ? [0, 3] : [0, 1, 2, 3];
  for (const i of steps) {
    const width = 7.26 - i * 0.15,
      d = 4.16 - i * 0.83;
    const stair = [
      f.point(mid - width, 0, 0.05),
      f.point(mid + width, 0, 0.05),
      f.point(mid + width, 0, d),
      f.point(mid - width, 0, d),
    ].map(([x, , z]) => [x, z]);
    mappedSolid(out, 'ashlar', clockwise(stair), ground - 1.05, ground + 0.08 + i * 0.34, brown);
  }
  if (level >= 2) {
    for (const i of [-1, 1]) {
      const [x, y, z] = f.point(mid + i * 7.3, ground + 0.98, 2.11);
      box(out, 'ashlar', [x - 0.47, y - 0.8, z - 0.73], [x + 0.47, y + 0.12, z + 0.73], brown);
    }
  }
  cornice(out, plan, height - 0.36, level, 0.64);
}

function podium(out, level) {
  mappedSolid(out, 'ashlar', outer, -13, 9.67, brown);
  const source = frame.parts.find((p) => p.id === 52776561689303);
  const grade = new Map(source.outline.map((p, i) => [p.join(','), source.relativeGrade[i]]));
  for (const [a, b] of edges(outer)) {
    const f = wall(out, a, b);
    if (level < 2 || f.length < 4.45) continue;
    const g0 = grade.get(a.join(',')),
      g1 = grade.get(b.join(','));
    const n = Math.max(1, Math.round(f.length / 4.45));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        x = t * f.length,
        g = g0 + (g1 - g0) * t;
      f.panel('pane', x - 0.67, g + 1.15, x + 0.67, g + 3.11, 0.13, blue);
      if (level === 3) f.panel('limestone', x - 0.86, g + 0.99, x + 0.86, g + 1.15, 0.21, ivory);
    }
  }
  if (level >= 1) cornice(out, outer, 8.96, level, 0.67);
  for (const [id, front, ground] of [
    [321, true, 0],
    [322, false, -3.55],
  ]) {
    const plan = part(id);
    mappedSolid(out, 'limestone', plan, ground - 0.39, 16, cream);
    portal(out, plan, 16, ground, front, level);
  }
}

function wings(out, level) {
  const stages = [
    [310, 9.62, 32, 5],
    [311, 9.62, 32, 5],
    [308, 31.92, 52, 5],
    [312, 31.92, 52, 5],
    [304, 51.94, 68, 4],
    [307, 51.94, 68, 4],
  ];
  for (const [id, lower, upper, floors] of stages) {
    const plan = part(id);
    mappedSolid(out, 'limestone', plan, lower, upper, cream);
    if (level === 1) {
      fenestration(out, plan, lower + 0.48, upper - 0.74, 1, 5.3, 0);
    } else if (level >= 2) {
      fenestration(out, plan, lower + 0.26, upper - 0.74, floors, 3.37, level);
      cornice(out, plan, upper - 0.53, level);
      mappedSolid(out, 'roof', resized(plan, 0.955), upper - 0.005, upper + 0.17, gray);
    }
  }
  for (const id of [313, 315, 316, 320]) {
    bayCrown(out, part(id), 67.93, 76, level);
  }
}

function bronzeSpire(out, level) {
  const profiles = [
    [123.1, 4.88],
    [126.4, 3.77],
    [130.2, 3.42],
    [135.9, 2.84],
    [138.3, 2.58],
    [141.9, 2.44],
    [145.1, 1.82],
    [146.8, 1.65],
    [151.2, 0.58],
    [153.65, 0.16],
  ];
  const rings = profiles.map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, 'alloy', rings, gold);
  if (level >= 2) {
    for (let i = 0; i < rings[0].length; i++) {
      const line = rings.map((r) => [1.021 * r[i][0], r[i][1], 1.021 * r[i][2]]);
      beamPath(out, 'alloy', line, 0.058, 0.052, [0.83, 0.68, 0.39]);
    }
    for (const [y, r] of [
      [126.1, 3.89],
      [135.4, 3.04],
      [141.8, 2.57],
      [146.0, 1.87],
    ]) {
      loft(
        out,
        'alloy',
        [
          radialRing(y, r, r, 8, [0, 0], Math.PI / 8),
          radialRing(y + 0.32, r, r, 8, [0, 0], Math.PI / 8),
        ],
        [0.83, 0.65, 0.35],
      );
    }
  }
  tube(out, 'alloy', [0, 153.62, 0], [0, 155.15, 0], 0.106, gold, 6);
  if (level === 0) {
    tube(out, 'alloy', [0, 154.85, 0], [0, 156, 0], 0.26, gold, 6);
  } else {
    for (const axis of [0, 2]) {
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI * (0.5 + i / 5),
          r = i % 2 === 0 ? 1.08 : 0.4,
          p = [0, 154.89 + r * Math.sin(a), 0];
        p[axis] = r * Math.cos(a);
        return p;
      });
      beamPath(out, 'alloy', star, 0.063, 0.076, [0.78, 0.58, 0.25], true);
    }
  }
}

function tower(out, level) {
  mappedSolid(out, 'limestone', connector, 9.64, 60.03, cream);
  mappedSolid(out, 'limestone', shaft, 59.96, 92.04, cream);
  fenestration(out, connector, 10.3, 59.04, 12, 4.79, level === 1 ? 0 : level);
  fenestration(out, shaft, 60.51, 90.26, 7, 3.75, level, true);
  cornice(out, shaft, 88.98, level, 1.4);
  bayCrown(out, resized(shaft, 0.9), 91.89, 101.7, level);
  mappedSolid(out, 'limestone', spirePart(224), 95.3, 107.98, cream);
  for (const id of [314, 317, 318, 319]) {
    const plan = part(id),
      [x, z] = midpoint(plan);
    mappedSolid(out, 'limestone', plan, 89.88, 104.62, cream);
    cornice(out, plan, 103.75, level, 1.12);
    if (level >= 1) {
      fenestration(out, plan, 95.61, 103.39, 1, 4.1, level);
      for (const [a, b] of edges(plan)) {
        const f = wall(out, a, b),
          mid = f.length / 2;
        const p = [
          f.point(mid - 1.01, 104.55, 0.08),
          f.point(mid + 1.01, 104.55, 0.08),
          f.point(mid, 107.28, 0.08),
        ];
        tri(out, 'limestone', p, ivory);
      }
    }
    ornament(out, x, z, 104.53, 9.34, level, false);
  }
  mappedSolid(out, 'limestone', lantern, 105.92, 123.42, cream);
  for (const [a, b] of edges(lantern)) {
    const f = wall(out, a, b),
      m = f.length / 2;
    f.panel('pane', m - 0.35, 119.35, m + 0.35, 121.86, 0.142, blue);
    if (level < 1) continue;
    const medallion = level < 3 ? 8 : 16;
    tube(
      out,
      'limestone',
      f.point(m, 115.86, 0.04),
      f.point(m, 115.86, 0.24),
      0.89,
      ivory,
      medallion,
    );
    tube(out, 'pane', f.point(m, 115.86, 0.19), f.point(m, 115.86, 0.29), 0.45, blue, medallion);
    tri(
      out,
      'limestone',
      [f.point(m - 0.83, 107.9, 0.14), f.point(m + 0.83, 107.9, 0.14), f.point(m, 113.8, 0.14)],
      ivory,
    );
  }
  cornice(out, lantern, 122.21, level, 1.77);
  bronzeSpire(out, level);
}

function build(out, level) {
  podium(out, level);
  wings(out, level);
  tower(out, level);
}

export function buildSkyline(out) {
  mappedSolid(out, 'ashlar', outer, -13, 9.67, brown);
  for (const [id, lower, upper] of [
    [310, 9.62, 32],
    [311, 9.62, 32],
    [308, 31.92, 52],
    [312, 31.92, 52],
    [304, 51.94, 68],
    [307, 51.94, 68],
    [313, 67.95, 76.4],
    [315, 67.95, 76.4],
    [316, 67.95, 76.4],
    [320, 67.95, 76.4],
  ]) {
    mappedSolid(out, 'limestone', enclosingRectangle(part(id)), lower, upper, cream);
  }
  mappedSolid(out, 'limestone', enclosingRectangle(connector), 9.64, 60.03, cream);
  mappedSolid(out, 'limestone', shaft, 59.96, 92.04, cream);
  fenestration(out, shaft, 60.51, 91.49, 1, 3.75, 0, true);
  mappedSolid(out, 'limestone', resized(shaft, 0.9), 91.89, 101.7, cream);
  for (const id of [314, 317, 318, 319]) {
    const plan = part(id),
      [x, z] = midpoint(plan);
    mappedSolid(out, 'limestone', plan, 89.88, 105.2, cream);
    loft(
      out,
      'limestone',
      [radialRing(104.71, 0.63, 0.63, 4, [x, z]), radialRing(113.88, 0.042, 0.042, 4, [x, z])],
      ivory,
    );
  }
  mappedSolid(out, 'limestone', lantern, 101.55, 123.7, cream);
  for (const [id, front, ground] of [
    [321, true, 0],
    [322, false, -3.55],
  ]) {
    mappedSolid(out, 'limestone', part(id), ground - 0.39, 16, cream);
    portal(out, part(id), 16, ground, front, 0);
  }
  bronzeSpire(out, 0);
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
