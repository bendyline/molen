import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

// The retained map is a short skewed crossing. The 197 m catalog quantity is
// incompatible with that footprint and the ordinary exterior photograph.
export const bridgeControls = {
  anchor: [30.31907715, 59.9304588],
  heading: -0.941454664091,
  datum: 25,
  deck: 28.5,
  length: 19.466,
  width: 14.329,
  halfSpan: 9.04,
  landingExtension: 0.65,
  arch: { center: 0.55, halfWidth: 6.9, spring: -3.8, rise: 3.0 },
  outline: [
    [8.347, 7.164],
    [8.467, 5.941],
    [8.901, 1.448],
    [9.215, -1.801],
    [9.636, -6.2],
    [9.733, -7.164],
    [-8.356, -7.095],
    [-8.467, -6.016],
    [-8.865, -1.649],
    [-9.198, 1.607],
    [-9.601, 5.791],
    [-9.733, 7.164],
  ],
};
const palette = {
  stone: { slot: 'wall', graph: 'stone_granite', rgb: [0.64, 0.58, 0.54] },
  joint: { slot: 'wall', graph: 'stone_granite', rgb: [0.31, 0.29, 0.27] },
  trim: { slot: 'trim', graph: 'stone_granite', rgb: [0.68, 0.63, 0.59] },
  metal: { slot: 'trim', graph: 'metal_painted', rgb: [0.14, 0.17, 0.17] },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.28, 0.29, 0.29] },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.57, 0.56, 0.53] },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  off = bridgeControls.deck - bridgeControls.datum;
const P = (u, y, z) => [u - 0.0967 * z, off + y, z],
  crown = (u) => 0.55 * Math.max(0, 1 - (u * u) / (9.04 * 9.04));
const archY = (u) => {
  const a = bridgeControls.arch,
    q = (u - a.center) / a.halfWidth;
  return Math.abs(q) <= 1 ? a.spring + a.rise * Math.sqrt(Math.max(0, 1 - q * q)) : -9;
};
const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, u, y, z, w, h, d) => rod(o, m, P(u, y - h / 2, z), P(u, y + h / 2, z), d, w);
function face(o, m, p, n, color = palette[m].rgb) {
  let N = normalFor(...p);
  if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    N = normalFor(...p);
  }
  o[p.length === 3 ? 'addTriangle' : 'addQuad'](m, 'palette:#ffffff', p, N, undefined, color);
}
function structure(o, t) {
  const n = [8, 14, 24, 32, 44][t],
    { arch: a } = bridgeControls,
    z0 = -7.1,
    z1 = 7.1;
  const stations = [
    -9.04,
    a.center - a.halfWidth,
    ...Array.from(
      { length: n - 1 },
      (_, i) => a.center + a.halfWidth * Math.cos(Math.PI - ((i + 1) * Math.PI) / n),
    ),
    a.center + a.halfWidth,
    9.04,
  ];
  for (let i = 1; i < stations.length; i++) {
    const u = stations[i - 1],
      v = stations[i],
      leg = i === 1 || i === stations.length - 1,
      Y = leg ? -9 : archY(u),
      Z = leg ? -9 : archY(v),
      y = crown(u) - 0.17,
      z = crown(v) - 0.17;
    for (const side of [-1, 1])
      face(
        o,
        'stone',
        [P(u, Y, side * 7.1), P(v, Z, side * 7.1), P(v, z, side * 7.1), P(u, y, side * 7.1)],
        [0, 0, side],
      );
    face(o, 'stone', [P(u, Y, z0), P(u, Y, z1), P(v, Z, z1), P(v, Z, z0)], [0, -1, 0]);
  }
  for (const u of [-9.04, 9.04])
    face(
      o,
      'stone',
      [P(u, -9, z0), P(u, -9, z1), P(u, -0.17, z1), P(u, -0.17, z0)],
      [Math.sign(u), 0, 0],
    );
  for (const side of [-1, 1]) {
    const u = a.center + side * a.halfWidth;
    face(
      o,
      'stone',
      [P(u, -9, z0), P(u, -9, z1), P(u, a.spring, z1), P(u, a.spring, z0)],
      [-side, 0, 0],
    );
  }
  // Skewed short bearings join the retained native approaches rather than
  // replacing neighboring canal walls, buildings or streets.
  for (const u of [-9.365, 9.365]) box(o, 'stone', u, -4.56, 0, 0.65, 8.88, 14.2);
  const k = [6, 12, 20, 28, 36][t],
    end = 9.69;
  for (let i = 0; i < k; i++) {
    const u = -end + (2 * end * i) / k,
      v = -end + (2 * end * (i + 1)) / k;
    const y = crown(u),
      Y = crown(v);
    face(o, 'road', [P(u, y, -4.5), P(v, Y, -4.5), P(v, Y, 4.5), P(u, y, 4.5)], [0, 1, 0]);
    for (const side of [-1, 1]) {
      const h = (x) => 0.13 * Math.min(1, Math.max(0, (end - Math.abs(x)) / 1.1));
      face(
        o,
        'walk',
        [
          P(u, y + h(u), side * 4.5),
          P(v, Y + h(v), side * 4.5),
          P(v, Y + h(v), side * 7.1),
          P(u, y + h(u), side * 7.1),
        ],
        [0, 1, 0],
      );
      if (h(u) + h(v) > 0.00001) {
        const p = [
          P(u, y, side * 4.5),
          P(v, Y, side * 4.5),
          P(v, Y + h(v), side * 4.5),
          P(u, y + h(u), side * 4.5),
        ];
        if (h(u) < 0.00001) p.pop();
        else if (h(v) < 0.00001) p.splice(2, 1);
        face(o, 'trim', p, [0, 0, -side]);
      }
    }
  }
  // Continuous rounded cornice, arch ring and coursed granite joints.
  for (const side of [-1, 1]) {
    const z = side * 7.16;
    for (let i = 0; i < k; i++) {
      const u = -9.69 + (19.38 * i) / k,
        v = -9.69 + (19.38 * (i + 1)) / k;
      rod(o, 'trim', P(u, crown(u) - 0.1, z), P(v, crown(v) - 0.1, z), 0.36, 0.22);
      if (t > 0) rod(o, 'trim', P(u, crown(u) - 0.29, z), P(v, crown(v) - 0.29, z), 0.23, 0.11);
    }
    if (t === 0) continue;
    for (let i = 0; i < n; i++) {
      const theta = Math.PI - (i / n) * Math.PI,
        Theta = Math.PI - ((i + 1) / n) * Math.PI;
      const u = a.center + Math.cos(theta) * a.halfWidth,
        v = a.center + Math.cos(Theta) * a.halfWidth,
        Y = a.spring + Math.sin(theta) * a.rise,
        Z = a.spring + Math.sin(Theta) * a.rise;
      face(
        o,
        'trim',
        [
          P(u, Y, z + 0.012 * side),
          P(v, Z, z + 0.012 * side),
          P(v, Z + 0.48, z + 0.012 * side),
          P(u, Y + 0.48, z + 0.012 * side),
        ],
        [0, 0, side],
        palette.trim.rgb.map((c) => c * (i % 3 === 0 ? 0.94 : 1)),
      );
      if (t > 1)
        rod(
          o,
          'joint',
          P(u, Y + 0.015, z + 0.025 * side),
          P(u, Y + 0.47, z + 0.025 * side),
          0.018,
          0.018,
        );
    }
    if (t < 2) continue;
    for (let row = 0; row < 8; row++) {
      const y = -3.65 + row * 0.52;
      for (let col = 0; col < 20; col++) {
        const u = -9.04 + col * 0.94 + (row % 2 ? 0.47 : 0),
          v = Math.min(9.04, u + 0.91);
        if (u >= 9.04 || v <= u) continue;
        const visible = (x) => y > archY(x) + 0.52 && y < crown(x) - 0.34;
        if (visible(u) && visible(v))
          rod(o, 'joint', P(u, y, z + 0.025 * side), P(v, y, z + 0.025 * side), 0.018, 0.018);
        const low = Math.max(y, archY(v) + 0.53),
          high = Math.min(y + 0.5, crown(v) - 0.34);
        if (high - low > 0.08)
          rod(o, 'joint', P(v, low, z + 0.025 * side), P(v, high, z + 0.025 * side), 0.018, 0.018);
      }
    }
  }
}
function parapets(o, t) {
  const stations = [-9.1, -4.55, 0, 4.55, 9.1],
    loopCount = [0, 3, 6, 7, 8][t],
    arcN = [0, 3, 4, 6, 8][t];
  for (const side of [-1, 1]) {
    const z = side * 6.96;
    for (const u of stations) {
      const y = crown(u);
      box(o, 'stone', u, y + 0.58, z, 0.6, 1.16, 0.65);
      box(o, 'trim', u, y + 1.16, z, 0.79, 0.17, 0.81);
      if (t > 0) {
        box(o, 'trim', u, y + 0.15, z, 0.72, 0.16, 0.74);
        box(o, 'trim', u, y + 1.04, z, 0.66, 0.12, 0.71);
      }
    }
    for (let b = 1; b < stations.length; b++) {
      const start = stations[b - 1] + 0.34,
        end = stations[b] - 0.34;
      for (const h of [0.28, 1.03])
        rod(o, 'metal', P(start, crown(start) + h, z), P(end, crown(end) + h, z), 0.075, 0.07);
      if (t === 0) continue;
      for (let i = 0; i < loopCount; i++) {
        const u = start + ((i + 0.5) * (end - start)) / loopCount,
          base = crown(u),
          rx = 0.12,
          low = base + 0.43,
          high = base + 0.87,
          points = [];
        for (let j = 0; j <= arcN; j++) {
          const a = (j / arcN) * Math.PI;
          points.push(P(u + rx * Math.cos(a), high + rx * Math.sin(a), z));
        }
        for (let j = 0; j <= arcN; j++) {
          const a = Math.PI + (j / arcN) * Math.PI;
          points.push(P(u + rx * Math.cos(a), low + rx * Math.sin(a), z));
        }
        beamPath(o, 'metal', points, 0.033, 0.045, palette.metal.rgb, true);
        if (t > 1) {
          box(o, 'metal', u, base + 0.32, z, 0.17, 0.055, 0.08);
          box(o, 'metal', u, base + 0.99, z, 0.17, 0.055, 0.08);
        }
      }
    }
  }
}
export function buildBridgeLevel(o, level) {
  const t = tiers[level];
  if (t === undefined) throw Error('Unknown bridge tier');
  structure(o, t);
  parapets(o, t);
}
export const buildBridgeSkyline = (o) => buildBridgeLevel(o, 'skyline');
export const buildBridgeDistrict = (o) => buildBridgeLevel(o, 'district');
export const buildBridgeStreet = (o) => buildBridgeLevel(o, 'street');
export const buildBridgeCloseup = (o) => buildBridgeLevel(o, 'closeup');
