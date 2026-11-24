import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const { parts } = read('native-map/san-francisco-lima-shape-controls');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  paving: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.84 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
};
const ochre = rgb('c5a465'),
  lime = rgb('d6bd86'),
  deepOchre = rgb('aa894d'),
  portalStone = rgb('b1a08b'),
  cream = rgb('dacfaa'),
  red = rgb('995e47'),
  dimRoof = rgb('9b836b'),
  plinth = rgb('9f9279'),
  cedar = rgb('664934'),
  dark = rgb('574d3b'),
  bronze = rgb('746247');
const p3 = ([x, z], y) => [x, y, z];
const rect = (l, r, b, f) => [
  [l, f],
  [r, f],
  [r, b],
  [l, b],
];
const front = 26.67;
function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function cap(out, slot, ring, holes, hue, color) {
  const capMesh = new MeshBufferBuilder();
  if (
    !capMesh.addCap(
      slot,
      'palette:#ffffff',
      ring,
      holes,
      () => hue,
      [0, 1, 0],
      (point) => point,
      color,
    )
  )
    throw new Error('Could not close the mapped monastery volume');
  const m = capMesh.finalize();
  const get = (i) => [...m.positions.subarray(i * 3, i * 3 + 3)];
  for (let i = 0; i < m.indices.length; i += 3)
    tri(out, slot, get(m.indices[i]), get(m.indices[i + 1]), get(m.indices[i + 2]), color);
}
function baseVolume(out, poly, y, color, hole) {
  const rings = hole ? [hole] : [];
  extrude(out, 'plaster', poly, -2.8, y, color, { holes: rings, top: false });
  cap(out, 'roof', poly, rings, y - 0.004, dimRoof);
}
function roof(out, x0, x1, z0, z1, y, peak, color) {
  const mid = (x0 + x1) / 2;
  const start = z1 - Math.min(4, (z1 - z0) * 0.25),
    end = z0 + Math.min(4, (z1 - z0) * 0.25);
  const a = [x0, y, z1],
    b = [x1, y, z1],
    c = [x1, y, z0],
    d = [x0, y, z0];
  const u = [mid, peak, start],
    v = [mid, peak, end];
  quad4(out, 'roof', b, c, v, u, color);
  quad4(out, 'roof', d, a, u, v, color);
  tri(out, 'roof', a, b, u, color);
  tri(out, 'roof', c, d, v, color);
}
function visor(
  out,
  F,
  u,
  y,
  w,
  h,
  level,
  { head = 'round', panel = dark, stone = cream, depth = 0.052 } = {},
) {
  if (level <= 1) {
    quad4(
      out,
      'shadow',
      F.P(u - w / 2, y, depth),
      F.P(u + w / 2, y, depth),
      F.P(u + w / 2, y + h * 0.73, depth),
      F.P(u - w / 2, y + h * 0.73, depth),
      panel,
    );
    tri(
      out,
      'shadow',
      F.P(u - w / 2, y + h * 0.73, depth),
      F.P(u + w / 2, y + h * 0.73, depth),
      F.P(u, y + h, depth),
      panel,
    );
  } else
    opening(out, F, u, y, w, h, {
      head,
      glassSlot: 'shadow',
      frameSlot: 'trim',
      glass: panel,
      frame: stone,
      frameWidth: 0.15,
      frameDepth: 0.12,
      d: depth,
      sill: false,
    });
}
function latheDome(
  out,
  x,
  z,
  base,
  r,
  height,
  level,
  { wall = ochre, color = red, xScale = 1 } = {},
) {
  const n = [7, 10, 16, 24][level];
  const slab = (y, s) => [base + y * height, r * s * xScale, r * s];
  lathe(out, 'plaster', [x, z], [slab(-0.34, 0.96), slab(-0.06, 1), slab(0, 1)], n, wall, {
    capTop: false,
  });
  const profile =
    level === 0
      ? [slab(0, 1), slab(0.63, 0.73), slab(1, 0.12)]
      : [
          slab(0, 1),
          slab(0.26, 0.94),
          slab(0.56, 0.79),
          slab(0.78, 0.55),
          slab(0.92, 0.34),
          slab(1, 0.16),
        ];
  lathe(out, 'roof', [x, z], profile, n, color, { capTop: false });
}
function cross(out, x, z, y, level) {
  const scale = level === 0 ? 0.095 : 0.07;
  box(out, 'bronze', x - scale, x + scale, z - scale, z + scale, y, y + 1.5, bronze);
  box(out, 'bronze', x - 0.51, x + 0.51, z - scale, z + scale, y + 0.94, y + 1.095, bronze);
}
function lantern(out, x, z, start, r, level) {
  const n = [6, 8, 10, 12][level];
  lathe(
    out,
    'plaster',
    [x, z],
    [
      [start, r * 0.76, r * 0.76],
      [start + 0.31, r, r],
      [start + 1.34, r, r],
      [start + 1.5, r * 1.12, r * 1.12],
    ],
    n,
    lime,
  );
  lathe(
    out,
    'roof',
    [x, z],
    [
      [start + 1.49, r * 1.15, r * 1.15],
      [start + 1.97, r * 0.74, r * 0.74],
      [start + 2.3, r * 0.09, r * 0.09],
    ],
    n,
    red,
  );
  if (level >= 2)
    for (const [dx, dz] of [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ]) {
      visor(
        out,
        facade([x + dx * r * 0.99, z + dz * r * 0.99], [dz, -dx]),
        0,
        start + 0.55,
        r * 0.52,
        0.76,
        1,
        { depth: 0.04 },
      );
    }
  cross(out, x, z, start + 2.28, level);
}
function squareBand(out, x, z, r, y, h, depth, color, slot = 'trim') {
  box(out, slot, x - r - depth, x + r + depth, z - r - depth, z + r + depth, y, y + h, color);
}
function belfryDome(out, x, z, level) {
  const n = level === 0 ? 6 : level === 3 ? 12 : 8;
  lathe(
    out,
    'plaster',
    [x, z],
    [
      [26.52, 3.44, 3.44],
      [28.87, 3.44, 3.44],
      [29.45, 3.57, 3.57],
    ],
    n,
    lime,
    { capTop: false },
  );
  latheDome(out, x, z, 29.53, 3.36, 3.81, level, { wall: lime, color: dimRoof });
  if (level >= 1) {
    const domeFace = facade([x, z + 3.49], [1, 0]);
    visor(out, domeFace, 0, 27.27, 1.2, 1.57, level, { panel: dark, depth: 0.042 });
  }
  lantern(out, x, z, 33.16, 1.08, level);
}
function bellTower(out, x, z, level) {
  const r = 4.18;
  if (level === 0) {
    squareBand(out, x, z, r, -1.4, 15.42, 0.01, ochre, 'plaster');
    squareBand(out, x, z, r - 0.21, 14.0, 11.86, 0, ochre, 'plaster');
    squareBand(out, x, z, r, 13.94, 0.51, 0.57, cream);
    squareBand(out, x, z, r - 0.12, 25.87, 0.78, 0.52, cream);
    const F = facade([x, z + r - 0.205], [1, 0]);
    visor(out, F, 0, 16.44, 3.07, 6.82, level, { panel: dark });
    belfryDome(out, x, z, level);
    return;
  }
  squareBand(out, x, z, r, -1.4, 14.9, 0, ochre, 'plaster');
  squareBand(out, x, z, r, 0.11, 0.82, 0.13, plinth, 'paving');
  squareBand(out, x, z, r, 13.02, 0.55, 0.27, cream);
  squareBand(out, x, z, r, 13.57, 0.68, 0.49, lime);
  squareBand(out, x, z, r, 14.21, 0.53, 0.73, cream);
  const ring = rect(x - r + 0.21, x + r - 0.21, z - r + 0.21, z + r - 0.21);
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const w = F.length,
      c = w * 0.5,
      a = c - 1.54,
      b = c + 1.54;
    fbox(out, 'plaster', F, 0, a + 0.012, 14.71, 25.64, -0.7, 0, ochre);
    fbox(out, 'plaster', F, b - 0.012, w, 14.71, 25.64, -0.7, 0, ochre);
    fbox(out, 'plaster', F, a, b, 14.71, 16.38, -0.67, 0, ochre);
    const arch = roundArch(1.54, level === 0 ? 5 : level === 3 ? 10 : 8).map(([p, y]) => [
      c + p,
      21.73 + y,
    ]);
    for (let k = 0; k < arch.length - 1; k++) {
      const [sx, sy] = arch[k],
        [tx, ty] = arch[k + 1];
      quad4(out, 'plaster', F.P(sx, sy), F.P(tx, ty), F.P(tx, 25.64), F.P(sx, 25.64), ochre);
      quad4(
        out,
        'paving',
        F.P(tx, ty),
        F.P(sx, sy),
        F.P(sx, sy, -0.64),
        F.P(tx, ty, -0.64),
        plinth,
      );
    }
    if (level > 0) {
      for (const pos of [0.42, 1.17, w - 1.17, w - 0.42])
        fbox(out, 'trim', F, pos - 0.16, pos + 0.16, 14.73, 24.95, -0.09, 0.14, lime);
      if (i === 0 || level === 3) {
        for (let k = 0; k < (level === 1 ? 4 : 9); k++) {
          const ty = 15 + k * (level === 1 ? 2.59 : 1.22);
          for (const [l, r] of [
            [0, a],
            [b, w],
          ])
            fbox(out, 'trim', F, l, r, ty, ty + 0.105, 0.006, 0.19, k % 3 ? lime : portalStone);
        }
        for (let k = 0; k < arch.length - 1; k++) {
          const [ax, ay] = arch[k],
            [bx, by] = arch[k + 1];
          quad4(
            out,
            'trim',
            F.P(ax, ay, 0.069),
            F.P(bx, by, 0.069),
            F.P(bx + (bx - c) * 0.16, by + 0.23, 0.07),
            F.P(ax + (ax - c) * 0.16, ay + 0.23, 0.07),
            cream,
          );
        }
      }
    }
  }
  lathe(
    out,
    'bronze',
    [x, z],
    [
      [17.23, 0.065, 0.065],
      [17.26, 0.89, 0.89],
      [17.72, 0.83, 0.83],
      [19.14, 0.47, 0.47],
      [19.34, 0.23, 0.23],
    ],
    level === 0 ? 6 : 10,
    bronze,
  );
  squareBand(out, x, z, r - 0.12, 25.53, 0.55, 0.49, lime);
  squareBand(out, x, z, r - 0.12, 26.04, 0.7, 0.65, cream);
  if (level >= 2) {
    for (const xx of [-4.08, 4.08])
      for (const zz of [-4.08, 4.08]) {
        lathe(
          out,
          'trim',
          [x + xx, z + zz],
          [
            [26.72, 0.37, 0.37],
            [27.33, 0.32, 0.32],
            [28, 0.04, 0.04],
          ],
          6,
          cream,
        );
      }
  }
  belfryDome(out, x, z, level);
  const F = facade([x, z + r], [1, 0]);
  if (level >= 1) {
    const n = level === 1 ? 6 : 11;
    for (let k = 0; k < n; k++) {
      const y = 0.69 + (12.2 * k) / (n - 1);
      fbox(out, 'trim', F, -r, r, y, y + 0.13, -0.063, 0.12, lime);
    }
    visor(out, F, 0, 3.2, 0.69, 1.02, level, { panel: dark, depth: 0.153 });
    visor(out, F, 0, 7.63, 0.69, 1.02, level, { panel: dark, depth: 0.153 });
  }
}
function portal(out, level) {
  const x = 12.18;
  const F = facade([x, front + 0.04], [1, 0]);
  fbox(out, 'plaster', F, -5.23, 5.23, -1.04, 14.86, -1.18, 0.053, ochre);
  visor(out, F, 0, 0.45, 4.32, 6.13, level, { panel: cedar, stone: portalStone, depth: 0.14 });
  for (const u of [-3.77, -3.14, 3.14, 3.77]) {
    fbox(out, 'trim', F, u - 0.32, u + 0.32, 0.44, 1.02, 0.03, 0.53, plinth);
    fbox(out, 'trim', F, u - 0.21, u + 0.21, 0.98, 6.57, 0.09, 0.51, portalStone);
    fbox(out, 'trim', F, u - 0.33, u + 0.33, 6.47, 7.01, 0.08, 0.67, cream);
  }
  fbox(out, 'trim', F, -4.22, 4.22, 6.98, 7.31, 0.08, 0.67, portalStone);
  fbox(out, 'trim', F, -3.35, 3.35, 10.89, 11.23, 0.08, 0.47, portalStone);
  for (const [u, y, w, h] of [
    [0, 7.46, 1.86, 2.5],
    [-2.41, 7.65, 0.7, 1.66],
    [2.41, 7.65, 0.7, 1.66],
    [0, 11.56, 1.65, 2.42],
  ])
    visor(out, F, u, y, w, h, level, { panel: dark, stone: portalStone, depth: 0.135 });
  const crest = roundArch(4.24, level === 0 ? 7 : 14);
  for (let i = 0; i < crest.length - 1; i++) {
    const [ax, ay] = crest[i],
      [bx, by] = crest[i + 1];
    const y = (value) => 13.76 + value * 0.61;
    quad4(
      out,
      'trim',
      F.P(ax * 0.97, y(ay) - 0.15, 0.42),
      F.P(bx * 0.97, y(by) - 0.15, 0.42),
      F.P(bx, y(by) + 0.145, 0.43),
      F.P(ax, y(ay) + 0.145, 0.43),
      portalStone,
    );
  }
  if (level >= 2) {
    for (const u of [-3.2, -1.73, 1.73, 3.2]) {
      fbox(out, 'trim', F, u - 0.14, u + 0.14, 7.57, 10.72, 0.16, 0.41, cream);
      fbox(out, 'trim', F, u - 0.31, u + 0.31, 7.56, 7.83, 0.14, 0.47, cream);
    }
    for (let n = 0; n < 10; n++) {
      const z = (n - 4.5) * 0.41;
      fbox(out, 'wood', F, z - 0.023, z + 0.023, 0.48, 4.55, 0.147, 0.184, cedar);
    }
  }
  cross(out, x, front - 0.15, 16.18, level);
}
function courtArcades(out, level) {
  const ring = outwardRing(parts.principalCloister).reverse();
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const w = F.length,
      n = level === 0 ? 4 : 8;
    fbox(out, 'trim', F, 0, w, 3.83, 4.12, 0.024, 0.18, cream);
    fbox(out, 'trim', F, 0, w, 7.55, 7.89, 0.024, 0.22, cream);
    for (let j = 0; j < n; j++)
      for (const [y, h] of [
        [0.29, 3.24],
        [4.24, 2.88],
      ]) {
        const u = ((j + 0.5) * w) / n;
        visor(out, F, u, y, level === 0 ? 4.43 : 2.88, h, level, {
          panel: dark,
          stone: cream,
          depth: 0.054,
        });
        if (level >= 2)
          fbox(out, 'trim', F, u + 1.63, u + 1.92, y, y + h * 0.69, 0.047, 0.21, cream);
      }
  }
  if (level >= 2)
    lathe(
      out,
      'paving',
      [-26.58, -5.66],
      [
        [0.05, 2.12, 2.12],
        [0.31, 2.1, 2.1],
        [0.37, 0.55, 0.55],
        [1.25, 0.41, 0.41],
        [1.39, 1.06, 1.06],
        [1.68, 0.94, 0.94],
        [1.76, 0.2, 0.2],
      ],
      level === 3 ? 18 : 12,
      plinth,
    );
}
function chapel(out, level) {
  baseVolume(out, parts.milagroChapel, 7.05, ochre);
  roof(out, 28.74, 37.86, -54.14, -28.42, 7.03, 9.18, red);
  const F = facade([33.43, -27.99], [1, 0]);
  visor(out, F, 0, 0.55, 2.22, 3.81, level, { panel: cedar, stone: cream });
  fbox(out, 'trim', F, -3.65, 3.65, 5.35, 5.58, 0.021, 0.28, cream);
  latheDome(out, 34.24, -47.56, 9.12, 2.62, 2.31, level, { wall: lime, color: dimRoof });
}
function build(out, level) {
  baseVolume(out, parts.convent, 8, lime, parts.principalCloister);
  baseVolume(out, parts.mainChurch, 12.44, ochre);
  roof(out, -2.81, 26.72, -27.32, 19.88, 12.32, 15.88, dimRoof);
  roof(out, 5.35, 20.51, -53.65, -27.03, 12.32, 16.01, dimRoof);
  roof(out, -9.95, 28.18, -39.0, -28.11, 12.37, 14.95, red);
  latheDome(out, 12.45, -29.82, 15.36, 6.62, 6.45, level, { wall: lime, color: dimRoof });
  lantern(out, 12.45, -29.82, 21.59, 1.18, level);
  bellTower(out, 2.61, 22.61, level);
  bellTower(out, 22.11, 22.61, level);
  portal(out, level);
  chapel(out, level);
  if (level === 0) return;
  courtArcades(out, level);
  const side = facade([26, 14.4], [0, -1]);
  for (const z of [1.5, 10.29, 19.18, 28.04, 36.86]) {
    fbox(out, 'plaster', side, z - 0.56, z + 0.56, 0.14, 12.32, 0.35, 1.24, deepOchre);
    if (level >= 2)
      visor(out, side, z + 2.36, 7.15, 1.52, 2.68, level, { panel: dark, depth: 0.56 });
  }
  for (const x of [-50, -43, -36, -29, -22, -15, -8]) {
    const F = facade([x, 27.2], [1, 0]);
    visor(out, F, 0, 4.75, 1.45, 2.25, level, { panel: cedar, depth: 0.054 });
    if (level >= 2) visor(out, F, 0, 1.22, 1.57, 2.09, level, { panel: cedar, depth: 0.062 });
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'basilica-and-convent-of-san-francisco-lima-model.mjs';
const camera = [58, 44, 104],
  lookAt = [-12, 13, -7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Lima’s Basilica of San Francisco and convent, with twin Baroque bells towers, ochre walls, nave cupola and an open two-tiered cloister.',
  camera,
  lookAt,
  sunDirection: [37, 64, 55],
  mediumFiContext: {
    scale: 1.19,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.84,
    basis:
      'The union of the mapped basilica, monastery and adjoining chapel has an open courtyard.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'san-francisco-plazuela', position: camera, lookAt },
    { name: 'baroque-portal-and-bell-openings', position: [16, 16, 64], lookAt: [12, 17, 25] },
    { name: 'principal-cloister-and-nave-dome', position: [-65, 55, -21], lookAt: [-14, 9, -8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'san-francisco-lima-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.088, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces },
    },
  },
};
