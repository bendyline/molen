import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const { dimensions: d } = plan;
const colors = palette({
  stucco: 'd5d0bb',
  coping: 'e1d6bf',
  shadow: 'b1a991',
  stone: 'aeaa98',
  lintel: 'c9c2aa',
  roof: '5d625f',
  dark: '58625e',
  glass: '80928b',
  iron: '494d45',
  floor: 'aaa090',
  boards: '92554b',
  plank: 'a67362',
});
const surfaces = {
  stucco: surface('wall', 'stucco', 0.93),
  stone: surface('foundation', 'stone_ashlar', 0.95),
  slate: surface('roof', 'slate', 0.88),
  boards: surface('wall', 'wood_vertical', 0.94),
  metal: surface('trim', 'metal_painted', 0.74, 0.22),
  solid: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};
const midpoint = ([x, z], [u, v]) => [(x + u) * 0.5, (z + v) * 0.5];
const median = (points) => {
  const values = points.map(grade).sort((a, b) => a - b);
  return mix(
    values[Math.floor((values.length - 1) * 0.5)],
    values[Math.ceil((values.length - 1) * 0.5)],
    0.5,
  );
};
const border = (outline) => pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const form = (out, key, outline, bottom, top, color) =>
  shell(out, outline, (p) => Math.min(bottom, grade(p) - 0.25), top, { wall: key, color });

function band(out, key, wall, lo, hi, lift, color) {
  panel(out, key, wall, 0, wall.length, lo, hi, lift, color);
}

function arch(out, level, wall, x, bottom, width, height, kind, trim = 'stone') {
  const depth = 0.018;
  const span = width * 0.5;
  if (level === 0) {
    panel(out, 'solid', wall, x - span, x + span, bottom, bottom + height, depth, colors.dark);
    return;
  }
  const rise = kind === 'lancet' ? width * 0.62 : width * 0.23;
  const start = bottom + height - rise;
  const n = [4, 6, 9, 12][level];
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * i) / n - 1;
    const y = kind === 'lancet' ? 1 - Math.pow(Math.abs(t), 1.35) : 1 - t * t;
    return [x + span * t, start + rise * y];
  });
  panel(out, 'solid', wall, x - span, x + span, bottom, start, depth, colors.dark);
  for (const [[a, y], [b, z]] of pairs(profile)) {
    face(
      out,
      'solid',
      [wall.p(x, start, depth), wall.p(a, y, depth), wall.p(b, z, depth)],
      wall.normal,
      colors.dark,
    );
  }
  if (level === 1) return;
  const casing = 0.13;
  const front = depth + 0.041;
  panel(out, trim, wall, x - span - casing, x - span, bottom, start, front, colors.lintel);
  panel(out, trim, wall, x + span, x + span + casing, bottom, start, front, colors.lintel);
  panel(
    out,
    trim,
    wall,
    x - span - casing,
    x + span + casing,
    bottom - 0.126,
    bottom,
    front,
    colors.lintel,
  );
  for (const [[a, y], [b, z]] of pairs(profile)) {
    const expand = (p) => x + ((p - x) * (span + casing)) / span;
    face(
      out,
      trim,
      [
        wall.p(a, y, front),
        wall.p(b, z, front),
        wall.p(expand(b), z + casing, front),
        wall.p(expand(a), y + casing, front),
      ],
      wall.normal,
      colors.lintel,
    );
  }
  if (level >= 2 && kind !== 'door') {
    panel(
      out,
      'solid',
      wall,
      x - span + 0.1,
      x + span - 0.1,
      bottom + 0.12,
      start - 0.12,
      front - 0.018,
      colors.glass,
    );
    panel(
      out,
      'metal',
      wall,
      x - 0.023,
      x + 0.023,
      bottom,
      start + rise * 0.71,
      front + 0.007,
      colors.iron,
    );
    if (level === 3)
      panel(
        out,
        'metal',
        wall,
        x - span + 0.05,
        x + span - 0.05,
        start - 0.45,
        start - 0.405,
        front + 0.012,
        colors.iron,
      );
  }
}

const ring = ([x, z], radius, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / n;
    return [x + Math.cos(a) * radius, z + Math.sin(a) * radius];
  });
const spread = (outline, factor, center = planarMid(outline)) =>
  outline.map(([x, z]) => [mix(center[0], x, factor), mix(center[1], z, factor)]);
function connect(out, key, lowRing, lo, highRing, hi, color) {
  border(lowRing).forEach((w, i) => {
    const j = (i + 1) % lowRing.length;
    face(
      out,
      key,
      [at(lowRing[i], lo), at(lowRing[j], lo), at(highRing[j], hi), at(highRing[i], hi)],
      w.normal,
      color,
    );
  });
}

function crenels(out, outline, base, high, spacing, thickness, level) {
  for (const wall of border(outline)) {
    const count = Math.max(1, Math.round(wall.length / spacing));
    for (let i = 0; i < count; i++) {
      const mid = (wall.length * (i + 0.5)) / count;
      const half = (wall.length / count) * 0.28;
      const shape = [
        wall.p(mid - half, base),
        wall.p(mid + half, base),
        wall.p(mid + half, base, -thickness),
        wall.p(mid - half, base, -thickness),
      ].map(([x, , z]) => [x, z]);
      if (level === 0) {
        panel(out, 'stucco', wall, mid - half, mid + half, base, high, 0, colors.stucco);
        cap(out, 'stucco', shape, high, colors.coping);
      } else {
        shell(out, shape, () => base, high, {
          wall: 'stucco',
          color: colors.stucco,
          roofColor: colors.coping,
        });
      }
    }
  }
}

function tower(out, level, center, base, radius, top, bartizan) {
  const outline = ring(center, radius, 8, Math.PI / 8);
  const lo = bartizan ? base + 3.25 : base - 0.18;
  if (bartizan)
    connect(out, 'stucco', spread(outline, 0.43, center), lo - 0.77, outline, lo, colors.shadow);
  shell(out, outline, () => lo, top, {
    wall: 'stucco',
    color: colors.stucco,
    roofColor: colors.roof,
  });
  const crest = spread(outline, 1.11, center);
  shell(out, crest, () => top - 0.34, top - 0.12, { wall: 'stucco', color: colors.coping });
  crenels(out, crest, top - 0.11, top + 0.44, 1.55, 0.27, level);
  for (const wall of border(outline).filter((w) => w.normal[2] > 0.52)) {
    arch(
      out,
      level,
      wall,
      wall.length * 0.5,
      top - 2.02,
      bartizan ? 0.28 : 0.43,
      1.14,
      'lancet',
      'stucco',
    );
    if (!bartizan && level > 0)
      arch(out, level, wall, wall.length * 0.5, base + 1.12, 0.39, 1.66, 'lancet', 'stucco');
  }
}

function gatehouse(out, level) {
  const r = d.outline,
    base = 0.64;
  const eaves = base + 7.35;
  form(out, 'stucco', r, base - 0.56, eaves, colors.stucco);
  shell(out, spread(r, 1.014), () => eaves - 0.32, eaves + 0.06, {
    wall: 'stucco',
    color: colors.coping,
    roofColor: colors.roof,
  });
  crenels(out, r, eaves, eaves + 0.62, level === 0 ? 4.2 : 2.22, 0.3, level);
  for (const wall of border(r)) {
    band(out, 'stucco', wall, base + 0.03, base + 0.26, 0.062, colors.shadow);
    band(out, 'stucco', wall, base + 3.49, base + 3.72, 0.043, colors.coping);
    const front = wall.normal[2] > 0.7;
    if (front) {
      const center = wall.length * 0.5;
      arch(out, level, wall, center, base, 2.9, 3.24, 'door', 'stucco');
      for (const sign of [-1, 1])
        for (const offset of level === 0 ? [8.8, 15.4, 19.2] : [7.1, 10.8, 14.55, 18.3]) {
          const x = center + sign * offset;
          arch(out, level, wall, x, base + 0.86, 1.47, 1.86, 'segment', 'stucco');
          arch(out, level, wall, x, base + 4.27, 1.35, 1.91, 'lancet', 'stucco');
        }
      continue;
    }
    const bays = Math.max(2, Math.round(wall.length / (level === 0 ? 7 : 5)));
    for (let i = 0; i < bays; i++) {
      const x = (wall.length * (i + 0.5)) / bays;
      arch(out, level, wall, x, base + 0.95, 1.37, 1.9, 'segment', 'stucco');
      arch(out, level, wall, x, base + 4.23, 1.27, 1.92, 'segment', 'stucco');
    }
  }
  for (const sign of [-1, 1]) {
    tower(out, level, [sign * 3.85, 5.43], base, 1.57, base + 9.12, false);
    tower(out, level, [sign * 20.85, 5.14], base, 0.96, base + 7.91, true);
  }
  const gateCrest = ring([0, 5.33], 1.24, 8, Math.PI / 8).map(([x, z]) => [x * 1.7, z]);
  shell(out, gateCrest, () => base + 3.22, base + 3.51, { wall: 'stucco', color: colors.coping });
}

function mansard(out, r, y) {
  const lower = spread(r, 1.026);
  const shoulder = spread(r, 0.8);
  const crown = spread(r, 0.64);
  connect(out, 'slate', lower, y, shoulder, y + 2.57, colors.roof);
  connect(out, 'slate', shoulder, y + 2.57, crown, y + 3.06, colors.roof);
  cap(out, 'slate', crown, y + 3.06, colors.roof);
}

function dormer(out, w, x, y, width, level) {
  const p = (a, b, c) => w.p(x + a, y + b, c);
  const half = width * 0.5;
  const low = -0.46,
    back = -2.17,
    wallY = 1.35,
    crest = 1.78;
  face(
    out,
    'stone',
    [p(-half, 0, low), p(half, 0, low), p(half, wallY, low), p(-half, wallY, low)],
    w.normal,
    colors.lintel,
  );
  face(
    out,
    'stone',
    [p(-half, wallY, low), p(half, wallY, low), p(0, crest - 0.08, low)],
    w.normal,
    colors.lintel,
  );
  for (const sign of [-1, 1]) {
    const a = sign * half,
      b = sign * (half + 0.12);
    face(
      out,
      'stone',
      [p(a, 0, low), p(a, wallY, low), p(a, wallY, back), p(a, 0, back)],
      [w.normal[2] * sign, 0, -w.normal[0] * sign],
      colors.stone,
    );
    face(
      out,
      'slate',
      [p(b, wallY, low + 0.13), p(0, crest, low + 0.13), p(0, crest, back), p(b, wallY, back)],
      up,
      colors.roof,
    );
  }
  const opening = {
    length: width,
    normal: w.normal,
    p: (u, v, offset = 0) => p(u, v, low + offset),
  };
  arch(out, level, opening, 0, 0.13, width * 0.66, 1.11, 'segment');
}

function gaol(out, level) {
  const r = d.gaolOutline;
  const base = median(r);
  const eaves = base + 7.64;
  form(out, 'stone', r, base - 1.5, eaves, colors.stone);
  mansard(out, r, eaves + 0.07);
  for (const w of border(r)) {
    band(out, 'stone', w, base + 3.54, base + 3.73, 0.07, colors.lintel);
    band(out, 'stone', w, eaves - 0.3, eaves + 0.05, 0.21, colors.lintel);
    const n = Math.max(1, Math.round(w.length / (level === 0 ? 4.8 : 3.15)));
    for (let i = 0; i < n; i++) {
      const a = (w.length * (i + 0.5)) / n;
      if (level > 0) arch(out, level, w, a, base - 0.82, 0.97, 0.84, 'segment');
      arch(out, level, w, a, base + 0.72, 1.11, 2.11, 'segment');
      arch(out, level, w, a, base + 4.22, 1.1, 2.22, 'segment');
      if (w.length > 8 && (level === 0 ? i === Math.floor(n / 2) : i % 2 === 0))
        dormer(out, w, a, eaves + 0.51, 1.21, level);
    }
  }
}

function warehouse(out, level) {
  const r = d.wharfOutline;
  const base = median(r) + 0.62;
  const y = base + 3.41,
    ridge = y + 1.28;
  form(out, 'stone', r, base - 0.33, base, colors.stone);
  shell(out, r, () => base, y, { wall: 'boards', color: colors.boards });
  const expanded = spread(r, 1.057);
  const a = midpoint(expanded[0], expanded[1]),
    b = midpoint(expanded[2], expanded[3]);
  for (const [p, q] of [
    [expanded[1], expanded[2]],
    [expanded[0], expanded[3]],
  ])
    face(out, 'metal', [at(p, y), at(q, y), at(b, ridge), at(a, ridge)], up, colors.roof);
  for (const [p, q] of [
    [r[0], r[1]],
    [r[2], r[3]],
  ]) {
    const m = midpoint(p, q);
    face(
      out,
      'boards',
      [at(p, y), at(q, y), at(m, ridge)],
      edge(p, q, areaSign(r)).normal,
      colors.boards,
    );
  }
  for (const wall of border(r)) {
    band(out, 'boards', wall, base + 0.03, base + 0.22, 0.057, colors.plank);
    const n = wall.length > 20 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const x = (wall.length * (i + 0.5)) / n;
      const full = wall.length > 20 && i === 1;
      const wide = full ? 2.6 : 1.44,
        bottom = base + (full ? 0.06 : 1.37);
      panel(
        out,
        'solid',
        wall,
        x - wide / 2,
        x + wide / 2,
        bottom,
        bottom + (full ? 2.51 : 1.1),
        0.021,
        full ? colors.boards : colors.dark,
      );
      if (level > 0) {
        for (const sign of [-1, 1]) {
          const u = x + (sign * wide) / 2;
          panel(
            out,
            'boards',
            wall,
            u - 0.09,
            u + 0.09,
            bottom,
            bottom + (full ? 2.59 : 1.17),
            0.042,
            colors.plank,
          );
        }
        if (!full)
          panel(
            out,
            'boards',
            wall,
            x - 0.032,
            x + 0.032,
            bottom,
            bottom + 1.1,
            0.06,
            colors.plank,
          );
      }
    }
    if (level > 1) {
      const n = Math.round(wall.length / 2.25);
      for (let i = 1; i < n; i++) {
        const x = (wall.length * i) / n;
        panel(out, 'boards', wall, x - 0.026, x + 0.026, y - 0.21, y - 0.044, 0.047, colors.plank);
      }
    }
  }
}

function stairSegment(out, level, [a, b], steps) {
  const w = edge(a, b, 1),
    width = 1.32;
  const start = grade(a) + 0.35,
    end = grade(b) + 0.23;
  const slices = level === 0 ? 1 : level === 1 ? Math.ceil(steps / 3) : steps;
  const rectangle = (x0, x1, left, right) =>
    [w.p(x0, 0, left), w.p(x1, 0, left), w.p(x1, 0, right), w.p(x0, 0, right)].map(([x, , z]) => [
      x,
      z,
    ]);
  for (let i = 0; i < slices; i++) {
    const x0 = (w.length * i) / slices,
      x1 = (w.length * (i + 1)) / slices;
    const y = mix(start, end, i / slices);
    const outline = rectangle(x0, x1, -width, width);
    shell(out, outline, (p) => Math.min(grade(p) - 0.27, y - 0.22), y, {
      wall: 'stone',
      color: colors.floor,
    });
  }
  if (level > 0) {
    for (const sign of [-1, 1]) {
      beam(
        out,
        'stone',
        w.p(0, start + 0.18, sign * (width + 0.14)),
        w.p(w.length, end + 0.18, sign * (width + 0.14)),
        0.27,
        0.35,
        colors.stone,
      );
      if (level > 1)
        for (const [x, y] of [
          [0, start],
          [w.length, end],
        ]) {
          const outline = rectangle(
            x - 0.19,
            x + 0.19,
            sign * (width + 0.14) - 0.18,
            sign * (width + 0.14) + 0.18,
          );
          shell(out, outline, () => y - 0.12, y + 0.66, {
            wall: 'stone',
            color: colors.stone,
            roofColor: colors.lintel,
          });
        }
    }
  }
}

function steps(out, level) {
  let prev = [0, 7.13];
  for (const s of d.stairFlights) {
    const [a, b] = s.points;
    stairSegment(out, level, [prev, a], Math.max(3, level * 3));
    stairSegment(out, level, s.points, s.steps);
    prev = b;
  }
  if (level > 0)
    for (const sign of [-1, 1]) {
      const a = sign * 1.41,
        b = sign * 7.4,
        z = 8.37;
      beam(out, 'metal', [a, 0.98, z], [b, 0.98, z], 0.058, 0.065, colors.iron);
      if (level > 1)
        for (let i = 0; i < 15; i++) {
          const x = mix(a, b, i / 14);
          beam(out, 'metal', [x, grade([x, z]) + 0.1, z], [x, 1.0, z], 0.052, 0.052, colors.iron);
        }
    }
}

function build(out, level) {
  gatehouse(out, level);
  gaol(out, level);
  warehouse(out, level);
  steps(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'british-columbia-penitentiary-model.mjs';
const camera = [135, 102, 203],
  lookAt = [-26, 4, -12];
const errors = { district: 0.69, street: 0.26, closeup: 0.089 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  quality: 'medium-fi-exterior',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  reviewStatus: 'review-in-qa.json',
  build: closeup,
  surfaces,
  groundContactBasis:
    'The original Fraser bank relief sets the Gatehouse forecourt datum, the three stair landings, the Gaol Block and the low Wharf Warehouse.',
  brief:
    'Surviving British Columbia Penitentiary exteriors: the Gothic Gatehouse and stair, the stone mansard-roofed Gaol Block and the red Wharf Warehouse.',
  camera,
  lookAt,
  sunDirection: [37, 89, 122],
  mediumFiContext: {
    scale: 1,
    groundY: -20.8,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.footprints,
    minimumCoverage: 0.91,
    basis: 'The three mapped heritage footprints bound the replacement buildings.',
  },
  embeddedCanonicalGraphs: ['stucco', 'stone_ashlar', 'slate', 'wood_vertical', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'gatehouse-and-ceremonial-stair', position: [35, 20, 70], lookAt: [1, 2, 14] },
    { name: 'gaol-mansard-and-stonework', position: [-106, 45, -102], lookAt: [-61, 26, -164] },
    { name: 'wharf-warehouse', position: [48, -4, 173], lookAt: [8, -15, 134] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'penitentiary-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.56,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
