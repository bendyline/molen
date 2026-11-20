import { readFileSync } from 'node:fs';
import {
  arch,
  block,
  cap,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  plane,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const floor = d.mainFloor;

const tone = palette({
  ivory: 'd4cbbb',
  cream: 'e4d4af',
  soiled: 'a6a18f',
  stone: 'aaa292',
  brown: '998c72',
  tile: '9d4e39',
  tileLight: 'a65840',
  ridge: 'bea87a',
  ridgeLight: 'ddc795',
  red: '872f2f',
  redLight: 'a54842',
  darkWood: '5b392d',
  wood: '713e36',
  gold: 'c4a467',
  darkGold: '8e733e',
  glass: '524f43',
  black: '413b31',
  towerRoof: '5e4b37',
});
const surfaces = {
  plaster: surface('wall', 'plaster_lime', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'tile_flat', 0.91),
  wood: surface('trim', 'wood_plain', 0.88),
  detail: surface('trim', 'metal_painted', 0.88, 0.09),
  glass: surface('window', 'window_grid', 0.63),
};

function tileRoof(out, roof, lod) {
  const { left, right, rear, front, base, rise, trim } = roof;
  const centerZ = (rear + front) * 0.5,
    midX = (left + right) * 0.5;
  const halfWest = (right - left) * 0.5;
  const gableWidth = Math.min(2.2, (front - rear) * 0.18);
  const steps = lod === 0 ? 3 : 7;
  for (let i = 0; i < steps; i++) {
    const u0 = i / steps,
      u1 = (i + 1) / steps;
    function pt(u, side, level) {
      const eave = mix(left, right, u);
      const end = Math.abs(u - 0.5) * 2;
      const cornerRise = Math.pow(end, 3) * 0.31;
      return [
        eave + (midX - eave) * (level === 1 ? gableWidth / halfWest : 0),
        base + cornerRise + (level === 1 ? rise : level * rise * 0.85),
        level === 1 ? centerZ : mix(side, centerZ, level),
      ];
    }
    for (const side of [rear, front]) {
      face(
        out,
        'roof',
        [pt(u0, side, 0), pt(u1, side, 0), pt(u1, side, 0.56), pt(u0, side, 0.56)],
        up,
        i % 3 === 0 ? tone.tileLight : trim,
      );
      face(
        out,
        'roof',
        [pt(u0, side, 0.56), pt(u1, side, 0.56), pt(u1, side, 1), pt(u0, side, 1)],
        up,
        i % 4 === 0 ? tone.tileLight : trim,
      );
      if (lod > 1) {
        const pa = pt(u0, side, 0),
          pb = pt(u1, side, 0);
        const q = (p, y0) => [p[0], p[1] + y0, p[2] + (side === front ? 0.019 : -0.019)];
        face(
          out,
          'plaster',
          [q(pa, -0.13), q(pb, -0.13), q(pb, 0.025), q(pa, 0.025)],
          [0, 0, side === front ? 1 : -1],
          tone.ridge,
        );
      }
    }
  }
  const lx = left + gableWidth,
    rx = right - gableWidth,
    y = base + rise + 0.31;
  for (const [x, g] of [
    [left, lx],
    [right, rx],
  ]) {
    const normal = [Math.sign(x - midX), 0, 0];
    face(
      out,
      'roof',
      [
        [x, base + 0.31, rear],
        [x, base + 0.31, front],
        [g, y, centerZ],
      ],
      normal,
      trim,
    );
  }
  block(
    out,
    'plaster',
    lx,
    base + rise + 0.07,
    centerZ - 0.11,
    rx - lx,
    0.24,
    0.22,
    tone.ridgeLight,
  );
  return { centerZ, midX, base: base + rise + 0.22, left: lx, right: rx };
}

function ridgeDetail(out, datum, lod) {
  const { midX, centerZ, base, left, right } = datum;
  const n = lod === 0 ? 5 : 10;
  function dragon(center, direction, scale) {
    const curve = (i, upper) => {
      const t = i / n;
      return [
        center + direction * t * scale,
        base +
          0.13 +
          Math.sin(t * Math.PI * 2.2) * 0.25 * scale +
          t * t * 0.31 * scale +
          (upper ? 0.16 * scale : 0),
        centerZ + 0.01,
      ];
    };
    for (let i = 0; i < n; i++) {
      const vertices = [curve(i, false), curve(i + 1, false), curve(i + 1, true), curve(i, true)];
      for (const sign of [-1, 1])
        face(
          out,
          'plaster',
          vertices.map(([x, y, z]) => [x, y, z + 0.035 * sign]),
          [0, 0, sign],
          i % 2 ? tone.ridgeLight : tone.ridge,
        );
    }
    if (lod === 0) return;
    const [x, y, z] = curve(n, true);
    for (const side of [-1, 1]) {
      face(
        out,
        'detail',
        [
          [x - 0.2, y, z + side * 0.06],
          [x + 0.17, y + 0.07, z + side * 0.06],
          [x + direction * 0.05, y + 0.26, z + side * 0.06],
        ],
        [0, 0, side],
        tone.gold,
      );
    }
  }
  for (const dir of [-1, 1]) dragon(midX + dir * 2.85, -dir, 1.74);
  const sun = (t) => [midX + 0.34 * Math.cos(t), base + 0.63 + 0.3 * Math.sin(t), centerZ + 0.045];
  const sunPoints = Array.from({ length: lod > 1 ? 12 : 8 }, (_, i) =>
    sun((2 * Math.PI * i) / (lod > 1 ? 12 : 8)),
  );
  for (const sign of [-1, 1])
    face(
      out,
      'detail',
      sunPoints.map(([x, y]) => [x, y, centerZ + sign * 0.08]),
      [0, 0, sign],
      tone.gold,
    );
  if (lod > 0) {
    dragon(left + 0.73, -1, 0.64);
    dragon(right - 0.73, 1, 0.64);
  }
}

function sanctuary(out, lod) {
  const outline = d.outline;
  const porch = d.mainFrontZ - 3.09,
    eave = floor + 4.54;
  shell(out, outline, (p) => Math.min(floor - 0.24, grade(p) - 0.28), floor, {
    wall: 'stone',
    color: tone.stone,
  });
  cap(out, 'stone', outline, floor, tone.cream);
  shell(
    out,
    outline,
    () => floor,
    eave,
    { wall: 'plaster', color: tone.ivory },
    (i) => i !== 5,
  );
  const w = plane(porch, 1);
  panel(out, 'plaster', w, -13.47, 13.25, floor, eave, 0, tone.cream);
  for (const [x, width] of [
    [-8.15, 1.48],
    [-4.83, 2.06],
    [-1.85, 2.41],
    [1.34, 2.39],
    [4.48, 2.15],
    [7.89, 1.46],
  ]) {
    panel(
      out,
      'wood',
      w,
      x - width / 2,
      x + width / 2,
      floor + 0.08,
      eave - 0.44,
      0.059,
      tone.wood,
    );
    panel(
      out,
      'glass',
      w,
      x - width * 0.36,
      x + width * 0.36,
      floor + 0.82,
      eave - 0.69,
      0.085,
      tone.glass,
    );
    if (lod > 1) {
      for (const [low, high] of [
        [floor + 0.45, floor + 0.52],
        [floor + 1.57, floor + 1.63],
        [floor + 2.91, floor + 2.98],
      ]) {
        panel(out, 'wood', w, x - width * 0.49, x + width * 0.49, low, high, 0.108, tone.redLight);
      }
      panel(out, 'wood', w, x - 0.059, x + 0.059, floor + 0.12, eave - 0.48, 0.114, tone.red);
    }
  }
  const porchZ = d.mainFrontZ - 0.39;
  block(out, 'wood', -13.55, eave - 0.45, porchZ - 0.23, 26.9, 0.39, 0.47, tone.darkWood);
  const porchFace = plane(porchZ + 0.255, 1);
  for (const x of [-10.28, -6.1, -2.06, 2.0, 6.12, 10.25]) {
    ring(
      out,
      'wood',
      [x, porchZ],
      [
        [floor + 0.15, 0.235],
        [eave - 0.55, 0.218],
        [eave - 0.47, 0.32],
      ],
      lod === 3 ? 12 : lod === 0 ? 5 : 7,
      tone.redLight,
    );
    ring(
      out,
      'stone',
      [x, porchZ],
      [
        [floor - 0.015, 0.35],
        [floor + 0.14, 0.35],
        [floor + 0.19, 0.25],
      ],
      lod === 3 ? 10 : lod === 0 ? 4 : 6,
      tone.stone,
    );
  }
  if (lod > 0) {
    for (let i = -21; i <= 21; i++) {
      const x = i * 0.6;
      panel(
        out,
        'detail',
        porchFace,
        x - 0.205,
        x + 0.205,
        eave - 0.31,
        eave - 0.23,
        0.012,
        i % 2 ? tone.gold : tone.darkGold,
      );
      if (lod > 1) {
        panel(
          out,
          'detail',
          porchFace,
          x - 0.21,
          x - 0.16,
          eave - 0.31,
          eave - 0.12,
          0.016,
          tone.ridgeLight,
        );
      }
    }
  }
  const main = tileRoof(
    out,
    {
      left: -14.37,
      right: 14.19,
      front: 18.69,
      rear: 5.84,
      base: eave + 0.07,
      rise: 2.74,
      trim: tone.tile,
    },
    lod,
  );
  const back = tileRoof(
    out,
    {
      left: -15.07,
      right: 14.0,
      front: -5.57,
      rear: -18.43,
      base: eave + 0.13,
      rise: 2.7,
      trim: tone.tile,
    },
    lod,
  );
  tileRoof(
    out,
    {
      left: -6.31,
      right: 5.54,
      front: 6.75,
      rear: -6.8,
      base: eave + 0.25,
      rise: 3.26,
      trim: tone.tile,
    },
    lod,
  );
  if (lod > 0) {
    ridgeDetail(out, main, lod);
    ridgeDetail(out, back, lod);
  }
  for (const [a, b] of [
    [
      [-13.47, 16],
      [-13.47, 7],
    ],
    [
      [-14.19, -16],
      [-14.19, -7],
    ],
    [
      [13.21, 7],
      [13.21, 16],
    ],
  ]) {
    const w = edge(a, b);
    for (const e of [0.26, 0.68]) {
      const x = w.length * e;
      panel(out, 'wood', w, x - 0.54, x + 0.54, floor + 1.41, eave - 0.8, 0.04, tone.darkWood);
      panel(out, 'glass', w, x - 0.43, x + 0.43, floor + 1.53, eave - 0.96, 0.057, tone.glass);
    }
  }
}

function avenue(out, lod) {
  const z = d.entryZ;
  for (const x of d.entryColumns) {
    const y = grade([x, z]) + 0.14;
    const parts = [
      [0, 0.29, 1.34, tone.soiled, 'stone'],
      [0.29, 0.47, 1.16, tone.red, 'wood'],
      [0.47, 0.75, 0.93, tone.black, 'wood'],
      [0.75, 4.5, 0.77, tone.ivory, 'plaster'],
      [4.5, 4.74, 1.04, tone.red, 'wood'],
      [4.74, 5.03, 1.16, tone.brown, 'stone'],
      [5.03, 5.15, 1.32, tone.ridge, 'plaster'],
    ];
    for (const [a, b, width, color, slot] of parts) {
      block(out, slot, x - width / 2, y + a, z - width / 2, width, b - a, width, color);
    }
    if (lod > 0) {
      const fp = plane(z + 0.388, 1);
      for (const side of [-1, 1]) {
        panel(
          out,
          'wood',
          fp,
          x + side * 0.28 - 0.035,
          x + side * 0.28 + 0.035,
          y + 0.84,
          y + 4.42,
          0.018,
          tone.red,
        );
      }
      panel(out, 'plaster', fp, x - 0.19, x + 0.19, y + 1.08, y + 4.27, 0.024, tone.cream);
    }
    const crest = [
      [y + 5.15, 0.44],
      [y + 5.32, 0.51],
      [y + 5.5, 0.29],
      [y + 5.62, 0.045],
    ];
    ring(out, 'detail', [x, z], crest, lod === 3 ? 9 : 6, tone.gold);
  }
  stairs(
    out,
    grade,
    'stone',
    -6.05,
    6.04,
    24.65,
    17.72,
    floor + 0.02,
    lod === 0 ? 4 : 8,
    tone.stone,
  );
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    const x = sign * 6.15;
    const start = grade([x, 24.35]) + 0.39;
    const points = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const t = i / 8;
      return [
        x + 0.18 * sign * Math.sin(t * Math.PI),
        mix(start, floor + 0.62, t) + 0.19 * Math.sin(t * Math.PI * 3),
        mix(24.31, 17.74, t),
      ];
    });
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      for (const side of [-1, 1]) {
        face(
          out,
          'stone',
          [
            [a[0] + side * 0.17, a[1], a[2]],
            [b[0] + side * 0.17, b[1], b[2]],
            [b[0] + side * 0.15, b[1] + 0.41, b[2]],
            [a[0] + side * 0.14, a[1] + 0.33, a[2]],
          ],
          [side, 0, 0],
          tone.stone,
        );
      }
      face(
        out,
        'stone',
        [
          [a[0] - 0.17, a[1] + 0.33, a[2]],
          [a[0] + 0.17, a[1] + 0.33, a[2]],
          [b[0] + 0.15, b[1] + 0.41, b[2]],
          [b[0] - 0.15, b[1] + 0.41, b[2]],
        ],
        up,
        tone.ivory,
      );
    }
    block(out, 'stone', x - 0.3, start - 0.1, 24.24, 0.62, 0.61, 0.56, tone.soiled);
  }
}

function pagoda(out, lod) {
  const [x, z] = d.tower,
    r = d.towerRadius,
    ground = grade(d.tower) + 0.2;
  const point = (i, radius) => [
    x + radius * Math.cos((2 * Math.PI * (i + 0.5)) / 8),
    z + radius * Math.sin((2 * Math.PI * (i + 0.5)) / 8),
  ];
  const perimeter = Array.from({ length: 8 }, (_, i) => point(i, r));
  shell(out, perimeter, (p) => Math.min(grade(p) - 0.3, ground - 0.15), ground + 0.41, {
    wall: 'stone',
    color: tone.stone,
  });
  const tiers = [
    [0.4, 3.1, 1, 0.88],
    [3.09, 5.66, 0.88, 0.7],
    [5.66, 8.34, 0.7, 0.58],
  ];
  for (const [bottom, top, baseRadius, topRadius] of tiers) {
    ring(
      out,
      'plaster',
      d.tower,
      [
        [ground + bottom, r * baseRadius],
        [ground + top, r * topRadius],
      ],
      8,
      tone.ivory,
    );
    ring(
      out,
      'plaster',
      d.tower,
      [
        [ground + top - 0.26, r * topRadius + 0.055],
        [ground + top + 0.04, r * topRadius + 0.1],
      ],
      8,
      tone.cream,
    );
    if (lod === 0) continue;
    for (let i = 0; i < 8; i++) {
      const width = (r * baseRadius + r * topRadius) * 0.38;
      const geom = edge(point(i, r * topRadius + 0.18), point(i + 1, r * topRadius + 0.18));
      arch(
        out,
        geom,
        geom.length / 2,
        ground + bottom + 0.31,
        ground + top - 0.92,
        width * 0.31,
        0.5,
        0.12,
        lod,
        { width: 0.1, trim: tone.brown, inner: tone.glass },
        { inner: 'glass', trim: 'plaster' },
      );
    }
  }
  const sections = [
    [ground + 8.02, 1.6],
    [ground + 8.2, 2.12],
    [ground + 8.43, 2.31],
    [ground + 9.18, 1.03],
    [ground + 9.72, 0.69],
    [ground + 10.02, 0.23],
  ];
  ring(out, 'roof', d.tower, sections, 8, tone.towerRoof);
  ring(
    out,
    'detail',
    d.tower,
    [
      [ground + 9.98, 0.27],
      [ground + 10.22, 0.19],
      [ground + 10.82, 0.03],
    ],
    8,
    tone.gold,
  );
  if (lod > 0) {
    ring(
      out,
      'detail',
      d.tower,
      [
        [ground + 8.42, 2.31],
        [ground + 8.5, 2.31],
      ],
      8,
      tone.ridge,
    );
  }
}

function build(out, lod) {
  sanctuary(out, lod);
  avenue(out, lod);
  pagoda(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'linh-son-temple-model.mjs';
const camera = [34, 19, 64],
  lookAt = [4, 5, 4];
export const linhSonModel = {
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
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The named hall and public footpath fix orientation. The masonry stair and gate use the independent original elevation field.',
  brief:
    'Đà Lạt’s Linh Sơn sanctuary with red-tiled interlocking halls, ridge dragons, paired entrance pillars and an octagonal tower.',
  camera,
  lookAt,
  sunDirection: [36, 45, 56],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.93,
    basis: 'The exact named main roofing outline defines the headhouse replacement footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'entrance-pillars-hall-and-tower', position: [29, 10.5, 56], lookAt: [3, 4.4, 13] },
    { name: 'red-veranda-and-dragon-ridge', position: [-13, 7.3, 36], lookAt: [0, 5.7, 15] },
    { name: 'octagonal-tower-and-tile-roofs', position: [40, 16, 12], lookAt: [14, 6.9, 5.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'linh-son-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.5, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Diane Selwyn’s local reference photographs were dedicated to the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
