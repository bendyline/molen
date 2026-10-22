/** Cape Charles: seven-series eight-leg open iron skeleton and nine-foot stair cylinder. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dq/dqd/cape_charles_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters,
  C = {
    white: rgb('dddcd3'),
    black: rgb('373d3b'),
    glass: rgb('52696b'),
    concrete: rgb('b3b0a2'),
    trim: rgb('a7aba4'),
  },
  surfaces = {
    white: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.13 },
    black: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.18 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.38, metallic: 0.06 },
    concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.2 },
  },
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function ring(o, s, x, z, y, r0, r1, h, n = 16, col = C[s]) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      P = (r, t, h) => [x + Math.cos(t) * r, h, z + Math.sin(t) * r];
    Q(
      o,
      s,
      [P(r0, a, y), P(r0, b, y), P(r1, b, y + h), P(r1, a, y + h)],
      [Math.cos(a), 0, Math.sin(a)],
      col,
    );
    T(o, s, [[x, y + h, z], P(r1, a, y + h), P(r1, b, y + h)], [0, 1, 0], col);
    T(o, s, [[x, y, z], P(r0, b, y), P(r0, a, y)], [0, -1, 0], col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
function ribbon(o, s, a, b, w, normal = [0, 0, 1]) {
  const axis = b.map((v, k) => v - a[k]),
    u0 = cross(axis, normal),
    u = u0.map((v) => v / Math.hypot(...u0));
  Q(
    o,
    s,
    [
      a.map((v, k) => v - (u[k] * w) / 2),
      a.map((v, k) => v + (u[k] * w) / 2),
      b.map((v, k) => v + (u[k] * w) / 2),
      b.map((v, k) => v - (u[k] * w) / 2),
    ],
    normal,
  );
}
export const capeCharlesFramePoint = (i, j) => {
  const a = (i * Math.PI) / 4,
    r = A.frameRadii[j];
  return [Math.cos(a) * r, A.frameLevels[j], Math.sin(a) * r];
};
function skeleton(o, d) {
  const F = capeCharlesFramePoint;
  for (let i = 0; i < 8; i++) {
    if (d === 0)
      ribbon(o, 'white', F(i, 0), F(i, 7), 0.26, [
        Math.cos((i * Math.PI) / 4),
        0,
        Math.sin((i * Math.PI) / 4),
      ]);
    if (d === 1) axial(o, 'white', F(i, 0), F(i, 7), (13 * 0.0254) / 2, 3, (7 * 0.0254) / 2);
    for (let j = 0; j < 7; j++) {
      const a = F(i, j),
        b = F(i, j + 1),
        c = F((i + 1) % 8, j),
        e = F((i + 1) % 8, j + 1),
        r = ((13 - j) * 0.0254) / 2,
        strut = ((8 - j * 0.5) * 0.0254) / 2,
        tie = ((3 - j / 3) * 0.0254) / 2,
        n = [Math.cos(((i + 0.5) * Math.PI) / 4), 0, Math.sin(((i + 0.5) * Math.PI) / 4)];
      if (d > 1)
        axial(o, 'white', a, b, r, [0, 3, 6, 8][d], Math.max((7 * 0.0254) / 2, r - 0.0254 / 2));
      if (d === 0) {
        ribbon(o, 'white', a, e, Math.max(0.055, tie * 2), n);
        ribbon(o, 'white', c, b, Math.max(0.055, tie * 2), n);
        ribbon(o, 'white', b, e, strut * 2, n);
      } else {
        axial(o, 'white', a, e, tie, d === 1 ? 3 : d === 2 ? 4 : 6);
        axial(o, 'white', c, b, tie, d === 1 ? 3 : d === 2 ? 4 : 6);
        axial(o, 'white', b, e, strut, d === 1 ? 3 : d === 2 ? 4 : 6);
      }
      if (d > 1) {
        const inner = [
          Math.cos((i * Math.PI) / 4) * A.shaftRadius,
          b[1],
          Math.sin((i * Math.PI) / 4) * A.shaftRadius,
        ];
        axial(o, 'white', inner, b, Math.max(0.065, strut * 0.9), d === 2 ? 4 : 6);
        const low = mix(a, b, 0.965),
          high = mix(a, b, 1.012);
        axial(o, 'trim', low, high, r * 1.55, d === 2 ? 6 : 8);
        if (d === 3)
          for (let k = 0; k < 4; k++) {
            const th = (i * Math.PI) / 4 + (k * Math.PI) / 2,
              cc = high.map(
                (v, q) =>
                  v + (q === 0 ? Math.cos(th) * r * 1.55 : q === 2 ? Math.sin(th) * r * 1.55 : 0),
              );
            ring(o, 'trim', cc[0], cc[2], cc[1] - 0.06, 0.035, 0.035, 0.07, 6);
          }
      }
    }
  }
}
function foundations(o, d) {
  ring(
    o,
    'concrete',
    0,
    0,
    0,
    A.centralFootRadius,
    A.centralFootRadius,
    0.65,
    d === 0 ? 4 : d === 1 ? 8 : 16,
  );
  for (let i = 0; i < 8; i++) {
    const q = capeCharlesFramePoint(i, 0);
    ring(o, 'concrete', q[0], q[2], 0, 0.74, 0.69, 0.65, d === 0 ? 4 : d === 1 ? 6 : 12);
    if (d > 1) {
      ring(o, 'black', q[0], q[2], 0.65, 0.35, 0.35, 0.1, 8);
      for (const x of [-0.23, 0.23])
        for (const z of [-0.23, 0.23])
          ring(o, 'trim', q[0] + x, q[2] + z, 0.75, 0.035, 0.035, 0.055, 6);
    }
  }
}
function cylinder(o, d) {
  ring(
    o,
    'white',
    0,
    0,
    A.shaftBase,
    A.shaftRadius,
    A.shaftRadius,
    A.shaftTop - A.shaftBase,
    [8, 12, 24, 40][d],
  );
  if (d > 0)
    for (let j = 1; j < 8; j += d === 1 ? 2 : 1) {
      const y = A.frameLevels[j] - 0.07;
      ring(
        o,
        'white',
        0,
        0,
        y,
        A.shaftRadius + 0.055,
        A.shaftRadius + 0.055,
        0.14,
        d === 1 ? 12 : 24,
      );
      if (d === 3)
        for (let k = 0; k < 16; k++) {
          const th = (k * Math.PI) / 8;
          ring(
            o,
            'trim',
            Math.cos(th) * (A.shaftRadius + 0.06),
            Math.sin(th) * (A.shaftRadius + 0.06),
            y + 0.02,
            0.025,
            0.025,
            0.035,
            5,
          );
        }
    }
}
function gallery(o, y, r, d) {
  const n = d === 0 ? 8 : d === 1 ? 8 : d === 2 ? 16 : 32;
  ring(o, 'black', 0, 0, y, r, r, 0.17, n);
  const count = d === 0 ? 8 : d === 1 ? 8 : 16;
  for (let k = 0; k < count; k++) {
    const a = (k * 2 * Math.PI) / count,
      b = ((k + 1) * 2 * Math.PI) / count,
      A = [Math.cos(a) * r, y + 0.18, Math.sin(a) * r],
      B = [Math.cos(b) * r, y + 0.18, Math.sin(b) * r];
    if (d === 0) {
      Q(
        o,
        'black',
        [A, B, [B[0], y + 1.13, B[2]], [A[0], y + 1.13, A[2]]],
        [Math.cos(a), 0, Math.sin(a)],
      );
      continue;
    }
    axial(o, 'black', A, [A[0], y + 1.16, A[2]], 0.035, d === 1 ? 3 : 4);
    for (const h of d === 1 ? [1.13] : [0.62, 1.13])
      axial(o, 'black', [A[0], y + h, A[2]], [B[0], y + h, B[2]], 0.027, d === 1 ? 3 : 4);
  }
}
function upper(o, d) {
  const n = d === 0 ? 8 : 16;
  ring(o, 'black', 0, 0, 45.1, 1.82, 1.82, 2.3, n);
  ring(o, 'black', 0, 0, 47.4, 2.28, 2.28, 4.5, n);
  gallery(o, 47.3, 3.02, d);
  gallery(o, 51.82, 2.8, d);
  ring(o, 'black', 0, 0, 51.9, 2.22, 2.22, 0.48, n);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8,
      R = 2.1,
      P = (t, y, r = R) => [Math.cos(t) * r, y, Math.sin(t) * r];
    Q(
      o,
      'glass',
      [P(a, 52.38), P(b, 52.38), P(b, 55.65), P(a, 55.65)],
      [Math.cos(a), 0, Math.sin(a)],
    );
    if (d === 0) {
      ribbon(o, 'white', P(a, 52.35, 2.13), P(a, 55.7, 2.13), 0.09, [Math.cos(a), 0, Math.sin(a)]);
    } else {
      axial(o, 'white', P(a, 52.3, 2.13), P(a, 55.7, 2.13), 0.045, d === 1 ? 3 : 4);
      if (d > 1) axial(o, 'white', P(a, 53.92, 2.125), P(b, 53.92, 2.125), 0.032, d === 2 ? 4 : 6);
    }
  }
  ring(o, 'white', 0, 0, 55.65, 2.27, 2.27, 0.12, n);
  ring(o, 'black', 0, 0, 55.77, 2.6, 0.18, 1.28, d === 0 ? 8 : 16);
  ring(o, 'black', 0, 0, 57.05, 0.18, 0.18, 0.18, d === 0 ? 4 : 8);
  ring(o, 'black', 0, 0, 57.23, 0.18, 0.32, 0.2, d === 0 ? 4 : 12);
  ring(o, 'black', 0, 0, 57.43, 0.32, 0.15, 0.22, d === 0 ? 4 : 12);
  ring(o, 'black', 0, 0, 57.65, 0.15, 0.1, 0.12, d === 0 ? 4 : 12);
  if (d === 0) ribbon(o, 'black', [0, 57.77, 0], [0, A.height, 0], 0.045);
  else axial(o, 'black', [0, 57.77, 0], [0, A.height, 0], 0.022, d === 1 ? 3 : 6);
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        b = ((i + 1) * Math.PI) / 4,
        r = 2.295,
        P = (t, y) => [Math.cos(t) * r, y, Math.sin(t) * r];
      Q(
        o,
        'glass',
        [P(a + 0.055, 48.45), P(b - 0.055, 48.45), P(b - 0.055, 49.8), P(a + 0.055, 49.8)],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
    ring(o, 'black', 0, 0, 51.6, 2.43, 2.43, 0.22, 16);
  }
}
function entry(o, d) {
  const z = A.shaftRadius;
  box(o, 'black', 0, 0.65, z + 0.012, 0.85, 2.03, 0.065);
  if (d === 0) {
    box(o, 'concrete', 0, 0, z + 0.6, 1.5, 0.65, 1.1);
    return;
  }
  for (const x of [-0.48, 0.48]) box(o, 'white', x, 0.65, z + 0.055, 0.09, 2.13, 0.12);
  box(o, 'white', 0, 2.72, z + 0.055, 1.05, 0.12, 0.14);
  box(o, 'black', 0, 0.55, z + 0.75, 1.45, 0.1, 1.3);
  for (let j = 0; j < 4; j++) box(o, 'concrete', 0, j * 0.14, z + 2.65 - j * 0.36, 1.4, 0.14, 0.4);
  for (const side of [-1, 1]) {
    for (const zz of [z + 0.3, z + 1.3])
      axial(o, 'white', [side * 0.7, 0.65, zz], [side * 0.7, 1.56, zz], 0.028, d === 1 ? 3 : 4);
    axial(
      o,
      'white',
      [side * 0.7, 1.56, z + 0.3],
      [side * 0.7, 1.56, z + 1.3],
      0.028,
      d === 1 ? 3 : 4,
    );
    axial(
      o,
      'white',
      [side * 0.7, 0.24, z + 2.8],
      [side * 0.7, 1.53, z + 1.3],
      0.028,
      d === 1 ? 3 : 4,
    );
  }
  if (d > 1) {
    box(o, 'trim', 0.28, 1.6, z + 0.065, 0.06, 0.17, 0.07);
    for (const x of [-0.65, 0.65])
      for (const zz of [z + 0.35, z + 1.25])
        axial(o, 'black', [x, 0.1, zz], [x, 0.55, zz], 0.045, 4);
  }
}
function build(o, _f, d = 3) {
  foundations(o, d);
  skeleton(o, d);
  cylinder(o, d);
  upper(o, d);
  entry(o, d);
}
export const capeCharlesLighthouseSkyline = (o, f) => build(o, f, 0),
  capeCharlesLighthouseDistrict = (o, f) => build(o, f, 1),
  capeCharlesLighthouseStreet = (o, f) => build(o, f, 2),
  capeCharlesLighthouseCloseup = (o, f) => build(o, f, 3);
export const capeCharlesLighthouseModel = {
  id: 'cape_charles_lighthouse',
  key: 'cape_charles_lighthouse',
  cell: 'dq/dqd',
  recipe: 'structure-cape-charles-lighthouse.mjs',
  title: 'Cape Charles Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [51, 36, 80],
  lookAt: [0, 27, 0],
  mediumFiContext: { scale: 1.5 },
  qaCameras: [
    {
      name: 'whole-eightleg-sevenseries-tower-and-ninefoot-central-cylinder',
      position: [51, 36, 80],
      lookAt: [0, 27, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'nine-footings-open-lower-crossbraces-entry-landing-and-steps',
      position: [21, 10, 27],
      lookAt: [0, 6, 0],
    },
    {
      name: 'tapering-castiron-columns-sockets-tension-rods-and-cylinder-bands',
      position: [14, 27, 21],
      lookAt: [0, 28, 0],
    },
    {
      name: 'black-watchrooms-open-galleries-sixteen-sided-lantern-and-finial',
      position: [11, 56, 17],
      lookAt: [0, 52.4, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m16641samplefield frozenbeforegeometry atfixedexternalapproach. Architecturalpiercaps/toeY0 not surveyedcurrentislandgrade; actualhostcontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cape-charles-lighthouse.mjs',
    level: 'skyline',
    export: 'capeCharlesLighthouseSkyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'capeCharlesLighthouseDistrict', errorMeters: 0.22, surfaces },
      street: { export: 'capeCharlesLighthouseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'capeCharlesLighthouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Complete8leg/7brace-seriescastironpyramid andcentral9fttube, ninephysicalfootingcaps, service/watchrooms/twoopennear galleries/16facetedglazedlantern/conicalroof/vent/finial/smallentry included. FarLODusesribbons/solidrailbands andmergedshaftbands whilepreservingopenframe/all7series. Nearrealroundbars/socketcollars/bolts/staircylinderflanges/windowframes/galleryrailopenings. Base18.2mdiameter/verticalseries/heights/finejoints andentryarephotographicestimates, not engineeringdrawing reconstruction.',
    'One exactpublishedSkipWillits1998Own/PD-self500x327original individuallyinspected/nativeSHA1bound; unchangedselectedphotopolicy passes. Lowresolutiondoesnotcertify everyjoint/currentpaintweathering/entryhardware. NARAengineeringimagepixelsunused becausepublishedbasisnotrecorded; no media/category/articlebody/policy repair. PrimaryVirginiaDHR/NPSNationalRegisterarchitecturaldescription textfacts only; no protectedPDFphotos/plans adopted. No photo textures/downloaded mesh/generatedbitmap.',
    '191ft58.2168moverallheight followsprimaryNPStext. Sevenseries columns13to7inches, struts8to5inches/ties3to1inch and9ftstairtube followNationalRegisterdescription; basewidth/radii androom/sublevelheightsestimated.10ftburiedpierthickness is not10fttallvisiblefooting. OriginalFresnel/removedoutsideelevatorcounterweight/operation/interiorstairs excluded; nativepointdisused meansnoactivebeacon glow.',
    'Independent256m129square2m16641samples/oneoriginalTerrariumtile frozenbeforegeometry; modeldatum1.6223m/providerrelative, sourcegrid/PNG/tileunchanged, no groundfitting/flattening/reacquisition/islandslab. Smallfoundationcaps atarchitecturalY0; groundcontact andislandmicrogradeunverified. Ordinarygeographicpreview/replacementdisabled.',
    'Adjacentstationoilhouse/workshop/keeperruins/WWIIobservationtowers/separateboardfence/wholeisland/vegetation/marsh/sea notpartofthissingle namedlighthouse asset. No arbitraryopaquecone or wholehistoricstation substituted.',
  ],
};
