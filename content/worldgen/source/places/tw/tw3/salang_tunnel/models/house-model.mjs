/** Complete historical tunnel and protective galleries; original field and sections precede geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  S = JSON.parse(fs.readFileSync(new URL('../gallery-side-controls.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  road: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.2 },
};
const C = { concrete: rgb('b8b3a5'), road: rgb('68655e'), metal: rgb('65584a') },
  ref = 'palette:#ffffff';
export const partEvidence = [],
  routeEvidence = [],
  portalEvidence = [];
function face(o, k, points, expected, col = C[k]) {
  let ps = points;
  if (expected) {
    const n = normalFor(...ps);
    if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) ps = [...ps].reverse();
  }
  for (let j = 1; j < ps.length - 1; j++) {
    const t = [ps[0], ps[j], ps[j + 1]],
      n = normalFor(...t);
    o.addTriangle(
      k,
      ref,
      t,
      n,
      t.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
const unit = (x, z) => {
  const L = Math.hypot(x, z);
  return [x / L, z / L];
};
function station(route, s) {
  const q = Math.max(0, Math.min(route.lengthMeters, s));
  let i = route.chainageMeters.findIndex((v, j) => j > 0 && v >= q);
  if (i < 1) i = route.chainageMeters.length - 1;
  const a = route.roadFloorPoints[i - 1],
    b = route.roadFloorPoints[i],
    u = (q - route.chainageMeters[i - 1]) / (route.chainageMeters[i] - route.chainageMeters[i - 1]),
    V = unit(b[0] - a[0], b[2] - a[2]);
  return { p: a.map((v, k) => v + (b[k] - v) * u), U: [V[1], -V[0]], V, s: q };
}
export const routeStation = station;
function routeFrames(route) {
  return route.roadFloorPoints.map((p, i) => {
    const normals = [];
    if (i) {
      const a = route.roadFloorPoints[i - 1],
        v = unit(p[0] - a[0], p[2] - a[2]);
      normals.push([v[1], -v[0]]);
    }
    if (i < route.roadFloorPoints.length - 1) {
      const b = route.roadFloorPoints[i + 1],
        v = unit(b[0] - p[0], b[2] - p[2]);
      normals.push([v[1], -v[0]]);
    }
    let U = normals[0];
    if (normals.length === 2) {
      const n = unit(normals[0][0] + normals[1][0], normals[0][1] + normals[1][1]),
        m = n[0] * normals[0][0] + n[1] * normals[0][1];
      U = n.map((v) => v / m);
    }
    return { p, U, V: [-U[1], U[0]], s: route.chainageMeters[i] };
  });
}
const point = (f, [x, y]) => [f.p[0] + f.U[0] * x, f.p[1] + y, f.p[2] + f.U[1] * x];
function sweep(o, k, frames, profile, col = C[k]) {
  const rings = frames.map((f, i) =>
    (typeof profile === 'function' ? profile(f, i) : profile).map((p) => point(f, p)),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[0].length; i++) {
      const n = (i + 1) % rings[0].length;
      face(o, k, [rings[j - 1][i], rings[j - 1][n], rings[j][n], rings[j][i]], undefined, col);
    }
  face(o, k, rings[0], [-frames[0].V[0], 0, -frames[0].V[1]], col);
  face(o, k, rings.at(-1), [frames.at(-1).V[0], 0, frames.at(-1).V[1]], col);
}
const rectangle = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
function box(o, k, f, [x, y, z], [X, Y, Z], col = C[k]) {
  const A = { ...f, p: [f.p[0] + f.V[0] * z, f.p[1], f.p[2] + f.V[1] * z] },
    B = { ...f, p: [f.p[0] + f.V[0] * Z, f.p[1], f.p[2] + f.V[1] * Z] };
  sweep(o, k, [A, B], rectangle(x, y, X, Y), col);
}
export function boreSection(t) {
  const n = P.mainBore,
    dist = Math.abs(t - n.estimatedTightSectionAtFraction),
    blend = Math.max(0, 1 - dist / 0.22);
  return {
    width: n.nominalInnerWidth + (n.tightInnerWidth - n.nominalInnerWidth) * blend,
    height: n.nominalInnerHeight + (n.tightInnerHeight - n.nominalInnerHeight) * blend,
  };
}
function shellProfile(t, N, outer = false) {
  const s = boreSection(t),
    th = outer ? P.mainBore.liningThickness : 0,
    a = s.width / 2 + th,
    b = s.height - P.mainBore.wallSpringY + th,
    base = outer ? -P.foundationDepth : 0,
    ps = [[-a, base]];
  for (let j = 0; j <= N; j++) {
    const q = (j * Math.PI) / N;
    ps.push([-a * Math.cos(q), P.mainBore.wallSpringY + b * Math.sin(q)]);
  }
  ps.push([a, base]);
  return ps;
}
function bore(o, lod) {
  const route = P.routes[0],
    N = [2, 8, 12, 20][lod],
    fractions =
      lod === 0
        ? [0, P.mainBore.estimatedTightSectionAtFraction, 1]
        : [0, 0.3, P.mainBore.estimatedTightSectionAtFraction, 0.74, 1],
    frames = fractions.map((t) => station(route, t * route.lengthMeters)),
    inner = frames.map((f, i) => shellProfile(fractions[i], N).map((p) => point(f, p))),
    outer = frames.map((f, i) => shellProfile(fractions[i], N, true).map((p) => point(f, p)));
  for (let j = 1; j < frames.length; j++)
    for (let i = 0; i < inner[0].length - 1; i++) {
      face(o, 'concrete', [inner[j - 1][i], inner[j - 1][i + 1], inner[j][i + 1], inner[j][i]]);
      face(o, 'concrete', [outer[j - 1][i + 1], outer[j - 1][i], outer[j][i], outer[j][i + 1]]);
    }
  for (const j of [0, frames.length - 1])
    for (let i = 0; i < inner[0].length - 1; i++)
      face(
        o,
        'concrete',
        [outer[j][i], outer[j][i + 1], inner[j][i + 1], inner[j][i]],
        [(j === 0 ? -1 : 1) * frames[j].V[0], 0, (j === 0 ? -1 : 1) * frames[j].V[1]],
      );
  for (const side of [0, inner[0].length - 1])
    for (let j = 1; j < frames.length; j++)
      face(o, 'concrete', [outer[j - 1][side], inner[j - 1][side], inner[j][side], outer[j][side]]);
  const wide = P.mainBore.nominalInnerWidth / 2 + P.mainBore.liningThickness;
  sweep(o, 'concrete', frames, rectangle(-wide, -P.foundationDepth, wide, 0));
  sweep(o, 'road', frames, (f) =>
    rectangle(
      -boreSection(f.s / route.lengthMeters).width / 2 + P.road.walkwayWidth,
      0.004,
      boreSection(f.s / route.lengthMeters).width / 2 - P.road.walkwayWidth,
      0.025,
    ),
  );
  if (lod > 0)
    for (const side of [-1, 1]) {
      sweep(
        o,
        'concrete',
        frames,
        (f) => {
          const x =
            side * (boreSection(f.s / route.lengthMeters).width / 2 - P.road.walkwayWidth / 2);
          return rectangle(
            x - P.road.walkwayWidth / 2,
            0.025,
            x + P.road.walkwayWidth / 2,
            P.road.walkwayRise,
          );
        },
        rgb('9e9b90'),
      );
    }
  if (lod >= 2)
    for (let s = 120; s < route.lengthMeters - 50; s += 120) {
      const f = station(route, s),
        height = boreSection(s / route.lengthMeters).height;
      box(o, 'metal', f, [-0.24, height - 0.14, -0.6], [0.24, height - 0.05, 0.6]);
    }
  routeEvidence.push({
    id: route.id,
    kind: route.kind,
    nativeControls: route.nativePointCount,
    lengthMeters: route.lengthMeters,
    openBothEnds: true,
    archPanels: N,
  });
  partEvidence.push({
    id: 'whole-hollow-main-bore-two-open-ends-complete-lining-road-and-walkways',
  });
}
function gallery(o, route, lod) {
  const G = P.galleries,
    frames = routeFrames(route),
    half = G.innerWidth / 2,
    side = S.sides.find((s) => s.id === route.id).uphillSide,
    valley = -side;
  if (lod === 0) {
    // One closed C section retains the whole road, wall and roof at every native
    // bend, while removing coincident internal faces and intermediate supports.
    let profile = [
      [-half - G.retainingWallThickness, -P.foundationDepth],
      [half + G.retainingWallThickness, -P.foundationDepth],
      [half + G.retainingWallThickness, 0],
      [-half, 0],
      [-half, G.clearHeight],
      [half + G.retainingWallThickness, G.clearHeight],
      [half + G.retainingWallThickness, G.clearHeight + G.roofThickness],
      [-half - G.retainingWallThickness, G.clearHeight + G.roofThickness],
    ];
    if (side === 1) profile = profile.map(([x, y]) => [-x, y]).reverse();
    const rings = frames.map((f) => profile.map((p) => point(f, p)));
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < profile.length; i++) {
        const k = i === (side === -1 ? 2 : 4) ? 'road' : 'concrete',
          next = (i + 1) % profile.length;
        face(o, k, [rings[j - 1][i], rings[j - 1][next], rings[j][next], rings[j][i]]);
      }
    for (const [f, direction] of [
      [frames[0], -1],
      [frames.at(-1), 1],
    ]) {
      for (const rect of [
        rectangle(
          -half - G.retainingWallThickness,
          -P.foundationDepth,
          half + G.retainingWallThickness,
          0,
        ),
        rectangle(-half - G.retainingWallThickness, 0, -half, G.clearHeight),
        rectangle(
          -half - G.retainingWallThickness,
          G.clearHeight,
          half + G.retainingWallThickness,
          G.clearHeight + G.roofThickness,
        ),
      ])
        face(
          o,
          'concrete',
          rect.map(([x, y]) => point(f, [side === 1 ? -x : x, y])),
          [direction * f.V[0], 0, direction * f.V[1]],
        );
      const x = valley * (half + 0.05);
      box(
        o,
        'concrete',
        f,
        [x - G.columnWidth / 2, -P.foundationDepth, -G.columnDepth / 2],
        [x + G.columnWidth / 2, G.clearHeight, G.columnDepth / 2],
      );
    }
    routeEvidence.push({
      id: route.id,
      kind: route.kind,
      nativeControls: route.nativePointCount,
      lengthMeters: route.lengthMeters,
      uphillRetainingSide: side,
      openValleyBays: true,
      estimatedColumns: 2,
      closedUnifiedSection: true,
    });
    partEvidence.push({ id: `${route.id}-whole-roof-road-uphill-wall-open-valley-supports` });
    return;
  }
  sweep(
    o,
    'concrete',
    frames,
    rectangle(
      -half - G.retainingWallThickness,
      -P.foundationDepth,
      half + G.retainingWallThickness,
      0,
    ),
  );
  sweep(o, 'road', frames, rectangle(-half + 0.4, 0.004, half - 0.4, 0.025));
  sweep(
    o,
    'concrete',
    frames,
    rectangle(
      -half - G.retainingWallThickness,
      G.clearHeight,
      half + G.retainingWallThickness,
      G.clearHeight + G.roofThickness,
    ),
  );
  const center = side * (half + G.retainingWallThickness / 2);
  sweep(
    o,
    'concrete',
    frames,
    rectangle(
      center - G.retainingWallThickness / 2,
      0,
      center + G.retainingWallThickness / 2,
      G.clearHeight,
    ),
  );
  if (lod > 0) {
    const x = valley * (half - 0.18);
    sweep(o, 'concrete', frames, rectangle(x - 0.18, 0, x + 0.18, G.curbHeight));
  }
  const pitch = [120, 30, 12, G.estimatedColumnPitch][lod];
  let columns = 0;
  for (let s = 0; s <= route.lengthMeters; s += pitch) {
    const f = station(route, Math.min(s, route.lengthMeters)),
      x = valley * (half + 0.05);
    box(
      o,
      'concrete',
      f,
      [x - G.columnWidth / 2, -P.foundationDepth, -G.columnDepth / 2],
      [x + G.columnWidth / 2, G.clearHeight, G.columnDepth / 2],
    );
    if (lod >= 2)
      box(
        o,
        'concrete',
        f,
        [-half - G.retainingWallThickness, G.clearHeight - G.beamDepth, -0.22],
        [half + G.retainingWallThickness, G.clearHeight, 0.22],
        rgb('aca99e'),
      );
    columns++;
  }
  // The far end always retains a support even when the estimated spacing has a remainder.
  {
    const f = station(route, route.lengthMeters),
      x = valley * (half + 0.05);
    box(
      o,
      'concrete',
      f,
      [x - G.columnWidth / 2, -P.foundationDepth, -G.columnDepth / 2],
      [x + G.columnWidth / 2, G.clearHeight, G.columnDepth / 2],
    );
    columns++;
  }
  routeEvidence.push({
    id: route.id,
    kind: route.kind,
    nativeControls: route.nativePointCount,
    lengthMeters: route.lengthMeters,
    uphillRetainingSide: side,
    openValleyBays: true,
    estimatedColumns: columns,
  });
  partEvidence.push({ id: `${route.id}-whole-roof-road-uphill-wall-open-valley-supports` });
}
function portal(o, name, lod) {
  const r = P.routes[0],
    cfg = P.portals[name],
    north = name === 'north',
    f = station(r, north ? 0 : r.lengthMeters),
    F = north ? { ...f, V: f.V.map((v) => -v), U: f.U.map((v) => -v) } : f,
    w = cfg.openingWidth / 2,
    dep = cfg.depth;
  for (const side of [-1, 1]) {
    const x = side * (w + cfg.pierWidth / 2);
    box(
      o,
      'concrete',
      F,
      [x - cfg.pierWidth / 2, -P.foundationDepth, -dep],
      [x + cfg.pierWidth / 2, cfg.pierTop, 0.12],
    );
    box(
      o,
      'concrete',
      F,
      [side < 0 ? -w - cfg.pierWidth - 0.8 : w + 0.1, 0, 0.12],
      [side < 0 ? -w - 0.1 : w + cfg.pierWidth + 0.8, 1.1, cfg.wingLength],
      rgb('9e9b90'),
    );
    if (lod > 0)
      for (const y of cfg.courseHeights ?? [2.4])
        box(
          o,
          'concrete',
          F,
          [x - cfg.pierWidth / 2 - 0.025, y, -dep - 0.025],
          [x + cfg.pierWidth / 2 + 0.025, y + 0.065, 0.17],
          rgb('a8a496'),
        );
    if (lod >= 2) {
      box(
        o,
        'concrete',
        F,
        [x - cfg.pierWidth / 2 - 0.08, cfg.pierTop - 0.16, -dep - 0.08],
        [x + cfg.pierWidth / 2 + 0.08, cfg.pierTop, 0.2],
        rgb('c6c0b1'),
      );
      for (const xx of [x - 0.5, x + 0.5])
        box(
          o,
          'concrete',
          F,
          [xx - 0.06, cfg.pierTop - 1.35, 0.13],
          [xx + 0.06, cfg.pierTop - 0.5, 0.19],
          rgb('aaa99d'),
        );
    }
  }
  box(o, 'concrete', F, [-w, cfg.openingHeight, -dep], [w, cfg.beamTop, 0.12], rgb('aaa390'));
  if (lod > 0) {
    box(
      o,
      'metal',
      F,
      [-w, cfg.openingHeight - 0.08, -0.1],
      [w, cfg.openingHeight + 0.13, 0.19],
      rgb('6e5a43'),
    );
    if (lod >= 2)
      for (let x = -w + 0.5; x < w; x += 0.9)
        box(
          o,
          'metal',
          F,
          [x - 0.015, cfg.openingHeight - 0.06, 0.195],
          [x + 0.015, cfg.openingHeight + 0.11, 0.215],
        );
  }
  portalEvidence.push({
    name,
    frame: F,
    openingWidth: cfg.openingWidth,
    openingHeight: cfg.openingHeight,
    pierTop: cfg.pierTop,
    nativeEndpoint: [...f.p],
    geometryBasis: cfg.basis,
  });
  partEvidence.push({
    id: `${name}-complete-portal-piers-transverse-beam-true-opening-and-retaining-returns`,
  });
}
export function buildHouse(out, _frame, lod = 3) {
  for (const a of [partEvidence, routeEvidence, portalEvidence]) a.length = 0;
  bore(out, lod);
  for (const route of P.routes.slice(1)) gallery(out, route, lod);
  portal(out, 'north', lod);
  portal(out, 'south', lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tw/tw3/salang_tunnel',
  f = station(P.routes[0], 0),
  cam = ([u, y, v]) => [
    f.p[0] + f.U[0] * u + f.V[0] * v,
    f.p[1] + y,
    f.p[2] + f.U[1] * u + f.V[1] * v,
  ],
  galleryRoute = P.routes[1],
  gf = station(galleryRoute, galleryRoute.lengthMeters * 0.5),
  galleryCam = [gf.p[0] + gf.U[0] * 70, gf.p[1] + 24, gf.p[2] + gf.U[1] * 70],
  camera = [6200, 4200, 6100],
  look = [0, -55, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Salang Tunnel and protective galleries (2011)',
  wikidataId: 'Q1917594',
  cell: 'tw/tw3',
  category: 'transport',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera: cam([15, 9, -38]),
  lookAt: cam([0, 3.6, 5]),
  portableGroundY: -170,
  mediumFiContext: {
    scale: 1,
    groundY: -170,
    far: 25000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-bore-and-both-kilometer-scale-native-protective-galleries',
      position: camera,
      lookAt: look,
    },
    {
      name: 'north-portal-full-piers-beam-true-opening-and-retaining-returns',
      position: cam([11, 5, -30]),
      lookAt: cam([0, 3.7, 5]),
    },
    {
      name: 'north-protective-gallery-open-valley-bays-whole-roof-and-uphill-wall',
      position: galleryCam,
      lookAt: [gf.p[0], gf.p[1] + 2.5, gf.p[2]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `north-portal-and-bore-${reviewLod}`,
    position: cam([15, 9, -38]),
    lookAt: cam([0, 3.6, 5]),
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Four exact named U.S. Army DVIDS public-domain published renditions, with official units, Army VIRIN and primary release records, used after prior published-corpus search. USACE 2012 primary engineering TEXT supplies curved tube/variable constriction/galleries/road/walkway context. OSM ODbL whole main bore and northern/southern gallery centerlines: all2/22/24 controls retained. Approximate2011 phase, not current2026 repairs. Hidden section, exact historical route registration, bay census, southern portal and road grade are estimates. No copied banners/graffiti/insignia/vehicles/people/snow, mountain mesh, unrelated culverts, copyrighted images or phototextures. Original field/frame/floors/main sections remain unchanged.',
};
