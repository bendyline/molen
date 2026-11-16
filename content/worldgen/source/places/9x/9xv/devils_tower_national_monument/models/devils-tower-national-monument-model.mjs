/** The surveyed monolith, its talus, and the historic visitor center. Distances are in metres. */
import { readFileSync } from 'node:fs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const survey = read('monolith-sections.json');
const [rockBoundary, visitorFootprint] = frame.geometry.polygons;
const [approach] = frame.geometry.centerlines;
const { visitorCenter } = plan.section;
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_log', roughness: 0.92, metallic: 0 },
  shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.94, metallic: 0 },
  walk: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.32, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    phonolite: 'c0b397',
    talus: 'a09880',
    block: 'b5a88a',
    chinking: 'a59179',
    logs: '93806d',
    sash: '71604d',
    foundation: 'aaa293',
    shingles: '96938e',
    chimney: 'bba58d',
    walk: 'ada69a',
    glass: '798084',
  }).map(([name, value]) => [name, rgb(value)]),
);
const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
const shade = (color, light) => color.map((value) => Math.min(1, value * light));
const datum = survey.datumElevationMeters;

function elevation(grid, x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = grid.heightsMeters[j];
  const b = grid.heightsMeters[j + 1];
  if (!a || !b || i < 0 || i + 1 >= a.length) return undefined;
  return mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j);
}

const terrainY = (x, z) => (elevation(survey.detailGrid, x, z) ?? elevation(field, x, z)) - datum;

function inside([x, z], polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j];
    const [bx, bz] = polygon[i];
    if (az > z !== bz > z && x < ax + ((bx - ax) * (z - az)) / (bz - az)) result = !result;
  }
  return result;
}

function upward(out, slot, a, b, c, color) {
  if ((b[2] - a[2]) * (c[0] - a[0]) < (b[0] - a[0]) * (c[2] - a[2])) {
    triangle(out, slot, [a, c, b], color);
  } else {
    triangle(out, slot, [a, b, c], color);
  }
}

const toPlan = ([x, , z]) => [x, z];
const outer = rockBoundary.map(([x, z], i) => [
  x,
  survey.maskBoundaryHeightsMeters[i] - datum + 0.13,
  z,
]);
const baseY = survey.sections[0].heightMeters - datum;
const rimY = survey.sections.at(-1).heightMeters - datum;

function cliffRings(lod) {
  const levels = [
    [0, 2, 4, 6, 8, 10],
    [0, 1, 3, 5, 7, 8, 9, 10],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  ][lod];
  const columns = [24, 36, 56, 72][lod];
  const faces = [1, 2, 3, 4][lod];
  const [centerX, centerZ] = survey.surveyOrigin;
  return levels.map((level) => {
    const { heightMeters, radiiMeters } = survey.sections[level];
    // Keep measured rims exact where they join the summit and apron.
    const relief = Math.min(1, level / 2, (10 - level) / 2);
    return Array.from({ length: columns * faces }, (_, index) => {
      const column = Math.floor(index / faces);
      const next = (column + 1) % columns;
      const phase = (index % faces) / faces;
      const jitter = (n) => 0.19 * Math.sin(n * 5.382) + 0.09 * Math.cos(n * 2.42);
      const bend = 0.013 * relief * Math.sin(column * 0.36 + level * 0.24);
      const angle =
        (tau * (column + phase + mix(jitter(column), jitter(next), phase))) / columns + bend;
      const sample = ((angle / tau + 1) % 1) * survey.sampleCount;
      const start = Math.floor(sample);
      const reference = mix(
        radiiMeters[start],
        radiiMeters[(start + 1) % survey.sampleCount],
        sample - start,
      );
      const depth =
        (0.8 + 0.82 * (1 + Math.sin(column * 2.21)) + 0.52 * Math.cos(column * 0.23)) * relief;
      const groove = Math.sin(Math.PI * phase) * depth - 0.43 * depth;
      const radius = reference + (lod > 0 ? groove : 0);
      return [
        centerX + radius * Math.cos(angle),
        heightMeters - datum,
        centerZ + radius * Math.sin(angle),
      ];
    });
  });
}

function stoneCliff(out, rings, lod) {
  const faces = [1, 2, 3, 4][lod];
  for (let level = 1; level < rings.length; level++) {
    const low = rings[level - 1];
    const high = rings[level];
    for (let k = 0; k < low.length; k++) {
      const next = (k + 1) % low.length;
      const column = Math.floor(k / faces);
      const shaft = 0.96 + 0.082 * Math.sin(column * 2.2) + 0.056 * Math.cos(column * 0.71);
      const cornerShade = faces === 1 ? 1 : 0.94 + 0.09 * Math.sin(((k % faces) + 0.5) * 2.67);
      const weathering =
        0.94 + (0.06 * level) / (rings.length - 1) + 0.034 * Math.sin(column * 0.47 + level * 1.3);
      const color = shade(tint.phonolite, shaft * cornerShade * weathering);
      triangle(out, 'rock', [low[next], low[k], high[k]], color);
      triangle(out, 'rock', [low[next], high[k], high[next]], color);
    }
  }
}

function apex(out, rim, lod) {
  if (lod === 0) {
    const center = [
      survey.surveyOrigin[0],
      survey.exactRasterMaximumMeters - datum,
      survey.surveyOrigin[1],
    ];
    for (let i = 0; i < rim.length; i++) {
      upward(out, 'rock', center, rim[i], rim[(i + 1) % rim.length], tint.phonolite);
    }
    return;
  }
  const steps = [1, 2, 4, 7][lod];
  const [cx, cz] = survey.surveyOrigin;
  const center = [cx, terrainY(cx, cz), cz];
  let last = rim;
  for (let step = steps - 1; step > 0; step--) {
    const next = rim.map(([x, , z]) => {
      const sx = mix(cx, x, step / steps);
      const sz = mix(cz, z, step / steps);
      return [sx, Math.max(rimY + 0.03, terrainY(sx, sz)), sz];
    });
    for (let i = 0; i < last.length; i++) {
      const j = (i + 1) % last.length;
      const color = shade(tint.phonolite, 0.99 + 0.045 * Math.cos(i * 0.41 + step * 0.72));
      upward(out, 'rock', last[i], next[i], next[j], color);
      upward(out, 'rock', last[i], next[j], last[j], color);
    }
    last = next;
  }
  for (let i = 0; i < last.length; i++) {
    upward(out, 'rock', center, last[i], last[(i + 1) % last.length], tint.phonolite);
  }
}

// The measured contours and the mapped outer boundary are star-shaped about the survey origin.
function radialIntersection(ring, angle) {
  const [cx, cz] = survey.surveyOrigin;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const sideA = cosine * (a[2] - cz) - sine * (a[0] - cx);
    const sideB = cosine * (b[2] - cz) - sine * (b[0] - cx);
    if (Math.abs(sideA - sideB) < 1e-9) continue;
    const fraction = sideA / (sideA - sideB);
    if (fraction < -1e-8 || fraction > 1 + 1e-8) continue;
    const point = a.map((value, j) => mix(value, b[j], fraction));
    if ((point[0] - cx) * cosine + (point[2] - cz) * sine > 0) return point;
  }
  throw new Error(`No intersection with surveyed rock contour at ${angle}`);
}

function rockfall(out, inner, lod) {
  const [cx, cz] = survey.surveyOrigin;
  const bearings = [...outer, ...inner]
    .map(([x, , z]) => Math.atan2(z - cz, x - cx))
    .sort((a, b) => a - b)
    .filter((value, i, values) => i === 0 || value - values[i - 1] > 1e-6);
  const bands = [2, 4, 7, 11][lod];
  const slices = bearings.map((angle) => {
    const a = radialIntersection(inner, angle);
    const b = radialIntersection(outer, angle);
    return [
      a,
      ...Array.from({ length: bands - 1 }, (_, i) => {
        const fraction = (i + 1) / bands;
        const x = mix(a[0], b[0], fraction);
        const z = mix(a[2], b[2], fraction);
        return [x, Math.min(baseY, terrainY(x, z)) + 0.24, z];
      }),
      b,
    ];
  });
  for (let i = 0; i < slices.length; i++) {
    const a = slices[i];
    const b = slices[(i + 1) % slices.length];
    for (let j = 0; j < bands; j++) {
      const [x, , z] = a[j];
      const tone = 0.99 + 0.035 * Math.sin(x * 0.105 + z * 0.127);
      const color = shade(blend(tint.block, tint.talus, j / (bands - 1)), tone);
      upward(out, 'rock', a[j], b[j], b[j + 1], color);
      upward(out, 'rock', a[j], b[j + 1], a[j + 1], color);
    }
  }
  const innerPlan = inner.map(toPlan);
  // The apron covers the masked terrain edge even when coarser elevation tiles stream in.
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const foot = ([x, y, z]) => [x, y - 6.5, z];
    face(out, 'rock', [a, b, foot(b), foot(a)], tint.talus);
  }
  if (lod === 0) return;
  const spacing = [0, 23, 12, 6.9][lod];
  for (let iz = 0; iz * spacing < 292; iz++) {
    for (let ix = 0; ix * spacing < 249; ix++) {
      const scatter = Math.sin(13.51 * ix + 47.77 * iz);
      const x = -134 + ix * spacing + scatter * spacing * 0.42;
      const z = -156 + iz * spacing + Math.cos(scatter * 4.7) * spacing * 0.43;
      if (inside([x, z], rockBoundary) && !inside([x, z], innerPlan)) {
        const r = (0.8 + 0.85 * (1 + Math.cos(ix * iz + scatter))) * (lod === 1 ? 1.46 : 1);
        boulder(out, x, Math.min(baseY, terrainY(x, z)) - 0.16, z, r, scatter, tint.block);
      }
    }
  }
}

function boulder(out, x, y, z, radius, seed, color) {
  const ring = Array.from({ length: 5 }, (_, i) => {
    const angle = (tau * i) / 5 + seed * 2.7;
    const width = radius * (0.84 + 0.23 * Math.sin(seed * 7 + i * 2.8));
    return [x + width * Math.cos(angle), y - 0.29, z + width * Math.sin(angle)];
  });
  const top = [
    x + radius * seed * 0.23,
    y + radius * (0.51 + Math.abs(seed) * 0.49),
    z - radius * 0.18,
  ];
  for (let i = 0; i < ring.length; i++) {
    upward(
      out,
      'rock',
      ring[i],
      ring[(i + 1) % ring.length],
      top,
      shade(color, 0.88 + 0.15 * Math.sin(i + seed)),
    );
  }
}

const floorY = -0.48;
const ridgeH = visitorCenter.eavesAboveFloorMeters + visitorCenter.roofRiseMeters;
const [visitorX, visitorZ] = visitorCenter.anchor;
const cos = Math.cos(visitorCenter.heading);
const sin = Math.sin(visitorCenter.heading);
const localPlan = visitorFootprint.map(([x, z]) => [
  (x - visitorX) * cos - (z - visitorZ) * sin,
  (x - visitorX) * sin + (z - visitorZ) * cos,
]);
const ridgeZ = -0.86;
const roofHeight = (z) => ridgeH - Math.abs(z - ridgeZ) * 0.364;

function roofPanel(out, x0, x1, z0, z1) {
  const a = [x0, roofHeight(z0), z0];
  const b = [x1, roofHeight(z0), z0];
  const c = [x1, roofHeight(z1), z1];
  const d = [x0, roofHeight(z1), z1];
  const color = z0 < ridgeZ ? shade(tint.shingles, 0.91) : tint.shingles;
  upward(out, 'shingle', a, b, c, color);
  upward(out, 'shingle', a, c, d, color);
  const atEave = z0 === ridgeZ ? [d, c] : [b, a];
  const below = ([x, y, z]) => [x, y - 0.16, z];
  face(out, 'wood', [...atEave, below(atEave[1]), below(atEave[0])], tint.sash);
}

function log(out, a, b, height, radius, sides, color) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len;
  const dz = (b[1] - a[1]) / len;
  const ends = [
    [a[0] - dx * 0.16, a[1] - dz * 0.16],
    [b[0] + dx * 0.16, b[1] + dz * 0.16],
  ];
  const ring = ([x, z]) =>
    Array.from({ length: sides }, (_, j) => {
      const theta = (tau * j) / sides;
      const away = Math.cos(theta) * radius;
      return [x + dz * away, height + radius * Math.sin(theta), z - dx * away];
    });
  const [from, to] = ends.map(ring);
  for (let j = 0; j < sides; j++) {
    const k = (j + 1) % sides;
    face(out, 'wood', [from[k], to[k], to[j], from[j]], shade(color, j === sides - 1 ? 0.82 : 1));
    triangle(
      out,
      'wood',
      [from[k], from[j], [ends[0][0], height, ends[0][1]]],
      shade(tint.logs, 1.22),
    );
    triangle(out, 'wood', [to[j], to[k], [ends[1][0], height, ends[1][1]]], shade(tint.logs, 1.22));
  }
}

function window(out, x, z, y, width, height, columns, rows, lod) {
  const left = x - width / 2;
  const right = x + width / 2;
  box(
    out,
    'wood',
    [left - 0.08, y - 0.08, z - 0.06],
    [right + 0.08, y + height + 0.08, z + 0.041],
    tint.sash,
  );
  box(out, 'glass', [left, y, z + 0.04], [right, y + height, z + 0.062], tint.glass);
  if (lod < 2) return;
  for (let i = 1; i < columns; i++) {
    const at = mix(left, right, i / columns);
    box(out, 'wood', [at - 0.021, y, z + 0.06], [at + 0.021, y + height, z + 0.094], tint.sash);
  }
  for (let i = 1; i < rows; i++) {
    const at = y + (height * i) / rows;
    box(out, 'wood', [left, at - 0.019, z + 0.06], [right, at + 0.019, z + 0.094], tint.sash);
  }
  box(out, 'wood', [left - 0.13, y - 0.105, z], [right + 0.13, y - 0.046, z + 0.16], tint.logs);
}

function centerWalls(out, lod) {
  const local = transform(out, visitorCenter.heading, [visitorX, floorY, visitorZ]);
  for (let i = 0; i < localPlan.length; i++) {
    const a = localPlan[i];
    const b = localPlan[(i + 1) % localPlan.length];
    const ga = terrainY(...visitorFootprint[i]) - floorY - 0.8;
    const gb = terrainY(...visitorFootprint[(i + 1) % localPlan.length]) - floorY - 0.8;
    const stoneTop = 0.08;
    face(
      local,
      'base',
      [
        [b[0], gb, b[1]],
        [a[0], ga, a[1]],
        [a[0], stoneTop, a[1]],
        [b[0], stoneTop, b[1]],
      ],
      tint.foundation,
    );
    // Split the two end walls where the ridge crosses the original mapped edge.
    const crossesRidge = (a[1] - ridgeZ) * (b[1] - ridgeZ) < 0;
    const sections = crossesRidge
      ? [a, [mix(a[0], b[0], (ridgeZ - a[1]) / (b[1] - a[1])), ridgeZ], b]
      : [a, b];
    for (let j = 1; j < sections.length; j++) {
      const from = sections[j - 1];
      const to = sections[j];
      const color = lod > 1 ? tint.chinking : tint.logs;
      face(
        local,
        'wood',
        [
          [to[0], stoneTop, to[1]],
          [from[0], stoneTop, from[1]],
          [from[0], roofHeight(from[1]) - 0.08, from[1]],
          [to[0], roofHeight(to[1]) - 0.08, to[1]],
        ],
        color,
      );
      if (lod > 1) {
        const ha = roofHeight(from[1]) - 0.17;
        const hb = roofHeight(to[1]) - 0.17;
        const step = lod === 3 ? 0.255 : 0.32;
        for (let h = 0.23, course = 0; h < Math.max(ha, hb); h += step, course++) {
          const cut = Math.min(1, Math.max(0, (h - ha) / (hb - ha || 1)));
          const boundary = [mix(from[0], to[0], cut), mix(from[1], to[1], cut)];
          const start = h > ha ? boundary : from;
          const end = h > hb ? boundary : to;
          if (Math.hypot(end[0] - start[0], end[1] - start[1]) > 0.24)
            log(
              local,
              start,
              end,
              h,
              0.47 * step,
              lod === 3 ? 7 : 5,
              shade(tint.logs, 0.93 + 0.09 * Math.sin(course * 2.9)),
            );
        }
      }
    }
  }
  roofPanel(local, -10.36, 1.02, ridgeZ, 5.26);
  roofPanel(local, 1.02, 8.97, ridgeZ, 3.54);
  roofPanel(local, -10.36, 2.48, -6.85, ridgeZ);
  roofPanel(local, 2.48, 8.97, -4.12, ridgeZ);
  for (const [x, z, h] of [
    [-9.4, -1.42, 0.82],
    [3.63, -1.38, 0.58],
  ]) {
    const y = roofHeight(z) - 0.33;
    box(local, 'base', [x - 0.37, y, z - 0.35], [x + 0.37, y + h, z + 0.35], tint.chimney);
    box(
      local,
      'base',
      [x - 0.43, y + h - 0.04, z - 0.41],
      [x + 0.43, y + h + 0.1, z + 0.41],
      tint.chimney,
    );
  }
  if (lod === 0) return;
  window(local, -8.08, 4.92, 0.94, 1.42, 1.04, 3, 2, lod);
  window(local, -1.42, 4.99, 0.91, 1.92, 1.62, 3, 4, lod);
  window(local, 5.12, 3.24, 1.09, 1.08, 1.05, 2, 2, lod);
  box(local, 'wood', [-4.98, 0.04, 4.83], [-3.94, 2.34, 5.03], tint.sash);
  box(local, 'wood', [-4.84, 0.08, 5.02], [-4.08, 2.23, 5.07], shade(tint.logs, 1.16));
  box(local, 'base', [-5.14, -0.29, 4.94], [-3.74, 0.07, 5.48], tint.foundation);
  if (lod > 1) {
    box(local, 'wood', [-3.62, 0.04, 5.12], [-3.45, 2.83, 5.29], tint.sash);
    box(local, 'glass', [-4.72, 1.48, 5.07], [-4.2, 2.02, 5.09], tint.glass);
  }
}

function pavedPath(out, lod) {
  if (lod === 0) return;
  const edge = approach.map(([x, z], i) => {
    const a = approach[Math.max(0, i - 1)];
    const b = approach[Math.min(approach.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sideX = (1.11 * (b[1] - a[1])) / d;
    const sideZ = (1.11 * (a[0] - b[0])) / d;
    return [-1, 1].map((side) => {
      const u = x + sideX * side;
      const v = z + sideZ * side;
      return [u, terrainY(u, v) + 0.15, v];
    });
  });
  for (let i = 1; i < edge.length; i++) {
    const [a, b] = edge[i - 1];
    const [c, d] = edge[i];
    const color = shade(tint.walk, 0.98 + 0.04 * Math.sin(i * 3.1));
    upward(out, 'walk', a, b, d, color);
    upward(out, 'walk', a, d, c, color);
  }
}

function build(out, lod) {
  const rings = cliffRings(lod);
  stoneCliff(out, rings, lod);
  apex(out, rings.at(-1), lod);
  rockfall(out, rings[0], lod);
  centerWalls(out, lod);
  pavedPath(out, lod);
}

export const devilsTowerSkyline = (out) => build(out, 0);
export const devilsTowerDistrict = (out) => build(out, 1);
export const devilsTowerStreet = (out) => build(out, 2);
export const devilsTowerCloseup = (out) => build(out, 3);

const recipe = 'devils-tower-national-monument-model.mjs';
const camera = [-520, 181, 363];
const lookAt = [-97, 113, 2];
export const devilsTowerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: devilsTowerCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  groundCutout: {
    outline: rockBoundary,
    basis:
      'The OSM bare-rock boundary limits replacement to the measured monolith and reconstructed talus. The surrounding USGS field and visitor center ground stay visible.',
  },
  buildingCutout: {
    outline: visitorFootprint,
    minimumCoverage: 0.995,
    basis: 'Restricted to the mapped Visitor Center footprint from OpenStreetMap way/71356677.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Devils Tower / Bear Lodge above its open talus, with a flat-crested fluted phonolite shaft and the historic log visitor center near the west approach.',
  camera,
  lookAt,
  sunDirection: [-42, 72, 68],
  mediumFiContext: {
    scale: 3.5,
    groundY: 0,
    cameraYaw: -1.19,
    focus: { center: [-21, 83, -5] },
    far: 5300,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  qaCameras: [
    { name: 'whole-monument-and-visitor-site', position: camera, lookAt },
    { name: 'fluted-cliff-and-talus', position: [-282, 142, 200], lookAt: [-4, 147, -6] },
    { name: 'summit-and-north-columns', position: [134, 330, -218], lookAt: [-4, 222, -8] },
    { name: 'visitor-center-east-front', position: [-406, 2.1, 33], lookAt: [-430, 1.5, 32] },
    {
      name: 'visitor-center-gable-and-cedar-roof',
      position: [-414, 10, 55],
      lookAt: [-430, 1.5, 32],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `devils-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'devilsTowerSkyline',
    errorMeters: 5.8,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'devilsTowerDistrict', 2.5],
        ['street', 'devilsTowerStreet', 0.96],
        ['closeup', 'devilsTowerCloseup', 0.23],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. USGS elevation samples and referenced National Park Service photographs are public domain. Native mapped boundaries are OpenStreetMap ODbL 1.0.',
};
