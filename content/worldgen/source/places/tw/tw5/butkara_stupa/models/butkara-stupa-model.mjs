import controls from '../plan-controls.json' with { type: 'json' };
import {
  block,
  cap,
  face,
  palette,
  pavilion,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  schist: surface('wall', 'stone_drywall', 0.96),
  course: surface('wall', 'stone_ashlar', 0.88),
  chips: surface('trim', 'stone_limestone_raw', 0.93),
  packed: surface('roof', 'stone_limestone_weathered', 0.95),
  pavement: surface('foundation', 'stone_ashlar', 0.95),
};
const C = palette({
  shingle: '8f9281',
  light: 'a6a394',
  schist: '747d76',
  damp: '646c65',
  split: '828475',
  fill: '9a917d',
  path: '797e74',
  palePath: '8c8980',
  rubble: '908b7a',
  dark: '696963',
  floor: '82806f',
});

const tau = 2 * Math.PI;
function point(x, z, r, a) {
  return [x + r * Math.cos(a), z + r * Math.sin(a)];
}

function course(
  out,
  grade,
  { x = 0, z = 0, rings, segments, slot, shades, shape = () => 0, gaps = () => false },
) {
  for (let i = 0; i < segments; i++) {
    const a = (i * tau) / segments;
    const b = ((i + 1) * tau) / segments;
    if (gaps((a + b) / 2)) continue;
    const shade = shades[(i * 7 + Math.floor(i / 5)) % shades.length];
    const rowPoint = ([r, y], angle, row) => {
      const [px, pz] = point(x, z, r, angle);
      const offset = shape(angle) * (row === 0 ? 0 : 1);
      return [px, typeof y === 'function' ? y(grade([px, pz])) : y + offset, pz];
    };
    for (let row = 0; row + 1 < rings.length; row++) {
      const belowA = rowPoint(rings[row], a, row);
      const belowB = rowPoint(rings[row], b, row);
      const aboveB = rowPoint(rings[row + 1], b, row + 1);
      const aboveA = rowPoint(rings[row + 1], a, row + 1);
      const horizontal = rings[row][0] !== rings[row + 1][0];
      const outward = [Math.cos((a + b) / 2), horizontal ? 0.65 : 0, Math.sin((a + b) / 2)];
      face(out, slot, [belowA, belowB, aboveB], outward, shade);
      face(out, slot, [belowA, aboveB, aboveA], outward, shade);
    }
  }
}

function walk(out, grade, outer, inner, lod) {
  const slices = [18, 36, 60, 90][lod];
  for (let i = 0; i < slices; i++) {
    if (lod > 0 && (i % 13 === 9 || i % 17 === 1)) continue;
    const a = (i * tau) / slices + (lod ? 0.008 : 0);
    const b = ((i + 1) * tau) / slices - (lod ? 0.008 : 0);
    const vertex = (r, angle) => {
      const [x, z] = point(0, 0, r, angle);
      return [x, grade([x, z]) + 0.27, z];
    };
    const p = [vertex(inner, a), vertex(outer, a), vertex(outer, b), vertex(inner, b)];
    const tint = i % 3 === 1 ? C.palePath : C.path;
    face(out, 'pavement', [p[0], p[1], p[2]], up, tint);
    face(out, 'pavement', [p[0], p[2], p[3]], up, tint);
  }
}

function greatStupa(out, grade, controls, lod) {
  const {
    phase1CoreDiameter,
    phase1SurvivingHeight,
    phase2Diameter,
    phase3LowerDiameter,
    phase3UpperDiameter,
    phase4Diameter,
    phase4SurvivingHeight,
    ambulacrumWidth,
    phase5Diameter,
  } = controls;
  const base = phase4Diameter / 2;
  const segments = [14, 36, 64, 100][lod];
  const gradeBase = (y) => y - 0.19;
  const lowerRise = phase4SurvivingHeight;
  const lowBroken = (a) => 0.13 * Math.sin(a * 6) + 0.16 * Math.sin(a * 9 + 1);
  const upperBroken = (a) =>
    0.21 * Math.sin(a * 4 + 1) + 0.15 * Math.sin(a * 10) + 0.12 * Math.sin(a * 19);
  const southwest = (a) => a > 1.98 && a < 3.02;
  const packedCore = Array.from({ length: segments }, (_, i) =>
    point(0, 0, 7.62, (i * tau) / segments),
  );
  cap(out, 'packed', packedCore, 1.72, C.fill);
  walk(out, grade, base + ambulacrumWidth, base - 0.07, lod);
  course(out, grade, {
    rings: [
      [base + 0.12, gradeBase],
      [base + 0.12, 0.61],
      [base, 0.68],
      [base, lowerRise],
      [base - 0.28, lowerRise + 0.21],
      [phase3LowerDiameter / 2, 1.75],
    ],
    segments,
    slot: 'course',
    shades: [C.shingle, C.shingle, C.shingle, C.split],
    shape: lowBroken,
  });
  const eastRadius = phase5Diameter / 2;
  course(out, grade, {
    rings: [
      [eastRadius, 1.02],
      [eastRadius, 2.24],
      [eastRadius - 0.62, 2.52],
      [phase2Diameter / 2, 2.67],
      [5.72, 2.88],
      [5.3, 3.11],
      [phase1CoreDiameter / 2, 3.13],
    ],
    segments,
    slot: 'schist',
    shades: [C.split, C.split, C.path, C.split],
    shape: upperBroken,
    gaps: southwest,
  });
  course(out, grade, {
    rings: [
      [phase3LowerDiameter / 2, 1.54],
      [phase3LowerDiameter / 2, 1.84],
      [phase3UpperDiameter / 2, 2.07],
      [phase3UpperDiameter / 2, 2.29],
      [phase2Diameter / 2, 2.43],
      [4.6, 2.75],
      [phase1CoreDiameter / 2, 3.24],
    ],
    segments,
    slot: 'course',
    shades: [C.shingle, C.split, C.shingle],
    shape: lowBroken,
    gaps: (a) => !southwest(a),
  });
  const core = phase1CoreDiameter / 2;
  const peak = phase1SurvivingHeight;
  course(out, grade, {
    rings: [
      [core, 2.16],
      [core, 3.24],
      [core * 0.94, 3.77],
      [core * 0.69, 4.31],
      [core * 0.39, peak - 0.31],
    ],
    segments,
    slot: 'schist',
    shades: [C.rubble, C.split, C.rubble, C.rubble],
    shape: (a) => 0.15 * Math.sin(a * 5) + 0.07 * Math.sin(a * 13),
  });
  const crown = Array.from({ length: segments }, (_, i) =>
    point(0, 0, core * 0.388, (i * tau) / segments),
  );
  cap(out, 'packed', crown, peak - 0.28, C.fill);

  if (lod >= 2) {
    for (let i = 0; i < (lod === 2 ? 31 : 62); i++) {
      const a = (i * tau) / (lod === 2 ? 31 : 62);
      const rough = 0.52 + 0.35 * Math.sin(i * 12.4);
      const [x, z] = point(0, 0, 7.95 + 0.45 * Math.sin(i * 3.1), a);
      const y = 1.54 + 0.18 * Math.sin(a * 6) + 0.14 * Math.cos(a * 9);
      block(
        out,
        'chips',
        x - rough / 2,
        y - 0.17,
        z - 0.22,
        rough,
        0.11 + 0.17 * rough,
        0.44,
        i % 3 ? C.split : C.light,
      );
    }
  }
}

const votiveBases = [
  [-11.9, -12.7, 1.62],
  [-7.1, -13.9, 1.63],
  [-3.2, -12.9, 1.18],
  [4, -13.8, 1.34],
  [8.4, -12.7, 1.37],
  [12.7, -10.8, 1.86],
  [-14.8, -8.8, 1.44],
  [13.5, -6.3, 1.6],
  [-13.9, -3.6, 1.34],
  [14.4, -2.4, 1.29],
  [-14.9, 2.1, 1.42],
  [14.2, 3.1, 1.54],
  [-13.8, 7.2, 1.64],
  [13.8, 8.3, 1.51],
  [-10.8, 11.8, 1.48],
  [10.4, 11.5, 1.86],
  [-6.8, 13.2, 1.16],
  [-1.8, 14.7, 1.67],
  [4.9, 13.7, 1.36],
  [-15.2, -14.7, 1.24],
  [-18.2, -11.6, 1.35],
  [-17.3, 11.5, 1.55],
  [-13.8, 16.6, 1.47],
  [12.1, 14.9, 1.28],
  [16.9, -12.6, 1.52],
  [17.7, 7.1, 1.29],
  [0.1, -18.1, 1.72],
  [6.1, -18.0, 1.35],
];

function foundations(out, grade, lod) {
  for (const [i, [x, z, r]] of votiveBases.entries()) {
    if (lod === 0 && i % 6 !== 0) continue;
    const y = grade([x, z]);
    const foot = (p) => Math.min(grade(p) - 0.19, y - 0.14);
    const low = y + 0.2 + (i % 5) * 0.062;
    const square = rect(x - r, z - r, x + r, z + r);
    shell(out, square, foot, low, {
      wall: 'course',
      color: i % 3 === 1 ? C.split : C.schist,
      roof: 'packed',
      roofColor: C.rubble,
    });
    if (i % 4 === 1) {
      shell(
        out,
        rect(x - r * 0.72, z - r * 0.7, x + r * 0.72, z + r * 0.7),
        () => low,
        low + 0.68,
        { wall: 'course', color: C.shingle, roof: 'packed', roofColor: C.fill },
      );
      continue;
    }
    const segments = [8, 10, 14, 19][lod];
    const radius = r * 0.78;
    const top = low + 0.28 + (i % 4) * 0.12;
    const circle = Array.from({ length: segments }, (_, j) =>
      point(x, z, radius * 0.83, (j * tau) / segments),
    );
    course(out, grade, {
      x,
      z,
      segments,
      rings: [
        [radius, low],
        [radius, top - 0.13],
        [radius * 0.83, top],
      ],
      slot: 'schist',
      shades: [C.shingle, C.split, C.schist],
    });
    cap(out, 'packed', circle, top, C.fill);
    if (lod >= 2 && i % 4 === 0) {
      block(out, 'chips', x - r / 4, top - 0.02, z - r / 5, r / 2, r * 0.45, r * 0.51, C.light);
    }
  }
}

function peripheralRuins(out, grade, lod) {
  const fragments = [
    [-24, -11, -23, 11],
    [-24, -11, -17, -10],
    [-24, -2, -19, -0.7],
    [-24, 9, -17.5, 9.7],
    [-18, -22, 11.4, -22],
    [12.6, -21.8, 17.7, -16],
    [-18, -22, -18, -17.2],
    [-14.2, 20.3, 6.8, 20.3],
    [7.4, 20.3, 10.5, 17.4],
    [20.1, -8.5, 26.6, -8.5],
    [26.6, -8.5, 26.6, 1.7],
    [26.6, 1.7, 20.1, 1.7],
    [20.1, 1.7, 20.1, -8.5],
  ];
  for (const [i, [x, z, u, v]] of fragments.entries()) {
    const n = Math.max(1, Math.ceil(Math.hypot(u - x, v - z) / (lod === 0 ? 7.4 : 1.6)));
    for (let j = 0; j < n; j++) {
      if (j % 7 === 4 && i < 9) continue;
      const p = [x + ((u - x) * j) / n, z + ((v - z) * j) / n];
      const q = [x + ((u - x) * (j + 1)) / n, z + ((v - z) * (j + 1)) / n];
      const dx = q[0] - p[0],
        dz = q[1] - p[1],
        d = Math.hypot(dx, dz);
      const w = 0.31 + (j % 4) * 0.028;
      const normal = [(-dz * w) / d, (dx * w) / d];
      const box = [
        [p[0] - normal[0], p[1] - normal[1]],
        [q[0] - normal[0], q[1] - normal[1]],
        [q[0] + normal[0], q[1] + normal[1]],
        [p[0] + normal[0], p[1] + normal[1]],
      ];
      const y = Math.max(grade(p), grade(q)) + (i >= 9 ? 0.56 : 0.3 + (j % 4) * 0.19);
      shell(out, box, (pt) => grade(pt) - 0.15, y, {
        wall: 'schist',
        color: C.schist,
        roof: 'chips',
        roofColor: j % 3 ? C.shingle : C.palePath,
      });
    }
  }
}

function draw(out, lod, controls, grade) {
  greatStupa(out, grade, controls, lod);
  foundations(out, grade, lod);
  peripheralRuins(out, grade, lod);
}
const ruins = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-40, 22, 33],
    lookAt: [1, 1.4, -1],
    yaw: -0.85,
    sun: [-460, 510, 350],
    brief:
      'Excavated Great Stupa of Butkara I with concentric ruined masonry, schist ambulacrum and representative votive foundations.',
    views: [
      { name: 'southwest-exposed-stupa-courses', position: [-18, 6.4, 19], lookAt: [-1, 2.25, 1] },
      { name: 'north-votive-foundations', position: [-9, 10.3, -24], lookAt: [2, 1.5, -6] },
      { name: 'eastern-precinct-and-stupa', position: [34, 12, -12], lookAt: [6, 1.5, -1] },
      { name: 'circular-masonry-and-site-remains', position: [-14, 64, 27], lookAt: [1, 1.2, -2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = ruins;
export const model = {
  ...ruins.model,
  category: 'archaeology',
  buildingCutout: {
    outline: controls.dimensions.outline,
    minimumCoverage: 0.94,
    basis: 'Suppresses the generic building mapped as the full Butkara I precinct while the stupa is placed.',
  },
  sourceLicense:
    'Independent archaeological geometry from factual excavation notes, the government site register, the named mapped precinct and original elevations.',
};
