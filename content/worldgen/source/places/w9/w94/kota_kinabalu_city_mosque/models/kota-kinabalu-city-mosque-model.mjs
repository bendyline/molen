import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const {
  foundation,
  deck,
  hallEave,
  domeBase,
  domeHeight,
  domeRadius,
  mainDomeCenter,
  minaretHeight,
  minarets,
} = plan.dimensions;
const tau = 2 * Math.PI;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.92 },
  mold: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92 },
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87 },
  blue: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.62 },
  ivory: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.7 },
  gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.25 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.8 },
};
const cream = rgb('d8d1bd');
const white = rgb('ded8ca');
const apron = rgb('9f9584');
const windowGlass = rgb('4e5d5d');
const turquoise = rgb('577371');
const canopy = rgb('818a87');
const blue = rgb('345f98');
const ivory = rgb('c3bba5');
const gold = rgb('c1a56a');

function cap(out, slot, ring, y, color) {
  const points = ring.map(([x, z]) => [x, y, z]);
  const indices = earcut(ring.flat(), [], 2);
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, points[indices[i]], points[indices[i + 2]], points[indices[i + 1]], color);
}
const radial = (x, z, r, theta, y) => [x + Math.sin(theta) * r, y, z + Math.cos(theta) * r];
function ring(x, z, r, y, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => radial(x, z, r, phase + (tau * i) / n, y));
}
function lathe(out, slot, x, z, sections, n, color, phase = 0) {
  loft(
    out,
    slot,
    sections.map(([y, r]) => ring(x, z, r, y, n, phase)),
    color,
    { cap: false },
  );
}
function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function archOpening(out, face, u, y, width, height, options) {
  const {
    head = 'round',
    glass = windowGlass,
    frame = white,
    d = 0.042,
    frameWidth = 0.1,
    mullions = 0,
    transoms = 0,
    mullionColor = frame,
  } = options;
  const half = width / 2;
  const rise = head === 'round' ? Math.min(half * 0.89, height * 0.28) : 0;
  const spring = y + height - rise;
  function pane(extra, depth) {
    const r = half + extra;
    const points = [face.P(u - r, y - extra, depth), face.P(u + r, y - extra, depth)];
    if (rise > 0) {
      for (let i = 0; i <= 6; i++) {
        const angle = (Math.PI * i) / 6;
        points.push(
          face.P(u + r * Math.cos(angle), spring + (rise + extra) * Math.sin(angle), depth),
        );
      }
    } else {
      points.push(face.P(u + r, spring + extra, depth), face.P(u - r, spring + extra, depth));
    }
    return points;
  }
  if (frameWidth > 0) fan(out, 'mold', pane(frameWidth, d), frame);
  fan(out, 'glass', pane(0, d + 0.057), glass);
  const strip = (u0, u1, y0, y1) =>
    quad4(
      out,
      'trim',
      face.P(u0, y0, d + 0.064),
      face.P(u1, y0, d + 0.064),
      face.P(u1, y1, d + 0.064),
      face.P(u0, y1, d + 0.064),
      mullionColor,
    );
  for (let i = 1; i <= mullions; i++) {
    const a = u - half + (width * i) / (mullions + 1);
    strip(a - 0.034, a + 0.034, y, spring + rise * 0.3);
  }
  for (let i = 1; i <= transoms; i++) {
    const py = y + ((spring - y) * i) / (transoms + 1);
    strip(u - half, u + half, py - 0.04, py + 0.04);
  }
}
function prayerWing(out, lod) {
  const eave = hallEave;
  box(out, 'plaster', -62.56, -13.32, -19.41, 39.87, deck, eave, cream);
  box(out, 'plaster', -59.42, -14.68, -16.96, 37.06, eave - 0.06, eave + 3.34, white);
  box(out, 'roof', -62.85, -13.02, -19.72, 40.14, eave, eave + 0.28, turquoise);
  box(out, 'roof', -59.64, -14.42, -17.19, 37.28, eave + 3.34, eave + 3.61, canopy);
  if (lod < 1) return;
  for (const [origin, direction, count, width] of [
    [[-62.56, 39.9], [1, 0], 8, 49.06],
    [[-62.61, -19.4], [0, 1], 9, 59.15],
    [[-14.0, -19.48], [-1, 0], 8, 48.53],
  ]) {
    const face = facade(origin, direction);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * width) / count;
      archOpening(out, face, u, deck + 0.48, 3.66, 7.77, {
        head: 'round',
        d: 0.033,
        glass: windowGlass,
        frame: white,
        frameWidth: 0.17,
        frameDepth: 0.12,
        mullions: lod >= 2 ? 2 : 0,
        transoms: lod >= 2 ? 3 : 0,
        mullionColor: rgb('a3aca6'),
      });
    }
    if (lod >= 2) {
      for (let i = 0; i < count * 2 - 2; i++) {
        const u = ((i + 1.5) * width) / (count * 2 + 1);
        archOpening(out, face, u, 9.88, 0.51, 1.05, {
          head: 'round',
          glass: windowGlass,
          frameWidth: 0,
          sill: false,
          d: 0.03,
        });
      }
    }
  }
}

const baseWings = [
  // Stepped wing and the two mapped projecting approach pavilions.
  [-14.05, 32.42, -23.68, 44.56, 8.2],
  [32.14, 61.83, -21.85, 42.34, 7.5],
  [61.83, 69.38, -21.79, 42.38, 6.25],
  [-14.0, 18.85, 43.9, 59.13, 6.72],
  [-12.29, 18.49, -64.13, -22.7, 6.45],
  [-27.07, -12.92, -30, 48.86, 7.73],
];
function linkedWings(out, lod) {
  for (const [x0, x1, z0, z1, height] of baseWings) {
    box(out, 'plaster', x0, x1, z0, z1, deck, deck + height, cream);
    if (lod === 0) continue;
    box(
      out,
      'roof',
      x0 - 0.21,
      x1 + 0.17,
      z0 - 0.15,
      z1 + 0.17,
      deck + height,
      deck + height + 0.26,
      turquoise,
    );
  }
  box(out, 'plaster', -1.25, 46.8, -18.2, 28.17, deck + 7.45, 13.37, white);
  box(out, 'roof', -2.27, 47.56, -19.16, 29.2, 13.37, 14.02, canopy);
  if (lod < 1) return;
  for (const [x0, x1, z, count] of [
    [-12.24, 18.8, 59.24, 6],
    [19.07, 32.25, 44.62, 3],
    [32.55, 68.92, 42.46, 7],
    [-25.83, -15.21, 49.24, 2],
  ]) {
    const face = facade([x0, z], [1, 0]);
    for (let i = 0; i < count; i++) {
      archOpening(out, face, ((i + 0.5) * (x1 - x0)) / count, deck + 0.63, 2.4, 4.98, {
        head: 'round',
        d: 0.048,
        glass: windowGlass,
        frame: white,
        frameWidth: 0.11,
        frameDepth: 0.091,
        mullions: lod > 1 ? 1 : 0,
        transoms: lod > 1 ? 2 : 0,
        mullionColor: rgb('aeb5ae'),
      });
    }
  }
  if (lod >= 2) {
    for (const [origin, direction, length, count] of [
      [[69.48, 42.13], [0, -1], 63.77, 10],
      [[18.59, -64.24], [-1, 0], 30.77, 6],
      [[-12.43, -63.42], [0, 1], 33.8, 6],
      [[46.58, 28.29], [-1, 0], 46.81, 10],
    ]) {
      const face = facade(origin, direction);
      for (let i = 0; i < count; i++) {
        const roof = origin[1] > 24 && origin[1] < 32;
        archOpening(
          out,
          face,
          ((i + 0.5) * length) / count,
          roof ? 10.72 : deck + 2.81,
          roof ? 2.75 : 1.84,
          roof ? 2.05 : 2.73,
          {
            head: roof ? 'flat' : 'round',
            glass: rgb('687776'),
            frame: white,
            frameWidth: 0.09,
            frameDepth: 0.079,
            mullions: 1,
            transoms: lod === 3 ? 2 : 0,
            d: 0.032,
          },
        );
      }
    }
  }
}

const crownProfile = [
  [0, 0.83],
  [0.13, 0.94],
  [0.26, 1],
  [0.44, 0.96],
  [0.61, 0.81],
  [0.75, 0.61],
  [0.86, 0.39],
  [0.96, 0.146],
  [1, 0.011],
];
function radiusAt(vertical) {
  const index = crownProfile.findIndex(([t]) => t >= vertical);
  if (index < 1) return crownProfile[0][1];
  const [a, b] = crownProfile[index - 1],
    [c, d] = crownProfile[index];
  return b + ((vertical - a) / (c - a)) * (d - b);
}

function dome(out, x, z, r, base, height, lod, patterned) {
  function point(a, t) {
    return radial(x, z, r * radiusAt(t), a, base + t * height);
  }
  if (lod < 2 || !patterned) {
    const n = lod === 0 ? (r > 8 ? 10 : 7) : lod === 1 ? (r > 8 ? 16 : 9) : 20;
    const shape =
      lod <= 1 ? crownProfile.filter((_, i) => [0, 2, 4, 6, 8].includes(i)) : crownProfile;
    lathe(
      out,
      'blue',
      x,
      z,
      shape.map(([y, dr]) => [base + y * height, dr * r]),
      n,
      blue,
    );
    return;
  }
  const count = lod === 2 ? (r > 8 ? 23 : 14) : 32;
  const rows = lod === 2 ? (r > 8 ? 7 : 5) : 9;
  for (let j = 0; j < rows; j++) {
    const bottom = j / rows,
      upper = (j + 1) / rows;
    const middle = (bottom + upper) / 2;
    for (let i = 0; i < count; i++) {
      const angle = (tau * i) / count,
        end = (tau * (i + 1)) / count;
      const axis = (angle + end) / 2;
      const a = point(angle, bottom),
        b = point(end, bottom);
      const c = point(end, upper),
        d = point(angle, upper);
      const e = point(axis, bottom),
        f = point(end, middle);
      const g = point(axis, upper),
        h = point(angle, middle);
      const center = point(axis, middle);
      const baseColor = middle > 0.76 ? rgb('c6c5b7') : ivory;
      for (const [p, q, r] of [
        [a, e, h],
        [e, b, f],
        [f, c, g],
        [g, d, h],
      ])
        tri(out, 'ivory', p, q, r, baseColor);
      for (const [p, q] of [
        [e, f],
        [f, g],
        [g, h],
        [h, e],
      ])
        tri(out, 'blue', p, q, center, middle > 0.9 ? rgb('6787aa') : blue);
    }
  }
}

function drumAndDomes(out, lod) {
  const [x, z] = mainDomeCenter;
  const sides = lod === 0 ? 8 : lod === 1 ? 12 : 28;
  const haunch = hallEave + 3.55;
  lathe(
    out,
    'plaster',
    x,
    z,
    [
      [haunch, 16.11],
      [haunch + 0.065, 16.18],
      [domeBase - 2.71, 12.7],
      [domeBase - 2.69, 10.95],
    ],
    8,
    white,
    Math.PI / 8,
  );
  lathe(
    out,
    'blue',
    x,
    z,
    [
      [domeBase - 2.78, 11.04],
      [domeBase - 2.15, 10.62],
      [domeBase + 0.01, domeRadius * 0.83],
    ],
    sides,
    blue,
  );
  dome(out, x, z, domeRadius, domeBase, domeHeight, lod, true);
  lathe(
    out,
    'gold',
    x,
    z,
    [
      [domeBase - 0.32, 9.8],
      [domeBase - 0.12, 9.88],
      [domeBase + 0.04, 9.77],
    ],
    sides,
    gold,
  );
  if (lod >= 1) {
    lathe(
      out,
      'gold',
      x,
      z,
      [
        [domeBase + domeHeight, 0.16],
        [domeBase + domeHeight + 0.51, 0.2],
        [domeBase + domeHeight + 0.75, 0.09],
        [domeBase + domeHeight + 1.36, 0.027],
      ],
      8,
      gold,
    );
  }
  if (lod >= 2) {
    for (let i = 0; i < 20; i++) {
      const theta = (tau * i) / 20;
      const [u, , v] = radial(x, z, 10.52, theta, 0);
      const face = facade([u, v], [Math.cos(theta), -Math.sin(theta)]);
      archOpening(out, face, 0, domeBase - 2.18, 0.79, 1.66, {
        head: 'round',
        frameWidth: 0.12,
        glass: rgb('425a72'),
        frame: gold,
        frameDepth: 0.07,
        d: 0.05,
      });
    }
  }
  for (const [u, v, y, r] of [
    [-11.9, 21.86, 13.78, 3.59],
    [-12.2, -12.63, 13.65, 3.32],
  ]) {
    lathe(
      out,
      'plaster',
      u,
      v,
      [
        [y - 2.5, r * 1.14],
        [y, r * 0.86],
      ],
      sides,
      white,
    );
    dome(out, u, v, r, y, r * 1.12, lod, true);
  }
}

function minaret(out, x, z, lod) {
  const n = lod <= 1 ? 8 : 16;
  box(out, 'plaster', x - 4.06, x + 4.06, z - 4.06, z + 4.06, deck - 0.16, 14.07, cream);
  if (lod === 0) {
    lathe(
      out,
      'plaster',
      x,
      z,
      [
        [13.58, 3.02],
        [27.71, 2.08],
        [28.62, 2.88],
        [29.43, 2.03],
        [38.34, 2.52],
        [39.16, 1.83],
        [43.31, 1.31],
      ],
      6,
      white,
    );
    lathe(
      out,
      'blue',
      x,
      z,
      [
        [43.3, 1.31],
        [44.47, 1.48],
        [minaretHeight, 0.11],
      ],
      6,
      blue,
    );
    return;
  } else {
    lathe(
      out,
      'plaster',
      x,
      z,
      [
        [13.65, 3.15],
        [15.16, 2.62],
        [25.66, 2.08],
        [27.52, 2.48],
        [28.06, 1.59],
        [36.87, 1.5],
        [37.38, 2.06],
        [38.13, 1.38],
        [42.83, 1.39],
        [43.42, 1.75],
        [43.43, 1.24],
      ],
      n,
      white,
    );
    for (const [base, r] of [
      [13.55, 3.94],
      [27.38, 3.02],
      [37, 2.62],
    ]) {
      lathe(
        out,
        'mold',
        x,
        z,
        [
          [base - 1.05, r * 0.79],
          [base - 0.52, r * 0.91],
          [base - 0.17, r],
          [base + 0.15, r],
        ],
        n,
        ivory,
      );
      for (const y of lod > 1 ? [base + 0.34, base + 1.31] : [])
        beamPath(out, 'trim', ring(x, z, r - 0.11, y, n), 0.12, 0.12, rgb('777061'), true);
      if (lod >= 2) {
        const spokes = lod === 3 ? 24 : 12;
        for (let i = 0; i < spokes; i++) {
          const angle = (i * tau) / spokes;
          beam(
            out,
            'mold',
            radial(x, z, r - 0.11, angle, base + 0.13),
            radial(x, z, r - 0.11, angle, base + 1.39),
            0.14,
            0.13,
            ivory,
          );
        }
      }
    }
    const slottedFaces = lod > 1 ? 8 : 0;
    for (let i = 0; i < slottedFaces; i++) {
      const theta = (i * tau) / 8;
      const [u, , v] = radial(x, z, 2.52, theta, 0);
      const face = facade([u, v], [Math.cos(theta), -Math.sin(theta)]);
      for (const y of [16.02, 18.85, 21.4, 23.64]) {
        fbox(
          out,
          'glass',
          face,
          -0.17,
          0.17,
          y,
          y + 0.56,
          -0.06 - (y - 16) * 0.052,
          0.035 - (y - 16) * 0.052,
          windowGlass,
        );
      }
    }
  }
  dome(out, x, z, 1.63, 43.31, minaretHeight - 43.4, lod, false);
  if (lod >= 1)
    lathe(
      out,
      'gold',
      x,
      z,
      [
        [minaretHeight - 0.17, 0.15],
        [minaretHeight + 0.69, 0.035],
      ],
      8,
      gold,
    );
}

function foundations(out, lod) {
  const slabY = deck + 0.09;
  extrude(out, 'deck', outline, foundation, slabY, apron, { top: false });
  cap(out, 'deck', outline, slabY, rgb('b5a993'));
  if (lod >= 1) {
    const walk = [
      [59, 41, slabY],
      [65, 41, slabY],
      [72.94, 66.44, 0.21],
      [69.5, 68.85, 0.21],
    ];
    const [a, b, c, d] = walk.map(([x, z, y]) => [x, y, z]);
    quad4(out, 'deck', d, c, b, a, apron);
    quad4(out, 'deck', [b[0], -0.91, b[2]], [c[0], -0.91, c[2]], c, b, apron);
    quad4(out, 'deck', [d[0], -0.91, d[2]], [a[0], -0.91, a[2]], a, d, apron);
  }
}

function build(out, lod) {
  foundations(out, lod);
  prayerWing(out, lod);
  linkedWings(out, lod);
  drumAndDomes(out, lod);
  for (const [x, z] of minarets) minaret(out, x, z, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kota-kinabalu-city-mosque-model.mjs';
const camera = [-112, 68, 153];
const lookAt = [0, 16.4, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Likas Bay floating mosque with cream arcades, a patterned blue dome, three-tier minarets and a low lagoon-side platform.',
  camera,
  lookAt,
  sunDirection: [-27, 65, 52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Mapped named mosque, its attached wings and integrated structural platforms.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whole-floating-mosque-and-four-minarets', position: camera, lookAt },
    {
      name: 'lagoon-side-arches-and-patterned-dome',
      position: [-61, 19, 104],
      lookAt: [-35, 18, 24],
    },
    {
      name: 'stepped-minaret-balconies-and-entrance',
      position: [87, 45, 83],
      lookAt: [23, 19, 19],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kota-kinabalu-city-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.111, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
