import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const surfaces = {
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.12 },
  soffit: { slot: 'wall', graph: 'bamboo', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  plaster: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
};

const white = 'palette:#ffffff';
const bronze = [0.53, 0.32, 0.22];
const zinc = [0.44, 0.46, 0.39];
const moss = [0.37, 0.38, 0.23];
const bamboo = [0.41, 0.3, 0.185];
const timber = [0.38, 0.28, 0.16];
const clay = [0.59, 0.36, 0.25];
const ochre = [0.57, 0.44, 0.29];
const stone = [0.45, 0.41, 0.33];
const blend = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

function triangle(out, surface, points, color, normal = normalFor(...points)) {
  out.addTriangle(
    surface,
    white,
    points,
    normal,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
}

function quad(out, surface, [a, b, c, d], color, uv) {
  if (uv) {
    out.addTriangle(surface, 'metric:uv', [a, b, c], normalFor(a, b, c), uv.slice(0, 3), color);
    out.addTriangle(
      surface,
      'metric:uv',
      [a, c, d],
      normalFor(a, c, d),
      [uv[0], uv[2], uv[3]],
      color,
    );
  } else {
    triangle(out, surface, [a, b, c], color);
    triangle(out, surface, [a, c, d], color);
  }
}

// The narrow beak rises toward the river approach (+Z); its lower corners are set back.
function beak(side, u, v) {
  const ridge = 3.98 + 0.47 * v + 2.87 * Math.pow(v, 4.2);
  const eave = 2.49 - 1.78 * Math.pow(v, 2.1) + (side === 1 ? -0.12 : 0.1);
  const width = (side === 1 ? 6.36 : 6.08) * (0.77 + 0.23 * v);
  return [
    side * width * u - 0.35 * v + 0.11 * Math.sin(v * Math.PI),
    eave + (ridge - eave) * Math.pow(1 - u, 1.21),
    -6.15 + (14.08 - 2.81 * u * u) * v,
  ];
}

function wing(side, u, v) {
  const seam = beak(side, 1, v);
  const outside = [
    side * ((side === 1 ? 13.7 : 11.9) - 0.65 * Math.abs(2 * v - 1)),
    2.15 + 0.82 * Math.sin(Math.PI * v) - 0.17 * Math.pow(v, 3),
    -6.35 + (side === 1 ? 9.08 : 10.15) * v,
  ];
  const [x, y, z] = blend(seam, outside, u);
  const rise = (0.48 + 1.05 * v) * Math.sin(Math.PI * u);
  return [x, y + rise, z];
}

function roofAt(x, z) {
  let back = 0;
  let front = 1;
  let point;
  for (let iteration = 0; iteration < 14; iteration++) {
    const v = (back + front) / 2;
    const ridge = beak(1, 0, v);
    const side = x < ridge[0] ? -1 : 1;
    const seam = beak(side, 1, v);
    const outside = wing(side, 1, v);
    if (side * x <= side * seam[0]) {
      point = beak(side, (x - ridge[0]) / (seam[0] - ridge[0]), v);
    } else {
      const u = Math.min(1, (x - seam[0]) / (outside[0] - seam[0]));
      point = wing(side, u, v);
    }
    if (point[2] < z) back = v;
    else front = v;
  }
  return point[1];
}

function fitWall([x, y, z], height) {
  const base = 0.24;
  const scale = Math.min(1, (roofAt(x, z) - 0.17 - base) / (height - base));
  return [x, base + (y - base) * scale, z];
}

function sheet(out, point, side, acrossSteps, longSteps, warm, outside) {
  for (let j = 0; j < longSteps; j++) {
    for (let i = 0; i < acrossSteps; i++) {
      const u = i / acrossSteps,
        nextU = (i + 1) / acrossSteps;
      const v = j / longSteps,
        nextV = (j + 1) / longSteps;
      const stations = [
        [u, v],
        [u, nextV],
        [nextU, nextV],
        [nextU, v],
      ];
      if (side < 0) stations.reverse();
      const corners = stations.map(([s, t]) => point(side, s, t));
      const uv = stations.map(([s, t]) => [s * 7.0, t * 12.0]);
      const patina = 0.33 + 0.21 * Math.sin(8.7 * u + 3.1 * v + side);
      const color = blend(warm, j % 3 ? zinc : moss, patina);
      quad(out, 'roof', corners, color, uv);
      const lower = corners.map(([x, y, z]) => [x, y - 0.115, z]).reverse();
      quad(out, 'soffit', lower, bamboo, uv.toReversed());
      if (j === 0 || j === longSteps - 1 || (outside && i === acrossSteps - 1)) {
        const seam = (
          j === 0
            ? [
                [u, v],
                [nextU, v],
              ]
            : j === longSteps - 1
              ? [
                  [nextU, nextV],
                  [u, nextV],
                ]
              : [
                  [nextU, v],
                  [nextU, nextV],
                ]
        ).map(([s, t]) => point(side, s, t));
        if (side < 0) seam.reverse();
        const [a, b] = seam;
        quad(out, 'wood', [a, b, [b[0], b[1] - 0.115, b[2]], [a[0], a[1] - 0.115, a[2]]], timber);
      }
    }
  }
}

const towerProfile = [
  [3.29, 1.97, 1.77],
  [4.34, 1.62, 1.42],
  [5.85, 1.17, 1.03],
  [7.35, 0.66, 0.58],
  [8.6, 0.29, 0.29],
  [9.58, 0.09, 0.1],
];

function tower(out, sides, detailed) {
  const ring = (row, i) => {
    const [y, w, d] = towerProfile[row];
    const t = (i / sides) * Math.PI * 2;
    return [1.48 - (0.27 * row) / 5 + w * Math.cos(t), y, -2.68 + d * Math.sin(t)];
  };
  for (let row = 1; row < towerProfile.length; row++) {
    for (let facet = 0; facet < sides; facet++) {
      const points = [
        ring(row - 1, facet),
        ring(row, facet),
        ring(row, facet + 1),
        ring(row - 1, facet + 1),
      ];
      const a = (facet * 8) / sides,
        b = ((facet + 1) * 8) / sides;
      quad(out, 'roof', points, blend(bronze, zinc, 0.35 + 0.18 * Math.sin(facet * 1.7 + row)), [
        [a, towerProfile[row - 1][0]],
        [a, towerProfile[row][0]],
        [b, towerProfile[row][0]],
        [b, towerProfile[row - 1][0]],
      ]);
    }
  }
  beam(out, 'wood', [1.21, 9.51, -2.68], [1.13, 9.97, -2.69], 0.093, 0.084, timber);
  const diamond = [
    [1.14, 9.82, -2.69],
    [1.79, 10.42, -2.61],
    [1.28, 10.98, -2.72],
    [0.62, 10.43, -2.8],
  ];
  quad(out, 'roof', diamond, bronze);
  quad(out, 'roof', diamond.map(([x, y, z]) => [x, y, z - 0.045]).reverse(), bronze);
  if (detailed) {
    const top = [1.27, 10.37, -2.73];
    beam(out, 'wood', [0.76, 10.42, -2.82], top, 0.045, 0.045, timber);
    beam(out, 'wood', top, [1.65, 10.4, -2.64], 0.045, 0.045, timber);
  }
}

function slab(out, detail) {
  const perimeter = [
    [-12.1, -5.9],
    [-5.6, -6.2],
    [0.1, -6.45],
    [10.8, -6],
    [13.0, -4.71],
    [12.8, 3.3],
    [6.14, 4.95],
    [4.6, 6.21],
    [2.44, 7.15],
    [-0.8, 7.42],
    [-3.65, 6.99],
    [-5.38, 5.74],
    [-6.36, 4.81],
    [-11.4, 3.85],
  ];
  const outline = perimeter.flatMap((a, i) => {
    const b = perimeter[(i + 1) % perimeter.length];
    if (detail < 2 || Math.min(a[1], b[1]) < 4.8) return [a];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (detail > 2 ? 0.58 : 1.04));
    return Array.from({ length: count }, (_, step) => {
      const [x, z] = blend(a, b, step / count);
      return [x, z + 0.07 * Math.sin((Math.PI * step) / count) * Math.sin(x * 8.2)];
    });
  });
  const lift = ([x, z]) => [x, 0.24 + 0.045 * Math.sin(0.52 * x), z];
  const plan = outline.map((p) => new Vector2(...p));
  for (const ids of ShapeUtils.triangulateShape(plan, [])) {
    const points = ids.map((i) => lift(outline[i]));
    triangle(out, 'stone', points, blend(stone, ochre, 0.23 + 0.06 * Math.sin(ids[1])), [0, 1, 0]);
  }
  for (let i = 0; i < outline.length; i++) {
    const a = lift(outline[i]),
      b = lift(outline[(i + 1) % outline.length]);
    if (Math.min(a[2], b[2]) < 4.8) {
      quad(out, 'stone', [a, b, [b[0], 0.018, b[2]], [a[0], 0.018, a[2]]], stone);
      continue;
    }
    const lower = ([x, , z]) => [x, 0.102 + 0.029 * Math.sin(x * 2.1), z];
    const rim = ([x, y, z]) => {
      const width = Math.min(1, Math.max(0, (z - 4.95) / 0.8));
      const wear = 0.018 + 0.018 * Math.sin(x * 3.7);
      return [
        x + 0.019 * x * width,
        y + width * 0.007 * Math.sin(x * 3),
        z + (0.31 + wear) * width,
      ];
    };
    const lowerA = lower(a);
    const lowerB = lower(b);
    const outerA = rim(lowerA);
    const outerB = rim(lowerB);
    const damp = blend(stone, moss, 0.31 + 0.15 * Math.sin(a[0] * 1.14));
    const tread = blend(stone, ochre, 0.34);
    quad(out, 'stone', [a, b, lowerB, lowerA], blend(damp, ochre, 0.24));
    if (outerB[2] !== lowerB[2]) triangle(out, 'stone', [lowerA, lowerB, outerB], tread);
    if (outerA[2] !== lowerA[2]) triangle(out, 'stone', [lowerA, outerB, outerA], tread);
    quad(
      out,
      'stone',
      [outerA, outerB, [outerB[0], 0.018, outerB[2]], [outerA[0], 0.018, outerA[2]]],
      damp,
    );
  }
}

// Each opening has freeform local XY coordinates. Panels have a deep reveal and a curved face.
const bays = [
  {
    outline: [
      [-11.9, 0.23],
      [-11.65, 2.21],
      [-8.72, 2.69],
      [-5.77, 2.79],
      [-5.53, 0.24],
    ],
    holes: [
      [
        [-11.17, 1.36],
        [-10.96, 1.92],
        [-10.24, 2.04],
        [-9.62, 1.85],
        [-9.57, 1.45],
        [-9.93, 1.04],
        [-10.53, 0.95],
        [-10.91, 0.93],
      ],
      [
        [-9.56, 1.81],
        [-9.19, 2.15],
        [-8.55, 2.42],
        [-7.98, 2.18],
        [-7.46, 2.26],
        [-6.8, 1.97],
        [-6.55, 1.51],
        [-7.02, 1.36],
        [-7.19, 0.75],
        [-7.7, 0.76],
        [-8.08, 1.22],
        [-8.65, 0.98],
        [-9.03, 1.29],
        [-9.24, 1.53],
      ],
    ],
  },
  {
    outline: [
      [-5.92, 0.24],
      [-5.76, 2.62],
      [-3.74, 3.02],
      [-1.81, 3.48],
      [0.05, 3.62],
      [0.35, 3.26],
      [0.77, 0.24],
      [-0.91, 0.24],
      [-0.98, 1.18],
      [-0.51, 1.42],
      [-0.54, 1.96],
      [-0.86, 2.48],
      [-1.24, 2.44],
      [-1.4, 1.92],
      [-1.63, 1.58],
      [-1.76, 0.24],
    ],
    holes: [
      [
        [-5.12, 1.45],
        [-4.9, 2.02],
        [-4.36, 2.5],
        [-3.84, 2.42],
        [-3.41, 2.58],
        [-3.15, 2.13],
        [-3.49, 1.9],
        [-3.32, 1.34],
        [-3.64, 1.12],
        [-3.83, 1.42],
        [-4.59, 1.32],
      ],
      [
        [-2.78, 2.74],
        [-2.61, 2.94],
        [-2.29, 2.91],
        [-2.25, 2.6],
        [-2.51, 2.49],
      ],
    ],
  },
  {
    outline: [
      [0.75, 0.24],
      [0.35, 3.29],
      [1.69, 3.36],
      [3.24, 3.1],
      [5.82, 2.71],
      [6.11, 0.22],
    ],
    holes: [
      [
        [0.97, 1.76],
        [1.08, 2.38],
        [1.61, 2.68],
        [2.15, 2.59],
        [2.69, 2.45],
        [2.84, 2.08],
        [2.45, 1.69],
        [1.84, 1.7],
        [1.65, 0.92],
        [1.32, 0.9],
        [1.26, 1.45],
      ],
      [
        [3.16, 1.42],
        [3.46, 1.89],
        [3.62, 2.26],
        [4.07, 2.29],
        [4.28, 1.91],
        [4.02, 1.63],
        [4.11, 1.12],
        [3.63, 1.03],
      ],
      [
        [4.51, 0.94],
        [4.6, 1.56],
        [4.99, 1.87],
        [5.39, 1.76],
        [5.49, 1.39],
        [5.11, 1.2],
        [5.0, 0.79],
      ],
    ],
  },
  {
    outline: [
      [5.84, 0.22],
      [5.66, 2.69],
      [8.18, 2.77],
      [10.62, 2.59],
      [12.45, 2.29],
      [12.61, 0.22],
      [11.42, 0.21],
      [11.38, 1.49],
      [11.16, 1.8],
      [10.34, 1.91],
      [9.97, 1.6],
      [9.91, 0.23],
    ],
    holes: [
      [
        [6.27, 1.62],
        [6.48, 2.25],
        [6.89, 2.45],
        [7.22, 2.23],
        [7.46, 2.31],
        [8.01, 2.05],
        [7.94, 1.73],
        [7.73, 1.52],
        [7.85, 1.18],
        [7.33, 1.22],
        [7.13, 1.62],
        [6.69, 1.43],
      ],
      [
        [8.26, 1.37],
        [8.55, 1.6],
        [8.91, 1.48],
        [8.88, 1.11],
        [8.56, 0.99],
      ],
    ],
  },
];

function panel(out, outline, holes, position, outward, shade) {
  const rings = [outline, ...holes];
  const vertices = rings.flat();
  const [outer, ...voids] = rings.map((r) => r.map((p) => new Vector2(...p)));
  for (const t of ShapeUtils.triangulateShape(outer, voids)) {
    const near = t.map((i) => position(vertices[i], 0));
    const far = t.map((i) => position(vertices[i], 0.33));
    const normal = normalFor(...near);
    const sign = normal[0] * outward[0] + normal[2] * outward[2] > 0 ? 1 : -1;
    const tint = blend(shade, ochre, 0.13 + 0.19 * Math.sin(t[1] * 0.46));
    triangle(
      out,
      'plaster',
      near,
      tint,
      normal.map((n) => n * sign),
    );
    triangle(
      out,
      'plaster',
      far,
      shade,
      normal.map((n) => -n * sign),
    );
  }
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const center = blend(a, b, 0.5);
      const swatch = blend(shade, moss, center[1] < 0.72 ? 0.55 : 0.19);
      // Both side and aperture reveals share the same profile, with a mottled inner edge.
      const edge = [position(a, 0), position(b, 0), position(b, 0.33), position(a, 0.33)];
      quad(out, 'plaster', edge, swatch);
      quad(out, 'plaster', edge.toReversed(), swatch);
    }
  }
}

function walls(out) {
  const front = ([x, y], depth) => [
    x,
    y,
    2.44 + 0.48 * Math.cos(x * 0.24) + 0.17 * Math.sin(y * 1.4 + x * 0.48) - depth,
  ];
  for (const { outline, holes } of bays) {
    const height = Math.max(...outline.map((p) => p[1]));
    panel(out, outline, holes, (p, d) => fitWall(front(p, d), height), [0, 0, 1], clay);
  }
  const side = [
    [-5.75, 0.2],
    [-5.63, 2.18],
    [-3.27, 2.6],
    [0.5, 2.56],
    [2.77, 2.16],
    [2.91, 0.21],
  ];
  for (const sign of [-1, 1]) {
    const x = sign === -1 ? -11.47 : 12.3;
    panel(
      out,
      side,
      [
        [
          [0.15, 0.94],
          [0.21, 1.57],
          [0.77, 1.91],
          [1.39, 1.69],
          [1.48, 1.25],
          [1.04, 0.96],
        ],
      ],
      ([z, y], d) => fitWall([x - sign * d + 0.12 * Math.sin(0.8 * z), y, z], 2.6),
      [sign, 0, 0],
      ochre,
    );
  }
  panel(
    out,
    [
      [-11.6, 0.23],
      [-11.58, 2.15],
      [-6.06, 2.45],
      [-0.88, 2.6],
      [6.18, 2.47],
      [12.17, 2.28],
      [12.29, 0.21],
    ],
    [
      [
        [1.23, 1.25],
        [1.52, 1.68],
        [2.04, 1.87],
        [2.68, 1.73],
        [2.62, 1.29],
        [2.13, 1.01],
        [1.58, 1.05],
      ],
    ],
    ([x, y], d) => fitWall([x, y, -5.52 + d + 0.18 * Math.cos(x * 0.27)], 2.6),
    [0, 0, -1],
    ochre,
  );
}

function posts(out, sides, detail) {
  const points = [
    [beak(1, 0.009, 0.895), 0.12],
    [beak(-1, 0.38, 0.85), 0.13],
    [beak(1, 0.44, 0.86), 0.14],
    [beak(-1, 0.9, 0.91), 0.18],
    [beak(1, 0.91, 0.92), 0.18],
    [wing(-1, 0.92, 0.88), 0.24],
    [wing(1, 0.92, 0.89), 0.22],
  ];
  for (const [i, [[x, roofY, z], width]] of points.entries()) {
    const rings = (detail ? [0, 0.08, 0.21, 0.37, 0.51, 0.66, 0.78, 0.91, 1] : [0, 0.51, 1]).map(
      (v, j) =>
        radialRing(
          0.22 + v * (roofY - 0.3),
          width * (1 + 0.25 * Math.sin(j * 3.4)),
          width * 0.86,
          sides,
          [x + 0.14 * (1 - v) * Math.sin(v * 8 + i), z - 0.19 * (1 - v) * Math.sin(v * 6 + i)],
          v * 0.62,
        ),
    );
    loft(out, 'wood', rings, blend(timber, ochre, 0.38));
  }
}

function reliefs(out, detail) {
  for (const [x, y, z, w, nominalHeight, sway] of [
    [-10.9, 0.5, 2.21, 0.65, 1.8, -0.41],
    [-7.21, 0.52, 2.56, 0.94, 1.78, 0.64],
    [-3.19, 0.54, 2.98, 0.81, 2.43, -0.45],
    [0.46, 0.62, 3.16, 0.79, 2.71, 0.61],
    [3.14, 0.48, 2.82, 0.53, 1.91, -0.45],
    [6.16, 0.49, 2.48, 0.63, 1.7, 0.53],
    [9.23, 0.53, 2.24, 0.6, 1.84, -0.32],
  ]) {
    const h = Math.min(nominalHeight, roofAt(x, z + 0.38) - 0.48 - y);
    if (h < 0.35) continue;
    const flare = Math.min(1, h / 0.95);
    const outline = [
      [0, 1, 0.45],
      [0.14, 0.7, 0.45],
      [0.43, 0.46, 0.34],
      [0.67, 0.37, 0.26],
      [0.89, 0.26, 0.24],
      [1, 0.21, 0.19],
    ];
    const rings = outline.map(([v, rw, rd]) =>
      radialRing(
        y + h * v,
        w * rw * flare,
        rd * flare,
        detail ? 8 : 6,
        [x + flare * sway * Math.sin(2.1 * v), z + flare * 0.31 * Math.sin(v * Math.PI)],
        v + 0.11,
      ),
    );
    loft(out, 'plaster', rings, blend(clay, ochre, 0.36));
    if (detail) {
      sphere(
        out,
        'plaster',
        [x + sway * 0.81, y + h * 0.84, z + 0.21],
        [w * 0.22, 0.21, 0.28],
        ochre,
        9,
        6,
      );
      sphere(
        out,
        'plaster',
        [x + sway * 0.47, y + h * 0.36, z + 0.4],
        [w * 0.36, 0.25, 0.23],
        clay,
        9,
        6,
      );
    }
  }
}

function frame(out, details) {
  for (const side of [-1, 1]) {
    const edge = (u, v) => {
      const [x, y, z] = beak(side, u, v);
      return [x, y - 0.17, z];
    };
    const count = details ? 12 : 5;
    beamPath(
      out,
      'wood',
      Array.from({ length: count + 1 }, (_, i) => edge(i / count, 1)),
      0.14,
      0.15,
      timber,
    );
    for (const v of details ? [0.22, 0.4, 0.57, 0.7, 0.82, 0.91] : [0.28, 0.53, 0.79]) {
      beamPath(
        out,
        'wood',
        Array.from({ length: count + 1 }, (_, i) => edge(i / count, v)),
        0.09,
        0.12,
        timber,
      );
    }
    if (details) {
      for (const u of [0.21, 0.32, 0.43, 0.55, 0.66, 0.77, 0.88]) {
        beamPath(
          out,
          'wood',
          Array.from({ length: 9 }, (_, i) => edge(u, i / 8)),
          0.063,
          0.074,
          timber,
        );
      }
    }
  }
}

function build(out, detail, segments) {
  slab(out, detail);
  for (const side of [-1, 1]) {
    sheet(out, beak, side, segments, segments + 1, bronze, false);
    sheet(out, wing, side, segments, segments + 1, bronze, true);
  }
  tower(out, detail ? segments * 3 : 8, detail > 1);
  if (detail > 0) {
    walls(out);
    posts(out, detail > 1 ? 8 : 5, detail > 1);
    if (detail > 1) {
      reliefs(out, detail > 2);
      frame(out, detail > 2);
    }
  } else {
    // Coarse windows and the open approach are formed by the main shell profile.
    for (const [x0, x1] of [
      [-11.6, -6],
      [-5.72, -1.71],
      [0.73, 5.68],
      [5.89, 9.89],
      [11.43, 12.4],
    ]) {
      const outline = [
        [x0, 0.23],
        [x1, 0.23],
        [x1, 2.57],
        [(x0 + x1) / 2, 2.78],
        [x0, 2.48],
      ];
      panel(
        out,
        outline,
        [],
        ([x, y], d) => fitWall([x, y, 2.49 + 0.43 * Math.cos(0.24 * x) - d], 2.78),
        [0, 0, 1],
        clay,
      );
    }
    posts(out, 4, false);
  }
}

export const buildSkyline = (out) => build(out, 0, 4);
export const buildDistrict = (out) => build(out, 1, 7);
export const buildStreet = (out) => build(out, 2, 12);
export const buildCloseup = (out) => build(out, 3, 22);
export const buildMaster = (out) => build(out, 4, 38);
