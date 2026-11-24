import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/basilica-of-san-francisco-la-paz-shape-controls');
const church = outwardRing(shape.outline);
const tower = outwardRing(shape.bellTower);
const front = wallFace(...shape.mainFacade);
const levelOfEntry = 3.57;
const facadeZ = front.origin[1];
const stone = rgb('ab9881');
const warm = rgb('b8a58b');
const trim = rgb('c1b094');
const shade = rgb('4e4840');
const door = rgb('5b4a3c');
const tile = rgb('986851');
const domeTile = rgb('a17a64');
const base = rgb('968771');
const floor = rgb('b4a48a');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  dressed: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89 },
};

function cap(out, slot, polygon, y, color) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(polygon),
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('San Francisco stone roof could not be triangulated');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = [0, 1, 2].map((j) => {
      const k = indices[i + j] * 3;
      return [positions[k], positions[k + 1], positions[k + 2]];
    });
    tri(out, slot, ...vertices, color);
  }
}

function course(out, face, y, h, depth, left = 0, right = face.length, color = trim) {
  fbox(out, 'dressed', face, left, right, y, y + h, -0.05, depth, color);
}

function arch(out, face, x, y, width, height, level, options = {}) {
  const { depth = 0.09, entrance = false, framed = true, head = 'round' } = options;
  const slot = entrance ? 'timber' : 'shadow';
  const color = entrance ? door : shade;
  if (level < 2 || !framed) {
    const r = width / 2;
    const spring = y + height - (head === 'flat' ? 0 : r);
    const crown =
      head === 'flat'
        ? []
        : roundArch(r, level ? 6 : 4)
            .reverse()
            .slice(1, -1);
    fan(
      out,
      slot,
      [
        face.P(x - r, y, depth),
        face.P(x + r, y, depth),
        face.P(x + r, spring, depth),
        ...crown.map(([dx, dy]) => face.P(x + dx, spring + dy, depth)),
        face.P(x - r, spring, depth),
      ],
      color,
    );
    return;
  }
  opening(out, face, x, y, width, height, {
    head,
    d: depth,
    glassSlot: slot,
    glass: color,
    frameSlot: 'dressed',
    frame: trim,
    frameDepth: depth + 0.13,
    frameWidth: width * 0.105,
    sill: !entrance,
    mullions: entrance && level === 3 ? 1 : 0,
    mullionColor: base,
  });
}

function medallion(out, face, u, y, radius, depth, level, color = trim, inside = stone) {
  const n = level === 3 ? 14 : level === 2 ? 10 : 6;
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i * 2 * Math.PI) / n;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  for (let i = 0; i < n; i++) {
    const a = points[i],
      b = points[(i + 1) % n];
    const p = ([x, h], s, d) => face.P(u + x * s, y + h * s, depth + d);
    quad4(out, 'dressed', p(a, 1, 0.01), p(b, 1, 0.01), p(b, 0.76, 0.08), p(a, 0.76, 0.08), color);
    tri(out, 'shadow', face.P(u, y, depth + 0.03), p(a, 0.76, 0.03), p(b, 0.76, 0.03), inside);
  }
}

function pilaster(out, face, u, y, h, width, depth, level) {
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.57,
    u + width * 0.57,
    y,
    y + 0.53,
    depth - 0.18,
    depth + 0.31,
    trim,
  );
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.46,
    u + width * 0.46,
    y + 0.5,
    y + h - 0.56,
    depth - 0.16,
    depth + 0.12,
    warm,
  );
  fbox(
    out,
    'dressed',
    face,
    u - width * 0.68,
    u + width * 0.68,
    y + h - 0.61,
    y + h,
    depth - 0.18,
    depth + 0.34,
    trim,
  );
  if (level >= 2) {
    const [x, , z] = face.P(u, 0, depth + 0.11);
    const r = width * 0.37;
    lathe(
      out,
      'dressed',
      [x, z],
      [
        [y + 0.51, r * 0.93, r * 0.93],
        [y + 0.78, r, r],
        [y + h * 0.88, r * 0.83, r * 0.83],
        [y + h - 0.57, r, r],
      ],
      level === 3 ? 10 : 6,
      trim,
      { capTop: false },
    );
  }
}

function nave(out, level) {
  extrude(out, 'wall', church, -1.65, 15.78, stone, { top: false });
  cap(out, 'roof', church, 15.79, tile);
  abox(out, 'wall', [-6.09, 15.64, -33.01], [8.47, 20.2, 19.97], warm, { bottom: false });
  gableRoof(out, 'roof', [1.19, -33.03], [1.19, 19.95], 14.56, 20.22, 24.58, tile, {
    overhang: 0.26,
    endSlot: 'wall',
    endColor: stone,
  });
  gableRoof(out, 'roof', [4.7, -42.97], [4.7, -31.35], 14.29, 15.8, 19.31, tile, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: stone,
  });
  gableRoof(out, 'roof', [11.36, -22.54], [18.85, -22.54], 13.7, 15.75, 20.25, tile, {
    overhang: 0.22,
    endSlot: 'wall',
    endColor: stone,
  });
  const aisles = [
    [-7.77, 3.81, -30.96, 19.38],
    [9.79, 2.95, -14.91, 9.11],
  ];
  for (const [x, width, start, end] of aisles)
    gableRoof(out, 'roof', [x, start], [x, end], width, 15.76, 17.25, tile, {
      overhang: 0.17,
      endSlot: 'wall',
      endColor: stone,
    });
  const domeCenter = [1.8, -19.85];
  const dome = [
    [21.47, 6.22, 6.22],
    [22.1, 6.26, 6.26],
    [24.39, 5.9, 5.9],
    [26.66, 4.98, 4.98],
    [28.25, 3.44, 3.44],
    [29.11, 1.25, 1.25],
    [29.39, 0.45, 0.45],
  ];
  lathe(
    out,
    'roof',
    domeCenter,
    level === 0 ? dome.filter((_, i) => i % 2 === 0) : dome,
    level === 0 ? 8 : level === 1 ? 12 : level === 2 ? 16 : 20,
    domeTile,
    { capTop: true },
  );
  if (level >= 1) {
    lathe(
      out,
      'dressed',
      domeCenter,
      [
        [28.96, 0.92, 0.92],
        [29.35, 0.94, 0.94],
        [30.4, 0.7, 0.7],
        [30.88, 0.27, 0.27],
      ],
      level >= 2 ? 10 : 6,
      trim,
      { capTop: true },
    );
    const side = wallFace([-10.253, 20.1798], [-9.7233, -31.6008]);
    for (let i = 0; i < 6; i++) {
      const u = ((i + 0.54) * side.length) / 6;
      arch(out, side, u, 11.16, 1.02, 2.78, level, { depth: 0.055 });
      if (level >= 2) fbox(out, 'wall', side, u - 3.5, u - 2.51, 4.69, 15.51, 0.02, 0.77, warm);
    }
    const east = wallFace([11.12, 7.83], [11.36, -15.29]);
    for (const u of [3.9, 11.57, 19.23])
      arch(out, east, u, 11.65, 1.06, 2.29, level, { depth: 0.06 });
  }
}

function pediment(out, face, u, y, w, rise, level, color = trim) {
  const steps = level === 0 ? 4 : level === 1 ? 6 : 10;
  const outline = roundArch(w / 2, steps).map(([x, h]) => [u + x, y + (h * rise) / (w / 2)]);
  const d = 0.83;
  for (let j = 0; j < outline.length - 1; j++) {
    const [a, b] = [outline[j], outline[j + 1]];
    tri(out, 'dressed', face.P(u, y, d), face.P(...b, d), face.P(...a, d), color);
    quad4(
      out,
      'dressed',
      face.P(...a, 0.17),
      face.P(...b, 0.17),
      face.P(...b, d),
      face.P(...a, d),
      color,
    );
  }
}

function carvedFront(out, level) {
  const top = 22.53;
  const bellStart = 21.24;
  const u = 12.73;
  const leftBay = 4.12;
  const towerDoor = 26.33;
  fbox(out, 'wall', front, 0, bellStart, levelOfEntry - 0.14, top, -0.81, 0.22, warm);
  fbox(out, 'wall', front, bellStart, front.length, levelOfEntry - 0.19, top, -0.57, 0.35, stone);
  for (const [y, h, d] of [
    [4.05, 0.32, 0.49],
    [11.87, 0.37, 0.64],
    [12.31, 0.56, 0.83],
    [18.18, 0.39, 0.85],
    [18.67, 0.52, 1.02],
    [21.73, 0.38, 0.71],
    [22.23, 0.36, 0.98],
  ])
    course(out, front, y, h, d, -0.12, bellStart + 0.07);
  const central = wallFace(
    [front.origin[0], facadeZ + 0.24],
    [shape.mainFacade[1][0], facadeZ + 0.24],
  );
  for (const [x, w, h] of [
    [leftBay, 2.31, 4.98],
    [u, 4.24, 7.04],
    [towerDoor, 2.52, 5.34],
  ]) {
    arch(out, central, x, levelOfEntry, w, h, level, {
      entrance: true,
      depth: x === towerDoor ? 0.209 : 0.103,
    });
    const r = x === u ? 3.12 : 2.02;
    if (level >= 1) {
      for (const sign of [-1, 1]) {
        pilaster(
          out,
          central,
          x + sign * r,
          levelOfEntry + 0.38,
          x === u ? 8.2 : 7.32,
          x === u ? 0.84 : 0.65,
          0.18,
          level,
        );
        if (x === u)
          pilaster(
            out,
            central,
            x + sign * (r + 1.08),
            levelOfEntry + 0.52,
            7.6,
            0.75,
            0.13,
            level,
          );
      }
    }
    if (x === u || level >= 1) {
      pediment(
        out,
        central,
        x,
        x === u ? 22.17 : 11.45,
        x === u ? 7.33 : 3.79,
        x === u ? 3.58 : 1.62,
        level,
      );
      if (x !== u) course(out, central, 11.18, 0.29, 0.93, x - 2.12, x + 2.12);
    }
  }
  arch(out, central, u, 14.25, 3.42, 3.82, level, { head: 'flat', depth: 0.085 });
  if (level === 0) return;
  for (const [y, h, w, d] of [
    [12.85, 5.24, 0.73, 0.18],
    [19.44, 2.26, 0.62, 0.2],
  ]) {
    for (const offset of [-4.65, -2.68, 2.68, 4.65])
      pilaster(out, central, u + offset, y, h, w, d, level);
  }
  for (const [x, y, r] of [
    [leftBay, 16.39, 0.92],
    [u - 5.89, 15.66, 0.57],
    [u + 5.9, 15.66, 0.57],
    [u, 23.86, 0.73],
    [towerDoor, 17.0, 0.76],
  ]) {
    medallion(out, central, x, y, r, y > 22 ? 0.86 : 0.17, level, trim, base);
  }
  if (level < 2) return;
  for (const [x, y] of [
    [leftBay, 13.66],
    [u - 5.92, 13.0],
    [u + 5.9, 13.0],
    [towerDoor, 13.74],
  ]) {
    arch(out, central, x, y, 0.89, 1.86, level, { depth: 0.104 });
    course(out, central, y - 0.36, 0.26, 0.55, x - 0.84, x + 0.84);
  }
  const interval = level === 3 ? 0.68 : 1.36;
  for (let x = 0.74; x < 20.8; x += interval) {
    course(out, central, 17.91, 0.26, 0.37, x - 0.15, x + 0.15, warm);
    course(out, central, 21.93, 0.27, 0.58, x - 0.12, x + 0.12, warm);
  }
  for (const x of [u - 2.4, u + 2.4]) {
    const [cx, , cz] = central.P(x, 0, 0.44);
    lathe(
      out,
      'dressed',
      [cx, cz],
      [
        [22.63, 0.46, 0.46],
        [23.08, 0.34, 0.34],
        [23.37, 0.38, 0.38],
        [23.81, 0.12, 0.12],
      ],
      level === 3 ? 8 : 6,
      trim,
      { capTop: true },
    );
  }
}

function belfry(out, level) {
  const a = [10.93, 7.89],
    b = [20.86, 20.33];
  const cx = (a[0] + b[0]) / 2,
    cz = (a[1] + b[1]) / 2;
  extrude(out, 'wall', tower, 14.87, 23.8, warm, { top: false });
  const tiers = [
    [23.63, 31.49, 0.14],
    [31.39, 38.93, 0.53],
  ];
  for (const [bottom, top, inset] of tiers) {
    const ring = outwardRing([
      [a[0] + inset, a[1] + inset],
      [a[0] + inset, b[1] - inset],
      [b[0] - inset, b[1] - inset],
      [b[0] - inset, a[1] + inset],
    ]);
    extrude(out, 'wall', ring, bottom, top, warm, { top: false });
    cap(out, 'dressed', ring, top, trim);
    for (let i = 0; i < ring.length; i++) {
      const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
      course(out, f, top - 0.32, 0.48, 0.46, -0.19, f.length + 0.19);
      if (level >= 1) {
        course(out, f, bottom + 0.08, 0.37, 0.31, -0.07, f.length + 0.07, warm);
        for (const x of [f.length * 0.31, f.length * 0.69])
          arch(out, f, x, bottom + 0.83, f.length * 0.194, top - bottom - 2.45, level, {
            depth: 0.06,
          });
        if (level >= 2) {
          for (const x of [0.52, f.length - 0.53])
            pilaster(out, f, x, bottom + 0.52, top - bottom - 1.28, 0.55, 0.022, level);
          if (top > 35) medallion(out, f, f.length / 2, top - 1.31, 0.54, 0.13, level, trim, shade);
        }
      }
    }
  }
  const capRing = [
    [a[0] + 0.63, a[1] + 0.63],
    [a[0] + 0.63, b[1] - 0.63],
    [b[0] - 0.63, b[1] - 0.63],
    [b[0] - 0.63, a[1] + 0.63],
  ];
  const crown = [
    [38.94, 4.33, 5.51],
    [39.45, 4.3, 5.48],
    [41.47, 3.31, 4.14],
    [43.27, 1.88, 2.48],
    [44.31, 0.51, 0.73],
    [44.55, 0.12, 0.12],
  ];
  cap(out, 'dressed', capRing, 38.96, trim);
  lathe(
    out,
    'dressed',
    [cx, cz],
    crown,
    level === 0 ? 8 : level === 1 ? 12 : level === 2 ? 16 : 24,
    trim,
    { capTop: true },
  );
  if (level >= 1) {
    abox(out, 'dressed', [cx - 0.115, 44.52, cz - 0.11], [cx + 0.115, 46.16, cz + 0.11], base);
    abox(out, 'dressed', [cx - 0.57, 45.53, cz - 0.105], [cx + 0.57, 45.74, cz + 0.105], base);
  }
}

function atrium(out, level) {
  fbox(out, 'paving', front, -0.28, front.length + 0.17, -0.71, levelOfEntry, -0.43, 1.47, floor);
  const count = level === 0 ? 2 : 6;
  for (let i = 0; i < count; i++) {
    const v = i / count;
    const width = 15.44 + v * 6;
    const u = 14.28;
    fbox(
      out,
      'paving',
      front,
      u - width / 2,
      u + width / 2,
      -0.53,
      3.49 - v * 1.64,
      1.43 + i * 0.42,
      1.91 + i * 0.42,
      base,
    );
  }
}

function build(out, level) {
  atrium(out, level);
  nave(out, level);
  carvedFront(out, level);
  belfry(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'basilica-of-san-francisco-la-paz-model.mjs';
const camera = [81, 64, 105];
const lookAt = [5, 16, -5];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-basilica',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Andean Baroque stone church in La Paz with one belfry, a carved portal and a tiled crossing dome.',
  camera,
  lookAt,
  sunDirection: [-37, 58, 77],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: church,
    minimumCoverage: 0.9,
    basis:
      'The mapped present-day church and bell tower align with the northern edge of the atrium and Sagárnaga.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-portal-and-single-belfry', position: [6, 16, 62], lookAt: [7, 19, 18] },
    { name: 'stone-front-and-sagarnaga-side', position: [-43, 25, 56], lookAt: [4, 17, 2] },
    { name: 'roof-and-crossing-dome', position: [56, 81, -70], lookAt: [5, 16, -12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'basilica-of-san-francisco-la-paz-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.1, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
};
