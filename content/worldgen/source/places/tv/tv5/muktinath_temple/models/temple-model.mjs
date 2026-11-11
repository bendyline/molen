/** Muktinath's timber pagoda, entry pavilion, bathing pools and spring court. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.21 },
  corrugated: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.22 },
  brass: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.68, metallic: 0.46 },
  water: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    name: 'Still basin water',
    roughness: 0.28,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.86],
    doubleSided: true,
  },
};
const palette = {
  white: [0.743, 0.72, 0.668],
  warmLime: [0.68, 0.651, 0.589],
  shadowLime: [0.51, 0.489, 0.435],
  stone: [0.431, 0.412, 0.366],
  paver: [0.504, 0.473, 0.411],
  wall: [0.338, 0.319, 0.271],
  coping: [0.58, 0.542, 0.473],
  timber: [0.135, 0.103, 0.075],
  edge: [0.226, 0.168, 0.112],
  deep: [0.068, 0.059, 0.047],
  wine: [0.295, 0.125, 0.074],
  slate: [0.3, 0.337, 0.331],
  silvery: [0.465, 0.481, 0.438],
  galvanized: [0.386, 0.416, 0.409],
  brass: [0.61, 0.409, 0.153],
  darkBrass: [0.31, 0.2, 0.079],
  highlight: [0.771, 0.54, 0.217],
  water: [0.092, 0.207, 0.194],
  stream: [0.43, 0.59, 0.569],
  gutter: [0.071, 0.134, 0.128],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t,
  ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const at = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, palette[tone]);
function face(out, slot, tone, points, dir) {
  points = points
    .map((p) => p.map(Math.fround))
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.every((v, j) => v === p[j])));
  if (points.length < 3) return;
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) < 0.5) return;
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, palette[tone]);
  else out.addQuad(slot, ref, points, n, undefined, palette[tone]);
}
const rect = (a, b, c, d) => [
  [a, c],
  [a, d],
  [b, d],
  [b, c],
];
const horizontal = ([x, z], y) => [x, y, z];
function flat(out, slot, tone, ring, height, holes = []) {
  const vertices = [...ring, ...holes.flat()],
    holeIndices = [];
  let start = ring.length;
  for (const h of holes) {
    holeIndices.push(start);
    start += h.length;
  }
  const ix = earcut(vertices.flat(), holeIndices);
  for (let i = 0; i < ix.length; i += 3)
    face(
      out,
      slot,
      tone,
      ix
        .slice(i, i + 3)
        .map((j) =>
          horizontal(vertices[j], Array.isArray(height) ? (height[j] ?? height[0]) : height),
        ),
      up,
    );
}
function sideWalls(out, slot, tone, ring, low, high) {
  const sign = Math.sign(
    ring.reduce((n, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return n + x * b - z * a;
    }, 0),
  );
  const y = (row, i) => (Array.isArray(row) ? row[i] : row);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j],
      dir = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])];
    face(
      out,
      slot,
      tone,
      [
        horizontal(a, y(low, i)),
        horizontal(b, y(low, j)),
        horizontal(b, y(high, j)),
        horizontal(a, y(high, i)),
      ],
      dir,
    );
  }
}
function slab(out, slot, tone, ring, base, top, holes = []) {
  flat(out, slot, tone, ring, top, holes);
  sideWalls(out, slot, tone, ring, base, top);
}
function localBox(out, slot, tone, x0, x1, z0, z1, y0, y1, point = (p) => p) {
  const ring = rect(x0, x1, z0, z1);
  loft(
    out,
    slot,
    [y0, y1].map((y) => ring.map((p) => point(horizontal(p, y)))),
    palette[tone],
  );
}
function wallStrip(out, slot, tone, { a, b, base, top, inward }, width) {
  const n = inward ?? [
    (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
    (a[0] - b[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
  ];
  const p = (i, y, k) => [
    (i === 0 ? a : b)[0] + (n[0] * k * width) / 2,
    y,
    (i === 0 ? a : b)[1] + (n[1] * k * width) / 2,
  ];
  const ring = [
    [0, -1],
    [1, -1],
    [1, 1],
    [0, 1],
  ];
  for (const s of [-1, 1])
    face(
      out,
      slot,
      tone,
      [p(0, base[0], s), p(1, base[1], s), p(1, top[1], s), p(0, top[0], s)],
      [n[0] * s, 0, n[1] * s],
    );
  face(
    out,
    slot,
    tone,
    ring.map(([i, s]) => p(i, top[i], s)),
    up,
  );
  for (const i of [0, 1])
    face(
      out,
      slot,
      tone,
      [p(i, base[i], -1), p(i, base[i], 1), p(i, top[i], 1), p(i, top[i], -1)],
      [(b[0] - a[0]) * (i * 2 - 1), 0, (b[1] - a[1]) * (i * 2 - 1)],
    );
}
function basin(out, { ring, outer, bed, water, deck, rim }, tier) {
  flat(out, 'stone', 'wall', ring, bed);
  flat(out, 'water', 'water', ring, water);
  sideWalls(out, 'stone', 'coping', outer, deck - 0.11, rim);
  sideWalls(out, 'stone', 'wall', ring.toReversed(), bed, rim);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face(
      out,
      'stone',
      'coping',
      [ring[i], ring[j], outer[j], outer[i]].map((p) => horizontal(p, rim)),
      up,
    );
    if (tier >= 2) {
      const a = at(ring[i], outer[i], 0.71),
        b = at(ring[j], outer[j], 0.71);
      rod(
        out,
        'stone',
        'coping',
        horizontal(a, rim + 0.021),
        horizontal(b, rim + 0.021),
        0.14,
        0.06,
      );
    }
  }
}
function courts(out, tier) {
  for (const patch of layout.patches)
    slab(out, 'stone', 'paver', patch.ring, patch.base, patch.top, patch.holes);
  for (const p of layout.pools) basin(out, p, tier);
  if (tier === 0) {
    for (const run of Map.groupBy(layout.steps, (s) => s.z0).values()) {
      const rows = run.toSorted((a, b) => a.x0 - b.x0),
        a = rows[0],
        b = rows.at(-1);
      slab(
        out,
        'stone',
        'coping',
        rect(a.x0, b.x1, a.z0, a.z1),
        Math.min(...run.map((p) => p.base)),
        [a.y, a.y, b.y, b.y],
      );
    }
  } else
    for (const s of layout.steps) {
      slab(out, 'stone', 'coping', rect(s.x0, s.x1, s.z0, s.z1), s.base, s.y);
    }
  for (const edge of layout.railings) {
    wallStrip(out, 'lime', 'shadowLime', edge, 0.36);
    if (tier >= 1)
      wallStrip(
        out,
        'stone',
        'coping',
        { ...edge, base: edge.top.map((y) => y - 0.07), top: edge.top.map((y) => y + 0.05) },
        0.46,
      );
  }
}
function springWall(out, tier) {
  for (const w of layout.walls) {
    wallStrip(out, 'stone', 'wall', w, 0.46);
    if (tier > 0)
      wallStrip(
        out,
        'stone',
        'coping',
        { ...w, base: w.top.map((y) => y - 0.13), top: w.top.map((y) => y + 0.045) },
        0.56,
      );
    const shift = ([x, z], t) => [x + w.inward[0] * t, z + w.inward[1] * t];
    const a = shift(w.a, 0.49),
      b = shift(w.b, 0.49),
      base = w.top.map((y) => y - 1.31),
      top = w.top.map((y) => y - 1.22);
    wallStrip(out, 'stone', 'stone', { a, b, base, top, inward: w.inward }, 0.6);
    const p = (i, k) => horizontal(shift(i === 0 ? w.a : w.b, k), top[i] + 0.009);
    face(out, 'water', 'gutter', [p(0, 0.31), p(1, 0.31), p(1, 0.64), p(0, 0.64)], up);
    if (tier >= 2) {
      const aa = shift(w.a, 0.75),
        bb = shift(w.b, 0.75);
      wallStrip(
        out,
        'stone',
        'coping',
        {
          a: aa,
          b: bb,
          base: base.map((y) => y - 0.06),
          top: top.map((y) => y + 0.066),
          inward: w.inward,
        },
        0.12,
      );
    }
  }
  for (const [i, p] of layout.spouts.entries()) {
    if (tier === 0 || (tier === 1 && i % 3 !== 0)) continue;
    const [nx, nz] = p.inward,
      t = [-nz, nx];
    const q = (along, height, width = 0) => [
      p.x + along * nx + width * t[0],
      p.y + height,
      p.z + along * nz + width * t[1],
    ];
    if (tier <= 2) {
      rod(out, 'brass', 'brass', q(0.035, 0.006), q(0.27, -0.027), 0.082, 0.071);
    } else {
      const circles = [
        [0.113, 0.025, 0.058],
        [0.16, 0.007, 0.044],
        [0.275, -0.019, 0.036],
        [0.3, -0.027, 0.043],
      ].map(([a, b, r]) =>
        Array.from({ length: 7 }, (_, j) => {
          const angle = (2 * Math.PI * j) / 7;
          return q(a, b + r * Math.sin(angle), r * Math.cos(angle));
        }),
      );
      for (let j = 1; j < circles.length; j++)
        for (let k = 0; k < 7; k++) {
          const next = (k + 1) % 7,
            points = [circles[j - 1][k], circles[j - 1][next], circles[j][next], circles[j][k]],
            angle = (2 * Math.PI * (k + 0.5)) / 7;
          face(out, 'brass', j === 3 ? 'highlight' : 'brass', points, [
            t[0] * Math.cos(angle),
            Math.sin(angle),
            t[1] * Math.cos(angle),
          ]);
        }
      for (let j = 0; j < 7; j++)
        face(
          out,
          'brass',
          'darkBrass',
          [q(0.293, -0.027), circles.at(-1)[j], circles.at(-1)[(j + 1) % 7]],
          [nx, 0, nz],
        );
      if (i % 2 === 0) {
        const stream = [
          [0.31, -0.044],
          [0.39, -0.11],
          [0.46, -0.28],
          [0.54, p.floor - p.y + 0.14],
        ];
        for (let k = 1; k < stream.length; k++) {
          const [a, b] = stream.slice(k - 1, k + 1);
          face(
            out,
            'water',
            'stream',
            [q(...a, -0.012), q(...b, -0.012), q(...b, 0.012), q(...a, 0.012)],
            [nx, 1, nz],
          );
        }
      }
    }
  }
}
function woodenWindow(out, p, side, offset, y, w, h, tier) {
  const q = (u, v, d = 0) => p(u + offset, v + y, d);
  const n = side;
  face(
    out,
    'timber',
    'deep',
    [q(-w / 2, 0, 0.026), q(w / 2, 0, 0.026), q(w / 2, h, 0.026), q(-w / 2, h, 0.026)],
    n,
  );
  for (const s of [-1, 1])
    rod(
      out,
      'timber',
      'timber',
      q(s * w * 0.51, -0.07, 0.055),
      q(s * w * 0.51, h + 0.05, 0.055),
      0.1,
      0.09,
    );
  rod(out, 'timber', 'edge', q(-w * 0.61, -0.055, 0.075), q(w * 0.61, -0.055, 0.075), 0.095, 0.127);
  rod(
    out,
    'timber',
    'edge',
    q(-w * 0.75, h + 0.037, 0.068),
    q(w * 0.75, h + 0.037, 0.068),
    0.11,
    0.11,
  );
  if (tier >= 2) {
    const count = tier === 2 ? 3 : 5;
    for (let j = 1; j <= count; j++) {
      const u = (j / (count + 1) - 0.5) * w * 0.85;
      rod(out, 'timber', 'edge', q(u, 0.036, 0.068), q(u, h - 0.032, 0.068), 0.028, 0.033);
      rod(
        out,
        'timber',
        'edge',
        q(-w * 0.45, (j / (count + 1)) * h, 0.071),
        q(w * 0.45, (j / (count + 1)) * h, 0.071),
        0.028,
        0.033,
      );
    }
  }
}
function pagodaRoof(out, section, index, tier) {
  const { wallHalf, roofHalf, eave, rise, corner } = section;
  const corners = rect(-roofHalf[0], roofHalf[0], -roofHalf[1], roofHalf[1]);
  const spans = [2, 4, 9, 17, 23][tier],
    rings = [2, 3, 4, 6, 8][tier];
  const roofPoint = (side, u, t, offset = 0) => {
    const p = at(corners[side], corners[(side + 1) % 4], u),
      r = 0.06 + 0.94 * t;
    return [
      p[0] * r,
      eave +
        rise * Math.pow(1 - t, 1.4) +
        corner * t ** 2 * Math.pow(Math.abs(2 * u - 1), 6) +
        offset,
      p[1] * r,
    ];
  };
  for (let side = 0; side < 4; side++) {
    for (let j = 0; j < spans; j++) {
      const a = j / spans,
        b = (j + 1) / spans;
      for (let i = 0; i < rings; i++) {
        const t = i / rings,
          u = (i + 1) / rings;
        const points = [
          roofPoint(side, a, t),
          roofPoint(side, a, u),
          roofPoint(side, b, u),
          roofPoint(side, b, t),
        ];
        face(out, 'roof', index === 2 ? 'silvery' : j % 5 === 2 ? 'silvery' : 'slate', points, up);
      }
      const a0 = roofPoint(side, a, 1),
        b0 = roofPoint(side, b, 1),
        inward = (p) => [p[0] * 0.66, eave + 0.185, p[2] * 0.66];
      face(
        out,
        'timber',
        'deep',
        [[a0[0], a0[1] - 0.11, a0[2]], [b0[0], b0[1] - 0.11, b0[2]], inward(b0), inward(a0)],
        down,
      );
      const n = [a0[0] + b0[0], 0, a0[2] + b0[2]];
      face(
        out,
        index === 2 ? 'brass' : 'timber',
        index === 2 ? 'brass' : 'edge',
        [a0, b0, [b0[0], b0[1] - 0.11, b0[2]], [a0[0], a0[1] - 0.11, a0[2]]],
        n,
      );
      if (tier >= 2 && j > 0) {
        const rows = [0.22, 0.49, 0.73, 1].map((t) => roofPoint(side, a, t, 0.021));
        beamPath(out, 'roof', rows, 0.028, 0.039, palette.silvery);
      }
    }
    if (tier > 0) {
      const n = [
          [-1, 0],
          [0, 1],
          [1, 0],
          [0, -1],
        ][side],
        wallRadius = side % 2 === 0 ? wallHalf[0] : wallHalf[1],
        length = side % 2 === 0 ? wallHalf[1] : wallHalf[0];
      const supports = index === 0 ? 7 : index === 1 ? 5 : 4;
      for (let k = 0; k < supports; k++) {
        const u = (k + 0.5) / supports,
          e = roofPoint(side, u, 0.985, -0.116),
          t = (2 * u - 1) * length;
        const w = [
          n[0] * wallRadius + (side % 2 ? t : 0),
          eave - (index === 2 ? 0.68 : 0.84),
          n[1] * wallRadius + (side % 2 ? 0 : t),
        ];
        rod(out, 'timber', 'timber', w, e, index === 0 ? 0.13 : 0.108, 0.158);
        if (tier >= 2) rod(out, 'timber', 'edge', [w[0], eave + 0.08, w[2]], e, 0.087, 0.097);
      }
    }
    if (tier >= 2) {
      const corner = roofPoint(side, 0, 1),
        back = roofPoint(side, 0, 0.91, 0.044);
      const end = [corner[0] * 1.018, corner[1] + 0.155, corner[2] * 1.018];
      rod(
        out,
        index === 2 ? 'brass' : 'timber',
        index === 2 ? 'highlight' : 'edge',
        back,
        end,
        0.105,
        0.083,
      );
    }
  }
  if (tier >= 2)
    for (const corner of corners) {
      const y = eave + 0.198;
      rod(
        out,
        'brass',
        'darkBrass',
        [corner[0] * 0.89, y, corner[1] * 0.89],
        [corner[0] * 0.89, y - 0.26, corner[1] * 0.89],
        0.037,
      );
      const bell = [y - 0.32, y - 0.24, y - 0.22].map((h, i) =>
        radialRing(h, [0.064, 0.036, 0.018][i], [0.064, 0.036, 0.018][i], 6, [
          corner[0] * 0.89,
          corner[1] * 0.89,
        ]),
      );
      loft(out, 'brass', bell, palette.brass);
    }
}
function shrine(out, tier) {
  const { floor, tiers: sections } = layout.shrine;
  slab(out, 'stone', 'stone', rect(-2.78, 2.78, -2.76, 2.76), floor - 0.79, floor + 0.09);
  for (const [i, s] of sections.entries()) {
    const [hx, hz] = s.wallHalf;
    localBox(out, 'lime', 'white', -hx, hx, -hz, hz, s.bottom, s.wallY);
    if (tier > 0 || i === 0)
      localBox(
        out,
        'timber',
        'timber',
        -hx - 0.046,
        hx + 0.046,
        -hz - 0.046,
        hz + 0.046,
        s.bottom,
        s.bottom + 0.15,
      );
    if (tier > 0)
      localBox(
        out,
        'timber',
        'timber',
        -hx - 0.045,
        hx + 0.045,
        -hz - 0.045,
        hz + 0.045,
        s.wallY - 0.14,
        s.wallY + 0.025,
      );
    if (tier > 0)
      for (const x of [-hx, hx])
        for (const z of [-hz, hz])
          rod(out, 'timber', 'timber', [x, s.bottom, z], [x, s.wallY, z], i === 0 ? 0.163 : 0.124);
    if (tier > 0) {
      for (const side of [-1, 1]) {
        const w = i === 0 ? 0.82 : i === 1 ? 0.65 : 0.43,
          h = i === 0 ? 1.18 : i === 1 ? 0.88 : 0.58;
        woodenWindow(
          out,
          (u, y, d) => [side * (hx + d), y, u],
          [side, 0, 0],
          i === 0 ? 0.02 : 0,
          s.bottom + (i === 0 ? 0.57 : 0.32),
          w,
          h,
          tier,
        );
        if (tier >= 2)
          woodenWindow(
            out,
            (u, y, d) => [u, y, side * (hz + d)],
            [0, 0, side],
            0,
            s.bottom + 0.41,
            w * 0.94,
            h * 0.91,
            tier,
          );
      }
    }
    pagodaRoof(out, s, i, tier);
  }
  const raw = [
    [8.98, 0.43],
    [9.17, 0.38],
    [9.24, 0.263],
    [9.3, 0.275],
    [9.39, 0.22],
    [9.5, 0.19],
    [9.57, 0.12],
    [9.67, 0.15],
    [9.74, 0.095],
    [9.86, 0.08],
    [9.94, 0.055],
    [10.12, 0.033],
    [10.29, 0.011],
  ];
  const rings = (tier === 0 ? raw.filter((_, i) => [0, 3, 7, 10, 12].includes(i)) : raw).map(
    ([y, r]) => radialRing(y, r, r, [5, 7, 10, 14, 18][tier]),
  );
  loft(out, 'brass', rings, palette.brass);
  if (tier >= 2)
    for (const s of [-1, 1])
      rod(out, 'brass', 'darkBrass', [s * 0.24, 9.29, 0], [0, 10.14, 0], 0.036);
}
function pavilion(out, tier) {
  const h = layout.hall,
    { center, yaw, halfWidth: hx, halfDepth: hz, floor, wall, roof } = h,
    co = Math.cos(yaw),
    si = Math.sin(yaw);
  const p = ([x, y, z]) => [center[0] + co * x - si * z, y, center[1] + si * x + co * z];
  const box = (slot, tone, x0, x1, z0, z1, y0, y1) =>
    localBox(out, slot, tone, x0, x1, z0, z1, y0, y1, p);
  const side = [co, 0, si],
    door = 0.89,
    top = floor + wall;
  slab(out, 'stone', 'paver', h.ring, floor - 0.81, floor);
  for (const x of [-hx, hx]) {
    for (const [a, b] of [
      [-hz, -door],
      [door, hz],
    ])
      box('lime', 'white', x - 0.15, x + 0.15, a, b, floor, top);
    box('timber', 'timber', x - 0.18, x + 0.18, -door - 0.14, door + 0.14, top - 0.45, top + 0.01);
    for (const s of [-1, 1])
      box('timber', 'timber', x - 0.22, x + 0.22, s * door - 0.082, s * door + 0.082, floor, top);
  }
  for (const z of [-hz, hz]) box('lime', 'warmLime', -hx, hx, z - 0.139, z + 0.139, floor, top);
  if (tier > 0)
    for (const x of [-hx, hx])
      for (const s of [-1, 1])
        box(
          'timber',
          'wine',
          x - 0.18,
          x + 0.18,
          s < 0 ? -hz : door,
          s < 0 ? -door : hz,
          floor - 0.01,
          floor + 0.17,
        );
  for (const s of [-1, 1]) {
    const x = hx * s,
      lo = -hz - 0.24,
      hi = hz + 0.24,
      y = top - 0.04,
      eave = x + s * 0.34;
    face(
      out,
      'corrugated',
      'galvanized',
      [
        [eave, y, lo],
        [eave, y, hi],
        [0, top + roof, hi],
        [0, top + roof, lo],
      ].map(p),
      up,
    );
    face(
      out,
      'timber',
      'deep',
      [
        [eave, y - 0.045, lo],
        [eave, y - 0.045, hi],
        [0, top + roof - 0.045, hi],
        [0, top + roof - 0.045, lo],
      ].map(p),
      down,
    );
    rod(out, 'timber', 'timber', p([eave, y, lo]), p([eave, y, hi]), 0.12, 0.118);
    if (tier >= 2)
      for (let z = lo + 0.22; z < hi; z += tier >= 3 ? 0.23 : 0.42) {
        rod(
          out,
          'corrugated',
          'silvery',
          p([eave, y + 0.019, z]),
          p([0, top + roof + 0.019, z]),
          0.026,
          0.024,
        );
      }
  }
  for (const s of [-1, 1]) {
    const z = s * hz;
    face(
      out,
      'lime',
      'warmLime',
      [
        [-hx, top, z],
        [hx, top, z],
        [0, top + roof, z],
      ].map(p),
      [-s * si, 0, s * co],
    );
    rod(out, 'timber', 'edge', p([-hx, top, z]), p([0, top + roof, z]), 0.12, 0.099);
    rod(out, 'timber', 'edge', p([0, top + roof, z]), p([hx, top, z]), 0.12, 0.099);
  }
  const a = 1.41,
    b = hx + 0.68,
    z = 1.17,
    y = top + 0.25,
    crest = top + 1.37;
  for (const s of [-1, 1]) {
    face(
      out,
      'corrugated',
      'slate',
      [
        [a, y, s * z],
        [b, y, s * z],
        [b, crest, 0],
        [a, crest, 0],
      ].map(p),
      up,
    );
    rod(out, 'timber', 'timber', p([a, y, s * z]), p([b, y, s * z]), 0.104, 0.13);
    rod(out, 'timber', 'edge', p([b, y, s * z]), p([b, crest, 0]), 0.13, 0.16);
  }
  face(
    out,
    'timber',
    'timber',
    [
      [b, y, -z],
      [b, y, z],
      [b, crest, 0],
    ].map(p),
    side,
  );
  face(
    out,
    'timber',
    'deep',
    [
      [b, y, -z],
      [b, y, z],
      [b, top - 0.17, z],
      [b, top - 0.17, -z],
    ].map(p),
    side,
  );
  if (tier > 0) {
    for (const s of [-1, 1])
      woodenWindow(
        out,
        (u, y, d) => p([hx + d, y, u]),
        side,
        s * 3.25,
        floor + 0.73,
        1.07,
        1.05,
        tier,
      );
    const rings = [
      [y + 0.24, 0.088],
      [y + 0.32, 0.105],
      [y + 0.38, 0.075],
    ].map(([h, r]) => radialRing(h, r, r, 6, [b + 0.037, 0]).map(p));
    loft(out, 'brass', rings, palette.highlight);
  }
}
export function buildMuktinathTempleLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Muktinath Temple level ${level}`);
  courts(out, tier);
  springWall(out, tier);
  shrine(out, tier);
  pavilion(out, tier);
}
export const buildMuktinathTempleSkyline = (out) => buildMuktinathTempleLevel(out, 'skyline');
export const buildMuktinathTempleDistrict = (out) => buildMuktinathTempleLevel(out, 'district');
export const buildMuktinathTempleStreet = (out) => buildMuktinathTempleLevel(out, 'street');
export const buildMuktinathTempleCloseup = (out) => buildMuktinathTempleLevel(out, 'closeup');
