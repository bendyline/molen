/** Harlech: individual hollow drums, roofless gatehouse, concentric curtains and mapped bridge. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/gc/gcm/n0316_harlech_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const floor = frame.reconstruction.floorY;
const palette = {
  stone: '#c2c0af',
  rock: '#a7a89b',
  wood: '#a7987c',
  metal: '#b0bab9',
  roof: '#ced6d2',
  lawn: '#8aa065',
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
const ring = (x, z, r, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => [
    x + Math.cos(phase + (i * Math.PI * 2) / n) * r,
    z + Math.sin(phase + (i * Math.PI * 2) / n) * r,
  ]);
export function harlechGround(x, z) {
  const c = Math.cos(frame.reconstruction.castleHeading),
    s = Math.sin(frame.reconstruction.castleHeading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Harlech footing outside retained terrain');
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
const base = () => floor - 0.25;
const terrainBase = (p) => harlechGround(...p) - 0.25;
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

/** Open tower well: annular shell and cap only, never a solid roof disc. */
function tower(out, detail, t, index) {
  const [x, z] = t.center,
    n = [8, 8, 12, 24, 32][detail],
    outer = ring(x, z, t.radius, n),
    inner = ring(x, z, t.innerRadius, n),
    face = writer(out, detail);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = outer[i],
      b = outer[j],
      mid = a.map((v, k) => (v + b[k]) / 2),
      axis = norm(b.map((v, k) => v - a[k]));
    const holes = [];
    if (detail >= 2 && i % Math.round(n / 4) === 0)
      for (const y of detail === 2 ? [floor + 8] : [floor + 3.5, floor + 9, floor + 15])
        holes.push(
          prepareOpening(
            {
              center: mid,
              axis,
              depth: t.radius * 2,
              width: detail === 2 ? 0.7 : 0.65,
              height: 1.6,
              spring: 1.05,
              bottom: y,
              shape: 'pointed',
            },
            0,
            detail,
          ),
        );
    const target = adapter(out),
      cut = writer(openingBuilder(target, holes), detail),
      shell = [a, b, inner[j], inner[i]];
    const top = (p) =>
      t.top + (detail >= 2 ? 0.38 * Math.sin(Math.atan2(p[1] - z, p[0] - x) * 7 + index) : 0);
    const radial = norm([mid[0] - x, mid[1] - z]);
    cut('stone', [at(a, base), at(b, base), at(b, top), at(a, top)], [radial[0], 0, radial[1]]);
    cut(
      'stone',
      [at(inner[i], base), at(inner[j], base), at(inner[j], top), at(inner[i], top)],
      [-radial[0], 0, -radial[1]],
    );
    cut(
      'stone',
      shell.map((p) => at(p, top)),
      [0, 1, 0],
    );
    if (holes.length) openingReveals(target, shell, base, top, holes, colors.stone);
    if (detail >= 3) {
      // Sparse large sockets and floor ledges preserve ruined-wall rhythm without separate stone blocks.
      if (i % 4 === 0) {
        const radial = norm([mid[0] - x, mid[1] - z]),
          p = [x + radial[0] * (t.innerRadius + 0.04), z + radial[1] * (t.innerRadius + 0.04)];
        beam(
          face,
          [p[0], floor + 7.8, p[1]],
          [p[0] + axis[0] * 0.55, floor + 7.8, p[1] + axis[1] * 0.55],
          0.35,
          0.32,
        );
      }
      if (i % 3 === 0) box(face, mid[0], mid[1], 0.65, 0.65, t.top - 0.22, t.top + 0.25);
    }
  }
  if (detail >= 2 && index < 4) {
    const r = ring(x + 1.6, z + 1.6, 1.15, detail === 2 ? 8 : 12);
    for (let i = 0; i < r.length; i++)
      wall(out, detail, r[i], r[(i + 1) % r.length], 0.48, floor + 1, t.top + 1.1);
  }
}

function curtains(out, detail) {
  const inner = [
      [-26, -18.5],
      [27, -18.5],
      [25, 21.8],
      [-22.8, 22],
    ],
    top = floor + 13.0;
  // Entrance-side curtain remains separated from the gatehouse passage.
  for (const [a, b] of [
    [inner[0], [-11, -18.5]],
    [[12, -18.5], inner[1]],
    [inner[1], inner[2]],
    [inner[2], inner[3]],
    [inner[3], inner[0]],
  ]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes = [];
    if (detail >= 2)
      for (let i = 1; i <= Math.floor(len / 8); i++) {
        const q = i / (Math.floor(len / 8) + 1);
        holes.push({
          center: a.map((v, k) => v + (b[k] - v) * q),
          width: 0.68,
          height: 1.35,
          bottom: floor + 5,
          shape: 'rectangle',
        });
      }
    wall(out, detail, a, b, 2.5, base, top, 'stone', holes);
    if (detail >= 1) {
      const u = norm(b.map((v, k) => v - a[k])),
        normal = [-u[1], u[0]];
      const pa = a.map((v, k) => v - normal[k] * 0.9),
        pb = b.map((v, k) => v - normal[k] * 0.9);
      wall(out, detail, pa, pb, 0.55, top, top + 0.65);
      if (detail >= 3) beam(writer(out, detail), at(a, top - 0.3), at(b, top - 0.3), 0.55, 0.45);
      void normal;
    }
  }
  const outer = frame.reconstruction.outerCurtain;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    const h =
      detail >= 2 && i === 7
        ? [
            {
              center: [35, -27],
              width: 1.6,
              height: 2.2,
              bottom: floor - 0.6,
              shape: 'round',
              spring: 1.3,
            },
          ]
        : [];
    // The east entrance crosses a genuine opening in this lower curtain.
    if (i === 9) {
      wall(out, detail, a, [2.1, -31.8], 1.15, base, floor + 3.2);
      wall(out, detail, [-2.1, -31.5], b, 1.15, base, floor + 3.2);
    } else wall(out, detail, a, b, 1.15, base, floor + 3.2, 'stone', h);
  }
  if (detail >= 1)
    for (const [x, z, r] of [
      [-35, 9, 2.3],
      [-32, 24, 2.2],
      [37, 7, 2.1],
      [36, 20, 2.2],
    ]) {
      const a = ring(x, z, r, detail === 1 ? 6 : 12),
        b = ring(x, z, r - 0.8, a.length);
      for (let i = 0; i < a.length; i++)
        solid(
          writer(out, detail),
          [a[i], a[(i + 1) % a.length], b[(i + 1) % a.length], b[i]],
          base,
          floor + 3.4,
        );
    }
}

function gatehouse(out, detail) {
  const window = (x, z, bottom, width = 1.5) => ({
    center: [x, z],
    bottom,
    width,
    height: 2.3,
    shape: 'pointed',
    spring: 1.25,
  });
  const broken = (p) =>
    floor +
    20.1 +
    Math.min(1.2, Math.abs(p[0]) * 0.1) +
    (detail >= 2 ? 0.45 * Math.sin(p[0] * 1.9 + p[1] * 2.2) : 0);
  const portal = {
    center: [0.35, -22.3],
    bottom: floor - 0.6,
    width: 3.45,
    height: 4.5,
    shape: 'pointed',
    spring: 2.7,
  };
  wall(out, detail, [-10.5, -22.3], [11.2, -22.3], 2.2, floor - 0.8, broken, 'stone', [
    portal,
    ...(detail >= 2
      ? [
          window(-3.4, -22.3, floor + 8.3),
          window(4.2, -22.3, floor + 8.3),
          window(0.35, -22.3, floor + 14.5, 2.0),
        ]
      : []),
  ]);
  const backHoles = [
    {
      center: [0.35, -9.5],
      bottom: floor - 0.6,
      width: 3.45,
      height: 4.5,
      shape: 'pointed',
      spring: 2.7,
    },
  ];
  if (detail >= 1) for (const x of [-6.1, 0.35, 6.7]) backHoles.push(window(x, -9.5, floor + 8.3));
  if (detail >= 2) for (const x of [-6.1, 0.35, 6.7]) backHoles.push(window(x, -9.5, floor + 15));
  wall(out, detail, [-10.5, -9.5], [11.2, -9.5], 1.45, floor - 0.5, broken, 'stone', backHoles);
  for (const x of [-10.5, 11.2])
    wall(
      out,
      detail,
      [x, -21],
      [x, -9.5],
      1.5,
      floor - 0.5,
      broken,
      'stone',
      detail >= 2 ? [window(x, -15.2, floor + 9)] : [],
    );
  // Interior room divisions remain roofless; passage is not blocked by a floor or cross wall.
  if (detail >= 1)
    for (const x of [-2.3, 2.9])
      wall(
        out,
        detail,
        [x, -21],
        [x, -10],
        0.85,
        floor - 0.3,
        floor + 10.4,
        'stone',
        detail >= 2
          ? [
              {
                center: [x, -14],
                width: 1.2,
                height: 2.4,
                bottom: floor + 1,
                shape: 'round',
                spring: 1.5,
              },
            ]
          : [],
      );
  if (detail >= 1)
    for (const [x, z] of [
      [-10.2, -8],
      [10.8, -8],
    ])
      tower(out, detail, { center: [x, z], radius: 2.0, innerRadius: 0.9, top: floor + 23.2 }, 6);
  const face = writer(out, detail);
  // Small modern covered entrance, estimated from the aerial view; glazing/truss engineering excluded.
  if (detail >= 2) {
    box(face, 0.35, -26.0, 3.8, 3.1, floor + 4.9, floor + 5.15, 'roof');
    for (const x of [-1.4, 2.1])
      beam(face, [x, floor, -27.2], [x, floor + 4.95, -27.2], 0.16, 0.16, 'metal');
  }
  if (detail >= 3) {
    for (const z of [-18.5, -12.5])
      for (const [a, b] of [
        [
          [-9.7, z],
          [-2.8, z],
        ],
        [
          [3.4, z],
          [10.4, z],
        ],
      ])
        beam(face, at(a, floor + 7), at(b, floor + 7), 0.38, 0.4, 'stone');
  }
}

function court(out, detail) {
  const face = writer(out, detail),
    hole = frame.reconstruction.castleHoles[0];
  cap(face, detail === 0 ? rect(0, 1, 43, 32) : hole, floor + 0.025, 'lawn');
  const plateau = frame.reconstruction.outerCurtain,
    inner = frame.reconstruction.castleOutline,
    points = [...plateau, ...inner],
    ids = earcut(points.flat(), [plateau.length], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'lawn',
      ids.slice(i, i + 3).map((k) => at(points[k], floor - 0.1)),
      [0, 1, 0],
    );
  // Lower domestic room remnants on the western interior wall, visibly distinct from the gatehouse.
  const extent = [
    [-20, 12],
    [23, 12],
    [23, 19],
    [-20, 19],
  ];
  for (let i = 0; i < extent.length; i++)
    wall(
      out,
      detail,
      extent[i],
      extent[(i + 1) % extent.length],
      0.8,
      floor,
      floor + (i === 2 ? 4.8 : 2.1),
    );
  if (detail >= 1)
    for (const x of [-13, -4, 5, 14])
      wall(
        out,
        detail,
        [x, 12],
        [x, 19],
        0.65,
        floor,
        floor + 2.7,
        'stone',
        detail >= 2
          ? [
              {
                center: [x, 14.4],
                width: 1.25,
                height: 1.8,
                bottom: floor + 0.1,
                shape: 'rectangle',
              },
            ]
          : [],
      );
  if (detail >= 2) {
    for (const x of [-18, -9, 0, 9, 18])
      wall(out, detail, [x - 1.5, 21.6], [x + 1.5, 21.6], 0.55, floor + 5, floor + 7.5, 'stone', [
        { center: [x, 21.6], width: 1.3, height: 1.6, bottom: floor + 5.1, shape: 'rectangle' },
      ]);
    // One merged sequence of broad surviving stair treads, with no micro-stones.
    for (let i = 0; i < (detail === 2 ? 7 : 12); i++) {
      const n = detail === 2 ? 7 : 12;
      box(face, -15, 9.2 - (i * 4) / n, 2, 4 / n + 0.04, floor, floor + ((i + 1) * 2.3) / n);
    }
  }
}

function bridge(out, detail) {
  const line = frame.reconstruction.bridge.castle,
    face = writer(out, detail),
    endGround = harlechGround(...line.at(-1));
  const lengths = [0];
  for (let i = 1; i < line.length; i++)
    lengths.push(lengths.at(-1) + Math.hypot(...line[i].map((v, k) => v - line[i - 1][k])));
  const y = (i) => floor + 0.1 + ((endGround + 1.0 - floor - 0.1) * lengths[i]) / lengths.at(-1);
  // Gate connection extends the mapped first point into the visible central portal.
  const first = line[0];
  beam(
    face,
    [0.35, floor - 0.12, -25.1],
    [first[0], y(0) - 0.12, first[1]],
    2.45,
    0.3,
    detail === 0 ? 'stone' : 'wood',
  );
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      u = norm(b.map((v, k) => v - a[k])),
      n = [-u[1], u[0]],
      ya = y(i),
      yb = y(i + 1);
    beam(face, at(a, ya - 0.13), at(b, yb - 0.13), 2.45, 0.3, detail === 0 ? 'stone' : 'wood');
    if (detail >= 1)
      for (const side of [-1, 1]) {
        const pa = a.map((v, k) => v + n[k] * 1.2 * side),
          pb = b.map((v, k) => v + n[k] * 1.2 * side);
        beam(
          face,
          at(pa, ya + 1.05),
          at(pb, yb + 1.05),
          detail === 1 ? 0.22 : 0.14,
          detail === 1 ? 0.3 : 0.14,
          'metal',
        );
        if (detail >= 2) {
          const count = Math.ceil(
            Math.hypot(...b.map((v, k) => v - a[k])) / (detail === 2 ? 5 : 2.4),
          );
          for (let j = 0; j <= count; j++) {
            const q = j / count,
              p = pa.map((v, k) => v + (pb[k] - v) * q),
              h = ya + (yb - ya) * q;
            beam(face, at(p, h), at(p, h + 1.1), 0.14, 0.14, 'metal');
          }
          beam(face, at(pa, ya + 0.48), at(pb, yb + 0.48), 0.1, 0.1, 'metal');
        }
      }
    if (detail >= 2 && i > 0) {
      const g = harlechGround(...a);
      if (ya - 0.3 > g + 0.2) beam(face, at(a, g - 0.15), at(a, ya - 0.3), 0.45, 0.45, 'metal');
    }
  }
}

function crag(out, detail) {
  const outer = frame.reconstruction.outerCurtain,
    face = writer(out, detail),
    sign = Math.sign(
      outer.reduce((v, a, i) => {
        const b = outer[(i + 1) % outer.length];
        return v + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
  const c = Math.cos(frame.reconstruction.castleHeading),
    s = Math.sin(frame.reconstruction.castleHeading);
  const mappedRocks = fit.controls
    .filter((f) => f.layer === 'landuse' && f.properties.kind === 'bare_rock')
    .flatMap((f) => {
      const polygons =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      return polygons.map((p) =>
        p[0].map(([lo, la]) => {
          const x =
              (lo - frame.anchor[0]) * Math.cos((frame.anchor[1] * Math.PI) / 180) * 111319.490793,
            z = -(la - frame.anchor[1]) * 111319.490793;
          return [x * c - z * s, x * s + z * c];
        }),
      );
    });
  const inside = (q, r) => {
    let yes = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > q[1] !== b[1] > q[1] &&
        q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        yes = !yes;
    }
    return yes;
  };
  // Grass slopes and sparse exposed rock follow the pictured crag and mapped bare-rock controls.
  // The lower edge follows the retained DEM; this is authored geometry, not terrain carving.
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      q = (p) => [p[0] * 1.18, p[1] * 1.18];
    if (Math.max(harlechGround(...a), harlechGround(...b)) >= floor - 0.3) continue;
    const count = detail <= 1 ? 1 : Math.ceil(Math.hypot(...b.map((v, k) => v - a[k])) / 9),
      bands = detail <= 1 ? 1 : 3;
    for (let j = 0; j < count; j++)
      for (let k = 0; k < bands; k++) {
        const point = (u, t) => {
            const p = a.map((v, n) => v + (b[n] - v) * u),
              bottom = q(p),
              baseY = terrainBase(bottom);
            return [
              p[0] * t + bottom[0] * (1 - t),
              baseY + (floor - 0.3 - baseY) * t,
              p[1] * t + bottom[1] * (1 - t),
            ];
          },
          poly = [
            point(j / count, k / bands),
            point((j + 1) / count, k / bands),
            point((j + 1) / count, (k + 1) / bands),
            point(j / count, (k + 1) / bands),
          ],
          mid = a.map((v, n) => v + ((b[n] - v) * (j + 0.5)) / count),
          rock = mappedRocks.some((r) => inside(mid, r)) || (k === bands - 1 && i % 3 === 0);
        face(rock ? (detail === 0 ? 'stone' : 'rock') : 'lawn', poly, [
          (b[1] - a[1]) * sign,
          0,
          (a[0] - b[0]) * sign,
        ]);
      }
  }
}
function build(target, detail) {
  const out = rotateTarget(target);
  crag(out, detail);
  court(out, detail);
  curtains(out, detail);
  for (const [i, t] of frame.reconstruction.towers.entries()) tower(out, detail, t, i);
  gatehouse(out, detail);
  bridge(out, detail);
}
export const buildHarlechSkyline = (out) => build(out, 0);
export const buildHarlechDistrict = (out) => build(out, 1);
export const buildHarlechStreet = (out) => build(out, 2);
export const buildHarlechCloseup = (out) => build(out, 3);
const rotateCamera = ({ position, lookAt, ...rest }) => {
  const h = frame.heading - frame.reconstruction.castleHeading,
    c = Math.cos(h),
    s = Math.sin(h),
    p = ([x, y, z]) => [x * c - z * s, y + floor - 7.2, x * s + z * c];
  return { ...rest, position: p(position), lookAt: p(lookAt) };
};
export const harlechStudy = {
  id: 'N0316',
  key: 'harlech_castle',
  title: 'Harlech Castle',
  category: 'castle',
  wikidataId: 'Q540964',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual roofless Harlech Castle: four hollow corner drums, twin projecting gate towers, two rear stair turrets, high rectangular inner curtains, lower concentric walls and small rounded projections. The gatehouse retains large true window voids and a clear central passage; grassy courtyard, low domestic ruins, rocky crag and the actual curved modern approach bridge remain distinct.',
  sourceFacts: {
    horizontalBasis:
      'Current standard viewer castle Polygon with nine interior rings and mapped bridge LineString; retained exact-QID way117407449.',
    architecturalHeights:
      'Exterior-picture estimates. Courtyard plateau and bridge profile approximate against coarse viewer DEM.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped inner castle69x58m, six tower bulges, nine retained interior rings and actual approach bridge path.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing canonical256-square graphs supply rubble stone, crag granite, wood decking, painted bridge metal and the small metal entrance canopy. Lawn is a plain vertex color. Metric UVs and linear tints; no unique bitmap or embedded photograph.',
  importReason:
    'Preserve the open tower wells, roofless gatehouse passage/window voids, concentric curtain footprint and actual curved bridge as four independently authored browser levels.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Four hollow corner drums and roofless twin-tower gatehouse',
      'Open grassy court with lower room ruins and concentric outer curtain',
      'Rocky plateau and mapped curved entrance footbridge',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Wall heights/thicknesses, ruin profiles, room partitions and outer curtain projections are picture-led approximations, not a measured conservation model.',
    'Modern entrance canopy is a simplified light metal covering; exact glazing, bridge truss/support engineering, furnishings and certified walkable collision are excluded.',
    'The standard viewer DEM blends the castle crag. Authored plateau/rock skirt and deck elevations are approximate; no runtime terrain carving or surveyed ground/approach contact is claimed.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'gatehouse-and-bridge', position: [-32, 33, -96], lookAt: [0.5, 19, -23], fov: 45 },
    { name: 'open-court-and-west-ruins', position: [-72, 64, 69], lookAt: [0, 18, 0], fov: 44 },
    {
      name: 'hollow-corner-and-stair-turret',
      position: [-45, 42, -31],
      lookAt: [-20, 23, -12],
      fov: 45,
    },
    { name: 'gatehouse-window-voids', position: [0, 27, 17], lookAt: [0.35, 24, -10], fov: 45 },
    { name: 'concentric-curtain-and-crag', position: [74, 38, 65], lookAt: [20, 13, 13], fov: 44 },
    { name: 'mapped-plan-and-wells', position: [0, 151, -5], lookAt: [0, 6, -5], fov: 44 },
  ].map(rotateCamera),
};
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
