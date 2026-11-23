import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap, clock } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.96 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
};
const basalt = rgb('746f6a'),
  ash = rgb('8c867d'),
  limestone = rgb('d9c8a3'),
  pale = rgb('eadbc0');
const tile = rgb('9b5f4c'),
  copper = rgb('778a79'),
  shadow = rgb('6b6153'),
  glass = rgb('4f5e61'),
  metal = rgb('51534a');
const base = site.foundationBottom,
  eave = site.eave,
  floor = 0.93,
  arcadeY = 4.2;
const front = facade(site.origin, site.along),
  r = outwardRing(site.plan);
const local = facade([0, 0], [1, 0]);

function face(out, slot, f, a, b, y0, y1, d, col) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), col);
}

function window(out, detail, f, u, y, w, h) {
  if (detail < 2) {
    if (detail > 0)
      face(out, 'limestone', f, u - w * 0.57, u + w * 0.57, y - 0.08, y + h + 0.09, 0.027, pale);
    face(out, 'glazing', f, u - w / 2, u + w / 2, y, y + h, 0.057, glass);
    return;
  }
  opening(out, f, u, y, w, h, {
    head: 'round',
    glassSlot: 'glazing',
    frameSlot: 'limestone',
    glass,
    frame: pale,
    frameWidth: 0.105,
    frameDepth: 0.112,
    d: 0.079,
    mullions: detail > 2 ? 1 : 0,
    transoms: detail > 2 ? 1 : 0,
    mullionColor: ash,
  });
}

function arcade(out, detail, f, count) {
  const l = f.length,
    spring = 2.99;
  if (detail === 0) {
    face(out, 'limestone', f, 0, l, 3.42, arcadeY, 0, pale);
    face(out, 'basalt', f, 0, l, floor, arcadeY, -2.1, shadow);
    for (let i = 0; i <= count; i++) {
      const u = (l * i) / count;
      face(
        out,
        'limestone',
        f,
        Math.max(0, u - 0.26),
        Math.min(l, u + 0.26),
        floor,
        3.42,
        0.012,
        limestone,
      );
    }
    return;
  }
  const pitch = l / count,
    gap = pitch / 2 - 0.42;
  const curve = roundArch(gap, [0, 4, 7, 9][detail]);
  const riseScale = Math.min(0.57, (arcadeY - spring - 0.11) / gap);
  const z = 0,
    p = f.P;
  for (let i = 0; i < count; i++) {
    const a = i * pitch,
      u = a + pitch / 2,
      b = a + pitch;
    face(out, 'basalt', f, a, u - gap, floor, arcadeY, z, basalt);
    face(out, 'basalt', f, u + gap, b, floor, arcadeY, z, basalt);
    for (let j = 1; j < curve.length; j++) {
      const [x, h] = curve[j - 1],
        [v, k] = curve[j];
      const s = spring + h * riseScale,
        t = spring + k * riseScale;
      quad4(
        out,
        'limestone',
        p(u + x, s, z),
        p(u + v, t, z),
        p(u + v, arcadeY, z),
        p(u + x, arcadeY, z),
        pale,
      );
      if (detail > 1)
        quad4(
          out,
          'limestone',
          p(u + x, s, -0.57),
          p(u + v, t, -0.57),
          p(u + v, t, z),
          p(u + x, s, z),
          limestone,
        );
    }
    const back = facade(
      [f.origin[0] - f.normal[0] * 2.1, f.origin[1] - f.normal[1] * 2.1],
      f.along,
    );
    face(out, 'basalt', f, a, b, floor, arcadeY, -2.1, shadow);
    window(out, detail, back, u, floor, 1.24, 2.62);
    if (detail > 1) {
      for (const x of [a + 0.21, b - 0.2])
        for (const [k, h] of [1.06, 1.74, 2.38].entries())
          fbox(
            out,
            'limestone',
            f,
            x - 0.25,
            x + 0.25,
            h,
            h + 0.29,
            -0.08,
            0.091,
            k % 2 ? pale : limestone,
          );
    }
  }
}

function halls(out, detail) {
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]),
      n = f.length;
    if (n < 0.04) continue;
    face(out, 'plinth', f, 0, n, base, floor, 0, ash);
    const arcadeFace = f.normal[1] > 0.78 && n > 7.2;
    const count = Math.max(1, Math.round(n / (detail === 0 ? 7.8 : 4.65)));
    if (arcadeFace) arcade(out, detail, f, count);
    else face(out, 'basalt', f, 0, n, floor, arcadeY, 0, basalt);
    face(out, 'basalt', f, 0, n, arcadeY, eave, 0, basalt);
    face(out, 'limestone', f, 0, n, arcadeY - 0.12, arcadeY + 0.14, 0.025, pale);
    face(out, 'limestone', f, 0, n, eave - 0.35, eave, 0.021, limestone);
    if (n < 1.83 || (detail === 0 && !arcadeFace)) continue;
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * n) / count;
      window(out, detail, f, u, 4.89, Math.min((n / count) * 0.69, 2.23), 2.47);
      if (detail > 1 && !arcadeFace)
        window(out, detail, f, u, floor + 0.2, Math.min((n / count) * 0.59, 1.78), 2.35);
    }
  }
  cap(out, 'tile', r, eave, tile);
  for (const [a, b, depth, width, ridge] of [
    [0.15, 36.91, 4.85, 9.53, 12.8],
    [37.17, 75.2, 8.31, 16.43, 13.61],
    [86.79, 121.82, 8.69, 17.16, 13.96],
  ]) {
    gableRoof(out, 'tile', [a, depth], [b, depth], width, eave, ridge, tile, {
      overhang: 0.07,
      endSlot: 'basalt',
      endColor: basalt,
    });
    if (detail > 1)
      for (let u = a + 7.4; u < b - 2.6; u += 10.23) {
        const f = facade([u, depth + width * 0.4], [1, 0]);
        fbox(out, 'limestone', f, -0.74, 0.74, eave + 0.1, eave + 1.97, -1.31, 0.13, limestone);
        tri(
          out,
          'limestone',
          f.P(-0.83, eave + 1.9, 0.16),
          f.P(0.83, eave + 1.9, 0.16),
          f.P(0, eave + 2.52, 0.16),
          pale,
        );
        face(out, 'glazing', f, -0.38, 0.38, eave + 0.62, eave + 1.67, 0.154, glass);
      }
  }
}

function central(out, detail) {
  const f = facade([75.285, 23.5], [1, 0]),
    L = 11.36,
    m = L / 2;
  const p = f.P;
  face(out, 'basalt', f, 0, L, eave, 12.69, -0.015, basalt);
  for (const [y, h] of [
    [8.23, 0.28],
    [9.43, 0.23],
    [11.64, 0.26],
    [12.53, 0.35],
  ])
    fbox(out, 'limestone', f, -0.09, L + 0.09, y, y + h, -0.16, 0.29, pale);
  gableRoof(out, 'tile', [81, 6.78], [81, 23.52], 10.93, 12.67, 16.69, tile, {
    overhang: 0.11,
    endSlot: 'basalt',
    endColor: basalt,
  });
  const a = p(-0.17, 12.61, 0.35),
    b = p(L + 0.17, 12.61, 0.35),
    c = p(m, 16.79, 0.35);
  tri(out, 'limestone', a, b, c, limestone);
  tri(out, 'basalt', p(0.56, 13.01, 0.382), p(L - 0.56, 13.01, 0.382), p(m, 16.26, 0.382), basalt);
  const width = 2.1;
  fbox(out, 'limestone', f, m - width / 2, m + width / 2, 14.24, 16.58, 0.39, 0.52, limestone);
  const bez = p(m, 16.65, 0.35);
  beam(out, 'metal', bez, [bez[0], bez[1] + 1.42, bez[2]], 0.07, 0.07, metal);
  for (const u of [0.18, L - 0.18]) {
    fbox(out, 'limestone', f, u - 0.29, u + 0.29, 9.79, 14.44, -0.14, 0.37, pale);
    if (detail > 0) {
      const point = p(u, 14.44, 0.12);
      loft(
        out,
        'limestone',
        [
          radialRing(14.44, 0.37, 0.37, 6, [point[0], point[2]]),
          radialRing(15.21, 0.021, 0.021, 6, [point[0], point[2]]),
        ],
        pale,
        { cap: false },
      );
    }
  }
  if (detail > 0) window(out, detail, f, m, 9.61, 3.38, 1.7);
  const steps = detail === 0 ? 2 : 5;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    fbox(
      out,
      'plinth',
      f,
      0.59,
      L - 0.59,
      base - 0.07,
      floor * (1 - t),
      2.17 * t,
      (2.17 * (i + 1)) / steps,
      ash,
    );
  }
}

function northTurret(out, detail) {
  const x = 3.56,
    d = 5.52,
    n = [7, 11, 17, 22][detail],
    radius = 3.44;
  loft(
    out,
    'basalt',
    [radialRing(base, radius, radius, n, [x, d]), radialRing(11.68, radius, radius, n, [x, d])],
    basalt,
  );
  loft(
    out,
    'limestone',
    [radialRing(10.79, 3.53, 3.53, n, [x, d]), radialRing(11.68, 3.53, 3.53, n, [x, d])],
    limestone,
  );
  loft(
    out,
    'tile',
    [radialRing(11.66, 3.57, 3.57, n, [x, d]), radialRing(17.66, 0.047, 0.047, n, [x, d])],
    tile,
  );
}

function clockTower(out, detail) {
  const x = site.tower.along,
    d = 11.91,
    stem = 24.64,
    lantern = 29.7;
  const shape = [
    [x - 4.15, d - 4.12],
    [x - 4.15, d + 4.12],
    [x + 4.15, d + 4.12],
    [x + 4.15, d - 4.12],
  ];
  for (const [i, a] of shape.entries()) {
    const f = wallFace(a, shape[(i + 1) % shape.length]),
      L = f.length,
      p = f.P,
      u = L / 2;
    face(out, 'basalt', f, 0, L, base, stem, 0, basalt);
    face(out, 'basalt', f, 0, L, stem, lantern, -0.14, shadow);
    for (const [y, h] of [
      [8.19, 0.36],
      [16.31, 0.21],
      [22.56, 0.29],
      [24.28, 0.6],
      [29.27, 0.62],
    ]) {
      if (detail === 0) face(out, 'limestone', f, 0, L, y, y + h, 0.038, pale);
      else fbox(out, 'limestone', f, -0.11, L + 0.11, y, y + h, -0.27, 0.27, pale);
    }
    const count = detail === 0 ? 2 : 3;
    for (let j = 0; j <= count; j++) {
      const a = (j * L) / count;
      if (detail === 0)
        face(out, 'limestone', f, a - 0.25, a + 0.26, stem, lantern, 0.031, limestone);
      else fbox(out, 'limestone', f, a - 0.225, a + 0.241, stem, lantern, -0.12, 0.19, limestone);
    }
    if (detail === 0) {
      fan(
        out,
        'limestone',
        Array.from({ length: 10 }, (_, j) => {
          const a = (j * Math.PI) / 5;
          return p(u + 1.14 * Math.cos(a), 18.84 + 1.14 * Math.sin(a), 0.09);
        }),
        limestone,
      );
    } else {
      clock(out, f, u, 18.84, 1.08, detail, 0.11);
      for (let j = 0; j < 3; j++)
        window(out, detail, f, ((j + 0.5) * L) / 3, stem + 0.66, 1.32, 3.08);
    }
    if (detail > 1)
      for (const h of [
        2.0, 3.17, 4.44, 5.68, 6.84, 9.36, 10.56, 11.79, 12.97, 14.16, 15.25, 17.35, 19.48, 21.05,
        23.19,
      ]) {
        for (const a of [0.17, L - 0.17])
          face(out, 'limestone', f, a - 0.33, a + 0.33, h, h + 0.55, 0.067, pale);
      }
  }
  cap(out, 'limestone', shape, lantern, limestone);
  const n = [8, 12, 17, 25][detail];
  const stages = [
    [lantern - 0.05, 1.78],
    [31.62, 1.78],
    [32.02, 1.87],
    [32.49, 1.57],
    [33.55, 1.43],
    [34.19, 1.02],
    [34.46, 0.46],
  ];
  loft(
    out,
    'copper',
    stages.map(([y, r]) => radialRing(y, r, r, n, [x, d])),
    copper,
  );
  beam(out, 'metal', [x, 34.44, d], [x, site.tower.height, d], 0.077, 0.076, metal);
}

function platformCanopy(out, detail) {
  if (detail === 0) return;
  const f = local;
  const slope = (x, z) => [x, 4.62 + 0.158 * z, z];
  const a = 5.08,
    b = 115.65;
  quad4(out, 'copper', slope(a, -3.25), slope(a, 0.05), slope(b, 0.05), slope(b, -3.25), copper);
  const n = [0, 9, 14, 21][detail];
  for (let i = 0; i < n; i++) {
    const u = a + ((b - a) * (i + 0.5)) / n;
    fbox(out, 'metal', f, u - 0.066, u + 0.066, base, 4.14, -2.89, -2.72, metal);
    if (detail > 1)
      beam(out, 'metal', f.P(u, 4.08, -2.76), f.P(u, 4.53, -0.11), 0.044, 0.051, metal);
  }
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => front.P(u, y, d));
  halls(local, detail);
  central(local, detail);
  northTurret(local, detail);
  clockTower(local, detail);
  platformCanopy(local, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
