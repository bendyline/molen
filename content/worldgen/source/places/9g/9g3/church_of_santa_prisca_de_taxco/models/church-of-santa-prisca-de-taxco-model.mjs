import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const { outline: footprint } = read('native-map/church-of-santa-prisca-de-taxco-shape-controls');
const outline = outwardRing(footprint);
const zFront = 27.36;
const axis = 1.28;
const floor = 0.88;

const colors = Object.fromEntries(
  Object.entries({
    stone: 'b38978',
    carved: 'bc9380',
    pale: 'c9a58f',
    shadow: '9a7566',
    lime: 'c7b8a7',
    footing: 'a28b76',
    step: 'b9a18b',
    vault: 'a49988',
    clay: '945944',
    tile: 'b6794d',
    cream: 'd7c39d',
    tileDark: '754b42',
    glazed: '504d46',
    wood: '694735',
    iron: '54473c',
    bell: '796342',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.92 },
  relief: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.87 },
  pattern: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.84 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.9 },
};

const slab = (out, slot, x, z, radius, low, high, color, sides = 8) =>
  lathe(
    out,
    slot,
    [x, z],
    [
      [low, radius, radius],
      [high, radius, radius],
    ],
    sides,
    color,
    { rotation: sides === 4 ? Math.PI / 4 : Math.PI / 8 },
  );

function window(out, face, u, y, w, h, level, head = 'round') {
  opening(out, face, u, y, w, h, {
    head,
    glassSlot: 'glass',
    frameSlot: 'relief',
    glass: colors.glazed,
    frame: colors.carved,
    frameWidth: level >= 2 ? 0.13 : 0,
    frameDepth: 0.12,
    d: 0.053,
    mullions: level >= 2 && w > 1 ? 1 : 0,
    sill: level >= 2 && head !== 'round',
  });
}

function cross(out, x, y, z, height, thick = 0.095) {
  abox(
    out,
    'iron',
    [x - thick / 2, y, z - thick / 2],
    [x + thick / 2, y + height, z + thick / 2],
    colors.iron,
  );
  abox(
    out,
    'iron',
    [x - height * 0.23, y + height * 0.62, z - thick / 2],
    [x + height * 0.23, y + height * 0.62 + thick, z + thick / 2],
    colors.iron,
  );
}

function barrel(out, start, end, width, spring, crown, level) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const dx = (end[0] - start[0]) / length;
  const dz = (end[1] - start[1]) / length;
  const n = [6, 10, 14, 18][level];
  const ridge = (p, i) => {
    const a = (Math.PI * i) / n;
    return [
      p[0] + width * 0.5 * dz * Math.cos(a),
      spring + (crown - spring) * Math.sin(a),
      p[1] - width * 0.5 * dx * Math.cos(a),
    ];
  };
  for (let i = 0; i < n; i++) {
    const a = ridge(start, i),
      b = ridge(start, i + 1);
    const c = ridge(end, i + 1),
      d = ridge(end, i);
    quad4(out, 'roof', a, b, c, d, colors.vault);
    tri(out, 'wall', a, [start[0], spring, start[1]], b, colors.lime);
    tri(out, 'wall', d, c, [end[0], spring, end[1]], colors.lime);
  }
}

function churchBody(out, level) {
  extrude(out, 'stone', outline, -5.6, floor, colors.footing, { top: false, bottom: false });
  const xSouth = 9.409,
    xNorth = -6.849;
  abox(out, 'wall', [xNorth, floor, -12.0], [xSouth, 16.0, zFront - 0.17], colors.lime);
  barrel(out, [axis, -12.1], [axis, zFront - 0.24], 16.37, 15.95, 19.4, level);
  abox(out, 'wall', [-10.49, floor, -21.6], [9.42, 15.58, -1.49], colors.lime);
  barrel(out, [-10.48, -7.0], [15.88, -7.0], 10.7, 15.35, 19.43, level);
  abox(out, 'wall', [9.41, floor, -11.02], [15.88, 15.35, -0.46], colors.lime);
  abox(out, 'wall', [-16.36, floor, -2.53], [-6.84, 9.1, 17.64], colors.lime);
  barrel(out, [-12.06, -2.51], [-12.06, 17.6], 8.63, 9.08, 11.81, level);
  abox(out, 'wall', [-10.49, floor, -28.75], [13.6, 7.35, -11.02], colors.lime);
  abox(out, 'roof', [-10.51, 7.27, -28.77], [13.65, 7.47, -21.45], colors.vault);
  abox(out, 'wall', [-7.85, 7.34, -25.2], [8.51, 13.24, -11.48], colors.lime);
  barrel(out, [axis, -25.17], [axis, -11.14], 14.7, 13.22, 17.22, level);
  const south = facade([9.42, 25.0], [0, -1]);
  const north = facade([-6.85, -1.25], [0, 1]);
  const end = facade([15.89, -0.48], [0, -1]);
  const rear = facade([13.61, -28.75], [-1, 0]);
  const chapel = facade([-16.37, -2.5], [0, 1]);
  for (const [f, width, high] of [
    [south, 25.4, 15.54],
    [north, 22, 15.53],
    [end, 10.51, 15.12],
    [rear, 24.05, 7.0],
    [chapel, 20.12, 8.86],
  ]) {
    fbox(out, 'relief', f, 0, width, high - 0.26, high, -0.08, 0.18, colors.carved);
  }
  if (!level) return;
  for (const [face, positions] of [
    [south, [4.8, 10.9, 17.08, 22.16]],
    [north, [2.27, 8.33, 14.42, 20.32]],
  ]) {
    for (const u of positions) {
      window(out, face, u, 11.7, 1.72, 2.65, level);
      const left = u + 2.32;
      fbox(
        out,
        'stone',
        face,
        left,
        left + 0.68,
        level >= 2 ? floor : 8.9,
        15.75,
        -0.06,
        0.49,
        colors.stone,
      );
      if (level >= 2) {
        fbox(
          out,
          'relief',
          face,
          left - 0.13,
          left + 0.81,
          15.15,
          15.69,
          0.12,
          0.59,
          colors.carved,
        );
        fbox(out, 'relief', face, u - 1.14, u + 1.14, 11.56, 11.72, 0.01, 0.22, colors.shadow);
      }
    }
  }
  for (const u of [3.28, 8.23, 13.45, 19.91]) window(out, rear, u, 4.3, 0.9, 1.48, level, 'flat');
  for (const u of [3.2, 8.7, 14.3]) window(out, chapel, u, 5.42, 1.02, 2.3, level);
  window(out, end, 5.24, 13.09, 1.43, 2.07, level);
  if (level >= 2) {
    for (const x of [-14.2, -10.2, 9.33, 15.36])
      slab(out, 'relief', x, -0.88, 0.19, 15.35, 16.22, colors.shadow, 6);
    for (const u of [1.35, 3.4, 5.65, 7.9, 9.36])
      fbox(out, 'wall', end, u - 0.13, u + 0.13, 1.0, 3.2, -0.045, 0.27, colors.stone);
  }
}

function cornice(out, x, z, y, r, level) {
  const profile =
    level < 2
      ? [
          [y - 0.21, r],
          [y + 0.18, r + 0.33],
        ]
      : [
          [y - 0.31, r - 0.12],
          [y - 0.26, r + 0.06],
          [y - 0.06, r + 0.22],
          [y + 0.03, r + 0.43],
          [y + 0.18, r + 0.43],
          [y + 0.22, r + 0.29],
        ];
  lathe(
    out,
    'relief',
    [x, z],
    profile.map(([h, d]) => [h, d, d]),
    8,
    colors.shadow,
    { rotation: Math.PI / 8 },
  );
}

function openBelfry(out, x, z, y, top, r, level) {
  const apothem = r * Math.cos(Math.PI / 8);
  const half = r * Math.sin(Math.PI / 8);
  slab(out, 'stone', x, z, r, y - 0.1, y + 0.61, colors.stone);
  const sideWidth = half * 0.72;
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI * k) / 4;
    const f = facade(
      [x + apothem * Math.sin(a), z + apothem * Math.cos(a)],
      [Math.cos(a), -Math.sin(a)],
    );
    if (k % 2 === 1) {
      fbox(out, 'stone', f, -half, half, y + 0.52, top, -0.65, 0.025, colors.stone);
      if (level >= 2)
        fbox(
          out,
          'relief',
          f,
          -half * 0.34,
          half * 0.34,
          y + 1.1,
          top - 0.4,
          0.03,
          0.21,
          colors.carved,
        );
      if (level >= 2) {
        figure(out, f, 0, y + 2.36, 0.42, 0.21);
        fbox(out, 'relief', f, -0.37, 0.37, y + 2.15, y + 2.39, 0.13, 0.43, colors.shadow);
      }
      continue;
    }
    const archY = top - 2.96;
    fbox(out, 'stone', f, -sideWidth, sideWidth, y + 0.55, y + 1.88, -0.57, 0.018, colors.stone);
    fbox(out, 'stone', f, -half, -sideWidth, y + 0.55, top, -0.57, 0.018, colors.stone);
    fbox(out, 'stone', f, sideWidth, half, y + 0.55, top, -0.57, 0.018, colors.stone);
    const n = level >= 2 ? 10 : 4;
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * i) / n,
        a1 = (Math.PI * (i + 1)) / n;
      const u0 = -sideWidth * Math.cos(a0),
        u1 = -sideWidth * Math.cos(a1);
      const h0 = archY + Math.sin(a0) * sideWidth,
        h1 = archY + Math.sin(a1) * sideWidth;
      quad4(
        out,
        'stone',
        f.P(u0, h0, 0.02),
        f.P(u1, h1, 0.02),
        f.P(u1, top, 0.02),
        f.P(u0, top, 0.02),
        colors.stone,
      );
      if (level >= 1)
        quad4(
          out,
          'relief',
          f.P(u0, h0, 0.045),
          f.P(u1, h1, 0.045),
          f.P(-Math.cos(a1) * (sideWidth + 0.11), h1 + Math.sin(a1) * 0.11, 0.088),
          f.P(-Math.cos(a0) * (sideWidth + 0.11), h0 + Math.sin(a0) * 0.11, 0.088),
          colors.pale,
        );
      if (level >= 2)
        quad4(
          out,
          'stone',
          f.P(u0, h0, -0.59),
          f.P(u1, h1, -0.59),
          f.P(u1, h1, 0.019),
          f.P(u0, h0, 0.019),
          colors.shadow,
        );
    }
    if (!level) continue;
    for (const u of [-half * 0.78, half * 0.78]) {
      fbox(out, 'relief', f, u - 0.1, u + 0.1, y + 0.72, top - 0.43, 0.035, 0.21, colors.carved);
      if (level >= 2) {
        for (const q of [y + 0.95, y + 1.35, y + 1.88, top - 1.0, top - 0.63])
          fbox(out, 'relief', f, u - 0.16, u + 0.16, q - 0.064, q + 0.064, 0.07, 0.28, colors.pale);
      }
    }
    if (level >= 2)
      fbox(out, 'iron', f, -sideWidth, sideWidth, y + 2.76, y + 2.85, 0.015, 0.19, colors.iron);
    if (level >= 2)
      fbox(
        out,
        'relief',
        f,
        -sideWidth - 0.16,
        sideWidth + 0.16,
        y + 1.66,
        y + 1.87,
        0.015,
        0.4,
        colors.carved,
      );
    if (level >= 2)
      for (const u of [-0.7, -0.47, -0.23, 0, 0.23, 0.47, 0.7])
        fbox(
          out,
          'iron',
          f,
          u * sideWidth - 0.024,
          u * sideWidth + 0.024,
          y + 1.88,
          y + 2.76,
          0.09,
          0.14,
          colors.iron,
        );
  }
  if (level >= 2) {
    lathe(
      out,
      'iron',
      [x, z],
      [
        [y + 2.49, r * 0.29, r * 0.29],
        [y + 2.6, r * 0.25, r * 0.25],
        [y + 3.05, r * 0.17, r * 0.17],
        [y + 3.63, r * 0.14, r * 0.14],
        [y + 3.81, r * 0.05, r * 0.05],
      ],
      8,
      colors.bell,
      { capBottom: true },
    );
  }
}

function tower(out, x, level) {
  const z = zFront - 2.25;
  abox(out, 'stone', [x - 2.28, floor, z - 2.39], [x + 2.28, 19.62, zFront + 0.018], colors.stone);
  abox(out, 'relief', [x - 2.38, 19.39, z - 2.46], [x + 2.38, 19.72, zFront + 0.13], colors.shadow);
  cornice(out, x, z, 19.96, 2.56, level);
  openBelfry(out, x, z, 20.04, 30.32, 2.53, level);
  cornice(out, x, z, 30.29, 2.61, level);
  openBelfry(out, x, z, 30.5, 39.0, 2.28, level);
  cornice(out, x, z, 39.07, 2.36, level);
  lathe(
    out,
    'relief',
    [x, z],
    [
      [39.17, 2.39, 2.39],
      [39.8, 1.81, 1.81],
      [40.3, 1.18, 1.18],
      [40.92, 0.67, 0.67],
      [41.25, 0.72, 0.72],
      [41.79, 0.43, 0.43],
      [42.34, 0.46, 0.46],
      [42.81, 0.2, 0.2],
    ],
    level >= 2 ? 12 : 8,
    colors.carved,
    { rotation: Math.PI / 8 },
  );
  if (level >= 1) {
    const front = facade([x, zFront + 0.02], [1, 0]);
    for (const [i, y] of [5.12, 8.36, 11.48, 14.58].entries()) {
      oval(out, front, 0, y, i % 2 ? 0.58 : 0.48, i % 2 ? 0.68 : 0.53, level, colors.glazed);
      if (level >= 2) {
        for (const u of [-0.57, 0.57])
          fbox(
            out,
            'relief',
            front,
            u - 0.1,
            u + 0.1,
            y - 0.15,
            y + 0.16,
            0.08,
            0.2,
            colors.carved,
          );
      }
    }
    for (const u of [-1.96, 1.96]) {
      fbox(out, 'relief', front, u - 0.095, u + 0.095, floor, 19.22, 0.015, 0.105, colors.pale);
    }
  }
  cross(out, x, 42.76, z, 1.64);
}

function oval(out, f, u, y, rx, ry, level, inner) {
  const n = level >= 2 ? 16 : 10;
  const at = (i, scale, d) =>
    f.P(
      u + rx * scale * Math.cos((i * 2 * Math.PI) / n),
      y + ry * scale * Math.sin((i * 2 * Math.PI) / n),
      d,
    );
  const disk = Array.from({ length: n }, (_, i) => at(i, 0.83, 0.067));
  fan(out, 'glass', disk, inner);
  for (let i = 0; i < n; i++)
    quad4(
      out,
      'relief',
      at(i, 1.24, 0.09),
      at(i + 1, 1.24, 0.09),
      at(i + 1, 0.79, 0.119),
      at(i, 0.79, 0.119),
      colors.carved,
    );
}

function figure(out, f, u, y, scale, depth) {
  const p = f.P(u, y, depth);
  const c = [p[0], p[2]];
  lathe(
    out,
    'relief',
    c,
    [
      [y, 0.23 * scale, 0.17 * scale],
      [y + 0.53 * scale, 0.29 * scale, 0.19 * scale],
      [y + 0.98 * scale, 0.34 * scale, 0.2 * scale],
      [y + 1.14 * scale, 0.14 * scale, 0.12 * scale],
    ],
    6,
    colors.pale,
  );
  lathe(
    out,
    'relief',
    c,
    [
      [y + 1.14 * scale, 0.11 * scale, 0.11 * scale],
      [y + 1.27 * scale, 0.16 * scale, 0.14 * scale],
      [y + 1.43 * scale, 0.11 * scale, 0.11 * scale],
      [y + 1.46 * scale, 0.04 * scale, 0.04 * scale],
    ],
    6,
    colors.pale,
  );
}

function retable(out, level) {
  const f = facade([axis, zFront + 0.05], [1, 0]);
  fbox(out, 'stone', f, -3.39, 3.39, floor, 18.7, -0.22, 0.145, colors.stone);
  fbox(out, 'relief', f, -3.46, 3.46, 18.66, 20.17, -0.03, 0.25, colors.carved);
  const base = f.P(0, 0, 0.21);
  const panel = facade([base[0], base[2]], [1, 0]);
  opening(out, panel, 0, 1.12, 2.75, 5.84, {
    head: 'round',
    glassSlot: 'door',
    frameSlot: 'relief',
    glass: colors.wood,
    frame: colors.shadow,
    frameWidth: level >= 1 ? 0.23 : 0,
    frameDepth: 0.23,
    d: 0.053,
  });
  if (level) {
    fbox(out, 'door', panel, -0.037, 0.037, 1.17, 5.35, 0.06, 0.087, colors.shadow);
    oval(out, panel, 0, 11.76, 1.34, 1.91, level, colors.shadow);
    window(out, panel, 0, 14.89, 2.23, 2.76, level);
  }
  for (const [lo, hi, spacing] of [
    [1.02, 8.46, 2.62],
    [8.51, 14.32, 2.46],
    [14.34, 18.83, 2.18],
  ]) {
    fbox(
      out,
      'relief',
      f,
      -spacing - 0.44,
      spacing + 0.44,
      hi - 0.51,
      hi - 0.15,
      0.14,
      0.64,
      colors.shadow,
    );
    for (const sign of [-1, 1]) {
      const u = sign * spacing;
      fbox(out, 'relief', f, u - 0.26, u + 0.26, lo, hi - 0.46, 0.18, 0.53, colors.pale);
      if (level >= 1) {
        fbox(out, 'relief', f, u - 0.43, u + 0.43, lo, lo + 0.47, 0.21, 0.63, colors.carved);
        fbox(out, 'relief', f, u - 0.42, u + 0.42, hi - 0.85, hi - 0.49, 0.25, 0.63, colors.carved);
      }
      if (level >= 2) {
        figure(out, f, u * 0.67, lo + 0.9, 0.88, 0.45);
        for (let i = 0; i < 5; i++) {
          const y = lo + 0.8 + (i * (hi - lo - 1.9)) / 5;
          const offset = 0.12 * (i % 2 === 0 ? -1 : 1);
          fbox(
            out,
            'relief',
            f,
            u + offset - 0.16,
            u + offset + 0.16,
            y,
            y + 0.28,
            0.33,
            0.68,
            colors.carved,
          );
        }
      }
    }
  }
  if (level >= 2) {
    figure(out, panel, -0.53, 10.64, 0.91, 0.37);
    figure(out, panel, 0.56, 10.83, 0.76, 0.38);
    for (const u of [-2.35, -1.79, 1.79, 2.35]) {
      fbox(out, 'relief', f, u - 0.27, u + 0.27, 7.15, 7.39, 0.27, 0.51, colors.shadow);
      fbox(out, 'relief', f, u - 0.24, u + 0.24, 14.13, 14.39, 0.18, 0.51, colors.carved);
    }
    for (let i = 0; i < 11; i++) {
      const u = (i - 5) * 0.56;
      fbox(out, 'relief', f, u - 0.058, u + 0.058, 19.95, 20.65, 0.05, 0.25, colors.carved);
    }
  }
  const g = [
    f.P(-1.74, 19.27, 0.247),
    f.P(1.74, 19.27, 0.247),
    f.P(1.26, 21.29, 0.247),
    f.P(0.84, 22.09, 0.247),
    f.P(0, 22.56, 0.247),
    f.P(-0.84, 22.09, 0.247),
    f.P(-1.26, 21.29, 0.247),
  ];
  fan(out, 'relief', g, colors.carved);
  const clock = facade([axis, zFront + 0.31], [1, 0]);
  oval(out, clock, 0, 21.06, 0.52, 0.52, level, colors.cream);
  if (level >= 2) {
    fbox(out, 'iron', clock, -0.027, 0.027, 21.05, 21.38, 0.075, 0.104, colors.iron);
    fbox(out, 'iron', clock, -0.24, 0.027, 21.037, 21.083, 0.075, 0.108, colors.iron);
    figure(out, f, -1.65, 21.15, 0.62, 0.25);
    figure(out, f, 1.65, 21.15, 0.62, 0.25);
  }
  fbox(out, 'relief', f, -0.52, 0.52, 21.98, 22.78, 0.04, 0.48, colors.carved);
  figure(out, f, 0, 22.74, 1.53, 0.27);
  const crown = f.P(0, 0, 0.27);
  cross(out, crown[0], 24.84, crown[2], 0.46, 0.06);
  for (let i = 0; i < 5; i++) {
    const z = zFront + 2.72 - i * 0.47;
    abox(
      out,
      'stone',
      [axis - 8.84, 0.01, z - 0.48],
      [axis + 8.84, 0.16 + i * 0.164, z],
      colors.step,
      { bottom: false },
    );
  }
}

function dome(out, level) {
  const center = [axis, -6.75];
  const [x, z] = center;
  slab(out, 'stone', x, z, 5.72, 17.45, 22.58, colors.stone);
  const apothem = 5.72 * Math.cos(Math.PI / 8);
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const f = facade(
        [x + apothem * Math.sin(a), z + apothem * Math.cos(a)],
        [Math.cos(a), -Math.sin(a)],
      );
      window(out, f, 0, 18.39, 1.85, 2.85, level, 'tudor');
      if (level >= 2) {
        for (const u of [-1.69, 1.69]) {
          fbox(out, 'relief', f, u - 0.12, u + 0.12, 17.88, 22.3, 0.01, 0.21, colors.carved);
          fbox(out, 'relief', f, u - 0.21, u + 0.21, 21.93, 22.25, 0.05, 0.29, colors.carved);
        }
        fbox(out, 'relief', f, -1.39, 1.39, 22.23, 22.51, 0.02, 0.13, colors.pale);
      }
    }
  }
  cornice(out, x, z, 22.62, 5.56, level);
  const domeY = 22.78;
  const radius = 5.82;
  const rise = 5.48;
  const point = (a, b, off = 0) => {
    const r = radius * Math.cos(b) + off;
    return [x + r * Math.sin(a), domeY + rise * Math.sin(b) + off * 0.7, z + r * Math.cos(a)];
  };
  const steps = [4, 6, 8, 10][level];
  const turns = [8, 16, 32, 48][level];
  const max = 1.29;
  for (let j = 0; j < steps; j++) {
    for (let i = 0; i < turns; i++) {
      const a = (i * 2 * Math.PI) / turns,
        b = ((i + 1) * 2 * Math.PI) / turns;
      const p = (j * max) / steps,
        q = ((j + 1) * max) / steps;
      quad4(out, 'roof', point(a, p), point(b, p), point(b, q), point(a, q), colors.clay);
    }
  }
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const middle = (i * Math.PI) / 4;
      const border = middle + Math.PI / 8;
      const ribHalf = level >= 2 ? 0.022 : 0.034;
      for (let row = 0; row < steps; row++) {
        const p = (row * max) / steps,
          q = ((row + 1) * max) / steps;
        quad4(
          out,
          'pattern',
          point(border - ribHalf, p, 0.043),
          point(border + ribHalf, p, 0.043),
          point(border + ribHalf, q, 0.043),
          point(border - ribHalf, q, 0.043),
          colors.pale,
        );
      }
      const diskSteps = level >= 2 ? 12 : 8;
      const circle = (j, scale = 1) => {
        const t = (j * 2 * Math.PI) / diskSteps;
        return point(
          middle + 0.21 * scale * Math.cos(t),
          0.54 + 0.246 * scale * Math.sin(t),
          0.057,
        );
      };
      for (let j = 0; j < diskSteps; j++)
        tri(out, 'pattern', point(middle, 0.54, 0.069), circle(j), circle(j + 1), colors.cream);
      if (level >= 2) {
        for (let j = 0; j < 5; j++) {
          const a = middle + (j - 2) * 0.143;
          const p = j % 2 === 0 ? 0.11 : 0.16;
          quad4(
            out,
            'pattern',
            point(a - 0.081, p, 0.043),
            point(a, p - 0.067, 0.045),
            point(a + 0.081, p, 0.043),
            point(a, p + 0.067, 0.045),
            j % 2 === 0 ? colors.cream : colors.tileDark,
          );
        }
        const [fx, , fz] = point(border, 0.035, 0.06);
        lathe(
          out,
          'relief',
          [fx, fz],
          [
            [22.95, 0.22, 0.22],
            [23.13, 0.22, 0.22],
            [23.36, 0.13, 0.13],
            [23.61, 0.22, 0.22],
            [24.04, 0.045, 0.045],
          ],
          6,
          colors.carved,
        );
      }
    }
  }
  slab(out, 'relief', x, z, 1.68, 27.88, 28.29, colors.shadow);
  slab(out, 'stone', x, z, 1.47, 28.22, 31.29, colors.stone);
  const lanternApothem = 1.47 * Math.cos(Math.PI / 8);
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const f = facade(
        [x + lanternApothem * Math.sin(a), z + lanternApothem * Math.cos(a)],
        [Math.cos(a), -Math.sin(a)],
      );
      window(out, f, 0, 28.61, 0.59, 1.91, level);
      if (level >= 2) fbox(out, 'relief', f, 0.43, 0.57, 28.45, 31.03, -0.02, 0.18, colors.carved);
    }
  }
  slab(out, 'relief', x, z, 1.67, 31.02, 31.34, colors.shadow);
  lathe(
    out,
    'roof',
    center,
    [
      [31.34, 1.48, 1.48],
      [31.8, 1.36, 1.36],
      [32.17, 1.06, 1.06],
      [32.35, 0.66, 0.66],
      [32.47, 0.18, 0.18],
    ],
    level >= 2 ? 16 : 8,
    colors.tile,
    { rotation: Math.PI / 8 },
  );
  lathe(
    out,
    'relief',
    center,
    [
      [32.44, 0.32, 0.32],
      [32.64, 0.34, 0.34],
      [32.83, 0.18, 0.18],
      [33.08, 0.24, 0.24],
      [33.27, 0.1, 0.1],
    ],
    8,
    colors.carved,
  );
  cross(out, x, 33.23, z, 0.62, 0.062);
}

function build(out, level) {
  churchBody(out, level);
  dome(out, level);
  tower(out, -4.56, level);
  tower(out, 7.12, level);
  retable(out, level);
}

export function skyline(out) {
  churchBody(out, 0);
  for (const x of [-4.56, 7.12]) {
    const z = zFront - 2.25;
    abox(out, 'stone', [x - 2.28, floor, z - 2.35], [x + 2.28, 19.82, zFront], colors.stone);
    for (const [low, high, half] of [
      [19.85, 30.3, 1.76],
      [30.36, 39.1, 1.55],
    ]) {
      abox(
        out,
        'relief',
        [x - half - 0.29, low, z - half - 0.29],
        [x + half + 0.29, low + 0.53, z + half + 0.29],
        colors.carved,
      );
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const cx = x + sx * half,
            cz = z + sz * half;
          abox(
            out,
            'stone',
            [cx - 0.38, low + 0.46, cz - 0.38],
            [cx + 0.38, high, cz + 0.38],
            colors.stone,
          );
        }
    }
    lathe(
      out,
      'relief',
      [x, z],
      [
        [39.01, 2.38, 2.38],
        [39.68, 2.3, 2.3],
        [40.35, 1.13, 1.13],
        [41.32, 0.58, 0.58],
        [42.81, 0.2, 0.2],
      ],
      4,
      colors.carved,
      { rotation: Math.PI / 4 },
    );
    cross(out, x, 42.76, z, 1.64);
  }
  const z = -6.75;
  lathe(
    out,
    'stone',
    [axis, z],
    [
      [17.54, 5.72, 5.72],
      [22.72, 5.72, 5.72],
    ],
    8,
    colors.stone,
    { rotation: Math.PI / 8, capTop: false },
  );
  lathe(
    out,
    'roof',
    [axis, z],
    [
      [22.72, 5.72, 5.72],
      [24.86, 5.08, 5.08],
      [26.71, 3.7, 3.7],
      [27.92, 1.65, 1.65],
    ],
    8,
    colors.clay,
    { rotation: Math.PI / 8, capTop: false },
  );
  lathe(
    out,
    'relief',
    [axis, z],
    [
      [27.87, 1.65, 1.65],
      [31.28, 1.65, 1.65],
      [32.47, 0.55, 0.55],
      [33.27, 0.1, 0.1],
    ],
    6,
    colors.stone,
  );
  const f = facade([axis, zFront + 0.05], [1, 0]);
  fbox(out, 'stone', f, -3.42, 3.42, floor, 19.31, -0.22, 0.16, colors.stone);
  fan(
    out,
    'relief',
    [
      f.P(-1.74, 19.21, 0.2),
      f.P(1.74, 19.21, 0.2),
      f.P(1.31, 21.18, 0.2),
      f.P(0, 23.5, 0.2),
      f.P(-1.31, 21.18, 0.2),
    ],
    colors.carved,
  );
  abox(out, 'stone', [axis - 8.81, 0.03, zFront], [axis + 8.81, 0.49, zFront + 2.65], colors.step, {
    bottom: false,
  });
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'church-of-santa-prisca-de-taxco-model.mjs';
const camera = [75, 49, 85];
const lookAt = [0, 18, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Santa Prisca’s twin open Baroque belfries, carved pink-stone portal and patterned crossing dome above Taxco’s hill town.',
  camera,
  lookAt,
  sunDirection: [39, 52, 74],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The surveyed outline covers the parish church with its attached chapel and rear rooms.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-borda-towers-and-retable', position: [6, 17, 77], lookAt: [1, 22, 23] },
    { name: 'tiled-dome-and-southern-transept', position: [40, 32, -44], lookAt: [0, 19, -5] },
    { name: 'open-belfries-and-pink-quarry-stone', position: [25, 34, 51], lookAt: [1, 32, 24] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'taxco-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.13,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
};
