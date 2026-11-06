/** Complete independent concrete chimney; numerical facts and explicit section estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.65, metallic: 0.7 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.91, metallic: 0.15 },
};
const colors = {
  wall: rgb('c8c8bd'),
  steel: rgb('9ea9a4'),
  foundation: rgb('a7a59a'),
  dark: rgb('303d38'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
const point = (x, z, r, a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
function annulus(o, k, x, z, outer, inner, y, n, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      o,
      k,
      [
        point(x, z, outer, a, y),
        point(x, z, outer, b, y),
        point(x, z, inner, b, y),
        point(x, z, inner, a, y),
      ],
      [0, up, 0],
    );
  }
}
function side(o, k, x, z, r0, r1, y0, y1, n, inward = false) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      sg = inward ? -1 : 1;
    face(
      o,
      k,
      [
        point(x, z, r0, a, y0),
        point(x, z, r0, b, y0),
        point(x, z, r1, b, y1),
        point(x, z, r1, a, y1),
      ],
      [sg * Math.cos((a + b) / 2), (sg * (r0 - r1)) / (y1 - y0), sg * Math.sin((a + b) / 2)],
    );
  }
}
function cap(o, k, x, z, r, y, n, up) {
  face(
    o,
    k,
    Array.from({ length: n }, (_, i) => point(x, z, r, (i * 2 * Math.PI) / n, y)),
    [0, up, 0],
  );
}
function cylinder(o, k, x, z, r, y0, y1, n) {
  side(o, k, x, z, r, r, y0, y1, n);
  cap(o, k, x, z, r, y0, n, -1);
  cap(o, k, x, z, r, y1, n, 1);
}
function rail(o, r, y, n, w) {
  for (let i = 0; i < n; i++)
    beam(
      o,
      'steel',
      point(0, 0, r, (i * 2 * Math.PI) / n, y),
      point(0, 0, r, ((i + 1) * 2 * Math.PI) / n, y),
      w,
      w,
      colors.steel,
    );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [12, 20, 32, 64][lod],
    fn = [6, 10, 20, 32][lod],
    base = P.floor,
    top = P.shellTop;
  cylinder(o, 'foundation', 0, 0, P.foundationRadius, P.foundationBottom, P.foundationTop, n);
  side(o, 'wall', 0, 0, P.radiusBase, P.radiusTop, base, top, n);
  cap(o, 'wall', 0, 0, P.radiusBase, base, n, -1);
  // Only the short visible inner rim is needed; concealed routing is not reconstructed.
  side(
    o,
    'wall',
    0,
    0,
    P.radiusTop - P.rimThickness,
    P.radiusTop - P.rimThickness,
    top - 1.5,
    top,
    n,
    true,
  );
  annulus(o, 'wall', 0, 0, P.radiusTop, P.radiusTop - P.rimThickness, top, n);
  cap(o, 'dark', 0, 0, P.radiusTop - P.rimThickness, top - 1.5, n, 1);
  for (const f of P.flues) {
    const [x, z] = f.center,
      r = f.diameterMeters / 2,
      t = Math.min(0.08, r * 0.25);
    side(o, 'steel', x, z, r, r, top - 0.4, f.top, fn);
    side(o, 'dark', x, z, r - t, r - t, f.top - 0.8, f.top, fn, true);
    annulus(o, 'steel', x, z, r, r - t, f.top, fn);
    cap(o, 'dark', x, z, r - t, f.top - 0.8, fn, 1);
  }
  // Estimated maintenance ring and closed ground-level service doorway.
  annulus(o, 'steel', 0, 0, P.radiusTop + 0.9, P.radiusTop - 0.1, top - 0.3, n);
  annulus(o, 'steel', 0, 0, P.radiusTop + 0.9, P.radiusTop - 0.1, top - 0.4, n, -1);
  if (lod >= 1) {
    const posts = [0, 8, 12, 20][lod];
    for (let i = 0; i < posts; i++) {
      const a = (i * 2 * Math.PI) / posts,
        p = point(0, 0, P.radiusTop + 0.78, a, top - 0.3);
      beam(o, 'steel', p, [p[0], top + 0.8, p[2]], 0.07, 0.07, colors.steel);
    }
    rail(o, P.radiusTop + 0.78, top + 0.8, n, 0.065);
    if (lod >= 2) rail(o, P.radiusTop + 0.78, top + 0.3, n, 0.04);
  }
  face(
    o,
    'dark',
    [
      [-0.65, base, P.radiusBase + 0.02],
      [0.65, base, P.radiusBase + 0.02],
      [0.65, base + 2.2, P.radiusBase + 0.02],
      [-0.65, base + 2.2, P.radiusBase + 0.02],
    ],
    [0, 0, 1],
  );
  if (lod >= 2) {
    for (const s of [-1, 1])
      beam(
        o,
        'steel',
        [s * 0.69, base, P.radiusBase + 0.04],
        [s * 0.69, base + 2.25, P.radiusBase + 0.04],
        0.08,
        0.08,
        colors.steel,
      );
    beam(
      o,
      'steel',
      [-0.69, base + 2.25, P.radiusBase + 0.04],
      [0.69, base + 2.25, P.radiusBase + 0.04],
      0.08,
      0.08,
      colors.steel,
    );
    // Fine construction-joint bands simplify away before the skyline LOD.
    for (let y = base + 10; y < top - 3; y += 10) {
      const r = P.radiusBase + ((P.radiusTop - P.radiusBase) * (y - base)) / P.civilHeight;
      annulus(o, 'wall', 0, 0, r + 0.02, r - 0.02, y, n);
    }
  }
  componentEvidence.push({
    lod,
    wholeCivilShell: true,
    civilHeightMeters: P.civilHeight,
    estimatedBaseRadiusMeters: P.radiusBase,
    estimatedTopRadiusMeters: P.radiusTop,
    foundation: true,
    closedServiceEntry: true,
    visibleRim: true,
    topMaintenanceRing: true,
    flueMouths: P.flues.map((f) => ({
      name: f.name,
      diameterMeters: f.diameterMeters,
      center: f.center,
      top: f.top,
    })),
    internalRoutingOmitted: true,
    notWholeMillProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [155, 100, 170],
  look = [0, 59, 0];
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
    'Whole independent main concrete chimney. Builder117m civil shell, five numerical flue diameters and120m exhaust reference retained; radius/taper/rim/flue centres/platform/entry/finish estimated. Complete exterior, no generic entiremill substitute; every image unused.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.83,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_stainless_beadblasted', 'metal_painted'],
  qaCameras: [
    {
      name: 'upper-civil-rim-five-flues-and-gallery',
      position: [32, 137, 38],
      lookAt: [0, 116.5, 0],
    },
    { name: 'lower-complete-shell-foundation-entry', position: [25, 8, 32], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-chimney-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Native OSM numeric point/works ODbL attribution retained; original builder construction and research numerical flue facts only. All photographs/figures/plans unused.',
};
