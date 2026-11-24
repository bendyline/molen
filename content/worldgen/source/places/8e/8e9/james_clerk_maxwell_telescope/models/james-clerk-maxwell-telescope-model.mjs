import fs from 'node:fs';
import {
  abox,
  fan,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const {
  carouselCenterXZ: center,
  mappedRimRadiusM: rim,
  maximumEnclosureHeightM: height,
} = plan.dimensions;
const entry = plan.dimensions.entryCorners.map((index) => frame.geometry.outline[index]);
const colors = {
  concrete: rgb('aca9a1'),
  white: rgb('dededb'),
  roof: rgb('d4d3cb'),
  bearing: rgb('333739'),
  rails: rgb('555a5c'),
  door: rgb('55585a'),
  enclosure: rgb('929692'),
  seams: rgb('a2a7a8'),
  apron: rgb('a5a39c'),
};
const surfaces = {
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  shell: { slot: 'wall', graph: 'metal_painted', roughness: 0.73 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78 },
  entry: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79 },
};

const deck = height - 1.38;
const rotation = Math.PI / 10;
const cosine = Math.cos(rotation);
const sine = Math.sin(rotation);
const turn = ([u, v]) => [center[0] + u * cosine - v * sine, center[1] + u * sine + v * cosine];
const roofPhotoRecess = [
  [-9.8, -4.75],
  [9.8, -4.75],
  [9.8, 1.55],
  [-9.8, 1.55],
];
const point = (radius, angle, y) => [
  center[0] + radius * Math.cos(angle),
  y,
  center[1] + radius * Math.sin(angle),
];
function ring(out, slot, profile, facets, color, capTop = false) {
  lathe(
    out,
    slot,
    center,
    profile.map(([y, radius]) => [y, radius, radius]),
    facets,
    color,
    { capTop },
  );
}

function prism(out, slot, outline, bottom, top, color, { top: capped = true } = {}) {
  const corners = outwardRing(outline);
  for (let i = 0; i < corners.length; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % corners.length];
    quad4(out, slot, [ax, bottom, az], [bx, bottom, bz], [bx, top, bz], [ax, top, az], color);
  }
  if (capped)
    fan(
      out,
      slot,
      corners.map(([x, z]) => [x, top, z]),
      color,
    );
}

function roof(out, facets, level) {
  const outer = Array.from({ length: facets }, (_, i) => {
    const [x, , z] = point(rim, (i / facets) * 2 * Math.PI, deck);
    return [x, z];
  });
  const aperture = roofPhotoRecess.map(turn);
  const outline = outer.concat(aperture);
  const triangles = earcut(outline.flat(), [outer.length]);
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((index) => {
      const [x, z] = outline[index];
      return [x, deck, z];
    });
    tri(out, 'roof', a, c, b, colors.roof);
  }
  prism(out, 'steel', aperture, deck - 0.95, deck - 0.78, colors.bearing);
  for (const z of [-4.75, 1.38]) {
    prism(
      out,
      'steel',
      [
        [-10.1, z],
        [10.1, z],
        [10.1, z + 0.17],
        [-10.1, z + 0.17],
      ].map(turn),
      deck - 0.72,
      deck + 0.21,
      colors.rails,
    );
  }
  for (const x of [-10.6, 8.92]) {
    prism(
      out,
      'roof',
      [
        [x, -5.02],
        [x + 1.66, -5.02],
        [x + 1.66, 1.86],
        [x, 1.86],
      ].map(turn),
      deck - 0.1,
      height,
      colors.white,
    );
  }
  if (level >= 2) {
    for (let x = -8.2; x <= 8.4; x += 2.05) {
      prism(
        out,
        'steel',
        [
          [x, -4.42],
          [x + 0.13, -4.42],
          [x + 0.13, 1.2],
          [x, 1.2],
        ].map(turn),
        deck - 0.77,
        deck - 0.61,
        colors.rails,
      );
    }
  }
}

function entryHut(out, level) {
  prism(out, 'shell', entry, -0.65, 2.64, colors.enclosure, { top: false });
  const midpoint = entry.reduce(([x, z], p) => [x + p[0] / 4, z + p[1] / 4], [0, 0]);
  const eaves = entry.map(([x, z]) => [
    midpoint[0] + (x - midpoint[0]) * 1.075,
    midpoint[1] + (z - midpoint[1]) * 1.075,
  ]);
  prism(out, 'entry', eaves, 2.6, 2.83, colors.roof);
  const facade = wallFace(entry[2], entry[1]);
  const panel = (slot, u0, u1, y0, y1, d, color) =>
    quad4(
      out,
      slot,
      facade.P(u0, y0, d),
      facade.P(u1, y0, d),
      facade.P(u1, y1, d),
      facade.P(u0, y1, d),
      color,
    );
  panel('steel', 1.55, 4.28, 0.06, 2.4, 0.016, colors.door);
  if (level === 0) return;
  const apron = [
    facade.P(-0.25, 0, -0.1),
    facade.P(facade.length + 0.18, 0, -0.1),
    facade.P(facade.length + 0.18, 0, 2.1),
    facade.P(-0.25, 0, 2.1),
  ].map(([x, , z]) => [x, z]);
  prism(out, 'base', apron, -0.36, 0.065, colors.apron);
  if (level < 2) return;
  panel('shell', 1.49, 1.58, 0.08, 2.48, 0.038, colors.white);
  panel('shell', 4.24, 4.32, 0.08, 2.48, 0.038, colors.white);
  panel('shell', 1.55, 4.28, 2.4, 2.48, 0.039, colors.white);
  panel('steel', 2.88, 2.94, 0.09, 2.37, 0.036, colors.seams);
  abox(out, 'steel', [7.02, 0.02, -15.49], [7.88, 1.02, -14.84], colors.rails);
}

function build(out, level) {
  const facets = [16, 32, 64, 96][level];
  ring(
    out,
    'base',
    [
      [-0.94, 15.53],
      [0.34, 15.53],
      [0.51, 15.32],
      [3.19, 15.32],
    ],
    facets,
    colors.concrete,
  );
  ring(
    out,
    'shell',
    [
      [3.17, 15.3],
      [3.38, 16.05],
      [3.62, 16.05],
      [3.71, 15.33],
    ],
    facets,
    colors.white,
  );
  ring(
    out,
    'steel',
    [
      [3.62, 14.94],
      [4.26, 14.94],
    ],
    facets,
    colors.bearing,
  );
  ring(
    out,
    'shell',
    [
      [4.16, 14.95],
      [4.37, 15.12],
      [deck - 1.41, 15.12],
    ],
    facets,
    colors.white,
  );
  ring(
    out,
    'shell',
    [
      [deck - 1.55, 15.08],
      [deck - 1.43, rim],
      [deck - 0.16, rim],
      [deck, rim],
    ],
    facets,
    colors.white,
  );
  roof(out, facets, level);
  entryHut(out, level);

  if (level >= 2) {
    const dividers = level === 2 ? 8 : 12;
    for (let i = 0; i < dividers; i++) {
      const angle = (2 * Math.PI * Math.round((i / dividers) * facets)) / facets;
      const r = 15.14;
      const a = angle - 0.0021;
      const b = angle + 0.0021;
      quad4(
        out,
        'steel',
        point(r, a, 4.42),
        point(r, a, deck - 1.56),
        point(r, b, deck - 1.56),
        point(r, b, 4.42),
        colors.seams,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'james-clerk-maxwell-telescope-model.mjs';
const camera = [-54, 38, -64];
const lookAt = [0, 14, -2];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'James Clerk Maxwell Telescope',
  wikidataId: plan.wikidataId,
  category: 'observatory',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The white rotating observatory on Maunakea, with its dark bearing ring, recessed shutter and north entrance.',
  camera,
  lookAt,
  sunDirection: [-57, 73, -61],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Mapped circular base and entry. The original elevation field is preserved.',
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted', 'metal_standing_seam'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-entry-and-bearing', position: [4, 5.1, -43], lookAt: [3, 7.5, -14] },
    { name: 'roof-shutter-and-rim', position: [34, 53, -45], lookAt: [0, 24, 0] },
    { name: 'southwest-shell', position: [-54, 16, 43], lookAt: [0, 13, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'james-clerk-maxwell-telescope-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.15, surfaces },
      street: { export: 'street', errorMeters: 0.07, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, based on OpenStreetMap geometry (ODbL) and USGS/NOAA public-domain terrain.',
};
