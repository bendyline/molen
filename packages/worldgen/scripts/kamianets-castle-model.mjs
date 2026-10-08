/** Kamianets Old Castle: asymmetric tower chain, open court and lower outer defenses. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u8/u8d/n0278_kamianets_podilskyi_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const references = JSON.parse(
  readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)),
);
export const kamianetsPalette = {
  stone: '#c9bba2',
  trim: '#e0d7c2',
  brick: '#bd8c70',
  white: '#ded7c5',
  roof: '#626d77',
  wood: '#a77a54',
  glass: '#4d6178',
  paving: '#b5afa1',
};
const colors = Object.fromEntries(
  Object.entries(kamianetsPalette).map(([key, hex]) => [
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
const point = ([x, y]) => [(x - 445) * 0.6, (y - 247) * 0.52];
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
function cap(o, loop, y, col = 'paving', slot = 'limestone') {
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
function edge(o, a, b) {
  return {
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0])),
  };
}
function pane(o, x, y, z, w, h, d, arch = false) {
  const p = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
  ];
  if (arch)
    for (let i = 0; i <= (d < 2 ? 3 : 5); i++) {
      const a = (i * Math.PI) / (d < 2 ? 3 : 5);
      p.push([x + (w / 2) * Math.cos(a), y + h - w / 2 + (w / 2) * Math.sin(a), z]);
    }
  else p.push([x + w / 2, y + h, z], [x - w / 2, y + h, z]);
  face(o, p, 'glass', 'glass', [0, 0, 1]);
  if (d >= 3 && w >= 0.8) {
    for (const s of [-1, 1])
      face(
        o,
        [
          [x + (s * w) / 2, y, z + 0.06],
          [x + s * (w / 2 + 0.28), y, z + 0.06],
          [x + s * (w / 2 + 0.28), y + h - w / 2, z + 0.06],
          [x + (s * w) / 2, y + h - w / 2, z + 0.06],
        ],
        'trim',
        'limestone',
        [0, 0, 1],
      );
  }
}
function radial(o, radius, y, top, sides, col = 'stone', slot = 'limestone', upperRadius = radius) {
  const a = Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides + Math.PI / sides;
    return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
  });
  const b = a.map(([x, , z]) => [(x * upperRadius) / radius, top, (z * upperRadius) / radius]);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    face(o, [a[i], a[j], b[j], b[i]], col, slot, [a[i][0] + a[j][0], 0, a[i][2] + a[j][2]]);
  }
  // Upward top only; no invisible duplicate underside or continuous smooth shading.
  face(o, b, col, slot, [0, 1, 0]);
}
function ring(o, radius, width, y, top, sides, col = 'stone', slot = 'limestone') {
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides + Math.PI / sides,
      b = a + (2 * Math.PI) / sides;
    const p = (r, h, angle) => [r * Math.cos(angle), h, r * Math.sin(angle)];
    const outward = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    face(
      o,
      [p(radius, y, a), p(radius, y, b), p(radius, top, b), p(radius, top, a)],
      col,
      slot,
      outward,
    );
    face(
      o,
      [
        p(radius - width, y, a),
        p(radius - width, top, a),
        p(radius - width, top, b),
        p(radius - width, y, b),
      ],
      col,
      slot,
      outward.map((v) => -v),
    );
    face(
      o,
      [p(radius, top, a), p(radius, top, b), p(radius - width, top, b), p(radius - width, top, a)],
      col,
      slot,
      [0, 1, 0],
    );
  }
}
function cone(o, radius, y, top, sides) {
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides + Math.PI / sides,
      b = a + (2 * Math.PI) / sides;
    face(
      o,
      [
        [radius * Math.cos(a), y, radius * Math.sin(a)],
        [radius * Math.cos(b), y, radius * Math.sin(b)],
        [0, top, 0],
      ],
      'roof',
      'shingle',
      [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
    );
  }
}
function hip(o, w, depth, y, top) {
  const ridge = Math.max(0, (w - depth) * 0.5);
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [ridge, top, 0],
        [-ridge, top, 0],
      ],
      'roof',
      'shingle',
      [0, 1, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [s * ridge, top, 0],
      ],
      'roof',
      'shingle',
      [s, 1, 0],
    );
  }
}
function openings(o, t, d, sides, y, h, width, rounded = false) {
  if (d === 0) return;
  const step = d === 1 ? Math.max(1, Math.floor(sides / 6)) : 1;
  for (let i = 0; i < sides; i += step) {
    const a = (2 * Math.PI * (i + 1)) / sides,
      q = local(o, 0, 0, Math.PI / 2 - a);
    pane(q, 0, y, t.radius * Math.cos(Math.PI / sides) + 0.06, width, h, d, rounded);
  }
}
function tower(o, t, d) {
  const q = local(o, ...t.center),
    n = d === 0 ? 8 : d === 1 ? 12 : 16;
  if (t.type === 'papal') {
    rect(q, 0, 0, 0, t.radius * 1.8, 10, t.radius * 1.8);
    radial(q, t.radius, 10, 19, 8);
    radial(q, t.radius, 19, t.wallTop, n);
    // Modern broad low cap,not an invented matching tall northern cone.
    cone(q, t.radius + 0.65, t.wallTop, t.roofTop, n);
  } else if (t.type === 'pentagon') {
    radial(q, t.radius, 0, t.wallTop, 5);
    cone(q, t.radius + 0.5, t.wallTop, t.roofTop, 5);
  } else if (t.type === 'open') {
    radial(q, t.radius, 0, t.wallTop - 1.3, n);
    ring(q, t.radius, 1.25, t.wallTop - 1.3, t.wallTop, n);
  } else if (t.type === 'crown') {
    radial(q, t.radius, 0, t.wallTop - 3, n);
    radial(q, t.radius + 0.4, t.wallTop - 3, t.wallTop, n, 'brick', 'brick');
    if (d >= 2) radial(q, t.radius + 0.58, t.wallTop - 3.25, t.wallTop - 3, n, 'trim');
    cone(q, t.radius + 0.7, t.wallTop, t.roofTop, n);
  } else {
    radial(
      q,
      t.radius,
      0,
      t.wallTop,
      n,
      t.type === 'white' ? 'white' : 'stone',
      t.type === 'white' ? 'plaster' : 'limestone',
    );
    cone(q, t.radius + 0.5, t.wallTop, t.roofTop, n);
  }
  if (t.type === 'crown')
    openings(q, { ...t, radius: t.radius + 0.4 }, d, n, t.wallTop - 2.7, 2.15, 0.95, true);
  if (t.type === 'papal') {
    // Openings follow the actual square/octagonal/round stages,not an imaginary cylinder.
    openings(q, t, d, 8, 12, 1.4, 1);
    if (d >= 2) {
      openings(q, t, d, n, 20, 1.4, 0.8);
      for (let i = 0; i < 4; i++)
        pane(local(q, 0, 0, (i * Math.PI) / 2), 0, 4.5, t.radius * 0.9 + 0.06, 1, 1.4, d);
    }
    return;
  }
  if (d >= 1) openings(q, t, d, n, t.type === 'pentagon' ? 3.5 : 7, 1.4, d === 1 ? 0.8 : 1.0);
  if (d >= 2 && t.wallTop > 17) openings(q, t, d, n, 14, 1.4, 0.8);
}
function portal(o, width, height, depth, yTop, d) {
  // Open passage:sides and arch spandrel surround a real void at every LOD.
  const w = 3.2,
    spring = 3.8,
    n = d < 2 ? 4 : 8;
  rect(o, -(width / 2 + w) / 2, 0, 0, width / 2 - w, yTop, depth);
  rect(o, (width / 2 + w) / 2, 0, 0, width / 2 - w, yTop, depth);
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i * Math.PI) / n,
      b = Math.PI - ((i + 1) * Math.PI) / n;
    const x1 = w * Math.cos(a),
      x2 = w * Math.cos(b),
      h1 = spring + w * Math.sin(a),
      h2 = spring + w * Math.sin(b);
    for (const s of [-1, 1])
      face(
        o,
        [
          [x1, h1, (s * depth) / 2],
          [x2, h2, (s * depth) / 2],
          [x2, yTop, (s * depth) / 2],
          [x1, yTop, (s * depth) / 2],
        ],
        'stone',
        'limestone',
        [0, 0, s],
      );
    face(
      o,
      [
        [x1, h1, -depth / 2],
        [x1, h1, depth / 2],
        [x2, h2, depth / 2],
        [x2, h2, -depth / 2],
      ],
      'stone',
      'limestone',
      [0, -1, 0],
    );
  }
  face(
    o,
    [
      [-w, 0, -depth / 2],
      [-w, spring, -depth / 2],
      [-w, spring, depth / 2],
      [-w, 0, depth / 2],
    ],
    'stone',
    'limestone',
    [1, 0, 0],
  );
  face(
    o,
    [
      [w, 0, depth / 2],
      [w, spring, depth / 2],
      [w, spring, -depth / 2],
      [w, 0, -depth / 2],
    ],
    'stone',
    'limestone',
    [-1, 0, 0],
  );
  face(
    o,
    [
      [-width / 2, yTop, -depth / 2],
      [width / 2, yTop, -depth / 2],
      [width / 2, yTop, depth / 2],
      [-width / 2, yTop, depth / 2],
    ],
    'stone',
    'limestone',
    [0, 1, 0],
  );
  if (height !== yTop) throw new Error('Portal elevation mismatch');
}
function curtain(o, a, b, d, top = 12, thickness = 2.8, gate = false) {
  const { q, length } = edge(o, a, b);
  if (gate) portal(q, length, top, thickness, top, d);
  else rect(q, 0, 0, 0, length, top, thickness);
  if (d >= 1) {
    const count = Math.floor(length / (d === 1 ? 9 : 5));
    for (const s of [-1, 1]) {
      const f = local(q, 0, 0, s < 0 ? Math.PI : 0);
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * length) / count - length / 2;
        if (gate && Math.abs(x) < 4) continue;
        pane(f, x, top - 2, thickness / 2 + 0.05, 0.55, 1.05, d);
      }
    }
  }
}
function range(o, a, b, depth, wallTop, roofTop, d, withDoors = false) {
  const { q, length } = edge(o, a, b);
  rect(q, 0, 0, 0, length, wallTop, depth);
  hip(q, length + 0.6, depth + 0.6, wallTop, roofTop);
  if (d >= 1)
    for (const s of [-1, 1]) {
      const f = local(q, 0, 0, s < 0 ? Math.PI : 0),
        n = Math.floor(length / 7);
      for (let i = 0; i < n; i++)
        pane(f, ((i + 0.5) * length) / n - length / 2, 1.5, depth / 2 + 0.06, 1.3, 1.2, d);
    }
  if (d >= 2 && withDoors)
    for (const x of [-length / 3, 0, length / 3])
      face(
        q,
        [
          [x - 1, 0, depth / 2 + 0.08],
          [x + 1, 0, depth / 2 + 0.08],
          [x + 1, 2.5, depth / 2 + 0.08],
          [x - 1, 2.5, depth / 2 + 0.08],
        ],
        'wood',
        'wood',
        [0, 0, 1],
      );
}
function castle(o, d) {
  const p = frame.controls.curtainPixels.map(point),
    north = frame.controls.northCourtPixels.map(point),
    south = frame.controls.southCourtPixels.map(point);
  cap(o, p, 0);
  cap(o, north, 0);
  cap(o, south, 0);
  for (let i = 0; i < p.length; i++) curtain(o, p[i], p[(i + 1) % p.length], d, 12, 2.8, i === 10);
  // Low outer courts follow the historic compound hierarchy,not the entire OSM parent ring.
  for (let i = 0; i < 5; i++) curtain(o, south[i], south[i + 1], d, 6.2, 2.3);
  curtain(o, north[0], north[1], d, 7, 2.4);
  curtain(o, north[1], north[2], d, 7, 2.4);
  curtain(o, north[2], north[3], d, 7, 2.4);
  for (const t of frame.controls.towers) tower(o, t, d);
  range(o, point([343, 221]), point([512, 234]), 8.3, 5.6, 9.3, d, true);
  range(o, point([370, 263]), point([487, 289]), 7, 5.2, 8.8, d, true);
  range(o, point([513, 286]), point([555, 254]), 8, 10.8, 14, d);
  // Gate keeper range is low and subordinate to the southeast Papal corner.
  range(o, point([306, 220]), point([309, 245]), 7, 6.7, 10, d);
  if (d >= 2) {
    // A few broad buttresses/cornice bands,above the0.26m closeup error scale.
    for (const y of [10, 18.8]) {
      const t = frame.controls.towers[0],
        q = local(o, ...t.center);
      radial(q, t.radius + 0.2, y, y + 0.35, 8, 'trim');
    }
  }
}
export const buildKamianetsRuntime = (o, level = 'closeup') =>
  castle(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildKamianetsSkyline = (o) =>
  castle(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            'silhouette',
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
export const kamianetsStudy = {
  id: 'N0278',
  key: 'kamianets_podilskyi_castle',
  title: 'Kamianets-Podilskyi Castle',
  category: 'castle',
  wikidataId: 'Q2375603',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKamianetsRuntime(o),
  brief:
    'Kamianets Old Castle:irregular open court,faceted Papal southeast tower with broad cap,two tall conical northern towers with warm arched crowns,pentagonal New East gate corner,open paired western bastion and lower outer courts with low casemate roofs.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: kamianetsPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 6,
    materialBudgetReason:
      'Fortification campus uses five shared limestone,brick,lime-plaster,shingle and wood graphs plus one untextured glass group. All parts merged by material.',
    identityFeatures: [
      'Irregular open stone court with asymmetric tower chain',
      'Tall dark pointed northern roofs above warm arched crown bands and broad Papal cap',
      'Pentagonal gate corner and paired open western bastion,lower outer courts',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/274749273 exact Q2375603,whole-site boundary',
    publishedOldCastleApproximateLengthMeters: 180,
    publishedOldCastleApproximateWidthMeters: 50,
    historicalTowerDescription:
      'Sitsinsky1928:eleven including separate river-level Water tower;current city description includes restored Small tower and excludes some historical ruins.',
    verifiedTowerHeightsMeters: null,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Interpretive primary-plan trace,X0.6m/pixel,Z0.52m/pixel,within approximate published180m long/50m wide old-castle massing. All component dimensions/heights and exact geographic registration estimated;maximum roof35m is not surveyed.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM whole-site evidence © OpenStreetMap contributors,ODbL-1.0. Primary plans/photos linked research only,not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors. Original Sitsinsky survey hosted by Podilski Tovtry National Nature Park;Kamianets City Council,municipal tourism and National Architectural Reserve primary references.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Interpretive Old Castle trace and approximate northwest/southeast sign only. Reference coordinate is not surveyed body center. No tower-by-tower OSM registration or terrain fit.',
    reviewStatus: 'Geographic placement pending;inactive draft',
  }),
  geographicNote:
    'Whole mapped boundary includes defenses/approach and is not extruded as a building. Exact old-castle orientation,position,terrain and footprint replacement need in-world review.',
  limitations: references.limitations,
  importReason:
    'Preserve irregular open courtyard,tall northern roof/crown hierarchy,broad Papal cap,pentagonal entry corner and open western paired bastion across four compact levels.',
  mediumFiContext: { scale: '0.75', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-170, 110, 170], lookAt: [0, 10, 0], fov: 43 },
  qaCameras: [
    { name: 'entry-papal-and-northern-cones', position: [-124, 29, 74], lookAt: [-28, 13, 10] },
    { name: 'open-courtyard', position: [0, 65, 0], lookAt: [0, 0, 0] },
    { name: 'paired-western-bastion', position: [136, 30, 43], lookAt: [79, 12, 9] },
    { name: 'rozhanka-pointed-crown', position: [43, 30, 94], lookAt: [34, 17, 36] },
    { name: 'papal-faceted-body', position: [-122, 27, -70], lookAt: [-72, 14, -28] },
    { name: 'old-castle-and-outer-courts', position: [0, 240, 1], lookAt: [0, 0, 0] },
  ],
};
