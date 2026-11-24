import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9 },
  redWall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  innerRoof: { slot: 'roof', graph: 'metal_painted', roughness: 0.89 },
  sash: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
};
const stone = rgb('d1c6af');
const cream = rgb('e5d8c0');
const shadedStone = rgb('baad96');
const sandstone = rgb('a89a83');
const red = rgb('9f5d53');
const tile = rgb('a65b48');
const metal = rgb('93917d');
const walnut = rgb('67534a');
const glass = rgb('535854');
const portalX = -3.5;
const roofY = (z) => 12 + Math.max(0, 30 - z) * 0.037;
const isFacade = (p, q, F) => p[1] > 53.7 && q[1] > 53.7 && F.normal[1] > 0.9;

function band(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function shell(out, level) {
  const outer = outwardRing(frame.geometry.outline);
  const holes = frame.geometry.holes.map((ring) => outwardRing(ring).reverse());
  for (const [ringIndex, ring] of [outer, ...holes].entries()) {
    for (const [i, p] of ring.entries()) {
      const q = ring[(i + 1) % ring.length];
      const F = wallFace(p, q);
      const length = F.length;
      const mainFront = ringIndex === 0 && isFacade(p, q, F);
      const d = mainFront ? -1.43 : 0;
      const y = roofY(p[1]),
        h = roofY(q[1]);
      quad4(
        out,
        'stone',
        F.P(0, -1.8, 0),
        F.P(length, -1.8, 0),
        F.P(length, 1.04, 0),
        F.P(0, 1.04, 0),
        sandstone,
      );
      quad4(
        out,
        mainFront ? 'redWall' : 'stone',
        F.P(0, 1.04, d),
        F.P(length, 1.04, d),
        F.P(length, h, d),
        F.P(0, y, d),
        mainFront ? red : ringIndex > 0 ? shadedStone : stone,
      );
      if (level >= 1)
        quad4(
          out,
          'trim',
          F.P(0, y - 0.37, 0.04),
          F.P(length, h - 0.37, 0.04),
          F.P(length, h + 0.05, 0.11),
          F.P(0, y + 0.05, 0.11),
          cream,
        );
      if (level === 0 || length < 4.2 || mainFront) continue;
      const rowCount = Math.max(1, Math.round(length / (level === 1 ? 8.8 : 5.5)));
      const sill = 2.4 + Math.max(0, -0.5 * (p[1] + q[1]) - 25) * 0.047;
      for (let n = 0; n < rowCount; n++) {
        const x = (length * (n + 0.5)) / rowCount;
        const width = ringIndex ? 1.17 : 1.52;
        for (const [alt, height] of [
          [sill, 2.39],
          [sill + 4.14, 2.46],
        ]) {
          if (level === 1)
            quad4(
              out,
              'glass',
              F.P(x - width / 2, alt, 0.037),
              F.P(x + width / 2, alt, 0.037),
              F.P(x + width / 2, alt + height, 0.037),
              F.P(x - width / 2, alt + height, 0.037),
              glass,
            );
          else
            opening(out, F, x, alt, width, height, {
              glassSlot: 'glass',
              glass,
              frameSlot: 'sash',
              frame: walnut,
              frameWidth: 0.091,
              frameDepth: 0.06,
              d: 0.037,
              sill: level === 3,
              mullions: 1,
              transoms: level === 3 ? 1 : 0,
            });
        }
      }
    }
  }
  const cap = new MeshBufferBuilder();
  const elevation = ([, z]) => roofY(z);
  if (
    !cap.addCap('innerRoof', 'palette:#ffffff', outer, holes, elevation, [0, 1, 0], (u) => u, metal)
  )
    throw new Error('Could not resolve the mapped museum courtyards');
  const mesh = cap.finalize();
  const point = (i) => [...mesh.positions.subarray(i * 3, i * 3 + 3)];
  for (let i = 0; i < mesh.indices.length; i += 3)
    tri(
      out,
      'innerRoof',
      point(mesh.indices[i]),
      point(mesh.indices[i + 1]),
      point(mesh.indices[i + 2]),
      metal,
    );
}

function hipped(out, x0, x1, z0, z1, y, h) {
  const at = (z) => (z + z1) * 0.5;
  const edge = Math.min(3.1, (x1 - x0) * 0.23);
  const [a, b, c, d] = [
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
    [x0, y, z0],
  ];
  const u = [x0 + edge, h, at(z0)],
    v = [x1 - edge, h, at(z0)];
  quad4(out, 'roof', a, b, v, u, tile);
  quad4(out, 'roof', c, d, u, v, tile);
  tri(out, 'roof', b, c, v, tile);
  tri(out, 'roof', d, a, u, tile);
  band(out, 'roof', u[0] - 0.11, v[0] + 0.11, u[2] - 0.12, u[2] + 0.12, h - 0.055, h + 0.11, tile);
}

function column(out, x, z, bottom, top, r, level, ionic) {
  if (level === 0) {
    lathe(
      out,
      'stone',
      [x, z],
      [
        [bottom, r, r],
        [top, r * 0.92, r * 0.92],
      ],
      5,
      cream,
      { capTop: false },
    );
    return;
  }
  const n = level === 1 ? 6 : level === 2 ? 8 : 11;
  const shaft = [
    [bottom, r * 1.07, r * 1.07],
    [bottom + 0.16, r, r],
    [top - 0.33, r * 0.85, r * 0.85],
    [top - 0.09, r * 0.97, r * 0.97],
  ];
  lathe(out, 'stone', [x, z], shaft, n, cream);
  const cap = r * (ionic ? 1.35 : 1.12);
  band(out, 'trim', x - cap, x + cap, z - cap, z + cap, top - 0.06, top + 0.145, cream);
  if (!ionic || level < 2) return;
  for (const side of [-1, 1]) {
    const center = x + side * r;
    lathe(
      out,
      'trim',
      [center, z],
      [
        [top - 0.42, r * 0.25, r * 0.43],
        [top - 0.29, r * 0.4, r * 0.49],
        [top - 0.13, r * 0.26, r * 0.37],
      ],
      8,
      stone,
    );
  }
}

function front(out, level) {
  const porch = 55.32,
    floor = 1.11;
  const left = portalX - 10.9,
    right = portalX + 10.9;
  const rear = 49.88;
  const F = facade([0, 52.64], [1, 0]);
  for (const [lo, hi] of [
    [-54.12, left],
    [right, 47.7],
  ]) {
    band(out, 'stone', lo, hi, rear, 54.35, 0.36, floor, stone);
    band(out, 'trim', lo, hi, rear, 54.31, 10.18, 11.71, cream);
    const count = level === 0 ? 10 : 19;
    for (let i = 0; i < count; i++) {
      const x = lo + 0.63 + ((hi - lo - 1.26) * i) / (count - 1);
      column(out, x, 53.76, floor, 10.32, 0.245, level, false);
    }
    if (level < 1) continue;
    const bays = level === 1 ? 4 : 10;
    for (let i = 0; i < bays; i++) {
      const x = lo + ((hi - lo) * (i + 0.5)) / bays;
      opening(out, F, x, 3.83, 0.9, 3.11, {
        glassSlot: 'glass',
        glass,
        frameSlot: 'sash',
        frame: walnut,
        frameWidth: 0.07,
        frameDepth: 0.061,
        d: 0.035,
      });
    }
  }
  band(out, 'stone', left - 0.33, right + 0.33, rear, porch + 0.1, -0.43, floor, stone);
  band(out, 'trim', left - 0.23, right + 0.23, rear, porch + 0.19, 10.91, 12.02, sandstone);
  band(out, 'stone', left - 0.41, right + 0.41, rear, porch + 0.33, 11.92, 12.37, cream);
  band(out, 'stone', left - 0.11, right + 0.11, rear, porch + 0.14, 12.37, 13.61, stone);
  band(out, 'trim', left - 0.18, right + 0.18, rear, porch + 0.25, 13.55, 13.81, cream);
  for (const x of [left + 0.49, right - 0.49]) {
    band(out, 'stone', x - 0.53, x + 0.53, rear, porch, floor, 11.06, cream);
    if (level === 3)
      band(out, 'trim', x - 0.28, x + 0.28, porch - 0.05, porch + 0.13, 8.05, 9.02, sandstone);
  }
  for (const x of [-7.28, -4.86, -2.42, 0, 2.42, 4.86, 7.28])
    column(out, portalX + x, porch - 0.46, floor, 10.96, 0.431, level, true);
  for (let i = 0; i < 5; i++) {
    const width = 15.7 - i * 0.94;
    const z = 58.9 - i * 0.63;
    band(
      out,
      'stone',
      portalX - width,
      portalX + width,
      z - 0.7,
      z,
      -0.46,
      0.1 + i * 0.245,
      i % 2 ? cream : stone,
    );
  }
  if (level < 1) return;
  const rearWall = facade([portalX, 52.3], [1, 0]);
  for (const x of [-5.33, 0, 5.33])
    opening(out, rearWall, x, 1.2, x === 0 ? 2.28 : 1.75, x === 0 ? 5.62 : 4.82, {
      glassSlot: 'sash',
      glass: walnut,
      frameSlot: 'trim',
      frame: sandstone,
      frameWidth: 0.14,
      frameDepth: 0.11,
      d: 0.062,
      mullions: level >= 2 ? 1 : 0,
      transoms: level >= 2 ? 1 : 0,
    });
  for (const [x, height] of [
    [-10.04, 1.11],
    [-7.29, 1.55],
    [7.32, 1.51],
    [10.11, 1.1],
  ]) {
    const center = portalX + x;
    const y = 13.81;
    band(out, 'trim', center - 0.31, center + 0.31, 54.53, 55.11, y, y + 0.27, sandstone);
    lathe(
      out,
      'trim',
      [center, 54.8],
      [
        [y + 0.24, 0.15, 0.127],
        [y + 0.5, 0.22, 0.18],
        [y + height * 0.65, 0.215, 0.14],
        [y + height, 0.107, 0.101],
      ],
      level >= 2 ? 8 : 6,
      sandstone,
    );
  }
}

function build(out, level) {
  shell(out, level);
  hipped(out, -55.0, 48.42, 36.05, 54.71, 11.95, 13.83);
  hipped(out, -54.55, 61.2, -71.3, -54.48, 15.6, 16.98);
  hipped(out, -51.66, 46.33, -28.69, -13.13, 14.13, 15.55);
  front(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'national-archaeological-museum-athens-model.mjs';
const camera = [-139, 68, 154];
const lookAt = [-2, 9.5, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Athens National Archaeological Museum with the Ionic garden frontage and surviving four courtyards.',
  camera,
  lookAt,
  sunDirection: [-34, 61, 52],
  mediumFiContext: {
    scale: 1.04,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.87,
    basis: 'Native named relation 2828 represents the mapped museum and its open courtyards.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'patision-garden-front', position: [-53, 18, 140], lookAt: [-3.3, 8.5, 46] },
    { name: 'ionic-entrance-and-stairs', position: [-16, 9.3, 82], lookAt: [-3.4, 6.6, 54.2] },
    { name: 'four-open-courtyards', position: [93, 64, -108], lookAt: [1, 10, -15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-archaeological-museum-athens-' + reviewLod,
    position: [-53, 20, 140],
    lookAt: [-3, 8.6, 46],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.28, surfaces },
      street: { export: 'street', errorMeters: 0.102, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.044, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by Mustang Joe’s exact CC0 exterior photo, the named OpenStreetMap building footprint and Copernicus numeric terrain.',
};
