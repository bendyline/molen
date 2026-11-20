import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const { dimensions: d } = plan;
const colors = palette({
  clinker: 'a5624a',
  shadedClinker: '8b4d3f',
  coping: 'b47b5c',
  stone: 'a39785',
  paving: 'b5a696',
  roof: '6d6057',
  glass: '7a918e',
  metal: '534d43',
  timber: '7a6651',
  garden: '868e66',
  plantedSoil: '777b54',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.94),
  stone: surface('foundation', 'stone_ashlar', 0.96),
  gravel: surface('foundation', 'gravel', 0.93),
  metal: surface('trim', 'metal_painted', 0.7, 0.22),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.28, metallic: 0.13 },
  solid: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
};

const groundOpenings = [
  [
    [2.2, 4.2],
    [8.9, 3.3],
    [14.9, 3.6],
    [19.0, 1.1, 'door'],
  ],
  [[1.45, 0.82]],
  [[1.12, 0.82]],
  [
    [2.64, 3.5, 'door', 0.16, 2.48],
    [6.48, 1.65],
  ],
  [[3.85, 6.3, 'terrace']],
  [[1.12, 1.56, 'terrace']],
  [[3.75, 6.8, 'terrace']],
  [[1.61, 2.44, 'terrace']],
  [[3.32, 5.25, 'terrace']],
  [
    [2, 1.14],
    [6.15, 3.8],
    [10.65, 1.64],
  ],
];
const familyOutline = rect(-9.1, -8.6, 9.9, 0.75);
const familyOpenings = [
  [
    [2.8, 3.9],
    [8.3, 2.9],
    [13.5, 3.6],
    [17.7, 0.89],
  ],
  [
    [2.6, 3.4],
    [7.2, 1.14],
  ],
  [
    [2.6, 2.5],
    [6.0, 2.4],
    [11.5, 3.7],
    [16.15, 3.5],
  ],
  [
    [2.8, 1.46],
    [6.4, 3.3],
  ],
];
const staffOutline = rect(-8.1, -8.6, 0.7, -0.04);
const staffOpenings = [
  [
    [2.0, 2.55],
    [6.4, 2.44],
  ],
  [[3, 3.15]],
  [
    [2.5, 2.34],
    [6.1, 2.68],
  ],
  [[4.5, 4.2]],
];

function windowDetail(out, level, wall, left, right, low, high, kind) {
  const back = -0.16;
  panel(
    out,
    kind === 'door' ? 'solid' : 'glass',
    wall,
    left,
    right,
    low,
    high,
    back,
    kind === 'door' ? colors.timber : colors.glass,
  );
  const frame = -0.124;
  for (const x of [left + 0.033, right - 0.033])
    panel(out, 'metal', wall, x - 0.035, x + 0.035, low, high, frame, colors.metal);
  for (const y of [low + 0.035, high - 0.032])
    panel(out, 'metal', wall, left, right, y - 0.034, y + 0.034, frame, colors.metal);
  for (const [y, normal] of [
    [low, [0, 1, 0]],
    [high, [0, -1, 0]],
  ]) {
    face(
      out,
      'brick',
      [wall.p(left, y), wall.p(right, y), wall.p(right, y, back), wall.p(left, y, back)],
      normal,
      colors.shadedClinker,
    );
  }
  for (const [x, sign] of [
    [left, 1],
    [right, -1],
  ]) {
    const [, , z] = wall.normal;
    face(
      out,
      'brick',
      [wall.p(x, low), wall.p(x, high), wall.p(x, high, back), wall.p(x, low, back)],
      [-z * sign, 0, wall.normal[0] * sign],
      colors.shadedClinker,
    );
  }
  const leaves = right - left > 4.0 ? 4 : right - left > 1.5 ? 2 : 1;
  for (let i = 1; i < leaves; i++) {
    const x = mix(left, right, i / leaves);
    panel(out, 'metal', wall, x - 0.039, x + 0.039, low, high, frame, colors.metal);
  }
  if (level >= 2 && kind === 'terrace') {
    panel(out, 'metal', wall, left, right, low + 1.72, low + 1.785, frame + 0.006, colors.metal);
    for (let i = 0; i < leaves; i++) {
      const x = mix(left, right, (i + 0.75) / leaves);
      panel(
        out,
        'metal',
        wall,
        x - 0.027,
        x + 0.027,
        low + 0.8,
        low + 0.97,
        frame + 0.017,
        colors.metal,
      );
    }
  }
  if (level === 3) {
    panel(
      out,
      'brick',
      wall,
      left - 0.065,
      right + 0.065,
      low - 0.075,
      low - 0.006,
      0.058,
      colors.coping,
    );
    panel(
      out,
      'brick',
      wall,
      left - 0.046,
      right + 0.046,
      high + 0.004,
      high + 0.076,
      0.026,
      colors.shadedClinker,
    );
  }
}

function facade(out, level, outline, lo, hi, openings, color = colors.clinker) {
  pairs(closed(outline)).forEach(([a, b], i) => {
    const wall = edge(a, b, areaSign(outline));
    let cursor = 0;
    for (const [center, width, kind = 'window', sill, top] of openings[i] ?? []) {
      const left = center - width * 0.5;
      const right = center + width * 0.5;
      const base = lo + (sill ?? (kind === 'window' ? 0.93 : 0.075));
      const lintel = lo + (top ?? (kind === 'terrace' ? 2.66 : hi - lo - 0.53));
      if (left <= cursor || right >= wall.length || base >= lintel || lintel >= hi)
        throw new Error(`Villa Wolf facade opening outside wall ${i + 1}`);
      panel(out, 'brick', wall, cursor, left, lo, hi, 0, color);
      panel(out, 'brick', wall, left, right, lo, base, 0, color);
      panel(out, 'brick', wall, left, right, lintel, hi, 0, color);
      if (level === 0)
        panel(
          out,
          kind === 'door' ? 'solid' : 'glass',
          wall,
          left,
          right,
          base,
          lintel,
          -0.11,
          kind === 'door' ? colors.timber : colors.glass,
        );
      else windowDetail(out, level, wall, left, right, base, lintel, kind);
      cursor = right;
    }
    panel(out, 'brick', wall, cursor, wall.length, lo, hi, 0, color);
    if (level > 1) {
      panel(out, 'brick', wall, 0, wall.length, hi - 0.15, hi - 0.042, 0.031, colors.coping);
    }
  });
  cap(out, 'solid', outline, hi, colors.roof);
}

function wallsAndTerraces(out, level) {
  const terrace = d.outlines.mainTerrace;
  const lower = d.outlines.lowerGarden;
  const foundation = (p, y) => Math.min(grade(p) - 0.24, y - 0.36);
  shell(
    out,
    d.outline,
    (p) => foundation(p, d.groundFloorRelativeHeight),
    d.groundFloorRelativeHeight,
    {
      wall: 'brick',
      color: colors.shadedClinker,
    },
  );
  shell(out, terrace, (p) => foundation(p, d.terrace), d.terrace, {
    wall: 'brick',
    color: colors.shadedClinker,
    roof: 'gravel',
    roofColor: colors.paving,
  });
  shell(out, lower, (p) => foundation(p, d.lowerGarden), d.lowerGarden, {
    wall: 'stone',
    color: colors.stone,
    roof: 'solid',
    roofColor: colors.garden,
  });
  const lips = [
    [-16, 14.88, 3.32, 15.2],
    [5.3, 14.88, 12.2, 15.2],
    [11.91, 7.5, 12.2, 14.9],
    [-16, 4.15, -15.7, 14.89],
  ];
  for (const [a, b, c, e] of lips) {
    block(out, 'brick', a, d.terrace, b, c - a, 0.56, e - b, colors.clinker);
    if (level > 0)
      block(
        out,
        'stone',
        a - 0.035,
        d.terrace + 0.56,
        b - 0.035,
        c - a + 0.07,
        0.105,
        e - b + 0.07,
        colors.stone,
      );
  }
  const steps = level < 2 ? 7 : 16;
  const rise = d.terrace - d.lowerGarden;
  for (let i = 0; i < steps; i++) {
    const z = 14.95 + (3.76 * i) / steps;
    const y = d.lowerGarden + rise * (1 - (i + 1) / steps);
    const footing = Math.min(d.lowerGarden - 0.24, grade([4.31, z]) - 0.16);
    block(out, 'stone', 3.32, footing, z, 1.98, y + 0.01 - footing, 3.76 / steps, colors.stone);
  }
  if (level <= 1) return;
  cap(out, 'solid', rect(-13.7, 19.6, -4.25, 24.1), d.lowerGarden + 0.075, colors.plantedSoil);
  cap(out, 'solid', rect(-2.88, 19.6, 2.8, 24.1), d.lowerGarden + 0.075, colors.plantedSoil);
  if (level === 3) {
    const joinColor = colors.paving;
    for (let x = -13.4; x < 11.0; x += 1.98) {
      block(out, 'gravel', x, d.terrace + 0.012, 11.36, 0.05, 0.018, 2.97, joinColor);
    }
  }
}

function gardenWing(out, level) {
  const wing = rect(-15.55, -8.32, -11.95, -2.7);
  const lo = d.groundFloorRelativeHeight + 0.06;
  shell(out, wing, (p) => Math.min(grade(p) - 0.22, lo - 0.38), lo, {
    wall: 'brick',
    color: colors.shadedClinker,
  });
  facade(out, level, wing, lo, lo + 2.56, [
    [[1.92, 1.39]],
    [],
    [[1.9, 1.06, 'door']],
    [[3.82, 1.47]],
  ]);
  const y = lo + 2.3;
  for (const x of [-15.47, -12.0]) {
    beam(out, 'solid', [x, y, -2.73], [x, y, 2.25], 0.17, 0.16, colors.timber);
    beam(out, 'solid', [x, lo, 2.25], [x, y, 2.25], 0.14, 0.14, colors.timber);
  }
  const count = [3, 5, 8, 12][level];
  for (let i = 0; i < count; i++) {
    const z = mix(-2.6, 2.2, i / (count - 1));
    beam(out, 'solid', [-15.62, y + 0.12, z], [-11.86, y + 0.12, z], 0.15, 0.086, colors.timber);
  }
}

function build(out, level) {
  wallsAndTerraces(out, level);
  facade(out, level, d.outline, d.groundFloorRelativeHeight, d.familyFloorHeight, groundOpenings);
  facade(out, level, familyOutline, d.familyFloorHeight, d.staffFloorHeight, familyOpenings);
  facade(
    out,
    level,
    staffOutline,
    d.staffFloorHeight,
    d.topRoof,
    staffOpenings,
    colors.shadedClinker,
  );
  block(out, 'brick', -1.32, d.staffFloorHeight, 1.25, 0.77, 2.44, 0.77, colors.clinker);
  gardenWing(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'villa-wolf-model.mjs';
const camera = [42, 25, 55],
  lookAt = [-1, 2.5, 6];
const lods = { district: 0.43, street: 0.18, closeup: 0.057 };
export const villaWolfAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'landmark',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The native Villa Wolf ruins mark the hillside site. The original terrain sets the entry datum and holds the slope beneath the two estimated retaining terraces.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  },
  brief:
    'Interwar Villa Wolf on the hillside above the Neisse, with interlocking clinker volumes, glazed river-facing rooms and retaining terraces.',
  camera,
  lookAt,
  sunDirection: [47, 75, 69],
  mediumFiContext: {
    scale: 1,
    groundY: -1.25,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'gravel', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'villa-and-river-terraces', position: [-39, 25, 51], lookAt: [-1, 2.5, 7] },
    { name: 'glazed-living-rooms', position: [18, 7, 27], lookAt: [1, 3.1, 4.5] },
    { name: 'upper-entry-and-service-wing', position: [-30, 14, -35], lookAt: [-3, 2.9, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'villa-wolf-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Geographic context © OpenStreetMap contributors, ODbL 1.0.',
};
