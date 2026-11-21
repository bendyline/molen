import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  concrete: 'a9a79b',
  throat: '78766e',
  rim: 'c0bfb1',
  skirt: '89877b',
  brace: 'a09e91',
  stack: 'bab8ad',
  stackShade: 'aead9f',
  wall: '929592',
  wall2: 'a6a9a5',
  roof: 'a2a49c',
  frame: 'a5aaa4',
  shadow: '414744',
  glass: '545e5c',
});
const surfaces = {
  concrete: surface('wall', 'concrete_plain', 0.97),
  textured: surface('foundation', 'concrete_boardformed', 0.94),
  siding: surface('wall', 'metal_standing_seam', 0.83, 0.12),
  panel: surface('roof', 'concrete_panel', 0.93),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
};

function ring(center, y, r, n, reversed = false) {
  const p = radialRing(y, r, r, n, center, Math.PI / n);
  return reversed ? p.reverse() : p;
}

function loftProfile(out, center, profile, n, slot, color, reversed = false) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => ring(center, y, r, n, reversed)),
    color,
    { cap: false },
  );
}

function tower(out, { center, radius, height, topRadius, footprint }, level) {
  const n = [10, 20, 36, 56][level];
  const floor = grade(center);
  const lower = 0.052;
  const neck = 0.76;
  const apron = 2.0;
  const waist = topRadius - radius * 0.048;
  const shellRadius = (t) => {
    const fall = Math.max(0, neck - t) / (neck - lower);
    const rise = Math.max(0, t - neck) / (1 - neck);
    return waist + (radius * 0.91 - waist) * fall * fall + (topRadius - waist) * rise * rise;
  };
  const fractions = [
    [lower, 0.19, 0.36, 0.54, 0.73, 0.9, 1],
    [lower, 0.12, 0.22, 0.34, 0.46, 0.58, 0.72, 0.85, 0.94, 1],
    Array.from({ length: 18 }, (_, i) => mix(lower, 1, i / 17)),
    Array.from({ length: 29 }, (_, i) => mix(lower, 1, i / 28)),
  ][level];
  const pad = level < 2 ? ring(center, 0, radius, n).map(([x, , z]) => [x, z]) : footprint;
  shell(out, pad, (p) => Math.min(floor - 0.63, grade(p) - 0.85), floor + apron, {
    wall: 'textured',
    roof: 'textured',
    color: colors.skirt,
    roofColor: colors.skirt,
  });
  loftProfile(
    out,
    center,
    fractions.map((t) => [floor + height * t, shellRadius(t)]),
    n,
    'concrete',
    colors.concrete,
  );
  const high = floor + height;
  loftProfile(
    out,
    center,
    [
      [high - 0.55, topRadius + 0.075],
      [high + 0.11, topRadius + 0.12],
      [high + 0.11, topRadius - 0.57],
    ],
    n,
    'concrete',
    colors.rim,
  );
  if (level > 0) {
    const depth = level === 1 ? 7.0 : 20.0;
    loftProfile(
      out,
      center,
      [
        [high - depth, shellRadius(1 - depth / height) - 0.6],
        [high + 0.103, topRadius - 0.57],
      ],
      n,
      'concrete',
      colors.throat,
      true,
    );
  }
  if (level === 0) {
    loftProfile(
      out,
      center,
      [
        [floor + apron - 0.05, radius * 0.86],
        [floor + lower * height + 0.03, radius * 0.91],
      ],
      n,
      'textured',
      colors.skirt,
    );
    return;
  }

  const braces = [0, 12, 20, 32][level];
  const low = ring(center, floor + apron - 0.08, radius * 0.862, braces);
  const top = ring(center, floor + lower * height + 1.02, shellRadius(lower) - 0.25, braces);
  for (let i = 0; i < braces; i++) {
    beam(out, 'textured', low[i], top[i], 1.15, 0.88, colors.brace);
    if (level >= 2) beam(out, 'textured', low[i], top[(i + 1) % braces], 0.84, 0.68, colors.brace);
  }
  if (level === 3) {
    for (const t of [0.118, 0.24, 0.43, 0.64, 0.82, 0.94]) {
      const r = shellRadius(t) + 0.035,
        y = floor + height * t;
      loftProfile(
        out,
        center,
        [
          [y, r],
          [y + 0.19, r + 0.014],
        ],
        n,
        'concrete',
        colors.rim,
      );
    }
  }
}

function chimney(out, { center, height, bottomRadius, rimRadius, pairedRim }, level) {
  const n = [10, 16, 26, 36][level];
  const floor = grade(center),
    high = floor + height;
  const profile = [
    [floor - 1.4, bottomRadius],
    [floor + height * 0.32, mix(bottomRadius, rimRadius, 0.44)],
    [floor + height * 0.78, mix(bottomRadius, rimRadius, 0.85)],
    [high, rimRadius],
  ];
  loftProfile(out, center, profile, n, 'concrete', colors.stack);
  if (level > 0) {
    const band = height * 0.027;
    loftProfile(
      out,
      center,
      [
        [high - band, rimRadius * 1.02],
        [high, rimRadius * 1.004],
      ],
      n,
      'concrete',
      colors.stackShade,
    );
    loftProfile(
      out,
      center,
      [
        [high, rimRadius * 1.004],
        [high, rimRadius - 0.45],
      ],
      n,
      'concrete',
      colors.rim,
    );
    loftProfile(
      out,
      center,
      [
        [high - 15, rimRadius - 0.54],
        [high - 0.007, rimRadius - 0.45],
      ],
      n,
      'concrete',
      colors.throat,
      true,
    );
  }
  if (pairedRim && level >= 2) {
    const pairRadius = rimRadius * 0.34,
      separation = rimRadius * 0.43;
    for (const offset of [-separation, separation]) {
      const xy = [center[0] + offset, center[1]];
      loftProfile(
        out,
        xy,
        [
          [high - 3.2, pairRadius + 0.25],
          [high + 2.65, pairRadius + 0.19],
          [high + 2.68, pairRadius],
        ],
        n,
        'concrete',
        colors.rim,
      );
    }
  }
}

function buildings(out, level) {
  for (const [id, { outline, height }] of d.body.entries()) {
    const localFloor = outline.reduce((n, p) => n + grade(p) / outline.length, 0);
    const floor = localFloor + 1.1;
    const eave = floor + height;
    shell(out, outline, (p) => Math.min(grade(p) - 1.0, floor - 0.2), floor, {
      wall: 'textured',
      roof: 'textured',
      color: colors.skirt,
      roofColor: colors.skirt,
    });
    shell(out, outline, () => floor - 0.03, eave, {
      wall: 'siding',
      roof: 'panel',
      color: id % 2 ? colors.wall : colors.wall2,
      roofColor: colors.roof,
    });
    if (level === 0) continue;
    for (const [a, b] of pairs(closed(outline))) {
      const wall = edge(a, b, areaSign(outline));
      const bays = Math.max(1, Math.floor(wall.length / [0, 13, 9, 7.5][level]));
      const pitch = wall.length / bays;
      panel(
        out,
        'siding',
        wall,
        0.005,
        wall.length - 0.005,
        eave - 1.19,
        eave - 0.1,
        0.04,
        colors.frame,
      );
      for (let i = 0; i < bays; i++) {
        const x = (i + 0.5) * pitch;
        const reach = Math.min(pitch * 0.47, 4.1);
        panel(
          out,
          'glass',
          wall,
          x - reach,
          x + reach,
          eave - 9.05,
          eave - 7.74,
          0.035,
          colors.glass,
        );
        if (level >= 2) {
          panel(
            out,
            'siding',
            wall,
            x - reach,
            x + reach,
            eave - 16.0,
            eave - 14.7,
            0.06,
            colors.shadow,
          );
          panel(
            out,
            'siding',
            wall,
            x - 0.2,
            x + 0.2,
            floor + 1.2,
            eave - 1.12,
            0.087,
            colors.frame,
          );
        }
      }
    }
    if (level >= 2) {
      const x = outline.reduce((n, p) => n + p[0] / outline.length, 0);
      const z = outline.reduce((n, p) => n + p[1] / outline.length, 0);
      for (const shift of [-5.2, 5.2])
        block(out, 'siding', x - 4 + shift, eave - 0.03, z - 3.1, 6.2, 1.35, 6.9, colors.frame);
    }
  }
}

function build(out, level) {
  d.cooling.forEach((w) => {
    tower(out, w, level);
  });
  d.chimneys.forEach((w) => {
    chimney(out, w, level);
  });
  buildings(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'john-e-amos-power-plant-model.mjs';
const camera = [864, 462, 734];
const lookAt = [0, 88, -3];
const errors = { district: 1.31, street: 0.56, closeup: 0.13 };
export const johnEAmosPowerPlantAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original open elevation from the Kanawha valley floor.',
  brief:
    'The John E. Amos plant skyline with three waisted concrete cooling towers, slender stacks and grounded industrial roof masses.',
  camera,
  lookAt,
  sunDirection: [124, 153, -78],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Three mapped exterior cooling tower shells.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'kanawha-river-silhouette', position: [621, 119, 349], lookAt: [0, 107, -35] },
    { name: 'largest-cooling-tower-shell', position: [292, 78, -327], lookAt: [100, 66, -224] },
    {
      name: 'industrial-roofs-and-concrete-stacks',
      position: [-488, 309, -440],
      lookAt: [-113, 102, -30],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'john-e-amos-power-plant-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.1,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
