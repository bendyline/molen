import {
  beam,
  beamPath,
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.14 },
  lining: { slot: 'wall', graph: 'bamboo', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  earth: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  floor: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
  grille: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.19 },
};

const clay = [0.51, 0.23, 0.172];
const accent = [0.61, 0.29, 0.218];
const oxide = [0.36, 0.163, 0.124];
const pale = [0.66, 0.58, 0.43];
const wood = [0.24, 0.17, 0.105];
const bamboo = [0.64, 0.42, 0.2];
const stone = [0.47, 0.43, 0.34];
const moss = [0.31, 0.34, 0.2];
const silver = [0.49, 0.469, 0.439];
const palette = 'palette:#ffffff';

// Three asymmetric swept roof shells. The gable ridges and their overhangs are separate
// from the earth walls. Native +Z faces the open forecourt.
const roofs = [
  {
    x: -8.4,
    peak: 6.3,
    eave: 1.36,
    west: 5.15,
    east: 4.1,
    front: 3.8,
    back: -4.7,
    skew: 0.44,
    tipDrop: [0.96, 1.17],
  },
  {
    x: 0.15,
    peak: 7.45,
    eave: 1.63,
    west: 5.65,
    east: 5.68,
    front: 5.08,
    back: -5.25,
    skew: -0.34,
    tipDrop: [1.33, 1.51],
  },
  {
    x: 8.75,
    peak: 6.05,
    eave: 1.27,
    west: 4.65,
    east: 5.0,
    front: 4.38,
    back: -4.92,
    skew: -0.56,
    tipDrop: [0.92, 0.61],
  },
];

function face(out, surface, a, b, c, d, color, uv) {
  const points = [a, b, c, d];
  if (uv) out.addQuad(surface, 'metric:uv', points, normalFor(a, b, c), uv, color);
  else quad(out, surface, points, normalFor(a, b, c), color);
}

function roofSection(roof, side, u, v) {
  const span = side < 0 ? roof.west : roof.east;
  const back = roof.back + 0.38 * u + 0.16 * u * side;
  const front = roof.front - (0.88 - 0.14 * side) * u * u;
  const crest = roof.peak - 0.71 * (1 - v) + 0.16 * Math.sin(Math.PI * v);
  const frontFall = v * v * v * roof.tipDrop[side < 0 ? 0 : 1];
  const foot = roof.eave + 0.32 * (1 - v) + 0.12 * side * v - frontFall;
  const y = crest + (foot - crest) * u * (2 - u);
  return [
    roof.x + roof.skew * (1 - v) + side * span * u * (0.91 + 0.09 * v),
    y,
    back + (front - back) * v,
  ];
}

function roofPoint(roof, side, u, v, lift = 0) {
  const [x, y, z] = roofSection(roof, side, u, v);
  const adjoining = roofs[roofs.indexOf(roof) + side];
  if (!adjoining) return [x, y + lift, z];
  const eave = roofSection(roof, side, 1, v);
  const opposite = roofSection(adjoining, -side, 1, v);
  const opening = Math.max(0, (v - 0.62) / 0.38);
  const separation = opening * opening;
  const [joinX, joinY, joinZ] = eave.map((value, axis) => (value + opposite[axis]) * 0.5);
  // The eaves share a valley behind the three front gables. They pull apart near the approach.
  const edgeX = joinX - side * 0.39 * separation;
  const edgeY = joinY + (eave[1] - joinY) * separation;
  const edgeZ = joinZ + (eave[2] - joinZ) * separation;
  return [
    x + (edgeX - eave[0]) * u,
    y + lift + (edgeY - eave[1]) * u * (2 - u),
    z + (edgeZ - eave[2]) * u,
  ];
}

function reliefHeight(x, y, z) {
  let ceiling = 0;
  for (const roof of roofs) {
    // Recover the roof-patch coordinates for the sculptural point in plan.
    let v = (z - roof.back) / (roof.front - roof.back);
    let u, side;
    for (let iteration = 0; iteration < 5; iteration++) {
      const ridgeX = roofPoint(roof, -1, 0, v)[0];
      const offset = x - ridgeX;
      side = offset < 0 ? -1 : 1;
      u = offset / (roofPoint(roof, side, 1, v)[0] - ridgeX);
      const back = roofPoint(roof, side, u, 0)[2];
      const front = roofPoint(roof, side, u, 1)[2];
      v = (z - back) / (front - back);
    }
    if (v >= 0 && v <= 1 && u >= 0 && u <= 1)
      ceiling = Math.max(ceiling, roofPoint(roof, side, u, v)[1] - 0.19);
  }
  if (ceiling <= 0 || y <= ceiling * 0.7) return y;
  const headroom = ceiling * 0.3;
  const extra = y - ceiling * 0.7;
  return ceiling - headroom ** 2 / (headroom + extra);
}

function beneathRoof(out) {
  const triangle = (surface, points, color) => {
    const fitted = points.map(([x, y, z]) => [x, reliefHeight(x, y, z), z]);
    out.addTriangle(surface, palette, fitted, normalFor(...fitted), [], color);
  };
  return {
    addTriangle: (surface, _ref, points, _normal, _uv, color) => triangle(surface, points, color),
    addQuad: (surface, _ref, [a, b, c, d], _normal, _uv, color) => {
      triangle(surface, [a, b, c], color);
      triangle(surface, [a, c, d], color);
    },
    addConvexPolygon: (surface, _ref, points, _normal, _uv, color) => {
      for (let i = 2; i < points.length; i++)
        triangle(surface, [points[0], points[i - 1], points[i]], color);
    },
  };
}

function roofShell(out, roof, level) {
  const hd = [3, 5, 7, 10][level];
  const along = [2, 3, 5, 7][level];
  for (const side of [-1, 1]) {
    const span = side < 0 ? roof.west : roof.east;
    const length = roof.front - roof.back;
    const slope = Math.hypot(span, roof.peak - roof.eave);
    const at = (u, v, lift) => roofPoint(roof, side, u, v, lift);
    for (let j = 0; j < along; j++)
      for (let i = 0; i < hd; i++) {
        const u = i / hd,
          u1 = (i + 1) / hd,
          v = j / along,
          v1 = (j + 1) / along;
        const corners = [
          [u, v],
          [u, v1],
          [u1, v1],
          [u1, v],
        ];
        if (side < 0) corners.reverse();
        const colors = [0.94, 0.98, 1.02, 0.97];
        const tint = silver.map((c) => c * colors[(j * 5 + i * 3) % colors.length]);
        const p = corners.map(([a, b]) => at(a, b, 0.07));
        const uv = corners.map(([a, b]) => [b * length, a * span]);
        face(out, 'roof', ...p, tint, uv);
        const lining = corners.toReversed();
        // The photographed palm and bamboo panels change slat direction at their battens.
        const angle = (j % 2 === 0 ? 1 : -1) * side * 0.51;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const liningUv = lining.map(([a, b]) => {
          const alongPanel = (b - v) * length;
          const acrossSlope = a * slope;
          return [alongPanel * cos + acrossSlope * sin, acrossSlope * cos - alongPanel * sin];
        });
        face(out, 'lining', ...lining.map(([a, b]) => at(a, b, 0)), bamboo, liningUv);
      }
    const gable = Array.from({ length: hd + 1 }, (_, i) => at(i / hd, 1, 0.005));
    if (level > 0)
      beamPath(
        out,
        'wood',
        gable.map(([x, y, z]) => [x, y - 0.115, z]),
        0.085,
        0.08,
        wood,
      );
    const battens =
      level >= 2
        ? [...Array.from({ length: along - 1 }, (_, i) => (i + 1) / along), 0.96]
        : level === 1
          ? [1 / 3, 2 / 3]
          : [];
    for (const v of battens) {
      const points = Array.from({ length: hd + 1 }, (_, i) => at(i / hd, v, -0.16));
      beamPath(out, 'wood', points, 0.085, 0.085, wood);
    }
    if (level >= 2) {
      // The corrugated sheets overlap along the slope, visible as narrow transverse lips.
      for (const lap of [0.39, 0.71]) {
        for (let j = 0; j < along; j++) {
          const v = j / along;
          const next = (j + 1) / along;
          const band = [
            [lap - 0.017, v],
            [lap - 0.017, next],
            [lap, next],
            [lap, v],
          ];
          if (side < 0) band.reverse();
          const points = band.map(([a, b]) => at(a, b, a === lap ? 0.106 : 0.095));
          const bandUv = band.map(([a, b]) => [b * length, a * span]);
          face(out, 'roof', ...points, [0.445, 0.424, 0.397], bandUv);
        }
      }
    }
  }
  const rib = Array.from({ length: along + 1 }, (_, i) => roofPoint(roof, -1, 0, i / along, 0.085));
  if (level > 0) {
    beamPath(out, 'roof', rib, 0.11, 0.1, silver);
    const underside = rib.map(([x, y, z]) => [x, y - 0.175, z]);
    beamPath(out, 'wood', underside, 0.13, 0.16, wood);
  }
  const top = rib.at(-1);
  // The front ridge ends in a short raised, flared timber hood.
  const [x, y, z] = top;
  loft(
    out,
    'wood',
    [
      [
        [x - 0.17, y - 0.08, z - 0.4],
        [x + 0.16, y - 0.08, z - 0.4],
        [x + 0.2, y - 0.05, z + 0.01],
        [x - 0.19, y - 0.05, z + 0.01],
      ],
      [
        [x - 0.46, y + 0.46, z - 0.42],
        [x + 0.35, y + 0.51, z - 0.43],
        [x + 0.44, y + 0.65, z + 0.13],
        [x - 0.5, y + 0.55, z + 0.13],
      ],
    ],
    wood,
  );
  face(
    out,
    'roof',
    [x - 0.48, y + 0.51, z - 0.43],
    [x - 0.52, y + 0.61, z + 0.17],
    [x + 0.46, y + 0.71, z + 0.17],
    [x + 0.38, y + 0.57, z - 0.43],
    silver,
  );
}

function valleyCovers(out, level) {
  if (level === 0) return;
  // Two raised sheets above the left valley read separately in the side photograph.
  for (const [station, width, depth, rise] of [
    [0.32, 1.24, 0.94, 0.38],
    [0.68, 1.54, 1.02, 0.49],
  ]) {
    const [x, y, z] = roofPoint(roofs[0], 1, 0.93, station, 0.1);
    const cap = [
      [x - width * 0.5, y + 0.2, z - depth * 0.31],
      [x - width * 0.42, y + 0.15, z + depth * 0.53],
      [x + width * 0.16, y + rise, z + depth * 0.4],
      [x + width * 0.52, y + rise + 0.08, z - depth * 0.49],
    ];
    face(out, 'roof', ...cap, [0.47, 0.437, 0.405]);
    face(out, 'lining', ...cap.toReversed().map(([a, b, c]) => [a, b - 0.028, c]), bamboo);
    if (level < 2) continue;
    for (const [a, b] of [
      [cap[0], cap[1]],
      [cap[1], cap[2]],
      [cap[2], cap[3]],
    ]) {
      beam(out, 'wood', [a[0], a[1] - 0.04, a[2]], [b[0], b[1] - 0.04, b[2]], 0.052, 0.045, wood);
    }
    for (const amount of [0.2, 0.8]) {
      const [a, b, c] = cap[2].map((value, i) => value + amount * (cap[3][i] - value));
      beam(out, 'wood', [a - 0.38, y - 0.28, c], [a, b - 0.04, c], 0.058, 0.052, wood);
    }
  }
}

function ellipse(x, y, z, rx, rz, sides) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (-2 * Math.PI * i) / sides;
    return [x + rx * Math.cos(angle), y, z + rz * Math.sin(angle)];
  });
}

function upright(out, x, z, tip, level, seed, carved, width = 1) {
  const foot = 0.028;
  const height = tip[1] - foot;
  if (!carved || level < 2) {
    beam(
      out,
      'wood',
      [x, foot, z],
      tip,
      (carved ? 0.2 : 0.075) * width,
      (carved ? 0.19 : 0.069) * width,
      wood,
    );
    return;
  }
  const profile = [
    [0, 0.15],
    [0.13, 0.146],
    [0.25, 0.13],
    [0.4, 0.188],
    [0.54, 0.156],
    [0.61, 0.115],
    [0.67, 0.192],
    [0.76, 0.188],
    [0.83, 0.108],
    [0.89, 0.104],
    [0.94, 0.144],
    [1, 0.132],
  ];
  const darkWood = [0.19, 0.135, 0.091];
  const rings = profile.map(([t, r]) => {
    const taper = width * (1 + (seed % 3) * 0.07 + 0.12 * Math.sin(seed + t * 9) * t * (1 - t));
    return ellipse(
      x + (tip[0] - x) * t,
      foot + height * t,
      z + (tip[2] - z) * t,
      r * taper,
      r * taper * 0.82,
      level === 3 ? 9 : 7,
    );
  });
  loft(out, 'wood', rings, width < 1 ? darkWood : wood);
  const maskStation = width < 1 ? 0.7 + 0.018 * (seed % 3) : 0.724;
  const faceX = x + (tip[0] - x) * maskStation;
  const faceZ = z + (tip[2] - z) * maskStation + 0.134 * width;
  const y = foot + height * maskStation;
  sphere(
    out,
    'wood',
    [faceX, y, faceZ],
    [0.101 * width, 0.18 * width, 0.072 * width],
    [0.31, 0.223, 0.152],
    7,
    4,
  );
  beam(
    out,
    'wood',
    [faceX - 0.067 * width, y - 0.077 * width, faceZ + 0.046 * width],
    [faceX + 0.066 * width, y - 0.075 * width, faceZ + 0.045 * width],
    0.028 * width,
    0.03 * width,
    [0.34, 0.25, 0.17],
  );
  if (level === 3 && width < 1) {
    const aged = [0.37, 0.29, 0.2];
    beam(
      out,
      'wood',
      [faceX, y + 0.077 * width, faceZ + 0.04 * width],
      [faceX + 0.016 * width, y - 0.035 * width, faceZ + 0.082 * width],
      0.029 * width,
      0.037 * width,
      aged,
    );
    for (const sign of [-1, 1]) {
      beam(
        out,
        'wood',
        [faceX + sign * 0.022 * width, y + 0.067 * width, faceZ + 0.059 * width],
        [faceX + sign * 0.094 * width, y + 0.05 * width, faceZ + 0.035 * width],
        0.024 * width,
        0.026 * width,
        aged,
      );
    }
  }
}

function supports(out, roof, level, index) {
  const placements = [
    [-1, 0.35, 0.88],
    [-1, 0.69, 0.77],
    [-1, 0.88, 0.56],
    [1, 0.33, 0.89],
    [1, 0.71, 0.78],
    [1, 0.88, 0.56],
  ];
  placements.forEach(([side, u, v], i) => {
    if (level === 0 && i % 3 === 2) return;
    const tip = roofPoint(roof, side, u, v, -0.14);
    upright(
      out,
      tip[0] + (i % 2 ? -0.17 : 0.12),
      tip[2] + 0.15,
      tip,
      level,
      index * 6 + i,
      i < 2 || i === 3 || i === 4,
    );
  });
  if (index !== 1 || level < 2) return;
  // The tall gable is held up by several rows of slender leaning carvings.
  // Keep the open route between the two main front posts and the inner grille.
  const middlePosts = [
    [-1, 0.16, 0.88, -1.02, 3.97, 0.73],
    [-1, 0.26, 0.74, -1.44, 2.99, 0.71],
    [-1, 0.51, 0.86, -2.55, 3.98, 0.65],
    [-1, 0.72, 0.94, -3.49, 4.12, 0.55],
    [1, 0.16, 0.89, 1.01, 4.09, 0.78],
    [1, 0.29, 0.73, 1.58, 2.94, 0.71],
    [1, 0.51, 0.87, 2.78, 3.92, 0.59],
    [1, 0.75, 0.92, 4.02, 4.1, 0.52],
  ];
  for (const [i, [side, u, v, x, z, width]] of middlePosts.entries()) {
    const tip = roofPoint(roof, side, u, v, -0.14);
    upright(out, x, z, tip, level, 37 + i, width > 0.61, width);
  }
}

const profile = [
  [0.08, 0.1, 0.1],
  [0.45, 0.06, 0.1],
  [0.58, -0.49, 0.5],
  [0.82, -0.68, 0.57],
  [1.1, -0.72, 0.59],
  [1.38, -0.61, 0.44],
  [1.63, -0.35, 0.29],
  [1.9, -0.47, 0.29],
  [2.16, -0.61, 0.51],
  [2.37, -0.54, 0.56],
  [2.57, -0.32, 0.37],
  [2.7, -0.06, 0.12],
  [2.75, 0.02, 0.02],
  [3.04, 0.05, 0.05],
  [3.52, 0.06, 0.06],
  [3.94, 0.1, 0.1],
];

function wallFront(x, y) {
  const broad = 1.8 + 0.16 * Math.sin(x * 1.7) + 0.15 * Math.cos(y * 2.3 + x * 0.75);
  return broad + 0.23 * Math.cos(x * 3.1 - y * 1.9) + 0.31 * Math.max(0, 1 - y / 1.2);
}

function entranceWall(out, level) {
  const slices = [1, 5, 9, 14][level];
  const levels =
    level === 0 ? profile.filter((_, i) => [0, 2, 3, 6, 8, 9, 11, 15].includes(i)) : profile;
  for (const side of [-1, 1])
    for (let j = 1; j < levels.length; j++) {
      const [y0, l0, r0] = levels[j - 1],
        [y1, l1, r1] = levels[j];
      const p = (t, y, a, b, back = 0) => {
        const inner = side < 0 ? a : b;
        const x = inner + (-3.85 * Number(side < 0) + 3.97 * Number(side > 0) - inner) * t;
        const taper = Math.max(0, (Math.abs(x) - 0.85) / 3.13);
        return [x, y * (1 - 0.51 * taper * taper), wallFront(x, y) - back];
      };
      for (let i = 0; i < slices; i++) {
        const u = i / slices,
          v = (i + 1) / slices;
        const corners = [p(u, y0, l0, r0), p(v, y0, l0, r0), p(v, y1, l1, r1), p(u, y1, l1, r1)];
        if (side < 0) corners.reverse();
        const color = clay.map((c) => c * (0.94 + ((i * 3 + j) % 7) * 0.018));
        for (const p of [
          [corners[0], corners[1], corners[2]],
          [corners[0], corners[2], corners[3]],
        ])
          out.addTriangle('earth', palette, p, normalFor(...p), [], color);
      }
      const a = p(0, y0, l0, r0),
        b = p(0, y1, l1, r1);
      const c = p(0, y1, l1, r1, 0.4),
        d = p(0, y0, l0, r0, 0.4);
      if (Math.abs(r0 - l0) > 0.015 || Math.abs(r1 - l1) > 0.015) {
        if (side < 0) face(out, 'earth', a, b, c, d, oxide);
        else face(out, 'earth', d, c, b, a, oxide);
      }
    }
  for (let j = 1; j < levels.length; j++) {
    const [y0, l0, r0] = levels[j - 1],
      [y1, l1, r1] = levels[j];
    if (y0 >= 0.58 && y1 <= 2.7) continue;
    if (Math.abs(r0 - l0) + Math.abs(r1 - l1) < 0.001) continue;
    const q = [
      [l0, y0],
      [r0, y0],
      [r1, y1],
      [l1, y1],
    ].map(([x, y]) => [x, y, wallFront(x, y)]);
    if (r0 === l0 || r1 === l1) {
      const p = r0 === l0 ? [q[0], q[2], q[3]] : [q[0], q[1], q[2]];
      out.addTriangle('earth', palette, p, normalFor(...p), [], clay);
    } else face(out, 'earth', ...q, clay);
  }
  for (let j = 0; j < 3; j++)
    box(
      out,
      'earth',
      [-0.85 + j * 0.06, 0.02 + j * 0.16, 1.72],
      [0.78 - j * 0.04, 0.17 + j * 0.16, 2.93 - j * 0.28],
      accent,
    );
}

function entranceGrille(out, level) {
  const iron = [0.264, 0.226, 0.164];
  const inset = (x, y, depth = 0) => [x, y, wallFront(x, y) - 0.245 + depth];
  const wire = (path, width = 0.013, depth = 0) => {
    beamPath(
      out,
      'grille',
      path.map(([x, y]) => inset(x, y, depth)),
      width,
      width,
      iron,
    );
  };
  const aperture = profile.filter(([y]) => y >= 0.58 && y <= 2.7);
  for (const edge of [1, 2]) {
    wire(
      aperture.map((row) => [row[edge] * 0.96, row[0]]),
      0.024,
    );
  }
  wire(
    [
      [-0.29, 0.59],
      [-0.14, 0.92],
      [-0.17, 1.39],
      [0.08, 1.72],
      [0.02, 2.16],
      [0.14, 2.64],
    ],
    0.016,
  );
  wire(
    [
      [0.29, 0.59],
      [0.28, 0.95],
      [0.02, 1.38],
      [-0.12, 1.75],
      [-0.22, 2.19],
      [-0.18, 2.61],
    ],
    0.015,
    -0.025,
  );

  // The inset ironwork is a tangle of irregular scrolls over the dark interior.
  const curls = [
    [-0.28, 0.83, 0.16, 0.17, 0.85, 1],
    [0.23, 1.04, 0.22, 0.2, 2.8, -1],
    [-0.31, 1.22, 0.23, 0.23, 2.5, 1],
    [0.16, 1.4, 0.18, 0.18, 4.8, 1],
    [-0.13, 1.72, 0.17, 0.18, 0.17, -1],
    [0.18, 2.14, 0.22, 0.25, 3.3, 1],
    [-0.21, 2.32, 0.22, 0.24, 4.0, -1],
    [0.0, 0.76, 0.19, 0.15, 1.5, -1],
    [0.42, 1.17, 0.13, 0.16, 3.65, 1],
    [-0.07, 1.06, 0.12, 0.15, 5.35, 1],
    [-0.34, 1.43, 0.16, 0.21, 1.3, -1],
    [0.02, 1.96, 0.17, 0.15, 2.28, 1],
    [0.29, 2.42, 0.15, 0.15, 2.9, -1],
    [0.015, 2.54, 0.14, 0.12, 4.6, 1],
  ];
  const samples = level === 2 ? 11 : 18;
  for (const [x, y, rx, ry, start, direction] of curls.slice(0, level === 2 ? 7 : curls.length)) {
    const path = Array.from({ length: samples + 1 }, (_, i) => {
      const t = i / samples;
      const a = start + direction * t * 2.43 * Math.PI;
      const radius = 1 - 0.87 * t;
      return [x + Math.cos(a) * rx * radius, y + Math.sin(a) * ry * radius];
    });
    wire(path, 0.013, -0.01);
  }
}

function lobe(out, center, radii, shade, level) {
  sphere(
    out,
    'earth',
    center,
    radii,
    shade,
    level === 0 ? 4 : level === 1 ? 6 : 10,
    level < 2 ? 3 : 5,
  );
}

function branch(out, points, sizes, color, level) {
  const sides = level === 0 ? 4 : level === 1 ? 5 : 8;
  const rings = points.map(([x, y, z], i) => {
    const a = points[Math.max(i - 1, 0)],
      b = points[Math.min(i + 1, points.length - 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2],
      d = Math.hypot(dx, dz) || 1;
    const nx = dz / d,
      nz = -dx / d;
    const direction = Math.hypot(dx, dy, dz) || 1;
    const vertical = [(-dy * dx) / (d * direction), d / direction, (-dy * dz) / (d * direction)];
    return Array.from({ length: sides }, (_, j) => {
      const t = (-2 * Math.PI * j) / sides;
      const rad = sizes[i];
      return [
        x + rad * (nx * Math.cos(t) + vertical[0] * Math.sin(t)),
        y + rad * vertical[1] * Math.sin(t),
        z + rad * (nz * Math.cos(t) + vertical[2] * Math.sin(t)),
      ];
    });
  });
  loft(out, 'earth', rings, color);
}

function reliefs(out, level) {
  for (const [x, y, rx, ry] of [
    [-3.01, 1.41, 0.8, 1.06],
    [-2.51, 2.64, 0.71, 0.87],
    [-1.85, 3.36, 0.47, 0.79],
    [1.66, 1.27, 0.68, 1.12],
    [2.44, 2.41, 0.76, 1.37],
    [3.28, 2.96, 0.56, 0.94],
  ])
    lobe(out, [x, y, wallFront(x, y)], [rx, ry, 0.44], x < 0 ? accent : oxide, level);
  // Left wing's rising vegetal relief. Nested lobes and curved arms keep the scooped form.
  for (const [x, y, z, rx, ry, rz] of [
    [-8.77, 1.55, 1.08, 1.19, 1.54, 0.71],
    [-7.68, 2.05, 1.47, 0.99, 1.17, 0.78],
    [-9.54, 2.91, 1.28, 0.69, 0.91, 0.55],
    [-8.44, 3.62, 1.18, 0.72, 0.68, 0.46],
    [-7.74, 3.87, 1.12, 0.39, 0.43, 0.43],
    [-9.12, 3.93, 1.28, 0.54, 0.47, 0.41],
    [-8.95, 0.64, 2.29, 1.09, 0.52, 0.68],
    [-7.5, 0.46, 2.38, 0.73, 0.35, 0.65],
  ])
    lobe(out, [x, y, z], [rx, ry, rz], x < -8.5 ? clay : accent, level);
  branch(
    out,
    [
      [-9.56, 0.37, 2.22],
      [-10.38, 0.49, 2.6],
      [-10.72, 0.78, 3.0],
      [-10.93, 1.03, 3.05],
    ],
    [0.29, 0.23, 0.16, 0.065],
    oxide,
    level,
  );
  branch(
    out,
    [
      [-8.23, 1.24, 1.9],
      [-8.19, 1.9, 2.65],
      [-8.6, 2.81, 2.92],
      [-9.17, 3.1, 2.79],
    ],
    [0.34, 0.27, 0.17, 0.09],
    accent,
    level,
  );
  // Elephant forehead and ears under the right gable.
  lobe(out, [8.91, 2.45, 1.61], [1.1, 0.99, 0.74], oxide, level);
  lobe(out, [7.91, 2.73, 1.48], [0.66, 0.69, 0.28], accent, level);
  lobe(out, [9.86, 2.7, 1.49], [0.67, 0.71, 0.3], clay, level);
  if (level > 0) return;
  for (const side of [-1, 1])
    branch(
      out,
      [
        [8.87 + side * 0.53, 2.07, 2.0],
        [8.86 + side * 0.71, 1.99, 2.73],
        [8.9 + side * 0.87, 2.22, 3.35],
        [8.95 + side * 0.94, 2.57, 3.66],
      ],
      [0.2, 0.15, 0.087, 0.035],
      pale,
      level,
    );
  branch(
    out,
    [
      [8.96, 2.51, 2.09],
      [8.99, 2.12, 2.84],
      [9.26, 2.31, 3.28],
      [9.67, 2.56, 3.51],
    ],
    [0.37, 0.31, 0.18, 0.1],
    clay,
    level,
  );
  branch(
    out,
    [
      [8.8, 2.98, 1.79],
      [8.35, 3.63, 2.02],
      [7.55, 3.98, 2.93],
      [6.73, 4.42, 3.32],
    ],
    [0.31, 0.24, 0.15, 0.055],
    accent,
    level,
  );
  branch(
    out,
    [
      [9.08, 3.08, 1.43],
      [9.6, 3.55, 1.87],
      [10.33, 3.94, 2.54],
      [10.85, 4.14, 3.28],
    ],
    [0.29, 0.22, 0.14, 0.055],
    clay,
    level,
  );
}

function waterlilyRelief(out, level) {
  // The clay waterlily curls into a deep center beside the joined hands.
  const center = [-10.05, 1.59, 2.03];
  const bowlSegments = [0, 16, 24, 36][level];
  const bowlProfile = [
    [0.045, -0.088, 0.38],
    [0.17, -0.036, 0.66],
    [0.39, 0.063, 0.79],
    [0.65, 0.151, 0.87],
    [0.88, 0.267, 0.97],
    [0.964, 0.29, 1],
    [0.923, 0.103, 0.88],
    [0.71, -0.116, 0.82],
  ];
  const bowl = bowlProfile.map(([radius, depth]) =>
    Array.from({ length: bowlSegments }, (_, i) => {
      const angle = (i * 2 * Math.PI) / bowlSegments;
      const edge = radius * (1 + 0.055 * Math.sin(angle * 2 + 0.6));
      return [
        center[0] - 0.16 * radius * radius + edge * Math.cos(angle),
        center[1] + 1.13 * edge * Math.sin(angle),
        center[2] + depth,
      ];
    }),
  );
  for (let j = 1; j < bowl.length; j++) {
    const inner = bowl[j - 1];
    const outer = bowl[j];
    const color = clay.map((value) => value * bowlProfile[j - 1][2]);
    for (let i = 0; i < bowlSegments; i++) {
      const next = (i + 1) % bowlSegments;
      face(out, 'earth', inner[i], outer[i], outer[next], inner[next], color);
    }
  }
  out.addConvexPolygon(
    'earth',
    palette,
    bowl[0],
    [0, 0, 1],
    (point) => [point[0], point[1]],
    [0.11, 0.051, 0.037],
  );
  const stations = [0, 36, 54, 78][level];
  const profile = [
    [-0.052, -0.125],
    [-0.051, 0.008],
    [-0.01, 0.063],
    [0.059, 0.039],
    [0.128, -0.117],
    [0.056, -0.18],
  ];
  const rings = Array.from({ length: stations + 1 }, (_, i) => {
    const t = i / stations;
    const angle = 0.79 + t * 3.08 * 2 * Math.PI;
    const radius = 0.07 + t * (0.83 + 0.055 * Math.sin(angle * 0.53));
    const lean = -0.16 * t * t;
    const depth = 0.07 + 0.55 * t + 0.041 * Math.sin(angle - 1.7) * t;
    const taper = (0.48 + 0.69 * t) * (1 - 0.46 * Math.max(0, (t - 0.93) / 0.07));
    return profile.map(([across, lip]) => {
      const r = radius + across * taper;
      return [
        center[0] + lean + r * Math.cos(angle),
        center[1] + 1.13 * r * Math.sin(angle),
        center[2] + depth + lip * taper,
      ];
    });
  });
  loft(out, 'earth', rings, [0.53, 0.261, 0.188]);
}

function greetingRelief(out, level) {
  const hand = [0.47, 0.295, 0.167];
  const fingers = [0.526, 0.373, 0.219];
  // The two forearms converge on a vertical pair of closed fists under the left gable.
  branch(
    out,
    [
      [-9.18, 1.12, 1.65],
      [-9.78, 2.12, 2.52],
      [-9.24, 2.91, 3.21],
      [-8.59, 3.83, 3.47],
      [-8.38, 4.11, 3.52],
    ],
    [0.242, 0.191, 0.141, 0.108, 0.114],
    hand,
    level,
  );
  branch(
    out,
    [
      [-7.25, 1.75, 2.02],
      [-6.84, 2.6, 3.75],
      [-7.21, 3.27, 3.91],
      [-7.75, 3.76, 3.79],
      [-8.29, 4.1, 3.57],
      [-8.37, 4.34, 3.52],
    ],
    [0.251, 0.176, 0.139, 0.128, 0.107, 0.101],
    hand,
    level,
  );
  for (const [y, size] of [
    [4.1, 0.183],
    [4.365, 0.17],
  ]) {
    lobe(out, [-8.41, y, 3.56], [0.194, size, 0.146], hand, level);
    if (level >= 2)
      for (const step of [-1, 0, 1]) {
        const bend = y + step * 0.059;
        branch(
          out,
          [
            [-8.56, bend, 3.594],
            [-8.48, bend + 0.013, 3.682],
            [-8.36, bend + 0.015, 3.691],
            [-8.275, bend, 3.619],
          ],
          [0.029, 0.035, 0.033, 0.02],
          fingers,
          level,
        );
      }
  }
}

function elephantAndRisingFigure(out, level) {
  // The trunk and pale tusks have separate silhouettes in the Trust's side view.
  branch(
    out,
    [
      [8.97, 2.33, 2.04],
      [9.03, 1.79, 2.68],
      [9.16, 1.78, 3.46],
      [9.31, 2.0, 4.07],
      [9.36, 2.48, 4.56],
    ],
    [0.35, 0.31, 0.23, 0.14, 0.04],
    clay,
    level,
  );
  for (const side of [-1, 1]) {
    branch(
      out,
      [
        [8.89 + side * 0.53, 2.19, 2.02],
        [8.94 + side * 0.66, 2.01, 2.71],
        [9.01 + side * 0.81, 2.08, 3.45],
        [9.12 + side * 0.84, 2.36, side < 0 ? 4.35 : 4.15],
      ],
      [0.17, 0.137, 0.085, 0.022],
      pale,
      level,
    );
  }
  // Ọbàtálá rises from the forehead. The two long arms sweep into the forecourt.
  branch(
    out,
    [
      [8.83, 3.12, 1.89],
      [8.76, 3.26, 2.48],
      [8.62, 3.53, 3.06],
      [8.54, 3.95, 3.81],
      [8.58, 4.42, 4.16],
    ],
    [0.36, 0.36, 0.29, 0.213, 0.15],
    accent,
    level,
  );
  for (const side of [-1, 1]) {
    const upper = side > 0 ? 0.2 : -0.05;
    branch(
      out,
      [
        [8.55 + side * 0.15, 3.92 + upper, 3.58],
        [8.54 + side * 0.38, 3.87 + upper, 4.04],
        [8.47 + side * 0.52, 3.91 + upper, 4.42],
        [8.42 + side * 0.61, 4.11 + upper, 4.9],
        [8.35 + side * 0.66, 4.28 + upper, 5.23],
      ],
      [0.17, 0.15, 0.12, 0.07, 0.023],
      accent,
      level,
    );
  }
  lobe(out, [8.55, 4.58, 4.23], [0.32, 0.28, 0.31], accent, level);
  lobe(out, [8.52, 4.52, 4.43], [0.33, 0.11, 0.29], clay, level);
  if (level > 1) {
    lobe(out, [8.71, 4.68, 4.06], [0.22, 0.195, 0.25], clay, level);
    lobe(out, [8.48, 4.72, 4.23], [0.215, 0.12, 0.18], accent, level);
    // Carved folds link the rising figure to the broad mass above the elephant's ear.
    for (const side of [-1, 1]) {
      branch(
        out,
        [
          [8.78 + side * 0.26, 3.37, 2.36],
          [8.77 + side * 0.42, 3.59, 2.24],
          [8.73 + side * 0.46, 3.78, 2.14],
        ],
        [0.16, 0.104, 0.036],
        clay,
        level,
      );
    }
  }
}

function forecourtRelief(out, level) {
  // The fallen-looking stone outside the elephant wing remains a distinct low silhouette.
  if (level === 0) return;
  const mossyStone = [0.38, 0.36, 0.28];
  const sections = [
    [6.13, 4.85, 0.42, 0.085, 0.12],
    [6.48, 4.76, 0.53, 0.3, 0.31],
    [7.2, 4.69, 0.53, 0.39, 0.36],
    [8.0, 4.66, 0.38, 0.55, 0.4],
    [8.57, 4.72, 0.46, 0.49, 0.37],
    [9.37, 4.55, 0.51, 0.33, 0.33],
    [10.06, 4.39, 0.35, 0.29, 0.27],
    [10.31, 4.34, 0.14, 0.12, 0.18],
  ];
  const sides = level < 2 ? 5 : 9;
  loft(
    out,
    'floor',
    sections.map(([x, z, y, spread, rise]) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = (i * 2 * Math.PI) / sides;
        return [x, y - rise * Math.sin(angle), z + spread * Math.cos(angle)];
      }),
    ),
    mossyStone,
  );
  sphere(out, 'floor', [8.0, 0.74, 4.76], [0.54, 0.57, 0.48], stone, level < 2 ? 6 : 10, 5);
  if (level < 2) return;
  // Paired carved flares wrap the rounded middle and leave a low point toward the forecourt.
  const band = [0.49, 0.445, 0.34];
  for (const side of [-1, 1]) {
    const path = [
      [8 + side * 0.94, 0.79, 4.68],
      [8 + side * 0.74, 0.61, 5.04],
      [8 + side * 0.47, 0.38, 5.27],
      [8 + side * 0.2, 0.17, 5.3],
    ];
    beamPath(out, 'floor', path, 0.12, 0.085, band);
  }
}

function interior(out, level) {
  const left = -3.9;
  const bays = 32;
  const stride = 7.8 / bays;
  const depths = Array.from(
    { length: bays + 1 },
    (_, i) => -3.43 + 0.16 * Math.sin(i * 0.58) + 0.069 * Math.sin(i * 1.43),
  );
  const surface = (x, y, inset = 0) => {
    const station = (x - left) / stride;
    const i = Math.max(0, Math.min(bays - 1, Math.floor(station)));
    return [x, y, depths[i] + (depths[i + 1] - depths[i]) * (station - i) + inset];
  };
  const wall = [0.46, 0.38, 0.27];
  const boneWhite = [0.72, 0.675, 0.51];
  const redWash = [0.43, 0.188, 0.139];
  const charcoal = [0.168, 0.151, 0.103];
  for (let i = 0; i < bays; i++) {
    const a = left + i * stride;
    const b = a + stride;
    face(
      out,
      'earth',
      surface(a, 0.32),
      surface(b, 0.32),
      surface(b, 24),
      surface(a, 24),
      wall.map((value) => value * (0.91 + 0.15 * Math.sin(i * 2.3) ** 2)),
    );
    face(
      out,
      'earth',
      surface(a, 0.045, 0.23),
      surface(b, 0.045, 0.23),
      surface(b, 0.32),
      surface(a, 0.32),
      wall,
    );
  }
  for (const x of [left, -left]) {
    const back = surface(x, 0.045);
    const front = [x, 0.045, 0.72];
    const returnWall = [back, front, [x, 24, 0.72], surface(x, 24)];
    if (x < 0) returnWall.reverse();
    face(out, 'earth', ...returnWall, wall);
  }
  // Broad looping bands and rows of light dashes follow the photographed hand-painted plaster.
  const strip = (points, width, tint, inset) => {
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const scale = width / (2 * Math.hypot(dx, dy));
      const na = [-dy * scale, dx * scale];
      face(
        out,
        'earth',
        surface(a[0] + na[0], a[1] + na[1], inset),
        surface(a[0] - na[0], a[1] - na[1], inset),
        surface(b[0] - na[0], b[1] - na[1], inset),
        surface(b[0] + na[0], b[1] + na[1], inset),
        tint,
      );
    }
  };
  for (let i = 0; i < 7; i++) {
    const x = -3.13 + 1.045 * i;
    const y = 1.44 + 0.29 * Math.sin(i * 2.1);
    const sides = level === 3 ? 22 : 12;
    for (const [rx, ry, tint] of [
      [0.36, 0.62, boneWhite],
      [0.253, 0.45, i % 2 ? redWash : charcoal],
      [0.12, 0.27, boneWhite],
    ]) {
      const loop = Array.from({ length: sides + 1 }, (_, j) => {
        const angle = (j * 2 * Math.PI) / sides;
        const irregularity = 1 + 0.052 * Math.cos(5 * angle + i);
        const lean = 0.11 * ((i % 3) - 1) * Math.sin(angle);
        return [
          x + rx * Math.cos(angle) * irregularity + lean,
          y + ry * Math.sin(angle) * irregularity,
        ];
      });
      strip(loop, 0.054, tint, 0.026);
    }
    if (i % 3 === 1) {
      strip(
        [
          [x - 0.07, y - 0.11],
          [x + 0.07, y + 0.11],
        ],
        0.033,
        redWash,
        0.03,
      );
      strip(
        [
          [x + 0.06, y - 0.11],
          [x - 0.06, y + 0.11],
        ],
        0.033,
        redWash,
        0.033,
      );
    }
    if (level === 3) {
      for (let j = 0; j < 9; j++) {
        const angle = j * 2.4 + i;
        const start = [x + 0.32 * Math.cos(angle), 2.18 + j * 0.103];
        strip(
          [start, [start[0] + 0.022 * Math.sin(angle), start[1] + 0.052]],
          0.042,
          boneWhite,
          0.03,
        );
      }
    }
  }
  for (const [i, [x, z]] of [
    [-2.23, -1.82],
    [-0.89, -0.88],
    [0.96, -1.43],
    [2.31, -2.1],
  ].entries()) {
    const tipX = x + (i % 2 ? -0.24 : 0.18);
    upright(out, x, z, [tipX, reliefHeight(tipX, 8, z), z - 0.04], level, 31 + i, true, 0.68);
  }
}

function build(out, level) {
  const rear = [
    [-11.8, 0.04, -3.81],
    [11.3, 0.04, -3.81],
    [11.3, 1.47, -3.81],
    [-11.8, 1.47, -3.81],
  ];
  face(out, 'earth', ...rear.toReversed(), oxide);
  face(out, 'earth', ...rear, clay);
  box(out, 'earth', [-10.62, 0.06, -3.81], [-5.24, 1.2, 0.78], oxide);
  box(out, 'earth', [5.22, 0.06, -3.82], [10.84, 1.2, 0.78], oxide);
  if (level < 2) box(out, 'wood', [-1.1, 0.1, -0.62], [1.1, 3.13, -0.46], [0.105, 0.08, 0.057]);
  box(out, 'floor', [-12.0, -0.18, -4.3], [11.8, 0.04, 3.17], stone);
  box(out, 'floor', [-4.5, -0.11, 3.0], [4.5, 0.036, 4.48], moss);
  const sheltered = beneathRoof(out);
  entranceWall(sheltered, level);
  if (level >= 2) {
    entranceGrille(sheltered, level);
    interior(sheltered, level);
  }
  roofs.forEach((roof, index) => {
    roofShell(out, roof, level);
    supports(out, roof, level, index);
  });
  valleyCovers(out, level);
  reliefs(sheltered, level);
  if (level > 0) {
    waterlilyRelief(sheltered, level);
    greetingRelief(sheltered, level);
    elephantAndRisingFigure(out, level);
  }
  forecourtRelief(out, level);
  if (level > 0) {
    for (const [x, z] of [
      [-3.3, 3.31],
      [3.2, 3.36],
    ]) {
      box(out, 'wood', [x - 1.1, 0.49, z - 0.19], [x + 1.1, 0.57, z + 0.2], [0.43, 0.3, 0.16]);
      for (const dx of [-0.81, 0.81])
        box(out, 'wood', [x + dx - 0.07, 0.04, z - 0.13], [x + dx + 0.075, 0.49, z + 0.13], wood);
    }
  }
}

export const buildMaster = (out) => build(out, 3);
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
