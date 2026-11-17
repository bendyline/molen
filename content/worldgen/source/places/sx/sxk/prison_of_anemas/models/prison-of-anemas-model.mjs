/** The paired Anemas towers and Blachernae terrace wall in Istanbul. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const map = read('map-frame');
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const dims = plan.dimensions;
const front = map.geometry.centerlines[0];
const up = [0, 1, 0];
const ref = 'palette:#ffffff';
const surfaces = {
  cut: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  rubble: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#e6dac5', roughness: 0.96, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    rubble: 'bdad94',
    cut: 'b9ab90',
    ashlar: 'bfad92',
    pale: 'c9baa1',
    buff: 'b2a38b',
    shadow: '696050',
    edge: '968773',
    brick: 'a6735e',
    pink: 'bc8c70',
    vault: '8d7d6d',
    footing: 'a09480',
    lintel: 'b9ae98',
    terrace: '9e917a',
    grit: '8f826f',
    raw: 'b1a38e',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const p3 = ([x, z], y) => [x, y, z];
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const clamp = (t) => Math.min(1, Math.max(0, t));
const mix = (a, b, t) => a + (b - a) * t;

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  return (
    mix(
      mix(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i),
      mix(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i),
      v - j,
    ) - terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      normal,
      points.map(([x, , z]) => [x, z]),
      tint,
    );
}

function cap(out, slot, outline, holes, height, tint) {
  const triangulation = new MeshBufferBuilder();
  if (!triangulation.addCap(slot, ref, outline, holes, height, up, (p) => p, tint))
    throw new Error('Cannot triangulate the Anemas wall plan');
  const { indices, positions } = triangulation.finalize();
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      Array.from(indices.slice(i, i + 3), (a) => Array.from(positions.slice(a * 3, a * 3 + 3))),
      up,
      tint,
    );
}

function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [sign * dz, 0, -sign * dx];
  return {
    length,
    n,
    point(u, offset = 0) {
      return [a[0] + dx * u + n[0] * offset, a[1] + dz * u + n[2] * offset];
    },
    at(u, y, offset = 0) {
      return p3(this.point(u, offset), y);
    },
  };
}

function panel(out, f, slot, a, b, b0, b1, t0, t1, d, tint) {
  face(out, slot, [f.at(a, b0, d), f.at(b, b1, d), f.at(b, t1, d), f.at(a, t0, d)], f.n, tint);
}
function course(out, f, slot, a, b, low, high, d, tint) {
  if (b - a < 0.025 || high - low < 0.015) return;
  panel(out, f, slot, a, b, low, low, high, high, d, tint);
}
function side(out, f, a, from, to, bottom, top, direction, tint) {
  const pts = [f.at(a, bottom, from), f.at(a, bottom, to), f.at(a, top, to), f.at(a, top, from)];
  face(out, 'stone', pts, direction, tint);
}

function head(u, hole) {
  const t = (u - hole.u) / hole.half;
  return hole.spring + Math.sqrt(Math.max(0, 1 - t * t)) * hole.rise;
}

function arch(out, f, hole, lod) {
  const { u, half, bottom, spring, rise } = hole;
  const a = u - half,
    b = u + half,
    inner = -0.74;
  const n = lod >= 2 ? 10 : 4;
  course(out, f, 'detail', a, b, bottom, spring, inner, color.shadow);
  const across = [-f.n[2], 0, f.n[0]];
  side(out, f, a, inner, 0, bottom, spring, across, color.edge);
  side(
    out,
    f,
    b,
    inner,
    0,
    bottom,
    spring,
    across.map((v) => -v),
    color.edge,
  );
  for (let i = 0; i < n; i++) {
    const t0 = Math.PI * (1 - i / n),
      t1 = Math.PI * (1 - (i + 1) / n);
    const v0 = u + Math.cos(t0) * half,
      v1 = u + Math.cos(t1) * half;
    const h0 = spring + Math.sin(t0) * rise,
      h1 = spring + Math.sin(t1) * rise;
    panel(out, f, 'detail', v0, v1, spring - 0.002, spring - 0.002, h0, h1, inner, color.shadow);
    face(
      out,
      'stone',
      [f.at(v0, h0, inner), f.at(v1, h1, inner), f.at(v1, h1), f.at(v0, h0)],
      [0, -1, 0],
      color.edge,
    );
    if (lod < 2) continue;
    const r = hole.trim ?? 0.18;
    const a0 = u + Math.cos(t0) * (half + r),
      a1 = u + Math.cos(t1) * (half + r);
    face(
      out,
      hole.brick ? 'brick' : 'stone',
      [
        f.at(v0, h0, 0.028),
        f.at(v1, h1, 0.028),
        f.at(a1, spring + Math.sin(t1) * (rise + r), 0.075),
        f.at(a0, spring + Math.sin(t0) * (rise + r), 0.075),
      ],
      f.n,
      hole.brick ? color.pink : color.ashlar,
    );
  }
  face(
    out,
    'stone',
    [
      f.at(a, bottom, 0.065),
      f.at(b, bottom, 0.065),
      f.at(b, bottom, inner),
      f.at(a, bottom, inner),
    ],
    up,
    color.footing,
  );
}

function textureBands(out, f, slot, a, b, low, high, lod, seed) {
  if (lod < 2) return;
  const tint = [color.pale, color.ashlar, color.cut, color.buff, color.raw];
  const height = lod === 2 ? 0.89 : 0.64;
  const width = lod === 2 ? 1.51 : 1.13;
  for (let row = 0; low + (row + 1) * height <= high; row++) {
    const offset = (row % 2) * width * 0.45;
    const y = low + row * height;
    for (let col = -1; a + offset + col * width < b; col++) {
      const u = Math.max(a, a + offset + col * width + 0.014);
      const v = Math.min(b, a + offset + (col + 1) * width - 0.019);
      if (v - u < 0.11) continue;
      const i = Math.abs((col + 4) * 29 + row * 17 + seed * 7) % 19;
      if (lod === 2 && i % 3 === 1) continue;
      const d = 0.012 + (i % 4) * 0.013;
      course(out, f, slot, u, v, y + 0.018, y + height - 0.022, d, tint[i % tint.length]);
    }
  }
}

/** Masonry facade with a sawtooth crown and real recessed openings. */
function facade(
  out,
  f,
  { slot, tint, low, crown, holes = [], banded = false, nearStone = false },
  lod,
) {
  if (!lod) {
    panel(
      out,
      f,
      slot,
      0,
      f.length,
      low(f.point(0)),
      low(f.point(f.length)),
      crown(0),
      crown(f.length),
      0,
      tint,
    );
    if (banded) {
      for (const y of [6.05, 9.1, 12.15, 15.2]) {
        if (y + 0.28 < Math.min(crown(0), crown(f.length)))
          course(out, f, 'brick', 0, f.length, y, y + 0.28, 0.036, color.brick);
      }
    }
    for (const { u, half, bottom, spring, rise } of holes) {
      course(out, f, 'detail', u - half, u + half, bottom, spring, 0.063, color.shadow);
      face(
        out,
        'detail',
        [
          f.at(u - half, spring, 0.063),
          f.at(u + half, spring, 0.063),
          f.at(u, spring + rise, 0.063),
        ],
        f.n,
        color.shadow,
      );
    }
    return;
  }
  const cuts = new Set([0, f.length]);
  const segments = lod === 0 ? 1 : Math.ceil(f.length / (lod >= 2 ? 2.1 : 5));
  for (let i = 1; i < segments; i++) cuts.add((f.length * i) / segments);
  const n = lod >= 2 ? 10 : 4;
  for (const hole of holes) {
    for (let i = 0; i <= n; i++) {
      const theta = Math.PI * (1 - i / n);
      cuts.add(hole.u + Math.cos(theta) * hole.half);
    }
  }
  const keys = [...cuts].sort((a, b) => a - b);
  const bands = banded ? [5.9, 7.45, 9, 10.55, 12.1, 13.65, 15.2, 16.75, 18.3, 19.85] : [];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1],
      b = keys[i];
    if (b - a < 0.00005) continue;
    const g0 = low(f.point(a)),
      g1 = low(f.point(b));
    const t0 = crown(a),
      t1 = crown(b);
    const open = holes
      .filter(({ u, half }) => Math.abs((a + b) / 2 - u) < half)
      .sort((x, y) => x.bottom - y.bottom);
    let bottomA = g0,
      bottomB = g1;
    for (const hole of open) {
      panel(out, f, slot, a, b, bottomA, bottomB, hole.bottom, hole.bottom, 0, tint);
      bottomA = head(a, hole);
      bottomB = head(b, hole);
    }
    panel(out, f, slot, a, b, bottomA, bottomB, t0, t1, 0, tint);
    for (const y of bands) {
      if (y < Math.max(g0, g1) || y + 0.29 > Math.min(t0, t1)) continue;
      if (open.some((hole) => y + 0.37 > hole.bottom && y < Math.max(head(a, hole), head(b, hole))))
        continue;
      course(out, f, 'brick', a, b, y, y + 0.23, 0.036, color.brick);
      if (lod >= 2) course(out, f, 'brick', a, b, y + 0.27, y + 0.37, 0.041, color.pink);
    }
  }
  for (const hole of holes) arch(out, f, hole, lod);
  if (nearStone && lod >= 2) {
    const commonLow = Math.ceil(Math.max(low(f.point(0)), low(f.point(f.length)))) + 0.05;
    const high = Math.min(
      ...holes.map((h) => h.bottom),
      Math.min(crown(0), crown(f.length)) - 0.23,
    );
    textureBands(
      out,
      f,
      'stone',
      0.035,
      f.length - 0.036,
      commonLow,
      high,
      lod,
      Math.round(f.length),
    );
  }
}

const sit = (p) => ground(p) - 0.4;
const terraceStart = -17.8,
  terraceEnd = terraceStart + dims.wallSpanMeters;
const edgeZ = (x) =>
  mix(front[1][1], front[5][1], clamp((x - front[1][0]) / (front[5][0] - front[1][0])));
const roofLevel = ([x]) => dims.wallCrownY - 0.022 * (x - 3);
const hallRear = 12.65;
const mainFoot = [
  [terraceStart, edgeZ(terraceStart)],
  [terraceEnd, edgeZ(terraceEnd)],
  [terraceEnd, hallRear],
  [terraceStart, hallRear],
];

function taperedButtress(out, f, u, width, reach, top, lod, block) {
  const l = u - width / 2,
    r = u + width / 2;
  const a = f.point(l, reach),
    b = f.point(r, reach);
  const bottomA = sit(a),
    bottomB = sit(b);
  const backBottomA = sit(f.point(l, -0.18)),
    backBottomB = sit(f.point(r, -0.18));
  const tip = reach * (block ? 0.72 : 0.48);
  const meet = top - 0.3;
  const slot = block ? 'cut' : 'rubble',
    tint = block ? color.cut : color.footing;
  face(
    out,
    slot,
    [f.at(l, bottomA, reach), f.at(r, bottomB, reach), f.at(r, meet, tip), f.at(l, meet, tip)],
    f.n,
    tint,
  );
  const across = Math.abs(f.n[2]) > 0.6 ? [1, 0, 0] : [0, 0, 1];
  face(
    out,
    slot,
    [f.at(l, backBottomA, -0.18), f.at(l, bottomA, reach), f.at(l, meet, tip), f.at(l, top, -0.18)],
    across.map((v) => -v),
    color.edge,
  );
  face(
    out,
    slot,
    [f.at(r, backBottomB, -0.18), f.at(r, bottomB, reach), f.at(r, meet, tip), f.at(r, top, -0.18)],
    across,
    color.edge,
  );
  face(
    out,
    'stone',
    [f.at(l, meet, tip), f.at(r, meet, tip), f.at(r, top, -0.18), f.at(l, top, -0.18)],
    up,
    color.pale,
  );
  if (lod >= 2) {
    const h0 = Math.ceil(Math.max(bottomA, bottomB)) + 0.35;
    const average = (bottomA + bottomB) * 0.5;
    const depth = (y) => mix(reach, tip, clamp((y - average) / (meet - average))) + 0.015;
    for (let y = h0; y + 0.51 < meet; y += 0.71) {
      face(
        out,
        'stone',
        [
          f.at(l + 0.034, y, depth(y)),
          f.at(r - 0.035, y, depth(y)),
          f.at(r - 0.035, y + 0.61, depth(y + 0.61)),
          f.at(l + 0.034, y + 0.61, depth(y + 0.61)),
        ],
        f.n,
        color.ashlar,
      );
    }
  }
}

function hall(out, lod) {
  const frontEdge = edge(mainFoot[0], mainFoot[1]);
  const openings = [];
  const gap = dims.wallSpanMeters / dims.hallChambers;
  for (let i = 0; i < dims.hallChambers; i++) {
    const x = terraceStart + gap * (i + 0.5);
    if (x > -14.25 && x < 14.65) continue;
    const u = x - terraceStart;
    openings.push({ u, half: 0.43, bottom: 11.6, spring: 12.44, rise: 0.23, brick: lod >= 2 });
    if (lod) openings.push({ u, half: 0.31, bottom: 7.55, spring: 8.47, rise: 0.28 });
  }
  const wallLook = {
    slot: 'rubble',
    tint: color.rubble,
    low: sit,
    crown: (u) => roofLevel(frontEdge.point(u)),
    nearStone: true,
  };
  // Render the tower overlap as a closed retaining face and separate exposed bays.
  facade(out, frontEdge, { ...wallLook, holes: openings, banded: true }, lod);
  for (const i of [1, 3]) {
    const f = edge(mainFoot[i], mainFoot[(i + 1) % mainFoot.length]);
    facade(
      out,
      f,
      { slot: 'rubble', tint: color.edge, low: sit, crown: (u) => roofLevel(f.point(u)) },
      0,
    );
  }
  cap(out, 'detail', mainFoot, [], roofLevel, color.terrace);
  embankment(out);
  for (let i = 0; i <= dims.hallChambers; i++) {
    const u = 0.58 + gap * i;
    if (u > frontEdge.length - 0.45) continue;
    const x = terraceStart + u;
    if (x > -14.45 && x < 14.55) continue;
    taperedButtress(
      out,
      frontEdge,
      u,
      1.55,
      2.01,
      roofLevel(frontEdge.point(u)) - 0.78,
      lod,
      i % 3 === 0,
    );
  }
  if (lod) {
    for (const [a, b] of [
      [0.05, 3.58],
      [32.54, frontEdge.length - 0.14],
    ]) {
      const ya = roofLevel(frontEdge.point(a)),
        yb = roofLevel(frontEdge.point(b));
      panel(
        out,
        frontEdge,
        'stone',
        a,
        b,
        ya - 0.32,
        yb - 0.32,
        ya + 0.034,
        yb + 0.034,
        0.055,
        color.pale,
      );
    }
  }
  if (lod === 3) upperVaults(out);
}

/** Exposed edge of the reconstructed upper terrace, merging into the native grade. */
function embankment(out) {
  const profile = (x, t) => {
    const z = hallRear + t * (27.7 + 1.55 * Math.sin(x * 0.11));
    const natural = ground([x, z]);
    const y = mix(natural - 0.35, roofLevel([x, hallRear]), (1 - t) * (1 - t));
    return [x, y, z];
  };
  const posts = [terraceStart, terraceStart + 8, 0, 12, 25, terraceEnd - 8, terraceEnd];
  const bands = [0, 0.29, 0.56, 0.81, 1];
  for (let j = 0; j < bands.length - 1; j++) {
    const a = bands[j],
      b = bands[j + 1];
    for (let i = 0; i < posts.length - 1; i++) {
      const x = posts[i],
        v = posts[i + 1],
        p = [profile(x, a), profile(v, a), profile(v, b), profile(x, b)];
      face(out, 'detail', [p[0], p[1], p[2]], up, color.terrace);
      face(out, 'detail', [p[0], p[2], p[3]], up, color.terrace);
    }
    for (const [x, sign] of [
      [terraceStart, -1],
      [terraceEnd, 1],
    ]) {
      const p = profile(x, a),
        q = profile(x, b);
      face(
        out,
        'rubble',
        [p, q, [q[0], ground([q[0], q[2]]) - 0.4, q[2]], [p[0], ground([p[0], p[2]]) - 0.4, p[2]]],
        [sign, 0, 0],
        color.footing,
      );
    }
  }
}

function upperVaults(out) {
  const gap = dims.wallSpanMeters / dims.hallChambers;
  const floor = 8.84,
    ceiling = 13.1,
    archHeight = 1.35;
  const rear = hallRear - 0.71,
    innerZ = -0.65;
  for (let i = 0; i < dims.hallChambers; i++) {
    const a = terraceStart + gap * i + 0.29,
      b = a + gap - 0.58;
    const axis = (a + b) / 2,
      radius = (b - a) / 2;
    for (let j = 0; j < 7; j++) {
      const t0 = (Math.PI * j) / 7,
        t1 = (Math.PI * (j + 1)) / 7;
      const x0 = axis + Math.cos(t0) * radius,
        x1 = axis + Math.cos(t1) * radius;
      const h0 = ceiling + Math.sin(t0) * archHeight,
        h1 = ceiling + Math.sin(t1) * archHeight;
      face(
        out,
        'rubble',
        [
          [x0, h0, innerZ],
          [x1, h1, innerZ],
          [x1, h1, rear],
          [x0, h0, rear],
        ],
        [0, -1, 0],
        color.vault,
      );
    }
    box(out, 'stone', [a - 0.29, floor, innerZ], [a + 0.09, ceiling - 0.08, rear], color.vault);
    box(out, 'stone', [a, floor - 0.25, innerZ], [b, floor, rear], color.edge);
  }
}

const southFrontZ = front[2][1] - 0.025,
  northFrontZ = front[3][1] - 0.012;
const south = {
  polygon: [
    [-13.54, southFrontZ],
    [-2.57, southFrontZ - 0.11],
    [-2.29, southFrontZ + dims.southTowerDepth],
    [-13.85, southFrontZ + dims.southTowerDepth - 0.39],
  ],
  top: dims.southTowerCrownY,
  rough: false,
};
const north = {
  polygon: [
    [-1.59, northFrontZ + 0.225],
    [13.043, northFrontZ],
    [13.62, northFrontZ + dims.northTowerDepth],
    [-1.99, northFrontZ + dims.northTowerDepth + 0.46],
  ],
  top: dims.northTowerCrownY,
  rough: true,
};

function batteredBase(out, shape, lod) {
  const top = 7.15,
    band = shape.rough ? 'rubble' : 'cut';
  const [a, b] = shape.polygon;
  const f = edge(a, b);
  const l = -0.44,
    r = f.length + 0.43;
  const depth = shape.rough ? 1.56 : 1.91;
  taperedButtress(out, f, f.length / 2, r - l, depth, top, lod, !shape.rough);
  if (lod >= 1) {
    const joints = shape.rough ? [0.85, 3.5, 7.8, 11.9, 13.44] : [1.25, 4.7, 8.2];
    for (const j of joints) {
      if (j > f.length - 0.45) continue;
      taperedButtress(
        out,
        f,
        j,
        shape.rough ? 0.75 : 0.86,
        depth + 0.48,
        top - 0.46,
        lod,
        !shape.rough,
      );
    }
  }
  const stringCourseY = 7.22;
  course(out, f, band, 0, f.length, stringCourseY, stringCourseY + 0.34, 0.26, color.pale);
}

function towerCrown(out, f, y, lod, seed) {
  const count = lod >= 2 ? Math.ceil(f.length / 1.08) : Math.ceil(f.length / 2.42);
  for (let i = 0; i < count; i++) {
    const a = (f.length * i) / count,
      b = (f.length * (i + 0.88)) / count;
    const step = ((i * 17 + seed * 13) % 8) * 0.105 + 0.17;
    const h0 = y(a),
      h1 = y(b);
    if (i % 6 === 4 || i % 9 === 8) continue;
    face(
      out,
      'rubble',
      [
        f.at(a, h0 - 0.04, 0.025),
        f.at(b, h1 - 0.04, 0.025),
        f.at(b, h1 + step, 0.021),
        f.at(a, h0 + step * 0.81, 0.021),
      ],
      f.n,
      color.rubble,
    );
    face(
      out,
      'stone',
      [
        f.at(a, h0 + step * 0.81, 0.021),
        f.at(b, h1 + step, 0.021),
        f.at(b, h1 + step * 0.81, -0.68),
        f.at(a, h0 + step * 0.68, -0.68),
      ],
      up,
      color.raw,
    );
    if (lod >= 2) {
      panel(
        out,
        f,
        'rubble',
        a,
        b,
        h0 - 0.11,
        h1 - 0.11,
        h0 + step * 0.68,
        h1 + step * 0.81,
        -0.68,
        color.rubble,
      );
      const along = [-f.n[2], 0, f.n[0]];
      for (const [u, h, sign] of [
        [a, h0, -1],
        [b, h1, 1],
      ]) {
        face(
          out,
          'rubble',
          [
            f.at(u, h - 0.07, -0.68),
            f.at(u, h - 0.04, 0.025),
            f.at(u, h + step * 0.85, 0.021),
            f.at(u, h + step * 0.7, -0.68),
          ],
          along.map((v) => v * sign),
          color.edge,
        );
      }
    }
  }
}

function tower(out, shape, lod) {
  const ring = shape.polygon;
  const center = ring.reduce(([x, z], p) => [x + p[0] / 4, z + p[1] / 4], [0, 0]);
  const floorTop = shape.top - 2.35;
  const insetRing = ring.map(([x, z]) => [mix(x, center[0], 0.185), mix(z, center[1], 0.185)]);
  batteredBase(out, shape, lod);
  const y = (p) => floorTop + 0.058 * (p[0] - center[0]) + 0.03 * (p[1] - center[1]);
  for (const [i, p] of ring.entries()) {
    const j = (i + 1) % ring.length;
    const f = edge(p, ring[j]);
    const outer = i === 0 || (i === 1 && shape.rough) || (i === 3 && !shape.rough);
    const holes = [];
    if (outer) {
      if (shape.rough && i === 0) {
        for (const u of [f.length * 0.23, f.length * 0.5, f.length * 0.75])
          holes.push({ u, half: 1.21, bottom: 15.15, spring: 17.7, rise: 0.99, trim: 0.21 });
        if (lod)
          holes.push({ u: f.length * 0.5, half: 0.83, bottom: 10.3, spring: 11.69, rise: 0.34 });
      } else {
        holes.push({
          u: f.length * 0.5,
          half: i === 0 ? 1.28 : 0.88,
          bottom: 14.1,
          spring: 16.63,
          rise: 1.08,
          brick: !shape.rough,
          trim: 0.23,
        });
        if (lod >= 1)
          holes.push({ u: f.length * 0.7, half: 0.36, bottom: 9.95, spring: 11.04, rise: 0.14 });
      }
    }
    if (i === 3 && !shape.rough) {
      holes.push({
        u: f.length * 0.7,
        half: 0.62,
        bottom: 3.2,
        spring: 4.68,
        rise: 0.51,
        brick: true,
      });
    }
    const crown = (u) => y(f.point(u));
    facade(
      out,
      f,
      {
        slot: shape.rough ? 'rubble' : 'cut',
        tint: shape.rough ? color.rubble : color.cut,
        low: sit,
        crown,
        holes,
        banded: !shape.rough,
        nearStone: outer,
      },
      lod,
    );
    if (lod > 0 && i === 0 && shape.rough) {
      const count = lod === 1 ? 3 : 5;
      for (let n = 0; n < count; n++) {
        const u = (f.length * (n + 1)) / (count + 1),
          h = 14.28 + (n % 2) * 0.18;
        beam(
          out,
          'stone',
          f.at(u, h, -0.22),
          f.at(u, h, 0.88 - (n % 3) * 0.16),
          0.27,
          0.3,
          color.pale,
        );
      }
    }
    const inner = edge(insetRing[i], insetRing[j], -1);
    panel(
      out,
      inner,
      'rubble',
      0,
      inner.length,
      floorTop - 1.51,
      floorTop - 1.51,
      y(p),
      y(ring[j]),
      0,
      color.edge,
    );
    face(
      out,
      'stone',
      [p3(p, y(p)), p3(ring[j], y(ring[j])), p3(insetRing[j], y(ring[j])), p3(insetRing[i], y(p))],
      up,
      color.raw,
    );
    towerCrown(out, f, crown, lod, i + (shape.rough ? 6 : 0));
  }
  cap(out, 'detail', insetRing, [], () => floorTop - 1.51, color.grit);
}

function build(out, lod) {
  hall(out, lod);
  box(out, 'rubble', [-2.68, -0.35, -10.21], [-1.46, 18.97, 2.45], color.edge);
  tower(out, south, lod);
  tower(out, north, lod);
}

export const anemasSkyline = (out) => build(out, 0);
export const anemasDistrict = (out) => build(out, 1);
export const anemasStreet = (out) => build(out, 2);
export const anemasCloseup = (out) => build(out, 3);

const recipe = 'prison-of-anemas-model.mjs';
const camera = [-45, 44, -87];
const lookAt = [9, 11, -0.6];
export const anemasModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: anemasCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: mainFoot,
    outlines: [south.polygon, north.polygon],
    minimumCoverage: 0.995,
    basis: 'The modeled Anemas wall range and paired towers only.',
  },
  brief:
    'The paired masonry towers of Anemas on the Blachernae retaining wall above the Golden Horn, with their stepped footing, different masonry and surviving arches.',
  camera,
  lookAt,
  sunDirection: [-57, 82, -97],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.66,
    cameraYaw: -2.11,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'both-anemas-towers-from-the-outside', position: [-28, 13, -41], lookAt: [1, 11, -6] },
    {
      name: 'north-tower-stone-spolia-and-buttresses',
      position: [39, 12, -38],
      lookAt: [20, 10, -5],
    },
    { name: 'rear-terrace-and-open-tower-crowns', position: [31, 39, 38], lookAt: [9, 14, 1] },
    {
      name: 'outside-postern-and-masonry-bands',
      position: [-19, 7.5, -26],
      lookAt: [-7, 11.4, -10],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'prison-of-anemas-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'anemasSkyline',
    errorMeters: 1.03,
    surfaces,
    authoredLevels: {
      district: { export: 'anemasDistrict', errorMeters: 0.49, surfaces },
      street: { export: 'anemasStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'anemasCloseup', errorMeters: 0.08, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Independent geometry using the exact public-domain Qualla plan, the two original 1899 public-domain plates, attributed OpenStreetMap and Terrarium source terrain.',
};
