/** Fray Bentos process installation, reconstructed from cleared government photographs. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  vessel: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.65, metallic: 0.5 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.62, metallic: 0.65 },
  blue: { slot: 'wall', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
  duct: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
  yellow: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.15 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
    vessel: rgb('c4cbcc'),
    steel: rgb('8d9c9f'),
    blue: rgb('426f9f'),
    duct: rgb('d8dcd7'),
    yellow: rgb('d8b441'),
    foundation: rgb('aca99e'),
  },
  darkSilver = rgb('838f94');
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  if (normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = [...p].reverse();
  o.addConvexPolygon(k, 'palette:#ffffff', p, normalFor(...p), (q) => [q[0], q[1]], tint);
}
const point = (x, z, r, a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
function cylinder(o, k, x, z, r, y0, y1, n, tint = colors[k], topRadius = r) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      o,
      k,
      [
        point(x, z, r, a, y0),
        point(x, z, r, b, y0),
        point(x, z, topRadius, b, y1),
        point(x, z, topRadius, a, y1),
      ],
      [Math.cos((a + b) / 2), (r - topRadius) / (y1 - y0), Math.sin((a + b) / 2)],
      tint,
    );
  }
  for (const [y, rr, up] of [
    [y0, r, -1],
    [y1, topRadius, 1],
  ])
    face(
      o,
      k,
      Array.from({ length: n }, (_, i) => point(x, z, rr, (i * 2 * Math.PI) / n, y)),
      [0, up, 0],
      tint,
    );
}
const box = (o, k, x, y, z, w, h, d) => B(o, k, x, y, z, w, h, d, colors[k]);
const strut = (o, a, b, w = 0.1, k = 'steel') => beam(o, k, a, b, w, w, colors[k]);
function ring(o, x, z, r, y, n, w = 0.09) {
  for (let i = 0; i < n; i++)
    strut(
      o,
      point(x, z, r, (i * 2 * Math.PI) / n, y),
      point(x, z, r, ((i + 1) * 2 * Math.PI) / n, y),
      w,
    );
}
function vessel(o, v, lod, n) {
  const y = P.floor;
  cylinder(o, 'foundation', v.x, v.z, v.r + 0.7, P.foundationBottom, y, n);
  cylinder(o, 'vessel', v.x, v.z, v.r, y, y + v.height, n);
  cylinder(o, 'vessel', v.x, v.z, v.r + 0.018, y, y + v.height * 0.24, n, darkSilver);
  cylinder(
    o,
    'vessel',
    v.x,
    v.z,
    v.r,
    y + v.height,
    y + v.height + 0.7,
    n,
    colors.vessel,
    v.r * 0.96,
  );
  if (lod >= 1) {
    if (lod >= 2) ring(o, v.x, v.z, v.r + 0.2, y + v.height + 0.2, n, 0.1);
    ring(o, v.x, v.z, v.r + 0.2, y + v.height + 1.3, n, 0.07);
    const count = [0, 4, 10, 14][lod];
    for (let i = 0; i < count; i++)
      strut(
        o,
        point(v.x, v.z, v.r + 0.2, (i * 2 * Math.PI) / count, y + v.height + 0.2),
        point(v.x, v.z, v.r + 0.2, (i * 2 * Math.PI) / count, y + v.height + 1.3),
        0.06,
      );
  }
  if (lod >= 2)
    for (let h = 8; h < v.height; h += 8)
      cylinder(o, 'steel', v.x, v.z, v.r + 0.035, y + h, y + h + 0.07, n);
}
function rack(o, a, b, lod) {
  const y = P.floor + 11,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    nx = -dz / L,
    nz = dx / L,
    width = 3.4,
    bays = Math.ceil(L / 9),
    pt = (t, h, s) => [a[0] + dx * t + nx * s, h, a[1] + dz * t + nz * s];
  if (lod === 0) {
    beam(o, 'steel', pt(0, y, 0), pt(1, y, 0), width, 1.1, colors.steel);
    return;
  }
  if (lod === 1) {
    beam(o, 'steel', pt(0, y, 0), pt(1, y, 0), width, 0.35, colors.steel);
    for (const side of [-1, 1]) {
      strut(o, pt(0, y + 2.2, (side * width) / 2), pt(1, y + 2.2, (side * width) / 2), 0.18);
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        strut(o, pt(t, P.floor, (side * width) / 2), pt(t, y + 2.2, (side * width) / 2), 0.3);
        if (i < 3)
          strut(
            o,
            pt(t, y, (side * width) / 2),
            pt((i + 1) / 3, y + 2.2, (side * width) / 2),
            0.16,
          );
      }
    }
    strut(o, pt(0, y + 0.6, 0), pt(1, y + 0.6, 0), 0.7, 'duct');
    return;
  }
  for (const side of [-1, 1]) {
    strut(o, pt(0, y, (side * width) / 2), pt(1, y, (side * width) / 2), 0.22);
    strut(o, pt(0, y + 2.2, (side * width) / 2), pt(1, y + 2.2, (side * width) / 2), 0.15);
  }
  for (let i = 0; i <= bays; i++) {
    const t = i / bays;
    strut(o, pt(t, y, -width / 2), pt(t, y, width / 2), 0.18);
    for (const s of [-1, 1]) {
      strut(o, pt(t, y, (s * width) / 2), pt(t, y + 2.2, (s * width) / 2), 0.11);
      if (i % 2 === 0) {
        const p = pt(t, P.floor, (s * width) / 2);
        strut(o, p, pt(t, y, (s * width) / 2), 0.3);
        box(
          o,
          'foundation',
          p[0],
          P.foundationBottom,
          p[2],
          1.2,
          P.floor - P.foundationBottom,
          1.2,
        );
      }
      if (i < bays)
        strut(o, pt(t, y, (s * width) / 2), pt((i + 1) / bays, y + 2.2, (s * width) / 2), 0.1);
    }
  }
  for (let i = 0; i < (lod >= 2 ? 5 : 2); i++) {
    const s = (i - (lod >= 2 ? 2 : 0.5)) * 0.52;
    strut(o, pt(0, y + 0.55, s), pt(1, y + 0.55, s), lod >= 2 ? 0.22 : 0.4, 'duct');
  }
}
function stairs(o, lod) {
  const f = P.floor,
    x = 14.6,
    z = 0,
    levels = 8,
    dy = 6;
  for (const sx of [-2.1, 2.1])
    for (const sz of [-5, 5]) {
      strut(o, [x + sx, f, z + sz], [x + sx, f + 48, z + sz], lod === 0 ? 0.4 : 0.22);
      box(o, 'foundation', x + sx, P.foundationBottom, z + sz, 1.2, f - P.foundationBottom, 1.2);
    }
  if (lod === 0) return;
  for (let j = 0; j < levels; j++) {
    const y = f + j * dy,
      sg = j % 2 ? 1 : -1,
      za = z - sg * 4,
      zb = z + sg * 4;
    box(o, 'steel', x, y + dy, zb, 4.2, 0.18, 2);
    for (const side of [-1, 1]) {
      strut(o, [x + side * 1.5, y, za], [x + side * 1.5, y + dy, zb], 0.16);
      strut(o, [x + side * 1.5, y + 1.1, za], [x + side * 1.5, y + dy + 1.1, zb], 0.075);
      strut(
        o,
        [x + side * 1.5, y + dy + 0.18, zb - 0.8],
        [x + side * 1.5, y + dy + 1.2, zb - 0.8],
        0.065,
      );
    }
    if (lod >= 2) {
      const steps = lod === 2 ? 16 : 24;
      for (let i = 0; i < steps; i++)
        box(
          o,
          'steel',
          x,
          y + ((i + 1) * dy) / steps,
          za + ((zb - za) * (i + 0.5)) / steps,
          2.8,
          0.1,
          8 / steps + 0.03,
        );
    } else beam(o, 'steel', [x, y, za], [x, y + dy, zb], 2.8, 0.15, colors.steel);
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [8, 12, 20, 32][lod],
    f = P.floor;
  for (const v of P.vessels) vessel(o, v, lod, n);
  for (const v of P.columns) {
    cylinder(o, 'foundation', v.x, v.z, v.r + 1, P.foundationBottom, f, n);
    cylinder(o, 'vessel', v.x, v.z, v.r, f, f + v.height, n);
    cylinder(o, 'steel', v.x, v.z, v.r + 1.2, f + v.height - 0.6, f + v.height - 0.35, n);
    if (lod >= 1) {
      ring(o, v.x, v.z, v.r + 1.2, f + v.height + 0.65, n, 0.075);
      for (let h = 8; h < v.height; h += 8) {
        box(o, 'steel', v.x, f + h, v.z, v.r * 2 + 3, 0.22, v.r * 2 + 3);
        strut(o, [v.x + v.r + 1, f + h, v.z - 2], [v.x + v.r + 1, f + h + 1.1, v.z - 2], 0.08);
      }
    }
  }
  const t = P.blueTower;
  box(
    o,
    'foundation',
    t.x,
    P.foundationBottom,
    t.z,
    t.width + 1,
    f - P.foundationBottom,
    t.depth + 1,
  );
  box(o, 'blue', t.x, f, t.z, t.width, t.height, t.depth);
  stairs(o, lod);
  const w = P.yellowVessel;
  vessel(o, { ...w, r: w.r, height: w.height }, lod, n);
  cylinder(o, 'yellow', w.x, w.z, w.r + 0.025, f + 2, f + w.height, n);
  if (lod >= 1) {
    strut(o, [w.x, f + w.height, w.z], [w.x, f + w.height + 7, w.z], 0.65, 'yellow');
    strut(o, [w.x - 4, f + w.height + 6, w.z], [w.x + 7, f + w.height + 6, w.z], 0.7, 'yellow');
    strut(o, [w.x + 6, f + w.height + 6, w.z], [w.x + 6, f + w.height + 3, w.z], 0.06);
  }
  cylinder(o, 'duct', -4, -13, 1.65, f, f + 40, n);
  if (lod >= 1)
    for (let y = 3; y < 40; y += 3) cylinder(o, 'steel', -4, -13, 1.72, f + y, f + y + 0.12, n);
  for (const [a, b, r] of [
    [[-4, f + 30, -13], [6, f + 30, -13], 1.1],
    [[6, f + 30, -13], [6, f + 24, -20], 1.1],
    [[-8, f + 4, 12], [4, f + 4, 12], 0.75],
    [[4, f + 4, 12], [8, f + 4, 20], 0.75],
    [[17, f + 7, 16], [27, f + 7, 16], 0.9],
  ])
    strut(o, a, b, r * 2, 'duct');
  rack(o, [-38, -29], [38, -29], lod);
  rack(o, [35, -29], [35, 27], lod);
  if (lod >= 2) {
    for (const v of P.vessels) {
      const x = v.x + v.r * 0.65,
        z = v.z;
      for (let y = 3; y < v.height - 2; y += 5) strut(o, [x, f + y, z], [x, f + y, z + 1.5], 0.09);
      strut(o, [x, f + 1, z], [x, f + v.height, z], 0.2);
    }
  }
  componentEvidence.push({
    lod,
    largeVessels: 2,
    slenderColumns: 2,
    blueStairTower: true,
    yellowVessel: true,
    whiteSegmentedDuct: true,
    connectedPipeRackLegs: 2,
    foundationPads: true,
    layoutEstimated: true,
    exactSurveyClaimed: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [110, P.floor + 80, 115],
  look = [0, P.floor + 23, 0];
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
    'Photo-based reconstruction of the characteristic Fray Bentos process vessels, blue external stair tower, yellow vessel/crane and trussed pipe racks. Whole connected equipment train; dimensions and arrangement explicitly estimated within the known factory.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.foundationBottom - 0.16,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_corrugated',
    'metal_stainless_beadblasted',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    {
      name: 'silver-vessels-blue-stair-and-white-duct',
      position: [-60, P.floor + 38, 65],
      lookAt: [0, P.floor + 25, 0],
    },
    {
      name: 'pipe-racks-and-open-process-structure',
      position: [85, P.floor + 30, -85],
      lookAt: [0, P.floor + 22, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-process-train-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license. Previously cleared U.S. Embassy government photographs (public domain), attributed original OSM numeric factory boundary (ODbL), and open Mapzen terrain. No photographic textures; all missing dimensions and equipment positions are original reconstruction estimates.',
};
