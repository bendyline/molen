import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const controls = read('native-map/burns-philp-building-normanton-shape-controls');
const terrain = read('terrain-grid');
const { left, right, back, front } = controls.limits;
const shell = { x0: left + 2.95, x1: right - 0.6, z0: back + 2.19, z1: front - 3.27 };
const floor = 1.13;
const eave = 4.51;
const bays = [
  { x0: shell.x0, x1: -2.1, peak: 6.9, parapet: 8.64, sign: 'BURNS' },
  { x0: -2.1, x1: 6.98, peak: 7.24, parapet: 8.16, sign: 'PHILP' },
  { x0: 6.98, x1: shell.x1, peak: 6.68, parapet: 7.72, sign: 'CO LTD' },
];
const palette = Object.fromEntries(
  Object.entries({
    front: 'c7944f',
    frontShade: 'b88448',
    sign: '46362a',
    roof: '93928a',
    roofDark: '7f817b',
    wall: 'b0a391',
    wallDark: 'a09584',
    gutter: '706f65',
    stone: '95806b',
    grey: '786553',
    timber: '8e7760',
    light: 'b3a78f',
    cream: 'cbb99a',
    blue: '5c6662',
    dark: '4c4c43',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  siding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87 },
  painted: { slot: 'trim', graph: 'metal_painted', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89 },
};

const facadeFront = facade([0, shell.z1], [1, 0]);
const facadeBack = facade([0, shell.z0], [-1, 0]);
const facadeSide = facade([shell.x0, 0], [0, 1]);
const facadeYard = facade([shell.x1, 0], [0, -1]);

function nativeGrade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const t = u - i;
  const s = v - j;
  const values = terrain.heightsMeters;
  const a = values[j][i] * (1 - t) + values[j][i + 1] * t;
  const b = values[j + 1][i] * (1 - t) + values[j + 1][i + 1] * t;
  return a * (1 - s) + b * s - terrain.modelDatumElevationMeters;
}

function windows(out, face, entries, detail) {
  for (const [u, width, height, base, arch] of entries)
    opening(out, face, u, base, width, height, {
      head: arch ? 'round' : 'flat',
      glassSlot: 'glass',
      glass: palette.blue,
      frameSlot: 'timber',
      frame: palette.cream,
      frameWidth: detail ? 0.105 : 0,
      frameDepth: 0.066,
      mullions: detail ? (arch ? 2 : 1) : 0,
      transoms: detail ? 1 : 0,
      sill: detail,
      d: 0.021,
    });
}

function doors(out, face, entries, level) {
  for (const [u, width, height, cargo] of entries) {
    const half = width / 2;
    fbox(
      out,
      'timber',
      face,
      u - half,
      u + half,
      floor + 0.01,
      floor + height,
      0.006,
      0.092,
      cargo ? palette.wallDark : palette.grey,
    );
    if (level >= 2) {
      const count = cargo ? 8 : 4;
      for (let i = 1; i < count; i++) {
        const at = u - half + (width * i) / count;
        fbox(
          out,
          'timber',
          face,
          at - 0.013,
          at + 0.013,
          floor + 0.13,
          floor + height - 0.07,
          0.083,
          0.112,
          palette.gutter,
        );
      }
      for (const y of [floor + 0.45, floor + height - 0.41])
        fbox(
          out,
          'timber',
          face,
          u - half - 0.02,
          u + half + 0.02,
          y,
          y + 0.095,
          0.08,
          0.154,
          palette.timber,
        );
    }
    if (!cargo)
      opening(out, face, u, floor + height - 0.54, width * 0.77, 0.37, {
        glassSlot: 'glass',
        glass: palette.dark,
        frameSlot: 'timber',
        frame: palette.cream,
        frameWidth: level >= 2 ? 0.066 : 0,
        d: 0.133,
        sill: false,
      });
  }
}

function warehouse(out, level) {
  abox(out, 'siding', [shell.x0, floor, shell.z0], [shell.x1, eave, shell.z1], palette.wall);
  abox(
    out,
    'timber',
    [shell.x0 - 0.028, floor - 0.21, shell.z0 - 0.032],
    [shell.x1 + 0.028, floor + 0.029, shell.z1 + 0.022],
    palette.grey,
  );
  for (const { x0, x1, peak } of bays) {
    const mid = (x0 + x1) / 2;
    gableRoof(out, 'roof', [mid, shell.z0], [mid, shell.z1], x1 - x0, eave, peak, palette.roof, {
      endSlot: 'siding',
      endColor: palette.wall,
      overhang: 0.065,
    });
    if (level)
      abox(
        out,
        'painted',
        [mid - 0.062, peak - 0.045, shell.z0 - 0.18],
        [mid + 0.062, peak + 0.063, shell.z1 + 0.12],
        palette.gutter,
      );
    if (level >= 2) {
      const count = level === 3 ? 18 : 11;
      for (let j = 1; j < count; j++) {
        const x = x0 + ((x1 - x0) * j) / count;
        const y = eave + (peak - eave) * (1 - Math.abs((j * 2) / count - 1));
        abox(
          out,
          'roof',
          [x - 0.011, y - 0.01, shell.z0 - 0.03],
          [x + 0.011, y + 0.023, shell.z1 - 0.02],
          palette.roofDark,
        );
      }
    }
  }
  const middle = bays[1];
  const ridge = (middle.x0 + middle.x1) / 2;
  for (const z of [-11.2, 8.85])
    lathe(
      out,
      'roof',
      [ridge, z],
      [
        [middle.peak - 0.08, 0.53, 0.53],
        [middle.peak + 0.29, 0.36, 0.36],
        [middle.peak + 0.58, 0.38, 0.38],
        [middle.peak + 0.63, 0.53, 0.53],
        [middle.peak + 0.84, 0.44, 0.44],
        [middle.peak + 0.98, 0.098, 0.098],
      ],
      level >= 2 ? 10 : 5,
      palette.roofDark,
    );
  const counts = level ? [5, 7] : [3, 3];
  for (let i = 0; i < counts[0]; i++)
    for (let j = 0; j < counts[1]; j++) {
      if (level === 1 && i > 0 && i < counts[0] - 1 && j > 0 && j < counts[1] - 1) continue;
      const x = shell.x0 + 0.27 + ((shell.x1 - shell.x0 - 0.54) * i) / (counts[0] - 1);
      const z = shell.z0 + 0.27 + ((shell.z1 - shell.z0 - 0.54) * j) / (counts[1] - 1);
      const grade = Math.min(floor - 0.17, nativeGrade(x, z));
      const radius = level >= 2 ? 0.26 : 0.29;
      abox(
        out,
        'base',
        [x - radius, grade - 0.27, z - radius],
        [x + radius, floor - 0.16, z + radius],
        palette.stone,
        { bottom: false },
      );
    }
}

function parapetHeight(bay, t) {
  const step = Math.abs(t);
  const transition = 5.77 + 0.19 * (bay.parapet - 7.72);
  if (step >= 0.91) return transition;
  if (step >= 0.72) return transition + 0.42;
  return (
    transition + 0.59 + (bay.parapet - transition - 0.59) * Math.sqrt(1 - (t / 0.72) * (t / 0.72))
  );
}

function signLetter(out, glyph, x, y, z, width, height) {
  if (glyph === 'W') {
    signLetter(out, 'V', x - width * 0.22, y, z, width * 0.63, height);
    signLetter(out, 'V', x + width * 0.22, y, z, width * 0.63, height);
    return;
  }
  if (glyph !== 'U' && glyph !== 'O' && glyph !== 'G') {
    const atCenter = {
      addQuad(slot, ref, points, normal, uv, tint) {
        out.addQuad(
          slot,
          ref,
          points.map(([u, yy, zz]) => [x + u, yy, zz]),
          normal,
          uv,
          tint,
        );
      },
      addConvexPolygon(slot, ref, points, normal, uv, tint) {
        out.addConvexPolygon(
          slot,
          ref,
          points.map(([u, yy, zz]) => [x + u, yy, zz]),
          normal,
          uv,
          tint,
        );
      },
    };
    lettering(atCenter, glyph, {
      width,
      height,
      y,
      z,
      color: palette.sign,
      slot: 'painted',
      stroke: width * 0.102,
    });
    return;
  }
  const center = x - width * 0.13;
  const begin = glyph === 'O' ? 0 : glyph === 'G' ? 0.17 * Math.PI : Math.PI;
  const end = glyph === 'G' ? 1.97 * Math.PI : 2 * Math.PI;
  const stroke = width * 0.056;
  for (let i = 0; i < 7; i++) {
    const angles = [begin + ((end - begin) * i) / 7, begin + ((end - begin) * (i + 1)) / 7];
    const point = (angle, s) => [
      center + (width * 0.36 + s) * Math.cos(angle),
      y + height * 0.5 + (height * 0.5 + s) * Math.sin(angle),
      z,
    ];
    quad4(
      out,
      'painted',
      point(angles[0], -stroke),
      point(angles[0], stroke),
      point(angles[1], stroke),
      point(angles[1], -stroke),
      palette.sign,
    );
  }
  if (glyph === 'G') {
    const u = center + width * 0.37;
    const middle = y + height * 0.46;
    fbox(
      out,
      'painted',
      facadeFront,
      center + width * 0.07,
      u,
      middle,
      middle + stroke * 2,
      z - shell.z1 - 0.015,
      z - shell.z1 + 0.005,
      palette.sign,
    );
  }
  if (glyph === 'U')
    for (const sign of [-1, 1]) {
      const u = center + sign * width * 0.36;
      fbox(
        out,
        'painted',
        facadeFront,
        u - 0.044,
        u + 0.044,
        y + height * 0.48,
        y + height,
        z - shell.z1 - 0.02,
        z - shell.z1,
        palette.sign,
      );
    }
}

function parapet(out, level) {
  for (const bay of bays) {
    const { x0, x1, sign } = bay;
    const mid = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    const positions = level
      ? [
          -1, -0.913, -0.906, -0.725, -0.714, -0.57, -0.42, -0.27, -0.135, 0, 0.135, 0.27, 0.42,
          0.57, 0.714, 0.725, 0.906, 0.913, 1,
        ]
      : [-1, -0.9, -0.71, -0.45, 0, 0.45, 0.71, 0.9, 1];
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1];
      const b = positions[i];
      const x = mid + a * half;
      const xx = mid + b * half;
      const y = parapetHeight(bay, a);
      const yy = parapetHeight(bay, b);
      const fp = facadeFront.P;
      quad4(
        out,
        'painted',
        fp(x, 4.38, 0.096),
        fp(xx, 4.38, 0.096),
        fp(xx, yy, 0.096),
        fp(x, y, 0.096),
        palette.front,
      );
      quad4(
        out,
        'painted',
        fp(xx, 4.38, -0.105),
        fp(x, 4.38, -0.105),
        fp(x, y, -0.105),
        fp(xx, yy, -0.105),
        palette.frontShade,
      );
      quad4(
        out,
        'painted',
        fp(x, y, 0.11),
        fp(xx, yy, 0.11),
        fp(xx, yy, -0.123),
        fp(x, y, -0.123),
        palette.gutter,
      );
      if (level >= 2)
        quad4(
          out,
          'painted',
          fp(x, y - 0.11, 0.11),
          fp(xx, yy - 0.11, 0.11),
          fp(xx, yy, 0.11),
          fp(x, y, 0.11),
          palette.frontShade,
        );
    }
    const fp = facadeFront.P;
    for (const [x, t, flip] of [
      [x0, -1, true],
      [x1, 1, false],
    ]) {
      const points = [
        fp(x, 4.38, 0.096),
        fp(x, 4.38, -0.105),
        fp(x, parapetHeight(bay, t), -0.105),
        fp(x, parapetHeight(bay, t), 0.096),
      ];
      quad4(out, 'painted', ...(flip ? points.reverse() : points), palette.frontShade);
    }
    if (level) {
      const charAdvance = (x1 - x0) * 0.115;
      for (let i = 0; i < sign.length; i++) {
        const x = mid + (i - (sign.length - 1) / 2) * charAdvance;
        const height = bay === bays[0] ? 0.92 : 0.72;
        const y = parapetHeight(bay, (x - mid) / half) - height - 0.32;
        signLetter(out, sign[i], x, y, shell.z1 + 0.186, charAdvance * 0.87, height);
      }
    }
  }
  if (level >= 2) {
    const subtitle = 'GENERAL MERCHANTS  SHIPPING  FORWARDING  AND COMMISSION AGENTS';
    const advance = 25.4 / subtitle.length;
    for (let i = 0; i < subtitle.length; i++) {
      const x = (shell.x0 + shell.x1) / 2 + (i - (subtitle.length - 1) / 2) * advance;
      signLetter(out, subtitle[i], x, 5.28, shell.z1 + 0.16, advance, 0.34);
    }
  }
}

function awning(
  out,
  face,
  lo,
  hi,
  depth,
  level,
  { high = 4.62, gutter = high - depth * 0.19, innerLo = lo, innerHi = hi } = {},
) {
  const p = face.P;
  quad4(
    out,
    'roof',
    p(lo, gutter, depth),
    p(hi, gutter, depth),
    p(innerHi, high, 0),
    p(innerLo, high, 0),
    palette.roof,
  );
  quad4(
    out,
    'roof',
    p(hi, gutter - 0.065, depth),
    p(lo, gutter - 0.065, depth),
    p(innerLo, high - 0.065, 0),
    p(innerHi, high - 0.065, 0),
    palette.roofDark,
  );
  fbox(
    out,
    'painted',
    face,
    lo,
    hi,
    gutter - 0.17,
    gutter + 0.013,
    depth - 0.095,
    depth + 0.01,
    palette.gutter,
  );
  const count = Math.round((hi - lo) / (level ? 3.22 : 7.4));
  for (let i = 0; i <= count; i++) {
    const u = lo + 0.14 + ((hi - lo - 0.28) * i) / count;
    const [x, , z] = p(u, 0, depth - 0.15);
    const grade = nativeGrade(x, z);
    fbox(
      out,
      'timber',
      face,
      u - 0.068,
      u + 0.068,
      grade - 0.17,
      gutter - 0.13,
      depth - 0.21,
      depth - 0.079,
      palette.grey,
      { bottom: true },
    );
    if (level >= 2)
      fbox(
        out,
        'base',
        face,
        u - 0.084,
        u + 0.084,
        grade - 0.14,
        grade + 0.23,
        depth - 0.24,
        depth - 0.053,
        palette.stone,
      );
  }
}

function loadingRamp(out, face, u, width, length) {
  const p = face.P;
  const [x, , z] = p(u, 0, length);
  const grade = nativeGrade(x, z);
  const half = width * 0.5;
  const down = Math.min(grade + 0.11, floor - 0.08);
  quad4(
    out,
    'timber',
    p(u - half, down, length),
    p(u + half, down, length),
    p(u + half, floor, 0),
    p(u - half, floor, 0),
    palette.timber,
  );
  for (const side of [-1, 1]) {
    const edge = u + half * side;
    const points = [
      p(edge, floor - 0.17, 0),
      p(edge, down - 0.17, length),
      p(edge, down, length),
      p(edge, floor, 0),
    ];
    quad4(out, 'timber', ...(side > 0 ? points.reverse() : points), palette.grey);
  }
}

function stairs(out, face, u, level) {
  const [x, , z] = face.P(u, 0, 2);
  const grade = Math.min(floor - 0.235, nativeGrade(x, z));
  const count = level >= 2 ? 6 : 3;
  for (let i = 0; i < count; i++) {
    const front = (i * 1.86) / count;
    const y = floor - ((floor - grade) * i) / count;
    fbox(
      out,
      'base',
      face,
      u - 0.77,
      u + 0.77,
      grade - 0.22,
      y,
      front,
      front + 1.87 / count,
      palette.stone,
    );
  }
}

function streetAndYard(out, level) {
  const outerLeft = left + 0.21;
  const outerFront = front - 0.095;
  const hipGutter = 4.015;
  awning(out, facadeFront, outerLeft, right - 0.05, outerFront - shell.z1, level, {
    gutter: hipGutter,
    innerLo: shell.x0,
  });
  awning(out, facadeSide, shell.z0 - 0.04, outerFront, shell.x0 - outerLeft, level, {
    gutter: hipGutter,
    innerHi: shell.z1,
  });
  awning(out, facadeBack, -shell.x1, -shell.x0, shell.z0 - back - 0.11, level, { high: 3.89 });
  const sideWindows = [
    [-15.2, 1.42, 1.62, 2.01],
    [-7.8, 1.35, 1.46, 2.1],
    [5.8, 1.48, 1.57, 2.04],
    [15.5, 1.38, 1.6, 2.08],
  ];
  windows(
    out,
    facadeFront,
    [
      [-10.78, 1.69, 2.34, 1.47, true],
      [-3.82, 1.7, 2.34, 1.47, true],
      [-0.93, 1.3, 1.79, 1.85],
      [2.66, 1.53, 1.79, 1.85],
      [5.79, 1.3, 1.79, 1.85],
    ],
    level >= 2,
  );
  windows(out, facadeSide, sideWindows, level >= 2);
  windows(
    out,
    facadeBack,
    [
      [10.72, 1.53, 1.69, 1.91],
      [3.92, 1.54, 1.69, 1.91],
      [-0.7, 1.32, 1.27, 2.4],
      [-4.94, 1.3, 1.24, 2.39],
    ],
    level >= 2,
  );
  windows(out, facadeYard, [[17.82, 1.29, 1.63, 1.83]], level >= 2);
  doors(
    out,
    facadeFront,
    [
      [-7.28, 1.68, 2.63, false],
      [0.87, 1.21, 2.57, false],
      [10.6, 3.64, 2.84, true],
    ],
    level,
  );
  doors(
    out,
    facadeSide,
    [
      [-2.9, 1.76, 2.83, false],
      [10.78, 1.79, 2.86, false],
    ],
    level,
  );
  doors(
    out,
    facadeBack,
    [
      [7.34, 1.84, 2.76, false],
      [-2.53, 1.83, 2.64, false],
      [-10.75, 3.26, 2.78, true],
    ],
    level,
  );
  doors(
    out,
    facadeYard,
    [
      [-9.48, 3.96, 3.03, true],
      [6.95, 4.02, 2.98, true],
    ],
    level,
  );
  if (level) for (const u of [-2.9, 10.78]) stairs(out, facadeSide, u, level);
  loadingRamp(out, facadeYard, 6.95, 3.58, 2.88);
  if (level >= 2) {
    for (const bay of bays) {
      const u = -(bay.x0 + bay.x1) / 2;
      windows(out, facadeBack, [[u, 1.62, 0.8, eave + 0.56]], true);
    }
    for (const [u] of sideWindows)
      opening(out, facadeSide, u, 1.27, 0.69, 0.29, {
        glassSlot: 'glass',
        glass: palette.dark,
        frameSlot: 'timber',
        frame: palette.light,
        sill: false,
      });
  }
}

function build(out, level) {
  warehouse(out, level);
  parapet(out, level);
  streetAndYard(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'burns-philp-building-normanton-model.mjs';
const camera = [-53, 26, 65];
const lookAt = [0, 3.6, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-warehouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The Normanton Burns Philp store’s curved merchant parapet, three corrugated roofs, elevated timber floor and long covered street edges.',
  camera,
  lookAt,
  sunDirection: [-29, 53, 55],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outwardRing(controls.outline),
    minimumCoverage: 0.91,
    basis: 'The mapped Normanton Information Centre roof includes both covered street edges.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'stadium-lettering.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'landsborough-parapet-and-corner-awning',
      position: [-31, 12, 43],
      lookAt: [1, 4.3, 15],
    },
    { name: 'caroline-street-entrances', position: [-32, 9, 4], lookAt: [-8, 3.1, 1] },
    { name: 'three-gables-and-trade-yard', position: [29, 13, -41], lookAt: [3, 3.6, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'normanton-store-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.103, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.027, surfaces },
    },
  },
};
