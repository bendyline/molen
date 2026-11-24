import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const feature = (id) => frame.features.find((f) => f.id === 'way/' + id).points;

const limewash = rgb('d8d7ca');
const board = rgb('e0dfd3');
const woodJoint = rgb('bab9aa');
const granite = rgb('898572');
const crestStone = rgb('9d947d');
const grass = rgb('78875a');
const slate = rgb('666a69');
const copper = rgb('555c57');
const ceramic = rgb('a9654b');
const shutter = rgb('596056');
const dark = rgb('3b413a');
const reveal = rgb('b1aea1');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  timber: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.9 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94 },
};

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * h[j][i] + a * h[j][i + 1]) +
    b * ((1 - a) * h[j + 1][i] + a * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

const outerRampart = outwardRing([...feature(542765750), ...feature(87984263).slice(1, -1)]);
const gateIndex = outerRampart.findIndex(([x, z]) => x === 57.741 && z === -12.941);
const acrossGate = outerRampart[gateIndex];
const stepFromGate = ([x, z]) => {
  const [a, b] = acrossGate;
  const fraction = 2.0 / Math.hypot(x - a, z - b);
  return [a + (x - a) * fraction, b + (z - b) * fraction];
};
const wallLines = {
  outer: [
    stepFromGate(outerRampart[gateIndex + 1]),
    ...outerRampart.slice(gateIndex + 1),
    ...outerRampart.slice(0, gateIndex),
    stepFromGate(outerRampart[gateIndex - 1]),
  ],
  lowerNorth: feature(89642572),
  lowerSouth: feature(542765744),
  nearKeep: feature(89642570),
  nearGate: feature(89642571),
};

function direction(a, b) {
  const x = b[0] - a[0];
  const z = b[1] - a[1];
  const size = Math.hypot(x, z);
  return [-z / size, x / size];
}

function pointsAlong(line, spacing) {
  return line.flatMap((a, i) => {
    const b = line[i + 1];
    if (!b) return [a];
    const segments = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    return Array.from({ length: segments }, (_, j) => {
      const t = j / segments;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    });
  });
}

function crossSection(line, h, index, principal) {
  const p = line[index];
  const prev = line[index - 1] ?? p;
  const next = line[index + 1] ?? p;
  const left = prev === p ? direction(p, next) : direction(prev, p);
  const right = next === p ? left : direction(p, next);
  const norm = Math.hypot(left[0] + right[0], left[1] + right[1]) || 1;
  const dx = (left[0] + right[0]) / norm;
  const dz = (left[1] + right[1]) / norm;
  const miter = Math.min(2.05, 1 / Math.max(0.35, dx * left[0] + dz * left[1]));
  const at = (d) => [p[0] + d * dx * miter, p[1] + d * dz * miter];
  const low = ground(...at(1.15));
  const inGrade = ground(...at(-6));
  const outside = principal ? Math.min(4.1, Math.max(1.85, h + (inGrade - low) * 0.36)) : h;
  const top = Math.max(low + outside, ground(...p) + 0.53);
  return [
    [at(0.79)[0], low - 0.79, at(0.79)[1]],
    [p[0], top - 0.32, p[1]],
    [at(-0.18)[0], top - 0.11, at(-0.18)[1]],
    [at(-1.05)[0], top, at(-1.05)[1]],
    [at(-5.8)[0], inGrade - 0.07, at(-5.8)[1]],
  ];
}

function rampart(out, coordinates, height, level) {
  const line = pointsAlong(coordinates, [140, 10, 5.0, 3.26][level]);
  const isOuter = coordinates === wallLines.outer;
  const rows = line.map((_, i) => crossSection(line, height, i, isOuter));
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const strip = (slot, row, tone) => {
      tri(out, slot, a[row], b[row], b[row + 1], tone);
      tri(out, slot, a[row], b[row + 1], a[row + 1], tone);
    };
    strip('stone', 0, granite);
    strip('stone', 1, crestStone);
    strip('detail', 2, grass);
    strip('detail', 3, grass);
  }
  if (isOuter) {
    for (const end of [rows[0], rows.at(-1)]) {
      const [x, , z] = end[1];
      abox(
        out,
        'stone',
        [x - 0.31, end[0][1], z - 0.31],
        [x + 0.31, end[2][1], z + 0.31],
        crestStone,
      );
    }
  }
}

function footprintEdges(ring) {
  return ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
}

function axes(ring) {
  const f = footprintEdges(ring).reduce((a, b) => (a.length > b.length ? a : b));
  const project = (v, basis) => (v[0] - f.origin[0]) * basis[0] + (v[1] - f.origin[1]) * basis[1];
  const along = ring.map((p) => project(p, f.along));
  const across = ring.map((p) => project(p, f.normal));
  return {
    f,
    u0: Math.min(...along),
    u1: Math.max(...along),
    v0: Math.min(...across),
    v1: Math.max(...across),
  };
}

function pitchedRoof(out, ring, eaves, rise, color, slot, hipDepth) {
  const { f, u0, u1, v0, v1 } = axes(ring);
  const vm = (v0 + v1) / 2;
  if (hipDepth <= 0) {
    const ridgePoint = (u) => {
      const [x, , z] = f.P(u, 0, vm);
      return [x, z];
    };
    gableRoof(out, slot, ridgePoint(u0), ridgePoint(u1), v1 - v0, eaves, eaves + rise, color, {
      overhang: 0.36,
      endSlot: 'timber',
      endColor: board,
    });
    return;
  }
  const a = f.P(u0 - 0.22, eaves - 0.05, v1 + 0.2);
  const b = f.P(u1 + 0.22, eaves - 0.05, v1 + 0.2);
  const c = f.P(u1 + 0.22, eaves - 0.05, v0 - 0.2);
  const d = f.P(u0 - 0.22, eaves - 0.05, v0 - 0.2);
  const p = f.P(u0 + hipDepth, eaves + rise, vm);
  const q = f.P(u1 - hipDepth, eaves + rise, vm);
  quad4(out, slot, a, b, q, p, color);
  quad4(out, slot, c, d, p, q, color);
  tri(out, slot, d, a, p, color);
  tri(out, slot, b, c, q, color);
}

function aperture(out, f, u, y, width, height, level, door = false) {
  opening(out, f, u, y, width, height, {
    frameSlot: 'timber',
    glassSlot: 'detail',
    frame: board,
    glass: door ? shutter : dark,
    d: 0.045,
    frameWidth: level > 1 ? 0.095 : 0,
    frameDepth: 0.09,
    sill: !door && level > 1,
    mullions: !door && level > 1 ? 1 : 0,
    transoms: !door && level === 3 ? 2 : 0,
    mullionColor: board,
  });
}

function splayedOpening(out, f, u, y, height, level, margin = 0.66) {
  const left = u - margin;
  const right = u + margin;
  const a = f.P(left, y);
  const b = f.P(right, y);
  const c = f.P(right, y + height);
  const d = f.P(left, y + height);
  const p = f.P(u - margin * 0.66, y + 0.08, -0.59);
  const q = f.P(u + margin * 0.66, y + 0.08, -0.59);
  const r = f.P(u + margin * 0.66, y + height - 0.09, -0.59);
  const s = f.P(u - margin * 0.66, y + height - 0.09, -0.59);
  quad4(out, 'detail', p, q, r, s, dark);
  quad4(out, 'plaster', a, b, q, p, reveal);
  quad4(out, 'plaster', c, d, s, r, reveal);
  quad4(out, 'plaster', d, a, p, s, reveal);
  quad4(out, 'plaster', b, c, r, q, reveal);
  if (level === 3)
    fbox(
      out,
      'detail',
      f,
      u - 0.034,
      u + 0.034,
      y + 0.1,
      y + height - 0.1,
      -0.59,
      -0.54,
      woodJoint,
    );
}

function towerFront(out, f, floor, eaves, level) {
  const groups = [floor + 2.95, floor + 6.99, floor + 10.98];
  const west = f.normal[0] < -0.8;
  if (level > 1) {
    const P = (u0, u1, y0, y1) =>
      quad4(out, 'plaster', f.P(u0, y0), f.P(u1, y0), f.P(u1, y1), f.P(u0, y1), limewash);
    let bottom = floor;
    for (const y of groups) {
      P(0, f.length, bottom, y);
      let last = 0;
      for (const u of [f.length * 0.32, f.length * 0.68]) {
        P(last, u - 0.66, y, y + 1.23);
        splayedOpening(out, f, u, y, 1.23, level);
        last = u + 0.66;
      }
      P(last, f.length, y, y + 1.23);
      bottom = y + 1.23;
    }
    P(0, f.length, bottom, eaves);
  } else {
    quad4(
      out,
      'plaster',
      f.P(0, floor),
      f.P(f.length, floor),
      f.P(f.length, eaves),
      f.P(0, eaves),
      limewash,
    );
    if (level)
      for (const y of groups)
        for (const u of [f.length * 0.32, f.length * 0.68])
          aperture(out, f, u, y, 0.9, 1.19, level);
  }
  if (west && level > 0) {
    const m = f.length * 0.54;
    opening(out, f, m, floor + 0.42, 1.47, 2.2, {
      head: 'tudor',
      frameSlot: 'stone',
      glassSlot: 'detail',
      frame: crestStone,
      glass: shutter,
      d: 0.038,
      sill: false,
      frameWidth: 0.14,
      frameDepth: 0.2,
    });
    for (let i = 0; i < 4; i++)
      fbox(
        out,
        'stone',
        f,
        m - 1.22,
        m + 1.22,
        floor - 0.72,
        floor + 0.12 * i,
        0.04,
        2.04 - i * 0.45,
        crestStone,
      );
  }
}

function donjon(out, level) {
  // The fifth survey point subdivides the straight north face.
  const ring = outwardRing(feature(17693566).slice(0, 4));
  const floor = Math.max(...ring.map(([x, z]) => ground(x, z))) + 0.19;
  const eaves = floor + 14.3;
  const height = plan.dimensions.donjonMappedHeightM - 14.3;
  extrude(out, 'stone', ring, -2.6, floor, granite, { top: false });
  for (const f of footprintEdges(ring)) {
    towerFront(out, f, floor, eaves, level);
    if (level > 0)
      fbox(out, 'plaster', f, 0, f.length, eaves - 0.25, eaves + 0.035, -0.14, 0.14, limewash);
  }
  pitchedRoof(out, ring, eaves, height, slate, 'slate', 6.37);
  if (level > 1) {
    const y = eaves + height;
    abox(out, 'detail', [-0.9, y - 0.5, 0.69], [-0.84, y + 1.42, 0.75], copper);
  }
}

const rooms = [
  { id: 89642573, kind: 'residence', eaves: 3.41, rise: 3.4, hip: 1.51 },
  { id: 474662465, kind: 'washhouse', eaves: 2.63, rise: 1.79, hip: 1.71 },
  { id: 95714848, kind: 'magazine', eaves: 4.11, rise: 2.24, hip: 0 },
  { id: 133262099, kind: 'shed', eaves: 2.35, rise: 1.4, hip: 0 },
];

function supportBuilding(out, room, level) {
  const ring = outwardRing(feature(room.id));
  const corners = ring.map(([x, z]) => ground(x, z));
  const foundation = Math.min(...corners) - 0.62;
  const floor = Math.max(...corners) + 0.28;
  const eave = floor + room.eaves;
  const tiled = room.kind === 'residence' || room.kind === 'washhouse';
  const clad = room.kind !== 'magazine';
  const wallSlot = clad ? 'timber' : 'plaster';
  extrude(out, 'stone', ring, foundation, floor, granite, { top: false });
  extrude(out, wallSlot, ring, floor, eave, clad ? board : limewash, { top: false });
  pitchedRoof(
    out,
    ring,
    eave,
    room.rise,
    tiled ? ceramic : slate,
    tiled ? 'clay' : 'slate',
    room.hip,
  );
  if (!level) return;
  for (const f of footprintEdges(ring)) {
    if (f.length < 3.28) continue;
    fbox(out, 'timber', f, 0, f.length, eave - 0.21, eave + 0.06, -0.14, 0.17, board);
    const count = Math.max(1, Math.round(f.length / (clad ? 2.95 : 3.78)));
    for (let i = 0; i < count; i++) {
      const u = (f.length * (i + 0.5)) / count;
      const front =
        (room.kind === 'magazine' && f.length > 25 && f.normal[0] < 0) ||
        (room.kind === 'residence' && f.normal[1] > 0.74);
      const door = front && (i === 0 || (room.kind === 'magazine' && i === Math.floor(count / 2)));
      if (door) aperture(out, f, u, floor + 0.02, clad ? 1.14 : 2.29, 2.62, level, true);
      else
        aperture(
          out,
          f,
          u,
          floor + (clad ? 0.89 : 1.47),
          clad ? 0.89 : 1.19,
          clad ? 1.35 : 0.73,
          level,
        );
    }
  }
  if (level > 1 && tiled) {
    const { f, u0, u1, v0, v1 } = axes(ring);
    const [x, , z] = f.P(u0 + (u1 - u0) * 0.38, 0, (v0 + v1) / 2);
    const y = eave + room.rise;
    abox(out, 'plaster', [x - 0.33, y - 1.32, z - 0.38], [x + 0.33, y + 0.88, z + 0.38], limewash);
    abox(out, 'stone', [x - 0.4, y + 0.81, z - 0.44], [x + 0.4, y + 0.97, z + 0.44], crestStone);
  }
}

function build(out, level) {
  rampart(out, wallLines.outer, 3.25, level);
  rampart(out, wallLines.lowerNorth, 1.8, level);
  rampart(out, wallLines.lowerSouth, 2.2, level);
  if (level > 0) {
    rampart(out, wallLines.nearKeep, 0.91, level);
    rampart(out, wallLines.nearGate, 0.77, level);
  }
  donjon(out, level);
  for (const room of rooms) supportBuilding(out, room, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kristiansten-fortress-model.mjs';
const camera = [-178, 79, 113];
const lookAt = [31, 2.7, 7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Kristiansten Fortress',
  wikidataId: plan.wikidataId,
  category: 'fortress',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Trondheim’s limewashed Kristiansten Donjon above angular stone ramparts, with slate roofs, grassed crests, the red-roofed Commandant’s Residence and the long white magazine.',
  camera,
  lookAt,
  sunDirection: [-58, 55, 42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: feature(17693566),
    minimumCoverage: 0.88,
    basis: 'Mapped masonry outline of the Donjon at the centre of the fortress.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_drywall',
    'wood_painted_lap',
    'slate',
    'tile_ceramic',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'white-donjon-and-grassed-ramparts', position: [-77, 6.25, 39], lookAt: [5, 7.5, 0] },
    { name: 'residence-and-north-earthworks', position: [61, 18, -109], lookAt: [17, 7, -27] },
    { name: 'magazine-and-outer-walls', position: [169, 17, 114], lookAt: [64, 2, 41] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kristiansten-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.49, surfaces },
      street: { export: 'street', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.08, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
