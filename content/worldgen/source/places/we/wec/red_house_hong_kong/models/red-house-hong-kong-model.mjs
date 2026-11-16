/** Hung Lau at Tuen Mun, reconstructed from the native outline and heritage appraisal. */
import { readFileSync } from 'node:fs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const { mainVolume, frontVerandah, rearAnnex } = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.08 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'b77f75',
    left: 'bd8880',
    right: 'b8847b',
    soft: 'c89489',
    sill: 'b68c80',
    surround: 'c3a092',
    rail: 'bd9789',
    wood: '6b5549',
    recess: '434e4a',
    windowFrame: '7c8274',
    glass: '627170',
    opaque: '4f6464',
    roof: '896b5a',
    roofEdge: '725f54',
    tile: '885d51',
    foundation: '9b8e7e',
    tread: 'a99a88',
    interior: 'a47465',
  }).map(([slot, hex]) => [slot, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const at = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const xyz = ([x, z], y) => [x, y, z];
const wallFrame = (out, a, b) =>
  transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
const panel = (out, slot, x0, x1, y0, y1, z, tint) =>
  face(
    out,
    slot,
    [
      [x1, y0, z],
      [x0, y0, z],
      [x0, y1, z],
      [x1, y1, z],
    ],
    tint,
  );

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}

function stonePlinth(out, points, floor, lod) {
  for (let i = 0; i < points.length; i++) {
    const from = points[i],
      to = points[(i + 1) % points.length];
    const length = Math.hypot(from[0] - to[0], from[1] - to[1]);
    const count = lod === 0 ? 1 : Math.ceil(length / 2.8);
    for (let j = 0; j < count; j++) {
      const a = at(from, to, j / count),
        b = at(from, to, (j + 1) / count);
      const low = (p) => Math.min(floor - 0.38, ground(p) - 0.64);
      face(
        out,
        'stone',
        [xyz(b, low(b)), xyz(a, low(a)), xyz(a, floor), xyz(b, floor)],
        tone.foundation,
      );
    }
  }
}

function simpleRoof(out, range, eaves, ridge, lod, slotColor = tone.roof) {
  const [x0, z0, x1, z1] = range;
  const center = (z0 + z1) / 2;
  const [left, right] = [x0 - 0.39, x1 + 0.39];
  const [rear, front] = [z0 - 0.42, z1 + 0.43];
  const a = [left, eaves, rear],
    b = [left, eaves, front],
    c = [right, eaves, front],
    d = [right, eaves, rear];
  const p = [left, ridge, center],
    q = [right, ridge, center];
  face(out, 'roof', [a, p, q, d], slotColor);
  face(out, 'roof', [p, b, c, q], slotColor);
  const leftEnd = [
    [x0, eaves - 0.015, z0],
    [x0, eaves - 0.015, z1],
    [x0, ridge - 0.03, center],
  ];
  const rightEnd = [
    [x1, eaves - 0.015, z1],
    [x1, eaves - 0.015, z0],
    [x1, ridge - 0.03, center],
  ];
  triangle(out, 'wall', leftEnd, tone.left);
  triangle(out, 'wall', rightEnd, tone.right);
  if (lod > 0)
    box(
      out,
      'roof',
      [left, ridge - 0.025, center - 0.105],
      [right, ridge + 0.13, center + 0.105],
      tone.roofEdge,
    );
  if (lod > 1) {
    for (const z of [rear, front])
      box(
        out,
        'timber',
        [left, eaves - 0.13, z - 0.036],
        [right, eaves - 0.021, z + 0.036],
        tone.roofEdge,
      );
    for (const x of [left, right])
      for (const s of [-1, 1]) {
        const eaveZ = s < 0 ? rear : front;
        const pts = [
          [x, eaves - 0.12, eaveZ],
          [x, ridge - 0.05, center],
          [x, ridge - 0.16, center],
          [x, eaves - 0.23, eaveZ],
        ];
        face(out, 'timber', x === left ? pts : pts.toReversed(), tone.wood);
      }
  }
}

function window(out, x, floor, width, height, lod) {
  const half = width / 2,
    bottom = floor,
    top = floor + height;
  panel(
    out,
    'metal',
    x - half - 0.055,
    x + half + 0.055,
    bottom - 0.035,
    top + 0.055,
    -0.031,
    tone.windowFrame,
  );
  panel(out, 'metal', x - half, x + half, bottom, top, -0.042, tone.glass);
  box(
    out,
    'wall',
    [x - half - 0.18, top - 0.042, -0.34],
    [x + half + 0.18, top + 0.1, 0.018],
    tone.surround,
  );
  if (lod < 2) return;
  box(
    out,
    'wall',
    [x - half - 0.1, bottom - 0.065, -0.17],
    [x + half + 0.1, bottom + 0.026, 0.026],
    tone.sill,
  );
  const split = (left, right, y0, y1) =>
    panel(out, 'metal', left, right, y0, y1, -0.073, tone.windowFrame);
  for (const offset of [-width * 0.22, 0, width * 0.22])
    split(x + offset - 0.024, x + offset + 0.024, bottom, top);
  split(x - half, x + half, bottom + height * 0.61, bottom + height * 0.61 + 0.039);
  if (lod === 3) for (const x0 of [x - half, x + half]) split(x0 - 0.022, x0 + 0.022, bottom, top);
}

function glazedDoor(out, x, y, height, lod) {
  const w = 0.74,
    top = y + height;
  panel(out, 'timber', x - w, x + w, y, top, -0.029, tone.wood);
  panel(
    out,
    'metal',
    x - w + 0.13,
    x + w - 0.13,
    y + height * 0.45,
    top - 0.135,
    -0.044,
    tone.opaque,
  );
  if (lod > 1) {
    panel(out, 'timber', x - 0.035, x + 0.035, y, top, -0.067, tone.wood);
    panel(
      out,
      'timber',
      x - 0.57,
      x + 0.57,
      y + height * 0.72,
      y + height * 0.75,
      -0.067,
      tone.wood,
    );
    for (const hand of [-0.09, 0.09])
      box(
        out,
        'metal',
        [x + hand - 0.027, y + height * 0.38, -0.11],
        [x + hand + 0.027, y + height * 0.41, -0.061],
        tone.windowFrame,
      );
  }
}

function buildHouse(out, lod) {
  const { limitsXZ, floorY, intermediateFloorY, eavesY, ridgeY } = mainVolume;
  const [x0, z0, x1, z1] = limitsXZ;
  const rise = intermediateFloorY - floorY;
  const fp = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  stonePlinth(out, fp, floorY, lod);
  const join = (x0 + x1) / 2;
  box(out, 'wall', [x0, floorY, z0], [join, eavesY, z1], tone.left);
  box(out, 'wall', [join, floorY, z0], [x1, eavesY, z1], tone.right);
  if (lod > 0)
    box(
      out,
      'wall',
      [x0 - 0.045, eavesY - 0.17, z0 - 0.052],
      [x1 + 0.045, eavesY + 0.035, z1 + 0.052],
      tone.surround,
    );
  simpleRoof(out, limitsXZ, eavesY, ridgeY, lod);
  const back = wallFrame(out, fp[0], fp[1]);
  const east = wallFrame(out, fp[1], fp[2]);
  const front = wallFrame(out, fp[2], fp[3]);
  const west = wallFrame(out, fp[3], fp[0]);
  for (const y of [floorY, intermediateFloorY]) {
    for (const x of [1.65, 3.3, 14.45, 16.25]) window(front, x, y + 0.85, 0.95, 1.35, lod);
    for (const x of [1.55, 4.42, 12.47, 15.35]) window(back, x, y + 1.02, 0.99, 1.27, lod);
    for (const r of [east, west])
      for (const x of [2.13, 5.69]) window(r, x, y + 0.95, 1.01, 1.37, lod);
    for (const x of [6.08, 11.15]) glazedDoor(front, x, y + 0.055, rise * 0.73, lod);
  }
}

function piercedRail(out, length, y, lod) {
  if (length < 0.21) return;
  if (lod < 2) {
    box(out, 'wall', [0, y, -0.071], [length, y + 0.84, 0.064], tone.rail);
    return;
  }
  box(out, 'wall', [0, y - 0.03, -0.074], [length, y + 0.15, 0.075], tone.rail);
  box(out, 'wall', [-0.025, y + 0.73, -0.087], [length + 0.025, y + 0.86, 0.092], tone.surround);
  const divisions = Math.round(length / (lod === 3 ? 0.43 : 0.62));
  const bays = Math.max(2, divisions);
  const pitch = length / bays;
  for (let i = 0; i <= bays; i++) {
    const x = i * pitch;
    const half = 0.066;
    box(
      out,
      'wall',
      [Math.max(0, x - half), y + 0.13, -0.066],
      [Math.min(length, x + half), y + 0.75, 0.064],
      tone.rail,
    );
  }
  box(out, 'wall', [0, y + 0.4, -0.061], [length, y + 0.47, 0.062], tone.rail);
}

function frontSteps(out, x0, x1, z, y0, lod) {
  const contact = Math.min(y0 - 0.68, ground([(x0 + x1) / 2, z + 1.62]) + 0.06);
  const n = [2, 4, 7, 7][lod],
    run = 1.53;
  const yBase = contact - 0.51;
  for (let i = 0; i < n; i++) {
    const a = z + (run * i) / n,
      b = z + (run * (i + 1)) / n;
    const y = mix(y0, contact, i / n);
    box(out, 'stone', [x0, yBase, a], [x1, y, b + 0.012], tone.tread);
  }
}

function verandah(out, lod) {
  const [x0, z0, x1, z1] = frontVerandah.limitsXZ;
  const { floorY, intermediateFloorY, eavesY } = mainVolume;
  const positions = [x0 + 0.18, mix(x0, x1, 0.35), mix(x0, x1, 0.67), x1 - 0.18];
  const post = lod === 0 ? 0.21 : 0.145;
  const contact = Math.min(ground([0, z1]) - 0.68, floorY - 0.34);
  box(
    out,
    'stone',
    [x0 - 0.12, contact, z0],
    [x1 + 0.12, floorY + 0.07, z1 + 0.11],
    tone.foundation,
  );
  box(
    out,
    'timber',
    [x0 - 0.06, floorY + 0.055, z0],
    [x1 + 0.07, floorY + 0.129, z1 + 0.08],
    tone.wood,
  );
  box(
    out,
    'wall',
    [x0 - 0.084, intermediateFloorY - 0.315, z0],
    [x1 + 0.083, intermediateFloorY + 0.028, z1 + 0.088],
    tone.soft,
  );
  box(
    out,
    'timber',
    [x0 - 0.025, intermediateFloorY + 0.028, z0],
    [x1 + 0.026, intermediateFloorY + 0.1, z1 + 0.044],
    tone.wood,
  );
  for (const x of positions) {
    box(
      out,
      'wall',
      [x - post, floorY, z1 - 0.34],
      [x + post, eavesY - 0.18, z1 - 0.045],
      tone.soft,
    );
    if (lod > 0)
      for (const y of [floorY + 0.12, intermediateFloorY + 0.1]) {
        box(
          out,
          'wall',
          [x - post - 0.045, y, z1 - 0.38],
          [x + post + 0.045, y + 0.19, z1 - 0.002],
          tone.surround,
        );
      }
  }
  const width = x1 - x0;
  piercedRail(transform(out, 0, [x0, 0, z1 - 0.085]), width, intermediateFloorY + 0.095, lod);
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const rail = transform(out, (sign * Math.PI) / 2, [x, 0, sign < 0 ? z0 + 0.07 : z1 - 0.12]);
    piercedRail(rail, z1 - z0 - 0.2, intermediateFloorY + 0.095, lod);
  }

  const high = eavesY - 0.22,
    low = eavesY - 0.56;
  const a = [x0 - 0.23, high, z0 - 0.11],
    b = [x0 - 0.23, low, z1 + 0.28];
  const c = [x1 + 0.23, low, z1 + 0.28],
    d = [x1 + 0.23, high, z0 - 0.11];
  face(out, 'roof', [a, b, c, d], tone.tile);
  box(
    out,
    'wall',
    [x0 - 0.24, low - 0.18, z1 + 0.18],
    [x1 + 0.24, low + 0.008, z1 + 0.29],
    tone.surround,
  );
  frontSteps(out, mix(x0, x1, 0.18), mix(x0, x1, 0.405), z1 + 0.08, floorY + 0.08, lod);
  frontSteps(out, mix(x0, x1, 0.58), mix(x0, x1, 0.805), z1 + 0.08, floorY + 0.08, lod);
}

function annex(out, lod) {
  const [x0, z0, x1, z1] = rearAnnex.limitsXZ;
  const { floorY, intermediateFloorY } = mainVolume;
  const eave = 7.93,
    ridge = 8.62;
  const fp = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  stonePlinth(out, fp, floorY, lod);
  box(out, 'wall', [x0, floorY, z0], [x1, eave, z1], tone.plaster);
  simpleRoof(out, rearAnnex.limitsXZ, eave, ridge, lod, tone.tile);
  const back = wallFrame(out, fp[0], fp[1]);
  for (const y of [floorY + 0.93, intermediateFloorY + 0.65])
    for (const x of [1.76, 5.36]) window(back, x, y, 0.81, 1.15, lod);
  if (lod > 0)
    window(wallFrame(out, fp[1], fp[2]), 1.26, intermediateFloorY + 0.62, 0.58, 1.03, lod);
}

function build(out, lod) {
  buildHouse(out, lod);
  verandah(out, lod);
  annex(out, lod);
}
export const redHouseSkyline = (out) => build(out, 0);
export const redHouseDistrict = (out) => build(out, 1);
export const redHouseStreet = (out) => build(out, 2);
export const redHouseCloseup = (out) => build(out, 3);
const recipe = 'red-house-hong-kong-model.mjs';
const camera = [27, 18, 33],
  lookAt = [0, 5, 1];
export const redHouseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: redHouseCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Hung Lau at Tuen Mun, with a pitched red plaster main house, paired living units, a southeast verandah with pierced masonry screens, and the attached two-storey rear annex.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [38, 54, 65],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'tile_ceramic',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'paired-entrances-and-southeast-verandah',
      position: [0, 7.4, 24],
      lookAt: [0.47, 5.6, 4.96],
    },
    {
      name: 'hooded-metal-windows-and-pierced-balustrade',
      position: [14, 9.7, 18],
      lookAt: [1.4, 6.25, 3.9],
    },
    { name: 'rear-kitchen-and-storeroom', position: [14, 15, -21], lookAt: [-1.1, 7, -3.25] },
    { name: 'west-side-and-sloping-ground', position: [-22, 14, 2.1], lookAt: [-3.9, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hung-lau-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'redHouseSkyline',
    errorMeters: 0.47,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'redHouseDistrict', 0.23],
        ['street', 'redHouseStreet', 0.095],
        ['closeup', 'redHouseCloseup', 0.03],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, based on written heritage records. Native OpenStreetMap geometry under ODbL 1.0.',
};
