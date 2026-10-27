/** Complete old 533m JK de Oliveira bridge in2008. Frozen original field/frame/main sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  B = P.bridge,
  S = P.supports,
  ref = 'palette:#ffffff';
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  road: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  pier: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
  paint: { slot: 'trim', localRef: ref, roughness: 0.93, metallic: 0 },
  lens: { slot: 'window', localRef: 'palette:#eee8cc', roughness: 0.3, metallic: 0.1 },
};
const C = {
  concrete: rgb('b6ad99'),
  road: rgb('625e5a'),
  pier: rgb('b4ad9f'),
  iron: rgb('655953'),
  paint: rgb('e6dfb8'),
  lens: rgb('eee8cc'),
};
const O = P.workingFrame.origin,
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const toWorld = ([x, y, z]) => [O[0] + U[0] * x + V[0] * z, y, O[1] + U[1] * x + V[1] * z];
const rotate = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const roadY = (x) => {
  const t = (x - B.s0) / B.length;
  return B.leftDeckY + (B.rightDeckY - B.leftDeckY) * t + B.roadCrown * Math.sin(Math.PI * t);
};
export const depth = (x) => {
  const a = Math.abs(x),
    t = a <= 70 ? a / 70 : (123 - a) / 53;
  return B.mainMinimumDepth + (B.mainSupportDepth - B.mainMinimumDepth) * Math.max(0, t) ** 2;
};
export const partEvidence = [],
  roofEvidence = [],
  soffitEvidence = [],
  supportEvidence = [],
  railingEvidence = [],
  lampEvidence = [],
  cellEvidence = [],
  hingeEvidence = [];
let activeLod = 3;
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k]) {
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
    if (activeLod > 0 || n[1] >= 0) face(o, k, ps, n, col);
}
function strip(o, k, xs, z0, z1, top, bottom, id) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      aY = top(a),
      bY = top(b),
      ay = bottom(a),
      by = bottom(b);
    face(
      o,
      k,
      [
        [a, aY, z0],
        [b, bY, z0],
        [b, bY, z1],
        [a, aY, z1],
      ],
      [0, 1, 0],
    );
    face(
      o,
      k,
      [
        [a, ay, z1],
        [b, by, z1],
        [b, by, z0],
        [a, ay, z0],
      ],
      [0, -1, 0],
    );
    for (const [z, n] of [
      [z0, [0, 0, -1]],
      [z1, [0, 0, 1]],
    ])
      face(
        o,
        k,
        [
          [a, ay, z],
          [b, by, z],
          [b, bY, z],
          [a, aY, z],
        ],
        n,
      );
    if (id) {
      const x = (a + b) / 2,
        y = (aY + bY) / 2,
        Y = (ay + by) / 2;
      roofEvidence.push({ id: `${id}-top-${i}`, point: [x, y, (z0 + z1) / 2] });
      soffitEvidence.push({ id: `${id}-bottom-${i}`, point: [x, Y, (z0 + z1) / 2] });
    }
  }
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
    );
}
function samples(a, b, count, extra = []) {
  return [
    ...new Set([
      ...Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count),
      ...extra.filter((x) => x >= a && x <= b),
    ]),
  ].sort((a, b) => a - b);
}
function paintStrip(o, xs, z0, z1, lift) {
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    face(
      o,
      'paint',
      [
        [a, roadY(a) + lift, z0],
        [b, roadY(b) + lift, z0],
        [b, roadY(b) + lift, z1],
        [a, roadY(a) + lift, z1],
      ],
      [0, 1, 0],
    );
  }
}
function roadDeck(o, lod) {
  const xs = samples(B.s0, B.s1, [2, 8, 40, 80][lod], lod === 0 ? [0] : [-123, -70, 0, 70, 123]);
  strip(
    o,
    'concrete',
    xs,
    -B.overallWidth / 2,
    B.overallWidth / 2,
    (x) => roadY(x) - B.asphaltThickness,
    (x) => roadY(x) - B.asphaltThickness - B.deckSlabThickness,
    'whole-deck-slab',
  );
  strip(
    o,
    'road',
    xs,
    -B.carriagewayWidth / 2,
    B.carriagewayWidth / 2,
    roadY,
    (x) => roadY(x) - B.asphaltThickness,
    'whole-asphalt-roadway',
  );
  for (const sign of [-1, 1]) {
    const a = sign * B.sidewalkInner,
      b = sign * B.sidewalkOuter,
      z0 = Math.min(a, b),
      z1 = Math.max(a, b);
    strip(
      o,
      'concrete',
      xs,
      z0,
      z1,
      (x) => roadY(x) + B.sidewalkTopOffset,
      (x) => roadY(x) - 0.08,
      `whole-sidewalk-${sign}`,
    );
    const e = sign * (B.sidewalkInner + B.kerbWidth / 2);
    if (lod >= 2)
      strip(
        o,
        'concrete',
        xs,
        e - B.kerbWidth / 2,
        e + B.kerbWidth / 2,
        (x) => roadY(x) + B.sidewalkTopOffset + 0.04,
        (x) => roadY(x) - 0.03,
        `whole-kerb-${sign}`,
      );
  }
  if (lod >= 2) {
    for (const sign of [-1, 1]) paintStrip(o, xs, sign * 3.92 - 0.055, sign * 3.92 + 0.055, 0.004);
    for (let x = -260; x < 260; x += 9) paintStrip(o, [x, x + 3.5], -0.055, 0.055, 0.006);
  }
  partEvidence.push({
    id: 'whole533m-widened12m-deck-roadway-raised-sidewalks-and-kerbs',
    length: B.length,
    overallWidth: B.overallWidth,
  });
}
function mainGirder(o, lod) {
  const top = (x) => roadY(x) - B.asphaltThickness - B.deckSlabThickness,
    low = (x) => roadY(x) - depth(x),
    thick = (x) =>
      B.bottomFlangeThin +
      (B.bottomFlangeThick - B.bottomFlangeThin) * Math.max(0, 1 - Math.abs(Math.abs(x) - 70) / 70),
    web = (x) =>
      B.mainWebThin +
      (B.mainWebThick - B.mainWebThin) * Math.max(0, 1 - Math.abs(Math.abs(x) - 70) / 70),
    xs = samples(-123, 123, [6, 14, 36, 72][lod], [-70, 0, 70]),
    left = xs.filter((x) => x < 0),
    right = xs.filter((x) => x > 0);
  left.push(-B.midspanHingeGap / 2);
  right.unshift(B.midspanHingeGap / 2);
  for (const [i, st] of [left, right].entries()) {
    if (lod <= 1) {
      strip(
        o,
        'concrete',
        st,
        -B.boxHalfWidth,
        B.boxHalfWidth,
        top,
        low,
        `whole-parabolic-caisson-half-${i}`,
      );
    } else {
      strip(
        o,
        'concrete',
        st,
        -B.boxHalfWidth,
        B.boxHalfWidth,
        (x) => low(x) + thick(x),
        low,
        `parabolic-bottom-flange-${i}`,
      );
      for (const z of B.mainWebCoordinates) {
        for (let j = 1; j < st.length; j++) {
          const a = st[j - 1],
            b = st[j],
            za = z - web(a) / 2,
            zb = z - web(b) / 2,
            ZA = z + web(a) / 2,
            ZB = z + web(b) / 2;
          face(
            o,
            'concrete',
            [
              [a, low(a) + thick(a), za],
              [b, low(b) + thick(b), zb],
              [b, top(b), zb],
              [a, top(a), za],
            ],
            [0, 0, -1],
          );
          face(
            o,
            'concrete',
            [
              [b, low(b) + thick(b), ZB],
              [a, low(a) + thick(a), ZA],
              [a, top(a), ZA],
              [b, top(b), ZB],
            ],
            [0, 0, 1],
          );
        }
        for (const [x, n] of [
          [st[0], [-1, 0, 0]],
          [st.at(-1), [1, 0, 0]],
        ])
          face(
            o,
            'concrete',
            [
              [x, low(x) + thick(x), z - web(x) / 2],
              [x, low(x) + thick(x), z + web(x) / 2],
              [x, top(x), z + web(x) / 2],
              [x, top(x), z - web(x) / 2],
            ],
            n,
          );
      }
      for (const x of [st[0], st.at(-1)])
        box(o, 'concrete', [x - 0.15, low(x), -B.boxHalfWidth], [x + 0.15, top(x), B.boxHalfWidth]);
      for (const a of [-2.2, 2.2])
        cellEvidence.push({
          id: `true-hollow-cell-${i}-${a}`,
          point: [i === 0 ? -40 : 40, roadY(i === 0 ? -40 : 40) - depth(i === 0 ? -40 : 40) / 2, a],
        });
    }
  }
  // Concealed Gerber/pendulum connection remains within the box; no open missing span.
  box(o, 'iron', [-0.22, roadY(0) - 1.6, -0.5], [0.22, roadY(0) - 0.65, 0.5]);
  strip(
    o,
    'iron',
    [-0.045, 0.045],
    -6.05,
    6.05,
    (x) => roadY(x) + 0.009,
    (x) => roadY(x) - 0.01,
  );
  hingeEvidence.push({
    id: 'concealed-center-hinge-and-deck-joint',
    point: [0, roadY(0) - 1.1, 0],
  });
  partEvidence.push({
    id: 'whole-three-web-two-cell-parabolic-haunched-caisson-53-140-53',
    mainSpans: B.mainSpans,
    minimumDepth: 3.4,
    mainSupportDepth: 8,
  });
}
function approaches(o, lod) {
  for (const side of [-1, 1])
    for (let i = 0; i < B.approachSpansPerSide; i++) {
      const a = side === -1 ? B.s0 + i * B.approachSpanLength : 123 + i * B.approachSpanLength,
        b = a + B.approachSpanLength,
        st = samples(a + 0.08, b - 0.08, lod === 0 ? 1 : lod === 1 ? 1 : lod === 2 ? 2 : 4),
        top = (x) => roadY(x) - B.asphaltThickness - B.deckSlabThickness,
        bottom = (x) => roadY(x) - B.approachGirderDepth;
      if (lod <= 1) strip(o, 'concrete', st, -4.3, 4.3, top, bottom);
      else {
        for (const z of B.approachGirderOffsets) {
          strip(
            o,
            'concrete',
            st,
            z - B.approachWebHalfWidth,
            z + B.approachWebHalfWidth,
            top,
            bottom,
            `approach-${side}-${i}-web-${z}`,
          );
          if (lod >= 2)
            strip(o, 'concrete', st, z - 0.36, z + 0.36, (x) => bottom(x) + 0.22, bottom);
        }
        for (const x of [a + 0.2, b - 0.2])
          box(
            o,
            'concrete',
            [x - 0.16, roadY(x) - B.crossbeamDepth, -4.3],
            [x + 0.16, top(x), 4.3],
          );
      }
      partEvidence.push({ id: `whole-approach-span-${side}-${i}`, range: [a, b] });
    }
  partEvidence.push({ id: 'all16-estimated-approach-spans-within-primary15to20m-family' });
}
function supports(o, lod) {
  for (const [i, x] of S.stations.entries()) {
    const end = i === 0 || i === S.stations.length - 1,
      main = Math.abs(Math.abs(x) - 70) < 0.01,
      junction = Math.abs(Math.abs(x) - 123) < 0.01,
      girderBottom =
        roadY(x) -
        (main ? B.mainSupportDepth : junction ? B.mainMinimumDepth : B.approachGirderDepth),
      bearing = main ? S.mainBearingHeight : 0.22,
      capHeight = main ? S.mainCapThickness : S.approachCapThickness,
      capTop = girderBottom - bearing,
      capBottom = capTop - capHeight,
      base = main ? S.mainPierBase : S.approachPierBase,
      footA = main ? S.mainFootingWidthAlong : S.approachFootingWidthAlong,
      footZ = main ? S.mainFootingWidthAcross : S.approachFootingWidthAcross;
    if (end) {
      box(
        o,
        'pier',
        [x - S.abutmentDepth / 2, -12, -6.5],
        [x + S.abutmentDepth / 2, roadY(x) - 0.37, 6.5],
      );
      for (const z of [-6.3, 6.3]) {
        const a = x < 0 ? x - S.abutmentWingLength : x,
          b = x < 0 ? x : x + S.abutmentWingLength;
        box(o, 'concrete', [a, -8, z - 0.18], [b, roadY(x) - 0.2, z + 0.18]);
      }
      partEvidence.push({ id: `whole-bank-abutment-${i}`, station: x });
    } else {
      if (lod > 0 || main)
        box(
          o,
          'concrete',
          [x - (main ? 2.2 : 1.2), capBottom, -(main ? 4.8 : 4.6)],
          [x + (main ? 2.2 : 1.2), capTop, main ? 4.8 : 4.6],
        );
      if (main || lod === 0) {
        box(
          o,
          'pier',
          [
            x - (main ? S.mainPierWidthAlong : S.approachPierWidthAlong) / 2,
            base,
            -S.mainPierWidthAcross / 2,
          ],
          [
            x + (main ? S.mainPierWidthAlong : S.approachPierWidthAlong) / 2,
            lod === 0 && !main ? capTop : capBottom,
            S.mainPierWidthAcross / 2,
          ],
        );
      } else {
        for (const z of S.approachColumnCenters)
          box(
            o,
            'pier',
            [x - S.approachPierWidthAlong / 2, base, z - S.approachColumnWidthAcross / 2],
            [x + S.approachPierWidthAlong / 2, capBottom, z + S.approachColumnWidthAcross / 2],
          );
      }
      if (lod >= 2) {
        for (const z of main ? [-2.8, 0, 2.8] : B.approachGirderOffsets)
          box(o, 'iron', [x - 0.45, capTop, z - 0.32], [x + 0.45, girderBottom, z + 0.32]);
      }
    }
    const bottom = main ? P.foundationBottomY : base - S.footingHeight;
    if (lod > 0 || main)
      box(o, 'concrete', [x - footA / 2, bottom, -footZ / 2], [x + footA / 2, base, footZ / 2]);
    supportEvidence.push({
      id: `support-${i}`,
      station: x,
      main,
      end,
      shaftPoint: [
        x,
        base + 0.5,
        main
          ? S.mainPierWidthAcross / 2
          : S.approachColumnCenters[1] + S.approachColumnWidthAcross / 2,
      ],
      capTop,
      capBottom,
      bearingTop: girderBottom,
      footingBottom: bottom,
    });
  }
  partEvidence.push({
    id: 'all20-support-groups-and-two-intrinsic-bank-abutments',
    supports: S.stations.length,
  });
}
function balustrades(o, lod) {
  const R = P.railing,
    pitch = R.pitch * [0, 8, 2, 1][lod],
    xs = samples(B.s0, B.s1, [2, 8, 40, 80][lod]);
  for (const sign of [-1, 1]) {
    const z = sign * (B.overallWidth / 2 - R.inset),
      base = (x) => roadY(x) + B.sidewalkTopOffset;
    strip(
      o,
      'concrete',
      xs,
      z - R.postDepth / 2,
      z + R.postDepth / 2,
      (x) => base(x) + R.baseHeight,
      base,
    );
    strip(
      o,
      'concrete',
      xs,
      z - R.postDepth / 2 - 0.025,
      z + R.postDepth / 2 + 0.025,
      (x) => base(x) + R.height,
      (x) => base(x) + R.height - R.topThickness,
    );
    if (lod === 0) {
      for (const x of [B.s0, B.s1])
        box(o, 'concrete', [x - 0.1, base(x), z - 0.11], [x + 0.1, base(x) + R.height, z + 0.11]);
      continue;
    }
    for (let x = B.s0; x <= B.s1 + 0.001; x += pitch) {
      box(
        o,
        'concrete',
        [x - R.postWidth / 2, base(x) + R.baseHeight, z - R.postDepth / 2],
        [x + R.postWidth / 2, base(x) + R.height, z + R.postDepth / 2],
      );
      if (lod === 3) {
        box(
          o,
          'concrete',
          [x - 0.14, base(x) + R.height - 0.03, z - 0.15],
          [x + 0.14, base(x) + R.height + 0.02, z + 0.15],
        );
      }
      if (x + pitch < B.s1)
        railingEvidence.push({
          id: `actual-open-balustrade-${sign}-${x}`,
          point: [x + pitch * 0.5, base(x + pitch * 0.5) + 0.58, z],
          normal: [0, 0, sign],
        });
    }
  }
  partEvidence.push({
    id: 'whole-two-open-concrete-balustrades',
    logicalPitch: R.pitch,
    representedPitch: lod === 0 ? 'rails-only' : pitch,
  });
}
function tube(o, path, r, N) {
  const rings = path.map((p, i) => {
    const prev = path[Math.max(0, i - 1)],
      next = path[Math.min(path.length - 1, i + 1)],
      axis = next.map((v, k) => v - prev[k]),
      D = Math.hypot(...axis);
    for (let k = 0; k < 3; k++) axis[k] /= D;
    const across = [1, 0, 0],
      other = [0, axis[2], -axis[1]];
    return Array.from({ length: N }, (_, j) => {
      const a = (-j * Math.PI * 2) / N;
      return p.map((v, k) => v + r * (across[k] * Math.cos(a) + other[k] * Math.sin(a)));
    });
  });
  loft(o, 'iron', rings, C.iron, { cap: activeLod > 0 });
}
function lamps(o, lod) {
  const L = P.lamps;
  for (let i = 0, x = L.start; x <= L.end; x += L.pitch, i++) {
    const sign = i % 2 ? -1 : 1,
      z = sign * L.baseOffset,
      Y = roadY(x) + 0.2,
      path = [
        [x, Y, z],
        [x, Y + L.verticalHeight, z],
      ];
    const count = [1, 2, 4, 8][lod];
    for (let j = 1; j <= count; j++) {
      const a = (j * Math.PI) / 2 / count;
      path.push([
        x,
        Y + L.verticalHeight + (L.poleHeight - L.verticalHeight) * Math.sin(a),
        z - sign * L.armReach * (1 - Math.cos(a)),
      ]);
    }
    tube(o, path, L.shaftRadius, [3, 4, 6, 8][lod]);
    const q = path.at(-1);
    if (lod > 0) {
      box(
        o,
        'iron',
        [q[0] - 0.12, q[1] - 0.11, q[2] - 0.4],
        [q[0] + 0.12, q[1] + 0.04, q[2] + 0.4],
      );
      face(
        o,
        'lens',
        [
          [q[0] - 0.1, q[1] - 0.115, q[2] - 0.37],
          [q[0] + 0.1, q[1] - 0.115, q[2] - 0.37],
          [q[0] + 0.1, q[1] - 0.115, q[2] + 0.37],
          [q[0] - 0.1, q[1] - 0.115, q[2] + 0.37],
        ],
        [0, -1, 0],
      );
    }
    lampEvidence.push({ id: `curved-lamp-${i}`, base: [x, Y, z], head: q });
  }
  partEvidence.push({
    id: 'whole-curved-alternating-streetlamp-sequence',
    count: lampEvidence.length,
  });
}
function cables(o, lod) {
  if (lod < 2) return;
  for (const z of P.prestress.visibleSideOffsets)
    for (let i = 1; i < P.prestress.anchorStations.length; i++) {
      const a = P.prestress.anchorStations[i - 1],
        b = P.prestress.anchorStations[i],
        points = samples(a, b, 2).map((x) => [x, roadY(x) - depth(x) * 0.68, z]);
      for (let j = 1; j < points.length; j++)
        beam(
          o,
          'iron',
          points[j - 1],
          points[j],
          P.prestress.cableDiameter,
          P.prestress.cableDiameter,
          C.iron,
        );
      if (lod === 3)
        for (const x of [a, b])
          box(
            o,
            'iron',
            [x - 0.22, roadY(x) - depth(x) * 0.68 - 0.18, z - 0.08],
            [x + 0.22, roadY(x) - depth(x) * 0.68 + 0.18, z + 0.08],
          );
    }
  partEvidence.push({
    id: 'representative-2000-external-prestress-following-main-haunch',
    estimatedExactLayout: true,
  });
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
    hingeEvidence,
  ])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  roadDeck(o, lod);
  mainGirder(o, lod);
  approaches(o, lod);
  supports(o, lod);
  balustrades(o, lod);
  lamps(o, lod);
  cables(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/6y/6yy/juscelino_kubitschek_de_oliveira_bridge',
  cam = (p) => toWorld(p),
  camera = cam([385, 145, -355]),
  look = cam([0, -1, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Juscelino Kubitschek de Oliveira Bridge (2008)',
  cell: '6y/6yy',
  wikidataId: 'Q1684949',
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
  portableGroundY: -21,
  mediumFiContext: {
    scale: 1,
    groundY: -21,
    far: 6000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole533m-old-crossing-main-haunch-and-all-approaches',
      position: camera,
      lookAt: look,
    },
    {
      name: 'whole-reverse-underside-bank-piers-and-approaches',
      position: cam([-365, 125, 335]),
      lookAt: look,
    },
    {
      name: 'whole-main140m-free-span-53m-flanks-and-parabolic-caisson',
      position: cam([0, 15, -188]),
      lookAt: cam([0, -2, 0]),
    },
    {
      name: 'roadway-widened-sidewalk-open-balustrade-and-curved-lamps',
      position: cam([-158, 7.6, 5]),
      lookAt: cam([-78, 8, 0]),
    },
    {
      name: 'three-web-two-cell-understructure-bank-bearing-and-haunch',
      position: cam([-98, -7, -26]),
      lookAt: cam([-62, -2, 0]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-old-jk-oliveira-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. ExactalreadyclearedpublishedFernandoSantosCunhaFilho2008ownCC0original andsamecreatoroppositeCC0original/SHA1s/nativegrants bound. OSMODbLold2024-12-01whole3controlbridgeway153919252/Q1684949, distinctnew2025replacement1460511387/collapseeventQ131560959/separaterailwayQ10351330. ABECE2025RobertoChustCarvalho primaryengineeringtextfacts only: whole533m/12.10mwidth/8.20mroad/140central+53mflanks/15–20mapproaches/three-webcaisson/parabolic3.4–8mheight. Protectedjournalphotos/drawings neverrenderedoradopted. Exactapproachcensus/piersections/haunchregistration/footings/cablearrangement/grade estimated; primary256mprosevs246msumdiscrepancyexplicit. No sourceimageryrepair/phototextures/generatedbitmap/landscape/vehicles/people/signlettering.',
};
