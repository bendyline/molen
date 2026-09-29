/** Eshima Ohashi: measured rigid-frame spans on its mapped, curved road alignment. */
import { beam, chamferedRectangle, loft, normalFor } from './authored-structure-mesh.mjs';
import { quad, tube } from './structure-mesh.mjs';

const L = 1446.2;
// OSM highway86979974 in the exact-QID bridge frame, with measured arc stations.
const alignment = [
  [0, -715.561, 47.281],
  [197.278, -519.133, 28.984],
  [350.631, -366.293, 16.46],
  [978.151, 258.231, -44.793],
  [1014.633, 294.67, -46.551],
  [1040.133, 320.15, -45.539],
  [1061.231, 341.025, -42.479],
  [1095.265, 374.334, -35.495],
  [1130.767, 408.819, -27.057],
  [1444.934, 714.371, 46.013],
];
const concrete = [0.79, 0.79, 0.735],
  pale = [0.86, 0.855, 0.79];
const metal = [0.78, 0.79, 0.76],
  dark = [0.14, 0.16, 0.17];
const center = 681.2;
// The inspection diagram gives A1=5.2m, A2=7.7m and a44.7m maximum.
// Solve a parabolic transition tangent to the published6.1/5.1% approaches.
const intersection = (7.7 + L * 0.051 - 5.2) / 0.112;
const crestLength = (2 * 0.112 * (5.2 + 0.061 * intersection - 44.7)) / (0.061 * 0.051);
const crestRadius = crestLength / 0.112;
const leftCrest = intersection - crestLength / 2,
  rightCrest = intersection + crestLength / 2,
  summit = leftCrest + 0.061 * crestRadius;
export const eshimaDeckHeight = (s) => {
  if (s < leftCrest) return 5.2 + s * 0.061;
  if (s > rightCrest) return 7.7 + (L - s) * 0.051;
  return 44.7 - (s - summit) ** 2 / (2 * crestRadius);
};
function path(s) {
  const distance = (Math.max(0, Math.min(L, s)) * alignment.at(-1)[0]) / L;
  let i = 1;
  while (i < alignment.length - 1 && alignment[i][0] < distance) i++;
  const a = alignment[i - 1],
    b = alignment[i],
    t = (distance - a[0]) / (b[0] - a[0]);
  const length = Math.hypot(b[1] - a[1], b[2] - a[2]);
  return {
    x: a[1] + t * (b[1] - a[1]),
    z: a[2] + t * (b[2] - a[2]),
    nx: -(b[2] - a[2]) / length,
    nz: (b[1] - a[1]) / length,
  };
}
function p(s, y, z, relative = true) {
  const f = path(s);
  return [f.x + z * f.nx, y + (relative ? eshimaDeckHeight(s) : 0), f.z + z * f.nz];
}
function depth(s) {
  if (s < 351.2 || s > 1011.2) return s < 60 || s > 1356.2 ? 1.25 : 2.25;
  if (s <= 406.2) return 2.25 + (0.75 * (s - 351.2)) / 55;
  if (s < 556.2) return 3 + 12.5 * ((s - 406.2) / 150) ** 2;
  if (s <= 806.2) return 4.3 + 11.2 * (Math.abs(s - center) / 125) ** 2;
  if (s < 956.2) return 3 + 12.5 * ((956.2 - s) / 150) ** 2;
  return 2.25 + (0.75 * (1011.2 - s)) / 55;
}
function extension(s) {
  for (const [station, side] of [
    [556.2, -1],
    [806.2, 1],
  ]) {
    const d = Math.abs(s - station);
    if (d <= 14) return [side, 4];
    if (d < 20) return [side, (4 * (20 - d)) / 6];
  }
  return [0, 0];
}
function edge(s, side) {
  const [e, width] = extension(s);
  return side * (5.65 + (e === side ? width : 0));
}
function roadEdge(s, side) {
  const [e, width] = extension(s);
  return side * (3.75 + (e === side ? width * 0.625 : 0));
}
function polygon(out, slot, points, tint) {
  quad(out, slot, points, normalFor(...points), tint);
}
function ribbon(out, slot, from, to, y, z0, z1, tint, step = 2) {
  const n = Math.ceil((to - from) / step);
  const atZ = (z, s) => (typeof z === 'function' ? z(s) : z);
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / n,
      b = from + ((to - from) * (i + 1)) / n;
    polygon(
      out,
      slot,
      [p(a, y, atZ(z0, a)), p(a, y, atZ(z1, a)), p(b, y, atZ(z1, b)), p(b, y, atZ(z0, b))],
      tint,
    );
  }
}
function block(out, slot, from, to, y0, y1, z0, z1, tint, relative = true) {
  const ring = (s) => [
    p(s, y1, z0, relative),
    p(s, y1, z1, relative),
    p(s, y0, z1, relative),
    p(s, y0, z0, relative),
  ];
  loft(out, slot, [ring(from), ring(to)], tint);
}
function rail(out, a, b, radius = 0.032, tint = metal, slot = 'iron', sides = 10) {
  tube(out, slot, a, b, radius, tint, sides);
}
const supports = [
  0, 20, 40, 60, 94.8, 129.6, 164.4, 199.2, 237.2, 275.2, 313.2, 351.2, 406.2, 556.2, 806.2, 956.2,
  1011.2, 1051.2, 1091.2, 1131.2, 1171.2, 1211.2, 1251.2, 1286.2, 1321.2, 1356.2, 1386.2, 1416.2,
  1446.2,
];
function pier(out, s, main) {
  const top = eshimaDeckHeight(s) - depth(s),
    f = path(s);
  const ring = (y, width, across) =>
    chamferedRectangle(0, y, 0, width, across, main ? 0.6 : 0.3).map(([x, h, z]) => [
      f.x + x * f.nz + z * f.nx,
      h,
      f.z - x * f.nx + z * f.nz,
    ]);
  if (main) {
    const shaftTop = eshimaDeckHeight(s) - 0.39;
    // The rounded pier is exposed through the full girder height, up to the deck soffit.
    const oval = (y, delta = 0) =>
      Array.from({ length: 64 }, (_, i) => {
        const a = (-i * Math.PI * 2) / 64;
        const x = (3.5 + delta) * Math.cos(a),
          z = (7.5 - (2.4 * y) / shaftTop + delta) * Math.sin(a);
        return [f.x + x * f.nz + z * f.nx, y, f.z - x * f.nx + z * f.nz];
      });
    loft(out, 'concrete', [oval(0), oval(shaftTop)], concrete);
    loft(out, 'iron', [oval(0.1, 0.22), oval(0.85, 0.22)], [0.18, 0.38, 0.32]);
    // Horizontal casting lifts and recessed form-tie patterns are individually visible up close.
    for (let y = 2; y < shaftTop - 0.5; y += 2.5) {
      loft(out, 'concrete', [oval(y, 0.008), oval(y + 0.025, 0.008)], [0.57, 0.59, 0.56], {
        cap: false,
      });
    }
    for (let y = 1.8; y < shaftTop - 1; y += 2.5)
      for (const side of [-1, 1])
        for (let x = -2.5; x <= 2.5; x += 1.25) {
          const z = side * (7.5 - (2.4 * y) / shaftTop) * Math.sqrt(1 - (x / 3.5) ** 2);
          rail(
            out,
            p(s + x, y, z, false),
            p(s + x, y, z + side * 0.014, false),
            0.035,
            [0.56, 0.57, 0.53],
            'concrete',
            8,
          );
        }
  } else {
    const h = Math.max(0.4, top - 1.5);
    loft(
      out,
      'concrete',
      [ring(0, 2.45, 4.8), ring(h, 2.1, 4.2), ring(top - 0.25, 2.7, 9.6), ring(top, 2.7, 9.6)],
      concrete,
    );
    for (const side of [-1, 1])
      block(
        out,
        'iron',
        s - 0.65,
        s + 0.65,
        top - 0.01,
        top + 0.15,
        side * 2.2 - 0.5,
        side * 2.2 + 0.5,
        [0.22, 0.24, 0.25],
        false,
      );
  }
}
function light(out, s, side) {
  const z = edge(s, side) - side * 0.26;
  block(out, 'iron', s - 0.2, s + 0.2, 0.22, 0.32, z - 0.2, z + 0.2, metal);
  const base = p(s, 0.31, z),
    top = p(s, 8.7, z);
  rail(out, base, top, 0.075, metal, 'iron', 16);
  rail(out, p(s, 0.34, z), p(s, 1.8, z), 0.11, metal, 'iron', 16);
  const elbow = p(s, 9.05, z - side * 0.3),
    head = p(s, 8.85, z - side * 1.85);
  rail(out, top, elbow, 0.06);
  rail(out, elbow, head, 0.055);
  block(
    out,
    'iron',
    s - 0.16,
    s + 0.16,
    8.75,
    8.97,
    z - side * 1.85 - 0.55,
    z - side * 1.85 + 0.55,
    metal,
  );
  ribbon(
    out,
    'marking',
    s - 0.14,
    s + 0.14,
    8.744,
    z - side * 1.85 - 0.49,
    z - side * 1.85 + 0.49,
    [0.93, 0.91, 0.76],
  );
  for (const dx of [-0.13, 0.13])
    for (const dz of [-0.13, 0.13])
      rail(out, p(s + dx, 0.315, z + dz), p(s + dx, 0.35, z + dz), 0.023, dark, 'iron', 8);
}
function navigationMarks(out) {
  const red = [0.76, 0.12, 0.1],
    white = [0.97, 0.96, 0.91];
  for (const side of [-1, 1]) {
    // Published contractor photograph shows the central white/red disc and38M clearance.
    const z = side * 3.19;
    const disk = Array.from({ length: 64 }, (_, i) => {
      const a = (i * Math.PI * 2) / 64;
      return p(center + 0.85 * Math.cos(a), -1.5 + 0.85 * Math.sin(a), z);
    });
    if (side < 0) disk.reverse();
    out.addConvexPolygon(
      'marking',
      'palette:#ffffff',
      disk,
      normalFor(...disk),
      (p) => [p[0], p[1]],
      white,
    );
    for (const dx of [-0.38, 0, 0.38]) {
      const h = Math.sqrt(0.85 ** 2 - (Math.abs(dx) + 0.065) ** 2);
      block(
        out,
        'marking',
        center + dx - 0.065,
        center + dx + 0.065,
        -1.5 - h,
        -1.5 + h,
        z - 0.015,
        z + 0.015,
        red,
      );
    }
    rail(out, p(center, -0.32, side * 3.24), p(center, -2.4, side * 3.24), 0.05, metal);
    const glyphs = [
      [
        [0, 0],
        [0.75, 0],
        [0.75, 0.65],
        [0.15, 0.65],
        [0.75, 0.65],
        [0.75, 1.3],
        [0, 1.3],
      ],
      [
        [0, 0],
        [0.75, 0],
        [0.75, 1.3],
        [0, 1.3],
        [0, 0],
        [0, 0.65],
        [0.75, 0.65],
      ],
      [
        [0, 0],
        [0, 1.3],
        [0.4, 0.7],
        [0.8, 1.3],
        [0.8, 0],
      ],
    ];
    for (let i = 0; i < 3; i++)
      for (let k = 1; k < glyphs[i].length; k++) {
        const a = glyphs[i][k - 1],
          b = glyphs[i][k];
        beam(
          out,
          'marking',
          p(center + side * (i * 1.05 + a[0] - 1.4), -3.7 + a[1], side * 3.22),
          p(center + side * (i * 1.05 + b[0] - 1.4), -3.7 + b[1], side * 3.22),
          0.12,
          0.035,
          red,
        );
      }
    for (const [offset, kind] of [
      [-65, 'square'],
      [65, 'triangle'],
    ]) {
      const station = center + side * offset;
      const points = (
        kind === 'square'
          ? [
              [-0.6, -0.6],
              [0.6, -0.6],
              [0.6, 0.6],
              [-0.6, 0.6],
            ]
          : [
              [-0.7, -0.5],
              [0.7, -0.5],
              [0, 0.7],
            ]
      ).map(([x, y]) => p(station + x, -1.5 + y, side * 3.22));
      if (side < 0) points.reverse();
      out.addConvexPolygon(
        'marking',
        'palette:#ffffff',
        points,
        normalFor(...points),
        (p) => [p[0], p[1]],
        kind === 'square' ? [0.15, 0.48, 0.26] : red,
      );
    }
  }
}
export function buildEshima(out) {
  const samples = new Set([0, L, ...supports, leftCrest, center, rightCrest]);
  for (let s = 0; s < L; s += 2) samples.add(s);
  for (const station of [556.2, 806.2])
    for (const d of [-20, -14, 14, 20]) samples.add(station + d);
  const stations = [...samples].sort((a, b) => a - b);
  const rings = stations.map((s) => {
    const d = depth(s);
    return [
      [0, edge(s, -1)],
      [0, edge(s, 1)],
      [-0.375, edge(s, 1)],
      [-0.75, 3.15],
      [-d, 3.15],
      [-d, -3.15],
      [-0.75, -3.15],
      [-0.375, edge(s, -1)],
    ].map(([y, z]) => p(s, y, z));
  });
  loft(out, 'concrete', rings, concrete, { cap: false });
  // Dark wearing course, lane markings and raised footways follow both grade and plan curvature.
  ribbon(
    out,
    'road',
    0,
    L,
    0.025,
    (s) => roadEdge(s, -1),
    (s) => roadEdge(s, 1),
    [0.15, 0.165, 0.175],
  );
  ribbon(out, 'marking', 0, L, 0.034, -0.07, 0.07, [0.94, 0.59, 0.1]);
  for (const side of [-1, 1]) {
    ribbon(out, 'marking', 0, L, 0.037, side * 3.4 - 0.07, side * 3.4 + 0.07, [0.93, 0.92, 0.84]);
    ribbon(
      out,
      'concrete',
      0,
      L,
      0.17,
      (s) => (side > 0 ? roadEdge(s, 1) : edge(s, -1)),
      (s) => (side > 0 ? edge(s, 1) : roadEdge(s, -1)),
      [0.69, 0.685, 0.64],
    );
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      polygon(
        out,
        'concrete',
        [
          p(a, 0.01, roadEdge(a, side)),
          p(b, 0.01, roadEdge(b, side)),
          p(b, 0.17, roadEdge(b, side)),
          p(a, 0.17, roadEdge(a, side)),
        ][side === 1 ? 'reverse' : 'slice'](),
        pale,
      );
      // Outer parapet curb and steel rails track the small pier-platform widening.
      const za = edge(a, side) - side * 0.2,
        zb = edge(b, side) - side * 0.2;
      for (const h of [0.32, 0.6, 0.95, 1.34])
        rail(out, p(a, h, za), p(b, h, zb), h === 1.34 ? 0.048 : 0.035);
      polygon(
        out,
        'concrete',
        [
          p(a, -0.37, edge(a, side)),
          p(b, -0.37, edge(b, side)),
          p(b, 0.22, edge(b, side)),
          p(a, 0.22, edge(a, side)),
        ][side === -1 ? 'reverse' : 'slice'](),
        pale,
      );
    }
    for (let s = 0.65; s < L; s += 2) {
      const z = edge(s, side) - side * 0.2;
      block(out, 'iron', s - 0.12, s + 0.12, 0.17, 0.24, z - 0.12, z + 0.12, metal);
      beam(out, 'iron', p(s, 0.23, z), p(s, 1.34, z), 0.09, 0.09, [0.22, 0.37, 0.32]);
      // Open vertical infill, approximately0.2m apart; no opaque guardrail texture.
      for (let d = 0.2; d < 1.95 && s + d < L; d += 0.2)
        rail(
          out,
          p(s + d, 0.32, edge(s + d, side) - side * 0.2),
          p(s + d, 0.95, edge(s + d, side) - side * 0.2),
          0.016,
          [0.25, 0.36, 0.33],
          'iron',
          8,
        );
    }
    // Concrete movement joints, drain scuppers and drainpipes.
    for (let s = 4; s < L; s += 4)
      ribbon(
        out,
        'concrete',
        s,
        s + 0.028,
        0.176,
        side > 0 ? roadEdge(s, 1) + 0.03 : edge(s, -1) + 0.23,
        side > 0 ? edge(s, 1) - 0.23 : roadEdge(s, -1) - 0.03,
        [0.46, 0.47, 0.44],
        1,
      );
    for (let s = 14; s < L; s += 24) {
      const drainZ = roadEdge(s, side) + side * 0.23;
      block(out, 'iron', s - 0.23, s + 0.23, 0.178, 0.195, drainZ - 0.15, drainZ + 0.15, dark);
      for (let g = -0.18; g < 0.2; g += 0.06)
        rail(
          out,
          p(s + g, 0.2, drainZ - 0.14),
          p(s + g, 0.2, drainZ + 0.14),
          0.015,
          metal,
          'iron',
          6,
        );
      rail(
        out,
        p(s, -0.6, side * 3.17),
        p(s, -depth(s) - 0.5, side * 3.17),
        0.07,
        [0.47, 0.49, 0.47],
      );
    }
    for (let s = side === -1 ? 17 : 40; s < L - 10; s += 46) light(out, s, side);
  }
  for (const s of supports.slice(1, -1))
    pier(out, s, Math.abs(s - 556.2) < 1 || Math.abs(s - 806.2) < 1);
  for (const [a, b] of [
    [0, 2.2],
    [L - 2.2, L],
  ]) {
    block(
      out,
      'concrete',
      a,
      b,
      0,
      eshimaDeckHeight((a + b) / 2) - 0.1,
      -5.65,
      5.65,
      concrete,
      false,
    );
  }
  for (const [station, side] of [
    [556.2, -1],
    [806.2, 1],
  ]) {
    for (let s = station - 13.5; s < station + 14; s += 2.5) {
      beam(
        out,
        'concrete',
        p(s, -1.25, side * 3.2),
        p(s, -0.53, edge(s, side) - side * 0.15),
        0.22,
        0.42,
        concrete,
      );
      const a = p(s, 0.23, edge(s, side) - side * 0.2),
        b = p(s + 2.45, 0.23, edge(s + 2.45, side) - side * 0.2);
      const points = [
        a,
        b,
        b.map((v, i) => v + (i === 1 ? 1.45 : 0)),
        a.map((v, i) => v + (i === 1 ? 1.45 : 0)),
      ];
      polygon(out, 'glass', points, [0.46, 0.7, 0.72]);
      polygon(out, 'glass', [...points].reverse(), [0.46, 0.7, 0.72]);
      beam(
        out,
        'iron',
        a,
        a.map((v, i) => v + (i === 1 ? 1.6 : 0)),
        0.07,
        0.07,
        [0.2, 0.37, 0.33],
      );
    }
  }
  // Cast-in-place segment divisions and shallow panel/tie details on the massive box webs.
  for (let s = 410.7; s < 952; s += 4.5) {
    const d = depth(s);
    for (const side of [-1, 1]) {
      rail(
        out,
        p(s, -0.76, side * 3.159),
        p(s, -d + 0.06, side * 3.159),
        0.018,
        [0.57, 0.59, 0.555],
        'concrete',
        6,
      );
      for (let y = 1.55; y < d - 0.5; y += 1.25)
        for (const dx of [-1.3, 0, 1.3])
          rail(
            out,
            p(s + dx, -y, side * 3.151),
            p(s + dx, -y, side * 3.169),
            0.027,
            [0.6, 0.6, 0.55],
            'concrete',
            8,
          );
    }
  }
  for (const s of [60, 199.2, 351.2, center, 1011.2, 1131.2, 1251.2, 1356.2]) {
    const half = s === center ? 0.42 : 0.08;
    ribbon(out, 'iron', s - half, s + half, 0.044, -5.4, 5.4, metal, 0.15);
    ribbon(out, 'iron', s - half * 0.4, s + half * 0.4, 0.046, -3.75, 3.75, dark, 0.15);
    for (let z = -3.6; z < 3.6; z += 0.18)
      block(out, 'iron', s - half, s + half, 0.048, 0.057, z, z + 0.07, metal);
    if (s === center)
      for (const side of [-1, 1]) {
        block(
          out,
          'iron',
          s - 0.55,
          s + 0.55,
          0.32,
          1.02,
          side * 5.4 - 0.018,
          side * 5.4 + 0.018,
          metal,
        );
        for (const h of [0.6, 0.95, 1.34])
          rail(out, p(s - 0.5, h, side * 5.45), p(s + 0.5, h, side * 5.45), 0.065);
      }
  }
  navigationMarks(out);
}
export const eshimaStudy = {
  id: 'N0006',
  key: 'eshima_ohashi_bridge',
  title: 'Eshima Ohashi Bridge',
  wikidataId: 'Q11550847',
  build: buildEshima,
  brief:
    'Measured five-span prestressed-concrete rigid frame with deep tapered box girders, unequal road grades, curved Tottori approach, repeated viaduct piers, pedestrian rails, maintenance bays and road fittings.',
  refs: [
    'https://www.smcon.co.jp/service/assets/uploads/pc-sekei/PCN066.pdf',
    'https://www.pa.cgr.mlit.go.jp/sakai/index.html@p=1688.html',
    'https://sakai-port.com/files/libs/8066/202510171154461540.pdf',
    'https://www.tottori-guide.jp/tourism/tour/view/996',
    'https://kankou-daikonshima.jp/tourist_info/eshima_bridge',
    'https://www.jst.go.jp/sip/event/k07/pdf/k07_event20180719_2-6.pdf',
    'https://www.jstage.jst.go.jp/article/prooe1986/20/0/20_0_941/_pdf/-char/ja',
    'https://www.smcon.co.jp/sp/hashi-girl/2014/02/07/898/',
  ],
  sourceFacts: {
    bridgeLengthMeters: L,
    mainLengthMeters: 660,
    mainSpansMeters: [55, 150, 250, 150, 55],
    shimaneApproachMeters: 351.2,
    tottoriApproachMeters: 435,
    shimaneApproachSpansMeters: [20, 20, 20, 34.8, 34.8, 34.8, 34.8, 38, 38, 38, 38],
    tottoriApproachSpansMeters: [40, 40, 40, 40, 40, 40, 35, 35, 35, 30, 30, 30],
    normalWidthMeters: 11.3,
    supportSectionWidthMeters: 15.3,
    footwayWidthMeters: 1.5,
    centralRoadwayWithShouldersMeters: 7.5,
    mainPierWidthAlongMeters: 7,
    mainPierWidthAcrossMeters: 10.2,
    pierGirderDepthMeters: 15.5,
    centralHingeGirderDepthMeters: 4.3,
    mainBoxWidthMeters: 6.3,
    publishedMaximumHeightMeters: 44.7,
    shimaneGrade: 0.061,
    tottoriGrade: 0.051,
    evidence:
      'SMC PC Design News66 measured elevation/plan/sections and MLIT main bridge diagram; 2025 port-authority inspection general elevation supplies all approach spans. Official tourism photographs establish the finished road exterior.',
  },
  reconstruction: {
    mappedCenterlineLengthMeters: 1444.934,
    engineeringStationScale: 1444.934 / L,
    supportsMeters: supports,
    heightAtCrest: 44.7,
    crestStationMeters: summit,
    centralHingeStationMeters: center,
    crestCurveLengthMeters: crestLength,
    publishedDeckStations: [
      [0, 5.2],
      [406.2, 30],
      [556.2, 39.2],
      [806.2, 40.4],
      [956.2, 32.8],
      [L, 7.7],
    ],
    reconstructedMainPierBaseWidthAcrossMeters: 15,
    nativeCenterline: alignment,
    notes:
      'Road height fits published5.2/7.7m end levels and44.7m maximum with verified6.1/5.1% grades and a solved parabolic crest; intermediate inspected station heights agree within0.12m. Girder intrados interpolates measured15.5m/4.3m sections. Rounded main piers taper from a reconstructed15m base to the10.2m plan width and remain exposed up through the girder to the widened deck, as shown in contractor photographs. Opposite-side emergency bays, support ribs, blue wind screens, rail details, expansion hardware, casting joints, approach pier sections and lamps are photographic reconstructions. OSM highway arc is1.266m shorter than engineering total and is retained for geographic fit.',
  },
  nativeAxes: {
    x: 'southwest/Shimane to northeast/Tottori in exact-QID map frame',
    y: 'up; Y0 is provisional Nakaumi sea-level water surface',
    z: 'southeast side of the crossing; curved approach is encoded directly',
  },
  geographic: (m) => ({
    anchor: m.anchor,
    heading: m.heading,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    notes:
      'Exact bridge way1081414506/Q11550847 and road86979974 fix the full curved centerline. Native +X goes from Shimane6.1% grade to Tottori5.1% grade. Y0 is provisional local Nakaumi water surface at0m; road crest44.7m. Actual tide, precise datum and adjacent embankment heights remain host/site dependent.',
  }),
  limitations: [
    'Original detailed exterior reconstruction, not fabrication geometry. Measured span and section dimensions constrain the structural silhouette; crest transition and small fittings are reconstructed.',
    'The bridge is modeled in its operating form. Temporary work platforms, construction machinery, buried foundation caissons, underwater piers and adjoining roads beyond the1446.2m bridge are omitted.',
    'Nakaumi water elevation is provisionally0m in the viewer; source tourist height is treated as road crest and is not a surveyed absolute vertical datum.',
    'Maintenance bay side/length, lamps, drain hardware, rail infill spacing, asphalt color and minor weathering follow available photographs rather than a current inspection inventory.',
  ],
  camera: { position: [235, 85, 260], lookAt: [-39, 29, -15], fov: 48 },
  qaCameras: [
    { name: 'main-rigid-frame', position: [-45, 45, 340], lookAt: [-40, 22, -14], fov: 46 },
    { name: 'shimane-road-grade', position: [-440, 25, 23], lookAt: [-25, 42, -16], fov: 34 },
    { name: 'main-pier-box-web', position: [-125, 18, 34], lookAt: [-162, 27, -5], fov: 48 },
    { name: 'pedestrian-rail', position: [-88, 46, -23], lookAt: [-59, 44, -19], fov: 55 },
    { name: 'maintenance-bay', position: p(840, 11, 30), lookAt: p(806.2, 0, 4), fov: 50 },
    { name: 'bay-supports', position: p(827, -9, 26), lookAt: p(806.2, -2, 6), fov: 48 },
    { name: 'center-expansion-joint', position: p(670, 5, 9), lookAt: p(center, 0, 0), fov: 48 },
    { name: 'curved-tottori-approach', position: [532, 90, 172], lookAt: [342, 26, -42], fov: 50 },
    { name: 'whole-elevation', position: [0, 52, 1320], lookAt: [0, 23, 0], fov: 59 },
  ],
};
