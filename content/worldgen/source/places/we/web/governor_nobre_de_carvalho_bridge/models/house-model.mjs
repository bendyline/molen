/** Whole Macau–Taipa main bridge in its2009 road-video phase. Original field and main sections frozen. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  B = P.bridge,
  S = P.supports,
  R = P.railing,
  ref = 'palette:#ffffff';
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  road: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  pier: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.25 },
  paint: { slot: 'trim', localRef: ref, roughness: 0.92, metallic: 0 },
  lens: { slot: 'window', localRef: 'palette:#ddd8bd', roughness: 0.3, metallic: 0.1 },
};
const C = {
    concrete: rgb('bab7a9'),
    road: rgb('525455'),
    pier: rgb('b8b5a7'),
    iron: rgb('e3e2d6'),
    paint: rgb('dddac1'),
    lens: rgb('ddd8bd'),
  },
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const toWorld = ([s, y, z]) => [U[0] * s + V[0] * z, y, U[1] * s + V[1] * z],
  rotate = ([s, y, z]) => [U[0] * s + V[0] * z, y, U[1] * s + V[1] * z];
export const roadY = (s) => {
  const a = Math.abs(s),
    h = B.raisedHalfLength,
    c = B.roundedCrestRadius,
    t = a >= h ? 1 : (Math.sqrt(a * a + c * c) - c) / (Math.sqrt(h * h + c * c) - c);
  return B.deckPeakY + (B.deckEndY - B.deckPeakY) * t;
};
export const depth = (s) =>
  B.boxDepth +
  (B.boxSupportDepth - B.boxDepth) * Math.max(0, 1 - Math.abs(Math.abs(s) - 35) / 48) ** 2;
export const partEvidence = [],
  roofEvidence = [],
  soffitEvidence = [],
  supportEvidence = [],
  railingEvidence = [],
  lampEvidence = [],
  cellEvidence = [];
let activeLod = 3;
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k], sidesOnly = false) {
  for (const [ps, n] of [
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
    if (!sidesOnly || n[1] === 0) face(o, k, ps, n, col);
}
function strip(o, k, xs, z0, z1, top, bottom, id, topOnly = false, col = C[k]) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      A = top(a),
      D = top(b),
      aY = bottom(a),
      bY = bottom(b);
    face(
      o,
      k,
      [
        [a, A, z0],
        [b, D, z0],
        [b, D, z1],
        [a, A, z1],
      ],
      [0, 1, 0],
      col,
    );
    if (id)
      roofEvidence.push({ id: `${id}-top-${i}`, point: [(a + b) / 2, (A + D) / 2, (z0 + z1) / 2] });
    if (topOnly) continue;
    face(
      o,
      k,
      [
        [a, aY, z1],
        [b, bY, z1],
        [b, bY, z0],
        [a, aY, z0],
      ],
      [0, -1, 0],
      col,
    );
    for (const [z, n] of [
      [z0, [0, 0, -1]],
      [z1, [0, 0, 1]],
    ])
      face(
        o,
        k,
        [
          [a, aY, z],
          [b, bY, z],
          [b, D, z],
          [a, A, z],
        ],
        n,
        col,
      );
    if (id)
      soffitEvidence.push({
        id: `${id}-bottom-${i}`,
        point: [(a + b) / 2, (aY + bY) / 2, (z0 + z1) / 2],
      });
  }
  if (!topOnly)
    for (const [x, n] of [
      [xs[0], [-1, 0, 0]],
      [xs.at(-1), [1, 0, 0]],
    ])
      face(
        o,
        k,
        [
          [x, bottom(x), z0],
          [x, bottom(x), z1],
          [x, top(x), z1],
          [x, top(x), z0],
        ],
        n,
        col,
      );
}
const samples = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n),
  unique = (xs) => [...new Set(xs)].sort((a, b) => a - b);
function roadDeck(o, lod) {
  const xs =
    lod === 0
      ? [B.s0, -B.raisedHalfLength, 0, B.raisedHalfLength, B.s1]
      : unique([
          ...samples(B.s0, B.s1, [0, 16, 40, 80][lod]),
          -B.raisedHalfLength,
          -35,
          0,
          35,
          B.raisedHalfLength,
        ]);
  strip(
    o,
    'concrete',
    xs,
    -4.6,
    4.6,
    (s) => roadY(s) - B.asphaltThickness,
    (s) => roadY(s) - B.asphaltThickness - B.slabThickness,
    'whole-deck',
  );
  strip(o, 'road', xs, -3.5, 3.5, roadY, roadY, 'whole-road', true);
  for (const side of [-1, 1]) {
    const a = side < 0 ? -4.45 : 3.5,
      b = side < 0 ? -3.5 : 4.45;
    strip(
      o,
      'concrete',
      xs,
      a,
      b,
      (s) => roadY(s) + B.sidewalkRise,
      (s) => roadY(s) - B.asphaltThickness,
      `sidewalk-${side}`,
      lod === 0,
    );
    if (lod === 3) {
      const q = side * 3.5;
      strip(
        o,
        'concrete',
        xs,
        Math.min(q, q + side * B.kerbWidth),
        Math.max(q, q + side * B.kerbWidth),
        (s) => roadY(s) + B.sidewalkRise + 0.04,
        (s) => roadY(s),
        `kerb-${side}`,
      );
    }
  }
  if (lod > 0) {
    for (const z of [-3.3, 0, 3.3]) {
      const w = z === 0 ? 0.065 : 0.08;
      strip(
        o,
        'paint',
        xs,
        z - w,
        z + w,
        (s) => roadY(s) + 0.007,
        (s) => roadY(s) + 0.007,
        null,
        true,
      );
    }
  }
  partEvidence.push({
    id: 'whole-native-mainbridge-deck-road-and-two-sidewalks',
    length: B.length,
  });
}
function mainBox(o, lod) {
  const xs = unique([
    ...samples(-B.boxGirderHalfLength, B.boxGirderHalfLength, [2, 10, 24, 48][lod]),
    -35,
    0,
    35,
  ]);
  const top = (s) => roadY(s) - B.asphaltThickness - B.slabThickness,
    bot = (s) => roadY(s) - depth(s);
  if (lod < 2) strip(o, 'concrete', xs, -B.boxWidth / 2, B.boxWidth / 2, top, bot, 'main-box');
  else {
    strip(
      o,
      'concrete',
      xs,
      -B.boxWidth / 2,
      B.boxWidth / 2,
      (s) => bot(s) + B.boxBottom,
      bot,
      'main-box-bottom',
    );
    for (const side of [-1, 1]) {
      const a = side < 0 ? -B.boxWidth / 2 : B.boxWidth / 2 - B.boxWeb,
        b = side < 0 ? -B.boxWidth / 2 + B.boxWeb : B.boxWidth / 2;
      strip(o, 'concrete', xs, a, b, top, bot, `main-box-web-${side}`);
    }
    for (const s of [-B.boxGirderHalfLength, B.boxGirderHalfLength])
      box(o, 'concrete', [s - 0.16, bot(s), -B.boxWidth / 2], [s + 0.16, top(s), B.boxWidth / 2]);
    for (const s of [-280, 0, 280])
      cellEvidence.push({
        id: `actual-closed-box-cell-${s}`,
        point: [s, top(s) - 0.55, 0],
        ceiling: top(s),
        side: B.boxWidth / 2 - B.boxWeb,
      });
  }
  partEvidence.push({
    id: 'whole-raised-navigation-box-girder-with-real-inner-cell',
    navigationOpening: 70,
  });
}
function tGirder(o, a, b, z) {
  const profile =
      activeLod === 2
        ? [
            [-B.tTopWidth / 2, 0],
            [B.tTopWidth / 2, 0],
            [B.tTopWidth / 2, -B.tFlange],
            [B.tWeb / 2, -B.tFlange],
            [B.tWeb / 2, -B.tGirderDepth],
            [-B.tWeb / 2, -B.tGirderDepth],
            [-B.tWeb / 2, -B.tFlange],
            [-B.tTopWidth / 2, -B.tFlange],
          ]
        : [
            [-B.tTopWidth / 2, 0],
            [B.tTopWidth / 2, 0],
            [B.tTopWidth / 2, -B.tFlange],
            [B.tWeb / 2, -B.tFlange],
            [B.tWeb / 2, -B.tGirderDepth + B.tFlange],
            [B.tBottomWidth / 2, -B.tGirderDepth + B.tFlange],
            [B.tBottomWidth / 2, -B.tGirderDepth],
            [-B.tBottomWidth / 2, -B.tGirderDepth],
            [-B.tBottomWidth / 2, -B.tGirderDepth + B.tFlange],
            [-B.tWeb / 2, -B.tGirderDepth + B.tFlange],
            [-B.tWeb / 2, -B.tFlange],
            [-B.tTopWidth / 2, -B.tFlange],
          ],
    section = (x) =>
      profile.map(([q, y]) => [x, roadY(x) - B.asphaltThickness - B.slabThickness + y, z + q]),
    A = section(a),
    D = section(b);
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    face(o, 'concrete', [A[i], D[i], D[j], A[j]]);
  }
  const tiles =
    activeLod === 2
      ? [
          [0, 1, 2, 7],
          [3, 4, 5, 6],
        ]
      : [
          [0, 1, 2, 11],
          [3, 4, 9, 10],
          [5, 6, 7, 8],
        ];
  for (const [q, n] of [
    [A, [-1, 0, 0]],
    [D, [1, 0, 0]],
  ])
    for (const t of tiles)
      face(
        o,
        'concrete',
        t.map((i) => q[i]),
        n,
      );
}
function approaches(o, lod) {
  let spans = 0;
  for (const [a, b] of [
    [B.s0, -B.boxGirderHalfLength],
    [B.boxGirderHalfLength, B.s1],
  ]) {
    const xs = unique([a, ...S.stations.filter((s) => s > a && s < b), b]);
    if (lod < 2)
      strip(
        o,
        'concrete',
        [a, b],
        -2.95,
        2.95,
        (s) => roadY(s) - B.asphaltThickness - B.slabThickness,
        (s) => roadY(s) - B.asphaltThickness - B.slabThickness - B.tGirderDepth,
        'approach-girder',
      );
    else
      for (let i = 1; i < xs.length; i++)
        for (const z of lod === 2 ? [-2.7, 2.7] : B.tGirderCenters)
          tGirder(o, xs[i - 1] + 0.055, xs[i] - 0.055, z);
    spans += xs.length - 1;
  }
  partEvidence.push({
    id: 'both-complete-low-T-beam-approaches',
    representedGirderBays: spans,
    nearGirdersPerBay: lod === 3 ? 4 : lod === 2 ? 2 : 1,
  });
}
function supports(o, lod) {
  for (let i = 0; i < S.stations.length; i++) {
    const s = S.stations[i],
      end = i === 0 || i === S.stations.length - 1,
      main = Math.abs(Math.abs(s) - 35) < 0.001,
      under =
        roadY(s) -
        (Math.abs(s) <= B.boxGirderHalfLength
          ? depth(s)
          : B.asphaltThickness + B.slabThickness + B.tGirderDepth),
      capBottom = under - S.bearingHeight - S.crossheadHeight,
      base = end ? S.abutmentBase : S.pierBase;
    if (lod === 0) {
      const w = end ? S.abutmentAlong : main ? S.mainAlong : S.approachColumnAlong;
      for (const n of [
        [0, 0, -1],
        [0, 0, 1],
      ])
        face(
          o,
          'pier',
          [
            [s - w / 2, base, 0],
            [s + w / 2, base, 0],
            [s + w / 2, capBottom + S.crossheadHeight, 0],
            [s - w / 2, capBottom + S.crossheadHeight, 0],
          ],
          n,
        );
    } else if (end) {
      box(o, 'pier', [s - S.abutmentAlong / 2, base, -4.6], [s + S.abutmentAlong / 2, under, 4.6]);
      if (lod >= 2)
        for (const z of [-4.35, 4.35])
          box(
            o,
            'concrete',
            [s + (i === 0 ? -S.abutmentWingLength : 0), base, z - 0.2],
            [s + (i === 0 ? 0 : S.abutmentWingLength), roadY(s) + 0.18, z + 0.2],
          );
    } else if (lod === 1) {
      box(
        o,
        'pier',
        [
          s - (main ? S.mainAlong : S.approachColumnAlong) / 2,
          base,
          -(main ? S.mainAcross : 3.2) / 2,
        ],
        [
          s + (main ? S.mainAlong : S.approachColumnAlong) / 2,
          capBottom + S.crossheadHeight,
          (main ? S.mainAcross : 3.2) / 2,
        ],
      );
    } else {
      if (main)
        box(
          o,
          'pier',
          [
            s - (main ? S.mainAlong : S.approachColumnAlong) / 2,
            base,
            -(main ? S.mainAcross : 3.2) / 2,
          ],
          [
            s + (main ? S.mainAlong : S.approachColumnAlong) / 2,
            capBottom,
            (main ? S.mainAcross : 3.2) / 2,
          ],
        );
      else
        for (const z of S.approachColumnCenters)
          box(
            o,
            'pier',
            [s - S.approachColumnAlong / 2, base, z - S.approachColumnAcross / 2],
            [s + S.approachColumnAlong / 2, capBottom, z + S.approachColumnAcross / 2],
          );
      box(
        o,
        'pier',
        [s - S.crossheadAlong / 2, capBottom, -S.crossheadAcross / 2],
        [s + S.crossheadAlong / 2, capBottom + S.crossheadHeight, S.crossheadAcross / 2],
      );
      if (lod >= 2) {
        for (const z of [-2.2, 2.2])
          box(
            o,
            'iron',
            [s - S.bearingAlong / 2, under - S.bearingHeight, z - S.bearingAcross / 2],
            [s + S.bearingAlong / 2, under, z + S.bearingAcross / 2],
            rgb('6d7068'),
          );
        if (lod === 3)
          box(
            o,
            'pier',
            [s - 2.1, S.footingBase, -4.1],
            [s + 2.1, S.footingBase + S.footingHeight, 4.1],
          );
      }
    }
    supportEvidence.push({ id: `support-${i}`, station: s, end, main, base, capBottom, under });
  }
  partEvidence.push({
    id: 'all82-support-groups-and-two-intrinsic-abutments',
    count: S.stations.length,
  });
}
function railings(o, lod) {
  const n = [4, 16, 40, 80][lod],
    xs = unique([...samples(B.s0, B.s1, n), -B.raisedHalfLength, 0, B.raisedHalfLength]);
  for (const side of [-1, 1]) {
    const z = side * R.z,
      base = (s) => roadY(s) + B.sidewalkRise;
    strip(
      o,
      'iron',
      xs,
      z - R.topWidth / 2,
      z + R.topWidth / 2,
      (s) => base(s) + R.height,
      (s) => base(s) + R.height - R.topWidth,
      null,
    );
    if (lod >= 1)
      for (const h of [R.middleRailHeight, R.baseRailHeight])
        strip(
          o,
          'iron',
          xs,
          z - R.midWidth / 2,
          z + R.midWidth / 2,
          (s) => base(s) + h,
          (s) => base(s) + h - R.midWidth,
          null,
        );
    if (lod > 0) {
      const ss =
        lod === 1
          ? S.stations
          : samples(
              B.s0,
              B.s1,
              Math.floor(B.length / (lod === 2 ? R.picketStreetPitch : R.picketNearPitch)),
            );
      for (let i = 0; i < ss.length; i++) {
        const s = ss[i],
          w = lod === 1 ? 0.07 : R.picketWidth,
          h = base(s);
        if (lod < 3)
          for (const nz of [-1, 1])
            face(
              o,
              'iron',
              [
                [s - w / 2, h, z],
                [s + w / 2, h, z],
                [s + w / 2, h + R.height, z],
                [s - w / 2, h + R.height, z],
              ],
              [0, 0, nz],
            );
        else
          box(
            o,
            'iron',
            [s - w / 2, h, z - w / 2],
            [s + w / 2, h + R.height, z + w / 2],
            C.iron,
            true,
          );
        if (i < ss.length - 1 && i % Math.max(1, Math.floor(ss.length / 16)) === 0) {
          const q = (s + ss[i + 1]) / 2;
          railingEvidence.push({
            id: `open-picket-bay-${side}-${i}`,
            point: [q, base(q) + 0.82, z],
            normal: [0, 0, side],
          });
        }
      }
    }
    if (lod === 3) {
      const gs = samples(B.s0, B.s0 + R.entryGreenLength, 3);
      strip(
        o,
        'iron',
        gs,
        z - 0.035,
        z + 0.035,
        (s) => base(s) + 0.72,
        (s) => base(s) + 0.66,
        null,
        false,
        rgb('38746d'),
      );
    }
  }
  partEvidence.push({
    id: 'two-complete-white-open-picket-railing-sequences',
    nearPicketPitch: R.picketNearPitch,
  });
}
function lamp(o, s, z, lod, idx) {
  const base = roadY(s) + B.sidewalkRise,
    side = Math.sign(z),
    H = P.lamps.postHeight,
    reach = P.lamps.armReach,
    arm = [
      [s, base, z],
      [s, base + H - 1.4, z],
      [s, base + H - 0.65, z - side * 0.18],
      [s, base + H - 0.15, z - side * 0.7],
      [s, base + H, z - side * reach],
    ],
    col = idx === 0 ? rgb('e0e0d4') : C.iron;
  if (lod === 0) {
    for (const nz of [-1, 1])
      face(
        o,
        'iron',
        [
          [s - 0.07, base, z],
          [s + 0.07, base, z],
          [s + 0.07, base + H, z],
          [s - 0.07, base + H, z],
        ],
        [0, 0, nz],
      );
    face(
      o,
      'iron',
      [
        [s - 0.08, base + H, z],
        [s + 0.08, base + H, z],
        [s + 0.08, base + H, z - side * reach],
        [s - 0.08, base + H, z - side * reach],
      ],
      [0, 1, 0],
    );
  } else if (lod === 1) {
    for (const nz of [-1, 1])
      face(
        o,
        'iron',
        [
          [s - 0.07, base, z],
          [s + 0.07, base, z],
          [s + 0.07, base + H, z],
          [s - 0.07, base + H, z],
        ],
        [0, 0, nz],
      );
    for (const nx of [-1, 1])
      face(
        o,
        'iron',
        [
          [s, base + H - 0.1, z],
          [s, base + H + 0.1, z],
          [s, base + H + 0.1, z - side * reach],
          [s, base + H - 0.1, z - side * reach],
        ],
        [nx, 0, 0],
      );
  } else if (lod === 2) {
    beam(o, 'iron', arm[0], arm[2], 0.105, 0.105, col);
    beam(o, 'iron', arm[2], arm[4], 0.105, 0.105, col);
  } else {
    for (let i = 1; i < arm.length; i++)
      beam(o, 'iron', arm[i - 1], arm[i], P.lamps.postDiameter, P.lamps.postDiameter, col);
    if (lod === 3) {
      box(o, 'iron', [s - 0.14, base, z - 0.14], [s + 0.14, base + 0.25, z + 0.14]);
      const p = arm.at(-1);
      box(
        o,
        'iron',
        [p[0] - 0.15, p[1] - 0.11, p[2] - 0.32],
        [p[0] + 0.15, p[1] + 0.04, p[2] + 0.32],
      );
      face(
        o,
        'lens',
        [
          [p[0] - 0.12, p[1] - 0.115, p[2] - 0.28],
          [p[0] + 0.12, p[1] - 0.115, p[2] - 0.28],
          [p[0] + 0.12, p[1] - 0.115, p[2] + 0.28],
          [p[0] - 0.12, p[1] - 0.115, p[2] + 0.28],
        ],
        [0, -1, 0],
      );
    }
  }
  lampEvidence.push({ id: `white-curved-lamp-${idx}`, base: [s, base, z], head: arm.at(-1) });
}
export function buildHouse(out, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    roofEvidence,
    soffitEvidence,
    supportEvidence,
    railingEvidence,
    lampEvidence,
    cellEvidence,
  ])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  roadDeck(o, lod);
  mainBox(o, lod);
  approaches(o, lod);
  supports(o, lod);
  railings(o, lod);
  for (let i = 0; i < P.lamps.count; i++)
    lamp(
      o,
      B.s0 + 14 + ((B.length - 28) * i) / (P.lamps.count - 1),
      (i % 2 ? -1 : 1) * 4.28,
      lod,
      i,
    );
  partEvidence.push({
    id: 'whole-alternating-curved-white-lamp-sequence',
    count: lampEvidence.length,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/we/web/governor_nobre_de_carvalho_bridge',
  cam = toWorld,
  camera = cam([1850, 1100, -2800]),
  look = cam([0, 12, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Governor Nobre de Carvalho Bridge (2009)',
  cell: 'we/web',
  wikidataId: 'Q977841',
  category: 'bridge',
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
  portableGroundY: S.footingBase - 1,
  mediumFiContext: {
    scale: 1,
    groundY: S.footingBase - 1,
    far: 18000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-post2005-main-crossing-ogival-profile-all-piers',
      position: camera,
      lookAt: look,
    },
    {
      name: 'whole-reverse-deck-box-and-t-beam-approaches',
      position: cam([-1800, 900, 2550]),
      lookAt: look,
    },
    {
      name: 'central70m-navigation-opening-box-girder-and-high-piers',
      position: cam([140, 65, -165]),
      lookAt: cam([0, 18, 0]),
    },
    {
      name: 'roadway-rise-sidewalk-white-pickets-and-curved-lamps',
      position: cam([-470, roadY(-470) + 1.8, -1.8]),
      lookAt: cam([-340, roadY(-340) + 1.2, 0]),
    },
    {
      name: 'complete-t-beam-approach-understructure-and-bearings',
      position: cam([800, -1, -22]),
      lookAt: cam([820, 0, 0]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-macau-taipa-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.28, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Qualla-first28families; cityviewstills unselected. Exact creatorCdip1502009Own/PD-self originalvideo26,011,811bytes/nativeSHA1deec09fb922408f5a80bc183ba84fdac25d6d2be/rawrights/native8frames reviewed; only roadway/profile/whitepickets/curvedlamps appearance adopted. Primary MacauDSOP owner andEdgarCardoso engineering TEXT:9.2mwidth/35mpeakdeckabove sea/70mnavigation/T-beam+box types. Protectedsite/PDFphotos never viewed/adopted. OSMODbLwholemainbridge22988070/physicaloutline1054315892/intrinsicsidewalks1184621065/66, distinctotherbridges/reservationsclear. Modernmapped2448.157m mainbridge used asapproximate2009post2005phase; original2569.8m andapproximately3kmviaductgroup distinct. Allhiddensections/census/haunches/foundation/gradeestimated, exactsurvey notgate. Noquestionableimagery/recordrepair/copiedvehicles/people/signlettering/citybuildings/audio/phototextures/generatedbitmap.',
};
