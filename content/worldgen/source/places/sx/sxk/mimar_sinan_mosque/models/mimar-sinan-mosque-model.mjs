import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  wall: 'd5cab1',
  pale: 'e0d4ba',
  chalk: 'ece0c8',
  shade: 'baae95',
  stone: 'b2a794',
  pave: 'a9a593',
  stripe: '81776a',
  glazing: '697473',
  lead: '7d8d92',
  ribs: '909fa4',
  roofDark: '68777c',
  finial: 'b39a58',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.94),
  trim: surface('trim', 'stone_limestone', 0.91),
  floor: surface('foundation', 'stone_ashlar', 0.97),
  roof: surface('roof', 'metal_standing_seam', 0.82, 0.18),
  gold: surface('trim', 'metal_bronze_cast', 0.68, 0.32),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
};
const floor = 2.82;
const extent = (outline) =>
  [0, 1].map((axis) => [
    Math.min(...outline.map((p) => p[axis])),
    Math.max(...outline.map((p) => p[axis])),
  ]);
const [[west, east], [back, front]] = extent(d.outline);
const [[cw, ce], [cb, cf]] = extent(d.court);
const decorate = ['skyline', 'district', 'street', 'closeup'];
const pi = Math.PI;
const rad = ([x, z], angle, radius) => [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];

function mass(out, outline, lo, hi, key, color, roofColor = color) {
  shell(out, outline, typeof lo === 'number' ? () => lo : lo, hi, { wall: key, color, roofColor });
}

function round(out, key, point, section, sides, color, cap = true) {
  const rings = section.map(([y, r]) => radialRing(y, r, r, sides, point));
  loft(out, key, rings, color, { cap });
}

function archProfile(radius, spring, rise, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = (2 * i) / steps - 1;
    return [f * radius, spring + rise * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(f), 1.52)))];
  });
}

function arch(
  out,
  level,
  w,
  x,
  span,
  base,
  spring,
  rise,
  { openDepth = 0, top, striped = false, recess = false } = {},
) {
  const r = span / 2,
    n = [2, 4, 8, 13][level];
  const profile = archProfile(r, spring, rise, n);
  const normal = w.normal;
  if (!openDepth) {
    const key = recess ? 'stone' : 'dark';
    const tone = recess ? colors.shade : colors.glazing;
    panel(out, key, w, x - r, x + r, base, spring, 0.034, tone);
    for (const [[a, y], [b, z]] of pairs(profile))
      face(
        out,
        key,
        [w.p(x, spring, 0.034), w.p(x + a, y, 0.034), w.p(x + b, z, 0.034)],
        normal,
        tone,
      );
  }
  for (const [[[a, y], [b, z]], i] of pairs(profile).map((seg, index) => [seg, index])) {
    if (openDepth) {
      const p = w.p(x + a, y),
        q = w.p(x + b, z);
      if (top > Math.max(y, z) + 0.03) {
        face(out, 'stone', [p, q, w.p(x + b, top), w.p(x + a, top)], normal, colors.wall);
        if (level > 1)
          face(
            out,
            'stone',
            [
              w.p(x + a, y, -openDepth),
              w.p(x + b, z, -openDepth),
              w.p(x + b, top, -openDepth),
              w.p(x + a, top, -openDepth),
            ],
            normal.map((v) => -v),
            colors.wall,
          );
      }
      if (level > 1)
        face(
          out,
          'trim',
          [p, q, w.p(x + b, z, -openDepth), w.p(x + a, y, -openDepth)],
          [0, -1, 0],
          colors.shade,
        );
    }
    if (level > 1 || (striped && level === 1)) {
      const over = span > (openDepth ? 2 : 1.2) ? 0.23 : 0.115;
      const tint = striped && i % 2 ? colors.stripe : colors.chalk;
      const outset = (u) => x + (u * (r + over)) / r;
      face(
        out,
        'trim',
        [
          w.p(x + a, y, 0.055),
          w.p(x + b, z, 0.055),
          w.p(outset(b), z + over, 0.055),
          w.p(outset(a), y + over, 0.055),
        ],
        normal,
        tint,
      );
    }
  }
  if (!openDepth && !recess && level >= 2) {
    const mark = span * 0.032;
    panel(out, 'trim', w, x - mark, x + mark, base, spring + rise * 0.7, 0.06, colors.pale);
    panel(out, 'trim', w, x - r, x + r, spring - 0.26, spring - 0.15, 0.06, colors.pale);
  }
}

function windows(
  out,
  level,
  edgeFrame,
  base,
  spring,
  rise,
  width,
  count,
  { striped = false } = {},
) {
  for (let i = 0; i < count; i++) {
    const x = (edgeFrame.length * (i + 0.5)) / count;
    arch(out, level, edgeFrame, x, width, base, spring, rise, { striped });
  }
}

function pier(out, w, x, span, y0, y1, depth, tint) {
  const g = [
    w.p(x - span / 2, y0),
    w.p(x + span / 2, y0),
    w.p(x + span / 2, y0, -depth),
    w.p(x - span / 2, y0, -depth),
  ].map(([x, , z]) => [x, z]);
  mass(out, g, y0, y1, 'stone', tint);
}

function stage(out, level) {
  mass(
    out,
    d.outline,
    (p) => Math.min(floor - 0.52, grade(p) - 0.27),
    floor,
    'floor',
    colors.stone,
    colors.pave,
  );
  const approachFloor = grade([0, front + 6.1]) + 0.15;
  const steps = level === 0 ? 3 : level === 1 ? 6 : 12;
  for (let i = 0; i < steps; i++) {
    const z = mix(front, front + 6.1, i / steps),
      next = mix(front, front + 6.1, (i + 1) / steps);
    const y = mix(floor, approachFloor, i / steps) - 0.035;
    const foundation = Math.min(grade([0, next]) - 0.24, y - 0.24);
    block(out, 'floor', -6.85, foundation, z, 13.25, y - foundation, next - z, colors.stone);
  }
  if (level > 1) {
    for (const x of [-6.92, 6.43]) {
      beam(
        out,
        'trim',
        [x, approachFloor + 0.46, front + 6.1],
        [x, floor + 0.37, front],
        0.27,
        0.25,
        colors.chalk,
      );
    }
    const [x, z] = [-0.45, 20.86];
    block(out, 'floor', x - 3.05, floor + 0.02, z - 3.04, 6.1, 0.22, 6.08, colors.stone);
    round(
      out,
      'stone',
      [x, z],
      [
        [floor + 0.21, 2.31],
        [floor + 0.73, 2.23],
        [floor + 0.95, 2.47],
      ],
      level >= 3 ? 12 : 8,
      colors.chalk,
    );
  }
}

function dome(out, level, center, radius, y, top, { angle, major = false } = {}) {
  const half = angle !== undefined;
  const n = major ? [8, 16, 29, 48][level] : half ? [3, 6, 11, 20][level] : [4, 5, 9, 16][level];
  const meridian =
    level < 2
      ? [
          [0, 1],
          [0.63, 0.78],
          [1, 0.04],
        ]
      : level === 2
        ? [
            [0, 1],
            [0.35, 0.942],
            [0.64, 0.767],
            [0.85, 0.531],
            [1, 0.036],
          ]
        : [
            [0, 1],
            [0.26, 0.968],
            [0.51, 0.861],
            [0.72, 0.689],
            [0.89, 0.452],
            [0.97, 0.245],
            [1, 0.028],
          ];
  if (!half) {
    round(
      out,
      'roof',
      center,
      meridian.map(([f, q]) => [mix(y, top, f), radius * q]),
      n,
      colors.lead,
      false,
    );
    const r = radius * meridian.at(-1)[1];
    cap(
      out,
      'roof',
      Array.from({ length: n }, (_, i) => rad(center, (i * 2 * pi) / n, r)),
      top,
      colors.lead,
    );
  } else {
    const point = (u, [f, q]) =>
      at(rad(center, angle - pi / 2 + (pi * u) / n, radius * q), mix(y, top, f));
    for (const [a, b] of pairs(meridian))
      for (let i = 0; i < n; i++) {
        const atAngle = angle - pi / 2 + (pi * (i + 0.5)) / n;
        face(
          out,
          'roof',
          [point(i, a), point(i + 1, a), point(i + 1, b), point(i, b)],
          [Math.cos(atAngle), 0.36, Math.sin(atAngle)],
          colors.lead,
        );
      }
  }
  if (level >= 2 && major) {
    const lines = level === 3 ? 30 : 18;
    for (let i = 0; i < lines; i++) {
      const a = (2 * pi * i) / lines;
      for (const [q, r] of pairs(meridian)) {
        const p = ([s, t]) => at(rad(center, a, radius * t + 0.037), mix(y, top, s) + 0.018);
        beam(out, 'roof', p(q), p(r), 0.044, 0.045, colors.ribs);
      }
    }
  }
  if (major) ornament(out, center, top, 1.48, level);
  else if (!half && level >= 2) ornament(out, center, top, 0.63, level);
}

function ornament(out, center, y, height, level) {
  round(
    out,
    'gold',
    center,
    [
      [y - 0.08, height * 0.17],
      [y + height * 0.31, height * 0.23],
      [y + height * 0.45, height * 0.075],
      [y + height * 0.79, height * 0.135],
      [y + height, height * 0.03],
    ],
    level === 0 ? 4 : 8,
    colors.finial,
  );
}

function prayerHall(out, level) {
  const body = rect(west, back, east, cb + 0.1);
  const bodyTop = floor + 17.58;
  mass(out, body, floor - 0.02, bodyTop, 'stone', colors.wall, colors.roofDark);
  const westward = areaSign(body);
  for (const [a, b] of pairs(closed(body))) {
    const w = edge(a, b, westward);
    const main = w.normal[2] > 0.8;
    panel(out, 'trim', w, 0, w.length, bodyTop - 0.27, bodyTop + 0.17, 0.07, colors.pale);
    const count = level === 0 ? 2 : main ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const x = (w.length * (i + 0.5)) / count;
      const radius = main && i === 2 ? 2.92 : 2.48;
      arch(out, level, w, x, radius * 2, floor + 5.45, floor + 11.18, 2.21, {
        striped: main,
        recess: true,
      });
      for (const shift of [-1.24, 0, 1.24]) {
        panel(
          out,
          'dark',
          w,
          x + shift - 0.3,
          x + shift + 0.3,
          floor + 6.65,
          floor + (shift === 0 ? 10.94 : 10.02),
          0.081,
          colors.glazing,
        );
      }
      if (level > 1) {
        for (const shift of [-1.38, 1.38])
          arch(out, level, w, x + shift, 1.06, floor + 0.89, floor + 3.03, 0.65);
        panel(
          out,
          'trim',
          w,
          x - radius - 0.07,
          x + radius + 0.07,
          floor + 5.02,
          floor + 5.26,
          0.046,
          colors.chalk,
        );
      }
    }
  }
  const center = d.domeCenter,
    radius = d.domeDiameter / 2;
  const shoulder = floor + 22.45;
  const core = Array.from({ length: 6 }, (_, i) => rad(center, pi / 6 + (i * pi) / 3, 17.1));
  mass(out, core, bodyTop - 0.12, shoulder, 'stone', colors.wall, colors.roofDark);
  for (let i = 0; i < d.halfDomeCount; i++) {
    const a = (i * 2 * pi) / d.halfDomeCount;
    const q = rad(center, a, 14.7);
    const r = 7.49;
    const wallBase = bodyTop - 0.68,
      capY = bodyTop + 2.29;
    const sides = [4, 6, 9, 16][level],
      outline = Array.from({ length: sides }, (_, i) => rad(q, (i * 2 * pi) / sides, r));
    mass(out, outline, wallBase, capY, 'stone', colors.pale);
    dome(out, level, q, r, capY, capY + 5.38, { angle: a });
    if (level > 1) {
      for (const [p, q] of pairs(closed(outline))) {
        const w = edge(p, q, 1);
        if (w.normal[0] * Math.cos(a) + w.normal[2] * Math.sin(a) <= 0.23) continue;
        arch(out, level, w, w.length / 2, 0.71, wallBase + 0.67, wallBase + 1.94, 0.38);
      }
    }
  }
  for (const q of core) {
    round(
      out,
      'stone',
      q,
      [
        [bodyTop - 0.1, 1.94],
        [shoulder + 3.0, 1.54],
      ],
      level < 2 ? 4 : 8,
      colors.pale,
      false,
    );
    if (level > 0) dome(out, level, q, 1.58, shoulder + 3.0, shoulder + 4.77);
  }
  const spring = floor + 31.95;
  const drumN = [8, 14, 21, 32][level];
  const ring = Array.from({ length: drumN }, (_, i) => rad(center, (2 * pi * i) / drumN, radius));
  mass(out, ring, shoulder - 0.2, spring, 'stone', colors.shade, colors.roofDark);
  if (level > 0)
    round(
      out,
      'trim',
      center,
      [
        [spring - 0.38, radius],
        [spring - 0.26, radius + 0.32],
        [spring - 0.02, radius + 0.32],
      ],
      drumN,
      colors.pale,
      false,
    );
  for (const [a, b] of level > 0 ? pairs(closed(ring)) : []) {
    const w = edge(a, b, 1);
    const middle = w.length * 0.5;
    arch(out, level, w, middle, w.length * 0.61, spring - 4.77, spring - 2.5, 0.69);
    if (level > 0)
      panel(out, 'trim', w, 0.045, 0.16, spring - 5.18, spring - 0.43, 0.06, colors.pale);
  }
  dome(out, level, center, radius, spring, floor + d.domeHeight, { major: true });
}

function court(out, level) {
  const runs = [
    { a: [ce, cf], b: [cw, cf], depth: front - cf, count: 7 },
    { a: [cw, cf], b: [cw, cb], depth: cw - west, count: 5 },
    { a: [ce, cb], b: [ce, cf], depth: east - ce, count: 5 },
  ];
  const y = floor + 7.62;
  for (const { a, b, depth, count } of runs) {
    const w = edge(a, b, -1);
    const bay = w.length / count;
    const spring = floor + 3.28;
    const slab = [w.p(0, y), w.p(w.length, y), w.p(w.length, y, -depth), w.p(0, y, -depth)].map(
      ([x, , z]) => [x, z],
    );
    if (level === 0) {
      mass(out, slab, floor + 0.03, y, 'stone', colors.pale, colors.roofDark);
      for (let i = 0; i < count; i += 2) {
        const [x, , z] = w.p(bay * (i + 0.5), 0, -depth * 0.49);
        round(
          out,
          'roof',
          [x, z],
          [
            [y, 2.0],
            [y + 1.35, 0.25],
          ],
          4,
          colors.lead,
          false,
        );
      }
      continue;
    }
    for (let i = 0; i <= count; i++)
      pier(
        out,
        w,
        bay * i,
        i === 0 || i === count ? 0.68 : 0.79,
        floor + 0.03,
        y,
        depth,
        colors.pale,
      );
    for (let i = 0; i < count; i++) {
      const x = bay * (i + 0.5),
        span = bay - 0.66;
      arch(out, level, w, x, span, floor, spring, 1.64, {
        openDepth: depth,
        top: y,
        striped: true,
      });
      const p = w.p(x, 0, -depth * 0.49),
        q = [p[0], p[2]];
      const r = Math.min(bay * 0.465, depth * 0.37);
      round(
        out,
        'stone',
        q,
        [
          [y, r],
          [y + 1.1, r],
        ],
        level < 2 ? 5 : 8,
        colors.pale,
        false,
      );
      dome(out, level, q, r, y + 1.1, y + 1.1 + r * 0.65);
    }
    for (const offset of [0, -depth]) {
      panel(out, 'stone', w, 0, w.length, y - 0.14, y + 0.24, offset, colors.chalk);
    }
    cap(out, 'roof', slab, y + 0.035, colors.roofDark);
    const outside = {
      ...w,
      normal: w.normal.map((n) => -n),
      p: (u, v, t = 0) => w.p(u, v, -depth - t),
    };
    if (level > 1)
      windows(out, level, outside, y - 2.43, y - 1.39, 0.38, 0.9, count, { striped: true });
  }
}

function minaret(out, level, center) {
  const n = [4, 6, 10, 20][level];
  const atHeight = (y) => floor + y;
  const section = (ranges) => ranges.map(([h, r]) => [atHeight(h), r]);
  const lift = ([h, r]) => [atHeight(h), r];
  const [a, b, c] = d.balconyHeights;
  const shaft = [
    [-0.1, 2.65],
    [7.5, 2.59],
    [14.1, 1.34],
    [a - 2.18, 1.13],
    [a - 0.18, 1.13],
    [a + 0.79, 1.1],
    [b - 0.18, 1.04],
    [b + 0.82, 1.02],
    [c - 0.18, 0.97],
    [c + 0.77, 0.94],
    [62.64, 0.81],
  ];
  round(
    out,
    'stone',
    center,
    section(level < 2 ? shaft.filter((_, i) => [0, 1, 2, 10].includes(i)) : shaft),
    n,
    colors.chalk,
    false,
  );
  if (level > 1) {
    round(
      out,
      'trim',
      center,
      section([
        [0.22, 2.79],
        [0.53, 2.79],
        [0.58, 2.63],
      ]),
      8,
      colors.pale,
      false,
    );
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * pi) / 5,
        b = ((i + 1) * 2 * pi) / 5;
      const w = edge(rad(center, a, 2.64), rad(center, b, 2.64), 1);
      const x = w.length / 2,
        d = 0.035;
      panel(out, 'trim', w, x - 0.84, x + 0.84, floor + 1.18, floor + 6.17, d, colors.pale);
      panel(out, 'trim', w, x - 0.72, x + 0.72, floor + 1.34, floor + 6.0, d + 0.017, colors.shade);
      panel(out, 'stone', w, x - 0.65, x + 0.65, floor + 1.5, floor + 5.8, d + 0.023, colors.wall);
    }
  }
  for (const y of d.balconyHeights) {
    const radius = 1.1 - (y - a) * 0.007;
    const balcony =
      level === 0
        ? [
            [y - 0.99, radius],
            [y + 0.2, 1.9],
          ]
        : level === 1
          ? [
              [y - 1.64, radius],
              [y + 0.06, 1.91],
              [y + 0.58, 1.8],
            ]
          : [
              [y - 1.71, radius],
              [y - 0.55, 1.63],
              [y - 0.14, 1.91],
              [y + 0.12, 1.99],
              [y + 0.68, 1.91],
              [y + 0.76, 1.68],
            ];
    round(out, 'trim', center, balcony.map(lift), n, colors.pale, level > 1);
    if (level >= 2) {
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * pi) / n;
        const p = rad(center, a, radius + 0.03),
          q = rad(center, a, 1.71);
        beam(
          out,
          'trim',
          at(p, atHeight(y - 1.23)),
          at(q, atHeight(y - 0.26)),
          0.19,
          0.18,
          colors.chalk,
        );
      }
    }
  }
  const tip = level === 0 ? d.minaretHeight : 70.91;
  round(
    out,
    'roof',
    center,
    section(
      level === 0
        ? [
            [62.63, 0.87],
            [tip, 0.035],
          ]
        : [
            [62.63, 0.87],
            [64.02, 0.68],
            [68.03, 0.36],
            [tip, 0.087],
          ],
    ),
    n,
    colors.roofDark,
    false,
  );
  if (level > 0) ornament(out, center, atHeight(tip), d.minaretHeight - tip, level);
}

function build(out, level) {
  stage(out, level);
  prayerHall(out, level);
  court(out, level);
  for (const center of d.minaretPositions) minaret(out, level, center);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'mimar-sinan-mosque-model.mjs';
const camera = [112, 75, -124],
  lookAt = [0, 24, -1.5];
const errors = { district: 0.71, street: 0.24, closeup: 0.086 };
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
    'The native mosque relation sets the outer hall and court. Original terraced ground controls the northwest approach and the mosque podium.',
  brief:
    'Ataşehir’s Mimar Sinan Mosque, with a large grey-blue dome, six surrounding half domes, an open arcade court and four three-balcony minarets.',
  camera,
  lookAt,
  sunDirection: [105, 119, 39],
  mediumFiContext: {
    scale: 1,
    groundY: 0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis:
      'The named mosque envelope supplies the building replacement boundary and its courtyard is reconstructed open.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_ashlar',
    'metal_standing_seam',
    'metal_bronze_cast',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'four-spires-and-central-dome', position: [-102, 76, -142], lookAt: [0, 31, -3] },
    { name: 'open-court-and-arched-porch', position: [-5, 21, 70], lookAt: [0, 13, 13] },
    { name: 'hexagonal-half-dome-roofs', position: [74, 74, -58], lookAt: [0, 32, -16] },
  ],
  qaLodCameras: decorate.map((reviewLod) => ({
    name: 'mimar-sinan-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.31,
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
