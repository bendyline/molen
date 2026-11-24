import {
  extrude,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  ribbon,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
};

const wall = rgb('a29a89');
const ash = rgb('b0a797');
const stone = rgb('aaa08f');
const darkStone = rgb('827c70');
const darkMetal = rgb('5c6059');
const windows = ['424847', '4b514b', '56544b'].map(rgb);
const shaft = outwardRing(site.shaft);
const outline = outwardRing(site.outline);

function panel(out, slot, F, u0, u1, y0, y1, d, color) {
  quad4(out, slot, F.P(u0, y0, d), F.P(u1, y0, d), F.P(u1, y1, d), F.P(u0, y1, d), color);
}

function edges(ring) {
  return ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
}

function windowBay(out, F, u, y, width, height, detail, pane) {
  const half = width / 2;
  panel(out, 'glass', F, u - half, u + half, y, y + height, 0.018, windows[pane % windows.length]);
  if (detail < 2) return;
  fbox(out, 'carved', F, u - half - 0.16, u + half + 0.16, y - 0.16, y + 0.015, 0, 0.26, ash);
  panel(
    out,
    'carved',
    F,
    u - half - 0.18,
    u + half + 0.18,
    y + height,
    y + height + 0.17,
    0.064,
    ash,
  );
  if (detail === 3) {
    panel(out, 'rail', F, u - 0.037, u + 0.037, y, y + height, 0.042, darkMetal);
    panel(
      out,
      'carved',
      F,
      u - half,
      u + half,
      y + 0.72 * height,
      y + 0.72 * height + 0.06,
      0.047,
      ash,
    );
  }
}

function base(out, detail) {
  extrude(out, 'base', outline, -2.8, 1.05, darkStone, { top: false });
  extrude(out, 'wall', outline, 1.05, site.shaftBase, wall, { top: false });
  cap(out, 'roof', outline, site.shaftBase, rgb('747d78'));
  // The low block has a shallow mansard above the rear wing.
  const eave = outwardRing([
    [-22.44, 0.2],
    [12.62, -2.21],
    [14.44, 28.48],
    [-20.05, 30.7],
  ]);
  const ridge = eave.map(([x, z]) => [-3 + (x + 3) * 0.83, 14 + (z - 14) * 0.79]);
  const roofY = site.shaftBase + 2.62;
  for (const [i, a] of eave.entries()) {
    const j = (i + 1) % eave.length;
    const b = eave[j];
    quad4(
      out,
      'roof',
      [a[0], site.shaftBase, a[1]],
      [b[0], site.shaftBase, b[1]],
      [ridge[j][0], roofY, ridge[j][1]],
      [ridge[i][0], roofY, ridge[i][1]],
      rgb('777f76'),
    );
  }
  cap(out, 'roof', ridge, roofY, rgb('858c80'));
  for (const [y, Y, d] of [
    [1.05, 1.35, 0.19],
    [7.1, 7.56, 0.28],
    [27.05, 27.5, 0.27],
    [31.14, 31.64, 0.48],
  ])
    ribbon(out, 'carved', outline, y, Y, ash, { offset: d });
  if (!detail) return;
  for (const F of edges(outline)) {
    const bays = Math.max(1, Math.round(F.length / 3.6));
    const step = F.length / bays;
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + 0.5) * step;
      if (step > 2.1) {
        const width = Math.min(step * 0.61, 2.45);
        panel(
          out,
          'glass',
          F,
          u - width / 2,
          u + width / 2,
          1.47,
          5.72,
          0.024,
          windows[bay % windows.length],
        );
        if (detail > 1)
          panel(
            out,
            'carved',
            F,
            u - width / 2 - 0.13,
            u + width / 2 + 0.13,
            5.72,
            6.02,
            0.13,
            ash,
          );
      }
      const floors =
        detail === 1 ? [8.1, 14.38, 20.64, 28.23] : [8.1, 11.25, 14.38, 17.51, 20.64, 23.77, 28.23];
      for (const [floor, y] of floors.entries()) {
        windowBay(out, F, u, y, Math.min(1.56, step * 0.46), 1.77, detail, floor + bay);
      }
    }
  }
}

function balcony(out, F, u, y, width, depth, detail) {
  const count = [4, 6, 8, 12][detail];
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / count);
    return F.P(u + width * Math.cos(angle), 0, depth * Math.sin(angle) + 0.15);
  }).map(([x, , z]) => [x, z]);
  const [leftX, , leftZ] = F.P(u - width, 0, -0.09);
  const [rightX, , rightZ] = F.P(u + width, 0, -0.09);
  const plan = outwardRing([[leftX, leftZ], ...arc, [rightX, rightZ]]);
  extrude(out, 'carved', plan, y - 0.48, y, stone, { top: false });
  cap(out, 'carved', plan, y, stone);
  fan(
    out,
    'carved',
    plan
      .slice()
      .reverse()
      .map(([x, z]) => [x, y - 0.48, z]),
    darkStone,
  );
  for (let i = 0; i < count; i++) {
    const f = wallFace(arc[i], arc[i + 1]);
    panel(out, 'carved', f, 0, f.length, y + 0.63, y + 0.81, 0, ash);
    if (detail > 1) {
      for (const fraction of [0.24, 0.71]) {
        const a = f.length * fraction;
        const half = Math.min(0.045, f.length * 0.13);
        panel(out, 'rail', f, a - half, a + half, y + 0.03, y + 0.64, 0, darkMetal);
      }
    } else {
      panel(out, 'rail', f, 0, f.length, y + 0.06, y + 0.64, 0, darkMetal);
    }
  }
}

function archBand(out, F, width, y, spring, rise, detail, large) {
  const mid = F.length / 2;
  const divisions = [4, 8, 12, 16][detail];
  const glass = windows[0];
  for (let i = 0; i < divisions; i++) {
    const a = Math.PI * (1 - i / divisions);
    const b = Math.PI * (1 - (i + 1) / divisions);
    const p = (t, r, d) =>
      F.P(mid + (width + r) * Math.cos(t), spring + (rise + r) * Math.sin(t), d);
    const u0 = mid + width * Math.cos(a),
      u1 = mid + width * Math.cos(b);
    quad4(
      out,
      'glass',
      F.P(u0, y, 0.023),
      F.P(u1, y, 0.023),
      p(b, 0, 0.023),
      p(a, 0, 0.023),
      glass,
    );
    const t = large ? 0.56 : 0.27;
    quad4(out, 'carved', p(a, 0, 0.22), p(b, 0, 0.22), p(b, t, 0.22), p(a, t, 0.22), ash);
    if (detail > 0)
      quad4(out, 'carved', p(a, 0, 0.025), p(b, 0, 0.025), p(b, 0, 0.22), p(a, 0, 0.22), darkStone);
  }
  const jamb = large ? 0.51 : 0.29;
  fbox(out, 'carved', F, mid - width - jamb, mid - width, y, spring, 0, 0.22, stone);
  fbox(out, 'carved', F, mid + width, mid + width + jamb, y, spring, 0, 0.22, stone);
  if (!detail) return;
  for (const fraction of large ? [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75] : [0]) {
    const u = mid + fraction * width;
    const top = spring + rise * Math.sqrt(1 - fraction * fraction);
    panel(out, 'carved', F, u - 0.09, u + 0.09, y, top, 0.079, stone);
  }
  if (large)
    panel(out, 'carved', F, mid - width, mid + width, spring - 0.28, spring - 0.11, 0.102, ash);
}

function squareTower(out, detail) {
  extrude(out, 'wall', shaft, site.shaftBase, site.upperBalcony, wall, { top: false });
  cap(out, 'carved', shaft, site.upperBalcony, ash);
  for (const [y, Y, d] of [
    [31.64, 32.04, 0.56],
    [42.23, 42.72, 0.36],
    [58.95, 59.49, 0.61],
    [59.49, 59.95, 0.81],
  ])
    ribbon(out, 'carved', shaft, y, Y, stone, { offset: d });
  for (const F of edges(shaft)) {
    archBand(out, F, F.length * 0.355, 32.08, 36.01, 5.58, detail, true);
    if (!detail) continue;
    for (const [bay, fraction] of [0.12, 0.28, 0.43, 0.57, 0.72, 0.88].entries()) {
      const u = F.length * fraction;
      if (detail > 1) {
        const d = bay === 0 || bay === 5 ? 0.44 : 0.23;
        fbox(out, 'carved', F, u - 0.16, u + 0.16, 43.1, 58.89, 0, d, stone);
      }
      for (const [floor, y] of [43.24, 46.28, 49.32, 52.36, 55.4].entries()) {
        windowBay(out, F, u + F.length * 0.034, y, 0.91, 1.78, detail, bay + floor);
      }
    }
    for (const fraction of [0.23, 0.77]) {
      balcony(out, F, F.length * fraction, 42.72, 2.24, 0.93, detail);
      if (detail > 1) balcony(out, F, F.length * fraction, 59.94, 2.73, 1.06, detail);
    }
  }
  const center = site.spindle;
  const inset = shaft.map(([x, z]) => [
    center[0] + (x - center[0]) * 0.91,
    center[1] + (z - center[1]) * 0.91,
  ]);
  extrude(out, 'wall', inset, site.upperBalcony, 69.45, wall, { top: false });
  cap(out, 'carved', inset, 69.45, stone);
  for (const F of edges(inset)) {
    if (detail > 1) {
      for (const fraction of [0.32, 0.68]) {
        const span = F.length * 0.3;
        const u = F.length * fraction;
        const a = F.P(u - span / 2, 0);
        const b = F.P(u + span / 2, 0);
        archBand(
          out,
          wallFace([a[0], a[2]], [b[0], b[2]]),
          span * 0.34,
          61.45,
          65.29,
          1.49,
          detail,
          false,
        );
        balcony(out, F, u, 61.4, span * 0.44, 0.76, detail);
      }
    }
  }
  ribbon(out, 'carved', inset, 68.86, 69.45, ash, { offset: 0.38 });
}

function turret(out, center, detail) {
  const n = [6, 8, 12, 16][detail];
  const body = [
    [56.94, 0.79],
    [57.4, 1.32],
    [58.1, 1.38],
    [59.2, 1.87],
    [59.94, 2.43],
    [60.57, 2.5],
    [61.14, 2.12],
    [66.61, 2.07],
    [66.86, 2.31],
    [67.31, 2.31],
    [67.74, 1.99],
    [71.24, 1.87],
  ];
  const dome = [
    [71.19, 1.88],
    [72.18, 1.88],
    [73.81, 1.66],
    [75.46, 1.19],
    [76.63, 0.55],
    [77.2, 0.13],
    [77.39, 0.065],
  ];
  const simple = (profile) => profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1);
  const circular = (profile) => (detail > 1 ? profile : simple(profile)).map(([y, r]) => [y, r, r]);
  lathe(out, 'carved', center, circular(body), n, stone);
  lathe(out, 'carved', center, circular(dome), n, ash);
  if (!detail) return;
  const ring = outwardRing(
    Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n;
      return [center[0] + 2.105 * Math.cos(angle), center[1] + 2.105 * Math.sin(angle)];
    }),
  );
  for (const [i, F] of edges(ring).entries()) {
    if (i % (n / 4)) continue;
    windowBay(out, F, F.length / 2, 62.52, 0.69, 2.38, detail, i);
    const A = F.P(0, 0, -0.224),
      B = F.P(F.length, 0, -0.224);
    const upper = wallFace([A[0], A[2]], [B[0], B[2]]);
    opening(out, upper, upper.length / 2, 68.43, 0.63, 1.85, {
      head: 'round',
      glass: windows[1],
      frameSlot: 'carved',
      frame: stone,
      frameWidth: detail > 2 ? 0.09 : 0,
      frameDepth: 0.13,
      sill: false,
    });
  }
}

function crown(out, detail) {
  const profile = [
    [67.55, 4.02],
    [69.23, 5.69],
    [69.93, 5.69],
    [70.43, 5.22],
    [78.63, 5.17],
    [79.12, 5.58],
    [79.71, 5.58],
    [80.31, 4.7],
    [87.38, 4.52],
    [87.87, 5.16],
    [88.24, 5.16],
  ];
  const rim = [
    [88.05, 5.12],
    [88.76, 5.1],
    [90.21, 4.94],
    [92.62, 4.59],
    [94.36, 3.89],
    [94.81, 3.47],
    [95, 3.25],
  ];
  const n = [8, 12, 16, 24][detail];
  const scale = (p) =>
    (detail ? p : p.filter((_, i) => i % 2 === 0 || i === p.length - 1)).map(([y, r]) => [
      y,
      r,
      r * 1.014,
    ]);
  lathe(out, 'wall', site.spindle, scale(profile), n, stone);
  lathe(out, 'carved', site.spindle, scale(rim), n, ash);
  if (!detail) return;
  const ring = (radius) =>
    outwardRing(
      Array.from({ length: n }, (_, i) => {
        const angle = (i * 2 * Math.PI) / n;
        return [
          site.spindle[0] + radius * Math.cos(angle),
          site.spindle[1] + radius * 1.014 * Math.sin(angle),
        ];
      }),
    );
  for (const [i, F] of edges(ring(5.21)).entries()) {
    if (i % (detail === 3 ? 3 : 2)) continue;
    archBand(out, F, Math.min(F.length * 0.33, 0.67), 72.24, 76.07, 1.69, detail, false);
    if (detail > 1)
      balcony(out, F, F.length / 2, 72.24, Math.min(0.83, F.length * 0.43), 0.62, detail);
  }
  for (const [i, F] of edges(ring(4.65)).entries()) {
    if (i % (detail === 3 ? 3 : 2)) continue;
    windowBay(out, F, F.length / 2, 82.21, Math.min(0.98, F.length * 0.68), 2.61, detail, i);
    if (detail > 1)
      balcony(out, F, F.length / 2, 81.97, Math.min(1.02, F.length * 0.47), 0.62, detail);
  }
  if (detail < 2) return;
  for (const [i, F] of edges(ring(4.96)).entries()) {
    if (i % (detail === 3 ? 3 : 2)) continue;
    const u = F.length / 2;
    const w = Math.min(0.5, F.length * 0.32);
    const p = (a, r, d) => F.P(u + (w + r) * Math.cos(a), 89.13 + (0.45 + r) * Math.sin(a), d);
    for (let segment = 0; segment < 6; segment++) {
      const a = Math.PI * (1 - segment / 6),
        b = Math.PI * (1 - (segment + 1) / 6);
      quad4(out, 'carved', p(a, 0, 0.167), p(b, 0, 0.167), p(b, 0.14, 0.23), p(a, 0.14, 0.23), ash);
    }
    panel(out, 'carved', F, u - w - 0.14, u + w + 0.14, 88.74, 88.88, 0.215, darkStone);
    const lower = F.P(F.length / 2, 88.87, 0.18);
    const middle = F.P(F.length / 2, 91.71, -0.14);
    const upper = F.P(F.length / 2, 94.36, -0.96);
    const rib = (p) => [
      [p[0] - F.along[0] * 0.12, p[1], p[2] - F.along[1] * 0.12],
      [p[0] + F.along[0] * 0.12, p[1], p[2] + F.along[1] * 0.12],
    ];
    const [a, b] = rib(lower),
      [c, d] = rib(middle),
      [e, f] = rib(upper);
    quad4(out, 'carved', a, b, d, c, stone);
    quad4(out, 'carved', c, d, f, e, ash);
  }
}

function build(out, detail) {
  base(out, detail);
  squareTower(out, detail);
  for (const center of site.turrets) turret(out, center, detail);
  crown(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
