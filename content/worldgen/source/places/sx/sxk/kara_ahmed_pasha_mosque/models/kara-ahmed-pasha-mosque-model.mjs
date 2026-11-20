import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  cap,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const ground = floorSampler(read('terrain-grid.json'));
const floor = d.courseFloor;
const colors = palette({
  limestone: 'c0b59f',
  carved: 'cfc3a9',
  sandstone: 'aea28c',
  foundation: '8f8878',
  lead: '646b6c',
  gray: '757a7a',
  darkLead: '565d60',
  glass: '445250',
  shadow: '53524a',
  red: '9b7059',
  plaster: 'cab99e',
  green: '697e51',
  ochre: 'bb9e59',
  bronze: '927955',
});
const surfaces = {
  masonry: surface('wall', 'stone_ashlar', 0.94),
  trim: surface('trim', 'stone_limestone', 0.88),
  paving: surface('foundation', 'stone_limestone_raw', 0.95),
  roofing: surface('roof', 'metal_painted', 0.83, 0.14),
  glass: surface('window', 'window_grid', 0.67),
  detail: surface('trim', 'metal_bronze_cast', 0.86, 0.18),
};
const hall = { x0: -14.47, x1: 11.93, z0: -10.917, z1: 5.744 };
const center = [-1.26, -2.8];
const side = (x, direction) => ({
  normal: [direction, 0, 0],
  p: (z, y, o = 0) => [x + direction * o, y, z],
});

function mass(out, points, y, top, slot = 'masonry', color = colors.limestone) {
  shell(out, points, typeof y === 'function' ? y : () => y, top, { wall: slot, color });
}

function dome(out, point, radius, start, top, lod, main = false) {
  const segments = main ? [10, 16, 24, 32][lod] : [4, 8, 10, 14][lod];
  const profile =
    lod === 0
      ? [
          [0, 1],
          [0.67, 0.74],
          [1, 0.025],
        ]
      : lod === 1
        ? [
            [0, 1],
            [0.42, 0.93],
            [0.75, 0.68],
            [0.94, 0.36],
            [1, 0.025],
          ]
        : [
            [0, 1],
            [0.18, 0.986],
            [0.38, 0.932],
            [0.57, 0.828],
            [0.73, 0.68],
            [0.85, 0.52],
            [0.95, 0.313],
            [1, 0.025],
          ];
  ring(
    out,
    'roofing',
    point,
    profile.map(([h, r]) => [mix(start, top, h), radius * r]),
    segments,
    main ? colors.lead : colors.gray,
  );
  if (lod < 2) return;
  const s = main ? 1 : 0.55;
  ring(
    out,
    'detail',
    point,
    [
      [top - 0.02, 0.108 * s],
      [top + 0.17 * s, 0.16 * s],
      [top + 0.24 * s, 0.083 * s],
      [top + 0.55 * s, 0.034 * s],
      [top + 0.67 * s, 0.015 * s],
    ],
    8,
    colors.bronze,
  );
}

function vault(out, [x, z], radius, at, peak, sign, lod) {
  const n = [4, 7, 10, 13][lod];
  const rs =
    lod < 2
      ? [
          [0, 1],
          [0.55, 0.85],
          [0.92, 0.42],
          [1, 0.018],
        ]
      : [
          [0, 1],
          [0.28, 0.96],
          [0.56, 0.85],
          [0.78, 0.637],
          [0.94, 0.34],
          [1, 0.018],
        ];
  const fn = (j, i) => {
    const [h, r] = rs[j],
      a = (i / n) * Math.PI;
    return [x + sign * radius * r * Math.sin(a), mix(at, peak, h), z + radius * r * Math.cos(a)];
  };
  for (let j = 0; j < rs.length - 1; j++)
    for (let i = 0; i < n; i++) {
      face(
        out,
        'roofing',
        [fn(j, i), fn(j, i + 1), fn(j + 1, i + 1), fn(j + 1, i)],
        up,
        colors.lead,
      );
    }
}

function archTop(span, spring, rise, count, pointed) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / count),
      x = (span / 2) * Math.cos(a);
    return [x, spring + rise * Math.sin(a) * (pointed ? 1 - (0.24 * Math.abs(x)) / (span / 2) : 1)];
  });
}

function window(out, w, x, width, base, header, lod, arched = true) {
  if (!arched) {
    opening(
      out,
      w,
      x - width / 2,
      x + width / 2,
      base,
      header,
      'trim',
      colors.glass,
      'glass',
      colors.carved,
      lod,
      0.05,
    );
    return;
  }
  const spring = header - width * 0.45;
  const shape = archTop(width, spring, header - spring, [4, 6, 8, 10][lod], true).map(([u, y]) => [
    u + x,
    y,
  ]);
  const outline = [[x - width / 2, base], ...shape, [x + width / 2, base]];
  face(
    out,
    'glass',
    outline.map(([u, y]) => w.p(u, y, 0.053)),
    w.normal,
    colors.glass,
  );
  if (lod > 1) {
    beamPath(
      out,
      'trim',
      shape.map(([u, y]) => w.p(u, y, 0.079)),
      0.096,
      0.095,
      colors.carved,
    );
    panel(out, 'trim', w, x - 0.026, x + 0.026, base, header - 0.045, 0.082, colors.sandstone);
  }
}

function hallWindows(out, lod) {
  const near = plane(hall.z1, 1),
    far = plane(hall.z0, -1);
  for (const w of [near, far]) {
    const front = w === near;
    for (const x of [-11.66, -7.5, -3.7, 1.14, 4.95, 9.12]) {
      if (!front || Math.abs(x - center[0]) > 3)
        window(out, w, x, 1.13, floor + 1.13, floor + 3.19, lod, false);
      if (lod > 0) window(out, w, x, 0.96, floor + 5.74, floor + 7.77, lod);
      if (lod > 1) window(out, w, x, 0.79, floor + 9.3, floor + 10.89, lod);
    }
  }
  for (const [x, s] of [
    [hall.x0, -1],
    [hall.x1, 1],
  ]) {
    const w = side(x, s);
    for (const z of [-8.7, -5.81, -0.2, 2.73]) {
      window(out, w, z, 1.2, floor + 1.18, floor + 3.25, lod, false);
      if (lod > 0) window(out, w, z, 1.0, floor + 5.82, floor + 7.84, lod);
    }
  }
  panel(out, 'trim', near, -2.64, 0.16, floor + 0.03, floor + 5.16, 0.07, colors.carved);
  panel(out, 'glass', near, -2.25, -0.21, floor + 0.03, floor + 4.42, 0.102, colors.shadow);
  if (lod < 2) return;
  for (const x of [-7.55, 4.91]) {
    const arabesque = archTop(2.15, floor + 4.12, 0.59, 12, true);
    for (const [[a, y], [b, h]] of pairs(arabesque)) {
      face(
        out,
        'trim',
        [
          [a + x, y],
          [b + x, h],
          [b + x, h - 0.22],
          [a + x, y - 0.22],
        ].map(([u, k]) => near.p(u, k, 0.102)),
        near.normal,
        Math.abs(a) < 0.59 ? colors.ochre : colors.green,
      );
    }
  }
}

function prayerHall(out, lod) {
  const footprint = rect(hall.x0, hall.z1, hall.x1, hall.z0);
  mass(
    out,
    footprint,
    (p) => Math.min(floor - 0.35, ground(p) - 0.58),
    floor,
    'paving',
    colors.foundation,
  );
  mass(out, footprint, floor, d.hallEave);
  mass(
    out,
    rect(hall.x0 - 0.13, hall.z1 + 0.11, hall.x1 + 0.13, hall.z0 - 0.13),
    d.hallEave - 0.42,
    d.hallEave,
    'trim',
    colors.carved,
  );
  for (const [x, z] of [
    [hall.x0 + 0.55, -2.63],
    [hall.x1 - 1.92, -2.63],
  ]) {
    block(
      out,
      'masonry',
      x,
      floor,
      z - 0.68,
      1.48,
      d.hallEave - floor + 0.62,
      1.42,
      colors.sandstone,
    );
    block(out, 'trim', x - 0.11, d.hallEave + 0.5, z - 0.77, 1.7, 0.19, 1.61, colors.carved);
  }
  for (const [x, s] of [
    [-5.35, -1],
    [2.8, 1],
  ])
    for (const z of [-6.22, 0.87])
      vault(out, [x, z], 3.66, d.hallEave - 0.31, d.domeSpring + 0.63, s, lod);
  const spring = d.domeSpring;
  const segments = [10, 16, 24, 32][lod];
  ring(
    out,
    'masonry',
    center,
    [
      [d.drumBase - 0.15, 6.37],
      [spring - 0.34, 6.36],
      [spring, 6.61],
    ],
    segments,
    colors.limestone,
  );
  dome(out, center, 6.62, spring, d.domeApex, lod, true);
  if (lod > 0) {
    const n = lod === 1 ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / n,
        c = Math.cos(a),
        s = Math.sin(a);
      const w = {
        normal: [c, 0, s],
        p: (u, h, o = 0) => [
          center[0] + (6.39 + o) * c - u * s,
          h,
          center[1] + (6.39 + o) * s + u * c,
        ],
      };
      window(out, w, 0, 0.55, spring - 1.77, spring - 0.34, lod);
    }
  }
  if (lod > 0) hallWindows(out, lod);
}

function arcadeBay(out, w, a, b, base, spring, rise, top, lod) {
  const mid = (a + b) / 2,
    half = (b - a) * 0.46,
    pts = archTop(2 * half, spring, rise, [4, 6, 8, 10][lod], false);
  for (const [[x, y], [x1, y1]] of pairs(pts)) {
    face(
      out,
      'masonry',
      [
        [x + mid, y],
        [x1 + mid, y1],
        [x1 + mid, top],
        [x + mid, top],
      ].map(([u, h]) => w.p(u, h)),
      w.normal,
      colors.plaster,
    );
  }
  for (const x of [a, b])
    panel(out, 'masonry', w, x - 0.19, x + 0.19, base, spring + 0.06, 0, colors.limestone);
  if (lod > 1)
    beamPath(
      out,
      'trim',
      pts.map(([x, y]) => w.p(mid + x, y, 0.06)),
      0.13,
      0.12,
      colors.carved,
    );
}

function portico(out, lod) {
  const front = plane(14.83, 1),
    a = -14.59,
    b = 12.13,
    base = floor + 0.12;
  const farRoof = rect(-16.96, 14.86, 14.41, 5.77);
  mass(out, farRoof, floor - 0.14, base, 'paving', colors.foundation);
  stairs(
    out,
    ground,
    'paving',
    -3.4,
    0.97,
    16.01,
    14.79,
    base,
    lod === 0 ? 2 : 4,
    colors.foundation,
  );
  const columns = Array.from({ length: 6 }, (_, i) => mix(a, b, i / 5));
  for (const [x, i] of columns.map((x, i) => [x, i])) {
    ring(
      out,
      'trim',
      [x, 14.38],
      lod === 0
        ? [
            [base, 0.24],
            [7.93, 0.24],
          ]
        : [
            [base, 0.39],
            [base + 0.2, 0.33],
            [5.22, 0.24],
            [5.49, 0.36],
            [5.72, 0.48],
          ],
      lod === 0 ? 5 : lod === 1 ? 8 : 12,
      i === 0 || i === 5 ? colors.limestone : colors.red,
    );
  }
  for (const [l, r] of pairs(columns)) {
    if (lod > 0) arcadeBay(out, front, l, r, base, 5.59, 1.71, 8.18, lod);
    if (lod > 0) arcadeBay(out, plane(14.49, -1), l, r, base, 5.59, 1.71, 8.18, lod === 1 ? 0 : 1);
    dome(out, [(l + r) * 0.5, 10.1], 2.58, 8.2, 10.4, lod);
  }
  mass(out, farRoof, 7.91, 8.17, 'trim', colors.carved);
  for (const [x0, x1] of [
    [-17.25, -14.5],
    [12.13, 14.64],
  ]) {
    const f = rect(x0, 14.83, x1, 5.74);
    mass(out, f, 7.32, 7.93, 'masonry', colors.sandstone);
    block(out, 'trim', x0, base, 14.33, 0.44, 7.3 - base, 0.5, colors.carved);
    block(out, 'trim', x1 - 0.45, base, 14.33, 0.45, 7.3 - base, 0.5, colors.carved);
  }
}

function lowWing(out, outline, front, length, axis, lod) {
  const base = front.normal[2] ? floor + Math.max(0.0, ground([center[0], 42]) * 0.38) : floor;
  const xSpan = outline.map(([x]) => x),
    zSpan = outline.map(([, z]) => z);
  const [left, right] = [Math.min(...xSpan), Math.max(...xSpan)],
    [rear, fore] = [Math.min(...zSpan), Math.max(...zSpan)];
  const eave = base + 4.94;
  const rooms =
    axis === 'x'
      ? rect(left, fore, right, Math.min(fore - 0.01, rear + 1.37))
      : front.normal[0] > 0
        ? rect(left, fore, right - 1.72, rear)
        : rect(left + 1.72, fore, right, rear);
  mass(
    out,
    rooms,
    (p) => Math.min(base - 0.2, ground(p) - 0.29),
    eave,
    'masonry',
    colors.sandstone,
  );
  mass(
    out,
    outline,
    (p) => Math.min(base - 0.18, ground(p) - 0.31),
    base,
    'paving',
    colors.foundation,
  );
  const [a, b, c, d] = outline.map((p) => at(p, eave));
  const ridge =
    axis === 'x'
      ? [
          [left, eave + 0.9, (rear + fore) / 2],
          [right, eave + 0.9, (rear + fore) / 2],
        ]
      : [
          [(left + right) / 2, eave + 0.9, fore],
          [(left + right) / 2, eave + 0.9, rear],
        ];
  const [p, q] = ridge;
  for (const poly of axis === 'x'
    ? [
        [a, b, q, p],
        [d, p, q, c],
      ]
    : [
        [a, p, q, d],
        [b, c, q, p],
      ])
    face(out, 'roofing', poly, up, colors.lead);
  for (const [i, poly] of (axis === 'x'
    ? [
        [d, a, p],
        [b, c, q],
      ]
    : [
        [a, b, p],
        [c, d, q],
      ]
  ).entries())
    face(
      out,
      'masonry',
      poly,
      axis === 'x' ? [2 * i - 1, 0, 0] : [0, 0, 1 - 2 * i],
      colors.sandstone,
    );
  if (lod === 0) return;
  const start = axis === 'x' ? left : rear;
  const desired = axis === 'x' ? 7 : 9;
  for (let i = 0; i < desired; i++) {
    const from = start + (i * length) / desired,
      to = start + ((i + 1) * length) / desired;
    arcadeBay(out, front, from, to, base, base + 2.52, 1.07, eave + 0.015, Math.min(lod, 2));
    if (lod > 0) {
      const [x, , z] = front.p((from + to) * 0.5, base, 0.05);
      const w =
        axis === 'x' ? plane(z + 1.29, -1) : side(x - front.normal[0] * 1.58, front.normal[0]);
      window(out, w, (from + to) * 0.5, 0.58, base + 0.67, base + 2.04, lod, false);
    }
  }
}

function courtyard(out, lod) {
  const y = floor;
  cap(out, 'paving', d.court, y - 0.005, colors.sandstone);
  lowWing(out, rect(-23.65, 41.91, -17.21, 14.83), side(-17.2, 1), 27.08, 'z', lod);
  lowWing(out, rect(14.594, 41.91, 21.066, 14.83), side(14.59, -1), 27.08, 'z', lod);
  lowWing(out, rect(-28.61, 52.75, 25.96, 41.34), plane(41.35, -1), 54.57, 'x', lod);
  for (const [a, b] of [
    [-28.61, -23.62],
    [21.04, 25.96],
  ]) {
    mass(
      out,
      rect(a, 52.7, b, 32.37),
      (p) => Math.min(y - 0.24, ground(p) - 0.48),
      y + 4.83,
      'masonry',
      colors.sandstone,
    );
    mass(
      out,
      rect(a - 0.09, 52.81, b + 0.09, 32.25),
      y + 4.7,
      y + 4.94,
      'roofing',
      colors.darkLead,
    );
  }
  for (const [a, b] of [
    [-23.65, -17.19],
    [14.57, 21.067],
  ]) {
    mass(
      out,
      rect(a, 14.84, b, 5.79),
      (p) => Math.min(y - 0.2, ground(p) - 0.3),
      y + 4.7,
      'masonry',
      colors.limestone,
    );
    mass(out, rect(a - 0.09, 14.93, b + 0.09, 5.7), y + 4.57, y + 4.88, 'roofing', colors.gray);
  }
  const classroom = rect(-5.922, 54.91, 3.24, 43.19);
  mass(out, classroom, y - 0.41, y + 6.9);
  ring(
    out,
    'masonry',
    [-1.34, 49],
    [
      [y + 6.7, 3.47],
      [y + 7.3, 3.55],
    ],
    lod === 0 ? 6 : 12,
    colors.limestone,
  );
  dome(out, [-1.34, 49], 3.55, y + 7.3, y + 9.46, lod);
}

function fountain(out, lod) {
  const center = [0.45, 26.4];
  const y = floor;
  if (lod === 0) {
    ring(
      out,
      'paving',
      center,
      [
        [y - 0.03, 2.64],
        [y + 0.24, 2.64],
        [y + 1.36, 2.1],
      ],
      6,
      colors.carved,
    );
    ring(
      out,
      'roofing',
      center,
      [
        [y + 3.2, 2.58],
        [y + 3.83, 2.15],
        [y + 4.5, 0.04],
      ],
      6,
      colors.darkLead,
    );
    for (const [x, z] of [
      [-1.5, 25.6],
      [-1.5, 27.8],
      [2.3, 25.6],
      [2.3, 27.8],
    ])
      block(out, 'trim', x - 0.064, y + 0.24, z - 0.064, 0.128, 3.08, 0.128, colors.sandstone);
    return;
  }
  ring(
    out,
    'paving',
    center,
    [
      [y - 0.03, 2.69],
      [y + 0.24, 2.64],
      [y + 0.44, 2.04],
      [y + 1.28, 2.04],
      [y + 1.38, 2.17],
    ],
    9,
    colors.carved,
  );
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      x = center[0] + Math.cos(a) * 2.22,
      z = center[1] + Math.sin(a) * 2.22;
    ring(
      out,
      'trim',
      [x, z],
      [
        [y + 0.24, 0.095],
        [y + 3.24, 0.095],
      ],
      lod === 0 ? 4 : 6,
      colors.sandstone,
    );
  }
  ring(
    out,
    'roofing',
    center,
    [
      [y + 3.2, 2.58],
      [y + 3.38, 2.57],
      [y + 3.78, 2.26],
      [y + 4.02, 1.7],
      [y + 4.5, 0.03],
    ],
    9,
    colors.darkLead,
  );
  if (lod > 1)
    ring(
      out,
      'detail',
      center,
      [
        [y + 4.42, 0.07],
        [y + 4.68, 0.069],
        [y + 4.79, 0.012],
      ],
      8,
      colors.bronze,
    );
}

function minaret(out, lod) {
  const p = [10.96, 5.09],
    low = Math.min(floor - 0.34, ground(p) - 0.3);
  const n = [5, 8, 12, 16][lod];
  block(out, 'masonry', p[0] - 1.05, low, p[1] - 0.92, 2.1, 7.72 - low, 1.84, colors.limestone);
  ring(
    out,
    'masonry',
    p,
    [
      [7.65, 1.11],
      [8.06, 1.11],
      [9.68, 0.72],
      [22.06, 0.62],
    ],
    n,
    colors.limestone,
  );
  ring(
    out,
    'trim',
    p,
    [
      [21.93, 0.65],
      [22.2, 0.71],
      [22.43, 0.88],
      [22.68, 1.02],
      [22.94, 1.21],
      [23.25, 1.25],
      [23.38, 1.32],
    ],
    n,
    colors.carved,
  );
  ring(
    out,
    'masonry',
    p,
    [
      [23.29, 0.53],
      [28.01, 0.48],
    ],
    n,
    colors.limestone,
  );
  ring(
    out,
    'roofing',
    p,
    [
      [27.99, 0.55],
      [28.18, 0.58],
      [d.minaretHeight - 0.24, 0.054],
      [d.minaretHeight, 0.017],
    ],
    n,
    colors.darkLead,
  );
  if (lod < 2) return;
  ring(
    out,
    'detail',
    p,
    [
      [d.minaretHeight - 0.05, 0.045],
      [d.minaretHeight + 0.17, 0.099],
      [d.minaretHeight + 0.4, 0.055],
      [d.minaretHeight + 0.57, 0.014],
    ],
    8,
    colors.bronze,
  );
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / n;
    const c = Math.cos(a),
      s = Math.sin(a),
      w = {
        normal: [c, 0, s],
        p: (u, h, o = 0) => [p[0] + (1.284 + o) * c - u * s, h, p[1] + (1.284 + o) * s + u * c],
      };
    panel(out, 'trim', w, -0.103, 0.103, 23.08, 23.3, 0.006, colors.sandstone);
  }
}

function build(out, lod) {
  prayerHall(out, lod);
  portico(out, lod);
  courtyard(out, lod);
  fountain(out, lod);
  minaret(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kara-ahmed-pasha-mosque-model.mjs',
  camera = [48, 27, 76],
  lookAt = [-1.3, 8.1, 15.4];
export const karaAhmedModel = {
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
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The named native outlines and measured section establish placement and orientation. Independent ground samples are carried through the stepped platform.',
  brief:
    'Ottoman cut-stone mosque and open madrasa court in Topkapı, with a lead-covered dome, single-balcony minaret, five small porch domes and roofed fountain.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-39, 54, 62],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The named mosque and madrasa enclosure polygon identifies the existing building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'court-fountain-and-five-domed-portico',
      position: [29, 12, 46],
      lookAt: [-0.7, 7.7, 8.4],
    },
    { name: 'dome-drum-and-minaret', position: [48, 22, -31], lookAt: [2, 11, 0] },
    { name: 'mosque-and-open-arcade-plan', position: [-45, 43, 66], lookAt: [-1, 7, 19] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kara-ahmed-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.47, surfaces },
      street: { export: 'street', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
};
