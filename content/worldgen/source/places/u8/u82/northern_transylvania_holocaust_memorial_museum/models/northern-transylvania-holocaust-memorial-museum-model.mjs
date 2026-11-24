import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outline = outwardRing(frame.geometry.outline);
const front = 14.2921;
const center = 2.258;
const face = facade([center, front], [1, 0]);
const eave = plan.dimensions.mainEavesM;
const ridge = plan.dimensions.ridgeApexAboveGradeM;
const colors = {
  plaster: rgb('b9a887'),
  band: rgb('c4b695'),
  stone: rgb('b3aa97'),
  shadow: rgb('595041'),
  roof: rgb('795349'),
  silver: rgb('909991'),
  iron: rgb('474740'),
  aperture: rgb('33352e'),
  glass: ['344e61', '8d4d41', '54758a', '998b58', '526e73', '846f58'].map(rgb),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86 },
  cap: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.16 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.11 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42 },
};

function panel(out, slot, f, x0, x1, y0, y1, offset, tint) {
  quad4(
    out,
    slot,
    f.P(x0, y0, offset),
    f.P(x1, y0, offset),
    f.P(x1, y1, offset),
    f.P(x0, y1, offset),
    tint,
  );
}

function box(out, slot, lo, hi, tint) {
  abox(out, slot, lo, hi, tint, { bottom: false });
}

function mainRoof(out) {
  const body = outline.map(([x, z]) => [
    x * 1.018 + 0.05,
    eave,
    Math.min(front - 0.12, z * 1.013 + 0.03),
  ]);
  const peak = outline.map(([x, z]) => [
    center + (x - center) * 0.035,
    ridge,
    Math.min(front - 0.14, Math.max(-11.8, z * 0.985)),
  ]);
  loft(out, 'roof', [body, peak], colors.roof, { cap: false });
  const roofRidge = 13.67;
  beam(
    out,
    'roof',
    [center, roofRidge, -11.78],
    [center, roofRidge, front - 0.14],
    0.41,
    0.23,
    colors.roof,
  );

  const edges = [-5.68, 10.18];
  panel(
    out,
    'plaster',
    face,
    edges[0] - center,
    edges[1] - center,
    eave - 0.24,
    eave + 0.03,
    0.1,
    colors.plaster,
  );
  tri(
    out,
    'plaster',
    [edges[0], eave - 0.22, front + 0.11],
    [edges[1], eave - 0.22, front + 0.11],
    [center, ridge - 0.1, front + 0.11],
    colors.plaster,
  );
  for (const edge of edges) {
    beam(
      out,
      'plaster',
      [edge, eave + 0.07, front + 0.12],
      [center, ridge, front + 0.12],
      0.21,
      0.24,
      colors.band,
    );
  }
}

function finial(out, x, y, z, radius, level) {
  const n = level > 1 ? 12 : 8;
  loft(
    out,
    'cap',
    [
      radialRing(y, radius * 0.41, radius * 0.41, n, [x, z]),
      radialRing(y + radius * 0.67, radius, radius, n, [x, z]),
      radialRing(y + radius * 1.48, radius * 0.68, radius * 0.68, n, [x, z]),
      radialRing(y + radius * 1.9, radius * 0.1, radius * 0.1, n, [x, z]),
    ],
    colors.silver,
  );
}

function dome(out, x, z, level) {
  const height = plan.dimensions.towerCapTopM;
  const rim = height - 1.12;
  const n = [8, 12, 18, 24][level];
  const sections = [
    [0, 1.02],
    [0.29, 0.88],
    [0.62, 0.63],
    [0.88, 0.23],
    [0.96, 0.095],
  ];
  const rings = sections.map(([h, r]) => radialRing(rim + h, r, r, n, [x, z]));
  loft(out, 'cap', rings, colors.silver);
  if (level > 1) {
    for (let j = 0; j < n; j += level === 2 ? 3 : 2)
      for (let i = 1; i < rings.length; i++)
        beam(out, 'cap', rings[i - 1][j], rings[i][j], 0.026, 0.03, colors.silver);
  }
  finial(out, x, rim + 0.93, z, 0.16, level);
}

function tower(out, x, level) {
  const z = front - 0.14;
  box(out, 'plaster', [x - 1.21, -0.38, z - 1.26], [x + 1.21, 12.08, z + 0.44], colors.plaster);
  const f = facade([x, z + 0.45], [1, 0]);
  const bands = level === 0 ? [4.0, 8.95, 11.93] : [3.97, 7.82, 8.96, 10.43, 11.79, 12.04];
  for (const y of bands) {
    fbox(out, 'plaster', f, -1.29, 1.29, y, y + 0.11, -1.73, 0.13, colors.band);
  }
  if (level > 1) {
    for (const u of [-0.96, 0.96]) {
      fbox(out, 'plaster', f, u - 0.1, u + 0.1, 7.99, 10.3, 0.038, 0.14, colors.band);
    }
    const tessera = [
      [-0.34, 9.55],
      [0, 9.27],
      [0.34, 9.55],
      [0, 9.83],
    ];
    quad4(out, 'plaster', ...tessera.map(([u, h]) => f.P(u, h, 0.058)), colors.band);
  }
  dome(out, x, z - 0.41, level);
}

function archedOpening(out, f, x, bottom, width, spring, radiusY, depth, tint, level) {
  const r = width / 2;
  panel(out, 'glass', f, x - r, x + r, bottom, spring, depth, tint);
  const steps = level > 1 ? 12 : 6;
  const point = (i) => {
    const a = (Math.PI * i) / steps;
    return f.P(x + r * Math.cos(a), spring + radiusY * Math.sin(a), depth);
  };
  for (let i = 0; i < steps; i++)
    tri(out, 'glass', f.P(x, spring, depth), point(i), point(i + 1), tint);
  if (level > 1) {
    for (const u of [x - width * 0.23, x, x + width * 0.23]) {
      fbox(
        out,
        'trim',
        f,
        u - 0.018,
        u + 0.018,
        bottom,
        spring + radiusY * 0.63,
        depth + 0.019,
        depth + 0.06,
        colors.iron,
      );
    }
  }
}

function roseWindow(out, level) {
  const h = 8.54;
  const n = level > 1 ? 24 : 12;
  const at = (i, r, depth) => {
    const a = (2 * Math.PI * i) / n;
    return face.P(r * Math.cos(a), h + r * Math.sin(a), depth);
  };
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    const tint = colors.glass[(i + Math.floor(i / 5)) % colors.glass.length];
    tri(out, 'glass', face.P(0, h, 0.131), at(i, 0.905, 0.131), at(j, 0.905, 0.131), tint);
    quad4(
      out,
      'stone',
      at(i, 0.895, 0.135),
      at(i, 0.98, 0.142),
      at(j, 0.98, 0.142),
      at(j, 0.895, 0.135),
      colors.stone,
    );
    if (level > 1 && i % 2 === 0) {
      beam(out, 'trim', at(i, 0.87, 0.155), at(j + 2, 0.39, 0.154), 0.024, 0.025, colors.iron);
    }
  }
}

function portal(out, level) {
  const z = front;
  fbox(out, 'plaster', face, -1.73, 1.73, 0.22, 4.2, 0.019, 0.2, colors.band);
  panel(out, 'glass', face, -1.0, 1.0, 0.33, 3.48, 0.224, colors.aperture);
  fbox(out, 'plaster', face, -1.65, 1.65, 3.64, 4.1, 0.09, 0.62, colors.band);
  const rim = level > 1 ? 12 : 6;
  for (let i = 0; i < rim; i++) {
    const point = (t, r) => face.P(Math.cos(t) * r, 4.11 + Math.sin(t) * r, 0.28);
    const a = (Math.PI * i) / rim;
    const b = (Math.PI * (i + 1)) / rim;
    quad4(
      out,
      'plaster',
      point(a, 1.03),
      point(a, 1.37),
      point(b, 1.37),
      point(b, 1.03),
      colors.band,
    );
  }
  fbox(out, 'cap', face, -1.76, 1.76, 5.52, 5.65, 0.027, 0.61, colors.silver);
  fbox(out, 'plaster', face, -1.77, 1.77, 5.39, 5.52, 0.019, 0.53, colors.band);
  for (const u of [-1.23, 1.23]) {
    const c = [center + u, z + 0.52];
    const n = level > 1 ? 12 : 8;
    loft(
      out,
      'stone',
      [
        radialRing(0.31, 0.185, 0.185, n, c),
        radialRing(0.52, 0.168, 0.17, n, c),
        radialRing(3.5, 0.146, 0.147, n, c),
        radialRing(3.65, 0.197, 0.192, n, c),
      ],
      colors.band,
    );
  }
  for (const [i, y] of [0.11, 0.25, 0.39].entries()) {
    box(
      out,
      'stone',
      [center - 1.38, -0.24, z + 0.28],
      [center + 1.39, y, z + 1.21 - i * 0.25],
      colors.stone,
    );
  }
}

function crest(out, level) {
  const y = ridge - 0.11;
  box(
    out,
    'stone',
    [center - 0.55, y, front - 0.19],
    [center + 0.55, y + 0.62, front + 0.27],
    colors.stone,
  );
  for (const side of [-1, 1]) {
    const x = center + side * 0.22;
    box(
      out,
      'stone',
      [x - 0.178, y + 0.53, front - 0.02],
      [x + 0.178, y + 1.34, front + 0.22],
      colors.stone,
    );
    if (level > 0) {
      tri(
        out,
        'stone',
        [x - 0.174, y + 1.34, front + 0.22],
        [x + 0.174, y + 1.34, front + 0.22],
        [x, y + 1.53, front + 0.22],
        colors.stone,
      );
    }
  }
}

function build(out, level) {
  extrude(out, 'stone', outline, -1.72, 0.31, colors.stone, { top: false });
  extrude(out, 'plaster', outline, 0.31, eave, colors.plaster, { top: false });
  mainRoof(out);
  for (let i = 0; i < outline.length; i++) {
    const f = wallFace(outline[i], outline[(i + 1) % outline.length]);
    fbox(out, 'plaster', f, 0, f.length, 3.7, 3.86, 0.001, 0.17, colors.band);
    if (level === 0 || f.length < 16 || f.origin[1] > 11) continue;
    for (let j = 0; j < 4; j++) {
      const u = ((j + 0.5) * f.length) / 4;
      archedOpening(out, f, u, 4.2, 0.94, 7.94, 0.44, 0.035, colors.aperture, level);
      if (level > 1) {
        fbox(out, 'stone', f, u - 0.57, u + 0.57, 4.07, 4.24, 0.012, 0.21, colors.stone);
      }
    }
  }
  for (const x of [-3.49, 3.49]) {
    archedOpening(out, face, x, 4.12, 0.86, 6.45, 0.29, 0.136, colors.aperture, level);
    panel(out, 'glass', face, x - 0.49, x + 0.49, 1.33, 3.63, 0.105, colors.aperture);
  }
  fbox(out, 'plaster', face, -7.6, 7.58, 3.74, 3.94, 0.09, 0.23, colors.band);
  portal(out, level);
  roseWindow(out, level);
  tower(out, -4.4, level);
  tower(out, 8.9, level);
  crest(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'northern-transylvania-holocaust-memorial-museum-model.mjs';
const camera = [24.6, 19, 36];
const lookAt = [1.28, 6.0, 3.25];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Northern Transylvania Holocaust Memorial Museum',
  wikidataId: plan.wikidataId,
  category: 'synagogue',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Restored 1876 synagogue with pale ochre frontage, paired silver domes, round stained glass and the recessed portal.',
  camera,
  lookAt,
  sunDirection: [-34, 62, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis: 'The native mapped synagogue footprint beneath the restored building.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'tile_ceramic',
    'metal_standing_seam',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'rose-window-and-silver-domes', position: [0.8, 5.0, 38], lookAt: [2.25, 7.7, 14.35] },
    { name: 'stone-portal-and-dome', position: [18.0, 10.2, 28], lookAt: [2.65, 7.05, 13.3] },
    { name: 'rear-and-original-footprint', position: [-28.2, 18.5, -25], lookAt: [0.6, 6.2, -1.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'simleu-silvaniei-synagogue-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.103, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.041, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. OpenStreetMap source under ODbL and open Mapzen elevations under their attribution.',
};
