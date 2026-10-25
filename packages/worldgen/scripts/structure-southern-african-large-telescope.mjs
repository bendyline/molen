/** SALT: native whole observing building, silver panel dome and tall ventilation tower. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/k6/k6n/southern_african_large_telescope/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('d5d6ce'),
    shell: rgb('aab5b6'),
    metal: rgb('8d9997'),
    dark: rgb('485c5c'),
    foundation: rgb('b9bcb1'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.96, metallic: 0 },
    shell: { slot: 'roof', graph: 'metal_painted', roughness: 0.64, metallic: 0.32 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.18 },
    dark: { slot: 'window', localRef: ref, roughness: 0.86, metallic: 0.03 },
    foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  identity = { u: [1, 0, 0], n: [0, 0, 1] };
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    k,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, P, y, up = true, col = C[k]) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [P[j][0], y, P[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, k, c, size, f = identity, col = C[k]) {
  const v = (x, y, z) => [c[0] + f.u[0] * x + f.n[0] * z, c[1] + y, c[2] + f.u[2] * x + f.n[2] * z],
    N = (x, y, z) => [f.u[0] * x + f.n[0] * z, y, f.u[2] * x + f.n[2] * z],
    [x, y, z] = size.map((v) => v / 2);
  for (const [q, n] of [
    [
      [
        [-x, -y, z],
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
      ],
      N(0, 0, 1),
    ],
    [
      [
        [x, -y, -z],
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
      ],
      N(0, 0, -1),
    ],
    [
      [
        [-x, -y, -z],
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
      ],
      N(-1, 0, 0),
    ],
    [
      [
        [x, -y, z],
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
      ],
      N(1, 0, 0),
    ],
    [
      [
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
        [-x, y, -z],
      ],
      N(0, 1, 0),
    ],
    [
      [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
      ],
      N(0, -1, 0),
    ],
  ])
    Q(
      o,
      k,
      q.map((q) => v(...q)),
      n,
      col,
    );
}
function rod(o, k, a, b, w, col = C[k]) {
  const u = normalize(sub(b, a)),
    n = normalize(cross(u, Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(u, n),
    rings = [a, b].map((c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => c.map((q, i) => q + ((n[i] * x + v[i] * z) * w) / 2)),
    );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      k,
      [rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
      rings[0][i].map((q, k) => q - a[k]),
      col,
    );
  }
  Q(
    o,
    k,
    [...rings[0]].reverse(),
    u.map((v) => -v),
    col,
  );
  Q(o, k, rings[1], u, col);
}
function frames(P) {
  const center = [0, 1].map((k) => P.reduce((s, v) => s + v[k], 0) / P.length);
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length],
      len = Math.hypot(...sub(b, a)),
      u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      n = [u[2], 0, -u[0]],
      mid = [(a[0] + b[0]) / 2 - center[0], 0, (a[1] + b[1]) / 2 - center[1]];
    if (dot(n, mid) < 0)
      n.forEach((v, k) => {
        n[k] = -v;
      });
    return {
      len,
      u,
      n,
      P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, F + y, a[1] + u[2] * x + n[2] * z],
    };
  });
}
function panel(o, k, f, x0, x1, y0, y1, z = 0, col = C[k]) {
  Q(o, k, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function louvre(o, f, w, y, d) {
  const x = f.len / 2,
    h = A.louvreHeight,
    r = A.recessDepth,
    l = x - w / 2,
    rr = x + w / 2,
    b = y - h / 2,
    t = y + h / 2;
  panel(o, 'dark', f, l, rr, b, t, d ? -r : 0.015);
  if (!d) return;
  for (const [x, s] of [
    [l, 1],
    [rr, -1],
  ])
    Q(
      o,
      'wall',
      [f.P(x, b), f.P(x, t), f.P(x, t, -r), f.P(x, b, -r)],
      f.u.map((v) => v * s),
    );
  for (const [y, s] of [
    [b, 1],
    [t, -1],
  ])
    Q(o, 'wall', [f.P(l, y), f.P(rr, y), f.P(rr, y, -r), f.P(l, y, -r)], [0, s, 0]);
  if (d >= 2) {
    for (const xx of [l, rr]) box(o, 'metal', f.P(xx, y, 0.025), [0.095, h + 0.12, 0.075], f);
    for (const yy of [b, t]) box(o, 'metal', f.P(x, yy, 0.025), [w + 0.1, 0.095, 0.075], f);
    const n = d === 3 ? 6 : 4;
    for (let j = 0; j < n; j++)
      box(
        o,
        'metal',
        f.P(x, b + ((j + 0.5) * h) / n, -0.06),
        [w - 0.06, 0.055, 0.14],
        f,
        rgb(j % 2 ? '8e9b99' : 'a0aba5'),
      );
  }
}
function facade(o, P, y0, y1, d, { windows = true } = {}) {
  for (const f of frames(P)) {
    const rows = A.louvreRows.filter(
        (y) => y - A.louvreHeight / 2 > y0 + 0.2 && y + A.louvreHeight / 2 < y1 - 0.15,
      ),
      ok = windows && f.len > 2.9,
      w = Math.min(A.louvreWidth, f.len - 0.9),
      xs = d && ok ? [0, (f.len - w) / 2, (f.len + w) / 2, f.len] : [0, f.len],
      ys = [
        y0,
        ...(d && ok ? rows.flatMap((y) => [y - A.louvreHeight / 2, y + A.louvreHeight / 2]) : []),
        y1,
      ];
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        const hole =
          d &&
          ok &&
          i === 2 &&
          rows.some(
            (y) =>
              ys[j - 1] >= y - A.louvreHeight / 2 - 1e-8 && ys[j] <= y + A.louvreHeight / 2 + 1e-8,
          );
        if (!hole) panel(o, 'wall', f, xs[i - 1], xs[i], ys[j - 1], ys[j]);
      }
    if (ok) for (const y of rows) louvre(o, f, w, y, d);
  }
}
function prism(o, k, P, y0, y1, col = C[k]) {
  for (const f of frames(P)) panel(o, k, f, 0, f.len, y0, y1, 0, col);
  flat(o, k, P, F + y1, true, col);
  flat(o, k, P, F + y0, false, col);
}
function ellipse(c, r, n) {
  return Array.from({ length: n }, (_, i) => [
    c[0] + r[0] * Math.cos((i * 2 * Math.PI) / n),
    c[1] + r[1] * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function ring(o, k, c, r, y0, y1, d, col = C[k]) {
  prism(o, k, ellipse(c, r, [16, 24, 40, 64][d]), y0, y1, col);
}
function dome(o, c, r, y, rise, d, { silver = false } = {}) {
  const N = [16, 24, 40, 64][d],
    J = [4, 6, 8, 12][d],
    rings = Array.from({ length: J }, (_, j) =>
      Array.from({ length: N }, (_, i) => {
        const th = ((j / J) * Math.PI) / 2,
          az = ((i + (j % 2) * 0.5) / N) * 2 * Math.PI;
        return [
          c[0] + r[0] * Math.cos(th) * Math.cos(az),
          F + y + rise * Math.sin(th),
          c[1] + r[1] * Math.cos(th) * Math.sin(az),
        ];
      }),
    ),
    top = [c[0], F + y + rise, c[1]],
    edges = new Map(),
    edge = (a, b) => {
      const aa = a.map((v) => v.toFixed(5)).join(','),
        bb = b.map((v) => v.toFixed(5)).join(',');
      edges.set(aa < bb ? `${aa}|${bb}` : `${bb}|${aa}`, [a, b]);
    },
    tri = (q, j, i) => {
      const n = normalize([
          q.reduce((s, v) => s + v[0], 0) / 3 - c[0],
          ((q.reduce((s, v) => s + v[1], 0) / 3 - (F + y)) * r[0]) / rise,
          q.reduce((s, v) => s + v[2], 0) / 3 - c[1],
        ]),
        col = silver ? rgb(['a9b5b6', 'b5bfc0', 'bfc6c4', 'a4b1b4'][(i + j) % 4]) : C.wall;
      T(o, silver ? 'shell' : 'wall', q, n, col);
      if (silver && d > 0) for (let k = 0; k < 3; k++) edge(q[k], q[(k + 1) % 3]);
    };
  for (let j = 0; j < J - 1; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        a = rings[j][i],
        b = rings[j][k],
        cc = rings[j + 1][k],
        dd = rings[j + 1][i];
      tri([a, b, cc], j, i);
      tri([a, cc, dd], j, i);
    }
  for (let i = 0; i < N; i++) tri([rings[J - 1][i], rings[J - 1][(i + 1) % N], top], J - 1, i);
  if (silver && d > 0)
    for (const [a, b] of edges.values()) {
      if (d <= 2) {
        const n = normalize([
            (a[0] + b[0]) / 2 - c[0],
            (a[1] + b[1]) / 2 - (F + y),
            (a[2] + b[2]) / 2 - c[1],
          ]),
          u = normalize(cross(sub(b, a), n)).map((v) => v * 0.026),
          v = (q) => q.map((x, i) => x + n[i] * 0.025),
          aa = v(a),
          bb = v(b);
        Q(
          o,
          'metal',
          [
            aa.map((x, i) => x - u[i]),
            bb.map((x, i) => x - u[i]),
            bb.map((x, i) => x + u[i]),
            aa.map((x, i) => x + u[i]),
          ],
          n,
          rgb('c3c9c4'),
        );
      } else rod(o, 'metal', a, b, d === 3 ? 0.055 : 0.065, rgb('c6ccc7'));
    }
  // Daytime closed shutter: two restrained meridian rails, no invented open optical interior.
  if (silver && d >= 2)
    for (const az of [A.shutterHeading - 0.14, A.shutterHeading + 0.14])
      for (let j = 0; j < J; j++) {
        const P = (t) => [
          c[0] + (r[0] + 0.06) * Math.cos(t) * Math.cos(az),
          F + y + (rise + 0.06) * Math.sin(t),
          c[1] + (r[1] + 0.06) * Math.cos(t) * Math.sin(az),
        ];
        rod(
          o,
          'metal',
          P(((j / J) * Math.PI) / 2),
          P((((j + 1) / J) * Math.PI) / 2),
          0.07,
          rgb('9ba7a5'),
        );
      }
}
function access(o, d) {
  if (d === 0) return;
  const cx = p.bodyCenter[0] - p.bodyRadii[0] - 0.8,
    z0 = 6.2,
    n = d === 1 ? 8 : 16,
    top = 4.35;
  for (let i = 0; i < n; i++)
    box(o, 'metal', [cx, F + (top * (i + 0.5)) / n, z0 - i * 0.3], [1.15, 0.12, 0.31], identity);
  for (const x of [cx - 0.65, cx + 0.65]) {
    rod(o, 'metal', [x, F + 1, z0 + 0.2], [x, F + top + 1, z0 - (n - 1) * 0.3], 0.065);
    if (d >= 2)
      for (let i = 0; i < n; i += 3)
        rod(
          o,
          'metal',
          [x, F + (top * (i + 0.5)) / n, z0 - i * 0.3],
          [x, F + (top * (i + 0.5)) / n + 1, z0 - i * 0.3],
          0.055,
        );
  }
  box(o, 'metal', [cx, F + top, z0 - (n - 1) * 0.3 - 0.4], [1.6, 0.18, 1], identity);
  if (d >= 2) {
    const x = p.towerCenter[0] - 3.8,
      z = p.towerCenter[1] + 3.8;
    for (const xx of [x - 0.35, x + 0.35]) rod(o, 'metal', [xx, F + 7, z], [xx, F + 18, z], 0.055);
    for (let i = 0; i < 32; i++)
      rod(o, 'metal', [x - 0.35, F + 7 + i * 0.34, z], [x + 0.35, F + 7 + i * 0.34, z], 0.04);
    box(o, 'metal', [x + 0.6, F + 17.6, z], [2.2, 0.12, 1.4], identity);
  }
}
function build(o, _f, d = 3) {
  const whole = p.outline.slice(0, -1),
    body = p.bodyControls,
    t = p.towerCenter,
    tr = p.towerRadii;
  prism(o, 'foundation', whole, 0, 0.22);
  facade(o, whole, 0.22, A.annexTop, d);
  flat(o, 'wall', whole, F + A.annexTop);
  facade(o, body, A.annexTop, A.bodyWallHeight, d);
  flat(o, 'wall', body, F + A.bodyWallHeight);
  flat(o, 'wall', body, F + 0.22, false);
  ring(
    o,
    'metal',
    p.bodyCenter,
    p.bodyRadii.map((v) => v + A.domeOverhang),
    A.bodyWallHeight - 0.2,
    A.bodyWallHeight + A.domeRimHeight,
    d,
    rgb('5b6866'),
  );
  dome(
    o,
    p.bodyCenter,
    p.bodyRadii.map((v) => v + A.domeOverhang),
    A.bodyWallHeight + A.domeRimHeight,
    A.domeRise,
    d,
    { silver: true },
  );
  // Lower tower follows every original mapped tower vertex; its upper shaft remains round.
  prism(o, 'wall', p.towerControls, A.annexTop, 18.1);
  ring(o, 'wall', t, tr, 18, A.towerShaftHeight, d);
  ring(
    o,
    'wall',
    t,
    tr.map((v) => v + 0.22),
    17.8,
    18.15,
    d,
    rgb('c5c8bd'),
  );
  ring(
    o,
    'wall',
    t,
    tr.map((v) => v + 0.18),
    A.towerShaftHeight - 0.25,
    A.towerShaftHeight + 0.15,
    d,
  );
  const R = tr.map((v) => v + A.towerOverhang);
  dome(o, t, R, A.towerCapBase, A.towerCapRise, d);
  flat(o, 'wall', ellipse(t, R, [16, 24, 40, 64][d]), F + A.towerCapBase, false);
  const bcount = [4, 6, 10, 14][d];
  for (let i = 0; i < bcount; i++) {
    const a = (i * 2 * Math.PI) / bcount,
      c = [
        t[0] + Math.cos(a) * tr[0],
        F + (A.towerShaftHeight + A.towerCapBase) / 2,
        t[1] + Math.sin(a) * tr[1],
      ];
    box(o, 'metal', c, [0.16, A.towerCapBase - A.towerShaftHeight, 0.2], identity);
    if (d >= 2)
      rod(
        o,
        'metal',
        [t[0] + Math.cos(a) * tr[0], F + A.towerShaftHeight - 0.4, t[1] + Math.sin(a) * tr[1]],
        [t[0] + Math.cos(a) * R[0], F + A.towerCapBase - 0.1, t[1] + Math.sin(a) * R[1]],
        0.13,
      );
  }
  // Bounded intrinsic low visitor/service projection, never a separate campus building.
  const x = t[0],
    z = t[1],
    annex = [
      [x - 3.3, z - 5.2],
      [x + 4.9, z - 5.2],
      [x + 4.9, z + 4.8],
      [x - 3.3, z + 4.8],
    ];
  prism(o, 'wall', annex, 0.22, 4.8);
  for (const f of frames(annex))
    if (f.n[0] > 0.8 || f.n[2] > 0.8) {
      panel(o, 'dark', f, f.len * 0.38, f.len * 0.62, 1, 3.5, 0.02);
      if (d >= 2) {
        for (const xx of [f.len * 0.38, f.len * 0.62])
          box(o, 'metal', f.P(xx, 2.25, 0.04), [0.08, 2.65, 0.07], f);
      }
    }
  if (d >= 2) {
    const n = d === 3 ? 96 : 48;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      rod(
        o,
        'wall',
        [t[0] + (tr[0] + 0.025) * Math.cos(a), F + 18.3, t[1] + (tr[1] + 0.025) * Math.sin(a)],
        [
          t[0] + (tr[0] + 0.025) * Math.cos(a),
          F + A.towerShaftHeight - 0.45,
          t[1] + (tr[1] + 0.025) * Math.sin(a),
        ],
        0.045,
        rgb('c6cabe'),
      );
    }
    rod(
      o,
      'metal',
      [t[0], F + A.towerCapBase + A.towerCapRise, t[1]],
      [t[0], F + A.towerCapBase + A.towerCapRise + 0.9, t[1]],
      0.035,
    );
  }
  access(o, d);
}
export const saltSkyline = (o, f) => build(o, f, 0);
export const saltDistrict = (o, f) => build(o, f, 1);
export const saltStreet = (o, f) => build(o, f, 2);
export const saltCloseup = (o, f) => build(o, f, 3);
export const southernAfricanLargeTelescopeModel = {
  id: 'southern_african_large_telescope',
  key: 'southern_african_large_telescope',
  cell: 'k6/k6n',
  recipe: 'structure-southern-african-large-telescope.mjs',
  title: 'Southern African Large Telescope',
  category: 'observatory',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [58, 39, 67],
  lookAt: [0, 18, 0],
  portableGroundY: -1,
  mediumFiContext: { scale: 1.1, groundY: -1 },
  qaCameras: [
    {
      name: 'whole-salt-dome-drum-and-tall-ventilation-tower',
      position: [55, 32, 65],
      lookAt: [0, 18, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'silver-polygon-panel-dome-and-closed-shutter-rails',
      position: [-25, 36, 30],
      lookAt: [-2, 24, 0],
    },
    {
      name: 'real-recessed-louvres-low-service-annex-and-stairs',
      position: [28, 11, 28],
      lookAt: [2, 9, 4],
    },
    {
      name: 'ribbed-ventilation-shaft-open-cap-brackets-and-round-cap',
      position: [31, 36, -25],
      lookAt: [11.35, 31, -7.05],
    },
    {
      name: 'whole-rear-curved-drum-and-access-structures',
      position: [-45, 24, -45],
      lookAt: [-1, 15, -1],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-southern-african-large-telescope.mjs',
    level: 'skyline',
    export: 'saltSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'saltDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'saltStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'saltCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole original observingbuilding/native29control base/main whitecylinder/silvertriangularpolygonpaneldome/darkrim/attachedtall ribbedventilationtower/smallroundcap/openundersidebrackets/lowvisitorserviceannex/exteriorstairs andladder. Allnativewholefootprintcontrols retained atallLODs; nativecirclecoarseness remains. FullsurvivingSALT only, separateSAAOcampus andotherinstruments excluded.',
    'Exact1704x2272 Siener2006-09-23 Own/PD-self Qualla original724306bytes/nativeSHA1matched, personallyinspected. No supplementalphotos/interior mirror/photo textures/generatedbitmaps. Closed-daytime dome representsobservatoryatrest, not a fabricatedopen instrumentinterior; panels andtwo closedshutterrails original bounded exterior estimates, no claim ofexactoperatingstate.',
    'Nativefootprint supplieswholebody/attachedtower positionandextent, not surveyed elevations/domeprofile/shuttermechanism/louvrecount/annex/stair sections/currentfinish. Main18mwall/10.2mdomerise/tall32.5mshaft/34.2mcapbase/3.65mroundcap andhiddenbackventcensus originalphotoproportion estimates; mirror11mdiameter never substitutedforbuildingwidth. Lowerannex bounded1.5mprojection, no surroundingcampus geometry.',
    'Independent400m129x129field/16641samples/one rawTerrariumtile frozen beforefloors/geometry. FixedSWdatum1753.5394m/floor0 providerrelative, not story1837mengineeringdatum. Groundgrid/PNG/rawsource unchanged; precise threshold/foundation/annex/stair contact unresolved, geographicpreview/replaceFootprintfalse. Portable/context flatreviewground a separate diagnosticfixture, no artificialmountaintop/platform orfittednativegrade.',
  ],
};
