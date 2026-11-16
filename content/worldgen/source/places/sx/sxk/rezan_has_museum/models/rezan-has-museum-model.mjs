/** The Rezan Has Museum entrance and former Cibali factory C Block. All sizes are meters. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const field = read('terrain-grid.json');
const {
  walkHeight,
  plinthTop,
  facadeTop,
  lowerProjectionTop,
  roofRidge,
  floors,
  mainRoof,
  eaveDepth,
} = plan.section;
const outline = frame.geometry.outline;
const upperOutline = [...outline.slice(0, 8), ...outline.slice(12)];
const lowerOutline = outline.slice(7, 13);
const facing = plan.section.frontEdge;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.6 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.74 },
};
const tones = Object.fromEntries(
  Object.entries({
    body: 'b68165',
    warm: 'ae765d',
    shadow: '886858',
    mortar: 'bda18a',
    base: 'aaa094',
    pale: 'cbc0a8',
    eave: 'a69983',
    tile: 'ad7462',
    tileDark: '946454',
    ridge: 'a1695a',
    glazing: '47534d',
    shadowGlass: '3b4944',
    glassLight: '59605a',
    wood: '796554',
    metal: '63645c',
    dark: '52564e',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const block = (out, slot, x0, x1, y0, y1, z0, z1, tone) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], tones[tone]);
const panel = (out, slot, x0, x1, y0, y1, z, tone) =>
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tones[tone],
  );

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters,
    v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = field.heightsMeters[j],
    b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function clockwise(points) {
  const area = points.reduce((sum, [x, z], i) => {
    const [u, v] = points[(i + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? points : points.toReversed();
}

function cap(out, ring, y) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      tones.tileDark,
    )
  )
    throw Error('The Cibali roof outline must triangulate');
  const { indices, positions } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (n) =>
      Array.from(positions.slice(n * 3, n * 3 + 3)),
    );
    triangle(out, 'roof', p, tones.tileDark);
  }
}

function segment(out, slot, x, base, spring, halfWidth, rise, z, inset, lod) {
  const fill = inset ? 'shadowGlass' : 'glazing';
  const n = [2, 6, 8, 12][lod];
  const point = (i, margin = 0, depth = 0) => {
    const t = (Math.PI * i) / n;
    return [
      x - (halfWidth + margin) * Math.cos(t),
      spring + (rise + margin) * Math.sin(t),
      z + depth,
    ];
  };
  panel(out, slot, x - halfWidth, x + halfWidth, base, spring, z, fill);
  for (let i = 0; i < n; i++) {
    const a = point(i),
      b = point(i + 1);
    triangle(out, slot, [[x, spring, z], b, a], tones[fill]);
    if (lod > 0) {
      face(out, 'brick', [b, point(i + 1, 0, 0.28), point(i, 0, 0.28), a], tones.shadow);
      face(
        out,
        'trim',
        [
          point(i, 0, 0.29),
          point(i, 0.135, 0.34),
          point(i + 1, 0.135, 0.34),
          point(i + 1, 0, 0.29),
        ].toReversed(),
        tones.mortar,
      );
    }
  }
  if (lod === 0) return;
  face(
    out,
    'trim',
    [
      [x - halfWidth, base, z],
      [x - halfWidth, base, z + 0.28],
      [x + halfWidth, base, z + 0.28],
      [x + halfWidth, base, z],
    ],
    tones.mortar,
  );
  for (const sign of [-1, 1]) {
    const x0 = x + sign * halfWidth;
    const side = [
      [x0, base, z],
      [x0, base, z + 0.28],
      [x0, spring, z + 0.28],
      [x0, spring, z],
    ];
    face(out, 'brick', sign === -1 ? side.toReversed() : side, tones.shadow);
  }
  const h = spring + rise * 0.91;
  panel(out, 'metal', x - 0.033, x + 0.033, base, h, z + 0.025, 'wood');
  panel(
    out,
    'metal',
    x - halfWidth,
    x + halfWidth,
    spring - 0.07,
    spring - 0.018,
    z + 0.025,
    'wood',
  );
  if (lod >= 2) {
    for (const span of [-0.45, 0.45]) {
      const x0 = x + halfWidth * span;
      panel(out, 'metal', x0 - 0.019, x0 + 0.019, base, spring + 0.04, z + 0.035, 'wood');
    }
    block(
      out,
      'trim',
      x - halfWidth - 0.19,
      x + halfWidth + 0.19,
      base - 0.135,
      base,
      -0.012,
      0.34,
      'pale',
    );
  }
}

/** A mullioned opening with an inset glazing plane and a shaped masonry head. */
function archedBay(out, x, left, right, level, rowTop, width, lod, tone) {
  const { bottom, spring, archRise } = level;
  const half = width / 2;
  const openingLeft = x - half,
    openingRight = x + half;
  panel(out, 'brick', left, right, bottom - 0.29, bottom, 0, tone);
  panel(out, 'brick', left, openingLeft, bottom, rowTop, 0, tone);
  panel(out, 'brick', openingRight, right, bottom, rowTop, 0, tone);
  if (lod === 0) {
    panel(out, 'brick', openingLeft, openingRight, spring + archRise, rowTop, 0, tone);
    segment(
      out,
      'glass',
      x,
      bottom,
      spring + archRise * 0.3,
      half,
      archRise * 0.7,
      0.03,
      false,
      lod,
    );
    return;
  }
  const n = [2, 6, 8, 12][lod];
  const a = (i) => {
    const t = (Math.PI * i) / n;
    return [x - half * Math.cos(t), spring + archRise * Math.sin(t), 0];
  };
  for (let i = 0; i < n; i++) {
    const p = a(i),
      q = a(i + 1);
    face(out, 'brick', [p, q, [q[0], rowTop, 0], [p[0], rowTop, 0]], tones[tone]);
  }
  segment(out, 'glass', x, bottom, spring, half, archRise, -0.26, false, lod);
}

function door(out, x, lod) {
  const half = plan.section.entranceWidth / 2;
  const top = 3.88;
  panel(out, 'glass', x - half, x + half, walkHeight, top, -0.23, 'shadowGlass');
  for (const [left, right] of [
    [x - half - 0.19, x - half],
    [x + half, x + half + 0.19],
  ]) {
    block(out, 'trim', left, right, walkHeight - 0.06, top + 0.23, -0.32, 0.19, 'base');
  }
  block(out, 'metal', x - half - 0.14, x + half + 0.14, top, top + 0.21, -0.29, 0.19, 'dark');
  if (lod > 0) {
    const lights = [-2.7, -1.78, -0.89, 0, 0.89, 1.78, 2.7];
    for (const offset of lights) {
      const a = x + offset;
      panel(out, 'metal', a - 0.045, a + 0.045, walkHeight, top, -0.2, 'metal');
    }
    panel(out, 'metal', x - half, x + half, 2.91, 2.99, -0.2, 'metal');
    block(
      out,
      'metal',
      x - half - 0.2,
      x + half + 0.2,
      top + 0.23,
      top + 0.37,
      0.03,
      1.43,
      'metal',
    );
  }

  block(out, 'stone', x - half - 0.54, x + half + 0.54, -0.41, walkHeight, 0.0, 1.17, 'base');
  const steps = lod === 0 ? 2 : 4;
  for (let i = 0; i < steps; i++) {
    const y = (walkHeight * (steps - i)) / (steps + 1);
    block(
      out,
      'stone',
      x - half - 0.52,
      x + half + 0.52,
      -0.4,
      y,
      1.06 + i * 0.31,
      1.4 + i * 0.31,
      'pale',
    );
  }
  if (lod >= 2) {
    for (const a of [x - half - 0.42, x + half + 0.42]) {
      block(out, 'metal', a - 0.033, a + 0.033, 0.5, 1.49, 0.38, 0.46, 'metal');
      block(out, 'metal', a - 0.033, a + 0.033, 0.15, 1.25, 2.05, 2.13, 'metal');
      face(
        out,
        'metal',
        [
          [a - 0.037, 1.49, 0.45],
          [a + 0.037, 1.49, 0.45],
          [a + 0.037, 1.24, 2.11],
          [a - 0.037, 1.24, 2.11],
        ],
        tones.metal,
      );
    }
  }
}

function stoneCourse(out, span, lo, hi, depth, lod, tone = 'pale') {
  if (lod === 0) panel(out, 'trim', 0, span, lo, hi, depth, tone);
  else block(out, 'trim', 0, span, lo, hi, -0.05, depth, tone);
}

function facade(out, a, b, index, lod) {
  const p = outline[a],
    q = outline[b];
  const length = Math.hypot(p[0] - q[0], p[1] - q[1]);
  const wall = transform(out, Math.atan2(p[1] - q[1], q[0] - p[0]), [p[0], 0, p[1]]);
  const y0 = Math.min(ground(...p) - 0.53, plinthTop - 0.29);
  const y1 = Math.min(ground(...q) - 0.53, plinthTop - 0.29);
  const isFront = a === facing[0] && b === facing[1];
  const lower = a >= 7 && a <= 12 && b >= 7 && b <= 12;
  const top = lower ? lowerProjectionTop : facadeTop;
  const tone = index % 4 === 3 ? 'warm' : 'body';
  const count =
    length > 7.6 ? Math.max(2, Math.round(length / (isFront ? 3.41 : 4.18))) : length > 4.8 ? 1 : 0;
  const doorX = plan.section.entranceCenter - p[0];
  const doorHalf = plan.section.entranceWidth / 2;
  if (isFront) {
    face(
      wall,
      'stone',
      [
        [0, y0, 0],
        [doorX - doorHalf, mix(y0, y1, (doorX - doorHalf) / length), 0],
        [doorX - doorHalf, plinthTop, 0],
        [0, plinthTop, 0],
      ],
      tones.base,
    );
    face(
      wall,
      'stone',
      [
        [doorX + doorHalf, mix(y0, y1, (doorX + doorHalf) / length), 0],
        [length, y1, 0],
        [length, plinthTop, 0],
        [doorX + doorHalf, plinthTop, 0],
      ],
      tones.base,
    );
    panel(wall, 'brick', 0, doorX - doorHalf, plinthTop, 4.31, 0, tone);
    panel(wall, 'brick', doorX + doorHalf, length, plinthTop, 4.31, 0, tone);
    panel(wall, 'brick', doorX - doorHalf, doorX + doorHalf, 3.88, 4.31, 0, tone);
    door(wall, doorX, lod);
    if (lod > 0) {
      for (const x of [doorX - 6.16, doorX + 6.16]) {
        panel(wall, 'glass', x - 0.57, x + 0.57, 2.11, 3.48, 0.065, 'shadowGlass');
        block(wall, 'trim', x - 0.73, x + 0.73, 1.99, 2.1, -0.01, 0.33, 'pale');
      }
    }
  } else {
    face(
      wall,
      'stone',
      [
        [0, y0, 0],
        [length, y1, 0],
        [length, plinthTop, 0],
        [0, plinthTop, 0],
      ],
      tones.base,
    );
    panel(wall, 'brick', 0, length, plinthTop, 1.68, 0, tone);
  }
  if (isFront) {
    panel(wall, 'brick', 0, length, 4.31, floors[1].bottom - 0.29, 0, tone);
  }
  if (lod < 2) {
    panel(wall, 'brick', 0, length, isFront ? floors[1].bottom - 0.29 : 1.68, top, 0, tone);
    const bays = lod === 0 ? Math.floor(count * 0.62) : count;
    const rows = lower ? [floors[0], floors[1]] : floors;
    for (const [j, { bottom, spring, archRise }] of rows.entries()) {
      if ((isFront && j === 0) || (lod === 0 && j === 0 && !lower)) continue;
      for (let i = 0; i < bays; i++) {
        const x = ((i + 0.5) * length) / bays;
        segment(
          wall,
          'glass',
          x,
          bottom,
          spring,
          Math.min(0.81, (length / Math.max(1, bays)) * 0.22),
          archRise,
          0.059,
          false,
          0,
        );
        if (lod === 1) panel(wall, 'trim', x - 0.92, x + 0.92, bottom - 0.12, bottom, 0.11, 'pale');
      }
    }
  } else if (count === 0) {
    panel(wall, 'brick', 0, length, 1.68, top, 0, tone);
  } else {
    const pitch = length / count;
    const yRows = lower ? floors.slice(0, 2) : floors;
    for (const [j, r] of yRows.entries()) {
      if (isFront && j === 0) continue;
      const rowTop = j === yRows.length - 1 ? top : yRows[j + 1].bottom - 0.29;
      for (let i = 0; i < count; i++) {
        const x = (i + 0.5) * pitch;
        const width = Math.min(pitch * 0.53, j === 0 ? 1.48 : 1.71);
        archedBay(wall, x, i * pitch, (i + 1) * pitch, r, rowTop, width, lod, tone);
      }
    }
  }

  if (!isFront) stoneCourse(wall, length, 1.34, 1.58, 0.151, lod);
  stoneCourse(wall, length, 4.54, 4.73, 0.19, lod);
  if (!lower) stoneCourse(wall, length, 7.84, 8.0, 0.16, lod, 'eave');
  stoneCourse(wall, length, top - 0.39, top - 0.19, 0.14, lod, 'eave');
  stoneCourse(wall, length, top - 0.2, top + 0.09, 0.31, lod);
  if (lod >= 2 && length > 5.2) {
    const budget = Math.max(3, Math.round(length / (lod === 3 ? 0.46 : 0.73)));
    for (let i = 1; i < budget; i++) {
      const x = (i * length) / budget;
      block(wall, 'trim', x - 0.07, x + 0.07, top - 0.37, top - 0.2, 0.12, 0.31, 'eave');
    }
  }
}

function hip(out, bounds, eave, ridge, endInset, tone = 'tile') {
  const [x0, x1, z0, z1] = bounds;
  const lo = x0 - eaveDepth,
    hi = x1 + eaveDepth,
    near = z0 - eaveDepth,
    far = z1 + eaveDepth;
  const mid = (lo + hi) / 2;
  const a = [lo, eave, near],
    b = [hi, eave, near],
    c = [hi, eave, far],
    d = [lo, eave, far];
  const r0 = [mid, ridge, near + endInset],
    r1 = [mid, ridge, far - endInset];
  face(out, 'roof', [a, d, r1, r0], tones[tone]);
  face(out, 'roof', [b, r0, r1, c], tones[tone]);
  triangle(out, 'roof', [a, r0, b], tones[tone]);
  triangle(out, 'roof', [d, c, r1], tones[tone]);
}

function lean(out, x0, x1, z0, z1, y0, y1, tone) {
  const a = [x0, y0, z0],
    b = [x1, y1, z0],
    c = [x1, y1, z1],
    d = [x0, y0, z1];
  face(out, 'roof', [a, d, c, b], tones[tone]);
  if (Math.abs(y0 - y1) > 0.03) {
    const high = y0 > y1 ? a : b;
    const low = y0 > y1 ? b : a;
    const tip = [high[0], low[1], z0];
    triangle(out, 'brick', y0 > y1 ? [high, tip, low] : [high, low, tip], tones.warm);
    const p = ([x, y]) => [x, y, z1];
    triangle(
      out,
      'brick',
      y0 > y1 ? [p(high), p(low), p(tip)] : [p(high), p(tip), p(low)],
      tones.warm,
    );
  }
}

function roofs(out, lod) {
  cap(out, upperOutline, facadeTop - 0.018);
  hip(out, mainRoof, facadeTop + 0.075, roofRidge, 7.8);
  lean(out, 12.85, 20.035, -20.57, -8.95, 14.05, facadeTop + 0.08, 'tileDark');
  lean(out, 12.85, 19.83, 7.22, 17.02, 14.05, facadeTop + 0.08, 'tile');
  cap(out, lowerOutline, lowerProjectionTop + 0.07);
  const start = outline[12],
    end = outline[7];
  const above = transform(out, Math.atan2(start[1] - end[1], end[0] - start[0]), [
    start[0],
    0,
    start[1],
  ]);
  panel(
    above,
    'brick',
    0,
    Math.hypot(end[0] - start[0], end[1] - start[1]),
    lowerProjectionTop,
    facadeTop,
    0,
    'warm',
  );
  if (lod > 0) {
    const [x0, x1, z0, z1] = mainRoof;
    const x = (x0 + x1) / 2;
    block(
      out,
      'roof',
      x - 0.16,
      x + 0.16,
      roofRidge - 0.09,
      roofRidge + 0.07,
      z0 + 7.65,
      z1 - 7.65,
      'ridge',
    );
  }
}

function build(out, lod) {
  const ring = clockwise(outline);
  for (const [i, p] of ring.entries()) {
    facade(out, outline.indexOf(p), outline.indexOf(ring[(i + 1) % ring.length]), i, lod);
  }
  roofs(out, lod);
}

export const rezanSkyline = (out) => build(out, 0);
export const rezanDistrict = (out) => build(out, 1);
export const rezanStreet = (out) => build(out, 2);
export const rezanCloseup = (out) => build(out, 3);

const recipe = 'rezan-has-museum-model.mjs';
const camera = [47, 29, 63];
const lookAt = [0, 7.2, -0.5];
export const rezanModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: rezanCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'The 14-point native C Block wing opposite Cibali T5 station.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Rezan Has Museum’s wing of the former Cibali Tobacco Factory, with arched brick industrial bays, tiled roofs and the contemporary museum entrance beside the Golden Horn.',
  camera,
  lookAt,
  sunDirection: [-26, 52, 43],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.72,
    cameraYaw: 0.52,
    groundY: 0,
    focus: { center: [0, 6.9, 0] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'cibali-street-front-and-museum-door',
      position: [11, 10.0, 51],
      lookAt: [3.6, 6.5, 15.5],
    },
    {
      name: 'historic-brick-windows-and-stair',
      position: [-20, 7.2, 37],
      lookAt: [5.0, 5.3, 16.1],
    },
    { name: 'factory-roof-and-southwest-massing', position: [44, 29, -55], lookAt: [0, 8.4, -4] },
    { name: 'cibali-wing-and-street-grade', position: [-68, 26, -14], lookAt: [0, 7.3, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `cibali-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'rezanSkyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: {
      district: { export: 'rezanDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'rezanStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'rezanCloseup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on cleared CC0 Qualla museum imagery, factual institutional sources, ODbL OpenStreetMap geography and openly attributed Terrarium elevation.',
};
