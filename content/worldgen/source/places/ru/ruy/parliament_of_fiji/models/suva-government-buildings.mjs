import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.93 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67 },
};

const ashlar = rgb('aaa89c');
const pale = rgb('c2bdb0');
const shadow = rgb('8d8b80');
const steel = rgb('666e6d');
const brown = rgb('8f8170');
const glass = ['515958', '565d5c', '4a5352'].map(rgb);
const F = facade(site.frame.origin, site.frame.along);
const main = outwardRing(site.outline);
const chamber = outwardRing(site.chamber);

function rect(x, z, X, Z) {
  return outwardRing([
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ]);
}

function frontRect(u, v, U, V) {
  const ring = [
    [u, v],
    [U, v],
    [U, V],
    [u, V],
  ].map(([s, d]) => {
    const [x, , z] = F.P(s, 0, d);
    return [x, z];
  });
  return outwardRing(ring);
}

const edges = (ring) => ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), color);
}

function mass(out, slot, ring, y, Y, c, roofSlot = slot, roofColor = c) {
  extrude(out, slot, ring, y, Y, c, { top: false });
  cap(out, roofSlot, ring, Y, roofColor);
}

function windows(out, f, u, y, w, h, detail, accent = 0, wide = false) {
  panel(out, 'glass', f, u - w / 2, u + w / 2, y, y + h, 0.025, glass[accent % 3]);
  if (detail === 0) return;
  panel(out, 'trim', f, u - w / 2 - 0.11, u + w / 2 + 0.11, y - 0.13, y, 0.114, pale);
  if (detail < 2) return;
  const dividers = wide && detail === 3 ? [-0.29, 0, 0.29] : [0];
  for (const k of dividers)
    panel(out, 'metal', f, u + k * w - 0.034, u + k * w + 0.034, y, y + h, 0.041, steel);
  panel(out, 'metal', f, u - w / 2, u + w / 2, y + h * 0.59, y + h * 0.59 + 0.054, 0.047, steel);
}

function bays(out, f, rows, detail, { step = 3.55, wide = false } = {}) {
  const count = Math.max(1, Math.round(f.length / step));
  const width = f.length / count;
  if (f.length < 1.65) return;
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * width;
    for (const [y, h] of rows) {
      windows(out, f, u, y, width * (wide ? 0.72 : 0.52), h, detail, i, wide);
    }
    if (wide && detail > 1 && i > 0) {
      fbox(out, 'trim', f, i * width - 0.25, i * width + 0.25, 1, 10.55, 0, 0.19, ashlar);
    }
  }
}

function block(out, ring, y, Y, detail, rows, { chamber = false } = {}) {
  extrude(out, 'base', ring, y, y + 1.02, shadow, { top: false });
  mass(out, 'stone', ring, y + 1.02, Y, ashlar, 'roof', brown);
  if (!detail) return;
  for (const f of edges(ring)) {
    if (f.length < 0.85) continue;
    panel(out, 'trim', f, 0, f.length, Y - 0.58, Y - 0.29, 0.12, pale);
    bays(out, f, rows, detail, { step: chamber ? 5.51 : detail === 1 ? 6.3 : 4.17, wide: chamber });
  }
}

function front(out, detail) {
  const central = frontRect(-18.78, -12.16, 18.78, 0.015);
  mass(out, 'stone', central, 10.83, 15.94, ashlar, 'roof', brown);
  for (const [w, y, Y] of [
    [18.58, 15.94, 16.41],
    [8.02, 16.41, 17.02],
    [5.03, 17.02, 17.57],
    [2.53, 17.57, 18.07],
  ])
    mass(out, 'trim', frontRect(-w, -6.8, w, 0.3), y, Y, pale);
  const columns = [-9.35, -5.98, -1.99, 1.99, 5.98, 9.35];
  if (detail > 0) {
    for (const u of [-15.5, -9.1, -5.82, -2.54, 2.54, 5.82, 9.1, 15.5]) {
      windows(out, F, u, -0.04, 1.25, 3.61, detail);
      windows(out, F, u, 6.61, 1.58, 2.1, detail);
      windows(out, F, u, 11.15, 1.66, 2.8, detail);
    }
    for (const u of [-12.25, 12.25, -10.32, 10.32]) {
      fbox(out, 'trim', F, u - 0.15, u + 0.15, 2.26, 15.65, 0, 0.35, pale);
    }
  }
  for (const u of columns) {
    fbox(out, 'stone', F, u - 0.35, u + 0.35, -0.09, 4.49, 4.3, 5.18, ashlar);
    fbox(out, 'trim', F, u - 0.47, u + 0.47, -0.12, 0.31, 4.17, 5.31, pale);
    if (detail > 0) fbox(out, 'trim', F, u - 0.47, u + 0.47, 3.99, 4.49, 4.15, 5.33, pale);
  }
  fbox(out, 'trim', F, -10.15, 10.15, 4.49, 5.07, -0.38, 5.55, pale, { bottom: true });
  fbox(out, 'trim', F, -10.49, 10.49, 5.74, 6.12, -0.41, 5.85, pale, { bottom: true });
  for (const u of columns) panel(out, 'trim', F, u - 0.2, u + 0.2, 5.07, 5.74, 5.3, pale);
  if (detail > 1) {
    for (let i = -16; i <= 16; i++) {
      const u = i * 0.58;
      const q = (x, y) => F.P(u + x, y, 5.37);
      quad4(out, 'trim', q(-0.25, 5.39), q(0, 5.18), q(0.25, 5.39), q(0, 5.67), pale);
    }
  } else {
    panel(out, 'trim', F, -10.09, 10.09, 5.17, 5.57, 5.34, shadow);
  }
  for (const [i, depth] of [6.58, 6.2, 5.83].entries()) {
    const y = -0.55 + i * 0.16;
    fbox(out, 'base', F, -9.68, 9.68, -0.92, y, 0.02, depth, pale);
  }
}

function clockFace(out, f, y, detail) {
  const u = f.length / 2,
    r = 0.69;
  const n = detail === 1 ? 9 : 16;
  const disk = Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return f.P(u + r * Math.cos(angle), y + r * Math.sin(angle), 0.074);
  });
  fan(out, 'metal', disk, steel);
  const dial = disk.map((p, i) => {
    const a = (i * 2 * Math.PI) / n;
    return f.P(u + (r - 0.092) * Math.cos(a), y + (r - 0.092) * Math.sin(a), 0.084);
  });
  fan(out, 'trim', dial, pale);
  panel(out, 'metal', f, u - 0.044, u + 0.044, y, y + 0.41, 0.105, steel);
  quad4(
    out,
    'metal',
    f.P(u, y - 0.03, 0.107),
    f.P(u + 0.38, y - 0.2, 0.107),
    f.P(u + 0.4, y - 0.12, 0.107),
    f.P(u, y + 0.03, 0.107),
    steel,
  );
}

function clock(out, detail) {
  const {
    center: [x, z],
    shaft,
    tip,
  } = site.clock;
  const shaftPlan = rect(x - 2.55, z - 2.46, x + 2.55, z + 2.46);
  mass(out, 'stone', shaftPlan, 12.31, shaft, ashlar);
  const head = rect(x - 2.72, z - 2.65, x + 2.72, z + 2.65);
  mass(out, 'trim', head, shaft - 0.4, shaft + 0.26, pale);
  const top = [
    [shaft + 0.2, 2.58],
    [shaft + 1.34, 2.32],
    [shaft + 2.18, 2.04],
    [shaft + 3.6, 1.71],
    [tip - 0.64, 1.07],
    [tip, 0.64],
  ];
  lathe(
    out,
    'trim',
    [x, z],
    top.map(([y, r]) => [y, r, r]),
    8,
    pale,
    { rotation: Math.PI / 8 },
  );
  for (const f of edges(shaftPlan)) {
    if (detail > 0) {
      clockFace(out, f, shaft - 1.84, detail);
      panel(
        out,
        'glass',
        f,
        f.length * 0.39,
        f.length * 0.61,
        shaft - 5.7,
        shaft - 3.45,
        0.025,
        glass[0],
      );
    }
    if (detail > 1)
      for (const u of [0.32, f.length - 0.32])
        fbox(out, 'trim', f, u - 0.11, u + 0.11, 13.31, shaft - 0.41, 0, 0.17, pale);
  }
}

function build(out, detail) {
  block(out, main, -6.3, 11.12, detail, [
    [0.03, 2.32],
    [3.53, 2.33],
    [7.35, 2.46],
  ]);
  for (const ring of [rect(-65.95, 4.15, -60.04, 15.56), rect(88.45, -3.8, 95.87, 17.97)]) {
    block(out, ring, 10.8, 13.05, detail, []);
  }
  front(out, detail);
  block(
    out,
    chamber,
    -5.7,
    13.22,
    detail,
    [
      [-0.32, 2.5],
      [3.39, 6.66],
    ],
    { chamber: true },
  );
  for (const { outline, roof } of site.annexes)
    block(out, outwardRing(outline), -4.2, roof, detail, [
      [0.17, 2.35],
      [3.82, 2.39],
    ]);
  clock(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
