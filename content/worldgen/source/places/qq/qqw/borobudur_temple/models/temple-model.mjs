import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  courses: { slot: 'wall', graph: 'stone_basalt', roughness: 0.95 },
  carved: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.93 },
  walks: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96 },
};

const TAU = 2 * Math.PI;
const wall = rgb('988c74');
const bands = rgb('aca08a');
const relief = rgb('817e71');
const paving = rgb('b1a690');
const inset = rgb('6f6c60');
const paint = ['918773', 'a69b86', '9d957f', '938e81', 'a49d8b'].map(rgb);
const terraces = [
  [59.5, 0.23, 3.21, 5.3],
  [54.0, 3.2, 6.76, 5.9],
  [48.7, 6.75, 10.25, 5.9],
  [43.42, 10.24, 13.7, 5.6],
  [37.98, 13.69, 17.14, 5.5],
  [32.48, 17.13, 20.41, 5.1],
];

function face(out, material, coords, color) {
  const normal = normalFor(coords[0], coords[1], coords[2]);
  if (coords.length === 4) out.addQuad(material, '', coords, normal, [], color);
  else out.addTriangle(material, '', coords, normal, [], color);
}

function cap(out, material, ring, y, normal, color) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      normal,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Borobudur terrace outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const coords = Array.from({ length: 3 }, (_, j) =>
      Array.from(positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3)),
    );
    out.addTriangle(material, '', coords, normal, [], color);
  }
}

function slab(out, material, ring, low, high, color, deck = true, bottom = false) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [a, b] = ring[(i + 1) % ring.length];
    face(
      out,
      material,
      [
        [x, low, z],
        [x, high, z],
        [a, high, b],
        [a, low, b],
      ],
      color,
    );
  }
  if (deck) cap(out, 'walks', ring, high, [0, 1, 0], paving);
  if (bottom) cap(out, material, ring, low, [0, -1, 0], color);
}

// Walk the four walls clockwise in plan. Reflections preserve the same radial stair axis.
function local(side, u, d) {
  switch (side) {
    case 0:
      return [u, -d];
    case 1:
      return [d, u];
    case 2:
      return [-u, d];
    default:
      return [-d, -u];
  }
}

function plan(radius, recess, detail) {
  const w = radius * 0.89,
    middle = radius * 0.38,
    outer = radius * 0.69,
    edge = radius * 0.946;
  const side =
    detail === 0
      ? [
          [-w, w],
          [-w, radius],
          [w, radius],
          [w, w],
        ]
      : detail === 1
        ? [
            [-w, w],
            [-middle, radius],
            [-2.28, radius],
            [-2.28, radius - recess + 0.12],
            [2.28, radius - recess + 0.12],
            [2.28, radius],
            [middle, radius],
            [w, w],
          ]
        : [
            [-w, w],
            [-outer, w],
            [-outer, edge],
            [-middle, edge],
            [-middle, radius],
            [-2.28, radius],
            [-2.28, radius - recess + 0.12],
            [2.28, radius - recess + 0.12],
            [2.28, radius],
            [middle, radius],
            [middle, edge],
            [outer, edge],
            [outer, w],
            [w, w],
          ];
  return [0, 1, 2, 3].flatMap((d) => side.slice(0, -1).map(([x, z]) => local(d, x, z)));
}

function rectangle(out, side, left, right, near, far, low, high, material, color) {
  const ring = [
    [left, far],
    [right, far],
    [right, near],
    [left, near],
  ].map(([u, d]) => local(side, u, d));
  for (let i = 0; i < 4; i++) {
    const [a, b] = ring[i],
      [x, z] = ring[(i + 1) % 4];
    face(
      out,
      material,
      [
        [a, low, b],
        [a, high, b],
        [x, high, z],
        [x, low, z],
      ],
      color,
    );
  }
  face(
    out,
    material,
    ring
      .slice()
      .reverse()
      .map(([x, z]) => [x, high, z]),
    color,
  );
}

function stairs(out, detail) {
  if (!detail) return;
  const count = [0, 3, 5, 12][detail];
  const width = [1.88, 2.07, 2.14, 2.14][detail];
  for (let side = 0; side < 4; side++) {
    const outer = side % 2 === 0 ? 63.45 : 62.98;
    for (const [i, [radius, floor, top, recess]] of terraces.entries()) {
      const front = i === 0 ? outer : terraces[i - 1][0] - terraces[i - 1][3] + 0.08;
      const back = radius - recess - 0.13;
      for (let j = 0; j < count; j++) {
        const ratio = j / count,
          step = (j + 1) / count;
        const far = front + (back - front) * ratio,
          near = front + (back - front) * step;
        const y = floor + (top - floor) * step;
        const h = floor - 0.035;
        rectangle(out, side, -width, width, near, far, h, y, 'walks', paving);
        if (detail === 3) {
          rectangle(out, side, -width - 0.36, -width, near, far, h, y + 0.31, 'carved', bands);
          rectangle(out, side, width, width + 0.36, near, far, h, y + 0.31, 'carved', bands);
        }
      }
    }
  }
}

function ringAt(x, z, radius, y, count) {
  return Array.from({ length: count }, (_, i) => {
    const a = (-i * TAU) / count;
    return [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];
  });
}

function circular(out, material, x, z, floor, profile, sides, color) {
  loft(
    out,
    material,
    profile.map(([y, r]) => ringAt(x, z, r, floor + y, sides)),
    color,
  );
}

function nicheRun(out, ring, y, level, master) {
  for (const [i, [x, z]] of ring.entries()) {
    const [a, b] = ring[(i + 1) % ring.length],
      dx = a - x,
      dz = b - z;
    const len = Math.hypot(dx, dz);
    if (len < 7.5) continue;
    const count = Math.max(1, Math.floor(len / (level === 2 ? 5.85 : master ? 2.8 : 3.12))),
      nx = dz / len,
      nz = -dx / len;
    const pt = (t, offset, h) => [x + dx * t + nx * offset, h, z + dz * t + nz * offset];
    for (let j = 0; j < count; j++) {
      const t = j / count,
        u = (j + 1) / count,
        m = (t + u) / 2,
        w = (u - t) * 0.38;
      const color = paint[(i + j) % paint.length];
      const low = y + 0.22,
        sill = y + 0.5,
        apex = y + 3.16;
      const lo = m - w,
        hi = m + w;
      face(
        out,
        'carved',
        [pt(lo, 0.12, low), pt(lo, 0.12, sill), pt(hi, 0.12, sill), pt(hi, 0.12, low)],
        bands,
      );
      face(
        out,
        'carved',
        [
          pt(lo, 0.075, sill),
          pt(lo, 0.075, y + 1.95),
          pt(m, 0.09, y + 2.2),
          pt(hi, 0.075, y + 1.95),
        ],
        inset,
      );
      face(
        out,
        'carved',
        [pt(lo, 0.075, sill), pt(hi, 0.075, y + 1.95), pt(hi, 0.075, sill)],
        inset,
      );
      for (const [left, right] of [
        [lo - 0.18 * (u - t), lo + 0.035 * (u - t)],
        [hi - 0.035 * (u - t), hi + 0.18 * (u - t)],
      ]) {
        const q = pt(left, 0.34, sill),
          r = pt(left, 0.34, y + 2.0),
          s = pt(right, 0.34, y + 2.0),
          p = pt(right, 0.34, sill);
        const inner = [q, r, s, p];
        face(out, 'carved', inner, color);
      }
      const roof = [
        pt(lo - 0.045 * (u - t), 0.41, y + 1.98),
        pt(m, 0.41, y + 2.42),
        pt(hi + 0.045 * (u - t), 0.41, y + 1.98),
      ];
      face(out, 'carved', roof, bands);
      if (level === 3) {
        const [bx, , bz] = pt(m, 0.16, sill);
        const silhouette = master
          ? [
              [0, 0.35],
              [0.18, 0.32],
              [0.58, 0.23],
              [0.77, 0.113],
              [0.98, 0.12],
            ]
          : [
              [0, 0.3],
              [0.62, 0.2],
              [0.98, 0.12],
            ];
        circular(out, 'carved', bx, bz, sill, silhouette, master ? 5 : 4, relief);
      }
      const [cx, , cz] = pt(m, -0.29, apex);
      if (master)
        circular(
          out,
          'carved',
          cx,
          cz,
          apex,
          [
            [0, 0.63],
            [0.21, 0.67],
            [0.41, 0.42],
            [0.68, 0.19],
            [0.95, 0.1],
          ],
          6,
          bands,
        );
      else {
        const ring = ringAt(cx, cz, 0.62, apex, 4);
        for (let k = 0; k < 4; k++)
          face(out, 'carved', [ring[k], ring[(k + 1) % 4], [cx, apex + 0.91, cz]], bands);
      }
    }
  }
}

function lowerTerraces(out, detail, master) {
  const outline = site.outline;
  const ground = detail === 0 ? plan(60.8, 0, 0) : outline;
  slab(out, 'courses', ground, -9.0, 0.18, wall, true, true);
  for (const [i, [radius, low, high, recess]] of terraces.entries()) {
    const ring = plan(radius, recess, detail);
    slab(out, 'courses', ring, low, high, wall);
    if (detail > 1) {
      slab(
        out,
        'carved',
        plan(radius + 0.19, recess + 0.19, detail),
        high - 0.32,
        high,
        bands,
        false,
      );
      if (detail === 3)
        slab(
          out,
          'carved',
          plan(radius + 0.11, recess + 0.11, detail),
          low + 0.11,
          low + 0.28,
          bands,
          false,
        );
      nicheRun(out, ring, low, detail, master);
    }
  }
  stairs(out, detail);
}

const lerp = (a, b, t) => a + (b - a) * t;
const radial = (x, z, radius, y, a) => [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];

function piercedBand(out, x, z, base, band, sides, square, detail) {
  const [lo, hi, lowRadius, highRadius] = band;
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const hole = square
    ? [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.72, 0.72],
        [0.28, 0.72],
      ]
    : [
        [0.5, 0.16],
        [0.84, 0.5],
        [0.5, 0.84],
        [0.16, 0.5],
      ];
  for (let i = 0; i < sides; i++) {
    const p = ([u, v], inset = 0) =>
      radial(
        x,
        z,
        lerp(lowRadius, highRadius, v) - inset,
        base + lerp(lo, hi, v),
        ((i + u) * TAU) / sides,
      );
    for (let j = 0; j < 4; j++) {
      const next = (j + 1) % 4;
      const a = p(corners[j]),
        b = p(corners[next]),
        c = p(hole[j]),
        d = p(hole[next]);
      face(out, 'carved', [a, c, b], bands);
      face(out, 'carved', [b, c, d], bands);
      if (detail === 3) {
        face(out, 'carved', [d, c, p(hole[j], 0.17), p(hole[next], 0.17)], relief);
      }
    }
  }
}

function upperStupa(out, x, z, y, detail, square) {
  if (!detail) {
    const corners = ringAt(x, z, 1.35, y, 4),
      apex = [x, y + 3.21, z];
    for (let i = 0; i < 4; i++)
      face(out, 'carved', [corners[i], corners[(i + 1) % 4], apex], bands);
    return;
  }
  if (detail === 1) {
    circular(
      out,
      'carved',
      x,
      z,
      y,
      [
        [0, 1.37],
        [1.78, 0.69],
        [3.21, 0.085],
      ],
      4,
      bands,
    );
    return;
  }
  const sides = detail === 2 ? 6 : 8;
  const base =
    detail === 2
      ? [
          [0, 1.36],
          [0.53, 1.17],
        ]
      : [
          [0, 1.4],
          [0.14, 1.4],
          [0.22, 1.32],
          [0.33, 1.28],
          [0.42, 1.2],
          [0.53, 1.17],
        ];
  circular(out, 'courses', x, z, y, base, sides, wall);
  if (detail === 2) piercedBand(out, x, z, y, [0.53, 1.88, 1.17, 0.73], sides, square, detail);
  else {
    piercedBand(out, x, z, y, [0.53, 1.19, 1.17, 1.02], sides, square, detail);
    piercedBand(out, x, z, y, [1.19, 1.88, 1.02, 0.73], sides, square, detail);
    circular(
      out,
      'carved',
      x,
      z,
      y,
      [
        [0.12, 0.52],
        [0.3, 0.45],
        [0.8, 0.32],
        [1.02, 0.17],
        [1.24, 0.16],
      ],
      6,
      relief,
    );
  }
  const finial =
    detail === 2
      ? [
          [1.88, 0.73],
          [2.19, 0.45],
          [3.21, 0.083],
        ]
      : [
          [1.88, 0.73],
          [2.19, 0.45],
          [2.34, 0.36],
          [3.21, 0.083],
        ];
  circular(out, 'carved', x, z, y, finial, sides, bands);
}

function upperTerraces(out, detail) {
  const sides = [12, 20, 32, 48][detail];
  const [, centralX, centralZ] = site.centralStupa;
  for (const [i, radius] of [28.05, 21.85, 15.34].entries()) {
    const y = site.stupaGrounds[i],
      start = i === 0 ? 20.4 : site.stupaGrounds[i - 1] - 0.02;
    circular(
      out,
      'courses',
      centralX,
      centralZ,
      start,
      [
        [0, radius],
        [y - start - 0.18, radius],
        [y - start, radius - 0.18],
      ],
      sides,
      wall,
    );
    for (const [, x, z] of site.stupaRings[i]) {
      upperStupa(out, x, z, y, detail, i === 2);
    }
  }
  const y = site.stupaGrounds[2];
  const crown = [
    [0, 7.15],
    [0.82, 7.1],
    [1.22, 6.7],
    [2.07, 6.24],
    [3.32, 6.15],
    [4.68, 5.7],
    [5.55, 4.72],
    [6.42, 3.82],
    [6.94, 2.24],
    [7.56, 1.9],
    [site.summitHeight - y, 1.05],
  ];
  circular(
    out,
    'carved',
    centralX,
    centralZ,
    y,
    detail === 0 ? crown.filter((_, i) => [0, 2, 5, 8, 10].includes(i)) : crown,
    sides,
    relief,
  );
  for (let side = 0; side < 4; side++) {
    const rises = [20.41, ...site.stupaGrounds];
    const d = [28.15, 21.9, 15.42, 11.62];
    for (let i = 0; i < 3; i++) {
      const slices = detail === 0 ? 0 : detail === 1 ? 2 : 4;
      for (let j = 0; j < slices; j++) {
        const y = lerp(rises[i], rises[i + 1], (j + 1) / slices);
        rectangle(
          out,
          side,
          -1.2,
          1.2,
          lerp(d[i], d[i + 1], (j + 1) / slices),
          lerp(d[i], d[i + 1], j / slices),
          y - 0.5,
          y,
          'walks',
          paving,
        );
      }
    }
  }
}

function build(out, detail, master = false) {
  lowerTerraces(out, detail, master);
  upperTerraces(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 3, true);
