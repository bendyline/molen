/** Current capped furnace-stack remnant, with original irregular fieldstone courses. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = Math.hypot(...p.originalPhotoPlan.circle[0]),
  foot = p.originalPhotoPlan.footing,
  TAU = Math.PI * 2;
const C = { core: rgb('77715e'), cap: rgb('cfcec0'), top: rgb('9b9e94') },
  palette = [
    '8c8570',
    'a39a82',
    '777263',
    'aaa18c',
    '8b846e',
    'b0a58c',
    '6d6c5c',
    '99927c',
    '827b69',
    'b4aa91',
  ].map(rgb);
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  cap: { slot: 'roof', graph: 'metal_painted', roughness: 0.9, metallic: 0.04 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  G = (q) => [q[0], F + q[1], q[2]],
  mean = (q) => q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length);
function random(i, j = 0) {
  let v = (Math.imul(i + 37, 374761393) ^ Math.imul(j + 19, 668265263)) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function T(o, k, q, n, col = k === 'cap' ? C.cap : C.core) {
  q = q.map(G).map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) throw Error('Collapsed furnace face');
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function radius(y) {
  return R + (A.topRadius - R) * Math.max(0, Math.min(1, y / A.stoneTop));
}
function circle(r, y, N) {
  return Array.from({ length: N }, (_, i) => [
    r * Math.cos((i * TAU) / N),
    y,
    r * Math.sin((i * TAU) / N),
  ]);
}
function disk(o, k, r, y, N, up, col) {
  const ring = circle(r, y, N);
  for (let i = 0; i < N; i++)
    T(o, k, [[0, y, 0], ring[i], ring[(i + 1) % N]], [0, up ? 1 : -1, 0], col);
}
export const courseEvidence = [],
  stoneEvidence = [];
function core(o, lod) {
  const N = [16, 32, 48, 64][lod],
    rows = [6, 8, 16, 24][lod];
  for (let j = 0; j < rows; j++) {
    const y0 = (A.stoneTop * j) / rows,
      y1 = (A.stoneTop * (j + 1)) / rows;
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N,
        ri = radius(y0) - 0.1,
        rj = radius(y1) - 0.1,
        P = (t, y, r) => {
          const wobble = 0.025 * Math.sin(t * 3 + y * 2.3) * Math.sin((Math.PI * y) / A.stoneTop);
          return [(r + wobble) * Math.cos(t), y, (r + wobble) * Math.sin(t)];
        };
      Q(
        o,
        'stone',
        [P(a, y0, ri), P(b, y0, ri), P(b, y1, rj), P(a, y1, rj)],
        [Math.cos((a + b) / 2), 0.08, Math.sin((a + b) / 2)],
        lod === 0 ? palette[(i + j * 3) % palette.length] : C.core,
      );
    }
  }
  disk(o, 'stone', R - 0.1, 0, N, false);
  disk(o, 'stone', A.topRadius - 0.1, A.stoneTop, N, true);
}
function solid(o, k, front, back, col, bevel = false) {
  const centre = mean([...front, ...back]),
    emit = (q) => T(o, k, q, sub(mean(q), centre), col);
  for (let i = 1; i < front.length - 1; i++) {
    emit([front[0], front[i], front[i + 1]]);
    emit([back[0], back[i + 1], back[i]]);
  }
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    if (bevel) {
      const a = front[i].map((x, k) => centre[k] + (x - centre[k]) * 0.87),
        b = front[j].map((x, k) => centre[k] + (x - centre[k]) * 0.87);
      emit([front[i], front[j], b]);
      emit([front[i], b, a]);
      emit([a, b, back[j]]);
      emit([a, back[j], back[i]]);
    } else {
      emit([front[i], front[j], back[j]]);
      emit([front[i], back[j], back[i]]);
    }
  }
}
function stone(o, row, index, count, rows, lod) {
  const h = A.stoneTop / rows,
    phase = (row % 2 ? 0.5 : 0) + 0.09 * (random(row, 7) - 0.5),
    theta = (TAU * (index + phase)) / count,
    width = (TAU / count) * (0.94 + 0.04 * random(row, index)),
    y0 = row * h + 0.015 + random(index, row) * 0.022,
    y1 = (row + 1) * h - 0.018 - random(row, index + 77) * 0.035,
    projection = 0.055 + A.roughnessProjection * random(row + 130, index),
    shape =
      lod === 0
        ? [
            [-0.5, 0],
            [0.5, 0],
            [0.5, 1],
            [-0.5, 1],
          ]
        : [
            [-0.42, 0],
            [0.4, 0.02],
            [0.5, 0.2],
            [0.48, 0.78],
            [0.37, 1],
            [-0.38, 0.97],
            [-0.5, 0.76],
            [-0.48, 0.2],
          ],
    P = ([x, y], d) => {
      const yy = y0 + (y1 - y0) * y,
        angle = theta + x * width;
      return [(radius(yy) + d) * Math.cos(angle), yy, (radius(yy) + d) * Math.sin(angle)];
    },
    front = shape.map((q) => P(q, projection)),
    back = shape.map((q) => P(q, -0.2)),
    color = palette[Math.floor(random(row + 340, index) * palette.length)];
  solid(o, 'stone', front, back, color, lod === 3);
  stoneEvidence.push({
    row,
    index,
    y0,
    y1,
    theta,
    projection,
    front: front.map((q) => q.slice()),
    back: back.map((q) => q.slice()),
    color,
  });
}
function courses(o, lod) {
  const rows = [6, 8, 16, 24][lod];
  for (let j = 0; j < rows; j++) {
    const count = [6, 12, 18 + Math.floor(random(j, 66) * 3), 23 + Math.floor(random(j, 66) * 5)][
      lod
    ];
    courseEvidence.push({
      row: j,
      count,
      y0: (A.stoneTop * j) / rows,
      y1: (A.stoneTop * (j + 1)) / rows,
    });
    for (let i = 0; i < count; i++) stone(o, j, i, count, rows, lod);
  }
}
function cover(o, lod) {
  const N = [16, 24, 48, 64][lod],
    r = A.capRadius,
    inner = r - 0.09;
  for (let i = 0; i < N; i++) {
    const a = (i * TAU) / N,
      b = ((i + 1) * TAU) / N,
      P = (radius, y, t) => [radius * Math.cos(t), y, radius * Math.sin(t)];
    Q(
      o,
      'cap',
      [P(r, A.capBottom, a), P(r, A.capBottom, b), P(r, A.capEdgeTop, b), P(r, A.capEdgeTop, a)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    Q(
      o,
      'cap',
      [
        P(r, A.capEdgeTop, a),
        P(r, A.capEdgeTop, b),
        P(inner, A.capEdgeTop, b),
        P(inner, A.capEdgeTop, a),
      ],
      [0, 1, 0],
    );
    T(
      o,
      'cap',
      [[0, A.capCrown, 0], P(inner, A.capEdgeTop, a), P(inner, A.capEdgeTop, b)],
      [0, 1, 0],
      C.top,
    );
  }
  disk(o, 'cap', r, A.capBottom, N, false);
}
function footing(o, lod) {
  const h = A.footingHeight;
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i],
      b = foot[(i + 1) % foot.length],
      n = [b[1] - a[1], 0, a[0] - b[0]],
      sign =
        foot.reduce((s, a, j) => {
          const b = foot[(j + 1) % foot.length];
          return s + a[0] * b[1] - b[0] * a[1];
        }, 0) > 0
          ? 1
          : -1;
    Q(
      o,
      'stone',
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], h, b[1]],
        [a[0], h, a[1]],
      ],
      n.map((x) => x * sign),
      C.core,
    );
  }
  for (let i = 1; i < foot.length - 1; i++) {
    T(
      o,
      'stone',
      [
        [foot[0][0], h, foot[0][1]],
        [foot[i][0], h, foot[i][1]],
        [foot[i + 1][0], h, foot[i + 1][1]],
      ],
      [0, 1, 0],
      palette[1],
    );
    T(
      o,
      'stone',
      [
        [foot[0][0], 0, foot[0][1]],
        [foot[i][0], 0, foot[i][1]],
        [foot[i + 1][0], 0, foot[i + 1][1]],
      ],
      [0, -1, 0],
    );
  }
  const count = [2, 6, 16, 26][lod];
  for (let i = 0; i < count; i++) {
    const x = 2 + random(i, 550) * 1.6,
      z = -1.6 - random(i, 551) * 1.05,
      y = 0.23 + random(i, 552) * 0.3,
      w = 0.32 + random(i, 553) * 0.45,
      H = 0.18 + random(i, 554) * 0.25,
      depth = 0.3 + random(i, 555) * 0.25,
      poly = [
        [-0.5, -0.35],
        [0.35, -0.5],
        [0.5, 0.2],
        [0.1, 0.5],
        [-0.45, 0.3],
      ],
      front = poly.map(([u, v]) => [x + u * w, y + v * H + 0.38, z + depth / 2]),
      back = poly.map(([u, v]) => [x + u * w, y + v * H + 0.38, z - depth / 2]);
    solid(o, 'stone', front, back, palette[i % palette.length], lod === 3);
  }
}
export function buildCatharineFurnace(o, _frame, lod = 3) {
  courseEvidence.length = 0;
  stoneEvidence.length = 0;
  core(o, lod);
  courses(o, lod);
  cover(o, lod);
  footing(o, lod);
}
export const catharineFurnaceSkyline = (o) => buildCatharineFurnace(o, null, 0),
  catharineFurnaceDistrict = (o) => buildCatharineFurnace(o, null, 1),
  catharineFurnaceStreet = (o) => buildCatharineFurnace(o, null, 2),
  catharineFurnaceCloseup = (o) => buildCatharineFurnace(o, null, 3);
export const catharineFurnaceModel = {
  id: 'catharine_furnace',
  key: 'catharine_furnace',
  cell: 'dq/dqb',
  title: 'Catharine Furnace',
  category: p.category,
  recipe: 'catharine-furnace-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCatharineFurnace,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole surviving Catharine Furnace stone-stack remnant in its current capped state: tapered nearcircular body, individually shaped projecting fieldstone courses/deep irregular joints/varied original warmgrey-olive stone colors, continuous pale protective cover/rim and short attached low rubble base. Three cleared2023NPS Qualla corpus renditions only; no photographic textures. NPS20ft description informs approximate6.1m height, with original photo-estimated radius/taper/courses/cap/footing. Fixed storysite anchor is approximate and differs12.7m from the separate native identityPOI; original plan is not a surveyed/mapped footprint. Hiddenrear/tuyeres/interior-under-cap/preciseprofiles/currentfinefinish/census/footingbearing and groundcontact unverified. Vanished36ft furnace/ninefactorybuildings/industrialgrounds/earthknoll/vegetation/fences/trails/signs/arttext not reconstructed.',
  camera: [13, 10, 15],
  lookAt: [0.4, 2.9, -0.3],
  portableGroundY: F - 0.18,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-opposite-stack-and-attached-low-rubble-base',
      position: [-11, 8, -13],
      lookAt: [0.6, 2.8, -0.5],
    },
    {
      name: 'upper-projecting-stone-courses-and-pale-cap-rim',
      position: [6, 6.8, 7],
      lookAt: [0, 4.8, 0],
    },
    {
      name: 'lower-fieldstone-joints-and-intrinsic-rubble-footing',
      position: [8, 3.5, -7],
      lookAt: [1.7, 1.5, -1.5],
    },
    { name: 'whole-tapered-current-stack-profile', position: [-10, 4.2, 1], lookAt: [0, 3, 0] },
    {
      name: 'closed-protective-cover-and-original-photo-plan',
      position: [0.1, 22, 0.15],
      lookAt: [0.4, 2.5, -0.4],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/catharine-furnace-runtime-overlay.mjs',
    level: 'skyline',
    export: 'catharineFurnaceSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'catharineFurnaceDistrict', errorMeters: 0.22, surfaces },
      street: { export: 'catharineFurnaceStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'catharineFurnaceCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Three cleared published2023MaryONeill/NPS corpus images individually inspected, unchanged publishedPD-USNPS policy passed, native government grant/source/accessions agree. Published1920px renditions are resized/recompressed and not native-byte-identical; local and native hashes recorded separately. Two other omittedlocalPDbasis photos, Wellfordportrait and intactfactoryconjecture unselected. No supplemental/questionable source/source-repair/reclassification/guard changes or copiedpixels. Original photo-based circular plan/taper/stonecourse geometry/pale protectivecover/lowfooting, no native measured polygon. Exact hiddenback/tuyeres/coveredinterior/capconstruction/stonecensus/currentfinish/absolute centre/footingbearing unknown; no inventedopenarch/uncappedchimney or historicalfactory.',
    'Original256m129x12916641sample field/one rawtile/fixedapproximate-storysite80.9407m provider-relative datum frozen before every floor/radius/section/geometry choice. Storyanchor/nativeidentitypoint differ12.7m; approximate visualization position and facing only. No terrainfit/flatten/reacquire/modelraising. Exact base/hill contact unresolved; preview/replaceFootprint=false. Flatground and syntheticneighbors are review fixtures only.',
  ],
};
