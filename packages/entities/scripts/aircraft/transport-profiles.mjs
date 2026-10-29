/** Transport outlines in metres. Nose stations are [distance aft of tip, half-width,
 * bottom, top]. Published overall dimensions and manufacturer three-views constrain
 * the envelopes; individual window outlines are reconstructed from the cited photos
 * in source/aircraft-shape-review-2026-10-28.json, not an interchangeable glass band.
 */
import { detailKit, group, quad } from './mesh-kit.mjs';

const airbusWindows = [
  [
    [1.5, 1.7],
    [55, 2.7],
    [44, 3.25],
    [1.5, 2.4],
  ],
  [
    [58, 2.82],
    [71, 3.9],
    [52, 4.0],
    [48, 3.33],
  ],
  [
    [73, 4.03],
    [71, 4.45],
    [65, 4.78],
    [56, 4.62],
    [55, 4.15],
  ],
];
export const transportProfiles = {
  'airbus-a320neo': {
    cy: 3.85,
    ry: 2.03,
    radius: 1.975,
    eye: [0.57, 4.76, 3.65],
    cabinWidth: 2.7,
    nose: [
      [0, 0.012, 3.08, 3.12],
      [0.3, 0.52, 2.72, 3.58],
      [0.8, 0.97, 2.35, 4.02],
      [1.5, 1.35, 2.1, 4.43],
      [2.1, 1.56, 1.99, 4.88],
      [2.8, 1.76, 1.91, 5.4],
      [3.6, 1.9, 1.84, 5.74],
      [4.6, 1.975, 1.82, 5.88],
      [6.5, 1.975, 1.82, 5.88],
    ],
    windows: airbusWindows,
    cabin: {
      count: 39,
      front: 6.4,
      back: 29.5,
      halfWidth: 0.145,
      halfHeight: 0.205,
      rounding: 0.07,
    },
    engine: { radius: 1.28, length: 3.6, x: 5.75, y: 1.94, z: 2.3 },
    wing: { y: 2.67, z: 0.2, span: 15.12, sweep: 6.6, root: 6.1, tip: 1.2, dihedral: 0.087 },
    winglet: { height: 2.43, out: 0.805, root: 1.4, tip: 0.43, sweep: 1.35 },
    tail: {
      z: -12.8,
      base: 4.26,
      height: 7.5,
      root: 5.6,
      tip: 1.45,
      sweep: 3.9,
      span: 6.225,
      hY: 4.55,
      hRoot: 3.85,
      hTip: 1.15,
      hSweep: 2.55,
    },
  },
  'a220-300': {
    cy: 3.56,
    ry: 1.85,
    radius: 1.75,
    eye: [0.57, 4.48, 3.95],
    cabinWidth: 2.55,
    nose: [
      [0, 0.012, 2.76, 2.8],
      [0.4, 0.45, 2.43, 3.2],
      [1, 0.86, 2.15, 3.72],
      [1.8, 1.17, 1.94, 4.2],
      [2.7, 1.42, 1.8, 4.78],
      [3.6, 1.61, 1.73, 5.16],
      [4.65, 1.73, 1.71, 5.39],
      [6.3, 1.75, 1.71, 5.41],
    ],
    windows: [
      [
        [1.5, 2.0],
        [60, 3.0],
        [43, 4.0],
        [1.5, 3.05],
      ],
      [
        [63, 3.15],
        [70, 4.85],
        [50, 4.9],
        [47, 4.08],
      ],
    ],
    cabin: { count: 38, front: 6.6, back: 30.7, halfWidth: 0.17, halfHeight: 0.23, rounding: 0.08 },
    engine: { radius: 1.2, length: 3.5, x: 5.4, y: 2.02, z: 1.75 },
    wing: { y: 2.48, z: -0.15, span: 15.25, sweep: 6.5, root: 5.65, tip: 1.08, dihedral: 0.075 },
    winglet: { height: 1.25, out: 0.55, root: 1.15, tip: 0.25, sweep: 0.95 },
    tail: {
      z: -13.3,
      base: 3.9,
      height: 7.6,
      root: 5.3,
      tip: 1.3,
      sweep: 3.7,
      span: 5.55,
      hY: 4.1,
      hRoot: 3.45,
      hTip: 0.95,
      hSweep: 2.05,
    },
  },
  'boeing-737-800': {
    cy: 3.3,
    ry: 1.92,
    radius: 1.88,
    eye: [0.57, 4.15, 4.05],
    cabinWidth: 2.65,
    smoothNose: true,
    nose: [[0,0.012,2.59,2.62],[0.1,0.22,2.41,2.83],[0.4,0.5,2.12,3.13],[1,0.89,1.78,3.62],[1.8,1.23,1.53,4.1],[2.65,1.51,1.42,4.63],[3.5,1.72,1.38,5.01],[4.5,1.86,1.38,5.2],[6,1.88,1.38,5.22]],
    // Pane corners: [half-width, height, distance aft of tip].
    glazing: [[[0.038,4.02,2.2],[1.13,4.02,2.94],[1.06,4.65,3.51],[0.038,4.69,3.03]],[[1.18,4,3.05],[1.57,3.77,4.05],[1.37,4.61,4.12],[1.11,4.64,3.61]],[[1.6,3.78,4.18],[1.75,4.01,5.02],[1.57,4.6,4.83],[1.4,4.61,4.25]]],
    cabin: {
      count: 41,
      front: 6.8,
      back: 31.3,
      halfWidth: 0.145,
      halfHeight: 0.205,
      rounding: 0.06,
    },
    engine: { radius: 0.99, length: 2.8, x: 4.85, y: 1.55, z: 2.25, flatten: 0.91 },
    wing: { y: 2.3, z: -0.1, span: 15.3, sweep: 6.1, root: 6.3, tip: 1.15, dihedral: 0.095 },
    winglet: { height: 2.5, out: 0.72, root: 1.35, tip: 0.4, sweep: 1.25 },
    tail: {
      z: -13.9,
      base: 3.85,
      height: 8.7,
      root: 5.4,
      tip: 1.4,
      sweep: 4.1,
      span: 7.15,
      hY: 3.9,
      hRoot: 4.2,
      hTip: 1.2,
      hSweep: 2.8,
    },
  },
  'citation-cj4': {
    cy: 1.72,
    ry: 0.89,
    radius: 0.86,
    eye: [0.36, 2.13, 2.7],
    cabinWidth: 1.42,
    nose: [
      [0, 0.008, 1.21, 1.24],
      [0.3, 0.27, 1.03, 1.49],
      [0.75, 0.46, 0.9, 1.71],
      [1.3, 0.61, 0.85, 1.94],
      [1.9, 0.73, 0.83, 2.27],
      [2.5, 0.81, 0.83, 2.52],
      [3.15, 0.85, 0.83, 2.6],
      [4, 0.86, 0.83, 2.61],
    ],
    windows: [
      [
        [2, 1.38],
        [47, 1.86],
        [42, 2.45],
        [2, 2.12],
      ],
      [
        [52, 1.98],
        [74, 2.94],
        [51, 3.04],
        [46, 2.51],
      ],
    ],
    cabin: {
      count: 6,
      front: 5.25,
      back: 8.9,
      halfWidth: 0.18,
      halfHeight: 0.215,
      rounding: 0.065,
    },
    engine: { radius: 0.48, length: 1.75, x: 1.25, y: 2.37, z: -3.25 },
    wing: { y: 1.04, z: -1.4, span: 7.1, sweep: 1.45, root: 2.65, tip: 0.9, dihedral: 0.065 },
    tail: {
      z: -5.45,
      base: 2.06,
      height: 2.61,
      root: 2.35,
      tip: 0.72,
      sweep: 1.48,
      span: 2.75,
      hY: 4.53,
      hRoot: 1.7,
      hTip: 0.67,
      hSweep: 0.65,
    },
    aft: [
      [0.68, 0.97, -0.03],
      [0.78, 0.8, 0.05],
      [0.88, 0.45, 0.32],
      [1, 0.015, 0.55],
    ],
  },
  'gulfstream-g650er': {
    cy: 2.63,
    ry: 1.43,
    radius: 1.47,
    eye: [0.53, 3.37, 3.75],
    cabinWidth: 2.35,
    smoothNose: true,
    nose: [[0,0.01,2.05,2.08],[0.12,0.2,1.9,2.25],[0.45,0.43,1.62,2.55],[1.1,0.76,1.32,2.94],[1.9,1.04,1.21,3.39],[2.8,1.26,1.2,3.81],[3.8,1.41,1.2,4.04],[5.1,1.47,1.2,4.06],[6.3,1.47,1.2,4.06]],
    // Pane corners: [half-width, height, distance aft of tip].
    glazing: [[[0.035,3.13,1.56],[0.95,3.14,2.31],[0.88,3.76,3.16],[0.035,3.79,2.58]],[[1,3.15,2.44],[1.32,3.16,3.96],[1.36,3.2,4.08],[1.23,3.67,4.06],[1.17,3.73,3.95],[0.94,3.75,3.28]]],
    cabin: { count: 8, front: 6.65, back: 18.95, halfWidth: 0.355, halfHeight: 0.26 },
    engine: { radius: 0.91, length: 3.65, x: 2.04, y: 3.35, z: -7.0 },
    wing: { y: 1.65, z: -1.65, span: 13.35, sweep: 9.3, root: 5.9, tip: 0.98, dihedral: 0.035 },
    winglet: { height: 1.35, out: 0.36, root: 1.0, tip: 0.32, sweep: 0.95 },
    tail: {
      z: -10.55,
      base: 3.31,
      height: 4.51,
      root: 4.3,
      tip: 1.14,
      sweep: 2.67,
      span: 5.85,
      hY: 7.65,
      hRoot: 3.05,
      hTip: 1.0,
      hSweep: 2.5,
    },
    aft: [
      [0.7, 0.99, 0],
      [0.8, 0.83, 0.15],
      [0.9, 0.45, 0.45],
      [1, 0.018, 0.67],
    ],
  },
  'embraer-e175': {
    cy: 2.97,
    ry: 1.62,
    radius: 1.505,
    eye: [0.53, 3.72, 3.55],
    cabinWidth: 2.3,
    smoothNose: true,
    nose: [[0,0.012,2.35,2.38],[0.1,0.22,2.16,2.59],[0.35,0.47,1.93,2.85],[0.9,0.8,1.65,3.26],[1.6,1.09,1.46,3.75],[2.4,1.31,1.37,4.25],[3.25,1.45,1.35,4.51],[4.4,1.505,1.35,4.59],[5.7,1.505,1.35,4.59]],
    // Pane corners: [half-width, height, distance aft of tip].
    glazing: [[[0.035,3.57,1.65],[1.01,3.56,2.37],[0.94,4.18,3.08],[0.035,4.22,2.47]],[[1.06,3.55,2.5],[1.4,3.36,3.81],[1.22,4.15,3.59],[1,4.18,3.2]]],
    cabin: {
      count: 23,
      front: 6.1,
      back: 24.8,
      halfWidth: 0.15,
      halfHeight: 0.205,
      rounding: 0.07,
    },
    engine: { radius: 0.86, length: 3.0, x: 4.5, y: 1.65, z: 1.6 },
    wing: { y: 2.04, z: -0.45, span: 12.95, sweep: 4.85, root: 4.7, tip: 1.03, dihedral: 0.08 },
    winglet: { height: 1.6, out: 0.25, root: 1.02, tip: 0.32, sweep: 0.86 },
    tail: {
      z: -10.9,
      base: 3.25,
      height: 6.61,
      root: 4.4,
      tip: 1.05,
      sweep: 3.05,
      span: 4.95,
      hY: 3.5,
      hRoot: 3.0,
      hTip: 1.0,
      hSweep: 1.9,
    },
  },
  'dash-8-q400': {
    cy: 2.58,
    ry: 1.32,
    radius: 1.345,
    eye: [0.5, 3.2, 3.5],
    cabinWidth: 2.16,
    smoothNose: true,
    nose: [[0,0.012,1.63,1.66],[0.1,0.2,1.48,1.88],[0.4,0.42,1.3,2.11],[1,0.76,1.22,2.56],[1.7,1.04,1.23,3.12],[2.4,1.22,1.25,3.61],[3.3,1.32,1.26,3.87],[4.4,1.345,1.26,3.9],[5.6,1.345,1.26,3.9]],
    // Pane corners: [half-width, height, distance aft of tip].
    glazing: [[[0.032,2.94,1.56],[0.88,2.97,2.12],[0.82,3.53,2.82],[0.032,3.57,2.34]],[[0.93,2.96,2.23],[1.24,2.98,3.86],[1.11,3.51,3.68],[0.87,3.52,2.91]]],
    cabin: {
      count: 27,
      front: 7.1,
      back: 24.4,
      halfWidth: 0.145,
      halfHeight: 0.22,
      rounding: 0.07,
    },
    engine: { radius: 0.57, length: 5.0, x: 4.63, y: 3.32, z: -0.25 },
    wing: { y: 3.75, z: -0.05, span: 13.2, sweep: 0.6, root: 2.85, tip: 1.42, dihedral: 0.044 },
    tail: {
      z: -11.45,
      base: 3.14,
      height: 5.22,
      root: 4.2,
      tip: 1.2,
      sweep: 1.48,
      span: 4.635,
      hY: 8.15,
      hRoot: 2.4,
      hTip: 0.92,
      hSweep: 0.8,
    },
  },
};

// UV coordinates only determine which skin cells are cut. The photographed
// pane vertices determine the actual 3D shape, including the nearly level brow.
export function prepareGlazing(p) {
  const s = { length: 0 };
  p.windows = p.glazing.map((pane) => pane.map(([x, y, d]) => {
    const [, w, b, t] = transportSection(s, p, -d);
    return [Math.atan2(x / w, (y - (b + t) / 2) / ((t - b) / 2)) * 180 / Math.PI, d];
  }));
  return p;
}
for (const p of Object.values(transportProfiles)) if (p.glazing) prepareGlazing(p);

export function transportFrame(s) {
  const p = transportProfiles[s.slug];
  if (!p) return;
  const eye = [p.eye[0], p.eye[1], s.length / 2 - p.eye[2]];
  return {
    heli: false,
    fighter: false,
    large: true,
    radius: p.radius,
    cy: p.cy,
    ry: p.ry,
    cabinZ: eye[2],
    cabinWidth: p.cabinWidth,
    eye,
    panelZ: eye[2] + 0.67,
    floor: eye[1] - (s.category === 'business' ? 1.12 : 1.25),
    profile: p,
  };
}

export function transportSection(s, p, z) {
  const d = s.length / 2 - z;
  const last = p.nose.at(-1);
  const aft = (
    p.aft ?? [
      [0.67, 1, 0],
      [0.78, 0.84, 0.1],
      [0.89, 0.48, 0.32],
      [1, 0.012, 0.52],
    ]
  ).map(([u, w, rise]) => [
    s.length * u,
    p.radius * w,
    p.cy + rise - p.ry * w,
    p.cy + rise + p.ry * w,
  ]);
  const sections = [...p.nose, ...aft.filter((a) => a[0] > last[0])];
  let i = sections.findIndex((a) => a[0] >= d);
  i = Math.max(1, i < 0 ? sections.length - 1 : i);
  const a = sections[i - 1],
    b = sections[i],
    t = Math.max(0, Math.min(1, (d - a[0]) / (b[0] - a[0])));
  return a.map((v, k) => {
    if (!p.smoothNose || !k || i >= p.nose.length) return v + (b[k] - v) * t;
    const slope = (j) => {
      const prev = sections[Math.max(0, j - 1)], here = sections[j], next = sections[Math.min(sections.length - 1, j + 1)];
      const left = j ? (here[k] - prev[k]) / (here[0] - prev[0]) : (next[k] - here[k]) / (next[0] - here[0]);
      const right = j < sections.length - 1 ? (next[k] - here[k]) / (next[0] - here[0]) : left;
      return left * right <= 0 ? 0 : 2 * left * right / (left + right);
    };
    const h = b[0] - a[0];
    return (2*t*t*t-3*t*t+1)*v + (t*t*t-2*t*t+t)*h*slope(i-1) + (-2*t*t*t+3*t*t)*b[k] + (t*t*t-t*t)*h*slope(i);
  });
}

export function transportPoint(s, p, z, angle, offset = 0) {
  const [, w, b, t] = transportSection(s, p, z),
    cy = (b + t) / 2,
    ry = (t - b) / 2;
  return [Math.sin(angle) * (w + offset), cy + Math.cos(angle) * (ry + offset), z];
}

const windowCache = new WeakMap();
function paneData(s, p) {
  if (windowCache.has(p)) return windowCache.get(p);
  const panes = [];
  for (const side of [-1, 1])
    for (const [index, source] of p.windows.entries()) {
      const uv = source.map(([a, d]) => [
        s.length / 2 - d,
        side > 0 ? (a * Math.PI) / 180 : 2 * Math.PI - (a * Math.PI) / 180,
      ]);
      const world = p.glazing ? p.glazing[index].map(([x,y,d]) => [side*x,y,s.length/2-d]) : uv.map(([z, a]) => transportPoint(s, p, z, a));
      panes.push({ uv, world });
    }
  windowCache.set(p, panes);
  return panes;
}
function panePoint(s, p, uv, only) {
  // Straight manufactured pane edges, shared by the surrounding skin. Mapping
  // an edge through an ellipse produces the false arched/eyelid windshields.
  let nearest;
  for (const pane of only ? [only] : paneData(s, p)) {
    for (let j = 0; j < pane.uv.length; j++) {
      const a = pane.uv[j],
        b = pane.uv[(j + 1) % pane.uv.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = ((uv[0] - a[0]) * dx + (uv[1] - a[1]) * dy) / (dx * dx + dy * dy);
      const distance = Math.abs((uv[0] - a[0]) * dy - (uv[1] - a[1]) * dx);
      const metric = p.radius,
        tn = Math.max(
          0,
          Math.min(
            1,
            ((uv[0] - a[0]) * dx + (uv[1] - a[1]) * dy * metric * metric) /
              (dx * dx + dy * dy * metric * metric),
          ),
        );
      const q = [a[0] + dx * tn, a[1] + dy * tn],
        dist = Math.hypot(uv[0] - q[0], (uv[1] - q[1]) * metric);
      if (!nearest || dist < nearest.dist) {
        const curved = transportPoint(s, p, q[0], q[1]);
        nearest = {
          dist,
          delta: pane.world[j].map(
            (v, k) => v + (pane.world[(j + 1) % pane.world.length][k] - v) * tn - curved[k],
          ),
        };
      }
      if (t >= -1e-6 && t <= 1 + 1e-6 && distance < 1e-7) {
        const A = pane.world[j],
          B = pane.world[(j + 1) % pane.world.length];
        return A.map((v, k) => v + (B[k] - v) * t);
      }
    }
    {
      for (let j = 1; j < pane.uv.length - 1; j++) {
        const [a, b, c] = [pane.uv[0], pane.uv[j], pane.uv[j + 1]],
          den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        const u = ((b[1] - c[1]) * (uv[0] - c[0]) + (c[0] - b[0]) * (uv[1] - c[1])) / den;
        const v = ((c[1] - a[1]) * (uv[0] - c[0]) + (a[0] - c[0]) * (uv[1] - c[1])) / den,
          w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-6)
          return pane.world[0].map(
            (q, k) => q * u + pane.world[j][k] * v + pane.world[j + 1][k] * w,
          );
      }
    }
  }
  const base = transportPoint(s, p, uv[0], uv[1]);
  // Fair the neighbouring skin into the flat glazing. Moving only the aperture
  // boundary leaves the next mesh row on the original ellipse and buckles it.
  if (nearest && nearest.dist < 0.7) {
    const t = 1 - nearest.dist / 0.7,
      weight = t * t * (3 - 2 * t);
    return base.map((v, k) => v + nearest.delta[k] * weight);
  }
  return base;
}

/** Subtract each convex pane in longitudinal/azimuth coordinates, retaining identical
 * boundary vertices in the skin, inner lining and glazing. No oversized blanket cut. */
export function transportCell(s, p, uv, emit) {
  const clip = (points, dist) => {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        da = dist(a),
        db = dist(b);
      if (da >= -1e-10) result.push(a);
      if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
    }
    return result;
  };
  let opaque = [uv];
  for (const data of paneData(s, p)) {
    const pane = data.uv;
    const area = pane.reduce((sum, a, i) => {
      const b = pane[(i + 1) % pane.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const next = [];
    for (const cell of opaque) {
      let inside = cell;
      for (let i = 0; i < pane.length && inside.length; i++) {
        const a = pane[i],
          b = pane[(i + 1) % pane.length];
        const dist = (q) =>
          Math.sign(area) * ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
        const out = clip(inside, (q) => -dist(q));
        if (out.length >= 3) next.push(out);
        inside = clip(inside, dist);
      }
      if (inside.length >= 3)
        emit(
          'glass',
          inside.map((q) => panePoint(s, p, q, data)),
        );
    }
    opaque = next;
  }
  for (const cell of opaque)
    emit(
      'skin',
      cell.map((q) => panePoint(s, p, q)),
    );
}

export function transportWindowFrames(d, s, p, material) {
  for (const pane of paneData(s, p))
    for (let j = 0; j < pane.world.length; j++)
      d.rod(
        pane.world[j],
        pane.world[(j + 1) % pane.world.length],
        s.category === 'business' ? 0.009 : 0.014,
        material,
      );
}

export function transportInteriorWidth(s, p, z, y) {
  let previous = panePoint(s, p, [z, 0]);
  for (let j = 1; j <= 128; j++) {
    const next = panePoint(s, p, [z, (j * Math.PI) / 128]);
    if (previous[1] >= y && next[1] < y) {
      const t = (y - previous[1]) / (next[1] - previous[1]);
      return Math.max(0, previous[0] + (next[0] - previous[0]) * t - 0.028);
    }
    previous = next;
  }
  return 0;
}

export function transportCoaming(root, s, f, material) {
  const p = f.profile;
  if (!p) return;
  const g = group(root, 'fitted-glareshield-deck'),
    d = detailKit(g, g.name),
    y = f.eye[1] - 0.225;
  const start = f.panelZ + 0.11,
    end = s.length / 2;
  const width = (z) => transportInteriorWidth(s, p, z, y);
  for (let z = start; z < end; z += 0.09) {
    const w = width(z);
    if (w < 0.001) break;
    let next = Math.min(end, z + 0.09),
      w2 = width(next);
    if (w2 < 0.001) {
      // Stop at the skin intersection, rather than carrying a zero-width tip
      // beyond the falling nose roof where it appears as an exterior black fleck.
      let inside = z,
        outside = next;
      for (let i = 0; i < 20; i++) {
        const mid = (inside + outside) / 2;
        if (width(mid) >= 0.001) inside = mid;
        else outside = mid;
      }
      next = inside;
      w2 = width(next);
    }
    quad(d, [-w, y, z], [w, y, z], [w2, y, next], [-w2, y, next], material, [0, 1, 0]);
    for (const side of [-1, 1])
      quad(
        d,
        [side * w, y, z],
        [side * w2, y, next],
        [side * w2, y - 0.22, next],
        [side * w, y - 0.22, z],
        material,
        [side, 0, 0],
      );
  }
  d.finish();
}

/** Swept, tapered wingtip with a short curved transition instead of a miniature tail fin. */
export function transportWinglet(d, at, side, p, material) {
  const rings = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10,
      blend = t * t * (3 - 2 * t),
      x = at[0] + side * p.out * Math.sin((t * Math.PI) / 2),
      y = at[1] + p.height * blend,
      chord = p.root + (p.tip - p.root) * t,
      le = at[2] - p.sweep * t;
    rings.push([x, y, le, chord, 0.015 - 0.006 * t]);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j],
      b = rings[j + 1];
    for (const face of [-1, 1])
      quad(
        d,
        [a[0] + face * a[4], a[1], a[2]],
        [b[0] + face * b[4], b[1], b[2]],
        [b[0] + face * b[4], b[1], b[2] - b[3]],
        [a[0] + face * a[4], a[1], a[2] - a[3]],
        material,
        [face, 0, 0],
      );
    for (const edge of [0, 1])
      quad(
        d,
        [a[0] - a[4], a[1], a[2] - edge * a[3]],
        [a[0] + a[4], a[1], a[2] - edge * a[3]],
        [b[0] + b[4], b[1], b[2] - edge * b[3]],
        [b[0] - b[4], b[1], b[2] - edge * b[3]],
        material,
        [0, 0, edge ? -1 : 1],
      );
  }
  for (const [a, normal] of [
    [rings[0], -1],
    [rings.at(-1), 1],
  ])
    quad(
      d,
      [a[0] - a[4], a[1], a[2]],
      [a[0] + a[4], a[1], a[2]],
      [a[0] + a[4], a[1], a[2] - a[3]],
      [a[0] - a[4], a[1], a[2] - a[3]],
      material,
      [0, normal, 0],
    );
}
