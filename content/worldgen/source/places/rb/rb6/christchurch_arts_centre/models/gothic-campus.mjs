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
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap, clock } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.94 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  slab: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5 },
};
const basalt = rgb('848584'),
  basaltWarm = rgb('8c847c'),
  ash = rgb('797d7e');
const limestone = rgb('d3c6a8'),
  pale = rgb('e2d8c0'),
  mortar = rgb('aba292');
const slate = rgb('63707a'),
  agedSlate = rgb('697076'),
  metal = rgb('424945'),
  glass = rgb('4c595e');
const base = site.foundationBottom;

function face(out, slot, f, a, b, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}
function bounds(r) {
  return [0, 1].map((i) => [Math.min(...r.map((p) => p[i])), Math.max(...r.map((p) => p[i]))]);
}
function simplification(r, detail) {
  if (detail > 0) return r;
  return r.filter((a, i) => {
    const b = r[(i + 1) % r.length],
      c = r[(i + r.length - 1) % r.length];
    const dx = b[0] - c[0],
      dz = b[1] - c[1],
      l = Math.hypot(dx, dz);
    return (
      Math.abs(dx * (a[1] - c[1]) - dz * (a[0] - c[0])) / l > 0.43 &&
      Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.64
    );
  });
}
function masonry(out, ring, lo, hi, color) {
  const r = outwardRing(ring);
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length > 0.012) face(out, 'basalt', f, 0, f.length, lo, hi, 0, color);
  }
}

function window(out, detail, f, u, y, w, h, arched = false) {
  if (detail === 3 && arched) {
    opening(out, f, u, y, w, h, {
      head: 'pointed',
      rise: w * 0.63,
      glassSlot: 'glazing',
      frameSlot: 'limestone',
      glass,
      frame: limestone,
      frameWidth: 0.122,
      frameDepth: 0.108,
      d: 0.053,
      mullions: 1,
      transoms: 1,
      mullionColor: mortar,
    });
    return;
  }
  if (detail > 1)
    face(
      out,
      'limestone',
      f,
      u - w / 2 - 0.105,
      u + w / 2 + 0.105,
      y - 0.1,
      y + h + 0.11,
      0.022,
      pale,
    );
  face(out, 'glazing', f, u - w / 2, u + w / 2, y, y + h, 0.051, glass);
  if (detail > 1) face(out, 'limestone', f, u - 0.038, u + 0.038, y, y + h, 0.064, mortar);
}

function hall(out, detail, { id, outline, eave }) {
  const r = outwardRing(simplification(outline, detail));
  const workshop = id === 943051727 || id === 32050470;
  const elevated = id === 1322162312 || id === 1329582134;
  const y0 = elevated ? 3.31 : base;
  masonry(out, r, y0, eave, workshop ? basaltWarm : basalt);
  if (detail === 0) return;
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length < (detail === 1 ? 3.8 : 2.35)) continue;
    face(out, 'limestone', f, 0, f.length, eave - 0.38, eave - 0.12, 0.017, limestone);
    if (!elevated && detail > 1) face(out, 'slab', f, 0, f.length, base, 0.63, 0.012, ash);
    const bays = Math.max(1, Math.round(f.length / [7.8, 8.85, 4.2, 3.65][detail]));
    const width = f.length / bays;
    for (let j = 0; j < bays; j++) {
      const u = (j + 0.5) * width;
      if (eave > 7.5)
        window(
          out,
          detail,
          f,
          u,
          eave - 4.12,
          Math.min(1.76, width * 0.56),
          2.9,
          !workshop && i % 3 === 0,
        );
      if (!elevated)
        window(
          out,
          detail,
          f,
          u,
          1.32,
          Math.min(1.74, width * 0.56),
          eave > 7.5 ? 2.89 : 2.42,
          !workshop && i % 3 === 0,
        );
      if (detail > 1 && id === 1349907117 && j % 2 === 0) {
        const [a, b] = [u - width * 0.5, u - width * 0.5 + 0.32];
        fbox(out, 'limestone', f, a, b, base, eave - 0.78, -0.17, 0.43, mortar);
      }
    }
  }
}

function roof(out, detail, { eave, roofRise, axis, low, high, parts }) {
  const mid = (low + high) / 2,
    radius = (high - low) / 2;
  if (radius < 0.055) return;
  const y = (v) => eave + roofRise * Math.max(0, 1 - Math.abs(v - mid) / radius);
  const plane = deform(out, ([x, _y, z]) => [x, y(axis === 0 ? x : z), z]);
  for (const part of parts) {
    const r = outwardRing(simplification(part, detail));
    if (r.length < 3) continue;
    cap(plane, 'roof', r, eave, axis === 0 ? slate : agedSlate);
    for (const [i, a] of r.entries()) {
      const b = r[(i + 1) % r.length];
      if (Math.abs(a[axis] - mid) < 0.001 && Math.abs(b[axis] - mid) < 0.001) continue;
      const highA = y(a[axis]),
        highB = y(b[axis]);
      const A = [a[0], eave, a[1]],
        B = [b[0], eave, b[1]],
        C = [b[0], highB, b[1]],
        D = [a[0], highA, a[1]];
      if (highA - eave > 0.002 && highB - eave > 0.002) quad4(out, 'basalt', A, B, C, D, basalt);
      else if (highA - eave > 0.002) tri(out, 'basalt', A, B, D, basalt);
      else if (highB - eave > 0.002) tri(out, 'basalt', A, B, C, basalt);
    }
  }
}

function arcade(out, detail, f, y, ends) {
  for (let i = 1; i < ends.length; i++) {
    const a = ends[i - 1],
      b = ends[i],
      center = (a + b) / 2,
      r = (b - a) / 2 - 0.232;
    if (r < 0.11) continue;
    const spring = 2.41,
      curve = pointedArch(r, r * 1.028, [2, 2, 4, 6][detail]);
    const p = f.P;
    for (let j = 1; j < curve.length; j++) {
      const [px, py] = curve[j - 1],
        [qx, qy] = curve[j];
      const A = p(center + px, spring + py, 0.1),
        B = p(center + qx, spring + qy, 0.1);
      quad4(out, 'basalt', A, B, p(center + qx, y, 0.1), p(center + px, y, 0.1), ash);
      if (detail > 0) {
        quad4(
          out,
          'limestone',
          A,
          B,
          p(center + qx * 1.08, spring + 0.08 + qy * 1.05, 0.119),
          p(center + px * 1.08, spring + 0.08 + py * 1.05, 0.119),
          pale,
        );
        quad4(
          out,
          'limestone',
          p(center + px, spring + py, -0.23),
          p(center + qx, spring + qy, -0.23),
          B,
          A,
          limestone,
        );
      }
    }
  }
}

function cloister(out, detail, { outline, columns }) {
  const y = 4.38;
  cap(out, 'roof', outline, y, slate);
  const [[x, X], [z, Z]] = bounds(outline);
  for (const side of [0, 1]) {
    const front = side === 0 ? z : Z,
      delta = side === 0 ? -0.06 : 0.07;
    const f = side === 0 ? facade([X, front - delta], [-1, 0]) : facade([x, front - delta], [1, 0]);
    if (detail === 0) {
      face(out, 'basalt', f, 0, X - x, 3.04, y, 0, ash);
      continue;
    }
    const col = columns.filter(({ center }) =>
      side === 0 ? center[1] < (z + Z) / 2 : center[1] > (z + Z) / 2,
    );
    const centers = col
      .map(({ center }) => (side === 0 ? X - center[0] : center[0] - x))
      .sort((a, b) => a - b);
    arcade(out, detail, f, y, [0.12, ...centers, X - x - 0.12]);
    for (const u of [0.12, X - x - 0.12])
      fbox(out, 'limestone', f, u - 0.145, u + 0.145, base, y, -0.21, 0.08, mortar);
  }
  for (const {
    center: [x, z],
  } of columns) {
    const bands =
      detail < 2
        ? [
            [base, 0.228],
            [2.55, 0.228],
          ]
        : [
            [base, 0.28],
            [0.24, 0.28],
            [0.36, 0.192],
            [2.1, 0.192],
            [2.34, 0.32],
            [2.55, 0.32],
          ];
    loft(
      out,
      'limestone',
      bands.map(([y, r]) => radialRing(y, r, r, [5, 6, 8, 11][detail], [x, z])),
      limestone,
      { cap: false },
    );
  }
}

function porch(out, detail) {
  const f = facade([3.72, -43.83], [-1, 0]);
  const u = -3.48;
  const arch = pointedArch(1.64, 1.76, detail < 2 ? 4 : 7);
  const p = f.P;
  for (let i = 1; i < arch.length; i++) {
    const [a, y] = arch[i - 1],
      [b, h] = arch[i];
    quad4(
      out,
      'limestone',
      p(u + a, 2.6 + y, 0.17),
      p(u + b, 2.6 + h, 0.17),
      p(u + b * 1.16, 2.72 + h * 1.1, 0.18),
      p(u + a * 1.16, 2.72 + y * 1.1, 0.18),
      pale,
    );
  }
  for (const s of [-1, 1])
    fbox(
      out,
      'limestone',
      f,
      u + s * 1.64 - 0.09,
      u + s * 1.64 + 0.09,
      0,
      2.68,
      0.014,
      0.22,
      limestone,
    );
  window(out, detail, f, u, 0.18, 3.1, 4.25, true);
}

function clockTower(out, detail) {
  const r = site.clock;
  masonry(out, r, base, 16.85, basalt);
  const north = wallFace(r[4], r[0]);
  const F = north.normal[1] < 0 ? north : wallFace(r[0], r[4]);
  const mid = F.length / 2;
  const p = F.P;
  const eave = 16.85,
    ridge = site.clockPeak;
  const [x, , z] = p(mid, 0);
  gableRoof(out, 'roof', [x, z], [x, site.clock[3][1]], F.length, eave, ridge, slate, {
    overhang: 0.12,
    endSlot: 'basalt',
    endColor: basalt,
  });
  const top = p(mid, ridge + 0.06, -0.14);
  beam(out, 'metal', top, [top[0], top[1] + 0.91, top[2]], 0.08, 0.074, metal);
  beam(
    out,
    'metal',
    [top[0] - 0.3, top[1] + 0.6, top[2]],
    [top[0] + 0.3, top[1] + 0.6, top[2]],
    0.067,
    0.067,
    metal,
  );
  for (const u of [0.13, F.length - 0.13])
    fbox(out, 'limestone', F, u - 0.14, u + 0.15, base, eave, -0.18, 0.15, limestone);
  for (const h of [4.36, 8.31, 12.38, 16.72]) {
    if (detail === 0) face(out, 'limestone', F, 0, F.length, h, h + 0.15, 0.09, limestone);
    else fbox(out, 'limestone', F, -0.09, F.length + 0.09, h, h + 0.15, -0.07, 0.24, limestone);
  }
  fbox(out, 'limestone', F, mid - 1.29, mid + 1.29, 10.41, 15.94, -0.1, 0.22, pale);
  if (detail === 0) {
    fan(
      out,
      'glazing',
      Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5;
        return p(mid + 0.97 * Math.cos(a), 11.88 + 0.97 * Math.sin(a), 0.245);
      }),
      metal,
    );
  } else clock(out, F, mid, 11.88, 0.97, detail, 0.244);
  opening(out, facade([p(0, 0, 0.23)[0], p(0, 0, 0.23)[2]], F.along), mid, 13.32, 1.88, 2.4, {
    head: 'round',
    glassSlot: 'glazing',
    frameSlot: 'limestone',
    glass: metal,
    frame: pale,
    frameWidth: detail > 0 ? 0.12 : 0,
    sill: false,
    d: 0.039,
  });
  if (detail > 1) {
    for (let j = 0; j < 7; j++) {
      const y = 13.48 + j * 0.19;
      fbox(out, 'metal', F, mid - 0.76, mid + 0.76, y, y + 0.04, 0.26, 0.31, ash);
    }
    for (const s of [-1, 1])
      beam(
        out,
        'limestone',
        p(mid + s * F.length * 0.5, 16.73, 0.14),
        p(mid, ridge - 0.13, 0.14),
        0.15,
        0.14,
        pale,
      );
  }
  if (detail > 0) {
    fbox(out, 'limestone', F, mid - 1.13, mid + 1.13, 6.62, 9.66, -0.07, 0.15, limestone);
    window(out, detail, F, mid - 0.62, 1.7, 0.83, 2.13, true);
    window(out, detail, F, mid + 0.62, 1.7, 0.83, 2.13, true);
    if (detail > 1) {
      const plate = [
        p(mid - 0.57, 8.84, 0.223),
        p(mid + 0.57, 8.84, 0.223),
        p(mid + 0.51, 7.82, 0.223),
        p(mid, 7.4, 0.226),
        p(mid - 0.51, 7.82, 0.223),
      ];
      for (const [i, a] of plate.entries())
        beam(out, 'limestone', a, plate[(i + 1) % plate.length], 0.067, 0.061, mortar);
    }
  }
}

function hallGable(out, detail) {
  const f = facade([-21.81, -37.62], [0, 1]);
  const u = 6.4;
  window(out, detail, f, u, 4.47, 4.13, 6.06, true);
  if (detail > 1) {
    for (const s of [-1, 0, 1])
      fbox(
        out,
        'limestone',
        f,
        u + s * 0.84 - 0.063,
        u + s * 0.84 + 0.063,
        4.54,
        9.09,
        0.06,
        0.125,
        pale,
      );
    for (const x of [u - 2.55, u + 2.55])
      fbox(out, 'basalt', f, x - 0.24, x + 0.24, 0.01, 10.12, -0.11, 0.74, basalt);
  }
  const r = site.turret;
  const [[l, rMax], [z, Z]] = bounds(r),
    x = (l + rMax) / 2,
    c = (z + Z) / 2;
  const n = [7, 11, 17, 23][detail];
  const round = (y, r) => radialRing(y, r, r, n, [x, c]);
  loft(out, 'basalt', [round(base, 1.7), round(11.36, 1.7)], basalt);
  loft(out, 'roof', [round(11.36, 1.84), round(14.04, 0.028)], slate);
}

function build(out, detail) {
  for (const h of site.halls) {
    hall(out, detail, h);
    if (detail === 0) cap(out, 'roof', simplification(h.outline, detail), h.eave, slate);
  }
  for (const [i, r] of site.roofs.entries()) {
    if (detail > 0 || [0, 4, site.roofs.length - 1].includes(i)) roof(out, detail, r);
  }
  for (const c of site.cloisters) cloister(out, detail, c);
  hallGable(out, detail);
  if (detail > 0) porch(out, detail);
  clockTower(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
