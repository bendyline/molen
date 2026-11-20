import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  opening,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  masonry: surface('wall', 'stone_ashlar'),
  timber: surface('trim', 'wood_plain'),
  base: surface('foundation', 'concrete_plain'),
  iron: surface('roof', 'metal_corrugated', 0.79, 0.14),
  sash: surface('window', 'window_punched', 0.62, 0.01),
};
const C = {
  floor: 0.19,
  wall: 3.25,
  ...palette({
    pale: 'd5ccb4',
    sandstone: 'bca886',
    offwhite: 'e0d9c2',
    floorStone: 'b4a786',
    timber: 'beb7a2',
    post: 'b8ae91',
    door: '75695b',
    shade: '5b625e',
    iron: 'adafa4',
    dullIron: '92978d',
    lightIron: 'bec1b9',
  }),
};
function walls(x0, z0, x1, z1) {
  const bounds = rect(x0, z0, x1, z1);
  const sign = areaSign(bounds);
  return bounds.map((p, i) => edge(p, bounds[(i + 1) % 4], sign));
}
function mass(out, p, bottom, top, material, color, capMaterial = material) {
  shell(out, p, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: material,
    color,
    roof: capMaterial,
    roofColor: color,
  });
}
function sash(out, w, center, bottom, top, width, lod) {
  const left = center - width / 2;
  const right = center + width / 2;
  if (lod === 0) {
    panel(out, 'sash', w, left, right, bottom, top, 0.045, C.shade);
    return;
  }
  opening(out, w, left, right, bottom, top, 'timber', C.shade, 'sash', C.offwhite, 0, 0.04);
  if (lod > 1) {
    panel(out, 'timber', w, center - 0.026, center + 0.026, bottom, top, 0.088, C.timber);
    const mid = (bottom + top) / 2;
    panel(out, 'timber', w, left, right, mid - 0.027, mid + 0.027, 0.089, C.offwhite);
    if (lod === 3) {
      for (const y of [mix(bottom, top, 0.25), mix(bottom, top, 0.75)])
        panel(out, 'timber', w, left, right, y - 0.02, y + 0.02, 0.092, C.offwhite);
    }
  }
}
function door(out, w, center, lod) {
  const left = center - 0.56;
  const right = center + 0.56;
  if (lod === 0) {
    panel(out, 'timber', w, left, right, C.floor + 0.01, 2.45, 0.044, C.door);
    return;
  }
  opening(
    out,
    w,
    left,
    right,
    C.floor + 0.01,
    2.45,
    'masonry',
    C.door,
    'timber',
    C.offwhite,
    0,
    0.041,
  );
  if (lod >= 2) sash(out, w, center, 2.49, 2.81, 1.05, lod);
}
function metalRoof(out, rim, ridge, lod, color = C.iron) {
  const [a, b, c, d] = rim;
  const [e, f] = ridge;
  for (const [vertices, tone] of [
    [[a, b, f, e], color],
    [[b, c, f], C.lightIron],
    [[c, d, e, f], C.dullIron],
    [[d, a, e], color],
  ])
    face(out, 'iron', vertices, [0, 1, 0], tone);
  if (lod > 0) {
    beam(out, 'iron', e, f, 0.12, 0.09, C.lightIron);
    for (const [s, t] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      beam(out, 'iron', s, t, 0.1, 0.13, C.dullIron);
  }
  if (lod >= 2)
    for (const [s, t] of [
      [a, e],
      [b, f],
      [c, f],
      [d, e],
    ])
      beam(out, 'iron', s, t, 0.082, 0.083, C.lightIron);
}
function transverse(out, outline, grade, lod) {
  const l = outline[2][0];
  const r = outline[8][0];
  const near = outline[9][1];
  const far = outline[3][1];
  const ridgeX = 0.5 * (l + r);
  const high = 5.54;
  mass(out, rect(l + 0.26, far + 0.24, r - 0.26, near - 0.24), grade, C.wall, 'masonry', C.pale);
  for (const [z, normal] of [
    [far, -1],
    [near, 1],
  ]) {
    const w = { normal: [0, 0, normal], p: (x, y, d) => [x, y, z - normal * 0.24 + d * normal] };
    face(
      out,
      'masonry',
      [
        [l + 0.26, C.wall - 0.01, z - normal * 0.24],
        [r - 0.26, C.wall - 0.01, z - normal * 0.24],
        [ridgeX, high - 0.14, z - normal * 0.24],
      ],
      w.normal,
      C.pale,
    );
    sash(out, w, ridgeX, 1.02, 2.81, 1.21, lod);
    if (lod >= 2) panel(out, 'timber', w, ridgeX - 0.28, ridgeX + 0.28, 3.99, 4.3, 0.057, C.post);
  }
  for (const [x, tone] of [
    [l, C.iron],
    [r, C.lightIron],
  ]) {
    face(
      out,
      'iron',
      [
        [x, C.wall, far],
        [x, C.wall, near],
        [ridgeX, high, near],
        [ridgeX, high, far],
      ],
      [0, 1, 0],
      tone,
    );
    if (lod > 0) beam(out, 'iron', [x, C.wall, far], [x, C.wall, near], 0.1, 0.1, C.dullIron);
    if (lod > 1)
      for (const z of [far, near])
        beam(
          out,
          'timber',
          [x, C.wall - 0.05, z],
          [ridgeX, high - 0.05, z],
          0.12,
          0.13,
          C.offwhite,
        );
  }
  if (lod > 0)
    beam(
      out,
      'iron',
      [ridgeX, high, far - 0.05],
      [ridgeX, high, near + 0.05],
      0.1,
      0.11,
      C.lightIron,
    );
}
function residence(out, outline, grade, lod) {
  const l = outline[0][0];
  const r = outline[1][0] + 1.4;
  const a = outline[0][1];
  const b = outline[11][1];
  const ridgeZ = (a + b) / 2;
  const eave = 2.85;
  const apex = 4.53;
  const area = rect(l + 0.32, a + 0.93, r - 0.19, b - 0.94);
  mass(out, area, grade, eave, 'masonry', C.pale);
  metalRoof(
    out,
    [
      [l, eave, a],
      [r, eave, a],
      [r, eave, b],
      [l, eave, b],
    ],
    [
      [l + 2.55, apex, ridgeZ],
      [r - 0.61, apex, ridgeZ],
    ],
    lod,
  );
  const clad = rect(l + 0.36, b - 0.91, r - 0.24, b - 0.13);
  mass(out, clad, grade, eave - 0.03, 'timber', C.timber);
  const [rear, end, front, side] = walls(l + 0.32, a + 0.93, r - 0.19, b - 0.13);
  for (const u of [2.1, 5.85, 9.5, 14.6, 17.7]) {
    sash(out, front, u, 1.33, 2.37, 1.34, lod);
    if (u < 16.5) sash(out, rear, u, 1.05, 2.36, 1.12, lod);
  }
  sash(out, side, 2.22, 1.1, 2.4, 1.17, lod);
  door(out, end, 1.7, lod);
  if (lod > 1)
    for (const y of [0.34, 0.58, 0.82, 1.06])
      panel(out, 'timber', front, 0.03, front.length - 0.03, y, y + 0.028, 0.031, C.offwhite);
}
function court(out, outline, grade, lod) {
  const r = outline[6][0],
    far = outline[5][1],
    near = outline[6][1];
  const l = 0.37;
  const p = rect(l, far + 0.9, r - 1.95, near - 0.95);
  mass(out, p, grade, C.wall - 0.1, 'masonry', C.pale);
  const eave = 3.17;
  const ridgeZ = (far + near) / 2;
  metalRoof(
    out,
    [
      [l, eave, far],
      [r, eave, far],
      [r, eave, near],
      [l, eave, near],
    ],
    [
      [l + 1.44, 5.3, ridgeZ],
      [r - 2.95, 5.3, ridgeZ],
    ],
    lod,
  );
  const [rear, entrance, frontage] = walls(l, p[0][1], p[2][0], p[2][1]);
  door(out, entrance, entrance.length * 0.5, lod);
  for (const wall of [rear, frontage])
    for (const position of [0.31, 0.75])
      sash(out, wall, wall.length * position, 1.13, 2.66, 1.15, lod);
  mass(
    out,
    rect(7.67, far + 0.03, r, near - 0.04),
    (q) => grade(q) - 0.15,
    C.floor,
    'base',
    C.floorStone,
  );
  for (const z of [far + 0.14, -1.12, 1.42, near - 0.14]) {
    const width = lod === 0 ? 0.18 : 0.135;
    block(out, 'timber', r - 0.22, C.floor, z - width / 2, width, eave - C.floor, width, C.post);
  }
  for (const z of [far + 0.16, near - 0.17])
    block(out, 'timber', 8.05, C.floor, z - 0.07, 0.14, eave - C.floor, 0.14, C.post);
  if (lod > 1)
    for (const z of [far + 0.17, near - 0.17])
      beam(out, 'timber', [8.12, eave - 0.1, z], [r - 0.13, eave - 0.1, z], 0.125, 0.11, C.timber);
}
function draw(out, lod, { outline }, grade) {
  const foundation = rect(-21.5, -2.9, 9.9, 2.9);
  mass(out, foundation, (q) => Math.min(grade(q) - 0.19, 0.03), C.floor, 'base', C.floorStone);
  residence(out, outline, grade, lod);
  court(out, outline, grade, lod);
  transverse(out, outline, grade, lod);
  const chimney = [-2.49, 4.39, -0.82];
  block(out, 'masonry', ...chimney, 0.9, 2.13, 0.76, C.sandstone);
  if (lod > 0)
    block(out, 'masonry', chimney[0] - 0.12, 6.44, chimney[2] - 0.13, 1.14, 0.19, 1, C.offwhite);
  if (lod >= 2)
    for (const dx of [0.03, 0.47])
      block(
        out,
        'masonry',
        chimney[0] + dx,
        6.63,
        chimney[2] + 0.16,
        0.31,
        0.16,
        0.34,
        C.sandstone,
      );
  if (lod === 3) {
    const z = outline[9][1];
    block(out, 'base', 1.82, grade([2.23, z]) - 0.1, z - 0.26, 0.81, 0.22, 0.53, C.floorStone);
    for (const x of [-19.3, -8.1]) {
      block(out, 'iron', x, 1.32, -3.85, 0.035, 1.36, 0.036, C.dullIron);
    }
  }
}
const courthouse = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [32, 16, 28],
    lookAt: [-4, 2, 0],
    yaw: 0.64,
    sun: [260, 400, 350],
    brief:
      'Birdsville’s sandstone courthouse and attached residence, with corrugated roofs, the east hipped courtroom veranda and south gable.',
    views: [
      { name: 'adelaide-street-and-courthouse-gable', position: [4, 8, 27], lookAt: [-3, 2.5, 0] },
      { name: 'east-court-entry-and-veranda', position: [26, 6, 11], lookAt: [8, 2.4, 0] },
      { name: 'archival-rear-gable-and-residence', position: [2, 8, -27], lookAt: [-6, 2.6, 0] },
      {
        name: 'attached-residence-and-subordinate-roof',
        position: [-35, 12, -17],
        lookAt: [-8, 2.2, 0],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = courthouse;
export const model = {
  ...courthouse.model,
  category: 'civic',
  recipeDependencies: [...courthouse.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Original geometry based on OpenStreetMap, open Terrarium elevations, written heritage inspections, and an original public-domain State Library of Queensland photograph.',
};
