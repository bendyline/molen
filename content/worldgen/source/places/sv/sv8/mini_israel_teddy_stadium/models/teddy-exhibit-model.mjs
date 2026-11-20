import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  plinth: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  risers: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  shell: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.05 },
  seats: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0 },
  field: { slot: 'foundation', localRef: 'palette:#ffffff', name: 'miniature turf', roughness: 1 },
};

const ref = 'palette:#ffffff';
const ivory = [0.73, 0.69, 0.61];
const cement = [0.55, 0.53, 0.49];
const walkway = [0.56, 0.39, 0.35];
const roof = [0.68, 0.65, 0.57];
const steel = [0.49, 0.49, 0.45];
const line = [0.81, 0.81, 0.68];
const seatColors = [
  [0.21, 0.38, 0.52],
  [0.27, 0.43, 0.37],
  [0.64, 0.58, 0.45],
  [0.52, 0.31, 0.27],
  [0.27, 0.33, 0.43],
];

const bend = -1.34;
const mouth = 2.59;
const deck = 0.12;
const turf = 0.157;
// The long stands wrap around the closed end and terminate at the open end.
function rowPoint(station, radius, y) {
  if (station < 1) return [mouth + (bend - mouth) * station, y, radius];
  if (station > 2) return [bend + (mouth - bend) * (station - 2), y, -radius];
  const angle = (station - 1) * Math.PI;
  return [bend - radius * Math.sin(angle), y, radius * Math.cos(angle)];
}

function stations(straights, arc) {
  const samples = [];
  for (let i = 0; i < straights; i++) samples.push(i / straights);
  for (let i = 0; i < arc; i++) samples.push(1 + i / arc);
  for (let i = 0; i <= straights; i++) samples.push(2 + i / straights);
  return samples;
}

function face(out, slot, points, color, reverse = false) {
  const oriented = reverse ? [...points].reverse() : points;
  out.addQuad(slot, ref, oriented, normalFor(...oriented), [], color);
}

function band(out, slot, marks, a, ya, b, yb, color, reverse = false) {
  for (let i = 1; i < marks.length; i++) {
    const prev = marks[i - 1];
    const next = marks[i];
    face(
      out,
      slot,
      [rowPoint(prev, a, ya), rowPoint(next, a, ya), rowPoint(next, b, yb), rowPoint(prev, b, yb)],
      typeof color === 'function' ? color((prev + next) / 2) : color,
      reverse,
    );
  }
}

export function exhibitOutline() {
  return [
    ...stations(1, 12)
      .slice(1, -1)
      .map((mark) => rowPoint(mark, 3.24, 0)),
    [2.77, 0, -3.24],
    [2.77, 0, 3.24],
  ].reverse();
}

function platform(out) {
  const outline = exhibitOutline();
  loft(
    out,
    'plinth',
    [-0.37, deck].map((y) => outline.map(([x, , z]) => [x, y, z])),
    ivory,
  );
}

function pitch(out, level) {
  const stripes = level ? 7 : 1;
  const width = 4.2 / stripes;
  for (let i = 0; i < stripes; i++) {
    const x = -2.1 + i * width;
    const color = i % 2 ? [0.3, 0.4, 0.22] : [0.34, 0.455, 0.25];
    box(out, 'field', [x, deck, -1.36], [x + width, turf, 1.36], color);
  }
  const stripe = (x0, z0, x1, z1) =>
    box(out, 'field', [x0, turf, z0], [x1, turf + 0.003, z1], line);
  for (const z of [-1.308, 1.295]) stripe(-2.051, z, 2.051, z + 0.013);
  for (const x of [-2.051, -0.007, 2.038]) stripe(x, -1.295, x + 0.013, 1.295);
  if (!level) return;
  for (const side of [-1, 1]) {
    for (const [depth, half] of [
      [0.66, 0.806],
      [0.22, 0.366],
    ]) {
      const x = side * (2.045 - depth);
      stripe(x - 0.006, -half, x + 0.006, half);
      for (const z of [-half, half])
        stripe(Math.min(x, side * 2.045), z - 0.006, Math.max(x, side * 2.045), z + 0.006);
    }
    const x = side * 2.06;
    for (const z of [-0.146, 0.146])
      beam(out, 'seats', [x, turf, z], [x, turf + 0.097, z], 0.015, 0.015, line);
    beam(out, 'seats', [x, turf + 0.097, -0.153], [x, turf + 0.097, 0.153], 0.015, 0.015, line);
  }
  const circleSides = level === 1 ? 12 : 28;
  const circle = (i, radius) => {
    const a = (i * Math.PI * 2) / circleSides;
    return [radius * Math.cos(a), turf + 0.004, radius * Math.sin(a)];
  };
  for (let i = 0; i < circleSides; i++)
    face(
      out,
      'field',
      [circle(i, 0.36), circle(i, 0.373), circle(i + 1, 0.373), circle(i + 1, 0.36)],
      line,
      true,
    );
}

function seatShade(mark, row) {
  const group = Math.floor(mark * 11);
  return seatColors[(group + Math.floor(row / 3) + (group % 2)) % seatColors.length];
}

function tiers(out, level) {
  const marks = stations(level >= 2 ? 16 : level ? 5 : 1, level >= 2 ? 22 : level ? 12 : 8);
  const boundaryMarks = stations(1, level ? 12 : 8);
  band(out, 'risers', boundaryMarks, 1.46, deck, 1.71, deck + 0.014, walkway);
  band(out, 'risers', boundaryMarks, 1.71, deck, 1.71, 0.47, ivory);
  band(out, 'risers', boundaryMarks, 3.16, deck, 3.16, 1.22, ivory, true);
  const count = level >= 2 ? 8 : level ? 5 : 2;
  for (const [start, finish, foot, highest] of [
    [1.71, 2.26, 0.47, 0.81],
    [2.46, 3.16, 0.81, 1.22],
  ]) {
    const run = (finish - start) / count;
    const rise = (highest - foot) / count;
    for (let row = 0; row < count; row++) {
      const a = start + run * row;
      const b = a + run;
      const y = foot + rise * row;
      band(out, 'risers', boundaryMarks, a, y, a, y + rise, cement);
      band(out, 'seats', marks, a, y + rise, b, y + rise, (mark) => {
        if (level >= 2 && Math.abs(((mark * 4) % 1) - 0.5) < 0.075) return cement;
        return seatShade(mark, row);
      });
    }
  }
  band(out, 'risers', boundaryMarks, 2.26, 0.81, 2.46, 0.81, walkway);
  for (const end of [0, 3]) {
    for (const [a, b, y] of [
      [1.71, 2.26, 0.79],
      [2.26, 2.46, 0.81],
      [2.46, 3.16, 1.19],
    ])
      face(
        out,
        'risers',
        [
          rowPoint(end, b, deck),
          rowPoint(end, a, deck),
          rowPoint(end, a, y - 0.2),
          rowPoint(end, b, y),
        ],
        ivory,
        end === 3,
      );
  }
}

function canopy(out, level) {
  const marks = stations(level >= 2 ? 12 : level ? 4 : 1, level >= 2 ? 22 : level ? 12 : 8);
  const profile = [
    [2.62, 1.57],
    [2.8, 1.545],
    [2.98, 1.427],
    [3.21, 1.31],
  ];
  for (let i = 1; i < profile.length; i++) {
    const [a, ya] = profile[i - 1];
    const [b, yb] = profile[i];
    band(out, 'shell', marks, a, ya, b, yb, roof);
    band(out, 'shell', marks, a, ya - 0.017, b, yb - 0.017, cement, true);
  }
  const supports = level >= 2 ? marks : stations(2, 6);
  for (const s of supports) {
    beam(out, 'seats', rowPoint(s, 3.12, 1.18), rowPoint(s, 3.15, 1.35), 0.026, 0.027, steel);
    if (level < 2) continue;
    for (let i = 1; i < profile.length; i++) {
      const [a, ya] = profile[i - 1];
      const [b, yb] = profile[i];
      beam(
        out,
        'seats',
        rowPoint(s, a, ya + 0.007),
        rowPoint(s, b, yb + 0.007),
        0.012,
        0.013,
        ivory,
      );
    }
  }
}

function details(out, level) {
  if (level === 0) return;
  for (const x of [-0.69, 0.69]) {
    box(out, 'seats', [x - 0.56, 0.15, 1.48], [x + 0.56, 0.26, 1.53], cement);
    box(out, 'shell', [x - 0.59, 0.256, 1.41], [x + 0.59, 0.282, 1.56], roof);
  }
  if (level < 2) return;
  for (const s of [0.16, 0.5, 0.83, 1.28, 1.72, 2.2, 2.51, 2.85]) {
    for (const offset of [-0.018, 0.018]) {
      const mark = s + offset;
      beam(
        out,
        'risers',
        rowPoint(mark, 2.19, 0.856),
        rowPoint(mark, 2.43, 0.933),
        0.038,
        0.047,
        ivory,
      );
    }
    band(out, 'seats', [s - 0.02, s + 0.02], 2.47, 0.815, 2.47, 0.93, [0.18, 0.19, 0.17]);
  }
  if (level < 3) return;
  // Sculpted seat backs interrupt the continuous colored bands in the closer views.
  for (let i = 1; i < 127; i++) {
    const s = (i * 3) / 127;
    if (Math.abs(((s * 4) % 1) - 0.5) < 0.075) continue;
    for (let row = 0; row < 8; row++) {
      for (const [r, y, depth] of [
        [1.744, 0.511, 0.06875],
        [2.503, 0.86, 0.0875],
      ]) {
        const radius = r + row * depth;
        const top = y + row * (depth < 0.08 ? 0.0425 : 0.05125);
        band(
          out,
          'seats',
          [s - 0.0076, s + 0.0076],
          radius,
          top,
          radius,
          top + 0.025,
          seatShade(s, row),
        );
      }
    }
  }
}

function build(out, level) {
  platform(out);
  pitch(out, level);
  tiers(out, level);
  canopy(out, level);
  details(out, level);
}

export const buildTeddyExhibit = (out) => build(out, 4);
export const buildCloseup = (out) => build(out, 3);
export const buildStreet = (out) => build(out, 2);
export const buildDistrict = (out) => build(out, 1);
export const buildSkyline = (out) => build(out, 0);
