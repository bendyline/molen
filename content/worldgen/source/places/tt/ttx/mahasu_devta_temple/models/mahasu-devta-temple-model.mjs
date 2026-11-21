import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  pairs,
  palette,
  panel,
  rect,
  ring,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const y = -0.43;
const colors = palette({
  stone: 'a6a093',
  sanctuary: '8d8e85',
  cut: 'b7ada0',
  rock: '88847b',
  wood: 'a16440',
  darkWood: '694936',
  trim: 'bd8956',
  shadow: '474139',
  slate: '838481',
  lightSlate: 'a8a5a0',
  edgeSlate: '727577',
  brass: 'b69248',
  brightBrass: 'c9a254',
  green: '436b60',
  orange: 'b97243',
  red: '934c42',
  warm: 'b18f65',
  bench: 'ada49a',
  plaster: 'cebc9f',
});
const surfaces = {
  rubble: surface('wall', 'stone_limestone_weathered', 0.94),
  ashlar: surface('foundation', 'stone_ashlar', 0.94),
  timber: surface('trim', 'wood_board_batten', 0.86),
  slate: surface('roof', 'slate', 0.92, 0.05),
  brass: surface('trim', 'metal_bronze_cast', 0.73, 0.25),
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
};
const bounds = (p) =>
  [0, 1].map((i) => [Math.min(...p.map((t) => t[i])), Math.max(...p.map((t) => t[i]))]);
const mean = (a, b) => (a + b) * 0.5;
const shape = (x, z, width, depth) =>
  rect(x - width / 2, z + depth / 2, x + width / 2, z - depth / 2);
const section = ([x, z], [w, l], y) => shape(x, z, w, l).map((p) => at(p, y));

function walls(out, footprint, low, high, material, color) {
  const direction = areaSign(footprint);
  for (const [a, b] of pairs(closed(footprint))) {
    const w = edge(a, b, direction);
    face(
      out,
      material,
      [
        at(a, typeof low === 'number' ? low : low(a)),
        at(b, typeof low === 'number' ? low : low(b)),
        at(b, high),
        at(a, high),
      ],
      w.normal,
      color,
    );
  }
}

function steppedSlate(out, level, center, width, depth, low, rise, topRatio, woodEdge = true) {
  const bottom = section(center, [width, depth], low);
  const breakAt = section(center, [width * 0.9, depth * 0.9], low + rise * 0.19);
  const crest = section(
    center,
    [Math.max(0.16, width * topRatio), Math.max(0.16, depth * topRatio)],
    low + rise,
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'slate', [bottom[i], bottom[j], breakAt[j], breakAt[i]], up, colors.edgeSlate);
    face(
      out,
      'slate',
      [breakAt[i], breakAt[j], crest[j], crest[i]],
      up,
      i % 2 === 0 ? colors.slate : colors.lightSlate,
    );
    if (woodEdge) {
      const a = bottom[i],
        b = bottom[j];
      if (level > 1)
        beam(
          out,
          'timber',
          [a[0], a[1] - 0.07, a[2]],
          [b[0], b[1] - 0.07, b[2]],
          0.122,
          0.142,
          colors.trim,
        );
      const innerA = breakAt[i],
        innerB = breakAt[j];
      face(
        out,
        'timber',
        [a, b, [innerB[0], low - 0.12, innerB[2]], [innerA[0], low - 0.12, innerA[2]]],
        [0, -1, 0],
        colors.darkWood,
      );
    }
    if (level > 2 && width > 4)
      for (const t of [0.25, 0.51, 0.73]) {
        const s = breakAt[i].map((p, k) => mix(p, crest[i][k], t));
        const p = breakAt[j].map((p, k) => mix(p, crest[j][k], t));
        const a = breakAt[i].map((p, k) => mix(p, crest[i][k], t + 0.026));
        const b = breakAt[j].map((p, k) => mix(p, crest[j][k], t + 0.026));
        face(
          out,
          'slate',
          [s, p, b, a].map(([x, h, z]) => [x, h + 0.032, z]),
          up,
          colors.edgeSlate,
        );
      }
  }
  cap(
    out,
    'slate',
    crest.map(([x, , z]) => [x, z]),
    low + rise,
    colors.slate,
  );
}

function frieze(out, level, footprint, low, top, tint = colors.wood) {
  walls(out, footprint, low, top, 'timber', tint);
  if (level === 0) return;
  const direction = areaSign(footprint);
  for (const [a, b] of pairs(closed(footprint))) {
    const w = edge(a, b, direction),
      n = Math.max(3, Math.round(w.length / (level > 1 ? 0.62 : 1.07)));
    const pitch = w.length / n;
    panel(out, 'timber', w, 0, w.length, low + 0.045, low + 0.17, 0.038, colors.trim);
    panel(out, 'timber', w, 0, w.length, top - 0.1, top - 0.025, 0.058, colors.darkWood);
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) * pitch;
      panel(
        out,
        'paint',
        w,
        p - pitch * 0.32,
        p + pitch * 0.32,
        low + 0.22,
        top - 0.15,
        0.018,
        colors.darkWood,
      );
      if (level > 1) {
        panel(
          out,
          'timber',
          w,
          p - pitch * 0.072,
          p + pitch * 0.072,
          low + 0.14,
          top + 0.005,
          0.059,
          colors.trim,
        );
        const z0 = low + 0.27,
          z1 = top - 0.168;
        if (z1 > z0 + 0.16) {
          const start = p - pitch * 0.26,
            end = p + pitch * 0.26;
          face(
            out,
            'timber',
            [
              w.p(start, mean(z0, z1), 0.055),
              w.p(p, z0, 0.055),
              w.p(end, mean(z0, z1), 0.055),
              w.p(p, z1, 0.055),
            ],
            w.normal,
            i % 3 === 1 ? colors.orange : colors.wood,
          );
        }
      }
    }
    if (level > 2)
      for (let i = 0; i < n; i++) {
        const p = (i + 0.22) * pitch;
        beam(
          out,
          'timber',
          w.p(p, top - 0.14, 0.115),
          w.p(p, top + 0.06, 0.115),
          0.054,
          0.067,
          colors.trim,
        );
      }
  }
}

function crown(out, level, [x, z], data) {
  const [eave, diameter, capHeight, finial, drum] = data;
  const segments = [6, 8, 10, 14][level],
    foot = diameter * 0.5;
  if (drum)
    ring(
      out,
      'timber',
      [x, z],
      [
        [eave - drum, foot * 0.78],
        [eave, foot * 0.74],
      ],
      segments,
      colors.darkWood,
    );
  ring(
    out,
    'slate',
    [x, z],
    [
      [eave, foot],
      [eave + capHeight * 0.28, foot * 0.86],
      [eave + capHeight, foot * 0.17],
    ],
    segments,
    colors.edgeSlate,
  );
  const top = eave + capHeight;
  ring(
    out,
    'brass',
    [x, z],
    [
      [top - 0.08, foot * 0.155],
      [top + finial * 0.14, foot * 0.17],
      [top + finial * 0.25, foot * 0.09],
      [top + finial * 0.51, foot * 0.13],
      [top + finial * 0.61, foot * 0.064],
      [top + finial * 0.75, foot * 0.105],
      [top + finial, 0.022],
    ],
    segments,
    colors.brightBrass,
  );
}

function sanctuary(out, level) {
  const [[a, b], [c, e]] = bounds(d.shrineRoof),
    x = mean(a, b),
    z = mean(c, e);
  const [width, depth] = [b - a, e - c],
    stone = shape(x, z, width * 0.73, depth * 0.77);
  walls(out, stone, (p) => Math.min(grade(p) - 0.2, y - 0.3), y + 3.63, 'ashlar', colors.sanctuary);
  for (const [offset, proportion] of [
    [0.04, 0.84],
    [0.38, 0.8],
    [3.24, 0.78],
  ]) {
    const contour = shape(x, z, width * proportion, depth * proportion);
    walls(out, contour, y + offset, y + offset + 0.18, 'ashlar', colors.cut);
    cap(out, 'ashlar', contour, y + offset + 0.18, colors.stone);
  }
  frieze(out, level, shape(x, z, width * 0.87, depth * 0.86), y + 3.58, y + 4.99);
  steppedSlate(out, level, [x, z], width, depth, y + 4.96, 0.7, 0.53);
  frieze(out, level, shape(x, z, width * 0.61, depth * 0.64), y + 5.47, y + 6.22, colors.wood);
  steppedSlate(out, level, [x, z], width * 0.73, depth * 0.74, y + 6.2, 0.71, 0.47);
  frieze(out, level, shape(x, z, width * 0.39, depth * 0.43), y + 6.77, y + 7.18, colors.darkWood);
  steppedSlate(out, level, [x, z], width * 0.47, depth * 0.49, y + 7.14, 1.28, 0.23);
  crown(out, level, [x, z], [y + 9.02, width * 0.259, 1.04, 1.33, 0.74]);
}

function hall(out, level) {
  const [[a, b], [c, e]] = bounds(d.hallRoof),
    x = mean(a, b),
    z = mean(c, e);
  const [width, depth] = [b - a, e - c];
  const stone = shape(x, z, width * 0.96, depth * 0.86);
  walls(out, stone, (p) => Math.min(y - 0.22, grade(p) - 0.29), y + 2.69, 'rubble', colors.stone);
  frieze(out, level, shape(x, z, width * 0.97, depth * 0.95), y + 2.65, y + 2.88);
  steppedSlate(out, level, [x, z], width, depth, y + 2.87, 0.76, 0.52);
  frieze(
    out,
    level,
    shape(x, z - 0.15, width * 0.84, depth * 0.69),
    y + 3.52,
    y + 4.18,
    colors.wood,
  );
  steppedSlate(out, level, [x, z - 0.15], width * 0.93, depth * 0.78, y + 4.17, 0.84, 0.51);
  frieze(
    out,
    level,
    shape(x + 0.42, z - 0.16, width * 0.33, depth * 0.38),
    y + 4.83,
    y + 5.63,
    colors.darkWood,
  );
  steppedSlate(out, level, [x + 0.42, z - 0.16], width * 0.44, depth * 0.49, y + 5.61, 0.86, 0.27);
  crown(out, level, [x + 0.42, z - 0.16], [y + 7.05, 1.35, 0.79, 0.77, 0.61]);
  if (level > 0) {
    for (const [u, bottom] of [
      [x - 1.35, y + 0.75],
      [x + 1.86, y + 0.75],
    ]) {
      const front = e - depth * 0.07;
      block(out, 'paint', u - 0.57, bottom, front + 0.04, 1.14, 0.94, 0.074, colors.green);
      if (level > 1)
        for (let n = 1; n < 5; n++)
          block(
            out,
            'timber',
            u - 0.57 + n * 0.224,
            bottom + 0.11,
            front + 0.125,
            0.048,
            0.72,
            0.046,
            colors.darkWood,
          );
    }
  }
}

function approach(out, level) {
  const x = -10.78,
    z = 0.12;
  const outer = shape(x, z, 5.1, 6.57);
  const solid = shape(x + 0.6, z, 3.22, 5.79);
  walls(out, solid, (p) => Math.min(y - 0.21, grade(p) - 0.25), y + 2.48, 'rubble', colors.stone);
  cap(out, 'ashlar', outer, y + 0.04, colors.cut);
  frieze(out, level, shape(x, z, 5.01, 6.2), y + 2.45, y + 2.76);
  steppedSlate(out, level, [x, z], 5.51, 6.84, y + 2.72, 0.98, 0.47);
  frieze(out, level, shape(x + 0.64, z, 3.15, 3.72), y + 3.48, y + 4.26, colors.wood);
  steppedSlate(out, level, [x + 0.64, z], 3.88, 4.54, y + 4.24, 0.89, 0.38);
  crown(out, level, [x + 0.7, z], [y + 5.56, 1.49, 0.73, 0.68, 0.48]);
  const front = -14.15,
    back = -11.91,
    base = y + 0.07,
    roof = y + 2.78,
    peak = roof + 1.24;
  const gable = (u) => [
    [u, roof, -2.35],
    [u, peak, 0.08],
    [u, roof, 2.54],
  ];
  const [a, b, c] = gable(front),
    [d, e, f] = gable(back);
  face(out, 'slate', [a, d, e, b], up, colors.slate);
  face(out, 'slate', [b, e, f, c], up, colors.edgeSlate);
  face(out, 'timber', [a, b, c], [-1, 0, 0], colors.wood);
  for (const v of [-2.1, 2.34]) {
    beam(
      out,
      'timber',
      [front + 0.12, base, v],
      [front + 0.12, roof, v],
      0.29,
      0.32,
      colors.darkWood,
    );
    beam(
      out,
      'ashlar',
      [front + 0.12, base - 0.51, v],
      [front + 0.12, base + 0.3, v],
      0.55,
      0.55,
      colors.stone,
    );
  }
  if (level > 1) {
    for (const [p, q] of [
      [a, b],
      [c, b],
    ])
      beam(out, 'timber', p, q, 0.153, 0.21, colors.trim);
    const portalX = -12.447,
      arc = (angle, r) => [portalX, base + 1.57 + r * Math.sin(angle), 0.08 + r * Math.cos(angle)];
    const count = level > 2 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * i) / count,
        b = (Math.PI * (i + 1)) / count;
      face(
        out,
        'paint',
        [arc(a, 0.83), arc(b, 0.83), arc(b, 1.11), arc(a, 1.11)],
        [-1, 0, 0],
        i % 3 === 1 ? colors.red : i % 3 === 0 ? colors.trim : colors.green,
      );
    }
    for (const v of [-1.01, 1.19])
      beam(out, 'timber', [portalX, base, v], [portalX, base + 1.62, v], 0.24, 0.24, colors.wood);
  }
  const pad = shape(-13.75, z, 2.13, 5.59);
  walls(out, pad, (p) => Math.min(grade(p) - 0.2, y - 0.4), y, 'ashlar', colors.rock);
  cap(out, 'ashlar', pad, y, colors.bench);
}

function court(out, level) {
  const walkway = rect(-7.73, 13.4, 1.65, 5.34);
  walls(out, walkway, (p) => Math.min(grade(p) - 0.12, y - 0.3), y + 0.08, 'ashlar', colors.stone);
  cap(out, 'ashlar', walkway, y + 0.08, colors.bench);
  for (const [x, z, w] of d.shrines) {
    const base = Math.max(y + 0.1, grade([x, z]) + 0.1),
      foot = shape(x, z, w * 1.46, w * 1.28),
      body = shape(x, z, w * 1.01, w * 0.93);
    walls(out, foot, base - 0.43, base + 0.24, 'ashlar', colors.rock);
    cap(out, 'ashlar', foot, base + 0.24, colors.stone);
    walls(out, body, base + 0.21, base + w * 0.92, 'rubble', colors.warm);
    for (const [n, ratio] of [
      [0, 1.16],
      [1, 0.93],
      [2, 0.74],
      [3, 0.57],
      [4, 0.46],
    ]) {
      const lo = base + w * (0.84 + n * 0.228),
        footprint = shape(x, z, w * ratio, w * ratio);
      walls(out, footprint, lo, lo + w * 0.224, 'ashlar', n % 2 === 0 ? colors.cut : colors.rock);
      cap(out, 'ashlar', footprint, lo + w * 0.224, colors.stone);
    }
    if (level > 1) {
      const front = z + w * 0.48;
      block(
        out,
        'paint',
        x - w * 0.22,
        base + 0.25,
        front + 0.009,
        w * 0.44,
        w * 0.63,
        0.06,
        colors.shadow,
      );
      for (const k of [-0.41, 0.38])
        block(
          out,
          'ashlar',
          x + w * k,
          base + 0.23,
          front + 0.03,
          w * 0.14,
          w * 0.73,
          0.09,
          colors.warm,
        );
    }
  }
}

function build(out, level) {
  sanctuary(out, level);
  hall(out, level);
  approach(out, level);
  court(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'mahasu-devta-temple-model.mjs',
  camera = [-25, 18, 35],
  lookAt = [-2.8, 4.4, 1.6];
const lods = { district: 0.65, street: 0.26, closeup: 0.075 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Independent Tons Valley relief and the native temple roof frame place the building beside its southern court. Foundations reflect the local grade change.',
  brief:
    'Hanol’s stone sanctuary and carved amber timber galleries stand under tiered slate roofs with gold finials, beside smaller stone shrines in the court.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-49, 69, 60],
  mediumFiContext: {
    scale: 1,
    groundY: y,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.87,
    basis:
      'Only the two contiguous main temple roof controls replace mapped buildings inside the Hanol site.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_ashlar',
    'wood_board_batten',
    'slate',
    'metal_bronze_cast',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'southern-elevation-and-court', position: [-3, 9.6, 27], lookAt: [-2.5, 4.1, 0] },
    { name: 'wooden-entrance-and-slate', position: [-24, 6.8, 13], lookAt: [-7.7, 3.8, 0] },
    { name: 'sanctum-roof-and-gold-finial', position: [17, 17.7, 18.5], lookAt: [2, 6.2, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mahasu-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.53,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
