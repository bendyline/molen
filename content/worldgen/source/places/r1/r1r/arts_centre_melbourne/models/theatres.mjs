import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.93 },
  siding: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.83 },
  white: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  mesh: {
    slot: 'trim',
    graph: 'metal_bronze_cast',
    roughness: 0.88,
    doubleSided: true,
  },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const ivory = rgb('dadad6'),
  grey = rgb('a8a29a'),
  slate = rgb('7c7b79');
const paving = rgb('898782'),
  baseStone = rgb('9b9692'),
  glass = rgb('474d50');
const gold = rgb('a48f69'),
  lightGold = rgb('b09d74'),
  charcoal = rgb('545351');
const {
  center: [cx, cz],
  phase,
  height,
} = site.spire;
const ring = outwardRing(site.outline);
const tau = 2 * Math.PI;
const angleOf = ([x, z]) => Math.atan2(z - cz, x - cx) - phase;
const ripple = (a) => (1 + Math.cos(4 * a)) * 0.5;
const roofY = (point) => site.roofHeight - 2.38 + 2.38 * ripple(angleOf(point));

function theatres(out, detail) {
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      face = wallFace(a, b);
    const { P, length: L } = face;
    const strip = (slot, y0, y1, tint, d = 0) =>
      quad4(out, slot, P(0, y0, d), P(L, y0, d), P(L, y1, d), P(0, y1, d), tint);
    strip('concrete', site.foundationBottom, detail === 0 ? 4.61 : 4.1, baseStone);
    if (detail > 0) strip('concrete', 3.77, 4.61, grey, 0.083);
    strip('glass', 4.61, 6.56, glass, -0.035);
    quad4(out, 'siding', P(0, 6.56), P(L, 6.56), P(L, roofY(b)), P(0, roofY(a)), slate);
    tri(out, 'siding', [cx, 15.11, cz], [a[0], roofY(a), a[1]], [b[0], roofY(b), b[1]], slate);
    if (detail > 0) {
      strip('siding', 6.49, 6.72, slate, 0.025);
      const bays = Math.round(L / [6, 4.75, 2.55, 2.2][detail]);
      for (let j = 1; j <= bays; j++) {
        const u = (L * (j - 0.5)) / bays;
        if (detail > 1)
          fbox(out, 'white', face, u - 0.037, u + 0.037, 4.61, 6.53, -0.027, 0.036, grey);
        else
          quad4(
            out,
            'white',
            P(u - 0.045, 4.61, 0.024),
            P(u + 0.045, 4.61, 0.024),
            P(u + 0.045, 6.53, 0.024),
            P(u - 0.045, 6.53, 0.024),
            grey,
          );
      }
    }
  }
  const s = site.stairs;
  const north = wallFace(s.to, s.from),
    levels = detail === 0 ? 3 : 9;
  for (let i = 0; i < levels; i++) {
    const y = s.topGrade + ((s.lowGrade - s.topGrade) * i) / levels;
    const d = (i * s.projection) / levels;
    fbox(
      out,
      'concrete',
      north,
      0,
      north.length,
      site.foundationBottom,
      y,
      d - 0.15,
      d + s.projection / levels,
      paving,
    );
  }
  if (detail > 1)
    for (const u of [0.55, north.length - 0.55]) {
      const P = north.P;
      beam(
        out,
        'white',
        P(u, s.topGrade + 0.86, 0),
        P(u, s.lowGrade + 0.92, s.projection),
        0.047,
        0.047,
        grey,
      );
      for (let i = 0; i < 4; i++) {
        const t = i / 3,
          d = t * s.projection,
          y = (1 - t) * s.topGrade + t * s.lowGrade;
        beam(out, 'white', P(u, y + 0.04, d), P(u, y + 0.87, d), 0.045, 0.045, grey);
      }
    }
}

function polar(a, y, r) {
  return [cx + r * Math.cos(a + phase), y, cz + r * Math.sin(a + phase)];
}

function edgeDistance(angle) {
  const dx = Math.cos(angle + phase),
    dz = Math.sin(angle + phase);
  let shortest = Infinity;
  for (const [i, [ax, az]] of ring.entries()) {
    const [bx, bz] = ring[(i + 1) % ring.length],
      ex = bx - ax,
      ez = bz - az;
    const det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-6) continue;
    const x = ax - cx,
      z = az - cz;
    const t = (x * ez - z * ex) / det,
      u = (x * dz - z * dx) / det;
    if (t > 0 && u >= -0.00001 && u <= 1.00001) shortest = Math.min(t, shortest);
  }
  return shortest;
}

function meshStrip(out, a, b, center, width, color) {
  const [dx, dy, dz] = b.map((v, i) => v - a[i]);
  const [nx, ny, nz] = a.map((v, i) => (v + b[i]) / 2 - center[i]);
  const n = [dy * nz - dz * ny, dz * nx - dx * nz, dx * ny - dy * nx];
  const len = Math.hypot(...n);
  if (len < 1e-5) return;
  const shift = (p, k) => p.map((v, i) => v + (k * n[i] * width) / (2 * len));
  quad4(out, 'mesh', shift(a, 1), shift(b, 1), shift(b, -1), shift(a, -1), color);
}

function nets(out, detail) {
  const spokes = [12, 32, 52, 68][detail];
  const rows = [2, 5, 8, 12][detail];
  const draw = (a, b, c, w, k) => {
    if (detail < 3) meshStrip(out, a, b, c, w, k);
    else beam(out, 'mesh', a, b, w, w * 0.68, k);
  };
  const points = Array.from({ length: spokes }, (_, i) => {
    const a = (tau * i) / spokes,
      rim = edgeDistance(a),
      wave = ripple(a);
    return Array.from({ length: rows + 1 }, (_, j) => {
      const s = j / rows,
        inv = 1 - s;
      const r = 3.84 + (rim + 1.45 + 2.9 * wave) * Math.pow(inv, 1.22);
      const y = 13.22 + 3.07 * wave + 28.78 * s * s + 4.15 * Math.sin(s * Math.PI) * (1 - wave);
      return polar(a, y, r);
    });
  });
  const base = [cx, 12, cz];
  for (let i = 0; i < spokes; i++) {
    const p = points[i],
      q = points[(i + 1) % spokes];
    for (let j = 0; j < rows; j++) {
      const width = detail === 0 ? 0.142 : detail === 1 ? 0.113 : 0.068;
      draw(p[j], q[j], base, width, gold);
      draw(p[j], p[j + 1], base, width, lightGold);
      if (detail > 0)
        draw(
          j % 2 === 0 ? p[j] : q[j],
          j % 2 === 0 ? q[j + 1] : p[j + 1],
          base,
          width * 0.85,
          gold,
        );
    }
    draw(p[rows], q[rows], base, 0.15, lightGold);
  }
}

const profiles = [
  [12.4, 22.3],
  [17.5, 18.1],
  [22.4, 14.2],
  [29.5, 10.7],
  [37, 8.05],
  [44.2, 5.7],
  [57.4, 4.3],
  [71.72, 3.33],
  [91.1, 2.62],
  [112.37, 1.97],
  [133.53, 1.33],
  [146.74, 0.8],
  [151.92, 0.395],
];
function radiusAt(y) {
  const k = profiles.findIndex(([h]) => h >= y);
  const [b, r1] = profiles[k],
    [a, r0] = profiles[Math.max(0, k - 1)];
  return a === b ? r1 : r0 + ((r1 - r0) * (y - a)) / (b - a);
}

function spire(out, detail) {
  const count = 4;
  const turns = (i, r, y) => polar((i * tau) / count, y, r);
  const sections =
    detail === 0 ? profiles.filter((_, i) => [0, 3, 5, 7, 9, 12].includes(i)) : profiles;
  for (let i = 0; i < count; i++) {
    const ease = detail === 0 ? 0.32 : 0.245,
      angle = (i * tau) / count;
    const startRadius = Math.min(profiles[0][1], edgeDistance(angle) * 0.938);
    const rib = sections.map(([y, r], j) => turns(i, j === 0 ? startRadius : r, y));
    beamPath(out, 'white', rib, ease, ease, ivory);
  }
  const intervals = [6, 15, 26, 40][detail];
  for (let j = 0; j <= intervals; j++) {
    const y = 23.2 + (j * (150.82 - 23.2)) / intervals,
      r = radiusAt(y);
    const next = Math.min(151.64, y + (150.82 - 23.2) / intervals);
    for (let i = 0; i < count; i++) {
      if (detail > 0 || j % 2 === 0)
        beam(
          out,
          'white',
          turns(i, r, y),
          turns(i + 1, r, y),
          detail === 0 ? 0.15 : 0.096,
          0.098,
          ivory,
        );
      if (j === intervals || (detail === 0 && j % 2 !== 0)) continue;
      const upper = radiusAt(next),
        a = j % 2 === 0 ? i : i + 1,
        b = j % 2 === 0 ? i + 1 : i;
      beam(
        out,
        'white',
        turns(a, r, y),
        turns(b, upper, next),
        detail === 0 ? 0.17 : 0.102,
        0.102,
        ivory,
      );
      if (detail > 1 && j < intervals * 0.65 && j % 2 === 0)
        beam(out, 'white', turns(b, r, y), turns(a, upper, next), 0.078, 0.081, grey);
    }
  }
  const y0 = 151.82;
  const rings = [
    [y0, 0.31],
    [153.08, 0.24],
    [157.3, 0.112],
    [height, 0.024],
  ].map(([y, r]) => radialRing(y, r, r, 6, [cx, cz]));
  loft(out, 'white', rings, charcoal);
}
function build(out, detail) {
  theatres(out, detail);
  nets(out, detail);
  spire(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
