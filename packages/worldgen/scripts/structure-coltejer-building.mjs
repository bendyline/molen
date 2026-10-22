/** Whole Coltejer tower/platform: native ground envelope, finned glass and asymmetric crown. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d3/d34/coltejer_building/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('dddccc'),
    fin: rgb('c2bfae'),
    trim: rgb('d5d4c7'),
    roof: rgb('a2a698'),
    glass: rgb('414c49'),
    metal: rgb('666e68'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
    fin: { slot: 'wall', graph: 'concrete_panel', roughness: 0.96, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_boardformed', roughness: 0.97, metallic: 0 },
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
function facadeFin(o, f, x, y0, y1, width, depth) {
  const ring = [
    [x - width / 2, 0.06],
    [x + width / 2, 0.06],
    [x + width / 2, depth + 0.06],
    [x - width / 2, depth + 0.06],
  ].map(([u, z]) => {
    const q = f.P(u, 0, z);
    return [q[0], q[2]];
  });
  const sign = Math.sign(area(ring));
  cap(o, 'fin', ring, y0, false);
  cap(o, 'fin', ring, y1);
  for (let i = 0; i < 4; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 4];
    Q(
      o,
      'fin',
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
function base(o, d) {
  const r = p.outline,
    core = p.core;
  cap(o, 'roof', r, 12.6);
  cap(o, 'trim', r, 4.2, false);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]),
      holes = [];
    if (d >= 2) {
      const n = Math.max(1, Math.floor(f.len / 4.5));
      for (let j = 0; j < n; j++)
        for (const y of [4.7, 8.7])
          holes.push(rect(((j + 0.5) * f.len) / n, y, (f.len / n) * 0.75, 3.25));
    }
    face(o, 'wall', f, 4.2, 12.6, holes, 0.55);
    for (const y of [4.2, 8.4, 12.2]) strip(o, 'trim', f, f.len / 2, y, f.len, 0.24, 0.08);
    if (d < 2)
      for (const y of [4.8, 8.8]) strip(o, 'glass', f, f.len / 2, y, f.len * 0.92, 3.0, 0.12);
  }
  for (let i = 0; i < core.length; i++) {
    const f = F(core[i], core[(i + 1) % core.length]),
      holes = [];
    if (d >= 2) {
      const n = Math.max(1, Math.floor(f.len / 5.5));
      for (let j = 0; j < n; j++)
        holes.push(rect(((j + 0.5) * f.len) / n, 0.15, (f.len / n) * 0.72, 3.7));
    }
    face(o, 'wall', f, 0, 4.2, holes, 0.85);
  }
  for (const q of p.platform) {
    B(o, 'wall', q[0], 0, q[1], 0.62, 4.2, 0.62);
    if (d >= 2) B(o, 'trim', q[0], 0, q[1], 0.85, 0.3, 0.85);
  }
  const r0 = p.platform[1],
    r1 = p.platform[2],
    n = d === 0 ? 2 : 4;
  for (let i = 1; i < n; i++) {
    const t = i / n,
      x = r0[0] + (r1[0] - r0[0]) * t,
      z = r0[1] + (r1[1] - r0[1]) * t;
    B(o, 'wall', x, 0, z, 0.56, 4.2, 0.56);
  }
  if (d >= 2) {
    const a = p.platform[0],
      b = p.platform[1];
    for (let j = 0; j < 12; j++) {
      const t = (j + 0.5) / 12;
      B(
        o,
        'trim',
        a[0] + (b[0] - a[0]) * t,
        4.2 + j * 0.35,
        a[1] + (b[1] - a[1]) * t,
        1.2,
        0.2,
        0.6,
      );
    }
  }
}
function shaft(o, d) {
  const r = p.core;
  cap(o, 'roof', r, 151);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length]),
      broad = i === 0 || i === 2 || i === 3,
      holes = [];
    if (broad) {
      const cols = Math.max(1, Math.round(f.len / [8, 5, 3.3, 1.25][d])),
        rows = d === 3 ? 33 : 17;
      if (d >= 2) {
        for (let col = 0; col < cols; col++)
          for (let row = 0; row < rows; row++) {
            const h = (151 - 12.6) / rows,
              x = ((col + 0.5) * f.len) / cols,
              y = 12.6 + row * h + 0.25;
            holes.push(rect(x, y, (f.len / cols) * 0.67, h - 0.55));
          }
        face(o, 'wall', f, 12.6, 151, holes, 0.5);
      } else {
        face(o, 'wall', f, 12.6, 151);
        const rows = d === 0 ? 4 : 12;
        for (let j = 0; j < rows; j++) {
          const h = (151 - 12.6) / rows;
          strip(o, 'glass', f, f.len / 2, 12.6 + j * h + 0.45, f.len - 0.5, h - 0.8, 0.12);
        }
      }
      for (let j = 0; j <= cols; j++) {
        const x = (j * f.len) / cols;
        if (d === 0) strip(o, 'fin', f, x, 12.6, 0.4, 138.4, 0.12);
        else facadeFin(o, f, x, 12.6, 151, d === 1 ? 0.35 : 0.38, d === 1 ? 0.55 : 0.75);
      }
    } else {
      const rows = d === 3 ? 33 : d === 2 ? 17 : 8;
      for (let row = 0; row < rows; row++) {
        const h = (151 - 12.6) / rows,
          y = 12.6 + row * h + 0.45;
        if (d >= 2) holes.push(rect(f.len * 0.49, y, 0.9, h * 0.48));
        else strip(o, 'glass', f, f.len * 0.49, y, 0.95, h * 0.48, 0.12);
      }
      if (i === 1) {
        if (d >= 2) holes.push(rect(f.len * 0.67, 146.4, 4.5, 1.8));
        else strip(o, 'glass', f, f.len * 0.67, 146.4, 4.5, 1.8, 0.12);
      }
      face(o, 'wall', f, 12.6, 151, holes, 0.65);
      if (d >= 1)
        for (const x of [f.len * 0.49 - 0.72, f.len * 0.49 + 0.72])
          beam(o, 'trim', f.P(x, 12.6, 0.06), f.P(x, 151, 0.06), 0.12, 0.16, C.trim);
    }
  }
}
function curvedCrown(o, f, northAtEnd, d) {
  const n = [4, 8, 14, 24][d],
    top = (t) =>
      152 + 13 * Math.pow(northAtEnd ? 1 - t : t, 6) + 23 * Math.pow(northAtEnd ? t : 1 - t, 6),
    r = [
      [0, 151],
      [f.len, 151],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const t = 1 - i / n;
        return [f.len * t, top(t)];
      }),
    ],
    ix = earcut(r.flat());
  for (const z of [0, -0.6])
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'wall',
        ix.slice(i, i + 3).map((k) => f.P(...r[k], z)),
        f.n.map((v) => (z === 0 ? v : -v)),
      );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, 'trim', [f.P(...a), f.P(...b), f.P(...b, -0.6), f.P(...a, -0.6)]);
  }
}
function crown(o, d) {
  const r = p.core;
  for (const [i, y] of [
    [0, 165],
    [2, 175],
    [3, 175],
  ]) {
    const f = F(r[i], r[(i + 1) % r.length]);
    face(o, 'wall', f, 151, y);
    Q(
      o,
      'wall',
      [f.P(0, 151, -0.6), f.P(f.len, 151, -0.6), f.P(f.len, y, -0.6), f.P(0, y, -0.6)],
      f.n.map((v) => -v),
    );
    Q(o, 'trim', [f.P(0, y), f.P(f.len, y), f.P(f.len, y, -0.6), f.P(0, y, -0.6)], [0, 1, 0]);
    for (const x of [0, f.len])
      Q(o, 'wall', [f.P(x, 151), f.P(x, y), f.P(x, y, -0.6), f.P(x, 151, -0.6)]);
    if (d > 0) {
      const n = Math.max(1, Math.floor(f.len / (d === 1 ? 4 : 1.5)));
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) * f.len) / n;
        strip(o, 'roof', f, x, y - 5.8, 0.12, 4.2, 0.12);
      }
      if (d >= 2)
        for (let j = 1; j < n; j++) {
          const x = (j * f.len) / n;
          beam(o, 'fin', f.P(x, 151, 0.08), f.P(x, y, 0.08), 0.13, 0.23, C.fin);
        }
    }
    strip(o, 'trim', f, f.len / 2, y - 0.12, f.len, 0.12, 0.15);
  }
  curvedCrown(o, F(r[1], r[2]), true, d);
  curvedCrown(o, F(r[4], r[0]), false, d);
}
function build(o, _f, d = 3) {
  base(o, d);
  shaft(o, d);
  crown(o, d);
}
export const coltejerSkyline = (o, f) => build(o, f, 0),
  coltejerDistrict = (o, f) => build(o, f, 1),
  coltejerStreet = (o, f) => build(o, f, 2),
  coltejerCloseup = (o, f) => build(o, f, 3);
export const coltejerModel = {
  id: 'coltejer_building',
  key: 'coltejer_building',
  cell: 'd3/d34',
  recipe: 'structure-coltejer-building.mjs',
  title: 'Coltejer Building, Medellín',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-280, 125, 120],
  lookAt: [-3, 82, 3],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 3, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-tower-commercial-base-and-asymmetric-crown',
      position: [-260, 125, 125],
      lookAt: [-2, 84, 2],
      reviewLod: 'skyline',
    },
    {
      name: 'recessed-broad-windowfields-and-vertical-fins',
      position: [-75, 76, 71],
      lookAt: [-9, 69, 15],
    },
    {
      name: '175m-north-blade-curved-endwall-and-upper-window-eye',
      position: [-65, 167, 30],
      lookAt: [-15, 157, 3],
    },
    {
      name: 'whole-rear-envelope-threelevel-retail-return-and-passage',
      position: [85, 29, -70],
      lookAt: [5, 8, -8],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozen atfixedsouthstreetapproachbeforegeometry; actualgrade/passage/threshold/hostattachmentunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-coltejer-building.mjs',
    level: 'skyline',
    export: 'coltejerSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'coltejerDistrict', errorMeters: 1.25, surfaces },
      street: { export: 'coltejerStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'coltejerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Completeoriginal7vertexwholemappedbuildinggroundenvelope, tallshaft/fullback/sides/roof andlowconnectedcommercialreturn, asymmetric175mtallnorth/165msecondarycrown andcurvedendwalls/upperhorizontalwindoweye. Native38levelsnotblindlyadopted; municipal175m/36floors honorprincipalsilhouette. Internalshaft0/1/2/3/6 vsplatform3/4/5/6 allocation/12.6mbase/151mroofyard/165msecondaryblade areboundedphoto/textsectioninterpretation, not measurednativecomponentheights.',
    'Exact1200x1600publishedQuallaSajoR2007original individuallyinspected/SHA1matched/nativeownPD-selfreleasebound/existingpolicy passes. Qualla-first22families/0conflicts. Do notmistakesamecreatorCentroColtejer-Medellin.JPG/CC-BY-SA2.5forPD; otherCONOCERtransfer/attributionpictures unused. No sourcebitmap/generatedphototexture/downloadedmesh/municipalvideo/photo/architecturaldiagram adopted.',
    'Broadnorth/southfinnedfacades haveactualdetailedstonejambs/recessedglazing/floorbreaks; narrowendwalls predominantlywhitewithcentralverticalwindowstack/upperwidewindow. Detailedrepresentative33officebands/3lowlevels andcolumn/fin/portal countsdonotclaimspecificcurrentfloor/windowcensus. Distantflattenedwindowcues/coarserfins; whole175mcrown/lowreturn retained. Exactrefit/currentpaint/interiorrooms/tenantbrands/rooftopantennas/flags/basements omitted.',
    'ForegroundQuallaphotochurch/trees obscurelowerbase, so retailglazing/passage/roofs/backfineprofiles andexactshaft-platformboundary are boundedwholeexteriorestimates ratherthanfront-onlycrop. Groundcommercialreturnphysicallyopenbelow4.2mcolumn-supportedlevels, withboundedstairs/portalrhythm. No adjacentindependentParqueBerrio/church/CulturePalace/building/plaza/road/tree/people/traffic/sitefloor.',
    'Independent400m129x129field/16641originalvalues/rawsource tilebytes frozenbeforegeometry/unchanged withoutfit/flatten/reacquire. Compositeurbanheightsmayinterpolatestructures/vegetation; notsurveyedstreet/threshold/passagegrade. Portable/shared/contextflatgroundseparate. Ordinarynativepreview/replaceFootprint=false; actualhostattachmentunverified.',
  ],
};
