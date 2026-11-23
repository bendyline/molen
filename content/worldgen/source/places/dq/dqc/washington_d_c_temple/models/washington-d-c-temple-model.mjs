import fs from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const pylons = read('native-map/washington-temple-pylon-plans').pylons;
const body = outwardRing(frame.geometry.outline);
const roofHeight = plan.dimensions.mainRoofM;
const northFace = facade([-1.12, -15.48], [-1, 0]);
const colors = Object.fromEntries(
  Object.entries({
    marble: 'e3dfd4',
    cream: 'ebe7dc',
    shadows: 'c5c2b9',
    foundation: 'c3bab0',
    roof: 'ada79b',
    brightGold: 'cda956',
    brass: 'a98546',
    seam: 'd0cbc0',
    dark: '625849',
    glass: '777b76',
    bronze: '7b6453',
  }).map(([name, value]) => [name, rgb(value)]),
);
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.77 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.75 },
  footing: { slot: 'foundation', graph: 'stone_marble', roughness: 0.87 },
  roof: { slot: 'roof', graph: 'concrete_panel', roughness: 0.91 },
  gilt: { slot: 'trim', graph: 'metal_painted', roughness: 0.56, metallic: 0.4 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48 },
};

function volume(out, material, ring, base, cap, color, roof = material, capColor = color) {
  const polygon = outwardRing(ring);
  extrude(out, material, polygon, base, cap, color, { top: false });
  const indices = triangulate(polygon.flat());
  const vertex = (i) => [polygon[i][0], cap, polygon[i][1]];
  for (let i = 0; i < indices.length; i += 3) {
    tri(out, roof, vertex(indices[i]), vertex(indices[i + 2]), vertex(indices[i + 1]), capColor);
  }
}

function panel(out, slot, f, left, right, base, cap, depth, color) {
  quad4(
    out,
    slot,
    f.P(left, base, depth),
    f.P(right, base, depth),
    f.P(right, cap, depth),
    f.P(left, cap, depth),
    color,
  );
}

function blade(out, f, u, width, base, top, depth, color = colors.cream) {
  fbox(out, 'trim', f, u - width / 2, u + width / 2, base, top, -0.03, depth, color);
}

function bodyCladding(out, level) {
  volume(out, 'marble', body, -0.68, roofHeight, colors.marble, 'roof', colors.roof);
  const recesses = [
    [4, 5],
    [8, 12],
    [18, 22],
    [25, 27],
    [30, 31],
    [34, 0],
    [0, 1],
  ];
  for (const [a, b] of recesses) {
    const surface = wallFace(frame.geometry.outline[a], frame.geometry.outline[b]);
    const front = a === 25;
    const visibleBase = front ? 15.8 : 2.05;
    panel(
      out,
      'marble',
      surface,
      0.32,
      surface.length - 0.32,
      visibleBase,
      roofHeight - 0.27,
      0.15,
      colors.shadows,
    );
    const columns = Math.max(2, Math.round(surface.length / [5.3, 2.28, 1.3, 1.15][level]));
    for (let i = 0; i < columns; i++) {
      const u = (surface.length * (i + 0.5)) / columns;
      const reachesParapet = front || a === 4;
      const top = reachesParapet ? roofHeight + 1.34 : roofHeight - 0.2;
      blade(out, surface, u, 0.33, visibleBase - 0.35, top, 0.47);
      if (level > 1)
        blade(
          out,
          surface,
          u + 0.48,
          0.105,
          visibleBase + 0.28,
          roofHeight - 0.42,
          0.12,
          colors.seam,
        );
    }
  }
}

function entrance(out, level) {
  const slab = [
    [-16.82, -15.25],
    [15.05, -15.25],
    [14.73, -21.17],
    [11.82, -23.0],
    [-14.15, -23.0],
    [-16.49, -21.22],
  ];
  volume(out, 'marble', slab, 12.0, 16.3, colors.cream, 'roof', colors.roof);
  const p = (x, z) => [x, 12.0, z];
  const cap = outwardRing(slab);
  const indices = triangulate(cap.flat());
  for (let i = 0; i < indices.length; i += 3) {
    tri(out, 'marble', ...indices.slice(i, i + 3).map((j) => p(...cap[j])), colors.shadows);
  }
  fbox(out, 'footing', northFace, -15.8, 15.6, -0.63, 0.31, -0.47, 7.95, colors.foundation);
  for (const u of [-5.2, -3.17, -1.12, 0.93, 2.98, 5.0]) {
    fbox(out, 'trim', northFace, u - 0.32, u + 0.32, 0.26, 18.16, 7.06, 7.87, colors.cream);
  }
  for (const u of [-10.7, -8.62, -6.5, -4.39, -2.25, 0, 2.25, 4.39, 6.5, 8.62, 10.7]) {
    const door = Math.abs(u) < 4.6;
    panel(
      out,
      'glass',
      northFace,
      u - 0.84,
      u + 0.84,
      0.33,
      11.91,
      0.13,
      door ? colors.dark : colors.glass,
    );
    if (level < 2) continue;
    for (const offset of [-0.61, -0.29, 0, 0.29, 0.61]) {
      fbox(
        out,
        'gilt',
        northFace,
        u + offset - 0.019,
        u + offset + 0.019,
        0.42,
        11.89,
        0.134,
        0.172,
        colors.bronze,
      );
    }
    for (let y = 1.05; y < 11.9; y += level === 3 ? 0.49 : 0.91) {
      fbox(out, 'gilt', northFace, u - 0.84, u + 0.84, y, y + 0.033, 0.135, 0.165, colors.bronze);
    }
  }
}

function scaleRing(ring, factor, height) {
  const center = ring.reduce(
    ([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length],
    [0, 0],
  );
  return ring.map(([x, z]) => [
    center[0] + (x - center[0]) * factor,
    height,
    center[1] + (z - center[1]) * factor,
  ]);
}

function spire(out, native, index, level) {
  const { base, crown, steeple } = native.rings;
  const baseY = [47.9, 45.9, 43.0, 41.1, 43.8, 46.8][index];
  const apex = plan.dimensions.spireApexM[index];
  const crownY = apex - [21.2, 20.1, 20.5, 18.3, 19.0, 20.7][index];
  const outer = outwardRing(base);
  volume(
    out,
    'marble',
    outer,
    baseY > roofHeight ? roofHeight - 1.5 : baseY - 2.8,
    baseY,
    colors.cream,
  );
  volume(out, 'marble', crown, baseY - 0.04, crownY, colors.marble);
  const needle = outwardRing(steeple);
  const shoulder = crownY + 2.8;
  volume(out, 'marble', needle, crownY - 0.03, shoulder, colors.cream);
  loft(
    out,
    'gilt',
    [
      scaleRing(needle, 0.83, shoulder - 0.04),
      scaleRing(needle, 0.43, shoulder + (apex - shoulder) * 0.37),
      scaleRing(needle, 0.21, shoulder + (apex - shoulder) * 0.69),
      scaleRing(needle, 0.026, apex),
    ],
    colors.brightGold,
    { cap: false },
  );
  if (index === 0) {
    const [x, , z] = scaleRing(needle, 0, apex)[0];
    const top = plan.dimensions.documentedTotalHeightM;
    loft(
      out,
      'gilt',
      [
        radialRing(apex - 1.36, 0.19, 0.19, 8, [x, z]),
        radialRing(apex + 1.52, 0.33, 0.28, 8, [x, z]),
        radialRing(top - 0.72, 0.26, 0.23, 8, [x, z]),
        radialRing(top, 0.15, 0.14, 8, [x, z]),
      ],
      colors.brass,
      { cap: false },
    );
  }
  if (level === 0) return;
  for (const ring of [outer, outwardRing(crown)]) {
    const baseTier = ring === outer;
    for (let i = 0; i < ring.length; i++) {
      const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
      if (face.length < 1.5) continue;
      if (baseTier) {
        const count = Math.max(1, Math.round(face.length / [1, 3.6, 1.36, 1.17][level]));
        for (let j = 0; j < count; j++) {
          const u = (face.length * (j + 0.5)) / count;
          blade(out, face, u, 0.3, baseY - 3.22, baseY + 0.32, 0.28);
        }
      } else {
        blade(out, face, face.length * 0.5, 0.22, baseY + 0.25, crownY + 0.3, 0.18);
      }
    }
  }
}

function marbleJoints(out, level) {
  if (level < 2) return;
  for (let i = 0; i < body.length; i++) {
    const surface = wallFace(body[i], body[(i + 1) % body.length]);
    if (surface.length < 2.2) continue;
    const height = i % 2 === 0 ? 40.94 : 40.42;
    for (let y = 3.0; y < height; y += level === 3 ? 3.05 : 6.1) {
      panel(out, 'marble', surface, 0.03, surface.length - 0.03, y, y + 0.034, 0.018, colors.seam);
    }
  }
}

function build(out, level) {
  bodyCladding(out, level);
  for (let i = 0; i < pylons.length; i++) spire(out, pylons[i], i, level);
  entrance(out, level);
  marbleJoints(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'washington-d-c-temple-model.mjs';
const camera = [90, 60, -122];
const lookAt = [0, 38, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Washington D.C. Temple',
  wikidataId: plan.wikidataId,
  category: 'temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Marble hexagonal temple with six gilded spires, tall fluted façades and the north entry canopy.',
  camera,
  lookAt,
  sunDirection: [-35, 74, -62],
  mediumFiContext: {
    scale: 1,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Named temple footprint and separate porch volume at its north entrance.',
  },
  embeddedCanonicalGraphs: ['stone_marble', 'concrete_panel', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-forecourt-and-six-spires', position: [-4, 11, -88], lookAt: [-1.0, 38, 0] },
    { name: 'marble-entry-colonnade', position: [-36, 7, -52], lookAt: [-2, 14, -15] },
    { name: 'east-spire-and-south-wall', position: [108, 58, 58], lookAt: [5, 40, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'washington-d-c-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.82,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and USGS elevation under source attribution terms.',
};
