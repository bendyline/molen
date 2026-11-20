import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91 },
  vault: { slot: 'trim', graph: 'brick', roughness: 0.94 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  paving: { slot: 'roof', graph: 'stone', roughness: 0.96 },
};

// Length, width and overall height follow published dimensions. Individual profiles are
// estimated from the oblique elevation. +X travels along the deck, +Z faces the reference.
const end = 11.5;
const width = 3.18;
const bed = -0.62;
const stoneTop = 2.16;
const arches = [
  { center: -7.3, half: 1.68, spring: 2.3, crown: 4.05 },
  { center: -0.15, half: 3.6, spring: 2.36, crown: 6.08 },
  { center: 7.25, half: 1.72, spring: 2.32, crown: 4.16 },
];
const tones = {
  brick: [0.72, 0.47, 0.36],
  tower: [0.72, 0.59, 0.46],
  rim: [0.91, 0.73, 0.54],
  vault: [0.53, 0.4, 0.32],
  pier: [0.81, 0.77, 0.66],
  wetFoot: [0.62, 0.6, 0.53],
  road: [0.72, 0.7, 0.63],
};
const east = [1, 0, 0];
const west = [-1, 0, 0];
const up = [0, 1, 0];
const down = [0, -1, 0];
const reference = 'metric:uv';

export function deckY(x) {
  return 7.07 - 0.144 * Math.abs(x - 0.16);
}

// Photo-based landward approaches terminate at the two mapped ends of the eastern span.
// The central 23 m of the asset remain the original three-vault masonry crossing.
export const approachEndpoints = [
  [-22.348, 2.98, -4.48],
  [22.386, 7.2, 1.161],
];

function archY(arch, x) {
  const offset = 0.36 + 0.64 * Math.min(1, Math.abs(x - arch.center) / arch.half);
  const curve = Math.sqrt(Math.max(0, (1 - offset * offset) / (1 - 0.36 * 0.36)));
  return arch.spring + curve * (arch.crown - arch.spring);
}

function quad(out, surface, a, b, c, d, direction, tone, inputUvs) {
  const normal = normalFor(a, b, c);
  const dot = normal.reduce((sum, component, i) => sum + component * direction[i], 0);
  const points = [a, b, c, d];
  const flipped = dot < 0;
  if (flipped) [points[1], points[3]] = [points[3], points[1]];
  const uv = inputUvs && flipped ? [inputUvs[0], inputUvs[3], inputUvs[2], inputUvs[1]] : inputUvs;
  out.addQuad(
    surface,
    uv ? reference : '',
    points,
    flipped ? normal.map((component) => -component) : normal,
    uv,
    tones[tone],
  );
}

function face(out, surface, side, a, b, bottomA, bottomB, topA, topB, tone, offset = 0) {
  const z = side * (width + offset);
  quad(
    out,
    surface,
    [a, bottomA, z],
    [b, bottomB, z],
    [b, topB, z],
    [a, topA, z],
    [0, 0, side],
    tone,
  );
}

function barrel(out, divisions, detail) {
  const stations = [-end, 0.16, end];
  for (const arch of arches) {
    for (let index = 0; index <= divisions; index++) {
      const offset = index === divisions / 2 ? 0 : -Math.cos((Math.PI * index) / divisions);
      stations.push(arch.center + arch.half * offset);
    }
  }
  stations.sort((a, b) => a - b);
  for (let index = 1; index < stations.length; index++) {
    const a = stations[index - 1];
    const b = stations[index];
    const middle = (a + b) / 2;
    const arch = arches.find((opening) => Math.abs(middle - opening.center) < opening.half);
    const ya = arch ? archY(arch, a) : bed;
    const yb = arch ? archY(arch, b) : bed;
    const deckA = deckY(a);
    const deckB = deckY(b);

    for (const side of [-1, 1]) {
      if (arch) {
        const ring = detail ? 0.28 : 0.19;
        face(out, 'brick', side, a, b, ya, yb, deckA, deckB, 'brick');
        face(out, 'vault', side, a, b, ya, yb, ya + ring, yb + ring, 'rim', 0.018);
      } else {
        face(out, 'ashlar', side, a, b, bed, bed, 0.29, 0.29, 'wetFoot');
        face(out, 'ashlar', side, a, b, 0.29, 0.29, stoneTop, stoneTop, 'pier');
        face(out, 'brick', side, a, b, stoneTop, stoneTop, deckA, deckB, 'brick');
      }
      parapet(out, side, a, b, deckA, deckB, detail);
    }

    quad(
      out,
      'paving',
      [a, deckA, -width],
      [b, deckB, -width],
      [b, deckB, width],
      [a, deckA, width],
      up,
      'road',
    );
    quad(
      out,
      arch ? 'vault' : 'ashlar',
      [a, ya, -width],
      [b, yb, -width],
      [b, yb, width],
      [a, ya, width],
      down,
      arch ? 'vault' : 'wetFoot',
      [
        [a, -width],
        [b, -width],
        [b, width],
        [a, width],
      ],
    );
  }

  for (const arch of arches) {
    for (const side of [-1, 1]) {
      const x = arch.center + side * arch.half;
      endWall(out, x, bed, stoneTop, side > 0 ? west : east, 'ashlar', 'pier');
      endWall(out, x, stoneTop, arch.spring, side > 0 ? west : east, 'brick', 'brick');
    }
  }
  endWall(out, -end, bed, stoneTop, west, 'ashlar', 'pier');
  endWall(out, end, bed, stoneTop, east, 'ashlar', 'pier');
  endWall(out, -end, stoneTop, deckY(-end), west, 'brick', 'brick');
  endWall(out, end, stoneTop, deckY(end), east, 'brick', 'brick');
}

function endWall(out, x, low, high, direction, surface, tone) {
  quad(
    out,
    surface,
    [x, low, -width],
    [x, low, width],
    [x, high, width],
    [x, high, -width],
    direction,
    tone,
  );
}

function parapet(out, side, a, b, ya, yb, detail) {
  const outside = side * 3.23;
  const inside = side * 2.81;
  const rim = side * 3.29;
  const height = 0.67;
  const outward = [0, 0, side];
  const inward = [0, 0, -side];
  quad(
    out,
    'brick',
    [a, ya - 0.12, outside],
    [b, yb - 0.12, outside],
    [b, yb + height, outside],
    [a, ya + height, outside],
    outward,
    'brick',
  );
  quad(
    out,
    'brick',
    [a, ya, inside],
    [b, yb, inside],
    [b, yb + height, inside],
    [a, ya + height, inside],
    inward,
    'brick',
  );
  quad(
    out,
    'ashlar',
    [a, ya + height, inside],
    [b, yb + height, inside],
    [b, yb + height, rim],
    [a, ya + height, rim],
    up,
    'pier',
  );
  if (detail) {
    quad(
      out,
      'ashlar',
      [a, ya + height - 0.11, rim],
      [b, yb + height - 0.11, rim],
      [b, yb + height, rim],
      [a, ya + height, rim],
      outward,
      'pier',
    );
  }
  if (a === -end || b === end) {
    const x = a === -end ? a : b;
    const y = deckY(x);
    quad(
      out,
      'brick',
      [x, y, inside],
      [x, y, outside],
      [x, y + height, outside],
      [x, y + height, inside],
      x < 0 ? west : east,
      'brick',
    );
  }
}

function markerTower(out, x, z, sides, detail) {
  const top = deckY(x) + 1.41;
  const rings = [
    [bed, 0.84],
    [2.02, 0.78],
    [top - (detail ? 0.23 : 0), 0.58],
  ];
  if (detail) rings.push([top - 0.18, 0.65], [top, 0.65]);
  const point = (ring, theta) => [
    x + ring[1] * Math.cos(theta),
    ring[0],
    z + ring[1] * Math.sin(theta),
  ];
  const topRing = rings.at(-1);
  for (let index = 0; index < sides; index++) {
    const a = (2 * Math.PI * index) / sides;
    const b = (2 * Math.PI * (index + 1)) / sides;
    const middle = (a + b) / 2;
    const outward = [Math.cos(middle), 0, Math.sin(middle)];
    for (let ring = 1; ring < rings.length; ring++) {
      const lower = rings[ring - 1];
      const upper = rings[ring];
      const stone = ring === 1;
      const radius = (lower[1] + upper[1]) / 2;
      quad(
        out,
        stone ? 'ashlar' : 'brick',
        point(lower, a),
        point(lower, b),
        point(upper, b),
        point(upper, a),
        outward,
        stone ? 'pier' : 'tower',
        [
          [a * radius, lower[0]],
          [b * radius, lower[0]],
          [b * radius, upper[0]],
          [a * radius, upper[0]],
        ],
      );
    }
    out.addTriangle(
      'ashlar',
      '',
      [[x, top, z], point(topRing, b), point(topRing, a)],
      up,
      undefined,
      tones.pier,
    );
  }
}

// The aerial photograph shows low, rounded ashlar noses on the face opposite the older
// river elevation. Both join the solid pier between openings and leave each vault clear.
function pierNose(out, left, right, reach, sides) {
  const x = (left + right) / 2;
  const radius = (right - left) / 2;
  const z = -width + 0.045;
  const rings = [
    [bed, 1, 'wetFoot'],
    [0.29, 1, 'pier'],
    [stoneTop - 0.2, 0.98, 'pier'],
    [stoneTop - 0.08, 0.94, 'pier'],
  ];
  const point = ([y, size], theta) => [
    x + radius * size * Math.cos(theta),
    y,
    z - reach * size * Math.sin(theta),
  ];
  for (let index = 0; index < sides; index++) {
    const a = (Math.PI * index) / sides;
    const b = (Math.PI * (index + 1)) / sides;
    const theta = (a + b) / 2;
    const outward = [Math.cos(theta) / radius, 0, -Math.sin(theta) / reach];
    for (let ring = 1; ring < rings.length; ring++) {
      const low = rings[ring - 1];
      const high = rings[ring];
      quad(
        out,
        'ashlar',
        point(low, a),
        point(low, b),
        point(high, b),
        point(high, a),
        outward,
        low[2],
        [
          [a * radius, low[0]],
          [b * radius, low[0]],
          [b * radius, high[0]],
          [a * radius, high[0]],
        ],
      );
    }
    const top = rings.at(-1);
    out.addTriangle(
      'ashlar',
      '',
      [[x, top[0], z], point(top, a), point(top, b)],
      up,
      undefined,
      tones.pier,
    );
  }
}

function bankApproach(out, endpoint, direction) {
  const start = [direction * end, deckY(direction * end), 0];
  const [x, y, z] = endpoint;
  const edge = width + 0.45;
  quad(
    out,
    'paving',
    [start[0], start[1], -width],
    [x, y, z - edge],
    [x, y, z + edge],
    [start[0], start[1], width],
    up,
    'road',
  );
  for (const side of [-1, 1]) {
    const outerStart = side * 3.29;
    const outerEnd = z + side * (edge + 0.22);
    const innerStart = side * 2.81;
    const innerEnd = z + side * edge;
    const top = start[1] + 0.67;
    const outward = [0, 0, side];
    quad(
      out,
      'ashlar',
      [start[0], bed, outerStart],
      [x, y - 0.62, outerEnd],
      [x, y + 0.06, outerEnd],
      [start[0], top, outerStart],
      outward,
      'pier',
    );
    quad(
      out,
      'ashlar',
      [start[0], start[1], innerStart],
      [start[0], top, innerStart],
      [x, y + 0.06, innerEnd],
      [x, y, innerEnd],
      outward.map((value) => -value),
      'pier',
    );
    quad(
      out,
      'ashlar',
      [start[0], top, outerStart],
      [x, y + 0.06, outerEnd],
      [x, y + 0.06, innerEnd],
      [start[0], top, innerStart],
      up,
      'pier',
    );
  }
}

function build(out, divisions, towerSides, detail) {
  barrel(out, divisions, detail);
  const noseSides = Math.max(4, Math.floor(towerSides / 2));
  pierNose(
    out,
    arches[0].center + arches[0].half,
    arches[1].center - arches[1].half,
    1.64,
    noseSides,
  );
  pierNose(
    out,
    arches[1].center + arches[1].half,
    arches[2].center - arches[2].half,
    1.55,
    noseSides,
  );
  for (const x of [-9.38, 9.25]) {
    for (const z of [-3.53, 3.53]) markerTower(out, x, z, towerSides, detail);
  }
  bankApproach(out, approachEndpoints[0], -1);
  bankApproach(out, approachEndpoints[1], 1);
}

export const buildSkyline = (out) => build(out, 6, 6, false);
export const buildDistrict = (out) => build(out, 10, 10, false);
export const buildStreet = (out) => build(out, 16, 16, true);
export const buildCloseup = (out) => build(out, 28, 24, true);
export const buildMaster = (out) => build(out, 40, 36, true);
