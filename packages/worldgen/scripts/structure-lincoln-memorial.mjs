/** Lincoln Memorial temple and upper approach; NPS dimensions, mapped parts and Qualla photos. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('e2dfd3'),
  pale = rgb('ece9df'),
  granite = rgb('b0a08e'),
  dark = rgb('656b61'),
  metal = rgb('4b514b'),
  grass = rgb('7b8561');
const floor = 6.7,
  colH = 13.4112,
  colR = 1.1303,
  cx = 27.55,
  cz = 16.93;
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uu = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uu[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function column(o, x, z, d, inner = false) {
  const r = colR * (inner ? 0.96 : 1),
    h = colH;
  if (d === 0) {
    B(o, 'marble', x, floor, z, r * 1.8, h, r * 1.8, white);
    return;
  }
  const n = d > 2 ? 40 : d > 1 ? 40 : 8,
    segments = d > 2 ? 10 : 1;
  const ring = (y, rr) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n,
        flute = d > 1 && i % 2 ? 0.95 : 1;
      return [x + Math.cos(a) * rr * flute, y, z + Math.sin(a) * rr * flute];
    });
  for (let j = 0; j < segments; j++) {
    const t = j / segments,
      u = (j + 1) / segments,
      rr = (t) => r * (1 - 0.14 * t + 0.025 * Math.sin(Math.PI * t));
    loft(
      o,
      'marble',
      [ring(floor + t * (h - 0.65), rr(t)), ring(floor + u * (h - 0.65), rr(u))],
      j % 3 === 0 ? rgb('d9d7cc') : white,
      { cap: false },
    );
  }
  if (d > 1)
    loft(
      o,
      'marble',
      [
        [h - 0.65, r * 0.87],
        [h - 0.48, r * 0.93],
        [h - 0.28, r * 1.15],
      ].map(([y, rr]) => radialRing(floor + y, rr, rr, d > 2 ? 32 : 16, [x, z])),
      pale,
    );
  B(o, 'marble', x, floor + h - 0.28, z, r * 2.55, 0.28, r * 2.55, pale);
}
function stair(o, z0, z1, low, high, w, d, slot = 'granite') {
  const n = d === 0 ? 2 : d === 1 ? 6 : Math.round((high - low) / 0.17);
  for (let i = 0; i < n; i++) {
    const dep = (z1 - z0) / n,
      y = low + ((high - low) * (i + 1)) / n;
    B(
      o,
      slot,
      0,
      -1.2,
      z1 - dep * (i + 0.5),
      w,
      y + 1.2,
      dep + 0.015,
      slot === 'marble' ? white : granite,
    );
  }
}
function wreath(o, x, y, z, r, d) {
  const n = d > 2 ? 16 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    beam(
      o,
      'marble',
      [x + Math.sin(a) * r, y + Math.cos(a) * r, z],
      [x + Math.sin(b) * r, y + Math.cos(b) * r, z],
      d > 2 ? 0.17 : 0.13,
      0.13,
      pale,
    );
  }
  if (d > 2)
    for (const s of [-1, 1])
      beam(
        o,
        'marble',
        [x + s * 0.12, y - r, z],
        [x + s * 0.36, y - r - 0.22, z],
        0.13,
        0.13,
        white,
      );
}
function frieze(o, w, z, d, az) {
  if (d < 2) return;
  const n = Math.round(w / 5.0);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (i * w) / n;
    wreath(o, x, 22.1, z, 0.5, d);
    if (d > 2) {
      for (let k = 0; i < n && k < 7; k++) {
        const xx = x + 0.7 + k * 0.28;
        face(o, 'marble', xx, 21.75, z, 0.13, 0.055, dark);
        face(o, 'marble', xx, 22.04, z, 0.13, 0.045, dark);
      }
      const a = x - 1.2;
      for (let k = 0; k < 6; k++) {
        const xx = a + k * 0.22;
        B(o, 'marble', xx, 23.8, z - 0.05, 0.14, 0.32, 0.15, white);
      }
    }
  }
  // Garland/eagle relief is an original low relief cue, with no fictitious readable lettering.
  if (d > 2)
    for (let x = -w * 0.38; x <= w * 0.38; x += 3.3) {
      for (let i = 0; i < 10; i++) {
        const a = -1 + i / 5,
          b = -1 + (i + 1) / 5;
        beam(
          o,
          'marble',
          [x + a * 1.45, 28.7 - 0.6 * (1 - a * a), az],
          [x + b * 1.45, 28.7 - 0.6 * (1 - b * b), az],
          0.16,
          0.13,
          white,
        );
      }
      B(o, 'marble', x, 28.8, az, 0.17, 0.5, 0.16, pale);
      for (const s of [-1, 1])
        beam(o, 'marble', [x, 29, az + 0.05], [x + s * 0.65, 29.25, az + 0.05], 0.25, 0.18, pale);
    }
}
function urn(o, x, z, y, d) {
  if (d === 0) return;
  const n = d > 2 ? 16 : 8;
  B(o, 'granite', x, y, z, 1.7, 0.28, 1.7, granite);
  loft(
    o,
    'marble',
    [
      [0.28, 0.42],
      [0.65, 0.28],
      [2.1, 0.25],
      [2.55, 0.63],
      [2.8, 0.82],
      [3, 0.85],
    ].map(([h, r]) => radialRing(y + h, r, r, n, [x, z])),
    rgb('c5b9a5'),
  );
  if (d > 1)
    for (let j = 0; j < 3; j++) {
      const a = (j * Math.PI * 2) / 3;
      beam(
        o,
        'marble',
        [x + Math.cos(a) * 0.65, y + 0.3, z + Math.sin(a) * 0.65],
        [x + Math.cos(a) * 0.6, y + 2.8, z + Math.sin(a) * 0.6],
        0.18,
        0.24,
        white,
      );
    }
}
function statue(o, d) {
  const z = -6.8,
    y = floor + 3.05;
  B(o, 'marble', 0, floor, z, 4.88, 3.05, 5.18, rgb('b9afa0'));
  B(o, 'marble', 0, y, z, 5.35, 0.48, 5.55, pale);
  if (d === 0) {
    B(o, 'marble', 0, y + 0.48, z, 4.5, 2.4, 3.7, white);
    B(o, 'marble', 0, y + 2.88, z - 0.4, 2.2, 2.4, 1.4, white);
    return;
  }
  const n = d > 2 ? 14 : 8,
    l = d > 2 ? 8 : 5,
    base = y + 0.48;
  // Chair, two arms and separated draped legs preserve the seated silhouette at the portal.
  B(o, 'marble', 0, base, z - 1.3, 4.9, 3.5, 0.55, white);
  B(o, 'marble', 0, base + 0.35, z - 0.1, 4.6, 1.8, 3.3, white);
  for (const s of [-1, 1]) {
    B(o, 'marble', s * 2.1, base, z + 0.6, 0.65, 3.15, 2.6, white);
    B(o, 'marble', s * 2.1, base + 3.15, z + 0.6, 0.85, 0.24, 2.75, pale);
    sphere(o, 'marble', [s * 1.02, base + 1.25, z + 1.5], [0.6, 1.3, 0.67], white, n, l);
    sphere(o, 'marble', [s * 0.9, base + 2.05, z + 0.85], [0.72, 0.65, 1.2], white, n, l);
    sphere(o, 'marble', [s * 1.03, base + 0.23, z + 1.95], [0.58, 0.23, 0.9], white, n, l);
    beam(
      o,
      'marble',
      [s * 0.9, base + 4.1, z - 0.4],
      [s * 1.65, base + 3.25, z + 0.3],
      0.65,
      0.7,
      white,
    );
    beam(
      o,
      'marble',
      [s * 1.65, base + 3.25, z + 0.3],
      [s * 2.03, base + 3.4, z + 1.25],
      0.5,
      0.5,
      white,
    );
    sphere(o, 'marble', [s * 2.03, base + 3.4, z + 1.34], [0.38, 0.22, 0.43], pale, n, l);
  }
  loft(
    o,
    'marble',
    [
      [base + 2.1, 1.15, 0.73],
      [base + 3.1, 1.0, 0.67],
      [base + 4.0, 1.25, 0.63],
      [base + 4.35, 0.72, 0.52],
    ].map(([yy, rx, rz]) => radialRing(yy, rx, rz, n, [0, z - 0.35])),
    white,
  );
  sphere(o, 'marble', [0, base + 4.9, z - 0.3], [0.43, 0.65, 0.46], pale, n, l);
  sphere(o, 'marble', [0, base + 5.35, z - 0.37], [0.48, 0.28, 0.46], white, n, l);
  if (d > 1) {
    sphere(o, 'marble', [0, base + 4.62, z + 0.05], [0.34, 0.25, 0.19], white, n, l);
    beam(o, 'marble', [0, base + 4.95, z + 0.1], [0, base + 4.78, z + 0.23], 0.13, 0.16, pale);
    for (const s of [-1, 1]) {
      beam(
        o,
        'marble',
        [s * 0.28, base + 4.08, z + 0.26],
        [s * 0.7, base + 3.2, z + 0.42],
        0.17,
        0.12,
        pale,
      );
      for (let j = 0; j < 4; j++)
        beam(
          o,
          'marble',
          [s * (0.75 + j * 0.13), base + 0.6, z + 2.0],
          [s * (0.65 + j * 0.15), base + 2.1, z + 1.5],
          0.05,
          0.07,
          rgb('c9c8bd'),
        );
    }
  }
}
function memorial(o, frame, d = 3) {
  // Retaining walls and shallow grassy slope around the three marble platform courses.
  for (const s of [-1, 1]) {
    B(o, 'granite', s * 39, -1.3, 0, 0.65, 5.6, 57, granite);
    if (s < 0) B(o, 'granite', 0, -1.3, s * 28.5, 78.6, 5.6, 0.65, granite);
    else for (const xx of [-26.5, 26.5]) B(o, 'granite', xx, -1.3, 28.5, 25.6, 5.6, 0.65, granite);
    B(o, 'granite', s * 39, 4.3, 0, 0.85, 0.16, 57.8, granite);
    if (s < 0) B(o, 'granite', 0, 4.3, s * 28.5, 78.6, 0.16, 0.85, granite);
    else for (const xx of [-26.5, 26.5]) B(o, 'granite', xx, 4.3, 28.5, 25.6, 0.16, 0.85, granite);
  }
  // Open stair throat through the east retaining wall is modeled by the projecting stairwork.
  for (const s of [-1, 1]) {
    quad(
      o,
      'ground',
      [
        [s * 38.6, 4.3, -28.1],
        [s * 38.6, 4.3, 28.1],
        [s * 30.7, 4.75, 20.1],
        [s * 30.7, 4.75, -20.1],
      ],
      [0, 1, 0],
      grass,
    );
    if (s < 0)
      quad(
        o,
        'ground',
        [
          [-30.7, 4.75, -20.1],
          [30.7, 4.75, -20.1],
          [38.6, 4.3, -28.1],
          [-38.6, 4.3, -28.1],
        ],
        [0, 1, 0],
        grass,
      );
    else
      for (const xx of [-1, 1])
        quad(
          o,
          'ground',
          [
            [xx * 13.9, 4.75, 20.1],
            [xx * 30.7, 4.75, 20.1],
            [xx * 38.6, 4.3, 28.1],
            [xx * 13.9, 4.3, 28.1],
          ],
          [0, 1, 0],
          grass,
        );
  }
  B(o, 'granite', 0, -1.3, 0, 61.5, 6.05, 40.25, granite);
  for (let i = 0; i < 3; i++)
    B(o, 'marble', 0, 4.75 + i * 0.65, 0, 61.5 - i * 1.4, 0.65, 40.25 - i * 1.4, white);
  stair(o, 23.6, 36.5, 0, 4.25, 25.6, d, 'granite');
  B(o, 'granite', 0, -1.3, 23.8, 26.8, 5.55, 3.9, granite);
  stair(o, 18.2, 22.7, 4.25, floor, 25.6, d, 'marble');
  for (const s of [-1, 1]) {
    B(o, 'granite', s * 13.45, -1.3, 30, 1.4, 5.55, 13, granite);
    urn(o, s * 13.45, 35.4, 4.25, d);
    if (d > 1) {
      beam(o, 'metal', [s * 12.5, 5.1, 22.6], [s * 12.5, 7.55, 18.2], 0.05, 0.05, metal);
      for (const z of [18.2, 20.4, 22.6])
        B(o, 'metal', s * 12.5, 4.25 + ((22.7 - z) * 2.45) / 4.5, z, 0.05, 0.9, 0.05, metal);
    }
  }
  // Open peristyle around the cella; front central portal stays an actual void.
  B(o, 'marble', 0, floor, -12.4, 44.0, 17.75, 1.5, white);
  for (const s of [-1, 1]) {
    B(o, 'marble', s * 21.3, floor, 0, 1.4, 17.75, 25.4, white);
    B(o, 'marble', s * 14.35, floor, 12.4, 14.1, 13.41, 1.5, white);
  }
  B(o, 'marble', 0, floor + 13.41, 12.4, 44, 4.34, 1.5, white);
  // Three chamber ceiling zones behind the central entrance.
  B(o, 'marble', 0, 24.2, 0, 44, 0.3, 26, white);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 12; i++) column(o, -cx + (i * cx * 2) / 11, s * cz, d);
    for (let i = 1; i < 7; i++) column(o, s * cx, -cz + (i * cz * 2) / 7, d);
    column(o, s * 2.5, 12.5, d, true);
  }
  // Four connected entablature beams allow light through the colonnade.
  for (const s of [-1, 1]) {
    B(o, 'marble', 0, 20.11, s * cz, 58.6, 3.35, 3.3, white);
    B(o, 'marble', s * cx, 20.11, 0, 3.3, 3.35, 32, white);
    B(o, 'marble', 0, 23.46, s * cz, 59.8, 0.42, 4.2, pale);
    B(o, 'marble', s * cx, 23.46, 0, 4.2, 0.42, 34.1, pale);
  }
  // Attic is inset from the peristyle and encloses a shallow roof with three glazed-marble fields.
  if (d === 0) {
    B(o, 'marble', 0, 23.8, 0, 45.4, 5.95, 27.2, white);
    B(o, 'marble', 0, 29.75, 0, 46, 0.35, 27.8, pale);
    B(o, 'roof', 0, 30.1, 0, 44, 0.06, 25.6, rgb('bfc1b8'));
  } else {
    for (const s of [-1, 1]) {
      B(o, 'marble', 0, 23.8, s * 13.25, 45.4, 5.95, 0.7, white);
      B(o, 'marble', s * 22.35, 23.8, 0, 0.7, 5.95, 25.8, white);
      B(o, 'marble', 0, 29.75, s * 13.25, 46, 0.35, 1.3, pale);
      B(o, 'marble', s * 22.35, 29.75, 0, 1.3, 0.35, 25.8, pale);
    }
    B(o, 'roof', 0, 29.3, 0, 44, 0.06, 25.6, dark);
    for (const x of [-14, 0, 14]) {
      B(o, 'marble', x, 29.38, 0, 11, 0.06, 22, pale);
      if (d > 1) {
        for (let z = -10; z <= 10; z += 2) B(o, 'metal', x, 29.44, z, 11, 0.06, 0.09, metal);
        for (const dx of [-5.5, 0, 5.5]) B(o, 'metal', x + dx, 29.44, 0, 0.09, 0.06, 22, metal);
      }
    }
  }
  statue(o, d);
  // Low-relief banding and discrete ashlar joints visible through the open columns.
  if (d > 1) {
    for (const s of [-1, 1]) {
      frieze(facing(o, s > 0 ? 0 : Math.PI), 55.1, 18.65, d, 13.65);
      frieze(facing(o, (s * Math.PI) / 2), 33.86, 29.2, d, 22.75);
    }
    for (let y = floor + 0.6; y < 20; y += 0.65) {
      for (const s of [-1, 1]) {
        face(o, 'marble', s * 14.35, y, 13.16, 14.05, 0.018, rgb('bebdb4'));
        face(facing(o, Math.PI), 'marble', 0, y, 13.16, 42.5, 0.018, rgb('bebdb4'));
        face(facing(o, (s * Math.PI) / 2), 'marble', 0, y, 22.02, 25.4, 0.018, rgb('bebdb4'));
      }
    }
  }
  if (d > 2) {
    for (const s of [-1, 1])
      for (let x = -27.5; x <= 27.5; x += 1.6)
        B(o, 'marble', x, 23.88, s * 18.3, 0.23, 0.28, 0.3, white);
    for (let x = -20; x <= 20; x += 1.8)
      for (const s of [-1, 1])
        face(facing(o, s > 0 ? 0 : Math.PI), 'marble', x, 26.1, 13.61, 0.7, 0.035, rgb('9d9d95'));
  }
}
export function lincolnSkyline(o) {
  memorial(o, undefined, 0);
}
export function lincolnDistrict(o) {
  memorial(o, undefined, 1);
}
export function lincolnStreet(o) {
  memorial(o, undefined, 2);
}
const surfaces = {
  marble: { ...landmarkSurfaces.stone, graph: 'stone_marble', slot: 'wall' },
  granite: { ...landmarkSurfaces.stone, graph: 'stone_granite' },
  metal: { ...landmarkSurfaces.metal },
  roof: { ...landmarkSurfaces.roof, graph: 'membrane' },
  ground: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
};
export const lincolnModel = {
  id: 'lincoln_memorial',
  recipe: 'structure-lincoln-memorial.mjs',
  key: 'lincoln_memorial',
  cell: 'dq/dqc',
  title: 'Lincoln Memorial',
  brief:
    'Marble temple with 36 fluted outer Doric columns and two entrance columns, inset attic, open central entrance and seated Lincoln silhouette, raised terrace and separate granite/marble upper stairs.',
  camera: [85, 55, 105],
  lookAt: [0, 11, 0],
  qaCameras: [
    { name: 'front', position: [0, 17, 98], lookAt: [0, 14, 0] },
    { name: 'back', position: [-75, 45, -85], lookAt: [0, 12, 0] },
  ],
  build: memorial,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Approachway [0,38] immediately east of the main granite flight; independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-lincoln-memorial.mjs',
    level: 'skyline',
    export: 'lincolnSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'lincolnDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'lincolnStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Original medium-fi temple exterior based on individually inspected local Qualla photos, mapped parts and NPS statistics/2008 plan and elevation; not a measured survey.',
    'NPS dimensions control the column count, spacing, height and major massing. Fine carvings, inscription strokes, statue likeness, optical corrections and exact roof panels are simplified; inscriptions are not claimed readable.',
    'Seated statue is an original simplified silhouette visible through the portal, not a portrait-quality replica. Side chamber murals, inscriptions, undercroft and detailed interiors are excluded.',
    'Upper terrace and main granite/marble stair flights are included. Reflecting pool, lower pool steps, distant approachway, temporary construction and surrounding gardens are excluded.',
    'Independent terrain is preserved unchanged; foundation extends beneath it. Another host DEM can change exact ground contact. No reference photo pixels are embedded.',
  ],
};
