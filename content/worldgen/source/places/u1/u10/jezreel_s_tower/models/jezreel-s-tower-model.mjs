import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  pairs,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const warmBrick = rgb('9b7959');
const lightBrick = rgb('a88c68');
const mutedBrick = rgb('937356');
const blueBrick = rgb('675e58');
const sandstone = rgb('bda381');
const tile = rgb('bda882');
const relief = rgb('9d805d');
const iron = rgb('534d44');
const ironLight = rgb('686055');
const concrete = rgb('999184');
const bottom = rgb('777264');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  accent: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  concrete: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.22 },
};
const half = plan.dimensions.principalWidthM / 2;
const crest = plan.dimensions.asBuiltCornerHeightApproxM;
const outerFaces = [
  facade([0, half], [1, 0]),
  facade([half, 0], [0, -1]),
  facade([0, -half], [-1, 0]),
  facade([-half, 0], [0, 1]),
];
const sections = [
  [-half, -13.3, 'tower'],
  [-13.3, -2.76, 'bay'],
  [-2.76, 2.76, 'tower'],
  [2.76, 13.3, 'bay'],
  [13.3, half, 'tower'],
];
const rows = [
  [0.85, 3.03],
  [4.06, 10.7],
  [11.72, 20.15],
  [21.2, 25.42],
  [26.22, 29.47],
  [30.23, 33.39],
];
const base = -0.77;
const depth = 0.79;
const recess = -2.02;
const ribs = plan.dimensions.hallRoofGirderCount;

function panel(out, slot, F, left, right, low, high, d, color, direction = 1) {
  const vertices = [F.P(left, low, d), F.P(right, low, d), F.P(right, high, d), F.P(left, high, d)];
  if (direction < 0) vertices.reverse();
  quad4(out, slot, ...vertices, color);
}
function masonry(out, F, left, right, low, high, d, color, level, slot = 'brick') {
  if (level < 3) {
    panel(out, slot, F, left, right, low, high, d, color);
    if (level === 2) panel(out, slot, F, left, right, low, high, d - depth, color, -1);
    return;
  }
  fbox(out, slot, F, left, right, low, high, d - depth, d, color, { bottom: true });
}
function apertureRow(out, F, left, right, low, high, d, count, level, split) {
  const border = level === 1 ? 0.66 : 0.37;
  const brickWidth = level === 1 ? 0.58 : split ? 0.29 : 0.33;
  const total = right - left - 2 * border;
  const opening = (total - (count - 1) * brickWidth) / count;
  masonry(out, F, left, left + border, low, high, d, warmBrick, level);
  masonry(out, F, right - border, right, low, high, d, mutedBrick, level);
  let x = left + border;
  for (let i = 0; i < count; i++) {
    if (level >= 2) {
      if (split) {
        const center = low + (high - low) * 0.53;
        fbox(
          out,
          'accent',
          F,
          x,
          x + opening,
          center - 0.13,
          center + 0.13,
          d - depth,
          d + 0.09,
          sandstone,
          { bottom: true },
        );
      }
      if (level >= 3) {
        for (const edge of [x, x + opening])
          fbox(
            out,
            'accent',
            F,
            edge - 0.073,
            edge + 0.073,
            low - 0.035,
            high + 0.035,
            d - 0.09,
            d + 0.072,
            sandstone,
            { bottom: true },
          );
      }
    }
    x += opening;
    if (i < count - 1) {
      masonry(out, F, x, x + brickWidth, low, high, d, warmBrick, level);
      x += brickWidth;
    }
  }
  if (level === 2) {
    for (const [y, facing] of [
      [low, 1],
      [high, -1],
    ]) {
      const points = [
        F.P(left + border, y, d),
        F.P(right - border, y, d),
        F.P(right - border, y, d - depth),
        F.P(left + border, y, d - depth),
      ];
      face(out, 'accent', points, [0, facing, 0], sandstone);
      panel(out, 'accent', F, left + 0.1, right - 0.1, y - 0.1, y + 0.1, d + 0.026, sandstone);
    }
  }
  if (level >= 3) {
    fbox(
      out,
      'accent',
      F,
      left + 0.11,
      right - 0.11,
      low - 0.17,
      low + 0.034,
      d - 0.15,
      d + 0.14,
      sandstone,
    );
    fbox(
      out,
      'accent',
      F,
      left + 0.11,
      right - 0.11,
      high - 0.028,
      high + 0.185,
      d - 0.16,
      d + 0.14,
      sandstone,
    );
  }
}
function plaque(out, F, left, right, low, high, d, device, level) {
  const width = (right - left) * 0.68;
  const mid = (left + right) / 2;
  const x0 = mid - width / 2,
    x1 = mid + width / 2;
  const y0 = low + 0.32,
    y1 = high - 0.32;
  panel(out, 'accent', F, x0, x1, y0, y1, d + 0.02, relief);
  panel(out, 'accent', F, x0 + 0.22, x1 - 0.22, y0 + 0.25, y1 - 0.25, d + 0.04, tile);
  if (level < 2) return;
  const p = (u, v) => F.P(mid + u * (width * 0.45), y0 + v * (y1 - y0), d + 0.065);
  const line = (verts, w = 0.1) => {
    for (const [a, b] of pairs(verts)) beam(out, 'accent', p(...a), p(...b), w, 0.05, relief);
  };
  if (device === 'swords') {
    line([
      [-0.53, 0.33],
      [0.48, 0.72],
    ]);
    line([
      [0.53, 0.33],
      [-0.48, 0.72],
    ]);
    line([
      [-0.57, 0.42],
      [-0.35, 0.29],
    ]);
    line([
      [0.57, 0.42],
      [0.35, 0.29],
    ]);
    line([
      [-0.3, 0.77],
      [-0.22, 0.85],
      [0, 0.8],
      [0.22, 0.85],
      [0.3, 0.77],
    ]);
  } else if (device === 'trumpet') {
    line([
      [-0.67, 0.56],
      [0.37, 0.56],
      [0.68, 0.65],
      [0.68, 0.49],
      [0.37, 0.56],
    ]);
    line(
      [
        [-0.45, 0.46],
        [0.42, 0.46],
        [0.42, 0.32],
        [-0.56, 0.32],
      ],
      0.07,
    );
  } else {
    for (const s of [-1, 0, 1])
      line(
        [
          [0, 0.36],
          [s * 0.19, 0.59],
          [s * 0.29, 0.77],
          [s * 0.46, 0.72],
        ],
        0.086,
      );
    line(
      [
        [-0.32, 0.28],
        [0.32, 0.28],
      ],
      0.071,
    );
  }
}

function distantOutline(out) {
  for (const F of outerFaces) {
    for (const [left, right, kind] of sections) {
      const tower = kind === 'tower';
      const d = tower ? 0 : recess;
      const color = tower ? warmBrick : mutedBrick;
      const edge = (right - left) * 0.207;
      const vertical = (x0, x1, y0, y1, c = color) => panel(out, 'brick', F, x0, x1, y0, y1, d, c);
      const interior = (x0, x1, y0, y1) =>
        panel(out, 'brick', F, x0, x1, y0, y1, d - 0.5, mutedBrick, -1);
      const roof = tower ? crest : 34.09;
      vertical(left, right, base, 3.2, blueBrick);
      vertical(left, left + edge, 3.2, roof);
      vertical(right - edge, right, 3.2, roof);
      interior(left, left + edge, 3.2, roof);
      interior(right - edge, right, 3.2, roof);
      face(
        out,
        'brick',
        [
          F.P(left, roof, d),
          F.P(right, roof, d),
          F.P(right, roof, d - 0.5),
          F.P(left, roof, d - 0.5),
        ],
        up,
        lightBrick,
      );
      if (!tower || left === -2.76) vertical(left + edge, right - edge, 3.2, 20.67);
      else {
        vertical(left + edge, right - edge, 10.7, 11.72);
        vertical(left + edge, right - edge, 20.15, 20.68);
      }
      const mid = (left + right) / 2;
      vertical(mid - 0.3, mid + 0.3, 3.2, roof, lightBrick);
      for (const [lo, hi] of [
        [20.68, 21.2],
        [25.1, 26.33],
        [29.22, 30.44],
        [33.39, roof],
      ]) {
        vertical(left + edge, right - edge, lo, hi, lightBrick);
        interior(left + edge, right - edge, lo, hi);
      }
      if (!tower) {
        for (let i = 0; i < 5; i++) {
          const step = (right - left) / 5,
            x = left + i * step + 0.14;
          vertical(x, x + step * 0.51, 34.09, 34.5, lightBrick);
        }
      }
    }
    for (const [i, x] of [-13.3, -2.76, 2.76, 13.3].entries()) {
      const [X, , Z] = F.P(x, 0, 0);
      const strip = facade([X, Z], F.normal);
      panel(out, 'brick', strip, recess, 0, base, 34.07, 0, mutedBrick, i % 2 === 0 ? -1 : 1);
    }
  }
}

function elevations(out, level) {
  for (const [side, F] of outerFaces.entries()) {
    for (const [index, [left, right, kind]] of sections.entries()) {
      const tower = kind === 'tower',
        central = index === 2;
      const d = tower ? 0 : recess;
      const upper = tower ? crest : 34.1;
      masonry(out, F, left, right, base, rows[0][0], d, blueBrick, level);
      if (level >= 1) {
        const riser = tower ? d + 0.031 : d + 0.026;
        for (const y of [-0.1, 0.43, 3.42, 3.72])
          panel(out, 'brick', F, left, right, y, y + 0.135, riser, lightBrick);
      }
      for (const [j, [low, high]] of rows.entries()) {
        const prev = j === 0 ? low : rows[j - 1][1];
        if (j > 0)
          masonry(out, F, left, right, prev, low, d, j === 4 ? lightBrick : warmBrick, level);
        if (!tower && (j === 1 || j === 2)) {
          masonry(out, F, left, right, low, high, d, mutedBrick, level);
          if (level >= 1 && j === 1) {
            const middle = (left + right) / 2;
            plaque(out, F, left + 0.7, middle - 0.13, low + 0.54, high - 0.55, d, 'plain', 1);
            plaque(out, F, middle + 0.13, right - 0.7, low + 0.54, high - 0.55, d, 'plain', 1);
          }
          if (j === 2)
            plaque(
              out,
              F,
              left + 0.86,
              right - 0.86,
              low + 0.46,
              high - 0.43,
              d,
              index === 1 ? 'trumpet' : 'swords',
              level,
            );
        } else if (central && j === 2) {
          masonry(out, F, left, right, low, high, d, warmBrick, level);
          plaque(out, F, left + 0.28, right - 0.28, low + 0.54, high - 0.48, d, 'feathers', level);
        } else {
          const count = j < 3 || level === 1 ? 2 : tower ? (j === 5 ? 4 : 3) : 5;
          apertureRow(out, F, left, right, low, high, d, count, level, j < 3 && j > 0);
        }
      }
      masonry(out, F, left, right, rows.at(-1)[1], upper, d, warmBrick, level);
      if (!tower) {
        const count = level === 1 ? 6 : 9;
        for (let i = 0; i < count; i++) {
          const step = (right - left) / count,
            x = left + i * step + 0.14;
          masonry(out, F, x, x + step * 0.51, 33.89, 34.5, d, lightBrick, level);
        }
      }
      if (level >= 1) {
        const beltY = tower ? 33.66 : 33.47;
        fbox(out, 'brick', F, left, right, beltY, beltY + 0.25, d - 0.29, d + 0.15, blueBrick);
        if (level >= 2) {
          const n = Math.ceil((right - left) / 0.5);
          for (let i = 0; i < n; i++) {
            const x = left + 0.14 + (i * (right - left)) / n;
            masonry(out, F, x, x + 0.12, beltY + 0.24, beltY + 0.62, d + 0.11, lightBrick, level);
          }
        }
      }
    }
    const breaks = [-13.3, -2.76, 2.76, 13.3];
    for (const [i, x] of breaks.entries()) {
      const thickness = i % 2 === 0 ? 0.28 : -0.28;
      fbox(
        out,
        'brick',
        F,
        x + Math.min(0, thickness),
        x + Math.max(0, thickness),
        base,
        34.09,
        recess - depth,
        0.01,
        i % 2 === side % 2 ? warmedSide(side) : mutedBrick,
        { bottom: true },
      );
      if (level >= 2) {
        for (const y of [3.78, 11.4, 20.57, 25.7, 29.78])
          fbox(out, 'accent', F, x - 0.07, x + 0.07, y, y + 0.16, recess - depth, 0.055, sandstone);
      }
    }
  }
}
const warmedSide = (side) => (side % 2 === 0 ? warmBrick : lightBrick);
function polar(angle, r, y) {
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
}
function ringAt(r, y, count) {
  return Array.from({ length: count }, (_, i) => polar((2 * Math.PI * i) / count, r, y));
}
function ringFloor(out, inner, outer, y, count, color) {
  const a = ringAt(inner, y, count),
    b = ringAt(outer, y, count);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    face(out, 'concrete', [a[i], b[i], b[j], a[j]], up, color);
  }
}
function assemblyHall(out, level) {
  const count = level === 0 ? 12 : level === 1 ? 18 : level === 2 ? 30 : 42;
  const radius = 13.38;
  const pit = plan.dimensions.centralCircularDepressionDiameterM / 2;
  ringFloor(out, pit, 14.55, 0.65, count, concrete);
  face(out, 'concrete', ringAt(pit, -0.64, count), up, bottom);
  for (const [a, b] of pairs([...ringAt(pit, 0.65, count), polar(0, pit, 0.65)])) {
    face(
      out,
      'concrete',
      [a, b, [b[0], -0.64, b[2]], [a[0], -0.64, a[2]]],
      [-a[0], 0, -a[2]],
      bottom,
    );
  }
  for (const [i, y] of [8.43, 15.24, 22.21].entries()) {
    const r = radius - 0.37 * i;
    const rail = ringAt(r, y, level === 0 ? 12 : count);
    if (level === 0) {
      for (const [a, b] of pairs([...rail, rail[0]]))
        face(
          out,
          'iron',
          [a, b, [b[0], y - 0.34, b[2]], [a[0], y - 0.34, a[2]]],
          [-a[0], 0, -a[2]],
          iron,
        );
    } else {
      beamPath(out, 'iron', rail, 0.28, 0.43, iron, true);
      beamPath(out, 'iron', ringAt(r + 1.43, y + 0.09, count), 0.18, 0.29, ironLight, true);
    }
  }
  const profile =
    level === 0
      ? [
          [radius, 22.2],
          [9, 30.08],
          [2.3, 32.36],
        ]
      : [
          [radius, 22.2],
          [12.48, 25.61],
          [10.83, 28.25],
          [8.76, 30.48],
          [6.16, 31.83],
          [2.3, 32.36],
        ];
  for (let i = 0; i < ribs; i++) {
    const angle = (2 * Math.PI * i) / ribs;
    const columnRadius = radius + 0.18;
    const [x, , z] = polar(angle, columnRadius, 0.65);
    const skeleton = profile.map(([r, y]) => polar(angle, r, y));
    if (level === 0) {
      const w = 0.17;
      face(
        out,
        'iron',
        [
          [x - w, 0.64, z],
          [x + w, 0.64, z],
          [x + w, 22.39, z],
          [x - w, 22.39, z],
        ],
        [0, 0, 1],
        iron,
      );
      for (const [a, b] of pairs(skeleton))
        face(
          out,
          'iron',
          [a, b, [b[0], b[1] - 0.32, b[2]], [a[0], a[1] - 0.32, a[2]]],
          [-Math.sin(angle), 0, Math.cos(angle)],
          ironLight,
        );
      continue;
    }
    beam(out, 'iron', [x, 0.61, z], [x, 22.5, z], 0.39, 0.47, iron);
    beamPath(out, 'iron', skeleton, 0.39, 0.44, ironLight);
    if (level >= 2) {
      const inner = profile.map(([r, y]) => polar(angle, r - 0.2, y - 0.47));
      beamPath(out, 'iron', inner, 0.24, 0.23, iron);
      for (let j = 0; j < inner.length - 1; j++) {
        beam(out, 'iron', inner[j], skeleton[j + 1], 0.1, 0.113, ironLight);
        beam(out, 'iron', inner[j], skeleton[j], 0.11, 0.11, iron);
      }
      for (const y of [8.43, 15.24, 22.21]) {
        const near = polar(angle, 12.4, y);
        const far = polar(angle, 16.12, y);
        beam(out, 'iron', near, far, 0.21, 0.27, iron);
        if (level === 3) {
          const neighbor = polar(angle + 0.19, 16.23, y);
          beam(out, 'iron', near, neighbor, 0.13, 0.18, ironLight);
        }
      }
    }
  }
  if (level >= 1) {
    beamPath(out, 'iron', ringAt(2.3, 32.36, 12), 0.34, 0.47, ironLight, true);
    for (const [r, y] of [
      [6.16, 31.83],
      [10.83, 28.25],
    ])
      beamPath(out, 'iron', ringAt(r, y, count), 0.2, 0.29, iron, true);
  }
}
function build(out, level) {
  if (level === 0) distantOutline(out);
  else elevations(out, level);
  assemblyHall(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'jezreel-s-tower-model.mjs';
const viewingDate = '1903-08-01';
const camera = [62, 42, 61],
  lookAt = [0, 15, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: viewingDate,
    validFrom: '1897-01-01',
    validUntil: '1905-01-01',
  },
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The roofless shell of Jezreel’s Tower in 1903, with four brick elevations, open windows and the circular assembly hall’s skeletal steel dome.',
  camera,
  lookAt,
  sunDirection: [-36, 55, 55],
  mediumFiContext: {
    scale: 1.45,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map((s) => s.graph))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'four-unfinished-brick-tower-elevations', position: camera, lookAt },
    { name: 'open-roof-and-assembly-hall-girders', position: [29, 57, 40], lookAt: [1, 18, 0] },
    {
      name: 'street-side-ceramic-devices-and-open-windows',
      position: [-38, 18, 50],
      lookAt: [-1, 16, 4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'jezreel-s-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.75,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction from an exact public-domain postcard published on Qualla, public-domain 1903 photography, the Kent heritage point and the Environment Agency Open Government Licence elevation field.',
};
