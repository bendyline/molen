import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.85, metallic: 0.21 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67 },
};
const courtStone = rgb('b2b1a7'),
  pearl = rgb('c8c5b6'),
  chalk = rgb('cbc9bc'),
  sill = rgb('a9a799');
const tile = rgb('785449'),
  copper = rgb('536b61'),
  louvre = rgb('8b4941'),
  gold = rgb('bb9d58');
const blue = rgb('45545d'),
  dial = rgb('46566a'),
  oak = rgb('535045'),
  floor = -1.91;
const deg = (site.planAngleDegrees * Math.PI) / 180;
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const edges = (r) => outwardRing(r).map((a, i, q) => wallFace(a, q[(i + 1) % q.length]));

function placed(out) {
  const mesh = transform(out, -deg);
  mesh.addCap = (slot, ref, r, holes, grade, n, uv, tint) => {
    const scratch = new MeshBufferBuilder();
    if (!scratch.addCap('wall', ref, r, holes, grade, n, uv, tint)) return false;
    const { positions, indices } = scratch.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3));
      mesh.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        tint,
      );
    }
    return true;
  };
  return mesh;
}

function outline(r, tolerance) {
  const q = cleanRing(r);
  for (let i = q.length - 1; i >= 0 && q.length > 5; i--) {
    const a = q[(i + q.length - 1) % q.length],
      b = q[(i + 1) % q.length];
    const [x, z] = q[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz) || 1;
    const t = ((x - a[0]) * dx + (z - a[1]) * dz) / l;
    if (t >= 0 && t <= l && Math.abs((x - a[0]) * dz - (z - a[1]) * dx) / l < tolerance)
      q.splice(i, 1);
  }
  return q;
}

function tapered(out, slot, cx, cz, levels, n, tint) {
  loft(
    out,
    slot,
    levels.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, [cx, cz], Math.PI / 4)),
    tint,
  );
}

function cutCorners(x, z, rx, rz) {
  const p = Math.min(rx, rz) * 0.2;
  return [
    [x - rx + p, z - rz],
    [x - rx, z - rz + p],
    [x - rx, z + rz - p],
    [x - rx + p, z + rz],
    [x + rx - p, z + rz],
    [x + rx, z + rz - p],
    [x + rx, z - rz + p],
    [x + rx - p, z - rz],
  ];
}

function panel(out, F, slot, a, b, y, Y, d, tint) {
  const p = F.P;
  quad4(out, slot, p(a, y, d), p(b, y, d), p(b, Y, d), p(a, Y, d), tint);
}

function oval(out, F, u, y, rx, ry, detail, color, depth, slot) {
  const n = detail >= 2 ? 20 : 9,
    p = F.P;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    tri(
      out,
      slot,
      p(u, y, depth),
      p(u + Math.cos(a) * rx, y + Math.sin(a) * ry, depth),
      p(u + Math.cos(b) * rx, y + Math.sin(b) * ry, depth),
      color,
    );
  }
}

function window(out, F, detail, u, y, w, h, options) {
  if (detail === 3) {
    opening(out, F, u, y, w, h, options);
    return;
  }
  const { head, glassSlot = 'glass', glass = blue, frame = pearl, d = 0.052 } = options;
  const left = u - w / 2,
    right = u + w / 2,
    rise = head === 'round' ? w * 0.5 : 0,
    spring = y + h - rise;
  if (detail === 2)
    panel(out, F, 'trim', left - 0.12, right + 0.12, y - 0.126, spring + 0.086, d - 0.012, frame);
  panel(out, F, glassSlot, left, right, y, spring, d, glass);
  if (rise) {
    const n = detail === 1 ? 4 : 7,
      p = F.P;
    for (let i = 0; i < n; i++) {
      const a = Math.PI - (i * Math.PI) / n,
        b = Math.PI - ((i + 1) * Math.PI) / n;
      tri(
        out,
        glassSlot,
        p(u + w * 0.5 * Math.cos(a), spring + rise * Math.sin(a), d),
        p(u + w * 0.5 * Math.cos(b), spring + rise * Math.sin(b), d),
        p(u, spring, d),
        glass,
      );
    }
  }
  if (detail === 2 && options.mullions)
    panel(out, F, 'trim', u - 0.048, u + 0.048, y, spring, d + 0.018, frame);
}

function clock(out, F, u, y, detail) {
  if (!detail) return;
  const r = 1.56,
    p = F.P;
  oval(out, F, u, y, r + 0.157, r + 0.157, detail, gold, 0.108, 'trim');
  oval(out, F, u, y, r, r, detail, dial, 0.138, 'glass');
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        c = Math.cos(a),
        s = Math.sin(a);
      beam(
        out,
        'trim',
        p(u + c * r * 0.68, y + s * r * 0.68, 0.187),
        p(u + c * r * 0.94, y + s * r * 0.94, 0.187),
        0.052,
        0.037,
        gold,
      );
    }
  for (const [x, Y, w] of [
    [-0.56, 0.44, 0.083],
    [0.24, 1.04, 0.066],
  ])
    beam(out, 'trim', p(u, y, 0.209), p(u + x, y + Y, 0.209), w, 0.055, gold);
}

function cross(out, x, z, y, h, detail) {
  beam(out, 'trim', [x, y, z], [x, y + h, z], 0.077, 0.078, gold);
  if (detail)
    beam(
      out,
      'trim',
      [x, y + h * 0.63, z - h * 0.305],
      [x, y + h * 0.63, z + h * 0.305],
      0.083,
      0.074,
      gold,
    );
}

function bellRoof(out, x, z, detail) {
  const lc = [4, 8, 12, 18][detail],
    n = detail === 0 ? 4 : 8;
  const levels = detail
    ? [
        [53.96, 4.49],
        [54.76, 4.93],
        [56.72, 4.63],
        [58.32, 3.54],
        [59.42, 1.85],
        [60.75, 1.29],
      ]
    : [
        [53.96, 4.49],
        [55.35, 4.82],
        [58.32, 3.54],
        [60.75, 1.29],
      ];
  tapered(out, 'copper', x, z, levels, lc, copper);
  const y = 60.74;
  tapered(
    out,
    'trim',
    x,
    z,
    [
      [y, 1.58],
      [y + 0.47, 1.62],
    ],
    n,
    pearl,
  );
  if (detail >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        c = Math.cos(a),
        s = Math.sin(a);
      column(out, 'trim', x + c * 1.2, z + s * 1.2, y + 0.35, 63.48, 0.161, pearl, 8);
    }
  } else
    tapered(
      out,
      'stone',
      x,
      z,
      [
        [y + 0.38, 1.31],
        [63.44, 1.31],
      ],
      n,
      courtStone,
    );
  tapered(
    out,
    'copper',
    x,
    z,
    [
      [63.41, 1.55],
      [64.33, 1.52],
      [65.02, 1.07],
      [65.71, 0.31],
    ],
    lc,
    copper,
  );
  tapered(
    out,
    'trim',
    x,
    z,
    [
      [65.67, 0.2],
      [66.14, 0.39],
      [66.58, 0.14],
    ],
    n,
    gold,
  );
  cross(out, x, z, 66.31, site.towerHeight - 66.31, detail);
}

function tower(out, x, z, detail) {
  const sections = [
    [floor, 17.43, 5.59, 5.12],
    [17.4, 18.63, 5.77, 5.38],
    [18.62, 38.03, 5.05, 4.68],
    [37.99, 39.39, 5.41, 5.01],
    [39.33, 53.76, 4.62, 4.25],
    [53.72, 54.42, 4.83, 4.52],
  ];
  for (const [a, b, rx, rz] of sections) {
    const ring = detail ? cutCorners(x, z, rx, rz) : rect(x - rx, x + rx, z - rz, z + rz);
    extrude(out, 'stone', ring, a, b, courtStone, {
      top: detail > 0,
      topSlot: 'trim',
      topColor: pearl,
    });
  }
  if (detail) {
    const R = rect(x - 4.99, x + 5.081, z - 4.73, z + 4.73);
    for (const e of edges(R)) {
      const u = e.length / 2;
      clock(out, e, u, 30.22, detail);
      if (detail >= 2) {
        window(out, e, detail, u, 21.19, 2.02, 5.47, {
          head: 'round',
          glass: sill,
          frame: pearl,
          frameSlot: 'trim',
          frameWidth: 0.14,
          frameDepth: 0.12,
        });
        for (const sign of [-1, 1]) {
          const a = u + sign * e.length * 0.324;
          fbox(out, 'trim', e, a - 0.23, a + 0.23, 19.03, 37.68, -0.1, 0.23, pearl);
        }
      }
    }
    for (const e of edges(rect(x - 4.66, x + 4.66, z - 4.29, z + 4.28))) {
      const u = e.length * 0.5;
      oval(out, e, u, 49.02, 0.79, 1.05, detail, louvre, 0.081, 'wood');
      window(out, e, detail, u, 41.36, 2.27, 3.44, {
        head: 'round',
        glassSlot: 'wood',
        glass: louvre,
        frame: pearl,
        frameSlot: 'trim',
        frameWidth: 0.14,
        frameDepth: 0.2,
        sill: false,
        d: 0.11,
        mullions: 0,
      });
      if (detail >= 2)
        for (const flip of [-1, 1]) {
          const P = u + flip * (e.length * 0.383);
          fbox(out, 'trim', e, P - 0.32, P + 0.32, 39.52, 53.59, -0.16, 0.26, pearl);
        }
    }
    const face = facade([x + 5.6, z + 4.29], [0, -1]);
    window(out, face, detail, 4.29, 2.61, 2.28, 5.81, {
      head: 'round',
      glass: oak,
      glassSlot: 'wood',
      frameSlot: 'trim',
      frame: pearl,
      frameWidth: 0.17,
      frameDepth: 0.22,
      mullions: 0,
    });
    oval(out, face, 4.29, 11.94, 1.17, 1.45, detail, sill, 0.105, 'trim');
    if (detail >= 2) {
      for (const d of [-1, 1]) {
        const [xx, , zz] = face.P(4.29 + d * 3.45, 0, 0.18);
        column(out, 'trim', xx, zz, 2.36, 15.92, 0.52, pearl, detail === 2 ? 8 : 12);
      }
    }
  }
  bellRoof(out, x, z, detail);
}

function abbeyWing(out, section, detail) {
  const r = outline(section.ring, detail ? 0.095 : 0.65);
  const { axis, min, max, rise, height } = section,
    middle = (min + max) / 2;
  const y = (p) => height + rise * (1 - Math.abs((p[axis] - middle) / (max - middle)));
  const split = r.flatMap((p, i) => {
    const n = r[(i + 1) % r.length];
    if ((p[axis] - middle) * (n[axis] - middle) >= 0) return [p];
    const t = (middle - p[axis]) / (n[axis] - p[axis]);
    return [p, [p[0] + t * (n[0] - p[0]), p[1] + t * (n[1] - p[1])]];
  });
  for (const e of edges(split)) {
    const [x, , z] = e.P(0, 0),
      [X, , Z] = e.P(e.length, 0);
    quad4(
      out,
      'plaster',
      e.P(0, floor),
      e.P(e.length, floor),
      e.P(e.length, y([X, Z])),
      e.P(0, y([x, z])),
      chalk,
    );
  }
  for (const ring of section.panels)
    out.addCap(
      'tile',
      'palette:#ffffff',
      outline(ring, detail ? 0.072 : 0.41),
      [],
      y,
      [0, 1, 0],
      (p) => p,
      tile,
    );
  if (!detail) return;
  for (const F of edges(r)) {
    if (F.length < 6.0) continue;
    const count = Math.max(1, Math.round(F.length / 3.5));
    const w = Math.min(1.52, (F.length / count) * 0.47);
    for (const L of [2.7, 7.4, 12.23]) {
      if (L + 2.54 > height) continue;
      for (let i = 0; i < count; i++) {
        const u = (F.length * (i + 0.5)) / count;
        if (detail === 1) panel(out, F, 'glass', u - w / 2, u + w / 2, L, L + 2.55, 0.056, blue);
        else
          window(out, F, detail, u, L, w, 2.55, {
            glass: blue,
            frame: chalk,
            frameSlot: 'trim',
            frameWidth: 0.14,
            frameDepth: 0.1,
            mullions: detail === 3 ? 1 : 0,
            transoms: detail === 3 ? 2 : 0,
            d: 0.058,
          });
      }
    }
    if (detail >= 2) panel(out, F, 'trim', 0.053, F.length - 0.055, 0.66, 1.2, 0.041, sill);
  }
}

function eastScreen(out, detail) {
  const F = facade([22.43, -17.75], [0, -1]),
    w = 9.34;
  const [x, , z] = F.P(w * 0.5, 0);
  fbox(out, 'stone', F, -0.46, w + 0.41, 1.23, 31.1, -5.77, 0.29, courtStone);
  const top = F.P(w * 0.5, 42.25, -0.2),
    p = F.P;
  for (const [a, b] of [
    [-0.18, w * 0.5],
    [w * 0.5, w + 0.16],
  ]) {
    const lo = p(a, 31, 0.24),
      hi = p(b, 31, 0.24);
    const u = a < w * 0.4 ? p(a, 33.21, 0.24) : top;
    const v = b > w * 0.6 ? p(b, 33.21, 0.24) : top;
    quad4(out, 'trim', lo, hi, v, u, pearl);
  }
  tapered(
    out,
    'trim',
    x - 0.69,
    z,
    [
      [42.2, 0.79],
      [44.7, 0.76],
    ],
    detail >= 2 ? 8 : 4,
    pearl,
  );
  tapered(
    out,
    'copper',
    x - 0.69,
    z,
    [
      [44.65, 0.84],
      [45.67, 1.03],
      [46.47, 0.57],
      [46.84, 0.26],
    ],
    detail >= 2 ? 10 : 5,
    copper,
  );
  cross(out, x - 0.69, z, 46.72, 1.49, detail);
  if (!detail) return;
  for (const u of [w * 0.22, w * 0.5, w * 0.78]) {
    window(out, F, detail, u, 1.45, 1.42, 4.79, {
      head: 'round',
      glass: oak,
      glassSlot: 'wood',
      frameSlot: 'trim',
      frame: pearl,
      frameWidth: 0.18,
      frameDepth: 0.19,
      d: 0.32,
    });
    window(out, F, detail, u, 9.23, 1.53, 5.57, {
      head: 'round',
      glass: blue,
      frameSlot: 'trim',
      frame: pearl,
      frameWidth: 0.19,
      frameDepth: 0.12,
      d: 0.34,
    });
    oval(out, F, u, 18.62, 0.62, 1.12, detail, blue, 0.381, 'glass');
  }
  fbox(out, 'trim', F, -0.57, w + 0.54, 22.72, 24.14, -0.88, 0.71, pearl);
  if (detail >= 2) {
    for (const u of [w * 0.33, w * 0.67]) {
      const [x, , z] = F.P(u, 0, 0.35);
      column(out, 'trim', x, z, 2.35, 22.83, 0.39, pearl, detail === 3 ? 12 : 8);
    }
    oval(out, F, w * 0.5, 32.72, 1.61, 2.12, detail, sill, 0.417, 'trim');
    sphere(out, 'trim', F.P(w * 0.5, 32.76, 0.44), [0.39, 0.51, 0.42], pearl, 12, 6);
  }
}

function cathedralBody(out, detail) {
  const r = outline(site.plan, detail ? 0.075 : 0.72);
  extrude(out, 'plaster', r, floor, 18.68, chalk, { topSlot: 'tile', topColor: tile });
  gableRoof(out, 'tile', [-82.95, -20.12], [19.53, -20.12], 32.14, 18.68, 30.31, tile, {
    overhang: 0.3,
    endSlot: 'trim',
    endColor: pearl,
  });
  const levels = detail
    ? [
        [18.57, 20.65, 21.97],
        [20.17, 20.7, 22.05],
        [24.47, 17.39, 18.92],
        [30.04, 6.26, 7.31],
        [30.99, 0.73, 0.86],
      ]
    : [
        [18.57, 20.65, 21.97],
        [24.2, 17.78, 19.12],
        [31.0, 0.9, 1.05],
      ];
  tapered(out, 'tile', -37.1, -20.12, levels, [8, 10, 14, 20][detail], tile);
  tapered(
    out,
    'copper',
    -37.1,
    -20.12,
    [
      [30.9, 0.58],
      [31.93, 0.37],
      [32.21, 0.14],
    ],
    detail ? 8 : 4,
    copper,
  );
  if (!detail) return;
  for (const F of [facade([10.64, -36.67], [-1, 0]), facade([-81.76, -0.73], [1, 0])]) {
    for (const x of [3.42, 13.24, 22.65, 36.4, 46.62, 51.1, 64.24, 74.46, 85.61]) {
      if (x > 88) continue;
      window(out, F, detail, x, 2.23, 2.1, 11.82, {
        head: 'round',
        glass: blue,
        frame: pearl,
        frameSlot: 'trim',
        frameWidth: 0.22,
        frameDepth: 0.16,
        mullions: detail >= 2 ? 2 : 0,
        transoms: detail === 3 ? 3 : 0,
        d: 0.078,
      });
    }
  }
  for (const side of [-1, 1]) {
    const z = -20.12 + side * 21.67;
    const F = side < 0 ? facade([-24.8, z], [-1, 0]) : facade([-49.7, z], [1, 0]);
    for (const u of [5.1, 12.5, 19.96])
      window(out, F, detail, u, 2.19, 2.6, 13.21, {
        head: 'round',
        glass: blue,
        frame: pearl,
        frameSlot: 'trim',
        frameWidth: 0.25,
        frameDepth: 0.23,
        mullions: detail >= 2 ? 2 : 0,
        transoms: detail === 3 ? 3 : 0,
        d: 0.08,
      });
  }
}

function build(out, detail) {
  const m = placed(out);
  cathedralBody(m, detail);
  for (const [x, z] of site.towerCenters) tower(m, x, z, detail);
  eastScreen(m, detail);
  for (const section of site.roofSections) abbeyWing(m, section, detail);
  const [x, z] = [27.6, -7.58];
  tapered(
    m,
    'plaster',
    x,
    z,
    [
      [10.8, 2.48],
      [18.46, 2.48],
    ],
    detail ? 8 : 5,
    chalk,
  );
  tapered(
    m,
    'copper',
    x,
    z,
    [
      [18.38, 2.59],
      [19.55, 2.14],
      [21.05, 1.08],
      [22.41, 0.43],
    ],
    detail >= 2 ? 12 : 6,
    copper,
  );
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
