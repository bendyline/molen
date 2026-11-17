/** Victoria High School at 1260 Grant Street, Victoria, British Columbia. */
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  trim: surface('trim', 'clay_fired'),
  granite: surface('foundation', 'stone_granite'),
  roof: surface('roof', 'slate'),
  glass: surface('window', 'window_grid', 0.62),
  wood: surface('door', 'wood_plain'),
};
const colors = palette({
  brick: 'a57961',
  soldier: '8b5d4b',
  later: 'ad8c77',
  pale: 'dfcbb1',
  band: 'cbb397',
  foundation: '979488',
  roof: '726f67',
  ledge: 'c4b9a8',
  panes: '5f7473',
  dark: '63534b',
  wood: '735748',
  modern: 'b5a898',
});

function sideOf(polygon, limit, south) {
  const inside = ([, z]) => (south ? z >= limit : z <= limit);
  const clipped = [];
  for (const [a, b] of pairs(closed(polygon))) {
    if (inside(a)) clipped.push(a);
    if (inside(a) !== inside(b)) {
      const t = (limit - a[1]) / (b[1] - a[1]);
      clipped.push([a[0] + (b[0] - a[0]) * t, limit]);
    }
  }
  return clipped;
}

function window(out, wall, center, width, bottom, top, lod) {
  const a = center - width / 2,
    b = center + width / 2;
  panel(out, 'wood', wall, a, b, bottom, top, 0.029, colors.dark);
  panel(out, 'glass', wall, a + 0.09, b - 0.09, bottom + 0.11, top - 0.1, 0.046, colors.panes);
  if (lod === 0) return;
  panel(out, 'trim', wall, a - 0.1, b + 0.1, bottom - 0.12, bottom, 0.093, colors.pale);
  if (lod < 2) return;
  for (const u of [center - width / 6, center + width / 6])
    panel(out, 'wood', wall, u - 0.027, u + 0.027, bottom, top, 0.068, colors.ledge);
  const sash = bottom + (top - bottom) * 0.54;
  panel(out, 'wood', wall, a, b, sash, sash + 0.06, 0.069, colors.ledge);
  if (lod === 3) panel(out, 'wood', wall, a, b, top - 0.37, top - 0.32, 0.069, colors.ledge);
}

function band(out, wall, low, high, offset, color = colors.band) {
  panel(out, 'trim', wall, 0, wall.length, low, high, offset, color);
}

function pilaster(out, wall, center, base, top) {
  panel(out, 'trim', wall, center - 0.23, center + 0.23, base, top, 0.1, colors.band);
  for (const y of [base, top - 0.18])
    panel(out, 'trim', wall, center - 0.34, center + 0.34, y, y + 0.19, 0.14, colors.pale);
}

function facade(out, wall, y0, top, kind, lod) {
  const grand = kind === 'front';
  const historic = kind !== 'later';
  if (lod === 0) {
    if (wall.length > 3.2) {
      const rows = historic ? [y0 + 0.93, y0 + 4.86, y0 + 8.79] : [y0 + 0.86, y0 + 4.08];
      for (const bottom of rows.filter((y) => y + 1.76 < top - 0.26))
        panel(
          out,
          'glass',
          wall,
          0.65,
          wall.length - 0.65,
          bottom,
          bottom + 1.76,
          0.045,
          colors.panes,
        );
    }
    if (historic) band(out, wall, top - 0.37, top + 0.045, 0.27, colors.pale);
    return;
  }
  const nominalSpacing = grand ? 4.73 : historic ? 3.7 : 4.85;
  const count = Math.max(1, Math.round(wall.length / nominalSpacing));
  const spacing = wall.length / count;
  if (wall.length > 2.55) {
    for (let i = 0; i < count; i++) {
      const center = spacing * (i + 0.5);
      const bottomRow = historic ? 0.7 : y0 + 0.6;
      const rows = historic
        ? [
            [bottomRow, 2.46],
            [y0 + 0.84, y0 + 3.24],
            [y0 + 4.78, y0 + 7.06],
            [y0 + 8.78, y0 + 11.02],
          ].filter(([, b]) => b < top - 0.45)
        : [
            [y0 + 0.73, y0 + 2.37],
            [y0 + 4.04, y0 + 6.18],
          ].filter(([, b]) => b < top - 0.42);
      for (const [a, b] of rows) {
        if (grand && lod > 0 && a >= y0 && spacing > 3) {
          for (const o of [-spacing * 0.16, spacing * 0.16])
            window(out, wall, center + o, spacing * 0.28, a, b, lod);
        } else {
          window(out, wall, center, Math.min(spacing * 0.69, grand ? 3 : 2.54), a, b, lod);
        }
      }
      if (grand && lod > 0 && i > 0) pilaster(out, wall, i * spacing, y0 + 4.3, top - 0.82);
    }
  }
  if (historic) {
    band(out, wall, y0 - 0.28, y0 - 0.05, 0.089);
    band(out, wall, y0 + 3.66, y0 + 3.96, 0.15);
    if (lod > 0) band(out, wall, top - 0.8, top - 0.56, 0.14);
    band(out, wall, top - 0.37, top + 0.045, 0.27, colors.pale);
  } else if (lod > 0) band(out, wall, top - 0.26, top, 0.087, colors.ledge);
}

function column(out, x, z, low, high, lod) {
  const sides = [5, 10, 14, 18][lod];
  block(out, 'trim', x - 0.66, low - 0.14, z - 0.65, 1.32, 0.19, 1.3, colors.pale);
  ring(
    out,
    'trim',
    [x, z],
    lod === 0
      ? [
          [low, 0.55],
          [high - 0.22, 0.43],
        ]
      : [
          [low, 0.6],
          [low + 0.29, 0.55],
          [low + 0.52, 0.5],
          [high - 0.42, 0.42],
          [high - 0.22, 0.52],
        ],
    sides,
    colors.pale,
  );
  block(out, 'trim', x - 0.74, high - 0.24, z - 0.57, 1.48, 0.24, 1.14, colors.band);
  if (lod < 2) return;
  for (const sign of [-1, 1])
    ring(
      out,
      'trim',
      [x + sign * 0.52, z],
      [
        [high - 0.43, 0.2],
        [high - 0.3, 0.22],
        [high - 0.23, 0.175],
      ],
      sides,
      colors.pale,
    );
}

function frontispiece(out, x, z, width, y, rise, lod) {
  const [left, right] = [x - width / 2, x + width / 2];
  for (const zz of [z, z - 0.63]) {
    face(
      out,
      'trim',
      [
        [left, y, zz],
        [right, y, zz],
        [x + width * 0.33, y + rise, zz],
        [x - width * 0.33, y + rise, zz],
      ],
      [0, 0, zz === z ? 1 : -1],
      colors.band,
    );
  }
  block(out, 'trim', left - 0.11, y - 0.13, z - 0.67, width + 0.22, 0.23, 0.7, colors.pale);
  block(
    out,
    'trim',
    x - width * 0.34,
    y + rise - 0.1,
    z - 0.66,
    width * 0.68,
    0.15,
    0.7,
    colors.pale,
  );
  if (lod > 0)
    panel(
      out,
      'trim',
      plane(z, 1),
      x - 1.08,
      x + 1.08,
      y + 0.1,
      y + rise - 0.05,
      0.04,
      colors.pale,
    );
}

function entrance(out, plan, grade, lod) {
  const x = -0.71,
    z = 49.65;
  const { floor, mainEave } = plan;
  const front = plane(z, 1),
    base = floor + 4.32;
  panel(out, 'wood', front, x - 1.62, x + 1.62, floor, floor + 3.04, 0.08, colors.dark);
  panel(out, 'glass', front, x - 1.47, x + 1.47, floor + 2.09, floor + 2.86, 0.12, colors.panes);
  panel(out, 'trim', front, x - 2.23, x + 2.23, floor + 3.0, floor + 3.32, 0.2, colors.pale);
  for (const sign of [-1, 1]) {
    const edgeX = x + sign * 1.9;
    panel(out, 'trim', front, edgeX - 0.25, edgeX + 0.25, floor, floor + 3.18, 0.2, colors.pale);
  }
  for (const u of [x - 4.38, x, x + 4.38])
    for (const y of [floor + 4.73, floor + 8.63]) window(out, front, u, 2.67, y, y + 2.15, lod);
  const entablature = mainEave - 0.68;
  for (const u of [-6.42, -2.18, 2.18, 6.42]) column(out, x + u, z + 0.9, base, entablature, lod);
  block(out, 'trim', x - 7.7, base - 0.34, z - 0.01, 15.4, 0.38, 1.5, colors.band);
  block(out, 'trim', x - 8.06, entablature, z - 0.08, 16.12, 0.91, 1.7, colors.pale);
  frontispiece(out, x, z + 0.9, 15.9, mainEave + 0.11, 1.25, lod);
  for (const u of [-30.42, 28.92]) frontispiece(out, u, 48.75, 11.56, mainEave, 0.91, lod);
  block(out, 'granite', x - 4.28, floor - 0.42, z - 0.05, 8.56, 0.42, 1.05, colors.ledge);
  stairs(
    out,
    grade,
    'granite',
    x - 4.25,
    x + 4.25,
    z + 5.2,
    z + 0.99,
    floor,
    lod === 0 ? 4 : 11,
    colors.ledge,
  );
}

function hip(out, x0, z0, x1, z1, y, top, riseAlongX) {
  const a = rect(x0, z0, x1, z1);
  const dx = (x1 - x0) * (riseAlongX ? 0.1 : 0.32),
    dz = (z1 - z0) * (riseAlongX ? 0.33 : 0.14);
  const b = rect(x0 + dx, z0 + dz, x1 - dx, z1 - dz);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'roof',
      [
        [a[i][0], y, a[i][1]],
        [a[j][0], y, a[j][1]],
        [b[j][0], top, b[j][1]],
        [b[i][0], top, b[i][1]],
      ],
      [0, 1, 0],
      colors.roof,
    );
  }
  cap(out, 'roof', b, top, colors.roof);
}

function draw(out, lod, plan, grade) {
  const { footprint, floor, mainEave, middleEave, northEave } = plan;
  const middleCut = 7.28,
    northCut = -17.28;
  const centre = sideOf(sideOf(footprint, middleCut, false), northCut, true);
  const volumes = [
    {
      outline: sideOf(footprint, middleCut, true),
      eave: mainEave,
      brick: colors.brick,
      kind: 'historic',
    },
    { outline: centre, eave: middleEave, brick: colors.later, kind: 'historic' },
    {
      outline: sideOf(footprint, northCut, false),
      eave: northEave,
      brick: colors.modern,
      kind: 'later',
    },
  ];
  shell(out, footprint, (p) => grade(p) - 0.37, floor, {
    wall: 'granite',
    color: colors.foundation,
  });
  for (const volume of volumes) {
    shell(out, volume.outline, () => floor, volume.eave, {
      wall: 'brick',
      roof: 'roof',
      color: volume.brick,
      roofColor: colors.roof,
    });
    for (const [a, b] of pairs(closed(volume.outline))) {
      if (a[1] === b[1] && (a[1] === middleCut || a[1] === northCut)) continue;
      const wall = edge(a, b, areaSign(volume.outline));
      const z = (a[1] + b[1]) / 2,
        x = (a[0] + b[0]) / 2;
      if (z > 49 && Math.abs(x) < 9) continue;
      const kind = z > 45 ? 'front' : volume.kind;
      facade(out, wall, floor, volume.eave, kind, lod);
    }
  }
  hip(out, -34.8, 22, 33.4, 47.6, mainEave - 0.02, mainEave + 1.48, true);
  hip(out, -33.8, 8.1, -19.4, 24.9, mainEave - 0.04, mainEave + 1.12, false);
  hip(out, 18.5, 8.2, 29.3, 24.6, mainEave - 0.04, mainEave + 1.12, false);
  for (const [x, z, y] of [
    [-25, 36, mainEave + 0.85],
    [-12, 29, mainEave + 0.95],
    [12, 31, mainEave + 0.95],
    [25, 33, mainEave + 0.88],
  ]) {
    block(out, 'brick', x - 1.09, y - 0.56, z - 0.77, 2.18, 1.89, 1.54, colors.soldier);
    block(out, 'roof', x - 1.24, y + 1.26, z - 0.92, 2.48, 0.17, 1.84, colors.roof);
  }
  for (const [x, z, w, d, y] of [
    [-20, -9.7, 5.6, 6.4, middleEave + 1.3],
    [26.1, -13.8, 6.2, 7.2, middleEave + 1.6],
  ]) {
    block(out, 'brick', x - w / 2, northEave, z - d / 2, w, y - northEave, d, colors.later);
    block(
      out,
      'roof',
      x - w / 2 - 0.08,
      y,
      z - d / 2 - 0.08,
      w + 0.16,
      0.22,
      d + 0.16,
      colors.roof,
    );
  }
  entrance(out, plan, grade, lod);
}

const school = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [82, 44, 123],
    lookAt: [0, 11, 9],
    yaw: -0.59,
    sun: [240, 480, 380],
    brief:
      'The Edwardian school with brick and pale terracotta façades, an Ionic Grant Street frontage, and lower modern additions at the rear.',
    views: [
      { name: 'grant-street-portico', position: [13, 9.4, 79], lookAt: [0, 11.5, 48] },
      { name: 'terracotta-end-pavilion', position: [59, 17, 71], lookAt: [26, 11.5, 43] },
      { name: 'rear-classrooms-and-circulation', position: [58, 36, -77], lookAt: [2, 8, -14] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = school;
export const model = { ...school.model, category: 'school' };
