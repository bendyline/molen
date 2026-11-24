import fs from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const { heightWestCurtain, heightEastCurtain, eastGate, heightGate } = plan.dimensions;
const sandstone = rgb('b29871');
const mud = rgb('baa27b');
const lighter = rgb('c2a882');
const eroded = rgb('a78c64');
const dark = rgb('4b4030');
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  adobe: { slot: 'trim', graph: 'earth_rammed', roughness: 0.98 },
  footing: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.97 },
};
const perimeter = outwardRing(frame.geometry.outline);

function grade(x, z) {
  const { origin, stepMeters, heightsMeters, modelDatumElevationMeters } = terrain;
  const u = (x - origin[0]) / stepMeters,
    v = (z - origin[1]) / stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const here = heightsMeters[j],
    next = heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * here[i] + a * here[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) -
    modelDatumElevationMeters
  );
}
function curtainHeight(x) {
  const up = 1 - Math.max(0, Math.min(1, (x + 31) / 101));
  return heightEastCurtain + (heightWestCurtain - heightEastCurtain) * up;
}
function wallSection(out, F, start, end, y0, y1, top0, top1, width, pigment) {
  const right = 0.37,
    left = -width;
  const A = F.P(start, y0, right),
    B = F.P(end, y1, right),
    C = F.P(end, top1, right - 0.31),
    D = F.P(start, top0, right - 0.31);
  const a = F.P(start, y0, left),
    b = F.P(end, y1, left),
    c = F.P(end, top1, left + 0.36),
    d = F.P(start, top0, left + 0.36);
  quad4(out, 'masonry', A, B, C, D, pigment);
  quad4(out, 'masonry', b, a, d, c, pigment);
  quad4(out, 'adobe', D, C, c, d, lighter);
}
const notch = (i, j) => ((i * 13 + j * 11) % 17) / 16;
function wallRun(out, F, start, end, index, lod, customHeight) {
  const n = Math.max(2, Math.ceil((end - start) / (lod > 1 ? 3.1 : lod === 1 ? 4.8 : 14.0)));
  const width = customHeight === undefined ? 2.85 : 2.1;
  const section = Array.from({ length: n + 1 }, (_, i) => {
    const u = start + ((end - start) * i) / n;
    const [x, , z] = F.P(u, 0, -0.84);
    const y = grade(x, z);
    const height = customHeight ?? curtainHeight(x);
    return { u, y, top: y + height + 1.28 * (notch(index, i) - 0.5) };
  });
  for (let i = 0; i < n; i++) {
    const a = section[i],
      b = section[i + 1];
    wallSection(
      out,
      F,
      a.u,
      b.u,
      a.y - 2.2,
      b.y - 2.2,
      a.top,
      b.top,
      width,
      i % 4 === 1 ? mud : sandstone,
    );
    if (lod > 0 && i % 3 === 0) {
      const u = (a.u + b.u) / 2;
      const y = (a.top + b.top) / 2 - 2.1;
      fbox(out, 'recess', F, u - 0.16, u + 0.16, y, y + 0.8, 0.09, 0.107, dark);
    }
    if (lod > 1 && (i + index) % 4 === 0) {
      const u = a.u + (b.u - a.u) * 0.31;
      const y = (a.top + b.top) / 2;
      fbox(out, 'adobe', F, u - 0.34, u + 0.47, y - 0.12, y + 0.61, -1.27, -0.04, eroded);
    }
  }
}
function entrance(out, F, u, lod) {
  const [x, , z] = F.P(u, 0, -0.5);
  const y = grade(x, z);
  const archW = 3.6;
  fbox(out, 'footing', F, u - 3.0, u + 3.0, y - 0.21, y + 0.02, -4.0, 1.82, eroded);
  fbox(out, 'masonry', F, u - 3.15, u - archW / 2, y - 0.8, y + heightGate, -2.7, 0.46, mud);
  fbox(out, 'masonry', F, u + archW / 2, u + 3.15, y - 0.8, y + heightGate, -2.7, 0.46, mud);
  const archBase = y + 2.35;
  const segments = lod > 1 ? 12 : 6;
  for (let i = 0; i < segments; i++) {
    const a = Math.PI - (i * Math.PI) / segments,
      b = a - Math.PI / segments;
    const first = u + (archW / 2) * Math.cos(a),
      second = u + (archW / 2) * Math.cos(b);
    const lowA = archBase + 1.8 * Math.sin(a),
      lowB = archBase + 1.8 * Math.sin(b);
    wallSection(out, F, first, second, lowA, lowB, y + heightGate, y + heightGate, 2.7, mud);
    if (lod > 0)
      quad4(
        out,
        'adobe',
        F.P(first, lowA, 0.45),
        F.P(second, lowB, 0.45),
        F.P(second, lowB + 0.39, 0.45),
        F.P(first, lowA + 0.39, 0.45),
        lighter,
      );
  }
  fbox(
    out,
    'adobe',
    F,
    u - 3.22,
    u + 3.22,
    y + heightGate - 0.28,
    y + heightGate + 0.04,
    -2.82,
    0.48,
    lighter,
  );
}
function roundTower(out, x, z, r, height, battered, lod, variation) {
  const sides = [8, 14, 18, 24][lod];
  const min = grade(x, z) - 2.35;
  const h = height + 2.35;
  const y = min + h;
  const center = [x, z];
  const ring = (level, radius) => radialRing(level, radius, radius, sides, center, 0.1);
  if (lod === 0) {
    const upper = ring(y, r * battered);
    loft(out, 'masonry', [ring(min, r), upper], sandstone, { cap: false });
    for (let i = 0; i < sides; i++)
      tri(out, 'adobe', upper[(i + 1) % sides], upper[i], [x, y, z], mud);
    return;
  }
  loft(out, 'footing', [ring(min, r * 1.035), ring(min + h * 0.38, r * 0.994)], eroded, {
    cap: false,
  });
  loft(out, 'masonry', [ring(min + h * 0.38, r * 0.994), ring(y - 0.52, r * battered)], sandstone, {
    cap: false,
  });
  const upper = ring(y, r * battered);
  const middle = ring(y - 0.6, r * battered * 0.68);
  const irregular = upper.map(([x, yy, z], i) => [x, yy + 1.04 * (notch(variation, i) - 0.45), z]);
  loft(out, 'adobe', [ring(y - 0.52, r * battered), irregular, middle], mud, { cap: false });
  const top = [x, y - 0.62, z];
  for (let i = 0; i < sides; i++)
    tri(out, 'adobe', middle[(i + 1) % sides], middle[i], top, eroded);
  if (lod > 0) {
    const count = lod > 1 ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const a = (2 * Math.PI * i) / count;
      const nx = Math.cos(a),
        nz = Math.sin(a);
      const outside = r * (battered + 0.09);
      const F = facade([x + outside * nx, z + outside * nz], [nz, -nx]);
      const offset = (notch(variation, i) - 0.5) * 1.32;
      opening(out, F, 0, y - 3.3 + offset, r * 0.1, 0.62 + (i % 2) * 0.44, {
        glassSlot: 'recess',
        glass: dark,
        frameWidth: 0,
        sill: false,
        d: 0.015,
      });
      if (lod === 3 && i % 3 === 0)
        fbox(out, 'adobe', F, -0.38, 0.38, y - 1.42, y - 1.19, -0.41, -0.12, lighter);
    }
  }
}
function curtain(out, lod) {
  const gateIndex = perimeter.findIndex((p, i) => {
    const q = perimeter[(i + 1) % perimeter.length];
    return p[0] > 70 && q[0] > 70;
  });
  const towerRadii = [4.65, 4.25, 5.05, 5.58, 4.6, 4.8, 4.65, 4.25];
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length];
    const F = wallFace(a, b);
    if (i === gateIndex) {
      const u = Math.abs(a[1] - eastGate[1]);
      wallRun(out, F, 0, u - 2.94, i, lod);
      entrance(out, F, u, lod);
      wallRun(out, F, u + 2.94, F.length, i + 11, lod);
    } else {
      wallRun(out, F, 0, F.length, i, lod);
    }
    const [x, z] = a;
    const radius = towerRadii[i];
    const dest = F.P(0, 0, -0.49);
    const prominent = z > 34 && x < 0;
    roundTower(
      out,
      dest[0],
      dest[2],
      radius + (prominent ? 0.6 : 0),
      curtainHeight(x) + (prominent ? 2.58 : 1.18),
      0.85,
      lod,
      i,
    );
  }
}
function terraces(out, lod) {
  const westOuter = facade([-38.6, 18.7], [0, -1]);
  wallRun(out, westOuter, 0, 32.1, 23, lod, 4.8);
  const connection = wallFace([-38.5, 18.7], [-10.25, 22.8]);
  wallRun(out, connection, 0, connection.length, 24, lod, 4.6);
  const innerWall = wallFace([-9.2, 20.6], [-5.4, -36.2]);
  wallRun(out, innerWall, 0, innerWall.length, 25, lod, 3.15);
  const lowerWall = wallFace([32.4, 19.0], [30.0, -45.2]);
  wallRun(out, lowerWall, 0, lowerWall.length, 26, lod, 2.15);
  roundTower(out, -31.1, 10.0, 4.2, 13.35, 0.74, lod, 23);
  if (lod > 0) {
    const raised = wallFace([-31.0, 9.5], [-23.1, -12.15]);
    wallRun(out, raised, 0, raised.length, 28, lod, 3.75);
    const westTower = wallFace([-36.3, -27.6], [-21.4, -28.1]);
    wallRun(out, westTower, 0, westTower.length, 29, lod, 3.36);
  }
}
function build(out, lod) {
  curtain(out, lod);
  terraces(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'furg-citadel-model.mjs';
const camera = [-132, 64, 178];
const lookAt = [2, 13, -1];
export const model = {
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
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Forg’s ridge-top citadel, with an uneven earthen perimeter, round battered towers, the higher western compound, and the lower eastern gate.',
  camera,
  lookAt,
  sunDirection: [-24, 47, 20],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.89,
    basis:
      'Bounded to the separately mapped castle enclosure. Forg village lies outside this footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-escarpment-and-west-towers', position: camera, lookAt },
    { name: 'eastern-gateway-and-curtain', position: [156, 32, -6], lookAt: [48, 6, 2] },
    { name: 'irregular-enclosure-from-above', position: [49, 164, 76], lookAt: [13, 9, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'furg-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.9,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.8, surfaces },
      street: { export: 'street', errorMeters: 0.28, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
