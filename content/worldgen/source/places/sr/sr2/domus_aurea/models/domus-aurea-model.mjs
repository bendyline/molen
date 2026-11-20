import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { masonry } from './site-masonry.mjs';

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.93, metallic: 0 },
  vault: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_travertine', roughness: 0.84, metallic: 0 },
  floor: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.68, metallic: 0.25 },
  oculus: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.65, metallic: 0 },
};

const brick = [0.61, 0.34, 0.22];
const limestone = [0.54, 0.46, 0.35];
const plaster = [0.7, 0.6, 0.46];
const travertine = [0.68, 0.62, 0.5];
const paving = [0.5, 0.46, 0.39];
const iron = [0.22, 0.24, 0.2];
const tau = 2 * Math.PI;
const tint = (rgb, k) => rgb.map((channel) => k * channel);

// Distances between named rooms come from the archaeological park's 1:500 plan.
// The model origin is the center of Room 128. Plan +X is right and +Z down.
const plan = ([x, z]) => [(x - 1246) / 6.48, (z - 456) / 6.48];
export const controls = {
  entrance: plan([137, 574]),
  gallery24End: plan([183, 501]),
  westLanding: plan([127, 500]),
  westGalleryHead: plan([128, 359]),
  entranceFloor: 2.25,
  entranceAxis: -0.54,
  approachStart: [-0.96, 1.83, -6.62],
  stairRun: 4.5,
  cryptoporticoWest: plan([1039, 292]),
  cryptoporticoEast: plan([1420, 297]),
  hallCenter: [0, 0],
  octagonApothem: 6.74,
  lintelY: 4.34,
  oculusRadius: 2.96,
  oculusY: 9.7,
};

// The public route bends around the two courts. These are scaled plan control points,
// with door widths and small heights estimated from the surviving rooms.
const westRoute = [
  [487, 370, 1.72, 3.25, 1.16],
  [520, 326, 1.28, 2.78, 1.03],
  [636, 318, 1.64, 2.93, 1.31],
  [648, 266, 1.21, 2.81, 1.03],
  [701, 267, 1.48, 2.99, 1.24],
  [743, 310, 1.33, 2.58, 1.12],
  [775, 281, 1.3, 2.69, 1.16],
  [914, 276, 1.9, 3.25, 1.61],
  [928, 235, 1.3, 2.73, 1.22],
  [976, 233, 1.52, 2.93, 1.32],
  [1005, 281, 1.52, 2.85, 1.14],
  [1039, 292, 1.64, 2.95, 1.18],
];
const eastRoute = [
  [1057, 398, 1.44, 2.91, 1.22],
  [1059, 479, 1.65, 3.14, 1.24],
  [1128, 479, 1.42, 2.92, 1.1],
  [1147, 456, 1.36, 2.83, 1.25],
  [1167.7216, 456, 1.82, 3.04, 1.27],
];
const paintedRooms = [
  {
    id: '23',
    planX: 166.5,
    half: 3.63,
    depth: 7.57,
    spring: 3.47,
    rise: 1.78,
    door: 1.35,
    color: [0.73, 0.57, 0.34],
  },
  {
    id: '29',
    planX: 326.2,
    half: 4.84,
    depth: 13.74,
    spring: 4.18,
    rise: 2.26,
    door: 1.72,
    color: [0.71, 0.58, 0.41],
  },
  {
    id: '31',
    planX: 382.4,
    half: 3.02,
    depth: 6.52,
    spring: 3.31,
    rise: 1.54,
    door: 1.22,
    color: [0.65, 0.5, 0.36],
  },
  {
    id: '33',
    planX: 433,
    half: 3.38,
    depth: 9.03,
    spring: 3.69,
    rise: 1.73,
    door: 1.33,
    color: [0.7, 0.57, 0.45],
  },
];

const tiers = {
  skyline: { arch: 6, dome: 2, masonry: false, furnishings: false },
  district: { arch: 9, dome: 4, masonry: false, furnishings: false },
  street: { arch: 14, dome: 7, masonry: true, furnishings: true },
  closeup: { arch: 20, dome: 10, masonry: true, furnishings: true },
  master: { arch: 28, dome: 14, masonry: true, furnishings: true },
};

function quad(out, slot, points, color, uv) {
  out.addQuad(
    slot,
    uv ? 'metric:uv' : 'palette:#ffffff',
    points,
    normalFor(...points),
    uv ?? [],
    color,
  );
}

function triangle(out, slot, points, color) {
  out.addTriangle(slot, 'palette:#ffffff', points, normalFor(...points), [], color);
}

function basis(start, end) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const dx = (end[0] - start[0]) / length;
  const dz = (end[1] - start[1]) / length;
  return {
    length,
    point: (across, y, along) => [
      start[0] + across * dz + along * dx,
      y,
      start[1] - across * dx + along * dz,
    ],
  };
}

function jamb(out, point, x0, x1, low, high, z0, z1, slot = 'stone', color = travertine) {
  quad(
    out,
    slot,
    [point(x0, low, z0), point(x1, low, z0), point(x1, high, z0), point(x0, high, z0)].reverse(),
    color,
  );
  quad(
    out,
    slot,
    [point(x0, low, z1), point(x1, low, z1), point(x1, high, z1), point(x0, high, z1)],
    color,
  );
  quad(
    out,
    slot,
    [point(x0, low, z0), point(x0, high, z0), point(x0, high, z1), point(x0, low, z1)].reverse(),
    color,
  );
  quad(
    out,
    slot,
    [point(x1, low, z0), point(x1, high, z0), point(x1, high, z1), point(x1, low, z1)],
    color,
  );
  quad(
    out,
    slot,
    [point(x0, high, z0), point(x0, high, z1), point(x1, high, z1), point(x1, high, z0)],
    color,
  );
  quad(
    out,
    slot,
    [point(x0, low, z0), point(x1, low, z0), point(x1, low, z1), point(x0, low, z1)],
    color,
  );
}

function vault(
  out,
  frame,
  half,
  spring,
  rise,
  detail,
  { endWall = false, crown = 'vault', floorY = 0, near = 0, far = frame.length, doors = [] } = {},
) {
  const { point } = frame;
  const length = far;
  quad(
    out,
    'floor',
    [
      point(-half, floorY, near),
      point(-half, floorY, length),
      point(half, floorY, length),
      point(half, floorY, near),
    ],
    paving,
  );
  const spanCount = detail.masonry ? Math.max(1, Math.ceil((length - near) / 3.4)) : 1;
  const breakpoints = new Set(
    Array.from({ length: spanCount + 1 }, (_, i) => near + ((length - near) * i) / spanCount),
  );
  for (const door of doors) {
    breakpoints.add(door.center - door.half);
    breakpoints.add(door.center + door.half);
  }
  const stations = [...breakpoints].sort((a, b) => a - b);
  for (let s = 0; s < stations.length - 1; s++) {
    const from = stations[s];
    const to = stations[s + 1];
    for (const side of [-1, 1]) {
      const a = side * half;
      const mid = (from + to) / 2;
      const door = doors.find(
        (item) => item.side === side && Math.abs(mid - item.center) < item.half,
      );
      const wallFloor = door?.height ?? floorY;
      const wall = [
        point(a, wallFloor, from),
        point(a, wallFloor, to),
        point(a, spring, to),
        point(a, spring, from),
      ];
      quad(
        out,
        'brick',
        side > 0 ? wall : wall.reverse(),
        tint(brick, 0.94 + 0.095 * Math.sin(s * 1.8 + side * 2)),
      );
      if (detail.masonry && !door) {
        const foot = 0.15 + 0.09 * Math.sin(s * 2.4 + side);
        const base = [
          point(a - side * 0.013, floorY, from),
          point(a - side * 0.013, floorY, to),
          point(a - side * 0.013, floorY + foot, to),
          point(a - side * 0.013, floorY + foot, from),
        ];
        quad(out, 'vault', side > 0 ? base : base.reverse(), tint(limestone, 0.86));
      }
    }
    for (let i = 0; i < detail.arch; i++) {
      const a = (i * Math.PI) / detail.arch;
      const b = ((i + 1) * Math.PI) / detail.arch;
      const arc = (t, z) => point(-half * Math.cos(t), spring + rise * Math.sin(t), z);
      const meters = Math.PI * (half + rise) * 0.5;
      const u0 = (i * meters) / detail.arch;
      const u1 = ((i + 1) * meters) / detail.arch;
      quad(
        out,
        crown,
        [arc(a, from), arc(b, from), arc(b, to), arc(a, to)],
        tint(
          crown === 'plaster' ? plaster : limestone,
          0.93 + 0.084 * Math.cos(2.27 * i + s * 1.33),
        ),
        [
          [u0, from],
          [u1, from],
          [u1, to],
          [u0, to],
        ],
      );
      if (endWall && s === stations.length - 2) {
        triangle(out, 'brick', [point(0, spring, length), arc(a, length), arc(b, length)], brick);
      }
    }
  }
  if (endWall) {
    const p = (x, y) => point(x, y, length);
    quad(
      out,
      'brick',
      [p(half, floorY), p(-half, floorY), p(-half, spring), p(half, spring)],
      tint(brick, 0.9),
    );
  }
}

function belt(out, point, distance, half, spring, rise, width, detail, brickOnly = false) {
  for (let i = 0; i < detail.arch; i++) {
    const t = (i * Math.PI) / detail.arch;
    const u = ((i + 1) * Math.PI) / detail.arch;
    const profile = (a, outward, z) =>
      point(-(half + outward) * Math.cos(a), spring + (rise + outward) * Math.sin(a), z);
    const color = tint(
      !brickOnly && i % 4 === 0 ? travertine : brick,
      0.93 + 0.08 * Math.cos(1.9 * i),
    );
    const inside = [
      profile(t, -0.07, distance),
      profile(u, -0.07, distance),
      profile(u, -0.07, distance + width),
      profile(t, -0.07, distance + width),
    ];
    quad(out, 'brick', inside, color);
    quad(
      out,
      'brick',
      [inside[1], inside[0], profile(t, 0.32, distance), profile(u, 0.32, distance)],
      color,
    );
    quad(
      out,
      'brick',
      [
        inside[3],
        inside[2],
        profile(u, 0.32, distance + width),
        profile(t, 0.32, distance + width),
      ],
      color,
    );
  }
}

function archSpandrel(out, point, distance, half, spring, rise, ceiling, steps, towardStart) {
  const profile = (i) => {
    const angle = (i * Math.PI) / steps;
    return [-half * Math.cos(angle), spring + rise * Math.sin(angle)];
  };
  for (let i = 0; i < steps; i++) {
    const [x0, y0] = profile(i);
    const [x1, y1] = profile(i + 1);
    const face = [
      point(x0, y0, distance),
      point(x1, y1, distance),
      point(x1, ceiling, distance),
      point(x0, ceiling, distance),
    ];
    quad(out, 'brick', towardStart ? face.reverse() : face, tint(brick, 0.94));
  }
}

function landingRoom(out, entrances, detail) {
  const ceiling = Math.max(...entrances.map(({ spring, rise }) => spring + rise)) + 0.18;
  const positions = entrances.flatMap(({ frame, station, half, spring, rise, atEnd }, index) => {
    archSpandrel(out, frame.point, station, half, spring, rise, ceiling, detail.arch, !atEnd);
    return [-half, half].map((x) => ({ point: frame.point(x, 0, station), opening: index }));
  });
  const center = positions.reduce(
    ([sx, , sz], { point: [x, , z] }) => [sx + x / positions.length, 0, sz + z / positions.length],
    [0, 0, 0],
  );
  const bearing = ({ point: [x, , z] }) => Math.atan2(z - center[2], x - center[0]);
  const edges = positions.sort((a, b) => bearing(b) - bearing(a));
  const elevated = ([x, , z]) => [x, ceiling, z];
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const b = edges[(i + 1) % edges.length];
    triangle(out, 'floor', [center, a.point, b.point], paving);
    triangle(out, 'vault', [elevated(center), elevated(b.point), elevated(a.point)], limestone);
    if (a.opening !== b.opening)
      quad(out, 'brick', [b.point, a.point, elevated(a.point), elevated(b.point)], brick);
  }
}

function entranceArch(out, point, detail) {
  const width = 1.12;
  const lowerSpring = controls.entranceFloor + 1.58;
  const upperSpring = 6.48;
  const shifted = (x, y, z) => point(x + controls.entranceAxis, y, z);
  const low = -0.08;
  const high = 7.88;
  for (const [lo, hi, slot, color] of [
    [-3.16, controls.entranceAxis - width, 'brick', brick],
    [controls.entranceAxis + width, 2.56, 'brick', brick],
    [2.56, 3.37, 'vault', tint(limestone, 0.85)],
  ])
    jamb(out, point, lo, hi, low, high, -0.38, 0.22, slot, color);
  jamb(
    out,
    shifted,
    -width,
    width,
    low,
    controls.entranceFloor - 0.015,
    -0.38,
    0.22,
    'brick',
    brick,
  );
  belt(out, shifted, -0.58, width, lowerSpring, 1.09, 0.79, detail, true);
  belt(out, shifted, -0.52, width, upperSpring, 1.02, 0.59, detail, true);
  for (const [spring, rise, cap] of [
    [lowerSpring, 1.09, 5.49],
    [upperSpring, 1.02, high],
  ]) {
    archSpandrel(out, shifted, -0.39, width, spring, rise, cap, detail.arch, true);
    archSpandrel(out, shifted, 0.22, width, spring, rise, cap, detail.arch, false);
  }
  // The upper opening is shuttered. Its curved head remains visible in the brickwork.
  jamb(out, shifted, -width, width, 5.49, upperSpring, -0.13, -0.07, 'iron', iron);
  for (let i = 0; i < detail.arch; i++) {
    const at = (t) => shifted(-width * Math.cos(t), upperSpring + 1.02 * Math.sin(t), -0.09);
    const arc = [
      shifted(0, upperSpring, -0.09),
      at((i * Math.PI) / detail.arch),
      at(((i + 1) * Math.PI) / detail.arch),
    ];
    triangle(out, 'iron', arc, iron);
    triangle(out, 'iron', arc.toReversed(), tint(iron, 0.81));
  }
  for (const [a, b] of [
    [-1.63, -1.12],
    [1.12, 1.63],
  ])
    jamb(out, shifted, a, b, 6.28, 6.58, -0.73, -0.29, 'stone', tint(travertine, 0.89));
  if (detail.furnishings) {
    for (const y of [5.74, 6.22, 6.63]) {
      beam(
        out,
        'iron',
        shifted(-1.02, y, -0.15),
        shifted(1.02, y, -0.15),
        0.035,
        0.06,
        tint(iron, 1.26),
      );
    }
    const hinge = -width + 0.06;
    const edge = -width + 0.27;
    quad(
      out,
      'iron',
      [
        shifted(hinge, 2.27, -0.46),
        shifted(edge, 2.27, -1.85),
        shifted(edge, 4.45, -1.85),
        shifted(hinge, 4.45, -0.46),
      ],
      tint(iron, 1.48),
    );
    quad(
      out,
      'iron',
      [
        shifted(edge, 2.27, -1.85),
        shifted(hinge, 2.27, -0.46),
        shifted(hinge, 4.45, -0.46),
        shifted(edge, 4.45, -1.85),
      ],
      iron,
    );
  }
}

function visitorStair(out, point, detail) {
  const { entranceFloor: height, entranceAxis: center, stairRun: run } = controls;
  const steps = detail.masonry ? 15 : 9;
  const apron = [
    point(-2.23, height, -4.6),
    point(-2.23, height, 0),
    point(2.24, height, 0),
    point(2.24, height, -4.6),
  ];
  quad(out, 'floor', apron, tint(paving, 1.11));
  const [x, y, z] = controls.approachStart;
  quad(
    out,
    'floor',
    [point(x - 0.91, y, z), apron[0], apron[3], point(x + 0.91, y, z)],
    tint(paving, 1.08),
  );
  const half = 0.71;
  const tread = [0.64, 0.61, 0.53];
  for (let i = 0; i < steps; i++) {
    const from = (i * run) / steps;
    const to = ((i + 1) * run) / steps;
    const y = height * (1 - i / steps);
    const lower = y - height / steps;
    jamb(
      out,
      point,
      center - half,
      center + half,
      lower,
      y,
      from,
      to,
      'stone',
      tint(tread, i % 2 ? 0.92 : 1),
    );
  }
  for (const side of [-1, 1]) {
    const x = center + side * half;
    const cap = [
      point(x, height, 0),
      point(x, 0, run),
      point(x, 0.91, run),
      point(x, height + 0.91, 0),
    ];
    quad(out, 'iron', side > 0 ? cap : cap.toReversed(), tint(iron, 0.87));
    quad(out, 'plaster', side < 0 ? cap : cap.toReversed(), tint(tread, 1.07));
    beam(
      out,
      'iron',
      point(x, height + 0.915, 0),
      point(x, 0.915, run),
      0.11,
      0.13,
      tint(iron, 0.88),
    );
  }
}

function porticoRemains(out, point, detail) {
  const stone = tint(travertine, 1.12);
  const filament = [0.87, 0.75, 0.51];
  for (const [i, [across, along]] of [
    [-2.05, 5.17],
    [1.73, 5.46],
    [2.62, 7.9],
  ].entries()) {
    const center = point(across, 0, along);
    jamb(
      out,
      point,
      across - 0.58,
      across + 0.58,
      -0.035,
      0.17,
      along - 0.55,
      along + 0.55,
      'stone',
      stone,
    );
    if (!detail.masonry || i === 2) continue;
    const [x, , z] = center;
    const profile = [
      [0.17, 0.5],
      [0.25, 0.51],
      [0.29, 0.43],
      [0.34, 0.45],
      [0.38, 0.34],
    ];
    loft(
      out,
      'stone',
      profile.map(([y, r]) => radialRing(y, r, r * 0.91, 12, [x, z])),
      stone,
    );
    torus(out, 'stone', [x, 5.49, z], 0.31, 0.034, filament, 14, 5);
    for (let strand = 0; strand < 12; strand++) {
      const a = (tau * strand) / 12;
      const p = [x + 0.292 * Math.cos(a), 0.4, z + 0.292 * Math.sin(a)];
      beam(out, 'stone', p, [p[0], 5.48, p[2]], 0.011, 0.011, tint(filament, 0.9));
    }
  }
}

function retainingWalls(out) {
  for (const { rings, vertices, heights, triangles } of masonry) {
    const point = (i, top) => [vertices[i][0], heights[i][top], vertices[i][1]];
    let start = 0;
    for (const [ringIndex, length] of rings.entries()) {
      const ids = Array.from({ length }, (_, i) => start + i);
      const area = ids.reduce((sum, a, i) => {
        const [x, z] = vertices[a];
        const [xx, zz] = vertices[ids[(i + 1) % length]];
        return sum + x * zz - xx * z;
      }, 0);
      if (area < 0 === (ringIndex === 0)) ids.reverse();
      for (const [i, a] of ids.entries()) {
        const b = ids[(i + 1) % length];
        const lo = point(a, 0),
          hi = point(a, 1),
          next = point(b, 1),
          end = point(b, 0);
        const tintStone = 0.92 + 0.078 * Math.sin(i * 1.67 + start);
        quad(out, i % 8 === 3 ? 'vault' : 'brick', [lo, hi, next, end], tint(brick, tintStone));
      }
      start += length;
    }
    for (let i = 0; i < triangles.length; i += 3) {
      const face = triangles.slice(i, i + 3).map((id) => point(id, 1));
      if (normalFor(...face)[1] < 0) face.reverse();
      triangle(out, 'vault', face, tint(limestone, 0.87));
    }
  }
}

function westernSector(out, detail, connected) {
  const frame = basis(controls.entrance, controls.gallery24End);
  const far = frame.length - 4.15;
  vault(out, frame, 3.16, 5.27, 2.17, detail, { far, endWall: !connected });
  entranceArch(out, frame.point, detail);
  jamb(out, frame.point, -3.16, 3.16, 7.49, 7.82, 0.21, 3.05, 'brick', tint(brick, 0.91));
  visitorStair(out, frame.point, detail);
  porticoRemains(out, frame.point, detail);
  if (!connected) return;
  const landing = basis(controls.gallery24End, controls.westLanding);
  const gallery = basis(controls.westLanding, controls.westGalleryHead);
  const landingEnd = landing.length - 3.2;
  vault(out, landing, 2.05, 2.8, 1.45, detail, { near: 4.15, far: landingEnd });
  const galleryEnd = gallery.length - 3.2;
  vault(out, gallery, 1.93, 2.8, 1.64, detail, { near: 3.2, far: galleryEnd });
  landingRoom(
    out,
    [
      { frame, station: far, half: 3.16, spring: 5.27, rise: 2.17, atEnd: true },
      { frame: landing, station: 4.15, half: 2.05, spring: 2.8, rise: 1.45, atEnd: false },
    ],
    detail,
  );
  landingRoom(
    out,
    [
      { frame: landing, station: landingEnd, half: 2.05, spring: 2.8, rise: 1.45, atEnd: true },
      { frame: gallery, station: 3.2, half: 1.93, spring: 2.8, rise: 1.64, atEnd: false },
    ],
    detail,
  );

  return { frame: gallery, station: galleryEnd, half: 1.93, spring: 2.8, rise: 1.64, atEnd: true };
}

const radiusAt = (angle) => {
  const nearestFace = Math.round(angle / (tau / 8)) * (tau / 8);
  return controls.octagonApothem / Math.cos(angle - nearestFace);
};

function octagonalHall(out, detail) {
  const { octagonApothem, lintelY, oculusRadius, oculusY } = controls;
  const halfFace = octagonApothem * Math.tan(Math.PI / 8);
  const directions = [null, null, '125', '126', '124', '123', '122', null];
  for (const [index, room] of directions.entries()) {
    const angle = (index * tau) / 8;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    const point = (x, y, z) => [x * dz + z * dx, y, -x * dx + z * dz];
    const width = 1.82;
    const pierDepth = 1.12;
    const back = octagonApothem + pierDepth;
    jamb(out, point, -halfFace, -width, 0, lintelY, octagonApothem, back, 'brick', brick);
    jamb(out, point, width, halfFace, 0, lintelY, octagonApothem, back, 'brick', tint(brick, 0.93));
    jamb(out, point, -width, width, lintelY, lintelY + 0.47, octagonApothem, back);
    quad(
      out,
      'floor',
      [
        point(-width, 0, octagonApothem),
        point(-width, 0, back),
        point(width, 0, back),
        point(width, 0, octagonApothem),
      ],
      paving,
    );
    triangle(
      out,
      'floor',
      [[0, 0, 0], point(-halfFace, 0, octagonApothem), point(halfFace, 0, octagonApothem)],
      paving,
    );
    if (room) {
      const far = back + (room === '124' ? 6.05 : room === '123' || room === '126' ? 5.18 : 4.22);
      archSpandrel(out, point, back, width, 3.04, 1.27, lintelY, detail.arch, true);
      vault(out, basis([back * dx, back * dz], [far * dx, far * dz]), width, 3.04, 1.27, detail, {
        endWall: room !== '122',
        crown: room === '124' ? 'plaster' : 'vault',
      });
    } else if (index === 0) {
      archSpandrel(out, point, back, width, 2.99, 1.27, lintelY, detail.arch, true);
      vault(out, basis([0, back], [0, back + 7.7]), width, 2.99, 1.27, detail, { endWall: true });
    } else {
      jamb(
        out,
        point,
        -width,
        width,
        0,
        lintelY,
        back - 0.02,
        back + 0.16,
        'vault',
        tint(limestone, 0.8),
      );
    }
  }
  const count = 8 * Math.max(2, Math.floor(detail.arch / 4));
  const height = oculusY - lintelY;
  const ring = (v, a) => {
    const y = lintelY + height * Math.sin(v * Math.PI * 0.5);
    const r = oculusRadius + (radiusAt(a) - oculusRadius) * Math.cos(v * Math.PI * 0.5);
    const round = (1 - v) * (radiusAt(a) - octagonApothem) * Math.sin(v * Math.PI);
    return [(r - round) * Math.sin(a), y, (r - round) * Math.cos(a)];
  };
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count + Math.PI / 8;
    const b = ((i + 1) * tau) / count + Math.PI / 8;
    for (let j = 0; j < detail.dome; j++) {
      const from = j / detail.dome;
      const to = (j + 1) / detail.dome;
      quad(
        out,
        'vault',
        [ring(from, a), ring(to, a), ring(to, b), ring(from, b)],
        tint(limestone, 0.94 + 0.065 * Math.sin(3 * a + 2 * j)),
      );
    }
    const at = (radius, y, angle) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];
    quad(
      out,
      'brick',
      [
        at(oculusRadius, oculusY, a),
        at(oculusRadius, oculusY + 0.54, a),
        at(oculusRadius, oculusY + 0.54, b),
        at(oculusRadius, oculusY, b),
      ],
      tint(brick, 1.16),
    );
    triangle(
      out,
      'oculus',
      [
        [0, oculusY + 0.52, 0],
        at(oculusRadius, oculusY + 0.52, b),
        at(oculusRadius, oculusY + 0.52, a),
      ],
      [0.78, 0.8, 0.76],
    );
  }
}

function cryptoportico(out, detail) {
  const frame = basis(controls.cryptoporticoWest, controls.cryptoporticoEast);
  const near = 3.86;
  const half = 2.25;
  const spring = 3.1;
  const rise = 1.85;
  vault(out, frame, half, spring, rise, detail, { near, endWall: true, crown: 'plaster' });
  if (detail.masonry) {
    for (const along of [6.2, 20.6, 33.5, 46.4, 55.7]) {
      belt(out, frame.point, along, half, spring, rise, 0.29, detail);
    }
  }
  return { frame, half, spring, rise, station: near, atEnd: false };
}

function routeSections(start, markers, initialTrim, finalTrim) {
  const sections = markers.map(([x, z, half, spring, rise], i) => {
    const from = i ? plan(markers[i - 1]) : start;
    const frame = basis(from, plan([x, z]));
    const trim = Math.min(3.12, frame.length * 0.29);
    const near = i ? trim : initialTrim;
    const far = frame.length - (i === markers.length - 1 ? finalTrim : trim);
    return { frame, half, spring, rise, near, far };
  });
  return sections;
}

function endOf(section, atEnd) {
  const { frame, half, spring, rise, near, far } = section;
  return { frame, half, spring, rise, station: atEnd ? far : near, atEnd };
}

function roomDoors(section) {
  return paintedRooms.map((room) => ({
    ...room,
    center: ((room.planX - 128) / (487 - 128)) * section.frame.length,
    side: -1,
    half: room.door,
    roomHalf: room.half,
    height: 2.53,
  }));
}

function decoratedRoom(out, section, door, detail) {
  const [x, , z] = section.frame.point(-section.half, 0, door.center);
  const [right, , south] = section.frame.point(-section.half - door.depth, 0, door.center);
  const frame = basis([x, z], [right, south]);
  const { point } = frame;
  vault(out, frame, door.roomHalf, door.spring, door.rise, detail, {
    endWall: true,
    crown: 'plaster',
  });
  const nearWall = (a, b, bottom, top) => {
    quad(
      out,
      'brick',
      [point(a, bottom, 0), point(b, bottom, 0), point(b, top, 0), point(a, top, 0)],
      brick,
    );
  };
  nearWall(-door.roomHalf, -door.half, 0, door.spring);
  nearWall(door.half, door.roomHalf, 0, door.spring);
  nearWall(-door.half, door.half, door.height, door.spring);
  for (let i = 0; i < detail.arch; i++) {
    const arc = (a) => {
      const t = (a * Math.PI) / detail.arch;
      return point(-door.roomHalf * Math.cos(t), door.spring + door.rise * Math.sin(t), 0);
    };
    triangle(out, 'brick', [point(0, door.spring, 0), arc(i + 1), arc(i)], brick);
  }
  // Fragments of the two painted registers remain on the lime plaster.
  if (detail.masonry) {
    for (const side of [-1, 1]) {
      const a = side * (door.roomHalf - 0.019);
      for (let n = 0; n < Math.floor(door.depth / 2.04); n++) {
        const z0 = 0.5 + n * 2.04;
        const z1 = z0 + 1.61;
        const top = 1.54 + 0.39 * Math.cos(n * 2.23 + side);
        const lower = [
          point(a, 0.35, z0),
          point(a, 0.41, z0 + 0.6),
          point(a, 0.32, z1 - 0.21),
          point(a, 0.47, z1),
          point(a, top - 0.38, z1),
          point(a, top - 0.14, z1 - 0.43),
          point(a, top - 0.26, z0 + 0.57),
          point(a, top, z0 + 0.09),
        ];
        const patch = point(a, (0.38 + top) * 0.5, (z0 + z1) * 0.5);
        const ochre = tint(door.color, 0.9 + 0.11 * Math.sin(n * 2.1));
        for (let i = 0; i < lower.length; i++) {
          const face = [patch, lower[i], lower[(i + 1) % lower.length]];
          triangle(out, 'plaster', side > 0 ? face : face.reverse(), ochre);
        }
        const upper = [
          point(a, 2.32, z0 + 0.16),
          point(a, 2.33, z1 - 0.18),
          point(a, 2.48, z1 - 0.18),
          point(a, 2.52, z0 + 0.16),
        ];
        quad(out, 'plaster', side > 0 ? upper : upper.reverse(), [0.56, 0.32, 0.24]);
        const post = side * (door.roomHalf - 0.027);
        const flake = [
          point(post, top + 0.18, z0 + 0.29),
          point(post, top + 0.19, z0 + 0.354),
          point(post, 2.31, z0 + 0.36),
          point(post, 2.3, z0 + 0.301),
        ];
        quad(out, 'plaster', side > 0 ? flake : flake.reverse(), [0.68, 0.52, 0.36]);
      }
    }
  }
}

export function visitorRouteSections() {
  return {
    west: routeSections(controls.westGalleryHead, westRoute, 3.2, 2.68),
    east: routeSections(controls.cryptoporticoWest, eastRoute, 3.57, 0),
  };
}

function galleries(out, detail, sections, westRooms = false) {
  for (const [i, section] of sections.entries()) {
    const { frame, half, spring, rise, near, far } = section;
    const doors = westRooms && i === 0 ? roomDoors(section) : [];
    vault(out, frame, half, spring, rise, detail, { near, far, doors });
    for (const door of doors) decoratedRoom(out, section, door, detail);
    if (i) landingRoom(out, [endOf(sections[i - 1], true), endOf(section, false)], detail);
    if (detail.masonry && far - near > 7) {
      belt(out, frame.point, near + (far - near) * 0.62, half, spring, rise, 0.29, detail);
    }
  }
}

export function buildDomusAurea(out, tier) {
  const detail = tiers[tier];
  retainingWalls(out);
  const westEntrance = westernSector(out, detail, tier !== 'skyline');
  if (!westEntrance) return;
  octagonalHall(out, detail);
  const northGallery = cryptoportico(out, detail);
  const { west, east } = visitorRouteSections();
  galleries(out, detail, west, true);
  galleries(out, detail, east);
  landingRoom(out, [westEntrance, endOf(west[0], false)], detail);
  landingRoom(out, [endOf(west.at(-1), true), northGallery, endOf(east[0], false)], detail);
}

export const buildSkyline = (out) => buildDomusAurea(out, 'skyline');
export const buildDistrict = (out) => buildDomusAurea(out, 'district');
export const buildStreet = (out) => buildDomusAurea(out, 'street');
export const buildCloseup = (out) => buildDomusAurea(out, 'closeup');
