import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtyardWalls,
  gates,
  inferredPartitions,
  perimeter,
  plan,
  point,
  roofing,
  tracedPartitions,
} from './esagila-plan.mjs';

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  gilding: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.62 },
};

const ref = 'palette:#ffffff';
const cream = [0.76, 0.69, 0.52];
const limestone = [0.62, 0.55, 0.41];
const earthen = [0.518, 0.417, 0.283];
const fired = [0.568, 0.364, 0.215];
const asphalt = [0.17, 0.164, 0.137];
const timber = [0.235, 0.153, 0.091];
const gilded = [0.64, 0.469, 0.153];
const shade = (color, f) => color.map((v) => v * f);
const face = (out, key, p, color) => out.addQuad(key, ref, p, normalFor(...p), [], color);
const tri = (out, key, p, color) => out.addTriangle(key, ref, p, normalFor(...p), [], color);

function floorPlate(out, pixels, y, key, color, thickness = 0.08) {
  const [a, b, c, d] = pixels;
  const [x, z] = point(a, b),
    [ex, ez] = point(c, d);
  box(out, key, [x, y - thickness, z], [ex, y, ez], color);
}

function linearFrame(out, row, inside = 0) {
  const [a, b, depth, doorSpans] = row;
  const [x, z] = point(...a),
    [ex, ez] = point(...b);
  const length = Math.hypot(ex - x, ez - z);
  const vertical = a[0] === b[0],
    heading = vertical ? -Math.PI / 2 : 0;
  const position = [
    x + Math.sin(heading) * depth * inside * 0.5,
    0,
    z + Math.cos(heading) * depth * inside * 0.5,
  ];
  const scale = length / (vertical ? b[1] - a[1] : b[0] - a[0]);
  const span = doorSpans.map(([lo, hi]) => [lo, hi].map((v) => (v - a[vertical ? 1 : 0]) * scale));
  return { out: transform(out, heading, position), length, depth, span };
}

function openingRoof(out, a, b, depth, crown, height, detail, color) {
  const spring = crown - (b - a) * 0.17;
  if (!detail.curved) {
    box(out, 'plaster', [a, crown, -depth / 2], [b, height, depth / 2], color);
    return;
  }
  box(out, 'plaster', [a, crown + 0.055, -depth / 2], [b, height, depth / 2], color);
  const parts = detail.arch;
  const arc = (t) => [a + (b - a) * t, spring + (crown - spring) * Math.sin(Math.PI * t)];
  for (let i = 0; i < parts; i++) {
    const [x, y] = arc(i / parts),
      [ex, ey] = arc((i + 1) / parts);
    for (const side of [-1, 1]) {
      const z = (depth / 2) * side;
      const p = [
        [x, y, z],
        [ex, ey, z],
        [ex, crown + 0.055, z],
        [x, crown + 0.055, z],
      ];
      face(out, 'plaster', side > 0 ? p : p.reverse(), color);
    }
    face(
      out,
      'plaster',
      [
        [x, y, -depth / 2],
        [ex, ey, -depth / 2],
        [ex, ey, depth / 2],
        [x, y, depth / 2],
      ],
      shade(color, 0.85),
    );
  }
}

function runWall(out, row, height, detail, { outside = 0, trim = false, courtyard = false } = {}) {
  const { out: wall, length, depth, span } = linearFrame(out, row, outside);
  const half = depth / 2;
  const color = shade(cream, 0.96 + 0.037 * Math.cos(length * 1.25));
  let start = 0;
  for (const [a, b] of span) {
    box(wall, 'plaster', [start, -0.2, -half], [a, height, half], color);
    const crown = trim ? 4.82 : courtyard ? 4.32 : 3.21;
    openingRoof(
      wall,
      a,
      b,
      depth,
      crown,
      height,
      trim || courtyard || detail.joinery ? detail : { curved: false },
      color,
    );
    if (detail.joinery) {
      const h = detail.curved ? crown - (b - a) * 0.17 : crown;
      for (const x of [a, b]) {
        box(
          wall,
          'plaster',
          [x - 0.14, 0, -half - 0.17],
          [x + 0.14, h, half + 0.17],
          shade(color, 0.91),
        );
        box(wall, 'brick', [x - 0.21, 0.03, -half - 0.23], [x + 0.21, 0.22, half + 0.23], fired);
      }
    }
    start = b;
  }
  box(wall, 'plaster', [start, -0.2, -half], [length, height, half], color);
  if (!trim && !(courtyard && detail.joinery)) return;
  const toward = outside >= 0 ? -1 : 1;
  const z = toward * half;
  const cadence = courtyard ? 8.7 : detail.pierPitch;
  const count = Math.ceil(length / cadence),
    pitch = length / count;
  const toe = z + toward * (courtyard ? 0.19 : 0.57),
    edge = z - toward * 0.025;
  for (let i = 0; i < count; i++) {
    const x = pitch * (i + 0.5);
    if (span.some(([a, b]) => x > a - 1.14 && x < b + 1.14)) continue;
    const w = detail.joinery ? 0.94 : 0.79;
    box(
      wall,
      'plaster',
      [x - w, 0, Math.min(edge, toe)],
      [x + w, height - 0.025, Math.max(edge, toe)],
      shade(color, 0.93 + 0.044 * Math.sin(i * 1.81)),
    );
    const base = z + toward * (courtyard ? 0.22 : 0.66);
    if (detail.joinery)
      box(
        wall,
        'brick',
        [x - w - 0.035, 0, Math.min(edge, base)],
        [x + w + 0.035, 0.33, Math.max(edge, base)],
        shade(fired, 0.84),
      );
  }
  if (detail.joinery) {
    const stations = [0, ...span.flat(), length];
    for (let i = 0; i < stations.length - 1; i += 2) {
      const min = stations[i],
        max = stations[i + 1];
      if (max - min < 0.21) continue;
      const dz = z + toward * 0.055;
      const y = 0.28;
      const p = [
        [min, 0.055, dz],
        [max, 0.055, dz],
        [max, y, dz],
        [min, y, dz],
      ];
      face(wall, 'brick', toward > 0 ? p : p.reverse(), shade(fired, 0.85));
    }
  }
}

function roofs(out, detail) {
  for (const [i, rect] of roofing.entries()) {
    const height = i < 4 ? 10.72 : 9.67;
    if (detail.skyline) {
      const [l, t, r, b] = rect,
        [x, z] = point(l, t),
        [ex, ez] = point(r, b);
      face(
        out,
        'roof',
        [
          [x, height, ez],
          [ex, height, ez],
          [ex, height, z],
          [x, height, z],
        ],
        earthen,
      );
      continue;
    }
    floorPlate(out, rect, height, 'roof', shade(earthen, 0.92 + 0.063 * Math.cos(i * 1.21)), 0.41);
    if (!detail.joinery) continue;
    const [l, t, r, b] = rect;
    const [x, z] = point(l, t),
      [xx, zz] = point(r, b);
    // Rainwater guides and roof settling breaks sit nearly flush with the packed surface.
    for (const f of [0.27, 0.53, 0.78]) {
      const station = x + (xx - x) * f;
      box(
        out,
        'roof',
        [station - 0.043, height - 0.018, z + 0.26],
        [station + 0.043, height + 0.012, zz - 0.26],
        shade(earthen, 0.79),
      );
    }
  }
}

function courts(out, detail) {
  const c = plan.courtyard;
  for (const [j, court] of [
    [c.west, c.north, c.east, c.south],
    [453, 246, 698, 390],
    [536, 444, 693, 548],
  ].entries()) {
    floorPlate(out, court, 0.023, 'brick', shade(fired, 0.85 + 0.06 * j));
    if (!detail.joinery) continue;
    const [a, b, c, d] = court,
      [x, z] = point(a, b),
      [ex, ez] = point(c, d);
    const n = Math.round((ex - x) / 3.4);
    for (let i = 0; i < n; i++) {
      const a = x + (i * (ex - x)) / n + 0.022,
        b = x + ((i + 1) * (ex - x)) / n - 0.022;
      const y = 0.031;
      const material = shade(fired, 0.94 + 0.052 * Math.sin(i * 2.3 + j * 0.98));
      face(
        out,
        'brick',
        [
          [a, y, ez],
          [b, y, ez],
          [b, y, z],
          [a, y, z],
        ],
        material,
      );
    }
  }
}

function portalTowers(out, detail) {
  for (const [i, gate] of gates.entries()) {
    const at = (gate.span[0] + gate.span[1]) / 2;
    const [x, z] = gate.axis === 'z' ? point(at, gate.along) : point(gate.along, at);
    const heading = gate.axis === 'x' ? (Math.PI / 2) * gate.side : gate.side === 1 ? 0 : Math.PI;
    const entry = transform(out, heading, [x, 0, z]);
    const width =
      gate.axis === 'z'
        ? point(gate.span[1], 0)[0] - point(gate.span[0], 0)[0]
        : point(0, gate.span[1])[1] - point(0, gate.span[0])[1];
    const towerTop = i < 3 || i === 6 ? 12.9 : 11.6;
    for (const side of [-1, 1]) {
      const cx = side * (width * 0.5 + 1.37);
      box(entry, 'plaster', [cx - 1.34, -0.18, -1.25], [cx + 1.34, towerTop, 1.05], cream);
      if (detail.skyline) continue;
      box(
        entry,
        'plaster',
        [cx - 1.48, towerTop - 0.19, -1.39],
        [cx + 1.48, towerTop + 0.02, 1.17],
        shade(cream, 0.98),
      );
      if (detail.joinery) {
        for (const offset of [-0.69, 0.69])
          box(
            entry,
            'plaster',
            [cx + offset - 0.19, 0.3, 1.02],
            [cx + offset + 0.19, towerTop - 0.42, 1.24],
            shade(limestone, 1.11),
          );
      }
    }
    if (!detail.joinery) continue;
    const crown = 4.82;
    // Painted lintel sockets and timber jambs make a legible threshold in close view.
    for (const side of [-1, 1]) {
      const cx = side * (width * 0.48);
      beam(entry, 'timber', [cx, 0.15, 0.32], [cx, crown * 0.8, 0.32], 0.125, 0.14, timber);
    }
    box(
      entry,
      'brick',
      [-width * 0.42, -0.012, 0.12],
      [width * 0.42, 0.082, 1.36],
      shade(fired, 0.93),
    );
  }
}

function sanctuary(out, detail) {
  // The excavations did not determine the extent of the western cella.
  // This room marks the interpreted sanctuary and the documented material contrast.
  if (!detail.inside) return;
  floorPlate(out, [139, 247, 226, 390], 0.041, 'paving', asphalt);
  floorPlate(out, [146, 292, 166, 341], 0.52, 'brick', shade(fired, 0.79), 0.48);
  floorPlate(out, [148, 299, 165, 334], 0.62, 'paving', shade(limestone, 0.86), 0.1);
  if (!detail.joinery) return;
  const [x, z] = point(142, 295),
    [, end] = point(142, 337);
  box(out, 'gilding', [x, 0.65, z], [x + 0.104, 3.31, end], gilded);
  for (let i = 0; i < 8; i++) {
    const p = z + ((i + 0.5) * (end - z)) / 8;
    box(
      out,
      'gilding',
      [x + 0.095, 0.75, p - 0.045],
      [x + 0.152, 3.17, p + 0.045],
      shade(gilded, 0.82 + 0.08 * Math.sin(i)),
    );
  }
}

const detail = {
  skyline: { curved: false, joinery: false, inside: false, skyline: true, pierPitch: 43 },
  district: { curved: true, arch: 4, joinery: false, inside: true, pierPitch: 8.4 },
  street: { curved: true, arch: 7, joinery: true, inside: true, pierPitch: 5.5 },
  closeup: { curved: true, arch: 12, joinery: true, inside: true, pierPitch: 5.5 },
  master: { curved: true, arch: 16, joinery: true, inside: true, pierPitch: 5.5 },
};

export function buildEsagila(out, level) {
  const settings = detail[level];
  floorPlate(out, [103, 149, 408, 488], 0, 'brick', shade(fired, 0.86), 0.59);
  floorPlate(out, [408, 149, 752, 458], 0, 'brick', shade(fired, 0.86), 0.59);
  floorPlate(out, [469, 458, 752, 607], 0, 'brick', shade(fired, 0.88), 0.59);
  const side = [1, -1, -1, 1, 1, -1, -1, -1, 1];
  for (const [i, wall] of perimeter.entries()) {
    runWall(out, wall, i < 3 || i === 8 ? 11.21 : 10.01, settings, {
      outside: side[i],
      trim: true,
    });
  }
  const courtFace = [-1, 1, -1, 1];
  for (const [i, wall] of courtyardWalls.entries())
    runWall(out, wall, 11.04, settings, { outside: courtFace[i], courtyard: true });
  if (settings.inside) {
    for (const wall of tracedPartitions) runWall(out, wall, 10.46, settings);
    for (const wall of inferredPartitions)
      runWall(out, wall, wall[0][0] > 408 ? 9.47 : 10.46, settings);
  }
  roofs(out, settings);
  courts(out, settings);
  portalTowers(out, settings);
  sanctuary(out, settings);
}

export const buildSkyline = (out) => buildEsagila(out, 'skyline');
export const buildDistrict = (out) => buildEsagila(out, 'district');
export const buildStreet = (out) => buildEsagila(out, 'street');
export const buildCloseup = (out) => buildEsagila(out, 'closeup');
