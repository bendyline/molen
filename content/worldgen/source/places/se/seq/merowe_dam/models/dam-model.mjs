import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  datum: 261.9753712222222,
  crestElevation: 303,
  poolElevation: 300,
  foundationElevation: 237,
  tailwaterElevation: 259.67205516666667,
  crest: [
    [-4970, -540],
    [-4770, -537],
    [-3789, -544],
    [-3751, -541],
    [-2680, -376],
    [-1469, -192],
    [-568, -56],
    [-315, -39],
    [-166, -13],
    [92, -3],
    [142, -11],
    [480, -150],
    [528, -162],
    [740, -158],
    [1126, -149],
    [1534, -134],
    [1948, -125],
    [2045, -125],
    [2850, -385],
    [2946, -426],
    [4014, -537],
    [4110, -509],
    [4320, -390],
  ],
  spillway: { ends: [-78, 76], lowSluices: 12, overflowGates: 2 },
  intake: {
    start: [142, -11],
    end: [480, -150],
    turbines: 10,
    stationLength: 335,
    stationWidth: 43,
  },
};
const color = {
  wall: [0.47, 0.4, 0.32],
  pier: [0.55, 0.45, 0.34],
  shade: [0.16, 0.146, 0.13],
  stone: [0.43, 0.34, 0.23],
  dirt: [0.54, 0.43, 0.3],
  paving: [0.29, 0.27, 0.24],
  golden: [0.56, 0.41, 0.23],
  grey: [0.36, 0.4, 0.39],
  seam: [0.46, 0.45, 0.4],
  gate: [0.3, 0.32, 0.3],
  red: [0.64, 0.16, 0.07],
  glass: [0.22, 0.27, 0.27],
};
export const damSurfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  pier: { slot: 'wall', graph: 'concrete_boardformed' },
  shade: { slot: 'wall', graph: 'concrete_boardformed' },
  stone: { slot: 'foundation', graph: 'gravel' },
  dirt: { slot: 'foundation', graph: 'gravel' },
  paving: { slot: 'foundation', graph: 'concrete_plain' },
  golden: { slot: 'wall', graph: 'concrete_plain' },
  grey: { slot: 'roof', graph: 'metal_standing_seam' },
  seam: { slot: 'roof', graph: 'metal_standing_seam' },
  gate: { slot: 'door', graph: 'metal_painted' },
  red: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
};
const quality = {
  skyline: { domeSides: 6, domeRings: 2 },
  district: { domeSides: 12, domeRings: 4, gates: true },
  street: { domeSides: 16, domeRings: 6, gates: true, rail: true },
  closeup: { domeSides: 24, domeRings: 8, gates: true, rail: true, seams: true },
  master: { domeSides: 32, domeRings: 10, gates: true, rail: true, seams: true },
};
const {
  crest: trace,
  datum,
  crestElevation,
  foundationElevation,
  tailwaterElevation,
  spillway,
  intake,
} = controls;
const y = (elevation) => elevation - datum;
const top = y(crestElevation);
const foot = y(foundationElevation);
const tail = y(tailwaterElevation);
const lerp = (a, b, t) => a + (b - a) * t;
const identity = (p) => p;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function q(out, points, material, outward) {
  let normal = normalFor(...points);
  if (dot(normal, outward) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  out.addQuad(material, 'palette:#ffffff', points, normal, undefined, color[material]);
}

function triangle(out, points, material, outward) {
  let normal = normalFor(...points);
  if (dot(normal, outward) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  out.addTriangle(material, 'palette:#ffffff', points, normal, undefined, color[material]);
}

function solid(out, transform, x0, x1, y0, y1, z0, z1, material) {
  const point = (x, h, z) => transform([x, h, z]);
  const origin = point(0, 0, 0);
  const quad = (points, normal) =>
    q(
      out,
      points.map((p) => point(...p)),
      material,
      point(...normal).map((v, i) => v - origin[i]),
    );
  quad(
    [
      [x0, y1, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ],
    [0, 1, 0],
  );
  quad(
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
  );
  quad(
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y0, z0],
    ],
    [0, 0, -1],
  );
  quad(
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
  );
  quad(
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    [-1, 0, 0],
  );
  quad(
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [1, 0, 0],
  );
}

function frame(a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]),
    c = (b[0] - a[0]) / d,
    s = (b[1] - a[1]) / d;
  return { length: d, world: ([x, h, z]) => [a[0] + c * x - s * z, h, a[1] + s * x + c * z] };
}

function station(x) {
  const i = trace.findIndex((p) => p[0] >= x);
  if (i <= 0) return trace[i === 0 ? 0 : trace.length - 1][1];
  const [a, z] = trace[i - 1],
    [b, w] = trace[i];
  return lerp(z, w, (x - a) / (b - a));
}

const fillRuns = [
  {
    span: [-4970, -78],
    breakpoints: [
      [-4970, 9],
      [-4770, 9],
      [-3789, 24],
      [-2680, 31],
      [-1469, 44],
      [-568, 52],
      [-315, 57],
      [-78, 57],
    ],
    slopes: [1.3, 1.6],
  },
  {
    span: [76, 142],
    breakpoints: [
      [76, 62],
      [142, 62],
    ],
    slopes: [0.24, 0.38],
  },
  {
    span: [480, 4320],
    breakpoints: [
      [480, 55],
      [740, 66],
      [1126, 62],
      [1360, 51],
      [1948, 37],
      [2850, 20],
      [4014, 10],
      [4320, 8],
    ],
    slopes: [1.5, 1.72],
  },
];

function fill(out, run, detail) {
  const [a, b] = run.span;
  const xs = [
    ...new Set([
      a,
      b,
      ...trace.filter(([x]) => x > a && x < b).map(([x]) => x),
      ...run.breakpoints.map(([x]) => x),
    ]),
  ].sort((u, v) => u - v);
  const depth = (x) => {
    const i = run.breakpoints.findIndex(([u]) => x <= u);
    if (i === 0) return run.breakpoints[0][1];
    const [x0, d0] = run.breakpoints[i - 1],
      [x1, d1] = run.breakpoints[i];
    return lerp(d0, d1, (x - x0) / (x1 - x0));
  };
  const rings = xs.map((x) => {
    const z = station(x),
      h = depth(x),
      [up, down] = run.slopes;
    // Match the interface plane at each concrete structure's rotated end.
    const axis =
      x === intake.start[0] || x === intake.end[0]
        ? [intake.start, intake.end]
        : spillway.ends.includes(x)
          ? spillway.ends.map((end) => [end, station(end)])
          : undefined;
    const endFrame = axis && frame(...axis);
    const offset = endFrame && x === axis[1][0] ? endFrame.length : 0;
    const p = (height, depth) =>
      endFrame ? endFrame.world([offset, height, depth]) : [x, height, z + depth];
    return [p(top - h, -5 - up * h), p(top, -5), p(top, 5), p(top - h, 5 + down * h)];
  });
  for (let i = 1; i < rings.length; i++) {
    const u = rings[i - 1],
      v = rings[i];
    q(out, [u[0], v[0], v[1], u[1]], run.span[0] === 76 ? 'wall' : 'pier', [0, 0.5, -1]);
    q(out, [u[1], v[1], v[2], u[2]], 'paving', [0, 1, 0]);
    q(out, [u[2], v[2], v[3], u[3]], run.span[0] === 76 ? 'wall' : 'stone', [0, 0.5, 1]);
    if (detail.rail)
      for (const j of [1, 2]) {
        const lift = ([x, h, z]) => [x, h + 0.42, z + (j === 1 ? 0.32 : -0.32)];
        beam(out, 'pier', lift(u[j]), lift(v[j]), 0.32, 0.34, color.pier);
      }
  }
  q(out, rings[0], 'stone', [-1, 0, 0]);
  q(out, rings.at(-1), 'stone', [1, 0, 0]);
}

function spill(out, detail) {
  const [left, right] = spillway.ends;
  const { world, length } = frame([left, station(left)], [right, station(right)]);
  const box = (x0, x1, y0, y1, z0, z1, m) => solid(out, world, x0, x1, y0, y1, z0, z1, m);
  const line = (a, b, w, d, m) => beam(out, m, world(a), world(b), w, d, color[m]);
  const low = y(264),
    high = y(280.5),
    topGate = y(294);
  box(0, length, foot, low, -13, 18, 'wall');
  box(0, length, low, top, -13, -8, 'wall');
  box(0, length, low + 7, high, -8, 9, 'wall');
  box(0, length, topGate, top, -8, 6, 'wall');
  const count = spillway.lowSluices,
    bay = length / count;
  for (let i = 0; i < count; i++) {
    const x = i * bay;
    box(x, x + 2.2, low, low + 7, -8, 16, 'pier');
    box(x + 2.2, x + bay, low + 0.18, low + 6.82, -7, -6.6, 'shade');
    if (detail.gates) {
      const side = x + 1.1;
      const high = topGate,
        sill = low - 0.4,
        west = side - 1.12,
        east = side + 1.12;
      q(
        out,
        [
          [west, high, 6],
          [east, high, 6],
          [east, sill, 47],
          [west, sill, 47],
        ].map(world),
        'pier',
        [0, 1, 1],
      );
      for (const [x, direction] of [
        [west, -1],
        [east, 1],
      ]) {
        triangle(
          out,
          [
            [x, high, 6],
            [x, sill, 47],
            [x, sill, 6],
          ].map(world),
          'wall',
          [direction, 0, 0],
        );
      }
      box(side - 1.1, side + 1.1, tail - 4, low + 1, 36, 53, 'pier');
    }
  }
  box(length - 2.2, length, low, high, -8, 18, 'pier');
  for (let i = 0; i < spillway.overflowGates; i++) {
    const a = (i * length) / 2,
      b = ((i + 1) * length) / 2;
    box(a, a + 3.4, high, topGate, -8, 13, 'pier');
    box(a + 3.4, b, high, topGate, -7.8, -7.3, 'gate');
    if (detail.gates)
      for (const h of [high + 2, high + 5, high + 9, high + 12]) {
        line([a + 3.9, h, -7.1], [b - 0.5, h, -7.1], 0.22, 0.42, 'gate');
      }
  }
  box(length - 3.4, length, high, topGate, -8, 13, 'pier');
  box(0, length, low + 0.2, low + 1.25, 38, 46, 'paving');
  box(0, length, top - 0.24, top + 0.35, -7.5, 5.5, 'paving');
  if (detail.rail)
    for (const z of [38.3, 45.7]) {
      line([0.5, low + 2.1, z], [length - 0.5, low + 2.1, z], 0.17, 0.18, 'gate');
      for (let x = 3; x < length - 2; x += 6)
        line([x, low + 1.1, z], [x, low + 2.1, z], 0.14, 0.14, 'gate');
    }
}

function dome(out, world, center, detail) {
  const [x, h, z] = center;
  const radius = 8.1,
    height = 7.8;
  const point = (theta, phi) => {
    const r = radius * Math.cos(phi);
    return world([x + r * Math.cos(theta), h + height * Math.sin(phi), z + r * Math.sin(theta)]);
  };
  const steps = detail.domeSides,
    rings = detail.domeRings;
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI * 2) / steps,
      b = ((i + 1) * Math.PI * 2) / steps;
    for (let j = 0; j < rings - 1; j++) {
      const p = (j * Math.PI) / 2 / rings,
        t = ((j + 1) * Math.PI) / 2 / rings;
      q(
        out,
        [point(a, p), point(a, t), point(b, t), point(b, p)],
        detail.seams && i % 4 === 0 ? 'seam' : 'grey',
        [0, 1, 0],
      );
    }
    const p = ((rings - 1) * Math.PI) / 2 / rings;
    const points = [point(a, p), point(a, Math.PI / 2), point(b, p)];
    out.addTriangle('grey', 'palette:#ffffff', points, normalFor(...points), undefined, color.grey);
  }
}

function stationHouse(out, detail) {
  const { world, length } = frame(intake.start, intake.end);
  const box = (x0, x1, y0, y1, z0, z1, m) => solid(out, world, x0, x1, y0, y1, z0, z1, m);
  const line = (a, b, w, d, m) => beam(out, m, world(a), world(b), w, d, color[m]);
  const roof = y(270),
    terrace = y(268.9),
    base = foot + 2;
  const x0 = (length - intake.stationLength) / 2,
    x1 = length - x0,
    front = 90;
  box(0, length, foot, top, -11, 7, 'wall');
  box(0, length, foot, top - 11, 7, 25, 'wall');
  box(0, length, foot, top - 23, 25, 43, 'wall');
  box(x0, x1, base, roof, front - intake.stationWidth, front, 'golden');
  box(x0 - 3, x1 + 3, roof, roof + 0.42, front - intake.stationWidth - 1, front + 1, 'paving');
  const bay = intake.stationLength / intake.turbines;
  for (let i = 0; i < intake.turbines; i++) {
    const x = x0 + (i + 0.5) * bay;
    dome(out, world, [x, roof + 0.42, front - 18], detail);
    box(x - 6.2, x + 6.2, base + 0.3, tail + 2.1, front - 0.3, front + 0.3, 'shade');
    if (detail.gates) {
      box(x - 6.8, x + 6.8, roof + 0.43, roof + 1.02, front - 35, front - 31, 'pier');
      box(x - 1.5, x + 1.5, roof + 0.43, roof + 1.45, front - 34.4, front - 31.2, 'grey');
      for (const d of [-4.5, 4.5]) {
        line([x + d, y(284.5), 25], [x + d, roof + 0.5, front - 45], 1.25, 1.25, 'gate');
      }
    }
  }
  box(-28, 13, foot + 3, terrace, 65, 129, 'wall');
  box(-25, -3, terrace, terrace + 19, 76, 101, 'golden');
  const stairTop = terrace + 20;
  const stairRings = [terrace, stairTop].map((h) =>
    radialRing(h, 4.8, 3.9, detail.seams ? 20 : detail.gates ? 10 : 8, [-20, 101]).map(world),
  );
  loft(out, 'grey', stairRings, color.grey);
  if (detail.gates)
    for (let i = 1; i < 5; i++) {
      const h = terrace + i * 3.6;
      box(-25.2, -3, h, h + 0.52, 100.92, 101.23, 'glass');
    }
  if (detail.rail)
    for (const z of [front - 0.35, front - intake.stationWidth + 0.5]) {
      line([x0, roof + 1.2, z], [x1, roof + 1.2, z], 0.16, 0.16, 'gate');
      for (let x = x0 + 3; x < x1 - 1; x += 6)
        line([x, roof + 0.4, z], [x, roof + 1.2, z], 0.13, 0.13, 'gate');
    }
}

export function buildDamLevel(out, level) {
  const detail = quality[level];
  if (!detail) throw Error('Unknown Merowe Dam detail level: ' + level);
  for (const run of fillRuns) fill(out, run, detail);
  spill(out, detail);
  stationHouse(out, detail);
}

export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
