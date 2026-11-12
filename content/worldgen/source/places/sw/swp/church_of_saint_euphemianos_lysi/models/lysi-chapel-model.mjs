/** The stone chapel at Lysi in the June 2010 exterior photographs. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const s = plan.section;
const [mappedEnvelope] = read('map-frame').geometry.polygons;
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  ashlar: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
  plank: { slot: 'door', graph: 'wood_vertical', roughness: 0.95, metallic: 0 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'b6a291',
    quoin: 'a89885',
    reveal: '918277',
    footing: '97887a',
    wood: '694630',
    shadow: '322a24',
    tile: 'bf9279',
    tileEdge: '9f7866',
    band: 'ab9685',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  tau = Math.PI * 2;
const white = 'palette:#ffffff';
const tiled = (index) => c.tile.map((channel) => channel * (0.88 + ((index * 13) % 23) * 0.01));
const masonryTint = (index) =>
  c.wall.map((channel) => channel * (0.93 + ((index * 17) % 23) * 0.009));

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function span(out, slot, at, normal, a, b, low, high, color, depth = 0) {
  face(
    out,
    slot,
    [at(a, low, depth), at(b, low, depth), at(b, high, depth), at(a, high, depth)],
    normal,
    color,
  );
}

/** Cut one opening in a wall strip and close the reveals with a recessed back. */
function wall(out, at, normal, a, b, low, high, opening) {
  if (!opening) {
    span(out, 'masonry', at, normal, a, b, low, high, c.wall);
    return;
  }
  const { left, right, sill, head, recess, slot } = opening;
  span(out, 'masonry', at, normal, a, left, low, high, c.wall);
  span(out, 'masonry', at, normal, right, b, low, high, c.wall);
  span(out, 'masonry', at, normal, left, right, low, sill, c.footing);
  span(out, 'masonry', at, normal, left, right, head, high, c.wall);
  span(
    out,
    slot,
    at,
    normal,
    left,
    right,
    sill,
    head,
    c[slot === 'plank' ? 'wood' : 'shadow'],
    -recess,
  );
  const tangent = at(1, 0).map((value, i) => value - at(0, 0)[i]);
  for (const [u, direction] of [
    [left, 1],
    [right, -1],
  ]) {
    face(
      out,
      'ashlar',
      [at(u, sill), at(u, head), at(u, head, -recess), at(u, sill, -recess)],
      tangent.map((n) => n * direction),
      c.reveal,
    );
  }
  for (const [y, n] of [
    [sill, up],
    [head, down],
  ]) {
    face(
      out,
      'ashlar',
      [at(left, y), at(right, y), at(right, y, -recess), at(left, y, -recess)],
      n,
      c.reveal,
    );
  }
}

const southWall = (x, y, depth = 0) => [x, y, s.armSouth + depth];
function rubbleCourses(out, at, normal, a, b, top, seed) {
  for (let y = 0.24, row = 0; y + 0.2 < top; row++, y += 0.215 + ((row * 13) % 8) * 0.008) {
    let u = a + (row % 2) * 0.2;
    for (let i = 0; u < b - 0.16; i++) {
      const key = seed + row * 31 + i,
        width = Math.min(b - u, 0.27 + ((key * 7) % 17) * 0.015);
      const h = 0.166 + ((key * 13) % 8) * 0.007,
        d = 0.019 + ((key * 9) % 8) * 0.003;
      const x = u + 0.027,
        end = u + width - 0.022;
      const color = masonryTint(key);
      const ring = [
        at(x, y + 0.027, d),
        at(x + 0.04, y, d),
        at(end - 0.054, y + 0.012, d),
        at(end, y + 0.045, d),
        at(end - 0.027, y + h - 0.015, d),
        at(x + 0.037, y + h, d),
      ];
      for (let k = 1; k < ring.length - 1; k++) {
        face(out, 'masonry', [ring[0], ring[k], ring[k + 1]], normal, color);
      }
      for (let k = 0; k < ring.length; k++) {
        const first = ring[k],
          last = ring[(k + 1) % ring.length];
        const base = (point) => point.map((v, j) => v - (d + 0.002) * normal[j]);
        const center = at((x + end) / 2, y + h / 2, d);
        const edge = first.map((v, j) => (v + last[j]) / 2 - center[j] + normal[j] * 0.01);
        face(out, 'masonry', [first, last, base(last), base(first)], edge, color);
      }
      u += width;
    }
  }
}
function nave(out, lod) {
  const longitudinal = [-s.naveHalf, s.naveHalf];
  for (const z of longitudinal) {
    const sign = Math.sign(z);
    const at = (x, y, depth = 0) => [x, y, z + sign * depth];
    for (const [a, b] of [
      [s.west, s.armLeft],
      [s.armRight, s.east],
    ]) {
      wall(out, at, [0, 0, sign], a, b, s.foundation, s.shoulder);
    }
  }
  for (const x of [s.west, s.east]) {
    const normal = [Math.sign(x), 0, 0];
    const at = (z, y, depth = 0) => [x + normal[0] * depth, y, z];
    wall(out, at, normal, ...longitudinal, s.foundation, s.shoulder);
  }
  for (const x of [s.armLeft, s.armRight]) {
    const normal = [Math.sign(x + 0.3), 0, 0];
    const at = (z, y, depth = 0) => [x + normal[0] * depth, y, z];
    wall(out, at, normal, s.armNorth, -s.naveHalf, s.foundation, s.armShoulder);
    wall(out, at, normal, s.naveHalf, s.armSouth, s.foundation, s.armShoulder);
    wall(out, at, normal, -s.naveHalf, s.naveHalf, s.shoulder, s.armShoulder);
  }
  wall(
    out,
    (x, y, d = 0) => [x, y, s.armNorth - d],
    [0, 0, -1],
    s.armLeft,
    s.armRight,
    s.foundation,
    s.armShoulder,
  );
  const door = {
    left: -0.99,
    right: -0.19,
    sill: s.threshold,
    head: 2.12,
    recess: 0.2,
    slot: 'plank',
  };
  wall(out, southWall, [0, 0, 1], s.armLeft, s.armRight, s.foundation, s.armShoulder, door);
  beam(
    out,
    'ashlar',
    southWall(-1.12, 2.16, 0.036),
    southWall(-0.06, 2.16, 0.036),
    0.105,
    0.15,
    c.quoin,
  );
  if (lod >= 2) {
    for (const x of [-0.83, -0.67, -0.51, -0.35]) {
      beam(
        out,
        'plank',
        southWall(x, s.threshold + 0.04, -0.192),
        southWall(x, 2.09, -0.192),
        0.021,
        0.018,
        c.shadow,
      );
    }
  }
  if (lod) {
    for (const [x, y, width] of [
      [-1.51, 2.64, 0.15],
      [-0.93, 2.87, 0.11],
      [-0.28, 2.81, 0.16],
      [0.34, 2.62, 0.13],
      [0.89, 2.65, 0.17],
    ]) {
      span(
        out,
        'shadow',
        southWall,
        [0, 0, 1],
        x - width / 2,
        x + width / 2,
        y,
        y + width * 0.68,
        c.shadow,
        0.006,
      );
    }
  }
  if (lod >= 2) {
    for (const [x, z] of [
      [s.west, s.naveHalf],
      [s.west, -s.naveHalf],
      [s.armLeft, s.armSouth],
      [s.armRight, s.armSouth],
      [s.armLeft, s.armNorth],
      [s.armRight, s.armNorth],
      [s.east, s.naveHalf],
      [s.east, -s.naveHalf],
    ]) {
      const step = lod === 3 ? 0.25 : 0.42;
      for (let y = 0.24, row = 0; y < 3.11; y += step, row++) {
        const width = row % 2 ? 0.26 : 0.37;
        const dx = x === s.east || x === s.armRight ? -width / 2 : width / 2;
        const dz = (Math.sign(z) * -width) / 2;
        beam(
          out,
          'ashlar',
          [x + dx, y, z + dz - width * 0.57],
          [x + dx, y, z + dz + width * 0.57],
          Math.min(step * 0.83, 0.19),
          width + 0.043,
          masonryTint(row + Math.round(x * z)),
        );
      }
    }
  }
  if (lod === 3) {
    const front =
      (z) =>
      (x, y, d = 0) => [x, y, z + d];
    const normal = [0, 0, 1];
    rubbleCourses(out, southWall, normal, -1.68, -1.03, 3.26, 4);
    rubbleCourses(out, southWall, normal, -0.15, 1.1, 3.26, 9);
    rubbleCourses(out, (x, y, d) => southWall(x, y + 2.13, d), normal, -1.03, -0.15, 0.92, 21);
    rubbleCourses(out, front(s.naveHalf), normal, s.west + 0.28, s.armLeft, s.shoulder, 11);
    rubbleCourses(out, front(s.naveHalf), normal, s.armRight, s.east - 0.24, s.shoulder, 17);
    rubbleCourses(
      out,
      (z, y, d = 0) => [s.armRight + d, y, z],
      [1, 0, 0],
      s.naveHalf,
      s.armSouth - 0.25,
      3.22,
      8,
    );
  }
}

function barrel(out, at, a, b, width, base, rise, lod) {
  const bands = [6, 10, 16, 24][lod],
    courses = [1, 3, 8, 15][lod];
  const edge = (index) => ((index / bands) * 2 - 1) * width;
  const height = (u) => base + rise * Math.cos(((u / width) * Math.PI) / 2);
  for (let i = 0; i < bands; i++) {
    const left = edge(i),
      right = edge(i + 1),
      y1 = height(left),
      y2 = height(right);
    for (let j = 0; j < courses; j++) {
      const start = a + ((b - a) * j) / courses,
        end = a + ((b - a) * (j + 1)) / courses;
      face(
        out,
        'tile',
        [at(start, y1, left), at(end, y1, left), at(end, y2, right), at(start, y2, right)],
        up,
        tiled(i * 29 + j),
      );
    }
    for (const [p, n] of [
      [a, -1],
      [b, 1],
    ]) {
      const normal = at(n, 0, 0).map((v, k) => v - at(0, 0, 0)[k]);
      const inner = p - n * 0.1;
      face(
        out,
        'masonry',
        [
          at(inner, base - 0.15, left),
          at(inner, base - 0.15, right),
          at(inner, y2 - 0.035, right),
          at(inner, y1 - 0.035, left),
        ],
        normal,
        c.wall,
      );
      face(
        out,
        'tile',
        [at(p, y1 - 0.092, left), at(p, y2 - 0.092, right), at(p, y2, right), at(p, y1, left)],
        normal,
        c.tileEdge,
      );
    }
  }
  for (const sign of [-1, 1]) {
    const outside = width * sign,
      inside = (width - 0.106) * sign;
    const left = a + 0.1,
      right = b - 0.1;
    const normal = at(0, 0, sign).map((v, k) => v - at(0, 0, 0)[k]);
    face(
      out,
      'masonry',
      [
        at(left, base - 0.15, inside),
        at(right, base - 0.15, inside),
        at(right, height(inside) - 0.02, inside),
        at(left, height(inside) - 0.02, inside),
      ],
      normal,
      c.wall,
    );
    face(
      out,
      'tile',
      [
        at(a, base - 0.072, outside),
        at(b, base - 0.072, outside),
        at(b, base, outside),
        at(a, base, outside),
      ],
      normal,
      c.tileEdge,
    );
    face(
      out,
      'tile',
      [
        at(a, base - 0.072, outside),
        at(b, base - 0.072, outside),
        at(right, height(inside) - 0.062, inside),
        at(left, height(inside) - 0.062, inside),
      ],
      down,
      c.tileEdge,
    );
  }
}

function arcShell(out, at, bounds, segments, low, high, opening) {
  const [start, end] = bounds;
  const step = (end - start) / segments;
  for (let i = 0; i < segments; i++) {
    const a = start + i * step,
      b = a + step;
    const mid = (a + b) / 2;
    const strip = (u, y, depth = 0) => {
      const first = at(a, y, depth),
        last = at(b, y, depth);
      const t = (u - a) / step;
      return first.map((v, j) => v + (last[j] - v) * t);
    };
    const window = opening(mid, step);
    wall(out, strip, [Math.cos(mid), 0, Math.sin(mid)], a, b, low, high, window);
  }
}

function tiledCap(out, at, bounds, sections, rings, eave, rise, isDome) {
  const [start, end] = bounds;
  const atRoof = (angle, ring) => {
    const phi = (ring * Math.PI) / (2 * rings);
    const scale = Math.cos(phi) * 1.048;
    const y = eave + rise * Math.sin(phi);
    return at(angle, y, scale);
  };
  for (let i = 0; i < sections; i++) {
    const a = start + ((end - start) * i) / sections,
      b = start + ((end - start) * (i + 1)) / sections;
    face(
      out,
      'tile',
      [at(a, eave - 0.1, 1.048), at(b, eave - 0.1, 1.048), atRoof(b, 0), atRoof(a, 0)],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      c.tileEdge,
    );
    for (let j = 0; j < rings; j++) {
      const points = [atRoof(a, j), atRoof(b, j), atRoof(b, j + 1)];
      if (j + 1 < rings) points.push(atRoof(a, j + 1));
      face(out, 'tile', points, up, tiled(i + j * 7 + (isDome ? 8 : 0)));
    }
  }
}

function apse(out, lod) {
  const n = [7, 11, 17, 25][lod];
  const at = (angle, y, depth = 0) => [
    s.apseX + (s.apseRx + depth) * Math.cos(angle),
    y,
    (s.apseRz + depth) * Math.sin(angle),
  ];
  const bounds = [-Math.PI / 2, Math.PI / 2];
  arcShell(out, at, bounds, n, s.foundation, s.apseEave, (mid, step) => {
    if (Math.abs(mid) > step / 4) return;
    const half = Math.min(0.046, step * 0.37);
    return {
      left: mid - half,
      right: mid + half,
      sill: 1.4,
      head: 2.29,
      recess: 0.18,
      slot: 'shadow',
    };
  });
  tiledCap(
    out,
    (angle, y, scale) => [
      s.apseX + s.apseRx * scale * Math.cos(angle),
      y,
      s.apseRz * scale * Math.sin(angle),
    ],
    bounds,
    n,
    [3, 5, 8, 12][lod],
    s.apseEave + 0.08,
    s.apseRise,
    false,
  );
}

function drum(out, lod) {
  const n = [12, 20, 28, 44][lod],
    step = tau / n;
  const at = (angle, y, depth = 0) => [
    s.drumX + (s.drumR + depth) * Math.cos(angle),
    y,
    (s.drumR + depth) * Math.sin(angle),
  ];
  const bounds = [-step / 2, tau - step / 2];
  arcShell(out, at, bounds, n, s.drumFoot, s.drumEave, (mid, width) => {
    if (Math.abs(mid - (Math.round(mid / (tau / 4)) * tau) / 4) > width / 4) return;
    const half = Math.min(0.092, width * 0.37);
    return {
      left: mid - half,
      right: mid + half,
      sill: 4.55,
      head: 5.37,
      recess: 0.2,
      slot: 'shadow',
    };
  });
  if (lod) {
    for (let i = 0; i < n; i++) {
      const a = bounds[0] + i * step,
        b = a + step;
      face(
        out,
        'ashlar',
        [at(a, 5.62, 0.013), at(b, 5.62, 0.013), at(b, 5.72, 0.013), at(a, 5.72, 0.013)],
        [Math.cos(a), 0, Math.sin(a)],
        c.band,
      );
    }
  }
  tiledCap(
    out,
    (angle, y, scale) => [
      s.drumX + s.drumR * scale * Math.cos(angle),
      y,
      s.drumR * scale * Math.sin(angle),
    ],
    bounds,
    n,
    [4, 6, 9, 13][lod],
    s.drumEave + 0.06,
    s.domeRise,
    true,
  );
}

function build(out, lod) {
  nave(out, lod);
  const long = (x, y, z) => [x, y, z];
  barrel(
    out,
    long,
    s.west - 0.1,
    s.armLeft + 0.2,
    s.naveHalf + 0.1,
    s.shoulder + 0.08,
    s.naveRise,
    lod,
  );
  barrel(
    out,
    long,
    s.armRight - 0.2,
    s.east + 0.13,
    s.naveHalf + 0.1,
    s.shoulder + 0.08,
    s.naveRise,
    lod,
  );
  const cross = (z, y, u) => [(s.armLeft + s.armRight) / 2 + u, y, z];
  barrel(
    out,
    cross,
    s.armNorth - 0.1,
    s.armSouth + 0.1,
    (s.armRight - s.armLeft) / 2 + 0.1,
    s.armShoulder + 0.09,
    s.armRise,
    lod,
  );
  apse(out, lod);
  drum(out, lod);
}

export const lysiSkyline = (out) => build(out, 0);
export const lysiDistrict = (out) => build(out, 1);
export const lysiStreet = (out) => build(out, 2);
export const lysiCloseup = (out) => build(out, 3);

const recipe = 'lysi-chapel-model.mjs';
const camera = [11, 7.3, 13],
  lookAt = [0.25, 2.6, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'lysiDistrict', 0.1],
    ['street', 'lysiStreet', 0.044],
    ['closeup', 'lysiCloseup', 0.016],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const lysiModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: lysiCloseup,
  category: 'church',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Rubble masonry chapel with tiled barrel roofs, a cylindrical dome drum, semicircular apse and recessed plank side door.',
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
    outline: mappedEnvelope,
    minimumCoverage: 0.92,
    basis: 'Named 8.58 by 7.70 m mapped chapel envelope, OpenStreetMap way 190662188.',
  },
  mediumFiContext: {
    scale: 0.65,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'tile_ceramic',
    'wood_vertical',
  ],
  qaCameras: [
    { name: 'south-entry-and-dome', position: [5.8, 3.1, 12.8], lookAt: [0, 2.85, 0.45] },
    { name: 'east-apse-and-drum-window', position: [14.3, 3.9, 0.45], lookAt: [1.0, 2.8, 0] },
    { name: 'north-and-west-roof', position: [-10.1, 7.4, -10.2], lookAt: [-0.4, 2.45, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-lysi-chapel-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'lysiSkyline',
    errorMeters: 0.23,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two exact first-party CC0 1.0 Qualla photographs.',
};
