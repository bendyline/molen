/** The hilltop mosque and its Koutoubia-style tower at Coquimbo. */
import fs from 'node:fs';
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
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const ref = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    sandstone: 'bd9979',
    plaster: 'cfa985',
    light: 'dfbd9a',
    band: 'c5a47c',
    base: 'a48b72',
    roof: '9a8c78',
    deep: '88654f',
    relief: 'ad845f',
    jade: '697a60',
    darkJade: '546751',
    ivory: 'd0c6a5',
    brass: 'a88a54',
    wood: '624e42',
    glass: '50564e',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.92 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.62 },
  trim: { slot: 'trim', localRef: ref, roughness: 0.84 },
  glass: { slot: 'window', localRef: ref, roughness: 0.66 },
};

function facade(x, z, depth, side) {
  const angles = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];
  const [nx, nz] = angles[side];
  return {
    normal: [nx, 0, nz],
    p: (u, y, off = 0) => [x + nx * (depth + off) + nz * u, y, z + nz * (depth + off) - nx * u],
  };
}

function panel(out, face, slot, x0, x1, y0, y1, depth, tint) {
  quad(
    out,
    slot,
    [face.p(x0, y0, depth), face.p(x1, y0, depth), face.p(x1, y1, depth), face.p(x0, y1, depth)],
    face.normal,
    tint,
  );
}

function arch(out, face, offset, y, width, height, steps, door = false) {
  const radius = width / 2;
  const curve = Math.min(height * 0.4, radius * 0.95);
  const shoulder = y + height - curve;
  panel(
    out,
    face,
    door ? 'trim' : 'stone',
    offset - radius,
    offset + radius,
    y,
    shoulder,
    0.042,
    door ? c.wood : c.deep,
  );
  panel(out, face, 'wall', offset - radius - 0.13, offset - radius, y, shoulder, 0.078, c.light);
  panel(out, face, 'wall', offset + radius, offset + radius + 0.13, y, shoulder, 0.078, c.light);
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / steps,
      b = ((i + 1) * Math.PI) / steps;
    const point = (theta, extra, depth) =>
      face.p(
        offset + Math.cos(theta) * (radius + extra),
        shoulder + Math.sin(theta) * (curve + extra),
        depth,
      );
    out.addTriangle(
      door ? 'trim' : 'stone',
      ref,
      [face.p(offset, shoulder, 0.042), point(a, 0, 0.042), point(b, 0, 0.042)],
      face.normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      door ? c.wood : c.deep,
    );
    quad(
      out,
      'wall',
      [point(a, 0, 0.07), point(a, 0.14, 0.078), point(b, 0.14, 0.078), point(b, 0, 0.07)],
      face.normal,
      c.light,
    );
  }
}

function dome(out, x, z, y, r, h, sides, tint) {
  profile(
    out,
    [
      [y, r, r],
      [y + h * 0.08, r, r, 'roof', tint],
      [y + h * 0.53, r * 0.86, r * 0.86, 'roof', tint],
      [y + h * 0.83, r * 0.52, r * 0.52, 'roof', tint],
      [y + h, r * 0.08, r * 0.08, 'roof', tint],
      [y + h + 0.012, r * 0.008, r * 0.008, 'roof', tint],
    ],
    sides,
    [x, z],
  );
}

function shell(out, slot, low, high, tint) {
  const sign = Math.sign(
    outline.reduce((sum, [x, z], i) => {
      const [nx, nz] = outline[(i + 1) % outline.length];
      return sum + x * nz - nx * z;
    }, 0),
  );
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i],
      [nx, nz] = outline[(i + 1) % outline.length];
    quad(
      out,
      slot,
      [
        [x, low, z],
        [nx, low, nz],
        [nx, high, nz],
        [x, high, z],
      ],
      [sign * (nz - z), 0, sign * (x - nx)],
      tint,
    );
  }
  const cap = earcut(outline.flat());
  for (let i = 0; i < cap.length; i += 3) {
    const points = cap.slice(i, i + 3).map((index) => [outline[index][0], high, outline[index][1]]);
    out.addTriangle(
      slot,
      ref,
      points,
      [0, 1, 0],
      points.map(([x, , z]) => [x, z]),
      tint,
    );
  }
}

function hall(out, detail) {
  const y = d.mainFloorY;
  shell(out, 'stone', d.foundationY, y, c.base);
  shell(out, 'wall', y, d.hallRoofY - 0.24, c.plaster);
  shell(out, 'roof', d.hallRoofY - 0.26, d.hallRoofY, c.roof);
  const face = facade(10.019, -3.9, 0, 1);
  arch(out, face, 5.4, y, 1.78, 3.5, detail > 1 ? 12 : 6, true);
  const bays = [-4.17, -0.26, 3.61];
  for (const u of bays) {
    arch(out, face, u, 4.75, 1.36, 2.7, detail > 1 ? 10 : 5);
    panel(out, face, 'glass', u - 0.4, u + 0.4, 4.91, 6.25, 0.063, c.glass);
  }
  if (detail) {
    panel(out, face, 'stone', -7.0, 7.09, 8.0, 8.26, 0.07, c.band);
    panel(out, face, 'tile', -7.0, 7.09, 8.32, 8.51, 0.08, c.jade);
    panel(out, face, 'stone', -7.0, 7.09, 8.57, 8.82, 0.072, c.light);
    for (const u of bays) panel(out, face, 'trim', u - 0.046, u + 0.046, 4.9, 6.25, 0.083, c.wood);
    for (const x of [-3.85, 0.15, 4.15]) {
      const south = facade(0, 5.7, 0, 0);
      panel(out, south, 'glass', x - 0.28, x + 0.28, 3.54, 4.92, 0.07, c.glass);
    }
  }
  for (let i = 0; i < 3; i++) {
    box(
      out,
      'stone',
      10.19 + i * 0.27,
      y - 0.18 * (i + 1),
      -9.32,
      0.83,
      0.18,
      2.3 + i * 0.15,
      c.band,
    );
  }
  const cupola = [6, 10, 15, 18][detail];
  dome(out, 2.1, -2.14, d.hallRoofY, 1.93, d.prayerCupolaY - d.hallRoofY, cupola, c.jade);
  if (detail >= 1) dome(out, -0.1, 3.37, d.hallRoofY, 1.14, 1.08, cupola, c.jade);
}

function crown(out, x, z, side, y, detail) {
  box(out, 'stone', x, y, z, side + 0.29, 0.28, side + 0.29, c.band);
  box(out, 'tile', x, y + 0.28, z, side + 0.16, 0.47, side + 0.16, c.jade);
  box(out, 'stone', x, y + 0.75, z, side + 0.31, 0.27, side + 0.31, c.light);
  const count = [3, 5, 6, 7][detail];
  for (let orientation = 0; orientation < 4; orientation++) {
    const face = facade(x, z, side / 2 + 0.05, orientation);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * side) / count - side / 2;
      const w = (side / count) * 0.65;
      if (detail > 0) {
        const p = face.p(u, y + 1.02);
        box(
          out,
          'stone',
          p[0],
          p[1],
          p[2],
          orientation % 2 === 0 ? w : 0.28,
          0.34,
          orientation % 2 === 0 ? 0.28 : w,
          c.band,
        );
      } else {
        panel(out, face, 'stone', u - w / 2, u + w / 2, y + 1.02, y + 1.36, 0.147, c.band);
      }
      const points = [
        face.p(u - w / 2, y + 1.36, 0.147),
        face.p(u + w / 2, y + 1.36, 0.147),
        face.p(u, y + 1.69, 0.147),
      ];
      out.addTriangle(
        'stone',
        ref,
        points,
        face.normal,
        [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ],
        c.light,
      );
    }
  }
}

function fretwork(out, face, y, detail) {
  if (detail < 2) return;
  const rows = detail === 3 ? 5 : 3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < 4; i++) {
      const u = (i - 1.5) * 0.68 + (j % 2 ? 0.09 : -0.09);
      const cy = y + j * 0.75;
      quad(
        out,
        'stone',
        [
          face.p(u - 0.25, cy, 0.074),
          face.p(u, cy - 0.29, 0.074),
          face.p(u + 0.25, cy, 0.074),
          face.p(u, cy + 0.29, 0.074),
        ],
        face.normal,
        (i + j) % 2 ? c.relief : c.sandstone,
      );
    }
  }
}

function tower(out, detail) {
  const [x, z] = d.towerCenter;
  const w = d.towerSide;
  box(out, 'stone', x, d.mainFloorY, z, w, 4.72, w, c.base);
  box(out, 'wall', x, 4.8, z, w, d.mainShaftY - 4.8, w, c.sandstone);
  box(out, 'stone', x, 10.04, z, w + 0.12, 0.28, w + 0.12, c.band);
  box(out, 'stone', x, 19.62, z, w + 0.08, 0.16, w + 0.08, c.band);
  const secondary = 3.45;
  box(out, 'wall', x, 32.49, z, secondary, 6.07, secondary, c.plaster);
  crown(out, x, z, w, d.mainShaftY - 1.0, detail);
  crown(out, x, z, secondary, d.lanternTopY - 1.75, detail);
  dome(out, x, z, d.lanternTopY - 0.15, 1.17, 1.38, [6, 10, 15, 18][detail], c.sandstone);
  for (const [base, r, h] of detail
    ? [
        [40.55, 0.34, 0.48],
        [41.1, 0.27, 0.38],
        [41.65, 0.19, 0.31],
      ]
    : []) {
    dome(out, x, z, base, r, h, detail > 1 ? 12 : 8, c.brass);
  }
  profile(
    out,
    [
      [40.44, 0.081, 0.081],
      [d.minaretTopY, 0.045, 0.045, 'trim', c.brass],
    ],
    detail > 1 ? 8 : 5,
    [x, z],
  );
  for (let side = 0; side < 4; side++) {
    const face = facade(x, z, w / 2, side);
    const top = facade(x, z, secondary / 2, side);
    const windowY = 11.8 + (side % 2) * 1.54;
    arch(out, face, 0, windowY, 1.64, 4.5, detail > 1 ? 10 : 5);
    for (const offset of detail ? [-0.94, 0.94] : [0])
      arch(out, face, offset, 24.6, 1.18, 3.15, detail > 1 ? 9 : 5);
    if (detail) {
      panel(out, face, 'wall', -1.63, 1.63, 23.9, 24.1, 0.077, c.light);
      panel(out, face, 'stone', -1.63, 1.63, 27.96, 28.09, 0.07, c.band);
      panel(out, face, 'tile', -w * 0.46, w * 0.46, 30.25, 30.54, 0.064, c.darkJade);
      arch(out, top, 0, 34.42, 1.15, 2.09, detail > 1 ? 8 : 4);
      fretwork(out, face, 20.42, detail);
    }
  }
}

function draw(out, detail) {
  hall(out, detail);
  tower(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => {
  draw(out, 3);
  const face = facade(10.03, -3.9, 0, 1);
  for (const u of [-4.17, -0.26, 3.61]) {
    panel(out, face, 'trim', u - 0.33, u + 0.33, 5.35, 5.415, 0.09, c.wood);
  }
};

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [72, 51, 56];
const lookAt = [1, 18, -1.8];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Coquimbo mosque and cultural center on Cerro Dominante, with its pale hall and tall square Koutoubia-style minaret.',
  camera,
  lookAt,
  sunDirection: [59, 85, 51],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_sandstone', 'tile_mosaic'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.86,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'hilltop-tower-and-hall', position: [47, 29, 37], lookAt: [1, 17, -1] },
    { name: 'mosque-east-entrance', position: [26, 8, -12], lookAt: [9.6, 4.6, -5.8] },
    { name: 'minaret-crown-and-lantern', position: [16, 47, 18], lookAt: [-4, 31.5, -3] },
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
    errorMeters: 1.34,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.61, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on current native OSM footprint controls, operator and agency written facts and public Terrarium terrain. No reference imagery used.',
};
