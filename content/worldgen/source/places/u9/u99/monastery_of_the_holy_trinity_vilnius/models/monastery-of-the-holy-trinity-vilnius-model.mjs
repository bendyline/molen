import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/monastery-of-the-holy-trinity-vilnius-shape-controls');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const plaster = rgb('e4ddd0');
const white = rgb('ebe4d7');
const stone = rgb('c4b49c');
const ochre = rgb('bba281');
const cream = rgb('d4bea0');
const base = rgb('a79b8a');
const glass = rgb('3c4e59');
const door = rgb('634f3c');
const shade = rgb('494439');
const metal = rgb('60646b');
const roof = rgb('a66a4c');
const naveEaves = 14.03;

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function roofCap(out, ring, y, slot, color) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      slot,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Cannot close a monastery roof');
  const mesh = builder.finalize();
  const point = (index) => Array.from(mesh.positions.subarray(index * 3, index * 3 + 3));
  for (let i = 0; i < mesh.indices.length; i += 3)
    tri(
      out,
      slot,
      point(mesh.indices[i]),
      point(mesh.indices[i + 1]),
      point(mesh.indices[i + 2]),
      color,
    );
}

function hip(out, x0, x1, z0, z1, y, h, slot, color) {
  const a = [x0, y, z1],
    b = [x1, y, z1],
    c = [x1, y, z0],
    d = [x0, y, z0];
  const length = x1 - x0,
    mid = (z0 + z1) / 2;
  const r = [x0 + length * 0.33, y + h, mid],
    s = [x1 - length * 0.33, y + h, mid];
  quad4(out, slot, a, b, s, r, color);
  quad4(out, slot, c, d, r, s, color);
  tri(out, slot, a, r, d, color);
  tri(out, slot, c, s, b, color);
  box(out, 'stone', x0, x1, z0, z1, y - 0.18, y - 0.016, stone, true);
}

function setRoof(out, ring, y, slot, color) {
  extrude(out, 'stone', ring, y - 0.18, y, stone, { top: false });
  roofCap(out, ring, y, slot, color);
}

function trim(out, f, left, right, y, h, depth, color = stone) {
  fbox(out, 'stone', f, left, right, y, y + h, -0.08, depth, color);
}

function archWindow(out, f, u, y, w, h, level, color = glass) {
  opening(out, f, u, y, w, h, {
    head: 'round',
    glassSlot: 'dark',
    frameSlot: 'stone',
    glass: color,
    frame: stone,
    frameWidth: level >= 2 ? 0.13 : 0,
    frameDepth: 0.115,
    sill: level >= 2,
    mullions: level === 3 ? 2 : 0,
    transoms: level >= 2 ? 2 : 0,
  });
}

function flatWindow(out, f, u, y, width, height, level) {
  opening(out, f, u, y, width, height, {
    glassSlot: 'dark',
    frameSlot: 'stone',
    glass,
    frame: stone,
    frameWidth: level >= 2 ? 0.12 : 0,
    frameDepth: 0.1,
    sill: level >= 2,
    mullions: level === 3 ? 1 : 0,
    transoms: level === 3 ? 1 : 0,
  });
}

function cross(out, x, z, y, scale, level) {
  if (level === 0) return;
  const b = level === 1 ? 0.064 : 0.043;
  box(out, 'stone', x - b, x + b, z - b, z + b, y, y + 1.25 * scale, metal);
  box(
    out,
    'stone',
    x - 0.33 * scale,
    x + 0.33 * scale,
    z - b,
    z + b,
    y + 0.72 * scale,
    y + 0.83 * scale,
    metal,
  );
}

function turret(out, x, z, y, radius, height, level, west) {
  if (level === 0) {
    const eave = y + height * 0.76;
    const drum = radius * 0.81;
    lathe(
      out,
      'plaster',
      [x, z],
      [
        [y, radius, radius],
        [eave, drum, drum],
      ],
      6,
      plaster,
      { capTop: false },
    );
    lathe(
      out,
      'metal',
      [x, z],
      [
        [eave, radius, radius],
        [y + height, 0, 0],
      ],
      6,
      metal,
      { capTop: false },
    );
    return;
  }
  const n = west || level < 2 ? 8 : 14;
  const shaft = west
    ? [
        [0, 1.05],
        [0.19, 1.08],
        [0.21, 0.95],
        [0.68, 0.8],
        [0.72, 1.0],
      ]
    : [
        [0, 1],
        [0.57, 1],
        [0.59, 1.09],
        [0.65, 1.09],
        [0.67, 0.75],
        [0.85, 0.72],
      ];
  const capStart = shaft.at(-1)[0];
  const cap = west
    ? [
        [capStart, 1.04],
        [0.8, 1.01],
        [0.9, 0.62],
        [0.98, 0.14],
        [1.0, 0],
      ]
    : [
        [capStart, 0.91],
        [0.88, 0.88],
        [0.93, 0.68],
        [0.98, 0.28],
        [1, 0],
      ];
  const set = (rows) => rows.map(([t, r]) => [y + t * height, r * radius, r * radius]);
  lathe(out, 'plaster', [x, z], set(shaft), n, plaster, { capTop: false });
  lathe(out, 'metal', [x, z], set(cap), n, metal, { capTop: false });
  if (level >= 2) {
    const front = facade([x - radius * (west ? 0.8 : 1.03), z], [0, 1]);
    archWindow(out, front, 0, y + height * 0.35, radius * 0.58, height * 0.21, level, shade);
  }
  cross(out, x, z, y + height * 0.98, west ? 0.88 : 1.13, level);
}

function westFront(out, level) {
  const f = facade([-22.28, 4.64], [0, 1]);
  trim(out, f, -11.75, 11.72, 12.5, 0.48, 0.24);
  trim(out, f, -11.98, 11.98, 13.36, 0.46, 0.35, white);
  for (const u of level === 0 ? [] : [-10.45, -5.15, 5.15, 10.45]) {
    fbox(out, 'plaster', f, u - 0.56, u + 0.56, 0.48, 12.5, -0.08, 0.22, white);
    if (level >= 1) {
      trim(out, f, u - 0.72, u + 0.72, 11.96, 0.42, 0.34, white);
      trim(out, f, u - 0.67, u + 0.67, 0.61, 0.34, 0.36);
    }
  }
  for (const u of [-7.41, 7.39]) {
    if (level === 0) flatWindow(out, f, u, 5.48, 2.22, 5.46, level);
    else archWindow(out, f, u, 5.48, 2.22, 5.46, level);
  }
  if (level >= 1) archWindow(out, f, 0, 7.73, 2.01, 3.36, level);
  opening(out, f, 0, 0.36, 3.36, 5.55, {
    head: 'round',
    glassSlot: 'dark',
    frameSlot: 'stone',
    glass: door,
    frame: stone,
    frameWidth: level === 0 ? 0 : 0.24,
    frameDepth: 0.25,
    sill: false,
    mullions: level >= 2 ? 1 : 0,
    transoms: level === 3 ? 2 : 0,
  });
  for (const u of level === 0 ? [] : [-2.17, 2.17]) {
    fbox(out, 'stone', f, u - 0.28, u + 0.28, 0.57, 4.34, -0.05, 0.32, stone);
    if (level >= 2) fbox(out, 'stone', f, u - 0.4, u + 0.4, 4.04, 4.37, 0.02, 0.39, base);
  }
  const half = 7.03,
    y = 13.84;
  const profile = roundArch(half, [5, 8, 12, 20][level]).map(([u, h]) => [u, y + 0.57 * h]);
  fan(
    out,
    'plaster',
    profile
      .slice()
      .reverse()
      .map(([u, y]) => f.P(u, y, 0.04)),
    plaster,
  );
  for (let i = 1; i < profile.length; i++) {
    const [u0, y0] = profile[i - 1],
      [u1, y1] = profile[i];
    quad4(
      out,
      'stone',
      f.P(u0, y0 - 0.025, 0.1),
      f.P(u1, y1 - 0.025, 0.1),
      f.P(u1, y1 + 0.22, 0.1),
      f.P(u0, y0 + 0.22, 0.1),
      white,
    );
    quad4(
      out,
      'metal',
      f.P(u0, y0, -0.98),
      f.P(u1, y1, -0.98),
      f.P(u1, y1, 0.04),
      f.P(u0, y0, 0.04),
      metal,
    );
  }
  for (const [l, r] of [
    [-10.37, -7.03],
    [7.03, 10.37],
  ])
    trim(out, f, l, r, 13.93, 0.84, 0.16, white);
  for (let i = level === 0 ? 3 : 0; i < 4; i++)
    fbox(out, 'stone', f, -3.42, 3.42, -0.26, 0.03 + 0.14 * i, -0.04, 1.52 - 0.36 * i, base);
  if (level >= 2) {
    fbox(out, 'stone', f, -4.69, -3.84, 2.52, 3.76, 0.03, 0.07, base);
    for (let i = 0; i < 4; i++) trim(out, f, -4.57, -3.96, 2.71 + i * 0.19, 0.027, 0.083, shade);
  }
}

function sideChapel(out, ring, height, zFar, yFar, yNear, slot) {
  extrude(out, 'plaster', ring, -1.75, height, plaster, { top: false });
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]);
  const left = Math.min(...xs) - 0.16,
    right = Math.max(...xs) + 0.16;
  const zNear = zFar < 0 ? Math.max(...zs) + 0.13 : Math.min(...zs) - 0.13;
  const a = [left, yFar, zFar],
    b = [right, yFar, zFar];
  const c = [right, yNear, zNear],
    d = [left, yNear, zNear];
  quad4(out, slot, ...(zFar > 0 ? [a, b, c, d] : [d, c, b, a]), metal);
  for (const x of [left, right]) {
    const pt = x === left ? [a, d] : [c, b];
    const edge = zFar > 0 ? pt : pt.slice().reverse();
    quad4(
      out,
      'plaster',
      [edge[0][0], height, edge[0][2]],
      [edge[1][0], height, edge[1][2]],
      edge[1],
      edge[0],
      plaster,
    );
  }
}

function church(out, level) {
  const main = [
    [-22.23, -7.42],
    [7.7, -10.16],
    [14.77, -8.8],
    [17.04, -4.05],
    [17.21, 7.71],
    [15.12, 11.74],
    [10.52, 16.05],
    [-22.23, 16.68],
  ];
  extrude(out, 'plaster', main, -1.63, naveEaves, plaster, { top: false });
  roofCap(out, main, naveEaves, 'metal', metal);
  hip(out, -22.58, 17.18, -9.75, 16.82, naveEaves, 5.74, 'metal', metal);
  const centralApse = [
    [16.63, -5.35],
    [19.21, -1.04],
    [20.04, 0.55],
    [20.15, 2.67],
    [19.21, 5.34],
    [16.54, 9.2],
    [14.95, 7.4],
    [14.95, -4.1],
  ];
  for (const [ring, h] of [
    [centralApse, 11.74],
    [
      [
        [13.83, -8.68],
        [16.02, -7.13],
        [17.59, -4.15],
        [16.58, -2.55],
        [13.14, -3.05],
      ],
      10.91,
    ],
    [
      [
        [12.06, 10.48],
        [15.2, 9.72],
        [16.55, 10.13],
        [15.13, 11.74],
        [12.83, 12.63],
      ],
      10.65,
    ],
  ]) {
    extrude(out, 'plaster', ring, -1.1, h, plaster, { top: false });
    const center = [0, h + 1.75, 0];
    for (const [x, z] of ring) {
      center[0] += x / ring.length;
      center[2] += z / ring.length;
    }
    const outline = outwardRing(ring);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      tri(out, 'metal', [a[0], h, a[1]], [b[0], h, b[1]], center, metal);
    }
  }
  const north = [
    [-13.87, -13.31],
    [-2.4, -13.85],
    [-2.04, -8.66],
    [-13.73, -7.55],
  ];
  const south = [
    [-14.15, 27.18],
    [-4.2, 27.82],
    [-2.87, 25.18],
    [2.6, 24.67],
    [7.4, 23.26],
    [10.7, 22.12],
    [10.56, 15.9],
    [-12.65, 15.85],
  ];
  sideChapel(out, north, 7.19, -14.0, 9.32, 7.48, 'metal');
  sideChapel(out, south, 8.5, 28.0, 10.22, 8.75, 'metal');
  westFront(out, level);
  turret(out, -21.36, -6.33, 13.9, 1.15, 4.83, level, true);
  turret(out, -21.31, 15.43, 13.9, 1.15, 4.83, level, true);
  turret(out, 9.79, -9.37, -1.15, 2.21, 24.8, level, false);
  turret(out, 10.49, 15.48, -1.15, 2.21, 24.8, level, false);
  const c = [-8.21, 21.73];
  lathe(
    out,
    'plaster',
    c,
    [
      [8.62, 3.23, 3.23],
      [10.51, 3.28, 3.28],
    ],
    level >= 2 ? 14 : 8,
    white,
    { capTop: false },
  );
  const hemisphere = [
    [10.5, 3.35],
    [11.27, 3.23],
    [12.46, 2.69],
    [13.68, 1.66],
    [14.32, 0.81],
  ];
  lathe(
    out,
    'metal',
    c,
    hemisphere.map(([y, r]) => [y, r, r]),
    level >= 2 ? 14 : 8,
    metal,
  );
  turret(out, c[0], c[1], 14.25, 0.85, 2.45, level, true);
  if (level >= 1) {
    for (const [f, us] of [
      [facade([-21.65, 16.7], [1, 0]), [4.4, 13.7, 24.15]],
      [facade([7.51, -9.92], [-1, 0]), [2.4, 13.6, 24.6]],
    ]) {
      for (const u of us) archWindow(out, f, u, 8.01, 1.83, 4.33, level);
    }
    archWindow(out, facade([20.15, 1.62], [0, -1]), 0, 6.64, 1.35, 3.76, level);
  }
}

/** Open vault profile with stone spandrels and a continuous underside through its full depth. */
function archBay(out, f, u, y, half, spring, top, depth, level, color) {
  const points = roundArch(half, [4, 6, 10, 15][level]);
  for (let i = 1; i < points.length; i++) {
    const [a, h0] = points[i - 1],
      [b, h1] = points[i];
    for (const side of [0, -depth]) {
      const face = [
        f.P(u + a, spring + h0, side),
        f.P(u + b, spring + h1, side),
        f.P(u + b, top, side),
        f.P(u + a, top, side),
      ];
      quad4(out, 'plaster', ...(side === 0 ? face : face.reverse()), color);
    }
    quad4(
      out,
      'stone',
      f.P(u + b, spring + h1, 0),
      f.P(u + a, spring + h0, 0),
      f.P(u + a, spring + h0, -depth),
      f.P(u + b, spring + h1, -depth),
      base,
    );
  }
  for (const sign of [-1, 1]) {
    const x = u + sign * half;
    const line = [f.P(x, y, 0), f.P(x, y, -depth), f.P(x, spring, -depth), f.P(x, spring, 0)];
    quad4(out, 'stone', ...(sign > 0 ? line.reverse() : line), base);
  }
}

function belfry(out, level) {
  const ring = outwardRing(shape.belfry.slice(0, 4));
  extrude(out, 'plaster', ring, -2.34, level === 0 ? 16.42 : 11.78, ochre, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (level === 0) {
      for (const fraction of [0.34, 0.66])
        flatWindow(out, f, fraction * f.length, 12.2, 1.37, 3.4, 0);
      continue;
    }
    const width = 0.83,
      u1 = f.length * 0.34,
      u2 = f.length * 0.66;
    for (const [l, h] of [
      [0, u1 - width],
      [u1 + width, u2 - width],
      [u2 + width, f.length],
    ])
      fbox(out, 'plaster', f, l, h, 11.75, 16.42, -0.53, 0, ochre);
    for (const u of [u1, u2]) {
      fbox(out, 'plaster', f, u - width, u + width, 11.75, 12.19, -0.53, 0, ochre);
      archBay(out, f, u, 12.19, width, 14.77, 16.42, 0.53, level >= 2 ? 1 : 0, ochre);
    }
    trim(out, f, 0, f.length, 16.33, 0.29, 0.28, cream);
  }
  hip(out, -29.97, -17.73, -31.56, -19.23, 16.64, 2.08, 'tile', roof);
  cross(out, -23.84, -25.43, 18.63, 0.78, level);
}

function basilianGate(out, level) {
  const [court, street] = shape.gate.passageLine;
  const dx = street[0] - court[0],
    dz = street[1] - court[1],
    depth = Math.hypot(dx, dz);
  const f = facade(street, [dz, -dx]);
  const y = 0.31,
    half = 2.13,
    width = 4.72,
    top = 8.23;
  archBay(out, f, 0, y, half, 4.49, top, depth, level, cream);
  for (const side of [-1, 1]) {
    const bounds = [side * half, side * width].sort((a, b) => a - b);
    fbox(out, 'plaster', f, ...bounds, y - 0.62, top, -depth, 0.15, ochre);
  }
  fbox(out, 'plaster', f, -width, width, top, 10.22, -depth + 0.1, 0.05, cream);
  trim(out, f, -width - 0.16, width + 0.16, 7.73, 0.38, 0.47, stone);
  trim(out, f, -width - 0.13, width + 0.13, 9.87, 0.33, 0.64, stone);
  if (level === 0) {
    fbox(out, 'plaster', f, -4.64, 4.64, 10.19, 13.24, -2.85, 0.04, cream);
    fbox(out, 'plaster', f, -1.93, 1.93, 13.23, 16.21, -2.86, 0.07, cream);
    return;
  }
  for (const side of [-1, 1]) {
    for (const [baseU, h] of [
      [2.93, 7.64],
      [4.21, 8.15],
    ]) {
      const u = side * baseU,
        r = baseU > 4 ? 0.43 : 0.37;
      fbox(out, 'plaster', f, u - r, u + r, y + 0.23, h, -0.05, 0.38, cream);
      trim(out, f, u - r - 0.13, u + r + 0.13, y + 0.32, 0.36, 0.49, stone);
      trim(out, f, u - r - 0.09, u + r + 0.09, h - 0.18, 0.27, 0.52, stone);
      fbox(out, 'plaster', f, u - r, u + r, 10.14, 13.79, -2.87, 0.34, cream);
      trim(out, f, u - r - 0.11, u + r + 0.11, 13.55, 0.25, 0.48, stone);
    }
    const bounds = [side * 1.62, side * 4.69].sort((a, b) => a - b);
    fbox(out, 'plaster', f, ...bounds, 10.18, 13.06, -2.85, -0.02, cream);
  }
  fbox(out, 'plaster', f, -1.94, 1.94, 10.19, 15.48, -2.92, 0.08, cream);
  for (const [height, w, r] of [
    [15.44, 1.94, 0.93],
    [16.1, 1.24, 0.57],
  ]) {
    const cap = roundArch(w, level >= 2 ? 12 : 7);
    fan(
      out,
      'plaster',
      cap
        .slice()
        .reverse()
        .map(([u, h]) => f.P(u, height + h * r, 0.13)),
      cream,
    );
    for (let i = 1; i < cap.length; i++) {
      const [u0, h0] = cap[i - 1],
        [u1, h1] = cap[i];
      quad4(
        out,
        'stone',
        f.P(u0, height + r * h0, -2.5),
        f.P(u1, height + r * h1, -2.5),
        f.P(u1, height + r * h1, 0.17),
        f.P(u0, height + r * h0, 0.17),
        stone,
      );
    }
  }
  if (level >= 1) {
    for (const [u, w, yy] of [
      [-3.57, 0.66, 10.62],
      [0, 0.97, 12.31],
      [3.57, 0.66, 10.62],
    ]) {
      opening(out, f, u, yy, w * 2, 2.23, {
        head: 'round',
        glassSlot: 'stone',
        frameSlot: 'stone',
        glass: stone,
        frame: cream,
        frameWidth: level >= 2 ? 0.13 : 0,
        frameDepth: 0.31,
        d: 0.13,
      });
    }
    const c = f.P(0, 17.28, -0.27);
    cross(out, c[0], c[2], c[1], 0.68, level);
  }
}

function range(out, ring, eave, color, level) {
  extrude(out, 'plaster', ring, -5.05, eave, color, { top: false });
  if (level === 0) roofCap(out, ring, eave, 'tile', roof);
  else setRoof(out, ring, eave, 'tile', roof);
  for (let i = 0, poly = outwardRing(ring); level >= 1 && i < poly.length; i++) {
    const f = wallFace(poly[i], poly[(i + 1) % poly.length]);
    if (f.length < 5.5) continue;
    const bays = Math.max(1, Math.round(f.length / (level === 1 ? 6.5 : 4.55)));
    for (let j = 0; j < bays; j++) {
      const u = (f.length * (j + 0.5)) / bays;
      for (const height of level === 1 ? [eave - 3.25] : [eave - 7.35, eave - 3.25])
        flatWindow(out, f, u, height, 1.3, 1.95, level);
    }
  }
}

function monastery(out, level) {
  range(out, shape.historicMenRange, 10.32, plaster, level);
  range(out, shape.adjacentNorthRange, 8.52, cream, level);
  range(out, shape.conradCell, 6.54, cream, level);
  const options = { overhang: 0.26, endSlot: 'plaster', endColor: plaster };
  gableRoof(out, 'tile', [-50.25, -29.84], [-48.24, 38.82], 14.4, 10.31, 14.1, roof, options);
  gableRoof(out, 'tile', [-53.25, 45.2], [32.17, 41.52], 13.3, 10.31, 14.0, roof, options);
  gableRoof(out, 'tile', [-77.7, 35.1], [-54.47, 34.19], 12.1, 10.31, 13.87, roof, options);
  gableRoof(out, 'tile', [-46.27, -50.58], [-17.71, -55.07], 10.42, 8.5, 11.6, roof, options);
  gableRoof(out, 'tile', [-14.0, -37.13], [9.82, -37.72], 8.5, 8.5, 11.3, roof, options);
  gableRoof(out, 'tile', [10.71, 22.73], [11.32, 32.39], 11.7, 6.52, 9.33, roof, options);
}

function build(out, level) {
  church(out, level);
  belfry(out, level);
  basilianGate(out, level);
  monastery(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'monastery-of-the-holy-trinity-vilnius-model.mjs';
const camera = [102, 82, -83],
  lookAt = [-13, 8, -7];
const churchCamera = [-40.4, 7.9, 4.45],
  churchTarget = [-20.6, 9.3, 4.6];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'religious-complex',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Basilian Holy Trinity monastery in Vilnius, with a four-turret hall church, hipped roof, open Rococo street gate and a separate belfry.',
  camera,
  lookAt,
  sunDirection: [-55, 72, -40],
  mediumFiContext: {
    scale: 1.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'The named church perimeter preserves the side chapels, apses and east tower bays.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-restored-church', position: churchCamera, lookAt: churchTarget },
    { name: 'basilian-street-gate', position: [32, 5.7, -75], lookAt: [14, 8.7, -58] },
    { name: 'apses-turrets-and-belfry', position: [57, 40, 12], lookAt: [-1, 9, -7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'holy-trinity-vilnius-' + reviewLod,
    position: churchCamera,
    lookAt: churchTarget,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.51, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.036, surfaces },
    },
  },
};
