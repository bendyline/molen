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

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = new Map(frame.parts.map((p) => [p.id, { ...p, plan: clockwise(p.polygons[0][0]) }]));
const relation = (id) => parts.get(52776562014000 + id);
const modeled = [512, 514, 524, 531, 532, 536, 540, 541, 542, 545, 546, 548, 549, 550, 551, 557];
const shaft = relation(513).plan;
const wings = [relation(554).plan, relation(555).plan];
const crestShaft = parts.get(35184664267394).plan;
const crown = relation(556).plan;
const stone = [0.72, 0.6, 0.42],
  pale = [0.91, 0.82, 0.64],
  trim = [0.97, 0.88, 0.7];
const granite = [0.56, 0.51, 0.45],
  bronze = [0.45, 0.3, 0.18],
  silver = [0.31, 0.34, 0.37];
const glass = [0.079, 0.116, 0.14],
  roof = [0.38, 0.4, 0.42];

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone' },
  base: { slot: 'foundation', graph: 'stone_granite' },
  enamel: { slot: 'roof', graph: 'metal_painted' },
  alloy: { slot: 'trim', graph: 'metal_copper' },
  pane: { slot: 'window', localRef: 'palette:#ffffff', name: 'Blue-gray glazing' },
};

function edges(plan) {
  return plan.map((a, i) => [a, plan[(i + 1) % plan.length]]);
}
function center(plan) {
  return plan.reduce(([x, z], p) => [x + p[0] / plan.length, z + p[1] / plan.length], [0, 0]);
}
function resized(plan, scale) {
  const c = center(plan);
  return plan.map((p) => p.map((v, i) => c[i] + (v - c[i]) * scale));
}
function envelope(plan) {
  const x = plan.map((p) => p[0]),
    z = plan.map((p) => p[1]);
  const l = Math.min(...x),
    r = Math.max(...x),
    b = Math.min(...z),
    f = Math.max(...z);
  return [
    [l, b],
    [l, f],
    [r, f],
    [r, b],
  ];
}
function facade(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const at = (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d];
  const panel = (slot, left, bottom, right, top, d, color) =>
    face(
      out,
      slot,
      [at(left, bottom, d), at(right, bottom, d), at(right, top, d), at(left, top, d)],
      color,
    );
  const relief = (slot, left, bottom, right, top, d, color) => {
    panel(slot, left, bottom, right, top, d, color);
    face(
      out,
      slot,
      [at(left, bottom), at(left, bottom, d), at(left, top, d), at(left, top)],
      color,
    );
    face(
      out,
      slot,
      [at(right, bottom, d), at(right, bottom), at(right, top), at(right, top, d)],
      color,
    );
    face(out, slot, [at(left, top, d), at(right, top, d), at(right, top), at(left, top)], color);
  };
  return { at, panel, relief, length };
}

function cornice(out, plan, y, level, h = 0.63) {
  mappedSolid(out, 'ashlar', resized(plan, 1.014), y, y + h, trim);
  if (level >= 2)
    mappedSolid(out, 'ashlar', resized(plan, 1.024), y + h * 0.69, y + h * 1.14, trim);
}

function sashWall(
  out,
  plan,
  low,
  high,
  floors,
  pitch,
  level,
  { ribs = false, crest = false } = {},
) {
  const countSlope = (high - low) / floors;
  for (const [side, [a, b]] of edges(plan).entries()) {
    const f = facade(out, a, b);
    if (f.length < 3.4) continue;
    const n = Math.max(1, Math.round(f.length / pitch));
    const step = f.length / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * step;
      if (crest && a[1] > 8 && b[1] > 8 && Math.abs(u - f.length / 2) < 5.25) continue;
      const half = Math.min(step * 0.23, 0.81);
      if (level === 0) {
        f.panel('enamel', u - half, low, u + half, high, 0.165, [0.46, 0.38, 0.3]);
        continue;
      }
      if (ribs || level === 3) {
        f.panel('enamel', u - half - 0.1, low, u + half + 0.1, high, 0.086, [0.51, 0.41, 0.29]);
        const rib = level === 3 ? f.relief : f.panel;
        rib(
          'ashlar',
          i * step + 0.13,
          low - 0.72,
          i * step + (ribs ? 0.67 : 0.43),
          high + 0.81,
          ribs ? 0.62 : 0.3,
          trim,
        );
      }
      for (let j = 0; j < floors; j++) {
        const y = low + (j + 0.19) * countSlope,
          top = y + countSlope * 0.53;
        const tint = ((3 * i + 5 * j + side) % 9) * 0.009;
        f.panel(
          'pane',
          u - half,
          y,
          u + half,
          top,
          0.164,
          glass.map((v) => v + tint),
        );
        if (level === 3 || (level === 2 && ribs)) {
          if (level === 3)
            f.panel('ashlar', u - half - 0.07, y - 0.12, u + half + 0.07, y, 0.219, trim);
          f.panel('alloy', u - 0.037, y, u + 0.037, top, 0.22, bronze);
        }
        if (level === 3 && ribs) {
          f.panel(
            'alloy',
            u - half,
            y + countSlope * 0.35,
            u + half,
            y + countSlope * 0.35 + 0.044,
            0.232,
            bronze,
          );
        }
      }
    }
  }
}

function reliefRosette(out, f, u, y, r, level) {
  tube(
    out,
    'ashlar',
    f.at(u, y, 0.23),
    f.at(u, y, 0.53),
    r,
    [0.78, 0.66, 0.48],
    level === 3 ? 24 : 12,
  );
  tube(out, 'ashlar', f.at(u, y, 0.49), f.at(u, y, 0.72), r * 0.58, trim, level === 3 ? 24 : 12);
  if (level >= 2) {
    const n = level === 3 ? 28 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.18 + (i / (n - 1)) * 1.64);
      const x = u + 0.81 * r * Math.cos(a),
        h = y + 0.78 * r * Math.sin(a);
      tube(out, 'ashlar', f.at(x, h, 0.51), f.at(x, h, 0.65), r * 0.108, pale, 6);
    }
    for (const [u0, y0, u1, y1] of [
      [-0.22, -0.19, 0.25, 0.18],
      [-0.17, 0.14, -0.3, 0.26],
      [0.12, -0.2, 0.26, -0.05],
    ]) {
      beamPath(
        out,
        'ashlar',
        [f.at(u + u0 * r, y + y0 * r, 0.77), f.at(u + u1 * r, y + y1 * r, 0.77)],
        r * 0.11,
        r * 0.085,
        pale,
      );
    }
  }
}

function gradeAtPortico(x) {
  const samples = frame.stairToeProfile;
  const index = samples.findIndex(([station]) => station >= x);
  if (index < 0) return samples.at(-1)[1];
  if (index === 0) return samples[0][1];
  const [left, lo] = samples[index - 1],
    [right, hi] = samples[index];
  return lo + ((hi - lo) * (x - left)) / (right - left);
}

function steps(out, halfWidth, front, y) {
  const z = 19.6;
  const point = (x, height, depth) => [x, height + gradeAtPortico(x), depth];
  const top = (x, z) => point(x, y, z);
  const bottom = (x, z) => point(x, -1.23, z);
  for (const [a, b] of [
    [-halfWidth, 0],
    [0, halfWidth],
  ]) {
    face(out, 'base', [top(a, z), top(a, front), top(b, front), top(b, z)], granite);
    face(out, 'base', [bottom(a, front), bottom(b, front), top(b, front), top(a, front)], granite);
    face(out, 'base', [bottom(b, z), bottom(a, z), top(a, z), top(b, z)], granite);
  }
  const a = -halfWidth,
    b = halfWidth;
  face(out, 'base', [bottom(a, z), bottom(a, front), top(a, front), top(a, z)], granite);
  face(out, 'base', [bottom(b, front), bottom(b, z), top(b, z), top(b, front)], granite);
}

function portico(out, level) {
  const plan = relation(512).plan;
  for (const id of [517, 520, 522]) {
    const p = relation(id).plan;
    const [a, b] = edges(p).reduce((prev, e) =>
      e[0][1] + e[1][1] > prev[0][1] + prev[1][1] ? e : prev,
    );
    const f = facade(out, a, b),
      u = f.length / 2;
    const rise = gradeAtPortico(f.at(u, 0)[0]);
    mappedSolid(out, 'ashlar', p, -1.15, 12, pale);
    f.panel('alloy', u - 1.49, 1.08 + rise, u + 1.49, 6.02 + rise, 0.16, bronze);
    f.panel('pane', u - 1.29, 1.46 + rise, u + 1.29, 5.72 + rise, 0.265, glass);
    if (level >= 1) {
      f.relief('base', u - 1.9, 0.9 + rise, u - 1.43, 8.02, 0.39, granite);
      f.relief('base', u + 1.43, 0.9 + rise, u + 1.9, 8.02, 0.39, granite);
      f.relief('base', u - 1.93, 6.08 + rise, u + 1.93, 6.53 + rise, 0.51, granite);
      for (const dx of [-0.94, -0.48, 0, 0.48, 0.94])
        f.panel('alloy', u + dx - 0.065, 1.43 + rise, u + dx + 0.065, 5.75 + rise, 0.319, bronze);
      if (level >= 2) reliefRosette(out, f, u, 8.73, 0.74, level);
    }
  }
  const risers = level === 0 ? [0, 3] : [0, 1, 2, 3];
  for (const n of risers) {
    steps(out, 12.55 - 0.24 * n, 24.73 - 0.91 * n, 0.07 + n * 0.32);
  }
  if (level >= 2) cornice(out, plan, 9.7, level, 1.12);
}

/** Glazed arch in each low connector beside the central shaft. */
function recessedArch(out, plan, y, xBias, level) {
  const [a, b] =
    edges(plan).find(([a, b]) => a[1] > 8 && b[1] > 8 && Math.abs(b[0] - a[0]) > 7) ??
    edges(plan).reduce((best, e) => (e[0][1] + e[1][1] > best[0][1] + best[1][1] ? e : best));
  const f = facade(out, a, b),
    mid = Math.min(f.length - 1.7, Math.max(1.7, f.length / 2 + xBias));
  if (f.length < 3.5) return;
  const r = 1.46,
    spring = y + 2.14;
  f.panel('pane', mid - r, y - 0.08, mid + r, spring, 0.149, glass);
  const n = level === 3 ? 14 : 8;
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI * (1 - i / n);
    return [mid + r * Math.cos(t), spring + r * Math.sin(t)];
  });
  for (let i = 1; i < arch.length; i++) {
    const [u0, h0] = arch[i - 1],
      [u1, h1] = arch[i];
    const p = [f.at(u0, spring, 0.149), f.at(u1, spring, 0.149)];
    if (i < n) p.push(f.at(u1, h1, 0.149));
    if (i > 1) p.push(f.at(u0, h0, 0.149));
    if (p.length === 3) tri(out, 'pane', p, glass);
    else face(out, 'pane', p, glass);
  }
  const trimLine = [[mid - r, y], ...arch, [mid + r, y]];
  beamPath(
    out,
    'ashlar',
    trimLine.map(([u, y]) => f.at(u, y, 0.305)),
    0.24,
    0.17,
    trim,
  );
}

function precinct(out, level) {
  for (const id of modeled) {
    const part = relation(id);
    const { plan, height } = part;
    const low = id === 512 ? -4 : -13.6;
    const distant = level === 0 && plan.length > 13 && id !== 557 && id !== 524;
    const scope = distant ? envelope(plan) : plan;
    mappedSolid(out, id === 512 ? 'base' : 'ashlar', scope, low, height, stone);
    if (height > 18 && level >= 2) {
      sashWall(
        out,
        plan,
        2.1,
        height - 1.2,
        Math.max(3, Math.round((height - 3.3) / 3.74)),
        4.24,
        level,
      );
      cornice(out, plan, height - 0.46, 1);
      mappedSolid(out, 'enamel', resized(plan, 0.958), height - 0.02, height + 0.15, roof);
    }
    if (level === 1 && height >= 23) sashWall(out, plan, 2.1, height - 0.54, 1, 6.1, 0);
  }
  if (level >= 1) {
    for (const id of [530, 535]) {
      const p = relation(id);
      mappedSolid(out, 'ashlar', p.plan, -9, p.height, stone);
    }
  }
  if (level === 3) {
    for (const id of [519, 523, 526, 529, 533, 534, 537, 538, 539, 543, 544, 552]) {
      const p = relation(id);
      mappedSolid(
        out,
        p.height <= 5 ? 'base' : 'ashlar',
        p.plan,
        p.minHeight || -8,
        p.height,
        stone,
      );
    }
  }
  portico(out, level);
}

function railCrown(out, plan, y, level) {
  for (const [a, b] of edges(plan)) {
    const f = facade(out, a, b);
    if (f.length < 3) continue;
    const n = Math.max(1, Math.round(f.length / (level === 3 ? 1.9 : 3.2)));
    const gap = f.length / n;
    f.panel('ashlar', 0, y, f.length, y + 1.25, 0.23, trim);
    for (let i = 0; i < n; i++) {
      const x = gap * (i + 0.5),
        cap = i % 3 === 0 ? 3.34 : 2.72,
        w = level === 3 ? 0.26 : 0.31;
      const rib = level === 3 ? f.relief : f.panel;
      rib('ashlar', x - w, y + 1.12, x + w, y + cap, 0.35, trim);
      tri(
        out,
        'ashlar',
        [f.at(x - w, y + cap, 0.35), f.at(x + w, y + cap, 0.35), f.at(x, y + cap + 0.55, 0.35)],
        trim,
      );
    }
  }
}

function shaftSpire(out, level) {
  const profile =
    level === 0
      ? [
          [136.94, 4.15],
          [147, 2.64],
          [162.1, 0.6],
          [171.96, 0.045],
        ]
      : [
          [136.94, 4.15],
          [140.12, 3.62],
          [144.86, 2.96],
          [151.7, 1.82],
          [162.1, 0.6],
          [165.2, 0.55],
          [166.55, 0.38],
          [168.05, 0.28],
          [171.96, 0.045],
        ];
  const rings = profile.map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, 'enamel', rings, silver);
  if (level >= 2) {
    for (const i of [0, 2, 4, 6]) {
      beamPath(
        out,
        'enamel',
        rings.map((r) => [r[i][0] * 1.024, r[i][1], r[i][2] * 1.024]),
        0.072,
        0.069,
        [0.72, 0.73, 0.72],
      );
    }
    const detail = [
      [
        [163.98, 0.61],
        [164.35, 0.71],
        [164.73, 0.6],
      ],
      [
        [166.16, 0.39],
        [166.43, 0.5],
        [166.69, 0.38],
      ],
    ];
    for (const band of detail)
      loft(
        out,
        'enamel',
        band.map(([y, r]) => radialRing(y, r, r, 8)),
        silver,
      );
  }
}

function mainTower(out, level) {
  mappedSolid(out, 'base', shaft, -13.6, 5.5, granite);
  mappedSolid(out, 'ashlar', shaft, 5.48, 97.2, stone);
  sashWall(out, shaft, 7.4, 95.48, level === 1 ? 15 : 21, level === 1 ? 5.0 : 3.59, level, {
    ribs: true,
  });
  cornice(out, shaft, 95.81, level, 1.24);
  for (const [index, plan] of wings.entries()) {
    mappedSolid(out, 'base', plan, -13.6, 4.36, granite);
    mappedSolid(out, 'ashlar', plan, 4.32, 58.61, stone);
    if (level >= 1)
      sashWall(out, plan, 5.57, 57.16, level === 1 ? 1 : 13, 4.5, level === 1 ? 0 : level);
    if (level >= 2) recessedArch(out, plan, 48.72, index === 0 ? 0.25 : -0.25, level);
    cornice(out, plan, 57.91, level, 0.77);
  }
  const pavilions = [35184664267353, 35184664267446, 35184664267465, 35184664267467];
  for (const id of pavilions) {
    const p = parts.get(id);
    mappedSolid(out, 'ashlar', p.plan, 58.48, 70, stone);
    if (level >= 1) sashWall(out, p.plan, 59.43, 67.82, 3, level === 1 ? 5.3 : 3.6, level);
    cornice(out, p.plan, 69.1, level, 0.83);
  }
  for (const id of [35184664267313, 35184664267344, 35184664267414, 35184664267437]) {
    const p = parts.get(id);
    mappedSolid(out, 'ashlar', p.plan, p.minHeight - 0.09, p.height, pale);
    if (level >= 1) sashWall(out, p.plan, p.minHeight + 0.61, p.height - 1.21, 2, 4.6, level);
  }
  mappedSolid(out, 'ashlar', crestShaft, 96.96, 120.07, pale);
  sashWall(out, crestShaft, 98.43, 117.91, 4, 4.05, level, { crest: true });
  const [a, b] = edges(crestShaft).reduce((prev, e) =>
    e[0][1] + e[1][1] > prev[0][1] + prev[1][1] ? e : prev,
  );
  const f = facade(out, a, b);
  reliefRosette(out, f, f.length / 2, 111.64, 4.67, level);
  cornice(out, crestShaft, 118.27, level, 1.64);
  if (level >= 1) railCrown(out, resized(crestShaft, 1.016), 119.61, level);
  mappedSolid(out, 'ashlar', crown, 119.95, 138.0, pale);
  cornice(out, relation(553).plan, 136.61, level, 1.22);
  if (level >= 1) {
    railCrown(out, relation(553).plan, 136.5, level);
    sashWall(out, crown, 123.04, 135.43, 2, 4.31, level);
  }
  shaftSpire(out, level);
}

function mapPinnacles(out, level) {
  const modeledIds = new Set([
    35184664267313, 35184664267344, 35184664267414, 35184664267437, 35184664267353, 35184664267446,
    35184664267465, 35184664267467, 35184664267394,
  ]);
  for (const p of parts.values()) {
    const { id, height, minHeight, plan } = p;
    if (id >= 52776562014510 || modeledIds.has(id)) continue;
    const tall = minHeight >= 97 && height >= 106;
    const shoulder = height >= 70 && height <= 75 && minHeight >= 58.5;
    const ledge = height >= 34 && height <= 38 && minHeight >= 30;
    if (level === 1 ? !tall || height < 128 : !tall && !shoulder && !(level === 3 && ledge))
      continue;
    const peak = tall || height === 75 || height === 38;
    const cap = peak ? Math.min(0.74, (height - minHeight) * 0.18) : 0;
    mappedSolid(out, 'ashlar', plan, minHeight - 0.035, height - cap, stone);
    if (peak) {
      const rings = [
        plan.map(([x, z]) => [x, height - cap, z]),
        resized(plan, 0.59).map(([x, z]) => [x, height, z]),
      ];
      loft(out, 'ashlar', rings, trim);
    }
  }
}

function build(out, level) {
  precinct(out, level);
  mainTower(out, level);
  mapPinnacles(out, level);
}
export function buildSkyline(out) {
  for (const id of [512, 514, 524, 531, 536, 540, 542, 545, 549, 550, 551, 557]) {
    const { plan, height } = relation(id);
    const shape = id === 524 || id === 557 ? plan.filter((_, i) => i % 2 === 0) : plan;
    mappedSolid(out, id === 512 ? 'base' : 'ashlar', shape, -13.6, height, stone);
  }
  const body = envelope(shaft);
  mappedSolid(out, 'ashlar', body, -13.6, 97.2, stone);
  sashWall(out, body, 7.4, 95.48, 1, 5.1, 0);
  for (const plan of wings) mappedSolid(out, 'ashlar', envelope(plan), -13.6, 58.61, stone);
  for (const id of [35184664267353, 35184664267446, 35184664267465, 35184664267467]) {
    const { plan } = parts.get(id);
    mappedSolid(out, 'ashlar', plan, 58.48, 71.6, stone);
  }
  for (const id of [35184664267313, 35184664267344, 35184664267414, 35184664267437]) {
    const { plan } = parts.get(id);
    mappedSolid(out, 'ashlar', plan, 97.05, 106.1, stone);
  }
  mappedSolid(out, 'ashlar', crestShaft, 96.96, 121.6, pale);
  mappedSolid(out, 'ashlar', resized(relation(553).plan, 1.56), 120.05, 138.1, pale);
  for (const [i, [x, z]] of resized(crestShaft, 0.91).entries()) {
    const rings = [
      radialRing(119.8, 1.07, 1.07, 4, [x, z]),
      radialRing(130.4 + i * 0.04, 0.19, 0.19, 4, [x, z]),
    ];
    loft(out, 'ashlar', rings, trim);
  }
  const [frontA, frontB] = edges(crestShaft).reduce((prev, e) =>
    e[0][1] + e[1][1] > prev[0][1] + prev[1][1] ? e : prev,
  );
  const f = facade(out, frontA, frontB);
  tube(
    out,
    'ashlar',
    f.at(f.length / 2, 111.64, 0.14),
    f.at(f.length / 2, 111.64, 0.51),
    4.65,
    trim,
    12,
  );
  shaftSpire(out, 0);
  portico(out, 0);
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
