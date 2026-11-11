/** Three axial halls and their side ranges at Thien Hau Temple, Cholon. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, beamPath, loft, normalFor, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const section = plan.section;
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [siteOutline] = frame.geometry.polygons;
const features = new Map(frame.features.map((feature) => [feature.id, feature]));
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.90, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  glaze: { slot: 'trim', graph: 'tile_glazed', roughness: 0.57, metallic: 0.02 },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.18 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'c3bdac', shade: 'a39c8a', pier: 'bebdb1', stone: '9d9b92', step: 'aaa798',
  paving: 'b5b0a3', sill: '706e64', greenTile: '435953', greyTile: '66695e',
  lip: '86998a', glaze: '5b7870', relief: '8f8c73', porcelain: 'c6bdb0', red: '924132',
  redDark: '5e2b22', dark: '39302a', gold: 'b19253', green: '418579', bronze: '776044',
  terracotta: '9a725d', charcoal: '515654',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff';
const up = [0, 1, 0];

function surface(out, slot, points, outward, color) {
  let n = normalFor(...points);
  if (n.reduce((a, v, i) => a + v * outward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else out.addTriangle(slot, white, points, n, [[0, 0], [1, 0], [0, 1]], color);
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v);
  const dx = u - i, dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}
const corners = ([loX, hiX, loZ, hiZ]) => [[loX, loZ], [hiX, loZ], [hiX, hiZ], [loX, hiZ]];

function perimeter(out, ring, slot, bottom, top, color) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.015) continue;
    surface(out, slot, [[a[0], bottom(...a), a[1]], [b[0], bottom(...b), b[1]],
      [b[0], top, b[1]], [a[0], top, a[1]]], [b[1] - a[1], 0, a[0] - b[0]], color);
  }
}

function foundation(out, ring, y) {
  perimeter(out, ring, 'stone', (x, z) => Math.min(y - 0.12, ground(x, z) - 0.20), y, c.stone);
  const triangles = earcut(ring.flat());
  if (!triangles.length) throw Error('Temple foundation outline could not be triangulated');
  for (let i = 0; i < triangles.length; i += 3) {
    const vertices = triangles.slice(i, i + 3).map((index) => [ring[index][0], y, ring[index][1]]);
    surface(out, 'stone', vertices, up, c.paving);
  }
}

function paving(out, bounds, lod, forecourt) {
  const [loX, hiX, loZ, hiZ] = bounds;
  const divisions = lod < 2 ? 3 : lod === 2 ? 6 : 9;
  for (let i = 0; i < divisions; i++) {
    const z = loZ + (hiZ - loZ) * i / divisions;
    const end = loZ + (hiZ - loZ) * (i + 1) / divisions;
    const inset = lod >= 2 ? 0.012 : 0;
    const left = (zz) => [loX, ground(loX, zz) + 0.075, zz];
    const right = (zz) => [hiX, ground(hiX, zz) + 0.075, zz];
    const a = left(z + inset), b = right(z + inset);
    const d = left(end - inset), e = right(end - inset);
    const tint = i % 4 === 2 ? c.paving.map((v) => v * 0.90) : c.paving;
    surface(out, 'stone', [a, b, e], up, tint);
    surface(out, 'stone', [a, e, d], up, tint);
  }
  if (forecourt && lod >= 2) {
    for (const x of [section.axisX - 2.08, section.axisX + 2.08]) {
      const line = Array.from({ length: 5 }, (_, i) => {
        const z = loZ + (hiZ - loZ) * i / 4;
        return [x, ground(x, z) + 0.095, z];
      });
      beamPath(out, 'stone', line, 0.10, 0.05, c.sill);
    }
  }
}

function pillar(out, x, floor, z, height, color, square, lod) {
  if (lod) {
    box(out, 'stone', x, floor, z, 0.80, 0.16, 0.80, c.step);
    box(out, 'stone', x, floor + 0.16, z, 0.63, 0.23, 0.63, c.stone);
  }
  const base = floor + (lod ? 0.39 : 0);
  if (square || lod < 2) box(out, square ? 'wall' : 'wood', x, base, z, square ? 0.54 : 0.39, height - (base - floor), square ? 0.57 : 0.39, color);
  else {
    const sides = lod === 3 ? 12 : 8;
    loft(out, 'wood', [radialRing(base, 0.224, 0.224, sides, [x, z]),
      radialRing(floor + height, 0.186, 0.186, sides, [x, z])], color);
  }
  if (lod >= 2) {
    box(out, square ? 'wall' : 'wood', x, floor + height - 0.26, z, 0.76, 0.24, 0.74, color);
    if (square) {
      box(out, 'wood', x, floor + 1.1, z + 0.30, 0.19, height - 1.9, 0.061, c.redDark);
      box(out, 'glaze', x, floor + 1.29, z + 0.345, 0.029, height - 2.34, 0.014, c.gold);
    }
  }
}

// Concave roof slopes rise more steeply near the ridge. Ceramic end stops turn up at both gables.
function roof(out, [a, b, lo, hi], eave, rise, lift, lod, longitudinal, roofColor) {
  const ridge = (lo + hi) / 2;
  const profile = !lod ? [[0, 0], [1, 1]] : lod === 1 ? [[0, 0], [0.46, 0.31], [1, 1]] :
    [[0, 0], [0.17, 0.058], [0.39, 0.229], [0.67, 0.566], [1, 1]];
  const gable = Math.min(1.45, (b - a) * 0.10);
  const spans = lod ? [a, a + gable, b - gable, b] : [a, b];
  const coord = (x, y, z) => longitudinal ? [z, y, x] : [x, y, z];
  const yFor = (x, riseFraction) => {
    const edge = Math.max(0, 1 - Math.min(x - a, b - x) / gable);
    return eave + rise * riseFraction + lift * edge * edge * (1 - 0.53 * riseFraction);
  };
  const panel = (x, edge, [t, y]) => coord(x, yFor(x, y), edge + (ridge - edge) * t);
  for (const edge of [lo, hi]) {
    for (let j = 1; j < profile.length; j++) {
      for (let i = 1; i < spans.length; i++) {
        const [x, v] = spans.slice(i - 1, i + 1);
        const low = profile[j - 1], high = profile[j];
        const points = [panel(x, edge, low), panel(v, edge, low), panel(v, edge, high), panel(x, edge, high)];
        surface(out, 'roof', points, up, roofColor);
        if (j === 1) {
          const below = [points[0], points[1]].map(([px, py, pz]) => [px, py - 0.24, pz]);
          const direction = Math.sign(edge - ridge);
          surface(out, 'wood', [below[0], below[1], points[1], points[0]], longitudinal ? [direction, 0, 0] : [0, 0, direction], c.redDark);
        }
      }
    }
    for (const x of [a, b]) {
      const edgeNormal = longitudinal ? [0, 0, x === a ? -1 : 1] : [x === a ? -1 : 1, 0, 0];
      for (let j = 1; j < profile.length; j++) {
        const p = panel(x, edge, profile[j - 1]), q = panel(x, edge, profile[j]);
        const y = eave - 0.20;
        surface(out, 'wall', [coord(x, y, longitudinal ? p[0] : p[2]), coord(x, y, longitudinal ? q[0] : q[2]), q, p],
          edgeNormal, c.shade);
      }
      if (lod) beamPath(out, 'glaze', profile.map((shape) => panel(x, edge, shape)), 0.16, 0.18, c.glaze);
    }
    if (lod >= 2) {
      const spacing = lod === 3 ? 0.40 : 0.76;
      const sign = Math.sign(ridge - edge);
      for (let x = a + 0.18; x < b - 0.08; x += spacing) {
        const at = (f) => coord(x, yFor(x, 0.01) - 0.045, edge + sign * f);
        beam(out, 'glaze', at(-0.06), at(0.47), 0.18, 0.15, c.lip);
        if (lod === 3 && !longitudinal) {
          beamPath(out, 'roof', profile.map((shape) => {
            const [px, py, pz] = panel(x, edge, shape);
            return [px, py + 0.044, pz];
          }), 0.085, 0.085, c.greyTile);
        }
      }
    }
  }
  const top = spans.map((x) => coord(x, yFor(x, 1) + 0.06, ridge));
  beamPath(out, 'glaze', top, 0.24, 0.24, c.glaze);
  return { ridge, top: eave + rise, a, b };
}

function crest(out, { a, b, ridge, top }, lod, entrance) {
  const z = ridge;
  const width = b - a;
  const mid = (a + b) / 2;
  const baseWidth = width * 0.86;
  const height = entrance ? 0.86 : 0.59;
  box(out, 'glaze', mid, top + 0.09, z, baseWidth, height, 0.64, c.glaze);
  if (!lod && !entrance) return;
  if (lod) box(out, 'glaze', mid, top + height, z, baseWidth + 0.18, 0.15, 0.75, c.lip);
  for (const sign of [-1, 1]) {
    const x = mid + sign * width * 0.441;
    const y = top + height;
    const fin = [[x - sign * 0.76, y - 0.10, z], [x - sign * 0.12, y + 0.43, z],
      [x + sign * 0.14, y + 0.82, z], [x + sign * 0.08, y + 1.21, z],
      [x - sign * 0.26, y + 1.10, z]];
    beamPath(out, 'glaze', lod ? fin : [fin[0], fin[2], fin[4]], 0.40, 0.34, c.glaze);
  }
  const pavilions = !lod ? 2 : entrance ? 7 : 4;
  for (let i = 0; i < pavilions; i++) {
    const x = mid + baseWidth * ((i + 0.5) / pavilions - 0.5);
    const y = top + height + 0.08;
    const levels = i % 3 === 1 && lod >= 2 ? 2 : 1;
    for (let j = 0; j < levels; j++) {
      const floor = y + j * 0.52;
      const w = 0.76 - j * 0.21 + (i % 3) * 0.12;
      box(out, 'glaze', x, floor, z, w * 0.71, 0.35, 0.43, c.relief);
      const at = (u, v, depth) => [x + u * w, floor + v, z + depth];
      for (const side of [-1, 1]) {
        surface(out, 'glaze', [at(-0.63, 0.37, side * 0.35), at(0.63, 0.37, side * 0.35),
          at(0.53, 0.62, 0), at(-0.53, 0.62, 0)], up, c.glaze);
      }
    }
  }
  if (lod >= 2) {
    const count = entrance ? lod === 3 ? 29 : 17 : lod === 3 ? 17 : 9;
    for (let i = 0; i < count; i++) {
      const x = mid + baseWidth * ((i + 0.48) / count - 0.5);
      const y = top + height - 0.24;
      const figureHeight = 0.34 + (i * 7 % 5) * 0.08;
      const coat = [c.glaze, c.terracotta, c.relief, c.porcelain][i % 4];
      const rowZ = z + 0.32 + (i % 3) * 0.11;
      box(out, 'glaze', x, y, rowZ, 0.19, figureHeight, 0.19, coat);
      box(out, 'glaze', x, y + figureHeight, rowZ, 0.134, 0.13, 0.14, c.porcelain);
      if (lod === 3 && i % 2 === 0) beam(out, 'glaze', [x, y + 0.26, rowZ], [x + 0.18, y + 0.34, rowZ + 0.06], 0.058, 0.06, coat);
    }
  }
}

function lantern(out, x, y, z, lod) {
  const rings = [[0, 0.25], [0.11, 0.40], [0.35, 0.49], [0.60, 0.38], [0.74, 0.21]];
  const profile = lod >= 2 ? rings : [rings[0], rings[2], rings[4]];
  loft(out, 'glaze', profile.map(([h, r]) => radialRing(y + h, r, r, lod >= 2 ? 10 : 6, [x, z])), c.bronze);
  if (lod >= 2) beam(out, 'metal', [x, y + 0.72, z], [x, y + 1.18, z], 0.046, 0.046, c.dark);
}

function frontGrille(out, y, z, x, lod) {
  const archHeight = 2.45;
  const point = (t) => [x + Math.cos(t) * 1.51, y + archHeight + Math.sin(t) * 0.63, z];
  const count = [4, 6, 9, 14][lod];
  const arch = Array.from({ length: count + 1 }, (_, i) => point(i * Math.PI / count));
  beamPath(out, 'metal', [[x + 1.51, y, z], ...arch, [x - 1.51, y, z]], 0.13, 0.14, c.green);
  if (lod) {
    beamPath(out, 'glaze', arch.map(([a, b, zz]) => [a, b - 0.10, zz + 0.066]), 0.085, 0.09, c.red);
    for (const side of [-1, 1]) {
      box(out, 'wood', x + side * 1.60, y + 0.12, z + 0.08, 0.23, 2.31, 0.10, c.red);
    }
  }
}

function fenceSection(out, a, b, z, y, height, lod, ornate) {
  const color = ornate ? c.green : c.charcoal;
  const width = b - a;
  const top = y + height;
  const horizontal = (h) => beam(out, 'metal', [a, h, z], [b, h, z], 0.08, 0.069, color);
  horizontal(top - 0.10);
  if (!lod) return;
  horizontal(y + 0.21);
  const count = Math.ceil(width / (lod === 3 ? 0.23 : lod === 2 ? 0.35 : 0.94));
  for (let i = 0; i <= count; i++) {
    const x = a + width * i / count;
    beam(out, 'metal', [x, y, z], [x, top + (ornate ? 0.04 : 0), z], 0.041, 0.043, color);
  }
}

function hall(out, kind, bounds, floor, eave, lod) {
  const [left, right, back, front] = bounds;
  const middle = (left + right) / 2, width = right - left, depth = front - back;
  const entrance = kind === 'entrance';
  const eaveY = floor + eave;
  foundation(out, corners(bounds), floor);
  for (const x of [left + 0.20, right - 0.20]) {
    box(out, 'wall', x, floor, (back + front) / 2, 0.40, eave - 0.19, depth, c.shade);
  }
  if (kind === 'sanctuary') box(out, 'wall', middle, floor, back + 0.31, width - 0.23, eave - 0.18, 0.49, c.shade);
  if (entrance || kind === 'sanctuary') {
    const bay = entrance ? 4.28 : 4.67;
    for (const x of [left + 0.49, middle - bay / 2, middle + bay / 2, right - 0.48]) {
      pillar(out, x, floor, front - 0.18, eave - 0.09, entrance ? c.pier : c.redDark, entrance, lod);
    }
    if (lod) {
      const wallFront = front - (entrance ? 3.03 : 3.67);
      for (const side of [-1, 1]) {
        box(out, 'wood', middle + side * width * 0.312, floor, wallFront, width * 0.342, eave - 0.57, 0.27, c.dark);
      }
      box(out, 'wood', middle, floor + 2.87, wallFront, width * 0.35, eave - 2.98, 0.35, c.redDark);
      box(out, 'wood', middle, floor + 2.98, front - 0.39, 3.13, 0.50, 0.24, c.redDark);
      box(out, 'glaze', middle, floor + 3.32, front - 0.26, 2.72, 0.043, 0.037, c.gold);
      for (const side of [-1, 1]) lantern(out, middle + side * 4.72, eaveY - 1.25, front - 0.42, lod);
      if (entrance) {
        for (const side of [-1, 1]) {
          box(out, 'wood', middle + side * 2.63, floor, wallFront + 0.045, 2.63, 2.94, 0.19, c.redDark);
          box(out, 'wood', middle + side * 1.38, floor, wallFront + 0.16, 0.20, 3.02, 0.16, c.dark);
          if (lod >= 2) {
            const x = middle + side * 8.58;
            pillar(out, x, floor, front - 0.37, eave - 0.11, c.pier, true, lod);
            beam(out, 'wall', [x, eaveY - 0.80, front - 0.12], [x - side * 0.67, eaveY - 0.38, front + 0.04],
              0.20, 0.26, c.pier);
          }
        }
      }
    }
  } else {
    for (const x of [middle - width * 0.34, middle + width * 0.34]) {
      for (const z of [front - 0.55, back + 0.55]) pillar(out, x, floor, z, eave, c.red, false, lod);
    }
  }
  box(out, 'wood', middle, eaveY - 0.40, front - 0.19, width, 0.30, 0.32, c.redDark);
  if (lod >= 2) {
    for (let x = left + 0.34; x < right - 0.10; x += 0.85) {
      box(out, 'wood', x, eaveY - 0.37, front + 0.05, 0.17, 0.23, 0.61, c.redDark);
    }
  }
  const gable = roof(out, [left - 0.46, right + 0.46, back - 0.68, front + 0.99], eaveY,
    entrance ? 1.67 : 1.85, entrance ? 0.39 : 0.24, lod, false, c.greenTile);
  crest(out, gable, lod, entrance);
  if (!entrance) return;

  const z = front + 0.23;
  for (const side of [-1, 1]) {
    const inner = middle + side * 1.74, outer = side < 0 ? left + 0.70 : right - 0.70;
    const [a, b] = [inner, outer].sort((a, b) => a - b);
    box(out, 'stone', (a + b) / 2, floor - 0.12, z, b - a, 0.31, 0.64, c.step);
    fenceSection(out, a, b, z + 0.04, floor + 0.18, 1.32, lod, true);
  }
  frontGrille(out, floor, z + 0.08, middle, lod);
  const low = Math.min(floor - 0.14, ground(middle, z + 1.44));
  for (let i = lod ? 0 : 2; i < 3; i++) {
    box(out, 'stone', middle, low - 0.20, z + 1.22 - i * 0.31, 3.26,
      (floor - low) * (i + 1) / 3 + 0.17, 0.57, c.step);
  }
}

function ranges(out, lod) {
  for (const [i, id] of section.sideRangeFeatureIds.entries()) {
    const ring = features.get(id).outline;
    const xs = ring.map(([x]) => x), zs = ring.map(([, z]) => z);
    const loX = Math.min(...xs), hiX = Math.max(...xs), loZ = Math.min(...zs), hiZ = Math.max(...zs);
    const east = i === 0;
    const outside = east ? hiX - 0.34 : loX + 0.34;
    const inside = east ? 8.73 : -5.49;
    const eave = 4.92;
    const [left, right] = [outside, inside].sort((a, b) => a - b);
    if (lod) paving(out, [left, right, loZ + 0.06, hiZ - 0.06], lod, false);
    const count = lod >= 2 ? 12 : lod ? 4 : 1;
    const outerRing = (z) => {
      const h = ground(outside, z) - 0.21;
      return [[outside - 0.27, h, z], [outside + 0.27, h, z],
        [outside + 0.27, eave - 0.26, z], [outside - 0.27, eave - 0.26, z]];
    };
    // The ends and the two long wall faces follow the preserved field below the corridor roof.
    for (let i = 0; i < count; i++) {
      const a = outerRing(loZ + (hiZ - loZ) * i / count);
      const b = outerRing(loZ + (hiZ - loZ) * (i + 1) / count);
      surface(out, 'wall', [a[0], b[0], b[3], a[3]], [-1, 0, 0], c.wall);
      surface(out, 'wall', [a[1], b[1], b[2], a[2]], [1, 0, 0], c.shade);
    }
    for (const z of [loZ + 0.30, hiZ - 1.85]) {
      const y = Math.min(ground(left, z), ground(right, z)) - 0.20;
      box(out, 'wall', (outside + inside) / 2, y, z, right - left, eave - y - 0.20, 0.55, c.wall);
    }
    if (lod) {
      for (let z = loZ + 1.7; z < hiZ - 0.40; z += lod >= 2 ? 4.55 : 6.35) {
        const y = ground(inside, z) + 0.065;
        pillar(out, inside, y, z, eave - y - 0.07, c.redDark, false, lod >= 2 ? 2 : 0);
      }
    }
    beam(out, 'wood', [inside, eave - 0.14, loZ], [inside, eave - 0.14, hiZ], 0.22, 0.28, c.redDark);
    // The front hall's transverse roof covers the streetward ends of both side ranges.
    roof(out, [loZ - 0.21, section.frontHall[2] + 0.31, loX - 0.16, hiX + 0.16], eave, 1.09, 0.13,
      Math.max(0, lod - 1), true, c.greyTile);
  }
  const rear = features.get(section.rearRangeFeatureId).outline;
  foundation(out, rear, 0.88);
  perimeter(out, rear, 'wall', () => 0.88, 4.15, c.shade);
  roof(out, [-11.27, 15.49, -57.03, -41.61], 4.15, 1.52, 0.07, Math.max(0, lod - 1), false, c.greyTile);
}

function streetFence(out, lod) {
  const fence = features.get(section.streetFenceFeatureId);
  const z = section.streetBoundaryZ;
  const [left, right] = [fence.points[0][0], fence.points.at(-1)[0]];
  const gates = frame.features.filter((feature) => feature.role === 'street-gate-control').map((feature) => feature.points[0][0]);
  let start = left + 0.12;
  for (const [i, gate] of gates.entries()) {
    const span = i === 1 ? 1.52 : 1.02;
    const end = gate - span;
    const floor = ground((start + end) / 2, z) + 0.04;
    box(out, 'stone', (start + end) / 2, floor - 0.14, z, end - start, 0.33, 0.38, c.stone);
    fenceSection(out, start, end, z, floor + 0.19, 1.32, Math.max(0, lod - 1), false);
    if (lod) {
      for (const x of [end, gate + span]) {
        box(out, 'wall', x, floor - 0.09, z, 0.29, 1.75, 0.36, c.pier);
      }
    }
    start = gate + span;
  }
  const floor = ground((start + right) / 2, z) + 0.04;
  box(out, 'stone', (start + right) / 2, floor - 0.14, z, right - start, 0.33, 0.38, c.stone);
  fenceSection(out, start, right, z, floor + 0.19, 1.32, Math.max(0, lod - 1), false);
}

function build(out, lod) {
  paving(out, [-11.90, 14.36, 24.51, 33.66], lod, true);
  paving(out, [-5.83, 8.44, ...section.firstLightCourtZ], lod, false);
  paving(out, [-5.28, 8.70, ...section.incenseCourtZ], lod, false);
  ranges(out, lod);
  hall(out, 'entrance', section.frontHall, 0.85, 4.52, lod);
  hall(out, 'middle', section.middleHall, 2.42, 3.54, lod);
  hall(out, 'sanctuary', section.sanctuary, 2.10, 4.22, lod);
  streetFence(out, lod);
}

export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);

const recipe = 'thien-hau-temple-model.mjs';
const camera = [58, 48, 101], lookAt = [1.50, 3.40, -8.40];
const authoredLevels = Object.fromEntries([
  ['district', 'templeDistrict', 0.44], ['street', 'templeStreet', 0.20], ['closeup', 'templeCloseup', 0.065],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const templeModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: templeCloseup, category: 'temple', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Thien Hau Temple in Cholon with a green-grilled entrance, dense ceramic ridge ornament, open courts and three timber halls.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline: siteOutline, minimumCoverage: 0.91, basis: 'Named temple compound perimeter, OpenStreetMap way 1497050780.' },
  mediumFiContext: { scale: 0.88, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_granite', 'tile_ceramic', 'tile_glazed', 'wood_plain', 'metal_painted'],
  qaCameras: [
    { name: 'green-grille-and-ceramic-street-front', position: [9.5, 6.7, 52], lookAt: [1.55, 4.8, 23.3] },
    { name: 'open-courts-and-three-ceramic-roofs', position: [41, 32, 16], lookAt: [1.5, 4, -8.2] },
    { name: 'rear-range-and-full-compound', position: [-47, 44, -92], lookAt: [0.5, 3.6, -16] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-thien-hau-temple-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'templeSkyline', errorMeters: 0.88, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and three exact first-party CC0 Qualla photographs.',
};
