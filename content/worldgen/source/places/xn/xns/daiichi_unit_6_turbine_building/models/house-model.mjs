/** Whole original named Unit6 turbine building; primary dimensions, estimated exterior detail. */
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
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0.25 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.35 },
};
const colors = {
    wall: rgb('cfd2cf'),
    upper: rgb('c7cfce'),
    roof: rgb('9ca89f'),
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

export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'foundation', P.nativeRing, P.foundationBottom, P.floor);
  prism(o, 'wall', P.nativeRing, P.floor, P.lowerRoof);
  cap(o, 'roof', P.nativeRing, P.lowerRoof + 0.025, 1);
  prism(o, 'upper', P.mainRing, P.lowerRoof, P.mainRoof - 0.16);
  prism(o, 'roof', P.mainRing, P.mainRoof - 0.16, P.mainRoof);
  for (const [x, z] of P.ventCenters) {
    box(o, 'steel', x, z, 2.4, 2.4, P.mainRoof, P.mainRoof + 1.2);
    box(o, 'roof', x, z, 2.8, 2.8, P.mainRoof + 1.2, P.mainRoof + 1.35);
    if (lod >= 2)
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++)
          box(
            o,
            'steel',
            x + side * 1.215,
            z,
            0.03,
            2.1,
            P.mainRoof + 0.2 + j * 0.28,
            P.mainRoof + 0.28 + j * 0.28,
            rgb('51665e'),
          );
  }
  let entries = 0,
    panels = 0;
  for (const [ring, y0, y1] of [
    [P.nativeRing, P.floor, P.lowerRoof],
    [P.mainRing, P.lowerRoof, P.mainRoof - 0.16],
  ]) {
    const sg = Math.sign(
      ring.reduce((s, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
        n = [u[1] * sg, -u[0] * sg],
        pt = (t, y, d = 0.055) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[1] * t + n[1] * d];
      if (lod >= 1) {
        strut(o, 'steel', pt(0, y0), pt(0, y1), 0.13);
        strut(o, 'steel', pt(0, y1), pt(L, y1), 0.16);
      }
      if (lod >= 2 && L > 8) {
        const count = Math.ceil(L / (lod === 3 ? 3 : 7));
        for (let j = 1; j < count; j++) {
          const t = (L * j) / count;
          strut(o, 'steel', pt(t, y0 + 0.1), pt(t, y1 - 0.1), 0.04, rgb('b9c5ba'));
          panels++;
        }
        if (lod === 3)
          strut(o, 'steel', pt(0, (y0 + y1) / 2), pt(L, (y0 + y1) / 2), 0.035, rgb('c0cbbf'));
      }
      if (y0 === P.floor && L > 12) {
        const t = L * 0.52,
          w = L > 30 ? 3.5 : 1.7,
          h = L > 30 ? 4.3 : 2.8;
        face(
          o,
          'steel',
          [
            pt(t - w / 2, P.floor + 0.05, 0.14),
            pt(t + w / 2, P.floor + 0.05, 0.14),
            pt(t + w / 2, P.floor + h, 0.14),
            pt(t - w / 2, P.floor + h, 0.14),
          ],
          [n[0], 0, n[1]],
          rgb('566d64'),
        );
        if (lod >= 1) {
          strut(
            o,
            'steel',
            pt(t - w / 2, P.floor, 0.17),
            pt(t - w / 2, P.floor + h + 0.15, 0.17),
            0.13,
          );
          strut(
            o,
            'steel',
            pt(t + w / 2, P.floor, 0.17),
            pt(t + w / 2, P.floor + h + 0.15, 0.17),
            0.13,
          );
          strut(
            o,
            'steel',
            pt(t - w / 2, P.floor + h + 0.15, 0.17),
            pt(t + w / 2, P.floor + h + 0.15, 0.17),
            0.13,
          );
        }
        entries++;
      }
    }
  }
  if (lod === 3) {
    const x0 = Math.min(...P.mainRing.map((p) => p[0])) + 0.4,
      x1 = Math.max(...P.mainRing.map((p) => p[0])) - 0.4,
      z0 = Math.min(...P.mainRing.map((p) => p[1])),
      z1 = Math.max(...P.mainRing.map((p) => p[1]));
    for (let z = z0 + 3; z < z1 - 0.2; z += 3)
      strut(
        o,
        'roof',
        [x0, P.mainRoof + 0.025, z],
        [x1, P.mainRoof + 0.025, z],
        0.025,
        rgb('95a399'),
      );
  }
  componentEvidence.push({
    lod,
    nativeCorners: P.nativeRing.length,
    mainControls: P.mainRing.length,
    wholeBody: true,
    allWalls: true,
    fullClosedRoof: true,
    foundation: true,
    closedEntries: entries,
    mainHighHall: true,
    wholeLowerServiceVolumes: true,
    roofVentHousings: P.ventCenters.length,
    facadePanelJoints: panels,
    notWholePlantProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [145, 85, 170],
  look = [0, 11, 0];
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
    'Whole independent Unit6 turbine building: all11fullnativecorners, operator32.3mmaximumheightassigned3muncertainty, concretebody/steelupperhall/fullclosedroofs/lowerattachedservices/closedentries and2estimatedroofvents. Highhallpartition/finefinish/2019continuity explicit estimates; no appearance images used; reactor and otherunits separate.',
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
  embeddedCanonicalGraphs: ['metal_corrugated', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-east-mainhall-and-service-volumes', position: [145, 85, 170], lookAt: look },
    { name: 'whole-west-service-volumes-and-rear', position: [-145, 85, -170], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-turbine-building-' + reviewLod,
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
    'Original procedural geometry under repositorylicense. Original Overture/OpenStreetMap11corner outline ODbL-1.0 attributed; operator written/numerical building facts only, all source images unused. No photographic textures. Exact2019continuity, tiers and finefinish approximate.',
};
