/** Rumeli's three-stage masonry tower and its distinctive open radar cage. */
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.87, 0.87, 0.82],
  silver = [0.61, 0.64, 0.62],
  dark = [0.17, 0.2, 0.19],
  TAU = Math.PI * 2;
// Base polygon from exact tower way1035459712, recentered on its bounding-box center.
const outline = [
  [-4.45, 0.34],
  [-3.52, -2.67],
  [-0.99, -4.27],
  [2.66, -3.32],
  [4.45, -0.2],
  [3.61, 2.83],
  [0.38, 4.27],
  [-3.41, 3.14],
];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
function floorRing(out, y, scale, h, slot = 'plaster', color = white) {
  loft(
    out,
    slot,
    [
      outline.map(([x, z]) => [x * scale, y, z * scale]),
      outline.map(([x, z]) => [x * scale, y + h, z * scale]),
    ],
    color,
  );
}
function stage(out, y0, y1, scale, windows) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i].map((v) => v * scale),
      b = outline[(i + 1) % 8].map((v) => v * scale),
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const f = transformed(out, Math.atan2(dz, -dx), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
    const hs = windows
      .filter((w) => w.face === i)
      .map((w) => ({ x: 0, y: w.y, w: w.w ?? 0.41, h: w.h ?? 0.89, depth: 0.24, trim: 0.055 }));
    piercedFacade(f, {
      half: Math.hypot(dx, dz) / 2,
      y0,
      y1,
      z: 0,
      holes: hs,
      slot: 'plaster',
      color: white,
    });
    for (const h of hs) {
      panel(f, 'wood', -h.w / 2, h.w / 2, h.y, h.y + h.h, -0.215, [0.47, 0.49, 0.42]);
      panel(
        f,
        'glass',
        -h.w / 2 + 0.04,
        h.w / 2 - 0.04,
        h.y + 0.04,
        h.y + h.h - 0.04,
        -0.2,
        [0.17, 0.24, 0.23],
      );
      for (const x of [-h.w / 2 + 0.02, h.w / 2 - 0.02])
        box(f, 'wood', [x - 0.02, h.y, -0.215], [x + 0.02, h.y + h.h, -0.17], white);
      box(
        f,
        'wood',
        [-h.w / 2, h.y + h.h * 0.53 - 0.016, -0.19],
        [h.w / 2, h.y + h.h * 0.53 + 0.016, -0.16],
        white,
      );
    }
  }
}
function cornice(out, y, from, to, h) {
  loft(
    out,
    'plaster',
    [
      outline.map(([x, z]) => [x * from, y, z * from]),
      outline.map(([x, z]) => [x * to, y + h * 0.45, z * to]),
      outline.map(([x, z]) => [x * to, y + h, z * to]),
    ],
    white,
  );
}
function galleryRail(out) {
  const poly = outline.map(([x, z]) => [x * 0.78, z * 0.78]);
  for (let i = 0; i < 8; i++) {
    const a = poly[i],
      b = poly[(i + 1) % 8];
    for (const y of [25.16, 25.56, 25.96])
      tube(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.021, silver, 8);
    for (let k = 0; k < 3; k++) {
      const t = k / 3,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      tube(out, 'metal', [x, 25.02, z], [x, 26.02, z], 0.023, silver, 8);
    }
  }
}
function lantern(out) {
  lathe(
    out,
    'metal',
    [
      [25.05, 1.04],
      [25.19, 1.07],
      [26.52, 0.89],
      [26.63, 0.89],
    ],
    white,
    96,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      b = ((i + 1) * TAU) / 12,
      p = [P(0.86, 26.63, a), P(0.86, 26.63, b), P(0.86, 28.87, b), P(0.86, 28.87, a)];
    quad(out, 'glassClear', p, normalFor(...p.slice(0, 3)), [0.88, 0.95, 0.91]);
    tube(out, 'metal', P(0.88, 26.61, a), P(0.88, 28.9, a), 0.025, silver, 8);
  }
  for (const y of [26.59, 27.71, 28.87]) ring(out, 'metal', y, 0.8, 0.915, 0.065, silver, 96);
  lathe(
    out,
    'metal',
    [
      [26.65, 0.27],
      [27.08, 0.27],
    ],
    [0.35, 0.4, 0.36],
    48,
  );
  lathe(
    out,
    'glassClear',
    [
      [27.08, 0.38],
      [27.73, 0.52],
      [28.19, 0.34],
    ],
    [0.52, 0.58, 0.4],
    64,
  );
  for (let y = 27.11; y < 28.19; y += 0.085) {
    const r = y < 27.73 ? 0.38 + ((y - 27.08) * 0.14) / 0.65 : 0.52 - ((y - 27.73) * 0.18) / 0.46;
    ring(out, 'metal', y, r - 0.012, r + 0.012, 0.012, [0.52, 0.54, 0.43], 64);
  }
  lathe(
    out,
    'metal',
    [
      [28.91, 0.98],
      [29.05, 0.98],
      [29.64, 0.28],
      [29.75, 0.14],
      [29.89, 0.11],
    ],
    white,
    128,
  );
  sphere(out, 'metal', [0, 29.95, 0], [0.075, 0.075, 0.075], silver, 24, 12);
  for (let i = 0; i < 12; i++)
    tube(
      out,
      'metal',
      P(0.98, 29.05, (i * TAU) / 12),
      P(0.28, 29.64, (i * TAU) / 12),
      0.012,
      silver,
      6,
    );
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8;
    tube(out, 'metal', P(1.48, 26.58, a), P(1.48, 26.58, b), 0.018, silver, 8);
    tube(out, 'metal', P(1.48, 26.58, a), P(1.48, 27.28, a), 0.021, silver, 8);
    tube(out, 'metal', P(1.48, 27.28, a), P(1.48, 27.28, b), 0.018, silver, 8);
    beam(out, 'metal', P(0.95, 26.52, a), P(1.49, 26.52, a), 0.05, 0.06, silver);
  }
}
function radar(out) {
  // Four long corner legs surround the lantern without filling its silhouette.
  for (const x of [-1.71, 1.71])
    for (const z of [-1.71, 1.71]) {
      tube(out, 'metal', [x, 25.04, z], [x, 30.18, z], 0.035, dark, 10);
      tube(out, 'metal', [x, 30.18, z], [0, 30.62, 0], 0.034, dark, 10);
      box(out, 'metal', [x - 0.09, 25.02, z - 0.09], [x + 0.09, 25.12, z + 0.09], silver);
    }
  for (const y of [25.2, 30.17])
    for (const x of [-1.71, 1.71]) {
      tube(out, 'metal', [x, y, -1.71], [x, y, 1.71], 0.032, dark, 8);
      tube(out, 'metal', [-1.71, y, x], [1.71, y, x], 0.032, dark, 8);
    }
  const ladder = transformed(out, -Math.PI / 2, [0, 0, 0]);
  for (const x of [-0.24, 0.24])
    tube(ladder, 'metal', [x, 25.03, 1.23], [x, 32.37, 1.23], 0.025, silver, 8);
  for (let y = 25.15; y < 32.35; y += 0.24)
    tube(ladder, 'metal', [-0.24, y, 1.23], [0.24, y, 1.23], 0.017, silver, 8);
  for (let y = 27; y < 32.5; y += 0.67) {
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 14,
        b = -Math.PI / 2 + ((i + 1) * Math.PI) / 14;
      const q = (t) => [Math.sin(t) * 0.43, y, 1.24 + Math.cos(t) * 0.56];
      tube(ladder, 'metal', q(a), q(b), 0.015, silver, 6);
    }
  }
  for (const a of [-Math.PI / 2, 0, Math.PI / 2])
    tube(
      ladder,
      'metal',
      [Math.sin(a) * 0.43, 27, 1.24 + Math.cos(a) * 0.56],
      [Math.sin(a) * 0.43, 32.35, 1.24 + Math.cos(a) * 0.56],
      0.015,
      silver,
      6,
    );
  tube(out, 'metal', [0, 29.95, 0], [0, 33.8, 0], 0.065, silver, 16);
  lathe(
    out,
    'metal',
    [
      [32.79, 0.25],
      [33.05, 0.25],
    ],
    silver,
    32,
  );
  const boom = transformed(out, 0.2);
  box(boom, 'metal', [-1.3, 33.09, -0.11], [1.3, 33.27, 0.11], [0.61, 0.055, 0.07]);
  for (let x = -1.14; x <= 1.2; x += 0.285) {
    tube(boom, 'metal', [x, 33.12, -0.34], [x, 33.12, 0.34], 0.025, [0.55, 0.06, 0.08], 8);
    tube(boom, 'metal', [x, 33.2, 0], [x, 33.51, 0], 0.016, silver, 8);
  }
  tube(out, 'metal', [2.34, 25.04, -1.0], [2.34, 28.7, -1.0], 0.016, silver, 8);
  // A photographed exterior cable descends the southwest face to the base.
  const c = transformed(out, -0.7);
  tube(c, 'metal', [0, 0.25, 4.16], [0, 10.35, 4.16], 0.017, dark, 8);
  tube(c, 'metal', [0, 10.35, 4.16], [0, 13.1, 3.45], 0.017, dark, 8);
  tube(c, 'metal', [0, 13.1, 3.45], [0, 24.85, 2.72], 0.017, dark, 8);
}
function doorway(out) {
  const a = outline[7],
    b = outline[0],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    f = transformed(out, Math.atan2(dz, -dx), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
  // The tomb entrance is on the landward western side. Its inset opening is authored in stage().
  panel(f, 'wood', -0.51, 0.51, 0.13, 2.31, -0.22, [0.21, 0.23, 0.19]);
  for (const x of [-0.45, 0, 0.45])
    box(f, 'wood', [x - 0.022, 0.15, -0.2], [x + 0.022, 2.31, -0.175], white);
  for (const yy of [0.62, 1.43, 2.24])
    box(f, 'wood', [-0.49, yy - 0.024, -0.2], [0.49, yy + 0.024, -0.175], white);
  box(f, 'granite', [-0.76, 0, -0.4], [0.76, 0.12, 0.85], [0.55, 0.55, 0.48]);
  box(f, 'granite', [-0.7, 0.12, -0.4], [0.7, 0.24, 0.42], [0.62, 0.62, 0.54]);
  box(f, 'metal', [-0.45, 2.65, 0.015], [0.45, 2.99, 0.045], [0.1, 0.23, 0.23]);
  // Kept an unlettered plaque: the reference does not resolve exact modern inscription content.
}
export function buildRumeli(out) {
  floorRing(out, 0, 1.025, 0.22, 'limestone', [0.69, 0.68, 0.6]);
  stage(out, 0.22, 10.44, 1, [
    { face: 7, y: 0.24, w: 1.02, h: 2.13 },
    { face: 6, y: 4.3, w: 0.32, h: 0.72 },
    { face: 5, y: 6.6, w: 0.31, h: 0.74 },
    { face: 6, y: 8.05, w: 0.31, h: 0.74 },
    { face: 2, y: 5.4, w: 0.31, h: 0.74 },
  ]);
  cornice(out, 10.44, 1, 1.045, 0.22);
  floorRing(out, 10.66, 1.045, 0.11, 'metal', silver);
  stage(out, 10.77, 13.24, 0.8, [{ face: 7, y: 11.55, w: 0.41, h: 0.82 }]);
  cornice(out, 13.24, 0.8, 0.843, 0.18);
  floorRing(out, 13.42, 0.843, 0.085, 'metal', silver);
  stage(out, 13.5, 24.8, 0.66, [
    { face: 5, y: 15.46 },
    { face: 6, y: 17.02 },
    { face: 5, y: 18.61 },
    { face: 6, y: 20.18 },
    { face: 5, y: 21.91 },
    { face: 6, y: 23.06 },
    { face: 2, y: 16.8 },
    { face: 1, y: 20.2 },
  ]);
  cornice(out, 24.8, 0.66, 0.77, 0.15);
  floorRing(out, 24.95, 0.78, 0.095, 'metal', silver);
  doorway(out);
  galleryRail(out);
  lantern(out);
  radar(out);
}
export const rumeliStudies = [
  lighthouseStudy({
    id: 'N0670',
    key: 'rumeli_feneri',
    title: 'Rumeli Feneri',
    wikidataId: 'Q3269761',
    build: buildRumeli,
    size: [10, 33.8, 10],
    visualBrief:
      'White three-stage octagonal masonry tower on its mapped eight-sided base, narrow staggered staircase windows, projecting zinc-colored stage caps, railed gallery, small clear lantern on tapering service drum, conical cap, tall four-legged external antenna cage, caged ladder, red radar array and exterior cable.',
    sourceFacts: {
      towerHeightMeters: 30,
      focalElevationMeters: 58,
      modeledRadarMastHeightMeters: 33.8,
      basis:
        'Coastal Safety Directorate publishes30m three-stage masonry tower and58m light elevation. Its opposed day/night and aerial photographs constrain stage proportions, white masonry, narrow stair windows, lantern and characteristic cage/antenna ensemble. OSMtower way1035459712 supplies the8.9x8.54m octagonal ground envelope; photographed stage proportions are13.5m combined lower tiers and11.3m upper shaft. Radar extension is photo-proportioned above the published tower height.',
    },
    referencePages: [
      'https://kiyiemniyeti.gov.tr/yer-detay/114/TURKELI-(RUMELI)-FENERI',
      'https://kiyiemniyeti.gov.tr/Data/1/Files/Place/Images/8Q/ju/AM/9T/Original/123_51b9a3a8-3b62-4eec-8029-3624335177dc.png',
      'https://kiyiemniyeti.gov.tr/Data/1/Files/Place/Images/WW/Xw/Mi/51/Original/69_f929c4b0-19da-4c74-8b62-d66b70cc76f0.jpg',
      'https://www.openstreetmap.org/way/1035459712',
      'https://sgb.uab.gov.tr/haberler/ulastirma-bakani-karaismailoglu-tarihi-sile-deniz-feneri-ni-ozgun-haline-geri-dondurduk',
    ],
    geographicProposal: {
      anchor: [29.11214925, 41.23422865],
      heading: 0,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/1035459712',
      notes:
        'Mapped octagonal tower bounding-box center; authored+X east,+Z south and all eight ground vertices preserve the actual footprint direction. This is within one meter of the exact-QID tower node. South/southeast photographed stair-window faces are matched to the coastal photo axis, while the west doorway faces the landward approach. Ground contact uses the tower footing, not the58m optical elevation.',
    },
    limitations: [
      'Source follows the operator-published tower exterior and antenna configuration. Ministry reports restoration activity but provides no verified completed replacement equipment configuration; temporary construction gear is omitted. Unpublished floor heights, windows, lantern hardware and tomb doorway trim are photograph-proportioned. Unresolved inscription text is not fabricated. Neighboring detached keeper/public buildings, mosque and modern control tower remain separate map structures.',
    ],
    qaCameras: [
      { name: 'near-entry', position: [-10, 4, 4], lookAt: [-3.9, 1.4, 1] },
      { name: 'near-stair-windows', position: [8, 19, 11], lookAt: [0, 19, 0] },
      { name: 'near-lantern-cage', position: [7, 28.4, 8], lookAt: [0, 28.2, 0] },
      { name: 'near-radar', position: [4, 34.6, 5], lookAt: [0, 32.5, 0] },
      { name: 'far-silhouette', position: [26, 20, 34], lookAt: [0, 16.5, 0] },
    ],
  }),
];
