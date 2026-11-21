import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  brick: 'ad916a',
  stone: 'c8b797',
  roof: 'baac8d',
  deep: '635b54',
  indigo: '2c4772',
  blue: '367995',
  teal: '59a7a1',
  pale: 'e2dbba',
  gold: 'cea243',
  goldDark: 'aa7e30',
  goldLustre: 'deb458',
  timber: '685448',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.88),
  roof: surface('roof', 'stone_sandstone', 0.9),
  tile: surface('trim', 'tile_glazed', 0.68, 0.045),
  gold: surface('roof', 'metal_painted', 0.59, 0.52),
  wood: surface('door', 'wood_plain', 0.87),
};
const up = [0, 1, 0];
const down = [0, -1, 0];

function pointed(radius, spring, peak, steps) {
  const center = radius * 0.46;
  const circle = radius + center;
  const height = (peak - spring) / Math.sqrt(circle * circle - center * center);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = mix(-radius, radius, i / steps);
    const distance = Math.min(circle, Math.abs(x) + center);
    return [x, spring + height * Math.sqrt(Math.max(0, circle * circle - distance * distance))];
  });
}

function wallBand(out, wall, l, r, y, height, depth, lod) {
  panel(out, 'tile', wall, l, r, y, y + height, depth, color.indigo);
  if (!lod) return;
  for (const vertical of [y, y + height * 0.88])
    panel(out, 'tile', wall, l, r, vertical, vertical + height * 0.12, depth + 0.015, color.teal);
  if (lod < 2) return;
  const steps = Math.max(1, Math.floor((r - l) / (lod === 3 ? 0.44 : 0.8)));
  for (let i = 0; i < steps; i++) {
    const x = mix(l, r, (i + 0.5) / steps);
    const width = ((r - l) / steps) * 0.32;
    const center = y + height * 0.5;
    face(
      out,
      'tile',
      [
        wall.p(x - width, center, depth + 0.023),
        wall.p(x, center + height * 0.31, depth + 0.023),
        wall.p(x + width, center, depth + 0.023),
        wall.p(x, center - height * 0.31, depth + 0.023),
      ],
      wall.normal,
      i % 3 ? color.pale : color.blue,
    );
  }
}

function archedOpening(
  out,
  wall,
  c,
  l,
  r,
  floor,
  spring,
  peak,
  top,
  radius,
  depth,
  lod,
  forceGold = false,
) {
  const profile = pointed(radius, spring, peak, [4, 6, 10, 14][lod]);
  const p = (x, y, offset = 0) => wall.p(c + x, y, offset);
  const front = forceGold ? color.goldLustre : color.stone;
  const trim = forceGold ? 'gold' : 'tile';
  const tint = forceGold ? color.goldDark : color.blue;
  panel(out, 'brick', wall, l, c - radius, floor, top, 0, front);
  panel(out, 'brick', wall, c + radius, r, floor, top, 0, front);
  panel(out, 'wood', wall, c - radius, c + radius, floor, spring + 0.02, -depth, color.deep);
  face(
    out,
    'wood',
    profile.map(([a, y]) => p(a, y, -depth)),
    wall.normal,
    color.deep,
  );
  for (const [i, [[a, y], [b, h]]] of pairs(profile).entries()) {
    face(out, 'brick', [p(a, y), p(b, h), p(b, top), p(a, top)], wall.normal, front);
    if (lod) face(out, trim, [p(a, y), p(b, h), p(b, h, -depth), p(a, y, -depth)], down, tint);
    if (lod > 1) {
      const offset = 0.026;
      const width = forceGold ? 0.26 : 0.14;
      face(
        out,
        trim,
        [p(a, y, offset), p(b, h, offset), p(b, h + width, offset), p(a, y + width, offset)],
        wall.normal,
        i % 3 === 1 ? color.pale : tint,
      );
    }
  }
  if (lod)
    for (const direction of [-1, 1]) {
      const u = radius * direction;
      const normal = [wall.normal[2] * -direction, 0, wall.normal[0] * direction];
      face(
        out,
        trim,
        [p(u, floor), p(u, spring), p(u, spring, -depth), p(u, floor, -depth)],
        normal,
        tint,
      );
    }
}

function arcade(out, wall, begin, finish, floor, lod) {
  const width = finish - begin;
  if (width < 1.1) return;
  const count = Math.max(1, Math.round(width / (lod ? 5.9 : 14)));
  const step = width / count;
  const top = floor + 9.85;
  if (lod < 2) {
    panel(out, 'stone', wall, begin, finish, floor - 0.26, top, 0, color.stone);
    wallBand(out, wall, begin, finish, floor + 4.96, 0.36, 0.07, 0);
    wallBand(out, wall, begin, finish, top - 0.34, 0.53, 0.08, 0);
    for (let i = 0; i < count; i++) {
      const center = begin + (i + 0.5) * step;
      const radius = step * (lod === 0 ? 0.29 : 0.34);
      if (lod === 0) {
        panel(
          out,
          'wood',
          wall,
          center - radius,
          center + radius,
          floor + 0.19,
          floor + 3.67,
          0.023,
          color.deep,
        );
        continue;
      }
      for (const [base, start, peak] of [
        [0.2, 2.85, 4.85],
        [5.53, 7.1, 8.8],
      ]) {
        panel(
          out,
          'wood',
          wall,
          center - radius,
          center + radius,
          floor + base,
          floor + start,
          0.024,
          color.deep,
        );
        face(
          out,
          'wood',
          pointed(radius, floor + start, floor + peak, 4).map(([x, y]) =>
            wall.p(center + x, y, 0.024),
          ),
          wall.normal,
          color.deep,
        );
      }
    }
    return;
  }

  for (let i = 0; i < count; i++) {
    const a = begin + step * i;
    const b = a + step;
    const center = (a + b) * 0.5;
    archedOpening(
      out,
      wall,
      center,
      a,
      b,
      floor + 0.13,
      floor + 2.68,
      floor + 4.91,
      floor + 5.17,
      step * 0.36,
      0.75,
      lod,
    );
    if (lod)
      archedOpening(
        out,
        wall,
        center,
        a,
        b,
        floor + 5.22,
        floor + 7.02,
        floor + 8.79,
        top,
        step * 0.33,
        0.34,
        lod,
      );
    else panel(out, 'stone', wall, a, b, floor + 5.17, top, 0, color.stone);
  }
  wallBand(out, wall, begin, finish, floor + 4.96, 0.36, 0.072, lod);
  wallBand(out, wall, begin, finish, top - 0.34, 0.53, 0.079, lod);
  panel(out, 'stone', wall, begin, finish, floor - 0.36, floor + 0.26, 0.035, color.roof);
}

function iwan(out, wall, u, base, size, depth, lod, golden) {
  const radius = size.span * 0.5;
  const y = base + size.height;
  const margin = 2.26;
  const left = u - radius - margin;
  const right = u + radius + margin;
  const inner = wall.p(u, 0, -depth);
  const xz = wall.p(u, 0);
  const sign = golden ? color.gold : color.blue;
  archedOpening(
    out,
    wall,
    u,
    left,
    right,
    base,
    base + size.height * 0.465,
    base + size.height * 0.84,
    y,
    radius,
    depth,
    lod,
    golden,
  );
  const p = (t, y, d = 0) => wall.p(t, y, d);
  face(
    out,
    'roof',
    [p(left, y), p(right, y), p(right, y, -depth), p(left, y, -depth)],
    up,
    color.roof,
  );
  for (const [x, direction] of [
    [left, -1],
    [right, 1],
  ]) {
    face(
      out,
      'brick',
      [p(x, base), p(x, y), p(x, y, -depth), p(x, base, -depth)],
      [(xz[2] - inner[2]) * direction, 0, (inner[0] - xz[0]) * direction],
      color.brick,
    );
    panel(out, 'tile', wall, x - 0.18, x + 0.18, base + 0.13, y, 0.13, color.indigo);
  }
  panel(out, 'tile', wall, left + 0.31, u - radius - 0.22, base + 1.23, y - 1.41, 0.043, sign);
  panel(out, 'tile', wall, u + radius + 0.22, right - 0.31, base + 1.23, y - 1.41, 0.043, sign);
  wallBand(out, wall, left, right, y - 1.06, 0.62, 0.085, lod);
  wallBand(out, wall, left, right, y - 0.23, 0.27, 0.092, Math.min(lod, 1));
  if (lod > 1) {
    const cells = golden ? 12 : 8;
    for (let i = 0; i < cells; i++) {
      const s = (i + 0.5) / cells;
      const a = mix(-radius, radius, s);
      const archHeight = base + size.height * (0.47 + 0.35 * Math.pow(Math.sin(Math.PI * s), 0.85));
      const m = wall.p(u + a, archHeight - 0.55, -depth * 0.38);
      const l = wall.p(u + a - (size.span / cells) * 0.42, archHeight + 0.14, -depth * 0.22);
      const r = wall.p(u + a + (size.span / cells) * 0.42, archHeight + 0.14, -depth * 0.22);
      face(out, golden ? 'gold' : 'tile', [l, r, m], wall.normal, i % 2 ? sign : color.pale);
    }
  }
}

function walls(out, d, grade, lod) {
  const base = d.floorY;
  const c = d.court;
  const definitions = [
    {
      outline: d.core,
      range: [c[0], c[3]],
      axis: 1,
      match: 31.5,
      tolerance: 0.09,
      port: d.southIwan,
      u: d.southIwan.x - c[0][0],
      gold: true,
    },
    {
      outline: d.clock,
      range: [c[3], c[5]],
      axis: 0,
      match: 64.85,
      tolerance: 0.11,
      port: d.westIwan,
      u: d.westIwan.z - c[3][1],
      gold: false,
    },
    {
      outline: d.northRange,
      range: [c[5], c[9]],
      axis: 1,
      match: 93.86,
      tolerance: 0.48,
      port: d.northGate,
      u: c[5][0] - d.northGate.x,
      gold: false,
    },
    {
      outline: d.naqqara,
      range: [c[9], c[0]],
      axis: 0,
      match: -38.5,
      tolerance: 0.62,
      port: d.eastIwan,
      u: c[9][1] - d.eastIwan.z,
      gold: false,
    },
  ];
  for (const { outline, range, axis, match, tolerance, port, u, gold } of definitions) {
    const cladding = { wall: 'brick', color: color.brick, roof: 'roof', roofColor: color.roof };
    shell(
      out,
      outline,
      (p) => Math.min(grade(p), base - 0.3) - 0.2,
      base + 9.82,
      cladding,
      (_, a, b) => Math.abs(a[axis] - match) > tolerance || Math.abs(b[axis] - match) > tolerance,
    );
    const wall = edge(...range, -1);
    const opening = port.span * 0.5 + 2.26;
    arcade(out, wall, 0, u - opening, base, lod);
    arcade(out, wall, u + opening, wall.length, base, lod);
    iwan(out, wall, u, base, port, gold ? 6.5 : 5.7, lod, gold);
  }
  cap(out, 'stone', c, base - 0.025, color.pale);
}

function roundLoft(out, slot, position, profile, sides, tint, capEnds = true) {
  loft(
    out,
    slot,
    profile.map(([y, radius]) => radialRing(y, radius, radius, sides, position)),
    tint,
    { cap: capEnds },
  );
}

function dome(out, d, lod) {
  const y = d.floorY;
  const crown = y + d.goldDomeHeight;
  const bottom = crown - d.gildedZoneHeight;
  const radius = d.domeCircumference / (2 * Math.PI);
  const sides = [9, 18, 32, 44][lod];
  const enclosure = rect(-8.45, 8.68, 8.56, -9.08);
  shell(out, enclosure, () => y + 8.82, bottom + 0.05, {
    wall: 'stone',
    color: color.stone,
    roof: 'roof',
    roofColor: color.roof,
  });
  roundLoft(
    out,
    'tile',
    [0, 0],
    [
      [bottom - 0.13, radius * 0.963],
      [bottom + 0.76, radius * 0.957],
    ],
    sides,
    color.indigo,
  );
  const records = [
    [0, 0.935],
    [0.08, 0.974],
    [0.24, 0.988],
    [0.38, 1],
    [0.47, 0.995],
    [0.55, 0.962],
    [0.64, 0.88],
    [0.73, 0.755],
    [0.82, 0.6],
    [0.9, 0.41],
    [0.964, 0.22],
    [1, 0.075],
  ];
  const select =
    lod > 1
      ? records
      : records.filter((_, i) => i % (lod ? 2 : 3) === 0 || i === records.length - 1);
  const rings = select.map(([rise, r]) => [mix(bottom + 0.74, crown, rise), radius * r]);
  roundLoft(out, 'gold', [0, 0], rings, sides, color.gold);
  if (lod > 1)
    for (const [i, [a, b]] of pairs(rings).entries()) {
      const [height, width] = [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5) + 0.018];
      roundLoft(
        out,
        'gold',
        [0, 0],
        [
          [height - 0.014, width],
          [height + 0.016, width],
        ],
        sides,
        i % 2 ? color.goldDark : color.goldLustre,
        false,
      );
    }
  roundLoft(
    out,
    'gold',
    [0, 0],
    [
      [crown - 0.03, 0.5],
      [crown + 0.28, 0.35],
      [crown + 0.67, 0.2],
      [crown + 1.13, 0.046],
    ],
    [5, 8, 12, 16][lod],
    color.goldLustre,
  );
}

function tower(out, y, { position, height }, lod) {
  const h = y + height;
  const sides = [5, 10, 18, 24][lod];
  if (lod === 0) {
    const silhouette = [
      [y + 9.7, 1.87],
      [h - 8.3, 1.03],
      [h - 6.22, 1.76],
      [h - 5.77, 0.75],
      [h - 2.64, 0.68],
      [h - 2.24, 1.05],
      [h, 0.08],
    ];
    roundLoft(out, 'gold', position, silhouette, sides, color.gold);
    return;
  }

  roundLoft(
    out,
    'brick',
    position,
    [
      [y + 9.7, 2.04],
      [y + 13.8, 1.74],
      [y + 15.46, 1.39],
    ],
    sides,
    color.stone,
  );
  roundLoft(
    out,
    'gold',
    position,
    [
      [y + 15.45, 1.4],
      [h - 8.4, 1.03],
      [h - 7.81, 1.28],
      [h - 7.27, 1.66],
      [h - 6.92, 1.75],
      [h - 6.31, 1.76],
    ],
    sides,
    color.gold,
  );
  roundLoft(
    out,
    'gold',
    position,
    [
      [h - 6.32, 1.73],
      [h - 5.87, 1.73],
      [h - 5.81, 0.74],
      [h - 2.66, 0.69],
      [h - 2.54, 1.08],
      [h - 2.18, 1.09],
      [h - 1.82, 0.91],
      [h - 0.83, 0.48],
      [h, 0.08],
    ],
    sides,
    color.goldLustre,
  );
  if (lod)
    for (const h0 of [y + 17.35, h - 12.5, h - 7.15])
      roundLoft(
        out,
        'tile',
        position,
        [
          [h0, h0 < h - 9 ? 1.31 : 1.69],
          [h0 + 0.21, h0 < h - 9 ? 1.29 : 1.72],
        ],
        sides,
        color.indigo,
        false,
      );
  if (lod > 1) {
    const posts = radialRing(h - 5.85, 0.89, 0.89, 8, position);
    for (const p of posts) beam(out, 'gold', p, [p[0], h - 2.6, p[2]], 0.13, 0.13, color.goldDark);
  }
}

function roofPavilion(out, x, z, y, lod) {
  const size = 4.3;
  const footprint = rect(x - size, z + 3.08, x + size, z - 3.08);
  cap(out, 'stone', footprint, y + 0.3, color.stone);
  const posts = lod ? 8 : 4;
  for (const [postX, , postZ] of radialRing(y + 0.23, 3.5, 2.7, posts, [x, z])) {
    if (!lod)
      block(out, 'stone', postX - 0.17, y + 0.23, postZ - 0.17, 0.34, 3.42, 0.34, color.stone);
    else
      roundLoft(
        out,
        'stone',
        [postX, postZ],
        [
          [y + 0.23, 0.22],
          [y + 3.49, 0.18],
          [y + 3.65, 0.27],
        ],
        6,
        color.stone,
      );
  }
  roundLoft(
    out,
    'gold',
    [x, z],
    [
      [y + 3.45, 3.94],
      [y + 3.96, 3.91],
      [y + 4.89, 2.42],
      [y + 5.53, 1.46],
      [y + 6.04, 0.22],
    ],
    [8, 12, 20, 28][lod],
    color.goldLustre,
  );
  roundLoft(
    out,
    'stone',
    [x, z],
    [
      [y + 0.24, 1.72],
      [y + 1.17, 1.56],
      [y + 1.43, 1.74],
    ],
    [8, 12, 16, 20][lod],
    color.stone,
  );
}

function gateRoofs(out, y, lod) {
  const x = -44.2,
    z = 65.0;
  for (const [i, [half, base, height]] of [
    [3.8, 17.8, 3.3],
    [3.0, 21.02, 2.6],
  ].entries()) {
    const outline = rect(x - half, z + half, x + half, z - half);
    cap(out, 'roof', outline, y + base + height, color.roof);
    const posts = lod ? 8 : 4;
    for (const p of radialRing(y + base, half * 0.93, half * 0.93, posts, [x, z], Math.PI / 4))
      beam(out, 'wood', p, [p[0], y + base + height, p[2]], lod ? 0.25 : 0.4, 0.28, color.timber);
    roundLoft(
      out,
      'tile',
      [x, z],
      [
        [y + base + height, half * 1.36],
        [y + base + height + 0.73, half * 0.76],
      ],
      lod ? 12 : 8,
      i ? color.indigo : color.blue,
    );
  }
  block(out, 'stone', 66.2, y + 17.57, 62.55, 4.8, 3.8, 5.15, color.stone);
  roundLoft(
    out,
    'tile',
    [68.6, 65.13],
    [
      [y + 21.15, 3.22],
      [y + 22.02, 2.67],
      [y + 24.41, 0.11],
    ],
    lod ? 12 : 8,
    color.indigo,
  );
  if (lod) {
    const faceDisk = radialRing(0, 1.26, 1.26, lod === 3 ? 24 : 12);
    face(
      out,
      'tile',
      faceDisk.map(([u, , v]) => [66.16, y + 19.45 + v, 65.13 + u]),
      [-1, 0, 0],
      color.pale,
    );
    beam(
      out,
      'wood',
      [66.135, y + 19.45, 65.13],
      [66.135, y + 20.22, 65.13],
      0.12,
      0.12,
      color.timber,
    );
    beam(out, 'wood', [66.135, y + 19.45, 65.13], [66.135, y + 19.1, 65.7], 0.1, 0.1, color.timber);
  }
}

function build(out, lod, d, grade) {
  walls(out, d, grade, lod);
  dome(out, d, lod);
  for (const shaft of d.minarets) tower(out, d.floorY, shaft, lod);
  roofPavilion(out, 12.0, 62.9, d.floorY, lod);
  gateRoofs(out, d.floorY, lod);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The historic Imam Reza Shrine in Mashhad, with the golden tomb dome, Old Court, paired gold minarets, four tiled iwans, clock and Naqqara Khana.',
    camera: [131, 94, 167],
    lookAt: [12, 13, 43],
    yaw: 0.67,
    sun: [-270, 490, 540],
    views: [
      { name: 'golden-dome-and-iwan', position: [18, 13, 81], lookAt: [1, 18, 18] },
      { name: 'old-court-and-opposing-minarets', position: [97, 78, 155], lookAt: [11, 14.6, 51] },
      { name: 'clock-iwan-and-gilded-fountain', position: [-24, 8, 58], lookAt: [35, 10, 62] },
      { name: 'naqqara-khana-and-tiled-arcades', position: [43, 13, 65], lookAt: [-30, 12, 65] },
    ],
  },
  build,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  category: 'religious',
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: frame.geometry.polygons,
    basis: 'Combined historic sanctuary outline and independently mapped sides of the Old Court.',
  },
};
