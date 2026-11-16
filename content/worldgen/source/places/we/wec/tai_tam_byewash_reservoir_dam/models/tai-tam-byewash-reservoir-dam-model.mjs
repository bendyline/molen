import {
  block,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  faceStone: surface('wall', 'stone_ashlar', 0.95),
  rubble: surface('foundation', 'stone_basalt_raw', 0.96),
  coping: surface('roof', 'stone_granite', 0.87),
  apron: surface('foundation', 'concrete_plain', 0.94),
  rail: surface('trim', 'metal_painted', 0.69, 0.13),
};
const colors = palette({
  gray: '767a74',
  lightStone: '807f76',
  coping: '8f8b7e',
  shadedStone: '6e7069',
  rubble: '79796f',
  tread: '8c8b7d',
  concrete: '8a8a81',
  railing: '626a68',
  gauge: 'c4c3b4',
});

const spillwayProfile = [
  [-1.32, -11.5],
  [-1.32, -0.46],
  [-0.25, -0.035],
  [0.46, 0],
  [1.16, -0.1],
  [1.87, -0.35],
  [3.62, -1.38],
  [6.26, -2.94],
  [9.12, -5.02],
  [11.81, -6.69],
  [14.6, -7.54],
  [17.95, -7.9],
  [18.22, -11.5],
];
const samples = [
  [0, 1, 3, 5, 7, 9, 11, 12],
  [0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 12],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
];

function spillway(out, lod, { crestEnds, crestY, crestZ }) {
  const [left, right] = crestEnds;
  const count = [4, 8, 15, 30][lod];
  const profile = samples[Math.min(lod, 2)];
  const crossSection = (x) => {
    const center = (left + right) / 2;
    const away = Math.abs(x - center) / ((right - left) / 2);
    return profile.map((index) => {
      const [z, y] = spillwayProfile[index];
      // The apron pinches where the spillway meets the original rocky shoulders.
      return [x, crestY + y, crestZ + z - Math.max(0, z - 10.2) * 0.36 * away];
    });
  };
  for (let j = 0; j < count; j++) {
    const a = crossSection(mix(left, right, j / count));
    const b = crossSection(mix(left, right, (j + 1) / count));
    for (let i = 1; i < profile.length; i++) {
      const index = profile[i];
      let slot = 'faceStone',
        target = up,
        color = colors.gray;
      if (index === 1) {
        target = [0, 0, -1];
        color = colors.shadedStone;
      } else if (index < 6) {
        slot = 'coping';
        color = colors.coping;
      } else if (index >= 11) {
        slot = 'apron';
        color = colors.concrete;
        if (index === 12) target = [0, 0, 1];
      } else if (lod > 1 && j % 7 === 2) {
        color = colors.lightStone;
      }
      face(out, slot, [a[i - 1], b[i - 1], b[i], a[i]], target, color);
    }
    face(out, 'apron', [a.at(-1), b.at(-1), b[0], a[0]], [0, -1, 0], colors.concrete);
  }
  // Plain gravity-dam cuts continue into the two abutments.
  for (const [x, normal] of [
    [left, [-1, 0, 0]],
    [right, [1, 0, 0]],
  ]) {
    const profile = crossSection(x);
    for (const [a, b] of pairs(profile.slice(1))) {
      face(out, 'faceStone', [profile[0], a, b], normal, colors.shadedStone);
    }
  }
}

function shoulderWalls(out, grade, { crestEnds, crestY, crestZ }) {
  const [west, east] = crestEnds;
  for (const side of [
    {
      path: [
        [west + 0.55, crestZ + 1.44],
        [-21.4, crestZ + 3.55],
        [-25, crestZ + 6.36],
      ],
      top: [crestY + 0.48, crestY + 2.1, crestY + 5.45],
    },
    {
      path: [
        [east - 0.5, crestZ + 1.29],
        [22.05, crestZ + 3.4],
        [25, crestZ + 6.2],
      ],
      top: [crestY + 0.53, crestY + 1.9, crestY + 4.6],
    },
  ]) {
    for (const [i, [a, b]] of pairs(side.path).entries()) {
      const ay = Math.max(side.top[i], grade(a) + 0.52);
      const by = Math.max(side.top[i + 1], grade(b) + 0.47);
      const footA = Math.min(grade(a) - 0.7, ay - 1.7);
      const footB = Math.min(grade(b) - 0.7, by - 1.7);
      const top = [
        [a[0], ay, a[1]],
        [b[0], by, b[1]],
        [b[0], by, b[1] + 0.91],
        [a[0], ay, a[1] + 0.91],
      ];
      face(
        out,
        'rubble',
        [[a[0], footA, a[1]], [b[0], footB, b[1]], top[1], top[0]],
        [0, 0, -1],
        colors.rubble,
      );
      face(
        out,
        'rubble',
        [[a[0], footA, a[1] + 0.91], [b[0], footB, b[1] + 0.91], top[2], top[3]],
        [0, 0, 1],
        colors.rubble,
      );
      face(out, 'coping', top, up, colors.tread);
      face(
        out,
        'rubble',
        [[b[0], footB, b[1]], [b[0], footB, b[1] + 0.91], top[2], top[1]],
        [1, 0, 0],
        colors.rubble,
      );
    }
  }
}

function bar(out, a, b, radius) {
  const [dx, dy, dz] = b.map((v, i) => v - a[i]);
  const length = Math.hypot(dx, dy, dz);
  const h = Math.hypot(dx, dz);
  const u = h > 0.001 ? [dz / h, 0, -dx / h] : [1, 0, 0];
  const v = [
    (dy * u[2] - dz * u[1]) / length,
    (dz * u[0] - dx * u[2]) / length,
    (dx * u[1] - dy * u[0]) / length,
  ];
  const square = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([p, q]) => u.map((ui, i) => (ui * p + v[i] * q) * radius));
  for (let i = 0; i < 4; i++) {
    const offsets = [square[i], square[(i + 1) % 4]];
    const points = [
      ...offsets.map((d) => a.map((x, j) => x + d[j])),
      ...offsets.toReversed().map((d) => b.map((x, j) => x + d[j])),
    ];
    face(
      out,
      'rail',
      points,
      offsets[0].map((x, j) => x + offsets[1][j]),
      colors.railing,
    );
  }
}

function gaugeAccess(out, lod, grade, { crestY, crestZ }) {
  const left = -24.65,
    right = -17.7;
  const z = crestZ - 0.3;
  const steps = [2, 7, 12, 17][lod];
  const width = (right - left) / steps;
  const deck = (x) =>
    Math.max(mix(crestY + 5.05, crestY + 0.76, (x - left) / (right - left)), grade([x, z]) + 0.15);
  for (let i = 0; i < steps; i++) {
    const x = left + i * width,
      y = deck(x + width / 2);
    const ground = Math.min(y - 0.18, grade([x + width / 2, z]) - 0.38);
    block(out, 'rubble', x, ground, z, width, y - ground, 1.37, colors.rubble);
    if (lod > 1)
      block(out, 'coping', x, y - 0.09, z - 0.027, width + 0.037, 0.09, 1.424, colors.tread);
  }
  if (!lod) return;
  const posts = Array.from({ length: 5 }, (_, i) => {
    const x = mix(left + 0.19, right - 0.15, i / 4),
      y = deck(x);
    block(out, 'rail', x - 0.029, y, z - 0.019, 0.058, 0.96, 0.056, colors.railing);
    return [x, y + 0.93, z + 0.014];
  });
  for (const [a, b] of pairs(posts)) {
    bar(out, a, b, 0.034);
    if (lod > 1) bar(out, [a[0], a[1] - 0.4, a[2]], [b[0], b[1] - 0.4, b[2]], 0.022);
  }
  if (lod === 3) {
    const [x, y] = posts.at(-1),
      front = z - 0.12;
    block(out, 'rubble', x - 0.19, y - 2.56, front - 0.08, 0.2, 2.29, 0.17, colors.shadedStone);
    block(out, 'rail', x - 0.156, y - 2.5, front + 0.088, 0.134, 2.06, 0.02, colors.gauge);
    for (let i = 0; i < 13; i++) {
      block(
        out,
        'rail',
        x - 0.14,
        y - 2.43 + i * 0.154,
        front + 0.109,
        i % 4 === 0 ? 0.1 : 0.055,
        0.021,
        0.009,
        colors.railing,
      );
    }
  }
}

function draw(out, lod, dims, grade) {
  spillway(out, lod, dims);
  shoulderWalls(out, grade, dims);
  gaugeAccess(out, lod, grade, dims);
}

const dam = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [3, 35, 65],
    lookAt: [0, 4, -7],
    yaw: -0.52,
    brief:
      'Tai Tam Byewash Reservoir Dam. The continuous dark granite spillway, rounded overflow crest, two rubble abutments and the west gauge approach.',
    views: [
      { name: 'byewash-spillway-from-downstream', position: [-3, 16, 29], lookAt: [1, 4, -7] },
      {
        name: 'spillway-crest-and-west-gauge-steps',
        position: [-30, 23, 0],
        lookAt: [-10, 8, -12],
      },
      { name: 'spillway-abutments-in-terrain', position: [25, 52, 37], lookAt: [0, 4, -8] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = dam;
model.category = 'industrial';
model.sourceLicense =
  'Independent geometry from OpenStreetMap, the public Lands Department elevation grid and an exact public-domain reference photograph.';
