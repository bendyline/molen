/** Standing heritage structures of the Parramatta Female Factory and former Girls Home. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const map = read('map-frame');
const plan = read('plan-controls');
const ground = read('terrain-grid');
const features = Object.fromEntries(map.features.map(({ id, points }) => [id, points]));
const v = (shade) => rgb(shade);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.94, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', localRef: 'palette:#ddd5c0', roughness: 0.91, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#333c3e', roughness: 0.7, metallic: 0 },
};
const shades = {
  warmStone: v('c8a77f'),
  variedStone: v('b99a75'),
  trimStone: v('d6bc98'),
  foundation: v('aa9276'),
  wall: v('b79b76'),
  coping: v('ccb38e'),
  brick: v('915d4c'),
  tile: v('76665e'),
  slate: v('676773'),
  stain: v('a19682'),
  ivory: v('d1c4a9'),
  wood: v('a99a84'),
  iron: v('62655f'),
  dark: v('495456'),
};
const average = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const mix = (a, b, t) => a + (b - a) * t;
function groundAt(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters;
  const v = (z - ground.origin[1]) / ground.stepMeters;
  const ix = Math.floor(u),
    iz = Math.floor(v);
  const first = mix(ground.heightsMeters[iz][ix], ground.heightsMeters[iz][ix + 1], u - ix);
  const second = mix(
    ground.heightsMeters[iz + 1][ix],
    ground.heightsMeters[iz + 1][ix + 1],
    u - ix,
  );
  return mix(first, second, v - iz) - ground.modelDatumElevationMeters;
}
function bounds(points) {
  const x = points.map((p) => p[0]),
    z = points.map((p) => p[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z)];
}

function surface(out, slot, points, direction, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) {
    quad(out, slot, points, n, tint);
  } else {
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      points.map(([x, y, z]) => [x + z, y]),
      tint,
    );
  }
}

function orientation(rectangle, alongX) {
  const [x0, x1, z0, z1] = rectangle;
  if (alongX)
    return {
      u0: x0,
      u1: x1,
      w0: z0,
      w1: z1,
      at: (u, y, w) => [u, y, w],
      across: (x) => [0, 0, x],
      seal: (x) => [x, 0, 0],
    };
  return {
    u0: z0,
    u1: z1,
    w0: x0,
    w1: x1,
    at: (u, y, w) => [w, y, u],
    across: (x) => [x, 0, 0],
    seal: (x) => [0, 0, x],
  };
}

function cornice(out, rectangle, y, depth, height, tint) {
  const [x0, x1, z0, z1] = rectangle;
  box(out, 'trim', [x0 - depth, y, z0 - depth], [x1 + depth, y + height, z1 + depth], tint);
}

function roof(
  out,
  rectangle,
  alongX,
  eave,
  rise,
  tint,
  material,
  level,
  hip,
  gableTint = shades.warmStone,
) {
  const { u0, u1, w0, w1, at, across, seal } = orientation(rectangle, alongX);
  const rim = 0.29;
  const uA = u0 - rim,
    uB = u1 + rim,
    wA = w0 - rim,
    wB = w1 + rim;
  const mid = (w0 + w1) / 2;
  const leftRidge = at(uA + hip, eave + rise, mid),
    rightRidge = at(uB - hip, eave + rise, mid);
  for (const [w, direction] of [
    [wA, -1],
    [wB, 1],
  ]) {
    surface(
      out,
      'tile',
      [at(uA, eave, w), at(uB, eave, w), rightRidge, leftRidge],
      [0, 1, 0],
      tint,
    );
    if (level > 0)
      beam(out, 'trim', at(uA, eave - 0.04, w), at(uB, eave - 0.04, w), 0.13, 0.135, shades.stain);
    if (level > 1)
      beam(
        out,
        'trim',
        at(uA, eave - 0.12, w + direction * 0.04),
        at(uB, eave - 0.12, w + direction * 0.04),
        0.1,
        0.1,
        shades.iron,
      );
  }
  for (const [u, direction, ridge] of [
    [uA, -1, leftRidge],
    [uB, 1, rightRidge],
  ]) {
    const face = [at(u, eave, wA), at(u, eave, wB), ridge];
    surface(out, hip ? 'tile' : material, face, seal(direction), hip ? tint : gableTint);
  }
  if (level > 0) beam(out, 'tile', leftRidge, rightRidge, 0.16, 0.12, tint);
}

function facade(out, rectangle, y, floors, storeyHeight, level, pitch, wall, frontOnly) {
  const [x0, x1, z0, z1] = rectangle;
  const azimuths = frontOnly ? [false] : [false, true];
  for (const alongX of azimuths) {
    const { u0, u1, w0, w1, at, across } = orientation(rectangle, alongX);
    const bays = Math.floor((u1 - u0) / pitch);
    if (bays < 1) continue;
    const step = (u1 - u0) / bays;
    for (const [wallPosition, direction] of [
      [w0, -1],
      [w1, 1],
    ]) {
      const n = across(direction);
      function face(out, slot, start, end, low, high, depth, tint) {
        const w = wallPosition + direction * depth;
        surface(
          out,
          slot,
          [at(start, low, w), at(end, low, w), at(end, high, w), at(start, high, w)],
          n,
          tint,
        );
      }
      for (let floor = 0; floor < floors; floor++) {
        for (let bay = 0; bay < bays; bay++) {
          const door =
            floor === 0 && bay === Math.floor(bays / 2) && (alongX ? direction > 0 : direction < 0);
          const center = u0 + (bay + 0.5) * step;
          const width = door ? 0.66 : Math.min(0.55, step * 0.2);
          const low = y + floor * storeyHeight + (door ? 0.04 : 0.9);
          const high = y + floor * storeyHeight + Math.min(storeyHeight - 0.2, door ? 2.3 : 2.45);
          const surround = wall === 'wood' ? shades.ivory : shades.trimStone;
          face(
            out,
            'trim',
            center - width - 0.085,
            center + width + 0.085,
            low - 0.1,
            high + 0.12,
            0.026,
            surround,
          );
          face(out, 'dark', center - width, center + width, low, high, 0.045, shades.dark);
          if (level < 2) continue;
          face(
            out,
            'trim',
            center - width - 0.13,
            center + width + 0.13,
            low - 0.08,
            low + 0.015,
            0.105,
            surround,
          );
          face(out, 'trim', center - 0.025, center + 0.025, low, high, 0.056, shades.ivory);
          if (door) continue;
          face(
            out,
            'trim',
            center - width,
            center + width,
            (low + high) / 2 - 0.03,
            (low + high) / 2 + 0.03,
            0.057,
            shades.ivory,
          );
          if (level > 2) {
            for (const t of [0.32, 0.68]) {
              const muntin = mix(low, high, t);
              face(
                out,
                'trim',
                center - width,
                center + width,
                muntin - 0.016,
                muntin + 0.016,
                0.058,
                shades.ivory,
              );
            }
          }
        }
      }
    }
  }
}

function house(out, rectangle, row, level) {
  const [x0, x1, z0, z1] = rectangle;
  const y = row.level ?? groundAt((x0 + x1) / 2, (z0 + z1) / 2);
  const base =
    Math.min(y - 0.28, ...[x0, x1].flatMap((x) => [z0, z1].map((z) => groundAt(x, z)))) - 0.58;
  const eave = y + row.floors * row.storey;
  const [material, tint] = row.material;
  box(out, 'stone', [x0, base, z0], [x1, y + 0.3, z1], shades.foundation);
  box(out, material, [x0, y + 0.3, z0], [x1, eave, z1], tint);
  if (level > 0) {
    cornice(out, rectangle, eave - 0.16, 0.1, 0.13, shades.trimStone);
    facade(
      out,
      rectangle,
      y,
      row.floors,
      row.storey,
      level,
      row.pitch ?? 2.7,
      material,
      level === 1 && !row.alongX,
    );
  }
  roof(
    out,
    rectangle,
    row.alongX,
    eave,
    row.rise,
    row.slate ? shades.slate : shades.tile,
    material,
    level,
    row.hip ?? 0,
    tint,
  );
  if (row.chimneys) {
    const { u0, u1, w0, w1, at } = orientation(rectangle, row.alongX);
    for (const t of row.chimneys) {
      const [x, , z] = at(mix(u0, u1, t), eave, (w0 + w1) / 2);
      const distanceFromEnd = (u1 - u0) * Math.min(t, 1 - t);
      const ridgeHeight =
        eave + row.rise * (row.hip ? Math.min(1, (distanceFromEnd + 0.29) / row.hip) : 1);
      const top = ridgeHeight + 0.8;
      box(
        out,
        material === 'brick' ? 'brick' : 'stone',
        [x - 0.35, ridgeHeight - 0.64, z - 0.36],
        [x + 0.36, top, z + 0.35],
        tint,
      );
      if (level > 1)
        box(
          out,
          'trim',
          [x - 0.4, top, z - 0.4],
          [x + 0.42, top + 0.13, z + 0.39],
          shades.trimStone,
        );
    }
  }
  return { y, eave };
}
const stone = ['stone', shades.warmStone],
  brick = ['brick', shades.brick],
  wood = ['wood', shades.wood];
function factoryRanges(out, level) {
  const [sx0, sx1, sz0, sz1] = bounds(features.C103);
  const sy = groundAt((sx0 + sx1) / 2, -61);
  house(
    out,
    [sx0, sx1, sz0, -64.2],
    {
      floors: 2,
      storey: 2.8,
      rise: 2.55,
      hip: 0,
      material: stone,
      level: sy,
      alongX: false,
      slate: true,
      chimneys: [0.21, 0.73],
    },
    level,
  );
  house(
    out,
    [sx0 + 1.1, sx1 - 0.5, -64.4, sz1],
    {
      floors: 1,
      storey: 3.05,
      rise: 2.75,
      hip: 2.5,
      material: stone,
      level: sy,
      alongX: false,
      slate: true,
      chimneys: [0.82],
    },
    level,
  );
  if (level > 1)
    house(
      out,
      [sx0 - 0.76, sx0 + 1.15, -54.5, -51.1],
      {
        floors: 1,
        storey: 2.8,
        rise: 0.76,
        material: wood,
        level: sy,
        alongX: false,
        slate: true,
        pitch: 1.55,
      },
      level,
    );

  const [nx0, nx1, nz0, nz1] = bounds(features.C111);
  const ny = groundAt((nx0 + nx1) / 2, -61);
  const main = house(
    out,
    [nx0 + 0.55, nx1, nz0 + 3.3, nz1 - 3.75],
    {
      floors: 1,
      storey: 3.65,
      rise: 3.25,
      hip: 2.7,
      material: stone,
      level: ny,
      alongX: false,
      chimneys: [0.14, 0.81],
    },
    level,
  );
  house(
    out,
    [nx0, nx1 - 0.75, nz0, nz0 + 6.6],
    {
      floors: 2,
      storey: 2.78,
      rise: 1.8,
      material: stone,
      level: ny,
      alongX: true,
      chimneys: [0.25],
    },
    level,
  );
  house(
    out,
    [nx0 + 0.85, nx1 - 0.35, nz1 - 4.4, nz1],
    {
      floors: 1,
      storey: 3.05,
      rise: 1.44,
      material: wood,
      level: ny,
      alongX: false,
    },
    level,
  );
  if (level > 0) {
    for (const z of [-66, -61.8, -57.6]) {
      const eave = main.eave + 1.32;
      box(
        out,
        'wood',
        [nx0 + 1.85, eave - 0.32, z - 0.57],
        [nx0 + 3.08, eave + 0.58, z + 0.57],
        shades.ivory,
      );
      roof(
        out,
        [nx0 + 1.74, nx0 + 3.22, z - 0.61, z + 0.61],
        true,
        eave + 0.56,
        0.46,
        shades.tile,
        'wood',
        level,
        0,
      );
      surface(
        out,
        'dark',
        [
          [nx0 + 1.843, eave - 0.09, z - 0.31],
          [nx0 + 1.843, eave - 0.09, z + 0.31],
          [nx0 + 1.843, eave + 0.4, z + 0.31],
          [nx0 + 1.843, eave + 0.4, z - 0.31],
        ],
        [-1, 0, 0],
        shades.dark,
      );
    }
  }
  const [px0, px1, pz0, pz1] = bounds(features.C105);
  const py = groundAt((px0 + px1) / 2, (pz0 + pz1) / 2);
  house(
    out,
    [px0, px1 - 2.45, pz0 + 0.4, pz1 - 0.45],
    {
      floors: 2,
      storey: 2.53,
      rise: 2.6,
      hip: 3,
      material: stone,
      level: py,
      alongX: true,
      slate: true,
      chimneys: [0.14],
      pitch: 2.9,
    },
    level,
  );
  house(
    out,
    [px1 - 3.15, px1, pz0, pz1 - 0.05],
    {
      floors: 1,
      storey: 3.75,
      rise: 1.8,
      hip: 0,
      material: stone,
      level: py,
      alongX: false,
      pitch: 2.35,
    },
    level,
  );
}

function enclosure(out, level) {
  const polygon = features.C115;
  // Use the height attribute on the standing sandstone wall and retain each mapped turn.
  for (let i = 0; i < polygon.length; i++) {
    const [a, b] = [polygon[i], polygon[(i + 1) % polygon.length]];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const normal = [dz / length, 0, -dx / length];
    if (length < 0.45) continue;
    const pieces = Math.ceil(length / (level > 1 ? 4.4 : 11));
    function at(t, y, d) {
      const x = mix(a[0], b[0], t),
        z = mix(a[1], b[1], t);
      return [x + normal[0] * d, groundAt(x, z) + y, z + normal[2] * d];
    }
    for (let j = 0; j < pieces; j++) {
      const t0 = j / pieces,
        t1 = (j + 1) / pieces;
      for (const sign of [-1, 1]) {
        const d = sign * 0.37;
        surface(
          out,
          'stone',
          [at(t0, -0.57, d), at(t1, -0.57, d), at(t1, 4, d), at(t0, 4, d)],
          normal.map((v) => v * sign),
          shades.wall,
        );
        if (level > 0)
          surface(
            out,
            'stone',
            [
              at(t0, 3.83, d + sign * 0.05),
              at(t1, 3.83, d + sign * 0.05),
              at(t1, 4, d + sign * 0.05),
              at(t0, 4, d + sign * 0.05),
            ],
            normal.map((v) => v * sign),
            shades.coping,
          );
      }
      surface(
        out,
        'stone',
        [at(t0, 4, -0.41), at(t1, 4, -0.41), at(t1, 4, 0.41), at(t0, 4, 0.41)],
        [0, 1, 0],
        shades.coping,
      );
    }
  }
}

function coveredWay(out, level) {
  const points = features.N02;
  const [, , z0, z1] = bounds(points);
  const endCenter = (z) => average(points.filter((p) => Math.abs(p[1] - z) < 1).map(([x]) => x));
  const near = endCenter(z0),
    far = endCenter(z1);
  const half = 2.17;
  const roofShape = (t) => {
    const z = mix(z0, z1, t),
      x = mix(near, far, t);
    return { x, z, y: groundAt(x, z) + 2.85 };
  };
  function roofPoint(station, side) {
    return [station.x + half * side, station.y + (side === 0 ? 0.89 : 0), station.z];
  }
  const sections = level > 0 ? 5 : 2;
  const stations = Array.from({ length: sections + 1 }, (_, i) => roofShape(i / sections));
  for (let i = 0; i < sections; i++) {
    const from = stations[i],
      to = stations[i + 1];
    for (const side of [-1, 1]) {
      surface(
        out,
        'tile',
        [roofPoint(from, side), roofPoint(to, side), roofPoint(to, 0), roofPoint(from, 0)],
        [0, 1, 0],
        shades.tile,
      );
    }
  }
  const posts = level > 0 ? 20 : 4;
  for (let i = 0; i < posts; i++) {
    const { x, z, y } = roofShape((i + 0.16) / posts);
    for (const side of [-1, 1]) {
      const post = x + side * (half - 0.22);
      box(
        out,
        'wood',
        [post - 0.08, groundAt(post, z) - 0.22, z - 0.08],
        [post + 0.08, y + 0.09, z + 0.08],
        shades.wood,
      );
      if (level > 1)
        beam(out, 'wood', [post, y - 0.54, z], [post, y, z + 0.52], 0.08, 0.08, shades.wood);
    }
  }
}

function girlsSchool(out, level) {
  const [x0, x1, z0, z1] = bounds(features.N01);
  const y = groundAt((x0 + x1) / 2, (z0 + z1) / 2) + 0.08;
  const wing = {
    floors: 3,
    storey: 3.05,
    rise: 3.25,
    material: brick,
    level: y,
    alongX: false,
    slate: true,
    pitch: 2.4,
    chimneys: [0.24, 0.77],
  };
  const start = x0 + 7.9,
    end = x1 - 7.6;
  house(
    out,
    [start, end, z0 + 2.2, z1],
    {
      floors: 3,
      storey: 3.12,
      rise: 2.85,
      hip: 5.3,
      material: stone,
      level: y,
      alongX: true,
      slate: true,
      pitch: 3.65,
      chimneys: [0.19, 0.78],
    },
    level,
  );
  house(out, [x0, start + 0.16, z0, z1 - 0.37], wing, level);
  house(out, [end - 0.13, x1, z0 + 0.09, z1 - 0.42], wing, level);
  if (level > 0) {
    const portico = [start + 1.2, end - 1.18, z0 - 2.0, z0 + 2.43];
    roof(out, portico, true, y + 3.3, 1.08, shades.slate, 'wood', level, 0);
    for (let i = 0; i < 5; i++) {
      const x = mix(portico[0] + 0.13, portico[1] - 0.13, i / 4);
      const z = portico[2] + 0.12;
      box(
        out,
        'wood',
        [x - 0.1, Math.min(y, groundAt(x, z)) - 0.22, z - 0.1],
        [x + 0.1, y + 3.3, z + 0.1],
        shades.ivory,
      );
    }
  }
  coveredWay(out, level);
  const range = {
    floors: 2,
    storey: 2.75,
    rise: 2.6,
    material: brick,
    level: groundAt(135, 25),
    alongX: false,
    slate: true,
    pitch: 2.7,
  };
  house(out, [134.1, 144.15, 2.3, 32.8], { ...range, chimneys: [0.18, 0.76] }, level);
  house(out, [116.8, 144, 32.8, 44.1], { ...range, alongX: true, chimneys: [0.21, 0.77] }, level);
  house(out, [109.3, 117.05, 31.5, 48.4], { ...range, floors: 1, storey: 3.7, rise: 1.8 }, level);
  house(out, [143.9, 149, 14.2, 29.8], { ...range, floors: 1, storey: 3.1, rise: 1.65 }, level);
}

function build(out, level) {
  factoryRanges(out, level);
  enclosure(out, level);
  girlsSchool(out, level);
}
export const parramattaSkyline = (out) => build(out, 0);
export const parramattaDistrict = (out) => build(out, 1);
export const parramattaStreet = (out) => build(out, 2);
export const parramattaCloseup = (out) => build(out, 3);
const recipe = 'parramatta-precinct-model.mjs';
const camera = [101, 125, 256],
  lookAt = [14, 3, -16];
export const parramattaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: parramattaCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: features.N01,
    outlines: ['C103', 'C111', 'C105', 'N01', 'N02', 'N03'].map((id) => features[id]),
    minimumCoverage: 0.91,
    basis:
      'Individual occupied footprints for the original factory ranges, dormitory and former Girls Home.',
  },
  brief:
    'The standing Parramatta Female Factory sandstone ranges and penitentiary enclosure, and the adjoining former school’s Georgian center, Victorian wings and covered passage.',
  camera,
  lookAt,
  sunDirection: [-60, 100, -58],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 2.1,
    cameraYaw: 0.58,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'factory-ranges-and-dormitory', position: [-135, 68, 87], lookAt: [-73, 2, -29] },
    { name: 'parramatta-girls-home', position: [138, 21, -94], lookAt: [116, 7, -32] },
    { name: 'covered-way-and-southwest-range', position: [73, 35, 58], lookAt: [127, 2.2, 13] },
    { name: 'sandstone-solitary-enclosure', position: [48, 17, -95], lookAt: [55, 3, -28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'parramatta-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'parramattaSkyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: {
      district: { export: 'parramattaDistrict', errorMeters: 0.53, surfaces },
      street: { export: 'parramattaStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'parramattaCloseup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original exterior geometry informed by Earle’s c1826 public-domain watercolour, heritage records, attributed OpenStreetMap and original Terrarium elevation.',
};
