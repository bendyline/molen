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
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { parts } = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const [
  footprint,
  plinth,
  west,
  east,
  entrance,
  frontEast,
  frontWest,
  annexEast,
  annexWest,
  crown,
  shaft,
  spireSeat,
  lantern,
] = parts.map(({ outline }) => clockwise(outline));

export const surfaces = {
  limestone: { slot: 'trim', graph: 'stone_limestone' },
  brick: { slot: 'wall', graph: 'brick' },
  granite: { slot: 'foundation', graph: 'stone_granite' },
  copper: { slot: 'roof', graph: 'metal_painted' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', name: 'Inset blue-gray glass' },
  brass: { slot: 'trim', graph: 'metal_copper' },
};

const cream = [0.9, 0.83, 0.7];
const highlight = [0.97, 0.91, 0.81];
const rust = [0.8, 0.49, 0.32];
const granite = [0.63, 0.59, 0.57];
const green = [0.19, 0.49, 0.39];
const blue = [0.088, 0.132, 0.163];
const gold = [0.89, 0.71, 0.3];

function resize(plan, scale) {
  const center = plan
    .reduce(([x, z], p) => [x + p[0], z + p[1]], [0, 0])
    .map((value) => value / plan.length);
  return plan.map((p) => p.map((value, i) => center[i] + (value - center[i]) * scale));
}

function molding(out, plan, y, width, height) {
  mappedSolid(out, 'limestone', resize(plan, width), y, y + height, highlight);
}

/** Clockwise exterior edge frame, with the horizontal coordinate increasing to the right. */
function edgeFrame(out, a, b) {
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  const point = (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d];
  const panel = (slot, x0, y0, x1, y1, d, color) =>
    face(
      out,
      slot,
      [point(x0, y0, d), point(x1, y0, d), point(x1, y1, d), point(x0, y1, d)],
      color,
    );
  const relief = (slot, x0, y0, x1, y1, d, color) => {
    panel(slot, x0, y0, x1, y1, d, color);
    face(out, slot, [point(x0, y0), point(x0, y0, d), point(x0, y1, d), point(x0, y1)], color);
    face(out, slot, [point(x1, y0, d), point(x1, y0), point(x1, y1), point(x1, y1, d)], color);
    face(out, slot, [point(x0, y1, d), point(x1, y1, d), point(x1, y1), point(x0, y1)], color);
  };
  return { length, point, panel, relief };
}

function bays(out, plan, bottom, top, floors, pitch, level) {
  for (const [index, a] of plan.entries()) {
    const b = plan[(index + 1) % plan.length];
    const { length, panel, relief } = edgeFrame(out, a, b);
    if (length < 2.4) continue;
    const count = Math.max(1, Math.round(length / pitch));
    const step = length / count;
    const floor = (top - bottom) / floors;
    for (let bay = 0; bay < count; bay++) {
      const center = step * (bay + 0.5);
      const margin = Math.min(step * 0.26, 0.87);
      const pilaster = level === 3 ? relief : panel;
      pilaster(
        'limestone',
        bay * step + 0.06,
        bottom - 0.8,
        bay * step + margin,
        top + 0.52,
        0.22,
        cream,
      );
      pilaster(
        'limestone',
        (bay + 1) * step - margin,
        bottom - 0.8,
        (bay + 1) * step - 0.06,
        top + 0.52,
        0.22,
        cream,
      );
      const half = Math.min(step * 0.23, 1.04);
      for (let row = 0; row < floors; row++) {
        const y = bottom + row * floor + floor * 0.14;
        const high = y + floor * 0.62;
        if (level >= 2)
          panel(
            'limestone',
            center - half - 0.14,
            y - 0.15,
            center + half + 0.14,
            high + 0.12,
            0.079,
            cream,
          );
        const shade = (index + 2 * bay + 3 * row) % 7;
        panel('glass', center - half, y, center + half, high, 0.146, [
          blue[0] + shade * 0.009,
          blue[1] + shade * 0.012,
          blue[2] + shade * 0.011,
        ]);
        if (level >= 2) {
          panel('limestone', center - 0.04, y, center + 0.04, high, 0.206, highlight);
          panel(
            'limestone',
            center - half,
            y + floor * 0.39,
            center + half,
            y + floor * 0.39 + 0.065,
            0.206,
            cream,
          );
        }
        if (level === 3) {
          relief(
            'limestone',
            center - half - 0.21,
            y - 0.2,
            center + half + 0.21,
            y - 0.07,
            0.21,
            highlight,
          );
        }
      }
    }
  }
}

function archPanel(out, edge, center, bottom, spring, rise, radius, level, depth = 0.24) {
  const { point, panel, relief } = edge;
  const segments = level < 2 ? 8 : 14;
  const path = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / segments);
    return [center + radius * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
  panel('glass', center - radius, bottom, center + radius, spring, depth, blue);
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    const p = [point(x0, spring, depth), point(x1, spring, depth)];
    if (i !== segments) p.push(point(x1, y1, depth));
    if (i !== 1) p.push(point(x0, y0, depth));
    if (p.length === 3) tri(out, 'glass', p, blue);
    else face(out, 'glass', p, blue);
  }
  const trim = Math.min(0.28, radius * 0.21);
  const rim = [[center - radius, bottom], ...path, [center + radius, bottom]].map(([x, y]) =>
    point(x, y, depth + 0.09),
  );
  beamPath(out, 'limestone', rim, trim, trim, highlight);
  if (level >= 2) {
    for (const x of [center - radius / 2, center, center + radius / 2]) {
      const high = spring + rise * Math.sqrt(1 - Math.pow((x - center) / radius, 2));
      panel('brass', x - 0.043, bottom, x + 0.043, high, depth + 0.012, gold);
    }
    for (const y of [
      bottom + 0.33 * (spring - bottom),
      bottom + 0.68 * (spring - bottom),
      spring,
    ]) {
      panel('brass', center - radius, y - 0.036, center + radius, y + 0.036, depth + 0.012, gold);
    }
    relief(
      'limestone',
      center - radius - 0.34,
      bottom - 0.25,
      center + radius + 0.34,
      bottom,
      depth + 0.2,
      cream,
    );
  }
}

function pinnacle(out, x, z, y, height, level) {
  const rings = [
    [0, 0.57],
    [0.18, 0.63],
    [0.23, 0.41],
    [0.68, 0.34],
    [0.82, 0.19],
    [1, 0.039],
  ].map(([fraction, radius]) =>
    radialRing(y + fraction * height, radius, radius, level < 2 ? 4 : 8, [x, z], Math.PI / 4),
  );
  loft(out, 'limestone', rings, highlight);
}

function hotelEntrance(out, level) {
  const front = entrance.filter((p) => p[1] > 25).sort((a, b) => a[0] - b[0]);
  const edge = edgeFrame(out, front[0], front[1]);
  const { length, point, panel, relief } = edge;
  const mid = length / 2;
  mappedSolid(out, 'brick', entrance, 2.35, 17.8, rust);
  relief('limestone', 0.12, 2.35, 2.36, 19.6, 0.33, cream);
  relief('limestone', length - 2.36, 2.35, length - 0.12, 19.6, 0.33, cream);
  for (const x of [mid - 3.38, mid + 3.38]) {
    relief('brick', x - 0.64, 2.35, x + 0.64, 17.2, 0.38, rust);
    relief('limestone', x - 0.73, 2.35, x + 0.73, 3.35, 0.56, highlight);
    relief('limestone', x - 0.74, 15.65, x + 0.74, 16.05, 0.47, highlight);
  }
  for (const x of [1.18, length - 1.18]) {
    const p = point(x, 19.58, 0.19);
    pinnacle(out, p[0], p[2], p[1], 2.3, level);
  }
  const gable = [
    [mid - 5.1, 15.9],
    [mid - 3.6, 19.65],
    [mid, 23.45],
    [mid + 3.6, 19.65],
    [mid + 5.1, 15.9],
  ];
  const outward = gable.map(([x, y]) => point(x, y, 0.21));
  for (let i = 1; i < outward.length - 1; i++) {
    tri(out, 'brick', [outward[0], outward[i + 1], outward[i]], rust);
  }
  const rearGable = gable.map(([x, y]) => point(x, y, -2.25));
  for (let i = 1; i < gable.length; i++) {
    face(out, 'limestone', [outward[i], outward[i - 1], rearGable[i - 1], rearGable[i]], cream);
  }
  beamPath(out, 'limestone', outward, 0.36, 0.48, highlight);
  archPanel(out, edge, mid, 5.3, 15.3, 4.4, 2.48, level, 0.28);
  panel('glass', mid - 2.5, 2.36, mid + 2.5, 5.05, 0.27, blue);
  for (const width of [-1.23, 0, 1.23]) {
    relief('brass', mid + width - 0.058, 2.38, mid + width + 0.058, 5.0, 0.29, gold);
  }
  // Tiered entrance landing follows the sampled forecourt rather than the terrain under the tower.
  const risers = level === 0 ? [0, 3, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const step of risers) {
    const lo = mid - 4.35 + step * 0.11;
    const hi = mid + 4.35 - step * 0.11;
    const deck = [
      point(lo, 0, 0),
      point(hi, 0, 0),
      point(hi, 0, 3.25 - step * 0.39),
      point(lo, 0, 3.25 - step * 0.39),
    ].map(([x, , z]) => [x, z]);
    mappedSolid(out, 'granite', clockwise(deck), -0.45, 0.56 + step * (1.79 / 7), granite);
  }
}

function corniceCrown(out, level) {
  molding(out, shaft, 87.4, 1.035, 0.65);
  molding(out, shaft, 89.65, 1.055, 0.98);
  molding(out, shaft, 90.62, 1.018, 0.58);
  mappedSolid(out, 'limestone', resize(shaft, 0.89), 91.17, 93.02, cream);
  for (const [index, a] of shaft.entries()) {
    const edge = edgeFrame(out, a, shaft[(index + 1) % shaft.length]);
    const width = edge.length;
    for (const x of [0.88, width * 0.25, width * 0.5, width * 0.75]) {
      const p = edge.point(x, 90.9, -0.9);
      pinnacle(out, p[0], p[2], p[1], x === 0.88 ? 5.35 : 3.1, level);
    }
    if (level === 3) {
      for (let x = 1.0; x < width - 0.5; x += 0.94) {
        edge.relief('limestone', x - 0.14, 88.1, x + 0.14, 89.59, 0.31, cream);
      }
    }
  }
  mappedSolid(out, 'brick', crown, 92.8, 105.9, rust);
  const vertical = [1.94, 2.57];
  for (const [index, a] of crown.entries()) {
    const edge = edgeFrame(out, a, crown[(index + 1) % crown.length]);
    const mid = edge.length / 2;
    for (const x of [vertical[0], edge.length - vertical[0]]) {
      edge.relief('limestone', x - 1.18, 92.8, x + 1.18, 105.62, 0.24, cream);
      edge.relief('limestone', x - 1.28, 102.6, x + 1.28, 103.45, 0.37, highlight);
      const p = edge.point(x, 105.9, -0.65);
      pinnacle(out, p[0], p[2], p[1], 3.35, level);
    }
    archPanel(out, edge, mid, 95.35, 101.35, 2.02, vertical[1], level, 0.106);
  }
  molding(out, crown, 105.65, 1.065, 0.74);
  molding(out, crown, 106.35, 0.89, 0.52);
}

function roofLantern(out, level) {
  mappedSolid(out, 'brick', lantern, 106.75, 119.2, rust);
  for (const [index, a] of lantern.entries()) {
    const edge = edgeFrame(out, a, lantern[(index + 1) % lantern.length]);
    const w = edge.length;
    edge.relief('limestone', 0, 106.88, 0.72, 119.05, 0.19, cream);
    edge.relief('limestone', w - 0.72, 106.88, w, 119.05, 0.19, cream);
    archPanel(out, edge, w / 2, 108.25, 116.25, 1.57, Math.min(1.1, w * 0.25), level, 0.106);
  }
  molding(out, lantern, 118.81, 1.055, 0.72);
  molding(out, lantern, 119.52, 0.87, 0.73);
  mappedSolid(out, 'limestone', spireSeat, 120.23, 122.04, highlight);
  const roof = [
    [121.6, 2.43],
    [123.0, 1.88],
    [127.4, 1.18],
    [131.4, 0.51],
    [133.8, 0.14],
  ].map(([y, radius]) => radialRing(y, radius, radius, 8, [0, 0], Math.PI / 8));
  loft(out, 'copper', roof, green);
  if (level >= 1) {
    for (let seam = 0; seam < 8; seam++) {
      const path = roof.map((ring) => ring[seam].map((v, i) => (i === 1 ? v : v * 1.017)));
      beamPath(out, 'copper', path, 0.036, 0.028, [0.27, 0.54, 0.44]);
    }
  }
  tube(out, 'brass', [0, 133.71, 0], [0, 135.33, 0], 0.106, gold, 8);
  // The crown emblem is represented as a gilt openwork star.
  for (const axis of [0, 2]) {
    const star = Array.from({ length: 10 }, (_, i) => {
      const angle = Math.PI * (0.5 + i / 5);
      const radius = i % 2 ? 0.26 : 0.72;
      const p = [0, 135.28 + radius * Math.sin(angle), 0];
      p[axis] = radius * Math.cos(angle);
      return p;
    });
    beamPath(out, 'brass', star, 0.066, 0.063, gold, true);
  }
}

function build(out, level) {
  mappedSolid(out, 'granite', footprint, -2.5, 2.35, granite);
  for (const plan of [annexEast, annexWest]) {
    mappedSolid(out, 'limestone', plan, 2.35, 5.0, cream);
    bays(out, plan, 2.95, 4.52, 1, 3.48, level);
    molding(out, plan, 4.86, 1.012, 0.27);
  }
  for (const plan of [west, east, frontEast, frontWest]) {
    mappedSolid(out, 'brick', plan, 2.35, 20.12, rust);
    bays(out, plan, 3.4, 18.46, 4, 3.35, level);
    molding(out, plan, 18.97, 1.012, 0.32);
    molding(out, plan, 19.83, 1.022, 0.42);
    mappedSolid(out, 'copper', resize(plan, 0.975), 20.22, 20.39, green);
  }
  hotelEntrance(out, level);
  mappedSolid(out, 'brick', plinth, 2.29, 25.77, rust);
  bays(out, plinth, 21.0, 25.08, 1, 4.05, level);
  molding(out, plinth, 25.6, 1.032, 0.48);
  mappedSolid(out, 'limestone', resize(plinth, 0.97), 26.02, 29.25, cream);
  molding(out, plinth, 28.95, 0.99, 0.52);
  mappedSolid(out, 'brick', shaft, 29.44, 90.65, rust);
  bays(out, shaft, 30.8, 86.45, 15, 4.99, level);
  molding(out, shaft, 29.38, 1.033, 0.48);
  corniceCrown(out, level);
  roofLantern(out, level);
}

function buildDistance(out, district) {
  mappedSolid(out, 'granite', footprint, -2.5, 2.35, granite);
  for (const plan of [annexEast, annexWest]) {
    mappedSolid(out, 'limestone', plan, 2.35, 5.0, cream);
  }
  for (const plan of [west, east, frontEast, frontWest]) {
    mappedSolid(out, district ? 'brick' : 'limestone', plan, 2.35, 20.39, district ? rust : cream);
    if (district) bays(out, plan, 3.4, 18.46, 4, 3.35, 1);
  }
  hotelEntrance(out, district ? 1 : 0);
  mappedSolid(out, 'limestone', plinth, 2.35, 29.55, cream);
  mappedSolid(out, 'brick', shaft, 29.44, 90.65, rust);
  if (district) bays(out, shaft, 30.8, 86.45, 15, 4.99, 1);
  else {
    for (const [index, a] of shaft.entries()) {
      const { panel, length } = edgeFrame(out, a, shaft[(index + 1) % shaft.length]);
      for (let bay = 0; bay <= 6; bay++) {
        const x = 0.17 + (bay * (length - 1.3)) / 6;
        panel('limestone', x, 29.46, x + 0.99, 90.64, 0.14, cream);
      }
    }
  }
  molding(out, shaft, 89.58, 1.049, 1.6);
  mappedSolid(out, 'limestone', resize(shaft, 0.89), 91.14, 93.02, cream);
  for (const [x, z] of resize(shaft, 0.92)) {
    const rings = [
      [0, 0.7],
      [1.3, 0.45],
      [5.2, 0.04],
    ].map(([h, r]) => radialRing(90.9 + h, r, r, 4, [x, z], Math.PI / 4));
    loft(out, 'limestone', rings, highlight);
  }
  mappedSolid(out, 'limestone', crown, 92.8, 106.55, cream);
  mappedSolid(out, 'limestone', lantern, 106.51, 119.8, cream);
  mappedSolid(out, 'limestone', spireSeat, 119.76, 122.04, highlight);
  for (const plan of [crown, lantern]) {
    for (const [index, a] of plan.entries()) {
      const edge = edgeFrame(out, a, plan[(index + 1) % plan.length]);
      const width = edge.length;
      const [bottom, top] = plan === crown ? [95.35, 103.0] : [108.25, 117.4];
      edge.panel('glass', width * 0.34, bottom, width * 0.66, top, 0.14, blue);
    }
  }
  const roof = [
    [121.65, 2.43],
    [123, 1.88],
    [131.4, 0.51],
    [133.8, 0.14],
  ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, 'copper', roof, green);
  tube(out, 'brass', [0, 133.71, 0], [0, 136, 0], 0.106, gold, 6);
}
export const buildSkyline = (out) => buildDistance(out, false);
export const buildDistrict = (out) => buildDistance(out, true);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
