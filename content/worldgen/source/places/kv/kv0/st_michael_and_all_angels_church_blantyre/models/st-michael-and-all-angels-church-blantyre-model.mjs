import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const measured = read('native-map/st-michael-and-all-angels-church-blantyre-shape-controls');
const outline = outwardRing(measured.outline);
const apse = outwardRing(measured.apse);
const grade = 0.54;
const c = Object.fromEntries(
  Object.entries({
    brick: '995f51',
    shadowBrick: '8a564b',
    moulding: 'ab735e',
    lightBrick: 'b78069',
    stone: '9b8a70',
    step: 'aa9780',
    roof: '777a73',
    dome: 'a7aaa0',
    dark: '4c423c',
    glass: '575c55',
    wood: '694f42',
    iron: '5f5450',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'brick_longformat', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.955 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.82 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
};

function masonry(out, ring, low, high, slot, color) {
  const body = outwardRing(ring);
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      slot,
      'palette:#ffffff',
      body,
      [],
      () => high,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Blantyre masonry cap could not be triangulated');
  const { positions, indices } = cap.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const point = (n) => Array.from(positions.slice(n * 3, n * 3 + 3));
    tri(out, slot, point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), color);
  }
  for (let i = 0; i < body.length; i++) {
    const [x, z] = body[i],
      [nx, nz] = body[(i + 1) % body.length];
    quad4(out, slot, [x, low, z], [nx, low, nz], [nx, high, nz], [x, high, z], color);
  }
}
const nearWindow = (out, f, u, y, w, h, level, head = 'pointed') =>
  opening(out, f, u, y, w, h, {
    head,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: c.glass,
    frame: c.moulding,
    frameWidth: level >= 2 ? 0.142 : 0,
    frameDepth: 0.14,
    d: 0.083,
    sill: level >= 2,
    mullions: level >= 2 && w > 1.08 ? 1 : 0,
    mullionColor: c.moulding,
  });

function base(out, level) {
  masonry(out, outline, -0.92, grade, 'stone', c.stone);
  abox(out, 'brick', [-5.035, grade, 3.42], [6.066, 7.38, 22.82], c.brick, { bottom: false });
  abox(out, 'brick', [-4.78, grade, -6.73], [4.44, 7.43, 4.02], c.brick, { bottom: false });
  masonry(out, apse, grade - 0.02, 5.84, 'brick', c.brick);
  const roof = [-0.16, -6.31];
  const n = level === 0 ? 8 : level === 1 ? 14 : 22;
  lathe(
    out,
    'roof',
    roof,
    [
      [5.84, 4.86, 3.76],
      [6.1, 4.81, 3.72],
      [7.31, 3.28, 2.71],
      [8.85, 1.26, 1.14],
      [9.47, 0.03, 0.03],
    ],
    n,
    c.roof,
  );
  gableRoof(out, 'roof', [0.51, 3.37], [0.51, 22.9], 11.1, 7.37, 11.28, c.roof, {
    endSlot: 'brick',
    endColor: c.brick,
    overhang: 0.28,
  });
  const naveSides = [
    [wallFace([6.066, 22.82], [6.066, 4.17]), [3.91, 6.18, 8.63, 11.04, 13.41, 15.79]],
    [wallFace([-5.035, 3.51], [-5.035, 22.82]), [2.19, 4.62, 7.04, 9.45, 11.85, 14.22]],
  ];
  for (const [f, positions] of naveSides) {
    fbox(out, 'trim', f, 0, f.length, 6.81, 7.03, -0.04, 0.14, c.moulding);
    if (level === 0) continue;
    for (const u of positions) {
      nearWindow(out, f, u, 2.55, 0.98, 3.15, level);
      if (level >= 2) {
        fbox(out, 'brick', f, u + 1.08, u + 1.43, 0.66, 6.29, -0.06, 0.42, c.shadowBrick);
        fbox(out, 'trim', f, u + 1.02, u + 1.48, 5.94, 6.3, 0.01, 0.52, c.moulding);
        fbox(out, 'trim', f, u - 0.63, u + 0.63, 2.42, 2.58, 0.02, 0.13, c.lightBrick);
      }
    }
  }
  if (level >= 1) {
    for (let i = 1; i < apse.length - 1; i++) {
      const f = wallFace(apse[i], apse[(i + 1) % apse.length]);
      if (f.length < 0.8) continue;
      nearWindow(
        out,
        f,
        f.length * 0.5,
        2.24,
        Math.min(f.length * 0.64, 1.36),
        2.67,
        level,
        'round',
      );
      if (level >= 2) fbox(out, 'trim', f, 0, f.length, 5.13, 5.39, -0.045, 0.19, c.moulding);
    }
  }
}

function buttress(out, x, z, side, level) {
  const foot = x + side * 0.1;
  abox(out, 'brick', [foot - 0.31, 0.53, z - 0.31], [foot + 0.31, 8.65, z + 0.31], c.shadowBrick);
  if (level >= 1) {
    const toward = [x - side * 2.41, 10.69, z];
    const lower = [x, 7.01, z],
      upper = [x, 8.23, z];
    const a = [lower[0], lower[1], z - 0.23],
      b = [toward[0], toward[1] - 0.85, z - 0.23];
    const d = [upper[0], upper[1], z - 0.23],
      e = [toward[0], toward[1], z - 0.23];
    const a2 = [a[0], a[1], z + 0.23],
      b2 = [b[0], b[1], z + 0.23];
    const d2 = [d[0], d[1], z + 0.23],
      e2 = [e[0], e[1], z + 0.23];
    quad4(out, 'brick', a, b, e, d, c.brick);
    quad4(out, 'brick', b2, a2, d2, e2, c.brick);
    quad4(out, 'trim', d, e, e2, d2, c.moulding);
    quad4(out, 'brick', a2, b2, b, a, c.shadowBrick);
  }
  if (level >= 2) {
    abox(out, 'trim', [foot - 0.41, 8.49, z - 0.4], [foot + 0.41, 8.77, z + 0.4], c.moulding);
    abox(out, 'trim', [foot - 0.222, 8.78, z - 0.22], [foot + 0.222, 9.02, z + 0.22], c.lightBrick);
  }
}

function transepts(out, level) {
  const arms = [
    { edge: -9.836, inner: -4.74, rear: -3.005, front: 3.48, sign: -1 },
    { edge: 9.46, inner: 4.27, rear: -3.167, front: 5.235, sign: 1 },
  ];
  for (const { edge, inner, rear, front, sign } of arms) {
    const low = Math.min(edge, inner),
      high = Math.max(edge, inner);
    abox(out, 'brick', [low, grade, rear], [high, 7.35, front], c.brick, { bottom: false });
    const cz = (rear + front) * 0.5;
    gableRoof(out, 'roof', [low, cz], [high, cz], front - rear, 7.34, 10.16, c.roof, {
      endSlot: 'brick',
      endColor: c.shadowBrick,
      overhang: 0.16,
    });
    const f =
      sign < 0 ? wallFace([edge, rear], [edge, front]) : wallFace([edge, front], [edge, rear]);
    fbox(out, 'trim', f, 0, f.length, 6.5, 6.73, -0.045, 0.13, c.moulding);
    if (level >= 1) {
      const centre = f.length * 0.5;
      nearWindow(out, f, centre, 3.08, 2.09, 3.57, level);
    }
    if (level >= 2) {
      nearWindow(out, f, f.length * 0.5, 7.82, 0.83, 1.06, level, 'round');
      for (const s of [1.05, f.length - 1.05]) nearWindow(out, f, s, 3.25, 0.61, 2.65, level);
    }
    for (const z of [rear + 0.35, front - 0.31]) buttress(out, edge, z, sign, level);
  }
}

function cross(out, x, y, z, scale) {
  abox(
    out,
    'trim',
    [x - 0.039 * scale, y, z - 0.04 * scale],
    [x + 0.04 * scale, y + 0.83 * scale, z + 0.04 * scale],
    c.iron,
  );
  abox(
    out,
    'trim',
    [x - 0.255 * scale, y + 0.515 * scale, z - 0.04 * scale],
    [x + 0.255 * scale, y + 0.595 * scale, z + 0.04 * scale],
    c.iron,
  );
}

function dome(out, level) {
  const origin = [0.02, 0.47],
    d = level === 0 ? 8 : level === 1 ? 16 : level === 2 ? 24 : 40;
  const cylindrical = (h, r) => [h, r, r];
  lathe(
    out,
    'brick',
    origin,
    [
      [7.85, 4.26],
      [10.04, 4.32],
      [10.32, 4.54],
      [10.59, 4.52],
      [12.53, 4.28],
      [12.73, 4.44],
      [12.97, 4.37],
    ].map(([h, r]) => cylindrical(h, r)),
    8,
    c.brick,
    { capTop: false, rotation: Math.PI / 8 },
  );
  const profile = [
    [12.88, 4.16],
    [13.25, 4.09],
    [13.83, 3.78],
    [14.43, 3.29],
    [14.96, 2.6],
    [15.36, 1.7],
    [15.58, 0.7],
    [15.64, 0.043],
  ];
  const domeProfile = level === 0 ? profile.filter((_, i) => [0, 2, 4, 7].includes(i)) : profile;
  lathe(
    out,
    'roof',
    origin,
    domeProfile.map(([h, r]) => cylindrical(h, r)),
    d,
    c.dome,
    { rotation: Math.PI / 8 },
  );
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const F = facade(
        [origin[0] + 3.95 * Math.sin(angle), origin[1] + 3.95 * Math.cos(angle)],
        [Math.cos(angle), -Math.sin(angle)],
      );
      nearWindow(out, F, 0, 11.04, 1.19, 1.47, level, 'round');
      if (level >= 2) {
        for (const u of [-1.22, 1.22]) {
          fbox(out, 'trim', F, u - 0.132, u + 0.132, 10.5, 12.57, -0.18, 0.19, c.moulding);
          fbox(out, 'trim', F, u - 0.2, u + 0.2, 12.41, 12.64, -0.2, 0.25, c.lightBrick);
        }
      }
    }
    cross(out, origin[0], 15.62, origin[1], 0.84);
  }
}

function tower(out, x, z, square, level) {
  const half = square ? 1.67 : 1.59;
  const left = x - half,
    right = x + half,
    rear = z - 3.23;
  const high = square ? 12.06 : 11.84;
  const profile = square ? c.brick : c.shadowBrick;
  abox(out, 'brick', [left, grade, rear], [right, high, z], profile, { bottom: false });
  abox(
    out,
    'trim',
    [left - 0.14, high - 0.29, rear - 0.13],
    [right + 0.13, high + 0.05, z + 0.145],
    c.moulding,
  );
  const centre = [x, (rear + z) * 0.5];
  const top = square ? 13.76 : 13.4;
  const rotation = square ? Math.PI / 4 : Math.PI / 8;
  const rad = half * (square ? 1.18 : 0.99);
  lathe(
    out,
    square ? 'brick' : 'roof',
    centre,
    [
      [high, rad, rad],
      [high + 0.48, rad * 0.896, rad * 0.896],
      [top - 0.33, rad * 0.59, rad * 0.59],
      [top, rad * 0.12, rad * 0.12],
    ],
    square ? 4 : 8,
    square ? c.moulding : c.roof,
    { rotation },
  );
  if (level === 0) return;
  const ring = [
    [left, z],
    [right, z],
    [right, rear],
    [left, rear],
  ];
  for (let j = 0; j < 4; j++) {
    const F = wallFace(ring[j], ring[(j + 1) % 4]);
    for (const v of [7.2, 9.71, 11.28])
      fbox(out, 'trim', F, 0, F.length, v - 0.07, v + 0.07, -0.03, 0.105, c.moulding);
    nearWindow(out, F, F.length * 0.5, 9.95, 1.42, 1.23, level, 'pointed');
    if (j !== 2) nearWindow(out, F, F.length * 0.5, 2.6, 1.18, 3.75, level);
    if (level >= 2) {
      for (const u of [0.2, F.length - 0.2]) {
        fbox(out, 'trim', F, u - 0.18, u + 0.18, grade, high - 0.12, -0.13, 0.25, c.moulding);
        fbox(
          out,
          'brick',
          F,
          u - 0.15,
          u + 0.15,
          high - 0.15,
          high + 0.62,
          -0.12,
          0.19,
          c.shadowBrick,
        );
      }
      fbox(out, 'trim', F, 0.49, F.length - 0.49, 8.61, 8.76, -0.03, 0.15, c.lightBrick);
    }
  }
  cross(out, x, top, centre[1], 0.93);
}

function west(out, level) {
  const z = 22.86;
  tower(out, -3.405, z, true, level);
  tower(out, 4.436, z, false, level);
  const f = facade([0.515, z], [1, 0]);
  fbox(out, 'brick', f, -2.28, 2.28, grade, 9.06, -0.36, 0.12, c.shadowBrick);
  tri(out, 'brick', f.P(-2.28, 9.03, 0.13), f.P(2.28, 9.03, 0.13), f.P(0, 11.25, 0.13), c.brick);
  nearWindow(out, f, 0, 2.21, 2.3, 3.68, level);
  fbox(out, 'timber', f, -1.1, 1.1, 0.68, 2.56, 0.13, 0.23, c.wood);
  if (level >= 1) {
    const arch = pointedArch(1.31, 1.32, level === 1 ? 4 : 7);
    for (let i = 0; i < arch.length - 1; i++) {
      const [a, y] = arch[i],
        [b, v] = arch[i + 1];
      quad4(
        out,
        'trim',
        f.P(a, 2.52 + y, 0.253),
        f.P(b, 2.52 + v, 0.253),
        f.P(b * 1.16, 2.52 + v * 1.1, 0.259),
        f.P(a * 1.16, 2.52 + y * 1.1, 0.259),
        c.lightBrick,
      );
    }
    nearWindow(out, f, 0, 6.12, 1.69, 2.51, level);
    if (level >= 2) {
      for (const u of [-1.46, 1.46])
        fbox(out, 'trim', f, u - 0.09, u + 0.09, 0.66, 2.52, 0.1, 0.254, c.lightBrick);
      fbox(out, 'trim', f, -2.16, 2.16, 8.91, 9.07, 0.07, 0.24, c.moulding);
    }
  }
  const turret = [5.01, 18.18];
  const discs = level === 0 ? 9 : level === 1 ? 14 : 24;
  const cylindrical = (h, r) => [h, r, r];
  lathe(
    out,
    'brick',
    turret,
    [
      [0.4, 1.51],
      [7.4, 1.47],
      [7.61, 1.59],
      [8.8, 1.48],
      [9.03, 1.6],
    ].map(([h, r]) => cylindrical(h, r)),
    discs,
    c.brick,
    { capTop: false },
  );
  lathe(
    out,
    'roof',
    turret,
    [
      [8.99, 1.57],
      [9.39, 1.54],
      [9.78, 1.19],
      [10.17, 0.57],
      [10.29, 0.066],
    ].map(([h, r]) => cylindrical(h, r)),
    discs,
    c.dome,
  );
  if (level >= 2) {
    for (const h of [4.25, 6.4, 7.68])
      lathe(
        out,
        'trim',
        turret,
        [
          [h, 1.5, 1.5],
          [h + 0.095, 1.53, 1.53],
        ],
        16,
        c.moulding,
        { capTop: false },
      );
  }
  if (level >= 1) {
    for (let i = 0; i < 4; i++) {
      const z0 = z + 1.7 - i * 0.36;
      abox(out, 'stone', [-1.94, 0.06, z0 - 0.36], [2.93, 0.18 + i * 0.12, z0], c.step, {
        bottom: false,
      });
    }
  }
}

function build(out, level) {
  base(out, level);
  transepts(out, level);
  dome(out, level);
  west(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'st-michael-and-all-angels-church-blantyre-model.mjs';
const camera = [41, 20, 46];
const lookAt = [0, 6, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The 1891 red-brick church in Blantyre with its unequal west towers, octagonal dome and rounded apse.',
  camera,
  lookAt,
  sunDirection: [44, 56, 64],
  mediumFiContext: {
    scale: 1.08,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis:
      'The named footprint defines the nave, short transepts, semicircular apse and the west front.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-towers-and-main-entrance', position: [-12, 9, 42], lookAt: [0, 6, 20] },
    { name: 'rounded-apse-and-crossing-dome', position: [34, 21, -34], lookAt: [0, 7, 1] },
    { name: 'handmade-brick-and-aisle-windows', position: [20, 9, 24], lookAt: [5, 5, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'blantyre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.051, surfaces },
    },
  },
};
