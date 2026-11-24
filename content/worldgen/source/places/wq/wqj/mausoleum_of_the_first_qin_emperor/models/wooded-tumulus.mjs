import { rgb, tri } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import grid from '../qinMound-clipped-elevation-grids.json' with { type: 'json' };
import survey from '../qinMound-surveyed-geometry.json' with { type: 'json' };

export const surfaces = {
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.95 },
  canopy: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'qin-mound-evergreen-canopy',
    roughness: 0.97,
  },
};
const yDatum = 484.95;
const {
  elevations,
  terrainExtent: [left, top, right, bottom],
  divide,
} = survey;
const mix = (a, b, t) => a + (b - a) * t;
const terrainColor = [rgb('827e5c'), rgb('6b774f'), rgb('546d44'), rgb('526845')];
const canopyColor = ['536945', '55714a', '44613e', '626f48', '496144', '5d7449'].map(rgb);
const hash = (n) => {
  let x = Math.imul(n ^ 0x7caa013b, 0x9e3779b1) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};
function yAt(x, z) {
  const U = Math.max(0, Math.min(divide, ((x - left) * divide) / (right - left)));
  const V = Math.max(0, Math.min(divide, ((z - top) * divide) / (bottom - top)));
  const u = Math.min(divide - 1, Math.floor(U)),
    v = Math.min(divide - 1, Math.floor(V));
  return (
    mix(
      mix(elevations[v][u], elevations[v][u + 1], U - u),
      mix(elevations[v + 1][u], elevations[v + 1][u + 1], U - u),
      V - v,
    ) - yDatum
  );
}
const inside = (x, z) => {
  let result = false;
  for (const [i, [a, b]] of survey.outline.entries()) {
    const [c, d] = survey.outline[(i + 1) % survey.outline.length];
    if (b > z !== d > z && x < a + ((z - b) * (c - a)) / (d - b)) result = !result;
  }
  return result;
};
const massTone = (p, a) =>
  terrainColor[p[1] > 11 ? 2 + Math.round(hash(a)) : Math.round(hash(a) * 1.7)];
const pos = ([x, z]) => [x, yAt(x, z), z];
function mound(out, level) {
  const { cells, interior, edges } = grid.levels[level];
  const dx = (right - left) / cells,
    dz = (bottom - top) / cells;
  for (const i of interior) {
    const x = left + dx * (i % cells),
      z = top + dz * Math.floor(i / cells);
    const a = pos([x, z]),
      b = pos([x + dx, z]),
      c = pos([x + dx, z + dz]),
      d = pos([x, z + dz]);
    const shade = massTone(a, i);
    tri(out, 'earth', a, d, c, shade);
    tri(out, 'earth', a, c, b, shade);
  }
  for (const [i, r] of edges.entries()) {
    const [base, ...next] = r.map(pos),
      shade = massTone(base, 12003 + i);
    for (let j = 0; j < next.length - 1; j++) tri(out, 'earth', base, next[j + 1], next[j], shade);
  }
  // A shallow skirt hides gaps from sub-metre differences between elevation data providers.
  const r = survey.outline;
  for (const [i, [x, z]] of r.entries()) {
    const [X, Z] = r[(i + 1) % r.length],
      n = Math.max(2, Math.ceil(Math.hypot(X - x, Z - z) / dx));
    for (let s = 0; s < n; s++) {
      const a = pos([mix(x, X, s / n), mix(z, Z, s / n)]),
        b = pos([mix(x, X, (s + 1) / n), mix(z, Z, (s + 1) / n)]);
      const c = [b[0], b[1] - 1.4, b[2]],
        d = [a[0], a[1] - 1.4, a[2]];
      tri(out, 'earth', a, b, c, terrainColor[0]);
      tri(out, 'earth', a, c, d, terrainColor[0]);
    }
  }
}
function canopy(out, level) {
  const step = [36, 18, 11.75, 8.5][level];
  let i = 0;
  for (let Z = top + 12; Z < bottom - 11; Z += step)
    for (let X = left + 12; X < right - 11; X += step) {
      const k = i++;
      const x = X + (hash(k + 39) - 0.5) * step * 0.65,
        z = Z + (hash(k + 5) - 0.5) * step * 0.65;
      const y = yAt(x, z);
      if (!inside(x, z) || (y < 8.1 && hash(k + 655) < 0.51)) continue;
      let radius = mix(0.26, 0.58, hash(k + 38)) * step;
      let attempt = 0;
      while (
        attempt++ < 5 &&
        ![
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
        ].every(([a, b]) => inside(x + a, z + b))
      )
        radius *= 0.7;
      const sectors = level === 0 ? 4 : 5;
      const rotation = hash(k + 308) * Math.PI * 2;
      const h = 1.85 + hash(k + 984) * 3.3;
      const shoulder = level === 3 || (level === 2 && k % 3 === 0);
      const shade = canopyColor[Math.floor(hash(k + 40) * canopyColor.length)];
      const apex = [x + hash(k + 17) * radius * 0.18, y + h, z];
      const point = (j, scale, height) => {
        const a = rotation + (j * Math.PI * 2) / sectors;
        const width = radius * scale * (0.91 + 0.16 * hash(k * sectors + (j % sectors) + 5702));
        const X = x + Math.cos(a) * width,
          Z = z + Math.sin(a) * width * 0.87;
        return [X, yAt(X, Z) + height, Z];
      };
      for (let j = 0; j < sectors; j++) {
        const a = point(j, 1, -0.34),
          b = point(j + 1, 1, -0.34);
        if (shoulder) {
          const c = point(j, 0.58, h * 0.73),
            d = point(j + 1, 0.58, h * 0.73);
          tri(out, 'canopy', b, a, c, shade);
          tri(out, 'canopy', b, c, d, shade);
          tri(out, 'canopy', d, c, apex, shade);
        } else {
          tri(out, 'canopy', b, a, apex, shade);
        }
      }
    }
}
function build(out, level) {
  mound(out, level);
  canopy(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
