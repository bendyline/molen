import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { sanctuary, frontage, porch } = plan.dimensions;
const wood = rgb('47342c');
const plank = rgb('755343');
const fascia = rgb('342c28');
const tiled = rgb('454a4a');
const plaster = rgb('d2c9b2');
const stone = rgb('8d8b7f');
const dark = rgb('24241d');
const gilt = rgb('bfa057');
const cloth = rgb('d9d0b1');
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  tiles: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  carpentry: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  screens: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
  doorway: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const block = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
const east = (x, z = 0) => facade([x, z], [0, -1]);

// Each constant-Z ribbon runs west to east across the tiled roof and closes its front verge.
function runRoof(out, west, front, zs, profile, backLift = 0) {
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i],
      z1 = zs[i + 1],
      y0 = profile[i],
      y1 = profile[i + 1];
    quad4(
      out,
      'tiles',
      [west, y0 + backLift, z0],
      [west, y1 + backLift, z1],
      [front, y1, z1],
      [front, y0, z0],
      tiled,
    );
    quad4(
      out,
      'carpentry',
      [west, y1 + backLift - 0.11, z1],
      [west, y0 + backLift - 0.11, z0],
      [front, y0 - 0.11, z0],
      [front, y1 - 0.11, z1],
      fascia,
    );
    quad4(
      out,
      'carpentry',
      [front, y1 - 0.14, z1],
      [front, y0 - 0.14, z0],
      [front, y0, z0],
      [front, y1, z1],
      fascia,
    );
    quad4(
      out,
      'carpentry',
      [west, y0 + backLift - 0.14, z0],
      [west, y1 + backLift - 0.14, z1],
      [west, y1 + backLift, z1],
      [west, y0 + backLift, z0],
      fascia,
    );
  }
}
function highSanctuary(out, lod) {
  const s = sanctuary;
  block(
    out,
    'carpentry',
    s.rear,
    s.front,
    s.center - s.halfWidth,
    s.center + s.halfWidth,
    0.7,
    s.eave,
    wood,
  );
  const roof = [
    [-1, 0.08],
    [-0.75, 0.35],
    [-0.5, 0.78],
    [-0.25, 1.45],
    [0, 2.54],
    [0.25, 1.45],
    [0.5, 0.78],
    [0.75, 0.35],
    [1, 0.08],
  ];
  const knots = lod === 0 ? roof.filter((_, i) => i % 2 === 0) : roof;
  const zs = knots.map(([t]) => s.center + t * (s.halfWidth + 0.44));
  const ys = knots.map(([, y]) => s.eave + y);
  runRoof(out, s.rear - 0.35, s.front + 0.74, zs, ys);
  for (let i = 0; i < zs.length - 1; i++) {
    const F = east(s.front, 0);
    const a = Math.min(s.center + s.halfWidth, zs[i + 1]);
    const b = Math.max(s.center - s.halfWidth, zs[i]);
    // Clip the outer sloped gable to the actual width of the timber walls.
    const y = (z) => ys[i] + ((ys[i + 1] - ys[i]) * (z - zs[i])) / (zs[i + 1] - zs[i]) - 0.09;
    quad4(out, 'carpentry', F.P(-a, s.eave), F.P(-b, s.eave), F.P(-b, y(b)), F.P(-a, y(a)), wood);
    quad4(
      out,
      'carpentry',
      [s.rear, s.eave, b],
      [s.rear, s.eave, a],
      [s.rear, y(a), a],
      [s.rear, y(b), b],
      wood,
    );
  }
  block(
    out,
    'tiles',
    s.rear - 0.48,
    s.front + 0.86,
    s.center - 0.12,
    s.center + 0.12,
    s.ridge - 0.12,
    s.ridge + 0.12,
    fascia,
  );
  if (lod > 0) {
    const F = east(s.front + 0.019, s.center);
    const count = lod > 1 ? 12 : 7;
    for (let i = -count; i <= count; i++) {
      const u = (i * 1.9) / count;
      const top = s.eave + 2.31 * Math.pow(1 - Math.abs(u) / 2.95, 1.55);
      fbox(out, 'carpentry', F, u - 0.034, u + 0.034, s.eave + 0.1, top, 0, 0.12, plank);
    }
    for (const x of [-8.32, -7.05, -5.72, -4.4, -3.08, -1.75, -0.43]) {
      for (const edge of [-1, 1]) {
        const F = facade([x, s.center + edge * s.halfWidth], [edge, 0]);
        fbox(out, 'carpentry', F, -0.085, 0.085, 0.69, 4.68, 0, 0.16, plank);
        if (lod > 1) fbox(out, 'carpentry', F, -0.12, 0.12, 4.37, 4.58, 0.04, 0.53, fascia);
      }
    }
  }
}
function glazedBay(out, F, u, w, lod) {
  opening(out, F, u, 1.5, w, 1.3, {
    glassSlot: 'screens',
    frameSlot: 'carpentry',
    glass: dark,
    frame: plank,
    sill: lod > 1,
    d: 0.045,
    frameWidth: lod > 0 ? 0.08 : 0,
    mullions: lod > 1 ? 3 : 0,
    transoms: lod > 1 ? 1 : 0,
  });
  if (lod > 1)
    fbox(out, 'carpentry', F, u - w * 0.46, u + w * 0.46, 2.57, 2.78, 0.055, 0.126, rgb('76603d'));
}
function lowWings(out, lod) {
  const w = frontage;
  const wingZ = [
    [w.north, porch.center - 1.77],
    [porch.center + 1.85, w.south],
  ];
  for (const [a, b] of wingZ) {
    block(out, 'wall', w.rear, w.front, a, b, 0.58, w.eave, plaster);
    const F = east(w.front);
    for (const y of [0.69, 1.39, 2.89, 3.13])
      fbox(out, 'carpentry', F, -b, -a, y, y + 0.13, -0.08, 0.13, wood);
    const count = Math.round((b - a) / 1.26);
    const width = (b - a) / count;
    for (let i = 0; i < count; i++) {
      const z = a + width * (i + 0.5);
      glazedBay(out, F, -z, width - 0.15, lod);
      if (lod > 0)
        fbox(
          out,
          'carpentry',
          F,
          -z - width / 2 - 0.07,
          -z - width / 2 + 0.07,
          0.6,
          3.19,
          -0.07,
          0.16,
          wood,
        );
    }
    const zz = b + 0.24,
      za = a - 0.22;
    quad4(
      out,
      'tiles',
      [w.front + 0.5, w.eave, za],
      [w.rear - 0.23, w.ridge, za],
      [w.rear - 0.23, w.ridge, zz],
      [w.front + 0.5, w.eave, zz],
      tiled,
    );
    quad4(
      out,
      'carpentry',
      [w.front + 0.5, w.eave - 0.14, zz],
      [w.front + 0.5, w.eave - 0.14, za],
      [w.front + 0.5, w.eave, za],
      [w.front + 0.5, w.eave, zz],
      fascia,
    );
    quad4(
      out,
      'carpentry',
      [w.front + 0.5, w.eave, zz],
      [w.rear - 0.23, w.ridge, zz],
      [w.rear - 0.23, w.ridge, za],
      [w.front + 0.5, w.eave, za],
      fascia,
    );
    if (lod > 1)
      for (let i = 0; i < count * 3; i++) {
        const z = a + ((i + 0.5) * (b - a)) / (count * 3);
        block(out, 'carpentry', w.front, w.front + 0.47, z - 0.035, z + 0.035, 3.1, 3.21, plank);
      }
  }
}
function mainPorch(out, lod) {
  const p = porch;
  const z = p.center,
    w = p.halfWidth;
  const start = p.outer + 0.43;
  const F = east(start, z);
  const roof = [
    [-2.14, 4.11],
    [-1.92, 4.02],
    [-1.64, 3.98],
    [-1.42, 4.03],
    [-1.19, 4.16],
    [-0.98, 4.45],
    [-0.76, 4.77],
    [-0.5, 4.95],
    [-0.24, 5.04],
    [0, 5.06],
    [0.24, 5.04],
    [0.5, 4.95],
    [0.76, 4.77],
    [0.98, 4.45],
    [1.19, 4.16],
    [1.42, 4.03],
    [1.64, 3.98],
    [1.92, 4.02],
    [2.14, 4.11],
  ];
  const knots = lod === 0 ? roof.filter((_, i) => i % 2 === 0 || i === 9) : roof;
  const zs = knots.map(([u]) => z + u),
    ys = knots.map(([, y]) => y);
  runRoof(out, 0.07, start, zs, ys, 0.23);
  for (let i = 0; i < zs.length - 1; i++) {
    const [a, b] = [-knots[i + 1][0], -knots[i][0]];
    const [ya, yb] = [ys[i + 1], ys[i]];
    const lower = (v) => Math.max(3.63, v - 0.49);
    quad4(out, 'carpentry', F.P(a, lower(ya)), F.P(b, lower(yb)), F.P(b, yb), F.P(a, ya), wood);
    if (lod > 1)
      for (const y of [0.09, 0.16, 0.25])
        beam(out, 'carpentry', F.P(a, ya - y, 0.018), F.P(b, yb - y, 0.018), 0.028, 0.031, fascia);
  }
  fbox(out, 'carpentry', F, -0.35, 0.35, 4.56, 4.68, 0.01, 0.045, gilt);
  block(out, 'tiles', start - 0.43, start + 0.012, z - 0.37, z + 0.37, 4.99, 5.17, fascia);
  block(out, 'tiles', start - 0.34, start - 0.12, z - 0.23, z + 0.23, 5.16, p.crown, fascia);
  const inner = east(3.43, z);
  fbox(out, 'doorway', inner, -1.15, 1.15, p.plinth, 3.78, -0.04, 0.04, dark);
  fbox(out, 'carpentry', inner, -1.17, 1.17, p.plinth, 1.4, 0.04, 0.12, plank);
  fbox(out, 'carpentry', inner, -1.46, 1.46, 3.37, 3.65, -0.09, 0.55, wood);
  for (const side of [-1, 1]) {
    const col = z + side * 1.24;
    block(out, 'foundation', 3.54, 4.57, col - 0.24, col + 0.24, 0.46, p.plinth, stone);
    block(out, 'carpentry', 4.14, 4.53, col - 0.17, col + 0.17, p.plinth, 3.94, wood);
    if (lod > 0) {
      block(out, 'carpentry', 4.07, 4.6, col - 0.32, col + 0.32, 3.51, 3.77, plank);
      block(out, 'carpentry', 4.0, 4.69, col - 0.49, col + 0.49, 3.77, 3.91, wood);
    }
  }
  block(out, 'foundation', 3.32, 4.65, z - w, z + w, -0.11, p.plinth, stone);
  for (let i = 0; i < 3; i++)
    block(out, 'foundation', 4.58, 5.49 - i * 0.27, z - w, z + w, -0.14, 0.15 * (i + 1), stone);
  if (lod > 0) {
    for (let i = 0; i < 12; i++) {
      const u = -1.07 + i * 0.195;
      fbox(out, 'carpentry', inner, u, u + 0.035, 0.671, 1.39, 0.124, 0.153, wood);
    }
    for (let i = 0; i < 4; i++) {
      const u = -0.99 + i * 0.5;
      fbox(
        out,
        'carpentry',
        east(4.59, z),
        u,
        u + 0.45,
        2.61 + (i % 2) * 0.04,
        3.15,
        0.002,
        0.029,
        cloth,
      );
    }
  }
  if (lod > 1) {
    for (const side of [-1, 1]) {
      const c = [4.43, z + side * 1.27];
      const ring = (y, r) => radialRing(y, r, r, lod === 3 ? 12 : 8, c);
      loft(
        out,
        'carpentry',
        [ring(2.44, 0.08), ring(2.53, 0.16), ring(2.8, 0.18), ring(3.03, 0.07)],
        cloth,
        { cap: false },
      );
      const rope = side * 0.79;
      beam(
        out,
        'carpentry',
        east(4.49, z).P(rope, 3.49),
        east(4.49, z).P(rope, 0.99, 0.05),
        0.047,
        0.042,
        gilt,
      );
    }
  }
  if (lod === 3) {
    // Traditional shrine emblem, drawn as geometry rather than reproducing modern signage.
    const endpoints = Array.from({ length: 5 }, (_, i) => {
      const a = Math.PI / 2 + (i * 4 * Math.PI) / 5;
      return F.P(Math.cos(a) * 0.09, 5.176 + Math.sin(a) * 0.09, 0.023);
    });
    for (let i = 0; i < 5; i++)
      beam(out, 'carpentry', endpoints[i], endpoints[(i + 1) % 5], 0.018, 0.016, gilt);
  }
}

function build(out, lod) {
  extrude(out, 'foundation', frame.geometry.outline, -1.27, 0.62, stone, { top: false });
  highSanctuary(out, lod);
  lowWings(out, lod);
  mainPorch(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'seimei-shrine-model.mjs';
const camera = [27, 12, 16];
const lookAt = [-1.2, 2.7, 0.53];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious-building',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Seimei Shrine’s main sanctuary in Kyoto, with its raised timber interior, undulating karahafu canopy, stone entrance steps and narrow lower wings.',
  camera,
  lookAt,
  sunDirection: [16, 22, -9],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Only the mapped sanctuary and connected worship frontage.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'approach-and-curved-canopy', position: camera, lookAt },
    { name: 'main-roof-and-north-wing', position: [-17, 15, -18], lookAt: [-1.8, 2.5, 0.6] },
    { name: 'steps-and-timber-verge', position: [16, 4.2, -6.1], lookAt: [3.5, 2.7, 0.29] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'seimei-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
