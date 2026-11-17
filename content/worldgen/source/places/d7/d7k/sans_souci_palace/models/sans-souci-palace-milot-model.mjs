/** Royal Sans-Souci at Milot, reconstructed from the surviving outline and early prints. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const { podiumY, principalRoofY, towerEavesY, ridgeY, floorY, northStairFootY } = plan.section;
const west = outline[0][0],
  east = outline[5][0],
  rear = outline[2][1];
const [portalLeft, portalRight] = [outline[7][0], outline[8][0]];
const center = (portalLeft + portalRight) / 2;
const projected = outline[7][1];
const westFront = outline[0][1],
  eastFront = outline[5][1];
const foundation = -8.55;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    plaster: 'e2cfac',
    light: 'eadbbf',
    trim: 'deceb1',
    shade: 'b5a184',
    footing: 'a98f73',
    clay: '816350',
    ridge: '765341',
    brick: '987558',
    paleBrick: 'b09373',
    wood: '605043',
    darkness: '3b382f',
    glass: '596460',
    highlight: '6f7c76',
    pool: '66756b',
    bronze: '87715b',
  }).map(([k, v]) => [k, rgb(v)]),
);

function rectangle(out, slot, x0, x1, y0, y1, z, tint) {
  if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function windowBay(out, x, width, low, top, rise, z, bounds, lod) {
  const [left, right, bottom, ceiling] = bounds,
    a = x - width / 2,
    b = x + width / 2;
  if (lod < 3 && width < 3) {
    rectangle(out, 'plaster', left, right, bottom, ceiling, z, c.plaster);
    rectangle(out, 'accent', a, b, low, top - rise, z + 0.015, c.glass);
    if (lod > 0 && rise > 0) {
      const n = lod === 1 ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const theta = (Math.PI * i) / n,
          phi = (Math.PI * (i + 1)) / n;
        triangle(
          out,
          'accent',
          [
            [x, top - rise, z + 0.015],
            [x - (width * Math.cos(theta)) / 2, top - rise + rise * Math.sin(theta), z + 0.015],
            [x - (width * Math.cos(phi)) / 2, top - rise + rise * Math.sin(phi), z + 0.015],
          ].reverse(),
          c.glass,
        );
      }
    } else if (rise > 0) rectangle(out, 'accent', a, b, top - rise, top - 0.12, z + 0.015, c.glass);
    if (lod > 1)
      box(out, 'limestone', [a - 0.09, low - 0.11, z - 0.04], [b + 0.09, low, z + 0.12], c.trim);
    return;
  }
  rectangle(out, 'plaster', left, a, bottom, ceiling, z, c.plaster);
  rectangle(out, 'plaster', b, right, bottom, ceiling, z, c.plaster);
  rectangle(out, 'plaster', a, b, bottom, low, z, c.plaster);
  const depth = width > 3 ? 0.91 : 0.3,
    d = z - depth;
  const spring = top - rise;
  rectangle(out, 'accent', a, b, low, spring, d, width > 3 ? c.darkness : c.glass);
  const pieces = rise ? [5, 7, 8, 9][lod] : 1;
  for (let i = 0; i < pieces; i++) {
    const p = a + (width * i) / pieces,
      q = a + (width * (i + 1)) / pieces;
    const g = (t) => spring + rise * Math.sin((Math.PI * t) / pieces);
    const u = i === 0 ? spring : g(i),
      v = i + 1 === pieces ? spring : g(i + 1);
    face(
      out,
      'plaster',
      [
        [p, u, z],
        [q, v, z],
        [q, ceiling, z],
        [p, ceiling, z],
      ],
      c.plaster,
    );
    face(
      out,
      'limestone',
      [
        [p, u, z],
        [p, u, d],
        [q, v, d],
        [q, v, z],
      ],
      c.shade,
    );
    if (rise) {
      if (i === 0)
        triangle(
          out,
          'accent',
          [
            [p, spring, d],
            [q, spring, d],
            [q, v, d],
          ],
          c.glass,
        );
      else if (i === pieces - 1)
        triangle(
          out,
          'accent',
          [
            [p, spring, d],
            [q, spring, d],
            [p, u, d],
          ],
          c.glass,
        );
      else
        face(
          out,
          'accent',
          [
            [p, spring, d],
            [q, spring, d],
            [q, v, d],
            [p, u, d],
          ],
          c.glass,
        );
      if (lod > 1 && width > 3)
        beam(out, 'limestone', [p, u, z + 0.03], [q, v, z + 0.03], 0.13, 0.14, c.light);
    }
  }
  face(
    out,
    'limestone',
    [
      [a, low, z],
      [a, low, d],
      [a, spring, d],
      [a, spring, z],
    ],
    c.shade,
  );
  face(
    out,
    'limestone',
    [
      [b, low, d],
      [b, low, z],
      [b, spring, z],
      [b, spring, d],
    ],
    c.trim,
  );
  if (lod === 0) return;
  box(out, 'limestone', [a - 0.17, low - 0.12, z - 0.21], [b + 0.17, low, z + 0.23], c.light);
  if (lod > 1 && width < 3) {
    box(out, 'wood', [x - 0.033, low, d + 0.007], [x + 0.034, spring, d + 0.064], c.wood);
    const y = low + (spring - low) * 0.68;
    box(out, 'wood', [a, y, d + 0.009], [b, y + 0.062, d + 0.071], c.wood);
  }
}

function facade(out, from, to, bands, lod) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const local = transform(out, Math.atan2(-dz, dx), [from[0], 0, from[1]]);
  for (const { bottom, ceiling, count, width, low, top, rise } of bands) {
    if (lod === 0) {
      rectangle(local, 'plaster', 0, length, bottom, ceiling, 0, c.plaster);
      const bays = Math.min(count, 3);
      for (let i = 0; i < bays; i++) {
        const span = length / bays,
          x = (i + 0.5) * span,
          half = Math.min(span * 0.28, width * 1.1);
        rectangle(local, 'accent', x - half, x + half, low + 0.42, top - 0.29, 0.012, c.glass);
      }
      continue;
    }
    const step = (length - 0.48) / Math.max(count, 1);
    rectangle(local, 'plaster', 0, count ? 0.24 : length, bottom, ceiling, 0, c.plaster);
    for (let i = 0; i < count; i++) {
      const x = 0.24 + step * (i + 0.5);
      windowBay(
        local,
        x,
        Math.min(width, step * 0.7),
        low,
        top,
        rise,
        0,
        [0.24 + step * i, 0.24 + step * (i + 1), bottom, ceiling],
        lod,
      );
    }
    if (count) rectangle(local, 'plaster', length - 0.24, length, bottom, ceiling, 0, c.plaster);
    if (lod > 0)
      beam(
        local,
        'limestone',
        [0, ceiling - 0.14, 0.018],
        [length, ceiling - 0.14, 0.018],
        0.18,
        0.2,
        c.trim,
      );
  }
}

const bands = (count) => [
  { bottom: floorY[0], ceiling: podiumY, count, width: 0.96, low: 2.58, top: 4.83, rise: 0.35 },
  { bottom: podiumY, ceiling: floorY[2], count, width: 1.16, low: 7.21, top: 10.96, rise: 0.48 },
  {
    bottom: floorY[2],
    ceiling: principalRoofY,
    count,
    width: 1.06,
    low: 13.17,
    top: 16.71,
    rise: 0.38,
  },
];
const strips = [
  [east, portalLeft, eastFront, 7],
  [portalRight, west, westFront, 7],
];

function roof(out, x0, x1, z0, z1, base, rise, lod) {
  const w = x1 - x0,
    d = z1 - z0;
  const lo = [
    [x0, base, z0],
    [x1, base, z0],
    [x1, base, z1],
    [x0, base, z1],
  ];
  const inset = Math.min(w, d) * 0.36;
  const hi = [
    [x0 + inset, base + rise, z0 + inset],
    [x1 - inset, base + rise, z0 + inset],
    [x1 - inset, base + rise, z1 - inset],
    [x0 + inset, base + rise, z1 - inset],
  ];
  loft(out, 'roof', [lo, hi], c.clay);
  if (lod > 1) {
    for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4,
        p = lo[edge],
        q = lo[next],
        a = hi[edge],
        b = hi[next];
      const columns = Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / 2.15);
      for (let i = 1; i < columns; i++) {
        const t = i / columns;
        const interpolate = (u, v) => [
          u[0] + (v[0] - u[0]) * t,
          u[1] + 0.035,
          u[2] + (v[2] - u[2]) * t,
        ];
        beam(out, 'roof', interpolate(p, q), interpolate(a, b), 0.047, 0.075, c.ridge);
      }
    }
  }
}

function cornice(out, x0, x1, z0, z1, y, lod) {
  const ring = (w, h) => [
    [x0 - w, y + h, z0 - w],
    [x1 + w, y + h, z0 - w],
    [x1 + w, y + h, z1 + w],
    [x0 - w, y + h, z1 + w],
  ];
  const sections =
    lod === 0
      ? [ring(0.07, -0.42), ring(0.33, 0.02)]
      : [ring(0.03, -0.5), ring(0.13, -0.34), ring(0.23, -0.17), ring(0.34, 0.05)];
  loft(out, 'limestone', sections, c.light);
}

function mainBody(out, lod) {
  box(out, 'brick', [east, foundation, rear], [west, floorY[0], eastFront - 0.005], c.footing);
  box(
    out,
    'brick',
    [portalRight, foundation, eastFront - 0.02],
    [west, floorY[0], westFront],
    c.footing,
  );
  for (const [lo, hi, z, n] of strips) facade(out, [lo, z], [hi, z], bands(n), lod);
  facade(out, [west, westFront], [west, rear], bands(6), lod);
  facade(out, [east, rear], [east, eastFront], bands(6), lod);
  facade(out, [west, rear], [east, rear], bands(lod === 0 ? 6 : 15), lod);
  const span = [
      [portalLeft, eastFront],
      [portalRight, westFront],
    ],
    z = 12.0;
  for (const [i, [x, z0]] of span.entries()) {
    const [a, b] =
      i === 0
        ? [
            [x, z0],
            [x, projected],
          ]
        : [
            [x, projected],
            [x, z0],
          ];
    facade(out, a, b, bands(1), lod);
  }
  facade(out, [portalLeft, z], [portalRight, z], bands(5).slice(1), lod);
  cornice(out, east, west, rear, eastFront, principalRoofY, lod);
  const fullEast = east + 9.1,
    fullWest = west - 9.1;
  const normalRoof = principalRoofY + 0.08;
  roof(out, east - 0.28, portalLeft + 0.11, rear - 0.28, eastFront + 0.26, normalRoof, 2.89, lod);
  roof(out, portalRight - 0.11, west + 0.31, rear - 0.26, westFront + 0.26, normalRoof, 2.89, lod);
  const towerUpper = [
    {
      bottom: principalRoofY,
      ceiling: towerEavesY,
      count: 3,
      width: 0.94,
      low: 18.63,
      top: 21.44,
      rise: 0.29,
    },
  ];
  for (const [a, b, z1] of [
    [east, fullEast, eastFront + 0.05],
    [fullWest, west, westFront + 0.04],
  ]) {
    const z0 = z1 - 8.95;
    const ring = [
      [a, z1],
      [b, z1],
      [b, z0],
      [a, z0],
    ];
    for (let i = 0; i < 4; i++) facade(out, ring[i], ring[(i + 1) % 4], towerUpper, lod);
    cornice(out, a, b, z0, z1, towerEavesY, lod);
    roof(
      out,
      a - 0.26,
      b + 0.26,
      z0 - 0.31,
      z1 + 0.28,
      towerEavesY + 0.06,
      ridgeY - towerEavesY,
      lod,
    );
    const x = (a + b) / 2,
      z = (z0 + z1) / 2;
    if (lod > 0)
      column(out, 'limestone', x, z, ridgeY + 0.05, ridgeY + 0.48, 0.12, c.trim, lod > 1 ? 8 : 5);
    if (lod > 0) sphere(out, 'limestone', [x, ridgeY + 0.51, z], [0.14, 0.17, 0.14], c.light, 8, 5);
  }
  facade(
    out,
    [portalLeft, projected],
    [portalRight, projected],
    [
      {
        bottom: principalRoofY - 0.18,
        ceiling: towerEavesY,
        count: 5,
        width: 0.84,
        low: 18.35,
        top: 20.67,
        rise: 0.2,
      },
    ],
    lod,
  );
  for (const x of [portalLeft, portalRight]) {
    const near = x === portalLeft;
    facade(
      out,
      near ? [x, -5.4] : [x, projected],
      near ? [x, projected] : [x, -5.4],
      [
        {
          bottom: principalRoofY,
          ceiling: towerEavesY,
          count: 3,
          width: 0.83,
          low: 18.52,
          top: 20.73,
          rise: 0.24,
        },
      ],
      lod,
    );
  }
  facade(
    out,
    [portalRight, -5.4],
    [portalLeft, -5.4],
    [
      {
        bottom: principalRoofY,
        ceiling: towerEavesY,
        count: 3,
        width: 0.91,
        low: 18.5,
        top: 20.78,
        rise: 0.24,
      },
    ],
    lod,
  );
  roof(
    out,
    portalLeft - 0.27,
    portalRight + 0.28,
    -5.68,
    projected + 0.29,
    towerEavesY,
    ridgeY - towerEavesY,
    lod,
  );
}

function pediment(out, x, z, y, width, rise, rounded, lod) {
  const count = rounded ? [5, 9, 13, 20][lod] : 2;
  const profile = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const h = rounded ? Math.sin(t * Math.PI) : 1 - Math.abs(t * 2 - 1);
    return [x + (t - 0.5) * width, y + rise * h];
  });
  box(
    out,
    'limestone',
    [x - width / 2 - 0.2, y - 0.17, z - 0.42],
    [x + width / 2 + 0.2, y + 0.22, z + 0.25],
    c.light,
  );
  for (let i = 0; i < count; i++) {
    const [p, u] = profile[i],
      [q, v] = profile[i + 1],
      base = y - 0.06;
    face(
      out,
      'plaster',
      [
        [p, base, z],
        [q, base, z],
        [q, v, z],
        [p, u, z],
      ],
      c.trim,
    );
    beam(out, 'limestone', [p, u, z + 0.13], [q, v, z + 0.13], 0.22, 0.35, c.light);
  }
}

function portico(out, lod) {
  const z = projected + 0.4;
  const [a, b] = [portalLeft - 0.54, portalRight + 0.54];
  box(out, 'limestone', [a, podiumY - 0.24, eastFront - 0.21], [b, podiumY, z + 1.87], c.trim);
  const count = 6;
  for (let i = 0; i < count; i++) {
    const x = a + 0.87 + ((b - a - 1.74) * i) / (count - 1);
    box(
      out,
      'limestone',
      [x - 0.51, podiumY, z - 0.58],
      [x + 0.51, podiumY + 0.22, z + 0.58],
      c.light,
    );
    const radius = 0.385;
    if (lod === 0)
      box(
        out,
        'limestone',
        [x - radius, podiumY, z - radius],
        [x + radius, 11.6, z + radius],
        c.trim,
      );
    else column(out, 'limestone', x, z, podiumY + 0.21, 11.6, radius, c.trim, lod > 1 ? 13 : 5);
    box(out, 'limestone', [x - 0.43, 11.38, z - 0.43], [x + 0.43, 11.68, z + 0.43], c.light);
  }
  box(out, 'limestone', [a - 0.09, 11.66, z - 1.38], [b + 0.09, 12.42, z + 0.87], c.light);
  box(out, 'limestone', [a - 0.23, 12.41, z - 1.52], [b + 0.23, 12.62, z + 1.05], c.trim);
  if (lod > 1) {
    for (let i = 0; i < 27; i++) {
      const x = a + 0.09 + ((b - a - 0.2) * i) / 26;
      box(out, 'limestone', [x - 0.08, 12.16, z + 0.85], [x + 0.08, 12.39, z + 0.99], c.light);
    }
  }
  const upperY = principalRoofY - 0.14;
  box(
    out,
    'plaster',
    [a + 0.12, upperY - 0.64, 11.92],
    [b - 0.12, upperY - 0.06, z + 0.22],
    c.plaster,
  );
  if (lod > 0)
    box(out, 'limestone', [a, upperY - 0.33, z + 0.09], [b, upperY - 0.06, z + 0.48], c.trim);
  pediment(out, center, z + 0.34, upperY, b - a + 0.32, 3.43, false, lod);
  const deckEdge = z + 0.85,
    railY = 12.64;
  beam(
    out,
    'limestone',
    [a, railY + 0.77, deckEdge],
    [b, railY + 0.77, deckEdge],
    0.145,
    0.21,
    c.light,
  );
  if (lod > 1) {
    for (let i = 0; i <= 16; i++) {
      const x = a + ((b - a) * i) / 16;
      box(
        out,
        'limestone',
        [x - 0.077, railY, deckEdge - 0.085],
        [x + 0.077, railY + 0.78, deckEdge + 0.085],
        c.trim,
      );
    }
  }
}

function panel(out, center, y, front, radius, highest, lod) {
  const segments = [6, 9, 15, 21][lod],
    top = y + highest;
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * i) / segments,
      b = (Math.PI * (i + 1)) / segments;
    const at = (t) => [center - radius * Math.cos(t), y + highest * Math.sin(t)];
    const [x, aY] = at(a),
      [z, bY] = at(b);
    face(
      out,
      'plaster',
      [
        [x, aY, front],
        [z, bY, front],
        [z, top + 0.27, front],
        [x, top + 0.27, front],
      ],
      c.plaster,
    );
    triangle(
      out,
      'brick',
      [
        [center, y, front - 0.38],
        [x, aY, front - 0.38],
        [z, bY, front - 0.38],
      ],
      c.brick,
    );
    face(
      out,
      'limestone',
      [
        [x, aY, front],
        [x, aY, front - 0.39],
        [z, bY, front - 0.39],
        [z, bY, front],
      ],
      c.shade,
    );
    if (lod > 0)
      beam(out, 'limestone', [x, aY, front + 0.07], [z, bY, front + 0.07], 0.27, 0.21, c.trim);
  }
  rectangle(out, 'brick', center - radius, center + radius, -1.8, y, front - 0.38, c.brick);
}
function fountain(out, lod) {
  const z = projected + 0.11,
    x = center,
    left = x - 3.64,
    right = x + 3.64;
  box(out, 'plaster', [portalLeft, foundation, eastFront - 0.01], [left, podiumY, z], c.shade);
  box(out, 'plaster', [right, foundation, eastFront - 0.01], [portalRight, podiumY, z], c.shade);
  box(out, 'plaster', [left, 4.92, eastFront - 0.01], [right, podiumY, z], c.shade);
  panel(out, x, 1.43, z, 3.64, 3.23, lod);
  if (lod > 0) sphere(out, 'accent', [x, 1.14, z - 0.2], [0.19, 0.21, 0.16], c.bronze, 9, 6);
  const segments = lod > 1 ? 14 : 7,
    poolZ = z + 2.3,
    baseY = -1.45;
  const edge = (r, y, i) => {
    const t = (Math.PI * i) / segments;
    return [x + r * Math.cos(t), y, poolZ + 0.62 * r * Math.sin(t)];
  };
  for (let i = 0; i < segments; i++) {
    face(
      out,
      'limestone',
      [
        edge(3.88, baseY - 0.27, i),
        edge(3.88, baseY - 0.27, i + 1),
        edge(3.88, baseY + 0.27, i + 1),
        edge(3.88, baseY + 0.27, i),
      ],
      c.trim,
    );
    face(
      out,
      'limestone',
      [
        edge(3.88, baseY + 0.27, i),
        edge(3.88, baseY + 0.27, i + 1),
        edge(3.49, baseY + 0.27, i + 1),
        edge(3.49, baseY + 0.27, i),
      ],
      c.light,
    );
    triangle(
      out,
      'accent',
      [[x, baseY + 0.13, poolZ], edge(3.49, baseY + 0.13, i + 1), edge(3.49, baseY + 0.13, i)],
      c.pool,
    );
  }
}

function stair(out, path, low, high, width, lod, lowest, count) {
  const n = lod === 0 ? 3 : lod === 1 ? 8 : count;
  const normal = (t) => {
    const a = path(t - 0.001),
      b = path(t + 0.001),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    return [-dz / len, dx / len];
  };
  const at = (t, s, y) => {
    const [x, z] = path(t),
      [nx, nz] = normal(t);
    return [x + nx * width * s, y, z + nz * width * s];
  };
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n;
    const y = low + (high - low) * u,
      base = low + (high - low) * t;
    face(out, 'limestone', [at(t, -0.5, y), at(t, 0.5, y), at(u, 0.5, y), at(u, -0.5, y)], c.trim);
    face(
      out,
      'limestone',
      [at(t, -0.5, base), at(t, 0.5, base), at(t, 0.5, y), at(t, -0.5, y)],
      c.light,
    );
    face(
      out,
      'plaster',
      [at(t, 0.5, lowest), at(u, 0.5, lowest), at(u, 0.5, y), at(t, 0.5, y)],
      c.shade,
    );
    face(
      out,
      'plaster',
      [at(u, -0.5, lowest), at(t, -0.5, lowest), at(t, -0.5, y), at(u, -0.5, y)],
      c.footing,
    );
  }
  if (lod === 0) return;
  for (const s of [-0.5, 0.5]) {
    const rails = lod > 1 ? 12 : 4;
    for (let i = 0; i < rails; i++) {
      const t = i / rails,
        u = (i + 1) / rails,
        a = at(t, s, low + (high - low) * t + 0.93),
        b = at(u, s, low + (high - low) * u + 0.93);
      beam(out, 'limestone', a, b, 0.14, 0.22, c.light);
      if (lod > 1) {
        const [x, y, z] = a;
        box(
          out,
          'limestone',
          [x - 0.086, y - 0.93, z - 0.086],
          [x + 0.086, y + 0.012, z + 0.086],
          c.trim,
        );
      }
    }
  }
}

function approaches(out, lod) {
  for (const sign of [-1, 1]) {
    const north = (t) => [
      center + sign * (22.95 - 17.47 * t),
      projected + 13.25 * (1 - t) + 0.75 + 2.45 * Math.sin(t * Math.PI),
    ];
    stair(out, north, northStairFootY, podiumY, 3.4, lod, foundation, 37);
    const south = (t) => [center + sign * (15.2 - 10.8 * t), rear - 7.75 * (1 - t) - 0.75];
    stair(out, south, -1.35, 3.05, 2.75, lod, -6.53, 23);
  }
  const entrySurface = rear - 0.01;
  box(
    out,
    'limestone',
    [center - 5.62, -1.2, rear - 2.01],
    [center + 5.62, 3.05, rear - 0.007],
    c.shade,
  );
  const back = transform(out, Math.PI, [center, 0, entrySurface]);
  pediment(back, 0, 0.38, principalRoofY - 0.26, 11.0, 2.26, true, lod);
  box(
    out,
    'limestone',
    [center - 12.7, northStairFootY - 2.8, projected + 3.88],
    [center + 12.7, northStairFootY + 0.08, projected + 15.82],
    c.footing,
  );
}

function build(out, lod) {
  mainBody(out, lod);
  portico(out, lod);
  fountain(out, lod);
  approaches(out, lod);
}

export const sansSouciSkyline = (out) => build(out, 0);
export const sansSouciDistrict = (out) => build(out, 1);
export const sansSouciStreet = (out) => build(out, 2);
export const sansSouciCloseup = (out) => build(out, 3);
const recipe = 'sans-souci-palace-milot-model.mjs';
const camera = [49, 30, 102],
  lookAt = [0, 11, 7];
export const sansSouciModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: sansSouciCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  brief:
    'The royal residence at Milot as it stood in the late 1810s, with pavilion roofs, the Doric gallery and a pair of ceremonial stairs framing the north fountain.',
  camera,
  lookAt,
  sunDirection: [-35, 47, 63],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'brick_flemish',
    'tile_ceramic',
    'wood_plain',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'north-stairs-and-fountain', position: [1.3, 6.8, 58], lookAt: [0.7, 8.3, 15] },
    { name: 'columned-royal-gallery', position: [-29, 17.4, 42], lookAt: [-3, 12, 11] },
    { name: 'south-garden-facade', position: [-42, 23, -64], lookAt: [0, 10, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'royal-residence-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'sansSouciSkyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'sansSouciDistrict', 0.3],
        ['street', 'sansSouciStreet', 0.13],
        ['closeup', 'sansSouciCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Public-domain Clarke 1830 engraving and Küstner 1836 lithograph. OpenStreetMap surviving palace outline under ODbL 1.0.',
};
