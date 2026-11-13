/** The three buildings and rose trellis at the Sacred Heart parish in Tombstone. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const [churchOutline, rectoryOutline, hallOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  metalRoof: { slot: 'roof', graph: 'metal_painted', roughness: 0.75, metallic: 0.17 },
  shingle: { slot: 'roof', graph: 'slate', roughness: 0.96, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0 },
  plants: { slot: 'trim', localRef: 'palette:#fefefe', roughness: 0.99, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    cream: 'd4cdb8',
    light: 'e4dfcb',
    shade: 'c2bba8',
    base: 'aca895',
    porch: 'd9d6ca',
    roof: 'd6d7ce',
    hallRoof: 'babcb5',
    darkRoof: '61584e',
    edge: '6d4d42',
    timber: '846551',
    rail: '484947',
    glass: '4c5a58',
    amber: '9c8557',
    greenGlass: '6c7663',
    door: '614638',
    greenery: '636e4e',
    leaf: '78835c',
    vine: '665140',
    terracotta: 'a67c68',
    red: 'a05247',
  }).map(([name, value]) => [name, rgb(value)]),
);

const rect = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tint);
const wrap = (out, slot, points, direction, tint) => {
  const n = normalFor(...points);
  face(
    out,
    slot,
    n.reduce((sum, v, i) => sum + v * direction[i], 0) > 0 ? points : points.toReversed(),
    tint,
  );
};
const cross = (out, x, y, z, size, tint) => {
  box(out, 'wood', x, y, z, size * 0.12, size, size * 0.1, tint);
  box(out, 'wood', x, y + size * 0.62, z, size * 0.62, size * 0.12, size * 0.1, tint);
};

function gabledRoof(out, x0, x1, z0, z1, eave, ridge, material, tint, lod, ribs) {
  const x = (x0 + x1) / 2;
  for (const [edge, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    wrap(
      out,
      material,
      [
        [edge, eave, z0],
        [edge, eave, z1],
        [x, ridge, z1],
        [x, ridge, z0],
      ],
      [0, 1, 0],
      tint,
    );
    if (!lod) continue;
    box(out, 'wood', edge, eave - 0.15, (z0 + z1) / 2, 0.15, 0.15, z1 - z0, c.edge);
    for (const z of [z0, z1]) {
      beam(out, 'wood', [edge, eave - 0.06, z], [x, ridge - 0.05, z], 0.18, 0.17, c.edge);
    }
    if (lod < 2 || !ribs) continue;
    const interval = lod === 3 ? 0.37 : 0.74;
    for (let z = z0 + 0.16; z < z1 - 0.13; z += interval) {
      beam(
        out,
        material,
        [edge - sign * 0.04, eave + 0.022, z],
        [x, ridge + 0.022, z],
        0.032,
        0.037,
        tint,
      );
    }
  }
  const end = (z, sign) => {
    const p = [
      [x0, eave - 0.13, z],
      [x1, eave - 0.13, z],
      [x, ridge - 0.08, z],
    ];
    triangle(out, 'stucco', sign > 0 ? p : p.toReversed(), c.cream);
  };
  end(z0 + 0.35, -1);
  end(z1 - 0.35, 1);
  if (lod) beam(out, material, [x, ridge + 0.03, z0], [x, ridge + 0.03, z1], 0.17, 0.105, tint);
}

function window(out, x, y, z, width, height, lod, stained) {
  box(out, 'wood', x, y - 0.09, z, width + 0.19, height + 0.18, 0.11, c.porch);
  box(out, 'glass', x, y, z + 0.06, width, height, 0.035, c.glass);
  if (lod >= 2) {
    box(out, 'wood', x, y, z + 0.085, 0.042, height, 0.037, c.edge);
    box(out, 'wood', x, y + height * 0.48, z + 0.085, width, 0.047, 0.037, c.edge);
    if (stained) {
      const w = width * 0.24,
        h = height * 0.18;
      for (const sign of [-1, 1]) {
        const m = x + sign * width * 0.21,
          yy = y + height * 0.66;
        face(
          out,
          'glass',
          [
            [m - w, yy, z + 0.087],
            [m, yy - h, z + 0.087],
            [m + w, yy, z + 0.087],
            [m, yy + h, z + 0.087],
          ],
          sign < 0 ? c.greenGlass : c.amber,
        );
      }
    }
  }
}

function rail(out, points, lod) {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const at = ([x, y, z], h) => [x, y + h, z];
    beam(out, 'wood', at(a, 0.89), at(b, 0.89), 0.062, 0.064, c.rail);
    const spacing = lod === 1 ? 0.63 : lod === 2 ? 0.36 : 0.23;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / spacing));
    for (let j = 0; j <= n; j++) {
      if (i > 1 && !j) continue;
      const base = a.map((v, axis) => v + ((b[axis] - v) * j) / n);
      beam(out, 'wood', base, at(base, 0.89), 0.038, 0.042, c.rail);
    }
  }
}

function newChurch(out, lod) {
  const { floor, eave, ridge } = plan.section.church;
  rect(out, 'foundation', -7.56, 7.56, -0.92, floor, -9.12, 9.13, c.base);
  for (const [a, b] of [
    [-7.55, -1.95],
    [1.95, 7.55],
  ]) {
    rect(out, 'stucco', a, b, floor, eave, 8.66, 9.12, c.cream);
  }
  rect(out, 'stucco', -1.95, 1.95, 2.96, eave, 8.66, 9.12, c.cream);
  rect(out, 'wood', -1.91, 1.91, floor, 2.95, 8.55, 8.68, c.door);
  for (const sign of [-1, 1]) {
    box(out, 'stucco', sign * 7.33, floor, -0.22, 0.44, eave - floor, 17.85, c.cream);
  }
  rect(out, 'stucco', -7.38, 7.38, floor, eave, -9.1, -8.67, c.shade);
  gabledRoof(out, -7.9, 7.9, -9.45, 9.5, eave, ridge, 'metalRoof', c.roof, lod, true);
  cross(out, 0, ridge + 0.03, 9.19, 0.96, c.rail);
  rect(out, 'foundation', -5.8, 5.2, -0.44, floor, 9.13, 10.33, c.light);
  rect(out, 'foundation', -3.02, 1.88, -0.3, 0.13, 10.33, 10.73, c.base);
  if (!lod) return;
  for (const sign of [-1, 1]) {
    for (const z of [-6.4, -0.45, 5.5]) {
      box(out, 'stucco', sign * 7.61, floor + 0.03, z, 0.22, eave - floor - 0.14, 0.27, c.light);
    }
    const side = transform(out, (sign * Math.PI) / 2, [sign * 7.56, 0, 0]);
    for (const z of [-7.25, -3.23, -1.65, 2.14, 3.74, 6.8]) {
      window(side, -sign * z, 1.71, 0.02, 1.0, 2.13, lod, true);
    }
  }
  box(out, 'wood', 0, floor + 0.01, 8.72, 0.075, 2.63, 0.11, c.edge);
  box(out, 'stucco', 0, 3.49, 9.19, 0.79, 0.2, 0.31, c.light);
  if (lod >= 2) {
    loft(
      out,
      'wood',
      [
        [3.69, 0.14],
        [4.19, 0.1],
        [4.3, 0.066],
      ].map(([y, r]) => radialRing(y, r, r * 0.81, 7, [0, 9.26])),
      c.red,
    );
  }
  rail(
    out,
    [
      [-5.7, floor, 9.2],
      [-5.7, floor, 10.28],
      [-2.9, floor, 10.28],
    ],
    lod,
  );
  rail(
    out,
    [
      [1.95, floor, 10.28],
      [5.08, floor, 10.28],
      [5.08, floor, 9.2],
    ],
    lod,
  );
  const east = transform(out, Math.PI / 2, [7.58, 0, -5.1]);
  box(east, 'wood', 0, floor + 0.1, 0.025, 1.08, 2.24, 0.105, c.door);
  rect(out, 'foundation', 7.56, 8.75, -0.49, 0.34, -5.76, -4.39, c.base);
  rail(
    out,
    [
      [8.66, 0.34, -5.72],
      [8.66, 0.3, -4.44],
      [8.66, -0.11, -2.63],
    ],
    lod,
  );
}

function rectory(out, lod) {
  const { floor, eave, ridge } = plan.section.rectory;
  const x0 = -26.48,
    x1 = -15.97,
    z0 = -3.92,
    front = 4.13;
  rect(out, 'foundation', x0, x1, -1.1, floor, z0, 6.66, c.base);
  rect(out, 'stucco', x0, x1, floor, eave, z0, front, c.light);
  const roof = transform(out, Math.PI / 2, [-21.225, 0, 0.12]);
  gabledRoof(roof, -4.38, 4.35, -5.6, 5.6, eave, ridge, 'shingle', c.darkRoof, lod, false);
  wrap(
    out,
    'shingle',
    [
      [x0 - 0.17, 2.5, 6.8],
      [x1 + 0.17, 2.5, 6.8],
      [x1 + 0.17, 3.17, 4.06],
      [x0 - 0.17, 3.17, 4.06],
    ],
    [0, 1, 0],
    c.darkRoof,
  );
  box(out, 'wood', -21.2, 2.37, 6.67, 10.86, 0.15, 0.19, c.porch);
  for (const x of [-26.15, -23.63, -21.22, -18.81, -16.25]) {
    box(out, 'wood', x, floor, 6.53, 0.14, 2.69, 0.15, c.porch);
    if (lod >= 2) {
      beam(out, 'wood', [x - 0.28, 2.38, 6.53], [x, 2.05, 6.53], 0.058, 0.078, c.porch);
      beam(out, 'wood', [x + 0.28, 2.38, 6.53], [x, 2.05, 6.53], 0.058, 0.078, c.porch);
    }
  }
  for (const x of [-23.78, -18.94]) {
    rect(out, 'stucco', x - 0.63, x + 0.63, 4.12, 5.22, 1.39, 2.86, c.light);
    gabledRoof(out, x - 0.76, x + 0.76, 1.1, 3.11, 5.17, 5.76, 'shingle', c.darkRoof, lod, false);
    window(out, x, 4.2, 2.88, 0.55, 0.87, lod, false);
  }
  if (!lod) return;
  box(out, 'wood', -21.19, floor, front + 0.026, 1.02, 2.29, 0.13, c.shade);
  for (const x of [-24.67, -17.91]) window(out, x, 0.38, front + 0.05, 0.93, 1.24, lod, false);
  const east = transform(out, Math.PI / 2, [x1, 0, 0]);
  window(east, -0.22, 0.42, 0.055, 0.94, 1.29, lod, false);
}

function oldHall(out, lod) {
  const { floor, eave, ridge } = plan.section.hall;
  const east = transform(out, Math.PI / 2, [-21.35, 0, -10.28]);
  rect(east, 'foundation', -4.02, 4.02, -1.55, floor, -6.02, 5.91, c.base);
  rect(east, 'stucco', -4.02, 4.02, floor, eave, -6.02, 5.91, c.cream);
  gabledRoof(east, -4.25, 4.25, -6.24, 6.23, eave, ridge, 'metalRoof', c.hallRoof, lod, true);
  cross(east, 0, ridge - 0.03, 6.08, 1.02, c.porch);
  box(east, 'wood', 0, floor, 5.96, 2.18, 1.93, 0.085, c.edge);
  box(east, 'wood', 0, floor + 0.07, 6.014, 1.9, 1.77, 0.053, c.porch);
  const tip = [0, floor + 3.21, 6.016];
  for (const sign of [-1, 1]) {
    const start = [sign * 1.09, floor + 1.91, 6.016];
    const middle = [sign * 0.74, floor + 2.58, 6.016];
    beamPath(east, 'wood', [start, middle, tip], 0.13, 0.086, c.edge);
    if (lod >= 2) beam(east, 'wood', [0, floor + 1.92, 6.02], middle, 0.09, 0.08, c.edge);
  }
  rect(out, 'foundation', -32.07, -27.28, -1.58, floor, -15.92, -4.73, c.base);
  rect(out, 'stucco', -32.07, -27.28, floor, 2.33, -15.92, -4.73, c.shade);
  gabledRoof(out, -32.23, -27.06, -16.17, -4.47, 2.33, 3.35, 'metalRoof', c.hallRoof, lod, false);
}

function courtyard(out, lod) {
  const { floor, top } = plan.section.trellis;
  const xPositions = [-1.42, 3.72, 9.24],
    zPositions = [-28.72, -23.14, -17.68, -12.94];
  for (const x of xPositions) {
    for (const z of zPositions) {
      box(out, 'wood', x, floor - 0.42, z, 0.18, top - floor + 0.42, 0.18, c.timber);
    }
    beam(out, 'wood', [x, top, zPositions[0]], [x, top, zPositions.at(-1)], 0.15, 0.19, c.timber);
  }
  for (const z of zPositions) {
    beam(
      out,
      'wood',
      [xPositions[0], top + 0.12, z],
      [xPositions.at(-1), top + 0.12, z],
      0.14,
      0.17,
      c.timber,
    );
  }
  for (const [x, z] of [
    [1.0, -18.6],
    [6.0, -24.6],
  ]) {
    box(out, 'foundation', x, floor - 0.24, z, 2.65, 0.27, 2.24, c.terracotta);
    beamPath(
      out,
      'wood',
      [
        [x, floor, z],
        [x - 0.45, 0.48, z + 0.27],
        [x - 0.32, 1.42, z - 0.2],
        [x + 1.16, top + 0.17, z],
      ],
      0.28,
      0.25,
      c.vine,
    );
    if (lod >= 2) {
      for (const sign of [-1, 1]) {
        beamPath(
          out,
          'wood',
          [
            [x, 0.03, z],
            [x + sign * 0.72, 1.1, z - sign * 0.47],
            [x + sign * 1.6, top + 0.18, z + sign * 1.23],
          ],
          0.13,
          0.11,
          c.vine,
        );
      }
    }
    const patches = lod === 0 ? 1 : lod === 1 ? 3 : 5;
    for (let j = 0; j < patches; j++) {
      sphere(
        out,
        'plants',
        [x + ((j % 3) - 1) * 1.65, top + 0.34, z + (j - 2) * 1.13],
        [2.85, 0.55 + (j % 3) * 0.12, 3.38],
        j % 2 ? c.leaf : c.greenery,
        lod === 0 ? 5 : 8,
        lod === 0 ? 3 : 4,
      );
    }
  }
}

function build(out, lod) {
  newChurch(out, lod);
  rectory(out, lod);
  oldHall(out, lod);
  courtyard(out, lod);
}

export const parishSkyline = (out) => build(out, 0);
export const parishDistrict = (out) => build(out, 1);
export const parishStreet = (out) => build(out, 2);
export const parishCloseup = (out) => build(out, 3);
const recipe = 'sacred-heart-tombstone-model.mjs',
  camera = [39, 21, 64],
  lookAt = [-9, 2.6, -4];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'parishDistrict', 0.44],
    ['street', 'parishStreet', 0.14],
    ['closeup', 'parishCloseup', 0.037],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const parishModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: parishCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Three historic Sacred Heart parish buildings and the timber rose trellis on East Safford Street in Tombstone.',
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
    outline: churchOutline,
    outlines: [churchOutline, rectoryOutline, hallOutline],
    minimumCoverage: 0.92,
    basis: 'The three corresponding OpenStreetMap Sacred Heart building envelopes.',
  },
  mediumFiContext: {
    scale: 2.5,
    groundY: -0.21,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'concrete_plain',
    'metal_painted',
    'slate',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'safford-street-church-and-rectory', position: [9, 8.2, 39], lookAt: [-10, 3.0, 3.4] },
    { name: 'parish-hall-and-rose-trellis', position: [22, 10, -17], lookAt: [-10, 2.0, -15] },
    { name: 'stained-glass-and-east-wall', position: [23, 5, 14], lookAt: [2.3, 2.6, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-sacred-heart-parish-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'parishSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap footprints are ODbL. Ammodramus dedicated the five referenced photographs under CC0.',
};
