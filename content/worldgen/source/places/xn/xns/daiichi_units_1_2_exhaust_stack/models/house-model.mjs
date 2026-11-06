/** Full historical120m central flue and111m square lattice; geographic point approximate. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  steel: { slot: 'wall', graph: 'metal_painted', roughness: 0.76, metallic: 0.35 },
  rim: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.65, metallic: 0.6 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const red = rgb('c44f3f'),
  white = rgb('e7e8dc'),
  gray = rgb('a9b0a4'),
  dark = rgb('26362f'),
  color = (h) => (Math.floor(Math.min(h, 119.9) / 20) % 2 ? red : white);
export const componentEvidence = [];
function face(o, k, p, n, c) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], c);
}
function cap(o, k, r, y, up, c) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      c,
    )
  )
    throw Error('Invalid stack cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
      c,
    );
}
function cylinder(o, k, x, z, r, y0, y1, n, c) {
  const ring = Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / n),
    z + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [a[0] + b[0] - 2 * x, 0, a[1] + b[1] - 2 * z],
      c,
    );
  }
  cap(o, k, ring, y0, -1, c);
  cap(o, k, ring, y1, 1, c);
}
function rod(o, a, b, w, c, lod, k = 'steel') {
  if (lod < 2) {
    beam(o, k, a, b, w, w, c);
    return;
  }
  const d = b.map((v, i) => v - a[i]),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    v0 = cross(u, ref),
    vl = Math.hypot(...v0),
    v = v0.map((x) => x / vl),
    q = cross(u, v),
    n = lod === 3 ? 8 : 6,
    point = (base, t) =>
      base.map((p, i) => p + (w / 2) * (v[i] * Math.cos(t) + q[i] * Math.sin(t))),
    ar = Array.from({ length: n }, (_, i) => point(a, (i * 2 * Math.PI) / n)),
    br = Array.from({ length: n }, (_, i) => point(b, (i * 2 * Math.PI) / n));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      nn = ar[i].map((x, k) => x + ar[j][k] - 2 * a[k]);
    face(o, k, [ar[i], ar[j], br[j], br[i]], nn, c);
  }
  face(
    o,
    k,
    ar,
    u.map((v) => -v),
    c,
  );
  face(o, k, br, u, c);
}
const half = (h) =>
    (P.towerWidthBase + ((P.towerWidthTop - P.towerWidthBase) * h) / P.towerHeight) / 2,
  corner = (i, h) => {
    const s = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ][i],
      r = half(h);
    return [s[0] * r, P.floor + h, s[1] * r];
  };
function pipe(o, n) {
  const outer = P.flueOuterRadius,
    inner = P.flueInnerRadius,
    top = P.floor + P.flueHeight;
  for (let j = 0; j < 6; j++) {
    const y0 = P.floor + j * 20,
      y1 = P.floor + (j + 1) * 20;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        o,
        'steel',
        [
          [outer * Math.cos(a), y0, outer * Math.sin(a)],
          [outer * Math.cos(b), y0, outer * Math.sin(b)],
          [outer * Math.cos(b), y1, outer * Math.sin(b)],
          [outer * Math.cos(a), y1, outer * Math.sin(a)],
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        color(j * 20 + 10),
      );
    }
  }
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      oa = [outer * Math.cos(a), top, outer * Math.sin(a)],
      ob = [outer * Math.cos(b), top, outer * Math.sin(b)],
      ia = [inner * Math.cos(a), top, inner * Math.sin(a)],
      ib = [inner * Math.cos(b), top, inner * Math.sin(b)];
    face(o, 'rim', [oa, ob, ib, ia], [0, 1, 0], gray);
    face(
      o,
      'steel',
      [ia, ib, [ib[0], top - 2, ib[2]], [ia[0], top - 2, ia[2]]],
      [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
      dark,
    );
  }
  cap(
    o,
    'steel',
    Array.from({ length: n }, (_, i) => [
      inner * Math.cos((i * 2 * Math.PI) / n),
      inner * Math.sin((i * 2 * Math.PI) / n),
    ]),
    top - 2,
    1,
    dark,
  );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [6, 10, 16, 24][lod],
    bays = [3, 9, 18, 18][lod],
    steps = Array.from({ length: bays + 1 }, (_, i) => (i * P.towerHeight) / bays),
    legSteps = lod === 0 ? Array.from({ length: 7 }, (_, i) => (i * P.towerHeight) / 6) : steps;
  for (let i = 0; i < 4; i++) {
    const p = corner(i, 0);
    cylinder(
      o,
      'foundation',
      p[0],
      p[2],
      P.pierRadius,
      P.foundationBottom,
      P.foundationTop,
      n,
      gray,
    );
    for (let j = 0; j < legSteps.length - 1; j++) {
      const a = legSteps[j],
        b = legSteps[j + 1];
      rod(
        o,
        corner(i, a),
        corner(i, b),
        0.52 - (0.22 * (a + b)) / 2 / P.towerHeight,
        color((a + b) / 2),
        lod,
      );
    }
  }
  cylinder(o, 'foundation', 0, 0, P.centralPadRadius, P.foundationBottom, P.foundationTop, n, gray);
  pipe(o, [8, 12, 24, 32][lod]);
  let braces = 0;
  for (const h of steps)
    for (let i = 0; i < 4; i++) rod(o, corner(i, h), corner((i + 1) % 4, h), 0.22, color(h), lod);
  for (let j = 0; j < bays; j++)
    for (let i = 0; i < 4; i++) {
      const h0 = steps[j],
        h1 = steps[j + 1],
        k = (i + 1) % 4;
      rod(o, corner(i, h0), corner(k, h1), 0.18, color((h0 + h1) / 2), lod);
      braces++;
      if (lod >= 1) {
        rod(o, corner(k, h0), corner(i, h1), 0.18, color((h0 + h1) / 2), lod);
        braces++;
      }
    }
  if (lod >= 2) {
    for (const h of [37, 74, 108]) {
      const y = P.floor + h,
        r = half(h),
        out = r + 0.6;
      for (let i = 0; i < 4; i++) {
        const a = corner(i, h),
          b = corner((i + 1) % 4, h);
        rod(
          o,
          [(a[0] * out) / r, y + 1.1, (a[2] * out) / r],
          [(b[0] * out) / r, y + 1.1, (b[2] * out) / r],
          0.05,
          gray,
          lod,
          'rim',
        );
        rod(
          o,
          [a[0], y, a[2]],
          [(a[0] * out) / r, y + 1.1, (a[2] * out) / r],
          0.05,
          gray,
          lod,
          'rim',
        );
      }
      cylinder(o, 'steel', 0, 0, 2.1, y - 0.08, y + 0.02, n, gray);
    }
    const spacing = lod === 3 ? 0.65 : 1.4;
    for (let h = 1; h < 110; h += spacing) {
      const z = -half(h) - 0.18;
      rod(o, [-0.36, P.floor + h, z], [0.36, P.floor + h, z], 0.045, gray, lod, 'rim');
    }
    for (const x of [-0.36, 0.36])
      for (let j = 0; j < 18; j++) {
        const a = (j * 111) / 18,
          b = ((j + 1) * 111) / 18;
        rod(
          o,
          [x, P.floor + a, -half(a) - 0.18],
          [x, P.floor + b, -half(b) - 0.18],
          0.045,
          gray,
          lod,
          'rim',
        );
      }
  }
  componentEvidence.push({
    lod,
    whole120mFlue: true,
    whole111mTower: true,
    fourFullHeightLegs: true,
    actualBaseLegSpan: 22,
    actualTopLegSpan: 5.4,
    flueBoreDiameter: 3.2,
    hollowTopMouth: true,
    fourPierFootings: true,
    centralFooting: true,
    fullBracingBays: bays,
    diagonalMembers: braces,
    redWhiteBanding: true,
    notWholePlantProxy: true,
    registrationApproximateMeters: 25,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [160, 100, 185],
  look = [0, 57, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Wholeintacthistorical120m sharedflue/111msquarelatticetower,22mbase/5.4mtop/fourlegs/fullbracing/4.6mpiers/3.2mbore. Redwhite bandingfromclearedDOEoriginals, exactdetailsand25mgeographicregistration estimated. Notcurrent59mcutoff.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.93,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_stainless_beadblasted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole120m-flue-111m-lattice-and-four-feet', position: [130, 80, 145], lookAt: look },
    {
      name: 'lower-bracing-footings-and-estimated-ladder-detail',
      position: [35, 20, 40],
      lookAt: [0, 18, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-stack-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Originalproceduralgeometry underrepositorylicense. ExactalreadyclearedpublishedENERGY.GOV/PD-USGov-DOEoppositeaerials; primaryoperatorwrittenbulletdimensions only, reportpixels/figures unused. Photographicregistration explicitlyapproximate; no phototextures.',
};
