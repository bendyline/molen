import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  plaster: surface('wall', 'plaster_lime'),
  base: surface('foundation', 'stone_sandstone'),
  vault: surface('roof', 'plaster_lime', 0.92),
  brick: surface('trim', 'brick_flemish'),
  timber: surface('door', 'wood_plain'),
  glass: surface('window', 'window_punched'),
};
const C = palette({
  plaster: 'c3a180',
  portal: 'd3b390',
  cap: 'c7a887',
  earth: 'a88c70',
  light: 'd7b79b',
  trim: 'a0765f',
  wear: 'b39073',
  wood: '725c47',
  shade: '605848',
  glass: '6a746f',
});
const cornice = 4.03;

function interpolate(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
}

function crossSection(span, base, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = (2 * i) / n - 1;
    return [u * span, base + rise * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 1.62)), 0.69)];
  });
}

function triangularLight(out, lod, w, x, y, span, length) {
  const depth = 0.045;
  const shape = (gap, d) => [
    w.p(x - span + gap, y + gap, d),
    w.p(x + span - gap, y + gap, d),
    w.p(x, y + length - gap * 1.46, d),
  ];
  face(out, 'brick', shape(0, depth), w.normal, C.light);
  face(out, 'timber', shape(span * 0.19, depth + 0.035), w.normal, C.shade);
  if (lod < 2) return;
  const width = span * 0.23;
  for (const i of [-1, 0, 1])
    panel(
      out,
      'timber',
      w,
      x + i * width - 0.02,
      x + i * width + 0.02,
      y + 0.07,
      y + length * (i === 0 ? 0.74 : 0.47),
      depth + 0.062,
      C.wood,
    );
}

function vault(out, lod, front, back, span, y, rise, skylights = 3) {
  const distance = Math.hypot(back[0] - front[0], back[1] - front[1]);
  const line = [(back[0] - front[0]) / distance, (back[1] - front[1]) / distance];
  const across = [line[1], -line[0]];
  const frontNormal = [-line[0], 0, -line[1]];
  const rearNormal = [line[0], 0, line[1]];
  const profile = crossSection(span, y, rise, [4, 8, 12, 18][lod]);
  const p = (c, x, h) => [c[0] + across[0] * x, h, c[1] + across[1] * x];
  for (const [[a, ah], [b, bh]] of pairs(profile)) {
    face(
      out,
      'vault',
      [p(front, a, ah), p(front, b, bh), p(back, b, bh), p(back, a, ah)],
      up,
      C.plaster,
    );
    for (const [center, normal] of [
      [front, frontNormal],
      [back, rearNormal],
    ])
      face(
        out,
        'plaster',
        [p(center, a, y - 0.13), p(center, b, y - 0.13), p(center, b, bh), p(center, a, ah)],
        normal,
        C.portal,
      );
  }
  for (const [center, normal] of [
    [front, frontNormal],
    [back, rearNormal],
  ]) {
    const w = {
      normal,
      p: (x, h, d) => [
        center[0] + across[0] * x + normal[0] * d,
        h,
        center[1] + across[1] * x + normal[2] * d,
      ],
    };
    if (lod > 0) {
      const ridge = profile.map(([x, h]) => w.p(x, h - 0.052, 0.057));
      beamPath(out, 'brick', ridge, 0.16, 0.15, C.light);
    }
    for (let i = 0; i < skylights; i++) {
      const x = (i - (skylights - 1) / 2) * span * 0.35;
      const scale = i === 1 && skylights === 3 ? 1 : 0.82;
      triangularLight(out, lod, w, x, y + rise * 0.21, span * 0.13 * scale, rise * 0.43 * scale);
    }
  }
  if (lod < 2 || distance < 9) return;
  for (const t of [0.33, 0.67]) {
    const c = interpolate(front, back, t);
    beamPath(
      out,
      'vault',
      profile.map(([x, h]) => p(c, x, h + 0.045)),
      0.12,
      0.13,
      C.cap,
    );
  }
}

function westPortal(out, lod, outline, grade) {
  const a = outline[15];
  const b = outline[16];
  const wall = edge(a, b, areaSign(outline));
  const middle = wall.length * 0.46;
  const at = (x, y, d = 0) => wall.p(middle + x, y, d);
  const anchor = at(0, 0, 1.6);
  const approach = grade([anchor[0], anchor[2]]);
  const floor = Math.max(approach + 0.23, -0.33);
  const height = floor + 6.12;
  const arch = crossSection(2.07, floor + 3.02, 1.82, [4, 8, 12, 18][lod]);
  const depth = 2.34;
  const width = 3.35;
  for (const [x0, x1] of [
    [-width, -2.07],
    [2.07, width],
  ]) {
    for (const [z, d] of [
      [depth, 1],
      [0, -1],
    ])
      face(
        out,
        'plaster',
        [at(x0, floor - 0.28, z), at(x1, floor - 0.28, z), at(x1, height, z), at(x0, height, z)],
        wall.normal.map((n) => n * d),
        C.portal,
      );
    for (const x of [x0, x1])
      face(
        out,
        'plaster',
        [
          at(x, floor - 0.28, 0),
          at(x, floor - 0.28, depth),
          at(x, height, depth),
          at(x, height, 0),
        ],
        [Math.sign(x), 0, 0],
        C.plaster,
      );
  }
  for (const [[a, low], [b, hi]] of pairs(arch)) {
    face(
      out,
      'plaster',
      [at(a, low, depth), at(b, hi, depth), at(b, height, depth), at(a, height, depth)],
      wall.normal,
      C.portal,
    );
    face(
      out,
      'brick',
      [at(a, low, depth), at(b, hi, depth), at(b, hi, 0.04), at(a, low, 0.04)],
      [0, -1, 0],
      C.wear,
    );
  }
  face(
    out,
    'vault',
    [
      at(-width, height, 0),
      at(width, height, 0),
      at(width, height, depth),
      at(-width, height, depth),
    ],
    up,
    C.cap,
  );
  panel(out, 'timber', wall, middle - 2.09, middle + 2.09, floor, floor + 3.08, 0.07, C.shade);
  face(
    out,
    'timber',
    arch.map(([x, y]) => at(x, y, 0.074)),
    wall.normal,
    C.shade,
  );
  if (lod > 0) {
    beamPath(
      out,
      'brick',
      [
        at(-2.07, floor + 0.23, depth + 0.07),
        ...arch.map(([x, y]) => at(x, y, depth + 0.07)),
        at(2.07, floor + 0.23, depth + 0.07),
      ],
      0.27,
      0.23,
      C.light,
    );
    const signCenter = middle;
    panel(
      out,
      'plaster',
      wall,
      signCenter - 1.43,
      signCenter + 1.43,
      height - 0.56,
      height - 0.18,
      depth + 0.048,
      C.plaster,
    );
    for (const x of [-1.78, -0.96, 0, 0.96, 1.78])
      panel(
        out,
        'brick',
        wall,
        middle + x - 0.035,
        middle + x + 0.035,
        floor + 0.14,
        floor + 3.19,
        0.08,
        C.wood,
      );
  }
  for (let i = 0; i < 3; i++) {
    const z0 = depth + i * 0.32;
    const z1 = z0 + 0.32;
    const y = floor - 0.09 * i;
    const p = at(0, y, z1);
    const base = Math.min(grade([p[0], p[2]]) - 0.16, y - 0.12);
    face(
      out,
      'base',
      [at(-2.46, y, z0), at(2.46, y, z0), at(2.46, y, z1), at(-2.46, y, z1)],
      up,
      C.earth,
    );
    face(
      out,
      'base',
      [at(-2.46, base, z1), at(2.46, base, z1), at(2.46, y, z1), at(-2.46, y, z1)],
      wall.normal,
      C.wear,
    );
  }
}

function masonryTrims(out, lod, outline, grade) {
  const outward = areaSign(outline);
  for (const [[a, b], i] of pairs([...outline, outline[0]]).map((pair, i) => [pair, i])) {
    const w = edge(a, b, outward);
    panel(out, 'brick', w, 0, w.length, cornice - 0.21, cornice - 0.06, 0.034, C.trim);
    if (lod === 0 || w.length < 5) continue;
    const baseA = grade(a),
      baseB = grade(b);
    face(
      out,
      'base',
      [
        w.p(0, baseA - 0.16, 0.028),
        w.p(w.length, baseB - 0.16, 0.028),
        w.p(w.length, baseB + 0.32, 0.028),
        w.p(0, baseA + 0.32, 0.028),
      ],
      w.normal,
      C.earth,
    );
    if (i === 15 || (w.length < 12 && i % 2) || (i > 6 && i < 12)) continue;
    const count = Math.max(1, Math.floor(w.length / 5.5));
    for (let n = 0; n < count; n++) {
      const u = (w.length * (n + 0.5)) / count;
      panel(out, 'brick', w, u - 0.68, u + 0.68, 1.6, 2.98, 0.042, C.wear);
      panel(out, 'glass', w, u - 0.52, u + 0.52, 1.74, 2.89, 0.061, C.shade);
      if (lod >= 2) {
        panel(out, 'timber', w, u - 0.032, u + 0.032, 1.75, 2.89, 0.075, C.wood);
        panel(out, 'timber', w, u - 0.51, u + 0.51, 2.34, 2.39, 0.079, C.wood);
        panel(out, 'brick', w, u - 0.76, u + 0.76, 1.63, 1.73, 0.079, C.light);
      }
    }
  }
}

function build(out, lod, { outline }, grade) {
  shell(out, outline, (p) => grade(p) - 0.32, cornice, {
    wall: 'plaster',
    color: C.plaster,
    roof: 'vault',
    roofColor: C.cap,
  });
  masonryTrims(out, lod, outline, grade);
  for (const [x, span, rise] of [
    [5.97, 4.28, 1.94],
    [15.62, 5.14, 2.88],
    [25.22, 4.36, 2.15],
  ])
    vault(out, lod, [x, -9.67], [x, 19.51], span, cornice - 0.02, rise);
  vault(out, lod, [1.02, -1.4], [-12.07, -1.4], 2.18, cornice - 0.006, 1.19, 1);
  vault(out, lod, [29.92, -0.43], [38.05, -0.43], 2.22, cornice, 1.34, 1);
  const west = [outline[15], outline[16]];
  const east = [outline[14], outline[13]];
  for (const [t, span, rise] of [
    [0.27, 4.65, 2.31],
    [0.72, 4.43, 2.19],
  ])
    vault(out, lod, interpolate(...west, t), interpolate(...east, t), span, cornice - 0.02, rise);
  westPortal(out, lod, outline, grade);
  if (lod > 0)
    for (const [x, z] of [
      [6.42, 16.8],
      [25, 15.89],
      [-7.8, 3.14],
    ]) {
      block(out, 'plaster', x - 0.46, cornice - 0.07, z - 0.38, 0.92, 0.45, 0.76, C.cap);
      block(out, 'brick', x - 0.51, cornice + 0.32, z - 0.44, 1.02, 0.14, 0.88, C.light);
    }
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The standing site museum in Kerma, with joined domestic-scale gallery ranges, rounded Nubian vaults with triangular light openings, and a deep west entrance facing the ancient city.',
    camera: [-65, 25, -66],
    lookAt: [-8, 3.95, 1.0],
    sun: [-450, 575, -760],
    yaw: -0.55,
    views: [
      {
        name: 'west-entry-to-the-archaeological-site',
        position: [-35, 8, -49],
        lookAt: [-27, 3.15, -14],
      },
      { name: 'vaults-and-triangular-lights', position: [23, 12, -38], lookAt: [15, 4.4, -8.5] },
      { name: 'connected-gallery-ranges', position: [48, 29, 49], lookAt: [-7.8, 3.35, 0.2] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis:
    'Replace the generic mapped museum only. The ancient Western Deffufa and neighboring archaeological fabric remain distinct.',
};
