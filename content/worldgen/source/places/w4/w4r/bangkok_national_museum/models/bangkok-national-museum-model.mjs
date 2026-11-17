/** The Bangkok National Museum on its mapped Front Palace building footprints. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { darkTile, gabledRoof, gilding, tile } from './front-palace-roofs.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const grade = read('terrain-grid.json');
const section = plan.section;
const ref = 'palette:#ffffff';
const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.84, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  paving: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  gold: { slot: 'trim', localRef: ref, roughness: 0.74, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    lime: 'e5dbc4',
    shade: 'd2c4a8',
    pale: 'e5dbc8',
    chalk: 'f0e6ce',
    ash: 'b4ad9e',
    soil: '958677',
    red: '793c30',
    deepRed: '623128',
    dark: '343630',
    glass: '5a5e56',
    wood: '6c4b39',
    goldShade: '9c7437',
    softGrey: 'b2ab9c',
  }).map(([key, value]) => [key, rgb(value)]),
);

const lerp = (a, b, t) => a + (b - a) * t;
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
const outward = (ring) => (area(ring) < 0 ? ring : [...ring].reverse());
const midpoint = (a, b) => [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)];
const features = Object.fromEntries(map.features.map((f) => [f.id, outward(f.points)]));
const courtRings = map.features
  .filter((f) => f.role === 'phra-wiman-interior-court')
  .map((f) => f.points);
const mainId = Object.values(section).map((s) => s.feature);
const modernHalls = new Set([
  'way/83608614',
  'way/234366081',
  'way/234366150',
  'way/494616843',
  'way/1191199542',
]);
const openPavilions = new Set(['way/364438974', 'way/1157161863', 'way/1157161864']);
const bounds = (ring) => {
  const x = ring.map((p) => p[0]),
    z = ring.map((p) => p[1]);
  return { x0: Math.min(...x), x1: Math.max(...x), z0: Math.min(...z), z1: Math.max(...z) };
};

function sampledGround([x, z]) {
  const u = (x - grade.origin[0]) / grade.stepMeters;
  const v = (z - grade.origin[1]) / grade.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    grid = grade.heightsMeters;
  return (
    lerp(
      lerp(grid[b][a], grid[b][a + 1], u - a),
      lerp(grid[b + 1][a], grid[b + 1][a + 1], u - a),
      v - b,
    ) - grade.modelDatumElevationMeters
  );
}

function localGround(ring) {
  const samples = ring
    .flatMap((p, i) => [sampledGround(p), sampledGround(midpoint(p, ring[(i + 1) % ring.length]))])
    .sort((a, b) => a - b);
  return { base: samples[0] - 0.68, lower: samples[Math.floor(samples.length / 4)] };
}

function triangulation(ring, holes = []) {
  const raw = new MeshBufferBuilder();
  if (
    !raw.addCap(
      'roof',
      ref,
      ring,
      holes,
      () => 0,
      [0, 1, 0],
      (p) => p,
      tile,
    )
  )
    throw Error('Front Palace native ring could not be triangulated');
  const { positions, indices } = raw.finalize();
  return Array.from(indices, (i) => [positions[i * 3], positions[i * 3 + 2]]);
}
const parts = Object.fromEntries(
  Object.entries(features).map(([id, ring]) => [
    id,
    triangulation(ring, id === section.phraWiman.feature ? courtRings : []),
  ]),
);

function cap(out, slot, triangles, y, color) {
  for (let i = 0; i < triangles.length; i += 3) {
    const ring = triangles.slice(i, i + 3);
    if (Math.abs(area(ring)) > 1e-5)
      triangle(
        out,
        slot,
        ring.map(([x, z]) => [x, y, z]),
        color,
      );
  }
}
function distance([x, z], ring) {
  let nearest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = ring[i],
      [c, d] = ring[(i + 1) % ring.length];
    const dx = c - a,
      dz = d - b;
    const t = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - a - t * dx, z - b - t * dz));
  }
  return nearest;
}
function hippedRoof(out, id, ring, base, rise, color, lod, holes = []) {
  const coarse = parts[id];
  if (lod === 0) {
    cap(out, 'tiles', coarse, base, color);
    return;
  }
  const lift = ([x, z]) => [
    x,
    base + Math.min(rise, Math.min(...[ring, ...holes].map((r) => distance([x, z], r))) * 0.54),
    z,
  ];
  const fill = (a, b, c, steps) => {
    if (!steps) {
      triangle(out, 'tiles', [lift(a), lift(b), lift(c)], color);
      return;
    }
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      ca = midpoint(c, a);
    fill(a, ab, ca, steps - 1);
    fill(ab, b, bc, steps - 1);
    fill(ca, bc, c, steps - 1);
    fill(ab, bc, ca, steps - 1);
  };
  for (let i = 0; i < coarse.length; i += 3) {
    const [a, b, c] = coarse.slice(i, i + 3);
    if (Math.abs(area([a, b, c])) > 1e-5) fill(a, b, c, lod > 1 ? 2 : 1);
  }
}
function rect(out, slot, a, b, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [a, y0, z],
      [b, y0, z],
      [b, y1, z],
      [a, y1, z],
    ],
    color,
  );
}

function eastFrontage(out, ring) {
  const edges = ring
    .map((a, i) => [a, ring[(i + 1) % ring.length]])
    .filter(([a, b]) => Math.abs(a[1] - b[1]) > 2.5)
    .sort(([a, b], [c, d]) => c[0] + d[0] - a[0] - b[0]);
  const [a, b] = edges[0];
  const [x, z] = midpoint(a, b);
  const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  return {
    facade: transform(out, angle, [x + 0.09 * Math.sin(angle), 0, z + 0.09 * Math.cos(angle)]),
    x,
    z,
  };
}

function opening(out, x, y, width, height, lod, { ornate = false, door = false } = {}) {
  const a = x - width / 2,
    b = x + width / 2,
    top = y + height;
  const size = door ? 0.13 : 0.11;
  rect(out, 'stone', a - size, b + size, y - size, top + size, 0.022, tint.pale);
  rect(out, 'gold', a, b, y, top, 0.043, door ? tint.dark : tint.glass);
  if (lod < 2) return;
  const surround = ornate ? gilding : tint.wood;
  if (ornate) {
    const taper = width * 0.085;
    for (const sign of [-1, 1]) {
      const bottom = x + sign * width * 0.56,
        head = bottom - sign * taper;
      face(
        out,
        'gold',
        [
          [bottom - 0.11, y, 0.08],
          [bottom + 0.11, y, 0.08],
          [head + 0.08, top, 0.08],
          [head - 0.08, top, 0.08],
        ],
        surround,
      );
    }
    const crest = top + width * (door ? 0.48 : 0.35);
    triangle(
      out,
      'gold',
      [
        [x - width * 0.52, top, 0.08],
        [x + width * 0.52, top, 0.08],
        [x, crest, 0.08],
      ],
      gilding,
    );
    triangle(
      out,
      'gold',
      [
        [x - width * 0.31, top + 0.055, 0.089],
        [x + width * 0.31, top + 0.055, 0.089],
        [x, crest - width * 0.12, 0.089],
      ],
      tint.goldShade,
    );
  }
  const divisions = lod === 3 && !door ? 3 : 1;
  for (let i = 1; i <= divisions; i++) {
    const u = lerp(a, b, i / (divisions + 1));
    rect(out, 'wood', u - 0.031, u + 0.031, y, top, 0.055, surround);
  }
}

function shell(
  out,
  ring,
  bottom,
  floor,
  eaves,
  lod,
  { wooden = false, bayCount = 0, ornate = false, noWindows = false } = {},
) {
  const wallSlot = wooden ? 'wood' : 'lime',
    wallColor = wooden ? tint.red : tint.lime;
  ring.forEach((p, i) => {
    const [x, z] = p,
      [xx, zz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(xx - x, zz - z);
    const facade = transform(out, -Math.atan2(zz - z, xx - x), [x, 0, z]);
    if (floor - bottom > 0.035) rect(facade, 'stone', 0, length, bottom, floor, -0.015, tint.soil);
    rect(facade, wallSlot, 0, length, floor, eaves, 0, wallColor);
    if (lod === 0) return;
    rect(
      facade,
      wooden ? 'wood' : 'stone',
      0,
      length,
      eaves - (wooden ? 0.27 : 0.19),
      eaves,
      0.04,
      wooden ? tint.deepRed : tint.pale,
    );
    if (lod > 1)
      rect(
        facade,
        wallSlot,
        0,
        length,
        floor + 0.025,
        floor + 0.21,
        0.025,
        wooden ? tint.deepRed : tint.shade,
      );
    if (noWindows || length < 4 || (lod === 1 && i % 2 === 1 && !bayCount)) return;
    const count =
      length > 14 && bayCount > 0
        ? bayCount
        : Math.max(1, Math.round(length / (lod > 1 ? 4.2 : 5.8)));
    for (let j = 0; j < count; j++) {
      const s = ((j + 0.5) * length) / count;
      const width = Math.min(wooden ? 0.82 : 1.25, (length / count) * 0.42);
      const height = wooden ? 1.2 : Math.min((eaves - floor) * 0.48, 2.8);
      opening(facade, s, floor + (eaves - floor) * 0.31, width, height, lod, { ornate });
    }
  });
}

function insetEnds(ring, from, to) {
  const { x0, x1 } = bounds(ring);
  return ring.map(([x, z]) => [lerp(from, to, (x - x0) / (x1 - x0)), z]);
}
function squaredPost(out, x, z, base, top, width, lod, wood = false) {
  const slot = wood ? 'wood' : 'lime',
    color = wood ? tint.deepRed : tint.chalk,
    r = width / 2;
  box(out, slot, [x - r, base, z - r], [x + r, top, z + r], color);
  if (lod > 1 && !wood) {
    const s = r + 0.13;
    box(out, 'stone', [x - s, base, z - s], [x + s, base + 0.21, z + s], tint.ash);
    box(out, 'stone', [x - s, top - 0.2, z - s], [x + s, top - 0.035, z + s], tint.pale);
  }
}

function stair(out, x, z, sign, floor, lowest, width, lod) {
  if (floor - lowest < 0.11) return;
  const steps = lod > 1 ? Math.round((floor - lowest) / 0.27) + 1 : 3;
  for (let k = 0; k < steps; k++) {
    const a = x + sign * (k * 0.32 - 0.1),
      b = x + sign * ((k + 1) * 0.32 - 0.09);
    const upper = lerp(floor, lowest, k / steps);
    box(
      out,
      'paving',
      [Math.min(a, b), lowest - 0.06, z - width / 2],
      [Math.max(a, b), upper, z + width / 2],
      tint.ash,
    );
  }
}

function frontPorch(out, x, wallX, z, width, base, floor, eave, lod, ornate) {
  const sign = Math.sign(x - wallX);
  const wall = transform(out, (sign * Math.PI) / 2, [wallX + sign * 0.053, 0, z]);
  const centerWidth = ornate ? 2.1 : 2.65;
  if (lod > 0)
    opening(wall, 0, floor + 0.1, centerWidth, ornate ? 3.52 : 3.17, lod, { ornate, door: true });
  if (lod > 1) {
    for (const s of [-1, 1])
      opening(
        wall,
        s * width * 0.36,
        floor + 0.14,
        ornate ? 1.67 : 1.5,
        ornate ? 3.22 : 2.83,
        lod,
        { ornate, door: true },
      );
  }
  if (lod === 0) return;
  const spacing = width / (ornate ? 4 : 5);
  for (const i of [-2, -1, 1, 2])
    squaredPost(
      out,
      x - sign * 0.51,
      z + i * spacing,
      floor,
      eave - 0.1,
      ornate ? 0.51 : 0.57,
      lod,
    );
  const r = width * 0.53;
  box(
    out,
    'wood',
    [Math.min(x, wallX), eave - 0.23, z - r],
    [Math.max(x, wallX), eave, z + r],
    tint.red,
  );
  stair(out, x, z, sign, floor, Math.min(floor - 0.22, base + 0.44), centerWidth * 1.44, lod);
}

function formalHall(out, spec, lod, chapel = false) {
  const footprint = features[spec.feature];
  const { x0, x1, z0, z1 } = bounds(footprint);
  const z = (z0 + z1) / 2;
  const width = z1 - z0;
  const { base, lower } = localGround(footprint);
  const floor = spec.floor;
  const rear = x0 + (chapel ? 2.7 : 0);
  const front = x1 - (chapel ? 3.35 : 4.75);
  shell(out, footprint, Math.min(base, floor - 0.4), floor - 0.1, floor, lod, { noWindows: true });
  cap(out, 'paving', parts[spec.feature], floor + 0.013, tint.ash);
  shell(out, insetEnds(footprint, rear, front), floor, floor, spec.eaves, lod, {
    bayCount: spec.bays,
    ornate: chapel,
  });
  const roofWidth = width + (chapel ? 0.91 : 1.48);
  gabledRoof(
    out,
    {
      x0: x0 - 0.44,
      x1: (chapel ? x1 : front + 0.11) + 0.62,
      z,
      width: roofWidth,
      eave: spec.eaves,
      rise: spec.rise,
      steps: spec.roofSlopeSteps,
      gilt: true,
      roofTile: chapel ? tile : darkTile,
      gableTint: chapel ? tint.red : rgb('6b4c42'),
    },
    lod,
  );
  if (!chapel)
    gabledRoof(
      out,
      {
        x0: front + 0.05,
        x1: x1 + 0.34,
        z,
        width: width * 0.76,
        eave: spec.eaves - 0.7,
        rise: spec.rise * 0.65,
        steps: 2,
        gilt: true,
        roofTile: darkTile,
      },
      lod,
    );
  frontPorch(
    out,
    x1,
    front,
    z,
    width * (chapel ? 0.73 : 0.69),
    lower,
    floor,
    spec.eaves - (chapel ? 0.16 : 0.7),
    lod,
    chapel,
  );
  if (chapel)
    frontPorch(out, x0, rear, z, width * 0.72, lower, floor, spec.eaves - 0.15, lod, true);
  if (lod > 1 && chapel) {
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const x = lerp(x0 + 3.3, x1 - 3.3, (i + 0.5) / 7);
        squaredPost(out, x, z + side * (width * 0.47), floor, spec.eaves - 0.19, 0.43, lod);
      }
  }
}

function redHouse(out, lod) {
  const spec = section.redHouse,
    ring = features[spec.feature];
  const { x0, x1, z0, z1 } = bounds(ring),
    z = (z0 + z1) / 2;
  const { base } = localGround(ring);
  const { floor, eaves, rise } = spec;
  shell(out, ring, floor - 0.13, floor, eaves, lod, { wooden: true, bayCount: spec.bays });
  cap(out, 'wood', parts[spec.feature], floor + 0.015, tint.red);
  for (const s of [-1, 1]) {
    const rows = lod === 0 ? 3 : 6;
    for (let i = 0; i < rows; i++) {
      const x = lerp(x0 + 0.42, x1 - 0.42, i / (rows - 1));
      squaredPost(out, x, z + s * (z1 - z0) * 0.41, base, floor, 0.3, lod, true);
    }
  }
  gabledRoof(
    out,
    {
      x0: x0 - 0.54,
      x1: x1 + 0.59,
      z,
      width: z1 - z0 + 0.85,
      eave: eaves,
      rise,
      roofTile: darkTile,
      gableTint: tint.deepRed,
    },
    lod,
  );
  if (lod > 0) stair(out, x1, z, 1, floor, base + 0.59, 2.16, lod);
}

function phraWiman(out, lod) {
  const spec = section.phraWiman,
    ring = features[spec.feature];
  const { base } = localGround(ring);
  shell(out, ring, base, spec.floor, spec.eaves, lod);
  hippedRoof(out, spec.feature, ring, spec.eaves, 1.53, tile, lod, courtRings);
  for (let i = 0; i < courtRings.length; i++) {
    const court = courtRings[i];
    const bottom = spec.courtFloor[i];
    shell(out, [...outward(court)].reverse(), bottom - 0.25, bottom, spec.eaves, lod);
    cap(out, 'paving', triangulation(court), bottom, tint.ash);
  }
  for (const [a, b, z, rise] of spec.residentialRidges)
    gabledRoof(
      out,
      {
        x0: a,
        x1: b,
        z,
        width: 12.15,
        eave: spec.eaves + 0.18,
        rise,
        steps: 2,
        gilt: true,
        gableTint: tint.red,
      },
      lod,
    );
  const [x0, x1, z0, z1] = spec.audienceHall;
  const z = (z0 + z1) / 2;
  gabledRoof(
    out,
    {
      x0,
      x1,
      z,
      width: Math.min(z1 - z0, 18.4),
      eave: spec.eaves + 0.22,
      rise: 6.2,
      steps: 3,
      gilt: true,
      gableTint: tint.deepRed,
    },
    lod,
  );
  if (lod > 0) {
    const { facade } = eastFrontage(out, ring);
    const baseFront = 1.75;
    for (const side of [-1, 0, 1]) {
      opening(facade, side * 3.6, baseFront, side === 0 ? 2.28 : 1.75, 3.21, lod, {
        ornate: true,
        door: true,
      });
    }
  }
}

function pavilion(out, id, ring, lod) {
  const { x0, x1, z0, z1 } = bounds(ring),
    z = (z0 + z1) / 2;
  const { base, lower } = localGround(ring);
  const floor = lower + 0.43,
    eave = floor + 3.57;
  shell(out, ring, Math.min(base, floor - 0.23), floor - 0.07, floor, lod, { noWindows: true });
  cap(out, 'paving', parts[id], floor + 0.02, tint.ash);
  for (const [x, zz] of ring)
    squaredPost(
      out,
      lerp(x, (x0 + x1) / 2, 0.14),
      lerp(zz, z, 0.14),
      floor,
      eave - 0.07,
      0.37,
      lod,
    );
  gabledRoof(
    out,
    {
      x0: x0 - 0.3,
      x1: x1 + 0.3,
      z,
      width: z1 - z0 + 0.56,
      eave,
      rise: (z1 - z0) * 0.46,
      steps: 2,
      gilt: lod > 0,
      gableTint: tint.red,
    },
    lod,
  );
}

function museumWing(out, id, ring, lod) {
  const { base, lower } = localGround(ring);
  const modern = modernHalls.has(id);
  const floor = lower + 0.27;
  const { x0, x1, z0, z1 } = bounds(ring);
  const large = Math.max(x1 - x0, z1 - z0) > 28;
  const chariot = id === 'way/364438989';
  const residence = id === 'way/234366110';
  const eave = floor + (modern ? (large ? 6.1 : 4.2) : chariot ? 7.6 : residence ? 7.1 : 4.7);
  shell(out, ring, Math.min(base, floor - 0.22), floor, eave, lod, { ornate: residence });
  hippedRoof(
    out,
    id,
    ring,
    eave,
    chariot ? 4.9 : residence ? 4.2 : modern ? 2.5 : 3.2,
    modern ? tile : darkTile,
    lod,
  );
  if ((chariot || residence) && lod > 1) {
    const { facade, x, z } = eastFrontage(out, ring);
    const width = residence ? z1 - z0 : z1 - z0 - 13.7;
    const door = chariot ? 3.6 : 2.53;
    opening(facade, 0, floor + 0.11, door, chariot ? 4.1 : 3.1, lod, {
      door: true,
      ornate: residence,
    });
    stair(out, x, z, 1, floor, lower - 0.11, door + 0.9, lod);
    if (chariot && lod === 3)
      beamPath(
        out,
        'wood',
        [
          [x, eave - 0.9, z - width * 0.35],
          [x, eave + 0.4, z],
          [x, eave - 0.9, z + width * 0.35],
        ],
        0.085,
        0.095,
        tint.red,
      );
  }
}

function build(out, lod) {
  formalHall(out, section.throneHall, lod);
  formalHall(out, section.chapel, lod, true);
  redHouse(out, lod);
  phraWiman(out, lod);
  for (const [id, ring] of Object.entries(features)) {
    if (
      mainId.includes(id) ||
      map.features.find((f) => f.id === id).role === 'phra-wiman-interior-court'
    )
      continue;
    if (openPavilions.has(id)) pavilion(out, id, ring, lod);
    else museumWing(out, id, ring, lod);
  }
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const camera = [105, 119, 161],
  lookAt = [-82, 5, -1];
const recipe = 'bangkok-national-museum-model.mjs';
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Bangkok National Museum’s surviving Front Palace compounds, with stepped Thai roofs, the white Buddhaisawan Chapel, the raised Red House, the connected Phra Wiman residences and later exhibition halls.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [32, 35, 24],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'tile_ceramic',
    'wood_plain',
    'stone_ashlar',
  ],
  qaCameras: [
    { name: 'siwamokkhaphiman-throne-hall', position: [46, 12, 9], lookAt: [6, 7, 37] },
    { name: 'buddhaisawan-royal-chapel', position: [13, 9.3, 18], lookAt: [-27, 6.5, 0.7] },
    { name: 'red-house-and-chapel', position: [-34, 6.1, 19], lookAt: [-47, 3.4, 33.3] },
    { name: 'phra-wiman-courts-and-ridges', position: [-82, 29, -39], lookAt: [-131, 8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'front-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.28],
        ['street', 'museumStreet', 0.11],
        ['closeup', 'museumCloseup', 0.042],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Three CC0 original photos by Iudexvivorum inform architectural details. Native OpenStreetMap geometry under ODbL 1.0.',
};
