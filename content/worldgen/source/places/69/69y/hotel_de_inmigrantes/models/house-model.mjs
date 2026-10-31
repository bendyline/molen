/** Complete four-storey main hotel; exact native plan, cleared original facade, estimated hidden sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth,
  ref = 'palette:#ffffff';
export const toWorld = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  frame: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.72, metallic: 0.32 },
  glass: {
    slot: 'window',
    localRef: 'palette:#344b4f',
    roughness: 0.32,
    metallic: 0.08,
    alphaMode: 'OPAQUE',
  },
  dial: { slot: 'trim', localRef: 'palette:#e9e4d7', roughness: 0.93, metallic: 0 },
  hand: { slot: 'trim', localRef: 'palette:#313838', roughness: 0.83, metallic: 0.1 },
};
const C = {
  plaster: rgb('e7e2d6'),
  stone: rgb('b5afa3'),
  frame: rgb('e7e4d8'),
  roof: rgb('96988e'),
  glass: rgb('344b4f'),
  dial: rgb('e9e4d7'),
  hand: rgb('313838'),
};
export const partEvidence = [],
  windowEvidence = [],
  roofEvidence = [];
function face(o, k, p, n) {
  // An arch reaches the row head at its apex, leaving a triangular spandrel there.
  const same = (a, b) => Math.hypot(...a.map((v, i) => v - b[i])) < 0.0000001;
  p = p.filter((q, i) => i === 0 || !same(q, p[i - 1]));
  if (p.length > 2 && same(p[0], p.at(-1))) p.pop();
  if (p.length < 3) return;
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], C[k]);
}
function tri(o, k, p, n) {
  o.addTriangle(
    k,
    ref,
    p,
    n ?? normalFor(...p),
    p.map((q) => [q[0], q[2]]),
    C[k],
  );
}
function cap(o, k, ring, y, up = true) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      ring,
      [],
      () => y,
      [0, up ? 1 : -1, 0],
      (q) => q,
      C[k],
    )
  )
    throw Error('Whole hotel cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    tri(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3), (j) => [
        m.positions[j * 3],
        m.positions[j * 3 + 1],
        m.positions[j * 3 + 2],
      ]),
      [0, up ? 1 : -1, 0],
    );
}
function edges(ring) {
  const sign = Math.sign(
    ring.reduce(
      (s, p, i) =>
        s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1],
      0,
    ),
  );
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [sign * u[1], 0, -sign * u[0]],
      at = (s, y, d = 0) => [a[0] + u[0] * s + n[0] * d, y, a[1] + u[1] * s + n[2] * d];
    return { a, b, L, u, n, at };
  });
}
function wall(o, E, a, b, y, Y, depth = 0, k = 'plaster') {
  if (b - a < 0.00001 || Y - y < 0.00001) return;
  face(o, k, [E.at(a, y, depth), E.at(b, y, depth), E.at(b, Y, depth), E.at(a, Y, depth)], E.n);
}
function box(o, k, x, y, z, X, Y, Z) {
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
function window(o, E, center, width, bot, top, arched, lod) {
  const a = center - width / 2,
    b = center + width / 2,
    dep = lod === 3 ? -P.windows.inset : 0.025,
    count = arched ? [3, 5, 8, 12][lod] : 1,
    spring = arched ? top - P.windows.archRise : top,
    arc = arched
      ? Array.from({ length: count + 1 }, (_, i) => {
          const t = (Math.PI * i) / count;
          return [center + (width / 2) * Math.cos(t), spring + P.windows.archRise * Math.sin(t)];
        })
      : [
          [b, top],
          [a, top],
        ],
    polygon = [[a, bot], [b, bot], ...arc];
  face(
    o,
    'glass',
    polygon.map(([s, y]) => E.at(s, y, dep)),
    E.n,
  );
  if (lod === 3) {
    for (const s of [a, b])
      face(o, 'plaster', [E.at(s, bot), E.at(s, spring), E.at(s, spring, dep), E.at(s, bot, dep)]);
    face(o, 'plaster', [E.at(a, bot), E.at(b, bot), E.at(b, bot, dep), E.at(a, bot, dep)]);
    for (let i = 0; i < arc.length - 1; i++) {
      const [s, y] = arc[i],
        [t, Y] = arc[i + 1];
      face(o, 'plaster', [E.at(t, Y), E.at(s, y), E.at(s, y, dep), E.at(t, Y, dep)]);
    }
  }
  if (lod > 0) {
    const w = P.windows.frameWidth;
    wall(o, E, a - w, b + w, bot - w, bot, 0.065, 'frame');
    for (const [s, t] of [
      [a - w, a],
      [b, b + w],
    ])
      wall(o, E, s, t, bot, spring, 0.065, 'frame');
    for (let i = 0; i < arc.length - 1; i++) {
      const [s, y] = arc[i],
        [t, Y] = arc[i + 1];
      face(
        o,
        'frame',
        [E.at(s, y, 0.065), E.at(t, Y, 0.065), E.at(t, Y + w, 0.065), E.at(s, y + w, 0.065)],
        E.n,
      );
    }
    if (lod > 1) {
      wall(o, E, center - 0.04, center + 0.04, bot, top - 0.06, dep + 0.018, 'frame');
      wall(
        o,
        E,
        a,
        b,
        (bot + spring) / 2 - 0.045,
        (bot + spring) / 2 + 0.045,
        dep + 0.021,
        'frame',
      );
      if (lod === 3) {
        for (const q of [0.25, 0.75])
          wall(
            o,
            E,
            a + (b - a) * q - 0.026,
            a + (b - a) * q + 0.026,
            bot,
            spring,
            dep + 0.027,
            'frame',
          );
        for (const q of [0.24, 0.76])
          wall(
            o,
            E,
            a,
            b,
            bot + (spring - bot) * q - 0.026,
            bot + (spring - bot) * q + 0.026,
            dep + 0.029,
            'frame',
          );
      }
    }
  }
  if (lod === 3)
    windowEvidence.push({
      point: E.at(center, (bot + spring) / 2),
      outward: E.n,
      backingDepth: P.windows.inset,
      arched,
    });
  return arc;
}
function facade(o, E, lod) {
  const long = Math.abs(E.u[0]) > 0.95,
    front = E.n[2] > 0.8,
    original = long
      ? Array.from({ length: P.windows.longBays }, (_, i) => ({
          index: i,
          s: (P.xMin + ((P.xMax - P.xMin) * (i + 0.5)) / P.windows.longBays - E.a[0]) / E.u[0],
        }))
      : Array.from({ length: P.windows.endBays }, (_, i) => ({
          index: i,
          s: (E.L * (i + 0.5)) / P.windows.endBays,
        })),
    bays = original
      .filter(
        (p) =>
          p.s > 1.2 &&
          p.s < E.L - 1.2 &&
          (lod > 0 || p.index % 2 === 0 || p.index === Math.floor(P.windows.longBays / 2)),
      )
      .sort((a, b) => a.s - b.s),
    rows = [
      [P.windows.lowerBottom, P.windows.lowerTop],
      ...P.windows.upperBottoms.map((bot, i) => [bot, P.windows.upperTops[i]]),
    ];
  if (lod < 3) wall(o, E, 0, E.L, P.baseFloorY, P.eave);
  let previous = P.baseFloorY;
  for (let floor = 0; floor < 4; floor++) {
    const [bot, top] = rows[floor];
    if (lod === 3) {
      const entry = floor === 0 && front ? bays.find((b) => b.index === 13) : null;
      if (entry) {
        wall(o, E, 0, entry.s - P.windows.lowerWidth / 2, previous, bot);
        wall(o, E, entry.s + P.windows.lowerWidth / 2, E.L, previous, bot);
      } else wall(o, E, 0, E.L, previous, bot);
    }
    let last = 0;
    for (const { index, s } of bays) {
      const width = floor === 0 ? P.windows.lowerWidth : P.windows.upperWidth,
        a = s - width / 2,
        b = s + width / 2,
        arched =
          floor === 3 &&
          front &&
          (index === 0 || index === P.windows.longBays - 1 || Math.abs(index - 13) <= 1),
        door = front && floor === 0 && index === 13,
        low = door ? P.baseFloorY + 0.03 : bot;
      if (lod === 3) {
        wall(o, E, last, a, bot, top);
        if (door) wall(o, E, a, b, P.baseFloorY, low);
        else if (low > bot) wall(o, E, a, b, bot, low);
      }
      const arc = window(o, E, s, width, low, top, arched, lod);
      if (lod === 3 && arched)
        for (let j = 0; j < arc.length - 1; j++) {
          const [x, y] = arc[j],
            [X, Y] = arc[j + 1];
          face(o, 'plaster', [E.at(X, Y), E.at(x, y), E.at(x, top), E.at(X, top)], E.n);
        }
      if (lod > 1) {
        wall(o, E, a - 0.16, b + 0.16, low - 0.16, low - 0.07, 0.15, 'stone');
        if (floor > 0) wall(o, E, a - 0.13, b + 0.13, top + 0.17, top + 0.28, 0.11);
      }
      last = b;
    }
    if (lod === 3) wall(o, E, last, E.L, bot, top);
    previous = top;
  }
  if (lod === 3) wall(o, E, 0, E.L, previous, P.eave);
  if (lod > 1) {
    for (const y of P.floorYs.slice(1)) wall(o, E, 0, E.L, y - 0.2, y + 0.07, 0.12);
    for (const { s } of bays) wall(o, E, s + 1.55, s + 1.7, 6.1, P.eave - 0.25, 0.105);
    wall(o, E, 0, E.L, P.eave - 0.25, P.eave + 0.16, 0.2);
  }
  partEvidence.push({
    part: 'whole-native-facade',
    length: E.L,
    physicalFloors: 4,
    bays: bays.length,
    front,
  });
}
function roof(o, lod) {
  const center = (P.zMin + P.zMax) / 2,
    inset = (P.zMax - P.zMin) / 2,
    ridge = (x) => [
      Math.max(P.xMin + inset, Math.min(P.xMax - inset, x)),
      P.roofEave + P.roofRise,
      center,
    ];
  for (const E of edges(P.outline)) {
    const a = [E.a[0], P.roofEave, E.a[1]],
      b = [E.b[0], P.roofEave, E.b[1]],
      A = ridge(E.a[0]),
      B = ridge(E.b[0]);
    let p = Math.hypot(A[0] - B[0], A[2] - B[2]) < 0.02 ? [a, b, A] : [a, b, B, A];
    if (normalFor(...p)[1] < 0) p = p.reverse();
    face(o, 'roof', p);
    if (lod > 0) face(o, 'roof', p.map((q) => [q[0], q[1] - P.roofThickness, q[2]]).reverse());
    if (lod === 3) roofEvidence.push({ polygon: p });
  }
  partEvidence.push({
    part: 'complete-four-sided-metal-roof',
    eave: P.roofEave,
    ridge: P.roofEave + P.roofRise,
  });
}
function parapet(o, lod) {
  for (const E of edges(P.outline)) {
    wall(o, E, 0, E.L, P.eave, P.parapetTop);
    if (lod > 0) {
      wall(o, { ...E, n: E.n.map((v) => -v) }, 0, E.L, P.eave, P.parapetTop, -P.parapetThickness);
      face(
        o,
        'stone',
        [
          E.at(0, P.parapetTop, 0.04),
          E.at(E.L, P.parapetTop, 0.04),
          E.at(E.L, P.parapetTop, -P.parapetThickness - 0.04),
          E.at(0, P.parapetTop, -P.parapetThickness - 0.04),
        ],
        [0, 1, 0],
      );
    }
  }
}
function crown(o, lod) {
  const A = P.crown,
    z = A.frontZ,
    profile = [[-7.5, A.base], ...A.profile, [7.5, A.base]];
  // Triangulate the non-convex scroll silhouette in an XY plane, then extrude its actual profile.
  const b = new MeshBufferBuilder();
  b.addCap(
    'plaster',
    ref,
    profile.map(([x, y]) => [x, y]),
    [],
    () => 0,
    [0, 1, 0],
    (q) => q,
    C.plaster,
  );
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) => [
      m.positions[j * 3],
      m.positions[j * 3 + 2],
      z,
    ]);
    tri(o, 'plaster', p, [0, 0, 1]);
    if (lod > 0)
      tri(o, 'plaster', p.map((q) => [q[0], q[1], z - A.thickness]).reverse(), [0, 0, -1]);
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(o, 'plaster', [
      [a[0], a[1], z],
      [b[0], b[1], z],
      [b[0], b[1], z - A.thickness],
      [a[0], a[1], z - A.thickness],
    ]);
  }
  const count = [8, 12, 24, 40][lod];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count,
      b = (2 * Math.PI * (i + 1)) / count,
      p = [Math.cos(a) * A.clockRadius, A.clockY + Math.sin(a) * A.clockRadius, z + 0.03],
      q = [Math.cos(b) * A.clockRadius, A.clockY + Math.sin(b) * A.clockRadius, z + 0.03];
    tri(o, 'dial', [[0, A.clockY, z + 0.03], p, q], [0, 0, 1]);
    if (lod > 0)
      face(
        o,
        'stone',
        [
          p,
          q,
          [q[0] * 1.12, A.clockY + (q[1] - A.clockY) * 1.12, z + 0.03],
          [p[0] * 1.12, A.clockY + (p[1] - A.clockY) * 1.12, z + 0.03],
        ],
        [0, 0, 1],
      );
  }
  face(
    o,
    'hand',
    [
      [-0.025, A.clockY, z + 0.055],
      [0.025, A.clockY, z + 0.055],
      [0.025, A.clockY + 0.53, z + 0.055],
      [-0.025, A.clockY + 0.53, z + 0.055],
    ],
    [0, 0, 1],
  );
  face(
    o,
    'hand',
    [
      [0, A.clockY - 0.03, z + 0.058],
      [0.38, A.clockY - 0.03, z + 0.058],
      [0.38, A.clockY + 0.03, z + 0.058],
      [0, A.clockY + 0.03, z + 0.058],
    ],
    [0, 0, 1],
  );
  if (lod > 1)
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12,
        dx = Math.cos(a),
        dy = Math.sin(a),
        x = dx * A.clockRadius * 0.83,
        y = A.clockY + dy * A.clockRadius * 0.83;
      face(
        o,
        'hand',
        [
          [x - dy * 0.02, y + dx * 0.02, z + 0.05],
          [x + dy * 0.02, y - dx * 0.02, z + 0.05],
          [x + dx * 0.09 + dy * 0.02, y + dy * 0.09 - dx * 0.02, z + 0.05],
          [x + dx * 0.09 - dy * 0.02, y + dy * 0.09 + dx * 0.02, z + 0.05],
        ],
        [0, 0, 1],
      );
    }
  partEvidence.push({ part: 'front-clock-crown', whole: true, originalProfileEstimate: true });
}
export function buildHouse(out, _frame, lod = 3) {
  partEvidence.length = 0;
  windowEvidence.length = 0;
  roofEvidence.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), toWorld(n), (q) => [q[0], q[1]], col),
    addTriangle: (k, r, p, n, uv, col) =>
      out.addTriangle(k, r, p.map(toWorld), toWorld(n), uv, col),
  };
  for (const y of P.floorYs) cap(o, 'stone', P.outline, y);
  if (lod > 0) {
    cap(o, 'stone', P.outline, P.foundationBase, false);
    for (const y of P.floorYs.slice(1)) cap(o, 'plaster', P.outline, y - P.slabThickness, false);
  }
  for (const E of edges(P.outline)) {
    wall(o, E, 0, E.L, P.foundationBase, P.baseFloorY, 0, 'stone');
    facade(o, E, lod);
  }
  roof(o, lod);
  parapet(o, lod);
  crown(o, lod);
  const A = P.stairs,
    steps = lod === 0 ? 1 : A.steps;
  for (let i = 0; i < steps; i++)
    box(
      o,
      'stone',
      -A.width / 2,
      P.foundationBase,
      A.frontZ - 0.5,
      A.width / 2,
      (P.baseFloorY * (i + 1)) / steps,
      A.frontZ + A.depth * (1 - i / steps),
    );
  partEvidence.push({
    part: 'whole-main-hotel',
    nativeOuterControls: 6,
    physicalFloors: 4,
    detachedBuildingsAndParcelExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/69/69y/hotel_de_inmigrantes',
  camera = toWorld([-125, 70, 150]),
  look = toWorld([0, 10, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Hotel de Inmigrantes, Buenos Aires (circa1915)',
  wikidataId: 'Q9005010',
  cell: '69/69y',
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
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'wood_plain', 'metal_corrugated'],
  qaCameras: [
    { name: 'whole-four-storey-hotel-clock-crown-and-roof', position: camera, lookAt: look },
    {
      name: 'central-clock-crown-arched-upper-windows-and-original-entry',
      position: toWorld([-5, 16, 64]),
      lookAt: toWorld([0, 15, 12]),
    },
    {
      name: 'whole-rear-end-walls-and-four-sided-roof',
      position: toWorld([105, 60, -115]),
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-immigrant-hotel-${reviewLod}`,
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
    'Original authored geometry under repository license. Sole imagery exact native LOC91739070/cph.3c04096 Carpenter original TIFF4096x3268/13,387,660bytes/SHA1791af51ecf291cab8af64a35470c94d28ca56f98, explicit native PD-Carpenter/PD-old-auto-expired death1924 plus LOC item/current collection unrestricted statement. Qualla18families screened first; predecessor/uncertain reproduction/GoogleArts/attribution photos unused. Primary1990heritage decree architectural TEXT supports four floors, rhythmic concrete frame and hipped metal roof. Exact six-control physical hotel OSMway34609151/Q9005010 underODbL; displaced story marker not placement. Historical phase/date/grade/roof/heights/hidden details/bay census/finish estimates documented. No facade photographs/textures/art/people/garden/neighbor/property proxy; original field and main parameters fixed first.',
};
