import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94 },
  weathered: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  shadow: { slot: 'door', localRef: 'palette:#ffffff', roughness: 1 },
};
const brown = rgb('9c765e'),
  aged = rgb('ab8b73'),
  deep = rgb('7e6151'),
  carved = rgb('b09178');
const lip = rgb('b59a7c'),
  shaded = rgb('443a33');
const box = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];

function ringCCW(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? ring : ring.toReversed();
}

function face(out, slot, points, color, axis) {
  let p = points.map((q) => q.map(Math.fround));
  if (axis && normalFor(...p).reduce((s, v, i) => s + v * axis[i], 0) < 0) p = p.toReversed();
  for (let i = 1; i + 1 < p.length; i++) {
    const tri = [p[0], p[i], p[i + 1]];
    const n = normalFor(...tri);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
  }
}

function wall(out, slot, ring, bottom, top, color, cap = true) {
  const path = ringCCW(ring);
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i],
      [u, v] = path[(i + 1) % path.length];
    face(
      out,
      slot,
      [
        [x, bottom, z],
        [u, bottom, v],
        [u, top, v],
        [x, top, z],
      ],
      color,
    );
  }
  if (!cap) return;
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'trim',
      'palette:#ffffff',
      path,
      [],
      () => top,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Invalid Konark wall outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => indices[i + j] * 3);
    face(
      out,
      slot,
      p.map((k) => positions.slice(k, k + 3)),
      color,
    );
  }
}

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  wall(out, slot, box(x0, x1, z0, z1), y0, y1, color);
}

function staircase(out, { name, bounds: [x0, x1, z0, z1], rise, steps }, detail) {
  const count = detail === 0 ? 2 : steps;
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count,
      y0 = 0.055,
      y1 = y0 + ((rise - y0) * (count - i)) / count;
    const t = (p, q, f) => p + (q - p) * f;
    const coordinates =
      name === 'east'
        ? [t(x0, x1, a), t(x0, x1, b), z0, z1]
        : name === 'south'
          ? [x0, x1, t(z0, z1, a), t(z0, z1, b)]
          : [x0, x1, t(z1, z0, b), t(z1, z0, a)];
    block(out, 'trim', ...coordinates, y0, y1, i % 3 === 0 ? carved : aged);
  }
}

function platform(out, outline, structure, detail) {
  const { plinth, stairs, terraces } = structure;
  wall(out, 'weathered', outline, -5.5, 0.051, aged);
  for (const ring of terraces) {
    if (detail >= 1) {
      wall(out, 'weathered', ring, 0.043, 0.54, carved, false);
      wall(out, 'stone', ring, 0.54, plinth - 0.42, brown, false);
      wall(out, 'trim', ring, plinth - 0.42, plinth, lip);
    } else wall(out, 'stone', ring, 0.046, plinth, aged);
  }
  for (const step of stairs) staircase(out, step, detail);
}

const square = box(-1, 1, -1, 1);
// Graduated offsets along each face give the masonry and cornices the ratha plan.
const ratha = ringCCW([
  [-1, -1],
  [-1, -0.67],
  [-1.038, -0.67],
  [-1.038, -0.28],
  [-1.075, -0.28],
  [-1.075, 0.28],
  [-1.038, 0.28],
  [-1.038, 0.67],
  [-1, 0.67],
  [-1, 1],
  [-0.67, 1],
  [-0.67, 1.038],
  [-0.28, 1.038],
  [-0.28, 1.075],
  [0.28, 1.075],
  [0.28, 1.038],
  [0.67, 1.038],
  [0.67, 1],
  [1, 1],
  [1, 0.67],
  [1.038, 0.67],
  [1.038, 0.28],
  [1.075, 0.28],
  [1.075, -0.28],
  [1.038, -0.28],
  [1.038, -0.67],
  [1, -0.67],
  [1, -1],
  [0.67, -1],
  [0.67, -1.038],
  [0.28, -1.038],
  [0.28, -1.075],
  [-0.28, -1.075],
  [-0.28, -1.038],
  [-0.67, -1.038],
  [-0.67, -1],
]);

function profile(out, slot, shape, [x, z], levels, color) {
  loft(
    out,
    slot,
    levels.map(([y, half]) => shape.map(([u, v]) => [x + u * half, y, z + v * half])),
    color,
    { cap: false },
  );
}

function tower(out, detail) {
  const { center, plinth, crown } = site.temple;
  const shape = detail >= 2 ? ratha : square;
  profile(
    out,
    'stone',
    shape,
    center,
    [
      [plinth, 14.58],
      [4.6, 14.73],
      [6.42, 14.1],
      [15.37, 14.1],
      [16.34, 14.65],
    ],
    brown,
  );
  profile(
    out,
    'trim',
    shape,
    center,
    [
      [15.78, 14.51],
      [16.49, 15.23],
      [16.91, 15.23],
      [17.16, 14.82],
    ],
    lip,
  );
  const tiers = [
    [17.15, 20.5, 14.82, 11.66, 5],
    [20.66, 24.82, 11.04, 7.52, 5],
    [24.87, 29.44, 7.06, 3.25, 5],
  ];
  for (const [y0, y1, r0, r1, count] of tiers) {
    if (detail === 0) {
      profile(
        out,
        'trim',
        shape,
        center,
        [
          [y0 - 0.17, r0],
          [y1, r1],
        ],
        carved,
      );
      continue;
    }
    for (let i = 0; i < count; i++) {
      const a = i / count,
        b = (i + 1) / count;
      const y = y0 + (y1 - y0) * a,
        r = r0 + (r1 - r0) * a;
      const hi = y0 + (y1 - y0) * b,
        n = r0 + (r1 - r0) * b;
      profile(
        out,
        'trim',
        shape,
        center,
        [
          [y - 0.1, r + 0.1],
          [y + 0.15, r + 0.08],
          [hi - 0.17, n + 0.16],
          [hi, n],
        ],
        i % 2 === 0 ? aged : carved,
      );
    }
  }
  for (const [index, [y, r]] of [
    [20.5, 11.66],
    [24.82, 7.52],
  ].entries()) {
    const [nextY, , nextR] = tiers[index + 1];
    profile(
      out,
      'trim',
      shape,
      center,
      [
        [y - 0.02, r + 0.03],
        [y + 0.054, r + 0.03],
        [y + 0.093, nextR + 0.07],
        [nextY, nextR + 0.07],
      ],
      deep,
    );
  }
  const n = detail === 0 ? 8 : detail === 1 ? 16 : 32;
  const cap = [
    [29.3, 3.88],
    [29.64, 4.25],
    [30.49, 4.1],
    [31.43, 2.88],
    [31.57, 2.68],
    [32.01, 3.17],
    [32.81, 3.1],
    [33.38, 2.04],
    [crown, 1.22],
  ];
  const ring = (y, r) => radialRing(y, r, r, n, center);
  const profileLevels = detail === 0 ? cap.filter((_, i) => i % 2 === 0) : cap;
  loft(
    out,
    'trim',
    profileLevels.map(([y, r]) => ring(y, r)),
    aged,
  );
  if (detail >= 2) {
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        dx = Math.cos(a),
        dz = Math.sin(a);
      beam(
        out,
        'trim',
        [center[0] + dx * 3.81, 29.58, center[1] + dz * 3.81],
        [center[0] + dx * 3.69, 30.53, center[1] + dz * 3.69],
        0.16,
        0.24,
        carved,
      );
    }
  }
}

function pier(out, x, z, y, h, half, color, detail) {
  if (detail < 2) {
    block(out, 'trim', x - half, x + half, z - half, z + half, y, y + h, color);
    return;
  }
  const bands = [
    [0, 1.09],
    [0.1, 1.09],
    [0.18, 0.87],
    [0.43, 0.79],
    [0.52, 0.92],
    [0.61, 0.8],
    [0.86, 0.84],
    [0.91, 1.03],
    [1, 1.07],
  ];
  profile(
    out,
    'trim',
    square,
    [x, z],
    bands.map(([f, s]) => [y + h * f, half * s]),
    color,
  );
  wall(
    out,
    'trim',
    box(x - half * 1.07, x + half * 1.07, z - half * 1.07, z + half * 1.07),
    y + h - 0.04,
    y + h,
    color,
  );
}

function facade(out, detail) {
  const [x, z] = site.temple.center;
  const body = 29.9,
    gate = 32.16,
    floor = site.temple.plinth;
  for (const s of [-1, 1]) {
    const z0 = z + s * 2.87 - 0.69,
      z1 = z + s * 2.87 + 0.69;
    block(out, 'trim', body, gate, z0, z1, floor, 14.73, carved);
    if (detail >= 1) {
      for (let i = 0; i < 4; i++) {
        block(
          out,
          'trim',
          gate - 0.05,
          gate + 0.16,
          z0 + 0.09 + i * 0.29,
          z0 + 0.24 + i * 0.29,
          floor,
          13.7,
          i % 2 ? lip : aged,
        );
      }
    }
  }
  block(out, 'trim', body, gate, z - 3.65, z + 3.65, 13.82, 15.11, aged);
  block(out, 'trim', body - 0.1, gate + 0.41, z - 3.94, z + 3.94, 15.11, 16.1, carved);
  face(
    out,
    'shadow',
    [
      [31.03, floor, z - 2],
      [31.03, 12.63, z - 2],
      [31.03, 12.63, z + 2],
      [31.03, floor, z + 2],
    ],
    shaded,
    [1, 0, 0],
  );
  if (detail === 0) return;
  for (const [axis, along, across] of [
    [0, 1, 1],
    [0, 1, -1],
    [1, 1, 1],
    [1, -1, -1],
  ]) {
    for (const u of [-11, -8, -5, 5, 8, 11]) {
      const n = 14.27 * across,
        t = u * along;
      const position = axis === 0 ? [x + n, z + t] : [x + t, z + n];
      pier(out, ...position, floor, 12.68, 0.43, aged, detail);
    }
  }
}

function wheel(out, x, y, z, side, detail) {
  const r = site.wheels.diameter / 2;
  const n = detail === 1 ? 12 : detail === 2 ? 20 : 32;
  const rim = (t, h, s) => [x + t * Math.cos(h), y + t * Math.sin(h), z + side * s];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      out,
      'trim',
      [rim(r, a, 0.21), rim(r, b, 0.21), rim(r * 0.79, b, 0.3), rim(r * 0.79, a, 0.3)],
      lip,
      [0, 0, side],
    );
    if (detail >= 2) {
      const outer = [
        rim(r, a, 0.21),
        rim(r, b, 0.21),
        rim(r * 0.991, b, 0.04),
        rim(r * 0.991, a, 0.04),
      ];
      const radial = [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0];
      face(out, 'stone', outer, aged, radial);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    if (detail < 2) {
      face(
        out,
        'trim',
        [
          rim(0.27, a - 0.28, 0.3),
          rim(r * 0.83, a - 0.06, 0.3),
          rim(r * 0.83, a + 0.06, 0.3),
          rim(0.27, a + 0.28, 0.3),
        ],
        carved,
        [0, 0, side],
      );
    } else {
      beam(out, 'trim', rim(0.28, a, 0.23), rim(r * 0.82, a, 0.24), 0.17, 0.18, carved);
    }
  }
  const hub = Array.from({ length: 12 }, (_, i) => rim(0.32, (2 * Math.PI * i) / 12, 0.35));
  face(out, 'trim', hub, lip, [0, 0, side]);
}

function remains(out, detail) {
  for (const [x0, x1, z0, z1, top] of [
    [-34.1, -29.3, -7.8, 7.7, 6.05],
    [-21.72, -6.9, -14.5, -9.6, 7.45],
    [-21.72, -7.6, 9.7, 14.3, 6.75],
    [-18.2, -13.7, -17.4, -14.5, 8.2],
    [-12.6, -8.7, 14.3, 17.6, 7.13],
  ])
    block(out, 'stone', x0, x1, z0, z1, site.temple.plinth, top, brown);
  if (detail < 2) return;
  for (const x of [-20, -16, -12, -8]) {
    for (const [a, b] of [
      [-13.08, -12.51],
      [12.1, 12.67],
    ]) {
      block(out, 'weathered', x - 0.39, x + 0.68, a, b, 7.14, 7.61, aged);
    }
  }
}

function danceHall(out, detail) {
  const [x, z] = site.dance.center,
    y = site.dance.plinth;
  const posts = [
    [-8.4, -8.4],
    [-8.4, 0],
    [-8.4, 8.4],
    [0, -8.4],
    [0, 8.4],
    [8.4, -8.4],
    [8.4, 8.4],
  ];
  for (const [dx, dz] of posts) {
    const h = 4.45 + 0.3 * Math.cos(dx + dz),
      u = x + dx,
      v = z + dz;
    block(out, 'stone', u - 1.61, u + 1.61, v - 1.61, v + 1.61, y, y + 0.69, brown);
    pier(out, u, v, y + 0.69, h, 1.18, carved, detail);
  }
  for (const s of [-1, 1]) {
    block(
      out,
      'stone',
      x - 9.72,
      x - 2.68,
      z + s * 9.68 - 0.64,
      z + s * 9.68 + 0.64,
      y,
      y + 1.62,
      brown,
    );
    block(
      out,
      'stone',
      x + 2.7,
      x + 9.72,
      z + s * 9.68 - 0.64,
      z + s * 9.68 + 0.64,
      y,
      y + 1.62,
      brown,
    );
  }
}

function temple(out, detail) {
  platform(out, site.outline, site.temple, detail);
  platform(out, site.dance.outline, site.dance, detail);
  tower(out, detail);
  facade(out, detail);
  remains(out, detail);
  danceHall(out, detail);
  if (detail >= 1) {
    for (const [x, north, south] of site.wheels.sideOffsets) {
      wheel(out, x, 1.89, north, -1, detail);
      wheel(out, x, 1.89, south, 1, detail);
    }
  }
}

export const buildSkyline = (out) => temple(out, 0);
export const buildDistrict = (out) => temple(out, 1);
export const buildStreet = (out) => temple(out, 2);
export const buildCloseup = (out) => temple(out, 3);
export const buildMaster = buildCloseup;
