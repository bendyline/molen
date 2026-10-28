/** Complete old Main and South Wings, 5 May2006. Original field/frame/main sections are immutable. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  ref = 'palette:#ffffff';
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  eave: { slot: 'roof', graph: 'metal_copper', roughness: 0.82, metallic: 0.2 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.25 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0 },
};
const C = {
  brick: rgb('5e5148'),
  stone: rgb('c3c2ad'),
  plaster: rgb('d6cfb7'),
  eave: rgb(P.eaves.color),
  iron: rgb('4c4b3f'),
  glass: rgb('435952'),
  gold: rgb('bba054'),
};
export const toWorld = (p) => p;
export const partEvidence = [],
  windowEvidence = [],
  entryEvidence = [],
  roofEvidence = [],
  soffitEvidence = [],
  stairEvidence = [],
  latticeEvidence = [];
let activeLod = 3;
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k]) {
  for (const [ps, n] of [
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
    if (activeLod > 0 || n[1] >= 0) face(o, k, ps, n, col);
}
function cap(o, k, r, y, n) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      r,
      [],
      () => y,
      n,
      (p) => p,
      C[k],
    )
  )
    throw Error('Whole hotel cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      C[k],
    );
  }
}
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
function edge(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    sign = area(r) > 0 ? 1 : -1,
    n = [u[2] * sign, 0, -u[0] * sign],
    at = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d];
  return { a, b, L, u, n, at };
}
function panel(o, k, E, x0, x1, y0, y1, d = 0, col = C[k]) {
  if (x1 - x0 < 1e-5 || y1 - y0 < 1e-5) return;
  face(o, k, [E.at(x0, y0, d), E.at(x1, y0, d), E.at(x1, y1, d), E.at(x0, y1, d)], E.n, col);
}
function block(o, k, E, t, y, w, h, d0, d1, col = C[k]) {
  const b = {
    addConvexPolygon: (k, r, ps, n, _uv, c) =>
      o.addConvexPolygon(
        k,
        r,
        ps.map((p) => E.at(p[0], p[1], p[2])),
        n.map((_v, i) => E.u[i] * n[0] + (i === 1 ? n[1] : 0) + E.n[i] * n[2]),
        (p) => [p[0], p[2]],
        c,
      ),
  };
  box(b, k, [t - w / 2, y, d0], [t + w / 2, y + h, d1], col);
}
function offset(r, d) {
  return r.map((p, i) => {
    const a = edge(r, (i + r.length - 1) % r.length).n,
      b = edge(r, i).n,
      v = [a[0] + b[0], a[2] + b[2]],
      l = Math.hypot(...v);
    if (l < 1e-6) return [p[0] + b[0] * d, p[1] + b[2] * d];
    const nn = v.map((x) => x / l),
      den = nn[0] * b[0] + nn[1] * b[2],
      m = Math.min(d / Math.max(0.25, den), d * 2);
    return [p[0] + nn[0] * m, p[1] + nn[1] * m];
  });
}
function band(o, r, y, d, lod, id) {
  const q = offset(r, d),
    h = P.eaves.thinBand;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = [r[i][0], y, r[i][1]],
      b = [r[j][0], y, r[j][1]],
      c = [q[j][0], y, q[j][1]],
      dd = [q[i][0], y, q[i][1]],
      n = edge(r, i).n;
    face(o, 'eave', [a, b, c, dd], [0, 1, 0]);
    face(o, 'eave', [[dd[0], y - h, dd[2]], [c[0], y - h, c[2]], c, dd], n);
    if (lod >= 2) {
      face(
        o,
        'eave',
        [
          [dd[0], y - h, dd[2]],
          [c[0], y - h, c[2]],
          [b[0], y - h, b[2]],
          [a[0], y - h, a[2]],
        ],
        [0, -1, 0],
      );
      soffitEvidence.push({
        id: `${id}-${i}`,
        point: [(a[0] + b[0] + c[0] + dd[0]) / 4, y - h, (a[2] + b[2] + c[2] + dd[2]) / 4],
      });
    }
  }
}
function lattice(o, E, x0, x1, y0, y1, lod, id) {
  if (lod < 3 || x1 - x0 < 1 || y1 - y0 < 0.4) return;
  const ny = lod === 3 ? 2 : 1,
    nx = Math.max(2, Math.floor((x1 - x0) / (lod === 3 ? P.lattice.pitch : 1.7))),
    dx = (x1 - x0) / nx,
    dy = (y1 - y0) / ny;
  panel(o, 'stone', E, x0, x1, y0, y1, 0.013);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * dx,
        cy = y0 + (j + 0.5) * dy;
      panel(o, 'brick', E, cx - dx * 0.36, cx + dx * 0.36, cy - dy * 0.35, cy + dy * 0.35, 0.028);
    }
  latticeEvidence.push({ id, center: E.at((x0 + x1) / 2, (y0 + y1) / 2, 0.028), normal: E.n });
}
function roomRow(o, E, B, y, lod, id) {
  if (lod === 0) {
    panel(o, 'glass', E, 0.6, E.L - 0.6, y + 1.4, y + 2.5, 0.015);
    return;
  }
  const N = Math.max(1, Math.floor(E.L / (lod === 1 ? 10 : lod === 2 ? 8 : B.roomBayPitch))),
    pitch = E.L / N,
    w = Math.min(B.windowWidth, pitch * 0.74),
    yb = y + B.windowBottomOffset,
    yt = yb + B.windowHeight,
    top = Math.min(y + B.storeyHeight, B.eave);
  for (let i = 0; i < N; i++) {
    const cx = (i + 0.5) * pitch,
      x0 = cx - w / 2,
      x1 = cx + w / 2;
    if (lod === 1) {
      panel(o, 'glass', E, x0, x1, yb, yt, 0.015);
      windowEvidence.push({
        id: `${id}-${i}`,
        center: E.at(cx, (yb + yt) / 2, 0.015),
        normal: E.n,
        recessed: false,
      });
      continue;
    }
    panel(o, 'brick', E, i * pitch, (i + 1) * pitch, y, yb);
    panel(o, 'brick', E, i * pitch, (i + 1) * pitch, yt, top);
    panel(o, 'brick', E, i * pitch, x0, yb, yt);
    panel(o, 'brick', E, x1, (i + 1) * pitch, yb, yt);
    const depth = 0.18;
    panel(o, 'glass', E, x0, x1, yb, yt, -depth);
    for (const [x, s] of [
      [x0, 1],
      [x1, -1],
    ])
      face(
        o,
        'stone',
        [E.at(x, yb), E.at(x, yt), E.at(x, yt, -depth), E.at(x, yb, -depth)],
        E.u.map((v) => v * s),
      );
    face(
      o,
      'stone',
      [E.at(x0, yb), E.at(x0, yb, -depth), E.at(x1, yb, -depth), E.at(x1, yb)],
      [0, 1, 0],
    );
    face(
      o,
      'stone',
      [E.at(x0, yt), E.at(x1, yt), E.at(x1, yt, -depth), E.at(x0, yt, -depth)],
      [0, -1, 0],
    );
    if (lod === 3)
      for (const x of [x0 - 0.045, x1 + 0.045])
        panel(o, 'iron', E, x - 0.035, x + 0.035, yb - 0.045, yt + 0.045, 0.035);
    if (lod === 3)
      for (const Y of [yb - 0.045, yt + 0.045])
        panel(o, 'iron', E, x0 - 0.08, x1 + 0.08, Y - 0.035, Y + 0.035, 0.035);
    if (lod === 3) {
      panel(o, 'iron', E, cx - 0.025, cx + 0.025, yb, yt, -0.13);
      panel(
        o,
        'iron',
        E,
        x0,
        x1,
        yb + B.windowHeight * 0.6 - 0.025,
        yb + B.windowHeight * 0.6 + 0.025,
        -0.13,
      );
    }
    windowEvidence.push({
      id: `${id}-${i}`,
      center: E.at(cx + w * 0.27, (yb + yt) / 2, -depth),
      normal: E.n,
      recessed: true,
    });
    lattice(
      o,
      E,
      i * pitch + 0.13,
      (i + 1) * pitch - 0.13,
      y + 0.18,
      yb - 0.12,
      lod,
      `${id}-spandrel-${i}`,
    );
  }
}
function entry(o, B, E, lod) {
  const K = B.entry,
    t = E.L * K.centerAlong,
    half = K.width / 2,
    y = B.floor,
    h = K.height,
    depth = K.depth;
  panel(o, 'brick', E, 0, t - half, B.foundationBottom, B.podiumTop);
  panel(o, 'brick', E, t + half, E.L, B.foundationBottom, B.podiumTop);
  panel(o, 'brick', E, t - half, t + half, y + h, B.podiumTop);
  panel(o, 'brick', E, t - half, t + half, B.foundationBottom, y);
  if (lod > 0) {
    for (const [x, s] of [
      [t - half, 1],
      [t + half, -1],
    ])
      face(
        o,
        'plaster',
        [E.at(x, y), E.at(x, y + h), E.at(x, y + h, -depth), E.at(x, y, -depth)],
        E.u.map((v) => v * s),
      );
    face(
      o,
      'stone',
      [E.at(t - half, y), E.at(t - half, y, -depth), E.at(t + half, y, -depth), E.at(t + half, y)],
      [0, 1, 0],
    );
    face(
      o,
      'plaster',
      [
        E.at(t - half, y + h),
        E.at(t + half, y + h),
        E.at(t + half, y + h, -depth),
        E.at(t - half, y + h, -depth),
      ],
      [0, -1, 0],
    );
  }
  panel(o, 'glass', E, t - half, t + half, y, y + h, -depth);
  if (lod >= 2)
    for (const x of [t - 2, t, t + 2])
      panel(o, 'iron', E, x - 0.045, x + 0.045, y, y + h, -depth + 0.025);
  // Native intrinsic portico: real depth, underside and four posts; the carriage court is not a slab.
  block(
    o,
    'iron',
    E,
    t,
    K.canopyTop - K.canopyThickness,
    K.canopyWidth,
    K.canopyThickness,
    -0.1,
    K.canopyDepth,
    C.gold,
  );
  for (const s of [-1, 1])
    for (const d of [0.2, K.canopyDepth - 0.25])
      block(
        o,
        'plaster',
        E,
        t + s * (half + 0.6),
        y,
        0.28,
        K.canopyTop - K.canopyThickness - y,
        d - 0.14,
        d + 0.14,
      );
  for (let i = 0; i < K.steps; i++) {
    const yy = y - (K.steps - 1 - i) * K.stepRise,
      run = (K.steps - i) * K.stepRun;
    block(o, 'stone', E, t, B.foundationBottom, K.width + 0.8, yy - B.foundationBottom, 0, run);
    stairEvidence.push({ id: `${B.id}-step-${i}`, point: E.at(t, yy, run - 0.08) });
  }
  entryEvidence.push({
    id: B.id,
    center: E.at(t, y + h * 0.45, 0.12),
    normal: E.n,
    depth,
    height: h,
    floor: y,
    back: E.at(t + 1, y + h * 0.45, -depth),
    canopyPoint: E.at(t, K.canopyTop - K.canopyThickness, K.canopyDepth * 0.6),
    canopyRoofPoint: E.at(t, K.canopyTop, K.canopyDepth * 0.6),
  });
  partEvidence.push({ id: `${B.id}-recessed-portico-and-entry`, posts: 4, steps: K.steps });
}
function core(o, B, lod) {
  const K = B.core,
    [ux, uz] = K.along,
    frame = {
      u: [ux, 0, uz],
      n: [-uz, 0, ux],
      at: (t, y, d = 0) => [K.center[0] + ux * t - uz * d, y, K.center[1] + uz * t + ux * d],
    },
    rbox = (k, w, d, y, h, col) => block(o, k, frame, 0, y, w, h, -d / 2, d / 2, col);
  for (const [i, T] of K.tiers.entries()) {
    rbox('plaster', T.width, T.depth, T.bottom, T.top - T.bottom);
    const roofTop = T.top + 0.4;
    rbox('eave', T.width + T.overhang * 2, T.depth + T.overhang * 2, T.top, 0.4);
    roofEvidence.push({ id: `${B.id}-core-roof-${i}`, point: frame.at(0, roofTop, 0) });
    if (lod > 0) {
      for (let side = 0; side < 4; side++) {
        const coords = [
            [-T.width / 2, -T.depth / 2],
            [T.width / 2, -T.depth / 2],
            [T.width / 2, T.depth / 2],
            [-T.width / 2, T.depth / 2],
          ],
          r = coords.map(([x, z]) => {
            const p = frame.at(x, 0, z);
            return [p[0], p[2]];
          }),
          E = edge(r, side);
        if (B === P.south && i === K.tiers.length - 1) {
          const N = Math.max(2, Math.floor(E.L / (lod === 3 ? 1.5 : 3)));
          for (let j = 0; j < N; j++) {
            const a = (E.L * j) / N + 0.12,
              b = (E.L * (j + 1)) / N - 0.12;
            panel(o, 'glass', E, a, b, T.bottom + 0.45, T.top - 0.4, 0.03);
            if (lod >= 2)
              block(o, 'iron', E, a, T.bottom + 0.4, 0.1, T.top - T.bottom - 0.75, 0.04, 0.14);
          }
        } else {
          lattice(
            o,
            E,
            0.5,
            E.L - 0.5,
            T.bottom + 0.25,
            Math.min(T.bottom + 1.8, T.top - 0.3),
            lod,
            `${B.id}-core-${i}-${side}`,
          );
          if (lod >= 2) {
            const N = Math.max(3, Math.floor(E.L / 0.65));
            for (let j = 0; j < N; j++)
              panel(
                o,
                'iron',
                E,
                0.5 + ((E.L - 1) * j) / N,
                0.5 + ((E.L - 1) * (j + 0.4)) / N,
                T.top - 1.25,
                T.top - 0.35,
                0.03,
              );
          }
        }
      }
    }
    partEvidence.push({ id: `${B.id}-whole-rooftop-tier-${i}`, top: roofTop });
  }
}
function wing(o, B, lod) {
  const r = B.outer;
  cap(o, 'stone', r, B.floor, [0, 1, 0]);
  cap(o, 'eave', r, B.eave, [0, 1, 0]);
  for (let i = 0; i < r.length; i++) {
    const E = edge(r, i),
      isGuest = B.guestEdges.includes(i);
    if (i === B.entry.edge) entry(o, B, E, lod);
    else panel(o, 'brick', E, 0, E.L, B.foundationBottom, B.podiumTop);
    if (lod === 0 || lod === 1 || !isGuest) {
      panel(o, 'brick', E, 0, E.L, B.podiumTop, B.eave);
      if (isGuest) {
        const floors = lod === 0 ? B.guestFloors.filter((_, i) => i % 3 === 0) : B.guestFloors;
        for (const y of floors) roomRow(o, E, B, y, lod, `${B.id}-${i}`);
      } else if (lod >= 2 && E.L > 8) {
        const N = Math.max(1, Math.floor(E.L / 7));
        for (const y of B.guestFloors.filter((_, i) => i % 2 === 0))
          for (let j = 0; j < N; j++) {
            const t = (E.L * (j + 0.5)) / N;
            panel(o, 'glass', E, t - 0.6, t + 0.6, y + 1.2, y + 2.4, 0.025);
            windowEvidence.push({
              id: `${B.id}-estimated-service-window-${i}-${j}`,
              center: E.at(t, y + 1.8, 0.025),
              normal: E.n,
              recessed: false,
            });
          }
      }
    } else {
      for (const y of B.guestFloors) roomRow(o, E, B, y, lod, `${B.id}-${i}`);
      const top = B.guestFloors.at(-1) + B.storeyHeight;
      panel(o, 'brick', E, 0, E.L, top, B.eave);
    }
    if (lod > 0 && i !== B.entry.edge && E.L > 10) {
      const N = Math.max(1, Math.floor(E.L / 10));
      for (let j = 0; j < N; j++) {
        const t = (E.L * (j + 0.5)) / N;
        panel(
          o,
          'glass',
          E,
          t - 1.4,
          t + 1.4,
          B.floor + 1.4,
          Math.min(B.floor + 3.8, B.podiumTop - 0.4),
          0.025,
        );
      }
    }
    roofEvidence.push({
      id: `${B.id}-whole-roof-edge-${i}`,
      point: E.at(E.L * 0.43, B.eave, -0.25),
    });
  }
  const bands =
    lod === 0 ? [B.podiumTop, B.eave] : [B.podiumTop, ...B.guestFloors.slice(1), B.eave];
  for (const [y, i] of bands.map((y, i) => [y, i]))
    band(
      o,
      r,
      y,
      y === B.eave ? P.eaves.capProjection : P.eaves.projection,
      lod,
      `${B.id}-eaves-${i}`,
    );
  core(o, B, lod);
  partEvidence.push({
    id: `${B.id}-whole-native-body-and-closed-roof`,
    controls: r.length,
    floor: B.floor,
    eave: B.eave,
  });
}
export function buildHouse(o, _f, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    windowEvidence,
    entryEvidence,
    roofEvidence,
    soffitEvidence,
    stairEvidence,
    latticeEvidence,
  ])
    a.length = 0;
  wing(o, P.main, lod);
  wing(o, P.south, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/xn/xn7/hotel_okura_tokyo',
  camera = [-315, 195, 320],
  look = [0, 14, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Hotel Okura Tokyo (Main and South Wings,2006)',
  cell: 'xn/xn7',
  wikidataId: 'Q11337851',
  category: 'hotel-commercial',
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
  portableGroundY: -23.3,
  mediumFiContext: {
    scale: 1,
    groundY: -23.3,
    far: 4000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone_raw',
    'plaster_lime',
    'metal_copper',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-old-main-and-south-wings', position: camera, lookAt: look },
    {
      name: 'whole-rear-arms-service-returns-and-closed-roofs',
      position: [300, 185, -310],
      lookAt: look,
    },
    {
      name: 'main-wing-recessed-entry-lattice-spandrels-and-tiered-core',
      position: [-12, 29, 68],
      lookAt: [28, 17, -22],
    },
    {
      name: 'whole-south-wing-nine-room-bands-and-upper-pavilion',
      position: [-207, 43, 111],
      lookAt: [-63, 16, 55],
    },
    {
      name: 'inside-main-portico-and-projected-roof-undersides',
      position: [21.8, 2.4, 4.7],
      lookAt: [26, 5.4, -7],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-two-wings-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2.4,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.75, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Two exact already-cleared published5May2006Lombroso2272x1704originalOwnwork/PD-self photographs/nativeSHA1andnamedrelease independentlybound, normal unchanged Qualla public-domain policy. Historical2014OSMODbL whole13controloldMainWing109502705/22controloldSouthWing148781270 approximate2006context; nativeQ11337851/all1077reservationsclear. Primary officialcompanytext gives original South57m/13above4below, no company photographs adopted. No modern2019replacement, museum/USembassy/neighbor substitute, questionable imagery, copied signs/interiorart/people/cars/trees, photographic textures/generated bitmap or Qualla media/rights edits.',
};
