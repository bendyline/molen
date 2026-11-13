/** Great Lavra Bell Tower in its July 2013 appearance. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls'),
  section = plan.section;
const [mappedOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  gold: { slot: 'roof', graph: 'metal_bronze_cast', roughness: 0.42, metallic: 0.76 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63, metallic: 0.04 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'c4a452',
    upperWall: 'c9c1a0',
    stone: 'e2e2d5',
    shade: 'bdc3b6',
    foundation: '85877e',
    green: '7a9988',
    gold: 'd8bc68',
    darkGold: 'ae934c',
    glass: '506471',
    iron: '515958',
    door: '665c48',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const white = 'palette:#ffffff';
const up = [0, 1, 0];

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, v, i) => dot + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
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
      tint,
    );
}

function ring(radius, count = 8, center = [0, 0], rotation = section.rotation) {
  return Array.from({ length: count }, (_, i) => {
    const angle = rotation + (2 * Math.PI * i) / count;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  });
}
const at = ([x, z], y) => [x, y, z];
function sides(outline) {
  return outline.map(([x, z], i) => {
    const q = outline[(i + 1) % outline.length];
    const length = Math.hypot(q[0] - x, q[1] - z);
    const dx = (q[0] - x) / length,
      dz = (q[1] - z) / length;
    return {
      length,
      normal: [dz, 0, -dx],
      point: (u, y, depth = 0) => [x + dx * u + dz * depth, y, z + dz * u - dx * depth],
    };
  });
}
function panel(out, slot, e, from, to, bottom, top, depth, tint, inward = false) {
  face(
    out,
    slot,
    [
      e.point(from, bottom, depth),
      e.point(to, bottom, depth),
      e.point(to, top, depth),
      e.point(from, top, depth),
    ],
    e.normal.map((n) => (inward ? -n : n)),
    tint,
  );
}
function cap(out, slot, outline, y, tint) {
  for (let i = 1; i < outline.length - 1; i++) {
    face(out, slot, [at(outline[0], y), at(outline[i], y), at(outline[i + 1], y)], up, tint);
  }
}
function profile(out, slot, levels, tint, count = 8, center = [0, 0], capped = true) {
  for (let i = 1; i < levels.length; i++) {
    const [bottom, r0] = levels[i - 1],
      [top, r1] = levels[i];
    const lower = ring(r0, count, center),
      upper = ring(r1, count, center);
    for (const [j, e] of sides(lower).entries()) {
      const k = (j + 1) % count;
      const expected = top === bottom ? up : e.normal;
      face(
        out,
        slot,
        [at(lower[j], bottom), at(lower[k], bottom), at(upper[k], top), at(upper[j], top)],
        expected,
        tint,
      );
    }
  }
  if (capped) {
    const [y, radius] = levels.at(-1);
    cap(out, slot, ring(radius, count, center), y, tint);
  }
}
function ellipse(out, e, center, y, rx, ry, depth, tint, lod) {
  const count = lod >= 2 ? 16 : 8;
  const points = Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count;
    return e.point(center + rx * Math.cos(a), y + ry * Math.sin(a), depth);
  });
  for (let i = 0; i < count; i++) {
    face(
      out,
      'glass',
      [e.point(center, y, depth), points[i], points[(i + 1) % count]],
      e.normal,
      tint,
    );
  }
}
function closedWindow(out, e, u, y, w, h, lod, tint = colors.glass) {
  if (lod) {
    panel(
      out,
      'stone',
      e,
      u - w / 2 - 0.19,
      u + w / 2 + 0.19,
      y - 0.19,
      y + h + 0.19,
      0.045,
      colors.stone,
    );
  }
  panel(out, 'glass', e, u - w / 2, u + w / 2, y, y + h, 0.064, tint);
  if (lod >= 2) {
    panel(out, 'iron', e, u - 0.045, u + 0.045, y, y + h, 0.08, colors.iron);
    for (const f of [0.33, 0.66]) {
      panel(out, 'iron', e, u - w / 2, u + w / 2, y + h * f, y + h * f + 0.07, 0.08, colors.iron);
    }
  }
}
function column(out, xz, bottom, top, radius, lod, capital = false) {
  const count = lod === 1 ? 4 : lod === 2 ? 8 : 12;
  if (lod === 1) {
    profile(
      out,
      'stone',
      [
        [bottom, radius * 1.07],
        [top, radius * 0.96],
      ],
      colors.stone,
      4,
      xz,
    );
    return;
  }
  const shaft = [
    [bottom + 0.52, radius * 1.04],
    [top - 0.65, radius * 0.87],
  ];
  profile(out, 'stone', shaft, colors.stone, count, xz, false);
  profile(
    out,
    'stone',
    [
      [bottom, radius * 1.31],
      [bottom + 0.28, radius * 1.31],
      [bottom + 0.52, radius * 1.04],
    ],
    colors.shade,
    count,
    xz,
  );
  profile(
    out,
    'stone',
    [
      [top - 0.65, radius * 0.87],
      [top - 0.28, radius * 1.18],
      [top, radius * 1.35],
    ],
    colors.stone,
    count,
    xz,
  );
  if (capital && lod >= 2) {
    profile(
      out,
      'gold',
      [
        [top - 0.65, radius * 0.96],
        [top - 0.24, radius * 1.2],
      ],
      colors.gold,
      count,
      xz,
    );
  }
}

function basePortal(out, e, u, lod) {
  if (!lod) {
    closedWindow(out, e, u, 2.2, 1.6, 5.3, lod, colors.door);
    return;
  }
  const base = 2.0,
    spring = 6.1,
    rise = 1.02,
    half = 0.89;
  const arc = (i, count, width, height, offset) => {
    const angle = (Math.PI * i) / count;
    return e.point(u - width * Math.cos(angle), spring + height * Math.sin(angle), offset);
  };
  panel(
    out,
    'stone',
    e,
    u - half - 0.24,
    u + half + 0.24,
    base - 0.12,
    spring,
    0.045,
    colors.stone,
  );
  panel(out, 'glass', e, u - half, u + half, base, spring, 0.071, colors.door);
  const count = lod === 1 ? 6 : 10;
  for (let i = 1; i <= count; i++) {
    const a = arc(i - 1, count, half, rise, 0.071),
      b = arc(i, count, half, rise, 0.071);
    face(out, 'glass', [e.point(u, spring, 0.071), a, b], e.normal, colors.door);
    face(
      out,
      'stone',
      [
        a,
        b,
        arc(i, count, half + 0.24, rise + 0.24, 0.071),
        arc(i - 1, count, half + 0.24, rise + 0.24, 0.071),
      ],
      e.normal,
      colors.stone,
    );
  }
  if (lod >= 2) {
    for (const y of [spring - 0.22, 7.66]) {
      beam(
        out,
        'stone',
        e.point(u - 1.22, y, 0.13),
        e.point(u + 1.22, y, 0.13),
        0.17,
        0.19,
        colors.stone,
      );
    }
  }
}

function base(out, lod) {
  profile(
    out,
    'stone',
    [
      [section.bottom, 14.65],
      [0.52, 14.65],
    ],
    colors.foundation,
  );
  profile(
    out,
    'ashlar',
    [
      [0.52, 14.5],
      [13.2, 14.5],
    ],
    colors.wall,
  );
  for (const e of sides(ring(14.5))) {
    basePortal(out, e, e.length / 2, lod);
    if (lod) {
      ellipse(out, e, e.length / 2, 10.05, 1.15, 0.79, 0.065, colors.stone, lod);
      ellipse(out, e, e.length / 2, 10.05, 0.77, 0.52, 0.078, colors.glass, lod);
    }
  }
  profile(
    out,
    'stone',
    lod
      ? [
          [12.65, 14.54],
          [12.9, 15.0],
          [13.34, 15.0],
          [13.75, 13.62],
          [14.1, 13.62],
          [14.4, 13.9],
        ]
      : [
          [13.2, 14.5],
          [13.7, 14.95],
          [14.4, 13.9],
        ],
    colors.stone,
  );
  profile(
    out,
    'iron',
    [
      [14.4, 13.9],
      [15.7, 13.55],
    ],
    colors.green,
  );
}

function lowerColonnade(out, lod) {
  const stage = section.lowerColonnade;
  profile(
    out,
    'wall',
    [
      [stage.bottom - 0.6, stage.radius],
      [stage.top, stage.radius],
    ],
    colors.wall,
  );
  for (const e of sides(ring(stage.radius))) {
    const middle = e.length / 2;
    closedWindow(out, e, middle, 20.0, 1.63, 6.6, lod);
    if (lod) {
      closedWindow(out, e, middle, 29.0, 0.94, 1.1, 0, colors.iron);
      for (const f of [0.12, 0.3, 0.7, 0.88]) {
        const p = e.point(e.length * f, 0, 0.55);
        column(out, [p[0], p[2]], stage.bottom, stage.top, 0.58, lod);
      }
    } else {
      for (const f of [0.2, 0.8]) {
        panel(
          out,
          'stone',
          e,
          e.length * f - 0.46,
          e.length * f + 0.46,
          stage.bottom,
          stage.top,
          0.06,
          colors.stone,
        );
      }
    }
  }
}

function openArch(out, e, stage, lod, tint = colors.wall) {
  const u = e.length / 2,
    half = stage.opening / 2,
    base = stage.bottom;
  const start = u - half,
    end = u + half,
    depth = stage.depth;
  const archCount = lod === 0 ? 2 : lod === 1 ? 4 : 8;
  for (const [a, b] of [
    [0, start],
    [end, e.length],
  ]) {
    panel(out, 'wall', e, a, b, base, stage.top, 0, tint);
    if (lod) panel(out, 'wall', e, a, b, base, stage.top, -depth, colors.shade, true);
  }
  for (const [v, direction] of [
    [start, 1],
    [end, -1],
  ]) {
    const tangent = [
      e.point(v + direction, 0)[0] - e.point(v, 0)[0],
      0,
      e.point(v + direction, 0)[2] - e.point(v, 0)[2],
    ];
    face(
      out,
      'stone',
      [
        e.point(v, base),
        e.point(v, stage.spring),
        e.point(v, stage.spring, -depth),
        e.point(v, base, -depth),
      ],
      tangent,
      colors.shade,
    );
  }
  const arch = (i) => {
    const a = (Math.PI * i) / archCount;
    return [u - half * Math.cos(a), stage.spring + (stage.head - stage.spring) * Math.sin(a)];
  };
  for (let i = 1; i <= archCount; i++) {
    const [a, ya] = arch(i - 1),
      [b, yb] = arch(i);
    face(
      out,
      'wall',
      [e.point(a, ya), e.point(b, yb), e.point(b, stage.top), e.point(a, stage.top)],
      e.normal,
      tint,
    );
    if (lod)
      face(
        out,
        'wall',
        [
          e.point(a, ya, -depth),
          e.point(b, yb, -depth),
          e.point(b, stage.top, -depth),
          e.point(a, stage.top, -depth),
        ],
        e.normal.map((n) => -n),
        colors.shade,
      );
    face(
      out,
      'stone',
      [e.point(a, ya), e.point(b, yb), e.point(b, yb, -depth), e.point(a, ya, -depth)],
      [0, -1, 0],
      colors.shade,
    );
    if (lod >= 2) {
      const trim = 0.24;
      face(
        out,
        'stone',
        [
          e.point(a, ya, 0.035),
          e.point(b, yb, 0.035),
          e.point(b, yb + trim, 0.035),
          e.point(a, ya + trim, 0.035),
        ],
        e.normal,
        colors.stone,
      );
    }
  }
}
function belfry(out, stage, lod, upper) {
  profile(
    out,
    'stone',
    [
      [stage.bottom - 0.42, stage.radius + 0.3],
      [stage.bottom, stage.radius + 0.3],
    ],
    colors.shade,
  );
  cap(out, 'stone', ring(stage.radius), stage.top, colors.shade);
  for (const e of sides(ring(stage.radius))) {
    openArch(out, e, stage, lod, upper ? colors.upperWall : colors.wall);
    if (lod) {
      const fractions = upper ? [0.09, 0.24, 0.76, 0.91] : [0.13, 0.87];
      for (const f of fractions) {
        const p = e.point(e.length * f, 0, 0.52);
        column(out, [p[0], p[2]], stage.bottom, stage.top, upper ? 0.43 : 0.5, lod, upper);
      }
    } else {
      for (const f of [0.12, 0.88]) {
        panel(
          out,
          'stone',
          e,
          e.length * f - 0.36,
          e.length * f + 0.36,
          stage.bottom,
          stage.top,
          0.05,
          colors.stone,
        );
      }
    }
  }
}

function terrace(out, bottom, top, radius, lod, walkway) {
  const rise = top - bottom;
  const bands = lod
    ? [
        [bottom, radius],
        [bottom + rise * 0.12, radius + 0.65],
        [bottom + rise * 0.3, radius + 0.65],
        [bottom + rise * 0.42, radius + 1.03],
        [bottom + rise * 0.57, radius + 1.03],
        [bottom + rise * 0.73, radius + 0.35],
        [top, radius - 0.6],
      ]
    : [
        [bottom, radius],
        [bottom + rise * 0.5, radius + 0.85],
        [top, radius - 0.6],
      ];
  profile(out, 'stone', bands, colors.stone);
  if (!lod) return;
  for (const e of sides(ring(radius + 0.42))) {
    const y = bottom + rise * 0.55;
    const n = lod === 3 ? 12 : lod === 2 ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const u = (e.length * (i + 0.5)) / n;
      panel(out, 'iron', e, u - 0.1, u + 0.1, y, y + 0.53, 0.07, colors.iron);
    }
  }
  if (lod < 2 || !walkway) return;
  for (const e of sides(ring(radius - 0.74))) {
    for (const y of [top + 0.12, top + 0.96]) {
      beam(out, 'iron', e.point(0, y), e.point(e.length, y), 0.1, 0.12, colors.iron);
    }
    const count = lod === 3 ? 12 : 9;
    for (let i = 0; i <= count; i++) {
      const u = (e.length * i) / count;
      beam(out, 'iron', e.point(u, top), e.point(u, top + 0.96), 0.07, 0.08, colors.iron);
    }
  }
}
function dome(out, lod) {
  const count = [8, 16, 24, 32][lod];
  const bands =
    lod === 0
      ? [
          [82.1, 7.75],
          [84.6, 6.9],
          [87.0, 4.05],
          [88.6, 1.9],
        ]
      : [
          [82.1, 7.75],
          [83.5, 7.42],
          [85, 6.42],
          [86.5, 4.95],
          [87.7, 3.23],
          [88.6, 1.9],
        ];
  profile(out, 'gold', bands, colors.gold, count);
  const lantern = {
    bottom: 88.6,
    top: 91.8,
    radius: 1.7,
    opening: 0.75,
    spring: 90.6,
    head: 91.3,
    depth: 0.22,
  };
  for (const e of sides(ring(lantern.radius))) {
    openArch(out, e, lantern, lod);
  }
  profile(
    out,
    'gold',
    [
      [91.8, 1.85],
      [92.1, 2.04],
      [92.7, 1.4],
      [93.2, 0.8],
      [93.7, 0.31],
    ],
    colors.gold,
    lod ? 16 : 8,
  );
  beam(
    out,
    'gold',
    [0, 93.6, 0],
    [0, section.crossTop, 0],
    lod ? 0.16 : 0.22,
    lod ? 0.16 : 0.22,
    colors.gold,
  );
  beam(out, 'gold', [-0.83, 95.65, 0], [0.83, 95.65, 0], 0.14, 0.14, colors.gold);
  if (lod) beam(out, 'gold', [-0.51, 94.56, 0], [0.51, 94.78, 0], 0.11, 0.11, colors.gold);
}
function bell(out, lod) {
  if (lod < 2) return;
  profile(
    out,
    'gold',
    [
      [41.8, 1.6],
      [42.02, 1.65],
      [42.5, 1.28],
      [44.1, 0.76],
      [44.8, 0.31],
    ],
    colors.darkGold,
    16,
  );
  for (const z of [-0.72, 0.72])
    beam(out, 'iron', [-6.4, 45.2, z], [6.4, 45.2, z], 0.32, 0.34, colors.iron);
  beam(out, 'iron', [0, 44.8, 0], [0, 45.2, 0], 0.24, 0.24, colors.iron);
}
function build(out, lod) {
  base(out, lod);
  lowerColonnade(out, lod);
  terrace(out, 32.0, 36.2, 12.7, lod, true);
  belfry(out, section.bellStage, lod, false);
  terrace(out, 53.4, 57.7, 10.0, lod, true);
  belfry(out, section.upperStage, lod, true);
  terrace(out, 75.6, 80.2, 8.3, lod);
  profile(
    out,
    'wall',
    [
      [80.2, 7.4],
      [82.1, 7.4],
    ],
    colors.wall,
  );
  dome(out, lod);
  bell(out, lod);
}

export const lavraSkyline = (out) => build(out, 0);
export const lavraDistrict = (out) => build(out, 1);
export const lavraStreet = (out) => build(out, 2);
export const lavraCloseup = (out) => build(out, 3);
const recipe = 'lavra-belltower-model.mjs',
  camera = [101, 72, 140],
  lookAt = [0, 45, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'lavraDistrict', 0.31],
    ['street', 'lavraStreet', 0.13],
    ['closeup', 'lavraCloseup', 0.045],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const lavraTowerModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: lavraCloseup,
  category: 'tower',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Great Lavra Bell Tower in July 2013, with an ochre masonry base, diminishing white colonnades, open belfries, broad cornices and a gilded dome.',
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
    outline: mappedOutline,
    minimumCoverage: 0.92,
    basis: 'The named mapped tower footprint from OSM way 81247740.',
  },
  mediumFiContext: {
    scale: 0.78,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'stone_limestone_raw',
    'metal_bronze_cast',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'lower-colonnade-and-masonry-base', position: [47, 20, 44], lookAt: [0, 19, 0] },
    { name: 'open-bell-stages-and-terraces', position: [47, 54, 48], lookAt: [0, 55, 0] },
    { name: 'gilded-dome-lantern-and-cross', position: [29, 88, 32], lookAt: [0, 86, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-great-lavra-belltower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'lavraSkyline',
    errorMeters: 0.69,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and Аимаина хикари’s two exact first-party CC0 Qualla photographs.',
};
