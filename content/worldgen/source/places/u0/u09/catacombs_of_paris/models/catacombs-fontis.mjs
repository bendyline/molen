import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const ref = 'palette:#ffffff';
const limestone = [0.54, 0.49, 0.404];
const ashlar = [0.62, 0.56, 0.46];
const floor = [0.49, 0.44, 0.365];
const damp = [0.38, 0.405, 0.303];
const iron = [0.23, 0.225, 0.194];
const shade = (color, amount) => color.map((value) => value * amount);
const mix = (a, b, amount) => a.map((value, i) => value + (b[i] - value) * amount);
const quad = (out, slot, points, color) =>
  out.addQuad(slot, ref, points, normalFor(...points), [], color);
const triangle = (out, slot, points, color) =>
  out.addTriangle(slot, ref, points, normalFor(...points), [], color);

export const fontisSegment = 51;
export const fontisMouthRange = [0.24, 0.82];
export const fontisMouthHeight = 1.84;

// Horizontal trace from the museum diagram, adjusted to separate the two galleries at the junction.
const bends = [
  [104.6, 457.7],
  [96.1, 456.0],
  [78.0, 452.9],
  [65.5, 450.2],
  [39.4, 451.5],
  [23.2, 452.0],
  [16.2, 447.7],
  [10.2, 450.2],
  [5.0, 454.5],
  [-48.4, 456.2],
  [-88.4, 456.9],
  [-114.1, 456.9],
];
const districtBends = [0, 1, 3, 5, 6, 8, 11];
const room = [-123.1, 453.6];
const eastWall = 3.7;
const entrance = [0.68, 2.98];
const limestoneTable = [-1.22, -1.68];

export const fontisFrontage = {
  // South edge of the low PMTiles footprint in front of the shaft building.
  corners: [
    [-131.911, 457.799],
    [-122.673, 457.209],
  ],
  rear: [
    [-131.911, 452.689],
    [-122.87, 453.475],
  ],
  floor: 3.395,
  shaftFloor: 3.38716,
  chamberDepth: 18,
};

export function buildFontisFrontage(out, detail) {
  const [west, east] = fontisFrontage.corners;
  const span = Math.hypot(east[0] - west[0], east[1] - west[1]);
  const mid = mix(west, east, 0.5);
  const heading = Math.atan2(west[1] - east[1], east[0] - west[0]);
  const body = transform(out, heading, [mid[0], fontisFrontage.floor, mid[1]]);
  const left = -span / 2;
  const right = span / 2;
  const eave = 3.93;
  const rearEave = 4.16;
  const door = -0.22;
  const doorHalf = 0.56;
  const doorTop = 2.16;
  const wall = [0.72, 0.67, 0.52];
  const stone = [0.61, 0.56, 0.44];
  const zinc = [0.29, 0.33, 0.34];
  const panel = (a, b, low, high, z, color, slot = 'ashlar') =>
    quad(
      body,
      slot,
      [
        [a, low, z],
        [b, low, z],
        [b, high, z],
        [a, high, z],
      ],
      color,
    );

  const rear = fontisFrontage.rear.map(([x, z]) => [
    Math.cos(heading) * (x - mid[0]) - Math.sin(heading) * (z - mid[1]),
    Math.sin(heading) * (x - mid[0]) + Math.cos(heading) * (z - mid[1]),
  ]);
  const rim = [...rear, [right, 0], [left, 0]];
  const roofY = ([, z]) => eave + ((rearEave - eave) * z) / -4.4;
  for (const i of [0, 1, 3]) {
    const a = rim[i],
      b = rim[(i + 1) % rim.length];
    quad(body, 'ashlar', [at(b, 0), at(a, 0), at(a, roofY(a)), at(b, roofY(b))], wall);
  }
  quad(
    body,
    'iron',
    rim.toReversed().map((p) => at(p, roofY(p))),
    zinc,
  );
  if (!detail.joinery) {
    panel(left, right, -0.25, eave, 0, wall);
    panel(door - doorHalf, door + doorHalf, 0.09, doorTop, 0.008, [0.11, 0.107, 0.09], 'iron');
    return;
  }

  panel(left, right, -0.25, 0.09, 0, stone, 'foundation');
  panel(left - 0.03, right + 0.03, eave - 0.024, eave + 0.048, 0.13, zinc, 'iron');
  quad(
    body,
    'iron',
    [
      [left, eave + 0.048, 0],
      [left, eave + 0.048, 0.13],
      [right, eave + 0.048, 0.13],
      [right, eave + 0.048, 0],
    ],
    zinc,
  );
  panel(left, right, eave - 0.185, eave - 0.025, 0.088, stone);

  const lower = 0.09;
  const courseTop = eave - 0.18;
  if (detail.boneFaces) {
    const courseCount = 12;
    for (let i = 0; i < courseCount; i++) {
      const low = lower + ((courseTop - lower) * i) / courseCount;
      const high = lower + ((courseTop - lower) * (i + 1)) / courseCount;
      const ranges =
        low < doorTop
          ? [
              [left, door - doorHalf],
              [door + doorHalf, right],
            ]
          : [[left, right]];
      for (const [a, b] of ranges) {
        panel(a, b, low, high, -0.016, shade(stone, 0.9));
        const blocks = Math.ceil((b - a) / (i % 3 === 1 ? 0.71 : 0.92));
        for (let j = 0; j < blocks; j++) {
          const x = a + ((b - a) * j) / blocks;
          const next = a + ((b - a) * (j + 1)) / blocks;
          const color = shade(wall, 0.9 + 0.12 * (0.5 + 0.5 * Math.sin(i * 7.3 + j * 3.1)));
          panel(x + 0.007, next - 0.007, low + 0.007, high - 0.007, 0, color);
        }
      }
    }
  } else {
    panel(left, door - doorHalf, lower, doorTop, 0, wall);
    panel(door + doorHalf, right, lower, doorTop, 0, wall);
    panel(left, right, doorTop, courseTop, 0, wall);
  }
  for (const side of [-1, 1]) {
    const inner = door + side * doorHalf;
    const outer = door + side * 0.92;
    panel(Math.min(inner, outer), Math.max(inner, outer), lower, doorTop, 0.04, stone);
    const reveal = [
      [inner, lower, -0.27],
      [inner, lower, 0.04],
      [inner, doorTop, 0.04],
      [inner, doorTop, -0.27],
    ];
    quad(body, 'ashlar', side < 0 ? reveal.toReversed() : reveal, shade(stone, 0.76));
  }
  panel(door - 0.92, door + 0.92, doorTop, doorTop + 0.18, 0.19, stone);
  const apex = [door - 0.06, doorTop + 0.54, 0.18];
  triangle(
    body,
    'ashlar',
    [[door - 0.91, doorTop + 0.17, 0.18], [door + 0.91, doorTop + 0.17, 0.18], apex],
    shade(stone, 0.89),
  );
  for (const side of [-1, 1]) {
    const foot = [door + side * 0.91, doorTop + 0.17, 0.18];
    const flank = [foot, apex, [apex[0], apex[1], -0.016], [foot[0], foot[1], -0.016]];
    quad(body, 'ashlar', side < 0 ? flank : flank.toReversed(), stone);
  }
  panel(door - doorHalf, door + doorHalf, lower, doorTop, -0.25, shade(iron, 0.36), 'iron');
  if (detail.boneFaces) {
    box(body, 'iron', [door + 0.33, 0.97, -0.253], [door + 0.41, 1.02, -0.21], iron);
    box(body, 'iron', [right - 1.5, eave + 0.01, -2.52], [right - 1.28, eave + 1.31, -2.3], zinc);
    box(body, 'iron', [right - 1.54, eave + 1.29, -2.56], [right - 1.24, eave + 1.37, -2.26], zinc);
  }
}

export function fontisGeometry(opening) {
  const middle = mix(opening[0], opening[1], 0.5);
  const roomEntrance = [room[0] + eastWall, room[1] + (entrance[0] + entrance[1]) / 2];
  const path = [[middle[0], middle[2]], ...bends, roomEntrance];
  const distances = [0];
  for (const [i, point] of path.slice(1).entries()) {
    const [x, z] = path[i];
    distances.push(distances[i] + Math.hypot(point[0] - x, point[1] - z));
  }
  const y = fontisFrontage.shaftFloor - fontisFrontage.chamberDepth;
  const elevations = distances.map(
    (distance) => middle[1] + ((y - middle[1]) * distance) / distances.at(-1),
  );
  return {
    y,
    room,
    table: limestoneTable.map((value, i) => value + room[i]),
    path,
    elevations,
    roomEntrance,
  };
}

const unit = ([x, z]) => {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
};
const bearing = (a, b) => unit(b.map((value, i) => value - a[i]));
const lift = ([x, y, z], up) => [x, y + up, z];

function gallery(out, { path, elevations, roomEntrance }, opening, detail) {
  const indices = detail.joinery
    ? path.map((_, i) => i)
    : [0, ...districtBends.map((i) => i + 1), path.length - 1];
  const stations = indices.map((i) => path[i]);
  const points = stations.map((p, i) => {
    const y = elevations[indices[i]];
    if (i === 0) return { left: opening[0], right: opening[1], head: fontisMouthHeight, rise: 0 };
    if (i === stations.length - 1) {
      return {
        left: [roomEntrance[0], y, room[1] + entrance[0]],
        right: [roomEntrance[0], y, room[1] + entrance[1]],
        head: 2.0,
        rise: 0,
      };
    }
    const incoming = bearing(stations[i - 1], p);
    const outgoing = bearing(p, stations[i + 1]);
    const [dx, dz] = unit(incoming.map((value, axis) => value + outgoing[axis]));
    const half = 1.11 / Math.max(0.77, incoming[0] * dx + incoming[1] * dz);
    return {
      left: [p[0] - dz * half, y, p[1] + dx * half],
      right: [p[0] + dz * half, y, p[1] - dx * half],
      head: 2.08 + 0.09 * Math.sin(i * 1.2),
      rise: 0.34,
    };
  });
  const cap = (row, t) =>
    lift(mix(row.left, row.right, t), row.head + row.rise * Math.sin(t * Math.PI));
  const facets = detail.boneFaces ? 5 : detail.joinery ? 3 : 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    quad(out, 'foundation', [a.left, b.left, b.right, a.right], floor);
    quad(out, 'ashlar', [a.left, cap(a, 0), cap(b, 0), b.left], shade(ashlar, 0.84));
    quad(out, 'ashlar', [a.right, b.right, cap(b, 1), cap(a, 1)], shade(ashlar, 0.88));
    for (let j = 0; j < facets; j++) {
      const t = j / facets;
      const u = (j + 1) / facets;
      quad(
        out,
        'rough',
        [cap(a, t), cap(a, u), cap(b, u), cap(b, t)],
        shade(limestone, 0.84 + 0.12 * Math.sin(i + j)),
      );
    }
  }
}

// Irregular chamber plan, including the recessed north-side opening in the museum photograph.
const outline = [
  [-3.65, 0.8],
  [-3.45, -2.18],
  [-2.6, -3.24],
  [-1.1, -3.24],
  [0.55, -3.78],
  [2.72, -3.16],
  [eastWall, -1.56],
  [eastWall, entrance[0]],
  [eastWall, entrance[1]],
  [2.12, 4.1],
  [-0.48, 4.61],
  [-2.97, 3.77],
];
const spring = 2.51;
const at = ([x, z], y) => [x, y, z];

// The museum's room plan gives 83 spiral steps to the former street exit.
// Local grade sets the upper landing. The layout at the top is provisional.
export const fontisLowerStair = {
  center: [-5.27, -5.04],
  radius: 1.16,
  halfWidth: 0.59,
  approachSteps: 5,
  steps: 83,
  rise: 0.175,
  run: 0.31,
  topY: fontisFrontage.chamberDepth,
  headroom: 2.0,
};

const vestibuleCeiling = 2.0;
const connectorEnd = -4.39;

function landingWalls(out, ring, openings) {
  const rim = (y) => ring.map((p) => at(p, y));
  quad(out, 'foundation', rim(0).toReversed(), floor);
  quad(out, 'rough', rim(vestibuleCeiling), shade(limestone, 0.68));
  for (const [i, a] of ring.entries()) {
    if (openings.has(i)) continue;
    const b = ring[(i + 1) % ring.length];
    vestibuleWall(out, a, b);
  }
}

function vestibuleWall(out, a, b, low = 0, high = vestibuleCeiling) {
  quad(out, 'ashlar', [at(a, low), at(b, low), at(b, high), at(a, high)], shade(ashlar, 0.76));
}

function lowerExit(out, detail, buildStair) {
  const { center, radius, halfWidth, approachSteps, steps, rise, run, topY, headroom } =
    fontisLowerStair;
  const [sx, sz] = center;
  const nearZ = sz - halfWidth;
  const farZ = sz + halfWidth;
  const startY = approachSteps * rise;
  const shaftChord = sx + Math.sqrt(radius * radius - halfWidth * halfWidth);
  const west = shaftChord + approachSteps * run;
  const east = -0.62;
  const north = -6.41;
  const [a, b] = [outline[2], outline[3]];
  landingWalls(out, [a, [a[0], connectorEnd], [b[0], connectorEnd], b], new Set([1, 3]));
  landingWalls(
    out,
    [
      [west, north],
      [east, north],
      [east, connectorEnd],
      [west, connectorEnd],
    ],
    new Set([2, 3]),
  );
  vestibuleWall(out, [east, connectorEnd], [b[0], connectorEnd]);
  vestibuleWall(out, [a[0], connectorEnd], [west, connectorEnd]);
  vestibuleWall(out, [west, connectorEnd], [west, farZ]);
  vestibuleWall(out, [west, nearZ], [west, north]);

  for (let i = 0; i < approachSteps; i++) {
    const front = west - i * run;
    const back = front - run;
    const low = i * rise;
    const high = low + rise;
    quad(
      out,
      'ashlar',
      [
        [front, low, nearZ],
        [front, high, nearZ],
        [front, high, farZ],
        [front, low, farZ],
      ],
      ashlar,
    );
    quad(
      out,
      'ashlar',
      [
        [back, high, nearZ],
        [front, low, nearZ],
        [front, low + vestibuleCeiling, nearZ],
        [back, high + vestibuleCeiling, nearZ],
      ],
      shade(ashlar, 0.78),
    );
    quad(
      out,
      'ashlar',
      [
        [front, low, farZ],
        [back, high, farZ],
        [back, high + vestibuleCeiling, farZ],
        [front, low + vestibuleCeiling, farZ],
      ],
      shade(ashlar, 0.88),
    );
    const slices = i === approachSteps - 1 ? detail.tunnelFacets : 1;
    for (let section = 0; section < slices; section++) {
      const z0 = nearZ + (2 * halfWidth * section) / slices;
      const z1 = nearZ + (2 * halfWidth * (section + 1)) / slices;
      const edge = (z) =>
        slices === 1 ? back : sx + Math.sqrt(radius * radius - (z - sz) * (z - sz));
      quad(
        out,
        'foundation',
        [
          [edge(z0), high, z0],
          [edge(z1), high, z1],
          [front, high, z1],
          [front, high, z0],
        ],
        floor,
      );
      const crown = (t) =>
        slices === 1 ? vestibuleCeiling : vestibuleCeiling - 0.33 + 0.33 * Math.sin(Math.PI * t);
      quad(
        out,
        'rough',
        [
          [front, low + vestibuleCeiling, z0],
          [front, low + vestibuleCeiling, z1],
          [edge(z1), high + crown((section + 1) / slices), z1],
          [edge(z0), high + crown(section / slices), z0],
        ],
        shade(limestone, 0.7),
      );
    }
  }
  buildStair(
    out,
    { stair: center, floor: topY, steps, heading: 0, sealedHeadroom: headroom },
    { y: startY, half: halfWidth, height: vestibuleCeiling, shaftDirection: [1, 0] },
    detail,
    radius,
  );
}

function masonry(out, detail) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const door = i === 2 || i === 7;
    const height = door ? 2.0 : 0;
    const bands = detail.boneFaces && !door ? 6 : 1;
    for (let row = 0; row < bands; row++) {
      const low = height + ((spring - height) * row) / bands;
      const high = height + ((spring - height) * (row + 1)) / bands;
      const color =
        row < 2 && i % 3 !== 0 ? damp : shade(ashlar, 0.78 + 0.17 * Math.sin(i + row * 0.9));
      quad(out, 'ashlar', [at(a, low), at(b, low), at(b, high), at(a, high)], color);
    }
    if (!detail.joinery || door) continue;
    const [dx, dz] = bearing(a, b);
    const inside = ([x, z], y, inset) => [x - dz * inset, y, z + dx * inset];
    quad(
      out,
      'rough',
      [inside(a, 0.13, 0.16), inside(b, 0.13, 0.16), inside(b, 0.43, 0.16), inside(a, 0.43, 0.16)],
      shade(ashlar, 0.76),
    );
    quad(
      out,
      'rough',
      [inside(a, 0.43, 0.16), inside(b, 0.43, 0.16), inside(b, 0.43, 0), inside(a, 0.43, 0)],
      shade(ashlar, 0.89),
    );
  }

  // Lower detail retains the small side room. Near levels show its staircase.
  if (detail.joinery) return;
  const a = outline[2],
    b = outline[3];
  const left = [a[0], a[1] - 2.15],
    right = [b[0], b[1] - 2.15];
  quad(out, 'foundation', [at(a, 0), at(b, 0), at(right, 0), at(left, 0)], floor);
  quad(out, 'rough', [at(a, 2), at(left, 2), at(right, 2), at(b, 2)], shade(limestone, 0.66));
  for (const [start, end] of [
    [a, left],
    [left, right],
    [right, b],
  ]) {
    quad(out, 'ashlar', [at(start, 0), at(end, 0), at(end, 2), at(start, 2)], shade(ashlar, 0.64));
  }
}

function vault(out, detail) {
  const levels = detail.joinery ? [0, 0.36, 0.69, 0.88] : [0, 0.66];
  const rimProfile = detail.boneFaces
    ? outline.flatMap((point, i) => [point, mix(point, outline[(i + 1) % outline.length], 0.5)])
    : outline;
  const ring = (level) =>
    rimProfile.map(([x, z], i) => {
      const irregularity = detail.boneFaces ? 0.11 * Math.sin(i * 3.2 + level * 9) * level : 0;
      return [
        x * (1 - level) + 0.23 * level + irregularity,
        spring + level * (3.56 + 0.21 * Math.sin(i * 2.1 + level * 3)),
        z * (1 - level) - 0.33 * level - irregularity,
      ];
    });
  const rings = levels.map(ring);
  for (let row = 1; row < rings.length; row++) {
    const a = rings[row - 1],
      b = rings[row];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      const color = shade(i % 4 === 0 ? damp : limestone, 0.79 + 0.17 * Math.sin(i * 1.72 + row));
      triangle(out, 'rough', [a[i], a[j], b[j]], color);
      triangle(out, 'rough', [a[i], b[j], b[i]], color);
    }
  }
  const rim = rings.at(-1);
  const apex = [0.23, 6.22, -0.33];
  for (let i = 0; i < rim.length; i++) {
    triangle(
      out,
      'rough',
      [rim[i], rim[(i + 1) % rim.length], apex],
      shade(limestone, 0.82 + 0.08 * Math.sin(i)),
    );
  }
}

function chamber(out, detail) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const face = [indices[i], indices[i + 2], indices[i + 1]].map((index) => at(outline[index], 0));
    triangle(out, 'foundation', face, floor);
  }
  masonry(out, detail);
  vault(out, detail);
  const table = transform(out, -0.2, at(limestoneTable, 0));
  box(table, 'rough', [-1.28, 0.86, -0.53], [1.28, 1.02, 0.53], ashlar);
  for (const x of [-0.81, 0.81])
    box(table, 'rough', [x - 0.16, 0, -0.39], [x + 0.16, 0.86, 0.39], shade(ashlar, 0.83));
  box(table, 'foundation', [-1.55, 0, 0.61], [-0.6, 0.105, 1.11], shade(limestone, 0.87));
  if (!detail.joinery) return;
  // Thin grooves on the floor follow the nested chevrons visible in the reference.
  for (let i = 0; i < (detail.boneFaces ? 17 : 9); i++) {
    const z = 0.4 + i * (detail.boneFaces ? 0.17 : 0.32);
    const a = [-2.6, z + 0.35],
      b = [-0.19, z - 0.32],
      c = [2.25, z + 0.39];
    for (const [p, q] of [
      [a, b],
      [b, c],
    ]) {
      quad(
        out,
        'foundation',
        [
          at(p, 0.0018),
          at([p[0], p[1] + 0.015], 0.0018),
          at([q[0], q[1] + 0.015], 0.0018),
          at(q, 0.0018),
        ],
        shade(floor, 0.55),
      );
    }
  }
  for (const x of [-2.0, 1.35]) {
    box(out, 'iron', [x - 0.12, 2.13, -2.86], [x + 0.12, 2.3, -2.71], iron);
    box(out, 'ashlar', [x - 0.094, 2.15, -2.711], [x + 0.094, 2.23, -2.7], [0.82, 0.75, 0.6]);
  }
}

export function buildFontis(out, opening, detail, buildStair) {
  const geometry = fontisGeometry(opening);
  gallery(out, geometry, opening, detail);
  const interior = transform(out, 0, at(geometry.room, geometry.y));
  chamber(interior, detail);
  if (detail.joinery) lowerExit(interior, detail, buildStair);
}
