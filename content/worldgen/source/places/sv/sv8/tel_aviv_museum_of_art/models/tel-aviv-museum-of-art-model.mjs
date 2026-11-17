/** Shaul HaMelech main galleries and the folded Herta and Paul Amir wing. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { main, connected, amir } = read('map-frame').geometry;
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    plaster: 'cfcbb8',
    cream: 'd9d4c2',
    pale: 'e1dac7',
    seams: 'b2ad9f',
    textured: 'a5a293',
    stone: 'b6b1a1',
    base: 'a6a599',
    roof: '8d9187',
    parapet: '9f9d91',
    concrete: 'bbb9ad',
    glacier: 'cdcbbf',
    grey: 'bfbfb4',
    mist: 'b3b4aa',
    glass: '465854',
    skylight: '829795',
    iron: '727b71',
    metal: 'c2bdad',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  texture: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92, metallic: 0.07 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.76 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const up = [0, 1, 0];
const south = [-1, 0, 0];
const bounds = d.mainFacadeSidesZ;
const front = d.mainFrontX;
const floor = d.mainFloorY;

function face(out, slot, points, facing, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * facing[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function winding(ring) {
  return Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [nx, nz] = ring[(i + 1) % ring.length];
      return sum + x * nz - nx * z;
    }, 0),
  );
}

function cover(out, slot, ring, heights, tint) {
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((j) => [ring[j][0], heights[j], ring[j][1]]),
      up,
      tint,
    );
}

function walls(out, ring, y0, y1, tint, openFront = false) {
  const sign = winding(ring);
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [nx, nz] = ring[(i + 1) % ring.length];
    if (openFront && (i === 14 || i === 15)) {
      face(
        out,
        'concrete',
        [
          [x, y0, z],
          [nx, y0, nz],
          [nx, floor - 0.08, nz],
          [x, floor - 0.08, z],
        ],
        [sign * (nz - z), 0, sign * (x - nx)],
        c.base,
      );
      continue;
    }
    face(
      out,
      'concrete',
      [
        [x, y0, z],
        [nx, y0, nz],
        [nx, y1, nz],
        [x, y1, z],
      ],
      [sign * (nz - z), 0, sign * (x - nx)],
      tint,
    );
  }
  cover(out, 'roof', ring, Array(ring.length).fill(y1), c.roof);
}

function entranceGlazing(out, detail) {
  const y1 = d.mainSlabBottom;
  const x = front + d.mainLobbyDepth;
  const z0 = 19.05;
  const z1 = bounds[1] + 0.02;
  box(out, 'glass', x, floor, (z0 + z1) / 2, 0.31, y1 - floor + 0.04, z1 - z0, c.glass);
  box(
    out,
    'concrete',
    (x + front) / 2,
    floor - 0.2,
    (bounds[0] + z1) / 2,
    x - front + 0.92,
    0.2,
    z1 - bounds[0] + 0.35,
    c.stone,
  );
  const uprights = detail <= 1 ? 7 : detail === 2 ? 15 : 24;
  for (let i = 0; i <= uprights; i++) {
    const z = z0 + ((z1 - z0) * i) / uprights;
    box(out, 'trim', x - 0.183, floor + 0.013, z, 0.15, y1 - floor + 0.05, 0.094, c.iron);
  }
  for (const z of [20.19, 30.11, 41.85]) {
    if (detail === 0)
      box(out, 'concrete', front + 0.31, floor, z, 0.61, y1 - floor + 0.025, 0.61, c.stone);
    else
      profile(
        out,
        [
          [floor, 0.32, 0.32],
          [y1 + 0.02, 0.32, 0.32, 'concrete', c.stone],
        ],
        detail > 1 ? 10 : 6,
        [front + 0.31, z],
      );
  }
}

function rampSkylight(out, detail) {
  const x0 = front - 5.0;
  const x1 = front + 0.1;
  const z0 = 6.33;
  const z1 = 21.47;
  const y0 = 0.36;
  const y1 = d.mainSlabBottom + 0.33;
  face(
    out,
    'glass',
    [
      [x0, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y0, z1],
    ],
    up,
    c.skylight,
  );
  for (const [z, n] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ])
    face(
      out,
      'wall',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
      ],
      n,
      c.stone,
    );
  const divisions = [3, 5, 7, 11][detail];
  for (let i = 0; i <= divisions; i++) {
    const z = z0 + ((z1 - z0) * i) / divisions;
    beamPath(
      out,
      'trim',
      [
        [x0, y0 + 0.041, z],
        [x1, y1 + 0.041, z],
      ],
      0.07,
      0.06,
      c.metal,
    );
  }
  if (detail >= 2) {
    for (const place of [0.32, 0.64, 0.96]) {
      const x = x0 + (x1 - x0) * place;
      const y = y0 + (y1 - y0) * place + 0.047;
      beamPath(
        out,
        'trim',
        [
          [x, y, z0],
          [x, y, z1],
        ],
        0.052,
        0.061,
        c.metal,
      );
    }
  }
}

function mainMassing(out, detail) {
  walls(out, main, -8.6, d.mainSlabBottom - 0.06, c.textured, true);
  const blocks = [
    [-14.2, 61.27, 36.75, 21.93, 13.28, c.stone],
    [12.1, 11.55, 34.65, 22.66, 12.5, c.textured],
    [13.1, -9.78, 21.15, 24.38, 10.6, c.stone],
    [-8.87, 25.7, 20.7, 31.75, 16.27, c.textured],
    [-6.15, 51.66, 13.27, 5.55, 14.12, c.stone],
  ];
  for (const [x, z, width, depth, top, tint] of blocks) {
    const y = d.mainSlabBottom - 0.08;
    box(out, 'concrete', x, y, z, width, top - y, depth, tint);
    box(out, 'roof', x, top, z, width - 0.09, 0.19, depth - 0.09, c.roof);
  }
  const slabBack = -15.1;
  const span = bounds[1] - bounds[0];
  const middle = (bounds[0] + bounds[1]) / 2;
  box(
    out,
    'wall',
    (front + slabBack) / 2,
    d.mainSlabBottom,
    middle,
    slabBack - front + 0.16,
    d.mainGalleryTop - d.mainSlabBottom,
    span,
    c.cream,
  );
  box(
    out,
    'texture',
    (front + slabBack) / 2,
    d.mainGalleryTop,
    middle,
    slabBack - front + 0.21,
    d.mainCopingY - d.mainGalleryTop,
    span + 0.14,
    c.textured,
  );
  box(
    out,
    'roof',
    (front + slabBack) / 2,
    d.mainCopingY,
    middle,
    slabBack - front + 0.16,
    0.14,
    span + 0.03,
    c.roof,
  );
  box(out, 'texture', -21.84, 4.2, 46.82, 5.81, d.estimatedTowerY - 4.2, 4.48, c.textured);
  box(out, 'concrete', -21.84, d.estimatedTowerY, 46.82, 5.99, 0.31, 4.64, c.parapet);

  // The raised upper screen behind the light stone gallery has a single sloping shoulder.
  const corners = [
    [-18.75, 13.42, 13.15],
    [-18.75, 16.34, 13.15],
    [-18.75, 18.59, 25.9],
    [-18.75, 13.42, 25.9],
  ];
  const back = corners.map(([x, y, z]) => [x + 9.26, y, z]);
  face(out, 'texture', corners, south, c.textured);
  face(out, 'texture', back, [1, 0, 0], c.textured);
  face(out, 'texture', [corners[0], corners[1], back[1], back[0]], [0, 0, -1], c.textured);
  face(out, 'texture', [corners[3], corners[2], back[2], back[3]], [0, 0, 1], c.textured);
  face(out, 'roof', [corners[1], corners[2], back[2], back[1]], up, c.roof);
  entranceGlazing(out, detail);
  rampSkylight(out, detail);

  if (detail >= 1) {
    const rowSpacing = detail === 1 ? 2.02 : detail === 2 ? 1.1 : 0.91;
    const columnSpacing = detail === 1 ? 3.3 : detail === 2 ? 2.08 : 1.48;
    for (let y = d.mainSlabBottom + rowSpacing; y < d.mainGalleryTop - 0.2; y += rowSpacing) {
      const x = front - 0.096;
      face(
        out,
        'trim',
        [
          [x, y, bounds[0]],
          [x, y + 0.025, bounds[0]],
          [x, y + 0.025, bounds[1]],
          [x, y, bounds[1]],
        ],
        south,
        c.seams,
      );
      for (let z = bounds[0] + columnSpacing; z < bounds[1] - 0.2; z += columnSpacing) {
        const u = z + ((Math.round((y - d.mainSlabBottom) / rowSpacing) % 2) * columnSpacing) / 2;
        if (u > bounds[1] - 0.16) continue;
        face(
          out,
          'trim',
          [
            [x, y - rowSpacing + 0.024, u],
            [x, y, u],
            [x, y, u + 0.021],
            [x, y - rowSpacing + 0.024, u + 0.021],
          ],
          south,
          c.seams,
        );
      }
    }
  }
  walls(out, connected, -8.5, 7.1, c.concrete);
}

const amirWaist = [
  [0.8, -1.6],
  [0.1, 2.05],
  [-0.48, -1.84],
  [1.95, -1.17],
  [0.21, 1.98],
  [1.29, -1.92],
  [-0.53, 0.94],
  [-1.83, 0.87],
  [0.67, -1.73],
];
const amirTop = [7.35, 7.8, 8.65, 8.13, 8.5, 8.03, 7.46, 6.79, 7.1];

function amirWing(out, detail) {
  const sign = winding(amir);
  const floor = d.amirEntranceY;
  const y0 = d.amirFoundationY;
  const upperBase = amir.map(([x, z], i) => [
    x + amirWaist[i][0] * 0.33,
    z + amirWaist[i][1] * 0.32,
  ]);
  const n = amir.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x, z] = amir[i];
    const [nx, nz] = amir[j];
    const facing = [sign * (nz - z), 0, sign * (x - nx)];
    face(
      out,
      'concrete',
      [
        [x, y0, z],
        [nx, y0, nz],
        [nx, floor, nz],
        [x, floor, z],
      ],
      facing,
      c.base,
    );
    const along =
      i === 1
        ? [0, 0.19, 0.46, 0.65, 0.82, 0.91, 1]
        : detail === 0
          ? [0, 1]
          : detail === 1
            ? [0, 0.51, 1]
            : [0, 0.24, 0.49, 0.74, 1];
    const heights =
      detail === 0
        ? [0, 0.32, 0.66, 1]
        : detail === 3
          ? [0, 0.15, 0.32, 0.47, 0.63, 0.8, 1]
          : [0, 0.32, 0.62, 1];
    const coordinate = (v, t) => {
      const blend = 4 * t * (1 - t);
      const xa = x + (upperBase[i][0] - x) * t + amirWaist[i][0] * blend;
      const xb = nx + (upperBase[j][0] - nx) * t + amirWaist[j][0] * blend;
      const za = z + (upperBase[i][1] - z) * t + amirWaist[i][1] * blend;
      const zb = nz + (upperBase[j][1] - nz) * t + amirWaist[j][1] * blend;
      return [
        xa + (xb - xa) * v,
        floor + (amirTop[i] + (amirTop[j] - amirTop[i]) * v - floor) * t,
        za + (zb - za) * v,
      ];
    };
    for (let a = 0; a < along.length - 1; a++) {
      for (let b = 0; b < heights.length - 1; b++) {
        const start = along[a];
        const end = along[a + 1];
        const low = heights[b];
        const high = heights[b + 1];
        const p = [
          coordinate(start, low),
          coordinate(end, low),
          coordinate(end, high),
          coordinate(start, high),
        ];
        const glazing = i === 1 && low < 0.32 && start >= 0.65 && end < 0.92;
        const slot = glazing ? 'glass' : 'concrete';
        const tint = glazing ? c.glass : i % 3 === 0 ? c.cream : c.glacier;
        const darker = glazing ? c.glass : b % 3 === 1 ? c.mist : c.grey;
        face(out, slot, [p[0], p[1], p[2]], facing, tint);
        face(out, slot, [p[0], p[2], p[3]], facing, darker);
        if (detail >= 2 && !glazing) {
          const length = Math.hypot(...facing);
          const seam = p
            .slice(1, 3)
            .map((point) => point.map((v, k) => v + (facing[k] / length) * 0.015));
          beamPath(out, 'trim', seam, 0.033, 0.027, c.seams);
        }
      }
    }
  }
  cover(out, 'roof', upperBase, amirTop, c.roof);
  // A broad low projecting stair volume and a modest glazed roof lantern.
  box(out, 'concrete', -23.6, -6.41, -32.55, 19.05, 0.69, 3.8, c.stone);
  const skylight = [
    [-6.8, 8.18, -67],
    [7.4, 8.55, -60.5],
    [4.76, 8.27, -76.2],
  ];
  face(out, 'glass', skylight, up, c.skylight);
  if (detail >= 2) beamPath(out, 'trim', skylight, 0.21, 0.13, c.metal, true);
}

function draw(out, detail) {
  mainMassing(out, detail);
  amirWing(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-152, 65, 111];
const lookAt = [-4, 5.5, -17.2];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: 'Q1267958',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Tel Aviv Museum of Art combines the lifted pale limestone gallery and recessed entrance of the main building with the angular pale concrete Amir wing.',
  camera,
  lookAt,
  sunDirection: [-74, 110, 62],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'concrete_plain',
    'concrete_boardformed',
    'metal_standing_seam',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'main-foyer-and-stone-cantilever', position: [-99, 11, 51], lookAt: [-34, 8.1, 26] },
    { name: 'amir-wing-folded-facets', position: [-82, 28, -82], lookAt: [-11, 1.4, -58] },
    { name: 'museum-campus-massing', position: [119, 87, -125], lookAt: [-2, 5.0, -22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.54,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.63, surfaces },
      street: { export: 'street', errorMeters: 0.3, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.095, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact public-domain Qualla photograph of the main building, factual architectural descriptions, native mapping and original terrain.',
};
