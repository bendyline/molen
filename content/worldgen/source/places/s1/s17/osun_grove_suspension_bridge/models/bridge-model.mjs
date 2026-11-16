import {
  beam,
  beamPath,
  cross,
  loft,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const linear = (hex) =>
  hex.match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
const timber = ['756e55', '655e48', '80795d', '6b634d'].map(linear);
const tones = {
  concrete: linear('7e7a66'),
  cap: linear('98917d'),
  steel: linear('504942'),
  brace: linear('645349'),
  cable: linear('6a675e'),
};
export const bridgeSurfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  cap: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  steel: { slot: 'door', graph: 'metal_painted', roughness: 0.88 },
  cable: { slot: 'door', graph: 'metal_painted', roughness: 0.82 },
};
const levels = {
  skyline: { span: 5, planks: 0, panels: 3, hangers: 4, rails: 3, lattice: 0 },
  district: { span: 12, planks: 0, panels: 5, hangers: 10, rails: 7, lattice: 2 },
  street: { span: 22, planks: 42, panels: 7, hangers: 16, rails: 11, lattice: 3 },
  closeup: { span: 28, planks: 91, panels: 8, hangers: 20, rails: 14, lattice: 4 },
  master: { span: 40, planks: 127, panels: 8, hangers: 24, rails: 17, lattice: 4 },
};

export const bridgeLimits = { northwest: -15.819778793, southeast: 15.819775166, halfWidth: 0.79 };
const piers = [-11.15, 8.85];
const knots = [
  [bridgeLimits.northwest, 0.46],
  [piers[0], 1.2],
  [-1.15, 0.76],
  [piers[1], 1.14],
  [bridgeLimits.southeast, 0.39],
];
export function deckElevation(x) {
  for (let i = 1; i < knots.length; i++) {
    const [a, y] = knots[i - 1];
    const [b, end] = knots[i];
    if (x <= b) {
      const t = Math.max(0, (x - a) / (b - a));
      if (i === 1 || i === knots.length - 1) return y + (end - y) * t;
      const curved = i === 2 ? t * (2 - t) : t * t;
      return y + (end - y) * curved;
    }
  }
  return knots.at(-1)[1];
}
const towerHeight = 3.45;
function cableElevation(x) {
  const [a, b] = piers;
  const peakA = deckElevation(a) + towerHeight;
  const peakB = deckElevation(b) + towerHeight;
  const t = (x - a) / (b - a);
  return peakA + (peakB - peakA) * t - 2.45 * 4 * t * (1 - t);
}
const positions = (a, b, count) =>
  Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count);
const ref = 'palette:#ffffff';
function face(out, part, points, color) {
  const delta = (a, b) => a.map((v, i) => v - b[i]);
  const n = normalize(cross(delta(points[1], points[0]), delta(points[2], points[0])));
  out.addTriangle(
    part,
    ref,
    points.slice(0, 3),
    n,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
  out.addTriangle(
    part,
    ref,
    [points[0], points[2], points[3]],
    n,
    [
      [0, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function prism(out, part, x, y0, y1, z, w0, w1, d0, d1, color) {
  const section = (y, w, d) => [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
  loft(out, part, [section(y0, w0, d0), section(y1, w1, d1)], color);
}
function deckStrip(out, left, right, depth, color) {
  const z = bridgeLimits.halfWidth;
  const ya = deckElevation(left),
    yb = deckElevation(right);
  const a = [left, ya, -z],
    b = [left, ya, z],
    c = [right, yb, z],
    d = [right, yb, -z];
  const bottom = (p) => [p[0], p[1] - depth, p[2]];
  face(out, 'timber', [a, b, c, d], color);
  face(out, 'timber', [bottom(d), bottom(c), bottom(b), bottom(a)], color);
  face(out, 'timber', [a, bottom(a), bottom(b), b], color);
  face(out, 'timber', [d, c, bottom(c), bottom(d)], color);
  face(out, 'timber', [a, d, bottom(d), bottom(a)], color);
  face(out, 'timber', [b, bottom(b), bottom(c), c], color);
}

function tower(out, x, detail) {
  const y = deckElevation(x),
    cap = y + towerHeight;
  prism(out, 'concrete', x, -3.8, y - 0.28, 0, 2.75, 1.9, 3.04, 2.46, tones.concrete);
  prism(out, 'cap', x, y - 0.28, y - 0.13, 0, 2.02, 2.02, 2.55, 2.55, tones.cap);
  for (const z of [-0.98, 0.98]) {
    if (detail.lattice === 0) {
      beam(out, 'steel', [x, y - 0.15, z], [x, cap, z], 0.21, 0.19, tones.steel);
      continue;
    }
    for (const dx of [-0.11, 0.11])
      beam(out, 'steel', [x + dx, y - 0.15, z], [x + dx, cap, z], 0.075, 0.1, tones.steel);
    const ys = positions(y - 0.13, cap, detail.panels);
    for (let i = 1; i < ys.length; i++) {
      beam(out, 'steel', [x - 0.145, ys[i], z], [x + 0.145, ys[i], z], 0.055, 0.048, tones.brace);
      beam(out, 'steel', [x - 0.11, ys[i - 1], z], [x + 0.11, ys[i], z], 0.045, 0.048, tones.brace);
      if (detail.lattice >= 3)
        beam(
          out,
          'steel',
          [x + 0.11, ys[i - 1], z],
          [x - 0.11, ys[i], z],
          0.045,
          0.048,
          tones.brace,
        );
    }
  }
  for (const height of [cap - 0.06, cap - 0.87])
    beam(out, 'steel', [x, height, -1.06], [x, height, 1.06], 0.11, 0.13, tones.steel);
  if (detail.lattice > 1)
    for (const sign of [-1, 1])
      beam(
        out,
        'steel',
        [x, cap - 0.82, sign * 0.92],
        [x, cap - 0.12, 0],
        0.072,
        0.075,
        tones.brace,
      );
}

export function buildBridgeLevel(out, name = 'master') {
  const d = levels[name],
    { northwest, southeast } = bridgeLimits;
  const beamStations = [
    ...new Set([
      ...positions(northwest, piers[0], 3),
      ...positions(piers[0], piers[1], d.span),
      ...positions(piers[1], southeast, 4),
    ]),
  ];
  const planks = d.planks ? positions(northwest, southeast, d.planks) : beamStations;
  for (let i = 1; i < planks.length; i++)
    deckStrip(out, planks[i - 1], planks[i], d.planks ? 0.095 : 0.145, timber[i % timber.length]);
  if (d.lattice)
    for (const z of [-0.55, 0.55])
      beamPath(
        out,
        'timber',
        beamStations.map((x) => [x, deckElevation(x) - 0.15, z]),
        0.14,
        0.18,
        timber[1],
      );
  for (const x of piers) tower(out, x, d);
  for (const x of [-13.45, 11.6, 13.85]) {
    const y = deckElevation(x);
    for (const z of [-0.54, 0.54])
      prism(out, 'timber', x, -2.1, y - 0.07, z, 0.18, 0.16, 0.2, 0.16, timber[1]);
    beam(out, 'timber', [x, y - 0.26, -0.69], [x, y - 0.26, 0.69], 0.19, 0.18, timber[2]);
    if (d.lattice >= 2)
      beam(out, 'timber', [x, -0.52, -0.54], [x, y - 0.27, 0.5], 0.12, 0.13, timber[1]);
  }
  const anchorStations = [northwest + 0.27, southeast - 0.27];
  for (const x of anchorStations) {
    const y = deckElevation(x);
    prism(out, 'concrete', x, -1.03, y - 0.11, 0, 0.69, 0.61, 2.35, 2.22, tones.concrete);
    for (const sign of [-1, 1])
      prism(
        out,
        'concrete',
        x,
        -0.46,
        y - 0.08,
        sign * 1.18,
        0.55,
        0.31,
        0.61,
        0.42,
        tones.concrete,
      );
  }
  // The path approaches the northwest bearing obliquely. The stone landing
  // closes the triangular gap beside the timber deck at the shared endpoint.
  const northLanding = [
    [northwest - 0.34, -0.79],
    [northwest - 0.05, 0.79],
    [northwest, 0.79],
    [northwest, -0.79],
  ];
  loft(
    out,
    'cap',
    [-0.85, deckElevation(northwest)].map((y) => northLanding.map(([x, z]) => [x, y, z])),
    tones.cap,
  );
  const main = positions(piers[0], piers[1], d.span);
  for (const sign of [-1, 1]) {
    const cableZ = sign * 0.98,
      railZ = sign * 0.72;
    const ends = anchorStations.map((x) => [x, deckElevation(x) - 0.1, sign * 1.18]);
    beamPath(
      out,
      'cable',
      [ends[0], ...main.map((x) => [x, cableElevation(x), cableZ]), ends[1]],
      0.06,
      0.06,
      tones.cable,
    );
    for (const x of positions(piers[0], piers[1], d.hangers).slice(1, -1)) {
      const y = deckElevation(x);
      beam(
        out,
        'steel',
        [x, y - 0.08, railZ],
        [x, cableElevation(x), cableZ],
        0.021,
        0.021,
        tones.steel,
      );
    }
    for (const x of positions(northwest + 0.12, southeast - 0.12, d.rails))
      beam(
        out,
        'steel',
        [x, deckElevation(x) - 0.14, railZ],
        [x, deckElevation(x) + 0.93, railZ],
        0.042,
        0.042,
        tones.steel,
      );
    for (const y of d.lattice > 1 ? [0.46, 0.91] : [0.91])
      beamPath(
        out,
        'cable',
        beamStations.map((x) => [x, deckElevation(x) + y, railZ]),
        0.038,
        0.038,
        tones.cable,
      );
  }
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
