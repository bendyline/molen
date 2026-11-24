import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { courtyardWalls } from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  gold: { slot: 'trim', graph: 'metal_bronze_cast', metalness: 0.43, roughness: 0.62 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  panes: { slot: 'trim', graph: 'metal_painted', roughness: 0.91 },
};
const oldTimber = rgb('695044'),
  darkTimber = rgb('4d4038'),
  roof = rgb('62605c'),
  edge = rgb('694b42');
const cream = rgb('d5cab0'),
  gold = rgb('d4ab54'),
  paleGold = rgb('ddba6b'),
  shadowGold = rgb('b8914d'),
  lightGold = rgb('e1c274');
const rock = rgb('9e9781'),
  waterRock = rgb('827e72'),
  recessed = rgb('534735'),
  blind = rgb('8c7350');
const F = facade([0, 0], site.frame.along);
const local = ([x, , z]) => [x, z];
const plan = (x, z) => local(F.P(x, 0, z));
const rect = ([a, b, c, d]) => [plan(a, b), plan(c, b), plan(c, d), plan(a, d)];
const grow = ([a, b, c, d], s) => [a - s, b - s, c + s, d + s];
const midpoint = ([a, b, c, d]) => [(a + c) / 2, (b + d) / 2];
const B = site.frameBounds;

function curveRoof(out, range, y, raise, ridgeLength, detail, slot, tone, goldEdge = true) {
  const [a, b, c, d] = range,
    [midX, midZ] = midpoint(range);
  const W = (c - a) / 2,
    D = (d - b) / 2,
    r = ridgeLength / 2;
  const uSeg = detail === 0 ? 2 : detail === 1 ? 5 : detail === 2 ? 8 : 13;
  const vSeg = detail === 0 ? 2 : detail === 1 ? 3 : detail === 2 ? 5 : 8;
  const corners = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ];
  const soffitCenter = F.P(midX, y - 0.138, midZ);
  const point = (side, u, t, yOffset = 0) => {
    const [x, z] = corners[side],
      [X, Z] = corners[(side + 1) % 4];
    const x0 = x + (X - x) * u,
      z0 = z + (Z - z) * u;
    const ridgeX = x0 * r,
      lift = 0.32 * Math.pow(Math.abs(u * 2 - 1), 3.4);
    const h = y + yOffset + raise * Math.pow(t, 1.52) + lift * Math.pow(1 - t, 3.2);
    return F.P(midX + x0 * W * (1 - t) + ridgeX * t, h, midZ + z0 * D * (1 - t));
  };
  const surface = (a, b, c, d) => {
    tri(out, slot, a, b, c, tone);
    if (Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]) > 0.0001) tri(out, slot, a, c, d, tone);
  };
  for (let k = 0; k < 4; k++)
    for (let i = 0; i < uSeg; i++) {
      const a = i / uSeg,
        b = (i + 1) / uSeg;
      for (let j = 0; j < vSeg; j++) {
        const t = j / vSeg,
          T = (j + 1) / vSeg;
        const [p, q, r, s] = [point(k, a, t), point(k, b, t), point(k, b, T), point(k, a, T)];
        surface(p, q, r, s);
      }
      const root = point(k, a, 0),
        end = point(k, b, 0),
        lower = point(k, a, 0, -0.145),
        upper = point(k, b, 0, -0.145);
      quad4(out, 'wood', root, lower, upper, end, edge);
      tri(
        out,
        goldEdge ? 'gold' : 'wood',
        lower,
        soffitCenter,
        upper,
        goldEdge ? shadowGold : darkTimber,
      );
    }
  if (detail > 1)
    for (let k = 0; k < 4; k++) {
      const t = [0, 0.2, 0.44, 0.66, 0.86, 1];
      for (let i = 0; i < t.length - 1; i++)
        beam(out, slot, point(k, 0, t[i], 0.042), point(k, 0, t[i + 1], 0.042), 0.125, 0.085, tone);
    }
}

function rail(out, ring, y, detail, slot, tone) {
  for (const f of courtyardWalls(ring)) {
    fbox(out, slot, f, 0, f.length, y + 0.53, y + 0.61, -0.065, 0.045, tone);
    fbox(out, slot, f, 0, f.length, y + 0.13, y + 0.185, -0.045, 0.035, tone);
    const n = detail ? Math.ceil(f.length / (detail === 1 ? 2.3 : 1.43)) : 1;
    for (let i = 0; i < n; i++) {
      const u = (i * f.length) / n;
      fbox(out, slot, f, u - 0.038, u + 0.038, y - 0.02, y + 0.68, -0.052, 0.052, tone);
      if (detail > 2 && i > 0)
        fbox(out, slot, f, u - 0.059, u + 0.059, y + 0.64, y + 0.735, -0.073, 0.072, tone);
    }
    if (detail > 1) fbox(out, slot, f, 0, f.length, y + 0.33, y + 0.37, -0.036, 0.022, tone);
  }
}

function shoreline(out, detail) {
  extrude(out, 'stone', site.base, -0.58, 0.71, rock);
  extrude(out, 'wood', site.deck, 0.7, 0.93, darkTimber);
  extrude(out, 'wood', site.groundPlatform, 0.89, 1.073, oldTimber);
  if (detail > 0) {
    rail(out, site.groundPlatform, 1.03, detail, 'wood', darkTimber);
    for (const f of courtyardWalls(site.base)) {
      const n = Math.round(f.length / 1.38);
      for (let i = 0; i < n; i++) {
        const u = (f.length * (i + 0.5)) / n;
        const color = i % 3 ? rock : waterRock;
        const d = (i % 4) * 0.024;
        fbox(
          out,
          'stone',
          f,
          u - 0.55,
          u + 0.55,
          -0.35 + d,
          0.48 + (i % 3) * 0.065,
          -0.22,
          0.13 + d,
          color,
        );
      }
    }
  }
}
function firstStory(out, detail) {
  const g = B.ground;
  extrude(out, 'plaster', site.lowerWall, 1.025, 2.93, cream);
  extrude(out, 'wood', rect(g), 2.81, 3.06, darkTimber);
  extrude(out, 'wood', rect(grow(g, 0.51)), 3.035, 3.178, darkTimber);
  const ring = rect(g);
  for (const f of courtyardWalls(ring)) {
    const long = f.normal[1] > 0.45 || f.normal[0] < -0.45;
    const count = detail ? 5 : 2;
    for (let i = 0; i <= count; i++) {
      const u = (i * f.length) / count;
      fbox(out, 'wood', f, u - 0.094, u + 0.095, 1.02, 3.075, -0.1, 0.103, oldTimber);
      if (i < count && long) {
        const w = f.length / count;
        fbox(out, 'wood', f, u + 0.08, u + w - 0.081, 1.13, 1.61, -0.15, -0.055, darkTimber);
        if (i !== 1 || !detail)
          fbox(out, 'panes', f, u + 0.12, u + w - 0.12, 1.61, 2.58, -0.15, -0.068, recessed);
      }
    }
    fbox(out, 'wood', f, 0, f.length, 2.598, 2.717, -0.095, 0.072, darkTimber);
    if (detail > 1)
      for (let i = 1; i < count; i++) {
        const u = ((i - 0.5) * f.length) / count;
        fbox(out, 'wood', f, u - 0.132, u + 0.132, 2.73, 3.04, -0.31, 0.34, oldTimber);
      }
  }
}

function giltFloor(out, detail, upper) {
  const shape = upper ? rect(B.top) : rect(B.mid);
  const limits = upper ? B.top : B.mid;
  const base = upper ? 7.66 : 3.105,
    eave = upper ? 9.92 : 5.92;
  const pa = rect(grow(limits, upper ? 0.54 : 0.47));
  if (upper) extrude(out, 'gold', rect(grow(limits, 0.045)), 7.03, 7.68, shadowGold);
  extrude(out, 'gold', pa, base - 0.035, base + 0.19, shadowGold, { bottom: true });
  extrude(out, 'gold', shape, base + 0.185, eave, gold);
  rail(out, pa, base + 0.17, detail, 'gold', paleGold);
  for (const f of courtyardWalls(shape)) {
    const n = upper ? 4 : 5;
    const bay = f.length / n;
    for (let i = 0; i < n; i++) {
      const u = bay * (i + 0.5);
      const y = base + 0.51,
        height = eave - y - 0.24,
        width = bay * 0.67;
      const tone = (i + Number(upper)) % 3 === 0 ? shadowGold : paleGold;
      if (detail === 0) continue;
      opening(out, f, u, y, width, height, {
        head: upper ? 'tudor' : 'flat',
        glassSlot: 'gold',
        frameSlot: 'gold',
        glass: tone,
        frame: lightGold,
        frameWidth: detail > 1 ? 0.058 : 0,
        frameDepth: 0.105,
        mullions: detail > 1 ? 1 : 0,
        transoms: detail > 2 ? 2 : 0,
        d: 0.035,
      });
      if (detail > 1) {
        const a = u - bay * 0.5;
        fbox(
          out,
          'gold',
          f,
          a - 0.053,
          a + 0.053,
          base + 0.16,
          eave + 0.056,
          -0.095,
          0.103,
          shadowGold,
        );
        fbox(
          out,
          'gold',
          f,
          u - 0.17,
          u + 0.17,
          eave - 0.24,
          eave - 0.025,
          -0.19,
          0.42,
          shadowGold,
        );
        fbox(out, 'gold', f, u - 0.21, u + 0.21, eave - 0.12, eave - 0.018, -0.25, 0.54, paleGold);
        if (!upper && (i === 0 || i === 4) && detail === 3)
          for (let j = 1; j < 6; j++) {
            const x = u + width * (j / 6 - 0.5);
            fbox(
              out,
              'gold',
              f,
              x - 0.015,
              x + 0.015,
              y + 0.07,
              y + height - 0.101,
              0.076,
              0.106,
              shadowGold,
            );
          }
      }
    }
  }
}

function fishingPavilion(out, detail) {
  extrude(out, 'stone', site.dock, -0.58, 0.34, rock);
  extrude(out, 'wood', site.dock, 0.34, 0.55, oldTimber);
  for (const f of courtyardWalls(site.dock)) {
    fbox(out, 'wood', f, -0.065, 0.09, 0.53, 2.24, -0.11, 0.09, darkTimber);
    if (detail) fbox(out, 'wood', f, 0, f.length, 2.161, 2.242, -0.09, 0.044, oldTimber);
  }
  curveRoof(out, B.dockRoof, 2.39, 0.57, 0.6, detail === 3 ? 2 : 0, 'shingle', roof, false);
  if (detail > 1) rail(out, site.dock, 0.54, 1, 'wood', darkTimber);
}

function finial(out, detail) {
  const [u, d] = midpoint(B.upperRoof),
    p = (x, y, z) => F.P(u + x, y, d + z);
  const center = local(p(0, 0, 0));
  lathe(
    out,
    'gold',
    center,
    [
      [11.51, 0.46, 0.44],
      [11.6, 0.49, 0.46],
      [11.68, 0.33, 0.33],
      [11.81, 0.26, 0.25],
    ],
    detail > 1 ? 8 : 4,
    shadowGold,
    { rotation: site.roofRotation },
  );
  const V = [
    [0, 11.81, -0.06],
    [0, 12.08, -0.11],
    [0, 12.31, 0.09],
    [0, 12.52, 0.29],
    [0, 12.48, 0.41],
    [0, 12.45, 0.51],
  ].map((v) => p(...v));
  beam(out, 'gold', V[0], V[1], 0.064, 0.076, shadowGold);
  beam(out, 'gold', V[1], V[2], 0.19, 0.16, paleGold);
  beam(out, 'gold', V[2], V[3], 0.1, 0.12, paleGold);
  beam(out, 'gold', V[3], V[4], 0.12, 0.115, gold);
  beam(out, 'gold', V[4], V[5], 0.042, 0.05, lightGold);
  for (const side of [-1, 1]) {
    const a = p(side * 0.033, 12.23, 0.062),
      b = p(side * 0.39, 12.51, -0.14),
      c = p(side * 0.48, 12.67, -0.28),
      d = p(side * 0.24, 12.31, -0.38);
    for (const [x, y, z] of [
      [a, b, c],
      [a, c, d],
    ]) {
      tri(out, 'gold', x, y, z, paleGold);
      tri(out, 'gold', z, y, x, shadowGold);
    }
    if (detail > 1)
      for (let i = 0; i < 4; i++) {
        const x = 0.17 + i * 0.067;
        beam(
          out,
          'gold',
          p(side * x, 12.35 + i * 0.044, -0.18),
          p(side * (x + 0.064), 12.33 + i * 0.079, -0.45),
          0.028,
          0.032,
          paleGold,
        );
      }
  }
  beam(out, 'gold', p(0, 12.12, -0.09), p(0.09, 12.19, -0.59), 0.077, 0.065, gold);
  beam(out, 'gold', p(0.09, 12.19, -0.58), p(0.17, 12.43, -0.78), 0.055, 0.062, paleGold);
}

function build(target, detail) {
  const out = withFootprintCaps(target);
  shoreline(out, detail);
  firstStory(out, detail);
  giltFloor(out, detail, false);
  giltFloor(out, detail, true);
  curveRoof(out, B.lowerRoof, 5.93, 1.71, 1.53, detail, 'shingle', roof);
  curveRoof(out, B.upperRoof, 9.91, 1.71, 0.67, detail, 'shingle', roof);
  fishingPavilion(out, detail);
  finial(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
