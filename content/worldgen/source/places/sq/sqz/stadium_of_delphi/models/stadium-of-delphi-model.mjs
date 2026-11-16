/** The surviving Stadium of Delphi on Mount Parnassus in March 2012. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [seating, track] = frame.geometry.polygons;
const perimeter = seating.slice(0, 11);
const q = plan.section;
const surfaces = {
  block: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  bench: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  dust: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    block: 'aba392',
    blockDark: '9b9180',
    trim: 'b4ad9e',
    step: 'a6a192',
    riser: '969181',
    damage: '9e9382',
    bank: 'a29780',
    grass: '9d9973',
    grassDull: 'a3a07c',
    sand: 'a69a7e',
    pale: 'c4b59d',
  }).map(([k, v]) => [k, rgb(v)]),
);
const blend = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => blend(v, b[i], t));
const ground = (x, z) => {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    blend(blend(h[j][i], h[j][i + 1], u - i), blend(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
};
const trackHeight = (x) => q.loweredTrackLevelEstimate + 0.0106 * (x + 89);
const position = ([x, z], y) => [x, y, z];

function draw(out, slot, points, desired, color) {
  const n = normalFor(...points);
  const ordered =
    n.reduce((sum, v, i) => sum + v * desired[i], 0) > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}
function surface(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    draw(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => position(ring[j], y(...ring[j]))),
      [0, 1, 0],
      color,
    );
}
function wall(out, slot, a, b, bottom, top, normal, color) {
  draw(
    out,
    slot,
    [
      position(a, bottom(...a)),
      position(b, bottom(...b)),
      position(b, top(...b)),
      position(a, top(...a)),
    ],
    normal,
    color,
  );
}
function strip(out, slot, a, b, c, d, y, color) {
  draw(
    out,
    slot,
    [position(a, y(...a)), position(b, y(...b)), position(c, y(...c)), position(d, y(...d))],
    [0, 1, 0],
    color,
  );
}
function railSection(a, b, inside, outside, rangeStart, rangeEnd) {
  return (x, depth) => {
    const t = (x - rangeStart) / (rangeEnd - rangeStart);
    const p = mix(a, b, t),
      q = mix(inside, outside, t);
    return mix(p, q, depth);
  };
}

const northStart = track[3],
  northEnd = track[0];
const northOuterStart = seating[2],
  northOuterEnd = seating[1];
const xMin = northStart[0],
  xMax = northEnd[0];
const north = railSection(northStart, northEnd, northOuterStart, northOuterEnd, xMin, xMax);
const south = railSection(track[8], track[9], seating[8], seating[9], track[8][0], track[9][0]);
const westInner = track.slice(3, 9),
  westOuter = seating.slice(2, 9);
function pathSample(path, t) {
  const f = t * (path.length - 1);
  const i = Math.min(Math.floor(f), path.length - 2);
  return mix(path[i], path[i + 1], f - i);
}
const west = (t, depth) => mix(pathSample(westInner, t), pathSample(westOuter, t), depth);

function course(out, lod) {
  surface(out, 'dust', track, trackHeight, colors.grass);
  if (lod === 0) return;
  const rows = lod === 1 ? 5 : 8;
  const cols = lod === 1 ? 19 : 33;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const tint = (i * 13 + j * 11 + Math.floor(i / 4)) % 19;
      if (tint > 4) continue;
      const x = blend(xMin + 10, xMax - 5, (i + 0.22) / cols),
        z = blend(-9, 9, (j + 0.18) / rows);
      const w = 2.5 + ((i * 5 + j) % 6),
        d = 0.55 + ((i + j * 3) % 5) * 0.23;
      surface(
        out,
        'dust',
        [
          [x, z],
          [x + w * 0.79, z - 0.11],
          [x + w, z + 0.77 * d],
          [x + w * 0.25, z + d],
        ],
        (x) => trackHeight(x) + 0.011,
        tint < 2 ? colors.sand : colors.grassDull,
      );
    }
}

function seats(out, path, start, end, breaks, rows, riser, lod, curved = false) {
  const groups = lod === 0 ? (curved ? 4 : 3) : breaks + 1;
  const along = (group, delta) => blend(start, end, (group + delta) / groups);
  for (let i = 0; i < groups; i++) {
    const a0 = along(i, 0),
      b0 = along(i, 1);
    const gap = lod === 0 ? 0 : curved ? 0.007 : 0.53;
    const a = a0 + (i > 0 ? gap : 0),
      b = b0 - (i < groups - 1 ? gap : 0);
    const normal = curved ? [1, 0, 0] : [0, 0, 1];
    const points = [path(a, 0), path(b, 0)];
    wall(
      out,
      'block',
      ...points,
      trackHeight,
      (x) => trackHeight(x) + q.crepis,
      normal,
      colors.block,
    );
    for (let j = 0; j < rows; j++) {
      const low = (0.79 * j) / rows,
        high = (0.79 * (j + 1)) / rows;
      const f0 = path(a, low),
        f1 = path(b, low),
        f2 = path(b, high),
        f3 = path(a, high);
      const top = (x) => trackHeight(x) + q.crepis + (j + 1) * riser;
      const bottom = (x) => top(x) - riser;
      const tone = (i * 7 + j * 5) % 11 < 3 ? colors.trim : colors.step;
      wall(out, 'block', f0, f1, bottom, top, normal, colors.riser);
      strip(out, 'bench', f0, f1, f2, f3, top, tone);
      if (lod >= 2 && (i * 7 + j * 17) % 13 === 0) {
        const p = mix(f0, f1, 0.3),
          r = mix(f0, f1, 0.46),
          s = mix(f3, f2, 0.5),
          t = mix(f3, f2, 0.33);
        strip(out, 'bench', p, r, s, t, (x) => top(x) + 0.018, colors.damage);
      }
    }
    const top = (x) => trackHeight(x) + q.crepis + rows * riser;
    strip(
      out,
      'dust',
      path(a, 0.79),
      path(b, 0.79),
      path(b, 0.94),
      path(a, 0.94),
      top,
      colors.bank,
    );
    if (i === 0 || gap === 0) continue;
    const gapLeft = path(a0 - gap, 0),
      gapRight = path(a0 + gap, 0);
    wall(
      out,
      'block',
      gapLeft,
      gapRight,
      trackHeight,
      (x) => trackHeight(x) + q.crepis,
      normal,
      colors.blockDark,
    );
    strip(
      out,
      'dust',
      path(a0 - gap, 0.79),
      path(a0 + gap, 0.79),
      path(a0 + gap, 0.94),
      path(a0 - gap, 0.94),
      top,
      colors.bank,
    );
    for (let j = 0; j < rows; j++) {
      const aLeft = path(a0 - gap, (0.79 * j) / rows),
        aRight = path(a0 + gap, (0.79 * j) / rows);
      const bLeft = path(a0 - gap, (0.79 * (j + 1)) / rows),
        bRight = path(a0 + gap, (0.79 * (j + 1)) / rows);
      const stairHeight = (x) => trackHeight(x) + q.crepis + (j + 0.68) * riser;
      strip(out, 'bench', aLeft, aRight, bRight, bLeft, stairHeight, colors.damage);
      wall(
        out,
        'block',
        aLeft,
        aRight,
        (x) => stairHeight(x) - riser,
        stairHeight,
        normal,
        colors.blockDark,
      );
    }
  }
}

function uphillWall(out, path, start, end, rows, riser, lod, curved = false) {
  const n = curved ? [4, 8, 13, 16][lod] : [6, 18, 39, 67][lod];
  const innerTop = (x) => trackHeight(x) + q.crepis + rows * riser;
  const outerY = (x, z) => ground(x, z) + 0.13;
  for (let i = 0; i < n; i++) {
    const a = blend(start, end, i / n),
      b = blend(start, end, (i + 1) / n);
    const left = path(a, 0.94),
      right = path(b, 0.94),
      backA = path(a, 1),
      backB = path(b, 1);
    const top = (x, z) => Math.max(innerTop(x) + 1.05, ground(x, z) + 0.45);
    const normal = curved ? [1, 0, 0] : [0, 0, 1];
    wall(
      out,
      'block',
      left,
      right,
      innerTop,
      top,
      normal,
      i % 5 === 0 ? colors.blockDark : colors.block,
    );
    draw(
      out,
      'bench',
      [
        position(left, top(...left)),
        position(right, top(...right)),
        position(backB, outerY(...backB)),
        position(backA, outerY(...backA)),
      ],
      [0, 1, 0],
      colors.trim,
    );
  }
}

function southRemains(out, lod) {
  const a = track[8][0],
    b = track[9][0],
    n = [11, 22, 41, 65][lod];
  for (let i = 0; i < n; i++) {
    const start = blend(a, b, i / n),
      end = blend(a, b, (i + 1) / n);
    const nearA = south(start, 0),
      nearB = south(end, 0),
      farA = south(start, 1),
      farB = south(end, 1);
    const top = (x) => trackHeight(x) + 0.32 + (0.31 * ((i * 17) % 13)) / 13;
    wall(
      out,
      'block',
      nearB,
      nearA,
      trackHeight,
      top,
      [0, 0, -1],
      i % 3 === 0 ? colors.blockDark : colors.block,
    );
    strip(out, 'bench', nearA, nearB, south(end, 0.18), south(start, 0.18), top, colors.step);
    draw(
      out,
      'dust',
      [
        position(south(start, 0.18), top(...nearA)),
        position(south(end, 0.18), top(...nearB)),
        position(farB, ground(...farB) + 0.1),
        position(farA, ground(...farA) + 0.1),
      ],
      [0, 1, 0],
      colors.bank,
    );
    if (lod >= 2 && i % 8 < 4) {
      const p = south(start + 0.45 + (i % 3) * 0.31, 0.025 + (i % 4) * 0.037),
        y = top(...p) - 0.18;
      const w = 0.37 + 0.21 * (i % 5),
        z = 0.27 + 0.044 * (i % 7);
      box(
        out,
        'block',
        [p[0] - w, y - 0.35, p[1] - z],
        [p[0] + w, y + 0.24 + (i % 7) * 0.046, p[1] + z],
        i % 3 ? colors.damage : colors.pale,
      );
    }
  }
}

function entrance(out, lod) {
  const east = 88.8,
    width = 21.4;
  const middle = trackHeight(east);
  // The two surviving rows of starting slabs cross the east end of the racecourse.
  const intervals = lod === 0 ? 6 : 17;
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < intervals; i++) {
      const x = east - 3.27 + row * 0.99,
        z = -width / 2 + (i * width) / intervals;
      const step = width / intervals;
      box(
        out,
        'bench',
        [x - 0.34, middle - 0.15, z + 0.022],
        [x + 0.36, middle + 0.065 + (i % 4) * 0.021, z + step - 0.024],
        i % 3 === 0 ? colors.trim : colors.pale,
      );
      if (lod >= 2 && i % 4 !== 2)
        box(
          out,
          'block',
          [x - 0.29, middle + 0.111, z + step * 0.45],
          [x + 0.31, middle + 0.131, z + step * 0.54],
          colors.blockDark,
        );
    }
  for (const [i, z] of [-9.1, -3.03, 3.08, 9.12].entries()) {
    const x = east + 0.13 + (i % 2) * 0.08;
    box(
      out,
      'block',
      [x - 0.61, middle - 0.28, z - 0.62],
      [x + 0.68, middle + 0.32 + (i % 3) * 0.115, z + 0.66],
      colors.block,
    );
    if (lod >= 1)
      box(
        out,
        'bench',
        [x - 0.4, middle + 0.29, z - 0.42],
        [x + 0.42, middle + 0.51 + (i % 3) * 0.13, z + 0.43],
        colors.damage,
      );
  }
}

function build(out, lod) {
  course(out, lod);
  seats(out, north, xMin, xMax, q.northStairBreaks, q.northRows, q.northRiserEstimate, lod);
  seats(out, west, 0, 1, q.westStairBreaks, q.westRows, q.westRiserEstimate, lod, true);
  uphillWall(out, north, xMin, xMax, q.northRows, q.northRiserEstimate, lod);
  uphillWall(out, west, 0, 1, q.westRows, q.westRiserEstimate, lod, true);
  southRemains(out, lod);
  entrance(out, lod);
}
export const delphiSkyline = (out) => build(out, 0);
export const delphiDistrict = (out) => build(out, 1);
export const delphiStreet = (out) => build(out, 2);
export const delphiCloseup = (out) => build(out, 3);
const recipe = 'stadium-of-delphi-model.mjs';
const camera = [145, 73, 165],
  lookAt = [-5, 2.1, 0];
export const delphiModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: delphiCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The surviving stone banks of the Stadium of Delphi, sloped north seating, curved west end and eroded south wall around the open running surface.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -45,
  sunDirection: [-30, 35, 52],
  mediumFiContext: {
    scale: 3.2,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: perimeter,
    minimumCoverage: 0.9,
    basis: 'Named outer outline of the excavated stadium ruins.',
  },
  groundCutout: {
    outline: perimeter,
    basis:
      'Excavated track and stone terraces within the mapped stadium envelope. The source terrain elevations are preserved.',
  },
  embeddedCanonicalGraphs: ['stone_limestone_weathered', 'stone_limestone_raw'],
  qaCameras: [
    {
      name: 'whole-track-north-seats-and-west-curve',
      position: [97, 48, 88],
      lookAt: [-20, 1.6, -4],
    },
    { name: 'west-curve-and-north-aisles', position: [-111, 14, 21], lookAt: [-65, 2, -10] },
    {
      name: 'eastern-starting-stones-and-south-remains',
      position: [109, 12, 34],
      lookAt: [68, 1.8, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-stadium-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'delphiSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'delphiDistrict', 0.47],
        ['street', 'delphiStreet', 0.16],
        ['closeup', 'delphiCloseup', 0.074],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The geographic outlines are ODbL. The exact Qualla original is CC0 by Challisrussia.',
};
