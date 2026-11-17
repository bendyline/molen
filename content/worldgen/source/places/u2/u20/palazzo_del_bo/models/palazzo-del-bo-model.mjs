/** Mapped Palazzo del Bo: street portico, two principal courts, tower and historic theatre. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildAnatomicalTheatre } from './anatomical-theatre.mjs';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const controls = read('theatre-and-court-controls.json');
const { base, ground, eave, peakRise } = plan.section;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  theatreWood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  recess: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    wall: 'd6bf9f',
    side: 'd9c2a5',
    newCourt: 'ded1ba',
    oldCourt: 'dbccb0',
    stone: 'd9c8a8',
    ledge: 'b7a78b',
    trim: 'e1d2b4',
    dark: '514946',
    pane: '5a6769',
    timber: '785f47',
    tile: 'ae745e',
    fadedTile: '9d6657',
    brick: '946d56',
    edgeBrick: 'a37960',
    paving: 'aaa498',
  }).map(([key, color]) => [key, rgb(color)]),
);

const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
const orient = (ring, outward) => (area(ring) < 0 === outward ? ring : [...ring].reverse());
const outer = orient(map.features[0].points, true);
const courts = map.features
  .filter(({ role }) => role !== 'palace-exterior' && role !== 'bell-tower')
  .map(({ points, role }) => ({ points: orient(points, false), role }));
const roofHoles = courts.map(({ points }) => points);
const segments = [outer, ...roofHoles].flatMap((ring) =>
  ring.map((a, i) => [a, ring[(i + 1) % ring.length]]),
);

function baseRoof() {
  const builder = new MeshBufferBuilder();
  const ok = builder.addCap(
    'tiles',
    'palette:#ffffff',
    outer,
    roofHoles,
    () => eave,
    [0, 1, 0],
    (p) => p,
    tone.tile,
  );
  if (!ok) throw Error('Palazzo del Bo roof polygon could not be triangulated');
  const { positions, indices } = builder.finalize();
  return Array.from(indices, (j) => [positions[j * 3], positions[j * 3 + 2]]);
}

function distanceToBoundary([x, z]) {
  let distance = Infinity;
  for (const [[a, b], [c, d]] of segments) {
    const dx = c - a;
    const dz = d - b;
    const along = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
    const squared = Math.pow(x - a - along * dx, 2) + Math.pow(z - b - along * dz, 2);
    distance = Math.min(distance, squared);
  }
  return Math.sqrt(distance);
}

function roof(out, lod) {
  const coarse = baseRoof();
  const cache = new Map();
  const lift = (p) => {
    const key = p.join(',');
    if (!cache.has(key)) {
      const slope = Math.min(peakRise, distanceToBoundary(p) * 0.52);
      cache.set(key, [p[0], eave + slope, p[1]]);
    }
    return cache.get(key);
  };
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const fill = (a, b, c, depth, tint) => {
    if (depth === 0) {
      triangle(out, 'tiles', [lift(a), lift(b), lift(c)], tint);
      return;
    }
    const ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    fill(a, ab, ca, depth - 1, tint);
    fill(ab, b, bc, depth - 1, tint);
    fill(ca, bc, c, depth - 1, tint);
    fill(ab, bc, ca, depth - 1, tint);
  };
  for (let i = 0; i < coarse.length; i += 3) {
    const [a, b, c] = coarse.slice(i, i + 3);
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-5) continue;
    fill(a, b, c, [1, 1, 2, 3][lod], tone.tile);
  }
}

function rect(out, slot, x0, y0, x1, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function rectangularOpening(out, x, y, width, height, z, lod, cap = false) {
  const left = x - width / 2,
    right = x + width / 2;
  rect(out, 'recess', left, y, right, y + height, z, tone.dark);
  if (lod < 2) return;
  rect(
    out,
    'recess',
    left + 0.11,
    y + height * 0.39,
    right - 0.11,
    y + height - 0.12,
    z + 0.012,
    tone.pane,
  );
  for (const at of [left, right])
    rect(out, 'theatreWood', at - 0.043, y, at + 0.066, y + height, z + 0.029, tone.timber);
  rect(
    out,
    'theatreWood',
    x - 0.044,
    y + 0.09,
    x + 0.044,
    y + height - 0.1,
    z + 0.036,
    tone.timber,
  );
  if (lod === 2) {
    rect(out, 'limestone', left - 0.12, y - 0.1, right + 0.12, y + 0.015, z + 0.052, tone.ledge);
    if (cap)
      rect(
        out,
        'limestone',
        left - 0.17,
        y + height,
        right + 0.17,
        y + height + 0.13,
        z + 0.052,
        tone.trim,
      );
    return;
  }
  box(
    out,
    'limestone',
    [left - 0.12, y - 0.095, z - 0.1],
    [right + 0.12, y + 0.012, z + 0.095],
    tone.ledge,
  );
  if (cap)
    box(
      out,
      'limestone',
      [left - 0.17, y + height, z - 0.09],
      [right + 0.17, y + height + 0.13, z + 0.085],
      tone.trim,
    );
}

function arcadeBay(out, x, width, floor, top, z, lod) {
  const half = width / 2;
  const n = [4, 6, 10, 14][lod];
  const spring = floor + 1.94;
  const radius = half * 0.69;
  const profile = (i, front) => [
    x + Math.cos((Math.PI * i) / n) * half,
    spring + Math.sin((Math.PI * i) / n) * radius,
    front,
  ];
  for (let i = 0; i < n; i++) {
    const a = profile(i, z),
      b = profile(i + 1, z);
    face(out, 'limestone', [b, a, [a[0], top, z], [b[0], top, z]], tone.stone);
    if (lod > 1)
      face(out, 'limestone', [a, b, profile(i + 1, z - 0.33), profile(i, z - 0.33)], tone.ledge);
  }
}

function markedStreetWall(out, length, lod) {
  const arcadeTop = 3.96;
  const bays = Math.max(1, Math.round(length / 4.15));
  const width = length / bays;
  const half = width * 0.38;
  rect(out, 'plaster', 0, arcadeTop, length, eave, 0, tone.side);
  if (lod === 0) {
    rect(out, 'plaster', 0, base, length, arcadeTop, -2.25, tone.wall);
    return;
  }
  rect(out, 'plaster', 0, base, length, arcadeTop, -2.32, tone.wall);
  rect(out, 'limestone', 0, arcadeTop - 0.055, length, arcadeTop + 0.23, 0.066, tone.ledge);
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * width;
    arcadeBay(out, x, half * 2, base, arcadeTop, 0, lod);
    if (lod > 2) {
      box(out, 'limestone', [x - width / 2, ground, -0.38], [x - half, arcadeTop, 0], tone.stone);
      box(out, 'limestone', [x + half, ground, -0.38], [x + width / 2, arcadeTop, 0], tone.stone);
    } else {
      rect(out, 'limestone', x - width / 2, ground, x - half, arcadeTop, 0, tone.stone);
      rect(out, 'limestone', x + half, ground, x + width / 2, arcadeTop, 0, tone.stone);
    }
    rectangularOpening(out, x, 0.36, i % 3 === 1 ? 1.82 : 1.24, 2.73, -2.29, lod, true);
  }
}

function plainWall(out, length, lod, color) {
  rect(out, 'plaster', 0, ground, length, eave, 0, color);
  if (length > 2.7 && lod > 0) {
    const bays = Math.max(1, Math.round(length / 4.65));
    const step = length / bays;
    for (let i = 0; i < bays; i++)
      rectangularOpening(out, (i + 0.5) * step, 1.12, Math.min(1.2, step * 0.46), 1.82, 0.027, lod);
  }
}

function mainWall(out, points, lod, useWindows) {
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i],
      [xx, zz] = points[(i + 1) % points.length];
    const length = Math.hypot(xx - x, zz - z);
    if (length < 0.02) continue;
    const angle = -Math.atan2(zz - z, xx - x);
    const wall = transform(out, angle, [x, 0, z]);
    const westStreet = useWindows && (x + xx) / 2 < -30 && Math.abs(zz - z) > 5;
    if (westStreet) markedStreetWall(wall, length, lod);
    else plainWall(wall, length, useWindows ? lod : 0, tone.wall);
    if (lod === 0 || !useWindows || length < 2.5) continue;
    const count = Math.max(1, Math.round(length / (lod === 1 ? 6.45 : 4.1)));
    for (let j = 0; j < count; j++) {
      const center = (length * (j + 0.5)) / count;
      for (const [eq, height] of [
        [5.09, 2.14],
        [9.0, 1.81],
      ])
        rectangularOpening(
          wall,
          center,
          eq,
          Math.min(1.23, (length / count) * 0.45),
          height,
          0.029,
          lod,
          westStreet,
        );
    }
    rect(wall, 'limestone', 0, 8.32, length, 8.49, 0.042, tone.ledge);
    if (lod > 1) rect(wall, 'limestone', 0, eave - 0.21, length, eave + 0.018, 0.052, tone.trim);
  }
}

function column(out, x, y, h, z, radius, lod) {
  const size = radius * 1.3;
  if (lod < 3) {
    const sides = lod === 1 ? 4 : 7;
    loft(
      out,
      'limestone',
      [
        radialRing(y, radius, radius, sides, [x, z]),
        radialRing(y + h, radius * 0.88, radius * 0.88, sides, [x, z]),
      ],
      tone.stone,
      { cap: false },
    );
    return;
  }
  box(out, 'limestone', [x - size, y, z - size], [x + size, y + 0.13, z + size], tone.ledge);
  const n = lod > 2 ? 12 : lod > 1 ? 8 : 5;
  loft(
    out,
    'limestone',
    [
      radialRing(y + 0.12, size, size, n, [x, z]),
      radialRing(y + 0.3, radius, radius, n, [x, z]),
      radialRing(y + h - 0.28, radius * 0.87, radius * 0.87, n, [x, z]),
      radialRing(y + h - 0.14, size, size, n, [x, z]),
    ],
    tone.stone,
    { cap: false },
  );
  box(out, 'limestone', [x - size, y + h - 0.14, z - size], [x + size, y + h, z + size], tone.trim);
}

function oldEntablature(out, len, y, lod) {
  box(out, 'limestone', [0, y - 0.06, -2.63], [len, y + 0.44, 0.18], tone.trim);
  box(out, 'limestone', [0, y + 0.39, -2.61], [len, y + 0.57, 0.22], tone.ledge);
  if (lod < 3) return;
  const count = Math.floor(len / 0.58);
  for (let i = 0; i < count; i++) {
    const x = (len * (i + 0.5)) / count;
    box(out, 'limestone', [x - 0.065, y + 0.27, 0.14], [x + 0.065, y + 0.44, 0.228], tone.stone);
  }
}

function parapet(out, a, b, y, lod) {
  if (lod < 2) {
    rect(out, 'limestone', a, y, b, y + 0.66, 0.11, tone.ledge);
    return;
  }
  box(out, 'limestone', [a, y - 0.065, -0.07], [b, y + 0.025, 0.13], tone.ledge);
  box(out, 'limestone', [a, y + 0.64, -0.07], [b, y + 0.72, 0.13], tone.trim);
  const n = Math.max(2, Math.floor((b - a) / 0.34));
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * (i + 0.5)) / n,
      z = 0.035;
    if (lod === 2)
      box(
        out,
        'limestone',
        [x - 0.052, y, z - 0.037],
        [x + 0.052, y + 0.65, z + 0.037],
        tone.stone,
      );
    else
      loft(
        out,
        'limestone',
        [
          radialRing(y, 0.071, 0.067, 5, [x, z]),
          radialRing(y + 0.27, 0.056, 0.055, 5, [x, z]),
          radialRing(y + 0.48, 0.038, 0.044, 5, [x, z]),
          radialRing(y + 0.65, 0.069, 0.068, 5, [x, z]),
        ],
        tone.stone,
        { cap: false },
      );
  }
}
function coats(out, x, y, z, lod) {
  const w = lod > 2 ? 0.29 : 0.22;
  if (lod < 3) {
    rect(out, 'limestone', x - w, y - 0.18, x + w, y + 0.16, z + 0.027, tone.ledge);
    return;
  }
  box(out, 'limestone', [x - w, y - 0.18, z - 0.055], [x + w, y + 0.16, z + 0.015], tone.ledge);
  if (lod > 2)
    triangle(
      out,
      'limestone',
      [
        [x - w, y - 0.17, z + 0.026],
        [x, y - 0.36, z + 0.026],
        [x + w, y - 0.17, z + 0.026],
      ],
      tone.stone,
    );
}

function oldCourt(out, points, lod) {
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i],
      [xx, zz] = points[(i + 1) % points.length];
    const len = Math.hypot(xx - x, zz - z);
    if (len < 0.02) continue;
    const wall = transform(out, -Math.atan2(zz - z, xx - x), [x, 0, z]);
    rect(wall, 'plaster', -2.74, ground, len + 2.74, 9.04, -2.62, tone.oldCourt);
    rect(wall, 'plaster', 0, 8.95, len, eave, -0.045, tone.oldCourt);
    if (lod === 0) continue;
    const bays = Math.max(1, Math.round(len / (lod === 1 ? 3.6 : 2.65)));
    const step = len / bays;
    oldEntablature(wall, len, 3.99, lod);
    oldEntablature(wall, len, 8.47, lod);
    for (let n = 0; n <= bays; n++) {
      const at = n * step;
      column(wall, at, 0.12, 3.87, 0.013, 0.19, lod);
      column(wall, at, 4.52, 3.95, 0.018, 0.165, lod);
    }
    for (let n = 0; n < bays; n++) {
      const center = (n + 0.5) * step;
      rectangularOpening(wall, center, 0.26, Math.min(1.13, step * 0.45), 2.79, -2.59, lod);
      rectangularOpening(wall, center, 4.72, Math.min(1.13, step * 0.48), 2.57, -2.59, lod, true);
      parapet(wall, n * step + 0.23, (n + 1) * step - 0.23, 4.53, lod);
      if (lod > 1) {
        coats(wall, center, 7.67, -2.6, lod);
        coats(wall, center - step * 0.29, 6.46, -2.6, lod);
        coats(wall, center + step * 0.29, 6.46, -2.6, lod);
        coats(wall, center, 4.07, 0.185, lod);
      }
      if (n % 2 === 0) rectangularOpening(wall, center, 10.04, 1.07, 1.28, -0.014, lod);
    }
  }
}

function newCourt(out, points, lod) {
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i],
      [xx, zz] = points[(i + 1) % points.length];
    const len = Math.hypot(xx - x, zz - z);
    if (len < 0.02) continue;
    const wall = transform(out, -Math.atan2(zz - z, xx - x), [x, 0, z]);
    rect(wall, 'plaster', 0, 3.45, len, eave, 0, tone.newCourt);
    rect(wall, 'plaster', 0, base, len, 3.46, -1.86, tone.wall);
    if (lod === 0 || len < 1.8) continue;
    const count = Math.max(1, Math.round(len / 3.04)),
      step = len / count;
    for (let a = 0; a < count; a++) {
      const center = (a + 0.5) * step;
      const edge = a * step;
      box(wall, 'limestone', [edge - 0.16, ground, -0.26], [edge + 0.23, 3.52, 0.11], tone.stone);
      rectangularOpening(wall, center, 4.76, 1.13, 2.12, 0.024, lod);
      rectangularOpening(wall, center, 8.19, 1.02, 1.72, 0.024, lod);
    }
    box(wall, 'limestone', [0, 3.43, -0.24], [len, 3.67, 0.21], tone.ledge);
  }
}

function pagedCourt(out, court, lod) {
  const { points, role } = court;
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      'limestone',
      'palette:#ffffff',
      points,
      [],
      () => 0.102,
      [0, 1, 0],
      (p) => p,
      tone.paving,
    )
  )
    throw Error('Invalid native court ring');
  const { positions, indices } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const corners = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    triangle(out, 'limestone', corners, tone.paving);
  }
  if (role === 'old-court') oldCourt(out, points, lod);
  else if (role === 'new-court') newCourt(out, points, lod);
  else mainWall(out, points, lod, false);
}

function tower(out, lod) {
  const { center, angle, width, depth, top } = plan.section.tower;
  const m = transform(out, angle, [center[0], 0, center[1]]);
  box(m, 'brick', [-width / 2, base, -depth / 2], [width / 2, top - 0.3, depth / 2], tone.brick);
  box(
    m,
    'brick',
    [-width / 2 - 0.1, top - 0.41, -depth / 2 - 0.1],
    [width / 2 + 0.1, top - 0.1, depth / 2 + 0.1],
    tone.edgeBrick,
  );
  box(
    m,
    'tiles',
    [-width / 2 + 0.12, top - 0.22, -depth / 2 + 0.12],
    [width / 2 - 0.12, top, depth / 2 - 0.12],
    tone.fadedTile,
  );
  if (lod === 0) return;
  for (let j = 0; j < 4; j++) {
    const orientation = (j * Math.PI) / 2;
    const front = transform(m, orientation);
    const outer = j % 2 ? width / 2 : depth / 2;
    rectangularOpening(front, 0, top - 3.1, 0.74, 1.68, outer + 0.015, lod);
  }
  if (lod > 1) {
    const dial = Array.from({ length: 20 }, (_, i) => {
      const a = (i * Math.PI) / 10;
      return [0.72 * Math.cos(a), top - 4.83 + 0.72 * Math.sin(a), depth / 2 + 0.051];
    });
    m.addConvexPolygon(
      'limestone',
      'palette:#ffffff',
      dial,
      [0, 0, 1],
      (p) => [p[0], p[1]],
      tone.stone,
    );
    beamPath(
      m,
      'recess',
      [
        [0, top - 4.31, depth / 2 + 0.061],
        [0, top - 4.83, depth / 2 + 0.061],
        [0.36, top - 4.95, depth / 2 + 0.061],
      ],
      0.046,
      0.033,
      tone.dark,
    );
  }
}

function theatreRoom(out, lod) {
  const t = controls.theatre;
  const [x, z] = t.center;
  const ceiling = 8.18;
  for (const sign of [-1, 1]) {
    const side = x + sign * 4.83;
    box(
      out,
      'plaster',
      [side - 0.15, t.floor - 0.1, z - 3.65],
      [side + 0.15, ceiling, z + 3.65],
      tone.ledge,
    );
  }
  box(
    out,
    'plaster',
    [x - 4.8, t.floor - 0.08, z - 3.68],
    [x + 4.8, ceiling, z - 3.42],
    tone.oldCourt,
  );
  box(
    out,
    'plaster',
    [x - 4.8, t.floor - 0.08, z + 3.48],
    [x + 4.8, ceiling, z + 3.68],
    tone.oldCourt,
  );
  box(
    out,
    'theatreWood',
    [x - 4.8, t.floor - 0.13, z - 3.5],
    [x + 4.8, t.floor - 0.02, z + 3.5],
    tone.timber,
  );
  box(
    out,
    'plaster',
    [x - 4.8, ceiling, z - 3.62],
    [x + 4.8, ceiling + 0.14, z + 3.66],
    tone.ledge,
  );
  buildAnatomicalTheatre(out, t, lod === 2 ? 1 : lod);
}

function build(out, lod) {
  mainWall(out, outer, lod, true);
  roof(out, lod);
  for (const court of courts) pagedCourt(out, court, lod);
  tower(out, lod);
  if (lod > 1) theatreRoom(out, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);

const recipe = 'palazzo-del-bo-model.mjs';
const camera = [-101, 55, -109];
const lookAt = [-5, 6, -7];
const t = controls.theatre.center;
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: palaceCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Palazzo del Bo in Padua, with its western street portico, terracotta roofs, two principal courtyards and the six-tier anatomical theatre.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-65, 83, -44],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'brick',
    'tile_ceramic',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'via-viii-febbraio-portico-and-tower',
      position: [-77, 15, -46],
      lookAt: [-28, 8, -16],
    },
    {
      name: 'cortile-antico-colonnades',
      position: [-17.6, 6.4, -14.1],
      lookAt: [-16.4, 4.9, -25.6],
    },
    {
      name: 'anatomical-theatre-timber-tiers',
      position: [t[0] - 2.15, 7.74, t[1] + 2.68],
      lookAt: [t[0] + 0.58, 1.95, t[1] - 0.16],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-roofs-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 0.56,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'palaceDistrict', 0.26],
        ['street', 'palaceStreet', 0.103],
        ['closeup', 'palaceCloseup', 0.043],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Public-domain Qualla theatre reference and a CC0 courtyard reference. Native OpenStreetMap geometry under ODbL 1.0.',
};
