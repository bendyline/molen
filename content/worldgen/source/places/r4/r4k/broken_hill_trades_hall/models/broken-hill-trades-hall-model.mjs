import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/broken-hill-trades-hall-shape-controls');
const blockOutline = outwardRing(shape.outline);
const hall = outwardRing(shape.ornamentedHall);
const sulphide = wallFace(...shape.sulphideFacade);
const blende = wallFace(...shape.blendeFacade);
const cut = wallFace(...shape.chamferedCorner);
const longOffice = wallFace(...shape.longBlendeOffice);
const eave = shape.estimatedHeights.mainEave;
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.93 },
  moulding: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.83 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
};
const stone = rgb('b5a586');
const pale = rgb('cab997');
const shadow = rgb('a39980');
const zinc = rgb('676963');
const iron = rgb('55594f');
const glass = rgb('4d5148');
const stained = rgb('726354');
const wood = rgb('5c4c3e');

function band(out, f, y, h, d, color = pale, a = 0, b = f.length) {
  fbox(out, 'moulding', f, a, b, y, y + h, -0.12, d, color);
}
function window(
  out,
  f,
  u,
  y,
  width,
  height,
  level,
  { depth = 0.04, door = false, mullions = 0, arch = true } = {},
) {
  if (level === 1) {
    const l = u - width * 0.5,
      r = u + width * 0.5;
    quad4(
      out,
      door ? 'timber' : 'glazing',
      f.P(l, y, depth),
      f.P(r, y, depth),
      f.P(r, y + height, depth),
      f.P(l, y + height, depth),
      door ? wood : glass,
    );
    return;
  }
  opening(out, f, u, y, width, height, {
    head: arch ? 'round' : 'flat',
    glassSlot: door ? 'timber' : 'glazing',
    frameSlot: 'moulding',
    glass: door ? wood : glass,
    frame: pale,
    frameWidth: door ? 0.205 : 0.16,
    frameDepth: 0.2,
    d: depth,
    sill: !door,
    mullions,
    transoms: level === 3 ? 1 : 0,
    mullionColor: door ? stained : pale,
  });
  if (level >= 3 && arch)
    fbox(
      out,
      'moulding',
      f,
      u - 0.115,
      u + 0.115,
      y + height - 0.06,
      y + height + 0.26,
      depth - 0.05,
      depth + 0.23,
      pale,
    );
}
function pilaster(out, f, u, level) {
  fbox(out, 'moulding', f, u - 0.24, u + 0.24, 0.18, eave + 0.15, -0.13, 0.17, shadow);
  for (const [y, h, w, d] of [
    [0.22, 0.38, 0.37, 0.28],
    [4.02, 0.15, 0.33, 0.27],
    [4.32, 0.23, 0.33, 0.27],
    [8.38, 0.19, 0.36, 0.29],
  ])
    band(out, f, y, h, d, pale, u - w, u + w);
  if (level >= 2) {
    for (let i = 0; i < 8; i++) {
      const y = 0.64 + i * 0.4,
        width = i % 2 === 0 ? 0.295 : 0.265;
      band(
        out,
        f,
        y,
        0.26,
        i % 2 === 0 ? 0.226 : 0.193,
        i % 2 === 0 ? pale : shadow,
        u - width,
        u + width,
      );
    }
    for (const y of [5.01, 6.32, 7.73])
      fbox(out, 'moulding', f, u - 0.112, u + 0.112, y, y + 0.48, 0.17, 0.198, pale);
  }
}
function finial(out, f, u, base, level) {
  fbox(out, 'moulding', f, u - 0.34, u + 0.34, base - 0.12, base + 0.48, -0.18, 0.3, stone);
  fbox(out, 'moulding', f, u - 0.41, u + 0.41, base + 0.42, base + 0.54, -0.22, 0.38, pale);
  const [x, , z] = f.P(u, 0, 0.06);
  lathe(
    out,
    'moulding',
    [x, z],
    [
      [base + 0.51, 0.24, 0.24],
      [base + 0.72, 0.23, 0.23],
      [base + 0.85, 0.16, 0.16],
      [base + 1.1, 0.1, 0.1],
      [base + 1.38, 0, 0],
    ],
    level === 3 ? 8 : 5,
    pale,
    { capTop: false },
  );
}
function cornice(out, f, y, level) {
  band(out, f, 0.22, 0.25, 0.22, shadow);
  band(out, f, 3.92, 0.21, 0.27);
  band(out, f, 4.38, 0.19, 0.34);
  band(out, f, y - 0.51, 0.22, 0.41);
  band(out, f, y - 0.29, 0.24, 0.47);
  band(out, f, y + 0.26, 0.2, 0.23);
  if (level < 2) return;
  for (let u = 0.4; u < f.length - 0.3; u += 0.67)
    fbox(out, 'moulding', f, u - 0.07, u + 0.07, y - 0.72, y - 0.53, 0.08, 0.36, shadow);
}
function pediment(out, f, u, h, w, d) {
  const l = u - w * 0.5,
    r = u + w * 0.5,
    v = h + w * 0.2;
  tri(out, 'rubble', f.P(l, h, d - 0.055), f.P(r, h, d - 0.055), f.P(u, v, d - 0.055), stone);
  band(out, f, h - 0.24, 0.19, d, pale, l, r);
  for (const [a, b, c, e] of [
    [l, h, u, v],
    [u, v, r, h],
  ]) {
    quad4(
      out,
      'moulding',
      f.P(a, b - 0.09, d),
      f.P(c, e - 0.09, d),
      f.P(c, e + 0.11, d),
      f.P(a, b + 0.11, d),
      pale,
    );
    quad4(
      out,
      'moulding',
      f.P(a, b + 0.11, d),
      f.P(c, e + 0.11, d),
      f.P(c, e + 0.11, d - 0.3),
      f.P(a, b + 0.11, d - 0.3),
      pale,
    );
  }
}
function front(out, level) {
  cornice(out, sulphide, eave, level);
  cornice(out, blende, eave, level);
  cornice(out, cut, eave, level);
  for (const [f, steps] of [
    [sulphide, [0.04, 0.23, 0.46, 0.74, 0.98]],
    [blende, [0.06, 0.28, 0.53, 0.76, 0.97]],
    [cut, [0.06, 0.94]],
  ]) {
    for (const [i, t] of steps.entries()) {
      const u = Math.min(f.length - 0.2, Math.max(0.2, t * f.length));
      if (level >= 1) pilaster(out, f, u, level);
      if (f !== cut || i === 1) finial(out, f, u, eave + 0.48, level);
    }
  }
  const u = sulphide.length * 0.59;
  pediment(out, sulphide, u, eave + 0.72, 3.54, 0.3);
  if (level === 0) return;
  for (const t of [0.12, 0.35, 0.86]) {
    const a = t * sulphide.length;
    window(out, sulphide, a, 0.52, 1.38, 2.63, level, { mullions: 1, door: t === 0.12 });
    window(out, sulphide, a, 4.84, 1.48, 2.74, level, { mullions: 1 });
  }
  window(out, sulphide, u, 0.22, 2.45, 3.62, level, { door: true, mullions: 1 });
  for (const off of [-1.1, 0, 1.1]) window(out, sulphide, u + off, 4.77, 0.83, 2.76, level);
  pediment(out, sulphide, u, 3.77, 3.43, 0.48);
  band(out, sulphide, 0.15, 0.11, 0.76, pale, u - 1.3, u + 1.3);
  band(out, sulphide, 0.05, 0.1, 1.1, shadow, u - 1.56, u + 1.56);
  const v = cut.length * 0.5;
  window(out, cut, v, 0.34, 1.41, 2.89, level, { door: true, mullions: 1 });
  window(out, cut, v, 4.81, 1.34, 2.72, level, { mullions: 1 });
  for (const t of [0.145, 0.405, 0.644, 0.861]) {
    window(out, blende, t * blende.length, 0.61, 1.2, 2.64, level, { mullions: 1 });
    window(out, blende, t * blende.length, 4.8, 1.27, 2.72, level, { mullions: 1 });
  }
}
function mansard(out, level) {
  const mid = [
    hall.reduce((n, [x]) => n + x, 0) / hall.length,
    hall.reduce((n, [, z]) => n + z, 0) / hall.length,
  ];
  const top = shape.estimatedHeights.wingShoulderM;
  const slice = (s, y) =>
    hall.map(([x, z]) => [mid[0] + s * (x - mid[0]), y, mid[1] + s * (z - mid[1])]);
  const base = slice(0.994, eave - 0.01),
    second = slice(0.79, top - 0.23),
    upper = slice(0.71, top);
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    quad4(out, 'roof', base[i], base[j], second[j], second[i], zinc);
    quad4(out, 'roof', second[i], second[j], upper[j], upper[i], zinc);
  }
  roofCap(
    out,
    upper.map(([x, , z]) => [x, z]),
    top,
  );
  const u = sulphide.length * 0.59;
  const [x, , z] = sulphide.P(u, 0, -1.02),
    h = shape.estimatedHeights.principalRoofM;
  const tower = wallFace([x - 2.34, z], [x + 2.34, z]);
  const p = tower.P;
  const forward = [
    [
      p(0, eave - 0.02, 0.02),
      p(tower.length, eave - 0.02, 0.02),
      p(tower.length - 0.55, h, -1.36),
      p(0.55, h, -1.36),
    ],
    [
      p(tower.length, eave - 0.02, 0.02),
      p(tower.length, eave - 0.02, -10),
      p(tower.length - 0.55, h, -8.74),
      p(tower.length - 0.55, h, -1.36),
    ],
    [p(0, eave - 0.02, -10), p(0, eave - 0.02, 0.02), p(0.55, h, -1.36), p(0.55, h, -8.74)],
    [
      p(tower.length, eave - 0.02, -10),
      p(0, eave - 0.02, -10),
      p(0.55, h, -8.74),
      p(tower.length - 0.55, h, -8.74),
    ],
    [
      p(0.55, h, -1.36),
      p(tower.length - 0.55, h, -1.36),
      p(tower.length - 0.55, h, -8.74),
      p(0.55, h, -8.74),
    ],
  ];
  for (const vertices of forward) quad4(out, 'roof', ...vertices, zinc);
  const hip = wallFace([x - 1.48, z - 0.83], [x + 1.48, z - 0.83]);
  if (level >= 1) {
    window(out, hip, hip.length / 2, 11.18, 0.63, 1.06, level, { depth: 0.05 });
    pediment(out, hip, hip.length / 2, 12.14, 1.18, 0.105);
    for (const [f, steps] of [
      [sulphide, [0.26, 0.86]],
      [blende, [0.22, 0.62]],
    ]) {
      for (const t of steps) {
        const u = t * f.length,
          wall = -0.8;
        fbox(out, 'moulding', f, u - 0.54, u + 0.54, 9.46, 10.59, wall - 0.31, wall + 0.21, stone);
        window(out, f, u, 9.53, 0.61, 0.88, level, { depth: wall + 0.24 });
        const [ax, , az] = f.P(u - 0.6, 0, wall + 0.23),
          [bx, , bz] = f.P(u + 0.6, 0, wall + 0.23);
        const dormer = wallFace([ax, az], [bx, bz]);
        pediment(out, dormer, dormer.length / 2, 10.52, 1.29, 0.106);
      }
    }
  }
  if (level >= 2)
    lathe(
      out,
      'rail',
      [x, z - 1.69],
      [
        [h, 0.046, 0.046],
        [h + 4.2, 0.038, 0.038],
      ],
      5,
      iron,
      { capTop: false },
    );
  abox(out, 'rubble', [6.03, 10.04, 9.83], [7.27, 14.42, 11.17], stone);
  abox(out, 'moulding', [5.91, 14.27, 9.71], [7.39, 14.53, 11.3], pale);
  if (level >= 1)
    for (const x of [6.28, 6.69, 7.06])
      lathe(
        out,
        'moulding',
        [x, 10.45],
        [
          [14.51, 0.123, 0.123],
          [14.77, 0.137, 0.137],
        ],
        6,
        shadow,
        { capTop: true },
      );
}
function lowerWing(out, level) {
  const outX = 8.73,
    farX = -8.41;
  abox(out, 'rubble', [farX, 3.78, -23.97], [outX, 7.83, 3.31], stone);
  gableRoof(
    out,
    'roof',
    [(outX + farX) / 2, 3.35],
    [(outX + farX) / 2, -24.07],
    outX - farX,
    7.83,
    shape.estimatedHeights.assemblyRidgeM,
    zinc,
    { overhang: 0.34, endSlot: 'rubble', endColor: stone },
  );
  const rightWall = wallFace([outX, 3.15], [outX, -24]);
  if (level >= 1) {
    for (let i = 0; i < 7; i++)
      window(out, rightWall, ((i + 0.5) * rightWall.length) / 7, 4.61, 1.35, 2.1, level);
    for (let i = 0; i < 7; i++)
      window(out, longOffice, ((i + 0.5) * longOffice.length) / 7, 0.43, 1.21, 2.37, level, {
        door: i % 3 === 0,
        arch: i % 3 !== 0,
      });
  }
  band(out, longOffice, 3.69, 0.31, 0.29);
  const a = wallFace([-14.39, -24.35], [-14.29, 17.72]);
  if (level >= 2)
    for (let i = 0; i < 8; i++)
      window(out, a, ((i + 0.5) * a.length) / 8, 0.54, 1.21, 2.2, level, { arch: false });
}
function roofCap(out, ring, height) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'roof',
      'palette:#ffffff',
      outwardRing(ring),
      [],
      () => height,
      [0, 1, 0],
      (point) => point,
      zinc,
    )
  ) {
    throw Error('Trades Hall roof could not be triangulated');
  }
  const { indices, positions } = b.finalize();
  for (let k = 0; k < indices.length; k += 3) {
    const vertices = [indices[k], indices[k + 1], indices[k + 2]].map((index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    tri(out, 'roof', ...vertices, zinc);
  }
}
function build(out, level) {
  extrude(out, 'rubble', blockOutline, -2.8, 4.23, stone, { top: false });
  roofCap(out, blockOutline, 4.218);
  extrude(out, 'rubble', hall, 4.15, eave + 0.3, stone, { top: false });
  lowerWing(out, level);
  front(out, level);
  mansard(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'broken-hill-trades-hall-model.mjs';
const camera = [33, 24, 53],
  lookAt = [-1, 6, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-assembly-hall',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The historic Broken Hill union hall with a chamfered corner, arched stone openings, iron mansard, finials and an attached assembly hall.',
  camera,
  lookAt,
  sunDirection: [-32, 36, 42],
  mediumFiContext: {
    scale: 1.07,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: blockOutline,
    minimumCoverage: 0.86,
    basis:
      'Replace the mapped Trades Hall shell while leaving the separate premises across the streets.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'sulphide-street-double-storey-facade', position: [1, 8.8, 40], lookAt: [0, 6.7, 15] },
    { name: 'blende-street-chamfer-and-mansard', position: [34, 12.4, 37], lookAt: [12, 7.1, 13] },
    { name: 'assembly-roof-and-office-range', position: [32, 15, -36], lookAt: [3, 5, -12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'broken-hill-trades-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.36,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.064, surfaces },
    },
  },
};
