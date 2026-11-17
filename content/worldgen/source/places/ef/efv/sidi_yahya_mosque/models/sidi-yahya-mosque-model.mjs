/** The standing Sidi Yahya Mosque and its two open courts in Timbuktu. */
import {
  areaSign,
  at,
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
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  stone: surface('wall', 'stone_limestone_raw', 0.97),
  earth: surface('trim', 'earth_rammed', 0.99),
  roof: surface('roof', 'earth_adobe', 0.99),
  foundation: surface('foundation', 'stone_ashlar', 0.96),
  timber: surface('door', 'wood_plain', 0.92),
};
const colors = palette({
  rubble: 'c2aa87',
  facing: 'cbb694',
  lime: 'd1ba96',
  earth: 'c5a681',
  sides: 'ba9a75',
  sand: 'bda083',
  slate: 'a08b6e',
  shade: '9e815e',
  roof: 'bba383',
  wood: '78543a',
  woodLight: '916944',
  cavity: '61513c',
  sill: 'b49b79',
});

function clippedRect(x, z, width, depth, bevel) {
  const a = x - width / 2,
    b = x + width / 2,
    c = z - depth / 2,
    d = z + depth / 2;
  return [
    [a + bevel, c],
    [b - bevel, c],
    [b, c + bevel],
    [b, d - bevel],
    [b - bevel, d],
    [a + bevel, d],
    [a, d - bevel],
    [a, c + bevel],
  ];
}

function frustum(out, sections, material, color, sideColor = color) {
  const outline = sections[0].points;
  for (const [low, high] of pairs(sections)) {
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      const wall = edge(low.points[i], low.points[j]);
      face(
        out,
        material,
        [
          at(low.points[i], low.y(i)),
          at(low.points[j], low.y(j)),
          at(high.points[j], high.y(j)),
          at(high.points[i], high.y(i)),
        ],
        wall.normal,
        i % 3 === 1 ? sideColor : color,
      );
    }
  }
  cap(out, material, sections.at(-1).points, sections.at(-1).y(0), color);
}

function roundedPier(out, x, z, width, depth, top, grade, material = 'stone') {
  const low = clippedRect(x, z, width, depth, 0.12);
  frustum(
    out,
    [
      { points: low, y: (i) => grade(low[i]) - 0.16 },
      { points: clippedRect(x, z, width * 0.88, depth * 0.8, 0.11), y: () => top - 0.16 },
      { points: clippedRect(x, z, width * 0.79, depth * 0.69, 0.1), y: () => top },
    ],
    material,
    colors.facing,
    colors.rubble,
  );
}

function ogive(u, center, halfWidth, spring, rise) {
  const t = Math.abs((u - center) / halfWidth);
  return spring + rise * (1 - 0.72 * t - 0.28 * t * t);
}

function portal(out, wall, center, width, bottom, spring, rise, lod, detailedDoor) {
  const half = width * 0.5,
    outerHalf = half + 0.17,
    top = spring + rise + 0.19;
  const divisions = [4, 6, 8, 12][lod];
  const profile = Array.from({ length: divisions + 1 }, (_, i) => {
    const t = (i / divisions) * 2 - 1,
      u = center + t * half,
      o = center + t * outerHalf;
    return {
      u,
      o,
      hi: ogive(u, center, half, spring, rise),
      outer: ogive(o, center, outerHalf, spring, rise + 0.18),
    };
  });
  const portalDepth = -0.22;
  const paletteDoor = detailedDoor ? colors.wood : colors.cavity;
  panel(
    out,
    'timber',
    wall,
    center - half,
    center + half,
    bottom,
    spring,
    portalDepth,
    paletteDoor,
  );
  face(
    out,
    'timber',
    profile.map(({ u, hi }) => wall.p(u, hi, portalDepth)),
    wall.normal,
    paletteDoor,
  );
  for (const [a, b] of pairs(profile)) {
    face(
      out,
      'stone',
      [
        wall.p(a.o, a.outer, 0.028),
        wall.p(b.o, b.outer, 0.028),
        wall.p(b.o, top, 0.028),
        wall.p(a.o, top, 0.028),
      ],
      wall.normal,
      colors.facing,
    );
    face(
      out,
      'earth',
      [
        wall.p(a.u, a.hi, 0.056),
        wall.p(b.u, b.hi, 0.056),
        wall.p(b.o, b.outer, 0.079),
        wall.p(a.o, a.outer, 0.079),
      ],
      wall.normal,
      colors.lime,
    );
    face(
      out,
      'earth',
      [
        wall.p(a.u, a.hi, portalDepth),
        wall.p(b.u, b.hi, portalDepth),
        wall.p(b.u, b.hi, 0.056),
        wall.p(a.u, a.hi, 0.056),
      ],
      [0, -1, 0],
      colors.shade,
    );
  }
  for (const sign of [-1, 1]) {
    const inner = center + sign * half;
    const outer = center + sign * outerHalf;
    panel(
      out,
      'earth',
      wall,
      Math.min(inner, outer),
      Math.max(inner, outer),
      bottom,
      spring,
      0.072,
      colors.lime,
    );
    const sideCenter = wall.p(inner, bottom, 0),
      mid = wall.p(center, bottom, 0);
    face(
      out,
      'earth',
      [
        wall.p(inner, bottom, portalDepth),
        wall.p(inner, bottom, 0.056),
        wall.p(inner, spring, 0.056),
        wall.p(inner, spring, portalDepth),
      ],
      [mid[0] - sideCenter[0], 0, mid[2] - sideCenter[2]],
      colors.shade,
    );
  }
  if (!detailedDoor || lod === 0) return;
  for (const t of [-0.5, 0, 0.5]) {
    const u = center + t * half;
    panel(
      out,
      'timber',
      wall,
      u - 0.018,
      u + 0.018,
      bottom + 0.022,
      ogive(u, center, half, spring, rise) - 0.02,
      portalDepth + 0.021,
      colors.woodLight,
    );
  }
  for (const y of [bottom + 0.52, bottom + 1.03])
    panel(
      out,
      'timber',
      wall,
      center - half + 0.05,
      center + half - 0.05,
      y,
      y + 0.05,
      portalDepth + 0.023,
      colors.woodLight,
    );
  if (lod === 3) {
    for (const t of [-0.38, -0.21, 0.21, 0.38])
      for (const y of [bottom + 0.53, bottom + 1.04])
        panel(
          out,
          'timber',
          wall,
          center + t * width - 0.027,
          center + t * width + 0.027,
          y,
          y + 0.027,
          portalDepth + 0.037,
          colors.cavity,
        );
  }
}

function wallWithPortals(out, a, b, orientation, y0, y1, openings, lod) {
  const w = edge(a, b, orientation);
  let cursor = 0;
  for (const { center, width, bottom, spring, rise, door } of openings) {
    const wing = width * 0.5 + 0.17,
      top = spring + rise + 0.19;
    panel(out, 'stone', w, cursor, center - wing, y0, y1, 0, colors.facing);
    panel(out, 'stone', w, center - wing, center + wing, y0, bottom, 0, colors.rubble);
    if (top < y1) panel(out, 'stone', w, center - wing, center + wing, top, y1, 0, colors.facing);
    portal(out, w, center, width, bottom, spring, rise, lod, door);
    cursor = center + wing;
  }
  panel(out, 'stone', w, cursor, w.length, y0, y1, 0, colors.facing);
}

function prayerHall(out, lod, plan, grade) {
  const { hall, closedHallTop: top } = plan;
  const orientation = areaSign(hall);
  for (const [[a, b], index] of pairs(closed(hall)).map((v, i) => [v, i])) {
    const w = edge(a, b, orientation);
    if (index === 1) {
      const base = grade([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) - 0.21;
      const bottom = base + 0.28;
      wallWithPortals(
        out,
        a,
        b,
        orientation,
        base,
        top,
        [
          { center: 2.13, width: 1.21, bottom, spring: bottom + 1.55, rise: 0.56, door: true },
          { center: 5.65, width: 1.15, bottom, spring: bottom + 1.48, rise: 0.54, door: true },
        ],
        lod,
      );
    } else {
      face(
        out,
        'stone',
        [at(a, grade(a) - 0.24), at(b, grade(b) - 0.24), at(b, top), at(a, top)],
        w.normal,
        index % 3 ? colors.rubble : colors.facing,
      );
    }
    if (w.length > 0.45) {
      panel(out, 'earth', w, 0, w.length, top - 0.17, top + 0.15, 0.026, colors.sides);
      if (lod > 1 && w.length > 3)
        panel(
          out,
          'foundation',
          w,
          0,
          w.length,
          Math.max(grade(a), grade(b)) - 0.19,
          Math.max(grade(a), grade(b)) + 0.14,
          0.022,
          colors.sill,
        );
    }
  }
  cap(out, 'roof', hall, top, colors.roof);
  for (const x of lod === 0 ? [4.84, 1.51, -3.49] : [4.84, 1.51, -1.93, -3.49])
    roundedPier(out, x, -14.02, 0.56, 0.62, 4.19, grade);
  for (const z of lod === 0 ? [-8.96, 3.4, 13.14] : [-8.96, -3.5, 3.4, 8.21, 13.14])
    roundedPier(out, -6.59, z, 0.81, 0.62, top + 0.16, grade);
  if (lod === 0) return;
  for (const z of [-10.8, -4.25, 3.5, 8.55, 12.9])
    roundedPier(out, 5.09, z, 0.65, 0.56, top + 0.08, grade);
  for (const x of [1.18, 3.26])
    block(out, 'roof', x, top - 0.018, -4.5, 0.19, 0.14, 12.2, colors.sand);
  if (lod > 1)
    for (const z of [-7.2, -3, 4.1, 9.2]) {
      block(out, 'timber', -6.85, top - 0.32, z, 0.55, 0.09, 0.11, colors.wood);
      block(out, 'timber', 4.96, top - 0.32, z, 0.44, 0.085, 0.095, colors.wood);
    }
}

function annexCourt(out, lod, plan, grade) {
  const { annex, northCourt: coords } = plan;
  const court = rect(...coords),
    height = 3.42;
  const west = areaSign(annex);
  for (const [[a, b], i] of pairs(closed(annex)).map((pair, i) => [pair, i])) {
    if (i === 2 || i === 3) continue;
    const w = edge(a, b, west);
    if (i === 0) {
      const y = grade([-8.7, -16.94]);
      wallWithPortals(
        out,
        a,
        b,
        west,
        y - 0.28,
        height,
        [{ center: 4.75, width: 0.98, bottom: y + 0.06, spring: y + 1.44, rise: 0.42, door: true }],
        lod,
      );
    } else
      face(
        out,
        'stone',
        [at(a, grade(a) - 0.25), at(b, grade(b) - 0.25), at(b, height), at(a, height)],
        w.normal,
        colors.facing,
      );
    panel(out, 'earth', w, 0, w.length, height - 0.11, height + 0.15, 0.023, colors.sides);
  }
  for (const [a, b] of pairs(closed(court))) {
    const w = edge(a, b, -1);
    face(
      out,
      'earth',
      [at(a, grade(a) - 0.23), at(b, grade(b) - 0.23), at(b, height), at(a, height)],
      w.normal,
      colors.sides,
    );
  }
  const all = [...annex, ...court],
    indices = earcut(all.flat(), [annex.length]);
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      'roof',
      indices.slice(i, i + 3).map((i) => at(all[i], height)),
      up,
      colors.roof,
    );
  for (const x of lod === 0 ? [-12.8] : [-12.8, -7.1, -3.85])
    roundedPier(out, x, -16.94, 0.52, 0.54, height + 0.3, grade);
}

function tower(out, lod, plan, grade) {
  const {
    center: [x, z],
    baseWidth: w,
    baseDepth: d,
    topWidth: tw,
    topDepth: td,
    eave,
  } = plan.tower;
  const foot = clippedRect(x, z, w, d, 0.19);
  const middle = clippedRect(x, z, mix(w, tw, 0.52), mix(d, td, 0.52), 0.17);
  const head = clippedRect(x, z, tw, td, 0.15);
  frustum(
    out,
    [
      { points: foot, y: (i) => grade(foot[i]) - 0.23 },
      { points: middle, y: () => 3.7 },
      { points: head, y: () => eave - 0.16 },
      { points: clippedRect(x, z, tw * 0.98, td * 0.98, 0.16), y: () => eave },
    ],
    'stone',
    colors.rubble,
    colors.facing,
  );
  const footing = clippedRect(x, z, w + 0.1, d + 0.1, 0.18);
  if (lod > 0)
    frustum(
      out,
      [
        { points: footing, y: (i) => grade(footing[i]) - 0.2 },
        { points: clippedRect(x, z, w + 0.06, d + 0.06, 0.18), y: () => 0.89 },
      ],
      'foundation',
      colors.sill,
    );
  for (const [side, across] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const px = x + side * (tw / 2 - 0.24),
      pz = z + across * (td / 2 - 0.25);
    const pedestal = clippedRect(px, pz, 0.75, 0.69, 0.1);
    frustum(
      out,
      [
        { points: pedestal, y: () => eave - 0.05 },
        { points: clippedRect(px, pz, 0.67, 0.64, 0.13), y: () => eave + 0.55 },
        { points: clippedRect(px, pz, 0.54, 0.51, 0.13), y: () => eave + 0.67 },
      ],
      'earth',
      colors.earth,
      colors.lime,
    );
  }
  const peak = clippedRect(x + 0.72, z - 0.4, 0.79, 0.82, 0.13);
  frustum(
    out,
    [
      { points: peak, y: () => eave - 0.03 },
      { points: clippedRect(x + 0.72, z - 0.4, 0.65, 0.65, 0.13), y: () => eave + 0.85 },
      { points: clippedRect(x + 0.72, z - 0.4, 0.46, 0.45, 0.12), y: () => eave + 1.1 },
    ],
    'earth',
    colors.facing,
    colors.lime,
  );
  const rows = lod === 0 ? [4.55, 6.31] : [2.81, 4.48, 5.75, 6.83];
  for (const y of rows) {
    const wx = mix(w, tw, y / eave) * 0.5,
      dz = mix(d, td, y / eave) * 0.5;
    for (const t of lod === 0 ? [0] : [-0.66, 0.12, 0.57]) {
      block(out, 'timber', x - wx - 0.3, y, z + t * dz, 0.52, 0.1, 0.098, colors.wood);
      block(out, 'timber', x + t * wx, y, z - dz - 0.28, 0.11, 0.105, 0.48, colors.woodLight);
    }
    if (lod > 1) {
      block(out, 'timber', x + wx - 0.14, y - 0.08, z - dz * 0.6, 0.48, 0.093, 0.1, colors.wood);
      block(
        out,
        'timber',
        x - wx * 0.33,
        y - 0.14,
        z + dz - 0.16,
        0.11,
        0.094,
        0.52,
        colors.woodLight,
      );
    }
  }
}

function westCourtyard(out, lod, plan, grade) {
  const { west, east, north, south, gateZ } = plan.westCourt;
  const gateTop = grade([west, gateZ]) + 2.95;
  const gateBottom = grade([west, gateZ]) + 0.085;
  const edges = [
    [
      [west, north],
      [west, south],
    ],
    [
      [west, south],
      [east, south],
    ],
  ];
  for (const [[a, b], i] of edges.map((edge, i) => [edge, i])) {
    const w = edge(a, b, -1);
    const segments =
      i === 0
        ? [
            [0, gateZ - north - 1.47],
            [gateZ - north + 1.47, w.length],
          ]
        : [[0, w.length]];
    for (const [start, end] of segments) {
      const pa = [w.p(start, 0)[0], w.p(start, 0)[2]],
        pb = [w.p(end, 0)[0], w.p(end, 0)[2]];
      const lowerA = grade(pa) - 0.23,
        lowerB = grade(pb) - 0.23;
      const y = 1.83;
      const p = (u, v, d) => w.p(u, v, d);
      face(
        out,
        'stone',
        [p(start, lowerA, 0.13), p(end, lowerB, 0.13), p(end, y, 0.1), p(start, y, 0.1)],
        w.normal,
        colors.rubble,
      );
      face(
        out,
        'earth',
        [p(start, lowerA, -0.29), p(end, lowerB, -0.29), p(end, y, -0.25), p(start, y, -0.25)],
        w.normal.map((v) => -v),
        colors.sides,
      );
      face(
        out,
        'earth',
        [p(start, y, 0.1), p(end, y, 0.1), p(end, y, -0.25), p(start, y, -0.25)],
        up,
        colors.earth,
      );
    }
  }
  wallWithPortals(
    out,
    [west, gateZ - 1.59],
    [west, gateZ + 1.59],
    -1,
    gateBottom - 0.25,
    gateTop,
    [
      {
        center: 1.59,
        width: 1.64,
        bottom: gateBottom,
        spring: gateBottom + 1.52,
        rise: 0.54,
        door: true,
      },
    ],
    lod,
  );
  for (const sign of [-1, 1])
    roundedPier(out, west + 0.01, gateZ + sign * 1.25, 0.68, 0.77, gateTop + 0.11, grade, 'earth');
  block(
    out,
    'foundation',
    west - 0.51,
    gateBottom - 0.18,
    gateZ - 0.96,
    0.8,
    0.18,
    1.92,
    colors.sill,
  );
  if (lod > 0) {
    for (const z of [north + 0.34, gateZ - 3, gateZ + 4, south - 0.16])
      roundedPier(out, west + 0.02, z, 0.55, 0.62, 2.0, grade);
    for (const z of [-6.13, -4.97]) {
      const y = grade([-9.16, z]);
      block(out, 'foundation', -9.83, y - 0.05, z - 0.2, 1.25, 0.18, 0.43, colors.sand);
    }
  }
}

function draw(out, lod, plan, grade) {
  prayerHall(out, lod, plan, grade);
  annexCourt(out, lod, plan, grade);
  tower(out, lod, plan, grade);
  westCourtyard(out, lod, plan, grade);
}

const mosque = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-29, 14, -36],
    lookAt: [-2.9, 2.4, -3.2],
    yaw: 0.66,
    sun: [-280, 510, -455],
    brief:
      'An earth-and-stone mosque with a tapered timber-studded minaret, flat prayer hall, rounded eastern mihrab and a low western court surrounding the rebuilt wooden gate.',
    views: [
      { name: 'north-plaza-and-minaret', position: [-6, 7, -31], lookAt: [-3, 3, -8] },
      { name: 'restored-western-gate', position: [-27, 4, 6], lookAt: [-12, 1.35, 0.6] },
      { name: 'mihrab-and-two-courtyards', position: [20, 23, 18], lookAt: [-3.8, 2, -1] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = mosque;
export const model = { ...mosque.model, category: 'religious' };
