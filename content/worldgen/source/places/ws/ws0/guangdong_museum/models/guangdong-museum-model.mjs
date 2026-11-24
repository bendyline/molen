import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, shellBase, roofHeight, roofWellFloor, viewingDeck, roofOpening, skylight } =
  plan.dimensions;
const outline = frame.geometry.outline;
const [northwest, , , , southwest, southeast, northeast] = outline;
const walls = [
  wallFace(southwest, southeast),
  wallFace(southeast, northeast),
  wallFace(northeast, northwest),
  wallFace(northwest, southwest),
];
const surfaces = {
  panel: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.77, metallic: 0.18 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  void: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.12 },
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.9 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
};
const colors = {
  panel: rgb('454a52'),
  roof: rgb('5b6068'),
  trim: rgb('8e373a'),
  void: rgb('292d33'),
  glass: rgb('81928d'),
  concrete: rgb('a19c91'),
};
const opening = (u0, v0, u1, v1, depth, surface = 'void') => ({
  u0,
  v0,
  u1,
  v1,
  w: -depth,
  surface,
});
const horizontal = (a, b, v, width, depth) =>
  opening(Math.min(a, b), v - width / 2, Math.max(a, b), v + width / 2, depth);
const vertical = (u, a, b, width, depth) =>
  opening(u - width / 2, Math.min(a, b), u + width / 2, Math.max(a, b), depth);

function track(points, widthU, widthV, depth) {
  return points.slice(1).map(([u, v], index) => {
    const [lastU, lastV] = points[index];
    return u === lastU
      ? vertical(
          u,
          lastV - (Math.sign(v - lastV) * widthV) / 2,
          v + (Math.sign(v - lastV) * widthV) / 2,
          widthU,
          depth,
        )
      : horizontal(
          lastU - (Math.sign(u - lastU) * widthU) / 2,
          u + (Math.sign(u - lastU) * widthU) / 2,
          v,
          widthV,
          depth,
        );
  });
}

// Openings are arranged in the direction a viewer sees the elevation from outside.
const principalSouth = [
  opening(0.55, 0.39, 0.69, 0.56, 2.75),
  opening(0.64, 0.22, 0.69, 0.4, 2.75),
  opening(0.55, 0.46, 0.68, 0.55, 0.78, 'glass'),
  opening(0.655, 0.26, 0.68, 0.46, 0.78, 'glass'),
];
const principalWest = [
  opening(0.36, 0, 0.65, 0.15, 5, 'glass'),
  opening(0.76, 0.44, 0.83, 0.57, 1.45, 'glass'),
];
const secondary = [
  [
    opening(0.14, 0.69, 0.22, 0.75, 1.5, 'glass'),
    opening(0.85, 0.24, 0.87, 0.45, 1.3),
    opening(0.35, 0.57, 0.42, 0.64, 1.3, 'glass'),
  ],
  [
    opening(0.2, 0.61, 0.28, 0.67, 1.7, 'glass'),
    opening(0.57, 0.17, 0.64, 0.28, 1.5),
    opening(0.74, 0.56, 0.77, 0.79, 1.5, 'glass'),
  ],
  [
    opening(0.24, 0.57, 0.32, 0.67, 1.75, 'glass'),
    opening(0.75, 0.38, 0.8, 0.51, 1.45),
    opening(0.43, 0.79, 0.5, 0.85, 1.5, 'glass'),
  ],
  [
    opening(0.2, 0.19, 0.24, 0.29, 2),
    opening(0.44, 0.7, 0.48, 0.79, 1.5),
    opening(0.89, 0.13, 0.91, 0.34, 1.25, 'glass'),
  ],
];
const routes = [
  [
    [
      [0.05, 0.12],
      [0.12, 0.12],
      [0.12, 0.28],
      [0.22, 0.28],
      [0.22, 0.73],
    ],
    [
      [0.29, 1],
      [0.29, 0.78],
      [0.34, 0.78],
      [0.34, 0.44],
      [0.27, 0.44],
    ],
    [
      [0.26, 0],
      [0.26, 0.18],
      [0.37, 0.18],
      [0.37, 0.37],
    ],
    [
      [0.45, 1],
      [0.45, 0.74],
      [0.57, 0.74],
      [0.57, 0.59],
    ],
    [
      [0.48, 0],
      [0.48, 0.18],
      [0.42, 0.18],
      [0.42, 0.23],
    ],
    [
      [0.63, 0.57],
      [0.72, 0.57],
      [0.72, 0.71],
      [0.78, 0.71],
      [0.78, 1],
    ],
    [
      [0.81, 0],
      [0.81, 0.25],
      [0.88, 0.25],
      [0.88, 0.76],
    ],
    [
      [0.94, 0.28],
      [0.94, 0.18],
      [0.97, 0.18],
    ],
    [
      [0, 0.21],
      [0.047, 0.21],
      [0.047, 0.3],
    ],
    [
      [0.09, 1],
      [0.09, 0.79],
      [0.12, 0.79],
    ],
  ],
  [
    [
      [0.12, 1],
      [0.12, 0.64],
      [0.25, 0.64],
      [0.25, 0.44],
    ],
    [
      [0.41, 0],
      [0.41, 0.27],
      [0.53, 0.27],
      [0.53, 0.53],
    ],
    [
      [0.69, 1],
      [0.69, 0.76],
      [0.75, 0.76],
      [0.75, 0.42],
      [0.86, 0.42],
    ],
    [
      [0.95, 0],
      [0.95, 0.3],
      [0.86, 0.3],
      [0.86, 0.55],
    ],
    [
      [0.32, 0.76],
      [0.41, 0.76],
      [0.41, 0.86],
      [0.45, 0.86],
    ],
  ],
  [
    [
      [0.15, 1],
      [0.15, 0.72],
      [0.32, 0.72],
      [0.32, 0.49],
    ],
    [
      [0.23, 0],
      [0.23, 0.2],
      [0.35, 0.2],
      [0.35, 0.43],
      [0.44, 0.43],
    ],
    [
      [0.49, 1],
      [0.49, 0.8],
      [0.59, 0.8],
      [0.59, 0.39],
    ],
    [
      [0.66, 0],
      [0.66, 0.25],
      [0.79, 0.25],
      [0.79, 0.52],
    ],
    [
      [0.86, 0.36],
      [0.86, 0.65],
      [0.95, 0.65],
      [0.95, 0.76],
    ],
  ],
  [
    [
      [0.11, 1],
      [0.11, 0.78],
      [0.19, 0.78],
      [0.19, 0.36],
      [0.26, 0.36],
    ],
    [
      [0.29, 0],
      [0.29, 0.39],
      [0.34, 0.39],
      [0.34, 0.69],
      [0.45, 0.69],
      [0.45, 1],
    ],
    [
      [0.49, 0.23],
      [0.49, 0.41],
      [0.58, 0.41],
      [0.58, 0.59],
      [0.65, 0.59],
    ],
    [
      [0.72, 1],
      [0.72, 0.73],
      [0.78, 0.73],
      [0.78, 0.48],
      [0.85, 0.48],
    ],
    [
      [0.76, 0],
      [0.76, 0.25],
      [0.84, 0.25],
      [0.84, 0.35],
    ],
    [
      [0.91, 1],
      [0.91, 0.83],
      [0.94, 0.83],
      [0.94, 0.59],
    ],
    [
      [0.59, 0.64],
      [0.59, 0.88],
      [0.62, 0.88],
      [0.62, 1],
    ],
  ],
];

function partitions(spans) {
  return [...new Set([0, 1, ...spans.map((n) => Math.min(1, Math.max(0, n)))])].sort(
    (a, b) => a - b,
  );
}

/** Draw the cladding and cut returns across one elevation or the roof. */
function carvedPlane(out, point, base, cuts, returnSurface, seams = {}) {
  const us = partitions([...cuts.flatMap(({ u0, u1 }) => [u0, u1]), ...(seams.u ?? [])]);
  const vs = partitions([...cuts.flatMap(({ v0, v1 }) => [v0, v1]), ...(seams.v ?? [])]);
  const cells = vs.slice(1).map((v1, j) =>
    us.slice(1).map((u1, i) => {
      const u = (u1 + us[i]) / 2;
      const v = (v1 + vs[j]) / 2;
      return (
        cuts.findLast((c) => u > c.u0 && u < c.u1 && v > c.v0 && v < c.v1) ?? {
          w: 0,
          surface: base,
        }
      );
    }),
  );
  const draw = (surface, points, color = colors[surface]) => quad4(out, surface, ...points, color);
  for (let j = 0; j < cells.length; j++) {
    for (let i = 0; i < cells[j].length; i++) {
      const { w, surface } = cells[j][i];
      const u0 = us[i],
        u1 = us[i + 1],
        v0 = vs[j],
        v1 = vs[j + 1];
      const p0 = point(u0, v0, w),
        p1 = point(u1, v0, w);
      const p2 = point(u1, v1, w),
        p3 = point(u0, v1, w);
      const color = seams.color
        ? seams.color(surface, (u1 + u0) / 2, (v1 + v0) / 2)
        : colors[surface];
      draw(surface, [p0, p1, p2, p3], color);
      const right = cells[j][i + 1];
      if (right && right.w !== w) {
        const edge = [p1, point(u1, v0, right.w), point(u1, v1, right.w), p2];
        draw(returnSurface(right, cells[j][i]), w > right.w ? edge : edge.reverse());
      }
      const above = cells[j + 1]?.[i];
      if (above && above.w !== w) {
        const edge = [p3, p2, point(u1, v1, above.w), point(u0, v1, above.w)];
        draw(returnSurface(above, cells[j][i]), w > above.w ? edge : edge.reverse());
      }
    }
  }
}

const panelSeams = Array.from({ length: 19 }, (_, i) => (i + 1) / 20);
const courseSeams = Array.from({ length: 8 }, (_, i) => (i + 1) / 9);
function variedPanel(surface, u, v) {
  if (surface !== 'panel') return colors[surface];
  const i = Math.floor(u * 20);
  const j = Math.floor(v * 9);
  return colors.panel.map((part) => part * (0.982 + ((i * 11 + j * 7) % 10) * 0.0046));
}
function returnMaterial(a, b) {
  return Math.abs(a.w - b.w) < 1.82 && a.surface !== 'concrete' && b.surface !== 'concrete'
    ? 'trim'
    : 'void';
}
function cladding(out, lod) {
  for (const [index, face] of walls.entries()) {
    const principal = index === 0 ? principalSouth : index === 3 ? principalWest : [];
    const count = lod === 0 ? 0 : lod === 1 ? 1 : lod === 2 ? 4 : routes[index].length;
    const cuts = [
      ...routes[index].slice(0, count).flatMap((route) => track(route, 0.009, 0.017, 1.45)),
      ...secondary[index].slice(0, lod === 0 ? 0 : lod === 1 ? 1 : 3),
      ...principal,
    ];
    carvedPlane(
      out,
      (u, v, w) => face.P(u * face.length, shellBase + v * (roofHeight - shellBase), w),
      'panel',
      cuts,
      returnMaterial,
      lod === 3 ? { u: panelSeams, v: courseSeams, color: variedPanel } : {},
    );
  }
}

const interpolate = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function roofPoint(u, v, w) {
  const [x, z] = interpolate(
    interpolate(southwest, southeast, u),
    interpolate(northwest, northeast, u),
    v,
  );
  return [x, roofHeight + w, z];
}
const roofRoutes = [
  [
    [0.1, 0.05],
    [0.15, 0.05],
    [0.15, 0.15],
    [0.19, 0.15],
  ],
  [
    [0.28, 0.03],
    [0.28, 0.1],
    [0.36, 0.1],
    [0.36, 0.16],
  ],
  [
    [0.43, 0.05],
    [0.46, 0.05],
    [0.46, 0.11],
    [0.53, 0.11],
  ],
  [
    [0.62, 0],
    [0.62, 0.08],
    [0.69, 0.08],
    [0.69, 0.16],
  ],
  [
    [0.83, 0.03],
    [0.83, 0.12],
    [0.77, 0.12],
    [0.77, 0.18],
  ],
  [
    [0.91, 0.09],
    [0.96, 0.09],
    [0.96, 0.18],
    [0.92, 0.18],
  ],
  [
    [0.04, 0.25],
    [0.11, 0.25],
    [0.11, 0.32],
    [0.19, 0.32],
  ],
  [
    [0, 0.45],
    [0.07, 0.45],
    [0.07, 0.51],
    [0.16, 0.51],
  ],
  [
    [0.19, 0.58],
    [0.12, 0.58],
    [0.12, 0.67],
    [0.05, 0.67],
  ],
  [
    [0.04, 0.74],
    [0.11, 0.74],
    [0.11, 0.83],
    [0.19, 0.83],
  ],
  [
    [0.06, 0.9],
    [0.15, 0.9],
    [0.15, 0.95],
    [0.22, 0.95],
  ],
  [
    [0.25, 0.78],
    [0.27, 0.78],
    [0.27, 0.88],
    [0.37, 0.88],
  ],
  [
    [0.43, 0.95],
    [0.43, 0.9],
    [0.51, 0.9],
    [0.51, 0.83],
  ],
  [
    [0.57, 0.96],
    [0.61, 0.96],
    [0.61, 0.88],
    [0.7, 0.88],
  ],
  [
    [0.75, 0.93],
    [0.82, 0.93],
    [0.82, 0.87],
    [0.87, 0.87],
  ],
  [
    [0.91, 0.95],
    [0.91, 0.9],
    [0.97, 0.9],
    [0.97, 0.84],
  ],
  [
    [0.84, 0.8],
    [0.79, 0.8],
    [0.79, 0.73],
    [0.89, 0.73],
  ],
  [
    [0.98, 0.7],
    [0.89, 0.7],
    [0.89, 0.66],
    [0.84, 0.66],
  ],
  [
    [0.92, 0.59],
    [0.85, 0.59],
    [0.85, 0.52],
    [0.9, 0.52],
  ],
  [
    [0.98, 0.41],
    [0.92, 0.41],
    [0.92, 0.47],
    [0.83, 0.47],
  ],
  [
    [0.83, 0.34],
    [0.88, 0.34],
    [0.88, 0.3],
    [0.94, 0.3],
  ],
  [
    [0.91, 0.21],
    [0.85, 0.21],
    [0.85, 0.25],
    [0.8, 0.25],
  ],
];

function atrium(out, lod) {
  const [x0, x1, z0, z1] = roofOpening;
  const cuts = [
    ...roofRoutes
      .filter((_, index) => lod === 3 || (lod === 2 && index % 3 === 0))
      .flatMap((route) => track(route, 0.009, 0.009, 1.2)),
    opening(
      (x0 + 56) / 112,
      (57 - z1) / 114,
      (x1 + 56) / 112,
      (57 - z0) / 114,
      roofHeight - roofWellFloor,
      'concrete',
    ),
  ];
  carvedPlane(out, roofPoint, 'roof', cuts, returnMaterial);
  const [sx0, sx1, sz0, sz1] = skylight;
  const curb = roofWellFloor + 0.58;
  const top = roofHeight - 0.73;
  abox(
    out,
    'trim',
    [sx0 - 0.7, roofWellFloor - 0.04, sz0 - 0.7],
    [sx1 + 0.7, curb, sz1 + 0.7],
    rgb('c3bb9f'),
    { bottom: false },
  );
  abox(out, 'glass', [sx0, curb, sz0], [sx1, top, sz1], colors.glass, { bottom: false });
  const bandWidth = 5.4;
  const band = roofWellFloor + 0.86;
  const deck = [
    [
      [x0 + 3.3, z0 + 3],
      [x1 - 3.3, z0 + 3 + bandWidth],
    ],
    [
      [x0 + 3.3, z1 - 3 - bandWidth],
      [x1 - 3.3, z1 - 3],
    ],
    [
      [x0 + 3.3, z0 + 3 + bandWidth],
      [x0 + 3.3 + bandWidth, z1 - 3 - bandWidth],
    ],
    [
      [x1 - 3.3 - bandWidth, z0 + 3 + bandWidth],
      [x1 - 3.3, z1 - 3 - bandWidth],
    ],
  ];
  for (const [[a, b], [c, d]] of deck)
    abox(out, 'glass', [a, roofWellFloor, b], [c, band, d], rgb('a7ada1'), { bottom: false });
  if (lod >= 1) {
    const division = lod >= 2 ? 14 : 6;
    for (let i = 1; i < division; i++) {
      const x = sx0 + (i / division) * (sx1 - sx0);
      const z = sz0 + (i / division) * (sz1 - sz0);
      abox(out, 'trim', [x - 0.05, top, sz0], [x + 0.05, top + 0.08, sz1], rgb('aab1a7'), {
        bottom: false,
      });
      abox(out, 'trim', [sx0, top, z - 0.05], [sx1, top + 0.075, z + 0.05], rgb('9ea89f'), {
        bottom: false,
      });
    }
    for (const [x, z] of [
      [22, -9],
      [22, 4],
      [22, 15],
      [-20, 8],
      [-8, -16],
    ]) {
      abox(
        out,
        'roof',
        [x - 2, roofWellFloor, z - 1.1],
        [x + 2, roofWellFloor + 1.18, z + 1.1],
        rgb('c4c4bc'),
        { bottom: false },
      );
    }
  }
}

function base(out, lod) {
  const concreteFootprint = outwardRing([
    [-48, -53],
    [-27, -55],
    [47, -53],
    [52, -40],
    [51, 47],
    [42, 53],
    [-48, 51],
    [-51, 20],
    [-50, -18],
  ]);
  extrude(out, 'concrete', concreteFootprint, foundation, shellBase - 0.2, colors.concrete, {
    top: false,
  });
  const glazing = wallFace([-50.4, -51], [-49.85, 48]);
  fbox(out, 'glass', glazing, 14, 79, viewingDeck, shellBase - 0.15, -0.4, 0.35, rgb('4a5757'));
  const ramp = [
    [-70, 0.14, -34],
    [-70, 0.14, 21],
    [-50.3, viewingDeck, 21],
    [-50.3, viewingDeck, -34],
  ];
  quad4(out, 'concrete', ...ramp, colors.concrete);
  quad4(out, 'concrete', ramp[2], ramp[1], [-70, -0.75, 21], [-50.3, -0.75, 21], colors.concrete);
  quad4(out, 'concrete', ramp[0], ramp[3], [-50.3, -0.75, -34], [-70, -0.75, -34], colors.concrete);
  for (let i = 0; i < 4; i++) {
    const z = -37 + i * 23;
    abox(
      out,
      'concrete',
      [-53, viewingDeck - 2.4, z - 1.4],
      [-50.7, shellBase, z + 1.4],
      rgb('938e87'),
      { bottom: false },
    );
  }
  if (lod >= 2) {
    for (let i = 0; i <= 20; i++) {
      const u = 14 + i * 3.25;
      fbox(
        out,
        'trim',
        glazing,
        u - 0.055,
        u + 0.055,
        viewingDeck,
        shellBase - 0.15,
        0.36,
        0.47,
        rgb('747a76'),
      );
    }
  }
}

function build(out, lod) {
  base(out, lod);
  cladding(out, lod);
  atrium(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'guangdong-museum-model.mjs';
const camera = [-132, 131, 176];
const lookAt = [0, 24, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'A charcoal exhibition box with carved red-lined voids, a broad recessed atrium roof and an elevated west entrance.',
  camera,
  lookAt,
  sunDirection: [-50, 65, 38],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Named exhibition hall footprint aligned to the roof shell and floor plan.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'carved-box-and-central-roof', position: camera, lookAt },
    { name: 'south-glazed-cut-and-red-returns', position: [-39, 38, 151], lookAt: [0, 30, 38] },
    { name: 'west-public-entry-and-overhang', position: [-129, 18, 35], lookAt: [-51, 17, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'guangdong-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
