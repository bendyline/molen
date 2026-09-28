/** Individually documented cast-iron lighthouse exteriors in the Baltic. */
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const white = [0.88, 0.88, 0.83],
  red = [0.68, 0.035, 0.035],
  black = [0.035, 0.042, 0.04];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const shaftProfile = [
  [0.22, 3.02],
  [0.38, 2.93],
  [0.74, 2.81],
  [1.22, 2.755],
  [20.5, 1.37],
  [21.02, 1.43],
  [21.84, 1.49],
];
function radius(y) {
  let j = 1;
  while (j < shaftProfile.length - 1 && shaftProfile[j][0] < y) j++;
  const [a, r] = shaftProfile[j - 1],
    [b, s] = shaftProfile[j];
  return r + ((s - r) * (y - a)) / (b - a);
}
function curvedLine(out, points, color = red, width = 0.008) {
  for (let i = 1; i < points.length; i++)
    tube(out, 'metal', points[i - 1], points[i], width, color, 6);
}
function circleOpening(out, angle, y) {
  const r = radius(y),
    rr = 0.13,
    half = 0.235,
    theta = Math.asin(half / r);
  const toWorld = (u, yy, offset = 0) => P(radius(yy) + offset, yy, angle + u / r);
  const corners = [];
  for (let i = 0; i < 64; i++) {
    const a = (i * TAU) / 64,
      b = ((i + 1) * TAU) / 64;
    const pt = (t, outer) => {
      const scale = outer ? half / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))) : rr;
      return [Math.cos(t) * scale, y + Math.sin(t) * scale];
    };
    const oa = pt(a, true),
      ob = pt(b, true),
      ia = pt(a, false),
      ib = pt(b, false);
    // Fill the square shell cut around an actual round light aperture, following the cone.
    const ps = [toWorld(...oa), toWorld(...ob), toWorld(...ib), toWorld(...ia)];
    if (normalFor(...ps.slice(0, 3)).reduce((s, v, k) => s + v * P(1, 0, angle)[k], 0) < 0)
      ps.reverse();
    quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), white);
    const a0 = toWorld(...ia),
      b0 = toWorld(...ib),
      a1 = toWorld(...ia, -0.13),
      b1 = toWorld(...ib, -0.13);
    const well = [a0, a1, b1, b0];
    quad(out, 'metal', well, normalFor(...well.slice(0, 3)), red);
    const glass = [toWorld(0, y, -0.135), a1, b1];
    if (normalFor(...glass)[0] * Math.sin(angle) + normalFor(...glass)[2] * Math.cos(angle) < 0)
      glass.reverse();
    out.addTriangle(
      'glass',
      'metric:uv',
      glass,
      normalFor(...glass),
      [[0, 0], ia, ib],
      [0.1, 0.16, 0.17],
    );
    // Red diamond surround follows the plate surface, with a circular white lip.
    const diamondR = 0.225 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
    corners.push(toWorld(Math.cos(a) * diamondR, y + Math.sin(a) * diamondR, 0.012));
    const lip = [
      toWorld(Math.cos(a) * rr, y + Math.sin(a) * rr, 0.014),
      toWorld(Math.cos(a) * (rr + 0.016), y + Math.sin(a) * (rr + 0.016), 0.014),
      toWorld(Math.cos(b) * (rr + 0.016), y + Math.sin(b) * (rr + 0.016), 0.014),
      toWorld(Math.cos(b) * rr, y + Math.sin(b) * rr, 0.014),
    ];
    if (normalFor(...lip.slice(0, 3)).reduce((s, v, k) => s + v * P(1, 0, angle)[k], 0) < 0)
      lip.reverse();
    quad(out, 'metal', lip, normalFor(...lip.slice(0, 3)), red);
  }
  curvedLine(out, [...corners, corners[0]], red, 0.014);
  return { angle, y: y - half, w: 2 * radius(y - half) * Math.sin(theta), h: half * 2 };
}
function ironShaft(out) {
  const openings = [];
  for (const y of [2.05, 6.62, 11.12, 15.62, 20.04]) {
    const n = y < 3 ? 8 : 4,
      phase = y < 3 ? Math.PI / 8 : Math.PI / 4;
    for (let i = 0; i < n; i++) openings.push(circleOpening(out, phase + (i * TAU) / n, y));
  }
  openings.push({ angle: 0, y: 0.3, w: 0.94, h: 1.91 });
  // Use only the curved shell faces: the round ports above supply their own true reveals.
  const facadeOnly = {
    addQuad(slot, ref, p, n, uv, c) {
      if (ref === 'metric:uv') out.addQuad(slot, ref, p, n, uv, c);
    },
  };
  shell(facadeOnly, {
    profile: shaftProfile,
    holes: openings,
    slot: 'metal',
    color: white,
    segments: 192,
  });
  const z = radius(1.2) - 0.07;
  panel(out, 'metal', -0.47, 0.47, 0.3, 2.21, z - 0.13, [0.16, 0.18, 0.16]);
  for (const x of [-0.52, 0.52])
    box(out, 'metal', [x - 0.045, 0.25, z - 0.16], [x + 0.045, 2.28, z + 0.055], white);
  for (const y of [0.25, 2.23])
    box(out, 'metal', [-0.56, y - 0.045, z - 0.16], [0.56, y + 0.045, z + 0.055], white);
  for (const yy of [0.69, 1.47])
    box(
      out,
      'metal',
      [-0.39, yy - 0.28, z - 0.116],
      [0.39, yy + 0.28, z - 0.083],
      [0.22, 0.24, 0.21],
    );
  tube(out, 'metal', [0.31, 1.13, z - 0.08], [0.31, 1.26, z - 0.08], 0.021, black, 8);
  box(out, 'granite', [-0.68, 0, z - 0.3], [0.68, 0.15, z + 0.83], [0.45, 0.44, 0.4]);
  box(out, 'granite', [-0.62, 0.15, z - 0.3], [0.62, 0.3, z + 0.42], [0.52, 0.51, 0.47]);
  // Cast-iron panel seams and the red splayed base lines, visible in the municipal aerial.
  for (const y of [4.1, 8.59, 13.09, 17.59, 20.88])
    ring(
      out,
      'metal',
      y,
      radius(y) - 0.005,
      radius(y) + 0.012,
      0.018,
      white.map((v) => v * 0.95),
      192,
    );
  for (let i = 0; i < 40; i++) {
    const a = (i * TAU) / 40;
    curvedLine(
      out,
      Array.from({ length: 13 }, (_, j) => {
        const y = 0.3 + j * 0.068;
        return P(radius(y) + 0.016, y, a);
      }),
      red,
      0.009,
    );
  }
  lathe(
    out,
    'concrete',
    [
      [0, 3.15],
      [0.14, 3.15],
      [0.22, 3.03],
    ],
    [0.28, 0.29, 0.26],
    192,
  );
}
function piercedBracket(out, a) {
  const o = transformed(out, a),
    x = 0.07;
  // A curved pierced iron corbel: radial/vertical profile, small round web opening.
  const profile = [
    [1.36, 20.65],
    [1.43, 21.84],
    [2.48, 21.84],
    [2.48, 21.65],
  ];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    profile.push([2.43 - 0.96 * t, 21.57 - 0.88 * (1 - Math.sqrt(1 - (1 - t) ** 2))]);
  }
  const hole = Array.from({ length: 24 }, (_, i) => [
    1.67 + 0.073 * Math.cos((i * TAU) / 24),
    21.48 + 0.095 * Math.sin((i * TAU) / 24),
  ]);
  const ps = [...profile, ...hole],
    indices = earcut(ps.flat(), [profile.length], 2);
  for (const side of [-1, 1])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((k) => [x * side, ps[k][1], ps[k][0]]);
      if (normalFor(...p)[0] * side < 0) p.reverse();
      o.addTriangle(
        'metal',
        'metric:uv',
        p,
        [side, 0, 0],
        p.map((v) => [v[2], v[1]]),
        white,
      );
    }
  for (const loop of [profile, hole])
    for (let i = 0; i < loop.length; i++) {
      const a0 = loop[i],
        b = loop[(i + 1) % loop.length],
        p = [
          [-x, a0[1], a0[0]],
          [x, a0[1], a0[0]],
          [x, b[1], b[0]],
          [-x, b[1], b[0]],
        ];
      quad(o, 'metal', p, normalFor(...p.slice(0, 3)), white);
    }
  for (const [r, y] of [
    [1.47, 20.76],
    [2.36, 21.68],
  ])
    sphere(o, 'metal', [0, y, r], [0.085, 0.115, 0.085], white, 16, 8);
}
function decoratedDrum(out) {
  const r = 1.37,
    y0 = 21.97,
    y1 = 23.8;
  lathe(
    out,
    'metal',
    [
      [y0, r],
      [y1, r],
    ],
    white,
    160,
  );
  // Eight characteristic red-lined panels: Greek-key corners and central diamond medallions.
  const curve = (a, u, y) => P(r + 0.009, y, a + u / r);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) * TAU) / 8,
      w = 0.49;
    const line = (ps) =>
      curvedLine(
        out,
        ps.map(([u, y]) => curve(a, u, y)),
        red,
        0.006,
      );
    line([
      [-w, y0 + 0.1],
      [-w, y1 - 0.11],
      [w, y1 - 0.11],
      [w, y0 + 0.1],
      [-w, y0 + 0.1],
    ]);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const yy = sy < 0 ? y0 + 0.17 : y1 - 0.18,
          xx = sx * (w - 0.04);
        line([
          [xx - sx * 0.025, yy],
          [xx - sx * 0.025, yy + sy * 0.08],
          [xx - sx * 0.11, yy + sy * 0.08],
          [xx - sx * 0.11, yy],
          [xx - sx * 0.025, yy],
        ]);
      }
    const yy = (y0 + y1) / 2;
    line([
      [0, yy - 0.22],
      [0.13, yy],
      [0, yy + 0.22],
      [-0.13, yy],
      [0, yy - 0.22],
    ]);
    line(
      Array.from({ length: 33 }, (_, j) => [
        0.052 * Math.cos((j * TAU) / 32),
        yy + 0.052 * Math.sin((j * TAU) / 32),
      ]),
    );
  }
}
function gallery(out) {
  ring(out, 'metal', 20.57, 1.29, 1.43, 0.09, white, 160);
  ring(out, 'metal', 21.84, 1.35, 2.5, 0.12, white, 8);
  ring(out, 'metal', 21.96, 1.32, 2.52, 0.055, black, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8;
    piercedBracket(out, a);
    const post = transformed(out, a, [0, 0, 0]);
    lathe(
      post,
      'metal',
      [
        [21.96, 0.075],
        [22.04, 0.08],
        [22.13, 0.045],
        [22.94, 0.035],
        [22.99, 0.068],
        [23.03, 0.048],
        [23.07, 0.058],
        [23.11, 0.025],
      ],
      red,
      24,
      [0, 2.46],
    );
    sphere(post, 'metal', [0, 23.11, 2.46], [0.04, 0.042, 0.04], red, 16, 8);
    for (const y of [22.02, 22.96])
      tube(out, 'metal', P(2.46, y, a), P(2.46, y, b), 0.023, y > 22.5 ? red : black, 8);
    for (let j = 1; j < 11; j++) {
      const t = j / 11,
        pa = P(2.46, 22.02, a),
        pb = P(2.46, 22.02, b),
        x = pa[0] + (pb[0] - pa[0]) * t,
        z = pa[2] + (pb[2] - pa[2]) * t;
      tube(out, 'metal', [x, 22.02, z], [x, 22.94, z], 0.012, black, 6);
    }
  }
  decoratedDrum(out);
  ring(out, 'metal', 23.8, 1.22, 1.68, 0.07, black, 160);
}
function lantern(out) {
  const r = 1.365;
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10,
      b = ((i + 1) * TAU) / 10;
    const p = [P(r, 23.89, a), P(r, 23.89, b), P(r, 25.7, b), P(r, 25.7, a)];
    quad(out, 'glassClear', p, normalFor(...p.slice(0, 3)), [0.9, 0.97, 0.95]);
    tube(
      out,
      'metal',
      P(r + 0.012, 23.86, a),
      P(r + 0.012, 25.73, a),
      0.025,
      [0.58, 0.57, 0.49],
      10,
    );
    const face = transformed(out, (a + b) / 2);
    for (const x of [-0.34, 0.34]) {
      tube(face, 'metal', [x, 25.03, 1.324], [x, 25.15, 1.324], 0.013, black, 8);
      tube(face, 'metal', [x, 25.03, 1.324], [x + 0.055, 25.03, 1.324], 0.011, black, 8);
      tube(face, 'metal', [x + 0.055, 25.03, 1.324], [x + 0.055, 25.15, 1.324], 0.011, black, 8);
    }
    box(face, 'metal', [-0.25, 25.39, 1.14], [0.25, 25.58, 1.25], black);
  }
  for (const y of [23.88, 25.69]) ring(out, 'metal', y, 1.32, 1.43, 0.07, black, 160);
  // Visible optical assembly, following the official restored-lantern close photograph.
  lathe(
    out,
    'metal',
    [
      [23.86, 0.32],
      [24.05, 0.32],
      [24.13, 0.41],
      [24.22, 0.35],
    ],
    [0.31, 0.38, 0.37],
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [24.2, 0.3],
      [24.33, 0.41],
      [24.59, 0.52],
      [24.87, 0.4],
      [25.12, 0.24],
    ],
    [0.6, 0.55, 0.31],
    64,
  );
  for (let y = 24.24; y < 25.14; y += 0.068) {
    const r0 = y < 24.59 ? 0.3 + (y - 24.2) * 0.56 : 0.52 - (y - 24.59) * 0.53;
    ring(out, 'metal', y, r0 - 0.015, r0 + 0.018, 0.012, [0.5, 0.43, 0.24], 64);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    beam(
      out,
      'metal',
      P(0.35, 24.2, a),
      P(0.52, 24.59, a + Math.PI / 8),
      0.015,
      0.014,
      [0.4, 0.34, 0.17],
    );
    beam(
      out,
      'metal',
      P(0.52, 24.59, a + Math.PI / 8),
      P(0.24, 25.12, a),
      0.015,
      0.014,
      [0.4, 0.34, 0.17],
    );
  }
  const profile = [[25.76, 1.45]];
  for (let i = 1; i <= 24; i++) {
    const a = (i * Math.PI) / 2 / 24;
    profile.push([25.76 + 1.08 * Math.sin(a), Math.max(0.12, 1.45 * Math.cos(a))]);
  }
  lathe(out, 'metal', profile, red, 160);
  for (let j = 0; j < 10; j++) {
    const a = (j * TAU) / 10;
    curvedLine(
      out,
      profile.slice(0, -1).map(([y, r]) => P(r + 0.007, y, a)),
      red.map((v) => v * 0.83),
      0.009,
    );
    for (let i = 2; i < 22; i += 2) {
      const [y, r] = profile[i];
      sphere(
        out,
        'metal',
        P(r + 0.013, y, a),
        [0.013, 0.013, 0.013],
        red.map((v) => v * 0.82),
        8,
        4,
      );
    }
  }
  lathe(
    out,
    'metal',
    [
      [26.79, 0.22],
      [26.97, 0.115],
      [27.06, 0.16],
    ],
    black,
    48,
  );
  sphere(out, 'metal', [0, 27.23, 0], [0.23, 0.28, 0.23], [0.18, 0.17, 0.13], 48, 24);
  ring(out, 'metal', 27.24, 0.21, 0.235, 0.018, black, 64);
  tube(out, 'metal', [0, 27.48, 0], [0, 28.3, 0], 0.017, black, 8);
  sphere(out, 'metal', [0, 28.29, 0], [0.034, 0.034, 0.034], black, 16, 8);
  beam(out, 'metal', [-0.53, 28.03, 0], [0.54, 28.03, 0], 0.025, 0.018, black);
  box(out, 'metal', [-0.54, 27.88, -0.017], [-0.2, 28.18, 0.017], black);
  const arrow = [
    [0.55, 28.03, 0.012],
    [0.38, 28.14, 0.012],
    [0.38, 27.92, 0.012],
  ];
  out.addTriangle(
    'metal',
    'metric:uv',
    arrow,
    [0, 0, 1],
    arrow.map((p) => [p[0], p[1]]),
    black,
  );
}
function oilHouse(out) {
  // Mapped oil-store way232111866, transformed from east/south into north-facing tower axes.
  const o = transformed(out, 0.191, [2.655, 0, -11.765]),
    half = 2.43,
    z = 2.41;
  box(o, 'rubble', [-half, 0, -z], [half, 0.24, z], [0.43, 0.4, 0.32]);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const f = transformed(o, a);
    const hole =
      a === Math.PI
        ? [{ x: 0, y: 0.24, w: 1.05, h: 1.95, depth: 0.24 }]
        : a === Math.PI / 2
          ? [{ x: 0, y: 1.25, w: 0.75, h: 0.9, depth: 0.18 }]
          : [];
    piercedFacade(f, {
      half,
      y0: 0.24,
      y1: 2.85,
      z,
      holes: hole,
      slot: 'rubble',
      color: [0.49, 0.45, 0.36],
    });
    box(
      f,
      'brick',
      [-half - 0.02, 2.68, z - 0.14],
      [half + 0.02, 2.85, z + 0.035],
      [0.49, 0.16, 0.095],
    );
    for (const h of hole) {
      for (const x of [-h.w / 2 - 0.09, h.w / 2 + 0.09])
        box(
          f,
          'brick',
          [x - 0.055, h.y - 0.025, z - 0.08],
          [x + 0.055, h.y + h.h + 0.085, z + 0.045],
          [0.49, 0.16, 0.095],
        );
      box(
        f,
        'brick',
        [-h.w / 2 - 0.16, h.y + h.h + 0.055, z - 0.08],
        [h.w / 2 + 0.16, h.y + h.h + 0.18, z + 0.045],
        [0.49, 0.16, 0.095],
      );
    }
    if (a === Math.PI) {
      panel(f, 'wood', -0.52, 0.52, 0.26, 2.18, z - 0.22, [0.25, 0.25, 0.2]);
      for (let x = -0.43; x < 0.5; x += 0.15)
        box(
          f,
          'wood',
          [x - 0.012, 0.26, z - 0.21],
          [x + 0.012, 2.18, z - 0.195],
          [0.19, 0.19, 0.16],
        );
    }
  }
  for (const a of [0, Math.PI]) {
    const f = transformed(o, a);
    const p = [
      [-half, 2.85, z],
      [half, 2.85, z],
      [0, 4.04, z],
    ];
    f.addTriangle(
      'rubble',
      'metric:uv',
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      [0.5, 0.46, 0.38],
    );
    beam(
      f,
      'brick',
      [-2.48, 2.82, z + 0.025],
      [0, 4.08, z + 0.025],
      0.18,
      0.13,
      [0.49, 0.16, 0.095],
    );
    beam(
      f,
      'brick',
      [0, 4.08, z + 0.025],
      [2.48, 2.82, z + 0.025],
      0.18,
      0.13,
      [0.49, 0.16, 0.095],
    );
  }
  for (const s of [-1, 1]) {
    const p = [
      [0, 4.13, -2.62],
      [s * 2.65, 2.86, -2.62],
      [s * 2.65, 2.86, 2.62],
      [0, 4.13, 2.62],
    ];
    if (normalFor(...p.slice(0, 3))[1] < 0) p.reverse();
    quad(o, 'metal', p, normalFor(...p.slice(0, 3)), [0.49, 0.075, 0.045]);
    for (let z0 = -2.6; z0 <= 2.6; z0 += 0.44)
      beam(o, 'metal', [0, 4.15, z0], [s * 2.65, 2.88, z0], 0.018, 0.022, [0.42, 0.068, 0.04]);
  }
}
export function buildKihnu(out) {
  ironShaft(out);
  gallery(out);
  lantern(out);
  oilHouse(out);
}
export const lighthouseBalticIronStudies = [
  lighthouseStudy({
    id: 'N0671',
    key: 'kihnu_lighthouse',
    title: 'Kihnu Lighthouse',
    wikidataId: 'Q3361476',
    build: buildKihnu,
    metricTriangleUv: true,
    size: [10, 28.3, 18],
    smoothNormalSlots: ['trim'],
    normalAt(p, slot, ref, n) {
      if (
        slot !== 'trim' ||
        !ref.endsWith('metal_painted') ||
        p[1] <= 1.22 ||
        p[1] >= 20.5 ||
        Math.abs(n[1]) > 0.6
      )
        return;
      const r = Math.hypot(p[0], p[2]);
      if (Math.abs(r - radius(p[1])) > 1e-4 || (n[0] * p[0] + n[2] * p[2]) / r < 0.97) return;
      const slope = (2.755 - 1.37) / (20.5 - 1.22),
        length = Math.hypot(1, slope);
      return [p[0] / r / length, slope / length, p[2] / r / length];
    },
    visualBrief:
      'White tapered cast-iron tower with flared, red-lined foot; twenty-four small circular apertures in red diamond surrounds; ornate pierced eight-sided gallery, red finial posts and black pickets; white/red Greek-key drum; clear ten-panel lantern with optical apparatus, riveted red dome, ventilator and vane; mapped detached rubble oil store.',
    sourceFacts: {
      heightMeters: 28.3,
      focalHeightMeters: 30.2,
      shaftBasePhotoApproxDiameterMeters: 5.8,
      lanternPhotoApproxDiameterMeters: 2.73,
      appearance:
        'Restored white/red exterior shown in municipal tourism aerial and Brand Estonia2024 lantern close-up.',
      basis:
        'Navigation authority current ATON2849 provides28.3m structure height and exactWGS84coordinate. Operator and municipal photographs govern the flared base, four upper rows of four ports and eight lowest ports, gallery support geometry and oil store. Brand Estonia credited Priidu Saart close photograph fixes the restored red Greek-key drum pattern, lantern hardware, dome seams and gallery posts. Other dimensions are photo-proportioned.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2849/',
      'https://www.transpordiamet.ee/kihnu-tuletorn',
      'https://www.transpordiamet.ee/uudised/kihnu-tuletorn-sai-uue-kupli',
      'https://www.kultuuriruum.ee/tuletorn/',
      'https://visitkihnu.ee/et/vaatamisvaeaersused/82/kihnu-tuletorn',
      'https://visitestonia.com/images/709493/kihnu-tuletorn-013-visit-estonia.jpg',
      'https://toolbox.estonia.ee/asset-page/256622-kihnu-lighthouse',
      'https://www.openstreetmap.org/way/232111866',
      'https://www.openstreetmap.org/way/420321434',
    ],
    geographicProposal: {
      anchor: [23.97109316, 58.097058],
      heading: Math.PI,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://nma.transpordiamet.ee/aton/2849/',
      notes:
        'Navigation authority exact coordinate fixes tower center, within one meter of exact-QID OSMnode3369832511. Native+Z faces north toward the keeper-house access; the north entry is reconstructed from the photographed closed sea-facing elevations and landward approach. Oil-store footprint is mapped in actual east/south offsets, resolving ensemble rotation; its roof and openings follow the municipal aerial. The broader OSMtower circle includes the stone/plinth skirt and is not used to stretch the shaft.',
    },
    limitations: [
      'Tower structural height and anchor are published; panel diameters, thin ironwork, aperture dimensions and minor door/roof details are photograph-proportioned. Native north entry is an approach-based reconstruction; detached keeper residences remain map buildings. No reference photograph or survey mesh is embedded. The optical instrument is an exterior-visible representation rather than a working navigational light.',
    ],
    previewCamera: { position: [23, 18, 32], lookAt: [0, 13, -2], fov: 48 },
    qaCameras: [
      { name: 'near-entry', position: [7, 4, 10], lookAt: [0, 1.8, 1.4] },
      { name: 'near-ports', position: [5.5, 11.1, 7.2], lookAt: [0, 11.1, 0] },
      { name: 'near-gallery', position: [5.2, 22.5, 6.3], lookAt: [0, 22.7, 0] },
      { name: 'near-lantern', position: [4.1, 26.3, 5.3], lookAt: [0, 25.1, 0] },
      { name: 'near-oil-store', position: [10, 6, -3], lookAt: [2.6, 1.7, -11.7] },
      { name: 'far-silhouette', position: [29, 18, 39], lookAt: [0, 13, -2] },
    ],
  }),
];
