/** Complete intact October 2010 palace; the regional frame and original field are immutable. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.68, metallic: 0.35 },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.3,
    metallic: 0.12,
    doubleSided: true,
  },
};
const C = {
  plaster: rgb('edece3'),
  iron: rgb('e7e9e0'),
  roof: rgb('858a87'),
  wood: rgb('302b22'),
  stone: rgb('b9b6a4'),
  glass: rgb('43534f'),
  dark: rgb('232a26'),
  brass: rgb('b2a16a'),
};
const ref = 'palette:#ffffff',
  point = ([x, z], y) => [x, y, z],
  lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  center = (r) => [0, 1].map((i) => r.reduce((s, p) => s + p[i], 0) / r.length);
function ring(r) {
  const q = r.map((p) => p.slice());
  if (
    q.reduce(
      (s, p, i) => s + p[0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * p[1],
      0,
    ) < 0
  )
    q.reverse();
  const n = q.reduce((m, p, i) => (p[0] + p[1] < q[m][0] + q[m][1] ? i : m), 0);
  return q.slice(n).concat(q.slice(0, n));
}
const outer = ring(P.outer),
  core = ring(P.core),
  upper = ring(P.roofTop),
  tower = ring(P.tower),
  light = ring(P.lantern),
  ac = P.atrium.center,
  atrium = ring([
    [ac[0] - P.atrium.widthEstimate / 2, ac[1] - P.atrium.depthEstimate / 2],
    [ac[0] + P.atrium.widthEstimate / 2, ac[1] - P.atrium.depthEstimate / 2],
    [ac[0] + P.atrium.widthEstimate / 2, ac[1] + P.atrium.depthEstimate / 2],
    [ac[0] - P.atrium.widthEstimate / 2, ac[1] + P.atrium.depthEstimate / 2],
  ]),
  atriumRoom = atrium.map((p) =>
    p.map((v, i) => v + Math.sign(v - ac[i]) * P.atrium.galleryWidthEstimate),
  );
export const partEvidence = [],
  columnEvidence = [],
  galleryEvidence = [],
  stairEvidence = [];
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function B(o, k, x, y, z, w, h, d, col = C[k]) {
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], col);
}
function cap(o, k, r, holes, y, n, col = C[k]) {
  // Runtime surface authoring consumes ordinary triangles.
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
    throw Error('Palace cap failed');
  const m = builder.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (index) =>
      Array.from(m.positions.slice(index * 3, index * 3 + 3)),
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
function poly(o, k, r, y0, y1, col = C[k]) {
  const q = ring(r);
  sides(o, k, q, y0, y1);
  cap(o, k, q, [], y0, [0, -1, 0], col);
  cap(o, k, q, [], y1, [0, 1, 0], col);
}
function sides(o, k, r, y0, y1, inward = false) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [b[1] - a[1], 0, a[0] - b[0]].map((v) => v * (inward ? -1 : 1));
    face(o, k, [point(a, y0), point(b, y0), point(b, y1), point(a, y1)], n);
  }
}
function slab(o, r, holes, y, h = 0.22, k = 'plaster') {
  cap(o, k, r, holes, y, [0, 1, 0]);
  cap(o, k, r, holes, y - h, [0, -1, 0]);
  sides(o, k, r, y - h, y);
  for (const hole of holes) sides(o, k, hole, y - h, y, true);
}
function loft(o, k, a, ya, b, yb) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    const ps = [point(a[i], ya), point(a[j], ya), point(b[j], yb), point(b[i], yb)],
      outward = [a[j][1] - a[i][1], 0, a[i][0] - a[j][0]];
    let n = normalFor(...ps);
    if (n.reduce((s, v, k) => s + v * outward[k], 0) < 0) n = n.map((v) => -v);
    face(o, k, ps, n);
  }
}
function scaled(r, k) {
  const c = center(r);
  return r.map((p) => p.map((v, i) => c[i] + (v - c[i]) * k));
}
function panel(o, k, a, b, y, h, width, col = C[k]) {
  const t = [b[0] - a[0], b[1] - a[1]],
    l = Math.hypot(...t),
    u = t.map((v) => v / l),
    n = [u[1], 0, -u[0]],
    p = center([a, b]);
  face(
    o,
    k,
    [
      [p[0] - (u[0] * width) / 2 + n[0] * 0.025, y, p[1] - (u[1] * width) / 2 + n[2] * 0.025],
      [p[0] + (u[0] * width) / 2 + n[0] * 0.025, y, p[1] + (u[1] * width) / 2 + n[2] * 0.025],
      [p[0] + (u[0] * width) / 2 + n[0] * 0.025, y + h, p[1] + (u[1] * width) / 2 + n[2] * 0.025],
      [p[0] - (u[0] * width) / 2 + n[0] * 0.025, y + h, p[1] - (u[1] * width) / 2 + n[2] * 0.025],
    ],
    n,
    col,
  );
  return { p, u, n };
}
function rail(o, a, b, y, lod, inside = false) {
  const n = inside
    ? 4
    : Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (lod >= 3 ? 0.62 : 1.55)));
  for (const dy of [0.12, P.verandaRailHeightEstimate])
    beam(o, 'iron', point(a, y + dy), point(b, y + dy), 0.085, 0.085, C.iron);
  if (lod >= 2)
    for (let j = 1; j < n; j++) {
      const p = lerp(a, b, j / n);
      beam(
        o,
        'iron',
        point(p, y + 0.12),
        point(p, y + P.verandaRailHeightEstimate),
        0.045,
        0.045,
        C.iron,
      );
    }
}
function arch(o, a, b, y, w, h, k = 'wood', lod = 3) {
  const p = center([a, b]),
    t = [b[0] - a[0], b[1] - a[1]],
    l = Math.hypot(...t),
    u = t.map((v) => v / l),
    n = [u[1], 0, -u[0]],
    radius = w / 2,
    shoulder = y + h - radius,
    xy = [
      [-radius, 0],
      [radius, 0],
      [radius, h - radius],
    ],
    N = lod >= 3 ? 12 : 6;
  for (let i = 1; i <= N; i++) {
    const angle = (i / N) * Math.PI;
    xy.push([Math.cos(angle) * radius, h - radius + Math.sin(angle) * radius]);
  }
  face(
    o,
    k,
    xy.map(([x, Y]) => [p[0] + u[0] * x + n[0] * 0.045, y + Y, p[1] + u[1] * x + n[2] * 0.045]),
    n,
  );
  if (lod >= 2) {
    for (const sign of [-1, 1])
      beam(
        o,
        'plaster',
        [
          p[0] + u[0] * (radius + 0.1) * sign + n[0] * 0.06,
          y,
          p[1] + u[1] * (radius + 0.1) * sign + n[2] * 0.06,
        ],
        [
          p[0] + u[0] * (radius + 0.1) * sign + n[0] * 0.06,
          shoulder,
          p[1] + u[1] * (radius + 0.1) * sign + n[2] * 0.06,
        ],
        0.2,
        0.18,
        C.plaster,
      );
    for (let i = 0; i < N; i++) {
      const v = (angle) => [
        p[0] + Math.cos(angle) * (radius + 0.1) * u[0] + n[0] * 0.06,
        shoulder + Math.sin(angle) * (radius + 0.1),
        p[1] + Math.cos(angle) * (radius + 0.1) * u[1] + n[2] * 0.06,
      ];
      beam(o, 'plaster', v((i / N) * Math.PI), v(((i + 1) / N) * Math.PI), 0.2, 0.18, C.plaster);
    }
  }
}
function clock(o, a, b, y, lod) {
  const { p, u, n } = panel(o, 'iron', a, b, y - 1.5, 3, 3, C.iron),
    N = lod === 0 ? 12 : 24,
    r = 1.13,
    ps = Array.from({ length: N }, (_, j) => {
      const angle = (j / N) * Math.PI * 2;
      return [
        p[0] + u[0] * Math.cos(angle) * r + n[0] * 0.045,
        y + Math.sin(angle) * r,
        p[1] + u[1] * Math.cos(angle) * r + n[2] * 0.045,
      ];
    });
  face(o, 'plaster', ps, n);
  for (const [dx, dy] of [
    [0, 0.8],
    [0.62, -0.25],
  ])
    beam(
      o,
      'wood',
      [p[0] + n[0] * 0.07, y, p[1] + n[2] * 0.07],
      [p[0] + u[0] * dx + n[0] * 0.07, y + dy, p[1] + u[1] * dx + n[2] * 0.07],
      0.065,
      0.04,
      C.dark,
    );
  if (lod >= 2)
    for (let j = 0; j < 12; j++) {
      const angle = (j / 12) * Math.PI * 2,
        at = (r) => [
          p[0] + u[0] * Math.sin(angle) * r + n[0] * 0.08,
          y + Math.cos(angle) * r,
          p[1] + u[1] * Math.sin(angle) * r + n[2] * 0.08,
        ];
      beam(o, 'wood', at(0.93), at(1.04), 0.04, 0.03, C.dark);
    }
}
export function buildPalace(o, _frame, lod = 3) {
  partEvidence.length = 0;
  columnEvidence.length = 0;
  galleryEvidence.length = 0;
  stairEvidence.length = 0;
  // Original current relief is never flattened. Intrinsic foundations extend below the fixed floor.
  poly(o, 'stone', outer, -3.4, P.baseFloorY - 0.18, C.stone);
  slab(o, outer, [], P.baseFloorY, 0.18, 'stone');
  sides(o, 'plaster', core, P.baseFloorY, P.mainEaveY);
  sides(o, 'plaster', atriumRoom, P.baseFloorY, P.mainRoofPlateauYEstimate, true);
  for (const y of P.floorLevels.slice(1)) slab(o, outer, [atrium], y);
  slab(o, outer, [atrium], P.mainEaveY, 0.22);
  // Main mansard envelope and original intrinsic raised rooflight share a continuous roof.
  loft(o, 'roof', outer, P.mainEaveY, upper, P.mainRoofPlateauYEstimate);
  cap(o, 'roof', upper, [atrium], P.mainRoofPlateauYEstimate, [0, 1, 0]);
  cap(o, 'plaster', upper, [atrium], P.mainRoofPlateauYEstimate - 0.12, [0, -1, 0]);
  sides(o, 'plaster', atrium, P.mainRoofPlateauYEstimate - 0.12, P.mainRoofPlateauYEstimate, true);
  loft(o, 'glass', atrium, P.mainRoofPlateauYEstimate, light, P.centralRoofLightEaveYEstimate);
  const apex = [...P.lanternCenter];
  for (let i = 0; i < 4; i++) {
    const a = point(light[i], P.centralRoofLightEaveYEstimate),
      b = point(light[(i + 1) % 4], P.centralRoofLightEaveYEstimate),
      top = point(apex, P.centralRoofLightRidgeYEstimate);
    let n = normalFor(a, b, top);
    if (n[1] < 0) n = n.map((v) => -v);
    face(o, 'roof', [a, b, top], n);
    face(
      o,
      'plaster',
      [a, b, top].map((p) => [p[0], p[1] - 0.12, p[2]]),
      n.map((v) => -v),
    );
    if (lod >= 1) beam(o, 'iron', a, top, 0.12, 0.12, C.iron);
  }
  partEvidence.push(
    {
      id: 'whole-palace',
      outer: P.outer,
      core: P.core,
      floors: P.floorLevels,
      storeyHeights: P.storeyHeights,
      atriumVoid: atrium,
      roofPlateau: P.mainRoofPlateauYEstimate,
    },
    {
      id: 'whole-mapped-raised-rooflight',
      outline: P.lantern,
      ridge: P.centralRoofLightRidgeYEstimate,
    },
  );
  for (let edge = 0; edge < 4; edge++) {
    const a = outer[edge],
      b = outer[(edge + 1) % 4],
      ca = core[edge],
      cb = core[(edge + 1) % 4],
      count = P.columnBayCountEstimate[edge],
      stride = lod === 0 ? 2 : 1;
    for (let j = 0; j < count; j += stride) {
      const q = lerp(a, b, j / count),
        sides = lod === 0 ? 4 : lod === 1 ? 6 : lod === 2 ? 8 : 10;
      tube(
        o,
        'iron',
        point(q, P.baseFloorY),
        point(q, P.mainEaveY),
        P.verandaColumnRadiusEstimate,
        C.iron,
        sides,
      );
      columnEvidence.push({ edge, index: j, point: q, radius: P.verandaColumnRadiusEstimate });
      if (lod >= 2)
        for (const y of P.floorLevels) {
          B(o, 'iron', q[0], y, q[1], 0.66, 0.18, 0.66);
          if (lod >= 3)
            B(
              o,
              'iron',
              q[0],
              y + P.storeyHeights[P.floorLevels.indexOf(y)] - 0.28,
              q[1],
              0.72,
              0.2,
              0.72,
            );
        }
      if (lod >= 3) {
        const next = lerp(a, b, Math.min(1, j / count + 0.04));
        beam(
          o,
          'iron',
          point(q, P.mainEaveY - 0.9),
          point(next, P.mainEaveY - 0.1),
          0.11,
          0.11,
          C.iron,
        );
      }
    }
    for (const y of P.floorLevels.slice(1)) {
      rail(o, a, b, y, lod);
      galleryEvidence.push({
        edge,
        floorY: y,
        midpoint: lerp(lerp(a, b, 0.54), lerp(ca, cb, 0.54), 0.5),
      });
    }
    if (lod >= 1)
      for (let j = 0; j < count; j++)
        for (let level = 0; level < 3; level++) {
          const aa = lerp(ca, cb, j / count),
            bb = lerp(ca, cb, (j + 1) / count),
            y = P.floorLevels[level] + 0.9,
            h = level === 0 ? 3 : 3.8,
            w = level === 0 ? 1.6 : 1.9;
          if (level > 0 && lod >= 2 && j % 3 === 1) arch(o, aa, bb, y, w, h, 'wood', lod);
          else {
            const v = panel(o, 'wood', aa, bb, y, h, w);
            if (lod >= 2) {
              for (const sign of [-1, 1])
                beam(
                  o,
                  'plaster',
                  [
                    v.p[0] + v.u[0] * (w / 2 + 0.1) * sign + v.n[0] * 0.06,
                    y - 0.1,
                    v.p[1] + v.u[1] * (w / 2 + 0.1) * sign + v.n[2] * 0.06,
                  ],
                  [
                    v.p[0] + v.u[0] * (w / 2 + 0.1) * sign + v.n[0] * 0.06,
                    y + h + 0.1,
                    v.p[1] + v.u[1] * (w / 2 + 0.1) * sign + v.n[2] * 0.06,
                  ],
                  0.14,
                  0.12,
                  C.plaster,
                );
              if (lod >= 3)
                beam(
                  o,
                  'wood',
                  [v.p[0] + v.n[0] * 0.07, y, v.p[1] + v.n[2] * 0.07],
                  [v.p[0] + v.n[0] * 0.07, y + h, v.p[1] + v.n[2] * 0.07],
                  0.075,
                  0.04,
                  C.dark,
                );
            }
          }
        }
  }
  partEvidence.push({
    id: 'all-four-three-storey-verandas',
    perimeterEdges: 4,
    bays: P.columnBayCountEstimate,
    openGalleryLevels: 2,
  });
  if (lod >= 1)
    for (let edge = 0; edge < 4; edge++) {
      const a = atrium[edge],
        b = atrium[(edge + 1) % 4];
      for (const y of P.floorLevels.slice(1)) rail(o, a, b, y, lod, true);
      for (let j = 0; j < 3; j++) {
        const q = lerp(a, b, j / 3);
        tube(
          o,
          'iron',
          point(q, P.baseFloorY),
          point(q, P.mainRoofPlateauYEstimate),
          0.18,
          C.iron,
          lod >= 2 ? 8 : 4,
        );
        const ca = lerp(atriumRoom[(edge + 1) % 4], atriumRoom[edge], j / 3),
          cb = lerp(atriumRoom[(edge + 1) % 4], atriumRoom[edge], (j + 1) / 3);
        for (const y of P.floorLevels) {
          if (lod >= 3 && j === 1) arch(o, ca, cb, y + 0.3, 2.1, 4.4, 'wood', lod);
          else panel(o, 'wood', ca, cb, y + 0.8, 3.5, 1.8);
        }
      }
    }
  // The original mapped clock tower is offset from the wider palace facade.
  poly(o, 'plaster', tower, P.baseFloorY, P.clockRoofEaveYEstimate, C.plaster);
  const small = scaled(tower, 0.69),
    tip = scaled(tower, 0.19);
  loft(
    o,
    'roof',
    scaled(tower, 1.12),
    P.clockRoofEaveYEstimate,
    small,
    P.clockRoofEaveYEstimate + 1.05,
  );
  loft(o, 'roof', small, P.clockRoofEaveYEstimate + 1.05, tip, P.clockRoofRidgeYEstimate);
  cap(o, 'roof', tip, [], P.clockRoofRidgeYEstimate, [0, 1, 0]);
  tube(
    o,
    'iron',
    point(P.towerCenter, P.clockRoofRidgeYEstimate),
    point(P.towerCenter, P.finialTopYEstimate),
    0.08,
    C.iron,
    lod === 0 ? 4 : 8,
  );
  for (let edge = 0; edge < 4; edge++) {
    const a = tower[edge],
      b = tower[(edge + 1) % 4];
    clock(o, a, b, P.clockStageYEstimate, lod);
    if (lod >= 1) arch(o, a, b, P.mainEaveY + 2, 2.25, 5.3, 'wood', lod);
    if (lod >= 2)
      for (const y of [
        P.floorLevels[1],
        P.floorLevels[2],
        P.mainEaveY,
        P.clockTowerShoulderYEstimate,
        P.clockRoofEaveYEstimate,
      ]) {
        const aa = scaled(tower, 1.07)[edge],
          bb = scaled(tower, 1.07)[(edge + 1) % 4];
        beam(o, 'plaster', point(aa, y), point(bb, y), 0.25, 0.25, C.plaster);
      }
  }
  const ta = tower[0],
    tb = tower[1];
  arch(o, ta, tb, P.baseFloorY, 3.45, 6.2, 'wood', lod);
  if (lod >= 2) {
    const p = center([ta, tb]),
      length = Math.hypot(tb[0] - ta[0], tb[1] - ta[1]),
      u = [(tb[0] - ta[0]) / length, (tb[1] - ta[1]) / length],
      n = [u[1], -u[0]],
      shoulder = P.baseFloorY + 6.2 - 3.45 / 2,
      at = (x, y) => [p[0] + u[0] * x + n[0] * 0.12, y, p[1] + u[1] * x + n[1] * 0.12],
      segments = lod >= 3 ? 12 : 6;
    for (const sign of [-1, 1])
      beam(o, 'wood', at(sign * 1.84, P.baseFloorY), at(sign * 1.84, shoulder), 0.22, 0.18, C.wood);
    beam(o, 'wood', at(-1.84, shoulder), at(1.84, shoulder), 0.22, 0.18, C.wood);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI,
        b = ((i + 1) / segments) * Math.PI;
      beam(
        o,
        'wood',
        at(Math.cos(a) * 1.84, shoulder + Math.sin(a) * 1.84),
        at(Math.cos(b) * 1.84, shoulder + Math.sin(b) * 1.84),
        0.22,
        0.18,
        C.wood,
      );
    }
  }
  if (lod >= 2) {
    const v = panel(o, 'wood', ta, tb, P.baseFloorY, 4.4, 0.06, C.dark);
    for (const sign of [-1, 1])
      for (let row = 0; row < 7; row++) {
        const q = [
          v.p[0] + v.u[0] * 1.22 * sign + v.n[0] * 0.1,
          P.baseFloorY + 0.4 + row * 0.48,
          v.p[1] + v.u[1] * 1.22 * sign + v.n[2] * 0.1,
        ];
        tube(
          o,
          'iron',
          q,
          q.map((a, i) => a + v.n[i] * 0.12),
          0.05,
          C.brass,
          6,
        );
      }
  }
  for (let j = 0; j < P.approach.steps; j++) {
    const y = (j + 1) * P.approach.riseEstimate,
      z = P.approach.frontZ - (P.approach.steps - j - 0.5) * P.approach.treadEstimate;
    B(
      o,
      'stone',
      P.approach.centerX,
      -0.2,
      z,
      P.approach.widthEstimate,
      y + 0.2,
      P.approach.treadEstimate,
    );
    stairEvidence.push({ index: j + 1, y, z, x: P.approach.centerX });
  }
  partEvidence.push(
    {
      id: 'complete-offset-clocktower',
      outline: P.tower,
      eave: P.clockRoofEaveYEstimate,
      ridge: P.clockRoofRidgeYEstimate,
      finial: P.finialTopYEstimate,
    },
    {
      id: 'original-arched-entry-and-approach',
      steps: 4,
      entryWidthEstimate: 3.45,
      entryHeightEstimate: 6.2,
    },
  );
}
export const palaceSkyline = (o, f) => buildPalace(o, f, 0),
  palaceDistrict = (o, f) => buildPalace(o, f, 1),
  palaceStreet = (o, f) => buildPalace(o, f, 2),
  palaceCloseup = (o, f) => buildPalace(o, f, 3);
const root = 'content/worldgen/source/places/ky/kyg/house_of_wonders';
export const palaceModel = {
  key: 'house_of_wonders',
  id: 'house_of_wonders',
  title: 'House of Wonders, Zanzibar (2010)',
  cell: 'ky/kyg',
  wikidataId: 'Q2568900',
  category: 'palace',
  recipe: 'palace-model.mjs',
  surfaces,
  build: buildPalace,
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
  camera: [80, 62, -100],
  lookAt: [-1, 17, -2],
  portableGroundY: -4,
  mediumFiContext: {
    scale: 1.1,
    groundY: -4,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'metal_painted',
    'metal_standing_seam',
    'wood_plain',
    'stone_limestone_raw',
  ],
  qaCameras: [
    {
      name: 'whole-seaward-verandas-and-clocktower',
      position: [-63, 40, -90],
      lookAt: [-3, 17, -2],
    },
    { name: 'whole-rear-and-raised-rooflight', position: [65, 48, 78], lookAt: [-1, 18, 0] },
    {
      name: 'original-arched-timber-entry',
      position: [P.towerCenter[0] - 6, 5, -38],
      lookAt: [P.towerCenter[0], 4, -25],
    },
    {
      name: 'open-upper-veranda-and-column-brackets',
      position: [20, 15, -35],
      lookAt: [-4, 15, -22],
    },
    {
      name: 'intrinsic-covered-atrium-and-galleries',
      position: [ac[0] + 2, 11, ac[1] + 2],
      lookAt: [ac[0] - 4, 19, ac[1] - 4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-palace-${reviewLod}`,
    position: [-63, 40, -90],
    lookAt: [-3, 17, -2],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/palace-model.mjs`,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'palaceDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'palaceStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'palaceCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    ...P.limitations,
    'Clock dial hand positions are illustrative, not a recovered historical time. Individual carved fanlight figures, inscriptions and exact door filigree are simplified architectural ornament; no source photographs or artwork textures copied.',
    'Portable isolated stage lies below the palace foundations; terrain-contact certification is not implied. Original current urban elevation can conceal portions of the 2010 ground storey.',
  ],
  sourceLicense:
    'Original authored geometry under repository license. Qualla-first24-family search, then three exact named creator Own/PD-self originals: Matthias Krämer2004front, Nannarella2008entry, Moongateclimber2010intrinsicatrium. NativewholeQ2568900building/threeparts ODbL; primary conservation scalar facts only. No questionable archives or attribution-only imagery adopted, no photographic textures.',
};
