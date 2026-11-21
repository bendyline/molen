import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  plinth: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 },
  track: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91 },
  steel: { slot: 'roof', graph: 'metal_painted', roughness: 0.84 },
  field: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'Miniature turf and lines',
    roughness: 1,
  },
};

const ref = 'palette:#ffffff';
const stone = [0.48, 0.43, 0.32];
const plinth = [0.64, 0.59, 0.48];
const concrete = [0.67, 0.65, 0.59];
const turf = [0.18, 0.37, 0.137];
const track = [0.58, 0.255, 0.225];
const trackEdge = [0.66, 0.33, 0.28];
const lane = [0.9, 0.78, 0.64];
const dark = [0.055, 0.075, 0.065];
const metal = [0.52, 0.51, 0.43];
const seatBands = [
  [0.49, 0.55, 0.57],
  [0.26, 0.41, 0.5],
  [0.6, 0.59, 0.53],
  [0.42, 0.52, 0.49],
];

export const footprint = { minX: -2.49, maxX: 3.04, minZ: -3.22, maxZ: 3.24 };
const grade = 0.13;
const halfStraight = 1.27;
const innerRadius = 1.13;
const outerRadius = 1.49;
const tiers = {
  skyline: { segments: 10, lanes: false, rows: 2, details: 0 },
  district: { segments: 16, lanes: true, rows: 6, details: 1 },
  street: { segments: 24, lanes: true, rows: 10, details: 2 },
  closeup: { segments: 40, lanes: true, rows: 14, details: 3 },
  master: { segments: 52, lanes: true, rows: 14, details: 4 },
};

function oval(radius, y, count) {
  const ring = [];
  for (const end of [-1, 1]) {
    for (let i = 0; i <= count; i++) {
      const a = (Math.PI * i) / count;
      ring.push([end * radius * Math.cos(a), y, end * (halfStraight + radius * Math.sin(a))]);
    }
  }
  return ring;
}

function horizontal(out, slot, corners, color) {
  const n = normalFor(corners[0], corners[1], corners[2]);
  out.addQuad(slot, ref, n[1] > 0 ? corners : [...corners].reverse(), [0, 1, 0], [], color);
}

function strip(out, slot, inner, outer, y, count, color) {
  const a = oval(inner, y, count),
    b = oval(outer, y, count);
  for (let j = 0; j < a.length; j++) {
    const k = (j + 1) % a.length;
    horizontal(out, slot, [a[j], a[k], b[k], b[j]], color);
  }
}

function trackFloor(out, tier) {
  const { segments, lanes } = tier;
  strip(out, 'track', innerRadius, outerRadius, grade + 0.005, segments, track);
  const border = oval(innerRadius, grade + 0.006, segments).reverse();
  out.addConvexPolygon('field', ref, border, [0, 1, 0], [], turf);
  // The camera shows the sprint straight extending beyond both bend tangencies.
  horizontal(
    out,
    'track',
    [
      [1.492, grade + 0.005, -1.92],
      [1.604, grade + 0.005, -1.92],
      [1.604, grade + 0.005, 1.92],
      [1.492, grade + 0.005, 1.92],
    ],
    trackEdge,
  );
  if (lanes) {
    const width = (outerRadius - innerRadius) / 6;
    for (let i = 0; i <= 6; i++) {
      const r = innerRadius + width * i;
      strip(out, 'field', r - 0.004, r + 0.004, grade + 0.008, segments, lane);
    }
    for (const [x, z, dx, dz] of [
      [1.35, 1.12, 0.24, 0.011],
      [1.35, -1.04, 0.23, 0.011],
      [1.598, 0, 0.004, 1.89],
      [-1.8, 0.18, 0.26, 0.005],
      [-1.8, 0.45, 0.26, 0.005],
    ]) {
      const y = grade + 0.012;
      horizontal(
        out,
        'field',
        [
          [x - dx, y, z - dz],
          [x + dx, y, z - dz],
          [x + dx, y, z + dz],
          [x - dx, y, z + dz],
        ],
        lane,
      );
    }
  }
  box(out, 'track', [-2.1, grade, -0.82], [-1.57, grade + 0.004, 0.73], trackEdge);
  box(out, 'track', [-0.036, grade, 2.06], [0.036, grade + 0.008, 2.4], trackEdge);
  // Dark equipment box documented in the infield photograph.
  box(out, 'steel', [0.6, grade, 0.33], [0.96, grade + 0.075, 0.57], dark);
}

function stand(out, tier) {
  const front = 1.67;
  const depth = 1.27;
  const half = 2.5;
  const rows = tier.rows;
  const tread = depth / rows;
  const rise = 0.95 / rows;
  box(out, 'concrete', [front - 0.052, grade, -half], [front, grade + 0.13, half], concrete);
  for (let i = 0; i < rows; i++) {
    const x = front + i * tread;
    const y = grade + 0.12 + (i + 1) * rise;
    box(out, 'concrete', [x, grade, -half], [x + tread, y, half], i % 2 ? concrete : plinth);
    if (!tier.details) continue;
    const breaks = [-half + 0.079, -1.51, -1.38, -0.39, -0.24, 0.75, 0.9, 1.89, 2.03, half - 0.08];
    for (let section = 0; section < breaks.length; section += 2) {
      const z0 = breaks[section],
        z1 = breaks[section + 1];
      const color = seatBands[(i + section) % seatBands.length];
      if (tier.details < 3) {
        box(out, 'steel', [x + tread * 0.19, y, z0], [x + tread * 0.75, y + 0.022, z1], color);
      } else {
        const spacing = (z1 - z0) / 10;
        for (let seat = 0; seat < 10; seat++) {
          const z = z0 + seat * spacing;
          if ((seat + 3 * i + section) % 13 === 0) continue;
          box(
            out,
            'steel',
            [x + tread * 0.19, y, z],
            [x + tread * 0.78, y + 0.019, z + spacing * 0.84],
            color,
          );
        }
      }
    }
  }
  const back = grade + 0.12 + rows * rise;
  box(
    out,
    'concrete',
    [front + depth, grade, -half],
    [front + depth + 0.065, back + 0.07, half],
    concrete,
  );
  if (tier.details) {
    box(out, 'concrete', [2.56, back, -2.45], [2.99, back + 0.32, -1.95], plinth);
    box(out, 'steel', [2.544, back + 0.11, -2.38], [2.564, back + 0.24, -2.02], dark);
    box(out, 'steel', [2.54, back + 0.32, -2.47], [3.012, back + 0.356, -1.93], metal);
  }
}

function light(out, tier, x, z) {
  const top = 1.22;
  box(out, 'concrete', [x - 0.024, grade, z - 0.024], [x + 0.024, top, z + 0.024], concrete);
  box(out, 'steel', [x - 0.08, top - 0.035, z - 0.028], [x + 0.08, top + 0.016, z + 0.03], metal);
  if (tier.details >= 2) {
    for (const dx of [-0.054, 0, 0.054]) {
      box(
        out,
        'steel',
        [x + dx - 0.022, top - 0.029, z + 0.022],
        [x + dx + 0.022, top + 0.008, z + 0.04],
        lane,
      );
    }
  }
}

export function buildTrackExhibit(out, level = 'master') {
  const tier = tiers[level];
  const { minX, maxX, minZ, maxZ } = footprint;
  const corners = [
    [minX + 0.16, minZ],
    [minX, minZ + 0.23],
    [minX, maxZ - 0.21],
    [minX + 0.19, maxZ],
    [maxX - 0.2, maxZ],
    [maxX, maxZ - 0.19],
    [maxX, minZ + 0.21],
    [maxX - 0.19, minZ],
  ];
  loft(
    out,
    'plinth',
    [-0.31, grade - 0.014].map((y) => corners.map(([x, z]) => [x, y, z])),
    stone,
  );
  const ground = corners.map(([x, z]) => [x, grade, z]);
  loft(out, 'field', [corners.map(([x, z]) => [x, grade - 0.014, z]), ground], turf);
  trackFloor(out, tier);
  stand(out, tier);
  for (const [x, z] of [
    [-2.19, 2.68],
    [1.68, 2.71],
    [-2.19, -2.68],
    [1.68, -2.71],
  ])
    light(out, tier, x, z);
}

export const buildSkyline = (out) => buildTrackExhibit(out, 'skyline');
export const buildDistrict = (out) => buildTrackExhibit(out, 'district');
export const buildStreet = (out) => buildTrackExhibit(out, 'street');
export const buildCloseup = (out) => buildTrackExhibit(out, 'closeup');
