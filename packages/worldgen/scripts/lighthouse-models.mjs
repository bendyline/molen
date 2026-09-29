/** Individually researched lighthouse exteriors; dimensions and reconstructed details stay explicit. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.56, 0.51, 0.42],
  stoneLight = [0.64, 0.6, 0.51],
  dark = [0.09, 0.115, 0.12],
  white = [0.89, 0.89, 0.85],
  red = [0.64, 0.13, 0.095];
const square = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];
export function transformed(out, angle = 0, offset = [0, 0, 0]) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const turn = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  const point = (p) => turn(p).map((n, i) => n + offset[i]);
  return {
    addQuad(slot, ref, p, n, uv, color) {
      out.addQuad(slot, ref, p.map(point), turn(n), uv, color);
    },
    addTriangle(slot, ref, p, n, uv, color) {
      out.addTriangle(slot, ref, p.map(point), turn(n), uv, color);
    },
    addConvexPolygon(slot, ref, p, n, uv, color) {
      out.addConvexPolygon(slot, ref, p.map(point), turn(n), (v) => uv(v), color);
    },
  };
}
export function lathe(out, slot, profile, color, segments = 64, center = [0, 0]) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, segments, center)),
    color,
  );
}
export function railRing(out, y, r, height, color = dark, segments = 32) {
  for (const yy of [y + height * 0.48, y + height])
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        b = ((i + 1) * Math.PI * 2) / segments;
      tube(
        out,
        'metal',
        [Math.cos(a) * r, yy, Math.sin(a) * r],
        [Math.cos(b) * r, yy, Math.sin(b) * r],
        0.025,
        color,
        8,
      );
    }
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments;
    tube(
      out,
      'metal',
      [Math.cos(a) * r, y, Math.sin(a) * r],
      [Math.cos(a) * r, y + height, Math.sin(a) * r],
      0.029,
      color,
      8,
    );
  }
}
export function squareCornice(out, y, r, slot = 'granite', color = stoneLight) {
  loft(
    out,
    slot,
    [square(y, r - 0.25), square(y + 0.12, r), square(y + 0.35, r), square(y + 0.5, r - 0.05)],
    color,
  );
}
export function panel(out, slot, x0, x1, y0, y1, z, color) {
  if (x1 - x0 < 0.0001 || y1 - y0 < 0.0001) return;
  quad(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
    color,
  );
}
/** Rectangular wall with actual deep openings and a closed, inset back face. */
export function piercedFacade(out, { half, y0, y1, z, holes, slot = 'ashlar', color = stone }) {
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])])].sort(
    (a, b) => a - b,
  );
  for (let band = 1; band < ys.length; band++) {
    const low = ys[band - 1],
      high = ys[band],
      mid = (low + high) / 2;
    const cuts = holes.filter((h) => mid > h.y && mid < h.y + h.h).sort((a, b) => a.x - b.x);
    let x = -half;
    for (const hole of cuts) {
      panel(out, slot, x, hole.x - hole.w / 2, low, high, z, color);
      x = hole.x + hole.w / 2;
    }
    panel(out, slot, x, half, low, high, z, color);
  }
  for (const h of holes) {
    const x0 = h.x - h.w / 2,
      x1 = h.x + h.w / 2,
      a = h.y,
      b = h.y + h.h,
      d = h.depth ?? 0.32;
    panel(out, h.blind ? slot : 'glass', x0, x1, a, b, z - d, h.blind ? color : dark);
    for (const points of [
      [
        [x0, a, z],
        [x0, a, z - d],
        [x0, b, z - d],
        [x0, b, z],
      ],
      [
        [x1, a, z - d],
        [x1, a, z],
        [x1, b, z],
        [x1, b, z - d],
      ],
      [
        [x0, a, z - d],
        [x0, a, z],
        [x1, a, z],
        [x1, a, z - d],
      ],
      [
        [x0, b, z],
        [x0, b, z - d],
        [x1, b, z - d],
        [x1, b, z],
      ],
    ])
      quad(out, slot, points, normalFor(...points.slice(0, 3)), color);
    const trim = h.trim ?? 0.16;
    if (trim > 0) {
      for (const x of [x0 - trim / 2, x1 + trim / 2])
        box(
          out,
          'granite',
          [x - trim / 2, a - trim, z - 0.015],
          [x + trim / 2, b + trim, z + 0.065],
          stoneLight,
        );
      for (const y of [a - trim / 2, b + trim / 2])
        box(
          out,
          'granite',
          [x0 - trim, y - trim / 2, z - 0.015],
          [x1 + trim, y + trim / 2, z + 0.065],
          stoneLight,
        );
      box(
        out,
        'granite',
        [x0 - trim * 1.8, b + trim, z - 0.015],
        [x1 + trim * 1.8, b + trim * 1.6, z + 0.14],
        stoneLight,
      );
    }
  }
}
export function lantern(
  out,
  { bottom, radius, height, color = dark, glass = true, segments = 12, roofHeight = 0.9 },
) {
  lathe(
    out,
    'metal',
    [
      [bottom, radius * 1.09],
      [bottom + 0.16, radius * 1.09],
      [bottom + 0.23, radius],
    ],
    color,
    48,
  );
  if (glass)
    loft(
      out,
      'glass',
      [
        radialRing(bottom + 0.23, radius * 0.98, radius * 0.98, segments),
        radialRing(bottom + height, radius * 0.98, radius * 0.98, segments),
      ],
      [0.27, 0.39, 0.42],
    );
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments;
    tube(
      out,
      'metal',
      [Math.cos(a) * radius, bottom + 0.17, Math.sin(a) * radius],
      [Math.cos(a) * radius, bottom + height, Math.sin(a) * radius],
      0.045,
      color,
      8,
    );
  }
  for (const y of [bottom + height * 0.51, bottom + height])
    lathe(
      out,
      'metal',
      [
        [y, radius * 1.02],
        [y + 0.055, radius * 1.02],
      ],
      color,
      48,
    );
  lathe(
    out,
    'metal',
    [
      [bottom + height, radius * 1.16],
      [bottom + height + 0.14, radius * 1.16],
      [bottom + height + 0.35, radius * 0.96],
      [bottom + height + roofHeight * 0.8, radius * 0.38],
      [bottom + height + roofHeight, 0.065],
    ],
    color,
    64,
  );
  sphere(
    out,
    'metal',
    [0, bottom + height + roofHeight + 0.16, 0],
    [0.13, 0.16, 0.13],
    color,
    20,
    12,
  );
}

export function buildHercules(out) {
  // Polygonal platform and parapet; origin is the terrain-contact base.
  loft(out, 'ashlar', [radialRing(0, 16.2, 16.2, 12), radialRing(1.4, 16.2, 16.2, 12)], stone);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    const start = [Math.cos(a) * 15.7, Math.sin(a) * 15.7];
    const end = [Math.cos(b) * 15.7, Math.sin(b) * 15.7];
    // Open the parapet at the landing; retain the sides of both adjacent polygon edges.
    if (i === 2 || i === 3) {
      const clipped = i === 2 ? end : start;
      const fixed = i === 2 ? start : end;
      const x = i === 2 ? 2.8 : -2.8;
      clipped[1] += ((x - clipped[0]) / (fixed[0] - clipped[0])) * (fixed[1] - clipped[1]);
      clipped[0] = x;
    }
    beam(out, 'ashlar', [start[0], 1.95, start[1]], [end[0], 1.95, end[1]], 0.52, 1.1, stone);
    beam(
      out,
      'granite',
      [start[0], 2.54, start[1]],
      [end[0], 2.54, end[1]],
      0.63,
      0.12,
      stoneLight,
    );
  }
  box(out, 'granite', [-2.5, 0, 14.7], [2.5, 1.4, 16.0], stoneLight);
  for (let i = 0; i < 8; i++)
    box(
      out,
      'granite',
      [-2.5, 0, 16.0 + i * 0.35],
      [2.5, 1.4 - i * 0.17, 16.35 + i * 0.35],
      stoneLight,
    );
  const half = 5.875,
    base = 1.4,
    top = 35.78;
  // Ten niches/openings per elevation and their architraves are geometry, not a facade bitmap.
  for (let face = 0; face < 4; face++) {
    const o = transformed(out, (face * Math.PI) / 2);
    const holes = [];
    for (let row = 0; row < 5; row++)
      for (const column of [-1, 1])
        holes.push({
          x: column * 2.25,
          // Each facade follows the helical band; identical rows on all faces would cut openings.
          y: base + 1.6 + face * 1.575 + row * 6.3,
          w: 1.1,
          h: 2.35,
          blind: column < 0 || row === 4,
          depth: 0.3,
        });
    piercedFacade(o, { half, y0: base, y1: top, z: half, holes });
    for (let turn = 0; turn < 6; turn++) {
      const low = base - 0.2 + turn * 6.3 + face * 1.575,
        high = low + 1.575;
      if (low < base || high > top - 0.9) continue;
      beam(
        o,
        'granite',
        [-half, low, half + 0.035],
        [half, high, half + 0.035],
        0.1,
        0.23,
        stoneLight,
      );
    }
    for (const x of [-half + 0.23, half - 0.23])
      box(o, 'granite', [x - 0.23, base, half - 0.02], [x + 0.23, top - 0.2, half + 0.04], stone);
  }
  squareCornice(out, 35.55, 6.4);
  // The concave shoulder is approximated by multiple measured-profile loft stations.
  loft(
    out,
    'ashlar',
    [
      [36.05, 5.0],
      [36.5, 4.8],
      [37.15, 4.55],
      [38.0, 4.42],
      [42.55, 4.42],
    ].map(([y, r]) =>
      radialRing(y, r / Math.cos(Math.PI / 8), r / Math.cos(Math.PI / 8), 8, [0, 0], Math.PI / 8),
    ),
    stone,
  );
  for (let face = 0; face < 4; face++) {
    const o = transformed(out, (face * Math.PI) / 2);
    panel(o, 'glass', -0.52, 0.52, 38.75, 40.55, 4.435, dark);
    for (const x of [-0.63, 0.63])
      box(o, 'granite', [x - 0.09, 38.6, 4.4], [x + 0.09, 40.7, 4.58], stoneLight);
    for (const y of [38.58, 40.67])
      box(o, 'granite', [-0.77, y, 4.4], [0.77, y + 0.13, 4.64], stoneLight);
  }
  for (const [y, r] of [
    [42.5, 4.85],
    [42.82, 4.96],
    [43.15, 4.72],
  ])
    lathe(
      out,
      'granite',
      [
        [y, r],
        [y + 0.17, r],
      ],
      stoneLight,
      8,
    );
  loft(
    out,
    'ashlar',
    [43.32, 47.6].map((y) => radialRing(y, 2.5, 2.5, 8, [0, 0], Math.PI / 8)),
    stone,
  );
  // Upper arcaded stage: paired pilasters, shallow arched niche bands, and eight crowning finials.
  for (let face = 0; face < 8; face++) {
    const a = (face * Math.PI) / 4,
      o = transformed(out, a),
      z = 2.32;
    panel(o, 'glass', -0.38, 0.38, 44.25, 45.75, z, dark);
    for (const x of [-0.6, 0.6])
      beam(o, 'granite', [x, 43.65, z + 0.015], [x, 46.75, z + 0.015], 0.18, 0.16, stoneLight);
    for (let i = 0; i < 14; i++) {
      const t0 = (i * Math.PI) / 14,
        t1 = ((i + 1) * Math.PI) / 14;
      beam(
        o,
        'granite',
        [Math.cos(t0) * 0.59, 45.78 + Math.sin(t0) * 0.64, z + 0.055],
        [Math.cos(t1) * 0.59, 45.78 + Math.sin(t1) * 0.64, z + 0.055],
        0.1,
        0.1,
        stoneLight,
      );
    }
  }
  lathe(
    out,
    'granite',
    [
      [47.55, 2.65],
      [47.82, 2.78],
      [48.02, 2.65],
    ],
    stoneLight,
    8,
  );
  railRing(out, 48.03, 2.58, 0.85, dark, 24);
  lantern(out, { bottom: 48.05, radius: 1.78, height: 2.13, roofHeight: 0.95, segments: 12 });
  // The conspicuous offset stone service/lightning spine reaches above the lantern.
  const spine = transformed(out, 0, [2.5, 0, -2.15]);
  lathe(
    spine,
    'ashlar',
    [
      [43.2, 0.65],
      [50, 0.5],
      [54.0, 0.28],
      [54.35, 0.08],
    ],
    stone,
    32,
  );
  for (let y = 43.6; y < 54; y += 0.47)
    lathe(
      spine,
      'granite',
      [
        [y, 0.66 - (y - 43.6) * 0.035],
        [y + 0.045, 0.66 - (y - 43.6) * 0.035],
      ],
      stoneLight,
      32,
    );
  tube(spine, 'metal', [0, 54.3, 0], [0, 55, 0], 0.013, dark, 8);
  for (const sign of [-1, 1])
    tube(out, 'metal', [2.5, 53.5, -2.15], [sign * 5.65, 35.7, -5.65], 0.012, dark, 6);
}

export function buildKopu(out) {
  // Massive lower core and four independently proportioned sloping buttresses.
  loft(out, 'plaster', [square(0, 5.65), square(11, 4.95), square(23.65, 4.12)], white);
  for (const [face, end, width] of [
    [0, 11.2, 3.4],
    [1, 11.6, 2.9],
    [2, 11.5, 2.5],
    [3, 10.6, 3.1],
  ]) {
    const o = transformed(out, (face * Math.PI) / 2);
    loft(
      o,
      'plaster',
      [
        [
          [-width, 0, 4.65],
          [-width, 0, end],
          [width, 0, end],
          [width, 0, 4.65],
        ],
        [
          [-width * 0.86, 4, 4.5],
          [-width * 0.86, 4, end - 1.2],
          [width * 0.86, 4, end - 1.2],
          [width * 0.86, 4, 4.5],
        ],
        [
          [-width * 0.52, 22.8, 3.9],
          [-width * 0.52, 22.8, 4.45],
          [width * 0.52, 22.8, 4.45],
          [width * 0.52, 22.8, 3.9],
        ],
      ],
      white,
    );
    for (const y of [7.2, 13.5, 18.7]) {
      const front = (height) => end - 1.2 + ((height - 4) / 18.8) * (4.45 - end + 1.2) + 0.012;
      const points = [
        [-0.12, y, front(y)],
        [0.12, y, front(y)],
        [0.12, y + 0.65, front(y + 0.65)],
        [-0.12, y + 0.65, front(y + 0.65)],
      ];
      quad(o, 'glass', points, normalFor(...points.slice(0, 3)), dark);
    }
  }
  for (let face = 0; face < 4; face++) {
    const o = transformed(out, (face * Math.PI) / 2);
    piercedFacade(o, {
      half: 4.12,
      y0: 23.65,
      y1: 32.9,
      z: 4.12,
      slot: 'plaster',
      color: white,
      holes: [
        { x: 0, y: 25.05, w: 0.6, h: 1.3, trim: 0, depth: 0.35 },
        { x: 0, y: 28.7, w: 0.45, h: 0.95, trim: 0, depth: 0.3 },
      ],
    });
    // Red-painted anchor plates and ventilation slots retain the upper body's characteristic rhythm.
    for (const y of [25.4, 28.55, 31.8])
      for (const x of [-2.65, 2.65]) {
        box(o, 'metal', [x - 0.115, y - 0.25, 4.13], [x + 0.115, y + 0.25, 4.18], red);
        for (const yy of [y - 0.16, y + 0.16])
          sphere(o, 'metal', [x, yy, 4.2], [0.035, 0.035, 0.025], dark, 10, 6);
      }
    for (const x of [-3.8, 3.8])
      beam(o, 'metal', [x, 23.6, 4.16], [x, 32.9, 4.16], 0.023, 0.025, [0.47, 0.47, 0.43]);
  }
  squareCornice(out, 32.9, 4.46, 'plaster', white);
  squareCornice(out, 33.36, 4.5, 'metal', red);
  for (let side = 0; side < 4; side++) {
    const o = transformed(out, (side * Math.PI) / 2);
    for (const y of [33.86, 34.35]) tube(o, 'metal', [-4.3, y, 4.3], [4.3, y, 4.3], 0.026, red, 8);
    for (let x = -4.2; x <= 4.2; x += 0.56)
      tube(o, 'metal', [x, 33.85, 4.3], [x, 34.35, 4.3], 0.02, red, 8);
  }
  box(out, 'plaster', [-1.6, 33.85, -2.8], [1.6, 34.55, -0.9], white);
  box(out, 'metal', [-1.68, 34.5, -2.87], [1.68, 34.62, -0.83], red);
  lantern(out, {
    bottom: 33.85,
    radius: 1.72,
    height: 2.02,
    color: red,
    roofHeight: 0.8,
    segments: 16,
  });
  tube(out, 'metal', [0, 36.95, 0], [0, 37.7, 0], 0.016, dark, 8);
  // South entry porch: projecting roof, jambs and visibly recessed door.
  const z = 11.0;
  box(out, 'plaster', [-1.3, 0, z - 0.4], [-0.72, 2.4, z + 1.5], white);
  box(out, 'plaster', [0.72, 0, z - 0.4], [1.3, 2.4, z + 1.5], white);
  box(out, 'plaster', [-1.3, 2.15, z - 0.4], [1.3, 2.4, z + 1.5], white);
  panel(out, 'wood', -0.72, 0.72, 0.1, 2.15, z + 0.2, [0.31, 0.22, 0.16]);
  loft(
    out,
    'metal',
    [
      [
        [-1.48, 2.38, z - 0.5],
        [-1.48, 2.38, z + 1.65],
        [1.48, 2.38, z + 1.65],
        [1.48, 2.38, z - 0.5],
      ],
      [
        [-0.06, 3.18, z - 0.5],
        [-0.06, 3.18, z + 1.65],
        [0.06, 3.18, z + 1.65],
        [0.06, 3.18, z - 0.5],
      ],
    ],
    red,
  );
  for (let i = 0; i < 4; i++)
    box(
      out,
      'concrete',
      [-1.32, 0, z + 1.35 + i * 0.3],
      [1.32, 0.48 - i * 0.11, z + 1.65 + i * 0.3],
      [0.53, 0.54, 0.5],
    );
}

export function buildKiipsaare(out) {
  // A photographic static pose, not a claim about the continuously changing present tilt.
  const tilt = (-2 * Math.PI) / 180,
    c = Math.cos(tilt),
    s = Math.sin(tilt);
  const p = ([x, y, z]) => [x * c + y * s, -x * s + y * c, z];
  const o = {
    addQuad(slot, ref, points, n, uv, color) {
      out.addQuad(slot, ref, points.map(p), p(n), uv, color);
    },
    addTriangle(slot, ref, points, n, uv, color) {
      out.addTriangle(slot, ref, points.map(p), p(n), uv, color);
    },
    addConvexPolygon(slot, ref, points, n, uv, color) {
      out.addConvexPolygon(slot, ref, points.map(p), p(n), uv, color);
    },
  };
  const segments = 80,
    radius = (y) => 1.21 - y * 0.0115;
  const bands = [
    0, 0.35, 0.6, 2.5, 3.2, 4.7, 5, 6.5, 7.2, 9, 11.8, 12.5, 13, 16, 17.2, 17.9, 19, 21.75, 22.65,
  ];
  const holes = [
    { y0: 0.6, y1: 2.5, theta: 0.31 },
    { y0: 6.5, y1: 7.2, theta: 0.115 },
    { y0: 11.8, y1: 12.5, theta: 0.115 },
    { y0: 17.2, y1: 17.9, theta: 0.115 },
  ].map((h) => ({
    ...h,
    theta: Math.ceil(h.theta / ((Math.PI * 2) / segments)) * ((Math.PI * 2) / segments),
  }));
  for (let j = 1; j < bands.length; j++) {
    const y0 = bands[j - 1],
      y1 = bands[j],
      ym = (y0 + y1) / 2,
      hole = holes.find((h) => ym > h.y0 && ym < h.y1);
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        b = ((i + 1) * Math.PI * 2) / segments;
      const signed = (((a + b) / 2 + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (hole && Math.abs(signed) < hole.theta) continue;
      const point = (y, theta, r = radius(y)) => [Math.sin(theta) * r, y, Math.cos(theta) * r];
      const pts = [point(y0, a), point(y0, b), point(y1, b), point(y1, a)];
      const normal = normalFor(...pts.slice(0, 3));
      if (normal[0] * Math.sin((a + b) / 2) + normal[2] * Math.cos((a + b) / 2) <= 0)
        throw new Error('Kiipsaare shaft surface must face radially outward');
      // Retained cream paint bands and weathered concrete are separate vertex tints on one graph.
      const painted = (ym > 5 && ym < 9) || (ym > 13 && ym < 16) || (ym > 19 && ym < 21.75);
      const variation = (((i * 13 + j * 7) % 11) / 11) * 0.045;
      const base = painted ? [0.83, 0.81, 0.7] : [0.58, 0.53, 0.43];
      quad(
        o,
        'concrete',
        pts,
        normal,
        base.map((v) => v + variation),
      );
    }
  }
  for (const h of holes) {
    const r = radius((h.y0 + h.y1) / 2),
      w = r * Math.sin(h.theta),
      z = r * Math.cos(h.theta);
    panel(o, 'glass', -w, w, h.y0, h.y1, z - 0.24, dark);
    for (const x of [-w, w])
      box(
        o,
        'concrete',
        [x - 0.045, h.y0, z - 0.26],
        [x + 0.045, h.y1, z + 0.025],
        [0.6, 0.56, 0.45],
      );
    for (const y of [h.y0, h.y1])
      box(
        o,
        'concrete',
        [-w - 0.04, y - 0.045, z - 0.26],
        [w + 0.04, y + 0.045, z + 0.025],
        [0.6, 0.56, 0.45],
      );
  }
  lathe(
    o,
    'concrete',
    [
      [0, 1.38],
      [0.25, 1.38],
      [0.55, 1.22],
    ],
    [0.48, 0.43, 0.34],
    80,
  );
  lathe(
    o,
    'concrete',
    [
      [4.7, 1.17],
      [4.8, 1.31],
      [4.95, 1.31],
      [5.04, 1.16],
    ],
    [0.72, 0.69, 0.59],
    80,
  );
  // Thin construction joints and small rusted anchor remnants; no invented intact lens.
  for (let y = 1; y < 22; y += 1.12) {
    if (holes.some((hole) => y >= hole.y0 && y <= hole.y1)) continue;
    lathe(
      o,
      'concrete',
      [
        [y, radius(y) + 0.007],
        [y + 0.027, radius(y) + 0.007],
      ],
      [0.48, 0.45, 0.37],
      80,
    );
  }
  lathe(
    o,
    'concrete',
    [
      [22.55, 0.94],
      [22.82, 1.72],
      [23.03, 1.72],
      [23.08, 1.52],
    ],
    [0.47, 0.48, 0.42],
    80,
  );
  railRing(o, 23.06, 1.61, 0.9, [0.64, 0.61, 0.51], 28);
  lantern(o, {
    bottom: 23.1,
    radius: 1.04,
    height: 1.7,
    color: [0.43, 0.32, 0.2],
    glass: false,
    roofHeight: 0.8,
    segments: 10,
  });
  tube(o, 'metal', [0, 25.7, 0], [0, 26, 0], 0.025, [0.49, 0.36, 0.22], 8);
  // Door lintel, two worn threshold slabs and a realistic empty interior behind the opening.
  box(o, 'concrete', [-0.48, 0.1, 0.8], [0.48, 0.27, 1.5], [0.58, 0.53, 0.43]);
  box(o, 'concrete', [-0.4, 0.27, 0.8], [0.4, 0.45, 1.4], [0.64, 0.6, 0.5]);
}

const commonLimitations = [
  'Original exterior reconstruction from documented main dimensions and inspected references. Individual moldings, sections, weathering, openings and fittings are photo-proportioned estimates.',
  'No interior visitor route, surveyed collision model, operating navigation-light simulation or exact optical assembly is included. Lantern glazing is a restrained opaque PBR approximation.',
  'Shared material references use metric UVs with portable vertex-color PBR fallback. Maximum-fidelity, lit shared-surface and geographic fit reviews remain separate pending gates.',
];
export const lighthouseStudies = [
  {
    id: 'N0637',
    key: 'tower_of_hercules',
    title: 'Tower of Hercules',
    wikidataId: 'Q245151',
    build: buildHercules,
    size: [32.4, 55, 35],
    visualBrief:
      'Granite Roman-core lighthouse with paired recessed facade niches, ascending perimeter band, heavy cornices, two octagonal upper stages, dark lantern and prominent offset stone lightning spine on a polygonal podium.',
    sourceFacts: {
      heightMeters: 55,
      squareCoreSideMeters: 11.75,
      visibleRomanBodyMeters: 34.38,
      platformWidthMeters: 32.4,
      basis:
        'A Coruña municipal Tower in Numbers page; 2024 original photo confirms current external geometry.',
    },
    referencePages: [
      'https://www.coruna.gal/the-tower/en/discover-the-tower/curiosities-of-the-tower?argIdioma=en',
      'https://whc.unesco.org/en/list/1312/',
      'https://www.ingenieria-civil.org/GOING/obra.php?id=120',
      'https://commons.wikimedia.org/wiki/File:Torre_de_Hercules,_A_Coruna,_Spain_06-2024.jpg',
    ],
    referenceRights:
      'Municipal/UNESCO references retain their own rights. Original2024 photo by Wolfgang Fricke, CC BY3.0, consulted only; no reference image is embedded or redistributed.',
    nativeAxes: {
      up: '+Y',
      front: '+Z',
      origin:
        'Ground contact beneath the polygonal platform. +X/+Z parallel the principal square shaft faces.',
    },
    geographicProposal: {
      anchor: [-8.406524144, 43.385941653],
      heading: -1.028578798746,
      elevationMode: 'terrain-contact',
      source: 'https://www.openstreetmap.org/way/255916025',
      status: 'preview-proposal',
      notes:
        'Exact-QID footprint supplies position and undirected face axes. Square symmetry leaves90-degree ambiguity for the front and offset service spine; facade facing remains to be reviewed. Published11.75m shaft versus12.725m mapped envelope retained separately; no forced XY scaling.',
    },
    limitations: [
      ...commonLimitations,
      'Total55m includes the modeled platform and lightning spine; the allocation among upper tiers and the spine position is photo-estimated. Museum interior, adjacent service structures, terrain, historic excavations and exact lighting installations are omitted.',
    ],
    qaCameras: [
      { name: 'near-facade', position: [16, 18, 27], lookAt: [0, 17, 0] },
      { name: 'near-lantern', position: [13, 48, 18], lookAt: [0, 45.5, 0] },
      { name: 'near-platform', position: [23, 7, 24], lookAt: [0, 2, 0] },
      { name: 'far-silhouette', position: [63, 37, 87], lookAt: [0, 27, 0] },
    ],
  },
  {
    id: 'N0641',
    key: 'kopu_lighthouse',
    title: 'Kõpu Lighthouse',
    wikidataId: 'Q1795607',
    build: buildKopu,
    size: [22.2, 37.7, 25.05],
    visualBrief:
      'Massive white square stone lighthouse with four broad sloping buttresses, tall square upper block, red anchor plates, roof balcony, red lantern cupola and south entrance porch.',
    sourceFacts: {
      heightMeters: 37.7,
      operatorCoordinate: [22.1996445, 58.9159645],
      form: 'White four-sided buttressed stone tower, balcony and red lantern room.',
      basis:
        'Estonian Transport Administration current navigation-aid668 record. Operator-submitted IALA2020 photographs and current record photograph inspected.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2684/',
      'https://heritage.iala.int/lighthouses/kopu-lighthouse/',
      'https://www.openstreetmap.org/way/249448393',
    ],
    referenceRights:
      'Operator and IALA-submitted photographs are visual research only, not redistributed. OSM footprint dimensions/axes ©OpenStreetMap contributors, ODbL1.0.',
    nativeAxes: {
      up: '+Y',
      front: '+Z (south entrance)',
      origin: 'Central shaft at local terrain contact. Buttress arms follow +X/-X and +Z/-Z.',
    },
    geographicProposal: {
      anchor: [22.1996445, 58.9159645],
      heading: -0.087025590763,
      elevationMode: 'terrain-contact',
      source: 'https://nma.transpordiamet.ee/aton/2684/',
      axisSource: 'https://www.openstreetmap.org/way/249448393',
      status: 'preview-proposal',
      notes:
        'Official coordinate preferred to OSM envelope center. Cached footprint rectangle heading0.69837257rad is diagonal to buttress edges; subtractπ/4 to align authored arms with those edges. Operator identifies southern entrance; residual asymmetry and exact porch fit need review.',
    },
    limitations: [
      ...commonLimitations,
      'Height37.7m is authoritative; core width, buttress profile stations, terrace details and porch sizes are photo/map reconstructions. The restored irregular shell and exposed boulders are simplified; annex buildings are omitted.',
    ],
    qaCameras: [
      { name: 'near-buttresses', position: [27, 12, 29], lookAt: [0, 11, 0] },
      { name: 'near-lantern', position: [12, 36, 16], lookAt: [0, 33.5, 0] },
      { name: 'near-entry', position: [8, 5, 21], lookAt: [0, 2, 10] },
      { name: 'far-silhouette', position: [49, 29, 62], lookAt: [0, 19, 0] },
    ],
  },
  {
    id: 'N0643',
    key: 'kiipsaare_lighthouse',
    title: 'Kiipsaare Lighthouse',
    wikidataId: 'Q498583',
    build: buildKiipsaare,
    size: [4.5, 26.1, 3.5],
    visualBrief:
      'Slender slightly leaning weathered concrete lighthouse with narrow recessed openings, worn paint courses, exposed threshold, circular gallery, empty lantern frame and rust-colored shallow cupola.',
    sourceFacts: {
      heightMeters: 26,
      currentSetting: 'In the sea on unstable ground; angle of inclination changes.',
      basis:
        'Estonian national tourism agency description and official project photographs. Cached Wikidata25m differs from the primary tourism26m; primary26m used.',
    },
    referencePages: [
      'https://visitestonia.com/en/kiipsaare-lighthouse',
      'https://transpordiamet.ee/tuletornid',
      'https://visitestonia.com/images/665550/kiipsaare-tuletorn-011-visit-estonia.jpg',
      'https://visitestonia.com/images/665551/kiipsaare-tuletorn-008-visit-estonia.jpg',
    ],
    referenceRights:
      'VisitEstonia photographs consulted as primary location references; images are not embedded, copied as textures or redistributed.',
    nativeAxes: {
      up: '+Y',
      front: '+Z doorway',
      origin:
        'Approximate visible base/waterline reference; photographic2-degree lean toward-X is baked into this static source.',
    },
    geographicProposal: {
      anchor: [21.84111111, 58.49583333],
      heading: 0,
      elevationMode: 'water-contact-review',
      source: 'https://www.wikidata.org/wiki/Q498583',
      status: 'draft-water-level',
      notes:
        'Reference coordinate only: no exact mapped footprint is cached. Cylindrical main silhouette is nearly rotationally symmetric; doorway azimuth and lean direction are unresolved. Do not ground this offshore structure to a land DEM or claim current tilt.',
    },
    limitations: [
      ...commonLimitations,
      'The2-degree lean is a representative photo-proportioned pose, not a current survey; the authority says it varies. Diameter, gallery, lantern framing and irregular paint bands are photo estimates. Water level, seabed/submerged footing and door azimuth remain unresolved. No intact lens or active beacon is invented.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [7, 24, 9], lookAt: [-0.8, 24, 0] },
      { name: 'near-shaft', position: [5, 12, 9], lookAt: [-0.4, 11, 0] },
      { name: 'near-entry', position: [4, 2.5, 6], lookAt: [-0.1, 1.4, 0] },
      { name: 'far-silhouette', position: [24, 15, 36], lookAt: [-0.4, 13, 0] },
    ],
  },
];
