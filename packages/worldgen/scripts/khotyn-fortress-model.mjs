/** Khotyn's inner citadel, reconstructed from the reserve's plan and inventory. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

export const khotynPalette = {
  stone: '#bbb7a2',
  brick: '#ab5944',
  roof: '#626d7f',
  wood: '#a08459',
  cream: '#ded9bd',
  recess: '#424c54',
  paving: '#aaa894',
};
const colors = Object.fromEntries(
  Object.entries(khotynPalette).map(([key, hex]) => [
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
const rect = (o, slot, x, y, z, w, h, d, color = 'stone') =>
  box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[color]);
function face(o, slot, p, color) {
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors[color],
    );
  }
}
function local(o, x, z, a = 0) {
  const cs = Math.cos(a),
    sn = Math.sin(a);
  const rotate = ([u, y, v]) => [u * cs + v * sn, y, -u * sn + v * cs];
  const point = (p) => {
    const r = rotate(p);
    return [r[0] + x, r[1], r[2] + z];
  };
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) => o[k](s, r, p.map(point), rotate(n), uv, c),
    ]),
  );
}
// Clockwise in the X/Z plane; the long axis runs approximately NNW/SSE.
const outline = [
  [-9, -44],
  [-19, -38],
  [-25, -22],
  [-29, -2],
  [-27, 20],
  [-24, 32],
  [-13, 41],
  [5, 44],
  [17, 35],
  [24, 16],
  [24, -5],
  [20, -25],
  [9, -44],
];
function hip(o, x, z, w, d, eave, peak) {
  const p = [
    [x - w / 2, eave, z - d / 2],
    [x - w / 2, eave, z + d / 2],
    [x + w / 2, eave, z + d / 2],
    [x + w / 2, eave, z - d / 2],
  ];
  // Ridge direction follows the long side, with no coplanar overlapping roof faces.
  const r = Math.max(0, (d - w) * 0.28);
  const a = [x, peak, z - r],
    b = [x, peak, z + r];
  if (r === 0) for (let i = 0; i < 4; i++) face(o, 'shingle', [p[i], p[(i + 1) % 4], a], 'roof');
  else {
    face(o, 'shingle', [p[0], p[1], b, a], 'roof');
    face(o, 'shingle', [p[1], p[2], b], 'roof');
    face(o, 'shingle', [p[2], p[3], a, b], 'roof');
    face(o, 'shingle', [p[3], p[0], a], 'roof');
  }
  face(o, 'shingle', [...p].reverse(), 'roof');
}
function cone(o, x, z, r, eave, peak, n) {
  const ring = radialRing(eave, r, r, n, [x, z]);
  for (let i = 0; i < n; i++)
    face(o, 'shingle', [ring[i], ring[(i + 1) % n], [x, peak, z]], 'roof');
  face(o, 'shingle', [...ring].reverse(), 'roof');
}
function aperture(o, x, y, z, w, h, detail, color = 'cream', arched = false) {
  rect(o, 'recess', x, y, z, w, h, 0.08, 'recess');
  if (detail < 2) return;
  for (const s of [-1, 1])
    rect(o, 'limestone', x + s * (w / 2 + 0.13), y - 0.1, z + 0.055, 0.26, h + 0.3, 0.2, color);
  if (!arched) rect(o, 'limestone', x, y + h, z + 0.07, w + 0.52, 0.28, 0.22, color);
  if (detail === 3) rect(o, 'limestone', x, y - 0.18, z + 0.12, w + 0.65, 0.24, 0.38, color);
}
function archedWindow(o, x, y, z, w, h, detail) {
  aperture(o, x, y, z, w, h - w / 2, detail, 'cream', true);
  const n = detail === 3 ? 6 : 4,
    r = w / 2,
    sy = y + h - r;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      'recess',
      [
        [x, sy, z + 0.065],
        [x + r * Math.cos(a), sy + r * Math.sin(a), z + 0.065],
        [x + r * Math.cos(b), sy + r * Math.sin(b), z + 0.065],
      ],
      'recess',
    );
    if (detail >= 2)
      face(
        o,
        'limestone',
        [
          [x + r * Math.cos(a), sy + r * Math.sin(a), z + 0.14],
          [x + (r + 0.26) * Math.cos(a), sy + (r + 0.26) * Math.sin(a), z + 0.14],
          [x + (r + 0.26) * Math.cos(b), sy + (r + 0.26) * Math.sin(b), z + 0.14],
          [x + r * Math.cos(b), sy + r * Math.sin(b), z + 0.14],
        ],
        'cream',
      );
  }
}
function roundTower(o, x, z, r, top, peak, detail) {
  const n = [8, 12, 20, 28][detail];
  loft(
    o,
    'limestone',
    [
      radialRing(0, r + 0.8, r + 0.8, n, [x, z]),
      radialRing(6, r, r, n, [x, z]),
      radialRing(top, r, r, n, [x, z]),
    ],
    colors.stone,
  );
  cone(o, x, z, r + 1, top, peak, n);
  if (!detail) return;
  const count = detail === 1 ? 6 : 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const g = local(o, x, z, a);
    aperture(g, 0, top - 2.7, r + 0.05, 0.75, 1.65, 1);
    if (detail >= 2) aperture(g, 0, top - 8, r + 0.05, 0.65, 1.4, 1);
  }
}
function squareTower(o, x, z, w, d, top, peak, detail) {
  rect(o, 'limestone', x, 0, z, w, top, d);
  hip(o, x, z, w + 1.6, d + 1.6, top, peak);
  if (!detail) return;
  for (let side = 0; side < 4; side++) {
    const g = local(o, x, z, (side * Math.PI) / 2),
      width = side % 2 ? d : w,
      depth = side % 2 ? w : d;
    const count = Math.max(2, Math.floor(width / 3.2));
    for (let i = 0; i < count; i++)
      aperture(
        g,
        (i - (count - 1) / 2) * (width / (count + 1)),
        top - 2.8,
        depth / 2 + 0.05,
        0.8,
        1.8,
        1,
      );
    if (detail >= 2)
      for (let i = 0; i < 2; i++)
        aperture(g, (i - 0.5) * width * 0.45, top - 8, depth / 2 + 0.05, 0.75, 1.5, 1);
  }
}
function wall(o, a, b, detail, index) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    g = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
  rect(g, 'limestone', 0, 0, 0, len + 0.5, 36, 6);
  // Brick courses are identity geometry, not a baked shadow or individual stones.
  for (const y of detail ? [10, 23, 29] : [10, 29])
    rect(g, 'brick', 0, y, 0, len + 0.55, 0.5, 6.07, 'brick');
  if (!detail) return;
  const count = Math.max(1, Math.floor(len / 4));
  // Outer face is +Z for this winding. Large red crosses/diamonds abstract seven zones.
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * (len / count);
    if (detail >= 2) {
      for (const y of [16, 26])
        for (const sign of [-1, 1])
          beam(
            g,
            'brick',
            [x - 1, y - sign * 1.5, 3.065],
            [x + 1, y + sign * 1.5, 3.065],
            0.38,
            0.12,
            colors.brick,
          );
    } else rect(g, 'brick', x, 14, 3.04, 0.7, 5, 0.08, 'brick');
    aperture(g, x, 32.7, 3.08, 0.55, 1.4, 1);
  }
  // Low parapet protects a continuous walk. Selected buttresses strengthen east river wall.
  rect(g, 'limestone', 0, 36, 2.45, len, 0.8, 1.1);
  if (detail >= 2 && index >= 8) {
    for (const x of [-len * 0.3, len * 0.3])
      loft(
        g,
        'limestone',
        [
          [
            [x - 1.1, 0, 2.9],
            [x - 1.1, 0, 5.4],
            [x + 1.1, 0, 5.4],
            [x + 1.1, 0, 2.9],
          ],
          [
            [x - 0.75, 25, 2.9],
            [x - 0.75, 25, 3.8],
            [x + 0.75, 25, 3.8],
            [x + 0.75, 25, 2.9],
          ],
        ],
        colors.stone,
      );
  }
}
function gate(o, detail) {
  const g = local(o, 5, 44),
    w = 17.5,
    d = 15,
    top = 35.5,
    spring = 27.5,
    r = 2.1;
  rect(g, 'limestone', 0, 0, 0, w, 24, d);
  for (const s of [-1, 1])
    rect(g, 'limestone', (s * (w / 2 + r)) / 2, 24, 0, w / 2 - r, top - 24, d);
  const n = [4, 6, 8, 10][detail];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      x0 = r * Math.cos(a),
      y0 = spring + r * Math.sin(a),
      x1 = r * Math.cos(b),
      y1 = spring + r * Math.sin(b);
    face(
      g,
      'limestone',
      [
        [x1, y1, d / 2],
        [x0, y0, d / 2],
        [x0, top, d / 2],
        [x1, top, d / 2],
      ],
      'stone',
    );
    face(
      g,
      'limestone',
      [
        [x0, y0, -d / 2],
        [x1, y1, -d / 2],
        [x1, top, -d / 2],
        [x0, top, -d / 2],
      ],
      'stone',
    );
    face(
      g,
      'limestone',
      [
        [x0, y0, d / 2],
        [x1, y1, d / 2],
        [x1, y1, -d / 2],
        [x0, y0, -d / 2],
      ],
      'stone',
    );
  }
  hip(g, 0, 0, w + 1.7, d + 1.7, top, 44.2);
  if (detail) {
    for (const a of [0, Math.PI]) {
      const f = local(g, 0, 0, a);
      for (const x of [-5.5, 0, 5.5]) aperture(f, x, 32.1, d / 2 + 0.06, 0.75, 1.5, detail);
      for (const x of [-5.4, 5.4]) aperture(f, x, 25.3, d / 2 + 0.06, 0.7, 1.65, detail);
    }
  }
  // Wooden spans remain visible at every LOD, with an actual open gateway behind them.
  rect(g, 'wood', 0, 23.55, 19.5, 4.2, 0.45, 24, 'wood');
  rect(g, 'limestone', 0, 0, 19.5, 4.5, 23.55, 3.8);
  rect(g, 'wood', 0, 23.55, -11, 4.2, 0.45, 7, 'wood');
  if (detail)
    for (const sign of [-1, 1]) {
      for (const y of [24.55, 25.15]) rect(g, 'wood', sign * 2.1, y, 19.5, 0.22, 0.2, 24, 'wood');
      for (let z = 7.5; z <= 31.5; z += detail === 1 ? 6 : 3)
        rect(g, 'wood', sign * 2.1, 23.8, z, 0.28, 1.65, 0.28, 'wood');
      if (detail >= 2)
        for (const z of [12, 26])
          beam(g, 'wood', [sign * 1.7, 10, 19.5], [sign * 1.7, 23.5, z], 0.45, 0.45, colors.wood);
    }
}
function courtyard(o, detail) {
  // Court slab is below the crenellated enclosure, preserving open air inside the silhouette.
  const p = outline.map(([x, z]) => [x, 24, z]);
  face(o, 'limestone', p, 'paving');
  // West palace and lower veranda; brick field with broad pale checker ornament.
  rect(o, 'brick', -16.5, 24, -21, 10.5, 14.25, 17, 'brick');
  hip(o, -16.5, -21, 11.8, 18.3, 38.25, 43.5);
  rect(o, 'brick', -16.5, 24, -8.5, 8, 7.8, 8, 'brick');
  hip(o, -14.5, -8.5, 12, 10, 33.4, 37.3);
  rect(o, 'wood', -10.8, 29.4, -8.5, 3.5, 0.4, 8, 'wood');
  // Eastern barracks and chapel share one continuous range.
  rect(o, 'limestone', 14.7, 24, 3.5, 15, 10.3, 29, 'cream');
  hip(o, 14.7, 3.5, 16.5, 30.3, 34.3, 41);
  rect(o, 'limestone', 14.7, 24, -19, 8, 13.8, 16, 'cream');
  hip(o, 14.7, -19, 9.5, 17.2, 37.8, 43.8);
  // Well pavilion: square stone piers with open bays, beneath a shingled hip.
  rect(o, 'limestone', -5, 24, 17, 3, 1.1, 3);
  hip(o, -5, 17, 7, 7, 29.5, 32.5);
  for (const x of [-7.45, -2.55])
    for (const z of [14.55, 19.45]) rect(o, 'limestone', x, 24, z, 0.9, 5.5, 0.9);
  if (detail)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const g = local(o, -5, 17, a),
        r = 2,
        sy = 26.8,
        n = detail >= 2 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n;
        const x0 = r * Math.cos(a),
          x1 = r * Math.cos(b),
          y0 = sy + r * Math.sin(a),
          y1 = sy + r * Math.sin(b);
        face(
          g,
          'limestone',
          [
            [x1, y1, 2.9],
            [x0, y0, 2.9],
            [x0, 29.5, 2.9],
            [x1, 29.5, 2.9],
          ],
          'stone',
        );
        face(
          g,
          'limestone',
          [
            [x0, y0, 2.1],
            [x1, y1, 2.1],
            [x1, 29.5, 2.1],
            [x0, 29.5, 2.1],
          ],
          'stone',
        );
        face(
          g,
          'limestone',
          [
            [x0, y0, 2.9],
            [x1, y1, 2.9],
            [x1, y1, 2.1],
            [x0, y0, 2.1],
          ],
          'stone',
        );
      }
    }
  if (!detail) return;
  for (const x of [-12, -9.2])
    for (const z of [-12, -8.5, -5]) rect(o, 'wood', x, 24, z, 0.35, 9, 0.35, 'wood');
  for (const y of [29.9, 30.8]) rect(o, 'wood', -9.2, y, -8.5, 0.25, 0.2, 7.5, 'wood');
  const west = local(o, -11.2, -21, Math.PI / 2);
  for (const x of [-6, -3, 0, 3, 6]) aperture(west, x, 26, 0, 1.15, 2, detail);
  for (const x of [-5, 0, 5]) archedWindow(west, x, 32, 0, 1.35, 2.4, detail);
  if (detail >= 2)
    for (const y of [29.6, 36.4])
      for (let x = -7; x <= 7; x += 1.5)
        rect(west, 'limestone', x, y, 0.03, 0.78, 0.65, 0.14, 'cream');
  const east = local(o, 7.15, 3.5, -Math.PI / 2);
  for (const y of [26, 30.8])
    for (const x of [-10, -5, 0, 5, 10]) aperture(east, x, y, 0, 1.25, 1.7, detail);
  const chapel = local(o, 10.65, -19, -Math.PI / 2);
  for (const x of [-4, 0, 4]) archedWindow(chapel, x, 33, 0, 1.4, 2.6, detail);
  aperture(chapel, 0, 26, 0, 1.8, 3.4, detail);
  if (detail >= 2) {
    // Broad exterior stair reads at block distance; risers only in close-up.
    const n = detail === 3 ? 12 : 4;
    for (let i = 0; i < n; i++)
      rect(o, 'wood', 7.7, 24, -23 + (i * 5) / n, 2.8, ((i + 1) * 5) / n, 5 / n, 'wood');
    rect(o, 'wood', 7.7, 29, -17.3, 2.8, 0.4, 2.3, 'wood');
    for (const z of [-18.5, -16.2]) rect(o, 'wood', 6.5, 24, z, 0.35, 6.4, 0.35, 'wood');
  }
}
export function buildKhotynRuntime(o, level) {
  const detail = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (let i = 0; i < outline.length; i++) {
    // Gate fills the southern opening instead of a wall blocking its passage.
    if (i !== 6 && i !== 7) wall(o, outline[i], outline[(i + 1) % outline.length], detail, i);
  }
  wall(o, [-13, 41], [-3.75, 44], detail, 6);
  wall(o, [13.75, 44], [17, 35], detail, 7);
  courtyard(o, detail);
  roundTower(o, -24, 32, 7, 38.25, 47.25, detail);
  roundTower(o, -25, -22, 4.5, 41, 50, detail);
  squareTower(o, 0, -44, 18, 19, 41.75, 54, detail);
  squareTower(o, 24, -5, 6, 6, 41.5, 49.5, detail);
  gate(o, detail);
}
export const buildKhotynSkyline = (o) =>
  buildKhotynRuntime(
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
            c.map((v) => v * (s === 'recess' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const khotynStudy = {
  id: 'N0260',
  key: 'khotyn_fortress',
  title: 'Khotyn Fortress',
  category: 'castle',
  wikidataId: 'Q141012',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKhotynRuntime(o),
  brief:
    'Five-tower inner citadel with tall curved stone walls, red-brick geometric bands, shingled roofs, open courtyard, palace, chapel, well and wooden entrance bridge. The surrounding Ottoman earthworks are outside this model.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: khotynPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Five differently shaped roofed towers',
      'Tall curved limestone enclosure with red geometric brick bands',
      'Open court, palace, chapel and elevated timber entry bridge',
    ],
  },
  sourceFacts: {
    southwestTowerDiameterMeters: 14,
    northTowerPlanMeters: [18, 19],
    eastTowerPlanMeters: [6, 6],
    palacePlanMeters: [17, 10.5],
    barracksPlanMeters: [29, 15],
    wellRoofPlanMeters: [7, 7],
    publishedHeightsUseDifferentDatums: true,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'State reserve architectural inventory, photographs and axonometric plan; exact-QID OSM identity for the wider fortress',
    scope: 'Inner citadel exterior and entrance bridge',
    referenceState:
      'Conserved present-day fortress; construction fittings and temporary exhibits omitted',
  },
  scaleBasis:
    'Published component dimensions; reconstructed inter-tower spacing and wall curves. Tower heights above the courtyard are used, not external rock-datum heights of 55–68m.',
  refs: [
    'https://khotynska-fortecya.cv.ua/mapa_forteci',
    'https://khotynska-fortecya.cv.ua/istoriya-khotynskoyi-fortetsi-en',
    'https://www.openstreetmap.org/relation/8520372',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  dataAttribution:
    'Map identity © OpenStreetMap contributors, ODbL-1.0. Reserve images are linked references, not redistributed textures or geometry.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+Z approximately SSE toward entrance',
    front: '+Z entrance bridge',
    origin: 'Reconstructed citadel center; lowest foundation Y=0, courtyard Y=24',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft citadel anchor and signed heading; real-terrain fit pending',
  }),
  geographicNote:
    'Exact-QID relation covers outer earthworks, not this inner citadel. Candidate coordinate and approximate signed orientation are draft only. Synthetic foundation datum is not a sampled terrain elevation; do not replace the entire relation.',
  limitations: [
    'The native plan is an original reconstruction from the reserve diagram, not a surveyed footprint. West-tower 5m published diameter has an ambiguous internal/external datum; 9m exterior is a photographic estimate.',
    'Foundation depth, courtyard level, bridge piers and adjoining ground are schematic. The wider outer fortress, moat terrain and church beyond the citadel are excluded.',
    'Brick crosses, window rhythm, stairs and wooden fittings are selectively abstracted under medium-fi. Closed interiors and the 50m well shaft are omitted.',
    'Procedural-neighbor context is a style and LOD review, not evidence of geographic fit.',
  ],
  importReason:
    'Preserve medium-fi silhouette and five material groups; authored LODs remove features by viewing distance.',
  mediumFiContext: { scale: '2.4', neighborStyle: 'molen.worldgen.catalog.ukrainian_cottage' },
  camera: { position: [120, 90, 158], lookAt: [0, 22, 2], fov: 43 },
  qaCameras: [
    { name: 'entrance-and-five-towers', position: [65, 57, 138], lookAt: [0, 28, 0] },
    { name: 'river-wall-brick-bands', position: [107, 42, -10], lookAt: [0, 25, -4] },
    { name: 'north-tower-and-west-wall', position: [-83, 67, -110], lookAt: [0, 30, -10] },
    { name: 'courtyard-plan', position: [0, 155, 12], lookAt: [0, 24, 0] },
    { name: 'open-entrance-passage', position: [5, 26, 80], lookAt: [5, 27, 15] },
    { name: 'palace-and-chapel', position: [0, 37, 18], lookAt: [-2, 32, -21] },
  ],
};
