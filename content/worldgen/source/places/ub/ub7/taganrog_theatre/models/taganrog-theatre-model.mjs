import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  cap,
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
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  cream: 'd0bea6',
  ashlar: 'd7c8b1',
  cornice: 'e4dac8',
  shadow: 'b39e85',
  roof: '8d9999',
  ridge: 'a3aeac',
  canopy: '527360',
  wrought: '51554c',
  foundation: 'a69888',
  brick: '996d58',
  brickTrim: '8a604d',
  glass: '485451',
  wood: '8c633c',
  casing: 'dedad0',
});
const surfaces = {
  wall: surface('wall', 'stucco', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.94),
  roof: surface('roof', 'metal_standing_seam', 0.76, 0.12),
  wood: surface('trim', 'wood_plain', 0.88),
  brick: surface('wall', 'brick_flemish', 0.94),
  iron: surface('trim', 'metal_bronze_cast', 0.79, 0.22),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};
const perimeter = (poly) => pairs(closed(poly)).map(([a, b]) => edge(a, b, areaSign(poly)));
const bottom = (p) => Math.min(grade(p) - 0.22, 0.22);
const platformY = 0.53;
const stoneCap = (out, w, y, width, color = c.cornice) =>
  trimBlock(out, 'wall', w, 0, w.length, y, y + width, 0.025, width * 0.61, color);
function hip(out, [x0, z0, x1, z1], y, rise, level, across = true) {
  const ridge = y + rise,
    midX = (x0 + x1) * 0.5,
    midZ = (z0 + z1) * 0.5;
  const p = [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  const a = across ? [mix(x0, x1, 0.22), ridge, midZ] : [midX, ridge, mix(z0, z1, 0.18)];
  const b = across ? [mix(x0, x1, 0.78), ridge, midZ] : [midX, ridge, mix(z0, z1, 0.82)];
  const planes = across
    ? [
        [p[0], p[1], b, a],
        [p[1], p[2], b],
        [p[2], p[3], a, b],
        [p[3], p[0], a],
      ]
    : [
        [p[0], p[1], a],
        [p[1], p[2], b, a],
        [p[2], p[3], b],
        [p[3], p[0], a, b],
      ];
  for (const points of planes) face(out, 'roof', points, up, c.roof);
  if (level >= 2) beam(out, 'roof', a, b, 0.12, 0.08, c.ridge);
}
function sideWindow(out, w, u, bottom, top, width, level, lower = false, door = false) {
  const half = width * 0.5,
    slot = door ? 'wood' : 'glass',
    color = door ? c.wood : c.glass;
  const spring = top - (lower ? 0.18 : 0.22);
  if (level === 0) {
    panel(out, slot, w, u - half, u + half, bottom, top, 0.08, color);
    return;
  }
  arch(
    out,
    w,
    u,
    bottom,
    spring,
    half,
    top - spring,
    0.066,
    Math.max(0, level - 1),
    { inner: color, trim: c.casing, width: door ? 0.105 : 0.14 },
    { inner: slot, trim: 'wall' },
  );
  if (level < 2) return;
  if (!door) {
    const mullion = level === 3 ? 0.046 : 0.07;
    panel(out, 'wall', w, u - mullion, u + mullion, bottom, spring + 0.14, 0.112, c.casing);
    for (const t of lower ? [0.48, 0.73] : [0.37, 0.73]) {
      const bar = mix(bottom, spring, t);
      panel(
        out,
        'wall',
        w,
        u - half - 0.01,
        u + half + 0.01,
        bar - 0.025,
        bar + 0.025,
        0.124,
        c.casing,
      );
    }
    trimBlock(
      out,
      'wall',
      w,
      u - half - 0.19,
      u + half + 0.19,
      bottom - 0.15,
      bottom - 0.028,
      0.024,
      0.23,
      c.cornice,
    );
    return;
  }
  panel(out, 'glass', w, u - half * 0.88, u + half * 0.88, top - 0.46, top - 0.15, 0.115, c.glass);
  panel(out, 'wood', w, u - 0.036, u + 0.036, bottom + 0.08, top - 0.44, 0.13, c.shadow);
  if (level === 3) {
    for (const side of [-0.5, 0.5]) {
      const p = u + half * side;
      for (const t of [0.24, 0.58]) {
        const y = mix(bottom, top, t);
        panel(
          out,
          'wood',
          w,
          p - half * 0.34,
          p + half * 0.34,
          y - 0.24,
          y + 0.27,
          0.124,
          c.shadow,
        );
      }
    }
  }
}
function streetLower(out, level) {
  const top = 4.65;
  const poly = d.outline;
  const walls = pairs(closed(poly));
  for (const [a, b] of walls) {
    const w = edge(a, b, areaSign(poly)),
      front = Math.min(a[1], b[1]) > 9;
    const color = front ? c.cream : c.brick;
    const slot = front ? 'wall' : 'brick';
    face(
      out,
      slot,
      [w.p(0, bottom(a)), w.p(w.length, bottom(b)), w.p(w.length, top), w.p(0, top)],
      w.normal,
      color,
    );
    face(
      out,
      'stone',
      [
        w.p(0, bottom(a), 0.036),
        w.p(w.length, bottom(b), 0.036),
        w.p(w.length, 0.48, 0.036),
        w.p(0, 0.48, 0.036),
      ],
      w.normal,
      c.foundation,
    );
    if (front) stoneCap(out, w, top - 0.19, 0.19);
    if (level >= 2 && !front && w.length > 8) {
      const n = Math.round(w.length / 5.1);
      for (let i = 0; i < n; i++)
        sideWindow(out, w, (w.length * (i + 0.5)) / n, 1.24, 3.36, 0.91, level, true);
    }
  }
  cap(out, 'roof', poly, top, c.roof);
  const [left, right] = [-15.125, 20.466],
    z = d.streetEdge + 0.019;
  const w = edge([right, z], [left, z]);
  const bays = [
    [-12.35, 'window'],
    [-8.61, 'door'],
    [-5.35, 'door'],
    [-2.56, 'window'],
    [0.21, 'door'],
    [3.35, 'door'],
    [7.72, 'door'],
    [11.13, 'window'],
    [14.38, 'door'],
    [17.01, 'door'],
    [19.31, 'window'],
  ];
  for (const [x, kind] of bays) {
    const door = kind === 'door';
    const width = door ? 1.24 : 1.13;
    const u = right - x;
    sideWindow(out, w, u, door ? 0.54 : 1.02, 3.52, width, level, true, door);
    if (level >= 1) panel(out, 'wall', w, u - 0.17, u + 0.17, 3.52, 3.81, 0.15, c.cornice);
  }
  if (level >= 1) {
    for (const y of [0.68, 1.08, 1.48, 1.88, 2.28, 2.68, 3.08, 3.48, 3.88, 4.28])
      panel(out, 'wall', w, 0, w.length, y, y + 0.048, 0.042, c.shadow);
    for (const x of [left + 0.24, -10.75, 15.54, right - 0.22]) {
      const u = right - x;
      for (let j = 0; j < 9; j++) {
        const y = 0.64 + j * 0.41;
        trimBlock(
          out,
          'wall',
          w,
          Math.max(0, u - 0.32),
          Math.min(w.length, u + 0.32),
          y,
          y + 0.34,
          0.034,
          0.135,
          c.ashlar,
        );
      }
    }
  }
  stairs(
    out,
    grade,
    'stone',
    -4.15,
    8.52,
    d.streetEdge + 2.39,
    d.streetEdge - 0.004,
    platformY,
    level > 0 ? 4 : 2,
    c.foundation,
  );
}
function upperFront(out, level) {
  const [left, near, right, front] = d.upperFront,
    top = d.frontEave;
  const body = rect(left, near, right, front);
  shell(out, body, () => 4.58, top, { wall: 'wall', roof: 'wall', color: c.cream });
  const w = edge([right, front], [left, front]);
  for (const x of [-7.42, -2.48, 2.39, 7.16, 12.6])
    sideWindow(out, w, right - x, 5.26, 8.96, 1.58, level);
  for (const mirror of [false, true]) {
    const side = mirror ? edge([left, front], [left, near]) : edge([right, near], [right, front]);
    if (level >= 1) {
      for (const u of [3.31, 8.62]) sideWindow(out, side, u, 5.26, 8.16, 1.04, level);
    }
    stoneCap(out, side, top - 0.27, 0.27);
    stoneCap(out, side, 4.76, 0.24, c.ashlar);
  }
  for (const width of [0.21, 0.11]) stoneCap(out, w, top - 0.16 - width, width, c.cornice);
  stoneCap(out, w, 4.83, 0.21);
  for (const x of [left + 0.39, -5.19, 9.99, right - 0.39]) {
    const u = right - x;
    trimBlock(out, 'wall', w, u - 0.26, u + 0.26, 4.85, 9.72, 0.002, 0.22, c.ashlar);
    trimBlock(out, 'wall', w, u - 0.34, u + 0.34, 9.69, 10.01, 0.03, 0.25, c.cornice);
    trimBlock(out, 'wall', w, u - 0.31, u + 0.31, 4.93, 5.22, 0.06, 0.24, c.cornice);
  }
  if (level >= 1) {
    for (const y of [5.16, 5.61, 6.06, 6.51, 6.96, 7.41, 7.86, 8.31, 8.76, 9.21, 9.66])
      panel(out, 'wall', w, 0, w.length, y, y + 0.048, 0.03, c.shadow);
  }
  hip(out, [left - 0.22, near - 0.2, right + 0.22, front + 0.21], top - 0.02, 2.08, level);
  const base = [-5.97, 11.35],
    mid = (base[0] + base[1]) * 0.5,
    z = front + 0.29;
  const apex = [mid, d.frontPedimentTop, z];
  const leftBase = [base[0], top + 0.05, z],
    rightBase = [base[1], top + 0.05, z];
  face(out, 'wall', [leftBase, rightBase, apex], [0, 0, 1], c.cream);
  face(
    out,
    'roof',
    [leftBase, apex, [mid, top + 1.42, front - 3.33], [base[0], top - 0.02, front - 1.6]],
    up,
    c.roof,
  );
  face(
    out,
    'roof',
    [apex, rightBase, [base[1], top - 0.02, front - 1.6], [mid, top + 1.42, front - 3.33]],
    up,
    c.roof,
  );
  beam(out, 'wall', leftBase, apex, 0.38, 0.19, c.cornice);
  beam(out, 'wall', apex, rightBase, 0.38, 0.19, c.cornice);
  if (level >= 1) beam(out, 'wall', leftBase, rightBase, 0.22, 0.23, c.cornice);
}
function auditoriumAndStage(out, level) {
  const shoulder = [
    [-16.93, -10.55],
    [-17.84, -32.5],
    [15.89, -37.54],
    [16.58, -1.86],
    [13.61, -1.72],
    [13.8, 10.85],
    [19.92, 10.83],
    [19.88, 18.9],
    [-10.75, 18.9],
    [-10.78, 9.3],
    [-16.97, 9.28],
  ];
  const eave = 10.25;
  shell(out, shoulder, () => 4.62, eave, {
    wall: 'brick',
    roof: 'roof',
    color: c.brick,
    roofColor: c.roof,
  });
  const w = perimeter(shoulder);
  for (const [i, side] of w.entries()) {
    if (i < 4 || i === 9 || i === 10) {
      stoneCap(out, side, eave - 0.24, 0.19, c.brickTrim);
      if (level > 0 && side.length > 7) {
        const count = Math.max(2, Math.round(side.length / 5.42));
        for (let j = 0; j < count; j++) {
          const u = (side.length * (j + 0.5)) / count;
          sideWindow(out, side, u, 5.72, 8.58, 0.93, Math.max(0, level - 1));
          if (level >= 2)
            trimBlock(
              out,
              'brick',
              side,
              u - 0.97,
              u - 0.81,
              4.61,
              eave - 0.28,
              0.026,
              0.091,
              c.brickTrim,
            );
        }
      }
    }
  }
  const [x0, z0, x1, z1] = d.stageBlock,
    rim = d.stageParapet;
  const stage = rect(x0, z0, x1, z1);
  shell(out, stage, () => eave - 0.12, rim - 0.07, {
    wall: 'brick',
    roof: 'roof',
    color: c.brick,
    roofColor: c.roof,
  });
  for (const side of perimeter(stage)) {
    trimBlock(out, 'brick', side, 0, side.length, rim - 0.33, rim + 0.03, 0.038, 0.17, c.brickTrim);
    if (level >= 1) {
      for (const t of [0.19, 0.5, 0.81]) {
        const u = t * side.length;
        panel(out, 'brick', side, u - 0.13, u + 0.13, eave - 0.01, rim - 0.43, 0.09, c.brickTrim);
        if (level >= 2) sideWindow(out, side, u + 0.72, rim - 2.73, rim - 0.95, 0.64, level, false);
      }
    }
  }
  hip(out, [-13.9, -11.8, 13.3, 15.9], eave - 0.015, 2.2, level, false);
  if (level >= 1) {
    for (const [x, z, y] of [
      [-9.5, 11.15, 11.02],
      [12.7, 11.2, 10.24],
      [-12.5, 6.9, 10.46],
      [9.7, -12, 11.25],
    ]) {
      block(out, 'brick', x - 0.37, y, z - 0.34, 0.74, 1.18, 0.68, c.ashlar);
      block(out, 'wall', x - 0.45, y + 1.02, z - 0.42, 0.9, 0.18, 0.84, c.cornice);
    }
  }
  if (level >= 2) {
    for (const [i, x] of [-1.52, 0.12, 1.8, 5.02].entries()) {
      const z = 14.1 - i * 0.48,
        y = 11.8 + (i % 2) * 0.13;
      loft(
        out,
        'roof',
        [
          [y - 0.88, 0.14],
          [y + 0.47, 0.14],
          [y + 0.51, 0.195],
        ].map(([h, r]) => radialRing(h, r, r, 8, [x, z])),
        c.ridge,
      );
    }
  }
}
function canopy(out, level) {
  const x = 1.84,
    z = d.streetEdge,
    front = z + 2.34,
    eave = 4.23,
    ridge = 5.24,
    half = 2.72;
  const p = [
    [x - half, eave, front],
    [x + half, eave, front],
    [x, ridge, front],
  ];
  for (const [a, b] of [
    [p[0], p[2]],
    [p[2], p[1]],
  ]) {
    const back = [a[0], a[1], z - 0.06],
      tail = [b[0], b[1], z - 0.06];
    face(out, 'roof', [a, b, tail, back], up, c.canopy);
    beam(out, 'iron', a, b, 0.12, 0.105, c.wrought);
  }
  beam(out, 'iron', p[0], p[1], 0.105, 0.105, c.wrought);
  for (const dir of [-1, 1]) {
    const X = x + dir * (half - 0.14),
      base = grade([X, front]) + 0.44;
    const n = level > 1 ? 8 : 4;
    const stack = [
      [base - 0.05, 0.16],
      [base + 0.21, 0.16],
      [base + 0.43, 0.081],
      [eave - 0.21, 0.079],
      [eave, 0.14],
    ];
    loft(
      out,
      'iron',
      stack.map(([y, r]) => radialRing(y, r, r, n, [X, front])),
      c.wrought,
    );
  }
  if (level < 2) return;
  for (const side of [-1, 1]) {
    const leaf = [
      [x + side * 0.18, eave + 0.16, front + 0.075],
      [x + side * 0.62, eave + 0.65, front + 0.074],
      [x + side * 1.08, eave + 0.5, front + 0.075],
      [x + side * 1.32, eave + 0.16, front + 0.074],
    ];
    for (const [a, b] of pairs(leaf)) beam(out, 'iron', a, b, 0.05, 0.044, c.wrought);
    beam(
      out,
      'iron',
      [x + side * 2.26, eave + 0.055, front],
      [x + side * 0.49, eave + 0.41, front],
      0.047,
      0.04,
      c.wrought,
    );
  }
}
function wings(out, level) {
  for (const [x, z, width] of [
    [-13.5, 22.2, 3.95],
    [17.96, 23.1, 4.32],
  ]) {
    hip(
      out,
      [x - width * 0.5, z - 6.3, x + width * 0.5, d.streetEdge + 0.15],
      4.63,
      0.62,
      level,
      false,
    );
    if (level >= 1) {
      const w = edge(
        [x + width * 0.5 - 0.13, d.streetEdge + 0.11],
        [x - width * 0.5 + 0.13, d.streetEdge + 0.11],
      );
      const count = level >= 2 ? 10 : 4;
      for (let k = 0; k <= count; k++) {
        const u = (k * w.length) / count;
        beam(out, 'iron', w.p(u, 4.77, 0.1), w.p(u, 5.29, 0.1), 0.043, 0.043, c.wrought);
      }
      beam(out, 'iron', w.p(0, 5.21, 0.1), w.p(w.length, 5.21, 0.1), 0.048, 0.06, c.wrought);
      for (const q of [x - width * 0.46, x + width * 0.46])
        block(out, 'wall', q - 0.26, 4.52, d.streetEdge - 0.24, 0.52, 0.91, 0.47, c.ashlar);
    }
  }
}
function build(out, level) {
  streetLower(out, level);
  upperFront(out, level);
  auditoriumAndStage(out, level);
  canopy(out, level);
  wings(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'taganrog-theatre-model.mjs';
const camera = [64, 31, 96],
  lookAt = [2, 6, 2];
const errors = { district: 0.59, street: 0.21, closeup: 0.075 };
export const taganrogTheatreAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'performance-sport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original terrain at 90 Petrovskaya Street near the front entrance treads.',
  brief:
    'The cream 1866 Chekhov Theatre with five tall windows, a shallow triangular pediment, green gabled canopy and deep red-brick backstage section.',
  camera,
  lookAt,
  sunDirection: [54, 95, 53],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named current 15-vertex theater envelope.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'street-elevation-and-entrance-canopy', position: [23, 8.5, 60], lookAt: [2, 5.3, 25] },
    { name: 'stagehouse-and-auditorium-roof', position: [48, 26, -53], lookAt: [2, 8, -12] },
    { name: 'five-window-cream-front', position: [-20, 12.6, 60], lookAt: [2, 6, 22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'taganrog-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.08,
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
