/** Montréal greystone basilica with copper roofs and central Gothic spire, circa 1895. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boxBounds } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { body: b, tower: t } = plan;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.79, metallic: 0.16 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.12 },
};
const c = Object.fromEntries(Object.entries({
  stone: 'b9b5a9', trim: 'c0bbae', highlight: 'd5d0bf', shadow: '938f81', base: '959187',
  roof: '768477', seam: '7d8d81', steeple: '708779', deep: '2e3430', glass: '42494a',
  doors: '3f3934', frame: '867b65', cross: '9e8b68',
}).map(([name, color]) => [name, rgb(color)]));
const up = [0, 1, 0], forward = [0, 0, 1];
const dot = (first, second) => first.reduce((sum, n, i) => sum + n * second[i], 0);
const xy = ([x, z], y) => [x, y, z];

function box(out, slot, x, y, z, width, height, depth, color) {
  boxBounds(out, slot, [x - width / 2, y - height / 2, z - depth / 2],
    [x + width / 2, y + height / 2, z + depth / 2], color);
}

function directed(out, slot, points, normal, color) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, color);
  else face(out, slot, wound, color);
}

function surface(out, slot, ring, p, normal, color, holes = []) {
  const points = [...ring];
  const cutouts = holes.map((hole) => {
    const index = points.length;
    points.push(...hole);
    return index;
  });
  const indices = earcut(points.flat(), cutouts);
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, slot, indices.slice(i, i + 3).map((j) => p(...points[j])), normal, color);
  }
}

function edge(a, b, side) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const normal = [-side * dz / length, 0, side * dx / length];
  const p = (u, y, inset = 0) => [a[0] + dx * u / length - normal[0] * inset,
    y, a[1] + dz * u / length - normal[2] * inset];
  return { p, normal, length };
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters, v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) - terrain.modelDatumElevationMeters;
}

const lancet = (center, bottom, width, height, options = {}) =>
  ({ center, bottom, width, height, kind: 'lancet', ...options });

function profile(opening, lod) {
  const { center, bottom, width, height, kind } = opening;
  const r = width / 2, top = bottom + height;
  if (kind === 'circle') {
    const segments = [8, 12, 16, 24][lod];
    return Array.from({ length: segments }, (_, i) => {
      const a = i * 2 * Math.PI / segments;
      return [center + r * Math.cos(a), bottom + height / 2 + height / 2 * Math.sin(a)];
    });
  }
  const spring = top - Math.min(height * 0.42, width * 0.79);
  const segments = [2, 3, 5, 7][lod];
  return [[center - r, bottom], [center + r, bottom],
    ...Array.from({ length: 2 * segments + 1 }, (_, i) => {
      const t = i / segments - 1;
      return [center - r * t, spring + (top - spring) * (1 - Math.pow(Math.abs(t), 1.55))];
    })];
}

function surround(out, section, aperture, ring, inset, weight) {
  const { normal, p } = section;
  const outer = ring.map(([x, y]) => [
    aperture.center + (x - aperture.center) * (1 + 2 * weight / aperture.width),
    y + weight * (2 * (y - aperture.bottom) / aperture.height - 1),
  ]);
  for (let j = 0; j < ring.length; j++) {
    const k = (j + 1) % ring.length;
    directed(out, 'trim', [p(...ring[j], inset), p(...ring[k], inset),
      p(...outer[k], inset), p(...outer[j], inset)], normal, c.highlight);
  }
}

function tracery(out, section, aperture, inset, lod) {
  const { center: x, bottom, width, height, kind } = aperture, { p } = section;
  const draw = (a, b, thickness) => beam(out, 'trim', p(...a, inset), p(...b, inset),
    thickness, thickness * 0.74, c.trim);
  if (kind === 'circle') {
    const y = bottom + height / 2, count = lod === 3 ? 12 : 8;
    const radius = width * 0.47, inside = width * 0.115;
    const r = (a, distance) => [x + Math.cos(a) * distance, y + Math.sin(a) * distance];
    for (let i = 0; i < count; i++) {
      const a = i * 2 * Math.PI / count, next = (i + 1) * 2 * Math.PI / count;
      draw(r(a, inside), r(a, radius), 0.105);
      draw(r(a, inside), r(next, inside), 0.09);
      if (lod === 3) draw(r(a, radius * 0.80), r(next, radius * 0.80), 0.082);
    }
    return;
  }
  if (aperture.louvre) {
    for (let i = 1; i < (lod === 3 ? 12 : 8); i++) {
      const y = bottom + height * 0.062 * i;
      draw([x - width * 0.47, y], [x + width * 0.47, y], 0.12);
    }
    return;
  }
  if (aperture.door) {
    draw([x, bottom + 0.02], [x, bottom + height * 0.73], 0.075);
    draw([x - width * 0.48, bottom + height * 0.58], [x + width * 0.48, bottom + height * 0.58], 0.072);
    return;
  }
  draw([x, bottom + 0.03], [x, bottom + height - 0.24], 0.065);
  if (lod === 3) {
    for (const f of [0.30, 0.54, 0.70]) {
      const y = bottom + height * f;
      draw([x - width * 0.47, y], [x + width * 0.47, y], 0.055);
    }
  }
}

function wall(out, section, low, high, apertures, lod) {
  const { p, normal, length } = section;
  const border = [[0, low], [length, low], [length, high], [0, high]];
  const rings = apertures.map((aperture) => profile(aperture, lod));
  surface(out, 'stone', border, p, normal, c.stone, lod ? rings : []);
  for (const [i, aperture] of apertures.entries()) {
    const ring = rings[i], depth = lod ? aperture.inset ?? 0.36 : -0.022;
    surface(out, 'dark', ring, (x, y) => p(x, y, depth), normal,
      aperture.door ? c.doors : aperture.louvre ? c.deep : c.glass);
    if (!lod) continue;
    const center = p(aperture.center, aperture.bottom + aperture.height * 0.47);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      const midpoint = p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      directed(out, 'trim', [p(...a), p(...b), p(...b, depth), p(...a, depth)],
        center.map((n, axis) => n - midpoint[axis]), c.shadow);
    }
    if (lod >= 2 || aperture.emphasis) surround(out, section, aperture, ring, -0.047,
      aperture.emphasis ? 0.23 : 0.115);
    if (lod >= 2) tracery(out, section, aperture, depth - 0.029, lod);
  }
}

const faceEdge = (left, right, z, side = 1) => edge([left, z], [right, z], side);

function foundation(out, ring) {
  for (const [i, a] of ring.entries()) {
    const f = ring[(i + 1) % ring.length];
    const low = ([x, z]) => [x, Math.min(b.foundation - 0.19, grade(x, z) - 0.30), z];
    directed(out, 'base', [low(a), low(f), xy(f, b.foundation), xy(a, b.foundation)],
      [a[1] - f[1], 0, f[0] - a[0]], c.base);
  }
}

function buttress(out, x, z, y, width, depth, lod) {
  const levels = lod ? [0.46, 0.70, 1] : [1];
  let bottom = b.foundation;
  for (const [i, f] of levels.entries()) {
    const top = y * f;
    const taper = 1 - 0.20 * i;
    box(out, 'trim', x, (top + bottom) / 2, z, width * taper, top - bottom, depth * taper, c.trim);
    if (lod) box(out, 'trim', x, top, z, width * taper + 0.18, 0.20, depth * taper + 0.17, c.highlight);
    bottom = top;
  }
}

function tier(out, slot, lower, y0, upper, y1, color) {
  for (const [i, p] of lower.entries()) {
    const j = (i + 1) % lower.length;
    const a = lower[j];
    const normal = [a[1] - p[1], (y1 - y0) * 0.3, p[0] - a[0]];
    directed(out, slot, [xy(p, y0), xy(a, y0), xy(upper[j], y1), xy(upper[i], y1)],
      normal, color);
  }
}

const circularRing = (x, z, r, n, angle = 0) => Array.from({ length: n }, (_, i) => {
  const a = angle + i * Math.PI * 2 / n;
  return [x + Math.cos(a) * r, z + Math.sin(a) * r];
});

function roofSides(out, lod) {
  const z0 = b.lowZ, z1 = b.highZ;
  for (const dir of [-1, 1]) {
    const outer = dir < 0 ? b.aisleWest : b.aisleEast;
    const inner = b.center + dir * b.naveHalf;
    const side = edge([outer, z0], [outer, z1], -dir);
    const clerestory = edge([inner, z0], [inner, z1], -dir);
    const positions = Array.from({ length: 6 }, (_, i) => 4.6 + i * 8.23);
    wall(out, side, b.foundation, b.aisleEave, positions.map((x) => lancet(x, 5.0, 2.10, 9.45)), lod);
    const lights = positions.map((x) => lancet(x, 22.61, 0.94, 1.78));
    wall(out, clerestory, b.lowerRoofHigh, b.naveEave, lights, lod);
    directed(out, 'roof', [[outer, b.aisleEave, z0], [outer, b.aisleEave, z1],
      [inner, b.lowerRoofHigh, z1], [inner, b.lowerRoofHigh, z0]], up, c.roof);
    directed(out, 'roof', [[inner, b.naveEave, z0], [inner, b.naveEave, z1],
      [b.center, b.ridge, z1], [b.center, b.ridge, z0]], up, c.roof);
    if (lod) {
      for (const x of [0.55, ...positions.map((u) => u + 4.11), 56.3]) {
        buttress(out, outer + dir * 0.36, z0 + x, 17.10, 1.28, 1.02, lod === 1 ? 0 : lod);
      }
      for (const [x, y] of [[outer, b.aisleEave], [inner, b.naveEave]]) {
        beam(out, 'trim', [x, y - 0.04, z0], [x, y - 0.04, z1], 0.23, 0.29, c.trim);
      }
    }
    if (lod >= 2) {
      for (let j = 1; j < 22; j++) {
        const z = z0 + (z1 - z0) * j / 22;
        beam(out, 'roof', [inner, b.naveEave + 0.035, z], [b.center, b.ridge + 0.035, z],
          0.032, 0.048, c.seam);
      }
    }
  }
  const topProfile = [[b.center - b.naveHalf, b.lowerRoofHigh], [b.center + b.naveHalf, b.lowerRoofHigh],
    [b.center + b.naveHalf, b.naveEave], [b.center, b.ridge], [b.center - b.naveHalf, b.naveEave]];
  surface(out, 'stone', topProfile, (x, y) => [x, y, z0], [0, 0, -1], c.stone);
  beam(out, 'roof', [b.center, b.ridge, z0], [b.center, b.ridge, z1], 0.13, 0.13, c.seam);
}

function apse(out, lod) {
  const ring = outline.slice(0, 8).toReversed();
  const center = [2.0, -22.6];
  const roofY = 23.1, ridgeY = 30.4;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], f = ring[i + 1];
    const side = edge(a, f, -1);
    const windows = [lancet(side.length / 2, 6.05, Math.min(1.85, side.length * 0.55), 9.25)];
    if (side.length > 4.0) windows.push({ center: side.length / 2, bottom: 18.05,
      width: 1.38, height: 1.38, kind: 'circle' });
    wall(out, side, b.foundation, roofY, windows, lod);
    directed(out, 'roof', [xy(a, roofY), xy(f, roofY), xy(center, ridgeY)], up, c.roof);
    if (lod >= 2 && i !== 0) buttress(out, a[0], a[1], 17.5, 0.81, 0.86, 0);
  }
  for (const [outer, inner] of [[b.aisleWest, ring[0][0]], [ring.at(-1)[0], b.aisleEast]]) {
    const side = faceEdge(outer, inner, b.lowZ, -1);
    wall(out, side, b.foundation, b.aisleEave, [lancet(side.length / 2, 5.1, 1.8, 9.3)], lod);
    const eaveInner = inner < b.center ? inner : outer;
    const eaveOuter = inner < b.center ? outer : inner;
    directed(out, 'stone', [[eaveOuter, b.aisleEave, b.lowZ], [eaveInner, b.aisleEave, b.lowZ],
      [eaveInner, b.lowerRoofHigh, b.lowZ]], [0, 0, -1], c.stone);
  }
}

function steps(out, x, z, width, top, depth, lod) {
  const floor = grade(x, z + depth) - 0.13, count = lod ? 6 : 3;
  for (let j = 0; j < count; j++) {
    const height = (top - floor) * (j + 1) / count, run = depth * (count - j) / count;
    box(out, 'base', x, floor + height / 2, z + run / 2, width, height, run, c.base);
  }
}

function portals(out, lod) {
  const [tx] = t.center, left = tx - t.halfWidth, right = tx + t.halfWidth;
  const front = b.highZ;
  for (const [start, end, outside] of [[b.aisleWest, left, b.aisleWest], [right, b.aisleEast, b.aisleEast]]) {
    const section = faceEdge(start, end, front);
    const x = start + section.length * 0.55;
    const entrance = lancet(x - start, b.foundation + 0.04, 2.5, 5.54, { door: true, emphasis: true });
    wall(out, section, b.foundation, b.aisleEave, [entrance, lancet(x - start, 9.22, 1.88, 5.27)], lod);
    steps(out, x, front, 3.41, b.foundation + 0.09, 1.56, lod);
    buttress(out, outside, front - 0.17, 20.64, 1.57, 1.73, lod);
    const west = outside < tx;
    const inside = west ? end : start;
    const breakX = b.center + (west ? -1 : 1) * b.naveHalf;
    const atTower = b.naveEave + (b.ridge - b.naveEave) * (1 - Math.abs(inside - b.center) / b.naveHalf);
    const gable = [[outside, b.aisleEave], [breakX, b.lowerRoofHigh], [breakX, b.naveEave],
      [inside, atTower], [inside, b.aisleEave]];
    surface(out, 'stone', gable, (u, y) => [u, y, front], forward, c.stone);
    if (lod) {
      beam(out, 'trim', [outside, b.aisleEave + 0.09, front], [breakX, b.lowerRoofHigh + 0.07, front],
        0.27, 0.31, c.highlight);
    }
  }
  const porch = outline.slice(9, 14);
  for (let i = 0; i < porch.length - 1; i++) {
    const side = edge(porch[i], porch[i + 1], -1);
    wall(out, side, b.foundation, 8.88, i === 1 ? [lancet(side.length / 2, 2.02, 1.44, 4.42, { door: true })] : [], lod);
  }
  const [[, z0], , , [, z1]] = porch;
  const xOuter = Math.min(...porch.map(([x]) => x));
  const xInner = b.aisleWest + 0.15;
  const ridgeZ = (z0 + z1) / 2;
  for (const z of [z0, z1]) {
    directed(out, 'roof', [[xOuter, 8.88, z], [xInner, 8.88, z],
      [xInner, 10.33, ridgeZ], [xOuter, 10.33, ridgeZ]], up, c.roof);
  }
  directed(out, 'stone', [[xOuter, 8.88, z0], [xOuter, 8.88, z1],
    [xOuter, 10.33, ridgeZ]], [-1, 0, 0], c.stone);
}

function tower(out, lod) {
  const [x, z] = t.center, left = x - t.halfWidth, right = x + t.halfWidth;
  const back = 23.96, front = t.frontZ;
  const lower = [[left, back], [right, back], [right, front], [left, front]];
  for (const [i, a] of lower.entries()) {
    const f = lower[(i + 1) % lower.length];
    const section = edge(a, f, -1), middle = section.length / 2;
    const openings = i === 2 ? [
      lancet(middle, b.foundation + 0.04, 3.65, 8.64, { door: true, emphasis: true, inset: 0.60 }),
      { center: middle, bottom: 18.65, width: 4.8, height: 4.8, kind: 'circle', emphasis: true, inset: 0.48 },
    ] : i === 0 ? [] : [lancet(middle, 21.26, 1.34, 6.90)];
    wall(out, section, b.foundation, t.firstLedge, openings, lod);
    if (i === 2) {
      steps(out, x, front, 4.87, b.foundation + 0.10, 1.94, lod);
      const hood = lancet(middle, b.foundation + 0.03, 4.54, 9.25, { door: true });
      surround(out, section, hood, profile(hood, lod), -0.27, 0.17);
      const triangle = [[x - 2.92, 8.20], [x + 2.92, 8.20], [x, 14.0]];
      const lowerProfile = [[x - 2.92, 8.20], [x - 2.02, 8.20], [x, 10.25],
        [x + 2.02, 8.20], [x + 2.92, 8.20], [x, 14.0]];
      surface(out, 'trim', lowerProfile, (u, y) => [u, y, front + 0.27], forward, c.trim);
      if (lod) {
        for (const a of triangle.slice(0, 2)) {
          beam(out, 'trim', [a[0], a[1], front + 0.38], [x, 14.0, front + 0.38], 0.24, 0.31, c.highlight);
        }
        box(out, 'base', x, 10.62, front + 0.39, 0.81, 0.24, 0.54, c.base);
        box(out, 'trim', x, 11.26, front + 0.52, 0.39, 1.04, 0.35, c.highlight);
      }
    }
  }
  const lowerCenter = (back + front) / 2;
  for (const [y, rise, extra] of [[t.firstLedge - 0.46, 0.43, 0.38], [t.firstLedge, 0.40, 0.68]]) {
    box(out, 'trim', x, y, lowerCenter, t.halfWidth * 2 + extra, rise, front - back + extra, c.trim);
  }
  const r = 4.16;
  const belfry = [[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]];
  for (const [i, a] of belfry.entries()) {
    const f = belfry[(i + 1) % belfry.length];
    const section = edge(a, f, -1), mid = section.length / 2;
    const windows = [-1.36, 1.36].map((u) => lancet(mid + u, 34.32, 1.68, 9.06,
      { louvre: true, inset: 0.46, emphasis: lod >= 2 }));
    wall(out, section, t.firstLedge, t.bellTop, windows, lod);
    if (lod >= 2) {
      for (let j = 1; j < 10; j++) {
        const p = section.p(j * section.length / 10, t.bellTop - 0.31, -0.12);
        box(out, 'trim', ...p, 0.22, 0.40, 0.22, c.highlight);
      }
    }
  }
  box(out, 'trim', x, t.bellTop + 0.02, z, r * 2 + 0.49, 0.42, r * 2 + 0.49, c.highlight);
  for (const [dx, dz] of [[-1,-1], [-1,1], [1,-1], [1,1]]) {
    const atX = x + dx * 4.30, atZ = z + dz * 4.26;
    box(out, 'trim', atX, 30.72, atZ, 1.42, 27.66, 1.43, c.trim);
    if (lod) box(out, 'trim', atX, 44.66, atZ, 1.66, 0.37, 1.67, c.highlight);
    tier(out, 'roof', circularRing(atX, atZ, 0.85, 4, Math.PI / 4), 44.68,
      circularRing(atX, atZ, 0.065, 4, Math.PI / 4), 49.22, c.steeple);
  }
  const main = circularRing(x, z, 4.0, 8, Math.PI / 8);
  const shoulder = circularRing(x, z, 2.70, 8, Math.PI / 8);
  const tip = circularRing(x, z, 0.083, 8, Math.PI / 8);
  tier(out, 'roof', main, t.bellTop + 0.17, shoulder, t.spireShoulder, c.steeple);
  tier(out, 'roof', shoulder, t.spireShoulder, tip, t.spireTip, c.steeple);
  if (lod >= 2) {
    for (const [i, p] of shoulder.entries()) {
      beam(out, 'roof', xy(p, t.spireShoulder + 0.015), xy(tip[i], t.spireTip), 0.040, 0.047, c.seam);
    }
  }
  beam(out, 'metal', [x, t.spireTip - 0.10, z], [x, t.crossTop, z], 0.12, 0.13, c.cross);
  beam(out, 'metal', [x - 0.48, t.crossTop - 0.37, z], [x + 0.48, t.crossTop - 0.37, z],
    0.11, 0.10, c.cross);
}

function build(out, lod) {
  foundation(out, outline);
  roofSides(out, lod);
  apse(out, lod);
  portals(out, lod);
  tower(out, lod);
}

export const basilicaSkyline = (out) => build(out, 0);
export const basilicaDistrict = (out) => build(out, 1);
export const basilicaStreet = (out) => build(out, 2);
export const basilicaCloseup = (out) => build(out, 3);

const recipe = 'montreal-st-patricks-model.mjs', camera = [88, 40, 110], lookAt = [0, 27, 2];
const authoredLevels = Object.fromEntries([
  ['district', 'basilicaDistrict', 0.46], ['street', 'basilicaStreet', 0.15], ['closeup', 'basilicaCloseup', 0.041],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));
export const basilicaModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: basilicaCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Montréal greystone Gothic Revival basilica with three pointed portals, a rose window, a copper spire and a rounded apse.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.94, basis: 'The named St. Patrick’s Basilica outline from OpenStreetMap way 112854784.' },
  mediumFiContext: { scale: 2.25, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone_raw', 'metal_copper', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    { name: 'historic-front-and-spire', position: [9, 22, 126], lookAt: [0, 31.5, 20] },
    { name: 'rose-and-three-pointed-portals', position: [32, 16, 67], lookAt: [0, 13.5, 34] },
    { name: 'rounded-apse-and-six-lancet-bays', position: [-66, 28, -64], lookAt: [1, 14, -16] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-basilica-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline', export: 'basilicaSkyline', errorMeters: 0.88, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. The mapped footprint is ODbL. The exact historical Qualla stereograph is public domain with a CC0 digitization.',
};
