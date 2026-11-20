import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const front = d.front;
const plinth = 0.61,
  cornice = 12.72;
const colors = palette({
  wall: 'b8a282',
  darkWall: '9d896e',
  cream: 'c4b297',
  carved: 'ad9879',
  trim: 'cdc0a3',
  marble: 'd7d1bf',
  mortar: '897b66',
  dark: '4b4b3d',
  glass: '4d544c',
  green: '466e60',
  mutedGold: 'a48653',
  paleRoof: 'ac9d89',
  tile: 'a67963',
  fabric: 'c0b6a0',
  fabricShade: 'ada28c',
  rib: '706c60',
});
const surfaces = {
  wall: surface('wall', 'stone_ashlar', 0.92),
  limestone: surface('trim', 'stone_limestone_weathered', 0.89),
  marble: surface('foundation', 'stone_marble', 0.86),
  roof: surface('roof', 'stone_limestone_raw', 0.88),
  canopy: surface('roof', 'fabric_canvas', 0.94),
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const shape = (x, z, w, l) => rect(x - w / 2, z + l / 2, x + w / 2, z - l / 2);
const pos = (a, b, t) => a.map((x, i) => mix(x, b[i], t));

function wallRing(out, outline, low, top, slot, tint) {
  const direction = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, direction);
    const bottom = (p) => (typeof low === 'function' ? low(p) : low);
    face(out, slot, [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)], w.normal, tint);
  }
}

function boxCap(out, outline, y, top, slot, tint) {
  wallRing(out, outline, y, top, slot, tint);
  cap(out, slot, outline, top, tint);
}

function archTop(
  out,
  w,
  x,
  base,
  spring,
  crown,
  half,
  level,
  { fill = colors.dark, relief = 0.09, band = 0.28, glass = false } = {},
) {
  if (level === 0) {
    face(
      out,
      'accent',
      [
        [x - half, base],
        [x + half, base],
        [x + half, spring],
        [x, crown],
        [x - half, spring],
      ].map(([u, v]) => w.p(u, v, relief)),
      w.normal,
      fill,
    );
    return;
  }
  const n = [0, 5, 7, 10][level];
  const curve = (scale) =>
    Array.from({ length: n * 2 + 1 }, (_, i) => {
      const t = i / n - 1,
        a = Math.abs(t);
      return [
        x + half * t * scale,
        spring + (crown - spring) * Math.sqrt(Math.max(0, 4 - (1 + a) * (1 + a)) / 3) * scale,
      ];
    });
  const inner = curve(1);
  face(
    out,
    'accent',
    inner.map(([u, v]) => w.p(u, v, relief)),
    w.normal,
    fill,
  );
  panel(out, 'accent', w, x - half, x + half, base, spring, relief, fill);
  const border = curve(1 + band / half);
  for (let i = 0; i < inner.length - 1; i++) {
    const [a, b, c, d] = [inner[i], inner[i + 1], border[i + 1], border[i]];
    face(
      out,
      'limestone',
      [a, b, c, d].map(([u, v]) => w.p(u, v, relief + 0.049)),
      w.normal,
      colors.trim,
    );
  }
  for (const side of [-1, 1]) {
    const e = x + side * half,
      f = e + side * band;
    panel(
      out,
      'limestone',
      w,
      Math.min(e, f),
      Math.max(e, f),
      base - 0.04,
      spring + 0.015,
      relief + 0.055,
      colors.carved,
    );
  }
  if (glass && level > 0) {
    panel(
      out,
      'limestone',
      w,
      x - 0.045,
      x + 0.045,
      base,
      spring + (crown - spring) * 0.515,
      relief + 0.071,
      colors.marble,
    );
    if (level > 1)
      panel(
        out,
        'limestone',
        w,
        x - half,
        x + half,
        base - 0.14,
        base + 0.015,
        relief + 0.098,
        colors.cream,
      );
  }
}

function hippedRoof(out, x, z, width, length, base, rise, ridgeLength) {
  const ring = shape(x, z, width, length).map((p) => at(p, base));
  const near = [x, base + rise, z + ridgeLength / 2],
    far = [x, base + rise, z - ridgeLength / 2];
  face(out, 'roof', [ring[0], ring[1], near], up, colors.tile);
  face(out, 'roof', [ring[1], ring[2], far, near], up, colors.paleRoof);
  face(out, 'roof', [ring[2], ring[3], far], up, colors.tile);
  face(out, 'roof', [ring[3], ring[0], near, far], up, colors.paleRoof);
}

function mosque(out, level) {
  const outline = d.outline;
  wallRing(
    out,
    outline,
    (p) => Math.min(grade(p) - 0.31, plinth - 0.62),
    plinth + 0.29,
    'marble',
    colors.marble,
  );
  wallRing(out, outline, plinth + 0.24, cornice, 'wall', colors.wall);
  cap(out, 'roof', outline, cornice, colors.paleRoof);
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    for (const [low, top, offset] of [
      [cornice - 0.67, cornice - 0.44, 0.21],
      [cornice - 0.41, cornice - 0.15, 0.35],
      [cornice - 0.135, cornice + 0.1, 0.23],
    ])
      panel(out, 'limestone', w, 0, w.length, low, top, offset, colors.cream);
    const count = Math.round(w.length / (level === 0 ? 3.8 : level === 1 ? 2.1 : 1.04));
    if (level === 0 && a[1] < front - 1 && b[1] < front - 1) continue;
    for (let j = 0; j < count; j++) {
      const t = (w.length * (j + 0.5)) / count;
      const half = level === 0 ? 0.54 : 0.34;
      face(
        out,
        'limestone',
        [
          w.p(t - half, cornice, 0.31),
          w.p(t + half, cornice, 0.31),
          w.p(t + half * 0.8, cornice + 0.48, 0.31),
          w.p(t, cornice + 0.78, 0.31),
          w.p(t - half * 0.8, cornice + 0.48, 0.31),
        ],
        w.normal,
        colors.carved,
      );
      if (level > 1)
        panel(
          out,
          'limestone',
          w,
          t - 0.11,
          t + 0.11,
          cornice - 1.02,
          cornice - 0.74,
          0.16,
          colors.carved,
        );
    }
  }
  hippedRoof(out, -3, -9.1, 35.7, 79.2, cornice + 0.09, 1.52, 66.4);
  boxCap(out, shape(16, -37.4, 13.2, 16.8), cornice - 0.08, cornice + 0.58, 'wall', colors.cream);
  if (level > 0) {
    for (const [x, z, w, l] of [
      [-7, -39, 8.3, 5.2],
      [-9, 26.5, 8.8, 6.2],
      [17.2, -16.8, 8.1, 4.7],
    ])
      boxCap(out, shape(x, z, w, l), cornice + 0.51, cornice + 1.18, 'roof', colors.paleRoof);
  }
  const w = plane(front, 1);
  for (const x of [-12.7, 4.55, 21.3]) {
    const step = shape(x, front + 0.9, 4.95, 2.1);
    boxCap(
      out,
      step,
      Math.min(grade([x, front + 1.4]) - 0.28, plinth - 0.26),
      plinth + 0.15,
      'marble',
      colors.marble,
    );
    archTop(out, w, x, plinth + 0.14, plinth + 3.54, plinth + 5.15, 1.47, level, {
      band: 0.37,
      fill: colors.green,
      relief: 0.079,
    });
    if (level > 0) {
      for (let i = 0; i < 2; i++) {
        const offset = (i === 0 ? -1 : 1) * 1.78;
        panel(
          out,
          'limestone',
          w,
          x + offset - 0.12,
          x + offset + 0.12,
          plinth + 0.19,
          plinth + 3.73,
          0.244,
          colors.marble,
        );
      }
      panel(out, 'accent', w, x - 0.02, x + 0.02, plinth + 0.18, plinth + 3.49, 0.134, colors.dark);
    }
  }
  for (const x of [-17.4, -9.6, -5, 0.5, 8.6, 13.0, 17.5, 26.5]) {
    archTop(out, w, x, plinth + 5.85, plinth + 7.48, plinth + 9.04, 0.8, level, {
      fill: colors.glass,
      glass: true,
      band: 0.19,
    });
    if (level > 0 && [-17.4, -5, 0.5, 13, 17.5, 26.5].includes(x))
      panel(out, 'accent', w, x - 0.58, x + 0.58, plinth + 0.87, plinth + 2.37, 0.077, colors.dark);
  }
  if (level > 0) {
    for (const x of [-16.5, -7.5, 1.3, 10.2, 19.0, 27.9]) {
      const fw = 0.47;
      panel(out, 'wall', w, x - fw, x + fw, plinth + 0.16, cornice - 0.61, 0.24, colors.darkWall);
      const at = (dx, y) => w.p(x + dx, y, 0.31);
      face(
        out,
        'limestone',
        [
          at(-0.6, cornice - 2.15),
          at(0.6, cornice - 2.15),
          at(0.38, cornice - 1.62),
          at(0, cornice - 1.22),
          at(-0.38, cornice - 1.62),
        ],
        w.normal,
        colors.carved,
      );
    }
    for (const [a, b] of pairs(closed(outline))) {
      if (a[1] > front - 1 && b[1] > front - 1) continue;
      const side = edge(a, b, sign);
      const count = Math.max(2, Math.round(side.length / 11.1));
      for (let i = 0; i < count; i++)
        archTop(
          out,
          side,
          (side.length * (i + 0.5)) / count,
          plinth + 5.4,
          plinth + 7.2,
          plinth + 8.5,
          0.69,
          level,
          { glass: true, band: 0.2, fill: colors.glass },
        );
    }
  }
}

function minaret(out, level) {
  const x = -21.6,
    z = front - 2.85,
    foot = shape(x, z, 6.55, 6.5);
  boxCap(out, foot, Math.min(plinth - 0.77, grade([x, z]) - 0.39), 14.3, 'wall', colors.wall);
  const wt = plane(z + 3.254, 1);
  const outline = shape(x, z, 6.86, 6.8);
  for (const [a, b] of [
    [plinth + 1.05, plinth + 1.53],
    [7.65, 7.92],
    [12.62, 12.91],
    [13.82, 14.34],
  ])
    boxCap(out, outline, a, b, 'limestone', colors.trim);
  for (const [dx, width, lo, high] of [
    [0, 0.92, 2.85, 7.44],
    [-2.21, 0.52, 4.65, 7.39],
    [2.21, 0.52, 4.65, 7.39],
  ])
    archTop(out, wt, x + dx, lo, high - 1.0, high, width, level, {
      band: 0.27,
      fill: colors.darkWall,
    });
  const n = [6, 13, 22, 32][level],
    center = [x, z];
  ring(
    out,
    'limestone',
    center,
    level === 0
      ? [
          [14.32, 2.39],
          [14.65, 2.67],
          [15.82, 2.16],
          [26.38, 1.95],
        ]
      : [
          [14.32, 2.39],
          [14.65, 2.67],
          [15.09, 2.44],
          [15.39, 2.29],
          [15.82, 2.16],
          [25.93, 1.89],
          [26.38, 1.95],
        ],
    n,
    colors.cream,
  );
  if (level > 0)
    for (let i = 0; i < (level === 1 ? 18 : 30); i++) {
      const angle = (2 * Math.PI * i) / (level === 1 ? 18 : 30),
        a = Math.cos(angle),
        b = Math.sin(angle);
      beam(
        out,
        'limestone',
        [x + a * 2.13, 15.77, z + b * 2.13],
        [x + a * 1.88, 25.93, z + b * 1.88],
        level === 1 ? 0.075 : 0.1,
        0.105,
        colors.carved,
      );
    }
  for (const [y, r] of [
    [26.24, 1.96],
    [33.35, 1.51],
  ]) {
    ring(
      out,
      'limestone',
      center,
      [
        [y, r],
        [y + 0.22, r * 1.11],
        [y + 0.95, r * 1.33],
        [y + 1.18, r * 1.38],
        [y + 1.63, r * 1.35],
      ],
      n,
      colors.carved,
    );
    if (level > 1)
      for (let i = 0; i < 24; i++) {
        const theta = (2 * Math.PI * i) / 24;
        const p = (b, d) => [x + Math.cos(theta) * r * d, y + b, z + Math.sin(theta) * r * d];
        beam(out, 'limestone', p(0.27, 1.13), p(1.15, 1.41), 0.21, 0.23, colors.trim);
      }
  }
  ring(
    out,
    'limestone',
    center,
    [
      [27.91, 1.54],
      [28.21, 1.42],
      [32.8, 1.31],
      [33.4, 1.52],
    ],
    n,
    colors.cream,
  );
  ring(
    out,
    'limestone',
    center,
    level === 0
      ? [
          [35, 1.36],
          [37, 1.18],
          [43.15, 0.162],
        ]
      : [
          [35, 1.36],
          [35.57, 1.23],
          [36.23, 1.2],
          [37.0, 1.18],
          [43.15, 0.162],
        ],
    n,
    colors.carved,
  );
  const top = [x, d.towerHeight, z];
  const finial = [
    [-0.64, 0.15],
    [-0.46, 0.25],
    [-0.28, 0.15],
    [-0.19, 0.17],
    [0, 0.023],
  ].map(([q, r]) => [top[1] + q, r]);
  ring(out, 'accent', center, finial, n, colors.mutedGold);
  if (level > 1) {
    const facets = 10;
    for (let i = 0; i < facets; i++) {
      const a = (2 * Math.PI * i) / facets,
        n = [Math.cos(a), 0, Math.sin(a)];
      const mid = [x + n[0] * 1.42, z + n[2] * 1.42],
        w = {
          normal: n,
          p: (u, y, o = 0) => [mid[0] - n[2] * u + n[0] * o, y, mid[1] + n[0] * u + n[2] * o],
        };
      archTop(out, w, 0, 28.7, 30.5, 31.2, 0.29, level, {
        fill: colors.darkWall,
        band: 0.085,
        relief: 0.032,
      });
    }
  }
}

function greenGate(out, level) {
  const x = 24.55,
    z = front - 2.24;
  boxCap(out, shape(x, z, 5.42, 5.65), plinth - 0.17, 13.25, 'wall', colors.darkWall);
  boxCap(out, shape(x, z, 4.0, 3.78), 13.25, 17.05, 'limestone', colors.cream);
  boxCap(out, shape(x, z, 4.45, 4.18), 16.94, 17.32, 'limestone', colors.carved);
  ring(
    out,
    'limestone',
    [x, z],
    [
      [17.24, 1.54],
      [17.62, 1.52],
      [18.62, 1.3],
      [19.21, 0.88],
      [19.55, 0.38],
    ],
    [7, 9, 12, 16][level],
    colors.wall,
  );
  ring(
    out,
    'accent',
    [x, z],
    [
      [19.48, 0.25],
      [19.8, 0.33],
      [20.2, 0.13],
      [20.64, 0.034],
    ],
    8,
    colors.mutedGold,
  );
  if (level > 0) {
    const old = plane(z + 1.902, 1);
    for (const dx of [-0.98, 0.98])
      archTop(out, old, x + dx, 13.57, 15.16, 16.43, 0.62, level, {
        fill: colors.darkWall,
        band: 0.15,
      });
  }
  const dome = [13.8, 31.5];
  boxCap(out, shape(...dome, 9.04, 8.74), cornice - 0.12, cornice + 1.5, 'wall', colors.cream);
  ring(
    out,
    'roof',
    dome,
    [
      [cornice + 1.35, 3.69],
      [cornice + 1.66, 3.88],
      [cornice + 2.27, 3.78],
      [cornice + 3.22, 3.02],
      [cornice + 4.3, 1.75],
      [cornice + 5.18, 0.26],
    ],
    [9, 12, 18, 24][level],
    colors.paleRoof,
  );
  ring(
    out,
    'accent',
    dome,
    [
      [cornice + 5.14, 0.28],
      [cornice + 5.52, 0.17],
      [cornice + 5.96, 0.025],
    ],
    8,
    colors.mutedGold,
  );
}

function umbrellas(out, level) {
  const width = Math.sqrt(d.canopyShadeArea),
    half = width / 2;
  for (let i = 0; i < d.umbrellaCount; i++) {
    const x = -13.4 + 16.03 * i,
      z = front + 11.3;
    const center = [x, z],
      y = Math.min(grade(center) - 0.15, plinth - 0.1);
    boxCap(out, shape(x, z, 1.18, 1.18), y, y + 3.4, 'marble', colors.marble);
    ring(
      out,
      'accent',
      center,
      [
        [y + 3.36, 0.33],
        [7.47, 0.35],
        [8.12, 0.7],
      ],
      level === 0 ? 4 : 10,
      colors.rib,
    );
    const edgeN = level === 0 ? 1 : level === 1 ? 4 : 6;
    const corners = shape(x, z, width, width),
      outer = [];
    for (const [a, b] of pairs(closed(corners)))
      for (let k = 0; k < edgeN; k++) {
        const u = k / edgeN,
          arch = 4 * u * (1 - u);
        const p = pos(a, b, u);
        outer.push([
          mix(p[0], x, arch * 0.076),
          cornice - 0.12 - arch * 0.42,
          mix(p[1], z, arch * 0.076),
        ]);
      }
    const centerRing = (p, t, h) => [mix(x, p[0], t), h, mix(z, p[2], t)];
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i],
        b = outer[(i + 1) % outer.length];
      const rings =
        level === 0
          ? [[0.059, 8.24]]
          : [
              [0.059, 8.24],
              [0.47, 11.18],
            ];
      for (let j = 0; j < rings.length; j++) {
        const [t, y] = rings[j],
          [u, h] = rings[j + 1] ?? [1, 0];
        const lower = [centerRing(a, t, y), centerRing(b, t, y)];
        const upper = h ? [centerRing(b, u, h), centerRing(a, u, h)] : [b, a];
        face(
          out,
          'canopy',
          [...lower, ...upper],
          up,
          i % 2 === 0 ? colors.fabric : colors.fabricShade,
        );
        if (level > 0)
          face(
            out,
            'canopy',
            [...lower, ...upper].map(([x, y, z]) => [x, y - 0.035, z]),
            [0, -1, 0],
            colors.fabricShade,
          );
      }
      if (level > 1) {
        const p = centerRing(a, 0.46, 11.07),
          q = centerRing(a, 0.061, 8.18);
        beam(out, 'accent', q, p, 0.041, 0.063, colors.rib);
        if (i % 2 === 0) beam(out, 'accent', p, [a[0], a[1] - 0.1, a[2]], 0.043, 0.055, colors.rib);
      }
    }
    if (level > 0)
      for (const p of corners)
        beam(
          out,
          'accent',
          [x, 8.16, z],
          [mix(x, p[0], 0.62), 11.15, mix(z, p[1], 0.62)],
          0.105,
          0.108,
          colors.rib,
        );
  }
}

function build(out, level) {
  mosque(out, level);
  minaret(out, level);
  greenGate(out, level);
  umbrellas(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'al-hussein-mosque-model.mjs',
  camera = [-82, 53, 131],
  lookAt = [0, 13, 17];
const lods = { district: 0.87, street: 0.34, closeup: 0.095 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'The named mosque perimeter and Midan Hussein face establish the geometry. Original terrain supports the foundation and the free-standing umbrellas.',
  brief:
    'Cairo’s Al-Hussein Mosque with Gothic revival stonework, a tall fluted Ottoman minaret, an older gate tower, a shrine dome and three wide prayer canopies.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-82, 108, 113],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Replacement is restricted to the independently mapped outline of Al-Hussein Mosque.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_weathered',
    'stone_marble',
    'stone_limestone_raw',
    'fabric_canvas',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'midan-hussein-facade-and-minaret',
      position: [-34, 23, 126],
      lookAt: [-2.7, 15.3, 47],
    },
    { name: 'pointed-arches-and-shade-canopies', position: [34, 7, 83], lookAt: [3, 6.9, 51] },
    { name: 'fluted-minaret-and-balconies', position: [-49, 31, 87], lookAt: [-21.6, 32, 48] },
    { name: 'green-gate-and-shrine-dome', position: [49, 29, 66], lookAt: [18, 13, 38] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hussein-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.78,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
