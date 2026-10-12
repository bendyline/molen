/** Reviewed browser levels; the original 3 WTC recipe remains unchanged. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { readFileSync } from 'node:fs';
import { structureSourcePath } from './structure-source-paths.mjs';
const frame = JSON.parse(
  readFileSync(structureSourcePath('n0195_3_world_trade_center', 'map-frame.json')),
);

const silver = [0.62, 0.67, 0.69],
  glass = [0.28, 0.39, 0.43],
  dark = [0.07, 0.095, 0.11];
const levels = { podium: 62.484, south: 218.8464, north: 284.988, top: 328.8792 };
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
function cleanPlan(plan) {
  return plan.filter((p, i) => {
    const a = plan[(i + plan.length - 1) % plan.length],
      b = plan[(i + 1) % plan.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return (
      length < 0.01 ||
      Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length > 0.025
    );
  });
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, length, n: [-(b[1] - a[1]) / length, 0, (b[0] - a[0]) / length] };
    })
    .filter((e) => e.length > 0.06);
}
function inside([x, z], plan) {
  let hit = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
function exposed(block, blocks, bottom) {
  const result = [];
  for (const edge of edges(block.plan)) {
    const { a, b, n, length } = edge,
      d = [b[0] - a[0], b[1] - a[1]],
      cuts = [0, 1];
    for (const other of blocks) {
      if (other === block) continue;
      for (const p of other.plan) {
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (length * length);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      if ((cuts[j] - cuts[j - 1]) * length < 0.06) continue;
      const aa = lerp(a, b, cuts[j - 1]),
        bb = lerp(a, b, cuts[j]),
        mid = lerp(aa, bb, 0.5);
      const outward = [mid[0] + n[0] * 0.03, mid[1] + n[2] * 0.03];
      const low = Math.max(
        bottom,
        ...blocks.filter((o) => o !== block && inside(outward, o.plan)).map((o) => o.top),
      );
      if (low < block.top - 0.03) result.push({ a: aa, b: bb, n, bottom: low, top: block.top });
    }
  }
  return result;
}
function facade(out, edge, y0, y1, pitch = 4.1148, paneWidth = 1.524) {
  const { a, b, n } = edge,
    width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const at = (u, y, d = 0) => [
    a[0] + (b[0] - a[0]) * u + n[0] * d,
    y,
    a[1] + (b[1] - a[1]) * u + n[2] * d,
  ];
  face(
    out,
    'glass',
    [at(0, y0, -0.04), at(1, y0, -0.04), at(1, y1, -0.04), at(0, y1, -0.04)],
    glass,
  );
  const cfg = out.detail,
    datum = pitch === 3.048 ? 0 : levels.podium;
  const step = pitch * cfg.rowStep;
  for (let y = datum + Math.ceil((y0 - datum) / step) * step; y <= y1 + 0.001; y += step) {
    if (y <= y0 + 0.01) continue;
    const low = Math.max(y0, y - Math.min(0.63, pitch * 0.23));
    face(
      out,
      'glass',
      [at(0, low), at(1, low), at(1, Math.min(y, y1)), at(0, Math.min(y, y1))],
      [0.2, 0.29, 0.33],
    );
    face(
      out,
      'stainless',
      [
        at(0, y - 0.045, 0.075),
        at(1, y - 0.045, 0.075),
        at(1, y + 0.045, 0.075),
        at(0, y + 0.045, 0.075),
      ],
      silver,
    );
  }
  if (cfg.frames) {
    const nx = Math.max(1, Math.round(width / (paneWidth * cfg.moduleStep)));
    for (let i = 0; i <= nx; i++) {
      const u = i / nx,
        du = 0.033 / width;
      face(
        out,
        'stainless',
        [
          at(Math.max(0, u - du), y0, 0.045),
          at(Math.min(1, u + du), y0, 0.045),
          at(Math.min(1, u + du), y1, 0.045),
          at(Math.max(0, u - du), y1, 0.045),
        ],
        silver,
      );
    }
  }
}
function louvers(out, edge, y0, y1) {
  const { a, b, n } = edge;
  const at = (p, y, d = 0) => [p[0] + n[0] * d, y, p[1] + n[2] * d];
  face(
    out,
    'recess',
    [at(a, y0, -0.15), at(b, y0, -0.15), at(b, y1, -0.15), at(a, y1, -0.15)],
    dark,
  );
  if (out.detail.skyline) return;
  for (let y = y0 + 0.16; y < y1; y += out.detail.louverStep)
    face(
      out,
      'stainless',
      [
        at(a, y - 0.07, 0.045),
        at(b, y - 0.07, 0.045),
        at(b, y + 0.07, 0.045),
        at(a, y + 0.07, 0.045),
      ],
      silver,
    );
  const count = Math.max(
    1,
    Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (3.048 * out.detail.moduleStep)),
  );
  for (let i = 0; i <= count; i++) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      du = 0.075 / length,
      t = i / count,
      lo = lerp(a, b, Math.max(0, t - du)),
      hi = lerp(a, b, Math.min(1, t + du));
    face(
      out,
      'stainless',
      [at(lo, y0, 0.2), at(hi, y0, 0.2), at(hi, y1, 0.2), at(lo, y1, 0.2)],
      silver,
    );
  }
}
function kFrame(out, x, z0, z1, top, side) {
  const brace = (a, b, w, d, c) => {
    if (!out.detail.flatBraces) {
      beam(out, 'stainless', a, b, w, d, c);
      return;
    }
    const dy = b[1] - a[1],
      dz = b[2] - a[2],
      l = Math.hypot(dy, dz),
      oy = ((-dz / l) * w) / 2,
      oz = ((dy / l) * w) / 2;
    const p = [
      [a[0], a[1] + oy, a[2] + oz],
      [b[0], b[1] + oy, b[2] + oz],
      [b[0], b[1] - oy, b[2] - oz],
      [a[0], a[1] - oy, a[2] - oz],
    ];
    face(out, 'stainless', p, c);
    face(out, 'stainless', p.toReversed(), c);
  };
  const low = levels.podium + 0.45,
    hi = top - 1.2,
    depth = 0.7;
  const at = (z, y) => [x, y, z];
  for (const z of [z0, z1]) brace(at(z, low), at(z, hi), 0.8, depth, silver);
  const inner = Math.abs(z0) < Math.abs(z1) ? z0 : z1,
    outer = inner === z0 ? z1 : z0;
  const count = Math.max(1, Math.round((hi - low) / (6 * 4.1148)));
  for (let k = 0; k < count; k++) {
    const a = low + ((hi - low) * k) / count,
      b = low + ((hi - low) * (k + 1)) / count,
      mid = (a + b) / 2;
    brace(at(outer, a), at(inner, mid), 0.65, 0.72, silver);
    brace(at(inner, mid), at(outer, b), 0.65, 0.72, silver);
    brace(at(z0, a), at(z1, a), 0.48, 0.58, silver);
    if (out.detail.nodes)
      for (const [z, y] of [
        [outer, a],
        [inner, mid],
        [outer, b],
      ]) {
        box(
          out,
          'stainless',
          [x - 0.5, y - 0.6, z - 0.6],
          [x + 0.5, y + 0.6, z + 0.6],
          [0.56, 0.61, 0.63],
        );
      }
  }
  brace(at(z0, hi), at(z1, hi), 0.48, 0.58, silver);
}
function glassGuard(out, a, b, y) {
  const d = [b[0] - a[0], b[1] - a[1]],
    length = Math.hypot(...d),
    n = [-d[1] / length, d[0] / length];
  const at = (t, v) => [a[0] + d[0] * t, y + v, a[1] + d[1] * t];
  const p = [at(0, 0.12), at(1, 0.12), at(1, 1.13), at(0, 1.13)];
  face(out, 'glass', p, [0.35, 0.46, 0.49]);
  face(out, 'glass', p.toReversed(), [0.35, 0.46, 0.49]);
  if (out.detail.skyline) return;
  if (out.detail.flatGuards) {
    face(out, 'stainless', [at(0, 1.15), at(1, 1.15), at(1, 1.21), at(0, 1.21)], silver);
    return;
  }
  if (out.detail.guardPosts) {
    const count = Math.max(1, Math.ceil(length / (1.524 * out.detail.guardPosts)));
    for (let i = 0; i <= count; i++)
      tube(out, 'stainless', at(i / count, 0.03), at(i / count, 1.18), 0.035, silver, 6);
  }
  beam(out, 'stainless', at(0, 1.18), at(1, 1.18), 0.055, 0.08, silver);
  beam(
    out,
    'metal',
    [a[0] + n[0] * 0.03, y + 0.1, a[1] + n[1] * 0.03],
    [b[0] + n[0] * 0.03, y + 0.1, b[1] + n[1] * 0.03],
    0.15,
    0.19,
    silver,
  );
}
function planter(out, x, z, y, w = 2.4, d = 1.7) {
  if (!out.detail.plants) return;
  box(out, 'stone', [x - w / 2, y, z - d / 2], [x + w / 2, y + 0.55, z + d / 2], [0.38, 0.4, 0.39]);
  box(
    out,
    'recess',
    [x - w / 2 + 0.12, y + 0.55, z - d / 2 + 0.12],
    [x + w / 2 - 0.12, y + 0.6, z + d / 2 - 0.12],
    [0.12, 0.1, 0.07],
  );
  for (let i = 0; i < 4; i++)
    sphere(
      out,
      'foliage',
      [x + ((i % 2) - 0.5) * w * 0.55, y + 0.83, z + (Math.floor(i / 2) - 0.5) * d * 0.55],
      [w * 0.28, 0.36, d * 0.29],
      [0.18, 0.29, 0.14],
      out.detail.plantSides,
      out.detail.plantRows,
    );
}
function entrance(out, base) {
  if (!out.detail.entry) return;
  // The oblique Greenwich elevation is the full-height cable-net lobby.
  const westPoints = base.filter((p) => p[0] < -30).sort((a, b) => a[1] - b[1]);
  // The map inserts collinear nodes halfway along the Greenwich wall; retain
  // the whole lobby frontage instead of treating one half as the entrance wall.
  const west = edges([westPoints[0], westPoints.at(-1)])[0];
  const at = (u, y, d = 0) => [
    west.a[0] + (west.b[0] - west.a[0]) * u + west.n[0] * d,
    y,
    west.a[1] + (west.b[1] - west.a[1]) * u + west.n[2] * d,
  ];
  const count = Math.max(1, Math.round(west.length / 3.048));
  if (out.detail.cableNet)
    for (let i = 0; i <= count; i++) {
      tube(out, 'stainless', at(i / count, 0.2, 0.1), at(i / count, 18.288, 0.1), 0.027, silver, 6);
      if (out.detail.cableNodes)
        for (let y = 3.048; y < 18.2; y += 3.048)
          sphere(out, 'stainless', at(i / count, y, 0.14), [0.065, 0.065, 0.065], silver, 8, 4);
    }
  if (out.detail.cableNet)
    for (let y = 3.048; y < 18.2; y += 3.048)
      tube(out, 'stainless', at(0, y, 0.1), at(1, y, 0.1), 0.022, silver, 6);
  for (const u of [0.28, 0.5, 0.72]) {
    const c = at(u, 0, 0.2),
      r = 1.48;
    const rings = [
      radialRing(0.12, r, r, out.detail.doorSides, [c[0], c[2]]),
      radialRing(3.08, r, r, out.detail.doorSides, [c[0], c[2]]),
    ];
    for (let i = 0; i < out.detail.doorSides; i++) {
      const pane = [
        rings[0][i],
        rings[0][(i + 1) % out.detail.doorSides],
        rings[1][(i + 1) % out.detail.doorSides],
        rings[1][i],
      ];
      face(out, 'clear_glass', pane, [0.68, 0.8, 0.83]);
      if (i % Math.max(1, out.detail.doorSides / 4) === 0)
        tube(out, 'stainless', rings[0][i], rings[1][i], 0.035, silver, 8);
    }
    tube(out, 'stainless', [c[0], 0.12, c[2]], [c[0], 3.08, c[2]], 0.055, silver, 10);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3,
        x = c[0] + r * Math.cos(angle),
        z = c[2] + r * Math.sin(angle);
      const pane = [
        [c[0], 0.18, c[2]],
        [x, 0.18, z],
        [x, 3.03, z],
        [c[0], 3.03, c[2]],
      ];
      face(out, 'clear_glass', pane, [0.68, 0.8, 0.83]);
      tube(out, 'stainless', [x, 0.18, z], [x, 3.03, z], 0.03, silver, 8);
    }
    loft(
      out,
      'stainless',
      [
        radialRing(3.08, r + 0.13, r + 0.13, out.detail.doorSides, [c[0], c[2]]),
        radialRing(3.4, r + 0.13, r + 0.13, out.detail.doorSides, [c[0], c[2]]),
      ],
      silver,
    );
  }
  // Shallow entrance eyebrow, aligned to the actual skew street wall.
  const roof = [at(0.16, 3.62, 0.0), at(0.84, 3.62, 0.0), at(0.84, 3.62, 2.2), at(0.16, 3.62, 2.2)];
  face(out, 'glass', roof, [0.32, 0.43, 0.46]);
  face(out, 'glass', roof.toReversed(), [0.32, 0.43, 0.46]);
  for (let i = 0; i < 4; i++)
    beam(out, 'stainless', roof[i], roof[(i + 1) % 4], 0.13, 0.17, silver);
}
function buildNative(out, mapped) {
  const ev = partsEvidence('n0195_3_world_trade_center'),
    base = cleanPlan(localOutline(mapped));
  // Raw mapped shoulder traces are irregular/overlapping; the architect's typical
  // floor plan confirms four reentrant corners and eight corner offices.
  const raw = ev
    .filter((p) => p.id >= 960146508 && p.id <= 960146511)
    .map((p) => partPlan(mapped, p));
  if (raw.length !== 4) throw Error('3 WTC needs four attributed component footprints');
  const blocks = [
    { name: 'central', plan: rect(-8.9, -16.2, 48.51, 16.2), top: levels.top },
    { name: 'north', plan: rect(-3.08, -30.432, 43.996, -16.2), top: levels.north },
    { name: 'south', plan: rect(-3.08, 16.2, 43.996, 30.432), top: levels.south },
  ];
  mappedCap(out, 'foundation', base, 0, [0.39, 0.4, 0.39], [], true);
  for (const edge of edges(base)) {
    facade(out, edge, 0, 18.288, 3.048, 3.048);
    louvers(out, edge, 18.288, 32.004);
    facade(out, edge, 32.004, levels.podium, 6.096, 3.048);
  }
  mappedCap(out, 'stone', base, levels.podium, [0.48, 0.49, 0.46]);
  for (const edge of edges(base)) glassGuard(out, edge.a, edge.b, levels.podium);
  for (let z = -20; z <= 20; z += 8) planter(out, -25, z, levels.podium, 3.4, 1.4);
  for (const block of blocks) {
    for (const edge of exposed(block, blocks, levels.podium)) {
      const hi = block.name === 'central' ? Math.min(edge.top, 310.8) : edge.top;
      if (edge.bottom < hi - 0.01) facade(out, edge, edge.bottom, hi);
      if (hi < edge.top) louvers(out, edge, hi, edge.top - 0.65);
      if (block.name === 'central')
        beam(
          out,
          'stainless',
          [edge.a[0], levels.top - 0.35, edge.a[1]],
          [edge.b[0], levels.top - 0.35, edge.b[1]],
          0.55,
          0.65,
          silver,
        );
    }
    mappedCap(
      out,
      'metal',
      block.plan,
      block.top - (block.name === 'central' ? 0.7 : 0),
      [0.34, 0.39, 0.4],
    );
    const higher = blocks.filter((b) => b.top > block.top);
    for (const e of exposed({ ...block, top: block.top + 0.1 }, higher, block.top)) {
      if (block.name !== 'central') glassGuard(out, e.a, e.b, block.top);
    }
    if (block.name !== 'central') {
      const z = block.name === 'north' ? -26.3 : 26.3;
      for (let x = 0; x <= 36; x += 9) planter(out, x, z, block.top);
      if (out.detail.plants)
        for (let x = 5; x <= 32; x += 9)
          box(
            out,
            'metal',
            [x - 1.2, block.top + 0.08, z - 3.6],
            [x + 1.2, block.top + 0.52, z - 3.0],
            [0.46, 0.42, 0.34],
          );
    }
  }
  for (const [x, side] of [
    [-3.53, -1],
    [44.446, 1],
  ]) {
    kFrame(out, x, -26.1, -16.45, levels.north, side);
    kFrame(out, x, 16.45, 26.1, levels.south, side);
  }
  // Full-height exposed corner columns project above the glass into the crown.
  for (const x of [-9.25, 48.86])
    for (const z of [-16.55, 16.55])
      box(
        out,
        'stainless',
        [x - 0.34, levels.podium, z - 0.34],
        [x + 0.34, levels.top, z + 0.34],
        silver,
      );
  // Roof mechanical deck and small service equipment below the parapet.
  if (out.detail.equipment)
    for (let x = 2; x < 39; x += 9)
      for (const z of [-8, 5]) {
        box(
          out,
          'metal',
          [x - 2.8, levels.top - 0.68, z - 2.7],
          [x + 2.8, levels.top - 0.12, z + 2.7],
          [0.44, 0.49, 0.5],
        );
        if (out.detail.equipmentGrilles)
          for (let j = 0; j < 8; j++)
            beam(
              out,
              'metal',
              [x - 2.6, levels.top - 0.08, z - 2.4 + j * 0.66],
              [x + 2.6, levels.top - 0.08, z - 2.4 + j * 0.66],
              0.12,
              0.1,
              dark,
            );
      }
  entrance(out, base);
}

const settings = {
  skyline: {
    skyline: true,
    rowStep: 40,
    moduleStep: 8,
    frames: false,
    louverStep: 4,
    flatBraces: true,
    nodes: false,
    guardPosts: 0,
    flatGuards: true,
    plants: false,
    entry: false,
    equipment: false,
  },
  district: {
    rowStep: 4,
    moduleStep: 4,
    frames: true,
    louverStep: 1.72,
    flatBraces: true,
    nodes: false,
    guardPosts: 0,
    flatGuards: true,
    plants: false,
    entry: true,
    doorSides: 12,
    cableNodes: false,
    cableNet: false,
    equipment: false,
  },
  street: {
    rowStep: 1,
    moduleStep: 2,
    frames: true,
    louverStep: 0.86,
    flatBraces: false,
    nodes: true,
    guardPosts: 4,
    plants: true,
    plantSides: 6,
    plantRows: 3,
    entry: true,
    doorSides: 20,
    cableNodes: false,
    cableNet: true,
    equipment: true,
    equipmentGrilles: false,
  },
  closeup: {
    rowStep: 1,
    moduleStep: 1,
    frames: true,
    louverStep: 0.43,
    flatBraces: false,
    nodes: true,
    guardPosts: 1,
    plants: true,
    plantSides: 12,
    plantRows: 6,
    entry: true,
    doorSides: 36,
    cableNodes: true,
    cableNet: true,
    equipment: true,
    equipmentGrilles: true,
  },
};
function build(out, name) {
  const means = {
    metal: [0.81896, 0.822889, 0.822889],
    stainless: [0.81896, 0.822889, 0.822889],
    stone: [0.701109, 0.701109, 0.701109],
    foundation: [0.701109, 0.701109, 0.701109],
    foliage: [0.701109, 0.701109, 0.701109],
  };
  const target = {
    detail: settings[name],
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) => {
          const tint = means[slot] ? c.map((v, i) => v / means[slot][i]) : c;
          if (name === 'skyline') out[k]('silhouette', 'palette:#ffffff', p, n, uv, c);
          else out[k](slot, r, p, n, uv, tint);
        },
      ]),
    ),
  };
  buildNative(target, frame);
}
export const buildThreeWtcReviewedMaster = (out) => build(out, 'closeup');
export const buildThreeWtcSkyline = (out) => build(out, 'skyline');
export const buildThreeWtcDistrict = (out) => build(out, 'district');
export const buildThreeWtcStreet = (out) => build(out, 'street');
export const buildThreeWtcCloseup = (out) => build(out, 'closeup');
