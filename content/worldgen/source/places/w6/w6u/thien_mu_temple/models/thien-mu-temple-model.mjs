import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { floorSampler } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grade = floorSampler(read('terrain-grid.json'));
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.91 },
  glaze: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const brick = rgb('9d6651');
const agedBrick = rgb('865b4f');
const stone = rgb('939084');
const paving = rgb('b2a293');
const sandstone = rgb('c6b7a1');
const pink = rgb('b17d72');
const goldPaint = rgb('c4a06b');
const charcoal = rgb('45433e');
const dark = rgb('534a43');
const red = rgb('855346');
const timber = rgb('735344');
const plum = rgb('806452');
const tile = rgb('965f47');
const blue = rgb('647681');
const green = rgb('697d63');
const gilt = rgb('b5a168');

const byWay = (id) => frame.features.find((feature) => feature.id === 'way/' + id).points;
const bounds = (points) => {
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const left = Math.min(...xs),
    right = Math.max(...xs);
  const rear = Math.min(...zs),
    front = Math.max(...zs);
  return {
    left,
    right,
    rear,
    front,
    x: (left + right) / 2,
    z: (rear + front) / 2,
    width: right - left,
    depth: front - rear,
  };
};
const towerBounds = bounds(frame.geometry.outline);
const gateBounds = bounds(byWay(1205452741));
const mainBounds = bounds(byWay(205794919));
const memorialBounds = bounds(byWay(206108046));
const rearHalls = [bounds(byWay(205794918)), bounds(byWay(205794915))];
const pavilions = [byWay(1494518277), byWay(1494518278)].map(bounds);
const octagonFacing = Math.PI / 8;

function block(out, slot, x0, z0, x1, z1, lo, hi, color) {
  abox(out, slot, [x0, lo, z0], [x1, hi, z1], color, { bottom: false });
}

function panel(out, slot, F, u, low, width, height, d, tone) {
  quad4(
    out,
    slot,
    F.P(u - width / 2, low, d),
    F.P(u + width / 2, low, d),
    F.P(u + width / 2, low + height, d),
    F.P(u - width / 2, low + height, d),
    tone,
  );
}

function roundedOpening(out, F, u, y, w, h, d, steps, color) {
  const radius = w / 2;
  const outline = [
    [u - radius, y],
    [u + radius, y],
  ];
  const spring = y + h - radius * 0.85;
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    outline.push([u + radius * Math.cos(a), spring + radius * 0.85 * Math.sin(a)]);
  }
  fan(
    out,
    'dark',
    outline.map(([x, y]) => F.P(x, y, d)),
    color,
  );
}

function circularVent(out, F, u, h, r, d, lod) {
  const n = lod > 1 ? 12 : 7;
  const circle = (radius, depth) =>
    Array.from({ length: n }, (_, i) => {
      const ang = (i * 2 * Math.PI) / n;
      return F.P(u + radius * Math.cos(ang), h + radius * Math.sin(ang), depth);
    });
  if (lod > 1) fan(out, 'plaster', circle(r * 1.36, d - 0.015), sandstone);
  fan(out, 'dark', circle(r, d), dark);
}

function poly(out, slot, x, z, profile, sides, angle, tone, cap = false) {
  loft(
    out,
    slot,
    profile.map(([y, radius]) => radialRing(y, radius, radius, sides, [x, z], angle)),
    tone,
    { cap },
  );
}

function curvedTileRim(out, x, z, y, radius, sides, angle, scale, tone, lod) {
  const rings =
    lod > 0
      ? [
          [y - 0.24 * scale, radius - 0.34 * scale],
          [y - 0.045 * scale, radius],
          [y + 0.13 * scale, radius - 0.08 * scale],
          [y + 0.48 * scale, radius - 0.58 * scale],
        ]
      : [
          [y - 0.18 * scale, radius - 0.26 * scale],
          [y, radius],
          [y + 0.43 * scale, radius - 0.53 * scale],
        ];
  poly(out, 'tile', x, z, rings, sides, angle, tone);
  if (lod > 1) {
    const perimeter = radialRing(
      y + 0.016 * scale,
      radius + 0.014,
      radius + 0.014,
      sides,
      [x, z],
      angle,
    );
    for (const [i, a] of perimeter.entries()) {
      const b = perimeter[(i + 1) % sides];
      beamPath(
        out,
        'glaze',
        [
          a,
          [x + (a[0] - x) * 1.035, y + 0.17 * scale, z + (a[2] - z) * 1.035],
          [x + (a[0] - x) * 1.043, y + 0.31 * scale, z + (a[2] - z) * 1.043],
        ],
        0.106 * scale,
        0.112 * scale,
        sandstone,
      );
      if (lod === 3)
        for (let j = 1; j <= Math.round(radius * 2.4); j++) {
          const t = j / (Math.round(radius * 2.4) + 1);
          const bx = a[0] + (b[0] - a[0]) * t;
          const bz = a[2] + (b[2] - a[2]) * t;
          beam(
            out,
            'tile',
            [bx, y + 0.105 * scale, bz],
            [x + (bx - x) * 0.925, y + 0.245 * scale, z + (bz - z) * 0.925],
            0.075 * scale,
            0.062 * scale,
            j % 3 === 0 ? tile : tone,
          );
        }
    }
  }
}

const storeys = [
  [0.0, 4.14, 4.0],
  [4.14, 7.76, 3.55],
  [7.76, 11.01, 3.18],
  [11.01, 13.83, 2.81],
  [13.83, 16.24, 2.5],
  [16.24, 18.56, 2.2],
  [18.56, 20.6, 1.91],
];

function tower(out, lod) {
  const { x, z } = towerBounds;
  const g = grade([x, z]);
  const start = g + 0.58;
  const height = plan.dimensions.documentedTowerHeightM;
  poly(
    out,
    'stone',
    x,
    z,
    [
      [g - 1.47, 5.68],
      [start - 0.13, 5.68],
      [start + 0.08, 5.5],
    ],
    8,
    octagonFacing,
    stone,
    true,
  );
  for (const [index, [low, high, radius]] of storeys.entries()) {
    const y = start + low;
    const top = start + high;
    poly(
      out,
      'brick',
      x,
      z,
      [
        [y, radius],
        [top - 0.15, radius * 0.975],
      ],
      8,
      octagonFacing,
      index > 4 ? agedBrick : brick,
    );
    curvedTileRim(
      out,
      x,
      z,
      top - 0.13,
      radius + 0.52,
      8,
      octagonFacing,
      1 - index * 0.05,
      index % 3 === 0 ? green : plum,
      lod,
    );
    const perimeter = radialRing(y, radius, radius, 8, [x, z], octagonFacing);
    for (const [j, a] of perimeter.entries()) {
      const b = perimeter[(j + 1) % perimeter.length];
      const F = wallFace([a[0], a[2]], [b[0], b[2]]);
      const [nx, nz] = F.normal;
      const u = F.length * 0.5;
      const frontOrRear = Math.abs(nz) > 0.93;
      if (frontOrRear) {
        if (lod === 0 && nz < 0) continue;
        const width = Math.max(0.72, 1.27 - index * 0.073);
        const doorY = y + (index === 0 ? 0.22 : 0.32);
        const h = (top - y) * (index === 0 ? 0.55 : 0.62);
        roundedOpening(out, F, u, doorY, width, h, 0.053, lod > 1 ? 9 : 5, charcoal);
        if (lod > 0) {
          for (const offset of [-1, 1]) {
            panel(
              out,
              'plaster',
              F,
              u + offset * (width * 0.55 + 0.09),
              doorY + 0.11,
              0.17,
              h + 0.05,
              0.067,
              sandstone,
            );
            if (lod > 1)
              panel(
                out,
                'glaze',
                F,
                u + offset * (width * 0.55 + 0.09),
                doorY + 0.28,
                0.058,
                h * 0.65,
                0.072,
                blue,
              );
          }
          panel(out, 'stone', F, u, doorY - 0.077, width + 0.43, 0.11, 0.075, stone);
          if (index < 4 && lod > 1)
            for (let k = 1; k < 6; k++)
              panel(
                out,
                'wood',
                F,
                u + width * (k / 6 - 0.5),
                doorY + 0.23,
                0.047,
                h * 0.52,
                0.096,
                timber,
              );
        }
      } else if (lod > 0 && (lod > 1 || Math.abs(nx) > 0.6)) {
        circularVent(out, F, u, y + (top - y) * 0.48, 0.23 - index * 0.012, 0.055, lod);
      }
    }
  }
  poly(
    out,
    'tile',
    x,
    z,
    [
      [start + 20.41, 1.58],
      [start + 20.77, 0.24],
    ],
    8,
    octagonFacing,
    plum,
    true,
  );
  poly(
    out,
    'glaze',
    x,
    z,
    [
      [start + 20.75, 0.19],
      [start + 20.92, 0.19],
      [start + 21.04, 0.112],
      [start + height, 0.035],
    ],
    8,
    octagonFacing,
    gilt,
    true,
  );
  if (lod > 0) {
    for (let step = 0; step < 3; step++) {
      const w = 2.05 + step * 0.24;
      block(
        out,
        'stone',
        x - w / 2,
        z + 4.85 + step * 0.3,
        x + w / 2,
        z + 5.29 + step * 0.3,
        g - 0.79,
        start + 0.03 - step * 0.195,
        stone,
      );
    }
  }
}

function sweptRoof(out, x, z, halfSpan, halfDepth, y, rise, hip, lod, color) {
  const spans = lod > 0 ? [-1, -0.9, -0.65, -0.27, 0, 0.27, 0.65, 0.9, 1] : [-1, 1];
  const slopes =
    lod > 0
      ? [
          [0, 0],
          [0.24, 0.105],
          [0.57, 0.4],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.48, 0.29],
          [1, 1],
        ];
  const upturn = (u) => 0.31 * Math.pow(Math.abs(u), 5);
  for (const face of [-1, 1]) {
    const P = (u, [depth, height], lift = 0) => [
      x + u * (halfSpan - hip * depth),
      y + rise * height + upturn(u) * (1 - depth * 0.53) + lift,
      z + face * halfDepth * (1 - depth),
    ];
    for (const [i, u] of spans.entries()) {
      if (i === 0) continue;
      const v = spans[i - 1];
      const a = P(v, slopes[0]);
      const b = P(u, slopes[0]);
      const c = [b[0], b[1] - 0.19, b[2]];
      const d = [a[0], a[1] - 0.19, a[2]];
      const fascia = [d, c, b, a];
      quad4(out, 'glaze', ...(face > 0 ? fascia : fascia.reverse()), blue);
      for (let j = 1; j < slopes.length; j++) {
        const q = [P(v, slopes[j - 1]), P(u, slopes[j - 1]), P(u, slopes[j]), P(v, slopes[j])];
        quad4(out, 'tile', ...(face > 0 ? q : q.reverse()), color);
      }
    }
    if (lod > 1)
      for (const end of [-1, 1])
        beamPath(
          out,
          'glaze',
          slopes.map((level) => P(end, level, 0.027)),
          0.14,
          0.16,
          blue,
        );
    if (lod === 3 && halfSpan > 4.5)
      for (let i = 0; i < Math.round(halfSpan * 4); i++) {
        const u = (2 * (i + 0.5)) / Math.round(halfSpan * 4) - 1;
        const first = P(u, slopes[0], 0.026);
        const next = P(u, [0.09, 0.035], 0.018);
        beam(out, 'tile', first, next, 0.088, 0.079, color);
      }
  }

  // Close the hipped ends between paired points of the two long roof slopes.
  for (const end of [-1, 1]) {
    const at = ([d, h], face) => [
      x + end * (halfSpan - hip * d),
      y + rise * h + upturn(1) * (1 - d * 0.53),
      z + face * halfDepth * (1 - d),
    ];
    for (let j = 1; j < slopes.length; j++) {
      const a = at(slopes[j - 1], -1),
        b = at(slopes[j - 1], 1);
      const c = at(slopes[j], -1),
        d = at(slopes[j], 1);
      if (j === slopes.length - 1) tri(out, 'tile', ...(end > 0 ? [b, a, c] : [a, b, c]), color);
      else quad4(out, 'tile', ...(end > 0 ? [b, a, c, d] : [a, b, d, c]), color);
    }
  }
  const ridgeY = y + rise + 0.05;
  if (lod > 0)
    beamPath(
      out,
      'glaze',
      [
        [x - halfSpan + hip + 0.06, ridgeY + 0.31, z],
        [x - halfSpan + hip + 0.58, ridgeY + 0.04, z],
        [x + halfSpan - hip - 0.58, ridgeY + 0.04, z],
        [x + halfSpan - hip - 0.06, ridgeY + 0.31, z],
      ],
      0.18,
      0.22,
      blue,
    );
  if (lod > 1) {
    for (const mark of [-0.76, -0.36, 0, 0.36, 0.76]) {
      const px = x + mark * (halfSpan - hip);
      const h = mark === 0 ? 0.46 : 0.22;
      beam(out, 'glaze', [px - 0.23, ridgeY + 0.01, z], [px, ridgeY + h, z], 0.11, 0.12, sandstone);
      beam(out, 'glaze', [px, ridgeY + h, z], [px + 0.23, ridgeY + 0.01, z], 0.11, 0.12, sandstone);
    }
  }
}

function gateArches(out, F, base, lod) {
  const n = [4, 5, 9, 12][lod];
  for (const [u, width, spring, rise] of [
    [-3.35, 1.63, 1.62, 0.63],
    [0, 1.75, 1.69, 0.73],
    [3.35, 1.63, 1.62, 0.63],
  ]) {
    const r = width / 2;
    const point = (j) => {
      const a = Math.PI * (1 - j / n);
      return F.P(u + r * Math.cos(a), base + spring + rise * Math.sin(a), 0.022);
    };
    for (let j = 1; j <= n; j++) {
      const a = point(j - 1);
      const b = point(j);
      quad4(out, 'plaster', a, b, [b[0], base + 2.89, b[2]], [a[0], base + 2.89, a[2]], goldPaint);
      if (lod > 1)
        quad4(
          out,
          'stone',
          F.P((a[0] - F.origin[0]) * F.along[0], a[1], -0.41),
          F.P((b[0] - F.origin[0]) * F.along[0], b[1], -0.41),
          b,
          a,
          sandstone,
        );
    }
    if (lod > 0)
      for (const s of [-1, 1]) {
        panel(out, 'wood', F, u + s * (r + 0.27), base + 0.11, 0.36, 1.93, 0.044, red);
        if (lod > 1)
          for (let k = -1; k <= 1; k++)
            panel(
              out,
              'glaze',
              F,
              u + s * (r + 0.27) + k * 0.09,
              base + 1.07,
              0.025,
              0.71,
              0.048,
              gilt,
            );
      }
  }
}

function gate(out, lod) {
  const { x, z, left, right, rear, front } = gateBounds;
  const g = grade([x, z]);
  const low = g + 0.15;
  block(out, 'stone', left - 0.36, rear - 0.46, right + 0.36, front + 0.43, g - 1.45, low, stone);
  for (const [a, b] of [
    [-5.29, -4.17],
    [-2.53, -0.875],
    [0.875, 2.53],
    [4.17, 5.29],
  ])
    block(out, 'plaster', x + a, rear + 0.14, x + b, front - 0.12, low, low + 2.9, goldPaint);
  gateArches(out, facade([x, front - 0.12], [1, 0]), low, lod);
  gateArches(out, facade([x, rear + 0.14], [-1, 0]), low, lod);
  block(
    out,
    'wood',
    left - 0.22,
    rear - 0.16,
    right + 0.23,
    front + 0.18,
    low + 2.77,
    low + 3.04,
    red,
  );
  sweptRoof(out, x, z, 5.77, 2.61, low + 3.03, 1.02, 0.9, lod, tile);
  for (const s of [-1, 1])
    block(
      out,
      'plaster',
      x + s * 1.95 - 0.25,
      z - 1.53,
      x + s * 1.95 + 0.25,
      z + 1.53,
      low + 3.73,
      low + 5.65,
      goldPaint,
    );
  block(out, 'wood', x - 2.07, z - 1.49, x + 2.07, z + 1.49, low + 3.66, low + 3.94, red);
  block(out, 'plaster', x - 2.04, z - 0.142, x + 2.04, z + 0.142, low + 3.82, low + 5.8, charcoal);
  for (const s of [-1, 1]) {
    block(
      out,
      'wood',
      x - 1.82,
      z + s * 1.38 - 0.07,
      x + 1.82,
      z + s * 1.38 + 0.07,
      low + 4.27,
      low + 4.37,
      red,
    );
    if (lod > 1)
      for (let u = -1.68; u < 1.85; u += 0.19)
        block(
          out,
          'wood',
          x + u - 0.035,
          z + s * 1.38 - 0.025,
          x + u + 0.035,
          z + s * 1.38 + 0.025,
          low + 3.95,
          low + 4.29,
          red,
        );
  }
  sweptRoof(out, x, z, 2.58, 1.8, low + 5.57, 0.96, 0.61, lod, tile);
}

function hall(out, b, main, lod) {
  const { x, z, left, right, rear, front, width, depth } = b;
  const g = grade([x, z]);
  const floor = g + 0.42;
  const eave = floor + (main ? 4.28 : 3.33);
  const porch = main ? 3.05 : 1.58;
  const trimSide = main ? 3.73 : 2.01;
  block(out, 'stone', left, rear, right, front, g - 2.25, floor, stone);
  block(
    out,
    'plaster',
    left + 0.29,
    rear + 0.21,
    right - 0.26,
    front - porch,
    floor,
    eave - 0.12,
    main ? pink : goldPaint,
  );
  for (const [a, b] of [
    [left + 0.23, left + trimSide],
    [right - trimSide, right - 0.23],
  ])
    block(
      out,
      'plaster',
      a,
      front - porch,
      b,
      front - 0.39,
      floor,
      eave - 0.2,
      main ? pink : goldPaint,
    );
  const F = facade([x, front - porch], [1, 0]);
  const start = left + trimSide + 0.38;
  const end = right - trimSide - 0.38;
  panel(out, 'dark', F, 0, floor, end - start, eave - floor - 0.12, 0.037, charcoal);
  for (let i = 0; i < (main ? 7 : 4); i++) {
    const u = start + (i / (main ? 6 : 3)) * (end - start);
    block(
      out,
      'stone',
      u - 0.245,
      front - 0.88,
      u + 0.245,
      front - 0.41,
      floor,
      floor + 0.21,
      sandstone,
    );
    block(
      out,
      'wood',
      u - 0.174,
      front - 0.81,
      u + 0.174,
      front - 0.47,
      floor + 0.19,
      eave - 0.09,
      i % 2 ? red : timber,
    );
    if (main && lod > 1)
      beam(
        out,
        'wood',
        [u, eave - 0.54, front - 0.64],
        [u, eave - 0.16, front + 0.26],
        0.14,
        0.15,
        timber,
      );
  }
  if (lod > 0) {
    const mid = main ? 4.4 : 2.75;
    for (let i = 0; i < 3; i++)
      block(
        out,
        'stone',
        x - mid,
        front - 0.1 + 0.34 * i,
        x + mid,
        front + 0.27 + 0.34 * i,
        floor - 1.24,
        floor - 0.1 - i * 0.18,
        paving,
      );
  }
  sweptRoof(
    out,
    x,
    z,
    width / 2 + 0.55,
    depth / 2 + 0.48,
    eave,
    main ? 3.17 : 3.03,
    main ? 3.83 : 2.9,
    lod,
    tile,
  );
  if (main) {
    block(
      out,
      'plaster',
      left + 1.26,
      z - depth * 0.278,
      right - 1.26,
      z + depth * 0.278,
      eave - 0.18,
      eave + 1.99,
      sandstone,
    );
    const u = facade([x, z + depth * 0.28], [1, 0]);
    const rearWall = facade([x, z - depth * 0.28], [-1, 0]);
    for (const F of [u, rearWall]) {
      panel(out, 'plaster', F, 0, eave + 1.29, width - 2.52, 0.87, 0.02, sandstone);
      if (lod > 1)
        for (let u = -width * 0.44; u < width * 0.45; u += 0.89)
          panel(out, 'glaze', F, u, eave + 1.69, 0.49, 0.16, 0.037, blue);
    }
    sweptRoof(out, x, z, width / 2 - 0.65, depth * 0.3, eave + 1.99, 2.15, 2.89, lod, plum);
  }
}

function flankingPavilion(out, { x, z, width }, lod) {
  const y = grade([x, z]) + 0.25;
  const r = width * 0.57;
  poly(
    out,
    'stone',
    x,
    z,
    [
      [y - 1.22, r],
      [y + 0.04, r],
    ],
    6,
    0.19,
    stone,
    true,
  );
  for (const [px, , pz] of radialRing(y, r * 0.72, r * 0.72, 6, [x, z], 0.19))
    block(out, 'plaster', px - 0.095, pz - 0.095, px + 0.095, pz + 0.095, y, y + 2.56, goldPaint);
  curvedTileRim(out, x, z, y + 2.65, r * 1.24, 6, 0.19, 0.57, green, lod);
  poly(
    out,
    'tile',
    x,
    z,
    [
      [y + 2.81, r * 1.03],
      [y + 3.21, r * 0.57],
      [y + 3.47, r * 0.13],
      [y + 3.57, 0.055],
    ],
    6,
    0.19,
    tile,
    true,
  );
}

function memorial(out, lod) {
  const { x, z } = memorialBounds;
  const raw = grade([x, z]);
  const deck = raw + 0.61;
  block(out, 'stone', x - 6.6, z - 5.08, x + 6.6, z + 5.01, raw - 1.39, deck, paving);
  poly(
    out,
    'stone',
    x,
    z,
    [
      [deck, 1.94],
      [deck + 0.29, 1.94],
      [deck + 0.45, 1.7],
      [deck + 1.83, 1.56],
    ],
    8,
    octagonFacing,
    sandstone,
    true,
  );
  poly(
    out,
    'stone',
    x,
    z,
    [
      [deck + 1.7, 1.47],
      [deck + 5.21, 0.34],
    ],
    8,
    octagonFacing,
    stone,
    true,
  );
  for (const [j, r] of [1.76, 1.54, 1.35, 1.13, 0.95, 0.72].entries()) {
    const y = deck + 1.72 + j * 0.64;
    poly(
      out,
      'stone',
      x,
      z,
      [
        [y, r * 0.79],
        [y + 0.44, r * 0.63],
      ],
      8,
      octagonFacing,
      stone,
    );
    curvedTileRim(out, x, z, y + 0.16, r, 8, octagonFacing, 0.35, green, lod);
  }
  poly(
    out,
    'glaze',
    x,
    z,
    [
      [deck + 5.0, 0.26],
      [deck + 5.24, 0.16],
      [deck + 5.67, 0.062],
    ],
    8,
    octagonFacing,
    gilt,
    true,
  );
  for (const side of [-1, 1]) {
    const left = side < 0 ? x - 6.37 : x + 1.84;
    const right = side < 0 ? x - 1.84 : x + 6.37;
    block(out, 'stone', left, z + 4.74, right, z + 4.98, deck + 0.52, deck + 0.64, stone);
    if (lod > 0)
      for (let j = 0; j <= (lod === 3 ? 14 : 6); j++) {
        const p = left + ((right - left) * j) / (lod === 3 ? 14 : 6);
        block(out, 'stone', p - 0.051, z + 4.76, p + 0.051, z + 4.94, deck, deck + 0.55, stone);
      }
  }
  for (let j = 0; j < 3; j++)
    block(
      out,
      'stone',
      x - 1.84,
      z + 4.98 + j * 0.31,
      x + 1.84,
      z + 5.31 + j * 0.31,
      raw - 0.66,
      deck - 0.18 * (j + 1),
      sandstone,
    );
}

function build(out, lod) {
  tower(out, lod);
  gate(out, lod);
  hall(out, mainBounds, true, lod);
  for (const range of rearHalls) hall(out, range, false, lod);
  for (const p of pavilions) flankingPavilion(out, p, lod);
  memorial(out, lod);
}

export function skyline(out) {
  const { x, z } = towerBounds;
  const y = grade([x, z]) + 0.58;
  poly(
    out,
    'stone',
    x,
    z,
    [
      [y - 1.99, 5.65],
      [y + 0.08, 5.52],
    ],
    8,
    octagonFacing,
    stone,
    true,
  );
  for (const [bottom, top, r] of storeys) {
    poly(
      out,
      'brick',
      x,
      z,
      [
        [y + bottom, r],
        [y + top - 0.16, r * 0.975],
      ],
      8,
      octagonFacing,
      brick,
    );
    poly(
      out,
      'tile',
      x,
      z,
      [
        [y + top - 0.27, r + 0.22],
        [y + top - 0.11, r + 0.5],
        [y + top + 0.19, r - 0.14],
      ],
      8,
      octagonFacing,
      plum,
    );
  }
  poly(
    out,
    'glaze',
    x,
    z,
    [
      [y + 20.55, 1.42],
      [y + 20.89, 0.17],
      [y + plan.dimensions.documentedTowerHeightM, 0.049],
    ],
    8,
    octagonFacing,
    gilt,
  );
  const gateFloor = grade([gateBounds.x, gateBounds.z]) + 0.15;
  const gx = gateBounds.x,
    gz = gateBounds.z;
  block(
    out,
    'stone',
    gx - 5.55,
    gz - 2.65,
    gx + 5.55,
    gz + 2.65,
    gateFloor - 1.58,
    gateFloor,
    stone,
  );
  for (const [left, right] of [
    [-5.29, -4.17],
    [-2.53, -0.875],
    [0.875, 2.53],
    [4.17, 5.29],
  ])
    block(
      out,
      'plaster',
      gx + left,
      gz - 2.22,
      gx + right,
      gz + 2.22,
      gateFloor,
      gateFloor + 2.89,
      goldPaint,
    );
  sweptRoof(out, gx, gz, 5.77, 2.61, gateFloor + 3.03, 1.02, 0.9, 0, tile);
  block(
    out,
    'plaster',
    gx - 2.22,
    gz - 1.53,
    gx + 2.22,
    gz + 1.53,
    gateFloor + 3.57,
    gateFloor + 5.6,
    goldPaint,
  );
  sweptRoof(out, gx, gz, 2.58, 1.8, gateFloor + 5.57, 0.96, 0.61, 0, tile);
  for (const [i, b] of [mainBounds, ...rearHalls].entries()) {
    const level = grade([b.x, b.z]);
    const eave = level + (i === 0 ? 4.7 : 3.75);
    block(
      out,
      'plaster',
      b.left + 0.08,
      b.rear + 0.04,
      b.right - 0.09,
      b.front - 0.07,
      level - 1.8,
      eave - 0.16,
      i === 0 ? pink : goldPaint,
    );
    sweptRoof(out, b.x, b.z, b.width / 2 + 0.55, b.depth / 2 + 0.48, eave, 3.03, 2.9, 0, tile);
    if (i === 0)
      sweptRoof(out, b.x, b.z, b.width / 2 - 0.65, b.depth * 0.3, eave + 1.99, 2.15, 2.89, 0, plum);
  }
  for (const b of pavilions) {
    const local = grade([b.x, b.z]);
    poly(
      out,
      'stone',
      b.x,
      b.z,
      [
        [local - 0.88, 1.63],
        [local + 2.18, 1.34],
      ],
      6,
      0.19,
      stone,
    );
    poly(
      out,
      'tile',
      b.x,
      b.z,
      [
        [local + 2.19, 1.64],
        [local + 3.82, 0.09],
      ],
      6,
      0.19,
      green,
    );
  }
  const m = memorialBounds;
  const base = grade([m.x, m.z]) + 0.6;
  block(out, 'stone', m.x - 6.6, m.z - 5.08, m.x + 6.6, m.z + 5.01, base - 1.8, base, paving);
  const rings = [
    [base, 1.93],
    [base + 1.62, 1.55],
  ];
  for (const [i, r] of [1.76, 1.54, 1.35, 1.13, 0.95, 0.72].entries()) {
    rings.push([base + 1.74 + 0.64 * i, r], [base + 2.12 + 0.64 * i, r * 0.6]);
  }
  rings.push([base + 5.66, 0.04]);
  poly(out, 'stone', m.x, m.z, rings, 6, octagonFacing, stone);
}

export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [170, 106, 223];
const lookAt = [0, 12, 3];
const recipe = 'thien-mu-temple-model.mjs';
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Thiên Mụ’s seven-storey Phước Duyên Tower, Tam Quan gate, Đại Hùng worship hall and ridge-top axial compound.',
  camera,
  lookAt,
  sunDirection: [39, 82, 64],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: frame.features.map(({ points }) => points),
    minimumCoverage: 0.9,
    basis:
      'Independent native tower, gate, hall, memorial and pavilion footprints at the named temple.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_ashlar',
    'plaster_lime',
    'tile_ceramic',
    'wood_vertical',
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'phuoc-duyen-from-the-river', position: [12, 5.1, 150], lookAt: [-1, 11, 118] },
    { name: 'tam-quan-and-tower', position: [-13.2, 8.1, 71], lookAt: [-1, 9.1, 102] },
    { name: 'dai-hung-hall', position: [27, 9.2, 71], lookAt: [-1, 5.25, 34] },
    { name: 'rear-memorial-stupa', position: [10.7, 8.3, -113], lookAt: [-1, 6.6, -132] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thien-mu-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.31,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.57, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.064, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
