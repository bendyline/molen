/** Bijlmer ArenA: native platform geometry, elevated open decks and folded timber/glass canopies. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u1/u17/amsterdam_bijlmer_arena_station/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    concrete: rgb('b8bbb5'),
    steel: rgb('596c73'),
    wood: rgb('b28b60'),
    roof: rgb('c8ccca'),
    glass: rgb('7f9ca4'),
    track: rgb('4e5555'),
  };
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.28 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.73, metallic: 0.3 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.24, metallic: 0.1 },
  track: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
};
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, outer, holes, y, up = true) {
  const p = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, p) => s + p.length, 0),
    ),
    ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function walls(o, s, p, y0, y1, inside = false) {
  const area = p.reduce(
      (a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1],
      0,
    ),
    sign = (area > 0 ? 1 : -1) * (inside ? -1 : 1);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function slab(o, s, p, holes, y0, y1) {
  cap(o, s, p, holes, y1);
  cap(o, s, p, holes, y0, false);
  walls(o, s, p, y0, y1);
  for (const h of holes) walls(o, s, h, y0, y1, true);
}
const rect = (x, z, w, l) => [
  [x - w / 2, z - l / 2],
  [x + w / 2, z - l / 2],
  [x + w / 2, z + l / 2],
  [x - w / 2, z + l / 2],
];
function interpolate(t, z) {
  const a = t.nativeCenterLine;
  let i = a.findIndex((p) => p[1] >= z);
  if (i < 0) i = a.length - 1;
  else if (i === 0) i = 1;
  const p = a[i - 1],
    q = a[i];
  return p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]);
}
function platform(o, p, d) {
  slab(o, 'concrete', p.outline, p.holes, 8.8, 10);
  if (d >= 1) {
    // Native platform lips remain separate; adjacent half-islands and the metro stair hole are not filled.
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 5) continue;
      if (d >= 2) beam(o, 'roof', [a[0], 10.025, a[1]], [b[0], 10.025, b[1]], 0.22, 0.05, C.roof);
    }
  }
}
function decks(o, d) {
  for (let i = 0; i < 4; i++) {
    const a = plan.tracks[i * 2],
      b = plan.tracks[i * 2 + 1],
      x = (a.x + b.x) / 2,
      lo = [-207, -191, -149, -174][i],
      hi = [157, 175, 204, 210][i];
    box(o, 'concrete', [x - 5.6, 7.8, lo], [x + 5.6, 8.9, hi], C.concrete);
    const count = [2, 6, 12, 18][d];
    for (let j = 0; j < count; j++) {
      const z = lo + 12 + ((hi - lo - 24) * j) / (count - 1);
      const p0 = rect(x, z, 1.25, 1.65),
        p1 = rect(x, z, 1.55, 1.9),
        p2 = rect(x, z, 8.8, 2.2);
      if (d === 0)
        box(o, 'concrete', [x - 0.65, -0.4, z - 0.8], [x + 0.65, 7.8, z + 0.8], C.concrete);
      else {
        loft(
          o,
          'concrete',
          [
            [...p0].reverse().map((p) => [p[0], -0.4, p[1]]),
            [...p1].reverse().map((p) => [p[0], 6.5, p[1]]),
            [...p2].reverse().map((p) => [p[0], 7.8, p[1]]),
          ],
          C.concrete,
        );
      }
    }
  }
  if (d >= 1)
    for (const t of plan.tracks) {
      const lo = -190,
        hi = 195,
        n = d === 1 ? 2 : d === 2 ? 8 : 18;
      for (let j = 0; j < n; j++) {
        const z0 = lo + ((hi - lo) * j) / n,
          z1 = lo + ((hi - lo) * (j + 1)) / n,
          x0 = interpolate(t, z0),
          x1 = interpolate(t, z1);
        Q(
          o,
          'track',
          [
            [x0 - 1.4, 9.02, z0],
            [x0 + 1.4, 9.02, z0],
            [x1 + 1.4, 9.02, z1],
            [x1 - 1.4, 9.02, z1],
          ],
          [0, 1, 0],
        );
        if (d >= 2)
          for (const dx of [-0.7175, 0.7175])
            beam(o, 'steel', [x0 + dx, 9.19, z0], [x1 + dx, 9.19, z1], 0.075, 0.11, C.steel);
      }
      if (d === 3)
        for (let z = lo; z < hi; z += 3.2) {
          const x = interpolate(t, z);
          box(o, 'track', [x - 1.1, 9.04, z - 0.12], [x + 1.1, 9.1, z + 0.12], rgb('737b78'));
        }
    }
}
function roofPoint(x, z, side) {
  const diagonal = 0.62 * x - 24,
    dist = Math.abs(z - diagonal),
    sweep = side < 0 ? Math.max(0, 1 - dist / 95) : Math.max(0, 1 - dist / 125);
  const edges = plan.roof.crossEdges;
  let i = edges.findIndex((e) => e >= x) - 1;
  if (i < 0) i = 0;
  if (i > 4) i = 4;
  const a = edges[i],
    b = edges[i + 1],
    u = (x - a) / (b - a),
    fold = Math.abs(u * 2 - 1);
  return [x, 18.5 + fold * 3.0 + sweep * (side < 0 ? 4 : 1.3), z];
}
function canopy(o, d) {
  const edges = plan.roof.crossEdges;
  for (let i = 0; i < 5; i++) {
    const x0 = edges[i] + 0.2,
      x1 = edges[i + 1] - 0.2,
      width = x1 - x0;
    for (const side of [-1, 1]) {
      const zAt = (x, t) => {
          const split = 0.62 * x - 24 + side * 2,
            end = 0.62 * x + 20 + side * 100;
          return split + (end - split) * t;
        },
        cross = [0, 1 / 6, 0.5, 5 / 6, 1],
        segments = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 8;
      for (let k = 1; k < cross.length; k++) {
        const a = x0 + cross[k - 1] * width,
          b = x0 + cross[k] * width,
          glass = k === 1 || k === 4;
        for (let j = 0; j < segments; j++) {
          const t0 = j / segments,
            t1 = (j + 1) / segments,
            p = [
              roofPoint(a, zAt(a, t0), side),
              roofPoint(b, zAt(b, t0), side),
              roofPoint(b, zAt(b, t1), side),
              roofPoint(a, zAt(a, t1), side),
            ];
          Q(o, glass ? 'glass' : 'roof', p, [0, 1, 0]);
          if (d >= 1)
            Q(
              o,
              glass ? 'glass' : 'wood',
              p.map((p) => [p[0], p[1] - 0.18, p[2]]),
              [0, -1, 0],
            );
        }
      }
      if (d >= 1) {
        // Exposed steel rim and diagonal cleft frame; no painted solid facade across the open concourse.
        for (const t of [0, 1])
          for (let k = 1; k < cross.length; k++) {
            const a = x0 + cross[k - 1] * width,
              b = x0 + cross[k] * width;
            beam(
              o,
              'steel',
              roofPoint(a, zAt(a, t), side),
              roofPoint(b, zAt(b, t), side),
              0.22,
              0.32,
              C.steel,
            );
          }
        for (const x of [x0, x1])
          beam(
            o,
            'steel',
            roofPoint(x, zAt(x, 0), side),
            roofPoint(x, zAt(x, 1), side),
            0.2,
            0.32,
            C.steel,
          );
      }
      if (d >= 2) {
        const ribs = d === 2 ? 3 : 10;
        for (let j = 1; j < ribs; j++) {
          const t = j / ribs;
          for (let k = 1; k < cross.length; k++) {
            const a = x0 + cross[k - 1] * width,
              b = x0 + cross[k] * width,
              pa = roofPoint(a, zAt(a, t), side),
              pb = roofPoint(b, zAt(b, t), side);
            beam(
              o,
              'steel',
              pa.map((v, i) => (i === 1 ? v - 0.32 : v)),
              pb.map((v, i) => (i === 1 ? v - 0.32 : v)),
              0.12,
              0.24,
              C.steel,
            );
          }
        }
        if (d === 3)
          for (let j = 0; j < 18; j++) {
            const x = x0 + width * (1 / 6 + ((2 / 3) * (j + 0.5)) / 18),
              a = roofPoint(x, zAt(x, 0.04), side),
              b = roofPoint(x, zAt(x, 0.96), side);
            beam(
              o,
              'wood',
              a.map((v, i) => (i === 1 ? v - 0.22 : v)),
              b.map((v, i) => (i === 1 ? v - 0.22 : v)),
              0.035,
              0.045,
              rgb('897149'),
            );
          }
      }
    }
    const x = (x0 + x1) / 2,
      count = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 6 : 9;
    for (let j = 0; j < count; j++) {
      const z = 0.62 * x + 20 - 88 + (176 * j) / (count - 1),
        top = roofPoint(x, z, z < 0.62 * x - 24 ? -1 : 1),
        foot = [x + (j % 2 ? 1 : -1) * 1.1, 10, z];
      beam(
        o,
        'steel',
        foot,
        [top[0], top[1] - 0.35, top[2]],
        d < 2 ? 0.4 : 0.26,
        d < 2 ? 0.55 : 0.38,
        C.steel,
      );
      if (d >= 2) {
        const side = j % 2 ? 1 : -1;
        beam(
          o,
          'steel',
          [foot[0], 11.2, z],
          [x + side * width * 0.3, top[1] - 0.1, z],
          0.18,
          0.28,
          C.steel,
        );
      }
    }
  }
}
function stairBank(o, x, z, d, width = 3.8) {
  // Intrinsic exterior stair/escalator access. Estimated flight sections; no modeled passengers or shops.
  const len = 20,
    y0 = 0.12,
    y1 = 10,
    n = d === 0 ? 0 : d === 1 ? 10 : d === 2 ? 28 : 56;
  if (d === 0) return;
  for (const dx of [-2.8, 2.8]) {
    const xx = x + dx,
      w = dx < 0 ? width : 2.6;
    if (d === 1) beam(o, 'concrete', [xx, y0, z], [xx, y1, z + len], w, 0.5, C.concrete);
    else
      for (let j = 0; j < n; j++)
        box(
          o,
          dx < 0 ? 'concrete' : 'steel',
          [xx - w / 2, y0 + ((y1 - y0) * j) / n, z + (len * j) / n],
          [xx + w / 2, y0 + ((y1 - y0) * (j + 1)) / n, z + (len * (j + 1)) / n + 0.02],
          dx < 0 ? C.concrete : C.steel,
        );
    beam(o, 'concrete', [xx, y0 - 0.2, z], [xx, y1 - 0.2, z + len], w, 0.35, C.concrete);
    for (const s of [-1, 1]) {
      const a = [xx + (s * w) / 2, 0.95, z],
        b = [xx + (s * w) / 2, 10.85, z + len];
      beam(o, 'steel', a, b, 0.08, 0.1, C.steel);
      if (d >= 2) {
        Q(o, 'glass', [[a[0], a[1] - 0.7, a[2]], a, b, [b[0], b[1] - 0.7, b[2]]], [s, 0, 0]);
        for (let j = 0; j <= 4; j++) {
          const u = j / 4;
          beam(
            o,
            'steel',
            [a[0], y0 + (y1 - y0) * u, z + len * u],
            [a[0], a[1] + (b[1] - a[1]) * u, z + len * u],
            0.055,
            0.055,
            C.steel,
          );
        }
      }
    }
  }
}
function screens(o, d) {
  if (d === 0) return;
  for (const x of [-45, 45]) {
    const z0 = 0.62 * x - 80,
      z1 = 0.62 * x + 115,
      y = 11.2;
    Q(
      o,
      'glass',
      [
        [x, y, z0],
        [x, y + 5, z0],
        [x, y + 5, z1],
        [x, y, z1],
      ],
      [x < 0 ? -1 : 1, 0, 0],
    );
    const n = d === 1 ? 5 : d === 2 ? 13 : 32;
    for (let j = 0; j <= n; j++) {
      const z = z0 + ((z1 - z0) * j) / n;
      beam(o, 'steel', [x, y, z], [x, y + 5, z], 0.09, 0.14, C.steel);
    }
    for (const yy of [y, y + 2.5, y + 5])
      beam(o, 'steel', [x, yy, z0], [x, yy, z1], 0.1, 0.14, C.steel);
  }
  if (d >= 2)
    for (const t of plan.tracks.filter((t) => t.mode === 'rail')) {
      const zs = d === 2 ? [-80, 100] : [-160, -100, -40, 20, 80, 140];
      for (const z of zs) {
        const x = interpolate(t, z);
        beam(o, 'steel', [x + 2.5, 10, z], [x + 2.5, 15.5, z], 0.08, 0.11, C.steel);
        beam(o, 'steel', [x - 2, 15.5, z], [x + 2.5, 15.5, z], 0.055, 0.07, C.steel);
      }
      if (d === 3)
        beam(
          o,
          'steel',
          [interpolate(t, -180), 14.6, -180],
          [interpolate(t, 185), 14.6, 185],
          0.022,
          0.025,
          C.steel,
        );
    }
}
function access(o, d) {
  if (d === 0) return;
  // Four broad access banks join the diagonal concourse to the principal platform islands.
  for (const [x, z] of [
    [-43, -58],
    [-25, -48],
    [-4, -17],
    [17, -7],
  ])
    stairBank(o, x, z, d, x === -43 ? 2.5 : 3.4);
  if (d >= 2) {
    for (const [x, z, w, l] of [
      [-42, 36, 5, 21],
      [35, 72, 6, 22],
    ]) {
      box(o, 'concrete', [x - w / 2, 0, z - l / 2], [x + w / 2, 4.7, z + l / 2], C.concrete);
      for (const side of [-1, 1])
        Q(
          o,
          'glass',
          [
            [x + (side * w) / 2, 1, z - l / 2 + 0.4],
            [x + (side * w) / 2, 1, z + l / 2 - 0.4],
            [x + (side * w) / 2, 4.2, z + l / 2 - 0.4],
            [x + (side * w) / 2, 4.2, z - l / 2 + 0.4],
          ],
          [side, 0, 0],
        );
    }
  }
}
function build(o, _frame, d = 3) {
  for (const p of plan.platforms) platform(o, p, d);
  decks(o, d);
  canopy(o, d);
  screens(o, d);
  access(o, d);
}
export const bijlmerSkyline = (o, f) => build(o, f, 0),
  bijlmerDistrict = (o, f) => build(o, f, 1),
  bijlmerStreet = (o, f) => build(o, f, 2);
export const amsterdamBijlmerArenaStationModel = {
  id: 'amsterdam_bijlmer_arena_station',
  key: 'amsterdam_bijlmer_arena_station',
  recipe: 'structure-amsterdam-bijlmer-arena-station.mjs',
  cell: 'u1/u17',
  title: 'Amsterdam Bijlmer ArenA station',
  category: 'railway-station',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete open elevated station with five timber/glass folded canopy ribbons, diagonal roof cleft and concourse, eight rail lanes on four separate pier-supported viaducts, original long platform vertices/short metro island/stair-light openings, inclined steel columns and roof ribs, framed screens and intrinsic stair/escalator access. Ordinary geographic identity; no neighboring arena/concert hall, trains/people/public plaza or natural ground. Native platform plan, photo/text-controlled characteristic forms and explicitly approximate roof sections/support census.',
  camera: [205, 115, 270],
  lookAt: [0, 10, 0],
  portableGroundY: -0.58,
  mediumFiContext: { scale: 2, groundY: -0.58 },
  qaCameras: [
    {
      name: 'five-folded-ribbons-diagonal-cleft-eight-track-open-station',
      position: [140, 165, 210],
      lookAt: [0, 13, 10],
      reviewLod: 'skyline',
    },
    {
      name: 'open-concourse-viaduct-piers-and-stair-escalator-banks',
      position: [-87, 12, -62],
      lookAt: [0, 8, -10],
    },
    {
      name: 'timber-soffits-steel-ribs-glass-strips-and-platforms',
      position: [-20, 14, 55],
      lookAt: [-3, 18, -28],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed west boulevard approach[-58,-35]chosen before raw terrain. Platform/roof levels and footings are bounded architectural estimates; exact host attachment remains approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-amsterdam-bijlmer-arena-station.mjs',
    level: 'skyline',
    export: 'bijlmerSkyline',
    errorMeters: 5,
    surfaces,
    authoredLevels: {
      district: { export: 'bijlmerDistrict', errorMeters: 2, surfaces },
      street: { export: 'bijlmerStreet', errorMeters: 0.6, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Only three native published Qualla creator own-work PD-self originals control imagery: Mojito platform and concourse photographs and Erik1980 overview station portion. All matched to pinned primary native SHA1 and actually inspected. Neighboring concert hall, trains, people, signs/logos and shops are excluded. Six assumed-source2005pictures and all attribution images excluded; panorama is context only. No outside image, photo texture or generated bitmap.',
    'Original platform and metro stair/lightwell rings and eight track intersections are preserved. Rail paths interpolate original centerlines, with tangent extensions where source ways stop before platform ends. Four viaduct deck widths/sections, pier locations and cantilever supports are explicit estimates. No solid ground-level building or parcel slab fills the open station; longitudinal daylight gaps and diagonal access remain real openings.',
    'Primary architect text controls eight raised tracks,70m boulevard, diagonal split/daylight openings and folded roof identity; builder controls four nominal350m viaducts and18000m²roof/one-third glass. Five nominal200m roof ribbons follow the rail axis with photo-estimated fold/sweep profiles and registration. Native mapped platform extremities include staggered/apron lengths and are not resized to rounded published platform lengths. Exact current roof survey, screens, room/bay census and minor alterations unverified.',
    'Platform10m/trackbed9m/deckbottom7.8m, roof18.5-25.5m and footings-.4m are interpreted sections rather than surveyed elevations. Ground-contact datum chosen before independent raw520mTerrarium field. Source heights can include buildings/vegetation or elevated rail features; no flattening/fitting. Flat inspection stage is not a geographic grade certification.',
    'Intrinsic exterior stairs/escalators, grilles/screens/roof ribs/timber slats, representative overhead contact supports and two low auxiliary enclosures simplify with distance. No full operating rail system, rolling stock, copied signs, interior shops or off-site road/bus structures. Original metro lightwell is preserved; concealed room partitions and foundations omitted.',
  ],
};
