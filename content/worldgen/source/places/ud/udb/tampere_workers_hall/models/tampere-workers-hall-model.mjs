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
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const plan = read('../plan-controls.json');
const frame = read('../map-frame.json');
const survey = read('../terrain-grid.json');
const { osmHeightParts } = read('../native-map/tampere-hall-municipal-controls.json');
const { outline, holes } = frame.geometry;
const { foundation, roofElevationN2000 } = plan.dimensions;
const top = roofElevationN2000 - survey.modelDatumElevationMeters;
const levelHeight = { 4: 16.5, 5: 21.75, 6: 24.35, 7: 27.6, 8: top - 0.27 };
const splitHeight = 12.3;
const surfaces = {
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  pilaster: { slot: 'trim', graph: 'concrete_plain', roughness: 0.95 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
};
const cream = rgb('b9b2a3');
const courtyardCream = rgb('b1a798');
const lightTrim = rgb('c1b9a8');
const edge = rgb('bab2a2');
const plinth = rgb('8e8c87');
const metal = rgb('65645c');
const glass = rgb('5c6d72');
const slate = rgb('565b5d');

function cap(out, slot, rings, y, color) {
  const points = rings.flat();
  const holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).flat().length);
  const height = typeof y === 'number' ? () => y : y;
  const vertices = points.map(([x, z]) => [x, height(x, z), z]);
  const indices = earcut(points.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, vertices[indices[i]], vertices[indices[i + 2]], vertices[indices[i + 1]], color);
}

function envelope(out) {
  // The surveyed projections resume above the recessed ground-floor colonnade.
  const facadeRecess = (distance) => [
    ...outline.slice(0, 10),
    [-16.92, 24.65],
    [-16.92, distance],
    [-4.32, distance],
    [-4.32, 24.79],
    ...outline.slice(18),
  ];
  const lower = facadeRecess(22.72);
  extrude(out, 'granite', lower, foundation, 1.33, plinth, { holes, top: false });
  extrude(out, 'stucco', lower, 1.33, 4.39, cream, { holes, top: false });
  extrude(out, 'stucco', facadeRecess(24.25), 4.39, splitHeight, cream, { holes, top: false });
  cap(out, 'roof', [outline, ...holes], splitHeight, slate);
}

function slopeFor({ local, tags }, base) {
  const [x0, x1, z0, z1] = local.reduce(
    ([a, b, c, d], [x, z]) => [Math.min(a, x), Math.max(b, x), Math.min(c, z), Math.max(d, z)],
    [Infinity, -Infinity, Infinity, -Infinity],
  );
  const pitch = Number(tags['roof:height'] ?? 0);
  const alongX = ['351.25', '171.25'].includes(tags['roof:direction']);
  const divide = alongX ? x1 - x0 : z1 - z0;
  const fraction = (x, z) => (alongX ? (x - x0) / divide : (z - z0) / divide);
  const reverse = tags['roof:direction'] === '171.25';
  if (tags['roof:shape'] === 'skillion')
    return (x, z) => base + pitch * (reverse ? 1 - fraction(x, z) : fraction(x, z));
  return () => base;
}

const mappedParts = osmHeightParts.filter(({ way }) => way.id !== '1526697491');
function roofParts(out, lod) {
  for (const part of mappedParts) {
    const ring = outwardRing(part.local);
    const level = Number(part.tags['building:levels']);
    const height = levelHeight[level];
    const topY = slopeFor(part, height);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.08) continue;
      const face = wallFace(a, b);
      const a0 = face.P(0, splitHeight),
        b0 = face.P(face.length, splitHeight);
      const a1 = face.P(0, topY(...a)),
        b1 = face.P(face.length, topY(...b));
      tri(out, 'stucco', a0, b0, b1, courtyardCream);
      tri(out, 'stucco', a0, b1, a1, courtyardCream);
    }
    cap(out, 'roof', [ring], topY, slate);
    if (lod >= 2) {
      const vertices = ring.map(([x, z]) => [x, topY(x, z) + 0.035, z]);
      beamPath(out, 'roof', vertices, 0.13, 0.12, metal, true);
    }
  }
  // The corner block has a capped parapet with projecting end piers.
  const corner = facade([9.05, 24.51], [1, 0]);
  fbox(out, 'pilaster', corner, 0, 13.21, top - 0.55, top - 0.23, -0.35, 0.18, lightTrim);
  for (const u of [0.28, 4.45, 8.76, 12.94])
    fbox(out, 'pilaster', corner, u - 0.225, u + 0.225, top - 1.1, top, -0.51, 0.21, edge);
  if (lod >= 2) {
    const roofhouse = facade([2.04, 19.0], [1, 0]);
    fbox(out, 'stucco', roofhouse, -3.28, 0, 27.1, 28.2, -2.4, 0.3, courtyardCream);
    fbox(out, 'roof', roofhouse, -3.48, 0.14, 28.2, 28.34, -2.63, 0.43, slate);
  }
}

const street = facade([0, 24.61], [1, 0]);
const entrance = facade([0, 22.73], [1, 0]);
const tallBays = [-15.32, -12.13, -8.96, -5.86];
const piers = [-16.94, -13.77, -10.56, -7.43, -4.24];
function post(out, x, z, size, lower, upper, lod) {
  const corners =
    lod >= 2
      ? [
          [1, 0.56],
          [0.56, 1],
          [-0.56, 1],
          [-1, 0.56],
          [-1, -0.56],
          [-0.56, -1],
          [0.56, -1],
          [1, -0.56],
        ]
      : [
          [1, 1],
          [-1, 1],
          [-1, -1],
          [1, -1],
        ];
  const ring = outwardRing(corners.map(([u, v]) => [x + u * size, z + v * size]));
  const at = (y, scale) => ring.map(([u, v]) => [x + (u - x) * scale, y, z + (v - z) * scale]);
  loft(
    out,
    'granite',
    [
      at(lower, 1.14),
      at(lower + 0.24, 1.14),
      at(lower + 0.32, 1),
      at(upper - 0.22, 0.92),
      at(upper - 0.16, 1.11),
      at(upper, 1.11),
    ],
    plinth,
  );
}

function balconySlab(out, y, depth, lod, solidRail) {
  const shape = [
    [-17.14, 23.98],
    [-4.18, 23.98],
    [-4.18, depth - 0.27],
    [-4.49, depth],
    [-16.78, depth],
    [-17.14, depth - 0.32],
  ];
  extrude(out, 'pilaster', shape, y - 0.44, y, edge, { top: false });
  cap(out, 'pilaster', [shape], y, lightTrim);
  extrude(out, 'pilaster', shape, y, y + (solidRail ? 0.82 : 0.52), lightTrim, { top: false });
  const rail = shape
    .slice(2)
    .reverse()
    .map(([x, z]) => [x, y + (solidRail ? 0.85 : 0.95), z]);
  beamPath(out, 'trim', rail, 0.13, 0.09, metal);
  if (lod >= 2 && !solidRail) {
    for (const x of piers) {
      beam(
        out,
        'trim',
        [x, y + 0.5, depth - 0.11],
        [x, y + 0.94, depth - 0.11],
        0.083,
        0.083,
        metal,
      );
    }
  }
}

function window(out, face, u, y, width, height, lod, head = 'flat', tint = glass) {
  if (lod === 1 && head === 'flat') {
    const a = u - width / 2,
      b = u + width / 2;
    quad4(
      out,
      'glass',
      face.P(a, y, 0.06),
      face.P(b, y, 0.06),
      face.P(b, y + height, 0.06),
      face.P(a, y + height, 0.06),
      tint,
    );
    return;
  }
  opening(out, face, u, y, width, height, {
    head,
    glass: tint,
    frame: lightTrim,
    frameWidth: lod > 1 ? 0.102 : 0.082,
    frameDepth: 0.08,
    d: 0.035,
    mullions: lod > 1 ? 1 : 0,
    transoms: lod > 2 ? 1 : 0,
    mullionColor: metal,
    sill: lod > 1,
  });
}

function frontArcade(out, lod) {
  balconySlab(out, 4.43, 25.94, lod, false);
  balconySlab(out, 9.64, 25.86, lod, true);
  for (const x of piers) {
    post(out, x, 24.94, 0.275, -0.77, 3.93, lod);
    fbox(out, 'pilaster', street, x - 0.17, x + 0.17, 4.39, 9.36, -0.39, 0.79, lightTrim);
    fbox(out, 'pilaster', street, x - 0.18, x + 0.18, 10.35, 21.42, -0.15, 0.35, lightTrim);
    if (lod >= 2) {
      for (const step of [-0.09, 0.08])
        fbox(
          out,
          'pilaster',
          street,
          x + step - 0.018,
          x + step + 0.018,
          10.89,
          20.93,
          0.35,
          0.395,
          edge,
        );
    }
  }
  fbox(out, 'granite', street, -17.29, -4.11, 3.73, 4.13, -1.94, 0.69, plinth);
  for (const x of tallBays) {
    window(out, entrance, x, 0.27, 1.7, 2.86, lod, 'round', rgb('554b42'));
    window(out, street, x, 5.18, 1.23, 3.73, lod, 'round', rgb('72634c'));
    window(out, street, x, 10.52, 1.39, 2.88, lod, 'round');
    window(out, street, x, 14.78, 1.34, 3.16, lod);
    window(out, street, x, 19.26, 1.22, 1.59, lod);
  }
  if (lod >= 2) {
    // Flags are represented by poles. The street reference also shows their mounts.
    for (const x of tallBays) {
      beam(out, 'trim', [x, 5.03, 25.38], [x, 7.37, 27.28], 0.064, 0.06, metal);
    }
  }
}

function frontage(out, lod) {
  frontArcade(out, lod);
  const southEnd = facade([0, 24.66], [1, 0]);
  for (const x of [-20.73, -18.96]) {
    for (const y of [1.31, 5.54, 11.18, 15.75]) window(out, southEnd, x, y, 0.58, 1.76, lod);
    fbox(out, 'pilaster', southEnd, x - 0.71, x - 0.53, 0.81, 21.42, -0.22, 0.26, edge);
  }
  const adjacent = facade([0, 24.27], [1, 0]);
  for (const x of [-2.78, 0.66, 3.89, 7.12]) {
    for (const y of [4.95, 10.72, 15.23, 19.15]) window(out, adjacent, x, y, 0.78, 1.59, lod);
  }
  window(out, adjacent, -2.45, 0.24, 0.71, 1.75, lod, 'round');
  window(out, adjacent, 1.85, 0.007, 2.61, 1.27, lod, 'round');
  const high = facade([0, 24.57], [1, 0]);
  for (const x of [10.6, 13.5, 16.4, 19.36, 21.17]) {
    for (const y of [1.37, 5.43, 9.88, 14.62, 19.0, 23.11, 27.13, 29.88])
      window(out, high, x, y, 0.88, y >= 27 ? 1.37 : 2.04, lod);
  }
  for (const [x0, x1, y] of [
    [-22.25, -4.2, 21.27],
    [-4.15, 8.5, 23.79],
    [8.71, 22.32, 28.93],
  ]) {
    fbox(out, 'pilaster', street, x0, x1, y - 0.13, y + 0.13, -0.42, 0.24, edge);
  }
}

function outerWallAt(ring, along, axis, edgeSign) {
  const cuts = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (a[axis] <= along === b[axis] <= along) continue;
    const t = (along - a[axis]) / (b[axis] - a[axis]);
    cuts.push(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]));
  }
  if (cuts.length) return edgeSign * Math.max(...cuts.map((value) => value * edgeSign));
}

function secondaryFaçades(out, lod) {
  const elevations = [
    { start: 24.32, span: -48.61, bays: 13, axis: 1, edgeSign: 1 },
    { start: -24.45, span: 48.48, bays: 13, axis: 1, edgeSign: -1 },
    { start: 22.21, span: -44.51, bays: 12, axis: 0, edgeSign: -1 },
  ];
  for (const { start, span, bays, axis, edgeSign } of elevations) {
    for (let j = 0; j < bays; j++) {
      const along = start + ((j + 0.5) * span) / bays;
      const roofShapes = mappedParts
        .flatMap((part) => {
          const boundary = outerWallAt(part.local, along, axis, edgeSign);
          if (boundary === undefined) return [];
          const [x, z] = axis === 1 ? [boundary, along] : [along, boundary];
          return [
            {
              boundary,
              ceiling: slopeFor(part, levelHeight[Number(part.tags['building:levels'])])(x, z),
            },
          ];
        })
        .sort((a, b) => edgeSign * (b.boundary - a.boundary));
      const mainBoundary = outerWallAt(outline, along, axis, edgeSign);
      for (let y = 1.62, row = 0; y < top - 2.3; y += 3.76, row++) {
        if (lod === 1 && (row >= 3 || j % 2 > 0)) continue;
        const boundary =
          y < splitHeight
            ? mainBoundary
            : roofShapes.find((part) => part.ceiling > y + 2.1)?.boundary;
        if (
          boundary === undefined ||
          (y >= splitHeight && Math.abs(boundary - mainBoundary) > 0.85)
        )
          continue;
        const normalOffset = boundary + edgeSign * 0.047;
        const face =
          axis === 1
            ? facade([normalOffset, along], [0, -edgeSign])
            : facade([along, normalOffset], [-1, 0]);
        window(
          out,
          face,
          0,
          y,
          row === 0 ? 1.26 : 1.02,
          row === 0 ? 1.55 : 1.96,
          lod === 3 ? 2 : 1,
        );
      }
    }
  }
  if (lod === 3) {
    for (const [a, b] of [
      [
        [-5.25, 8.9],
        [-5.35, -12.1],
      ],
      [
        [-5.0, -13.1],
        [3.38, -13.93],
      ],
      [
        [5.1, -15.8],
        [5.62, -1.56],
      ],
      [
        [5.0, 6],
        [-4.5, 8.7],
      ],
    ]) {
      const f = wallFace(a, b);
      const bays = Math.floor(f.length / 3.4);
      for (let j = 0; j < bays; j++) {
        const u = ((j + 0.5) * f.length) / bays;
        for (const y of [5.15, 8.78, 12.43, 16.3]) window(out, f, u, y, 0.95, 1.59, 1);
      }
    }
  }
}

function build(out, lod) {
  envelope(out);
  roofParts(out, lod);
  if (lod === 0) {
    fbox(out, 'pilaster', street, -17.14, -4.18, 4.0, 4.9, -0.19, 1.27, edge);
    fbox(out, 'pilaster', street, -17.14, -4.18, 9.25, 10.32, -0.19, 1.19, edge);
    for (const x of piers)
      fbox(out, 'granite', street, x - 0.28, x + 0.28, -0.77, 3.96, -0.09, 0.64, plinth);
    return;
  }
  frontage(out, lod);
  secondaryFaçades(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const streetLevel = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
export { streetLevel as street };

const recipe = 'tampere-workers-hall-model.mjs';
const camera = [55, 35, 79];
const lookAt = [0, 15, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The historic Tampere Workers’ Hall with its granite colonnade, rounded balconies, stepped corner tower and enclosed courtyard.',
  camera,
  lookAt,
  sunDirection: [-14, 51, 63],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    holes,
    minimumCoverage: 0.95,
    basis: 'Surveyed City of Tampere wall outline and enclosed yard of protected Hall 14527.',
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
    { name: 'historic-hall-and-hallituskatu-corner', position: camera, lookAt },
    {
      name: 'haemeenpuisto-colonnade-and-balconies',
      position: [11, 11, 47],
      lookAt: [-10, 12, 23],
    },
    { name: 'roof-tiers-and-enclosed-courtyard', position: [-43, 56, -52], lookAt: [0, 17, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tampere-workers-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.83,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.042, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. City of Tampere and National Land Survey of Finland source data CC BY 4.0. © OpenStreetMap contributors.',
};
