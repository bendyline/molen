import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'bryggebroen',
  anchor: [12.566782026, 55.661506019],
  heading: -0.423792669872,
  datum: 1,
  ends: [-95.88, 95.92],
  halfWidth: 3.79,
  ownedRoadId: 35184723776330,
  sidewalkId: 35184399711400,
  ferryId: 35184442585895,
  mainPiers: [-78, -57, -36, -15, 75],
  pivot: 33,
  joints: [-9, 65],
  curve: [
    [-95.88, 0],
    [95.92, 0],
  ],
  profile: [
    [-95.88, 1.28],
    [-81, 1.89],
    [-63, 2.63],
    [-45, 3.42],
    [-27, 4.23],
    [-9, 5.02],
    [10, 5.69],
    [24, 5.98],
    [33, 5.97],
    [48, 5.55],
    [65, 4.5],
    [81, 3.17],
    [95.92, 1.85],
  ],
};

export function deckY(station) {
  const profile = bridgeControls.profile;
  for (let i = 1; i < profile.length; i++) {
    const [x, y] = profile[i - 1];
    const [nextX, nextY] = profile[i];
    if (station <= nextX) {
      return y + (nextY - y) * Math.max(0, (station - x) / (nextX - x));
    }
  }
  return profile.at(-1)[1];
}

export const centerZ = () => 0;

function surface(slot, graph, hex) {
  const color = [0, 2, 4].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return { slot, graph, color };
}

const palette = {
  steel: surface('wall', 'metal_painted', 'f4f2e9'),
  rust: surface('wall', 'metal_painted', '9d603c'),
  dark: surface('wall', 'metal_painted', '363735'),
  light: surface('wall', 'metal_painted', 'd2ae6f'),
  red: surface('wall', 'metal_painted', 'ac3033'),
  rail: surface('trim', 'metal_stainless', 'd2d3ce'),
  concrete: surface('foundation', 'concrete_plain', 'c4bfb3'),
  footway: surface('foundation', 'concrete_plain', 'aeb0ac'),
  cycleway: surface('foundation', 'concrete_plain', '6f7476'),
  stripe: surface('foundation', 'concrete_plain', 'e0dfd7'),
};

export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { color, ...binding }]) => [key, binding]),
);

function spineDepth(station) {
  const distance = Math.abs(station - bridgeControls.pivot);
  const haunch = Math.max(0, 1 - distance / (station < bridgeControls.pivot ? 29 : 20));
  return 0.65 + 2.26 * haunch * haunch;
}

export function buildBridgeLevel(out, level = 'master') {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw new Error(`Unknown bridge tier ${level}`);
  const {
    ends: [west, east],
    halfWidth,
    joints,
    mainPiers,
    pivot,
    profile,
  } = bridgeControls;

  function face(material, points, direction) {
    let normal = normalFor(...points);
    if (normal.reduce((sum, value, index) => sum + value * direction[index], 0) < 0) {
      points = points.toReversed();
      normal = normalFor(...points);
    }
    const offset = points[3]?.reduce(
      (sum, value, index) => sum + (value - points[0][index]) * normal[index],
      0,
    );
    if (points.length === 4 && Math.abs(offset) > 0.00001) {
      face(material, [points[0], points[1], points[2]], direction);
      face(material, [points[0], points[2], points[3]], direction);
    } else {
      out[points.length === 3 ? 'addTriangle' : 'addQuad'](
        material,
        'palette:#fff',
        points,
        normal,
        undefined,
        palette[material].color,
      );
    }
  }

  function tube(material, a, b, radius, sides, endRadius = radius) {
    const axis = normalize(b.map((value, i) => value - a[i]));
    const across = normalize(cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]));
    const other = cross(axis, across);
    function ring(center, r) {
      return Array.from({ length: sides }, (_, i) => {
        const angle = (2 * Math.PI * i) / sides;
        return center.map(
          (value, k) => value + r * (across[k] * Math.cos(angle) + other[k] * Math.sin(angle)),
        );
      });
    }
    loft(out, material, [ring(a, radius), ring(b, endRadius)], palette[material].color);
  }

  const bar = (material, a, b, width, depth = width) =>
    beam(out, material, a, b, width, depth, palette[material].color);
  const deckPoint = (x, z, height = 0) => [x, deckY(x) + height, z];
  const divider = -0.48;
  const haunchStations =
    tier === 0
      ? [pivot - 29, pivot + 20]
      : [pivot - 29, pivot - 20, pivot - 12, pivot - 6, pivot + 6, pivot + 12, pivot + 20];
  const stations = [...new Set([...profile.map(([x]) => x), ...haunchStations])].sort(
    (a, b) => a - b,
  );
  function section(station) {
    const y = deckY(station);
    return [
      [station, y, -halfWidth],
      [station, y, halfWidth],
      [station, y - 0.15, halfWidth],
      [station, y - spineDepth(station), 0.94],
      [station, y - spineDepth(station), -0.94],
      [station, y - 0.15, -halfWidth],
    ];
  }
  const normals = [
    [0, 0, 1],
    [0, -1, 1],
    [0, -1, 0],
    [0, -1, -1],
    [0, 0, -1],
  ];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    const first = section(a),
      next = section(b);
    for (let j = 1; j < first.length; j++) {
      const k = (j + 1) % first.length;
      face('steel', [first[j], next[j], next[k], first[k]], normals[j - 1]);
    }
    for (const [material, z0, z1] of [
      ['footway', -halfWidth, divider],
      ['cycleway', divider, halfWidth],
    ]) {
      face(
        material,
        [deckPoint(a, z0), deckPoint(b, z0), deckPoint(b, z1), deckPoint(a, z1)],
        [0, 1, 0],
      );
    }
  }
  for (const [station, side] of [
    [west, -1],
    [east, 1],
  ]) {
    const ring = section(station);
    face('steel', [ring[0], ring[1], ring[2], ring[5]], [side, 0, 0]);
    face('steel', [ring[5], ring[2], ring[3], ring[4]], [side, 0, 0]);
    const bankX = station - side * 1.0;
    bar('concrete', [bankX, -1.15, 0], [bankX, deckY(station) - 0.14, 0], 1.6, 7.12);
  }

  const sides = [4, 6, 10, 14, 16][tier];
  for (const station of mainPiers) {
    for (const sign of [-1, 1]) {
      const base = [station + sign * 2.45, -2.2, sign * 0.47];
      const top = [station + sign * 0.29, deckY(station) - spineDepth(station) + 0.14, sign * 0.47];
      tube('steel', base, top, 0.235, sides, 0.19);
      if (tier > 1) {
        const collar = [base[0] - sign * 0.33, -0.89, base[2]];
        tube('dark', base, collar, 0.25, sides);
      }
    }
  }

  const bearingY = deckY(pivot) - spineDepth(pivot);
  tube('concrete', [pivot, -2.6, 0], [pivot, 0.28, 0], 2.75, sides, 2.4);
  tube('concrete', [pivot, 0.28, 0], [pivot, bearingY - 0.2, 0], 2.4, sides, 1.81);
  tube('dark', [pivot, bearingY - 0.2, 0], [pivot, bearingY + 0.05, 0], 1.82, sides);
  tube('steel', [65.6, -2.4, 0], [65.6, deckY(65.6) - 0.68, 0], 0.56, sides);

  // The long pivot fender projects to both sides of the crossing and has rounded returns.
  const fenderHeight = 0.94;
  tube('rust', [pivot, fenderHeight, -30], [pivot, fenderHeight, 30], 0.24, sides);
  for (const z of [-30, -23, -16, -9, 9, 16, 23, 30]) {
    tube('rust', [pivot, -2.5, z], [pivot, fenderHeight + 0.2, z], 0.38, sides);
  }
  function roundedFender(x, z, radiusX, radiusZ) {
    const detail = [8, 12, 18, 24, 28][tier];
    const points = Array.from({ length: detail }, (_, i) => {
      const angle = (2 * Math.PI * i) / detail;
      return [x + radiusX * Math.cos(angle), fenderHeight, z + radiusZ * Math.sin(angle)];
    });
    beamPath(out, 'rust', points, 0.38, 0.38, palette.rust.color, true);
    for (const sign of [-1, 1]) {
      const postX = x + sign * radiusX;
      tube('rust', [postX, -2.2, z], [postX, fenderHeight + 0.18, z], 0.36, sides);
    }
  }
  roundedFender(pivot, -30, 2.6, 3.2);
  roundedFender(pivot, 30, 2.6, 3.2);
  roundedFender(66, 5.1, 3.0, 3.5);
  if (tier > 0) {
    for (const x of [-18, -12]) {
      for (const z of [-11.5, -7.7, 7.7, 11.5]) {
        tube('rust', [x, -2.3, z], [x, fenderHeight + 0.34, z], 0.43, sides);
        if (tier > 1)
          tube('dark', [x, fenderHeight + 0.34, z], [x, fenderHeight + 0.48, z], 0.43, sides);
      }
    }
  }

  // A raised spine separates the walking lane from the two-way cycleway.
  const median = stations.map((x) => deckPoint(x, divider, 0.38));
  beamPath(out, 'steel', median, 0.18, 0.76, palette.steel.color);

  if (tier > 0) {
    for (const side of [-1, 1]) {
      const heights = tier === 1 ? [0.39, 0.77, 1.08] : [0.21, 0.39, 0.57, 0.76, 0.94, 1.08];
      for (const y of heights) {
        const cross = side * (halfWidth - 0.06 - y * 0.16);
        const sectionPoints = stations.map((x) => deckPoint(x, cross, y));
        const width = y > 1 ? 0.063 : 0.018;
        beamPath(out, 'rail', sectionPoints, width, width, palette.rail.color);
      }
      const spacing = [0, 3.8, 1.54, 1.17, 1.08][tier];
      for (let x = west + 0.44; x < east - 0.25; x += spacing) {
        bar(
          'steel',
          deckPoint(x, side * (halfWidth - 0.07)),
          deckPoint(x, side * (halfWidth - 0.23), 1.08),
          0.078,
          0.086,
        );
      }
    }
    for (const x of joints) {
      const y = deckY(x) + 0.01;
      bar('dark', [x, y, -halfWidth], [x, y, halfWidth], 0.1, 0.021);
      for (const side of [-1, 1]) {
        const z = side * 3.34;
        tube('steel', deckPoint(x, z), deckPoint(x, z, 2.5), 0.055, sides);
        for (const h of tier === 1 ? [2.35] : [1.92, 2.35]) {
          tube('red', deckPoint(x, z, h), deckPoint(x, z, h + 0.15), 0.115, sides);
        }
      }
    }
  }
  if (tier > 1) {
    for (let x = west + 3; x < east - 3; x += 5.2) {
      bar('stripe', deckPoint(x, 1.56, 0.005), deckPoint(x + 1.9, 1.56, 0.005), 0.065, 0.009);
    }
    for (let x = west + 7; x < east - 4; x += 10.4) {
      const y = deckY(x) - 0.34;
      for (const side of [-1, 1])
        bar('light', [x, y, side * 2.95], [x + 0.34, y, side * 2.95], 0.16, 0.09);
    }
  }
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
