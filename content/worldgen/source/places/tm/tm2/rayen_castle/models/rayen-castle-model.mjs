/** The standing earthen enceinte, wallwalk and interior courts at Arg-e Rayen. */
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline, towerArcs } = read('map-frame').geometry;
const terrain = read('terrain-grid');
const d = plan.dimensions;
const ref = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    adobe: 'af9273',
    earth: 'a58a6e',
    plinth: '9d8166',
    light: 'c2a688',
    wallwalk: 'af9478',
    tawny: 'b69a7e',
    clay: 'a2876b',
    ochre: 'b69c81',
    shadow: '615043',
    mortar: 'ae967b',
  }).map(([k, v]) => [k, rgb(v)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.99 },
  adobe: { slot: 'wall', graph: 'brick', roughness: 0.97 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.99 },
  detail: { slot: 'trim', localRef: ref, roughness: 0.98 },
};

function terrainAt([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const interpolate = (row) => row[i] + (row[i + 1] - row[i]) * (u - i);
  return (
    interpolate(terrain.heightsMeters[j]) * (1 - v + j) +
    interpolate(terrain.heightsMeters[j + 1]) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}

const centeredGrade = ([x, z]) =>
  (terrainAt([x, z]) * 2 +
    terrainAt([x - 2, z]) +
    terrainAt([x + 2, z]) +
    terrainAt([x, z - 2]) +
    terrainAt([x, z + 2])) /
  6;
const length = ([x, z]) => Math.hypot(x, z);
const unit = (p) => p.map((x) => x / length(p));
const between = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const withY = ([x, z], y) => [x, y, z];
const stages = outline.map((p, i) => {
  const previous = outline[(i + outline.length - 1) % outline.length];
  const next = outline[(i + 1) % outline.length];
  const before = unit([p[0] - previous[0], p[1] - previous[1]]);
  const after = unit([next[0] - p[0], next[1] - p[1]]);
  const normal = unit([-before[1] - after[1], before[0] + after[0]]);
  const center = outline[i];
  const tower = towerArcs.findIndex(([a, b]) => i >= a && i <= b);
  const localGrade = centeredGrade(center);
  const [first, last] = towerArcs[tower] ?? [0, -1];
  const towerRise = tower < 0 ? 0 : Math.min(2.53, (i - first) * 0.86, (last - i) * 0.86);
  return {
    index: i,
    center,
    normal,
    base: localGrade - 2.25,
    top: localGrade + d.wallHeightM + towerRise,
    tower,
  };
});
const gateCenter = 0.75;
const outerEdge = (p, offset) => p.center.map((v, i) => v + p.normal[i] * offset);

function face(out, slot, points, normal, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      ref,
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

function pointOf(a, b, t) {
  return {
    center: between(a.center, b.center, t),
    normal: unit(between(a.normal, b.normal, t)),
    base: a.base + (b.base - a.base) * t,
    top: a.top + (b.top - a.top) * t,
  };
}

function castellatedTop(out, a, b, spacing, detail, phase) {
  const distance = length([b.center[0] - a.center[0], b.center[1] - a.center[1]]);
  const nx = (a.normal[0] + b.normal[0]) / 2,
    nz = (a.normal[1] + b.normal[1]) / 2;
  const facing = [-nx, 0, -nz];
  const depth = 0.72;
  const baseline = 0.38;
  for (let step = spacing - phase; step < distance; step += spacing) {
    const t = step / distance;
    const station = pointOf(a, b, t);
    const w = Math.min(0.7, spacing * 0.48);
    const reach = Math.min(w / (2 * distance), t * 0.92, (1 - t) * 0.92);
    if (reach * distance < 0.09) continue;
    const left = pointOf(a, b, t - reach),
      right = pointOf(a, b, t + reach);
    const y = station.top + baseline;
    const ridgeY = station.top + d.outerMerlonRiseM;
    const p = withY(outerEdge(left, 0.32), y),
      q = withY(outerEdge(right, 0.32), y);
    const r = withY(outerEdge(right, 0.32 + depth), y),
      s = withY(outerEdge(left, 0.32 + depth), y);
    face(
      out,
      'wall',
      [
        withY(outerEdge(left, 0.32), station.top - 0.025),
        withY(outerEdge(right, 0.32), station.top - 0.025),
        q,
        p,
      ],
      facing,
      c.light,
    );
    if (detail === 3 && Math.floor(station.center[0] + station.center[1]) % 2 === 0) {
      const inset = 0.23;
      const center = station.top - 1.35;
      const jamb = (p, y) => withY(outerEdge(p, inset), y);
      const l = pointOf(a, b, t - reach * 0.28);
      const r = pointOf(a, b, t + reach * 0.28);
      face(
        out,
        'detail',
        [
          jamb(l, center - 0.35),
          jamb(r, center - 0.35),
          jamb(r, center + 0.38),
          jamb(l, center + 0.38),
        ],
        facing,
        c.shadow,
      );
    }
    const capSegments = detail === 3 ? 6 : detail === 2 ? 4 : 2;
    for (let i = 0; i < capSegments; i++) {
      const u = i / capSegments;
      const v = (i + 1) / capSegments;
      const peak = (t) => y + (ridgeY - y) * Math.sin(Math.PI * t);
      const frontA = withY(between([p[0], p[2]], [q[0], q[2]], u), peak(u));
      const frontB = withY(between([p[0], p[2]], [q[0], q[2]], v), peak(v));
      if (i > 0) face(out, 'wall', [p, frontA, frontB], facing, c.adobe);
      if (detail < 2) continue;
      const backA = withY(between([s[0], s[2]], [r[0], r[2]], u), peak(u));
      const backB = withY(between([s[0], s[2]], [r[0], r[2]], v), peak(v));
      if (i > 0)
        face(
          out,
          'wall',
          [s, backA, backB],
          facing.map((value) => -value),
          c.tawny,
        );
      face(out, 'wall', [frontA, frontB, backB, backA], [0, 1, 0], c.tawny);
    }
  }
}

function rampartSection(out, a, b, relativeOpen, detail, sill) {
  const nx = (a.normal[0] + b.normal[0]) / 2,
    nz = (a.normal[1] + b.normal[1]) / 2;
  const facing = [-nx, 0, -nz];
  const a0 = withY(a.center, relativeOpen ? a.open : a.base),
    b0 = withY(b.center, relativeOpen ? b.open : b.base);
  const a1 = withY(outerEdge(a, 0.38), a.top),
    b1 = withY(outerEdge(b, 0.38), b.top);
  const av = withY(outerEdge(a, d.wallThicknessM), a.top - 0.19),
    bv = withY(outerEdge(b, d.wallThicknessM), b.top - 0.19);
  const ai = withY(outerEdge(a, d.wallThicknessM), relativeOpen ? a.open : a.base);
  const bi = withY(outerEdge(b, d.wallThicknessM), relativeOpen ? b.open : b.base);
  face(out, 'wall', [a0, b0, b1, a1], facing, c.adobe);
  face(out, 'roof', [a1, b1, bv, av], [0, 1, 0], c.wallwalk);
  face(
    out,
    'wall',
    [ai, bi, bv, av],
    facing.map((v) => -v),
    c.earth,
  );
  if (relativeOpen) face(out, 'wall', [a0, b0, bi, ai], [0, -1, 0], c.shadow);
  if (detail < 2 || relativeOpen || sill) return;
  if (length([b.center[0] - a.center[0], b.center[1] - a.center[1]]) < 1.25) return;
  const start = withY(outerEdge(a, 0.331), a.top - 0.78),
    end = withY(outerEdge(b, 0.331), b.top - 0.78);
  face(
    out,
    'adobe',
    [start, end, [end[0], end[1] + 0.24, end[2]], [start[0], start[1] + 0.24, start[2]]],
    facing,
    c.clay,
  );
}

function archTop(z) {
  const width = d.gateWidthM;
  const x = (z - gateCenter) / (width * 0.5);
  return d.gateShoulderM + (d.gateCrownM - d.gateShoulderM) * Math.sqrt(Math.max(0, 1 - x * x));
}

function wallSegment(out, a, b, detail) {
  const isGate =
    a.tower === d.gateTowerIndex &&
    b.tower === d.gateTowerIndex &&
    a.center[0] > 109 &&
    b.center[0] > 109 &&
    Math.abs(b.center[1] - a.center[1]) > 0.001;
  if (!isGate) {
    rampartSection(out, a, b, false, detail, false);
    return;
  }
  const leaves = [0, 1];
  for (const offset of [-0.5, -0.33, -0.16, 0, 0.16, 0.33, 0.5]) {
    const z = gateCenter + offset * d.gateWidthM;
    const t = (z - a.center[1]) / (b.center[1] - a.center[1]);
    if (t > 0.001 && t < 0.999) leaves.push(t);
  }
  leaves.sort((p, q) => p - q);
  for (let i = 0; i < leaves.length - 1; i++) {
    const start = pointOf(a, b, leaves[i]),
      end = pointOf(a, b, leaves[i + 1]);
    const inside = Math.abs((start.center[1] + end.center[1]) / 2 - gateCenter) < d.gateWidthM / 2;
    if (inside) {
      start.open = archTop(start.center[1]);
      end.open = archTop(end.center[1]);
    }
    rampartSection(out, start, end, inside, detail, true);
    if (!inside) continue;
    for (const edge of [start, end]) {
      if (Math.abs(Math.abs(edge.center[1] - gateCenter) - d.gateWidthM / 2) > 0.028) continue;
      const n = [0, 0, Math.sign(gateCenter - edge.center[1])];
      face(
        out,
        'adobe',
        [
          withY(edge.center, edge.base),
          withY(outerEdge(edge, d.wallThicknessM), edge.base),
          withY(outerEdge(edge, d.wallThicknessM), edge.open),
          withY(edge.center, edge.open),
        ],
        n,
        c.earth,
      );
    }
  }
}

function perimeter(out, detail) {
  const stride = detail === 0 ? 4 : detail === 1 ? 2 : 1;
  const keep = new Set(towerArcs.flatMap(([a, b]) => [a, b]));
  for (let index = 54; index <= 68; index++) keep.add(index);
  const ring = stages.filter((p) => p.index % stride === 0 || keep.has(p.index));
  const spacing = [2.7, 2.08, 1.24, 1.09][detail];
  let phase = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    wallSegment(out, a, b, detail);
    const total = length([b.center[0] - a.center[0], b.center[1] - a.center[1]]);
    if (detail >= 2 && a.tower >= 0 && a.tower === b.tower && total < 2.8)
      castellatedTop(out, a, b, Math.max(total, 0.45), detail, Math.max(total, 0.45) - total / 2);
    else if (detail) castellatedTop(out, a, b, spacing, detail, phase);
    phase = (phase + total) % spacing;
  }
}

function structure(out, x, z, w, depth, y, h, tint) {
  box(out, 'wall', x, y, z, w, h, depth, tint);
}

function innerTower(out, x, z, y, h, r, detail) {
  const segments = [6, 10, 16, 22][detail];
  profile(
    out,
    [
      [y, r, r],
      [y + h - 0.55, r * 0.9, r * 0.9, 'wall', c.adobe],
      [y + h, r * 0.96, r * 0.96, 'adobe', c.ochre],
      [y + h, r * 0.12, r * 0.12, 'roof', c.earth],
    ],
    segments,
    [x, z],
  );
  if (!detail) return;
  const count = detail === 1 ? 8 : 13;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    box(
      out,
      'wall',
      x + Math.cos(angle) * r * 0.85,
      y + h - 0.11,
      z + Math.sin(angle) * r * 0.85,
      0.52,
      0.67,
      0.49,
      c.adobe,
    );
  }
}

function innerCitadel(out, detail) {
  const base = 3.66;
  const top = 8.83;
  const left = -59,
    right = -13,
    north = -25,
    south = 12;
  structure(out, (left + right) / 2, north, right - left, 2.8, base - 2.3, top, c.adobe);
  structure(out, (left + right) / 2, south, right - left, 2.8, base - 2.3, top, c.tawny);
  structure(out, left, (north + south) / 2, 2.8, south - north, base - 2.3, top, c.adobe);
  structure(out, right, -16.2, 2.8, 16.7, base - 2.3, top, c.adobe);
  structure(out, right, 4.8, 2.8, 13.2, base - 2.3, top, c.adobe);
  structure(out, right, -4.2, 2.8, 5.3, base + 4.72, top - 7.02, c.tawny);
  for (const [x, z, r, h] of [
    [left, north, 3.6, 11.3],
    [right, north, 3.9, 10.2],
    [right, south, 3.35, 11.65],
    [left, south, 3.91, 12.5],
  ]) {
    innerTower(out, x, z, base - 2.4, h, r, detail);
  }
  for (const [x, z, w, depth, h] of [
    [-51, -8, 9, 21, 5.1],
    [-37, -16, 18, 9, 5.4],
    [-35, 6, 19, 7, 4.1],
    [-21, 4, 8, 8, 3.83],
  ]) {
    structure(out, x, z, w, depth, base - 1.8, h, c.tawny);
  }
  if (!detail) return;
  for (let x = left + 5; x < right - 3; x += detail === 1 ? 2.1 : 1.4) {
    for (const z of [north - 0.83, south + 0.83]) {
      box(out, 'wall', x, base + top - 2.3, z, 0.66, 0.65, 0.69, c.light);
    }
  }
  for (const z of [-19, -14, -9, -4, 1, 6]) {
    box(out, 'detail', left - 1.41, base + 4.45, z, 0.037, 0.51, 0.14, c.shadow);
  }
}

const courts = [
  [27, -13, 20, 14, 4.3],
  [52, -13, 15, 13, 3.3],
  [74, -6, 13, 10, 3.1],
  [22, 11, 16, 13, 3.7],
  [41, 15, 13, 16, 3.1],
  [64, 15, 15, 11, 3.5],
  [1, 27, 21, 13, 3.3],
  [-24, 32, 21, 17, 3.4],
  [-47, 27, 11, 12, 2.55],
  [26, 38, 18, 15, 2.95],
  [46, 36, 14, 13, 3.5],
  [6, 53, 18, 13, 2.6],
  [-17, -41, 20, 15, 2.71],
  [10, -40, 18, 13, 2.45],
  [32, -37, 13, 12, 2.7],
];

function yard(out, room, index, detail) {
  const [x, z, w, depth, h] = room;
  const y = centeredGrade([x, z]) - 0.64;
  const wall = detail < 1 ? 1.3 : 1.05;
  const soft = c[index % 2 ? 'earth' : 'tawny'];
  structure(out, x, z - depth / 2, w, wall, y, h, soft);
  if (detail >= 2 && index % 3 === 1) {
    structure(out, x - w / 2, z - depth * 0.2, wall, depth * 0.62, y, h * 0.84, soft);
    structure(out, x - w / 2, z + depth * 0.35, wall * 0.82, depth * 0.28, y, h * 0.42, c.earth);
  } else structure(out, x - w / 2, z, wall, depth, y, h * 0.84, soft);
  structure(out, x + w / 2, z, wall, depth, y, h * 0.73, soft);
  if (detail === 0) return;
  structure(out, x + w * 0.32, z + depth / 2, w * 0.35, wall, y, h * 0.72, soft);
  structure(out, x - w * 0.31, z + depth / 2, w * 0.38, wall, y, h * 0.81, soft);
  if (index % 3 === 0)
    structure(out, x + w * 0.29, z - depth * 0.23, w * 0.41, depth * 0.58, y, h + 1.18, c.ochre);
  if (detail < 2) return;
  const cells = (index % 3) + 2;
  for (let i = 1; i < cells; i++) {
    const x0 = x - w * 0.46 + (w * 0.92 * i) / cells;
    structure(out, x0, z - depth * 0.27, 0.55, depth * 0.47, y, h * 0.52, c.clay);
  }
  if (detail === 3 && index % 2 === 1)
    structure(out, x + w * 0.42, z + depth * 0.11, 1.32, 2.42, y, h * 0.58, c.earth);
}

function draw(out, detail) {
  perimeter(out, detail);
  innerCitadel(out, detail);
  for (const [i, room] of courts.entries()) if (detail || i % 3 === 0) yard(out, room, i, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const camera = [276, 139, 202];
const lookAt = [-5, 4, -1];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/rayen-castle-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: 'rayen-castle-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The complete adobe ramparts of Rayen Castle, with rounded wall towers, an arched eastern entrance, lower ruins and the elevated inner citadel.',
  camera,
  lookAt,
  sunDirection: [120, 171, 76],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['plaster_lime', 'brick'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 1.21,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'rayen-citadel-and-native-plateau', position: [219, 105, 145], lookAt: [4, 3, 3] },
    { name: 'eastern-cylindrical-gate', position: [135, 3.15, -7.5], lookAt: [110, 4.25, 1.1] },
    { name: 'inner-citadel-and-adobe-ruins', position: [43, 21, 43], lookAt: [-40, 7, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `rayen-castle-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.22, surfaces },
      street: { export: 'street', errorMeters: 0.47, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry from the three exact public-domain Qualla originals, municipal written facts, current ODbL footprint and original terrain.',
};
