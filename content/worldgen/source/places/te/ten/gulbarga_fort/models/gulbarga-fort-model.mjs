import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const shape = read('native-map/gulbarga-fort-shape-controls');
const surfaces = {
  rampart: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.97 },
  masonry: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.95 },
  plaster: { slot: 'roof', graph: 'plaster_lime', roughness: 0.97 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.96 },
};
const color = {
  wall: rgb('a69982'),
  rubble: rgb('8d8171'),
  base: rgb('938570'),
  course: rgb('b3a891'),
  lime: rgb('c4bc9e'),
  dome: rgb('b6ae90'),
  shadow: rgb('645a4b'),
  slab: rgb('a99a7f'),
};
const interpolate = (a, b, t) => a + (b - a) * t;
const tint = (shade, seed) => shade.map((v) => v * (0.925 + 0.013 * ((seed * 7 + 8) % 11)));

function distanceToSegment([x, z], a, b) {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const length2 = vx * vx + vz * vz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / length2)) : 0;
  return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
}

function wallSamples(points, tolerance) {
  const keep = [0];
  function retain(from, to) {
    let index = -1;
    let farthest = tolerance;
    for (let i = from + 1; i < to; i++) {
      const error = distanceToSegment(points[i], points[from], points[to]);
      if (error > farthest) {
        index = i;
        farthest = error;
      }
    }
    if (index >= 0) {
      retain(from, index);
      keep.push(index);
      retain(index, to);
    }
  }
  retain(0, points.length - 1);
  keep.push(points.length - 1);
  return keep;
}

function roundedMerlon(out, F, u, y, half, height, depth, lod, shade) {
  const p = F.P;
  fbox(out, 'rampart', F, u - half, u + half, y - 0.05, y + height * 0.44, -depth, 0, shade);
  const arc = [
    [-half, height * 0.44],
    [-half * 0.73, height * 0.83],
    [0, height],
    [half * 0.73, height * 0.83],
    [half, height * 0.44],
  ];
  const steps = lod >= 2 ? arc : [arc[0], arc[2], arc[4]];
  const front = (point) => p(u + point[0], y + point[1], 0);
  const back = (point) => p(u + point[0], y + point[1], -depth);
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1];
    const b = steps[i];
    quad4(out, 'rampart', front(a), back(a), back(b), front(b), shade);
  }
  for (let i = 1; i + 1 < steps.length; i++) {
    tri(out, 'rampart', front(steps[0]), front(steps[i + 1]), front(steps[i]), shade);
    tri(out, 'rampart', back(steps[0]), back(steps[i]), back(steps[i + 1]), shade);
  }
}

function twistedPanel(out, slot, a, b, c, d, shade) {
  tri(out, slot, a, b, c, shade);
  tri(out, slot, a, c, d, shade);
}

function ramparts(out, lod) {
  for (const [run, wall] of shape.walls.entries()) {
    const inner = wall.role.startsWith('Inner');
    // This inner curtain overlaps the independent portal footprint in the map.
    const points = wall.id === 329560193 ? wall.points.slice(0, 2) : wall.points;
    const indices = wallSamples(points, [15.2, 4.9, 0.82, 0.22][lod]);
    const selected = indices.map((i) => points[i]);
    const crest = (i) => {
      const k = indices[i];
      const grade = wall.nativeGrades[k];
      return grade + (inner ? 7.45 : 4.9) + 0.72 * Math.sin((k + run * 3) * 0.32);
    };
    const ground = (i) => wall.nativeGrades[indices[i]] - (inner ? 2.05 : 2.38);
    const faces = selected.slice(0, -1).map((a, i) => wallFace(a, selected[i + 1]));
    const half = inner ? 3.18 : 2.45;
    const bottomHalf = half + (inner ? 1.05 : 0.84);
    const faceNormal = (i) => {
      const a = faces[Math.max(0, i - 1)].normal;
      const b = faces[Math.min(faces.length - 1, i)].normal;
      const x = a[0] + b[0],
        z = a[1] + b[1];
      const size = Math.hypot(x, z) || 1;
      return [x / size, z / size];
    };
    const normals = selected.map((_, i) => faceNormal(i));
    const vertex = (i, y, depth) => [
      selected[i][0] + normals[i][0] * depth,
      y,
      selected[i][1] + normals[i][1] * depth,
    ];
    for (const [i, F] of faces.entries()) {
      const j = i + 1;
      const A = crest(i),
        B = crest(j);
      const lo = ground(i),
        hi = ground(j);
      const shade = tint(inner ? color.wall : color.rubble, run * 7 + i);
      const f0 = vertex(i, lo, bottomHalf),
        f1 = vertex(j, hi, bottomHalf);
      const f2 = vertex(j, B, half),
        f3 = vertex(i, A, half);
      const b0 = vertex(i, lo, -bottomHalf),
        b1 = vertex(j, hi, -bottomHalf);
      const b2 = vertex(j, B, -half),
        b3 = vertex(i, A, -half);
      twistedPanel(out, 'rampart', f0, f1, f2, f3, shade);
      twistedPanel(out, 'rampart', b1, b0, b3, b2, tint(shade, i + 6));
      if (lod || i % 4 === 0) twistedPanel(out, 'masonry', f3, f2, b2, b3, color.course);
      if (i === 0) quad4(out, 'rampart', b0, f0, f3, b3, color.rubble);
      if (j === faces.length) quad4(out, 'rampart', f1, b1, b2, f2, color.rubble);
      if (lod < 2) continue;
      const spacing = lod === 3 ? 4.4 : 13.4;
      const count = Math.floor(F.length / spacing);
      for (let n = 0; n < count; n++) {
        if ((n + run + i) % (inner ? 5 : 3) === 0) continue;
        const t = (n + 0.56) / count;
        const side = facade(
          [F.origin[0] + F.normal[0] * (half - 0.4), F.origin[1] + F.normal[1] * (half - 0.4)],
          F.along,
        );
        roundedMerlon(
          out,
          side,
          F.length * t,
          interpolate(A, B, t),
          inner ? 0.87 : 0.68,
          inner ? 1.15 : 0.85,
          0.9,
          lod,
          shade,
        );
      }
    }
  }
}

function pointedOpening(out, F, u, half, ground, spring, rise, top, depth, lod, slot, shade) {
  const shape = pointedArch(half, rise, [2, 2, 5, 7][lod]);
  const p = (x, y, d) => F.P(u + x, y, d);
  for (let i = 1; i < shape.length; i++) {
    const a = shape[i - 1],
      b = shape[i];
    const ya = spring + a[1],
      yb = spring + b[1];
    quad4(out, slot, p(a[0], ya, 0), p(b[0], yb, 0), p(b[0], top, 0), p(a[0], top, 0), shade);
    quad4(
      out,
      slot,
      p(b[0], yb, -depth),
      p(a[0], ya, -depth),
      p(a[0], top, -depth),
      p(b[0], top, -depth),
      shade,
    );
    quad4(
      out,
      'stone',
      p(b[0], yb, 0),
      p(a[0], ya, 0),
      p(a[0], ya, -depth),
      p(b[0], yb, -depth),
      tint(color.shadow, i),
    );
    if (lod < 2) continue;
    const ring = (q, width) =>
      p(q[0] * (1 + width / half), spring + q[1] * (1 + width / rise), 0.052);
    quad4(
      out,
      'stone',
      ring(a, 0),
      ring(b, 0),
      ring(b, 0.23),
      ring(a, 0.23),
      tint(color.course, i),
    );
  }
  for (const s of [-1, 1]) {
    const front = p(s * half, ground, 0),
      back = p(s * half, ground, -depth);
    const head = p(s * half, spring, 0),
      inner = p(s * half, spring, -depth);
    if (s === 1) quad4(out, 'stone', back, inner, head, front, color.shadow);
    else quad4(out, 'stone', front, head, inner, back, color.shadow);
  }
}

function eastGate(out, lod) {
  const gate = shape.gate.outline;
  const F = wallFace(gate[2], gate[3]);
  const grade = 0.32;
  const half = 2.65;
  const u = F.length / 2;
  const top = grade + 11.1;
  for (const [min, max] of [
    [0, u - half],
    [u + half, F.length],
  ]) {
    fbox(out, 'rampart', F, min, max, -1.2, top, -4.6, 0.1, color.wall);
  }
  pointedOpening(out, F, u, half, grade, grade + 4.32, 2.75, top, 4.58, lod, 'rampart', color.wall);
  fbox(out, 'masonry', F, 0, F.length, top - 0.63, top + 0.21, -4.75, 0.33, color.course);
  for (const x of [0.8, 3.2, F.length - 3.2, F.length - 0.8])
    roundedMerlon(out, F, x, top + 0.15, 0.73, 1.1, 0.85, lod, color.rubble);
  if (lod >= 2) {
    fbox(out, 'masonry', F, u - 1, u + 1, top - 1.99, top - 1.46, -0.04, 0.08, color.course);
  }
}

function citadel(out, lod) {
  const ring = outwardRing(shape.citadel.outline);
  const floor = shape.citadel.grade - 2;
  const high = floor + 16.8;
  extrude(out, 'masonry', ring, -0.42, floor + 0.08, color.base, { top: false });
  extrude(out, 'rampart', ring, floor, high, color.rubble, {
    topSlot: 'masonry',
    topColor: color.slab,
  });
  for (const [i, a] of ring.entries()) {
    const F = wallFace(a, ring[(i + 1) % ring.length]);
    if (F.length < 3.9) continue;
    fbox(out, 'masonry', F, 0, F.length, high - 0.53, high + 0.11, -0.14, 0.42, color.course);
    if (!lod) continue;
    const n = Math.max(2, Math.ceil(F.length / (lod >= 2 ? 3.55 : 6.0)));
    for (let b = 0; b < n; b++) {
      const u = ((b + 0.54) * F.length) / n;
      roundedMerlon(out, F, u, high, 0.8, 1.0, 0.75, lod, tint(color.rubble, i + b));
      if (lod >= 2 && F.length > 7) {
        fbox(
          out,
          'masonry',
          F,
          u - 0.17,
          u + 0.17,
          high - 4.15,
          high - 2.9,
          0.011,
          0.059,
          color.shadow,
        );
      }
    }
  }
}

const mosque = shape.mosque.outline;
const mosk = (u, v) => {
  const a = [
    interpolate(mosque[0][0], mosque[3][0], u),
    interpolate(mosque[0][1], mosque[3][1], u),
  ];
  const b = [
    interpolate(mosque[1][0], mosque[2][0], u),
    interpolate(mosque[1][1], mosque[2][1], u),
  ];
  return [interpolate(a[0], b[0], v), interpolate(a[1], b[1], v)];
};
const floor = 10.25;
const roof = floor + 7.7;
const moskFoundation = 3.15;
const mosqueFacades = [
  { face: wallFace(mosque[3], mosque[0]), bays: 10, entrance: true },
  { face: wallFace(mosque[1], mosque[2]), bays: 10 },
  { face: wallFace(mosque[2], mosque[3]), bays: 7 },
];

function mosqueArcade(out, F, count, hasEntrance, lod) {
  const step = F.length / count;
  const depth = 1.18;
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const portal = hasEntrance && i === 4;
    const u = (i + 0.5) * step;
    const half = step * (portal ? 0.345 : 0.378);
    const top = roof + (portal ? 2.35 : 0);
    const spring = floor + (portal ? 4.78 : 3.93);
    fbox(out, 'stone', F, cursor, u - half, floor - 0.04, roof, -depth, 0, color.wall);
    pointedOpening(
      out,
      F,
      u,
      half,
      floor,
      spring,
      portal ? 3.02 : 2.42,
      top,
      depth,
      lod,
      'stone',
      tint(color.wall, i),
    );
    if (portal) {
      fbox(
        out,
        'stone',
        F,
        u - half - 0.51,
        u - half,
        floor - 0.03,
        top,
        -depth,
        0.39,
        color.course,
      );
      fbox(
        out,
        'stone',
        F,
        u + half,
        u + half + 0.51,
        floor - 0.03,
        top,
        -depth,
        0.39,
        color.course,
      );
      fbox(
        out,
        'masonry',
        F,
        u - half - 0.6,
        u + half + 0.6,
        top - 0.23,
        top + 0.125,
        -1.31,
        0.57,
        color.course,
      );
      if (lod) {
        for (let stair = 0; stair < 4; stair++) {
          const d = stair * 0.57;
          fbox(
            out,
            'stone',
            F,
            u - half - 0.66,
            u + half + 0.66,
            floor - 1.16,
            floor - 0.13 - stair * 0.24,
            d,
            d + 0.58,
            color.slab,
          );
        }
      }
    }
    cursor = u + half;
  }
  fbox(out, 'stone', F, cursor, F.length, floor - 0.04, roof, -depth, 0, color.wall);
  fbox(out, 'masonry', F, 0, F.length, roof - 0.035, roof + 0.23, -1.22, 0.17, color.course);
  if (lod >= 2) {
    const count = Math.floor(F.length / 1.75);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * F.length) / count;
      if (hasEntrance && Math.abs(u - 4.5 * step) < 2.6) continue;
      roundedMerlon(out, F, u, roof + 0.19, 0.41, 0.64, 0.65, 1, color.course);
    }
  }
}

function dome(out, center, y, r, h, lod, shade) {
  const detail = [
    [0, 1],
    [0.38, 0.94],
    [0.73, 0.69],
    [0.92, 0.37],
    [1, 0],
  ];
  const levels = lod < 2 ? detail.filter((_, i) => i % 2 === 0) : detail;
  lathe(
    out,
    'plaster',
    center,
    levels.map(([f, w]) => [y + h * f, r * w, r * w]),
    [7, 8, 12, 16][lod],
    shade,
    { capTop: false, capBottom: false },
  );
}

function jamaMasjid(out, lod) {
  extrude(out, 'masonry', mosque, moskFoundation, floor, color.base, { topColor: color.slab });
  const cover = outwardRing(mosque);
  if (
    !out.addCap(
      'plaster',
      'palette:#ffffff',
      cover,
      [],
      () => roof,
      [0, 1, 0],
      (p) => p,
      color.lime,
    )
  )
    throw new Error('The covered mosque roof could not be triangulated');
  if (
    lod &&
    !out.addCap(
      'stone',
      'palette:#ffffff',
      cover,
      [],
      () => roof - 0.38,
      [0, -1, 0],
      (p) => p,
      color.shadow,
    )
  )
    throw new Error('The mosque ceiling could not be triangulated');
  const west = wallFace(mosque[0], mosque[1]);
  fbox(out, 'stone', west, 0, west.length, floor, roof + 0.05, -1.75, 0, color.wall);
  if (lod) {
    for (const { face, bays, entrance } of mosqueFacades)
      mosqueArcade(out, face, bays, entrance, lod);
  } else {
    for (const { face: F, bays, entrance } of mosqueFacades) {
      for (let i = 0; i <= bays; i++) {
        const u = (i * F.length) / bays;
        const a = Math.max(u - 0.64, 0);
        const b = Math.min(u + 0.64, F.length);
        const p = F.P;
        quad4(out, 'stone', p(a, floor), p(b, floor), p(b, roof), p(a, roof), color.wall);
        quad4(
          out,
          'stone',
          p(b, floor, -1),
          p(a, floor, -1),
          p(a, roof, -1),
          p(b, roof, -1),
          color.wall,
        );
      }
      fbox(out, 'stone', F, 0, F.length, roof - 1.7, roof + 0.15, -1.0, 0.02, color.course);
      if (entrance)
        fbox(
          out,
          'stone',
          F,
          F.length * 0.408,
          F.length * 0.486,
          roof - 1.8,
          roof + 1.85,
          -1.1,
          0.01,
          color.course,
        );
    }
  }
  for (const u of [0.085, 0.9]) {
    for (const v of [0.105, 0.895]) {
      const p = mosk(u, v);
      tower(out, 'stone', p, 4.95, 8, roof - 0.035, roof + 0.88, color.course, { top: false });
      dome(out, p, roof + 0.86, 4.7, 3.38, lod, color.dome);
    }
  }
  const center = mosk(0.133, 0.49);
  const axis = [mosque[3][0] - mosque[0][0], mosque[3][1] - mosque[0][1]];
  if (lod >= 2) {
    for (const v of [0.21, 0.43, 0.63, 0.81]) {
      for (let bay = 1; bay <= 8; bay++) {
        const p = mosk(bay / 9, v);
        const F = facade(p, axis);
        fbox(out, 'stone', F, -0.6, 0.6, floor, roof - 0.22, -0.64, 0.64, color.rubble);
        if (lod === 3)
          fbox(
            out,
            'masonry',
            F,
            -0.79,
            0.79,
            floor + 4.05,
            floor + 4.34,
            -0.82,
            0.82,
            color.course,
          );
      }
    }
  }
  const S = facade(center, axis);
  fbox(out, 'stone', S, -7.2, 7.2, roof - 0.04, roof + 3.92, -7.15, 7.15, color.wall);
  if (lod) fbox(out, 'masonry', S, -7.37, 7.37, roof + 3.6, roof + 3.97, -7.33, 7.33, color.course);
  dome(out, center, roof + 3.93, 6.87, 5.62, lod, color.dome);
  if (lod) {
    for (let row = 0; row < 7; row++) {
      for (let bay = 0; bay < 12; bay++) {
        if ((row === 0 || row === 6) && [0, 1, 10, 11].includes(bay)) continue;
        if (row >= 2 && row <= 4 && bay === 0) continue;
        if (lod === 1 && ((row + bay) % 2 === 1 || (bay === 6 && row % 2 === 0))) continue;
        const u = 0.061 + (bay * 0.873) / 11;
        const v = 0.085 + (row * 0.827) / 6;
        dome(out, mosk(u, v), roof + 0.04, 2.31, 1.38, lod === 3 ? 2 : 0, color.lime);
      }
    }
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  ramparts(out, lod);
  eastGate(out, lod);
  citadel(out, lod);
  jamaMasjid(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'gulbarga-fort-model.mjs';
const camera = [480, 455, 485];
const lookAt = [-1, 2.9, -35];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-fortress',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The surviving double ramparts of Gulbarga Fort, with the mapped east portal, Bala Qila and the covered domes and arcades of Jama Masjid.',
  camera,
  lookAt,
  sunDirection: [135, 240, -100],
  mediumFiContext: {
    scale: 1.09,
    far: 3500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: shape.citadel.outline,
    minimumCoverage: 0.9,
    basis:
      'The individually mapped Bala Qila occupies this footprint. The occupied fort precinct remains an open site around it.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map(({ graph }) => graph),
  recipeDependencies: ['place-footprint-caps.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-double-fortifications', position: [-350, 47, -81], lookAt: [-188, 7, -40] },
    { name: 'fort-and-jama-masjid', position: [95, 73, -135], lookAt: [-40, 9, -38] },
    {
      name: 'jama-masjid-domes-and-north-arcade',
      position: [-28, 33, -136],
      lookAt: [-42, 17, -40],
    },
    { name: 'east-gate-and-citadel', position: [290, 28, -145], lookAt: [210, 7, -160] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gulbarga-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 15.2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 4.9, surfaces },
      street: { export: 'street', errorMeters: 0.82, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.22, surfaces },
    },
  },
};
