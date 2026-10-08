/** Kroměříž palace: open courtyard, two-color roofs and stacked copper tower. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u2/u2u/n0286_kromeriz_castle/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const kromerizPalette = {
  stone: '#d4c6ae',
  trim: '#ede6d4',
  wall: '#efe3c4',
  roof: '#a5644b',
  patina: '#8ba995',
  recess: '#4d6178',
  paving: '#aaa59a',
  gold: '#c3a252',
};
const colors = Object.fromEntries(
  Object.entries(kromerizPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, col = 'wall', slot = 'plaster', target) {
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const a = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (a === 1 ? [v[0], v[2]] : a === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => [
    Math.cos(a) * x + Math.sin(a) * z,
    h,
    -Math.sin(a) * x + Math.cos(a) * z,
  ];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) =>
        o[k](
          s,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + center[0], q[1] + y, q[2] + center[1]];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function lineFrame(o, a, b, y = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    length: Math.hypot(dx, dz),
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y, -Math.atan2(dz, dx)),
  };
}
function polygon(o, loop, y, col, slot = 'limestone') {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rings(o, center, levels, n, col = 'stone', slot = 'limestone', phase = 0, cap = true) {
  const circle = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    });
  for (let j = 1; j < levels.length; j++) {
    const a = circle(levels[j - 1]),
      b = circle(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [a[i], a[k], b[k], b[i]],
        target = [(a[i][0] + a[k][0]) / 2 - center[0], 0, (a[i][2] + a[k][2]) / 2 - center[1]];
      face(o, p, col, slot, target);
    }
  }
  if (cap) {
    const r = circle(levels.at(-1));
    polygon(
      o,
      r.map((p) => [p[0], p[2]]),
      r[0][1],
      col,
      slot,
    );
  }
}
/** A real opening: pier masses, spandrels and soffits leave the arch empty. */
function arcade(
  o,
  length,
  depth,
  bottom,
  top,
  bays,
  span,
  spring,
  rise,
  d,
  col = 'stone',
  slot = 'limestone',
  pointed = false,
) {
  const pitch = length / bays,
    pier = pitch - span;
  box(o, -length / 2 + pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  box(o, length / 2 - pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  for (let i = 1; i < bays; i++)
    box(o, -length / 2 + i * pitch, bottom, 0, pier, top - bottom, depth, col, slot);
  for (let j = 0; j < bays; j++) {
    const mid = -length / 2 + (j + 0.5) * pitch,
      steps = d >= 2 ? 6 : 4;
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const half = span / 2,
        radius = (half * half + rise * rise) / (2 * half),
        offset = Math.min(t, 1 - t) * span - radius;
      return [
        mid + (t - 0.5) * span,
        spring +
          (pointed
            ? Math.sqrt(Math.max(0, radius * radius - offset * offset))
            : rise * Math.sin(Math.PI * t)),
      ];
    });
    for (let i = 0; i < steps; i++) {
      const a = curve[i],
        b = curve[i + 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            [a[0], a[1], (s * depth) / 2],
            [b[0], b[1], (s * depth) / 2],
            [b[0], top, (s * depth) / 2],
            [a[0], top, (s * depth) / 2],
          ],
          col,
          slot,
          [0, 0, s],
        );
      face(
        o,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        col,
        slot,
        [0, -1, 0],
      );
    }
  }
  face(
    o,
    [
      [-length / 2, top, -depth / 2],
      [length / 2, top, -depth / 2],
      [length / 2, top, depth / 2],
      [-length / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function pane(o, x, y, z, w, h, d, pointed = false) {
  const p = pointed
    ? [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h * 0.65, z],
        [x, y + h, z],
        [x - w / 2, y + h * 0.65, z],
      ]
    : [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ];
  face(o, p, 'recess', 'glass', [0, 0, z < 0 ? -1 : 1]);
  if (d >= 3) {
    box(o, x, y - 0.3, z, w + 0.6, 0.3, 0.3, 'trim');
    if (!pointed) box(o, x, y + h, z, w + 0.6, 0.3, 0.3, 'trim');
    box(o, x, y, z, 0.3, h, 0.3, 'trim');
  }
}

const outer = frame.geometry.outline.slice(0, -1);
const court = frame.geometry.holes[0].slice(0, -1);
function winding(loop) {
  return Math.sign(
    loop.reduce((s, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
}
/** Real mapped wall rings; inner normals face the courtyard. */
function walls(o, loop, inner, d) {
  const sign = winding(loop) * (inner ? -1 : 1);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const n = [(sign * dz) / len, 0, (-sign * dx) / len];
    for (const [lo, hi, col, slot] of [
      [0, 3.1, 'stone', 'limestone'],
      [3.1, c.bodyHeight, 'wall', 'plaster'],
    ])
      face(
        o,
        [
          [...a.slice(0, 1), lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        col,
        slot,
        n,
      );
    if (d < 1 || len < 3.8) continue;
    const { q, length } = lineFrame(o, a, b);
    // Native local -Z points right of an edge. Reversing a ring changes this sign.
    const z = -sign * 0.055;
    const count = Math.max(1, Math.floor(length / c.windowPitch));
    const floors = d === 1 ? [10.2, 24.2] : c.windowFloors;
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * length) / count - length / 2;
      // Do not place lower windows behind the garden portico.
      for (const y of floors) {
        if (!inner && a[1] > 38 && b[1] > 38 && y < 7 && Math.abs(x) < 15) continue;
        pane(q, x, y, z, 1.7, y < 7 ? 2.7 : 3.7, 0);
        if (d >= 3) {
          box(q, x, y - 0.25, z, 2.25, 0.35, 0.42, 'trim', 'limestone');
          box(q, x, y + 3.7, z, 2.3, 0.35, 0.42, 'trim', 'limestone');
          // Broad lintels/sills only: thin cell frames/mullions are omitted.
        }
      }
      if (d >= 2 && j < count - 1)
        box(q, x + length / count / 2, 7.6, z, 0.55, 23.1, 0.35, 'trim', 'plaster');
    }
    for (const y of d >= 2 ? [7.3, 30.8] : [30.8])
      box(q, 0, y, z, length, 0.55, 0.45, 'trim', 'plaster');
  }
}
/** Annular roof with red lower pitches and broad green upper panels; court stays empty. */
function roofs(o, d) {
  const a = c.roofOuter,
    b = c.roofInner;
  const blend = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const ro = a.map((p, i) => blend(p, b[i], 0.32)),
    ri = b.map((p, i) => blend(p, a[i], 0.32));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      at = (p, y) => [p[0], y, p[1]];
    face(o, [at(a[i], 32), at(a[j], 32), at(ro[j], 40), at(ro[i], 40)], 'roof', 'tile', [0, 1, 0]);
    face(o, [at(b[i], 32), at(b[j], 32), at(ri[j], 40), at(ri[i], 40)], 'roof', 'tile', [0, 1, 0]);
    face(
      o,
      [at(ro[i], 40), at(ro[j], 40), at(ri[j], 40), at(ri[i], 40)],
      'patina',
      'patina',
      [0, 1, 0],
    );
    if (d >= 2) {
      const { q, length } = lineFrame(o, ro[i], ro[j]);
      for (let k = 1; k <= 4; k++)
        box(q, (k / 5 - 0.5) * length, 40, 0, 1.3, 2.1, 1.15, 'trim', 'limestone');
    }
  }
  // Corner risalits project beyond the simple four roof-control corners.
  for (const r of [
    { x: -45, z: 35, w: 13, h: 18 },
    { x: 43, z: 35, w: 17, h: 21 },
  ]) {
    const p = [
      [r.x - r.w / 2, 32, r.z - r.h / 2],
      [r.x + r.w / 2, 32, r.z - r.h / 2],
      [r.x + r.w / 2, 32, r.z + r.h / 2],
      [r.x - r.w / 2, 32, r.z + r.h / 2],
    ];
    const top = [r.x, 39.5, r.z];
    for (let i = 0; i < 4; i++) face(o, [p[i], p[(i + 1) % 4], top], 'roof', 'tile', [0, 1, 0]);
  }
}
function portico(o, d) {
  const p = c.gardenPortico,
    q = local(o, p.center);
  arcade(q, p.width, p.depth, 0, p.top, p.bays, 5.5, 3.6, 1.8, d, 'stone', 'limestone');
  box(q, 0, p.top, 0, p.width + 1, 0.75, p.depth + 0.5, 'trim', 'limestone');
  // Chunky parapet replaces sub-pixel balusters.
  for (const s of [-1, 1])
    box(q, 0, p.top + 0.75, s * (p.depth / 2), p.width + 1, 0.85, 0.42, 'patina', 'patina');
}
function clock(o, y, z, d) {
  if (d < 1) return;
  const steps = d >= 2 ? 16 : 8,
    r = 1.65;
  const loop = Array.from({ length: steps }, (_, i) => [
    Math.cos((i * Math.PI * 2) / steps) * r,
    y + Math.sin((i * Math.PI * 2) / steps) * r,
    z,
  ]);
  face(o, loop, 'trim', 'limestone', [0, 0, z < 0 ? -1 : 1]);
  if (d >= 2) {
    // Eight broad radial marks stay resolvable; fine hands/numerals are not geometry.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        b = a + 0.11;
      face(
        o,
        [
          [Math.cos(a) * 1.45, y + Math.sin(a) * 1.45, z * 1.001],
          [Math.cos(b) * 1.45, y + Math.sin(b) * 1.45, z * 1.001],
          [Math.cos(b) * 1.1, y + Math.sin(b) * 1.1, z * 1.001],
          [Math.cos(a) * 1.1, y + Math.sin(a) * 1.1, z * 1.001],
        ],
        'recess',
        'glass',
        [0, 0, z < 0 ? -1 : 1],
      );
    }
  }
}
function tower(o, d) {
  const t = c.tower,
    q = local(o, t.center),
    n = [8, 8, 12, 16][d];
  box(q, 0, 0, 0, t.width, 40, t.depth, 'wall', 'plaster');
  box(q, 0, 39.4, 0, t.width + 2, 1.2, t.depth + 2, 'trim', 'limestone');
  // Octagonal upper clock stage; real 40m gallery datum is preserved in every level.
  rings(
    q,
    [0, 0],
    [
      [40.6, 5.3],
      [51, 5.3],
    ],
    8,
    'wall',
    'plaster',
    Math.PI / 8,
  );
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const v = local(q, [0, 0], 0, a);
    clock(v, 47.4, -4.91, d);
    if (d >= 2) {
      pane(v, 0, 41.5, -4.91, 1.55, 3.4, 0, true);
      for (const x of [-3.1, 3.1]) box(v, x, 41, -4.86, 0.5, 9.6, 0.35, 'trim', 'plaster');
      for (const y of [12, 21, 29]) pane(v, 0, y, -t.depth / 2 - 0.06, 1.4, 3.5, 0);
    }
  }
  const ringCount = d >= 2 ? n : 8;
  rings(
    q,
    [0, 0],
    [
      [51, 5.9],
      [53, 4.6],
      [54, 3.7],
      [55.4, 5.3],
      [58.6, 5.6],
      [60.6, 4.1],
      [61.2, 3.9],
    ],
    ringCount,
    'patina',
    'patina',
  );
  // Lantern is actually open: radial supports connect two ring lips.
  rings(
    q,
    [0, 0],
    [
      [61.2, 3.9],
      [62.2, 3.5],
    ],
    ringCount,
    'patina',
    'patina',
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      v = local(q, [0, 0], 0, -a);
    box(v, 3, 62.2, 0, 0.7, 6.4, 0.7, 'patina', 'patina');
  }
  rings(
    q,
    [0, 0],
    [
      [68.6, 3.1],
      [69.8, 3.7],
      [70.6, 2.8],
      [73, 3.2],
      [75, 2.5],
      [77, 0.75],
      [78, 1.5],
      [79.5, 1.65],
      [81, 0.45],
    ],
    ringCount,
    'patina',
    'patina',
  );
  rings(
    q,
    [0, 0],
    [
      [81, 0.45],
      [82.2, 0.65],
      [84, 0.025],
    ],
    d >= 2 ? 8 : 6,
    'gold',
    'patina',
  );
}
function build(o, d) {
  polygon(o, court, 0.03, 'paving', 'foliage');
  walls(o, outer, false, d);
  walls(o, court, true, d);
  roofs(o, d);
  portico(o, d);
  tower(o, d);
}
export const buildKromerizRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildKromerizSkyline = (o) =>
  build(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, col) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            col.map((v) => v * (s === 'foliage' || s === 'glass' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const kromerizStudy = {
  id: 'N0286',
  key: 'kromeriz_castle',
  title: 'Kroměříž Castle',
  category: 'castle',
  wikidataId: 'Q200693',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKromerizRuntime(o),
  brief:
    'Quadrangular Baroque palace with a real mapped open courtyard,cream pilastered facades,red lower roof pitches with broad green upper panels,garden arcade and84m stacked copper tower with an open lantern.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: kromerizPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    identityFeatures: [
      'Open quadrangular palace courtyard and projecting garden corner masses',
      'Red roof pitches with broad green copper upper panels',
      'Tall stacked copper bulb tower with open lantern and40m viewing-gallery datum',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/33992 exactQ200693',
    mappedEnvelopeMeters: [103.556, 93.322],
    mappedLevels: 4,
    towerHeightMeters: 84,
    viewingGalleryMeters: 40,
    palaceEaveEstimateMeters: 32,
    roofTopEstimateMeters: 40,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cached exact mapped outer/courtyard rings,documented tower and gallery heights;remaining controls are original photo-based estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. OSM rings © OpenStreetMap contributors,ODbL-1.0. Operator photos stay external private references;no image or third-party diagram redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors;Archbishop’s Chateau Kroměříž primary factual/photo references.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;review pending',
    notes:
      'Undirected cached map axis. Signed garden-facing orientation,tower/roof fit and terrain/base datum pending.',
  }),
  geographicNote:
    'Current original approximate exterior on cached mapped rings;inactive until real-site review.',
  limitations: refs.limitations,
  importReason:
    'Retain open court,red/green roof identity and stacked open-lantern tower across compact authored LODs.',
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.catalog.bohemian_townhouse' },
  camera: { position: [145, 110, -170], lookAt: [0, 30, 0], fov: 43 },
  qaCameras: [
    { name: 'garden-portico-and-tower', position: [85, 64, 133], lookAt: [0, 28, 0] },
    { name: 'clock-and-open-copper-lantern', position: [48, 67, -57], lookAt: [5.7, 61, -8.7] },
    { name: 'courtyard-and-upper-roof-panels', position: [61, 135, 76], lookAt: [0, 31, 4] },
    { name: 'courtyard-window-rhythm', position: [5, 22, 14], lookAt: [-25, 19, 6] },
    { name: 'town-facade-and-tower', position: [-60, 58, -122], lookAt: [0, 28, -10] },
    { name: 'garden-corner-projections', position: [-122, 63, 78], lookAt: [0, 29, 10] },
  ],
};
