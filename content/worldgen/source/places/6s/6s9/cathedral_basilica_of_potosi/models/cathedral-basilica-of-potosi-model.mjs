import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/cathedral-basilica-of-potosi-shape-controls');
const church = outwardRing(shape.outline);
const front = wallFace(...shape.mainFacade);
const levelOfEntry = 2.13;
const facadeZ = front.origin[1];
const stone = rgb('ad8d70');
const warm = rgb('b9997b');
const trim = rgb('c7a587');
const shade = rgb('4e4840');
const door = rgb('5b4a3c');
const tile = rgb('9f674d');
const domeTile = rgb('96745e');
const base = rgb('968771');
const floor = rgb('b4a48a');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  dressed: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89 },
};

function cap(out, slot, polygon, y, color) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(polygon),
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('San Francisco stone roof could not be triangulated');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = [0, 1, 2].map((j) => {
      const k = indices[i + j] * 3;
      return [positions[k], positions[k + 1], positions[k + 2]];
    });
    tri(out, slot, ...vertices, color);
  }
}

function course(out, face, y, h, depth, left = 0, right = face.length, color = trim) {
  fbox(out, 'dressed', face, left, right, y, y + h, -0.05, depth, color);
}

function arch(out, face, x, y, width, height, level, options = {}) {
  const { depth = 0.09, entrance = false, framed = true, head = 'round' } = options;
  const slot = entrance ? 'timber' : 'shadow';
  const color = entrance ? door : shade;
  if (level < 2 || !framed) {
    const r = width / 2;
    const spring = y + height - (head === 'flat' ? 0 : r);
    const crown =
      head === 'flat'
        ? []
        : roundArch(r, level ? 6 : 4)
            .reverse()
            .slice(1, -1);
    fan(
      out,
      slot,
      [
        face.P(x - r, y, depth),
        face.P(x + r, y, depth),
        face.P(x + r, spring, depth),
        ...crown.map(([dx, dy]) => face.P(x + dx, spring + dy, depth)),
        face.P(x - r, spring, depth),
      ],
      color,
    );
    return;
  }
  opening(out, face, x, y, width, height, {
    head,
    d: depth,
    glassSlot: slot,
    glass: color,
    frameSlot: 'dressed',
    frame: trim,
    frameDepth: depth + 0.13,
    frameWidth: width * 0.105,
    sill: !entrance,
    mullions: entrance && level === 3 ? 1 : 0,
    mullionColor: base,
  });
}

function medallion(out, face, u, y, radius, depth, level, color = trim, inside = stone) {
  const n = level === 3 ? 14 : level === 2 ? 10 : 6;
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i * 2 * Math.PI) / n;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  for (let i = 0; i < n; i++) {
    const a = points[i],
      b = points[(i + 1) % n];
    const p = ([x, h], s, d) => face.P(u + x * s, y + h * s, depth + d);
    quad4(out, 'dressed', p(a, 1, 0.01), p(b, 1, 0.01), p(b, 0.76, 0.08), p(a, 0.76, 0.08), color);
    tri(out, 'shadow', face.P(u, y, depth + 0.03), p(a, 0.76, 0.03), p(b, 0.76, 0.03), inside);
  }
}

function pilaster(out, face, u, y, h, width, depth, level) {
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.57,
    u + width * 0.57,
    y,
    y + 0.53,
    depth - 0.18,
    depth + 0.31,
    trim,
  );
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.46,
    u + width * 0.46,
    y + 0.5,
    y + h - 0.56,
    depth - 0.16,
    depth + 0.12,
    warm,
  );
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.68,
    u + width * 0.68,
    y + h - 0.61,
    y + h,
    depth - 0.18,
    depth + 0.34,
    trim,
  );
  if (level >= 2) {
    const [x, , z] = face.P(u, 0, depth + 0.11);
    const r = width * 0.37;
    lathe(
      out,
      'dressed',
      [x, z],
      [
        [y + 0.51, r * 0.93, r * 0.93],
        [y + 0.78, r, r],
        [y + h * 0.88, r * 0.83, r * 0.83],
        [y + h - 0.57, r, r],
      ],
      level === 3 ? 10 : 6,
      trim,
      { capTop: false },
    );
  }
}

function mainBody(out, level) {
  const eaves = 17.33;
  extrude(out, 'wall', church, -2.92, eaves, stone, { top: false });
  cap(out, 'roof', church, eaves + 0.017, tile);
  gableRoof(out, 'roof', [3.56, -32.51], [3.56, 30.94], 31.16, eaves, 23.29, tile, {
    overhang: 0.28,
    endSlot: 'wall',
    endColor: warm,
  });
  gableRoof(out, 'roof', [-12.89, 4.17], [18.98, 4.17], 15.13, 17.35, 21.62, tile, {
    overhang: 0.21,
    endSlot: 'wall',
    endColor: warm,
  });
  for (const [x0, x1, start, end] of [
    [-21.18, -9.1, -32.5, -22.04],
    [-18.4, -12.1, -21.85, -14.98],
    [-15.96, -8.35, -10.01, -0.31],
  ]) {
    const x = (x0 + x1) / 2;
    gableRoof(out, 'roof', [x, start], [x, end], x1 - x0, 17.38, 19.54, tile, {
      overhang: 0.19,
      endSlot: 'wall',
      endColor: warm,
    });
  }
  const dome = [3.36, 4.47];
  const y0 = 21.92;
  lathe(
    out,
    'wall',
    dome,
    [
      [y0, 7.09, 7.09],
      [22.42, 7.09, 7.09],
      [25.95, 6.84, 6.84],
    ],
    8,
    stone,
    { capTop: false },
  );
  const profile = [
    [25.66, 6.91, 6.91],
    [26.05, 7.09, 7.09],
    [27.3, 6.82, 6.82],
    [29.08, 5.93, 5.93],
    [30.71, 4.41, 4.41],
    [31.72, 2.68, 2.68],
    [32.19, 1.08, 1.08],
    [32.35, 0.24, 0.24],
  ];
  const facets = level === 0 ? 8 : level === 1 ? 12 : level === 2 ? 16 : 24;
  lathe(
    out,
    'roof',
    dome,
    level === 0 ? profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1) : profile,
    facets,
    domeTile,
    { capTop: true },
  );
  if (level >= 1) {
    lathe(
      out,
      'dressed',
      dome,
      [
        [31.96, 0.8, 0.8],
        [32.46, 1.16, 1.16],
        [33.84, 0.78, 0.78],
        [34.12, 0.86, 0.86],
        [34.65, 0.13, 0.13],
      ],
      facets,
      trim,
      { capTop: true },
    );
    const side = wallFace([19.37, 32.72], [19.36, -32.73]);
    for (const u of [17.1, 26.5, 35.8, 45.1, 54.4])
      arch(out, side, u, 11.51, 1.48, 3.86, level, { depth: 0.07 });
    if (level >= 2) {
      for (const u of [12.6, 22.0, 31.4, 40.7, 50.1, 59.4])
        fbox(out, 'wall', side, u - 0.5, u + 0.5, 4.02, 17.28, 0.006, 0.36, warm);
      course(out, side, 16.64, 0.26, 0.29, 0.16, side.length - 0.12, warm);
      const rear = wallFace(shape.rearFacade[1], shape.rearFacade[0]);
      arch(out, rear, rear.length * 0.51, 4.67, 3.24, 5.43, level, {
        entrance: true,
        depth: 0.062,
      });
      arch(out, rear, rear.length * 0.51, 12.05, 2.68, 3.47, level, { depth: 0.061 });
    }
  }
}

function crown(out, face, level) {
  const points = [
    [8.04, 18.23],
    [9.97, 18.76],
    [12.38, 19.02],
    [14.32, 20.92],
    [15.92, 21.54],
    [17.28, 22.47],
    [18.46, 22.67],
    [20.2, 22.53],
    [21.57, 21.77],
    [22.93, 21.38],
    [24.94, 19.62],
    [27.05, 19.0],
    [28.57, 18.2],
  ];
  const layers = level === 0 ? points.filter((_, i) => i % 2 === 0) : points;
  for (let i = 0; i + 1 < layers.length; i++) {
    const [[a, ya], [b, yb]] = [layers[i], layers[i + 1]];
    quad4(
      out,
      'wall',
      face.P(a, 16.13, 0.36),
      face.P(b, 16.13, 0.36),
      face.P(b, yb, 0.36),
      face.P(a, ya, 0.36),
      warm,
    );
    quad4(
      out,
      'dressed',
      face.P(a, ya - 0.26, 0.62),
      face.P(b, yb - 0.26, 0.62),
      face.P(b, yb + 0.12, 0.62),
      face.P(a, ya + 0.12, 0.62),
      trim,
    );
    quad4(
      out,
      'dressed',
      face.P(a, ya, 0.62),
      face.P(b, yb, 0.62),
      face.P(b, yb, -0.38),
      face.P(a, ya, -0.38),
      stone,
    );
    if (level >= 2)
      quad4(
        out,
        'dressed',
        face.P(a, ya - 0.71, 0.57),
        face.P(b, yb - 0.71, 0.57),
        face.P(b, yb - 0.52, 0.57),
        face.P(a, ya - 0.52, 0.57),
        trim,
      );
  }
  if (level >= 1) {
    const [x, , z] = face.P(18.4, 0, 0.1);
    abox(out, 'dressed', [x - 0.12, 22.61, z - 0.12], [x + 0.12, 24.64, z + 0.12], stone);
    abox(out, 'dressed', [x - 0.55, 23.91, z - 0.105], [x + 0.55, 24.12, z + 0.105], stone);
  }
}

function frontage(out, level) {
  const wall = wallFace(
    [front.origin[0], facadeZ + 0.24],
    [shape.mainFacade[1][0], facadeZ + 0.24],
  );
  const center = 18.24;
  const fronts = [9.23, center, 27.49];
  fbox(
    out,
    'wall',
    front,
    -0.04,
    front.length + 0.04,
    levelOfEntry - 0.31,
    18.14,
    -1.16,
    0.21,
    stone,
  );
  for (const [y, h, d] of [
    [2.24, 0.33, 0.39],
    [9.04, 0.25, 0.35],
    [10.68, 0.3, 0.52],
    [11.08, 0.44, 0.62],
    [16.74, 0.37, 0.56],
    [17.57, 0.37, 0.78],
  ])
    course(out, front, y, h, d, 7.61, 29.11);
  crown(out, front, level);
  for (const [i, u] of fronts.entries()) {
    const main = i === 1;
    arch(out, wall, u, levelOfEntry, main ? 4.14 : 2.32, main ? 7.59 : 5.2, level, {
      entrance: true,
      depth: 0.108,
    });
    if (level >= 1) {
      for (const sign of [-1, 1]) {
        const distance = main ? 2.93 : 1.73;
        pilaster(
          out,
          wall,
          u + distance * sign,
          levelOfEntry + 0.35,
          main ? 8.4 : 6.34,
          main ? 0.91 : 0.61,
          0.14,
          level,
        );
        if (main && level >= 2)
          pilaster(out, wall, u + 3.91 * sign, levelOfEntry + 0.34, 8.41, 0.75, 0.09, level);
      }
      const upperY = main ? 14.45 : 14.0;
      medallion(out, wall, u, upperY, main ? 1.32 : 0.8, 0.165, level, trim, shade);
      if (level >= 2 && !main) {
        arch(out, wall, u, 8.01, 1.14, 1.93, level, { depth: 0.125 });
        course(out, wall, 7.63, 0.24, 0.62, u - 1.15, u + 1.15);
      }
    }
  }
  if (level >= 2) {
    for (const [u, y] of [
      [13.76, 12.12],
      [22.9, 12.1],
      [13.7, 17.06],
      [22.57, 17.03],
    ]) {
      arch(out, wall, u, y, 1.06, 1.96, level, { depth: 0.128 });
      course(out, wall, y - 0.32, 0.26, 0.51, u - 0.86, u + 0.86);
    }
    const interval = level === 3 ? 0.77 : 1.53;
    for (let u = 8.22; u < 28.82; u += interval)
      course(out, wall, 16.37, 0.26, 0.46, u - 0.13, u + 0.13);
  }
  for (const x of [3.24, 33.11])
    if (level >= 1) medallion(out, wall, x, 13.6, 0.63, 0.09, level, trim, shade);
}

function octagonalFooting(x, z, r) {
  return outwardRing(
    Array.from({ length: 8 }, (_, i) => {
      const theta = ((i + 0.5) * Math.PI) / 4;
      return [x + Math.cos(theta) * r, z + Math.sin(theta) * r];
    }),
  );
}

function tower(out, x, z, scale, level) {
  const baseRing = octagonalFooting(x, z, 4.62);
  extrude(out, 'wall', baseRing, 1.96, 19.16, stone, { top: false });
  const start = 18.81;
  const top = 31.28 * scale;
  const y = (t) => start + (top - start) * t;
  const bellRing = octagonalFooting(x, z, 3.39);
  const shoulder = [
    [18.94, 4.43, 4.43],
    [19.37, 4.46, 4.46],
    [19.85, 3.8, 3.8],
    [20.56, 3.43, 3.43],
  ];
  lathe(out, 'dressed', [x, z], shoulder, 8, trim, { capTop: false });
  extrude(out, 'wall', bellRing, 20.51, top, stone, { top: false });
  cap(out, 'dressed', bellRing, top, trim);
  for (let i = 0; i < bellRing.length; i++) {
    const f = wallFace(bellRing[i], bellRing[(i + 1) % bellRing.length]);
    course(out, f, top - 0.45, 0.38, 0.37, -0.08, f.length + 0.08);
    if (level >= 1) {
      const u = f.length / 2;
      arch(out, f, u, y(0.28), f.length * 0.52, y(0.88) - y(0.28), level, { depth: 0.055 });
      course(out, f, y(0.19), 0.24, 0.24, 0.04, f.length - 0.04);
      if (level >= 2) {
        for (const p of [0.22, f.length - 0.22])
          pilaster(out, f, p, y(0.22), y(0.96) - y(0.22), 0.27, 0.09, level);
      }
    }
  }
  const capProfile = [
    [top - 0.02, 3.69, 3.69],
    [top + 0.48, 3.75, 3.75],
    [top + 0.81, 3.42, 3.42],
    [top + 1.99, 2.87, 2.87],
    [top + 3.15, 1.9, 1.9],
    [top + 3.92, 0.75, 0.75],
    [top + 4.17, 0.46, 0.46],
  ];
  lathe(
    out,
    'roof',
    [x, z],
    level === 0 ? capProfile.filter((_, i) => i % 2 === 0) : capProfile,
    level === 0 ? 8 : level === 1 ? 12 : level === 2 ? 16 : 20,
    domeTile,
    { capTop: true },
  );
  if (level >= 1) {
    lathe(
      out,
      'dressed',
      [x, z],
      [
        [top + 3.93, 0.53, 0.53],
        [top + 4.28, 0.63, 0.63],
        [top + 4.75, 0.52, 0.52],
        [top + 4.91, 0.1, 0.1],
      ],
      level >= 2 ? 10 : 6,
      trim,
      { capTop: true },
    );
    abox(out, 'dressed', [x - 0.084, top + 4.8, z - 0.1], [x + 0.084, top + 6.06, z + 0.1], stone);
    abox(
      out,
      'dressed',
      [x - 0.46, top + 5.49, z - 0.086],
      [x + 0.46, top + 5.66, z + 0.086],
      stone,
    );
    if (level >= 2)
      for (const [sx, sz] of baseRing.filter((_, i) => i % 2 === 0))
        lathe(
          out,
          'dressed',
          [sx * 0.86 + x * 0.14, sz * 0.86 + z * 0.14],
          [
            [19.7, 0.32, 0.32],
            [20.1, 0.34, 0.34],
            [20.47, 0.23, 0.23],
            [20.65, 0.02, 0.02],
          ],
          level === 3 ? 8 : 6,
          trim,
          { capTop: true },
        );
  }
}

function forecourt(out, level) {
  fbox(out, 'paving', front, -0.18, front.length + 0.22, -0.85, levelOfEntry, -0.43, 1.28, floor);
  const count = level === 0 ? 3 : level === 1 ? 5 : 9;
  for (let j = 0; j < count; j++) {
    const t = j / count;
    fbox(
      out,
      'paving',
      front,
      6.37 - 0.31 * t,
      30.23 + 0.3 * t,
      -0.69,
      2.1 - 1.78 * t,
      1.23 + t * 3.05,
      1.3 + ((j + 1) * 3.05) / count,
      base,
    );
  }
}

function build(out, level) {
  mainBody(out, level);
  frontage(out, level);
  tower(out, -12.0, 28.27, 1.0, level);
  tower(out, 14.51, 28.23, 0.989, level);
  forecourt(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'cathedral-basilica-of-potosi-model.mjs';
const camera = [75, 62, 111];
const lookAt = [0, 14, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Potosí’s nineteenth-century stone cathedral with paired octagonal bell towers, three south portals and a tiled crossing dome.',
  camera,
  lookAt,
  sunDirection: [-49, 55, 65],
  mediumFiContext: {
    scale: 1.13,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: church,
    minimumCoverage: 0.9,
    basis:
      'The named standing cathedral walls are traced along Plaza 10 de Noviembre and Calle Ayacucho.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-front-and-octagonal-towers', position: [-9, 14, 83], lookAt: [1, 18, 30] },
    { name: 'west-side-and-stone-steps', position: [-49, 22, 75], lookAt: [0, 16, 19] },
    { name: 'crossing-dome-and-terracotta-naves', position: [56, 68, -57], lookAt: [1, 15, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cathedral-basilica-of-potosi-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
};
