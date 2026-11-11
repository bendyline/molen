/** Permanent museum exterior in the former St. Nicholas Edinoverie Church. */
import fs from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const ground = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const {
  coreVertexIndices,
  porches,
  foundationBottom,
  mainFloor,
  porchCeiling,
  lowerCornice,
  upperFloor,
  upperCornice,
  cornerTop,
  dome,
} = plan.section;
const core = coreVertexIndices.map((i) => outline[i]);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.81, metallic: 0.16 },
  dark: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.68, metallic: 0.07 },
};
const color = Object.fromEntries(
  Object.entries({
    plaster: 'cca76c',
    limestone: 'e2d0a9',
    granite: '94908a',
    metal: '659176',
    roof: '586f63',
    dark: '4d5b59',
    door: '51483d',
    rail: '8eaa9c',
    frame: 'a39378',
  }).map(([key, value]) => [key, rgb(value)]),
);
const white = 'palette:#ffffff';
const inset = (ring, amount) => ring.map(([x, z]) => [x * amount, z * amount]);

function face(out, slot, points, direction, tint = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, a, i) => sum + a * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

// Control pairs in the native outline follow the clockwise perimeter.
function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [-dz, 0, dx],
    point: (u, y, p = 0) => [a[0] + dx * u - dz * p, y, a[1] + dz * u + dx * p],
  };
}

function panel(out, slot, e, a, b, y, top, depth, tint = color[slot]) {
  face(
    out,
    slot,
    [e.point(a, y, depth), e.point(b, y, depth), e.point(b, top, depth), e.point(a, top, depth)],
    e.n,
    tint,
  );
}

function windowArch(out, e, u, width, bottom, spring, lod, tint = color.dark, depth = 0.035) {
  if (!lod) {
    panel(out, 'dark', e, u - width / 2, u + width / 2, bottom, spring + width * 0.22, depth, tint);
    return;
  }
  const r = width / 2,
    n = [4, 6, 8, 12][lod],
    center = e.point(u, spring, depth);
  const arc = (a, scale, d) =>
    e.point(u + r * scale * Math.cos(a), spring + r * scale * Math.sin(a), d);
  panel(out, 'dark', e, u - r, u + r, bottom, spring, depth, tint);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(out, 'dark', [center, arc(a, 1, depth), arc(b, 1, depth)], e.n, tint);
    if (lod >= 2)
      face(
        out,
        'limestone',
        [
          arc(a, 1, depth + 0.02),
          arc(b, 1, depth + 0.02),
          arc(b, 1.13, depth + 0.02),
          arc(a, 1.13, depth + 0.02),
        ],
        e.n,
      );
  }
  if (lod) {
    const d = depth + 0.018;
    panel(out, 'limestone', e, u - r - 0.11, u - r, bottom, spring, d);
    panel(out, 'limestone', e, u + r, u + r + 0.11, bottom, spring, d);
    panel(out, 'limestone', e, u - r - 0.19, u + r + 0.19, bottom - 0.13, bottom, d + 0.07);
    if (lod >= 2) {
      panel(out, 'dark', e, u - 0.046, u + 0.046, bottom, spring + r * 0.92, d, color.frame);
      panel(out, 'dark', e, u - r, u + r, spring - 0.15, spring - 0.058, d, color.frame);
    }
  }
}

function prism(out, slot, outline, bottom, top, tint) {
  const layers = [bottom, top].map((y) => outline.map(([x, z]) => [x, y, z]));
  loft(out, slot, layers, tint);
}

function round(out, slot, center, profile, n, tint = color[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, center, Math.PI / 8)),
    tint,
    { cap },
  );
}

function doric(out, x, z, base, top, r, lod) {
  if (!lod) {
    round(
      out,
      'limestone',
      [x, z],
      [
        [base, r],
        [top, r * 0.86],
      ],
      4,
      color.limestone,
      false,
    );
    return;
  }
  const n = [0, 6, 10, 14][lod];
  round(
    out,
    'limestone',
    [x, z],
    [
      [base, r],
      [top - 0.28, r * 0.79],
    ],
    n,
    color.limestone,
    false,
  );
  box(out, 'limestone', x, top - 0.32, z, r * 2.12, 0.32, r * 2.12, color.limestone);
  if (lod > 1)
    round(
      out,
      'limestone',
      [x, z],
      [
        [top - 0.65, r * 0.77],
        [top - 0.31, r * 1.01],
      ],
      n,
      color.limestone,
      false,
    );
}

function body(out, lod) {
  prism(out, 'granite', core, foundationBottom, mainFloor + 0.1, color.granite);
  prism(out, 'plaster', core, mainFloor, lowerCornice - 0.25, color.plaster);
  prism(
    out,
    'limestone',
    inset(core, 1.017),
    lowerCornice - 0.58,
    lowerCornice + 0.09,
    color.limestone,
  );
  const upper = inset(core, 0.953);
  prism(out, 'limestone', upper, lowerCornice, upperFloor + 0.025, color.limestone);
  prism(out, 'plaster', inset(core, 0.86), lowerCornice, upperCornice, color.plaster);
  prism(out, 'limestone', upper, upperCornice - 0.56, upperCornice + 0.22, color.limestone);
  prism(out, 'metal', inset(core, 0.942), upperCornice + 0.11, upperCornice + 0.47, color.roof);
  for (const [x, z] of inset(core, 0.805)) {
    box(
      out,
      'plaster',
      x,
      lowerCornice - 0.1,
      z,
      4.46,
      cornerTop - lowerCornice + 0.1,
      4.46,
      color.plaster,
    );
    box(out, 'limestone', x, cornerTop - 0.33, z, 4.61, 0.38, 4.61, color.limestone);
    if (lod) box(out, 'metal', x, cornerTop + 0.02, z, 4.46, 0.18, 4.46, color.roof);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const lower = edge(core[i], core[j]);
    const insetWall = inset(core, 0.86),
      back = edge(insetWall[i], insetWall[j]);
    const front = edge(upper[i], upper[j]);
    const u = lower.length / 2;
    for (const [fraction, width, bottom, spring] of [
      [0.11, 1.14, 4.03, 6.22],
      [0.89, 1.14, 4.03, 6.22],
    ])
      windowArch(out, lower, lower.length * fraction, width, bottom, spring, lod);
    for (let j = 0; j < 5; j++) {
      const fraction = 0.3 + j * 0.1;
      if (lod || j % 2 === 0) {
        const frontPosition = front.point(front.length * fraction, 0, -0.35);
        doric(out, frontPosition[0], frontPosition[2], upperFloor, upperCornice - 0.53, 0.38, lod);
      }
      if (lod) windowArch(out, back, back.length * (fraction + 0.046), 1.21, 13.85, 17.36, lod);
    }
    if (lod)
      for (const side of [-1, 1]) {
        panel(
          out,
          'limestone',
          lower,
          u + side * 10.1 - 0.87,
          u + side * 10.1 + 0.87,
          8.18,
          8.56,
          0.04,
        );
      }
  }
}

function porch(out, p, lod) {
  const [a, b] = p.outerIndices.map((i) => outline[i]);
  const [c, d] = p.innerIndices.map((i) => outline[i]);
  const e = edge(a, b),
    inner = edge(c, d),
    ring = [a, b, d, c];
  prism(out, 'granite', ring, foundationBottom, mainFloor, color.granite);
  if (!p.open) prism(out, 'plaster', ring, mainFloor, porchCeiling, color.plaster);
  const fascia = [a, b, d, c].map((q, i) => [
    q[0] + e.n[0] * (i < 2 ? 0.13 : 0),
    q[1] + e.n[2] * (i < 2 ? 0.13 : 0),
  ]);
  prism(out, 'limestone', fascia, porchCeiling, lowerCornice - 0.12, color.limestone);
  if (lod) prism(out, 'metal', ring, lowerCornice - 0.14, lowerCornice + 0.035, color.roof);
  const elevation = p.open ? inner : e;
  const gap = (e.length - 1.24) / 5;
  for (let i = 0; i < 6; i++) {
    const [x, , z] = e.point(0.62 + i * gap, 0, -0.55);
    doric(out, x, z, mainFloor, porchCeiling, 0.5, lod);
    if (lod >= 2) {
      panel(out, 'limestone', e, i * gap + 0.48, i * gap + 0.76, 10.2, 10.83, 0.153);
    }
  }
  for (let i = 0; i < 5; i++) {
    const isEntry = p.name === 'Marata' && i === 2;
    const u = ((i + 0.5) * elevation.length) / 5;
    windowArch(
      out,
      elevation,
      u,
      isEntry ? 2.12 : 1.44,
      isEntry ? mainFloor + 0.03 : 3.45,
      isEntry ? 4.52 : 6.19,
      lod,
      isEntry ? color.door : color.dark,
      p.open ? 0.047 : 0.045,
    );
  }
}

function stairs(out, lod) {
  const [x, z] = frame.features.at(-1).points[0];
  const n = lod ? 5 : 3,
    width = 12.96,
    span = 2.6;
  const nearest = (v, axis) => Math.round((v - ground.origin[axis]) / ground.stepMeters);
  const y =
    ground.heightsMeters[nearest(z + span, 1)][nearest(x, 0)] - ground.modelDatumElevationMeters;
  const low = Math.min(-0.28, y - 0.24);
  for (let j = 0; j < n; j++) {
    const depth = (span * (j + 1)) / n;
    const height = mainFloor - low - ((mainFloor - y) * j) / n;
    box(out, 'granite', x + 0.78, low, z + depth / 2 - 0.07, width, height, depth, color.granite);
  }
}

function cupola(out, lod) {
  const {
    center,
    pedestalWidth: w,
    pedestalTop,
    drumRadius: r,
    drumTop,
    domeTop,
    capRadius,
  } = dome;
  const [x, z] = center,
    n = [12, 24, 32, 48][lod];
  box(
    out,
    'plaster',
    x,
    upperCornice + 0.38,
    z,
    w,
    pedestalTop - upperCornice - 0.38,
    w,
    color.plaster,
  );
  box(out, 'limestone', x, pedestalTop - 0.38, z, w + 0.44, 0.4, w + 0.44, color.limestone);
  round(
    out,
    'limestone',
    center,
    [
      [pedestalTop - 0.09, r + 0.28],
      [pedestalTop + 0.3, r + 0.28],
    ],
    n,
  );
  round(
    out,
    'plaster',
    center,
    [
      [pedestalTop + 0.28, r],
      [drumTop - 0.3, r],
    ],
    n,
  );
  round(
    out,
    'limestone',
    center,
    [
      [drumTop - 0.39, r + 0.31],
      [drumTop + 0.03, r + 0.31],
    ],
    n,
  );
  const height = domeTop - drumTop;
  const stages = lod ? [0, 0.16, 0.32, 0.49, 0.64, 0.77, 0.88, 0.95, 1] : [0, 0.38, 0.72, 0.9, 1];
  round(
    out,
    'metal',
    center,
    stages.map((v) => [
      drumTop + v * height,
      Math.max(capRadius, (r - 0.03) * Math.sqrt(1 - v * v)),
    ]),
    n,
  );
  round(
    out,
    'metal',
    center,
    [
      [domeTop - 0.14, capRadius + 0.02],
      [domeTop + 0.49, capRadius + 0.02],
    ],
    n,
    color.rail,
  );
  if (!lod) return;
  const ring = radialRing(pedestalTop, r, r, n, center, Math.PI / 8).map(([a, , b]) => [a, b]);
  for (let i = 0; i < 8; i++) {
    const first = Math.round(((i + 0.1) * n) / 8) % n;
    const last = Math.round(((i + 0.9) * n) / 8) % n;
    const e = edge(ring[first], ring[last]);
    // The arched bay sits outside the furthest point of the curved drum wall.
    const projection = r * (1 - Math.cos(Math.PI / 8)) + 0.035;
    windowArch(
      out,
      e,
      e.length / 2,
      1.68,
      pedestalTop + 0.66,
      pedestalTop + 3.08,
      lod,
      color.dark,
      projection,
    );
    if (lod >= 2) {
      const [px, , pz] = e.point(0.22, 0, projection - 0.13);
      box(
        out,
        'limestone',
        px,
        pedestalTop + 0.31,
        pz,
        0.26,
        drumTop - pedestalTop - 0.62,
        0.26,
        color.limestone,
      );
    }
  }
}

function buildLevel(out, lod) {
  body(out, lod);
  for (const p of porches) porch(out, p, lod);
  stairs(out, lod);
  cupola(out, lod);
}

export const arcticSkyline = (out) => buildLevel(out, 0);
export const arcticDistrict = (out) => buildLevel(out, 1);
export const arcticStreet = (out) => buildLevel(out, 2);
export const arcticCloseup = (out) => buildLevel(out, 3);

const recipe = 'arctic-museum-model.mjs';
const camera = [48, 31, 68],
  lookAt = [0, 16.8, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'arcticDistrict', 0.26],
    ['street', 'arcticStreet', 0.11],
    ['closeup', 'arcticCloseup', 0.037],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);

export const arcticModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: arcticCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Saint Petersburg Arctic and Antarctic Museum exterior with two classical tiers, six-column Marata entrance and green dome, around February 2008.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The explicitly mapped museum envelope, with the four projections.',
  },
  groundCutout: {
    outline,
    basis:
      'Mask only the native occupied museum footprint in the placement preview. Original elevation values and the independent unmasked review remain unchanged.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'stone_granite', 'metal_painted'],
  qaCameras: [
    { name: 'marata-doric-entry-and-green-dome', position: [29, 22, 64], lookAt: [0, 15, 0] },
    { name: 'kuznechny-colonnades', position: [-55, 29, 33], lookAt: [-2, 16, 0] },
    { name: 'four-projections-and-dome-drum', position: [41, 79, -46], lookAt: [0, 16, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-arctic-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'arcticSkyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Geographic controls from OpenStreetMap, ODbL 1.0. Dome reference from AndreyA, public domain.',
};
