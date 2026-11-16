/** Saint Patrick's Cathedral in Karachi, opened in 1881. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box as meshBox,
  prism,
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const t = Object.fromEntries(
  Object.entries({
    sandstone: 'b29b77',
    ochre: 'a48f6f',
    finish: 'bda783',
    pale: 'c7b18b',
    edge: 'c7ae88',
    dark: '6c6052',
    door: '604f42',
    glass: '4c514e',
    colored: '686c62',
    metal: '78776b',
    clay: 'a56855',
    tile: '9b6254',
    spire: 'a68777',
    lead: '765d55',
    plinth: 'a0937b',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.9 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.9 },
  glass: { slot: 'window', localRef: palette, roughness: 0.68 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);

function pitchedRoof(out, width, length, eave, ridge, locate, tints, level) {
  const half = width / 2;
  const back = -length / 2;
  const front = length / 2;
  const slope = ridge - eave;
  const riseNormal = Math.hypot(slope, half);
  const place = (point) => locate(point, false);
  for (const side of [-1, 1]) {
    const u = side * half;
    const positions = [
      [u, eave, back],
      [u, eave, front],
      [0, ridge, front],
      [0, ridge, back],
    ];
    quad(
      out,
      'roof',
      positions.map(place),
      locate([(side * slope) / riseNormal, half / riseNormal, 0], true),
      tints[0],
    );
    for (const z of [back, front]) {
      const endNormal = locate([0, 0, Math.sign(z)], true);
      out.addTriangle(
        'stone',
        palette,
        [
          [u, eave, z],
          [0, eave, z],
          [0, ridge, z],
        ].map(place),
        endNormal,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        tints[1],
      );
    }
    if (level >= 2) {
      const strips = level === 3 ? 13 : 6;
      for (let i = 1; i < strips; i++) {
        const a = i / strips;
        const v = u * a;
        const y = ridge - slope * a;
        quad(
          out,
          'roof',
          [
            [v, y + 0.022, back],
            [v, y + 0.022, front],
            [v + side * 0.034, y + 0.019, front],
            [v + side * 0.034, y + 0.019, back],
          ].map(place),
          locate([(side * slope) / riseNormal, half / riseNormal, 0], true),
          t.tile,
        );
      }
    }
  }
}

function lancet(out, locate, normal, u, y, width, height, level, baseTint = t.glass) {
  const archHeight = Math.min(width * 0.94, height * 0.56);
  const spring = y + height - archHeight;
  const emit = (w, bottom, shoulder, peak, offset, tint, slot) => {
    const half = w / 2;
    const lower = [
      [u - half, bottom, offset],
      [u + half, bottom, offset],
      [u + half, shoulder, offset],
      [u - half, shoulder, offset],
    ];
    quad(out, slot, lower.map(locate), normal, tint);
    const rim =
      level >= 2
        ? [
            [u + half, shoulder],
            [u + half * 0.78, shoulder + (peak - shoulder) * 0.48],
            [u, peak],
            [u - half * 0.78, shoulder + (peak - shoulder) * 0.48],
            [u - half, shoulder],
          ]
        : [
            [u + half, shoulder],
            [u, peak],
            [u - half, shoulder],
          ];
    for (let i = 0; i < rim.length - 1; i++) {
      const points = [
        [u, shoulder - 0.015, offset],
        ...rim.slice(i, i + 2).map(([a, b]) => [a, b, offset]),
      ];
      out.addTriangle(
        slot,
        palette,
        points.map(locate),
        normal,
        [
          [0.5, 0],
          [0, 1],
          [1, 1],
        ],
        tint,
      );
    }
  };
  if (level >= 1) emit(width + 0.26, y - 0.13, spring, y + height + 0.17, 0.054, t.finish, 'trim');
  emit(width, y, spring, y + height, 0.071, baseTint, 'glass');
  if (level >= 2 && width > 0.67) {
    quad(
      out,
      'trim',
      [
        [u - 0.052, y, 0.085],
        [u + 0.052, y, 0.085],
        [u + 0.052, spring, 0.085],
        [u - 0.052, spring, 0.085],
      ].map(locate),
      normal,
      t.edge,
    );
  }
}

const cross = (out, x, y, z, height, width) => {
  const thickness = height * 0.058;
  box(
    out,
    'trim',
    x - thickness,
    x + thickness,
    y,
    y + height,
    z - thickness,
    z + thickness,
    t.metal,
  );
  box(
    out,
    'trim',
    x - width / 2,
    x + width / 2,
    y + height * 0.64,
    y + height * 0.73,
    z - thickness,
    z + thickness,
    t.metal,
  );
};

function aisleAndTransepts(out, level) {
  prism(out, 'stone', outline, d.foundationY, d.aisleEaves, t.sandstone);
  const center = d.facadeAxis;
  const wallFront = d.frontZ - 0.03;
  box(out, 'stone', -3.58, 4.96, d.aisleEaves - 0.12, d.naveEaves, -19.16, wallFront, t.sandstone);
  pitchedRoof(
    out,
    8.78,
    wallFront + 19.26,
    d.naveEaves,
    d.naveRidge,
    ([u, y, v], normal = false) =>
      normal ? [u, y, v] : [center + u, y, (wallFront - 19.26) / 2 + v],
    [t.clay, t.sandstone],
    level,
  );
  box(out, 'stone', -6.68, 8.0, d.aisleEaves - 0.12, 12.7, -24.0, -16.4, t.ochre);
  pitchedRoof(
    out,
    14.2,
    7.47,
    12.7,
    d.chancelRidge,
    ([u, y, v], normal = false) => (normal ? [u, y, v] : [center + u, y, v - 20.25]),
    [t.clay, t.sandstone],
    level,
  );
  box(out, 'stone', -11.5, 13.44, d.aisleEaves - 0.15, d.transeptEaves, -17.54, -7.58, t.sandstone);
  pitchedRoof(
    out,
    10.28,
    25.22,
    d.transeptEaves,
    d.transeptRidge,
    ([u, y, v], normal = false) => (normal ? [v, y, -u] : [0.97 + v, y, -12.56 - u]),
    [t.clay, t.sandstone],
    level,
  );
  for (const side of [-1, 1]) {
    const x = side > 0 ? 8.24 : -7.09;
    const naveSide = center + side * 4.27;
    const lowEdge = center + side * 7.78;
    quad(
      out,
      'roof',
      [
        [lowEdge, d.aisleEaves, -7.0],
        [lowEdge, d.aisleEaves, 24.16],
        [naveSide, 12.32, 24.16],
        [naveSide, 12.32, -7.0],
      ],
      [side * 0.55, 0.835, 0],
      t.clay,
    );
    const bays = level === 0 ? [-3.8, 6.7, 17.2] : [-4.2, 0.35, 4.9, 9.45, 14.0, 18.55];
    for (const z of bays) {
      const xWall = x + (side > 0 ? (z - 24.2) * 0.004 : 0);
      const locate = ([u, y, v]) => [xWall + side * v, y, z + u];
      lancet(out, locate, [side, 0, 0], 0, 5.26, 1.5, 2.93, level);
      const upper = ([u, y, v]) => [center + side * (4.29 + v), y, z + u];
      if (level >= 1) lancet(out, upper, [side, 0, 0], 0, 12.65, 1.39, 2.4, level, t.colored);
      const pierX = xWall + side * 0.22;
      const pierZ = z + 2.11;
      box(
        out,
        'stone',
        pierX - 0.62,
        pierX + 0.62,
        d.foundationY,
        7.7,
        pierZ - 0.32,
        pierZ + 0.32,
        t.ochre,
      );
      if (level >= 2)
        box(out, 'trim', pierX - 0.7, pierX + 0.7, 7.58, 7.82, pierZ - 0.43, pierZ + 0.43, t.edge);
    }
    const end = side > 0 ? 13.52 : -11.56;
    const locate = ([u, y, v]) => [end + side * v, y, -12.56 + u];
    for (const u of [-2.65, 0, 2.65])
      lancet(out, locate, [side, 0, 0], u, 7.95, 1.32, u === 0 ? 5.28 : 3.84, level);
    cross(out, end, d.transeptRidge, -12.56, 0.94, 0.41);
  }
  const rear = ([u, y, v]) => [center + u, y, -24.16 - v];
  for (const u of [-2.3, 0, 2.3])
    lancet(out, rear, [0, 0, -1], u, 7.1, 1.35, u === 0 ? 5.0 : 4.0, level);
}

function front(out, level) {
  const z = d.frontZ;
  const x = d.facadeAxis;
  box(
    out,
    'stone',
    x - 4.29,
    x + 4.29,
    d.foundationY,
    d.naveEaves,
    z - 1.25,
    z + 0.17,
    t.sandstone,
  );
  const f = ([u, y, v]) => [x + u, y, z + 0.18 + v];
  const a = [x - 4.3, d.naveEaves, z + 0.18];
  const b = [x + 4.3, d.naveEaves, z + 0.18];
  const apex = [x, d.naveRidge, z + 0.18];
  out.addTriangle(
    'stone',
    palette,
    [a, b, apex],
    [0, 0, 1],
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    t.sandstone,
  );
  for (const [i, height] of [
    [-1, 4.85],
    [0, 6.15],
    [1, 4.85],
  ])
    lancet(out, f, [0, 0, 1], i * 1.58, 6.86, 1.2, height, level);
  for (const i of [-1.5, -0.5, 0.5, 1.5])
    lancet(out, f, [0, 0, 1], i * 0.97, 14.41, 0.61, 2.22, level);
  lancet(out, f, [0, 0, 1], 0, 1.2, 2.1, 3.8, level, t.door);
  const rosY = 19.12;
  const segments = level >= 2 ? 22 : 10;
  for (let i = 0; i < segments; i++) {
    const a0 = (i * Math.PI * 2) / segments;
    const b0 = ((i + 1) * Math.PI * 2) / segments;
    const ringPoint = (r, angle, v) => f([Math.cos(angle) * r, rosY + Math.sin(angle) * r, v]);
    out.addTriangle(
      'glass',
      palette,
      [f([0, rosY, 0.071]), ringPoint(0.42, a0, 0.071), ringPoint(0.42, b0, 0.071)],
      [0, 0, 1],
      [
        [0.5, 0.5],
        [0, 0],
        [1, 0],
      ],
      t.glass,
    );
    if (level >= 1)
      quad(
        out,
        'trim',
        [
          ringPoint(0.42, a0, 0.063),
          ringPoint(0.55, a0, 0.063),
          ringPoint(0.55, b0, 0.063),
          ringPoint(0.42, b0, 0.063),
        ],
        [0, 0, 1],
        t.finish,
      );
  }
  cross(out, x, d.naveRidge, z, 1.54, 0.83);
  const steps = level >= 1 ? 5 : 2;
  for (let i = 0; i < steps; i++) {
    const p = i / steps;
    box(
      out,
      'stone',
      x - 2.84 + p * 0.33,
      x + 2.84 - p * 0.33,
      -0.62,
      (d.entryY * (i + 1)) / steps,
      z + 0.02,
      z + 2.72 - p * 2.26,
      t.plinth,
    );
  }
}

function towers(out, level) {
  for (const x of d.towerX) {
    const centerZ = d.frontZ - 2.23;
    const frontZ = centerZ + 2.57;
    const rearZ = centerZ - 2.52;
    const half = 1.86;
    box(out, 'stone', x - half, x + half, d.foundationY, d.towerCradle, rearZ, frontZ, t.sandstone);
    for (const y of level === 0 ? [15.1, 19.92] : [4.86, 10.8, 15.1, 18.85, 19.92]) {
      const bump = y > 18 ? 0.24 : 0.14;
      box(
        out,
        'trim',
        x - half - bump,
        x + half + bump,
        y,
        y + 0.24,
        rearZ - bump,
        frontZ + bump,
        t.edge,
      );
    }
    const towerFront = ([u, y, v]) => [x + u, y, frontZ + v];
    lancet(out, towerFront, [0, 0, 1], 0, 2.45, 0.61, 1.57, level);
    for (const off of [-0.69, 0.69]) {
      lancet(out, towerFront, [0, 0, 1], off, 11.62, 0.62, 2.63, level);
      lancet(out, towerFront, [0, 0, 1], off, 15.57, 0.72, 2.79, level);
    }
    if (level >= 1) {
      const side = Math.sign(x - d.facadeAxis);
      const wall = x + side * half;
      const towerSide = ([u, y, v]) => [wall + side * v, y, centerZ + u];
      for (const off of [-0.92, 0.92])
        lancet(out, towerSide, [side, 0, 0], off, 15.57, 0.71, 2.79, level);
    }
    profile(
      out,
      [
        [d.spireBase - 0.71, 1.55, 1.82],
        [d.spireBase, 1.55, 1.82, 'stone', t.ochre],
        [d.spireBase + 1.4, 1.36, 1.6, 'roof', t.spire],
        [d.spireEnd - 0.08, 0.065, 0.065, 'roof', t.spire],
        [d.spireEnd, 0.045, 0.045, 'trim', t.lead],
      ],
      8,
      [x, centerZ],
    );
    cross(out, x, d.spireEnd, centerZ, 1.28, 0.64);
    const sides = level >= 2 ? 8 : 5;
    for (const xx of [-1, 1])
      for (const zz of [-1, 1]) {
        const px = x + xx * 1.67;
        const pz = centerZ + zz * 2.27;
        profile(
          out,
          [
            [19.7, 0.32, 0.32],
            [21.14, 0.32, 0.32, 'stone', t.finish],
            [21.45, 0.23, 0.23, 'trim', t.edge],
            [23.45, 0.035, 0.035, 'trim', t.ochre],
          ],
          sides,
          [px, pz],
        );
      }
    if (level >= 1) {
      for (const u of [-1.23, 0, 1.23]) {
        for (const zv of [rearZ, frontZ])
          box(out, 'stone', x + u - 0.2, x + u + 0.2, 19.9, 20.63, zv - 0.17, zv + 0.17, t.ochre);
      }
    }
  }
}

function draw(out, level) {
  aisleAndTransepts(out, level);
  front(out, level);
  towers(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [58, 32, 86];
const lookAt = [0.7, 12.7, 1.5];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Sandstone Gothic Revival cathedral with paired needle spires, a tall three-lancet arrival, red roofs, projecting transepts and side buttresses.',
  camera,
  lookAt,
  sunDirection: [-70, 105, 128],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.7,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'cathedral-and-forecourt', position: [39, 28, 78], lookAt: [0.5, 12, 4.0] },
    { name: 'twin-spires-and-lancet-front', position: [-9, 12, 59], lookAt: [0.65, 16.1, 24.3] },
    { name: 'chancel-and-side-transept', position: [44, 22, -45], lookAt: [0.8, 10.8, -7.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.8, surfaces },
      street: { export: 'street', errorMeters: 0.3, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.08, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original model based on native mapped geometry, the exact public-domain Qualla façade photograph, published heritage facts and terrain.',
};
