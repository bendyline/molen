/** Entire Fort Prinzenstein in its documented 1847 form, not a current ruin replacement. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building;
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
  deck: { slot: 'roof', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.4, metallic: 0.1 },
};
const colors = {
  plaster: rgb('ddd5bf'),
  stone: rgb('beb7a4'),
  deck: rgb('c5bba2'),
  trim: rgb('e3dfd2'),
  wood: rgb('74634a'),
  glass: rgb('49616b'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up, holes = []) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      k,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid full dam/plant cap');
  const m = temp.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3)).map((j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, p, [0, up, 0]);
  }
}

function outward(r, a, b, inward = false) {
  const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
    sign = Math.sign(area) * (inward ? -1 : 1);
  return [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign];
}
function polygon(o, k, r, y0, y1) {
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
      outward(r, a, b),
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const mix = (a, b, t) => a.map((v, k) => v * (1 - t) + b[k] * t);
function outlineWalls(o, k, r, y0, y1, skip = new Set()) {
  for (let i = 0; i < r.length; i++) {
    if (skip.has(i)) continue;
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
      outward(r, a, b),
    );
  }
}
function insetRing(r, d) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  return r.map((p, i) => {
    const a = r[(i + r.length - 1) % r.length],
      b = r[(i + 1) % r.length],
      u = p.map((v, k) => v - a[k]),
      v = b.map((v, k) => v - p[k]),
      U = u.map((x) => x / Math.hypot(...u)),
      V = v.map((x) => x / Math.hypot(...v)),
      n1 = [-U[1] * sign, U[0] * sign],
      n2 = [-V[1] * sign, V[0] * sign],
      den = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    if (Math.abs(den) < 0.01) throw Error('Invalid historical parapet miter');
    return p.map((q, k) => q + (d * (n1[k] + n2[k])) / den);
  });
}
function holePath(h, n) {
  const pts = [[h.u - h.w, h.base]];
  if (h.arc) {
    for (let i = 0; i <= n; i++) {
      const t = (i * Math.PI) / n;
      pts.push([h.u - h.w * Math.cos(t), h.spring + h.w * Math.sin(t)]);
    }
  } else pts.push([h.u - h.w, h.spring], [h.u + h.w, h.spring]);
  pts.push([h.u + h.w, h.base]);
  return pts;
}
function panel(o, k, a, b, y0, y1, holes, n, normal) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    p = (u, y) => {
      const q = mix(a, b, u / L);
      return [q[0], y, q[1]];
    },
    rect = (u0, u1, bottom, top) => {
      if (u1 - u0 > 1e-6 && top - bottom > 1e-6)
        face(o, k, [p(u0, bottom), p(u1, bottom), p(u1, top), p(u0, top)], normal);
    };
  let cursor = 0;
  for (const h of [...holes].sort((a, b) => a.u - b.u)) {
    const left = h.u - h.w,
      right = h.u + h.w;
    rect(cursor, left, y0, y1);
    rect(left, right, y0, h.base);
    const top = holePath(h, n).slice(1, -1);
    for (let i = 1; i < top.length; i++)
      face(
        o,
        k,
        [
          p(top[i - 1][0], top[i - 1][1]),
          p(top[i][0], top[i][1]),
          p(top[i][0], y1),
          p(top[i - 1][0], y1),
        ],
        normal,
      );
    cursor = right;
  }
  rect(cursor, L, y0, y1);
}
function band(o, k, r, inner, y0, y1, edgeHoles, lod) {
  const n = [4, 7, 12, 18][lod];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = inner[i],
      B = inner[(i + 1) % inner.length],
      normal = outward(r, a, b),
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      Li = Math.hypot(B[0] - A[0], B[1] - A[1]),
      holes = edgeHoles(i, L),
      backHoles = holes.map((h) => ({ ...h, u: (h.u / L) * Li, w: (h.w / L) * Li }));
    panel(o, k, a, b, y0, y1, holes, n, normal);
    panel(
      o,
      k,
      A,
      B,
      y0,
      y1,
      backHoles,
      n,
      normal.map((v) => -v),
    );
    face(
      o,
      k,
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [B[0], y1, B[1]],
        [A[0], y1, A[1]],
      ],
      [0, 1, 0],
    );
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [B[0], y0, B[1]],
        [A[0], y0, A[1]],
      ],
      [0, -1, 0],
    );
    const q = (u, y, back) => {
        const p = mix(back ? A : a, back ? B : b, u / L);
        return [p[0], y, p[1]];
      },
      U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (const h of holes) {
      const path = holePath(h, n);
      for (let j = 0; j < path.length; j++) {
        const a = path[j],
          b = path[(j + 1) % path.length],
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        face(
          o,
          k,
          [q(a[0], a[1], false), q(b[0], b[1], false), q(b[0], b[1], true), q(a[0], a[1], true)],
          [dy * U[0], -dx, dy * U[1]],
        );
      }
    }
  }
}
const entryHole = (a, b) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = (P.entry.centerX - a[0]) / (b[0] - a[0]);
  return { u: t * L, w: P.entry.halfWidth, base: P.floor, spring: P.entry.spring, arc: true };
};
function mainFort(o, lod) {
  const r = P.plan.outer,
    courts = [P.plan.mainCourt, ...P.plan.rearCourts],
    n = [4, 7, 12, 18][lod];
  polygon(o, 'stone', r, H.foundationBottom, P.floor);
  cap(o, 'deck', r, H.terrace, 1, courts);
  for (let i = 0; i < r.length; i++) {
    if (i === 7) continue;
    const a = r[i],
      b = r[(i + 1) % r.length],
      holes = i === 12 ? [entryHole(a, b)] : [];
    panel(o, 'plaster', a, b, P.floor, H.terrace, holes, n, outward(r, a, b));
  }
  for (let j = 0; j < courts.length; j++) {
    const ring = courts[j];
    cap(o, 'deck', ring, P.floor + 0.015, 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      panel(
        o,
        'plaster',
        a,
        b,
        P.floor,
        H.terrace,
        j === 0 && i === 2 ? [entryHole(a, b)] : [],
        n,
        outward(ring, a, b, true),
      );
    }
  }
  const holeFn = (i, L) => {
    const holes = [];
    if (P.parapet.largeGunpostEdges.includes(i))
      holes.push({ u: L / 2, w: 0.65, base: H.terrace + 0.1, spring: H.terrace + 0.6, arc: true });
    if (lod && P.parapet.roundedPortEdges.includes(i))
      holes.push({
        u: L / 2,
        w: 0.28,
        base: H.terrace + 0.17,
        spring: H.terrace + 0.82,
        arc: true,
      });
    if (lod) {
      const count = Math.min(6, Math.floor(L / P.parapet.narrowLoopSpacing));
      for (let j = 0; j < count; j++) {
        if (lod === 1 && j % 2) continue;
        const u = (L * (j + 1)) / (count + 1);
        if (holes.some((h) => Math.abs(h.u - u) < h.w + 0.5)) continue;
        holes.push({ u, w: 0.075, base: H.terrace + 0.47, spring: H.terrace + 1.05, arc: false });
      }
    }
    return holes;
  };
  band(o, 'plaster', r, insetRing(r, H.parapetThickness), H.terrace, H.parapetTop, holeFn, lod);
  if (lod > 1) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      beam(
        o,
        'trim',
        [a[0], H.terrace - 0.12, a[1]],
        [b[0], H.terrace - 0.12, b[1]],
        0.12,
        0.16,
        colors.trim,
      );
    }
  }
}
function entrance(o, lod) {
  const r = P.plan.entranceOutwork,
    n = [4, 7, 12, 18][lod];
  polygon(o, 'stone', r, H.foundationBottom, P.floor);
  cap(o, 'deck', r, H.outworkRoof, 1);
  for (let i = 1; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    panel(
      o,
      'plaster',
      a,
      b,
      P.floor,
      H.outworkRoof,
      i === 3 ? [entryHole(a, b)] : [],
      n,
      outward(r, a, b),
    );
  }
  const E = P.entry,
    z0 = E.courtZ,
    z1 = E.frontZ,
    x = E.centerX,
    w = E.halfWidth;
  for (const side of [-1, 1])
    face(
      o,
      'plaster',
      [
        [x + side * w, P.floor, z0],
        [x + side * w, P.floor, z1],
        [x + side * w, E.spring, z1],
        [x + side * w, E.spring, z0],
      ],
      [-side, 0, 0],
    );
  const point = (i, z) => {
    const t = (i * Math.PI) / n;
    return [x - w * Math.cos(t), E.spring + w * Math.sin(t), z];
  };
  for (let i = 1; i <= n; i++) {
    const t = ((i - 0.5) * Math.PI) / n;
    face(
      o,
      'plaster',
      [point(i - 1, z0), point(i, z0), point(i, z1), point(i - 1, z1)],
      [Math.cos(t), -Math.sin(t), 0],
    );
  }
  if (lod) {
    const depth = E.frontZ + 0.04;
    for (let i = 1; i <= n; i++) {
      const t0 = ((i - 1) * Math.PI) / n,
        t1 = (i * Math.PI) / n,
        p = (t, r) => [x - r * Math.cos(t), E.spring + r * Math.sin(t), depth];
      face(o, 'trim', [p(t0, w), p(t1, w), p(t1, w + 0.27), p(t0, w + 0.27)], [0, 0, 1]);
    }
    for (const side of [-1, 1])
      beam(
        o,
        'trim',
        [x + side * (w + 0.15), P.floor, depth],
        [x + side * (w + 0.15), E.spring, depth],
        0.22,
        0.22,
        colors.trim,
      );
  }
}
function windows(o, r, y0, y1, lod, maxCount = 6) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = outward(r, a, b),
      count = Math.max(1, Math.min(maxCount, Math.round(L / 5.5))),
      w = Math.min(1.1, L / (count * 2.8)),
      U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      at = (u, y) => [a[0] + U[0] * u + normal[0] * 0.025, y, a[1] + U[1] * u + normal[2] * 0.025];
    for (let j = 0; j < count; j++) {
      const u = (L * (j + 0.5)) / count,
        p = [at(u - w / 2, y0), at(u + w / 2, y0), at(u + w / 2, y1), at(u - w / 2, y1)];
      face(o, 'glass', p, normal);
      if (lod > 1)
        for (let k = 0; k < 4; k++) beam(o, 'wood', p[k], p[(k + 1) % 4], 0.08, 0.1, colors.wood);
    }
  }
}
function upperRooms(o, lod) {
  for (const [r, top, roof] of [
    [P.plan.westernUpperRooms, H.westRoomsWall, H.westRoomsRoof],
    [P.plan.easternUpperRooms, H.eastRoomsWall, H.eastRoomsRoof],
  ]) {
    polygon(o, 'plaster', r, H.terrace, top);
    polygon(o, 'deck', r, top, roof);
    windows(o, r, H.terrace + 0.9, top - 0.6, lod);
  }
  const a = P.plan.attachedServiceAnnex;
  polygon(o, 'stone', a, H.foundationBottom, P.floor);
  outlineWalls(o, 'plaster', a, P.floor, H.annexWall, new Set([3]));
  cap(o, 'deck', a, H.annexRoof, 1);
  outlineWalls(o, 'deck', a, H.annexWall, H.annexRoof);
  windows(o, a, P.floor + 1.1, P.floor + 3.3, lod);
  windows(o, a, H.terrace + 0.6, H.annexWall - 0.7, lod);
}
function tower(o, lod) {
  const c = P.plan.gateTowerCenter,
    R = P.plan.gateTowerRadius,
    r = Array.from({ length: 8 }, (_, i) => {
      const t = (i * Math.PI) / 4 + Math.PI / 8;
      return [c[0] + R * Math.cos(t), c[1] + R * Math.sin(t)];
    }),
    inner = insetRing(r, 0.4);
  cap(o, 'deck', r, H.towerFloor, 1);
  const holes = (i, L) =>
    lod && i % 2 === 0 ? [{ u: L / 2, w: 0.65, base: 10.35, spring: 13.65, arc: false }] : [];
  band(o, 'plaster', r, inner, H.towerFloor, H.towerWall, holes, lod);
  polygon(o, 'deck', r, H.towerWall, H.towerRoof);
  band(o, 'plaster', r, inner, H.towerRoof, H.towerParapet, () => [], lod);
  if (!lod) windows(o, r, 10.35, 13.65, 0, 1);
  else
    for (let i = 0; i < 8; i += 2) {
      const a = r[i],
        b = r[(i + 1) % 8],
        n = outward(r, a, b),
        m = mix(a, b, 0.5),
        U = b.map((v, k) => (v - a[k]) / Math.hypot(b[0] - a[0], b[1] - a[1])),
        p = (u, y) => [m[0] + U[0] * u - n[0] * 0.2, y, m[1] + U[1] * u - n[2] * 0.2];
      face(o, 'glass', [p(-0.65, 10.35), p(0.65, 10.35), p(0.65, 13.65), p(-0.65, 13.65)], n);
    }
  if (lod) {
    beam(o, 'wood', [c[0], H.towerRoof, c[1]], [c[0], H.flagTop, c[1]], 0.13, 0.13, colors.wood);
    const x = c[0] + 0.08,
      y = H.flagTop - 0.1,
      z = c[1],
      red = rgb('b81d18'),
      white = rgb('eee9db'),
      p = [
        [x, y, z],
        [x + 3.5, y, z],
        [x + 2.8, y - 0.65, z],
        [x + 3.5, y - 1.3, z],
        [x, y - 1.3, z],
      ];
    for (const side of [-1, 1]) {
      face(o, 'trim', p, [0, 0, side], red);
      face(
        o,
        'trim',
        [
          [x + 0.9, y, z + side * 0.012],
          [x + 1.15, y, z + side * 0.012],
          [x + 1.15, y - 1.3, z + side * 0.012],
          [x + 0.9, y - 1.3, z + side * 0.012],
        ],
        [0, 0, side],
        white,
      );
      face(
        o,
        'trim',
        [
          [x, y - 0.52, z + side * 0.013],
          [x + 3.0, y - 0.52, z + side * 0.013],
          [x + 3.0, y - 0.76, z + side * 0.013],
          [x, y - 0.76, z + side * 0.013],
        ],
        [0, 0, side],
        white,
      );
    }
  }
}
function stairs(o, lod) {
  for (const [x0, x1, z] of [
    [-16, -2, -13],
    [-5, -18, 18],
  ]) {
    const n = lod ? [9, 12, 16, 18][lod] : 1,
      w = 2.1;
    if (!lod) {
      face(
        o,
        'stone',
        [
          [x0, P.floor, z - w / 2],
          [x1, H.terrace, z - w / 2],
          [x1, H.terrace, z + w / 2],
          [x0, P.floor, z + w / 2],
        ],
        [0, 1, 0],
      );
      continue;
    }
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n,
        b = x0 + ((x1 - x0) * (i + 1)) / n,
        top = P.floor + ((H.terrace - P.floor) * (i + 1)) / n;
      polygon(
        o,
        'stone',
        [
          [Math.min(a, b), z - w / 2],
          [Math.max(a, b), z - w / 2],
          [Math.max(a, b), z + w / 2],
          [Math.min(a, b), z + w / 2],
        ],
        P.floor,
        top,
      );
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  mainFort(o, lod);
  componentEvidence.push('whole-twenty-control-fort-all-four-bastions-and-full-curtain-terraces');
  componentEvidence.push('true-open-central-courtyard-and-both-rear-prison-courts');
  entrance(o, lod);
  componentEvidence.push('whole-entrance-outwork-and-true-continuous-arched-entry-barrel');
  upperRooms(o, lod);
  componentEvidence.push('complete-west-east-upper-rooms-and-whole-attached-service-annex');
  tower(o, lod);
  componentEvidence.push('entire-octagonal-watchtower-all-walls-flat-roof-and-parapet');
  stairs(o, lod);
  componentEvidence.push('intrinsic-courtyard-stairs-and-three-open-arched-gunposts-all-levels');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/s1/s10/fort_prinzenstein',
  camera = [140, 112, 178],
  look = [0, 5, 4],
  c = P.plan.gateTowerCenter;
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Fort Prinzenstein — Keta,1847',
  wikidataId: 'Q1438675',
  cell: 's1/s10',
  category: 'fort',
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
  camera,
  lookAt: look,
  portableGroundY: H.foundationBottom - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'metal_painted',
    'wood_plain',
    'window_punched',
  ],
  qaCameras: [
    {
      name: 'whole-historical-fort-four-bastions-all-wings-and-gate',
      position: camera,
      lookAt: look,
    },
    {
      name: 'true-entry-outwork-and-octagonal-watchtower',
      position: [35, 28, 95],
      lookAt: [0, 6, c[1] + 5],
    },
    {
      name: 'whole-courtyard-rear-prison-courts-and-both-upper-wings',
      position: [-45, 100, -92],
      lookAt: [0, 3, -3],
    },
    {
      name: 'complete-attached-service-annex-and-eastern-bastions',
      position: [110, 48, 8],
      lookAt: [32, 6, 2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-prinzenstein-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural entirehistorical1847fort underrepositorylicense. ArchitecturederivedfromclearlyexpiredSvedstrup1847primaryplan/exteriorinoriginal1918book; creator1819-1893confirmedbyNationalMuseum. Onlyhistoricalplatesused, no modernlibrarywrapper/logo/otherimages. OriginalnumericPOIcontextODbL. Allprotected/questionableQuallaimageryunused; no borrowedmesh or image-texturetrace. Absoluteplan/sections/roof/grade/facingestimatesdeclared; latermajorerosionacknowledged andno intactcurrentreplacement.',
};
