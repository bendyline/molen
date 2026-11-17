/** The raised Ganesha shrine at Sanam Chandra Palace in Nakhon Pathom. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame');
const { baseTop, archSpring, roofEave, roofCrown, finialTop } = plan.dimensions;
const outline = frame.geometry.outline;
const materials = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  bronze: { slot: 'trim', localRef: 'palette:#635346', roughness: 0.55, metallic: 0.53 },
  brass: { slot: 'trim', localRef: 'palette:#997e4d', roughness: 0.62, metallic: 0.31 },
};
const color = {
  plaster: rgb('e1d4b9'),
  shade: rgb('caaf8f'),
  base: rgb('b4a183'),
  relief: rgb('d9c19b'),
  roof: rgb('e1d1b2'),
  ridge: rgb('d3bd97'),
  bronze: rgb('695747'),
  brass: rgb('b19661'),
};
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;

function surface(out, slot, points, tint, facing) {
  let normal = normalFor(...points);
  if (facing && normal.reduce((sum, n, i) => sum + n * facing[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      points.map(([x, y, z]) => [x + z, y]),
      tint,
    );
}

function mold(out, slot, sections, tint) {
  const rings = sections.map(([y, w, d, bevel]) => chamferedRectangle(0, y, 0, w, d, bevel));
  loft(out, slot, rings, tint);
}

function sideFrame(side) {
  const northSouth = side === 1 || side === 3;
  const sign = side < 2 ? 1 : -1;
  return {
    width: northSouth ? 2.64 : 2.21,
    face: northSouth ? [sign, 0, 0] : [0, 0, sign],
    at: (u, y, depth) => (northSouth ? [sign * depth, y, -sign * u] : [sign * u, y, sign * depth]),
    depth: northSouth ? 1.12 : 1.37,
  };
}

function pedestal(out, level) {
  const body = [
    [-0.44, 3.35, 4.3, 0.095],
    [0.19, 3.35, 4.3, 0.095],
    [0.29, 3.24, 4.18, 0.11],
    [0.44, 3.14, 4.06, 0.1],
    [0.55, 3.01, 3.87, 0.13],
    [0.64, 2.89, 3.72, 0.15],
  ];
  mold(out, 'stone', body, color.base);
  mold(
    out,
    'render',
    [
      [0.64, 2.89, 3.72, 0.15],
      [0.76, 2.82, 3.64, 0.18],
      [0.92, 2.52, 3.27, 0.24],
      [1.13, 2.35, 3.04, 0.27],
      [2.28, 2.35, 3.04, 0.23],
      [2.49, 2.56, 3.25, 0.18],
      [2.59, 2.82, 3.61, 0.13],
      [2.75, 2.96, 3.71, 0.1],
      [baseTop, 2.96, 3.71, 0.1],
    ],
    color.plaster,
  );
  if (level === 0) return;
  for (let side = 0; side < 4; side++) {
    const { at, face, depth, width } = sideFrame(side);
    const y0 = 1.24,
      y1 = 2.18,
      span = width * 0.34,
      outside = depth + (side % 2 === 0 ? 0.156 : 0.065);
    const relief = [
      at(-span, y0, outside),
      at(span, y0, outside),
      at(span, y1, outside),
      at(-span, y1, outside),
    ];
    surface(out, 'stone', relief, color.relief, face);
    if (level > 1) {
      beamPath(out, 'stone', relief, 0.062, 0.065, color.shade, true);
      for (const sign of [-1, 1]) {
        beamPath(
          out,
          'render',
          [
            at(sign * (span + 0.19), 1.22, outside + 0.035),
            at(sign * (span + 0.225), 1.05, outside + 0.1),
            at(sign * (span + 0.35), 0.91, outside + 0.15),
          ],
          0.087,
          0.085,
          color.plaster,
        );
      }
    }
  }
}

function portals(out, level) {
  // The four supporting piers leave clear views through the canopy.
  for (const x of [-1.04, 1.04]) {
    for (const z of [-1.31, 1.31]) {
      box(
        out,
        'stone',
        [x - 0.226, baseTop - 0.015, z - 0.241],
        [x + 0.226, baseTop + 0.23, z + 0.241],
        color.relief,
      );
      box(
        out,
        'render',
        [x - 0.161, baseTop + 0.17, z - 0.171],
        [x + 0.161, roofEave - 0.055, z + 0.171],
        color.plaster,
      );
      if (level > 0) {
        for (const y of [baseTop + 0.35, archSpring - 0.045, roofEave - 0.29]) {
          box(
            out,
            'stone',
            [x - 0.195, y, z - 0.204],
            [x + 0.195, y + 0.092, z + 0.204],
            color.relief,
          );
        }
      }
    }
  }
  const archSteps = level === 0 ? 5 : level === 1 ? 8 : 12;
  for (let i = 0; i < 4; i++) {
    const { at, face, width, depth } = sideFrame(i);
    const archHalf = width * 0.332;
    const curve = (j, scale = 1) => {
      const angle = Math.PI * (1 - j / archSteps);
      return [archHalf * scale * Math.cos(angle), archSpring + 0.885 * scale * Math.sin(angle)];
    };
    for (let j = 0; j < archSteps; j++) {
      const [a, y0] = curve(j),
        [b, y1] = curve(j + 1);
      surface(
        out,
        'render',
        [at(a, y0, depth), at(b, y1, depth), at(b, roofEave, depth), at(a, roofEave, depth)],
        color.plaster,
        face,
      );
      surface(
        out,
        'render',
        [
          at(a, y0, depth - 0.25),
          at(b, y1, depth - 0.25),
          at(b, roofEave, depth - 0.25),
          at(a, roofEave, depth - 0.25),
        ],
        color.shade,
        face.map((v) => -v),
      );
      surface(
        out,
        'stone',
        [at(a, y0, depth), at(a, y0, depth - 0.25), at(b, y1, depth - 0.25), at(b, y1, depth)],
        color.relief,
        [0, -1, 0],
      );
      if (level > 0) {
        const [c, cy] = curve(j, 1.13),
          [d, dy] = curve(j + 1, 1.13);
        surface(
          out,
          'stone',
          [
            at(a, y0, depth + 0.026),
            at(b, y1, depth + 0.026),
            at(d, dy, depth + 0.045),
            at(c, cy, depth + 0.045),
          ],
          color.relief,
          face,
        );
      }
    }
    for (const sign of [-1, 1]) {
      surface(
        out,
        'render',
        [
          at(sign * archHalf, archSpring, depth),
          at((sign * width) / 2, archSpring, depth),
          at((sign * width) / 2, roofEave, depth),
          at(sign * archHalf, roofEave, depth),
        ],
        color.plaster,
        face,
      );
      if (level > 1) {
        const leaf = at(sign * width * 0.391, archSpring + 0.08, depth + 0.05);
        const tip = at(sign * width * 0.423, archSpring + 0.43, depth + 0.077);
        beam(out, 'brass', leaf, tip, 0.091, 0.059, color.brass);
      }
    }
    if (level > 0) {
      const center = archSpring + 1.16,
        r = 0.21;
      surface(
        out,
        'brass',
        [
          at(0, center - r, depth + 0.06),
          at(r, center, depth + 0.082),
          at(0, center + r, depth + 0.06),
        ],
        color.brass,
        face,
      );
      surface(
        out,
        'brass',
        [
          at(0, center + r, depth + 0.06),
          at(-r, center, depth + 0.082),
          at(0, center - r, depth + 0.06),
        ],
        color.brass,
        face,
      );
    }
  }
}

function canopy(out, level) {
  mold(
    out,
    'stone',
    [
      [roofEave - 0.075, 2.51, 3.02, 0.14],
      [roofEave + 0.041, 2.66, 3.19, 0.15],
      [roofEave + 0.16, 2.83, 3.37, 0.19],
      [roofEave + 0.27, 2.79, 3.31, 0.21],
    ],
    color.relief,
  );
  mold(
    out,
    'roof',
    [
      [roofEave + 0.27, 2.79, 3.31, 0.21],
      [roofEave + 0.46, 2.72, 3.23, 0.25],
      [roofEave + 0.69, 2.53, 2.99, 0.34],
      [roofEave + 0.94, 2.22, 2.62, 0.37],
      [roofEave + 1.17, 1.72, 2.22, 0.35],
      [roofEave + 1.41, 1.09, 1.69, 0.29],
      [roofCrown, 0.42, 1.04, 0.19],
    ],
    color.roof,
  );
  const sides = level === 0 ? 6 : level === 1 ? 8 : 12;
  const finial = (y, w) => radialRing(y, w, w, sides);
  loft(
    out,
    'brass',
    [
      finial(roofCrown - 0.02, 0.21),
      finial(roofCrown + 0.15, 0.16),
      finial(roofCrown + 0.32, 0.192),
      finial(roofCrown + 0.48, 0.11),
      finial(finialTop, 0.021),
    ],
    color.brass,
  );
  if (level > 1) {
    for (const sign of [-1, 1]) {
      beam(
        out,
        'stone',
        [0, roofCrown - 0.016, sign * 0.39],
        [0, roofCrown + 0.04, sign * 0.59],
        0.106,
        0.138,
        color.ridge,
      );
    }
  }
}

function ganesha(out, level) {
  const y = baseTop + 0.27,
    z = -0.027;
  const segments = level === 0 ? 6 : level === 1 ? 8 : level === 2 ? 10 : 12;
  const latitudes = level === 0 ? 3 : level === 1 ? 4 : level === 2 ? 5 : 6;
  const form = (x, h, depth, rx, ry, rz) =>
    sphere(out, 'bronze', [x, y + h, z + depth], [rx, ry, rz], color.bronze, segments, latitudes);
  mold(
    out,
    'stone',
    [
      [baseTop, 0.85, 0.94, 0.09],
      [baseTop + 0.105, 0.88, 1.0, 0.08],
      [y, 0.73, 0.86, 0.1],
    ],
    color.relief,
  );
  form(0, 0.17, 0.01, 0.31, 0.165, 0.22);
  form(0, 0.38, 0, 0.245, 0.276, 0.191);
  form(0, 0.72, 0.024, 0.177, 0.204, 0.163);
  for (const sign of [-1, 1]) {
    form(sign * 0.16, 0.715, 0.019, 0.125, 0.139, 0.055);
    if (level > 0) {
      form(sign * 0.195, 0.113, 0.1, 0.175, 0.09, 0.173);
      tubePath(
        out,
        'bronze',
        [
          [sign * 0.151, y + 0.49, z],
          [sign * 0.277, y + 0.38, z + 0.06],
          [sign * 0.28, y + 0.29, z + 0.17],
        ],
        0.056,
        color.bronze,
        5,
      );
      tubePath(
        out,
        'bronze',
        [
          [sign * 0.14, y + 0.54, z - 0.039],
          [sign * 0.279, y + 0.57, z - 0.042],
          [sign * 0.336, y + 0.69, z + 0.025],
        ],
        0.047,
        color.bronze,
        5,
      );
    }
  }
  const nose =
    level === 0
      ? [
          [0, y + 0.715, z + 0.14],
          [0.018, y + 0.56, z + 0.238],
          [-0.078, y + 0.5, z + 0.244],
        ]
      : [
          [0, y + 0.72, z + 0.137],
          [0.01, y + 0.642, z + 0.198],
          [0.019, y + 0.559, z + 0.24],
          [-0.028, y + 0.495, z + 0.251],
          [-0.094, y + 0.514, z + 0.246],
        ];
  tubePath(out, 'bronze', nose, level === 0 ? 0.093 : 0.067, color.bronze, level === 0 ? 5 : 7);
  if (level > 1) {
    const ring = (h, r) => radialRing(y + h, r, r, segments, [0, z]);
    loft(
      out,
      'bronze',
      [ring(0.843, 0.111), ring(0.921, 0.09), ring(0.991, 0.043), ring(1.04, 0.016)],
      color.bronze,
    );
    tubePath(
      out,
      'brass',
      [
        [0.117, y + 0.678, z + 0.143],
        [0.156, y + 0.642, z + 0.208],
        [0.179, y + 0.663, z + 0.249],
      ],
      0.021,
      color.brass,
      5,
    );
  }
}

function build(out, level) {
  pedestal(out, level);
  portals(out, level);
  canopy(out, level);
  ganesha(out, level);
}
export const shrineSkyline = (out) => build(out, 0);
export const shrineDistrict = (out) => build(out, 1);
export const shrineStreet = (out) => build(out, 2);
export const shrineCloseup = (out) => build(out, 3);

const recipe = 'thewalai-khanet-model.mjs',
  position = [10, 9, 15],
  lookAt = [0, 3.6, 0];
export const thewalaiKhanetModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces: materials,
  build: shrineCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'Exact named footprint of the standing shrine.',
  },
  brief:
    'The tall four-sided shrine and domed canopy that houses the palace’s west-facing bronze Ganesha.',
  camera: position,
  lookAt,
  sunDirection: [-61, 108, 118],
  embeddedCanonicalGraphs: Object.values(materials).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.87,
    cameraYaw: 0.46,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'west-plinth-and-bronze-figure', position: [0.15, 5, 10], lookAt: [0, 3.76, 0.31] },
    { name: 'four-open-archways', position: [8, 7, 5], lookAt: [0, 4.4, 0] },
    { name: 'domed-canopy-and-finial', position: [8.8, 12, -5.7], lookAt: [0, 5.1, 0] },
    { name: 'molded-platform-and-landscape', position: [5, 5.4, 12], lookAt: [0, 2.23, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thewalai-khanet-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'shrineSkyline',
    errorMeters: 0.56,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'shrineDistrict', errorMeters: 0.25, surfaces: materials },
      street: { export: 'shrineStreet', errorMeters: 0.09, surfaces: materials },
      closeup: { export: 'shrineCloseup', errorMeters: 0.038, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry interpreted from primary written documentation, exact OpenStreetMap envelope and Terrarium elevations.',
};
