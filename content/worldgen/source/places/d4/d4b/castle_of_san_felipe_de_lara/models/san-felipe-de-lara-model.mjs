/** Standing Río Dulce fortress, organized around its native envelope and entry. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  poly as polygonPrism,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const field = read('terrain-grid.json');
const site = plan.site;
const outline = frame.geometry.outline;
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98, metallic: 0 },
  basement: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.97,
    metallic: 0,
  },
  coping: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  inset: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    gray: 'ada89c',
    old: '958f83',
    light: 'c1bcb0',
    damp: '79786d',
    block: 'b4ab9b',
    tile: '98604b',
    fadedTile: 'ad7155',
    wood: '7a6450',
    shade: '37372d',
    pavement: 'a49a85',
    iron: '53534a',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function poly(out, slot, outline, bottom, top, color) {
  const caps = new MeshBufferBuilder();
  polygonPrism(
    { addQuad: out.addQuad.bind(out), addCap: caps.addCap.bind(caps) },
    slot,
    outline,
    bottom,
    top,
    color,
  );
  // Route the triangulated caps through the runtime material wrapper as well.
  const mesh = caps.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3);
    const points = Array.from(indices, (id) =>
      Array.from(mesh.positions.slice(3 * id, 3 * id + 3)),
    );
    triangle(out, slot, points, color);
  }
}

function elevation(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = field.heightsMeters[j],
    b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return {
    length,
    point: (t, y, d = 0) => {
      const [x, z] = between(a, b, t);
      return [x - (dz * d) / length, y, z + (dx * d) / length];
    },
  };
}

function copingOnEdge(out, edge, t0, t1, h0, h1, width, slot = 'coping', color = tint.block) {
  const p = edge.point;
  const rise = 0.14;
  face(
    out,
    slot,
    [p(t1, h1, -0.06), p(t0, h0, -0.06), p(t0, h0 + rise, -0.06), p(t1, h1 + rise, -0.06)],
    color,
  );
  face(
    out,
    slot,
    [
      p(t1, h1 + rise, -0.06),
      p(t0, h0 + rise, -0.06),
      p(t0, h0 + rise, width + 0.06),
      p(t1, h1 + rise, width + 0.06),
    ],
    color,
  );
}

function segment(out, a, b, options, lod) {
  const {
    topA,
    topB,
    baseA,
    baseB,
    width = 1.04,
    batter = 0.21,
    crenels = false,
    openings = [],
    color = tint.gray,
    below = 0.86,
    stoneBand = true,
  } = options;
  const edge = section(a, b),
    p = edge.point;
  const base = (t) => mix(baseA, baseB, t);
  const top = (t) => mix(topA, topB, t);
  const front = (u, v, ya, yb, ha, hb, depth = 0, slot = 'rubble', surface = color) => {
    face(out, slot, [p(v, yb, depth), p(u, ya, depth), p(u, ha, depth), p(v, hb, depth)], surface);
  };
  const low = (t) => base(t) + below;
  if (stoneBand) {
    face(
      out,
      'basement',
      [p(1, baseB, -batter), p(0, baseA, -batter), p(0, low(0)), p(1, low(1))],
      tint.damp,
    );
  }
  const bandBase = stoneBand ? low : base;
  let cursor = 0;
  for (const opening of openings) {
    const [center, w, sill, height] = opening;
    const u = (center - w / 2) / edge.length,
      v = (center + w / 2) / edge.length;
    front(cursor, u, bandBase(cursor), bandBase(u), top(cursor), top(u));
    front(u, v, bandBase(u), bandBase(v), sill, sill);
    const slices = lod > 1 ? 7 : 3;
    const spring = sill + height - w * 0.27;
    const h = (t) => spring + w * 0.27 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)));
    for (let i = 0; i < slices; i++) {
      const a = i / slices,
        b = (i + 1) / slices,
        f = mix(u, v, a),
        g = mix(u, v, b);
      front(f, g, h(a), h(b), top(f), top(g));
      front(f, g, sill, sill, h(a), h(b), width * 0.61, 'inset', tint.shade);
      face(
        out,
        'coping',
        [p(g, h(b)), p(f, h(a)), p(f, h(a), width * 0.61), p(g, h(b), width * 0.61)],
        tint.old,
      );
      if (lod > 1)
        front(
          f,
          g,
          h(a) - 0.02,
          h(b) - 0.02,
          h(a) + 0.15,
          h(b) + 0.15,
          -0.045,
          'coping',
          tint.block,
        );
    }
    for (const t of [u, v]) {
      const side = [p(t, sill), p(t, sill, width * 0.6), p(t, spring, width * 0.6), p(t, spring)];
      face(out, 'coping', t === u ? side : side.toReversed(), tint.old);
    }
    cursor = v;
  }
  front(cursor, 1, bandBase(cursor), bandBase(1), top(cursor), topB);
  face(
    out,
    'rubble',
    [p(0, baseA, width), p(1, baseB, width), p(1, topB, width), p(0, topA, width)],
    color,
  );
  face(out, 'coping', [p(1, topB), p(0, topA), p(0, topA, width), p(1, topB, width)], tint.block);
  if (lod > 0 && edge.length > 0.4) copingOnEdge(out, edge, 0, 1, topA, topB, width);
  if (!crenels) return;
  const count = Math.max(1, Math.floor(edge.length / (lod > 0 ? 2.1 : 3.4)));
  for (let i = 0; i < count; i++) {
    const u = (i + 0.23) / count,
      v = (i + 0.79) / count;
    const x0 = top(u) + 0.06,
      x1 = top(v) + 0.06,
      h = lod > 0 ? 0.5 : 0.43;
    front(u, v, x0, x1, x0 + h, x1 + h, -0.018, 'rubble', color);
    face(
      out,
      'coping',
      [p(v, x1 + h, width), p(v, x1 + h), p(u, x0 + h), p(u, x0 + h, width)],
      tint.block,
    );
    face(
      out,
      'rubble',
      [p(u, x0, width), p(v, x1, width), p(v, x1 + h, width), p(u, x0 + h, width)],
      color,
    );
    for (const [t, y, flip] of [
      [u, x0, false],
      [v, x1, true],
    ]) {
      const end = [p(t, y), p(t, y, width), p(t, y + h, width), p(t, y + h)];
      face(out, 'rubble', flip ? end.toReversed() : end, color);
    }
  }
}

function outerBattery(out, lod) {
  // The canted inner end and native curved wall define the low artillery platform.
  const outer = outline.slice(13, 26).toReversed();
  const ring = [...outer, [15.6, 1.4], [15.4, -9.8]];
  poly(out, 'basement', ring, site.baseY, site.batteryDeckY, tint.old);
  if (lod > 0)
    poly(out, 'coping', ring, site.batteryDeckY - 0.08, site.batteryDeckY + 0.05, tint.pavement);
  for (let i = 1; i < outer.length; i++) {
    const a = outer[i - 1],
      b = outer[i];
    segment(
      out,
      a,
      b,
      {
        topA: site.batteryParapetY,
        topB: site.batteryParapetY,
        baseA: site.baseY,
        baseB: site.baseY,
        batter: 0.52,
        width: 0.9,
        below: 2.1,
        color: tint.gray,
        crenels: lod > 0 && i % 2 === 0,
      },
      lod,
    );
  }
  if (lod === 0) return;
  for (const [x, z, yaw] of [
    [28.3, -8.6, 0.46],
    [25.7, -11.4, 0.7],
    [26.9, -2.7, -0.23],
  ]) {
    const outboard = transform(out, yaw, [x, site.batteryDeckY + 0.08, z]);
    box(outboard, 'timber', [-0.66, 0, -0.31], [0.65, 0.26, 0.29], tint.wood);
    tube(outboard, 'inset', [-0.74, 0.42, 0], [0.75, 0.46, 0], 0.115, tint.iron, lod > 1 ? 10 : 6);
  }
}

function mainCurtains(out, lod) {
  const front = [
    {
      a: outline[27],
      b: outline[26],
      topA: 0.64,
      topB: -0.68,
      baseA: -2.42,
      baseB: site.baseY,
      crenels: false,
      openings: [
        [8.7, 0.93, -1.12, 1.31],
        [17.8, 1.42, -1.76, 0.66],
        [29.2, 1.0, -2.0, 0.71],
      ],
      below: 0.65,
    },
    {
      a: outline[26],
      b: outline[25],
      topA: -0.68,
      topB: -0.86,
      baseA: site.baseY,
      baseB: site.baseY,
      below: 0.58,
    },
    {
      a: outline[13],
      b: outline[12],
      topA: -0.72,
      topB: 0.06,
      baseA: site.baseY,
      baseB: -6.3,
      crenels: true,
    },
    { a: outline[12], b: outline[11], topA: 0.06, topB: 0.16, baseA: -6.3, baseB: -6.15 },
    {
      a: outline[11],
      b: outline[10],
      topA: 0.16,
      topB: 0.68,
      baseA: -6.15,
      baseB: -3.8,
      openings: [
        [4.8, 1.24, -1.78, 0.66],
        [12.6, 1.16, -1.55, 0.73],
        [18.7, 0.98, -1.12, 1.43],
      ],
      crenels: false,
    },
  ];
  for (const piece of front)
    segment(
      out,
      piece.a,
      piece.b,
      {
        ...piece,
        openings: lod > 0 ? piece.openings : undefined,
        width: 1.04,
      },
      lod,
    );
  for (const [a, b] of [
    [
      [-18.02, -5.09],
      [-18.02, -1.58],
    ],
    [
      [-18.02, 2.78],
      [-18.02, 7.62],
    ],
  ]) {
    segment(
      out,
      b,
      a,
      { topA: 2.5, topB: 2.5, baseA: -2.8, baseB: -2.8, width: 1.31, batter: 0.28, crenels: true },
      lod,
    );
  }
}

function roof(out, x0, x1, z0, z1, eaves, ridge, color = tint.tile) {
  const cx = (x0 + x1) / 2,
    depth = z1 - z0,
    width = x1 - x0;
  const over = 0.37;
  const a = [x0 - over, eaves, z0 - over],
    b = [x1 + over, eaves, z0 - over];
  const c = [x1 + over, eaves, z1 + over],
    d = [x0 - over, eaves, z1 + over];
  const inset = Math.min(width * 0.39, depth * 0.45);
  const endA = [cx, ridge, z0 + inset],
    endB = [cx, ridge, z1 - inset];
  face(out, 'tile', [d, endB, endA, a], color);
  face(out, 'tile', [b, endA, endB, c], tint.fadedTile);
  triangle(out, 'tile', [a, endA, b], tint.fadedTile);
  triangle(out, 'tile', [c, endB, d], color);
  face(out, 'timber', [a, b, c, d], tint.wood);
}

function tower(out, dimensions, lod, lookout = false) {
  const {
    bounds: [x0, x1, z0, z1],
    topY,
    roofY,
  } = dimensions;
  const a = [x0, z0],
    b = [x1, z0],
    c = [x1, z1],
    d = [x0, z1];
  const ring = [a, b, c, d];
  const lower = lookout ? -2.19 : -2.7;
  for (let i = 0; i < ring.length; i++) {
    const u = ring[i],
      v = ring[(i + 1) % ring.length],
      span = section(u, v).length;
    const baseAt = ([x, z]) => Math.min(lower, elevation(x, z) - 0.18);
    const openings =
      lod > 0
        ? [
            [span * 0.29, lookout ? 0.47 : 0.68, topY - 1.2, 0.74],
            [span * 0.73, lookout ? 0.47 : 0.68, topY - 1.2, 0.74],
          ]
        : [];
    segment(
      out,
      u,
      v,
      {
        topA: topY,
        topB: topY,
        baseA: baseAt(u),
        baseB: baseAt(v),
        batter: lookout ? 0.21 : 0.36,
        below: 1.27,
        width: 0.73,
        openings,
        color: lookout ? tint.light : tint.gray,
      },
      lod,
    );
  }
  roof(out, x0, x1, z0, z1, topY + 0.26, roofY, lookout ? tint.tile : tint.fadedTile);
  if (lod === 3) {
    const center = (x0 + x1) / 2;
    const inset = Math.min((x1 - x0) * 0.39, (z1 - z0) * 0.45);
    tube(
      out,
      'tile',
      [center, roofY, z0 + inset],
      [center, roofY, z1 - inset],
      0.096,
      tint.tile,
      7,
    );
    for (const [x, z] of ring) {
      const sideX = x === x0 ? -1 : 1;
      const sideZ = z === z0 ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const y = topY - 0.45 - i * 0.42;
        const extentA = i % 2 === 0 ? 0.32 : 0.48;
        const extentB = i % 2 === 0 ? 0.48 : 0.32;
        const a = [x - sideX * extentA, y - 0.18, z - sideZ * extentB];
        const b = [x + sideX * 0.045, y + 0.17, z + sideZ * 0.065];
        box(
          out,
          'coping',
          a.map((v, j) => Math.min(v, b[j])),
          b.map((v, j) => Math.max(v, a[j])),
          tint.block,
        );
      }
    }
  }
}

function raisedWatch(out, lod) {
  const ring = [
    [-5.5, -10.6],
    [7.6, -10.6],
    [9.2, -8.0],
    [9.2, -3.0],
    [7.2, 0],
    [-4.8, 0],
    [-7.3, -2.5],
    [-7.3, -7.8],
  ];
  poly(out, 'rubble', ring, -2.69, 0.7, tint.gray);
  for (let i = 0; i < ring.length; i++) {
    segment(
      out,
      ring[i],
      ring[(i + 1) % ring.length],
      {
        topA: 1.37,
        topB: 1.37,
        baseA: 0.63,
        baseB: 0.63,
        width: 0.5,
        crenels: lod > 0 || i % 2 === 0,
        stoneBand: false,
      },
      lod,
    );
  }
  roof(out, -3.7, 5.15, -7.7, -2.3, 2.8, 4.25, tint.tile);
  for (const x of [-3.4, 4.86])
    for (const z of [-7.38, -2.62]) {
      box(out, 'timber', [x - 0.1, 0.7, z - 0.1], [x + 0.1, 2.84, z + 0.1], tint.wood);
    }
  const forward = [
    [13.3, 0.7],
    [19.4, -1.92],
    [18.8, 2.16],
    [13.2, 4.7],
  ];
  poly(out, 'rubble', forward, site.baseY, 1.73, tint.old);
  poly(out, 'coping', forward, 1.72, 1.99, tint.block);
  if (lod > 0) {
    const edge = section(forward[2], forward[3]);
    for (let i = 0; i < 3; i++) {
      const a = (i + 0.22) / 3,
        b = (i + 0.76) / 3;
      beam(
        out,
        'rubble',
        edge.point(a, 2.21, 0.23),
        edge.point(b, 2.21, 0.23),
        0.51,
        0.6,
        tint.gray,
      );
    }
  }
}

function deckStep(out, kind, bounds, low, high, runs, lod) {
  const [x0, x1, z0, z1] = bounds;
  const count = lod === 0 ? Math.min(2, runs) : runs;
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count;
    box(
      out,
      kind,
      [mix(x0, x1, a), low - 0.25, z0],
      [mix(x0, x1, b) + 0.014, mix(high, low, a), z1],
      tint.pavement,
    );
  }
}

function innerCourt(out, lod) {
  const base = site.upperCourtY,
    middle = site.middleCourtY;
  const upper = [
    [-17.97, -5.12],
    [-15.8, -8.64],
    [-7.1, -8.64],
    [-7.1, 2.01],
    [-10.5, 3.55],
    [-15.75, 8.7],
    [-17.97, 8.7],
  ];
  const low = [
    [-9.8, 3.4],
    [4.8, 1.72],
    [15.8, -3.5],
    [21.35, -2.45],
    [20.7, 0.49],
    [8.39, 8.51],
    [-11.5, 10.63],
  ];
  poly(out, 'basement', upper, -3.34, base - 0.09, tint.old);
  poly(out, 'coping', upper, base - 0.09, base, tint.pavement);
  poly(out, 'basement', low, -4.66, middle - 0.09, tint.old);
  poly(out, 'coping', low, middle - 0.09, middle, tint.pavement);
  const innermost = [
    [-15.72, 7.45],
    [-9.65, 7.45],
    [-9.65, 10.88],
    [-15.72, 11.18],
  ];
  poly(out, 'rubble', innermost, -3.35, 1.61, tint.gray);
  roof(out, -15.64, -9.69, 7.52, 11.11, 1.67, 3.0, tint.fadedTile);
  deckStep(out, 'coping', [-10.2, -7.25, 3.64, 6.25], middle, base, 6, lod);
  deckStep(out, 'coping', [16.25, 21.55, -2.2, 0.05], site.batteryDeckY, middle, 9, lod);
  if (lod === 0) return;
  const edge = section([-10.2, 3.64], [-7.25, 3.64]);
  beam(
    out,
    'timber',
    edge.point(0, base + 0.71),
    edge.point(1, middle + 0.74),
    0.115,
    0.13,
    tint.wood,
  );
  for (let i = 0; i < 4; i++) {
    const t = i / 3,
      y = mix(base, middle, t);
    beam(out, 'timber', edge.point(t, y + 0.07), edge.point(t, y + 0.77), 0.094, 0.094, tint.wood);
  }
}

function bridgeApproach(out, lod) {
  const bridge = frame.features.find((f) => f.id === 'relation/7138061').points;
  const [facingSouth, landSouth, , landNorth, facingNorth] = bridge;
  const span = section(landNorth, facingNorth).length;
  const threshold = 1 - site.bridge.movableLeafLength / span;
  const west = (t) => between(landNorth, facingNorth, t);
  const east = (t) => between(landSouth, facingSouth, t);
  const strip = (lo, hi) => [west(lo), west(hi), east(hi), east(lo)];
  const { deckY: y, floorY } = site.bridge;
  poly(out, 'basement', strip(0, 0.23), -3.31, y - 0.13, tint.old);
  poly(out, 'basement', strip(0.68, threshold), -3.91, y - 0.13, tint.gray);
  poly(out, 'coping', strip(0, threshold), y - 0.29, y, tint.block);
  poly(out, 'timber', strip(threshold, 1), y - 0.16, y + 0.035, tint.wood);
  poly(
    out,
    'coping',
    [
      [-18.18, -1.49],
      [-16.31, -1.41],
      [-16.28, 2.63],
      [-18.12, 2.68],
    ],
    floorY - 0.24,
    y + 0.04,
    tint.block,
  );

  const sideWallA = [-18, -1.55],
    sideWallB = [-18, 2.75];
  segment(
    out,
    sideWallB,
    sideWallA,
    {
      topA: 2.54,
      topB: 2.54,
      baseA: -2.42,
      baseB: -2.42,
      width: 1.36,
      batter: 0.04,
      openings: [[2.15, 1.87, 0.13, 2.06]],
      stoneBand: false,
    },
    lod,
  );
  for (const side of [west, east]) {
    if (lod === 0) break;
    const p = (t, dy) => {
      const [x, z] = side(t);
      return [x, y + dy, z];
    };
    beam(out, 'timber', p(0.015, 0.87), p(threshold, 0.87), 0.13, 0.15, tint.wood);
    if (lod > 1) beam(out, 'timber', p(0.015, 0.52), p(threshold, 0.52), 0.085, 0.1, tint.wood);
    const posts = lod > 1 ? 7 : 4;
    for (let i = 0; i <= posts; i++) {
      const at = mix(0.02, threshold, i / posts);
      beam(out, 'timber', p(at, -0.03), p(at, 0.89), 0.15, 0.15, tint.wood);
    }
  }
  if (lod > 1) {
    for (const s of [west, east]) {
      const [ax, az] = s(threshold + 0.065),
        [bx, bz] = s(0.99);
      tube(out, 'inset', [ax, y + 0.1, az], [bx, 1.87, bz], 0.035, tint.iron, 4);
    }
    for (let i = 0; i < 8; i++) {
      const t = mix(threshold, 0.99, i / 8),
        [ax, az] = west(t),
        [bx, bz] = east(t);
      beam(out, 'timber', [ax, y + 0.039, az], [bx, y + 0.039, bz], 0.03, 0.035, tint.shade);
    }
  }
}

function waterfrontEdge(out, lod) {
  const mapped = frame.features.find((f) => f.id === 'way/485036029').points.toReversed();
  const edge = lod === 0 ? mapped.filter((_, i) => i % 4 === 0 || i === mapped.length - 1) : mapped;
  const water = site.waterControl.reviewY;
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1],
      b = edge[i];
    const finish = (p) => Math.max(water + 0.52, Math.min(water + 0.97, elevation(...p) - 0.16));
    segment(
      out,
      a,
      b,
      {
        topA: finish(a),
        topB: finish(b),
        baseA: water - 0.32,
        baseB: water - 0.32,
        width: 0.67,
        batter: 0.16,
        below: 0.34,
        color: tint.old,
      },
      lod,
    );
  }
  if (lod < 2) return;
  // Small stones break the line of the waterfront, with mapped walls left exposed.
  for (let i = 1; i < mapped.length; i++) {
    const edge = section(mapped[i - 1], mapped[i]);
    if (edge.length < 1.1) continue;
    const count = Math.floor(edge.length / 1.7) + 1;
    for (let j = 0; j < count; j++) {
      const rock = edge.point(
        (j + 0.45) / count,
        water + 0.18,
        -0.76 - 0.18 * Math.sin(i * 2.2 + j),
      );
      const r = 0.28 + 0.08 * Math.sin(i * 7 + j * 9);
      const rings = [
        radialRing(rock[1] - 0.31, r, r * 0.71, 5, [rock[0], rock[2]]),
        radialRing(rock[1] + 0.17, r * 0.78, r * 0.65, 5, [rock[0], rock[2]], 0.11),
      ];
      loft(out, 'basement', rings, i % 3 === 0 ? tint.light : tint.old);
    }
  }
}

function build(out, lod) {
  waterfrontEdge(out, lod);
  mainCurtains(out, lod);
  outerBattery(out, lod);
  innerCourt(out, lod);
  raisedWatch(out, lod);
  tower(out, site.towers.north, lod);
  tower(out, site.towers.south, lod);
  tower(out, site.towers.riverLookout, lod, true);
  bridgeApproach(out, lod);
}

export const castleSkyline = (out) => build(out, 0);
export const castleDistrict = (out) => build(out, 1);
export const castleStreet = (out) => build(out, 2);
export const castleCloseup = (out) => build(out, 3);

const recipe = 'san-felipe-de-lara-model.mjs';
const camera = [29, 21, 73],
  lookAt = [4, -1.23, -3];
export const sanFelipeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: castleCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'Replace only the named castle boundary from OpenStreetMap relation 7138060.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Restored colonial castle with gray river curtains, stepped masonry batteries, tile-roofed lookouts and stone approach bridge at Río Dulce.',
  camera,
  lookAt,
  sunDirection: [-24, 61, 42],
  portableGroundY: site.waterControl.reviewY - 0.13,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.98,
    cameraYaw: 0.33,
    groundY: site.waterControl.reviewY,
    focus: { center: [2, -0.6, -1.7] },
    terrain: {
      descriptor: 'terrain-shoreline-review.terrain.json',
      heightmap: 'terrain-shoreline-review.height.png',
    },
    water: { path: 'native-water.json' },
  },
  qaCameras: [
    { name: 'lake-front-and-tile-roofs', position: [3, 6, 60], lookAt: [4, -1.4, 1] },
    { name: 'round-river-battery', position: [47, 7, -26], lookAt: [24, -1.13, -7] },
    { name: 'entry-bridge-and-gate', position: [-43, 5.6, 22], lookAt: [-21, -0.2, 1.6] },
    { name: 'terraces-and-landward-walls', position: [38, 37, 38], lookAt: [2, -0.7, 0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `san-felipe-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'castleSkyline',
    errorMeters: 1.31,
    surfaces,
    authoredLevels: {
      district: { export: 'castleDistrict', errorMeters: 0.63, surfaces },
      street: { export: 'castleStreet', errorMeters: 0.21, surfaces },
      closeup: { export: 'castleCloseup', errorMeters: 0.079, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D geometry. Verified original photographer public-domain release. OpenStreetMap outlines ODbL 1.0. Elevation attribution in source grid.',
};
