/** The rounded belfries, curved frontispiece and hillside stair of Ouro Preto's Carmel church. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const field = read('terrain-grid.json');
const ring = frame.geometry.outline;
const [stairs] = frame.geometry.centerlines;
const d = plan.section;
const palette = 'palette:#ffffff';
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.18 },
  dark: { slot: 'window', localRef: palette, roughness: 0.86, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    lime: 'e4dbc3',
    aged: 'cfc4ae',
    light: 'bec1ae',
    stone: 'a1977e',
    gray: '8b8777',
    lightStone: 'b5a891',
    oldStone: '716e60',
    cloth: '58594c',
    olive: '697467',
    green: '465949',
    dark: '3f4140',
    bronze: '665b42',
    timber: '665747',
    roof: 'a46444',
    shadeTile: '875239',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const vertical = [0, 1, 0];
const front = [0, 0, 1];
const tau = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function face(out, id, points, normal, color) {
  if (points.length === 4) quad(out, id, points, normal, color);
  else out.addConvexPolygon(id, palette, points, normal, ([x, y, z]) => [x + z, y], color);
}

function slope(out, id, points, color) {
  const n = normalFor(...points);
  face(out, id, points, n[1] < 0 ? n.map((v) => -v) : n, color);
}

function walls(out, lod) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  for (const [i, [x, z]] of ring.entries()) {
    const [u, v] = ring[(i + 1) % ring.length];
    const length = Math.hypot(u - x, v - z);
    const sign = Math.sign(area);
    const n = [(sign * (v - z)) / length, 0, (-sign * (u - x)) / length];
    const bottom = Math.min(d.floorY - 0.4, ground(x, z) - 0.64);
    const end = Math.min(d.floorY - 0.4, ground(u, v) - 0.64);
    const panel = (slot, loA, loB, hi, off, color) =>
      face(
        out,
        slot,
        [
          [x + n[0] * off, loA, z + n[2] * off],
          [u + n[0] * off, loB, v + n[2] * off],
          [u + n[0] * off, hi, v + n[2] * off],
          [x + n[0] * off, hi, z + n[2] * off],
        ],
        n,
        color,
      );
    panel('base', bottom, end, d.floorY + 0.07, 0, c.stone);
    panel('plaster', d.floorY, d.floorY, d.eavesY, 0, c.lime);
    if (lod > 0)
      panel('stone', d.eavesY - 0.37, d.eavesY - 0.37, d.eavesY + 0.06, 0.149, c.lightStone);
    if (lod > 1 && z < -7 && length > 8) {
      const count = Math.round(length / 9.85);
      const step = length / (count + 1);
      for (let k = 1; k <= count; k++) {
        const t = (k * step) / length;
        const point = (a, y, off) => [
          mix(x, u, t) + (a * (u - x)) / length + off * n[0],
          y,
          mix(z, v, t) + (a * (v - z)) / length + off * n[2],
        ];
        const y = 8.76 + 0.1 * Math.sin(k);
        pictureWindow(out, point, n, y, 1.29, 2.36, lod);
      }
    }
  }
}

function hip(out, lod) {
  const z0 = -53.43;
  const z1 = -0.94;
  const middle = d.ridgeY;
  const a = [-8.13, d.eavesY, z0],
    b = [8.13, d.eavesY, z0];
  const p = [8.13, d.eavesY, z1],
    q = [-8.13, d.eavesY, z1];
  const lo = [0, middle, z0 + 7.2],
    hi = [0, middle, z1 - 7.9];
  slope(out, 'roof', [a, lo, hi, q], c.shadeTile);
  slope(out, 'roof', [b, p, hi, lo], c.roof);
  slope(out, 'roof', [a, b, lo], c.roof);
  slope(out, 'roof', [q, hi, p], c.shadeTile);
  if (lod > 1)
    box(out, 'roof', [-0.14, middle - 0.08, lo[2]], [0.14, middle + 0.11, hi[2]], c.roof);
}

const facadeProfile = [
  [-7.81, -0.78],
  [-5.82, -0.72],
  [-2.48, -0.34],
  [0, 0],
  [2.64, -0.33],
  [5.92, -0.93],
  [7.81, -0.96],
];
function frontZ(x) {
  for (let i = 1; i < facadeProfile.length; i++) {
    const [a, z] = facadeProfile[i - 1],
      [b, v] = facadeProfile[i];
    if (x <= b) return mix(z, v, Math.max(0, (x - a) / (b - a)));
  }
  return facadeProfile.at(-1)[1];
}

function pictureWindow(out, point, n, y, w, h, lod) {
  const panel = (slot, a, b, lo, hi, off, color) =>
    face(
      out,
      slot,
      [point(a, lo, off), point(b, lo, off), point(b, hi, off), point(a, hi, off)],
      n,
      color,
    );
  panel('stone', -w / 2 - 0.12, w / 2 + 0.12, y - 0.15, y + h + 0.12, 0.045, c.stone);
  panel('door', -w / 2, w / 2, y, y + h, 0.081, c.olive);
  if (lod < 2) return;
  panel('dark', -w * 0.38, w * 0.38, y + h * 0.38, y + h * 0.91, 0.114, c.dark);
  panel('door', -0.024, 0.024, y + h * 0.38, y + h * 0.91, 0.147, c.light);
  for (const t of [0.54, 0.72])
    panel('door', -w * 0.38, w * 0.38, y + h * t, y + h * t + 0.04, 0.151, c.light);
  if (lod === 3)
    panel('stone', -w / 2 - 0.23, w / 2 + 0.23, y - 0.19, y - 0.09, 0.16, c.lightStone);
}

function arch(out, x, bottom, spring, radius, rise, z, slot, color, lod) {
  face(
    out,
    slot,
    [
      [x - radius, bottom, z],
      [x + radius, bottom, z],
      [x + radius, spring, z],
      [x - radius, spring, z],
    ],
    front,
    color,
  );
  const points = [[x, spring, z]];
  for (let i = 0; i <= lod; i++) {
    const angle = (i * Math.PI) / lod;
    points.push([x + radius * Math.cos(angle), spring + rise * Math.sin(angle), z]);
  }
  for (let i = 2; i < points.length; i++)
    face(out, slot, [points[0], points[i - 1], points[i]], front, color);
}

function medallion(out, x, y, a, b, z, lod, lobed = false) {
  const sides = [8, 12, 24, 32][lod];
  for (const [ratio, slot, color, off] of [
    [1, 'stone', c.oldStone, 0],
    [0.78, 'dark', c.dark, 0.038],
  ]) {
    const p = Array.from({ length: sides }, (_, i) => {
      const u = (tau * i) / sides;
      const wave = lobed ? 1 + 0.16 * Math.cos(3 * u - Math.PI / 2) : 1;
      return [x + a * ratio * wave * Math.cos(u), y + b * ratio * wave * Math.sin(u), z + off];
    });
    for (let i = 0; i < p.length; i++)
      face(out, slot, [[x, y, z + off], p[i], p[(i + 1) % p.length]], front, color);
  }
}

function frontispiece(out, lod) {
  const band = [
    [-7.8, 13.56],
    [-6.45, 13.68],
    [-4.05, 13.67],
    [-2.13, 13.91],
    [-1.18, 14.49],
    [0, 14.81],
    [1.18, 14.49],
    [2.14, 13.91],
    [4.06, 13.66],
    [6.45, 13.67],
    [7.8, 13.57],
  ];
  const pediment = [
    [-7.77, 14.1],
    [-7.1, 15.95],
    [-6.1, 16.25],
    [-4.88, 16.61],
    [-3.41, 17.54],
    [-3.18, 20.22],
    [-1.32, 20.32],
    [0, 20.64],
    [1.32, 20.32],
    [3.18, 20.22],
    [3.41, 17.54],
    [4.88, 16.61],
    [6.1, 16.25],
    [7.1, 15.95],
    [7.77, 14.1],
  ];
  for (let i = 1; i < pediment.length; i++) {
    const [a, y] = pediment[i - 1];
    const [b, v] = pediment[i];
    const az = frontZ(a) + 0.15;
    const bz = frontZ(b) + 0.15;
    const bottom = d.eavesY - 0.56;
    face(
      out,
      'plaster',
      [
        [a, bottom, az],
        [b, bottom, bz],
        [b, v, bz],
        [a, y, az],
      ],
      front,
      c.lime,
    );
    face(
      out,
      'stone',
      [
        [a, y - 0.19, az + 0.06],
        [b, v - 0.19, bz + 0.06],
        [b, v + 0.09, bz + 0.06],
        [a, y + 0.09, az + 0.06],
      ],
      front,
      c.gray,
    );
    face(
      out,
      'plaster',
      [
        [a, bottom, az - 0.79],
        [b, bottom, bz - 0.79],
        [b, v, bz - 0.79],
        [a, y, az - 0.79],
      ],
      [0, 0, -1],
      c.aged,
    );
    slope(
      out,
      'stone',
      [
        [a, y, az + 0.06],
        [b, v, bz + 0.06],
        [b, v, bz - 0.79],
        [a, y, az - 0.79],
      ],
      c.gray,
    );
  }
  for (let i = 1; i < band.length; i++) {
    const [a, y] = band[i - 1],
      [b, v] = band[i];
    for (const [low, high, depth, color] of [
      [-0.43, 0.02, 0.24, c.stone],
      [0.02, 0.23, 0.39, c.lightStone],
    ]) {
      face(
        out,
        'stone',
        [
          [a, y + low, frontZ(a) + depth],
          [b, v + low, frontZ(b) + depth],
          [b, v + high, frontZ(b) + depth],
          [a, y + high, frontZ(a) + depth],
        ],
        front,
        color,
      );
    }
  }
  const portalZ = 0.48;
  const archSegments = [6, 9, 14, 18][lod];
  arch(out, 0, d.floorY, 5.8, 2.48, 2.02, portalZ, 'stone', c.lightStone, archSegments);
  arch(out, 0, d.floorY + 0.05, 5.62, 1.77, 1.04, portalZ + 0.06, 'door', c.green, archSegments);
  for (const side of [-1, 1]) {
    const x = 2.12 * side;
    box(out, 'stone', [x - 0.2, 0.61, portalZ - 0.18], [x + 0.2, 6.96, portalZ + 0.17], c.stone);
    box(
      out,
      'stone',
      [x - 0.38, 6.66, portalZ - 0.33],
      [x + 0.38, 7.06, portalZ + 0.28],
      c.lightStone,
    );
    const xw = side * 4.04;
    pictureWindow(
      out,
      (a, y, z) => [xw + a, y, frontZ(xw) + 0.095 + z],
      front,
      8.19,
      1.52,
      3.33,
      lod,
    );
    if (lod > 0) medallion(out, side * 6.67, 16.1, 0.63, 0.88, frontZ(side * 6.67) + 0.28, lod);
  }
  medallion(out, 0, 17.93, 0.92, 0.98, 0.4, lod);
  if (lod > 0) {
    medallion(out, 0, 8.17, 0.83, 0.69, 0.6, lod, true);
    for (const x of [-1.22, -0.45, 0.45, 1.22])
      box(
        out,
        'door',
        [x - 0.025, 0.63, portalZ + 0.069],
        [x + 0.025, 5.91, portalZ + 0.111],
        c.olive,
      );
    if (lod > 1) {
      for (const side of [-1, 1]) {
        for (const [u, y, r] of [
          [1.88, 7.53, 0.36],
          [1.48, 8.06, 0.28],
          [0.89, 8.64, 0.23],
        ])
          medallion(out, u * side, y, r, r * 0.75, portalZ + 0.12, lod, true);
      }
    }
  }
  for (const [x, y, height] of [
    [-2.52, 20.29, 2.75],
    [2.52, 20.29, 2.75],
    [0, 20.44, 3.18],
  ])
    loft(
      out,
      'stone',
      [
        [y, 0.41],
        [y + height * 0.36, 0.34],
        [y + height * 0.64, 0.22],
        [y + height, 0.045],
      ].map(([h, r]) => radialRing(h, r, r, [5, 8, 12, 16][lod], [x, -0.17])),
      c.oldStone,
      { cap: false },
    );
  box(out, 'metal', [-0.105, 22.83, -0.33], [0.105, 25.46, -0.03], c.gray);
  box(out, 'metal', [-0.92, 24.32, -0.32], [0.92, 24.57, -0.07], c.gray);
  box(out, 'base', [-2.16, ground(0, 1.5) - 0.34, -0.29], [2.16, d.floorY + 0.02, 1.54], c.stone);
}

function roundedTower(out, x, z, lod) {
  const sides = [8, 20, 32, 48][lod];
  const at = (a, y, r) => {
    const sx = Math.sin(a),
      sz = Math.cos(a);
    return [
      x + r * Math.sign(sx) * Math.pow(Math.abs(sx), 0.78),
      y,
      z + r * Math.sign(sz) * Math.pow(Math.abs(sz), 0.78),
    ];
  };
  const section = (items, slot, tint) => {
    const profile =
      lod === 0 ? items.filter((_, i) => i % 2 === 0 || i === items.length - 1) : items;
    const rings = profile.map(([y, r]) =>
      Array.from({ length: sides }, (_, i) => at((tau * i) / sides, y, r)),
    );
    loft(out, slot, rings, tint, { cap: false });
  };
  section(
    [
      [d.eavesY - 0.61, 2.65],
      [d.eavesY - 0.12, 2.83],
      [d.eavesY + 0.18, 2.98],
      [d.eavesY + 0.47, 2.98],
      [d.eavesY + 0.61, 2.67],
    ],
    'stone',
    c.stone,
  );
  const body = 2.61;
  const start = d.eavesY + 0.58;
  const sill = d.towerSillY;
  const cap = d.towerCapY;
  const top = (a) => {
    const faceAngle = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    const delta = (b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const t = Math.min(delta(0), delta(faceAngle)) / 0.35;
    return t <= 1 ? 21.16 + 0.96 * Math.sqrt(1 - t * t) : sill;
  };
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides,
      b = (tau * (i + 1)) / sides;
    const n = [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)];
    const t = top(a),
      u = top(b);
    face(
      out,
      'plaster',
      [at(a, start, body), at(b, start, body), at(b, sill, body), at(a, sill, body)],
      n,
      c.aged,
    );
    face(
      out,
      'plaster',
      [at(a, t, body), at(b, u, body), at(b, cap, body), at(a, cap, body)],
      n,
      c.aged,
    );
    if ((t > sill || u > sill) && lod > 0) {
      const p = [at(a, t, body), at(b, u, body), at(b, u, body - 0.42), at(a, t, body - 0.42)];
      slope(out, 'stone', p, c.gray);
      slope(
        out,
        'stone',
        [at(a, sill, body), at(b, sill, body), at(b, sill, body - 0.45), at(a, sill, body - 0.45)],
        c.lightStone,
      );
    }
  }
  if (lod > 0) {
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        const cx = x + s * 1.88,
          cz = z + t * 1.88;
        box(out, 'stone', [cx - 0.23, start, cz - 0.22], [cx + 0.23, cap, cz + 0.22], c.lightStone);
      }
    }
    box(out, 'door', [x - 1.36, 22.28, z - 0.25], [x + 1.36, 22.58, z + 0.25], c.timber);
  }
  section(
    [
      [cap - 0.2, 2.67],
      [cap + 0.01, 2.84],
      [cap + 0.35, 2.95],
      [cap + 0.55, 2.89],
      [cap + 0.7, 2.37],
      [cap + 1.41, 2.22],
      [cap + 2.06, 1.88],
      [cap + 2.6, 1.25],
      [cap + 2.84, 0.67],
    ],
    'stone',
    c.gray,
  );
  const finial = [
    [cap + 2.67, 0.62],
    [cap + 2.97, 0.61],
    [cap + 3.37, 0.43],
    [cap + 3.75, 0.45],
    [cap + 4.12, 0.29],
    [d.towerTipY, 0.052],
  ];
  const belfryBell = [
    [18.21, 0.86],
    [18.44, 0.92],
    [18.74, 0.72],
    [19.46, 0.53],
    [20.17, 0.39],
    [20.65, 0.13],
  ];
  for (const [profile, slot, tint] of [
    [finial, 'stone', c.oldStone],
    [belfryBell, 'metal', c.bronze],
  ]) {
    const outline =
      lod === 0 ? profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1) : profile;
    const rings = outline.map(([y, r]) => radialRing(y, r, r, [6, 10, 16, 24][lod], [x, z]));
    loft(out, slot, rings, tint, { cap: false });
  }
  if (lod > 1) {
    for (const y of [4.52, 9.48]) {
      const near = z + 2.91;
      arch(out, x, y, y + 0.56, 0.35, 0.24, near, 'stone', c.stone, 8);
      arch(out, x, y + 0.1, y + 0.51, 0.22, 0.16, near + 0.031, 'dark', c.dark, 8);
    }
  }
}

function approach(out, lod) {
  const [low, high] = stairs;
  const steps = [6, 12, 20, 26][lod];
  const width = 6.72;
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps;
    const z = mix(high[1], low[1], a),
      zn = mix(high[1], low[1], b);
    const x = mix(high[0], low[0], a),
      xn = mix(high[0], low[0], b);
    const y = mix(d.stairTopY, d.stairFootY, a);
    const bottom =
      Math.min(ground(x - width / 2, z), ground(x + width / 2, z), ground(xn, zn)) - 0.81;
    const tint = i % 5 === 0 ? c.lightStone : c.stone;
    const points = [
      [x - width / 2, y, z],
      [x + width / 2, y, z],
      [xn + width / 2, y, zn],
      [xn - width / 2, y, zn],
    ];
    face(out, 'base', points, vertical, tint);
    face(
      out,
      'base',
      [[xn - width / 2, bottom, zn], [xn + width / 2, bottom, zn], points[2], points[3]],
      front,
      tint,
    );
    for (const side of [-1, 1])
      face(
        out,
        'base',
        [
          [x + (side * width) / 2, bottom, z],
          [xn + (side * width) / 2, bottom, zn],
          [xn + (side * width) / 2, y, zn],
          [x + (side * width) / 2, y, z],
        ],
        [side, 0, 0],
        c.gray,
      );
  }
  if (lod > 0) {
    for (const [x, z] of [high, low]) {
      for (const side of [-1, 1]) {
        const px = x + side * (width / 2 + 0.25);
        const y = ground(px, z);
        box(out, 'base', [px - 0.25, y - 0.25, z - 0.26], [px + 0.25, y + 1.62, z + 0.26], c.stone);
        box(out, 'stone', [px - 0.32, y + 1.59, z - 0.32], [px + 0.32, y + 1.77, z + 0.32], c.gray);
      }
    }
  }
}

function draw(out, lod) {
  walls(out, lod);
  hip(out, lod);
  frontispiece(out, lod);
  for (const [x, z] of d.towerCenters) roundedTower(out, x, z, lod);
  approach(out, lod);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [31, 36, 86];
const lookAt = [0, 10, -5];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Rococo church of Our Lady of Mount Carmel in Ouro Preto, with rounded twin belfries, a sculpted and curved front, a terracotta roof and a long hillside stair.',
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.995,
    basis: 'Exact named church way 182626926, independent of the mapped approach stair.',
  },
  camera,
  lookAt,
  sunDirection: [-41, 62, 54],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.18,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'principal-stair-and-rococo-front', position: [-13, 13, 64], lookAt: [0, 11, 5] },
    { name: 'carved-portal-and-twin-bells', position: [9, 12, 40], lookAt: [0, 14, -1] },
    { name: 'side-ridge-and-original-hillside', position: [48, 30, -18], lookAt: [0, 9, -18] },
    { name: 'rear-and-tiled-roof', position: [-40, 36, -66], lookAt: [0, 11, -16] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'carmo-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.27,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.5, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent reconstruction from the public-domain original Museu Paulista postcard, mapped ODbL footprints, and the provider elevation field.',
};
