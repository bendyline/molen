import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  earth: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  posts: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.79, metallic: 0.22 },
  grille: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.32 },
  thatch: { slot: 'roof', graph: 'thatch', roughness: 0.97, metallic: 0 },
  pigment: {
    slot: 'wall',
    localRef: 'palette:#ffffff',
    name: 'shrine-painted-plaster',
    roughness: 0.95,
    metallic: 0,
  },
};
const plaster = [0.6, 0.44, 0.28],
  base = [0.35, 0.32, 0.22],
  wood = [0.13, 0.099, 0.073];
const dampStone = [0.25, 0.28, 0.145];
const frontPlaster = [0.55, 0.33, 0.31];
const iron = [0.037, 0.041, 0.044];
const silveredWood = [0.29, 0.256, 0.196];
const fadedMetal = [0.45, 0.43, 0.37],
  oxidized = [0.36, 0.26, 0.18];
const dryThatch = [0.49, 0.397, 0.26];
const dampThatch = [0.435, 0.374, 0.229];
const porchFiber = [0.54, 0.473, 0.27];
const palette = [
  [0.095, 0.077, 0.046],
  [0.55, 0.49, 0.31],
  [0.32, 0.17, 0.103],
  [0.245, 0.29, 0.235],
];
// Painted panels behind the porch openings. Follow the broad motifs in the Trust photos.
const paintedPanels = [
  { x: -6.06, width: 1.93, motifs: ['stripes', 'eye', 'arc'] },
  { x: -3.83, width: 1.54, motifs: ['stripes', 'arc', 'eye'] },
  { x: -2.71, width: 1.06, motifs: ['arc', 'eye', 'fork'] },
  { x: -0.5, width: 1.02, motifs: ['arc', 'fork', 'eye'] },
  { x: 0.99, width: 1.86, motifs: ['arc', 'eye', 'stripes'] },
  { x: 3.03, width: 2.03, motifs: ['fork', 'arc', 'eye'] },
  { x: 5.73, width: 2.5, motifs: ['eye', 'stripes', 'fork'] },
];
const center = -1.6,
  front = 2.92,
  porchEdge = 5.36;
const eave = 2.75,
  ridge = 3.84,
  porchHeight = 4.64,
  porchWidth = 1.69;
const color = (rgb, tint) => rgb.map((channel) => channel * tint);
const surfaceTints = [0.85, 0.91, 0.97, 1.03, 1.09];
const roofY = (z) => ridge - ((ridge - eave) * Math.abs(z)) / 3.7;
const gableY = (x) => porchHeight - ((porchHeight - eave) * Math.abs(x - center)) / porchWidth;

function face(out, key, p, shade) {
  for (let i = 1; i + 1 < p.length; i++) {
    const pts = [p[0], p[i], p[i + 1]];
    if (
      Math.abs(pts[1][0] - pts[0][0]) +
        Math.abs(pts[1][1] - pts[0][1]) +
        Math.abs(pts[1][2] - pts[0][2]) <
      1e-10
    )
      continue;
    if (
      Math.abs(pts[2][0] - pts[0][0]) +
        Math.abs(pts[2][1] - pts[0][1]) +
        Math.abs(pts[2][2] - pts[0][2]) <
      1e-10
    )
      continue;
    out.addTriangle(key, 'palette:#ffffff', pts, normalFor(...pts), [], shade);
  }
}

function frontPanel(out, left, right, height, z, aperture, detail, seed = 0) {
  const bottom = 0.28,
    rear = z - 0.28;
  const [cx, cy, rx, ry] = aperture;
  const corners = [
    [right, bottom],
    [right, height],
    [left, height],
    [left, bottom],
  ];
  const outside = corners.flatMap((a, i) => {
    const b = corners[(i + 1) % 4];
    return Array.from({ length: detail.opening }, (_, j) =>
      a.map((n, k) => n + ((b[k] - n) * j) / detail.opening),
    );
  });
  const inside = outside.map(([x, y]) => {
    const t = Math.atan2(y - cy, x - cx);
    const rough =
      detail.opening > 1 ? 1 + 0.064 * Math.sin(3 * t + seed) + 0.04 * Math.cos(5 * t) : 1;
    return [cx + Math.cos(t) * rx * rough, cy + Math.sin(t) * ry * rough, t];
  });
  const rim = ([x, y, t]) => [x, y, z + (detail.opening > 1 ? 0.066 * Math.sin(3 * t + seed) : 0)];
  const back = ([x, y]) => [x, y, rear];
  for (let i = 0; i < outside.length; i++) {
    const j = (i + 1) % outside.length;
    const a = [...outside[i], z],
      b = [...outside[j], z];
    const c = rim(inside[j]),
      d = rim(inside[i]);
    const e = back(inside[i]),
      f = back(inside[j]);
    face(out, 'earth', [a, b, c, d], color(frontPlaster, 0.96 + 0.045 * Math.sin(i * 0.6 + seed)));
    face(out, 'earth', [e, f, c, d].reverse(), color(frontPlaster, 0.78));
    face(
      out,
      'earth',
      [[...outside[j], rear], [...outside[i], rear], e, f],
      color(frontPlaster, 0.88),
    );
  }
}

function foundation(out, detail) {
  if (detail.opening < 3) {
    box(out, 'stone', [-7.81, -0.34, -3.29], [7.81, 0.3, 3.71], base);
    return;
  }
  const corners = chamferedRectangle(0, 0.3, 0.21, 15.62, 7, 0.11);
  const edge = corners.flatMap(([x, , z], i) => {
    const [nextX, , nextZ] = corners[(i + 1) % corners.length];
    const divisions = Math.ceil(
      Math.hypot(nextX - x, nextZ - z) / (detail.opening > 4 ? 0.55 : 1.1),
    );
    return Array.from({ length: divisions }, (_, j) => [
      x + ((nextX - x) * j) / divisions,
      z + ((nextZ - z) * j) / divisions,
    ]);
  });
  const upper = edge.map(([x, z]) => [x, 0.3, z]);
  const skirt = edge.map(([x, z]) => {
    const wave = Math.sin(x * 2.8 + z * 1.4) * 0.06 + Math.cos(x * 6.7 - z * 2) * 0.031;
    const flair = 0.059 + wave * 0.5;
    return [x + flair * Math.sign(x), 0.078 + wave, z + flair * Math.sign(z - 0.21)];
  });
  const bottom = skirt.map(([x, , z]) => [x, -0.34, z]);
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length;
    const [x, z] = edge[i];
    const tint = 0.9 + 0.095 * Math.sin(x * 1.18 + z * 1.73);
    face(out, 'stone', [[0, 0.3, 0.21], upper[i], upper[j]], base);
    face(out, 'stone', [skirt[i], skirt[j], upper[j], upper[i]], color(base, tint));
    const weathering = z > 2.5 ? 0.78 + 0.15 * Math.sin(x * 1.4) : 0.86;
    face(out, 'stone', [bottom[i], bottom[j], skirt[j], skirt[i]], color(dampStone, weathering));
    face(out, 'stone', [[0, -0.34, 0.21], bottom[j], bottom[i]], dampStone);
  }
}

function porchSteps(out, detail) {
  box(out, 'stone', [-3.21, -0.2, 3.2], [-0.09, 0.43, 5.17], color(base, 0.94));
  for (let i = 0; i < 3; i++) {
    const left = -3.13 + i * 0.047;
    const right = -0.18 - i * 0.047;
    const back = 5.17 + 0.23 * i;
    const frontEdge = 5.39 + 0.23 * i;
    const top = 0.31 - 0.118 * i;
    const tint = color(base, surfaceTints[i + 2]);
    if (!detail.relief) {
      box(out, 'stone', [left, -0.2, back], [right, top, frontEdge], tint);
      continue;
    }
    const station = (t, inset) => [
      left + inset + (right - left - 2 * inset) * t,
      frontEdge - inset - 0.067 * (2 * t - 1) ** 2,
    ];
    const sections = detail.carvings > 6 ? 9 : 5;
    const rim = (y, inset) => [
      [left + inset, y, back],
      ...Array.from({ length: sections + 1 }, (_, j) => {
        const [x, z] = station(j / sections, inset);
        return [x, y, z];
      }),
      [right - inset, y, back],
    ];
    loft(out, 'stone', [rim(-0.2, 0), rim(top - 0.028, 0)], color(dampStone, 1.18), {
      cap: false,
    });
    loft(out, 'stone', [rim(top - 0.028, 0), rim(top, 0.019)], color(tint, 1.2));
  }
}

function entranceJambs(out, detail) {
  if (!detail.relief) return;
  // In the entrance photograph the plaster flares into the stone approach.
  const profiles = [
    [
      [-3.36, -0.25, 3.57, 0.61, 0.67],
      [-3.44, 0.24, 3.63, 0.6, 0.69],
      [-3.46, 0.57, 3.59, 0.52, 0.61],
      [-3.28, 0.86, 3.48, 0.45, 0.49],
      [-3.23, 1.19, 3.31, 0.33, 0.41],
      [-3.23, 1.68, 3.18, 0.29, 0.31],
      [-3.18, 2.12, 3.06, 0.31, 0.21],
      [-3.11, 2.61, 2.93, 0.37, 0.19],
    ],
    [
      [0.08, -0.25, 3.4, 0.43, 0.56],
      [0.04, 0.25, 3.46, 0.49, 0.62],
      [0.03, 0.59, 3.45, 0.4, 0.54],
      [0.01, 0.87, 3.29, 0.36, 0.43],
      [0.08, 1.27, 3.14, 0.29, 0.32],
      [0.11, 1.57, 3.12, 0.33, 0.24],
      [0.0, 2.08, 3.04, 0.38, 0.21],
      [-0.03, 2.62, 2.91, 0.45, 0.17],
    ],
  ];
  const sides = detail.carvings > 6 ? 12 : 8;
  for (const [jamb, profile] of profiles.entries()) {
    const rings = profile.map(([x, y, z, rx, rz], row) =>
      radialRing(y, rx, rz, sides, [x, z]).map(([u, height, v], i) => {
        const variation = Math.sin(i * 2.71 + row * 1.14 + jamb * 2.6);
        return [u, height + variation * 0.042, v + variation * 0.034];
      }),
    );
    for (let row = 1; row < rings.length; row++) {
      const shade =
        row === 1
          ? dampStone
          : color(frontPlaster, [1, 0.85, 0.91, 1.02, 0.96, 1.04, 0.94][row - 1]);
      loft(out, row === 1 ? 'stone' : 'earth', rings.slice(row - 1, row + 1), shade, {
        cap: false,
      });
    }
  }
}

function entranceGrille(out, z, detail) {
  if (!detail.carvings) return;
  const left = -2.14,
    right = -1.1;
  const bottom = 0.3,
    top = 2.311;
  const frame = 0.033;
  const bar = (lo, hi, depthOffset = 0) => {
    const frontZ = z + depthOffset;
    if (detail.carvings > 6) {
      box(out, 'grille', [...lo, frontZ - 0.041], [...hi, frontZ], iron);
    } else {
      const panel = [
        [...lo, frontZ],
        [hi[0], lo[1], frontZ],
        [...hi, frontZ],
        [lo[0], hi[1], frontZ],
      ];
      face(out, 'grille', panel, iron);
      face(out, 'grille', panel.toReversed(), iron);
    }
  };
  bar([left, bottom], [left + frame, top]);
  bar([right - frame, bottom], [right, top]);
  bar([left + frame, bottom], [right - frame, bottom + frame]);
  bar([left + frame, top - frame], [right - frame, top]);
  for (let i = 1; i <= 6; i++) {
    const x = left + ((right - left) * i) / 7;
    bar([x - 0.009, bottom + frame], [x + 0.009, top - frame]);
  }
  for (const y of [0.64, 1.03, 1.38, 1.82]) {
    bar([left + frame, y - 0.01], [right - frame, y + 0.01], 0.004);
  }
  if (!detail.relief) return;

  // The square central grid is flanked by narrow scroll panels against the painted plaster.
  const near = detail.carvings > 6;
  const bands = near ? [0.53, 0.92, 1.31, 1.7, 2.09] : [0.61, 1.29, 1.98];
  const segments = near ? 16 : 6;
  for (const [edge, side] of [
    [left, -1],
    [right, 1],
  ]) {
    const outer = edge + side * 0.248;
    bar([outer - 0.013, bottom], [outer + 0.013, top]);
    for (const y of [bottom + 0.011, top - 0.011]) {
      bar([Math.min(edge, outer), y - 0.011], [Math.max(edge, outer), y + 0.011]);
    }
    for (const [i, y] of bands.entries()) {
      const turn = i % 2 === 0 ? side : -side;
      const spiral = Array.from({ length: segments + 1 }, (_, j) => {
        const t = j / segments;
        const angle = t * 1.47 * Math.PI * 2;
        const radius = 1 - t * 0.82;
        return [
          edge + side * 0.125 + turn * 0.125 * radius * Math.cos(angle),
          y + 0.154 * radius * Math.sin(angle),
          z + 0.009,
        ];
      });
      if (near) {
        beamPath(out, 'grille', spiral, 0.015, 0.015, iron);
        continue;
      }
      for (let j = 1; j < spiral.length; j++) {
        const a = spiral[j - 1];
        const b = spiral[j];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const halfWidth = 0.009 / Math.hypot(dx, dy);
        const u = -dy * halfWidth;
        const v = dx * halfWidth;
        const strip = [
          [a[0] + u, a[1] + v, a[2]],
          [a[0] - u, a[1] - v, a[2]],
          [b[0] - u, b[1] - v, b[2]],
          [b[0] + u, b[1] + v, b[2]],
        ];
        face(out, 'grille', strip, iron);
        face(out, 'grille', strip.toReversed(), iron);
      }
    }
  }
}

function porchFringe(out, detail) {
  if (!detail.relief) return;
  const rope = (t) => [
    -2.41 + 1.59 * t,
    3.26 - 0.235 * Math.sin(Math.PI * t) + 0.067 * t,
    4.84 + 0.027 * Math.sin(Math.PI * t),
  ];
  const anchors = detail.carvings > 6 ? 16 : 7;
  beamPath(
    out,
    'thatch',
    Array.from({ length: anchors }, (_, i) => rope(i / (anchors - 1))),
    0.018,
    0.016,
    color(porchFiber, 0.9),
  );
  const strands = detail.carvings > 8 ? 65 : detail.carvings > 6 ? 43 : 13;
  for (let i = 0; i < strands; i++) {
    const t = (i + 0.45 + 0.24 * Math.sin(i * 2.8)) / strands;
    const [x, y, z] = rope(t);
    const length = 0.32 + 0.33 * t + 0.22 * Math.sin(i * 2.1) ** 2;
    const sway = 0.022 * Math.sin(i * 3.39);
    const size = detail.carvings > 6 ? 0.006 : 0.01;
    loft(
      out,
      'thatch',
      [
        radialRing(y - length, size * 0.26, size * 0.21, 3, [x + sway * 1.8, z + 0.028]),
        radialRing(y - length * 0.52, size, size * 0.62, 3, [x + sway, z + 0.013]),
        radialRing(y + 0.008, size * 0.88, size * 0.69, 3, [x, z]),
      ],
      color(porchFiber, 0.8 + 0.25 * Math.sin(i * 1.04) ** 2),
      { cap: false },
    );
  }
}

function column(out, x, z, height, seed, detail) {
  const floor = 0.43,
    span = height - floor;
  const count = detail.carvings > 2 ? 3 + (seed % 2) : 2;
  const widths = [0.132, 0.09, 0.13, 0.075, 0.11];
  const dx = ((seed % 3) - 1) * 0.13;
  const finish = seed === 2 || seed === 5 ? silveredWood : wood;
  const profile = [[floor, 0.15]];
  for (let i = 0; i < count; i++) {
    const lo = floor + ((i + 0.1) * span) / count,
      h = (0.78 * span) / count;
    profile.push(
      [lo, 0.1],
      [lo + 0.23 * h, widths[(i + seed) % widths.length]],
      [lo + 0.55 * h, 0.059 + 0.009 * ((i + seed + 1) % 3)],
      [lo + 0.82 * h, 0.1],
      [lo + h, 0.066],
    );
  }
  profile.push([height, 0.13]);
  if (!detail.carvings) {
    beam(out, 'posts', [x, floor, z], [x + dx, height, z], 0.19, 0.19, finish);
    return;
  }
  loft(
    out,
    'posts',
    profile.map(([y, width], i) =>
      radialRing(y, width, 0.86 * width, detail.carvings, [
        x + (dx * (y - floor)) / span + 0.026 * Math.sin(i * 1.43 + seed),
        z + 0.035 * Math.sin(i),
      ]),
    ),
    color(finish, surfaceTints[seed % 5]),
  );
  if (detail.carvings < 6) return;
  for (let i = 0; i < count; i++) {
    const y = floor + ((i + 0.79) * span) / count,
      a = x + (dx * (y - floor)) / span;
    sphere(
      out,
      'posts',
      [a, y, z + 0.065],
      [0.084 + 0.01 * ((i + seed) % 3), 0.106 + 0.014 * (seed % 3), 0.074],
      color(finish, 1.21),
      detail.carvings,
      5,
    );
    beam(
      out,
      'posts',
      [a - 0.052, y + 0.015, z + 0.127],
      [a + 0.052, y + 0.026, z + 0.131],
      0.026,
      0.025,
      color(finish, 0.7),
    );
    sphere(
      out,
      'posts',
      [a + 0.008, y - 0.026, z + 0.133],
      [0.028, 0.046, 0.025],
      color(finish, 1.4),
      6,
      4,
    );
    for (const s of [-1, 1]) {
      beam(
        out,
        'posts',
        [a + s * 0.069, y - 0.16, z + 0.028],
        [a + s * 0.12, y - 0.32, z + 0.05],
        0.034,
        0.034,
        color(finish, 1.04),
      );
      beam(
        out,
        'posts',
        [a + s * 0.12, y - 0.32, z + 0.05],
        [a + s * 0.045, y - 0.39, z + 0.104],
        0.034,
        0.034,
        color(finish, 1.11),
      );
    }
  }
}

function sheet(out, plan, height, shade, detail, slopeAlongX = false) {
  const upper = plan.toReversed().map(([x, z]) => [x, height(x, z), z]);
  const underside = upper.map(([x, y, z]) => [x, y - 0.043, z]);
  face(out, 'roof', underside.toReversed(), color(shade, 0.6));
  const cover = upper.map(([x, y, z]) => [x, y + 0.09 + 0.018 * Math.sin(x * 2.1 + z * 0.6), z]);
  const moss = Math.sin(plan[0][0] * 0.7 - plan[0][1]) > 0.68;
  out.addQuad(
    'thatch',
    'metric:uv',
    cover,
    normalFor(...cover),
    cover.map(([x, , z]) => {
      const [across, downhill] = slopeAlongX ? [z, x] : [x, z];
      return [across, downhill * 2.6 + 0.06 * Math.sin(across * 2.1)];
    }),
    moss ? dampThatch : dryThatch,
  );
  if (detail.opening > 1) {
    for (let i = 0; i < upper.length; i++) {
      const j = (i + 1) % upper.length;
      face(out, 'roof', [cover[j], cover[i], underside[i], underside[j]], color(shade, 0.79));
    }
  }
}

function frayedEave(out, detail, alongX, start, end, at, height, direction) {
  if (!detail.panels) return;
  const count = Math.ceil((end - start) / (detail.opening > 4 ? 0.12 : 0.24));
  const point = (along, across, y) => (alongX ? [along, y, across] : [across, y, along]);
  const overlap = (0.6 * (end - start)) / count;
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * (i + 0.5)) / count;
    const fall = 0.12 + 0.11 * Math.cos(a * 5.41 + at);
    const y = height(a);
    const vertices = [
      point(a - overlap, at, y + 0.058),
      point(a + overlap, at, y + 0.065),
      point(a + 0.027 * Math.sin(a * 5), at + direction * 0.075, y - fall),
    ];
    face(
      out,
      'thatch',
      direction > 0 === alongX ? vertices.toReversed() : vertices,
      color(dryThatch, surfaceTints[i % 5]),
    );
  }
}

function entranceEave(out, x0, x1, near, shade, detail) {
  const thatchEnd = (x) => near - (0.33 + 0.105 * Math.sin(x * 1.73) + 0.054 * Math.cos(x * 4.91));
  const atLeft = thatchEnd(x0);
  const atRight = thatchEnd(x1);
  const thatchLine = (x) => atLeft + ((x - x0) / (x1 - x0)) * (atRight - atLeft);
  sheet(
    out,
    [
      [x0, 0],
      [x1, 0],
      [x1, atRight],
      [x0, atLeft],
    ],
    (_x, z) => roofY(z),
    shade,
    detail,
  );

  const count = detail.panels ? Math.ceil((x1 - x0) / (detail.opening > 4 ? 0.041 : 0.105)) : 1;
  const rib = (x) => (count === 1 ? 0 : 0.018 * Math.cos((2 * Math.PI * x) / 0.166));
  const metal = (x, z, offset) => [x, roofY(z) + rib(x) + offset, z];
  const sheetColor = color(shade, 0.9 + 0.1 * Math.sin((x0 + x1) * 1.6));
  for (let i = 0; i < count; i++) {
    const a = x0 + ((x1 - x0) * i) / count;
    const b = x0 + ((x1 - x0) * (i + 1)) / count;
    const frontA = metal(a, near, 0);
    const frontB = metal(b, near, 0);
    const top = [metal(a, thatchLine(a), 0), frontA, frontB, metal(b, thatchLine(b), 0)];
    const under = top.map(([x, y, z]) => [x, y - 0.039, z]);
    face(out, 'roof', top, sheetColor);
    face(out, 'roof', under.toReversed(), color(sheetColor, 0.7));
    face(out, 'roof', [frontA, under[1], under[2], frontB], color(sheetColor, 0.82));

    if (!detail.panels || i % 2 !== 0) continue;
    const x = (a + b) / 2;
    const end = Math.min(near - 0.024, thatchLine(x) + 0.04 + 0.076 * (1 + Math.sin(25 * x)));
    face(
      out,
      'thatch',
      [
        [a, roofY(thatchLine(a)) + 0.105, thatchLine(a) - 0.014],
        [x, roofY(end) + 0.027, end],
        [b, roofY(thatchLine(b)) + 0.11, thatchLine(b) - 0.014],
      ],
      color(dryThatch, surfaceTints[i % 5]),
    );
  }
}

function hangingEaveFibers(out, x0, x1, near, detail) {
  if (detail.carvings <= 6) return;
  const count = Math.ceil((x1 - x0) * (detail.carvings > 8 ? 12 : 8));
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / count;
    const variation = Math.sin(x * 15.82) ** 2;
    const length = 0.24 + 0.72 * variation + 0.14 * Math.cos(x * 4.17);
    const width = 0.004 + 0.005 * variation;
    const y = roofY(near) + 0.008;
    const z = near - 0.01;
    const drift = 0.038 * Math.sin(x * 6.5);
    loft(
      out,
      'thatch',
      [
        radialRing(y, width, width, 3, [x, z]),
        radialRing(y - length * 0.42, width * 0.71, width * 0.52, 3, [x + drift, z + 0.02]),
        radialRing(y - length, width * 0.28, width * 0.22, 3, [x + drift * 1.6, z + 0.049]),
      ],
      color(dampThatch, 0.63 + 0.43 * variation),
      { cap: false },
    );
  }
}

function roofs(out, detail) {
  const left = -8.1,
    right = 8.1,
    near = 3.7,
    far = -3.7;
  const leftEdge = center - porchWidth,
    rightEdge = center + porchWidth;
  const ridgeJoin = 0.045;
  const backToGable = (x) => Math.max(ridgeJoin, ((ridge - gableY(x)) * near) / (ridge - eave));
  const inner = ((porchHeight - roofY(ridgeJoin)) * porchWidth) / (porchHeight - eave);
  const plan = (x0, x1, minZ, maxZ) => [
    [x0, minZ(x0)],
    [x1, minZ(x1)],
    [x1, maxZ(x1)],
    [x0, maxZ(x0)],
  ];
  const segments = [
    [left, leftEdge],
    [leftEdge, center - inner],
    [center - inner, center],
    [center, center + inner],
    [center + inner, rightEdge],
    [rightEdge, right],
  ];
  for (const [lo, hi] of segments) {
    const count = detail.panels ? Math.ceil((hi - lo) / 1.0) : 1;
    for (let i = 0; i < count; i++) {
      const x0 = lo + ((hi - lo) * i) / count,
        x1 = lo + ((hi - lo) * (i + 1)) / count;
      const shade = color(i % 5 === 3 ? oxidized : fadedMetal, surfaceTints[(i + 1) % 5]);
      sheet(
        out,
        plan(
          x0,
          x1,
          () => far,
          () => 0,
        ),
        (_x, z) => roofY(z),
        shade,
        detail,
      );
      if (lo < leftEdge || hi > rightEdge) {
        entranceEave(out, x0, x1, near, shade, detail);
        if (lo >= rightEdge) hangingEaveFibers(out, x0, x1, near, detail);
      } else {
        sheet(
          out,
          plan(x0, x1, () => 0, backToGable),
          (_x, z) => roofY(z),
          shade,
          detail,
        );
      }
    }
  }
  for (const [a, b] of segments.slice(1, -1)) {
    sheet(
      out,
      plan(a, b, backToGable, () => porchEdge),
      (x) => gableY(x),
      fadedMetal,
      detail,
      true,
    );
  }
  const backFill = [
    [center - inner, roofY(ridgeJoin), ridgeJoin],
    [center, porchHeight, ridgeJoin],
    [center + inner, roofY(ridgeJoin), ridgeJoin],
  ];
  face(out, 'earth', backFill, color(plaster, 0.76));
  if (detail.panels) {
    frayedEave(out, detail, true, left, right, far, () => eave, -1);
    frayedEave(out, detail, true, leftEdge, rightEdge, porchEdge, gableY, 1);
  }
  const fasciaBeamY = eave - 0.12;
  beam(out, 'posts', [left, fasciaBeamY, near], [leftEdge, fasciaBeamY, near], 0.12, 0.18, wood);
  beam(out, 'posts', [rightEdge, fasciaBeamY, near], [right, fasciaBeamY, near], 0.12, 0.18, wood);
  for (const z of detail.carvings ? [1.56, 2.5, 3.43, 4.36, 5.26] : [1.56, 5.26]) {
    const y = eave - 0.07;
    beam(out, 'posts', [leftEdge, y, z], [rightEdge, y, z], 0.12, 0.11, wood);
    beam(out, 'posts', [leftEdge, y, z], [center, porchHeight - 0.09, z], 0.12, 0.13, wood);
    beam(out, 'posts', [center, porchHeight - 0.09, z], [rightEdge, y, z], 0.12, 0.13, wood);
    if (detail.carvings) {
      beam(out, 'posts', [center, y, z], [center, porchHeight - 0.14, z], 0.1, 0.1, wood);
      for (const s of [-1, 1])
        beam(
          out,
          'posts',
          [center, y + 0.14, z],
          [center + s * 0.87, porchHeight - 1.04, z],
          0.085,
          0.1,
          wood,
        );
    }
  }
}

function courtPier(out, detail, x, z, height, seed) {
  const floor = 0.29;
  const tint = color(plaster, 0.84 + 0.092 * Math.sin(seed * 2.1));
  if (!detail.relief) {
    beam(out, 'earth', [x, floor, z], [x, height, z], 0.33, 0.35, tint);
    return;
  }
  const profile = [
    [0, 0.25],
    [0.11, 0.22],
    [0.46, 0.176],
    [0.72, 0.21],
    [0.91, 0.145],
    [1, 0.147],
  ];
  loft(
    out,
    'earth',
    profile.map(([t, r]) =>
      radialRing(floor + t * (height - floor), r, r * 0.87, 8, [
        x + 0.073 * (1 - t) * Math.sin(seed + t * 3),
        z + 0.065 * (1 - t) * Math.sin(seed * 1.35 + t * 2),
      ]),
    ),
    tint,
  );
}

function canopyCarvings(out, detail, z) {
  const finish = color(plaster, 0.92);
  const close = detail.opening >= 6;
  const sides = close ? 14 : 6;
  // The two photographed supports have different stacked forms and project into the court.
  const profiles = [
    [
      [0.31, 0, 0.24],
      [0.41, -0.025, 0.22],
      [0.57, -0.065, 0.15],
      [0.79, -0.06, 0.2],
      [0.98, 0.035, 0.225],
      [1.18, 0.015, 0.14],
      [1.39, -0.005, 0.195],
      [1.59, 0.04, 0.145],
      [1.83, 0, 0.135],
    ],
    [
      [0.31, 0, 0.22],
      [0.46, 0.04, 0.19],
      [0.71, 0.06, 0.133],
      [0.89, -0.055, 0.225],
      [1.04, -0.07, 0.197],
      [1.26, 0.065, 0.16],
      [1.46, 0.04, 0.217],
      [1.66, -0.015, 0.14],
      [1.83, 0, 0.155],
    ],
  ];
  for (const [i, side] of [-1, 1].entries()) {
    const x = center + side * 0.95;
    loft(
      out,
      'earth',
      profiles[i].map(([y, dx, radius]) =>
        radialRing(y, radius, radius * 0.77, sides, [x + dx, z + 0.085]),
      ),
      color(finish, i ? 0.96 : 1.04),
    );
    for (const [y, dx, width] of i
      ? [
          [0.98, -0.055, 0.115],
          [1.53, 0.04, 0.125],
        ]
      : [
          [0.78, -0.065, 0.096],
          [1.43, 0.025, 0.107],
        ]) {
      sphere(
        out,
        'earth',
        [x + dx, y, z + 0.217],
        [width, 0.137, 0.085],
        finish,
        sides,
        close ? 7 : 4,
      );
      const upper = [x + dx - 0.116, y - 0.065, z + 0.178];
      const lower = [x + dx + 0.085, y - 0.16, z + 0.232];
      if (close) tube(out, 'earth', upper, lower, 0.035, color(finish, 0.94), 8);
      else beam(out, 'earth', upper, lower, 0.068, 0.052, color(finish, 0.94));
    }
  }

  // The lower figure stands beside the right post and leaves the central opening clear.
  const x = center + 1.59;
  box(out, 'stone', [x - 0.195, 0.27, z - 0.195], [x + 0.195, 0.39, z + 0.205], base);
  loft(
    out,
    'earth',
    [
      radialRing(0.39, 0.17, 0.13, sides, [x, z + 0.025]),
      radialRing(0.59, 0.15, 0.14, sides, [x + 0.032, z + 0.015]),
      radialRing(0.81, 0.119, 0.105, sides, [x + 0.02, z - 0.03]),
    ],
    color(finish, 0.88),
  );
  sphere(
    out,
    'earth',
    [x + 0.021, 0.88, z - 0.004],
    [0.108, 0.135, 0.103],
    finish,
    sides,
    close ? 7 : 4,
  );
}

// Worn paving visible at the foot of the canopy, with exposed earth beyond it.
function canopyPaving(out, detail) {
  if (!detail.relief) return;
  const close = detail.carvings > 6;
  const rows = [
    { z: -7.48, depth: 0.89, edges: [-2.66, -1.87, -0.62] },
    { z: -6.57, depth: 0.86, edges: [-2.78, -1.51, -0.49] },
    { z: -5.69, depth: 0.78, edges: [-2.92, -1.92, -0.55] },
    { z: -4.89, depth: 0.83, edges: [-2.88, -2.11, -1.12, -0.43] },
    { z: -4.04, depth: 0.49, edges: [-2.72, -1.62, -0.59] },
  ];
  const shades = [
    [0.43, 0.398, 0.338],
    [0.49, 0.459, 0.388],
    [0.37, 0.343, 0.297],
    [0.44, 0.415, 0.365],
    [0.41, 0.385, 0.315],
  ];
  for (const [row, { z, depth, edges }] of rows.entries()) {
    for (let i = 1; i < edges.length; i++) {
      const x0 = edges[i - 1] + 0.007;
      const x1 = edges[i] - 0.007;
      const z1 = z + depth;
      const offset = 0.037 * Math.sin(row * 2 + i);
      const floor = 0.298 + 0.008 * (0.5 + 0.5 * Math.cos(2 * row + i));
      const corners = [
        [x0 + 0.031, z + 0.018],
        [x0 + offset, z1 - 0.053],
        [x0 + 0.115, z1 - 0.01],
        [x1 - 0.075, z1 - 0.015],
        [x1, z1 - 0.083],
        [x1 - 0.026 + offset, z + 0.012],
      ];
      const tint = shades[(row * 3 + i) % shades.length];
      face(
        out,
        'stone',
        corners.map(([x, z]) => [x, floor, z]),
        tint,
      );
      if (!close) continue;
      for (let j = 0; j < corners.length; j++) {
        const [x, z] = corners[j];
        const [u, v] = corners[(j + 1) % corners.length];
        face(
          out,
          'stone',
          [
            [x, 0.286, z],
            [u, 0.286, v],
            [u, floor, v],
            [x, floor, z],
          ],
          color(tint, 0.82),
        );
      }
    }
  }
}

function canopyShrine(out, detail, profile, frontZ, rearZ) {
  const ground = 0.29;
  const lintel = 1.48;
  const left = center + profile[0][0];
  const right = center + profile.at(-1)[0];
  const entryLeft = center - 0.64;
  const entryRight = center + 0.63;
  const earth = color(plaster, 0.54);
  const inside = [0.064, 0.055, 0.043];
  const crown = (z) => profile.map(([x, y]) => [center + x, y - 0.043, z]);
  const top = crown(frontZ);
  face(out, 'earth', [[left, lintel, frontZ], [right, lintel, frontZ], ...top.toReversed()], earth);
  for (const [a, b] of [
    [left, entryLeft],
    [entryRight, right],
  ])
    face(
      out,
      'earth',
      [
        [a, ground, frontZ],
        [b, ground, frontZ],
        [b, lintel, frontZ],
        [a, lintel, frontZ],
      ],
      earth,
    );

  for (const [x, reverse] of [
    [left, false],
    [right, true],
  ]) {
    const y = top[0][1];
    const wall = [
      [x, ground, rearZ],
      [x, ground, frontZ],
      [x, y, frontZ],
      [x, y, rearZ],
    ];
    face(out, 'earth', reverse ? wall.toReversed() : wall, earth);
  }
  const rear = [[left, ground, rearZ], [right, ground, rearZ], ...crown(rearZ).toReversed()];
  face(out, 'earth', rear.toReversed(), color(earth, 0.92));
  // The photograph shows the opening and the dark reveal. Terminate the visible recess
  // under the roof, without estimating a room behind the photographed threshold.
  const recessZ = frontZ - 0.91;
  face(
    out,
    'earth',
    [
      [entryLeft, ground, recessZ],
      [entryRight, ground, recessZ],
      [entryRight, lintel, recessZ],
      [entryLeft, lintel, recessZ],
    ],
    inside,
  );
  if (!detail.relief) return;

  for (const [x, reverse] of [
    [entryLeft, true],
    [entryRight, false],
  ]) {
    const reveal = [
      [x, ground, recessZ],
      [x, ground, frontZ],
      [x, lintel, frontZ],
      [x, lintel, recessZ],
    ];
    face(out, 'earth', reverse ? reveal.toReversed() : reveal, inside);
  }
  face(
    out,
    'earth',
    [
      [entryLeft, lintel, recessZ],
      [entryRight, lintel, recessZ],
      [entryRight, lintel, frontZ],
      [entryLeft, lintel, frontZ],
    ],
    inside,
  );
  const tread = [
    [entryLeft - 0.07, 0.321, frontZ + 0.28],
    [entryRight + 0.05, 0.312, frontZ + 0.24],
    [entryRight, 0.322, recessZ],
    [entryLeft, 0.327, recessZ],
  ];
  face(out, 'stone', tread, color(base, 0.73));
  const [a, b] = tread;
  face(out, 'stone', [[a[0], ground, a[2]], [b[0], ground, b[2]], b, a], dampStone);
}

function courtyard(out, detail) {
  const soil = [0.42, 0.345, 0.225];
  box(out, 'earth', [-7.81, -0.34, -11.65], [7.81, 0.29, -3.28], soil);
  canopyPaving(out, detail);
  const rect = (a, b, c, d) => [
    [a, c],
    [b, c],
    [b, d],
    [a, d],
  ];
  const rearLow = -9.72;
  const roofBack = -11.95;
  const inner = 5.12;
  const low = 2.53;
  const high = 3.87;
  const outer = 8.1;
  const frontJoin = -3.7;
  const galleryBreak = -5.65;
  const galleryWall = 7.53;
  const across = (x) => (Math.abs(x) - inner) / (outer - inner);
  const backEdge = (x) => rearLow + across(x) * (roofBack - rearLow);
  const grade = (x) => low + (high - low) * across(x);
  const approach = (x, z) => {
    const t = Math.max(0, Math.min(1, (z - galleryBreak) / (frontJoin - galleryBreak)));
    return grade(x) + t * (eave - grade(x));
  };
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -outer : inner;
    const x1 = side < 0 ? -inner : outer;
    sheet(
      out,
      [
        [x0, backEdge(x0)],
        [x1, backEdge(x1)],
        [x1, galleryBreak],
        [x0, galleryBreak],
      ],
      grade,
      fadedMetal,
      detail,
      true,
    );
    sheet(out, rect(x0, x1, galleryBreak, frontJoin), approach, fadedMetal, detail, true);
    const wall = side * galleryWall;
    const stop = -11.45;
    const top = (z) =>
      (z < backEdge(wall)
        ? low + (high - low) * ((rearLow - z) / (rearLow - roofBack))
        : approach(wall, z)) - 0.07;
    for (const [a, b] of [
      [stop, backEdge(wall)],
      [backEdge(wall), galleryBreak],
      [galleryBreak, -3.12],
    ]) {
      for (const offset of [-0.14, 0.14]) {
        const x = wall + offset;
        const wallFace = [
          [x, 0.28, a],
          [x, 0.28, b],
          [x, top(b), b],
          [x, top(a), a],
        ];
        face(out, 'earth', offset > 0 ? wallFace.toReversed() : wallFace, plaster);
      }
    }
    const support = side * 5.37;
    for (const [i, z] of [-8.93, -6.6, -4.3].entries()) {
      courtPier(out, detail, support, z, approach(support, z) - 0.03, i + side * 3);
      if (detail.relief)
        sphere(
          out,
          'earth',
          [support - side * 0.092, 1.81, z],
          [0.146, 0.242, 0.17],
          color(plaster, 0.85),
          7,
          4,
        );
    }
    frayedEave(
      out,
      detail,
      false,
      rearLow,
      frontJoin,
      side * inner,
      (z) => approach(inner, z),
      -side,
    );
  }
  const backSlope = (_x, z) => low + (high - low) * ((rearLow - z) / (rearLow - roofBack));
  sheet(
    out,
    [
      [-outer, roofBack],
      [outer, roofBack],
      [inner, rearLow],
      [-inner, rearLow],
    ],
    backSlope,
    fadedMetal,
    detail,
  );
  box(
    out,
    'earth',
    [-7.63, 0.28, -11.49],
    [7.63, backSlope(0, -11.49), -11.18],
    color(plaster, 0.89),
  );
  const rearSupports = detail.opening > 1 ? [-4.55, -2.25, 0.05, 2.35, 4.65] : [-4.55, 0.05, 4.65];
  for (const [i, x] of rearSupports.entries())
    courtPier(out, detail, x, rearLow - 0.16, 2.57, 8 + i);
  frayedEave(out, detail, true, -inner, inner, rearLow, () => low, 1);

  // The thatched roof shelters the photographed recessed shrine behind the carved supports.
  const canopy = [
    [-1.22, 1.62],
    [-0.87, 2.34],
    [-0.46, 2.83],
    [0, 2.98],
    [0.46, 2.83],
    [0.87, 2.34],
    [1.22, 1.62],
  ];
  const canopyFront = -4.48;
  const canopyBack = -7.77;
  for (let i = 1; i < canopy.length; i++) {
    const [a, ya] = canopy[i - 1];
    const [b, yb] = canopy[i];
    const height = (x) => ya + ((x - center - a) * (yb - ya)) / (b - a);
    sheet(
      out,
      rect(center + a, center + b, canopyBack, canopyFront),
      height,
      fadedMetal,
      detail,
      true,
    );
  }
  canopyShrine(out, detail, canopy, -5.65, -7.65);
  const z = -4.75;
  for (const [i, side] of [-1, 1].entries()) {
    const x = center + side * 0.95;
    courtPier(out, detail, x, z, 1.83, 14 + i * 2);
    if (detail.relief)
      beam(out, 'posts', [x, 1.76, z], [center + side * 0.72, 2.45, z], 0.087, 0.095, wood);
  }
  if (detail.relief) {
    canopyCarvings(out, detail, z);
    for (const [i, [x, y]] of canopy.slice(0, -1).entries()) {
      const [b, endY] = canopy[i + 1];
      frayedEave(
        out,
        detail,
        true,
        center + x,
        center + b,
        canopyFront,
        (u) => y + (endY - y) * ((u - center - x) / (b - x)),
        1,
      );
    }
  }
}

function paintings(out, detail, z) {
  if (!detail.paint) return;
  const stroke = (points, thickness, pigment, depth = z) => {
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1],
        [a, b] = points[i];
      const length = Math.hypot(a - x, b - y);
      const u = ((y - b) * thickness) / length,
        v = ((a - x) * thickness) / length;
      face(
        out,
        'pigment',
        [
          [x - u, y - v, depth],
          [a - u, b - v, depth],
          [a + u, b + v, depth],
          [x + u, y + v, depth],
        ],
        pigment,
      );
    }
  };
  const dark = palette[0];
  const light = palette[1];
  const stippleStep = detail.paint < 15 ? 0.25 : 0.113;
  for (const [i, { x, width, motifs }] of paintedPanels.entries()) {
    for (let row = 0, y = 0.62; y < 2.48; row++, y += stippleStep) {
      for (let col = 0, u = -width / 2 + 0.058; u < width / 2 - 0.035; col++, u += stippleStep) {
        const n = row * 17 + col * 9 + i * 31;
        if (n % 11 === 2 || n % 11 === 6) continue;
        const px = x + u + 0.025 * Math.sin(n * 0.86);
        const py = y + 0.026 * Math.cos(n * 0.72);
        const radius = 0.011 + 0.01 * (0.5 + 0.5 * Math.cos(n * 0.39));
        face(
          out,
          'pigment',
          [
            [px - radius, py - radius * 0.36, z],
            [px - radius * 0.42, py - radius, z],
            [px + radius * 0.72, py - radius * 0.8, z],
            [px + radius, py + radius * 0.33, z],
            [px + radius * 0.25, py + radius, z],
            [px - radius * 0.73, py + radius * 0.69, z],
          ],
          n % 5 === 0 ? color(light, 0.84) : color(dark, 0.85 + 0.19 * Math.sin(n)),
        );
      }
    }
    for (const [band, motif] of motifs.entries()) {
      const cx = x + width * [0.18, -0.15, 0.085][(band + i) % 3];
      const cy = [1.1, 1.67, 2.18][band];
      const rx = Math.min(0.34 * width, 0.48);
      const field = z + 0.001;
      const accent = palette[2 + ((band + i) % 2)];
      if (motif === 'stripes') {
        for (let stripe = -2; stripe <= 2; stripe++) {
          const sx = cx + 0.23 * stripe * rx;
          stroke(
            [
              [sx - 0.05, cy - 0.26],
              [sx + 0.016, cy + 0.06],
              [sx, cy + 0.21],
            ],
            0.019,
            dark,
            field,
          );
        }
      } else if (motif === 'fork') {
        stroke(
          [
            [cx - rx, cy + 0.19],
            [cx - rx * 0.66, cy - 0.02],
            [cx, cy - 0.28],
            [cx + rx * 0.33, cy + 0.02],
            [cx + rx, cy + 0.14],
          ],
          0.027,
          accent,
          field,
        );
        stroke(
          [
            [cx - 0.035, cy - 0.22],
            [cx + 0.08, cy + 0.24],
          ],
          0.023,
          dark,
          field + 0.001,
        );
      } else {
        const arc = motif === 'arc';
        for (let k = 0; k < (arc ? 2 : 3); k++) {
          const curve = Array.from({ length: detail.paint + 1 }, (_, j) => {
            const t = (j / detail.paint) * Math.PI * (arc ? 1.58 : 2) - (arc ? 0.88 : 0);
            const r = 1 - k * 0.275 + 0.085 * Math.sin(3 * t + i);
            return [cx + r * rx * Math.cos(t), cy + r * (arc ? 0.23 : 0.19) * Math.sin(t)];
          });
          stroke(curve, 0.024 - 0.002 * k, [dark, light, accent][k], field);
        }
      }
    }
  }
}

const detailByTier = {
  skyline: { opening: 1, carvings: 0, panels: 0, paint: 0, relief: false },
  district: { opening: 2, carvings: 4, panels: 0, paint: 0, relief: false },
  street: { opening: 4, carvings: 6, panels: 0.25, paint: 11, relief: true },
  closeup: { opening: 6, carvings: 8, panels: 0.105, paint: 19, relief: true },
  master: { opening: 9, carvings: 14, panels: 0.082, paint: 32, relief: true },
};

export function buildFirstPalace(out, tier) {
  const detail = detailByTier[tier];
  foundation(out, detail);
  porchSteps(out, detail);
  entranceJambs(out, detail);
  porchFringe(out, detail);
  box(out, 'earth', [-7.55, 0.28, -3.13], [-7.27, 2.7, front], color(frontPlaster, 0.96));
  box(out, 'earth', [7.2, 0.28, -3.13], [7.5, 2.7, front], color(frontPlaster, 0.91));
  box(out, 'earth', [-7.27, 0.28, -3.13], [-2.2, 2.72, -2.87], color(plaster, 0.85));
  box(out, 'earth', [-1.02, 0.28, -3.13], [7.2, 2.72, -2.87], color(plaster, 0.85));
  box(out, 'earth', [-2.2, 2.34, -3.13], [-1.02, 2.72, -2.87], color(plaster, 0.85));
  const sections = [
    [-7.49, -4.92, [-6.18, 1.61, 0.92, 0.75]],
    [-4.92, -3.03, [-4.04, 1.54, 0.57, 0.66]],
    [-0.13, 1.94, [0.95, 1.54, 0.7, 0.63]],
    [1.94, 4.14, [3.06, 1.52, 0.87, 0.68]],
    [4.14, 7.3, [5.79, 1.51, 1.24, 0.72]],
  ];
  for (const [i, [lo, hi, aperture]] of sections.entries())
    frontPanel(out, lo, hi, 2.7, front, aperture, detail, i);
  box(out, 'earth', [-3.03, 2.51, front - 0.28], [-0.13, 2.7, front], frontPlaster);
  const innerZ = 0.44;
  box(out, 'earth', [-7.27, 0.29, innerZ - 0.27], [-2.13, 2.64, innerZ], color(plaster, 0.79));
  box(out, 'earth', [-1.11, 0.29, innerZ - 0.26], [7.2, 2.64, innerZ], color(plaster, 0.79));
  box(out, 'earth', [-2.13, 2.3, innerZ - 0.26], [-1.11, 2.64, innerZ], color(plaster, 0.84));
  entranceGrille(out, innerZ + 0.037, detail);
  paintings(out, detail, innerZ + 0.003);
  roofs(out, detail);
  courtyard(out, detail);
  for (const [i, [x, z]] of [
    [-7.1, 3.55],
    [-5.38, 3.57],
    [-3.28, 5.13],
    [-2.4, 4.84],
    [-0.83, 4.84],
    [0.08, 5.13],
    [1.58, 3.51],
    [3.86, 3.55],
    [6.3, 3.56],
    [7.72, 3.47],
  ].entries()) {
    box(
      out,
      'stone',
      [x - 0.119, 0.25, z - 0.115],
      [x + 0.119, 0.435, z + 0.115],
      color(base, surfaceTints[i % 5]),
    );
    const height =
      z > 4
        ? gableY(center + Math.sign(x - center) * (Math.abs(x - center) + 0.265)) - 0.045
        : roofY(z) - 0.095;
    const connector = z > 4 ? gableY(x) - 0.096 : roofY(z) - 0.095;
    column(out, x, z, height, i, detail);
    if (connector > height + 0.06)
      beam(out, 'posts', [x, height - 0.023, z], [x, connector, z], 0.084, 0.084, wood);
  }
  if (detail.relief) {
    for (const [i, [x, y, z, width]] of [
      [1.88, 1.35, 3.03, 0.2],
      [4.11, 1.24, 3.05, 0.24],
      [7.24, 1.33, 3.02, 0.23],
      [-4.9, 1.26, 3.03, 0.22],
    ].entries()) {
      const radii = [width, 0.52 + 0.05 * (i % 3), 0.125];
      sphere(
        out,
        'earth',
        [x, y, z],
        radii,
        color(frontPlaster, 0.91 + 0.09 * (i % 3)),
        detail.carvings,
        7,
      );
      sphere(
        out,
        'earth',
        [x + 0.032, y + 0.49, z + 0.048],
        [width * 0.6, 0.18, 0.13],
        color(frontPlaster, 0.96),
        detail.carvings,
        5,
      );
      for (const sign of [-1, 1])
        beam(
          out,
          'earth',
          [x + sign * 0.065, y + 0.31, z + 0.105],
          [x + sign * 0.18, y + 0.03, z + 0.057],
          0.12,
          0.1,
          color(frontPlaster, 0.94),
        );
    }
  }
}

export const buildSkyline = (out) => buildFirstPalace(out, 'skyline');
export const buildDistrict = (out) => buildFirstPalace(out, 'district');
export const buildStreet = (out) => buildFirstPalace(out, 'street');
export const buildCloseup = (out) => buildFirstPalace(out, 'closeup');
