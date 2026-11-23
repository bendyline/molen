import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const footprint = outwardRing(frame.geometry.outline);
const color = {
  plaster: rgb('dbd6c6'),
  trim: rgb('e2dccb'),
  stone: rgb('92989a'),
  darkStone: rgb('777d7d'),
  roof: rgb('9a5845'),
  gutter: rgb('505853'),
  timber: rgb('356157'),
  timberLight: rgb('578274'),
  mullion: rgb('dbd9c8'),
  recess: rgb('626157'),
  glass: rgb('404a42'),
  brick: rgb('8f6358'),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  joinery: { slot: 'trim', graph: 'wood_plain', roughness: 0.84 },
  painted: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84 },
};

function panel(out, slot, face, left, right, bottom, top, depth, tone) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    tone,
  );
}

function arch(half, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const x = (2 * index) / segments - 1;
    return [x * half, spring + rise * (1 - x * x)];
  });
}

function strip(out, slot, face, u, low, high, depth, tone) {
  for (let index = 0; index + 1 < low.length; index++) {
    const at = ([x, y]) => face.P(u + x, y, depth);
    quad4(
      out,
      slot,
      at(high[index]),
      at(low[index]),
      at(low[index + 1]),
      at(high[index + 1]),
      tone,
    );
  }
}

function window(out, face, u, y, width, height, rise, level) {
  const half = width * 0.5;
  const left = u - half;
  const right = u + half;
  const spring = y + height - rise;
  const transom = rise ? spring - 0.34 : spring - 0.46;
  const archSegments = [4, 6, 8, 12][level];
  const head = arch(half, spring, rise, rise ? archSegments : 1);
  const outerHead = arch(half + 0.13, spring + 0.105, rise + (rise ? 0.035 : 0), head.length - 1);
  const glass = [[-half, y], [half, y], ...head.slice().reverse()];
  fan(
    out,
    'painted',
    glass.map(([x, h]) => face.P(u + x, h, 0.041)),
    color.glass,
  );
  strip(out, 'plaster', face, u, head, outerHead, 0.092, color.trim);
  panel(out, 'plaster', face, left - 0.13, left, y, spring + 0.106, 0.092, color.trim);
  panel(out, 'plaster', face, right, right + 0.13, y, spring + 0.106, 0.092, color.trim);
  fbox(out, 'stone', face, left - 0.135, right + 0.135, y - 0.12, y, -0.02, 0.17, color.stone);
  panel(out, 'joinery', face, left, right, transom - 0.032, transom + 0.035, 0.064, color.mullion);
  if (level === 0) return;
  const bar = (a, b, bottom, top, tone = color.mullion) =>
    panel(out, 'joinery', face, a, b, bottom, top, 0.068, tone);
  bar(u - 0.027, u + 0.027, y, rise ? spring + rise - 0.052 : spring);
  bar(left, left + 0.035, y, spring);
  bar(right - 0.035, right, y, spring);
  for (const x of [-0.5, 0.5]) {
    const v = u + x * half;
    bar(v - 0.014, v + 0.014, y, rise ? transom : spring);
    if (rise) {
      const top = face.P(u + x * half * 1.74, spring + rise * 0.24, 0.069);
      beam(out, 'joinery', face.P(u, transom, 0.069), top, 0.031, 0.036, color.mullion);
    }
  }
  for (let i = 1; i < (level > 1 ? 5 : 3); i++) {
    const height = y + ((transom - y) * i) / (level > 1 ? 5 : 3);
    bar(left, right, height - 0.016, height + 0.016);
  }
  if (!rise) return;
  fbox(
    out,
    'plaster',
    face,
    left - 0.035,
    right + 0.035,
    y - 0.41,
    y - 0.27,
    0.006,
    0.031,
    color.trim,
  );
  const markY = spring + rise + 0.155;
  const points = level < 3 ? 6 : 12;
  const rose = Array.from({ length: points }, (_, i) => {
    const theta = (2 * Math.PI * i) / points;
    const r = i % 2 ? 0.047 : 0.105;
    return face.P(u + r * Math.cos(theta), markY + r * Math.sin(theta), 0.113);
  });
  const center = face.P(u, markY, 0.16);
  for (let i = 0; i < points; i++) {
    const a = rose[i];
    const b = rose[(i + 1) % points];
    tri(out, 'plaster', a, b, center, color.trim);
  }
}

function portal(out, face, u, level, cornerAtEnd) {
  const left = cornerAtEnd ? u - 0.75 : 0;
  const right = cornerAtEnd ? face.length : u + 0.75;
  fbox(out, 'stone', face, left, right, -0.03, 3.78, 0, 0.107, color.stone);
  const inner = arch(0.48, 2.58, 0.2, level > 1 ? 10 : 6);
  fan(
    out,
    'joinery',
    [
      face.P(u - 0.48, 0.11, 0.163),
      face.P(u + 0.48, 0.11, 0.163),
      ...inner.reverse().map(([x, y]) => face.P(u + x, y, 0.163)),
    ],
    color.timber,
  );
  panel(out, 'painted', face, u - 0.49, u + 0.49, 2.98, 3.57, 0.166, color.glass);
  panel(out, 'painted', face, u - 0.74, u + 0.74, 2.82, 2.91, 0.153, color.darkStone);
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const leaf = u + side * 0.242;
    panel(out, 'painted', face, leaf - 0.146, leaf + 0.146, 0.77, 2.47, 0.179, color.glass);
    for (const x of [leaf - 0.157, leaf + 0.157]) {
      fbox(out, 'joinery', face, x - 0.012, x + 0.012, 0.21, 2.52, 0.163, 0.198, color.timberLight);
    }
    for (const y of [0.22, 0.75, 2.49]) {
      panel(
        out,
        'joinery',
        face,
        leaf - 0.165,
        leaf + 0.165,
        y,
        y + 0.027,
        0.197,
        color.timberLight,
      );
    }
  }
  if (level >= 2)
    fbox(out, 'stone', face, u - 0.58, u + 0.58, -0.022, 0.09, 0.11, 0.33, color.darkStone);
}

const as3 = ([x, z], y) => [x, y, z];
const centerX = 0.75;
const centerZ = -0.65;
function ringAt(y, xScale, zScale = xScale) {
  return footprint.map(([x, z]) => [
    centerX + (x - centerX) * xScale,
    y,
    centerZ + (z - centerZ) * zScale,
  ]);
}

function dormer(out, face, level) {
  const u = face.length * 0.51;
  const y = 7.48;
  const depth = 0.045;
  const steps = [5, 8, 10, 14][level];
  const upper = arch(0.92, y + 1.79, 0.42, steps);
  const inner = arch(0.61, y + 1.63, 0.34, steps);
  const outer = arch(0.99, y + 1.82, 0.46, steps);
  const body = (ring, d) => [
    face.P(u - ring.at(-1)[0], y, d),
    face.P(u + ring.at(-1)[0], y, d),
    ...ring
      .slice()
      .reverse()
      .map(([x, h]) => face.P(u + x, h, d)),
  ];
  const front = body(upper, depth);
  const back = body(outer, depth - 1.48);
  fan(out, 'plaster', front, color.trim);
  fan(out, 'painted', body(inner, depth + 0.024), color.glass);
  for (let i = 1; i < front.length; i++) {
    const j = (i + 1) % front.length;
    quad4(
      out,
      i === 1 || i === front.length - 1 ? 'plaster' : 'roof',
      front[i],
      back[i],
      back[j],
      front[j],
      color.roof,
    );
  }
  strip(out, 'stone', face, u, upper, outer, depth + 0.075, color.stone);
  if (level > 0) {
    for (const side of [-1, 1]) {
      const x = u + side * 0.735;
      fbox(
        out,
        'plaster',
        face,
        x - 0.047,
        x + 0.047,
        y,
        y + 1.84,
        depth,
        depth + 0.099,
        color.plaster,
      );
    }
    panel(
      out,
      'joinery',
      face,
      u - 0.026,
      u + 0.026,
      y + 0.03,
      y + 1.95,
      depth + 0.046,
      color.mullion,
    );
  }
}

function build(out, level) {
  for (let i = 0; i < footprint.length; i++) {
    const face = wallFace(footprint[i], footprint[(i + 1) % footprint.length]);
    panel(out, 'plaster', face, 0, face.length, -0.27, 7.24, 0, color.plaster);
    panel(out, 'stone', face, 0, face.length, -0.28, 0.91, 0.038, color.stone);
    if (i === 2) {
      panel(out, 'stone', face, 0, face.length, 0, 3.78, 0.05, color.stone);
      continue;
    }
    if (i !== 1 && i !== 3) continue;
    const bays = i === 3 ? 5 : 3;
    for (let j = 0; j < bays; j++) {
      const u = (face.length * (j + 0.5)) / bays;
      window(out, face, u, 4.36, 1.18, 2.37, 0.25, level);
      if ((i === 1 && j === bays - 1) || (i === 3 && j === 0)) portal(out, face, u, level, i === 1);
      else window(out, face, u, 1.06, 1.0, 2.47, 0, level);
      if (level < 2 || j === 0) continue;
      const division = (face.length * j) / bays;
      panel(
        out,
        'plaster',
        face,
        division - 0.071,
        division + 0.071,
        3.84,
        7.08,
        0.028,
        color.trim,
      );
    }
  }
  fan(out, 'stone', ringAt(-0.28, 1).reverse(), color.stone);
  loft(out, 'plaster', [ringAt(7.0, 1), ringAt(7.16, 1.04), ringAt(7.29, 1.04)], color.trim, {
    cap: false,
  });
  loft(out, 'painted', [ringAt(7.29, 1.06), ringAt(7.42, 1.08)], color.gutter, { cap: false });
  const top = ringAt(plan.dimensions.measuredDsmRoofP90M + 0.13, 0.64, 0.16);
  loft(out, 'roof', [ringAt(7.42, 1.08), ringAt(11.52, 0.77, 0.42), top], color.roof, {
    cap: false,
  });
  fan(out, 'roof', top, color.roof);
  dormer(out, wallFace(footprint[3], footprint[4]), level);
  const chimney = plan.dimensions.measuredDsmRoofMaximumM;
  abox(out, 'brick', [2.93, 10.78, -1.45], [3.75, chimney - 0.14, -0.94], color.brick);
  abox(
    out,
    'stone',
    [2.86, chimney - 0.14, -1.53],
    [3.82, chimney - 0.015, -0.86],
    color.darkStone,
  );
  if (level >= 2) {
    for (const x of [3.08, 3.58]) {
      abox(
        out,
        'painted',
        [x - 0.105, chimney - 0.015, -1.29],
        [x + 0.105, chimney + 0.07, -1.1],
        color.gutter,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'het-schipke-model.mjs';
const camera = [-18, 13, 21];
const lookAt = [0.85, 6.35, -0.25];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Het Schipke',
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'Het Schipke with its paired corner entrances, five Rococo bays and clay-tiled mansard.',
  camera,
  lookAt,
  sunDirection: [-46, 73, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native OpenStreetMap outline of the individually listed Het Schipke corner house.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'tile_ceramic',
    'brick_flemish',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'old-carillon-school-corner', position: [-15.1, 5.3, 12.4], lookAt: [-0.4, 5.4, 0.5] },
    { name: 'five-bay-frederik-de-merodestraat', position: [8, 7, 18], lookAt: [1, 5.8, 1] },
    { name: 'clipped-mansard-and-dormer', position: [-5, 15, 16], lookAt: [1, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'het-schipke-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.16, surfaces },
      street: { export: 'street', errorMeters: 0.062, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.024, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Mapped geometry under ODbL and Flemish elevation data under its published open-data terms.',
};
