import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  granite: '9d7e6d',
  darker: '896f61',
  brick: 'a47461',
  lime: 'c4bfaa',
  limeShade: 'b6ae98',
  stoneTrim: 'a3927e',
  roof: '606a6a',
  roofShade: '555d5d',
  seams: '626c6c',
  black: '555b58',
  shutter: '9b9d8f',
  glazed: '596463',
  recess: '515654',
  warmTimber: '87584a',
});
const surfaces = {
  rubble: surface('wall', 'stone_sandstone_raw', 0.97),
  mortar: surface('wall', 'stucco', 0.97),
  brick: surface('trim', 'brick', 0.92),
  foundation: surface('foundation', 'stone_drywall', 0.95),
  metal: surface('roof', 'metal_standing_seam', 0.82, 0.15),
  painted: surface('trim', 'metal_painted', 0.82, 0.14),
  timber: surface('trim', 'wood_vertical', 0.95),
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74, metallic: 0.026 },
};
const base = (p) => grade(p) - 0.47;
const edges = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));
const floor = (w, u) => {
  const [x, , z] = w.p(u, 0);
  return grade([x, z]);
};

function renderPatches(out, w, lo, hi, seed, level, amount) {
  const count = Math.max(1, Math.ceil(w.length / [7.5, 4.25, 2.3, 1.65][level]));
  const edgeHeight = (i) => {
    const u = i / count;
    const variation =
      0.105 * Math.sin(u * 6.4 + seed * 1.39) +
      0.038 * Math.sin(u * 24.1 + seed * 2.1) +
      0.019 * Math.sin(u * 59.2 + seed * 4.5);
    return mix(lo, hi, Math.min(0.96, amount + variation));
  };
  for (let i = 0; i < count; i++) {
    const b = (i / count) * w.length;
    const e = ((i + 1) / count) * w.length;
    const bed = (u) => Math.min(lo, floor(w, u) - 0.21);
    const upperA = edgeHeight(i);
    const upperB = edgeHeight(i + 1);
    face(
      out,
      'mortar',
      [w.p(b, bed(b), 0.024), w.p(e, bed(e), 0.024), w.p(e, upperB, 0.024), w.p(b, upperA, 0.024)],
      w.normal,
      c.lime,
    );
    if (level < 2 || e - b < 1) continue;
    for (let k = 0; k < (level === 2 ? 4 : 12); k++) {
      const f = ((k * 19 + i * 5 + 3) % 23) / 23;
      const u = mix(b + 0.21, e - 0.24, f);
      const high = mix(upperA, upperB, f);
      const y = mix(bed(u) + 0.35, high - 0.16, ((k * 7 + i * 13 + 1) % 19) / 19);
      const r = 0.075 + (k % 4) * 0.052;
      const h = 0.08 + (k % 3) * 0.057;
      face(
        out,
        'rubble',
        [
          w.p(u - r, y, 0.034),
          w.p(u - r * 0.56, y - h, 0.034),
          w.p(u + r * 0.69, y - h * 0.74, 0.034),
          w.p(u + r, y + h * 0.22, 0.034),
          w.p(u + r * 0.41, y + h, 0.034),
          w.p(u - r * 0.47, y + h * 0.73, 0.034),
        ],
        w.normal,
        k % 3 ? c.granite : c.darker,
      );
    }
  }
}

function casement(out, w, center, low, width, height, level, shutter) {
  const spring = low + height * 0.77;
  const half = width * 0.5;
  arch(
    out,
    w,
    center,
    low,
    spring,
    half,
    height * 0.23,
    0.051,
    level,
    { inner: shutter ? c.shutter : c.recess, trim: c.brick, width: 0.12 },
    { inner: shutter ? 'timber' : 'glazing', trim: 'brick' },
  );
  if (level > 0)
    trimBlock(
      out,
      'foundation',
      w,
      center - half - 0.12,
      center + half + 0.12,
      low - 0.13,
      low - 0.04,
      0.026,
      0.12,
      c.stoneTrim,
    );
  if (level < 2) return;
  const left = center - half + 0.045,
    right = center + half - 0.045;
  if (shutter) {
    for (let i = 1; i <= 7; i++) {
      const y = mix(low, spring, i / 8);
      panel(out, 'painted', w, left, right, y, y + 0.033, 0.07, c.stoneTrim);
    }
  } else {
    for (const y of [mix(low, spring, 0.37), mix(low, spring, 0.72)])
      panel(out, 'painted', w, left, right, y, y + 0.051, 0.073, c.black);
    panel(
      out,
      'painted',
      w,
      center - 0.028,
      center + 0.028,
      low,
      spring + height * 0.12,
      0.079,
      c.black,
    );
  }
}

function gabledRange(out, original, eave, rise, axis, level, kind) {
  const p = axis === 'z' ? [...original.slice(1), original[0]] : original;
  const n = edges(p);
  const eaveCenters = [
    [p[0], p[3]],
    [p[1], p[2]],
  ].map(planarMid);
  const center = planarMid(p);
  const gradeCenter = grade(center);
  const y = eave + gradeCenter;
  const high = y + rise;
  const amount =
    kind === 'north' ? 0.77 : kind === 'east' ? 0.65 : kind === 'connector' ? 0.38 : 0.39;
  for (const [i, w] of n.entries()) {
    const edgeA = p[i];
    const edgeB = p[(i + 1) % p.length];
    face(
      out,
      'rubble',
      [at(edgeA, base(edgeA)), at(edgeB, base(edgeB)), at(edgeB, y), at(edgeA, y)],
      w.normal,
      i % 2 ? c.darker : c.granite,
    );
    const low = Math.min(Math.max(floor(w, w.length * 0.5) + 0.11, gradeCenter - 1.0), y - 2.0);
    renderPatches(out, w, low, y, kind.length + i, level, amount);
    const side = i % 2 === 0;
    const rows =
      kind === 'keep'
        ? [y - 5.05, y - 10.04]
        : kind === 'connector'
          ? [y - 2.78]
          : [y - 3.2, y - 7.44];
    const bays = side ? (w.length > 18 ? 4 : 3) : 1;
    for (const [row, win] of rows.entries()) {
      if (win < low + 0.34) continue;
      for (let j = 1; j <= bays; j++) {
        if (kind === 'keep' && side && row === 1 && j !== Math.floor((bays + 1) / 2)) continue;
        const u = (w.length * j) / (bays + 1);
        casement(
          out,
          w,
          u,
          win,
          kind === 'keep' ? 0.75 : 1.29,
          kind === 'keep' ? 1.93 : 1.86,
          level,
          side && kind === 'north',
        );
      }
    }
    if (i % 2 === 1) {
      const p0 = n[i].p(0, y),
        p1 = n[i].p(w.length, y),
        top = at(eaveCenters[i === 1 ? 1 : 0], high);
      face(out, 'rubble', [p0, p1, top], w.normal, c.limeShade);
      if (level > 0) casement(out, w, w.length / 2, y + 0.47, 0.69, 1.0, level, kind === 'north');
    }
    if (level > 1) {
      for (const u of [0.2, w.length - 0.23]) {
        const bot = floor(w, u);
        const count = Math.floor((y - bot) / 0.95);
        for (let j = 0; j < count; j++) {
          const z = bot + 0.24 + 0.94 * j;
          panel(
            out,
            'brick',
            w,
            u - 0.09,
            u + 0.09 + (j % 2) * 0.06,
            z,
            z + 0.47,
            0.032,
            c.stoneTrim,
          );
        }
      }
    }
  }
  const roof = p.map(([x, z]) => [mix(center[0], x, 1.028), mix(center[1], z, 1.028)]);
  const ridges = [
    [roof[0], roof[3]],
    [roof[1], roof[2]],
  ].map((pair) => at(planarMid(pair), high + 0.16));
  const slopes = [
    [at(roof[0], y + 0.12), at(roof[1], y + 0.12), ridges[1], ridges[0]],
    [at(roof[2], y + 0.12), at(roof[3], y + 0.12), ridges[0], ridges[1]],
  ];
  for (const [index, pts] of slopes.entries()) {
    face(out, 'metal', pts, up, index ? c.roof : c.roofShade);
    if (level < 2) continue;
    const count = Math.ceil(
      Math.hypot(pts[1][0] - pts[0][0], pts[1][2] - pts[0][2]) / (level === 2 ? 1.55 : 0.9),
    );
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const start = pts[0].map((v, j) => mix(v, pts[1][j], t));
      const end = pts[3].map((v, j) => mix(v, pts[2][j], t));
      start[1] += 0.047;
      end[1] += 0.047;
      beam(out, 'metal', start, end, 0.05, 0.05, c.seams);
    }
  }
  if (level > 0) {
    beam(out, 'painted', ridges[0], ridges[1], 0.16, 0.11, c.black);
    for (const [a, b] of [
      [0, 3],
      [1, 2],
    ]) {
      const i = a === 0 ? 0 : 1;
      for (const k of [a, b])
        beam(out, 'painted', at(roof[k], y + 0.12), ridges[i], 0.12, 0.145, c.black);
    }
  }
}

function curtain(out, a, b, width, heights, level, gate = false) {
  const w = edge(a, b);
  const slabs = Math.ceil(w.length / (level === 0 ? 7 : level === 1 ? 4.7 : 3.15));
  const gateLeft = w.length * 0.52 - 1.53;
  const gateRight = gateLeft + 3.06;
  const segments = gate
    ? [
        [0, gateLeft],
        [gateRight, w.length],
      ]
    : [[0, w.length]];
  const h = (u) => mix(heights[0], heights[1], u / w.length);
  for (const [left, right] of segments) {
    for (let i = 0; i < slabs; i++) {
      const u = mix(left, right, i / slabs);
      const v = mix(left, right, (i + 1) / slabs);
      const yo = floor(w, u),
        yp = floor(w, v);
      const yt = Math.max(yo, yp) + h((u + v) * 0.5) + (level > 0 && i % 4 === 2 ? 0.34 : 0);
      for (const sign of [-1, 1]) {
        const d = sign * width * 0.5;
        face(
          out,
          'rubble',
          [w.p(u, yo - 0.55, d), w.p(v, yp - 0.55, d), w.p(v, yt, d), w.p(u, yt, d)],
          w.normal.map((q) => q * sign),
          sign > 0 ? c.granite : c.darker,
        );
      }
      face(
        out,
        'foundation',
        [
          w.p(u, yt, -width / 2),
          w.p(v, yt, -width / 2),
          w.p(v, yt, width / 2),
          w.p(u, yt, width / 2),
        ],
        up,
        c.stoneTrim,
      );
      if (i < slabs - 1 && level > 0) {
        const y2 = yt + 0.16;
        face(
          out,
          'rubble',
          [
            w.p(v, yt, -width * 0.5),
            w.p(v, yt, width * 0.5),
            w.p(v, y2, width * 0.5),
            w.p(v, y2, -width * 0.5),
          ],
          [w.normal[2], 0, -w.normal[0]],
          c.darker,
        );
      }
    }
  }
  if (!gate) return;
  const groundAtGate = floor(w, (gateLeft + gateRight) * 0.5);
  const top = groundAtGate + 4.78;
  const n = [4, 7, 10, 14][level];
  const arc = (t) => groundAtGate + 2.29 + 1.28 * Math.sin(t * Math.PI);
  for (let i = 0; i < n; i++) {
    const u = mix(gateLeft, gateRight, i / n),
      v = mix(gateLeft, gateRight, (i + 1) / n);
    const y = arc(i / n),
      z = arc((i + 1) / n);
    for (const sign of [-1, 1]) {
      const d = sign * width * 0.5;
      face(
        out,
        'rubble',
        [w.p(u, y, d), w.p(v, z, d), w.p(v, top, d), w.p(u, top, d)],
        w.normal.map((q) => q * sign),
        c.granite,
      );
    }
    face(
      out,
      'brick',
      [w.p(u, y, -width / 2), w.p(v, z, -width / 2), w.p(v, z, width / 2), w.p(u, y, width / 2)],
      [0, -1, 0],
      c.brick,
    );
  }
  face(
    out,
    'foundation',
    [
      w.p(gateLeft, top, -width / 2),
      w.p(gateRight, top, -width / 2),
      w.p(gateRight, top, width / 2),
      w.p(gateLeft, top, width / 2),
    ],
    up,
    c.stoneTrim,
  );
}

function survivingWalls(out, level) {
  const ring = d.outline;
  for (const [i, height] of [
    [0, [4.2, 5.4]],
    [3, [3.35, 6.95]],
    [4, [6.4, 5.7]],
    [5, [4.15, 3.48]],
    [6, [3.35, 4.1]],
    [7, [4.06, 6.0]],
    [8, [5.5, 4.45]],
    [9, [4.4, 6.1]],
  ]) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    curtain(out, a, b, i === 3 || i === 4 ? 1.95 : 1.35, height, level, i === 9);
  }
  curtain(out, [-16.2, 43.2], [-5.2, 42.7], 1.78, [4.1, 4.5], level);
  curtain(out, [-2.1, 36.6], [-1.1, 48.3], 1.71, [4.3, 3.6], level);
  shell(out, rect(7.2, 21.6, 10.8, 26.7), base, grade([9.2, 24.1]) + 9.77, {
    wall: 'rubble',
    color: c.darker,
    roof: 'foundation',
    roofColor: c.stoneTrim,
  });
}

function build(out, level) {
  const r = d.roofedRanges;
  gabledRange(out, r.north, 11.85, 5.12, 'x', level, 'north');
  gabledRange(out, r.east, 12.42, 4.26, 'z', level, 'east');
  gabledRange(out, r.keep, d.keepHeight - 4.3, 4.3, 'z', level, 'keep');
  gabledRange(out, r.joining, 8.75, 2.46, 'x', level, 'connector');
  survivingWalls(out, level);
  if (level > 0) {
    const rail = d.currentEastApproach;
    for (const [a, b] of pairs(rail.slice(2))) {
      const w = edge(a, b);
      const gradeA = grade(a),
        gradeB = grade(b);
      for (const [u, h] of [
        [0.15, gradeA],
        [w.length - 0.15, gradeB],
      ]) {
        const p = w.p(u, h - 0.14, 1.42);
        block(out, 'timber', p[0] - 0.072, p[1], p[2] - 0.072, 0.144, 1.27, 0.144, c.warmTimber);
      }
      beam(
        out,
        'timber',
        w.p(0.15, gradeA + 0.95, 1.4),
        w.p(w.length - 0.15, gradeB + 0.95, 1.4),
        0.072,
        0.085,
        c.warmTimber,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kastelholm-castle-model.mjs';
const camera = [103, 49, -108];
const lookAt = [-1, 8, 18];
const errors = { district: 0.68, street: 0.25, closeup: 0.09 };
export const kastelholmCastleAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original National Land Survey of Finland bare-earth grade, sampled at the rocky site and its eastern approach.',
  brief:
    'Gabled stone ranges, restored Kuretornet and the two walled courts of Kastelholm Castle on Åland.',
  camera,
  lookAt,
  sunDirection: [12, 17, -9],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Native mapped castle outline, including the two open courtyards.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'north-range-and-gabled-keep', position: [-43, 13, -58], lookAt: [3, 10, 11] },
    { name: 'east-entry-arched-windows-and-ruin', position: [48, 13, 25], lookAt: [9, 8, 5] },
    { name: 'open-courtyards-and-kuretornet', position: [23, 46, 80], lookAt: [-5, 8, 28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kastelholm-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.38,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. National Land Survey of Finland terrain CC BY 4.0 and © OpenStreetMap contributors.',
};
