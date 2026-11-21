import { readFileSync } from 'node:fs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
  up,
  xz,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.86),
  carving: surface('trim', 'stone_marble', 0.78),
  lead: surface('roof', 'metal_painted', 0.63, 0.24),
  terracotta: surface('roof', 'tile_flat', 0.83),
  copper: surface('trim', 'metal_painted', 0.63, 0.21),
  floor: surface('foundation', 'stone_limestone_raw', 0.86),
  glazing: surface('window', 'window_punched', 0.57, 0.04),
  dark: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
};

const C = palette({
  stone: 'c5b099',
  facade: 'cfbaa3',
  limestone: 'd6cab4',
  recess: 'a09180',
  pale: 'ddd4c4',
  foundation: 'aa9e88',
  lead: '8c908f',
  leadDark: '757b7d',
  copper: '63867a',
  brass: 'a08854',
  dark: '3d3a37',
  door: '575048',
  window: '596467',
  terra: 'ac8069',
  sacristy: 'c8ae99',
  steps: 'b9b0a1',
});
const floor = 2.6;

function stoneMass(out, p, low, high, color = C.stone, roof = C.terra, selected) {
  shell(
    out,
    p,
    typeof low === 'number' ? () => low : low,
    high,
    { wall: 'stone', color, roof: 'terracotta', roofColor: roof },
    selected,
  );
}

function turned(out, slot, center, profile, sides, color) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center)),
    color,
  );
}

function ribs(out, center, profile, count, width, color, solid) {
  for (let i = 0; i < count; i++) {
    const dir = (i * Math.PI * 2) / count;
    const c = Math.cos(dir),
      s = Math.sin(dir);
    const point = (y, r, t = 0) => [
      center[0] + (r + 0.115) * c - t * s,
      y,
      center[1] + (r + 0.115) * s + t * c,
    ];
    if (solid) {
      beamPath(
        out,
        'carving',
        profile.map(([y, r]) => point(y, r)),
        width,
        width * 0.78,
        color,
      );
      continue;
    }
    const half = width * 0.5;
    for (const [[y, p], [h, q]] of pairs(profile))
      face(
        out,
        'carving',
        [point(y, p, -half), point(y, p, half), point(h, q, half), point(h, q, -half)],
        [c, 0, s],
        color,
      );
  }
}

function domeAndLantern(out, controls, lod) {
  const { parts, domeRadius: r, overallHeight } = controls;
  const profile = [
    [76.5, r],
    [80.45, r - 0.2],
    [86.62, r - 1.73],
    [92.32, r - 4.51],
    [98.8, r - 8.52],
    [104.25, r - 14.12],
    [108.69, r - 20.33],
    [111.08, r - 25.8],
    [111.61, 3.3],
  ];
  if (lod < 2) {
    const n = lod === 0 ? 9 : 20;
    const curve = lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile;
    turned(
      out,
      'stone',
      [0, 0],
      [
        [54, 32.2],
        [60, 32.2],
        [76.5, r],
      ],
      n,
      C.stone,
    );
    turned(out, 'lead', [0, 0], curve, n, C.lead);
    turned(
      out,
      'carving',
      [0, 0],
      [
        [111, 6.2],
        [118, 6.05],
        [125, 4.82],
        [132.6, 0.7],
        [overallHeight, 0.12],
      ],
      lod === 0 ? 7 : 12,
      C.limestone,
    );
    if (lod === 1) {
      for (let i = 0; i < 16; i++) {
        const theta = (2 * Math.PI * i) / 16,
          cr = Math.cos(theta),
          sr = Math.sin(theta);
        const w = edge(
          [(r + 0.6) * cr + 1.86 * sr, (r + 0.6) * sr - 1.86 * cr],
          [(r + 0.6) * cr - 1.86 * sr, (r + 0.6) * sr + 1.86 * cr],
          -1,
        );
        panel(out, 'glazing', w, 0, w.length, 64.15, 73.7, 0, C.window);
      }
      ribs(out, [0, 0], curve, 16, 0.54, C.limestone, false);
    }
    return;
  }
  const n = lod === 2 ? 40 : 64;
  stoneMass(out, parts.minorDomes[4], 53.97, 60.22, C.facade, C.leadDark);
  turned(
    out,
    'stone',
    [0, 0],
    [
      [59.9, r + 0.5],
      [62.2, r + 0.57],
      [63.37, r - 0.38],
      [76.25, r - 0.2],
      [77.04, r + 0.48],
    ],
    n,
    C.stone,
  );
  turned(
    out,
    'carving',
    [0, 0],
    [
      [62.45, r + 0.39],
      [63.0, r + 0.39],
    ],
    n,
    C.pale,
  );
  turned(
    out,
    'carving',
    [0, 0],
    [
      [75.39, r + 0.22],
      [76.9, r + 0.51],
    ],
    n,
    C.limestone,
  );
  turned(out, 'lead', [0, 0], profile, n, C.lead);
  ribs(out, [0, 0], profile.slice(0, -1), 16, 0.62, C.limestone, lod === 3);
  for (let i = 0; i < 16; i++) {
    const rad = ((i + 0.5) * Math.PI) / 8;
    const point = (u, y, d) => [
      (r + d) * Math.cos(rad) - u * Math.sin(rad),
      y,
      (r + d) * Math.sin(rad) + u * Math.cos(rad),
    ];
    const dark = [
      point(-1.6, 64.7, 0.15),
      point(1.6, 64.7, 0.15),
      point(1.6, 72.9, 0.15),
      point(0, 74.02, 0.15),
      point(-1.6, 72.9, 0.15),
    ];
    face(out, 'glazing', dark, [Math.cos(rad), 0, Math.sin(rad)], C.window);
    if (lod > 1) {
      for (const offset of [-0.062, 0.062]) {
        const theta = (i * Math.PI) / 8 + offset;
        const base = [(r + 0.18) * Math.cos(theta), (r + 0.18) * Math.sin(theta)];
        turned(
          out,
          'carving',
          base,
          [
            [63.22, 1.09],
            [64.0, 1.05],
            [74.19, 0.87],
            [75.03, 1.14],
          ],
          lod === 3 ? 10 : 6,
          C.pale,
        );
      }
      if (lod === 3)
        beamPath(
          out,
          'carving',
          [
            point(-1.99, 64.44, 0.45),
            point(-1.99, 73.05, 0.45),
            point(0, 74.46, 0.45),
            point(1.99, 73.05, 0.45),
            point(1.99, 64.44, 0.45),
          ],
          0.22,
          0.25,
          C.limestone,
        );
    }
  }
  const l = planarMid(parts.lantern[0]);
  const rn = lod > 1 ? 24 : 14;
  turned(
    out,
    'carving',
    l,
    [
      [110.44, 6.4],
      [112.72, 6.53],
      [114.01, 6.18],
    ],
    rn,
    C.limestone,
  );
  turned(
    out,
    'stone',
    l,
    [
      [113.56, 4.56],
      [121.64, 4.4],
      [122.25, 5.65],
    ],
    rn,
    C.recess,
  );
  for (let i = 0; i < 12; i++) {
    const theta = (2 * Math.PI * i) / 12,
      center = [l[0] + 5.38 * Math.cos(theta), l[1] + 5.38 * Math.sin(theta)];
    turned(
      out,
      'carving',
      center,
      [
        [113.21, 0.62],
        [121.59, 0.51],
        [122.12, 0.7],
      ],
      lod > 1 ? 8 : 5,
      C.pale,
    );
  }
  turned(
    out,
    'carving',
    l,
    [
      [121.93, 5.93],
      [123.67, 5.65],
      [125.09, 4.35],
      [128.69, 2.83],
      [131.55, 0.55],
    ],
    rn,
    C.limestone,
  );
  turned(
    out,
    'copper',
    l,
    [
      [131.39, 0.42],
      [132.02, 0.91],
      [132.95, 1.12],
      [133.42, 0.27],
    ],
    10,
    C.brass,
  );
  block(
    out,
    'copper',
    l[0] - 0.14,
    133.25,
    l[1] - 0.14,
    0.28,
    overallHeight - 133.25,
    0.28,
    C.brass,
  );
  block(out, 'copper', l[0] - 0.92, 134.63, l[1] - 0.12, 1.84, 0.26, 0.24, C.brass);
}

function smallDome(out, center, radius, y, height, lod, copper = false) {
  const n = [6, 12, 16, 20][lod];
  const h = y + height;
  if (lod < 2) {
    turned(
      out,
      copper ? 'copper' : 'lead',
      center,
      [
        [y, radius],
        [y + height * 0.47, radius * 0.9],
        [y + height * 0.89, radius * 0.28],
        [h + 0.45, 0.13],
      ],
      lod === 0 ? 5 : 10,
      copper ? C.copper : C.lead,
    );
    return;
  }

  turned(
    out,
    'stone',
    center,
    [
      [y - 0.03, radius + 0.42],
      [y + height * 0.26, radius],
    ],
    n,
    C.facade,
  );
  turned(
    out,
    copper ? 'copper' : 'lead',
    center,
    [
      [y + height * 0.22, radius],
      [y + height * 0.56, radius * 0.79],
      [y + height * 0.76, radius * 0.52],
      [h - 0.86, radius * 0.21],
    ],
    n,
    copper ? C.copper : C.lead,
  );
  turned(
    out,
    'carving',
    center,
    [
      [h - 0.88, radius * 0.235],
      [h - 0.12, radius * 0.205],
      [h + 0.9, 0.16],
    ],
    n,
    C.pale,
  );
}

function pediment(out, wall, mid, half, bottom, crown, depth, tint) {
  const p = (x, y, d) => wall.p(mid + x, y, d);
  face(
    out,
    'carving',
    [p(-half, bottom, depth), p(half, bottom, depth), p(0, crown, depth)],
    wall.normal,
    tint,
  );
  beamPath(
    out,
    'carving',
    [p(-half, bottom, depth + 0.11), p(0, crown, depth + 0.11), p(half, bottom, depth + 0.11)],
    0.37,
    0.43,
    C.pale,
  );
}

function archTop(half, spring, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => [
    -half * Math.cos((i * Math.PI) / n),
    spring + rise * Math.sin((i * Math.PI) / n),
  ]);
}

function openingArch(out, wall, u, half, sill, spring, peak, recess, lod, slot = 'glazing') {
  const p = (x, y, d) => wall.p(u + x, y, d);
  const arc = archTop(half, spring, peak - spring, lod > 1 ? 12 : 6);
  face(
    out,
    slot,
    [p(-half, sill, recess), ...arc.map(([x, y]) => p(x, y, recess)), p(half, sill, recess)],
    wall.normal,
    slot === 'dark' ? C.dark : slot === 'carving' ? C.recess : C.window,
  );
  if (lod === 0) return;
  beamPath(
    out,
    'carving',
    [
      p(-half, sill, recess + 0.09),
      ...arc.map(([x, y]) => p(x, y, recess + 0.09)),
      p(half, sill, recess + 0.09),
    ],
    lod > 1 ? 0.33 : 0.25,
    0.23,
    C.limestone,
  );
  if (lod > 1 && slot === 'glazing') {
    for (const x of [-0.51, 0, 0.51]) {
      panel(
        out,
        'carving',
        wall,
        u + x * half - 0.052,
        u + x * half + 0.052,
        sill,
        peak - (0.25 + Math.abs(x)) * 1.4,
        recess + 0.032,
        C.recess,
      );
    }
    panel(
      out,
      'carving',
      wall,
      u - half,
      u + half,
      spring - 0.08,
      spring + 0.09,
      recess + 0.045,
      C.recess,
    );
  }
}

function distantFacade(out, entrance, columns, top, lod) {
  const wall = edge(...entrance),
    width = wall.length,
    mid = width / 2;
  panel(out, 'stone', wall, 0, width, 2.6, top, -0.06, C.facade);
  for (const [base, peak, d] of [
    [32.5, 33.6, 0.81],
    [36.0, 37.8, 1.27],
    [top - 0.29, top + 0.37, 1.06],
  ])
    trimBlock(out, 'carving', wall, 0, width, base, peak, -0.04, d, C.limestone);
  pediment(out, wall, mid, 16.0, 38.4, 47.2, 1.39, C.limestone);
  for (const [i, x] of [-47.6, -36.2, -22.8, -11.45, 0, 10.43, 21.84, 34.2, 47.6].entries()) {
    const u = mid + x;
    if (i !== 1 && i !== 7)
      panel(
        out,
        'dark',
        wall,
        u - 3.05,
        u + 3.05,
        3.02,
        i === 0 || i === 8 ? 15.58 : 12.75,
        0.037,
        C.dark,
      );
    if (lod > 0) {
      openingArch(out, wall, u, 2.13, 20.6, 26, 28.7, 0.048, 0);
      panel(out, 'glazing', wall, u - 1.65, u + 1.65, top - 5.11, top - 2.07, 0.051, C.window);
    }
  }
  if (lod > 0) {
    for (const center of columns.map(planarMid))
      turned(
        out,
        'carving',
        [center[0], center[1] - 0.98],
        [
          [2.92, 1.72],
          [31.36, 1.45],
        ],
        5,
        C.limestone,
      );
  }
  for (const side of [-1, 1]) clock(out, wall, mid + side * 48.65, top, 0);
  for (const x of [-56, -40.4, -31.2, -22.15, -12.73, -7, 0, 7, 12.73, 22.15, 31.2, 40.4, 56]) {
    const c = xz(wall.p(mid + x, 0, -0.7));
    if (lod === 0)
      block(
        out,
        'carving',
        c[0] - 0.47,
        top + 0.35,
        c[1] - 0.5,
        0.94,
        x === 0 ? 6 : 5.65,
        1.0,
        C.limestone,
      );
    else
      turned(
        out,
        'carving',
        c,
        [
          [top + 0.3, 0.79],
          [top + 4.48, 0.56],
          [top + (x === 0 ? 6.0 : 5.65), 0.3],
        ],
        4,
        C.limestone,
      );
  }
}

function mainFacade(out, entrance, columns, top, lod) {
  if (lod < 2) {
    distantFacade(out, entrance, columns, top, lod);
    return;
  }
  const w = edge(...entrance);
  const width = w.length,
    mid = width / 2,
    archBase = floor + 0.29;
  const recessCenters = [-47.6, -36.2, -22.8, -11.45, 0, 10.43, 21.84, 34.2, 47.6];
  const panelFloor = floor + 26.95;
  const panelCeil = floor + 30.8;
  const shoulders = recessCenters.map((x) => mid + x);
  panel(out, 'stone', w, 0, width, archBase - 0.04, panelCeil + 0.25, -0.79, C.facade);
  panel(out, 'stone', w, 0, width, panelCeil, top, 0, C.facade);
  for (let i = 0; i <= shoulders.length; i++) {
    const u =
      i === 0
        ? 1.55
        : i === shoulders.length
          ? width - 1.55
          : (shoulders[i - 1] + shoulders[i]) / 2;
    const half = i === 0 || i === shoulders.length ? 1.55 : 0.97;
    panel(out, 'stone', w, u - half, u + half, archBase, panelFloor, 0.39, C.facade);
  }
  for (let i = 0; i < shoulders.length; i++) {
    const u = shoulders[i],
      outside = i === 0 || i === 8,
      central = [2, 4, 6].includes(i),
      blind = i === 1 || i === 7;
    const archHalf = outside ? 4.32 : central ? 2.63 : 2.0;
    if (!blind) {
      if (outside || !central) {
        openingArch(
          out,
          w,
          u,
          archHalf,
          archBase,
          archBase + (outside ? 10.7 : 5.53),
          archBase + (outside ? 15.35 : 8.15),
          -0.66,
          lod,
          'dark',
        );
      } else {
        opening(
          out,
          w,
          u - 3.3,
          u + 3.3,
          archBase,
          archBase + 10.42,
          'carving',
          C.door,
          'dark',
          C.limestone,
          lod,
          -0.44,
        );
        if (lod > 0) {
          trimBlock(
            out,
            'copper',
            w,
            u - 3.22,
            u + 3.22,
            archBase + 6.3,
            archBase + 7.24,
            -0.35,
            -0.241,
            C.leadDark,
          );
          for (const sign of [-1, 1]) {
            const xy = xz(w.p(u + sign * 3.36, 0, -0.58));
            turned(
              out,
              'carving',
              xy,
              [
                [archBase, 0.62],
                [archBase + 8.97, 0.51],
                [archBase + 9.35, 0.72],
              ],
              lod > 1 ? 10 : 6,
              C.limestone,
            );
          }
        }
      }
    } else if (blind && lod > 0) {
      openingArch(
        out,
        w,
        u,
        2.24,
        archBase + 2,
        archBase + 6.1,
        archBase + 8.8,
        0.77,
        lod,
        'carving',
      );
    }
    const d = blind ? 0.76 : -0.44;
    openingArch(
      out,
      w,
      u,
      central ? 2.7 : outside ? 2.5 : 1.96,
      floor + 18.15,
      floor + 24.05,
      floor + 26.15,
      d,
      lod,
      blind ? 'carving' : 'glazing',
    );
    if (lod > 0 && central) {
      trimBlock(
        out,
        'carving',
        w,
        u - 3.0,
        u + 3.0,
        floor + 17.17,
        floor + 18.47,
        -0.47,
        0.73,
        C.pale,
      );
      if (lod > 1)
        for (let j = -2; j <= 2; j++) {
          const v = u + j * 0.96;
          trimBlock(
            out,
            'carving',
            w,
            v - 0.19,
            v + 0.19,
            floor + 16.62,
            floor + 17.28,
            0.04,
            0.65,
            C.limestone,
          );
        }
    }
    const aWidth = [1.95, 1.34, 1.81, 1.31, 1.62, 1.31, 1.81, 1.34, 1.95][i];
    opening(
      out,
      w,
      u - aWidth,
      u + aWidth,
      top - 5.04,
      top - 1.7,
      'carving',
      C.recess,
      i === 0 || i === 8 ? 'dark' : 'glazing',
      C.pale,
      lod,
      0.012,
    );
  }
  const colCenters = columns.map((p) => planarMid(p));
  for (const [x, z] of colCenters) {
    const y = floor + 30.45;
    const center = [x, z - 1.13];
    const columnsSides = [6, 10, 14, 20][lod];
    turned(
      out,
      'carving',
      center,
      [
        [archBase, 1.76],
        [archBase + 1.62, 1.68],
        [y - 2.22, 1.35],
        [y - 1.77, 1.42],
      ],
      columnsSides,
      C.limestone,
    );
    turned(
      out,
      'carving',
      center,
      [
        [y - 1.86, 1.42],
        [y - 0.54, 2.07],
        [y, 2.11],
      ],
      columnsSides,
      C.pale,
    );
    if (lod > 1) {
      block(out, 'carving', center[0] - 2.02, y - 0.17, center[1] - 2.02, 4.04, 0.37, 4.04, C.pale);
      for (const d of [-1, 1])
        block(
          out,
          'carving',
          center[0] - 1.98,
          y - 1.1,
          center[1] + d * 1.72 - 0.23,
          3.96,
          0.57,
          0.46,
          C.limestone,
        );
    }
  }
  for (let i = 0; i < 10; i++) {
    const u = [2.1, 15.2, 29.2, 40.2, 49.8, 65.6, 75.9, 86.4, 100.7, 113.2][i];
    panel(out, 'carving', w, u - 0.76, u + 0.76, archBase, panelCeil, 0.97, C.limestone);
  }
  for (const [bottom, high, depth] of [
    [floor + 29.95, floor + 30.45, 1.6],
    [floor + 30.45, floor + 31.19, 2.12],
    [floor + 32.15, floor + 34.62, 2.15],
    [floor + 34.73, floor + 36.14, 2.55],
    [top - 0.56, top + 0.05, 1.65],
    [top + 0.05, top + 0.52, 1.8],
  ])
    trimBlock(out, 'carving', w, -0.42, width + 0.42, bottom, high, 0, depth, C.limestone);
  pediment(out, w, mid, 16.5, floor + 36.16, top - 0.69, 2.68, C.stone);
  if (lod > 0) {
    const coat = [
      w.p(mid - 1.33, top - 3.78, 2.81),
      w.p(mid + 1.33, top - 3.78, 2.81),
      w.p(mid + 1.1, top - 5.2, 2.81),
      w.p(mid, top - 5.8, 2.81),
      w.p(mid - 1.1, top - 5.2, 2.81),
    ];
    face(out, 'carving', coat, w.normal, C.pale);
  }
  for (const [low, high, d] of [
    [top + 0.31, top + 0.51, 0.86],
    [top + 1.02, top + 1.16, 0.86],
  ])
    panel(out, 'carving', w, 0.59, width - 0.59, low, high, d, C.limestone);
  const balusters = lod === 3 ? 72 : 30;
  for (let i = 0; i < balusters; i++) {
    const x = 1 + ((width - 2) * (i + 0.5)) / balusters;
    panel(out, 'carving', w, x - 0.11, x + 0.11, top + 0.47, top + 1.07, 0.839, C.pale);
  }
  for (const side of [-1, 1]) clock(out, w, mid + side * 48.65, top, lod);
  for (const x of [-56, -40.4, -31.2, -22.15, -12.73, -7, 0, 7, 12.73, 22.15, 31.2, 40.4, 56])
    statue(out, w, mid + x, top, lod, x === 0);
}

function clock(out, w, x, top, lod) {
  const y = top + 2.25,
    t = (u, h, d = 1.7) => w.p(x + u, y + h, d);
  const n = lod < 2 ? 12 : 26;
  const circle = (r, d) =>
    Array.from({ length: n }, (_, i) => {
      const theta = (2 * Math.PI * i) / n;
      return t(r * Math.cos(theta), r * Math.sin(theta), d);
    });
  const cap = [
    t(-3.8, -2.75),
    t(3.8, -2.75),
    t(2.9, 1.74),
    t(1.55, 3.35),
    t(0, 4.18),
    t(-1.55, 3.35),
    t(-2.9, 1.74),
  ];
  face(out, 'carving', cap, w.normal, C.limestone);
  face(out, 'carving', circle(2.68, 1.91), w.normal, C.recess);
  face(out, 'carving', circle(2.33, 1.95), w.normal, C.pale);
  if (lod > 0)
    beamPath(
      out,
      'copper',
      [t(-0.52, 0.42, 2.03), t(0, 0, 2.03), t(0.45, 1.64, 2.03)],
      0.13,
      0.09,
      C.leadDark,
    );
  if (lod > 1)
    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6,
        a = Math.cos(theta),
        b = Math.sin(theta);
      beamPath(
        out,
        'copper',
        [t(a * 1.84, b * 1.84, 2.01), t(a * 2.09, b * 2.09, 2.01)],
        0.092,
        0.057,
        C.leadDark,
      );
    }
}

function statue(out, w, x, top, lod, center) {
  const c = xz(w.p(x, 0, -0.94));
  const height = center ? 6 : 5.65;
  const profile = [
    [0, 0.94],
    [0.45, 0.94],
    [0.64, 0.58],
    [1.76, 0.68],
    [3.63, 0.48],
    [4.4, 0.76],
    [4.78, 0.41],
    [5.04, 0.36],
    [5.44, 0.4],
    [5.61, 0.23],
  ];
  const n = [4, 6, 8, 10][lod];
  turned(
    out,
    'carving',
    c,
    (lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile).map(([h, r]) => [
      top + 0.46 + (h / 5.65) * height,
      r,
    ]),
    n,
    C.limestone,
  );
  if (lod > 1) {
    const direction = Math.sin(x) > 0 ? 1 : -1;
    beamPath(
      out,
      'carving',
      [
        [c[0] + direction * 0.48, top + 4.67, c[1]],
        [c[0] + direction * 0.97, top + 3.77, c[1] - 0.18],
        [c[0] + direction * 0.77, top + 3.26, c[1] - 0.3],
      ],
      0.36,
      0.35,
      C.pale,
    );
  }
}

function stairApproach(out, line, grade, lod) {
  const w = edge(...line),
    mid = w.length / 2;
  const stairs = lod === 0 ? 3 : lod === 1 ? 8 : 14;
  for (let i = 0; i < stairs; i++) {
    const f = i / stairs;
    const d = 17 * (1 - f);
    const a = w.p(mid, 0, d);
    const y = Math.min(-0.3, grade(xz(a)) - 0.28);
    const h = mix(0.07, floor, (i + 1) / stairs);
    trimBlock(out, 'floor', w, 1.1, w.length - 1.1, y, h, d - 17 / stairs - 0.01, d, C.steps);
  }
}

function roofAndMasonry(out, controls, grade, lod) {
  const { parts, outline, roofBase } = controls;
  const lower = (p) => Math.min(grade(p) - 0.34, 0.01);
  const simpleBasilica = [
    [-56.7, -135.48],
    [58.52, -135.48],
    [58.52, -93],
    [52, -61],
    [57, -33],
    [77, -25],
    [78, 33],
    [53, 42],
    [54, 57],
    [26, 63],
    [22, 73],
    [9, 81],
    [-15, 81],
    [-30, 71],
    [-36, 64],
    [-53, 57],
    [-54, 42],
    [-77, 30],
    [-78, -33],
    [-56, -42],
    [-56, -57],
    [-39, -79],
    [-56.7, -108],
  ];
  const footprint = lod === 0 ? simpleBasilica : outline;
  const faceIndex = lod === 0 ? 0 : 140;
  stoneMass(out, footprint, lower, 43.8, C.facade, C.terra, (i) => i !== faceIndex);
  const upper =
    lod === 0 ? simpleBasilica.map(([x, z]) => [x * 0.94, Math.max(z, -119)]) : parts.roofMass[0];
  stoneMass(out, upper, 43.77, roofBase, C.stone, C.terra);
  const n = parts.naveRoof[0];
  if (lod > 0) {
    const south = planarMid([n[0], n[1]]),
      north = planarMid([n[2], n[3]]);
    const midZ = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ridgeFront = midZ(n[1], n[2]),
      ridgeRear = midZ(n[0], n[3]);
    for (const [a, b] of [
      [n[0], n[1]],
      [n[2], n[3]],
    ]) {
      const [r0, r1] =
        Math.abs(a[1] - ridgeFront[1]) < Math.abs(a[1] - ridgeRear[1])
          ? [ridgeFront, ridgeRear]
          : [ridgeRear, ridgeFront];
      face(
        out,
        'terracotta',
        [at(a, roofBase), at(b, roofBase), at(r1, 59.5), at(r0, 59.5)],
        up,
        C.terra,
      );
    }
    for (const [a, b, mid] of [
      [n[0], n[3], ridgeRear],
      [n[1], n[2], ridgeFront],
    ])
      face(
        out,
        'stone',
        [at(a, roofBase), at(b, roofBase), at(mid, 59.5)],
        [south[1] - north[1], 0, Math.sign(mid[1])],
        C.stone,
      );
  }
  for (const points of parts.minorDomes.slice(0, 4)) {
    const center = planarMid(points);
    const size =
      points.reduce((sum, p) => sum + Math.hypot(p[0] - center[0], p[1] - center[1]), 0) /
      points.length;
    smallDome(out, center, size * 0.94, roofBase, 10.6, lod);
  }
  if (lod < 1) return;
  const sign = areaSign(footprint);
  for (const [i, [a, b]] of pairs(closed(footprint)).entries()) {
    const w = edge(a, b, sign);
    if (w.length < 4.5 || i === faceIndex || Math.min(a[1], b[1]) < -123) continue;
    panel(out, 'carving', w, 0, w.length, 35.7, 36.34, 0.34, C.limestone);
    const n = Math.max(1, Math.floor(w.length / 8.4));
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) / n) * w.length;
      const r = Math.min(1.48, w.length / (n * 4.3));
      if (lod === 1) {
        panel(out, 'glazing', w, x - r, x + r, 17.9, 25.38, 0.047, C.window);
      } else {
        openingArch(out, w, x, r, 17.4, 23.96, 26.55, 0.045, lod === 3 ? lod : 0);
        panel(out, 'stone', w, x - r * 0.52, x + r * 0.52, 5.8, 11.4, 0.057, C.recess);
        const u = x - (0.36 * w.length) / n;
        if (lod === 3 && u > 0.48)
          trimBlock(out, 'carving', w, u - 0.41, u + 0.41, 5.3, 33.8, -0.04, 0.62, C.limestone);
      }
    }
  }
}

function sacristy(out, points, grade, lod) {
  const base = (p) => Math.min(grade(p) - 0.26, 0.34);
  const body = lod === 0 ? points.filter((_, i) => i % 3 === 0) : points;
  stoneMass(out, body, base, 24.25, C.sacristy, C.leadDark);
  const center = [93.7, -41.5];
  const ring = radialRing(0, 12.2, 12.2, lod > 1 ? 16 : 8, center).map(xz);
  stoneMass(out, ring, 24.18, 27.3, C.sacristy, C.leadDark);
  smallDome(out, center, 11.65, 27.2, 12.8, lod);
  smallDome(out, center, 2.3, 38.84, 4.32, lod, true);
  if (lod < 1) return;
  const winding = areaSign(points);
  for (const [a, b] of pairs(closed(points))) {
    const wall = edge(a, b, winding);
    if (wall.length < 5.7) continue;
    const n = Math.max(1, Math.floor(wall.length / 6.2));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * (wall.length / n);
      for (const base of [9.24, 16.15])
        opening(
          out,
          wall,
          u - 1,
          u + 1,
          base,
          base + 3.12,
          'carving',
          C.window,
          'glazing',
          C.limestone,
          lod,
          0.025,
        );
    }
    panel(out, 'carving', wall, 0, wall.length, 22.72, 23.18, 0.074, C.limestone);
  }
}

function draw(out, lod, controls, grade) {
  roofAndMasonry(out, controls, grade, lod);
  domeAndLantern(out, controls, lod);
  sacristy(out, controls.parts.sacristy[0], grade, lod);
  stairApproach(out, controls.portalLine, grade, lod);
  mainFacade(out, controls.portalLine, controls.parts.portalColumns, controls.atticTop, lod);
}

const basilica = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-99, 96, -276],
    lookAt: [2, 43, -30],
    sun: [-285, 610, -735],
    yaw: -2.62,
    brief:
      'St. Peter’s Basilica and attached sacristy, including Maderno’s facade, the main ribbed dome and the smaller roof cupolas.',
    views: [
      { name: 'maderno-facade-and-clocks', position: [-3, 28, -269], lookAt: [0, 32, -111] },
      { name: 'ribbed-dome-drum-and-lantern', position: [96, 113, 11], lookAt: [0, 96, 0] },
      {
        name: 'western-apse-and-renaissance-roofline',
        position: [-146, 101, 172],
        lookAt: [-3, 46, 23],
      },
      {
        name: 'connected-sacristy-and-southern-transept',
        position: [196, 66, -48],
        lookAt: [66, 39, -22],
      },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = basilica;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...basilica.model,
  category: 'religious',
  embeddedCanonicalGraphs: basilica.model.embeddedCanonicalGraphs.filter(Boolean),
  recipeDependencies: [...basilica.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: plan.dimensions.outline,
    outlines: [plan.dimensions.outline, plan.dimensions.parts.sacristy[0]],
    minimumCoverage: 0.9,
    basis:
      'Two mapped masks replace the standing basilica and attached sacristy while keeping the Apostolic Palace and square colonnades separate.',
  },
  sourceLicense:
    'Original exterior geometry from mapped building elements, native bare-earth terrain, official architecture descriptions, and creator-dedicated public-domain photographs.',
};
