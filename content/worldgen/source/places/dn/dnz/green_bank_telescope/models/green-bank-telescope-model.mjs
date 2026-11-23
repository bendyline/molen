import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const dimensions = plan.dimensions;

const palette = {
  steel: rgb('e0e4e1'),
  web: rgb('aebcbb'),
  axle: rgb('8d9b99'),
  concrete: rgb('a3a29b'),
  tread: rgb('5c6462'),
  meshBack: rgb('a7afac'),
  reflector: [rgb('d1d9d9'), rgb('d7dddd'), rgb('dce1df'), rgb('d2d9db')],
};
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.13 },
  dish: { slot: 'roof', graph: 'metal_painted', roughness: 0.57, metallic: 0.19 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79 },
};
const trackY = dimensions.trackElevationMetersNAVD88 - terrain.modelDatumElevationMeters;
const axleY = trackY + dimensions.elevationAxleAboveTrackM;
const trackRadius = dimensions.trackDiameterM / 2;
const tilt = dimensions.modeledElevationDegrees * Math.PI / 180;
const sine = Math.sin(tilt);
const cosine = Math.cos(tilt);
const focus = dimensions.parentParaboloidDiameterM * dimensions.parentFocalRatio;
const dishCenter = [0, axleY + 31.4, -12.0];

function box(out, slot, x, y, z, width, height, depth, tint) {
  abox(out, slot, [x - width / 2, y, z - depth / 2], [x + width / 2, y + height, z + depth / 2], tint, {
    bottom: false,
  });
}

function strut(out, a, b, width, tint = palette.steel) {
  beam(out, 'steel', a, b, width, width, tint);
}

function section(x, y, z, halfWidth, halfDepth) {
  return [
    [x - halfWidth, y, z - halfDepth],
    [x - halfWidth, y, z + halfDepth],
    [x + halfWidth, y, z + halfDepth],
    [x + halfWidth, y, z - halfDepth],
  ];
}

function braceStack(out, sections, postWidth, level, braces = true) {
  for (let i = 0; i < sections.length; i++) {
    const here = sections[i];
    const below = sections[i - 1];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      strut(out, here[j], here[k], postWidth * 0.66, palette.web);
      if (!below) continue;
      strut(out, below[j], here[j], postWidth);
      if (braces && level > 0) {
        const a = i % 2 ? below[j] : below[k];
        const b = i % 2 ? here[k] : here[j];
        strut(out, a, b, postWidth * 0.47, palette.web);
        if (level > 2)
          strut(out, i % 2 ? below[k] : below[j], i % 2 ? here[j] : here[k],
            postWidth * 0.31, palette.web);
      }
    }
  }
}

function ringRail(out, inner, outer, y, count, tint) {
  const a = radialRing(y, inner, inner, count);
  const b = radialRing(y, outer, outer, count);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    quad4(out, 'trim', a[i], b[i], b[j], a[j], tint);
  }
}

function bearing(out, x, y, z, radius, width, level) {
  const count = level < 2 ? 10 : 18;
  const rings = [-width / 2, width / 2].map((offset) =>
    radialRing(0, radius, radius, count).map(([a, , b]) => [x + offset, y - a, z + b]));
  loft(out, 'steel', rings, palette.axle);
}

function foundation(out, level) {
  const sides = [16, 32, 48, 64][level];
  loft(out, 'base', [
    radialRing(-1.45, 35.5, 35.5, sides),
    radialRing(trackY - 0.10, 34.8, 34.8, sides),
  ], palette.concrete);
  ringRail(out, trackRadius - 0.50, trackRadius + 0.50, trackY + 0.019, sides, palette.tread);

  if (level > 0) box(out, 'base', 0, trackY - 0.09, 0, 12, 3.6, 10, palette.concrete);
  const feet = section(0, trackY + 2.25, 0, 20.05, 23.9);
  for (const [x, , z] of feet) {
    box(out, 'steel', x, trackY + 0.15, z, 5.4, 5.70, 8.7, palette.steel);
    if (level > 0) bearing(out, x, trackY + 1.16, z, 1.12, 6.15, level);
  }
  const shoulders = section(0, trackY + 26, 1.3, 15.5, 13.2);
  const head = section(0, axleY - 1.1, 0, 12, 4.2);
  const bottom = section(0, trackY + 5.8, 0, 21.3, 23.8);
  const frameSections = level === 0 ? [bottom, head] : [bottom, shoulders, head];
  braceStack(out, frameSections, 2.6, level);
  for (const x of [-12, 12]) bearing(out, x, axleY, 0, 4.3, 4.6, level);
  if (level > 0) {
    for (const side of [-1, 1]) {
      strut(out, [side * 20.6, trackY + 5.8, -23.8], [side * 15.5, trackY + 26, 14.5], 1.34);
      strut(out, [side * 15.5, trackY + 26, -11.9], [side * 12, axleY - 0.8, 4.2], 1.4);
    }
    box(out, 'steel', -10.6, trackY + 5.8, 17.4, 10.6, 5.1, 12.3, palette.steel);
  }
}

function dishPoint(r, a, depth = 0) {
  const x = r * dimensions.dishDiameterAcrossAxleM / 2 * Math.cos(a);
  const v = r * dimensions.dishLengthTowardFeedM / 2 * Math.sin(a);
  const sag = (x * x + v * v) / (4 * focus);
  return [x, dishCenter[1] - cosine * v + sine * (sag - depth),
    dishCenter[2] + sine * v + cosine * (sag - depth)];
}

function reflectiveSkin(out, level) {
  const sides = [16, 24, 40, 56][level];
  const rows = [2, 4, 6, 9][level];
  const theta = (i) => 2 * Math.PI * i / sides;
  for (let i = 0; i < sides; i++) {
    const a = theta(i);
    const b = theta((i + 1) % sides);
    const center = dishPoint(0, a);
    const pane = (j) => palette.reflector[(i + j * 3) % (level === 0 ? 1 : 4)];
    tri(out, 'dish', center, dishPoint(1 / rows, b), dishPoint(1 / rows, a), pane(0));
    tri(out, 'steel', dishPoint(0, a, 0.33), dishPoint(1 / rows, a, 0.33),
      dishPoint(1 / rows, b, 0.33), palette.meshBack);
    for (let j = 1; j < rows; j++) {
      const inner = j / rows;
      const outer = (j + 1) / rows;
      quad4(out, 'dish', dishPoint(inner, a), dishPoint(inner, b), dishPoint(outer, b),
        dishPoint(outer, a), pane(j));
      quad4(out, 'steel', dishPoint(inner, a, 0.33), dishPoint(outer, a, 0.33),
        dishPoint(outer, b, 0.33), dishPoint(inner, b, 0.33), palette.meshBack);
    }
    if (level > 0) strut(out, dishPoint(1, a, 0.5), dishPoint(1, b, 0.5), 0.48, palette.web);
  }
}

function reflectorSupport(out, level) {
  const stations = [6, 10, 16, 24][level];
  const angle = (j) => (2 * Math.PI * j) / stations;
  for (let i = 0; i < stations; i++) {
    const a = angle(i);
    const b = angle((i + 1) % stations);
    const near = dishPoint(0.19, a, 14.4);
    const middle = dishPoint(0.61, a, 10.8);
    const outer = dishPoint(1, a, 1.05);
    strut(out, near, middle, 0.97);
    strut(out, middle, outer, 0.71, palette.web);
    if (level === 0) continue;
    const adjacent = dishPoint(0.61, b, 10.8);
    strut(out, middle, adjacent, 0.64);
    strut(out, middle, dishPoint(0.61, a, 0.8), 0.54);
    strut(out, middle, dishPoint(1, b, 1.05), 0.45, palette.web);
    strut(out, near, adjacent, 0.56, palette.web);
    if (level > 1) {
      strut(out, middle, dishPoint(0.83, a, 0.8), 0.43, palette.web);
      strut(out, middle, dishPoint(0.39, a, 0.82), 0.45, palette.web);
      if (level > 2) {
        strut(out, dishPoint(0.82, a, 5.7), dishPoint(0.82, b, 5.7), 0.40, palette.web);
        strut(out, near, dishPoint(0.40, b, 1), 0.38, palette.web);
      }
    }
  }
  for (const side of [-1, 1]) {
    const a = side > 0 ? 0 : Math.PI;
    const hub = [side * 12, axleY, 0];
    strut(out, hub, dishPoint(0.49, a - 0.5, 8.4), 3.15);
    strut(out, hub, dishPoint(0.49, a + 0.5, 8.4), 3.15);
    strut(out, hub, dishPoint(0.27, a, 13.3), 2.57);
  }
}

function feedBoom(out, level) {
  const base = section(0, axleY + 8.5, 18.8, 11.0, 5.4);
  const elbow = section(0, axleY + 11.1, 52.3, 9.5, 8.1);
  const mid = section(0, axleY + 49.8, 53.2, 6.35, 5.7);
  const tip = section(0, axleY + 91.1, 47.5, 3.8, 4.7);
  const sections = level === 0 ? [base, elbow, tip] :
    [base, elbow, section(0, axleY + 24, 56, 8.7, 7.7), mid,
      section(0, axleY + 70.5, 50.3, 5.15, 5.15), tip];
  braceStack(out, sections, 1.46, level);
  for (const side of [-1, 1]) {
    const a = side > 0 ? 1.13 : 2.012;
    strut(out, [side * 10.2, axleY + 6.5, 17], dishPoint(0.63, a, 10.7), 2.29);
    strut(out, [side * 9, axleY + 11.1, 45], dishPoint(0.84, a, 4.6), 1.64);
  }
  box(out, 'steel', 0, axleY + 88.8, 44.2, 8.6, 4.85, 9.5, palette.steel);
  strut(out, [0, axleY + 91.6, 47.9], [0, axleY + 88.6, 37.4], 1.85);
  const subreflector = dimensions.subreflectorDiameterM / 2;
  const y = axleY + 88.5;
  const z = 37.4;
  const n = level > 1 ? 18 : 8;
  const rings = [radialRing(0, 1.2, 1.2, n), radialRing(0.94, subreflector, subreflector, n)]
    .map((r) => r.map(([a, b, c]) => [a, y + c * 0.52 - b * 0.85, z - c * 0.85 - b * 0.52]));
  loft(out, 'dish', rings, palette.reflector[1]);
  if (level > 1) {
    for (const side of [-1, 1]) {
      strut(out, [side * 1.4, axleY + 12.5, 61], [side * 1.4, axleY + 92, 51.8],
        0.26, palette.web);
      if (level > 2)
        strut(out, [side * 10.4, trackY + 2.9, 17.7], [side * 10.4, axleY + 1.4, 3.6],
          0.24, palette.axle);
    }
  }
}

function build(out, level) {
  foundation(out, level);
  reflectiveSkin(out, level);
  reflectorSupport(out, level);
  feedBoom(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'green-bank-telescope-model.mjs';
const camera = [-194, 103, 201];
const lookAt = [0, 66, 7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Green Bank Telescope',
  wikidataId: plan.wikidataId,
  category: 'scientific-observatory',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'Open steel radio telescope with a 100-by-110-metre asymmetrical dish, azimuth track, elevation axle and outboard feed tower.',
  camera,
  lookAt,
  sunDirection: [-42, 76, -57],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'feed-boom-and-open-frame', position: [139, 41, 135], lookAt: [0, 65, 12] },
    { name: 'reflector-and-offset-feed', position: [-122, 171, 134], lookAt: [0, 94, 9] },
    { name: 'azimuth-track-and-axle', position: [-89, 37, -74], lookAt: [0, 24, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'green-bank-telescope-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.057, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original 3D work under the repository license. Native map under ODbL and USGS bare-earth elevations in the public domain.',
};
