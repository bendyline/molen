import { readFileSync } from 'node:fs';
import { pointInRing } from '../../../../../../../../packages/terrain/dist/kernel.mjs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedSolid,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = new Map(
  frame.parts.map((part) => [part.id, { ...part, plan: clockwise(part.outline) }]),
);
const site = parts.get(35184404634512);
const lower = parts.get(35184577095035).plan;
const shaft = parts.get(35184577095037).plan;
const crown = parts.get(35184577762988).plan;
const neck = parts.get(35184577762989).plan;
const spireBase = parts.get(35185364208647).plan;
const corners = [95036, 95038, 95039, 95040].map((id) => parts.get(35184577000000 + id).plan);
const wings = [...parts.values()].filter(
  (p) =>
    p.id !== site.id &&
    p.plan !== lower &&
    !corners.includes(p.plan) &&
    ![shaft, crown, neck, spireBase].includes(p.plan),
);

export const surfaces = {
  pale: { slot: 'wall', graph: 'stone_limestone' },
  rusticated: { slot: 'foundation', graph: 'stone_granite' },
  roof: { slot: 'roof', graph: 'metal_painted' },
  metal: { slot: 'trim', graph: 'metal_copper' },
  pane: { slot: 'window', localRef: 'palette:#ffffff', name: 'Blue gray window glass' },
  wood: { slot: 'door', graph: 'wood_plain' },
};
const stone = [0.88, 0.82, 0.7];
const trim = [0.98, 0.92, 0.8];
const granite = [0.51, 0.31, 0.25];
const steel = [0.43, 0.43, 0.38];
const bronze = [0.4, 0.37, 0.25];
const glass = [0.081, 0.136, 0.158];
const warm = [0.65, 0.42, 0.22];

function rect(x, z, width, depth) {
  return [
    [x - width / 2, z - depth / 2],
    [x - width / 2, z + depth / 2],
    [x + width / 2, z + depth / 2],
    [x + width / 2, z - depth / 2],
  ];
}
function center(plan) {
  return plan.reduce((s, p) => [s[0] + p[0] / plan.length, s[1] + p[1] / plan.length], [0, 0]);
}
function resize(plan, scale) {
  const mid = center(plan);
  return plan.map((p) => p.map((v, i) => mid[i] + (v - mid[i]) * scale));
}
function edges(plan) {
  return plan.map((a, i) => [a, plan[(i + 1) % plan.length]]);
}
function facade(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const point = (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d];
  const panel = (slot, x0, y0, x1, y1, d, color) =>
    face(
      out,
      slot,
      [point(x0, y0, d), point(x1, y0, d), point(x1, y1, d), point(x0, y1, d)],
      color,
    );
  const relief = (slot, x0, y0, x1, y1, d, color, back = 0) => {
    panel(slot, x0, y0, x1, y1, d, color);
    face(
      out,
      slot,
      [point(x0, y0, back), point(x0, y0, d), point(x0, y1, d), point(x0, y1, back)],
      color,
    );
    face(
      out,
      slot,
      [point(x1, y0, d), point(x1, y0, back), point(x1, y1, back), point(x1, y1, d)],
      color,
    );
    face(
      out,
      slot,
      [point(x0, y1, d), point(x1, y1, d), point(x1, y1, back), point(x0, y1, back)],
      color,
    );
  };
  return { point, panel, relief, length };
}

function bands(out, plan, y, height, level) {
  const layers =
    level > 1
      ? [
          [0, 0.28, 1.018],
          [0.27, 0.67, 1.04],
          [0.65, 1, 1.07],
        ]
      : [[0, 1, 1.055]];
  for (const [lo, hi, scale] of layers) {
    mappedSolid(out, 'pale', resize(plan, scale), y + lo * height, y + hi * height, trim);
  }
}

/** Pilasters stand proud of a separate strip of dark spandrels and recessed glazing. */
function windows(out, plan, bottom, top, floors, pitch, level, { tower = false, neighbor } = {}) {
  const floor = (top - bottom) / floors;
  for (const [index, [a, b]] of edges(plan).entries()) {
    const f = facade(out, a, b);
    if (f.length < 1.8) continue;
    const count = Math.max(1, Math.round(f.length / pitch));
    const bay = f.length / count;
    for (let i = 0; i < count; i++) {
      const mid = bay * (i + 0.5);
      const [x, , z] = f.point(mid, 0, 0.9);
      if (neighbor?.([x, z])) continue;
      const half = Math.min(0.71, bay * 0.248);
      const tall = tower || f.length > 10;
      f.panel(
        'roof',
        mid - half - 0.11,
        bottom - 0.1,
        mid + half + 0.11,
        top,
        0.1,
        tall ? [0.46, 0.32, 0.25] : steel,
      );
      if (level === 0) continue;
      const left = Math.max(0.018, mid - bay / 2 + 0.08);
      const right = mid - half - 0.22;
      if (right > left && (level === 3 || (level === 2 && tower))) {
        const relief = level === 3 ? f.relief : f.panel;
        relief('pale', left, bottom - 0.2, right, top + 0.3, tower ? 0.38 : 0.27, trim);
      }
      for (let j = 0; j < floors; j++) {
        const y = bottom + (j + 0.11) * floor,
          high = y + floor * 0.62;
        const variant = ((7 * i + 3 * j + index) % 5) * 0.015;
        f.panel(
          'pane',
          mid - half,
          y,
          mid + half,
          high,
          0.19,
          glass.map((c) => c + variant),
        );
        if (level === 3 || (level === 2 && tower)) {
          f.panel('pale', mid - half - 0.17, y - 0.13, mid + half + 0.17, y, 0.23, trim);
          f.panel('wood', mid - 0.037, y, mid + 0.037, high, 0.245, warm);
        }
        if (level === 3 && (tower || j % 2 === 0)) {
          f.panel(
            'wood',
            mid - half,
            y + 0.42 * floor,
            mid + half,
            y + 0.42 * floor + 0.045,
            0.254,
            warm,
          );
        }
      }
    }
  }
}

function groundCourses(out, level) {
  const { outline, relativeGrade } = site;
  const grade = new Map(outline.map((p, i) => [p, relativeGrade[i]]));
  for (const [a, b] of edges(site.plan)) {
    const f = facade(out, a, b);
    const n = level >= 2 ? Math.ceil(f.length / 8) : 1;
    for (let i = 0; i < n; i++) {
      const u = i / n,
        v = (i + 1) / n;
      const g0 = grade.get(a) + (grade.get(b) - grade.get(a)) * u;
      const g1 = grade.get(a) + (grade.get(b) - grade.get(a)) * v;
      const lip = 0.54,
        h = 2.35;
      face(
        out,
        'rusticated',
        [
          f.point(u * f.length, g0 - 1, 0.045),
          f.point(v * f.length, g1 - 1, 0.045),
          f.point(v * f.length, g1 + h, 0.045),
          f.point(u * f.length, g0 + h, 0.045),
        ],
        granite,
      );
      if (level >= 1) {
        face(
          out,
          'rusticated',
          [
            f.point(u * f.length, g0 + h - lip, 0.14),
            f.point(v * f.length, g1 + h - lip, 0.14),
            f.point(v * f.length, g1 + h, 0.14),
            f.point(u * f.length, g0 + h, 0.14),
          ],
          [0.61, 0.42, 0.34],
        );
      }
    }
  }
}

/** Open arcade. Spandrels and a shallow soffit frame real gaps between the posts. */
function arcade(out, f, centerX, y0, width, spring, rise, top, level) {
  const half = width / 2,
    over = 0.62;
  const lo = centerX - half,
    hi = centerX + half;
  const { point, relief, panel } = f;
  relief('pale', lo - over, y0, lo, top, 0.16, trim, -0.68);
  relief('pale', hi, y0, hi + over, top, 0.16, trim, -0.68);
  const divisions = level === 3 ? 8 : 3;
  let previous;
  for (let i = 0; i <= divisions; i++) {
    const a = Math.PI * (1 - i / divisions);
    const x = centerX + half * Math.cos(a),
      y = spring + rise * Math.sin(a);
    if (previous) {
      const [x0, yA] = previous;
      face(
        out,
        'pale',
        [point(x0, yA, 0.16), point(x, y, 0.16), point(x, top, 0.16), point(x0, top, 0.16)],
        stone,
      );
      face(
        out,
        'pale',
        [point(x, y, 0.16), point(x0, yA, 0.16), point(x0, yA, -0.68), point(x, y, -0.68)],
        trim,
      );
      if (level === 3) {
        const d = 0.22;
        face(
          out,
          'pale',
          [point(x0, yA, d), point(x, y, d), point(x, y + 0.24, d), point(x0, yA + 0.24, d)],
          trim,
        );
      }
    }
    previous = [x, y];
  }
  if (level >= 2) {
    panel('pale', lo, y0, hi, y0 + 0.21, 0.22, trim);
    if (level === 3) {
      for (let x = lo + 0.23; x < hi - 0.14; x += 0.37) {
        panel('pale', x, y0 + 0.23, x + 0.12, y0 + 0.91, 0.22, trim);
      }
    }
    panel('pale', lo, y0 + 0.91, hi, y0 + 1.06, 0.22, trim);
  }
}

function finial(out, x, z, y, h, level) {
  if (level < 2) {
    loft(
      out,
      'pale',
      [
        [0, 0.57],
        [h, 0.055],
      ].map(([off, r]) => radialRing(y + off, r, r, 4, [x, z], Math.PI / 4)),
      trim,
    );
    return;
  }
  const profile =
    level === 2
      ? [
          [0, 0.59],
          [0.24, 0.47],
          [0.73, 0.32],
          [1, 0.035],
        ]
      : [
          [0, 0.59],
          [0.18, 0.64],
          [0.26, 0.41],
          [0.66, 0.32],
          [0.75, 0.41],
          [0.86, 0.24],
          [1, 0.035],
        ];
  loft(
    out,
    'pale',
    profile.map(([t, r]) => radialRing(y + t * h, r, r, level === 3 ? 8 : 4, [x, z], Math.PI / 4)),
    trim,
  );
}

function belvedere(out, plan, y, level) {
  if (level < 2) {
    mappedSolid(out, 'pale', plan, y - 0.18, y + 5.67, trim);
    for (const [a, b] of edges(plan)) {
      const f = facade(out, a, b);
      const n = level === 0 ? 1 : Math.max(1, Math.round(f.length / 4.7));
      for (let i = 0; i < n; i++) {
        const span = f.length / n,
          mid = span * (i + 0.5);
        f.panel('pane', mid - span * 0.32, y + 0.24, mid + span * 0.32, y + 4.37, 0.14, glass);
      }
    }
    return;
  }
  mappedSolid(out, 'pale', plan, y - 0.18, y + 0.24, trim);
  for (const [a, b] of edges(plan)) {
    const f = facade(out, a, b);
    const bays = Math.max(1, Math.round(f.length / (level === 3 ? 4.3 : 5.2)));
    for (let i = 0; i < bays; i++) {
      const span = f.length / bays;
      arcade(out, f, span * (i + 0.5), y + 0.19, span - 1.16, y + 3.08, 1.14, y + 5.05, level);
    }
  }
  bands(out, plan, y + 5.03, 0.72, level);
  for (const [x, z] of resize(plan, 0.88)) finial(out, x, z, y + 5.66, 1.2, level);
}

function centralPortico(out, level) {
  const [a, b] = edges(lower).reduce((best, e) =>
    e[0][1] + e[1][1] > best[0][1] + best[1][1] ? e : best,
  );
  const f = facade(out, a, b),
    mid = f.length / 2;
  const border = 7.7;
  f.relief('rusticated', mid - border, 0.74, mid + border, 8.8, 1.25, granite);
  f.relief(
    'rusticated',
    mid - border - 0.35,
    8.4,
    mid + border + 0.35,
    9.05,
    1.75,
    [0.61, 0.39, 0.28],
  );
  f.relief('rusticated', mid - border - 0.43, 9.0, mid + border + 0.43, 9.28, 1.94, granite);
  for (const x of [mid - 6.25, mid - 2.42, mid + 2.42, mid + 6.25]) {
    f.relief('rusticated', x - 0.46, 0.82, x + 0.46, 8.43, 1.53, [0.66, 0.41, 0.3], 1.2);
  }
  for (const x of [mid - 4.38, mid, mid + 4.38]) {
    const half = x === mid ? 1.29 : 0.8;
    f.panel('wood', x - half - 0.15, 0.75, x + half + 0.15, 5.78, 1.32, warm);
    f.panel('pane', x - half, 0.86, x + half, 5.58, 1.41, glass);
    if (level >= 2) {
      f.panel('wood', x - 0.055, 0.86, x + 0.055, 5.58, 1.47, warm);
      for (const y of [2.8, 3.8, 4.9])
        f.panel('wood', x - half, y, x + half, y + 0.115, 1.47, warm);
      f.relief('rusticated', x - half - 0.31, 5.67, x + half + 0.31, 6.08, 1.49, granite, 1.24);
    }
  }
  const steps = level === 0 ? [0, 2] : [0, 1, 2];
  for (const i of steps) {
    const w = 8.19 - i * 0.16,
      d = 4.41 - i * 0.54;
    const footprint = [
      f.point(mid - w, 0, 1.1),
      f.point(mid + w, 0, 1.1),
      f.point(mid + w, 0, d),
      f.point(mid - w, 0, d),
    ].map(([x, , z]) => [x, z]);
    mappedSolid(out, 'rusticated', clockwise(footprint), -1.32, 0.12 + i * 0.31, granite);
  }
  // Garden Ring face carries a stone medallion above the central portal.
  const y = 52.95,
    diameter = 5.9,
    radius = diameter * 0.5;
  tube(
    out,
    'pale',
    f.point(mid, y, 0.34),
    f.point(mid, y, 0.67),
    radius,
    trim,
    level < 2 ? 12 : 24,
  );
  if (level >= 2) {
    const leafCount = level === 3 ? 18 : 10;
    for (let i = 0; i < leafCount; i++) {
      const a = Math.PI * (0.13 + (i * 1.74) / (leafCount - 1));
      const x = mid + 2.43 * Math.cos(a),
        height = y + 2.43 * Math.sin(a);
      tube(
        out,
        'pale',
        f.point(x, height, 0.66),
        f.point(x, height, 0.78),
        0.37,
        [0.81, 0.74, 0.6],
        6,
      );
    }
    tube(out, 'pale', f.point(mid, y, 0.65), f.point(mid, y, 0.87), 1.48, stone, 16);
    for (const i of [-1, 0, 1])
      f.panel('pale', mid + i * 0.31 - 0.1, y - 0.7, mid + i * 0.31 + 0.1, y + 0.82, 0.93, trim);
  }
}

function metroDoors(out, level) {
  const bank = wings.find((p) => p.id === 35184577095050).plan;
  const frontage = edges(bank).filter(
    ([a, b]) => Math.min(a[0], b[0]) > 37 && Math.abs(a[1] - b[1]) > 17,
  );
  const at = (z) => {
    const [a, b] = frontage.find(
      ([a, b]) => z >= Math.min(a[1], b[1]) && z <= Math.max(a[1], b[1]),
    );
    const f = facade(out, a, b);
    return [f, ((z - a[1]) / (b[1] - a[1])) * f.length];
  };
  const [start, end] = frame.metro;
  const grade = (z) =>
    start.relativeGrade +
    ((end.relativeGrade - start.relativeGrade) * (z - start.point[1])) /
      (end.point[1] - start.point[1]);
  for (const z of [-51.2, -54.6, -58, -61.4, -64.8, -68.2]) {
    const [f, u] = at(z),
      y = grade(z) + 0.12;
    f.relief('rusticated', u - 1.62, y - 0.15, u + 1.62, y + 4.05, 0.29, [0.39, 0.37, 0.34]);
    f.panel('wood', u - 1.08, y, u + 1.08, y + 3.69, 0.37, warm);
    f.panel('pane', u - 0.86, y + 0.55, u + 0.86, y + 3.33, 0.46, glass);
    f.panel('wood', u - 0.055, y, u + 0.055, y + 3.33, 0.51, warm);
    if (level >= 2) {
      f.panel('wood', u - 0.87, y + 2.03, u + 0.87, y + 2.17, 0.51, warm);
      f.panel('wood', u - 0.87, y + 2.73, u + 0.87, y + 2.86, 0.51, warm);
    }
  }
  const [f, u] = at(-59.6),
    y = grade(-59.6) + 3.15;
  const letter = [
    [u - 0.42, y],
    [u - 0.28, y + 0.58],
    [u, y + 0.27],
    [u + 0.28, y + 0.58],
    [u + 0.42, y],
  ];
  beamPath(
    out,
    'roof',
    letter.map(([x, y]) => f.point(x, y, 0.53)),
    0.12,
    0.055,
    [0.74, 0.13, 0.1],
  );
}

function buildWings(out, level) {
  mappedSolid(out, 'rusticated', site.plan, -16, -13, granite);
  for (const part of wings) {
    const { plan, relativeGrade, height } = part;
    const low = Math.min(...relativeGrade) - 1.85;
    const neighbors = level !== 0 ? wings.filter((p) => p !== part && p.height >= height - 2) : [];
    const covered = (p) =>
      pointInRing(p, lower) || neighbors.some((other) => pointInRing(p, other.plan));
    const arcaded =
      part.id === 35184577095033 ||
      part.id === 35184577095034 ||
      part.id === 35185364997779 ||
      part.id === 35185364997780;
    const top = arcaded ? height - 4.6 : height;
    mappedSolid(out, 'pale', plan, low, top, stone);
    if (level > 0 && top - low > 7 && (level > 1 || part.id >= 35184577095045)) {
      const floors = Math.max(2, Math.round((top - low - 3.4) / 3.61));
      const pitch = level === 3 ? 3.58 : level === 2 ? 4.45 : 4.8;
      const frontageDetail = level === 1 ? 0 : level;
      windows(out, plan, low + 2.9, top - 1.0, floors, pitch, frontageDetail, {
        neighbor: covered,
      });
    }
    if (arcaded) {
      belvedere(out, resize(plan, 0.975), top, level);
    } else if (level >= 2 && height >= 28) {
      if (level === 3) bands(out, plan, top - 0.43, 0.62, 1);
      mappedSolid(out, 'roof', resize(plan, 0.97), top + 0.01, top + 0.1, steel);
    }
  }
  groundCourses(out, level);
  if (level >= 1) metroDoors(out, level);
}

function tower(out, level) {
  mappedSolid(out, 'pale', lower, -3.25, 57.7, stone);
  windows(out, lower, 7.6, 49.6, 11, 4.2, level, { tower: true });
  bands(out, lower, 26.7, 0.49, level);
  bands(out, lower, 54.27, 3.32, level);
  centralPortico(out, level);
  for (const plan of corners) {
    const [x, z] = center(plan);
    const box = rect(x * 0.945, z * 0.891, 5.55, 5.04);
    belvedere(out, box, 57.55, level);
  }
  mappedSolid(out, 'pale', shaft, 57.52, 92.5, stone);
  windows(out, shaft, 59.15, 89.42, 8, 3.45, level, { tower: true });
  bands(out, shaft, 90.72, 2.29, level);
  mappedSolid(out, 'pale', resize(shaft, 0.97), 92.87, 94.62, trim);
  for (const [a, b] of edges(shaft)) {
    const f = facade(out, a, b);
    const count = level === 0 ? 2 : Math.max(2, Math.round(f.length / 3.45));
    for (let i = 0; i < count; i++) {
      const [x, y, z] = f.point((f.length * (i + 0.5)) / count, 94.57, -0.55);
      finial(out, x, z, y, i === 0 || i === count - 1 ? 3.97 : 2.8, level);
    }
  }
  mappedSolid(out, 'pale', resize(crown, 1.34), 93.56, 108.77, stone);
  windows(out, resize(crown, 1.343), 96.4, 105.31, 3, 4.0, level, { tower: true });
  bands(out, resize(crown, 1.34), 106.98, 1.91, level);
  for (const [x, z] of resize(crown, 1.14)) finial(out, x, z, 108.6, 5.82, level);
  mappedSolid(out, 'pale', resize(neck, 1.9), 108.7, 116.0, stone);
  bands(out, resize(neck, 1.9), 113.7, 1.35, level);
  for (const [x, z] of resize(neck, 1.47)) finial(out, x, z, 115.0, 3.15, level);
  mappedSolid(out, 'metal', resize(spireBase, 1.23), 115.7, 118.6, bronze);
  const roof = [
    [117.65, 1.82],
    [120.3, 1.31],
    [127.3, 0.68],
    [134.45, 0.18],
  ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, 'metal', roof, bronze);
  if (level >= 2)
    for (const i of [0, 2, 4, 6]) {
      beamPath(
        out,
        'metal',
        roof.map((r) => [r[i][0] * 1.024, r[i][1], r[i][2] * 1.024]),
        0.069,
        0.059,
        [0.59, 0.5, 0.35],
      );
    }
  tube(out, 'metal', [0, 134.37, 0], [0, 136.8, 0], 0.1, bronze, 6);
  if (level === 0) {
    tube(out, 'metal', [0, 136.66, 0], [0, 138, 0], 0.32, bronze, 6);
  } else {
    for (const axis of [0, 2]) {
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI * (0.5 + i / 5),
          r = i % 2 === 0 ? 1.26 : 0.44;
        const p = [0, 136.68 + r * Math.sin(a), 0];
        p[axis] = r * Math.cos(a);
        return p;
      });
      beamPath(out, 'metal', star, 0.093, 0.084, [0.59, 0.48, 0.27], true);
    }
  }
}

function build(out, level) {
  buildWings(out, level);
  tower(out, level);
}
export function buildSkyline(out) {
  for (const { plan, relativeGrade, height } of wings) {
    mappedSolid(out, 'pale', plan, Math.min(...relativeGrade) - 1.85, height, stone);
  }
  mappedSolid(out, 'pale', lower, -3.25, 57.7, stone);
  mappedSolid(out, 'pale', shaft, 57.52, 93.4, stone);
  for (const [plan, bottom, top] of [
    [lower, 8, 53],
    [shaft, 59.15, 90],
  ]) {
    for (const [a, b] of edges(plan)) {
      const f = facade(out, a, b);
      const n = Math.max(1, Math.round(f.length / 5));
      for (let i = 0; i < n; i++) {
        const mid = ((i + 0.5) * f.length) / n;
        f.panel('roof', mid - 0.62, bottom, mid + 0.62, top, 0.25, [0.46, 0.32, 0.25]);
      }
    }
  }
  for (const plan of corners) {
    const [x, z] = center(plan);
    mappedSolid(out, 'pale', rect(x * 0.945, z * 0.891, 5.55, 5.04), 57.55, 63.3, trim);
  }
  bands(out, lower, 55.05, 2.65, 0);
  bands(out, shaft, 90.5, 2.55, 0);
  mappedSolid(out, 'pale', resize(crown, 1.34), 93.56, 108.77, stone);
  for (const [x, z] of resize(crown, 1.14)) finial(out, x, z, 108.6, 5.82, 0);
  mappedSolid(out, 'pale', resize(neck, 1.9), 108.7, 116, stone);
  const roof = [
    [116, 1.82],
    [120.3, 1.31],
    [134.7, 0.14],
  ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, 'metal', roof, bronze);
  tube(out, 'metal', [0, 134.6, 0], [0, 138, 0], 0.23, bronze, 6);
  centralPortico(out, 0);
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
