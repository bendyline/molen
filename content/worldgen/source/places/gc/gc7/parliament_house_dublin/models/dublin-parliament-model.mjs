/** Dublin's Parliament House, including the curved College Green fronts and later bank wings. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const {
  polygons: [outline],
  holes: courts,
} = read('map-frame').geometry;
const y = plan.elevations;
const materials = {
  granite: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.82, metallic: 0.14 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.14 },
};
const color = Object.fromEntries(
  Object.entries({
    granite: 'aaa394',
    lower: '979082',
    stone: 'c2b9a6',
    dress: 'd0c6b2',
    shade: '968b78',
    slate: '555958',
    copper: '778177',
    sill: 'b3ac99',
    glass: '4b5250',
    closed: '51504a',
    dark: '373735',
    iron: '494844',
  }).map(([key, value]) => [key, rgb(value)]),
);
const up = [0, 1, 0];
const point = ([x, z], v) => [x, v, z];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);

function directed(out, slot, points, normal, tint) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, tint);
  else face(out, slot, wound, tint);
}

function surface(out, slot, ring, coordinates, normal, tint, holes = []) {
  const vertices = [...ring];
  const starts = holes.map((hole) => {
    const index = vertices.length;
    vertices.push(...hole);
    return index;
  });
  const indices = earcut(vertices.flat(), starts);
  for (let i = 0; i < indices.length; i += 3) {
    directed(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => coordinates(...vertices[j])),
      normal,
      tint,
    );
  }
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function edge(a, b, side) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [(side * dz) / length, 0, (-side * dx) / length];
  const p = (u, height, shift = 0) => [
    a[0] + (dx * u) / length + normal[0] * shift,
    height,
    a[1] + (dz * u) / length + normal[2] * shift,
  ];
  return { length, normal, p };
}

function orientation(ring) {
  return Math.sign(
    ring.reduce((sum, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return sum + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
}

function aperture({ x, floor, w, h, arch }, lod) {
  const r = w / 2,
    first = [x - r, floor],
    second = [x + r, floor];
  if (!arch) return [first, second, [x + r, floor + h], [x - r, floor + h]];
  const n = [3, 4, 7, 9][lod];
  return [
    first,
    second,
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [x + Math.cos(a) * r, floor + h - arch + Math.sin(a) * arch];
    }),
  ];
}

function molding(out, section, x0, x1, level, height, depth, tint = color.stone) {
  beam(
    out,
    'limestone',
    section.p(x0, level, depth * 0.33),
    section.p(x1, level, depth * 0.33),
    depth,
    height,
    tint,
  );
}

function wall(out, section, bottom, top, windows, lod, offset = 0) {
  const { p, normal, length } = section;
  const rings = windows.map((item) => aperture(item, lod));
  const outside = [
    [0, bottom],
    [length, bottom],
    [length, top],
    [0, top],
  ];
  surface(
    out,
    'granite',
    outside,
    (x, z) => p(x, z, offset),
    normal,
    color.granite,
    lod ? rings : [],
  );
  for (const [i, window] of windows.entries()) {
    const ring = rings[i],
      inset = lod ? offset - (window.depth ?? 0.27) : offset + 0.022;
    surface(out, 'glazing', ring, (u, v) => p(u, v, inset), normal, window.tint ?? color.glass);
    if (!lod) continue;
    const target = p(window.x, window.floor + window.h * 0.46, offset);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length];
      const mid = p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, offset);
      directed(
        out,
        'limestone',
        [p(...a, offset), p(...b, offset), p(...b, inset), p(...a, inset)],
        target.map((n, k) => n - mid[k]),
        color.shade,
      );
    }
    if (lod >= 2) {
      if (!window.arch)
        molding(
          out,
          section,
          window.x - window.w * 0.64,
          window.x + window.w * 0.64,
          window.floor - 0.06,
          0.16,
          0.25,
          color.dress,
        );
      if (window.tint !== color.closed) {
        beam(
          out,
          'iron',
          p(window.x, window.floor + 0.04, inset + 0.038),
          p(window.x, window.floor + window.h - 0.11, inset + 0.038),
          0.054,
          0.052,
          color.iron,
        );
      }
    }
  }
}

function datum(out, section) {
  const a = section.p(0, 0),
    b = section.p(section.length, 0);
  const foot = ([x, , z]) => [x, Math.min(y.plinth - 0.08, grade(x, z) - 0.19), z];
  directed(
    out,
    'granite',
    [foot(a), foot(b), section.p(section.length, y.plinth), section.p(0, y.plinth)],
    section.normal,
    color.lower,
  );
}

function drum(out, [x, z], low, high, radius, lod, style = 'ionic') {
  const segments = [4, 7, 12, 16][lod];
  const widths =
    lod >= 2
      ? [
          [low, radius * 1.38],
          [low + 0.32, radius],
          [high - 0.59, radius * 0.87],
          [high, radius * 1.14],
        ]
      : [
          [low, radius],
          [high, radius * 0.87],
        ];
  for (let j = 1; j < widths.length; j++) {
    const [y0, r0] = widths[j - 1],
      [y1, r1] = widths[j];
    const p = (a, r, h) => [x + Math.cos(a) * r, h, z + Math.sin(a) * r];
    for (let i = 0; i < segments; i++) {
      const a = (i * 2 * Math.PI) / segments,
        b = ((i + 1) * 2 * Math.PI) / segments;
      const m = (a + b) / 2;
      directed(
        out,
        'limestone',
        [p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1)],
        [Math.cos(m), 0, Math.sin(m)],
        color.stone,
      );
    }
  }
  if (lod >= 1) {
    const width = radius * (style === 'corinthian' ? 2.71 : 2.47);
    boundsBox(
      out,
      'limestone',
      [x - width / 2, high - 0.16, z - width / 2],
      [x + width / 2, high + 0.095, z + width / 2],
      color.dress,
    );
    if (lod >= 2) {
      const offset = radius * 0.72;
      for (const side of [-1, 1]) {
        beam(
          out,
          'limestone',
          [x - offset, high - 0.32, z + side * radius],
          [x + offset, high - 0.32, z + side * radius],
          0.22,
          0.22,
          color.dress,
        );
      }
    }
  }
}

function projection(out, side, u0, u1, floor, height, front, back, slot, tint) {
  const { p, normal } = side;
  const corners = [
    [u0, front],
    [u1, front],
    [u1, back],
    [u0, back],
  ];
  directed(
    out,
    slot,
    corners.map(([u, z]) => p(u, height, z)),
    up,
    tint,
  );
  directed(
    out,
    slot,
    [p(u0, floor, front), p(u1, floor, front), p(u1, height, front), p(u0, height, front)],
    normal,
    tint,
  );
  const sideNormal = p(u1, 0).map((n, k) => n - p(u0, 0)[k]);
  for (const [u, direction] of [
    [u0, -1],
    [u1, 1],
  ]) {
    directed(
      out,
      slot,
      [p(u, floor, front), p(u, height, front), p(u, height, back), p(u, floor, back)],
      sideNormal.map((n) => n * direction),
      tint,
    );
  }
}

function steps(out, side, from, to, floor, lod) {
  const [x, , z] = side.p((from + to) / 2, 0, 1.4);
  const base = Math.min(floor - 0.22, grade(x, z) - 0.14),
    n = lod ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const height = base + ((floor - base) * (i + 1)) / n;
    projection(
      out,
      side,
      from,
      to,
      base,
      height,
      (1.55 * (n - i)) / n,
      -0.25,
      'granite',
      color.sill,
    );
  }
}

function pediment(out, side, crest, depth, lod) {
  const { length, p, normal } = side,
    low = y.parapet - 0.11;
  const profile = [
    [-0.26, low],
    [length + 0.26, low],
    [length / 2, crest],
  ];
  for (const offset of [0.04, -depth + 0.08]) {
    surface(
      out,
      'limestone',
      profile,
      (x, h) => p(x, h, offset),
      offset < 0 ? normal.map((n) => -n) : normal,
      color.stone,
    );
  }
  for (const [a, b] of [
    [profile[0], profile[2]],
    [profile[2], profile[1]],
  ]) {
    directed(
      out,
      'slate',
      [p(...a, 0.05), p(...b, 0.05), p(...b, -depth), p(...a, -depth)],
      up,
      color.slate,
    );
    if (lod) beam(out, 'limestone', p(...a, 0.15), p(...b, 0.15), 0.23, 0.28, color.dress);
  }
  if (lod >= 2) {
    const mid = length / 2;
    const relief = [
      [mid - 0.52, low + 0.75],
      [mid + 0.52, low + 0.75],
      [mid + 0.39, low + 1.3],
      [mid, low + 1.57],
      [mid - 0.39, low + 1.3],
    ];
    surface(out, 'limestone', relief, (x, v) => p(x, v, 0.13), normal, color.dress);
  }
}

function portico(out, spec, lod) {
  const positive = edge(spec.start, spec.end, 1);
  const side =
    dot(positive.normal, [spec.outward[0], 0, spec.outward[1]]) > 0
      ? positive
      : edge(spec.start, spec.end, -1);
  const { p, length, normal } = side;
  const bottom = spec.name === 'foster-place' ? 1.59 : 0.86;
  const columnInset = 0.68;
  for (let i = 0; i < spec.columns; i++) {
    const u = columnInset + (i * (length - columnInset * 2)) / (spec.columns - 1);
    const [x, , z] = p(u, bottom, -0.31);
    drum(out, [x, z], bottom, y.entablature, spec.columns === 6 ? 0.46 : 0.57, lod, spec.style);
  }
  const gap = spec.depth;
  projection(
    out,
    side,
    -0.21,
    length + 0.21,
    y.entablature,
    y.parapet,
    0.23,
    -gap,
    'limestone',
    color.stone,
  );
  directed(
    out,
    'limestone',
    [
      p(0, y.entablature, 0.23),
      p(length, y.entablature, 0.23),
      p(length, y.entablature, -gap),
      p(0, y.entablature, -gap),
    ],
    [0, -1, 0],
    color.shade,
  );
  steps(out, side, -0.05, length + 0.05, bottom, lod);
  projection(
    out,
    side,
    -0.05,
    length + 0.05,
    bottom - 0.15,
    bottom,
    -0.02,
    -gap,
    'granite',
    color.sill,
  );
  const doors = [0.21, 0.5, 0.79].map((f, i) => ({
    x: f * length,
    floor: bottom + 0.05,
    w: i === 1 ? 1.99 : 1.54,
    h: i === 1 ? 5.64 : 4.96,
    arch: 0.85,
    tint: i ? color.dark : color.closed,
  }));
  wall(out, side, bottom, y.deck, doors, lod, -gap + 0.09);
  molding(out, side, -0.21, length + 0.21, y.parapet - 0.31, 0.29, 0.38, color.dress);
  if (lod) molding(out, side, -0.21, length + 0.21, y.entablature + 0.35, 0.21, 0.32);
  pediment(out, side, spec.pediment, gap, lod);
  if (lod >= 2 && spec.name !== 'foster-place') {
    for (const [f, base] of [
      [0.11, y.parapet],
      [0.5, spec.pediment],
      [0.89, y.parapet],
    ]) {
      const [x, , z] = p(f * length, base, -0.3);
      boundsBox(
        out,
        'limestone',
        [x - 0.37, base, z - 0.29],
        [x + 0.37, base + 0.33, z + 0.29],
        color.dress,
      );
      drum(out, [x, z], base + 0.28, base + 1.58, 0.2, 0);
    }
  }
}

function surrounds(out, lod) {
  const direction = orientation(outline);
  const openEdges = new Set([40, 41, 42, 60, 61, 62, 21, 22, 23, 24, 25]);
  for (const [i, start] of outline.entries()) {
    if (openEdges.has(i)) continue;
    const end = outline[(i + 1) % outline.length];
    const side = edge(start, end, direction);
    const { length, p } = side;
    const curved = (i >= 26 && i <= 34) || (i >= 49 && i <= 58);
    const courtyard = [36, 37, 38, 39, 43, 44, 45, 46].includes(i);
    const frontArch = i === 35 || i === 47;
    const count = length > 3.4 ? Math.max(1, Math.floor(length / (curved ? 4.5 : 5.35))) : 0;
    const apertures = [];
    if (frontArch) {
      apertures.push({
        x: length / 2,
        floor: 1.02,
        w: length * 0.55,
        h: 7.45,
        arch: 1.63,
        depth: 0.62,
        tint: color.dark,
      });
      pediment(out, side, 14.26, 1.9, lod);
      if (lod) {
        for (const u of [length * 0.12, length * 0.88]) {
          const [x, , z] = p(u, 0, 0.16);
          drum(out, [x, z], Math.max(0.88, grade(x, z) + 0.11), y.entablature + 0.24, 0.34, lod);
        }
      }
    }
    for (let j = 0; j < (frontArch ? 0 : count); j++) {
      const x = ((j + 0.5) * length) / count;
      const width = Math.min(1.57, (length / count) * 0.56);
      apertures.push({
        x,
        floor: 1.68,
        w: width + 0.06,
        h: 3.06,
        arch: 0.67,
        tint: curved ? color.closed : color.dark,
      });
      if (lod)
        apertures.push({
          x,
          floor: 6.23,
          w: width * 0.83,
          h: 2.71,
          arch: curved ? 0.64 : 0,
          tint: curved ? color.closed : color.glass,
        });
      if (lod && curved) {
        const u = Math.max(0.05, x - (0.45 * length) / count);
        const a = p(u, y.plinth, 0.1),
          b = p(u, y.entablature, 0.1);
        beam(out, 'limestone', a, b, 0.35, 0.27, color.stone);
      }
    }
    if (lod) datum(out, side);
    wall(out, side, lod ? y.plinth : -0.28, y.parapet, apertures, lod >= 2 ? lod : 0);
    if (lod >= 2 || (lod === 1 && (curved || courtyard))) {
      molding(out, side, 0, length, y.parapet - 0.24, 0.25, 0.39, color.dress);
    }
    if (lod >= 2 && (curved || length > 8)) {
      molding(out, side, 0, length, y.stringcourse + 0.38, 0.19, 0.24);
    }
    if (courtyard && length > 5.25) {
      const n = Math.max(2, Math.round(length / 2.85));
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.33) * length) / n;
        const [x, , z] = p(u, 0, 1.75);
        drum(out, [x, z], 0.91, y.entablature, 0.44, lod);
      }
      projection(
        out,
        side,
        0.04,
        length - 0.04,
        y.entablature,
        y.parapet - 0.06,
        2.04,
        0.02,
        'limestone',
        color.stone,
      );
      directed(
        out,
        'limestone',
        [
          p(0, y.entablature, 2.04),
          p(length, y.entablature, 2.04),
          p(length, y.entablature),
          p(0, y.entablature),
        ],
        [0, -1, 0],
        color.shade,
      );
    }
  }
  for (const court of courts) {
    const facing = -orientation(court);
    for (const [i, start] of court.entries()) {
      const side = edge(start, court[(i + 1) % court.length], facing);
      const count = lod ? Math.floor(side.length / 6) : 0;
      const lights = Array.from({ length: count }, (_, j) => ({
        x: ((j + 0.5) * side.length) / count,
        floor: 5.85,
        w: 1.22,
        h: 2.9,
      }));
      if (lod) datum(out, side);
      wall(out, side, lod ? y.plinth : -0.28, y.deck, lights, lod > 1 ? 1 : 0);
    }
  }
}

function hipped(out, left, right, near, far, height, slot, tint) {
  const run = Math.min((right - left) * 0.24, (far - near) * 0.59);
  const middle = (near + far) / 2;
  const a = [left, y.deck, near],
    b = [right, y.deck, near],
    c = [right, y.deck, far],
    d = [left, y.deck, far];
  const l = [left + run, height, middle],
    r = [right - run, height, middle];
  for (const face of [
    [a, b, r, l],
    [b, c, r],
    [c, d, l, r],
    [d, a, l],
  ])
    directed(out, slot, face, up, tint);
}

function roofs(out, lod) {
  surface(out, 'slate', outline, (x, z) => [x, y.deck, z], up, color.slate, courts);
  hipped(out, -49.3, 12.0, -36.4, -30.1, 15.4, 'slate', color.slate);
  hipped(out, 12.4, 49.7, -34.5, -31.7, 14.74, 'slate', color.slate);
  hipped(out, -24.5, 15.5, -24.5, 10.7, y.northRidge, 'slate', color.slate);
  hipped(out, -22.6, 24.2, 13.7, 25.8, 15.2, 'slate', color.slate);
  hipped(out, 17.2, 50.7, -21.0, 10.4, 15.75, 'copper', color.copper);
  hipped(out, -49.1, -41.3, -10.7, 17.8, 14.66, 'slate', color.slate);
  if (lod) {
    for (const [x, z] of [
      [-39.5, -34.3],
      [-16.4, -34.2],
      [2.8, -33.7],
      [25.0, -33.0],
      [-39.0, 21.4],
      [36.5, 21.2],
      [-20.7, 13.7],
      [20.7, 13.7],
    ]) {
      boundsBox(
        out,
        'granite',
        [x - 0.7, y.deck, z - 0.44],
        [x + 0.7, 16.66, z + 0.44],
        color.lower,
      );
      boundsBox(
        out,
        'limestone',
        [x - 0.81, 16.57, z - 0.54],
        [x + 0.81, 16.88, z + 0.54],
        color.stone,
      );
    }
  }
}

function build(out, lod) {
  surrounds(out, lod);
  roofs(out, lod);
  for (const spec of plan.porticoes) portico(out, spec, lod);
}

export const parliamentSkyline = (out) => build(out, 0);
export const parliamentDistrict = (out) => build(out, 1);
export const parliamentStreet = (out) => build(out, 2);
export const parliamentCloseup = (out) => build(out, 3);

const recipe = 'dublin-parliament-model.mjs',
  camera = [110, 58, 158],
  lookAt = [0, 7, 4];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'parliamentDistrict', 0.55],
    ['street', 'parliamentStreet', 0.17],
    ['closeup', 'parliamentCloseup', 0.045],
  ].map(([level, entry, errorMeters]) => [
    level,
    { export: entry, errorMeters, surfaces: materials },
  ]),
);
export const parliamentModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces: materials,
  build: parliamentCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Dublin Parliament House with an open College Green colonnade, curved screen walls, three pedimented porticoes and two rear courts.',
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
    minimumCoverage: 0.94,
    basis: 'The named Parliament House exterior from OpenStreetMap relation 3676582.',
  },
  mediumFiContext: {
    scale: 2.22,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_raw',
    'slate',
    'metal_copper',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'college-green-colonnade-and-curves', position: [0, 18, 117], lookAt: [0, 7.7, 27] },
    { name: 'foster-place-ionic-portico', position: [-96, 11, 25], lookAt: [-52, 6.9, 4] },
    { name: 'westmoreland-portico-and-courts', position: [103, 31, -18], lookAt: [34, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-parliament-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'parliamentSkyline',
    errorMeters: 0.93,
    surfaces: materials,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprints are ODbL. The exact Qualla architectural references are CC0.',
};
