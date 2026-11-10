import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const { base, eaves, footprint, controls } = layout;
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export const museumSurfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone' },
  trim: { slot: 'trim', graph: 'stone_limestone_raw' },
  stone: { slot: 'foundation', graph: 'stone_granite' },
  concrete: { slot: 'wall', graph: 'concrete_panel' },
  metal: { slot: 'trim', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  roof: { slot: 'roof', graph: 'membrane' },
  copper: { slot: 'roof', graph: 'metal_copper' },
};
const tints = {
  limestone: '#d2c9b8',
  trim: '#e2dbc8',
  stone: '#b8b2a8',
  concrete: '#cfd4d1',
  metal: '#4b5659',
  glass: '#567b7b',
  darkGlass: '#516568',
  roof: '#747e89',
  paleRoof: '#c2c2b8',
  copper: '#8c9b8e',
  membrane: '#a5a9a5',
  warmGlass: '#57534a',
  oxidized: '#899c8b',
  banner: '#7f3b41',
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
const flat = 'palette:#ffffff';

function face(out, surface, points, outward, tint = surface) {
  const normal = normalFor(points[0], points[1], points[2]);
  const forward = normal.reduce((v, c, i) => v + c * outward[i], 0) > 0;
  out.addConvexPolygon(
    surface,
    flat,
    forward ? points : points.toReversed(),
    forward ? normal : normal.map((v) => -v),
    (p) => [p[0], p[2]],
    color[tint],
  );
}
const block = (out, surface, x0, z0, x1, z1, y0, y1, tint = surface) =>
  box(out, surface, [x0, y0, z0], [x1, y1, z1], color[tint]);

function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    normal: [dz, 0, -dx],
    at: (u, y, w) => [a[0] + u * dx + w * dz, y, a[1] + u * dz - w * dx],
  };
}

function panel(out, f, surface, left, right, low, high, offset = 0, tint = surface) {
  face(
    out,
    surface,
    [
      [left, low],
      [right, low],
      [right, high],
      [left, high],
    ].map((p) => f.at(...p, offset)),
    f.normal,
    tint,
  );
}

function band(out, f, surface, left, right, low, high, depth, tint = surface) {
  panel(out, f, surface, left, right, low, high, depth, tint);
  for (const [y, n] of [
    [low, -1],
    [high, 1],
  ]) {
    face(
      out,
      surface,
      [f.at(left, y, 0), f.at(right, y, 0), f.at(right, y, depth), f.at(left, y, depth)],
      [0, n, 0],
      tint,
    );
  }
}

function roofBase(out) {
  const p = [...footprint.outer, ...footprint.holes.flat()];
  for (const t of footprint.triangles)
    face(
      out,
      'roof',
      t.map((i) => [p[i][0], eaves, p[i][1]]),
      [0, 1, 0],
      'membrane',
    );
}

function window(out, f, x, y, w, h, detail, tint) {
  const l = x - w / 2,
    r = x + w / 2;
  if (detail === 1) {
    panel(out, f, 'glass', l, r, y, y + h, 0.035, tint);
    return;
  }
  panel(out, f, 'metal', l - 0.09, r + 0.09, y - 0.08, y + h + 0.08, 0.048);
  panel(out, f, 'glass', l, r, y, y + h, 0.07, tint);
  if (detail === 2) {
    panel(out, f, 'trim', l - 0.21, r + 0.21, y + h + 0.05, y + h + 0.22, 0.1);
    return;
  }
  band(out, f, 'trim', l - 0.2, r + 0.2, y - 0.17, y - 0.06, 0.22);
  band(out, f, 'trim', l - 0.2, r + 0.2, y + h + 0.06, y + h + 0.25, 0.19);
  panel(out, f, 'trim', l - 0.19, l - 0.06, y - 0.02, y + h + 0.07, 0.105);
  panel(out, f, 'trim', r + 0.06, r + 0.19, y - 0.02, y + h + 0.07, 0.105);
  panel(out, f, 'metal', x - 0.035, x + 0.035, y + 0.06, y + h - 0.05, 0.09);
  if (detail === 4)
    panel(out, f, 'metal', l + 0.06, r - 0.06, y + h * 0.56 - 0.036, y + h * 0.56 + 0.036, 0.091);
}

function shell(out, detail) {
  for (const [i, ring] of [footprint.outer, ...footprint.holes].entries()) {
    for (const [j, a] of ring.entries()) {
      const b = ring[(j + 1) % ring.length],
        f = edge(a, b),
        length = f.length;
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      const modern = i === 0 && ((x > 47 && z < 18) || (x < -77 && z < 13));
      const fenway = z < -70 && x > -52 && x < 44;
      panel(out, f, 'stone', 0, length, -1, base, 0);
      panel(out, f, modern ? 'concrete' : 'limestone', 0, length, base, eaves, 0);
      if (modern) {
        if (detail && x > 47) {
          for (const y of [4.5, 9.3, 13.8]) panel(out, f, 'metal', 0, length, y, y + 0.14, 0.034);
          for (const y of [5.0, 9.85])
            for (let x = 1.2; x + 1.9 < length; x += 3.55) {
              if (Math.round((x + y * 1.2) / 3.55) % 5 === 1) continue;
              panel(out, f, 'glass', x, x + 2.0, y, y + 2.55, 0.051, 'darkGlass');
            }
        }
        continue;
      }
      if (detail === 0) {
        if (length > 13) panel(out, f, 'trim', 0, length, eaves - 0.36, eaves, 0.035);
        continue;
      }
      const bands = [
        [base + 0.2, base + 0.48, 0.16],
        [5.92, 6.16, 0.15],
        [13.33, 13.58, 0.18],
        [14.26, 14.63, 0.35],
      ];
      for (const [low, high, depth] of bands) {
        if (detail >= 2 && length > 3) band(out, f, 'trim', 0, length, low, high, depth);
        else panel(out, f, 'trim', 0, length, low, high, 0.045);
      }
      if (length < 7 || fenway) continue;
      const n = Math.max(1, Math.round((length - 1.1) / 3.75)),
        pitch = length / n;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) * pitch;
        window(out, f, u, 2.3, 1.28, 2.42, detail, 'warmGlass');
        window(out, f, u, 7.14, 1.51, 3.6, detail, 'warmGlass');
        if (detail >= 3 && length > 12 && k > 0)
          panel(out, f, 'trim', u - pitch / 2 - 0.14, u - pitch / 2 + 0.14, 6.22, 12.78, 0.092);
      }
    }
  }
  roofBase(out);
}

function hip(out, [x0, z0, x1, z1], floor, height, ridge, surface, tint) {
  const eave = [
    [x0, floor, z1],
    [x1, floor, z1],
    [x1, floor, z0],
    [x0, floor, z0],
  ];
  const shoulder = Math.min(x1 - x0, z1 - z0) * 0.28;
  const crown =
    ridge === 'x'
      ? [
          [x0 + shoulder, height, (z0 + z1) / 2],
          [x1 - shoulder, height, (z0 + z1) / 2],
        ]
      : [
          [(x0 + x1) / 2, height, z1 - shoulder],
          [(x0 + x1) / 2, height, z0 + shoulder],
        ];
  const ends = ridge === 'x' ? [[0, 1], [1], [1, 0], [0]] : [[0], [0, 1], [1], [1, 0]];
  for (let i = 0; i < 4; i++)
    face(
      out,
      surface,
      [eave[i], eave[(i + 1) % 4], ...ends[i].toReversed().map((j) => crown[j])],
      [0, 1, 0],
      tint,
    );
}

function parapet(out, [x0, z0, x1, z1], y, width, height, tint = 'trim') {
  block(out, 'trim', x0, z0, x1, z0 + width, y, y + height, tint);
  block(out, 'trim', x0, z1 - width, x1, z1, y, y + height, tint);
  block(out, 'trim', x0, z0 + width, x0 + width, z1 - width, y, y + height, tint);
  block(out, 'trim', x1 - width, z0 + width, x1, z1 - width, y, y + height, tint);
}

function historicRoofs(out, detail) {
  for (const r of controls.historicRanges) {
    const [a, b, c, d] = r.box;
    if (r.name.endsWith('pavilion')) {
      block(out, 'roof', a, b, c, d, eaves - 0.025, eaves + 0.22);
      hip(
        out,
        [a + 1.8, b + 2.5, c - 1.8, d - 2.5],
        eaves + 0.22,
        r.height,
        r.ridge,
        'copper',
        'copper',
      );
      if (detail >= 2) parapet(out, r.box, eaves + 0.2, 0.2, 0.36);
      continue;
    }
    const north = r.name.startsWith('Fenway');
    hip(out, r.box, eaves - 0.025, r.height, r.ridge, 'copper', north ? 'paleRoof' : 'oxidized');
  }
  if (detail >= 2) {
    for (const [x0, z0, x1, z1] of [
      [-74, 47, -56, 58],
      [51, 46, 70, 57],
      [-32, 23, -17, 31],
      [13, 23, 27, 29],
    ]) {
      block(out, 'trim', x0, z0, x1, z1, eaves + 0.16, 16.28, 'paleRoof');
      block(out, 'roof', x0 + 0.18, z0 + 0.18, x1 - 0.18, z1 - 0.18, 16.29, 16.55, 'paleRoof');
    }
  }
}

function shaft(out, x, z, y0, y1, r0, r1, segments) {
  const p = (a, r, y) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments,
      b = ((i + 1) * Math.PI * 2) / segments,
      m = (a + b) / 2;
    face(
      out,
      'trim',
      [p(a, r0, y0), p(b, r0, y0), p(b, r1, y1), p(a, r1, y1)],
      [Math.cos(m), 0, Math.sin(m)],
    );
  }
}

function column(out, x, z, low, high, r, detail) {
  if (!detail) {
    shaft(out, x, z, low, high, r, r * 0.78, 4);
    return;
  }
  const n = [5, 6, 8, 12, 16][detail];
  block(out, 'trim', x - r * 1.18, z - r * 1.18, x + r * 1.18, z + r * 1.18, low, low + 0.22);
  shaft(out, x, z, low + 0.22, low + 0.47, r * 1.12, r, n);
  shaft(out, x, z, low + 0.47, high - 0.48, r, r * 0.77, n);
  shaft(out, x, z, high - 0.48, high - 0.22, r * 0.77, r * 1.1, n);
  block(out, 'trim', x - r * 1.19, z - r * 1.19, x + r * 1.19, z + r * 1.19, high - 0.22, high);
  if (detail >= 3)
    for (const sign of [-1, 1]) {
      block(
        out,
        'trim',
        x + sign * r * 0.7 - 0.12,
        z - r * 0.84,
        x + sign * r * 0.7 + 0.12,
        z + r * 0.84,
        high - 0.5,
        high - 0.2,
      );
    }
}

function stairs(out, x0, x1, start, end, low, high, count) {
  if (count === 2) {
    face(
      out,
      'stone',
      [
        [x0, high, start],
        [x1, high, start],
        [x1, low, end],
        [x0, low, end],
      ],
      [0, 1, 0],
    );
    for (const [x, side] of [
      [x0, -1],
      [x1, 1],
    ]) {
      face(
        out,
        'stone',
        [
          [x, high, start],
          [x, low, end],
          [x, -0.05, end],
          [x, -0.05, start],
        ],
        [side, 0, 0],
      );
    }
    return;
  }
  const sign = Math.sign(end - start);
  for (let j = 0; j < count; j++) {
    const z0 = start + ((end - start) * j) / count,
      z1 = start + ((end - start) * (j + 1)) / count;
    const y = high - ((high - low) * j) / count,
      y1 = high - ((high - low) * (j + 1)) / count;
    face(
      out,
      'stone',
      [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ],
      [0, 1, 0],
    );
    face(
      out,
      'stone',
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, sign],
    );
    for (const [x, side] of [
      [x0, -1],
      [x1, 1],
    ]) {
      face(
        out,
        'stone',
        [
          [x, y, z0],
          [x, y, z1],
          [x, -0.05, z1],
          [x, -0.05, z0],
        ],
        [side, 0, 0],
      );
    }
  }
}

function pediment(out, x, z, width, y, rise, detail) {
  const left = x - width / 2,
    right = x + width / 2;
  face(
    out,
    'trim',
    [
      [left, y, z],
      [right, y, z],
      [x, y + rise, z],
    ],
    [0, 0, 1],
  );
  face(
    out,
    'copper',
    [
      [left, y, z],
      [x, y + rise, z],
      [x, y + rise, z - 1.1],
      [left, y, z - 1.1],
    ],
    [0, 1, 0],
  );
  face(
    out,
    'copper',
    [
      [x, y + rise, z],
      [right, y, z],
      [right, y, z - 1.1],
      [x, y + rise, z - 1.1],
    ],
    [0, 1, 0],
  );
  if (detail >= 2) {
    const zf = z + 0.08;
    for (const end of [left, right])
      face(
        out,
        'trim',
        [
          [end, y, zf],
          [x, y + rise, zf],
          [x, y + rise + 0.18, zf],
          [end, y + 0.22, zf],
        ],
        [0, 0, 1],
      );
  }
}

function huntington(out, detail) {
  const front = 49.1,
    top = 16.72,
    landing = 2.68;
  block(out, 'stone', -9.0, 47.45, 5.2, 53.15, base - 0.38, landing);
  stairs(out, -8.55, 4.75, 53.15, 61.2, 0.53, landing, detail ? 11 : 2);
  for (const x of [-9.25, 4.92]) {
    block(out, 'stone', x, 48.0, x + 0.74, 53.28, 0.18, 2.68);
    block(out, 'stone', x, 53.28, x + 0.74, 60.1, 0.18, 1.27);
    block(out, 'trim', x - 0.11, 48.0, x + 0.86, 53.28, 2.68, 3.05);
  }
  const f = edge([6, 48], [-10, 48]);
  if (detail) {
    for (const u of [4.15, 8.05, 11.95]) {
      panel(out, f, 'metal', u - 0.83, u + 0.83, landing, 5.46, 0.044, 'darkGlass');
      band(out, f, 'trim', u - 0.99, u + 0.99, 5.42, 5.68, 0.14);
    }
    for (const u of [2.0, 6.1, 10.04, 14.0])
      band(out, f, 'trim', u - 0.3, u + 0.3, landing, 5.77, 0.24);
  } else panel(out, f, 'metal', 3.25, 12.8, landing, 5.55, 0.044, 'darkGlass');
  block(out, 'limestone', -10.2, 46.6, 6.2, 48.0, base, top);
  for (const u of [4.14, 8.05, 12.03]) {
    if (detail) window(out, f, u, 7.35, 2.05, 6.75, detail, 'warmGlass');
    else panel(out, f, 'glass', u - 0.95, u + 0.95, 7.4, 14.02, 0.031, 'warmGlass');
  }
  block(out, 'trim', -10.3, 47.1, 6.3, 50.2, 5.7, 6.37);
  for (const x of [-8.05, -4.13, 0.12, 4.07]) column(out, x, front, 6.37, 15.38, 0.57, detail);
  block(out, 'trim', -10.4, 46.25, 6.4, 50.37, 15.38, 16.41);
  block(out, 'trim', -10.72, 46.11, 6.72, 50.56, 16.41, top);
  pediment(out, -2, 50.4, 17.26, top, 2.1, detail);
  for (const [x, z] of [
    [-42.65, 73.52],
    [38.64, 71.91],
  ]) {
    block(out, 'trim', x - 5.65, z - 0.84, x + 5.65, z + 0.63, 13.9, 14.56);
    pediment(out, x, z + 0.62, 11.3, 14.56, 1.65, detail);
    if (detail >= 2) {
      for (const u of [-4.36, 4.36]) column(out, x + u, z + 0.23, 6.4, 13.9, 0.36, detail);
      const door = edge([x + 3.1, z + 0.07], [x - 3.1, z + 0.07]);
      window(out, door, 3.1, 7.0, 2.02, 4.62, detail, 'warmGlass');
    }
  }
}

function fenway(out, detail) {
  const z = -74.02,
    y0 = 1.52,
    y1 = 14.4;
  block(out, 'stone', -48.8, z - 1.26, 42.3, -72.4, base - 0.48, y0);
  block(out, 'trim', -49.1, z - 1.18, 42.4, -72.6, y1, 15.44);
  block(out, 'trim', -49.42, z - 1.36, 42.68, -72.3, 15.44, 15.82);
  stairs(out, -14.4, 7.5, -75.28, -79.4, 0.19, y0, detail ? 7 : 2);
  const f = edge([-47.8, -73.6], [41.3, -73.6]);
  for (let j = 0; j < 20; j++) {
    const x = -46.35 + j * 4.49;
    column(out, x, z, y0, y1, 0.56, detail);
    if (j < 19 && detail) {
      const u = x + 2.245 + 47.8;
      const door = j >= 8 && j <= 10;
      panel(
        out,
        f,
        door ? 'metal' : 'glass',
        u - 1.02,
        u + 1.02,
        door ? 1.62 : 5.4,
        door ? 6.07 : 9.55,
        0.022,
        door ? 'darkGlass' : 'warmGlass',
      );
      if (detail >= 3)
        band(out, f, 'trim', u - 1.16, u + 1.16, door ? 6.03 : 9.5, door ? 6.28 : 9.71, 0.2);
    }
  }
  if (detail >= 3) {
    for (const x of [-5.55, -1.12, 3.32])
      panel(out, f, 'metal', x + 47.8 - 0.43, x + 47.8 + 0.43, 8.15, 12.1, 0.27, 'banner');
  }
}

function modern(out, detail) {
  for (const r of controls.modernBlocks) {
    const [x0, z0, x1, z1] = r.box,
      y = r.height;
    block(out, 'concrete', x0, z0, x1, z1, eaves - 0.018, y);
    if (detail)
      block(out, 'roof', x0 - 0.16, z0 - 0.14, x1 + 0.16, z1 + 0.14, y, y + 0.25, 'paleRoof');
    else
      face(
        out,
        'roof',
        [
          [x0, y + 0.02, z0],
          [x1, y + 0.02, z0],
          [x1, y + 0.02, z1],
          [x0, y + 0.02, z1],
        ],
        [0, 1, 0],
        'paleRoof',
      );
    for (const [a, b] of [
      [
        [x0, z0],
        [x1, z0],
      ],
      [
        [x1, z0],
        [x1, z1],
      ],
      [
        [x1, z1],
        [x0, z1],
      ],
    ]) {
      const f = edge(a, b),
        n = Math.max(2, Math.round(f.length / 3.65)),
        pitch = f.length / n;
      const gallery = r.name.includes('gallery');
      if (!detail) {
        panel(
          out,
          f,
          'glass',
          0.18,
          f.length - 0.18,
          eaves + 0.55,
          Math.min(y - 0.22, eaves + 3.65),
          0.033,
        );
        continue;
      }
      for (const [low, high] of [
        [eaves + 0.36, eaves + 2.31],
        [eaves + 2.49, Math.min(y - 0.24, eaves + 4.47)],
      ]) {
        if (high <= low + 0.1) continue;
        for (let i = 0; i < n; i++) {
          if (!gallery && (i + (low > eaves + 2 ? 1 : 0)) % 4 >= 2) continue;
          panel(
            out,
            f,
            'glass',
            i * pitch + 0.17,
            (i + 1) * pitch - 0.13,
            low,
            high,
            0.04,
            'darkGlass',
          );
          if (detail >= 3)
            panel(
              out,
              f,
              'metal',
              (i + 0.5) * pitch - 0.04,
              (i + 0.5) * pitch + 0.04,
              low,
              high,
              0.052,
            );
        }
      }
    }
    if (detail >= 2)
      for (const x of [x0 + (x1 - x0) * 0.28, x0 + (x1 - x0) * 0.64]) {
        block(out, 'metal', x - 0.7, z0 + 2.15, x + 0.7, z0 + 4.4, y + 0.2, y + 0.84, 'paleRoof');
      }
  }
  const [x0, z0, x1, z1] = controls.shapiro,
    top = 19.55;
  block(out, 'concrete', x0, z0, x1, z1, eaves - 0.03, top);
  for (const [a, b] of [
    [
      [x0, z1],
      [x0, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z0],
      [x1, z0],
    ],
  ]) {
    const f = edge(a, b);
    panel(out, f, 'glass', 0.2, f.length - 0.2, eaves + 0.54, top - 0.18, 0.023);
  }
  block(out, 'glass', x0 + 0.12, z0 + 0.12, x1 - 0.12, z1 - 0.12, top, top + 0.18, 'darkGlass');
  if (detail >= 2) {
    for (let x = x0 + 0.7; x < x1; x += 2.4)
      block(out, 'metal', x - 0.045, z0 + 0.08, x + 0.045, z1 - 0.08, top + 0.17, top + 0.24);
    for (let z = z0 + 0.7; z < z1; z += 2.4)
      block(out, 'metal', x0 + 0.08, z - 0.045, x1 - 0.08, z + 0.045, top + 0.245, top + 0.3);
  }
}

function westRoof(out, detail) {
  const [x0, z0, x1, z1] = controls.westBarrel,
    x = (x0 + x1) / 2,
    r = (x1 - x0) / 2;
  block(out, 'concrete', x0 - 2.48, z0 - 1.58, x1 + 1.3, z1 + 1.2, eaves - 0.03, 17.74);
  block(out, 'roof', x0 - 2.48, z0 - 1.58, x1 + 1.3, z1 + 1.2, 17.74, 17.95);
  const n = [4, 6, 8, 12, 16][detail],
    point = (t, z) => [x - r * Math.cos(t), 17.94 + 2.23 * Math.sin(t), z];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      m = (a + b) / 2;
    face(
      out,
      'glass',
      [point(a, z0), point(a, z1), point(b, z1), point(b, z0)],
      [-Math.cos(m), Math.sin(m), 0],
      'darkGlass',
    );
  }
  for (const [z, sign] of [
    [z0, -1],
    [z1, 1],
  ])
    face(
      out,
      'metal',
      Array.from({ length: n + 1 }, (_, i) => point((Math.PI * i) / n, z)),
      [0, 0, sign],
    );
  if (detail >= 3)
    for (let z = z0 + 1.5; z < z1; z += 2.2)
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * i) / n,
          b = (Math.PI * (i + 1)) / n,
          m = (a + b) / 2;
        const rib = (t, z) => {
          const p = point(t, z);
          p[0] -= 0.035 * Math.cos(t);
          p[1] += 0.035 * Math.sin(t);
          return p;
        };
        face(
          out,
          'metal',
          [rib(a, z - 0.035), rib(a, z + 0.035), rib(b, z + 0.035), rib(b, z - 0.035)],
          [-Math.cos(m), Math.sin(m), 0],
        );
      }
}

export function buildMuseumLevel(out, level) {
  const detail = levels[level];
  if (detail === undefined) throw Error('Unknown museum detail level ' + level);
  shell(out, detail);
  historicRoofs(out, detail);
  huntington(out, detail);
  fenway(out, detail);
  modern(out, detail);
  westRoof(out, detail);
}

export const buildMuseumSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildMuseumDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildMuseumStreet = (out) => buildMuseumLevel(out, 'street');
export const buildMuseumCloseup = (out) => buildMuseumLevel(out, 'closeup');
