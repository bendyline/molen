import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  relief: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  exposed: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
};

// Model +Z faces the broad stairs on the photographed courtyard side.
// Clear spans have separate intrados controls, including the two narrower outer openings.
export const control = {
  deck: 0.77,
  landingFront: 2.05,
  openings: [
    { range: [-3.69, -2.48], base: 0.77, crown: 2.59, riseAt: -3.15 },
    { range: [-1.46, 1.12], base: 0.77, crown: 3.23, riseAt: -0.02 },
    { range: [2.08, 3.39], base: 0.77, crown: 2.65, riseAt: 2.78 },
  ],
  crest: [
    [-9.15, 1.94],
    [-8.8, 2.03],
    [-8.15, 1.91],
    [-7.53, 2.1],
    [-6.75, 2.0],
    [-6.18, 2.29],
    [-5.45, 2.17],
    [-4.9, 2.26],
    [-4.25, 2.18],
    [-3.76, 2.54],
    [-3.53, 2.96],
    [-3.23, 3.03],
    [-2.91, 2.89],
    [-2.52, 2.14],
    [-2.22, 2.08],
    [-1.73, 2.51],
    [-1.34, 2.81],
    [-0.97, 3.08],
    [-0.59, 3.49],
    [-0.3, 3.66],
    [0.01, 3.56],
    [0.33, 3.67],
    [0.66, 3.53],
    [1.03, 3.21],
    [1.46, 2.86],
    [1.94, 2.77],
    [2.25, 2.93],
    [2.77, 3.19],
    [3.14, 2.91],
    [3.51, 2.32],
    [3.92, 2.25],
    [4.42, 2.37],
    [5.09, 2.26],
    [5.62, 2.45],
    [6.19, 2.71],
    [6.58, 2.49],
    [6.99, 2.29],
    [7.41, 2.26],
    [8.06, 2.14],
    [8.64, 2.22],
    [9.02, 1.91],
  ],
};

const ref = 'palette:#ffffff';
const clay = [0.39, 0.234, 0.113];
const sunWorn = [0.55, 0.389, 0.237];
const dark = [0.176, 0.134, 0.077];
const mineral = [0.31, 0.284, 0.223];
const moss = [0.176, 0.204, 0.094];
const worn = [0.41, 0.38, 0.27];
const mix = (a, b, t) => a.map((v, i) => (1 - t) * v + t * b[i]);
const shade = (color, factor) => color.map((v) => v * factor);
const tri = (out, key, p, color) => out.addTriangle(key, ref, p, normalFor(...p), [], color);
const quad = (out, key, [a, b, c, d], color) => {
  tri(out, key, [a, b, c], color);
  tri(out, key, [a, c, d], color);
};
const centerLine = (x) => 0.032 * x + 0.23 * Math.sin(x * 0.45 + 0.2) + 0.14 * Math.cos(x * 0.96);
const thickness = (x, y) =>
  0.22 +
  0.18 * Math.max(0, 1 - (y - control.deck) / 1.48) +
  0.056 * Math.sin(x * 1.77 + y * 0.92) +
  0.041 * Math.cos(y * 3.9 + x * 1.87);
const shell = (x, y, side) => [
  x + 0.22 * Math.sin(x * 1.32 + 0.3) * Math.sin((y - control.deck) * 1.2),
  y,
  centerLine(x) + side * (thickness(x, y) + 0.041 * Math.sin(x * 2.14 + y * 2.64)),
];

// In the stair-side panorama the central piers bend back from the side returns. These
// stations register the existing profiles to the visible terrace contacts and crowns.
// Offsets are in metres in the signed map frame, with depth inferred from the views.
const portalStations = [
  // Original x, registered x, forward offset, crown height factor.
  [-9.15, -9.15, 0, 1],
  [-5.05, -5.05, 0.18, 1],
  [-3.69, -3.45, 0.49, 1.11],
  [-3.15, -2.96, 0.69, 1.22],
  [-2.48, -2.1, 0.79, 1.12],
  [-1.46, -0.81, 0.64, 1.06],
  [-0.34, -0.4, 0.43, 1.055],
  [-0.02, -0.12, 0.4, 1.085],
  [0.3, 0.105, 0.36, 1.075],
  [1.12, 0.7, 0.31, 1.07],
  [2.08, 2.13, 0.17, 1.08],
  [2.4, 2.24, 0.16, 1.25],
  [2.78, 2.4, 0.23, 1.34],
  [3.14, 2.67, 0.56, 1.26],
  [3.39, 2.96, 0.79, 1.11],
  [4.54, 4.31, 0.65, 1.04],
  [6.35, 6.12, 0.43, 1],
  [9.02, 9.02, 0, 1],
];

export function registeredPortalPoint([x, y, z]) {
  const index = portalStations.findIndex(([station]) => station > x);
  if (index <= 0) return [x, y, z];
  const [a, ax, az, ay] = portalStations[index - 1];
  const [b, bx, bz, by] = portalStations[index];
  const t = (x - a) / (b - a);
  return [
    ax + (bx - ax) * t,
    control.deck + (y - control.deck) * (ay + (by - ay) * t),
    z + az + (bz - az) * t,
  ];
}

function registeredPortal(out) {
  const mapFace = (emit) => (slot, ref, points, _normal, uv, color) => {
    const moved = points.map(registeredPortalPoint);
    emit(slot, ref, moved, normalFor(...moved), uv, color);
  };
  return {
    addTriangle: mapFace(out.addTriangle),
    addQuad: mapFace(out.addQuad),
    addConvexPolygon: mapFace(out.addConvexPolygon),
  };
}

function crestAt(x) {
  const stations = control.crest;
  for (let i = 1; i < stations.length; i++) {
    const [a, ya] = stations[i - 1],
      [b, yb] = stations[i];
    if (x > b) continue;
    const t = (x - a) / (b - a);
    return ya + (yb - ya) * t * t * (3 - 2 * t);
  }
  return stations.at(-1)[1];
}

function intrados(x, aperture) {
  if (!aperture) return control.deck;
  const {
    range: [left, right],
    riseAt,
    base,
    crown,
  } = aperture;
  const half = x < riseAt ? riseAt - left : right - riseAt;
  const offset = (x - riseAt) / half;
  const shape = Math.sqrt(Math.max(0, 1 - offset * offset));
  return base + (crown - base) * shape * (1 - 0.11 * offset + 0.061 * Math.sin(offset * 9.0));
}

function clayTint(x, y, side, seed) {
  const middle = mix(clay, sunWorn, 0.28 + 0.17 * Math.sin(x * 1.2 + y + side));
  const waterline = 1.45 + 0.22 * Math.sin(x * 1.3 - side);
  const dampBase = Math.max(0, Math.min(1, (waterline - y) / 0.8));
  const streak = 0.5 + 0.26 * Math.sin(x * 2.13 - y * 0.71) + 0.14 * Math.cos(x * 5.4 + y * 1.6);
  const weathering = 0.11 + 0.24 * streak + 0.43 * dampBase * streak;
  const tint = mix(middle, moss, weathering);
  return shade(tint, 0.9 + 0.068 * Math.sin(x * 3.2 + y * 3.4 + seed));
}

function wallStrip(out, lo, hi, aperture, detail) {
  const marks = [lo, ...control.crest.map((a) => a[0]).filter((x) => x > lo && x < hi), hi];
  if (aperture) marks.push(aperture.riseAt);
  marks.sort((a, b) => a - b);
  const steps = [];
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1],
      b = marks[i];
    if (b - a < 0.00001) continue;
    const parts = Math.ceil((b - a) / detail.dx);
    for (let j = 0; j < parts; j++) steps.push(a + ((b - a) * j) / parts);
  }
  steps.push(hi);
  const lower = (x) => intrados(x, aperture);
  const upper = (x) => Math.max(crestAt(x), lower(x) + 0.19);
  const wallStart = control.crest[0][0];
  const wallEnd = control.crest.at(-1)[0];
  const shoulder = (x, edge) => {
    if (!detail.capSegments) return 0;
    const [start, end] = edge === 1 ? [wallStart, wallEnd] : [lo, hi];
    const taper = Math.min(1, (x - start) / 0.24, (end - x) / 0.24);
    return Math.min(0.14, (upper(x) - lower(x)) * 0.23) * taper;
  };
  const vertex = (x, t, side) => {
    const bottom = lower(x) + (aperture ? shoulder(x, 0) : 0);
    const top = upper(x) - shoulder(x, 1);
    return shell(x, bottom + (top - bottom) * t, side);
  };
  const cap = (x, edge) => {
    const near = vertex(x, edge, -1);
    const far = vertex(x, edge, 1);
    const depth = shoulder(x, edge) * (edge === 1 ? 1 : -1);
    const points = [near];
    for (let j = 1; j < detail.capSegments; j++) {
      const angle = (j / detail.capSegments) * Math.PI;
      const t = (1 - Math.cos(angle)) / 2;
      const point = near.map((value, i) => value + (far[i] - value) * t);
      point[1] += depth * Math.sin(angle);
      points.push(point);
    }
    points.push(far);
    return points;
  };
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1],
      b = steps[i];
    for (const side of [-1, 1]) {
      for (let row = 0; row < detail.rows; row++) {
        const u = row / detail.rows,
          v = (row + 1) / detail.rows;
        const face = [
          vertex(a, u, side),
          vertex(b, u, side),
          vertex(b, v, side),
          vertex(a, v, side),
        ];
        const color = clayTint((a + b) * 0.5, (face[0][1] + face[2][1]) * 0.5, side, row * 0.27);
        quad(out, 'wall', side > 0 ? face : face.reverse(), color);
      }
    }
    for (const edge of aperture ? [1, 0] : [1]) {
      const capA = cap(a, edge);
      const capB = cap(b, edge);
      const color = edge === 1 ? clayTint((a + b) * 0.5, upper(a), 1, 1.72) : shade(clay, 0.76);
      for (let j = 1; j < capA.length; j++) {
        const face =
          edge === 1
            ? [capA[j], capB[j], capB[j - 1], capA[j - 1]]
            : [capA[j - 1], capB[j - 1], capB[j], capA[j]];
        quad(out, 'wall', face, color);
      }
    }
  }
}

function barrier(out, detail) {
  const start = control.crest[0][0],
    end = control.crest.at(-1)[0];
  let x = start;
  for (const opening of control.openings) {
    const [a, b] = opening.range;
    wallStrip(out, x, a, null, detail);
    wallStrip(out, a, b, opening, detail);
    x = b;
  }
  wallStrip(out, x, end, null, detail);
  for (const side of [-1, 1]) {
    const endX = side < 0 ? start : end;
    const a = shell(endX, control.deck, -1),
      b = shell(endX, control.deck, 1);
    const c = shell(endX, crestAt(endX), 1),
      d = shell(endX, crestAt(endX), -1);
    const clip = [a, b, c, d];
    quad(out, 'wall', side < 0 ? clip : clip.reverse(), clay);
  }
}

function ellipse(out, center, rx, ry, depth, color, detail) {
  const [x, y, z] = center;
  const rings =
    detail.reliefSides < 9
      ? [
          [-0.98, 0.12],
          [-0.56, 0.74],
          [0.17, 1],
          [0.72, 0.72],
          [1, 0.11],
        ]
      : [
          [-0.98, 0.12],
          [-0.78, 0.61],
          [-0.38, 0.9],
          [0.17, 1],
          [0.62, 0.79],
          [0.9, 0.51],
          [1, 0.11],
        ];
  loft(
    out,
    'relief',
    rings.map(([v, r]) => radialRing(y + v * ry, rx * r, depth * r, detail.reliefSides, [x, z])),
    color,
  );
}

function trace(out, path, radius, color, detail) {
  const points =
    detail.reliefSides > 10
      ? path.flatMap((p, i) => {
          const q = path[i + 1];
          if (!q) return [p];
          const a = path[i - 1] ?? p,
            b = path[i + 2] ?? q;
          const midpoint = p.map((value, j) => (-a[j] + 9 * value + 9 * q[j] - b[j]) / 16);
          return [p, midpoint];
        })
      : path;
  const rings = points.map(([x, y, z], i) => {
    const before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0],
      dy = after[1] - before[1],
      len = Math.hypot(dx, dy);
    const r = radius * (i === 0 || i === points.length - 1 ? 0.55 : 1);
    return Array.from({ length: detail.traceSides }, (_, j) => {
      const angle = (j * 2 * Math.PI) / detail.traceSides;
      const n = Math.cos(angle) * r;
      return [x - (dy * n) / len, y + (dx * n) / len, z + Math.sin(angle) * r * 0.83];
    });
  });
  for (let i = 1; i < rings.length; i++) {
    const previous = rings[i - 1],
      current = rings[i];
    for (let j = 0; j < current.length; j++) {
      const k = (j + 1) % current.length;
      quad(out, 'relief', [previous[j], previous[k], current[k], current[j]], color);
    }
  }
}

function face(out, x, y, side, scales, detail, lean) {
  const [z] = scales.slice(2);
  const width = scales[0],
    height = scales[1];
  const base = clayTint(x, y, side, 1.2),
    line = shade(dark, 1.06);
  ellipse(out, [x, y, z], width, height, 0.19, base, detail);
  if (!detail.faces) return;
  const plane = z + side * 0.169;
  for (const sign of [-1, 1]) {
    const cx = x + sign * width * 0.38,
      cy = y + height * 0.18 + sign * lean * 0.016;
    ellipse(out, [cx, cy, plane], width * 0.235, height * 0.207, 0.036, line, detail);
    ellipse(
      out,
      [cx - sign * 0.006, cy - 0.007, plane + side * 0.032],
      width * 0.145,
      height * 0.143,
      0.03,
      sunWorn,
      detail,
    );
    if (detail.figures) {
      const arch = [];
      for (let j = 0; j <= 6; j++) {
        const u = (j / 6 - 0.5) * Math.PI,
          xx = cx + Math.sin(u) * width * 0.31;
        arch.push([xx, cy + Math.cos(u) * height * 0.3, plane + side * 0.012]);
      }
      trace(out, arch, 0.026, shade(base, 0.82), detail);
    }
  }
  trace(
    out,
    [
      [x + 0.012, y + height * 0.17, plane],
      [x + 0.039, y + 0.016, plane + side * 0.057],
      [x - 0.029, y - height * 0.24, plane + side * 0.061],
    ],
    0.043,
    shade(base, 0.93),
    detail,
  );
  const arc = Array.from({ length: 7 }, (_, i) => {
    const u = i / 3 - 1;
    const mouthWidth = lean < 0 ? 0.66 : 0.56;
    const frown = lean < 0 ? 0.12 : 0.23;
    return [
      x + u * width * mouthWidth,
      y - height * (0.43 + frown * u * u),
      plane + side * (0.026 + 0.014 * (1 - u * u)),
    ];
  });
  trace(out, arc, 0.025, mix(line, base, 0.28), detail);
  trace(
    out,
    arc.map(([x, y, z]) => [x, y + 0.036, z + side * 0.006]),
    0.016,
    mix(sunWorn, base, 0.44),
    detail,
  );
}

const figures = [
  [-7.96, 1.27, 0.42, 'bird'],
  [-7.12, 1.2, 0.64, 'arms'],
  [-6.36, 1.33, 0.6, 'arms'],
  [-5.63, 1.42, 0.48, 'stoop'],
  [-5.05, 1.21, 0.72, 'seated'],
  [-4.54, 1.65, 0.44, 'bird'],
  [-2.15, 1.53, 1.06, 'stoop'],
  [-1.92, 1.01, 0.32, 'bird'],
  [1.55, 1.46, 1.08, 'arms'],
  [1.94, 1.17, 0.31, 'seated'],
  [3.76, 1.55, 0.68, 'arms'],
  [4.43, 1.47, 0.63, 'stoop'],
  [5.12, 1.555, 0.77, 'arms'],
  [5.95, 1.58, 0.6, 'seated'],
  [6.72, 1.47, 0.64, 'bird'],
  [7.46, 1.37, 0.78, 'arms'],
  [8.35, 1.42, 0.56, 'stoop'],
];

const figureOutline = {
  arms: [
    [-0.1, -0.48],
    [-0.12, -0.19],
    [0.04, 0.07],
    [-0.2, 0.14],
    [-0.31, 0.32],
    [-0.17, 0.07],
    [0.01, 0.09],
    [0.22, 0.1],
    [0.33, 0.34],
    [0.22, 0.04],
    [0.1, -0.13],
    [0.22, -0.43],
  ],
  stoop: [
    [-0.28, -0.41],
    [-0.28, -0.14],
    [-0.05, -0.04],
    [0.1, 0.19],
    [0.26, 0.18],
    [0.32, -0.01],
    [0.07, -0.09],
    [0.22, -0.31],
    [0.34, -0.35],
  ],
  seated: [
    [-0.24, -0.33],
    [-0.35, -0.2],
    [-0.12, -0.14],
    [-0.02, 0.08],
    [0.04, 0.23],
    [0.19, 0.04],
    [0.3, -0.12],
    [0.14, -0.23],
    [0.04, -0.4],
    [-0.11, -0.39],
  ],
  bird: [
    [-0.32, -0.09],
    [-0.12, 0.02],
    [0.06, 0.13],
    [0.24, 0.14],
    [0.35, 0.23],
    [0.41, 0.2],
    [0.24, 0.09],
    [0.17, -0.08],
    [0.03, -0.12],
    [-0.17, -0.23],
  ],
};

function reliefs(out, detail) {
  for (const side of [-1, 1]) {
    for (const [x, y, width, height, lean] of [
      [-0.34, 3.57, 0.306, 0.425, -1],
      [0.3, 3.54, 0.256, 0.366, 1],
    ]) {
      face(out, x, y, side, [width, height, shell(x, y, side)[2] - 0.073 * side], detail, lean);
    }
    if (!detail.figures) continue;
    for (const [i, [x, y, s, type]] of figures.entries()) {
      if (side < 0 && (i % 4 === 0 || Math.abs(x) < 2.4)) continue;
      if (side > 0 && Math.abs(x) < 2.4) continue;
      const color =
        i % 3 === 0 ? shade(mineral, 1.26) : i % 3 === 1 ? shade(dark, 1.25) : shade(sunWorn, 1.06);
      const place = ([u, v], distance) => {
        const p = shell(x + u * s, y + v * s, side);
        p[2] += side * distance;
        return p;
      };
      const path = figureOutline[type].map((p) => place(p, 0.047));
      trace(out, path, 0.062 * s + 0.009, color, detail);
      const head = place(type === 'bird' ? [0.25, 0.16] : [0.025, 0.27], 0.056);
      ellipse(out, head, 0.099 * s, 0.129 * s, 0.037, color, detail);
      if (type !== 'bird' && detail.reliefSides > 10)
        ellipse(
          out,
          place([0.016, -0.064], 0.036),
          0.123 * s,
          0.183 * s,
          0.04,
          shade(color, 0.96),
          detail,
        );
      if (type !== 'bird' && detail.reliefSides > 10) {
        const [a, b, c] = head;
        ellipse(
          out,
          [a - 0.032 * s, b + 0.028 * s, c + side * 0.026],
          0.018 * s,
          0.022 * s,
          0.014,
          dark,
          detail,
        );
      }
    }
  }
}

// The carved faces on the figure side of the two central piers differ from
// the smaller figures on the enclosure walls and on the stair side.
const portalPanels = [
  {
    center: [1.59, 1.9],
    size: [0.77, 0.81],
    paths: [
      [
        [-0.46, 0.26],
        [-0.26, 0.24],
        [-0.15, 0.44],
        [0.04, 0.48],
        [0.22, 0.39],
        [0.26, 0.24],
        [0.44, 0.17],
        [0.49, -0.1],
        [0.36, -0.17],
        [0.22, -0.07],
        [0.2, -0.25],
        [0.33, -0.43],
        [0.21, -0.49],
        [0.04, -0.34],
        [-0.06, -0.16],
        [-0.23, -0.34],
        [-0.44, -0.26],
        [-0.48, -0.11],
        [-0.3, 0.04],
        [-0.47, 0.13],
        [-0.46, 0.26],
      ],
      [
        [-0.18, 0.24],
        [-0.07, 0.29],
        [0.03, 0.23],
        [-0.04, 0.17],
        [-0.16, 0.18],
        [-0.18, 0.24],
      ],
      [
        [0.1, 0.29],
        [0.19, 0.28],
        [0.22, 0.2],
        [0.15, 0.18],
        [0.08, 0.21],
        [0.1, 0.29],
      ],
      [
        [-0.08, 0.08],
        [0.05, 0.02],
        [0.16, 0.07],
      ],
      [
        [-0.27, -0.12],
        [-0.13, -0.11],
        [-0.08, -0.22],
      ],
    ],
  },
  {
    center: [1.65, 1.14],
    size: [0.76, 0.45],
    paths: [
      [
        [-0.48, 0.08],
        [-0.34, 0.23],
        [-0.11, 0.19],
        [0.09, 0.34],
        [0.31, 0.37],
        [0.48, 0.21],
        [0.39, 0.05],
        [0.48, -0.04],
        [0.31, -0.17],
        [0.19, -0.13],
        [0.09, -0.39],
        [-0.08, -0.36],
        [-0.12, -0.13],
        [-0.38, -0.2],
        [-0.49, -0.08],
        [-0.48, 0.08],
      ],
      [
        [-0.29, 0.02],
        [-0.13, -0.05],
        [0.07, -0.01],
        [0.24, 0.13],
      ],
      [
        [0.27, 0.23],
        [0.36, 0.21],
        [0.34, 0.14],
        [0.26, 0.15],
        [0.27, 0.23],
      ],
    ],
  },
  {
    center: [-1.7, 1.94],
    size: [0.56, 0.9],
    paths: [
      [
        [-0.38, -0.23],
        [-0.27, 0.13],
        [-0.24, 0.39],
        [-0.06, 0.47],
        [0.18, 0.44],
        [0.37, 0.26],
        [0.41, 0.04],
        [0.31, -0.13],
        [0.39, -0.4],
        [0.17, -0.47],
        [0.11, -0.27],
        [-0.11, -0.28],
        [-0.28, -0.44],
        [-0.4, -0.33],
        [-0.38, -0.23],
      ],
      [
        [-0.13, 0.25],
        [0.01, 0.35],
        [0.19, 0.27],
        [0.22, 0.11],
        [0.09, 0.03],
        [-0.08, 0.11],
        [-0.13, 0.25],
      ],
      [
        [0.015, 0.22],
        [0.12, 0.21],
      ],
      [
        [-0.06, -0.07],
        [0.08, -0.12],
        [0.21, -0.07],
      ],
    ],
  },
  {
    center: [-2.12, 1.38],
    size: [0.54, 1.21],
    paths: [
      [
        [-0.34, -0.1],
        [-0.24, 0.06],
        [-0.17, 0.2],
        [-0.24, 0.29],
        [-0.12, 0.42],
        [0.03, 0.5],
        [0.18, 0.43],
        [0.27, 0.29],
        [0.21, 0.19],
        [0.29, 0.05],
        [0.4, -0.08],
        [0.31, -0.16],
        [0.21, -0.06],
        [0.22, -0.25],
        [0.33, -0.39],
        [0.23, -0.48],
        [0.08, -0.39],
        [0, -0.25],
        [-0.11, -0.42],
        [-0.26, -0.47],
        [-0.37, -0.38],
        [-0.23, -0.27],
        [-0.18, -0.07],
        [-0.34, -0.15],
        [-0.34, -0.1],
      ],
      [
        [-0.2, 0.26],
        [-0.09, 0.32],
        [0.08, 0.33],
        [0.22, 0.27],
      ],
      [
        [-0.11, 0.19],
        [0.1, 0.18],
        [0.13, 0.23],
      ],
      [
        [-0.14, 0.04],
        [-0.03, 0.11],
        [0.11, 0.02],
        [0.17, -0.19],
        [-0.03, -0.25],
        [-0.16, -0.17],
      ],
      [
        [-0.09, -0.09],
        [0.08, -0.11],
      ],
    ],
  },
];

const stairPanels = [
  {
    center: [-1.98, 1.5],
    size: [0.91, 1.22],
    paths: [
      [
        [-0.45, 0.46],
        [-0.36, 0.24],
        [-0.24, 0.13],
        [-0.03, 0.15],
        [0.08, 0.27],
        [0.28, 0.34],
        [0.42, 0.45],
        [0.4, 0.25],
        [0.27, 0.13],
        [0.23, -0.03],
        [0.39, -0.21],
        [0.4, -0.42],
        [0.26, -0.47],
        [0.11, -0.33],
        [-0.04, -0.33],
        [-0.2, -0.47],
        [-0.36, -0.42],
        [-0.31, -0.23],
        [-0.11, -0.07],
        [-0.09, 0.04],
        [-0.27, 0.02],
        [-0.42, 0.18],
        [-0.45, 0.46],
      ],
      [
        [-0.24, 0.34],
        [-0.12, 0.42],
        [0.03, 0.4],
        [0.15, 0.29],
        [0.07, 0.19],
        [-0.17, 0.21],
        [-0.24, 0.34],
      ],
      [
        [-0.18, 0.29],
        [-0.13, 0.32],
        [-0.06, 0.29],
        [-0.04, 0.25],
        [-0.16, 0.25],
        [-0.18, 0.29],
      ],
      [
        [0, 0.34],
        [0.04, 0.37],
        [0.09, 0.34],
        [0.08, 0.29],
        [0, 0.3],
        [0, 0.34],
      ],
      [
        [-0.21, 0.21],
        [-0.11, 0.17],
        [0.05, 0.19],
      ],
    ],
  },
  {
    center: [1.51, 1.63],
    size: [0.69, 1.2],
    paths: [
      [
        [-0.13, 0.5],
        [0.14, 0.49],
        [0.26, 0.38],
        [0.17, 0.22],
        [0.28, 0.17],
        [0.36, 0.03],
        [0.23, -0.08],
        [0.24, -0.27],
        [0.34, -0.41],
        [0.18, -0.49],
        [0.02, -0.34],
        [-0.15, -0.47],
        [-0.3, -0.37],
        [-0.14, -0.23],
        [-0.18, -0.1],
        [-0.35, -0.01],
        [-0.32, 0.11],
        [-0.14, 0.06],
        [0.01, 0.17],
        [-0.07, 0.23],
        [-0.15, 0.39],
        [-0.13, 0.5],
      ],
      [
        [-0.15, 0.45],
        [-0.04, 0.41],
        [0.07, 0.44],
        [0.18, 0.4],
      ],
      [
        [-0.08, 0.34],
        [0.17, 0.37],
      ],
      [
        [-0.04, 0.27],
        [0.09, 0.28],
        [0.18, 0.31],
      ],
      [
        [-0.1, -0.02],
        [0.05, -0.05],
        [0.25, -0.01],
      ],
      [
        [-0.15, -0.16],
        [0.03, -0.21],
        [0.23, -0.17],
      ],
    ],
  },
];

function panelDepth(contour, [u, v]) {
  let distance = Infinity;
  for (const [i, [x, y]] of contour.entries()) {
    const [nextX, nextY] = contour[(i + 1) % contour.length];
    const dx = nextX - x;
    const dy = nextY - y;
    const fraction = Math.max(0, Math.min(1, ((u - x) * dx + (v - y) * dy) / (dx * dx + dy * dy)));
    distance = Math.min(distance, Math.hypot(u - x - fraction * dx, v - y - fraction * dy));
  }
  return 0.016 + 0.03 * Math.sin(Math.min(1, distance / 0.16) * (Math.PI / 2));
}

function panelBody(out, contour, place, side) {
  const triangles = earcut(contour.flat());
  const segments = 4;
  for (let i = 0; i < triangles.length; i += 3) {
    const coordinates = triangles.slice(i, i + 3).map((index) => contour[index]);
    if (side < 0) coordinates.reverse();
    const [a, b, c] = coordinates;
    const point = (j, k) => {
      const uv = a.map(
        (value, axis) => value + ((b[axis] - value) * j + (c[axis] - value) * k) / segments,
      );
      return place(uv, panelDepth(contour, uv));
    };
    for (let j = 0; j < segments; j++) {
      for (let k = 0; k < segments - j; k++) {
        const p = point(j, k);
        const q = point(j + 1, k);
        const r = point(j, k + 1);
        const color = mix(mineral, moss, 0.43 + 0.11 * Math.cos(p[0] * 5.8 + p[1] * 6.2));
        tri(out, 'relief', [p, q, r], color);
        if (j + k < segments - 1) tri(out, 'relief', [q, point(j + 1, k + 1), r], color);
      }
    }
  }
}

function portalPanelReliefs(out, detail, panels, side) {
  for (const {
    center: [x, y],
    size: [width, height],
    paths,
  } of panels) {
    const place = ([u, v], depth) => {
      const point = shell(x + width * u, y + height * v, side);
      point[2] += side * depth;
      return point;
    };
    const sculpted = detail.reliefSides > 10;
    const contour = paths[0].slice(0, -1);
    if (sculpted) panelBody(out, contour, place, side);
    for (const [i, path] of paths.entries()) {
      const surfacePath = path.map((point) =>
        place(point, i === 0 ? 0.021 : sculpted ? panelDepth(contour, point) + 0.012 : 0.013),
      );
      trace(out, surfacePath, i === 0 ? 0.035 : 0.022, shade(dark, i === 0 ? 1.15 : 1.34), detail);
      if (i === 0 && detail.reliefSides > 10)
        trace(
          out,
          surfacePath.map(([x, y, z]) => [x, y + 0.021, z - side * 0.01]),
          0.018,
          sunWorn,
          detail,
        );
    }
  }
}

function portalBaseFigures(out, detail) {
  // These two smaller figures flank the face opposite the broad stair flight.
  const stone = shade(mix(mineral, moss, 0.48), 0.71);
  for (const { x, z, rings } of [
    {
      x: 1.63,
      z: -1.13,
      rings: [
        [0.75, 0.26, 0.26, -0.03],
        [0.88, 0.29, 0.27, -0.03],
        [1.04, 0.23, 0.23, 0.01],
        [1.2, 0.18, 0.18, 0.01],
        [1.28, 0.25, 0.21, 0.02],
        [1.4, 0.27, 0.23, 0.012],
        [1.54, 0.22, 0.18, 0.035],
        [1.63, 0.13, 0.13, 0.075],
        [1.67, 0.03, 0.03, 0.06],
      ],
    },
    {
      x: -1.93,
      z: -1.02,
      rings: [
        [0.75, 0.24, 0.26, 0.04],
        [0.86, 0.28, 0.25, 0.02],
        [0.99, 0.24, 0.22, 0.02],
        [1.12, 0.29, 0.23, 0.01],
        [1.21, 0.24, 0.22, -0.015],
        [1.32, 0.21, 0.2, -0.02],
        [1.42, 0.25, 0.23, -0.02],
        [1.53, 0.19, 0.18, -0.055],
        [1.58, 0.055, 0.06, -0.06],
      ],
    },
  ]) {
    loft(
      out,
      'relief',
      rings.map(([y, rx, rz, dx]) => radialRing(y, rx, rz, detail.reliefSides, [x + dx, z])),
      stone,
    );
    if (!detail.figures) continue;
    if (x > 0) {
      for (const side of [-1, 1]) {
        const eye = x + 0.02 + side * 0.107;
        ellipse(out, [eye, 1.434, z - 0.198], 0.091, 0.079, 0.059, dark, detail);
        ellipse(out, [eye, 1.43, z - 0.254], 0.051, 0.044, 0.025, stone, detail);
        trace(
          out,
          [
            [x + side * 0.19, 1.14, z - 0.083],
            [x + side * 0.126, 1.007, z - 0.21],
            [x + side * 0.027, 1.041, z - 0.242],
          ],
          0.041,
          shade(stone, 1.15),
          detail,
        );
      }
      ellipse(out, [x + 0.023, 1.349, z - 0.225], 0.044, 0.054, 0.045, shade(stone, 1.31), detail);
      trace(
        out,
        [
          [x - 0.08, 1.318, z - 0.201],
          [x + 0.015, 1.29, z - 0.245],
          [x + 0.094, 1.302, z - 0.209],
        ],
        0.018,
        dark,
        detail,
      );
    } else {
      for (const [y, breadth, offset] of [
        [1.147, 0.103, 0.01],
        [1.431, 0.093, -0.025],
      ]) {
        for (const side of [-1, 1]) {
          const eye = x + offset + side * breadth;
          ellipse(out, [eye, y, z - 0.196], 0.072, 0.058, 0.05, shade(stone, 1.22), detail);
          ellipse(out, [eye, y + 0.002, z - 0.243], 0.024, 0.028, 0.019, dark, detail);
        }
        trace(
          out,
          [
            [x + offset - 0.127, y - 0.071, z - 0.175],
            [x + offset, y - 0.09, z - 0.222],
            [x + offset + 0.12, y - 0.063, z - 0.173],
          ],
          0.023,
          shade(stone, 1.22),
          detail,
        );
      }
    }
  }
}

function stairTop(out, lo, hi, y, xLo, xHi, detail, step, riser = true) {
  const rows = detail.stoneRows;
  const colX = (i, t) => xLo + ((xHi - xLo) * i) / rows + 0.06 * Math.sin(i * 1.46 + step + t);
  const top = (i, t) => [colX(i, t), y + 0.017 * Math.cos(i * 2.1 + step + t), lo + (hi - lo) * t];
  for (let i = 0; i < rows; i++) {
    const color = mix(worn, moss, 0.18 + 0.17 * Math.sin(i * 2.3 + step * 0.77));
    quad(out, 'exposed', [top(i, 1), top(i + 1, 1), top(i + 1, 0), top(i, 0)], color);
    if (!riser) continue;
    const a = top(i, 1),
      b = top(i + 1, 1);
    quad(
      out,
      'exposed',
      [
        [a[0], step === 0 ? -0.19 : y - 0.154, a[2]],
        [b[0], step === 0 ? -0.19 : y - 0.154, b[2]],
        b,
        a,
      ],
      shade(color, 0.88),
    );
  }
  if (!riser) return;
  for (const edge of [0, rows]) {
    const a = top(edge, 0);
    const b = top(edge, 1);
    const wall = [a, b, [b[0], -0.24, b[2]], [a[0], -0.24, a[2]]];
    quad(out, 'exposed', edge === 0 ? wall.reverse() : wall, shade(worn, 0.91));
  }
}

// The panorama shows a connected pebble loop on the stair-side landing.
const landingInlay = [
  [-0.1, 1.06],
  [-0.29, 1.15],
  [-0.34, 1.37],
  [-0.26, 1.62],
  [-0.12, 1.83],
  [0.09, 1.96],
  [0.16, 1.88],
  [-0.03, 1.71],
  [-0.1, 1.53],
  [-0.04, 1.39],
  [0.09, 1.33],
  [0.18, 1.45],
  [0.15, 1.58],
  [0.04, 1.68],
  [-0.17, 1.72],
  [-0.27, 1.58],
];

function inlay(out, detail) {
  const individualStones = detail.reliefSides > 10;
  const rows = 3;
  const y = control.deck + 0.02;
  const width = 0.074;
  const edges = landingInlay.map(([x, z], i) => {
    const before = landingInlay[Math.max(0, i - 1)];
    const after = landingInlay[Math.min(i + 1, landingInlay.length - 1)];
    const dx = after[0] - before[0];
    const dz = after[1] - before[1];
    const scale = width / Math.hypot(dx, dz);
    return [
      [x + dz * scale, y, z - dx * scale],
      [x - dz * scale, y, z + dx * scale],
    ];
  });
  for (let i = 1; i < landingInlay.length; i++) {
    const [x0, z0] = landingInlay[i - 1];
    const [x1, z1] = landingInlay[i];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const nx = (z0 - z1) / length;
    const nz = (x1 - x0) / length;
    const [a, b] = edges[i - 1];
    const [c, d] = edges[i];
    const baseTone = individualStones ? 0.54 : 0.9 + 0.14 * Math.cos(i * 2.41);
    quad(out, 'exposed', [a, b, d, c], shade(mineral, baseTone));
    if (!individualStones) continue;
    const count = Math.max(1, Math.ceil(length / 0.041));
    for (let j = 0; j < count; j++) {
      for (let k = 0; k < rows; k++) {
        const seed = i * 77 + j * 3 + k;
        const t = (j + 0.49 + 0.13 * Math.sin(seed * 1.92)) / count;
        const lateral = 2 * width * ((k + 0.5) / rows - 0.5) + 0.008 * Math.sin(seed * 3.31);
        const x = x0 + (x1 - x0) * t + nx * lateral;
        const z = z0 + (z1 - z0) * t + nz * lateral;
        const radius = 0.021 * (0.83 + 0.15 * Math.cos(seed * 2.34));
        const rim = Array.from({ length: 5 }, (_, m) => {
          const a = (m * 2 * Math.PI) / 5 + seed;
          return [x + radius * Math.cos(a), y + 0.0015, z + radius * 0.8 * Math.sin(a)];
        });
        const color = shade(mineral, 1.1 + 0.53 * Math.cos(seed * 2.41));
        for (let m = 0; m < rim.length; m++) {
          tri(out, 'exposed', [[x, y + 0.006, z], rim[(m + 1) % rim.length], rim[m]], color);
        }
      }
    }
  }
}

function stairs(out, detail) {
  const count = 5;
  const landingFront = control.landingFront;
  for (let i = 0; i < count; i++) {
    const front = landingFront + 0.47 * (count - i),
      back = front - 0.47;
    const half = 4.83 - 0.23 * i;
    stairTop(out, back, front, ((i + 1) * control.deck) / count, -half, half, detail, i);
  }
  stairTop(out, -1.57, landingFront, control.deck, -9.3, 9.13, detail, 5, false);
  box(
    out,
    'exposed',
    [-9.3, -0.24, -1.56],
    [9.13, control.deck - 0.019, landingFront - 0.003],
    shade(worn, 0.85),
  );
  // The terrace feathers into the earth to either side of the cut steps.
  for (const [left, right] of [
    [-9.3, -3.91],
    [3.91, 9.13],
  ]) {
    const count = detail.stoneRows;
    const near = (x) => [x, control.deck + 0.021 * Math.cos(x * 2.73), landingFront - 0.002];
    const far = (x) => [x, 0, landingFront + 1.37 + 0.17 * Math.cos(x * 1.64)];
    for (let i = 0; i < count; i++) {
      const a = left + ((right - left) * i) / count,
        b = left + ((right - left) * (i + 1)) / count;
      quad(
        out,
        'exposed',
        [far(a), far(b), near(b), near(a)],
        mix(worn, moss, 0.4 + 0.23 * Math.sin(i * 1.8)),
      );
    }
  }
  const p = [
    [-9.3, control.deck, -1.57],
    [9.13, control.deck, -1.57],
    [9.13, 0, -2.71],
    [-9.3, 0, -2.71],
  ];
  quad(out, 'exposed', p, shade(worn, 0.93));
  if (detail.figures) inlay(out, detail);
}

const levels = {
  skyline: {
    dx: 0.58,
    rows: 1,
    reliefSides: 6,
    traceSides: 4,
    faces: false,
    figures: false,
    stoneRows: 2,
  },
  district: {
    dx: 0.32,
    rows: 3,
    reliefSides: 7,
    traceSides: 5,
    faces: true,
    figures: false,
    stoneRows: 5,
  },
  street: {
    dx: 0.2,
    rows: 6,
    reliefSides: 9,
    traceSides: 5,
    faces: true,
    figures: true,
    stoneRows: 8,
  },
  closeup: {
    dx: 0.115,
    rows: 10,
    capSegments: 8,
    reliefSides: 13,
    traceSides: 7,
    faces: true,
    figures: true,
    stoneRows: 14,
  },
  master: {
    dx: 0.084,
    rows: 14,
    capSegments: 10,
    reliefSides: 16,
    traceSides: 9,
    faces: true,
    figures: true,
    stoneRows: 22,
  },
};

export function buildGateway(out, name) {
  const detail = levels[name];
  stairs(out, detail);
  const portal = registeredPortal(out);
  barrier(portal, detail);
  reliefs(portal, detail);
  if (detail.figures) {
    portalPanelReliefs(portal, detail, portalPanels, -1);
    portalPanelReliefs(portal, detail, stairPanels, 1);
  }
  if (name !== 'skyline') portalBaseFigures(portal, detail);
}

export const buildSkyline = (out) => buildGateway(out, 'skyline');
export const buildDistrict = (out) => buildGateway(out, 'district');
export const buildStreet = (out) => buildGateway(out, 'street');
export const buildCloseup = (out) => buildGateway(out, 'closeup');
