import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  concrete: surface('wall', 'concrete_plain'),
  base: surface('foundation', 'concrete_panel'),
  block: surface('wall', 'stone_ashlar'),
  siding: surface('wall', 'wood_weatherboard'),
  roof: surface('roof', 'metal_corrugated', 0.72, 0.13),
  iron: surface('door', 'metal_painted'),
  trim: surface('trim', 'metal_painted'),
  glass: surface('window', 'window_grid', 0.46, 0.1),
};
const C = palette({
  wall: 'd7cfb9',
  ochre: 'd3c6a7',
  foot: '9e9583',
  wallCap: 'beb8a5',
  concrete: 'd3cab7',
  siding: 'd5c6a7',
  recess: '57615a',
  door: '62675c',
  roof: 'a3a39b',
  cap: 'babbb2',
  iron: '626a64',
  oxide: '8b7164',
  cream: 'eee4cf',
  glass: '758987',
});
const pt = (a, b, t) => a.map((x, i) => mix(x, b[i], t));
function local(p) {
  const q = ([x, z]) => pt(pt(p[0], p[1], x), pt(p[3], p[2], x), z);
  return { q, box: (...args) => rect(...args).map(q) };
}
function roof(out, box, extent, eave, ridge, hip, color, endPitch = 0) {
  const poly = box(...extent);
  const [a, b, c, d] = poly;
  const t0 = pt(a, d, 0.5),
    t1 = pt(b, c, 0.5);
  const l = at(pt(t0, t1, hip), ridge - endPitch),
    r = at(pt(t1, t0, hip), ridge + endPitch);
  for (const points of [
    [at(a, eave), at(b, eave), r, l],
    [at(c, eave), at(d, eave), l, r],
  ])
    face(out, 'roof', points, up, color);
  for (const [j, k, p] of [
    [d, a, l],
    [b, c, r],
  ])
    face(
      out,
      hip === 0 ? 'concrete' : 'roof',
      [at(j, eave), at(k, eave), p],
      hip === 0 ? edge(j, k, areaSign(poly)).normal : up,
      hip === 0 ? C.wall : color,
    );
}
function vent(out, p, y, radius, lod, height = 1) {
  const n = [6, 6, 10, 14][lod],
    r = radius;
  ring(
    out,
    'trim',
    p,
    [
      [y - 0.08, r * 0.85],
      [y + 0.11, r],
      [y + 0.28 * height, r],
      [y + 0.31 * height, r * 1.58],
      [y + 0.38 * height, r * 1.52],
      [y + 0.58 * height, r * 0.36],
    ],
    n,
    C.oxide,
  );
  ring(
    out,
    'trim',
    p,
    [
      [y + 0.58 * height, r * 0.36],
      [y + 0.79 * height, r * 0.21],
      [y + 0.91 * height, 0.016],
    ],
    n,
    C.cap,
  );
}
function wall(out, p, floor, top, slot = 'concrete', tint = C.wall) {
  shell(out, p, typeof floor === 'function' ? floor : () => floor, top, {
    wall: slot,
    color: tint,
  });
}
function door(out, w, u, y, width, lod) {
  const a = w.length * u - width / 2,
    b = a + width;
  opening(out, w, a, b, y + 0.05, y + 2.07, 'trim', C.door, 'iron', C.wallCap, lod, 0.065);
  if (lod > 0) {
    panel(out, 'trim', w, a + 0.24, b - 0.24, y + 1.53, y + 1.65, 0.09, C.recess);
    panel(out, 'trim', w, a + 0.17, b - 0.12, y + 0.96, y + 1.065, 0.095, C.oxide);
  }
}
function steelBand(out, w, x, z, bottom, lod) {
  const a = w.length * x,
    b = w.length * z;
  panel(out, 'iron', w, a, b, bottom, bottom + 0.36, 0.06, C.recess);
  if (lod > 0)
    for (let i = 0; i < 4; i++)
      panel(
        out,
        'trim',
        w,
        a,
        b,
        bottom + 0.046 + i * 0.085,
        bottom + 0.083 + i * 0.085,
        0.083,
        C.iron,
      );
  if (lod > 1)
    for (let i = 1; i < 4; i++) {
      const u = mix(a, b, i / 4);
      trimBlock(
        out,
        'concrete',
        w,
        u - 0.065,
        u + 0.065,
        bottom - 0.015,
        bottom + 0.383,
        0.015,
        0.1,
        C.wall,
      );
    }
}
function bayWindows(out, w, count, y, lod) {
  for (let i = 0; i < count; i++) {
    const x = (w.length * (i + 0.5)) / count,
      hw = Math.min(0.5, w.length * 0.16);
    opening(out, w, x - hw, x + hw, y, y + 1.12, 'trim', C.glass, 'glass', C.cream, lod, 0.07);
    if (lod > 0) {
      panel(out, 'trim', w, x - hw, x + hw, y + 0.55, y + 0.585, 0.1, C.cream);
      if (lod > 1) panel(out, 'trim', w, x - 0.021, x + 0.021, y, y + 1.12, 0.108, C.cream);
    }
  }
}
function retaining(out, q, from, to, half, bottom, top, gate, lod, grade) {
  const a = q(from),
    b = q(to),
    w = edge(a, b);
  const doorWidth = gate === null ? 0 : 1.05,
    c = (gate ?? 0) * w.length;
  const sections =
    gate === null
      ? [[0, w.length]]
      : [
          [0, c - doorWidth / 2],
          [c + doorWidth / 2, w.length],
        ];
  const mass = (u, v, y0, y1, h) => trimBlock(out, 'concrete', w, u, v, y0, y1, -h, h, C.concrete);
  const footing = Math.min(
    bottom - 0.06,
    grade(a) - 0.22,
    grade(b) - 0.22,
    grade(pt(a, b, 0.5)) - 0.22,
  );
  for (const [low, high] of sections) {
    mass(low, high, footing, top, half);
    trimBlock(
      out,
      'concrete',
      w,
      low,
      high,
      top,
      top + 0.1,
      -half - 0.055,
      half + 0.055,
      C.wallCap,
    );
  }
  if (gate !== null) {
    mass(c - doorWidth / 2, c + doorWidth / 2, footing, bottom + 0.06, half);
    mass(c - doorWidth / 2, c + doorWidth / 2, bottom + 2.12, top, half);
    trimBlock(
      out,
      'concrete',
      w,
      c - doorWidth / 2,
      c + doorWidth / 2,
      top,
      top + 0.1,
      -half - 0.055,
      half + 0.055,
      C.wallCap,
    );
    trimBlock(
      out,
      'iron',
      w,
      c - doorWidth / 2 + 0.027,
      c + doorWidth / 2 - 0.027,
      bottom + 0.06,
      bottom + 2.095,
      -0.069,
      0.069,
      C.door,
    );
    if (lod > 1)
      for (const offset of [-0.077, 0.077]) {
        panel(out, 'trim', w, c - 0.18, c + 0.18, bottom + 1.48, bottom + 1.58, offset, C.recess);
        panel(out, 'trim', w, c - 0.39, c + 0.4, bottom + 1.0, bottom + 1.1, offset, C.oxide);
      }
  }
}

function gaol(out, polygon, wallHeight, coreFinials, additionFinials, grade, lod) {
  const { q, box } = local([polygon[2], polygon[1], polygon[0], polygon[3]]);
  const y = Math.max(...polygon.map(grade)) + 0.17;
  wall(
    out,
    box(0.017, 0.025, 0.985, 0.98),
    (p) => Math.min(grade(p) - 0.24, y - 0.22),
    y,
    'base',
    C.foot,
  );
  const cells = box(0.028, 0.038, 0.976, 0.518);
  wall(out, cells, y, y + 3.04);
  roof(out, box, [0, 0.0, 1, 0.559], y + 3.03, y + 4.61, 0.14, C.roof, 0.18);
  for (let i = 0; i < coreFinials; i++)
    vent(out, q([0.3 + i * 0.41, 0.28]), y + 4.6 + i * 0.13, 0.178, lod);
  const later = box(0.027, 0.525, 0.975, 0.96);
  wall(out, later, y, y + 2.93, 'concrete', C.ochre);
  roof(out, box, [0.002, 0.509, 0.998, 1], y + 2.93, y + 4.24, 0, C.cap);
  for (let i = 0; i < additionFinials; i++)
    vent(out, q([0.24 + i * 0.26, 0.7545]), y + 4.24, 0.116, lod, 0.77);
  const coreFront = edge(cells[0], cells[1], areaSign(cells));
  const coreBack = edge(cells[2], cells[3], areaSign(cells));
  for (const w of [coreFront, coreBack]) {
    for (let i = 0; i < 4; i++)
      steelBand(out, w, 0.045 + i * 0.245, 0.207 + i * 0.245, y + 2.52, lod);
  }
  for (const u of [0.26, 0.48, 0.72, 0.86]) door(out, coreFront, u, y, 0.94, lod);
  const frontage = edge(later[2], later[3], areaSign(later));
  for (const u of [0.12, 0.33, 0.49, 0.65]) door(out, frontage, u, y, 0.91, lod);
  const ux = frontage.length * 0.836;
  opening(
    out,
    frontage,
    ux - 0.81,
    ux + 0.81,
    y + 1.17,
    y + 2.37,
    'trim',
    C.recess,
    'iron',
    C.cream,
    lod,
    0.07,
  );
  if (lod > 0)
    for (let i = 0; i < 9; i++)
      panel(
        out,
        'trim',
        frontage,
        ux - 0.76,
        ux + 0.76,
        y + 1.25 + 0.119 * i,
        y + 1.3 + 0.119 * i,
        0.1,
        C.iron,
      );
  // The later covered west annex reads as a light structure against the concrete wings.
  const annex = box(0.026, 0.538, 0.182, 0.963);
  wall(out, annex, y, y + 1.22, 'block', C.foot);
  const aw = edge(annex[2], annex[3], areaSign(annex));
  panel(out, 'iron', aw, 0, aw.length, y + 1.25, y + 2.75, 0.073, C.recess);
  if (lod > 0)
    for (let i = 0; i < 8; i++) {
      const u = (aw.length * (i + 0.5)) / 8;
      panel(out, 'trim', aw, u - 0.027, u + 0.027, y + 1.23, y + 2.78, 0.095, C.iron);
    }
  // Open yards adjoin the older range. Their gates and isolated walls remain visible above the mapped roofs.
  const bounds = [
    [[0.058, 0.035], [0.058, -0.56], null],
    [[0.058, -0.56], [0.342, -0.56], 0.54],
    [[0.342, -0.56], [0.342, 0.035], null],
    [[0.342, -0.56], [0.63, -0.56], 0.53],
    [[0.63, -0.56], [0.63, 0.035], null],
    [[0.63, -0.56], [0.913, -0.56], 0.52],
    [[0.913, -0.56], [0.913, -0.29], null],
    [[0.913, -0.29], [0.976, -0.29], null],
    [[0.976, -0.29], [0.976, 0.037], null],
  ];
  for (const [a, b, g] of bounds)
    retaining(out, q, a, b, 0.142, y - 0.3, y + wallHeight - 0.1, g, lod, grade);
  for (const [a, b] of [
    [0.064, 0.325],
    [0.356, 0.614],
    [0.644, 0.899],
  ]) {
    // Curved iron hood with a steep outboard tip and rounded shoulder.
    const profile = [
      [0.018, y + 3.49],
      [-0.064, y + 3.46],
      [-0.111, y + 3.35],
      [-0.134, y + 3.18],
    ];
    for (const [[z0, h0], [z1, h1]] of pairs(lod === 0 ? [profile[0], profile.at(-1)] : profile))
      face(
        out,
        'roof',
        [at(q([a, z0]), h0), at(q([b, z0]), h0), at(q([b, z1]), h1), at(q([a, z1]), h1)],
        up,
        C.roof,
      );
  }
}

function quarters(out, p, rooms, grade, lod) {
  const { q, box } = local(p);
  const lowest = Math.min(...p.map(grade)),
    y = Math.max(...p.map(grade)) + 0.27;
  const hut = box(0.065, 0.094, 0.938, 0.755);
  wall(out, box(0.039, 0.078, 0.964, 0.966), lowest - 0.17, y, 'base', C.foot);
  wall(out, hut, y, y + 2.53, 'siding', C.siding);
  roof(out, box, [0, 0, 1, 1], y + 2.54, y + 3.77, 0.27, C.roof);
  for (const [a, b] of pairs(closed(hut))) {
    const w = edge(a, b, areaSign(hut));
    if (w.length < 6.8) continue;
    for (let i = 0; i < rooms; i++) door(out, w, (i + 0.3) / rooms, y, 0.8, lod);
    for (let i = 0; i < rooms; i++) {
      const x = (w.length * (i + 0.73)) / rooms;
      opening(
        out,
        w,
        x - 0.47,
        x + 0.47,
        y + 0.94,
        y + 2.02,
        'trim',
        C.glass,
        'glass',
        C.cream,
        lod,
        0.055,
      );
      if (lod > 0) panel(out, 'trim', w, x - 0.45, x + 0.45, y + 1.45, y + 1.5, 0.093, C.cream);
    }
  }
  for (const u of [0.078, 0.5, 0.923])
    wall(out, box(u - 0.008, 0.919, u + 0.008, 0.949), y, y + 2.53, 'siding', C.cream);
  for (const u of [0.078, 0.5, 0.923]) {
    const [a, b] = [q([u, 0.82]), q([u, 0.949])];
    const w = edge(a, b, 1);
    panel(out, 'trim', w, 0, w.length, y + 0.9, y + 0.99, 0.02, C.cream);
  }
  const porch = box(0.374, 0.963, 0.595, 1.075);
  wall(out, porch, lowest - 0.12, y - 0.12, 'base', C.foot);
  cap(out, 'base', porch, y - 0.119, C.foot);
  if (lod > 1)
    for (const side of [edge(hut[1], hut[2], areaSign(hut)), edge(hut[3], hut[0], areaSign(hut))])
      bayWindows(out, side, 1, y + 1.0, lod);
}

function draw(
  out,
  lod,
  { polygons, wallsMeters, coreFinials, additionFinials, quartersRooms },
  grade,
) {
  gaol(out, polygons[0], wallsMeters, coreFinials, additionFinials, grade, lod);
  quarters(out, polygons[1], quartersRooms, grade, lod);
}

const compound = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-45, 30, 55],
    lookAt: [8, 1.5, -4],
    yaw: 2.1,
    sun: [-191, 370, 255],
    brief:
      'Standing concrete Normanton Gaol at Haig Street: open exercise yards, low iron roofs and rear timber trackers’ quarters.',
    views: [
      { name: 'compound-terrain-and-yard-walls', position: [48, 23, -47], lookAt: [8, 2, -5] },
      { name: 'concrete-range-and-ridge-vents', position: [-27, 10, 25], lookAt: [0, 2, -5] },
      { name: 'exercise-yard-iron-doors', position: [40, 13, -28], lookAt: [6, 2, -8] },
      { name: 'trackers-quarters-and-porch', position: [47, 9, 18], lookAt: [26, 2, -1] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = compound;
export const model = { ...compound.model, category: 'civic-institutional' };
