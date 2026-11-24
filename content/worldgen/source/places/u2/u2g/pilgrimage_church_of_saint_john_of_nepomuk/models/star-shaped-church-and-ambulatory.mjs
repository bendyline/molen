import {
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import s from '../zelenaHora-surveyed-geometry.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  copper: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.88 },
};
const plaster = rgb('dcd0b9'),
  pale = rgb('d2c7b0'),
  stone = rgb('afa999');
const terrace = rgb('a56c55'),
  copper = rgb('657575'),
  darkCopper = rgb('65676b');
const shade = rgb('535856'),
  ochre = rgb('b99861'),
  darkWood = rgb('705c4c');
const base = 613.23,
  turn = 2 * Math.PI,
  nGate = 5,
  gateShift = (35.8 * turn) / 360;
const passages = [35.8, 179.1, 323.9].map((deg) => (deg * turn) / 360);
const apse = (a) => Math.cos((a - gateShift) * nGate);
const gateDistance = (a) =>
  Math.abs(Math.atan2(Math.sin((a - gateShift) * nGate), Math.cos((a - gateShift) * nGate))) /
  nGate;
const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const passageDistance = (a) => Math.min(...passages.map((x) => angularDistance(a, x)));
const p = (a, r, y) => [s.center[0] + r * Math.cos(a), y, s.center[1] + r * Math.sin(a)];
const strips = (level) => s.radial.filter((_, i) => i % [5, 2, 1, 1][level] === 0);
function sample(theta) {
  const t = ((((theta % turn) + turn) % turn) / turn) * s.radial.length;
  const i = Math.floor(t) % s.radial.length,
    f = s.radial[i],
    g = s.radial[(i + 1) % s.radial.length],
    w = t - Math.floor(t);
  const blend = (a, b) => a.map((v, j) => v + (b[j] - v) * w);
  return { theta, r: blend(f.r, g.r), grade: blend(f.grade, g.grade) };
}
function wall(a, r) {
  const [x, , z] = p(a, r, 0);
  return facade([x, z], [Math.sin(a), -Math.cos(a)]);
}
const flat = (g) => g - base;
const el = (r) => flat(r.grade[0]);
const outerGrade = (r) =>
  Math.max(-2.45, Math.min(1.98, flat((r.grade[1] + r.grade[2]) * 0.5))) * 0.74;
const gateH = (r) => {
  const profile = Math.max(0, 1 - gateDistance(r.theta) / 0.15);
  return profile * profile * 0.98;
};
const stoneBase = (r) => el(r) - 1.65;

function cloister(out, level) {
  const edgeNodes =
    level > 1
      ? [-0.049, -0.046, -0.03, -0.015, 0, 0.015, 0.03, 0.046, 0.049]
      : [-0.049, -0.045, 0, 0.045, 0.049];
  const points = [
    ...strips(level).filter((x) => passageDistance(x.theta) > 0.052),
    ...passages.flatMap((a) => edgeNodes.map((offset) => sample(a + offset))),
  ].sort((a, b) => a.theta - b.theta);
  for (const [i, f] of points.entries()) {
    const g = points[(i + 1) % points.length],
      A = f.theta,
      Z = g.theta || turn,
      B = outerGrade(f),
      D = outerGrade(g);
    const top = B + 3.64 + gateH(f),
      next = D + 3.64 + gateH(g);
    const inside = f.r[1],
      outside = f.r[2],
      near = g.r[1],
      far = g.r[2];
    const o = p(A, outside, top),
      O = p(Z, far, next),
      j = p(A, inside, top),
      J = p(Z, near, next);
    const slope = p(A, (inside + outside) * 0.5, top + 1.53 + gateH(f) * 0.45);
    const slopeNext = p(Z, (near + far) * 0.5, next + 1.53 + gateH(g) * 0.45);
    tri(out, 'roof', j, J, slope, terrace);
    tri(out, 'roof', J, slopeNext, slope, terrace);
    tri(out, 'roof', slope, slopeNext, o, terrace);
    tri(out, 'roof', slopeNext, O, o, terrace);
    const archA = passageDistance(A) < 0.048,
      archB = passageDistance(Z) < 0.048;
    const sill = (r, d, on) =>
      d +
      (on
        ? 2.26 + Math.sqrt(Math.max(0, 1 - Math.pow(passageDistance(r.theta) / 0.048, 2))) * 0.81
        : -1.65);
    const lo = sill(f, B, archA),
      hi = sill(g, D, archB);
    const lowerOuter = p(A, outside, lo),
      upperOuter = p(Z, far, hi);
    const lowerInner = p(A, inside, lo),
      upperInner = p(Z, near, hi);
    tri(out, 'plaster', lowerOuter, o, O, plaster);
    tri(out, 'plaster', lowerOuter, O, upperOuter, plaster);
    tri(out, 'plaster', lowerInner, upperInner, J, plaster);
    tri(out, 'plaster', lowerInner, J, j, plaster);
    if (archA || archB) {
      tri(out, 'trim', lowerOuter, upperOuter, upperInner, stone);
      tri(out, 'trim', lowerOuter, upperInner, lowerInner, pale);
    }
  }
  if (level) decorateCloister(out, level);
}
function decorateCloister(out, level) {
  for (let i = 0; i < nGate; i++) {
    const a = gateShift + (i * turn) / nGate;
    const q = sample(a),
      B = outerGrade(q);
    const loc = p(a, (q.r[1] + q.r[2]) * 0.5, 0);
    const rings = [
      [B + 5.24, 1.64, 1.64],
      [B + 6.01, 1.34, 1.34],
      [B + 6.66, 0.69, 0.69],
      [B + 6.9, 0.36, 0.36],
      [B + 7.41, 0, 0],
    ];
    lathe(out, 'roof', [loc[0], loc[2]], rings, level > 1 ? 8 : 6, terrace, { rotation: a + 0.25 });
    const outer = wall(a, q.r[2] + 0.16);
    fbox(out, 'trim', outer, -1.88, -1.56, B - 0.12, B + 3.63, -0.53, 0.11, stone);
    fbox(out, 'trim', outer, 1.56, 1.88, B - 0.12, B + 3.63, -0.53, 0.11, stone);
    tri(
      out,
      'trim',
      outer.P(-0.68, B + 3.59, 0.16),
      outer.P(0.68, B + 3.59, 0.16),
      outer.P(0, B + 4.28, 0.16),
      ochre,
    );
    if (passageDistance(a) > 0.075) {
      opening(out, outer, 0, B + 0.12, 2.38, 2.91, {
        head: 'round',
        glassSlot: 'dark',
        frameSlot: 'trim',
        glass: darkWood,
        frame: stone,
        frameWidth: level > 1 ? 0.15 : 0,
      });
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = gateShift + ((i + 0.5) * turn) / 20,
      q = sample(a),
      B = outerGrade(q);
    const inside = wall(a + Math.PI, -q.r[1] + 0.13);
    opening(out, inside, 0, B + 0.71, 1.37, 1.85, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'trim',
      glass: shade,
      frame: pale,
      frameWidth: level > 1 ? 0.12 : 0,
    });
  }
}
function church(out, level) {
  const points = strips(level);
  const eave = (f) => 14.7 + Math.max(0, apse(f.theta)) * 0.86;
  for (const [i, f] of points.entries()) {
    const g = points[(i + 1) % points.length],
      A = f.theta,
      Z = g.theta || turn;
    const u = f.r[0],
      v = g.r[0];
    const shortA = Math.min(u, 7.58 + Math.max(0, apse(A)) * 2.19),
      shortB = Math.min(v, 7.58 + Math.max(0, apse(Z)) * 2.19);
    const basalA = p(A, u, stoneBase(f)),
      basalB = p(Z, v, stoneBase(g));
    const lowA = p(A, u, 7.4),
      lowB = p(Z, v, 7.4);
    quad4(out, 'plaster', basalB, basalA, lowA, lowB, plaster);
    const highA = p(A, shortA, eave(f)),
      highB = p(Z, shortB, eave(g));
    const collarA = p(A, shortA, 8.85),
      collarB = p(Z, shortB, 8.85);
    tri(out, 'copper', lowA, collarA, lowB, darkCopper);
    tri(out, 'copper', lowB, collarA, collarB, darkCopper);
    quad4(out, 'plaster', collarB, collarA, highA, highB, pale);
    const domeA = p(A, 4.52, 18.25),
      domeB = p(Z, 4.52, 18.25);
    tri(out, 'copper', highA, domeA, highB, copper);
    tri(out, 'copper', highB, domeA, domeB, copper);
  }
  const n = [8, 12, 18, 26][level];
  lathe(
    out,
    'copper',
    s.center,
    [
      [17.86, 4.52, 4.52],
      [18.74, 4.6, 4.6],
      [20.42, 4.37, 4.37],
      [23.4, 2.98, 2.98],
      [26.22, 1.23, 1.23],
      [27.42, 0.49, 0.49],
      [28.58, 0.23, 0.23],
      [30.8, 0.0, 0.0],
    ],
    n,
    copper,
  );
  if (level) decorateChurch(out, level);
}
function decorateChurch(out, level) {
  for (let i = 0; i < nGate; i++) {
    const a = gateShift + (i * turn) / nGate;
    const q = sample(a),
      B = el(q);
    const low = wall(a, q.r[0] + 0.035);
    const tall = wall(a, Math.min(q.r[0], 9.77) + 0.042);
    fbox(out, 'trim', low, -1.45, 1.45, B - 0.18, B + 0.28, -0.54, 0.23, stone);
    opening(out, low, 0, B + 0.2, 1.53, 3.24, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'trim',
      glass: darkWood,
      frame: stone,
      frameWidth: 0.16,
      frameDepth: 0.13,
    });
    opening(out, low, 0, 4.54, 0.96, 1.49, {
      head: 'pointed',
      glassSlot: 'dark',
      frameSlot: 'trim',
      glass: shade,
      frame: pale,
      frameWidth: 0.08,
    });
    opening(out, tall, 0, 10.04, 1.37, 3.58, {
      head: 'pointed',
      glassSlot: 'dark',
      frameSlot: 'trim',
      glass: shade,
      frame: pale,
      frameWidth: 0.102,
      mullions: level > 1 ? 1 : 0,
    });
    if (level > 1) {
      for (const side of [-1, 1]) {
        const shift = a + side * 0.134,
          r = sample(shift).r[0];
        const f = wall(shift, r + 0.023);
        fbox(out, 'plaster', f, -0.23, 0.23, 1.15, 6.94, -0.55, 0.21, pale);
        fbox(out, 'trim', f, -0.37, 0.37, 6.78, 7.27, -0.55, 0.22, stone);
      }
    }
  }
  const g = facade(s.center, [1, 0]);
  fbox(out, 'copper', g, -0.065, 0.065, 29.82, 31.23, -0.06, 0.06, copper);
  fbox(out, 'copper', g, -0.31, 0.31, 30.73, 30.815, -0.07, 0.07, copper);
}
function churchyard(out, level) {
  if (level < 2) return;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 21; i++) {
      const a = ((i + (row % 2) * 0.45) * turn) / 21,
        q = sample(a);
      if (gateDistance(a) < 0.125 || i % 7 === row) continue;
      const mix = 0.29 + row * 0.18,
        r = q.r[0] + (q.r[1] - q.r[0]) * mix;
      const y = el(q) + (flat(q.grade[1]) - el(q)) * mix;
      const f = wall(a, r);
      fbox(out, 'trim', f, -0.55, 0.55, y - 0.45, y + 0.16, -0.75, 0.49, stone);
      fbox(
        out,
        'trim',
        f,
        -0.413,
        0.413,
        y - 0.04,
        y + 0.67 + (i % 3) * 0.14,
        -0.71,
        -0.53,
        i % 2 ? pale : stone,
      );
    }
  }
}
function build(out, level) {
  cloister(out, level);
  church(out, level);
  churchyard(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
