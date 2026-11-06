import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [-57.938498675, -31.274731806],
  heading: -0.532543345243,
  datum: 32.011632375,
  crestElevation: 39.5,
  surveyedDeck: [-1253.60033, 1213.27553],
  roadCenters: [
    [-1253.60033, 0.00084],
    [-856.94033, 0.55165],
    [-791.41751, 0.14975],
    [-392.58467, 2.37698],
    [45.02393, 4.55604],
    [795.21729, 5.86249],
    [859.50993, 5.88631],
    [925.82049, 5.31318],
    [1213.27553, -0.0007],
  ],
  concrete: [-426, 426],
  spillway: { span: [-180.5, 180.5], bays: 19 },
  plants: [
    { span: [-416.5, -180.5], units: 7, tailwaterEdge: 81.7 },
    { span: [180.5, 416.5], units: 7, tailwaterEdge: 78.5 },
  ],
  earthfill: [
    { span: [-1253.60033, -426], downstreamToe: 72, endCrest: 36.15 },
    { span: [426, 1213.27553], downstreamToe: 80, endCrest: 34.2 },
  ],
};
const c = {
  wall: [0.41, 0.405, 0.37],
  light: [0.59, 0.58, 0.53],
  shade: [0.18, 0.205, 0.21],
  gravel: [0.29, 0.29, 0.23],
  bank: [0.33, 0.37, 0.2],
  deck: [0.36, 0.35, 0.33],
  roof: [0.64, 0.65, 0.61],
  glass: [0.19, 0.31, 0.37],
  steel: [0.35, 0.37, 0.37],
  ochre: [0.78, 0.43, 0.071],
};
export const damSurfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  light: { slot: 'wall', graph: 'concrete_plain' },
  shade: { slot: 'wall', graph: 'concrete_boardformed' },
  deck: { slot: 'foundation', graph: 'concrete_plain' },
  gravel: { slot: 'foundation', graph: 'gravel' },
  bank: { slot: 'foundation', graph: 'gravel' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  glass: { slot: 'window', graph: 'window_grid' },
  steel: { slot: 'door', graph: 'metal_painted' },
  ochre: { slot: 'door', graph: 'metal_painted' },
};
const quality = {
  skyline: { roofSides: 2 },
  district: { roofSides: 6, structures: true },
  street: { roofSides: 10, structures: true, details: true },
  closeup: { roofSides: 16, structures: true, details: true, fine: true },
  master: { roofSides: 22, structures: true, details: true, fine: true },
};
const { crestElevation, datum, concrete, spillway, plants, earthfill, roadCenters } = controls;
const y = (h) => h - datum,
  crest = y(crestElevation),
  foot = y(-24);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix = (a, b, t) => a + (b - a) * t;
const deckHalfWidth = 6.4;

function roadZ(x) {
  const i = roadCenters.findIndex(([station]) => station >= x);
  if (i < 1) return roadCenters[i === 0 ? 0 : roadCenters.length - 1][1];
  const [a, z] = roadCenters[i - 1],
    [b, w] = roadCenters[i];
  return mix(z, w, (x - a) / (b - a));
}
function deckY(x) {
  if (x >= concrete[0] && x <= concrete[1]) return crest;
  const run = x < concrete[0] ? earthfill[0] : earthfill[1];
  const [a, b] = run.span,
    outer = x < 0 ? a : b,
    inner = x < 0 ? b : a;
  return y(mix(run.endCrest, crestElevation, (x - outer) / (inner - outer)));
}
const roadStations = [...new Set([...roadCenters.map(([x]) => x), ...concrete])].sort(
  (a, b) => a - b,
);
export const deckProfile = roadStations.map((x) => [x, deckY(x), roadZ(x)]);
export const occupiedDeckOutline = [
  ...deckProfile.map(([x, , z]) => [x, z - deckHalfWidth]),
  ...deckProfile.toReversed().map(([x, , z]) => [x, z + deckHalfWidth]),
];

function q(out, points, m, wanted) {
  let normal = normalFor(...points);
  if (dot(normal, wanted) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  out.addQuad(m, 'palette:#ffffff', points, normal, undefined, c[m]);
}
function box(out, a, b, low, high, z, w, m) {
  q(
    out,
    [
      [a, low, z],
      [b, low, z],
      [b, high, z],
      [a, high, z],
    ],
    m,
    [0, 0, -1],
  );
  q(
    out,
    [
      [a, low, w],
      [b, low, w],
      [b, high, w],
      [a, high, w],
    ],
    m,
    [0, 0, 1],
  );
  q(
    out,
    [
      [a, high, z],
      [b, high, z],
      [b, high, w],
      [a, high, w],
    ],
    m,
    [0, 1, 0],
  );
  q(
    out,
    [
      [a, low, z],
      [b, low, z],
      [b, low, w],
      [a, low, w],
    ],
    m,
    [0, -1, 0],
  );
  q(
    out,
    [
      [a, low, z],
      [a, high, z],
      [a, high, w],
      [a, low, w],
    ],
    m,
    [-1, 0, 0],
  );
  q(
    out,
    [
      [b, low, z],
      [b, high, z],
      [b, high, w],
      [b, low, w],
    ],
    m,
    [1, 0, 0],
  );
}
const rail = (out, a, b, m, w = 0.16, h = 0.19) => beam(out, m, a, b, w, h, c[m]);

function earthwork(out, run, detail) {
  const [a, b] = run.span,
    west = a < 0,
    outer = west ? a : b,
    inner = west ? b : a;
  const stations = roadStations.filter((x) => x >= a && x <= b);
  const rings = stations.map((x) => {
    const t = Math.abs((x - outer) / (inner - outer)),
      h = deckY(x) - 0.65,
      z = roadZ(x);
    return [
      [x, y(29 - 12 * t), z - 13 - 10 * t],
      [x, h, z - deckHalfWidth],
      [x, h, z + deckHalfWidth],
      [x, y(29 - 15 * t), z + 13 + run.downstreamToe * t],
    ];
  });
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      b = rings[i];
    q(out, [a[0], b[0], b[1], a[1]], 'gravel', [0, 1, -1]);
    q(out, [a[2], b[2], b[3], a[3]], 'bank', [0, 1, 1]);
  }
  if (detail.structures) {
    const ring = west ? rings[0] : rings.at(-1);
    const cap = ring.map(([x, h, z], i) => [x, i === 1 || i === 2 ? deckY(x) : h, z]);
    q(out, cap, 'wall', [west ? -1 : 1, 0, 0]);
  }
}
function crestRoad(out, detail) {
  const [a, b] = concrete;
  box(out, a, b, foot, crest - 0.55, -14, -6.4, 'wall');
  const point = ([x, h, z], dy, dz) => [x, h + dy, z + dz];
  for (let i = 1; i < deckProfile.length; i++) {
    const u = deckProfile[i - 1],
      v = deckProfile[i],
      w = deckHalfWidth;
    q(out, [point(u, 0, -w), point(v, 0, -w), point(v, 0, w), point(u, 0, w)], 'deck', [0, 1, 0]);
    for (const side of [-1, 1]) {
      const z = side * w;
      q(out, [point(u, -0.65, z), point(v, -0.65, z), point(v, 0, z), point(u, 0, z)], 'wall', [
        0,
        0,
        side,
      ]);
      if (detail.structures)
        rail(
          out,
          point(u, 0.42, z - 0.17 * side),
          point(v, 0.42, z - 0.17 * side),
          'light',
          0.24,
          0.82,
        );
    }
    if (detail.details)
      for (const z of [0.2, 1.635]) {
        rail(out, point(u, 0.045, z), point(v, 0.045, z), 'steel', 0.075, 0.06);
      }
  }
  if (detail.fine)
    for (let x = a + 7; x < b - 4; x += 11) {
      rail(
        out,
        [x, crest + 0.045, roadZ(x) - 2.6],
        [x + 3.1, crest + 0.045, roadZ(x + 3.1) - 2.6],
        'light',
        0.1,
        0.035,
      );
    }
}
function spill(out, detail) {
  const [a, b] = spillway.span,
    bay = (b - a) / spillway.bays,
    gateTop = y(31.3),
    sill = y(12.6),
    toe = y(2.5);
  box(out, a, b, foot, sill, -10, 18, 'wall');
  box(out, a, b, gateTop, crest - 0.62, -8.4, 8.3, 'wall');
  for (let i = 0; i < spillway.bays; i++) {
    const x = a + i * bay,
      edge = x + 2.3,
      end = x + bay;
    box(out, x, edge, sill, gateTop, -7.9, 12.2, 'wall');
    box(out, edge, end - 0.32, sill + 0.26, gateTop - 0.24, -7.35, -7.04, 'shade');
    q(
      out,
      [
        [edge, sill, 10],
        [end - 0.25, sill, 10],
        [end - 0.25, toe, 61],
        [edge, toe, 61],
      ],
      'wall',
      [0, 1, 1],
    );
    if (detail.structures) {
      box(out, x, edge, toe, sill, -2, 59, 'wall');
      q(
        out,
        [
          [x, gateTop, 8],
          [edge, gateTop, 8],
          [edge, sill, 41],
          [x, sill, 41],
        ],
        'light',
        [0, 1, 1],
      );
      box(out, x + 0.32, edge - 0.26, gateTop, gateTop + 2.7, -0.3, 3.4, 'ochre');
    }
    if (detail.details)
      for (const h of [sill + 3.4, sill + 8.5, sill + 13.6]) {
        rail(out, [edge + 0.32, h, -6.9], [end - 0.6, h, -6.9], 'steel', 0.23, 0.24);
      }
  }
  box(out, b - 2.1, b, foot, gateTop, -8, 14, 'wall');
  box(out, a, b, foot, toe, -7, 60.8, 'wall');
}
function roof(out, a, b, detail) {
  const eaves = y(27.8),
    mid = 55.5,
    radius = 13.7;
  const pos = (x, t) => [x, eaves + 4.2 * Math.sin(t), mid + radius * Math.cos(t)];
  for (let i = 0; i < detail.roofSides; i++) {
    const t = (i * Math.PI) / detail.roofSides,
      s = ((i + 1) * Math.PI) / detail.roofSides;
    const points = [pos(a, t), pos(b, t), pos(b, s), pos(a, s)];
    q(out, points, 'roof', [0, 1, 0]);
    if (detail.fine && i % 4 === 0) rail(out, pos(a, t), pos(b, t), 'roof', 0.15, 0.14);
    for (const [x, sign] of [
      [a, -1],
      [b, 1],
    ]) {
      let tri = [pos(x, t), pos(x, s), [x, eaves, mid]];
      let normal = normalFor(...tri);
      if (normal[0] * sign < 0) {
        tri = tri.toReversed();
        normal = normalFor(...tri);
      }
      out.addTriangle('light', 'palette:#ffffff', tri, normal, undefined, c.light);
    }
  }
}
function powerhouse(out, plant, detail) {
  const [a, b] = plant.span,
    z = plant.tailwaterEdge,
    base = y(6.5),
    upper = y(27.8);
  const lowerGate = y(-10.5),
    upperGate = y(4.1),
    recess = 4.5;
  const outer = a < 0 ? concrete[0] : concrete[1];
  box(out, Math.min(a, outer), Math.max(b, outer), foot, crest - 0.62, -6.4, 8.3, 'wall');
  box(out, Math.min(a, outer), Math.max(b, outer), foot, y(19.8), 8.3, 12.05, 'wall');
  if (a < 0) box(out, outer, a, foot, base, 12, z, 'wall');
  else box(out, b, outer, foot, base, 12, z, 'wall');
  box(out, a, b, foot, base, 12, z - recess, 'wall');
  box(out, a, b, foot, lowerGate, z - recess, z, 'wall');
  box(out, a, b, upperGate, base, z - recess, z, 'wall');
  box(out, a, b, base, upper, 42, 69, 'light');
  box(out, a, b, base - 0.24, base + 0.68, 67, z, 'deck');
  roof(out, a, b, detail);
  const bay = (b - a) / plant.units;
  const outletFront = (left, right) =>
    q(
      out,
      [
        [left, lowerGate, z],
        [right, lowerGate, z],
        [right, upperGate, z],
        [left, upperGate, z],
      ],
      'wall',
      [0, 0, 1],
    );
  let frontStart = a;
  for (let i = 0; i < plant.units; i++) {
    const x = a + (i + 0.5) * bay,
      left = x - 7.5,
      right = x + 7.5;
    outletFront(frontStart, left);
    frontStart = right;
    for (const [edge, side] of [
      [left, 1],
      [right, -1],
    ]) {
      q(
        out,
        [
          [edge, lowerGate, z],
          [edge, upperGate, z],
          [edge, upperGate, z - recess],
          [edge, lowerGate, z - recess],
        ],
        'wall',
        [side, 0, 0],
      );
    }
    q(
      out,
      [
        [left, lowerGate, z - recess + 0.025],
        [right, lowerGate, z - recess + 0.025],
        [right, upperGate, z - recess + 0.025],
        [left, upperGate, z - recess + 0.025],
      ],
      'shade',
      [0, 0, 1],
    );
    if (detail.structures) {
      box(out, x - 9.4, x + 9.4, upper - 8.1, upper - 3.2, 68.88, 69.1, 'glass');
      box(out, x - bay * 0.5, x - bay * 0.5 + 1.8, foot, upper, z - 0.2, z + 1.25, 'wall');
      box(out, x - 3.9, x + 3.9, y(25.2), y(27.4), 35.5, 40, 'steel');
    }
    if (detail.details)
      for (let j = -6; j <= 6; j += 3)
        rail(out, [x + j, upper - 8.05, 69.21], [x + j, upper - 3.25, 69.21], 'steel', 0.1, 0.1);
  }
  outletFront(frontStart, b);
  for (const [edge, side] of [
    [a, -1],
    [b, 1],
  ]) {
    q(
      out,
      [
        [edge, lowerGate, z],
        [edge, upperGate, z],
        [edge, upperGate, z - recess],
        [edge, lowerGate, z - recess],
      ],
      'wall',
      [side, 0, 0],
    );
  }
  const nearSpill = a < 0 ? b : a;
  box(out, nearSpill - 2.6, nearSpill + 2.6, foot, y(12), 54, z + 16, 'wall');
}
function gantry(out, x, z, detail) {
  const bottom = y(35),
    top = y(50);
  for (const a of [-3.7, 3.7])
    for (const b of [-2.4, 2.4])
      rail(out, [x + a, bottom, z + b], [x + a * 0.83, top - 1, z + b * 0.73], 'ochre', 0.55, 0.64);
  box(out, x - 4.5, x + 4.5, top - 1.45, top, z - 2.65, z + 2.65, 'ochre');
  if (detail.details) {
    box(out, x - 0.88, x + 1.15, top - 2.6, top + 0.22, z - 1.33, z + 1.33, 'steel');
    for (const b of [-2.25, 2.25])
      rail(out, [x - 3.3, top - 2, z + b], [x + 3.3, bottom + 2, z + b], 'ochre', 0.31, 0.32);
  }
}
export function buildDamLevel(out, level) {
  const detail = quality[level];
  if (!detail) throw Error('Unknown Salto Grande detail level: ' + level);
  for (const run of earthfill) earthwork(out, run, detail);
  crestRoad(out, detail);
  spill(out, detail);
  for (const plant of plants) powerhouse(out, plant, detail);
  if (detail.structures) for (const x of [-408, 193]) gantry(out, x, 16, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
