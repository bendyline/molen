import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
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
  plane,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const color = palette({
  ceramic: 'c4a789',
  grout: 'aa927b',
  brown: 'a89b8e',
  roof: '56585a',
  ivory: 'dfd4bd',
  red: 'a7443c',
  maroon: '713f3a',
  glow: 'dc6c58',
  steel: 'a4a6a4',
  darkSteel: '4b504f',
  glass: '626e6b',
  glassBlock: '9caca1',
  glassMortar: 'bcc1ad',
  concrete: 'aca79a',
  shadow: '777569',
});
const neutral = (slot, roughness, metallic = 0) => ({
  slot,
  localRef: 'palette:#ffffff',
  roughness,
  metallic,
});
const surfaces = {
  wall: neutral('wall', 0.82),
  glass: neutral('window', 0.43, 0.08),
  accent: neutral('trim', 0.64, 0.13),
  roof: neutral('roof', 0.92),
  steel: surface('trim', 'metal_painted', 0.62, 0.21),
  concrete: surface('foundation', 'concrete_plain', 0.92),
};
const south = plane(24.813, 1);
const fascia = (out, w, a, b, y, height, tint, depth = 0.095, slot = 'accent') =>
  panel(out, slot, w, a, b, y, y + height, depth, tint);

function circularWindow(out, wall, x, y, level) {
  const n = [12, 16, 24, 32][level];
  const shape = (i, r, inset) => {
    const a = (i * 2 * Math.PI) / n;
    return wall.p(x + Math.cos(a) * r, y + Math.sin(a) * r, inset);
  };
  const ring = Array.from({ length: n }, (_, i) => shape(i, 0.78, 0.26));
  face(out, 'glass', ring, wall.normal, color.glassBlock);
  for (let i = 0; i < n; i++)
    face(
      out,
      'steel',
      [
        shape(i, 0.78, 0.29),
        shape(i + 1, 0.78, 0.29),
        shape(i + 1, 0.94, 0.29),
        shape(i, 0.94, 0.29),
      ],
      wall.normal,
      color.steel,
    );
}

function slab(out, polygon, low, high, topTint, wallTint, slot = 'roof') {
  shell(out, polygon, () => low, high, {
    wall: slot,
    roof: 'roof',
    color: wallTint,
    roofColor: topTint,
  });
  cap(out, slot, polygon, low, wallTint);
}

function streetFront(out, level) {
  const corners = [d.outline[0], [-15.81, 21.94]];
  const count = [4, 8, 12, 18][level];
  for (let i = 1; i <= count; i++) {
    const a = ((1 - i / count) * Math.PI) / 2;
    corners.push([-12.96 - 2.85 * Math.sin(a), 21.94 + 2.86 * Math.cos(a)]);
  }
  corners.push(...d.outline.slice(4));
  shell(out, corners, (p) => Math.min(grade(p) - 0.48, -0.27), 4.3, {
    wall: 'wall',
    roof: 'roof',
    color: color.ceramic,
    roofColor: color.roof,
  });
  for (const [a, b] of pairs(closed(corners))) {
    const w = edge(a, b, areaSign(corners));
    trimParapet(out, w, level);
    if (level < 2 || w.length < 6 || (a[1] > 24.5 && b[1] > 24.5)) continue;
    const n = Math.round(w.length / 1.38);
    for (let i = 0; i < n; i++) {
      const x = (i * w.length) / n;
      const width = w.length / n;
      fascia(
        out,
        w,
        x + 0.032,
        x + width - 0.032,
        0.36,
        3.47,
        i % 2 === 0 ? color.brown : color.ceramic,
        0.025,
      );
      if (level === 3) {
        const p = (u, y) => w.p(x + u * width, y, 0.045);
        face(out, 'accent', [p(0.13, 3.56), p(0.89, 3.56), p(0.51, 3.18)], w.normal, color.maroon);
      }
    }
  }

  for (const [l, r] of [
    [-4.15, 2.85],
    [4.27, 12.29],
  ]) {
    fascia(out, south, l, r, 0.4, 2.67, color.glass, 0.051, 'glass');
    if (level === 0) continue;
    const n = level === 1 ? 3 : 5;
    for (let i = 0; i <= n; i++) {
      const x = mix(l, r, i / n);
      fascia(out, south, x - 0.029, x + 0.029, 0.38, 2.76, color.darkSteel, 0.081);
    }
    fascia(out, south, l - 0.06, r + 0.06, 3.1, 0.06, color.steel);
    fascia(out, south, l - 0.06, r + 0.06, 0.36, 0.06, color.steel);
  }
  if (level >= 2) {
    for (const y of [0.29, 3.34, 3.83])
      fascia(out, south, -13.05, 12.65, y, 0.024, color.grout, 0.025);
    for (let x = -13; x < 12.65; x += 1.22)
      fascia(out, south, x, x + 0.026, 3.26, 1.0, color.grout, 0.025);
  }
  entrance(out, level);
}

function trimParapet(out, wall, level) {
  fascia(out, wall, 0, wall.length, 4.19, 1.03, color.red, 0.064);
  if (level >= 1) fascia(out, wall, 0, wall.length, 5.2, 0.085, color.maroon, 0.085);
}

function entrance(out, level) {
  const curved = [
    [-14.5, 24.3],
    [-13.39, 25.33],
    [-12.39, 25.52],
    [-8.59, 25.52],
    [-6.89, 25.0],
    [-5.34, 24.83],
  ];
  const awning = [
    [-14.77, 24.12],
    [-14.64, 25.4],
    [-13.45, 26.04],
    [-7.4, 26.06],
    [-5.31, 25.72],
    [-5.27, 24.23],
  ];
  slab(out, awning, 3.05, 3.44, color.darkSteel, color.maroon, 'steel');
  for (const [i, [a, b]] of pairs(curved).entries()) {
    const w = edge(a, b, -1);
    fascia(
      out,
      w,
      0,
      w.length,
      0.33,
      2.72,
      i === 0 ? color.ceramic : color.glassBlock,
      0,
      i === 0 ? 'wall' : 'glass',
    );
    if (level >= 2 && i !== 0) {
      for (let y = 0.54; y < 3.03; y += 0.24)
        fascia(out, w, 0, w.length, y, 0.023, color.glassMortar, 0.023);
      const n = Math.ceil(w.length / 0.22);
      for (let j = 1; j < n; j++) {
        const u = (j * w.length) / n;
        fascia(out, w, u - 0.012, u + 0.012, 0.33, 2.72, color.glassMortar, 0.023);
      }
    }
  }
  const door = plane(25.56, 1);
  fascia(out, door, -10.63, -8.48, 0.11, 2.51, color.glass, 0, 'glass');
  if (level >= 1) {
    for (const x of [-10.63, -9.55, -8.48])
      fascia(out, door, x - 0.043, x + 0.043, 0.1, 2.53, color.steel, 0.029);
  }
  circularWindow(out, edge(curved[0], curved[1], -1), 0.79, 1.69, level);
  marquee(out, level);
}

const letters = [
  [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
  ],
  [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.21, 0.41],
      [0.79, 0.41],
    ],
  ],
  [
    [
      [0, 0],
      [0, 1],
      [0.74, 1],
      [1, 0.69],
      [0.74, 0.51],
      [0, 0.51],
    ],
    [
      [0.51, 0.51],
      [1, 0],
    ],
  ],
  [
    [
      [1, 0.98],
      [0.13, 0.98],
      [0, 0.6],
      [0.9, 0.42],
      [1, 0.13],
      [0.84, 0],
      [0, 0],
    ],
  ],
  [
    [
      [0.14, 1],
      [0.86, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
    [
      [0.14, 0],
      [0.86, 0],
    ],
  ],
  [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  [
    [
      [0, 1],
      [0.5, 0.52],
      [1, 1],
    ],
    [
      [0.5, 0.52],
      [0.5, 0],
    ],
  ],
];

function marquee(out, level) {
  const center = -10.4;
  const depth = 0.66;
  const blade = [
    [center - 0.5, 3.22],
    [center + 0.43, 3.22],
    [center + 0.81, 10.47],
    [center - 0.56, 11.24],
  ];
  for (const facing of [-1, 1]) {
    const w = plane(25.19 + (facing * depth) / 2, facing);
    face(
      out,
      'accent',
      blade.map(([x, y]) => w.p(x, y)),
      w.normal,
      color.maroon,
    );
    for (const [[x, y], [u, v]] of pairs(closed(blade)))
      beam(out, 'accent', w.p(x, y, 0.026), w.p(u, v, 0.026), 0.082, 0.087, color.glow);
    if (level === 0) continue;
    for (const [i, strokes] of letters.entries()) {
      const y = 9.62 - i * 0.89;
      const point = ([u, v]) =>
        w.p(center + 0.075 + (u - 0.5) * 0.59 * facing, y + v * 0.56, 0.055);
      for (const stroke of strokes)
        for (const [a, b] of pairs(stroke))
          beam(out, 'accent', point(a), point(b), 0.047, 0.047, color.ivory);
    }
  }
  block(out, 'steel', center - 0.32, 3.4, 24.53, 0.21, 7.38, 0.66, color.darkSteel);
  if (level >= 2)
    for (const y of [4.12, 6.62, 8.88])
      beam(
        out,
        'steel',
        [center - 0.07, y, 24.06],
        [center - 0.07, y, 25.09],
        0.12,
        0.15,
        color.steel,
      );
}

function parkingCanopy(out, level) {
  const roofHeight = 3.59;
  slab(out, d.canopy, roofHeight - 0.49, roofHeight, color.roof, color.red, 'accent');
  for (const [a, b] of pairs(closed(d.canopy))) {
    const w = edge(a, b, areaSign(d.canopy));
    const bands = level ? [0.14, 0.39] : [0.23];
    for (const y of bands) fascia(out, w, 0, w.length, roofHeight - y, 0.046, color.glow, 0.027);
  }
  const zSteps = level ? [-23.7, -13.6, -3.0, 7.4, 17.8] : [-23.7, -3, 17.8];
  for (const z of zSteps) {
    for (const x of [-31.96, -26.0]) {
      const base = grade([x, z]) - 0.24;
      block(
        out,
        'steel',
        x - 0.115,
        base,
        z - 0.115,
        0.23,
        roofHeight - 0.38 - base,
        0.23,
        color.red,
      );
    }
  }
}

function raisedDeck(out, level) {
  const deck = 0.76;
  slab(out, d.deck, deck - 0.48, deck, color.shadow, color.concrete, 'concrete');
  const sign = areaSign(d.deck);
  for (const [a, b] of pairs(closed(d.deck))) {
    const w = edge(a, b, sign);
    fascia(out, w, 0, w.length, deck, 0.28, color.concrete, 0.04, 'concrete');
    if (level >= 1) {
      beam(out, 'steel', w.p(0, deck + 0.87), w.p(w.length, deck + 0.87), 0.091, 0.1, color.steel);
    }
    const n = Math.max(1, Math.round(w.length / (level ? 5.3 : 12)));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * w.length) / n;
      const [x, , z] = w.p(u, deck, -0.28);
      const base = Math.min(grade([x, z]) - 0.42, deck - 0.74);
      block(
        out,
        'concrete',
        x - 0.22,
        base,
        z - 0.22,
        0.44,
        deck - base + (level ? 0.87 : 0.06),
        0.44,
        color.concrete,
      );
    }
  }
  if (level >= 2) {
    for (const z of [-53.9, -81.4])
      for (let x = -32; x < 30; x += 2.76)
        block(out, 'accent', x, deck + 0.026, z, 0.065, 0.019, 4.47, color.ivory);
  }
}

function roadsideSign(out, level) {
  const [x, z] = d.roadsideSign,
    base = grade([x, z]);
  const high = base + d.roadsideSignHeight;
  const point = (dx, y, depth) => [x + dx, high + y, z + depth];
  beam(out, 'steel', [x, base - 0.23, z], point(0, -8.7, 0), 0.51, 0.52, color.darkSteel);
  const wings = [
    [
      [-0.56, -9],
      [-0.02, -9],
      [-1.73, -0.3],
      [-3.49, 0],
    ],
    [
      [0.02, -9],
      [0.6, -9],
      [3.38, -1.03],
      [1.65, -0.37],
    ],
  ];
  for (const polygon of wings)
    for (const faceDirection of [-1, 1]) {
      const outline = polygon.map(([dx, y]) => point(dx, y, faceDirection * 0.19));
      face(out, 'accent', outline, [0, 0, faceDirection], color.red);
      for (const [a, b] of pairs(closed(outline)))
        beam(out, 'accent', a, b, 0.1, 0.09, level < 2 ? color.maroon : color.glow);
    }
  block(out, 'steel', x - 2.88, high - 5.3, z - 0.29, 5.76, 0.79, 0.61, color.darkSteel);
  if (level >= 2)
    for (let i = 0; i < 7; i++)
      block(
        out,
        'accent',
        x - 2.21 + i * 0.677,
        high - 5.09,
        z + 0.33,
        0.21,
        0.38,
        0.052,
        color.glow,
      );
}

function build(out, level) {
  streetFront(out, level);
  parkingCanopy(out, level);
  raisedDeck(out, level);
  roadsideSign(out, level);
  for (const [x, z, w, l] of [
    [-10, -14, 8.2, 6.8],
    [2, -21, 6.7, 7.5],
    [-19, -44, 7.7, 5.4],
  ])
    block(out, 'roof', x, 4.32, z, w, 1.16, l, color.brown);
  if (level >= 2)
    for (const [x, z] of [
      [-9, -13],
      [-5, -11],
      [4, -19],
      [7, -16],
      [-17, -43],
    ])
      block(out, 'steel', x, 5.48, z, 0.89, 0.65, 0.94, color.darkSteel);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'varsity-restaurant-model.mjs';
const camera = [-94, 62, 109];
const lookAt = [-7, 3, -13];
export const varsityRestaurantAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel-commercial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'USGS bare earth at the North Avenue sidewalk and under the carhop canopy and rear deck.',
  brief:
    'Atlanta’s original Varsity restaurant with the curved porthole entrance, tapered marquee, red carhop canopy, roadside V and raised Lunching Pad.',
  camera,
  lookAt,
  sunDirection: [56, 88, 120],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.canopy, d.deck],
    minimumCoverage: 0.92,
    basis: 'Native mapped North Avenue restaurant, separate carhop canopy and parking deck.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'north-avenue-porch-porthole-and-marquee',
      position: [-7.6, 6.1, 43.5],
      lookAt: [-10.0, 4.6, 24.2],
    },
    { name: 'roadside-v-and-carhop-canopy', position: [-66, 19, 62], lookAt: [-18, 4, 13] },
    { name: 'lunching-pad-and-side-panels', position: [-76, 27, -88], lookAt: [-5, 1, -46] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'varsity-restaurant-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.49, street: 0.15, closeup: 0.049 }).map(
        ([name, errorMeters]) => [name, { export: name, errorMeters, surfaces }],
      ),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. USGS 3DEP.',
};
