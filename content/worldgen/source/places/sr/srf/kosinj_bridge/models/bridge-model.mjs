import {
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'kosinj_bridge',
  anchor: [15.2739977, 44.73511085],
  heading: 1.406551380905,
  datum: 482,
  ends: [-38.03, 37.04],
  halfWidth: 3.03,
  roadIds: [35184600378998],
  approachIds: [35185338090320],
  riverId: 35184517495707,
  curve: [
    [-38.03, 0.4],
    [37.04, -0.5],
  ],
  profile: [
    [-38.03, 8.04],
    [-20, 8.22],
    [0, 8.45],
    [20, 8.73],
    [37.04, 8.98],
  ],
  // Station, spring height, and rise fitted to the retained channel and side photographs.
  arches: [
    { left: -31.18, right: -11.62, spring: -0.02, rise: 7.15 },
    { left: -9.36, right: 10.28, spring: -0.14, rise: 7.58 },
    { left: 12.45, right: 30.22, spring: -0.02, rise: 7.71 },
  ],
  oculi: [
    [-10.47, 5.63, 1.93],
    [11.38, 5.85, 2.03],
  ],
  foundation: -2.6,
};

function interpolate(x, points) {
  for (let i = 1; i < points.length; i++) {
    const [a, y] = points[i - 1],
      [b, next] = points[i];
    if (x <= b) return y + (next - y) * Math.max(0, (x - a) / (b - a));
  }
  return points.at(-1)[1];
}
export const deckY = (x) => interpolate(x, bridgeControls.profile);
export const centerZ = (x) => interpolate(x, bridgeControls.curve);
export const deckHalf = (x) =>
  interpolate(x, [
    [-38.03, 3.62],
    [-36.35, 3.03],
    [35.5, 3.03],
    [37.04, 3.62],
  ]);

function surface(slot, graph, hex) {
  const color = [0, 2, 4].map((offset) => {
    const v = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return { slot, graph, color };
}
const palette = {
  face: surface('foundation', 'stone_limestone', 'a6a298'),
  pale: surface('foundation', 'stone_limestone_raw', 'c4bdb0'),
  coping: surface('foundation', 'stone_limestone_raw', 'bcb6a6'),
  lining: surface('foundation', 'stone_limestone_weathered', '938a77'),
  foot: surface('foundation', 'stone_limestone_weathered', '908779'),
  road: surface('foundation', 'concrete_plain', '767775'),
  curb: surface('foundation', 'stone_limestone_raw', 'aea79a'),
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { color, ...rest }]) => [key, rest]),
);

export function buildBridgeLevel(out, level = 'master') {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error(`Unknown Kosinj Bridge level ${level}`);
  const {
    ends: [start, end],
    arches,
    oculi,
    foundation,
    halfWidth,
  } = bridgeControls;
  const archSteps = [8, 16, 26, 36, 42][tier],
    holeSteps = [10, 16, 24, 32, 40][tier];
  const p = (x, y, z) => [x, y, centerZ(x) + z];
  function face(material, points, direction, tint = 1) {
    let n = normalFor(...points);
    if (n.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
      points = points.toReversed();
      n = normalFor(...points);
    }
    if (
      points.length === 4 &&
      Math.abs(n.reduce((sum, v, i) => sum + v * (points[3][i] - points[0][i]), 0)) > 1e-7
    ) {
      face(material, points.slice(0, 3), direction, tint);
      face(material, [points[0], points[2], points[3]], direction, tint);
      return;
    }
    const [a, b, c] = points,
      ab = b.map((v, i) => v - a[i]),
      ac = c.map((v, i) => v - a[i]);
    if (
      Math.hypot(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ) < 1e-7
    )
      return;
    out[points.length === 3 ? 'addTriangle' : 'addQuad'](
      material,
      'palette:#ffffff',
      points,
      n,
      undefined,
      palette[material].color.map((v) => v * tint),
    );
  }
  const archPoint = ({ left, right, spring, rise }, u, trim = 0) => {
    const half = (right - left) / 2,
      mid = left + half,
      angle = Math.PI * (1 - u);
    return [mid + (half + trim) * Math.cos(angle), spring + (rise + trim) * Math.sin(angle)];
  };
  const arcRows = arches.map((arch) =>
    Array.from({ length: archSteps + 1 }, (_, i) => archPoint(arch, i / archSteps)),
  );
  function circlePoint([x, y, r], u, trim = 0) {
    const angle = 2 * Math.PI * u;
    return [x + (r + trim) * Math.cos(angle), y + (r + trim) * Math.sin(angle)];
  }
  const halfCircle = (hole, lower) =>
    Array.from({ length: holeSteps / 2 + 1 }, (_, i) =>
      circlePoint(hole, 0.5 + (lower ? i : -i) / holeSteps),
    );
  const holeRows = oculi.map((hole) => ({
    hole,
    upper: halfCircle(hole, false),
    lower: halfCircle(hole, true),
  }));
  const roof = (x) => deckY(x) - 0.16;
  const stations = [
    ...new Set([
      start,
      -36.35,
      35.5,
      end,
      ...bridgeControls.profile.map((row) => row[0]),
      ...arcRows.flat().map((row) => row[0]),
      ...holeRows.flatMap(({ upper }) => upper.map((row) => row[0])),
    ]),
  ].sort((a, b) => a - b);
  function band(material, a, b, lo, hi, z, side) {
    const l = lo(a),
      r = lo(b),
      L = hi(a),
      R = hi(b);
    if (l > L + 0.000001 || r > R + 0.000001)
      throw Error(`Crossing masonry contours at ${a}, ${b}`);
    const A = p(a, l, z(a)),
      B = p(b, r, z(b)),
      C = p(b, R, z(b)),
      D = p(a, L, z(a));
    if (Math.abs(l - L) < 1e-7) face(material, [A, B, C], [0, 0, side]);
    else if (Math.abs(r - R) < 1e-7) face(material, [A, B, D], [0, 0, side]);
    else face(material, [A, B, C, D], [0, 0, side]);
  }
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      mid = (a + b) / 2;
    const arc = arcRows.find((row) => row[0][0] < mid && mid < row.at(-1)[0]);
    const low = arc ? (x) => interpolate(x, arc) : () => foundation;
    const port = holeRows.find(({ upper }) => upper[0][0] < mid && mid < upper.at(-1)[0]);
    for (const side of [-1, 1]) {
      const z = (x) => side * deckHalf(x);
      if (port) {
        band('face', a, b, low, (x) => interpolate(x, port.lower), z, side);
        band('face', a, b, (x) => interpolate(x, port.upper), roof, z, side);
      } else band('face', a, b, low, roof, z, side);
    }
    face(
      'face',
      [
        p(a, roof(a), -deckHalf(a)),
        p(b, roof(b), -deckHalf(b)),
        p(b, roof(b), deckHalf(b)),
        p(a, roof(a), deckHalf(a)),
      ],
      [0, 1, 0],
    );
    if (!arc)
      face(
        'foot',
        [
          p(a, foundation, -deckHalf(a)),
          p(b, foundation, -deckHalf(b)),
          p(b, foundation, deckHalf(b)),
          p(a, foundation, deckHalf(a)),
        ],
        [0, -1, 0],
      );
  }
  for (const [x, side] of [
    [start, -1],
    [end, 1],
  ]) {
    const w = deckHalf(x);
    face(
      'face',
      [p(x, foundation, -w), p(x, foundation, w), p(x, roof(x), w), p(x, roof(x), -w)],
      [side, 0, 0],
    );
  }
  function portalStrip(A, B, direction, material = 'lining') {
    const [a, y] = A,
      [b, Y] = B;
    face(
      material,
      [p(a, y, -deckHalf(a)), p(b, Y, -deckHalf(b)), p(b, Y, deckHalf(b)), p(a, y, deckHalf(a))],
      direction,
    );
  }
  function dressedRing(count, point, closed, thickness) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const gap = tier > 1 ? 0.023 : 0;
        const u = (i + gap) / count,
          v = (i + 1 - gap) / count;
        const at = (t, trim) => {
          const [x, y] = point(t, trim);
          return p(x, y, side * (deckHalf(x) + 0.025));
        };
        const tint = tier > 1 ? 1 - (i % 5) * 0.015 : 1;
        face('pale', [at(u, 0), at(v, 0), at(v, thickness), at(u, thickness)], [0, 0, side], tint);
        if (!closed && tier > 2)
          face(
            'coping',
            [
              at(u, thickness),
              at(v, thickness),
              p(...point(v, thickness), side * halfWidth),
              p(...point(u, thickness), side * halfWidth),
            ],
            [0, 1, side],
          );
      }
    }
  }
  for (const [j, arch] of arches.entries()) {
    const pts = arcRows[j],
      center = (arch.left + arch.right) / 2;
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      portalStrip(a, b, [center - (a[0] + b[0]) / 2, -0.7, 0]);
    }
    portalStrip([arch.left, foundation], pts[0], [1, 0, 0]);
    portalStrip(pts.at(-1), [arch.right, foundation], [-1, 0, 0]);
    dressedRing(archSteps, (u, t) => archPoint(arch, u, t), false, 0.43);
  }
  for (const hole of oculi) {
    for (let i = 0; i < holeSteps; i++) {
      const a = circlePoint(hole, i / holeSteps),
        b = circlePoint(hole, (i + 1) / holeSteps);
      portalStrip(a, b, [hole[0] - (a[0] + b[0]) / 2, hole[1] - (a[1] + b[1]) / 2, 0]);
    }
    dressedRing(holeSteps, (u, t) => circlePoint(hole, u, t), true, 0.29);
  }

  const pierCenters = oculi.map((o) => o[0]);
  for (const x of pierCenters) {
    const z = centerZ(x);
    const sides = [6, 8, 12, 16, 18][tier];
    const ring = (y, w, d) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return [x + w * Math.cos(a), y, z - d * Math.sin(a)];
      });
    loft(out, 'foot', [ring(foundation, 1.68, 3.72), ring(1.42, 1.58, 3.53)], palette.foot.color);
    if (tier > 0)
      loft(out, 'pale', [ring(1.42, 1.6, 3.54), ring(1.65, 1.35, 3.31)], palette.pale.color);
  }

  const deckStations = [start, -36.35, -35.1, -20, 0, 20, 34.38, 35.5, end];
  for (let i = 1; i < deckStations.length; i++) {
    const a = deckStations[i - 1],
      b = deckStations[i];
    face(
      'road',
      [
        p(a, deckY(a), -deckHalf(a)),
        p(b, deckY(b), -deckHalf(b)),
        p(b, deckY(b), deckHalf(b)),
        p(a, deckY(a), deckHalf(a)),
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      face(
        'curb',
        [
          p(a, deckY(a) + 0.06, side * (deckHalf(a) - 0.22)),
          p(b, deckY(b) + 0.06, side * (deckHalf(b) - 0.22)),
          p(b, deckY(b) + 0.06, side * deckHalf(b)),
          p(a, deckY(a) + 0.06, side * deckHalf(a)),
        ],
        [0, 1, 0],
      );
      face(
        'face',
        [
          p(a, roof(a), side * deckHalf(a)),
          p(b, roof(b), side * deckHalf(b)),
          p(b, deckY(b) + 0.06, side * deckHalf(b)),
          p(a, deckY(a) + 0.06, side * deckHalf(a)),
        ],
        [0, 0, side],
      );
    }
  }
  for (const side of [-1, 1]) {
    const parapet = [-36.35, -35.1, -20, 0, 20, 34.38, 35.5];
    const rail = parapet.map((x) => p(x, deckY(x) + 0.38, side * (halfWidth - 0.22)));
    beamPath(out, 'face', rail, 0.43, 0.74, palette.face.color);
    beamPath(
      out,
      'coping',
      parapet.map((x) => p(x, deckY(x) + 0.802, side * (halfWidth - 0.22))),
      0.53,
      0.104,
      palette.coping.color,
    );
    if (tier > 0)
      beamPath(
        out,
        'pale',
        parapet.map((x) => p(x, deckY(x) - 0.29, side * (halfWidth + 0.018))),
        0.11,
        0.23,
        palette.pale.color,
      );
  }
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
