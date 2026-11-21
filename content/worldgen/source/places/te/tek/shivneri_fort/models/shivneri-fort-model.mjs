import {
  arch,
  areaSign,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_basalt_raw'),
  dressed: surface('trim', 'stone_basalt'),
  foundation: surface('foundation', 'stone_basalt_raw'),
  plaster: surface('wall', 'plaster_lime'),
  tile: surface('roof', 'tile_ceramic'),
  shadow: surface('door', 'wood_plain'),
};
const C = palette({
  basalt: '736c5f',
  dry: '86786a',
  deep: '5f5b50',
  edge: '938875',
  weather: '978b74',
  plaster: 'cebb96',
  roof: '98745d',
  dark: '44413a',
  gray: 'a2967f',
});
function position([x, z], angle) {
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  return {
    point: (s, t) => [x - si * s + co * t, z + co * s + si * t],
    u: [-si, 0, co],
    v: [co, 0, si],
  };
}
const place = (f, x0, z0, x1, z1) => rect(x0, z0, x1, z1).map(([x, z]) => f.point(x, z));
const xyz = ([x, z], y) => [x, y, z];
function solid(out, polygon, bottom, top, side, color, roof = side, roofColor = color) {
  shell(out, polygon, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: side,
    color,
    roof,
    roofColor,
  });
}
function localWall(f, z, sign) {
  return { normal: f.v.map((c) => c * sign), p: (x, y, d = 0) => xyz(f.point(x, z + sign * d), y) };
}

function portal(out, f, args, lod) {
  const { level, spring, rise, opening, depth, height, span, color, grade } = args;
  const sill = level + spring;
  const half = opening / 2;
  const side = span / 2;
  const front = -depth / 2;
  const back = depth / 2;
  const footing = grade ? (p) => Math.min(level - 0.62, grade(p) - 0.55) : level - 0.62;
  solid(out, place(f, -side, front, -half, back), footing, sill, 'stone', color);
  solid(out, place(f, half, front, side, back), footing, sill, 'stone', color);
  const apex = level + height;
  const segments = [3, 9, 13, 17][lod];
  const topCurve = (x, r) => sill + rise * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));
  const section = (x) => [x, Math.abs(x) < half ? topCurve(x, half) : sill];
  const points = [
    [-side, sill],
    ...Array.from({ length: segments + 1 }, (_, i) => section(mix(-half, half, i / segments))),
    [side, sill],
  ];
  for (const [[x0, y0], [x1, y1]] of pairs(points)) {
    for (const [z, sign] of [
      [front, -1],
      [back, 1],
    ]) {
      const w = localWall(f, z, sign);
      face(out, 'stone', [w.p(x0, y0), w.p(x1, y1), w.p(x1, apex), w.p(x0, apex)], w.normal, color);
      if (lod >= 1 && x0 >= -half - 0.0001 && x1 <= half + 0.0001) {
        const band = lod === 3 ? 0.31 : 0.24;
        const shade = lod >= 2 && Math.abs(x0) > half * 0.6 ? C.weather : C.edge;
        face(
          out,
          'dressed',
          [
            w.p(x0, y0, 0.045),
            w.p(x1, y1, 0.045),
            w.p(x1, y1 + band, 0.045),
            w.p(x0, y0 + band, 0.045),
          ],
          w.normal,
          shade,
        );
      }
    }
    if (lod > 0 && x0 >= -half - 0.0001 && x1 <= half + 0.0001) {
      face(
        out,
        'dressed',
        [
          xyz(f.point(x0, front), y0),
          xyz(f.point(x1, front), y1),
          xyz(f.point(x1, back), y1),
          xyz(f.point(x0, back), y0),
        ],
        [0, -1, 0],
        C.deep,
      );
    }
  }
  for (const [x, sign] of [
    [-side, -1],
    [side, 1],
  ])
    face(
      out,
      'stone',
      [
        xyz(f.point(x, front), sill),
        xyz(f.point(x, back), sill),
        xyz(f.point(x, back), apex),
        xyz(f.point(x, front), apex),
      ],
      f.u.map((c) => c * sign),
      color,
    );
  cap(out, 'dressed', place(f, -side, front, side, back), apex, C.edge);
  if (lod > 0) {
    solid(
      out,
      place(f, -side - 0.15, front - 0.14, side + 0.15, back + 0.14),
      apex - 0.06,
      apex + 0.29,
      'dressed',
      C.edge,
    );
    if (lod >= 2)
      for (const [x, sign] of [
        [-half, -1],
        [half, 1],
      ])
        solid(
          out,
          place(
            f,
            x + Math.min(0, sign * 0.24),
            front - 0.09,
            x + Math.max(0, sign * 0.24),
            front + 0.11,
          ),
          level + 0.03,
          sill,
          'dressed',
          C.weather,
        );
  }
}

function ribbon(out, a, b, grade, height, thickness, color) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.08) return;
  const norm = [(b[1] - a[1]) / length, (a[0] - b[0]) / length];
  const lift = (p, side) => [
    p[0] + (norm[0] * side * thickness) / 2,
    p[1] + (norm[1] * side * thickness) / 2,
  ];
  const poly = [lift(a, -1), lift(b, -1), lift(b, 1), lift(a, 1)];
  const lo = poly.map((p) => xyz(p, grade(p) - 0.72));
  const ha = Math.max(grade(poly[0]), grade(poly[3])) + height;
  const hb = Math.max(grade(poly[1]), grade(poly[2])) + height;
  const hi = poly.map((p, i) => xyz(p, i === 0 || i === 3 ? ha : hb));
  const sign = areaSign(poly);
  for (let i = 0; i < poly.length; i++) {
    const next = (i + 1) % poly.length;
    const outward = edge(poly[i], poly[next], sign).normal;
    face(out, 'stone', [lo[i], lo[next], hi[next], hi[i]], outward, color);
  }
  face(out, 'dressed', hi, [0, 1, 0], C.edge);
}

function approachGate(out, g, grade, lod, index) {
  const f = position(g.point, g.angle);
  const level = Math.max(
    grade(g.point),
    grade(f.point(0, -g.depth * 0.5)),
    grade(f.point(0, g.depth * 0.5)),
  );
  const width = g.opening + (index === 0 ? 4.8 : 2.8);
  portal(
    out,
    f,
    {
      level,
      spring: g.spring,
      rise: 0.35 * g.opening,
      opening: g.opening,
      height: g.height,
      depth: g.depth,
      span: width,
      color: index < 4 ? C.basalt : C.dry,
      grade,
    },
    lod,
  );
  const along = index === 0 || index === 3 ? 16 : 10;
  for (const side of [-1, 1]) {
    const flank = [
      [width / 2 - 0.2, 0],
      [width / 2 + along * 0.44, 1.7],
      [width / 2 + along, 3.2],
    ].map(([x, z]) => f.point(side * x, side * z));
    const flanks = lod === 0 ? [[flank[0], flank[2]]] : pairs(flank);
    for (const [i, [a, b]] of flanks.entries())
      ribbon(
        out,
        a,
        b,
        grade,
        g.height * (0.59 - i * 0.12),
        index === 0 ? 2.1 : 1.45,
        i === 0 ? C.basalt : C.dry,
      );
  }
  if (lod >= 2) {
    for (const sign of [-1, 1]) {
      const x = sign * (g.opening / 2 + 0.8);
      const w = localWall(f, -g.depth / 2, -1);
      face(
        out,
        'dressed',
        [
          w.p(x - 0.36, level + g.spring + 0.18, 0.04),
          w.p(x + 0.36, level + g.spring + 0.18, 0.04),
          w.p(x + 0.36, level + g.spring + 0.63, 0.04),
          w.p(x - 0.36, level + g.spring + 0.63, 0.04),
        ],
        w.normal,
        C.gray,
      );
    }
  }
  if (lod === 3) {
    const front = [
      [-width / 2 + 0.34, -g.depth / 2 - 0.1],
      [width / 2 - 0.34, -g.depth / 2 - 0.1],
    ];
    for (const [x, z] of front) {
      const base = level + g.height + 0.26;
      solid(out, place(f, x - 0.28, z, x + 0.28, z + 0.56), base, base + 0.31, 'dressed', C.gray);
    }
  }
}

function shrine(out, points, grade, lod, isMemorial) {
  if (lod > 0)
    for (const [p, q] of pairs(closed(points))) ribbon(out, p, q, grade, 0.28, 0.31, C.dry);
  const middle = points.reduce(
    (q, p) => [q[0] + p[0] / points.length, q[1] + p[1] / points.length],
    [0, 0],
  );
  const core = points.map(([x, z]) => [mix(middle[0], x, 0.7), mix(middle[1], z, 0.7)]);
  const floor = Math.max(...core.map(grade), grade(middle)) + 0.12;
  const eaves = floor + (isMemorial ? 4.8 : 3.2);
  const foot = (p) => grade(p) - 0.52;
  if (lod > 0) solid(out, core, foot, floor, 'foundation', C.deep);
  solid(
    out,
    core,
    lod > 0 ? floor : foot,
    eaves - 0.04,
    isMemorial ? 'plaster' : 'stone',
    isMemorial ? C.plaster : C.dry,
  );
  const raised = xyz(middle, eaves + (isMemorial ? 3.15 : 1.66));
  for (const [i, [a, b]] of pairs(closed(points)).entries()) {
    face(
      out,
      'tile',
      [xyz(a, eaves), xyz(b, eaves), raised],
      [0, 1, 0],
      i % 2 === 0 ? C.roof : C.deep,
    );
    if (lod > 0 || i % 2 === 0) {
      const y0 = grade(a) - 0.12;
      const f = position(a, 0);
      solid(out, place(f, -0.145, -0.145, 0.145, 0.145), y0, eaves, 'dressed', C.weather);
    }
  }
}

function amberkhana(out, p, grade, lod) {
  const f = position(p, 0.57);
  const foundation = place(f, -12.9, -5.1, 12.9, 5.1);
  const level = Math.max(grade(p), ...foundation.map(grade));
  solid(
    out,
    foundation,
    (q) => Math.min(grade(q) - 0.55, level - 0.35),
    level + 0.2,
    'foundation',
    C.deep,
  );
  for (const row of lod === 0 ? [-2.6] : [-2.6, 2.58]) {
    for (const x of [-8.4, 0, 8.4]) {
      const wing = position(f.point(x, row), 0.57);
      portal(
        out,
        wing,
        {
          level: level + 0.25,
          spring: 2.7,
          rise: 1.55,
          opening: 4.55,
          depth: 2.7,
          height: 5.06,
          span: 8.24,
          color: C.basalt,
        },
        lod,
      );
    }
  }
  for (const side of [-1, 1]) {
    const a = f.point(side * 12.9, -5.17);
    const b = f.point(side * 12.9, 5.17);
    ribbon(out, a, b, grade, 4.55, 1.3, C.deep);
  }
}

function birthplace(out, p, grade, lod) {
  const f = position(p, -1.4);
  const body = place(f, -5.2, -4.8, 5.2, 4.8);
  const y = Math.max(grade(p), ...body.map(grade)) + 0.24;
  solid(
    out,
    body,
    (q) => Math.min(grade(q) - 0.47, y - 0.32),
    y + 6.45,
    'stone',
    C.basalt,
    'dressed',
    C.deep,
  );
  const roof = place(f, -5.28, -4.86, 5.28, 4.91);
  solid(out, roof, y + 6.33, y + 6.58, 'dressed', C.weather);
  if (lod > 0)
    for (const [a, b] of pairs(closed(roof))) ribbon(out, a, b, () => y + 6.49, 0.63, 0.32, C.dry);
  const front = localWall(f, 4.82, 1);
  arch(
    out,
    front,
    0,
    y + 0.02,
    y + 2.15,
    0.78,
    0.64,
    0.041,
    lod > 1 ? 2 : 0,
    { inner: C.dark, trim: C.weather, width: 0.18 },
    { inner: 'shadow', trim: 'dressed' },
  );
  const projection = place(f, -2.72, 4.76, 2.72, 5.57);
  solid(out, projection, y + 3.15, y + 5.98, 'dressed', C.dry, 'dressed', C.edge);
  const w = localWall(f, 5.58, 1);
  for (const x of [-1.65, 0, 1.65])
    arch(
      out,
      w,
      x,
      y + 3.43,
      y + 4.93,
      0.45,
      0.53,
      0.047,
      lod > 1 ? 2 : 0,
      { inner: C.dark, trim: C.weather, width: 0.14 },
      { inner: 'shadow', trim: 'dressed' },
    );
  if (lod > 0) {
    solid(out, place(f, -2.96, 4.7, 2.96, 5.82), y + 5.93, y + 6.19, 'dressed', C.edge);
    for (const x of [-3.8, 3.8])
      arch(
        out,
        front,
        x,
        y + 3.57,
        y + 4.81,
        0.24,
        0.38,
        0.04,
        0,
        { inner: C.dark, trim: C.gray, width: 0.12 },
        { inner: 'shadow', trim: 'dressed' },
      );
    if (lod > 1)
      for (const x of [-2.2, -0.73, 0.73, 2.2])
        solid(
          out,
          place(f, x - 0.16, 4.72, x + 0.16, 5.37),
          y + 2.81,
          y + 3.19,
          'dressed',
          C.weather,
        );
  }
}

function approachPaving(out, path, gates, grade) {
  for (const [a, b] of pairs(path)) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (
      length < 0.06 ||
      !gates.some(({ point }) => Math.hypot(point[0] - a[0], point[1] - a[1]) < 57)
    )
      continue;
    const sides = [(b[1] - a[1]) / length, (a[0] - b[0]) / length];
    const count = Math.ceil(length / 3.7);
    const cross = (fraction, side) => {
      const p = a.map((v, i) => mix(v, b[i], fraction) + sides[i] * side);
      return xyz(p, grade(p) + 0.14);
    };
    for (let i = 0; i < count; i++) {
      const from = i / count;
      const to = (i + 1) / count;
      const p = cross(from, -1);
      const q = cross(to, -1);
      const r = cross(to, 1);
      const s = cross(from, 1);
      face(out, 'dressed', [p, q, r], [0, 1, 0], C.weather);
      face(out, 'dressed', [p, r, s], [0, 1, 0], C.weather);
    }
  }
}

function draw(out, lod, { gates, stops, roofControls, approachPath }, grade) {
  for (const [i, g] of gates.entries()) approachGate(out, g, grade, lod, i);
  if (lod > 0) approachPaving(out, approachPath, gates, grade);
  shrine(out, roofControls[0], grade, lod, true);
  shrine(out, roofControls[1], grade, lod, false);
  amberkhana(out, stops.Amberkhana, grade, lod);
  birthplace(out, stops['Shiv Janmasthan'], grade, lod);
  const mosque = stops['Kamani Mosque'];
  portal(
    out,
    position(mosque, 0.45),
    {
      level: grade(mosque),
      spring: 3.75,
      rise: 2.24,
      opening: 7.2,
      depth: 1.14,
      height: 6.4,
      span: 10.5,
      color: C.deep,
      grade,
    },
    lod,
  );
  const tank = position(stops['Badami Tank'], 0.6);
  const rim = [
    [-13, -8],
    [-8, -12],
    [6, -12],
    [13, -5],
    [14, 5],
    [8, 10],
    [-2, 13],
    [-12, 7],
  ].map(([x, z]) => tank.point(x, z));
  for (const [a, b] of pairs(closed(rim))) ribbon(out, a, b, grade, 0.45, 0.96, C.dry);
  const idgah = position(stops.Idgah, 0);
  for (const [a, b] of pairs([
    idgah.point(-4, -9),
    idgah.point(3, -9),
    idgah.point(3, 9),
    idgah.point(-3, 9),
  ]))
    ribbon(out, a, b, grade, 2.1, 0.8, C.deep);
  const platform = position(stops['Koli Chauthara'], 0);
  const platformY = grade(stops['Koli Chauthara']);
  solid(
    out,
    place(platform, -3.9, -4.8, 3.9, 4.8),
    (p) => Math.min(grade(p) - 0.34, platformY - 0.62),
    platformY + 1.12,
    'stone',
    C.basalt,
    'dressed',
    C.weather,
  );
  const lookout = position(stops.Kadelot, -0.88);
  for (const [a, b] of pairs([
    lookout.point(-4, -7),
    lookout.point(5, -5),
    lookout.point(6, 1),
    lookout.point(3, 6),
  ]))
    ribbon(out, a, b, grade, 2.2, 1.18, C.deep);
}

const fort = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [875, 525, 750],
    lookAt: [0, 60, -18],
    yaw: 0.58,
    sun: [450, 680, 370],
    brief:
      'The surviving basalt fortress at Shivneri on its original triangular hill, with the seven ascending gates, shrine, old granary and birthplace structures.',
    views: [
      {
        name: 'seven-gates-on-southwestern-ascent',
        position: [-265, 146, 650],
        lookAt: [-234, 32, 438],
      },
      { name: 'mahadarwaza-basalt-portal', position: [-75, 12, 482], lookAt: [-97, 6, 467] },
      { name: 'amberkhana-vaults', position: [-179, 110, 377], lookAt: [-206, 98, 341] },
      { name: 'birthplace-and-badami-rim', position: [306, 114, -343], lookAt: [271, 97, -299] },
      { name: 'northern-end-and-summit', position: [520, 270, -690], lookAt: [256, 112, -286] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = fort;
export const model = {
  ...fort.model,
  category: 'fortification',
  sourceLicense:
    'Original geometry from mapped public heritage coordinates, open footprint and terrain data, written architectural history and a confirmed public-domain Qualla landscape photograph.',
};
