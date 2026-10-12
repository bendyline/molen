/** Four independently authored browser levels; the original 4 WTC study is retained. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const glass = [0.44, 0.555, 0.595],
  clear = [0.67, 0.76, 0.77];
const silver = [0.66, 0.71, 0.73],
  dark = [0.115, 0.155, 0.17];
const roof = [0.42, 0.45, 0.46],
  pale = [0.72, 0.72, 0.69];
const interval = 4.0894,
  top = 297.7,
  lobbyCeiling = 14.0208;
const upperBase = 279.9 - 15 * interval;
const lowerTop = upperBase - 2 * interval,
  lowerBase = lowerTop - 40 * interval;
const upperTop = upperBase + 16 * interval;
const offset = [2.6, 2.7];
const shift = ([x, z]) => [x + offset[0], z + offset[1]];
const lowerRaw = [
  [-37.56, -28.12],
  [20.352, -28.12],
  [20.352, -22.36],
  [24.52, -23.66],
  [37.49, 28.06],
  [-19.99, 28.06],
  [-19.99, 22.52],
  [-24.3, 23.6],
].map(shift);
const upperRaw = [shift([-7.1, -28.12]), ...lowerRaw.slice(1)];
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const clockwise = (p) => (area(p) < 0 ? p : p.toReversed());
const lower = clockwise(lowerRaw),
  upper = clockwise(upperRaw);
let base;
let detail;
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const tint = (n) =>
  glass.map((v) => v + (((Math.imul(n + 71, 48271) >>> 0) % 67) / 66 - 0.5) * 0.025);

function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const vector = ([x, y, z]) => [ux * x - uz * z, y, uz * x + ux * z];
  const point = (p) => {
    const q = vector(p);
    return [q[0] + a[0], q[1], q[2] + a[1]];
  };
  return {
    length,
    point,
    detail: out.detail,
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

/** Concave floor plates retain corner recesses; ear clipping never fills their notches. */
function cap(out, plan, y, slot, color, down = false) {
  const p = clockwise(plan),
    ids = p.map((_, i) => i),
    triangles = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[(i + ids.length - 1) % ids.length],
        b = ids[i],
        c = ids[(i + 1) % ids.length];
      if (cross(p[a], p[b], p[c]) >= -1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross(p[a], p[b], p[k]) < 1e-8 &&
            cross(p[b], p[c], p[k]) < 1e-8 &&
            cross(p[c], p[a], p[k]) < 1e-8,
        )
      )
        continue;
      triangles.push([a, b, c]);
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw new Error('4 WTC: floor plate cannot be triangulated');
  }
  triangles.push(ids);
  for (const t of triangles) {
    let q = t.map((i) => [p[i][0], y, p[i][1]]);
    if (down) q = q.toReversed();
    out.addTriangle(
      slot,
      'palette:#ffffff',
      q,
      normalFor(...q),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}
function slab(out, plan, y0, y1, slot = 'concrete', color = pale) {
  const p = clockwise(plan);
  loft(out, slot, [p.map(([x, z]) => [x, y0, z]), p.map(([x, z]) => [x, y1, z])], color, {
    cap: false,
  });
  cap(out, p, y0, slot, color, true);
  cap(out, p, y1, slot, color);
}
function pane(o, x0, x1, y0, y1, serial, transparent = false, z = 0) {
  if (!transparent) {
    // A flush pane keeps its slight tint; its 1.3 cm joints and 4 mm bevels are below every
    // runtime level's error. Neighbouring panes share edges, so a facade is one surface.
    face(
      o,
      'glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      tint(serial),
    );
    return;
  }
  if (detail.level !== 'closeup') {
    face(
      o,
      detail.level === 'skyline' ? 'glass' : 'clear_glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      clear,
    );
    return;
  }
  const gap = 0.013,
    bevel = 0.004;
  const ring = (g, d) => [
    [x0 + g, y0 + g, d],
    [x1 - g, y0 + g, d],
    [x1 - g, y1 - g, d],
    [x0 + g, y1 - g, d],
  ];
  const front = ring(gap + bevel, z),
    rim = ring(gap, z - bevel),
    seal = ring(0, z - bevel);
  face(o, 'clear_glass', front, clear);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, 'metal', [rim[i], rim[j], front[j], front[i]], dark);
    // Join the seal to the bevel exactly. An unconnected recessed strip lets the
    // sky through at oblique angles; overlapping corner strips also fight in depth.
    face(o, 'recess', [seal[i], seal[j], rim[j], rim[i]], dark);
  }
}
function curtain(out, plan, y0, rows, step = interval, serial = 0) {
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    const count = Math.max(1, Math.round(o.length / detail.bay)),
      w = o.length / count;
    for (let row = 0; row < rows; row += detail.floorStride)
      for (let i = 0; i < count; i++)
        pane(
          o,
          i * w,
          (i + 1) * w,
          y0 + row * step,
          y0 + Math.min(rows, row + detail.floorStride) * step,
          serial + row * 173 + k * 997 + i,
        );
  }
}
function louvres(o, x0, x1, y0, y1) {
  face(
    o,
    'recess',
    [
      [x0, y0, -0.08],
      [x1, y0, -0.08],
      [x1, y1, -0.08],
      [x0, y1, -0.08],
    ],
    dark,
  );
  if (detail.level === 'skyline') return;
  // Folded fins retain depth in the two near levels; district retains wider strips.
  const count = Math.max(2, Math.round((x1 - x0) / detail.finPitch)),
    w = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const x = x0 + i * w;
    // Folded vertical weather fins supply actual depth and return edges.
    face(
      o,
      'metal',
      [
        [x, y0, -0.06],
        [x + w * 0.57, y0, 0.035],
        [x + w * 0.57, y1, 0.035],
        [x, y1, -0.06],
      ],
      silver,
    );
    face(
      o,
      'metal',
      [
        [x + w * 0.57, y0, 0.035],
        [x + w * 0.83, y0, -0.015],
        [x + w * 0.83, y1, -0.015],
        [x + w * 0.57, y1, 0.035],
      ],
      silver,
    );
  }
  if (detail.level === 'closeup') box(o, 'metal', [x0, y0, -0.02], [x1, y0 + 0.055, 0.045], silver);
  if (detail.level === 'closeup') box(o, 'metal', [x0, y1 - 0.055, -0.02], [x1, y1, 0.045], silver);
}
function plantBand(out, plan, y0, y1) {
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]),
      n = Math.max(1, Math.round(o.length / detail.bay)),
      w = o.length / n;
    for (let i = 0; i < n; i++) {
      pane(o, i * w, i * w + w * 0.52, y0, y1, k * 503 + i);
      louvres(o, i * w + w * 0.54, (i + 1) * w - 0.02, y0 + 0.025, y1 - 0.025);
    }
  }
}
function rail(out, a, b, y) {
  const o = edge(out, a, b),
    n = Math.max(1, Math.round(o.length / detail.railBay));
  for (let i = 0; i < n; i++)
    pane(o, (i * o.length) / n, ((i + 1) * o.length) / n, y + 0.08, y + 1.1, i, true, -0.15);
  if (detail.level !== 'skyline')
    tube(
      o,
      'stainless',
      [0, y + 1.12, -0.15],
      [o.length, y + 1.12, -0.15],
      0.032,
      silver,
      detail.sections,
    );
  if (detail.level !== 'skyline')
    for (let i = 0; i <= n; i++)
      box(
        o,
        'stainless',
        [(i * o.length) / n - 0.021, y, -0.2],
        [(i * o.length) / n + 0.021, y + 1.12, -0.1],
        silver,
      );
}
function revolving(out, x, z) {
  const r = 1.42,
    h = 3.32;
  for (const [y0, y1] of detail.level === 'skyline'
    ? [[h, h + 0.23]]
    : [
        [0.08, 0.12],
        [h, h + 0.23],
      ])
    loft(
      out,
      'stainless',
      [
        radialRing(y0, r + 0.08, r + 0.08, detail.drumSides, [x, z]),
        radialRing(y1, r + 0.08, r + 0.08, detail.drumSides, [x, z]),
      ],
      silver,
    );
  if (detail.level !== 'skyline')
    tube(out, 'stainless', [x, 0.12, z], [x, h, z], 0.065, silver, detail.sections);
  for (const start of [-Math.PI * 0.3, Math.PI * 0.7])
    for (let i = 0; i < detail.curveSides; i++) {
      const a = start + (i * Math.PI * 0.6) / detail.curveSides,
        b = start + ((i + 1) * Math.PI * 0.6) / detail.curveSides;
      const p = (t, y) => [x + r * Math.cos(t), y, z + r * Math.sin(t)];
      face(out, 'clear_glass', [p(b, 0.13), p(a, 0.13), p(a, h), p(b, h)], clear);
      if (detail.level !== 'skyline' && i % Math.max(1, Math.floor(detail.curveSides / 3)) === 0)
        tube(out, 'stainless', p(a, 0.12), p(a, h), 0.023, silver, detail.sections);
    }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3,
      o = edge(out, [x, z], [x + (r - 0.06) * Math.cos(a), z + (r - 0.06) * Math.sin(a)]);
    pane(o, 0.05, o.length, 0.15, h - 0.04, i, true);
    if (detail.level === 'closeup')
      tube(
        o,
        'stainless',
        [0.09, 1.15, 0.04],
        [o.length - 0.08, 1.15, 0.04],
        0.019,
        silver,
        detail.sections,
      );
  }
  if (detail.level === 'closeup')
    torus(out, 'stainless', [x, 0.135, z], r, 0.025, silver, detail.drumSides, 4);
}
function lobby(out) {
  slab(out, base, 0, 0.12, 'marble');
  slab(out, base, lobbyCeiling, lobbyCeiling + 0.35, 'marble');
  // A restrained visible lobby interior; tenant rooms and sculpture are not invented.
  box(out, 'stone', [-17, 0.12, -11], [22, lobbyCeiling, 10], [0.08, 0.09, 0.09]);
  if (detail.level !== 'skyline')
    for (const x of [-11, 1, 13]) {
      box(out, 'wood', [x - 2.6, 0.12, 10.01], [x + 2.6, 5.6, 10.13], [0.55, 0.37, 0.17]);
      box(out, 'recess', [x - 1.75, 0.14, 10.14], [x + 1.75, 4.5, 10.17], dark);
      for (const side of [-1, 1])
        box(
          out,
          'stainless',
          [x + side * 1.68 - 0.024, 0.15, 10.18],
          [x + side * 1.68 + 0.024, 4.51, 10.23],
          silver,
        );
    }
  for (let k = 0; k < base.length; k++) {
    const o = edge(out, base[k], base[(k + 1) % base.length]);
    const n = Math.max(1, Math.round(o.length / detail.bay)),
      w = o.length / n;
    // The Greenwich/memorial frontage is split into two mapped edges. Primary
    // architect photograph 24_01 shows a paired revolving entrance here.
    // Centers are reconstructed around the map join; exact jamb offsets are not surveyed.
    const midpointX = (base[k][0] + base[(k + 1) % base.length][0]) / 2;
    const memorial = midpointX < -32 && o.length > 20;
    const join = [-35.658, 2.942];
    const aNear = Math.hypot(base[k][0] - join[0], base[k][1] - join[1]) < 0.1;
    const doors = memorial
      ? [aNear ? 3.5 : o.length - 3.5]
      : o.length > 45 && midpointX < 35
        ? [0.35, 0.67].map(
            (t) =>
              ((Math.floor(Math.round(o.length / 1.524) * t) + 0.5) * o.length) /
              Math.round(o.length / 1.524),
          )
        : [];
    const openings = doors.map((x) => [x - 2.55, x + 2.55]);
    for (let i = 0; i < n; i++) {
      let segments = [[i * w, (i + 1) * w]];
      for (const [a, b] of openings)
        segments = segments.flatMap(([lo, hi]) =>
          hi <= a || lo >= b
            ? [[lo, hi]]
            : [
                [lo, Math.min(hi, a)],
                [Math.max(lo, b), hi],
              ].filter(([l, h]) => h - l > 0.04),
        );
      for (const [lo, hi] of segments) pane(o, lo, hi, 0.14, 3.6, i, true, -0.11);
      for (let row = 0; row < detail.lobbyRows; row++)
        pane(
          o,
          i * w,
          (i + 1) * w,
          3.6 + (row * (lobbyCeiling - 3.6)) / detail.lobbyRows,
          3.6 + ((row + 1) * (lobbyCeiling - 3.6)) / detail.lobbyRows,
          i + row * 97,
          true,
          -0.11,
        );
    }
    if (detail.level !== 'skyline')
      for (let i = 0; i <= n; i++) {
        const overDoor = openings.some(([a, b]) => i * w >= a - 0.04 && i * w <= b + 0.04);
        box(
          o,
          'stainless',
          [i * w - 0.036, overDoor ? 3.6 : 0.12, -0.27],
          [i * w + 0.036, lobbyCeiling, 0.015],
          silver,
        );
      }
    for (const x of doors) {
      const col = Math.round(x / w);
      revolving(o, x, -0.55);
      // Balanced swing door beside the revolving drum, with visible pull hardware.
      for (const sign of [-1, 1]) {
        const xx = x + sign * 1.98;
        pane(o, xx - 0.5, xx + 0.5, 0.15, 3.3, col, true, -0.09);
        if (detail.level === 'closeup')
          tube(
            o,
            'stainless',
            [xx + 0.32, 1.02, 0],
            [xx + 0.32, 1.5, 0],
            0.018,
            silver,
            detail.sections,
          );
        if (detail.level !== 'skyline')
          for (const side of [-1, 1])
            box(
              o,
              'stainless',
              [xx + side * 0.52 - 0.025, 0.12, -0.18],
              [xx + side * 0.52 + 0.025, 3.6, 0],
              silver,
            );
      }
      pane(o, x - 2.55, x + 2.55, 3.32, 3.6, col, true, -0.11);
      box(o, 'stainless', [x - 3, 3.62, -0.15], [x + 3, 3.73, 0.85], silver);
    }
    if (detail.level !== 'skyline' && o.length > 35)
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const p = o.point([o.length * t, 0, -1.65]);
        box(
          out,
          'stainless',
          [p[0] - 0.29, 0.12, p[2] - 0.29],
          [p[0] + 0.29, lobbyCeiling, p[2] + 0.29],
          silver,
        );
      }
  }
  curtain(out, base, lobbyCeiling + 0.35, 2, 5.7, 10000);
  slab(out, base, 25.7708, 25.95, 'recess', roof);
  slab(out, lower, 25.95, 26.16, 'metal', silver);
  curtain(out, lower, 26.16, 3, (lowerBase - 26.16) / 4, 20000);
  plantBand(out, lower, lowerBase - (lowerBase - 26.16) / 4, lowerBase);
}
function build(out) {
  lobby(out);
  curtain(out, lower, lowerBase, 40, interval, 30000);
  plantBand(out, lower, lowerTop, upperBase - 0.18);
  const terrace = clockwise([lowerRaw[0], upperRaw[0], lowerRaw.at(-1)]);
  slab(out, terrace, upperBase - 0.18, upperBase, 'stone', [0.57, 0.59, 0.58]);
  rail(out, lowerRaw[0], lowerRaw.at(-1), upperBase);
  rail(out, upperRaw[0], lowerRaw[0], upperBase);
  // Fine paving joints are clipped to the triangular terrace, not extended through the tower.
  if (detail.level === 'closeup')
    for (let t = 0.04; t < 0.98; t += 0.035) {
      const a = mix(lowerRaw[0], upperRaw[0], t),
        b = mix(lowerRaw[0], lowerRaw.at(-1), t);
      beam(
        out,
        'metal',
        [a[0], upperBase + 0.007, a[1]],
        [b[0], upperBase + 0.007, b[1]],
        0.014,
        0.007,
        [0.32, 0.35, 0.36],
      );
    }
  curtain(out, upper, upperBase, 16, interval, 50000);
  curtain(out, upper, upperTop, 1, 3.85, 70000);
  plantBand(out, upper, upperTop + 3.85, top - 0.55);
  curtain(out, upper, top - 0.55, 1, 0.55, 80000);
  cap(out, upper, top - 0.32, 'recess', roof);
  if (detail.level !== 'skyline')
    for (let k = 0; k < upper.length; k++) {
      const o = edge(out, upper[k], upper[(k + 1) % upper.length]);
      box(o, 'stainless', [0, top - 0.05, -0.15], [o.length, top, 0.025], silver);
    }
}

const levels = {
  skyline: {
    bay: 24.384,
    floorStride: 40,
    finPitch: 4,
    railBay: 100,
    sections: 4,
    drumSides: 4,
    curveSides: 1,
    lobbyRows: 1,
  },
  district: {
    bay: 12.192,
    floorStride: 8,
    finPitch: 4,
    railBay: 12,
    sections: 4,
    drumSides: 8,
    curveSides: 3,
    lobbyRows: 1,
  },
  street: {
    bay: 3.048,
    floorStride: 2,
    finPitch: 0.72,
    railBay: 3,
    sections: 6,
    drumSides: 16,
    curveSides: 8,
    lobbyRows: 2,
  },
  closeup: {
    bay: 1.524,
    floorStride: 1,
    finPitch: 0.36,
    railBay: 1.5,
    sections: 8,
    drumSides: 24,
    curveSides: 16,
    lobbyRows: 3,
  },
};
function buildLevel(out, frame, name) {
  frame ??= JSON.parse(
    readFileSync(structureSourcePath('n0218_4_world_trade_center', 'map-frame.json')),
  );
  base = clockwise(frame.geometry.outline.slice(0, -1));
  detail = { ...levels[name], level: name };
  const target = { detail };
  for (const key of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    target[key] = (...args) => {
      if (name === 'skyline') {
        if (args[0] === 'clear_glass') args[0] = 'glass';
        const means = {
          stone: 0.9160827848592121,
          marble: 0.9160827848592121,
          wood: 0.9160827848592121,
          metal: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
          stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
          recess: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
        };
        const mean = means[args[0]];
        if (mean) args[5] = args[5].map((v, i) => v * (Array.isArray(mean) ? mean[i] : mean));
      }
      return out[key](...args);
    };
  build(target);
}
export const buildFourWtcSkyline = (out, frame) => buildLevel(out, frame, 'skyline');
export const buildFourWtcDistrict = (out, frame) => buildLevel(out, frame, 'district');
export const buildFourWtcStreet = (out, frame) => buildLevel(out, frame, 'street');
export const buildFourWtcCloseup = (out, frame) => buildLevel(out, frame, 'closeup');
export const buildFourWtcReviewedMaster = (out, frame) => buildLevel(out, frame, 'closeup');
