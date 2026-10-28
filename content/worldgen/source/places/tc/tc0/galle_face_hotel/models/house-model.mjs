/** Whole restored hotel: native connected footprints, historical north-front detail, estimated sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const F = P.baseFloorY,
  ref = 'palette:#ffffff',
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#3d5051',
    roughness: 0.32,
    metallic: 0.08,
    alphaMode: 'OPAQUE',
  },
};
const C = {
  plaster: rgb('e7dfcf'),
  roof: rgb('955d4a'),
  stone: rgb('b9ae9b'),
  timber: rgb('655547'),
  glass: rgb('3d5051'),
};
export const toWorld = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z],
  rotate = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const partEvidence = [],
  archEvidence = [],
  roofEvidence = [];
function face(o, k, p, n) {
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], C[k]);
}
function triangle(o, k, p, n) {
  o.addTriangle(
    k,
    ref,
    p,
    n ?? normalFor(...p),
    p.map((q) => [q[0], q[2]]),
    C[k],
  );
}
function box(o, k, [x, y, z], [X, Y, Z]) {
  for (const [p, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [X, y, Z],
        [x, y, Z],
        [x, Y, Z],
        [X, Y, Z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, y, Z],
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, y, z],
        [x, y, z],
      ],
      [0, -1, 0],
    ],
  ])
    face(o, k, p, n);
}
function capTriangles(ring) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      'plaster',
      ref,
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (q) => q,
      C.plaster,
    )
  )
    throw Error('Hotel outline triangulation failed');
  const m = b.finalize();
  return Array.from({ length: m.indices.length / 3 }, (_, i) =>
    Array.from(m.indices.slice(i * 3, i * 3 + 3), (j) => [
      m.positions[j * 3],
      m.positions[j * 3 + 2],
    ]),
  );
}
function cap(o, k, ring, y, up = true) {
  for (const t of capTriangles(ring))
    triangle(
      o,
      k,
      t.map(([x, z]) => [x, y, z]),
      [0, up ? 1 : -1, 0],
    );
}
function edges(ring) {
  const area = ring.reduce(
      (s, p, i) =>
        s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1],
      0,
    ),
    sign = Math.sign(area);
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [sign * u[1], 0, -sign * u[0]],
      at = (s, y, d = 0) => [a[0] + u[0] * s + n[0] * d, y, a[1] + u[1] * s + n[2] * d];
    return { a, b, L, u, n, at };
  });
}
function wall(o, E, a, b, y0, y1, depth = 0, inside = false, k = 'plaster') {
  if (b - a < 0.00001 || y1 - y0 < 0.00001) return;
  face(
    o,
    k,
    [E.at(a, y0, depth), E.at(b, y0, depth), E.at(b, y1, depth), E.at(a, y1, depth)],
    E.n.map((v) => (inside ? -v : v)),
  );
}
function reveal(o, E, a, b, y0, y1, depth = P.windows.inset) {
  for (const s of [a, b])
    face(o, 'plaster', [E.at(s, y0), E.at(s, y1), E.at(s, y1, -depth), E.at(s, y0, -depth)]);
  for (const y of [y0, y1])
    face(o, 'plaster', [E.at(a, y), E.at(b, y), E.at(b, y, -depth), E.at(a, y, -depth)]);
}
function pane(o, E, a, b, y0, y1, lod) {
  const dep = lod > 2 ? -P.windows.inset : 0.018;
  wall(o, E, a, b, y0, y1, dep, false, 'glass');
  if (lod > 1) {
    const w = 0.075;
    wall(o, E, a - w, b + w, y0 - w, y0, 0.075, false, 'timber');
    wall(o, E, a - w, b + w, y1, y1 + w, 0.075, false, 'timber');
    wall(o, E, a - w, a, y0, y1, 0.075, false, 'timber');
    wall(o, E, b, b + w, y0, y1, 0.075, false, 'timber');
    if (lod > 2) {
      wall(o, E, (a + b) / 2 - w / 2, (a + b) / 2 + w / 2, y0, y1, 0.082, false, 'timber');
      reveal(o, E, a, b, y0, y1);
    }
  }
}
function upperWall(o, E, y0, y1, rows, lod) {
  if (lod < 3) wall(o, E, 0, E.L, y0, y1);
  if (lod === 0) return;
  const pitch = P.windows.pitch * (lod === 1 ? 1.7 : 1),
    count = Math.max(1, Math.floor(E.L / pitch)),
    step = E.L / count,
    w = Math.min(P.windows.width, step * 0.52);
  if (lod === 3) {
    let lastY = y0;
    for (const [bot, top] of rows) {
      wall(o, E, 0, E.L, lastY, bot);
      for (let i = 0; i < count; i++) {
        const c = (i + 0.5) * step,
          a = c - w / 2,
          b = c + w / 2;
        wall(o, E, i * step, a, bot, top);
        wall(o, E, b, (i + 1) * step, bot, top);
        pane(o, E, a, b, bot, top, lod);
      }
      lastY = top;
    }
    wall(o, E, 0, E.L, lastY, y1);
  } else
    for (const [bot, top] of rows)
      for (let i = 0; i < count; i++) {
        const c = (i + 0.5) * step;
        pane(o, E, c - w / 2, c + w / 2, bot, top, lod);
      }
}
function arcade(o, E, lod, id) {
  const A = P.arcade,
    count = lod === 0 ? 1 : Math.max(1, Math.round(E.L / (A.pitch * (lod === 1 ? 1.7 : 1)))),
    step = E.L / count,
    pier = Math.min(A.pierWidth, step * 0.24),
    segments = [2, 3, 6, 10][lod];
  // Deep inner wall and overhead slab make genuine covered ground-floor voids.
  wall(o, E, 0, E.L, F, A.topY, -A.depth);
  for (let i = 0; i < count; i++) {
    const a = i * step + pier / 2,
      b = (i + 1) * step - pier / 2,
      c = (a + b) / 2,
      w = (b - a) / 2;
    for (const [s, t] of [
      [i * step, a],
      [b, (i + 1) * step],
    ]) {
      wall(o, E, s, t, F, A.topY);
      if (lod > 0) wall(o, E, s, t, F, A.topY, -P.wallThickness, true);
    }
    for (let j = 0; j < segments; j++) {
      const u = (Math.PI * j) / segments,
        v = (Math.PI * (j + 1)) / segments,
        x0 = c - w * Math.cos(u),
        x1 = c - w * Math.cos(v),
        y0 = A.springY + (A.apexY - A.springY) * Math.sin(u),
        y1 = A.springY + (A.apexY - A.springY) * Math.sin(v);
      face(o, 'plaster', [E.at(x0, y0), E.at(x1, y1), E.at(x1, A.topY), E.at(x0, A.topY)], E.n);
      if (lod > 0) {
        face(
          o,
          'plaster',
          [
            E.at(x1, y1, -P.wallThickness),
            E.at(x0, y0, -P.wallThickness),
            E.at(x0, A.topY, -P.wallThickness),
            E.at(x1, A.topY, -P.wallThickness),
          ],
          E.n.map((v) => -v),
        );
        face(o, 'plaster', [
          E.at(x0, y0),
          E.at(x0, y0, -P.wallThickness),
          E.at(x1, y1, -P.wallThickness),
          E.at(x1, y1),
        ]);
      }
    }
    if (lod > 0)
      for (const s of [a, b])
        face(o, 'plaster', [
          E.at(s, F),
          E.at(s, A.springY),
          E.at(s, A.springY, -P.wallThickness),
          E.at(s, F, -P.wallThickness),
        ]);
    archEvidence.push({
      part: id,
      point: E.at(c, F + 1.6),
      outward: E.n,
      depth: A.depth,
      soffit: E.at(c, A.apexY),
      width: b - a,
    });
  }
}
const distanceTo = (p, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
export const roofHeight = (part, p) =>
  part.eave +
  Math.min(
    part.roofRise,
    ...part.outline.map(
      (a, i) => distanceTo(p, a, part.outline[(i + 1) % part.outline.length]) * part.roofSlope,
    ),
  );
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function roof(o, part, lod) {
  const depth = [1, 1, 2, 3][lod],
    emit = (t, n) => {
      if (n) {
        const [a, b, c] = t,
          ab = midpoint(a, b),
          bc = midpoint(b, c),
          ca = midpoint(c, a);
        for (const s of [
          [a, ab, ca],
          [ab, b, bc],
          [ca, bc, c],
          [ab, bc, ca],
        ])
          emit(s, n - 1);
        return;
      }
      let p = t.map((q) => [q[0], roofHeight(part, q), q[1]]);
      if (normalFor(...p)[1] < 0) p = p.reverse();
      triangle(o, 'roof', p);
      if (lod > 0) triangle(o, 'roof', p.map((q) => [q[0], q[1] - 0.14, q[2]]).reverse());
      if (roofEvidence.length < 1000 && lod === 3)
        roofEvidence.push({ part: part.id, triangle: p });
    };
  for (const t of capTriangles(part.outline)) emit(t, depth);
  for (const E of edges(part.outline))
    wall(o, E, 0, E.L, part.eave - 0.14, part.eave, 0, false, 'roof');
}
function mergedGroundEdges(part) {
  const ring = part.outline;
  let changed = true;
  const p = ring.map((q) => [...q]);
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = [b[0] - a[0], b[1] - a[1]],
        v = [c[0] - b[0], c[1] - b[1]],
        dot = (u[0] * v[0] + u[1] * v[1]) / Math.hypot(...u) / Math.hypot(...v);
      if (dot > 0.9996) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return edges(p);
}
function body(o, part, lod) {
  const E = edges(part.outline),
    groundTop = Math.min(P.arcade.topY, part.eave),
    rows = [];
  if (part.floors > 2)
    for (let i = 0; i < part.floors - 1; i++)
      rows.push([
        P.windows.upperFirstBottom + i * P.windows.upperPitch,
        P.windows.upperFirstBottom + i * P.windows.upperPitch + P.windows.height,
      ]);
  else if (part.floors === 2) rows.push([5.6, 7.38]);
  else rows.push([1.65, 5.05]);
  cap(o, 'stone', part.outline, F);
  if (lod > 0) {
    cap(o, 'plaster', part.outline, groundTop, false);
    cap(o, 'stone', part.outline, P.foundationBase, false);
  }
  for (const e of E) {
    wall(o, e, 0, e.L, P.foundationBase, F, 0, false, 'stone');
    upperWall(
      o,
      e,
      groundTop,
      part.eave,
      rows.filter((r) => r[0] >= groundTop && r[1] < part.eave),
      lod,
    );
  }
  for (const e of mergedGroundEdges(part)) {
    const worldNormal = rotate(e.n),
      open = (part.frontArcade && e.n[2] < -0.72) || (part.seaArcade && worldNormal[0] < -0.8);
    if (open && e.L > 4.2) arcade(o, e, lod, part.id);
    else {
      upperWall(
        o,
        e,
        F,
        groundTop,
        part.floors === 1
          ? [[1.65, Math.min(5.05, groundTop - 0.2)]]
          : [[P.windows.lowerBottom, P.windows.lowerBottom + P.windows.height]],
        lod,
      );
    }
  }
  if (lod > 1)
    for (const e of E) {
      wall(o, e, 0, e.L, part.eave - 0.3, part.eave + 0.12, 0.13);
      wall(o, e, 0, e.L, groundTop - 0.12, groundTop + 0.1, 0.12);
    }
  roof(o, part, lod);
  partEvidence.push({
    part: part.id,
    nativeWay: part.nativeWay,
    wholeOutline: part.outline.length,
    floors: part.floors,
    roof: 'complete-clipped-hip-and-valley',
  });
}
function pavilion(o, p, lod) {
  const { x0, x1, z0, z1 } = p,
    y = P.pavilionBaseY,
    Y = P.pavilionEave;
  for (const [a, b] of [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
  ]) {
    const ring = [a, b, midpoint(a, b)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1], 0, -u[0]],
      at = (s, h, d = 0) => [a[0] + u[0] * s + n[0] * d, h, a[1] + u[1] * s + n[2] * d],
      E = { L, u, n, at };
    upperWall(o, E, y, Y, [[P.pavilionWindowBottom, P.pavilionWindowTop]], lod);
    if (lod > 0) wall(o, E, 0, L, Y - 0.2, Y + 0.12, 0.18);
    void ring;
  }
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    w = x1 - x0,
    d = z1 - z0,
    r = P.pavilionRoofRise;
  const q0 = w < d ? [cx, Y + r, z0 + w / 2] : [x0 + d / 2, Y + r, cz],
    q1 = w < d ? [cx, Y + r, z1 - w / 2] : [x1 - d / 2, Y + r, cz],
    a = [x0, Y, z0],
    b = [x1, Y, z0],
    c = [x1, Y, z1],
    e = [x0, Y, z1];
  const faces =
    w < d
      ? [
          [a, b, q0],
          [b, c, q1, q0],
          [c, e, q1],
          [e, a, q0, q1],
        ]
      : [
          [a, b, q1, q0],
          [b, c, q1],
          [c, e, q0, q1],
          [e, a, q0],
        ];
  for (let ps of faces) {
    if (normalFor(...ps)[1] < 0) ps = ps.reverse();
    face(o, 'roof', ps);
    if (lod > 1) face(o, 'roof', ps.map((q) => [q[0], q[1] - 0.14, q[2]]).reverse());
  }
  partEvidence.push({ part: p.id, hippedRoof: true, whole: true });
}
function canopy(o, lod) {
  const A = P.canopy;
  cap(o, 'roof', A.outline, A.eave);
  if (lod > 0) cap(o, 'plaster', A.outline, A.eave - A.roofThickness, false);
  const ps = lod === 0 ? [A.outline[0], A.outline[2]] : A.outline.slice(0, 4);
  for (const [x, z] of ps) {
    const w = A.postWidth;
    box(o, 'timber', [x - w / 2, F, z - w / 2], [x + w / 2, A.eave, z + w / 2]);
  }
  partEvidence.push({ part: 'intrinsic-link-canopy', nativeWay: 1430312628, whole: true });
}
export function buildHouse(out, _frame, lod = 3) {
  partEvidence.length = 0;
  archEvidence.length = 0;
  roofEvidence.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (q) => [q[0], q[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  for (const part of P.parts) body(o, part, lod);
  for (const p of P.pavilions) pavilion(o, p, lod);
  canopy(o, lod);
  if (lod > 0) {
    const A = P.stairs;
    for (let i = 0; i < A.steps; i++) {
      const z = A.frontZ - A.depth + (A.depth * i) / A.steps,
        h = (F * (i + 1)) / A.steps;
      box(
        o,
        'stone',
        [A.centerX - A.width / 2, P.foundationBase, z],
        [A.centerX + A.width / 2, h, A.frontZ],
      );
    }
  }
  partEvidence.push({
    part: 'whole-restored-hotel',
    nativeOuterControls: 67,
    connectedPhysicalBuildings: 4,
    linkCanopy: true,
    propertyParcelExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tc/tc0/galle_face_hotel',
  camera = toWorld([-168, 112, -195]),
  look = toWorld([0, 7, -4]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Galle Face Hotel, Colombo (2022)',
  wikidataId: 'Q4039225',
  cell: 'tc/tc0',
  category: 'hotel',
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
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 2500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'tile_flat', 'stone_limestone', 'wood_plain'],
  qaCameras: [
    {
      name: 'whole-north-central-south-and-ballroom-hotel-complex',
      position: camera,
      lookAt: look,
    },
    {
      name: 'three-northfront-hipped-pavilions-and-true-ground-arcade',
      position: toWorld([-4, 11, -115]),
      lookAt: toWorld([-4, 10, -62]),
    },
    {
      name: 'whole-sea-veranda-south-room-wing-and-intrinsic-low-range',
      position: toWorld([-143, 70, 130]),
      lookAt: toWorld([0, 7, 12]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-galle-face-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Only exact native1908Cavebook/plate70 under explicit expiredUSpublication grant/nativePDFSHA1f64053a6e96e192b1a1c719a0e04b95c10fc3a42 and primaryUCLAlibrary NOT_IN_COPYRIGHT-US record used as imagery. Bookauthor/contributors inspected, individual plate photographer unassigned; no invented lifespan/source metadata repair. Primary owner architectural/history/restoration/venue TEXT supports full2022complex; no protected contemporary photo/drawing pixels. Actual native four connected building polygons and canopy67controls underODbL, propertyparcel and neighbors excluded. All numeric heights/roof sections/census/colour/phasecontinuity/grade estimated. Original independent field/frame/floors/main sections fixed first; no phototextures/people/art/props/landscape/generatedbitmap.',
};
