/** Individually constructed lattice and keeper-house lighthouse ensembles. */
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  facadeBlock,
  hipRoof,
  lighthouseStudy,
  ring,
  shell,
} from './lighthouse-expansion-models.mjs';
import { lantern, lathe, panel, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const gray = [0.57, 0.59, 0.57],
  pale = [0.84, 0.83, 0.78],
  dark = [0.085, 0.105, 0.11],
  red = [0.6, 0.105, 0.07];
function buildAdziogol(out) {
  // Genuine ruled hyperboloid: both families consist of straight generators, not curved poles.
  const bottom = 1.75,
    top = 54.2,
    r0 = 9.6,
    r1 = 3.28,
    twist = 1.8;
  const point = (a, sign, t) => [
    (1 - t) * r0 * Math.sin(a) + t * r1 * Math.sin(a + sign * twist),
    bottom + (top - bottom) * t,
    (1 - t) * r0 * Math.cos(a) + t * r1 * Math.cos(a + sign * twist),
  ];
  const radius = (t) =>
    Math.hypot((1 - t) * r0 + t * r1 * Math.cos(twist), t * r1 * Math.sin(twist));
  lathe(
    out,
    'rubble',
    [
      [0, 10.5],
      [1.25, 10.1],
      [1.5, 9.95],
    ],
    [0.59, 0.5, 0.31],
    96,
  );
  lathe(
    out,
    'concrete',
    [
      [1.5, 10],
      [1.75, 10],
    ],
    pale,
    96,
  );
  for (let i = 0; i < 32; i++)
    for (const sign of [-1, 1]) {
      const a = (i * Math.PI) / 16;
      beam(out, 'metal', point(a, sign, 0), point(a, sign, 1), 0.13, 0.14, red);
      const p = point(a, sign, 0);
      box(out, 'metal', [p[0] - 0.22, 1.71, p[2] - 0.22], [p[0] + 0.22, 1.85, p[2] + 0.22], red);
    }
  for (let i = 0; i <= 25; i++) {
    const t = i / 25,
      y = bottom + (top - bottom) * t,
      r = radius(t);
    ring(out, 'metal', y - 0.045, r - 0.075, r + 0.075, 0.09, red, 128);
  }
  // Enclosed central spiral-stair tube visible through the open red lattice.
  shell(out, {
    profile: [
      [1.75, 1.12],
      [54.4, 1.12],
    ],
    slot: 'metal',
    color: [0.48, 0.075, 0.045],
    segments: 64,
    holes: Array.from({ length: 13 }, (_, i) => ({
      angle: i * 0.67,
      y: 4 + i * 3.8,
      w: 0.32,
      h: 0.6,
      trimSlot: 'metal',
      trimColor: red,
    })),
  });
  ring(out, 'metal', 54.15, 1.1, 4.06, 0.26, red, 96);
  railRing(out, 54.43, 3.96, 0.98, red, 48);
  loft(out, 'metal', [radialRing(54.4, 2.85, 2.85, 8), radialRing(57.5, 2.85, 2.85, 8)], red);
  ring(out, 'metal', 57.48, 1, 3.5, 0.15, red, 64);
  railRing(out, 57.64, 3.36, 0.95, red, 32);
  lantern(out, {
    bottom: 57.66,
    radius: 1.93,
    height: 3.72,
    color: red,
    segments: 8,
    roofHeight: 1.75,
  });
  for (const f of [0, 2, 4, 6]) {
    const o = transformed(out, (f * Math.PI) / 4);
    panel(o, 'glass', -0.36, 0.36, 55.2, 56.45, 2.854, [0.26, 0.37, 0.37]);
    for (const x of [-0.42, 0.42])
      box(o, 'metal', [x - 0.035, 55.16, 2.85], [x + 0.035, 56.5, 2.93], pale);
  }
  tube(out, 'metal', [0, 63.4, 0], [0, 64, 0], 0.035, dark, 8);
  // Small service room sits within the lower openwork cage, as in the operator photograph.
  facadeBlock(out, {
    cx: 0,
    cz: -2.9,
    rx: 3.35,
    rz: 2.5,
    y0: 1.76,
    y1: 4.3,
    slot: 'plaster',
    color: pale,
    windows: [
      { face: 0, x: -1.5, y: 2.25, w: 1, h: 1.35, trim: 0 },
      { face: 0, x: 1.1, y: 1.8, w: 0.9, h: 2.25, trim: 0 },
    ],
  });
  hipRoof(out, 0, -2.9, 3.5, 2.65, 4.3, 1.2, [0.25, 0.36, 0.3], 'metal');
  // Narrow access landing only, leaving island and sea level alignment to placement evidence.
  box(out, 'concrete', [-1.1, 1.5, 9.5], [1.1, 1.75, 12.8], pale);
  for (let i = 0; i < 5; i++)
    box(
      out,
      'concrete',
      [-0.85, 0, 12.8 + i * 0.32],
      [0.85, 1.5 - i * 0.27, 13.12 + i * 0.32],
      pale,
    );
}
function keeperHouse(out, x) {
  // The mapped main house is about 10.8 by 10.3 m, with lower front/rear extensions.
  const target = transformed(out, 0, [x, 0, -0.25]);
  const p = ([a, b, c]) => [a, b * 1.25, c * 1.1];
  const o = {
    addQuad(s, r, ps, _n, uv, c) {
      const q = ps.map(p);
      target.addQuad(s, r, q, normalFor(...q.slice(0, 3)), uv, c);
    },
    addTriangle(s, r, ps, _n, uv, c) {
      const q = ps.map(p);
      target.addTriangle(s, r, q, normalFor(...q), uv, c);
    },
    addConvexPolygon(s, r, ps, _n, uv, c) {
      const q = ps.map(p);
      target.addConvexPolygon(s, r, q, normalFor(...q.slice(0, 3)), uv, c);
    },
  };
  const wall = [0.81, 0.82, 0.77],
    frame = [0.4, 0.56, 0.57];
  box(o, 'granite', [-5.5, 0, -4.65], [5.5, 0.48, 4.65], [0.35, 0.4, 0.4]);
  facadeBlock(o, {
    rx: 5.45,
    rz: 4.6,
    y0: 0.48,
    y1: 3.9,
    slot: 'plaster',
    color: wall,
    windows: [
      { face: 0, x: -3.3, y: 1.2, w: 1.15, h: 1.85, trim: 0 },
      { face: 0, x: 0, y: 0.48, w: 1.2, h: 2.6, trim: 0 },
      { face: 0, x: 3.3, y: 1.2, w: 1.15, h: 1.85, trim: 0 },
      { face: 1, x: -2, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 1, x: 1.8, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 2, x: -2.8, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 2, x: 0, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 2, x: 2.8, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 3, x: -2, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
      { face: 3, x: 1.8, y: 1.2, w: 1.1, h: 1.8, trim: 0 },
    ],
  });
  hipRoof(o, 0, 0, 5.72, 4.88, 3.9, 4.05, [0.54, 0.21, 0.13], 'tiles');
  // White gabled dormer projects from the tiled front roof, with a framed sash.
  facadeBlock(o, {
    cx: 0,
    cz: 3.5,
    rx: 1.08,
    rz: 1.35,
    y0: 3.9,
    y1: 5.6,
    slot: 'plaster',
    color: wall,
    windows: [{ face: 0, x: 0, y: 4.06, w: 0.92, h: 1.2, trim: 0 }],
  });
  const front = [
    [-1.2, 5.6, 4.91],
    [1.2, 5.6, 4.91],
    [0, 6.7, 4.91],
  ];
  o.addTriangle(
    'plaster',
    'palette:#ffffff',
    front,
    [0, 0, 1],
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
    wall,
  );
  for (const sign of [-1, 1]) {
    const p = [
      [0, 6.72, 2],
      [sign * 1.28, 5.58, 2],
      [sign * 1.28, 5.58, 5],
      [0, 6.72, 5],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'tiles', p, normalFor(...p.slice(0, 3)), [0.54, 0.21, 0.13]);
  }
  for (const x of [-3.3, 3.3]) {
    for (const sx of [x - 0.59, x + 0.59])
      box(o, 'wood', [sx - 0.035, 1.15, 4.605], [sx + 0.035, 3.1, 4.68], frame);
    for (const y of [1.17, 2.2, 3.08])
      box(o, 'wood', [x - 0.62, y - 0.035, 4.605], [x + 0.62, y + 0.035, 4.68], frame);
    box(o, 'wood', [x - 0.03, 1.18, 4.605], [x + 0.03, 3.08, 4.68], frame);
  }
  box(o, 'plaster', [-0.5, 7.1, -0.6], [0.5, 9, -1.6 + 2], wall);
  box(o, 'granite', [-0.58, 8.95, -0.68], [0.58, 9.12, 0.48], [0.48, 0.47, 0.42]);
  for (let i = 0; i < 3; i++)
    box(o, 'granite', [-0.9, 0, 4.7 + i * 0.32], [0.9, 0.46 - i * 0.13, 5.02 + i * 0.32], gray);
  // Low rear service wing and the east-facing entrance projection from mapped house outlines.
  facadeBlock(target, {
    cx: 0,
    cz: -6.45,
    rx: 4.0,
    rz: 1.7,
    y0: 0.3,
    y1: 3.2,
    slot: 'plaster',
    color: wall,
    windows: [
      { face: 2, x: -2.2, y: 1.2, w: 1.0, h: 1.6, trim: 0 },
      { face: 2, x: 0, y: 0.3, w: 1.15, h: 2.4, trim: 0 },
      { face: 2, x: 2.2, y: 1.2, w: 1.0, h: 1.6, trim: 0 },
    ],
  });
  loft(
    target,
    'tiles',
    [
      [
        [-4.2, 5.0, -4.8],
        [-4.2, 3.35, -8.3],
        [4.2, 3.35, -8.3],
        [4.2, 5.0, -4.8],
      ],
      [
        [-4.2, 5.1, -4.8],
        [-4.2, 3.45, -8.3],
        [4.2, 3.45, -8.3],
        [4.2, 5.1, -4.8],
      ],
    ],
    [0.54, 0.21, 0.13],
  );
  facadeBlock(target, {
    cx: 0,
    cz: 5.8,
    rx: 1.8,
    rz: 1.2,
    y0: 0.3,
    y1: 3.1,
    slot: 'plaster',
    color: wall,
    windows: [{ face: 0, x: 0, y: 0.3, w: 1.2, h: 2.5, trim: 0 }],
  });
  box(target, 'granite', [-1.94, 3.1, 4.5], [1.94, 3.24, 7.12], gray);
}
function buildWesterhever(out) {
  lathe(
    out,
    'plaster',
    [
      [0, 5.06],
      [1.2, 5.06],
      [1.5, 4.45],
    ],
    pale,
    96,
  );
  const r = (y) => 4.45 - ((y - 1.5) * 2.15) / 31.5;
  const bands = [
    [1.5, 9, red],
    [9, 15, pale],
    [15, 21, red],
    [21, 27, pale],
    [27, 33, red],
  ];
  for (const [lo, hi, color] of bands) {
    const holes = [];
    for (let y = 3; y < 32; y += 3.5)
      if (y >= lo && y + 0.6 <= hi)
        for (let k = 0; k < 4; k++)
          holes.push({
            angle: (k * Math.PI) / 2 + (Math.round(y) % 2) * 0.3,
            y,
            w: 0.33,
            h: 0.58,
            depth: 0.14,
            trimSlot: 'metal',
            trimColor: color,
          });
    shell(out, {
      profile: [
        [lo, r(lo)],
        [hi, r(hi)],
      ],
      holes,
      slot: 'metal',
      color,
      segments: 128,
    });
  }
  // Cast-iron panels and fastening rings distinguish the structure from painted masonry.
  for (let y = 1.6; y < 32.9; y += 0.86) {
    if (Array.from({ length: 9 }, (_, i) => 3 + i * 3.5).some((w) => y > w - 0.1 && y < w + 0.7))
      continue;
    const color = bands.find(([lo, hi]) => y >= lo && y < hi)[2];
    ring(out, 'metal', y, r(y) - 0.005, r(y) + 0.018, 0.022, color, 128);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      sphere(
        out,
        'metal',
        [Math.sin(a) * (r(y) + 0.025), y + 0.055, Math.cos(a) * (r(y) + 0.025)],
        [0.025, 0.025, 0.025],
        color,
        8,
        4,
      );
    }
  }
  lathe(
    out,
    'metal',
    [
      [33, 2.3],
      [33.18, 2.55],
      [33.5, 3.08],
      [33.8, 3.15],
    ],
    dark,
    96,
  );
  railRing(out, 33.85, 3.05, 1.05, dark, 48);
  shell(out, {
    profile: [
      [33.8, 2.05],
      [35.3, 2.05],
    ],
    slot: 'metal',
    color: dark,
    segments: 96,
    holes: [{ angle: 0, y: 33.86, w: 0.65, h: 1.32, trimSlot: 'metal', trimColor: dark }],
  });
  lantern(out, {
    bottom: 35.25,
    radius: 1.95,
    height: 2.65,
    color: dark,
    segments: 16,
    roofHeight: 1.4,
  });
  tube(out, 'metal', [0, 39.4, 0], [0, 40, 0], 0.035, dark, 8);
  keeperHouse(out, -17.0);
  keeperHouse(out, 16.95);
}
function buildYokohama(out) {
  const white = [0.8, 0.82, 0.8],
    steel = [0.59, 0.63, 0.63],
    glass = [0.095, 0.15, 0.17];
  // Current surveyed podium outline: circle19.25m centered0.21m west/0.43m south
  // of the tower; the glazed attached wing lies northwest, not southeast.
  const podium = transformed(out, 0, [-0.21, 0, 0.43]);
  for (let i = 0; i < 120; i++) {
    const a = (i * Math.PI * 2) / 120,
      b = ((i + 1) * Math.PI * 2) / 120;
    const color = [
      [0.69, 0.72, 0.71],
      [0.84, 0.85, 0.8],
      [0.54, 0.58, 0.58],
      [0.76, 0.79, 0.77],
      [0.64, 0.68, 0.69],
    ][(i * 7) % 5];
    const p = (t, y) => [Math.sin(t) * 19.25, y, Math.cos(t) * 19.25];
    const ps = [p(a, 0), p(b, 0), p(b, 11.8), p(a, 11.8)];
    quad(podium, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
  }
  lathe(
    podium,
    'concrete',
    [
      [11.78, 19.25],
      [12, 19.4],
    ],
    white,
    120,
  );
  for (const y of [3.95, 7.9]) ring(podium, 'metal', y, 19.23, 19.32, 0.1, white, 120);
  // OSM172116649 captures the concave wing perimeter. Ear clipping preserves the curved
  // cutout against the round podium rather than fanning triangles outside its footprint.
  let plan = [
    [-24.44, -12.44],
    [-8.98, -31.46],
    [-6.11, -17.93],
    [-10.33, -15.98],
    [-13.95, -13.08],
    [-16.78, -9.4],
    [-18.66, -5.16],
    [-19.45, -0.58],
    [-19.13, 4.06],
    [-18.84, 4.97],
    [-29.83, 7.71],
    [-32.46, 5.55],
    [-20.58, -9.31],
  ];
  const area = plan.reduce(
    (sum, p, i) =>
      sum + p[0] * plan[(i + 1) % plan.length][1] - p[1] * plan[(i + 1) % plan.length][0],
    0,
  );
  if (area > 0) plan = plan.reverse();
  const roofIds = earcut(plan.flat());
  for (let i = 0; i < roofIds.length; i += 3) {
    let p = roofIds.slice(i, i + 3).map((k) => [plan[k][0], 9, plan[k][1]]);
    if (normalFor(...p)[1] < 0) p = p.reverse();
    out.addConvexPolygon(
      'concrete',
      'palette:#ffffff',
      p,
      [0, 1, 0],
      p.map((v) => [v[0], v[2]]),
      white,
    );
    const q = p.map((v) => [v[0], 0.28, v[2]]);
    out.addConvexPolygon(
      'concrete',
      'palette:#ffffff',
      q,
      [0, 1, 0],
      q.map((v) => [v[0], v[2]]),
      gray,
    );
  }
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.ceil(L / 1.2),
      point = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
    const panelPoints = [point(0, 0.28), point(1, 0.28), point(1, 8.72), point(0, 8.72)];
    quad(out, 'glass', panelPoints, normalFor(...panelPoints.slice(0, 3)), glass);
    for (let k = 0; k <= count; k++)
      beam(out, 'metal', point(k / count, 0.28), point(k / count, 8.74), 0.08, 0.09, steel);
    for (const y of [0.3, 4.45, 8.74])
      beam(out, 'metal', point(0, y), point(1, y), 0.11, 0.12, white);
    const rim = [point(0, 8.72), point(1, 8.72), point(1, 9), point(0, 9)];
    quad(out, 'concrete', rim, normalFor(...rim.slice(0, 3)), white);
  }
  // Decagonal truss and enclosed lift spine: 21 individually connected braced panels per face.
  const ys = Array.from({ length: 22 }, (_, i) => 11.8 + i * (79.2 / 21)),
    r = (y) => 3.3 + 6.45 * Math.pow((91 - y) / 79.2, 1.8);
  const p = (k, y) => {
    const a = (k * Math.PI) / 5;
    return [Math.sin(a) * r(y), y, Math.cos(a) * r(y)];
  };
  lathe(
    out,
    'glass',
    [
      [11.8, 1.37],
      [91.4, 1.37],
    ],
    glass,
    10,
  );
  for (let k = 0; k < 10; k++)
    for (let j = 1; j < ys.length; j++) {
      const y0 = ys[j - 1],
        y1 = ys[j],
        a = p(k, y0),
        b = p(k + 1, y0),
        c = p(k + 1, y1),
        d = p(k, y1);
      beam(out, 'metal', a, d, 0.24, 0.28, white);
      beam(out, 'metal', a, b, 0.15, 0.17, white);
      beam(out, 'metal', a, c, 0.095, 0.105, white);
      beam(out, 'metal', b, d, 0.095, 0.105, white);
      // Bolted panel joint plates remain distinct at human inspection distance.
      for (const q of [a, d]) sphere(out, 'metal', q, [0.18, 0.2, 0.18], steel, 8, 4);
    }
  for (let k = 0; k < 10; k++) beam(out, 'metal', p(k, 91), p(k + 1, 91), 0.24, 0.24, white);
  loft(
    out,
    'metal',
    [
      radialRing(90.9, 3.4, 3.4, 10),
      radialRing(92.5, 5.1, 5.1, 10),
      radialRing(94.2, 7.5, 7.5, 10),
    ],
    white,
  );
  // Two observation levels over the faceted conical support; published tower total is106m.
  for (let f = 0; f < 10; f++) {
    const a = (f * Math.PI) / 5,
      b = ((f + 1) * Math.PI) / 5;
    const pa = (t, y, r) => [Math.sin(t) * r, y, Math.cos(t) * r];
    for (const [lo, hi] of [
      [94.35, 97.5],
      [97.72, 100.85],
    ]) {
      const ps = [pa(a, lo, 7.5), pa(b, lo, 7.5), pa(b, hi, 7.5), pa(a, hi, 7.5)];
      quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), glass);
      for (let i = 0; i <= 3; i++) {
        const t = i / 3,
          A = pa(a, lo, 7.55),
          B = pa(b, lo, 7.55),
          x = A.map((v, k) => v + (B[k] - v) * t),
          z = [x[0], hi, x[2]];
        beam(out, 'metal', x, z, 0.1, 0.11, white);
      }
    }
    for (const y of [94.23, 97.6, 100.96])
      beam(out, 'metal', pa(a, y, 7.62), pa(b, y, 7.62), 0.24, 0.26, white);
  }
  loft(
    out,
    'metal',
    [
      radialRing(100.98, 7.65, 7.65, 10),
      radialRing(101.24, 7.65, 7.65, 10),
      radialRing(102.2, 4.25, 4.25, 10),
    ],
    white,
  );
  lantern(out, {
    bottom: 102.2,
    radius: 3.5,
    height: 2.15,
    color: white,
    segments: 10,
    roofHeight: 0.75,
  });
  railRing(out, 102.3, 3.8, 2.05, white, 20);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    tube(
      out,
      'metal',
      [Math.sin(a) * 3.6, 104.3, Math.cos(a) * 3.6],
      [Math.sin(a) * 3.6, 106, Math.cos(a) * 3.6],
      0.035,
      white,
      8,
    );
  }
}

export const lighthouseLatticeStudies = [
  lighthouseStudy({
    id: 'N0649',
    key: 'stanislav_adziogol_lighthouse',
    title: 'Stanislav-Adziogol Lighthouse',
    wikidataId: 'Q380270',
    build: buildAdziogol,
    size: [21, 64, 25],
    visualBrief:
      'Red open hyperboloid lattice with two families of straight inclined steel members, circular horizontal ties, central stair tube, lower service room and tiered red lantern cabin.',
    sourceFacts: {
      heightMeters: 64,
      basis:
        'Ukrainian hydrographic operator states64m abovebase and67m focalheight; this supersedes the conflicting76m OSM value.',
      referenceAppearance:
        'Operator archive photograph, original intact exterior; current condition is not established by this archive.',
    },
    referencePages: [
      'https://hydro.gov.ua/?page_id=335',
      'https://hydro.gov.ua/wp-content/uploads/2018/09/6-2.png',
      'https://hydro.gov.ua/?p=1574',
      'https://www.openstreetmap.org/way/702157400',
      'https://www.openstreetmap.org/way/444105312',
    ],
    geographicProposal: {
      anchor: [32.232577164, 46.492261894],
      heading: 2.804572585,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/702157400',
      notes:
        'Mapped near-circular19.6m latticefoot identifies center. Pier444105312 extends northeast from the island; its axis through approximately[7.2,-20.5]m east/south fixes the authored+Z landing toward north-northeast at heading2.804572585rad. Ground contact is the artificial island. This is the intact operator-archive appearance, with post2022 condition explicitly unverified.',
    },
    limitations: [
      'The intact exterior is reconstructed from the operator archive; post2022 exterior condition is not verified. Generator/member counts and section sizes, lantern details and service room are photo-proportioned. This asset does not pretend the conflicting76m map height is correct.',
    ],
    qaCameras: [
      { name: 'near-lattice', position: [17, 24, 24], lookAt: [0, 25, 0] },
      { name: 'near-cabin', position: [11, 59, 15], lookAt: [0, 58, 0] },
      { name: 'near-base', position: [22, 11, 28], lookAt: [0, 5, 0] },
      { name: 'far-silhouette', position: [73, 44, 94], lookAt: [0, 32, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0650',
    key: 'lighthouse_westerheversand',
    title: 'Lighthouse Westerheversand',
    wikidataId: 'Q454681',
    build: buildWesterhever,
    size: [46, 40, 16],
    visualBrief:
      'Red-white striped bolted cast-iron tower between its separate twin pale keeper houses with steep tiled hip roofs, dormers, chimneys and lower front/rear service extensions.',
    sourceFacts: {
      heightMeters: 40,
      basis:
        '40m structural tower in mapped heritage record; local visitor operator reports41.5m above mean tide, a separate datum.',
      construction:
        '1906-1908;608 bolted castironplates; twin identical houses form the site ensemble.',
      ensemblePlan: {
        houseCenterX: [-17, 16.95],
        houseMainSize: [10.9, 10.12],
        headingRadians: 1.706,
        sourceWays: [87534169, 93732524, 93732526],
        basis:
          'OSM full building outlines plus parts retrieved2026-09-27; +X north, +Z east. Tower entrance node1393406995 confirms east-facing front.',
      },
    },
    referencePages: [
      'https://westerhever-nordsee.de/leuchtturm/das-wahrzeichen/',
      'https://www.schutzstation-wattenmeer.de/unsere-stationen/westerhever/',
      'https://www.schutzstation-wattenmeer.de/fileadmin/_processed_/3/4/csm_Westerhever-Header_20240625_1354fdfd9b.jpg',
      'https://www.openstreetmap.org/way/87534169',
      'https://www.openstreetmap.org/way/93732524',
      'https://www.openstreetmap.org/way/93732526',
    ],
    geographicProposal: {
      anchor: [8.639917851, 54.37336145],
      heading: 1.706,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/87534169',
      notes:
        'Round tower centered on exact mapped core. +X follows mapped north-house baseline (north with small west component); +Z faces east, corroborated by the mapped tower entrance. Keeper houses use measured separation and main plan, with photo-proportioned roof features. Base level is mound contact, not sea level.',
    },
    limitations: [
      'Main house plans, separation and bearing follow mapped outlines; roof details and annex elevations are photo-proportioned. Plate seams are modeled but do not assert an exact608-piece reconstruction. Current light lens, museum signs and footpaths outside the immediate ensemble are excluded.',
    ],
    qaCameras: [
      { name: 'near-iron', position: [10, 21, 13], lookAt: [0, 20, 0] },
      { name: 'near-lantern', position: [8, 39, 12], lookAt: [0, 36.8, 0] },
      { name: 'near-house', position: [32, 12, 22], lookAt: [16.95, 5, 0] },
      { name: 'far-ensemble', position: [48, 27, 62], lookAt: [0, 17, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0651',
    key: 'yokohama_marine_tower',
    title: 'Yokohama Marine Tower',
    wikidataId: 'Q1207989',
    build: buildYokohama,
    size: [51.86, 106, 51.29],
    visualBrief:
      'Current silver-gray decagonal lattice tower with an enclosed lift spine, dense X-braced panels, two-level observation capsule, top lantern and renewed curved striped podium with glazed wing.',
    sourceFacts: {
      heightMeters: 106,
      basis:
        'Yokohama municipal facility record and2022renewal report explicitly106m anddecagonal construction; cached101m is superseded.',
      currentAppearance:
        'Municipal2022renovation photographs show silver-gray structure and renewed striped podium. Surveyed OSMway47574838 gives the38.5m diameter,12m height podium; attached northwest annex plan follows OSMway172116649.',
      mappedPod:
        'ExactQID OSM polygon carriesminHeight80,height88; it is a raisedpod record and must not scale the full106mstructure.',
    },
    referencePages: [
      'https://www.city.yokohama.lg.jp/kanko-bunka/kanko-event/kankojoho/marinetower/marine_koubo.html',
      'https://www.city.yokohama.lg.jp/city-info/koho-kocho/koho/insatsubutsu/koyoko/shiban/kohoyokohamaplus/2022/202211.html',
      'https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/kokyokenchiku/picture/picture/r03/yokohamamarinetower.html',
      'https://www.city.yokohama.lg.jp/business/bunyabetsu/kenchiku/kokyokenchiku/picture/picture/r03/yokohamamarinetower.images/0046_20220719.jpg',
      'https://www.openstreetmap.org/way/319050351',
      'https://www.openstreetmap.org/way/47574838',
      'https://www.openstreetmap.org/way/172116649',
    ],
    geographicProposal: {
      anchor: [139.650902072, 35.443934377],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/47574838',
      notes:
        'Tower axis uses mapped upper-pod center. Authored +X east/+Z south and heading0 retain the mapped circular podium and concave northwest glazed annex in their real positions. Whole asset must not be fit to the raised-pod polygon.',
    },
    limitations: [
      'Published overallheight and decagon are respected. Podium plan and12m height are mapped. Observation-level elevation, truss sections, glazing subdivisions and9m annex roof height are photo-proportioned; mapped80-88m raisedpod tags conflict with the106m current envelope and are not treated as measured stage elevations. Podium planting, interiors and changing display signage are excluded.',
    ],
    qaCameras: [
      { name: 'near-truss', position: [16, 47, 23], lookAt: [0, 48, 0] },
      { name: 'near-observation', position: [18, 101, 26], lookAt: [0, 98, 0] },
      { name: 'near-podium', position: [-48, 19, -50], lookAt: [-12, 7, -9] },
      { name: 'far-silhouette', position: [128, 72, 163], lookAt: [0, 53, 0] },
    ],
  }),
];
