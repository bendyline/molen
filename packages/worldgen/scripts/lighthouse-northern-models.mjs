/** Individually researched northern lights: primary dimensions, mapped plans and photo proportions. */
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import {
  facadeBlock,
  lighthouseStudy,
  ring,
  shell,
  squareRails,
} from './lighthouse-expansion-models.mjs';
import {
  lantern,
  lathe,
  panel,
  piercedFacade,
  railRing,
  transformed,
} from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const pale = [0.85, 0.85, 0.79],
  dark = [0.1, 0.12, 0.12],
  bronze = [0.24, 0.22, 0.15];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function ladder(out, y0, y1, z, color = bronze) {
  for (const x of [-0.31, 0.31]) tube(out, 'metal', [x, y0, z], [x, y1, z], 0.035, color, 8);
  for (let y = y0 + 0.12; y < y1; y += 0.29)
    tube(out, 'metal', [-0.31, y, z], [0.31, y, z], 0.027, color, 8);
}
/** Triangular glass panels and diagonally braced bronze astragals; no opaque horizontal discs. */
function triangularLantern(out, y0, y1, r, frame, glass = [0.22, 0.3, 0.31], n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), glass);
    tube(out, 'metal', p[0], p[3], 0.038, frame, 8);
    tube(out, 'metal', p[0], p[2], 0.027, frame, 8);
  }
  for (const y of [y0, (y0 + y1) / 2, y1])
    ring(out, 'metal', y, r - 0.04, r + 0.04, 0.055, frame, 96);
}
function sampledCurve(points, step = 0.35) {
  const slope = (i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const result = [points[0]];
  for (let j = 1; j < points.length; j++) {
    const [y0, r0] = points[j - 1],
      [y1, r1] = points[j],
      dy = y1 - y0;
    const count = Math.ceil(dy / step);
    for (let i = 1; i <= count; i++) {
      const t = i / count,
        t2 = t * t,
        t3 = t2 * t;
      result.push([
        y0 + dy * t,
        (2 * t3 - 3 * t2 + 1) * r0 +
          (t3 - 2 * t2 + t) * dy * slope(j - 1) +
          (-2 * t3 + 3 * t2) * r1 +
          (t3 - t2) * dy * slope(j),
      ]);
    }
  }
  return result;
}

export function buildBellRock(out) {
  // NLB historical42ft base /15ft top, HES36m overall. Curve reconstructed between endpoints.
  const profile = [
    [0, 6.4008],
    [0.6, 6.34],
    [1.6, 6.0],
    [3, 5.4],
    [5, 4.76],
    [7, 4.25],
    [9.144, 3.78],
    [12, 3.31],
    [16, 2.91],
    [21, 2.56],
    [26, 2.34],
    [30.55, 2.286],
  ];
  const holes = [
    { angle: 0, y: 9.144, w: 0.96, h: 1.85, trimColor: pale },
    ...[13.15, 17.55, 22.1, 26.8, 29.4].map((y, i) => ({
      angle: i % 2 ? Math.PI : 0,
      y,
      w: 0.43,
      h: 0.64,
      trimColor: pale,
      grid: true,
    })),
    { angle: Math.PI / 2, y: 27.4, w: 0.41, h: 0.61, trimColor: pale },
  ];
  shell(out, {
    profile: sampledCurve(profile),
    holes,
    slot: 'plaster',
    color: (y, a) => {
      const t = Math.min(1, Math.max(0, (y - 1.8 + 0.3 * Math.sin(a * 3)) / 7.2));
      const s = t * t * (3 - 2 * t),
        lower = [0.26, 0.28, 0.21];
      return pale.map((v, i) => lower[i] + (v - lower[i]) * s);
    },
    segments: 160,
  });
  // The exposed lower stone courses are real shallow relief at the sea-washed base.
  for (let y = 0.45; y < 7.5; y += 0.48) {
    let j = 1;
    while (profile[j][0] < y) j++;
    const [a, r] = profile[j - 1],
      [b, s] = profile[j];
    const rr = r + ((s - r) * (y - a)) / (b - a);
    ring(out, 'ashlar', y, rr - 0.025, rr + 0.018, 0.026, [0.29, 0.3, 0.23], 128);
  }
  lathe(
    out,
    'granite',
    [
      [30.5, 2.286],
      [30.7, 2.33],
      [30.87, 2.46],
      [31.05, 2.66],
      [31.23, 2.89],
      [31.4, 2.92],
    ],
    pale,
    128,
  );
  ring(out, 'metal', 31.4, 1.87, 3.12, 0.16, [0.46, 0.47, 0.41], 128);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    beam(out, 'metal', polar(2.3, 30.88, a), polar(3.1, 31.44, a), 0.075, 0.09, dark);
  }
  railRing(out, 31.56, 3.04, 1.12, [0.57, 0.58, 0.52], 48);
  lathe(
    out,
    'metal',
    [
      [31.53, 2.06],
      [32.32, 2.06],
    ],
    bronze,
    96,
  );
  triangularLantern(out, 32.32, 34.47, 2.05, bronze);
  lathe(
    out,
    'metal',
    [
      [34.45, 2.18],
      [34.57, 2.18],
      [34.77, 1.89],
      [35.05, 1.47],
      [35.28, 0.93],
      [35.43, 0.3],
      [35.49, 0.08],
    ],
    bronze,
    96,
  );
  // Bird cage is a separate outer lattice continuing above the copper dome.
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const pts = [
      polar(3.02, 31.57, a),
      polar(2.76, 34.35, a),
      polar(1.55, 35.38, a),
      polar(0.18, 35.86, a),
    ];
    for (let j = 1; j < pts.length; j++)
      tube(out, 'metal', pts[j - 1], pts[j], 0.021, [0.41, 0.42, 0.37], 6);
  }
  for (const [y, r] of [
    [33.1, 2.86],
    [34.35, 2.76],
    [35.38, 1.55],
  ])
    ring(out, 'metal', y, r - 0.018, r + 0.018, 0.028, [0.41, 0.42, 0.37], 96);
  tube(out, 'metal', [0, 35.4, 0], [0, 36, 0], 0.027, bronze, 8);
  // SSE solar bay documented explicitly by HES; its frame and module cell pattern are geometry.
  const pv = transformed(out, Math.PI / 8);
  box(pv, 'metal', [-1.25, 31.35, 2.6], [1.25, 31.52, 4.15], dark);
  for (const x of [-1.1, 1.1])
    beam(pv, 'metal', [x, 30.65, 2.15], [x, 31.5, 4.03], 0.09, 0.11, dark);
  panel(pv, 'glass', -1.18, 1.18, 31.6, 32.75, 4.08, [0.065, 0.11, 0.15]);
  for (let x = -1.2; x <= 1.21; x += 0.3)
    beam(pv, 'metal', [x, 31.58, 4.1], [x, 32.77, 4.1], 0.025, 0.024, pale);
  for (let y = 31.58; y <= 32.78; y += 0.3)
    beam(pv, 'metal', [-1.2, y, 4.1], [1.2, y, 4.1], 0.025, 0.024, pale);
  // Door landing, lattice gratings, diagonal supports, handrails and bronze access ladder.
  box(out, 'metal', [-1.53, 9.02, 3.5], [1.53, 9.16, 5.67], bronze);
  for (let x = -1.5; x < 1.52; x += 0.13)
    beam(out, 'metal', [x, 9.19, 3.5], [x, 9.19, 5.67], 0.028, 0.035, [0.39, 0.38, 0.29]);
  for (const x of [-1.43, 1.43]) {
    beam(out, 'metal', [x, 7.6, 4.03], [x, 9.07, 5.6], 0.12, 0.12, bronze);
    for (let z = 3.6; z <= 5.7; z += 0.7)
      tube(out, 'metal', [x, 9.17, z], [x, 10.2, z], 0.025, bronze, 8);
    tube(out, 'metal', [x, 10.2, 3.55], [x, 10.2, 5.65], 0.032, bronze, 8);
  }
  ladder(out, 3, 9.18, 5.75);
  for (const x of [-0.31, 0.31]) tube(out, 'metal', [x, 0.8, 6.57], [x, 3, 5.75], 0.035, bronze, 8);
  for (let y = 0.9; y < 3; y += 0.29) {
    const z = 6.57 - ((y - 0.8) * 0.82) / 2.2;
    tube(out, 'metal', [-0.31, y, z], [0.31, y, z], 0.027, bronze, 8);
  }
  ladder(out, 9.18, 11.4, 3.97);
  for (const [a, y] of [
    [0, 16.05],
    [Math.PI / 2, 20.8],
    [-Math.PI / 2, 16.05],
  ]) {
    const o = transformed(out, a);
    const r = y < 18 ? 2.91 : 2.56;
    box(o, 'concrete', [-0.39, y, r - 0.1], [0.39, y + 0.63, r + 0.46], pale);
    panel(o, 'metal', -0.29, 0.29, y + 0.1, y + 0.5, r + 0.468, dark);
    for (let yy = y + 0.12; yy < y + 0.5; yy += 0.085)
      beam(
        o,
        'metal',
        [-0.29, yy, r + 0.48],
        [0.29, yy, r + 0.48],
        0.032,
        0.035,
        [0.52, 0.52, 0.47],
      );
  }
}

function gableRoof(out, cx, cz, rx, rz, y, rise, color) {
  const top = [
    [cx - rx, y, cz - rz],
    [cx - rx, y, cz + rz],
    [cx + rx, y, cz + rz],
    [cx + rx, y, cz - rz],
  ];
  for (const s of [-1, 1]) {
    const p =
      s === 1
        ? [top[1], top[2], [cx + rx, y + rise, cz], [cx - rx, y + rise, cz]]
        : [top[3], top[0], [cx - rx, y + rise, cz], [cx + rx, y + rise, cz]];
    quad(out, 'metal', p, normalFor(...p.slice(0, 3)), color);
  }
  for (const s of [-1, 1]) {
    const x = cx + s * rx;
    const p =
      s === 1
        ? [
            [x, y, cz + rz],
            [x, y, cz - rz],
            [x, y + rise, cz],
          ]
        : [
            [x, y, cz - rz],
            [x, y, cz + rz],
            [x, y + rise, cz],
          ];
    out.addTriangle(
      'granite',
      'palette:#ffffff',
      p,
      normalFor(...p),
      p.map((v) => [v[2], v[1]]),
      [0.5, 0.49, 0.43],
    );
  }
  for (let x = cx - rx + 0.35; x < cx + rx; x += 0.52)
    for (const s of [-1, 1])
      beam(
        out,
        'metal',
        [x, y + rise + 0.025, cz],
        [x, y + 0.025, cz + s * rz],
        0.027,
        0.032,
        [0.22, 0.37, 0.27],
      );
}
function framedFacadeBlock(out, data) {
  facadeBlock(out, {
    ...data,
    slot: 'ashlar',
    windows: data.windows.map((w) => ({ ...w, trim: 0 })),
  });
  for (const w of data.windows) {
    const face = w.face ?? 0,
      o = transformed(out, (face * Math.PI) / 2, [data.cx ?? 0, 0, data.cz ?? 0]);
    const z = face % 2 ? data.rx : data.rz;
    const rw = w.w / 2;
    for (const x of [w.x - rw, w.x + rw])
      beam(o, 'wood', [x, w.y, z - 0.12], [x, w.y + w.h, z - 0.12], 0.11, 0.14, [0.4, 0.16, 0.12]);
    for (const y of [w.y, w.y + w.h])
      beam(
        o,
        'wood',
        [w.x - rw, y, z - 0.12],
        [w.x + rw, y, z - 0.12],
        0.11,
        0.14,
        [0.4, 0.16, 0.12],
      );
    for (const y of [w.y + w.h / 3, w.y + (w.h * 2) / 3])
      beam(
        o,
        'wood',
        [w.x - rw, y, z - 0.24],
        [w.x + rw, y, z - 0.24],
        0.04,
        0.055,
        [0.55, 0.25, 0.18],
      );
    beam(
      o,
      'wood',
      [w.x, w.y, z - 0.235],
      [w.x, w.y + w.h, z - 0.235],
      0.05,
      0.055,
      [0.55, 0.25, 0.18],
    );
    box(
      o,
      'granite',
      [w.x - rw - 0.22, w.y - 0.17, z - 0.05],
      [w.x + rw + 0.22, w.y - 0.03, z + 0.13],
      [0.62, 0.59, 0.5],
    );
  }
}
export function buildBengtskar(out) {
  const granite = [0.47, 0.465, 0.415],
    copper = [0.26, 0.44, 0.31],
    oxide = [0.44, 0.1, 0.065];
  // Main building's stepped OSM plan, with origin at the separately mapped circular tower.
  const west = { cx: -12.109, cz: 1.4514, rx: 10.933, rz: 6.782 };
  const east = { cx: 2.4507, cz: 0.1199, rx: 3.627, rz: 5.4505 };
  for (const b of [west, east])
    box(
      out,
      'granite',
      [b.cx - b.rx, 0, b.cz - b.rz],
      [b.cx + b.rx, 0.9, b.cz + b.rz],
      [0.37, 0.37, 0.33],
    );
  const windows = [];
  for (const face of [0, 2])
    for (const x of [-7.7, -3.85, 0, 3.85, 7.7])
      for (const y of [1.6, 5.85, 10.05]) windows.push({ face, x, y, w: 1.02, h: 1.9 });
  for (const face of [1, 3])
    for (const x of [-3.4, 0, 3.4])
      for (const y of [1.6, 5.85, 10.05]) windows.push({ face, x, y, w: 0.96, h: 1.9 });
  framedFacadeBlock(out, { ...west, y0: 0.9, y1: 14.4, color: granite, windows });
  framedFacadeBlock(out, {
    ...east,
    y0: 0.9,
    y1: 15.2,
    color: granite,
    windows: [
      ...Array.from({ length: 2 }, (_, i) => ({
        face: 0,
        x: 0,
        y: 5.8 + i * 4.2,
        w: 1.07,
        h: 1.9,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        face: 1,
        x: 0,
        y: 1.6 + i * 4.2,
        w: 0.9,
        h: 1.75,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        face: 2,
        x: 0,
        y: 1.6 + i * 4.2,
        w: 1.02,
        h: 1.9,
      })),
      { face: 0, x: 0, y: 0.9, w: 1.2, h: 2.5 },
    ],
  });
  for (const b of [west, east]) {
    const o = transformed(out, 0, [b.cx, 0, b.cz]);
    for (const y of [0.94, 4.75, 14.3])
      for (let f = 0; f < 4; f++) {
        const q = transformed(o, (f * Math.PI) / 2),
          rx = f % 2 ? b.rz : b.rx,
          rz = f % 2 ? b.rx : b.rz;
        box(
          q,
          'granite',
          [-rx - 0.1, y, rz - 0.05],
          [rx + 0.1, y + 0.14, rz + 0.14],
          [0.6, 0.585, 0.52],
        );
      }
    // Alternating corner quoins preserve the National Romantic heavy stonework silhouette.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let y = 1.0, k = 0; y < 14.15; y += 0.58, k++)
          box(
            o,
            'granite',
            [sx * b.rx - (k % 2 ? 0.32 : 0.49), y, sz * b.rz - (k % 2 ? 0.49 : 0.32)],
            [sx * b.rx + (k % 2 ? 0.32 : 0.49), y + 0.48, sz * b.rz + (k % 2 ? 0.49 : 0.32)],
            [0.51, 0.5, 0.445],
          );
  }
  gableRoof(out, west.cx, west.cz, west.rx + 0.21, west.rz + 0.22, 14.4, 3.55, copper);
  box(
    out,
    'metal',
    [east.cx - east.rx - 0.16, 15.2, east.cz - east.rz - 0.16],
    [east.cx + east.rx + 0.16, 15.35, east.cz + east.rz + 0.16],
    copper,
  );
  // Large curved south pediment with its round divided window; stone voussoirs are separate.
  const ped = transformed(out, 0, [-11.5, 0, west.cz + west.rz + 0.03]),
    radius = 2.8;
  panel(ped, 'granite', -radius, radius, 13.7, 15.15, 0.0, granite);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 32,
      b = ((i + 1) * Math.PI) / 32;
    const p = [
      [radius * Math.cos(a), 15.15 + radius * Math.sin(a), 0],
      [radius * Math.cos(b), 15.15 + radius * Math.sin(b), 0],
      [0, 15.15, 0],
    ];
    stoneTriangle(ped, p, granite);
    stoneTriangle(
      ped,
      [...p].reverse().map(([x, y]) => [x, y, -0.45]),
      granite,
    );
    const edge = [p[0], p[1], [p[1][0], p[1][1], -0.45], [p[0][0], p[0][1], -0.45]];
    edge.reverse();
    quad(ped, 'granite', edge, normalFor(...edge.slice(0, 3)), granite);
  }
  // Closed circular recess and radial frame viewed from the south.
  sphere(ped, 'glass', [0, 15.95, 0.035], [1.18, 1.18, 0.065], [0.16, 0.2, 0.21], 40, 20);
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    beam(
      ped,
      'granite',
      [Math.cos(a) * 1.34, 15.95 + Math.sin(a) * 1.34, 0.1],
      [Math.cos(b) * 1.34, 15.95 + Math.sin(b) * 1.34, 0.1],
      0.23,
      0.23,
      [0.62, 0.58, 0.49],
    );
  }
  for (const x of [-0.54, 0, 0.54]) {
    const hh = Math.sqrt(1.18 ** 2 - x * x);
    beam(ped, 'wood', [x, 15.95 - hh, 0.13], [x, 15.95 + hh, 0.13], 0.075, 0.09, oxide);
  }
  for (const y of [-0.5, 0.3]) {
    const w = Math.sqrt(1.18 ** 2 - y * y);
    beam(ped, 'wood', [-w, 15.95 + y, 0.13], [w, 15.95 + y, 0.13], 0.075, 0.09, oxide);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    beam(
      ped,
      'granite',
      [Math.cos(a) * 2.8, 15.15 + Math.sin(a) * 2.8, 0.03],
      [Math.cos(b) * 2.8, 15.15 + Math.sin(b) * 2.8, 0.03],
      0.22,
      0.36,
      [0.62, 0.59, 0.52],
    );
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI * 2) / 48,
        b = ((i + 1) * Math.PI * 2) / 48;
      const r = 0.62 - (0.46 * i) / 48,
        s = 0.62 - (0.46 * (i + 1)) / 48;
      tube(
        ped,
        'granite',
        [side * (3.25 + Math.cos(a) * r), 15.05 + Math.sin(a) * r, 0.08],
        [side * (3.25 + Math.cos(b) * s), 15.05 + Math.sin(b) * s, 0.08],
        0.13,
        [0.62, 0.59, 0.52],
        8,
      );
    }
  }
  // The tall taper emerges from the east end of the keeper block.
  const holes = [];
  for (const a of [0, Math.PI])
    for (const y of [17, 22.4, 27.8, 33.2, 37.2])
      holes.push({ angle: a, y, w: 0.52, h: 1.05, trimColor: [0.56, 0.54, 0.46], grid: true });
  shell(out, {
    profile: [
      [15.3, 3.57],
      [20, 3.32],
      [27, 3.03],
      [34, 2.72],
      [39.7, 2.52],
    ],
    holes,
    slot: 'ashlar',
    color: granite,
    segments: 144,
  });
  lathe(
    out,
    'granite',
    [
      [39.6, 2.52],
      [39.9, 2.68],
      [40.1, 2.91],
      [40.3, 2.91],
    ],
    granite,
    128,
  );
  ring(out, 'metal', 40.3, 1.94, 3.0, 0.15, oxide, 128);
  railRing(out, 40.45, 2.93, 1.15, oxide, 40);
  lathe(
    out,
    'metal',
    [
      [40.45, 2.18],
      [41.38, 2.18],
    ],
    oxide,
    96,
  );
  triangularLantern(out, 41.38, 44.05, 2.17, [0.82, 0.79, 0.69], [0.25, 0.34, 0.36], 16);
  lathe(
    out,
    'metal',
    [
      [44.03, 2.36],
      [44.18, 2.36],
      [44.55, 1.94],
      [44.94, 1.34],
      [45.22, 0.61],
      [45.34, 0.07],
    ],
    copper,
    96,
  );
  sphere(out, 'metal', [0, 45.49, 0], [0.18, 0.19, 0.18], copper, 24, 12);
  tube(out, 'metal', [0, 45.49, 0], [0, 46, 0], 0.034, dark, 8);
  // Operator photograph shows a tall east gallery radio mast and a shorter western whip.
  for (const [x, y, z] of [
    [3.0, 40.4, 0],
    [-2.6, 40.4, 0.5],
  ]) {
    const h = x > 0 ? 5.25 : 4.45;
    tube(out, 'metal', [x, y, z], [x, y + h, z], 0.036, dark, 8);
    if (x > 0)
      for (const yy of [43.5, 44.5, 45.1]) {
        tube(out, 'metal', [x - 0.48, yy, z], [x + 0.48, yy, z], 0.025, dark, 8);
        for (const xx of [-0.38, 0, 0.38])
          tube(out, 'metal', [x + xx, yy, z - 0.22], [x + xx, yy, z + 0.22], 0.018, dark, 6);
      }
  }
  box(out, 'granite', [-17.9, 16.1, 0.4], [-16.8, 19.25, 1.5], granite);
  box(out, 'metal', [-18.1, 19.25, 0.2], [-16.6, 19.4, 1.7], copper);
}
function stoneTriangle(out, p, color) {
  out.addTriangle(
    'granite',
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((v) => [v[0], v[1]]),
    color,
  );
}

function taperedSquare(out, { y0, y1, r0, r1, color, holes = [] }) {
  const point = ([x, y, z]) => {
    const s = (r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)) / r0;
    return [x * s, y, z * s];
  };
  const warp = {
    addQuad(s, r, p, _n, uv, c) {
      const q = p.map(point);
      out.addQuad(s, r, q, normalFor(...q.slice(0, 3)), uv, c);
    },
    addTriangle(s, r, p, _n, uv, c) {
      const q = p.map(point);
      out.addTriangle(s, r, q, normalFor(...q), uv, c);
    },
  };
  for (let face = 0; face < 4; face++)
    piercedFacade(transformed(warp, (face * Math.PI) / 2), {
      half: r0,
      z: r0,
      y0,
      y1,
      slot: 'ashlar',
      color,
      holes: holes.filter((h) => h.face === face),
    });
}
export function buildVieille(out) {
  const stone = [0.43, 0.415, 0.345],
    trim = [0.59, 0.58, 0.5],
    iron = [0.12, 0.145, 0.135];
  const square = (y, r) => [
    [-r, y, -r],
    [-r, y, r],
    [r, y, r],
    [r, y, -r],
  ];
  loft(
    out,
    'granite',
    [square(0, 4.1), square(0.5, 4.1), square(3.3, 3.36), square(3.7, 3.28)],
    [0.36, 0.37, 0.32],
  );
  const holes = [];
  for (const face of [0, 1, 3])
    for (const y of [4.55, 8.6, 12.65, 16.7])
      holes.push({ face, x: 0, y, w: 0.54, h: 1.15, trim: 0.11 });
  holes.push({ face: 2, x: 0, y: 3.8, w: 0.9, h: 1.85, trim: 0.13 });
  taperedSquare(out, { y0: 3.7, y1: 20.2, r0: 3.217, r1: 2.77, color: stone, holes });
  // North semicircular stair projection is specified by the departmental archives.
  // Its front half is buried in the square core; only the northern half remains visible.
  const turret = transformed(out, 0, [0, 0, -2.48]);
  shell(turret, {
    profile: [
      [3.3, 1.51],
      [20.2, 1.24],
    ],
    holes: [
      { angle: Math.PI, y: 3.8, w: 0.9, h: 1.85, trimColor: trim },
      ...[8.7, 12.9, 17.1].map((y) => ({ angle: Math.PI, y, w: 0.34, h: 0.64, trimColor: trim })),
    ],
    slot: 'ashlar',
    color: stone,
    segments: 96,
  });
  for (let y = 4.0, k = 0; y < 20.2; y += 0.57, k++) {
    const r = 3.217 + ((2.77 - 3.217) * (y - 3.7)) / 16.5;
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        box(
          out,
          'granite',
          [x * r - (k % 2 ? 0.22 : 0.32), y, z * r - (k % 2 ? 0.32 : 0.22)],
          [x * r + (k % 2 ? 0.22 : 0.32), y + 0.43, z * r + (k % 2 ? 0.32 : 0.22)],
          trim,
        );
  }
  loft(out, 'granite', [square(3.5, 3.38), square(3.7, 3.44), square(3.87, 3.34)], trim);
  // Deep paired corbel brackets under the projecting medieval-looking gallery.
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    for (let i = 0; i < 7; i++) {
      const x = -2.7 + i * 0.9;
      box(o, 'granite', [x - 0.19, 19.6, 2.71], [x + 0.19, 20.25, 3.03], [0.49, 0.48, 0.415]);
      beam(o, 'granite', [x, 19.75, 2.82], [x, 21.25, 3.56], 0.33, 0.32, trim);
      box(o, 'granite', [x - 0.25, 20.72, 2.76], [x + 0.25, 21.39, 3.67], trim);
    }
  }
  loft(
    out,
    'granite',
    [square(21.35, 3.71), square(21.6, 3.78), square(21.83, 3.78), square(22.0, 3.61)],
    trim,
  );
  ring(turret, 'granite', 21.35, 0.05, 1.65, 0.65, trim, 96);
  for (let f = 0; f < 4; f++) {
    const o = transformed(out, (f * Math.PI) / 2);
    box(o, 'granite', [-3.61, 22, 3.3], [3.61, 22.57, 3.6], stone);
    for (const x of [-3.35, 3.35])
      box(o, 'granite', [x - 0.23, 22.4, 3.23], [x + 0.23, 23.28, 3.7], trim);
  }
  squareRails(out, 22.35, 3.39, 3.39, iron);
  lathe(
    out,
    'granite',
    [
      [22.03, 2.02],
      [23.55, 2.02],
    ],
    trim,
    96,
  );
  lantern(out, {
    bottom: 23.55,
    radius: 1.56,
    height: 1.75,
    color: iron,
    segments: 16,
    roofHeight: 0.95,
  });
  tube(out, 'metal', [0, 26.45, 0], [0, 26.9, 0], 0.027, iron, 8);
  // 2022 operator close photograph has PV pairs on the southern parapet and access ladder.
  for (const x0 of [-2.31, 0.1]) {
    const p = [
      [x0, 22.02, 3.8],
      [x0 + 2.2, 22.02, 3.8],
      [x0 + 2.2, 23.25, 3.03],
      [x0, 23.25, 3.03],
    ];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.075, 0.115, 0.16]);
    for (let i = 0; i <= 6; i++) {
      const x = x0 + (2.2 * i) / 6;
      beam(out, 'metal', [x, 22.02, 3.82], [x, 23.25, 3.05], 0.023, 0.028, pale);
    }
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      beam(
        out,
        'metal',
        [x0, 22.02 + 1.23 * t, 3.82 - 0.77 * t],
        [x0 + 2.2, 22.02 + 1.23 * t, 3.82 - 0.77 * t],
        0.023,
        0.03,
        pale,
      );
    }
  }
  const access = transformed(out, -Math.PI / 2, [-0.08, 0, 0]);
  ladder(access, 22.03, 23.59, 2.17, iron);
  for (const [x, z] of [
    [-2.6, 1.2],
    [2.7, -0.8],
  ]) {
    tube(out, 'metal', [x, 22, z], [x, 25.2, z], 0.031, iron, 8);
    tube(out, 'metal', [x - 0.38, 24.5, z], [x + 0.38, 24.5, z], 0.023, iron, 8);
  }
  // Short north doorway landing connects the tower to the mapped rock, without inventing the lost Temperley.
  const entry = transformed(out, Math.PI);
  for (let i = 0; i < 13; i++) {
    const y = 3.65 - i * 0.265;
    box(entry, 'granite', [-0.7, y, 3.8 + i * 0.31], [0.7, y + 0.24, 4.11 + i * 0.31], stone);
  }
  beam(entry, 'granite', [0, 3.42, 3.85], [0, 0.23, 7.83], 1.4, 0.28, stone);
  for (const x of [-0.8, 0.8]) tube(entry, 'metal', [x, 4.7, 3.8], [x, 1.15, 7.84], 0.031, iron, 8);
}

export const lighthouseNorthernStudies = [
  lighthouseStudy({
    id: 'N0652',
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    key: 'bell_rock_lighthouse',
    title: 'Bell Rock Lighthouse',
    wikidataId: 'Q2305375',
    build: buildBellRock,
    size: [12.8016, 36, 12.8016],
    visualBrief:
      'Curved white sandstone tower above a broad sea-washed granite base, high bronze door ladder and landing, small staggered windows and vents, echinus cornice, triangular bronze lantern, copper dome, open bird cage and SSE solar bay.',
    sourceFacts: {
      heightMeters: 36,
      baseDiameterMeters: 12.8016,
      shaftTopDiameterMeters: 4.572,
      solidMasonryHeightMeters: 9.144,
      year: 1811,
      basis:
        'Current NLB and HES height36m; original NLB quoted42ft base,15ft top and30ft solid base converted exactly. Profiles between those dimensional anchors and fittings are reconstructed from photographs and HES description.',
    },
    referencePages: [
      'https://www.nlb.org.uk/lighthouses/bell-rock/',
      'https://portal.historicenvironment.scot/designation/LB45197',
      'https://commons.wikimedia.org/wiki/File:Bell_Rock_Lighthouse_01.jpg',
      'https://www.openstreetmap.org/way/710617370',
    ],
    geographicProposal: {
      anchor: [-2.38729745, 56.43419915],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/710617370',
      notes:
        'Exact-QID mapped tower center supersedes the catalog point160m away. Authored+X east/+Z south places HES solar platform in the SSE octant. Door azimuth is photo-reconstructed; reef contact is delegated to host terrain.',
    },
    limitations: [
      'Asset covers the tower and attached equipment; detached reef walkways and landing infrastructure are separate site structures. The date-stamped2005 research photograph and2024 HES description govern visible details; individual repairs and marine staining are not surveyed.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [10, 35, 12], lookAt: [0, 33, 0] },
      { name: 'near-landing', position: [13, 13, 20], lookAt: [0, 10, 2.5] },
      { name: 'near-stone', position: [13, 8, 17], lookAt: [0, 5, 0] },
      { name: 'far-silhouette', position: [43, 25, 59], lookAt: [0, 17, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0653',
    key: 'bengtskar_lighthouse',
    title: 'Bengtskär Lighthouse',
    wikidataId: 'Q3737012',
    build: buildBengtskar,
    size: [30, 46, 15.5],
    visualBrief:
      'Granholm’s gray granite National Romantic keeper block with three storeys, divided red-brown windows, projecting quoins, copper gable roof and round-window curving pediment; long stone taper rises from its east end to a red gallery, white astragals and green copper lantern dome.',
    sourceFacts: {
      heightMeters: 46,
      focalOrSeaElevationMeters: 52,
      year: 1906,
      architect: 'Florentin Granholm',
      mainPlanMeters: [29.124, 13.564],
      basis:
        'NGA Pub195 identifies46m structure; operator52m is sea-relative elevation, not tower height. Main stepped plan from OSM1119816491 and tower center from1119816492. Storeys, detailed proportions and fittings reconstructed from current operator exterior photographs.',
    },
    referencePages: [
      'https://www.bengtskar.fi/en/home/',
      'https://www.bengtskar.fi/en/see-and-experience/worth-seeing-and-experiencing/',
      'https://www.bengtskar.fi/en/see-and-experience/the-dramatic-history-of-the-lighthouse/',
      'https://www.bengtskar.fi/wp-content/uploads/2024/11/taustakuva-vaalea-1-utvidgad.jpg',
      'https://msi.nga.mil/api/publications/download?key=16694491%2FSFH00000%2FPub195bk.pdf',
      'https://www.openstreetmap.org/way/1119816491',
      'https://www.openstreetmap.org/way/1119816492',
    ],
    geographicProposal: {
      anchor: [22.499259431579, 59.723439410526],
      heading: 0.068090906725,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/1119816492',
      notes:
        'Mapped circular tower-part centroid is the model origin. Main building long axis fixes heading0.068090906725rad; residential block extends west and round-window pediment faces south. Host terrain supplies the rock-island contact;52m sea elevation is not applied as building height.',
    },
    limitations: [
      'Asset is the main connected lighthouse/keeper building. Detached island outbuildings, trenches and natural rock are separate map features. Individual battle marks and stone blocks are represented by shared granite surface rather than invented documentary damage.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [11, 44, 15], lookAt: [0, 42.3, 0] },
      { name: 'near-house', position: [-28, 16, 34], lookAt: [-11, 9, 2] },
      { name: 'near-pediment', position: [-12, 19, 24], lookAt: [-11.5, 15.5, 7] },
      { name: 'far-ensemble', position: [-57, 30, 69], lookAt: [-7, 21, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0654',
    key: 'vieille_lighthouse',
    title: 'La Vieille Lighthouse',
    wikidataId: 'Q2085015',
    build: buildVieille,
    size: [8.4, 26.9, 12.0],
    visualBrief:
      'Weathered square granite tower with a full-height rounded northern stair projection, small white-framed openings, alternating corner stones, deep paired corbels and a castellated square gallery. Restored dark lantern, sector panes, southern solar panels and aerials follow the operator’s2022 photograph.',
    sourceFacts: {
      heightMeters: 26.9,
      seaElevationMeters: 36,
      year: 1887,
      basis:
        'Finistère departmental archives and DIRM2025 operator portfolio both publish26.90m structure height. Archive description specifies semicircular northern projection. DIRM photograph documents restored2022 lantern and notes the Temperley mast fell in2008; it is omitted.',
    },
    referencePages: [
      'https://archives.finistere.fr/histoires-animees/expositions-numeriques/phares-et-balises/la-vieille',
      'https://www.dirm.nord-atlantique-manche-ouest.developpement-durable.gouv.fr/IMG/pdf/livret_phares_2025_export_web_mini_cle527eb3.pdf',
      'https://www.openstreetmap.org/way/737263555',
    ],
    geographicProposal: {
      anchor: [-4.75644475, 48.0406734],
      heading: 0.161623460236,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/737263555',
      notes:
        'Exact-QID mapped square footprint sets the axis; the primary archive specifies its round projection on the north, resolving the quadrant. Authored-X eastish, -Z north-northwest rounded projection. Host terrain supplies contact with Gorle Bella rock.',
    },
    limitations: [
      'Square shaft dimensions follow the mapped6.43m plan; setbacks, corbels and projections are photo-proportioned. The rock is host terrain; external lost loading mast is deliberately absent from this post2022 exterior. Static lantern glazing does not simulate its navigation sectors.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [12, 25, 15], lookAt: [0, 22.9, 0] },
      { name: 'near-north-turret', position: [-12, 14, -19], lookAt: [0, 12, -2] },
      { name: 'near-entry', position: [10, 8, -15], lookAt: [0, 4, -3] },
      { name: 'far-silhouette', position: [35, 22, 45], lookAt: [0, 12.8, 0] },
    ],
  }),
];
