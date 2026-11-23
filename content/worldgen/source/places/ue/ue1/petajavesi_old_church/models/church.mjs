import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  logs: { slot: 'wall', graph: 'wood_log', roughness: 0.97 },
  boards: { slot: 'wall', graph: 'wood_vertical', roughness: 0.95 },
  paint: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.96 },
  shingles: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.97 },
  stone: { slot: 'wall', graph: 'stone_drywall', roughness: 1 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.86, metallic: 0.17 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
};
const log = rgb('765a45'),
  endgrain = rgb('9d7758'),
  board = rgb('7e6a52');
const pale = rgb('dbd6c7'),
  red = rgb('a3664d'),
  tar = rgb('766b5c'),
  lightRoof = rgb('aea695');
const shadow = rgb('4b4941'),
  glass = rgb('585e56'),
  ochre = rgb('b99b70'),
  iron = rgb('6a7166');
const dry = rgb('a2a391'),
  angle = (site.planAngleDegrees * Math.PI) / 180;
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const edges = (r) => outwardRing(r).map((a, i, p) => wallFace(a, p[(i + 1) % p.length]));

function placed(out) {
  const m = transform(out, -angle);
  m.addCap = (slot, ref, p, holes, grade, n, uv, c) => {
    const build = new MeshBufferBuilder();
    if (!build.addCap('wall', ref, p, holes, grade, n, uv, c)) return false;
    const { positions, indices } = build.finalize();
    for (let i = 0; i < indices.length; i += 3)
      m.addTriangle(
        slot,
        ref,
        [0, 1, 2].map((j) => positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3)),
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        c,
      );
    return true;
  };
  return m;
}
function panel(out, slot, f, a, b, y, h, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y, d), p(b, y, d), p(b, h, d), p(a, h, d), color);
}
function framedWindow(out, f, u, y, w, h, detail) {
  panel(out, 'glass', f, u - w * 0.5, u + w * 0.5, y, y + h, 0.042, glass);
  if (detail === 1) return;
  const jambs = detail === 3 ? [-1, -0.333, 0.333, 1] : [-1, 0, 1];
  for (const q of jambs) {
    const x = u + w * 0.5 * q;
    fbox(out, 'boards', f, x - 0.046, x + 0.046, y - 0.07, y + h + 0.065, -0.021, 0.104, ochre);
  }
  const n = detail === 3 ? Math.max(2, Math.round(h / 0.42)) : 3;
  for (let i = 0; i <= n; i++) {
    const hy = y + (h * i) / n;
    fbox(
      out,
      'boards',
      f,
      u - w * 0.5 - 0.071,
      u + w * 0.5 + 0.071,
      hy - 0.037,
      hy + 0.037,
      0.021,
      0.104,
      ochre,
    );
  }
}
function chevrons(out, f, u, y, w, h, detail, tint) {
  panel(out, 'boards', f, u - w * 0.5, u + w * 0.5, y, y + h, 0.045, shadow);
  const n = detail === 3 ? Math.ceil(h / 0.23) : detail === 2 ? 6 : 4,
    p = f.P;
  for (let i = 0; i < n; i++) {
    const available = h - 0.2,
      span = available / n,
      low = y + 0.025 + i * span,
      rise = Math.min(0.22, span * 0.84);
    const high = low + span * 0.78;
    for (const s of [-1, 1]) {
      const l = s < 0 ? u - w * 0.5 : u,
        r = s < 0 ? u : u + w * 0.5;
      const yl = s < 0 ? 0 : rise,
        yr = s < 0 ? rise : 0;
      quad4(
        out,
        'paint',
        p(l, low + yl, 0.087),
        p(r, low + yr, 0.087),
        p(r, high + yr, 0.087),
        p(l, high + yl, 0.087),
        tint,
      );
    }
  }
}
function timberCorners(out, ring, y, top, detail) {
  if (detail < 2) return;
  for (const f of edges(ring)) {
    const step = detail === 3 ? 0.254 : 0.492;
    if (f.length < 2.35) continue;
    for (const [u, side] of [
      [0.178, -1],
      [f.length - 0.178, 1],
    ]) {
      for (let i = 0; y + i * step < top - 0.18; i++) {
        if ((i + (side > 0 ? 1 : 0)) % 2 === 1 && detail === 3) continue;
        const floor = y + i * step,
          d = detail === 3 ? 0.14 : 0.1;
        fbox(
          out,
          'boards',
          f,
          u - 0.125,
          u + 0.125,
          floor,
          floor + step * 0.43,
          -0.02,
          d,
          i % 3 ? endgrain : board,
        );
      }
    }
  }
}
function steps(out, f, u, width, y, top, depth, detail) {
  const n = detail === 0 ? 2 : detail === 1 ? 3 : 6;
  for (let i = 0; i < n; i++)
    fbox(
      out,
      'stone',
      f,
      u - width * 0.5,
      u + width * 0.5,
      y - 0.15,
      y + ((top - y) * (i + 1)) / n,
      -0.1,
      (depth * (n - i)) / n,
      dry,
    );
}
function ridgeSpire(out, x, z, y, high, detail, base) {
  const n = detail === 3 ? 10 : detail === 2 ? 8 : 5;
  loft(
    out,
    'metal',
    [
      [y, base * 0.7],
      [y + 0.32, base],
      [y + 0.8, base * 0.88],
      [y + 1.19, base * 0.42],
      [y + 1.31, base * 0.37],
      [high - 0.36, 0.044],
      [high, 0.019],
    ].map(([Y, r]) => radialRing(Y, r, r, n, [x, z])),
    iron,
  );
  const cross = high - 0.89;
  beam(out, 'metal', [x - 0.54, cross, z], [x + 0.54, cross, z], 0.031, 0.032, iron);
  if (detail >= 2) {
    beam(out, 'metal', [x, cross, z - 0.39], [x, cross, z + 0.39], 0.029, 0.033, iron);
    tri(out, 'metal', [x, high - 0.61, z], [x + 0.5, high - 0.72, z], [x, high - 0.83, z], iron);
  }
}
function nave(out, detail) {
  const ground = -0.11,
    floor = ground + 0.45,
    eave = 6.07,
    ridge = 13.93;
  for (const original of site.nave) {
    const r = cleanRing(original);
    extrude(out, 'stone', r, -2.48, floor, dry);
    extrude(out, 'logs', r, floor, eave, log, { top: false });
    timberCorners(out, r, floor, eave, detail);
    if (detail)
      for (const f of edges(r)) {
        if (f.length < 4.42) continue;
        fbox(out, 'boards', f, 0, f.length, eave - 0.26, eave + 0.03, -0.16, 0.181, board);
        if (f.length < 6.5) continue;
        const u = f.length * 0.5;
        const south = f.normal[1] > 0.72,
          north = f.normal[1] < -0.69;
        if (south || north) {
          const door = south;
          if (door) {
            fbox(out, 'boards', f, u - 0.66, u + 0.66, floor, floor + 2.15, -0.021, 0.122, board);
            chevrons(out, f, u, floor + 0.08, 1.14, 1.94, detail, endgrain);
            steps(out, f, u, 1.65, ground - 0.31, floor, 1.42, detail);
            framedWindow(out, f, u, 4.94, 0.86, 0.63, detail);
          } else framedWindow(out, f, u, 1.57, 1.75, 3.79, detail);
        } else framedWindow(out, f, u, 1.53, 1.78, 3.75, detail);
      }
  }
  gableRoof(out, 'shingles', [-8.96, -1.07], [9.56, -1.07], 8.73, eave, ridge, tar, {
    overhang: 0.31,
    endSlot: 'logs',
    endColor: log,
  });
  gableRoof(
    out,
    'shingles',
    [-0.1, -10.044],
    [-0.1, 8.238],
    8.6,
    eave + 0.073,
    ridge - 0.085,
    tar,
    { overhang: 0.33, endSlot: 'logs', endColor: log },
  );
  ridgeSpire(out, 0.2, -1.04, ridge - 0.1, 18.71, detail, 0.4);
  if (detail >= 2) {
    const f = wallFace([-4.43, 8.24], [4.16, 8.24]);
    const p = f.P;
    for (const side of [-1, 1])
      beam(
        out,
        'boards',
        p(f.length * 0.5, 13.831, 0.24),
        p(f.length * 0.5 + side * 4.45, 6.05, 0.24),
        0.108,
        0.124,
        board,
      );
  }
}
function passage(out, detail) {
  for (const p of site.porch) {
    const r = cleanRing(p);
    if (r.length < 4) continue;
    extrude(out, 'boards', r, -2.15, 3.41, board, { top: false });
    const [x, X, z, Z] = [0, 1].flatMap((i) => [
      Math.min(...r.map((p) => p[i])),
      Math.max(...r.map((p) => p[i])),
    ]);
    gableRoof(out, 'shingles', [x, (z + Z) * 0.5], [X, (z + Z) * 0.5], Z - z, 3.4, 4.83, tar, {
      overhang: 0.25,
      endSlot: 'boards',
      endColor: board,
    });
    if (detail)
      for (const f of edges(r))
        if (f.length > 3.2 && Math.abs(f.normal[1]) > 0.7)
          framedWindow(out, f, f.length * 0.5, 1.48, 1.22, 1.12, detail);
  }
}
function bellTower(out, detail) {
  const {
    center: [x, z],
    threshold: Y,
    spireTop,
  } = site.belfry;
  const p = cleanRing(site.tower[0]),
    square = (y, w) =>
      rect(x - w * 0.5, x + w * 0.5, z - w * 0.5, z + w * 0.5).map(([x, z]) => [x, y, z]);
  const sY = Y + 6.5,
    tY = Y + 12.28,
    redY = Y + 13.94,
    upper = Y + 18.59,
    dome = Y + 20.11;
  extrude(out, 'stone', p, Y - 1.48, Y + 0.43, dry);
  extrude(out, 'logs', p, Y + 0.43, sY, log);
  timberCorners(out, p, Y + 0.43, sY, detail);
  for (const f of edges(p)) {
    if (detail) fbox(out, 'boards', f, 0, f.length, sY - 0.29, sY + 0.09, -0.13, 0.229, ochre);
    if (f.normal[0] < -0.8) {
      const u = f.length * 0.5;
      steps(out, f, u, 1.73, Y - 0.52, Y + 0.64, 2.12, detail);
      if (detail) chevrons(out, f, u, Y + 0.64, 1.49, 2.43, detail, endgrain);
    }
  }
  const hood =
    detail <= 1
      ? [
          [sY, 10.71],
          [sY + 0.71, 9.41],
          [tY, 6.63],
        ]
      : [
          [sY, 10.84],
          [sY + 0.32, 10.19],
          [sY + 0.77, 9.45],
          [sY + 1.6, 8.51],
          [sY + 2.9, 7.81],
          [tY, 6.62],
        ];
  loft(
    out,
    'shingles',
    hood.map(([h, w]) => square(h, w)),
    lightRoof,
  );
  const band = rect(x - 3.18, x + 3.18, z - 3.18, z + 3.18);
  extrude(out, 'paint', band, tY - 0.16, redY, red);
  extrude(out, 'paint', band, redY, upper, pale);
  if (detail)
    for (const f of edges(band)) {
      const n = 3,
        sep = f.length / n;
      for (let i = 0; i < n; i++) {
        const u = sep * (i + 0.5);
        chevrons(out, f, u, redY + 0.14, sep * 0.81, upper - redY - 0.43, detail, pale);
        const q = f.P,
          h = tY + 0.83,
          a = 0.165;
        quad4(
          out,
          'paint',
          q(u - a, h, 0.091),
          q(u, h - a, 0.091),
          q(u + a, h, 0.091),
          q(u, h + a, 0.091),
          pale,
        );
      }
      fbox(out, 'boards', f, 0, f.length, redY - 0.141, redY + 0.091, -0.091, 0.186, shadow);
      fbox(out, 'boards', f, 0, f.length, upper - 0.19, upper + 0.102, -0.09, 0.21, ochre);
    }
  loft(
    out,
    'shingles',
    [square(upper - 0.01, 6.94), square(upper + 0.66, 6.13), square(dome, 3.52)],
    lightRoof,
  );
  const r = 1.47,
    lantern = dome + 2.38;
  const ring = (y, s) => radialRing(y, s, s, 8, [x, z], Math.PI / 8);
  const tower = ring(dome, r).map(([x, , z]) => [x, z]);
  extrude(out, 'paint', tower, dome - 0.05, lantern, pale);
  if (detail)
    for (const f of edges(tower))
      chevrons(
        out,
        f,
        f.length * 0.5,
        dome + 0.13,
        f.length * 0.83,
        lantern - dome - 0.29,
        detail,
        pale,
      );
  loft(
    out,
    'shingles',
    [ring(lantern - 0.07, 1.78), ring(lantern + 0.19, 1.65), ring(lantern + 0.65, 0.34)],
    lightRoof,
  );
  ridgeSpire(out, x, z, lantern + 0.56, spireTop, detail, 0.47);
}
function build(out, detail) {
  const m = placed(out);
  nave(m, detail);
  passage(m, detail);
  bellTower(m, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
