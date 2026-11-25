import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/loch-maree-hotel-shape-controls');
const outline = outwardRing(site.historicalOutline);
const eave = 6.26;
const frontWing = 6.48;
const frontMain = 4;
const rear = -8.76;
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.95 },
  pane: { slot: 'window', localRef: 'palette:#475455', roughness: 0.53 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
};
const shades = {
  masonry: rgb('a2917a'),
  stones: ['a78f78', 'b19f89', '8a7d6a', '9e8b73', 'a59883', '948673'].map(rgb),
  sill: rgb('c0ab8e'),
  trim: rgb('b5a187'),
  slate: rgb('585852'),
  darkSlate: rgb('4e5150'),
  base: rgb('867566'),
  timber: rgb('615443'),
  glass: rgb('454d4c'),
};

function rectangle(out, face, slot, left, right, bottom, top, depth, tint) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    tint,
  );
}

function window(out, face, lod, opening) {
  const { u, y, width, height, pair = false, door = false } = opening;
  const left = u - width / 2;
  const right = u + width / 2;
  const top = y + height;
  rectangle(
    out,
    face,
    door ? 'timber' : 'pane',
    left,
    right,
    y,
    top,
    0.035,
    door ? shades.timber : shades.glass,
  );
  if (!lod) return;
  for (const x of [left, right]) {
    fbox(out, 'stone', face, x - 0.074, x + 0.075, y - 0.015, top, -0.02, 0.105, shades.trim);
  }
  fbox(
    out,
    'stone',
    face,
    left - 0.14,
    right + 0.14,
    top - 0.016,
    top + 0.18,
    -0.018,
    0.127,
    shades.sill,
  );
  if (door) {
    fbox(out, 'timber', face, u - 0.035, u + 0.035, y + 0.12, top - 0.11, 0.037, 0.08, shades.trim);
    return;
  }
  fbox(
    out,
    'stone',
    face,
    left - 0.16,
    right + 0.16,
    y - 0.18,
    y - 0.004,
    -0.026,
    0.18,
    shades.sill,
  );
  fbox(
    out,
    'timber',
    face,
    left,
    right,
    y + height * 0.53,
    y + height * 0.53 + 0.045,
    0.032,
    0.076,
    shades.timber,
  );
  if (pair || lod > 1) {
    const thick = pair ? 0.155 : 0.055;
    fbox(
      out,
      pair ? 'stone' : 'timber',
      face,
      u - thick / 2,
      u + thick / 2,
      y,
      top,
      0.03,
      0.105,
      pair ? shades.trim : shades.timber,
    );
  }
  if (lod !== 3 || !pair) return;
  for (const x of [u - width * 0.28, u + width * 0.28]) {
    fbox(
      out,
      'timber',
      face,
      x - 0.027,
      x + 0.027,
      y + 0.05,
      top - 0.025,
      0.03,
      0.079,
      shades.timber,
    );
  }
}

function exterior(out, a, b, roofBase, openings, lod) {
  const face = wallFace(a, b);
  rectangle(out, face, 'masonry', 0, face.length, -2.7, roofBase, 0, shades.masonry);
  for (const opening of openings) window(out, face, lod, opening);
  if (lod === 0) return;
  fbox(out, 'base', face, 0.01, face.length - 0.01, -2.65, 0.32, -0.085, 0.052, shades.base);
  fbox(
    out,
    'stone',
    face,
    0.035,
    face.length - 0.034,
    roofBase - 0.18,
    roofBase - 0.019,
    -0.015,
    0.095,
    shades.trim,
  );
  if (lod < 2) return;
  const rise = lod === 3 ? 0.32 : 0.57,
    span = lod === 3 ? 0.74 : 1.26;
  for (let row = 0, y = 0.39; y < roofBase - 0.24; row++, y += rise) {
    for (let i = -1; i * span < face.length; i++) {
      const j = ((i + 1) * 11 + row * 5) % 17;
      const left = Math.max(0.018, (i + (row % 2) * 0.51) * span + j * 0.009);
      const right = Math.min(face.length - 0.02, left + span * (0.67 + j * 0.013));
      if (
        right - left < 0.11 ||
        openings.some(
          ({ u, y: low, width, height }) =>
            left < u + width / 2 + 0.18 &&
            right > u - width / 2 - 0.18 &&
            y < low + height + 0.22 &&
            y + rise > low - 0.21,
        )
      )
        continue;
      const tint = shades.stones[(i + 1 + row * 5) % shades.stones.length];
      const top = Math.min(y + rise - 0.046, roofBase - 0.197);
      if (lod === 2) rectangle(out, face, 'masonry', left, right, y, top, 0.014, tint);
      else fbox(out, 'masonry', face, left, right, y, top, -0.01, 0.034 + j * 0.0029, tint);
    }
  }
}

function windowRow(length, fraction, width, pair = false) {
  return [1.16, 3.93].flatMap((y) =>
    fraction.map((t) => ({ u: t * length, y, width, height: 1.59, pair })),
  );
}

function facade(out, lod) {
  const a = [-16.9, frontMain],
    b = [0.28, frontMain];
  const main = wallFace(a, b);
  const mainWindows = [
    ...windowRow(main.length, [0.145, 0.7], 1.57, true),
    ...windowRow(main.length, [0.435], 0.74),
  ];
  exterior(out, a, b, eave, mainWindows, lod);
  const side = wallFace([9.65, frontWing], [9.65, rear]);
  exterior(
    out,
    [9.65, frontWing],
    [9.65, rear],
    eave + 0.19,
    windowRow(side.length, [0.12, 0.52, 0.8], 0.91),
    lod,
  );
  const back = wallFace([9.65, rear], [-16.9, rear]);
  exterior(
    out,
    [9.65, rear],
    [-16.9, rear],
    eave,
    windowRow(back.length, [0.14, 0.3, 0.49, 0.66, 0.84], 1.13),
    lod,
  );
  const west = wallFace([-16.9, rear], [-16.9, frontMain]);
  exterior(
    out,
    [-16.9, rear],
    [-16.9, frontMain],
    eave,
    windowRow(west.length, [0.22, 0.7], 0.99),
    lod,
  );
  exterior(out, [0.28, frontMain], [0.28, frontWing], eave, [], lod);
  const gable = wallFace([0.28, frontWing], [9.65, frontWing]);
  exterior(
    out,
    [0.28, frontWing],
    [9.65, frontWing],
    eave + 0.19,
    [
      { u: 2.21, y: 0.46, width: 1.54, height: 2.62, door: true },
      { u: 2.21, y: 3.86, width: 0.98, height: 1.65 },
      { u: 7.43, y: 1.15, width: 0.98, height: 1.66 },
      { u: 7.43, y: 3.93, width: 0.98, height: 1.62 },
    ],
    lod,
  );
  window(out, gable, lod, { u: 4.69, y: 7.17, width: 0.81, height: 1.41 });

  const mainRoofOptions = {
    overhang: 0.22,
    endSlot: 'masonry',
    endColor: shades.masonry,
    ends: [true, false],
  };
  gableRoof(
    out,
    'slate',
    [-16.9, -2.38],
    [4.6, -2.38],
    12.76,
    eave,
    9.78,
    shades.slate,
    mainRoofOptions,
  );
  gableRoof(
    out,
    'slate',
    [4.965, 6.48],
    [4.965, rear],
    9.37,
    eave + 0.19,
    10.88,
    shades.darkSlate,
    { overhang: 0.2, endSlot: 'masonry', endColor: shades.masonry },
  );
  for (const z of [-0.6, -5.89]) {
    gableRoof(
      out,
      'slate',
      [9.65, z],
      [6.23, z],
      lod === 0 ? 2.82 : 3.02,
      6.47,
      9.21,
      shades.slate,
      { overhang: 0.18, endSlot: 'masonry', endColor: shades.masonry, ends: [true, false] },
    );
    const f = wallFace([9.651, z + 1.51], [9.651, z - 1.51]);
    window(out, f, lod, { u: 1.51, y: 6.8, width: 0.51, height: 1.14 });
  }
  abox(out, 'masonry', [-9.07, 6.58, 1.4], [-6.73, 8.25, 3.38], shades.masonry);
  gableRoof(out, 'slate', [-7.9, 3.38], [-7.9, 0.65], 2.34, 8.09, 9.26, shades.slate, {
    overhang: 0.12,
    endSlot: 'masonry',
    endColor: shades.masonry,
    ends: [true, false],
  });
  const dormer = wallFace([-9.07, 3.385], [-6.73, 3.385]);
  window(out, dormer, lod, { u: 1.17, y: 7.34, width: 0.77, height: 1.04 });

  const porch = 2.48;
  for (const x of [porch - 1.04, porch + 1.04]) {
    abox(out, 'stone', [x - 0.15, 0.46, 6.99], [x + 0.15, 3.29, 7.49], shades.trim);
  }
  gableRoof(out, 'slate', [porch, 7.64], [porch, 6.47], 2.45, 3.27, 4.54, shades.slate, {
    overhang: 0.12,
  });
  abox(out, 'stone', [porch - 1.38, 0.05, 6.43], [porch + 1.38, 0.46, 7.65], shades.trim);
  if (lod > 0) {
    abox(out, 'stone', [porch - 1.55, -0.06, 7.62], [porch + 1.55, 0.24, 7.98], shades.sill, {
      bottom: false,
    });
  }
}

function bay(out, lod) {
  const pad = outwardRing([
    [9.59, 3.78],
    [10.72, 3.18],
    [11.15, 2.79],
    [11.15, 1.07],
    [10.69, 0.6],
    [9.59, 0.11],
  ]);
  extrude(out, 'masonry', pad, -0.9, 3.73, shades.masonry, {
    topSlot: 'slate',
    topColor: shades.darkSlate,
  });
  for (const [i, a] of pad.entries()) {
    const b = pad[(i + 1) % pad.length];
    const side = wallFace(a, b);
    if (side.length < 0.51 || side.normal[0] < 0.32) continue;
    window(out, side, lod, {
      u: side.length / 2,
      y: 1.09,
      width: Math.min(0.88, side.length * 0.67),
      height: 2.035,
    });
  }
  const peak = [9.71, 4.64, 1.93];
  for (const [i, a] of pad.entries()) {
    const b = pad[(i + 1) % pad.length];
    const left = [a[0], 3.73, a[1]],
      right = [b[0], 3.73, b[1]];
    tri(out, 'slate', left, right, peak, shades.darkSlate);
  }
}

function chimneys(out, lod) {
  for (const [i, { x, z, w, h, bottom }] of [
    { x: -15.36, z: -2.53, w: 1.64, h: 11.25, bottom: 8.0 },
    { x: 0.35, z: 3.52, w: 1.23, h: 12.45, bottom: 0.42 },
    { x: 3.66, z: -5.41, w: 1.28, h: 11.83, bottom: 8.57 },
    { x: 8.93, z: -4.27, w: 1.24, h: 12.02, bottom: 6.13 },
  ].entries()) {
    abox(
      out,
      'masonry',
      [x - w / 2, bottom, z - 0.51],
      [x + w / 2, h - 0.23, z + 0.51],
      shades.stones[i],
    );
    abox(
      out,
      'stone',
      [x - w / 2 - 0.11, h - 0.27, z - 0.63],
      [x + w / 2 + 0.11, h, z + 0.63],
      shades.trim,
    );
    const pots = i === 0 ? 4 : i === 3 ? 2 : 3;
    for (let p = 0; p < pots; p++) {
      const sx = x + w * ((p + 0.5) / pots - 0.5);
      if (lod === 0) {
        abox(
          out,
          'masonry',
          [sx - 0.11, h, z - 0.114],
          [sx + 0.11, h + 0.53, z + 0.114],
          shades.base,
        );
      } else {
        tower(out, 'masonry', [sx, z], 0.112, lod === 3 ? 10 : 6, h - 0.015, h + 0.64, shades.base);
      }
    }
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  facade(out, lod);
  bay(out, lod);
  chimneys(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'loch-maree-hotel-model.mjs';
const camera = [25, 17, 38],
  lookAt = [-3.7, 5.25, 0.3];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'Loch Maree Hotel at Talladale in 1877, with slate gables, paired sash openings, chimney stacks, southeast bay and a small gabled entry porch.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [22, 31, 38],
  mediumFiContext: {
    scale: 1.0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: site.historicalOutline,
    minimumCoverage: 0.87,
    basis: 'The early hotel’s estimated envelope is aligned to the standing mapped site.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'historic-road-side-front', position: [-4.2, 7.95, 33], lookAt: [-3.7, 5.45, 4] },
    { name: 'entry-gable-and-chimneys', position: [9.4, 8.6, 19], lookAt: [2, 6.4, 6] },
    { name: 'southeast-window-bay', position: [29, 10, 9], lookAt: [6.7, 5.55, 0.9] },
    { name: 'reconstructed-loch-elevation', position: [18.5, 17, -39], lookAt: [-3.2, 5, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'loch-maree-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.47,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.087, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.021, surfaces },
    },
  },
};
