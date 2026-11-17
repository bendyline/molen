/** Main public building of the South Australian Museum on North Terrace. */
import {
  arch,
  areaSign,
  bands,
  block,
  cap,
  closed,
  edge,
  face,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_sandstone'),
  brick: surface('trim', 'brick_flemish'),
  base: surface('foundation', 'stone_sandstone_raw'),
  slate: surface('roof', 'slate'),
  glass: surface('window', 'window_grid', 0.49),
  frame: surface('door', 'metal_painted', 0.77),
};
const colors = palette({
  stone: 'd1b590',
  sandstone: 'c2a37d',
  pale: 'e4cdaa',
  base: 'a89a81',
  brick: '9a6050',
  brickTrim: 'ab775f',
  shadow: '593e37',
  slate: '6c757e',
  gray: '777f80',
  frame: '3b4140',
  lightFrame: '8d9796',
  greenGlass: '607874',
  darkGlass: '4d5959',
  oldGlass: '4b4f4d',
  brass: '766f5e',
});

function boundary(polygon, visit) {
  const sign = areaSign(polygon);
  for (const [index, [a, b]] of pairs(closed(polygon)).entries()) {
    visit(edge(a, b, sign), index);
  }
}

function hippedRoof(out, x0, x1, z0, z1, y, top, insetX, insetZ, color = colors.slate) {
  const base = rect(x0, z1, x1, z0);
  const ridge = rect(x0 + insetX, z1 - insetZ, x1 - insetX, z0 + insetZ);
  const sign = areaSign(base);
  pairs(closed(base)).forEach(([a, b], i) => {
    const c = ridge[(i + 1) % 4],
      d = ridge[i];
    face(
      out,
      'slate',
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [c[0], top, c[1]],
        [d[0], top, d[1]],
      ],
      edge(a, b, sign).normal,
      color,
    );
  });
  cap(out, 'slate', ridge, top, color);
}

function opening(
  out,
  wall,
  center,
  bottom,
  spring,
  width,
  rise,
  lod,
  brick = false,
  paired = false,
) {
  const trim = brick ? colors.brickTrim : colors.pale;
  arch(
    out,
    wall,
    center,
    bottom,
    spring,
    width,
    rise,
    0.046,
    lod === 1 ? 0 : lod,
    { width: brick ? 0.11 : 0.16, inner: colors.oldGlass, trim },
    { inner: 'glass', trim: brick ? 'brick' : 'stone' },
  );
  if (lod === 0) return;
  panel(
    out,
    brick ? 'brick' : 'stone',
    wall,
    center - width - 0.13,
    center + width + 0.13,
    bottom - 0.12,
    bottom,
    0.16,
    trim,
  );
  if (paired)
    panel(
      out,
      'stone',
      wall,
      center - 0.068,
      center + 0.068,
      bottom,
      spring + rise * 0.7,
      0.14,
      trim,
    );
  if (lod > 1) {
    const y = bottom + (spring - bottom) * 0.54;
    panel(out, 'frame', wall, center - width, center + width, y, y + 0.066, 0.1, colors.brass);
    if (!paired)
      panel(
        out,
        'frame',
        wall,
        center - 0.03,
        center + 0.03,
        bottom,
        spring + rise * 0.65,
        0.102,
        colors.frame,
      );
  }
}

function lantern(out, x0, x1, z0, z1, bottom, top, lod, color) {
  const polygon = rect(x0, z1, x1, z0);
  const trim = 0.17;
  shell(out, polygon, () => bottom, top, {
    wall: 'frame',
    color: colors.frame,
    roof: 'slate',
    roofColor: colors.gray,
  });
  boundary(polygon, (wall) => {
    panel(out, 'glass', wall, trim, wall.length - trim, bottom + trim, top - trim, 0.032, color);
    const bays = Math.max(1, Math.round(wall.length / (lod ? 2.25 : 5.5)));
    for (let i = 1; i < bays; i++) {
      const u = (wall.length * i) / bays;
      panel(
        out,
        'frame',
        wall,
        u - 0.045,
        u + 0.045,
        bottom + trim,
        top - trim,
        0.068,
        colors.lightFrame,
      );
    }
  });
  hippedRoof(out, x0 - 0.24, x1 + 0.24, z0 - 0.24, z1 + 0.24, top, top + 0.64, 0.53, 0.69);
}

function eastWall(out, wall, faceIndex, lod, floor, eave) {
  const court = faceIndex === 3;
  const street = faceIndex === 0;
  bands(
    out,
    wall,
    0,
    wall.length,
    [
      [floor - 0.27, floor],
      [floor + 4.65, floor + 4.82],
      [floor + 8.1, floor + 8.23],
      [floor + 11.5, floor + 11.65],
    ],
    'stone',
    colors.sandstone,
    0.1,
  );
  trimBlock(out, 'stone', wall, 0, wall.length, eave - 0.44, eave + 0.08, 0, 0.32, colors.pale);
  if (lod === 0) {
    const bays = street ? 3 : wall.length > 40 ? 6 : 2;
    for (let i = 0; i < bays; i++) {
      const x = (wall.length * (i + 0.5)) / bays;
      for (const y of [floor + 0.69, floor + 9.27])
        panel(out, 'glass', wall, x - 0.91, x + 0.91, y, y + 2.46, 0.048, colors.oldGlass);
    }
    return;
  }
  if (lod > 1) {
    const divisions = Math.ceil(wall.length / 1.03);
    for (let i = 0; i < divisions; i++) {
      const x = (wall.length * (i + 0.5)) / divisions;
      trimBlock(
        out,
        'stone',
        wall,
        x - 0.17,
        x + 0.17,
        eave - 0.63,
        eave - 0.44,
        0,
        0.21,
        colors.sandstone,
      );
    }
  }
  const bays = court ? 12 : street ? 3 : faceIndex === 1 ? 10 : 3;
  const spacing = wall.length / bays;
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * spacing;
    if (court && i === 6) continue;
    const paired = street || (court && i >= 9);
    const width = paired ? Math.min(1.18, spacing * 0.24) : 0.71;
    opening(
      out,
      wall,
      x,
      floor + 0.42,
      floor + 3.18,
      width,
      paired ? 0.91 : 0.68,
      lod,
      false,
      paired,
    );
    opening(
      out,
      wall,
      x,
      floor + (paired ? 6.18 : 9.38),
      floor + 11.12,
      width,
      paired ? 0.88 : 0.6,
      lod,
      false,
      paired,
    );
    if (!paired && lod > 1)
      panel(
        out,
        'glass',
        wall,
        x - 0.48,
        x + 0.48,
        floor + 6.36,
        floor + 8.02,
        0.05,
        colors.oldGlass,
      );
    if (lod > 1)
      panel(
        out,
        'glass',
        wall,
        x - 0.48,
        x + 0.48,
        floor - 1.6,
        floor - 0.45,
        0.069,
        colors.oldGlass,
      );
  }
}

function courtyardTower(out, x, z, floor, eave, lod) {
  const segments = 8;
  const towerPoints = (r) =>
    Array.from({ length: segments }, (_, i) => {
      const theta = ((i + 0.5) * 2 * Math.PI) / segments;
      return [x + r * Math.cos(theta), z + r * Math.sin(theta)];
    });
  const polygon = towerPoints(3.53);
  shell(out, polygon, () => floor - 3.5, floor, { wall: 'base', color: colors.base });
  shell(out, polygon, () => floor, eave + 0.65, { wall: 'stone', color: colors.stone });
  if (lod > 0) {
    ring(
      out,
      'stone',
      [x, z],
      [
        [floor + 4.66, 3.67],
        [floor + 4.87, 3.67],
      ],
      segments,
      colors.sandstone,
    );
    ring(
      out,
      'stone',
      [x, z],
      [
        [eave + 0.43, 3.62],
        [eave + 0.76, 3.83],
        [eave + 1.0, 3.02],
      ],
      segments,
      colors.pale,
    );
  }
  boundary(polygon, (wall, index) => {
    if (index < 1 || index > 5) return;
    if (lod === 0) return;
    opening(out, wall, wall.length / 2, floor + 0.64, floor + 3.32, 0.72, 0.67, lod);
    opening(out, wall, wall.length / 2, eave - 3.58, eave - 1.72, 0.56, 0.51, lod);
  });
  const drum = towerPoints(2.56);
  shell(out, drum, () => eave + 0.62, eave + 5.1, { wall: 'stone', color: colors.pale });
  boundary(drum, (wall) => {
    if (lod === 0) {
      panel(
        out,
        'glass',
        wall,
        0.5,
        wall.length - 0.5,
        eave + 1.62,
        eave + 4.02,
        0.05,
        colors.oldGlass,
      );
      return;
    }
    opening(out, wall, wall.length / 2, eave + 1.24, eave + 3.57, 0.61, 0.62, lod);
  });
  if (lod > 0)
    ring(
      out,
      'stone',
      [x, z],
      [
        [eave + 4.85, 2.53],
        [eave + 5.21, 2.87],
        [eave + 5.5, 2.69],
      ],
      segments,
      colors.sandstone,
    );
  const spire =
    lod === 0
      ? [
          [eave + 5.09, 2.67],
          [eave + 8.08, 1.13],
          [eave + 9.48, 0.12],
        ]
      : [
          [eave + 5.5, 2.75],
          [eave + 6.32, 2.19],
          [eave + 8.08, 1.13],
          [eave + 8.91, 0.52],
          [eave + 9.48, 0.12],
        ];
  ring(out, 'slate', [x, z], spire, segments, colors.slate);
  cap(out, 'slate', towerPoints(0.12), eave + 9.48, colors.slate);
  block(out, 'frame', x - 0.045, eave + 9.42, z - 0.045, 0.09, 0.83, 0.09, colors.brass);
}

function eastWing(out, plan, grade, lod) {
  const { polygon, west } = plan;
  const eave = 15.7;
  const floor = 2.7;
  shell(out, polygon, (p) => grade(p) - 0.55, floor, { wall: 'base', color: colors.base });
  shell(out, polygon, () => floor, eave, {
    wall: 'stone',
    color: colors.stone,
    roof: 'slate',
    roofColor: colors.slate,
  });
  boundary(polygon, (wall, side) => eastWall(out, wall, side, lod, floor, eave));
  const x0 = west - 0.3,
    x1 = polygon[1][0] + 0.29;
  const z0 = polygon[2][1],
    z1 = polygon[0][1];
  hippedRoof(out, x0, x1, z0 - 0.26, z0 + 16.9, eave, eave + 5.34, 5.44, 3.4);
  hippedRoof(out, x0, x1, z1 - 16.6, z1 + 0.27, eave, eave + 5.34, 5.44, 3.4);
  hippedRoof(out, x0, x1, z0 + 14.5, z1 - 14.6, eave, eave + 2.75, 5.25, 0.86);
  lantern(
    out,
    west + 5.1,
    x1 - 5.35,
    z0 + 16,
    z1 - 15.9,
    eave + 2.7,
    eave + 4.55,
    lod,
    colors.darkGlass,
  );
  courtyardTower(out, west - 0.35, 6.5, floor, eave, lod);
  const front = polygon[0][1];
  const stairX = west + 4.5;
  stairs(
    out,
    grade,
    'base',
    stairX - 1.55,
    stairX + 1.55,
    front + 2.7,
    front,
    floor - 0.17,
    lod === 0 ? 3 : 7,
    colors.base,
  );
  if (lod > 0) {
    for (const z of [z0 + 6.6, z1 - 6]) {
      const w = edge([west - 0.57, z - 1.52], [west - 0.57, z + 1.52], -1);
      block(out, 'stone', west - 0.57, eave + 0.02, z - 1.46, 3.72, 3.24, 2.92, colors.stone);
      opening(out, w, w.length / 2, eave + 0.38, eave + 2.04, 0.7, 0.74, lod, false, true);
      hippedRoof(
        out,
        west - 0.72,
        west + 3.33,
        z - 1.57,
        z + 1.57,
        eave + 3.22,
        eave + 4.28,
        0.82,
        0.81,
      );
    }
  }
}

function northWing(out, polygon, grade, lod) {
  const floor = 0.45,
    eave = 9.1;
  shell(out, polygon, (p) => grade(p) - 0.5, floor, { wall: 'base', color: colors.base });
  shell(out, polygon, () => floor, eave, {
    wall: 'brick',
    color: colors.brick,
    roof: 'slate',
    roofColor: colors.gray,
  });
  boundary(polygon, (wall) => {
    if (wall.length < 4) return;
    bands(
      out,
      wall,
      0,
      wall.length,
      [
        [floor, floor + 0.18],
        [4.95, 5.12],
        [8.63, 8.89],
      ],
      'brick',
      colors.brickTrim,
      0.12,
    );
    const n = Math.max(1, Math.round(wall.length / (lod === 0 ? 9 : 4.5)));
    for (let i = 0; i < n; i++) {
      const x = (wall.length * (i + 0.5)) / n;
      if (lod === 0) {
        panel(out, 'glass', wall, x - 0.5, x + 0.5, 6.0, 7.48, 0.047, colors.oldGlass);
        continue;
      }
      opening(out, wall, x, 6.03, 7.16, 0.53, 0.51, lod, true);
      if (lod > 0) opening(out, wall, x, 1.04, 3.12, 0.83, 0.7, lod, true, true);
    }
  });
  hippedRoof(out, -36, 18.5, -29.2, -8.72, eave, 12.35, 3.6, 4.96, colors.gray);
  lantern(out, -29.4, 12.2, -21.35, -11.92, 12.29, 14.28, lod, colors.gray);
}

function glazing(out, polygon, exposedEdges, top, grade, lod) {
  const floor = 0.3;
  const exposed = (i) => exposedEdges.includes(i);
  shell(out, polygon, (p) => grade(p) - 0.42, floor, { wall: 'base', color: colors.sandstone });
  shell(
    out,
    polygon,
    () => floor,
    top,
    {
      wall: 'frame',
      color: colors.frame,
      roof: 'slate',
      roofColor: colors.gray,
    },
    exposed,
  );
  boundary(polygon, (wall, i) => {
    const n = Math.max(1, Math.round(wall.length / (lod === 0 ? 5.3 : 2.4)));
    const bay = wall.length / n;
    if (!exposed(i) || wall.length < 0.62) return;
    for (let j = 0; j < n; j++) {
      const a = j * bay + 0.082,
        b = (j + 1) * bay - 0.082;
      const shade = j % 4 === 2 ? colors.darkGlass : colors.greenGlass;
      panel(out, 'glass', wall, a, b, floor + 0.18, top - 0.35, 0.057, shade);
      if (lod > 0) panel(out, 'frame', wall, a, b, 3.24, 3.33, 0.091, colors.frame);
      if (top > 6 && lod > 1) panel(out, 'frame', wall, a, b, 5.19, 5.3, 0.091, colors.frame);
    }
    trimBlock(out, 'frame', wall, 0, wall.length, top - 0.27, top + 0.11, 0, 0.23, colors.frame);
  });
}

function draw(out, lod, { footprint: p }, grade) {
  const west = p[0][0],
    rear = p[3][1] + ((p[2][1] - p[3][1]) * (west - p[3][0])) / (p[2][0] - p[3][0]);
  const junction = [west, rear];
  const splitZ = -8.9;
  const splitWest = [
    p[5][0] + ((p[6][0] - p[5][0]) * (splitZ - p[5][1])) / (p[6][1] - p[5][1]),
    splitZ,
  ];
  shell(out, p, (point) => grade(point) - 0.58, 0.38, { wall: 'base', color: colors.base });
  eastWing(out, { west, polygon: [p[0], p[1], p[2], junction] }, grade, lod);
  northWing(out, [junction, ...p.slice(3, 6), splitWest, [west, splitZ]], grade, lod);
  const glassWestJoint = [p[7][0], splitZ];
  const glassEastJoint = [p[13][0], splitZ];
  glazing(out, [p[6], p[7], glassWestJoint, splitWest], [0, 3], 5.3, grade, lod);
  glazing(
    out,
    [...p.slice(7, 14), glassEastJoint, glassWestJoint],
    [0, 1, 2, 3, 4, 5, 6, 8],
    5.73,
    grade,
    lod,
  );
  glazing(
    out,
    [...p.slice(13), [west, splitZ], glassEastJoint],
    [0, 1, 2, 3, 4, 7],
    7.94,
    grade,
    lod,
  );
  block(out, 'stone', -9, 0.37, p[8][1] - 0.07, 6.35, 1.36, 0.31, colors.sandstone);
  block(out, 'frame', 12.9, 3.55, p[17][1] - 0.29, 8.6, 0.27, 0.88, colors.frame);
}

const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-73, 45, 87],
    lookAt: [0, 8.5, 0],
    yaw: 0.72,
    sun: [-180, 410, 320],
    brief:
      'The linked main museum building with a Romanesque stone East Wing and slate tower, red-brick North Wing, and low black-framed public entrance.',
    views: [
      { name: 'north-terrace-entrance', position: [-26, 10, 47], lookAt: [-7, 6, 0] },
      { name: 'east-wing-courtyard-tower', position: [-12, 13, 30], lookAt: [23, 12, 10] },
      { name: 'north-wing-lantern', position: [-44, 26, -52], lookAt: [-10, 9, -11] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = museum;
export const model = { ...museum.model, category: 'museum' };
