/** Casa de Gobierno, 1870: complete palace, honest bounded hidden plan, immutable original relief. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  W = P.workingFrame,
  ref = 'palette:#ffffff';
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.93, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.3 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.38, metallic: 0.08 },
};
const C = {
  wall: rgb('d6c8ad'),
  trim: rgb('ece7d9'),
  roof: rgb('ad623d'),
  iron: rgb('50564e'),
  wood: rgb('494034'),
  glass: rgb('343e35'),
};
const point = ([x, z], y) => [x, y, z],
  lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  center = (r) => [0, 1].map((i) => r.reduce((s, p) => s + p[i], 0) / r.length),
  local = ([u, v]) => [
    W.origin[0] + W.towardRear[0] * u + W.alongFront[0] * v,
    W.origin[1] + W.towardRear[1] * u + W.alongFront[1] * v,
  ],
  working = (q) => {
    const x = q[0] - W.origin[0],
      z = q[1] - W.origin[1];
    return [x * W.towardRear[0] + z * W.towardRear[1], x * W.alongFront[0] + z * W.alongFront[1]];
  };
const outer = P.nativeOuter.map((q) => q.slice()),
  court = P.court.points.map((q) => q.slice());
if (
  outer.reduce(
    (s, p, i) =>
      s + p[0] * outer[(i + 1) % outer.length][1] - outer[(i + 1) % outer.length][0] * p[1],
    0,
  ) < 0
) {
  outer.reverse();
  court.reverse();
}
function outset(r, d) {
  const shifted = r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      u = [b[0] - a[0], b[1] - a[1]],
      L = Math.hypot(...u),
      n = [u[1] / L, -u[0] / L];
    return { p: [a[0] + n[0] * d, a[1] + n[1] * d], u, n };
  });
  return shifted.map((line, i) => {
    const prev = shifted[(i + r.length - 1) % r.length],
      cross = (a, b) => a[0] * b[1] - a[1] * b[0],
      den = cross(prev.u, line.u);
    if (Math.abs(den) < 1e-8) return line.p;
    const t = cross([line.p[0] - prev.p[0], line.p[1] - prev.p[1]], line.u) / den;
    return [prev.p[0] + prev.u[0] * t, prev.p[1] + prev.u[1] * t];
  });
}
const roomCourt = outset(court, P.court.galleryWidthEstimate),
  ridge = outer.map((p, i) => lerp(p, court[i], 0.5));
export const partEvidence = [],
  windowEvidence = [],
  columnEvidence = [],
  galleryEvidence = [],
  stairEvidence = [],
  roofEvidence = [];
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function cap(o, k, r, holes, y, n, col = C[k]) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      k,
      ref,
      r,
      holes,
      () => y,
      n,
      (p) => p,
      col,
    )
  )
    throw Error('Palace polygon triangulation failed');
  const m = builder.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function sides(o, k, r, y0, y1, inward = false) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [b[1] - a[1], 0, a[0] - b[0]].map((v) => v * (inward ? -1 : 1));
    face(o, k, [point(a, y0), point(b, y0), point(b, y1), point(a, y1)], n);
  }
}
function slab(o, r, holes, y, h = 0.2, k = 'trim') {
  cap(o, k, r, holes, y, [0, 1, 0]);
  cap(o, k, r, holes, y - h, [0, -1, 0]);
  sides(o, k, r, y - h, y);
  for (const hole of holes) sides(o, k, hole, y - h, y, true);
}
function strip(o, k, a, b, y, w, h, col = C[k]) {
  beam(o, k, point(a, y), point(b, y), w, h, col);
}
function roofPanel(o, a, b, c, d, y0, y1, lod, label) {
  const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])),
    waves = lod >= 2 ? Math.max(1, Math.ceil(L / (lod >= 3 ? P.roofTilePitchEstimate : 1.25))) : 1,
    ns = lod >= 2 ? waves * 2 : 1,
    nt = lod >= 3 ? 4 : lod >= 2 ? 2 : 1;
  const at = (s, t) => {
    const p = lerp(lerp(a, b, s), lerp(c, d, s), t),
      r =
        lod >= 2
          ? P.roofReliefEstimate * Math.sin(s * waves * Math.PI) ** 2 * Math.sin(t * Math.PI)
          : 0;
    return [p[0], y0 + (y1 - y0) * t + r, p[1]];
  };
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < nt; j++) {
      const ps = [
        at(i / ns, j / nt),
        at((i + 1) / ns, j / nt),
        at((i + 1) / ns, (j + 1) / nt),
        at(i / ns, (j + 1) / nt),
      ];
      for (const tri of [
        [ps[0], ps[1], ps[2]],
        [ps[0], ps[2], ps[3]],
      ]) {
        let n = normalFor(...tri);
        if (n[1] < 0) n = n.map((v) => -v);
        face(o, 'roof', tri, n);
      }
    }
  roofEvidence.push({ id: label, outerMid: lerp(a, b, 0.57), innerMid: lerp(c, d, 0.57), y0, y1 });
}
function panel(o, k, a, b, y, w, h, col = C[k], offset = 0.025) {
  const p = center([a, b]),
    t = [b[0] - a[0], b[1] - a[1]],
    L = Math.hypot(...t),
    u = t.map((v) => v / L),
    n = [u[1], 0, -u[0]],
    at = (x, Y) => [p[0] + u[0] * x + n[0] * offset, Y, p[1] + u[1] * x + n[2] * offset];
  face(o, k, [at(-w / 2, y), at(w / 2, y), at(w / 2, y + h), at(-w / 2, y + h)], n, col);
  return { p, u, n, at };
}
function window(o, a, b, y, h, lod, { front = false, index = 0 } = {}) {
  const w = P.mainWindowWidthEstimate,
    v = panel(o, 'glass', a, b, y, w, h);
  windowEvidence.push({ front, index, center: v.p, y, width: w, height: h });
  if (lod >= 2 || (front && lod >= 1)) {
    for (const sign of [-1, 1])
      beam(
        o,
        'trim',
        v.at(sign * (w / 2 + 0.1), y - 0.1),
        v.at(sign * (w / 2 + 0.1), y + h + 0.1),
        0.15,
        0.14,
        C.trim,
      );
    for (const Y of [y - 0.08, y + h + 0.08])
      beam(o, 'trim', v.at(-w / 2 - 0.16, Y), v.at(w / 2 + 0.16, Y), 0.16, 0.16, C.trim);
  }
  if (lod >= 2) {
    beam(o, 'wood', v.at(0, y), v.at(0, y + h), 0.055, 0.055, C.wood);
    beam(o, 'wood', v.at(-w / 2, y + h * 0.5), v.at(w / 2, y + h * 0.5), 0.055, 0.055, C.wood);
    if (front) {
      const z = 0.14;
      beam(
        o,
        'trim',
        v.at(-w / 2 - 0.24, y + h + 0.2),
        v.at(w / 2 + 0.24, y + h + 0.2),
        0.21,
        z,
        C.trim,
      );
      beam(
        o,
        'trim',
        v.at(-w / 2 - 0.1, y + h + 0.45),
        v.at(w / 2 + 0.1, y + h + 0.45),
        0.13,
        z,
        C.trim,
      );
    }
  }
  if (front && y > P.floorLevels[1]) {
    const half = w / 2 + 0.18,
      depth = P.balconyDepthEstimate,
      railY = P.floorLevels[1] + P.balconyRailHeightEstimate,
      q = (x, Y, d) => [v.p[0] + v.u[0] * x + v.n[0] * d, Y, v.p[1] + v.u[1] * x + v.n[2] * d];
    if (lod >= 1) {
      face(
        o,
        'trim',
        [
          q(-half, P.floorLevels[1], 0.03),
          q(half, P.floorLevels[1], 0.03),
          q(half, P.floorLevels[1], depth),
          q(-half, P.floorLevels[1], depth),
        ],
        [0, 1, 0],
      );
      for (const Y of [P.floorLevels[1] + 0.12, railY])
        beam(o, 'iron', q(-half, Y, depth), q(half, Y, depth), 0.045, 0.045, C.iron);
      for (const sign of [-1, 1])
        beam(
          o,
          'iron',
          q(sign * half, railY, 0.03),
          q(sign * half, railY, depth),
          0.045,
          0.045,
          C.iron,
        );
      if (lod >= 2)
        for (let j = 0; j <= 6; j++)
          beam(
            o,
            'iron',
            q(-half + (2 * half * j) / 6, P.floorLevels[1] + 0.12, depth),
            q(-half + (2 * half * j) / 6, railY, depth),
            0.03,
            0.03,
            C.iron,
          );
    }
  }
}
function rail(o, a, b, y, lod) {
  for (const dy of [0.1, 0.95]) strip(o, 'iron', a, b, y + dy, 0.055, 0.055);
  if (lod >= 2) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (lod >= 3 ? 0.65 : 1.4));
    for (let j = 0; j <= n; j++) {
      const p = lerp(a, b, j / n);
      beam(o, 'iron', point(p, y + 0.1), point(p, y + 0.95), 0.035, 0.035, C.iron);
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  partEvidence.length = 0;
  windowEvidence.length = 0;
  columnEvidence.length = 0;
  galleryEvidence.length = 0;
  stairEvidence.length = 0;
  roofEvidence.length = 0;
  cap(o, 'trim', outer, [], P.foundationBottomYEstimate, [0, -1, 0]);
  sides(o, 'trim', outer, P.foundationBottomYEstimate, P.baseFloorY);
  slab(o, outer, [], P.baseFloorY, 0.2);
  sides(o, 'wall', outer, P.baseFloorY, P.eaveY);
  sides(o, 'wall', roomCourt, P.baseFloorY, P.eaveY, true);
  slab(o, outer, [court], P.floorLevels[1]);
  slab(o, outer, [court], P.eaveY, 0.22);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    roofPanel(o, outer[i], outer[j], ridge[i], ridge[j], P.eaveY, P.ridgeY, lod, `outer-hip-${i}`);
    roofPanel(o, ridge[i], ridge[j], court[i], court[j], P.ridgeY, P.eaveY, lod, `court-hip-${i}`);
    if (lod >= 1) {
      strip(o, 'trim', outer[i], outer[j], P.eaveY - 0.12, 0.24, 0.23);
      strip(o, 'trim', outer[i], outer[j], P.floorLevels[1] - 0.05, 0.17, 0.16);
    }
    if (lod >= 2) strip(o, 'roof', ridge[i], ridge[j], P.ridgeY + 0.035, 0.15, 0.13);
  }
  partEvidence.push(
    {
      id: 'whole-six-control-two-storey-palace',
      nativeOuter: P.nativeOuter,
      floors: P.floorLevels,
      eave: P.eaveY,
    },
    { id: 'complete-hipped-clay-tile-roofs', ridge: P.ridgeY, hipPanels: 12 },
    {
      id: 'whole-estimated-inner-courtyard',
      outline: P.court.points,
      originalHiddenPlanEstimated: true,
    },
  );
  const fa = P.nativeOuter[1],
    fb = P.nativeOuter[0];
  for (let j = 0; j < P.mainFrontBays; j++) {
    const a = lerp(fa, fb, j / P.mainFrontBays),
      b = lerp(fa, fb, (j + 1) / P.mainFrontBays);
    for (let level = 0; level < 2; level++) {
      if (level === 0 && j === P.mainEntryBayFromNorth) continue;
      window(
        o,
        a,
        b,
        P.floorLevels[level] + 0.7,
        level === 0 ? P.mainGroundWindowHeightEstimate : P.mainUpperWindowHeightEstimate,
        lod,
        { front: true, index: j },
      );
    }
  }
  if (lod >= 1)
    for (let edge = 0; edge < outer.length; edge++) {
      const a = outer[edge],
        b = outer[(edge + 1) % outer.length];
      if (Math.abs(working(a)[0]) < 0.01 && Math.abs(working(b)[0]) < 0.01) continue;
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5.6));
      for (let j = 0; j < n; j++)
        for (let level = 0; level < 2; level++)
          window(
            o,
            lerp(a, b, j / n),
            lerp(a, b, (j + 1) / n),
            P.floorLevels[level] + 0.7,
            level === 0 ? 3.25 : 3.55,
            lod,
            { index: j },
          );
    }
  if (lod >= 2)
    for (const q of outer)
      for (let row = 0; row < 18; row += lod >= 3 ? 1 : 2) {
        const y = P.baseFloorY + 0.12 + (row * (P.eaveY - P.baseFloorY - 0.25)) / 18;
        for (const sign of [-1, 1]) {
          const direction = sign < 0 ? [-1, 0] : [0, -1],
            to = [q[0] + direction[0] * 0.42, q[1] + direction[1] * 0.42];
          strip(o, 'trim', q, to, y, 0.075, 0.24);
        }
      }
  // Plain courtyard galleries are explicit hidden-plan estimates, without later Ionic ornament.
  for (let edge = 0; edge < court.length; edge++) {
    const a = court[edge],
      b = court[(edge + 1) % court.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(L / P.courtyardColumnPitchEstimate));
    rail(o, a, b, P.floorLevels[1], lod);
    if (lod >= 1)
      for (let j = 0; j < n; j++) {
        const p = lerp(a, b, j / n);
        tube(o, 'trim', point(p, P.baseFloorY), point(p, P.eaveY), 0.16, C.trim, lod >= 2 ? 8 : 4);
        columnEvidence.push({ point: p, radius: 0.16 });
      }
    galleryEvidence.push({
      edge,
      floorY: P.floorLevels[1],
      midpoint: lerp(
        lerp(a, b, 0.54),
        lerp(roomCourt[edge], roomCourt[(edge + 1) % court.length], 0.54),
        0.5,
      ),
    });
    if (lod >= 1) {
      const ca = roomCourt[(edge + 1) % court.length],
        cb = roomCourt[edge];
      for (let j = 0; j < n; j++)
        for (let level = 0; level < 2; level++)
          window(
            o,
            lerp(ca, cb, j / n),
            lerp(ca, cb, (j + 1) / n),
            P.floorLevels[level] + 0.7,
            3.25,
            lod >= 3 ? 2 : 1,
            { index: j },
          );
    }
  }
  const ent = P.entrance,
    v = ent.workingCenter[1],
    a = local([0, v - ent.widthEstimate / 2]),
    b = local([0, v + ent.widthEstimate / 2]),
    door = panel(o, 'wood', a, b, P.baseFloorY, ent.widthEstimate, ent.heightEstimate);
  if (lod >= 1) {
    for (const sign of [-1, 1])
      beam(
        o,
        'trim',
        door.at(sign * (ent.widthEstimate / 2 + 0.16), P.baseFloorY),
        door.at(sign * (ent.widthEstimate / 2 + 0.16), P.baseFloorY + ent.heightEstimate + 0.1),
        0.27,
        0.24,
        C.trim,
      );
    for (const [Y, w] of [
      [P.baseFloorY + ent.heightEstimate + 0.1, ent.widthEstimate + 0.8],
      [P.baseFloorY + ent.heightEstimate + 0.42, ent.widthEstimate + 1.1],
    ])
      beam(o, 'trim', door.at(-w / 2, Y), door.at(w / 2, Y), 0.27, 0.24, C.trim);
    beam(
      o,
      'wood',
      door.at(0, P.baseFloorY),
      door.at(0, P.baseFloorY + ent.heightEstimate),
      0.07,
      0.06,
      C.wood,
    );
  }
  for (let j = 0; j < ent.steps; j++) {
    const u = -(ent.steps - j - 0.5) * ent.treadEstimate,
      stripA = local([u, v - ent.widthEstimate * 0.66]),
      stripB = local([u, v + ent.widthEstimate * 0.66]),
      y = (j + 1) * ent.riseEstimate;
    beam(
      o,
      'trim',
      point(stripA, y - 0.09),
      point(stripB, y - 0.09),
      ent.treadEstimate,
      0.18,
      C.trim,
    );
    stairEvidence.push({ index: j + 1, center: local([u, v]), y });
  }
  partEvidence.push(
    {
      id: 'eight-bay1870-east-front',
      bays: 8,
      upperIronBalconies: 8,
      creamBeforeLaterYellowPaint: true,
    },
    {
      id: 'original-rectangular-entry-and-three-steps',
      centerWorking: ent.workingCenter,
      width: ent.widthEstimate,
      height: ent.heightEstimate,
    },
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/d9/d9b/yellow_house_venezuela',
  front = local([0, W.frontLengthMeters * 0.5]),
  entrance = local(P.entrance.workingCenter),
  courtCenter = local(P.court.centerWorking),
  frontCamera = (u, v, y) => {
    const p = local([u, v]);
    return [p[0], y, p[1]];
  };
export const houseModel = {
  key: 'yellow_house_venezuela',
  id: 'yellow_house_venezuela',
  title: 'Casa Amarilla, Caracas (1870)',
  cell: 'd9/d9b',
  wikidataId: 'Q12981819',
  category: 'palace',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera: [105, 50, -90],
  lookAt: [0, 5, 0],
  portableGroundY: -4.1,
  mediumFiContext: {
    scale: 1,
    groundY: -4.1,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'clay_fired',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole1870-cream-east-front-and-hipped-roofs',
      position: [105, 42, -80],
      lookAt: [3, 5, 0],
    },
    { name: 'whole-rear-wings-and-courtyard-roofs', position: [-115, 55, 85], lookAt: [-5, 5, 0] },
    {
      name: 'eight-bays-iron-balconies-and-original-entry',
      position: frontCamera(-20, W.frontLengthMeters * 0.5, 7),
      lookAt: [front[0], 5, front[1]],
    },
    {
      name: 'whole-estimated-two-level-courtyard',
      position: [courtCenter[0] - 7, 7, courtCenter[1] + 5],
      lookAt: [courtCenter[0] + 15, 7, courtCenter[1] - 8],
    },
    {
      name: 'clay-hip-tiles-and-white-cornice',
      position: frontCamera(-9, 7, 20),
      lookAt: [entrance[0] - 8, 11, entrance[1]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-palace-${reviewLod}`,
    position: [105, 42, -80],
    lookAt: [3, 5, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    ...P.limitations,
    'Rooffluting is a simplified groupedbarreltile relief, not exactindividualtilephotogrammetry. Dormer/flag/coats of arms/plaza/figures/trees/neighbormunicipalpalace not copied from painting.',
    'Fullcurrentnativeouterenvelope supplies a bounded1870extent, whilehistoricalrear/courtyardtypology is explicitestimate. No currentstate or exactarchaeologicalhistoricalplanclaim.',
    'Isolatedportableground liesbelowintrinsicfoundations; it is diagnostic, not1870gradecertification.',
  ],
  sourceLicense:
    'Originalauthoredgeometry/repositorylicense. Exactalready-clearedpublishedQuallaRamónBoletPeraza1870watercolor, artist1836–1876, nativePD-Art-VenezuelaandPD-US-expired/localandnativebytesbound. Existingunchangedpublishedinventorypassed. Owningforeignministryprimarytextbindssame1870subject/1874remodel. OSMODbL actualwholehousecontext andWikidataCC0Q12981819. No questionable/supplementalprotectedimagery, copiedphotographtextures/generatedbitmaps orsourcepolicy/metadatarepair.',
};
