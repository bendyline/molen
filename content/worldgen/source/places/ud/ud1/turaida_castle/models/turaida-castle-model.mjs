import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  ring,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  gable,
  roofCap,
} from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json'),
  d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  brick: 'af694d',
  brickWarm: 'b57358',
  brickTop: 'a0664e',
  brickPale: 'b98569',
  ruined: 'a18368',
  sandstone: 'a5a093',
  roof: '835343',
  roofDark: '6c5549',
  timber: '615147',
  edge: '837263',
  shadow: '363332',
  light: 'b8ae8c',
});
const surfaces = {
  brick: surface('wall', 'brick_longformat', 0.91),
  roof: surface('roof', 'tile_flat', 0.92),
  timber: surface('trim', 'wood_plain', 0.88),
  stone: surface('foundation', 'stone_ashlar', 0.94),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const R = Math.PI * 2;
const mkDisk = (x, z, r, n) =>
  Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((R * i) / n),
    z + r * Math.sin((R * i) / n),
  ]);
const wallStyle = (color = c.brick) => ({ wall: 'brick', roof: 'roof', color, roofColor: c.roof });
const foundation = (top) => (p) => Math.min(grade(p) - 0.47, top - 0.32);
const towerBase = grade([0, 7.5]);
const support = (out, p, q, color = c.timber, width = 0.14) =>
  beam(out, 'timber', p, q, width, width, color);

function keep(out, level) {
  const n = [14, 26, 42, 56][level],
    r = d.keepRadius;
  const disk = mkDisk(0, 0, r, n);
  const eaves = towerBase + d.keepMasonryHeight;
  const crown = towerBase + d.keepRoofHeight;
  shell(out, disk, foundation(eaves), eaves, wallStyle());
  const underRoof = eaves - 0.066;
  const innerRim = mkDisk(0, 0, r - 0.09, n);
  const outerRim = mkDisk(0, 0, r + 0.39, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(
      out,
      'timber',
      [innerRim[i], outerRim[i], outerRim[j], innerRim[j]].map((point) => at(point, underRoof)),
      [0, -1, 0],
      c.timber,
    );
  }
  const faceDisk = mkDisk(0, 0, 1, n);
  roofCap(
    out,
    'roof',
    [0, 0],
    [
      [eaves - 0.06, r + 0.39],
      [eaves + 0.18, r + 0.44],
      [eaves + 1.05, r + 0.08],
      [mix(eaves, crown, 0.63), r * 0.43],
      [crown, 0],
    ],
    faceDisk,
    c.roofDark,
  );
  const bands =
    level === 0 ? [] : [towerBase + 9.15, towerBase + 17.4, towerBase + 23.15, eaves - 2.15];
  for (const [i, y] of bands.entries()) {
    const base = [0.18, 0.81, 0.19, 0.23][i];
    ring(
      out,
      'brick',
      [0, 0],
      [
        [y, r - 0.012],
        [y + base, r + 0.025],
        [y + base + 0.045, r - 0.012],
      ],
      n,
      i === 1 ? c.brickPale : c.brickTop,
    );
  }
  const walls = pairs(closed(disk)).map(([a, b]) => edge(a, b, areaSign(disk)));
  const facade = walls.reduce(
    (best, wall) => (wall.normal[2] > best.normal[2] ? wall : best),
    walls[0],
  );
  arch(
    out,
    facade,
    facade.length * 0.53,
    towerBase + 0.03,
    towerBase + 1.5,
    0.58,
    0.52,
    0.037,
    level,
    { inner: c.shadow, trim: c.brickPale, width: 0.1 },
    { inner: 'dark', trim: 'brick' },
  );
  for (const [i, w] of walls.entries()) {
    const u = w.length * 0.5;
    if (i % [2, 2, 2, 3][level] === 0) {
      panel(out, 'dark', w, u - 0.26, u + 0.26, eaves - 1.22, eaves - 0.29, 0.036, c.shadow);
      if (level > 0)
        arch(
          out,
          w,
          u,
          eaves - 3.47,
          eaves - 3.43,
          Math.min(0.31, w.length * 0.43),
          0.29,
          0.032,
          level,
          { inner: c.brickTop, trim: c.brickWarm, width: 0.07 },
          { inner: 'brick', trim: 'brick' },
        );
    }
    if (i % [4, 5, 6, 7][level] === 1) {
      const y = towerBase + 4.1 + ((i * 7) % 17);
      panel(out, 'dark', w, u - 0.086, u + 0.086, y, y + 0.7, 0.046, c.shadow);
    }
  }
  if (level > 0) {
    const y = towerBase + 10.4;
    const p = (x, h, z) => [x, h, z];
    for (const x of [-0.97, -0.32, 0.32, 0.97])
      support(out, p(x, y, 7.31), p(x, y + 1.45, 7.31), c.timber, 0.16);
    for (const h of [y + 0.18, y + 0.92, y + 1.38])
      support(out, p(-1.12, h, 7.34), p(1.12, h, 7.34), c.edge, 0.12);
    face(
      out,
      'timber',
      [
        [-1.2, y, 6.15],
        [-1.2, y, 7.49],
        [1.2, y, 7.49],
        [1.2, y, 6.15],
      ],
      [0, 1, 0],
      c.timber,
    );
    face(
      out,
      'roof',
      [
        [-1.3, y + 1.75, 6.17],
        [-1.3, y + 1.51, 7.6],
        [1.3, y + 1.51, 7.6],
        [1.3, y + 1.75, 6.17],
      ],
      [0, 1, 0],
      c.roof,
    );
    if (level > 1) support(out, [0, crown - 0.05, 0], [0, crown + 0.65, 0], c.timber, 0.05);
  }
}

function smallOpenings(out, poly, top, level, span = 4.5) {
  if (level === 0) return;
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b, areaSign(poly));
    if (w.length < 2.35) continue;
    const n = Math.max(1, Math.floor(w.length / span));
    const t = w.length / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * t;
      const y = Math.min(top - 2.6, Math.max(grade(a), grade(b)) + 2.9);
      panel(out, 'dark', w, u - 0.24, u + 0.24, y, y + 0.92, 0.038, c.shadow);
      if (level > 1 && w.length > 6)
        arch(
          out,
          w,
          u,
          top - 2.15,
          top - 1.55,
          0.29,
          0.29,
          0.04,
          level,
          { inner: c.shadow, trim: c.brickPale, width: 0.075 },
          { inner: 'dark', trim: 'brick' },
        );
    }
  }
}

function gallery(out, a, b, y, level) {
  if (level === 0) return;
  const w = edge(a, b);
  const n = Math.ceil(w.length / [4.8, 2.7, 2.15, 1.8][level]);
  const pt = (u, h, depth) => w.p(u, y + h, depth);
  for (let i = 0; i <= n; i++) {
    const u = (w.length * i) / n;
    support(out, pt(u, 0, -0.04), pt(u, 0, 1.27));
    support(out, pt(u, 0, 1.23), pt(u, 1.17, 1.23), c.edge);
    if (level > 0) {
      support(out, pt(u, -0.62, 0), pt(u, 0, 1.16));
      support(out, pt(u, 1.12, 1.26), pt(u, 2.14, 1.26), c.timber, 0.12);
    }
  }
  for (const h of [0.15, 0.51, 1.13])
    support(out, pt(0, h, 1.24), pt(w.length, h, 1.24), c.timber, 0.13);
  face(
    out,
    'roof',
    [pt(0, 2.7, -0.1), pt(w.length, 2.7, -0.1), pt(w.length, 2.18, 1.46), pt(0, 2.18, 1.46)],
    [0, 1, 0],
    c.roofDark,
  );
  face(
    out,
    'timber',
    [pt(0, 0, 0), pt(w.length, 0, 0), pt(w.length, 0, 1.27), pt(0, 0, 1.27)],
    [0, 1, 0],
    c.timber,
  );
}

function standingBlocks(out, level) {
  const westGrade = grade([-10, 37]),
    wy = westGrade + d.westRangeEave;
  shell(out, d.westRange, foundation(wy), wy, wallStyle(c.brickWarm));
  gable(out, [-12.2, 11.5], [-8.9, 38.8], 5.65, wy, 5.25, c.roof, 'brick', c.brick, 'roof');
  gable(out, [-8.8, 41.5], [10.5, 66.0], 5.35, wy, 5.35, c.roof, 'brick', c.brick, 'roof');
  smallOpenings(out, d.westRange, wy, level);
  gallery(out, [-7.7, 11.9], [-4.0, 36.2], westGrade + 4.15, level);
  gallery(out, [1.8, 41.5], [16.3, 62.7], westGrade + 4.02, level);
  const westTowerCenter = planarMid(d.westTower);
  const westernTop = grade(westTowerCenter) + d.westTowerEave;
  shell(out, d.westTower, foundation(westernTop), westernTop, wallStyle(c.brick));
  const westN = [12, 18, 24, 30][level];
  roofCap(
    out,
    'roof',
    westTowerCenter,
    [
      [westernTop - 0.04, 7.45],
      [westernTop + 0.24, 7.55],
      [westernTop + 4.6, 2.9],
      [westernTop + 6.2, 0],
    ],
    mkDisk(0, 0, 1, westN),
    c.roofDark,
  );
  smallOpenings(out, d.westTower, westernTop, level, 3.35);
  const sy = grade([20, 71]) + d.southTowerEave;
  shell(out, d.southTower, foundation(sy), sy, wallStyle(c.brickWarm));
  gable(out, [19.8, 65.3], [19.4, 78.2], 4.64, sy, 5.25, c.roof, 'brick', c.brick, 'roof');
  smallOpenings(out, d.southTower, sy, level);
  gallery(out, [16.0, 65.6], [24.45, 65.9], sy - 5.35, level);
  const e = grade([33, 1]) + d.eastHouseEave;
  shell(out, d.eastHouse, foundation(e), e, wallStyle(c.brickWarm));
  gable(out, [26.9, 2.3], [38.8, 3.4], 6.15, e, 4.5, c.roof, 'brick', c.brick, 'roof');
  smallOpenings(out, d.eastHouse, e, level);
  const iy = grade([-4.5, -16]) + 6.75;
  shell(out, d.innerGate, foundation(iy), iy, wallStyle(c.brick));
  gable(out, [-7.7, -18.6], [-0.3, -16.1], 3.43, iy, 2.9, c.roofDark, 'brick', c.brick, 'roof');
  const ny = grade([-44, -90]) + 3.2;
  shell(out, d.northGate, foundation(ny), ny, {
    ...wallStyle(c.ruined),
    roof: 'stone',
    roofColor: c.sandstone,
  });
}

function curtain(out, level) {
  for (const { points, height, thickness } of d.wallRuns)
    for (const [i, [a, b]] of pairs(
      level === 0
        ? points.filter((_, index) => index % 3 === 0 || index === points.length - 1)
        : points,
    ).entries()) {
      const wall = edge(a, b);
      if (wall.length < 0.35) continue;
      const outline = [
        wall.p(-0.1, 0, 0),
        wall.p(wall.length + 0.1, 0, 0),
        wall.p(wall.length + 0.1, 0, -thickness),
        wall.p(-0.1, 0, -thickness),
      ].map(([x, , z]) => [x, z]);
      const ya = grade(a),
        yb = grade(b);
      const top = Math.min(ya, yb) + height + (level > 0 ? (i % 4) * 0.065 : 0);
      shell(out, outline, foundation(top), top, {
        ...wallStyle(c.ruined),
        roof: 'stone',
        roofColor: c.sandstone,
      });
      if (level > 1 && height > 3 && wall.length > 4.0) {
        const u = wall.length * 0.55;
        trimBlock(
          out,
          'brick',
          wall,
          u - 0.07,
          u + 0.07,
          top - 1.22,
          top - 0.38,
          0.012,
          0.055,
          c.brickPale,
        );
        panel(out, 'dark', wall, u - 0.054, u + 0.054, top - 1.16, top - 0.46, 0.058, c.shadow);
      }
    }
}

function build(out, level) {
  keep(out, level);
  standingBlocks(out, level);
  curtain(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'turaida-castle-model.mjs';
const camera = [175, 88, 230],
  lookAt = [-2, 12, 7];
const errors = { district: 0.8, street: 0.28, closeup: 0.085 };
export const turaidaCastleAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original Gauja valley ridge elevation beside the documented Bergfried.',
  brief:
    'Restored brick castle on the Gauja ridge with round Bergfried, tiled roofs, timber galleries and surviving enclosure walls.',
  camera,
  lookAt,
  sunDirection: [26, 72, 85],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Mapped standing ranges, towers and northern gate structures.',
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
    { name: 'brick-keep-from-the-courtyard', position: [29, 8, 46], lookAt: [-1, 14, 0] },
    { name: 'western-tower-range-and-timber-gallery', position: [30, 16, 53], lookAt: [-8, 9, 38] },
    { name: 'southern-and-eastern-curtain', position: [102, 38, 120], lookAt: [19, 5, 62] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'turaida-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.6,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
