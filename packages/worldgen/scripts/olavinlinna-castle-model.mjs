/** Olavinlinna: three individual towers, island curtains, ranges and mapped pontoon approach. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/ud/udu/n0315_olavinlinna_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const outline = frame.reconstruction.castleOutline;
const towers = frame.reconstruction.towers;
const palette = {
  stone: '#c9c3aa',
  rock: '#a8a493',
  roof: '#738e7c',
  brick: '#bd8e6f',
  wood: '#938576',
  canvas: '#eee9d8',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, linear(v)]));
const norm = (v) => {
  const m = Math.hypot(...v);
  return v.map((n) => n / m);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
export function olavinlinnaGround(x, z) {
  const ch = Math.cos(frame.reconstruction.castleHeading),
    sh = Math.sin(frame.reconstruction.castleHeading);
  [x, z] = [x * ch + z * sh, -x * sh + z * ch];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Olavinlinna footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function rotateTarget(out) {
  const h = frame.heading - frame.reconstruction.castleHeading,
    c = Math.cos(h),
    s = Math.sin(h);
  return {
    addTriangle(slot, ref, points, _normal, uv, color) {
      const p = points.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c].map(Math.fround));
      out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
}
function ring(x, z, r, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => [
    x + Math.cos(phase + (i * 2 * Math.PI) / n) * r,
    z + Math.sin(phase + (i * 2 * Math.PI) / n) * r,
  ]);
}
function annulus(face, outer, inner, y, s = 'stone') {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    face(s, [at(outer[i], y), at(outer[j], y), at(inner[j], y), at(inner[i], y)], [0, 1, 0]);
  }
}
function shell(out, detail, tower) {
  const {
    center: [x, z],
    radius: r,
    stoneTop,
    arcadeTop,
    roofTop,
  } = tower;
  const face = writer(out, detail),
    n = [8, 8, 12, 24, 32][detail],
    outer = ring(x, z, r, n),
    inner = ring(x, z, r - 1.4, n);
  if (detail === 0) {
    solid(face, outer, base, stoneTop, 'stone');
    const tint = (s, p, n) => face(s, p, n, colors.brick);
    solid(tint, outer, stoneTop, arcadeTop, 'stone');
    for (let i = 0; i < n; i++)
      face(
        'roof',
        [at(outer[i], arcadeTop), at(outer[(i + 1) % n], arcadeTop), [x, roofTop, z]],
        [0, 1, 0],
      );
    return;
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = outer[i],
      b = outer[j],
      mid = a.map((v, k) => (v + b[k]) / 2),
      u = norm(b.map((v, k) => v - a[k]));
    const shellRing = [a, b, inner[j], inner[i]],
      holes = [];
    if (detail >= 2 && i % Math.round(n / 8) === 0)
      for (const y of detail === 2 ? [23.1] : [7.5, 15.7, 23.1]) {
        if (y + 1.4 < stoneTop)
          holes.push(
            aperture(
              {
                center: mid,
                axis: u,
                depth: 3.3,
                width: 0.62,
                height: 1.1,
                bottom: y,
                shape: 'rectangle',
              },
              detail,
            ),
          );
      }
    const target = adapter(out, 'stone'),
      cut = writer(openingBuilder(target, holes), detail);
    solid(cut, shellRing, base, stoneTop, 'stone');
    openingReveals(target, shellRing, base, () => stoneTop, holes, colors.stone);
    const arcadeRing = [a, b, inner[j], inner[i]],
      width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bandSurface = detail <= 1 ? 'stone' : 'brick',
      bandColor = colors.brick;
    const arch =
      detail >= 1 && (detail !== 1 || i % 2 === 0)
        ? [
            aperture(
              {
                center: mid,
                axis: u,
                depth: 3.3,
                width: Math.min(1.28, width * 0.55),
                height: 1.6,
                spring: 0.8,
                bottom: stoneTop + 0.55,
                shape: 'round',
              },
              detail,
            ),
          ]
        : [];
    const bandTarget = adapter(out, bandSurface),
      band = writer(openingBuilder(bandTarget, arch), detail);
    // Tint the merged distant masonry band reddish without adding another draw.
    const tinted = (s, p, n) => band(s, p, n, s === bandSurface ? bandColor : colors[s]);
    solid(tinted, arcadeRing, stoneTop, arcadeTop, bandSurface);
    openingReveals(
      bandTarget,
      arcadeRing,
      () => stoneTop,
      () => arcadeTop,
      arch,
      detail === 0 ? bandColor.map((v, k) => v * means.brick[k]) : bandColor,
    );
  }
  annulus(face, ring(x, z, r + 0.24, n), ring(x, z, r - 1.7, n), arcadeTop, 'stone');
  const eaves = ring(x, z, r + 0.48, n);
  for (let i = 0; i < n; i++)
    face(
      'roof',
      [at(eaves[i], arcadeTop + 0.18), at(eaves[(i + 1) % n], arcadeTop + 0.18), [x, roofTop, z]],
      [0, 1, 0],
    );
  if (detail >= 2) {
    // Large conical-panel seams, kept coarse enough to draw at this level.
    for (let i = 0; i < n; i += detail === 2 ? 2 : 1)
      beam(face, at(eaves[i], arcadeTop + 0.25), [x, roofTop + 0.06, z], 0.13, 0.12, 'roof');
    box(face, x, z, 0.22, 0.22, roofTop, roofTop + 0.8, 'roof');
    annulus(face, ring(x, z, r + 0.18, n), ring(x, z, r - 0.02, n), stoneTop - 0.2, 'brick');
  }
  if (detail >= 3 && tower === towers[0])
    beam(face, [x, roofTop, z], [x, roofTop + 5, z], 0.17, 0.17, 'wood');
}
function roofRange(out, detail, a, b, width, top, rise, windowCount = 0) {
  const u = norm(b.map((v, i) => v - a[i])),
    n = [-u[1], u[0]],
    point = (p, side) => p.map((v, i) => v + (n[i] * side * width) / 2),
    edge = [point(a, -1), point(b, -1), point(b, 1), point(a, 1)];
  const face = writer(out, detail);
  for (let side = 0; side < 4; side++) {
    const p = edge[side],
      q = edge[(side + 1) % 4],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]),
      holes = [];
    if (detail >= 2 && len > 12) {
      const count = Math.max(2, Math.round(len / (detail === 2 ? 12 : 6)));
      for (let i = 0; i < count; i++) {
        const m = p.map((v, k) => v + ((q[k] - v) * (i + 0.5)) / count);
        holes.push({ center: m, width: 0.8, height: 1.35, bottom: top - 4.2, shape: 'rectangle' });
        if (detail >= 3)
          holes.push({
            center: m,
            width: 0.58,
            height: 0.9,
            bottom: top - 8.6,
            shape: 'rectangle',
          });
      }
    }
    wall(out, detail, p, q, 1.2, base, top, 'stone', holes);
  }
  // Open interiors are unmodeled; the roof conceals them from exterior cameras.
  const ra = [a[0], top + rise, a[1]],
    rb = [b[0], top + rise, b[1]];
  face('roof', [at(edge[0], top + 0.1), at(edge[1], top + 0.1), rb, ra], [0, 1, 0]);
  face('roof', [ra, rb, at(edge[2], top + 0.1), at(edge[3], top + 0.1)], [0, 1, 0]);
  face('stone', [at(edge[0], top), ra, at(edge[3], top)], [-u[0], 0, -u[1]]);
  face('stone', [at(edge[1], top), at(edge[2], top), rb], [u[0], 0, u[1]]);
  if (detail >= 2) beam(face, ra, rb, 0.2, 0.24, 'roof');
}
function curtains(out, detail) {
  const face = writer(out, detail),
    omit = new Set([
      5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
  for (let i = 0; i < outline.length; i++) {
    if (omit.has(i)) continue;
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.65) continue;
    const high = i === 12 || i === 13 || i === 21 || i === 22 || i === 31 || i === 32 || i === 33,
      top = high ? 17.3 : i >= 34 && i <= 40 ? 7.6 : 4.8;
    const holes = [];
    if (detail >= 2 && len > 5) {
      const count = Math.max(1, Math.round(len / (detail === 2 ? 12 : 8)));
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * (j + 0.5)) / count);
        holes.push({
          center: p,
          width: high ? 0.7 : 1.15,
          height: high ? 1.2 : 1.7,
          spring: high ? 0.6 : 1,
          bottom: high ? 11.2 : base(p) + 2.2,
          shape: 'round',
        });
      }
    }
    // The actual approach meets this short western gate wall.
    if (i >= 56 && i <= 59) {
      holes.length = 0;
      holes.push({
        center: [-72.65, -23.4],
        axis: [-0.07, -1],
        depth: 4,
        width: 2.8,
        height: 3.2,
        spring: 2.15,
        bottom: -3.7,
        shape: 'round',
      });
    }
    wall(out, detail, a, b, high ? 2.1 : 1.4, base, top, 'stone', holes);
    if (detail >= 1 && len > 5) {
      const u = norm(b.map((v, k) => v - a[k])),
        normal = [-u[1], u[0]];
      // Raised narrow parapet keeps the low terraces distinct from the upper ranges.
      const pa = a.map((v, k) => v + normal[k] * 0.1),
        pb = b.map((v, k) => v + normal[k] * 0.1);
      wall(out, detail, pa, pb, 0.65, top, top + 1.1, 'stone', []);
    }
  }
  if (detail >= 1) {
    // True broad arch openings in the raised east-facing rampart.
    const a = [65.9, -31.6],
      b = [71.4, -7.7],
      len = Math.hypot(...b.map((v, i) => v - a[i]));
    const holes = Array.from({ length: detail === 1 ? 3 : 5 }, (_, i, arr) => ({
      center: a.map((v, k) => v + ((b[k] - v) * (i + 0.5)) / (detail === 1 ? 3 : 5)),
      width: detail === 1 ? 3.8 : 2.65,
      height: 2.4,
      spring: 1.25,
      bottom: 14.9,
      shape: 'round',
    }));
    wall(out, detail, a, b, 1.3, 13.8, 18, 'stone', holes);
  }
  if (detail >= 2) {
    for (const [a, b] of [
      [
        [42, 3],
        [57, 7],
      ],
      [
        [-59, 7],
        [-48, 7],
      ],
      [
        [-9, 26],
        [3, 32],
      ],
    ])
      roofRange(out, detail, a, b, 3.5, 5.4, 0.65);
  }
}
function stairTower(out, detail) {
  const face = writer(out, detail),
    x = -18.32,
    z = 3.9,
    r = 4.7,
    n = [6, 8, 12, 16, 20][detail];
  const p = ring(x, z, r, n);
  solid(face, p, base, 18.2);
  const eaves = ring(x, z, r + 0.24, n);
  for (let i = 0; i < n; i++)
    face('roof', [at(eaves[i], 18.4), at(eaves[(i + 1) % n], 18.4), [x, 21.6, z]], [0, 1, 0]);
}
function festivalCanopy(out, detail) {
  const face = writer(out, detail),
    eave = 11.5;
  if (detail <= 1) {
    const p = [
        [-6, -6],
        [8, -26],
        [34, -28],
        [39, 1],
        [27, 8],
        [12, 10],
        [-7, 5],
      ],
      peak = [17, 17.5, -9];
    for (let i = 0; i < p.length; i++)
      face('canvas', [at(p[i], eave), at(p[(i + 1) % p.length], eave), peak], [0, 1, 0]);
    return;
  }
  // Three connected saddle bays retain the picture's peaked white canopy.
  const rows = [
    [-7, -6],
    [8, -26],
    [34, -28],
    [39, 1],
    [27, 8],
    [12, 10],
    [-7, 5],
  ];
  const cells = [
    { ring: [rows[0], rows[1], [16, -27], [15, 9], rows[5], rows[6]], peak: [3, 18.2, -9] },
    { ring: [[16, -27], rows[2], [36, 0], [27, 8], [15, 9]], peak: [26, 18.8, -11] },
    { ring: [[36, 0], rows[3], rows[4], [27, 8]], peak: [32, 15.8, 3] },
  ];
  for (const cell of cells)
    for (let i = 0; i < cell.ring.length; i++) {
      const a = at(cell.ring[i], eave),
        b = at(cell.ring[(i + 1) % cell.ring.length], eave),
        p = cell.peak;
      if (detail >= 3) {
        const m = a.map((v, k) => (v + b[k] + p[k]) / 3);
        m[1] -= 0.55;
        face('canvas', [a, b, m], [0, 1, 0]);
        face('canvas', [b, p, m], [0, 1, 0]);
        face('canvas', [p, a, m], [0, 1, 0]);
      } else face('canvas', [a, b, p], [0, 1, 0]);
      if (detail >= 3) beam(face, a, p, 0.13, 0.13, 'canvas');
    }
  if (detail >= 2)
    for (const p of rows) beam(face, at(p, base(p)), at(p, eave), 0.22, 0.22, 'wood');
}
function pontoon(out, detail) {
  const face = writer(out, detail),
    path = frame.reconstruction.bridge.castle;
  // The deck is level across the floating section; approach heights are estimated.
  for (let i = 0; i < path.length - 1; i++) {
    const y0 = -6,
      y1 = i === path.length - 2 ? -3.5 : -6;
    const level = (p) => {
      const a = path[i],
        b = path[i + 1],
        u = b.map((v, k) => v - a[k]),
        t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
      return y0 + ((y1 - y0) * t) / (u[0] * u[0] + u[1] * u[1]);
    };
    const a = path[i],
      b = path[i + 1],
      u = norm(b.map((v, k) => v - a[k])),
      normal = [-u[1], u[0]],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    beam(face, at(a, y0), at(b, y1), 3.0, 0.32, 'wood');
    if (detail >= 1) {
      const count = Math.max(1, Math.round(len / 5));
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * (j + 0.5)) / count);
        const left = p.map((v, k) => v - normal[k] * 2.25),
          right = p.map((v, k) => v + normal[k] * 2.25);
        beam(face, at(left, level(p) - 0.75), at(right, level(p) - 0.75), 1.8, 0.9, 'wood');
      }
    }
    if (detail >= 2) {
      for (const sign of [-1, 1]) {
        const pa = a.map((v, k) => v + normal[k] * sign * 1.4),
          pb = b.map((v, k) => v + normal[k] * sign * 1.4);
        beam(face, at(pa, y0 + 1.02), at(pb, y1 + 1.02), 0.15, 0.15, 'wood');
        const count = Math.max(1, Math.round(len / (detail >= 3 ? 3.5 : 6)));
        for (let j = 0; j <= count; j++) {
          const p = pa.map((v, k) => v + ((pb[k] - v) * j) / count);
          beam(face, at(p, level(p) + 0.12), at(p, level(p) + 1.1), 0.14, 0.14, 'wood');
        }
      }
    }
  }
}
function rockBank(out, detail) {
  const face = writer(out, detail),
    p = frame.reconstruction.landParts.rock.outline;
  const center = [-12, -42],
    n = detail === 0 ? 1 : detail === 1 ? 2 : detail === 2 ? 4 : 7;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      count =
        detail <= 1 ? 1 : Math.max(1, Math.ceil(Math.hypot(...b.map((v, k) => v - a[k])) / 5));
    for (let j = 0; j < count; j++) {
      const x = a.map((v, k) => v + ((b[k] - v) * j) / count),
        z = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count);
      for (let k = 0; k < n; k++) {
        const t0 = k / n,
          t1 = (k + 1) / n,
          q = (v, t) => v.map((w, k) => w + (center[k] - w) * t);
        const pts = [q(x, t0), q(z, t0), q(z, t1), q(x, t1)];
        face(
          detail <= 1 ? 'stone' : 'rock',
          pts.map((p) => at(p, olavinlinnaGround(...p) + (detail <= 1 ? 1.3 : 0.45))),
          [0, 1, 0],
          colors.rock,
        );
      }
    }
  }
}
function build(target, detail) {
  const out = rotateTarget(target);
  rockBank(out, detail);
  curtains(out, detail);
  roofRange(out, detail, [-54, -28], [-21, -28], 15.2, 19.0, 3.0);
  roofRange(out, detail, [-53, -28], [-47, -10], 13.5, 18.1, 2.8);
  roofRange(out, detail, [-48, -8], [-20, 2], 11.6, 17.5, 3.0);
  roofRange(out, detail, [10, -22], [34, -24], 10.0, 11.4, 2.3);
  for (const tower of towers) shell(out, detail, tower);
  stairTower(out, detail);
  festivalCanopy(out, detail);
  pontoon(out, detail);
}
export const buildOlavinlinnaSkyline = (out) => build(out, 0);
export const buildOlavinlinnaDistrict = (out) => build(out, 1);
export const buildOlavinlinnaStreet = (out) => build(out, 2);
export const buildOlavinlinnaCloseup = (out) => build(out, 3);
const camera = scope.camera;
const rotateCamera = ({ position, lookAt, ...rest }) => {
  const h = frame.heading - frame.reconstruction.castleHeading,
    c = Math.cos(h),
    s = Math.sin(h),
    p = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
  return { ...rest, position: p(position), lookAt: p(lookAt) };
};
export const olavinlinnaStudy = {
  id: 'N0315',
  key: 'olavinlinna_castle',
  title: 'Olavinlinna Castle',
  category: 'castle',
  wikidataId: 'Q251272',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  importReason:
    'Preserve Olavinlinna’s three tower positions, open arcade bands, roofed inner ranges, low waterside bastions and actual dogleg pontoon bridge as four independently authored browser levels.',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Olavinlinna island castle: three rubble-stone cylindrical towers, reddish open arcade crowns and muted green conical roofs; stepped curtains, broad roofed ranges, small round stair tower, low angular bastions, rock bank and narrow mapped pontoon bridge. The large courtyard retains an approximate light festival canopy visible in the linked photographs.',
  sourceFacts: {
    horizontalBasis:
      'Current standard viewer named castle, bridge and land controls plus retained exact-QID compound ring/holes.',
    architecturalHeights: 'Picture-led estimates, not surveyed elevations.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped163x88m compound and three tower bulges; actual pontoon bridge topology and bearing.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six canonical256-square graphs supply rubble stone, granite rock, green metal panels, brick, wood and canvas. Metric UVs and linear tints; no bespoke bitmap or embedded photograph.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Three round towers with brick arcades and shallow green cones',
      'High inner stone ranges and lower angular lake-facing bastions',
      'Mapped dogleg pontoon approach, north rock bank and multi-peaked courtyard canopy',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  previewEntities: scope.previewEntities,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Architectural heights, roof/range plans, openings, rock bank profile and small stair tower are exterior-picture approximations; not a measured conservation model.',
    'The seasonal courtyard canopy is a fixed approximate visual representation, not a year-round claim or engineered structure. Interiors, furnishings, festival seats and certified walkable collision are excluded.',
    'Standard viewer terrain is coarse. Preview PMTiles lake-mask clipping and review water level are explicit fixture approximations, not runtime terrain carving or verified real shoreline/deck elevation. Pontoon water contact and precise entrance joins remain approximate.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera,
  qaCameras: [
    {
      name: 'three-towers-and-rock-bank',
      position: [-12, 49, -120],
      lookAt: [-8, 15, -25],
      fov: 44,
    },
    { name: 'pontoon-and-western-gate', position: [-150, 18, -50], lookAt: [-65, 8, -22], fov: 42 },
    {
      name: 'western-pair-and-inner-range',
      position: [-80, 49, 50],
      lookAt: [-38, 17, -15],
      fov: 44,
    },
    { name: 'eastern-tower-and-canopy', position: [95, 56, 62], lookAt: [30, 15, -5], fov: 43 },
    { name: 'brick-arcade-crown', position: [-71, 36, -49], lookAt: [-51, 31, -32], fov: 45 },
    { name: 'mapped-compound-plan', position: [-24, 240, 0.1], lookAt: [-24, 0, 0], fov: 44 },
  ].map(rotateCamera),
};
const base = (p) => olavinlinnaGround(...p) - 0.3;
function adapter(out, surface = 'stone') {
  return {
    addTriangle(s, ref, p, n, uv, c) {
      out.addTriangle(s === 'rubble' ? surface : s, ref, p, n, uv, c);
    },
  };
}
function writer(out, detail) {
  return (s, poly, direction, tint = colors[s]) => {
    let p = poly.map((p) => p.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * direction[i], 0) < 0)
      p = p.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[s][i]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, k) => v - tri[0][k]),
            tri[2].map((v, k) => v - tri[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        s,
        'palette:#ffffff',
        tri,
        n,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, ring, y, s = 'stone') {
  const ids = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      s,
      ids.slice(i, i + 3).map((k) => at(ring[k], y)),
      [0, 1, 0],
    );
}
function solid(face, ring, b, t, s = 'stone') {
  const sign = Math.sign(
    ring.reduce((n, a, i) => {
      const c = ring[(i + 1) % ring.length];
      return n + a[0] * c[1] - c[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      c = ring[(i + 1) % ring.length];
    face(
      s,
      [at(a, b), at(c, b), at(c, t), at(a, t)],
      [(c[1] - a[1]) * sign, 0, (a[0] - c[0]) * sign],
    );
  }
  cap(face, ring, t, s);
}
const box = (face, x, z, w, d, b, t, s = 'stone') => solid(face, rect(x, z, w, d), b, t, s);
function beam(face, a, b, w, d, s = 'stone') {
  const n = norm(b.map((v, i) => v - a[i])),
    u = norm(cross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(n, u);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => p.map((q, i) => q + (u[i] * x * w + v[i] * z * d) / 2));
  const ra = ring(a),
    rb = ring(b);
  for (let i = 0; i < 4; i++)
    face(
      s,
      [ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]],
      ra[i].map((q, j) => q - a[j]),
    );
  face(
    s,
    ra,
    n.map((v) => -v),
  );
  face(s, rb, n);
}
function aperture(h, detail) {
  const p = prepareOpening(h, 0, detail);
  if (h.shape !== 'circle') return p;
  p.ring = Array.from({ length: detail <= 1 ? 8 : 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / (detail <= 1 ? 8 : 12);
    return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
  });
  p.planes = p.planes.slice(0, 2);
  for (let i = 0; i < p.ring.length; i++) {
    const a = p.ring[i],
      b = p.ring[(i + 1) % p.ring.length],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    p.planes.push([
      -dv * p.axis[0],
      du,
      -dv * p.axis[1],
      dv * (h.center[0] * p.axis[0] + h.center[1] * p.axis[1] + a[0]) - du * a[1],
    ]);
  }
  return p;
}
/** A thick wall segment with genuine apertures and exposed jambs, not painted dark windows. */
function wall(out, detail, a, b, thickness, bottom, top, s = 'stone', holes = []) {
  const u = norm([b[0] - a[0], b[1] - a[1]]),
    n = [-u[1], u[0]],
    ring = [
      a.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v - (n[i] * thickness) / 2),
      a.map((v, i) => v - (n[i] * thickness) / 2),
    ];
  if (typeof top === 'function' && typeof bottom !== 'function') {
    for (const i of [2, 0]) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      ring.splice(
        i + 1,
        0,
        a.map((v, k) => (v + b[k]) / 2),
      );
    }
  }
  const prepared = holes.map((h) =>
    aperture({ axis: u, depth: thickness + 1, shape: 'pointed', ...h }, detail),
  );
  const target = adapter(out, s),
    face = writer(openingBuilder(target, prepared), detail);
  solid(face, ring, bottom, top, s);
  openingReveals(
    target,
    ring,
    (p) => (typeof bottom === 'function' ? bottom(p) : bottom),
    (p) => (typeof top === 'function' ? top(p) : top),
    prepared,
    detail === 0 ? colors[s].map((v, i) => v * means[s][i]) : colors[s],
  );
  if (detail >= 3) {
    const trim = writer(target, detail);
    for (const h of prepared)
      for (let i = 0; i < h.ring.length; i++) {
        if (h.shape === 'circle' || i > 0) {
          const r = h.ring[i],
            q = h.ring[(i + 1) % h.ring.length];
          for (const sign of [-1, 1]) {
            if (detail === 2) {
              const du = q[0] - r[0],
                dv = q[1] - r[1],
                m = Math.hypot(du, dv),
                u = (-dv * 0.1) / m,
                v = (du * 0.1) / m,
                d = sign * (thickness / 2 + 0.12);
              trim(
                s,
                [
                  h.point(r[0] + u, r[1] + v, d),
                  h.point(q[0] + u, q[1] + v, d),
                  h.point(q[0] - u, q[1] - v, d),
                  h.point(r[0] - u, r[1] - v, d),
                ],
                [h.normal[0] * sign, 0, h.normal[1] * sign],
              );
            } else
              beam(
                trim,
                h.point(...r, sign * (thickness / 2 + 0.1)),
                h.point(...q, sign * (thickness / 2 + 0.1)),
                0.2,
                0.23,
                s,
              );
          }
        }
      }
  }
}
