import {
  extrude,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.99 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.99 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.98 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.99 },
};

const stone = rgb('b09a7a'),
  sand = rgb('b9a582'),
  capstone = rgb('a38b70');
const dark = rgb('6e5d47'),
  recess = rgb('605240'),
  steps = rgb('ab9575');
const colors = ['b19b7a', 'af9777', 'b59e80', 'aa9274', 'b39d7d', 'b29a7c'].map(rgb);
const ring = outwardRing(site.outline);
const rise = site.height - site.grade;
const crownFraction = 0.9911;
const fraction = (y) => (y - site.grade) / rise;
const center = site.apex;

const sides = ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
const north = sides.find((f) => f.normal[1] < -0.9);
function position(f, u, t, d = 0, y = site.grade + t * rise) {
  const [x, , z] = f.P(f.length * u, 0, d);
  return [x + (center[0] - x) * t, y, z + (center[1] - z) * t];
}

function cuts(n, extra) {
  return [...Array.from({ length: n + 1 }, (_, i) => i / n), ...extra]
    .sort((a, b) => a - b)
    .filter((v, i, r) => i === 0 || v - r[i - 1] > 0.00001);
}

function facade(out, f, detail) {
  const door = f === north ? site.doorway : undefined;
  const baseT = door ? fraction(door.threshold) : 0,
    topT = door ? fraction(door.top) : 0;
  const middle = (baseT + topT) / 2;
  const width = door ? door.halfWidth / (f.length * (1 - middle)) : 0;
  const lowU = door ? door.fraction - width : 0,
    highU = door ? door.fraction + width : 0;
  const uCuts = cuts([1, 10, 23, 40][detail], door ? [lowU, highU] : []);
  const tCuts = cuts(
    [1, 9, 22, 44][detail],
    door ? [baseT / crownFraction, topT / crownFraction] : [],
  ).map((t) => t * crownFraction);
  const point = (u, t, i, j) => {
    const isOpening =
      door && u >= lowU - 1e-6 && u <= highU + 1e-6 && t >= baseT - 1e-6 && t <= topT + 1e-6;
    const onEdge = u === 0 || u === 1 || t === 0 || t === crownFraction;
    const roughness =
      detail < 2 || isOpening || onEdge ? 0 : Math.sin(i * 0.712 + j * 1.11) * 0.079;
    return position(f, u, t, roughness);
  };
  for (let j = 0; j < tCuts.length - 1; j++) {
    const t = tCuts[j],
      T = tCuts[j + 1];
    for (let i = 0; i < uCuts.length - 1; i++) {
      const u = uCuts[i],
        U = uCuts[i + 1];
      if (door && t >= baseT - 1e-6 && T <= topT + 1e-6 && u >= lowU - 1e-6 && U <= highU + 1e-6)
        continue;
      const color = detail > 0 && i % 4 !== j % 4 ? colors[(i * 3 + j * 5) % colors.length] : stone;
      quad4(
        out,
        'stone',
        point(u, t, i, j),
        point(U, t, i + 1, j),
        point(U, T, i + 1, j + 1),
        point(u, T, i, j + 1),
        color,
      );
    }
  }
  if (!door) return;
  const A = position(f, lowU, baseT),
    B = position(f, highU, baseT);
  const C = position(f, highU, topT),
    D = position(f, lowU, topT);
  const back = (p) => [p[0] - 3.46 * f.normal[0], p[1], p[2] - 3.46 * f.normal[1]];
  quad4(out, 'cut', A, B, back(B), back(A), dark);
  quad4(out, 'cut', back(D), back(C), C, D, dark);
  quad4(out, 'cut', A, back(A), back(D), D, dark);
  quad4(out, 'cut', back(B), B, C, back(C), dark);
  quad4(out, 'shadow', back(A), back(B), back(C), back(D), recess);
}

function staircase(out, detail) {
  const { fraction: u, threshold } = site.doorway;
  const count = [8, 16, 36, 57][detail];
  const start = site.grade + 0.05,
    end = threshold - 0.032;
  const P = (y, side, height) => {
    const t = fraction(y);
    const lateral = side * 1.27 - 7.1 * (1 - (y - start) / (end - start));
    return position(north, u + lateral / (north.length * (1 - t)), t, 0.41, height);
  };
  for (let i = 0; i < count; i++) {
    const base = start + ((end - start) * i) / count,
      top = start + ((end - start) * (i + 1)) / count;
    const A = P(base, -1, top),
      B = P(base, 1, top),
      C = P(top, 1, top),
      D = P(top, -1, top);
    quad4(out, 'cut', A, B, C, D, steps);
    quad4(out, 'footing', P(base, -1, base), P(base, 1, base), B, A, dark);
  }
}

function build(out, detail) {
  extrude(out, 'footing', ring, -4.1, site.grade, sand, { top: false });
  for (const f of sides) facade(out, f, detail);
  const top = ring.map(([x, z]) => [
    x + (center[0] - x) * crownFraction,
    z + (center[1] - z) * crownFraction,
  ]);
  for (const f of sides) {
    const a = position(f, 0, crownFraction),
      b = position(f, 1, crownFraction);
    quad4(out, 'stone', a, b, [b[0], site.height, b[2]], [a[0], site.height, a[2]], capstone);
  }
  cap(out, 'cut', top, site.height, capstone);
  staircase(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
