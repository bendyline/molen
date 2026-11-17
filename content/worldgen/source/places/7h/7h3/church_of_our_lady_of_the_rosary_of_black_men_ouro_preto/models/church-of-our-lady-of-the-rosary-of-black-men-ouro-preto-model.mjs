/** The Rosário church of Ouro Preto, with interlocking oval volumes and a bowed stone front. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const { ring } = read('native-map/local-ring-controls.json');
const {
  front: {
    frontMidpoint: [cx, cz],
    frontOutward: [nx, nz],
  },
  floorEstimate: floor,
  nave,
  chancel,
  towers,
  towerCorniceEstimate,
  towerCrownEstimate,
  verticalRegistrationOffset,
} = plan.dimensions;
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    lime: 'd9d3c6',
    shadedLime: 'cec7b9',
    podium: 'a39a8a',
    soap: '858078',
    band: '999186',
    lightStone: 'a7a093',
    crown: '8e8575',
    tile: 'a0664d',
    tileShade: '915b46',
    ridge: '986451',
    wood: '626b60',
    glass: '586364',
    shade: '56544b',
    rail: '575850',
    bronze: '8d7858',
    paving: 'a59c8d',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.9, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.55, metallic: 0.04 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.87, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.67, metallic: 0.28 },
};
const point = (u, y, v) => [
  cx + nz * u + nx * v,
  y + verticalRegistrationOffset,
  cz - nx * u + nz * v,
];
const direction = ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v];
const p2 = ([u, v], y) => [u, y, v];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const range = (a, b) => ring.slice(a, b + 1);
const flat = (y) => () => y;

function grade(u, v) {
  const [x, , z] = point(u, 0, v);
  const a = (x - terrain.origin[0]) / terrain.stepMeters;
  const b = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(a),
    j = Math.floor(b);
  const lo = terrain.heightsMeters[j];
  const hi = terrain.heightsMeters[j + 1];
  return (
    lerp(lerp(lo[i], lo[i + 1], a - i), lerp(hi[i], hi[i + 1], a - i), b - j) -
    terrain.modelDatumElevationMeters -
    verticalRegistrationOffset
  );
}

function face(out, slot, points, toward, color, uv = ([x, y, z]) => [x - z * 0.4, y]) {
  const n = normalFor(...points);
  const flip = n.reduce((sum, value, i) => sum + value * toward[i], 0) < 0;
  out.addConvexPolygon(
    slot,
    pal,
    points.map((p) => point(...p)),
    direction(flip ? n.map((v) => -v) : n),
    uv,
    color,
  );
}

function localBeam(out, slot, a, b, width, depth, color) {
  beam(out, slot, point(...a), point(...b), width, depth, color);
}

function localPath(out, slot, points, width, depth, color, closed = false) {
  beamPath(
    out,
    slot,
    points.map((p) => point(...p)),
    width,
    depth,
    color,
    closed,
  );
}

function stacked(out, slot, center, profile, sides, color) {
  const levels = profile.map(([y, radius]) =>
    radialRing(y, radius, radius, sides, center).map((p) => point(...p)),
  );
  loft(out, slot, levels, color);
}

function edgeNormals(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
  const sign = Math.sign(area);
  return ring.map(([x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    const length = Math.hypot(a - x, b - z);
    return [((b - z) * sign) / length, 0, ((x - a) * sign) / length];
  });
}

function wallRing(out, ring, normals, lo, hi, slot, color) {
  let width = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const uv = ([x, y, z]) => [width + ((x - a[0]) * dx + (z - a[1]) * dz) / length, y];
    face(
      out,
      slot,
      [p2(a, lo(...a)), p2(b, lo(...b)), p2(b, hi(...b)), p2(a, hi(...a))],
      normals[i],
      color,
      uv,
    );
    width += length;
  }
}

const naveline = [
  [3.8, -5.7],
  ...range(11, 17),
  [4.1, -25.15],
  [-3.4, -24.85],
  ...range(31, 36),
  [-3.6, -5.8],
];
const chanceline = [
  [4.3, -22.0],
  ...range(17, 22),
  [4.2, -39.3],
  [-4.2, -39.3],
  ...range(25, 31),
  [-3.5, -22.3],
];
const annexline = [ring[22], ring[23], ring[24], ring[25], [-4.3, -36.65], [4.3, -36.95]];

function roofShoulders(ring, center, scaleU, scaleV) {
  return ring.map(([u, v]) => [lerp(center[0], u, scaleU), lerp(center[1], v, scaleV)]);
}

function ovalRoof(out, ring, section, lod) {
  const eaveY = section.eaveY;
  const rise = section.roofRidgeY - eaveY;
  const center = section.center;
  const skirt = roofShoulders(ring, center, 1.044, 1.027);
  const soffit = roofShoulders(ring, center, 1.049, 1.034);
  const edgeLevels =
    lod === 0
      ? [
          [skirt, eaveY - 0.12],
          [roofShoulders(ring, center, 0.055, 0.66), eaveY + rise],
        ]
      : [
          [skirt, eaveY - 0.13],
          [soffit, eaveY + 0.04],
          [roofShoulders(ring, center, 0.55, 0.84), eaveY + rise * 0.56],
          [roofShoulders(ring, center, 0.047, 0.66), eaveY + rise],
        ];
  const normals = edgeNormals(ring);
  for (let step = 1; step < edgeLevels.length; step++) {
    const [prior, lo] = edgeLevels[step - 1];
    const [next, hi] = edgeLevels[step];
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      const a = p2(prior[i], lo),
        b = p2(prior[j], lo),
        d = p2(next[i], hi),
        e = p2(next[j], hi);
      const uv = ([x, y, z]) => [z + 0.22 * x, Math.hypot(x - center[0], y - eaveY)];
      const target = step === 1 && lod > 0 ? normals[i] : up;
      face(out, 'tile', [a, b, e], target, i % 3 === 2 ? c.tileShade : c.tile, uv);
      face(out, 'tile', [a, e, d], target, i % 3 === 2 ? c.tileShade : c.tile, uv);
    }
  }
  const [top, y] = edgeLevels.at(-1);
  // The upper ridge is a narrow tiled crown. The perimeter can be concave.
  const mean = [center[0], y + 0.13, center[1]];
  for (let i = 0; i < top.length; i++)
    face(out, 'tile', [p2(top[i], y), p2(top[(i + 1) % top.length], y), mean], up, c.ridge);
  if (lod > 0)
    for (let i = 0; i < ring.length; i++)
      face(
        out,
        'stone',
        [
          p2(ring[i], eaveY - 0.24),
          p2(ring[(i + 1) % ring.length], eaveY - 0.24),
          p2(skirt[(i + 1) % ring.length], eaveY - 0.105),
          p2(skirt[i], eaveY - 0.105),
        ],
        [0, -1, 0],
        c.band,
      );
}

function sideWindow(out, center, normal, low, width, height, lod) {
  const [u, v] = center,
    [du, , dv] = normal;
  const p = (s, h, d = 0) => [u + dv * s + du * d, h, v - du * s + dv * d];
  const half = width / 2;
  const top = low + height;
  const surface = (slot, a, b, base, cap, d, color) =>
    face(out, slot, [p(a, base, d), p(b, base, d), p(b, cap, d), p(a, cap, d)], normal, color);
  surface('stone', -half - 0.17, half + 0.17, low - 0.1, top + 0.2, 0.055, c.soap);
  surface('timber', -half, half, low, top, 0.073, c.wood);
  if (lod > 1) {
    surface('glass', -half + 0.105, half - 0.105, low + height * 0.55, top - 0.11, 0.082, c.glass);
    surface('paint', -0.027, 0.027, low + height * 0.55, top - 0.11, 0.097, c.wood);
    localBeam(
      out,
      'stone',
      p(-half - 0.22, low - 0.06, 0.14),
      p(half + 0.22, low - 0.06, 0.14),
      0.16,
      0.19,
      c.band,
    );
  }
}

function hull(out, ring, section, lod, windows) {
  const norms = edgeNormals(ring);
  const plinth = lod === 0 ? floor : floor + 0.24;
  wallRing(
    out,
    ring,
    norms,
    (u, v) => Math.min(grade(u, v) - 0.36, floor - 0.27),
    flat(plinth),
    'base',
    c.podium,
  );
  wallRing(out, ring, norms, flat(plinth), flat(section.eaveY), 'plaster', c.lime);
  if (lod > 0) {
    const belt = roofShoulders(ring, section.center, 1.019, 1.015);
    wallRing(
      out,
      belt,
      norms,
      flat(section.eaveY - 0.31),
      flat(section.eaveY - 0.09),
      'stone',
      c.band,
    );
    for (const [i, h, w] of windows) {
      const j = (i + 1) % ring.length;
      sideWindow(out, mix(ring[i], ring[j], 0.52), norms[i], h, w, 1.8, lod);
    }
  }
  ovalRoof(out, ring, section, lod);
}

function bowed(u) {
  return 1.03 - 0.079 * u * u;
}
const curved = (u, y, d = 0) => [u, y, bowed(u) + d];

function strip(out, slot, a, b, base, top, depth, color, segments = 1) {
  for (let i = 0; i < segments; i++) {
    const u = lerp(a, b, i / segments),
      v = lerp(a, b, (i + 1) / segments);
    face(
      out,
      slot,
      [
        curved(u, base(u), depth),
        curved(v, base(v), depth),
        curved(v, top(v), depth),
        curved(u, top(u), depth),
      ],
      [0, 0, 1],
      color,
      ([x, y]) => [x, y],
    );
  }
}

const bays = [
  { u: -2.58, half: 0.82, spring: 3.36, rise: 0.92 },
  { u: 0, half: 1.02, spring: 3.66, rise: 1.1 },
  { u: 2.58, half: 0.82, spring: 3.36, rise: 0.92 },
];
function archHeight(u, bay) {
  const t = (u - bay.u) / bay.half;
  return bay.spring + bay.rise * Math.sqrt(Math.max(0, 1 - t * t));
}

function entranceArch(out, bay, lod) {
  const { u, half, spring, rise } = bay;
  const a = u - half,
    b = u + half;
  const pieces = [4, 8, 12, 18][lod];
  strip(out, 'plaster', a, b, (u) => archHeight(u, bay), flat(6.03), 0, c.lime, pieces);
  strip(out, 'paint', a, b, flat(floor), flat(spring), -0.79, c.shade, 2);
  const points = Array.from({ length: pieces + 1 }, (_, i) => {
    const t = (i * Math.PI) / pieces;
    return [u + half * Math.cos(t), spring + rise * Math.sin(t)];
  });
  for (let i = 0; i < pieces; i++) {
    const [x, y] = points[i],
      [v, h] = points[i + 1];
    face(
      out,
      'paint',
      [curved(u, spring, -0.79), curved(x, y, -0.79), curved(v, h, -0.79)],
      [0, 0, 1],
      c.shade,
    );
    face(
      out,
      'stone',
      [curved(x, y), curved(v, h), curved(v, h, -0.58), curved(x, y, -0.58)],
      [0, -1, 0],
      c.soap,
    );
    if (lod > 0) {
      const p = (j) => {
        const t = (j * Math.PI) / pieces;
        return curved(u + (half + 0.22) * Math.cos(t), spring + (rise + 0.22) * Math.sin(t), 0.052);
      };
      face(
        out,
        'stone',
        [curved(x, y, 0.052), p(i), p(i + 1), curved(v, h, 0.052)],
        [0, 0, 1],
        c.soap,
      );
    }
  }
  for (const [x, sign] of [
    [a, 1],
    [b, -1],
  ]) {
    face(
      out,
      'stone',
      [curved(x, floor), curved(x, spring), curved(x, spring, -0.58), curved(x, floor, -0.58)],
      [sign, 0, 0],
      c.band,
    );
    strip(out, 'stone', x - 0.098, x + 0.098, flat(floor), flat(spring + 0.03), 0.051, c.soap);
  }
  if (lod > 1) {
    const count = lod === 3 ? 8 : 5;
    for (let i = 1; i <= count; i++) {
      const p = lerp(a, b, i / (count + 1));
      localBeam(
        out,
        'paint',
        curved(p, floor + 0.04, -0.42),
        curved(p, archHeight(p, bay) - 0.12, -0.42),
        0.046,
        0.042,
        c.rail,
      );
    }
    localBeam(
      out,
      'paint',
      curved(a + 0.045, 2.81, -0.4),
      curved(b - 0.045, 2.81, -0.4),
      0.059,
      0.048,
      c.rail,
    );
  }
}

function facadeMolding(out, y, depth, width, lod, color) {
  const segments = lod === 1 ? 7 : lod === 2 ? 13 : 20;
  const path = Array.from({ length: segments + 1 }, (_, i) =>
    curved(lerp(-4.83, 4.83, i / segments), y, depth),
  );
  localPath(out, 'stone', path, width, width, color);
}

function balcony(out, bay, lod) {
  const u = bay.u,
    a = u - 0.64,
    b = u + 0.64,
    low = 7.18,
    head = 9.53;
  strip(out, 'stone', a - 0.16, b + 0.16, flat(low - 0.08), flat(head + 0.2), 0.07, c.soap, 2);
  strip(out, 'timber', a, b, flat(low), flat(head), 0.088, c.wood, 2);
  if (lod > 0) {
    strip(out, 'glass', a + 0.11, b - 0.11, flat(8.37), flat(head - 0.1), 0.1, c.glass, 2);
    strip(out, 'stone', a - 0.2, b + 0.2, flat(low - 0.2), flat(low - 0.04), 0.24, c.band, 2);
    for (const y of [low + 0.035, low + 0.66])
      localBeam(
        out,
        'stone',
        curved(a - 0.04, y, 0.3),
        curved(b + 0.04, y, 0.3),
        0.09,
        0.11,
        c.soap,
      );
    const posts = lod === 3 ? 7 : lod === 2 ? 5 : 3;
    for (let i = 0; i < posts; i++) {
      const x = lerp(a, b, i / (posts - 1));
      localBeam(
        out,
        'stone',
        curved(x, low, 0.293),
        curved(x, low + 0.66, 0.293),
        0.09,
        0.09,
        c.band,
      );
    }
  }
}

const pedimentHalf = [
  [0, 15.23],
  [0.57, 15.12],
  [1.09, 14.88],
  [1.63, 14.52],
  [2.07, 14.04],
  [2.38, 13.49],
  [2.67, 13.17],
  [3.07, 13.14],
  [3.41, 13.32],
  [3.73, 13.28],
  [4.08, 12.89],
  [4.47, 12.39],
  [4.88, 12.25],
];
const pedimentOutline = [
  ...pedimentHalf
    .slice(1)
    .reverse()
    .map(([x, y]) => [-x, y]),
  ...pedimentHalf,
];

function cross(out, u, y, v, size, lod) {
  localBeam(out, 'stone', [u, y, v], [u, y + size, v], 0.16 * size, 0.13 * size, c.soap);
  localBeam(
    out,
    'stone',
    [u - size * 0.32, y + size * 0.67, v],
    [u + size * 0.32, y + size * 0.67, v],
    0.13 * size,
    0.13 * size,
    c.soap,
  );
  if (lod > 1)
    stacked(
      out,
      'stone',
      [u, v],
      [
        [y - 0.24, size * 0.26],
        [y - 0.035, size * 0.22],
        [y + 0.04, size * 0.16],
      ],
      10,
      c.band,
    );
}

function pediment(out, lod) {
  const profile = lod === 0 ? pedimentOutline.filter((_, i) => i % 2 === 0) : pedimentOutline;
  for (let i = 1; i < profile.length; i++) {
    const [u, y] = profile[i - 1],
      [v, h] = profile[i];
    for (const [d, sign] of [
      [0, 1],
      [-0.42, -1],
    ])
      face(
        out,
        'plaster',
        [curved(u, 11.2, d), curved(v, 11.2, d), curved(v, h, d), curved(u, y, d)],
        [0, 0, sign],
        c.lime,
      );
    face(
      out,
      'stone',
      [curved(u, y), curved(v, h), curved(v, h, -0.42), curved(u, y, -0.42)],
      up,
      c.soap,
    );
  }
  if (lod > 0) {
    localPath(
      out,
      'stone',
      profile.map(([x, y]) => curved(x, y, 0.052)),
      0.19,
      0.22,
      c.soap,
    );
    localPath(
      out,
      'stone',
      profile.map(([x, y]) => curved(x, y - 0.19, 0.036)),
      0.068,
      0.09,
      c.band,
    );
    const n = lod === 1 ? 8 : lod === 2 ? 14 : 22;
    const disk = Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      const u = 0.5 * Math.cos(a),
        y = 13.03 + 0.65 * Math.sin(a);
      return curved(u, y, 0.109);
    });
    face(out, 'paint', disk, [0, 0, 1], c.shade);
    localPath(
      out,
      'stone',
      disk.map(([x, y]) => curved(x, y, 0.13)),
      0.14,
      0.17,
      c.soap,
      true,
    );
  }
  cross(out, 0, 15.3, bowed(0) - 0.11, 1.33, lod);
}

function bowedFront(out, lod) {
  const width = 5.04;
  let last = -width;
  for (const bay of bays) {
    strip(
      out,
      'plaster',
      last,
      bay.u - bay.half,
      flat(floor),
      flat(6.03),
      0,
      c.lime,
      lod === 0 ? 1 : 3,
    );
    entranceArch(out, bay, lod);
    last = bay.u + bay.half;
  }
  strip(out, 'plaster', last, width, flat(floor), flat(6.03), 0, c.lime, lod === 0 ? 1 : 3);
  strip(out, 'plaster', -width, width, flat(6.03), flat(11.35), 0, c.lime, lod === 0 ? 3 : 16);
  // Return wall and tile apron close the vestibule and meet the main nave roof.
  for (const side of [-1, 1]) {
    const u = side * width,
      v = bowed(u);
    face(
      out,
      'plaster',
      [
        [u, floor, v],
        [u, floor, -6.25],
        [u, 11.35, -6.25],
        [u, 11.35, v],
      ],
      [side, 0, 0],
      c.shadedLime,
    );
  }
  const segments = lod === 0 ? 4 : 14;
  for (let i = 0; i < segments; i++) {
    const a = lerp(-width, width, i / segments),
      b = lerp(-width, width, (i + 1) / segments);
    face(
      out,
      'tile',
      [curved(a, 11.29, -0.12), curved(b, 11.29, -0.12), [b, 11.51, -6.46], [a, 11.51, -6.46]],
      up,
      c.tile,
    );
  }
  if (lod > 0) {
    for (const y of [6.04, 6.28, 10.99, 11.38])
      facadeMolding(out, y, 0.085, y === 11.38 ? 0.23 : 0.145, lod, c.soap);
    for (const u of [-4.23, -1.3, 1.3, 4.23]) {
      strip(out, 'stone', u - 0.12, u + 0.12, flat(floor + 0.02), flat(5.97), 0.09, c.band);
      strip(out, 'stone', u - 0.12, u + 0.12, flat(6.23), flat(10.89), 0.092, c.band);
    }
  }
  for (const bay of bays) balcony(out, bay, lod);
  pediment(out, lod);
}

function belfryWindow(out, center, radius, angle, lod) {
  const half = 0.55,
    lo = 12.34,
    spring = 13.78,
    rise = 0.56;
  const p = (x, y, d) => [
    center[0] + (radius + d) * Math.cos(angle + x / radius),
    y,
    center[1] + (radius + d) * Math.sin(angle + x / radius),
  ];
  const n = [Math.cos(angle), 0, Math.sin(angle)];
  for (const [slot, d, a, b, bottom, y, color] of [
    ['stone', 0.069, -half - 0.12, half + 0.12, lo - 0.15, spring, c.soap],
    ['paint', 0.086, -half, half, lo, spring, c.shade],
  ])
    face(out, slot, [p(a, bottom, d), p(b, bottom, d), p(b, y, d), p(a, y, d)], n, color);
  const pieces = lod > 1 ? 9 : 5;
  for (let i = 0; i < pieces; i++) {
    const a = (i * Math.PI) / pieces,
      b = ((i + 1) * Math.PI) / pieces;
    const q = (a, r, d) => p((half + r) * Math.cos(a), spring + (rise + r) * Math.sin(a), d);
    face(
      out,
      'stone',
      [q(a, 0, 0.086), q(a, 0.13, 0.086), q(b, 0.13, 0.086), q(b, 0, 0.086)],
      n,
      c.soap,
    );
    face(out, 'paint', [p(0, spring, 0.085), q(a, 0, 0.086), q(b, 0, 0.086)], n, c.shade);
  }
  if (lod > 1) {
    const pos = p(0, 0, 0.115);
    stacked(
      out,
      'bronze',
      [pos[0], pos[2]],
      [
        [12.57, 0.37],
        [12.7, 0.32],
        [13.08, 0.24],
        [13.31, 0.15],
        [13.47, 0.11],
      ],
      lod === 3 ? 10 : 8,
      c.bronze,
    );
  }
}

function bellTower(out, tower, lod) {
  const { center, radius } = tower;
  const sides = [7, 14, 26, 36][lod];
  const outline = radialRing(0, radius, radius, sides, center).map(([u, , v]) => [u, v]);
  const normals = edgeNormals(outline);
  wallRing(
    out,
    outline,
    normals,
    (u, v) => Math.min(grade(u, v) - 0.36, floor - 0.27),
    flat(floor + 0.17),
    'base',
    c.podium,
  );
  wallRing(
    out,
    outline,
    normals,
    flat(floor + 0.17),
    flat(towerCorniceEstimate),
    'plaster',
    c.lime,
  );
  const offsets =
    lod === 0
      ? [11.94, towerCorniceEstimate - 0.25]
      : [0.78, 6.33, 11.94, towerCorniceEstimate - 0.25];
  for (const y of offsets)
    stacked(
      out,
      'stone',
      center,
      [
        [y, radius],
        [y + 0.13, radius + 0.14],
        [y + 0.26, radius + 0.135],
      ],
      sides,
      c.band,
    );
  const domeProfile = [
    [towerCorniceEstimate - 0.05, radius + 0.075],
    [15.61, radius + 0.08],
    [15.91, radius * 0.95],
    [16.27, radius * 0.86],
    [16.68, radius * 0.73],
    [17.04, radius * 0.56],
    [17.38, radius * 0.42],
    [17.64, radius * 0.28],
    [17.96, radius * 0.18],
  ];
  const dome =
    lod === 0
      ? [domeProfile[0], domeProfile[4], domeProfile[6], domeProfile.at(-1)]
      : lod === 1
        ? domeProfile.filter((_, i) => i % 2 === 0)
        : domeProfile;
  stacked(out, 'stone', center, dome, sides, c.crown);
  stacked(
    out,
    'stone',
    center,
    lod === 0
      ? [
          [17.95, 0.49],
          [18.32, 0.27],
          [towerCrownEstimate, 0.055],
        ]
      : [
          [17.95, 0.49],
          [18.11, 0.46],
          [18.31, 0.31],
          [18.57, 0.23],
          [towerCrownEstimate, 0.055],
        ],
    lod === 0 ? 6 : 12,
    c.soap,
  );
  const angles =
    lod === 0
      ? [Math.PI / 2]
      : lod === 1
        ? [0, Math.PI / 2, Math.PI]
        : [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (const angle of angles) belfryWindow(out, center, radius, angle, lod);
}

function forecourt(out, lod) {
  const steps = lod === 0 ? 2 : 7;
  const increment = lod === 0 ? 0.58 : 0.17;
  const reach = lod === 0 ? 1.04 : 0.32;
  const segments = lod === 0 ? 4 : lod + 9;
  const halfWidth = (i) => 5.23 + (0.63 * i) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const half = halfWidth(i),
      inner = i === 0 ? half : halfWidth(i - 1);
    const y = floor - increment * i,
      v = 1.0 + reach * i;
    const inside = i === 0 ? -0.34 : v - reach;
    const low = i === steps - 1 ? y - 0.26 : y - increment;
    for (let k = 0; k < segments; k++) {
      const p = k / segments,
        q = (k + 1) / segments;
      const a = lerp(-half, half, p),
        b = lerp(-half, half, q);
      const u = lerp(-inner, inner, p),
        w = lerp(-inner, inner, q);
      const slope = (u) => Math.min(y - 0.09, grade(u, bowed(u) + v) - 0.09, low);
      face(
        out,
        'base',
        [curved(u, y, inside), curved(w, y, inside), curved(b, y, v), curved(a, y, v)],
        up,
        c.paving,
      );
      face(
        out,
        'base',
        [curved(a, slope(a), v), curved(b, slope(b), v), curved(b, y, v), curved(a, y, v)],
        [0, 0, 1],
        c.podium,
      );
    }
    if (lod > 0)
      for (const sign of [-1, 1]) {
        const left = sign * inner,
          right = sign * half;
        const bottom = Math.min(y - 0.06, grade(left, bowed(left) + inside) - 0.1);
        const toe = Math.min(y - 0.06, grade(right, bowed(right) + v) - 0.1);
        face(
          out,
          'base',
          [
            curved(left, bottom, inside),
            curved(right, toe, v),
            curved(right, y, v),
            curved(left, y, inside),
          ],
          [sign, 0, 0],
          c.podium,
        );
      }
  }
}

function draw(out, lod) {
  const rear = { center: [0.15, -42.0], eaveY: 7.46, roofRidgeY: 10.3 };
  hull(out, naveline, nave, lod, [
    [3, 6.65, 0.95],
    [5, 6.65, 0.95],
    [8, 6.71, 0.92],
    [10, 6.71, 0.92],
  ]);
  hull(out, chanceline, chancel, lod, [
    [3, 5.78, 0.89],
    [5, 5.78, 0.94],
    [8, 5.78, 0.89],
    [10, 5.78, 0.94],
  ]);
  hull(out, annexline, rear, lod, [
    [0, 5.15, 0.83],
    [2, 5.1, 0.83],
  ]);
  forecourt(out, lod);
  bowedFront(out, lod);
  for (const tower of towers) bellTower(out, tower, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [48, 29, 53],
  lookAt = [-5.0, 7, 0.0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Rosário church in Ouro Preto with a curved three-arched façade, paired round bell towers and interlocking oval tile roofs.',
  camera,
  lookAt,
  sunDirection: [119, 109, 41],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.52,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'largo-do-rosario-three-arched-front',
      position: [41, 7.6, 27.3],
      lookAt: [10.1, 8.2, 7.1],
    },
    {
      name: 'rounded-bell-towers-on-the-hillside',
      position: [12, 14.2, 48],
      lookAt: [3, 8.7, 3.5],
    },
    { name: 'double-oval-nave-and-chancel', position: [-47, 35, 18], lookAt: [-7, 8.2, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.08,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.89, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independently modeled from the named map outline, unmodified public terrain samples and written municipal and architectural records.',
};
