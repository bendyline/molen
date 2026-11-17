import {
  arch,
  at,
  block,
  cap,
  closed,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  plane,
  rect,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.94),
  cap: surface('trim', 'brick_stack', 0.91),
  stone: surface('foundation', 'stone_granite', 0.96),
  interior: surface('wall', 'concrete_plain', 0.99),
};
const colors = palette({ brick: '986256', cap: 'aa7561', bed: '898378', interior: '403532' });
const normals = [
  [0, 0, -1],
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
];

function square(width) {
  const half = width / 2;
  return rect(-half, -half, half, half);
}

function taper(out, low, high, slot, color) {
  for (const [i, [p, q]] of pairs(closed(low)).entries()) {
    const j = (i + 1) % low.length;
    face(out, slot, [p, q, high[j], high[i]], normals[i], color);
  }
}

function chimney(out, lod, { height, baseWidth, topWidth, floor }, grade) {
  const levels = [
    [0, baseWidth],
    [0.37, baseWidth],
    [0.38, baseWidth - 0.22],
    [1.22, baseWidth - 0.22],
    [1.24, baseWidth - 0.52],
    [3.2, baseWidth - 0.52],
    [3.23, baseWidth - 0.69],
    [height - 0.61, topWidth - 0.22],
    [height - 0.48, topWidth + 0.04],
    [height - 0.22, topWidth + 0.04],
    [height - 0.2, topWidth + 0.24],
    [height, topWidth + 0.24],
  ];
  const working = lod === 0 ? levels.filter((_, i) => ![2, 3, 7, 9].includes(i)) : levels;
  const pad = square(baseWidth + 0.3);
  taper(
    out,
    pad.map((point) => at(point, Math.min(grade(point) - 0.22, floor - 0.44))),
    pad.map((point) => at(point, floor)),
    'stone',
    colors.bed,
  );
  cap(out, 'stone', pad, floor, colors.bed);
  const sections = working.map(([y, w]) => square(w).map((p) => at(p, floor + y)));
  for (const [i, [a, b]] of pairs(sections).entries()) {
    const edge = i === 0 || i >= sections.length - 4;
    taper(out, a, b, edge ? 'cap' : 'brick', edge ? colors.cap : colors.brick);
  }
  const exterior = square(topWidth + 0.24).map((pt) => at(pt, floor + height));
  const interiorOutline = square(0.99);
  const interior = interiorOutline.map((pt) => at(pt, floor + height));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'cap', [exterior[i], exterior[j], interior[j], interior[i]], [0, 1, 0], colors.cap);
  }
  const recess = floor + height - 0.64;
  taper(
    out,
    interior,
    interiorOutline.map((p) => at(p, recess)),
    'interior',
    colors.interior,
  );
  cap(out, 'interior', interiorOutline, recess, colors.interior);
  const vent = plane(-(baseWidth - 0.22) / 2, -1);
  arch(
    out,
    vent,
    0,
    floor + 0.43,
    floor + 1.04,
    0.43,
    0.36,
    0.036,
    lod,
    { inner: colors.interior, trim: colors.cap, width: 0.095 },
    { inner: 'interior', trim: 'cap' },
  );
  if (lod > 1) {
    for (const y of [floor + 0.23, floor + 3.13, floor + height - 0.37]) {
      const width =
        y > floor + 10 ? topWidth + 0.12 : y > floor + 2 ? baseWidth - 0.45 : baseWidth + 0.1;
      const half = width / 2;
      block(out, 'cap', -half, y, -half, width, 0.084, width, colors.cap);
    }
    if (lod === 3)
      for (const x of [-0.275, 0.015, 0.288])
        block(
          out,
          'interior',
          x,
          floor + 0.46,
          -(baseWidth - 0.22) / 2 - 0.095,
          0.028,
          0.77,
          0.03,
          colors.interior,
        );
  }
}

function flue(out, lod, { flueSpan: [start, end] }, grade) {
  const segments = [5, 8, 12, 21][lod];
  const across = [
    [-0.53, -0.27],
    [-0.53, 0.08],
    [-0.27, 0.26],
    [0.29, 0.26],
    [0.59, 0.08],
    [0.59, -0.27],
  ];
  const cross = (z) => {
    const y = grade([0, z]);
    return across.map(([x, offset]) => [x, y + offset, z]);
  };
  const stations = Array.from({ length: segments + 1 }, (_, i) =>
    cross(mix(start, end, i / segments)),
  );
  for (const [a, b] of pairs(stations)) {
    for (let i = 0; i < a.length - 1; i++) {
      const n = i === 0 ? [-1, 0, 0] : i === 4 ? [1, 0, 0] : [0, 1, 0];
      face(out, 'brick', [a[i], b[i], b[i + 1], a[i + 1]], n, colors.brick);
    }
  }
  const mouthY = grade([0, start]);
  arch(
    out,
    plane(start, -1),
    0.03,
    mouthY - 0.06,
    mouthY + 0.095,
    0.32,
    0.15,
    0.014,
    lod,
    { inner: colors.interior, trim: colors.cap, width: 0.05 },
    { inner: 'interior', trim: 'cap' },
  );
}

function draw(out, lod, dimensions, grade) {
  chimney(out, lod, dimensions, grade);
  flue(out, lod, dimensions, grade);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [22, 21, -39],
    lookAt: [0, 7, -7],
    yaw: 2.5,
    brief:
      'Square tapered red-brick chimney of Tai Tam Tuk’s pumping station with corbelled coping and the mapped downhill flue.',
    views: [
      { name: 'offset-base-and-brick-vent', position: [5.5, 4.9, -10.8], lookAt: [0, 2.7, 0] },
      {
        name: 'tapered-shaft-and-stepped-coping',
        position: [8.8, 18.7, 7.1],
        lookAt: [0, 14.3, 0],
      },
      { name: 'inclined-flue-and-site-slope', position: [15, 16, -31.5], lookAt: [0, -1, -11] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = asset;
model.category = 'industrial';
model.mediumFiContext.scale = 0.34;
model.sourceLicense =
  'Independent reconstruction from Hong Kong heritage boundary, official height measurements, survey terrain and written heritage facts.';
