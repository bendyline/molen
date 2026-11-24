import { readFileSync } from 'node:fs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/fort-beausejour-shape-controls');
const terrain = read('terrain-grid');
const surfaces = {
  grass: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 1 },
  stone: { slot: 'trim', graph: 'stone_drywall', roughness: 0.98 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  dark: { slot: 'window', localRef: 'palette:#fdfdfd', roughness: 0.98 },
};
const greens = ['a1a17a', '929565', '898f60', '83895b', '8c8e61'].map(rgb);
const dirt = rgb('858069');
const wall = rgb('a29781');
const wallTop = rgb('b1a68d');
const shadowStone = rgb('817562');
const timber = rgb('887d68');
const dim = rgb('454037');
const extent = outwardRing(shape.surfaceExtent);

const minX = Math.min(...extent.map(([x]) => x));
const maxX = Math.max(...extent.map(([x]) => x));
const minZ = Math.min(...extent.map(([, z]) => z));
const maxZ = Math.max(...extent.map(([, z]) => z));

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = u - i,
    b = v - j;
  const north = terrain.heightsMeters[j],
    south = terrain.heightsMeters[j + 1];
  const top = north[i] * (1 - a) + north[i + 1] * a;
  const bottom = south[i] * (1 - a) + south[i + 1] * a;
  return top * (1 - b) + bottom * b - terrain.modelDatumElevationMeters;
}

function ground([x, z], lift = 0.07) {
  return [x, grade(x, z) + lift, z];
}

function signedDistance(a, b, p) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

/** Clip a heightfield cell against the convex boundary at the outside of the surveyed ditch. */
function clipCell(cell) {
  let polygon = cell;
  for (let i = 0; i < extent.length && polygon.length > 0; i++) {
    const a = extent[i],
      b = extent[(i + 1) % extent.length],
      next = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j],
        q = polygon[(j + 1) % polygon.length];
      const s = signedDistance(a, b, p),
        t = signedDistance(a, b, q);
      if (s <= 0) next.push(p);
      if (s <= 0 === t <= 0) continue;
      const ratio = s / (s - t);
      next.push([p[0] + ratio * (q[0] - p[0]), p[1] + ratio * (q[1] - p[1])]);
    }
    polygon = next;
  }
  return polygon;
}

function earthworks(out, level) {
  const divisions = [16, 34, 72, 122][level];
  const dx = (maxX - minX) / divisions,
    dz = (maxZ - minZ) / divisions;
  for (let j = 0; j < divisions; j++) {
    const z0 = minZ + j * dz,
      z1 = z0 + dz;
    for (let i = 0; i < divisions; i++) {
      const x0 = minX + i * dx,
        x1 = x0 + dx;
      const clipped = clipCell([
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x1, z0],
      ]);
      const points = clipped.map((p) => ground(p));
      if (points.length < 3) continue;
      const middle = grade((x0 + x1) / 2, (z0 + z1) / 2);
      const shade = Math.max(0, Math.min(greens.length - 1, Math.floor(middle + 2.4)));
      for (let k = 1; k < points.length - 1; k++) {
        if (Math.abs(signedDistance(clipped[0], clipped[k], clipped[k + 1])) < 0.001) continue;
        tri(out, 'grass', points[0], points[k], points[k + 1], greens[shade]);
      }
    }
  }
  for (let i = 0; i < extent.length; i++) {
    const a = extent[i],
      b = extent[(i + 1) % extent.length];
    const pieces = level === 0 ? 1 : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5);
    for (let j = 0; j < pieces; j++) {
      const p = ground(a.map((value, k) => value + ((b[k] - value) * j) / pieces));
      const q = ground(a.map((value, k) => value + ((b[k] - value) * (j + 1)) / pieces));
      quad4(out, 'grass', q, p, [p[0], p[1] - 0.65, p[2]], [q[0], q[1] - 0.65, q[2]], dirt);
    }
  }
}

function stoneWall(out, a, b, thickness, height, level) {
  const f = wallFace(a, b),
    half = thickness * 0.5;
  const n = level >= 2 ? Math.ceil(f.length / (level === 3 ? 1.45 : 3.1)) : 1;
  for (let i = 0; i < n; i++) {
    const a = (i * f.length) / n,
      b = ((i + 1) * f.length) / n;
    const x0 = f.P(a, 0),
      x1 = f.P(b, 0);
    const y0 = grade(x0[0], x0[2]),
      y1 = grade(x1[0], x1[2]);
    const base0 = y0 - 0.28,
      base1 = y1 - 0.28;
    const crown0 = y0 + height + (level >= 2 ? 0.046 * Math.sin(a * 1.67) : 0);
    const crown1 = y1 + height + (level >= 2 ? 0.046 * Math.sin(b * 1.67) : 0);
    const A = f.P(a, base0, half),
      B = f.P(b, base1, half);
    const C = f.P(b, crown1, half),
      D = f.P(a, crown0, half);
    const p = f.P(a, base0, -half),
      q = f.P(b, base1, -half);
    const r = f.P(b, crown1, -half),
      s = f.P(a, crown0, -half);
    quad4(out, 'stone', A, B, C, D, wall);
    quad4(out, 'stone', q, p, s, r, shadowStone);
    quad4(out, 'stone', D, C, r, s, wallTop);
    if (i === 0) quad4(out, 'stone', p, A, D, s, wall);
    if (i + 1 === n) quad4(out, 'stone', B, q, r, C, wall);
  }
}

function foundations(out, level) {
  for (const ruin of shape.foundations) {
    const ring = outwardRing(ruin.outline);
    const height = ruin.name === 'Provision Store' ? 0.69 : 0.62;
    for (let i = 0; i < ring.length; i++)
      stoneWall(out, ring[i], ring[(i + 1) % ring.length], 0.53, height, level);
  }
  if (level === 0) return;
  for (const { id, points } of shape.retainingWalls) {
    // The embankments are turf in the measured elevation field.
    if (id === '1501630262' || id === '1501630266') continue;
    for (let i = 1; i < points.length; i++)
      stoneWall(out, points[i - 1], points[i], 0.55, 0.63, level);
  }
}

function magazine(out, level) {
  const [a, b] = [shape.magazine[1], shape.magazine.at(-2)];
  const f = wallFace(a, b);
  const u = f.length * 0.55;
  const [x, , z] = f.P(u, 0, 0.22);
  const y = grade(x, z) + 0.08;
  const spring = y + 0.83,
    half = 0.76,
    lintel = spring + half + 0.28,
    depth = 1.48;
  fbox(out, 'stone', f, 0.42, u - half, y - 0.28, lintel, -depth, 0.24, wall);
  fbox(out, 'stone', f, u + half, f.length - 0.3, y - 0.28, lintel, -depth, 0.24, wall);
  const curve = roundArch(half, [4, 6, 9, 12][level]);
  for (let i = 1; i < curve.length; i++) {
    const [l, h0] = curve[i - 1],
      [r, h1] = curve[i];
    const frontL = f.P(u + l, spring + h0, 0.24),
      frontR = f.P(u + r, spring + h1, 0.24);
    quad4(
      out,
      'stone',
      frontL,
      frontR,
      f.P(u + r, lintel, 0.24),
      f.P(u + l, lintel, 0.24),
      wallTop,
    );
    quad4(
      out,
      'stone',
      frontR,
      frontL,
      f.P(u + l, spring + h0, -depth),
      f.P(u + r, spring + h1, -depth),
      shadowStone,
    );
  }
  fbox(
    out,
    'dark',
    f,
    u - half,
    u + half,
    y - 0.04,
    lintel - 0.045,
    -depth - 0.08,
    -depth - 0.03,
    dim,
  );
  fbox(
    out,
    'stone',
    f,
    0.35,
    f.length - 0.22,
    lintel,
    lintel + 0.17,
    -depth - 0.04,
    0.27,
    wallTop,
    { bottom: true },
  );
}

function boardwalk(out, level) {
  if (level === 0) return;
  const points = shape.boardwalk.slice(0, 13);
  for (let i = 1; i < points.length; i++) {
    const f = wallFace(points[i - 1], points[i]);
    const n = level >= 2 ? Math.ceil(f.length / (level === 3 ? 0.46 : 1.1)) : 1;
    for (let j = 0; j < n; j++) {
      const a = (j * f.length) / n,
        b = ((j + 1) * f.length) / n;
      const p = f.P(a, 0),
        q = f.P(b, 0);
      const y0 = grade(p[0], p[2]) + 0.16,
        y1 = grade(q[0], q[2]) + 0.16;
      const lo = level === 3 ? a + 0.013 : a;
      quad4(
        out,
        'wood',
        f.P(lo, y0, 0.72),
        f.P(b, y1, 0.72),
        f.P(b, y1, -0.72),
        f.P(lo, y0, -0.72),
        timber,
      );
      quad4(
        out,
        'wood',
        f.P(lo, y0 - 0.15, 0.72),
        f.P(b, y1 - 0.15, 0.72),
        f.P(b, y1, 0.72),
        f.P(lo, y0, 0.72),
        shadowStone,
      );
      quad4(
        out,
        'wood',
        f.P(b, y1 - 0.15, -0.72),
        f.P(lo, y0 - 0.15, -0.72),
        f.P(lo, y0, -0.72),
        f.P(b, y1, -0.72),
        shadowStone,
      );
    }
  }
}

function build(out, level) {
  earthworks(out, level);
  foundations(out, level);
  magazine(out, level);
  boardwalk(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-beausejour-model.mjs';
const camera = [94, 129, 119],
  lookAt = [0, -0.65, -5];
const surveyCamera = [24, 139, 43],
  surveyTarget = [0, 0, -6];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Fort Beauséjour–Fort Cumberland as it survives in Aulac, including its five grass banks, surrounding ditch, exposed stone foundations and recessed magazine.',
  camera,
  lookAt,
  sunDirection: [-61, 45, -45],
  mediumFiContext: {
    scale: 1.16,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: extent.map(([x, z]) => [x * 0.992, z * 0.992]),
    basis:
      'Inside the surveyed ditch boundary the model supplies the LiDAR earthworks. A narrow overlap at the rim meets the surrounding terrain.',
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.87,
    basis:
      'Only the enclosure of the surviving fort is reserved. The detached visitor museum is beyond it.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'measured-five-bastions', position: surveyCamera, lookAt: surveyTarget },
    { name: 'ditch-approach-and-parade-ground', position: [44, 10.9, 56], lookAt: [0, 0.15, -4] },
    { name: 'barracks-and-magazine', position: [-31, 8.4, -3], lookAt: [-4, 0.6, -18.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-beausejour-' + reviewLod,
    position: surveyCamera,
    lookAt: surveyTarget,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.9, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
};
