import {
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const red = [0.61, 0.15, 0.092];
const blue = [0.102, 0.23, 0.31];
const black = [0.098, 0.085, 0.068];
const cream = [0.8, 0.675, 0.495];
const bull = [0.4, 0.294, 0.223];
const ochre = [0.69, 0.397, 0.148];
const gold = [0.78, 0.536, 0.245];

function relief(out, side, base, detail) {
  const front = 23.18;
  const map = ([u, y, depth]) => [side * (front + depth), base + y, -side * u];
  const detailFaces = detail >= 3;
  const surface = 'paint';
  const tri = (points, color) =>
    out.addTriangle(surface, 'palette:#ffffff', points, normalFor(...points), [], color);
  const blob = (u, y, d, rx, ry, rz, color) =>
    sphere(
      out,
      surface,
      map([u, y, d]),
      [rz, ry, rx],
      color,
      detailFaces ? 12 : 8,
      detailFaces ? 6 : 4,
    );
  const tube = (stations, colors) => {
    const faces = detailFaces ? 10 : 7;
    const rings = stations.map(([u, y, d, r, depth], i) => {
      const a = stations[Math.max(0, i - 1)],
        b = stations[Math.min(stations.length - 1, i + 1)];
      const [du, dy] = normalize([b[0] - a[0], b[1] - a[1]]);
      return Array.from({ length: faces }, (_, j) => {
        const phase = (2 * Math.PI * j) / faces;
        const flat = r * Math.cos(phase);
        return map([u - dy * flat, y + du * flat, d + depth * Math.sin(phase)]);
      });
    });
    const striped = Array.isArray(colors[0]);
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1],
        b = rings[i];
      const color = striped ? colors[(i - 1) % colors.length] : colors;
      for (let j = 0; j < faces; j++) {
        const k = (j + 1) % faces;
        tri([a[j], a[k], b[k]], color);
        tri([a[j], b[k], b[j]], color);
      }
    }
    const a = rings[0],
      b = rings.at(-1);
    for (let i = 1; i < faces - 1; i++) {
      tri([a[0], a[i + 1], a[i]], striped ? colors[0] : colors);
      tri([b[0], b[i], b[i + 1]], striped ? colors[(rings.length - 2) % colors.length] : colors);
    }
  };
  function feline(center, sign, mane, shade) {
    const u = (n) => center + sign * n;
    tube(
      [
        [-0.98, 0.38, 0.25, 0.068, 0.075],
        [-0.79, 0.56, 0.25, 0.23, 0.223],
        [-0.22, 0.68, 0.3, 0.33, 0.25],
        [0.44, 0.93, 0.32, 0.41, 0.27],
        [0.84, 0.97, 0.32, 0.24, 0.19],
      ].map(([x, ...row]) => [u(x), ...row]),
      shade,
    );
    tube(
      [
        [-0.66, 0.56, 0.3, 0.187, 0.115],
        [-0.87, 0.34, 0.37, 0.143, 0.1],
        [-0.55, 0.19, 0.43, 0.098, 0.079],
        [-0.27, 0.13, 0.43, 0.08, 0.09],
      ].map(([x, ...row]) => [u(x), ...row]),
      shade,
    );
    tube(
      [
        [0.43, 0.91, 0.46, 0.13, 0.14],
        [0.64, 0.6, 0.52, 0.122, 0.093],
        [1.02, 0.49, 0.48, 0.085, 0.085],
        [1.19, 0.55, 0.41, 0.07, 0.074],
      ].map(([x, ...row]) => [u(x), ...row]),
      gold,
    );
    tube(
      [
        [-0.89, 0.61, 0.28, 0.073, 0.064],
        [-1.1, 0.73, 0.22, 0.062, 0.058],
        [-1.42, 0.6, 0.2, 0.051, 0.05],
        [-1.45, 0.39, 0.18, 0.035, 0.044],
      ].map(([x, ...row]) => [u(x), ...row]),
      shade,
    );
    if (mane) blob(u(0.61), 1.02, 0.35, 0.39, 0.335, 0.256, ochre);
    blob(u(0.88), 0.936, 0.485, 0.245, 0.242, 0.165, gold);
    blob(u(1.065), 0.808, 0.544, 0.143, 0.106, 0.106, shade);
    blob(u(0.775), 1.146, 0.483, 0.077, 0.084, 0.063, gold);
    if (!detailFaces) return;
    blob(u(0.917), 0.976, 0.63, 0.018, 0.016, 0.015, black);
    blob(u(1.147), 0.817, 0.616, 0.04, 0.041, 0.025, black);
    for (let i = 0; i < 4; i++) blob(u(1.0 + i * 0.047), 0.529, 0.542, 0.041, 0.039, 0.037, gold);
  }
  function cattle(center, scale, sign) {
    const u = (n) => center + sign * scale * n;
    const y = (n) => 0.085 + scale * n;
    blob(u(-0.22), y(0.39), 0.27, 0.73 * scale, 0.285 * scale, 0.225, bull);
    tube(
      [
        [-0.34, 0.38, 0.38, 0.104, 0.089],
        [-0.06, 0.24, 0.45, 0.095, 0.091],
        [-0.7, 0.08, 0.49, 0.054, 0.053],
        [-0.92, 0.11, 0.47, 0.069, 0.056],
      ].map(([x, h, d, r, w]) => [u(x), y(h), d, r * scale, w]),
      bull,
    );
    blob(u(0.66), y(0.28), 0.41, 0.32 * scale, 0.177 * scale, 0.138, bull);
    blob(u(0.86), y(0.19), 0.5, 0.15 * scale, 0.102 * scale, 0.088, cream);
    tube(
      [
        [0.64, 0.365, 0.5, 0.068, 0.059],
        [0.54, 0.46, 0.55, 0.05, 0.05],
        [0.67, 0.58, 0.5, 0.02, 0.027],
      ].map(([x, h, d, r, w]) => [u(x), y(h), d, r * scale, w]),
      cream,
    );
    if (detailFaces) blob(u(0.733), y(0.33), 0.55, 0.032, 0.026, 0.021, black);
  }
  function head(u, y, d, r, hair) {
    blob(u, y, d, r * 0.88, r * 1.09, r, cream);
    blob(u - 0.015, y + r * 0.64, d - 0.012, r * 0.96, r * 0.62, r * 0.98, hair);
    blob(u, y - r * 0.6, d + 0.038, r * 0.62, r * 0.55, r * 0.8, hair);
    if (!detailFaces) return;
    blob(u, y + 0.005, d + r * 0.95, r * 0.21, r * 0.26, r * 0.21, cream);
    for (const sign of [-1, 1])
      blob(u + sign * r * 0.36, y + r * 0.204, d + r * 0.934, r * 0.17, r * 0.106, r * 0.08, black);
    for (const i of [-2, -1, 0, 1, 2])
      blob(u + r * i * 0.23, y - r * 0.78, d + r * 0.74, r * 0.148, r * 0.275, r * 0.185, hair);
  }
  function serpent(start, y, length, sign, scale, depth) {
    const steps = detailFaces ? 16 : 8;
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const r = (0.135 * (1 - t) + 0.018) * scale;
      return [
        start + t * length * sign,
        y + Math.sin(t * Math.PI * 3.2) * 0.16 * scale * (1 - t),
        depth + Math.sin(t * Math.PI * 2.1) * 0.09,
        r,
        r * 0.8,
      ];
    });
    tube(points, [blue, red, ochre, black]);
    return points[0];
  }
  function daemon() {
    for (const [i, u] of [4.15, 4.61, 5.05].entries()) {
      const d = 0.43 - 0.035 * i;
      blob(u, 0.48, d, 0.172, 0.215, 0.137, cream);
      tube(
        [
          [u - 0.08, 0.58, d, 0.08, 0.063],
          [u - 0.22, 0.44, d + 0.08, 0.06, 0.055],
          [u - 0.24, 0.32, d + 0.135, 0.062, 0.046],
        ],
        cream,
      );
      tube(
        [
          [u + 0.09, 0.54, d, 0.078, 0.072],
          [u + 0.2, 0.35, d + 0.085, 0.06, 0.057],
          [u + 0.02, 0.31, d + 0.16, 0.065, 0.061],
        ],
        cream,
      );
      head(u, 0.703 - i * 0.026, d + 0.04, 0.111, i === 1 ? black : blue);
      tube(
        [
          [u + 0.02, 0.42, d - 0.07, 0.109, 0.094],
          [u + 0.11, 0.67, d - 0.12, 0.12, 0.059],
          [u + 0.32, 0.77 - i * 0.02, d - 0.12, 0.053, 0.04],
        ],
        red,
      );
      serpent(u, 0.301 - i * 0.07, 3.2 - (u - 4.11), 1, 0.74 - i * 0.1, d);
      if (detailFaces) blob(u - 0.219, 0.36, d + 0.204, 0.057, 0.11, 0.047, [blue, red, ochre][i]);
    }
    tube(
      [
        [3.35, 0.11, 0.25, 0.103, 0.07],
        [3.31, 0.4, 0.347, 0.134, 0.073],
        [3.34, 0.72, 0.35, 0.105, 0.087],
        [3.43, 0.95, 0.31, 0.053, 0.06],
      ],
      red,
    );
  }
  function wrestlers() {
    serpent(-4.44, 0.26, 2.88, -1, 1.07, 0.36);
    tube(
      [
        [-4.85, 0.25, 0.36, 0.174, 0.126],
        [-4.53, 0.37, 0.43, 0.179, 0.137],
        [-4.15, 0.49, 0.45, 0.13, 0.124],
      ],
      cream,
    );
    head(-4.01, 0.547, 0.49, 0.144, black);
    tube(
      [
        [-6.22, 0.29, 0.32, 0.101, 0.072],
        [-5.88, 0.38, 0.47, 0.108, 0.084],
        [-5.69, 0.56, 0.47, 0.147, 0.119],
        [-5.22, 0.61, 0.49, 0.185, 0.141],
        [-4.91, 0.649, 0.475, 0.126, 0.104],
      ],
      ochre,
    );
    head(-4.837, 0.694, 0.518, 0.12, black);
    tube(
      [
        [-5.034, 0.61, 0.52, 0.092, 0.079],
        [-4.76, 0.47, 0.64, 0.09, 0.079],
        [-4.39, 0.55, 0.577, 0.052, 0.05],
      ],
      cream,
    );
    tube(
      [
        [-4.23, 0.49, 0.48, 0.099, 0.084],
        [-4.46, 0.37, 0.6, 0.073, 0.071],
        [-4.76, 0.51, 0.58, 0.056, 0.05],
      ],
      cream,
    );
  }
  return { tube, blob, feline, cattle, serpent, daemon, wrestlers };
}

export function buildPediments(out, base, detail) {
  const west = relief(out, -1, base, detail);
  const east = relief(out, 1, base, detail);
  if (detail === 1) {
    west.cattle(0, 0.91, 1);
    west.blob(-1.62, 0.79, 0.31, 0.98, 0.34, 0.24, ochre);
    west.blob(1.58, 0.77, 0.34, 1.01, 0.35, 0.24, gold);
    for (const u of [4.15, 4.61, 5.05]) west.blob(u, 0.46, 0.3, 0.17, 0.31, 0.19, cream);
    west.serpent(-4.44, 0.26, 2.88, -1, 0.86, 0.36);
    east.cattle(0, 0.82, -1);
    east.blob(1.27, 0.83, 0.31, 1.04, 0.38, 0.24, gold);
    return;
  }
  west.cattle(0, 1, 1);
  west.feline(-1.34, 1, true, ochre);
  west.feline(1.28, -1, false, gold);
  west.wrestlers();
  west.daemon();
  east.cattle(-0.31, 0.87, -1);
  east.feline(1.13, -1, true, gold);
  east.feline(-1.52, 1, false, ochre);
  for (const sign of [-1, 1]) {
    east.serpent(sign * 4.3, 0.35, 3.56, sign, 1.12, 0.33);
    east.blob(sign * 4.29, 0.42, 0.37, 0.25, 0.13, 0.13, ochre);
  }
}
