import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  ashlar: 'c4b49a',
  trim: 'd2c2ac',
  base: 'ad9f89',
  marble: 'dbd0bb',
  brick: 'a87863',
  brickShade: '946c5c',
  lead: '7c807d',
  shadow: '484c46',
  timber: '635347',
  bronze: '8d7445',
  underside: 'b3a089',
});
const surfaces = {
  ashlar: surface('wall', 'stone_ashlar', 0.95),
  brick: surface('wall', 'brick_longformat', 0.92),
  lead: surface('roof', 'metal_standing_seam', 0.83, 0.11),
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.84 },
  bronze: surface('trim', 'metal_bronze_cast', 0.78, 0.26),
};
const floor = 1.38;
const frontFoundation = (point) => Math.min(floor - 0.14, grade(point) - 0.34);
const foundation = (point) => Math.min(2.7, grade(point) - 0.32);
const eaves = [8.48, 9.65, 7.02, 7.33];
const domeCenters = [
  [2.96, -4.7],
  [2.96, 9.12],
  [-9.94, -1.73],
  [15.25, -3.13],
];
const roofs = [
  [5.67, 4.17],
  [6.19, 4.75],
  [3.72, 2.43],
  [3.61, 2.54],
];
const putShell = (out, outline, bottom, top, color) =>
  shell(out, outline, bottom, top, { wall: 'ashlar', color, roof: 'lead', roofColor: colors.lead });

function rings(out, center, profile, segments, slot, color, cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, segments, center, Math.PI / segments)),
    color,
    { cap },
  );
}

function dome(out, center, y, radius, rise, level, lantern = false) {
  const segments = [8, 12, 24, 36][level];
  const rows = [3, 5, 9, 12][level];
  const drum = radius * 0.97;
  rings(
    out,
    center,
    [
      [y - 0.09, drum],
      [y + 0.95, drum],
    ],
    level < 2 ? 8 : 12,
    'ashlar',
    colors.ashlar,
    false,
  );
  if (level >= 2)
    rings(
      out,
      center,
      [
        [y + 0.78, radius],
        [y + 0.96, radius],
      ],
      segments,
      'lead',
      colors.lead,
      false,
    );
  const bowl = Array.from({ length: rows + 1 }, (_, i) => {
    const a = (i * Math.PI * 0.5) / rows;
    return [y + 0.94 + Math.sin(a) * rise, Math.max(0.055, radius * Math.cos(a))];
  });
  rings(out, center, bowl, segments, 'lead', colors.lead, false);
  const crown = bowl.at(-1)[0];
  if (lantern) {
    rings(
      out,
      center,
      [
        [crown - 0.19, 0.7],
        [crown + 0.72, 0.7],
      ],
      8,
      'ashlar',
      colors.trim,
      false,
    );
    if (level > 0) {
      const rim = radialRing(0, 0.7, 0.7, 8, center, Math.PI / 8).map(([x, , z]) => [x, z]);
      for (const [a, b] of pairs(closed(rim))) {
        const wall = edge(a, b, -1);
        panel(
          out,
          'opening',
          wall,
          0.1,
          wall.length - 0.1,
          crown + 0.06,
          crown + 0.57,
          0.013,
          colors.shadow,
        );
      }
    }
    rings(
      out,
      center,
      [
        [crown + 0.66, 0.81],
        [crown + 1.0, 0.57],
        [crown + 1.35, 0.12],
      ],
      level < 2 ? 8 : 12,
      'lead',
      colors.lead,
      false,
    );
  }
  if (level > 0) {
    const top = crown + (lantern ? 1.33 : -0.08);
    rings(
      out,
      center,
      [
        [top, 0.087],
        [top + 0.41, 0.08],
        [top + 0.7, 0.045],
      ],
      8,
      'bronze',
      colors.bronze,
    );
  }
}

function windows(out, wall, center, low, spring, halfWidth, level) {
  arch(
    out,
    wall,
    center,
    low,
    spring,
    halfWidth,
    halfWidth * 0.39,
    0.024,
    level,
    { inner: colors.shadow, trim: colors.trim, width: 0.095 },
    { inner: 'opening', trim: 'ashlar' },
  );
  if (level >= 2) {
    for (const n of [-0.42, 0, 0.42]) {
      const x = center + halfWidth * n;
      panel(
        out,
        'bronze',
        wall,
        x - 0.021,
        x + 0.021,
        low,
        spring + halfWidth * 0.09,
        0.068,
        colors.timber,
      );
    }
    const rail = mix(low, spring, 0.56);
    panel(
      out,
      'bronze',
      wall,
      center - halfWidth,
      center + halfWidth,
      rail,
      rail + 0.041,
      0.067,
      colors.timber,
    );
    trimBlock(
      out,
      'ashlar',
      wall,
      center - halfWidth - 0.12,
      center + halfWidth + 0.12,
      low - 0.12,
      low - 0.028,
      0.012,
      0.185,
      colors.trim,
    );
  }
}

function rooms(out, level) {
  for (const [i, room] of [...d.axialRooms, ...d.sideRooms].entries()) {
    const perimeter = rect(...room);
    const eave = eaves[i];
    putShell(out, perimeter, foundation, eave, colors.ashlar);
    if (level > 0) {
      const coping = rect(room[0] - 0.12, room[1] - 0.12, room[2] + 0.12, room[3] + 0.12);
      putShell(out, coping, () => eave - 0.19, eave + 0.065, colors.trim);
    }
    dome(out, domeCenters[i], eave, ...roofs[i], level, i === 0);
    if (level === 0) continue;
    const outsideFaces = [
      [1, 3],
      [2, 1, 3],
      [3, 2],
      [1, 2],
    ][i];
    const walls = pairs(closed(perimeter)).map(([a, b]) => edge(a, b));
    for (const j of outsideFaces) {
      const wall = walls[j];
      for (const fraction of level === 1 ? [0.5] : [0.32, 0.68]) {
        const center = wall.length * fraction;
        const low = Math.max(3.0, grade([wall.p(center, 0)[0], wall.p(center, 0)[2]]) + 0.6);
        windows(out, wall, center, low, low + 1.45, 0.56, level);
        if (level > 0) windows(out, wall, center, eave - 2.2, eave - 1.56, 0.34, level);
      }
    }
  }

  const aft = d.axialRooms[0];
  const frontWall = edge([aft[0], aft[1]], [aft[2], aft[1]]);
  const center = frontWall.length / 2;
  if (level > 0) {
    trimBlock(
      out,
      'ashlar',
      frontWall,
      center - 1.62,
      center + 1.62,
      floor,
      floor + 4.6,
      0.02,
      0.24,
      colors.marble,
    );
    arch(
      out,
      frontWall,
      center,
      floor + 0.15,
      floor + 2.82,
      0.98,
      0.47,
      0.255,
      level,
      { inner: colors.timber, trim: colors.trim, width: 0.24 },
      { inner: 'opening', trim: 'ashlar' },
    );
    for (const x of [center - 4.08, center + 4.08])
      windows(out, frontWall, x, floor + 0.82, floor + 2.57, 0.65, level);
    if (level >= 2)
      panel(
        out,
        'opening',
        frontWall,
        center - 0.65,
        center + 0.65,
        floor + 3.78,
        floor + 4.13,
        0.248,
        colors.timber,
      );
  }
}

function roundArch(out, x, z, back, half, outer, spring, segments) {
  const point = (i, r, along) => {
    const a = (Math.PI * i) / segments;
    return [x + Math.cos(a) * r, spring + Math.sin(a) * r, along];
  };
  for (let i = 0; i < segments; i++) {
    const n = [
      -Math.cos((Math.PI * (i + 0.5)) / segments),
      -Math.sin((Math.PI * (i + 0.5)) / segments),
      0,
    ];
    const innerA = point(i, half, z),
      innerB = point(i + 1, half, z);
    const outerA = point(i, outer, z),
      outerB = point(i + 1, outer, z);
    face(out, 'brick', [innerA, innerB, outerB, outerA], [0, 0, -1], colors.brick);
    face(
      out,
      'brick',
      [innerA, innerB, point(i + 1, half, back), point(i, half, back)],
      n,
      colors.brickShade,
    );
    face(
      out,
      'ashlar',
      [outerA, outerB, [outerB[0], 7.22, z], [outerA[0], 7.22, z]],
      [0, 0, -1],
      colors.ashlar,
    );
  }
}

function vault(out, x, z, half, depth, level) {
  const across = [4, 8, 12, 18][level];
  for (let i = 0; i < across; i++) {
    const a = (Math.PI * i) / across;
    const b = (Math.PI * (i + 1)) / across;
    const u = x - half * Math.cos(a),
      v = x - half * Math.cos(b);
    const ya = 7.24 + 1.22 * Math.sin(a),
      yb = 7.24 + 1.22 * Math.sin(b);
    face(
      out,
      'lead',
      [
        [u, ya, z],
        [v, yb, z],
        [v, yb, z + depth],
        [u, ya, z + depth],
      ],
      up,
      colors.lead,
    );
    face(
      out,
      'ashlar',
      [
        [u, 7.17, z],
        [v, 7.17, z],
        [v, yb, z],
        [u, ya, z],
      ],
      [0, 0, -1],
      colors.underside,
    );
  }
}

function porch(out, level) {
  const [left, front, right, back] = d.porch;
  const pitch = (right - left - 1.34) / d.porchBays;
  const first = left + 0.67;
  const spring = 4.18;
  putShell(out, rect(left, front, right, back), frontFoundation, floor, colors.base);
  // Extend beneath each tread down to the original sloped grade.
  if (level > 0) {
    for (let i = 0; i < 5; i++) {
      const z = front - 2.15 + 0.43 * i;
      const height = mix(0.43, floor, i / 5);
      putShell(out, rect(0.3, z, 8.2, z + 0.44), frontFoundation, height, colors.trim);
    }
  }
  for (let i = 0; i <= d.porchBays; i++) {
    const x = first + i * pitch;
    block(out, 'ashlar', x - 0.67, floor - 0.02, front, 1.34, 7.22 - floor, 1.44, colors.ashlar);
    if (level > 0) {
      block(out, 'ashlar', x - 0.75, floor, front - 0.08, 1.5, 0.31, 1.58, colors.trim);
      block(out, 'ashlar', x - 0.72, spring - 0.2, front - 0.05, 1.44, 0.24, 1.54, colors.trim);
    }
  }
  for (let i = 0; i < d.porchBays; i++) {
    const x = first + (i + 0.5) * pitch;
    const outer = pitch / 2 - 0.67;
    roundArch(
      out,
      x,
      front - 0.012,
      front + 1.44,
      outer - 0.27,
      outer,
      spring,
      [4, 8, 14, 20][level],
    );
    if (i === 2) {
      const center = [x, (front + back) / 2];
      putShell(
        out,
        rect(x - pitch / 2, front, x + pitch / 2, back),
        () => 7.15,
        7.43,
        colors.ashlar,
      );
      dome(out, center, 7.4, 2.62, 2.05, level);
    } else {
      vault(out, x, front, pitch / 2 - 0.005, back - front, level);
    }
  }
  block(out, 'lead', left - 0.08, 7.19, front - 0.09, right - left + 0.16, 0.19, 0.32, colors.lead);
  block(out, 'ashlar', left, 7.01, back - 0.23, right - left, 0.47, 0.23, colors.trim);
}

function minaret(out, level) {
  const [x, z] = d.minaret;
  const base = grade([x, z]) - 0.35;
  block(out, 'ashlar', x - 1.35, base, z - 1.35, 2.7, 5.74 - base, 2.7, colors.ashlar);
  const segments = [8, 12, 16, 20][level];
  const drum = [
    [5.55, 1.4],
    [7.45, 0.94],
    [19.13, 0.76],
  ];
  rings(out, d.minaret, drum, segments, 'ashlar', colors.ashlar, false);
  const balcony = [
    [19.02, 0.76],
    [19.28, 0.86],
    [19.52, 1.12],
    [19.74, 1.35],
    [19.97, 1.45],
    [20.68, 1.45],
    [20.72, 1.38],
  ];
  const balconyProfile = level === 0 ? [balcony[0], balcony[4], balcony[6]] : balcony;
  rings(out, d.minaret, balconyProfile, segments, 'ashlar', colors.trim);
  rings(
    out,
    d.minaret,
    [
      [19.9, 0.62],
      [24.48, 0.66],
    ],
    segments,
    'ashlar',
    colors.ashlar,
    false,
  );
  rings(
    out,
    d.minaret,
    [
      [24.42, 0.69],
      [24.68, 0.72],
      [27.65, 0.07],
    ],
    segments,
    'lead',
    colors.lead,
    false,
  );
  if (level > 0)
    rings(
      out,
      d.minaret,
      [
        [27.57, 0.08],
        [28.26, 0.04],
      ],
      8,
      'bronze',
      colors.bronze,
    );
  if (level > 0)
    rings(
      out,
      d.minaret,
      [
        [20.57, 1.46],
        [20.71, 1.49],
        [20.8, 1.46],
      ],
      segments,
      'ashlar',
      colors.marble,
      false,
    );
  if (level >= 2) {
    const rim = radialRing(0, 1.45, 1.45, segments, d.minaret, Math.PI / segments).map(
      ([a, , b]) => [a, b],
    );
    for (const [a, b] of pairs(closed(rim))) {
      const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      face(
        out,
        'opening',
        [at(a, 20.14), at(b, 20.14), at(p, 20.47)],
        [p[0] - x, 0, p[1] - z],
        colors.underside,
      );
    }
  }
}

function build(out, level) {
  rooms(out, level);
  porch(out, level);
  minaret(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'muradiye-mosque-edirne-model.mjs';
const camera = [-42, 29, -53];
const lookAt = [2.8, 8.5, -1];
const errors = { district: 0.49, street: 0.19, closeup: 0.06 };

export const muradiyeMosqueEdirneAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original regional elevation in front of the north approach.',
  brief:
    'Muradiye Mosque in Edirne with four lead domes, a five-bay arched porch and one stone minaret.',
  camera,
  lookAt,
  sunDirection: [-28, 96, -71],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Mapped mosque footprint in Edirne.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'five-round-porch-bays', position: [3, 8, -39], lookAt: [4, 6.3, -13.3] },
    { name: 'axial-domes-and-lantern', position: [33, 29, 28], lookAt: [3, 9, 1] },
    { name: 'northwest-minaret-and-porch', position: [-32, 18, -22], lookAt: [-5, 11, -7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'muradiye-mosque-edirne-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
