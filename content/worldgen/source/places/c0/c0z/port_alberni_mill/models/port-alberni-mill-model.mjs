/** The current core of the Port Alberni pulp and paper mill at Stamp Avenue. */
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const axis = plan.dimensions.hallAxisAdjustmentRadians;
const cosine = Math.cos(axis);
const sine = Math.sin(axis);
const fromHall = ([x, y, z]) => [x * cosine + z * sine, y, z * cosine - x * sine];
const toHall = ([x, z]) => [x * cosine - z * sine, z * cosine + x * sine];
const { polygons } = read('map-frame').geometry;
const rings = polygons.map((ring) => ring.map(toHall));
const colors = Object.fromEntries(
  Object.entries({
    siding: 'b7b7a9',
    bright: 'c8c7b9',
    pale: 'd5d0be',
    zinc: 'a1a29a',
    dark: '797f7c',
    cement: '919690',
    lower: 'aaa99b',
    asphalt: '626b6a',
    roof: '898d88',
    bluegrey: '748384',
    trim: '727c78',
    glass: '45575a',
    painted: '9e5e48',
    rust: '8a604d',
    smoke: '373e3b',
    rib: 'a8aa9f',
    rim: 'b4b5a9',
    tank: 'b7b6a4',
  }).map(([key, tint]) => [key, rgb(tint)]),
);

const surfaces = {
  wall: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.87, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91, metallic: 0.13 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#fffffc', roughness: 0.52 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
};

function face(out, slot, points, direction, color) {
  const wanted = fromHall(direction);
  let world = points.map(fromHall);
  let normal = normalFor(...world);
  if (normal.reduce((sum, value, i) => sum + value * wanted[i], 0) < 0) {
    world = world.reverse();
    normal = normalFor(...world);
  }
  if (world.length === 4) quad(out, slot, world, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      world,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function lid(out, ring, heights, tint, slot = 'roof') {
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((j) => [ring[j][0], heights[j], ring[j][1]]);
    face(out, slot, points, [0, 1, 0], tint);
  }
}

function wall(out, p, q, low, high, facing, slot, tint) {
  face(
    out,
    slot,
    [
      [p[0], low, p[1]],
      [q[0], low, q[1]],
      [q[0], high, q[1]],
      [p[0], high, p[1]],
    ],
    facing,
    tint,
  );
}

function shell(out, ring, low, high, tint, roof, detail) {
  const sign = Math.sign(
    ring.reduce((area, [x, z], i) => {
      const [nx, nz] = ring[(i + 1) % ring.length];
      return area + x * nz - nx * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length];
    const dx = q[0] - p[0],
      dz = q[1] - p[1];
    const normal = [sign * dz, 0, -sign * dx];
    wall(out, p, q, low, high, normal, 'wall', tint);
    const length = Math.hypot(dx, dz);
    if (!detail || length < 3 || low > 10) continue;
    const outward = [normal[0] / length, normal[2] / length];
    const edge = (u, offset) => [
      p[0] + dx * u + outward[0] * offset,
      p[1] + dz * u + outward[1] * offset,
    ];
    wall(
      out,
      edge(0.01, 0.11),
      edge(0.99, 0.11),
      high - 0.7,
      high + 0.06,
      normal,
      'trim',
      colors.zinc,
    );
    if (detail < 2 || length < 15 || low > 6) continue;
    const bays = Math.floor(length / (detail === 2 ? 12 : 7.5));
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + 0.5) / bays;
      const half = Math.min(2.55 / length, 0.36 / bays);
      wall(
        out,
        edge(u - half, 0.14),
        edge(u + half, 0.14),
        high - 3.3,
        high - 1.85,
        normal,
        'glass',
        colors.glass,
      );
      if (detail === 3)
        wall(
          out,
          edge(u - 0.065 / length, 0.17),
          edge(u + 0.065 / length, 0.17),
          high - 3.3,
          high - 1.85,
          normal,
          'trim',
          colors.rib,
        );
    }
  }
  if (roof)
    lid(
      out,
      ring,
      ring.map(() => high),
      roof,
    );
}

function rect(x0, z0, x1, z1) {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

function volume(out, x0, z0, x1, z1, low, high, tint, roof = colors.roof) {
  shell(out, rect(x0, z0, x1, z1), low, high, tint, roof, 0);
}

function hall(out, section, detail) {
  const [x0, z0, x1, z1, base, eave, ridge, tint] = section;
  const ring = rect(x0, z0, x1, z1);
  const center = (x0 + x1) / 2;
  shell(out, ring, base, eave, tint, null, 0);
  for (const [z, side] of [
    [z0, -1],
    [z1, 1],
  ]) {
    face(
      out,
      'wall',
      [
        [x0, eave, z],
        [x1, eave, z],
        [center, eave + ridge, z],
      ],
      [0, 0, side],
      tint,
    );
  }
  for (const x of [x0, x1]) {
    face(
      out,
      'roof',
      [
        [x, eave, z0],
        [center, eave + ridge, z0],
        [center, eave + ridge, z1],
        [x, eave, z1],
      ],
      [0, 1, 0],
      colors.roof,
    );
    if (!detail) continue;
    const side = Math.sign(x - center);
    wall(
      out,
      [x + side * 0.17, z0],
      [x + side * 0.17, z1],
      eave - 0.45,
      eave + 0.03,
      [side, 0, 0],
      'trim',
      colors.rim,
    );
    if (detail < 2) continue;
    for (let z = z0 + 4; z < z1 - 4; z += detail === 2 ? 10 : 5.5) {
      wall(
        out,
        [x + side * 0.08, z - 0.1],
        [x + side * 0.08, z + 0.1],
        base + 0.2,
        eave - 0.52,
        [side, 0, 0],
        'trim',
        colors.rib,
      );
    }
  }
  if (!detail || z1 - z0 < 31) return;
  const run = (x1 - x0) * 0.14;
  const left = center - run;
  const right = center + run;
  for (let z = z0 + 10; z < z1 - 13; z += detail === 1 ? 31 : detail === 2 ? 22 : 14) {
    const skew = ridge * 0.28;
    face(
      out,
      'glass',
      [
        [left, eave + ridge - skew + 0.18, z],
        [center, eave + ridge + 0.35, z],
        [center, eave + ridge + 0.35, z + 4.1],
        [left, eave + ridge - skew + 0.18, z + 4.1],
      ],
      [0, 1, 0],
      colors.glass,
    );
    face(
      out,
      'glass',
      [
        [center, eave + ridge + 0.35, z],
        [right, eave + ridge - skew + 0.18, z],
        [right, eave + ridge - skew + 0.18, z + 4.1],
        [center, eave + ridge + 0.35, z + 4.1],
      ],
      [0, 1, 0],
      colors.bluegrey,
    );
  }
}

const halls = [
  [24, -243, 44, -131, 9.25, 13.5, 1.7, colors.pale],
  [57, -115, 105, -24, 9.25, 18.8, 2.95, colors.bright],
  [38, -17, 100, 79, 9.25, 17.9, 3.5, colors.pale],
  [-8, 79, 63, 174, 9.25, 16.2, 2.7, colors.bright],
  [-22, 185, 38, 238, 9.25, 13.6, 2.05, colors.siding],
  [-126, -119, -19, -100, 8.0, 14.1, 1.7, colors.siding],
  [-50, -96, -18, -30, 8.0, 12.6, 1.65, colors.bright],
  [-94, -8, -79, 70, 7.59, 11.85, 1.56, colors.pale],
];

function vessel(out, x, z, layers, sides) {
  const p = fromHall([x, 0, z]);
  profile(
    out,
    layers.map(([y, r, slot, tint]) => [y, r, r, slot, tint]),
    sides,
    [p[0], p[2]],
  );
}

function pipe(out, from, to, radius, tint, sides) {
  tube(out, 'trim', fromHall(from), fromHall(to), radius, tint, sides);
}

function equipment(out, detail) {
  const sides = [8, 14, 20, 28][detail];
  volume(out, 10, -18, 35, 23, 7.0, 20.4, colors.zinc, colors.dark);
  volume(out, 20, 5, 35, 24, 20.1, 24.25, colors.siding, colors.bluegrey);
  volume(out, -12, 7, 11, 27, 8.8, 14.6, colors.bright);
  volume(out, 111, -89, 139, -70, 9.15, 16.5, colors.siding);

  vessel(
    out,
    26.2,
    12.8,
    [
      [23.75, 3.3],
      [27.0, 3.2, 'concrete', colors.cement],
      [43.5, 2.5, 'concrete', colors.lower],
      [50.5, 2.17, 'trim', colors.rust],
      [51.8, 2.2, 'trim', colors.smoke],
      [51.8, 1.73, 'trim', colors.smoke],
      [49.7, 1.73, 'trim', colors.smoke],
    ],
    sides,
  );
  for (const [x, z, height, r] of [
    [53, 0, 31.4, 1.55],
    [81, 36, 29.4, 1.4],
    [67, -46, 27.7, 1.25],
  ]) {
    const start = z < 0 ? 17 : 18.5;
    vessel(
      out,
      x,
      z,
      [
        [start, r * 1.16],
        [height - 2.2, r, 'trim', colors.zinc],
        [height, r * 1.04, 'trim', colors.dark],
        [height, 0.79 * r, 'trim', colors.smoke],
        [height - 1.2, 0.79 * r, 'trim', colors.smoke],
      ],
      sides,
    );
  }
  for (const [x, z, r, y] of [
    [-105, -78, 7.1, 8.2],
    [-81, -70, 6.4, 10.0],
    [-80, -48, 5.9, 8.8],
  ]) {
    vessel(
      out,
      x,
      z,
      [
        [-4.0, r],
        [y - 0.8, r, 'concrete', colors.tank],
        [y, r * 0.89, 'roof', colors.rim],
        [y + 0.45, 0.19, 'roof', colors.rim],
      ],
      sides,
    );
  }
  if (!detail) return;
  volume(out, -63, -43, -49, -37, 7.3, 9.9, colors.zinc);
  volume(out, -66, -43, -62, 19, 8.45, 10.25, colors.zinc, colors.dark);
  for (const z of [-40, -20, 0, 18]) {
    volume(out, -66, z - 0.65, -63.1, z + 0.65, -4.0, 8.5, colors.cement);
  }
  pipe(out, [-81, 7.2, -65], [-75, 11.8, -45], 0.62, colors.zinc, sides);
  pipe(out, [-75, 11.8, -45], [-61, 11.8, -42], 0.62, colors.zinc, sides);
  pipe(out, [35, 18.1, 20], [48, 18.1, 20], 1.1, colors.zinc, sides);
  if (detail < 2) return;
  for (const [x, z, y] of [
    [71, -64, 21.0],
    [42, 113, 19.0],
    [90, 56, 20.5],
    [6, 199, 15.9],
  ]) {
    volume(out, x - 2.1, z - 3.1, x + 2.1, z + 3.1, y - 2.2, y, colors.zinc, colors.rim);
    vessel(
      out,
      x,
      z,
      [
        [y, 0.91],
        [y + 1.65, 0.82, 'trim', colors.dark],
        [y + 1.66, 0.13, 'trim', colors.smoke],
      ],
      sides,
    );
  }
  if (detail < 3) return;
  for (const [x0, x1, z] of [
    [-91, -65, -71],
    [-67, -51, -34],
    [-6, 32, -5],
  ]) {
    for (const offset of [0, 1.75]) {
      pipe(out, [x0, 10.9, z + offset], [x1, 10.9, z + offset], 0.3, colors.rib, 10);
    }
  }
  for (const height of [28.85, 39.7, 47.75]) {
    vessel(
      out,
      26.2,
      12.8,
      [
        [height, 3.5 - (height - 28.85) * 0.044],
        [height + 0.43, 3.5 - (height - 28.85) * 0.044, 'trim', colors.rim],
      ],
      sides,
    );
  }
}

function draw(out, detail) {
  const roofLevels = [
    plan.dimensions.baseMainRoofY,
    plan.dimensions.baseNorthwestRoofY,
    plan.dimensions.baseSouthwestRoofY,
  ];
  rings.forEach((ring, i) =>
    shell(
      out,
      ring,
      plan.dimensions.foundationsY,
      roofLevels[i],
      i === 0 ? colors.siding : colors.bright,
      colors.asphalt,
      detail,
    ),
  );
  for (const section of halls) hall(out, section, detail);
  equipment(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-538, 287, -330];
const lookAt = [-13, 11, -10];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Port Alberni waterfront paper mill with long stepped industrial sheds, a boiler stack, rooftop vents and separate processing blocks.',
  camera,
  lookAt,
  sunDirection: [-90, 130, -45],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['metal_standing_seam', 'concrete_plain'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -1.26,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'paper-mill-waterfront', position: [-326, 169, -213], lookAt: [-9, 8, -16] },
    { name: 'boiler-and-processing-yard', position: [-136, 25, -89], lookAt: [2, 15, -21] },
    { name: 'mill-roofs-and-stack', position: [211, 158, 177], lookAt: [17, 13, -6] },
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
    errorMeters: 4.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.32, surfaces },
      street: { export: 'street', errorMeters: 0.44, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry informed by Qualla’s exact public-domain EPA aerial, public records of the mill and current named building outlines, and original terrain.',
};
