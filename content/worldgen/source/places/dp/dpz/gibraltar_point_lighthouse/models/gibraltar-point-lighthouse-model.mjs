import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  ring,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  stone: surface('wall', 'stone_limestone_weathered', 0.95),
  trim: surface('trim', 'stone_ashlar'),
  iron: surface('trim', 'metal_painted', 0.78, 0.22),
  cap: surface('roof', 'metal_painted', 0.78, 0.22),
  door: surface('door', 'wood_plain'),
  glass: surface('window', 'window_punched'),
};
const C = palette({
  stone: 'b1aa9b',
  stoneShade: 'a69f8e',
  upperStone: 'bdb4a6',
  trim: 'c3b9a9',
  recess: '81786a',
  deepRecess: '474443',
  iron: '963f36',
  ironWear: '8c4b42',
  ironShadow: '693c36',
  glass: '8d9590',
});
const invert = (normal) => normal.map((x) => -x);
const [down, origin] = [
  [0, -1, 0],
  [0, 0],
];

function shaftPoint(a, b, u, y, scale, depth, normal) {
  return [
    mix(a[0], b[0], u) * scale + normal[0] * depth,
    y,
    mix(a[1], b[1], u) * scale + normal[2] * depth,
  ];
}

function opening(out, lod, point, wall, direction, tone, style) {
  const [low, high, left, right] = wall;
  const { base, spring, width, rise, door } = style;
  const middle = (left + right) * 0.5;
  const a = middle - width * 0.5;
  const b = middle + width * 0.5;
  const front = (u, y) => point(u, y, 0);
  const quad = (slot, bounds, depth, tint) => {
    const [l, n, f, t] = bounds;
    face(
      out,
      slot,
      [point(l, f, depth), point(n, f, depth), point(n, t, depth), point(l, t, depth)],
      direction,
      tint,
    );
  };
  if (lod === 0) {
    quad('stone', [left, right, low, high], 0, tone);
    quad(door ? 'door' : 'glass', [a, b, base, spring + rise], 0.018, door ? C.iron : C.deepRecess);
    return;
  }
  for (const bounds of [
    [left, a, low, high],
    [b, right, low, high],
    [a, b, low, base],
  ])
    quad('stone', bounds, 0, tone);

  const steps = rise ? [0, 4, 6, 10][lod] : 1;
  const arch = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [mix(a, b, t), spring + rise * Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)))];
  });
  const depth = lod === 1 ? -0.11 : -0.21;
  const slot = door ? 'door' : 'glass';
  const tint = door ? C.iron : C.deepRecess;
  for (const [[x, y], [n, h]] of pairs(arch)) {
    face(out, 'stone', [front(x, y), front(n, h), front(n, high), front(x, high)], direction, tone);
    face(
      out,
      'trim',
      [front(x, y), front(n, h), point(n, h, depth), point(x, y, depth)],
      down,
      C.recess,
    );
    face(
      out,
      slot,
      [point(x, base, depth), point(n, base, depth), point(n, h, depth), point(x, y, depth)],
      direction,
      tint,
    );
  }
  const across = [-direction[2], 0, direction[0]];
  for (const [u, normal] of [
    [a, across],
    [b, invert(across)],
  ])
    face(
      out,
      'trim',
      [front(u, base), front(u, spring), point(u, spring, depth), point(u, base, depth)],
      normal,
      C.recess,
    );
  const sill = [
    [a, base, depth],
    [b, base, depth],
    [b, base, 0.06],
    [a, base, 0.06],
  ];
  face(
    out,
    'trim',
    sill.map((p) => point(...p)),
    up,
    C.trim,
  );
  if (lod === 1) return;
  const casing = [[a - 0.025, base], ...arch, [b + 0.025, base]];
  beamPath(
    out,
    'trim',
    casing.map(([u, y]) => point(u, y, 0.026)),
    0.11,
    0.095,
    C.trim,
  );
  if (door && lod === 3) {
    for (let i = 1; i < 7; i++) {
      const u = mix(a, b, i / 7);
      beamPath(
        out,
        'door',
        [point(u, base + 0.055, depth + 0.015), point(u, spring - 0.03, depth + 0.015)],
        0.019,
        0.018,
        C.ironShadow,
      );
    }
    beamPath(
      out,
      'iron',
      [point(b - 0.035, base + 0.78, depth + 0.03), point(b - 0.035, base + 0.93, depth + 0.09)],
      0.042,
      0.042,
      C.ironShadow,
    );
  }
}

function masonry(out, lod, d, grade) {
  const { outline, stoneHeightMeters: top, taperBreakMeters: taper } = d;
  const scaleAt = (y) => mix(1, 0.735, Math.max(0, Math.min(1, y / taper)));
  const dir = areaSign(outline);
  const gradeBase = Math.min(...outline.map(grade)) - 0.31;
  const openings = new Map([
    [d.doorFace, [{ base: 0.13, spring: 1.87, width: 0.38, rise: 0.34, door: true }]],
    [0, [{ base: 6.12, spring: 7.12, width: 0.148, rise: 0 }]],
    [3, [{ base: 10.42, spring: 11.42, width: 0.15, rise: 0 }]],
    [4, [{ base: 16.68, spring: 17.96, width: 0.17, rise: 0 }]],
  ]);
  for (const [[a, b], i] of pairs(closed(outline)).map((pair, i) => [pair, i])) {
    const { normal } = edge(a, b, dir);
    const point = (u, y, depth = 0) => shaftPoint(a, b, u, y, scaleAt(y), depth, normal);
    const sections = [
      [gradeBase, taper],
      [taper, top - 0.03],
    ];
    for (const [low, high] of sections) {
      const tone = high > taper ? C.upperStone : i % 2 ? C.stoneShade : C.stone;
      const gap = openings.get(i)?.find((g) => g.base > low && g.spring + g.rise < high);
      if (gap) opening(out, lod, point, [low, high, 0, 1], normal, tone, gap);
      else
        face(
          out,
          'stone',
          [point(0, low), point(1, low), point(1, high), point(0, high)],
          normal,
          tone,
        );
    }
    if (lod < 2) continue;
    const u = 0.045;
    const levels = lod === 3 ? 31 : 15;
    for (let j = 0; j < levels; j++) {
      const y = 0.36 + (15 * (j + 0.4)) / levels;
      const l = j % 2 === 0 ? u * 0.85 : u * 1.55;
      face(
        out,
        'trim',
        [
          point(0, y, 0.012),
          point(l, y, 0.012),
          point(l, y + 0.055, 0.012),
          point(0, y + 0.055, 0.012),
        ],
        normal,
        C.recess,
      );
    }
  }
}

function polygonBands(out, slot, shape, bands, tone) {
  const sign = areaSign(shape);
  for (const [a, b] of pairs(closed(shape))) {
    const { normal } = edge(a, b, sign);
    for (const [[y, r], [h, s]] of pairs(bands))
      face(
        out,
        slot,
        [
          [a[0] * r, y, a[1] * r],
          [b[0] * r, y, b[1] * r],
          [b[0] * s, h, b[1] * s],
          [a[0] * s, h, a[1] * s],
        ],
        y === h ? (s < r ? up : down) : normal,
        tone,
      );
  }
}

function crown(out, lod, d) {
  const gallery = d.stoneHeightMeters;
  const outline = d.outline;
  const roofBase = 22.36;
  const roofPoint = 23.34;
  const finish = d.overallHeightMeters;
  const band = (slot, rs, tone) => polygonBands(out, slot, outline, rs, tone);
  band(
    'trim',
    [
      [gallery - 0.41, 0.733],
      [gallery - 0.14, 0.78],
      [gallery, 0.78],
    ],
    C.trim,
  );
  band(
    'iron',
    [
      [gallery - 0.15, 0.77],
      [gallery + 0.04, 0.97],
      [gallery + 0.22, 0.97],
    ],
    C.ironShadow,
  );
  face(
    out,
    'iron',
    outline.map(([x, z]) => [x * 0.97, gallery + 0.22, z * 0.97]),
    up,
    C.ironWear,
  );

  const lantern = outline.map(([x, z]) => [x * 0.635, z * 0.635]);
  polygonBands(
    out,
    'iron',
    lantern,
    [
      [gallery + 0.22, 1],
      [gallery + 0.6, 1],
      [gallery + 0.7, 0.98],
    ],
    C.iron,
  );
  const sign = areaSign(lantern);
  for (const [a, b] of pairs(closed(lantern))) {
    const w = edge(a, b, sign);
    const p = (u, y, depth = 0) => w.p(u * w.length, y, depth);
    face(
      out,
      'glass',
      [p(0, gallery + 0.61), p(1, gallery + 0.61), p(1, roofBase), p(0, roofBase)],
      w.normal,
      C.glass,
    );
    const railHeights = lod === 0 ? [roofBase] : [gallery + 0.68, gallery + 1.11, roofBase];
    for (const y of railHeights)
      beamPath(out, 'iron', [p(0, y, 0.028), p(1, y, 0.028)], 0.089, 0.105, C.iron);
    if (lod > 0) {
      for (const u of lod === 1 ? [0] : [0, 0.34, 0.67])
        beamPath(
          out,
          'iron',
          [p(u, gallery + 0.64, 0.02), p(u, roofBase, 0.02)],
          0.088,
          0.089,
          C.ironShadow,
        );
    }
  }
  band(
    'iron',
    [
      [roofBase - 0.065, 0.646],
      [roofBase - 0.065, 0.726],
      [roofBase + 0.05, 0.726],
    ],
    C.iron,
  );
  const dome =
    lod === 0
      ? [
          [roofBase + 0.05, 0.726],
          [roofPoint, 0.084],
        ]
      : [
          [roofBase + 0.05, 0.726],
          [roofBase + 0.32, 0.64],
          [roofBase + 0.65, 0.42],
          [roofPoint, 0.084],
        ];
  band('cap', dome, C.iron);
  if (lod === 3) {
    for (const [x, z] of outline)
      beamPath(
        out,
        'iron',
        dome.map(([y, s]) => [x * s, y + 0.022, z * s]),
        0.038,
        0.043,
        C.ironShadow,
      );
    band(
      'iron',
      [
        [roofPoint - 0.11, 0.09],
        [roofPoint, 0.092],
        [roofPoint + 0.09, 0.082],
      ],
      C.ironWear,
    );
  }
  ring(
    out,
    'iron',
    origin,
    [
      [roofPoint - 0.02, 0.235],
      [roofPoint + 0.23, 0.19],
      [roofPoint + 0.33, 0.105],
      [roofPoint + 0.51, 0.095],
      [finish, 0.018],
    ],
    lod === 0 ? 4 : 7,
    C.ironShadow,
  );
  if (lod === 3) {
    beamPath(
      out,
      'iron',
      [
        [-0.41, finish - 0.48, 0],
        [0.42, finish - 0.48, 0],
      ],
      0.04,
      0.04,
      C.ironShadow,
    );
    face(
      out,
      'iron',
      [
        [0.0, finish - 0.48, 0],
        [0.37, finish - 0.51, 0],
        [0.37, finish - 0.29, 0],
      ],
      [0, 0, 1],
      C.ironShadow,
    );
  }

  const balcony = outline.map(([x, z]) => [x * 0.942, z * 0.942]);
  for (const [a, b] of pairs(closed(balcony))) {
    const p = (u, y) => [mix(a[0], b[0], u), y, mix(a[1], b[1], u)];
    const rails = lod === 0 ? [1.18] : [0.32, 0.76, 1.18];
    for (const y of rails)
      beamPath(out, 'iron', [p(0, gallery + y), p(1, gallery + y)], 0.057, 0.062, C.iron);
    const n = [1, 3, 5, 7][lod];
    for (let i = 0; i < n; i++)
      beamPath(
        out,
        'iron',
        [p(i / n, gallery + 0.21), p(i / n, gallery + 1.18)],
        0.056,
        0.052,
        C.iron,
      );
  }
}

function build(out, lod, dimensions, grade) {
  masonry(out, lod, dimensions, grade);
  crown(out, lod, dimensions);
}

const structure = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Gibraltar Point Lighthouse as it stands on the Toronto Islands, with tapered six-sided Queenston stone, an open red gallery, glazed lantern, shaped metal cap and vane.',
    camera: [28, 15, 35],
    lookAt: [0, 12.15, 0],
    yaw: 0.56,
    sun: [300, 570, 610],
    views: [
      { name: 'entry-ashlar-and-taper', position: [24, 5.9, 4], lookAt: [0, 9.3, 0] },
      { name: 'red-gallery-and-lantern', position: [15, 21, 10], lookAt: [0, 21.1, 0] },
      { name: 'stone-shaft-and-window-faces', position: [-24, 15, 19], lookAt: [0, 12.8, 0] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = structure;
model.category = 'lighthouse';
model.wikidataId = 'Q5559191';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Replace only the named lighthouse stone footprint.',
};
