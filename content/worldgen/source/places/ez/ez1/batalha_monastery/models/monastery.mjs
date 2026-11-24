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
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  ribbon,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.96 },
  darkStone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96 },
  flat: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74 },
};
const stone = rgb('bfb5a3');
const pale = rgb('d2c7ae');
const dark = rgb('8c887b');
const baseStone = rgb('b9a181');
const roof = rgb('b3a691');
const clay = rgb('9b6248');
const glass = rgb('535952');
const oldWood = rgb('614848');
const below = -2.9;
const angle = (site.planAngleDegrees * Math.PI) / 180;
const [church, founder, unfinished] = site.parts.map((part) => part.ring);
const [royalCourt, afonsoCourt, chapelCourt] = site.courts.map((c) => c.ring);
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const edges = (ring) => ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
const stub = (x, z, rad) => [
  [x - rad, z - rad],
  [x + rad, z + rad],
];

function capAdapter(out) {
  const m = transform(out, -angle);
  m.addCap = (slot, ref, ring, holes, y, normal, uv, color) => {
    const temp = new MeshBufferBuilder();
    if (!temp.addCap('wall', ref, ring, holes, y, normal, uv, color)) return false;
    const { positions, indices } = temp.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      m.addTriangle(
        slot,
        ref,
        p,
        normal,
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
  return m;
}

function panel(out, slot, f, a, b, y, h, d, tint) {
  const p = f.P;
  quad4(out, slot, p(a, y, d), p(b, y, d), p(b, h, d), p(a, h, d), tint);
}

function window(out, f, u, y, w, h, detail, options = {}) {
  const { door = false, mullions = 1, round = false, depth = 0.1 } = options;
  if (detail === 1) {
    panel(
      out,
      door ? 'wood' : 'glass',
      f,
      u - w * 0.43,
      u + w * 0.43,
      y,
      y + h * 0.89,
      depth,
      door ? oldWood : glass,
    );
    return;
  }
  if (detail === 2) {
    const p = f.P,
      slot = door ? 'wood' : 'glass',
      tint = door ? oldWood : glass;
    const rise = w * (round ? 0.5 : 0.58),
      spring = y + h - rise;
    const inner = round ? roundArch(w * 0.5, 4) : pointedArch(w * 0.5, rise, 3);
    const outer = round
      ? roundArch(w * 0.5 + 0.12, 4)
      : pointedArch(w * 0.5 + 0.12, rise + 0.13, 3);
    panel(out, slot, f, u - w * 0.5, u + w * 0.5, y, spring, depth, tint);
    for (const s of [-1, 1]) {
      const side = u + s * w * 0.5;
      panel(out, 'trim', f, side - 0.09, side + 0.09, y, spring + 0.03, depth + 0.06, pale);
    }
    for (let i = 1; i < inner.length; i++) {
      const [x, z] = inner[i - 1],
        [X, Z] = inner[i];
      tri(
        out,
        slot,
        p(u, spring, depth),
        p(u + X, spring + Z, depth),
        p(u + x, spring + z, depth),
        tint,
      );
      quad4(
        out,
        'trim',
        p(u + x, spring + z, depth + 0.06),
        p(u + X, spring + Z, depth + 0.06),
        p(u + outer[i][0], spring + outer[i][1], depth + 0.06),
        p(u + outer[i - 1][0], spring + outer[i - 1][1], depth + 0.06),
        pale,
      );
    }
    for (let i = 1; !door && i <= mullions; i++) {
      const x = u - w * 0.5 + (w * i) / (mullions + 1);
      panel(out, 'trim', f, x - 0.062, x + 0.062, y, spring, depth + 0.067, pale);
    }
    return;
  }
  opening(out, f, u, y, w, h, {
    head: round ? 'round' : 'pointed',
    rise: w * 0.58,
    frameSlot: 'trim',
    frame: pale,
    frameWidth: detail === 3 ? 0.155 : 0.105,
    frameDepth: depth + 0.11,
    glassSlot: door ? 'wood' : 'glass',
    glass: door ? oldWood : glass,
    mullions: door ? 0 : mullions,
    sill: !door,
    d: depth,
  });
}

function rosette(out, face, u, y, radius, detail, depth = 0.173) {
  const p = face.P,
    n = detail === 3 ? 16 : 8;
  const ring = (t) => p(u + Math.cos(t) * radius, y + Math.sin(t) * radius, depth);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    quad4(
      out,
      'trim',
      ring(a),
      ring(b),
      p(u + Math.cos(b) * radius * 0.77, y + Math.sin(b) * radius * 0.77, depth + 0.012),
      p(u + Math.cos(a) * radius * 0.77, y + Math.sin(a) * radius * 0.77, depth + 0.012),
      pale,
    );
    if (detail === 3 && i % 2 === 0)
      tri(out, 'trim', p(u, y, depth + 0.01), ring(a), ring(a + 0.092), pale);
  }
}

function finial(out, x, z, y, h, width, detail) {
  if (!detail) {
    loft(
      out,
      'trim',
      [
        [0, 0.61],
        [1, 0.053],
      ].map(([t, r]) => radialRing(y + h * t, width * r, width * r, 4, [x, z], Math.PI / 4)),
      pale,
    );
    return;
  }
  const [a, b] = stub(x, z, width * 0.56);
  abox(out, 'stone', [a[0], y, a[1]], [b[0], y + h * 0.42, b[1]], stone, { bottom: false });
  const radii =
    detail === 3
      ? [
          [0.39, 0.62],
          [0.48, 0.7],
          [0.53, 0.52],
          [0.71, 0.38],
          [0.81, 0.34],
          [0.94, 0.17],
          [1, 0.05],
        ]
      : [
          [0.42, 0.59],
          [0.75, 0.3],
          [1, 0.06],
        ];
  loft(
    out,
    'trim',
    radii.map(([t, r]) =>
      radialRing(y + h * t, width * r, width * r, detail === 3 ? 8 : 4, [x, z], Math.PI / 4),
    ),
    pale,
  );
  if (detail === 3)
    for (const [hRatio, r] of [
      [0.62, 0.49],
      [0.74, 0.36],
      [0.85, 0.28],
    ]) {
      for (const s of [-1, 1])
        beam(
          out,
          'trim',
          [x + width * r * s, y + h * hRatio, z],
          [x + width * r * 1.18 * s, y + h * (hRatio + 0.055), z],
          0.12,
          0.16,
          pale,
        );
    }
}

function buttress(out, a, b, w, detail) {
  const count = [1, 1, 3, 10][detail];
  const position = (t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 1.15,
    a[2] + (b[2] - a[2]) * t,
  ];
  for (let i = 0; i < count; i++)
    beam(out, 'stone', position(i / count), position((i + 1) / count), w, w * 0.85, stone);
}

function railing(out, f, y, detail) {
  if (!detail) return;
  const l = f.length,
    p = f.P;
  if (detail === 1) {
    fbox(out, 'trim', f, 0, l, y, y + 0.67, -0.34, 0.12, pale);
    return;
  }
  fbox(out, 'trim', f, 0, l, y, y + 0.18, -0.37, 0.16, pale);
  fbox(out, 'trim', f, 0, l, y + 0.72, y + 0.87, -0.34, 0.11, pale);
  const count = Math.max(1, Math.round(l / (detail === 3 ? 1.16 : 2.05)));
  const step = l / count;
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * step;
    panel(out, 'trim', f, u - 0.095, u + 0.095, y + 0.15, y + 0.74, 0.072, pale);
    if (detail === 3) {
      const r = step * 0.405,
        mid = y + 0.465;
      const d = [
        [u - r, mid],
        [u, mid - 0.25],
        [u + r, mid],
        [u, mid + 0.25],
      ];
      for (let j = 0; j < 4; j++) {
        const [a, b] = d[j],
          [A, B] = d[(j + 1) % 4];
        quad4(
          out,
          'trim',
          p(a, b - 0.045, 0.076),
          p(A, B - 0.045, 0.076),
          p(A, B + 0.045, 0.076),
          p(a, b + 0.045, 0.076),
          pale,
        );
      }
    }
  }
}

function churchBody(out, detail) {
  extrude(out, 'stone', cleanRing(church), below, 18.45, stone, {
    topSlot: 'flat',
    topColor: roof,
  });
  const nave = rect(-10.16, 48.99, 34.22, 47.53);
  extrude(out, 'stone', nave, 17.81, 31.45, stone, { topSlot: 'flat', topColor: roof });
  const crossing = rect(48.05, 60.51, 22.26, 59.79);
  extrude(out, 'stone', crossing, 17.93, 29.44, stone, { topSlot: 'flat', topColor: roof });
  const choir = rect(58.14, 69.47, 35.53, 46.42);
  extrude(out, 'stone', choir, 17.92, 26.29, stone, { topSlot: 'flat', topColor: roof });
  const screen = facade([-10.22, 40.875], [0, 1]);
  fbox(out, 'stone', screen, -6.88, 6.88, -0.16, 33.92, -0.26, 0.92, stone);
  const westernBays = [28.65, 34.1, 47.53, 53.19];
  for (const [i, z] of westernBays.entries()) {
    const tall = i === 1 || i === 2;
    const height = tall ? 32.4 : 24.4;
    abox(out, 'darkStone', [-11.58, below, z - 0.75], [-9.4, height, z + 0.75], dark, {
      bottom: false,
    });
    finial(out, -10.26, z, height - 0.4, tall ? 7.39 : 6.84, 1.55, detail);
    if (detail)
      for (const y of [7.91, 16.21, 23.98])
        abox(out, 'trim', [-11.9, y, z - 0.95], [-9.27, y + 0.22, z + 0.95], pale, {
          bottom: false,
        });
  }
  for (const s of [-1, 1])
    buttress(
      out,
      [-10.29, 19.35, 40.875 + s * 12.03],
      [-10.29, 30.4, 40.875 + s * 6.6],
      0.94,
      detail,
    );
  for (const x of detail ? [17.5, 26.71, 36.17, 44.79] : [20.5, 39.91])
    for (const s of [-1, 1]) {
      const z = s < 0 ? 28.26 : 53.36;
      abox(out, 'stone', [x - 0.55, below, z - 0.67], [x + 0.55, 20.99, z + 0.67], stone, {
        bottom: false,
      });
      finial(out, x, z, 20.41, 4.77, 1.13, detail);
      buttress(out, [x, 18.38, z - s * 0.33], [x, 28.78, s < 0 ? 34.81 : 47.02], 0.89, detail);
    }
  if (!detail) return;
  if (detail >= 2)
    ribbon(out, 'stone', cleanRing(church), -0.1, 4.37, baseStone, {
      inset: 0,
      minLength: 1.98,
      offset: 0.027,
    });
  railing(out, wallFace([-11.18, 34.05], [-11.18, 47.68]), 33.91, detail);
  railing(out, wallFace([-10.16, 47.56], [48.99, 47.56]), 31.45, detail);
  railing(out, wallFace([60.48, 22.24], [48.05, 22.24]), 29.43, detail);
  const westPortal = facade([-11.19, 40.875], [0, 1]);
  window(out, westPortal, 0, 0.13, 6.22, 12.37, detail, { door: true });
  window(out, westPortal, 0, 17.24, 5.07, 11.71, detail, { mullions: 2 });
  for (const z of [-9.14, 9.13])
    window(out, screen, z, 9.55, 3.11, 11.49, detail, { depth: 0.17, mullions: 2 });
  if (detail >= 2) {
    const p = westPortal.P,
      count = detail === 3 ? 5 : 3,
      steps = detail === 3 ? 8 : 5;
    rosette(out, westPortal, 0, 24.26, 1.5, detail);
    for (let i = 0; i < count; i++) {
      const w = 3.12 + i * 0.292,
        spring = 7.43,
        rise = 4.98 + i * 0.382,
        d = 0.19 + i * 0.13;
      const a = pointedArch(w, rise, steps),
        b = pointedArch(w + 0.14, rise + 0.14, steps);
      for (let j = 1; j < a.length; j++)
        quad4(
          out,
          'trim',
          p(a[j - 1][0], spring + a[j - 1][1], d),
          p(a[j][0], spring + a[j][1], d),
          p(b[j][0], spring + b[j][1], d),
          p(b[j - 1][0], spring + b[j - 1][1], d),
          i % 2 ? stone : pale,
        );
      for (const s of [-1, 1]) {
        const u = s * w;
        fbox(out, 'trim', westPortal, u - 0.082, u + 0.082, 0.47, spring, 0.044, d + 0.11, pale);
      }
    }
    fbox(out, 'trim', westPortal, -6.25, 6.25, 16.05, 16.43, -0.31, 0.48, pale);
    for (let i = -6; i <= 6; i++) {
      const u = i * 0.91;
      panel(out, 'darkStone', westPortal, u - 0.27, u + 0.27, 13.87, 15.97, 0.105, dark);
      if (detail === 3)
        fbox(out, 'trim', westPortal, u - 0.125, u + 0.125, 14.03, 15.64, 0.04, 0.21, pale);
    }
  }
  for (const s of [-1, 1]) {
    const upper = facade([0, s < 0 ? 34.17 : 47.59], [s, 0]);
    const lower = facade([0, s < 0 ? 28.16 : 53.43], [s, 0]);
    for (const x of [4.4, 13.2, 22.21, 31.34, 40.14]) {
      window(out, upper, x * s, 22.06, 3.2, 7.05, detail, { mullions: 2 });
      if ((s < 0 && x >= 40) || (s > 0 && x < 16.0)) continue;
      window(out, lower, x * s, 6.22, 3.83, 9.44, detail, { mullions: 2 });
    }
  }
  for (const f of edges(outwardRing(cleanRing(church)))) {
    if (f.origin[0] > 47.1 && f.normal[0] > 0.17 && f.length > 4.1)
      window(out, f, f.length * 0.5, 7.1, Math.min(3.09, f.length * 0.58), 8.84, detail);
  }
  for (const [z, s] of [
    [59.88, 1],
    [22.18, -1],
  ]) {
    const f = facade([54.2, z], [s, 0]);
    window(out, f, 0, 12.7, 5.03, 12.13, detail, { mullions: 2 });
    if (detail >= 2) rosette(out, f, 0, 21.14, 1.42, detail);
  }
}

function founderChapel(out, detail) {
  extrude(out, 'stone', founder, below, 18.31, stone, { topSlot: 'flat', topColor: roof });
  const center = [1.92, 64.25],
    ring = radialRing(19, 7.62, 7.62, 8, center, Math.PI / 8).map(([x, , z]) => [x, z]);
  extrude(out, 'stone', ring, 17.97, 23.97, stone, { topSlot: 'flat', topColor: roof });
  if (detail >= 2)
    ribbon(out, 'stone', founder, -0.15, 4.28, baseStone, {
      inset: 0,
      minLength: 2,
      offset: 0.032,
    });
  for (const [x, z] of detail ? founder : founder.slice(1, 3)) {
    abox(out, 'stone', [x - 0.67, below, z - 0.67], [x + 0.67, 18.52, z + 0.67], stone, {
      bottom: false,
    });
    finial(out, x, z, 18.17, 5.04, 1.17, detail);
  }
  for (const f of edges(outwardRing(founder))) {
    if (f.normal[1] < -0.6) continue;
    const n = f.normal[0] < -0.5 || f.length > 22.5 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * f.length) / n;
      if (detail) window(out, f, u, 6.21, n === 3 ? 3.35 : 4.21, 9.87, detail, { mullions: 2 });
      if (detail >= 2 && i > 0) {
        const v = (i * f.length) / n;
        fbox(out, 'stone', f, v - 0.38, v + 0.38, -0.2, 18.31, -0.3, 1.01, stone);
        const [x, , z] = f.P(v, 0, 0.44);
        finial(out, x, z, 18.09, 4.4, 1.11, detail);
      }
    }
    railing(out, f, 18.28, detail);
  }
  for (const f of edges(outwardRing(ring))) {
    if (detail) window(out, f, f.length * 0.5, 19.42, 2.78, 3.71, detail, { mullions: 2 });
    railing(out, f, 23.94, detail);
  }
}

function unfinishedChapels(out, detail) {
  const center = [96.48, 39.83],
    inner = cleanRing(chapelCourt);
  const shell = cleanRing(unfinished);
  extrude(out, 'stone', shell, below, 22.13, stone, {
    holes: [inner],
    topSlot: 'flat',
    topColor: dark,
  });
  if (detail >= 2)
    ribbon(out, 'stone', shell, -0.13, 3.77, baseStone, {
      inset: 0,
      minLength: 2.4,
      offset: 0.025,
    });
  const outer = outwardRing(shell),
    innerFacing = outwardRing(inner).reverse();
  const features = outer.filter(([x], i) => x > 84 && (detail || i % 3 === 0));
  for (const [i, point] of features.entries()) {
    if (detail === 1 && i % 2 === 1) continue;
    const dx = point[0] - center[0],
      dz = point[1] - center[1],
      length = Math.hypot(dx, dz);
    const [x, z] = [point[0] - (dx / length) * 0.53, point[1] - (dz / length) * 0.53];
    const h = i % 2 === 0 ? 28.7 : 25.61,
      width = i % 2 === 0 ? 1.46 : 1.02;
    abox(out, 'darkStone', [x - width, below, z - width], [x + width, 22.43, z + width], dark, {
      bottom: false,
    });
    if (i % 2 === 0) {
      const levels =
        detail >= 2
          ? [
              [22.12, width],
              [23.23, width * 1.06],
              [23.53, width],
              [h, width * 0.89],
            ]
          : [
              [22.13, width],
              [h, width * 0.93],
            ];
      loft(
        out,
        'darkStone',
        levels.map(([y, r]) => radialRing(y, r, r, detail === 3 ? 10 : 6, [x, z], Math.PI / 6)),
        dark,
      );
    } else finial(out, x, z, 21.83, h - 21.83, width, detail);
    if (detail)
      for (const y of [6.07, 13.16, 19.87])
        abox(
          out,
          'trim',
          [x - width - 0.08, y, z - width - 0.08],
          [x + width + 0.08, y + 0.19, z + width + 0.08],
          pale,
          { bottom: false },
        );
  }
  if (!detail) return;
  for (const f of edges(outer)) {
    if (f.origin[0] < 84 || f.length < 3.8) continue;
    window(out, f, f.length * 0.5, 5.07, Math.min(3.61, f.length * 0.58), 13.05, detail, {
      mullions: 2,
    });
    railing(out, f, 22.1, detail);
  }
  for (const [i, f] of edges(innerFacing).entries()) {
    if (i % 2 === 1 || detail < 2) continue;
    window(out, f, f.length * 0.5, 4.73, 1.16, 12.65, detail);
  }
}

function courtyardArcade(out, f, upper, round, detail) {
  const p = f.P,
    n = Math.max(1, Math.round(f.length / (round ? 5.2 : 6.15))),
    width = f.length / n;
  const step = round ? 2.92 : 3.09,
    rise = round ? width * 0.31 : 1.94;
  const top = upper;
  const clearance = width * (round ? 0.31 : 0.396);
  const inset = width * 0.5 - clearance;
  fbox(out, 'stone', f, 0, inset, below, top, -0.77, 0.01, stone);
  for (let i = 0; i < n; i++) {
    const a = i * width,
      b = (i + 1) * width,
      center = (a + b) * 0.5;
    const ring = round
      ? roundArch(clearance, detail === 3 ? 10 : detail === 2 ? 4 : 2)
      : pointedArch(clearance, rise, detail === 3 ? 6 : detail === 2 ? 2 : 1);
    fbox(out, 'stone', f, b - inset, Math.min(b + inset, f.length), below, top, -0.77, 0.01, stone);
    for (let j = 1; j < ring.length; j++) {
      const [v, h] = ring[j - 1],
        [V, H] = ring[j];
      const l = center + v,
        r = center + V,
        y = step + h,
        Y = step + H;
      quad4(
        out,
        'stone',
        p(l, y, 0.012),
        p(r, Y, 0.012),
        p(r, top, 0.012),
        p(l, top, 0.012),
        stone,
      );
      quad4(
        out,
        'stone',
        p(r, Y, -0.77),
        p(l, y, -0.77),
        p(l, top, -0.77),
        p(r, top, -0.77),
        stone,
      );
      quad4(out, 'trim', p(l, y, -0.77), p(r, Y, -0.77), p(r, Y, 0.012), p(l, y, 0.012), pale);
      if (detail === 3)
        quad4(
          out,
          'trim',
          p(l, y, 0.061),
          p(r, Y, 0.061),
          p(r, Y + 0.165, 0.061),
          p(l, y + 0.165, 0.061),
          pale,
        );
    }
    if (detail === 3 && !round && i % 3 !== 1) {
      const radius = Math.min(clearance * 0.28, 0.55),
        y = step + rise * 0.44;
      fbox(
        out,
        'stone',
        f,
        center - clearance,
        center + clearance,
        -0.24,
        0.84,
        -0.48,
        0.06,
        stone,
      );
      fbox(out, 'trim', f, center - clearance, center + clearance, 0.81, 1.03, -0.55, 0.14, pale);
      for (const s of [-1, 1])
        fbox(
          out,
          'trim',
          f,
          center + s * radius - 0.054,
          center + s * radius + 0.054,
          1.01,
          y,
          -0.01,
          0.168,
          pale,
        );
      fbox(
        out,
        'trim',
        f,
        center - 0.057,
        center + 0.057,
        y + radius - 0.08,
        step + rise + 0.041,
        -0.01,
        0.179,
        pale,
      );
      rosette(out, f, center, y, radius, detail, 0.162);
    }
  }
}

function onFace(point, wall) {
  const [x, z] = point,
    [a, b] = wall.origin;
  const d = (x - a) * wall.normal[0] + (z - b) * wall.normal[1];
  const u = (x - a) * wall.along[0] + (z - b) * wall.along[1];
  return Math.abs(d) < 0.021 && u >= -0.016 && u <= wall.length + 0.016;
}

function cloisters(out, detail) {
  const interior = [
    ...edges(outwardRing(cleanRing(royalCourt)).reverse()).map((f) => ({ f, round: false })),
    ...edges(outwardRing(cleanRing(afonsoCourt)).reverse()).map((f) => ({ f, round: true })),
  ];
  for (const s of site.wingSections) {
    const [ring, ...holes] = s.rings;
    const shell = outwardRing(cleanRing(ring));
    const inner = holes.map((r) => outwardRing(cleanRing(r)).reverse());
    for (const f of [...edges(shell), ...inner.flatMap(edges)]) {
      const edge = f.P(f.length, 0),
        end = [edge[0], edge[2]];
      const court = interior.find(({ f: wall }) => onFace(f.origin, wall) && onFace(end, wall));
      if (court && detail && f.length > 3.8) courtyardArcade(out, f, s.eave, court.round, detail);
      else panel(out, 'stone', f, 0, f.length, below, s.eave, 0, stone);
      if (detail && !court && f.length > 10.5) {
        const count = Math.floor(f.length / 6.5);
        for (let i = 0; i < count; i++)
          window(out, f, (f.length * (i + 0.5)) / count, s.eave - 4.42, 1.33, 2.74, detail, {
            round: s.name === 'afonso',
          });
      }
    }
    if (
      !out.addCap(
        s.name === 'afonso' ? 'tile' : 'flat',
        'palette:#ffffff',
        shell,
        inner,
        () => s.eave,
        [0, 1, 0],
        (p) => p,
        s.name === 'afonso' ? clay : roof,
      )
    )
      throw Error('Unable to cap ' + s.name);
  }
  // The short eaves over the four Afonso V galleries remain outside the open court.
  for (const [a, b, w] of [
    [[-20.78, -84.08], [44.53, -84.08], 10.06],
    [[-20.75, -44.73], [44.53, -44.73], 5.01],
    [[-12.51, -79.79], [-12.51, -47.37], 16.04],
    [[36.91, -79.8], [36.91, -47.31], 14.83],
  ])
    gableRoof(out, 'tile', a, b, w, 10.42, 12.89, clay, {
      overhang: 0.17,
      endSlot: 'stone',
      endColor: stone,
      ends: [true, true],
    });

  const spire = [43.89, 24.39],
    rings = (y, r, n) => radialRing(y, r, r, n, spire, Math.PI / 4);
  extrude(
    out,
    'stone',
    rings(9, 2.61, 8).map(([x, , z]) => [x, z]),
    below,
    23.12,
    stone,
  );
  const n = detail === 3 ? 12 : detail ? 8 : 4;
  loft(
    out,
    'trim',
    [
      [22.76, 2.76],
      [24.03, 2.61],
      [26.09, 1.9],
      [33.1, 0.91],
      [38.53, 0.11],
    ].map(([y, r]) => rings(y, r, n)),
    pale,
  );
  if (detail)
    for (const f of edges(outwardRing(rings(0, 2.61, 8).map(([x, , z]) => [x, z]))))
      window(out, f, f.length * 0.5, 17.09, 1.01, 5.44, detail);
}

function build(out, detail) {
  const m = capAdapter(out);
  churchBody(m, detail);
  founderChapel(m, detail);
  unfinishedChapels(m, detail);
  cloisters(m, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
