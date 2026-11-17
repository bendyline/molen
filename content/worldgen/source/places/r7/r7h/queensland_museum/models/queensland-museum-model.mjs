/** Queensland Museum Kurilpa and the connected Melbourne Street pedestrian overpass. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const [outline] = frame.geometry.polygons;
const [overpass] = frame.geometry.centerlines;
const { section } = plan;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.97, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  asphalt: { slot: 'roof', graph: 'membrane', roughness: 0.97, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.23, metallic: 0.1 },
};
const tint = Object.fromEntries(
  Object.entries({
    white: 'd6d1c5',
    shaded: 'b8b4a7',
    soffit: 'b7b5aa',
    dark: '696d68',
    roof: 'b6b3a6',
    strip: '7e9ea4',
    pane: '8ca6ad',
    frame: '6c7478',
    rail: 'a8ada9',
    stone: 'a19b89',
    planted: '716e4f',
  }).map(([key, value]) => [key, rgb(value)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const hue = (color, t) => color.map((v) => Math.min(1, v * t));

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const [a, b] = [field.heightsMeters[j], field.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function clip(points, axis, limit, side) {
  const ring = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const aIn = (a[axis] - limit) * side >= 0;
    const bIn = (b[axis] - limit) * side >= 0;
    if (aIn) ring.push(a);
    if (aIn !== bIn) {
      const cross = lerp(a[1 - axis], b[1 - axis], (limit - a[axis]) / (b[axis] - a[axis]));
      ring.push(axis === 0 ? [limit, cross] : [cross, limit]);
    }
  }
  return ring.filter((a, i) => {
    const b = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.001;
  });
}
const region = ([x0, x1], [z0, z1]) =>
  clip(clip(clip(clip(outline, 0, x0, 1), 0, x1, -1), 1, z0, 1), 1, z1, -1);

function cap(out, slot, ring, height, color, underside = false) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => ring[index]);
    const signed = (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
    const points = (signed > 0 !== underside ? [a, b, c] : [a, c, b]).map(([x, z]) => [
      x,
      height,
      z,
    ]);
    triangle(out, slot, points, color);
  }
}

function shell(out, ring, floor, roof, wall, slab, louvers = []) {
  const orientation = ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  const corners = orientation > 0 ? ring : ring.toReversed();
  cap(out, 'asphalt', ring, roof, slab);
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const lowA = typeof floor === 'number' ? floor : floor(a);
    const lowB = typeof floor === 'number' ? floor : floor(b);
    const color = hue(wall, 0.96 + 0.03 * Math.sin(a[0] * 0.63 + b[1] * 0.24));
    face(
      out,
      'concrete',
      [
        [b[0], lowB, b[1]],
        [a[0], lowA, a[1]],
        [a[0], roof, a[1]],
        [b[0], roof, b[1]],
      ],
      color,
    );
  }
  for (const [x0, x1, y0, y1, z] of louvers)
    box(out, 'metal', [x0, y0, z], [x1, y1, z + 0.16], tint.dark);
}

const body = region([-22.2, 19], [-35, 61.466]);
const westernNorth = region([-35, -22.2], [-33.0, section.gardenOpening.zRange[0]]);
const westernSouth = region([-35, -22.2], [section.gardenOpening.zRange[1], 61.466]);
const westernCanopy = region([-35, -22.17], section.gardenOpening.zRange);
const northBlock = region([-26, 19], [-76, -35]);
const bridgeWing = region([6.84, 19], [61.466, 67.348]);
const lowerBack = (p) => Math.min(0.8, ground(...p) - 0.38);
const upperGallery = region([-25.3, 17.89], [-26.2, 58.8]);
const collections = region([-6.75, 17.21], [-42.12, 48.08]);

function museumBody(out, lod) {
  shell(out, body, lowerBack, section.bodyTopMeters, tint.white, tint.roof);
  shell(out, westernNorth, lowerBack, 16.18, tint.white, tint.roof);
  shell(
    out,
    westernSouth,
    lowerBack,
    16.18,
    tint.white,
    tint.roof,
    lod > 0 ? [[-31.7, -23.4, 11.38, 13.48, 61.47]] : [],
  );
  shell(out, westernCanopy, section.gardenOpening.heightMeters, 15.92, tint.white, tint.roof);
  cap(out, 'base', westernCanopy, -2.32, tint.stone);
  shell(out, northBlock, lowerBack, 15.07, tint.shaded, tint.roof);
  shell(out, bridgeWing, 1.04, 14.05, tint.white, tint.roof);
  shell(out, upperGallery, 16.1, 22.85, tint.white, tint.roof);
  shell(out, collections, 21.71, section.collectionTopMeters, tint.white, tint.roof);
  box(
    out,
    'concrete',
    [-1.5, section.collectionTopMeters - 0.18, -33.4],
    [14.45, 31.44, -16.28],
    tint.shaded,
  );
  box(
    out,
    'concrete',
    [3.35, section.collectionTopMeters - 0.18, 15.8],
    [13.1, 30.96, 30.34],
    tint.shaded,
  );
  for (const z of [1, 11.7, 22.5, 33.2, 43.8]) {
    box(
      out,
      'concrete',
      [-33.89, ground(-33.4, z) - 0.35, z - 0.62],
      [-32.48, section.gardenOpening.heightMeters + 0.35, z + 0.62],
      tint.white,
    );
  }
  if (lod === 0) return;
  // Deep horizontal slots in the stair and office bands are distinct from the largely blind collection walls.
  for (const [x0, x1, z0, h] of [
    [-5.4, 14.9, 48.09, 24.2],
    [-18.2, 4.5, 58.82, 19.2],
    [-17.5, -12.2, 61.47, 5.08],
  ]) {
    box(out, 'glass', [x0, h, z0], [x1, h + 0.92, z0 + 0.13], tint.strip);
    box(out, 'concrete', [x0 - 0.12, h - 0.17, z0], [x1 + 0.12, h, z0 + 0.31], tint.shaded);
    if (lod > 1) {
      for (let x = x0 + 1.82; x < x1; x += 1.82)
        box(out, 'metal', [x - 0.037, h, z0 + 0.12], [x + 0.037, h + 0.92, z0 + 0.16], tint.frame);
    }
  }
  if (lod === 3) {
    for (const h of [7.2, 10.6, 14.6])
      box(out, 'concrete', [-33.45, h, 61.47], [-9.97, h + 0.041, 61.51], hue(tint.shaded, 1.04));
    for (let x = -31.4; x < -23.4; x += 0.7)
      box(out, 'metal', [x, 11.44, 61.62], [x + 0.065, 13.39, 61.65], tint.frame);
    for (let z = 1.8; z < 46; z += 2.74)
      box(out, 'metal', [-33.72, -1.91, z], [-33.64, -0.88, z + 0.08], tint.frame);
    box(out, 'metal', [-33.73, -0.94, 1.8], [-33.61, -0.86, 46.4], tint.rail);
  }
  if (lod > 1) {
    for (const z of [2.3, 12.7, 24.1, 35.1]) {
      box(out, 'base', [-31.94, -2.3, z], [-28.39, -1.52, z + 6.66], tint.shaded);
      box(out, 'asphalt', [-31.76, -1.55, z + 0.18], [-28.57, -1.45, z + 6.48], tint.planted);
      box(out, 'base', [-33.45, -2.22, z], [-33.26, -1.08, z + 6.65], tint.shaded);
    }
    for (const x of [-20.3, -8.4, 3.4, 12.1]) {
      box(out, 'concrete', [x, 22.83, 50.02], [x + 4.3, 23.66, 51.75], tint.shaded);
    }
  }
}

const entryRing = outline.slice(4, 12);
const frontWall = entryRing.slice(1, -1);
function glazedEntrance(out, lod) {
  const y0 = section.entryBaseY;
  const y1 = section.entryCanopyY;
  cap(out, 'base', entryRing, y0 + 0.03, tint.soffit);
  const roof = entryRing.map(([x, z]) => [
    x + (x > -2.0 ? 1.08 : -0.95),
    z + (z > 72 ? 2.11 : -0.42),
  ]);
  cap(out, 'metal', roof, y1, tint.dark);
  cap(out, 'metal', roof, y1 - 0.42, hue(tint.dark, 0.84), true);
  for (let i = 0; i < roof.length; i++) {
    const a = roof[i];
    const b = roof[(i + 1) % roof.length];
    face(
      out,
      'metal',
      [
        [b[0], y1 - 0.42, b[1]],
        [a[0], y1 - 0.42, a[1]],
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
      ],
      tint.dark,
    );
  }
  for (let i = 0; i < entryRing.length - 1; i++) {
    const a = entryRing[i];
    const b = entryRing[i + 1];
    const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const local = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
    box(
      local,
      'glass',
      [0, y0, 0],
      [width, y1 - 0.41, 0.18],
      hue(tint.pane, 0.91 + 0.09 * Math.cos(i * 1.6)),
    );
    box(local, 'metal', [0, 5.72, -0.044], [width, 6.12, 0.21], tint.frame);
    if (lod > 0) {
      const bays = Math.max(1, Math.round(width / 2.04));
      for (let j = 0; j <= bays; j++) {
        const x = (width * j) / bays;
        box(local, 'metal', [x - 0.044, y0, -0.045], [x + 0.044, y1 - 0.36, 0.22], tint.frame);
      }
      if (lod > 1) {
        for (const y of [3.0, 8.6, 10.65])
          box(local, 'metal', [0, y, -0.025], [width, y + 0.071, 0.21], tint.frame);
      }
    }
  }
  // The concrete-encased jamb reaches the projecting roof to the east of the public doors.
  box(out, 'concrete', [6.73, y0, 79.2], [7.75, y1 - 0.15, 85.03], tint.white);
  if (lod > 0) {
    const door = frontWall.at(-1);
    const target = outline[9];
    const yaw = -Math.atan2(target[1] - door[1], target[0] - door[0]);
    const local = transform(out, yaw, [target[0], 0, target[1]]);
    box(local, 'metal', [-1.55, y0 - 0.12, -0.11], [1.55, y0 + 2.66, 0.19], tint.frame);
    for (const x of [-1.41, 0.06]) {
      box(local, 'glass', [x, y0 + 0.16, 0.19], [x + 1.34, y0 + 2.52, 0.3], tint.strip);
      if (lod > 1)
        box(local, 'metal', [x + 0.93, y0 + 0.81, 0.28], [x + 1.22, y0 + 0.87, 0.38], tint.rail);
    }
    const count = [0, 2, 5, 7][lod];
    const stairBottom = ground(target[0], target[1] + 4.2) - 0.04;
    for (let i = 0; i < count; i++) {
      const y = lerp(y0 + 0.04, stairBottom, i / count);
      box(
        out,
        'base',
        [target[0] - 2.11, stairBottom - 0.2, target[1] + i * 0.7],
        [target[0] + 2.61, y, target[1] + (i + 1) * 0.7],
        tint.soffit,
      );
    }
  }
}

const deck = (z) =>
  lerp(
    section.walkDeckY[0],
    section.walkDeckY[1],
    (z - overpass[0][1]) / (overpass.at(-1)[1] - overpass[0][1]),
  );
function crossing(out, lod) {
  const path = lod === 0 ? [overpass[0], overpass.at(-1)] : overpass;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const local = transform(out, Math.atan2(b[0] - a[0], b[1] - a[1]), [a[0], deck(a[1]), a[1]]);
    const side = 2.47;
    box(local, 'base', [-side, -0.91, 0], [side, -0.05, len], tint.soffit);
    box(local, 'concrete', [-side, -0.11, 0], [side, 0.22, len], tint.white);
    for (const x of [-side, side - 0.19]) {
      box(local, 'concrete', [x, 0.19, 0], [x + 0.19, 0.8, len], tint.white);
      box(local, 'metal', [x, 0.8, 0], [x + 0.14, 0.88, len], tint.rail);
    }
    const height = 2.94 + 0.54 * Math.sin(((i - 0.5) * Math.PI) / overpass.length);
    box(local, 'metal', [-side - 0.38, height, 0], [side + 0.38, height + 0.27, len], tint.dark);
    const posts = lod > 1 ? Math.max(1, Math.ceil(len / (lod === 3 ? 3.8 : 5.4))) : 1;
    for (let j = 0; j < posts; j++) {
      for (const x of [-side + 0.19, side - 0.19])
        box(
          local,
          'metal',
          [x - 0.067, 0.22, (len * j) / posts],
          [x + 0.067, height, (len * j) / posts + 0.134],
          tint.frame,
        );
    }
  }
  for (const z of [83.3, 126.9, 145.7, 172.4, 186.5]) {
    box(
      out,
      'base',
      [10.57, ground(11.52, z) - 0.53, z - 0.74],
      [12.45, deck(z) - 0.65, z + 0.74],
      tint.soffit,
    );
  }
}

function build(out, lod) {
  museumBody(out, lod);
  glazedEntrance(out, lod);
  crossing(out, lod);
}
export const queenslandMuseumSkyline = (out) => build(out, 0);
export const queenslandMuseumDistrict = (out) => build(out, 1);
export const queenslandMuseumStreet = (out) => build(out, 2);
export const queenslandMuseumCloseup = (out) => build(out, 3);

const camera = [-154, 84, 224];
const lookAt = [0, 10, 43];
const recipe = 'queensland-museum-model.mjs';
export const queenslandMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  build: queenslandMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis:
      'Whole-building replacement is bounded by the native Queensland Museum relation/18157403.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Robin Gibson’s stepped concrete museum and open Grey Street garden, with its glazed Melbourne Street entrance and attached covered overpass.',
  camera,
  lookAt,
  sunDirection: [-61, 83, 57],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.95,
    cameraYaw: -0.9,
    focus: { center: [0, 2, 52] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'whole-museum-and-overpass', position: camera, lookAt },
    { name: 'melbourne-street-glazed-pavilion', position: [-31, 6, 113], lookAt: [-2, 6, 65] },
    {
      name: 'grey-street-garden-and-suspended-volume',
      position: [-82, 16, 19],
      lookAt: [-18, 10, 20],
    },
    {
      name: 'stepped-collection-roof-and-whale-mall',
      position: [89, 61, -85],
      lookAt: [-1, 11, 11],
    },
    { name: 'overpass-deck-and-pavilion-connection', position: [46, 21, 144], lookAt: [8, 7, 91] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'queenslandMuseumSkyline',
    errorMeters: 2.64,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'queenslandMuseumDistrict', 0.94],
        ['street', 'queenslandMuseumStreet', 0.28],
        ['closeup', 'queenslandMuseumCloseup', 0.11],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Qualla photograph is public domain. Native footprint is OpenStreetMap ODbL 1.0; original elevation from Queensland Government QldDEM.',
};
