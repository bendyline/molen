/** Beaumaris: present-day squat concentric ruins, two open gates and the sea dock. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/gc/gcm/n0283_beaumaris_castle/';
const frame = JSON.parse(readFileSync(new URL(`${root}map-frame.json`, import.meta.url)));
const refs = JSON.parse(readFileSync(new URL(`${root}reference-metadata.json`, import.meta.url)));
export const beaumarisPalette = {
  stone: '#b7b59f',
  coping: '#c6bfa8',
  weathered: '#a9aa96',
  grass: '#8aa065',
  paving: '#b4afa3',
  water: '#286d83',
  wood: '#b59a74',
};
const colors = Object.fromEntries(
  Object.entries(beaumarisPalette).map(([k, hex]) => [
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
function cap(o, loop, y, col = 'paving', slot = 'foliage', holes = []) {
  const rings = [loop, ...holes],
    vertices = rings.flat(),
    offsets = [];
  let count = loop.length;
  for (const ring of holes) {
    offsets.push(count);
    count += ring.length;
  }
  const ids = earcut(vertices.flat(), offsets, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [...vertices[j].slice(0, 1), y, vertices[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function ring(
  o,
  outer,
  inner,
  base,
  top,
  { skipBack = false, solid = false, col = 'stone', slot = 'limestone' } = {},
) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      a = outer[i],
      b = outer[j],
      u = inner?.[i],
      v = inner?.[j];
    const back = skipBack && Math.abs(a[1] - b[1]) < 0.001 && i === outer.length - 2;
    if (!back)
      face(
        o,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        col,
        slot,
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    if (!solid) {
      if (!back)
        face(
          o,
          [
            [v[0], base, v[1]],
            [u[0], base, u[1]],
            [u[0], top, u[1]],
            [v[0], top, v[1]],
          ],
          col,
          slot,
          [u[1] - v[1], 0, v[0] - u[0]],
        );
      if (!back)
        face(
          o,
          [
            [a[0], top, a[1]],
            [b[0], top, b[1]],
            [v[0], top, v[1]],
            [u[0], top, u[1]],
          ],
          col,
          slot,
          [0, 1, 0],
        );
    }
  }
  if (solid) cap(o, outer, top, col, slot);
}
const circle = (x, z, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [x + r * Math.cos(a), z + r * Math.sin(a)];
  });
function circular(o, x, z, r, base, top, n, d, outer = false) {
  ring(o, circle(x, z, r, n), circle(x, z, r - (outer ? 0.8 : 2.1), n), base, top, {
    solid: outer && d === 0,
  });
  if (d && (!outer || d >= 2)) {
    const count = outer ? 3 : 5;
    for (let i = 0; i < count; i++) {
      // Sparse large surviving coping remnants; not an intact fantasy crown.
      const a = (2 * Math.PI * i) / count + 0.15,
        q = local(o, x + (r - 0.45) * Math.cos(a), z + (r - 0.45) * Math.sin(a), Math.PI / 2 - a);
      rect(q, 0, top, 0, outer ? 1.4 : 1.8, outer ? 0.8 : 0.6, 0.8, 'coping');
    }
  }
}
function wall(o, a, b, base, top, thick = 2, col = 'stone', slot = 'limestone', d = 0) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(a[1] - b[1], b[0] - a[0]));
  if (d === 0) {
    for (const side of [-1, 1])
      face(
        q,
        [
          [-length / 2, base, (side * thick) / 2],
          [length / 2, base, (side * thick) / 2],
          [length / 2, top, (side * thick) / 2],
          [-length / 2, top, (side * thick) / 2],
        ],
        col,
        slot,
        [0, 0, side],
      );
    face(
      q,
      [
        [-length / 2, top, -thick / 2],
        [length / 2, top, -thick / 2],
        [length / 2, top, thick / 2],
        [-length / 2, top, thick / 2],
      ],
      col,
      slot,
      [0, 1, 0],
    );
  } else rect(q, 0, base, 0, length, top - base, thick, col, slot);
  if (d >= 2 && length > 10) {
    const n = Math.floor(length / 8);
    for (let i = 0; i < n; i++)
      rect(q, -length / 2 + ((i + 0.5) * length) / n, top, 0, 2.2, 0.8, thick, 'coping', slot);
  }
}
function aperture(
  o,
  x,
  z,
  base,
  sill,
  width,
  head,
  top,
  depth,
  d,
  col = 'stone',
  slot = 'limestone',
  segmental = false,
) {
  if (sill > base) strip(o, x, z, width, base, sill, depth, d, col, slot);
  const rise = width * (segmental ? 0.22 : 0.5),
    spring = head - rise,
    n = d >= 2 ? 6 : 2,
    profile = Array.from({ length: n + 1 }, (_, i) => {
      const u = -1 + (2 * i) / n;
      return [
        x + (u * width) / 2,
        spring + Math.sqrt(segmental ? 1 - u * u : 1 - Math.abs(u)) * rise,
      ];
    });
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    for (const side of [-1, 1])
      face(
        o,
        [
          [a[0], a[1], z + (side * depth) / 2],
          [b[0], b[1], z + (side * depth) / 2],
          [b[0], top, z + (side * depth) / 2],
          [a[0], top, z + (side * depth) / 2],
        ],
        col,
        slot,
        [0, 0, side],
      );
    face(
      o,
      [
        [a[0], a[1], z - depth / 2],
        [b[0], b[1], z - depth / 2],
        [b[0], b[1], z + depth / 2],
        [a[0], a[1], z + depth / 2],
      ],
      'coping',
      slot,
      [0, -1, 0],
    );
  }
  for (const side of [-1, 1])
    face(
      o,
      [
        [x + (side * width) / 2, sill, z - depth / 2],
        [x + (side * width) / 2, spring, z - depth / 2],
        [x + (side * width) / 2, spring, z + depth / 2],
        [x + (side * width) / 2, sill, z + depth / 2],
      ],
      'coping',
      slot,
      [-side, 0, 0],
    );
  if (d)
    face(
      o,
      [
        [x - width / 2, top, z - depth / 2],
        [x + width / 2, top, z - depth / 2],
        [x + width / 2, top, z + depth / 2],
        [x - width / 2, top, z + depth / 2],
      ],
      col,
      slot,
      [0, 1, 0],
    );
}
function strip(o, x, z, length, base, top, depth, d, col = 'stone', slot = 'limestone') {
  if (d) rect(o, x, base, z, length, top - base, depth, col, slot);
  else wall(o, [x - length / 2, z], [x + length / 2, z], base, top, depth, col, slot);
}
function pierced(o, x, z, length, base, top, depth, holes, d) {
  let cursor = x - length / 2;
  for (const h of holes) {
    const left = h.x - h.width / 2,
      right = h.x + h.width / 2;
    if (left > cursor) strip(o, (cursor + left) / 2, z, left - cursor, base, top, depth, d);
    aperture(
      o,
      h.x,
      z,
      base,
      h.sill,
      h.width,
      h.head,
      top,
      depth,
      d,
      'stone',
      'limestone',
      h.segmental,
    );
    cursor = right;
  }
  if (cursor < x + length / 2)
    strip(o, (cursor + x + length / 2) / 2, z, x + length / 2 - cursor, base, top, depth, d);
}
function dShape(r, depth, n) {
  return [
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI + (Math.PI * i) / n;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
    [r, depth],
    [-r, depth],
  ];
}
function gate(o, g, d, north) {
  const base = frame.controls.groundY,
    n = [3, 6, 8, 12][d],
    rearDepth = north ? 19 : 7;
  const angle = north ? 0 : Math.PI;
  for (const x of g.sideCenters) {
    const q = local(o, x, g.front, angle),
      outside = dShape(6.3, rearDepth, n),
      inside = dShape(3.3, rearDepth - 2, n);
    ring(q, outside, inside, base, g.top, { skipBack: north });
    if (d >= 2) for (const sign of [-1, 1]) rect(q, sign * 5.8, g.top, 1.2, 1.5, 0.6, 1, 'coping');
  }
  const cx = g.center[0],
    opening = { x: cx, width: 3.5, sill: base, head: 5.3 };
  pierced(o, cx, g.front, 4.3, base, g.top, 2.2, [opening], d);
  if (north) {
    pierced(o, cx, g.rear, 25.6, base, 6.5, 2.2, [{ ...opening, head: 5.2 }], d);
    pierced(
      o,
      cx,
      g.rear,
      25.6,
      6.5,
      14.2,
      2.2,
      Array.from({ length: 5 }, (_, i) => ({
        x: cx + (i - 2) * 4.9,
        width: 3.1,
        sill: 7.6,
        head: 11.8,
        segmental: true,
      })),
      d,
    );
    for (const [x, z] of g.rearTowers) {
      if (d) circular(o, x, z, 3.2, base, g.rearTowerTop - 0.6, [6, 8, 12, 16][d], d);
      else ring(o, circle(x, z, 3.2, 6), undefined, base, g.rearTowerTop, { solid: true });
    }
  } else if (d) {
    // Abandoned rear accommodation survives as low foundations, not a roofed hall.
    for (const [x, z] of g.rearTowers)
      circular(o, x, z, 3.1, base, g.rearTowerTop, [4, 8, 12, 16][d], 0);
    for (const sign of [-1, 1]) {
      wall(
        o,
        [cx + sign * 2.2, g.rear],
        [cx + sign * 13, g.rear],
        base,
        1.1,
        1,
        'weathered',
        'weathered',
        d,
      );
      wall(
        o,
        [cx + sign * 13, g.rear],
        [cx + sign * 13, 20.6],
        base,
        1.1,
        1,
        'weathered',
        'weathered',
        d,
      );
    }
  }
}
function build(o, d) {
  const c = frame.controls,
    ground = c.groundY;
  for (const i of [0, 1, 6, 7, 8]) {
    const a = c.outerRing[i],
      b = c.outerRing[(i + 1) % c.outerRing.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const offset = [(6 * (b[1] - a[1])) / length, (6 * (a[0] - b[0])) / length];
    cap(
      o,
      [a, b, [b[0] + offset[0], b[1] + offset[1]], [a[0] + offset[0], a[1] + offset[1]]],
      0.04,
      'water',
    );
  }
  cap(
    o,
    [
      [-24, 39],
      [12, 43],
      [12, 72.15],
      [-24, 64],
    ],
    0.04,
    'water',
  );
  cap(o, c.outerRing, ground, 'grass');
  for (let i = 0; i < c.outerRing.length; i++) {
    const a = c.outerRing[i],
      b = c.outerRing[(i + 1) % c.outerRing.length];
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], ground, b[1]],
        [a[0], ground, a[1]],
      ],
      'grass',
      'foliage',
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  for (const t of c.innerTowers)
    circular(o, ...t.center, t.radius, ground, t.top, [6, 12, 16, 24][d], d);
  for (const [a, b] of c.innerWalls) wall(o, a, b, ground, 12.7, 4.5, 'stone', 'limestone', d);
  gate(o, c.northGate, d, true);
  gate(o, c.southGate, d, false);
  for (let i = 0; i < c.outerRing.length; i++) {
    const a = c.outerRing[i],
      b = c.outerRing[(i + 1) % c.outerRing.length];
    if (i === 5) {
      wall(o, a, [-7.5, 42], ground, 5.9, 1.6, 'stone', 'limestone', d);
      wall(o, [-17, 40], b, ground, 5.9, 1.6, 'stone', 'limestone', d);
    } else if (i === 1) {
      wall(o, a, [15, -67.7], ground, 5.9, 1.6, 'stone', 'limestone', d);
      wall(o, [28, -63.7], b, ground, 5.9, 1.6, 'stone', 'limestone', d);
    } else wall(o, a, b, ground, 5.9, 1.6, 'stone', 'limestone', d);
  }
  for (const [i, [x, z, r]] of c.outerTowers.entries()) {
    if (d === 0 && [1, 4, 6, 11].includes(i)) continue;
    circular(o, x, z, r, ground, 6.7, [6, 8, 12, 16][d], d, true);
  }
  // Sea gate uses two broader polygonal defensive towers, completing the16-tower circuit.
  for (const [x, z] of [
    [-18.5, 41.8],
    [-8.1, 44],
  ]) {
    const q = local(o, x, z),
      loop = [
        [-2.8, -3.2],
        [2.8, -3.2],
        [3.4, 1.8],
        [0, 3.4],
        [-3.4, 1.8],
      ],
      hole = loop.map(([u, v]) => [u * 0.55, v * 0.55]);
    ring(q, loop, hole, ground, 8.3, { solid: d === 0 });
  }
  wall(o, [-17, 43], [-12.9, 44], ground, 6.2, 1.8, 'stone', 'limestone', d);
  aperture(o, -12.5, 44, ground, ground, 3.8, 4.8, 6.2, 1.8, d);
  wall(o, [-10.6, 44], [-8.1, 44], ground, 6.2, 1.8, 'stone', 'limestone', d);
  for (let i = 1; i < c.dockWall.length; i++)
    wall(o, c.dockWall[i - 1], c.dockWall[i], 0, 5.1, 1.5, 'weathered', 'weathered', d);
  for (let i = 0; i < c.barbican.length; i++) {
    const a = c.barbican[i],
      b = c.barbican[(i + 1) % c.barbican.length];
    if (i === 0 || i === 2) continue;
    wall(o, a, b, ground, 5.7, 1.5, 'stone', 'limestone', d);
  }
  if (d >= 1) {
    for (let i = 0; i < c.llanfaes.length; i += 2)
      wall(o, c.llanfaes[i], c.llanfaes[i + 1], ground, 1.4, 1.5, 'weathered', 'weathered', d);
    // Broad gravel approach and a plain modern timber crossing, without thin railings.
    cap(
      o,
      [
        [-14, 44],
        [-10, 44],
        [-10, 56],
        [-14, 56],
      ],
      ground + 0.04,
      'paving',
    );
    rect(o, -12, ground, 52, 4, 0.4, 8, 'wood', 'wood');
    cap(
      o,
      [
        [-1.2, 28],
        [2.8, 28],
        [2.8, -29],
        [-1.2, -29],
      ],
      ground + 0.03,
      'paving',
    );
  }
  if (d >= 2) {
    // Low visible hall/stable footing lines; dashed lost structures are not raised.
    for (const [a, b] of [
      [
        [-25, 4],
        [-25, 18],
      ],
      [
        [26, -30],
        [26, 16],
      ],
      [
        [26, 16],
        [31, 16],
      ],
    ])
      wall(o, a, b, ground, 0.95, 0.7, 'weathered', 'weathered', d);
    for (const sign of [-1, 1]) {
      // A few large exposed doorway bays in the inner curtains; recess panels, no tiny loops.
      const q = local(o, sign * 28.7, -23, sign > 0 ? -Math.PI / 2 : Math.PI / 2);
      rect(q, 0, ground + 0.05, 0, 2, 3.2, 0.18, 'weathered', 'weathered');
    }
  }
}
export const buildBeaumarisRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildBeaumarisSkyline = (o) =>
  build(
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
            c.map((v) => v * (s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
    0,
  );
export const beaumarisStudy = {
  id: 'N0283',
  key: 'beaumaris_castle',
  title: 'Beaumaris Castle',
  category: 'castle',
  wikidataId: 'Q756815',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildBeaumarisRuntime(o),
  brief:
    'Present-day roofless concentric castle:six squat inner towers,twin-D gatehouses,five north-hall openings,lower outer tower circuit,offset sea gate,low unfinished foundations and moat/dock study.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: beaumarisPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 4,
    identityFeatures: [
      'Squat six-tower inner ward with two twin-D gatehouses',
      'Lower concentric outer tower circuit around grass wards',
      'Offset sea gate,moat and surviving dock wall',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/48296427 exactQ756815',
    mappedOuterPlanMeters: [144.312, 106.348],
    innerTowers: 6,
    outerTowers: 16,
    measuredTowerHeight: null,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cached mapped outer castle/dock perimeter and primary30m scale-bar plan;internal plan controls approximate and all vertical dimensions estimated.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license. Cached OSM data © OpenStreetMap contributors,ODbL-1.0. Cadw research images linked only,not redistributed.',
  dataAttribution: '© OpenStreetMap contributors;Cadw,Welsh Government architectural references.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Plan frame disambiguated toward sea dock;internal plan,elevations,moat,terrain and exact replacement fit remain unverified.',
    reviewStatus: 'Inactive geographic draft;review pending',
  }),
  geographicNote:
    'Approximate mapped-plan exterior. Ground and heights estimated;heading toward mapped dock. Inactive until whole-site/terrain review.',
  limitations: refs.limitations,
  importReason:
    'Keep the roofless concentric wards,six inner towers and open north-hall/sea-gate identity in compact shared-material levels.',
  mediumFiContext: { scale: '1.5', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-110, 90, 130], lookAt: [0, 4, -8], fov: 43 },
  qaCameras: [
    {
      name: 'concentric-wards-and-six-inner-towers',
      position: [-110, 100, 95],
      lookAt: [0, 5, -14],
    },
    { name: 'north-hall-five-openings', position: [0.3, 8, -5], lookAt: [0.3, 9, -35] },
    { name: 'south-unfinished-gate', position: [-38, 15, 52], lookAt: [0, 5, 22] },
    { name: 'sea-gate-and-dock', position: [-44, 25, 80], lookAt: [-6, 4, 45] },
    { name: 'lower-outer-defenses-and-moat', position: [-120, 14, -64], lookAt: [-40, 5, -35] },
    { name: 'north-llanfaes-foundations', position: [34, 19, -101], lookAt: [20, 3, -65] },
  ],
};
