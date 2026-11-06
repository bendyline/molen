/** Whole remaining Unit4 concrete reactor body; bounded plan estimates and damaged3F/4F. */
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
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  upper: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.18 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.35 },
};
const colors = {
    wall: rgb('cfd2cf'),
    upper: rgb('c0cbd0'),
    roof: rgb('b8bfb4'),
    foundation: rgb('b3bcb2'),
    steel: rgb('8d9c92'),
  },
  rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up, tint) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      (p) => (typeof y === 'function' ? y(p) : y),
      [0, up, 0],
      (p) => p,
      tint ?? colors[k],
    )
  )
    throw Error('Invalid warehouse cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
      tint,
    );
}
function prism(o, k, r, y0, y1, tint) {
  const sg = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ),
    top = (p) => (typeof y1 === 'function' ? y1(p) : y1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const box = (o, k, x, z, w, d, y0, y1, t) =>
    prism(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1, t),
  strut = (o, k, a, b, w = 0.07, t) => beam(o, k, a, b, w, w, t ?? colors[k]);

function perimeter(o, ring, y0, y1, lod, step = 4) {
  const sg = Math.sign(
    ring.reduce((s, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  let joints = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1] * sg, -u[0] * sg],
      pt = (t, y, off = 0.06) => [a[0] + u[0] * t + n[0] * off, y, a[1] + u[1] * t + n[1] * off];
    if (lod >= 1) {
      strut(o, 'steel', pt(0, y0), pt(0, y1), 0.13);
      strut(o, 'steel', pt(0, y1), pt(L, y1), 0.13);
    }
    if (lod >= 2) {
      const N = Math.ceil(L / (lod === 3 ? step : step * 2));
      for (let j = 1; j < N; j++) {
        strut(
          o,
          'steel',
          pt((L * j) / N, y0 + 0.05),
          pt((L * j) / N, y1 - 0.05),
          0.035,
          rgb('9baeb4'),
        );
        joints++;
      }
    }
  }
  return joints;
}
function closedPanel(o, ring, i, t, w, y0, y1, lod, color) {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    sg = Math.sign(
      ring.reduce((s, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ),
    n = [u[1] * sg, -u[0] * sg],
    pt = (x, y, d = 0.09) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[1] * d],
    lo = L * t - w / 2,
    hi = lo + w;
  face(o, 'steel', [pt(lo, y0), pt(hi, y0), pt(hi, y1), pt(lo, y1)], [n[0], 0, n[1]], color);
  if (lod >= 1)
    for (const [a, b] of [
      [pt(lo, y0, 0.13), pt(lo, y1, 0.13)],
      [pt(hi, y0, 0.13), pt(hi, y1, 0.13)],
      [pt(lo, y1, 0.13), pt(hi, y1, 0.13)],
    ])
      strut(o, 'steel', a, b, 0.12);
}

export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'foundation', P.lowerRing, P.foundationBottom, P.floor);
  prism(o, 'wall', P.lowerRing, P.floor, P.lowerRoof - 0.25);
  prism(o, 'roof', P.lowerRing, P.lowerRoof - 0.25, P.lowerRoof);
  prism(o, 'wall', P.upperThirdFloorRing, P.lowerRoof, P.fourthFloor - 0.25);
  prism(o, 'roof', P.upperRing, P.fourthFloor - 0.25, P.fourthFloor);
  prism(o, 'roof', P.operatingDeckRing, P.mainRoof - P.deckThickness, P.mainRoof);
  const columns = [
    [-18.675, -24.175],
    [0, -24.175],
    [18.675, -24.175],
    [18.675, 0],
    [18.675, 24.175],
    [0, 24.175],
    [-18.675, 24.175],
    [-18.675, 0],
  ];
  for (const [x, z] of columns)
    box(
      o,
      'wall',
      x,
      z,
      P.upperColumnWidth,
      P.upperColumnWidth,
      P.fourthFloor,
      P.mainRoof - P.deckThickness,
      rgb('bfc5bb'),
    );
  for (const r of P.residualWalls)
    prism(
      o,
      'wall',
      rect(r.x0, r.x1, r.z0, r.z1),
      P.fourthFloor,
      P.mainRoof - P.deckThickness,
      rgb('c5cac1'),
    );
  closedPanel(o, P.lowerRing, 1, 0.55, 3.2, P.floor + 0.03, P.floor + 4.2, lod, rgb('77847f'));
  closedPanel(o, P.lowerRing, 2, 0.62, 1.2, P.floor + 0.03, P.floor + 2.6, lod, rgb('77847f'));
  const joints =
    perimeter(o, P.lowerRing, P.floor, P.lowerRoof - 0.25, lod, 6) +
    perimeter(o, P.upperThirdFloorRing, P.lowerRoof, P.fourthFloor - 0.25, lod, 6);
  if (lod >= 2) {
    const y = 18.7 - 10.2 + P.floor;
    for (let i = 0; i < P.lowerRing.length; i++) {
      const a = P.lowerRing[i],
        b = P.lowerRing[(i + 1) % P.lowerRing.length];
      strut(o, 'wall', [a[0], y, a[1]], [b[0], y, b[1]], 0.035, rgb('afb7ac'));
    }
  }
  if (lod === 3)
    for (let z = -24.5 + 4; z < 24.2; z += 4)
      strut(
        o,
        'roof',
        [-18.9, P.mainRoof + 0.015, z],
        [18.9, P.mainRoof + 0.015, z],
        0.025,
        rgb('9ca898'),
      );
  componentEvidence.push({
    lod,
    wholeRemainingReactorBody: true,
    estimatedLowerControls: 4,
    estimatedUpperControls: 4,
    thirdFloorBodyControls: 8,
    eastLowerTerrace: true,
    closedIntactLowerWallsAndSlabs: true,
    thirdFloorWesternWallLossBay: true,
    exposedOperatingDeck: true,
    openFourthFloorFrame: true,
    remainingConcreteColumns: 8,
    residualUpperWallStrips: 4,
    foundation: true,
    closedEntries: 2,
    preaccidentRoofRestored: false,
    separateCoverIncluded: false,
    internalContainmentIncluded: false,
    undergroundEnlargementOmitted: true,
    notWholePlantProxy: true,
    facadeJoints: joints,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [95, 68, 120],
  look = [0, 13, 0];
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
    'Whole remainingUnit4concretereactorbody: estimated49NSx47EW lower/intact1-2Fwalls/eastterrace,49NSx38EW upper/exposed5FdeckOP39.92,western3Fwalllossbay/open4Fframe/eightestimatedcolumns/fourwallstrips. Abovegroundplan8m/damage10muncertainty fromunit-specificnumericandnativecontext; no exactoperatorplanclaim. Originalroof/basement/internalcontainment/separateacceptedcoveromitted. Allimageryunused;2021continuity/registrationestimated.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -1.23,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-east-intact-lower-body-and-terrace', position: camera, lookAt: look },
    {
      name: 'whole-west-third-floor-bay-and-open-fourth-floor',
      position: [-95, 65, -120],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-Unit4-remaining-reactor-' + reviewLod,
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
    'Originalproceduralgeometryunderrepositorylicense. Originaloperatorpostdamagewritten/numericfacts,explicitindexedprimarynumericcontextandoriginalOverture/OSMcontextODbLattributed. Allreportfigure/plan/photo/map/satellitepixelsunused. Abovegroundplan8m/damage10m/registration8m/finedetails2m/2021continuityestimated. Originalroof/basement/internalcontainment/separateacceptedcoveromitted.',
};
