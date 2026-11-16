/** The standing former hospital headquarters and its connected courtyard ranges. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const geometryRequire = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = geometryRequire('earcut');
const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const { mainOutline, courtyardOpenings, museumBody, tower, rearRange } = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    plaster: 'e0cfb1',
    lightWall: 'ded2bb',
    court: 'ccb999',
    masonry: '9a766a',
    ledge: 'b3886b',
    whiteTrim: 'd7bba1',
    paving: 'a6a08c',
    base: '99927e',
    tile: 'aa6653',
    gable: 'b16e54',
    darkTile: '925b4d',
    wood: '635549',
    inset: '526061',
    dark: '4d4644',
    sill: 'baa98d',
  }).map(([name, code]) => [name, rgb(code)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const limit = (i) => Math.max(0, Math.min(1, i));
const floor = (z) => mix(museumBody.finishedFloorY, rearRange.finishedFloorY, limit((5 - z) / 50));
const eaves = (z) => mix(museumBody.eavesY, rearRange.eavesY, limit((5 - z) / 50));

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters,
    v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = field.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}
function panel(out, slot, x0, x1, y0, y1, z, c) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    c,
  );
}

function curvedHead(out, slot, x, half, spring, rise, z, color, segments) {
  for (let j = 0; j < segments; j++) {
    const a = (2 * j) / segments - 1,
      b = (2 * (j + 1)) / segments - 1;
    const pa = [x + a * half, spring + rise * Math.sqrt(1 - a * a), z];
    const pb = [x + b * half, spring + rise * Math.sqrt(1 - b * b), z];
    triangle(out, slot, [[x, spring, z], pb, pa], color);
  }
}

function archOpening(out, x, base, width, height, z, lod) {
  const half = width * 0.5,
    h = height - width * 0.31,
    rise = width * 0.31;
  const count = lod > 1 ? 8 : 4;
  panel(
    out,
    'brick',
    x - half - 0.13,
    x + half + 0.13,
    base - 0.11,
    base + h + 0.08,
    z,
    tint.masonry,
  );
  curvedHead(out, 'brick', x, half + 0.13, base + h + 0.05, rise + 0.11, z, tint.ledge, count);
  panel(out, 'wood', x - half, x + half, base, base + h, z + 0.019, tint.inset);
  curvedHead(out, 'wood', x, half, base + h, rise, z + 0.021, tint.inset, count);
  if (lod > 0) {
    panel(out, 'wood', x - 0.036, x + 0.036, base, base + h - 0.03, z + 0.044, tint.wood);
    panel(
      out,
      'wood',
      x - half,
      x + half,
      base + h * 0.61,
      base + h * 0.61 + 0.064,
      z + 0.044,
      tint.wood,
    );
  }
}

function rectangularOpening(out, x, base, width, height, z, lod) {
  const half = width * 0.5;
  panel(
    out,
    'brick',
    x - half - 0.11,
    x + half + 0.11,
    base - 0.075,
    base + height + 0.11,
    z,
    tint.ledge,
  );
  panel(out, 'wood', x - half, x + half, base, base + height, z + 0.021, tint.inset);
  if (lod > 1) {
    panel(out, 'wood', x - 0.026, x + 0.026, base, base + height, z + 0.05, tint.wood);
    panel(
      out,
      'wood',
      x - half,
      x + half,
      base + height * 0.68,
      base + height * 0.68 + 0.046,
      z + 0.053,
      tint.wood,
    );
  }
}
function walls(out, points, outer, lod) {
  const area = points.reduce((t, a, i) => {
    const b = points[(i + 1) % points.length];
    return t + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const ring = (outer ? area > 0 : area < 0) ? points.toReversed() : points;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const [x, z] = a,
      [px, pz] = b;
    const length = Math.hypot(px - x, pz - z);
    const local = transform(out, -Math.atan2(pz - z, px - x), [x, 0, z]);
    const y0 = floor(z),
      y1 = floor(pz),
      u0 = eaves(z),
      u1 = eaves(pz);
    const foot = (p) => Math.min(floor(p[1]) - 0.32, ground(...p) - 0.62);
    face(
      local,
      'stone',
      [
        [0, foot(a), 0],
        [length, foot(b), 0],
        [length, y1, 0],
        [0, y0, 0],
      ],
      tint.base,
    );
    face(
      local,
      'plaster',
      [
        [0, y0, 0],
        [length, y1, 0],
        [length, u1, 0],
        [0, u0, 0],
      ],
      outer ? tint.plaster : tint.court,
    );
    const front = outer && pz > 3.9 && z > 3.9 && px > x;
    if (lod > 0 || front) {
      face(
        local,
        'brick',
        [
          [0, u0 - 0.36, 0.028],
          [length, u1 - 0.36, 0.028],
          [length, u1 - 0.07, 0.028],
          [0, u0 - 0.07, 0.028],
        ],
        tint.masonry,
      );
      if (front)
        face(
          local,
          'brick',
          [
            [0, 7.1, 0.055],
            [length, 7.1, 0.055],
            [length, 7.25, 0.055],
            [0, 7.25, 0.055],
          ],
          tint.ledge,
        );
    }
    if ((lod === 0 && !front) || length < 2.2) continue;
    const bays = Math.max(1, Math.round(length / (lod === 0 ? 8.2 : front ? 3.74 : 4.82)));
    for (let j = 0; j < bays; j++) {
      const t = (j + 0.5) / bays,
        p = between(a, b, t),
        s = length * t,
        y = floor(p[1]);
      const hasTwoLevels = outer && p[1] > -4;
      const isEntrance = front && p[0] > -0.75 && p[0] < 1.9 && p[1] > 10.0;
      if (isEntrance) {
        archOpening(local, s, y - 0.035, 1.4, 2.82, 0.095, lod);
        continue;
      }
      const width = front ? 1.29 : 1.06;
      if (front && lod > 0) archOpening(local, s, y + 0.74, width, 1.86, 0.066, lod);
      else rectangularOpening(local, s, y + 0.89, width, 1.54, 0.07, lod);
      if (hasTwoLevels) rectangularOpening(local, s, 7.71, width, 1.51, 0.081, lod);
    }
  }
}

const edges = [mainOutline, ...courtyardOpenings].flatMap((ring) =>
  ring.map((a, i) => [a, ring[(i + 1) % ring.length]]),
);
function roofHeight(p) {
  const distance = Math.min(
    ...edges.map(([a, b]) => {
      const x = b[0] - a[0],
        z = b[1] - a[1];
      const u = limit(((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z));
      return Math.hypot(p[0] - a[0] - u * x, p[1] - a[1] - u * z);
    }),
  );
  const rise = mix(museumBody.roofRiseMeters, rearRange.maxRoofRiseMeters, limit(-p[1] / 44));
  return eaves(p[1]) + Math.min(distance * 0.53, rise);
}

// Align the near roof mesh to the building axes. Clipping each cell preserves
// all native eaves and court holes while avoiding long triangles across valleys.
function clipRoofCell(points, axis, coordinate, sign) {
  const polygon = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const u = sign * (a[axis] - coordinate),
      v = sign * (b[axis] - coordinate);
    if (u >= 0) polygon.push(a);
    if ((u > 0 && v < 0) || (u < 0 && v > 0)) polygon.push(between(a, b, u / (u - v)));
  }
  return polygon;
}
function roofCells(out, points, step, lift) {
  const bounds = [0, 1].map((k) => [
    Math.min(...points.map((p) => p[k])),
    Math.max(...points.map((p) => p[k])),
  ]);
  const polygon = [...points];
  const winding =
    (points[1][0] - points[0][0]) * (points[2][1] - points[0][1]) -
    (points[1][1] - points[0][1]) * (points[2][0] - points[0][0]);
  if (winding > 0) polygon.reverse();
  for (let x = Math.floor(bounds[0][0] / step) * step; x < bounds[0][1]; x += step) {
    const vertical = clipRoofCell(clipRoofCell(polygon, 0, x, 1), 0, x + step, -1);
    if (vertical.length < 3) continue;
    for (let z = Math.floor(bounds[1][0] / step) * step; z < bounds[1][1]; z += step) {
      const cell = clipRoofCell(clipRoofCell(vertical, 1, z, 1), 1, z + step, -1);
      const [start, ...edges] = cell;
      if (edges.length < 2) continue;
      for (let i = 1; i < edges.length; i++) {
        const a = edges[i - 1],
          b = edges[i];
        const area = (a[0] - start[0]) * (b[1] - start[1]) - (a[1] - start[1]) * (b[0] - start[0]);
        if (Math.abs(area) > 0.0003) triangle(out, 'roof', [start, a, b].map(lift), tint.tile);
      }
    }
  }
}

function wardRoofs(out, lod) {
  const holes = [];
  const points = [...mainOutline];
  for (const ring of courtyardOpenings) {
    holes.push(points.length);
    points.push(...ring);
  }
  const flat = earcut(points.flat(), holes);
  const lift = ([x, z]) => [x, roofHeight([x, z]), z];
  for (let k = 0; k < flat.length; k += 3) {
    const [a, b, c] = flat.slice(k, k + 3).map((i) => points[i]);
    const winding = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const patch = (p, q, r, depth) => {
      if (depth === 0) {
        const trianglePoints = (winding > 0 ? [p, r, q] : [p, q, r]).map(lift);
        triangle(out, 'roof', trianglePoints, tint.tile);
        return;
      }
      const e = between(p, q, 0.5),
        f = between(q, r, 0.5),
        g = between(r, p, 0.5);
      patch(p, e, g, depth - 1);
      patch(e, q, f, depth - 1);
      patch(g, f, r, depth - 1);
      patch(e, f, g, depth - 1);
    };
    if (lod >= 2) roofCells(out, [a, b, c], lod === 2 ? 3.5 : 2.5, lift);
    else patch(a, b, c, lod + 1);
  }
}

function towerRoof(out, x, z, width, depth, y, ridge, lod) {
  const loX = x - width / 2,
    hiX = x + width / 2,
    loZ = z - depth / 2,
    hiZ = z + depth / 2;
  const point = [x, ridge, z];
  const ring = [
    [loX, y, loZ],
    [loX, y, hiZ],
    [hiX, y, hiZ],
    [hiX, y, loZ],
  ];
  for (let i = 0; i < 4; i++)
    triangle(out, 'roof', [ring[i], ring[(i + 1) % 4], point], i % 2 ? tint.tile : tint.darkTile);
  box(
    out,
    'brick',
    [loX - 0.19, y - 0.31, loZ - 0.15],
    [hiX + 0.19, y - 0.011, hiZ + 0.15],
    tint.masonry,
  );
  if (lod > 0)
    box(
      out,
      'wood',
      [x - 0.073, ridge - 0.055, z - 0.071],
      [x + 0.073, ridge + 0.64, z + 0.071],
      tint.wood,
    );
}

function museum(out, lod) {
  const {
    center: [x, z],
    width,
    depth,
    baseY,
    upperWallY,
    capY,
  } = tower;
  const left = x - width / 2,
    right = x + width / 2,
    back = z - depth / 2,
    front = z + depth / 2;
  box(out, 'plaster', [left, baseY, back], [right, upperWallY, front], tint.lightWall);
  for (const y of [11.3, 14.04, 16.49])
    box(
      out,
      'brick',
      [left - 0.114, y, back - 0.13],
      [right + 0.114, y + 0.22, front + 0.14],
      tint.masonry,
    );
  for (const side of [0, 1, 2, 3]) {
    const turn = (Math.PI * side) / 2;
    const local = transform(out, turn, [x, 0, z]);
    const sideDepth = side % 2 === 0 ? depth : width;
    const sideWidth = side % 2 === 0 ? width : depth;
    const dz = sideDepth / 2;
    const wx = sideWidth / 2;
    for (const cx of [-wx + 0.29, wx - 0.29]) {
      panel(local, 'brick', cx - 0.23, cx + 0.23, 11.47, 16.48, dz + 0.033, tint.masonry);
      if (lod > 1)
        for (let y = 11.64; y < 16.4; y += 0.58)
          panel(local, 'brick', cx - 0.28, cx + 0.28, y, y + 0.074, dz + 0.049, tint.ledge);
    }
    archOpening(local, 0, 12.09, 1.27, 3.43, dz + 0.068, lod);
    if (lod > 1)
      for (const px of [-1.88, 1.88])
        rectangularOpening(local, px, 14.53, 0.51, 1.38, dz + 0.079, lod);
  }
  towerRoof(out, x, z, width + 0.88, depth + 0.88, upperWallY, capY, lod);
  // The public approach rises to the main rounded bay.
  const start = 11.48,
    landing = museumBody.finishedFloorY;
  const y = Math.min(landing - 0.48, ground(0.12, 17.0) + 0.09),
    n = [2, 4, 7, 9][lod];
  for (let i = 0; i < n; i++) {
    const a = start + i * 0.56;
    box(out, 'stone', [-2.63, y - 0.52, a], [2.69, mix(landing, y, i / n), a + 0.565], tint.paving);
  }
  if (lod > 1) {
    for (const q of [-2.58, 2.62])
      box(
        out,
        'brick',
        [q - 0.12, y - 0.17, start + 1.4],
        [q + 0.12, y + 0.73, start + 4.55],
        tint.ledge,
      );
  }
}

function build(out, lod) {
  walls(out, mainOutline, true, lod);
  for (const ring of courtyardOpenings) walls(out, ring, false, lod);
  wardRoofs(out, lod);
  museum(out, lod);
}
export const barbacenaSkyline = (out) => build(out, 0);
export const barbacenaDistrict = (out) => build(out, 1);
export const barbacenaStreet = (out) => build(out, 2);
export const barbacenaCloseup = (out) => build(out, 3);
const recipe = 'hospital-colonia-de-barbacena-model.mjs';
const camera = [154, 68, 171],
  lookAt = [25, 7, -11];
export const barbacenaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: barbacenaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  buildingCutout: {
    outline: mainOutline,
    minimumCoverage: 0.995,
    basis:
      'Only the mapped building relation/6244798 footprint qualifies for whole-building replacement.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Hospital Colônia headquarters and connected ranges, with a rounded museum frontage, the two-storey Torreão, tiled roofs and six open internal courts.',
  camera,
  lookAt,
  sunDirection: [37, 74, 69],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'brick_flemish',
    'wood_plain',
    'tile_ceramic',
  ],
  qaCameras: [
    { name: 'main-range-and-open-courts', position: camera, lookAt },
    { name: 'torreao-museum-exterior', position: [-9, 16, 44], lookAt: [0, 11, 7] },
    { name: 'tiled-ward-roof-and-interior-courts', position: [47, 45, 18], lookAt: [29, 8, -15] },
    { name: 'rear-ranges-and-hillside-grade', position: [112, 50, -109], lookAt: [35, 6, -19] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `barbacena-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'barbacenaSkyline',
    errorMeters: 1.62,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'barbacenaDistrict', 0.51],
        ['street', 'barbacenaStreet', 0.16],
        ['closeup', 'barbacenaCloseup', 0.048],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Reference material is a public-domain Arquivo Nacional photograph. Native geometry is OpenStreetMap ODbL 1.0.',
};
