/** Miramare: ivory angled wings, recessed stair hall and southwest square clock tower. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u2/u21/n0276_miramare_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
export const miramarePalette = {
  stone: '#e0d9c8',
  trim: '#eee7d8',
  roof: '#66717a',
  glass: '#4d6178',
};
const colors = Object.fromEntries(
  Object.entries(miramarePalette).map(([k, hex]) => [
    k,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
function local(o, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function face(o, points, col = 'stone', slot = 'limestone', target) {
  let p = points;
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (axis === 1 ? [v[0], v[2]] : axis === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function cap(o, loop, y, col = 'roof', slot = 'slate') {
  const ids = earcut(loop.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [loop[j][0], y, loop[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function shell(o, loop, lo, hi) {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    face(
      o,
      [
        [...a.slice(0, 1), lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      'stone',
      'limestone',
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, loop, hi);
}
function edge(o, a, b) {
  return {
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], a[0] - b[0])),
  };
}
function roundPane(o, x, y, z, w, h, d, trim = true) {
  const n = d >= 2 ? 8 : 4,
    spring = h - w / 2;
  const loop = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    loop.push([x + (w / 2) * Math.cos(a), y + spring + (w / 2) * Math.sin(a), z]);
  }
  face(o, loop, 'glass', 'glass', [0, 0, 1]);
  if (d < 3 || !trim) return;
  // Selected planar surrounds; no hidden closed frame geometry on every opening.
  for (const s of [-1, 1])
    face(
      o,
      [
        [x + (s * w) / 2, y, z + 0.11],
        [x + s * (w / 2 + 0.19), y, z + 0.11],
        [x + s * (w / 2 + 0.19), y + spring, z + 0.11],
        [x + (s * w) / 2, y + spring, z + 0.11],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      [
        [x + (w / 2) * Math.cos(a), y + spring + (w / 2) * Math.sin(a), z + 0.11],
        [x + (w / 2 + 0.19) * Math.cos(a), y + spring + (w / 2 + 0.19) * Math.sin(a), z + 0.11],
        [x + (w / 2 + 0.19) * Math.cos(b), y + spring + (w / 2 + 0.19) * Math.sin(b), z + 0.11],
        [x + (w / 2) * Math.cos(b), y + spring + (w / 2) * Math.sin(b), z + 0.11],
      ],
      'trim',
      'limestone',
      [0, 0, 1],
    );
  }
}
function panes(o, x, y, z, count, height, d, trim) {
  const w = count === 3 ? 0.63 : 0.92,
    gap = 0.34;
  for (let i = 0; i < count; i++)
    roundPane(o, x + (i - (count - 1) / 2) * (w + gap), y, z, w, height, d, trim);
}
function crenellate(o, length, y, d) {
  const block = (x, bottom, width, h) => {
    if (d !== 0) return rect(o, x, bottom, 0, width, h, 0.55, 'trim');
    // Skyline parapets retain their outline and top without subpixel end/underside faces.
    for (const s of [-1, 1])
      face(
        o,
        [
          [x - width / 2, bottom, s * 0.275],
          [x + width / 2, bottom, s * 0.275],
          [x + width / 2, bottom + h, s * 0.275],
          [x - width / 2, bottom + h, s * 0.275],
        ],
        'trim',
        'limestone',
        [0, 0, s],
      );
    face(
      o,
      [
        [x - width / 2, bottom + h, -0.275],
        [x + width / 2, bottom + h, -0.275],
        [x + width / 2, bottom + h, 0.275],
        [x - width / 2, bottom + h, 0.275],
      ],
      'trim',
      'limestone',
      [0, 1, 0],
    );
  };
  block(0, y, length, 0.48);
  const n = Math.max(1, Math.round(length / (d === 0 ? 6 : d === 1 ? 2.6 : 1.5)));
  for (let i = 0; i < n; i++)
    block(
      ((i + 0.5) * length) / n - length / 2,
      y + 0.48,
      Math.min(0.72, (length / n) * 0.5),
      0.62,
    );
}
function turret(o, x, z, base, top, d) {
  const q = local(o, x, z),
    n = d === 0 ? 4 : d === 1 ? 8 : 12;
  const rings =
    d === 0
      ? [
          [base, 0.52],
          [top, 0.7],
        ]
      : [
          [base, 0.36],
          [base + 0.4, 0.84],
          [base + 0.65, 0.65],
          [top - 0.6, 0.65],
          [top, 0.86],
        ];
  const loop = (r) =>
    Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      r * Math.sin((i * 2 * Math.PI) / n),
    ]);
  for (let j = 1; j < rings.length; j++) {
    const [lo, r0] = rings[j - 1],
      [hi, r1] = rings[j],
      a = loop(r0),
      b = loop(r1);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        q,
        [
          [a[i][0], lo, a[i][1]],
          [a[k][0], lo, a[k][1]],
          [b[k][0], hi, b[k][1]],
          [b[i][0], hi, b[i][1]],
        ],
        'trim',
        'limestone',
        [a[i][0] + a[k][0], 0, a[i][1] + a[k][1]],
      );
    }
  }
  cap(q, loop(rings.at(-1)[1]), top, 'trim', 'limestone');
  if (d >= 2) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      rect(
        local(q, 0.67 * Math.sin(a), 0.67 * Math.cos(a), a),
        0,
        top - 0.35,
        0,
        0.45,
        0.35,
        0.4,
        'trim',
      );
    }
  }
}
const outline = frame.geometry.outline.slice(0, -1);
const west = [...outline.slice(13, 39), [0, -5.773], [0, 12.6]];
const east = [...outline.slice(0, 13), [8, -1], [8, -10.5]];
function wing(o, loop, height, d) {
  shell(o, loop, 16.4, height);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    const { q, length } = edge(o, a, b);
    if (length < 3) continue;
    if ((a[0] + b[0]) / 2 < -22 && (a[1] + b[1]) / 2 > 7) continue;
    crenellate(q, length, height, d);
    if (d >= 2) {
      rect(q, 0, height - 0.7, 0.08, length, 0.28, 0.5, 'trim');
      rect(q, 0, 6.1, 0.04, length, 0.26, 0.4, 'trim');
      rect(q, 0, 12.2, 0.04, length, 0.26, 0.4, 'trim');
    }
  }
}
function windows(o, d) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const { q, length } = edge(o, a, b);
    if (length < 4) continue;
    if (i === 41) continue; // The recessed stair facade has its own tall glazed openings.
    const cx = (a[0] + b[0]) / 2,
      cz = (a[1] + b[1]) / 2;
    // The clock tower covers the southwest projection; avoid painting windows through it.
    if (cx < -22 && cz > 7) continue;
    const n = Math.max(1, Math.floor(length / 5.8));
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) * length) / n - length / 2,
        near = j === Math.floor(n / 2);
      for (const [y, count, h] of [
        [1.6, 2, 3.5],
        [7.6, 2, 3.5],
        [13.8, d === 1 ? 2 : 3, 2.65],
      ])
        panes(q, x, y, 0.065, count, h, d, near);
    }
  }
}
function clock(o, y, z, d) {
  const n = d >= 2 ? 16 : 8,
    r = 1.02,
    ring = 1.24;
  const loop = Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * 2 * Math.PI) / n),
    y + r * Math.sin((i * 2 * Math.PI) / n),
    z,
  ]);
  face(o, loop, 'glass', 'glass', [0, 0, 1]);
  if (d >= 1)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        o,
        [
          [r * Math.cos(a), y + r * Math.sin(a), z + 0.09],
          [ring * Math.cos(a), y + ring * Math.sin(a), z + 0.09],
          [ring * Math.cos(b), y + ring * Math.sin(b), z + 0.09],
          [r * Math.cos(b), y + r * Math.sin(b), z + 0.09],
        ],
        'trim',
        'limestone',
        [0, 0, 1],
      );
    }
  if (d >= 2) {
    rect(o, 0, y, z + 0.1, 0.18, 0.74, 0.12, 'trim');
    rect(o, 0.27, y - 0.09, z + 0.1, 0.64, 0.18, 0.12, 'trim');
  }
}
function tower(o, d) {
  const c = frame.controls.clockTower,
    q = local(o, ...c.center, 0.138),
    w = c.plan[0];
  rect(q, 0, 0, 0, w, c.wallTop, w);
  cap(
    q,
    [
      [-w / 2, -w / 2],
      [w / 2, -w / 2],
      [w / 2, w / 2],
      [-w / 2, w / 2],
    ],
    c.wallTop,
  );
  for (let i = 0; i < 4; i++) {
    const f = local(q, 0, 0, (i * Math.PI) / 2);
    crenellate(local(f, 0, w / 2), w, c.wallTop, d);
    if (d >= 1) {
      clock(f, 21.5, w / 2 + 0.05, d);
      panes(f, 0, 3, w / 2 + 0.05, 2, 3.3, d, true);
      roundPane(f, 0, 11, w / 2 + 0.05, 0.8, 1.55, d);
    }
    if (d >= 2) rect(f, 0, 24.5, w / 2 + 0.09, w, 0.3, 0.5, 'trim');
  }
  for (const x of [-w / 2, w / 2])
    for (const z of [-w / 2, w / 2]) turret(q, x, z, 24, c.turretTop, d);
}
function entrance(o, d) {
  // Recessed landward stair connection: a tall glazed pair and open-looking dark entrance.
  const { q } = edge(o, outline[41], outline[42]);
  if (d >= 1) {
    panes(q, 0, 7, 0.05, 2, 7.3, d, true);
    panes(q, 0, 0.7, 0.07, 2, 4.2, d, true);
  }
  if (d >= 2) {
    rect(q, 0, 6.2, 0.13, 5.2, 0.4, 1.7, 'trim');
    for (const s of [-1, 1]) rect(q, s * 2.05, 0, 0.35, 0.42, 6.2, 0.55, 'trim');
  }
}
function shallowRoof(o, x, z, angle, width, depth, y) {
  const q = local(o, x, z, angle);
  // Pitched fields remain below the crenellated parapet, as described by the museum.
  for (const s of [-1, 1]) {
    face(
      q,
      [
        [-width / 2, y, (s * depth) / 2],
        [width / 2, y, (s * depth) / 2],
        [width / 2, y + 0.65, 0],
        [-width / 2, y + 0.65, 0],
      ],
      'roof',
      'slate',
      [0, 1, s],
    );
    face(
      q,
      [
        [(s * width) / 2, y, -depth / 2],
        [(s * width) / 2, y, depth / 2],
        [(s * width) / 2, y + 0.65, 0],
      ],
      'roof',
      'slate',
      [s, 0, 0],
    );
  }
}
function landwardPavilion(o, d) {
  const q = local(o, -15.65, -14.08, -3.004),
    width = 4.8;
  rect(q, 0, 0, 0, width, 22, 1.7);
  crenellate(local(q, 0, 0.86), width, 22, d);
  for (const s of [-1, 1]) {
    crenellate(local(q, (s * width) / 2, 0, (s * Math.PI) / 2), 1.7, 22, d);
    turret(q, (s * width) / 2, 0.85, 20.8, 24, d);
  }
  if (d >= 1) {
    panes(q, 0, 1.6, 0.9, 2, 3.5, d, true);
    panes(q, 0, 7.6, 0.9, 2, 5.2, d, true);
    panes(q, 0, 14.2, 0.9, 2, 4.4, d, true);
  }
  if (d >= 2) {
    rect(q, 0, 6.5, 1.05, 5.2, 0.3, 0.6, 'trim');
    rect(q, 0, 13.3, 1.05, 5.2, 0.3, 0.6, 'trim');
  }
}
function castle(o, d) {
  shell(o, outline, 0, 16.4);
  wing(o, west, 20.4, d);
  wing(o, east, 18.2, d);
  shallowRoof(o, -13, 1, -0.138, 20, 15, 20.4);
  shallowRoof(o, 19, -4, -0.499, 16.5, 12, 18.2);
  for (const [a, b] of [
    [
      [0, -5.773],
      [0.288, -7.017],
    ],
    [
      [0.288, -7.017],
      [6.571, -9.959],
    ],
    [
      [7.865, 3.655],
      [10.418, 2.396],
    ],
  ]) {
    const { q, length } = edge(o, a, b);
    crenellate(q, length, 16.4, d);
  }
  const corners = [
    [-26.028, -15.552, 19.2, 23.4],
    [-6.929, -12.276, 19.2, 23.4],
    [-1.809, 16.099, 19.2, 23.4],
    [5.975, 16.787, 19.2, 23.4],
    [11.487, -16.787, 17, 21.2],
    [30.24, -6.567, 17, 21.2],
    [20.623, 9.228, 17, 21.2],
    [10.418, 2.396, 17, 21.2],
  ];
  for (const c of corners) turret(o, ...c, d);
  tower(o, d);
  landwardPavilion(o, d);
  if (d >= 1) {
    windows(o, d);
    entrance(o, d);
  }
  if (d >= 2) {
    // Selected projecting sea-side window bay, not repeated balconies or tiny balustrades.
    const q = local(o, -10.6, 13.7, 0.138);
    rect(q, 0, 6.45, 0, 5.1, 5.3, 2.2, 'trim');
    for (const s of [-1, 1])
      panes(local(q, 0, 0, s < 0 ? Math.PI / 2 : -Math.PI / 2), 0, 7, 2.58, 1, 3.65, d, true);
    panes(q, 0, 7, 1.16, 3, 3.65, d, true);
    crenellate(local(q, 0, 1.1), 5.1, 11.75, d);
  }
}
export const buildMiramareRuntime = (o, level = 'closeup') =>
  castle(o, { district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildMiramareSkyline = (o) =>
  castle(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v) => v * (s === 'glass' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const miramareStudy = {
  id: 'N0276',
  key: 'miramare_castle',
  title: 'Miramare Castle',
  category: 'castle',
  wikidataId: 'Q165069',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildMiramareRuntime(o),
  brief:
    'Ivory Istrian stone Miramare Castle: angled eastern and taller western crenellated wings, recessed stair hall, paired/triple round-headed windows, projecting sea-side bay and square southwest clock tower with four corner turrets.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: miramarePalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 3,
    identityFeatures: [
      'Two ivory angled crenellated wings joined by a recessed stair hall',
      'Square sea-side clock tower with four corner turrets',
      'Mixed paired/triple round-headed windows and projecting sea-side window bay',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/361092895 exact Q165069',
    mappedBuildingPlanMeters: [60.48, 33.574],
    publishedTowerHeightAboveSeaMeters: 35,
    towerStoreys: 7,
    towerInternalFloorAreaApproxSquareMeters: 25,
    clockFaces: 4,
  },
  reconstruction: {
    basis:
      'Exact mapped building outline and current government museum exterior gallery; elevations inferred',
    scope:
      'Castle exterior only, excludes park, Castelletto, cliff, terrace retaining walls and interior',
  },
  scaleBasis:
    'Mapped60.48×33.574m footprint fixes plan. Tower29m above provisional terraceY0 is inferred using the published35m above sea and visually interpreted approximate6m sea-to-terrace offset; no surveyed datum conversion is claimed. All facade elevations and details are approximate.',
  refs: JSON.parse(
    readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
  ).references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Museum photographs linked as research only, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Italian Ministry of Culture / Miramare Museum primary photographs and architectural notes used as research only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Mapped building footprint; southwest clock tower resolves axis sign. TerraceY0 and sea datum separation inferred, real terrain seating pending.',
    reviewStatus: 'Research frame only; terrain/approaches pending',
  }),
  geographicNote:
    'Exact footprint and exterior views establish orientation; terrain and terrace contact require geographic review before activation. Synthetic captures establish appearance only.',
  limitations: JSON.parse(readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)))
    .limitations,
  importReason:
    'Preserve angled ivory wings, square clock tower, broad crenellations and round-headed window rhythm at all levels.',
  mediumFiContext: { scale: '0.7', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-72, 48, 83], lookAt: [0, 10, 0], fov: 43 },
  qaCameras: [
    { name: 'southwest-clock-tower', position: [-53, 30, 47], lookAt: [-22, 17, 8] },
    { name: 'landward-two-wings', position: [34, 29, -65], lookAt: [0, 10, -3] },
    { name: 'recessed-stair-entrance', position: [13, 20, -34], lookAt: [3, 9, -7] },
    { name: 'sea-side-window-bay', position: [-12, 18, 46], lookAt: [-11, 10, 12] },
    { name: 'angled-east-wing', position: [53, 28, 23], lookAt: [17, 10, -1] },
    { name: 'mapped-building-plan', position: [0, 107, 1], lookAt: [0, 0, 0] },
  ],
};
