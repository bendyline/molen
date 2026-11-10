import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const abbeySurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  trim: { slot: 'trim', graph: 'stone_limestone_raw' },
  masonry: { slot: 'foundation', graph: 'stone_ashlar' },
  tile: { slot: 'roof', graph: 'tile_flat' },
  copper: { slot: 'roof', graph: 'metal_copper' },
  glass: { slot: 'window', graph: 'window_punched' },
  metal: { slot: 'door', graph: 'metal_painted' },
};

const { base, eaves, passage } = layout;
const ref = 'palette:#ffffff';
const steps = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tints = {
  plaster: '#d8bc8b',
  church: '#dbbe90',
  trim: '#e3dac9',
  masonry: '#a69e8e',
  paving: '#bdb2a2',
  tile: '#a96b55',
  lightTile: '#b17660',
  darkTile: '#9f6654',
  copper: '#697e78',
  green: '#7e9189',
  glass: '#526267',
  metal: '#535b54',
  shade: '#56534d',
  gold: '#ad9564',
};
const color = Object.fromEntries(
  Object.entries(tints).map(([name, hex]) => [
    name,
    [...hex.slice(1).matchAll(/../g)].map(([pair]) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);

function face(out, surface, points, outward, tint = surface) {
  const normal = normalFor(points[0], points[1], points[2]);
  const positive = normal.reduce((n, v, i) => n + v * outward[i], 0) > 0;
  out.addConvexPolygon(
    surface,
    ref,
    positive ? points : points.toReversed(),
    positive ? normal : normal.map((v) => -v),
    (p) => [p[0], p[2]],
    color[tint],
  );
}
const block = (out, surface, x0, z0, x1, z1, y0, y1, tint = surface) =>
  box(out, surface, [x0, y0, z0], [x1, y1, z1], color[tint]);
const atY = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    normal: [dz, 0, -dx],
    at: (u, y, w = 0) => [a[0] + u * dx + w * dz, y, a[1] + u * dz - w * dx],
  };
}

function panel(out, f, surface, l, r, low, high, offset = 0, tint = surface) {
  if (r - l < 0.025 || high - low < 0.025) return;
  face(
    out,
    surface,
    [f.at(l, low, offset), f.at(r, low, offset), f.at(r, high, offset), f.at(l, high, offset)],
    f.normal,
    tint,
  );
}

function band(out, f, surface, l, r, y, h, depth, tint = surface) {
  panel(out, f, surface, l, r, y, y + h, depth, tint);
  for (const [e, sign] of [
    [y, -1],
    [y + h, 1],
  ]) {
    face(
      out,
      surface,
      [f.at(l, e), f.at(r, e), f.at(r, e, depth), f.at(l, e, depth)],
      [0, sign, 0],
      tint,
    );
  }
}

function window(out, f, u, y, w, h, detail) {
  const l = u - w / 2,
    r = u + w / 2;
  if (detail === 1) {
    panel(out, f, 'glass', l, r, y, y + h, 0.034);
    return;
  }
  panel(out, f, 'metal', l - 0.08, r + 0.08, y - 0.075, y + h + 0.075, 0.042, 'shade');
  panel(out, f, 'glass', l, r, y, y + h, 0.057);
  if (detail === 2) {
    panel(out, f, 'trim', l - 0.17, r + 0.17, y + h + 0.025, y + h + 0.175, 0.083);
    return;
  }
  band(out, f, 'trim', l - 0.16, r + 0.16, y - 0.16, 0.13, 0.17);
  band(out, f, 'trim', l - 0.17, r + 0.17, y + h + 0.04, 0.18, 0.13);
  for (const x of [l, r])
    panel(out, f, 'trim', x - 0.105, x + 0.105, y - 0.025, y + h + 0.04, 0.095);
  panel(out, f, 'metal', u - 0.029, u + 0.029, y + 0.06, y + h - 0.06, 0.074);
  if (detail >= 4)
    panel(out, f, 'metal', l + 0.035, r - 0.035, y + h * 0.55 - 0.031, y + h * 0.55 + 0.031, 0.076);
}

function archShape(u, y, r, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (Math.PI * i) / n;
    return [u - r * Math.cos(a), y + rise * Math.sin(a)];
  });
}

function surround(out, f, u, floor, spring, r, rise, depth, detail) {
  const n = detail >= 3 ? 12 : 6,
    inner = archShape(u, spring, r, rise, n),
    outer = archShape(u, spring, r + depth, rise + depth, n);
  for (let i = 0; i < n; i++)
    face(
      out,
      'trim',
      [inner[i], inner[i + 1], outer[i + 1], outer[i]].map((p) => f.at(...p, 0.14)),
      f.normal,
    );
  panel(out, f, 'trim', u - r - depth, u - r, floor, spring, 0.14);
  panel(out, f, 'trim', u + r, u + r + depth, floor, spring, 0.14);
}

function openedWall(out, f, u, floor, top, rise, r, spring, detail, surface = 'plaster') {
  panel(out, f, surface, 0, u - r, floor, top);
  panel(out, f, surface, u + r, f.length, floor, top);
  const shape = archShape(u, spring, r, rise, detail >= 2 ? 9 : 5);
  for (let i = 1; i < shape.length; i++) {
    const a = shape[i - 1],
      b = shape[i];
    face(
      out,
      surface,
      [a, b, [b[0], top], [a[0], top]].map((p) => f.at(...p)),
      f.normal,
    );
  }
  if (detail) surround(out, f, u, floor, spring, r, rise, 0.24, detail);
}

function hip(out, ring, floor, peak, surface, tint) {
  const lengths = ring.map((p, i) => Math.hypot(...p.map((v, k) => v - ring[(i + 1) % 4][k])));
  const i = lengths.indexOf(Math.max(...lengths));
  const [a, b, c, d] = Array.from({ length: 4 }, (_, k) => ring[(i + k) % 4]);
  const start = mix(a, d, 0.5),
    end = mix(b, c, 0.5);
  const inset = Math.min(
    0.29,
    (Math.min(lengths[(i + 1) % 4], lengths[(i + 3) % 4]) / lengths[i]) * 0.38,
  );
  const p = atY(mix(start, end, inset), peak),
    q = atY(mix(start, end, 1 - inset), peak);
  const [v, w, x, y] = [a, b, c, d].map((p) => atY(p, floor));
  for (const vertices of [
    [v, w, q, p],
    [w, x, q],
    [x, y, p, q],
    [y, v, p],
  ])
    face(out, surface, vertices, [0, 1, 0], tint);
}

function pieceRoof(out, p, surface, tint) {
  const point = ([x, z, y]) => [x, y, z];
  for (const indices of p.triangles)
    face(
      out,
      surface,
      indices.map((i) => point(p.vertices[i])),
      [0, 1, 0],
      tint,
    );
}

function outdoor(out, pieces, tint) {
  for (const p of pieces) {
    pieceRoof(out, p, 'masonry', tint);
    for (let i = 0; i < p.vertices.length; i++) {
      const [x, z, y] = p.vertices[i],
        [a, b, h] = p.vertices[(i + 1) % p.vertices.length],
        f = edge([x, z], [a, b]);
      face(
        out,
        'masonry',
        [
          [x, -21, z],
          [a, -21, b],
          [a, h, b],
          [x, y, z],
        ],
        f.normal,
      );
    }
  }
}

function wings(out, detail) {
  for (const ring of layout.walls)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        f = edge(a, b),
        l = f.length;
      panel(out, f, 'masonry', 0, l, -19, base);
      const midX = (a[0] + b[0]) / 2,
        target = 35.55;
      const crossing =
        midX > 71 &&
        midX < 90 &&
        Math.min(a[1], b[1]) < target - 2.25 &&
        Math.max(a[1], b[1]) > target + 2.25 &&
        Math.abs(f.normal[0]) > 0.85;
      const u = crossing ? ((target - a[1]) / (b[1] - a[1])) * l : 0;
      if (crossing) openedWall(out, f, u, base, eaves, 1.8, 2.23, 3.67, detail);
      else panel(out, f, 'plaster', 0, l, base, eaves);
      if (detail) {
        const belts = [
          [base + 0.1, 0.34],
          [6.12, 0.22],
          [10.21, 0.2],
          [14.94, 0.45],
        ];
        for (const [y, h] of belts) {
          if (crossing && y < 5.5) continue;
          if (detail >= 2 && l > 2) band(out, f, 'trim', 0, l, y, h, 0.19);
          else panel(out, f, 'trim', 0, l, y, y + h, 0.032);
        }
        if (l < 6.3) continue;
        const n = Math.max(1, Math.round(l / (detail === 1 ? 5.8 : 3.98))),
          pitch = l / n;
        for (let j = 0; j < n; j++) {
          const x = (j + 0.5) * pitch;
          if (crossing && Math.abs(x - u) < 2.94) {
            window(out, f, x, 10.8, 1.36, 2.72, detail);
            continue;
          }
          if (detail >= 2 || l > 28) window(out, f, x, 2.65, 1.1, 2.52, detail);
          window(out, f, x, 6.61, 1.29, 2.72, detail);
          window(out, f, x, 10.8, 1.36, 2.72, detail);
          if (detail >= 3 && j % 3 === 0 && l > 12)
            panel(out, f, 'trim', x - 1.35, x - 1.08, 6.36, 14.62, 0.088);
        }
      }
    }
  for (const [i, w] of layout.wings.entries()) {
    hip(out, w.ring, eaves - 0.018, w.roof, 'tile', ['tile', 'lightTile', 'darkTile'][i % 3]);
    if (detail < 3 || ![190, 198, 200, 201].includes(w.id)) continue;
    const a = w.ring[0],
      b = w.ring[1],
      f = edge(a, b),
      n = Math.floor(f.length / 9);
    if (n < 2) continue;
    for (let j = 1; j < n; j++) {
      const p = f.at((j * f.length) / n, eaves + 1.11, -2.05);
      block(out, 'trim', p[0] - 0.43, p[2] - 0.39, p[0] + 0.43, p[2] + 0.39, p[1], p[1] + 1.15);
      block(
        out,
        'tile',
        p[0] - 0.53,
        p[2] - 0.48,
        p[0] + 0.53,
        p[2] + 0.48,
        p[1] + 1.15,
        p[1] + 1.35,
      );
    }
  }
}

function revolve(out, x, z, profile, n, surface, tint = surface) {
  const at = (i, y, r) => [
    x + r * Math.cos((i * Math.PI * 2) / n),
    y,
    z + r * Math.sin((i * Math.PI * 2) / n),
  ];
  for (let k = 1; k < profile.length; k++) {
    const [y0, r0] = profile[k - 1],
      [y1, r1] = profile[k];
    for (let j = 0; j < n; j++) {
      const a = ((j + 0.5) * Math.PI * 2) / n;
      const points = [at(j, y0, r0), at(j + 1, y0, r0)];
      if (r1 > 0) points.push(at(j + 1, y1, r1), at(j, y1, r1));
      else points.push([x, y1, z]);
      face(out, surface, points, [Math.cos(a), 0, Math.sin(a)], tint);
    }
  }
}

function tube(out, ring, low, high, surface, tint = surface) {
  for (let i = 0; i < ring.length; i++) {
    const f = edge(ring[i], ring[(i + 1) % ring.length]);
    panel(out, f, surface, 0, f.length, low, high, 0, tint);
  }
}

function finial(out, x, z, y, detail) {
  if (!detail) return;
  block(out, 'metal', x - 0.075, z - 0.075, x + 0.075, z + 0.075, y, y + 1.35, 'gold');
  block(out, 'metal', x - 0.42, z - 0.06, x + 0.42, z + 0.06, y + 0.78, y + 0.93, 'gold');
}

function church(out, detail) {
  const piece = detail ? layout.churchRoof : layout.churchSkyline,
    ring = piece.vertices.map(([x, z]) => [x, z]);
  tube(out, ring, -19, base, 'masonry');
  tube(out, ring, base, 20.02, 'plaster', 'church');
  pieceRoof(out, piece, 'copper', 'green');
  for (const r of layout.churchRidges) hip(out, r.ring, 19.94, r.height, 'copper', 'green');
  for (let i = 0; i < ring.length; i++) {
    const f = edge(ring[i], ring[(i + 1) % ring.length]);
    if (f.length < 4.1 || !detail) continue;
    for (const y of [base + 0.2, 8.15, 13.9, 19.4]) {
      if (detail === 1) panel(out, f, 'trim', 0, f.length, y, y + 0.28, 0.045);
      else band(out, f, 'trim', 0, f.length, y, 0.28, 0.2);
    }
    for (let j = 0, n = Math.max(1, Math.round(f.length / 4.9)); j < n; j++) {
      const u = ((j + 0.5) * f.length) / n;
      window(out, f, u, 9.4, 1.36, 3.55, detail);
      if (detail >= 2) window(out, f, u, 15.1, 1.27, 2.9, detail);
    }
  }
  for (const {
    lower,
    center: [x, z],
  } of layout.towers) {
    tube(out, lower, 19.95, 30.1, 'plaster', 'church');
    if (detail >= 2) {
      for (let i = 0; i < lower.length; i++) {
        const f = edge(lower[i], lower[(i + 1) % lower.length]);
        const l = f.length;
        for (const y of [20.03, 22.15, 28.94, 29.76]) band(out, f, 'trim', 0, l, y, 0.24, 0.27);
        for (const u of [0.62, l - 0.62]) {
          band(out, f, 'trim', u - 0.33, u + 0.33, 22.39, 6.55, 0.17);
          band(out, f, 'trim', u - 0.47, u + 0.47, 28.56, 0.35, 0.29);
        }
        const u = l / 2;
        window(out, f, u, 23.18, 1.55, 3.96, detail);
        surround(out, f, u, 23.1, 26.1, 0.96, 1.03, 0.16, detail);
      }
    }
    const n = detail >= 3 ? 12 : detail ? 8 : 5;
    revolve(
      out,
      x,
      z,
      detail
        ? [
            [29.85, 3.36],
            [30.42, 3.74],
            [30.9, 3.54],
            [36.32, 3.22],
          ]
        : [
            [29.85, 3.63],
            [36.32, 3.22],
          ],
      n,
      'trim',
    );
    revolve(
      out,
      x,
      z,
      detail
        ? [
            [36.27, 3.2],
            [37.18, 3.78],
            [39.4, 3.27],
            [41.55, 1.66],
            [42.87, 0.82],
            [43.72, 0],
          ]
        : [
            [36.27, 3.2],
            [38.18, 3.78],
            [40.81, 2.29],
            [43.72, 0],
          ],
      n,
      'copper',
    );
    if (detail)
      for (const [[a, b], u] of [
        [
          [
            [x - 3.33, z - 1.55],
            [x - 3.33, z + 1.55],
          ],
          1.55,
        ],
        [
          [
            [x + 1.55, z - 3.33],
            [x - 1.55, z - 3.33],
          ],
          1.55,
        ],
      ]) {
        const f = edge(b, a);
        window(out, f, u, 31.45, 0.96, 3.45, detail);
      }
    finial(out, x, z, 43.65, detail);
  }
  const [x, z] = layout.dome,
    n = detail >= 3 ? 24 : detail ? 14 : 7,
    lantern = detail >= 3 ? 12 : detail ? 8 : 4;
  revolve(
    out,
    x,
    z,
    detail
      ? [
          [25.42, 8.39],
          [26.1, 8.87],
          [30.92, 8.14],
          [31.75, 8.53],
        ]
      : [
          [25.42, 8.5],
          [31.75, 8.53],
        ],
    n,
    'trim',
  );
  revolve(
    out,
    x,
    z,
    detail
      ? [
          [31.67, 8.52],
          [33.8, 8.81],
          [36.1, 7.88],
          [38.5, 6.02],
          [40.38, 3.93],
          [41.5, 2.2],
        ]
      : [
          [31.67, 8.52],
          [34.8, 8.46],
          [38.1, 6.39],
          [41.5, 2.2],
        ],
    n,
    'copper',
  );
  revolve(
    out,
    x,
    z,
    detail
      ? [
          [41.29, 1.72],
          [41.78, 2.0],
          [44.3, 1.52],
        ]
      : [
          [41.29, 1.72],
          [44.3, 1.52],
        ],
    lantern,
    'trim',
  );
  revolve(
    out,
    x,
    z,
    detail
      ? [
          [44.23, 1.62],
          [45.42, 1.22],
          [46.46, 0],
        ]
      : [
          [44.23, 1.62],
          [46.46, 0],
        ],
    lantern,
    'copper',
  );
  finial(out, x, z, 46.36, detail);
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        dx = Math.cos(a),
        dz = Math.sin(a),
        r = 8.71;
      const p = [x + r * dx, z + r * dz],
        f = edge([p[0] + dz * 0.78, p[1] - dx * 0.78], [p[0] - dz * 0.78, p[1] + dx * 0.78]);
      window(out, f, 0.78, 27.1, 0.94, 2.82, detail);
    }
  const front = edge([-119.1, 51.35], [-119.1, 41.5]),
    u = front.length / 2;
  panel(out, front, 'plaster', 0, front.length, base, 17.97, 0, 'church');
  face(
    out,
    'trim',
    [
      [0, 17.9],
      [front.length, 17.9],
      [u, 21.23],
    ].map((p) => front.at(...p, 0.18)),
    front.normal,
  );
  panel(out, front, 'metal', u - 1.31, u + 1.31, base, 6.42, 0.09, 'shade');
  if (detail) {
    surround(out, front, u, base, 5.1, 1.29, 1.35, 0.29, detail);
    for (const t of [1.13, front.length - 1.13])
      band(out, front, 'trim', t - 0.29, t + 0.29, base, 15.71, 0.27);
    band(out, front, 'trim', 0, front.length, 15.8, 0.46, 0.49);
    window(out, front, u, 10.24, 1.61, 3.6, detail);
  }
  block(out, 'masonry', -122.05, 43.5, -119.0, 49.4, 0.87, base, 'paving');
}

function gate(out, detail) {
  const [west, east] = passage.eastern,
    z = passage.centerZ,
    y = passage.outerFloor;
  const width = 12.3,
    r = 2.56,
    spring = y + 3.15,
    rise = 1.72,
    top = y + 6.05;
  for (const [start, end] of [
    [17.85, z - width / 2 + 0.1],
    [z + width / 2 - 0.1, 43.16],
  ]) {
    const x0 = 135.15,
      x1 = 138.7,
      y1 = y + 3.68;
    for (const [x, direction] of [
      [x0, -1],
      [x1, 1],
    ])
      face(
        out,
        'masonry',
        [
          [x, -18, start],
          [x, -18, end],
          [x, y1, end],
          [x, y1, start],
        ],
        [direction, 0, 0],
      );
    face(
      out,
      'masonry',
      [
        [x0, y1, start],
        [x1, y1, start],
        [x1, y1, end],
        [x0, y1, end],
      ],
      [0, 1, 0],
      'paving',
    );
  }
  const a = edge([west, z + width / 2], [west, z - width / 2]),
    b = edge([east, z - width / 2], [east, z + width / 2]);
  for (const f of [a, b])
    openedWall(out, f, width / 2, -5, top, rise, r, spring, detail, 'masonry');
  for (const side of [-1, 1]) {
    const k = z + (side * width) / 2;
    face(
      out,
      'masonry',
      [
        [west, -5, k],
        [east, -5, k],
        [east, top, k],
        [west, top, k],
      ],
      [0, 0, side],
    );
    const zz = z + side * r;
    face(
      out,
      'masonry',
      [
        [west, y, zz],
        [east, y, zz],
        [east, spring, zz],
        [west, spring, zz],
      ],
      [0, 0, -side],
    );
  }
  const shape = archShape(z, spring, r, rise, detail >= 2 ? 9 : 5);
  for (let i = 1; i < shape.length; i++) {
    const [u, h] = shape[i - 1],
      [v, g] = shape[i];
    face(
      out,
      'trim',
      [
        [west, h, u],
        [east, h, u],
        [east, g, v],
        [west, g, v],
      ],
      [0, -1, 0],
    );
  }
  hip(
    out,
    [
      [west - 0.32, z - width / 2 - 0.25],
      [east + 0.32, z - width / 2 - 0.25],
      [east + 0.32, z + width / 2 + 0.25],
      [west - 0.32, z + width / 2 + 0.25],
    ],
    top - 0.014,
    top + 2.13,
    'tile',
    'darkTile',
  );
}

function courtyardDetails(out, detail) {
  if (detail < 2) return;
  revolve(
    out,
    25.1,
    35.9,
    [
      [base - 0.3, 2.23],
      [base + 0.08, 2.23],
      [base + 0.18, 2.02],
      [base + 0.62, 1.8],
      [base + 0.77, 1.67],
    ],
    detail >= 3 ? 16 : 8,
    'masonry',
    'paving',
  );
  revolve(
    out,
    25.1,
    35.9,
    [
      [base + 0.66, 0.53],
      [base + 1.13, 0.53],
      [base + 1.56, 0.29],
      [base + 2.18, 0.13],
      [base + 2.36, 0],
    ],
    detail >= 3 ? 12 : 8,
    'trim',
  );
}

export function buildAbbeyLevel(out, level) {
  const detail = steps[level];
  if (detail === undefined) throw Error('Unknown Melk Abbey detail level ' + level);
  wings(out, detail);
  church(out, detail);
  outdoor(out, layout.terrace, 'paving');
  if (detail >= 2) {
    for (const { vertices } of layout.terrace) {
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i],
          b = vertices[(i + 1) % vertices.length];
        if (a[0] > -147 || b[0] > -147) continue;
        const f = edge(a, b);
        band(out, f, 'trim', 0, f.length, base - 0.08, 0.91, 0.3);
      }
    }
  }
  outdoor(out, layout.bastions, 'paving');
  for (const { a, b, top } of layout.seat) {
    const f = edge(a, b);
    panel(out, f, 'masonry', 0, f.length, -21, top);
  }
  gate(out, detail);
  courtyardDetails(out, detail);
}

export const buildAbbeySkyline = (out) => buildAbbeyLevel(out, 'skyline');
export const buildAbbeyDistrict = (out) => buildAbbeyLevel(out, 'district');
export const buildAbbeyStreet = (out) => buildAbbeyLevel(out, 'street');
export const buildAbbeyCloseup = (out) => buildAbbeyLevel(out, 'closeup');
