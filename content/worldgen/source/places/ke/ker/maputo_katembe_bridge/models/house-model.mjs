/** Whole native crossing and elevated approaches; published engineering metrics, no imagery. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const B = P.bridge,
  ref = 'palette:#ffffff';
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  pier: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.35 },
  road: { slot: 'roof', localRef: 'palette:#535658', roughness: 0.97, metallic: 0 },
  paint: { slot: 'trim', localRef: 'palette:#d6d5c8', roughness: 0.9, metallic: 0 },
};
const C = {
  concrete: rgb('bdbfb6'),
  pier: rgb('b4b7af'),
  metal: rgb('b7c0bd'),
  road: rgb('535658'),
  paint: rgb('d6d5c8'),
};
export const deckEvidence = [],
  towerEvidence = [],
  cableEvidence = [],
  supportEvidence = [];
const norm = (v) => {
    const L = Math.hypot(...v);
    return v.map((n) => n / L);
  },
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  sub = (a, b) => a.map((v, i) => v - b[i]);
function face(o, k, p, n) {
  let q = normalFor(...p);
  if (n && q.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    q = normalFor(...p);
  }
  o.addConvexPolygon(k, ref, p, q, (x) => [x[0], x[1]], C[k]);
}
export function roadY(s) {
  const a = B.mainSpanStart,
    b = B.mainSpanEnd,
    L = P.mainLength;
  return s < a
    ? P.mainFloors[0] + (B.deckTop - P.mainFloors[0]) * (s / a)
    : s > b
      ? B.deckTop + (P.mainFloors.at(-1) - B.deckTop) * ((s - b) / (L - b))
      : B.deckTop;
}
export function pose(s) {
  s = Math.max(0, Math.min(P.mainLength, s));
  let i = P.mainStations.findIndex((v) => v >= s);
  if (i < 1) i = 1;
  const a = P.mainCenterline[i - 1],
    b = P.mainCenterline[i],
    t = (s - P.mainStations[i - 1]) / (P.mainStations[i] - P.mainStations[i - 1]),
    U = norm([b[0] - a[0], b[1] - a[1]]);
  return {
    point: a.map((v, k) => v + t * (b[k] - v)),
    along: U,
    across: [-U[1], U[0]],
    station: s,
    y: roadY(s),
  };
}
function world(A, x, y, z = 0) {
  return [
    A.point[0] + A.across[0] * x + A.along[0] * z,
    y,
    A.point[1] + A.across[1] * x + A.along[1] * z,
  ];
}
function box(o, k, A, x0, x1, y0, y1, z0, z1) {
  if (y1 <= y0) return;
  const p = (x, y, z) => world(A, x, y, z);
  for (const [pts, n] of [
    [
      [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)],
      [-A.along[0], 0, -A.along[1]],
    ],
    [
      [p(x1, y0, z1), p(x0, y0, z1), p(x0, y1, z1), p(x1, y1, z1)],
      [A.along[0], 0, A.along[1]],
    ],
    [
      [p(x0, y0, z1), p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1)],
      [-A.across[0], 0, -A.across[1]],
    ],
    [
      [p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)],
      [A.across[0], 0, A.across[1]],
    ],
    [
      [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)],
      [0, 1, 0],
    ],
    [
      [p(x0, y0, z1), p(x1, y0, z1), p(x1, y0, z0), p(x0, y0, z0)],
      [0, -1, 0],
    ],
  ])
    face(o, k, pts, n);
}
function tube(o, points, radius, sides) {
  const rings = points.map((p, i) => {
    const d = norm(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)])),
      u = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])),
      v = cross(d, u);
    return Array.from({ length: sides }, (_, j) => {
      const a = (j * Math.PI * 2) / sides;
      return p.map((q, k) => q + radius * (Math.cos(a) * u[k] + Math.sin(a) * v[k]));
    });
  });
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides,
        p = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]],
        center = points[i].map((v, k) => (v + points[i + 1][k]) / 2),
        n = p[0].map((v, k) => v - center[k]);
      face(o, 'metal', p, n);
    }
  face(o, 'metal', rings[0], sub(points[0], points[1]));
  face(o, 'metal', rings.at(-1), sub(points.at(-1), points.at(-2)));
}
function simplify(points, epsilon) {
  if (points.length <= 2) return points;
  const a = points[0],
    b = points.at(-1),
    v = sub(b, a),
    L = v[0] * v[0] + v[1] * v[1];
  let best = 0,
    index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i],
      t = Math.max(0, Math.min(1, sub(p, a).reduce((s, n, k) => s + n * v[k], 0) / L)),
      d = Math.hypot(...p.map((n, k) => n - a[k] - t * v[k]));
    if (d > best) {
      best = d;
      index = i;
    }
  }
  return best > epsilon
    ? [
        ...simplify(points.slice(0, index + 1), epsilon).slice(0, -1),
        ...simplify(points.slice(index), epsilon),
      ]
    : [a, b];
}
function section(A, width, depth) {
  const h = width / 2,
    p = (x, y) => world(A, x, y);
  return { a: p(-h, A.y), b: p(h, A.y), c: p(h * 0.87, A.y - depth), d: p(-h * 0.87, A.y - depth) };
}
function deck(o, id, frames, width, lod, isMain) {
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i],
      b = frames[i + 1],
      mid = (a.station + b.station) / 2,
      steel = isMain && mid >= B.mainSpanStart && mid <= B.mainSpanEnd,
      depth = steel ? B.deckDepth : B.approachDepth,
      k = steel ? 'metal' : 'concrete',
      A = section(a, width, depth),
      D = section(b, width, depth);
    face(o, 'road', [A.a, A.b, D.b, D.a], [0, 1, 0]);
    face(o, k, [A.d, D.d, D.c, A.c], [0, -1, 0]);
    face(o, k, [A.a, D.a, D.d, A.d], [-a.across[0], 0, -a.across[1]]);
    face(o, k, [A.b, A.c, D.c, D.b], [a.across[0], 0, a.across[1]]);
    if (i === 0) face(o, k, [A.a, A.d, A.c, A.b], [-a.along[0], 0, -a.along[1]]);
    if (i === frames.length - 2) face(o, k, [D.a, D.b, D.c, D.d], [b.along[0], 0, b.along[1]]);
    if (lod >= 2) {
      for (const side of [-1, 1]) {
        const x = side * (width / 2 - 0.2);
        beam(
          o,
          'concrete',
          world(a, x, a.y + 0.48),
          world(b, x, b.y + 0.48),
          B.barrierWidth,
          0.96,
          C.concrete,
        );
        if (lod === 3)
          beam(
            o,
            'metal',
            world(a, x, a.y + B.barrierHeight),
            world(b, x, b.y + B.barrierHeight),
            0.075,
            0.075,
            C.metal,
          );
      }
      beam(o, 'concrete', world(a, 0, a.y + 0.32), world(b, 0, b.y + 0.32), 0.45, 0.64, C.concrete);
      if (lod === 3 && isMain) {
        for (const x of [-width / 4, width / 4]) {
          const lineA = world(a, x, a.y + 0.014),
            lineB = world(b, x, b.y + 0.014),
            t = 0.48,
            end = lineA.map((v, k) => v + t * (lineB[k] - v));
          beam(o, 'paint', lineA, end, 0.14, 0.018, C.paint);
        }
      }
      if (lod === 3 && !steel) {
        for (const x of [-width * 0.31, width * 0.1, width * 0.31])
          beam(o, 'pier', world(a, x, a.y - 1.25), world(b, x, b.y - 1.25), 0.5, 2.1, C.pier);
      }
    }
  }
  deckEvidence.push({ id, frames: frames.length, width, wholeNativePath: true });
}
function mainFrames(lod) {
  const epsilon = [30, 8, 0, 0][lod],
    selected = epsilon ? simplify(P.mainCenterline, epsilon) : P.mainCenterline,
    stations = selected.map((p) => P.mainStations[P.mainCenterline.indexOf(p)]);
  stations.push(B.mainSpanStart, B.mainSpanEnd);
  if (lod === 3) for (let s = 0; s < P.mainLength; s += 30) stations.push(s);
  const frames = [...new Set(stations)].sort((a, b) => a - b).map(pose);
  // Each carriageway terminates on a slightly different longitudinal cut. A short
  // end slab contains both original terminal controls without moving either path.
  const end = (a, sign) => ({
    ...a,
    point: a.point.map((v, i) => v + sign * 2 * a.along[i]),
    station: a.station + sign * 2,
  });
  return [end(frames[0], -1), ...frames, end(frames.at(-1), 1)];
}
function extraFrames(road, lod) {
  const selected =
    lod === 0 ? simplify(road.points, 35) : lod === 1 ? simplify(road.points, 10) : road.points;
  return selected.map((p) => {
    const i = road.points.indexOf(p),
      a = road.points[Math.max(0, i - 1)],
      b = road.points[Math.min(road.points.length - 1, i + 1)],
      U = norm(sub(b, a));
    return {
      point: p,
      along: U,
      across: [-U[1], U[0]],
      station: road.stations[i],
      y: road.floors[i],
    };
  });
}
function support(o, A, ground, y, lod, wide = true) {
  if (y - ground < 2.7) return;
  const top = y - B.approachDepth - 0.3,
    W = wide ? 9 : 4;
  box(o, 'pier', A, -W / 2, W / 2, ground - 1, top, -1.65, 1.65);
  if (lod >= 2) {
    box(o, 'pier', A, -(wide ? 12 : 5), wide ? 12 : 5, top, top + 0.9, -2.2, 2.2);
    box(o, 'concrete', A, -(W / 2 + 1), W / 2 + 1, ground - 1.5, ground - 0.8, -2.6, 2.6);
  }
  supportEvidence.push({ point: A.point, ground, deckY: y });
}
function tower(o, T, lod) {
  const A = pose(T.station),
    top = T.ground + T.height,
    offset = 17.8;
  for (const side of [-1, 1]) {
    const x = offset * side;
    box(o, 'pier', A, x - 2.7, x + 2.7, T.ground - 2, top, x * 0 - 3.2, 3.2);
    if (lod >= 2) {
      box(o, 'concrete', A, x - 5, x + 5, T.ground - 2.4, T.ground + 0.4, -5, 5);
      box(o, 'metal', A, x - 2.8, x + 2.8, top - 0.4, top + 0.25, -2.1, 2.1);
    }
  }
  box(o, 'concrete', A, -offset - 2.7, offset + 2.7, A.y - 5, A.y - 2, -3.2, 3.2);
  box(o, 'concrete', A, -offset - 2.7, offset + 2.7, top - 5, top - 2.5, -2.3, 2.3);
  towerEvidence.push({
    ref: T.ref,
    point: A.point,
    top,
    ground: T.ground,
    publishedHeight: T.height,
  });
}
function cables(o, lod) {
  const offset = 14.8,
    tn = P.towers[0],
    ts = P.towers[1],
    yn = tn.ground + tn.height - 0.65,
    ys = ts.ground + ts.height - 0.65,
    mid = B.mainCableMidHeight,
    cableY = (t) => (1 - t) * yn + t * ys - 4 * t * (1 - t) * ((yn + ys) / 2 - mid),
    count = [8, 22, 46, 90][lod],
    sides = [4, 5, 6, 8][lod];
  for (const side of [-1, 1]) {
    const pts = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count,
        A = pose(B.mainSpanStart + t * B.mainSpan);
      return world(A, side * offset, cableY(t));
    });
    tube(o, pts, B.mainCableRadius, sides);
    cableEvidence.push({
      side,
      part: 'whole-main-span',
      stations: [B.mainSpanStart, B.mainSpanEnd],
    });
    for (let t = lod === 1 ? 3 : 1; lod > 0 && t < 57; t += lod === 1 ? 4 : 1) {
      const u = t / 57,
        A = pose(B.mainSpanStart + u * B.mainSpan);
      if (lod === 3)
        tube(
          o,
          [
            world(A, side * (B.deckWidth / 2 - 0.3), A.y + 0.25),
            world(A, side * offset, cableY(u)),
          ],
          B.hangerRadius,
          5,
        );
      else
        beam(
          o,
          'metal',
          world(A, side * (B.deckWidth / 2 - 0.3), A.y + 0.25),
          world(A, side * offset, cableY(u)),
          0.18,
          0.18,
          C.metal,
        );
    }
    for (const [i, anchor] of P.anchorBlocks.entries()) {
      const endS = i ? B.mainSpanEnd : B.mainSpanStart,
        topY = i ? ys : yn,
        n = [4, 10, 16, 28][lod],
        points = Array.from({ length: n + 1 }, (_, j) => {
          const t = j / n,
            s = anchor.station + (endS - anchor.station) * t,
            A = pose(s),
            y = (1 - t) * (anchor.ground + 8) + t * topY - 7 * Math.sin(t * Math.PI);
          return world(A, side * offset, y);
        });
      tube(o, points, B.mainCableRadius, sides);
      cableEvidence.push({ side, part: i ? 'south-anchor-cable' : 'north-anchor-cable' });
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  deckEvidence.length = 0;
  towerEvidence.length = 0;
  cableEvidence.length = 0;
  supportEvidence.length = 0;
  deck(o, 'whole-main-shared-bridge-deck', mainFrames(lod), B.deckWidth, lod, true);
  for (const r of P.extraRoads) deck(o, r.id, extraFrames(r, lod), r.width, lod, false);
  for (const T of P.towers) tower(o, T, lod);
  for (let i = 0; i < P.piers.length; i++) {
    if (lod === 0 && i % 8 !== 0) continue;
    if (lod === 1 && i % 2 !== 0) continue;
    const p = P.piers[i],
      A = pose(p.station);
    support(o, A, p.ground, roadY(p.station), lod);
  }
  if (lod > 0)
    for (const r of P.extraRoads)
      for (let i = 1; i < r.points.length - 1; i += lod === 1 ? 4 : 2) {
        const frames = extraFrames(r, 3),
          A = frames[i];
        support(o, A, r.grounds[i], r.floors[i], lod, false);
      }
  for (const a of P.anchorBlocks) {
    const A = pose(a.station);
    box(o, 'concrete', A, -21, 21, a.ground - 2, a.ground + 10, -10, 10);
  }
  cables(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ke/ker/maputo_katembe_bridge',
  camera = [2250, 1050, 2100],
  look = [0, 45, -300],
  A = pose(P.mainMidStation + 60),
  forward = pose(P.mainMidStation - 200);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Maputo–Katembe Bridge',
  wikidataId: 'Q19275941',
  cell: 'ke/ker',
  category: 'bridge',
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
  camera,
  lookAt: look,
  portableGroundY: -27,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 14000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed', 'metal_painted'],
  qaCameras: [
    { name: 'whole-bridge-and-all-elevated-approaches', position: camera, lookAt: look },
    {
      name: 'main-suspension-span-both-towers-and-cables',
      position: [750, 360, 700],
      lookAt: [0, 85, 0],
    },
    {
      name: 'northern-curved-approaches-and-viaducts',
      position: [-750, 460, -1900],
      lookAt: [20, 35, -1350],
    },
    {
      name: 'southern-complete-approach-piers-and-deck',
      position: [900, 280, 1400],
      lookAt: [-180, 20, 1050],
    },
    {
      name: 'roadway-box-deck-and-suspender-details',
      position: [A.point[0] + 4, A.y + 3, A.point[1]],
      lookAt: [forward.point[0] + 4, forward.y + 4, forward.point[1]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-maputo-crossing-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 30,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored procedural model under repository license. No source photographs, satellite pixels, figures, traced artwork or photo textures used; Qualla corpus searched first. Native original bridge/approach road geometry under ODbL. Published primary engineering dimensional/construction facts supply major controls, used as facts without copying source prose into model surfaces. Cable sag/hanger count/portal sections/piers/finishes/grade and finite-field-boundary details are explicit estimates; no photographic, pylon section survey or exact current-world replacement claim. Complete named crossing and intrinsic elevated approaches retained; no reduced main-span-only completion credit.',
};
