import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const color = palette({
  plaster: 'dfd5bc',
  shrineStone: 'baac94',
  threshold: 'aaa295',
  wall: '914d3d',
  varnish: 'a55a42',
  gable: '703e32',
  teak: '57473c',
  plank: '6d5140',
  roof: '754e43',
  roofShade: '563f37',
  darkRoof: '5c4940',
  seam: '886552',
  gilt: 'cbb168',
  rich: 'b59348',
  darkGold: 'aa8a4d',
  paleGold: 'e1c27a',
  trim: 'ac8254',
  dark: '454138',
  glass: '60584a',
});
const surfaces = {
  masonry: surface('foundation', 'stone_ashlar', 0.95),
  plaster: surface('wall', 'plaster_lime', 0.94),
  timber: surface('wall', 'wood_vertical', 0.9),
  tile: surface('roof', 'tile_flat', 0.87),
  bronze: surface('trim', 'metal_bronze_cast', 0.78, 0.35),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};
function averageGrade(points) {
  return points.reduce((value, p) => value + grade(p) / points.length, 0);
}
function frame(outline) {
  const center = planarMid(outline);
  const xEnd = outline[1],
    xStart = outline[2];
  const w = Math.hypot(xEnd[0] - xStart[0], xEnd[1] - xStart[1]);
  const hx = (xEnd[0] - xStart[0]) / w,
    hz = (xEnd[1] - xStart[1]) / w;
  const l = Math.hypot(outline[1][0] - outline[0][0], outline[1][1] - outline[0][1]);
  const p = (x, z) => [center[0] + hx * x - hz * z, center[1] + hz * x + hx * z];
  const ground = (x, z) => grade(p(x, z));
  return { p, center, w, l, ground };
}
function boxRect(f, x0, z0, x1, z1) {
  return rect(x0, z0, x1, z1).map(([x, z]) => f.p(x, z));
}
function yMass(out, outline, lo, hi, slot, tint, roofTint = tint) {
  shell(out, outline, typeof lo === 'number' ? () => lo : lo, hi, {
    wall: slot,
    color: tint,
    roofColor: roofTint,
  });
}
function ring(out, key, center, section, n, tint) {
  const mesh = section.map(([y, r]) => radialRing(y, r, r, n, center, Math.PI / 8));
  loft(out, key, mesh, tint, { cap: false });
}

function chedi(out, level) {
  const outline = d.chediOutline,
    center = planarMid(outline),
    g = averageGrade(outline) + 0.1;
  yMass(out, outline, (p) => grade(p) - 0.21, g + 0.54, 'masonry', color.shrineStone);
  const n = 8;
  ring(
    out,
    'masonry',
    center,
    [
      [g + 0.43, 4.24],
      [g + 0.83, 4.24],
      [g + 1.03, 4.05],
      [g + 1.52, 3.95],
    ],
    n,
    color.threshold,
  );
  for (let i = 0; i < d.stupaSteps; i++) {
    const y = g + 1.48 + i * 0.54,
      r = 4.02 - 0.245 * i;
    const band =
      level === 0
        ? [
            [y, r],
            [y + 0.48, r - 0.19],
          ]
        : [
            [y, r + 0.05],
            [y + 0.095, r + 0.05],
            [y + 0.15, r - 0.032],
            [y + 0.44, r - 0.16],
            [y + 0.55, r - 0.2],
          ];
    ring(out, 'bronze', center, band, n, i % 3 === 1 ? color.rich : color.gilt);
  }
  ring(
    out,
    'bronze',
    center,
    [
      [g + 6.33, 1.93],
      [g + 6.64, 1.77],
      [g + 7.0, 1.66],
      [g + 7.53, 1.39],
      [g + 8.26, 1.03],
      [g + 8.62, 0.81],
    ],
    n,
    color.gilt,
  );
  const bands = level === 0 ? 4 : level === 1 ? 5 : 11;
  for (let i = 0; i < bands; i++) {
    const t = i / bands,
      y = mix(g + 8.45, g + 13.51, t),
      h = 5.06 / bands;
    const r = mix(0.85, 0.235, t);
    ring(
      out,
      'bronze',
      center,
      [
        [y, r],
        [y + h * 0.13, r + 0.042],
        [y + h * 0.3, r - 0.008],
        [y + h, r - 0.09],
      ],
      level < 2 ? 6 : 12,
      i % 2 ? color.gilt : color.paleGold,
    );
  }
  ring(
    out,
    'bronze',
    center,
    [
      [g + 13.42, 0.25],
      [g + 13.79, 0.28],
      [g + 14.15, 0.155],
      [g + 14.63, 0.11],
      [g + d.stupaHeight, 0.022],
    ],
    level < 2 ? 5 : 9,
    color.paleGold,
  );
}

function steppedRoof(out, level, f, o) {
  const { width, rear, front, y, rise, roof, trim } = o;
  const sections = level === 0 ? [0, 1] : [0, 0.13, 0.5, 0.87, 1];
  const gable = [
    [-1, 0],
    [-0.63, 0.39],
    [-0.33, 0.76],
    [0, 1],
    [0.33, 0.76],
    [0.63, 0.39],
    [1, 0],
  ];
  const curve = level === 0 ? [gable[0], gable[3], gable[6]] : gable;
  const roofPoint = ([x, h], t) =>
    at(
      f.p(x * width, mix(rear, front, t)),
      y + h * rise + Math.pow(Math.abs(t - 0.5) * 2, 4) * (0.13 + h * 0.16),
    );
  for (const [a, b] of pairs(sections))
    for (const [p, q] of pairs(curve))
      face(
        out,
        'tile',
        [roofPoint(p, a), roofPoint(q, a), roofPoint(q, b), roofPoint(p, b)],
        up,
        roof,
      );
  for (const t of [0, 1]) {
    const facing = t === 0 ? -1 : 1,
      center = roofPoint([0, -0.035], t);
    const [x0, z0] = f.p(0, mix(rear, front, t)),
      [x1, z1] = f.p(0, mix(rear, front, t) + facing);
    const n = [x1 - x0, 0, z1 - z0];
    for (const [[p, q], i] of pairs(curve).map((pair, i) => [pair, i])) {
      const a = roofPoint(p, t),
        b = roofPoint(q, t);
      face(out, 'timber', [center, a, b], n, trim);
      if (level > 1 || (level === 1 && i % 2 === 0))
        beam(out, 'bronze', a, b, 0.072, 0.072, color.gilt);
    }
    if (level >= 2) {
      const z = mix(rear, front, t) + facing * 0.025;
      for (let i = 1; i <= 4; i++) {
        const h = y + (rise * i) / 5,
          span = width * (1 - i / 5) * 0.82;
        beam(out, 'bronze', at(f.p(-span, z), h), at(f.p(span, z), h), 0.031, 0.034, color.rich);
      }
      const pl = roofPoint([0, 1], t);
      const finish = [
        pl,
        at(f.p(0, z + facing * 0.2), pl[1] + 0.18),
        at(f.p(0, z + facing * 0.29), pl[1] + 0.49),
        at(f.p(0, z + facing * 0.17), pl[1] + 0.68),
      ];
      for (const [a, b] of pairs(finish)) beam(out, 'bronze', a, b, 0.066, 0.07, color.gilt);
    }
  }
  if (level >= 2) {
    const count = level === 3 ? 13 : 7;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      for (const [a, b] of pairs(curve)) {
        const p = roofPoint(a, t),
          q = roofPoint(b, t);
        beam(
          out,
          'tile',
          [p[0], p[1] + 0.02, p[2]],
          [q[0], q[1] + 0.02, q[2]],
          0.029,
          0.027,
          color.seam,
        );
      }
    }
  }
}

function shutter(out, w, x, y, width, h, level, tint) {
  const left = x - width / 2,
    right = x + width / 2;
  panel(out, 'timber', w, left - 0.105, right + 0.105, y - 0.08, y + h + 0.08, 0.061, tint);
  panel(out, 'glass', w, left, right, y, y + h, 0.092, color.dark);
  if (level >= 2) {
    for (const x of [left + width * 0.33, left + width * 0.66])
      panel(out, 'timber', w, x - 0.035, x + 0.035, y, y + h, 0.116, color.plank);
    panel(
      out,
      'bronze',
      w,
      left - 0.105,
      right + 0.105,
      y + h - 0.019,
      y + h + 0.063,
      0.125,
      color.rich,
    );
  }
}
function sideWalls(out, level, outline, lo, hi, spec) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    const count = w.length > 10 ? spec.bays : 3;
    panel(out, 'timber', w, 0, w.length, lo + 0.09, lo + 0.36, 0.067, spec.band);
    for (let i = 0; i < count; i++) {
      const x = (w.length * (i + 0.5)) / count;
      if (spec.stories === 2) {
        shutter(out, w, x, lo + 0.56, 0.98, 1.51, level, spec.trim);
        shutter(out, w, x, hi - 2.21, 0.94, 1.69, level, spec.trim);
        if (level >= 2 && w.length > 12) {
          const left = w.p(x - 0.77, 0, 0.041),
            right = w.p(x + 0.77, 0, 0.041);
          const ridge = w.p(x, hi - 0.09, 0.36);
          const lower = (k) => [k[0], hi - 1.03, k[2]];
          face(out, 'tile', [lower(left), lower(right), ridge], w.normal, color.darkRoof);
          beam(out, 'bronze', lower(left), ridge, 0.055, 0.055, color.gilt);
          beam(out, 'bronze', ridge, lower(right), 0.055, 0.055, color.gilt);
        }
      } else {
        shutter(out, w, x, lo + 1.79, 0.78, 1.63, level, spec.trim);
      }
      if (level > 1) {
        const x = (w.length * i) / count + 0.073;
        panel(out, 'timber', w, x - 0.066, x + 0.066, lo + 0.34, hi - 0.015, 0.068, spec.band);
      }
    }
  }
}

function stair(out, level, f, top, front, width, depth) {
  const lower = f.ground(0, front + depth) + 0.105;
  const count = level === 0 ? 1 : level === 1 ? 4 : 10;
  for (let i = 0; i < count; i++) {
    const z = mix(front, front + depth, i / count),
      next = mix(front, front + depth, (i + 1) / count);
    const y = mix(top, lower, i / count) - 0.022;
    const outline = boxRect(f, -width / 2, z, width / 2, next);
    yMass(
      out,
      outline,
      (p) => Math.min(grade(p) - 0.18, y - 0.22),
      y,
      'masonry',
      color.shrineStone,
      color.threshold,
    );
  }
}

function entry(out, level, f, lo, hi, front, w, kind) {
  const xPositions =
    kind === 'museum'
      ? [-2.92, 2.92]
      : level === 0
        ? [-w * 0.42, w * 0.42]
        : [-w * 0.42, -w * 0.16, w * 0.16, w * 0.42];
  const rear = front - 2.45;
  for (const x of xPositions) {
    const center = f.p(x, front - 0.42);
    ring(
      out,
      'timber',
      center,
      [
        [lo, 0.19],
        [lo + 0.25, 0.25],
        [hi - 0.35, 0.18],
        [hi, 0.22],
      ],
      level === 0 ? 4 : 8,
      kind === 'ordination' ? color.varnish : color.plank,
    );
    if (level > 0)
      for (const y of level === 1 ? [hi - 0.45] : [lo + 0.37, hi - 0.45, hi - 0.25])
        ring(
          out,
          'bronze',
          center,
          [
            [y, 0.225],
            [y + 0.075, 0.225],
          ],
          8,
          color.gilt,
        );
  }
  const portal = edge(f.p(w / 2, rear - 0.04), f.p(-w / 2, rear - 0.04), 1);
  shutter(
    out,
    portal,
    w / 2,
    lo + 0.16,
    kind === 'ordination' ? 2.48 : 2.01,
    Math.min(3.06, hi - lo - 0.18),
    level,
    color.gilt,
  );
  steppedRoof(out, level, f, {
    width: w * 0.49,
    rear: rear - 0.89,
    front: front + 0.5,
    y: hi - 0.09,
    rise: Math.min(2.86, w * 0.27),
    roof: kind === 'ordination' ? color.roof : color.darkRoof,
    trim: kind === 'ordination' ? color.gable : color.teak,
  });
  if (level >= 2 && kind === 'ordination') {
    for (const sign of [-1, 1]) {
      const n = sign * w * 0.32;
      const pairsXZ = [
        [n, front - 0.07],
        [n + sign * 0.08, front + 0.78],
        [n + sign * 0.14, front + 1.64],
        [n + sign * 0.12, front + 2.16],
      ];
      const ys = [lo + 0.42, lo + 0.55, lo + 0.48, lo + 0.63];
      for (let i = 0; i < 3; i++)
        beam(
          out,
          'plaster',
          at(f.p(...pairsXZ[i]), ys[i]),
          at(f.p(...pairsXZ[i + 1]), ys[i + 1]),
          0.26,
          0.28,
          i === 2 ? color.gilt : color.plaster,
        );
    }
  }
}

const halls = [
  {
    kind: 'ordination',
    outline: d.outline,
    plinth: 0.97,
    height: 4.22,
    stories: 1,
    bays: d.ordinationBayCount,
    wall: color.plaster,
    band: color.varnish,
    trim: color.rich,
    roof: color.roof,
  },
  {
    kind: 'jade',
    outline: d.jadeOutline,
    plinth: 0.81,
    height: 3.54,
    stories: 1,
    bays: 4,
    wall: color.plank,
    band: color.teak,
    trim: color.rich,
    roof: color.darkRoof,
  },
  {
    kind: 'museum',
    outline: d.museumOutline,
    plinth: 0.46,
    height: 6.07,
    stories: 2,
    bays: 6,
    wall: color.teak,
    band: color.plank,
    trim: color.trim,
    roof: color.darkRoof,
  },
];
function hall(out, level, spec) {
  const f = frame(spec.outline),
    foundation = averageGrade(spec.outline);
  const [w, l] = [f.w, f.l],
    lo = foundation + spec.plinth,
    hi = lo + spec.height;
  const x = w * 0.433,
    rear = -l * 0.439,
    front = l * 0.447;
  yMass(
    out,
    spec.outline,
    (p) => grade(p) - 0.24,
    lo,
    'masonry',
    color.shrineStone,
    color.threshold,
  );
  const body = boxRect(f, -x, rear, x, front - 2.49),
    slot = spec.kind === 'ordination' ? 'plaster' : 'timber';
  yMass(out, body, lo - 0.01, hi, slot, spec.wall, spec.wall);
  if (level > 0) sideWalls(out, level, body, lo, hi, spec);
  const sizes = [
    [w * 0.501, -l * 0.497, l * 0.498, hi - 0.015, w * 0.3],
    [w * 0.443, -l * 0.404, l * 0.365, hi + w * 0.135, w * 0.292],
  ];
  if (spec.kind !== 'jade')
    sizes.push([w * 0.365, -l * 0.311, l * 0.265, hi + w * 0.221, w * 0.264]);
  for (const [width, rear, front, y, rise] of sizes) {
    if (y > hi)
      yMass(
        out,
        boxRect(f, -width * 0.94, rear + 0.08, width * 0.94, front - 0.08),
        y - w * 0.14,
        y + 0.04,
        'timber',
        spec.band,
      );
    steppedRoof(out, level, f, {
      width,
      rear,
      front,
      y,
      rise,
      roof: spec.roof,
      trim: spec.kind === 'ordination' ? color.gable : color.teak,
    });
  }
  entry(out, level, f, lo, hi - 0.49, front, w, spec.kind);
  stair(
    out,
    level,
    f,
    lo,
    front,
    Math.min(w * 0.69, 6.65),
    spec.kind === 'ordination' ? 2.86 : 1.52,
  );
}

function build(out, level) {
  for (const spec of halls) hall(out, level, spec);
  chedi(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'wat-phra-kaew-chiang-rai-model.mjs';
const camera = [88, 65, 52],
  lookAt = [-5, 5, -27];
const errors = { district: 0.54, street: 0.21, closeup: 0.076 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  reviewStatus: 'review-in-qa.json',
  build: closeup,
  surfaces,
  groundContactBasis:
    'The original relief registers the four separate extant temple buildings at the mapped east-facing ordination hall and its neighboring structures.',
  brief:
    'Wat Phra Kaew in Chiang Rai, including the Chiang Saen ordination hall, nine-tier golden chedi, Phra Yok Hall and teak museum.',
  camera,
  lookAt,
  sunDirection: [48, 76, 58],
  mediumFiContext: {
    scale: 1,
    groundY: -0.28,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.footprint,
    minimumCoverage: 0.91,
    basis: 'Only the four mapped temple structure sites replace world buildings.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'plaster_lime',
    'wood_vertical',
    'tile_flat',
    'metal_bronze_cast',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'ordination-hall-and-golden-chedi', position: [30, 19, 34], lookAt: [-3, 5, -10] },
    { name: 'chedi-nine-gilded-bands', position: [13, 12, -6], lookAt: [-1.1, 8, -23.1] },
    { name: 'teak-museum-porch', position: [-46, 16, 28], lookAt: [-25, 5, -2] },
    { name: 'phra-yok-timber-hall', position: [35, 16, -48], lookAt: [17, 5, -68] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'wat-phra-kaew-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
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
