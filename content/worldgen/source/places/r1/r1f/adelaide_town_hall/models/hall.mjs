import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { column } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  archOver,
  cap,
  clock,
  cornice,
  edges,
  glass,
  mortar,
  sandstone,
  surfaces,
  trim,
  weatheredRoof,
} from '../../adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces };

const floor = 4.77,
  eave = 14.88;
const [x, z] = site.tower.reduce((p, q) => p.map((v, i) => v + q[i] / site.tower.length), [0, 0]);
const entrance = wallFace(site.outline[4], site.outline[5]);
const brass = rgb('a48c66');
const square = (y, s = 1) =>
  edges(site.tower).map(({ origin: [a, b] }) => [x + s * (a - x), y, z + s * (b - z)]);
const octagon = (y, r) => radialRing(y, r, r, 8, [x, z], Math.PI / 8 + 0.055);
const belt = (out, rings, color = trim) => loft(out, 'sandstone', rings, color);

function openBay(out, face, radius, base, spring, top, detail, section = 0.48) {
  const u = face.length / 2;
  fbox(out, 'sandstone', face, 0, u - radius, base, top, -section, 0, sandstone);
  fbox(out, 'sandstone', face, u + radius, face.length, base, top, -section, 0, sandstone);
  archOver(out, face, u, radius, spring, top, section, detail);
}

function frontPortico(out, detail) {
  const f = entrance,
    u = f.length / 2;
  const radius = 1.53;
  fbox(out, 'sandstone', f, 0, f.length, floor - 0.03, eave, -0.47, 0, sandstone);
  if (detail === 0) {
    fbox(out, 'ashlar', f, 0, f.length, -0.29, floor, -0.61, 0, mortar);
    return;
  }
  openBay(out, f, radius, -0.3, 3.04, floor, detail, 0.74);
  fbox(out, 'glazing', f, u - radius, u + radius, 0.03, 4.55, -2.37, -2.29, glass);
  fbox(out, 'ashlar', f, u - radius, u + radius, -0.26, 0.065, -2.36, 0.42, mortar);
  fbox(out, 'ashlar', f, -0.16, f.length + 0.16, floor - 0.1, floor + 0.33, -0.08, 0.79, mortar);
  for (const t of [0.12, 0.88]) {
    const [cx, , cz] = f.P(f.length * t, 0, 0.52);
    column(out, 'sandstone', cx, cz, 5.22, 12.78, 0.31, trim, [0, 6, 10, 14][detail]);
  }
  opening(out, f, u, 5.3, 2.27, 6.32, {
    head: 'round',
    glassSlot: 'glazing',
    frameSlot: 'sandstone',
    glass,
    frame: trim,
    frameWidth: 0.16,
    frameDepth: 0.18,
    mullions: detail >= 2 ? 1 : 0,
  });
  cornice(out, f, 0, f.length, 13.76, 0.34, 0.38, detail);
}

function castBelfry(out, radius, base, top, detail, lower) {
  const bottom = octagon(base, radius),
    roof = octagon(top, radius);
  const ring = bottom.map(([x, , z]) => [x, z]);
  if (detail < 2) {
    belt(out, [bottom, roof], sandstone);
    if (detail === 1)
      for (const f of edges(ring)) {
        opening(out, f, f.length * 0.5, base + 0.42, f.length * 0.54, top - base - 0.83, {
          head: 'round',
          d: 0.041,
          glassSlot: 'glazing',
          glass,
          sill: false,
          frameWidth: 0,
        });
      }
    return;
  }
  for (const f of edges(ring)) {
    const u = f.length / 2;
    const archRadius = f.length * (lower ? 0.33 : 0.29);
    const windowY = base + 0.42;
    fbox(out, 'sandstone', f, 0, f.length, base, windowY, -0.46, 0, sandstone);
    openBay(out, f, archRadius, windowY, top - archRadius - 0.43, top, detail, 0.44);
    if (lower) {
      fbox(
        out,
        'sandstone',
        f,
        u - 0.065,
        u + 0.065,
        windowY,
        top - archRadius - 0.43,
        -0.43,
        0.027,
        trim,
      );
      for (let i = 1; i <= 3; i++) {
        const y = base + i * 0.88;
        fbox(
          out,
          'metal',
          f,
          u - archRadius + 0.03,
          u + archRadius - 0.03,
          y,
          y + 0.1,
          -0.42,
          -0.21,
          glass,
        );
      }
    }
    if (detail >= 2) {
      const [cx, , cz] = f.P(0.21, 0, 0.065);
      column(out, 'sandstone', cx, cz, base + 0.22, top - 0.07, 0.142, trim, detail === 3 ? 10 : 7);
    }
  }
}

function albertTower(out, detail) {
  belt(out, [square(eave - 0.2, 1.035), square(15.57, 1.035), square(15.89, 1)], sandstone);
  belt(out, [square(15.8), square(20.13), square(20.5, 1.08), square(20.77, 1.08)], sandstone);
  belt(
    out,
    [square(20.74, 0.98), square(24.63, 0.98), square(24.93, 1.045), square(25.18, 1.045)],
    sandstone,
  );
  if (detail > 0)
    for (const f of edges(site.tower)) clock(out, f, f.length / 2, 22.88, 1.12, detail, 0.29);
  belt(out, [octagon(25.15, 3.39), octagon(25.55, 3.49), octagon(25.88, 3.28)]);
  castBelfry(out, 3.2, 25.86, 32.07, detail, true);
  belt(out, [
    octagon(32.05, 3.28),
    octagon(32.26, 3.47),
    octagon(32.56, 3.46),
    octagon(32.91, 3.08),
  ]);
  castBelfry(out, 2.96, 32.89, 37.34, detail, false);
  belt(out, [
    octagon(37.33, 3.03),
    octagon(37.55, 3.16),
    octagon(37.79, 3.15),
    octagon(37.97, 2.86),
  ]);
  loft(
    out,
    'roof',
    [
      [37.95, 2.79],
      [38.52, 2.62],
      [39.66, 2.1],
      [40.79, 1.19],
      [41.53, 0.68],
    ].map(([y, r]) => octagon(y, r)),
    brass,
  );
  belt(
    out,
    [
      octagon(41.52, 0.72),
      octagon(41.72, 0.76),
      octagon(42.72, 0.76),
      octagon(42.94, 0.82),
      octagon(43.16, 0.68),
    ],
    sandstone,
  );
  loft(
    out,
    'metal',
    [
      [43.12, 0.68],
      [43.48, 0.43],
      [43.65, 0.23],
      [43.71, 0.14],
    ].map(([y, r]) => octagon(y, r)),
    brass,
  );
  beam(out, 'metal', [x, 43.66, z], [x, 44.0, z], 0.058, 0.058, brass);
  if (detail >= 2)
    beam(out, 'metal', [x - 0.46, 43.9, z], [x + 0.46, 43.9, z], 0.046, 0.037, brass);
}

function civicFacade(out, face, detail) {
  fbox(out, 'sandstone', face, 0, face.length, -0.73, eave, -0.45, 0, sandstone);
  cornice(out, face, 0, face.length, eave - 0.42, 0.4, 0.36, detail);
  if (detail === 0) return;
  cornice(out, face, 0, face.length, floor - 0.16, 0.28, 0.25, detail);
  cornice(out, face, 0, face.length, 9.7, 0.21, 0.17, detail);
  if (detail >= 2) {
    for (const y of [0.34, 0.91, 1.5, 2.09, 2.68, 3.27, 3.86, 4.45])
      fbox(
        out,
        'ashlar',
        face,
        0,
        face.length,
        y,
        y + 0.41,
        -0.023,
        0.101,
        y > 0.7 ? sandstone : mortar,
      );
  } else fbox(out, 'ashlar', face, 0, face.length, 0.2, floor - 0.21, 0.0, 0.101, mortar);
  const n = Math.max(1, Math.round(face.length / 3.08)),
    w = face.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * w;
    const wi = Math.min(1.31, w * 0.51);
    const window = {
      glassSlot: 'glazing',
      frameSlot: 'sandstone',
      glass,
      frame: trim,
      frameWidth: detail === 3 ? 0.13 : 0,
      frameDepth: 0.19,
      d: 0.122,
      sill: detail === 3,
      transoms: detail === 3 ? 1 : 0,
    };
    opening(out, face, u, 0.7, wi, 2.82, { ...window, head: detail === 1 ? 'flat' : 'round' });
    opening(out, face, u, 5.51, wi, 2.88, window);
    opening(out, face, u, 10.34, wi, 2.65, window);
    if (detail >= 2) {
      const p = face.P,
        a = wi * 0.63;
      tri(
        out,
        'sandstone',
        p(u - a, 13.12, 0.206),
        p(u + a, 13.12, 0.206),
        p(u, 13.48, 0.206),
        trim,
      );
      fbox(out, 'sandstone', face, u - a, u + a, 13.03, 13.14, 0.031, 0.242, mortar);
      fbox(out, 'sandstone', face, u - a, u + a, 8.48, 8.67, 0.015, 0.215, trim);
    }
  }
  fbox(out, 'sandstone', face, -0.1, face.length + 0.1, eave + 0.42, eave + 0.6, -0.07, 0.18, trim);
  if (detail >= 2)
    for (let x = 0.33; x < face.length - 0.23; x += detail === 3 ? 0.51 : 0.86) {
      fbox(
        out,
        'sandstone',
        face,
        x - 0.075,
        x + 0.075,
        eave - 0.005,
        eave + 0.44,
        0.002,
        0.129,
        sandstone,
      );
    }
  else fbox(out, 'sandstone', face, 0, face.length, eave, eave + 0.47, -0.05, 0.12, sandstone);
}

function build(out, detail) {
  for (const f of edges(site.outline)) {
    if (f.origin === entrance.origin) continue;
    civicFacade(out, f, detail);
  }
  cap(out, 'roof', site.outline, eave, weatheredRoof);
  frontPortico(out, detail);
  albertTower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
