import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const toriiSurfaces = {
  vermilion: { slot: 'trim', graph: 'wood_plain', roughness: 0.76 },
  barkRoof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.88 },
  weatheredFoot: { slot: 'foundation', graph: 'wood_log', roughness: 0.94 },
  plaque: { slot: 'wall', graph: 'wood_shou_sugi_ban', roughness: 0.86 },
  gilt: { slot: 'trim', graph: 'metal_copper', roughness: 0.67 },
};

const lacquer = rgb('dd5429');
const endgrain = rgb('be4829');
const tie = rgb('da6634');
const lowerBark = rgb('332d25');
const topBark = rgb('61594a');
const wood = rgb('5e4c39');
const plaque = rgb('292522');
const brass = rgb('c3a257');
const squareX = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const start = -1.1;
const mainHeight = 13.4;
const crownHeight = 16.6;

// The surveyed footprint defines the gate bearing. The visible cap extends past the piers.
export function buildGreatTorii(out, { center, yawDegrees }, detail) {
  const theta = (yawDegrees * Math.PI) / 180;
  const cos = Math.cos(theta),
    sin = Math.sin(theta);
  const place = (x, y, z) => [
    center[0] + x * cos - z * sin,
    y + start,
    center[1] + x * sin + z * cos,
  ];
  const sides = [4, 8, 12, 20, 24][detail];
  function trunk(positions, paint = lacquer, slot = 'vermilion') {
    loft(
      out,
      slot,
      positions.map(([x, y, z, radius]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (-2 * Math.PI * i) / sides;
          return place(x + radius * Math.cos(a), y, z + radius * Math.sin(a));
        }),
      ),
      paint,
    );
  }
  function molding(slot, stations, draw, color) {
    loft(
      out,
      slot,
      stations.map((x) => draw(x).map(([y, z]) => place(x, y, z))),
      color,
    );
  }
  function beam(x1, x2, height, depth, y, color, slot = 'vermilion') {
    molding(
      slot,
      [x1, x2],
      () => squareX.map(([u, v]) => [y + (u * height) / 2, (v * depth) / 2]),
      color,
    );
  }

  for (const hand of [-1, 1]) {
    const x = hand * 5.06;
    trunk([
      [x, 0, 0, 1.57],
      [x - hand * 0.18, mainHeight, 0, 1.33],
    ]);
    if (detail >= 2) {
      trunk(
        [
          [x, -0.02, 0, 1.587],
          [x - hand * 0.012, 0.91, 0, 1.56],
        ],
        wood,
        'weatheredFoot',
      );
      trunk(
        [
          [x - hand * 0.17, 12.64, 0, 1.385],
          [x - hand * 0.185, mainHeight + 0.03, 0, 1.4],
        ],
        endgrain,
      );
    }
    for (const side of [-1, 1]) {
      // A pair of hinoki braces stands on each side of the main camphor pillar.
      const z = side * 2.57;
      trunk([
        [x, 0, z, 0.64],
        [x - hand * 0.12, 7.77, side * 1.84, 0.55],
      ]);
      trunk(
        [
          [x - hand * 0.12, 7.72, side * 1.845, 0.6],
          [x - hand * 0.12, 7.92, side * 1.832, 0.76],
          [x - hand * 0.12, 8.04, side * 1.814, 0.67],
        ],
        lowerBark,
        'barkRoof',
      );
      if (detail >= 2) {
        trunk(
          [
            [x, -0.02, z, 0.654],
            [x - hand * 0.009, 0.71, side * 2.503, 0.636],
          ],
          wood,
          'weatheredFoot',
        );
      }
    }
    beam(x - 0.69, x + 0.69, 0.52, 5.25, 5.59, tie);
    if (detail >= 2) beam(x - 0.61, x + 0.61, 0.42, 5.02, 7.09, tie);
  }
  beam(-9.25, 9.25, 1.14, 1.22, 11.09, tie);

  const curve = (x) => {
    const fraction = Math.abs(x) / 11.65;
    return 0.99 * Math.pow(fraction, 4) + 0.1 * fraction * fraction;
  };
  const count = [6, 8, 12, 18, 24][detail];
  const stations = Array.from({ length: count + 1 }, (_, i) => -11.65 + (23.3 * i) / count);
  const low = crownHeight - curve(11.65);
  const beamStations = (half) =>
    detail < 2 ? [-half, -half / 2, 0, half / 2, half] : stations.map((x) => (x * half) / 11.65);
  molding(
    'vermilion',
    beamStations(10.57),
    (x) => {
      const bulge = curve(x);
      return squareX.map(([u, v]) => [
        u < 0 ? 13.34 + bulge * 0.62 : low + bulge - 1.01,
        v * 0.885,
      ]);
    },
    lacquer,
  );
  molding(
    'vermilion',
    beamStations(11.39),
    (x) => {
      const y = low + curve(x);
      return squareX.map(([u, v]) => [y - 0.837 + u * 0.197, v * 1.29]);
    },
    endgrain,
  );
  molding(
    'barkRoof',
    stations,
    (x) => {
      const y = low + curve(x);
      return [
        [y - 0.78, -1.6],
        [y - 0.51, -1.67],
        [y, 0],
        [y - 0.51, 1.67],
        [y - 0.78, 1.6],
        [y - 0.76, 0],
      ];
    },
    topBark,
  );
  if (detail >= 2) {
    // The dark eave strip follows the turned-up cap without flattening the center.
    for (const side of [-1, 1]) {
      molding(
        'barkRoof',
        stations,
        (x) => {
          const y = low + curve(x);
          return squareX.map(([u, v]) => [y - 0.645 + 0.084 * u, side * 1.628 + 0.055 * v]);
        },
        lowerBark,
      );
    }
  }
  beam(-0.68, 0.68, 2.41, 0.57, 12.6, endgrain);
  if (detail >= 1) {
    for (const side of [-1, 1]) {
      molding(
        'plaque',
        [-0.63, 0.63],
        () => squareX.map(([u, v]) => [12.65 + u * 1.1, side * 0.324 + v * 0.06]),
        plaque,
      );
      if (detail >= 2) {
        const frame = (left, right, y, height) =>
          molding(
            'gilt',
            [left, right],
            () => squareX.map(([u, v]) => [y + (u * height) / 2, side * 0.388 + v * 0.022]),
            brass,
          );
        for (const x of [-0.57, 0.57]) frame(x - 0.027, x + 0.027, 12.65, 2.12);
        for (const y of [11.61, 13.69]) frame(-0.55, 0.55, y, 0.043);
      }
    }
  }
}
