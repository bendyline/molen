import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const controls = JSON.parse(
  fs.readFileSync(new URL('../native-map/clemson-memorial-site-controls.json', import.meta.url)),
);
const {
  foundation,
  pitchLength,
  pitchWidth,
  boardWidth,
  boardHeight,
  boardGap,
  southUpperDeckEstimate,
  northUpperDeckEstimate,
  westClubRoofEstimate,
} = plan.dimensions;
const materials = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96 },
  fascia: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  seats: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84, metallic: 0.06 },
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.08 },
  screen: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.83 },
};
const concrete = rgb('a7aba3');
const darkConcrete = rgb('8c928c');
const fascia = rgb('ccc9ba');
const seat = rgb('9d9f96');
const orangeSeat = rgb('b96e43');
const steel = rgb('515955');
const rail = rgb('969e96');
const brick = rgb('905951');
const brickShade = rgb('795450');
const glazing = rgb('526a72');
const screen = rgb('1f292e');
const grass = rgb('61864d');
const fieldA = rgb('5f8749');
const fieldB = rgb('638b4d');
const paintedOrange = rgb('b35c29');
const chalk = rgb('e0dfcc');
const fieldY = 0.3;

function box(out, slot, [x0, z0, x1, z1], low, high, color) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}

function oriented(out, slot, points, toward, tone) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = points.slice().reverse();
    n = normalFor(...points);
  }
  quad(out, slot, points, n, tone);
}

function horizontal(out, slot, x0, z0, x1, z1, y, tone) {
  oriented(
    out,
    slot,
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    [0, 1, 0],
    tone,
  );
}

function field(out, lod) {
  const dx = pitchLength / 2,
    dz = pitchWidth / 2;
  const grassWidth = 58.4;
  box(
    out,
    'concrete',
    [-64, -grassWidth / 2, 64, grassWidth / 2],
    foundation,
    fieldY - 0.045,
    darkConcrete,
  );
  horizontal(out, 'grass', -64, -grassWidth / 2, 64, grassWidth / 2, fieldY, grass);
  const stripes = lod === 0 ? 4 : 10;
  const playing = 45.72;
  for (let i = 0; i < stripes; i++) {
    const a = -playing + (2 * playing * i) / stripes;
    const b = -playing + (2 * playing * (i + 1)) / stripes;
    horizontal(out, 'grass', a, -dz, b, dz, fieldY + 0.012, i % 2 ? fieldA : fieldB);
  }
  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -dx : playing;
    const x1 = sign < 0 ? -playing : dx;
    horizontal(out, 'paint', x0, -dz, x1, dz, fieldY + 0.021, paintedOrange);
    horizontal(out, 'paint', sign * dx - 0.057, -dz, sign * dx + 0.057, dz, fieldY + 0.036, chalk);
    horizontal(out, 'paint', -dx, sign * dz - 0.08, dx, sign * dz + 0.08, fieldY + 0.036, chalk);
  }
  for (let i = -10; i <= 10; i += lod === 0 ? 2 : 1) {
    const x = i * 4.572;
    horizontal(out, 'paint', x - 0.056, -dz, x + 0.056, dz, fieldY + 0.036, chalk);
  }
  if (lod < 2) return;
  for (let i = -49; i <= 49; i++) {
    const x = i * 0.9144;
    if (i % 5 === 0) continue;
    for (const z of [-6.1, 6.1]) {
      horizontal(out, 'paint', x - 0.048, z - 0.28, x + 0.048, z + 0.28, fieldY + 0.037, chalk);
    }
  }
  for (const sign of [-1, 1]) {
    const end = sign * (dx + 1.64);
    const y = fieldY + 3.49;
    const t = rgb('d2b85e');
    beam(out, 'steel', [end, fieldY, 0], [end, y, 0], 0.14, 0.15, t);
    beam(out, 'steel', [end, y, -2.82], [end, y, 2.82], 0.085, 0.08, t);
    for (const z of [-2.82, 2.82]) {
      beam(out, 'steel', [end, y, z], [end, y + 5.7, z], 0.083, 0.083, t);
    }
  }
}

function sidelinePoint(t, f, section) {
  const [first, last] = section.span;
  const x = (first + (last - first) * f) * t + section.mid;
  const z =
    section.start + (section.end - section.start) * f - (section.curve + f * section.extra) * t * t;
  const y = section.low + (section.high - section.low) * f;
  return [x, y, z * section.sign];
}

function westPoint(t, f, section) {
  const [first, last] = section.span;
  const z = (first + (last - first) * f) * t;
  const x =
    section.start + (section.end - section.start) * f + (section.curve + f * section.extra) * t * t;
  return [x, section.low + (section.high - section.low) * f, z];
}

function seating(out, pose, spec, lod) {
  const rows = spec.rows[lod];
  const slots = spec.sections[lod];
  const point = (i, r) => pose(-1 + (2 * i) / slots, r / rows, spec);
  const stair = lod >= 2 ? Math.max(3, Math.floor(slots / 5)) : slots + 1;
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < slots; i++) {
      const a = point(i, row),
        b = point(i + 1, row),
        c = point(i + 1, row + 1),
        d = point(i, row + 1);
      const front = spec.direction;
      const p = [a[0], d[1], a[2]];
      const q = [b[0], c[1], b[2]];
      if (lod !== 0) {
        oriented(
          out,
          'concrete',
          [a, b, q, p],
          front,
          (i + row) % 4 === 0 ? darkConcrete : concrete,
        );
      }
      oriented(out, 'concrete', lod === 0 ? [a, b, c, d] : [p, q, c, d], [0, 1, 0], concrete);
      const aisle = (i + 1) % stair === 0;
      if (lod === 0 || aisle) continue;
      const y = d[1] + 0.057;
      const along = (h, k, s) => [h[0] + (k[0] - h[0]) * s, y, h[2] + (k[2] - h[2]) * s];
      const nearLeft = along(p, d, 0.17),
        nearRight = along(q, c, 0.17);
      const farLeft = along(p, d, lod === 1 ? 0.58 : 0.71),
        farRight = along(q, c, lod === 1 ? 0.58 : 0.71);
      const orange =
        (spec.kind === 'upper' && (i === 1 || i === slots - 2)) ||
        (spec.kind === 'west' && Math.abs(i - slots * 0.5) < slots * 0.17 && row > rows * 0.48);
      oriented(
        out,
        'seats',
        [nearLeft, nearRight, farRight, farLeft],
        [0, 1, 0],
        orange ? orangeSeat : seat,
      );
    }
  }
  const lip = Array.from({ length: slots + 1 }, (_, i) => point(i, rows));
  for (let i = 0; i < slots; i++) {
    const a = lip[i],
      b = lip[i + 1];
    const end = [-spec.direction[0], 0, -spec.direction[2]];
    const bottomY = spec.rimFloor ?? Math.max(2.4, spec.low - 1.65);
    oriented(
      out,
      'concrete',
      [a, b, [b[0], bottomY, b[2]], [a[0], bottomY, a[2]]],
      end,
      darkConcrete,
    );
    if (spec.kind === 'upper' && lod >= 1) {
      const front = [point(i, 0), point(i + 1, 0)];
      const lower = ([x, y, z]) => [x, y - 1.42, z];
      oriented(
        out,
        'concrete',
        [lower(front[0]), lower(front[1]), lower(b), lower(a)],
        [0, -1, 0],
        darkConcrete,
      );
    }
  }
  if (lod >= 2) {
    beamPath(
      out,
      'steel',
      lip.map(([x, y, z]) => [x, y + 0.86, z]),
      0.07,
      0.084,
      rail,
    );
    for (let i = 0; i < lip.length; i += lod === 3 ? 2 : 3) {
      const [x, y, z] = lip[i];
      beam(out, 'steel', [x, y, z], [x, y + 0.86, z], 0.06, 0.06, rail);
    }
  }
}

function pressBand(out, sign, lod) {
  const z0 = sign > 0 ? 60.8 : -68.1;
  const z1 = sign > 0 ? 68.1 : -60.8;
  const cap = sign > 0 ? 19.9 : 18.68;
  box(out, 'concrete', [-67, z0, 67, z1], 15.23, cap, fascia);
  const face = facade([0, sign * 60.8], [-sign, 0]);
  fbox(out, 'glass', face, -63.6, 63.6, cap - 3.42, cap - 0.48, 0.027, 0.115, glazing);
  if (lod >= 2) {
    for (let x = -63; x <= 63; x += 4.5)
      fbox(out, 'fascia', face, x - 0.082, x + 0.082, cap - 3.48, cap - 0.32, 0.11, 0.21, fascia);
  }
  if (sign === 1) {
    box(out, 'concrete', [-36, 61.08, 36, 70.12], cap - 0.2, 24.26, fascia);
    const center = facade([0, 61.08], [-1, 0]);
    fbox(out, 'glass', center, -32.8, 32.8, 20.45, 23.57, 0.018, 0.12, glazing);
    if (lod >= 2)
      for (let x = -32; x <= 32; x += 3.7)
        fbox(out, 'fascia', center, x - 0.093, x + 0.093, 20.37, 23.79, 0.1, 0.17, fascia);
  }
}

function sidelineDecks(out, lod) {
  for (const sign of [-1, 1]) {
    const inward = [0, 0, -sign];
    seating(
      out,
      sidelinePoint,
      {
        sign,
        kind: 'lower',
        start: 39.75,
        end: 64.23,
        curve: 12.5,
        extra: 2.15,
        span: [62.5, 75.5],
        low: 0.82,
        high: 16.78,
        mid: 0,
        rows: [2, 9, 21, 32],
        sections: [9, 9, 19, 29],
        direction: inward,
        rimFloor: 2.35,
      },
      lod,
    );
    pressBand(out, sign, lod);
    const high = sign === 1 ? southUpperDeckEstimate : northUpperDeckEstimate;
    const deck = {
      sign,
      kind: 'upper',
      start: 69.4,
      end: sign > 0 ? 111.2 : 117.15,
      curve: 4.05,
      extra: 10.6,
      span: [65.1, 87.0],
      low: sign > 0 ? 23.7 : 21.0,
      high,
      mid: sign > 0 ? -1.0 : -0.3,
      rows: [3, 7, 15, 23],
      sections: [11, 9, 21, 31],
      direction: inward,
      rimFloor: high - 1.42,
    };
    seating(out, sidelinePoint, deck, lod);
    for (const t of lod === 0
      ? [-0.62, 0, 0.62]
      : [-0.82, -0.62, -0.41, -0.21, 0, 0.21, 0.41, 0.62, 0.82]) {
      const [x, y, z] = sidelinePoint(t, 0.76, deck);
      box(out, 'concrete', [x - 1.06, z - 1.06, x + 1.06, z + 1.06], 10.15, y - 1.28, darkConcrete);
      if (lod >= 2) {
        const a = sidelinePoint(t, 0.36, deck);
        beam(out, 'concrete', [x, y - 6.0, z], [a[0], a[1] - 1.47, a[2]], 0.94, 1.11, concrete);
      }
    }
  }
}

function westClub(out, lod) {
  seating(
    out,
    westPoint,
    {
      kind: 'west',
      start: -65.4,
      end: -104.1,
      span: [23.5, 55.4],
      curve: 4.8,
      extra: 5.65,
      low: 0.65,
      high: 18.44,
      rows: [2, 6, 15, 24],
      sections: [7, 8, 17, 23],
      direction: [1, 0, 0],
      rimFloor: -0.9,
    },
    lod,
  );
  const zLimit = lod === 0 ? 35 : 42.8;
  const chunks = [4, 6, 8, 8][lod];
  const top = westClubRoofEstimate;
  const outer = (z) => -133.54 + 0.00234 * z * z;
  for (let i = 0; i < chunks; i++) {
    const z0 = -zLimit + (2 * zLimit * i) / chunks;
    const z1 = -zLimit + (2 * zLimit * (i + 1)) / chunks;
    const a = [outer(z0), z0],
      b = [outer(z1), z1];
    const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    fbox(out, 'brick', f, 0, length, foundation, top, -11.5, 0, i % 2 ? brickShade : brick);
    for (const y of [4.8, 12.6, 19.9, top - 0.67]) {
      if (lod === 0 && y !== top - 0.67) continue;
      fbox(out, 'fascia', f, 0, length, y, y + 0.64, -0.08, 0.22, fascia);
    }
    if (lod >= 1) {
      for (const y of [7.0, 14.9, 21.54]) {
        fbox(out, 'glass', f, 0.95, length - 0.9, y, y + 3.55, 0.005, 0.095, glazing);
        if (lod >= 2)
          for (let u = 1.67; u < length - 1.0; u += 1.42)
            fbox(out, 'fascia', f, u - 0.052, u + 0.052, y - 0.05, y + 3.58, 0.091, 0.15, fascia);
      }
      fbox(out, 'brick', f, 0.07, 0.92, 0.5, top + 0.43, 0.03, 0.36, brick);
    }
  }
  box(out, 'brick', [-121.35, -37, -103.5, 39], foundation, top - 0.32, brickShade);
  box(out, 'fascia', [-123.1, -38.5, -102.7, 40.8], top - 0.32, top, fascia);
  if (lod < 1) return;
  const f = facade([-103.5, 0], [0, -1]);
  fbox(out, 'glass', f, -36.6, 36.6, 19.3, 24.8, 0.06, 0.14, glazing);
  fbox(out, 'fascia', f, -36.85, 37.2, 25.0, 25.55, 0.1, 0.5, fascia);
  for (const z of [-48, 47]) {
    box(out, 'brick', [-119, z - 7, -98, z + 7], foundation, 22.75, brick);
    box(out, 'fascia', [-119.5, z - 7.4, -97.63, z + 7.4], 22.69, 23.37, fascia);
    box(out, 'screen', [-100.1, z - 5.35, -97.28, z + 5.35], 23.1, 28.48, screen);
  }
}

function eastEnd(out, lod) {
  for (const sign of [-1, 1]) {
    const pts =
      sign > 0
        ? [
            [61, 24],
            [70, 28],
            [80, 32],
            [89, 22],
          ]
        : [
            [89, -22],
            [80, -32],
            [70, -28],
            [61, -24],
          ];
    const direction = [-0.72, 0, -0.35 * sign];
    const groups = [2, 4, 9, 9][lod];
    for (let i = 0; i < groups; i++) {
      const t = i / groups;
      const u = (i + 1) / groups;
      const y = 0.95 + i * 0.84 * (9 / groups);
      for (let n = 1; n < pts.length; n++) {
        const [a, b] = pts.slice(n - 1, n + 1);
        const e = (p, f) => [p[0] + f * 13, y, p[1] + sign * f * 2.24];
        const nearA = e(a, t),
          nearB = e(b, t),
          farA = e(a, u),
          farB = e(b, u);
        oriented(
          out,
          'concrete',
          [nearA, nearB, farB, farA],
          [0, 1, 0],
          i % 4 === 0 ? seat : concrete,
        );
        oriented(
          out,
          'concrete',
          [
            nearA,
            nearB,
            [nearB[0], y - 0.84 * (9 / groups), nearB[2]],
            [nearA[0], y - 0.84 * (9 / groups), nearA[2]],
          ],
          direction,
          darkConcrete,
        );
      }
    }
  }
  const hill = [
    [
      [63.7, 0.53, -20.8],
      [63.7, 0.53, 20.6],
    ],
    [
      [72.2, 2.25, -20],
      [72.2, 2.25, 20.4],
    ],
    [
      [82.5, 5.41, -18.9],
      [82.5, 5.41, 19.2],
    ],
    [
      [92.7, 8.23, -16.7],
      [92.7, 8.23, 16.1],
    ],
  ];
  for (let j = 1; j < hill.length; j++) {
    const [a, b] = hill[j - 1];
    const [c, d] = hill[j];
    oriented(out, 'grass', [a, b, d, c], [0, 1, 0], grass);
    for (const [p, q] of [
      [a, c],
      [b, d],
    ]) {
      oriented(
        out,
        'brick',
        [p, q, [q[0], 0.2, q[2]], [p[0], 0.2, p[2]]],
        [0, 0, Math.sign(p[2])],
        brick,
      );
    }
  }
  const rock = controls.eastRock.local;
  box(
    out,
    'fascia',
    [rock[0] - 0.7, rock[1] - 0.53, rock[0] + 0.65, rock[1] + 0.54],
    7.79,
    9.8,
    fascia,
  );
  if (lod >= 1) {
    const sections = [
      [9.8, 0.48],
      [10.1, 0.61],
      [10.41, 0.42],
      [10.55, 0.17],
    ];
    lathe(
      out,
      'concrete',
      rock,
      sections.map(([y, r]) => [y, r, r]),
      9,
      darkConcrete,
    );
  }
  const x = 98.75;
  const bottom = 8.16 + boardGap;
  const top = bottom + boardHeight;
  const edge = boardWidth / 2;
  box(
    out,
    'steel',
    [x - 0.79, -edge - 0.53, x + 2.32, edge + 0.53],
    bottom - 0.44,
    top + 0.7,
    steel,
  );
  box(out, 'screen', [x - 0.96, -edge, x - 0.77, edge], bottom, top, screen);
  for (const z of [-13.87, 13.87]) {
    box(
      out,
      'concrete',
      [x + 0.58, z - 1.34, x + 3.44, z + 1.34],
      5.7,
      bottom + 2.18,
      darkConcrete,
    );
    if (lod >= 2) {
      beam(
        out,
        'steel',
        [x + 2.32, bottom + 0.18, z],
        [x + 3.32, top - 1.16, z - 4.4],
        0.8,
        0.78,
        steel,
      );
      beam(
        out,
        'steel',
        [x + 2.32, bottom + 0.18, z],
        [x + 3.32, top - 1.16, z + 4.4],
        0.8,
        0.78,
        steel,
      );
    }
  }
  if (lod === 3) {
    for (let z = -edge + 0.6; z < edge; z += 3.12) {
      box(out, 'steel', [x + 2.33, z - 0.1, x + 2.49, z + 0.1], bottom - 0.12, top + 0.14, rail);
    }
  }
}

function lights(out, lod) {
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    for (const [i, x] of [-59.8, -22.1, 27.0, 65.0].entries()) {
      const z = sign * (sign > 0 ? 96.68 : 101.18) - sign * (i % 3 === 0 ? 8.2 : 0);
      const y = sign > 0 ? southUpperDeckEstimate : northUpperDeckEstimate;
      const top = y + (i % 3 === 0 ? 11.2 : 8.7);
      beam(out, 'steel', [x, y - 4.8, z], [x, top, z], 0.52, 0.5, steel);
      box(out, 'steel', [x - 1.73, z - 0.34, x + 1.73, z + 0.34], top - 0.72, top + 0.76, steel);
      if (lod >= 2)
        for (const dx of [-1.13, 0.0, 1.13]) {
          box(
            out,
            'fascia',
            [x + dx - 0.4, z - sign * 0.46 - 0.11, x + dx + 0.4, z - sign * 0.46 + 0.11],
            top - 0.44,
            top + 0.45,
            fascia,
          );
        }
    }
  }
}

function build(out, lod) {
  const outline = frame.geometry.outline;
  const hole = frame.geometry.holes;
  extrude(out, 'brick', outline, foundation, 8.17, brickShade, { top: false, holes: hole });
  field(out, lod);
  sidelineDecks(out, lod);
  westClub(out, lod);
  eastEnd(out, lod);
  lights(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'memorial-stadium-clemson-model.mjs';
const camera = [235, 140, 222];
const lookAt = [-4, 9.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'sports',
  surfaces: materials,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Clemson Memorial Stadium with Frank Howard Field, the twin upper decks, the WestZone and East Hill scoreboard.',
  camera,
  lookAt,
  sunDirection: [63, 65, 58],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.93,
    basis: 'Named stadium grandstand perimeter including attached WestZone.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(materials).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs', 'structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'open-bowl-and-east-hill', position: camera, lookAt },
    { name: 'westzone-brick-and-glass', position: [-186, 39, 45], lookAt: [-110, 14, 0] },
    { name: 'field-tiers-and-east-videoboard', position: [-64, 35, 30], lookAt: [66, 11, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'memorial-stadium-clemson-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.13,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces: materials },
      street: { export: 'street', errorMeters: 0.16, surfaces: materials },
      closeup: { export: 'closeup', errorMeters: 0.068, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation tiles.',
};
