/** Full historic smooth cylindrical tank, bound to cleared Qualla DOE aerials. */
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
  wall: { slot: 'wall', graph: 'metal_painted', roughness: 0.84, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  lid: { slot: 'door', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
};
const colors = {
  wall: rgb('e4e5db'),
  roof: rgb('a6aea7'),
  trim: rgb('d2d8cd'),
  foundation: rgb('a4a898'),
  lid: rgb('b7bfb5'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
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
      colors[k],
    )
  )
    throw Error('Invalid tank roof/base cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const disk = (radius, n) =>
  Array.from({ length: n }, (_, i) => [
    radius * Math.cos((i * 2 * Math.PI) / n),
    radius * Math.sin((i * 2 * Math.PI) / n),
  ]);
function contour(lod) {
  const steps = [1, 2, 4, 4][lod],
    r = P.nativeRing,
    result = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      angle = Math.atan2(a[1], a[0]),
      delta = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]),
      ra = Math.hypot(...a),
      rb = Math.hypot(...b);
    for (let j = 0; j < steps; j++) {
      if (j === 0) {
        result.push([...a]);
        continue;
      }
      const t = j / steps,
        q = angle + delta * t,
        radius = ra + (rb - ra) * t;
      result.push([radius * Math.cos(q), radius * Math.sin(q)]);
    }
  }
  return result;
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  const R = contour(lod);
  polygon(o, 'foundation', R, P.foundationBottom, P.floor);
  polygon(o, 'wall', R, P.floor, P.eave);
  polygon(o, 'roof', R, P.eave, P.roofTop);
  polygon(o, 'lid', disk(0.5, 8), P.roofTop, P.roofTop + 0.08);
  const zmax = Math.max(...R.map((p) => p[1]));
  beam(
    o,
    'trim',
    [0, P.floor + 0.05, zmax + 0.06],
    [0, P.eave - 0.1, zmax + 0.06],
    0.08,
    0.08,
    colors.trim,
  );
  beam(
    o,
    'trim',
    [0, P.eave - 0.1, zmax + 0.06],
    [0, P.eave - 0.1, zmax - 0.16],
    0.08,
    0.08,
    colors.trim,
  );
  if (lod > 0) {
    const courses = lod === 1 ? [3.5, 7.1] : [2.9, 6.1, 9.3];
    for (const y of courses)
      for (let i = 0; i < R.length; i++) {
        const a = R[i],
          b = R[(i + 1) % R.length];
        beam(o, 'wall', [a[0], y, a[1]], [b[0], y, b[1]], 0.012, 0.018, colors.wall);
      }
    if (lod > 1) {
      const count = lod === 2 ? 5 : 11,
        xmin = Math.min(...R.map((p) => p[0])),
        xmax = Math.max(...R.map((p) => p[0]));
      for (let i = 1; i <= count; i++) {
        const x = xmin + (i * (xmax - xmin)) / (count + 1),
          hits = [];
        for (let j = 0; j < R.length; j++) {
          const a = R[j],
            b = R[(j + 1) % R.length];
          if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
            hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
        }
        hits.sort((a, b) => a - b);
        if (hits.length >= 2)
          beam(
            o,
            'roof',
            [x, P.roofTop + 0.004, hits[0] + 0.03],
            [x, P.roofTop + 0.004, hits.at(-1) - 0.03],
            0.012,
            0.008,
            colors.roof,
          );
      }
    }
  }
  componentEvidence.push({
    lod,
    wholeIndependentTank: true,
    nativeControls: P.nativeRing.length,
    renderedContourVertices: R.length,
    allExteriorWalls: true,
    wholeClosedRoof: true,
    foundation: true,
    closedAccessLid: true,
    estimatedServicePipe: true,
    smoothWhiteExterior: true,
    notWholePlantProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/xn/xns/daiichi_northeast_cylindrical_tank',
  camera = [26, 20, 28],
  look = [0, 5, 0];
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
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -1.13,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-white-cylinder-low-roof-and-pipe', position: camera, lookAt: look },
    { name: 'opposite-smooth-tank-and-closed-roof', position: [-24, 19, -27], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-cylindrical-tank-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.15,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Cleared publishedDOEgovernmentwork aerials provide approximatecirca1971smoothwhitecylindrical exterior/lowgrayroof, with saved numerical compiled16corner plan/11mheight attributedODbL. No copied pixels/textures. Historiccontinuity/section/precisefunction/smallparts/finish/contact explicitly approximate.',
};
