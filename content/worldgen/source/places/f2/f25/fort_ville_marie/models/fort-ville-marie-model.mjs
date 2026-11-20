import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stockade: surface('wall', 'wood_vertical'),
  log: surface('wall', 'wood_log'),
  stone: surface('foundation', 'stone_limestone_weathered'),
  plaster: surface('wall', 'plaster_lime'),
  roof: surface('roof', 'wood_painted_shingle'),
  trim: surface('trim', 'wood_plain'),
};
const C = palette({
  bark: '82705a',
  timber: '735d48',
  trim: 'a58c6b',
  pale: 'bbac8c',
  lightStone: 'a6a08f',
  lightPlaster: 'd7cbb2',
  tar: '605e53',
  weather: '8b7d61',
  shingle: '797161',
  roofShade: '696659',
  ground: '9a8c6e',
  dark: '403931',
});

const xyz = ([x, z], y) => [x, y, z];
const pointAlong = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
function solid(out, p, lo, hi, slot, tint, top = slot, roofTint = tint) {
  shell(out, p, typeof lo === 'number' ? () => lo : lo, hi, {
    wall: slot,
    color: tint,
    roof: top,
    roofColor: roofTint,
  });
}
function pole(out, [x, z], y, width, height, high, color, sides) {
  const base = Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * (i + 0.15)) / sides;
    return [x + width * Math.cos(angle), z + width * Math.sin(angle)];
  });
  for (let i = 0; i < sides; i++) {
    const a = base[i];
    const b = base[(i + 1) % sides];
    const n = [(a[0] + b[0]) / 2 - x, 0, (a[1] + b[1]) / 2 - z];
    face(out, 'stockade', [xyz(a, y), xyz(b, y), xyz(b, y + height), xyz(a, y + height)], n, color);
    face(
      out,
      'trim',
      [xyz(a, y + height), xyz(b, y + height), [x, y + height + high, z]],
      [0, 1, 0],
      C.trim,
    );
  }
}
function palisade(out, a, b, grade, lod) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const norm = [(b[1] - a[1]) / length, (a[0] - b[0]) / length];
  const add = (p, s) => [p[0] + s * norm[0], p[1] + s * norm[1]];
  const stepCount = Math.ceil(length / 9.0);
  for (let i = 0; i < stepCount; i++) {
    const p0 = pointAlong(a, b, i / stepCount);
    const p1 = pointAlong(a, b, (i + 1) / stepCount);
    const poly = [add(p0, -0.16), add(p1, -0.16), add(p1, 0.16), add(p0, 0.16)];
    const y0 = grade(p0),
      y1 = grade(p1);
    const deck = poly.map((p, j) => xyz(p, (j === 0 || j === 3 ? y0 : y1) + 3.0));
    const foot = poly.map((p) => xyz(p, grade(p) - 0.25));
    const winding = areaSign(poly);
    for (const [j, k] of [
      [0, 1],
      [2, 3],
    ]) {
      const w = edge(poly[j], poly[k], winding);
      face(
        out,
        'stockade',
        [foot[j], foot[k], deck[k], deck[j]],
        w.normal,
        i % 3 === 1 ? C.timber : C.bark,
      );
    }
    face(out, 'trim', deck, [0, 1, 0], C.trim);
  }
  if (lod === 0) return;
  const targetSpacing = [0, 2.03, 0.86, 0.48][lod];
  const count = Math.ceil(length / targetSpacing);
  for (let i = 0; i < count; i++) {
    const p = pointAlong(a, b, (i + 0.5) / count);
    const height = 3.0 + ((i * 13) % 7) * 0.028;
    pole(
      out,
      p,
      grade(p) - 0.22,
      0.245,
      height,
      0.43 + (i % 4) * 0.025,
      i % 6 === 2 ? C.trim : C.timber,
      lod === 3 ? 5 : 4,
    );
  }
}
function entry(out, grade, lod, z) {
  const center = 2.7;
  const left = center - 1.93,
    right = center + 1.93;
  const y = Math.max(grade([left, z]), grade([right, z]));
  for (const x of [left, right])
    block(
      out,
      'trim',
      x - 0.22,
      grade([x, z]) - 0.4,
      z - 0.3,
      0.44,
      y + 3.55 - (grade([x, z]) - 0.4),
      0.6,
      C.timber,
    );
  block(out, 'trim', left - 0.39, y + 3.23, z - 0.34, right - left + 0.78, 0.31, 0.69, C.trim);
  for (const side of [-1, 1]) {
    const x = center + side * 1.66;
    const d = side === -1 ? 0.52 : 0.94;
    const panelShape = rect(x - 0.16, z - d - 0.2, x + 0.16, z);
    solid(out, panelShape, y + 0.06, y + 2.94, 'stockade', C.bark);
    if (lod > 1) block(out, 'trim', x - 0.22, y + 1.52, z - d - 0.16, 0.45, 0.15, d + 0.2, C.trim);
  }
}

function gable(out, parameters, grade, lod) {
  const { x0, x1, z0, z1, wall, rise, kind } = parameters;
  const p = rect(x0, z0, x1, z1);
  const floor = Math.max(...p.map(grade));
  const eave = floor + wall;
  const ridge = eave + rise;
  const center = (z0 + z1) / 2;
  const masonry = kind === 'chapel' || kind === 'workshop';
  const slot = masonry ? 'plaster' : 'log';
  const tone = masonry ? C.lightPlaster : C.bark;
  solid(
    out,
    p,
    (q) => Math.min(grade(q) - 0.32, floor - 0.19),
    floor + 0.19,
    'stone',
    C.lightStone,
  );
  solid(out, p, floor + 0.19, eave, slot, tone);
  const over = kind === 'chapel' ? 0.39 : 0.33;
  const a = x0 - over,
    b = x1 + over;
  for (const [z, color] of [
    [z0 - over, C.roofShade],
    [z1 + over, C.shingle],
  ])
    face(
      out,
      'roof',
      [
        [a, eave - 0.08, z],
        [b, eave - 0.08, z],
        [b, ridge, center],
        [a, ridge, center],
      ],
      [0, 1, 0],
      color,
    );
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    face(
      out,
      slot,
      [
        [x, eave, z0],
        [x, eave, z1],
        [x, ridge - 0.06, center],
      ],
      [sign, 0, 0],
      tone,
    );
  if (lod > 0) block(out, 'trim', a, ridge - 0.07, center - 0.085, b - a, 0.14, 0.17, C.trim);
  const front = edge([x1, z1], [x0, z1], areaSign(p));
  const back = edge([x0, z0], [x1, z0], areaSign(p));
  const frontWindow = (w, x, lo, hi, width) => {
    const left = x - width / 2,
      right = x + width / 2;
    if (lod === 0) panel(out, 'trim', w, left, right, lo, hi, 0.035, C.dark);
    else opening(out, w, left, right, lo, hi, 'trim', C.dark, 'trim', C.trim, 0, 0.037);
    if (lod > 1 && lo - floor > 0.55)
      panel(out, 'trim', w, x - 0.025, x + 0.025, lo + 0.015, hi - 0.01, 0.075, C.pale);
  };
  frontWindow(front, front.length * 0.53, floor + 0.22, floor + 2.23, 0.95);
  const count = Math.max(2, Math.floor(front.length / 3.4));
  for (let j = 0; j < count; j++) {
    const location = ((j + 0.54) * front.length) / count;
    if (Math.abs(location - front.length * 0.53) > 1.03)
      frontWindow(front, location, floor + 1.15, floor + 2.48, masonry ? 0.78 : 0.69);
    if (lod > 0 && j % 2 === 0) frontWindow(back, location, floor + 1.25, floor + 2.36, 0.73);
  }
  if (kind === 'chapel') {
    const bellX = x0 + (x1 - x0) * 0.27;
    const h = ridge + 1.02;
    block(out, 'log', bellX - 0.76, ridge - 0.62, center - 0.71, 1.52, 1.65, 1.42, C.timber);
    const corners = [
      [bellX - 0.96, center - 0.91],
      [bellX + 0.96, center - 0.91],
      [bellX + 0.96, center + 0.91],
      [bellX - 0.96, center + 0.91],
    ];
    for (const [a, b] of pairs(closed(corners)))
      face(out, 'roof', [xyz(a, h), xyz(b, h), [bellX, h + 1.58, center]], [0, 1, 0], C.roofShade);
    block(out, 'trim', bellX - 0.045, h + 1.56, center - 0.045, 0.09, 0.85, 0.09, C.trim);
    block(out, 'trim', bellX - 0.33, h + 2.02, center - 0.047, 0.66, 0.09, 0.094, C.trim);
  } else if (kind === 'workshop' || kind === 'quarter') {
    const x = x1 - 1.43;
    block(out, 'stone', x - 0.39, ridge - 0.93, center - 0.34, 0.78, 1.74, 0.68, C.lightStone);
    if (lod > 1)
      block(out, 'stone', x - 0.44, ridge + 0.76, center - 0.39, 0.88, 0.17, 0.78, C.pale);
  }
}

function well(out, grade, lod) {
  const [x, z] = [-3.6, 5.15];
  const y = grade([x, z]) + 0.18;
  const segments = [8, 12, 16, 20][lod];
  const ring = (radius, k) => [
    x + radius * Math.cos((k * 2 * Math.PI) / segments),
    z + radius * Math.sin((k * 2 * Math.PI) / segments),
  ];
  for (let i = 0; i < segments; i++) {
    const a = ring(0.92, i),
      b = ring(0.92, i + 1),
      c = ring(0.65, i + 1),
      d = ring(0.65, i);
    face(
      out,
      'trim',
      [xyz(a, y + 0.61), xyz(b, y + 0.61), xyz(c, y + 0.61), xyz(d, y + 0.61)],
      [0, 1, 0],
      C.trim,
    );
    face(
      out,
      'stockade',
      [xyz(a, y - 0.24), xyz(b, y - 0.24), xyz(b, y + 0.61), xyz(a, y + 0.61)],
      [a[0] + b[0] - 2 * x, 0, a[1] + b[1] - 2 * z],
      C.timber,
    );
    if (lod > 0)
      face(
        out,
        'trim',
        [xyz(c, y - 0.26), xyz(d, y - 0.26), xyz(d, y + 0.61), xyz(c, y + 0.61)],
        [2 * x - c[0] - d[0], 0, 2 * z - c[1] - d[1]],
        C.dark,
      );
  }
  if (lod > 0) {
    for (const side of [-1, 1])
      block(out, 'trim', x + side * 1.13 - 0.1, y - 0.16, z - 0.1, 0.2, 2.37, 0.2, C.timber);
    block(out, 'trim', x - 1.29, y + 2.08, z - 0.12, 2.59, 0.19, 0.24, C.trim);
  }
}
const structures = [
  { x0: -9.4, x1: 5.1, z0: -16.5, z1: -10.7, wall: 3.41, rise: 2.46, kind: 'chapel' },
  { x0: 9.7, x1: 21.9, z0: -16.8, z1: -10.1, wall: 3.25, rise: 2.17, kind: 'quarter' },
  { x0: -22.6, x1: -13.4, z0: -14.3, z1: -8.0, wall: 2.52, rise: 1.92, kind: 'cabin' },
  { x0: -22.6, x1: -13.4, z0: -4.2, z1: 1.63, wall: 2.67, rise: 2.26, kind: 'workshop' },
  { x0: -22.2, x1: -12.1, z0: 9.2, z1: 14.9, wall: 2.48, rise: 1.81, kind: 'guard' },
  { x0: 12.0, x1: 22.3, z0: 0.3, z1: 6.0, wall: 2.47, rise: 1.84, kind: 'cabin' },
  { x0: 12.3, x1: 22.6, z0: 10.1, z1: 15.7, wall: 2.63, rise: 1.97, kind: 'quarter' },
];
function draw(out, lod, { outline }, grade) {
  for (const [a, b] of pairs(closed(outline))) {
    if (a[1] > 0 && a[1] === b[1] && a[0] < 0 && b[0] > 0) {
      palisade(out, a, [0.77, a[1]], grade, lod);
      palisade(out, [4.63, a[1]], b, grade, lod);
      entry(out, grade, lod, a[1]);
    } else palisade(out, a, b, grade, lod);
  }
  for (const structure of structures) gable(out, structure, grade, lod);
  well(out, grade, lod);
}
const fort = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [84, 53, 119],
    lookAt: [0, 1.8, 0],
    yaw: 0.45,
    sun: [320, 560, 460],
    brief:
      'Circa-1660 Fort Ville-Marie at Pointe à Callière, with a timber stockade, four bastions, yard, chapel, and representative early settlement buildings.',
    views: [
      { name: 'four-bastion-enclosure-and-yard', position: [62, 64, 56], lookAt: [0, 1, 0] },
      { name: 'river-facing-palisade-and-gate', position: [21, 9, 51], lookAt: [2, 2, 15] },
      { name: 'chapel-well-and-domestic-ranges', position: [5, 15, 16], lookAt: [-3, 2, -10] },
      {
        name: 'smithy-guardhouse-and-timber-stockade',
        position: [-41, 17, 25],
        lookAt: [-17, 1, 5],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = fort;
export const model = {
  ...fort.model,
  category: 'fortification',
  geographicStatus: 'historical-proposal',
  sourceLicense:
    'Original geometry from Pointe-à-Callière archaeological findings and the confirmed public-domain Morin archive plate.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1660-07-01',
    validFrom: '1658-01-01',
    validUntil: '1674-01-01',
  },
};
