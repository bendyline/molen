/** Adelaide Gaol's half-decagonal prison, Georgian entrance and 1879 cell block. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const ground = read('terrain-grid.json');
const mapped = new Map(
  read('map-frame.json').features.map(({ id, points }) => [Number(id.slice(4)), points]),
);
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const front = [0, 0, 1];
const colors = Object.fromEntries(
  Object.entries({
    brick: 'a46b51',
    red: 'a36249',
    stone: 'b5a188',
    slate: '737374',
    lime: 'c1ae92',
    quarry: 'a09685',
    pale: 'd0bd9b',
    mortar: 'b89e7e',
    blueStone: '858488',
    white: 'e5e2d5',
    dark: '525451',
    window: '627171',
    roof: '7a7774',
    gold: 'c2a06c',
    sign: '6a604c',
    glass: '687979',
    office: 'c4b6a2',
    tin: 'a2a4a2',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  quarry: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.06 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.07 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  shade: { slot: 'window', localRef: palette, roughness: 0.83, metallic: 0 },
};
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
const position = ([x, z], height) => [x, height, z];
const length = ([x, z], [a, b]) => Math.hypot(a - x, b - z);
const center = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const outline = (id) => mapped.get(id).slice(0, -1);
const signOf = (ring) =>
  Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [nextX, nextZ] = ring[(i + 1) % ring.length];
      return sum + x * nextZ - z * nextX;
    }, 0),
  );

function groundAt(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters;
  const v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  return (
    mix(
      mix(ground.heightsMeters[j][i], ground.heightsMeters[j][i + 1], u - i),
      mix(ground.heightsMeters[j + 1][i], ground.heightsMeters[j + 1][i + 1], u - i),
      v - j,
    ) - ground.modelDatumElevationMeters
  );
}

function frame([x, z], normal) {
  const [nx, nz] = normal.map((value) => value / Math.hypot(...normal));
  return {
    point: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    direction: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
    local: ([a, b]) => [(a - x) * nz - (b - z) * nx, (a - x) * nx + (b - z) * nz],
  };
}

function oriented(out, axes) {
  return {
    addQuad(part, ref, vertices, normal, uv, color) {
      out.addQuad(
        part,
        ref,
        vertices.map((p) => axes.point(...p)),
        axes.direction(normal),
        uv,
        color,
      );
    },
    addConvexPolygon(part, ref, vertices, normal, uv, color) {
      out.addConvexPolygon(
        part,
        ref,
        vertices.map((p) => axes.point(...p)),
        axes.direction(normal),
        uv,
        color,
      );
    },
  };
}

function face(out, slot, points, toward, color) {
  const n = normalFor(...points);
  const dot = n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2];
  out.addConvexPolygon(
    slot,
    palette,
    points,
    dot < 0 ? n.map((v) => -v) : n,
    ([x, y, z]) => [x - z, y],
    color,
  );
}

function panel(out, slot, x, y, z, w, h, color) {
  quad(
    out,
    slot,
    [
      [x, y, z],
      [x + w, y, z],
      [x + w, y + h, z],
      [x, y + h, z],
    ],
    front,
    color,
  );
}

function roof(out, minX, maxX, minZ, maxZ, h, rise, pitchedEnds, slot = 'slate') {
  const ridgeY = h + rise;
  const inset = pitchedEnds ? Math.min(2.3, (maxX - minX) * 0.21) : 0;
  const p = [
    [minX, h, maxZ],
    [maxX, h, maxZ],
    [maxX, h, minZ],
    [minX, h, minZ],
  ];
  const r = [
    [minX + inset, ridgeY, (minZ + maxZ) / 2],
    [maxX - inset, ridgeY, (minZ + maxZ) / 2],
  ];
  face(out, slot, [p[0], p[1], r[1], r[0]], up, colors.roof);
  face(out, slot, [p[2], p[3], r[0], r[1]], up, colors.slate);
  face(
    out,
    pitchedEnds ? slot : 'brick',
    [p[3], p[0], r[0]],
    pitchedEnds ? up : [-1, 0, 0],
    pitchedEnds ? colors.slate : colors.brick,
  );
  face(
    out,
    pitchedEnds ? slot : 'brick',
    [p[1], p[2], r[1]],
    pitchedEnds ? up : [1, 0, 0],
    pitchedEnds ? colors.slate : colors.brick,
  );
}

function wallShell(out, ring, roofY, slot, color) {
  const sign = signOf(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const normal = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])];
    face(
      out,
      slot,
      [
        position(a, groundAt(...a) - 0.55),
        position(b, groundAt(...b) - 0.55),
        position(b, roofY),
        position(a, roofY),
      ],
      normal,
      color,
    );
  }
}

function edge(a, b, sign = 1) {
  return frame(blend(a, b, 0.5), [sign * (b[1] - a[1]), sign * (a[0] - b[0])]);
}

function archPanel(out, x, y, depth, width, spring, lod, color) {
  const r = width / 2;
  const count = [5, 8, 12, 19][lod];
  panel(out, 'shade', x - r, y, depth, width, spring, color);
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    face(
      out,
      'shade',
      [
        [x, y + spring, depth],
        [x + r * Math.cos(a), y + spring + r * Math.sin(a), depth],
        [x + r * Math.cos(b), y + spring + r * Math.sin(b), depth],
      ],
      front,
      color,
    );
  }
}

function windows(out, width, base, depth, count, lod, arch, tall = false) {
  for (let i = 0; i < count; i++) {
    const u = width * ((i + 0.5) / count - 0.5);
    const half = tall ? 0.53 : 0.29;
    const h = tall ? 1.43 : 0.75;
    if (lod > 0)
      panel(
        out,
        'trim',
        u - half - 0.13,
        base - 0.11,
        depth + 0.01,
        2 * half + 0.26,
        h + 0.22,
        colors.pale,
      );
    if (arch) archPanel(out, u, base, depth + 0.031, 2 * half, h - half, lod, colors.window);
    else panel(out, 'shade', u - half, base, depth + 0.033, 2 * half, h, colors.window);
    if (lod > 1) {
      box(
        out,
        'trim',
        [u - half - 0.15, base - 0.12, depth - 0.07],
        [u + half + 0.15, base - 0.025, depth + 0.17],
        colors.pale,
      );
      for (const x of tall ? [-0.22, 0, 0.22] : [-0.095, 0.095])
        panel(out, 'metal', u + x - 0.022, base + 0.04, depth + 0.053, 0.044, h - 0.1, colors.dark);
    }
  }
}

function mappedRoof(out, ring, eave, rise, pitchedEnds, slot) {
  const [a, b] = ring.reduce(
    (longest, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return length(p, q) > length(...longest) ? [p, q] : longest;
    },
    [ring[0], ring[1]],
  );
  const axes = edge(a, b);
  const p = ring.map((point) => axes.local(point));
  const xs = p.map(([x]) => x),
    zs = p.map(([, z]) => z);
  roof(
    oriented(out, axes),
    Math.min(...xs) - 0.16,
    Math.max(...xs) + 0.16,
    Math.min(...zs) - 0.16,
    Math.max(...zs) + 0.16,
    eave,
    rise,
    pitchedEnds,
    slot,
  );
}

const mappedBlocks = [
  [232525378, 3.75, 1.22, 'brick', 'roof'],
  [232525380, 4.7, 1.79, 'brick', 'slate'],
  [232525382, 3.65, 1.76, 'brick', 'slate'],
  [232525384, 7.04, 2.64, 'quarry', 'slate'],
  [232525385, 5.21, 1.77, 'brick', 'slate'],
  [232525386, 3.85, 1.55, 'brick', 'roof'],
  [232525387, 4.26, 1.78, 'quarry', 'slate'],
  [232525388, 4.2, 1.64, 'brick', 'slate'],
  [232525389, 6.25, 1.98, 'quarry', 'slate'],
  [232525391, 7.87, 2.96, 'quarry', 'slate'],
];

function blocks(out, lod) {
  for (const [id, height, rise, slot, roofSlot] of mappedBlocks) {
    const ring = outline(id);
    const floor = groundAt(...center(ring));
    const eave = floor + height;
    const tint =
      slot === 'brick' ? colors.brick : id === 232525391 ? colors.stone : colors.blueStone;
    wallShell(out, ring, eave, slot, tint);
    if (id === 232525391) {
      mappedRoof(out, ring.slice(0, 4), eave, rise, false, roofSlot);
      mappedRoof(
        out,
        [ring[4], ring[5], ring[6], ring[7]],
        eave - 0.017,
        rise - 0.15,
        false,
        roofSlot,
      );
    } else mappedRoof(out, ring, eave, rise, ring.length > 4, roofSlot);
    const sign = signOf(ring);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length];
      const w = length(a, b);
      if (w < 4.8 || (lod === 0 && w < 17)) continue;
      const local = oriented(out, edge(a, b, sign));
      const count = lod === 0 ? Math.ceil(w / 8) : Math.max(1, Math.floor((w - 1) / 2.95));
      if (lod > 1)
        box(
          local,
          'trim',
          [-w / 2 + 0.07, eave - 0.29, -0.13],
          [w / 2 - 0.07, eave - 0.12, 0.08],
          colors.mortar,
        );
      windows(local, w * 0.89, floor + 1.47, 0.04, count, lod, false);
      if (height > 5.9 && lod > 0)
        windows(local, w * 0.89, floor + height - 2.03, 0.04, count, lod, false);
      if (lod > 1 && w > 13 && slot === 'quarry') {
        for (const side of [-1, 1]) {
          const x = side * (w / 2 - 0.34);
          box(local, 'brick', [x - 0.22, floor - 0.1, -0.13], [x + 0.22, eave, 0.095], colors.red);
        }
      }
    }
  }
}

function wallCourse(out, path, width, height, slot, lod, teeth = false) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const len = length(a, b);
    if (len < 0.05) continue;
    const axes = edge(a, b);
    const p = (u, y, v) => axes.point(u, y, v);
    const floorA = groundAt(...a),
      floorB = groundAt(...b);
    const topA = floorA + height,
      topB = floorB + height;
    const h = width / 2,
      u = len / 2;
    // u follows the path in reverse for this frame.
    for (const side of [-1, 1])
      face(
        out,
        slot,
        [
          p(u, floorA - 0.65, side * h),
          p(-u, floorB - 0.65, side * h),
          p(-u, topB, side * h),
          p(u, topA, side * h),
        ],
        axes.direction([0, 0, side]),
        slot === 'brick' ? colors.red : colors.lime,
      );
    face(
      out,
      'trim',
      [p(u, topA + 0.09, -h), p(-u, topB + 0.09, -h), p(-u, topB + 0.09, h), p(u, topA + 0.09, h)],
      up,
      colors.pale,
    );
    if (lod === 0) continue;
    const local = oriented(out, axes);
    if (teeth && lod > 1) {
      const count = Math.floor(len / (lod === 2 ? 1.85 : 1.37));
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count;
        const x = u - len * t;
        const y = mix(topA, topB, t);
        box(
          local,
          'brick',
          [x - 0.16, y - 0.05, -h * 0.81],
          [x + 0.16, y + 0.19, h * 0.81],
          colors.brick,
        );
      }
    }
  }
}

function towers(out, lod) {
  for (const [index, id] of plan.dimensions.historicTowerWays.entries()) {
    const ring = outline(id);
    const bottom = groundAt(...center(ring));
    const crown = bottom + (index === 0 ? 9.03 : 10.27);
    wallShell(out, ring, crown, 'quarry', colors.stone);
    face(
      out,
      'trim',
      ring.map((p) => position(p, crown)),
      up,
      colors.lime,
    );
    const sign = signOf(ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        span = length(a, b);
      if (span < 0.5) continue;
      const local = oriented(out, edge(a, b, sign));
      box(
        local,
        'trim',
        [-span / 2, crown - 0.48, -0.1],
        [span / 2, crown - 0.19, 0.29],
        colors.pale,
      );
      if (index === 1) {
        const count = lod === 0 ? 1 : 2;
        for (let j = 0; j < count; j++) {
          const x = span * ((j + 0.5) / count - 0.5);
          box(
            local,
            'trim',
            [x - 0.25, crown - 0.24, -0.28],
            [x + 0.25, crown + 0.47, 0.24],
            colors.pale,
          );
        }
      }
      if (lod > 0 && span > 1.55) {
        archPanel(local, 0, crown - 3.5, 0.035, 0.49, 1.12, lod, colors.dark);
        if (lod > 1) panel(local, 'trim', -0.39, crown - 3.57, 0.045, 0.78, 0.12, colors.pale);
      }
    }
  }
}

function watchTower(out, lod) {
  const [x, z] = plan.watchTowerCenter;
  const y = groundAt(x, z);
  box(out, 'quarry', [x - 0.77, y - 0.55, z - 0.77], [x + 0.77, y + 6.63, z + 0.77], colors.office);
  box(out, 'metal', [x - 1.51, y + 6.2, z - 1.51], [x + 1.51, y + 8.11, z + 1.51], colors.tin);
  if (lod > 0) {
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const local = oriented(out, frame([x, z], [a, b]));
      for (const u of [-1.19, -0.38, 0.43])
        panel(local, 'shade', u, y + 6.7, 1.515, 0.74, 1.15, colors.glass);
    }
  }
  const local = oriented(out, frame([x, z], [0, 1]));
  roof(local, -1.67, 1.67, -1.63, 1.63, y + 8.18, 0.34, true, 'roof');
}

function gateDoor(out, y, depth, lod) {
  const r = 1.38;
  const spring = y + 2.32;
  const count = [7, 11, 18, 28][lod];
  panel(out, 'door', -r, y, depth, 2 * r, spring - y, colors.white);
  const pos = (angle, radius, z = depth) => [
    Math.cos(angle) * radius,
    spring + Math.sin(angle) * radius,
    z,
  ];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    face(out, 'door', [[0, spring, depth], pos(a, r), pos(b, r)], front, colors.white);
    face(
      out,
      'trim',
      [
        pos(a, r + 0.018, depth + 0.035),
        pos(a, r + 0.83, depth + 0.18),
        pos(b, r + 0.83, depth + 0.18),
        pos(b, r + 0.018, depth + 0.035),
      ],
      front,
      i % 4 === 1 ? colors.stone : colors.pale,
    );
  }
  for (const side of [-1, 1]) {
    const low = side * r,
      high = side * (r + 0.83);
    face(
      out,
      'trim',
      [
        [low, y, depth + 0.035],
        [high, y, depth + 0.18],
        [high, spring, depth + 0.18],
        [low, spring, depth + 0.035],
      ],
      front,
      colors.pale,
    );
    if (lod > 0) {
      panel(out, 'metal', side * 0.79 - 0.55, y + 1.79, depth + 0.075, 1.1, 0.063, colors.dark);
      panel(out, 'metal', side * 0.79 - 0.55, y + 0.91, depth + 0.075, 1.1, 0.057, colors.dark);
    }
  }
  panel(out, 'metal', -0.014, y + 0.021, depth + 0.044, 0.028, spring - y + r - 0.065, colors.dark);
  if (lod > 1) {
    const dx = lod === 2 ? 0.27 : 0.15;
    const dz = lod === 2 ? 0.27 : 0.153;
    for (let col = -Math.floor((r - 0.06) / dx); col <= Math.floor((r - 0.06) / dx); col++) {
      const x = dx * col + 0.025;
      const hi = spring + Math.sqrt(r * r - x * x) - 0.07;
      for (let h = y + 0.09; h < hi; h += dz)
        face(
          out,
          'metal',
          [
            [x - 0.025, h, depth + 0.05],
            [x, h - 0.022, depth + 0.053],
            [x + 0.025, h, depth + 0.05],
            [x, h + 0.022, depth + 0.053],
          ],
          front,
          colors.mortar,
        );
    }
  }
  archPanel(out, 0, spring + 2.215, depth + 0.205, 1.44, 0.14, lod, colors.white);
  if (lod > 1) {
    panel(out, 'metal', -0.24, spring + 2.31, depth + 0.23, 0.48, 0.33, colors.gold);
    panel(out, 'shade', -0.09, spring + 2.29, depth + 0.235, 0.18, 0.21, colors.sign);
  }
}

function administration(out, lod) {
  const { center, outward, width, depth, eaveHeight } = plan.administration;
  const floor = groundAt(...center);
  const local = oriented(out, frame(center, outward));
  const half = width / 2,
    rear = depth / 2;
  const eave = floor + eaveHeight;
  box(local, 'brick', [-half, floor - 0.74, -rear], [half, eave, rear], colors.red);
  roof(
    local,
    -half - 0.27,
    half + 0.27,
    -rear - 0.26,
    rear + 0.26,
    eave,
    eaveHeight * 0.39,
    true,
    'slate',
  );
  box(
    local,
    'trim',
    [-half - 0.06, eave - 0.31, rear - 0.18],
    [half + 0.06, eave - 0.088, rear + 0.2],
    colors.pale,
  );
  if (lod > 0)
    box(
      local,
      'trim',
      [-half - 0.05, floor + 3.98, rear - 0.05],
      [half + 0.05, floor + 4.19, rear + 0.075],
      colors.stone,
    );
  gateDoor(local, floor + 0.04, rear + 0.105, lod);
  for (const side of [-1, 1]) {
    const wing = (half - 2.95) * 0.5 + 2.95;
    const wingOut = oriented(local, frame([side * wing, 0], [0, 1]));
    const count = Math.min(4, Math.max(1, Math.floor((half - 2.9) / 2.55)));
    windows(wingOut, (half - 3.05) * 0.98, floor + 1.21, rear + 0.08, count, lod, true, true);
    windows(wingOut, (half - 3.05) * 0.98, floor + 4.54, rear + 0.08, count, lod, true, true);
    if (lod > 0)
      box(
        local,
        'brick',
        [side * half * 0.62 - 0.45, eave + 0.78, -0.57],
        [side * half * 0.62 + 0.45, eave + 3.13, 0.5],
        colors.brick,
      );
    if (lod > 1) {
      const plaque = side * 2.7 - 0.32;
      panel(local, 'door', plaque, floor + 1.3, rear + 0.117, 0.64, 0.93, colors.sign);
      panel(local, 'trim', plaque + 0.05, floor + 1.35, rear + 0.139, 0.54, 0.83, colors.pale);
    }
  }
}

function draw(out, lod) {
  const { outerWallHeightMeters: height, yardPartitionHeightMeters: yard } = plan.dimensions;
  wallCourse(out, mapped.get(232525398), 0.82, height, 'quarry', lod, true);
  wallCourse(out, mapped.get(232525396), 0.81, height, 'quarry', lod, true);
  for (const line of plan.frontCurtains) wallCourse(out, line, 0.8, height, 'quarry', lod, true);
  for (const line of plan.newYardEnclosure)
    wallCourse(out, line, 0.72, height, 'quarry', lod, true);
  for (const id of [232525394, 232525397])
    wallCourse(out, mapped.get(id), 0.43, yard, 'brick', lod);
  blocks(out, lod);
  towers(out, lod);
  watchTower(out, lod);
  administration(out, lod);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [133, 77, 177];
const lookAt = [-10, 1, 10];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const entry = frame(plan.administration.center, plan.administration.outward);
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
    'Adelaide Gaol with its Georgian administration range, original limestone walls and octagonal towers, radial prison yards and 1879 T-shaped cell range.',
  camera,
  lookAt,
  sunDirection: [112, 155, 138],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.35,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'georgian-gate-and-studded-double-doors',
      position: entry.point(5.7, 5.35, 37),
      lookAt: entry.point(0, 3, 4.8),
    },
    { name: 'eastern-masonry-towers-and-walls', position: [136, 25, 48], lookAt: [32, 4, 6] },
    { name: 'radial-yards-and-west-cell-block', position: [-112, 69, 91], lookAt: [-29, 2, 15] },
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
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.3, surfaces },
      street: { export: 'street', errorMeters: 0.44, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent geographic reconstruction based on a public-domain Qualla entrance photograph, mapped site controls and the unchanged Terrarium elevation field.',
};
