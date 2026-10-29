/** Whole original QANTAS Longreach hangar, museum-era2008. Original field/main sections frozen first. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  M = P.main,
  A = P.annex,
  D = P.doors,
  F = P.baseFloorY,
  ref = 'palette:#ffffff',
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const surfaces = {
  sheet: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.2 },
  roof: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.25 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const C = {
  sheet: rgb('d1d1c5'),
  roof: rgb('bfc1b6'),
  steel: rgb('59625c'),
  wood: rgb('a58e70'),
  concrete: rgb('b6b2a3'),
};
export const toWorld = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z],
  rotate = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const partEvidence = [],
  roofEvidence = [],
  windowEvidence = [],
  edgeEvidence = [],
  trussEvidence = [],
  doorEvidence = [];
function face(o, k, p, n, col = C[k]) {
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], col);
}
function cap(o, k, ring, y, n) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      ring,
      [],
      () => y,
      n,
      (q) => q,
      C[k],
    )
  )
    throw Error('Hangar cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      p,
      n,
      p.map((q) => [q[0], q[2]]),
      C[k],
    );
  }
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k]) {
  for (const [p, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [X, y, Z],
        [x, y, Z],
        [x, Y, Z],
        [X, Y, Z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, y, Z],
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, y, z],
        [x, y, z],
      ],
      [0, -1, 0],
    ],
  ])
    face(o, k, p, n, col);
}
const area = P.outline.reduce(
    (s, p, i) =>
      s +
      p[0] * P.outline[(i + 1) % P.outline.length][1] -
      P.outline[(i + 1) % P.outline.length][0] * p[1],
    0,
  ),
  sign = Math.sign(area);
function edge(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = [sign * u[2], 0, -sign * u[0]],
    at = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d];
  return { L, u, n, at };
}
const west = (x) => A.outerEave + ((M.eave - A.outerEave) * (x - A.westX)) / (M.x0 - A.westX),
  east = (x, narrow = false) =>
    M.eave + ((A.outerEave - M.eave) * (x - M.x1)) / ((narrow ? A.eastNarrowX : A.eastX) - M.x1);
export const rearRoofY = (x, z) => {
  const front = x < M.x0 ? west(x) : x > M.x1 ? east(x, true) : M.eave,
    t = (z - M.zRear) / (A.rearZ - M.zRear);
  return F + front + (A.rearEave - front) * t;
};
const wallTop = (i, x, z) =>
  F +
  (i === 0
    ? A.outerEave
    : i === 1 || i === 2
      ? A.rearEave
      : i === 3
        ? rearRoofY(x, z) - F
        : i === 4
          ? east(x, true)
          : i === 5
            ? A.outerEave
            : i === 6
              ? east(x)
              : i === 7
                ? A.outerEave
                : i === 8
                  ? east(x)
                  : i === 9 || i === 10 || i === 11
                    ? M.eave
                    : west(x));
function wallPiece(o, E, a, b, y0, y1, k = 'sheet', inset = 0) {
  if (b - a < 0.00001) return;
  const A0 = typeof y0 === 'function' ? y0(a) : y0,
    B0 = typeof y0 === 'function' ? y0(b) : y0,
    A1 = typeof y1 === 'function' ? y1(a) : y1,
    B1 = typeof y1 === 'function' ? y1(b) : y1;
  if (A1 - A0 < 0.00001 && B1 - B0 < 0.00001) return;
  face(o, k, [E.at(a, A0, inset), E.at(b, B0, inset), E.at(b, B1, inset), E.at(a, A1, inset)], E.n);
  face(
    o,
    k,
    [
      E.at(b, B0, inset - P.wallThickness),
      E.at(a, A0, inset - P.wallThickness),
      E.at(a, A1, inset - P.wallThickness),
      E.at(b, B1, inset - P.wallThickness),
    ],
    E.n.map((v) => -v),
  );
}
function flap(o, E, c, lod, id) {
  const w = P.windows.width,
    bot = F + P.windows.bottom,
    top = F + P.windows.top,
    h = P.wallThickness;
  for (const s of [-1, 1])
    face(
      o,
      'steel',
      [
        E.at(c + (s * w) / 2, bot),
        E.at(c + (s * w) / 2, top),
        E.at(c + (s * w) / 2, top, -h),
        E.at(c + (s * w) / 2, bot, -h),
      ],
      E.u.map((v) => -s * v),
    );
  for (const [Y, n] of [
    [bot, [0, 1, 0]],
    [top, [0, -1, 0]],
  ])
    face(
      o,
      'steel',
      [E.at(c - w / 2, Y), E.at(c + w / 2, Y), E.at(c + w / 2, Y, -h), E.at(c - w / 2, Y, -h)],
      n,
    );
  const p = [
      E.at(c - w / 2, top, 0.035),
      E.at(c + w / 2, top, 0.035),
      E.at(c + w / 2, top - P.windows.flapDrop, P.windows.flapProjection),
      E.at(c - w / 2, top - P.windows.flapDrop, P.windows.flapProjection),
    ],
    n = normalFor(...p);
  face(o, 'sheet', p, n[1] < 0 ? n.map((v) => -v) : n);
  face(
    o,
    'sheet',
    p.map((v) => [v[0], v[1] - 0.045, v[2]]),
    n[1] > 0 ? n.map((v) => -v) : n,
  );
  if (lod === 3)
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08])
      beam(
        o,
        'steel',
        E.at(c + x, bot + 0.12, 0.04),
        E.at(c + x, top - P.windows.flapDrop, P.windows.flapProjection - 0.03),
        0.025,
        0.025,
        C.steel,
      );
  windowEvidence.push({ id, point: E.at(c, bot + 0.23), normal: E.n });
}
function shell(o, lod) {
  cap(o, 'concrete', P.outline, P.foundationBase, [0, -1, 0]);
  cap(o, 'concrete', P.outline, F - 0.04, [0, 1, 0]);
  for (let i = 0; i < P.outline.length; i++) {
    const E = edge(P.outline[i], P.outline[(i + 1) % P.outline.length]),
      top = (t) => {
        const q = E.at(t, 0);
        return wallTop(i, q[0], q[2]);
      };
    wallPiece(o, E, 0, E.L, P.foundationBase, F, 'concrete');
    if (i === 10) {
      wallPiece(o, E, 0, E.L, F + D.top + 0.06, top);
      edgeEvidence.push({ id: `native-edge-${i}`, mainAircraftOpening: true });
      continue;
    }
    const hasWindows = lod >= 2 && ![9, 11].includes(i) && E.L > 3.8,
      N = hasWindows ? Math.max(1, Math.floor(E.L / P.windows.pitch)) : 0;
    let last = 0;
    for (let j = 0; j < N; j++) {
      const c = ((j + 0.5) * E.L) / N,
        w = P.windows.width,
        a = c - w / 2,
        b = c + w / 2;
      wallPiece(o, E, last, a, F, top);
      if (i === 0 && j === 0 && D.westPersonnelDoor) {
        wallPiece(o, E, a, b, F + 2.1, top);
        wallPiece(o, E, a, b, F, P.annexFloorY);
        wallPiece(o, E, a, b, P.annexFloorY, F + 2.1, 'steel', -0.035);
        if (lod === 3)
          beam(
            o,
            'steel',
            E.at(c + 0.35, F + 0.9, 0.035),
            E.at(c + 0.35, F + 1.1, 0.035),
            0.04,
            0.05,
            rgb('2e3631'),
          );
      } else {
        wallPiece(o, E, a, b, F, F + P.windows.bottom);
        wallPiece(o, E, a, b, F + P.windows.top, top);
        flap(o, E, c, lod, `flap-${i}-${j}`);
      }
      last = b;
    }
    wallPiece(o, E, last, E.L, F, top);
    if (lod === 1 && E.L > 5)
      for (let j = 0; j < Math.max(1, Math.floor(E.L / 9)); j++) {
        const c = ((j + 0.5) * E.L) / Math.max(1, Math.floor(E.L / 9)),
          w = 0.9;
        face(
          o,
          'steel',
          [
            E.at(c - w / 2, F + 1.55, 0.025),
            E.at(c + w / 2, F + 1.55, 0.025),
            E.at(c + w / 2, F + 2.4, 0.025),
            E.at(c - w / 2, F + 2.4, 0.025),
          ],
          E.n,
          rgb('303d36'),
        );
      }
    edgeEvidence.push({ id: `native-edge-${i}`, windows: N });
  }
  box(o, 'concrete', [M.x0, F - M.floorThickness, M.zFront], [M.x1, F, M.zRear]);
  const woodParts = [
    [A.westX, M.x0, A.westFront, A.rearZ],
    [M.x1, A.eastX, A.eastFront, A.eastStepZ],
    [M.x1, A.eastNarrowX, A.eastStepZ, M.zRear],
    [M.x0, A.rearRightX, M.zRear, A.rearZ],
  ];
  for (const [x, X, z, Z] of woodParts)
    box(o, 'wood', [x, P.annexFloorY - A.woodFloorThickness, z], [X, P.annexFloorY, Z]);
  for (const [x, n, start] of [
    [M.x0, [-1, 0, 0], A.westFront],
    [M.x1, [1, 0, 0], A.eastFront],
  ]) {
    face(
      o,
      'sheet',
      [
        [x, F, start],
        [x, F, M.zRear],
        [x, F + M.eave, M.zRear],
        [x, F + M.eave, start],
      ],
      n,
    );
    const innerX = x - n[0] * P.wallThickness;
    face(
      o,
      'sheet',
      [
        [innerX, F, start],
        [innerX, F, M.zRear],
        [innerX, F + M.eave, M.zRear],
        [innerX, F + M.eave, start],
      ],
      n.map((v) => -v),
    );
  }
  face(
    o,
    'sheet',
    [
      [M.x0, F, M.zRear],
      [M.x1, F, M.zRear],
      [M.x1, F + M.eave, M.zRear],
      [M.x0, F + M.eave, M.zRear],
    ],
    [0, 0, -1],
  );
  face(
    o,
    'sheet',
    [
      [M.x1, F, M.zRear + 0.045],
      [M.x0, F, M.zRear + 0.045],
      [M.x0, F + M.eave, M.zRear + 0.045],
      [M.x1, F + M.eave, M.zRear + 0.045],
    ],
    [0, 0, 1],
  );
  partEvidence.push({
    id: 'whole13-edge-building-main-bay-and-three-intrinsic-annex-floors',
    edges: 13,
  });
}
function roofTri(o, p, id) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  face(o, 'roof', p, n);
  face(
    o,
    'roof',
    p.map((v) => [v[0], v[1] - M.roofThickness, v[2]]),
    n.map((v) => -v),
  );
  roofEvidence.push({ id, point: p.reduce((s, p) => s.map((v, i) => v + p[i] / 3), [0, 0, 0]) });
}
function roofQuad(o, p, id) {
  roofTri(o, [p[0], p[1], p[2]], id);
  roofTri(o, [p[0], p[2], p[3]], id);
}
export const mainRoofY = (x) =>
  F + M.eave + (M.ridge - M.eave) * (1 - Math.abs((x - M.centerX) / ((M.x1 - M.x0) / 2)));
function roofs(o, lod) {
  const n = [1, 2, 3, 6][lod];
  for (const [a, b] of [
    [M.x0, M.centerX],
    [M.centerX, M.x1],
  ])
    for (let i = 0; i < n; i++) {
      const z = M.zFront + ((M.zRear - M.zFront) * i) / n,
        Z = M.zFront + ((M.zRear - M.zFront) * (i + 1)) / n;
      roofQuad(
        o,
        [
          [a, mainRoofY(a), z],
          [b, mainRoofY(b), z],
          [b, mainRoofY(b), Z],
          [a, mainRoofY(a), Z],
        ],
        'whole-main-gabled-roof',
      );
    }
  for (const [z, n] of [
    [M.zFront, [0, 0, -1]],
    [M.zRear, [0, 0, 1]],
  ]) {
    const p = [
      [M.x0, F + M.eave, z],
      [M.x1, F + M.eave, z],
      [M.centerX, F + M.ridge, z],
    ];
    face(o, 'sheet', p, n);
    face(
      o,
      'sheet',
      p.map((p) => [p[0], p[1], p[2] - n[2] * P.wallThickness]),
      n.map((v) => -v),
    );
  }
  roofQuad(
    o,
    [
      [A.westX, F + A.outerEave, A.westFront],
      [M.x0, F + M.eave, A.westFront],
      [M.x0, F + M.eave, M.zRear],
      [A.westX, F + A.outerEave, M.zRear],
    ],
    'whole-west-annex-lean-roof',
  );
  for (const [X, z, Z] of [
    [A.eastX, A.eastFront, A.eastStepZ],
    [A.eastNarrowX, A.eastStepZ, M.zRear],
  ])
    roofQuad(
      o,
      [
        [M.x1, F + M.eave, z],
        [X, F + A.outerEave, z],
        [X, F + A.outerEave, Z],
        [M.x1, F + M.eave, Z],
      ],
      'whole-stepped-east-annex-roof',
    );
  const x = A.eastNarrowX;
  face(
    o,
    'sheet',
    [
      [M.x1, F + M.eave, A.eastStepZ],
      [x, F + A.outerEave, A.eastStepZ],
      [x, F + east(x), A.eastStepZ],
    ],
    [0, 0, 1],
  );
  for (const [a, b] of [
    [A.westX, M.x0],
    [M.x0, M.x1],
    [M.x1, A.rearRightX],
  ])
    roofQuad(
      o,
      [
        [a, rearRoofY(a, M.zRear), M.zRear],
        [b, rearRoofY(b, M.zRear), M.zRear],
        [b, rearRoofY(b, A.rearZ), A.rearZ],
        [a, rearRoofY(a, A.rearZ), A.rearZ],
      ],
      'whole-rear-annex-connected-roof',
    );
  const zc = (M.zFront + M.zRear) / 2,
    L = (M.zRear - M.zFront) * P.vent.lengthFraction,
    z = zc - L / 2,
    Z = zc + L / 2,
    y = F + M.ridge,
    w = P.vent.halfWidth;
  for (const side of [-1, 1]) {
    roofQuad(
      o,
      [
        [M.centerX + side * w, y + P.vent.sideHeight, z],
        [M.centerX, y + P.vent.topRise, z],
        [M.centerX, y + P.vent.topRise, Z],
        [M.centerX + side * w, y + P.vent.sideHeight, Z],
      ],
      'whole-raised-ventilated-ridge',
    );
    if (lod >= 1)
      for (const Y of [y + 0.08, y + 0.2])
        beam(
          o,
          'steel',
          [M.centerX + side * w, Y, z],
          [M.centerX + side * w, Y, Z],
          0.05,
          0.05,
          C.steel,
        );
  }
  for (const zz of [z, Z])
    face(
      o,
      'roof',
      [
        [M.centerX - w, y, zz],
        [M.centerX + w, y, zz],
        [M.centerX + w, y + P.vent.sideHeight, zz],
        [M.centerX, y + P.vent.topRise, zz],
        [M.centerX - w, y + P.vent.sideHeight, zz],
      ],
      zz === z ? [0, 0, -1] : [0, 0, 1],
    );
  partEvidence.push({
    id: 'complete-gabled-vented-main-roof-west-stepped-east-and-rear-annex-roofs',
  });
}
function frames(o, lod) {
  const N = lod === 0 ? 2 : lod === 1 ? 4 : P.steel.trussCount;
  for (let i = 0; i < N; i++) {
    const z = M.zFront + 0.5 + ((M.zRear - M.zFront - 1) * i) / (N - 1),
      L = z >= A.westFront ? A.westX : M.x0,
      R = z >= A.eastFront ? (z < A.eastStepZ ? A.eastX : A.eastNarrowX) : M.x1,
      lY = L === M.x0 ? M.eave : A.outerEave,
      rY = R === M.x1 ? M.eave : A.outerEave;
    for (const [x, Y] of [
      [L, lY],
      [R, rY],
    ])
      beam(
        o,
        'steel',
        [x, P.foundationBase, z],
        [x, F + Y, z],
        P.steel.columnWidth,
        P.steel.columnWidth,
        C.steel,
      );
    if (lod > 0) {
      const ps = [
        [L, F + lY - 0.1, z],
        [M.x0, F + M.eave - 0.1, z],
        [M.centerX, F + M.ridge - 0.1, z],
        [M.x1, F + M.eave - 0.1, z],
        [R, F + rY - 0.1, z],
      ];
      for (let k = 1; k < ps.length; k++)
        if (Math.hypot(...ps[k].map((v, j) => v - ps[k - 1][j])) > 0.01)
          beam(o, 'steel', ps[k - 1], ps[k], P.steel.chordWidth, P.steel.chordWidth, C.steel);
      const y = F + M.eave - P.steel.trussDepth;
      beam(o, 'steel', [M.x0, y, z], [M.x1, y, z], P.steel.chordWidth, P.steel.chordWidth, C.steel);
      if (lod >= 2) {
        const parts = lod === 3 ? 8 : 4;
        for (let k = 0; k < parts; k++) {
          const x = M.x0 + ((M.x1 - M.x0) * k) / parts,
            X = M.x0 + ((M.x1 - M.x0) * (k + 1)) / parts;
          beam(
            o,
            'steel',
            [x, k % 2 ? mainRoofY(x) - 0.1 : y, z],
            [X, k % 2 ? y : mainRoofY(X) - 0.1, z],
            P.steel.webWidth,
            P.steel.webWidth,
            C.steel,
          );
        }
      }
    }
    trussEvidence.push({ id: `transverse-steel-group-${i}`, station: z, columns: [L, R] });
  }
  if (lod >= 2)
    for (const x of [M.x0, (M.x0 + M.centerX) / 2, M.centerX, (M.centerX + M.x1) / 2, M.x1])
      beam(
        o,
        'steel',
        [x, mainRoofY(x) - 0.08, M.zFront],
        [x, mainRoofY(x) - 0.08, M.zRear],
        P.steel.purlinWidth,
        P.steel.purlinWidth,
        C.steel,
      );
  partEvidence.push({ id: 'complete-open-tubular-steel-frame-and-roof-purlins', groups: N });
}
function doors(o, lod) {
  const z = M.zFront - D.northOffset,
    y = F + D.trackY;
  for (const x of [M.x0 - D.trackOutrigger, M.x0, M.x1, M.x1 + D.trackOutrigger])
    beam(o, 'steel', [x, F, z], [x, y, z], 0.14, 0.14, C.steel);
  beam(
    o,
    'steel',
    [M.x0 - D.trackOutrigger, y, z],
    [M.x1 + D.trackOutrigger, y, z],
    0.18,
    0.16,
    C.steel,
  );
  if (lod >= 2)
    for (const [x, X] of [
      [M.x0 - D.trackOutrigger, M.x0],
      [M.x1, M.x1 + D.trackOutrigger],
    ])
      beam(o, 'steel', [x, F + 4.2, z], [X, y, z], 0.08, 0.08, C.steel);
  const mid = M.centerX,
    leaves = [
      [M.x0 - D.leafShift, mid - D.leafShift],
      [mid + D.leafShift, M.x1 + D.leafShift],
    ];
  for (const [a, b] of leaves) {
    box(
      o,
      'sheet',
      [a, F + D.leafBottom, z - D.leafThickness / 2],
      [b, F + D.top, z + D.leafThickness / 2],
    );
    if (lod > 0)
      for (let j = 0; j <= D.leafPanels; j++) {
        const x = a + ((b - a) * j) / D.leafPanels;
        beam(
          o,
          'steel',
          [x, F + D.leafBottom, z - 0.075],
          [x, F + D.top, z - 0.075],
          0.055,
          0.055,
          C.steel,
        );
      }
    if (lod >= 2)
      for (const yy of [F + D.leafBottom, F + D.top])
        beam(o, 'steel', [a, yy, z - 0.075], [b, yy, z - 0.075], 0.06, 0.06, C.steel);
    doorEvidence.push({ leaf: [a, b], z });
  }
  partEvidence.push({
    id: 'north-partly-open-sliding-door-leaves-and-complete-steel-outriggers',
    clearOpening: 2 * D.leafShift,
  });
}
const glyph = {
  A: [
    [
      [0, 0],
      [0.5, 1],
    ],
    [
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.22, 0.43],
      [0.78, 0.43],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [1, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  S: [
    [
      [1, 0.9],
      [0.8, 1],
    ],
    [
      [0.8, 1],
      [0.2, 1],
    ],
    [
      [0.2, 1],
      [0, 0.75],
    ],
    [
      [0, 0.75],
      [0.15, 0.55],
    ],
    [
      [0.15, 0.55],
      [0.85, 0.45],
    ],
    [
      [0.85, 0.45],
      [1, 0.2],
    ],
    [
      [1, 0.2],
      [0.8, 0],
    ],
    [
      [0.8, 0],
      [0.1, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.65, 1],
    ],
    [
      [0.65, 1],
      [1, 0.75],
    ],
    [
      [1, 0.75],
      [1, 0.25],
    ],
    [
      [1, 0.25],
      [0.65, 0],
    ],
    [
      [0.65, 0],
      [0, 0],
    ],
  ],
  I: [
    [
      [0.2, 1],
      [0.8, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
    [
      [0.2, 0],
      [0.8, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.8, 1],
    ],
    [
      [0.8, 1],
      [1, 0.75],
    ],
    [
      [1, 0.75],
      [0.8, 0.5],
    ],
    [
      [0.8, 0.5],
      [0, 0.5],
    ],
    [
      [0.45, 0.5],
      [1, 0],
    ],
  ],
  E: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
    [
      [0, 0],
      [1, 0],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.5, 0],
    ],
    [
      [0.5, 0],
      [1, 1],
    ],
  ],
  C: [
    [
      [1, 0.9],
      [0.75, 1],
    ],
    [
      [0.75, 1],
      [0.15, 1],
    ],
    [
      [0.15, 1],
      [0, 0.75],
    ],
    [
      [0, 0.75],
      [0, 0.2],
    ],
    [
      [0, 0.2],
      [0.15, 0],
    ],
    [
      [0.15, 0],
      [0.85, 0],
    ],
  ],
  Q: [
    [
      [0.15, 0],
      [0.85, 0],
    ],
    [
      [0.85, 0],
      [1, 0.2],
    ],
    [
      [1, 0.2],
      [1, 0.8],
    ],
    [
      [1, 0.8],
      [0.8, 1],
    ],
    [
      [0.8, 1],
      [0.2, 1],
    ],
    [
      [0.2, 1],
      [0, 0.8],
    ],
    [
      [0, 0.8],
      [0, 0.2],
    ],
    [
      [0, 0.2],
      [0.15, 0],
    ],
    [
      [0.62, 0.25],
      [1, -0.1],
    ],
  ],
};
function lettering(o, E, text, y, h, w) {
  const pitch = w * 1.3,
    total = (text.length - 1) * pitch + w,
    start = E.L / 2 - total / 2;
  for (let i = 0; i < text.length; i++)
    for (const [a, b] of glyph[text[i]] ?? []) {
      const A = [start + i * pitch + a[0] * w, y + a[1] * h],
        B = [start + i * pitch + b[0] * w, y + b[1] * h],
        dx = B[0] - A[0],
        dy = B[1] - A[1],
        L = Math.hypot(dx, dy),
        px = (-dy / L) * 0.04,
        py = (dx / L) * 0.04;
      face(
        o,
        'steel',
        [
          E.at(A[0] + px, A[1] + py, 0.025),
          E.at(B[0] + px, B[1] + py, 0.025),
          E.at(B[0] - px, B[1] - py, 0.025),
          E.at(A[0] - px, A[1] - py, 0.025),
        ],
        E.n,
        rgb('252c27'),
      );
    }
}
function signs(o, lod) {
  if (lod === 0) return;
  const north = edge([M.x1, M.zFront], [M.x0, M.zFront]),
    south = edge([M.x0, M.zRear], [M.x1, M.zRear]);
  lettering(o, north, P.signs.north, F + 6.25, 0.85, 0.58);
  lettering(o, south, P.signs.south[0], F + 6.9, 0.68, 0.48);
  lettering(o, south, P.signs.south[1], F + 5.95, 0.68, 0.48);
  partEvidence.push({ id: 'factual-north-and-south-qantas-gable-lettering-from-heritage-text' });
}
export function buildHouse(out, _frame, lod = 3) {
  for (const a of [
    partEvidence,
    roofEvidence,
    windowEvidence,
    edgeEvidence,
    trussEvidence,
    doorEvidence,
  ])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  shell(o, lod);
  roofs(o, lod);
  frames(o, lod);
  doors(o, lod);
  signs(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r5/r5y/qantas_hangar_longreach',
  cam = toWorld,
  camera = cam([54, 34, -64]),
  look = cam([-1, 3, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Qantas Hangar, Longreach (2008)',
  cell: 'r5/r5y',
  category: 'transport',
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
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 2500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_corrugated', 'metal_painted', 'wood_plain', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-original-hangar-gabled-roof-and-all-intrinsic-annexes',
      position: camera,
      lookAt: look,
    },
    {
      name: 'north-sliding-doors-steel-outriggers-and-open-structural-bay',
      position: cam([M.centerX, 4.1, M.zFront - 22]),
      lookAt: cam([M.centerX, 3.5, M.zFront + 9]),
    },
    {
      name: 'whole-west-office-rear-annex-flap-windows-and-south-gable',
      position: cam([-48, 24, 53]),
      lookAt: cam([-2, 3, 5]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-qantas-hangar-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Originalauthoredgeometry/repositorylicense. OnlyexactalreadyclearedpublishedSLQ/JohnOxleyLibrary1928constructioncontext/PD-Australia/nativepublicationcitation/originalSHA17fb2a9bf4ce748ff5e1c89088cca5965e087564c used asimagery, notassertedaswholeexteriorphotography. Completeexteriortypes fromQHR600664governmentarchitecturaldescription licensedtextreprint; primaryAHC2008PDFPlace106064wholehangarscope. Protectedwebsite/archivalimages neverviewed/adopted. OSMODbLactualnamed998728731/13outercontrols, separate modernmuseum/airpark/terminal/allreservedworkclear. Allnumericmetrics/census/finishingcolour/grade/phase-registrationestimated. North/southfactualgablewords authoredasoriginalvectorstrokes, no copiedfontbitmap/logoart. No aircraft/exhibit/people/props/interiorfurnishings/landscape/phototextures/generatedbitmap orQuallamedia/rightsrepair.',
};
