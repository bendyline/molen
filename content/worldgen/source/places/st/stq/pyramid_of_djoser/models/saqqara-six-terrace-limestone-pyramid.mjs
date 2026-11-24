import {
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98 },
  worn: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.99 },
  niche: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.98 },
};

const stone = rgb('b5a18a'),
  pale = rgb('bfaa8f'),
  raw = rgb('b09a7e'),
  dark = rgb('82715c');
const terraceColors = ['b9a687', 'baa78c', 'baaa94', 'b29e84', 'b4a18b', 'b5a38c'].map(rgb);
const repairColors = ['baa58a', 'bca98f', 'ad9a80', 'c1ac93', 'b4a18a'].map(rgb);
const midpoint = (r) => r.reduce(([a, b], [x, z]) => [a + x / r.length, b + z / r.length], [0, 0]);
const edge = (r, i) => r[(i + 1) % r.length];

function terracePoint(a, b, c, frac, y, margin) {
  const x = a[0] + (b[0] - a[0]) * frac,
    z = a[1] + (b[1] - a[1]) * frac;
  return [x + (c[0] - x) * margin, y, z + (c[1] - z) * margin];
}

function tier(out, { outline, height }, y, index, detail) {
  const ring = outwardRing(outline),
    c = midpoint(ring);
  const setback = [0.062, 0.067, 0.083, 0.11, 0.12, 0.173][index];
  const highest = ring.map((p) => [p[0] + (c[0] - p[0]) * setback, p[1] + (c[1] - p[1]) * setback]);
  const h = height - y,
    courses = [1, 4, 9, 18][detail],
    divisions = [1, 7, 13, 24][detail];
  for (const [side, a] of ring.entries()) {
    const b = edge(ring, side);
    const p = (i, j) => {
      const t = j / courses,
        u = i / divisions;
      const corner = i === 0 || i === divisions,
        end = j === 0 || j === courses;
      const f =
        corner || end || detail < 2 ? 0 : Math.sin(i * 1.6 + side + index * 0.5 + j * 0.94) * 0.009;
      const vertical =
        corner || end || detail < 2 ? 0 : Math.sin(i * 0.93 + j * 0.28 + side) * h * 0.013;
      const contour =
        corner || end || detail < 2 ? 0 : Math.sin(i * 0.56 + j * 0.92 + index * 0.51) * 0.0021;
      return terracePoint(a, b, c, u + f, y + h * t + vertical, setback * t + contour);
    };
    for (let j = 0; j < courses; j++) {
      for (let i = 0; i < divisions; i++) {
        const light = (i * 3 + j * 5 + side + index * 2) % 11;
        const color =
          detail > 0 && light < 2
            ? repairColors[(side + i + j) % repairColors.length]
            : terraceColors[index];
        const eroded =
          detail > 1 && Math.sin((i + side * 3) * 0.32 + index) + Math.cos(j * 0.63) > 1.28;
        const material = eroded ? 'worn' : 'limestone';
        quad4(out, material, p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), color);
      }
    }
  }
  cap(out, 'worn', highest, height, index % 2 ? raw : pale);
}

function threshold(out, detail) {
  const ring = outwardRing(site.outline);
  extrude(out, 'base', ring, -3.2, 1.37, raw, { top: false });
  cap(out, 'base', ring, 1.37, stone);
  if (!detail) return;
  // The lower north threshold follows the small jog in the native outline.
  const f = wallFace(site.outline[9], site.outline[10]);
  const u = f.length * 0.5;
  fbox(out, 'base', f, u - 3.08, u + 3.08, 0.28, 1.86, -0.31, 0.54, pale);
  fbox(out, 'limestone', f, u - 2.31, u - 1.18, 0.47, 3.04, -0.36, 0.54, pale);
  fbox(out, 'limestone', f, u + 1.18, u + 2.31, 0.47, 3.04, -0.36, 0.54, stone);
  fbox(out, 'limestone', f, u - 2.39, u + 2.39, 2.71, 3.26, -0.38, 0.56, pale);
  fbox(out, 'niche', f, u - 1.14, u + 1.14, 1.78, 2.7, -0.41, -0.37, dark);
}

function build(out, detail) {
  threshold(out, detail);
  for (const [i, layer] of site.layers.entries()) {
    const low = i === 0 ? 1.36 : site.layers[i - 1].height - 0.015;
    tier(out, layer, low, i, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
