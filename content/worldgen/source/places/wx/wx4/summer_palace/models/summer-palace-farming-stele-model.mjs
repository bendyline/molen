import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box,
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { courtRoof, face, frame, levels, rectangle } from './summer-palace-model.mjs';

const { difference, union } = createRequire(
  new URL('../../../../../../../../packages/terrain/package.json', import.meta.url),
)('polygon-clipping');

export const forms = new Set(['farming-stele']);
export const surfaces = {
  paving: { slot: 'foundation', graph: 'stone_ashlar' },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered' },
  tablet: { slot: 'trim', graph: 'stone_marble' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'clay_fired', roughness: 0.9 },
  iron: { slot: 'trim', graph: 'metal_painted' },
};

const slate = [0.203, 0.243, 0.255];
const burgundy = [0.282, 0.083, 0.051];
const green = [0.102, 0.284, 0.258];
const ash = [0.515, 0.495, 0.444];
const light = [0.665, 0.65, 0.599];
const tabletStone = [0.6, 0.6, 0.58];
// The grey inset picks up the shadow that reads along the carved strokes in the close views.
const inscription = [0.43, 0.44, 0.43];
const roofWidth = 4.92;
const roofDepth = 3.94;
const roofRise = 0.98;
const eaveLift = 0.29;
const roofSlopes = [
  { span: roofWidth / 2, edge: roofDepth / 2, inner: 1.27, count: 26, radius: 0.059, alongX: true },
  { span: roofDepth / 2, edge: roofWidth / 2, inner: 1.8, count: 20, radius: 0.053, alongX: false },
];

// Exterior lettering follows the large calligraphy visible in the south-face photos.
const title = [
  [
    [
      [0.05, 0.67],
      [0.43, 0.73],
    ],
    [
      [0.06, 0.48],
      [0.44, 0.54],
    ],
    [
      [0.02, 0.28],
      [0.45, 0.37],
    ],
    [
      [0.22, 0.91],
      [0.28, 0.78],
      [0.27, 0.19],
      [0.21, 0.09],
    ],
    [
      [0.26, 0.47],
      [0.15, 0.24],
      [0.04, 0.12],
    ],
    [
      [0.29, 0.43],
      [0.4, 0.33],
      [0.43, 0.23],
    ],
    [
      [0.49, 0.67],
      [0.93, 0.78],
    ],
    [
      [0.45, 0.41],
      [0.96, 0.48],
    ],
    [
      [0.57, 0.81],
      [0.65, 0.86],
      [0.62, 0.44],
      [0.55, 0.2],
      [0.45, 0.1],
    ],
    [
      [0.8, 0.96],
      [0.87, 0.9],
      [0.84, 0.12],
    ],
  ],
  [
    [
      [0.26, 0.92],
      [0.17, 0.73],
      [0.08, 0.59],
      [0.26, 0.61],
    ],
    [
      [0.33, 0.76],
      [0.25, 0.56],
      [0.07, 0.34],
      [0.34, 0.43],
    ],
    [
      [0.31, 0.49],
      [0.39, 0.32],
    ],
    [
      [0.13, 0.28],
      [0.05, 0.1],
    ],
    [
      [0.23, 0.32],
      [0.25, 0.12],
    ],
    [
      [0.34, 0.29],
      [0.39, 0.18],
    ],
    [
      [0.54, 0.94],
      [0.61, 0.8],
    ],
    [
      [0.44, 0.72],
      [0.75, 0.77],
    ],
    [
      [0.5, 0.69],
      [0.53, 0.61],
    ],
    [
      [0.66, 0.72],
      [0.61, 0.58],
    ],
    [
      [0.44, 0.52],
      [0.93, 0.58],
    ],
    [
      [0.48, 0.43],
      [0.49, 0.17],
      [0.67, 0.21],
      [0.67, 0.45],
      [0.48, 0.43],
    ],
    [
      [0.5, 0.3],
      [0.66, 0.34],
    ],
    [
      [0.77, 0.94],
      [0.79, 0.59],
      [0.85, 0.27],
      [0.94, 0.11],
      [0.97, 0.27],
    ],
    [
      [0.9, 0.43],
      [0.86, 0.28],
      [0.71, 0.12],
    ],
    [
      [0.86, 0.85],
      [0.93, 0.78],
    ],
  ],
  [
    [
      [0.14, 0.83],
      [0.14, 0.19],
      [0.1, 0.09],
    ],
    [
      [0.14, 0.87],
      [0.75, 0.92],
      [0.88, 0.86],
      [0.85, 0.12],
      [0.8, 0.09],
    ],
    [
      [0.15, 0.12],
      [0.81, 0.15],
    ],
    [
      [0.36, 0.74],
      [0.67, 0.77],
      [0.68, 0.57],
      [0.37, 0.55],
      [0.36, 0.74],
    ],
    [
      [0.28, 0.51],
      [0.71, 0.55],
    ],
    [
      [0.33, 0.44],
      [0.34, 0.24],
      [0.67, 0.25],
      [0.69, 0.45],
      [0.33, 0.44],
    ],
    [
      [0.42, 0.39],
      [0.56, 0.41],
      [0.56, 0.31],
      [0.43, 0.3],
      [0.42, 0.39],
    ],
  ],
];

function lettering(y) {
  const height = 0.358;
  const width = 0.303;
  const grooves = [];
  for (const [i, glyph] of title.entries()) {
    const bottom = y + 1.26 - i * 0.512;
    for (const stroke of glyph) {
      const points = stroke.map(([x, h]) => [(x - 0.5) * width, bottom + h * height]);
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1];
        const b = points[j];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const scale = 0.008 / Math.hypot(dx, dy);
        const offset = [-dy * scale, dx * scale];
        const tip = (p, s) => [p[0] + offset[0] * s, p[1] + offset[1] * s];
        // The longitudinal caps overlap at bends so the cut has a continuous floor.
        grooves.push([
          [
            tip(a, 1),
            [a[0] - dx * scale, a[1] - dy * scale],
            tip(a, -1),
            tip(b, -0.72),
            [b[0] + dx * scale * 0.72, b[1] + dy * scale * 0.72],
            tip(b, 0.72),
          ],
        ]);
      }
    }
  }
  // Only the remaining outline of the seal reads in the photographs.
  const sealHalfWidth = 0.043;
  const sealY = y + 1.73;
  const rectangleAt = (x1, y1, x2, y2) => [
    [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ],
  ];
  for (const side of [-1, 1]) {
    const x = side * sealHalfWidth;
    const row = sealY + x;
    grooves.push(
      rectangleAt(-sealHalfWidth, row - 0.0018, sealHalfWidth, row + 0.0018),
      rectangleAt(x - 0.0018, sealY - sealHalfWidth, x + 0.0018, sealY + sealHalfWidth),
    );
  }
  return union(...grooves);
}

// Layered scrolls from the archival view of the exposed plinth.
// Points describe the crest and the half-width of the dressed stone bevel.
const waveScrolls = [
  [
    [-1.16, 0.49, 0.02],
    [-0.99, 0.56, 0.051],
    [-0.86, 0.72, 0.067],
    [-0.65, 0.78, 0.066],
    [-0.49, 0.73, 0.062],
    [-0.32, 0.54, 0.05],
    [-0.15, 0.53, 0.047],
    [0.02, 0.67, 0.052],
    [0.26, 0.72, 0.062],
    [0.51, 0.69, 0.062],
    [0.73, 0.76, 0.059],
    [0.94, 0.81, 0.054],
    [1.15, 0.76, 0.017],
  ],
  [
    [-1.16, 0.41, 0.02],
    [-0.95, 0.46, 0.043],
    [-0.79, 0.61, 0.044],
    [-0.64, 0.64, 0.041],
    [-0.5, 0.56, 0.032],
    [-0.46, 0.47, 0.016],
  ],
  [
    [-0.36, 0.43, 0.02],
    [-0.16, 0.42, 0.032],
    [0.03, 0.45, 0.035],
    [0.2, 0.55, 0.044],
    [0.36, 0.58, 0.046],
    [0.5, 0.54, 0.037],
    [0.56, 0.45, 0.025],
    [0.71, 0.45, 0.022],
    [0.83, 0.55, 0.042],
    [0.97, 0.58, 0.035],
    [1.08, 0.55, 0.027],
    [1.16, 0.46, 0.016],
  ],
];

function stoneRelief(out, side) {
  for (const scroll of waveScrolls) {
    const ridges = scroll.map(([x, y, width], i) => {
      const a = scroll[Math.max(0, i - 1)];
      const b = scroll[Math.min(scroll.length - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const offset = width / Math.hypot(dx, dy);
      return [
        [x + dy * offset, y - dx * offset, side * 0.499],
        [x, y, side * (0.502 + 0.65 * width)],
        [x - dy * offset, y + dx * offset, side * 0.499],
      ];
    });
    for (let i = 1; i < ridges.length; i++) {
      const a = ridges[i - 1];
      const b = ridges[i];
      face(out, 'stone', [a[0], b[0], b[1], a[1]], ash, [0, 0, side]);
      face(out, 'stone', [a[1], b[1], b[2], a[2]], light, [0, 0, side]);
    }
    face(out, 'stone', ridges[0], ash, [-1, 0, 0]);
    face(out, 'stone', ridges.at(-1), ash, [1, 0, 0]);
  }
}

// The photographed north face has one long irregular loss of surface material.
// Values are measured from the seat. The cavity reuses the same dressed stone surface.
const erosion = [
  [0.03, 1.91],
  [0.105, 1.91],
  [0.133, 1.78],
  [0.103, 1.64],
  [0.15, 1.49],
  [0.135, 1.39],
  [0.183, 1.29],
  [0.158, 1.15],
  [0.225, 1.06],
  [0.207, 0.89],
  [0.263, 0.78],
  [0.241, 0.64],
  [0.308, 0.52],
  [0.279, 0.36],
  [0.32, 0.23],
  [0.37, 0.14],
  [0.341, 0.065],
  [0.265, 0.1],
  [0.235, 0.215],
  [0.165, 0.32],
  [0.189, 0.46],
  [0.129, 0.56],
  [0.14, 0.72],
  [0.092, 0.86],
  [0.105, 0.96],
  [0.055, 1.05],
  [0.089, 1.19],
  [0.05, 1.29],
  [0.082, 1.42],
  [0.044, 1.53],
  [0.056, 1.66],
  [0.019, 1.77],
];

// Mineral staining on the north face beside the main erosion scar.
// The stone remains flat in these areas. Coordinates are measured from the seat.
const northPatina = [
  {
    color: [0.52, 0.505, 0.473],
    outline: [
      [-0.355, 1.32],
      [-0.307, 1.342],
      [-0.248, 1.311],
      [-0.222, 1.265],
      [-0.269, 1.243],
      [-0.32, 1.258],
      [-0.372, 1.241],
      [-0.388, 1.281],
    ],
  },
  {
    color: [0.536, 0.533, 0.502],
    outline: [
      [-0.34, 1.07],
      [-0.294, 1.106],
      [-0.239, 1.101],
      [-0.206, 1.072],
      [-0.256, 1.061],
      [-0.323, 1.044],
    ],
  },
  {
    color: [0.521, 0.515, 0.471],
    outline: [
      [-0.189, 0.858],
      [-0.149, 0.885],
      [-0.103, 0.838],
      [-0.121, 0.798],
      [-0.109, 0.749],
      [-0.159, 0.733],
      [-0.207, 0.783],
    ],
  },
  {
    color: [0.558, 0.541, 0.495],
    outline: [
      [-0.424, 0.596],
      [-0.363, 0.633],
      [-0.328, 0.597],
      [-0.348, 0.551],
      [-0.342, 0.518],
      [-0.4, 0.51],
      [-0.435, 0.552],
    ],
  },
];

// Thin fracture visible to the right of the lowest two large characters.
const southFracture = [
  [0.205, 1.13],
  [0.199, 1.02],
  [0.204, 0.925],
  [0.221, 0.822],
  [0.244, 0.733],
  [0.26, 0.638],
  [0.254, 0.51],
  [0.278, 0.432],
  [0.282, 0.436],
  [0.257, 0.511],
  [0.263, 0.638],
  [0.247, 0.734],
  [0.224, 0.822],
  [0.207, 0.926],
  [0.202, 1.02],
];

function tabletFace(out, outline, side, seat, weathered) {
  const z = side * 0.35;
  const emit = (rings, depth, color) => {
    const points = rings.flat();
    let offset = 0;
    const holes = rings.slice(0, -1).map((ring) => (offset += ring.length));
    const triangles = earcut(points.flat(), holes);
    for (let i = 0; i < triangles.length; i += 3) {
      const triangle = triangles.slice(i, i + 3).map((index) => points[index]);
      const [a, b, c] = triangle;
      const twiceArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      // Boolean joins can leave submillimetre slivers that collapse in exported Float32.
      if (Math.abs(twiceArea) < 1e-8) continue;
      face(
        out,
        'tablet',
        triangle.map((point) => [...point, depth]),
        color,
        [0, 0, side],
      );
    }
  };
  if (!weathered) {
    emit([outline], z, tabletStone);
    return;
  }
  if (side > 0) {
    const fracture = [[southFracture.map(([x, y]) => [x, y + seat])]];
    const glyphs = lettering(seat);
    const facePolygons = difference([outline], glyphs, fracture);
    for (const polygon of facePolygons) emit(polygon, z, tabletStone);
    for (const [polygons, depth, color] of [
      [glyphs, z - 0.008, inscription],
      [union(fracture), z - 0.002, ash],
    ]) {
      for (const polygon of polygons) {
        emit(polygon, depth, color);
        for (const ring of polygon) {
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1];
            const b = ring[i];
            face(
              out,
              'tablet',
              [
                [...a, z],
                [...b, z],
                [...b, depth],
                [...a, depth],
              ],
              ash,
              [a[1] - b[1], b[0] - a[0], 0],
            );
          }
        }
      }
    }
    return;
  }
  const loss = erosion.map(([x, y]) => [x, y + seat]);
  const recess = z + 0.003;
  const stains = northPatina.map(({ outline }) => [outline.map(([x, y]) => [x, y + seat])]);
  for (const polygon of difference([outline, loss], ...stains)) emit(polygon, z, tabletStone);
  for (const [index, stain] of stains.entries()) emit(stain, z, northPatina[index].color);
  emit([loss], recess, [0.711, 0.626, 0.495]);
  for (const [i, a] of loss.entries()) {
    const b = loss[(i + 1) % loss.length];
    face(
      out,
      'tablet',
      [
        [...a, z],
        [...b, z],
        [...b, recess],
        [...a, recess],
      ],
      ash,
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
}

export function buildSteleStone(out, detail) {
  const seat = 0.9;
  const radius = 0.5;
  const rise = 1.94;
  const crown = rise - radius;
  const steps = [5, 8, 12, 16, 22][detail];
  const depth = 0.7;
  const edges = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i * Math.PI) / steps;
    return [radius * Math.cos(angle), seat + crown + radius * Math.sin(angle)];
  });
  const outline = [[radius, seat], ...edges, [-radius, seat]];
  for (const side of [-1, 1]) {
    tabletFace(out, outline, side, seat, detail >= 3);
    const x = side * radius;
    face(
      out,
      'tablet',
      [
        [x, seat, -depth / 2],
        [x, seat, depth / 2],
        [x, seat + crown, depth / 2],
        [x, seat + crown, -depth / 2],
      ],
      tabletStone,
      [side, 0, 0],
    );
  }
  face(
    out,
    'tablet',
    [
      [-radius, seat, -depth / 2],
      [radius, seat, -depth / 2],
      [radius, seat, depth / 2],
      [-radius, seat, depth / 2],
    ],
    tabletStone,
    [0, -1, 0],
  );
  for (const [i, [x, y]] of edges.entries()) {
    if (!i) continue;
    const [u, v] = edges[i - 1];
    face(
      out,
      'tablet',
      [
        [u, v, -depth / 2],
        [u, v, depth / 2],
        [x, y, depth / 2],
        [x, y, -depth / 2],
      ],
      tabletStone,
      [x + u, 1, 0],
    );
  }
  const bevel = (w, d, h) =>
    rectangle(w, d)
      .toReversed()
      .map(([x, z]) => [x, h, z]);
  loft(out, 'stone', [bevel(2.54, 1.1, 0), bevel(2.51, 1.08, 0.195), bevel(2.36, 1, 0.37)], ash, {
    cap: false,
  });
  if (detail < 2) {
    box(out, 'stone', [-1.18, 0.37, -0.5], [1.18, seat, 0.5], light);
    return;
  }
  // The two pockets each measure 0.50 × 0.55 m and are 0.30 m deep.
  const recessFloor = seat - 0.3;
  box(out, 'stone', [-1.18, 0.37, -0.5], [1.18, recessFloor, 0.5], ash);
  box(out, 'stone', [-0.585, recessFloor, -0.5], [0.585, seat, 0.5], light);
  for (const side of [-1, 1]) {
    const [endMin, endMax] = side < 0 ? [-1.18, -1.085] : [1.085, 1.18];
    box(out, 'stone', [endMin, recessFloor, -0.5], [endMax, seat, 0.5], light);
    const [a, b] = side < 0 ? [-1.085, -0.585] : [0.585, 1.085];
    box(out, 'stone', [a, recessFloor, -0.5], [b, seat, -0.275], light);
    box(out, 'stone', [a, recessFloor, 0.275], [b, seat, 0.5], light);
  }
  for (const side of [-1, 1]) stoneRelief(out, side);
}

function shelterEaves(out, detail, roof) {
  for (const side of [-1, 1]) {
    for (const { span, edge, inner, count, radius, alongX } of roofSlopes) {
      const point = (along, y, depth) =>
        alongX ? [along, y, side * depth] : [side * depth, y, along];
      for (let i = 1; i < count; i++) {
        const station = span * ((2 * i) / count - 1);
        const lift = (Math.abs(station) / span) * eaveLift;
        const innerY = roof - 0.22 + 0.32 * lift;
        const tipY = roof - 0.2 + lift;
        const miteredDepth = Math.max(inner, (edge * Math.abs(station)) / span + 0.045);
        beam(
          out,
          'timber',
          point(station, innerY, miteredDepth),
          point(station, tipY, edge),
          0.075,
          0.058,
          green,
        );
        if (detail < 3) continue;
        const roll = (depth, r) =>
          Array.from({ length: 10 }, (_, j) => {
            const angle = (j * 2 * Math.PI) / 10;
            return point(station + r * Math.cos(angle), roof + lift + r * Math.sin(angle), depth);
          });
        const sections = [
          roll(edge - 0.083, radius),
          roll(edge + 0.081, radius),
          roll(edge + 0.106, radius * 0.82),
        ];
        loft(out, 'tile', side > 0 !== alongX ? sections.reverse() : sections, slate);
      }
    }
  }
}

function shelterRoofCourses(out, roof) {
  const rows = [0, 0.28, 0.61, 1];
  const height = (t) => roof + roofRise * t * (0.61 + 0.39 * t);
  const profile = [
    [-0.94, -0.046],
    [-0.69, 0.028],
    [0, 0.058],
    [0.69, 0.028],
    [0.94, -0.046],
  ];
  for (const side of [-1, 1]) {
    for (const { span, edge, count, radius, alongX } of roofSlopes) {
      // Match the hip and row positions of the shelter's underlying court roof.
      const hip = alongX ? 0.37 : 0.97;
      const fall = alongX ? 0.97 : 0.37;
      for (let i = 1; i < count; i++) {
        const station = span * ((2 * i) / count - 1);
        const end = Math.min(0.986, (1 - (Math.abs(station) + 0.095) / span) / hip);
        for (let j = 1; j < rows.length && rows[j - 1] < end; j++) {
          const low = rows[j - 1];
          const top = rows[j];
          const high = Math.min(top, end);
          const point = (t, [across, crown]) => {
            const u = station + across * radius;
            const fraction = (t - low) / (top - low);
            const base = height(low) * (1 - fraction) + height(top) * fraction;
            const lifted = j === 1 ? (eaveLift * Math.abs(u) * (1 - fraction)) / span : 0;
            const y = base + lifted + crown;
            const depth = side * edge * (1 - fall * t);
            return alongX ? [u, y, depth] : [depth, y, u];
          };
          const start = profile.map((p) => point(low, p));
          const finish = profile.map((p) => point(high, p));
          const tint = slate.map((value) => value * (0.96 + 0.085 * Math.sin(i * 2.36 + j + side)));
          for (let k = 1; k < profile.length; k++) {
            const points = [start[k - 1], start[k], finish[k], finish[k - 1]];
            const normal = normalFor(points[0], points[1], points[2]);
            face(out, 'tile', points, tint, normal[1] < 0 ? normal.map((n) => -n) : normal);
          }
        }
      }
    }
  }
}

function shelterRidgeCaps(out, roof) {
  const halfWidth = roofWidth / 2;
  const halfDepth = roofDepth / 2;
  const crown = roof + roofRise;
  const ridgeEnd = 0.63 * halfWidth;
  const glazedEdge = slate.map((value) => value * 1.21);
  const gutter = slate.map((value) => value * 0.73);
  // Two rounded courses cap each hip. Their tips roll upward at the eaves.
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const hip = [
        [halfWidth + 0.07, roof + eaveLift + 0.22, halfDepth + 0.055],
        [halfWidth + 0.043, roof + eaveLift + 0.115, halfDepth + 0.035],
        [halfWidth, roof + eaveLift, halfDepth],
        ...[0.28, 0.61, 1].map((t) => [
          halfWidth * (1 - 0.37 * t),
          roof + roofRise * t * (0.61 + 0.39 * t),
          halfDepth * (1 - 0.97 * t),
        ]),
      ].map(([x, y, z]) => [xSign * x, y, zSign * z]);
      beamPath(out, 'tile', hip, 0.205, 0.116, slate);
      beamPath(
        out,
        'tile',
        hip.map(([x, y, z]) => [x, y + 0.064, z]),
        0.147,
        0.046,
        gutter,
      );
      beamPath(
        out,
        'tile',
        hip.map(([x, y, z]) => [x, y + 0.102, z]),
        0.112,
        0.044,
        glazedEdge,
      );
    }
  }
  const crest = [
    [-ridgeEnd - 0.118, crown + 0.29, 0],
    [-ridgeEnd - 0.074, crown + 0.19, 0],
    [-ridgeEnd + 0.15, crown + 0.108, 0],
    [0, crown + 0.08, 0],
    [ridgeEnd - 0.15, crown + 0.108, 0],
    [ridgeEnd + 0.074, crown + 0.19, 0],
    [ridgeEnd + 0.118, crown + 0.29, 0],
  ];
  beamPath(out, 'tile', crest, 0.165, 0.074, gutter);
  beamPath(
    out,
    'tile',
    crest.map(([x, y, z]) => [x, y + 0.052, z]),
    0.12,
    0.046,
    glazedEdge,
  );
}

function shelter(out, detail, plaquePoems) {
  for (const x of [-1.8, 1.8]) {
    for (const z of [-1.26, 1.26]) {
      box(out, 'timber', [x - 0.1, 0.02, z - 0.1], [x + 0.1, 3.18, z + 0.1], green);
      if (detail > 0)
        box(out, 'paving', [x - 0.119, 0, z - 0.119], [x + 0.119, 0.035, z + 0.119], ash);
    }
  }
  const roof = 3.41;
  const ring = [
    [-1.89, -1.34],
    [1.89, -1.34],
    [1.89, 1.34],
    [-1.89, 1.34],
  ];
  const roundRails = detail >= 2;
  const railSides = detail === 3 ? 12 : 8;
  if (roundRails) {
    tubePath(
      out,
      'iron',
      ring.map(([x, z]) => [x, 0.94, z]),
      0.027,
      green,
      railSides,
      true,
    );
    tubePath(
      out,
      'iron',
      ring.map(([x, z]) => [x, 0.79, z]),
      0.019,
      green,
      railSides,
      true,
    );
  }
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    beam(out, 'timber', [a[0], 3.18, a[1]], [b[0], 3.18, b[1]], 0.255, 0.25, burgundy);
    if (!roundRails) beam(out, 'iron', [a[0], 0.94, a[1]], [b[0], 0.94, b[1]], 0.053, 0.057, green);
    if (detail === 0) continue;
    if (!roundRails) beam(out, 'iron', [a[0], 0.79, a[1]], [b[0], 0.79, b[1]], 0.034, 0.034, green);
    beam(out, 'iron', [a[0], 0.13, a[1]], [b[0], 0.13, b[1]], 0.05, 0.055, green);
    const count = detail === 1 ? 4 : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.265);
    for (let j = 1; j < count; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / count;
      const z = a[1] + ((b[1] - a[1]) * j) / count;
      if (roundRails) tube(out, 'iron', [x, 0.13, z], [x, 0.79, z], 0.013, green, railSides);
      else beam(out, 'iron', [x, 0.13, z], [x, 0.79, z], 0.032, 0.032, green);
    }
    if (detail >= 2)
      beam(
        out,
        'timber',
        [a[0], 2.85, a[1]],
        [a[0] * 0.81, 3.14, a[1] * 0.81],
        0.12,
        0.12,
        burgundy,
      );
  }
  courtRoof(out, roofWidth, roofDepth, roof, roofRise, slate, Math.min(detail, 1), false, eaveLift);
  if (detail >= 3) shelterRoofCourses(out, roof);
  if (detail >= 2) {
    shelterRidgeCaps(out, roof);
    shelterEaves(out, detail, roof);
    railingPlaque(out, detail, plaquePoems);
  }
}

// Hand-traced heading of the south railing plaque, 石碑南侧御制诗.
const plaqueHeading = [
  [
    [
      [1, 8],
      [9, 8],
    ],
    [
      [4, 8],
      [3, 5],
      [1, 3],
    ],
    [
      [3, 5],
      [8.5, 5],
      [8.5, 1],
      [3, 1],
      [3, 5],
    ],
  ],
  [
    [
      [0.5, 8.5],
      [4, 8.5],
    ],
    [
      [2.4, 8.5],
      [1.1, 5],
    ],
    [
      [1.2, 5.1],
      [3.7, 5.1],
      [3.7, 1.6],
      [1.2, 1.6],
      [1.2, 5.1],
    ],
    [
      [5.6, 7.8],
      [6.3, 9.3],
    ],
    [
      [5, 7.8],
      [9.3, 7.8],
      [9.3, 4.7],
      [5, 4.7],
      [5, 7.8],
    ],
    [
      [5, 6.3],
      [9.3, 6.3],
    ],
    [
      [7.2, 7.7],
      [7.2, 4.4],
      [6, 3.4],
    ],
    [
      [4.6, 3],
      [9.8, 3],
    ],
    [
      [7.9, 4.4],
      [7.9, 0.5],
    ],
  ],
  [
    [
      [1, 8.3],
      [9, 8.3],
    ],
    [
      [5, 9.5],
      [5, 7],
    ],
    [
      [1.5, 0.6],
      [1.5, 6.6],
      [8.8, 6.6],
      [8.8, 0.7],
      [7.6, 0.8],
    ],
    [
      [3.5, 5.6],
      [4.3, 4.7],
    ],
    [
      [6.6, 5.7],
      [5.8, 4.6],
    ],
    [
      [3, 4.5],
      [7.2, 4.5],
    ],
    [
      [3, 2.9],
      [7, 2.9],
    ],
    [
      [5.1, 4.5],
      [5.1, 1.4],
    ],
  ],
  [
    [
      [2.4, 9],
      [1.8, 6.5],
      [0.5, 4.9],
    ],
    [
      [1.8, 6.5],
      [1.8, 0.6],
    ],
    [
      [3.5, 3.1],
      [3.5, 8.1],
      [6.7, 8.1],
      [6.7, 3.2],
    ],
    [
      [5.1, 7.1],
      [5, 3.2],
      [3.4, 1],
    ],
    [
      [5.3, 2.8],
      [6.8, 1.1],
    ],
    [
      [7.8, 7.2],
      [7.8, 2.7],
    ],
    [
      [9.2, 9],
      [9.2, 0.8],
      [8.4, 0.9],
    ],
  ],
  [
    [
      [2.2, 9],
      [0.8, 7.2],
    ],
    [
      [2.6, 6.7],
      [0.7, 4.4],
    ],
    [
      [1.7, 5.5],
      [1.7, 0.8],
    ],
    [
      [4.4, 9.2],
      [3.1, 7.3],
    ],
    [
      [4.1, 7.9],
      [6.7, 7.9],
    ],
    [
      [3.1, 5.9],
      [6.8, 5.9],
    ],
    [
      [5.2, 7.8],
      [5.2, 2.2],
    ],
    [
      [5.2, 4.2],
      [6.7, 4.2],
    ],
    [
      [3.6, 4.5],
      [3.6, 2.1],
    ],
    [
      [3, 1.7],
      [6.9, 2.5],
    ],
    [
      [7.6, 0.8],
      [7.6, 8.4],
      [9.3, 8.4],
      [9.3, 2.8],
      [8.5, 2.8],
    ],
  ],
  [
    [
      [2.6, 9.1],
      [1.2, 7.2],
    ],
    [
      [2, 8],
      [6.1, 8],
    ],
    [
      [1.1, 6.3],
      [6.5, 6.3],
    ],
    [
      [4.2, 9.2],
      [4.2, 0.6],
    ],
    [
      [1.35, 1.75],
      [1.35, 4.5],
      [6.1, 4.5],
      [6.1, 1.7],
      [5.3, 1.7],
    ],
    [
      [7.7, 7.9],
      [7.7, 3.2],
    ],
    [
      [9.3, 9],
      [9.3, 0.9],
      [8.3, 0.9],
    ],
  ],
  [
    [
      [1.2, 9],
      [2.5, 7.6],
    ],
    [
      [0.7, 6],
      [2.5, 6],
      [2.5, 1.6],
      [3.7, 2.6],
    ],
    [
      [4.4, 7.9],
      [9, 7.9],
    ],
    [
      [6.6, 9.2],
      [6.6, 6.1],
    ],
    [
      [4, 6.1],
      [9.9, 6.1],
    ],
    [
      [4.1, 4.4],
      [9.8, 4.4],
    ],
    [
      [7.7, 5.8],
      [7.7, 0.9],
      [6.5, 1.2],
    ],
    [
      [5, 3.5],
      [6, 2.2],
    ],
  ],
];

function railingPlaque(out, detail, plaquePoems) {
  const bronze = [0.32, 0.178, 0.116];
  const shaded = [0.205, 0.113, 0.071];
  const rim = [0.387, 0.237, 0.155];
  const border = [
    [-0.31, -0.22],
    [0.31, -0.22],
    [0.34, -0.207],
    [0.357, -0.185],
    [0.357, 0.158],
    [0.35, 0.187],
    [0.327, 0.196],
    [0.309, 0.22],
    [-0.309, 0.22],
    [-0.327, 0.196],
    [-0.35, 0.187],
    [-0.357, 0.158],
    [-0.357, -0.185],
    [-0.34, -0.207],
  ];
  const centerY = 0.555;
  const profiles = [
    [1, 1.354],
    [1, 1.396],
    [0.974, 1.412],
    [0.92, 1.414],
    [0.888, 1.405],
  ].map(([scale, z]) => border.map(([x, y]) => [scale * x, centerY + scale * y, z]));
  loft(out, 'iron', profiles.slice(0, 2), shaded, { cap: false });
  loft(out, 'iron', profiles.slice(1), rim, { cap: false });
  const fill = earcut(border.flat());
  for (const [profile, direction] of [
    [profiles[0], -1],
    [profiles.at(-1), 1],
  ]) {
    for (let i = 0; i < fill.length; i += 3) {
      face(
        out,
        'iron',
        fill.slice(i, i + 3).map((index) => profile[index]),
        bronze,
        [0, 0, direction],
      );
    }
  }
  for (const x of [-0.275, 0.275]) {
    box(out, 'iron', [x - 0.017, 0.715, 1.325], [x + 0.017, 0.805, 1.379], shaded);
  }
  if (detail < 3) return;
  const ink = [0.095, 0.067, 0.049];
  const letterZ = 1.4055;
  for (const [index, glyph] of plaqueHeading.entries()) {
    const x0 = -0.175 + index * 0.052;
    for (const stroke of glyph) {
      for (let i = 1; i < stroke.length; i++) {
        const [a, b] = stroke
          .slice(i - 1, i + 1)
          .map(([x, y]) => [x0 + x * 0.0039, 0.65 + y * 0.0052]);
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const h = 0.00095 / Math.hypot(dx, dy);
        const d = [-dy * h, dx * h];
        const edge = (p, n) => [p[0] + d[0] * n, p[1] + d[1] * n, letterZ];
        face(out, 'iron', [edge(a, 1), edge(a, -1), edge(b, -1), edge(b, 1)], ink, [0, 0, 1]);
      }
    }
  }
  face(
    out,
    'iron',
    [
      [-0.275, 0.631, letterZ],
      [0.275, 0.631, letterZ],
      [0.275, 0.633, letterZ],
      [-0.275, 0.633, letterZ],
    ],
    ink,
    [0, 0, 1],
  );
  if (plaquePoems) {
    const {
      size: [width, height],
      rows,
    } = plaquePoems;
    const px = (x) => -0.282 + (0.564 * x) / width;
    const py = (y) => 0.621 - (0.226 * y) / height;
    for (const [row, ...runs] of rows) {
      for (let i = 0; i < runs.length; i += 2) {
        const left = px(runs[i]);
        const right = px(runs[i + 1]);
        face(
          out,
          'iron',
          [
            [left, py(row + 1), letterZ],
            [right, py(row + 1), letterZ],
            [right, py(row), letterZ],
            [left, py(row), letterZ],
          ],
          ink,
          [0, 0, 1],
        );
      }
    }
  }
}

function interpretationSign(out, foot, detail) {
  const darkBronze = [0.244, 0.193, 0.125];
  const warmBronze = [0.421, 0.338, 0.211];
  const plateFace = [0.315, 0.271, 0.202];
  const sign = frame(out, [3.28, -0.46], 0, 0);
  const sides = detail > 2 ? 10 : 6;
  for (const x of [-0.433, 0.433]) {
    const ring = (y, radius) => radialRing(y, radius, radius, sides, [x, 0]);
    loft(sign, 'iron', [ring(foot, 0.021), ring(1.55, 0.021)], darkBronze);
    loft(
      sign,
      'iron',
      [
        [1.55, 0.031],
        [1.566, 0.034],
        [1.577, 0.024],
        [1.614, 0.025],
        [1.636, 0.019],
        [1.647, 0.011],
      ].map(([y, radius]) => ring(y, radius)),
      warmBronze,
    );
    for (const y of [0.76, 1.43]) {
      box(sign, 'iron', [x - 0.035, y - 0.012, -0.015], [x + 0.035, y + 0.012, 0.015], darkBronze);
    }
  }

  // The lower corners turn into a broader rounded drop at the centre.
  const profile = [
    [-0.406, 1.486],
    [-0.406, 0.736],
    [-0.393, 0.713],
    [-0.349, 0.695],
    [-0.267, 0.687],
    [-0.229, 0.664],
    [-0.168, 0.638],
    [-0.086, 0.622],
    [0, 0.617],
    [0.086, 0.622],
    [0.168, 0.638],
    [0.229, 0.664],
    [0.267, 0.687],
    [0.349, 0.695],
    [0.393, 0.713],
    [0.406, 0.736],
    [0.406, 1.486],
    [0.396, 1.5],
    [-0.396, 1.5],
  ];
  const triangles = earcut(profile.flat());
  const outline = (scale, z) => profile.map(([x, y]) => [scale * x, 1.06 + scale * (y - 1.06), z]);
  for (const direction of [1, -1]) {
    const normal = [0, 0, direction];
    const outside = outline(1, direction * 0.016);
    const lip = outline(0.973, direction * 0.029);
    const inside = outline(0.929, direction * 0.026);
    const panel = outline(0.905, direction * 0.019);
    for (let i = 0; i < triangles.length; i += 3) {
      const points = triangles.slice(i, i + 3).map((index) => panel[index]);
      face(sign, 'iron', points, plateFace, normal);
    }
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      face(sign, 'iron', [outside[i], outside[j], lip[j], lip[i]], warmBronze, normal);
      face(sign, 'iron', [lip[i], lip[j], inside[j], inside[i]], warmBronze, normal);
      face(sign, 'iron', [inside[i], inside[j], panel[j], panel[i]], darkBronze, normal);
      if (direction > 0) {
        const back = ([x, y, z]) => [x, y, -z];
        face(
          sign,
          'iron',
          [outside[j], outside[i], back(outside[i]), back(outside[j])],
          darkBronze,
        );
      }
    }
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  const { floor, toe, eastApron, plaquePoems } = layout.farmingStele;
  const local = frame(out, [0, 0], floor, 0);
  // The draft's terrain rises toward the south. Pitch the outer stones to meet it.
  const apronTop = (z) => -0.14 + 0.047 * z;
  const ring = (x0, x1, z0, z1, height) =>
    [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ].map(([x, z]) => [x, height(z), z]);
  const apron = (outline, color) => {
    const rim = (offset) => outline.map(([x, z]) => [x, apronTop(z) + offset, z]);
    loft(local, 'stone', [rim(-0.026), rim(0)], color);
  };
  const apronSections = [[-2.55, 2.55, -2.07, 2.11], eastApron];
  for (const [x0, x1, z0, z1] of apronSections) {
    loft(
      local,
      'paving',
      [ring(x0, x1, z0, z1, () => toe - floor), ring(x0, x1, z0, z1, (z) => apronTop(z) - 0.023)],
      ash,
    );
  }
  // The visitor photos show a narrow curb below the posts and flagstones around it.
  loft(
    local,
    'stone',
    [
      ring(-2.04, 2.04, -1.52, 1.56, (z) => apronTop(z) - 0.018),
      ring(-2.04, 2.04, -1.52, 1.56, () => 0),
    ],
    light,
  );
  if (detail < 2) {
    for (const [x0, x1, z0, z1] of apronSections)
      apron(
        [
          [x0, z0],
          [x0, z1],
          [x1, z1],
          [x1, z0],
        ],
        ash,
      );
  } else {
    const [eastStart, eastEnd, eastNorth, eastSouth] = eastApron;
    const eastJoint = (eastStart + eastEnd) / 2;
    const strips = [
      [-2.55, 2.55, 1.56, 2.11, 0.67],
      [-2.55, 2.55, -2.07, -1.52, 0.72],
      [-2.55, -2.04, -1.52, 1.56, 0.83],
      [2.04, 2.55, -1.52, 1.56, 0.91],
      [eastStart, eastJoint - 0.005, eastNorth, eastSouth, 0.62],
      [eastJoint + 0.005, eastEnd, eastNorth, eastSouth, 0.83],
    ];
    for (const [x0, x1, z0, z1, course] of strips) {
      const alongX = x1 - x0 > z1 - z0;
      const start = alongX ? x0 : z0;
      const end = alongX ? x1 : z1;
      const count = Math.ceil((end - start) / course);
      const seam = (index, side) =>
        start +
        ((end - start) * index) / count +
        (index > 0 && index < count ? 0.11 * Math.sin(2.4 * index + start + side * 1.65) : 0);
      const near = alongX ? z0 : x0;
      const far = alongX ? z1 : x1;
      for (let i = 0; i < count; i++) {
        const jointStart = i === 0 ? 0 : 0.007;
        const jointEnd = i === count - 1 ? 0 : 0.007;
        const a = seam(i, 0) + jointStart;
        const b = seam(i, 1) + jointStart;
        const c = seam(i + 1, 1) - jointEnd;
        const d = seam(i + 1, 0) - jointEnd;
        const color = ash.map((value) => value * (1 + 0.1 * Math.sin(i * 1.81 + start)));
        apron(
          alongX
            ? [
                [a, near],
                [b, far],
                [c, far],
                [d, near],
              ]
            : [
                [near, a],
                [near, d],
                [far, c],
                [far, b],
              ],
          color,
        );
      }
    }
  }
  buildSteleStone(local, detail);
  shelter(local, detail, plaquePoems);
  if (detail >= 2) interpretationSign(local, toe - floor, detail);
}
