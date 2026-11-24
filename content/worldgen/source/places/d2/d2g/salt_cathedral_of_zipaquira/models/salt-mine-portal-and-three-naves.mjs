import {
  facade,
  fan,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.95 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.88 },
  light: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = (u, y, d) => F.P(u, y, d);
const xz = ([x, , z]) => [x, z];
const rec = (a, b, c, d) =>
  [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ].map(([x, z]) => xz(P(x, 0, z)));
const stone = rgb('797570');
const rough = rgb('615d59');
const deck = rgb('8d8981');
const pale = rgb('c1b7a0');
const lower = rgb('3d3a40');
const purple = rgb('453f73');
const brown = rgb('583a34');
const rail = rgb('873d33');
const blue = rgb('9db6ff');
const altarLight = rgb('c28350');
const tau = 2 * Math.PI;
const { nave } = site;

function box(out, slot, u, U, y, Y, d, D, color) {
  fbox(out, slot, F, u, U, y, Y, d, D, color, { bottom: true });
}

function renderLimb(out, a, b, width, d, color) {
  const [u, y] = a,
    [U, Y] = b;
  const mag = Math.hypot(U - u, Y - y);
  const du = (-(Y - y) * width) / mag,
    dy = ((U - u) * width) / mag;
  const A = P(u - du, y - dy, d),
    B = P(U - du, Y - dy, d),
    C = P(U + du, Y + dy, d),
    D = P(u + du, y + dy, d);
  const raised = P((u + U) / 2, (y + Y) / 2, d + 0.082);
  tri(out, 'carved', A, B, raised, pale);
  tri(out, 'carved', B, C, raised, color);
  tri(out, 'carved', C, D, raised, color);
  tri(out, 'carved', D, A, raised, pale);
}

function basRelief(out, detail) {
  const d = 7.15;
  box(out, 'carved', -2.62, 2.62, 0.82, 3.45, d - 0.24, d, pale);
  if (detail === 0) return;
  const figures = [
    {
      hip: [-0.54, 1.72],
      neck: [-0.65, 2.94],
      armL: [-1.17, 2.48],
      armR: [0.06, 2.85],
      handL: [-1.64, 2.73],
      handR: [0.12, 3.17],
      kneeL: [-0.83, 1.09],
      kneeR: [0.02, 1.45],
      footL: [-1.09, 0.97],
      footR: [0.21, 0.92],
    },
    {
      hip: [1.64, 1.63],
      neck: [1.56, 2.84],
      armL: [1.24, 2.24],
      armR: [1.54, 2.12],
      handL: [0.92, 2.17],
      handR: [1.08, 1.92],
      kneeL: [1.36, 1.31],
      kneeR: [2.11, 1.28],
      footL: [1.08, 0.97],
      footR: [2.26, 0.95],
    },
    {
      hip: [-1.76, 1.22],
      neck: [-2.02, 2.05],
      armL: [-1.92, 1.52],
      armR: [-1.45, 1.71],
      handL: [-1.69, 1.17],
      handR: [-1.12, 1.82],
      kneeL: [-1.45, 1.34],
      kneeR: [-1.6, 1.23],
      footL: [-1.25, 0.98],
      footR: [-1.23, 0.91],
    },
  ];
  for (const [i, f] of figures.entries()) {
    const k = i === 2 ? 0.72 : 1;
    const surface = d + 0.063 + i * 0.017;
    const hi = rgb(i % 2 === 0 ? 'b4a991' : 'b8ae98');
    renderLimb(out, f.hip, f.neck, 0.222 * k, surface, hi);
    const [u, y] = f.neck;
    const pts = Array.from({ length: detail > 1 ? 12 : 7 }, (_, i) => {
      const a = (i * tau) / (detail > 1 ? 12 : 7);
      return P(
        u + 0.155 * k * Math.cos(a),
        y + 0.174 * k + 0.19 * k * Math.sin(a),
        surface + 0.065,
      );
    });
    fan(out, 'carved', pts, pale);
    for (const s of ['L', 'R']) {
      renderLimb(out, f.neck, f['arm' + s], 0.097 * k, surface + 0.031, hi);
      renderLimb(out, f['arm' + s], f['hand' + s], 0.077 * k, surface + 0.04, pale);
      renderLimb(out, f.hip, f['knee' + s], 0.122 * k, surface + 0.021, hi);
      renderLimb(out, f['knee' + s], f['foot' + s], 0.105 * k, surface + 0.024, hi);
    }
  }
  renderLimb(out, [-1.73, 2.69], [0.42, 3.3], 0.031, d + 0.2, stone);
  renderLimb(out, [0.95, 2.15], [0.81, 0.99], 0.028, d + 0.195, stone);
  if (detail > 1) {
    const center = P(-1.58, 2.67, d + 0.02);
    for (let i = 0; i < 8; i++) {
      const a = 0.1 + i * 0.22,
        b = a + 0.09;
      tri(
        out,
        'carved',
        center,
        P(-1.58 + 0.81 * Math.cos(a), 2.67 + 0.48 * Math.sin(a), d + 0.034),
        P(-1.58 + 0.81 * Math.cos(b), 2.67 + 0.48 * Math.sin(b), d + 0.034),
        rgb('b0a58d'),
      );
    }
  }
}

function outside(out, detail) {
  const stops = [
    [-4.4, -0.29],
    [0.8, -0.2],
    [5.85, -2.15],
    [7.08, -2.56],
    [12, -4.66],
    [16.7, -6.31],
    [21.55, -8.21],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [d, y] = stops[i - 1],
      [D, Y] = stops[i];
    const w = d < 7.08 ? 3.195 : 3.67;
    quad4(out, 'paving', P(-w, y, d), P(-w, Y, D), P(w, Y, D), P(w, y, d), deck);
    for (const s of [-1, 1]) {
      if (d >= 1 && d < 5.7) continue;
      const a = P(s * 2.93, y, d),
        b = P(s * 3.4, Y, D);
      const h = d < 7.21 ? 3.48 : y + 4.4,
        H = D < 7.21 ? 3.44 : Y + 2.45;
      const face = [a, b, P(s * 3.4, H, D), P(s * 2.93, h, d)];
      quad4(out, 'concrete', ...(s > 0 ? face : face.slice().reverse()), stone);
      const offset = s * 0.3;
      const c = P(s * 2.93 + offset, h, d),
        e = P(s * 3.4 + offset, H, D);
      quad4(out, 'concrete', face[3], face[2], e, c, rough);
      quad4(
        out,
        'concrete',
        P(s * 2.93 + offset, y - 0.42, d),
        c,
        e,
        P(s * 3.4 + offset, Y - 0.42, D),
        rough,
      );
    }
  }
  for (const [u, U] of [
    [-3.35, -2.51],
    [2.51, 3.35],
  ]) {
    box(out, 'concrete', u, U, -2.67, 3.5, 5.82, 7.16, stone);
    box(out, 'rock', u * 0.963, U * 0.963, -0.34, 3.7, -4.4, 1.65, rough);
  }
  box(out, 'concrete', -3.34, 3.34, 0.68, 3.51, 5.82, 7.15, stone);
  box(out, 'rock', -3.21, 3.21, 3.14, 4.12, -4.4, 1.64, rough);
  basRelief(out, detail);
  if (detail > 0) {
    for (let i = 1; i < stops.length - 1; i++) {
      const [d, y] = stops[i],
        [D, Y] = stops[i + 1];
      if (d < 0.0) continue;
      box(out, 'steel', -0.045, 0.045, y - 0.09, y + 0.98, d - 0.046, d + 0.046, rail);
      quad4(
        out,
        'steel',
        P(-0.038, y + 0.916, d),
        P(-0.038, Y + 0.916, D),
        P(0.038, Y + 0.916, D),
        P(0.038, y + 0.916, d),
        rail,
      );
      quad4(
        out,
        'steel',
        P(0.035, y + 0.77, d),
        P(0.035, y + 0.904, d),
        P(0.035, Y + 0.904, D),
        P(0.035, Y + 0.77, D),
        rail,
      );
    }
  }
  if (detail < 2) box(out, 'rock', -2.46, 2.46, -2.34, 3.14, -7.31, -7.15, lower);
}

function wallTint(i, j, tint) {
  const k = 0.82 + 0.17 * (0.5 + 0.5 * Math.sin(i * 1.66 + j * 4.39));
  return tint.map((v) => Math.min(1, v * k));
}

function cavern(out, { center, front, back, width, height, floor }, detail, color) {
  const w = width / 2;
  const profile = [
    [-1, 0],
    [-1, 0.29],
    [-0.956, 0.65],
    [-0.802, 0.87],
    [-0.42, 0.977],
    [0, 1],
    [0.44, 0.976],
    [0.83, 0.867],
    [0.97, 0.63],
    [1, 0.31],
    [1, 0],
  ];
  const controls = [-65.7, -71.34, -76.1, -80.3, -85.94, -91.99, -100.6, -108.8];
  const slices = [front, ...controls.filter((d) => d < front && d > back), back];
  const section = (d, j) =>
    profile.map(([u, y], i) => {
      const offset =
        j === 0 || j === slices.length - 1 || y === 0 ? 0 : Math.sin(j * 4.23 + i * 8.27) * 0.29;
      return P(center + u * w + offset, floor + y * height + offset, d);
    });
  for (let k = 1; k < slices.length; k++) {
    const D = slices[k],
      d = slices[k - 1];
    const A = section(d, k - 1),
      B = section(D, k);
    for (let i = 0; i + 1 < profile.length; i++) {
      const entranceWall = (i === 0 && center >= 0) || (i === profile.length - 2 && center <= 0);
      const passage = entranceWall && (d === -71.34 || d === -85.94);
      if (passage) continue;
      const tint = wallTint(i, k, color);
      if (detail > 2) {
        const c = A[i].map((a, j) => (a + A[i + 1][j] + B[i][j] + B[i + 1][j]) * 0.25);
        tri(out, 'rock', A[i + 1], A[i], c, tint);
        tri(out, 'rock', B[i + 1], A[i + 1], c, wallTint(i + 1, k, color));
        tri(out, 'rock', B[i], B[i + 1], c, tint);
        tri(out, 'rock', A[i], B[i], c, wallTint(i, k + 1, color));
      } else quad4(out, 'rock', B[i], B[i + 1], A[i + 1], A[i], tint);
    }
  }
  cap(out, 'paving', rec(center - w, back, center + w, front), floor, lower);
  const end = section(back, slices.length - 1);
  fan(out, 'rock', end.slice().reverse(), color);
  const entry = section(front, 0);
  if (center !== 0) {
    fan(out, 'rock', entry, color);
  } else {
    fan(out, 'rock', entry.slice(1, -1), color);
    const fill = (u, U, y, Y) =>
      quad4(out, 'rock', P(U, y, front), P(u, y, front), P(u, Y, front), P(U, Y, front), color);
    fill(-w, -2.36, floor, floor + height * 0.29);
    fill(2.36, w, floor, floor + height * 0.31);
    fill(-2.36, 2.36, floor + 4.16, floor + height * 0.299);
  }
}

function accessTunnel(out, detail) {
  const points = [
    [0, 0.02, 1.05],
    [0, -1.43, -6.43],
    [-0.65, -7.03, -15.12],
    [-2.4, -15.9, -29.5],
    [-2.87, -25.5, -43.1],
    [0, nave.floor, -56.38],
    [0, nave.floor, -58.51],
  ];
  const profile = [
    [-2.47, 0],
    [-2.55, 2.32],
    [-1.87, 3.69],
    [0, 4.19],
    [1.84, 3.69],
    [2.56, 2.24],
    [2.46, 0],
  ];
  const world = (p, r) => P(p[0] + r[0], p[1] + r[1], p[2]);
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1],
      b = points[k];
    const A = profile.map((r) => world(a, r)),
      B = profile.map((r) => world(b, r));
    for (let j = 0; j + 1 < profile.length; j++) {
      quad4(out, 'rock', B[j], B[j + 1], A[j + 1], A[j], wallTint(k, j, rough));
    }
    quad4(out, 'paving', A.at(-1), B.at(-1), B[0], A[0], k < 3 ? deck : lower);
    if (detail > 2 && k > 1 && k < points.length - 1) {
      const n = Math.ceil((a[2] - b[2]) / 1.11);
      for (let j = 1; j <= n; j++) {
        const t = j / n,
          v = (j - 1) / n;
        const u = a[0] + (b[0] - a[0]) * t,
          d = a[2] + (b[2] - a[2]) * t,
          D = a[2] + (b[2] - a[2]) * v;
        const y = a[1] + (b[1] - a[1]) * v;
        box(out, 'paving', u - 2.21, u + 2.21, y - 0.66, y + 0.045, d, D, deck);
      }
    }
  }
}

function naves(out, detail) {
  const f = nave.floor;
  cavern(
    out,
    { center: 0, front: nave.front, back: nave.back, width: nave.width, height: 18.9, floor: f },
    detail,
    purple,
  );
  for (const side of [-1, 1]) {
    const center = side * 17.58;
    cavern(
      out,
      { center, front: -69.22, back: -116.22, width: 11.5, height: 12.9, floor: f },
      detail,
      rgb('423c48'),
    );
    for (const [lo, hi] of [
      [-76.1, -71.34],
      [-91.99, -85.94],
    ]) {
      const u0 = Math.min(side * 9.17, side * 12.05),
        u1 = Math.max(side * 9.17, side * 12.05);
      box(out, 'rock', u0, u1, f - 0.15, f + 0.054, lo, hi, rough);
      box(out, 'rock', u0, u1, f + 4.19, f + 4.76, lo, hi, purple);
      for (const p of [lo, hi]) {
        box(out, 'rock', u0, u1, f + 0.05, f + 4.23, p - 0.17, p + 0.16, rough);
      }
    }
    for (const [i, d] of [-76, -91.8, -105.4].entries()) {
      const center = xz(P(side * 8.14, 0, d));
      const profile = [
        [f, 1.1, 1.16],
        [f + 2.17, 1.29, 1.33],
        [f + 7.44, 1.19, 1.26],
        [f + 12.04, 1.33, 1.5],
        [f + 16.35, 1.72, 1.86],
      ];
      lathe(
        out,
        'rock',
        center,
        profile,
        detail > 2 ? 15 : 9,
        i % 2 === 0 ? rgb('6055a4') : rgb('3e3d81'),
      );
    }
  }
  const { altar } = nave;
  box(out, 'paving', -6.8, 6.8, f, f + 0.5, -117.95, -105.88, lower);
  box(out, 'paving', -5.8, 5.8, f + 0.45, f + 0.91, -117.95, -106.63, deck);
  box(out, 'paving', -4.65, 4.65, f + 0.87, f + 1.27, -117.95, -107.4, lower);
  box(out, 'carved', -1.76, 1.76, f + 1.23, f + 2.43, -111.63, -110.32, pale);
  const rows = detail > 2 ? 15 : 8;
  const cols = detail > 2 ? 16 : 10;
  const altarRock = (i, j) => {
    const u = -7.63 + (i * 15.26) / cols;
    const y = f + 0.63 + (j * 16.18) / rows;
    const p = Math.sin(i * 3.26 + j * 2.07);
    return P(u + p * 0.19, y + p * 0.19, -117.36 + p * 0.081);
  };
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const u = ((i + 0.5) / cols) * 2 - 1;
      const v = (j + 0.5) / rows;
      const light = Math.max(0, 1 - Math.abs(u) * (0.45 + v) - v * 0.47);
      const tint = altarLight.map((a, k) => brown[k] + (a - brown[k]) * light);
      const a = altarRock(i, j),
        b = altarRock(i + 1, j);
      const c = altarRock(i + 1, j + 1),
        d = altarRock(i, j + 1);
      tri(out, 'rock', a, b, d, wallTint(i, j, tint));
      tri(out, 'rock', b, c, d, wallTint(i + 2, j + 1, tint));
    }
  }
  const top = altar.base + altar.crossHeight,
    bar = altar.base + altar.crossHeight * 0.69;
  box(out, 'light', -0.51, 0.51, altar.base, top, altar.front - 0.38, altar.front, blue);
  box(out, 'light', -4.82, -0.51, bar - 0.46, bar + 0.46, altar.front - 0.37, altar.front, blue);
  box(out, 'light', 0.51, 4.82, bar - 0.46, bar + 0.46, altar.front - 0.37, altar.front, blue);
  const pews = detail > 2 ? 14 : 9;
  for (const side of [-1, 1]) {
    const a = side > 0 ? 1.67 : -7.18,
      b = side > 0 ? 7.18 : -1.67;
    for (let i = 0; i < pews; i++) {
      const d = -71.71 - (i * 31) / pews;
      box(out, 'wood', a, b, f + 0.45, f + 0.58, d - 0.27, d + 0.2, brown);
      box(out, 'wood', a, b, f + 0.55, f + 1.12, d + 0.083, d + 0.25, brown);
      if (detail > 2) {
        for (const u of [a + 0.21, (a + b) / 2, b - 0.21])
          box(out, 'wood', u - 0.065, u + 0.065, f, f + 0.51, d - 0.12, d + 0.12, brown);
      }
    }
  }
  const disc = xz(P(0, 0, -64.5));
  lathe(
    out,
    'carved',
    disc,
    [
      [f + 0.004, 2.34, 2.34],
      [f + 0.12, 2.31, 2.31],
      [f + 0.14, 2.15, 2.15],
    ],
    detail > 2 ? 36 : 20,
    rgb('99958a'),
  );
  const p = [
    [0.12, -64.48],
    [-0.62, -64.27],
    [-1.24, -64.53],
    [-1.66, -65.15],
    [-1.46, -65.69],
    [-0.64, -65.4],
    [-0.12, -64.81],
    [0.17, -64.69],
  ].map(([u, d]) => P(u, f + 0.177, d));
  fan(out, 'carved', p.slice().reverse(), pale);
  const q = [
    [0.18, -64.6],
    [0.44, -64.67],
    [0.85, -65.17],
    [1.58, -65.44],
    [1.58, -64.84],
    [1.15, -64.22],
    [0.57, -64.2],
  ].map(([u, d]) => P(u, f + 0.178, d));
  fan(out, 'carved', q, pale);
}

function build(out, detail) {
  outside(out, detail);
  if (detail > 1) {
    accessTunnel(out, detail);
    naves(out, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
