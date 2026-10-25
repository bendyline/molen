/** Hassan Tower: complete native unfinished minaret with recessed Almohad relief. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ey/ey5/hassan_tower/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  c = Math.cos(A.workingHeading),
  s = Math.sin(A.workingHeading),
  world = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  local = (q) => [c * q[0] + s * q[1], -s * q[0] + c * q[1]],
  P = p.outline.slice(0, -1).map(local),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('b49a73'),
    relief: rgb('bca078'),
    recess: rgb('a58d6b'),
    dark: rgb('4d4b3f'),
    terrace: rgb('b8ad94'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.98, metallic: 0 },
    relief: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
    recess: { slot: 'trim', localRef: ref, roughness: 0.99, metallic: 0 },
    dark: { slot: 'window', localRef: ref, roughness: 0.97, metallic: 0 },
    terrace: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((t, v, i) => t + v * b[i], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = world(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, y, holes = [], col = C[k], up = true) {
  const all = [R, ...holes].flat(),
    starts = holes.map((_, i) => R.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      k,
      ix.slice(i, i + 3).map((j) => [all[j][0], y, all[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function boundary(o, k, R, y0, y1, inward = false) {
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    if (dot(n, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]) < 0)
      n.forEach((v, i) => {
        n[i] = -v;
      });
    if (inward)
      n.forEach((v, i) => {
        n[i] = -v;
      });
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
    );
  }
}
const faces = p.majorFaces.map((ids) => {
  const pts = ids.map((i) => P[i]),
    a = pts[0],
    b = pts.at(-1),
    len = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / len),
    n = [u[1], 0, -u[0]];
  if (dot(n, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]) < 0)
    n.forEach((v, i) => {
      n[i] = -v;
    });
  const stations = pts.map((q) => ({ x: dot(sub(q, a), u), q }));
  return {
    len,
    n,
    u,
    point: (x, y, z = 0) => {
      let j = 0;
      while (j < stations.length - 2 && x > stations[j + 1].x) j++;
      const lo = stations[j],
        hi = stations[j + 1],
        v = (x - lo.x) / (hi.x - lo.x),
        q = lo.q.map((p, i) => p + (hi.q[i] - p) * v);
      return [q[0] + n[0] * z, F + y, q[1] + n[2] * z];
    },
    entryX: dot(sub(P[A.entranceNativeControl], a), u),
  };
});
const rect = (a, b, y0, y1) => [
  [a, y0],
  [b, y0],
  [b, y1],
  [a, y1],
];
function face(o, k, f, R, depth = 0, holes = [], col = C[k]) {
  const all = [R, ...holes].flat(),
    starts = holes.map((_, i) => R.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      k,
      ix.slice(i, i + 3).map((j) => f.point(...all[j], depth)),
      f.n,
      col,
    );
}
function edge(o, k, f, R, z0, z1, inward = false) {
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      v = sub(b, a),
      n = [f.u[0] * v[1], -v[0], f.u[1] * v[1]];
    if (inward)
      n.forEach((v, i) => {
        n[i] = -v;
      });
    Q(o, k, [f.point(...a, z0), f.point(...b, z0), f.point(...b, z1), f.point(...a, z1)], n);
  }
}
function rib(o, f, a, b, w, z, depth, d, k = 'relief') {
  const v = sub(b, a),
    len = Math.hypot(...v);
  if (len < 1e-6) return;
  const n = [((-v[1] / len) * w) / 2, ((v[0] / len) * w) / 2],
    R = [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ];
  Q(
    o,
    k,
    R.map((q) => f.point(...q, z)),
    f.n,
  );
  if (d > 0) {
    const mid = a.map((v, i) => (v + b[i]) / 2);
    for (const i of d > 1 ? [0, 1, 2, 3] : [0, 2]) {
      const j = (i + 1) % 4,
        dx = (R[i][0] + R[j][0]) / 2 - mid[0],
        dy = (R[i][1] + R[j][1]) / 2 - mid[1];
      Q(
        o,
        k,
        [
          f.point(...R[i], z),
          f.point(...R[j], z),
          f.point(...R[j], z - depth),
          f.point(...R[i], z - depth),
        ],
        [f.u[0] * dx, dy, f.u[1] * dx],
      );
    }
  }
}
function path(o, f, R, w, z, depth, d, closed = false, k = 'relief') {
  for (let i = 0; i < R.length - (closed ? 0 : 1); i++)
    rib(o, f, R[i], R[(i + 1) % R.length], w, z, depth, d, k);
}
function arch({ x, w, base, spring, peak }, N, lobes = 0) {
  return [
    [x - w / 2, base],
    ...Array.from({ length: N + 1 }, (_, i) => {
      const t = (i * Math.PI) / N,
        r = lobes ? 1 + 0.07 * Math.sin((i * Math.PI * lobes) / N) : 1;
      return [x - (w / 2) * Math.cos(t) * r, spring + (peak - spring) * Math.sin(t) * r];
    }),
    [x + w / 2, base],
  ];
}
function opening(x, w, lo, spring, peak, N) {
  return [
    [x - w * 0.38, lo],
    [x + w * 0.38, lo],
    [x + w * 0.38, spring],
    ...Array.from({ length: N + 1 }, (_, i) => {
      const t = (i * Math.PI) / N;
      return [x + (w / 2) * Math.cos(t), spring + (peak - spring) * Math.sin(t)];
    }),
    [x - w * 0.38, spring],
  ];
}
function recessed(o, f, R, z, holes, d) {
  face(
    o,
    'recess',
    f,
    R,
    z,
    holes.map((h) => h.R),
  );
  edge(o, 'relief', f, R, 0, z, true);
  for (const h of holes) {
    edge(o, 'relief', f, h.R, z, -A.openingDepth, true);
    face(o, 'dark', f, h.R, -A.openingDepth);
    if (d > 1) path(o, f, h.R, 0.045, z + 0.025, 0.05, d, true);
  }
}
function lattice(o, f, d) {
  const cols = [2, 3, 5, 8][d],
    rows = [3, 4, 7, 11][d],
    dx = A.sebka.width / cols,
    dy = (A.sebka.top - A.sebka.bottom) / rows;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = f.len / 2 - A.sebka.width / 2 + (i + 0.5) * dx,
        y = A.sebka.bottom + (j + 0.5) * dy,
        R = [
          [x - dx * 0.48, y],
          [x, y + dy * 0.48],
          [x + dx * 0.48, y],
          [x, y - dy * 0.48],
        ];
      if (d === 3) {
        const L = [];
        for (let k = 0; k < 4; k++) {
          const a = R[k],
            b = R[(k + 1) % 4],
            v = sub(b, a),
            l = Math.hypot(...v),
            sg = k % 2 ? 1 : -1;
          L.push(a, [
            (a[0] + b[0]) / 2 - (v[1] / l) * 0.065 * sg,
            (a[1] + b[1]) / 2 + (v[0] / l) * 0.065 * sg,
          ]);
        }
        path(o, f, L, 0.075, -0.035, 0.15, d, true);
      } else path(o, f, R, [0.14, 0.12, 0.09, 0.075][d], -0.035, 0.15, d, true);
    }
}
function facade(o, f, fi, d) {
  const N = [4, 6, 12, 24][d],
    x = f.len / 2,
    lo = rect(x - A.panelHalfWidth, x + A.panelHalfWidth, ...A.lowerPanel),
    up = rect(x - A.panelHalfWidth, x + A.panelHalfWidth, ...A.upperPanel),
    entry = fi === 1 ? opening(f.entryX, 1.45, 0.02, 1.9, 3.05, N) : null,
    slit = fi % 2 === 0 ? rect(x - 0.11, x + 0.11, 25.4, 26.3) : null,
    hs = [lo, up, ...(entry ? [entry] : []), ...(slit ? [slit] : [])];
  face(o, 'wall', f, rect(0, f.len, A.plinthTop, A.height), 0, hs);
  if (entry) {
    edge(o, 'relief', f, entry, 0, -A.openingDepth, true);
    face(o, 'dark', f, entry, -A.openingDepth);
    path(o, f, entry, 0.12, 0.03, 0.12, d, true);
  }
  if (slit) {
    edge(o, 'relief', f, slit, 0, -0.4, true);
    face(o, 'dark', f, slit, -0.4);
  }
  const lowerHole = rect(x - 0.1, x + 0.1, 19.2, 20.1),
    upperHole = opening(x, 0.95, 27.7, 29.5, 30.7, N);
  recessed(o, f, lo, -A.panelDepth, [{ R: lowerHole }], d);
  recessed(o, f, up, -A.panelDepth, [{ R: upperHole }], d);
  const count = fi % 2 === 0 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : (i - 0.5) * 4.25,
      scale = count === 1 ? 1 : 0.54;
    for (const [opts, w] of [
      [A.mainArch, 0.12],
      [A.outerArch, 0.105],
    ])
      path(
        o,
        f,
        arch(
          {
            x: x + off,
            w: opts.width * scale,
            base: opts.base,
            spring: opts.spring,
            peak: opts.peak,
          },
          N,
          opts === A.outerArch ? 5 : 0,
        ),
        w,
        -0.035,
        0.15,
        d,
      );
  }
  for (let i = 0; i < A.upperArcade.count; i++) {
    const xx = x + (i - 1) * 3.65;
    path(
      o,
      f,
      arch(
        {
          x: xx,
          w: A.upperArcade.width,
          base: A.upperArcade.base,
          spring: A.upperArcade.spring,
          peak: A.upperArcade.peak,
        },
        N,
        7,
      ),
      0.12,
      -0.035,
      0.15,
      d,
    );
  }
  lattice(o, f, d);
  for (const y of [13.75, 24.7, 26.85]) {
    rib(o, f, [x - A.panelHalfWidth, y], [x + A.panelHalfWidth, y], d ? 0.16 : 0.13, 0.02, 0.12, d);
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      const xx = x + side * (A.panelHalfWidth + 0.1);
      rib(o, f, [xx, 13.8], [xx, 43.7], 0.16, 0.025, 0.11, d);
    }
  if (d > 1)
    for (let y = 0.8; y < 43.5; y += 0.72)
      for (const xx of [0.45, f.len - 0.45])
        rib(o, f, [xx - 0.35, y], [xx + 0.35, y], 0.028, 0.025, 0.035, d, 'wall');
}
function build(o, _f, d = 3) {
  boundary(o, 'wall', P, F, F + A.plinthTop);
  flat(o, 'wall', P, F, [], C.wall, false);
  for (const [fi, f] of faces.entries()) facade(o, f, fi, d);
  const inner = P.map((q) => q.map((v) => v * (1 - A.roofParapetWidth / 7.75)));
  flat(o, 'relief', P, F + A.height, [inner]);
  boundary(o, 'recess', inner, F + A.height - A.roofParapetDepth, F + A.height, true);
  flat(o, 'terrace', inner, F + A.height - A.roofParapetDepth);
}
export const hassanTowerSkyline = (o, f) => build(o, f, 0);
export const hassanTowerDistrict = (o, f) => build(o, f, 1);
export const hassanTowerStreet = (o, f) => build(o, f, 2);
export const hassanTowerCloseup = (o, f) => build(o, f, 3);
export const hassanTowerModel = {
  id: 'hassan_tower',
  key: 'hassan_tower',
  cell: 'ey/ey5',
  recipe: 'structure-hassan-tower.mjs',
  title: 'Hassan Tower',
  category: 'tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [52, 34, 62],
  lookAt: [0, F + 22, 0],
  portableGroundY: F - 0.12,
  mediumFiContext: { scale: 1, groundY: F - 0.12 },
  qaCameras: [
    {
      name: 'whole44m-unfinished-minaret-native-footprint',
      position: [48, 30, 57],
      lookAt: [0, F + 22, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'southern-horseshoe-panel-and-native-entrance',
      position: [9, 15, 30],
      lookAt: [0, F + 14, 6],
    },
    {
      name: 'upper-sebka-relief-lobed-arcade-and-window',
      position: [20, 36, 27],
      lookAt: [2, F + 34, 4],
    },
    {
      name: 'eastern-paired-blind-arches-and-corner-piers',
      position: [34, 23, -14],
      lookAt: [6, F + 23, -2],
    },
    {
      name: 'level-uncompleted-top-recessed-roof-terrace',
      position: [25, 55, 27],
      lookAt: [0, F + 42, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hassan-tower.mjs',
    level: 'skyline',
    export: 'hassanTowerSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'hassanTowerDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'hassanTowerStreet', errorMeters: 0.13, surfaces },
      closeup: { export: 'hassanTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole surviving44m square unfinishedminaret/allnine nativeboundarycontrols, full fourfacades/nativeedge interpolation, long plainlower masonry/cornerpiers, real recessedblind horseshoe/lobedarch panels, raisedupper sebka diamondnetwork, small actualarchedopening/windowbacks andlevelunfinishedtop/recessedterrace. No fabricatedcompleted upperlantern/spire orprivateinterior.',
    'Exact published CarlosZGZ creatorCC0 original/nativeSHA1matched andpersonallyinspected. No supplementalphotographs/generatedbitmaps/photo textures or copied protectedplan. Anonymoushistoricaldrawing/1921plan unselected; foreground separateunfinishedmosquecolumnfield/modernHassanMosque/mausoleum/park/whitebalustrades excluded.',
    '44m nativeheight andwholemappedfootprint factual. Panelheights/reliefdepths/lobe anddiamondcensus, hiddennorth/west facade ornament andunfinishedterrace section original bounded photoestimates. Detail levels simplify physicalcarving while preserving silhouette/main recessedpanelvocabulary.',
    'Original400m129x129field/16641samples/four rawtiles frozen before floors/geometry. Floor-1.2m relative fixed33.4426m provider datum is unsurveyed structuralreference. Groundgrid/PNG/rawtiles unchanged; exacthostfoundation/threshold contact unresolved, geographicpreview/replaceFootprintfalse. Diagnosticflatground separate; no artificialsiteplate.',
  ],
};
