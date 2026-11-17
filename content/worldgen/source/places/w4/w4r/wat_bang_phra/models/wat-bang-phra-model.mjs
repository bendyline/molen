/** Wat Bang Phra's four-porch hall, adjoining hall and standing figure in Nakhon Pathom. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const [mainOutline, hallOutline] = read('map-frame.json').geometry.polygons;
const { core, neighborHall, standingFigure } = plan.dimensions;
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    wall: 'd6c8ae',
    white: 'e1d9c7',
    foot: 'ad9e86',
    paving: 'bcb1a0',
    roof: '973f31',
    roofLight: 'a9543d',
    roofEdge: '6d372d',
    neighboring: 'a86549',
    leaf: '385e4b',
    shadowGreen: '364c42',
    brass: 'b58947',
    gold: 'c8a055',
    lightGold: 'e0ba66',
    goldShade: '9b713d',
    garnet: '794042',
    blue: '3f737a',
    night: '324447',
    wood: '664d3b',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.78, metallic: 0 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.57, metallic: 0.27 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.85, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
};

function sampleGround(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const lo = terrain.heightsMeters[j];
  const hi = terrain.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - a) + lo[i + 1] * a) * (1 - b) +
    (hi[i] * (1 - a) + hi[i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function frame([x, z], [nx, nz], y = 0) {
  return {
    point: ([u, h, v]) => [x + nz * u + nx * v, y + h, z - nx * u + nz * v],
    normal: ([u, h, v]) => [nz * u + nx * v, h, -nx * u + nz * v],
    local: ([a, b]) => [(a - x) * nz - (b - z) * nx, (a - x) * nx + (b - z) * nz],
  };
}

function oriented(out, axes) {
  return {
    addQuad(slot, material, points, normal, uv, color) {
      out.addQuad(slot, material, points.map(axes.point), axes.normal(normal), uv, color);
    },
    addTriangle(slot, material, points, normal, uv, color) {
      out.addTriangle(slot, material, points.map(axes.point), axes.normal(normal), uv, color);
    },
    addConvexPolygon(slot, material, points, normal, uv, color) {
      out.addConvexPolygon(slot, material, points.map(axes.point), axes.normal(normal), uv, color);
    },
  };
}

function face(out, slot, points, direction, color, uv = ([x, y, z]) => [x - z, y]) {
  const normal = normalFor(...points);
  const flip = normal.reduce((sum, value, i) => sum + value * direction[i], 0) < 0;
  out.addConvexPolygon(slot, pal, points, flip ? normal.map((value) => -value) : normal, uv, color);
}

function drawWallRing(out, axes, ring, eave) {
  const floor =
    Math.max(
      ...ring.map(([u, v]) => {
        const [x, , z] = axes.point([u, 0, v]);
        return sampleGround(x, z);
      }),
    ) + 0.5;
  const area = ring.reduce((sum, [u, v], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + u * b - a * v;
  }, 0);
  const winding = Math.sign(area);
  for (let i = 0; i < ring.length; i++) {
    const [u, v] = ring[i];
    const [a, b] = ring[(i + 1) % ring.length];
    const [x0, , z0] = axes.point([u, 0, v]);
    const [x1, , z1] = axes.point([a, 0, b]);
    const ground0 = sampleGround(x0, z0) - 0.35;
    const ground1 = sampleGround(x1, z1) - 0.35;
    const direction = [winding * (b - v), 0, winding * (u - a)];
    face(
      out,
      'stone',
      [
        [u, ground0, v],
        [a, ground1, b],
        [a, floor, b],
        [u, floor, v],
      ],
      direction,
      c.foot,
    );
    face(
      out,
      'wall',
      [
        [u, floor, v],
        [a, floor, b],
        [a, eave, b],
        [u, eave, v],
      ],
      direction,
      c.wall,
    );
  }
  return floor;
}

function molding(out, a, b, width, color, detail) {
  if (detail) beam(out, 'paint', a, b, width, width, color);
  else
    face(
      out,
      'paint',
      [a, b, [b[0], b[1] + width, b[2]], [a[0], a[1] + width, a[2]]],
      [0, 0, 1],
      color,
    );
}

function chofa(out, u, y, v, s, lod) {
  if (lod === 0) {
    face(
      out,
      'gold',
      [
        [u - 0.15 * s, y, v],
        [u + 0.15 * s, y, v],
        [u, y + 1.62 * s, v + 0.42 * s],
      ],
      [0, 0, 1],
      c.gold,
    );
    return;
  }
  const path = [
    [u, y, v - 0.17 * s],
    [u, y + 0.35 * s, v + 0.46 * s],
    [u, y + 0.85 * s, v + 0.66 * s],
    [u, y + 1.37 * s, v + 0.45 * s],
    [u, y + 1.57 * s, v + 0.21 * s],
    [u, y + 1.82 * s, v + 0.28 * s],
  ];
  const width = [0.18, 0.145, 0.108, 0.075, 0.043, 0.018];
  const arches = lod === 1 ? [0, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
  loft(
    out,
    'gold',
    arches.map((i) => {
      const [x, h, z] = path[i];
      return radialRing(h, width[i] * s, width[i] * s * 0.67, lod > 1 ? 6 : 3, [x, z]);
    }),
    c.gold,
  );
}

function gable(out, { half, eave, rise, front, ornate }, lod) {
  const ridge = eave + rise;
  const z = front + 0.034;
  face(
    out,
    'paint',
    [
      [-half, eave, z],
      [half, eave, z],
      [0, ridge, z],
    ],
    [0, 0, 1],
    ornate ? c.shadowGreen : c.wall,
  );
  for (const sign of [-1, 1]) {
    molding(
      out,
      [sign * half, eave - 0.05, z + 0.03],
      [0, ridge + 0.06, z + 0.03],
      ornate ? 0.34 : 0.27,
      ornate ? c.garnet : c.white,
      lod > 0,
    );
    if (lod > 0) {
      beam(
        out,
        'gold',
        [sign * (half - 0.21), eave + 0.12, z + 0.25],
        [0, ridge - 0.22, z + 0.21],
        0.09,
        0.103,
        c.gold,
      );
      if (lod > 1) chofa(out, sign * (half - 0.05), eave, z + 0.16, 0.52, lod);
    }
    if (ornate && lod > 1) {
      const rows = lod === 3 ? 9 : 6;
      for (let i = 1; i < rows; i++) {
        const t = i / rows;
        const x = sign * (half - 0.25) * (1 - t);
        const y = eave + rise * t;
        const curl = [
          [x, y, z + 0.22],
          [x + sign * 0.19, y + 0.27, z + 0.25],
          [x + sign * 0.06, y + 0.53, z + 0.27],
        ];
        beamPath(out, 'gold', curl, 0.071, 0.065, c.lightGold);
      }
    }
  }
  chofa(out, 0, ridge - 0.07, front, 0.9, lod);
  if (!ornate || lod < 2) return;
  const rows = lod === 3 ? 8 : 5;
  for (let row = 0; row < rows; row++) {
    const y = eave + 0.27 + ((rise - 1.04) * row) / rows;
    const width = (half - 0.68) * (1 - (y - eave) / rise);
    const count = Math.floor(width / (lod === 3 ? 0.73 : 1.04));
    for (let i = -count; i <= count; i++) {
      const x = i * (lod === 3 ? 0.73 : 1.04);
      face(
        out,
        'paint',
        [
          [x, y - 0.15, z + 0.014],
          [x + 0.26, y, z + 0.014],
          [x, y + 0.22, z + 0.014],
          [x - 0.26, y, z + 0.014],
        ],
        [0, 0, 1],
        (i + row) % 2 === 0 ? c.brass : c.leaf,
      );
    }
  }
  for (const y of [eave + 0.17, eave + 0.55]) {
    const w = half * (1 - (y - eave) / rise) - 0.39;
    beam(out, 'paint', [-w, y, z + 0.09], [w, y, z + 0.09], 0.15, 0.12, c.leaf);
    beam(out, 'gold', [-w, y + 0.09, z + 0.12], [w, y + 0.09, z + 0.12], 0.05, 0.05, c.brass);
  }
}

function roofRun(
  out,
  { half, eave, rise, front, back, ornate = true, neighbor = false, rear = false },
  lod,
) {
  // The lower break extends the eave and softens the slope below the main tiled plane.
  const ridge = eave + rise;
  const slope =
    lod === 0
      ? [
          [half, eave],
          [0, ridge],
        ]
      : [
          [half, eave],
          [half * 0.81, eave + rise * 0.105],
          [0, ridge],
        ];
  for (const side of [-1, 1]) {
    for (let i = 1; i < slope.length; i++) {
      const [x0, y0] = slope[i - 1];
      const [x1, y1] = slope[i];
      face(
        out,
        'tile',
        [
          [side * x0, y0, back],
          [side * x1, y1, back],
          [side * x1, y1, front],
          [side * x0, y0, front],
        ],
        up,
        neighbor ? c.neighboring : side > 0 ? c.roof : c.roofLight,
        ([x, y, z]) => [z, 0.67 * Math.hypot(x, y - ridge)],
      );
    }
    const x = side * half;
    if (lod > 0) {
      beam(out, 'wall', [x, eave, back], [x, eave, front], 0.215, 0.24, c.white);
      beam(
        out,
        'paint',
        [x, eave - 0.145, back],
        [x, eave - 0.145, front],
        0.109,
        0.114,
        c.roofEdge,
      );
    }
  }
  if (lod > 0)
    beam(out, 'tile', [0, ridge + 0.04, back], [0, ridge + 0.04, front], 0.27, 0.21, c.roofEdge);
  gable(out, { half, eave, rise, front, ornate }, lod);
  if (rear) {
    const reverse = oriented(out, frame([0, 0], [0, -1]));
    gable(reverse, { half, eave, rise, front: -back, ornate: false }, lod);
  }
}

function porch(out, v, y, half, lod) {
  box(out, 'wall', [-half, y - 0.29, v - 2.74], [half, y, v + 0.54], c.white);
  for (let i = 0; i < (lod === 0 ? 2 : 4); i++) {
    const x = (lod === 0 ? [-half + 0.48, half - 0.48] : [-half + 0.48, -1.33, 1.33, half - 0.48])[
      i
    ];
    box(out, 'wall', [x - 0.2, 0.48, v - 0.61], [x + 0.2, y, v - 0.19], c.white);
    if (lod > 0) {
      box(out, 'stone', [x - 0.29, 0.47, v - 0.71], [x + 0.29, 0.67, v - 0.09], c.foot);
      box(out, 'wall', [x - 0.28, y - 0.44, v - 0.7], [x + 0.28, y - 0.21, v - 0.1], c.white);
    }
  }
}

function openings(out, windows, v, lod) {
  for (const u of windows) {
    box(out, 'paint', [u - 0.54, 1.74, v], [u + 0.54, 3.99, v + 0.15], c.night);
    if (lod < 2) continue;
    beam(out, 'gold', [u, 1.72, v + 0.17], [u, 4.01, v + 0.17], 0.048, 0.075, c.brass);
    for (const x of [u - 0.55, u + 0.55])
      beam(out, 'wall', [x, 1.64, v + 0.13], [x, 4.08, v + 0.13], 0.13, 0.16, c.white);
    const crown = [
      [u - 0.59, 3.95, v + 0.13],
      [u, 4.52, v + 0.15],
      [u + 0.59, 3.95, v + 0.13],
    ];
    beamPath(out, 'gold', crown, 0.1, 0.085, c.brass);
  }
}

function steppedRings(out, slot, profile, sides, color, center = [0, 0], rotation = 0) {
  loft(
    out,
    slot,
    profile.map(([y, x, z = x]) => radialRing(y, x, z, sides, center, rotation)),
    color,
  );
}

function tower(out, lod) {
  const center = [0.72, -0.57];
  const base =
    lod === 0
      ? [
          [10.65, 2.72],
          [14.8, 3.15],
          [16.6, 4.25],
        ]
      : [
          [10.65, 2.72],
          [13.0, 3.04],
          [14.7, 3.24],
          [15.8, 3.36],
          [16.18, 4.16],
          [16.67, 4.42],
          [17.02, 3.8],
        ];
  steppedRings(out, 'paint', base, 8, c.garnet, center, Math.PI / 8);
  const profiles = [
    [
      [16.67, 4.36],
      [17.14, 4.07],
      [18.61, 2.97],
    ],
    [
      [18.43, 3.15],
      [18.77, 2.96],
      [20.07, 2.14],
    ],
    [
      [19.93, 2.29],
      [20.24, 2.11],
      [21.51, 1.48],
    ],
    [
      [21.32, 1.65],
      [21.64, 1.48],
      [22.95, 0.74],
    ],
  ].map((profile) =>
    profile.map(([height, radius]) => [height, radius * (1 - (height - 16.67) * 0.062)]),
  );
  for (const profile of profiles) {
    steppedRings(out, 'gold', profile, 8, c.gold, center, Math.PI / 8);
    if (lod === 0) continue;
    const [y, r] = profile[0];
    steppedRings(
      out,
      'paint',
      [
        [y + 0.18, r - 0.06],
        [y + 0.33, r - 0.19],
      ],
      8,
      c.night,
      center,
      Math.PI / 8,
    );
    steppedRings(
      out,
      'gold',
      [
        [y + 0.045, r + 0.02],
        [y + 0.16, r + 0.045],
      ],
      8,
      c.lightGold,
      center,
      Math.PI / 8,
    );
    if (lod < 2) continue;
    for (let i = 0; i < 8; i++) {
      const at = ((i + 0.5) * Math.PI) / 4;
      const position = (y, r) => [center[0] + r * Math.cos(at), y, center[1] - r * Math.sin(at)];
      beam(
        out,
        'gold',
        position(y + 0.33, r - 0.03),
        position(profile[2][0], profile[2][1] + 0.07),
        0.115,
        0.108,
        c.lightGold,
      );
    }
  }
  const top = [
    [22.92, 0.45],
    [23.08, 0.34],
    [23.26, 0.24],
    [23.4, 0.23],
    [23.56, 0.25],
    [23.69, 0.16],
    [23.86, 0.18],
    [24.03, 0.12],
    [24.25, 0.09],
    [core.spireHeightEstimateMeters, 0.035],
  ];
  steppedRings(
    out,
    'gold',
    lod === 0 ? [top[0], top[3], top.at(-1)] : top,
    lod > 1 ? 12 : 8,
    c.lightGold,
    center,
  );
}

function mainHall(out, lod) {
  const axes = frame(core.center, core.front);
  const local = oriented(out, axes);
  const walls = mainOutline.map((p) => axes.local(p).map((value) => value * 0.925));
  const floor = drawWallRing(local, axes, walls, core.eaveHeightMeters);
  // The four gables follow the lobes of the mapped cross rather than a symmetrical square.
  const wings = [
    { center: [1.32, 0], normal: [0, 1], half: 7.21, front: 20.11, back: 1.58, rise: 7.07 },
    { center: [0.8, 0], normal: [0, -1], half: 11.69, front: 19.92, back: 1.3, rise: 6.51 },
    {
      center: [0, -1.11],
      normal: [-0.95394, 0.3],
      half: 9.12,
      front: 24.25,
      back: 0.64,
      rise: 5.65,
    },
    { center: [0, 0.85], normal: [1, 0], half: 9.25, front: 15.81, back: 0.22, rise: 5.75 },
  ];
  for (const [i, { center, normal, half, front, back, rise }] of wings.entries()) {
    const view = oriented(local, frame(center, normal));
    const eave = core.eaveHeightMeters;
    roofRun(view, { half, eave, rise, front, back, ornate: i === 0 || lod > 1 }, lod);
    box(
      view,
      'wall',
      [-half * 0.78, eave - 0.28, back - 0.9],
      [half * 0.78, eave + 2.95, front - 4.71],
      c.white,
    );
    roofRun(
      view,
      {
        half: half * 0.86,
        eave: eave + 2.95,
        rise: rise * 0.91,
        front: front - 4.34,
        back: back - 1.02,
        ornate: i === 0,
      },
      lod,
    );
    if (lod > 1) {
      const stepFront = front - 8.1;
      box(
        view,
        'wall',
        [-half * 0.55, eave + 2.94, back - 2.3],
        [half * 0.55, eave + 5, stepFront - 0.33],
        c.white,
      );
      roofRun(
        view,
        {
          half: half * 0.63,
          eave: eave + 5,
          rise: rise * 0.72,
          front: stepFront,
          back: back - 2.4,
          ornate: false,
        },
        lod,
      );
    }
    if (i === 0) {
      porch(view, front - 0.39, eave - 0.24, half - 0.36, lod);
      box(view, 'wood', [-1.18, floor, front - 1.73], [1.18, 4.58, front - 1.32], c.wood);
      openings(view, [-3.91, 3.91], front - 1.47, lod);
      for (let step = 0; step < 3; step++) {
        const top = floor - step * 0.2;
        box(
          view,
          'stone',
          [-3.68 - step * 0.18, top - 0.53, front - 1.85],
          [3.68 + step * 0.18, top, front + 0.04 + step * 0.33],
          c.paving,
        );
      }
    }
  }
  tower(local, lod);
}

function adjoiningHall(out, lod) {
  const axes = frame(neighborHall.center, neighborHall.front);
  const local = oriented(out, axes);
  const walls = hallOutline.map((p) => axes.local(p).map((value) => value * 0.91));
  const eave = neighborHall.eaveHeightMeters;
  drawWallRing(local, axes, walls, eave);
  roofRun(
    local,
    {
      half: 10.15,
      eave,
      rise: 7.22,
      front: 16.5,
      back: -16.5,
      ornate: false,
      neighbor: true,
      rear: true,
    },
    lod,
  );
  if (lod > 0) {
    box(local, 'wall', [-7.5, eave - 0.04, -11.41], [7.5, eave + 2.84, 11.41], c.white);
    roofRun(
      local,
      {
        half: 8.1,
        eave: eave + 2.84,
        rise: 5.17,
        front: 11.74,
        back: -11.74,
        ornate: false,
        neighbor: true,
        rear: true,
      },
      lod,
    );
    openings(local, [-5.97, 0, 5.97], 14.99, lod);
    const side = oriented(local, frame([0, 0], [1, 0]));
    openings(side, [-12, -6, 0, 6, 12], 9.2, lod);
  }
}

function goldenFigure(out, lod) {
  const axes = frame(
    standingFigure.center,
    standingFigure.front,
    sampleGround(...standingFigure.center),
  );
  const local = oriented(out, axes);
  const sides = [6, 10, 20, 28][lod];
  steppedRings(
    local,
    'stone',
    [
      [-0.42, 2.97],
      [0.29, 2.97],
      [0.42, 2.79],
    ],
    8,
    c.foot,
  );
  steppedRings(
    local,
    'paint',
    [
      [0.37, 2.78],
      [0.76, 2.76],
      [0.92, 2.45],
      [1.32, 2.42],
      [1.43, 2.22],
      [1.76, 2.21],
    ],
    sides,
    c.blue,
  );
  if (lod > 0)
    for (const [y, r] of [
      [0.76, 2.75],
      [1.3, 2.46],
      [1.75, 2.2],
    ]) {
      steppedRings(
        local,
        'paint',
        [
          [y - 0.085, r],
          [y - 0.016, r + 0.033],
        ],
        sides,
        c.garnet,
      );
      steppedRings(
        local,
        'gold',
        [
          [y - 0.016, r + 0.033],
          [y + 0.055, r - 0.02],
        ],
        sides,
        c.lightGold,
      );
    }
  steppedRings(
    local,
    'gold',
    [
      [1.76, 1.83],
      [2.08, 1.39],
      [2.36, 1.4],
      [2.63, 1.84],
      [2.9, 1.93],
      [3.04, 1.55],
    ],
    sides,
    c.gold,
  );
  if (lod > 1)
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      sphere(
        local,
        'gold',
        [1.68 * Math.cos(a), 2.72, -1.68 * Math.sin(a)],
        [0.24, 0.26, 0.24],
        c.lightGold,
        6,
        4,
      );
    }
  const garment = [
    [3, 0.76, 0.51],
    [3.56, 1.01, 0.55],
    [4.13, 0.83, 0.45],
    [5.42, 0.72, 0.46],
    [6.2, 0.89, 0.5],
    [6.85, 0.96, 0.58],
    [7.25, 0.66, 0.47],
    [7.49, 0.41, 0.39],
  ];
  steppedRings(
    local,
    'gold',
    lod === 0 ? garment.filter((_, i) => i % 2 === 0 || i === 7) : garment,
    Math.min(sides, 20),
    c.gold,
  );
  const head = [0, 8.03, 0.13];
  sphere(
    local,
    'gold',
    head,
    [0.49, 0.65, 0.48],
    c.lightGold,
    lod === 0 ? 8 : Math.min(sides, 20),
    [5, 6, 8, 10][lod],
  );
  const tip = standingFigure.heightWithPedestalEstimateMeters;
  steppedRings(
    local,
    'gold',
    [
      [8.46, 0.431],
      [8.67, 0.366],
      [8.87, 0.227],
      [tip, 0.07],
    ],
    lod === 0 ? 6 : Math.min(sides, 16),
    c.brass,
    [0, 0.043],
  );
  const arms = [
    [
      [-0.73, 6.69, 0.21],
      [-1.09, 5.84, 0.7],
      [-1.69, 5.31, 1.35],
    ],
    [
      [0.72, 6.67, 0.15],
      [1.09, 5.82, 0.51],
      [1.14, 5.04, 0.73],
    ],
  ];
  for (const [upper, elbow, hand] of arms) {
    beam(local, 'gold', upper, elbow, 0.33, 0.35, c.gold);
    beam(local, 'gold', elbow, hand, 0.215, 0.268, c.lightGold);
    if (lod > 0) {
      sphere(local, 'gold', elbow, [0.19, 0.22, 0.17], c.gold, 8, 4);
      sphere(local, 'gold', hand, [0.15, 0.2, 0.19], c.lightGold, 8, 4);
    }
  }
  if (lod > 1) {
    sphere(local, 'gold', [0, 8.01, 0.565], [0.105, 0.14, 0.139], c.lightGold, 8, 5);
    for (const x of [-0.465, 0.465])
      sphere(local, 'gold', [x, 7.93, 0.142], [0.088, 0.21, 0.104], c.gold, 8, 5);
    for (const shift of [-0.35, -0.15, 0.05, 0.25]) {
      beamPath(
        local,
        'gold',
        [
          [0.62 + shift, 7.08, 0.479],
          [0.36 + shift, 6.63, 0.561],
          [-0.09 + shift, 6.1, 0.511],
          [-0.49 + shift, 5.83, 0.386],
        ],
        0.063,
        0.052,
        c.goldShade,
      );
      beamPath(
        local,
        'gold',
        [
          [-0.56 + shift, 5.5, 0.401],
          [-0.46 + shift, 4.66, 0.447],
          [-0.62 + shift, 3.72, 0.531],
        ],
        0.044,
        0.047,
        c.lightGold,
      );
    }
  }
}

function draw(out, lod) {
  mainHall(out, lod);
  adjoiningHall(out, lod);
  goldenFigure(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-2, 45, 11];
const lookAt = [-44, 9.6, 67];
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
    'Wat Bang Phra in Nakhon Pathom with its tiered red roofs, gilded tower, ornamented gables and standing golden figure.',
  camera,
  lookAt,
  sunDirection: [45, 94, -117],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.54,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'porch-and-gilded-tower', position: [7, 7, 33], lookAt: [-35, 10.2, 72] },
    {
      name: 'standing-figure-and-lotus-plinth',
      position: [-0.2, 4.5, 55],
      lookAt: [-22, 6.4, 71.7],
    },
    {
      name: 'four-porch-roof-and-adjoining-hall',
      position: [-122, 39, 109],
      lookAt: [-52, 10.6, 69],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.1, surfaces },
      street: { export: 'street', errorMeters: 0.35, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independently modeled from the public-domain photograph published by Qualla, mapped roof outlines and original Terrarium elevation samples.',
};
