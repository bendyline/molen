/** Kuressaare convent building: mapped courtyard, inward roofs and two unequal square towers. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u6/u6r/n0272_kuressaare_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const kuressaarePalette = {
  stone: '#cdbf9e',
  trim: '#e6dcc7',
  roof: '#b56749',
  wood: '#795e47',
  glass: '#4d6178',
  metal: '#697075',
  paving: '#b6b0a1',
};
const colors = Object.fromEntries(
  Object.entries(kuressaarePalette).map(([key, hex]) => [
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
      n = normalFor(...t),
      axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
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
function clockwise(p) {
  p = p.slice();
  if (p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop();
  const area = p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return area > 0 ? p.reverse() : p;
}
const outer = clockwise(frame.geometry.outline),
  court = clockwise(frame.geometry.holes[0]);
function triangulated(o, loops, heights, col = 'stone', slot = 'limestone') {
  const points = loops.flat(),
    holes = [];
  let total = loops[0].length;
  for (let i = 1; i < loops.length; i++) {
    holes.push(total);
    total += loops[i].length;
  }
  const ids = earcut(points.flat(), holes, 2),
    ys = loops.flatMap((p, i) => p.map(() => heights[i]));
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [points[j][0], ys[j], points[j][1]]),
      col,
      slot,
      true,
    );
}
function roof(o, x, z, w, depth, y, top) {
  const p = [
    [x - w / 2, y, z - depth / 2],
    [x + w / 2, y, z - depth / 2],
    [x + w / 2, y, z + depth / 2],
    [x - w / 2, y, z + depth / 2],
  ];
  for (let i = 0; i < 4; i++) face(o, [p[i], [x, top, z], p[(i + 1) % 4]], 'roof', 'tile', true);
}
// A real opening in the wall surface; the corridor behind it gets its own sides and soffit.
function wall(o, a, b, top, inside = false, gate = null, d = 3) {
  const emit = (p) => face(o, inside ? [...p].reverse() : p);
  if (!gate || Math.abs(a[0] - b[0]) < 0.01) {
    emit([
      [...a.slice(0, 1), 0, a[1]],
      [b[0], 0, b[1]],
      [b[0], top, b[1]],
      [a[0], top, a[1]],
    ]);
    return;
  }
  const min = Math.min(a[0], b[0]),
    max = Math.max(a[0], b[0]),
    left = gate.x - gate.width / 2,
    right = gate.x + gate.width / 2;
  if (max <= left || min >= right) {
    wall(o, a, b, top, inside);
    return;
  }
  const cuts = [
    a[0],
    b[0],
    left,
    right,
    ...Array.from({ length: d >= 2 ? 9 : 3 }, (_, i) => left + (gate.width * i) / (d >= 2 ? 8 : 2)),
  ].filter((x) => x >= min && x <= max);
  cuts.sort((u, v) => (a[0] < b[0] ? u - v : v - u));
  const at = (x, y) => [x, y, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const arch = (x) =>
    gate.spring +
    Math.sqrt(Math.max(0, 1 - Math.pow((x - gate.x) / (gate.width / 2), 2))) *
      (gate.head - gate.spring);
  for (let i = 1; i < cuts.length; i++) {
    const x0 = cuts[i - 1],
      x1 = cuts[i];
    if (Math.abs(x1 - x0) < 0.001) continue;
    const opening = (x0 + x1) / 2 > left && (x0 + x1) / 2 < right;
    emit([
      at(x0, opening ? arch(x0) : 0),
      at(x1, opening ? arch(x1) : 0),
      at(x1, top),
      at(x0, top),
    ]);
  }
}
function pane(o, x, z, y, w, h, d, pointed = false) {
  const p = pointed
    ? [
        [x - w / 2, y],
        [x - w / 2, y + h - w * 0.45],
        [x, y + h],
        [x + w / 2, y + h - w * 0.45],
        [x + w / 2, y],
      ]
    : [
        [x - w / 2, y],
        [x - w / 2, y + h],
        [x + w / 2, y + h],
        [x + w / 2, y],
      ];
  face(o, p.map(([u, v]) => [u, v, z]).reverse(), 'glass', 'glass');
  if (d >= 2) {
    for (const s of [-1, 1])
      rect(o, x + s * (w / 2 + 0.065), y, z + 0.02, 0.13, pointed ? h - w * 0.45 : h, 0.13, 'trim');
    rect(o, x, y - 0.12, z + 0.035, w + 0.26, 0.12, 0.2, 'trim');
    if (!pointed) rect(o, x, y + h, z + 0.02, w + 0.26, 0.13, 0.15, 'trim');
    else
      for (const s of [-1, 1])
        face(
          o,
          [
            [x + (s * w) / 2, y + h - w * 0.45, z + 0.085],
            [x, y + h, z + 0.085],
            [x, y + h + 0.14, z + 0.085],
            [x + s * (w / 2 + 0.1), y + h - w * 0.45 + 0.07, z + 0.085],
          ],
          'trim',
        );
    if (w > 1.15) rect(o, x, y, z + 0.075, 0.12, pointed ? h - w * 0.45 : h, 0.12, 'trim');
  }
}
function gallery(o, d) {
  const y = frame.controls.outerWallTop;
  for (const [x, z, len, a] of [
    [0, 20.88, 42.1, 0],
    [0, -20.6, 42.3, 0],
    [-21.3, 0, 41.7, Math.PI / 2],
    [21.05, 0, 41.7, Math.PI / 2],
  ]) {
    const q = local(o, x, z, a),
      n = d ? Math.round(len / 1.7) : 8;
    rect(q, 0, y - 0.3, 0, len, 0.48, 0.65, 'trim');
    for (let i = 0; i <= n; i++)
      rect(q, -len / 2 + (len * i) / n, y + 0.18, 0, d ? 0.87 : 1.5, 0.93, 0.65, 'trim');
  }
}
function tower(o, t, watch, d) {
  const [x, z] = t.center,
    [w, depth] = t.plan;
  rect(o, x, 0, z, w, t.wallTop, depth);
  if (watch) {
    rect(o, x, t.wallTop - 2.2, z, w + 0.48, 2.2, depth + 0.48, 'trim');
    if (d)
      for (const [len, px, pz, a] of [
        [w, x, z + depth / 2 + 0.25, 0],
        [w, x, z - depth / 2 - 0.25, Math.PI],
        [depth, x + w / 2 + 0.25, z, Math.PI / 2],
        [depth, x - w / 2 - 0.25, z, -Math.PI / 2],
      ]) {
        const q = local(o, px, pz, a),
          n = Math.round(len / 0.95);
        for (let i = 0; i < n; i++)
          pane(q, -len / 2 + ((i + 0.5) * len) / n, 0.02, t.wallTop - 1.45, 0.44, 1.18, 0);
        if (d >= 2)
          for (let i = 0; i < n; i++)
            rect(
              q,
              -len / 2 + ((i + 0.5) * len) / n,
              t.wallTop - 2.75,
              0,
              0.35,
              0.55,
              0.45,
              'trim',
            );
      }
  }
  roof(o, x, z, w + 0.8, depth + 0.8, t.wallTop, t.roofTop);
  if (d) {
    rect(o, x, t.roofTop, z, 0.12, t.finialTop - t.roofTop, 0.12, 'metal', 'metal');
    if (watch && d >= 2)
      rect(o, x + 0.36, t.finialTop - 0.46, z, 0.65, 0.24, 0.12, 'metal', 'metal');
  } else rect(o, x, t.roofTop, z, 0.2, t.finialTop - t.roofTop, 0.2, 'metal', 'metal');
  if (!d) return;
  for (const [, px, pz, a] of [
    [w, x, z + depth / 2 + 0.035, 0],
    [w, x, z - depth / 2 - 0.035, Math.PI],
    [depth, x + w / 2 + 0.035, z, Math.PI / 2],
    [depth, x - w / 2 - 0.035, z, -Math.PI / 2],
  ]) {
    const q = local(o, px, pz, a),
      heights = watch ? [7.8, 17.2, 23.4] : [7.6, 13.9, 20.1, 25.4];
    for (let i = 0; i < heights.length; i++)
      pane(q, i % 2 ? 0.4 : -0.35, 0.02, heights[i], watch ? 0.55 : 1.05, watch ? 1.1 : 1.45, d);
    if (!watch && d >= 2)
      for (const u of [-w * 0.28, w * 0.28]) pane(q, u, 0.02, 25.3, 1.2, 1.6, d);
  }
}
function gate(o, d) {
  const g = frame.controls.gate,
    innerZ = -8.47;
  for (const s of [-1, 1])
    rect(o, g.x + s * (g.width / 2 + 0.3), 0, (g.z + innerZ) / 2, 0.6, 5.2, innerZ - g.z);
  const n = d >= 2 ? 8 : 2,
    profile = Array.from({ length: n + 1 }, (_, i) => {
      const u = -1 + (2 * i) / n;
      return [g.x + (u * g.width) / 2, g.spring + Math.sqrt(1 - u * u) * (g.head - g.spring)];
    });
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(
      o,
      [
        [a[0], a[1], g.z],
        [b[0], b[1], g.z],
        [b[0], b[1], innerZ],
        [a[0], a[1], innerZ],
      ],
      'trim',
    );
  }
  if (!d) return;
  // The raised timber portcullis leaves the passage clear.
  if (d >= 2) {
    for (let u = -1.3; u <= 1.31; u += 0.43)
      rect(o, g.x + u, 5.2, g.z - 0.035, 0.16, 2.35, 0.18, 'wood', 'wood');
    for (const y of [5.55, 6.7]) rect(o, g.x, y, g.z - 0.05, 2.95, 0.15, 0.2, 'wood', 'wood');
    face(
      o,
      [
        [g.x - 0.5, 6.5, g.z - 0.1],
        [g.x, 6.1, g.z - 0.1],
        [g.x + 0.5, 6.5, g.z - 0.1],
        [g.x + 0.5, 7.3, g.z - 0.1],
        [g.x - 0.5, 7.3, g.z - 0.1],
      ],
      'trim',
    );
  }
  // Two-storey gate oriel, reconstructed in dark timber beside Sturvolt.
  rect(o, -5.45, 15.1, -21.65, 3.65, 7.4, 2.45, 'wood', 'wood');
  roof(o, -5.45, -21.65, 4, 2.8, 22.5, 24.3);
  if (d >= 2) {
    const front = local(o, -5.45, -22.895, Math.PI);
    for (const y of [15.8, 19.8]) for (const x of [-1, 0, 1]) pane(front, x, 0, y, 0.55, 1.25, d);
    for (const x of [-6.9, -5.45, -4]) rect(o, x, 14.35, -21.6, 0.35, 0.8, 1.9, 'wood', 'wood');
  }
}
function apertures(o, d) {
  if (!d) return;
  const faces = [
    { q: local(o, 0, 20.94), bays: [-14, -7, 2, 10, 16] },
    { q: local(o, -21.35, 0, -Math.PI / 2), bays: [-5, 2, 9, 16] },
    { q: local(o, 21.35, 0, Math.PI / 2), bays: [-5, 2, 9, 16] },
    { q: local(o, 0, -20.97, Math.PI), bays: [-11, -6, -1] },
  ];
  for (const { q, bays } of faces)
    for (let i = 0; i < bays.length; i++) {
      const x = bays[i];
      pane(q, x, 0, 7.2 + (i % 2) * 0.55, 1.05, 1.7, d);
      if (d >= 2) {
        pane(q, x + 0.4, 0, 2.45, 0.65, 1.15, d);
        pane(q, x - 0.5, 0, 13.35, 0.55, 1.1, d);
      }
    }
  if (d >= 2) {
    // Insets face the pit. Placing these beyond the outline hides them behind the masonry.
    const west = local(o, -6.58, 0.1, Math.PI / 2),
      east = local(o, 2.57, 0.1, -Math.PI / 2),
      south = local(o, -2.05, 6.79, Math.PI);
    for (const q of [west, east])
      for (const x of [-4.7, -0.1, 4.3]) {
        pane(q, x, 0.025, 5.6, 1.65, 3.1, d, true);
        pane(q, x, 0.025, 1.25, 0.8, 1.1, d);
        pane(q, x, 0.025, 10.75, 0.75, 1.25, d);
      }
    for (const x of [-2.8, 0.1, 3]) {
      pane(south, x, 0.025, 5.6, 1.45, 3.05, d, true);
      pane(south, x, 0.025, 10.75, 0.75, 1.25, d);
    }
  }
}
function bowl(o, d) {
  if (d < 3) return;
  rect(o, -1.65, 0.18, 0.85, 1.45, 0.22, 1.45, 'paving');
  const n = 8,
    at = (i, y, r) => [
      -1.65 + r * Math.cos((2 * Math.PI * i) / n),
      y,
      0.85 + r * Math.sin((2 * Math.PI * i) / n),
    ];
  for (let i = 0; i < n; i++) {
    face(
      o,
      [at(i, 0.4, 0.36), at(i, 1.08, 0.9), at(i + 1, 1.08, 0.9), at(i + 1, 0.4, 0.36)],
      'trim',
    );
    face(
      o,
      [at(i, 1.08, 0.9), at(i, 1.08, 0.72), at(i + 1, 1.08, 0.72), at(i + 1, 1.08, 0.9)],
      'trim',
      'limestone',
      true,
    );
    face(
      o,
      [at(i + 1, 0.82, 0.25), at(i + 1, 1.08, 0.72), at(i, 1.08, 0.72), at(i, 0.82, 0.25)],
      'trim',
    );
  }
}
export function buildKuressaareRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
    c = frame.controls;
  triangulated(o, [outer, court], [0.06, 0.06], 'paving');
  triangulated(o, [court], [0.18], 'paving');
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    wall(o, a, b, c.outerWallTop, false, a[1] < -19 && b[1] < -19 ? c.gate : null, d);
  }
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length];
    wall(
      o,
      a,
      b,
      c.courtyardWallTop,
      true,
      a[1] < -8 && b[1] < -8 ? { ...c.gate, x: -5.2, width: 2.6 } : null,
      d,
    );
  }
  // Roof planes descend toward the courtyard; they do not cap or fill the mapped hole.
  triangulated(o, [clockwise(c.roofOuter), court], [20.65, 13.65], 'roof', 'tile');
  triangulated(o, [outer, clockwise(c.roofOuter)], [20.4, 20.4]);
  gallery(o, d);
  gate(o, d);
  tower(o, c.defenceTower, false, d);
  tower(o, c.watchTower, true, d);
  apertures(o, d);
  bowl(o, d);
  if (d >= 2)
    for (const [x, z] of [
      [-12, 9],
      [10, 9],
      [5, -10],
    ]) {
      rect(o, x, 13.4, z, 0.72, 7.1, 0.72);
      rect(o, x, 20.5, z, 0.95, 0.2, 0.95, 'trim');
    }
  // Actual vertical base edges maintain a declared ground plane rather than floating faces.
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 0.06, b[1]],
        [a[0], 0.06, a[1]],
      ],
      'paving',
    );
  }
}
export const buildKuressaareSkyline = (o) =>
  buildKuressaareRuntime(
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
export const kuressaareStudy = {
  id: 'N0272',
  key: 'kuressaare_castle',
  title: 'Kuressaare Castle',
  category: 'castle',
  wikidataId: 'Q1768091',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKuressaareRuntime(o),
  brief:
    'Square dolomite convent building with a small open courtyard, broad red roof fields sloping inward, massive northern Sturvolt, slender eastern Tall Hermann, crenellated gallery and timber gate oriel.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: kuressaarePalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Massive northern and slender eastern square towers with red pyramidal roofs',
      'Square courtyard compound with inward-sloping red roof fields and open L-shaped court',
      'Crenellated perimeter gallery and two-storey timber gate oriel',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/414356 exact Q1768091',
    mappedPlanMeters: [42.607, 41.783],
    publishedSquareSideMeters: 43,
    publishedDefenceTowerHeightMeters: 37,
    mappedApproximateHeightMeters: 25,
  },
  reconstruction: {
    basis:
      'OSM outer/courtyard outlines, museum dimensions and tour photographs, LUMIA floor plans and section',
    scope:
      'Convent building exterior and courtyard; excludes wider fortress, moat and separate buildings',
  },
  scaleBasis:
    'Mapped42.607×41.783m footprint agrees with published43m plan. Northern tower reaches37m including finial; published datum is unspecified. Watchtower38.2m, outer wall20.4m, court wall13.6m and roof/eave levels inferred from the architect section and photographs. Map25m height carries an explicit uncertainty note.',
  refs: [
    'https://linnus.samu.ee/en/about-the-castle/',
    'https://www.lumia.ee/en/projects/kuressaare-episcopal-castle',
    'https://www.kuressaarecastle.ee/',
    'https://whc.unesco.org/en/tentativelists/1716/',
    'https://www.openstreetmap.org/relation/414356',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Architect drawings and photographs linked as research references, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Saaremaa Museum tour and LUMIA drawings/photos used as visual references only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Northern Sturvolt and eastern Tall Hermann resolve the signed map axis; northeast gate faces -Z. Terrain and approach seating require in-world review.',
    reviewStatus: 'Research frame only; geographic seating pending',
  }),
  geographicNote:
    'Exact mapped outline and courtyard retain their anchor and signed axis; tower identities resolve direction. Geographic activation awaits terrain and gate-approach review.',
  limitations: [
    'Original medium-fi reconstruction, not a conservation survey.',
    'Intermediate elevations and watchtower38.2m height inferred; the published37m defence-tower datum is unspecified.',
    'Fine tracery, diamond glazing lattice, complete interiors and fixtures omitted.',
    'Tour predates some2024 interior changes; exterior masses cross-checked against contemporary architect photographs.',
    'Wider fortress, bastions, moat, Cannon Tower and neighboring buildings omitted.',
    'Actual terrain seating, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve unequal square towers, red inward roof ring and open courtyard in every LOD. Closer levels add aperture rhythm, cloister windows, raised gate and bowl.',
  mediumFiContext: { scale: '1', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [68, 55, -68], lookAt: [0, 13, 0], fov: 43 },
  qaCameras: [
    { name: 'northeast-gate-and-towers', position: [0, 37, -82], lookAt: [0, 17, -3] },
    { name: 'southwest-convent', position: [-45, 37, 72], lookAt: [0, 12, 0] },
    { name: 'east-watchtower', position: [78, 39, -15], lookAt: [7, 17, 0] },
    { name: 'north-sturvolt', position: [-65, 40, -45], lookAt: [-8, 19, -6] },
    { name: 'cloister-court', position: [1.7, 4.5, 5.5], lookAt: [-6.58, 6.7, 0] },
    { name: 'roof-and-court-plan', position: [0, 120, 1], lookAt: [0, 5, 0] },
  ],
};
