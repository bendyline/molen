/** The Art Nouveau Kaufhaus zum Strauss and its public arcade, Görlitz. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { section: s, arcade: a } = plan;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  dress: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92, metallic: 0 },
  service: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
};
const c = Object.fromEntries(
  Object.entries({
    stone: 'b6a48d',
    dress: 'c9b79e',
    shadow: '8d7c67',
    plinth: '817a6d',
    tile: '865744',
    roofShade: '755344',
    roofLight: '967360',
    service: 'd0cac0',
    glass: '465252',
    steel: '4f5350',
    display: '54504a',
    panel: '827e6d',
    lamp: 'd3cbbc',
  }).map(([name, color]) => [name, rgb(color)]),
);
const up = [0, 1, 0];
const down = [0, -1, 0];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const point = ([x, z], y) => [x, y, z];
const mix = (first, second, t) => first.map((n, i) => n + (second[i] - n) * t);

function directed(out, slot, points, normal, color) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, color);
  else face(out, slot, wound, color);
}

function surface(out, slot, ring, coordinates, normal, color, holes = []) {
  const points = [...ring];
  const holeIndices = holes.map((hole) => {
    const index = points.length;
    points.push(...hole);
    return index;
  });
  const indices = earcut(points.flat(), holeIndices);
  for (let i = 0; i < indices.length; i += 3) {
    directed(
      out,
      slot,
      indices.slice(i, i + 3).map((k) => coordinates(...points[k])),
      normal,
      color,
    );
  }
}

function edge(first, second, side) {
  const dx = second[0] - first[0],
    dz = second[1] - first[1];
  const length = Math.hypot(dx, dz);
  const normal = [(-side * dz) / length, 0, (side * dx) / length];
  const p = (u, y, depth = 0) => [
    first[0] + (dx * u) / length - normal[0] * depth,
    y,
    first[1] + (dz * u) / length - normal[2] * depth,
  ];
  return { length, normal, p };
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

function opening({ center, width, bottom, top, arch }, lod) {
  const r = width / 2;
  const ring = [
    [center - r, bottom],
    [center + r, bottom],
  ];
  if (!arch) return [...ring, [center + r, top], [center - r, top]];
  const n = [4, 6, 9, 12][lod];
  return [
    ...ring,
    ...Array.from({ length: n + 1 }, (_, i) => {
      const theta = (i * Math.PI) / n;
      return [center + r * Math.cos(theta), top - arch + arch * Math.sin(theta)];
    }),
  ];
}

function frameWindow(out, section, window, depth, lod) {
  const { p } = section,
    { center, width, bottom, top } = window;
  if (!window.mullions || lod < 2) return;
  const inset = depth - 0.025;
  if (width > 0.74) {
    beam(
      out,
      'metal',
      p(center, bottom + 0.04, inset),
      p(center, top - 0.2, inset),
      0.052,
      0.064,
      c.steel,
    );
  }
  const divisions = window.ornate && lod === 3 ? 5 : 3;
  for (let j = 1; j < divisions; j++) {
    const y = bottom + ((top - bottom) * j) / divisions;
    beam(
      out,
      'metal',
      p(center - width * 0.49, y, inset),
      p(center + width * 0.49, y, inset),
      0.047,
      0.055,
      c.steel,
    );
  }
}

function wall(out, section, low, high, windows, lod, slot = 'stone', tint = c.stone) {
  const { p, normal, length } = section;
  const border = [
    [0, low],
    [length, low],
    [length, high],
    [0, high],
  ];
  const holes = windows.map((window) => opening(window, lod));
  const cut = holes.filter((_, i) => lod >= 1 || windows[i].through);
  surface(out, slot, border, p, normal, tint, cut);
  for (const [i, window] of windows.entries()) {
    const { center, bottom, top, through, depth = through ? 0.92 : 0.19 } = window;
    const ring = holes[i];
    if (!through) {
      const backing = lod ? depth : -0.018;
      surface(out, 'dark', ring, (u, y) => p(u, y, backing), normal, window.color ?? c.glass);
      frameWindow(out, section, window, backing, lod);
    }
    if (!lod && !through) continue;
    const target = p(center, (bottom + top) / 2);
    for (let j = 0; j < ring.length; j++) {
      const [u, y] = ring[j],
        [v, w] = ring[(j + 1) % ring.length];
      const middle = p((u + v) / 2, (y + w) / 2);
      directed(
        out,
        'dress',
        [p(u, y), p(v, w), p(v, w, depth), p(u, y, depth)],
        target.map((n, axis) => n - middle[axis]),
        c.shadow,
      );
    }
  }
}

const rectangular = (center, width, bottom, top, details = {}) => ({
  center,
  width,
  bottom,
  top,
  ...details,
});
const band = (out, section, start, end, y, width, depth, tint = c.dress) =>
  beam(out, 'dress', section.p(start, y, -0.04), section.p(end, y, -0.04), width, depth, tint);

function pediment(out, section, start, end, lod) {
  const { p, normal } = section;
  const center = (start + end) / 2,
    radius = (end - start) / 2;
  const n = lod >= 2 ? 14 : 7;
  const crest = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 2 - 1;
    return [center + radius * t, s.cornice + (s.pedimentCrown - s.cornice) * (1 - t * t)];
  });
  const oculus = Array.from({ length: lod ? 12 : 8 }, (_, i) => {
    const angle = (2 * Math.PI * i) / (lod ? 12 : 8);
    return [center + 0.59 * Math.cos(angle), s.cornice + 1.66 + 0.53 * Math.sin(angle)];
  });
  surface(out, 'stone', crest, p, normal, c.stone, lod ? [oculus] : []);
  surface(out, 'dark', oculus, (u, y) => p(u, y, lod ? 0.16 : -0.025), normal, c.steel);
  if (lod >= 1) {
    for (let i = 1; i < crest.length; i++) {
      const left = p(...crest[i - 1], -0.12),
        right = p(...crest[i], -0.12);
      beam(out, 'dress', left, right, 0.3, 0.34, c.dress);
      directed(
        out,
        'roof',
        [left, right, p(...crest[i], 0.93), p(...crest[i - 1], 0.93)],
        up,
        c.roofShade,
      );
    }
  }
}

function civicFacade(out, section, lod) {
  const { length, p } = section;
  const westPortal = length - a.width * 0.51;
  const bodyEnd = length - a.width;
  const left = bodyEnd * 0.23,
    right = bodyEnd * 0.72;
  const mid = (left + right) / 2;
  const windows = [
    rectangular(westPortal, a.width - 1.33, -0.84, s.arcadeCrown, { arch: 1.93, through: true }),
  ];
  for (const [start, end, n] of [
    [0.65, left, 3],
    [right, bodyEnd, 4],
  ]) {
    const pitch = (end - start) / n;
    for (let i = 0; i < n; i++) {
      const center = start + (i + 0.5) * pitch;
      windows.push(
        rectangular(center, pitch * 0.76, 0.59, s.storeBand - 0.58, {
          color: c.display,
          mullions: true,
        }),
      );
      const lights = [1, 2, 3, 3][lod];
      for (let j = 0; j < lights; j++) {
        const x = center + ((j + 0.5) / lights - 0.5) * pitch * 0.7;
        windows.push(
          rectangular(x, (pitch * 0.53) / lights, 6.03, s.mezzanineTop, {
            mullions: true,
            ornate: true,
          }),
        );
        windows.push(
          rectangular(x, (pitch * 0.53) / lights, s.topFloorSill, 17.92, { mullions: true }),
        );
      }
      if (lod) {
        const pier = start + i * pitch;
        beam(
          out,
          'dress',
          p(pier, 0.22, -0.11),
          p(pier, s.cornice - 0.18, -0.11),
          0.42,
          0.31,
          c.dress,
        );
      }
    }
  }
  const openingPitch = (right - left) / 7;
  for (let i = 0; i < 7; i++) {
    const x = left + (i + 0.5) * openingPitch;
    windows.push(
      rectangular(x, openingPitch * 0.7, 0.55, s.storeBand - 0.52, {
        color: c.display,
        mullions: true,
      }),
    );
    const centerTriplet = i >= 2 && i <= 4;
    const height = centerTriplet ? 17.4 : 16.95;
    windows.push(
      rectangular(x, openingPitch * (centerTriplet ? 0.56 : 0.55), 6.14, height, {
        arch: centerTriplet ? 0.76 : 0,
        mullions: true,
        ornate: true,
        depth: 0.29,
      }),
    );
    if (lod >= 2 && centerTriplet) {
      const pier = x - openingPitch * 0.45;
      beam(out, 'dress', p(pier, 5.89, -0.27), p(pier, 14.32, -0.27), 0.42, 0.5, c.dress);
      beam(out, 'dress', p(pier, 14.27, -0.29), p(pier + 0.16, 15.14, -0.26), 0.43, 0.4, c.dress);
      beam(
        out,
        'dress',
        p(pier + 0.13, 15.05, -0.28),
        p(pier + 0.14, 15.54, -0.28),
        0.34,
        0.34,
        c.dress,
      );
    }
  }
  for (const x of [-1, 0, 1].map((i) => westPortal + i * 1.32)) {
    windows.push(rectangular(x, 0.89, 8.29, 16.69, { mullions: true }));
  }
  wall(out, section, -1.0, s.cornice, windows, lod);
  band(out, section, 0, bodyEnd, 0.25, 0.39, 0.13, c.plinth);
  band(out, section, 0, bodyEnd, s.storeBand, 0.17, 0.26);
  band(out, section, 0, length, s.cornice - 0.14, 0.39, 0.43);
  if (lod) band(out, section, mid - 4.45, mid + 4.45, 4.77, 0.36, 0.94);
  pediment(out, section, left + 1.6, right - 1.35, lod);
}

function arcade(out, lod) {
  const outside = edge(outline[0], outline[7], -1);
  const inner = edge(
    [outline[0][0] - a.width, outline[0][1]],
    [outline[7][0] - a.width, outline[7][1]],
    -1,
  );
  const n = a.bayCount,
    pitch = outside.length / n;
  const portals = Array.from({ length: n }, (_, i) =>
    rectangular((i + 0.5) * pitch, pitch - a.pierWidth, -0.84, s.arcadeCrown, {
      arch: s.arcadeCrown - s.arcadeSpring,
      through: true,
    }),
  );
  const upper = portals.flatMap(({ center }) =>
    [-1.38, 0, 1.38].map((du) =>
      rectangular(center + du, 0.93, 8.08, 17.52, { mullions: true, ornate: true }),
    ),
  );
  wall(out, outside, -1, s.cornice, [...portals, ...upper], lod);
  band(out, outside, 0, outside.length, s.cornice - 0.14, 0.39, 0.43);
  const shops = portals.map(({ center }) =>
    rectangular(center, pitch - 1.2, 0.43, 4.95, { color: c.display, mullions: true }),
  );
  wall(out, inner, -1, s.arcadeCrown, shops, lod, 'dress', c.dress);
  const pavement = ([x, , z]) => [x, grade(x, z) + 0.04, z];
  for (let i = 0; i < n; i++) {
    const first = i * pitch,
      last = (i + 1) * pitch;
    directed(
      out,
      'dress',
      [outside.p(first, 0), outside.p(last, 0), inner.p(last, 0), inner.p(first, 0)].map(pavement),
      up,
      c.plinth,
    );
  }
  if (!lod) {
    directed(
      out,
      'dress',
      [
        outside.p(0, 5.98),
        outside.p(outside.length, 5.98),
        inner.p(inner.length, 5.98),
        inner.p(0, 5.98),
      ],
      down,
      c.shadow,
    );
    return;
  }
  const segments = lod >= 2 ? 10 : 5;
  for (let j = 0; j < segments; j++) {
    const u = j / segments,
      v = (j + 1) / segments;
    const y = (t) => 5.08 + 1.25 * Math.sin(t * Math.PI);
    const p = (at, t) => mix(outside.p(at, y(t)), inner.p(at, y(t)), t);
    directed(
      out,
      'dress',
      [p(0, u), p(outside.length, u), p(outside.length, v), p(0, v)],
      down,
      j % 2 ? c.dress : c.stone,
    );
  }
  if (lod >= 2) {
    for (const { center } of portals) {
      for (const depth of [1.25, 4.05]) {
        const foot = outside.p(center, 3.68, depth);
        beam(out, 'metal', foot, [foot[0], 4.55, foot[2]], 0.077, 0.077, c.steel);
        box(out, 'dark', foot[0], 3.72, foot[2], 0.31, 0.34, 0.31, c.lamp);
      }
    }
  }
}

function services(out, lod) {
  const count = outline.length;
  for (let i = 1; i < count - 2; i++) {
    const side = edge(outline[i], outline[i + 1], 1);
    const n = Math.max(1, Math.floor(side.length / 3.1));
    const windows = [];
    for (let j = 0; j < n; j++) {
      const center = ((j + 0.5) * side.length) / n;
      const width = Math.min((side.length / n) * 0.64, 1.55);
      if (side.length < 4) continue;
      for (const y of [6.08, 10.21, 14.46])
        windows.push(rectangular(center, width, y, y + 2.78, { mullions: true }));
    }
    wall(out, side, -1.02, s.cornice - 1.65, windows, lod, 'service', c.service);
  }
  surface(
    out,
    'roof',
    [
      [-35.7, -0.95],
      [-32.23, -0.95],
      [-32.31, -14.55],
      [-26.1, -14.56],
      [-26.1, 16.98],
      [-35.4, 16.98],
    ],
    (x, z) => [x, s.cornice - 1.65, z],
    up,
    c.roofShade,
  );
  for (const [x, z, height] of [
    [-30.22, 0.42, 23.78],
    [-28.31, -7.54, 25.18],
  ]) {
    const width = 3.4,
      depth = 3.64,
      lower = s.cornice - 2.1;
    box(out, 'service', x, (height + lower) / 2, z, width, height - lower, depth, c.service);
    box(out, 'metal', x, height + 0.05, z, width + 0.24, 0.24, depth + 0.27, c.steel);
    if (lod) {
      box(out, 'dark', x - width / 2 - 0.012, height - 0.82, z - 0.62, 0.033, 0.9, 0.46, c.glass);
      box(out, 'dark', x - width / 2 - 0.012, height - 0.82, z + 0.62, 0.033, 0.9, 0.46, c.glass);
    }
  }
  box(out, 'service', -33.34, 1.99, 3.18, 4.1, 4.95, 15.6, c.service);
  const z0 = -6.5,
    z1 = 13.55,
    y0 = 4.38,
    y1 = 5.37;
  const wallX = -33.15,
    edgeX = -36.07;
  directed(
    out,
    'metal',
    [
      [edgeX, y0, z0],
      [edgeX, y0, z1],
      [wallX, y1, z1],
      [wallX, y1, z0],
    ],
    up,
    c.steel,
  );
  if (lod) {
    for (let j = 0; j < 7; j++) {
      const z = z0 + ((z1 - z0) * j) / 6;
      beam(out, 'metal', [edgeX, y0 - 0.06, z], [wallX, y1 - 0.06, z], 0.1, 0.11, c.steel);
    }
  }
}

function roof(out, lod) {
  const rectangle = (left, right, south, north) => [
    [left, south],
    [right, south],
    [right, north],
    [left, north],
  ];
  const eaves = [outline[1], outline[0], outline[7], [-27.1, outline[7][1]]];
  const serviceJunction = edge(eaves[3], eaves[0], -1);
  wall(out, serviceJunction, s.cornice - 1.65, s.cornice, [], lod, 'service', c.service);
  const rings = [
    [eaves, s.cornice],
    [rectangle(-25.25, 29.84, -15.61, 14.95), s.roofShoulder],
    [rectangle(-23.1, 27.9, -13.65, 12.65), s.roofRidge],
  ];
  for (let i = 1; i < rings.length; i++) {
    const [from, low] = rings[i - 1],
      [to, high] = rings[i];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      directed(
        out,
        'roof',
        [point(from[j], low), point(from[k], low), point(to[k], high), point(to[j], high)],
        up,
        i === 1 ? c.tile : c.roofShade,
      );
    }
  }
  const [top, y] = rings.at(-1);
  surface(out, 'roof', top, (x, z) => [x, y, z], up, c.roofShade);
  box(out, 'metal', -1.1, y + 0.19, -1.14, 19.2, 0.43, 10.7, c.steel);
  box(out, 'dark', -1.1, y + 0.42, -1.14, 17.3, 0.12, 8.7, c.glass);
  if (lod) {
    for (const x of [-20.7, -15.4, -10.2, 13.75, 19.3, 24.6]) {
      for (const sign of [-1, 1]) {
        const z = sign * (sign < 0 ? 15.9 : 15.2);
        box(out, 'dress', x, 20.1, z, 2.62, 1.62, 1.88, c.dress);
        box(out, 'dark', x, 20.1, z + sign * 0.955, 1.99, 1.01, 0.04, c.glass);
        const profile = [
          [x - 1.46, 20.82],
          [x - 1.04, 21.22],
          [x, 21.45],
          [x + 1.04, 21.22],
          [x + 1.46, 20.82],
        ];
        surface(out, 'dress', profile, (u, y) => [u, y, z + sign * 0.96], [0, 0, sign], c.dress);
        for (let i = 1; i < profile.length; i++) {
          const [u, y0] = profile[i - 1],
            [v, y1] = profile[i];
          directed(
            out,
            'roof',
            [
              [u, y0, z + sign * 0.98],
              [v, y1, z + sign * 0.98],
              [v, y1 + 0.15, z - sign * 0.92],
              [u, y0 + 0.15, z - sign * 0.92],
            ],
            up,
            c.tile,
          );
        }
      }
    }
  }
  if (lod >= 2) {
    for (let j = 1; j < 9; j++)
      box(out, 'metal', -9.7 + j * 1.91, y + 0.51, -1.14, 0.08, 0.1, 8.73, c.steel);
  }
}

function build(out, lod) {
  civicFacade(out, edge(outline[6], outline[7], 1), lod);
  civicFacade(out, edge(outline[1], outline[0], -1), lod);
  arcade(out, lod);
  services(out, lod);
  roof(out, lod);
}

export const storeSkyline = (out) => build(out, 0);
export const storeDistrict = (out) => build(out, 1);
export const storeStreet = (out) => build(out, 2);
export const storeCloseup = (out) => build(out, 3);

const recipe = 'gorlitz-store-model.mjs',
  camera = [68, 24, -78],
  lookAt = [0, 10.8, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'storeDistrict', 0.5],
    ['street', 'storeStreet', 0.15],
    ['closeup', 'storeCloseup', 0.04],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const storeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: storeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Art Nouveau department store with tall stone piers, a shallow pediment, a covered public arcade and a red mansard roof.',
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
    basis: 'The named Kaufhaus Görlitz polygon from OpenStreetMap way 25646212.',
  },
  mediumFiContext: {
    scale: 2.18,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_sandstone',
    'tile_ceramic',
    'plaster_lime',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'south-front-and-covered-arcade', position: [62, 13, -48], lookAt: [2, 10, -5] },
    { name: 'arcade-opening-and-vaults', position: [49, 3.3, -23], lookAt: [27, 4.0, -4] },
    { name: 'east-service-towers-and-canopy', position: [-64, 16, 35], lookAt: [-19, 9.1, 2.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-store-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'storeSkyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The OpenStreetMap footprint is ODbL. The three exact Qualla exterior photographs were dedicated to the public domain under CC0.',
};
