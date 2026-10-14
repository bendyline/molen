/** Tintagel's surviving island/mainland ruins and mapped modern crossing. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/gc/gch/n0311_tintagel_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  means = read('surface-means.json'),
  scope = read('review-scope.json');
const palette = {
  stone: '#b9b5a6',
  floor: '#bcb5a2',
  red: '#985148',
  silver: '#c8cdc8',
  bronze: '#a89067',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, value]) => [key, linear(value)]),
);
const offset = frame.reconstruction.offsetFromInitialMap;
const local = (p) => p.map((v, i) => v - offset[i]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (a, b) => a.map((v, i) => v + b[i]);
const normalize = (v) => {
  const length = Math.hypot(...v);
  return v.map((x) => x / length);
};
export function tintagelGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw new Error('Tintagel footing outside retained PMTiles');
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
function writer(target, detail) {
  return (surface, polygon, direction, tint = colors[surface]) => {
    let points = polygon.map((p) => p.map(Math.fround));
    if (
      direction &&
      normalFor(points[0], points[1], points[2]).reduce((sum, v, i) => sum + v * direction[i], 0) <
        0
    )
      points = points.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[surface][i]) : tint;
    for (let i = 1; i < points.length - 1; i++) {
      const tri = [points[0], points[i], points[i + 1]];
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, j) => v - tri[0][j]),
            tri[2].map((v, j) => v - tri[0][j]),
          ),
        ) < 1e-8
      )
        continue;
      target.addTriangle(
        surface,
        'palette:#ffffff',
        tri,
        normalFor(...tri),
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
function cap(face, outline, y, surface, down = false) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      surface,
      indices.slice(i, i + 3).map((k) => at(outline[k], y)),
      [0, down ? -1 : 1, 0],
    );
}
function solid(face, outline, bottom, top, surface = 'stone') {
  const area = outline.reduce((sum, a, i) => {
    const b = outline[(i + 1) % outline.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const p = area < 0 ? [...outline].reverse() : outline;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      surface,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(face, p, top, surface);
  cap(face, p, bottom, surface, true);
}
function beam(face, a, b, width, depth, surface, tint) {
  const d = normalize(b.map((v, i) => v - a[i]));
  const u = normalize(cross(d, Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(d, u);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => p.map((value, i) => value + (u[i] * x * width) / 2 + (v[i] * z * depth) / 2));
  const pa = ring(a),
    pb = ring(b);
  for (let i = 0; i < 4; i++)
    face(
      surface,
      [pa[i], pa[(i + 1) % 4], pb[(i + 1) % 4], pb[i]],
      pa[i].map((value, j) => value - a[j]),
      tint,
    );
  face(
    surface,
    pa,
    d.map((x) => -x),
    tint,
  );
  face(surface, pb, d, tint);
}
function ruinWall(face, a, b, height, width, detail, phase = 0, absoluteFloor) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.2) return;
  const n = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  const count = detail < 2 ? 1 : Math.max(1, Math.ceil(length / [8, 8, 5, 2.8, 1.2][detail]));
  for (let i = 0; i < count; i++) {
    const s = mix(a, b, i / count),
      e = mix(a, b, (i + 1) / count);
    const outline = [
      add(
        s,
        n.map((v) => (v * width) / 2),
      ),
      add(
        e,
        n.map((v) => (v * width) / 2),
      ),
      add(
        e,
        n.map((v) => (-v * width) / 2),
      ),
      add(
        s,
        n.map((v) => (-v * width) / 2),
      ),
    ];
    const bottom = (p) => tintagelGround(...p) - 0.4;
    const top = (p) =>
      (absoluteFloor ?? tintagelGround(...p)) +
      height +
      (detail < 2
        ? 0
        : Math.min(0.9, height * 0.3) *
          Math.sin(
            (((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length) * 0.8 +
              phase,
          ));
    solid(face, outline, bottom, top);
  }
}
function enclosure(face, outline, heights, width, detail, floor) {
  const p = outline.map(local);
  p.forEach((a, i) => {
    ruinWall(
      face,
      a,
      p[(i + 1) % p.length],
      Array.isArray(heights) ? heights[i] : heights,
      width,
      detail,
      i * 1.7,
      floor,
    );
  });
}
function portal(
  face,
  start,
  end,
  floor,
  totalHeight,
  openingWidth,
  openingHeight,
  thickness,
  detail,
) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]),
    u = [(end[0] - start[0]) / length, (end[1] - start[1]) / length],
    n = [-u[1], u[0]];
  const point = (x, y, z = 0) => [
    start[0] + u[0] * x + n[0] * z,
    y,
    start[1] + u[1] * x + n[1] * z,
  ];
  const left = (length - openingWidth) / 2,
    right = left + openingWidth;
  ruinWall(face, start, mix(start, end, left / length), totalHeight, thickness, detail, 1, floor);
  ruinWall(
    face,
    mix(start, end, right / length),
    end,
    totalHeight - 0.3,
    thickness,
    detail,
    2,
    floor,
  );
  const count = detail < 2 ? 4 : detail === 4 ? 14 : 8;
  const lower = (x) =>
    floor + openingHeight - 0.7 + 0.7 * Math.sin(((x - left) / openingWidth) * Math.PI);
  for (let i = 0; i < count; i++) {
    const a = left + (openingWidth * i) / count,
      b = left + (openingWidth * (i + 1)) / count;
    for (const sign of [-1, 1])
      face(
        'stone',
        [
          point(a, lower(a), (sign * thickness) / 2),
          point(b, lower(b), (sign * thickness) / 2),
          point(b, floor + totalHeight, (sign * thickness) / 2),
          point(a, floor + totalHeight, (sign * thickness) / 2),
        ],
        [n[0] * sign, 0, n[1] * sign],
      );
    face(
      'stone',
      [
        point(a, lower(a), -thickness / 2),
        point(b, lower(b), -thickness / 2),
        point(b, lower(b), thickness / 2),
        point(a, lower(a), thickness / 2),
      ],
      [0, -1, 0],
    );
    face(
      'stone',
      [
        point(a, floor + totalHeight, -thickness / 2),
        point(b, floor + totalHeight, -thickness / 2),
        point(b, floor + totalHeight, thickness / 2),
        point(a, floor + totalHeight, thickness / 2),
      ],
      [0, 1, 0],
    );
  }
}
function floorPlate(face, outline, floor) {
  solid(face, outline.map(local), (p) => floor(p) - 0.18, floor, 'floor');
}
function bridge(face, detail) {
  const { start, end, deckElevationMeters, widthMeters } = frame.reconstruction.bridge;
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]),
    n = [-(end[1] - start[1]) / length, (end[0] - start[0]) / length];
  const deck = deckElevationMeters - fit.datumMeters;
  const pos = (t, y = 0, lateral = 0) => {
    const p = mix(start, end, t);
    return [p[0] + n[0] * lateral, deck + 0.22 * Math.sin(t * Math.PI) + y, p[1] + n[1] * lateral];
  };
  const depth = (t) => -0.25 - 5.1 * Math.pow(Math.abs(2 * t - 1), 1.7);
  const segments = [2, 4, 8, 14, 22][detail];
  for (const half of [0, 1]) {
    const beginning = half / 2 + (half === 1 && detail === 4 ? 0.0006 : 0),
      ending = (half + 1) / 2 - (half === 0 && detail === 4 ? 0.0006 : 0);
    for (let i = 0; i < segments; i++) {
      const a = beginning + ((ending - beginning) * i) / segments,
        b = beginning + ((ending - beginning) * (i + 1)) / segments;
      beam(face, pos(a, -0.2), pos(b, -0.2), widthMeters, 0.35, 'floor');
      for (const sign of [-1, 1]) {
        const side = sign * (widthMeters / 2 - 0.16),
          bar = detail === 0 ? 0.28 : 0.15;
        beam(face, pos(a, -0.4, side), pos(b, -0.4, side), 0.24, 0.3, 'red');
        beam(face, pos(a, depth(a), side), pos(b, depth(b), side), 0.2, 0.26, 'red');
        beam(face, pos(a, -0.4, side), pos(b, depth(b), side), bar, bar, 'silver');
        if (detail >= 1) beam(face, pos(a, depth(a), side), pos(b, -0.4, side), bar, bar, 'silver');
      }
    }
  }
  if (detail >= 1) {
    for (const sign of [-1, 1]) {
      const side = (sign * widthMeters) / 2,
        count = [0, 14, 28, 44, 66][detail];
      beam(
        face,
        pos(0, 1.15, side),
        pos(1, 1.15, side),
        detail === 1 ? 0.18 : 0.1,
        0.1,
        'red',
        colors.bronze,
      );
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        beam(
          face,
          pos(t, -0.12, side),
          pos(t, 1.15, side),
          detail === 1 ? 0.14 : 0.07,
          0.08,
          'silver',
        );
        if (detail >= 2 && i < count)
          beam(face, pos(t, -0.1, side), pos((i + 1) / count, 1.15, side), 0.055, 0.055, 'silver');
      }
    }
    for (const t of [0, 1]) {
      const p = pos(t);
      const q = [p[0], p[2]];
      solid(
        face,
        [
          [q[0] - 1.9, q[1] - 1.6],
          [q[0] + 1.9, q[1] - 1.6],
          [q[0] + 1.9, q[1] + 1.6],
          [q[0] - 1.9, q[1] + 1.6],
        ],
        (p) => tintagelGround(...p) - 0.35,
        deck - 0.5,
      );
    }
  }
}
function build(out, detail) {
  const face = writer(out, detail);
  // Independent roofless compounds: no composite generic castle or invented roof/towers.
  enclosure(
    face,
    [
      [82, 34],
      [66, 37],
      [47, 26],
      [38, 7],
      [44, -5],
      [64, -1],
      [80, 13],
      [84, 28],
    ],
    [1.4, 1.2, 2.1, 2.8, 2.4, 3.2, 2, 1.5],
    1.1,
    detail,
  );
  const hall = [
    [48, 11],
    [61, -2],
    [79, 12],
    [66, 25],
  ];
  if (detail >= 1) floorPlate(face, hall, (p) => tintagelGround(...p) + 0.08);
  const hp = hall.map(local);
  for (let i = 0; i < hp.length; i++) {
    const a = hp[i],
      b = hp[(i + 1) % hp.length];
    if (i === 3) {
      ruinWall(face, a, mix(a, b, 0.38), 1.2, 1.5, detail);
      ruinWall(face, mix(a, b, 0.69), b, 1.6, 1.5, detail);
    } else if (i === 1) {
      const floor = Math.max(tintagelGround(...a), tintagelGround(...b)) + 0.1;
      portal(face, a, b, floor, 4.2, 3.3, 2.4, 1.5, detail);
    } else ruinWall(face, a, b, [1.6, 4.4, 3.3, 1.2][i], 1.5, detail, i);
  }
  const main = [
    [138, 74],
    [156, 83],
    [169, 99],
    [161, 108],
    [145, 100],
    [130, 88],
  ];
  enclosure(face, main, [1.6, 2.7, 3.4, 2.3, 1.4, 2.5], 1.1, detail);
  enclosure(
    face,
    [
      [147, 108],
      [158, 99],
      [176, 109],
      [181, 127],
      [161, 129],
      [145, 117],
    ],
    [1.9, 3.1, 4.5, 1.5, 2, 2.6],
    1.4,
    detail,
  );
  const entry = [local([139, 75]), local([144, 84])];
  const entryFloor = Math.max(...entry.map((p) => tintagelGround(...p))) + 0.1;
  portal(face, ...entry, entryFloor, 4.1, 2.5, 2.7, 1.3, detail);
  // Tall detached masonry remnants preserve the visible mainland room rhythm.
  if (detail >= 1) {
    const a = local([160, 106]),
      b = local([175, 115]),
      floor = Math.max(tintagelGround(...a), tintagelGround(...b));
    portal(face, a, b, floor, 5.2, 2, 2.6, 1.2, detail);
    ruinWall(face, local([152, 120]), local([158, 118]), 4.2, 1.3, detail);
    ruinWall(face, local([171, 101]), local([175, 105]), 5.4, 1.4, detail);
  }
  // Chapel foundations and walled garden retain their separate island positions.
  enclosure(
    face,
    [
      [-1, -33],
      [18, -29],
      [15, -16],
      [-4, -20],
    ],
    1.2,
    0.9,
    detail,
  );
  enclosure(
    face,
    [
      [-51, -75],
      [-26, -68],
      [-34, -42],
      [-58, -49],
    ],
    1,
    0.8,
    detail,
  );
  if (detail >= 1) {
    for (const room of [
      [
        [34, -25],
        [43, -29],
        [49, -14],
        [39, -10],
      ],
      [
        [26, -14],
        [33, -18],
        [41, -5],
        [32, -1],
      ],
      [
        [-93, -149],
        [-79, -151],
        [-76, -137],
        [-90, -135],
      ],
      [
        [-75, -148],
        [-60, -144],
        [-63, -132],
        [-77, -136],
      ],
      [
        [-67, -131],
        [-51, -124],
        [-56, -112],
        [-72, -119],
      ],
      [
        [-55, -144],
        [-43, -138],
        [-48, -128],
        [-60, -134],
      ],
    ])
      enclosure(face, room, 0.8, 0.8, detail);
    ruinWall(face, local([3, -33]), local([2, -20]), 1, 0.7, detail);
    ruinWall(face, local([-45, -71]), local([-42, -45]), 0.65, 0.6, detail);
  }
  bridge(face, detail);
  if (detail >= 2) {
    // Selected broad stone stairs and short terrace slabs, not every tourist path or railing.
    const stair = (a, b, count) => {
      const p = local(a),
        q = local(b),
        ya = frame.reconstruction.bridge.deckElevationMeters - fit.datumMeters,
        yb = tintagelGround(...q) + 0.2;
      for (let i = 0; i < count; i++) {
        const t = i / count,
          s = (i + 1) / count,
          start = mix(p, q, t),
          end = mix(p, q, s),
          len = Math.hypot(end[0] - start[0], end[1] - start[1]),
          n = [-(end[1] - start[1]) / len, (end[0] - start[0]) / len];
        solid(
          face,
          [
            add(start, n),
            add(end, n),
            add(
              end,
              n.map((v) => -v),
            ),
            add(
              start,
              n.map((v) => -v),
            ),
          ],
          ya + (yb - ya) * t - 0.35,
          ya + (yb - ya) * s + 0.08,
          'floor',
        );
      }
    };
    stair([81, 34], [68, 27], detail === 4 ? 24 : 12);
    stair([139, 74], [148, 90], detail === 4 ? 20 : 10);
    // Broken tops are broad fragments; shared stone graph supplies thin courses/joints.
    for (const [i, p] of [
      [61, -2],
      [79, 12],
      [169, 99],
      [176, 109],
      [181, 127],
      [38, 7],
    ].entries()) {
      const q = local(p),
        floor = tintagelGround(...q) + [2.5, 2.1, 2.5, 3.4, 1.5, 2.4][i];
      solid(
        face,
        [
          [q[0] - 0.6, q[1] - 0.5],
          [q[0] + 0.7, q[1] - 0.3],
          [q[0] + 0.4, q[1] + 0.6],
          [q[0] - 0.5, q[1] + 0.4],
        ],
        floor,
        floor + 0.45,
      );
    }
  }
}
export const buildTintagelSkyline = (out) => build(out, 0);
export const buildTintagelDistrict = (out) => build(out, 1);
export const buildTintagelStreet = (out) => build(out, 2);
export const buildTintagelCloseup = (out) => build(out, 3);
export const tintagelStudy = {
  id: 'N0311',
  key: 'tintagel_castle',
  title: 'Tintagel Castle',
  category: 'castle',
  wikidataId: 'Q934922',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  importReason:
    'Preserve the authored broken wall crests, real arch openings and narrow tapered footbridge members; four material-merged browser levels are authored independently.',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Surviving slate-stone island hall and open courtyard, separate mainland gatehouse/upper rooms, chapel and garden foundations, selected early low island rooms, and the narrow tapered modern footbridge on its mapped crossing.',
  sourceFacts: {
    horizontalBasis:
      'Named standard viewer PMTiles castle and courtyard/hall/chapel/garden points, mapped footbridge centerline.',
    architecturalHeights: 'Picture-led approximations; no surveyed heights or room plans used.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    '68.343 m mapped crossing and named-site controls; ruined wall plans and heights reconstructed from three inspected pictures.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license. Map controls © OpenStreetMap contributors, ODbL-1.0; linked photographs remain external references and are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four canonical shared texture graphs supply wall stone, coarse paving, painted bridge chords and stainless lattice. No unique bitmap or embedded photograph.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Separate roofless island and mainland courtyards',
      'Broken slate-stone hall walls and low island foundations',
      'Narrow silver/red tapered footbridge across the mapped gorge',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Wall plans, ruin profiles, architectural elevations, bridge height and exact terrace contact are picture-led approximations against coarse standard viewer PMTiles; not surveyed geometry.',
    'Natural caves/cliff geology, buried/lost structures, Gallos sculpture, modern visitor facilities, vegetation and certified walkable collision are excluded. The master depicts surviving exterior remains, not the complete medieval castle.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: { position: [110, 185, 225], lookAt: [-45, 35, -65], fov: 43 },
  qaCameras: [
    { name: 'island-hall-and-courtyard', position: [-22, 95, 20], lookAt: [-47, 37, -40] },
    { name: 'mainland-upper-rooms', position: [110, 91, 121], lookAt: [55, 35, 55] },
    { name: 'cantilever-bridge', position: [-10, 55, 84], lookAt: [0, 29, 0] },
    { name: 'bridge-mainland-gateway', position: [14, 48, 3], lookAt: [34, 32, 28] },
    { name: 'chapel-and-garden', position: [-128, 101, -5], lookAt: [-123, 52, -90] },
    { name: 'northern-low-foundations', position: [-157, 108, -114], lookAt: [-176, 50, -187] },
  ],
};
