import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  cap,
  face,
  floorSampler,
  mix,
  palette,
  pairs,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const dimensions = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const gallery = dimensions.galleryHeight;
const towerTop = -1.14 + dimensions.towerHeight;
const colors = palette({
  rock: '928773',
  lean: '77736a',
  pavement: 'a29c86',
  concrete: 'aba89a',
  graphite: '4e585a',
  glass: '405252',
  alternateGlass: '597071',
  silver: 'abafb2',
  warmMetal: '91999e',
  darkMetal: '58636c',
  white: 'dcddda',
  seam: 'b7bdbe',
  warmWhite: 'cbd1d0',
  guard: '727779',
  transmitter: 'd5d9d5',
});
const surfaces = {
  rock: surface('foundation', 'stone_limestone_raw', 0.95),
  concrete: surface('wall', 'concrete_boardformed', 0.94),
  aluminum: surface('wall', 'metal_stainless_beadblasted', 0.78, 0.25),
  laminate: surface('roof', 'metal_painted', 0.84, 0.12),
  glass: surface('window', 'window_grid', 0.62),
  trim: surface('trim', 'metal_stainless', 0.82, 0.18),
};
const center = [0, -1.05];
const anglePoint = (a, y, r) => [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)];
const radial = (a) => [Math.cos(a), 0, Math.sin(a)];
const tau = Math.PI * 2;

function mappedBase(out, lod) {
  const inset = dimensions.outline.map(([x, z]) => [
    mix(center[0], x, 0.966),
    mix(center[1], z, 0.966),
  ]);
  shell(out, dimensions.outline, (p) => Math.min(grade(p) - 0.37, -1.34), gallery - 0.24, {
    wall: 'rock',
    color: colors.rock,
    roofColor: colors.pavement,
  });
  shell(out, inset, () => gallery - 0.24, gallery + 0.03, {
    wall: 'concrete',
    color: colors.concrete,
  });
  if (lod === 0) return;
  const points = dimensions.walk;
  for (const [[x, z], [x2, z2]] of pairs(points)) {
    const a = Math.atan2(z - center[1], x - center[0]),
      b = Math.atan2(z2 - center[1], x2 - center[0]);
    const n = radial(a),
      m = radial(b),
      y = gallery + 0.067;
    const p1 = [x, y, z],
      p2 = [x2, y, z2],
      q1 = [x + n[0] * 0.83, y + 0.009, z + n[2] * 0.83],
      q2 = [x2 + m[0] * 0.83, y + 0.009, z2 + m[2] * 0.83];
    face(out, 'rock', [p1, q1, q2, p2], up, colors.pavement);
    if (lod < 2) continue;
    face(
      out,
      'rock',
      [
        [q1[0], Math.min(grade([q1[0], q1[2]]) - 0.26, y - 0.29), q1[2]],
        [q2[0], Math.min(grade([q2[0], q2[2]]) - 0.26, y - 0.29), q2[2]],
        q2,
        q1,
      ],
      n,
      colors.lean,
    );
  }
  const [outer, inner] = dimensions.trail;
  const axis = Math.atan2(inner[1] - outer[1], inner[0] - outer[0]);
  const h = [Math.sin(axis), -Math.cos(axis)];
  const from = [outer[0] + 1.9 * h[0], outer[1] + 1.9 * h[1]],
    to = [outer[0] - 1.9 * h[0], outer[1] - 1.9 * h[1]];
  const far = [inner[0] - 1.9 * h[0], inner[1] - 1.9 * h[1]],
    near = [inner[0] + 1.9 * h[0], inner[1] + 1.9 * h[1]];
  const y = gallery + 0.09;
  cap(out, 'rock', [from, to, far, near], y, colors.pavement);
  // Short parapets carry the documented summit access path into the hotel gallery.
  if (lod > 1)
    for (const [p, q] of [
      [from, near],
      [to, far],
    ]) {
      const a = [p[0], y + 0.48, p[1]],
        b = [q[0], y + 0.48, q[1]];
      beamPath(out, 'concrete', [a, b], 0.3, 0.48, colors.concrete);
    }
}

function windowPanels(out, lower, upper, r0, r1, count, lod) {
  for (let i = 0; i < count; i++) {
    const a0 = ((i + 0.19) / count) * tau,
      a1 = ((i + 0.81) / count) * tau;
    const b = (a0 + a1) * 0.5;
    face(
      out,
      'glass',
      [
        anglePoint(a0, lower, r0 + 0.072),
        anglePoint(a1, lower, r0 + 0.072),
        anglePoint(a1, upper, r1 + 0.075),
        anglePoint(a0, upper, r1 + 0.075),
      ],
      radial(b),
      i % 7 === 0 ? colors.alternateGlass : colors.glass,
    );
    if (lod < 3) continue;
    const a = b - 0.006,
      c = b + 0.006;
    face(
      out,
      'trim',
      [
        anglePoint(a, lower, r0 + 0.14),
        anglePoint(c, lower, r0 + 0.14),
        anglePoint(c, upper, r1 + 0.14),
        anglePoint(a, upper, r1 + 0.14),
      ],
      radial(b),
      colors.darkMetal,
    );
  }
}

function hotel(out, lod) {
  const n = [12, 26, 44, 56][lod],
    r = dimensions.towerDiameter * 0.5;
  const deck = gallery + 0.08;
  ring(
    out,
    'concrete',
    center,
    [
      [gallery - 2.4, 16.4],
      [gallery - 0.13, 18.67],
      [deck, 18.88],
      [deck + 0.22, 18.83],
    ],
    n,
    colors.concrete,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [deck + 0.21, 18.67],
      [deck + 0.77, 18.55],
      [deck + 1.29, 17.93],
      [deck + 1.46, r],
    ],
    n,
    colors.warmMetal,
  );
  ring(
    out,
    'glass',
    center,
    [
      [deck + 1.43, r],
      [deck + 3.85, r],
    ],
    n,
    colors.glass,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [deck + 3.83, r + 0.03],
      [deck + 4.35, r + 0.02],
      [deck + 7.73, 16.27],
      [deck + 8.05, 16.23],
    ],
    n,
    colors.silver,
  );
  ring(
    out,
    'glass',
    center,
    [
      [deck + 4.42, 16.48],
      [deck + 7.21, 16.29],
    ],
    n,
    colors.glass,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [deck + 7.47, 16.29],
      [15.27, 14.89],
      [19.92, 13.46],
      [23.42, 12.17],
    ],
    n,
    colors.silver,
  );
  if (lod > 0) {
    windowPanels(out, deck + 1.56, deck + 3.72, r, r, lod === 1 ? 22 : 44, lod);
    windowPanels(out, deck + 4.56, deck + 7.02, 16.5, 16.31, lod === 1 ? 22 : 44, lod);
    windowPanels(out, 14.08, 16.32, 15.32, 14.65, lod === 1 ? 24 : 48, lod);
    windowPanels(out, 19.26, 21.43, 13.68, 12.91, lod === 1 ? 24 : 48, lod);
  }
}

function seams(out, profile, lod) {
  if (lod < 2) return;
  const n = lod === 2 ? 28 : 42;
  const delta = 0.0035;
  for (let i = 0; i < n; i++) {
    const a = (tau * i) / n;
    for (const [[y, r], [h, t]] of pairs(profile)) {
      face(
        out,
        'laminate',
        [
          anglePoint(a - delta, y, r + 0.061),
          anglePoint(a + delta, y, r + 0.061),
          anglePoint(a + delta, h, t + 0.049),
          anglePoint(a - delta, h, t + 0.049),
        ],
        radial(a),
        colors.seam,
      );
    }
  }
}

function tower(out, lod) {
  const n = [12, 26, 40, 52][lod];
  const taper =
    lod === 0
      ? [
          [23.41, 12.19],
          [33.2, 8.6],
          [46.88, 5.35],
        ]
      : [
          [23.41, 12.19],
          [27.5, 10.58],
          [33, 8.72],
          [39.1, 7.03],
          [44.3, 5.93],
          [46.88, 5.35],
        ];
  ring(out, 'laminate', center, taper, n, colors.white);
  seams(out, taper, lod);
  ring(
    out,
    'trim',
    center,
    [
      [46.69, 5.5],
      [47.05, 5.55],
      [47.29, 5.49],
    ],
    n,
    colors.guard,
  );
  const pitch =
    lod === 0
      ? [
          [47.1, 5.37],
          [55.9, 3.66],
          [62.12, 2.1],
        ]
      : [
          [47.1, 5.37],
          [50.9, 4.51],
          [55.9, 3.55],
          [58.79, 2.86],
          [62.12, 2.1],
        ];
  ring(out, 'aluminum', center, pitch, n, colors.silver);
  ring(
    out,
    'trim',
    center,
    [
      [61.88, 2.13],
      [62.1, 2.23],
      [62.39, 2.19],
    ],
    n,
    colors.darkMetal,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [62.37, 2.03],
      [65.95, 1.73],
      [70, 1.25],
      [76, 1.03],
      [79.63, 0.91],
    ],
    n,
    colors.warmMetal,
  );
  ring(
    out,
    'trim',
    center,
    [
      [79.6, 1.05],
      [79.89, 1.14],
      [80.18, 0.98],
    ],
    n,
    colors.guard,
  );
  ring(
    out,
    'laminate',
    center,
    [
      [80.15, 0.95],
      [82.65, 0.84],
      [towerTop - 0.42, 0.77],
      [towerTop, 0.65],
    ],
    n,
    colors.transmitter,
  );
  if (lod === 0) return;
  const panels = lod === 1 ? 6 : 8;
  for (let i = 0; i < panels; i++) {
    const a = (tau * i) / panels;
    if (lod > 1) {
      beamPath(
        out,
        'trim',
        [
          anglePoint(a, 65.8, 2.03),
          anglePoint(a, 70.4, 1.75),
          anglePoint(a, 76.86, 1.51),
          anglePoint(a, 79.61, 1.39),
        ],
        0.095,
        0.095,
        colors.darkMetal,
      );
    }
    for (const [y, r] of [
      [62.5, 2.48],
      [65.82, 2.26],
      [68.78, 2.03],
      [72.1, 1.79],
      [75.35, 1.62],
      [78.64, 1.55],
    ]) {
      const b = a + (lod === 1 ? 0.085 : 0.165);
      const u = anglePoint(a, y, r),
        v = anglePoint(b, y, r);
      face(
        out,
        'trim',
        [u, v, [v[0], y + 0.27, v[2]], [u[0], y + 0.27, u[2]]],
        radial(a),
        colors.darkMetal,
      );
      if (lod === 3) {
        const p = anglePoint(a, y - 0.34, r - 0.29);
        beamPath(out, 'trim', [p, u], 0.075, 0.075, colors.guard);
      }
    }
  }
  if (lod > 1) {
    for (const [y, r] of [
      [46.92, 5.69],
      [62.14, 2.52],
      [79.92, 1.28],
    ]) {
      ring(
        out,
        'trim',
        center,
        [
          [y, r],
          [y + 0.44, r - 0.022],
        ],
        n,
        colors.guard,
      );
    }
    for (let i = 0; i < 20; i++) {
      const a = (tau * i) / 20;
      const [x, y, z] = anglePoint(a, 47.15, 5.48);
      block(out, 'trim', x - 0.031, y, z - 0.031, 0.062, 0.56, 0.062, colors.guard);
    }
  }
}

function build(out, lod) {
  mappedBase(out, lod);
  hotel(out, lod);
  tower(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'jested-tower-model.mjs',
  camera = [89, 61, 123],
  lookAt = [0, 37, -0.8];
export const jestedTowerModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'tower',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The named RÚIAN outline and 1014 m glazed gallery control the tower placement. The site terrain comes from ČÚZK bare-earth lidar.',
  brief:
    'Ještěd’s conical mountain hotel and television tower with its stone summit gallery, panoramic glazing, laminate hyperboloid and narrow radio mast.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [45, 89, -17],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: dimensions.outline,
    minimumCoverage: 0.93,
    basis:
      'The named native circular deck and hotel outline fixes replacement of the summit building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'tower-from-summit-approach', position: [27, 15, 85], lookAt: [0, 33, 0] },
    { name: 'hotel-windows-and-stone-deck', position: [-34, 12, 31], lookAt: [0, 10, 0] },
    { name: 'silvery-shell-and-antenna', position: [72, 82, -59], lookAt: [0, 50, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'jested-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.52, surfaces },
      street: { export: 'street', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
};
