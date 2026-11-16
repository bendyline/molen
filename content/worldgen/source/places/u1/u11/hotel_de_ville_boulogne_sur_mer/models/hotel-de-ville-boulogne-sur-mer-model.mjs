/** Hôtel de Ville and attached medieval belfry, Boulogne-sur-Mer. */
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
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  brick: surface('wall', 'brick', 0.94),
  limestone: surface('trim', 'stone_limestone_raw', 0.89),
  rubble: surface('foundation', 'stone_limestone_weathered', 0.94),
  slate: surface('roof', 'slate', 0.87),
  glass: surface('window', 'window_grid', 0.57, 0.035),
  iron: surface('door', 'metal_painted', 0.77, 0.16),
};
const c = palette({
  brick: 'ae6959',
  brickLight: 'b97766',
  brickDark: '945649',
  limestone: 'd3c4aa',
  white: 'e2d4bc',
  darkStone: '999383',
  rubble: 'b1a896',
  mortar: 'bfb49f',
  slate: '676b70',
  ridge: '7b8088',
  glass: '647583',
  darkGlass: '4c565e',
  iron: '484d50',
  wood: '646056',
  gold: 'a99261',
  flagBlue: '405b82',
  flagWhite: 'e8e4d9',
  flagRed: 'b94d52',
});

function portalShape(w, u, base, spring, radius, rise, lod, drawMaterial, color, shaped = true) {
  const n = [4, 6, 9, 13][lod];
  const vertices = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i * 2) / n - 1;
    const contour = shaped
      ? 1 - 0.58 * Math.abs(t) - 0.42 * t * t
      : Math.sqrt(Math.max(0, 1 - t * t));
    return [u + t * radius, spring + rise * contour];
  });
  return {
    n,
    vertices,
    paint(out, depth) {
      panel(out, drawMaterial, w, u - radius, u + radius, base, spring, depth, color);
      face(
        out,
        drawMaterial,
        vertices.map(([x, y]) => w.p(x, y, depth)),
        w.normal,
        color,
      );
    },
  };
}

function archWindow(
  out,
  w,
  u,
  base,
  spring,
  radius,
  rise,
  lod,
  { pointed = false, material = 'glass', color = c.glass } = {},
) {
  const inner = portalShape(w, u, base, spring, radius, rise, lod, material, color, pointed);
  inner.paint(out, 0.034);
  if (lod === 0) return;
  const lip = 0.13;
  const outer = portalShape(
    w,
    u,
    base,
    spring,
    radius + lip,
    rise + lip,
    lod,
    'limestone',
    c.white,
    pointed,
  );
  for (let j = 0; j < inner.n; j++) {
    const [a, b] = inner.vertices[j],
      [d, e] = inner.vertices[j + 1],
      [p, q] = outer.vertices[j + 1],
      [r, s] = outer.vertices[j];
    face(
      out,
      'limestone',
      [w.p(a, b, 0.073), w.p(d, e, 0.073), w.p(p, q, 0.102), w.p(r, s, 0.102)],
      w.normal,
      c.limestone,
    );
  }
  for (const k of [-1, 1]) {
    const a = u + k * radius,
      b = u + k * (radius + lip);
    panel(out, 'limestone', w, Math.min(a, b), Math.max(a, b), base, spring, 0.09, c.limestone);
  }
  panel(
    out,
    'limestone',
    w,
    u - radius - lip,
    u + radius + lip,
    base - 0.12,
    base + 0.018,
    0.1,
    c.white,
  );
  if (lod > 1 && material === 'glass')
    panel(
      out,
      'limestone',
      w,
      u - 0.024,
      u + 0.024,
      base + 0.04,
      spring + rise - 0.03,
      0.06,
      c.white,
    );
}

function roof(out, left, right, front, back, y, ridge, color) {
  const depth = Math.abs(back - front),
    ridgeZ = (front + back) / 2,
    run = Math.min(depth * 0.43, (right - left) * 0.19);
  const a = [left, y, front],
    b = [right, y, front],
    d = [left, y, back],
    c0 = [right, y, back];
  const e = [left + run, ridge, ridgeZ],
    f = [right - run, ridge, ridgeZ];
  face(out, 'slate', [a, b, f, e], up, color);
  face(out, 'slate', [d, e, f, c0], up, color);
  face(out, 'slate', [a, e, d], up, c.slate);
  face(out, 'slate', [b, c0, f], up, c.slate);
  block(out, 'slate', e[0], ridge - 0.06, ridgeZ - 0.09, f[0] - e[0], 0.14, 0.18, c.ridge);
}

function hallEnvelope(out, lod, plan, grade) {
  const points = plan.footprint,
    ring = plan.openRing,
    top = plan.frontEave;
  const sign = areaSign(points);
  for (const [[a, b], i] of pairs(closed(points)).map((w, i) => [w, i])) {
    const w = edge(a, b, sign);
    const wallTop = i >= 25 && i <= 30 ? top : top - 0.022;
    face(
      out,
      'brick',
      [at(a, grade(a) - 0.48), at(b, grade(b) - 0.48), at(b, wallTop), at(a, wallTop)],
      w.normal,
      i % 3 ? c.brick : c.brickLight,
    );
    if (w.length < 4 || (i >= 25 && i <= 29)) continue;
    panel(out, 'limestone', w, 0, w.length, wallTop - 0.32, wallTop - 0.062, 0.044, c.limestone);
    if (lod === 0 || w.length < 6) continue;
    const count = Math.min(10, Math.max(1, Math.round(w.length / 3.1)));
    for (const [bottom, hi] of [
      [1.3, 3.24],
      [5.24, 7.92],
      [9.53, 11.75],
    ])
      for (let j = 0; j < count; j++) {
        const at = ((j + 0.5) * w.length) / count,
          half = Math.min(0.65, (w.length / count) * 0.23);
        opening(
          out,
          w,
          at - half,
          at + half,
          bottom,
          hi,
          'limestone',
          i % 2 ? c.glass : c.darkGlass,
          'glass',
          c.limestone,
          lod,
          0.027,
        );
      }
  }
  const all = [...points, ...ring],
    triangles = earcut(all.flat(), [points.length]);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      'slate',
      triangles.slice(i, i + 3).map((index) => at(all[index], top)),
      up,
      c.ridge,
    );
  const cross = areaSign(ring);
  for (const [a, b] of pairs(closed(ring))) {
    const w = edge(a, b, -cross);
    face(
      out,
      'rubble',
      [at(a, grade(a) - 0.2), at(b, grade(b) - 0.2), at(b, top + 0.22), at(a, top + 0.22)],
      w.normal,
      c.darkStone,
    );
  }
  roof(out, -17.29, 17.3, 0.19, -13.5, top, plan.roofRidge, c.slate);
  roof(out, 9.64, 22.29, -27.1, -49.51, top - 0.03, top + 3.27, c.slate);
  roof(out, 14.62, 23.05, -49.75, -62.75, top - 0.05, top + 2.74, c.slate);
  if (lod > 0)
    for (const [x, z, w] of [
      [-13.5, -7.93, 0.68],
      [12.68, -7.25, 0.85],
      [17.44, -35.5, 0.72],
    ]) {
      const high = z > -14 ? 17.37 : 16.5;
      block(out, 'brick', x - w / 2, 14, z - w * 0.5, w, high - 13.97, w, c.brickDark);
      block(
        out,
        'limestone',
        x - w / 2 - 0.07,
        high,
        z - w * 0.5 - 0.07,
        w + 0.14,
        0.13,
        w + 0.14,
        c.limestone,
      );
    }
}

function townFront(out, lod, plan, grade) {
  const front = plane(0.077, 1),
    entrance = plane(0.857, 1),
    left = plan.frontEndpoints[0][0] + 0.08,
    right = plan.frontEndpoints[1][0] - 0.08;
  const { frontBayCount: count, entranceOffset: door } = plan;
  const bay = (right - left) / count;
  for (const [a, b] of [
    [0.14, 0.77],
    [4.29, 4.6],
    [8.84, 9.29],
    [12.16, 12.53],
    [12.75, 13.08],
  ]) {
    panel(out, 'limestone', front, left, right, a, b, 0.054, c.limestone);
    panel(out, 'limestone', entrance, -7.99, -4, a, b, 0.054, c.limestone);
  }
  for (const x of [-7.88, -4.11])
    panel(out, 'limestone', entrance, x - 0.11, x + 0.11, 0.48, 12.71, 0.059, c.limestone);
  for (let j = 0; j <= count; j++) {
    const x = left + j * bay;
    panel(out, 'limestone', front, x - 0.17, x + 0.17, 0.47, 12.69, 0.058, c.limestone);
    if (lod > 1)
      for (let n = 0; n < 11; n++) {
        const y = 0.86 + n * 1.05;
        panel(out, 'rubble', front, x - 0.18, x + 0.18, y, y + 0.024, 0.071, c.mortar);
      }
    if (j === count) break;
    const threshold = j === 3;
    const mid = threshold ? door : x + bay * 0.5;
    const windowWall = threshold ? entrance : front;
    if (!threshold)
      opening(
        out,
        front,
        mid - 0.66,
        mid + 0.66,
        1.08,
        3.64,
        'limestone',
        c.darkGlass,
        'glass',
        c.white,
        lod,
        0.031,
      );
    archWindow(out, windowWall, mid, 5.09, 7.65, 0.71, 0.39, lod);
    opening(
      out,
      windowWall,
      mid - 0.65,
      mid + 0.65,
      9.74,
      11.97,
      'limestone',
      c.glass,
      'glass',
      c.white,
      lod,
      0.031,
    );
    if (lod > 0) {
      const crown = portalShape(
        windowWall,
        mid,
        12.39,
        12.54,
        0.93,
        0.42,
        lod,
        'limestone',
        c.white,
        false,
      );
      crown.paint(out, 0.121);
    }
    if (lod > 1 && !threshold)
      for (const z of [-0.45, -0.22, 0, 0.22, 0.45])
        panel(out, 'iron', front, mid + z - 0.018, mid + z + 0.018, 1.18, 3.51, 0.073, c.iron);
  }
  opening(
    out,
    entrance,
    door - 0.87,
    door + 0.87,
    0.43,
    3.52,
    'limestone',
    c.wood,
    'iron',
    c.white,
    lod,
    0.028,
  );
  block(out, 'limestone', door - 2.15, 4.19, 0.47, 4.3, 0.34, 1.31, c.limestone);
  block(out, 'limestone', door - 2.18, 4.5, 0.46, 4.36, 0.12, 1.38, c.white);
  const columns = [door - 1.36, door + 1.36];
  const n = [5, 8, 14, 18][lod];
  for (const x of columns)
    ring(
      out,
      'limestone',
      [x, 1.48],
      [
        [0.23, 0.3],
        [0.38, 0.28],
        [0.63, 0.225],
        [3.94, 0.217],
        [4.04, 0.27],
        [4.2, 0.32],
      ],
      n,
      c.white,
    );
  stairs(
    out,
    grade,
    'limestone',
    door - 1.8,
    door + 1.8,
    2.31,
    0.86,
    0.39,
    lod === 0 ? 2 : 4,
    c.limestone,
  );
  const balcony = plane(1.817, 1);
  panel(out, 'iron', balcony, door - 2, door + 2, 5.31, 5.41, 0.016, c.iron);
  const bars = lod === 0 ? 6 : lod === 1 ? 11 : 20;
  for (let i = 0; i < bars; i++) {
    const x = mix(door - 1.94, door + 1.94, i / (bars - 1));
    panel(out, 'iron', balcony, x - 0.021, x + 0.021, 4.58, 5.34, 0.008, c.iron);
  }
  if (lod > 0)
    for (const dx of [-0.86, 0.0, 0.86]) {
      const x = door + dx;
      face(
        out,
        'iron',
        [
          [x - 0.023, 4.66, 1.79],
          [x + 0.023, 4.66, 1.79],
          [x + 0.023, 7.77, 2.59],
          [x - 0.023, 7.77, 2.59],
        ],
        [0, 0, 1],
        c.iron,
      );
      const colors =
        dx < 0 ? [c.flagBlue, c.flagWhite, c.flagRed] : [c.flagBlue, c.flagBlue, c.flagBlue];
      for (let i = 0; i < 3; i++) {
        const a = x + i * 0.21,
          b = a + 0.21;
        face(
          out,
          'iron',
          [
            [a, 7.57, 2.57],
            [b, 7.52, 2.66],
            [b, 6.64, 2.68],
            [a, 6.69, 2.6],
          ],
          [0, 0, 1],
          colors[i],
        );
      }
    }
}

function towerWalls(out, lod, center, width, base, top, grade) {
  const [x, z] = center,
    h = width / 2;
  const outline = rect(x - h, z - h, x + h, z + h);
  shell(out, outline, (p) => grade(p) - 0.58, top, {
    wall: 'rubble',
    roof: 'limestone',
    color: c.rubble,
    roofColor: c.limestone,
  });
  const perimeter = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, perimeter);
    for (const [start, end] of [
      [base, base + 0.29],
      [16.78, 17.03],
      [top - 0.32, top - 0.05],
    ])
      panel(out, 'limestone', w, 0, w.length, start, end, 0.096, c.darkStone);
    for (const u of [w.length * 0.31, w.length * 0.69])
      archWindow(out, w, u, 18.35, 20.62, 0.78, 1.11, lod, {
        pointed: true,
        material: 'iron',
        color: c.iron,
      });
    if (lod > 1) {
      for (const x of [0.44, w.length - 0.68])
        for (let j = 0; j < 12; j++)
          panel(
            out,
            'limestone',
            w,
            x,
            x + 0.33,
            11.42 + j * 0.86,
            11.77 + j * 0.86,
            0.041,
            c.mortar,
          );
    }
  }
}

function disk(out, w, x, y, r, depth, n, material, color) {
  face(
    out,
    material,
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return w.p(x + r * Math.cos(a), y + r * Math.sin(a), depth);
    }),
    w.normal,
    color,
  );
}

function belfry(out, lod, plan, grade) {
  const {
    towerLocal: center,
    belfryBaseWidth: width,
    belfryFirstCrown: deck,
    belfryTop: top,
    belfryTopWidth: upper,
    flagTop,
  } = plan;
  towerWalls(out, lod, center, width, 0.25, deck, grade);
  const [x, z] = center,
    h = width / 2;
  block(
    out,
    'limestone',
    x - h - 0.21,
    deck - 0.17,
    z - h - 0.21,
    width + 0.42,
    0.47,
    width + 0.42,
    c.limestone,
  );
  const base = 23.17;
  const mid = upper * 0.5,
    cut = upper * 0.17;
  const octagon = [
    [x - mid + cut, z - mid],
    [x + mid - cut, z - mid],
    [x + mid, z - mid + cut],
    [x + mid, z + mid - cut],
    [x + mid - cut, z + mid],
    [x - mid + cut, z + mid],
    [x - mid, z + mid - cut],
    [x - mid, z - mid + cut],
  ];
  shell(out, octagon, () => base, top, {
    wall: 'rubble',
    roof: 'limestone',
    color: c.darkStone,
    roofColor: c.limestone,
  });
  const mark = areaSign(octagon);
  for (const [[a, b], i] of pairs(closed(octagon)).map((edge, i) => [edge, i])) {
    const w = edge(a, b, mark),
      u = w.length * 0.5;
    panel(out, 'limestone', w, 0, w.length, top - 0.62, top - 0.37, 0.055, c.limestone);
    panel(out, 'limestone', w, 0, w.length, top - 0.12, top + 0.17, 0.067, c.limestone);
    if (i % 2 === 0) {
      archWindow(out, w, u, 28.43, 30.46, 0.61, 0.73, lod, {
        pointed: true,
        material: 'iron',
        color: c.iron,
      });
      if (i === 4 || i === 2) {
        const n = [9, 16, 24, 28][lod];
        disk(out, w, u, 26.97, 0.59, 0.052, n, 'iron', c.iron);
        disk(out, w, u, 26.97, 0.48, 0.079, n, 'limestone', c.white);
        panel(out, 'iron', w, u - 0.025, u + 0.025, 26.93, 27.37, 0.085, c.iron);
        panel(out, 'iron', w, u - 0.26, u + 0.02, 26.946, 27.009, 0.086, c.iron);
      }
    }
    if (lod > 0)
      for (let k = 0; k < 4; k++) {
        const u = (w.length * (k + 0.5)) / 4;
        panel(out, 'rubble', w, u - 0.11, u + 0.11, top - 0.36, top - 0.1, 0.075, c.darkStone);
      }
  }
  const n = [6, 9, 14, 18][lod];
  for (const dx of [-h + 0.38, h - 0.38])
    for (const dz of [-h + 0.38, h - 0.38]) {
      const p = [x + dx, z + dz];
      ring(
        out,
        'rubble',
        p,
        [
          [deck - 1.49, 0.7],
          [deck - 0.13, 0.72],
          [deck + 0.46, 0.65],
        ],
        n,
        c.darkStone,
      );
      ring(
        out,
        'slate',
        p,
        [
          [deck + 0.42, 0.66],
          [deck + 0.76, 0.54],
          [deck + 2.45, 0.028],
        ],
        n,
        c.slate,
      );
    }
  block(out, 'iron', x - 0.04, top - 0.15, z - 0.04, 0.08, flagTop - top + 0.15, 0.08, c.iron);
  if (lod > 0) {
    const colors = [c.flagBlue, c.flagWhite, c.flagRed];
    for (let i = 0; i < 3; i++) {
      const a = x + i * 0.31,
        b = a + 0.31;
      face(
        out,
        'iron',
        [
          [a, flagTop - 0.06, z],
          [b, flagTop - 0.08, z + 0.05],
          [b, flagTop - 0.61, z + 0.055],
          [a, flagTop - 0.59, z],
        ],
        [0, 0, 1],
        colors[i],
      );
    }
  }
}

function draw(out, lod, plan, grade) {
  hallEnvelope(out, lod, plan, grade);
  townFront(out, lod, plan, grade);
  belfry(out, lod, plan, grade);
}
const building = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [53, 32, 51],
    lookAt: [1, 13, -18],
    yaw: 0.64,
    sun: [-295, 585, 440],
    brief:
      'A ten-bay red-brick civic hall with limestone bays and balcony under dark slate, joined to the medieval square belfry and its clock and octagonal upper stage.',
    views: [
      { name: 'place-godefroy-de-bouillon', position: [16, 8, 41], lookAt: [-1, 13, -8] },
      { name: 'balcony-and-civic-windows', position: [-16, 6, 17], lookAt: [-5.6, 5.2, 0] },
      {
        name: 'square-keep-and-octagonal-stage',
        position: [-24, 28, -42],
        lookAt: [-5.9, 26, -14.6],
      },
      { name: 'rear-wings-and-original-grade', position: [39, 32, -63], lookAt: [5, 11, -29] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = building;
export const model = { ...building.model, category: 'civic' };
