/** Tartu's canted Leaning House exterior, grounded in its documented settlement. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const outline = read('map-frame.json').geometry.outline;
const { groundY, plinthTop, firstCorniceY, eavesY, ridgeY, leanDegrees, leanDirection } =
  plan.dimensions;
const shear = Math.tan((leanDegrees * Math.PI) / 180);
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    warmPlaster: 'd8cbb5',
    shadedPlaster: 'cdbfa7',
    rusticated: 'b6aa95',
    limestone: 'c6bca9',
    trim: 'e2dbcd',
    stone: '999184',
    sill: 'c5b9a4',
    roof: '82878b',
    roofShadow: '747c80',
    iron: '54575a',
    wood: '655348',
    glass: '667277',
    recess: '62605a',
    paleSash: 'd8d2c2',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76, metallic: 0.12 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.56, metallic: 0.03 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.84, metallic: 0 },
};

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function sampleGround(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const lo = terrain.heightsMeters[j];
  const hi = terrain.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - a) + lo[i + 1] * a) * (1 - b) +
    (hi[i] * (1 - a) + hi[i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function settled([x, z], y) {
  const drift = shear * Math.max(0, y - groundY);
  const spread = Math.max(-5, Math.min(5, x * leanDirection[0] + z * leanDirection[1]));
  const drop = Math.max(0, Math.min(1, (y - groundY) / 3)) * spread * 0.021;
  return [x + leanDirection[0] * drift, y - drop, z + leanDirection[1] * drift];
}

function face(out, slot, points, target, color, uv = ([x, y, z]) => [x - z, y]) {
  const n = normalFor(...points);
  const flip = n.reduce((sum, value, i) => sum + value * target[i], 0) < 0;
  out.addConvexPolygon(slot, pal, points, flip ? n.map((v) => -v) : n, uv, color);
}

function wallEdge(index) {
  const a = outline[index];
  const b = outline[(index + 1) % outline.length];
  const length = distance(a, b);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  return {
    a,
    b,
    length,
    outward: [dz, 0, -dx],
    tangent: [dx, 0, dz],
    point: (u, y, depth = 0) => {
      const [x, z] = mix(a, b, u / length);
      return settled([x + dz * depth, z - dx * depth], y);
    },
  };
}

function panel(out, edge, slot, start, end, low, high, depth, color) {
  if (end - start < 0.001 || high - low < 0.001) return;
  const p = edge.point;
  face(
    out,
    slot,
    [p(start, low, depth), p(end, low, depth), p(end, high, depth), p(start, high, depth)],
    edge.outward,
    color,
    ([x, y, z]) => [edge.tangent[0] * x + edge.tangent[2] * z, y],
  );
}

function ledge(out, edge, slot, start, end, low, high, from, to, color) {
  const p = edge.point;
  panel(out, edge, slot, start, end, low, high, to, color);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, up],
  ])
    face(out, slot, [p(start, y, from), p(end, y, from), p(end, y, to), p(start, y, to)], n, color);
  for (const [u, sign] of [
    [start, -1],
    [end, 1],
  ])
    face(
      out,
      slot,
      [p(u, low, from), p(u, high, from), p(u, high, to), p(u, low, to)],
      edge.tangent.map((v) => v * sign),
      color,
    );
}

function recess(out, edge, { u, width, low, high, door }, lod) {
  const a = u - width / 2;
  const b = u + width / 2;
  const inset = lod === 0 ? 0 : -0.14;
  panel(out, edge, door ? 'wood' : 'glass', a, b, low, high, inset, door ? c.wood : c.glass);
  if (lod === 0) return;
  if (lod === 1) {
    for (const x of [a, b])
      panel(out, edge, 'stone', x - 0.055, x + 0.055, low, high, 0.08, c.trim);
    panel(out, edge, 'stone', a - 0.12, b + 0.12, high, high + 0.12, 0.08, c.trim);
    if (!door) panel(out, edge, 'stone', a - 0.15, b + 0.15, low - 0.12, low, 0.08, c.sill);
    return;
  }
  const p = edge.point;
  for (const y of [low, high]) {
    const n = y === low ? up : [0, -1, 0];
    face(out, 'paint', [p(a, y, 0), p(b, y, 0), p(b, y, inset), p(a, y, inset)], n, c.recess);
  }
  for (const [x, sign] of [
    [a, 1],
    [b, -1],
  ]) {
    const n = edge.tangent.map((v) => v * sign);
    face(
      out,
      'paint',
      [p(x, low, 0), p(x, high, 0), p(x, high, inset), p(x, low, inset)],
      n,
      c.recess,
    );
    ledge(out, edge, 'stone', x - 0.057, x + 0.057, low - 0.06, high + 0.09, -0.012, 0.095, c.trim);
  }
  ledge(out, edge, 'stone', a - 0.15, b + 0.15, high - 0.025, high + 0.115, -0.01, 0.125, c.trim);
  if (!door)
    ledge(out, edge, 'stone', a - 0.18, b + 0.18, low - 0.14, low - 0.007, -0.02, 0.21, c.sill);
  if (lod < 2) return;
  const frame = door ? c.wood : c.paleSash;
  const rail = door ? high - (high - low) * 0.26 : low + (high - low) * 0.58;
  panel(out, edge, 'paint', u - 0.033, u + 0.033, low, high, inset + 0.023, frame);
  panel(out, edge, 'paint', a, b, rail - 0.033, rail + 0.033, inset + 0.025, frame);
}

function windowBand(out, edge, bottom, top, windows, wallSlot, color, lod) {
  let start = 0;
  for (const opening of windows) {
    const { u, width, low, high } = opening;
    const a = u - width / 2;
    const b = u + width / 2;
    panel(out, edge, wallSlot, start, a, bottom, top, 0, color);
    panel(out, edge, wallSlot, a, b, bottom, low, 0, color);
    panel(out, edge, wallSlot, a, b, high, top, 0, color);
    recess(out, edge, opening, lod);
    start = b;
  }
  panel(out, edge, wallSlot, start, edge.length, bottom, top, 0, color);
}

function pilaster(out, edge, x, lod) {
  const foot = firstCorniceY + 0.21;
  const head = eavesY - 1.14;
  if (lod === 0) {
    panel(out, edge, 'plaster', x - 0.23, x + 0.23, foot, head, 0.025, c.trim);
    return;
  }
  ledge(out, edge, 'plaster', x - 0.24, x + 0.24, foot, head, 0, 0.16, c.trim);
  ledge(out, edge, 'stone', x - 0.32, x + 0.32, foot - 0.13, foot + 0.23, -0.025, 0.235, c.sill);
  ledge(out, edge, 'stone', x - 0.3, x + 0.3, head - 0.17, head + 0.12, -0.02, 0.21, c.trim);
  if (lod < 2) return;
  for (const offset of lod === 2 ? [-0.105, 0, 0.105] : [-0.144, -0.072, 0, 0.072, 0.144])
    panel(
      out,
      edge,
      'plaster',
      x + offset - 0.017,
      x + offset + 0.017,
      foot + 0.295,
      head - 0.23,
      0.161,
      c.sill,
    );
}

function pediment(out, edge, u, low, width, lod) {
  const p = edge.point;
  const half = width / 2 + 0.15;
  const peak = low + 0.46;
  const left = p(u - half, low, 0.12);
  const right = p(u + half, low, 0.12);
  const tip = p(u, peak, 0.12);
  face(out, 'stone', [left, right, tip], edge.outward, c.trim);
  if (lod > 1) {
    beam(out, 'stone', left, tip, 0.075, 0.093, c.sill);
    beam(out, 'stone', tip, right, 0.075, 0.093, c.sill);
  }
}

function balcony(out, edge, lod) {
  const u = edge.length / 2;
  const y = firstCorniceY + 0.43;
  const width = 2.86;
  ledge(out, edge, 'stone', u - width / 2, u + width / 2, y - 0.28, y, -0.04, 1.04, c.limestone);
  for (const d of [-0.95, 0.95]) {
    const a = edge.point(u + d, y - 0.81, 0.072);
    const b = edge.point(u + d, y - 0.14, 0.91);
    beam(out, 'stone', a, b, 0.25, 0.26, c.sill);
  }
  const p = edge.point;
  const front = 1.012;
  const rail = y + 0.9;
  beam(
    out,
    'paint',
    p(u - width / 2, rail, front),
    p(u + width / 2, rail, front),
    0.074,
    0.071,
    c.iron,
  );
  for (const offset of [-1.38, 1.38])
    beam(out, 'paint', p(u + offset, rail, 0.09), p(u + offset, rail, front), 0.068, 0.074, c.iron);
  const bars = [4, 7, 11, 15][lod];
  for (let i = 0; i < bars; i++) {
    const x = u + (i / (bars - 1) - 0.5) * 2.78;
    beam(out, 'paint', p(x, y, front), p(x, rail, front), 0.035, 0.049, c.iron);
  }
}

function frontage(out, index, lod) {
  const edge = wallEdge(index);
  const { a, b, length, point: p } = edge;
  const isLong = index === 0 || index === 2;
  const square = index === 3;
  const faceColor = index === 1 ? c.shadedPlaster : c.warmPlaster;
  face(
    out,
    'ashlar',
    [
      p(0, sampleGround(...a) - 0.38),
      p(length, sampleGround(...b) - 0.38),
      p(length, plinthTop),
      p(0, plinthTop),
    ],
    edge.outward,
    c.stone,
  );
  const count = index === 1 ? 3 : isLong ? 9 : 3;
  const pitch = length / count;
  const bays = Array.from({ length: count }, (_, i) => (i + 0.5) * pitch);
  const widths = isLong ? 1.24 : square ? 1.07 : 1.18;
  const middle = Math.floor(bays.length / 2);
  const doorHere = square || index === 0;
  const groundBays = bays.map((u, i) => {
    const door = doorHere && i === middle;
    return {
      u,
      width: door ? widths + 0.33 : widths,
      low: door ? plinthTop : 1.39,
      high: door ? 3.65 : 3.12,
      door,
    };
  });
  const firstBays = bays.map((u, i) => ({
    u,
    width: widths,
    low: square && i === middle ? 4.74 : 5.37,
    high: 7.69,
    door: square && i === middle,
  }));
  const secondBays = bays.map((u) => ({
    u,
    width: widths - 0.08,
    low: 9.48,
    high: 11.42,
    door: false,
  }));
  windowBand(out, edge, plinthTop, firstCorniceY, groundBays, 'ashlar', c.rusticated, lod);
  windowBand(out, edge, firstCorniceY, 8.66, firstBays, 'plaster', faceColor, lod);
  windowBand(out, edge, 8.66, eavesY, secondBays, 'plaster', faceColor, lod);
  for (const [y, height, depth] of [
    [firstCorniceY, 0.22, 0.29],
    [8.61, 0.116, 0.075],
    [eavesY - 0.89, 0.15, 0.155],
    [eavesY - 0.32, 0.27, 0.32],
  ]) {
    if (lod === 0) panel(out, edge, 'stone', 0, length, y, y + height, 0.035, c.trim);
    else ledge(out, edge, 'stone', 0, length, y, y + height, -0.014, depth, c.trim);
  }
  if (isLong || square)
    for (const i of isLong ? [1, 3, 6, 8] : [0, count])
      pilaster(out, edge, Math.max(0.27, Math.min(length - 0.27, i * pitch)), lod);
  if (square) balcony(out, edge, lod);
  if (lod === 0) return;
  if (doorHere) {
    const x = bays[middle];
    ledge(out, edge, 'stone', x - 1.02, x + 1.02, -0.28, 0.35, -0.04, 0.55, c.stone);
    ledge(out, edge, 'stone', x - 0.97, x + 0.97, 0.35, plinthTop, -0.04, 0.3, c.sill);
  }
  if (isLong) {
    for (const opening of firstBays.slice(3, 6)) {
      pediment(out, edge, opening.u, opening.high + 0.18, opening.width, lod);
      if (lod > 1)
        for (const d of [-0.38, -0.19, 0, 0.19, 0.38])
          ledge(
            out,
            edge,
            'stone',
            opening.u + d - 0.038,
            opening.u + d + 0.038,
            5.03,
            5.36,
            0.003,
            0.09,
            c.trim,
          );
    }
  }
  const teethPitch = lod > 1 ? 0.58 : 1.85;
  for (let x = 0.25; x + 0.17 < length; x += teethPitch) {
    ledge(out, edge, 'stone', x, x + 0.15, eavesY - 0.43, eavesY - 0.31, 0.004, 0.21, c.trim);
    if (lod > 1)
      panel(
        out,
        edge,
        'plaster',
        x + 0.046,
        x + 0.105,
        eavesY - 0.78,
        eavesY - 0.46,
        0.031,
        c.sill,
      );
  }
}

function roof(out, lod) {
  const center = [0, 0];
  const enlarged = outline.map((p) => mix(center, p, 1.053));
  const eave = enlarged.map((p) => settled(p, eavesY));
  const soffit = enlarged.map((p) => settled(p, eavesY - 0.36));
  face(out, 'stone', soffit, [0, -1, 0], c.trim);
  for (let i = 0; i < eave.length; i++) {
    const next = (i + 1) % eave.length;
    face(
      out,
      'roof',
      [soffit[i], soffit[next], eave[next], eave[i]],
      wallEdge(i).outward,
      c.roofShadow,
    );
  }
  const back = mix(outline[1], outline[2], 0.51);
  const south = mix(outline[0], outline[3], 0.5);
  const rearRidge = settled(mix(back, south, 0.18), ridgeY);
  const squareRidge = settled(mix(south, back, 0.15), ridgeY - 0.17);
  const slopes = [
    [eave[0], eave[1], rearRidge, squareRidge],
    [eave[1], eave[2], rearRidge],
    [eave[2], eave[3], squareRidge, rearRidge],
    [eave[3], eave[0], squareRidge],
  ];
  for (const [i, slope] of slopes.entries())
    face(out, 'roof', slope, up, i < 2 ? c.roofShadow : c.roof, ([x, y, z]) => [z + 0.61 * x, y]);
  if (lod === 0) return;
  beam(out, 'roof', rearRidge, squareRidge, 0.15, 0.13, c.roof);
  for (let i = 0; i < eave.length; i++)
    beam(out, 'roof', eave[i], eave[(i + 1) % eave.length], 0.13, 0.14, c.roofShadow);
}

function draw(out, lod) {
  outline.forEach((_, i) => {
    frontage(out, i, lod);
  });
  roof(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-28, 25, 48];
const lookAt = [-0.4, 8.6, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The three-storey Leaning House of Tartu at Raekoja plats 18, with its documented lean, classical façades and square-facing balcony.',
  camera,
  lookAt,
  sunDirection: [-75, 102, 66],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.48,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'square-balcony-and-lean', position: [8, 5.0, 38], lookAt: [5, 8.5, 13] },
    { name: 'kompanii-street-facade', position: [-35, 11, 26], lookAt: [-5, 8.1, 2.5] },
    { name: 'river-side-and-roof', position: [41, 23, 15], lookAt: [2, 8.1, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.95, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independently modeled from written architectural records, the mapped building footprint and unaltered Terrarium elevation samples.',
};
