import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap, clock } from '../../../r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.77 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55 },
};
const sandstone = rgb('dab789'),
  molding = rgb('e0c199'),
  shade = rgb('b9986d');
const clay = rgb('9b6757'),
  stoneBase = rgb('8e8d82'),
  glass = rgb('58605a');
const iron = rgb('535646'),
  verdigris = rgb('7e8977'),
  tin = rgb('9b9683');
const { outline } = site;
const {
  buildingHeight,
  foundationBottom,
  clockTip,
  domeCenter,
  domeRadius,
  domeTop,
  flagTip,
  portalIndices,
} = site.portal;
const front = wallFace(...portalIndices.map((i) => outline[i]));
const longWall = wallFace(outline[24], outline[21]);
const entry = front.length / 2;

function face(out, slot, f, a, b, low, high, depth, color) {
  const p = f.P;
  quad4(out, slot, p(a, low, depth), p(b, low, depth), p(b, high, depth), p(a, high, depth), color);
}

function horizontal(out, f, lo, hi, y, width, projection, color = molding) {
  fbox(out, 'stone', f, lo, hi, y, y + width, -0.06, projection, color);
}

function clockFace(out, f, u, y, r, detail, depth) {
  if (detail > 1) {
    clock(out, f, u, y, r, detail, depth);
    return;
  }
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return f.P(u + r * Math.cos(a), y + r * Math.sin(a), depth);
  });
  fan(out, 'glazing', points, molding);
  face(out, 'metal', f, u - 0.067, u + 0.067, y - 0.15, y + r * 0.72, depth + 0.019, iron);
  face(out, 'metal', f, u - 0.05, u + r * 0.46, y - 0.055, y + 0.052, depth + 0.023, iron);
}

function window(out, detail, f, u, low, width, height, head = 'round') {
  if (detail < 2) {
    face(
      out,
      'stone',
      f,
      u - width * 0.6,
      u + width * 0.6,
      low - 0.16,
      low + height + 0.14,
      0.026,
      molding,
    );
    face(out, 'glazing', f, u - width / 2, u + width / 2, low, low + height, 0.049, glass);
    return;
  }
  if (detail === 2 && head === 'round') {
    const spring = low + height - width / 2;
    const arch = (radius) => [
      [-radius, low],
      [radius, low],
      ...roundArch(radius, 5)
        .reverse()
        .map(([x, y]) => [x, y + spring]),
    ];
    fan(
      out,
      'stone',
      arch(width * 0.6).map(([x, y]) => f.P(x + u, y - 0.018, 0.075)),
      molding,
    );
    fan(
      out,
      'glazing',
      arch(width * 0.5).map(([x, y]) => f.P(x + u, y, 0.103)),
      glass,
    );
    fbox(out, 'metal', f, u - 0.048, u + 0.048, low, spring + 0.29, 0.1, 0.16, iron);
    return;
  }
  opening(out, f, u, low, width, height, {
    head,
    glassSlot: 'glazing',
    frameSlot: 'stone',
    glass,
    frame: molding,
    frameWidth: 0.179,
    frameDepth: 0.18,
    d: 0.058,
    mullions: 1,
    transoms: detail === 3 ? 2 : 1,
    mullionColor: iron,
  });
}

function buildingWalls(out, detail) {
  const ring = outwardRing(outline);
  const portalPoints = new Set(outline.slice(26, 31));
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    if (portalPoints.has(a) && portalPoints.has(b)) continue;
    const f = wallFace(a, b),
      l = f.length;
    if (l < 0.018) continue;
    face(out, 'base', f, 0, l, foundationBottom, 1.45, 0, stoneBase);
    face(out, 'brick', f, 0, l, 1.45, buildingHeight, 0, clay);
    const bands =
      detail === 0
        ? [
            [1.44, 0.73],
            [11.78, 0.56],
            [19.44, 0.61],
          ]
        : [
            [1.44, 0.73],
            [6.89, 0.32],
            [11.78, 0.56],
            [16.62, 0.5],
            [19.44, 0.61],
          ];
    for (const [y, width] of bands) {
      if (detail < 2) face(out, 'stone', f, 0, l, y, y + width, 0.095, sandstone);
      else horizontal(out, f, 0, l, y, width, y > 19 ? 0.41 : 0.19);
    }
    if (detail === 0 || l < 3.05) continue;
    const bays = Math.max(1, Math.round(l / 5.05)),
      span = l / bays;
    for (let j = 0; j < bays; j++) {
      const u = span * (j + 0.5);
      if (j && detail > 1)
        fbox(
          out,
          'stone',
          f,
          j * span - 0.36,
          j * span + 0.36,
          2.03,
          19.48,
          -0.03,
          0.23,
          sandstone,
        );
      window(out, detail, f, u, 12.99, Math.min(span - 0.6, 2.46), 3.48);
      window(out, detail >= 2 ? detail - 1 : detail, f, u, 8.02, Math.min(span - 0.6, 2.3), 2.8);
      if (detail === 3) window(out, 2, f, u, 3.24, Math.min(span - 0.6, 2.17), 2.73, 'flat');
    }
  }
  const axis = longWall.along,
    normal = longWall.normal;
  const roofShape = deform(out, ([x, , z]) => {
    const d = normal[0] * (x - longWall.origin[0]) + normal[1] * (z - longWall.origin[1]);
    return [x, buildingHeight + Math.max(0.03, 3.28 - Math.abs(d + 6.3) * 0.29), z];
  });
  cap(roofShape, 'roof', ring, buildingHeight, tin);
  if (detail > 1)
    beam(
      out,
      'roof',
      longWall.P(12, 23.33, -6.3),
      longWall.P(longWall.length - 1.25, 23.33, -6.3),
      0.13,
      0.11,
      tin,
    );
}

function portal(out, detail) {
  const p = front.P,
    l = front.length,
    radius = 5.74,
    spring = 6.08,
    top = 20.05;
  const recess = -1.88,
    sill = 1.19;
  const arch = roundArch(radius, [4, 7, 11, 16][detail]);
  for (const [a, b] of [
    [0, entry - radius],
    [entry + radius, l],
  ]) {
    face(out, 'base', front, a, b, foundationBottom, 2.58, 0, stoneBase);
    face(out, 'stone', front, a, b, 2.58, top, 0, sandstone);
    if (detail > 0) {
      for (const u of [a + 0.38, b - 0.38])
        fbox(out, 'stone', front, u - 0.2, u + 0.2, 2.48, 18.87, -0.13, 0.21, molding);
      for (const y of [3.04, 5.1, 7.17, 9.23, 11.29, 13.35, 15.41, 17.46])
        horizontal(out, front, a, b, y, 0.13, 0.09, shade);
    }
  }
  for (let i = 1; i < arch.length; i++) {
    const [a, ya] = arch[i - 1],
      [b, yb] = arch[i];
    quad4(
      out,
      'stone',
      p(entry + a, spring + ya, 0),
      p(entry + b, spring + yb, 0),
      p(entry + b, top, 0),
      p(entry + a, top, 0),
      sandstone,
    );
    quad4(
      out,
      'glazing',
      p(entry + a, spring - 0.28, recess),
      p(entry + b, spring - 0.28, recess),
      p(entry + b, spring + yb, recess),
      p(entry + a, spring + ya, recess),
      glass,
    );
    const point = (x, y, t, d) => p(entry + x * t, spring + y * t, d);
    quad4(
      out,
      'stone',
      point(a, ya, 1, 0.13),
      point(b, yb, 1, 0.13),
      point(b, yb, 1.17, 0.27),
      point(a, ya, 1.17, 0.27),
      i % 3 === 0 ? molding : sandstone,
    );
    quad4(
      out,
      'stone',
      point(b, yb, 1, 0.13),
      point(a, ya, 1, 0.13),
      point(a, ya, 1, recess),
      point(b, yb, 1, recess),
      shade,
    );
    if (detail === 3)
      beam(out, 'stone', point(a, ya, 1.02, 0.139), point(a, ya, 1.17, 0.276), 0.046, 0.05, shade);
  }
  face(out, 'glazing', front, entry - radius, entry + radius, sill, spring - 0.28, recess, glass);
  for (const side of [-1, 1]) {
    const u = entry + side * radius;
    const a = p(u, sill - 0.13, 0),
      b = p(u, sill - 0.13, recess);
    const c = p(u, spring, recess),
      d = p(u, spring, 0);
    quad4(out, 'stone', ...(side > 0 ? [a, b, c, d] : [b, a, d, c]), shade);
  }
  for (const y of [12.33, 16.95, 18.83, 19.45])
    horizontal(out, front, 0, l, y, y > 18 ? 0.45 : 0.27, y > 18 ? 0.56 : 0.23);
  const pediment = [
    p(1.1, top - 0.11, 0.52),
    p(l - 1.1, top - 0.11, 0.52),
    p(entry, top + 4.2, 0.52),
  ];
  tri(out, 'stone', ...pediment, sandstone);
  if (detail > 0) {
    for (let i = 0; i < pediment.length; i++)
      beam(out, 'stone', pediment[i], pediment[(i + 1) % pediment.length], 0.33, 0.39, molding);
    for (let i = -2; i <= 2; i++)
      window(out, detail, front, entry + i * 2.35, 13.37, 1.65, 2.8, 'flat');
    horizontal(out, front, entry - 5.19, entry + 5.19, 5.35, 0.61, -0.45, molding);
    for (let i = -3; i <= 3; i++) {
      const u = entry + i * 1.45;
      if (detail > 1) clock(out, front, u, 5.78, 0.35, detail === 2 ? 1 : 2, -0.33);
      else fbox(out, 'stone', front, u - 0.34, u + 0.34, 5.43, 6.07, -0.51, -0.38, sandstone);
      for (const y of [2.74, 8.1])
        fbox(
          out,
          'metal',
          front,
          u - 0.076,
          u + 0.076,
          y - 1.48,
          y > 5 ? spring + Math.sqrt(radius * radius - (u - entry) ** 2) - 0.18 : 4.9,
          recess,
          recess + 0.12,
          iron,
        );
    }
    clockFace(out, front, entry, 20.96, 0.94, detail, 0.79);
  }
  const steps = [3, 5, 8, 11][detail];
  for (let i = 0; i < steps; i++) {
    const t = i / steps,
      next = (i + 1) / steps;
    fbox(
      out,
      'base',
      front,
      entry - radius + 0.31,
      entry + radius - 0.31,
      -0.48,
      sill * (1 - t),
      0.19 + t * 5.01,
      0.19 + next * 5.01,
      stoneBase,
    );
  }
  fbox(
    out,
    'base',
    front,
    entry - radius + 0.3,
    entry + radius - 0.3,
    -0.48,
    sill,
    recess,
    0.19,
    stoneBase,
  );
  if (detail > 1)
    for (const u of [entry - 3.3, entry, entry + 3.3]) {
      for (const d of [1.08, 2.76, 4.48]) {
        const y = sill - (d / 5.2) * sill;
        beam(out, 'metal', p(u, y, d), p(u, y + 0.89, d), 0.061, 0.062, iron);
      }
      beam(out, 'metal', p(u, 1.87, 1.08), p(u, 1.06, 4.48), 0.065, 0.062, iron);
    }
}

function dome(out, detail, center, radius, bottom, top, point) {
  const n = [8, 14, 20, 28][detail],
    m = [4, 6, 9, 12][detail];
  const drum = (y, r) => radialRing(y, r, r, n, center);
  loft(
    out,
    'stone',
    [
      drum(bottom - radius * 0.42, radius * 1.01),
      drum(bottom + 0.12, radius * 1.01),
      drum(bottom + 3.15, radius * 0.982),
      drum(bottom + 3.41, radius * 1.005),
    ],
    sandstone,
  );
  const shell = Array.from({ length: m + 1 }, (_, i) => {
    const t = ((i / m) * Math.PI) / 2;
    return drum(
      bottom + 3.36 + Math.sin(t) * (top - bottom - 3.36),
      radius * (0.083 + 0.917 * Math.cos(t)),
    );
  });
  loft(out, 'copper', shell, verdigris);
  if (detail > 1) {
    const [x, z] = center;
    for (let i = 0; i < n; i += detail === 3 ? 1 : 2)
      for (let j = 1; j < shell.length; j++) {
        const push = ([a, y, b]) => [x + (a - x) * 1.006, y + 0.019, z + (b - z) * 1.006];
        beam(out, 'copper', push(shell[j - 1][i]), push(shell[j][i]), 0.076, 0.1, rgb('9ea48d'));
      }
  }
  loft(
    out,
    'copper',
    [drum(top - 0.05, radius * 0.11), drum(top + radius * 0.12, radius * 0.063)],
    verdigris,
  );
  beam(
    out,
    'metal',
    [center[0], top - 0.04, center[1]],
    [center[0], point, center[1]],
    0.098,
    0.096,
    iron,
  );
}

function clockTower(out, detail) {
  const rings = site.clockTower;
  const stages = [...rings.annexes.map((ring) => [ring, 18.71, 24]), [rings.outline, 18.71, 32.17]];
  for (const [outline, start, high] of stages) {
    const r = outwardRing(outline);
    for (const [i, a] of r.entries()) {
      const f = wallFace(a, r[(i + 1) % r.length]),
        l = f.length;
      face(out, 'brick', f, 0, l, start, high, 0, clay);
      if (detail > 0) {
        for (const y of [high - 0.96, high - 5.34]) {
          if (detail === 1) face(out, 'stone', f, 0, l, y, y + 0.48, 0.16, molding);
          else horizontal(out, f, 0, l, y, 0.48, 0.29);
        }
        if (high > 27) clockFace(out, f, l / 2, 29, 1.19, detail, 0.23);
        else window(out, detail, f, l / 2, 20, Math.min(1.75, l - 0.3), 2.96);
      }
    }
    cap(out, 'roof', r, high, tin);
  }
  const r = outwardRing(rings.outline);
  const cx = r.reduce((s, p) => s + p[0] / r.length, 0),
    cz = r.reduce((s, p) => s + p[1] / r.length, 0);
  const ring = (y, s) => r.map(([x, z]) => [cx + (x - cx) * s, y, cz + (z - cz) * s]);
  loft(
    out,
    'copper',
    [ring(32.16, 1.05), ring(34.2, 0.26), ring(clockTip - 0.32, 0.046)],
    verdigris,
  );
  beam(out, 'metal', [cx, clockTip - 0.43, cz], [cx, clockTip, cz], 0.1, 0.1, iron);
}

function platform(out, detail, part) {
  const r = outwardRing(part.outline),
    y = part.height;
  cap(out, 'roof', r, y, tin);
  if (detail === 0) return;
  cap(
    deform(out, ([x, , z]) => [-x, y - 0.17, z]),
    'roof',
    r.map(([x, z]) => [-x, z]),
    0,
    tin,
  );
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]),
      l = f.length;
    if (l < 0.024) continue;
    if (detail > 1) face(out, 'stone', f, 0, l, y - 0.17, y, 0, molding);
    if (l < [0, 38, 7.5, 3.4][detail]) continue;
    const n = Math.max(1, Math.round(l / [0, 49, 19.5, 7.96][detail]));
    for (let j = 0; j < n; j++) {
      const u = (l * (j + 0.5)) / n,
        d = -0.41;
      const p = f.P;
      beam(out, 'metal', p(u, site.portal.platformBottom, d), p(u, y - 0.16, d), 0.19, 0.19, iron);
      if (detail === 3) {
        beam(out, 'metal', p(u, y - 1.36, d), p(u + 0.84, y - 0.16, d), 0.13, 0.13, iron);
        beam(out, 'metal', p(u, y - 1.36, d), p(u - 0.84, y - 0.16, d), 0.13, 0.13, iron);
      }
    }
  }
}

function build(out, detail) {
  buildingWalls(out, detail);
  for (const part of site.platformRoofs) platform(out, detail, part);
  portal(out, detail);
  const center = (u, d) => front.P(u, 0, d).filter((_, i) => i !== 1);
  dome(out, detail, domeCenter, domeRadius, 20.9, domeTop, flagTip);
  if (detail > 0)
    for (const u of [entry - 13.78, entry + 12.38])
      dome(out, detail - 1, center(u, -9.43), 2.77, 18.97, 24.2, 25.41);
  clockTower(out, detail);
  if (detail > 0)
    for (const { outline } of site.elevators) {
      const r = outwardRing(outline);
      for (const [i, a] of r.entries()) {
        const f = wallFace(a, r[(i + 1) % r.length]);
        face(out, 'glazing', f, 0, f.length, -2.03, 4.72, 0, glass);
      }
      cap(out, 'roof', r, 4.72, tin);
    }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
