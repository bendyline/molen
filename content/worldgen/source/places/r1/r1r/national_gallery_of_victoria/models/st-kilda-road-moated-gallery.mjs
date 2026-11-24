import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98 },
  apron: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
};

const bluestone = rgb('92989b'),
  shadowStone = rgb('6c7174'),
  coping = rgb('a6a6a0');
const water = rgb('577d84'),
  floor = rgb('aaa49a'),
  roofWarm = rgb('b1aa9b'),
  roofSilver = rgb('b9c1bb');
const glass = rgb('547b7e'),
  glassDark = rgb('405358'),
  mullion = rgb('9da5a1');
const F = facade(site.front, site.along),
  R = site.roof;
const P = (u, d) => {
  const [x, , z] = F.P(u, 0, d);
  return [x, z];
};
const rectangle = (a, b, c, d) => [P(a, b), P(c, b), P(c, d), P(a, d)];
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const position = ([x, z], y) => [x, y, z];

function panel(out, slot, f, a, b, y, Y, d, color) {
  quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, Y, d), f.P(a, Y, d), color);
}
function slab(out, slot, ring, low, high, color) {
  const r = outwardRing(ring);
  for (const f of edges(r)) panel(out, slot, f, 0, f.length, low, high, 0, color);
  cap(out, slot, r, high, color);
}
function arch(out, detail, a, b) {
  const low = site.grade,
    half = 5.24,
    spring = 2.8,
    rise = 5.38,
    depth = 4.55;
  const n = [8, 12, 18, 24][detail];
  const at = (i) => {
    const theta = (Math.PI * i) / n;
    return [-half * Math.cos(theta), spring + rise * Math.sin(theta)];
  };
  for (const [lo, hi] of [
    [a, -half],
    [half, b],
  ]) {
    panel(out, 'stone', F, lo, hi, -4.9, R.parapet, 0, bluestone);
  }
  for (let i = 0; i < n; i++) {
    const [u, y] = at(i),
      [v, Y] = at(i + 1);
    quad4(out, 'stone', F.P(u, y), F.P(v, Y), F.P(v, R.parapet), F.P(u, R.parapet), bluestone);
    quad4(out, 'stone', F.P(u, y, -depth), F.P(v, Y, -depth), F.P(v, Y), F.P(u, y), shadowStone);
  }
  fbox(out, 'stone', F, -half - 0.26, -half, low, spring, -depth, 0, shadowStone);
  fbox(out, 'stone', F, half, half + 0.26, low, spring, -depth, 0, shadowStone);
  panel(out, 'glass', F, -half, half, low, spring + rise, -depth, glassDark);
  if (detail > 0) {
    for (let i = -4; i <= 4; i++) {
      const u = i * 1.04;
      const y = spring + rise * Math.sqrt(1 - (u / half) * (u / half));
      fbox(out, 'frame', F, u - 0.055, u + 0.055, low, y, -depth, -depth + 0.09, mullion);
    }
    fbox(out, 'frame', F, -half, half, 2.66, 2.78, -depth, -depth + 0.075, mullion);
    if (detail > 1)
      for (let i = 1; i < 10; i++) {
        const u = -half + i * half * 0.2,
          height = spring + rise * Math.sqrt(1 - (u / half) * (u / half));
        panel(out, 'glass', F, u - 0.014, u + 0.014, 1.0, height - 0.11, -depth + 0.019, glass);
      }
  }
}
function building(out, detail) {
  const wallRing = outwardRing(site.walls);
  for (const f of edges(wallRing)) {
    // The map samples the front wall at the entrance and the junctions with both moats.
    if (f.length > 148 && f.along[0] * F.along[0] + f.along[1] * F.along[1] > 0.999) {
      const u =
        (f.origin[0] - site.front[0]) * F.along[0] + (f.origin[1] - site.front[1]) * F.along[1];
      arch(out, detail, u, u + f.length);
    } else {
      panel(out, 'stone', f, 0, f.length, -4.9, R.parapet, 0, bluestone);
    }
  }
}
function slopes(out, slot, outer, inner, y, Y, color) {
  const lower = outwardRing(outer),
    upper = outwardRing(inner);
  for (const [i, a] of lower.entries()) {
    const j = (i + 1) % lower.length;
    quad4(
      out,
      slot,
      position(a, y),
      position(lower[j], y),
      position(upper[j], Y),
      position(upper[i], Y),
      color,
    );
  }
}
function rooftop(out, detail) {
  const outer = rectangle(R.lo, R.back, R.hi, R.forward);
  const rim = rectangle(R.lo + 3.8, R.back + 3.8, R.hi - 3.8, R.forward - 3.8);
  const well = rectangle(R.lo + 8.0, R.back + 8.0, R.hi - 8.0, R.forward - 8.0);
  for (const f of edges(outwardRing(outer)))
    panel(out, 'stone', f, 0, f.length, R.parapet - 0.38, R.parapet, 0, coping);
  slopes(out, 'roof', outer, rim, R.parapet, R.parapet, roofWarm);
  slopes(out, 'roof', rim, well, R.parapet, R.well, roofSilver);
  cap(out, 'roof', well, R.well, roofWarm);
  for (const [a, b, transparent] of [
    [-64, -29, false],
    [-18.4, 17.8, true],
    [28, 61, false],
  ]) {
    const base = rectangle(a, -51.2, b, -17.2);
    const inset = rectangle(a + 0.68, -50.54, b - 0.68, -17.86);
    const crown = rectangle(a + 3.42, -47.8, b - 3.42, -20.6);
    const plinth = transparent ? 13.96 : 14.74,
      top = transparent ? 15.0 : 16.36;
    slab(out, 'frame', base, R.well, plinth, roofSilver);
    slopes(
      out,
      transparent ? 'glass' : 'roof',
      base,
      inset,
      plinth,
      plinth + 0.22,
      transparent ? glass : roofSilver,
    );
    slopes(
      out,
      transparent ? 'glass' : 'roof',
      inset,
      crown,
      plinth + 0.22,
      top,
      transparent ? glass : roofSilver,
    );
    cap(out, transparent ? 'glass' : 'roof', crown, top, transparent ? glass : roofSilver);
    if (detail === 0) continue;
    if (transparent) {
      const step = detail === 1 ? 5.5 : detail === 2 ? 2.8 : 1.71;
      for (let u = a + 4.0; u < b - 3.65; u += step)
        fbox(out, 'frame', F, u - 0.034, u + 0.034, top, top + 0.045, -47.8, -20.6, mullion);
      for (let d = -46.57; d < -21.3; d += step)
        fbox(
          out,
          'frame',
          F,
          a + 3.42,
          b - 3.42,
          top + 0.005,
          top + 0.047,
          d - 0.036,
          d + 0.036,
          mullion,
        );
    } else {
      const step = detail === 1 ? 9 : detail === 2 ? 6.3 : 4.55;
      for (let u = a + 6.6; u < b - 4; u += step)
        for (const d of [-44, -35, -26]) {
          slab(out, 'roof', rectangle(u, d, u + 1.6, d + 1.18), top, top + 0.22, coping);
        }
    }
  }
}
function grounds(out, detail) {
  slab(out, 'apron', site.approach, -2.1, site.grade, floor);
  for (const pool of site.pools) {
    const r = outwardRing(pool.outline);
    cap(out, 'glass', r, site.waterLevel, water);
    for (const f of edges(r)) {
      panel(out, 'apron', f, 0, f.length, -2.64, site.grade, 0, floor);
      panel(out, 'apron', f, 0, f.length, site.waterLevel - 0.025, site.grade, -0.025, shadowStone);
      if (detail > 0)
        fbox(
          out,
          'apron',
          f,
          0,
          f.length,
          site.grade - 0.12,
          site.grade + 0.012,
          -0.13,
          0.11,
          coping,
        );
    }
  }
}
function build(out, detail) {
  building(out, detail);
  rooftop(out, detail);
  grounds(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
