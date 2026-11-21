import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
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
  wall: surface('wall', 'stone_sandstone_raw'),
  course: surface('trim', 'stone_sandstone'),
  base: surface('foundation', 'stone_ashlar'),
  shade: surface('door', 'stone_sandstone_raw'),
  metal: surface('trim', 'metal_painted', 0.64, 0.22),
};
const C = palette({
  wall: 'a59782',
  course: 'c5b49a',
  gray: '958b7c',
  base: 'ad9d84',
  tread: 'c6b69c',
  shadow: '827462',
  interior: '514b43',
  copper: '737d77',
  flag: 'c47936',
  column: '675e53',
  gate: 'c7bb9f',
});

// Five projecting vertical divisions per facade. The longer central face
// continues through both the shrine body and the curvature of the spire.
const profile = [
  [-1, 0],
  [-0.79, 0],
  [-0.75, -0.1],
  [-0.63, -0.1],
  [-0.59, 0.05],
  [-0.38, 0.05],
  [-0.34, -0.09],
  [-0.28, -0.09],
  [-0.24, 0.18],
  [0.24, 0.18],
  [0.28, -0.09],
  [0.34, -0.09],
  [0.38, 0.05],
  [0.59, 0.05],
  [0.63, -0.1],
  [0.75, -0.1],
  [0.79, 0],
];
const reducedProfile = [
  [-1, 0],
  [-0.42, 0],
  [-0.38, -0.08],
  [-0.27, -0.08],
  [-0.24, 0.14],
  [0.24, 0.14],
  [0.27, -0.08],
  [0.38, -0.08],
  [0.42, 0],
];
const rotate = ([x, z], side) =>
  [
    [x, z],
    [z, -x],
    [-x, -z],
    [-z, x],
  ][side];
const outline = (x, z, w, d, detail) =>
  [0, 1, 2, 3].flatMap((side) =>
    (detail > 1 ? profile : detail === 1 ? reducedProfile : [[-1, 0]]).map(([t, p]) => {
      const [u, v] = rotate([t, 1 + p], side);
      return [x + (u * w) / 2, z + (v * d) / 2];
    }),
  );
const circle = (x, z, rx, rz, n, ribs = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n,
      r = i % 2 === 0 ? 1 : 1 - ribs;
    return [x + Math.cos(a) * rx * r, z - Math.sin(a) * rz * r];
  });

function loft(out, rings, slot, color, topColor = color) {
  for (let k = 0; k < rings.length - 1; k++) {
    const [a, y] = rings[k],
      [b, h] = rings[k + 1];
    const orientation = areaSign(a);
    for (let i = 0; i < a.length; i++) {
      const n = (i + 1) % a.length;
      const normal = y === h ? up : edge(a[i], a[n], orientation).normal;
      face(out, slot, [at(a[i], y), at(a[n], y), at(b[n], h), at(b[i], h)], normal, color);
    }
  }
  const [p, y] = rings.at(-1);
  cap(out, slot, p, y, topColor);
}

function turning(out, x, z, sections, lod, slot = 'course', color = C.course, ribbed = false) {
  const n = [5, 8, 16, 28][lod];
  if (lod === 0)
    sections = sections.filter(
      (_, i) => i === 0 || i === sections.length - 1 || i === Math.floor(sections.length / 2),
    );
  if (lod === 1) sections = sections.filter((_, i) => i % 2 === 0 || i === sections.length - 1);
  loft(
    out,
    sections.map(([y, r, fluted]) => [circle(x, z, r, r, n, fluted && ribbed ? 0.12 : 0), y]),
    slot,
    color,
  );
}

function plinth(out, x, z, w, d, floor, grade, lod) {
  const p = rect(x - w / 2 - 0.72, z + d / 2 + 0.72, x + w / 2 + 0.72, z - d / 2 - 0.72);
  shell(out, p, (point) => grade(point) - 0.75, floor, { wall: 'base', color: C.base });
  if (lod > 0) {
    block(
      out,
      'course',
      x - w / 2 - 0.56,
      floor,
      z - d / 2 - 0.56,
      w + 1.12,
      0.28,
      d + 1.12,
      C.tread,
    );
    block(
      out,
      'course',
      x - w / 2 - 0.25,
      floor + 0.28,
      z - d / 2 - 0.25,
      w + 0.5,
      0.37,
      d + 0.5,
      C.course,
    );
  }
}

function belt(out, ring, y, hz, depth, color = C.course) {
  const orientation = areaSign(ring);
  for (const [a, b] of pairs(closed(ring))) {
    const w = edge(a, b, orientation),
      inset = Math.min(w.length * 0.12, 0.06);
    trimBlock(out, 'course', w, inset, w.length - inset, y, y + hz, -0.025, depth, color);
  }
}

function relief(out, x, z, w, d, low, high, lod) {
  if (lod < 2) return;
  const ledges = outline(x, z, w, d, lod === 3 ? 2 : 1);
  belt(out, ledges, low - 0.38, 0.26, 0.19);
  belt(out, ledges, high, 0.29, 0.22);
  const sign = areaSign(ledges);
  for (const [a, b] of pairs(closed(ledges))) {
    const wall = edge(a, b, sign);
    if (wall.length < 1.1) continue;
    const divisions = lod === 3 && wall.length > 3.4 ? 2 : 1;
    for (let j = 0; j < divisions; j++) {
      const mid = (wall.length * (j + 0.5)) / divisions,
        half = Math.min(0.63, wall.length * 0.26);
      const h = high - low;
      panel(
        out,
        'shade',
        wall,
        mid - half,
        mid + half,
        low + h * 0.14,
        high - h * 0.14,
        0.041,
        C.shadow,
      );
      trimBlock(
        out,
        'course',
        wall,
        mid - half - 0.13,
        mid - half,
        low,
        high,
        0.035,
        0.18,
        C.course,
      );
      trimBlock(
        out,
        'course',
        wall,
        mid + half,
        mid + half + 0.13,
        low,
        high,
        0.035,
        0.18,
        C.course,
      );
      trimBlock(
        out,
        'course',
        wall,
        mid - half - 0.17,
        mid + half + 0.17,
        high - h * 0.17,
        high - h * 0.1,
        0.043,
        0.23,
        C.course,
      );
      if (lod === 3)
        trimBlock(
          out,
          'wall',
          wall,
          mid - 0.19,
          mid + 0.19,
          low + h * 0.31,
          low + h * 0.67,
          0.045,
          0.18,
          C.gray,
        );
    }
  }
}

function roofPyramid(out, x, z, w, d, base, peak, groups, lod, detail = 0) {
  const sections = [];
  let k = 0;
  const count = groups.reduce((sum, n) => sum + n, 0);
  const ring = (a, y) => [outline(x, z, w * a, d * a, detail), y];
  for (const n of groups) {
    const start = k;
    for (let j = 0; j < n; j++, k++) {
      const y = mix(base, peak, k / count),
        h = (peak - base) / count,
        a = 1 - (0.83 * k) / count;
      const next = 1 - (0.83 * (k + 1)) / count;
      sections.push(ring(a, y));
      if (lod >= 2) sections.push(ring(a - 0.006, y + h * 0.61));
      if (lod > 0 || (j === n - 1 && start + n < count))
        sections.push(ring(next + 0.008, y + h * 0.91));
      if (j === n - 1 && start + n < count && lod > 0)
        sections.push(ring(next + 0.025, y + h * 0.965));
    }
  }
  sections.push(ring(0.17, peak));
  loft(out, sections, 'course', C.gray, C.course);
  const r = Math.min(w, d) * 0.093;
  turning(
    out,
    x,
    z,
    [
      [peak, r * 0.91],
      [peak + 0.35, r],
      [peak + 0.88, r * 0.76],
      [peak + 1.26, r * 0.38],
      [peak + 1.65, r * 0.23],
    ],
    lod,
    'course',
    C.course,
    true,
  );
}

function shrine(out, h, grade, lod) {
  const { x, z, width, depth } = h;
  const w = width * 0.89,
    d = depth * 0.91;
  const ring = (k, y, detail) => [outline(x, z, w * k, d * k, detail), y];
  plinth(out, x, z, width, depth, 1.5, grade, lod);
  loft(
    out,
    [
      [1.5, 1.04],
      [2.4, 1.04],
      [3.25, 0.94],
      [4.0, 1.0],
      [5.1, 0.96],
      [12.25, 0.96],
      [13.1, 1.03],
      [14.2, 0.98],
    ]
      .filter((_, i) => lod > 0 || i === 0 || i === 4 || i === 7)
      .map(([y, k]) => ring(k, y, lod > 1 ? 1 : 0)),
    'wall',
    C.wall,
  );
  relief(out, x, z, w * 0.96, d * 0.96, 5.35, 8.35, lod === 3 ? 3 : 0);
  relief(out, x, z, w * 0.96, d * 0.96, 8.89, 12.18, lod);
  const section = [
    [14.12, 1],
    [17, 0.977],
    [22, 0.934],
    [27, 0.873],
    [32, 0.785],
    [36, 0.683],
    [39.4, 0.572],
    [42.05, 0.447],
    [43.75, 0.299],
  ];
  const highProfile = lod === 3 ? 2 : lod === 2 ? 1 : 0;
  const strips = lod === 0 ? section.filter((_, i) => i % 2 === 0) : section;
  loft(
    out,
    strips.map(([y, k]) => ring(k, y, highProfile)),
    'wall',
    C.wall,
  );
  if (lod > 1) {
    const markers = lod === 2 ? [17, 32, 39.4] : [17, 22, 27, 32, 36, 39.4, 42.05];
    for (const y of markers) {
      const k = section.find(([a]) => a === y)[1];
      belt(out, ring(k, y, highProfile)[0], y, 0.17, 0.12, C.base);
    }
  }
  turning(
    out,
    x,
    z,
    [
      [43.7, 3.03],
      [44.24, 3.12],
      [44.48, 3.76, true],
      [45.21, 3.85, true],
      [45.81, 3.31, true],
      [46.16, 2.51],
      [46.54, 1.86],
      [46.9, 0.7],
    ],
    lod,
    'course',
    C.course,
    true,
  );
  turning(
    out,
    x,
    z,
    [
      [46.7, 0.67],
      [47.2, 0.59],
      [47.46, 0.27],
      [47.6, 0.22],
      [49.3, 0.19],
    ],
    lod,
    'metal',
    C.copper,
  );
  const spoke = (a, b, width) => {
    const d = a.map((p, i) => b[i] - p),
      f = width / Math.hypot(d[1], d[2]);
    const offset = [0, f * d[2], -f * d[1]],
      add = (p, k) => p.map((v, i) => v + k * offset[i]);
    const quad = [add(a, -1), add(b, -1), add(b, 1), add(a, 1)];
    face(out, 'metal', quad, [1, 0, 0], C.copper);
    face(out, 'metal', quad, [-1, 0, 0], C.copper);
  };
  const n = lod > 1 ? 12 : lod === 1 ? 8 : 6,
    wheel = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x, 48.05 + Math.cos(a) * 1.02, z + Math.sin(a) * 1.02];
    });
  for (const [i, [a, b]] of pairs(closed(wheel)).entries()) {
    spoke(a, b, 0.095);
    if (lod > 0) spoke([x, 48.05, z], a, 0.065);
  }
  const flag = [
    [x, 49.3, z],
    [x + 1.02, 49.17, z + 0.23],
    [x + 2.77, 49.06, z + 0.38],
    [x + 1.34, 48.75, z + 0.2],
    [x, 48.66, z],
  ];
  for (const p of [
    [flag[0], flag[1], flag[4]],
    [flag[1], flag[3], flag[4]],
    [flag[1], flag[2], flag[3]],
  ]) {
    face(out, 'metal', p, [0, 0, 1], C.flag);
    face(out, 'metal', p, [0, 0, -1], C.flag);
  }
}

function hall(out, h, index, grade, lod) {
  const { x, z, width: w, depth: d } = h;
  const floor = [1.4, -2.3, -6.8][index - 1],
    eave = [12.7, 8.4, 3.9][index - 1];
  plinth(out, x, z, w, d, floor, grade, lod);
  const footprint = outline(x, z, w * 0.95, d * 0.95, index === 2 ? 0 : Math.min(1, lod));
  shell(out, footprint, () => floor + 0.2, eave, { wall: 'wall', color: C.wall });
  relief(out, x, z, w * 0.95, d * 0.95, floor + 1.4, eave - 1.2, lod);
  if (index === 2) {
    for (let i = 0; i < 4; i++) {
      const margin = 0.42 * i;
      block(
        out,
        'course',
        x - w / 2 + margin,
        eave + i * 0.48,
        z - d / 2 + margin,
        w - 2 * margin,
        0.48,
        d - 2 * margin,
        i % 2 === 0 ? C.course : C.gray,
      );
    }
    if (lod > 0)
      for (const sign of [-1, 1]) {
        for (let i = 0; i < (lod === 1 ? 3 : 5); i++) {
          const u = x - w * 0.38 + ((i + 0.5) * (w * 0.76)) / (lod === 1 ? 3 : 5);
          block(
            out,
            'course',
            u - 0.37,
            eave + 0.76,
            z + sign * (d / 2 - 0.62) - 0.3,
            0.74,
            1.33,
            0.6,
            C.course,
          );
        }
      }
  } else {
    roofPyramid(
      out,
      x,
      z,
      w * 1.03,
      d * 1.051,
      eave,
      index === 1 ? 28 : 15.9,
      index === 1 ? (lod < 2 ? [2, 2, 1] : [5, 4, 3]) : lod < 2 ? [3] : [7],
      lod,
      lod === 3 ? 1 : 0,
    );
  }
  // Small shaded stone recesses distinguish the stepped and low hall sides.
  if (lod > 0)
    for (const sign of [-1, 1]) {
      const a = [x - 2.2, z + sign * (d * 0.48 + 0.06)],
        b = [x + 2.2, a[1]],
        wall = edge(a, b, -sign);
      panel(out, 'shade', wall, 0.72, 3.68, floor + 0.49, floor + 4.2, 0.06, C.interior);
      trimBlock(out, 'course', wall, 0.39, 4.01, floor + 4.2, floor + 4.63, 0, 0.37, C.course);
    }
}

function wallRuns(out, boundary, gates, grade, lod) {
  const sign = areaSign(boundary);
  for (const [a, b] of pairs(closed(boundary))) {
    const e = edge(a, b, sign),
      dx = (b[0] - a[0]) / e.length,
      dz = (b[1] - a[1]) / e.length;
    const openings = gates
      .map(({ center: [x, z], direction }) => {
        const u = (x - a[0]) * dx + (z - a[1]) * dz,
          offset = (x - a[0]) * dz - (z - a[1]) * dx;
        return { u, offset, half: direction === 'east' ? 6.2 : 5.4 };
      })
      .filter(({ u, offset }) => u > -0.25 && u < e.length + 0.25 && Math.abs(offset) < 7.3);
    // The west outline includes a surveyed vertex near the gate. Split every
    // intersected piece even if the projected gate center lies past that end.
    const bands = [
      ...openings,
      ...gates
        .filter((g) => g.direction === 'west')
        .map(({ center: [x, z] }) => ({
          u: (x - a[0]) * dx + (z - a[1]) * dz,
          offset: (x - a[0]) * dz - (z - a[1]) * dx,
          half: 5.4,
        }))
        .filter(({ u, offset }) => Math.abs(offset) < 6 && u >= -5.4 && u <= e.length + 5.4),
    ];
    const intervals = Array.from(
      new Set([
        0,
        e.length,
        ...bands
          .flatMap(({ u, half }) => [Math.max(0, u - half), Math.min(e.length, u + half)])
          .filter((u) => u >= 0 && u <= e.length),
      ]),
    ).sort((a, b) => a - b);
    const plan = (u, d) => [a[0] + u * dx + d * e.normal[0], a[1] + u * dz + d * e.normal[2]];
    for (const [u, v] of pairs(intervals)) {
      if (v - u < 0.15 || bands.some((g) => Math.abs((u + v) / 2 - g.u) < g.half)) continue;
      const count = Math.ceil((v - u) / [60, 28, 16, 9][lod]);
      for (let j = 0; j < count; j++) {
        const p = mix(u, v, j / count),
          q = mix(u, v, (j + 1) / count);
        const poly = [plan(p, -1.05), plan(q, -1.05), plan(q, 1.05), plan(p, 1.05)];
        const low1 = grade(plan(p, 0)),
          low2 = grade(plan(q, 0)),
          ht = 6.05;
        const tops = poly.map((xz, i) => at(xz, (i === 0 || i === 3 ? low1 : low2) + ht));
        for (let k = 0; k < poly.length; k++) {
          if ((k === 1 && j < count - 1) || (k === 3 && j > 0)) continue;
          const n = (k + 1) % 4,
            w = edge(poly[k], poly[n], areaSign(poly));
          face(
            out,
            'base',
            [
              at(poly[k], grade(poly[k]) - 0.6),
              at(poly[n], grade(poly[n]) - 0.6),
              tops[n],
              tops[k],
            ],
            w.normal,
            C.base,
          );
        }
        face(out, 'course', tops, up, C.course);
        if (lod > 0) {
          const num = Math.max(1, Math.floor((q - p) / [1, 5.4, 3.0, 1.8][lod]));
          for (let i = 0; i < num; i++) {
            const t = mix(p, q, (i + 0.5) / num),
              center = plan(t, 0.45),
              top = mix(low1, low2, (i + 0.5) / num) + ht;
            block(
              out,
              'course',
              center[0] - 0.41,
              top - 0.14,
              center[1] - 0.41,
              0.82,
              0.73,
              0.82,
              C.course,
            );
          }
        }
      }
    }
  }
}

function gateway(out, g, grade, lod) {
  const [x, z] = g.center,
    horizontal = g.direction === 'east' || g.direction === 'west',
    lion = g.direction === 'east';
  const cross = horizontal ? g.depth : g.width,
    longitudinal = horizontal ? g.width : g.depth;
  const u = horizontal ? [0, 1] : [1, 0],
    v = horizontal ? [1, 0] : [0, 1];
  const point = (a, b) => [x + a * u[0] + b * v[0], z + a * u[1] + b * v[1]];
  const section = (a, b, c, d) => [point(a, c), point(b, c), point(b, d), point(a, d)];
  const gateGrade = grade(g.center),
    spring = gateGrade + (lion ? 6.4 : 4.8),
    roof = spring + (lion ? 3.45 : 2.3);
  const span = lion ? 2.24 : 1.68,
    e = cross * 0.51,
    l = longitudinal * 0.43;
  for (const [a, b] of [
    [-e, -span],
    [span, e],
  ]) {
    shell(out, section(a, b, -l, l), (p) => grade(p) - 0.7, roof, {
      wall: 'wall',
      color: lion ? C.gate : C.wall,
    });
    if (lod > 0)
      for (const off of [-l, l]) {
        const ring = section(a - 0.22, b + 0.22, off - 0.47, off + 0.33);
        shell(out, ring, (p) => grade(p) - 0.32, spring + 0.55, {
          wall: 'course',
          color: C.course,
        });
      }
  }
  shell(out, section(-span, span, -l, l), () => spring, roof, { wall: 'wall', color: C.wall });
  face(
    out,
    'shade',
    section(-span, span, -l, l).map((p) => at(p, spring)),
    [0, -1, 0],
    C.interior,
  );
  const w = horizontal ? longitudinal * 0.91 : cross * 1.03,
    d = horizontal ? cross * 1.03 : longitudinal * 0.91;
  roofPyramid(
    out,
    x,
    z,
    w,
    d,
    roof,
    roof + (lion ? 10.4 : 6.2),
    lion ? (lod > 1 ? [5, 4] : [3, 2]) : lod > 2 ? [5] : [3],
    lod,
    0,
  );
  if (lion) {
    // The photographed facade has a subordinate porch above the open portal.
    const xp = x + l * 0.83;
    shell(out, rect(xp - 1.3, z + 4.2, xp + 1.65, z - 4.2), () => spring + 0.98, roof + 0.7, {
      wall: 'course',
      color: C.gate,
    });
    roofPyramid(out, xp, z, 4.3, 8.98, roof + 0.67, roof + 4.82, lod > 0 ? [4] : [2], lod);
    if (lod > 0)
      for (const s of [-1, 1]) {
        const a = point(s * (span + 0.9), l + 1.15),
          y = grade(a);
        block(out, 'base', a[0] - 0.77, y - 0.28, a[1] - 0.59, 1.54, 0.77, 1.18, C.base);
        block(out, 'wall', a[0] - 0.55, y + 0.43, a[1] - 0.43, 1.1, 0.88, 0.86, C.gate);
        turning(
          out,
          a[0] - 0.23,
          a[1],
          [
            [y + 1.24, 0.37],
            [y + 1.56, 0.4],
            [y + 1.76, 0.25],
          ],
          lod,
          'course',
          C.gate,
        );
      }
  }
}

function draw(out, lod, dimensions, grade) {
  wallRuns(out, dimensions.outline, dimensions.gates, grade, lod);
  for (const g of dimensions.gates) gateway(out, g, grade, lod);
  const [lion] = dimensions.gates,
    px = lion.center[0] + 13.8,
    pz = lion.center[1],
    y = grade([px, pz]);
  plinth(out, px, pz, 3.1, 3.1, y + 0.82, grade, lod);
  turning(
    out,
    px,
    pz,
    [
      [y + 0.83, 1.48],
      [y + 1.05, 1.47],
      [y + 1.31, 1.11],
      [y + 1.62, 0.66],
      [y + 10.62, 0.52],
      [y + 10.94, 0.64],
      [y + 11.33, 0.85],
      [y + 11.63, 0.62],
      [y + 12.1, 0.21],
    ],
    lod,
    'base',
    C.column,
  );
  shrine(out, dimensions.halls[0], grade, lod);
  dimensions.halls.slice(1).forEach((h, i) => {
    hall(out, h, i + 1, grade, lod);
  });
}

const temple = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [151, 94, 153],
    lookAt: [37, 10, 0],
    yaw: 0.84,
    sun: [260, 460, -330],
    brief:
      'Standing Jagannath Temple, with a curving five-part stone spire, stepped halls and walled entries across the precinct in Puri.',
    views: [
      { name: 'axial-halls-from-south', position: [69, 34, 104], lookAt: [34, 13, 0] },
      { name: 'lion-gate-and-aruna-stambha', position: [167, -12.9, 12], lookAt: [140, -1, 0] },
      { name: 'shrine-and-porch-roofs', position: [-42, 33, -53], lookAt: [15, 19, 0] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = temple;
export const model = { ...temple.model, category: 'temple' };
