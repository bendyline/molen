/** Rio Metropolitan Cathedral: mapped tapered concrete grid, four window axes and detached open campanile. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/75/75c/rio_de_janeiro_cathedral/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  wall: '#b9af9c',
  trim: '#c5bba8',
  door: '#8d7350',
  glass: '#4a5556',
  accent: '#606560',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const unit = (v) => {
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  },
  at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
export function rioCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Rio cathedral footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const footing = (p) => Math.min(floor - 0.3, rioCathedralGround(...p) - 0.35);
function writer(out, d) {
  return (slot, points, direction, tint = colors[slot]) => {
    const p = points.map((v) => v.map(Math.fround));
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      const normal = normalFor(...t);
      if (direction && normal.reduce((s, v, k) => s + v * direction[k], 0) < 0) t = t.toReversed();
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
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
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let off = r.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function beam(face, a, b, w, slot = 'roof') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u));
  const corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const main = rec.main.polygons[0].outline;
const crown = rec.top.polygons[0].outline;
const tau = Math.PI * 2;
const angle = (p) => (Math.atan2(p[1], p[0]) + tau) % tau;
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
function radius(ring, a) {
  const ray = [Math.cos(a), Math.sin(a)],
    hits = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length],
      e = q.map((v, k) => v - p[k]);
    const den = cross2(ray, e);
    if (Math.abs(den) < 1e-10) continue;
    const t = cross2(p, e) / den,
      u = cross2(p, ray) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error('Rio radial plan intersection missing');
  return Math.min(...hits);
}
const angles = [...main, ...crown]
  .map(angle)
  .sort((a, b) => a - b)
  .filter((a, i, r) => !i || a - r[i - 1] > 1e-7);
export function rioCathedralPoint(a, y, offset = 0) {
  const t = y / 75,
    r = radius(main, a) * (1 - t) + radius(crown, a) * t + offset;
  return [Math.cos(a) * r, floor + y, Math.sin(a) * r];
}
const normal = (a) => [Math.cos(a), 0.5, Math.sin(a)];
const windowAxis = (a) => Math.abs(Math.sin(a * 2)) < 0.27;
function slab(face, a, b, y, height, depth, slot = 'wall') {
  const P = (a, y, dep) => rioCathedralPoint(a, y, dep);
  face(
    slot,
    [P(a, y, depth), P(b, y, depth), P(b, y + height, depth), P(a, y + height, depth)],
    normal((a + b) / 2),
  );
  face(
    slot,
    [P(a, y + height, 0), P(b, y + height, 0), P(b, y + height, depth), P(a, y + height, depth)],
    [0, 1, 0],
  );
  face(slot, [P(a, y, depth), P(b, y, depth), P(b, y, 0), P(a, y, 0)], [0, -1, 0]);
}
function body(face, d) {
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = i + 1 < angles.length ? angles[i + 1] : angles[0] + tau;
    // Distant fills represent omitted grille coverage, without baking scene lighting.
    const coverage = windowAxis((a + b) / 2) ? 0 : d === 0 ? 0.44 : d === 1 ? 0.28 : 0;
    const tint = colors.glass.map(
      (v, k) => v * (1 - coverage) + colors.wall[k] * means.wall[k] * coverage,
    );
    face(
      'glass',
      [
        rioCathedralPoint(a, 1),
        rioCathedralPoint(b, 1),
        rioCathedralPoint(b, 75),
        rioCathedralPoint(a, 75),
      ],
      normal((a + b) / 2),
      tint,
    );
  }
  solid(face, main, footing, 1, 'wall');
  // The upper building_part's min_height=50 is retained metadata, not a ground extrusion.
  const w = 1.9,
    L = 15.8,
    crossPlan = [
      [-w, -L],
      [w, -L],
      [w, -w],
      [L, -w],
      [L, w],
      [w, w],
      [w, L],
      [-w, L],
      [-w, w],
      [-L, w],
      [-L, -w],
      [-w, -w],
    ];
  cap(face, crown, 75, 'trim', [crossPlan]);
  cap(face, crossPlan, 74.6, 'glass');
  sides(face, crossPlan, 74.6, 75, 'trim', true);
  if (d >= 1) {
    beam(face, at([-15.8, 0], 74.82), at([15.8, 0], 74.82), 0.28, 'accent');
    beam(face, at([0, -15.8], 74.82), at([0, 15.8], 74.82), 0.28, 'accent');
  }
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2,
      axis = [-Math.sin(a), Math.cos(a)],
      n = [Math.cos(a), Math.sin(a)];
    // Mapped inset planes carry the full-height dark window band and low bronze portal.
    const point = (u, y, off = 0.06) => {
      const p = rioCathedralPoint(a, y, off);
      return [p[0] + axis[0] * u, p[1], p[2] + axis[1] * u];
    };
    face(
      'door',
      [point(-5.2, 1.05), point(5.2, 1.05), point(4.85, 6.1), point(-4.85, 6.1)],
      [n[0], 0, n[1]],
    );
    const ba = radius(main, a),
      width = (y) => 6.7 * (1 - y / 75) + 4.1 * (y / 75);
    for (const sg of [-1, 1]) {
      const edge = (y, off) => {
        const p = rioCathedralPoint(a, y, off);
        return [p[0] + axis[0] * width(y) * sg, p[1], p[2] + axis[1] * width(y) * sg];
      };
      beam(face, edge(1, 0.4), edge(74.6, 0.4), d === 0 ? 1.4 : 1.1, 'trim');
    }
    if (d >= 2) {
      for (let y = 8; y < 74; y += d >= 3 ? 3 : 6) {
        const ww = width(y) - 0.8;
        beam(face, point(-ww, y, 0.14), point(ww, y, 0.14), 0.22, 'accent');
      }
      for (const u of [-3, 0, 3])
        beam(face, point(u, 1.1, 0.18), point(u, 5.9, 0.18), 0.22, 'accent');
      // Short steps stay in the mapped recess; exact portal/plaza joins are approximate.
      for (let j = 0; j < 3; j++) {
        const r = ba + 0.25 + j * 0.65,
          cc = [n[0] * r, n[1] * r],
          pts = [
            [-5.5, -0.32],
            [5.5, -0.32],
            [5.5, 0.32],
            [-5.5, 0.32],
          ].map(([u, v]) => [cc[0] + axis[0] * u + n[0] * v, cc[1] + axis[1] * u + n[1] * v]);
        solid(face, pts, -0.4, 0.8 - j * 0.2, 'trim');
      }
    }
  }
  if (d === 0) return;
  const count = [0, 6, 12, 20, 20][d],
    rows = [0, 12, 21, 33, 33][d],
    height = [0, 0.85, 0.7, 0.62, 0.62][d];
  for (let k = 0; k < 4; k++) {
    const start = (k * Math.PI) / 2 + 0.17,
      end = ((k + 1) * Math.PI) / 2 - 0.17;
    for (let j = 0; j < rows; j++) {
      const y = 2 + (j * 70) / (rows - 1);
      for (let i = 0; i < count; i++)
        slab(
          face,
          start + ((end - start) * i) / count,
          start + ((end - start) * (i + 1)) / count,
          y,
          height,
          d >= 2 ? 0.75 : 0.8,
        );
    }
    for (let i = 0; i <= count; i++) {
      const a = start + ((end - start) * i) / count;
      beam(
        face,
        rioCathedralPoint(a, 1.2, 0.88),
        rioCathedralPoint(a, 73.5, 0.88),
        d === 1 ? 0.65 : 0.34,
        'trim',
      );
    }
    // Continuous solid crown band, with selected small closed vent fields near the rim.
    for (let i = 0; i < count; i++)
      slab(
        face,
        start + ((end - start) * i) / count,
        start + ((end - start) * (i + 1)) / count,
        73.5,
        1.5,
        0.18,
        'trim',
      );
    if (d >= 2)
      for (let i = 0; i < 5; i++) {
        const a = start + ((end - start) * (i + 0.5)) / 5,
          da = 0.025;
        face(
          'glass',
          [
            rioCathedralPoint(a - da, 74, 0.2),
            rioCathedralPoint(a + da, 74, 0.2),
            rioCathedralPoint(a + da, 74.65, 0.2),
            rioCathedralPoint(a - da, 74.65, 0.2),
          ],
          normal(a),
        );
      }
  }
}
function bell(face, d) {
  const c = rec.bellCenter,
    ring = rec.bell.polygons[0].outline;
  solid(face, ring, footing, 1, 'wall');
  const point = (x, z, y) => [c[0] + x, floor + y, c[1] + z],
    half = (y) => 5.1 - (3.8 * y) / 62;
  // Four tapering free-standing legs leave six rectangular stages open from all sides.
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      beam(
        face,
        point(x * half(1), z * half(1), 1),
        point(x * half(62), z * half(62), 62),
        d === 0 ? 1.1 : 0.85,
        'trim',
      );
  const levels = d === 0 ? [1, 31, 62] : [1, 11, 21, 31, 41, 51, 62];
  for (const y of levels) {
    const h = half(y);
    for (const z of [-1, 1]) beam(face, point(-h, z * h, y), point(h, z * h, y), 0.7, 'wall');
    for (const x of [-1, 1]) beam(face, point(x * h, -h, y), point(x * h, h, y), 0.7, 'wall');
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1]) beam(face, point(x * 1.3, z * 1.3, 62), point(0, 0, 65), 0.65, 'trim');
  beam(face, point(0, 0, 64), point(0, 0, 75), 0.48, 'accent');
  beam(face, point(-2.5, 0, 71.5), point(2.5, 0, 71.5), 0.42, 'accent');
  if (d >= 2) {
    for (let j = 0; j < 6; j++) {
      const y = 8.4 + j * 10,
        h = half(y),
        n = d >= 3 ? 10 : 8,
        r = j === 0 ? 1.35 : 0.85;
      beam(face, point(-h, 0, y + 1), point(h, 0, y + 1), 0.3, 'accent');
      const rings = [
        [-1.2, r],
        [0, r * 0.55],
        [0.6, r * 0.35],
      ].map(([dy, r]) =>
        Array.from({ length: n }, (_, i) => [
          c[0] + Math.cos((i * tau) / n) * r,
          floor + y + dy,
          c[1] + Math.sin((i * tau) / n) * r,
        ]),
      );
      for (let k = 0; k < 2; k++)
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          face(
            'door',
            [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
            normal((i * tau) / n),
          );
        }
      cap(
        (s, p) => face(s, p, [0, -1, 0]),
        rings[0].map((p) => [p[0], p[2]]),
        y - 1.2,
        'accent',
      );
    }
  }
}
function build(out, d) {
  const face = writer(out, d);
  body(face, d);
  bell(face, d);
}
export const buildRioCathedralSkyline = (o) => build(o, 0),
  buildRioCathedralDistrict = (o) => build(o, 1),
  buildRioCathedralStreet = (o) => build(o, 2),
  buildRioCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const rioCathedralStudy = {
  id: 'rio_de_janeiro_cathedral',
  key: 'rio_de_janeiro_cathedral',
  title: 'Rio de Janeiro Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2411716',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Three retained raw main/crown/campanile plans. Main approximately107m diameter and crown33m; detached tower signs native-X/-Z quadrant.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Three cached256-square plain concrete, boardformed concrete and cast bronze graphs. Linear warm concrete/dark blue-gray glass tints, metric UVs and flat architectural normals. No embedded images, unique facade textures or baked shadows.',
  importReason:
    'Four authored levels preserve broad truncated cone, four inset window bands/crown cross and separate open tapered campanile.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two inspected2012/2016 pictures and standard viewer PMTiles/DEM. Concrete grille and glass artwork are simplified into merged bands/ribs and opaque dark glazing; no sculptural portal panels, statues or full interiors. Exact current finish, hidden portal details and bell shapes/heights remain approximate. Source-only bounded plaza grade is not a host terrain correction; noisy raw DEM can obscure the real runtime base. Physical laptop/phone measurements pending.',
    'Skyline preserves mapped truncated-cone/crown/window-axis massing and detached cross-topped campanile. District adds shared surfaces/coarse merged grille and open bell stages. Street refines concrete tiers/ribs, portal frames and selected bells; closeup/master refine rhythm. Synthetic cottages are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('concrete-louver-grid', [92, 47, 82], [32, 34, 28]),
    cam('inset-window-and-bronze-portal', [110, 25, 0], [47, 19, 0]),
    cam('cross-skylight-and-crown', [14, 128, 28], [0, 72, 0]),
    cam('open-campanile-and-bells', [-94, 43, -133], [-50.6, 34, -80.7]),
    cam('main-and-detached-tower', [-165, 108, -183], [-17, 32, -23]),
    cam('roof-and-signed-plan', [-12, 265, -12], [-12, 30, -12]),
  ],
};
