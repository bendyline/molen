/** Principal shrine of Nan Hua Temple, Bronkhorstspruit, as documented in 2006. */
import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  ground = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const { foundationBottom, podiumTop, platform, hall, roofs, stairs, connections } = plan.section;
const surfaces = {
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.73, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.76, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    roof: 'cd7234',
    eave: 'a54e2b',
    ridge: 'd58a40',
    stone: 'ded9c8',
    plinth: 'bab5a5',
    steps: 'a56d5c',
    wall: 'b48765',
    red: '8f4334',
    teal: '48757a',
    gold: 'b88b4b',
    glazing: '4a4c46',
    lacquer: '68352a',
    pale: 'd8cbb0',
  }).map(([key, value]) => [key, rgb(value)]),
);
const white = 'palette:#ffffff';
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function grade(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const values = ground.heightsMeters;
  return (
    (values[j][i] * (1 - a) + values[j][i + 1] * a) * (1 - b) +
    (values[j + 1][i] * (1 - a) + values[j + 1][i + 1] * a) * b -
    ground.modelDatumElevationMeters
  );
}
function placeRail(out, a, b, lod, rise = 0.94) {
  const [x, y, z] = a,
    [u, v, w] = b;
  const length = Math.hypot(u - x, w - z);
  const count = Math.max(2, Math.ceil(length / (lod === 1 ? 3.25 : 1.38)));
  if (lod === 0) {
    const points = [
      [x, y + 0.13, z],
      [u, v + 0.13, w],
      [u, v + 0.72, w],
      [x, y + 0.72, z],
    ];
    face(out, 'stone', points, [z - w, 0, u - x], colors.stone);
    face(out, 'stone', points, [w - z, 0, x - u], colors.stone);
    return;
  }
  for (const h of [0.12, rise])
    beam(out, 'stone', [x, y + h, z], [u, v + h, w], 0.17, 0.15, colors.stone);
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      x0 = x + (u - x) * t,
      y0 = y + (v - y) * t,
      z0 = z + (w - z) * t;
    box(out, 'stone', x0, y0, z0, 0.25, rise + 0.12, 0.25, colors.stone);
    if (lod >= 2) box(out, 'stone', x0, y0 + rise + 0.08, z0, 0.32, 0.12, 0.32, colors.stone);
    if (lod >= 2 && i < count) {
      const s = (i + 0.5) / count;
      box(
        out,
        'stone',
        x + (u - x) * s,
        y + (v - y) * s + 0.13,
        z + (w - z) * s,
        0.12,
        rise - 0.19,
        0.12,
        colors.pale,
      );
    }
  }
}
function podium(out, lod) {
  const { left, right, front, back } = platform,
    c = (left + right) / 2,
    w = right - left,
    z = (front + back) / 2;
  box(
    out,
    'stone',
    c,
    foundationBottom,
    z,
    w - 0.37,
    podiumTop - foundationBottom,
    front - back - 0.31,
    colors.plinth,
  );
  box(
    out,
    'stone',
    c,
    podiumTop - 0.48,
    z,
    w,
    podiumTop - (podiumTop - 0.48),
    front - back,
    colors.stone,
  );
  if (lod >= 1)
    box(out, 'stone', c, podiumTop - 1.0, z, w - 0.15, 0.18, front - back - 0.15, colors.stone);
  const { foot, front: stepFront, flights } = stairs,
    depth = foot - stepFront;
  for (const { x, width } of flights) {
    const low = grade(x, foot) - 0.16;
    const steps = lod === 0 ? 3 : lod === 1 ? 7 : lod === 2 ? 14 : 19;
    const base = low - 0.36;
    for (let i = 0; i < steps; i++) {
      const d = (depth * (i + 1)) / steps,
        top = podiumTop - ((podiumTop - low) * i) / steps;
      box(out, 'stone', x, base, stepFront + d / 2, width, top - base, d, colors.steps);
    }
    for (const sign of [-1, 1]) {
      const edge = x + sign * (width / 2 + 0.16);
      placeRail(out, [edge, podiumTop, stepFront], [edge, low + 0.11, foot], lod, 0.86);
    }
  }
  const split = flights.map(({ x, width }) => [x - width / 2 - 0.2, x + width / 2 + 0.2]);
  const frontSegments = [
    [left + 0.35, split[0][0]],
    [split[0][1], split[1][0]],
    [split[1][1], split[2][0]],
    [split[2][1], right - 0.35],
  ];
  for (const [a, b] of frontSegments)
    placeRail(out, [a, podiumTop, front - 0.14], [b, podiumTop, front - 0.14], lod);
  for (const x of [left + 0.25, right - 0.25]) {
    placeRail(out, [x, podiumTop, front - 0.14], [x, podiumTop, 11.5], lod);
    if (lod) placeRail(out, [x, podiumTop, 2.8], [x, podiumTop, back + 0.38], lod);
  }
  if (lod >= 2)
    placeRail(
      out,
      [left + 0.25, podiumTop, back + 0.38],
      [right - 0.25, podiumTop, back + 0.38],
      lod,
    );
}
function pillar(out, x, z, y, top, lod) {
  const n = lod >= 2 ? 10 : 4,
    r = 0.38;
  const circle = Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * (i + 0.5)) / n;
    return [x + Math.cos(t) * r, z + Math.sin(t) * r];
  });
  for (let i = 0; i < n; i++) {
    const [a, b] = [circle[i], circle[(i + 1) % n]];
    face(
      out,
      'wood',
      [
        [a[0], y + (lod ? 0.23 : 0), a[1]],
        [b[0], y + (lod ? 0.23 : 0), b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      [a[0] + b[0] - 2 * x, 0, a[1] + b[1] - 2 * z],
      colors.red,
    );
  }
  if (lod) box(out, 'stone', x, y, z, 1.02, 0.31, 1.02, colors.stone);
  if (lod >= 2) box(out, 'wood', x, top - 0.42, z, 1.04, 0.35, 1.04, colors.teal);
}
function latticeBay(out, x, z, y, w, h, lod) {
  box(out, 'detail', x, y, z, w, h, 0.035, colors.glazing);
  if (!lod) return;
  const count = lod >= 2 ? 3 : 1;
  for (let i = 1; i <= count; i++) {
    const u = x - w / 2 + (i * w) / (count + 1);
    box(out, 'wood', u, y, z + 0.027, 0.072, h, 0.082, colors.lacquer);
  }
  box(out, 'wood', x, y + h * 0.67, z + 0.028, w, 0.072, 0.085, colors.lacquer);
}
function hallBody(out, lod) {
  const [left, right, back, front] = hall.bounds,
    width = right - left,
    depth = front - back,
    x = (left + right) / 2,
    z = (back + front) / 2;
  box(
    out,
    'wall',
    x,
    podiumTop,
    z,
    width - 0.88,
    hall.beamLevel - podiumTop,
    depth - 1.02,
    colors.wall,
  );
  box(out, 'wood', x, hall.beamLevel - 1.39, z, width + 0.26, 1.63, depth + 0.26, colors.teal);
  box(out, 'wood', x, hall.beamLevel - 1.54, z, width + 0.48, 0.19, depth + 0.48, colors.lacquer);
  box(out, 'wood', x, hall.beamLevel - 0.11, z, width + 0.53, 0.18, depth + 0.53, colors.gold);
  const frontCols = lod ? 9 : 7;
  for (const zz of [front + 0.08, back - 0.08]) {
    for (let i = 0; i < frontCols; i++) {
      const px = left + 0.17 + (i * (width - 0.34)) / (frontCols - 1);
      pillar(out, px, zz, podiumTop, hall.beamLevel - 1.02, lod);
      if (i < frontCols - 1) {
        const midpoint = px + (width - 0.34) / (2 * (frontCols - 1));
        if (zz > 0) latticeBay(out, midpoint, front - 0.473, podiumTop + 0.18, 4.2, 3.48, lod);
        else
          box(
            out,
            'detail',
            midpoint,
            podiumTop + 1.3,
            back + 0.48,
            3.0,
            2.51,
            0.041,
            colors.glazing,
          );
      }
      if (lod >= 1)
        box(out, 'wood', px, hall.beamLevel - 0.58, zz, 1.21, 0.53, 0.94, colors.lacquer);
    }
  }
  for (const xx of [left + 0.1, right - 0.1]) {
    for (const p of lod ? [0.25, 0.5, 0.75] : [0.31, 0.67]) {
      const zz = back + depth * p;
      pillar(out, xx, zz, podiumTop, hall.beamLevel - 1.11, lod);
      const shift = xx < x ? -0.301 : 0.301;
      box(out, 'detail', xx - shift, podiumTop + 1.56, zz + 1.54, 0.04, 2.12, 2.03, colors.glazing);
    }
  }
  if (lod >= 1)
    for (let i = 0; i < 8; i++) {
      const u = left + ((i + 0.5) * width) / 8;
      box(out, 'detail', u, hall.beamLevel - 1.06, front + 0.148, 2.88, 0.64, 0.036, colors.red);
      if (lod >= 2)
        for (const dx of [-0.88, 0, 0.88])
          box(
            out,
            'detail',
            u + dx,
            hall.beamLevel - 0.93,
            front + 0.175,
            0.35,
            0.37,
            0.046,
            colors.gold,
          );
    }
  const [a, b, c, d] = hall.clerestory;
  box(out, 'wood', (a + b) / 2, 13.33, (c + d) / 2, b - a, 1.52, d - c, colors.teal);
  if (lod) {
    box(
      out,
      'wood',
      (a + b) / 2,
      14.48,
      (c + d) / 2,
      b - a + 0.27,
      0.18,
      d - c + 0.23,
      colors.lacquer,
    );
    for (let i = 1; i < 8; i++) {
      const u = a + (i * (b - a)) / 8;
      box(out, 'detail', u, 13.99, d + 0.034, 3.12, 0.41, 0.095, colors.gold);
    }
  }
}

function roofRing(center, band, intervals) {
  const [x, z] = center,
    [w, d, y, lift] = band;
  const points = [];
  for (const side of [0, 1, 2, 3])
    for (let i = 0; i < intervals; i++) {
      const t = -1 + (2 * i) / intervals,
        f = Math.pow(Math.abs(t), 4);
      const [px, pz] = [
        [-w, t * d],
        [t * w, d],
        [w, -t * d],
        [-t * w, -d],
      ][side];
      points.push([x + px, y + f * lift, z + pz]);
    }
  return points;
}
function tiledRoof(out, { center, bands }, lod, ornament = false, connection = false) {
  const intervals = connection ? (lod ? 3 : 1) : lod === 0 ? 2 : lod === 1 ? 5 : 10;
  const rings = bands.map((b) => roofRing(center, b, intervals));
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      face(out, 'roof', [a[i], a[k], b[k], b[i]], [0, 1, 0], colors.roof);
    }
  }
  const eave = rings[0];
  const underside = eave.map(([x, y, z]) => [
    center[0] + (x - center[0]) * 0.993,
    y - 0.38,
    center[1] + (z - center[1]) * 0.993,
  ]);
  for (let i = 0; i < eave.length; i++) {
    const k = (i + 1) % eave.length,
      a = eave[i],
      b = eave[k],
      c = underside[i],
      d = underside[k];
    face(
      out,
      'roof',
      [a, b, d, c],
      [a[0] + b[0] - 2 * center[0], 0, a[2] + b[2] - 2 * center[1]],
      colors.eave,
    );
    face(
      out,
      'wood',
      [
        c,
        d,
        [center[0] + (d[0] - center[0]) * 0.78, d[1] - 0.17, center[1] + (d[2] - center[1]) * 0.78],
        [center[0] + (c[0] - center[0]) * 0.78, c[1] - 0.17, center[1] + (c[2] - center[1]) * 0.78],
      ],
      [0, -1, 0],
      colors.lacquer,
    );
  }
  if (!ornament) return;
  const [x, z] = center,
    [w, , y, lift] = bands.at(-1);
  const crest = [
    [-w - 0.42, y + lift + 0.48],
    [-w + 0.8, y + 0.38],
    [0, y + 0.28],
    [w - 0.8, y + 0.38],
    [w + 0.42, y + lift + 0.48],
  ].map(([dx, yy]) => [x + dx, yy, z]);
  box(out, 'roof', x, y - 0.06, z, 2 * w, 0.43, 0.44, colors.ridge);
  beamPath(out, 'roof', crest, 0.24, 0.28, colors.ridge);
  if (lod)
    for (const k of [-1, 1]) {
      beamPath(
        out,
        'roof',
        [
          [x + k * (w - 1.64), y + 0.37, z],
          [x + k * (w - 0.65), y + 0.54, z],
          [x + k * (w + 0.13), y + 1.04, z],
          [x + k * (w + 0.45), y + 0.88, z],
        ],
        0.2,
        0.19,
        colors.eave,
      );
    }
  if (lod >= 2)
    for (let i = 0; i < 4; i++) {
      const path = rings.map((r) => r[i * intervals].map((p, k) => (k === 1 ? p + 0.1 : p)));
      beamPath(out, 'roof', path, 0.16, 0.15, colors.ridge);
      if (lod === 3) {
        const [px, py, pz] = path[0],
          dx = px > x ? 1 : -1,
          dz = pz > z ? 1 : -1;
        beamPath(
          out,
          'roof',
          [
            [px - dx * 1.2, py - 0.25, pz - dz * 0.85],
            [px, py + 0.05, pz],
            [px + dx * 0.3, py + 0.53, pz + dz * 0.21],
          ],
          0.16,
          0.18,
          colors.ridge,
        );
      }
    }
}
function roofedConnections(out, lod) {
  for (const { bounds, top } of connections) {
    const [a, b, c, d] = bounds,
      x = (a + b) / 2,
      z = (c + d) / 2,
      w = b - a,
      depth = d - c;
    const low = Math.min(grade(a, z), grade(b, z)) - 0.48;
    box(out, 'stone', x, low, z, w, podiumTop - low, depth, colors.plinth);
    box(out, 'wall', x, podiumTop, z, w - 0.32, top - podiumTop, depth - 1.9, colors.wall);
    if (lod)
      for (let i = 0; i < (lod >= 2 ? 5 : 3); i++) {
        const px = a + ((i + 0.5) * w) / (lod >= 2 ? 5 : 3);
        box(out, 'wood', px, podiumTop, d - 0.48, 0.3, top - podiumTop, 0.39, colors.red);
        box(out, 'detail', px, podiumTop + 0.61, d - 0.922, 1.08, 0.9, 0.042, colors.glazing);
      }
    tiledRoof(
      out,
      {
        center: [x, z],
        bands: [
          [w / 2 + 0.55, depth / 2 + 0.37, top, 0.25],
          [w / 2 + 0.2, depth / 2 - 0.42, top + 0.27, 0.16],
          [w / 2 - 1.0, 0.05, top + 1.43, 0.14],
        ],
      },
      lod === 0 ? 0 : 1,
      false,
      true,
    );
    box(out, 'roof', x, top + 1.32, z, w - 2, 0.27, 0.35, colors.eave);
  }
}
function buildLevel(out, lod) {
  podium(out, lod);
  hallBody(out, lod);
  roofedConnections(out, lod);
  for (let i = 0; i < roofs.length; i++) tiledRoof(out, roofs[i], lod, i === 1);
}
export const nanHuaSkyline = (out) => buildLevel(out, 0);
export const nanHuaDistrict = (out) => buildLevel(out, 1);
export const nanHuaStreet = (out) => buildLevel(out, 2);
export const nanHuaCloseup = (out) => buildLevel(out, 3);

const recipe = 'nan-hua-shrine-model.mjs',
  camera = [52, 29, 94],
  lookAt = [-2, 9.9, 1];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'nanHuaDistrict', 0.38],
    ['street', 'nanHuaStreet', 0.125],
    ['closeup', 'nanHuaCloseup', 0.052],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const nanHuaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: nanHuaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Nan Hua Temple’s principal shrine around March 2006, with its two curved orange tiled roofs, painted bracket bands, red columns and broad balustraded stone platform.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named mapped main shrine, including the short connecting wings within its own outline.',
  },
  mediumFiContext: {
    scale: 0.82,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['tile_glazed', 'stone_granite', 'wood_plain', 'plaster_lime'],
  qaCameras: [
    { name: 'east-court-and-raised-shrine', position: [3, 13, 78], lookAt: [0, 10.7, 6] },
    { name: 'curved-double-eaves-and-short-wings', position: [-61, 44, -51], lookAt: [-3, 12, 0] },
    {
      name: 'central-stairs-columns-and-bracket-band',
      position: [20, 13, 51],
      lookAt: [0, 7.2, 14],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-nan-hua-shrine-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'nanHuaSkyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap ODbL 1.0 geographic controls. Exact photographer-released public-domain images by Elf-friend.',
};
