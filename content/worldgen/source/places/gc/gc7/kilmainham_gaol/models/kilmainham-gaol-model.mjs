import fs from 'node:fs';
import {
  abox,
  fbox,
  gableRoof,
  opening,
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
const layout = read('native-map/kilmainham-native-building-layout');
const walls = layout.enclosure.outline;
const prison = outwardRing(layout.mainBuilding.outline);
const contact = read('terrain-grid');
const rock = rgb('a39e8d');
const darkRock = rgb('8a877e');
const trim = rgb('b7b3a5');
const granite = rgb('8e8d87');
const slate = rgb('5c6260');
const glassTint = rgb('565f5e');
const metal = rgb('3f4240');
const timber = rgb('6a594c');
const gravel = rgb('a6a197');

const surfaces = {
  rough: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.94 },
  floor: { slot: 'foundation', graph: 'gravel', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.89 },
  timber: { slot: 'door', graph: 'wood_vertical', roughness: 0.92 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
};

function panel(out, slot, F, a, b, h0, h1, color, d = 0) {
  quad4(out, slot, F.P(a, h0, d), F.P(b, h0, d), F.P(b, h1, d), F.P(a, h1, d), color);
}

function nearTerrain(x, z) {
  const i = Math.round((x - contact.origin[0]) / contact.stepMeters);
  const j = Math.round((z - contact.origin[1]) / contact.stepMeters);
  return contact.heightsMeters[j][i] - contact.modelDatumElevationMeters;
}

function terrainWall(out, a, b, level, kind) {
  const F = wallFace(a, b);
  const groundMin = Math.min(nearTerrain(...a), nearTerrain(...b)) - 0.6;
  const midpoint = F.P(F.length / 2, 0);
  const wallTop =
    kind === 'division' ? 9.25 : midpoint[2] > 27 ? 9.96 : midpoint[2] < -24 ? 8.65 : 9.34;
  const thick = kind === 'division' ? 0.78 : 1.28;
  fbox(
    out,
    'rough',
    F,
    -0.13,
    F.length + 0.13,
    groundMin,
    wallTop,
    -thick / 2,
    thick / 2,
    darkRock,
  );
  if (level > 0)
    fbox(
      out,
      'trim',
      F,
      -0.14,
      F.length + 0.14,
      wallTop - 0.12,
      wallTop + 0.14,
      -thick / 2 - 0.07,
      thick / 2 + 0.07,
      granite,
    );
}

function yard(out, level) {
  const boundary = layout.stonebreakersYardWall.centerline;
  for (let i = 1; i < boundary.length; i++)
    terrainWall(out, boundary[i - 1], boundary[i], level, 'division');
  if (level === 0) return;
  const face = wallFace(boundary[1], boundary[0]);
  opening(out, face, face.length * 0.53, -0.85, 2.35, 3.7, {
    head: 'round',
    glassSlot: 'timber',
    frameSlot: 'trim',
    glass: timber,
    frame: trim,
    d: 0.44,
    frameWidth: 0.2,
    frameDepth: 0.16,
    sill: false,
  });
  const marker = [-44.56, -23.1],
    top = nearTerrain(...marker);
  abox(
    out,
    'iron',
    [marker[0] - 0.062, top, marker[1] - 0.045],
    [marker[0] + 0.062, top + 1.18, marker[1] + 0.045],
    metal,
  );
  abox(
    out,
    'iron',
    [marker[0] - 0.28, top + 0.71, marker[1] - 0.04],
    [marker[0] + 0.28, top + 0.82, marker[1] + 0.04],
    metal,
  );
  if (level > 1) {
    const points = [
      [-51.7, -22.33],
      [-36.6, -21.68],
      [-34.48, -31.18],
      [-49.76, -31.48],
    ].map(([x, z]) => [x, nearTerrain(x, z) + 0.08, z]);
    quad4(out, 'floor', ...points, gravel);
  }
}

function enclosure(out, level) {
  for (let i = 0; i < walls.length; i++) {
    if (i >= 29 && i < walls.length - 1) continue; // The north perimeter along this short stretch is the gaol façade.
    terrainWall(out, walls[i], walls[(i + 1) % walls.length], level, 'outer');
  }
  yard(out, level);
}

function topFor(x, z) {
  if (x < -10.2) return 9.25;
  if (x < 3.0) return 11.05;
  if (z > -19.5) return 12.96;
  if (x > 24.0) return 10.07;
  return 11.17;
}

function barredOpening(out, F, p, y, w, h, level, arch = 'flat') {
  if (level === 1) {
    panel(out, 'glass', F, p - w / 2, p + w / 2, y, y + h, glassTint, 0.044);
    return;
  }
  opening(out, F, p, y, w, h, {
    head: arch,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: glassTint,
    frame: trim,
    d: 0.045,
    frameWidth: 0.125,
    frameDepth: 0.12,
    sill: true,
    mullions: level > 1 ? 2 : 0,
    transoms: level === 3 ? 1 : 0,
    mullionColor: metal,
  });
}

function wallsAndOpenings(out, level) {
  for (let i = 0; i < prison.length; i++) {
    const p = prison[i],
      q = prison[(i + 1) % prison.length];
    const F = wallFace(p, q);
    const [cx, , cz] = F.P(F.length / 2, 0);
    const up = topFor(cx, cz);
    const slot = cz < -18 ? 'ashlar' : 'rough';
    const floor = Math.min(nearTerrain(...p), nearTerrain(...q)) - 0.62;
    const top0 = topFor(p[0], p[1]),
      top1 = topFor(q[0], q[1]);
    panel(out, 'rough', F, 0, F.length, floor, 0.42, darkRock);
    panel(out, slot, F, 0, F.length, 0.42, Math.max(up, top0, top1), rock);
    if (level === 0 || F.length < 0.9) continue;
    const n = Math.max(1, Math.round(F.length / (cx < -12 ? 2.5 : 3.7)));
    if (F.length > 3) fbox(out, 'trim', F, 0, F.length, 0.44, 0.66, -0.06, 0.12, granite);
    if (level > 1 && F.length > 4)
      fbox(out, 'trim', F, 0, F.length, up - 0.36, up - 0.21, -0.1, 0.11, granite);
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * F.length) / n;
      const gate = cz < -31 && F.length > 14 && j === Math.floor(n / 2);
      if (gate) {
        opening(out, F, u, 0.43, 2.19, 3.91, {
          head: 'round',
          glassSlot: 'timber',
          frameSlot: 'trim',
          glass: timber,
          frame: trim,
          d: 0.08,
          frameWidth: 0.29,
          frameDepth: 0.2,
          sill: false,
        });
        continue;
      }
      barredOpening(out, F, u, 2.13, cx < -14 ? 0.55 : 0.92, 1.44, level);
      if (up > 9.4) barredOpening(out, F, u, 5.05, 0.81, 1.44, level);
      barredOpening(out, F, u, up - 2.4, cx < -14 ? 0.53 : 0.86, 1.29, level);
    }
  }
}

function backingRoof(out) {
  const triangles = earcut(prison.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((j) => {
      const [x, z] = prison[j];
      return [x, topFor(x, z) - 0.026, z];
    });
    const [a, b, c] = points;
    tri(out, 'slate', a, c, b, slate);
  }
}

function roofs(out, level) {
  backingRoof(out);
  const ridges = [
    [[-35.47, -18.26], [-10.07, -18.3], 4.76, 9.32, 11.68],
    [[-17.65, -18.81], [3.15, -18.92], 5.04, 11.06, 13.43],
    [[4.61, -26.74], [23.7, -26.65], 12.12, 11.24, 15.18],
    [[23.65, -23.53], [39.62, -23.55], 7.65, 10.21, 12.9],
    [[15.11, -19.73], [15.12, -9.74], 10.83, 13.04, 16.85],
  ];
  for (const [start, end, width, eave, ridge] of ridges) {
    const F = wallFace(start, end);
    const ventedEave = width / 2 - 0.04;
    const ring = outwardRing(
      [
        F.P(0, 0, ventedEave),
        F.P(F.length, 0, ventedEave),
        F.P(F.length, 0, -ventedEave),
        F.P(0, 0, -ventedEave),
      ].map(([x, , z]) => [x, z]),
    );
    for (let i = 0; i < ring.length; i++) {
      const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
      panel(out, 'ashlar', face, 0, face.length, eave - 2.46, eave + 0.01, rock);
    }
    gableRoof(out, 'slate', start, end, width, eave, ridge, slate, {
      overhang: 0.11,
      endSlot: 'ashlar',
      endColor: rock,
    });
  }
  if (level === 0) return;
  const panes = level === 1 ? 2 : 7,
    y = 16.04;
  for (let i = 0; i < panes; i++) {
    const z = -19.33 + i * 1.16 * (7 / panes),
      depth = 0.93 * (7 / panes);
    quad4(
      out,
      'glass',
      [14.06, y, z + depth],
      [15.08, 16.88, z + depth],
      [15.08, 16.88, z],
      [14.06, y, z],
      glassTint,
    );
    quad4(
      out,
      'glass',
      [15.16, 16.88, z + depth],
      [16.2, y, z + depth],
      [16.2, y, z],
      [15.16, 16.88, z],
      glassTint,
    );
  }
}

function rearRange(out, level) {
  const rear = layout.prisonRear;
  const outer = outwardRing(rear.outline);
  const well = outwardRing(rear.well).reverse();
  const y = 11.92;
  for (const ring of [outer, well]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length];
      const F = wallFace(p, q);
      const grade = Math.min(nearTerrain(...p), nearTerrain(...q));
      panel(out, 'rough', F, 0, F.length, grade - 0.55, y, rock);
      if (level === 0 || F.length < 1.6) continue;
      const count = Math.max(1, Math.round(F.length / 3.19));
      if (F.length > 2) fbox(out, 'trim', F, 0, F.length, y - 0.24, y - 0.06, -0.08, 0.12, granite);
      for (let k = 0; k < count; k++) {
        const u = (F.length * (k + 0.5)) / count;
        const near = level === 3 || (level === 2 && ring === well);
        for (const row of [3.18, 6.37, 9.38]) {
          barredOpening(out, F, u, row, ring === well ? 0.66 : 0.86, 1.42, near ? 2 : 1);
        }
      }
    }
  }
  const footprint = outer.concat(well);
  const roofTriangles = earcut(footprint.flat(), [outer.length]);
  for (let i = 0; i < roofTriangles.length; i += 3) {
    const [a, b, c] = roofTriangles.slice(i, i + 3).map((index) => {
      const [x, z] = footprint[index];
      return [x, y - 0.012, z];
    });
    tri(out, 'slate', a, c, b, slate);
  }
  for (const [p, q, w, h] of [
    [[-31.67, -6.7], [-31.38, 25.04], 6.0, 14.57],
    [[-10.15, -5.55], [-10.03, 19.2], 3.56, 13.66],
    [[-34.8, 21.66], [-1.9, 21.38], 7.47, 14.85],
    [[-28.17, -1.95], [27.62, -1.96], 5.4, 14.22],
    [[4.45, 7.61], [30.4, 7.61], 19.13, plan.dimensions.rearRidgeHeightEstimateM],
  ]) {
    gableRoof(out, 'slate', p, q, w, y + 0.04, h, slate, {
      overhang: 0.085,
      endSlot: 'ashlar',
      endColor: rock,
    });
  }
  const roundedEnd = outer.filter(([x, z]) => x > 29 && z > -4.2 && z < 18.7);
  const hinge = [30.4, plan.dimensions.rearRidgeHeightEstimateM, 7.61];
  for (let i = 1; i < roundedEnd.length; i++) {
    const [x, z] = roundedEnd[i - 1],
      [u, v] = roundedEnd[i];
    tri(out, 'slate', [x, y + 0.04, z], [u, y + 0.04, v], hinge, slate);
  }
}

function build(out, level) {
  enclosure(out, level);
  wallsAndOpenings(out, level);
  roofs(out, level);
  rearRange(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kilmainham-gaol-model.mjs';
const camera = [-106, 72, -123],
  lookAt = [-2, 6, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Kilmainham Gaol',
  wikidataId: plan.wikidataId,
  category: 'historic-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The current Kilmainham Gaol museum, with its high rubble-limestone enclosure, historic ranges, governor’s front court and surviving Stonebreakers’ Yard.',
  camera,
  lookAt,
  sunDirection: [-55, 67, -44],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.93,
    basis: 'The mapped site enclosure, including the front and rear prison ranges.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_ashlar',
    'stone_granite',
    'gravel',
    'tile_flat',
    'wood_vertical',
  ],
  recipeDependencies: ['polygon-triangulation.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'inchicore-road-entrance', position: [18, 15.2, -69], lookAt: [12, 7.7, -26] },
    { name: 'stonebreakers-yard', position: [-48.4, 3, -28.7], lookAt: [-40.2, 3.5, -21.7] },
    { name: 'east-wing-and-enclosure', position: [73, 59, 42], lookAt: [0, 7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kilmainham-gaol-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.73,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model under repository license. Enclosure and building outline © OpenStreetMap contributors. Mapzen open elevation.',
};
