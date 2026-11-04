/** Complete original campus building outline; vertical and facade detail estimates explicit. */
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
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.78, metallic: 0.25 },
  steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.63, metallic: 0.6 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('dcd9cb'),
  roof: rgb('b8c0bb'),
  steel: rgb('8a9891'),
  foundation: rgb('a6a494'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], tint);
}
function cap(o, k, r, y, up, tint = colors[k]) {
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
      tint,
    )
  )
    throw Error('Invalid HEAT cap');
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
function prism(o, k, r, y0, y1, tint = colors[k]) {
  const sg = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      top = (p) => (typeof y1 === 'function' ? y1(p) : y1);
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
      tint,
    );
  }
  cap(o, k, r, y0, -1, tint);
  cap(o, k, r, y1, 1, tint);
}
const rect = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  box = (o, k, x, z, w, d, y0, y1, tint) =>
    prism(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1, tint),
  strut = (o, k, a, b, w = 0.05, tint = colors[k]) => beam(o, k, a, b, w, w, tint);

const split = (r, mid, keep) => {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ina = keep(a[1] - mid),
      inb = keep(b[1] - mid);
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (mid - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), mid]);
    }
  }
  return out;
};
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const r = P.nativeRing,
    sg = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ),
    z0 = Math.min(...r.map((p) => p[1])),
    z1 = Math.max(...r.map((p) => p[1])),
    mid = (z0 + z1) / 2,
    roof = (p) => P.eave + (P.ridge - P.eave) * (1 - Math.abs((p[1] - mid) / ((z1 - z0) / 2))),
    assembly = P.kind === 'campus-assembly';
  prism(o, 'foundation', r, P.foundationBottom, P.foundationTop);
  let walls = r;
  if (assembly) {
    walls = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      walls.push(a);
      if ((a[1] - mid) * (b[1] - mid) < 0) {
        const t = (mid - a[1]) / (b[1] - a[1]);
        walls.push([a[0] + t * (b[0] - a[0]), mid]);
      }
    }
  }
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i],
      b = walls[(i + 1) % walls.length];
    face(
      o,
      'wall',
      [
        [a[0], P.floor, a[1]],
        [b[0], P.floor, b[1]],
        [b[0], roof(b), b[1]],
        [a[0], roof(a), a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
    );
    if (lod >= 1)
      strut(o, 'steel', [a[0], roof(a) + 0.035, a[1]], [b[0], roof(b) + 0.035, b[1]], 0.075);
  }
  cap(o, 'wall', r, P.floor, -1);
  if (assembly) {
    for (const keep of [(v) => v <= 0, (v) => v >= 0]) cap(o, 'roof', split(r, mid, keep), roof, 1);
  } else cap(o, 'roof', r, roof, 1);
  let windows = 0,
    entries = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 4) continue;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1] * sg, -u[0] * sg],
      pt = (t, y, depth = 0.025) => [
        a[0] + u[0] * t + n[0] * depth,
        y,
        a[1] + u[1] * t + n[1] * depth,
      ],
      first = entries === 0 && L > 6;
    if (first) {
      const W = assembly ? 3 : 1.8,
        y1 = assembly ? 4.6 : 2.7,
        t = L / 2;
      face(
        o,
        'steel',
        [pt(t - W / 2, P.floor), pt(t + W / 2, P.floor), pt(t + W / 2, y1), pt(t - W / 2, y1)],
        [n[0], 0, n[1]],
        rgb('44514e'),
      );
      if (lod >= 2)
        for (const s of [-1, 1])
          strut(
            o,
            'steel',
            pt(t + (s * W) / 2, P.floor, 0.055),
            pt(t + (s * W) / 2, y1, 0.055),
            0.07,
          );
      entries++;
    }
    if (lod >= 1) {
      const count = Math.max(1, Math.floor(L / (assembly ? 7 : 3.3)));
      for (let j = 0; j < count; j++) {
        const t = ((j + 0.5) * L) / count;
        if (first && Math.abs(t - L / 2) < (assembly ? 2 : 1.6)) continue;
        const W = Math.min(assembly ? 1.6 : 1.65, (L / count) * 0.6),
          bottom = assembly ? 3.8 : 0.95,
          top = assembly ? 4.6 : 2.55;
        const quad = [
          pt(t - W / 2, bottom),
          pt(t + W / 2, bottom),
          pt(t + W / 2, top),
          pt(t - W / 2, top),
        ];
        face(o, 'steel', quad, [n[0], 0, n[1]], rgb('4c6268'));
        if (lod >= 2)
          for (let k = 0; k < 4; k++)
            strut(o, 'steel', quad[k], quad[(k + 1) % 4], 0.055, rgb('a6b2ad'));
        windows++;
      }
    }
  }
  componentEvidence.push({
    lod,
    wholeBody: true,
    nativeCorners: r.length,
    allWalls: true,
    fullRoof: true,
    foundation: true,
    closedEntries: entries,
    facadeWindows: windows,
    pitchedAssemblyRoof: assembly,
    mainAllCurvedAndProjectingSections: P.kind === 'campus-main',
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [52, 30, 58],
  look = [0, 2.8, 0];
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
    'Whole original independent campus building/all original outline corners, full exterior walls/roof/base and estimated closed entries/facade windows. Written role/address facts and numerical outline only; exact vertical sections, roof and finish estimated. All photographs/figures/plans and image-derived descriptions unused.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.63,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'metal_corrugated',
    'metal_stainless_beadblasted',
    'concrete_plain',
  ],
  qaCameras: [
    {
      name: 'whole-native-body-roof-and-front-entries',
      position: [43, 18, 48],
      lookAt: [0, 2.6, 0],
    },
    { name: 'whole-rear-body-roof-and-projections', position: [-43, 20, -48], lookAt: [0, 2.6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-building-' + reviewLod,
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
    'Original procedural geometry under repository license. Native OSM numerical outlines with ODbL attribution. Written operator campus role/address facts; every source image/plan/diagram unused.',
};
