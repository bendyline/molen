/** Browser derivatives of Sapphire. The detailed instanced master recipe is preserved. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';

const X = 24.416,
  Z = 13.29,
  base = 24.3,
  h = 4.3;
const blue = [0.26, 0.43, 0.49],
  silver = [0.55, 0.6, 0.61];
const grey = [0.48, 0.49, 0.47],
  pale = [0.82, 0.83, 0.8],
  timber = [0.6, 0.43, 0.24];
const face = (o, s, p, c) => {
  // Roof overhang returns to one bottom corner beyond the ground footprint.
  p = p.filter((v, i) => !i || Math.hypot(...v.map((n, k) => n - p[i - 1][k])) > 1e-6);
  for (let i = 1; i + 1 < p.length; i++) {
    const tri = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      s,
      null,
      tri,
      normalFor(...tri),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c,
    );
  }
};

function transformed(out, translation = [0, 0, 0], angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

function tapered(out) {
  const point = ([x, y, z]) => [
    x * (1 - (0.8 * Math.min(y, 239.1)) / (239.1 * X)),
    y,
    z * (1 - (0.65 * Math.min(y, 239.1)) / (239.1 * Z)),
  ];
  function polygon(s, r, p, _n, _uv, c) {
    p = p.map(point);
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]];
      out.addTriangle(
        s,
        r,
        tri,
        normalFor(...tri),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        c,
      );
    }
  }
  return { addQuad: polygon, addTriangle: polygon, addConvexPolygon: polygon };
}

/** One glass face plus one shared frame grid, rather than four boxes per pane. */
function curtain(o, half, z, y, height, bays, clear, detail) {
  const w = (2 * half) / bays;
  const rows =
    detail === 2
      ? [
          [0.24, 2.8],
          [2.85, height - 0.08],
        ]
      : [[0.24, height - 0.08]];
  for (let j = 0; j < bays; j++)
    for (const [a, b] of rows)
      face(
        o,
        clear ? 'clear_glass' : 'glass',
        [
          [-half + j * w + 0.035, y + a, z],
          [-half + (j + 1) * w - 0.035, y + a, z],
          [-half + (j + 1) * w - 0.035, y + b, z],
          [-half + j * w + 0.035, y + b, z],
        ],
        blue,
      );
  // Opaque backing is a complete exterior face for far levels only.
  if (!clear)
    face(
      o,
      'metal',
      [
        [-half, y, z - 0.03],
        [half, y, z - 0.03],
        [half, y + height, z - 0.03],
        [-half, y + height, z - 0.03],
      ],
      silver,
    );
  for (let j = 0; j <= bays; j++) {
    const x = -half + j * w;
    face(
      o,
      'metal',
      [
        [x - 0.035, y, z + 0.04],
        [x + 0.035, y, z + 0.04],
        [x + 0.035, y + height, z + 0.04],
        [x - 0.035, y + height, z + 0.04],
      ],
      silver,
    );
  }
  for (const [a, b] of [[0, 0.24], [height - 0.08, height], ...(detail === 2 ? [[2.8, 2.85]] : [])])
    face(
      o,
      'metal',
      [
        [-half, y + a, z + 0.055],
        [half, y + a, z + 0.055],
        [half, y + b, z + 0.055],
        [-half, y + b, z + 0.055],
      ],
      silver,
    );
}

function rail(o, x0, x1, y, z, detail) {
  face(
    o,
    'clear_glass',
    [
      [x0, y, z],
      [x1, y, z],
      [x1, y + 1.03, z],
      [x0, y + 1.03, z],
    ],
    [0.48, 0.61, 0.59],
  );
  // Rectangular trim makes the handrail a few faces at medium-fi scale.
  if (detail === 2) box(o, 'metal', [x0, y + 1.025, z - 0.025], [x1, y + 1.075, z + 0.025], silver);
  else
    face(
      o,
      'metal',
      [
        [x0, y + 1.025, z + 0.025],
        [x1, y + 1.025, z + 0.025],
        [x1, y + 1.075, z + 0.025],
        [x0, y + 1.075, z + 0.025],
      ],
      silver,
    );
  if (detail === 2)
    for (let x = x0; x <= x1; x += 6)
      box(o, 'metal', [x - 0.025, y, z - 0.025], [x + 0.025, y + 1.05, z + 0.025], silver);
}

function plant(o, x, y, z, detail) {
  if (detail === 2) tube(o, 'wood', [x, y, z], [x + 0.1, y + 1.45, z], 0.05, timber, 4);
  // Faceted foliage volumes retain garden depth without individual leaf geometry.
  const sides = detail === 2 ? 6 : 4;
  for (let j = 0; j < sides; j++) {
    const a = (2 * Math.PI * j) / sides,
      b = (2 * Math.PI * (j + 1)) / sides;
    const p = [x + 0.7 * Math.cos(a), y + 1.25, z + 0.7 * Math.sin(a)],
      q = [x + 0.7 * Math.cos(b), y + 1.25, z + 0.7 * Math.sin(b)];
    const color = [0.14 + 0.01 * (j % 3), 0.24 + 0.01 * (j % 4), 0.085];
    face(o, 'foliage', [p, q, [x, y + 2.05, z]], color);
    face(o, 'foliage', [q, p, [x, y + 0.7, z]], color);
  }
}

function gardens(out, detail) {
  // Both skins and the galleries taper together; the old untapered repeated interiors
  // protruded slightly through the upper weather shell.
  const o = tapered(out),
    inner = X - 1.05;
  for (let group = 0; group < 16; group++) {
    const social = [3, 7, 11].includes(group),
      start = base + 3 * h * group;
    for (let row = 0; row < 3; row++) {
      const y = start + row * h;
      box(o, 'concrete', [-inner, y, -8.65], [inner, y + 0.23, 8.65], pale);
      if (detail === 2) box(o, 'concrete', [-4, y, -5], [4, y + h, 5], [0.62, 0.63, 0.6]);
      else if (!group && !row) box(o, 'concrete', [-4, y, -5], [4, 230.7, 5], [0.62, 0.63, 0.6]);
      for (const sign of [-1, 1]) {
        const wall = transformed(o, [0, 0, 0], sign === 1 ? 0 : Math.PI);
        curtain(wall, X, Z, y, h, detail === 2 ? 30 : 6, true, detail);
        if (row === 0) box(wall, 'concrete', [-inner, y, 8.65], [inner, y + 0.23, Z - 0.85], grey);
        else {
          box(wall, 'concrete', [-inner, y, 8.65], [inner, y + 0.23, 10.65], pale);
          if (detail === 2)
            box(wall, 'wood', [-inner, y - 0.32, 10.65], [inner, y + 0.1, 10.83], timber);
          else
            face(
              wall,
              'wood',
              [
                [-inner, y - 0.32, 10.83],
                [inner, y - 0.32, 10.83],
                [inner, y + 0.1, 10.83],
                [-inner, y + 0.1, 10.83],
              ],
              timber,
            );
          rail(wall, -inner + 0.1, inner - 0.1, y + 0.23, 10.8, detail);
        }
        // A closed interior shell remains behind the transparent weather skin.
        if (!social || row !== 1) curtain(wall, inner, 8.65, y, h, detail === 2 ? 7 : 1, false, 1);
        else {
          for (let k = 0; k < (detail === 2 ? 12 : 6); k++) {
            const pitch = detail === 2 ? 0.22 : 0.44;
            box(
              wall,
              'metal',
              [-X, y + 0.3 + k * pitch, Z - 0.3],
              [X, y + 0.38 + k * pitch, Z - 0.02],
              [0.09, 0.125, 0.135],
            );
          }
        }
        if (row === 0)
          for (let j = 0; j < (detail === 2 ? 8 : 4); j++) {
            const x = detail === 2 ? -20 + j * 5.65 : -17 + j * 11.3;
            if (detail === 2)
              box(wall, 'concrete', [x - 1.4, y + 0.24, 11.2], [x + 1.4, y + 0.68, 12.7], grey);
            else
              face(
                wall,
                'concrete',
                [
                  [x - 1.4, y + 0.68, 11.2],
                  [x - 1.4, y + 0.68, 12.7],
                  [x + 1.4, y + 0.68, 12.7],
                  [x + 1.4, y + 0.68, 11.2],
                ],
                grey,
              );
            plant(wall, x, y + 0.7, 11.95, detail);
          }
      }
      for (const sign of [-1, 1]) {
        const wall = transformed(o, [sign * X, 0, 0], (sign * Math.PI) / 2);
        curtain(wall, Z, 0, y, h, detail === 2 ? 12 : 3, true, 1);
        // Inner end wall closes the apartment volume, with independent glass strips.
        curtain(wall, Z - 1.1, -1.05, y, h, detail === 2 ? 3 : 1, false, 1);
      }
    }
  }
}

function blade(o) {
  const out = tapered(o);
  box(out, 'metal', [X - 0.5, 0, -8.24], [X + 0.38, 239.4, 8.2], [0.34, 0.37, 0.37]);
  for (const z of [-9.3, 8.5])
    box(out, 'glass', [X - 0.01, 0.1, z], [X + 0.01, 239.3, z + 0.75], blue);
}

/** Curve endpoints fitted to fresh Q166882 mall outline. Roof overhang is approximate. */
function profile(front, detail) {
  const points = [],
    reach = front ? 22 : 12,
    rise = front ? 20 : 16;
  const curve = detail === 2 ? 12 : detail === 1 ? 8 : 5,
    run = detail === 2 ? 8 : detail === 1 ? 4 : 2;
  for (let k = 0; k <= curve; k++) {
    const a = (Math.PI * k) / (2 * curve);
    points.push([Z + reach * (1 - Math.cos(a)), 10 + rise * (1 - Math.sin(a))]);
  }
  const start = Z + reach,
    end = front ? 93.5 : 51.3;
  for (let k = 1; k <= run; k++) {
    const t = k / run;
    points.push([start + (end - start) * t, 10 + (front ? 4.8 : 1.6) * t * t]);
  }
  return points;
}

function retail(o, detail, sky = false) {
  // Mall ground footprint is ~48.4 m wide and extends east 87.5 / west 47.3 m.
  box(o, 'concrete', [-24.4, 0, -87.5], [24.4, 0.32, 47.3], grey);
  for (const front of [false, true]) {
    const wall = transformed(o, [0, 0, 0], front ? Math.PI : 0),
      p = profile(front, detail),
      end = front ? 87.5 : 47.3;
    const halfAt = (z) => X + (31 - X) * Math.min(1, (z - Z) / 16),
      bays = detail === 2 ? 18 : detail === 1 ? 5 : 1;
    for (let k = 0; k + 1 < p.length; k++) {
      const [z, y] = p[k],
        [zn, yn] = p[k + 1],
        a = halfAt(z),
        b = halfAt(zn);
      face(
        wall,
        sky ? 'glass' : detail === 0 ? 'glass' : 'clear_glass',
        [
          [-a, y, z],
          [-b, yn, zn],
          [b, yn, zn],
          [a, y, z],
        ],
        blue,
      );
      for (const sign of [-1, 1]) {
        let points = [
          [sign * 24.4, 0.32, Math.min(z, end)],
          [sign * 24.4, 0.32, Math.min(zn, end)],
          [sign * b, yn, zn],
          [sign * a, y, z],
        ];
        if (sign < 0) points = points.toReversed();
        face(wall, detail === 0 ? 'glass' : 'clear_glass', points, blue);
        if (detail > 0)
          beam(wall, 'metal', [sign * a, y, z], [sign * b, yn, zn], 0.19, 0.27, silver);
      }
      if (detail > 0) {
        for (let j = 0; j <= bays; j++)
          beam(
            wall,
            'metal',
            [-a + (2 * a * j) / bays, y, z],
            [-b + (2 * b * j) / bays, yn, zn],
            0.08,
            0.11,
            silver,
          );
        if (k % 3 === 0) beam(wall, 'metal', [-a, y, z], [a, y, z], 0.09, 0.12, silver);
      }
    }
    const [ze, ye] = p.at(-1);
    face(
      wall,
      detail === 0 ? 'glass' : 'clear_glass',
      [
        [-24.4, 0.32, end],
        [24.4, 0.32, end],
        [31, ye, ze],
        [-31, ye, ze],
      ],
      blue,
    );
    if (detail > 0) {
      for (let j = 0; j <= bays; j++)
        beam(
          wall,
          'metal',
          [-24.4 + (48.8 * j) / bays, 0.32, end],
          [-31 + (62 * j) / bays, ye, ze],
          0.1,
          0.15,
          silver,
        );
      for (let row = 1; row <= 2; row++) {
        const y = row * 4.3;
        for (const sign of [-1, 1]) {
          const x0 = sign < 0 ? -24 : 17,
            x1 = sign < 0 ? -17 : 24;
          box(wall, 'concrete', [x0, y, Z - 2], [x1, y + 0.25, end - 5], pale);
          box(wall, 'wood', [x0, y - 0.4, end - 5], [x1, y + 0.2, end - 4.85], timber);
          rail(wall, x0, x1, y + 0.25, end - 5.15, detail);
        }
      }
      for (let x = -20; x <= 20; x += 10)
        for (const z of [Z + 5, end - 12]) {
          const k = p.findIndex((q) => q[0] >= z),
            a = p[k - 1],
            b = p[k];
          const y = a[1] + ((b[1] - a[1]) * (z - a[0])) / (b[0] - a[0]);
          tube(wall, 'concrete', [x, 0.32, z], [x, y - 0.15, z], 0.22, pale, detail === 2 ? 8 : 4);
        }
    }
  }
  // Ground-level east entrance leaves remain a working reconstruction, not a measured count.
  if (detail > 0) {
    const wall = transformed(o, [0, 0, -87.54], Math.PI);
    for (let j = 0; j < 8; j++) {
      const x = -5.2 + j * 1.3;
      curtain(transformed(wall, [x + 0.65, 0, 0]), 0.65, 0, 0.32, 2.78, 1, true, 1);
      if (detail === 2)
        tube(wall, 'metal', [x + 1.1, 1.05, 0.08], [x + 1.1, 1.95, 0.08], 0.023, silver, 4);
    }
  }
  for (let row = 0; row < 5; row++) {
    const y = 0.32 + 4.8 * row;
    box(o, 'concrete', [-X + 1, y, -Z + 1], [X - 1, y + 0.22, Z - 1], pale);
    for (const sign of [-1, 1]) {
      const wall = transformed(o, [0, 0, 0], sign === 1 ? 0 : Math.PI);
      curtain(
        wall,
        X - 1,
        Z - 1,
        y,
        4.8,
        detail === 2 ? 14 : detail === 1 ? 7 : 1,
        detail > 0 && row === 0,
        1,
      );
      curtain(
        transformed(o, [sign * X, 0, 0], (sign * Math.PI) / 2),
        Z,
        0,
        y,
        4.8,
        detail === 2 ? 6 : detail === 1 ? 3 : 1,
        detail > 0,
        1,
      );
    }
  }
}

function roof(o, detail) {
  const out = tapered(o);
  for (let row = 0; row < 2; row++) {
    const y = 230.7 + 4.2 * row;
    box(out, 'concrete', [-X, y, -Z], [X, y + 0.22, Z], pale);
    for (const sign of [-1, 1]) {
      curtain(
        transformed(out, [0, 0, 0], sign === 1 ? 0 : Math.PI),
        X,
        Z,
        y,
        4.2,
        detail === 2 ? 30 : detail === 1 ? 15 : 1,
        detail > 0,
        1,
      );
      curtain(
        transformed(out, [sign * X, 0, 0], (sign * Math.PI) / 2),
        Z,
        0,
        y,
        4.2,
        detail === 2 ? 12 : detail === 1 ? 6 : 1,
        detail > 0,
        1,
      );
    }
  }
  box(out, 'metal', [-X, 239.1, -Z], [X, 239.35, Z], silver);
  box(out, 'concrete', [-6, 239.35, -5], [6, 242.2, 5], grey);
  // Closed tapered mast follows the 261 m tip with a small polygonal section.
  const sides = detail === 2 ? 8 : 4;
  for (let j = 0; j < sides; j++) {
    const a = (j * 2 * Math.PI) / sides,
      b = ((j + 1) * 2 * Math.PI) / sides;
    face(
      o,
      'metal',
      [
        [0.345 * Math.cos(a), 242.2, 0.345 * Math.sin(a)],
        [0.345 * Math.cos(b), 242.2, 0.345 * Math.sin(b)],
        [0.025 * Math.cos(b), 261, 0.025 * Math.sin(b)],
        [0.025 * Math.cos(a), 261, 0.025 * Math.sin(a)],
      ],
      silver,
    );
  }
  o.addConvexPolygon(
    'metal',
    null,
    Array.from({ length: sides }, (_, j) => [
      0.025 * Math.cos((-2 * Math.PI * j) / sides),
      261,
      0.025 * Math.sin((-2 * Math.PI * j) / sides),
    ]),
    [0, 1, 0],
    () => [0, 0],
    silver,
  );
}

function far(o, skyline) {
  const out = tapered(o);
  const rows = skyline ? 16 : 48,
    step = skyline ? 3 * h : h;
  for (let row = 0; row < rows; row++) {
    const y = base + row * step;
    for (const sign of [-1, 1]) {
      const wall = transformed(out, [0, 0, 0], sign === 1 ? 0 : Math.PI);
      // Far skins are opaque area colors; thin frames and glass transparency are omitted.
      face(
        wall,
        'glass',
        [
          [-X, y, Z],
          [X, y, Z],
          [X, y + step - 0.3, Z],
          [-X, y + step - 0.3, Z],
        ],
        blue,
      );
      face(
        wall,
        'metal',
        [
          [-X, y + step - 0.3, Z],
          [X, y + step - 0.3, Z],
          [X, y + step, Z],
          [-X, y + step, Z],
        ],
        silver,
      );
      const end = transformed(out, [sign * X, 0, 0], (sign * Math.PI) / 2);
      face(
        end,
        'glass',
        [
          [-Z, y, 0],
          [Z, y, 0],
          [Z, y + step, 0],
          [-Z, y + step, 0],
        ],
        blue,
      );
    }
  }
  blade(o);
  retail(o, 0, skyline);
  roof(o, 0);
}

export function buildSapphireSkyline(o) {
  const means = {
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  };
  const flat = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    flat[method] = (s, _r, p, n, u, c) =>
      o[method](
        'wall',
        'palette:#ffffff',
        p,
        n,
        u,
        c.map((v, i) => v * (means[s]?.[i] ?? 1)),
      );
  far(flat, true);
}
export function buildSapphireDistrict(o) {
  far(o, false);
}
export function buildSapphireStreet(o) {
  gardens(o, 1);
  blade(o);
  retail(o, 1);
  roof(o, 1);
}
export function buildSapphireCloseup(o) {
  gardens(o, 2);
  blade(o);
  retail(o, 2);
  roof(o, 2);
}
