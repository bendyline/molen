import {
  block,
  cap,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  granite: surface('wall', 'stone_ashlar', 0.96),
  coping: surface('trim', 'stone_granite', 0.92),
  concrete: surface('foundation', 'concrete_plain', 0.92),
  road: surface('roof', 'concrete_plain', 0.96),
  steel: surface('trim', 'metal_painted', 0.75, 0.15),
};
const colors = palette({
  stone: '8f897b',
  trim: 'a9a18d',
  concrete: '98968b',
  basin: '7c8073',
  road: '6c6e63',
  rails: '626d65',
});

function alongRoad(road, x) {
  const [a, b] = pairs(road).find(([, p]) => x <= p[0]) ?? road.slice(-2);
  return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}

function stations(road, gap, extras = []) {
  const knots = [...new Set([...road.map(([x]) => x), ...extras])].sort((a, b) => a - b);
  const samples = [knots[0]];
  for (const [a, b] of pairs(knots)) {
    const steps = Math.ceil((b - a) / gap);
    for (let i = 1; i <= steps; i++) samples.push(mix(a, b, i / steps));
  }
  return samples;
}

function roadBand(out, xs, zAt, z0, z1, bottom, top, slot, color) {
  const points = (x) => [
    [x, bottom, zAt(x) + z0],
    [x, top, zAt(x) + z0],
    [x, top, zAt(x) + z1],
    [x, bottom, zAt(x) + z1],
  ];
  const sections = xs.map(points);
  for (const [a, b] of pairs(sections)) {
    face(out, slot, [a[0], b[0], b[1], a[1]], [0, 0, -1], color);
    face(out, slot, [a[1], b[1], b[2], a[2]], up, color);
    face(out, slot, [a[2], b[2], b[3], a[3]], [0, 0, 1], color);
  }
  face(out, slot, sections[0], [-1, 0, 0], color);
  face(out, slot, sections.at(-1), [1, 0, 0], color);
}

function gravityWall(out, lod, dims, zAt, grade) {
  const { roadAxis, spillwaySill, spillwayEnds, roadY } = dims;
  const [start, stop] = spillwayEnds;
  const xs = stations(roadAxis, [58, 26, 12, 5][lod], [start - 0.2, start, stop, stop + 0.2]);
  const first = xs[0];
  const last = xs.at(-1);
  const section = (x) => {
    const z = zAt(x);
    const crest = x >= start && x <= stop ? spillwaySill : roadY - 0.36;
    const depth = Math.min(31, Math.max(5, Math.min(x - first, last - x) * 0.43));
    const toe = z + depth;
    const low = Math.min(crest - 1.2, Math.max(crest - 43, grade([x, toe]) + 0.5));
    const heel = Math.min(low - 1.5, grade([x, z - 4]) - 0.9);
    const shoulder = z + 2.85;
    const point = (fraction, drop) => {
      const d = mix(shoulder, toe, fraction);
      return [x, Math.max(mix(crest, low, drop), Math.min(crest - 0.14, grade([x, d]) + 0.82)), d];
    };
    return [
      [x, heel, z - 4.25],
      [x, crest, z - 4.25],
      [x, crest, shoulder],
      point(0.23, 0.28),
      point(0.53, 0.63),
      point(0.78, 0.83),
      [x, low, toe],
      [x, heel, toe],
    ];
  };
  const cuts = xs.map(section);
  for (const [a, b] of pairs(cuts)) {
    for (let i = 0; i < a.length - 1; i++) {
      const normal = i === 0 ? [0, 0, -1] : i === 6 ? [0, 0, 1] : up;
      face(
        out,
        i === 1 ? 'coping' : 'granite',
        [a[i], b[i], b[i + 1], a[i + 1]],
        normal,
        i === 1 ? colors.trim : colors.stone,
      );
    }
    face(out, 'concrete', [a[0], a.at(-1), b.at(-1), b[0]], [0, -1, 0], colors.concrete);
  }
  for (const [profile, normal] of [
    [cuts[0], [-1, 0, 0]],
    [cuts.at(-1), [1, 0, 0]],
  ]) {
    for (const [a, b] of pairs(profile.slice(1))) {
      face(out, 'concrete', [profile[0], a, b], normal, colors.concrete);
    }
  }
}

function spillways(out, lod, dims, zAt) {
  const {
    spillwayEnds: [start, stop],
    roadY,
    spillwaySill,
  } = dims;
  const spacing = (stop - start) / 12;
  const radius = spacing * 0.37;
  const crown = roadY - 0.65;
  const spring = spillwaySill + 1.23;
  const divisions = [3, 7, 10, 14][lod];
  for (let bay = 0; bay < 12; bay++) {
    const center = start + (bay + 0.5) * spacing;
    const left = start + bay * spacing;
    const right = left + spacing;
    const locals = Array.from({ length: divisions + 1 }, (_, i) => {
      const theta = Math.PI * (1 - i / divisions);
      return [center + Math.cos(theta) * radius, spring + Math.sin(theta) * (crown - spring)];
    });
    const archLine = [
      [left, spillwaySill],
      [locals[0][0], spillwaySill],
      ...locals,
      [locals.at(-1)[0], spillwaySill],
      [right, spillwaySill],
    ];
    const original = bay === 0 || bay === 11;
    const sides = [-2.58, 2.65];
    const fronts = lod === 0 && !original ? [sides[1]] : sides;
    for (const [[x, y], [q, h]] of pairs(archLine)) {
      const d0 = zAt(x);
      const d1 = zAt(q);
      if (x !== q) {
        for (const side of fronts) {
          const z = d0 + side;
          const z2 = d1 + side;
          face(
            out,
            'granite',
            [
              [x, y, z],
              [q, h, z2],
              [q, roadY - 0.13, z2],
              [x, roadY - 0.13, z],
            ],
            [0, 0, Math.sign(side)],
            colors.trim,
          );
        }
      }
      if (lod === 0) continue;
      face(
        out,
        'granite',
        [
          [x, y, d0 + sides[0]],
          [q, h, d1 + sides[0]],
          [q, h, d1 + sides[1]],
          [x, y, d0 + sides[1]],
        ],
        [0, -1, 0],
        colors.trim,
      );
    }
    if (original) {
      for (const x of [left + 0.5, right - 0.5])
        block(
          out,
          'coping',
          x - 0.23,
          spillwaySill + 0.02,
          zAt(x) + 2.56,
          0.46,
          roadY - spillwaySill - 0.25,
          0.45,
          colors.trim,
        );
    } else {
      const z = zAt(center) - 4.2;
      const siphon = spacing * 0.68;
      block(
        out,
        'concrete',
        center - siphon * 0.5,
        spillwaySill - 0.03,
        z,
        siphon,
        2.25,
        1.75,
        colors.concrete,
      );
      if (lod > 0)
        block(
          out,
          'coping',
          center - siphon * 0.51,
          spillwaySill + 2.22,
          z - 0.11,
          siphon * 1.02,
          0.12,
          1.89,
          colors.trim,
        );
    }
  }
  if (lod === 0) return;
  const segments = [0, 3, 5, 8][lod];
  for (let pier = 0; pier <= 12; pier++) {
    const x = start + pier * spacing;
    const z = zAt(x) + 2.65;
    const edge = (angle, y) => [x + Math.cos(angle) * 0.42, y, z + Math.sin(angle) * 0.42];
    for (let i = 0; i < segments; i++) {
      const a = (Math.PI * i) / segments;
      const b = (Math.PI * (i + 1)) / segments;
      const normal = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
      face(
        out,
        'coping',
        [
          edge(a, spillwaySill),
          edge(b, spillwaySill),
          edge(b, roadY - 0.16),
          edge(a, roadY - 0.16),
        ],
        normal,
        colors.trim,
      );
    }
  }
}

function crestRoad(out, lod, dims, zAt) {
  const { roadAxis, roadWidth, roadY } = dims;
  const xs = roadAxis.map(([x]) => x);
  const half = roadWidth * 0.5;
  roadBand(out, xs, zAt, -half, half, roadY - 0.39, roadY, 'road', colors.road);
  for (const edge of [-1, 1]) {
    const z = half * edge;
    roadBand(out, xs, zAt, z - 0.22, z + 0.22, roadY - 0.13, roadY + 0.88, 'granite', colors.stone);
    if (lod > 0)
      roadBand(out, xs, zAt, z - 0.25, z + 0.25, roadY + 0.86, roadY + 1.03, 'coping', colors.trim);
  }
}

function basin(out, lod, dims, grade) {
  const [p, q] = dims.basinBridge;
  const width = 1.35;
  const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const side = [(p[1] - q[1]) / length, (q[0] - p[0]) / length];
  const height = [grade(p) + 0.54, grade(q) + 0.54];
  const position = (t, offset, y = 0) => [
    mix(p[0], q[0], t) + side[0] * offset,
    mix(...height, t) + y,
    mix(p[1], q[1], t) + side[1] * offset,
  ];
  const deck = [
    position(0, -width / 2),
    position(0, width / 2),
    position(1, width / 2),
    position(1, -width / 2),
  ];
  face(out, 'coping', deck, up, colors.trim);
  for (const edge of [-1, 1]) {
    const offset = (edge * width) / 2;
    const normal = [side[0] * edge, 0, side[1] * edge];
    face(
      out,
      'concrete',
      [
        position(0, offset, -0.23),
        position(1, offset, -0.23),
        position(1, offset),
        position(0, offset),
      ],
      normal,
      colors.concrete,
    );
    face(
      out,
      'steel',
      [
        position(0, offset, 0.82),
        position(1, offset, 0.82),
        position(1, offset, 0.87),
        position(0, offset, 0.87),
      ],
      normal,
      colors.rails,
    );
    const posts = [4, 7, 10, 14][lod];
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const [x, y, z] = position(t, offset);
      block(out, 'steel', x - 0.026, y, z - 0.026, 0.052, 0.86, 0.052, colors.rails);
      if (lod > 1 && i > 0 && i < posts - 1 && i % 3 === 1 && edge === 1) {
        const base = Math.min(y - 0.81, grade([x, z]) - 0.25);
        block(
          out,
          'concrete',
          x - 0.48,
          base,
          z - 0.54,
          0.96,
          y - 0.23 - base,
          1.08,
          colors.concrete,
        );
      }
    }
  }
  const pool = [p, q, [-17, 13], [-27, -11], [-16, -22], [23, -20], [31, -10]];
  const poolBase = grade([0, -3]) + 0.09;
  cap(out, 'concrete', pool, poolBase, colors.basin);
  for (const [[x, z], [a, b]] of pairs(pool.slice(1))) {
    const top = Math.max(poolBase + 0.42, grade([x, z]) + 0.16);
    const end = Math.max(poolBase + 0.42, grade([a, b]) + 0.16);
    const normal = [b - z, 0, x - a];
    face(
      out,
      'concrete',
      [
        [x, poolBase - 0.59, z],
        [a, poolBase - 0.59, b],
        [a, end, b],
        [x, top, z],
      ],
      normal,
      colors.concrete,
    );
  }
}

function draw(out, lod, dimensions, grade) {
  const zAt = (x) => alongRoad(dimensions.roadAxis, x);
  gravityWall(out, lod, dimensions, zAt, grade);
  spillways(out, lod, dimensions, zAt);
  crestRoad(out, lod, dimensions, zAt);
  basin(out, lod, dimensions, grade);
}

const dam = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [98, 89, 270],
    lookAt: [3, -7.3, -19],
    yaw: -0.5,
    brief:
      'Tai Tam Tuk Reservoir masonry dam with its continuous curved crest road, twelve arched bays, ten modified siphons and the mapped downstream pool crossing.',
    views: [
      {
        name: 'downstream-gravity-wall-and-twelve-spillways',
        position: [2, 28, 111],
        lookAt: [4, -8, -35],
      },
      {
        name: 'crest-road-original-arch-and-siphons',
        position: [39, 28, -109],
        lookAt: [2, -1, -38],
      },
      { name: 'stilling-pool-and-crossing', position: [44, 2, 52], lookAt: [3, -32, -7] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = dam;
model.category = 'industrial';
model.mediumFiContext.scale = 2.62;
model.sourceLicense =
  'Independent reconstruction from native road and reservoir features, government terrain and heritage geometry and engineering descriptions.';
