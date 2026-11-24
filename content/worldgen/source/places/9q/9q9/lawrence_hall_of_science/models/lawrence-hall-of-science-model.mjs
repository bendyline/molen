import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
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
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/lawrence-hall-site-controls');
const shapes = Object.fromEntries(
  Object.entries(site.planRings).map(([key, r]) => [key, outwardRing(r)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  joint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  railing: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.81 },
  basin: { slot: 'trim', graph: 'concrete_plain', roughness: 0.77 },
  water: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.49 },
};
const concrete = rgb('b4afa0');
const roof = rgb('b9b6a6');
const roofDark = rgb('a29e92');
const paving = rgb('918f85');
const joint = rgb('a8a599');
const deck = rgb('a6a195');
const glass = rgb('4d6267');
const metal = rgb('515853');
const water = rgb('7bafb0');
const plazaY = 4.28;

function center(ring) {
  return [0, 1].map((i) => ring.reduce((n, p) => n + p[i], 0) / ring.length);
}

function inset(ring, ratio) {
  const [x, z] = center(ring);
  return ring.map(([a, b]) => [x + (a - x) * ratio, z + (b - z) * ratio]);
}

function edges(ring, f) {
  for (let i = 0; i < ring.length; i++) f(ring[i], ring[(i + 1) % ring.length], i);
}

function panel(out, slot, F, a, b, y0, y1, d, color) {
  quad4(out, slot, F.P(a, y0, d), F.P(b, y0, d), F.P(b, y1, d), F.P(a, y1, d), color);
}

function surface(out, slot, points, color) {
  const indices = earcut(points.flatMap(([x, , z]) => [x, z]));
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => points[index]);
    const signed = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
    if (signed > 0) tri(out, slot, a, c, b, color);
    else tri(out, slot, a, b, c, color);
  }
}

function slab(out, points, y0, y1, wallColor, capColor, capSlot = 'paving') {
  edges(points, (a, b) => {
    const F = wallFace(a, b);
    panel(out, 'wall', F, 0, F.length, y0, y1, 0, wallColor);
  });
  surface(
    out,
    capSlot,
    points.map(([x, z]) => [x, y1, z]),
    capColor,
  );
}

function plaza(out, level) {
  const ring = shapes.watershedPlaza;
  const under = inset(ring, 0.96);
  slab(out, under, -5.4, plazaY - 0.18, concrete, paving);
  slab(out, ring, plazaY - 0.31, plazaY, concrete, paving);
  const parapet = plan.dimensions.plazaWallHeight;
  edges(ring, (a, b, i) => {
    const F = wallFace(a, b);
    if (i === 2 || i === 4) return;
    if (i === 0 || i === 7) {
      const from = i === 0 ? 2.75 : 0.0,
        to = i === 0 ? F.length : F.length - 2.45;
      fbox(out, 'wall', F, from, to, plazaY - 0.14, plazaY + parapet, -0.42, 0.08, deck);
    } else {
      fbox(out, 'wall', F, 0, F.length, plazaY - 0.14, plazaY + parapet, -0.42, 0.08, deck);
    }
    if (level > 1)
      fbox(
        out,
        'basin',
        F,
        0,
        F.length,
        plazaY + parapet - 0.052,
        plazaY + parapet + 0.018,
        -0.46,
        0.1,
        concrete,
      );
  });
  const [x, z] = site.fountainCenter;
  const wellY = plazaY + 0.12;
  lathe(
    out,
    'basin',
    [x, z],
    [
      [plazaY, 3.45, 3.45],
      [plazaY + 0.31, 3.45, 3.45],
      [plazaY + 0.38, 3.21, 3.21],
    ],
    [8, 12, 20, 24][level],
    concrete,
  );
  lathe(
    out,
    'water',
    [x, z],
    [
      [plazaY + 0.385, 2.79, 2.79],
      [plazaY + 0.392, 2.79, 2.79],
    ],
    [8, 12, 20, 24][level],
    water,
  );
  if (level === 0) return;
  if (level > 1) {
    const lineY = plazaY + 0.009;
    const subdivisions = inset(ring, 0.975);
    const [cx, cz] = center(ring);
    for (const fraction of [0.18, 0.43, 0.69, 0.86]) {
      const band = inset(ring, fraction);
      edges(band, (a, b) => {
        const F = wallFace(a, b);
        panel(out, 'joint', F, 0, F.length, lineY - 0.009, lineY, 0.007, joint);
        quad4(
          out,
          'joint',
          F.P(0, lineY, -0.035),
          F.P(F.length, lineY, -0.035),
          F.P(F.length, lineY, 0.035),
          F.P(0, lineY, 0.035),
          joint,
        );
      });
    }
    for (const [u, v] of subdivisions) {
      beam(
        out,
        'joint',
        [cx + (u - cx) * 0.13, lineY, cz + (v - cz) * 0.13],
        [u, lineY, v],
        0.047,
        0.014,
        joint,
      );
    }
  }
  for (const key of [1, 3, 6]) {
    const F = wallFace(ring[key], ring[(key + 1) % ring.length]);
    for (const offset of [-2.8, 2.8]) {
      const u = F.length / 2 + offset;
      fbox(out, 'wall', F, u - 2.06, u + 2.06, plazaY, plazaY + 0.42, -1.53, -0.9, roofDark);
      fbox(
        out,
        'basin',
        F,
        u - 2.12,
        u + 2.12,
        plazaY + 0.41,
        plazaY + 0.51,
        -1.6,
        -0.82,
        concrete,
      );
    }
  }
  if (level > 1) {
    lathe(
      out,
      'basin',
      [x, z],
      [
        [wellY, 0.38, 0.38],
        [wellY + 0.35, 0.53, 0.53],
        [wellY + 0.46, 0.18, 0.18],
      ],
      10,
      roofDark,
    );
  }
}

function shell(out, ring, y0, eave, rise, topRatio, level, main = false) {
  const foot = inset(ring, 0.925);
  edges(foot, (a, b, i) => {
    const F = wallFace(a, b);
    panel(out, 'wall', F, 0, F.length, y0, eave, 0, concrete);
    if (level === 0 || F.length < 3.1) return;
    const [x, , z] = F.P(F.length / 2, 0);
    const towardPlaza = main && z < 0;
    const n = Math.max(1, Math.round(F.length / (towardPlaza ? 1.65 : 3.1)));
    const glassY = towardPlaza ? Math.max(y0 + 0.55, plazaY + 0.1) : y0 + 1.45;
    const glassTop = Math.min(eave - 0.56, glassY + (towardPlaza ? 4.1 : 1.95));
    if (towardPlaza || x < -12 || x > 15 || z > 38) {
      panel(out, 'glass', F, F.length * 0.075, F.length * 0.925, glassY, glassTop, 0.025, glass);
      if (level > 1) {
        for (let j = 0; j <= n; j++) {
          const u = F.length * (0.075 + (0.85 * j) / n);
          const w = towardPlaza ? 0.075 : 0.1;
          fbox(out, 'railing', F, u - w, u + w, glassY, glassTop, 0.024, 0.064, metal);
        }
      }
    }
    if (level > 1) {
      for (let j = 1; j < n; j++) {
        const u = (F.length * j) / n;
        if (!towardPlaza || i % 2 === 0) {
          fbox(out, 'wall', F, u - 0.18, u + 0.18, y0, eave + 0.07, -0.06, 0.25, roofDark);
        }
      }
    }
  });
  const shoulder = ring.map(([x, z]) => [x, eave, z]);
  const collar = inset(ring, 0.91).map(([x, z]) => [x, eave + rise * 0.28, z]);
  const cap = inset(ring, topRatio).map(([x, z]) => [x, eave + rise, z]);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    quad4(out, 'roof', shoulder[i], shoulder[j], collar[j], collar[i], roofDark);
    quad4(out, 'roof', collar[i], collar[j], cap[j], cap[i], roof);
    if (level > 1) {
      const p = cap[i],
        q = collar[i];
      beam(
        out,
        'joint',
        [p[0], p[1] + 0.025, p[2]],
        [q[0], q[1] + 0.025, q[2]],
        0.075,
        0.022,
        joint,
      );
    }
  }
  surface(out, 'roof', cap, roof);
}

function connectingTerraces(out, level) {
  const rear = inset(shapes.rearTerrace, 0.89);
  const rearDeckY = 9.23;
  slab(out, rear, 4.5, rearDeckY, concrete, deck);
  const lobby = [
    [-9.2, 22.6],
    [10.2, 23.0],
    [11.5, 9.3],
    [8, 4],
    [-7, 5.2],
    [-11.0, 12.8],
  ];
  slab(out, outwardRing(lobby), -0.7, 9.22, concrete, roofDark, 'roof');
  for (const link of [
    [
      [-24.4, 22.1],
      [-7.8, 23.0],
      [-8, 35.6],
      [-22.8, 33.2],
    ],
    [
      [4.8, 22.5],
      [23.1, 23.4],
      [22.5, 33.7],
      [5.0, 34.6],
    ],
  ]) {
    slab(out, outwardRing(link), 0.4, 8.94, concrete, roof, 'roof');
  }
  if (level === 0) return;
  edges(rear, (a, b, i) => {
    if (i === 0 || i === 7 || i === 8) return;
    const F = wallFace(a, b);
    fbox(out, 'wall', F, 0, F.length, rearDeckY - 0.2, rearDeckY + 0.38, -0.28, 0.05, concrete);
    if (level > 1) {
      fbox(out, 'railing', F, 0, F.length, rearDeckY + 0.62, rearDeckY + 0.69, -0.16, -0.08, metal);
      for (let u = 0.65; u < F.length; u += 1.72) {
        fbox(
          out,
          'railing',
          F,
          u - 0.03,
          u + 0.03,
          rearDeckY + 0.36,
          rearDeckY + 0.65,
          -0.16,
          -0.08,
          metal,
        );
      }
    }
  });
}

function build(out, level) {
  plaza(out, level);
  connectingTerraces(out, level);
  shell(out, shapes.centralRoof, 0.12, 10.63, plan.dimensions.centralRoofRise, 0.63, level, true);
  shell(out, shapes.westRoof, -0.7, 10.55, plan.dimensions.wingRoofRise, 0.63, level);
  shell(out, shapes.eastRoof, 0.8, 11.17, plan.dimensions.wingRoofRise, 0.63, level);
  shell(out, shapes.midRoof, 1.2, 10.96, 2.55, 0.57, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'lawrence-hall-of-science-model.mjs';
const camera = [-118, 76, -114],
  lookAt = [0, 7, -4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Lawrence Hall of Science',
  wikidataId: plan.wikidataId,
  category: 'science-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The faceted concrete science hall and polygonal fountain plaza on the hillside above Berkeley.',
  camera,
  lookAt,
  sunDirection: [-46, 65, -18],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.93,
    basis: 'Named underground podium, plaza and museum perimeter from the current map.',
  },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'concrete_plain'],
  recipeDependencies: ['polygon-triangulation.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'main-plaza-and-entrance', position: [-26, 9.7, -62], lookAt: [4, 8, -1] },
    { name: 'roof-facets-and-southern-wings', position: [84, 68, 98], lookAt: [1, 9, 16] },
    { name: 'bay-facing-plaza-podium', position: [-88, 42, -16], lookAt: [-3, 5, -30] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lawrence-hall-of-science-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.67,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.29, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.034, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model under repository license. Footprint © OpenStreetMap contributors. USDA NAIP imagery and USGS 3DEP are public domain.',
};
