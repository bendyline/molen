/** Whole historic Hotel Nutibara: native base, recessed room block and three-gabled tiled crown. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d3/d34/hotel_nutibara/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('c8c9be'),
    trim: rgb('dbdbce'),
    roof: rgb('a75f3e'),
    terrace: rgb('a3a599'),
    glass: rgb('465452'),
    metal: rgb('626b65'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
    terrace: { slot: 'roof', graph: 'concrete_boardformed', roughness: 0.97, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.07 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.1 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
const area = (r) =>
    r.reduce((a, q, i) => a + q[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * q[1], 0),
  winding = Math.sign(area(p.core));
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function F(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [winding * u[1], 0, -winding * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function B(o, s, x, y, z, w, h, l) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], C[s]);
}
function strip(o, s, f, x, y, w, h, z = 0) {
  Q(
    o,
    s,
    [
      f.P(x - w / 2, y, z),
      f.P(x + w / 2, y, z),
      f.P(x + w / 2, y + h, z),
      f.P(x - w / 2, y + h, z),
    ],
    f.n,
  );
}
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function face(o, s, f, y0, y1, holes = [], depth = 0.38) {
  const rings = [
      [
        [0, y0],
        [f.len, y0],
        [f.len, y1],
        [0, y1],
      ],
      ...holes,
    ],
    pts = rings.flat(),
    ix = earcut(
      pts.flat(),
      holes.map((_, i) => 4 + holes.slice(0, i).reduce((a, h) => a + h.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...pts[k])),
      f.n,
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      Q(o, 'trim', [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)]);
    }
    const ids = earcut(h.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        'glass',
        ids.slice(i, i + 3).map((k) => f.P(...h[k], -depth)),
        f.n,
      );
  }
}
function edgeCornice(o, r, y, w = 0.24, h = 0.22) {
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]);
    beam(o, 'trim', f.P(0, y, w / 2), f.P(f.len, y, w / 2), h, w, C.trim);
  }
}
function base(o, d) {
  const r = p.outline;
  cap(o, 'terrace', r, 6.4);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]),
      n = Math.max(1, Math.floor(f.len / 4.8)),
      holes = [];
    if (f.len > 3) {
      for (let k = 0; k < n; k++) {
        const x = ((k + 0.5) * f.len) / n;
        if (d >= 2) holes.push(rect(x, 0.45, (f.len / n) * 0.65, 4.85));
        else strip(o, 'glass', f, x, 0.65, (f.len / n) * 0.65, 4.4, 0.1);
      }
    }
    face(o, 'wall', f, 0, 6.4, holes, 0.7);
  }
  edgeCornice(o, r, 6.1, 0.4, 0.34);
  if (d >= 1) edgeCornice(o, r, 3.35, 0.12, 0.16);
  const n = [4, 8, 12, 20][d],
    r0 = [
      [-0.5, 9.8],
      [9.5, 9.8],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const t = (i * Math.PI) / n;
        return [4.5 + 5 * Math.cos(t), 10.4 + 5 * Math.sin(t)];
      }),
    ];
  cap(o, 'trim', r0, 4.75);
  cap(o, 'trim', r0, 4.35, false);
  for (let i = 0; i < r0.length; i++) {
    const a = r0[i],
      b = r0[(i + 1) % r0.length];
    Q(o, 'trim', [
      [a[0], 4.35, a[1]],
      [b[0], 4.35, b[1]],
      [b[0], 4.75, b[1]],
      [a[0], 4.75, a[1]],
    ]);
  }
  for (const x of [0.1, 8.9]) B(o, 'trim', x, 0, 12.5, 0.5, 4.35, 0.5);
}
function body(o, d) {
  const r = p.core;
  cap(o, 'terrace', r, 29.5);
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4]),
      wide = i === 0 || i === 2,
      cols = wide ? 9 : 4,
      holes = [],
      rows = d === 0 ? 3 : 7;
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < cols; k++) {
        const x = ((k + 0.5) * f.len) / cols,
          y = 6.4 + (j * 23.1) / rows + 0.55,
          h = 23.1 / rows - 1.0;
        if (d >= 2) {
          for (const off of [-0.66, 0.66]) holes.push(rect(x + off, y, 1.13, h));
        } else strip(o, 'glass', f, x, y, wide ? 2.55 : 1.9, h, 0.1);
      }
    face(o, 'wall', f, 6.4, 29.5, holes, 0.42);
    if (d >= 1)
      for (let k = 0; k <= cols; k++) {
        const x = (k * f.len) / cols;
        beam(o, 'trim', f.P(x, 6.4, 0.16), f.P(x, 29.5, 0.16), 0.32, 0.3, C.trim);
      }
    if (d === 3)
      for (const h of holes) {
        const x = (h[0][0] + h[1][0]) / 2,
          y = (h[0][1] + h[2][1]) / 2;
        beam(o, 'metal', f.P(x, h[0][1], -0.36), f.P(x, h[2][1], -0.36), 0.045, 0.045, C.metal);
        beam(o, 'metal', f.P(h[0][0], y, -0.36), f.P(h[1][0], y, -0.36), 0.045, 0.045, C.metal);
      }
  }
  for (const [y, w, h] of [
    [6.4, 0.4, 0.24],
    [28.7, 0.3, 0.24],
    [29.35, 0.65, 0.3],
  ])
    edgeCornice(o, r, y, w, h);
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    shoulder = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = (i * Math.PI) / n;
      return [x + r * Math.cos(t), shoulder + r * Math.sin(t)];
    }),
  ];
}
function hip(o, x0, x1, z0, z1, y, peak, d) {
  const longX = x1 - x0 >= z1 - z0,
    inset = Math.min((z1 - z0) / 2, (x1 - x0) / 2),
    a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    e = [x0, y, z1],
    q = longX ? [x0 + inset, peak, (z0 + z1) / 2] : [(x0 + x1) / 2, peak, z0 + inset],
    r = longX ? [x1 - inset, peak, (z0 + z1) / 2] : [(x0 + x1) / 2, peak, z1 - inset];
  if (longX) {
    Q(o, 'roof', [a, b, r, q], [0, 1, -1]);
    Q(o, 'roof', [e, q, r, c], [0, 1, 1]);
    T(o, 'roof', [a, q, e], [-1, 1, 0]);
    T(o, 'roof', [b, c, r], [1, 1, 0]);
  } else {
    T(o, 'roof', [a, b, q], [0, 1, -1]);
    T(o, 'roof', [e, r, c], [0, 1, 1]);
    Q(o, 'roof', [a, q, r, e], [-1, 1, 0]);
    Q(o, 'roof', [b, c, r, q], [1, 1, 0]);
  }
  if (d >= 2 && Math.hypot(...q.map((v, k) => v - r[k])) > 0.01) {
    beam(o, 'roof', q, r, 0.15, 0.17, C.roof);
    if (d === 3 && longX)
      for (let k = 1; k < 12; k++) {
        const t = k / 12,
          xl = x0 + (q[0] - x0) * t,
          xr = x1 + (r[0] - x1) * t,
          yy = y + (peak - y) * t + 0.025;
        for (const zz of [z0 + ((z0 + z1) / 2 - z0) * t, z1 + ((z0 + z1) / 2 - z1) * t])
          beam(o, 'roof', [xl, yy, zz], [xr, yy, zz], 0.065, 0.1, C.roof);
      }
  }
}
function balcony(o, x, z, y, d) {
  const n = [3, 6, 10, 16][d],
    r = 1.65,
    ring = [
      [x - r, z],
      [x + r, z],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const t = (i * Math.PI) / n;
        return [x + r * Math.cos(t), z + r * Math.sin(t)];
      }),
    ];
  cap(o, 'trim', ring, y);
  if (d === 0) return;
  for (let i = 2; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1];
    beam(o, 'metal', [a[0], y + 1, a[1]], [b[0], y + 1, b[1]], 0.06, 0.06, C.metal);
    beam(o, 'metal', [a[0], y, a[1]], [a[0], y + 1, a[1]], 0.055, 0.055, C.metal);
  }
  if (d === 3)
    for (let i = 2; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1];
      beam(
        o,
        'metal',
        [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
        [(a[0] + b[0]) / 2, y + 1, (a[1] + b[1]) / 2],
        0.04,
        0.04,
        C.metal,
      );
    }
}
function crown(o, d) {
  const r = p.upper;
  cap(o, 'terrace', r, 36.8);
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4]),
      holes = [];
    if (i === 2) {
      for (const x of [-2.5, 4.5, 11.5]) {
        const u = r[2][0] - x,
          h = arch(u, 29.9, 2.7, 6.1, [3, 5, 8, 12][d]);
        if (d >= 2) holes.push(h);
        else strip(o, 'glass', f, u, 30.1, 2.7, 5.8, 0.1);
      }
      for (const x of [-8.6, 17.6]) {
        const u = r[2][0] - x;
        if (d >= 2) holes.push(arch(u, 30.0, 1.7, 4.7, [3, 5, 8, 12][d]));
        else strip(o, 'glass', f, u, 30.1, 1.7, 4.4, 0.1);
      }
    } else {
      const cols = i === 0 ? 6 : 3;
      for (let k = 0; k < cols; k++)
        for (let j = 0; j < 2; j++) {
          const u = ((k + 0.5) * f.len) / cols,
            y = 30 + j * 3.3;
          if (d >= 2) holes.push(rect(u, y, 1.4, 2.45));
          else if (d >= 1) strip(o, 'glass', f, u, y, 1.4, 2.45, 0.1);
        }
    }
    face(o, 'wall', f, 29.5, 36.8, holes, 0.5);
  }
  edgeCornice(o, r, 36.6, 0.4, 0.28);
  hip(o, -12.6, 21.6, -10.9, 6.4, 36.8, 41, d);
  for (const [x0, x1] of [
    [-18.6, -12.4],
    [21.4, 27.6],
  ]) {
    B(o, 'wall', (x0 + x1) / 2, 29.5, -2.25, x1 - x0, 1.8, 15.2);
    hip(o, x0 - 0.15, x1 + 0.15, -10, 5.5, 31.3, 33.5, d);
  }
  for (const x of [-2.5, 4.5, 11.5]) {
    const f = F([x - 2, 6.43], [x + 2, 6.43]),
      y = 36.5,
      q = [
        [0, y],
        [4, y],
        [2, 39.4],
      ];
    T(
      o,
      'trim',
      q.map((v) => f.P(...v)),
      f.n,
    );
    T(
      o,
      'wall',
      q
        .slice()
        .reverse()
        .map((v) => f.P(...v, -0.38)),
      f.n.map((v) => -v),
    );
    for (let j = 0; j < 3; j++)
      Q(o, 'trim', [
        f.P(...q[j]),
        f.P(...q[(j + 1) % 3]),
        f.P(...q[(j + 1) % 3], -0.38),
        f.P(...q[j], -0.38),
      ]);
    for (const off of [-1.75, 1.75]) B(o, 'trim', x + off, 29.6, 6.25, 0.35, 7.05, 0.4);
    if (d >= 1) {
      for (const off of [-1.8, 1.8])
        beam(o, 'trim', [x + off, 36.6, 6.6], [x, 39.4, 6.6], 0.2, 0.18, C.trim);
      B(o, 'trim', x, 39.15, 6.43, 0.34, 0.5, 0.45);
    }
    if (d === 3) {
      for (const off of [-0.75, 0, 0.75])
        beam(o, 'metal', [x + off, 30.0, 5.56], [x + off, 35.0, 5.56], 0.065, 0.06, C.metal);
      for (const y0 of [32.0, 34.0])
        beam(o, 'metal', [x - 1.2, y0, 5.56], [x + 1.2, y0, 5.56], 0.065, 0.06, C.metal);
    }
    balcony(o, x, 6.46, 29.75, d);
  }
  B(o, 'wall', -10.5, 36.8, -8.8, 0.85, 6.2, 0.85);
  if (d >= 1) B(o, 'trim', -10.5, 42.7, -8.8, 1.05, 0.3, 1.05);
}
function build(o, _f, d = 3) {
  base(o, d);
  body(o, d);
  crown(o, d);
}
export const nutibaraSkyline = (o, f) => build(o, f, 0),
  nutibaraDistrict = (o, f) => build(o, f, 1),
  nutibaraStreet = (o, f) => build(o, f, 2),
  nutibaraCloseup = (o, f) => build(o, f, 3);
export const nutibaraModel = {
  id: 'hotel_nutibara',
  key: 'hotel_nutibara',
  cell: 'd3/d34',
  recipe: 'structure-hotel-nutibara.mjs',
  title: 'Hotel Nutibara, Medellín',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-70, 44, 95],
  lookAt: [2, 19, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.2, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-historic-hotel-and-stepped-commercial-base',
      position: [-68, 48, 95],
      lookAt: [2, 19, -1],
    },
    {
      name: 'three-gabled-tall-crown-windows-balconies-and-red-hipped-roof',
      position: [-24, 40, 47],
      lookAt: [3, 34, 2],
    },
    {
      name: 'sevenband-recessed-paired-windows-and-vertical-piers',
      position: [-21, 20, 33],
      lookAt: [1, 17, 8.8],
    },
    {
      name: 'whole-native-rear-and-low-terraces-express-excluded',
      position: [68, 40, -68],
      lookAt: [3, 14, -4],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield fixedbeforegeometry atfront[3,22]; actualurbanthreshold/hostgroundcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-nutibara.mjs',
    level: 'skyline',
    export: 'nutibaraSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'nutibaraDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'nutibaraStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'nutibaraCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Exactpublished1024x768SajoR2005Quallapublic-domainhero individuallyinspected/SHA1matched/nativeitemPD-selfreleasebound. Qualla-first5families/0conflicts; uninspectedTichnorpostcard/attribution-onlyphotosunused. Noagencyphotos/architecturediagrams/generatedbitmap/photo texture/downloadedmesh.',
    'Wholeoriginal10vertexlowbase/nativegeographicframe retained; mainroomblock/uppercrownpartitions/heights areoriginalreasonablephoto/primarytextestimates. Base6.4m(doubleheight/mezzanine),7bodybands to29.5m,upper36.8m/hip41m/chimney43m; primarynominaltenlevelsisnotfloor/roomcensus, preciseheightunknown. Notuniform43mextrusionofthebase.',
    'Recognizablepalegrayverticalpiers/pairedrecessedglazing/cornices/sevenbands, narrowercentralcrownwiththreeornamentalgabledtallwindows/semicircularbalconies/redtilehiproof/shortsidewings/chimney. Representativewindow/balcony/columncounts notprecisecurrentcensus; lowerfront/coveredentry/hiddenrear/wings/roofterraces/currentcosmetics bounded. Interiors/basements/signlettering/tenantlogos/retrofitgearomitted.',
    'SourceMetro/train/palms occludelowerfront. Coveredentryslab/twocolumns/retailportalrhythm areboundedoriginalexteriorestimates. Allnativebaseverticesandwholeback/sides retained; notfront-onlycrop. SeparateNutibaraExpress/Residenciasway1304046292 andMetro/plaza/roads/palms/neighbours/people/cars/whole-sitefloor excluded.',
    'Independent400m129x129/16641values/1rawTerrariumtile frozenbeforegeometry withoutfit/flatten/reacquire. CompositeurbanDEMnotstreet/thresholdsurvey; portable/shared/contextflatgroundseparate. Ordinarynativepreview/replaceFootprint=false, actualhostterrainattachmentunverified.',
  ],
};
