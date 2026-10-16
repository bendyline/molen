/** Swallow's Nest: the small limestone folly, without the much taller natural cliff. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sz/szb/n0271_swallow_s_nest/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const swallowsNestPalette = {
  stone: '#d4d5ce',
  trim: '#e4e3d9',
  paving: '#b9b2a3',
  roof: '#a3a19b',
  rail: '#596267',
  glass: '#4d6178',
  wood: '#8c735b',
};
const colors = Object.fromEntries(
  Object.entries(swallowsNestPalette).map(([key, hex]) => [
    key,
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
function local(o, x, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
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
function face(o, p, col = 'stone', slot = 'limestone', up = false) {
  if (up && normalFor(...p.slice(0, 3))[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
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
function slab(o, points, base, h) {
  const ids = earcut(points.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [points[j][0], base + h, points[j][1]]);
    face(o, p, 'paving', 'concrete', true);
    if (h) face(o, p.map((v) => [v[0], base, v[2]]).reverse(), 'paving', 'concrete');
  }
  if (h)
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      face(
        o,
        [
          [a[0], base, a[1]],
          [a[0], base + h, a[1]],
          [b[0], base + h, b[1]],
          [b[0], base, b[1]],
        ],
        'paving',
        'concrete',
      );
    }
}
// A hard-normal, outward-wound frustum. A zero upper radius emits triangles, never degenerate quads.
function drum(o, x, z, r, rt, base, top, n, col = 'stone', slot = 'limestone') {
  const at = (i, y, rr) => [
    x + rr * Math.cos((2 * Math.PI * i) / n),
    y,
    z + rr * Math.sin((2 * Math.PI * i) / n),
  ];
  for (let i = 0; i < n; i++) {
    face(
      o,
      rt
        ? [at(i, base, r), at(i, top, rt), at(i + 1, top, rt), at(i + 1, base, r)]
        : [at(i, base, r), [x, top, z], at(i + 1, base, r)],
      col,
      slot,
    );
    if (rt) face(o, [[x, top, z], at(i + 1, top, rt), at(i, top, rt)], col, slot, true);
  }
}
function ring(o, x, z, r, inner, base, top, n, col = 'trim', slot = 'limestone') {
  const at = (i, y, rr) => [
    x + rr * Math.cos((2 * Math.PI * i) / n),
    y,
    z + rr * Math.sin((2 * Math.PI * i) / n),
  ];
  for (let i = 0; i < n; i++) {
    face(o, [at(i, base, r), at(i, top, r), at(i + 1, top, r), at(i + 1, base, r)], col, slot);
    face(
      o,
      [at(i + 1, base, inner), at(i + 1, top, inner), at(i, top, inner), at(i, base, inner)],
      col,
      slot,
    );
    face(
      o,
      [at(i, top, r), at(i, top, inner), at(i + 1, top, inner), at(i + 1, top, r)],
      col,
      slot,
      true,
    );
    face(
      o,
      [at(i, base, r), at(i + 1, base, r), at(i + 1, base, inner), at(i, base, inner)],
      col,
      slot,
    );
  }
}
function beam(o, a, b, y, h, w, col = 'trim', slot = 'limestone') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  rect(
    local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
    0,
    y,
    0,
    len,
    h,
    w,
    col,
    slot,
  );
}
function parapet(o, x, z, w, depth, y, d) {
  for (const s of [-1, 1]) {
    rect(o, x, y, z + (s * depth) / 2, w + 0.28, 0.32, 0.24, 'trim');
    rect(o, x + (s * w) / 2, y, z, 0.24, 0.32, depth, 'trim');
  }
  if (d)
    for (const [len, px, pz, a] of [
      [w, x, z + depth / 2, 0],
      [w, x, z - depth / 2, 0],
      [depth, x + w / 2, z, Math.PI / 2],
      [depth, x - w / 2, z, Math.PI / 2],
    ]) {
      const q = local(o, px, pz, a),
        count = Math.max(2, Math.round(len / 1.05));
      for (let i = 0; i <= count; i++)
        rect(q, -len / 2 + (len * i) / count, y + 0.32, 0, 0.5, 0.48, 0.34, 'trim');
    }
}
function pinnacle(o, x, z, base, tip, r, d) {
  const n = d >= 2 ? 8 : 6,
    coneBase = tip - 1.5;
  drum(o, x, z, r * 0.72, r * 0.72, base, coneBase, n);
  if (d) drum(o, x, z, r, r, coneBase - 0.12, coneBase, n, 'trim');
  drum(o, x, z, r, 0, coneBase, tip - (d >= 2 ? 0.3 : 0), n, 'trim');
  if (d >= 2) {
    rect(o, x, tip - 0.35, z, 0.07, 0.35, 0.07, 'rail', 'metal');
    rect(o, x + 0.19, tip - 0.2, z, 0.35, 0.16, 0.07, 'rail', 'metal');
  }
}
// Pointed blue-grey panes are bordered by geometry; no painted shadows or AO.
function pointed(o, x, z, sill, width, height, d, col = 'glass', slot = 'glass') {
  const spring = sill + height - width * 0.55,
    n = d >= 2 ? 6 : 2;
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const u = -1 + (2 * i) / n;
    return [x + (u * width) / 2, spring + Math.sqrt(1 - Math.abs(u)) * width * 0.55];
  });
  const outline = [[x - width / 2, sill], ...profile, [x + width / 2, sill]];
  face(o, outline.map(([u, y]) => [u, y, z]).reverse(), col, slot);
  if (d >= 2) {
    for (const s of [-1, 1])
      rect(o, x + s * (width / 2 + 0.055), sill, z + 0.025, 0.11, spring - sill, 0.12, 'trim');
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1],
        b = profile[i];
      face(
        o,
        [
          [a[0], a[1], z + 0.085],
          [b[0], b[1], z + 0.085],
          [b[0], b[1] + 0.12, z + 0.085],
          [a[0], a[1] + 0.12, z + 0.085],
        ],
        'trim',
      );
    }
    rect(o, x, sill - 0.1, z + 0.03, width + 0.22, 0.1, 0.17, 'trim');
    if (width > 1.15) rect(o, x, sill, z + 0.05, 0.085, spring - sill, 0.1, 'rail', 'metal');
  }
}
function blindArcade(o, len, z, y, d) {
  if (d < 2) return;
  const count = Math.round(len / 0.48);
  for (let i = 0; i < count; i++) {
    const x = -len / 2 + ((i + 0.5) * len) / count,
      w = len / count - 0.13;
    // Small relief arches stay the wall's color; natural light supplies the recess.
    const outline = [
      [x - w / 2, y],
      [x - w / 2, y + 0.32],
      [x, y + 0.49],
      [x + w / 2, y + 0.32],
      [x + w / 2, y],
    ];
    for (let j = 1; j < outline.length; j++) {
      const a = outline[j - 1],
        b = outline[j];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy),
        nx = (-dy / l) * 0.065,
        ny = (dx / l) * 0.065;
      face(
        o,
        [
          [a[0], a[1], z + 0.08],
          [b[0], b[1], z + 0.08],
          [b[0] + nx, b[1] + ny, z + 0.08],
          [a[0] + nx, a[1] + ny, z + 0.08],
        ],
        'trim',
      );
    }
  }
}
function terrace(o, d) {
  const [cx, cz] = frame.controls.towerCenter,
    n = [6, 8, 12, 16][d];
  const p = [
    [-11.4, -3.3],
    [-5.6, -4.3],
    [2.5, -4.25],
    [cx, cz - 4.25],
  ];
  for (let i = 1; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    p.push([cx + 4.25 * Math.cos(a), cz + 4.25 * Math.sin(a)]);
  }
  p.push([2, 4.5], [-5.6, 4.5], [-11.4, 3.2]);
  slab(o, p, 0, 0.4);
  if (!d) return;
  // Leave the western approach open; perimeter rail is part of the building's small terrace.
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    beam(o, a, b, 0.4, d === 1 ? 0.68 : 0.15, 0.22, 'paving', 'concrete');
    beam(o, a, b, 1.16, 0.12, 0.23);
    rect(o, a[0], 0.4, a[1], 0.34, 0.98, 0.34, 'trim');
    if (d >= 2) {
      const count = Math.ceil(len / 0.55);
      for (let j = 1; j < count; j++) {
        const x = a[0] + ((b[0] - a[0]) * j) / count,
          z = a[1] + ((b[1] - a[1]) * j) / count;
        drum(o, x, z, 0.085, 0.12, 0.55, 0.85, 6, 'trim');
        drum(o, x, z, 0.12, 0.075, 0.85, 1.16, 6, 'trim');
      }
    }
  }
}
function roundTower(o, d) {
  const [x, z] = frame.controls.towerCenter,
    r = frame.controls.towerRadius,
    n = [8, 12, 16, 24][d];
  drum(o, x, z, r, r, 0.4, 4.25, n);
  drum(o, x, z, r + 0.35, r + 0.65, 3.9, 4.3, n, 'trim');
  drum(o, x, z, r + 0.65, r + 0.65, 4.3, 4.47, n, 'trim');
  drum(o, x, z, r * 0.9, r * 0.9, 4.47, 8.75, n);
  drum(o, x, z, r * 0.9, r + 0.04, 8.5, 8.95, n, 'trim');
  drum(o, x, z, r + 0.04, r + 0.04, 8.95, 9.52, n);
  drum(o, x, z, r - 0.25, r - 0.25, 9.52, 9.58, n, 'roof', 'concrete');
  ring(o, x, z, r + 0.12, r - 0.22, 9.5, 9.85, n);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2,
      rr = r * 0.92;
    pinnacle(o, x + rr * Math.cos(a), z + rr * Math.sin(a), 8.65, 12, 0.38, d);
  }
  if (!d) return;
  for (let i = 0; i < 12; i++) {
    const a = (2 * Math.PI * i) / 12;
    rect(
      local(o, x + (r - 0.04) * Math.cos(a), z + (r - 0.04) * Math.sin(a), Math.PI / 2 - a),
      0,
      9.85,
      0,
      0.58,
      0.43,
      0.3,
      'trim',
    );
  }
  // Open upper balcony and its stone corbels; coarse tiers retain only the broad rail band.
  if (d === 1) ring(o, x, z, r + 0.6, r + 0.49, 5.2, 5.42, n, 'rail', 'metal');
  else {
    ring(o, x, z, r + 0.61, r + 0.53, 5.32, 5.41, n, 'rail', 'metal');
    for (let i = 0; i < n * 2; i++) {
      const a = (2 * Math.PI * i) / (n * 2);
      rect(
        o,
        x + (r + 0.56) * Math.cos(a),
        4.47,
        z + (r + 0.56) * Math.sin(a),
        0.07,
        0.87,
        0.07,
        'rail',
        'metal',
      );
    }
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      drum(o, x + r * Math.cos(a), z + r * Math.sin(a), 0.13, 0.25, 3.62, 4.3, 6, 'trim');
    }
  }
  // Westward windows would be inside the connector; expose only the sea-facing half.
  for (const a of [-Math.PI / 3, 0, Math.PI / 3, Math.PI / 2]) {
    const q = local(o, x, z, Math.PI / 2 - a);
    // Keep the pane beyond the cylinder's vertices, not only beyond its face apothem.
    pointed(q, 0, r + 0.018, 1.02, 0.86, 2.42, d);
    pointed(q, 0, r * 0.9 + 0.018, 5.05, 0.79, 2.58, d);
  }
  if (d >= 2)
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * (i + 0.5)) / n,
        q = local(o, x + (r + 0.04) * Math.cos(a), z + (r + 0.04) * Math.sin(a), Math.PI / 2 - a);
      blindArcade(q, 0.58, 0, 8.98, d);
    }
}
export function buildSwallowsNestRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  terrace(o, d);
  const hall = frame.controls.mainHall,
    entry = frame.controls.entrance;
  rect(o, ...[hall.center[0], 0.4, hall.center[1]], hall.plan[0], 4.72, hall.plan[1]);
  rect(o, ...[entry.center[0], 0.4, entry.center[1]], entry.plan[0], 2.92, entry.plan[1]);
  rect(o, 3.8, 0.4, -0.12, 4.7, 7.05, 5.85);
  for (const [x, z, w, depth, y] of [
    [hall.center[0], hall.center[1], ...hall.plan, 5.12],
    [entry.center[0], entry.center[1], ...entry.plan, 3.32],
    [3.8, -0.12, 4.7, 5.85, 7.45],
  ]) {
    rect(o, x, y, z, w, 0.08, depth, 'roof', 'concrete');
    parapet(o, x, z, w, depth, y + 0.08, d);
  }
  for (const x of [-5.23, 1.67])
    for (const z of [-3.22, 3.42]) pinnacle(o, x, z, 3.75, 7.8, 0.33, d);
  roundTower(o, d);
  if (!d) return;
  for (const s of [-1, 1]) {
    const q = local(
      o,
      hall.center[0],
      hall.center[1] + (s * hall.plan[1]) / 2,
      s === 1 ? 0 : Math.PI,
    );
    pointed(q, 0, 0.045, 0.68, 2.1, 3.25, d);
    if (d >= 2) rect(q, 0, 0.68, 0.105, 0.1, 2.095, 0.1, 'wood', 'wood');
    blindArcade(q, hall.plan[0] - 0.4, 0.045, 4.46, d);
    const c = local(o, 3.55, -0.12 + s * 2.925, s === 1 ? 0 : Math.PI);
    for (const u of [-0.78, 0.78]) pointed(c, u, 0.045, 4.7, 0.65, 1.6, d);
    pointed(c, -0.2, 0.045, 0.85, 0.95, 2.3, d);
    if (d >= 2) {
      rect(q, 0, 4.99, 0, hall.plan[0] + 0.22, 0.18, 0.27, 'trim');
      for (const x of [-3.42, 3.42]) rect(q, x, 0.4, 0.055, 0.25, 4.7, 0.24, 'trim');
    }
  }
  const entrance = local(o, -10.055, -0.2, -Math.PI / 2);
  pointed(entrance, 0, 0.05, 0.4, 1.35, 2.52, d, 'wood', 'wood');
}
export const buildSwallowsNestSkyline = (o) =>
  buildSwallowsNestRuntime(
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
    'skyline',
  );
export const swallowsNestStudy = {
  id: 'N0271',
  key: 'swallow_s_nest',
  title: "Swallow's Nest",
  category: 'castle',
  wikidataId: 'Q1353643',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildSwallowsNestRuntime(o),
  brief:
    'Small limestone seaside folly with a stepped rectangular hall, four low pinnacles, a round eastern tower with four tall crown spires, projecting balcony and wraparound terrace.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: swallowsNestPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Three stepped masses ending in an eastern cylindrical tower',
      'Four high crown spires and four lower hall pinnacles',
      'Projecting circular balcony, crenellations and narrow perimeter terrace',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/103635688 exact Q1353643',
    mappedPlanMeters: [20.238, 7.245],
    publishedApproximatePlanMeters: [20, 10],
    publishedBuildingHeightMeters: 12,
  },
  reconstruction: {
    basis: 'OSM outline, museum gallery and post-restoration November2020 photographs',
    scope:
      'Exterior building and immediate terrace only; the natural cliff and remote approach are separate terrain',
  },
  scaleBasis:
    'Mapped20.238×7.245m main-building footprint; published12m building height includes the spire finials. Intermediate levels, parapets, apertures, balcony and terrace dimensions inferred from photographs. Published roughly40mcliff height is not building height.',
  refs: [
    'https://xn-----6kcbqggkggtcllvchedg5cwa0j.xn--p1ai/galereya',
    'https://www.culture.ru/institutes/13925/lastochkino-gnezdo',
    'https://www.openstreetmap.org/way/103635688',
    'https://ru.krymr.com/a/photo-lastochkino-gnezdo-rekonstruktsiya/30968661.html',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Photographs linked as research references, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0; museum and November2020 press photographs used only as visual references.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0.4,
    notes:
      'Exact mapped building identity. Eastern round tower fixes +X east-northeast. Cliff seating, approach and balcony clearances require terrain review.',
    reviewStatus: 'Research frame only; terrain seating pending',
  }),
  geographicNote:
    'Mapped anchor and signed19.92degree axis retained. Immediate terrace is approximate; geographic activation awaits cliff and approach review.',
  limitations: [
    'An original medium-fi reconstruction, not a measured conservation survey.',
    'Fine tracery, iron scrollwork, pipework and interiors omitted; masonry uses shared surfaces.',
    'Museum photographs can be older than2020; post-restoration photographs establish main masses, not every current fixture.',
    'Natural cliff, remote approach and neighboring buildings omitted.',
    'Actual terrain seating, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve eight spires, stepped massing and round sea tower in every level; closer tiers add pointed apertures, balcony rails and selected relief.',
  mediumFiContext: { scale: '1', neighborStyle: 'molen.worldgen.catalog.italian_palazzo' },
  camera: { position: [31, 21, 35], lookAt: [0, 4, 0], fov: 43 },
  qaCameras: [
    { name: 'sea-tower', position: [32, 15, 15], lookAt: [4, 5, 0] },
    { name: 'south-long-face', position: [-7, 12, 35], lookAt: [0, 4, 0] },
    { name: 'north-long-face', position: [0, 13, -35], lookAt: [0, 4, 0] },
    { name: 'west-entrance', position: [-31, 12, 8], lookAt: [-2, 4, 0] },
    { name: 'crown-and-balcony', position: [21, 13, 12], lookAt: [7.5, 7, 1] },
    { name: 'terrace-plan', position: [0, 42, 1], lookAt: [0, 1, 0] },
  ],
};
