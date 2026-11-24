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
  roundArch,
  spire,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.95 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.87 },
  door: { slot: 'door', graph: 'wood_vertical', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
};
const golden = rgb('b9a581'),
  stone = rgb('bab3a1'),
  pale = rgb('cdc5b0'),
  rich = rgb('b4a489');
const tile = rgb('9c6148'),
  slate = rgb('5e686a'),
  gray = rgb('566265'),
  door = rgb('525c4b');
const degree = (site.planAngleDegrees * Math.PI) / 180;
const local = (out) => {
  const builder = transform(out, -degree);
  builder.addCap = (slot, ref, ring, holes, grade, n, uv, color) => {
    const scratch = new MeshBufferBuilder();
    if (!scratch.addCap('wall', ref, ring, holes, grade, n, uv, color)) return false;
    const { positions, indices } = scratch.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      builder.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        color,
      );
    }
    return true;
  };
  return builder;
};

function panel(out, F, slot, a, b, y, h, d, color) {
  const p = F.P;
  quad4(out, slot, p(a, y, d), p(b, y, d), p(b, h, d), p(a, h, d), color);
}

function arcade(out, F, detail, { length, bays, base, top, depth, radius, spring, edge = 0.56 }) {
  const span = (length - edge * 2) / bays,
    springY = base + spring;
  const counts = [2, 4, 7, 12],
    p = F.P,
    seg = counts[detail];
  for (let i = 0; i < bays; i++) {
    const a = edge + i * span,
      b = a + span,
      u = (a + b) / 2;
    const from = i === 0 ? 0 : a;
    const to = i === bays - 1 ? length : b;
    if (detail >= 2) {
      fbox(out, 'stone', F, from, u - radius, base, top, -depth, 0, stone);
      fbox(out, 'stone', F, u + radius, to, base, top, -depth, 0, stone);
    } else {
      panel(out, F, 'stone', from, u - radius, base, top, 0, stone);
      panel(out, F, 'stone', u + radius, to, base, top, 0, stone);
      if (detail === 1) {
        quad4(
          out,
          'trim',
          p(u - radius, base, -depth),
          p(u - radius, base),
          p(u - radius, springY),
          p(u - radius, springY, -depth),
          rich,
        );
        quad4(
          out,
          'trim',
          p(u + radius, base),
          p(u + radius, base, -depth),
          p(u + radius, springY, -depth),
          p(u + radius, springY),
          rich,
        );
      }
    }
    const arc = roundArch(radius, seg).map(([x, y]) => [u + x, springY + y]);
    for (let j = 1; j < arc.length; j++) {
      const [x, y] = arc[j - 1],
        [X, Y] = arc[j];
      quad4(out, 'stone', p(x, y), p(X, Y), p(X, top), p(x, top), stone);
      if (detail === 3)
        quad4(
          out,
          'stone',
          p(X, Y, -depth),
          p(x, y, -depth),
          p(x, top, -depth),
          p(X, top, -depth),
          pale,
        );
      if (detail) quad4(out, 'trim', p(x, y, -depth), p(X, Y, -depth), p(X, Y), p(x, y), rich);
      if (detail >= 2)
        quad4(
          out,
          'trim',
          p(x, y, 0.15),
          p(X, Y, 0.15),
          p(X + (X - u) * 0.13, Y + 0.202, 0.15),
          p(x + (x - u) * 0.13, y + 0.202, 0.15),
          pale,
        );
    }
  }
}

function cornice(out, F, length, y, depth = 0.6) {
  for (const [a, b, extent] of [
    [0, 0.33, 0.58],
    [0.33, 0.69, 0.82],
    [0.69, 0.98, 1],
  ]) {
    fbox(out, 'trim', F, -0.39, length + 0.39, y + a, y + b, -depth * 0.47, depth * extent, pale);
  }
}

function balustrade(out, F, length, y, detail, d = 0) {
  fbox(out, 'trim', F, 0, length, y, y + 0.19, d - 0.28, d + 0.28, pale);
  fbox(out, 'trim', F, 0, length, y + 1.17, y + 1.38, d - 0.22, d + 0.25, pale);
  if (!detail) return;
  const count = Math.ceil(length / (detail === 1 ? 5.7 : detail === 2 ? 1.1 : 0.64));
  for (let i = 0; i <= count; i++) {
    const u = (length * i) / count,
      w = i % 6 === 0 ? 0.2 : 0.099;
    fbox(out, 'trim', F, u - w, u + w, y + 0.17, y + 1.17, d - 0.13, d + 0.13, stone);
  }
}

function pediment(out, F, u, w, y, h, detail) {
  const p = F.P,
    a = u - w / 2,
    b = u + w / 2;
  tri(out, 'stone', p(a, y, 0.28), p(b, y, 0.28), p(u, y + h, 0.28), stone);
  fbox(out, 'trim', F, a - 0.4, b + 0.4, y - 0.16, y + 0.108, -0.34, 0.44, pale);
  for (const x of [a, b]) beam(out, 'trim', p(x, y, 0.47), p(u, y + h, 0.47), 0.29, 0.35, pale);
  if (detail >= 2) {
    const [x, Y, z] = p(u, y + h * 0.39, 0.37);
    sphere(out, 'trim', [x, Y, z], [0.46, 0.78, 0.86], pale, 10, 6);
  }
}

function figure(out, x, z, y, h, detail, turn = 0) {
  if (detail === 0) {
    const a = [x, y, z - h * 0.23],
      b = [x, y, z + h * 0.23],
      tip = [x + 0.24, y + h, z];
    tri(out, 'trim', b, a, tip, pale);
    tri(out, 'trim', a, b, tip, pale);
    tri(out, 'trim', [x - 0.36, y, z], [x + 0.36, y, z], tip, pale);
    tri(out, 'trim', [x + 0.36, y, z], [x - 0.36, y, z], tip, pale);
    return;
  }
  const slices = detail === 0 ? 4 : detail === 1 ? 5 : 9;
  const profile =
    detail === 0
      ? [
          [0, 0.21, 0.18],
          [0.26, 0.24, 0.19],
          [0.7, 0.16, 0.13],
          [1, 0.06, 0.06],
        ]
      : [
          [0, 0.21, 0.2],
          [0.08, 0.21, 0.19],
          [0.36, 0.17, 0.124],
          [0.53, 0.17, 0.12],
          [0.7, 0.195, 0.147],
          [0.784, 0.129, 0.1],
        ];
  const rings = profile.map(([a, r, d]) =>
    radialRing(y + a * h, r * h, d * h, slices, [x + turn * a * 0.16, z], Math.PI / 4),
  );
  loft(out, 'trim', rings, pale);
  if (!detail) return;
  sphere(
    out,
    'trim',
    [x + turn * 0.13, y + h * 0.88, z],
    [h * 0.096, h * 0.133, h * 0.096],
    pale,
    detail > 1 ? 10 : 6,
    detail > 1 ? 6 : 3,
  );
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    const shoulder = [x, y + h * 0.68, z + side * h * 0.13];
    const hand = [x + 0.16, y + h * (side * turn > 0 ? 0.54 : 0.42), z + side * h * 0.26];
    beam(out, 'trim', shoulder, hand, h * 0.092, h * 0.12, pale);
  }
}

function portalWall(out, F, length, grade, detail, bays = 5, start = 0) {
  if (!detail) return;
  for (let i = 0; i < bays; i++) {
    const u = start + (length * (i + 0.5)) / bays;
    if (detail === 1) {
      panel(
        out,
        F,
        'door',
        u - (length / bays) * 0.22,
        u + (length / bays) * 0.22,
        grade + 1.3,
        grade + 6.43,
        0.05,
        door,
      );
      panel(
        out,
        F,
        'glass',
        u - (length / bays) * 0.22,
        u + (length / bays) * 0.22,
        grade + 11.67,
        grade + 17.84,
        0.06,
        gray,
      );
      continue;
    }
    opening(out, F, u, grade + 1.32, (length / bays) * 0.48, 5.18, {
      head: 'round',
      glassSlot: 'door',
      frameSlot: 'trim',
      frame: pale,
      glass: door,
      sill: false,
      frameWidth: 0.15,
      frameDepth: 0.18,
      mullions: detail === 3 ? 2 : 0,
      transoms: 0,
    });
    opening(out, F, u, grade + 11.67, (length / bays) * 0.44, 6.17, {
      head: 'round',
      glassSlot: 'glass',
      frameSlot: 'trim',
      frame: stone,
      glass: gray,
      sill: false,
      frameWidth: 0.13,
      frameDepth: 0.12,
      mullions: detail >= 2 ? 2 : 0,
      transoms: 0,
    });
  }
}

function returns(out, F, length, low, top, depth, width) {
  for (const u of [0, length - width])
    fbox(out, 'stone', F, u, u + width, low, top, -depth, 0.07, stone);
}

function mainFacade(out, detail) {
  const { faceX, halfSpan: L } = site.mainFacade;
  const F = facade([faceX, L], [0, -1]),
    len = L * 2,
    p = F.P;
  const rear = facade([faceX - 6.72, L], [0, -1]);
  fbox(out, 'stone', rear, 0, len, -2.4, 31.0, -3.05, 0, stone);
  returns(out, F, len, 0.8, 29.32, 9.45, 1.18);
  portalWall(out, rear, len, 0, detail);
  fbox(out, 'stone', F, 0, len, -2.1, 0.81, -9, 0.56, rich);
  const steps = detail ? 6 : 2;
  for (let j = 0; j < steps; j++)
    fbox(
      out,
      'trim',
      F,
      -0.69,
      len + 0.69,
      -0.3,
      0.81 * (1 - j / steps),
      0.48 + j * 0.36,
      0.85 + j * 0.36,
      stone,
    );
  arcade(out, F, detail, {
    length: len,
    bays: 5,
    base: 1.05,
    top: 10.72,
    depth: 1.22,
    radius: 4.56,
    spring: 4.64,
    edge: 1.13,
  });
  arcade(out, F, detail, {
    length: len,
    bays: 5,
    base: 11.35,
    top: 29.36,
    depth: 1.36,
    radius: 4.43,
    spring: 12.15,
    edge: 1.13,
  });
  fbox(out, 'trim', F, 0, len, 10.43, 11.33, -6.9, 0.52, pale);
  for (let i = 0; i <= 5; i++) {
    const u = 1.13 + ((len - 2.26) * i) / 5,
      [x, , z] = p(u, 0, 0.42);
    if (detail >= 2) column(out, 'stone', x, z, 1.1, 28.66, 0.9, stone, 12);
    else fbox(out, 'stone', F, u - 0.73, u + 0.73, 1.1, 28.66, -0.28, 0.77, stone);
    if (detail) {
      fbox(out, 'trim', F, u - 1.24, u + 1.24, 1.08, 4.37, -0.3, 1.09, pale);
      fbox(out, 'trim', F, u - 1.26, u + 1.26, 26.9, 28.64, -0.21, 1.13, pale);
      fbox(out, 'trim', F, u - 1.48, u + 1.48, 28.64, 29.07, -0.21, 1.37, rich);
    }
  }
  fbox(out, 'stone', F, -0.16, len + 0.16, 29.31, 32.25, -9.42, 0.24, stone);
  cornice(out, F, len, 31.67, 1.38);
  pediment(out, F, len / 2, 24.92, 32.51, 6.44, detail);
  balustrade(out, F, len, 33.11, detail, 0.05);
  const saints = Array.from({ length: 15 }, (_, i) => {
    const u = 2.37 + ((len - 4.74) * i) / 14,
      bow = 1 - Math.min(1, Math.abs(i - 7) / 4);
    return [u, 34.42 + bow * 4.13, 4.22 + bow * 1.48];
  });
  for (const [i, [u, y, h]] of saints.entries()) {
    fbox(out, 'trim', F, u - 1.12, u + 1.12, 33.24, y + 0.02, -0.79, 0.61, pale);
    const [x, , z] = p(u, y, -0.22);
    figure(out, x, z, y, h, detail, ((i % 3) - 1) * 0.81);
  }
  const [x, , z] = p(len * 0.5, 0, 0.57);
  beam(out, 'trim', [x, 41.67, z - 2.01], [x, 45.97, z - 2.01], 0.18, 0.19, pale);
  if (detail) beam(out, 'trim', [x, 44.61, z - 3.12], [x, 44.61, z - 0.72], 0.17, 0.18, pale);
}

function bellTower(out, F, u, base, detail) {
  const p = F.P,
    span = 5.93;
  fbox(out, 'stone', F, u - span / 2, u + span / 2, base, base + 4.72, -5.58, 0, stone);
  const f = facade([p(u - span / 2, 0)[0], p(u - span / 2, 0)[2]], F.along);
  for (const h of [base + 4.72, base + 9.15]) {
    arcade(out, f, detail, {
      length: span,
      bays: 3,
      base: h + 0.55,
      top: h + 3.77,
      depth: 0.61,
      radius: 0.61,
      spring: 1.63,
      edge: 0.21,
    });
    fbox(out, 'trim', f, -0.14, span + 0.14, h - 0.12, h + 0.58, -5.76, 0.26, pale);
    fbox(out, 'trim', f, -0.14, span + 0.14, h + 3.53, h + 4.19, -5.76, 0.23, pale);
    for (const a of [0, span - 0.44])
      fbox(out, 'stone', f, a, a + 0.44, h + 0.55, h + 3.55, -5.51, -0.59, stone);
    fbox(out, 'stone', f, 0, span, h + 0.55, h + 3.79, -5.58, -5.15, rich);
  }
  const y = base + 13.2,
    [x, , z] = p(u, y, -2.76);
  spire(out, 'slate', [x, z], 3.01, 4, y, 10.46, slate, { rotation: Math.PI / 4 });
  if (detail)
    sphere(
      out,
      'trim',
      [x, y + 10.75, z],
      [0.34, 0.36, 0.35],
      rich,
      detail >= 2 ? 10 : 6,
      detail >= 2 ? 6 : 3,
    );
}

function northLoggia(out, detail) {
  const { centerX, faceZ, halfSpan, piazzaHeight: y } = site.northLoggia;
  const len = halfSpan * 2,
    F = facade([centerX + halfSpan, faceZ], [-1, 0]),
    p = F.P;
  const rear = facade([centerX + halfSpan, faceZ + 5.43], [-1, 0]);
  fbox(out, 'wall', rear, 0, len, y - 0.7, y + 25.64, -4.37, 0, golden);
  returns(out, F, len, y + 0.44, y + 21.32, 6.81, 0.79);
  portalWall(out, rear, len, y - 1.05, detail);
  const floor = y + 0.44;
  fbox(out, 'stone', F, -0.12, len + 0.17, y - 0.78, floor, -7.8, 1.14, rich);
  arcade(out, F, detail, {
    length: len,
    bays: 5,
    base: floor,
    top: y + 10.11,
    depth: 0.99,
    radius: 2.11,
    spring: 6.04,
  });
  arcade(out, F, detail, {
    length: len,
    bays: 5,
    base: y + 10.89,
    top: y + 21.29,
    depth: 0.97,
    radius: 2.2,
    spring: 6.2,
  });
  fbox(out, 'trim', F, 0, len, y + 10.04, y + 10.89, -5.76, 0.46, pale);
  fbox(out, 'trim', F, 0, len, y + 21.29, y + 22.29, -6.99, 0.92, pale);
  cornice(out, F, len, y + 21.46, 0.92);
  balustrade(out, F, len, y + 22.18, detail, 0.25);
  for (const u of [4.01, len - 4.01]) bellTower(out, F, u, y + 22.04, detail);
  const upper = facade([p(0, 0, -0.91)[0], p(0, 0, -0.91)[2]], [-1, 0]);
  fbox(out, 'stone', upper, 5.0, len - 5.0, y + 21.85, y + 30.41, -5.5, -1, stone);
  pediment(out, upper, len * 0.5, 15.62, y + 23.54, 3.15, detail);
}

function shell(out, detail) {
  for (const [r, ...holes] of site.body)
    extrude(out, 'wall', r, -3.37, 11.02, golden, { holes, topSlot: 'tile', topColor: tile });
  for (const [x, X, z, Z, y, h] of [
    [-70.4, 58.9, -12.8, 12.6, 23.9, 29.8],
    [-61.5, 58.5, -23.1, -12.45, 16.4, 18.82],
    [-61.7, 58.3, 12.4, 23.32, 16.5, 18.2],
    [-49.22, -28.2, -31.5, 32.4, 24.95, 29.4],
  ]) {
    abox(out, 'wall', [x, 10.45, z], [X, y, Z], golden, { bottom: false });
    gableRoof(out, 'tile', [x, (z + Z) / 2], [X, (z + Z) / 2], Z - z, y, h, tile, {
      overhang: 0.26,
      endSlot: 'wall',
      endColor: golden,
    });
    if (detail >= 2)
      for (const normal of [-1, 1]) {
        const ring =
          normal < 0
            ? [
                [X, z],
                [x, z],
              ]
            : [
                [x, Z],
                [X, Z],
              ];
        const F = wallFace(...ring);
        const bays = Math.max(2, Math.min(10, Math.round((X - x) / 9.8)));
        for (let i = 0; i < bays; i++) {
          const u = (F.length * (i + 0.5)) / bays,
            low = Math.max(12, y - 6.06);
          if (detail === 2)
            panel(out, F, 'glass', u - 1.125, u + 1.125, low, low + 4.12, 0.047, gray);
          else
            opening(out, F, u, low, 2.25, 4.12, {
              head: 'round',
              glass: gray,
              frame: pale,
              frameWidth: 0.17,
              frameDepth: 0.15,
              mullions: detail === 3 ? 2 : 0,
            });
        }
      }
  }
  const cx = 42.46,
    cz = 35.34;
  abox(out, 'stone', [cx - 7.22, 10.17, cz - 7.21], [cx + 7.22, 17.13, cz + 7.22], rich, {
    bottom: false,
  });
  const rings = [
    [16.9, 7.11],
    [19.82, 7.06],
    [21.8, 6.7],
    [24.26, 4.5],
    [25.29, 1.52],
    [26.18, 0.47],
  ].map(([y, r]) => radialRing(y, r, r, detail ? 12 : 8, [cx, cz]));
  loft(out, 'slate', rings, slate);
}

function cloister(out, detail) {
  if (!detail) return;
  const court = outwardRing(site.courts[0]).reverse();
  for (let i = 0; i < court.length; i++) {
    const F = wallFace(court[i], court[(i + 1) % court.length]),
      span = F.length;
    arcade(out, F, detail, {
      length: span,
      bays: detail >= 2 ? 7 : 3,
      base: 3.08,
      top: 8.28,
      depth: 0.49,
      radius: detail >= 2 ? 1.11 : 2.53,
      spring: detail >= 2 ? 3.24 : 2.28,
      edge: 0.27,
    });
    fbox(out, 'trim', F, 0, span, 2.69, 3.08, -2.71, 0, rich);
    fbox(out, 'tile', F, 0, span, 8.23, 8.83, -2.92, 0.36, tile);
  }
}

function build(out, detail) {
  const mesh = local(out);
  shell(mesh, detail);
  mainFacade(mesh, detail);
  northLoggia(mesh, detail);
  cloister(mesh, detail);
}

export function buildSkyline(out) {
  const mesh = local(out);
  shell(mesh, 0);
  const { faceX, halfSpan: L } = site.mainFacade;
  const east = facade([faceX, L], [0, -1]),
    E = L * 2;
  fbox(mesh, 'stone', east, 0, E, -2.1, 0.81, -9, 0.56, rich);
  fbox(mesh, 'stone', east, 0, E, 0.8, 31.8, -8.7, -6.5, stone);
  returns(mesh, east, E, 0.8, 29.32, 9.45, 1.18);
  arcade(mesh, east, 0, {
    length: E,
    bays: 5,
    base: 1.05,
    top: 10.72,
    depth: 1.22,
    radius: 4.56,
    spring: 4.64,
    edge: 1.13,
  });
  arcade(mesh, east, 0, {
    length: E,
    bays: 5,
    base: 11.35,
    top: 29.36,
    depth: 1.36,
    radius: 4.43,
    spring: 12.15,
    edge: 1.13,
  });
  fbox(mesh, 'trim', east, 0, E, 10.71, 11.35, -7.1, 0.42, pale);
  fbox(mesh, 'trim', east, 0, E, 29.35, 33.28, -8.1, 0.91, pale);
  tri(
    mesh,
    'stone',
    east.P(E / 2 - 12.46, 32.51, 0.87),
    east.P(E / 2 + 12.46, 32.51, 0.87),
    east.P(E / 2, 38.95, 0.87),
    stone,
  );
  for (let i = 0; i < 15; i++) {
    const u = 2.37 + ((E - 4.74) * i) / 14,
      t = 1 - Math.min(1, Math.abs(i - 7) / 4);
    const [x, , z] = east.P(u, 0, -0.22);
    figure(mesh, x, z, 33.28 + t * 4.72, 5.36 + t * 1.62, 0);
  }
  const { centerX, faceZ, halfSpan, piazzaHeight: y } = site.northLoggia;
  const F = facade([centerX + halfSpan, faceZ], [-1, 0]),
    len = halfSpan * 2;
  fbox(mesh, 'stone', F, 0, len, y - 0.7, y + 25.6, -9.34, -5.4, rich);
  returns(mesh, F, len, y + 0.44, y + 21.32, 6.81, 0.79);
  fbox(mesh, 'trim', F, 0, len, y - 0.41, y + 0.48, -7.1, 0.35, pale);
  arcade(mesh, F, 0, {
    length: len,
    bays: 5,
    base: y + 0.44,
    top: y + 10.11,
    depth: 0.99,
    radius: 2.11,
    spring: 6.04,
  });
  arcade(mesh, F, 0, {
    length: len,
    bays: 5,
    base: y + 10.89,
    top: y + 21.29,
    depth: 0.97,
    radius: 2.2,
    spring: 6.2,
  });
  fbox(mesh, 'trim', F, 0, len, y + 10.11, y + 10.9, -6.4, 0.5, pale);
  fbox(mesh, 'trim', F, 0, len, y + 21.25, y + 22.32, -6.5, 0.6, pale);
  fbox(mesh, 'stone', F, 5, len - 5, y + 22.1, y + 30.41, -5.5, -0.92, stone);
  for (const u of [4.01, len - 4.01]) {
    const h = y + 35.24,
      [x, , z] = F.P(u, h, -2.76);
    fbox(mesh, 'stone', F, u - 2.97, u + 2.97, y + 22.04, h, -5.56, 0, stone);
    spire(mesh, 'slate', [x, z], 3.01, 4, h, 10.46, slate, { rotation: Math.PI / 4 });
  }
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
