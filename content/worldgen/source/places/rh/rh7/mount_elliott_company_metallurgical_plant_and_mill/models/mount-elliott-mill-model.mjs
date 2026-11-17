/** Archaeological remains of the Cloncurry electrolytic mill. Units are meters. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const { oreCrusher, roastingFurnace, leaching, electrolyticWorks, laboratory } = plan.section;

const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.96, metallic: 0 },
  adobe: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  earth: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.99, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.24 },
};
const tones = Object.fromEntries(
  Object.entries({
    concrete: 'a29a87',
    clean: 'b6ab96',
    aggregate: '837d6d',
    silt: '9d825c',
    stain: '91816b',
    adobe: 'a98661',
    render: 'a69980',
    brick: '936b59',
    earth: 'ae885b',
    cut: '916a47',
    gravel: 'a58a6c',
    iron: '644635',
    oldIron: '7b543b',
    seam: '534639',
  }).map(([name, color]) => [name, rgb(color)]),
);

function ground(x, z) {
  const [originX, originZ] = terrain.origin;
  const u = (x - originX) / terrain.stepMeters;
  const v = (z - originZ) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  const across = (row) => row[i] + (row[i + 1] - row[i]) * (u - i);
  return across(a) + (across(b) - across(a)) * (v - j) - terrain.modelDatumElevationMeters;
}

function face(out, slot, vertices, toward, color = tones[slot]) {
  let points = vertices;
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

const corners = ([x0, x1, z0, z1]) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const up = [0, 1, 0];
const to3d = ([x, z], y) => [x, y, z];
const atGround = ([x, z]) => [x, ground(x, z) - 0.17, z];
const block = (out, slot, [x0, x1, z0, z1], bottom, top, color = tones[slot]) =>
  box(out, slot, [x0, bottom, z0], [x1, top, z1], color);
function axisSamples(start, end, origin) {
  const step = terrain.stepMeters;
  const points = [start, end];
  for (let p = origin + (Math.floor((start - origin) / step) + 1) * step; p < end; p += step)
    points.push(p);
  return points;
}

function padLevel([x0, x1, z0, z1]) {
  const xs = axisSamples(x0, x1, terrain.origin[0]);
  const zs = axisSamples(z0, z1, terrain.origin[1]);
  return Math.max(...xs.flatMap((x) => zs.map((z) => ground(x, z)))) + 0.17;
}

function slabs(out, outline, top, slot = 'concrete', color = tones[slot]) {
  face(
    out,
    slot,
    outline.map((p, i) => to3d(p, top[i])),
    up,
    color,
  );
  for (const [i, a] of outline.entries()) {
    const j = (i + 1) % outline.length;
    const b = outline[j];
    face(
      out,
      slot,
      [atGround(a), atGround(b), to3d(b, top[j]), to3d(a, top[i])],
      [b[1] - a[1], 0, a[0] - b[0]],
      color,
    );
  }
}

function slab(out, bounds, y, slot = 'concrete', color = tones[slot]) {
  slabs(out, corners(bounds), [y, y, y, y], slot, color);
}

/** Mitered tank walls with an open center and exposed floor. */
function rectangularTank(out, bounds, y, height, thickness, lod, slot = 'concrete') {
  const [x0, x1, z0, z1] = bounds;
  const outer = corners(bounds);
  const inner = corners([x0 + thickness, x1 - thickness, z0 + thickness, z1 - thickness]);
  const top = y + height;
  for (const [i, a] of outer.entries()) {
    const j = (i + 1) % outer.length,
      b = outer[j],
      c = inner[j],
      d = inner[i];
    const normal = [b[1] - a[1], 0, a[0] - b[0]];
    const lower = lod >= 2 ? y + 0.39 * height : top;
    face(
      out,
      slot,
      [atGround(a), atGround(b), to3d(b, lower), to3d(a, lower)],
      normal,
      lod >= 2 ? tones.stain : tones[slot],
    );
    if (lod >= 2)
      face(out, slot, [to3d(a, lower), to3d(b, lower), to3d(b, top), to3d(a, top)], normal);
    face(
      out,
      slot,
      [to3d(d, y), to3d(c, y), to3d(c, top), to3d(d, top)],
      normal.map((v) => -v),
      tones.aggregate,
    );
    face(out, slot, [to3d(a, top), to3d(b, top), to3d(c, top), to3d(d, top)], up, tones.clean);
  }
  face(
    out,
    slot,
    inner.map((p) => to3d(p, y)),
    up,
    tones.silt,
  );
}

function profile(out, slot, center, rings, segments, color = tones[slot], cap = true) {
  loft(
    out,
    slot,
    rings.map(([y, r]) => radialRing(y, r, r, segments, center)),
    color,
    { cap },
  );
}

function circularTank(out, [x, z], radius, height, lod) {
  const n = [6, 12, 22, 32][lod];
  const y = padLevel([x - radius, x + radius, z - radius, z + radius]);
  const rim = y + height,
    inner = radius - 0.37;
  const point = (i, r, h) => {
    const a = (i * 2 * Math.PI) / n;
    return [x + r * Math.cos(a), h, z + r * Math.sin(a)];
  };
  for (let i = 0; i < n; i++) {
    const a = point(i, radius, rim),
      b = point(i + 1, radius, rim),
      c = point(i + 1, inner, rim),
      d = point(i, inner, rim);
    const normal = [a[0] + b[0] - 2 * x, 0, a[2] + b[2] - 2 * z];
    const low = ([xx, , zz]) => [xx, ground(xx, zz) - 0.23, zz];
    if (lod >= 2) {
      const p = point(i, radius, y + 0.62),
        q = point(i + 1, radius, y + 0.62);
      face(
        out,
        'concrete',
        [low(a), low(b), q, p],
        normal,
        i % 5 === 0 ? tones.aggregate : tones.stain,
      );
      face(out, 'concrete', [p, q, b, a], normal);
    } else face(out, 'concrete', [low(a), low(b), b, a], normal);
    face(out, 'concrete', [a, b, c, d], up, tones.clean);
    face(
      out,
      'concrete',
      [d, c, point(i + 1, inner, y), point(i, inner, y)],
      normal.map((v) => -v),
      tones.aggregate,
    );
    face(out, 'concrete', [[x, y, z], point(i, inner, y), point(i + 1, inner, y)], up, tones.silt);
  }
  if (lod >= 2) {
    const source = [x + radius + 0.01, y + 0.49, z];
    beam(out, 'iron', source, [source[0] + 0.49, source[1], source[2]], 0.21, 0.21, tones.oldIron);
  }
}

function retainingSpur(out, base, height, depth, width, outward, along) {
  const to = (u, d, y) => [
    base[0] + along[0] * u + outward[0] * d,
    y,
    base[1] + along[1] * u + outward[1] * d,
  ];
  const bottom = (u, d) => {
    const [x, , z] = to(u, d, 0);
    return ground(x, z) - 0.17;
  };
  const t = height + 0.04;
  const a = to(-width / 2, 0, t),
    b = to(width / 2, 0, t);
  const c = to(width / 2, depth, t - 1.3),
    d = to(-width / 2, depth, t - 1.3);
  face(out, 'concrete', [a, b, c, d], up, tones.clean);
  face(
    out,
    'concrete',
    [
      d,
      c,
      to(width / 2, depth, bottom(width / 2, depth)),
      to(-width / 2, depth, bottom(-width / 2, depth)),
    ],
    [outward[0], 0, outward[1]],
    tones.stain,
  );
  for (const sign of [-1, 1]) {
    const u = (sign * width) / 2;
    face(
      out,
      'concrete',
      [to(u, 0, t), to(u, depth, t - 1.3), to(u, depth, bottom(u, depth)), to(u, 0, bottom(u, 0))],
      [along[0] * sign, 0, along[1] * sign],
    );
  }
}

function leachingArea(out, lod) {
  const [x, z] = leaching.squareCenter,
    half = leaching.squareSide / 2;
  const bounds = [x - half, x + half, z - half, z + half],
    y = padLevel(bounds);
  rectangularTank(out, bounds, y, leaching.squareHeight, 0.44, lod);
  const count = lod === 0 ? 1 : 4;
  for (let i = 0; i < count; i++) {
    const p = -half + ((i + 0.5) * 2 * half) / count;
    for (const sign of [-1, 1]) {
      retainingSpur(out, [x + sign * half, z + p], y + 2.52, 1.28, 0.78, [sign, 0], [0, 1]);
      retainingSpur(out, [x + p, z + sign * half], y + 2.52, 1.28, 0.78, [0, sign], [1, 0]);
    }
  }
  for (const center of leaching.circularCenters)
    circularTank(out, center, leaching.circularDiameter / 2, leaching.circularHeight, lod);
}

function strip(out, a, b, width, lift, slot, color = tones[slot]) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const hx = ((-dz / len) * width) / 2,
    hz = ((dx / len) * width) / 2;
  const p = [
    [a[0] - hx, a[1] - hz],
    [b[0] - hx, b[1] - hz],
    [b[0] + hx, b[1] + hz],
    [a[0] + hx, a[1] + hz],
  ];
  const y = p.map(([x, z]) => ground(x, z) + lift);
  face(
    out,
    slot,
    p.map((q, i) => to3d(q, y[i])),
    up,
    color,
  );
  for (const [i, first] of p.entries()) {
    const j = (i + 1) % p.length,
      last = p[j];
    face(
      out,
      slot,
      [atGround(first), atGround(last), to3d(last, y[j]), to3d(first, y[i])],
      [last[1] - first[1], 0, first[0] - last[0]],
      color,
    );
  }
}

function flueSegment(out, points, lift, lod, outerSlot) {
  for (const [i, a] of points.slice(0, -1).entries()) {
    const b = points[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const shift = (p, d) => [p[0] - (dz * d) / length, p[1] + (dx * d) / length];
    for (const w of [-0.57, 0.57]) strip(out, shift(a, w), shift(b, w), 0.36, lift, outerSlot);
    if (lod >= 1) strip(out, a, b, 0.76, 0.21, 'brick', tones.aggregate);
  }
}

function chimneyBase(out, [x, z], lod) {
  const y = padLevel([x - 1.95, x + 1.95, z - 1.95, z + 1.95]);
  slab(out, [x - 1.98, x + 1.98, z - 1.98, z + 1.98], y + 0.22);
  if (lod === 0) {
    profile(
      out,
      'iron',
      [x, z],
      [
        [y + 0.2, 1.38],
        [y + 1.51, 0.82],
      ],
      5,
    );
    return;
  }
  const n = [7, 10, 16, 24][lod];
  profile(
    out,
    'concrete',
    [x, z],
    [
      [y + 0.18, 1.62],
      [y + 0.6, 1.35],
      [y + 0.91, 1.1],
    ],
    n,
  );
  profile(
    out,
    'iron',
    [x, z],
    [
      [y + 0.87, 1.02],
      [y + 1.06, 0.93],
      [y + 1.51, 0.82],
    ],
    n,
    tones.iron,
    false,
  );
  profile(
    out,
    'iron',
    [x, z],
    [
      [y + 1.51, 0.82],
      [y + 1.48, 0.68],
      [y + 0.95, 0.63],
    ],
    n,
    tones.seam,
    false,
  );
  if (lod >= 2)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const center = [x + 1.43 * Math.cos(angle), z + 1.43 * Math.sin(angle)];
      profile(
        out,
        'iron',
        center,
        [
          [y + 0.53, 0.11],
          [y + 0.87, 0.1],
        ],
        5,
        tones.oldIron,
      );
    }
}

function verticalBoiler(out, [x, z], lod) {
  const groundY = padLevel([x - 1.12, x + 1.12, z - 1.12, z + 1.12]);
  const center = [x, z];
  if (lod === 0) {
    profile(
      out,
      'iron',
      center,
      [
        [groundY - 0.12, 1.06],
        [groundY + 2.4, 1.06],
        [groundY + 2.96, 0.37],
      ],
      5,
    );
    return;
  }
  const n = [7, 12, 20, 28][lod];
  profile(
    out,
    'iron',
    center,
    [
      [groundY - 0.12, 0.94],
      [groundY + 0.18, 1.07],
      [groundY + 2.35, 1.07],
      [groundY + 2.63, 0.87],
      [groundY + 2.73, 0.48],
    ],
    n,
    tones.iron,
  );
  profile(
    out,
    'iron',
    center,
    [
      [groundY + 2.65, 0.31],
      [groundY + 3.18, 0.27],
    ],
    n,
    tones.oldIron,
  );
  if (lod >= 1)
    for (const h of [0.32, 1.18, 2.18])
      profile(
        out,
        'iron',
        center,
        [
          [groundY + h - 0.034, 1.083],
          [groundY + h + 0.046, 1.083],
        ],
        n,
        tones.seam,
        false,
      );
  if (lod >= 2) {
    block(
      out,
      'iron',
      [x - 0.29, x + 0.29, z + 0.94, z + 1.19],
      groundY + 0.45,
      groundY + 1.22,
      tones.oldIron,
    );
    beam(
      out,
      'iron',
      [x + 0.84, groundY + 1.96, z],
      [x + 1.7, groundY + 1.96, z],
      0.21,
      0.21,
      tones.oldIron,
    );
    beam(
      out,
      'iron',
      [x + 1.67, groundY + 1.96, z],
      [x + 1.67, groundY + 1.44, z],
      0.2,
      0.2,
      tones.oldIron,
    );
  }
}

function plinth(out, [x, z, w, d, h], floor, slot = 'concrete', color = tones[slot]) {
  block(out, slot, [x - w / 2, x + w / 2, z - d / 2, z + d / 2], floor, floor + h, color);
}

function foundationLoop(out, [x0, x1, z0, z1], floor, heights, rim = 0.45, slot = 'concrete') {
  const walls = [
    [x0, x1, z0, z0 + rim],
    [x0, x1, z1 - rim, z1],
    [x0, x0 + rim, z0 + rim, z1 - rim],
    [x1 - rim, x1, z0 + rim, z1 - rim],
  ];
  for (const [i, bounds] of walls.entries()) {
    block(
      out,
      slot,
      bounds,
      floor - 0.045,
      floor + heights[i],
      i === 1 ? tones.stain : tones[slot],
    );
  }
}

function rubble(out, x, z, y, size, seed, slot = 'earth') {
  const height = size * (0.32 + (seed % 4) * 0.08);
  const rim = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5 + (seed % 12) * 0.33;
    const r = size * (0.43 + ((seed + 3 * i) % 6) * 0.045);
    return [x + r * Math.cos(a), z + r * Math.sin(a)];
  });
  const upper = rim.map(([xx, zz], i) => [
    x + (xx - x) * 0.67,
    y + height * (0.68 + ((seed + i * 3) % 5) * 0.09),
    z + (zz - z) * 0.63,
  ]);
  const tip = [x + 0.049 * size, y + height * 1.09, z - 0.063 * size];
  for (const [i, a] of rim.entries()) {
    const j = (i + 1) % rim.length,
      b = rim[j];
    const normal = [a[0] + b[0] - 2 * x, 0, a[1] + b[1] - 2 * z];
    face(
      out,
      slot,
      [to3d(a, y - 0.075), to3d(b, y - 0.075), upper[j], upper[i]],
      normal,
      (seed + i) % 3 === 0 ? tones.gravel : tones[slot],
    );
    face(
      out,
      slot,
      [tip, upper[i], upper[j]],
      up,
      (seed + i) % 4 === 0 ? tones.stain : tones[slot],
    );
  }
}

/** Small surviving iron flotation unit on the south grounds. */
function flotation(out, [x, z], y, lod) {
  const body = [x - 1.45, x + 1.45, z - 0.8, z + 0.8];
  block(out, 'iron', [x - 1.55, x + 1.55, z - 0.93, z + 0.93], y, y + 0.17, tones.seam);
  rectangularTank(out, body, y + 0.16, 0.82, 0.13, lod, 'iron');
  if (lod >= 1) {
    for (const xx of [x - 0.86, x + 0.61]) {
      const center = [xx, z];
      profile(
        out,
        'iron',
        center,
        [
          [y + 0.23, 0.41],
          [y + 0.26, 0.44],
          [y + 0.32, 0.36],
        ],
        8,
      );
      beam(out, 'iron', [xx, y + 0.29, z], [xx, y + 1.06, z], 0.105, 0.105, tones.oldIron);
      beam(
        out,
        'iron',
        [xx, y + 1.03, z - 0.88],
        [xx, y + 1.03, z + 0.88],
        0.19,
        0.22,
        tones.oldIron,
      );
    }
  }
}

function southGroup(out, lod) {
  const pad = oreCrusher.pad;
  const y = padLevel(pad);
  slab(out, pad, y, 'concrete', tones.stain);
  for (const [i, foundation] of oreCrusher.foundations.entries()) {
    slab(out, foundation, y + 0.075);
    if (lod) foundationLoop(out, foundation, y + 0.077, [0.36, 0.52, 0.58, 0.28], i ? 0.54 : 0.67);
  }
  for (const tank of oreCrusher.tanks) {
    rectangularTank(out, tank, padLevel(tank), 0.93, 0.28, lod);
  }
  const ramp = oreCrusher.ramp;
  const approach = ground((ramp[2][0] + ramp[3][0]) / 2, ramp[2][1]) + 0.15;
  const top = Math.max(y + oreCrusher.rampRise, approach + 0.75);
  const deck = [
    to3d(ramp[0], top),
    to3d(ramp[1], top),
    to3d(ramp[2], approach),
    to3d(ramp[3], approach),
  ];
  face(out, 'earth', deck, up);
  for (const [i, j, sign] of [
    [0, 3, -1],
    [1, 2, 1],
  ]) {
    const [a, b] = [ramp[i], ramp[j]];
    const toe = atGround([a[0] + sign * 2.7, a[1] - 1.05]);
    const end = atGround([b[0] + sign * 0.63, b[1] + 0.59]);
    face(out, 'earth', [deck[i], deck[j], end, toe], [sign, 0.8, 0], tones.cut);
    face(out, 'earth', [deck[i], toe, atGround(a)], [0, 0, -1], tones.cut);
    face(out, 'earth', [deck[j], atGround(b), end], [0, 0, 1], tones.cut);
  }
  face(
    out,
    'earth',
    [deck[0], deck[1], atGround(ramp[1]), atGround(ramp[0])],
    [0, 0, -1],
    tones.cut,
  );
  face(
    out,
    'earth',
    [deck[3], atGround(ramp[3]), atGround(ramp[2]), deck[2]],
    [0, 0, 1],
    tones.cut,
  );
  const [d0, d1, d2, d3] = oreCrusher.dump;
  const midX = (d0 + d1) / 2,
    midZ = (d2 + d3) / 2;
  if (lod >= 1) {
    for (const [i, [x, z, w]] of [
      [midX - 1, midZ + 2, 11],
      [midX + 3, midZ - 2, 9],
      [midX - 3, midZ - 4, 6],
      [midX + 4, midZ + 4, 4],
    ].entries()) {
      rubble(out, x, z, ground(x, z) - 0.12, w, 3 + i * 5);
    }
  } else rubble(out, midX, midZ, ground(midX, midZ) - 0.17, 12, 5);
  flotation(out, [36, 74], y + 0.03, lod);
  if (lod >= 2) {
    for (const [i, [x, z, w, d, h]] of [
      [9, 82, 1.3, 2.7, 0.65],
      [34, 88, 1.8, 1.1, 0.38],
      [18, 64, 3.3, 2.0, 0.54],
      [25, 64, 3.3, 2.0, 0.52],
      [31, 65, 1.3, 1.4, 0.43],
    ].entries())
      plinth(out, [x, z, w, d, h], y + 0.08, 'concrete', i % 2 ? tones.stain : tones.concrete);
    for (let i = 0; i < 9; i++) {
      const x = 43 + (i % 3) * 3.1,
        z = 90 + Math.floor(i / 3) * 3.9;
      rubble(out, x, z, ground(x, z) - 0.02, 0.9 + 0.17 * (i % 3), 22 + i);
    }
  }
}

function furnaceGroup(out, lod) {
  const y = padLevel(roastingFurnace.pad);
  slab(out, roastingFurnace.pad, y);
  const [x, z] = roastingFurnace.center,
    r = roastingFurnace.furnaceDiameter / 2;
  profile(
    out,
    'concrete',
    [x, z],
    [
      [y - 0.035, r + 0.48],
      [y + 0.18, r + 0.48],
      [y + 0.52, r + 0.18],
    ],
    [8, 12, 20, 30][lod],
  );
  profile(
    out,
    'brick',
    [x, z],
    [
      [y + 0.51, r * 0.83],
      [y + 0.93, r * 0.81],
      [y + 0.97, r * 0.72],
    ],
    [8, 12, 20, 28][lod],
    tones.brick,
    false,
  );
  profile(
    out,
    'brick',
    [x, z],
    [
      [y + 0.97, r * 0.72],
      [y + 0.57, r * 0.68],
    ],
    [8, 12, 20, 28][lod],
    tones.aggregate,
    false,
  );
  for (const dx of [-4.5, 4.5]) {
    for (const dz of [-4, 4]) plinth(out, [x + dx, z + dz, 1.85, 2.1, 0.65], y);
  }
  flueSegment(out, roastingFurnace.flue, 0.82, lod, 'concrete');
  chimneyBase(out, roastingFurnace.chimney, lod);
  verticalBoiler(out, roastingFurnace.verticalBoiler, lod);
  rectangularTank(out, roastingFurnace.tank, padLevel(roastingFurnace.tank), 1.0, 0.32, lod);
  if (lod >= 2) {
    for (let i = 0; i < 7; i++) {
      const xx = x - 8 + i * 3.1,
        zz = z + 8.6 - ((i * 3) % 4) * 0.26;
      rubble(out, xx, zz, y, 0.53 + 0.1 * (i % 4), 53 + i, 'concrete');
    }
  }
}

function northGroup(out, lod) {
  const pad = electrolyticWorks.floorPad;
  const y = padLevel(pad);
  slab(out, pad, y, 'concrete', tones.clean);
  foundationLoop(out, pad, y, [0.42, 0.48, 0.17, 0.44], 0.42);
  const power = electrolyticWorks.powerPad;
  const yy = padLevel(power);
  slab(out, power, yy, 'concrete', tones.stain);
  if (lod) foundationLoop(out, power, yy, [0.38, 0.29, 0.63, 0.42], 0.38);
  const half = Math.sqrt(electrolyticWorks.tankArea) / 2;
  for (const [x, z] of electrolyticWorks.tankCenters) {
    const bounds = [x - half, x + half, z - half, z + half];
    rectangularTank(out, bounds, padLevel(bounds), electrolyticWorks.tankDepth, 0.28, lod);
  }
  flueSegment(out, electrolyticWorks.flue, 1.0, lod, 'brick');
  chimneyBase(out, electrolyticWorks.chimney, lod);
  if (lod) {
    for (const x of [-20, -14, -8, -2]) {
      plinth(out, [x, -131, 2.45, 1.52, 0.43], y);
      plinth(out, [x, -138, 2.45, 1.52, 0.39], y, 'concrete', tones.stain);
    }
    plinth(out, [16, -148, 6.52, 4.9, 0.58], yy);
  }
}

function laboratoryGroup(out, lod) {
  const [x0, x1, z0, z1] = laboratory.foundation;
  const y = padLevel(laboratory.foundation);
  slab(out, laboratory.foundation, y, 'earth', tones.silt);
  block(out, 'adobe', [x0, x1, z0, z0 + 0.59], y - 0.09, y + 0.82);
  block(out, 'adobe', [x0, x0 + 0.59, z0 + 0.59, z1 - 0.74], y - 0.08, y + 0.59);
  block(out, 'adobe', [x1 - 0.64, x1, z0 + 0.59, z1 - 0.74], y - 0.08, y + 0.48);
  for (const [a, b] of [
    [x0, laboratory.center[0] - 0.73],
    [laboratory.center[0] + 0.73, x1],
  ]) {
    block(out, 'adobe', [a, b, z1 - 0.74, z1], y - 0.09, y + 0.46);
  }
  if (lod >= 1) {
    block(
      out,
      'adobe',
      [x0 + 0.59, x1 - 0.64, z0 + 0.58, z0 + 0.625],
      y + 0.14,
      y + 0.65,
      tones.render,
    );
    block(
      out,
      'adobe',
      [x1 - 0.659, x1 - 0.64, z0 + 0.72, z1 - 0.8],
      y + 0.08,
      y + 0.36,
      tones.render,
    );
    for (const [i, [xx, zz, w]] of [
      [x0 + 0.7, z0 + 1.1, 0.61],
      [x0 + 2.5, z0 + 0.67, 0.43],
      [x1 - 1.57, z1 - 0.82, 0.8],
      [x1 - 2.0, z1 - 1.36, 0.63],
    ].entries()) {
      rubble(out, xx, zz, y, w, 15 + i, 'adobe');
    }
  }
  if (lod >= 2) {
    for (let i = 0; i < 6; i++) {
      const a = x0 + 0.76 + i * 0.91;
      block(
        out,
        'adobe',
        [a, a + 0.64, z0 - 0.013, z0 + 0.035],
        y + 0.19,
        y + 0.35,
        i % 2 ? tones.render : tones.adobe,
      );
    }
  }
}

function build(out, lod) {
  southGroup(out, lod);
  furnaceGroup(out, lod);
  leachingArea(out, lod);
  northGroup(out, lod);
  laboratoryGroup(out, lod);
}

export const millSkyline = (out) => build(out, 0);
export const millDistrict = (out) => build(out, 1);
export const millStreet = (out) => build(out, 2);
export const millCloseup = (out) => build(out, 3);

const recipe = 'mount-elliott-mill-model.mjs';
const camera = [149, 115, 185];
const lookAt = [-1, 1, -21];
const terrainFixture = {
  descriptor: 'terrain-review.terrain.json',
  heightmap: 'terrain-review.height.png',
};
export const millModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  category: 'industrial',
  build: millCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Surviving concrete vats, industrial foundations, flues and the low assay laboratory remains of the Cloncurry electrolytic copper treatment works.',
  camera,
  lookAt,
  sunDirection: [-24, 45, 19],
  embeddedCanonicalGraphs: Object.values(surfaces).map(({ graph }) => graph),
  mediumFiContext: {
    scale: 1.65,
    cameraYaw: 0.64,
    groundY: 0,
    focus: { center: [-1, 1, -21] },
    terrain: terrainFixture,
  },
  qaCameras: [
    { name: 'original-ground-and-five-groups', position: [154, 125, 184], lookAt: [-4, 1, -19] },
    { name: 'square-and-circular-leaching-vats', position: [-85, 26, 50], lookAt: [-27, 1, 0] },
    { name: 'south-ramp-and-furnace-foundations', position: [82, 32, 124], lookAt: [20, 4, 62] },
    { name: 'rendered-flue-and-north-tanks', position: [42, 14, -106], lookAt: [-3, -1.7, -147] },
    { name: 'adobe-laboratory-and-boiler', position: [50, 20, -89], lookAt: [24, 0, -51] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `works-${reviewLod}`,
    position: [142, 86, 163],
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'millSkyline',
    errorMeters: 1.16,
    surfaces,
    authoredLevels: {
      district: { export: 'millDistrict', errorMeters: 0.54, surfaces },
      street: { export: 'millStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'millCloseup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by Queensland Government written and GIS records, OpenStreetMap railway geography (ODbL), and openly attributed Terrarium elevations.',
};
