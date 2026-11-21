import {
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  cap,
  edge,
  face,
  mix,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  stone: surface('foundation', 'stone_ashlar'),
  tiles: surface('trim', 'tile_mosaic', 0.69, 0.03),
  roof: surface('roof', 'stone_limestone_raw'),
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.81, metallic: 0 },
  sash: surface('window', 'window_punched', 0.54, 0.045),
};
const C = palette({
  brick: 'b9a180',
  warm: 'c8ae89',
  parapet: 'c7b99e',
  stone: 'bfb39c',
  paving: 'b9ae98',
  roof: 'ae9e82',
  inShadow: '685848',
  shadow: '484748',
  darkBlue: '42647a',
  blue: '5d8196',
  teal: '5c9891',
  light: 'd3c9a7',
  glazed: '63887f',
  garden: '747852',
  pool: '618e88',
  poolDark: '527e77',
  wood: '74634d',
  leaf: '777d52',
  leafShade: '6a744d',
});
const courtY = 0.46;
const arcadeTop = 8.65;
// The original terrain slopes across the precinct. Keep the courtyard level
// above the source elevations and let the masonry plinths meet the slope.
const courtTerrace = 1.48;

function mass(out, p, low, high, tint = C.brick, top = C.roof) {
  shell(out, p, typeof low === 'number' ? () => low : low, high, {
    wall: 'brick',
    color: tint,
    roof: 'roof',
    roofColor: top,
  });
}

function towerProfile(out, slot, center, ys, sides, color) {
  loft(
    out,
    slot,
    ys.map(([y, radius]) => radialRing(y, radius, radius, sides, center)),
    color,
  );
}

function dome(out, [x, z], bottom, top, radius, lod, main = false) {
  if (lod === 0) {
    towerProfile(
      out,
      'tiles',
      [x, z],
      [
        [bottom, radius],
        [mix(bottom, top, 0.48), radius * 0.89],
        [mix(bottom, top, 0.85), radius * 0.55],
        [top, radius * 0.04],
      ],
      main ? 10 : 6,
      main ? C.teal : C.roof,
    );
    return;
  }
  const sides = [10, 16, 24, 32][lod];
  towerProfile(
    out,
    'brick',
    [x, z],
    [
      [bottom - 0.15, radius * 0.99],
      [bottom + 0.74, radius],
    ],
    sides,
    C.brick,
  );
  const from = bottom + 0.72;
  const height = top - from;
  const profile = [
    [0, 1],
    [0.27, 0.99],
    [0.53, 0.88],
    [0.73, 0.7],
    [0.9, 0.43],
    [0.98, 0.15],
    [1, 0.035],
  ];
  towerProfile(
    out,
    'tiles',
    [x, z],
    profile.map(([h, r]) => [from + h * height, r * radius]),
    sides,
    main ? C.teal : C.roof,
  );
  if (!main) return;
  towerProfile(
    out,
    'tiles',
    [x, z],
    [
      [from + 0.025, radius * 1.006],
      [from + 0.26, radius * 1.006],
    ],
    sides,
    C.darkBlue,
  );
  towerProfile(
    out,
    'detail',
    [x, z],
    [
      [top - 0.04, 0.19],
      [top + 0.47, 0.14],
      [top + 0.79, 0.045],
    ],
    8,
    C.parapet,
  );
  if (lod === 3)
    for (let i = 0; i < sides; i += 2) {
      const theta = (2 * Math.PI * i) / sides;
      const points = profile
        .slice(1, -1)
        .map(([h, r]) => [
          x + (radius * r + 0.032) * Math.cos(theta),
          from + height * h,
          z + (radius * r + 0.032) * Math.sin(theta),
        ]);
      beamPath(out, 'detail', points, 0.076, 0.075, C.light);
    }
}

function minaret(out, [x, z], top, scale, lod) {
  const center = [x, z];
  const sides = [6, 10, 14, 18][lod];
  const ring = (slot, tone, points) =>
    towerProfile(
      out,
      slot,
      center,
      points.map(([y, r]) => [y, r * scale]),
      sides,
      tone,
    );
  if (lod === 0) {
    ring('tiles', C.blue, [
      [courtY - 0.1, 1.67],
      [top - 5.61, 1.25],
      [top - 4.24, 1.83],
      [top - 2.15, 0.95],
      [top, 0.06],
    ]);
    return;
  }
  ring('stone', C.stone, [
    [courtY - 0.1, 1.79],
    [2.45, 1.76],
    [2.66, 1.6],
  ]);
  ring('tiles', C.blue, [
    [2.61, 1.54],
    [top - 6.1, 1.2],
    [top - 5.6, 1.24],
  ]);
  ring('tiles', C.teal, [
    [top - 5.68, 1.23],
    [top - 4.85, 1.82],
    [top - 4.45, 1.82],
  ]);
  ring('stone', C.parapet, [
    [top - 4.46, 1.83],
    [top - 4.2, 1.88],
    [top - 3.73, 1.87],
  ]);
  ring('tiles', C.teal, [
    [top - 1.8, 1.35],
    [top - 1.46, 1.3],
    [top - 0.69, 0.79],
    [top, 0.063],
  ]);
  if (lod > 0) {
    for (const ratio of [0.2, 0.42, 0.65, 0.84]) {
      const y = mix(2.62, top - 5.8, ratio),
        r = mix(1.54, 1.2, ratio);
      ring('tiles', ratio === 0.42 ? C.teal : C.darkBlue, [
        [y, r + 0.023],
        [y + 0.22, r + 0.02],
      ]);
    }
  }
  for (let i = 0; i < sides; i += 2) {
    const angle = (2 * Math.PI * i) / sides;
    const dx = Math.cos(angle),
      dz = Math.sin(angle);
    const p = (r, y) => [x + r * scale * dx, y, z + r * scale * dz];
    if (lod === 3)
      beamPath(
        out,
        'detail',
        [p(1.54, 2.95), p(1.31, top - 9.7), p(1.25, top - 6.16)],
        0.055,
        0.065,
        C.light,
      );
    const ix = x + dx * 1.17 * scale,
      iz = z + dz * 1.17 * scale;
    block(out, 'detail', ix - 0.11, top - 3.75, iz - 0.11, 0.22, 1.98, 0.22, C.light);
  }
}

function ogive(width, spring, peak, steps) {
  const offset = width * 0.42;
  const outer = width + offset;
  const norm = Math.sqrt(outer * outer - offset * offset);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = mix(-width, width, index / steps);
    const r = Math.min(outer, Math.abs(x) + offset);
    return [x, spring + ((peak - spring) * Math.sqrt(outer * outer - r * r)) / norm];
  });
}

function archedBay(
  out,
  wall,
  center,
  width,
  base,
  spring,
  peak,
  top,
  depth,
  lod,
  decorated,
  through = false,
) {
  const steps = decorated ? [6, 8, 12, 18][lod] : [4, 4, 4, 10][lod];
  const arc = ogive(width, spring, peak, steps);
  const p = (u, y, d = 0) => wall.p(center + u, y, d);
  const half = width + (decorated ? 1.7 : 0.64);
  panel(out, 'brick', wall, center - half, center - width, base, top, 0, C.warm);
  panel(out, 'brick', wall, center + width, center + half, base, top, 0, C.warm);
  const back = -depth;
  if (!through)
    panel(out, 'detail', wall, center - width, center + width, base, spring, back, C.shadow);
  for (let i = 1; i < arc.length; i++) {
    const [a, y] = arc[i - 1],
      [b, z] = arc[i];
    face(out, 'brick', [p(a, y), p(b, z), p(b, top), p(a, top)], wall.normal, C.warm);
    face(
      out,
      decorated ? 'tiles' : 'brick',
      [p(a, y), p(b, z), p(b, z, back), p(a, y, back)],
      [0, -1, 0],
      decorated ? C.blue : C.inShadow,
    );
    if (!through && lod > 0)
      face(
        out,
        'detail',
        [p(a, spring, back), p(b, spring, back), p(b, z, back), p(a, y, back)]
          .filter((v, j, arr) => j === 0 || v.some((c, k) => Math.abs(c - arr[j - 1][k]) > 1e-8))
          .filter(
            (v, j, arr) => j !== arr.length - 1 || v.some((c, k) => Math.abs(c - arr[0][k]) > 1e-8),
          ),
        wall.normal,
        C.inShadow,
      );
  }
  const normal = [wall.normal[2], 0, -wall.normal[0]];
  for (const sign of [-1, 1])
    face(
      out,
      'brick',
      [
        p(sign * width, base, back),
        p(sign * width, base),
        p(sign * width, spring),
        p(sign * width, spring, back),
      ],
      normal.map((v) => v * sign),
      C.inShadow,
    );
  if (decorated || lod === 3) {
    const offset = decorated ? 0.36 : 0.13;
    const contour = [
      p(-width, base, 0.08),
      ...arc.map(([u, y]) => p(u, y, 0.08)),
      p(width, base, 0.08),
    ];
    beamPath(out, 'tiles', contour, offset, offset * 0.65, decorated ? C.darkBlue : C.brick);
    if (lod >= 2 && decorated) {
      const outer = ogive(width + 0.54, spring + 0.14, peak + 0.58, steps);
      beamPath(
        out,
        'tiles',
        [
          p(-width - 0.54, base, 0.1),
          ...outer.map(([u, y]) => p(u, y, 0.1)),
          p(width + 0.54, base, 0.1),
        ],
        0.24,
        0.15,
        C.teal,
      );
    }
  }
  if (decorated && lod > 0) {
    for (const u of [-half + 0.16, half - 0.16])
      trimBlock(
        out,
        'tiles',
        wall,
        center + u - 0.16,
        center + u + 0.16,
        base,
        top,
        0,
        0.22,
        C.blue,
      );
    trimBlock(
      out,
      'tiles',
      wall,
      center - half,
      center + half,
      top - 0.68,
      top - 0.1,
      0,
      0.19,
      C.darkBlue,
    );
    trimBlock(
      out,
      'stone',
      wall,
      center - half - 0.23,
      center + half + 0.23,
      top - 0.05,
      top + 0.27,
      -0.04,
      0.29,
      C.parapet,
    );
    if (lod === 3)
      for (let i = -4; i <= 4; i++) {
        const u = (i * half) / 5;
        face(
          out,
          'detail',
          [
            p(u - 0.13, top - 0.39, 0.226),
            p(u, top - 0.27, 0.226),
            p(u + 0.13, top - 0.39, 0.226),
            p(u, top - 0.51, 0.226),
          ],
          wall.normal,
          C.light,
        );
      }
  }
}

function courtRanges(out, court, grade, lod) {
  const sideSpecs = [
    { span: 4.95, peak: 12.07, top: 14.12 },
    { span: 5.17, peak: 13.64, top: 15.57 },
    { span: 5.05, peak: 11.82, top: 13.77 },
    { span: 7.73, peak: 19.01, top: 21.8 },
  ];
  for (const [i, point] of court.entries()) {
    const next = court[(i + 1) % court.length];
    const w = edge(point, next, -areaSign(court)),
      m = w.length / 2;
    const s = sideSpecs[i];
    const main = s.span + 1.7;
    const back = i === 2 ? 9.6 : 7.0;
    const inside = (u, d) => {
      const [x, , z] = w.p(u, 0, d);
      return [x, z];
    };
    const floor = (q) => Math.min(grade(q) - 0.23, courtY - 0.27);
    for (const [start, end] of [
      [0, m - main],
      [m + main, w.length],
    ]) {
      mass(
        out,
        [inside(start, -1.65), inside(end, -1.65), inside(end, -back), inside(start, -back)],
        floor,
        arcadeTop,
        C.warm,
      );
      const bayCount = i === 3 ? 5 : 7;
      const pitch = (end - start) / bayCount;
      panel(out, 'stone', w, start, end, courtY - 0.02, 1.04, 0.029, C.stone);
      panel(out, 'brick', w, start, end, 4.24, 4.65, 0.04, C.brick);
      panel(out, 'tiles', w, start, end, 4.36, 4.57, 0.078, C.blue);
      panel(out, 'stone', w, start, end, 8.34, arcadeTop, 0.079, C.parapet);
      for (let j = 0; j < bayCount; j++) {
        const x = start + pitch * (j + 0.5);
        const width = pitch * 0.5 - 0.66;
        for (const y of [1.02, 4.71])
          archedBay(out, w, x, width, y, y + 1.48, y + 2.67, y + 3.19, 1.43, lod, false);
        if (lod >= 2)
          panel(out, 'sash', w, x - width * 0.56, x + width * 0.56, 1.17, 2.41, -1.32, C.wood);
      }
    }
    archedBay(
      out,
      w,
      m,
      s.span,
      courtY,
      s.peak - (i === 3 ? 7.3 : 4.9),
      s.peak,
      s.top,
      i === 3 ? 8.7 : 4.8,
      lod,
      true,
      false,
    );
    const side = i === 3 ? 4.6 : 3.2;
    const crown = [
      inside(m - main, -0.12),
      inside(m + main, -0.12),
      inside(m + main, -side),
      inside(m - main, -side),
    ];
    cap(out, 'roof', crown, s.top + 0.02, C.roof);
    for (const a of [-1, 1])
      mass(
        out,
        [
          inside(m + a * main, -0.14),
          inside(m + a * (main - 1.05), -0.14),
          inside(m + a * (main - 1.05), -side),
          inside(m + a * main, -side),
        ],
        floor,
        s.top,
        C.warm,
      );
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const a = x * 29.68,
        b = z * 29.5;
      mass(
        out,
        rect(
          Math.min(a, a + x * 6.9),
          Math.min(b, b + z * 6.88),
          Math.max(a, a + x * 6.9),
          Math.max(b, b + z * 6.88),
        ),
        (q) => Math.min(grade(q) - 0.25, courtY - 0.27),
        arcadeTop,
        C.warm,
      );
    }
}

function courtyard(out, grade, lod) {
  const base = rect(-29.8, -29.55, 29.8, 29.55);
  shell(out, base, (q) => Math.min(grade(q) - 0.16, courtY - 0.29), courtY, {
    wall: 'stone',
    color: C.stone,
    roof: 'stone',
    roofColor: C.paving,
  });
  for (const x of [-26.75, 3.25])
    for (const z of [-26.35, 3.25]) {
      block(out, 'stone', x, courtY, z, 23.45, 0.17, 23.23, C.stone);
      block(out, 'detail', x + 0.22, courtY + 0.14, z + 0.22, 23.01, 0.06, 22.79, C.garden);
      if (lod <= 1) continue;
      for (const t of [4.5, 10.9, 17.9]) {
        const qx = x + (t > 14 ? 17.9 : 4.5),
          qz = z + t;
        block(out, 'detail', qx - 0.12, courtY + 0.15, qz - 0.12, 0.24, 1.5, 0.24, C.wood);
        sphere(
          out,
          'detail',
          [qx, courtY + 2.38, qz],
          [1.44, 1.48, 1.4],
          t > 10 ? C.leafShade : C.leaf,
          lod === 2 ? 7 : 9,
          lod === 2 ? 4 : 5,
        );
      }
    }
  const k = [16, 24, 32, 44][lod];
  towerProfile(
    out,
    'stone',
    [0, 0],
    [
      [courtY, 7.14],
      [courtY + 0.56, 7.1],
    ],
    k,
    C.parapet,
  );
  cap(
    out,
    'detail',
    radialRing(0, 6.52, 6.52, k, [0, 0]).map(([x, , z]) => [x, z]),
    courtY + 0.57,
    C.pool,
  );
  if (lod > 0)
    towerProfile(
      out,
      'detail',
      [0, 0],
      [
        [courtY + 0.58, 0.72],
        [courtY + 0.94, 0.62],
        [courtY + 1.12, 0.33],
      ],
      8,
      C.poolDark,
    );
}

function prayerHalls(out, controls, grade, lod) {
  const { summerHall, domeCenter, domeRadius } = controls;
  const foot = (q) => Math.min(grade(q) - 0.27, courtY - 0.44);
  const domedRange = summerHall.map(([x, z], index) =>
    index === 4 || index === 5 ? [x, 38.8] : [x, z],
  );
  shell(
    out,
    domedRange,
    foot,
    11.9,
    {
      wall: 'brick',
      color: C.brick,
      roof: 'roof',
      roofColor: C.roof,
    },
    (i) => i !== 4,
  );
  // The hall roof meets the front ranges to either side of the tall iwan.
  // Keep the cap outside its opening so the recess reads continuously.
  mass(out, rect(summerHall[4][0], 30.04, -10.25, 38.84), foot, 11.9);
  mass(out, rect(10.8, 30.04, summerHall[5][0], 38.84), foot, 11.9);
  const z = domeCenter[1],
    x = domeCenter[0];
  mass(out, rect(x - 10.3, z - 10.3, x + 10.3, z + 10.3), 11.85, 14.2, C.warm);
  dome(out, domeCenter, 14.2, 24.8, domeRadius, lod, true);
  for (const [a, b] of [
    [x - 13.3, z],
    [x + 12.6, z],
    [x, z + 14],
    [x, z - 12.85],
  ])
    dome(out, [a, b], 11.93, 15.65, 4.55, lod);
  const w = edge([-22.2, 30.04], [25.3, 30.04]);
  for (const cx of [7.4, 39.1]) {
    archedBay(out, w, cx, 3.34, courtY, 4.19, 7.56, 10.28, 2.25, lod, true);
    const p = [w.p(cx - 3.9, 9, 0.03), w.p(cx + 3.9, 9, 0.03)].map(([a, , b]) => [a, b]);
    const ledge = rect(p[0][0], p[0][1] - 0.79, p[1][0], p[0][1] + 0.27);
    shell(out, ledge, () => 8.25, 8.61, {
      wall: 'stone',
      color: C.stone,
      roof: 'stone',
      roofColor: C.stone,
    });
    if (lod > 0) panel(out, 'tiles', w, cx - 3.82, cx + 3.82, 8.58, 9.31, 0.69, C.teal);
  }
  const winter = rect(39.1, -33.5, 53.95, 34.7);
  mass(out, winter, foot, 10.24, C.brick, C.roof);
  for (const z0 of [-26.5, -13.25, 0, 13.25, 26.5]) {
    mass(out, rect(40.1, z0 - 5, 52.99, z0 + 5), 10.2, 10.65, C.warm);
    if (lod > 0) {
      const side = edge([54, z0 - 4.8], [54, z0 + 4.8]);
      for (const u of [2.3, 6.9]) {
        panel(out, 'stone', side, u - 0.62, u + 0.62, 5.26, 7.61, 0.013, C.paving);
        panel(out, 'sash', side, u - 0.47, u + 0.47, 5.43, 7.43, 0.037, C.shadow);
      }
    }
  }
  mass(out, rect(-23.55, -43.4, 20.5, -36.05), foot, 8.49, C.warm);
  mass(out, rect(25.4, -45.25, 45.5, -35), foot, 9.7, C.brick);
  if (lod > 0)
    for (const x0 of [29, 35.5, 42])
      mass(out, rect(x0 - 0.8, -43.8, x0 + 0.8, -38.1), 9.69, 10.31, C.warm);
}

function westernGateway(out, controls, grade, lod) {
  const { westGate, westPortalDepth } = controls;
  const w = edge(...westGate, 1);
  const mid = w.length / 2;
  const floor = (q) => Math.min(courtY - 0.26, grade(q) - 0.23);
  const wall = (a, b, d, y) => {
    const [x, , z] = w.p(a, y, d),
      [u, , v] = w.p(b, y, d);
    return [
      [x, z],
      [u, v],
    ];
  };
  archedBay(out, w, mid, 4.76, courtY, 7.75, 13.34, 15.7, westPortalDepth, lod, true);
  const ring = [...wall(0, w.length, -0.08, 0), ...wall(w.length, 0, -westPortalDepth, 0)];
  cap(out, 'roof', ring, 15.74, C.roof);
  for (const [a, b] of [
    [0, mid - 4.69],
    [mid + 4.69, w.length],
  ]) {
    mass(out, [...wall(a, b, -0.07, 0), ...wall(b, a, -westPortalDepth, 0)], floor, 15.7, C.warm);
  }
  const back = wall(mid - 3.3, mid + 3.3, -westPortalDepth - 4.3, 0);
  const backCenter = [(back[0][0] + back[1][0]) / 2, (back[0][1] + back[1][1]) / 2];
  mass(
    out,
    rect(backCenter[0] - 6.1, backCenter[1] - 6.2, backCenter[0] + 6.1, backCenter[1] + 6.2),
    floor,
    9.21,
    C.warm,
  );
  dome(out, backCenter, 9.16, 13.3, 4.75, lod);
  for (const [a, b] of [
    [mid - 5.6, mid - 4.2],
    [mid + 4.2, mid + 5.6],
  ]) {
    const [x, , z] = w.p((a + b) / 2, 0, -0.72);
    minaret(out, [x, z], 29.8, 0.83, lod);
  }
  const front = [...wall(mid - 4.6, mid + 4.6, 0.05, 0), ...wall(mid + 4.6, mid - 4.6, 2.75, 0)];
  shell(out, front, floor, courtY, {
    wall: 'stone',
    color: C.stone,
    roof: 'stone',
    roofColor: C.paving,
  });
}

function clockTower(out, lod) {
  block(out, 'brick', -1.29, 15.3, -32.01, 2.57, 4.81, 1.49, C.warm);
  block(out, 'tiles', -1.41, 19.7, -32.13, 2.81, 0.36, 1.73, C.teal);
  const faceCenter = [0, 18.54, -30.491];
  const side = edge([-1.25, -30.51], [1.25, -30.51], -1);
  panel(out, 'tiles', side, 0.07, 2.43, 16.75, 19.62, 0.026, C.darkBlue);
  const dial = Array.from({ length: lod < 2 ? 12 : 24 }, (_, i) => {
    const theta = (2 * Math.PI * i) / (lod < 2 ? 12 : 24);
    return [0.77 * Math.cos(theta), faceCenter[1] + 0.77 * Math.sin(theta), faceCenter[2] + 0.023];
  });
  face(out, 'detail', dial, [0, 0, 1], C.light);
  if (lod > 1)
    beamPath(
      out,
      'detail',
      [
        [0.31, 18.38, -30.441],
        [0, 18.54, -30.441],
        [-0.17, 19.0, -30.441],
      ],
      0.055,
      0.038,
      C.shadow,
    );
}

function draw(out, lod, controls, grade) {
  if (lod <= 1) {
    distantGeometry(atCourtLevel(out), controls, (p) => grade(p) - courtTerrace, lod);
    return;
  }
  const terrace = atCourtLevel(out);
  const ground = (p) => grade(p) - courtTerrace;
  courtyard(terrace, ground, lod);
  courtRanges(terrace, controls.court, ground, lod);
  prayerHalls(terrace, controls, ground, lod);
  westernGateway(out, controls, grade, lod);
  for (const { position, height, scale } of controls.courtMinarets)
    minaret(terrace, position, height, scale, lod);
  clockTower(terrace, lod);
}

function atCourtLevel(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, points, ...attributes) =>
        out[method](
          slot,
          ref,
          points.map(([x, y, z]) => [x, y + courtTerrace, z]),
          ...attributes,
        ),
    ]),
  );
}

function distantGeometry(out, controls, grade, lod) {
  const base = (p) => Math.min(grade(p) - 0.22, 0.05);
  const { courtMinarets, domeCenter, domeRadius, summerHall, westGate } = controls;
  for (const bounds of [
    [-37, -31, -29.5, 30],
    [29.5, -33, 54, 35],
    [-30, -43, 29.5, -29.5],
    [-30, 29.5, -21, 38],
    [25, 29.5, 30, 38],
  ])
    mass(out, rect(...bounds), base, arcadeTop, C.warm);
  mass(out, summerHall, base, 11.9);
  dome(out, domeCenter, 14.2, 24.8, domeRadius, lod, true);
  mass(out, rect(-10.3, 46, 11.8, 66.7), 11.8, 14.22, C.warm);
  const portals = [
    { wall: edge([-29.45, 30], [-29.45, -30], -1), span: 6.5, top: 14 },
    { wall: edge([-30, -29.45], [30, -29.45], -1), span: 6.9, top: 15.3 },
    { wall: edge([29.45, -30], [29.45, 30], -1), span: 6.8, top: 13.7 },
    { wall: edge([30, 29.48], [-30, 29.48], -1), span: 9.5, top: 21.8 },
    { wall: edge(...westGate), span: 6.8, top: 15.65 },
  ];
  for (const { wall, span, top } of portals) {
    const m = wall.length / 2;
    const point = (u, d) => {
      const [x, , z] = wall.p(u, 0, d);
      return [x, z];
    };
    mass(
      out,
      [point(m - span, 0), point(m + span, 0), point(m + span, -3), point(m - span, -3)],
      base,
      top,
      C.warm,
    );
    panel(out, 'tiles', wall, m - span * 0.81, m + span * 0.81, courtY, top - 1.18, 0.024, C.blue);
    face(
      out,
      'detail',
      [
        wall.p(m - span * 0.64, courtY, 0.047),
        wall.p(m + span * 0.64, courtY, 0.047),
        wall.p(m + span * 0.64, top * 0.58, 0.047),
        wall.p(m, top - 2.3, 0.047),
        wall.p(m - span * 0.64, top * 0.58, 0.047),
      ],
      wall.normal,
      C.inShadow,
    );
    if (lod === 1)
      panel(out, 'stone', wall, m - span - 0.04, m + span + 0.04, top - 0.21, top, 0.07, C.parapet);
  }
  const west = portals.at(-1).wall;
  for (const delta of [-4.9, 4.9]) {
    const [x, , z] = west.p(west.length / 2 + delta, 0, -0.72);
    minaret(out, [x, z], 29.8, 0.83, 0);
  }
  for (const { position, height, scale } of courtMinarets) minaret(out, position, height, scale, 0);
  block(out, 'brick', -1.29, 15.25, -32.02, 2.57, 4.83, 1.49, C.warm);
  if (lod === 0) {
    const water = radialRing(0, 6.5, 6.5, 10, [0, 0]).map(([x, , z]) => [x, z]);
    cap(out, 'detail', water, 1.04, C.pool);
    return;
  }
  courtyard(out, grade, lod);
  const w = controls.court.map((a, i) =>
    edge(a, controls.court[(i + 1) % 4], -areaSign(controls.court)),
  );
  for (const wall of w) {
    const m = wall.length / 2;
    for (const dir of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const center = m + dir * (11.16 + 3.64 * i);
        for (const y of [1.15, 4.91]) {
          const arc = ogive(1.14, y + 1.31, y + 2.36, 4).reverse();
          face(
            out,
            'detail',
            [
              wall.p(center - 1.14, y, 0.059),
              wall.p(center + 1.14, y, 0.059),
              ...arc.map(([x, h]) => wall.p(center + x, h, 0.059)),
            ],
            wall.normal,
            C.inShadow,
          );
        }
      }
  }
}

const mosque = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-116, 66, -110],
    lookAt: [-6, 8, 12],
    yaw: -2.1,
    sun: [-460, 560, -620],
    brief:
      'The Sepahsalar Mosque and madrasa, with a four-iwan garden courtyard, shallow finished dome, eight tile-clad minarets and the skewed west entrance.',
    views: [
      {
        name: 'four-iwan-court-and-domed-summer-hall',
        position: [-8, 29, -15],
        lookAt: [1, 11, 36],
      },
      { name: 'west-street-entrance-and-minarets', position: [-87, 15, 38], lookAt: [-47, 11, 29] },
      {
        name: 'clock-and-northern-dormitory-arcades',
        position: [10, 17, 14],
        lookAt: [0, 10, -27],
      },
      { name: 'summer-dome-and-four-minarets', position: [36, 52, 102], lookAt: [1, 14, 50] },
      {
        name: 'mapped-courtyard-footprint-and-gardens',
        position: [-13, 110, -60],
        lookAt: [0, 4, 17],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = mosque;
export const model = {
  ...mosque.model,
  category: 'religious',
  embeddedCanonicalGraphs: mosque.model.embeddedCanonicalGraphs.filter(Boolean),
  recipeDependencies: [...mosque.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Original geometry based on mapped building features, published architectural measurements, public-domain historic references and original Terrarium elevation samples.',
};
