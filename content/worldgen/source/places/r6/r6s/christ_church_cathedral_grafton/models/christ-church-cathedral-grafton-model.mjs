import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/christ-church-cathedral-grafton-shape-controls');
const church = outwardRing(shape.outline);
const front = wallFace(...shape.mainFacade);
const porchDepth = 2.95;
const core = church.map(([x, z]) => [x, Math.min(z, front.origin[1] - porchDepth)]);
const brick = rgb('9c604d');
const reliefBrick = rgb('ac7058');
const brickEdge = rgb('b57a60');
const slate = rgb('535863');
const slateLight = rgb('626975');
const lead = rgb('636463');
const window = rgb('4b5351');
const timber = rgb('57463a');
const paving = rgb('a09a88');
const copper = rgb('58675e');

const surfaces = {
  masonry: { slot: 'wall', graph: 'brick', roughness: 0.965 },
  decoration: { slot: 'trim', graph: 'brick', roughness: 0.945 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.975 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.93 },
  flashings: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
};

function cap(out, polygon, y) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'slate',
      'palette:#ffffff',
      outwardRing(polygon),
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      slate,
    )
  )
    throw Error('Grafton cathedral roof could not be triangulated');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const asPoint = (k) => Array.from(positions.slice(3 * k, 3 * k + 3));
    tri(out, 'slate', asPoint(indices[i]), asPoint(indices[i + 1]), asPoint(indices[i + 2]), slate);
  }
}

function louvers(out, face, u, y, width, height, level, depth = 0.055) {
  const rise = width * 0.73;
  opening(out, face, u, y, width, height, {
    head: 'pointed',
    rise,
    glassSlot: 'shade',
    glass: window,
    d: depth,
    frameSlot: 'decoration',
    frame: brickEdge,
    frameWidth: level >= 2 ? 0.16 : 0,
    frameDepth: depth + 0.082,
    sill: level >= 2,
    mullions: level >= 2 && width > 1.55 ? 1 : 0,
    mullionColor: reliefBrick,
  });
  if (level === 3) {
    for (let t = 0.19; t < height - rise - 0.07; t += 0.33)
      fbox(
        out,
        'flashings',
        face,
        u - width * 0.44,
        u + width * 0.44,
        y + t,
        y + t + 0.045,
        depth,
        depth + 0.06,
        lead,
      );
  }
}

function brickButtress(out, face, u, y, height, width, depth, level) {
  const steps = level === 3 ? 3 : level >= 1 ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    fbox(
      out,
      'masonry',
      face,
      u - width / 2,
      u + width / 2,
      y + t * height,
      y + ((i + 1) * height) / steps,
      -0.052,
      depth * (1 - t * 0.74),
      i % 2 === 0 ? brick : reliefBrick,
    );
    if (level >= 2)
      fbox(
        out,
        'decoration',
        face,
        u - width * 0.53,
        u + width * 0.53,
        y + ((i + 1) * height) / steps - 0.16,
        y + ((i + 1) * height) / steps,
        -0.039,
        depth * (1 - t * 0.74) + 0.07,
        brickEdge,
      );
  }
}

function nave(out, level) {
  extrude(out, 'stone', core, -0.55, 0.72, paving, { top: false });
  extrude(out, 'masonry', core, 0.68, 7.58, brick, { top: false });
  cap(out, core, 7.59);
  abox(out, 'masonry', [-4.4, 7.5, -23.65], [5.91, 10.11, 20.86], brick, { bottom: false });
  abox(out, 'masonry', [-6.03, 7.48, 20.43], [5.63, 11.2, 20.88], brick, { bottom: false });
  gableRoof(out, 'slate', [0.755, -23.62], [0.755, 13.9], 10.29, 10.14, 17.77, slate, {
    overhang: 0.23,
    endSlot: 'masonry',
    endColor: reliefBrick,
  });
  const porchCenter = front.P(front.length / 2, 0)[0];
  gableRoof(out, 'slate', [porchCenter, 13.45], [porchCenter, 23.62], 21.57, 7.61, 17.51, slate, {
    overhang: 0.26,
    endSlot: 'masonry',
    endColor: brick,
    ends: [false, true],
  });
  gableRoof(out, 'slate', [6.65, -9.08], [17.64, -9.08], 9.01, 7.61, 11.92, slateLight, {
    overhang: 0.17,
    endSlot: 'masonry',
    endColor: reliefBrick,
  });
  gableRoof(out, 'slate', [-8.97, -8.04], [-3.94, -8.04], 9.87, 7.61, 11.28, slateLight, {
    overhang: 0.18,
    endSlot: 'masonry',
    endColor: reliefBrick,
  });
  gableRoof(out, 'slate', [0.42, -23.64], [0.42, -12.98], 16.35, 7.59, 13.11, slate, {
    overhang: 0.25,
    endSlot: 'masonry',
    endColor: reliefBrick,
  });
  if (level === 0) return;
  const east = wallFace(shape.rearFacade[0], shape.rearFacade[1]);
  for (const i of [-1, 0, 1])
    louvers(out, east, east.length * 0.5 + i * 2.1, 3.39, 1.42, i === 0 ? 7.04 : 5.27, level);
  for (const [a, b, count] of [
    [[10.31, 20.79], [10.3, -4.57], 5],
    [[8.59, -13.55], [8.58, -23.75], 2],
    [[-11.25, 14.06], [-11.26, 20.85], 1],
    [[-5.76, -3.03], [-5.76, 14.06], 4],
    [[-7.64, -23.74], [-7.64, -12.96], 2],
    [[17.74, -4.58], [17.74, -13.56], 2],
    [[-9.15, -12.95], [-9.15, -3.03], 2],
  ]) {
    const f = wallFace(a, b);
    for (let i = 0; i < count; i++) {
      const span = f.length / count;
      louvers(out, f, (i + 0.5) * span, 2.91, Math.min(1.37, span * 0.44), 3.62, level);
      if (level >= 2)
        brickButtress(out, f, Math.max(0.28, i * span + 0.2), 0.62, 7.04, 0.55, 0.48, level);
    }
    if (level >= 2) fbox(out, 'flashings', f, 0.02, f.length - 0.02, 7.52, 7.65, 0, 0.13, copper);
  }
  const northClerestory = wallFace([-4.405, -21.1], [-4.403, 18.4]);
  const southClerestory = wallFace([5.915, 18.41], [5.92, -21.1]);
  for (const f of [northClerestory, southClerestory])
    for (let bay = 0; bay < 8; bay++)
      louvers(out, f, ((bay + 0.5) * f.length) / 8, 8.06, 0.72, 1.71, level, 0.036);
}

function westPorch(out, level) {
  const u = front.length * 0.5;
  const spring = 5.13;
  const openingWidth = 5.47;
  const rise = 6.72;
  const ground = 0.51;
  const peak = 17.48;
  const limit = (x) => peak - ((peak - 7.58) * Math.abs(x - u)) / u;
  const steps = level === 0 ? 3 : level === 1 ? 4 : level === 2 ? 6 : 10;
  const profile = pointedArch(openingWidth, rise, steps);
  const innerRim = pointedArch(openingWidth + 0.25, rise + 0.31, steps);
  const outerRim = pointedArch(openingWidth + 0.58, rise + 0.71, steps);
  const skinDepth = 0.041;
  for (let i = 0; i < profile.length - 1; i++) {
    const P = ([dx, y], d) => front.P(u + dx, spring + y, d);
    const [a, b] = [profile[i], profile[i + 1]];
    const [j, k] = [innerRim[i], innerRim[i + 1]];
    const [p, q] = [outerRim[i], outerRim[i + 1]];
    quad4(
      out,
      'masonry',
      P(a, skinDepth),
      P(b, skinDepth),
      front.P(u + b[0], limit(u + b[0]), skinDepth),
      front.P(u + a[0], limit(u + a[0]), skinDepth),
      brick,
    );
    quad4(
      out,
      'masonry',
      P(a, -porchDepth),
      P(b, -porchDepth),
      P(b, skinDepth),
      P(a, skinDepth),
      brick,
    );
    quad4(
      out,
      'decoration',
      P(j, 0.15),
      P(k, 0.15),
      P(q, 0.19),
      P(p, 0.19),
      level === 3 && i % 3 === 0 ? reliefBrick : brickEdge,
    );
    if (level >= 1) {
      quad4(out, 'decoration', P(a, 0.11), P(b, 0.11), P(k, 0.14), P(j, 0.14), reliefBrick);
      quad4(out, 'decoration', P(a, 0.035), P(b, 0.035), P(b, 0.11), P(a, 0.11), brickEdge);
    }
  }
  for (const [x0, x1] of [
    [0, u - openingWidth],
    [u + openingWidth, front.length],
  ]) {
    fbox(out, 'masonry', front, x0, x1, ground, 7.58, -porchDepth, 0.047, brick);
    quad4(
      out,
      'masonry',
      front.P(x0, 7.56, 0.045),
      front.P(x1, 7.56, 0.045),
      front.P(x1, limit(x1), 0.045),
      front.P(x0, limit(x0), 0.045),
      brick,
    );
  }
  for (const sign of [-1, 1]) {
    const axis = u + sign * (openingWidth + 0.32);
    brickButtress(out, front, axis, ground, spring - ground, 0.64, 0.29, level);
    if (level >= 1)
      brickButtress(out, front, u + sign * (u - 0.67), ground, 9.05, 0.75, 0.63, level);
  }
  const inner = wallFace(
    [front.origin[0], front.origin[1] - porchDepth + 0.06],
    [shape.mainFacade[1][0], front.origin[1] - porchDepth + 0.06],
  );
  const sideDoors = level === 0 ? [0] : [-2.8, 0, 2.8];
  for (const offset of sideDoors) {
    opening(out, inner, u + offset, 0.53, offset === 0 ? 2.74 : 1.67, offset === 0 ? 5.01 : 3.82, {
      head: 'pointed',
      rise: offset === 0 ? 1.59 : 0.91,
      d: 0.112,
      glassSlot: 'timber',
      glass: timber,
      frameSlot: 'decoration',
      frame: brickEdge,
      frameWidth: level >= 2 ? 0.19 : 0,
      frameDepth: 0.29,
      sill: false,
      mullions: level === 3 ? 1 : 0,
      mullionColor: paving,
    });
  }
  if (level >= 1) {
    const upper = wallFace(
      [front.origin[0], front.origin[1] + 0.05],
      [shape.mainFacade[1][0], front.origin[1] + 0.05],
    );
    for (const [dx, h] of [
      [-2.11, 1.31],
      [-1.12, 2.17],
      [0, 2.74],
      [1.12, 2.17],
      [2.11, 1.31],
    ])
      louvers(out, upper, u + dx, 14.09, 0.49, h, level, 0.04);
    const [x, , z] = front.P(u, 0, 0.07);
    abox(out, 'flashings', [x - 0.067, 17.49, z - 0.084], [x + 0.067, 18.58, z + 0.084], copper);
    abox(out, 'flashings', [x - 0.35, 18.12, z - 0.07], [x + 0.35, 18.25, z + 0.07], copper);
  }
  fbox(out, 'stone', front, -0.115, front.length + 0.13, -0.21, ground, -porchDepth, 0.59, paving);
  fbox(out, 'stone', front, u - 5.67, u + 5.67, -0.18, 0.37, 0.49, 0.98, paving);
  fbox(out, 'stone', front, u - 5.81, u + 5.81, -0.18, 0.19, 0.98, 1.49, paving);
}

function build(out, level) {
  nave(out, level);
  westPorch(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'christ-church-cathedral-grafton-model.mjs';
const camera = [54, 42, 80];
const lookAt = [1, 7, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Grafton’s salmon-brick Gothic cathedral with its recessed double west arch, lancet bays and steep grey slate roofs.',
  camera,
  lookAt,
  sunDirection: [-43, 51, 72],
  mediumFiContext: {
    scale: 1.12,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: church,
    minimumCoverage: 0.9,
    basis:
      'The outer walls and attached vestries use the native footprint on the cathedral grounds.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'west-gable-and-recessed-double-arch',
      position: [-3, 5.6, 50],
      lookAt: [-0.6, 8.1, 20.6],
    },
    { name: 'handmade-brick-and-nave-bays', position: [35, 13.5, 45], lookAt: [3, 7.5, 4] },
    { name: 'slate-roofs-and-attached-vestries', position: [58, 47, -44], lookAt: [2, 7, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'christ-church-cathedral-grafton-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.087, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.038, surfaces },
    },
  },
};
