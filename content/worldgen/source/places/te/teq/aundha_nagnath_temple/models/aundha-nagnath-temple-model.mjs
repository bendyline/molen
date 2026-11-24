import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  roundArch,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const geometry = read('native-map/aundha-nagnath-temple-shape-controls');
const outline = outwardRing(geometry.outline);
const floor = plan.dimensions.plinthHeightM;
const capHeight = 7.43;
const color = Object.fromEntries(
  Object.entries({
    base: '655b51',
    basalt: '70675d',
    band: '817569',
    carving: '8e8171',
    shade: '4d443d',
    paved: '827062',
    seam: '514a40',
    dark: '26201b',
    plaster: 'dbd0b9',
    ridge: 'c9bda4',
    muted: 'c1b39c',
    finial: '9e7b4c',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.96 },
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.94 },
  carving: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  plaster: { slot: 'roof', graph: 'plaster_lime', roughness: 0.92 },
  opening: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.89 },
};

function scaled(ring, center, sx, sz = sx) {
  return ring.map(([x, z]) => [center[0] + sx * (x - center[0]), center[1] + sz * (z - center[1])]);
}

function connect(out, slot, ring, low, inner, high, tint) {
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i],
      b = ring[j],
      c = inner[j],
      d = inner[i];
    quad4(
      out,
      slot,
      [a[0], low, a[1]],
      [b[0], low, b[1]],
      [c[0], high, c[1]],
      [d[0], high, d[1]],
      tint,
    );
  }
}

function cap(out, slot, ring, y, tint) {
  const buffer = new MeshBufferBuilder();
  if (
    !buffer.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(ring),
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Aundha Nagnath stone contour could not be triangulated');
  const { positions, indices } = buffer.finalize();
  const point = (index) => Array.from(positions.slice(3 * index, 3 * index + 3));
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), tint);
}

function course(out, slot, ring, origin, profile, tint) {
  let previous = scaled(ring, origin, profile[0][1]);
  for (let i = 1; i < profile.length; i++) {
    const next = scaled(ring, origin, profile[i][1]);
    connect(out, slot, previous, profile[i - 1][0], next, profile[i][0], tint);
    previous = next;
  }
  cap(out, slot, previous, profile.at(-1)[0], tint);
}

const porches = [
  { edge: [-0.08, 18.64], along: [1, -0.088], width: 4.94, grade: 0.03, depth: 7.9 },
  { edge: [17.91, 0.07], along: [-0.103, -1], width: 4.22, grade: -0.12, depth: 7.9 },
  { edge: [-17.04, 0.3], along: [-0.128, 1], width: 4.52, grade: -0.37, depth: 7.1 },
];

function platform(out, level) {
  const ring = level ? outline : outline.filter((_, index) => index % 3 === 0);
  const profile = [
    [-0.8, 1.034],
    [0.14, 1.034],
    [0.29, 1.024],
    [0.44, 1.022],
    [0.65, 1.014],
    [0.91, 1.01],
    [1.16, 1.001],
    [1.44, 0.999],
    [floor, 0.992],
  ];
  course(
    out,
    'base',
    ring,
    [0, 0],
    level >= 2 ? profile : profile.filter((_, index) => index % 2 === 0),
    color.base,
  );
  for (const { edge, along, width, grade } of porches) {
    const face = facade(edge, along);
    const steps = level ? 7 : 2;
    for (let i = 0; i < steps; i++) {
      const base = (i * 2.1) / steps;
      fbox(
        out,
        'base',
        face,
        -width * 0.441,
        width * 0.441,
        grade - 0.18,
        floor - (i * (floor - grade)) / steps,
        base - 0.15,
        base + 2.1 / steps + 0.01,
        color.paved,
      );
    }
  }
  if (level < 2) return;
  for (let i = 0; i < ring.length; i++) {
    const stripe = wallFace(...scaled([ring[i], ring[(i + 1) % ring.length]], [0, 0], 1.009));
    const striations = [
      [0.48, 0.11],
      [0.82, 0.17],
      [1.35, 0.12],
      [1.55, 0.08],
    ];
    const selected = level === 2 ? striations.filter((_, i) => i % 2 === 0) : striations;
    for (const [height, projection] of selected)
      fbox(
        out,
        'stone',
        stripe,
        0,
        stripe.length,
        height,
        height + 0.076,
        -0.28,
        projection,
        color.band,
      );
  }
}

function relief(out, face, u, y, w, h, depth, lintel) {
  const point = (x, dy, d = depth) => face.P(u + x * w, y + dy * h, d);
  quad4(
    out,
    'stone',
    point(-0.49, 0),
    point(0.49, 0),
    point(0.49, 1),
    point(-0.49, 1),
    color.shade,
  );
  const bottom = point(0, 0.1, depth + 0.14);
  const breast = point(0, 0.56, depth + 0.24);
  tri(out, 'carving', point(-0.35, 0.12), bottom, breast, color.band);
  tri(out, 'carving', bottom, point(0.35, 0.12), breast, color.carving);
  tri(out, 'carving', point(-0.37, 0.43), breast, point(-0.15, 0.71), color.carving);
  tri(out, 'carving', breast, point(0.37, 0.43), point(0.15, 0.71), color.band);
  quad4(
    out,
    'carving',
    point(-0.2, 0.71, depth + 0.15),
    point(0.2, 0.71, depth + 0.15),
    point(0.17, 0.89, depth + 0.19),
    point(-0.17, 0.89, depth + 0.19),
    color.carving,
  );
  if (lintel) {
    tri(
      out,
      'carving',
      point(-0.47, 0.9),
      point(0, 0.94, depth + 0.2),
      point(0, 1.08, depth + 0.12),
      color.band,
    );
    tri(
      out,
      'carving',
      point(0, 0.94, depth + 0.2),
      point(0.47, 0.9),
      point(0, 1.08, depth + 0.12),
      color.carving,
    );
  }
}

function animalCourse(out, face, y, flip, detail) {
  const bays = Math.max(1, Math.round(face.length / 0.56));
  for (let bay = 0; bay < bays; bay++) {
    const width = face.length / bays;
    const u = (bay + 0.5) * width;
    const d = 0.168;
    const p = (x, h, offset = d) => face.P(u + width * (flip ? -x : x), y + h, offset);
    const plate = (slot, points, tint) =>
      quad4(out, slot, ...(flip ? points.reverse() : points), tint);
    plate(
      'carving',
      [p(-0.27, 0.02), p(0.2, 0.02), p(0.25, 0.2, d + 0.06), p(-0.32, 0.16, d + 0.04)],
      color.carving,
    );
    if (detail) {
      plate(
        'carving',
        [p(0.15, 0.05), p(0.3, 0.0), p(0.43, 0.06), p(0.27, 0.17, d + 0.04)],
        color.band,
      );
      for (const x of [-0.2, 0.12])
        plate(
          'carving',
          [p(x - 0.055, -0.065), p(x + 0.055, -0.068), p(x + 0.05, 0.034), p(x - 0.05, 0.034)],
          color.band,
        );
    }
  }
}

function carvedWalls(out, points, level) {
  const ring = outwardRing(points);
  const skin = level >= 2 ? ring : ring.filter((_, index) => index % (level ? 2 : 3) === 0);
  extrude(out, 'stone', skin, floor - 0.03, capHeight - 0.38, color.basalt, { top: false });
  if (!level) return;
  for (let i = 0; i < skin.length; i++) {
    const face = wallFace(skin[i], skin[(i + 1) % skin.length]);
    for (const [y, height, d] of [
      [1.81, 0.16, 0.29],
      [2.19, 0.14, 0.17],
      [2.55, 0.14, 0.23],
      [3.08, 0.16, 0.29],
      [4.62, 0.23, 0.33],
      [5.34, 0.15, 0.19],
      [6.51, 0.14, 0.23],
      [6.79, 0.24, 0.32],
    ]) {
      if (level === 1 && y !== 3.08 && y !== 6.79) continue;
      if (level === 2 && y !== 2.19 && y !== 3.08 && y !== 4.62 && y !== 6.79) continue;
      fbox(out, 'carving', face, 0, face.length, y, y + height, -0.15, d, color.band);
    }
    if (level < 2 || face.length < 0.54) continue;
    for (const [y, h, spacing] of [
      [3.31, 1.13, 0.85],
      [5.46, 0.92, 0.67],
    ]) {
      const bays = Math.max(1, Math.floor(face.length / (spacing * (level === 2 ? 1.55 : 1))));
      const step = face.length / bays;
      for (let n = 0; n < bays; n++) {
        const u = (n + 0.5) * step;
        relief(out, face, u, y, Math.min(step * 0.86, 1.1), h, 0.035, level === 3);
        if (level === 3)
          fbox(
            out,
            'stone',
            face,
            u - step * 0.45,
            u - step * 0.4,
            y,
            y + h,
            0.005,
            0.19,
            color.band,
          );
      }
    }
    animalCourse(out, face, 2.81, i % 2 === 0, level === 3);
    if (level === 3) animalCourse(out, face, 2.42, i % 2 !== 0, false);
  }
}

function porch(out, data, level) {
  const { edge, along, width, depth } = data;
  const front = facade(edge, along);
  const b = width / 2;
  const solidAt = (u, d) => {
    const [x, , z] = front.P(u, 0, d);
    return [x, z];
  };
  const gate = facade(solidAt(0, -depth + 0.15), along);
  opening(out, gate, 0, floor + 0.01, Math.min(1.75, width - 1.4), 3.65, {
    glassSlot: 'opening',
    glass: color.dark,
    frameSlot: 'carving',
    frame: color.carving,
    frameWidth: level >= 2 ? 0.29 : 0,
    frameDepth: 0.21,
    sill: false,
    d: 0.03,
  });
  if (level)
    fbox(out, 'stone', front, -b - 0.28, b + 0.28, 6.52, 6.82, -depth - 0.23, 0.43, color.basalt);
  fbox(
    out,
    'carving',
    front,
    -b - 0.44,
    b + 0.44,
    level ? 6.82 : 6.52,
    level ? 7.06 : 7.28,
    -depth - 0.31,
    0.63,
    color.band,
  );
  if (level)
    fbox(out, 'stone', front, -b - 0.3, b + 0.3, 7.06, 7.28, -depth - 0.21, 0.51, color.basalt);
  const stations = level >= 2 ? [-0.66, -3.02, -5.48] : level ? [-0.66, -depth * 0.64] : [-0.66];
  for (const d of stations)
    for (const s of [-1, 1]) {
      const u = s * (b - 0.57);
      fbox(
        out,
        'base',
        front,
        u - 0.48,
        u + 0.48,
        floor,
        floor + 0.24,
        d - 0.52,
        d + 0.52,
        color.base,
      );
      const center = solidAt(u, d);
      const profile = [
        [floor + 0.23, 0.44],
        [floor + 0.46, 0.42],
        [floor + 0.61, 0.35],
        [4.82, 0.31],
        [4.97, 0.49],
        [5.11, 0.43],
        [5.26, 0.51],
        [5.45, 0.51],
        [5.57, 0.43],
        [5.82, 0.39],
        [6.11, 0.52],
        [6.23, 0.46],
        [6.52, 0.54],
      ];
      const points =
        level < 2
          ? profile.filter((_, i) => (level ? [0, 2, 3, 7, 12] : [0, 3, 12]).includes(i))
          : profile;
      lathe(
        out,
        'stone',
        center,
        points.map(([y, r]) => [y, r, r]),
        level >= 2 ? 8 : 4,
        color.basalt,
        { capTop: false },
      );
      if (level === 3) {
        fbox(out, 'carving', front, u - 0.47, u + 0.47, 5.96, 6.49, d - 0.76, d + 0.76, color.band);
        for (const [du, h] of [
          [-0.31, 3.18],
          [0.31, 3.73],
        ])
          relief(
            out,
            facade(solidAt(0, d + 0.245), along),
            u + du * 0.55,
            h,
            0.22,
            0.58,
            0.045,
            false,
          );
      }
    }
}

const shoulder = outwardRing([
  [-1, -0.38],
  [-0.77, -0.38],
  [-0.77, -0.74],
  [-0.43, -0.74],
  [-0.43, -1],
  [0.43, -1],
  [0.43, -0.74],
  [0.77, -0.74],
  [0.77, -0.38],
  [1, -0.38],
  [1, 0.38],
  [0.77, 0.38],
  [0.77, 0.74],
  [0.43, 0.74],
  [0.43, 1],
  [-0.43, 1],
  [-0.43, 0.74],
  [-0.77, 0.74],
  [-0.77, 0.38],
  [-1, 0.38],
]);
const compact = outwardRing([
  [-1, -0.46],
  [-0.58, -0.46],
  [-0.58, -1],
  [0.58, -1],
  [0.58, -0.46],
  [1, -0.46],
  [1, 0.46],
  [0.58, 0.46],
  [0.58, 1],
  [-0.58, 1],
  [-0.58, 0.46],
  [-1, 0.46],
]);

function spire(out, center, radius, aspect, base, tip, level) {
  const plan = level >= 2 ? shoulder : compact;
  const count = level ? 10 : 3;
  const span = tip - base;
  const crown = tip - span * 0.103;
  const ring = (scale) =>
    plan.map(([x, z]) => [center[0] + x * radius * scale, center[1] + z * radius * aspect * scale]);
  const taper = (progress) => 0.14 + 0.86 * Math.pow(1 - progress, 0.77);
  let last = ring(1);
  for (let i = 0; i < count; i++) {
    const y = base + ((crown - base) * i) / count;
    const nextY = base + ((crown - base) * (i + 1)) / count;
    const scale = taper(i / count);
    const lip = level ? ring(scale + 0.025) : last;
    const rise = level ? (nextY - y) * 0.24 : 0;
    if (level) connect(out, 'plaster', last, y, lip, y + rise, color.ridge);
    const next = ring(taper((i + 1) / count));
    connect(out, 'plaster', lip, y + rise, next, nextY, i % 3 ? color.plaster : color.muted);
    if (level >= 2 && i < count - 2 && (level === 3 || i % 3 === 0)) {
      const y1 = y + (nextY - y) * 0.46;
      for (let j = 0; j < lip.length; j++) {
        const face = wallFace(lip[j], lip[(j + 1) % lip.length]);
        if (face.length < 0.67) continue;
        const detail = level === 3 ? (i % 2 === 1 ? 3 : 2) : 1;
        for (let n = 0; n < detail; n++) {
          const u = ((n + 0.5) * face.length) / detail;
          const w = Math.min((face.length / detail) * 0.46, 0.31);
          fbox(
            out,
            'plaster',
            face,
            u - w / 2,
            u + w / 2,
            y1,
            y1 + rise * 1.18,
            -0.32,
            -0.058,
            color.ridge,
          );
        }
      }
    }
    last = next;
  }
  cap(out, 'plaster', last, crown, color.plaster);
  const r = radius * 0.16;
  lathe(
    out,
    'plaster',
    center,
    [
      [crown, r, r],
      [crown + span * 0.025, r * 1.13, r * 1.13],
      [crown + span * 0.066, r * 0.58, r * 0.58],
    ],
    level >= 2 ? 8 : 4,
    color.ridge,
    { capTop: false },
  );
  lathe(
    out,
    'metal',
    center,
    [
      [crown + span * 0.066, r * 0.58, r * 0.58],
      [tip - 0.22, r * 0.25, r * 0.25],
      [tip, 0, 0],
    ],
    level >= 2 ? 8 : 4,
    color.finial,
    { capTop: false },
  );
}

function roofDeck(out, points, center, level) {
  const ring = outwardRing(points);
  const eaves = level >= 2 ? ring : ring.filter((_, index) => index % (level ? 2 : 3) === 0);
  course(
    out,
    'stone',
    eaves,
    center,
    level
      ? [
          [6.98, 1],
          [7.18, 1.036],
          [capHeight, 1.045],
          [7.66, 0.93],
        ]
      : [
          [6.98, 1.025],
          [7.66, 0.96],
        ],
    color.basalt,
  );
}

function pavilion(out, level) {
  const center = geometry.pavilionCenter;
  const base = 1.18;
  const top = 5.77;
  const outline = scaled(compact, [0, 0], 3.06).map(([x, z]) => [x + center[0], z + center[1]]);
  course(
    out,
    'base',
    outline,
    center,
    [
      [-0.03, 1],
      [0.48, 1],
      [0.65, 0.962],
      [1.01, 0.91],
      [base, 0.89],
    ],
    color.paved,
  );
  for (const x of [-1.67, 1.67])
    for (const z of [-1.67, 1.67])
      abox(
        out,
        'plaster',
        [center[0] + x - 0.43, base, center[1] + z - 0.43],
        [center[0] + x + 0.43, top, center[1] + z + 0.43],
        color.muted,
      );
  for (const [x, z, du, dz] of [
    [0, 2.08, 1, 0],
    [2.08, 0, 0, -1],
    [0, -2.08, -1, 0],
    [-2.08, 0, 0, 1],
  ]) {
    const face = facade([center[0] + x, center[1] + z], [du, dz]);
    const spring = 3.93;
    const arch = roundArch(1.27, level >= 2 ? 8 : 4);
    for (let i = 0; i < arch.length - 1; i++) {
      const [a, h] = arch[i],
        [b, j] = arch[i + 1];
      quad4(
        out,
        'plaster',
        face.P(a, spring + h),
        face.P(b, spring + j),
        face.P(b, top),
        face.P(a, top),
        color.muted,
      );
      if (level)
        quad4(
          out,
          'plaster',
          face.P(b, spring + j, -0.48),
          face.P(a, spring + h, -0.48),
          face.P(a, top, -0.48),
          face.P(b, top, -0.48),
          color.ridge,
        );
      quad4(
        out,
        'plaster',
        face.P(a, spring + h, -0.48),
        face.P(b, spring + j, -0.48),
        face.P(b, spring + j, 0),
        face.P(a, spring + h, 0),
        color.ridge,
      );
    }
  }
  abox(
    out,
    'plaster',
    [center[0] - 2.34, top, center[1] - 2.34],
    [center[0] + 2.34, top + 0.32, center[1] + 2.34],
    color.plaster,
  );
  const roof = outwardRing([
    [-2.44, -2.44],
    [2.44, -2.44],
    [2.44, 2.44],
    [-2.44, 2.44],
  ]).map(([x, z]) => [x + center[0], z + center[1]]);
  course(
    out,
    'plaster',
    roof,
    center,
    [
      [top + 0.32, 1],
      [top + 1.29, 0.72],
      [top + 1.29, 0.63],
      [top + 1.9, 0.38],
      [top + 1.9, 0.31],
      [top + 2.44, 0.05],
    ],
    color.ridge,
  );
  if (level >= 2)
    for (let i = 0; i < 5; i++)
      abox(
        out,
        'base',
        [-0.96, 0.15, center[1] + 2.28 + i * 0.28],
        [0.96, base - i * 0.18, center[1] + 2.58 + i * 0.28],
        color.base,
      );
}

function build(out, level) {
  platform(out, level);
  for (const [footprint, center] of [
    [geometry.shrine, geometry.shikharaCenter],
    [geometry.mandapa, geometry.mainHallCenter],
  ]) {
    carvedWalls(out, footprint, level);
    roofDeck(out, footprint, center, level);
  }
  for (const data of porches) porch(out, data, level);
  spire(out, geometry.shikharaCenter, 5.92, 0.88, 7.59, plan.dimensions.standingHeightM, level);
  spire(out, geometry.mainHallCenter, 4.73, 1.03, 7.59, 13.47, level);
  pavilion(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'aundha-nagnath-temple-model.mjs';
const camera = [43, 34, 58];
const lookAt = [0, 6.7, 2.8];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Aundha Nagnath Temple’s incised dark basalt plinth, three pillared porches, two pale stepped shikharas and detached west pavilion.',
  camera,
  lookAt,
  sunDirection: [38, 61, 46],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis:
      'The measured Archaeological Department site plan controls the shrine, hall and three projecting porticoes.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-porch-and-pavilion', position: [20, 11, 44], lookAt: [0, 5, 12] },
    { name: 'basalt-courses-and-shikharas', position: [35, 12, -12], lookAt: [0, 6, -5] },
    { name: 'south-carved-plinth', position: [-23, 6, -16], lookAt: [-5, 4, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'aundha-nagnath-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.69,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.113, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.046, surfaces },
    },
  },
};
