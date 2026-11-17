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

const site = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = new Map(site.parts.map((p) => [p.id, { ...p, plan: clockwise(p.polygons[0][0]) }]));
const part = (id) => parts.get(52776562022000 + id);
const base = 'stone',
  wall = 'ashlar',
  metal = 'roof';
const buff = [0.82, 0.73, 0.58],
  ivory = [0.91, 0.85, 0.71],
  rose = [0.53, 0.42, 0.36];
const granite = [0.61, 0.59, 0.56],
  zinc = [0.35, 0.39, 0.43],
  blue = [0.072, 0.121, 0.163],
  bronze = [0.55, 0.41, 0.24];

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_granite' },
  ashlar: { slot: 'wall', graph: 'stone_limestone' },
  roof: { slot: 'roof', graph: 'metal_painted' },
  alloy: { slot: 'trim', graph: 'metal_copper' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', name: 'Blue-gray inset glazing' },
};

function rect(x0, x1, z0, z1) {
  return [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ];
}
function edges(plan) {
  return plan.map((a, i) => [a, plan[(i + 1) % plan.length]]);
}
function mid(plan) {
  return plan.reduce(([x, z], p) => [x + p[0] / plan.length, z + p[1] / plan.length], [0, 0]);
}
function scaled(plan, k) {
  const c = mid(plan);
  return plan.map((p) => p.map((v, i) => c[i] + (v - c[i]) * k));
}
function bounds(plan) {
  const x = plan.map((p) => p[0]),
    z = plan.map((p) => p[1]);
  return rect(Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z));
}
function edge(out, a, b) {
  const n = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / n,
    dz = (b[1] - a[1]) / n;
  const p = (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d];
  const panel = (slot, u0, y0, u1, y1, d, color) =>
    face(out, slot, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], color);
  const relief = (slot, u0, y0, u1, y1, d, color) => {
    panel(slot, u0, y0, u1, y1, d, color);
    face(out, slot, [p(u0, y0), p(u0, y0, d), p(u0, y1, d), p(u0, y1)], color);
    face(out, slot, [p(u1, y0, d), p(u1, y0), p(u1, y1), p(u1, y1, d)], color);
    face(out, slot, [p(u0, y1, d), p(u1, y1, d), p(u1, y1), p(u0, y1)], color);
  };
  return { n, p, panel, relief };
}

function capBand(out, plan, y, h, level) {
  mappedSolid(out, wall, scaled(plan, 1.017), y, y + h, ivory);
  if (level >= 2) mappedSolid(out, wall, scaled(plan, 1.03), y + h * 0.65, y + h * 1.11, ivory);
}

function curvedPane(out, f, x, y, half, spring, level) {
  const count = level === 3 ? 7 : 4,
    d = 0.19;
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / count);
    return [x + half * Math.cos(a), spring + half * 0.92 * Math.sin(a)];
  });
  for (let j = 1; j <= count; j++) {
    const [a, h0] = path[j - 1],
      [b, h1] = path[j];
    tri(out, 'glass', [f.p(x, spring, d), f.p(b, h1, d), f.p(a, h0, d)], blue);
    if (level === 3) {
      const outer = (u, h) => f.p(x + (u - x) * 1.12, spring + (h - spring) * 1.12, 0.246);
      face(out, wall, [f.p(a, h0, 0.246), f.p(b, h1, 0.246), outer(b, h1), outer(a, h0)], ivory);
    }
  }
  f.panel('glass', x - half, y, x + half, spring, d, blue);
}

function windows(out, plan, lo, hi, floors, pitch, level, { ribbed = false, bows = false } = {}) {
  const floor = (hi - lo) / floors;
  for (const [s, [a, b]] of edges(plan).entries()) {
    const f = edge(out, a, b);
    if (f.n < 3.2) continue;
    const count = Math.max(1, Math.round(f.n / pitch));
    const step = f.n / count;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * step,
        half = Math.min(step * 0.225, 0.8);
      if (level === 0) {
        f.panel(metal, x - half, lo, x + half, hi, 0.22, rose);
        continue;
      }
      if (ribbed || level === 3) {
        f.panel(metal, x - half - 0.11, lo - 0.03, x + half + 0.11, hi, 0.074, rose);
        const relief = level === 3 ? f.relief : f.panel;
        relief(
          wall,
          i * step + 0.12,
          lo - 0.56,
          i * step + (ribbed ? 0.73 : 0.38),
          hi + 0.36,
          ribbed ? 0.46 : 0.3,
          ivory,
        );
      }
      for (let j = 0; j < floors; j++) {
        const y = lo + (j + 0.19) * floor,
          high = y + floor * 0.58;
        const bowed =
          bows && level >= 2 && (j === floors - 1 || (level === 3 && ribbed && j % 3 === 1));
        if (bowed) {
          curvedPane(out, f, x, y, half, high - half * 0.52, level);
        } else {
          const tone = 0.014 * ((3 * s + 7 * j + 2 * i) % 5);
          f.panel(
            'glass',
            x - half,
            y,
            x + half,
            high,
            0.168,
            blue.map((v) => v + tone),
          );
        }
        if (level === 3 || (level === 2 && ribbed)) {
          if (!bowed) f.panel('alloy', x - 0.04, y, x + 0.04, high, 0.24, bronze);
          if (level === 3)
            f.panel(wall, x - half - 0.13, y - 0.11, x + half + 0.13, y, 0.27, ivory);
        }
      }
    }
  }
}

/** The roof pavilions have fluted urns above heavy stone drums. */
function urn(out, x, y, z, h, level) {
  const stages =
    level === 0
      ? [
          [0, 1.16],
          [0.28, 0.89],
          [0.74, 0.84],
          [1, 0.39],
        ]
      : [
          [0, 1.21],
          [0.09, 1.22],
          [0.12, 0.88],
          [0.33, 0.71],
          [0.41, 0.91],
          [0.63, 1.12],
          [0.72, 1.17],
          [0.8, 0.75],
          [0.88, 0.52],
          [1, 0.24],
        ];
  const rings = stages.map(([t, r]) =>
    radialRing(y + t * h, r, r, level === 3 ? 12 : 6, [x, z], Math.PI / 6),
  );
  loft(out, wall, rings, ivory);
  if (level >= 2) {
    for (const sign of [-1, 1]) {
      beamPath(
        out,
        wall,
        [
          [x + sign * 0.81, y + 0.39 * h, z],
          [x + sign * 1.52, y + 0.53 * h, z],
          [x + sign * 1.41, y + 0.72 * h, z],
          [x + sign * 1.0, y + 0.76 * h, z],
        ],
        0.14,
        0.142,
        ivory,
      );
    }
  }
}

function pavilions(out, level) {
  for (const { id, plan, height, minHeight } of parts.values()) {
    if (id >= 52776562022820) continue;
    if (height === 60) {
      const [x, z] = mid(plan);
      mappedSolid(out, wall, plan, 53.98, 55.1, buff);
      urn(out, x, 55.0, z, 5.0, level === 1 ? 0 : level);
    } else {
      mappedSolid(out, wall, plan, minHeight - 0.08, height, buff);
      if (level >= 1) {
        const pitch = height === 54 ? 3.0 : 5.1;
        windows(
          out,
          plan,
          minHeight + 0.72,
          height - 0.64,
          height === 54 ? 3 : 2,
          pitch,
          level === 1 ? 0 : level,
          {
            bows: true,
          },
        );
        if (level >= 2) capBand(out, plan, height - 0.6, 0.72, level);
      }
    }
  }
}

function lodWings(out, level) {
  for (const id of [821, 835]) {
    mappedSolid(out, base, part(id).plan, -12.5, 4.25, granite);
  }
  const low = [
    840, 841, 842, 843, 845, 846, 847, 848, 849, 850, 851, 852, 853, 854, 855, 856, 857, 858, 861,
    862, 867, 868,
  ];
  for (const id of low) {
    const { plan, height, minHeight } = part(id);
    const p = level === 0 && plan.length > 10 ? bounds(plan) : plan;
    const bottom = minHeight > 0 ? minHeight : -12.5;
    mappedSolid(out, wall, p, bottom, height, buff);
    if (level >= 1 && height - bottom > 13) {
      const patterned = level >= 2 ? level : 0;
      const lo = Math.max(3.7, bottom + 0.3),
        hi = height - 0.8;
      const windowsCount = Math.max(1, Math.round((hi - lo) / 3.58));
      windows(out, plan, lo, hi, windowsCount, level === 3 ? 3.8 : 5.1, patterned, {
        bows: level === 3 && height === 42,
        ribbed: level === 3 && height === 42,
      });
      if (level >= 2) capBand(out, plan, height - 0.38, 0.54, 0);
    }
  }
  if (level >= 1) {
    for (const id of [836, 837, 838, 839, 860, 863, 865, 866]) {
      const { plan, height, minHeight } = part(id);
      mappedSolid(out, height === 6 ? metal : base, plan, minHeight || -9, height, granite);
    }
  }
}

function roofPedestal(out, level) {
  mappedSolid(out, base, part(859).plan, -11.0, 5.95, granite);
  const levels = [
    [859, 5.87, 36, 8],
    [832, 35.96, 68, 8],
    [829, 67.9, 100, 8],
    [828, 99.97, 120, 4],
    [831, 119.97, 124, 1],
    [833, 123.96, 132, 2],
  ];
  for (const [id, y0, y1, floors] of levels) {
    const { plan } = part(id);
    mappedSolid(out, wall, plan, y0, y1, buff);
    if (level >= 1) {
      windows(
        out,
        plan,
        y0 + 0.46,
        y1 - 0.96,
        floors,
        level === 1 ? 4.7 : 3.43,
        level === 1 && id !== 829 ? 0 : level,
        {
          ribbed: true,
          bows: id !== 859,
        },
      );
      if (level >= 2) capBand(out, plan, y1 - 0.73, 0.85, level);
    }
  }
  const collar = [
    [131.96, 4.64],
    [136.6, 4.62],
    [140.1, 3.82],
    [144.1, 3.69],
    [148, 3.45],
    [152.2, 3.2],
  ];
  loft(
    out,
    wall,
    collar.map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    ivory,
  );
  if (level >= 1) {
    const p = radialRing(0, 4.55, 4.55, 8, [0, 0], Math.PI / 8).map(([x, , z]) => [x, z]);
    windows(out, p, 133.1, 139.1, 1, 2.6, level, { bows: true });
  }
}

function spire(out, level) {
  const profiles =
    level === 0
      ? [
          [150, 3.42],
          [172, 1.77],
          [202.6, 0.17],
        ]
      : [
          [150, 3.42],
          [151.7, 3.27],
          [155, 3.07],
          [161, 2.51],
          [172, 1.77],
          [189.2, 0.78],
          [202.6, 0.17],
        ];
  const rings = profiles.map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, metal, rings, zinc);
  tube(out, 'alloy', [0, 202.45, 0], [0, 205.02, 0], 0.11, bronze, 6);
  if (level === 0) {
    tube(out, 'alloy', [0, 204.81, 0], [0, 206, 0], 0.38, bronze, 6);
    return;
  }
  if (level >= 2)
    for (const i of [0, 2, 4, 6]) {
      beamPath(
        out,
        metal,
        rings.map((q) => [1.029 * q[i][0], q[i][1], 1.029 * q[i][2]]),
        0.06,
        0.06,
        [0.48, 0.51, 0.53],
      );
    }
  for (const axis of [0, 2]) {
    const star = Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI * (0.5 + i / 5),
        r = i % 2 === 0 ? 1.15 : 0.41,
        p = [0, 204.86 + r * Math.sin(a), 0];
      p[axis] = r * Math.cos(a);
      return p;
    });
    beamPath(out, 'alloy', star, 0.071, 0.069, [0.69, 0.52, 0.26], true);
  }
}

function forecourt(out, level) {
  const terrace = part(834).plan;
  const rear = part(864).plan;
  const landingY = 3.58;
  mappedSolid(out, base, level === 0 ? rect(-43, 43, 12, 26) : terrace, -13, 0.015, granite);
  for (const platform of [
    rect(-42.4, -10.9, 18, 28),
    rect(10.9, 42.4, 18, 28),
    rect(-10.9, 10.9, 18, 22),
  ]) {
    mappedSolid(out, base, platform, -0.04, landingY, granite);
  }
  mappedSolid(out, base, level === 0 ? rect(-42, 42, -38, -16) : rear, -12, 7.75, granite);
  // Carry the terrain's crossfall to the start of the level entrance landing.
  const grade = site.arrivalProfile.map(({ z, elevationMeters, edgeElevationsMeters }) => {
    const [left, right] = edgeElevationsMeters;
    return { z, heights: [left, elevationMeters, right].map((y) => y + 0.035) };
  });
  grade.push({ z: 30, heights: [landingY, landingY, landingY] });
  grade.push({ z: 22, heights: [landingY, landingY, landingY] });
  const lanes = [-10.9, 0, 10.9];
  const skirtY = -1.1;
  for (let i = 1; i < grade.length; i++) {
    const { z: z0, heights: near } = grade[i - 1];
    const { z: z1, heights: far } = grade[i];
    const [left, , right] = lanes;
    for (let lane = 0; lane < lanes.length - 1; lane++) {
      face(
        out,
        base,
        [
          [lanes[lane], far[lane], z1],
          [lanes[lane], near[lane], z0],
          [lanes[lane + 1], near[lane + 1], z0],
          [lanes[lane + 1], far[lane + 1], z1],
        ],
        granite,
      );
    }
    face(
      out,
      base,
      [
        [left, skirtY, z1],
        [left, skirtY, z0],
        [left, near[0], z0],
        [left, far[0], z1],
      ],
      granite,
    );
    face(
      out,
      base,
      [
        [right, skirtY, z0],
        [right, skirtY, z1],
        [right, far[2], z1],
        [right, near[2], z0],
      ],
      granite,
    );
  }
  mappedSolid(out, wall, rect(-10.1, 10.1, 19.1, 29.1), 2.53, 13.9, buff);
  const f = edge(out, [-10.1, 29.1], [10.1, 29.1]);
  for (const x of [3.42, 10.1, 16.88]) {
    f.panel('alloy', x - 2.08, landingY, x + 2.08, 9.7, 0.06, bronze);
    f.panel('glass', x - 1.77, landingY + 0.13, x + 1.77, 9.35, 0.14, blue);
    if (level >= 1) {
      for (const d of [-0.85, 0, 0.85])
        f.panel('alloy', x + d - 0.055, landingY + 0.13, x + d + 0.055, 9.35, 0.22, bronze);
    }
  }
  const canopy = rect(-13.8, 13.8, 28.79, 46.92);
  mappedSolid(out, metal, canopy, 10.18, 10.89, zinc);
  if (level >= 1) {
    mappedSolid(out, wall, rect(-10.5, 10.5, 22.4, 31.25), 13.44, 14.05, ivory);
    for (const [x, z, y] of [
      [-10.72, 34.6, 0.94],
      [10.72, 34.6, 2.62],
      [-10.72, 42.7, 0.19],
      [10.72, 42.7, 1.75],
    ]) {
      box(out, base, [x - 0.4, y, z - 0.4], [x + 0.4, y + 0.83, z + 0.4], granite);
      tube(out, 'alloy', [x, y + 0.72, z], [x, 10.3, z], 0.28, bronze, level === 3 ? 12 : 6);
    }
  }
  if (level >= 2) {
    for (const z of [30.2, 33.1, 36.2, 39.3, 42.6, 45.6]) {
      box(out, 'alloy', [-13.5, 10.05, z - 0.062], [13.5, 10.21, z + 0.062], bronze);
    }
  }
}

function build(out, level) {
  forecourt(out, level);
  lodWings(out, level);
  pavilions(out, level);
  roofPedestal(out, level);
  spire(out, level);
}

export function buildSkyline(out) {
  forecourt(out, 0);
  for (const id of [821, 835, 840, 841, 846, 849, 852, 853, 857, 858, 867, 868]) {
    const { plan, height } = part(id);
    mappedSolid(out, wall, id === 821 || id === 835 ? plan : bounds(plan), -12.5, height, buff);
  }
  for (const [id, y0, y1] of [
    [859, 0.1, 36],
    [832, 35.96, 68],
    [829, 67.9, 100],
    [828, 99.97, 120],
    [833, 119.98, 132],
  ]) {
    const { plan } = part(id);
    mappedSolid(out, wall, bounds(plan), y0, y1, buff);
    if (id === 832 || id === 829) windows(out, bounds(plan), y0 + 0.48, y1 - 0.57, 1, 5.4, 0);
  }
  for (const { id, plan, height, minHeight } of parts.values()) {
    if (id >= 52776562022820 || height === 60) continue;
    mappedSolid(out, wall, plan, minHeight - 0.08, height === 54 ? 59.7 : height, buff);
  }
  const rings = [
    [131.99, 4.64],
    [138.1, 4.35],
    [150.7, 3.22],
  ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8));
  loft(out, wall, rings, ivory);
  spire(out, 0);
}

export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
