/** Neuschwanstein reviewed occupied plan. Original master recipe remains intact. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { neuschwansteinMeshHelpers } from './neuschwanstein-castle-model.mjs';
import { box, tube } from './structure-mesh.mjs';

const {
  transformed,
  face,
  triangle,
  disk,
  lathe: detailedLathe,
  cone,
  archBand,
  opening,
  wall,
  mass,
  ledge,
  arcadeFrieze,
  roof,
  crenels,
  circularCrown: detailedCircularCrown,
  turret,
  dormer,
  balcony,
  gableDetails,
  group,
  near,
  fine,
  limestone,
  trim,
  roofColor,
  sandstone,
  brick,
} = neuschwansteinMeshHelpers;
// Street keeps every profile and stair tread, with eight-sided circular details.
const lathe = (o, ...args) =>
  detailedLathe(o.detail === 'street' ? { ...o, detail: 'district' } : o, ...args);
const circularCrown = (o, ...args) =>
  detailedCircularCrown(o.detail === 'street' ? { ...o, detail: 'district' } : o, ...args);
const means = {
  limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  carved: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  weathered: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  sandstone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  copper: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
  brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
};
function portalWall(o, slot, color, windows) {
  const r = 2.15,
    spring = 11.6,
    cap = 13.93;
  for (const sign of [-1, 1])
    box(o, slot, [sign < 0 ? -5.25 : r, 6.5, -1.2], [sign < 0 ? -r : 5.25, cap, 0], color);
  wall(o, 10.5, cap, 26.7, o.detail === 'skyline' ? [] : windows, slot, color, 1.2);
  const n = o.detail === 'skyline' ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      slot,
      [
        [-r * Math.cos(a), spring + r * Math.sin(a), 0],
        [-r * Math.cos(b), spring + r * Math.sin(b), 0],
        [-r * Math.cos(b), cap, 0],
        [-r * Math.cos(a), cap, 0],
      ],
      color,
    );
  }
  if (o.detail !== 'skyline') archBand(o, 0, spring, 0.16, r, 0.2, trim);
}
function palas(o) {
  // The main range and western Throne Hall have distinct plan axes.
  const rows = [9, 14.5, 20, 25.5, 31.2, 36.8];
  const longWindows = rows.flatMap((y, j) =>
    [-11.2, -5.6, 0, 5.6, 11.2].flatMap((x) =>
      group(x, y, j === 0 ? 1.6 : 2.55, j === 0 ? 1.8 : 2.25, j === 0 ? 1 : 2),
    ),
  );
  mass(o, -50.95, -17.05, -4.9, 10.25, 0, 41.5, {
    south: longWindows,
    north: longWindows,
    east: rows.flatMap((y, j) =>
      [-5.6, 0, 5.6].flatMap((x) =>
        group(x, y, j < 2 ? 1.4 : 3, j < 2 ? 1.9 : 2.3, j < 2 ? 1 : x === 0 ? 2 : 3),
      ),
    ),
  });
  roof(o, -51.2, -16.8, -5.15, 10.5, 41.7, 54.5);
  mass(o, -46.55, -17.15, -9.2, -4.8, 0, 38, {
    north: [9, 15, 21, 27, 33].flatMap((y) =>
      [-11, -5.5, 0, 5.5, 11].flatMap((x) => group(x, y, 2.3, 2.1, 2)),
    ),
  });
  roof(o, -46.8, -16.9, -9.45, -4.55, 38.2, 41.6, true);
  const western = transformed(o, -64.15, 0, 6.82, 0.208);
  const westLong = rows.flatMap((y, j) =>
    [-5.8, -1.9, 1.9, 5.8].flatMap((x) => group(x, y, j === 0 ? 1.5 : 2.5, 2.1, j === 0 ? 1 : 2)),
  );
  mass(western, -8.35, 8.35, -11.05, 11.05, 0, 41.5, {
    south: westLong,
    north: westLong,
    west: rows.flatMap((y, j) =>
      [-7, 0, 7].flatMap((x) => group(x, y, j < 2 ? 1.4 : 3.2, 2.2, j < 2 ? 1 : 3)),
    ),
  });
  roof(western, -8.6, 8.6, -11.3, 11.3, 41.7, 54.5);
  for (const [f, width] of [
    [transformed(o, -34, 0, 10.26), 33.9],
    [transformed(o, -34, 0, -4.91, Math.PI), 33.9],
    [transformed(western, 0, 0, 11.06), 16.7],
    [transformed(western, 0, 0, -11.06, Math.PI), 16.7],
  ]) {
    for (const y of [7.4, 18.7, 29.8, 41.15]) ledge(f, width, y);
    if (fine(o)) arcadeFrieze(f, width, 40.0);
  }
  for (const x of [-46, -37.5, -29, -20.5])
    for (const sign of [-1, 1]) dormer(o, x, 44.4, sign > 0 ? 8.9 : -3.55, sign);
  for (const x of [-5.8, -1.9, 1.9, 5.8])
    for (const sign of [-1, 1]) dormer(western, x, 44.8, sign * 9.1, sign);
  gableDetails(transformed(o, -16.78, 0, 2.67, Math.PI / 2), 15.65, 41.7, 54.5);
  gableDetails(transformed(western, -8.62, 0, 0, -Math.PI / 2), 23.8, 41.7, 54.5);
  // East courtyard bartizans are suspended above their corbelled bases.
  for (const z of [-4.7, 9.95]) {
    lathe(
      o,
      -16.55,
      z,
      [
        [22, 0.3],
        [25, 1.85],
        [26, 1.85],
        [26.4, 1.6],
        [41.7, 1.6],
        [42.2, 2],
      ],
      trim,
    );
    for (const y of [25.8, 33.8, 41.7]) circularCrown(o, -16.55, z, 1.65, y, false);
    cone(o, -16.55, z, 2.15, 43.05, 49.8, 8);
    if (near(o))
      for (const y of [27.2, 35])
        for (const a of [0, Math.PI / 2, Math.PI])
          opening(
            {
              ...transformed(o, -16.55 + Math.sin(a) * 1.63, 0, z + Math.cos(a) * 1.63, a),
              detail: 'street',
            },
            { x: 0, y, width: 0.55, height: 1.8 },
          );
  }
  balcony(transformed(o, -16.77, 0, 2.67, Math.PI / 2), 5.2, 35.8);
  // Southern and western projecting open galleries are characteristic of the Palas.
  for (const y of [22.6, 28.2, 33.8]) {
    const f = transformed(western, -8.7, 0, 0, -Math.PI / 2);
    balcony(f, 15, y, 1.6);
    if (near(o))
      for (let i = 0; i < 7; i++) {
        const x = -6.3 + i * 2.1;
        tube(f, 'carved', [x, y + 1.45, 1.42], [x, y + 3.25, 1.42], 0.14, trim, fine(o) ? 10 : 6);
        if (i < 6) archBand(f, x + 1.05, y + 3.0, 1.42, 0.91, 0.18);
      }
  }
  // Two primary stair towers, with intentionally unequal heights and crown profiles.
  stairTower(o, -55.16, -8.04, 3.8, 65);
  stairTower(o, -48.04, 13.29, 2.5, 59.2);
  for (const [x, z] of [
    [-50.6, -4.7],
    [-17.4, -4.7],
    [-50.6, 10.0],
    [-17.4, 10.0],
  ])
    turret(o, x, z, 0.75, 37.5, 42.0, 47.2, [39]);
}
function stairTower(o, x, z, r, tip) {
  const top = tip - 11;
  lathe(
    o,
    x,
    z,
    [
      [0, r + 1.1],
      [5, r + 0.25],
      [top - 11, r],
      [top - 10.5, r + 0.45],
      [top - 9, r + 0.45],
      [top - 8.8, r],
      [top - 1, r],
      [top, r + 0.28],
    ],
    limestone,
  );
  circularCrown(o, x, z, r, top - 11, false);
  circularCrown(o, x, z, r, top, false);
  lathe(
    o,
    x,
    z,
    [
      [top + 1.2, r * 0.82],
      [top + 4, r * 0.82],
    ],
    limestone,
  );
  cone(o, x, z, r * 0.96, top + 4, tip - 0.8);
  tube(
    o,
    'metal',
    [x, tip - 0.9, z],
    [x, tip, z],
    0.055,
    roofColor,
    o.detail === 'skyline' ? 4 : 6,
  );
  if (o.detail !== 'skyline')
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        f = transformed(o, x + Math.sin(a) * (r + 0.06), 0, z + Math.cos(a) * (r + 0.06), a);
      for (const y of [11, 20, 29, top - 6])
        opening(
          { ...f, detail: o.detail === 'district' ? 'district' : 'street' },
          { x: 0, y, width: 0.65, height: 1.4 },
        );
      opening({ ...f, detail: 'district' }, { x: 0, y: top + 1.7, width: 0.6, height: 1 });
    }
}
function bower(o) {
  mass(o, -14.4, 7.7, 13.2, 21.0, 0, 25.5, {
    south: [7.5, 13.3, 19.2].flatMap((y) =>
      [-8.5, -4.25, 0, 4.25, 8.5].flatMap((x) => group(x, y, 2.2, 2, 2)),
    ),
    north: [11.5, 19].flatMap((y) =>
      [-8.5, -4.25, 0, 4.25, 8.5].flatMap((x) => group(x, y, 2.3, 2.5, 2)),
    ),
    east: [8, 15, 21].map((y) => ({ x: 0, y, width: 1.1, height: 1.9 })),
  });
  roof(o, -14.65, 7.95, 12.95, 21.25, 25.7, 31.2, true);
  for (const z of [13.2, 21.0]) {
    const f = transformed(o, -3.35, 0, z, z === 13.2 ? Math.PI : 0);
    for (const y of [6.5, 17.7, 25.2]) ledge(f, 22.1, y);
    if (fine(o)) arcadeFrieze(f, 22.1, 24);
  }
  for (const [x, z, r] of [
    [-3.0, 23.3, 2.15],
    [9.2, 20.5, 1.8],
  ]) {
    lathe(
      o,
      x,
      z,
      [
        [0, r + 0.6],
        [6, r + 0.5],
        [6.8, r],
        [25.5, r],
      ],
      limestone,
      'limestone',
      8,
    );
    for (const a of [-Math.PI / 4, 0, Math.PI / 4])
      for (const y of [8.5, 14.3, 20.2])
        for (const w of group(0, y, 1.25, 1.65, 2))
          opening(
            {
              ...transformed(o, x + Math.sin(a) * (r + 0.08), 0, z + Math.cos(a) * (r + 0.08), a),
              detail: 'street',
            },
            w,
          );
    cone(o, x, z, r + 0.2, 25.7, 30.5, 8);
  }
  balcony(transformed(o, -3.0, 0, 12.95, Math.PI), 5.1, 17.8);
}
function northRanges(o) {
  // Knights' House and lower connecting gallery, distinct from the tall Palas.
  mass(o, -14.0, 27.5, -13.6, -9.3, 0, 22.5, {
    south: [8.8, 15.8].flatMap((y) =>
      [-18, -13.5, -9, -4.5, 0, 4.5, 9, 13.5, 18].flatMap((x) => group(x, y, 2.5, 2.2, 2)),
    ),
    north: [7, 14.2].flatMap((y) =>
      [-18, -13.5, -9, -4.5, 0, 4.5, 9, 13.5, 18].flatMap((x) => group(x, y, 2.3, 1.9, 2)),
    ),
  });
  for (const z of [-13.6, -9.3])
    crenels(transformed(o, 6.75, 0, z, z < -10 ? Math.PI : 0), 41.5, 22.5);
  mass(o, -4.2, 5.5, -18.8, -5.7, 0, 27.7, {
    north: [7, 13.6, 20.3].flatMap((y) => [-3.0, 0, 3.0].flatMap((x) => group(x, y, 2.4, 2.4, 2))),
    south: [9.5, 16.2, 22].flatMap((y) => [-3.0, 0, 3.0].flatMap((x) => group(x, y, 2.6, 2.2, 2))),
    east: [8, 15, 21].flatMap((y) => group(0, y, 2.4, 2.2, 2)),
  });
  roof(o, -4.45, 5.75, -19.05, -5.45, 27.9, 34, true);
  const court = transformed(o, 0.65, 0, -5.65);
  triangle(
    court,
    'limestone',
    [
      [-4.85, 23, 0],
      [4.85, 23, 0],
      [0, 31, 0],
    ],
    limestone,
  );
  gableDetails(court, 9.7, 23, 31);
  for (const x of [-4.2, 5.5])
    for (const z of [-18.8, -5.7]) turret(o, x, z, 0.75, 24.5, 29, 33.5, [26]);
  turret(o, 6.3, -18.8, 1.65, 0, 31.2, 36.5, [7, 15, 23]);
  squareTower(transformed(o, -7.78, 0, 6.26));
  const connection = transformed(o, 0, -5.5, 0);
  mass(connection, 36.4, 54.4, -13.7, -9.3, 5.5, 19.8, {
    south: [9, 15].flatMap((y) => [-7.2, -3.6, 0, 3.6, 7.2].flatMap((x) => group(x, y, 2, 2, 2))),
    north: [9, 15].flatMap((y) =>
      [-7.2, -3.6, 0, 3.6, 7.2].flatMap((x) => group(x, y, 1.7, 1.7, 1)),
    ),
  });
  roof(connection, 36.15, 54.65, -13.95, -9.05, 20, 23.8);
}
function squareTower(o) {
  mass(o, 35, 44.5, -21, -11.5, 0, 40.5, {
    south: [8, 17, 27, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    north: [8, 17, 27, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    east: [14, 25, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
    west: [14, 25, 34].map((y) => ({ x: 0, y, width: 0.8, height: 1.4 })),
  });
  for (const [x, z, a] of [
    [39.75, -11.5, 0],
    [39.75, -21, Math.PI],
    [35, -16.25, -Math.PI / 2],
    [44.5, -16.25, Math.PI / 2],
  ]) {
    const f = transformed(o, x, 0, z, a);
    ledge(f, 10.6, 40.5, 0.55);
    if (near(o))
      for (const xx of [-3.5, 0, 3.5]) {
        archBand(f, xx, 37.2, 0.15, 1.1, 0.2);
        beam(f, 'carved', [xx, 35.5, 0], [xx, 40.5, 0.5], 0.35, 0.42, trim);
      }
  }
  lathe(
    o,
    39.75,
    -16.25,
    [
      [40.65, 3.35],
      [47, 3.35],
    ],
    limestone,
    'limestone',
    8,
  );
  circularCrown(o, 39.75, -16.25, 3.35, 47, false);
  cone(o, 39.75, -16.25, 3.75, 48.3, 53.8, 8);
  if (near(o)) tube(o, 'metal', [39.75, 53.8, -16.25], [39.75, 54.8, -16.25], 0.06, roofColor, 4);
}
function steppedGable(o, width, y, height, slot, color) {
  const steps = 7,
    step = width / (2 * steps);
  for (let i = 0; i < steps; i++) {
    const w = width - 2 * i * step;
    box(
      o,
      slot,
      [-w / 2, y + (i * height) / steps, -0.35],
      [w / 2, y + ((i + 1) * height) / steps, 0],
      color,
    );
    if (near(o))
      for (const sign of [-1, 1])
        box(
          o,
          'carved',
          [sign > 0 ? w / 2 - step : -w / 2, y + ((i + 1) * height) / steps, -0.4],
          [sign > 0 ? w / 2 : -w / 2 + step, y + ((i + 1) * height) / steps + 0.12, 0.16],
          trim,
        );
  }
}
function gatehouse(o) {
  // Local +Z is the red-brick outer east facade; local -Z is the yellow inner west facade.
  const g = transformed(o, 58.7, -5.5, 3.4, Math.PI / 2);
  const lower = [-14.6, -8.6, 8.6, 14.6].map((x) => ({ x, y: 8.8, width: 1.35, height: 2.6 }));
  const upper = [-14.6, -8.6, 8.6, 14.6].flatMap((x) => group(x, 15.2, 2.4, 2.3, 2));
  for (const sign of [-1, 1]) {
    const x = sign * 11.575;
    wall(
      transformed(g, x, 0, 3.4),
      12.65,
      6.5,
      21,
      [...lower, ...upper]
        .filter((w) => Math.sign(w.x) === sign)
        .map((w) => ({ ...w, x: w.x - x })),
      'brick',
      brick,
      1,
    );
    wall(
      transformed(g, x, 0, -3.4, Math.PI),
      12.65,
      6.5,
      21,
      [...lower, ...upper]
        .filter((w) => Math.sign(w.x) === -sign)
        .map((w) => ({ ...w, x: w.x + x })),
      'sandstone',
      sandstone,
      1,
    );
  }
  for (const x of [-17.9, 17.9])
    box(g, 'limestone', [x - 0.25, 6.5, -3.4], [x + 0.25, 21, 3.4], limestone);
  roof(g, -18.1, 18.1, -3.4, 3.4, 21.1, 22.3, true);
  // Raised central bay and stepped gable; the central arch remains genuinely open through the vaulted passage.
  for (const [z, a, slot, color] of [
    [4.2, 0, 'limestone', limestone],
    [-3.75, Math.PI, 'sandstone', sandstone],
  ]) {
    const f = transformed(g, 0, 0, z, a);
    const windows =
      z < 0
        ? [...group(0, 16.3, 5.8, 2.5, 3), ...group(0, 22, 5.8, 2.3, 3)]
        : [-3.6, 3.6].flatMap((x) => [17, 23].map((y) => ({ x, y, width: 0.35, height: 1.05 })));
    portalWall(f, slot, color, windows);
    steppedGable(
      f,
      11.5,
      26.7,
      7.2,
      slot === 'limestone' ? 'brick' : slot,
      slot === 'limestone' ? brick : color,
    );
    for (const yy of [14.2, 21.1, 26.3]) ledge(f, 11.5, yy, 0.32);
    if (z < 0) {
      balcony(f, 7, 21.05, 1.4);
      disk(f, 'carved', 0, 28.7, 0.18, 0.78, trim, 24);
      disk(f, 'metal', 0, 28.7, 0.2, 0.61, [0.13, 0.25, 0.29], 24);
      if (near(o)) {
        beam(f, 'carved', [0, 28.7, 0.23], [0, 29.13, 0.23], 0.06, 0.04, trim);
        beam(f, 'carved', [0, 28.7, 0.23], [-0.3, 28.53, 0.23], 0.06, 0.04, trim);
      }
    } else
      for (const x of [-4.5, 4.5]) {
        lathe(
          f,
          x,
          0.2,
          [
            [18, 0.1],
            [20.2, 1.0],
            [21.8, 1.0],
          ],
          trim,
        );
        circularCrown(f, x, 0.2, 1, 21.8, true);
      }
  }
  const count = o.detail === 'skyline' ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    face(
      g,
      'limestone',
      [
        [2.15 * Math.cos(a), 11.6 + 2.15 * Math.sin(a), -3.75],
        [2.15 * Math.cos(b), 11.6 + 2.15 * Math.sin(b), -3.75],
        [2.15 * Math.cos(b), 11.6 + 2.15 * Math.sin(b), 4.2],
        [2.15 * Math.cos(a), 11.6 + 2.15 * Math.sin(a), 4.2],
      ].reverse(),
      limestone,
    );
  }
  for (const sign of [-1, 1])
    face(
      g,
      'limestone',
      [
        [sign * 2.15, 6.5, -3.75],
        [sign * 2.15, 11.6, -3.75],
        [sign * 2.15, 11.6, 4.2],
        [sign * 2.15, 6.5, 4.2],
      ].map((p, i, a) => (sign > 0 ? a[a.length - 1 - i] : p)),
      limestone,
    );
  for (const x of [-5.5, 5.2]) box(g, 'limestone', [x, 21, -3.75], [x + 0.3, 26.7, 4.2], limestone);
  roof(transformed(g, 0, 0, 0.225, Math.PI / 2), -3.975, 3.975, -5.4, 5.4, 26.7, 33.9);
  for (const z of [-3.4, 3.4]) {
    for (const x of [-11.575, 11.575]) {
      const f = transformed(g, x, 0, z, z > 0 ? 0 : Math.PI);
      crenels(f, 12.65, 21.1);
      if (fine(o)) arcadeFrieze(f, 12.65, 20);
    }
  }
  for (const x of [-17.9, 17.9]) {
    lathe(
      g,
      x,
      1.4,
      [
        [5, 2.8],
        [25, 2.7],
      ],
      limestone,
    );
    circularCrown(g, x, 1.4, 2.7, 25, true);
    cone(g, x, 1.4, 2.4, 25.5, 30.8, 8);
    if (o.detail !== 'skyline')
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          f = transformed(g, x + Math.sin(a) * 2.77, 0, 1.4 + Math.cos(a) * 2.77, a);
        for (const y of [9, 16, 21])
          opening({ ...f, detail: 'street' }, { x: 0, y, width: 0.48, height: 1.2 });
      }
  }
}

function platform(o, ring, y, base = -7) {
  const ids = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
    if ((p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) < 0)
      p.reverse();
    triangle(o, 'limestone', p, [0.76, 0.75, 0.68]);
    triangle(o, 'weathered', p.map((q) => [q[0], base, q[2]]).reverse(), [0.6, 0.62, 0.58]);
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      o,
      'weathered',
      [
        [a[0], base, a[1]],
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], base, b[1]],
      ],
      [0.6, 0.62, 0.58],
    );
  }
}
function foundations(o) {
  // Embedded support, not a mountain mesh or a survey of the masonry foundations.
  for (const [x0, x1, z0, z1] of [
    [-50.95, -17.05, -4.9, 10.25],
    [-46.55, -17.15, -9.2, -4.8],
    [-14.4, 7.7, 13.2, 21],
    [-14, 27.5, -13.6, -9.3],
    [-4.2, 5.5, -18.8, -5.7],
    [27.22, 36.72, -14.74, -5.24],
    [36.4, 54.4, -13.7, -9.3],
  ])
    mass(o, x0, x1, z0, z1, -7, 0);
  mass(transformed(o, -64.15, 0, 6.82, 0.208), -8.35, 8.35, -11.05, 11.05, -7, 0);
  for (const [x, z, r] of [
    [-55.16, -8.04, 4.05],
    [-48.04, 13.29, 2.75],
  ])
    lathe(
      o,
      x,
      z,
      [
        [-7, r],
        [0, r],
      ],
      limestone,
      'limestone',
      o.detail === 'skyline' ? 6 : 8,
    );
  const g = transformed(o, 58.7, 0, 3.4, Math.PI / 2);
  mass(g, -17.9, 17.9, -3.75, 4.2, -7, 1);
  for (const x of [-17.9, 17.9])
    lathe(
      g,
      x,
      1.4,
      [
        [-7, 2.8],
        [-0.5, 2.8],
      ],
      limestone,
      'limestone',
      6,
    );
}
function grounds(o) {
  foundations(o);
  platform(
    o,
    [
      [-17, -5.7],
      [37.7, -5.7],
      [41, -2],
      [41, 2],
      [38.8, 5.4],
      [38.8, 10.3],
      [28.5, 19.5],
      [9.6, 22.7],
      [9.6, 21],
      [7.7, 21],
      [7.7, 13.2],
      [-14.4, 13.2],
      [-17, 10],
    ],
    8.2,
  );
  platform(
    o,
    [
      [37.7, -9.3],
      [54.5, -9.3],
      [54.5, -14.5],
      [62.1, -14.5],
      [63.9, 21.4],
      [28.5, 21.4],
      [28.5, 19.5],
      [38.8, 10.3],
      [38.8, 5.4],
      [41, 2],
      [41, -2],
      [37.7, -5.7],
    ],
    1,
  );
  // Owner plan and mapped north route join the7.2m higher court to the gate court.
  const x0 = 38.61,
    x1 = 54.42,
    z0 = -9.2,
    z1 = -7.2,
    y0 = 1,
    y1 = 8.2;
  if (o.detail === 'skyline') {
    face(
      o,
      'limestone',
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y0, z1],
        [x1, y0, z0],
      ],
      trim,
    );
    triangle(
      o,
      'limestone',
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y0, z0],
      ],
      trim,
    );
    triangle(
      o,
      'limestone',
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x0, y1, z1],
      ],
      trim,
    );
    face(
      o,
      'limestone',
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      trim,
    );
  } else
    for (let i = 0; i < 40; i++) {
      const x = x1 - ((i + 1) * (x1 - x0)) / 40;
      box(
        o,
        'limestone',
        [x, y0, z0],
        [x + (x1 - x0) / 40, y0 + ((i + 1) * (y1 - y0)) / 40, z1],
        trim,
      );
    }
  if (o.detail !== 'skyline')
    for (let i = 0; i < 40; i++)
      box(
        o,
        'limestone',
        [-17.13 + i * (17.95 / 40), 8.2 + i * 0.18, -4.6],
        [-17.13 + (i + 1) * (17.95 / 40), 8.38 + i * 0.18, -2.5],
        trim,
      );
}
function build(out, detail) {
  const o = { ...out, detail, runtimeLevel: detail };
  grounds(o);
  palas(o);
  bower(o);
  northRanges(o);
  gatehouse(o);
}
export const buildNeuschwansteinReviewedMaster = (out) => build(out, 'closeup');
export const buildNeuschwansteinReviewedCloseup = (out) => build(out, 'closeup');
export const buildNeuschwansteinReviewedStreet = (out) => build(out, 'street');
export function buildNeuschwansteinReviewedDistrict(out) {
  const o = { ...out, detail: 'district', runtimeLevel: 'district' };
  farMasses(o);
  const facade = (x, z, a, xs, ys, w = 2.4, h = 2.2) => {
    const f = transformed(o, x, 0, z, a);
    for (const y of ys) for (const xx of xs) opening(f, { x: xx, y, width: w, height: h });
  };
  for (const [z, a] of [
    [10.26, 0],
    [-4.91, Math.PI],
  ])
    facade(-34, z, a, [-11.2, -5.6, 0, 5.6, 11.2], [9, 14.5, 20, 25.5, 31.2, 36.8]);
  facade(-16.99, 2.67, Math.PI / 2, [-5, 0, 5], [9, 14.5, 20, 25.5, 31.2, 36.8]);
  const west = transformed(o, -64.15, 0, 6.82, 0.208);
  for (const [z, a] of [
    [11.06, 0],
    [-11.06, Math.PI],
  ])
    for (const y of [9, 14.5, 20, 25.5, 31.2, 36.8])
      for (const x of [-5.8, -1.9, 1.9, 5.8])
        opening(transformed(west, x, 0, z, a), { x: 0, y, width: 2.3, height: 2.1 });
  for (const [z, a] of [
    [13.19, Math.PI],
    [21.01, 0],
  ])
    facade(-3.35, z, a, [-8.5, -4.25, 0, 4.25, 8.5], [8, 14, 20]);
  facade(6.75, -9.29, 0, [-18, -13.5, -9, -4.5, 0, 4.5, 9, 13.5, 18], [8.8, 15.8]);
  facade(0.65, -18.81, Math.PI, [-3, 0, 3], [7, 13.6, 20.3]);
  const g = transformed(o, 58.7, -5.5, 3.4, Math.PI / 2);
  for (const [z, a] of [
    [3.41, 0],
    [-3.41, Math.PI],
  ])
    for (const y of [8.8, 15.2])
      for (const x of [-14.6, -8.6, 8.6, 14.6])
        opening(transformed(g, 0, 0, z, a), { x, y, width: 2.2, height: 2.3 });
  for (const [z, a] of [
    [4.21, 0],
    [-3.76, Math.PI],
  ])
    for (const y of [17, 22])
      for (const x of [-3.1, 0, 3.1])
        opening(transformed(g, 0, 0, z, a), { x, y, width: 1.15, height: 1.7 });
}
export function buildNeuschwansteinReviewedSkyline(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, p, n, uv, color) =>
        out[name](
          slot,
          ref,
          p,
          n,
          uv,
          color.map((v, i) => v * (means[slot]?.[i] ?? 1)),
        ),
    ]),
  );
  farMasses({ ...mapped, detail: 'skyline', runtimeLevel: 'skyline' });
}

function farMasses(o) {
  const sky = { ...o, detail: 'skyline' };
  grounds(sky);
  mass(sky, -50.95, -17.05, -4.9, 10.25, 0, 41.5);
  roof(sky, -51.2, -16.8, -5.15, 10.5, 41.7, 54.5);
  mass(sky, -46.55, -17.15, -9.2, -4.8, 0, 38);
  roof(sky, -46.8, -16.9, -9.45, -4.55, 38.2, 41.6, true);
  const west = transformed(sky, -64.15, 0, 6.82, 0.208);
  mass(west, -8.35, 8.35, -11.05, 11.05, 0, 41.5);
  roof(west, -8.6, 8.6, -11.3, 11.3, 41.7, 54.5);
  for (const [x, z, r, tip] of [
    [-55.16, -8.04, 3.8, 65],
    [-48.04, 13.29, 2.5, 59.2],
  ]) {
    lathe(
      sky,
      x,
      z,
      [
        [0, r + 0.5],
        [tip - 7, r],
      ],
      limestone,
    );
    cone(sky, x, z, r + 0.4, tip - 7, tip, 6);
  }
  mass(sky, -14.4, 7.7, 13.2, 21, 0, 25.5);
  roof(sky, -14.65, 7.95, 12.95, 21.25, 25.7, 31.2, true);
  for (const [x, z, r] of [
    [-3, 23.3, 2.15],
    [9.2, 20.5, 1.8],
  ]) {
    lathe(
      sky,
      x,
      z,
      [
        [0, r + 0.5],
        [25.5, r],
      ],
      limestone,
      'limestone',
      8,
    );
    cone(sky, x, z, r + 0.2, 25.7, 30.5, 6);
  }
  mass(sky, -14, 27.5, -13.6, -9.3, 0, 22.5);
  mass(sky, -4.2, 5.5, -18.8, -5.7, 0, 27.7);
  roof(sky, -4.45, 5.75, -19.05, -5.45, 27.9, 34, true);
  mass(sky, 27.22, 36.72, -14.74, -5.24, 0, 40.5);
  lathe(
    sky,
    31.97,
    -9.99,
    [
      [40.65, 3.35],
      [48.3, 3.35],
    ],
    limestone,
  );
  cone(sky, 31.97, -9.99, 3.75, 48.3, 54.8, 6);
  mass(sky, 36.4, 54.4, -13.7, -9.3, 0, 14.3);
  roof(sky, 36.15, 54.65, -13.95, -9.05, 14.5, 18.3);
  const g = transformed(sky, 58.7, -5.5, 3.4, Math.PI / 2);
  for (const sign of [-1, 1]) {
    box(
      g,
      'brick',
      [sign < 0 ? -17.9 : 5.25, 6.5, -3.4],
      [sign < 0 ? -5.25 : 17.9, 21, 3.4],
      brick,
    );
  }
  roof(g, -18.1, 18.1, -3.4, 3.4, 21.1, 22.3, true);
  portalWall(transformed(g, 0, 0, 4.2), 'limestone', limestone, []);
  portalWall(transformed(g, 0, 0, -3.75, Math.PI), 'sandstone', sandstone, []);
  roof(transformed(g, 0, 0, 0.225, Math.PI / 2), -3.975, 3.975, -5.4, 5.4, 26.7, 33.9);
  steppedGable(transformed(g, 0, 0, 4.2), 11.5, 26.7, 7.2, 'brick', brick);
  steppedGable(transformed(g, 0, 0, -3.75, Math.PI), 11.5, 26.7, 7.2, 'sandstone', sandstone);
  for (const x of [-17.9, 17.9]) {
    lathe(
      g,
      x,
      1.4,
      [
        [5, 2.8],
        [26.5, 2.7],
      ],
      limestone,
    );
    cone(g, x, 1.4, 2.4, 26.5, 30.8, 6);
  }
}
