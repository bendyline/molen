import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  planarMid,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  sandstone: surface('wall', 'stone_sandstone'),
  trim: surface('trim', 'stone_sandstone_raw'),
  marble: surface('wall', 'stone_marble'),
  plinth: surface('foundation', 'stone_ashlar'),
  wood: surface('door', 'wood_plain'),
  metal: surface('trim', 'metal_bronze_cast', 0.73, 0.3),
};
const C = palette({
  red: 'a35d47',
  warm: 'b37456',
  belt: 'bf8765',
  rust: '884b3f',
  shadow: '574139',
  stone: 'b6a187',
  parchment: 'e3dbc6',
  pale: 'eae3d1',
  roof: 'c0b59d',
  wood: '625047',
  metal: '99875d',
  white: 'e9e5d9',
});

function polygonAt(center, radius, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.5)) / n;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
  });
}

function ledge(out, w, left, right, y, width, lod, marble = false) {
  if (right - left < 0.2) return;
  const slot = marble ? 'marble' : 'trim';
  const color = marble ? C.pale : C.belt;
  if (lod > 1) trimBlock(out, slot, w, left, right, y, y + width, -0.17, width * 0.42, color);
  else panel(out, slot, w, left, right, y, y + width, 0.08, color);
}

function merlons(out, w, left, right, y, lod, scale = 1) {
  if (lod === 0 || right - left < 2 * scale) return;
  const spacing = [50, 19, 8.9, 4.1][lod] * scale;
  const n = Math.max(1, Math.floor((right - left) / spacing));
  const width = Math.min(2.24 * scale, ((right - left) / n) * 0.62);
  const height = 1.48 * scale;
  for (let i = 0; i < n; i++) {
    const u = mix(left, right, (i + 0.5) / n);
    const p = u - width / 2,
      q = u + width / 2;
    const profile = [
      [p, y],
      [q, y],
      [q, y + height * 0.6],
      [u, y + height],
      [p, y + height * 0.6],
    ];
    face(
      out,
      'trim',
      profile.map(([x, v]) => w.p(x, v, 0.1)),
      w.normal,
      C.warm,
    );
    if (lod === 3 && right - left < 85) {
      for (const [[a, b], [c, d]] of pairs(profile.slice(1))) {
        face(
          out,
          'trim',
          [w.p(a, b, 0.1), w.p(c, d, 0.1), w.p(c, d, -0.38), w.p(a, b, -0.38)],
          up,
          C.warm,
        );
      }
      face(
        out,
        'sandstone',
        profile.map(([x, v]) => w.p(x, v, -0.38)),
        w.normal.map((x) => -x),
        C.rust,
      );
    }
  }
}

function wallPolygon(out, lod, polygon, top, grade, light = false, opening) {
  const base = (p) => Math.min(grade(p) - 0.5, top - 2.2);
  const color = light ? C.warm : C.red;
  const sign = areaSign(polygon);
  shell(
    out,
    polygon,
    base,
    top,
    { wall: 'sandstone', color, roofColor: C.rust },
    (i) => i !== opening?.index,
  );
  for (const [i, [a, b]] of pairs(closed(polygon)).entries()) {
    const w = edge(a, b, sign);
    if (i === opening?.index) {
      const point = w.p(w.length / 2, 0);
      const threshold = grade([point[0], point[2]]) - 0.09;
      archSpan(
        out,
        w,
        0,
        w.length,
        threshold,
        top,
        w.length / 2,
        5.7,
        4.4,
        6.1,
        lod,
        'sandstone',
        color,
      );
    }
    if (lod > 0 && w.length > 2) {
      ledge(out, w, 0, w.length, top - 1.32, 0.5, lod);
      merlons(out, w, 0, w.length, top - 0.12, lod, light ? 0.8 : 1);
    }
  }
}

function rampartLine(out, lod, points, grade) {
  for (const [a, b] of pairs(points)) {
    const w = edge(a, b);
    const ya = grade(a),
      yb = grade(b),
      h = 17.5;
    const topA = Math.max(ya + h, 16.2),
      topB = Math.max(yb + h, 16.2);
    const rise = (u) => mix(topA, topB, u / w.length);
    for (const side of [-1, 1]) {
      const wide = side * 4.85,
        edgeOffset = side * 2.68;
      const n = w.normal.map((v) => v * side);
      face(
        out,
        'plinth',
        [
          w.p(0, ya - 0.45, wide),
          w.p(w.length, yb - 0.45, wide),
          w.p(w.length, yb + 2.8, edgeOffset),
          w.p(0, ya + 2.8, edgeOffset),
        ],
        n,
        C.stone,
      );
      face(
        out,
        'sandstone',
        [
          w.p(0, ya + 2.8, edgeOffset),
          w.p(w.length, yb + 2.8, edgeOffset),
          w.p(w.length, topB, edgeOffset),
          w.p(0, topA, edgeOffset),
        ],
        n,
        C.red,
      );
    }
    face(
      out,
      'sandstone',
      [
        w.p(0, topA, -2.68),
        w.p(w.length, topB, -2.68),
        w.p(w.length, topB, 2.68),
        w.p(0, topA, 2.68),
      ],
      up,
      C.rust,
    );
    if (lod === 0) continue;
    const parapet = {
      length: w.length,
      normal: w.normal,
      p: (u, y, d = 0) => w.p(u, rise(u) + y, 2.69 + d),
    };
    ledge(out, parapet, 0, w.length, -1.17, 0.48, lod);
    merlons(out, parapet, 0, w.length, -0.1, lod);
  }
}

function archProfile(width, spring, rise, segments, scalloped) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const x = width * (t - 0.5);
    const shape = Math.sin(Math.PI * t) * (1 - Math.abs(t - 0.5) * 0.39);
    const petals = scalloped && i !== 0 && i !== segments ? Math.sin(7 * Math.PI * t) * 0.13 : 0;
    return [x, spring + rise * shape + petals];
  });
}

function archSpan(
  out,
  w,
  left,
  right,
  base,
  top,
  u,
  width,
  spring,
  depth,
  lod,
  slot,
  color,
  scalloped = false,
) {
  const height = Math.max(0.95, (top - base) * 0.31);
  const sill = base + spring;
  const profile = archProfile(
    width,
    sill,
    Math.min(height, top - sill - 0.38),
    [4, 6, 10, 16][lod],
    scalloped,
  );
  for (const [first, last, trim] of [
    [left, u - width / 2, -1],
    [u + width / 2, right, 1],
  ]) {
    if (last - first <= 0.009) continue;
    panel(out, slot, w, first, last, base, top, 0, color);
    if (depth > 0) {
      const x = trim < 0 ? last : first;
      const p = w.p(x, top);
      const q = w.p(x, base);
      const direction = [w.normal[2] * trim, 0, -w.normal[0] * trim];
      face(out, slot, [q, p, w.p(x, top, -depth), w.p(x, base, -depth)], direction, color);
    }
  }
  for (const [[x, y], [a, b]] of pairs(profile)) {
    face(
      out,
      slot,
      [w.p(u + x, y), w.p(u + a, b), w.p(u + a, top), w.p(u + x, top)],
      w.normal,
      color,
    );
    if (depth > 0)
      face(
        out,
        slot,
        [w.p(u + x, y), w.p(u + a, b), w.p(u + a, b, -depth), w.p(u + x, y, -depth)],
        [0, -1, 0],
        color,
      );
    if (lod >= 2)
      face(
        out,
        'trim',
        [
          w.p(u + x, y, 0.07),
          w.p(u + a, b, 0.07),
          w.p(u + a, b + 0.28, 0.1),
          w.p(u + x, y + 0.28, 0.1),
        ],
        w.normal,
        C.belt,
      );
  }
}

function dome(out, center, y, radius, h, lod, marble) {
  const slot = marble ? 'marble' : 'trim';
  const color = marble ? C.pale : C.belt;
  const segments = [7, 8, 12, 18][lod];
  if (lod < 2) {
    ring(
      out,
      slot,
      center,
      [
        [y, radius],
        [y + h * 0.53, radius * 0.68],
        [y + h, 0.07],
      ],
      6,
      color,
    );
    return;
  }
  ring(
    out,
    slot,
    center,
    [
      [y - 0.14, radius * 0.82],
      [y, radius],
      [y + h * 0.21, radius * 0.93],
      [y + h * 0.56, radius * 0.67],
      [y + h * 0.82, radius * 0.31],
      [y + h, 0.07],
    ],
    segments,
    color,
  );
  if (lod >= 2)
    ring(
      out,
      'metal',
      center,
      [
        [y + h - 0.1, 0.13],
        [y + h + h * 0.19, 0.061],
      ],
      6,
      C.metal,
    );
}

function chhatri(out, c, y, radius, lod, marble = false) {
  const slot = marble ? 'marble' : 'sandstone';
  const color = marble ? C.parchment : C.warm;
  const poles = polygonAt(c, radius * 0.7, lod > 2 ? 8 : lod === 2 ? 6 : 4);
  const top = y + radius * 0.88;
  for (const [x, z] of poles) {
    const w = radius * 0.14;
    block(out, slot, x - w / 2, y, z - w / 2, w, top - y, w, color);
  }
  shell(out, polygonAt(c, radius, 8), () => top - 0.19, top + 0.22, { wall: slot, color });
  dome(out, c, top + 0.22, radius * 0.86, radius * 0.74, lod, marble);
}

function fortTower(out, c, y, radius, top, lod, topped = false, octagon = true) {
  const n = octagon || lod < 2 ? 8 : 14;
  const poly = polygonAt(c, radius, n);
  shell(out, poly, () => y, top, { wall: 'sandstone', color: C.red, roofColor: C.rust });
  if (lod > 0) {
    ring(
      out,
      'trim',
      c,
      [
        [top - 1.0, radius],
        [top - 0.65, radius * 1.039],
        [top - 0.34, radius * 1.039],
      ],
      n,
      C.belt,
    );
    const sign = areaSign(poly);
    for (const [a, b] of pairs(closed(poly))) {
      const w = edge(a, b, sign);
      merlons(out, w, 0, w.length, top - 0.1, lod, 0.8);
    }
  }
  if (topped) {
    if (lod < 2) {
      ring(
        out,
        'sandstone',
        c,
        [
          [top, radius * 0.31],
          [top + radius * 0.5, radius * 0.31],
        ],
        6,
        C.warm,
      );
      dome(out, c, top + radius * 0.5, radius * 0.61, radius * 0.48, lod, false);
    } else chhatri(out, c, top - 0.03, radius * 0.65, lod);
  }
}

function gateway(out, lod, polygon, grade, facesWest) {
  const c = planarMid(polygon),
    [x, z] = c;
  const lo = facesWest
    ? Math.min(...polygon.map((p) => p[0]))
    : Math.max(...polygon.map((p) => p[1]));
  const direction = facesWest ? 42 : 43;
  const w = facesWest
    ? edge([lo, z + direction / 2], [lo, z - direction / 2])
    : edge([x + direction / 2, lo], [x - direction / 2, lo]);
  const y = grade(c) + 0.26,
    top = y + (facesWest ? 23.5 : 21);
  const half = direction / 2;
  const profile = facesWest ? 11.4 : 11.9;
  const back = {
    normal: w.normal.map((v) => -v),
    p: (u, v, d = 0) => w.p(u, v, -profile - d),
  };
  archSpan(out, w, 0, direction, y - 0.6, top, half, 7.0, 8.0, profile, lod, 'sandstone', C.red);
  archSpan(out, back, 0, direction, y - 0.5, top, half, 6.95, 7.95, 0, lod, 'sandstone', C.red);
  cap(
    out,
    'sandstone',
    [w.p(0, 0), w.p(direction, 0), back.p(direction, 0), back.p(0, 0)].map(([a, , b]) => [a, b]),
    top,
    C.rust,
  );
  for (const from of [0, direction]) {
    const [a, , b] = w.p(from, 0, -3.9);
    fortTower(out, [a, b], y - 1.6, 5.1, top + 2.0, lod, true);
  }
  if (lod > 0) {
    for (const offset of [13.2, 16.2, top - y - 1.14])
      ledge(out, w, 0, direction, y + offset, 0.5, lod);
    merlons(out, w, 1, direction - 1, top - 0.1, lod, 0.8);
    for (const u of [5.6, 12.0, 17.4, 24.6, 30.7, 36.7]) {
      panel(out, 'wood', w, u - 0.73, u + 0.73, y + 17.4, y + 19.5, 0.034, C.shadow);
      if (lod > 1) ledge(out, w, u - 0.95, u + 0.95, y + 17.1, 0.24, lod);
    }
  }
  const count = facesWest ? 7 : 5;
  for (let i = 0; i < count; i++) {
    const [a, , b] = w.p(half + (i - (count - 1) / 2) * 2.45, 0, -4.2);
    if (lod < 2) dome(out, [a, b], top + 0.25, 0.84, 1.05, 0, true);
    else chhatri(out, [a, b], top + 0.1, 0.97, lod > 2 ? 2 : lod, true);
  }
}

function barbican(out, lod, polygon, west, grade, height, bridge) {
  const terrain = grade(planarMid(polygon));
  const y = terrain + height;
  const indices = west
    ? [0, 1, 4, 12, 17, 24, 29, 30, 31, 33]
    : [0, 2, 8, 14, 17, 21, 26, 28, 29, 31, 33];
  const outline = lod <= 1 ? indices.map((i) => polygon[i]) : polygon;
  const entryIndex = west ? (lod <= 1 ? 1 : 2) : lod <= 1 ? 6 : 27;
  wallPolygon(out, lod, outline, y, grade, true, { index: entryIndex });
  const entrance = edge(outline[entryIndex], outline[entryIndex + 1], areaSign(outline));
  const position = entrance.p(entrance.length / 2, 0);
  const base = grade([position[0], position[2]]) + 0.1;
  if (west) {
    const [length, width] = bridge;
    const [x, , z] = position;
    const walkway = rect(x - width / 2, z - length, x + width / 2, z + 0.15);
    shell(out, walkway, (p) => Math.min(grade(p) - 0.2, base - 0.21), base + 0.12, {
      wall: 'plinth',
      color: C.stone,
    });
    if (lod > 0)
      for (const u of [x - width / 2, x + width / 2 - 0.45])
        block(out, 'plinth', u, base + 0.1, z - length, 0.45, 0.62, length, C.stone);
  }
  const towers = west
    ? [
        [-205.5, -43.5],
        [-209, 22.8],
      ]
    : [
        [-46, 457.8],
        [17.6, 461.2],
      ];
  for (const c of towers) fortTower(out, c, grade(c) - 0.5, 4.9, y + 0.45, lod, true);
}

function palaceHall(
  out,
  lod,
  polygon,
  grade,
  { height, bays, stone = false, west = true, royal = false },
) {
  const center = planarMid(polygon);
  const y = Math.max(...polygon.map(grade), grade(center)) + 0.62;
  const capY = y + height;
  const slot = stone ? 'marble' : 'sandstone';
  const color = stone ? C.parchment : C.warm;
  const sign = areaSign(polygon);
  shell(out, polygon, (p) => grade(p) - 0.28, y, {
    wall: 'plinth',
    color: C.stone,
    roofColor: C.stone,
  });
  cap(out, slot, polygon, capY, stone ? C.roof : C.rust);
  const sides = pairs(closed(polygon)).map(([a, b]) => edge(a, b, sign));
  const front = sides.reduce(
    (best, side) =>
      side.normal[0] * (west ? -1 : 1) > 0.78 && side.length > (best?.length ?? 0) ? side : best,
    null,
  );
  for (const w of sides) {
    if (w !== front || lod === 0 || !bays) {
      panel(out, slot, w, 0, w.length, y, capY, 0, color);
      if (lod > 1 && w.length > 6 && royal)
        ledge(out, w, 0, w.length, capY - 1.21, 0.29, lod, stone);
      continue;
    }
    const bayWidth = w.length / bays;
    const archTop = capY - 1.95;
    if (lod === 1) {
      panel(out, slot, w, 0, w.length, y, capY, 0, color);
      for (let i = 0; i < bays; i++) {
        const u = (i + 0.5) * bayWidth,
          half = bayWidth * 0.32;
        panel(out, 'wood', w, u - half, u + half, y + 0.18, archTop - 0.62, 0.06, C.shadow);
      }
      ledge(out, w, 0, w.length, capY - 0.86, 0.52, lod, stone);
      continue;
    }

    for (let i = 0; i < bays; i++)
      archSpan(
        out,
        w,
        i * bayWidth,
        (i + 1) * bayWidth,
        y,
        archTop,
        (i + 0.5) * bayWidth,
        bayWidth * 0.71,
        (archTop - y) * 0.63,
        0.86,
        lod,
        slot,
        color,
        true,
      );
    panel(out, slot, w, 0, w.length, archTop, capY, 0, color);
    ledge(out, w, 0, w.length, capY - 0.86, 0.57, lod, stone);
    if (lod >= 2) {
      const back = {
        normal: w.normal,
        p: (u, y, d = 0) => w.p(u, y, -Math.min(6.0, w.length * 0.19) + d),
      };
      panel(out, 'wood', back, 0.46, w.length - 0.46, y + 0.12, archTop + 0.1, 0, C.shadow);
    }
  }
  if (royal) {
    const corners =
      polygon.length <= 5
        ? polygon.slice(0, 4)
        : [polygon[0], polygon[2], polygon[5], polygon.at(-1)];
    for (const p of corners) {
      const pos = [mix(p[0], center[0], 0.13), mix(p[1], center[1], 0.13)];
      if (lod < 2) dome(out, pos, capY + 0.15, 0.95, 1.5, 0, stone);
      else chhatri(out, pos, capY, 1.47, lod, stone);
    }
  }
}

function palaceBuildings(out, lod, parts, grade, bays) {
  for (const [role, config] of [
    ['naubat-khana', { height: 15.4, bays: 3 }],
    ['diwan-i-am', { height: 10.6, bays }],
    ['chhatta-chowk', { height: 4.7, bays: 0 }],
    ['rang-mahal', { height: 8.2, bays: 7, stone: true }],
    ['khas-mahal', { height: 8.7, bays: 3, stone: true }],
    ['diwan-i-khas', { height: 9.2, bays: 5, stone: true, royal: true }],
    ['hammam', { height: 6.3, bays: 3, stone: true }],
    ['mumtaz-mahal', { height: 7.9, bays: 5, stone: true }],
    ['zafar-mahal', { height: 6.4, bays: 3 }],
    ['shahi-burj', { height: 17.3, bays: 3 }],
  ])
    palaceHall(out, lod, parts[role], grade, config);
  const mosque = parts['moti-masjid'];
  const m = planarMid(mosque);
  palaceHall(out, lod, mosque, grade, { height: 7.05, bays: 3, stone: true });
  const y = Math.max(...mosque.map(grade), grade(m)) + 7.6;
  for (const x of [-5.8, 0, 5.8])
    dome(out, [m[0] + x, m[1] + 1.06], y, x === 0 ? 2.6 : 2.05, x === 0 ? 3.35 : 2.75, lod, true);
  if (lod > 0)
    for (const x of [-9.23, 9.12])
      ring(
        out,
        'marble',
        [m[0] + x, m[1] - 5.86],
        [
          [y - 4.4, 0.45],
          [y + 1.5, 0.34],
          [y + 1.56, 0.52],
          [y + 2.1, 0.08],
        ],
        8,
        C.pale,
      );
}

function build(out, lod, dimensions, grade) {
  const p = dimensions.parts;
  if (lod === 0) {
    const court = [
      [-162, -31],
      [-137, -336],
      [-48, -420],
      [1, -522],
      [83, -530],
      [268, -398],
      [349, -311],
      [332, -29],
      [309, 347],
      [223, 423],
      [11, 409],
    ];
    rampartLine(out, lod, court, grade);
    rampartLine(
      out,
      lod,
      [
        [-34, 407],
        [-104, 401],
        [-181, 315],
        [-163, 17],
      ],
      grade,
    );
    for (const [role, h] of [
      ['lahori-barbican', 10.5],
      ['delhi-gate-barbican', 10.1],
      ['lahori-gate', 24],
      ['delhi-gate', 22],
      ['naubat-khana', 16],
      ['diwan-i-am', 12],
      ['rang-mahal', 8],
      ['khas-mahal', 9],
      ['diwan-i-khas', 9.5],
      ['hammam', 7],
      ['moti-masjid', 7.5],
      ['mumtaz-mahal', 8],
      ['shahi-burj', 19],
      ['zafar-mahal', 7],
    ]) {
      const poly = p[role];
      const base = grade(planarMid(poly));
      const stone = [
        'rang-mahal',
        'khas-mahal',
        'diwan-i-khas',
        'hammam',
        'moti-masjid',
        'mumtaz-mahal',
      ].includes(role);
      shell(out, poly, grade, base + h, {
        wall: stone ? 'marble' : 'sandstone',
        color: stone ? C.parchment : C.red,
      });
      if (role === 'lahori-gate' || role === 'delhi-gate') {
        const c = planarMid(poly);
        for (const d of [-19, 19]) {
          const loc = role === 'lahori-gate' ? [c[0], c[1] + d] : [c[0] + d, c[1]];
          const cross = polygonAt(loc, 4.8, 6);
          shell(out, cross, () => base, base + h + 2.3, { wall: 'sandstone', color: C.red });
          dome(out, loc, base + h + 3.6, 2.6, 2.8, 0, false);
        }
      }
    }
    return;
  }
  for (const [role, top, keys] of [
    ['western-and-southern-main-rampart', 19.7, [0, 1, 2, 3, 4, 5, 6, 7]],
    [
      'northwestern-and-northern-main-rampart',
      20.3,
      [0, 1, 4, 5, 6, 9, 11, 16, 21, 22, 27, 32, 33, 34],
    ],
    ['southeastern-main-rampart', 18.4, [0, 1, 3, 6, 9, 10, 11, 12]],
  ]) {
    const outline = lod < 2 ? keys.map((index) => p[role][index]) : p[role];
    wallPolygon(out, lod, outline, top, grade);
  }
  const river = p['riverfront-main-rampart'];
  rampartLine(
    out,
    lod,
    lod < 2 ? [0, 4, 5, 10, 12, 17].map((i) => river[i]) : river.slice(0, 18),
    grade,
  );
  rampartLine(out, lod, p['east-river-gate-wall'], grade);
  for (const [x, z, r] of [
    [-181, 314, 8.4],
    [-103, 399, 8.8],
    [221, 423, 8.6],
    [306, 346, 9.2],
    [335, -32, 8.45],
    [348, -310, 9.3],
    [-134, -339, 7.9],
    [-52, -418, 8.2],
    [2, -517, 8.7],
  ]) {
    const y = grade([x, z]);
    fortTower(out, [x, z], y - 0.9, r, Math.max(20.6, y + 19.4), lod, false, false);
  }
  barbican(
    out,
    lod,
    p['lahori-barbican'],
    true,
    grade,
    dimensions.lahoriBarbicanHeightMeters,
    dimensions.lahoriApproachBridgeMeters,
  );
  barbican(
    out,
    lod,
    p['delhi-gate-barbican'],
    false,
    grade,
    10.1,
    dimensions.lahoriApproachBridgeMeters,
  );
  gateway(out, lod, p['lahori-gate'], grade, true);
  gateway(out, lod, p['delhi-gate'], grade, false);
  palaceBuildings(out, lod, p, grade, dimensions.audienceHallFrontArches);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Standing Red Fort in Delhi with its red sandstone battlements, paired main gates, large audience hall and marble waterfront pavilions inside an irregular octagon.',
    camera: [-860, 520, 740],
    lookAt: [45, 8, -29],
    sun: [-390, 560, -320],
    yaw: 0.8,
    views: [
      { name: 'lahori-gate-and-barbican', position: [-292, 28, -77], lookAt: [-167, 17, -7] },
      { name: 'delhi-gate', position: [68, 29, 520], lookAt: [-11, 18, 410] },
      { name: 'audience-hall-and-palaces', position: [128, 34, 63], lookAt: [266, 11, -54] },
      { name: 'riverfront-and-shahi-burj', position: [472, 94, -382], lookAt: [260, 12, -183] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'landmark';
