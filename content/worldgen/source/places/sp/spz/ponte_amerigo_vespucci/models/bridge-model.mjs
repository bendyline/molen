import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const bridgeControls = {
  id: 'ponte_amerigo_vespucci',
  anchor: [11.24294731, 43.771940841],
  heading: 0.983891537774,
  datum: 43,
  ends: [-80.75, 80.4],
  halfWidth: 11.25,
  bearingSkew: [0.08, 0.08],
  ownedRoadId: 35184490896710,
  sidewalkId: 35185067692130,
  lowerRouteId: 35184532005430,
  mainPiers: [-29.4, 28.4],
  curve: [
    [-80.75, 0],
    [80.4, 0],
  ],
  profile: [
    [-80.75, 8.65],
    [-55, 8.93],
    [-29.4, 9.2],
    [0, 9.34],
    [28.4, 9.29],
    [55, 9.09],
    [80.4, 8.86],
  ],
};

export function deckY(station) {
  const profile = bridgeControls.profile;
  for (let i = 1; i < profile.length; i++) {
    const [x, y] = profile[i - 1];
    const [nextX, nextY] = profile[i];
    if (station <= nextX) {
      const weight = Math.max(0, (station - x) / (nextX - x));
      return y + (nextY - y) * weight;
    }
  }
  return profile.at(-1)[1];
}

export const centerZ = () => 0;

export function deckX(station, cross) {
  const [west, east] = bridgeControls.ends;
  // Fade the end skew into the straight span so the pier axes remain independent.
  const westWeight = Math.max(0, 1 - Math.abs(station - west) / 20);
  const eastWeight = Math.max(0, 1 - Math.abs(station - east) / 20);
  return (
    station +
    cross *
      (westWeight * bridgeControls.bearingSkew[0] + eastWeight * bridgeControls.bearingSkew[1])
  );
}

const surface = (slot, graph, hex) => ({
  slot,
  graph,
  color: [0, 2, 4].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }),
});
const palette = {
  beam: surface('wall', 'concrete_plain', 'd4cfc2'),
  pier: surface('wall', 'stone_drywall', 'b9ad94'),
  trim: surface('trim', 'stone_ashlar', 'c8bea7'),
  walk: surface('trim', 'stone_ashlar', '9d9690'),
  pavement: surface('foundation', 'concrete_plain', '777d80'),
  marking: surface('foundation', 'concrete_plain', 'c9c4b0'),
  guard: surface('trim', 'metal_painted', '528473'),
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { color, ...binding }]) => [key, binding]),
);

export function buildBridgeLevel(out, level = 'master') {
  const controls = bridgeControls;
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw new Error(`Unknown bridge tier ${level}`);

  function face(material, vertices, direction) {
    let points = vertices;
    let normal = normalFor(...points);
    if (normal.reduce((sum, value, i) => sum + value * direction[i], 0) < 0) {
      points = points.toReversed();
      normal = normalFor(...points);
    }
    const offset = points[3]?.reduce(
      (sum, value, i) => sum + (value - points[0][i]) * normal[i],
      0,
    );
    if (points.length === 4 && Math.abs(offset) > 0.00001) {
      face(material, [points[0], points[1], points[2]], direction);
      face(material, [points[0], points[2], points[3]], direction);
      return;
    }
    const method = points.length === 3 ? 'addTriangle' : 'addQuad';
    out[method](material, 'palette:#fff', points, normal, undefined, palette[material].color);
  }

  function box(material, x0, x1, z0, z1, y0, y1) {
    const a = [x0, y0, z0],
      b = [x1, y0, z0],
      c = [x1, y0, z1],
      d = [x0, y0, z1];
    const e = [x0, y1, z0],
      f = [x1, y1, z0],
      g = [x1, y1, z1],
      h = [x0, y1, z1];
    face(material, [a, b, c, d], [0, -1, 0]);
    face(material, [e, f, g, h], [0, 1, 0]);
    face(material, [a, b, f, e], [0, 0, -1]);
    face(material, [d, c, g, h], [0, 0, 1]);
    face(material, [a, d, h, e], [-1, 0, 0]);
    face(material, [b, c, g, f], [1, 0, 0]);
  }

  const point = (station, cross, height) => [deckX(station, cross), height, cross];
  const crownStations = controls.profile.map(([station]) => station);
  const [west, east] = controls.ends;
  const stations = [
    ...new Set([
      west - 0.55,
      west + 2.4,
      ...crownStations,
      east + 0.55,
      ...controls.mainPiers.flatMap((pier) => [pier - 10, pier - 4, pier + 4, pier + 10]),
    ]),
  ].sort((a, b) => a - b);

  function strip(material, a, b, z0, z1, height) {
    face(
      material,
      [
        point(a, z0, height(a)),
        point(b, z0, height(b)),
        point(b, z1, height(b)),
        point(a, z1, height(a)),
      ],
      [0, 1, 0],
    );
  }

  function fascia(material, a, b, cross, bottom, top, side) {
    face(
      material,
      [
        point(a, cross, bottom(a)),
        point(b, cross, bottom(b)),
        point(b, cross, top(b)),
        point(a, cross, top(a)),
      ],
      [0, 0, side],
    );
  }

  const edgeBottom = (x) => deckY(x) - 0.92;
  const girderBottom = (x) => {
    const pierDistance = Math.min(...controls.mainPiers.map((pier) => Math.abs(x - pier)));
    const haunch = Math.max(0, Math.min(1, (10 - pierDistance) / 6));
    return deckY(x) - 1.22 - 0.96 * haunch;
  };
  const walkY = (x) => deckY(x) + 0.12;
  function walkwayEdge(x, side) {
    // The southwest sidewalk trace ends near the nominal edge of the deck.
    const westFlare = Math.max(0, Math.min(1, (west + 2.4 - x) / 2.4));
    return side * (controls.halfWidth + (side < 0 ? 0.72 * westFlare : 0));
  }
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    strip('pavement', a, b, -8.65, 8.65, deckY);
    face(
      'beam',
      [
        point(a, -7.1, girderBottom(a)),
        point(b, -7.1, girderBottom(b)),
        point(b, 7.1, girderBottom(b)),
        point(a, 7.1, girderBottom(a)),
      ],
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      const edgeA = walkwayEdge(a, side);
      const edgeB = walkwayEdge(b, side);
      face(
        'walk',
        [
          point(a, side * 8.65, walkY(a)),
          point(b, side * 8.65, walkY(b)),
          point(b, edgeB, walkY(b)),
          point(a, edgeA, walkY(a)),
        ],
        [0, 1, 0],
      );
      fascia('trim', a, b, side * 8.65, deckY, walkY, -side);
      face(
        'beam',
        [
          point(a, edgeA, edgeBottom(a)),
          point(b, edgeB, edgeBottom(b)),
          point(b, edgeB, walkY(b)),
          point(a, edgeA, walkY(a)),
        ],
        [0, 0, side],
      );
      face(
        'beam',
        [
          point(a, side * 7.1, girderBottom(a)),
          point(b, side * 7.1, girderBottom(b)),
          point(b, edgeB, edgeBottom(b)),
          point(a, edgeA, edgeBottom(a)),
        ],
        [0, -1, 0],
      );
      if (tier > 0 && a >= west && b <= east) {
        for (const faceSide of [-1, 1]) {
          const railCross = side * 10.98 + faceSide * 0.04;
          fascia(
            'guard',
            a,
            b,
            railCross,
            (x) => walkY(x) + 0.99,
            (x) => walkY(x) + 1.06,
            faceSide,
          );
          fascia(
            'guard',
            a,
            b,
            railCross,
            (x) => walkY(x) + 0.1,
            (x) => walkY(x) + 0.15,
            faceSide,
          );
        }
        strip('guard', a, b, side * 10.98 - 0.05, side * 10.98 + 0.05, (x) => walkY(x) + 1.06);
      }
    }
    if (tier > 1 && a >= west && b <= east) {
      strip('marking', a, b, 0.87, 0.99, (x) => deckY(x) + 0.004);
    }
  }

  // Close the narrow opening between the two mapped northeast approach lanes.
  // Set the plate just below their pavement so their markings remain visible.
  const apron = [
    [east + 0.24, deckY(east) - 0.025, -0.75],
    [east + 0.24, deckY(east) - 0.025, 3.55],
    [86.65, deckY(east) - 0.025, 1.18],
    [86.65, deckY(east) - 0.025, 0.38],
  ];
  face('pavement', apron, [0, 1, 0]);
  for (const [a, b, side] of [
    [0, 3, -1],
    [1, 2, 1],
  ]) {
    face(
      'beam',
      [
        apron[a],
        apron[b],
        [apron[b][0], apron[b][1] - 0.38, apron[b][2]],
        [apron[a][0], apron[a][1] - 0.38, apron[a][2]],
      ],
      [0, 0, side],
    );
  }

  for (const [index, station] of controls.ends.entries()) {
    const sign = index === 0 ? -1 : 1;
    const end = station + sign * 0.55;
    for (const [z0, z1, low, high] of [
      [-7.1, 7.1, girderBottom(end), deckY(end)],
      [7.1, walkwayEdge(end, 1), edgeBottom(end), walkY(end)],
      [walkwayEdge(end, -1), -7.1, edgeBottom(end), walkY(end)],
    ]) {
      face(
        'beam',
        [point(end, z0, low), point(end, z1, low), point(end, z1, high), point(end, z0, high)],
        [sign, 0, 0],
      );
    }
    const back = station - sign * 3.4;
    const left = -controls.halfWidth + 0.08,
      right = controls.halfWidth - 0.08;
    const ring = (height) => [
      point(station, left, height),
      point(station, right, height),
      point(back, right, height),
      point(back, left, height),
    ];
    const bottom = ring(-4);
    const top = ring(deckY(station) - 0.08);
    loft(
      out,
      'pier',
      index === 0 ? [bottom, top] : [bottom.toReversed(), top.toReversed()],
      palette.pier.color,
    );
  }

  for (const pier of controls.mainPiers) {
    // Plan edges follow the skew of the four mapped cutwater tips.
    const ring = (height, half, extent) => [
      [pier - 1.05 - half * 0.42, height, -extent],
      [pier - half, height, -11.0],
      [pier - half + 0.55, height, 11.0],
      [pier + 0.95 - half * 0.42, height, extent],
      [pier + 0.95 + half * 0.42, height, extent],
      [pier + half + 0.55, height, 11.0],
      [pier + half, height, -11.0],
      [pier - 1.05 + half * 0.42, height, -extent],
    ];
    const shoulderY = deckY(pier) - 2.7;
    loft(out, 'trim', [ring(-4, 2.2, 16.45), ring(0.79, 2.2, 16.45)], palette.trim.color);
    const masonry = {
      ...out,
      addQuad(material, ref, points, normal, uv, color) {
        if (points.every((point) => Math.abs(point[2]) >= 11) && tier > 0) {
          out.addQuad('trim', ref, points, normal, uv, palette.trim.color);
        } else {
          out.addQuad(material, ref, points, normal, uv, color);
        }
      },
    };
    loft(
      masonry,
      'pier',
      [ring(0.78, 1.96, 15.88), ring(shoulderY, 1.74, 15.68)],
      palette.pier.color,
    );
    box('beam', pier - 1.45, pier + 1.45, -7.0, 7.0, shoulderY, girderBottom(pier) + 0.16);
  }

  if (tier > 0) {
    const spacing = [0, 3.1, 0.62, 0.215, 0.17][tier];
    for (let x = controls.ends[0] + 0.14; x < controls.ends[1] - 0.1; x += spacing) {
      for (const side of [-1, 1]) {
        const z = side * 10.98;
        const station = deckX(x, z);
        const half = tier === 1 ? 0.075 : 0.019;
        box('guard', station - half, station + half, z - half, z + half, walkY(x), walkY(x) + 1.01);
      }
    }
  }
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
