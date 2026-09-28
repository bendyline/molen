/** Original exterior reconstruction from the Ukrainian lighthouse operator's references. */
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.88, 0.9, 0.87],
  red = [0.66, 0.035, 0.026],
  blue = [0.025, 0.42, 0.55],
  green = [0.02, 0.25, 0.23],
  dark = [0.06, 0.08, 0.085];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
function polygonSlab(out, slot, p, y0, y1, color, skipEdge = () => false) {
  const indices = earcut(p.flat(), null, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const ps = indices.slice(i, i + 3).map((k) => [p[k][0], y1, p[k][1]]);
    if (normalFor(...ps)[1] < 0) ps.reverse();
    out.addTriangle(
      slot,
      'metric:uv',
      ps,
      [0, 1, 0],
      ps.map((q) => [q[0], q[2]]),
      color,
    );
  }
  const signed = p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if (skipEdge(a, b)) continue;
    const ps = [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ];
    if (signed < 0) ps.reverse();
    quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
  }
}
function lineRail(out, a, b, y, color = green) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.ceil(length / 1.25);
  for (let j = 0; j <= n; j++) {
    const t = j / n,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    tube(out, 'metal', [x, y, z], [x, y + 1, z], 0.025, color, 8);
  }
  for (const yy of [y + 0.46, y + 0.99])
    tube(out, 'metal', [a[0], yy, a[1]], [b[0], yy, b[1]], 0.025, color, 8);
}
function sagCable(out, a, b, drop, color = dark) {
  let last = a;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24,
      p = a.map((v, j) => v + (b[j] - v) * t);
    p[1] -= 4 * drop * t * (1 - t);
    tube(out, 'metal', last, p, 0.012, color, 6);
    last = p;
  }
}
function bendPipe(out, x, z) {
  // The paired downward-facing blue cowls are particularly characteristic of this station.
  const points = [
    [x + 0.6, 1.53, z],
    [x + 0.22, 1.53, z],
    [x + 0.05, 1.67, z],
    [x, 1.88, z],
    [x, 5.02, z],
  ];
  for (let i = 1; i < points.length; i++)
    tube(out, 'metal', points[i - 1], points[i], 0.24, blue, 24);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    tube(
      out,
      'metal',
      [x, 5.02 + 0.34 * Math.sin(a), z + 0.34 * (1 - Math.cos(a))],
      [x, 5.02 + 0.34 * Math.sin(b), z + 0.34 * (1 - Math.cos(b))],
      0.24,
      blue,
      24,
    );
  }
  tube(out, 'metal', [x, 5.36, z + 0.34], [x, 5.1, z + 0.48], 0.24, blue, 24);
  for (const y of [2.2, 3.35, 4.66])
    tube(
      out,
      'metal',
      [x, y - 0.04, z],
      [x, y + 0.04, z],
      0.266,
      blue.map((v) => v * 0.8),
      24,
    );
  box(out, 'metal', [x - 0.12, 1.13, z - 0.14], [x + 0.4, 1.62, z + 0.14], blue);
}
function compound(out) {
  // Exact coastline points rotated into the documented pier axis (+Z south-southeast).
  // The pier beyond this station is supplied by map data; the source ends at the stair foot.
  const base = [
    [5.95, 24],
    [6.156, 21.083],
    [5.769, 4.192],
    [4.543, -1.97],
    [3.364, -4.848],
    [1.556, -7.42],
    [-1, -9.375],
    [-4.166, -10.292],
    [-6.806, -9.185],
    [-8.849, -7.042],
    [-10.041, -4.014],
    [-9.896, -1.753],
    [-9.184, 0.475],
    [-7.464, 3.305],
    [-5.392, 5.858],
    [-3.554, 9.767],
    [-2.616, 13.868],
    [0.299, 13.711],
    [0.45, 24],
  ];
  polygonSlab(out, 'rubble', base, 0, 0.62, [0.32, 0.33, 0.29]);
  polygonSlab(out, 'plaster', base, 0.62, 1.2, white);
  const frontA = [-8.2, -5.8],
    frontB = [-3.6, 8.4];
  const head = base.slice(2, 10).map(([x, z]) => [x * 0.87, z * 0.87]);
  head.push(frontA, frontB, [1, 10.7], [4.9, 10.7]);
  polygonSlab(out, 'plaster', head, 1.17, 3.91, white, (a, b) => a === frontA && b === frontB);
  polygonSlab(out, 'concrete', head, 3.91, 4, [0.65, 0.7, 0.66]);
  // Service-room facade faces the harbor (west-southwest), with blue metal doors.
  const facadeHalf = Math.hypot(frontB[0] - frontA[0], frontB[1] - frontA[1]) / 2;
  const face = transformed(
    out,
    Math.atan2(-(frontB[1] - frontA[1]), frontB[0] - frontA[0]),
    [-5.9, 0, 1.3],
  );
  piercedFacade(face, {
    half: facadeHalf,
    y0: 1.18,
    y1: 3.43,
    z: 0,
    holes: [
      { x: -3.7, y: 1.2, w: 0.83, h: 1.83, trim: 0, depth: 0.12 },
      { x: 0.45, y: 1.2, w: 0.87, h: 1.83, trim: 0, depth: 0.12 },
      { x: 4.4, y: 1.42, w: 1.75, h: 1.29, trim: 0, depth: 0.22 },
    ],
    slot: 'plaster',
    color: white,
  });
  for (const x of [-3.7, 0.45]) {
    panel(face, 'metal', x - 0.414, x + 0.414, 1.21, 3.02, -0.115, blue);
    for (const y of [1.47, 2.05, 2.63])
      for (const dx of [-0.21, 0.21]) {
        box(
          face,
          'metal',
          [x + dx - 0.085, y - 0.12, -0.101],
          [x + dx + 0.085, y + 0.12, -0.085],
          white,
        );
        box(
          face,
          'metal',
          [x + dx - 0.05, y - 0.074, -0.084],
          [x + dx + 0.05, y + 0.074, -0.067],
          blue.map((v) => v * 0.7),
        );
      }
    box(face, 'metal', [x + 0.3, 2.12, -0.085], [x + 0.34, 2.26, -0.027], dark);
  }
  box(face, 'plaster', [-facadeHalf, 3.4, -0.45], [facadeHalf, 3.96, 0.18], white);
  for (const x of [3.93, 4.89])
    box(face, 'plaster', [x - 0.13, 1.4, -0.21], [x + 0.13, 2.84, 0.04], white);
  for (const x of [-2.18, -0.12]) bendPipe(transformed(face, Math.PI / 2, [x, 0, 0.35]), 0, 0);
  // Harbor stair climbs from the breakwater to the service deck, with solid wave walls.
  for (let i = 0; i < 16; i++) {
    const z = 10.4 + i * 0.53,
      top = 4 - (i + 1) * 0.175;
    box(out, 'concrete', [1.07, 1.19, z], [4.37, top, z + 0.535], [0.72, 0.76, 0.71]);
  }
  for (const x of [0.8, 4.64]) {
    for (let i = 0; i < 16; i++) {
      const z = 10.4 + i * 0.53,
        top = 4.4 - i * 0.175;
      box(out, 'plaster', [x - 0.15, 1.2, z], [x + 0.15, top, z + 0.535], white);
    }
    tube(out, 'metal', [x, 4.95, 10.4], [x, 2.31, 18.7], 0.028, green, 8);
  }
  for (let i = 0; i < head.length; i++) {
    const a = head[i],
      b = head[(i + 1) % head.length];
    if (a[1] > 10 && b[1] > 10) continue;
    lineRail(out, a, b, 4);
  }
  lineRail(out, frontB, [0.78, 10.7], 4);
  // Small deck ladder and marine utility posts visible in the operator's photographs.
  for (const x of [-6.7, -6.12]) tube(face, 'metal', [x, 1.18, 1.13], [x, 4.05, 0], 0.031, blue, 8);
  for (let j = 0; j < 11; j++) {
    const t = j / 10;
    tube(
      face,
      'metal',
      [-6.7, 1.18 + 2.87 * t, 1.13 * (1 - t)],
      [-6.12, 1.18 + 2.87 * t, 1.13 * (1 - t)],
      0.025,
      blue,
      8,
    );
  }
  const posts = [
    [-3.9, 4, -4.2, 8.2],
    [3.6, 4, 8.6, 11.5],
    [-5.4, 4, 1.3, 7.2],
  ];
  for (const [x, y, z, top] of posts) {
    tube(out, 'metal', [x, y, z], [x, top, z], 0.06, green, 12);
    for (const yy of [top - 0.36, top - 0.13])
      beam(out, 'metal', [x - 0.16, yy, z], [x + 0.16, yy, z], 0.026, 0.025, dark);
    tube(out, 'metal', [x, top, z], [x, top + 0.66, z], 0.021, dark, 8);
  }
  sagCable(out, [-3.9, 8, -4.2], [3.6, 11.25, 8.6], 2.15);
  sagCable(out, [3.6, 11.3, 8.6], [0, 29.6, 0], 0.63);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    tube(out, 'metal', P(2.65, 4.02, a), P(2.65, 4.86, a), 0.039, white, 8);
    sagCable(out, P(2.65, 4.8, a), P(2.65, 4.8, b), 0.23);
  }
}
export function buildVorontsov(out) {
  compound(out);
  lathe(
    out,
    'metal',
    [
      [4, 2.37],
      [4.12, 2.37],
      [4.2, 2.18],
    ],
    white,
    144,
  );
  shell(out, {
    profile: [
      [4.16, 2.16],
      [24.75, 2.16],
    ],
    holes: [
      { angle: 0, y: 4.2, w: 0.85, h: 1.92, depth: 0.13, trimSlot: 'metal', trimColor: white },
      {
        angle: -Math.PI / 2,
        y: 23.37,
        w: 0.29,
        h: 0.29,
        depth: 0.08,
        trimSlot: 'metal',
        trimColor: white,
      },
      {
        angle: Math.PI / 2,
        y: 23.37,
        w: 0.29,
        h: 0.29,
        depth: 0.08,
        trimSlot: 'metal',
        trimColor: white,
      },
    ],
    slot: 'metal',
    color: white,
    segments: 160,
  });
  panel(
    out,
    'metal',
    -0.425,
    0.425,
    4.2,
    6.12,
    2.025,
    white.map((v) => v * 0.87),
  );
  box(out, 'metal', [0.23, 5.07, 2.035], [0.29, 5.23, 2.075], dark);
  for (let row = 1; row < 17; row++) {
    const y = 4.16 + row * 1.21;
    ring(out, 'metal', y, 2.156, 2.166, 0.014, [0.66, 0.72, 0.69], 160);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + ((row % 2) * Math.PI) / 6;
      tube(
        out,
        'metal',
        P(2.164, y - 1.18, a),
        P(2.164, y - 0.014, a),
        0.008,
        [0.69, 0.75, 0.71],
        6,
      );
    }
  }
  lathe(
    out,
    'metal',
    [
      [24.65, 2.16],
      [24.83, 2.31],
      [24.96, 2.76],
      [25.08, 2.76],
    ],
    white,
    160,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    tube(out, 'metal', P(1.7, 25.16, a), P(4.25, 25.02, a), 0.042, white, 10);
    tube(out, 'metal', P(2.18, 24.27, a), P(3.56, 25.03, a), 0.029, white, 8);
    tube(out, 'metal', P(4.22, 25.01, a), P(4.55, 25.34, a), 0.033, white, 8);
    sphere(out, 'glass', P(4.24, 24.98, a), [0.11, 0.1, 0.11], [0.84, 0.84, 0.65], 16, 10);
  }
  lathe(
    out,
    'metal',
    [
      [25.08, 1.64],
      [26.14, 1.64],
    ],
    red,
    144,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    const ps = [P(1.66, 26.14, a), P(1.66, 26.14, b), P(1.66, 28, b), P(1.66, 28, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.22, 0.28, 0.27]);
    tube(out, 'metal', P(1.672, 26.1, a), P(1.672, 28.08, a), 0.039, red, 10);
    tube(out, 'metal', P(1.88, 25.09, a), P(1.88, 28.13, a), 0.022, red, 8);
  }
  for (const y of [26.13, 27.06, 28]) ring(out, 'metal', y, 1.6, 1.72, 0.065, red, 128);
  for (const y of [25.11, 26.05, 28.09]) ring(out, 'metal', y, 1.86, 1.9, 0.035, red, 96);
  // Curved shoulder into a shallow red roof; no invented historic roof profile.
  lathe(
    out,
    'metal',
    [
      [28.06, 1.93],
      [28.17, 1.93],
      [28.29, 1.57],
      [28.42, 1.15],
      [28.69, 0.64],
      [28.89, 0.23],
      [29.02, 0.16],
    ],
    red,
    144,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    tube(
      out,
      'metal',
      P(1.93, 28.17, a),
      P(0.22, 28.89, a),
      0.014,
      red.map((v) => v * 0.8),
      6,
    );
  }
  sphere(out, 'metal', [0, 29.21, 0], [0.2, 0.23, 0.2], red, 32, 16);
  tube(out, 'metal', [0, 29.38, 0], [0, 30, 0], 0.021, dark, 8);
  tube(out, 'metal', [0, 29.83, 0], [0.08, 31.18, 0.02], 0.013, white, 8);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    tube(out, 'metal', P(1.4, 28.36, a), [0.06, 30.76, 0.02], 0.009, dark, 6);
  const hatch = transformed(out, 0);
  panel(
    hatch,
    'metal',
    -0.39,
    0.39,
    25.11,
    26.1,
    1.645,
    red.map((v) => v * 0.68),
  );
  box(hatch, 'metal', [0.22, 25.42, 1.65], [0.26, 25.57, 1.7], white);
}

export const lighthouseBlackseaStudies = [
  lighthouseStudy({
    id: 'N0667',
    key: 'vorontsov_lighthouse',
    title: 'Vorontsov Lighthouse',
    wikidataId: 'Q1976702',
    build: buildVorontsov,
    size: [20, 31.2, 35],
    smoothNormalSlots: ['trim'],
    previewCamera: { position: [-46, 24, 45], lookAt: [-1, 13, 3], fov: 45 },
    visualBrief:
      'White jointed cylindrical cast-iron tower with sparse portholes, projecting circular gallery and eight light arms, red caged lantern and shallow roof, paired blue cowled pipes, harbor-side service doors, tiered white platform, deck railings, chain barrier and breakwater access stair.',
    sourceFacts: {
      towerHeightMeters: 26,
      focalHeightMeters: 27,
      appearanceEra: 'Operator photographs published2018–2019',
      towerBaseAboveModelDatumPhotoApproxMeters: 4,
      bodyDiameterPhotoApproxMeters: 4.32,
      basis:
        'Ukraine State Hydrography publishes26m tower height from base and27m focal elevation. Its two station photographs control the cylindrical section joints, red lantern, radial brackets, blue service fittings and asymmetric white compound. Tower cap is at30m over model sea datum and main tower base at4m, with lantern focal center27m. Thin aerial tip extends above the documented tower envelope. Compound plan is derived from exact tower-QID node and adjoining coastline ways; small exterior dimensions remain photo-proportioned.',
    },
    referencePages: [
      'https://hydro.gov.ua/?page_id=381',
      'https://hydro.gov.ua/?p=1262',
      'https://hydro.gov.ua/wp-content/uploads/2018/09/1-19.png',
      'https://hydro.gov.ua/wp-content/uploads/2019/06/64799486_646013762541915_8439423072338968576_n.jpg',
      'https://www.openstreetmap.org/node/703128124',
      'https://www.openstreetmap.org/way/555774482',
      'https://www.openstreetmap.org/way/1035205249',
    ],
    geographicProposal: {
      anchor: [30.7600343, 46.4965348],
      heading: 0.5,
      elevationMode: 'sea-level',
      elevationMeters: 0,
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/703128124',
      notes:
        'Exact-QID tower node anchors the cylinder. +Z follows the south-southeast pier axis (0.5rad from south toward east); compound shoreline points are inverse-rotated from world coordinates. The model waterline isY0, quay body rises above it and lighthouse service deck isY4. Absolute sea-level placement retains the operator’s27m light elevation; local tides/waves are host water effects. Published compound photographs resolve harbor-facing service facade on the southwest side.',
    },
    limitations: [
      'Exterior represents the operator-published2018–2019 configuration. Hidden power-room equipment and unlocated later solar equipment are not invented; external service fittings visible in those references are represented. Published26m structural and27m light heights govern the silhouette; service-deck height, pipe details and cast-iron seam pitch are reconstructed from photographs. The remaining long breakwater is a separate map structure.',
    ],
    qaCameras: [
      { name: 'near-service', position: [-17, 7, 16], lookAt: [-4, 3.2, 4] },
      { name: 'near-lantern', position: [-10, 28.9, 12], lookAt: [0, 26.8, 0] },
      { name: 'near-deck', position: [7, 8.3, 17], lookAt: [0, 4.5, 5] },
      { name: 'far-silhouette', position: [-46, 22, 45], lookAt: [-1, 14, 3] },
    ],
  }),
];
