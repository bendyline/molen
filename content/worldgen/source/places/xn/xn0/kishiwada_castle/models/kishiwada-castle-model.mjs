import fs from 'node:fs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { features } = JSON.parse(
  fs.readFileSync(new URL('../native-map/kishiwada-site-controls.json', import.meta.url)),
);
const outline = frame.geometry.outline;
const points = new Map(features.map(({ id, localPoints }) => [id, localPoints]));
const { foundation, outerWallFoot, outerWallTop, parapetHeight, keepPlinth, mainEave, mainRidge } =
  plan.dimensions;
const white = rgb('dedbd0');
const chalk = rgb('d1cec2');
const stone = rgb('8f887c');
const ground = rgb('b1a994');
const tile = rgb('545a62');
const roofEdge = rgb('666a6d');
const wood = rgb('57524a');
const glass = rgb('4d514f');
const gold = rgb('b4a17d');
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  yard: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
};

function box(out, surface, x, z, w, d, bottom, top, color) {
  abox(out, surface, [x - w / 2, bottom, z - d / 2], [x + w / 2, top, z + d / 2], color, {
    bottom: false,
  });
}

function cap(out, surface, ring, y, color) {
  const indices = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, surface, p(indices[i]), p(indices[i + 2]), p(indices[i + 1]), color);
}

const eastFoot = points.get('573379016');
const southFoot = points.get('573506880');
const moat = points.get('242226323');
const foot = outwardRing([...eastFoot.slice(1), ...southFoot, ...moat.slice(21, 26).reverse()]);
const shortFoot = outwardRing([
  eastFoot[4],
  eastFoot[5],
  eastFoot[7],
  eastFoot[9],
  eastFoot[11],
  southFoot[0],
  southFoot[2],
  southFoot[4],
  southFoot[5],
  southFoot[7],
  southFoot[10],
  southFoot[12],
  southFoot[15],
  moat[25],
  moat[23],
  moat[21],
]);

function inset(ring, distance) {
  return ring.map((p, i) => {
    const before = wallFace(ring[(i + ring.length - 1) % ring.length], p).normal;
    const after = wallFace(p, ring[(i + 1) % ring.length]).normal;
    const miter = Math.max(0.63, 1 + before[0] * after[0] + before[1] * after[1]);
    return [
      p[0] - (distance * (before[0] + after[0])) / miter,
      p[1] - (distance * (before[1] + after[1])) / miter,
    ];
  });
}

function bastion(out, outline, base, top, setback, lod, paved = true) {
  const topRing = inset(outline, setback);
  const tiers =
    lod < 2
      ? [
          [outline, base],
          [topRing, top],
        ]
      : [
          [outline, base],
          [inset(outline, setback * 0.39), base + (top - base) * 0.27],
          [inset(outline, setback * 0.73), base + (top - base) * 0.61],
          [topRing, top],
        ];
  loft(
    out,
    'stone',
    tiers.map(([ring, y]) => ring.map(([x, z]) => [x, y, z])),
    stone,
    { cap: false },
  );
  cap(out, paved ? 'yard' : 'stone', topRing, top, paved ? ground : stone);
}

function curtain(out, path, lod) {
  for (let i = 1; i < path.length; i++) {
    const f = wallFace(path[i - 1], path[i]);
    const l = f.length;
    if (l < 0.56) continue;
    fbox(out, 'wall', f, -0.11, l + 0.11, outerWallTop - 0.72, parapetHeight, -0.28, 0.35, white);
    const y = parapetHeight + 0.04;
    fbox(out, 'tile', f, -0.16, l + 0.16, y - 0.13, y + 0.09, -0.4, 0.47, tile);
    if (lod < 2 || l < 3) continue;
    const n = Math.round(l / 3.3);
    for (let j = 0; j < n; j++) {
      const u = (l * (j + 0.5)) / n;
      for (const normal of [-1, 1]) {
        const d = normal < 0 ? -0.284 : 0.356;
        const a = f.P(u - 0.072, 0.81, d);
        const b = f.P(u + 0.072, 0.81, d);
        const c = f.P(u, 1.16, d);
        tri(out, 'glass', ...(normal < 0 ? [b, a, c] : [a, b, c]), glass);
      }
    }
  }
}

function perimeter(out, lod) {
  bastion(out, lod === 0 ? shortFoot : foot, outerWallFoot, outerWallTop, 1.85, lod);
  const upper = points.get('573379015');
  const rear = points.get('573506889');
  if (lod === 0) {
    curtain(out, [upper[0], upper[1], upper[2], upper[10], upper[12], upper[15], upper[17]], lod);
    curtain(out, [rear[0], rear[1], rear[4], rear[5], rear[6]], lod);
    return;
  }
  curtain(out, upper, lod);
  curtain(out, rear, lod);
}

function roofRing(x, z, y, w, d, lift) {
  return [
    [x - w / 2, y + lift, z - d / 2],
    [x - w / 2, y, z],
    [x - w / 2, y + lift, z + d / 2],
    [x, y, z + d / 2],
    [x + w / 2, y + lift, z + d / 2],
    [x + w / 2, y, z],
    [x + w / 2, y + lift, z - d / 2],
    [x, y, z - d / 2],
  ];
}

function sweptRoof(out, x, z, base, w, d, rise, lod, upper = false) {
  const shoulder = base + rise * 0.54;
  const levels = [
    roofRing(x, z, base, w, d, 0.24),
    roofRing(x, z, base + rise * 0.17, w * 0.94, d * 0.83, 0.12),
    roofRing(x, z, shoulder, w * 0.73, d * 0.48, 0.045),
  ];
  loft(out, 'tile', lod === 0 ? [levels[0], levels[2]] : levels, tile, { cap: false });
  gableRoof(
    out,
    'tile',
    [x - w * 0.365, z],
    [x + w * 0.365, z],
    d * 0.48,
    shoulder,
    base + rise,
    tile,
    { overhang: 0.08, endSlot: 'wall', endColor: chalk },
  );
  box(out, 'tile', x, z, w * 0.77, 0.22, base + rise - 0.08, base + rise + 0.1, roofEdge);
  if (lod === 0) return;
  loft(
    out,
    'wood',
    [
      roofRing(x, z, base - 0.18, w * 0.986, d * 0.986, 0.21),
      roofRing(x, z, base + 0.014, w * 0.988, d * 0.988, 0.222),
    ],
    chalk,
    { cap: false },
  );
  if (lod < 2) return;
  const count = Math.floor(w / (lod === 3 ? 0.52 : 1.05));
  for (let i = 1; i < count; i++) {
    const u = (i / count - 0.5) * w;
    for (const s of [-1, 1]) {
      box(out, 'wood', x + u, z + s * d * 0.485, 0.095, 0.23, base - 0.2, base - 0.035, chalk);
      if (upper && lod === 3)
        beamPath(
          out,
          'tile',
          [
            [x + u, base + 0.023, z + s * d * 0.497],
            [x + u * 0.88, base + rise * 0.18, z + s * d * 0.414],
            [x + u * 0.72, shoulder + 0.034, z + s * d * 0.24],
          ],
          0.061,
          0.057,
          roofEdge,
        );
    }
  }
  if (!upper) return;
  for (const s of [-1, 1]) {
    const xEnd = x + s * w * 0.378;
    beamPath(
      out,
      'tile',
      [
        [xEnd, base + rise - 0.08, z],
        [xEnd + s * 0.15, base + rise + 0.22, z],
        [xEnd + s * 0.2, base + rise + 0.64, z],
      ],
      0.142,
      0.166,
      roofEdge,
    );
  }
}

function planes(x, z, w, d) {
  return [
    [facade([x, z + d / 2], [1, 0]), w],
    [facade([x, z - d / 2], [-1, 0]), w],
    [facade([x + w / 2, z], [0, -1]), d],
    [facade([x - w / 2, z], [0, 1]), d],
  ];
}

function sashes(out, x, z, w, d, y, lod, balcony = false) {
  if (lod === 0) return;
  for (const [f, span] of planes(x, z, w, d)) {
    const n = span > 13 ? 4 : span > 7 ? 3 : 2;
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) / n - 0.5) * span * 0.85;
      const width = Math.min(1.55, (span / n) * 0.56);
      opening(out, f, u, y, width, balcony ? 1.12 : 0.93, {
        head: balcony && (j + n) % 2 === 0 ? 'round' : 'flat',
        glassSlot: 'glass',
        frameSlot: 'wood',
        glass,
        frame: chalk,
        frameWidth: lod > 1 ? 0.081 : 0,
        frameDepth: 0.105,
        sill: false,
        mullions: lod > 1 ? (lod === 3 ? 3 : 1) : 0,
      });
    }
  }
}

function gallery(out, x, z, w, d, y, lod) {
  box(out, 'wood', x, z, w + 0.88, d + 0.88, y - 0.17, y + 0.077, wood);
  if (lod === 0) return;
  for (const [f, span] of planes(x, z, w + 0.76, d + 0.76)) {
    for (const h of [0.51, 0.87])
      fbox(out, 'wood', f, -span / 2, span / 2, y + h - 0.068, y + h, -0.027, 0.071, wood);
    if (lod < 2) continue;
    const n = Math.ceil(span / (lod === 3 ? 0.51 : 1.15));
    for (let i = 0; i <= n; i++) {
      const u = (i / n - 0.5) * span;
      fbox(out, 'wood', f, u - 0.035, u + 0.035, y + 0.015, y + 0.88, -0.028, 0.074, wood);
    }
  }
}

function gableAccent(out, f, u, y, half, rise, lod) {
  const sections =
    lod === 0
      ? [
          [-1, 0],
          [0, 1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-0.77, 0.11],
          [-0.55, 0.37],
          [-0.29, 0.7],
          [0, 1],
          [0.29, 0.7],
          [0.55, 0.37],
          [0.77, 0.11],
          [1, 0],
        ];
  const rim = sections.map(([a, b]) => f.P(u + a * half, y + b * rise, 0.23));
  const center = f.P(u, y - 0.07, 0.23);
  for (let i = 1; i < rim.length; i++) tri(out, 'wall', center, rim[i], rim[i - 1], white);
  beamPath(out, 'tile', rim, lod === 0 ? 0.19 : 0.155, 0.169, roofEdge);
  if (lod < 2) return;
  const upper = f.P(u, y + rise - 0.24, 0.256);
  const ends = [f.P(u - 0.28, y + rise - 0.6, 0.256), f.P(u + 0.28, y + rise - 0.6, 0.256)];
  beamPath(out, 'wood', [ends[0], upper, ends[1]], 0.11, 0.071, gold);
}

function keeps(out, lod) {
  const highBase = outwardRing(points.get('573872906'));
  bastion(out, highBase, -1.75, keepPlinth, 0.86, lod, false);
  const first = keepPlinth + 4.2;
  const second = keepPlinth + 9.04;
  const topFloor = keepPlinth + 10.54;
  box(out, 'wall', 0, 0, 18.6, 21.82, keepPlinth - 0.066, first + 0.21, white);
  sashes(out, 0, 0, 18.6, 21.82, keepPlinth + 1.53, lod);
  sweptRoof(out, 0, 0, first, 20.4, 23.43, 3.2, lod);
  box(out, 'wall', 0, -0.35, 14.05, 17.42, first + 0.91, second + 0.21, white);
  sashes(out, 0, -0.35, 14.05, 17.42, first + 2.15, lod);
  sweptRoof(out, 0, -0.35, second, 16.63, 19.46, 2.77, lod);
  box(out, 'wall', 0.1, -0.32, 10.21, 11.86, topFloor - 0.33, mainEave + 0.16, white);
  sashes(out, 0.1, -0.32, 10.21, 11.86, topFloor + 0.96, lod, true);
  gallery(out, 0.1, -0.32, 10.21, 11.86, topFloor, lod);
  sweptRoof(out, 0.1, -0.32, mainEave, 12.72, 14.05, mainRidge - mainEave, lod, true);
  gableAccent(out, facade([9.29, 0], [0, -1]), 0.33, first + 0.08, 6.34, 3.07, lod);
  gableAccent(out, facade([0, 10.8], [1, 0]), -0.15, first + 0.23, 5.73, 3.01, lod);
  if (lod > 0)
    gableAccent(out, facade([5.31, -0.24], [0, -1]), 0.24, mainEave - 0.41, 2.88, 1.23, lod);

  const annex = points.get('242226325').slice(0, -1);
  extrude(out, 'wall', annex, keepPlinth - 0.02, 7.61, white, { top: false });
  cap(out, 'tile', annex, 7.61, tile);
  sweptRoof(out, -4.67, -17.62, 7.61, 11.56, 12.46, 2.61, lod);
  sweptRoof(out, 0.39, -15.31, 7.14, 7.61, 7.2, 2.24, lod);
  sashes(out, -4.67, -17.62, 9.42, 10.86, 5.55, lod);
  const link = points.get('564165711').slice(0, -1);
  extrude(out, 'wall', link, keepPlinth - 0.15, 6.44, chalk, { top: false });
  cap(out, 'tile', link, 6.44, tile);
}

function gatehouses(out, lod) {
  const westRange = points.get('564165709').slice(0, -1);
  extrude(out, 'wall', westRange, outerWallTop - 0.35, 4.41, white, { top: false });
  cap(out, 'tile', westRange, 4.41, tile);
  sweptRoof(out, -73.84, 0.24, 4.3, 11.97, 8.72, 2.11, lod);
  sweptRoof(out, -64.05, 14.03, 5.31, 10.31, 11.15, 2.41, lod);
  box(out, 'wall', -64.05, 14.03, 7.3, 8.68, 4.36, 5.43, white);
  const gate = points.get('564165710').slice(0, -1);
  const front = wallFace(gate[1], gate[0]);
  for (const u of [0.82, front.length - 0.85]) {
    fbox(out, 'wall', front, u - 0.71, u + 0.71, outerWallTop - 0.46, 3.76, -7.08, 0.04, white);
    fbox(out, 'wood', front, u - 0.22, u + 0.22, outerWallTop - 0.44, 3.72, -0.16, 0.18, wood);
  }
  extrude(out, 'wall', gate, 3.46, 5.01, white, { top: false });
  cap(out, 'tile', gate, 5.01, tile);
  gableRoof(out, 'tile', [-69.57, -30.88], [-64.62, -18.62], 8.97, 4.94, 7.04, tile, {
    overhang: 0.38,
    endSlot: 'wall',
    endColor: chalk,
  });
}

function build(out, lod) {
  perimeter(out, lod);
  keeps(out, lod);
  gatehouses(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kishiwada-castle-model.mjs';
const camera = [102, 40, 87];
const lookAt = [-24, 6, -5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Kishiwada’s three-tiered white keep and smaller companion above the stone moat-side terrace.',
  camera,
  lookAt,
  sunDirection: [53, 60, 41],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Named main keep footprint atop its surveyed stone foundation.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'moat-side-fortifications-and-keep', position: camera, lookAt },
    { name: 'white-gables-and-keep-balcony', position: [62, 16, 53], lookAt: [0, 10, -4] },
    { name: 'gatehouse-and-subsidiary-keep', position: [-108, 16, -59], lookAt: [-39, 5, -15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kishiwada-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.138, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
