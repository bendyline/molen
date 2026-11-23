import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { floorSampler } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (key) => JSON.parse(readFileSync(new URL('../' + key + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const grade = floorSampler(read('terrain-grid'));
const wallHalfWidth = plan.dimensions.mainWidthM / 2 - 0.02;
const wallHalfDepth = plan.dimensions.mainDepthM / 2;
const streetGrade = grade([0, wallHalfDepth]);
const upperEaves = plan.dimensions.eaveApproxM;
const roofHeight = plan.dimensions.roofTopApproxM;

const plaster = rgb('ded4bc');
const trim = rgb('eee1c7');
const flatter = rgb('c8baa1');
const stone = rgb('b19c80');
const metalRoof = rgb('5c645f');
const terraceRoof = rgb('596155');
const glazing = rgb('4a504a');
const dark = rgb('3f4a43');
const frameWood = rgb('8d7960');
const porchWood = rgb('927d61');
const fenceWood = rgb('82755c');
const greyGreen = rgb('6b6c5c');
const chimney = rgb('98917c');
const drape = rgb('938476');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.16 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.95 },
  detail: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9 },
};

function block(out, slot, [x0, z0, x1, z1], bottom, top, color) {
  abox(out, slot, [x0, bottom, z0], [x1, top, z1], color);
}

const fronts = [
  {
    from: [-wallHalfWidth, wallHalfDepth],
    axis: [1, 0],
    length: wallHalfWidth * 2,
    count: 5,
    principal: true,
  },
  {
    from: [wallHalfWidth, wallHalfDepth],
    axis: [0, -1],
    length: wallHalfDepth * 2,
    count: 11,
    avenue: true,
  },
  { from: [wallHalfWidth, -wallHalfDepth], axis: [-1, 0], length: wallHalfWidth * 2, count: 5 },
  { from: [-wallHalfWidth, -wallHalfDepth], axis: [0, 1], length: wallHalfDepth * 2, count: 8 },
];

function solidFacade(out, face, detail) {
  const f = facade(face.from, face.axis);
  const far = face.length;
  const double = face.principal || face.avenue;
  const pale = face.avenue ? rgb('e3d9c2') : plaster;
  const panel = (slot, a, b, y, h, d, color) => {
    quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, h, d), f.P(a, h, d), color);
  };
  const margin = face.principal ? 1.71 : 1.2;
  const course = (far - 2 * margin) / face.count;
  const exposedFoundation = (u) => {
    const p = f.P(u, 0, -0.1);
    return Math.min(-0.12, grade([p[0], p[2]]) - 0.11);
  };
  for (const [a, b] of [
    [0, far / 2],
    [far / 2, far],
  ]) {
    quad4(
      out,
      'stone',
      f.P(a, exposedFoundation(a), 0.015),
      f.P(b, exposedFoundation(b), 0.015),
      f.P(b, 0.72, 0.015),
      f.P(a, 0.72, 0.015),
      stone,
    );
  }
  const bands = [
    [0.68, 0.92, 0.075, flatter],
    [4.31, 4.43, 0.15, trim],
    [4.45, 4.58, 0.14, flatter],
    [4.59, 4.72, 0.11, trim],
    [8.86, 9.05, 0.11, flatter],
    [9.06, 9.2, 0.17, trim],
    [9.26, 9.43, 0.25, trim],
    [9.43, upperEaves, 0.49, flatter],
  ];
  for (const [index, [y, h, d, color]] of bands.entries())
    if (detail > 0 || [0, 3, 7].includes(index))
      fbox(out, 'trim', f, -0.02, far + 0.02, y, h, -0.06, d, color);
  for (const [floor, top, sill, head] of [
    [0.73, 4.34, 1.59, 3.48],
    [4.68, 9.46, 5.81, 8.06],
  ]) {
    const w = (double ? 1.07 : 0.94) + (floor > 4 ? 0.09 : 0);
    const doorWidth = face.principal && floor > 4 ? w / 2 : 0;
    if (doorWidth > 0 && detail > 0) {
      panel('wall', 0, far, floor, 5.19, -0.009, pale);
      panel('wall', 0, far / 2 - doorWidth, 5.19, sill, -0.009, pale);
      panel('wall', far / 2 + doorWidth, far, 5.19, sill, -0.009, pale);
    } else panel('wall', 0, far, floor, sill, -0.009, pale);
    panel('wall', 0, far, head, top, -0.009, pale);
    let last = 0;
    for (let i = 0; i < face.count; i++) {
      const center = margin + (i + 0.5) * course;
      const left = center - w / 2;
      const right = center + w / 2;
      panel('wall', last, left, sill, head, -0.009, pale);
      last = right;
      const aperture = doorWidth > 0 && i === 2 && detail > 0 ? 5.19 : sill;
      if (detail > 1) {
        opening(out, f, center, aperture, w, head - aperture, {
          glassSlot: 'window',
          frameSlot: 'trim',
          glass: glazing,
          d: -0.093,
          frameDepth: 0.044,
          frameWidth: 0.075,
          frame: frameWood,
          mullions: 1,
          transoms: 1,
          sill: true,
          mullionColor: trim,
        });
      } else panel('window', left, right, aperture, head, 0.015, glazing);
      if (detail > 0) {
        if (detail === 1)
          panel('trim', left - 0.18, right + 0.18, head + 0.09, head + 0.23, 0.04, trim);
        else {
          fbox(
            out,
            'trim',
            f,
            left - 0.22,
            right + 0.22,
            head + 0.09,
            head + 0.23,
            -0.03,
            0.134,
            trim,
          );
          fbox(
            out,
            'trim',
            f,
            left - 0.13,
            right + 0.13,
            sill - 0.095,
            sill - 0.005,
            0.001,
            0.147,
            flatter,
          );
          if (face.avenue && floor < 4)
            panel('window', center - 0.25, center + 0.25, 0.16, 0.42, 0.017, dark);
        }
      }
    }
    panel('wall', last, far, sill, head, -0.009, pale);
  }
  if (detail > 0) {
    const step = [0, 1.5, 0.82, 0.57][detail];
    for (let u = 0.22; u < far; u += step)
      fbox(out, 'trim', f, u - 0.09, u + 0.09, 9.16, 9.44, 0.03, 0.44, trim);
    for (const u of [0.03, far - 0.34])
      fbox(out, 'wall', f, u, u + 0.31, 0.7, 9.03, -0.08, 0.068, flatter);
    if (face.avenue && detail > 1)
      for (const u of [0.12, far * 0.41, far * 0.76, far - 0.16])
        fbox(out, 'detail', f, u - 0.028, u + 0.028, 0.5, upperEaves - 0.22, 0.014, 0.1, greyGreen);
  }
}

function roof(out, detail) {
  const x = wallHalfWidth + 0.54;
  const z = wallHalfDepth + 0.57;
  const ridge = 9.0;
  const near = [
    [-x, upperEaves, z],
    [x, upperEaves, z],
  ];
  const far = [
    [x, upperEaves, -z],
    [-x, upperEaves, -z],
  ];
  const p = [0, roofHeight, ridge],
    q = [0, roofHeight, -ridge];
  tri(out, 'roof', near[0], near[1], p, metalRoof);
  tri(out, 'roof', far[0], far[1], q, metalRoof);
  quad4(out, 'roof', near[1], far[0], q, p, metalRoof);
  quad4(out, 'roof', far[1], near[0], p, q, metalRoof);
  if (detail > 0) {
    for (const [i, [cx, cz]] of [
      [-0.55, 7.5],
      [1.8, 8.0],
      [-4.12, 5.91],
      [2.73, 1.63],
      [-2.95, 0.61],
      [3.3, -3.88],
      [4.2, -7.55],
      [-2.61, -10.4],
    ].entries()) {
      const gradeY =
        roofHeight -
        (roofHeight - upperEaves) *
          Math.max(Math.abs(cx) / x, Math.max(0, Math.abs(cz) - ridge) / (z - ridge));
      const a = i % 3 === 0 ? 0.29 : 0.25;
      block(out, 'wall', [cx - a, cz - a, cx + a, cz + a], gradeY - 0.12, gradeY + 0.79, chimney);
      block(
        out,
        'trim',
        [cx - a - 0.065, cz - a - 0.065, cx + a + 0.065, cz + a + 0.065],
        gradeY + 0.72,
        gradeY + 0.86,
        dark,
      );
    }
  }
}

const porchCenter = -0.58;
function porch(out, detail) {
  const x = porchCenter,
    z = wallHalfDepth;
  const w = 3.13;
  const l = x - w,
    r = x + w;
  block(out, 'stone', [l - 0.18, z - 0.04, r + 0.18, z + 3.64], streetGrade - 0.24, 0.59, stone);
  block(out, 'timber', [l, z - 0.02, r, z + 3.42], 0.55, 4.48, porchWood);
  for (const [dx, dz] of [
    [l, z + 3.25],
    [r - 0.19, z + 3.25],
    [l, z + 0.12],
    [r - 0.19, z + 0.12],
  ])
    block(out, 'trim', [dx - 0.04, dz - 0.04, dx + 0.22, dz + 0.21], 0.52, 4.45, frameWood);
  for (const [d, projection] of [
    [4.39, 0.14],
    [4.51, 0.22],
    [4.68, 0.33],
    [4.81, 0.2],
  ])
    block(
      out,
      'trim',
      [l - projection, z - 0.03, r + projection, z + 3.4 + projection],
      d,
      d + 0.14,
      porchWood,
    );
  block(out, 'roof', [l - 0.38, z - 0.03, r + 0.38, z + 3.82], 4.92, 5.11, terraceRoof);
  const front = facade([l, z + 3.42], [1, 0]);
  opening(out, front, 3.13, 0.62, 1.45, 2.4, {
    glassSlot: 'detail',
    frameSlot: 'trim',
    glass: dark,
    frame: frameWood,
    frameWidth: 0.1,
    d: 0.039,
    frameDepth: 0.13,
    sill: false,
    mullions: detail > 1 ? 1 : 0,
  });
  if (detail > 0) {
    for (const [base, axis, locations] of [
      [
        [l, z + 3.42],
        [1, 0],
        [1.17, 5.12],
      ],
      [[r, z + 3.42], [0, -1], [1.21]],
      [[l, z], [0, 1], [2.24]],
    ]) {
      const f = facade(base, axis);
      for (const u of locations)
        opening(out, f, u, 1.47, 0.94, 1.73, {
          glassSlot: 'window',
          frameSlot: 'trim',
          glass: glazing,
          frame: trim,
          frameWidth: 0.081,
          mullions: detail > 1 ? 2 : 1,
          transoms: detail > 1 ? 2 : 0,
        });
    }
  }
  const entrance = z + 3.48;
  // Deep little gable and board canopy shelter the lower entrance directly below the balcony.
  gableRoof(
    out,
    'roof',
    [x, entrance - 0.14],
    [x, entrance + 1.52],
    2.32,
    3.19,
    3.74,
    terraceRoof,
    { overhang: 0.16, endSlot: 'timber', endColor: porchWood },
  );
  for (const side of [-1, 1]) {
    const cx = x + side * 1.08;
    block(
      out,
      'timber',
      [cx - 0.08, entrance + 1.25, cx + 0.08, entrance + 1.44],
      0.43,
      3.24,
      porchWood,
    );
  }
  for (let i = 0; i < 4; i++)
    block(
      out,
      'timber',
      [x - 1.29, entrance + 0.65 + i * 0.28, x + 1.29, entrance + 1.71],
      streetGrade - 0.2,
      0.64 - i * 0.14,
      porchWood,
    );
  for (const [a, b] of [
    [
      [l - 0.31, z + 3.71],
      [r + 0.31, z + 3.71],
    ],
    [
      [l - 0.31, z + 0.06],
      [l - 0.31, z + 3.71],
    ],
    [
      [r + 0.31, z + 0.06],
      [r + 0.31, z + 3.71],
    ],
  ]) {
    const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    fbox(out, 'trim', f, 0, length, 5.83, 5.94, -0.08, 0.08, trim);
    fbox(out, 'trim', f, 0, length, 5.14, 5.22, -0.065, 0.065, flatter);
    const pitch = detail === 0 ? 1.33 : detail === 1 ? 0.53 : 0.22;
    for (let u = 0.08; u < length; u += pitch)
      fbox(out, 'trim', f, u - 0.028, u + 0.028, 5.18, 5.87, -0.035, 0.035, trim);
  }
  if (detail > 1) {
    const f = facade([x - 2.64, z + 0.07], [1, 0]);
    for (const side of [-1, 1]) {
      const t = side === -1 ? 0 : 5.28;
      const y = 8.74;
      const points = [
        [t, y],
        [t - side * 1.35, y - 0.24],
        [t - side * 1.85, y - 0.08],
        [t - side * 1.64, y - 0.69],
        [t - side * 0.77, 6.16],
        [t - side * 0.25, 5.96],
      ];
      tri(out, 'detail', ...points.slice(0, 3).map(([u, v]) => f.P(u, v, 0.055)), drape);
      quad4(
        out,
        'detail',
        f.P(t, y, 0.055),
        f.P(t - side * 1.35, y - 0.24, 0.062),
        f.P(t - side * 0.77, 6.16, 0.063),
        f.P(t - side * 0.25, 5.96, 0.05),
        drape,
      );
    }
  }
}

function historicFence(out, detail) {
  if (!detail) return;
  const z = wallHalfDepth + 8;
  const strips = [
    [
      [-15.2, z - 10],
      [-15.2, z],
    ],
    [
      [-15.2, z],
      [porchCenter - 1.85, z],
    ],
    [
      [porchCenter + 1.85, z],
      [9.7, z],
    ],
    [
      [9.7, z],
      [10.02, wallHalfDepth - 1.2],
    ],
  ];
  for (const [a, b] of strips) {
    const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.ceil(length / (detail > 1 ? 0.24 : 0.8));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) / count) * length;
      const p = f.P(u, 0, 0);
      const y = grade([p[0], p[2]]);
      const width = length / count;
      fbox(
        out,
        'timber',
        f,
        u - width * 0.48,
        u + width * 0.48,
        y - 0.15,
        y + 2.35 + ((i % 3) - 1) * 0.035,
        -0.031,
        0.045,
        i % 3 === 0 ? porchWood : fenceWood,
      );
    }
  }
}

function sentryShelter(out, detail) {
  const x = 2.87,
    z = wallHalfDepth + 7.8;
  const base = grade([x, z]);
  const y = base + 2.04;
  block(out, 'timber', [x - 0.55, z - 0.67, x + 0.56, z + 0.68], base - 0.12, y, frameWood);
  const f = facade([x - 0.56, z + 0.68], [1, 0]);
  fbox(out, 'detail', f, 0.21, 0.86, base + 0.09, y - 0.09, 0.008, 0.019, dark);
  gableRoof(out, 'roof', [x, z - 0.7], [x, z + 0.84], 1.44, y, y + 0.34, metalRoof, {
    overhang: 0.09,
    endSlot: 'timber',
    endColor: fenceWood,
  });
  if (detail > 1) {
    for (const dx of [-0.52, 0.5])
      block(out, 'trim', [x + dx - 0.04, z + 0.61, x + dx + 0.04, z + 0.7], base - 0.08, y, trim);
  }
}

function build(out, detail) {
  for (const f of fronts) solidFacade(out, f, detail);
  roof(out, detail);
  porch(out, detail);
  historicFence(out, detail);
  if (detail > 0) sentryShelter(out, detail);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'governor-s-mansion-tobolsk-russia-model.mjs';
const camera = [37, 28, 53];
const lookAt = [0.6, 5.1, 3];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace-castle-fort',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1917-09-15',
    validFrom: '1917-09-01',
    validUntil: '1918-05-01',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The September 1917 Governor’s Mansion with a five-axis square facade, deep cornice, timber entrance porch and balcony.',
  camera,
  lookAt,
  sunDirection: [-13, 63, 54],
  mediumFiContext: {
    scale: 1.55,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.94,
    basis: 'Uses the footprint of the surviving masonry for the dated museum site.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'mansion-front-and-mira-street', position: camera, lookAt },
    {
      name: 'timber-vestibule-and-historic-balcony',
      position: [-10, 6.9, 38.5],
      lookAt: [-0.15, 4.6, 18.7],
    },
    {
      name: 'long-plastered-elevation-and-dentils',
      position: [47, 14, 6.2],
      lookAt: [7.5, 6.5, -0.7],
    },
    { name: 'hipped-roof-and-courtyard-return', position: [-35, 30, -44], lookAt: [-1.6, 6.3, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'governor-s-mansion-tobolsk-russia-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.52, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.054, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on the mapped mansion, independently dated National Library of Russia and U.S. Library of Congress prints, and the UCLA Library’s 1929 Longmans plate.',
};
