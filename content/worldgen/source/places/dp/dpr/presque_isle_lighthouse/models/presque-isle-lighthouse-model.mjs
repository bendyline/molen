import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  stairs,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  gable,
  roofCap,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json'),
  d = plan.dimensions;
const terrain = floorSampler(read('terrain-grid.json'));
const base = terrain([0, -2.6]);
const c = palette({
  ivory: 'cfc9b9',
  white: 'dedbd1',
  stone: 'a39e8f',
  brick: '9d5947',
  brickBright: 'ac664d',
  roof: '60635a',
  trim: 'd4ccba',
  dark: '333634',
  bronze: '676a56',
  pane: '5a7377',
  light: 'b6a56c',
});
const flat = () => base + 0.51;
const foundation = (p) => Math.min(flat() - 0.18, terrain(p) - 0.31);
const surfaces = {
  brick: surface('wall', 'brick', 0.94),
  stone: surface('foundation', 'stone_ashlar', 0.92),
  roof: surface('roof', 'shingle_asphalt', 0.9),
  steel: surface('trim', 'metal_painted', 0.72, 0.23),
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.09 },
};
const style = (wall, color, roof = 'roof', roofColor = c.roof) => ({
  wall,
  color,
  roof,
  roofColor,
});
const y = (value) => base + value;
const pathAt = (path, center, scale) => path.map((p) => p.map((x, i) => mix(center[i], x, scale)));
const ringPoints = (radius) =>
  Array.from({ length: 8 }, (_, i) => [
    Math.cos(((i + 0.5) * Math.PI) / 4) * radius,
    Math.sin(((i + 0.5) * Math.PI) / 4) * radius,
  ]);

function sash(out, wall, u, lower, upper, half, level, fill = c.dark) {
  arch(
    out,
    wall,
    u,
    y(lower),
    y(upper - 0.13),
    half,
    0.13,
    0.051,
    level,
    { inner: fill, trim: c.trim, width: 0.074 },
    { inner: 'pane', trim: 'brick' },
  );
  if (level > 0) {
    panel(
      out,
      'stone',
      wall,
      u - half - 0.11,
      u + half + 0.11,
      y(lower) - 0.11,
      y(lower) + 0.012,
      0.12,
      c.trim,
    );
    panel(out, 'steel', wall, u - 0.027, u + 0.027, y(lower), y(upper) - 0.1, 0.075, c.trim);
    panel(
      out,
      'steel',
      wall,
      u - half,
      u + half,
      y((lower + upper) * 0.5) - 0.025,
      y((lower + upper) * 0.5) + 0.025,
      0.076,
      c.trim,
    );
    if (level > 1)
      for (const f of [0.25, 0.75]) {
        const h = mix(lower, upper, f);
        panel(out, 'steel', wall, u - half, u + half, y(h) - 0.017, y(h) + 0.017, 0.076, c.trim);
      }
  }
}
function tower(out, level) {
  const outline = d.outline;
  const lower = pathAt(outline, [0, 0], 1.048);
  shell(out, lower, foundation, y(5.65), style('brick', c.ivory, 'stone', c.trim));
  shell(
    out,
    outline,
    () => y(5.62),
    y(d.towerGallery - 0.41),
    style('brick', c.white, 'steel', c.dark),
  );
  shell(out, pathAt(outline, [0, 0], 1.02), () => y(12.67), y(12.79), style('brick', c.ivory));
  shell(
    out,
    pathAt(outline, [0, 0], 1.135),
    () => y(d.towerGallery - 0.49),
    y(d.towerGallery - 0.19),
    style('stone', c.ivory, 'steel', c.dark),
  );
  const deck = pathAt(outline, [0, 0], 1.2);
  shell(
    out,
    deck,
    () => y(d.towerGallery - 0.19),
    y(d.towerGallery),
    style('steel', c.dark, 'steel', c.dark),
  );
  const walls = pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
  for (const [i, w] of walls.entries()) {
    const u = w.length * 0.5;
    if (i === 0 || i === 2) {
      sash(out, w, u, 5.94, 7.12, 0.135, level);
      sash(out, w, u, 8.9, 10.0, 0.142, level);
      sash(out, w, u - 0.34, 11.38, 12.55, 0.235, level);
      sash(out, w, u + 0.34, 11.38, 12.55, 0.235, level);
      sash(out, w, u, 14.71, 15.98, 0.145, level);
    } else if (level > 0) {
      sash(out, w, u, 15.6, 16.8, 0.13, level);
    }
  }
  const lantern = ringPoints(1.38);
  const glassBottom = d.towerGallery + 1.12,
    glassTop = d.lanternEave - 0.14;
  shell(
    out,
    lantern,
    () => y(d.towerGallery - 0.02),
    y(glassBottom),
    style('steel', c.dark, 'steel', c.dark),
  );
  const lanternWalls = pairs(closed(lantern)).map(([a, b]) => edge(a, b, areaSign(lantern)));
  for (const w of lanternWalls) {
    panel(out, 'pane', w, 0, w.length, y(glassBottom), y(glassTop), 0, c.pane);
    if (level > 0)
      for (const x of [0.04, w.length - 0.045]) {
        trimBlock(
          out,
          'steel',
          w,
          x - 0.033,
          x + 0.033,
          y(glassBottom - 0.1),
          y(glassTop + 0.1),
          0,
          0.068,
          c.dark,
        );
      }
    if (level > 1)
      panel(
        out,
        'steel',
        w,
        0,
        w.length,
        y((glassBottom + glassTop) * 0.5) - 0.025,
        y((glassBottom + glassTop) * 0.5) + 0.025,
        0.035,
        c.dark,
      );
  }
  roofCap(
    out,
    'steel',
    [0, 0],
    [
      [y(glassTop), 1.48],
      [y(d.lanternEave), 1.53],
      [y(d.finialHeight - 0.48), 0.1],
      [y(d.finialHeight - 0.39), 0],
    ],
    ringPoints(1),
    c.dark,
  );
  if (level > 0)
    beam(
      out,
      'steel',
      [0, y(d.finialHeight - 0.57), 0],
      [0, y(d.finialHeight), 0],
      0.075,
      0.075,
      c.dark,
    );
  const rail = y(d.towerGallery + 0.94);
  for (const [a, b] of pairs(closed(deck))) {
    const e = edge(a, b, areaSign(deck));
    beam(out, 'steel', e.p(0, rail), e.p(e.length, rail), 0.069, 0.065, c.dark);
    if (level === 0) {
      beam(out, 'steel', e.p(0, y(d.towerGallery)), e.p(0, rail), 0.069, 0.065, c.dark);
    } else {
      beam(
        out,
        'steel',
        e.p(0, y(d.towerGallery + 0.16)),
        e.p(e.length, y(d.towerGallery + 0.16)),
        0.052,
        0.047,
        c.dark,
      );
      const n = [1, 3, 5, 8][level];
      for (let i = 0; i < n; i++) {
        const u = (e.length * i) / n;
        beam(out, 'steel', e.p(u, y(d.towerGallery)), e.p(u, rail), 0.049, 0.049, c.dark);
      }
    }
  }
}
function keeper(out, level) {
  const { cottage, kitchen } = d;
  for (const [outline, eave] of [
    [cottage, d.houseEave],
    [kitchen, d.kitchenEave],
  ]) {
    shell(out, outline, foundation, y(0.67), style('stone', c.stone, 'brick', c.brick));
    shell(out, outline, () => y(0.65), y(eave), style('brick', c.brick));
  }
  gable(
    out,
    [-11.5, -2.37],
    [-1.52, -2.35],
    4.53,
    y(d.houseEave),
    d.houseRidge - d.houseEave,
    c.roof,
    'brick',
    c.brick,
    'roof',
  );
  gable(
    out,
    [-16.88, 0.63],
    [-11.16, 0.62],
    3.55,
    y(d.kitchenEave),
    d.kitchenRidge - d.kitchenEave,
    c.roof,
    'brick',
    c.brick,
    'roof',
  );

  const cross = rect(-8.745, -8.03, -3.419, -6.4);
  shell(out, cross, () => y(d.houseEave - 0.02), y(d.gableEave), style('brick', c.brickBright));
  gable(
    out,
    [-6.082, -8.042],
    [-6.082, -2.92],
    2.85,
    y(d.gableEave),
    d.gableRidge - d.gableEave,
    c.roof,
    'brick',
    c.brickBright,
    'roof',
  );
  const w = edge([-8.745, -8.042], [-3.419, -8.043]);
  for (const u of [1.49, 3.79]) sash(out, w, u, 1.34, 3.42, 0.48, level, c.pane);
  sash(out, w, w.length / 2, 5.68, 7.37, 0.49, level, c.pane);
  if (level > 0)
    trimBlock(
      out,
      'stone',
      w,
      w.length / 2 - 0.55,
      w.length / 2 + 0.55,
      y(4.7),
      y(4.97),
      0.021,
      0.08,
      c.trim,
    );
  const south = edge([-1.835, 1.978], [-11.334, 1.978]);
  for (const u of [1.33, 3.41, 5.8, 7.9]) sash(out, south, u, 1.55, 3.39, 0.46, level, c.pane);
  const northEast = edge([-3.416, -6.683], [-1.844, -6.677]);
  sash(out, northEast, 0.71, 1.45, 3.12, 0.34, level, c.pane);
  const northWest = edge([-11.342, -6.668], [-8.74, -6.668]);
  sash(out, northWest, 1.25, 1.4, 3.42, 0.45, level, c.pane);
  const kitchenSouth = edge([-11.328, 3.999], [-16.716, 3.999]);
  sash(out, kitchenSouth, 1.02, 1.36, 2.84, 0.32, level, c.pane);
  const kitchenNorth = edge([-16.718, -2.733], [-11.337, -2.734]);
  for (const u of [1.4, 3.7]) sash(out, kitchenNorth, u, 1.13, 2.84, 0.4, level, c.pane);

  const porch = rect(-1.86, -4.52, 1.6, -1.93);
  shell(out, porch, foundation, y(3.86), style('brick', c.brick));
  const entrance = edge([-1.86, -4.53], [1.6, -4.53]);
  arch(
    out,
    entrance,
    1.72,
    y(0.49),
    y(2.83),
    0.91,
    0.43,
    0.045,
    level,
    { inner: c.dark, trim: c.brickBright, width: 0.18 },
    { inner: 'pane', trim: 'brick' },
  );
  const slope = [
    [-1.97, y(3.82), -4.65],
    [1.72, y(3.82), -4.65],
    [1.72, y(4.56), -1.91],
    [-1.97, y(4.56), -1.91],
  ];
  face(out, 'roof', slope, [0, 1, 0], c.roof);
  stairs(out, terrain, 'stone', -1.1, 0.84, -5.5, -4.53, y(0.54), 3, c.stone);
  for (const [x, z, start, height] of [
    [-7.2, -3.48, 7.15, 4.3],
    [-4.02, -0.5, 7.2, 4.75],
    [-15.5, 0.17, 5.17, 2.17],
  ]) {
    block(out, 'brick', x, y(start), z, 0.61, height, 0.61, c.brickBright);
    if (level > 0)
      block(out, 'stone', x - 0.06, y(start + height), z - 0.06, 0.73, 0.16, 0.73, c.stone);
  }
}
function build(out, level) {
  keeper(out, level);
  tower(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'presque-isle-lighthouse-model.mjs';
const camera = [38, 27, -46],
  lookAt = [-6, 8, 0];
const errors = { district: 0.27, street: 0.1, closeup: 0.037 };
export const presqueIsleLighthouseAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original USGS 3DEP at the lakeside keeper’s house approach.',
  brief:
    'Presque Isle’s square white lighthouse with its octagonal lantern, iron gallery, red brick keeper’s residence and summer kitchen.',
  camera,
  lookAt,
  sunDirection: [29, 78, -50],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Three existing OSM outlines corroborated by the 1962 federal survey.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'tytuvenai-ensemble-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'lake-facing-porch-and-gable', position: [12, 11, -37], lookAt: [-6, 6, -0.8] },
    { name: 'octagonal-lantern-and-gallery', position: [8, 22, -13], lookAt: [0, 18.7, 0] },
    { name: 'keeper-residence-and-summer-kitchen', position: [-30, 12, 20], lookAt: [-8, 5, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'presque-isle-lighthouse-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the project license. OSM geometry © OpenStreetMap contributors. USGS National Map elevation and public-domain HABS drawings.',
};
