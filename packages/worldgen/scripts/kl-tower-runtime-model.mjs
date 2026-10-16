/** Individually reviewed KL Tower: curved shaft, rose soffit, triangular glazing and skyboxes. */
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalize, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  glazedOutline,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  shift,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0161_kuala_lumpur_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  parts = partsEvidence(key),
  pale = [0.8, 0.8, 0.76],
  metal = [0.67, 0.72, 0.75];
export const klTowerCenter = map.orientationControl.coreCenter;
export const klTowerBoxBearings = map.orientationControl.skyBoxBearingsDegrees;
export const klTowerShaftRadius = (y) => 6.8 + 5.45 * (1 - Math.min(y, 261.6) / 261.6) ** 2;
const settings = {
  source: {
    sides: 96,
    shaftSteps: 32,
    ribs: 24,
    ribSteps: 24,
    friezeSides: 96,
    friezeRows: 8,
    headSides: 48,
    triangleBays: 24,
    railSides: 96,
    latticeStep: 4,
    tubeSides: 6,
  },
  closeup: {
    sides: 96,
    shaftSteps: 32,
    ribs: 24,
    ribSteps: 24,
    friezeSides: 96,
    friezeRows: 8,
    headSides: 48,
    triangleBays: 24,
    railSides: 96,
    latticeStep: 4,
    tubeSides: 6,
  },
  street: {
    sides: 48,
    shaftSteps: 16,
    ribs: 24,
    ribSteps: 8,
    friezeSides: 48,
    friezeRows: 4,
    headSides: 48,
    triangleBays: 24,
    railSides: 48,
    latticeStep: 8,
    tubeSides: 3,
  },
  district: {
    sides: 16,
    shaftSteps: 8,
    ribs: 12,
    ribSteps: 3,
    friezeSides: 24,
    friezeRows: 2,
    headSides: 16,
    triangleBays: 8,
    railSides: 12,
    latticeStep: 12,
    tubeSides: 4,
  },
  skyline: {
    sides: 12,
    shaftSteps: 4,
    ribs: 0,
    ribSteps: 0,
    friezeSides: 12,
    friezeRows: 1,
    headSides: 8,
    triangleBays: 0,
    railSides: 12,
    latticeStep: 29,
    tubeSides: 3,
  },
};
function thinMember(out, slot, a, b, r, color, level) {
  if (level === 'source' || level === 'closeup')
    return tube(out, slot, a, b, r, color, settings[level].tubeSides);
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(axis, u);
  const ring = (p) =>
    Array.from({ length: 3 }, (_, i) =>
      p.map(
        (x, k) =>
          x + r * (Math.cos((i * 2 * Math.PI) / 3) * u[k] + Math.sin((i * 2 * Math.PI) / 3) * v[k]),
      ),
    );
  // Closed triangular sections remain visible from every azimuth. Tiny end caps at the
  // joints are omitted in distant levels instead of using one-sided crossed planes.
  loft(out, slot, [ring(a), ring(b)], color, { cap: false });
}
function profile(out, slot, points, center, color, sides, cap = false) {
  loft(
    out,
    slot,
    points.map(([y, r]) => radialRing(y, r, r, sides, center)),
    color,
    { cap },
  );
}
function guard(out, center, y, r, sides, color, level) {
  const ring = radialRing(y, r, r, sides, center);
  for (let i = 0; i < sides; i++) {
    const a = ring[i],
      b = ring[(i + 1) % sides];
    thinMember(
      out,
      'metal',
      shift(a, [0, 1, 0], 1.25),
      shift(b, [0, 1, 0], 1.25),
      0.035,
      color,
      level,
    );
    if (level === 'source' || level === 'closeup' || level === 'street')
      thinMember(out, 'metal', a, shift(a, [0, 1, 0], 1.25), 0.025, color, level);
  }
}
function skyBox(out, a, center, level) {
  const near = level === 'source' || level === 'closeup' || level === 'street',
    fine = level === 'source' || level === 'closeup',
    [cx, cz] = center,
    at = (y, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r],
    p = at(302.2, 24),
    q = at(302.2, 27.3),
    tangent = [-Math.sin(a), 0, Math.cos(a)],
    violet = [0.24, 0.105, 0.32],
    steel = [0.79, 0.8, 0.77],
    corners = [
      shift(p, tangent, -1.1),
      shift(q, tangent, -1.1),
      shift(q, tangent, 1.1),
      shift(p, tangent, 1.1),
    ];
  face(out, 'clear_glass', corners, [0.79, 0.89, 0.91]);
  face(
    out,
    'clear_glass',
    corners.map((p) => shift(p, [0, 1, 0], 2.5)),
    [0.79, 0.89, 0.91],
  );
  for (let j = 0; j < 4; j++) {
    const next = corners[(j + 1) % 4];
    if (near)
      beam(
        out,
        'metal',
        shift(corners[j], [0, 1, 0], -0.09),
        shift(next, [0, 1, 0], -0.09),
        0.13,
        0.18,
        violet,
      );
    if (j !== 3) {
      face(
        out,
        'clear_glass',
        [corners[j], next, shift(next, [0, 1, 0], 2.5), shift(corners[j], [0, 1, 0], 2.5)],
        [0.79, 0.89, 0.91],
      );
      if (near)
        for (let k = 1, count = j === 1 ? 3 : 5; k < count; k++) {
          const v = lerp(corners[j], next, k / count);
          beam(out, 'metal', v, shift(v, [0, 1, 0], 2.5), 0.045, 0.065, violet);
        }
      if (fine)
        thinMember(
          out,
          'stainless',
          shift(corners[j], [0, 1, 0], 1.05),
          shift(next, [0, 1, 0], 1.05),
          0.025,
          steel,
          level,
        );
    }
    thinMember(out, 'metal', corners[j], shift(corners[j], [0, 1, 0], 2.5), 0.055, violet, level);
    thinMember(
      out,
      'metal',
      shift(corners[j], [0, 1, 0], 2.5),
      shift(next, [0, 1, 0], 2.5),
      0.055,
      violet,
      level,
    );
  }
  for (const side of [-1, 1]) {
    const inner = shift(at(305, 21), tangent, side * 1.14),
      outer = shift(at(305, 27.7), tangent, side * 1.14);
    if (near) {
      beam(out, 'metal', inner, outer, 0.035, 0.42, steel);
      for (const y of [-0.21, 0.21])
        beam(
          out,
          'metal',
          shift(inner, [0, 1, 0], y),
          shift(outer, [0, 1, 0], y),
          0.36,
          0.045,
          steel,
        );
    } else thinMember(out, 'metal', inner, outer, 0.15, steel, level);
    if (level !== 'skyline')
      thinMember(
        out,
        'stainless',
        shift(at(307.4, 19.4), tangent, side * 1.14),
        shift(outer, [0, 1, 0], 0.25),
        0.03,
        steel,
        level,
      );
    if (fine)
      for (let k = 0; k < 6; k++) {
        const v = shift(at(305.03, 24 + k * 0.62), tangent, side * 1.18);
        thinMember(
          out,
          'metal',
          v,
          shift(v, tangent, side * 0.045),
          0.065,
          [0.4, 0.43, 0.42],
          level,
        );
      }
    if (near) {
      const lo = shift(at(301.12, 21.6), tangent, side * 0.94),
        hi = shift(p, tangent, side * 0.94);
      beam(out, 'metal', lo, hi, 0.1, 0.14, steel);
      thinMember(
        out,
        'stainless',
        shift(lo, [0, 1, 0], 1.1),
        shift(hi, [0, 1, 0], 1.1),
        0.025,
        steel,
        level,
      );
      if (fine)
        for (let k = 0; k <= 6; k++) {
          const v = lerp(lo, hi, k / 6);
          thinMember(out, 'stainless', v, shift(v, [0, 1, 0], 1.1), 0.02, steel, level);
        }
    }
  }
  if (near)
    for (let k = 1; k <= 6; k++) {
      const v = at(301 + k * 0.2, 21.6 + k * 0.4);
      beam(out, 'metal', shift(v, tangent, -1), shift(v, tangent, 1), 0.42, 0.08, steel);
    }
}
function build(out, level) {
  const c = settings[level],
    near = level === 'source' || level === 'closeup' || level === 'street',
    fine = level === 'source' || level === 'closeup',
    base = localOutline(map),
    part = (id) => parts.find((p) => p.id === id),
    upper = partPlan(map, part(589740577)),
    center = klTowerCenter,
    [cx, cz] = center,
    at = (a, y, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r],
    boxAngles = klTowerBoxBearings.map((b) => ((b - 90) * Math.PI) / 180 + map.heading);
  if (level === 'skyline') mappedSolid(out, 'glass', base, 0, 10, [0.35, 0.4, 0.38]);
  else {
    mappedSolid(out, 'stone', base, 0, 0.4, [0.62, 0.6, 0.54]);
    glazedOutline(
      out,
      base,
      0.4,
      8.7,
      level === 'district' ? 8 : 2.5,
      [0.25, 0.32, 0.34],
      pale,
      0.12,
    );
    mappedCap(out, 'concrete', base, 8.7, pale);
    if (near) bandPlan(out, base, 8.7, 0.35, 0.5, pale, 'concrete');
    mappedSolid(out, 'concrete', upper, 8.7, 10, pale);
  }
  // One continuous profile removes the original repeated hidden caps between shaft slices.
  const shaft = Array.from({ length: c.shaftSteps + 1 }, (_, i) => {
    const y = 10 + ((261.6 - 10) * i) / c.shaftSteps;
    return [y, klTowerShaftRadius(y)];
  });
  profile(out, 'concrete', shaft, center, [0.79, 0.77, 0.73], c.sides);
  for (let i = 0; i < c.ribs; i++) {
    const a = (i * 2 * Math.PI) / c.ribs;
    for (let j = 0; j < c.ribSteps; j++) {
      const y = 10 + (251.6 * j) / c.ribSteps,
        hi = 10 + (251.6 * (j + 1)) / c.ribSteps;
      thinMember(
        out,
        'concrete',
        at(a, y, klTowerShaftRadius(y) + 0.08),
        at(a, hi, klTowerShaftRadius(hi) + 0.08),
        0.085,
        pale,
        level,
      );
    }
  }
  profile(
    out,
    'concrete',
    [
      [261.4, 6.8],
      [317.16, 6.8],
    ],
    center,
    pale,
    c.sides,
  );
  // A continuous rose soffit replaces isolated rows of open triangular chips. Twelve
  // reconstructed lobes follow the primary underside photo; exact tile pattern is unmeasured.
  const soffit = (a, t) => {
    const scallop = (1 - Math.cos(12 * a)) * 0.32 * Math.sin(Math.PI * t),
      r = 6.8 + 6.75 * t + scallop;
    return at(a, 261.6 + 9 * t - 0.5 * Math.cos(12 * a) * Math.sin(Math.PI * t), r);
  };
  for (let j = 0; j < c.friezeRows; j++)
    for (let i = 0; i < c.friezeSides; i++) {
      const a = (-i * 2 * Math.PI) / c.friezeSides,
        b = (-(i + 1) * 2 * Math.PI) / c.friezeSides,
        t = j / c.friezeRows,
        u = (j + 1) / c.friezeRows;
      face(
        out,
        'pink',
        [soffit(a, t), soffit(b, t), soffit(b, u), soffit(a, u)],
        [0.78, 0.54, 0.49],
      );
    }
  if (near)
    for (let i = 0; i < 48; i++) {
      const a = (i * 2 * Math.PI) / 48;
      for (let j = 0; j < c.friezeRows; j++)
        thinMember(
          out,
          'pink',
          soffit(a, j / c.friezeRows),
          soffit(a, (j + 1) / c.friezeRows),
          0.025,
          [0.65, 0.4, 0.37],
          level,
        );
    }
  const head = [
    [270.6, 13.55],
    [276, 17.3],
    [282, 19.1],
    [288, 21],
    [294, 22.9],
    [300, 24.9],
  ];
  for (let j = 1; j < head.length; j++) {
    const [y0, r0] = head[j - 1],
      [y1, r1] = head[j],
      lo = radialRing(y0, r0, r0, c.headSides, center),
      hi = radialRing(y1 - 0.7, r1 - 0.2, r1 - 0.2, c.headSides, center);
    for (let i = 0; i < c.headSides; i++) {
      const p = [lo[i], lo[(i + 1) % c.headSides], hi[(i + 1) % c.headSides], hi[i]];
      if (near) panel(out, p, [0.2, 0.26, 0.31], 0.1, [0.77, 0.78, 0.75]);
      else face(out, 'glass', p, [0.2, 0.26, 0.31]);
    }
    profile(
      out,
      'concrete',
      [
        [y1 - 0.7, r1 - 0.2],
        [y1, r1],
      ],
      center,
      pale,
      c.headSides,
    );
    for (let i = 0; i < c.triangleBays; i++) {
      const a = (i * 2 * Math.PI) / c.triangleBays,
        b = ((i + 1) * 2 * Math.PI) / c.triangleBays,
        m = (a + b) / 2,
        low = at(m, y0 + 0.15, r0 + 0.12),
        u = at(a, y1 - 0.8, r1 - 0.09),
        v = at(b, y1 - 0.8, r1 - 0.09);
      // Three-dimensional outer V mullions retain the visible frame motif at district/street.
      thinMember(out, 'metal', u, low, 0.06, [0.67, 0.5, 0.47], level);
      thinMember(out, 'metal', low, v, 0.06, [0.67, 0.5, 0.47], level);
    }
  }
  profile(
    out,
    'concrete',
    [
      [300, 24.9],
      [301, 24.9],
    ],
    center,
    pale,
    c.headSides,
    true,
  );
  if (level !== 'skyline') {
    const ring = radialRing(301, 24.4, 24.4, c.railSides, center);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length],
        a = Math.atan2((p[2] + q[2]) / 2 - cz, (p[0] + q[0]) / 2 - cx);
      if (boxAngles.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.07))
        continue;
      face(
        out,
        'clear_glass',
        [p, q, shift(q, [0, 1, 0], 1.35), shift(p, [0, 1, 0], 1.35)],
        [0.75, 0.86, 0.86],
      );
      thinMember(out, 'metal', p, shift(p, [0, 1, 0], 1.4), 0.03, metal, level);
      thinMember(
        out,
        'metal',
        shift(p, [0, 1, 0], 1.4),
        shift(q, [0, 1, 0], 1.4),
        0.035,
        metal,
        level,
      );
    }
  }
  profile(
    out,
    'concrete',
    [
      [303, 23],
      [307, 20.1],
      [309, 17.5],
      [311, 12.1],
      [315, 10.3],
    ],
    center,
    [0.83, 0.83, 0.79],
    c.headSides,
    true,
  );
  if (near)
    for (let i = 0, n = fine ? 48 : 24; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      beam(out, 'metal', at(a, 301, 23.3), at(a, 303.1, 22.5), 0.14, 0.18, [0.76, 0.79, 0.79]);
    }
  profile(
    out,
    'concrete',
    [
      [314, 7.3],
      [335, 5.3],
    ],
    center,
    pale,
    c.sides,
    true,
  );
  for (const [y, r] of [
    [319, 9.4],
    [326, 9.7],
    [333, 8],
  ]) {
    profile(
      out,
      'metal',
      [
        [y - 0.3, r],
        [y + 0.3, r],
      ],
      center,
      [0.64, 0.69, 0.68],
      c.headSides,
      true,
    );
    if (level !== 'skyline') guard(out, center, y, r, c.railSides, [0.58, 0.62, 0.61], level);
  }
  for (let y = 335; y < 393; y += c.latticeStep) {
    const hi = Math.min(y + c.latticeStep, 393),
      r = 4.8 - (y - 335) * 0.065,
      rh = 4.8 - (hi - 335) * 0.065;
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2,
        b = a + Math.PI / 2;
      thinMember(out, 'metal', at(a, y, r), at(a, hi, rh), 0.19, [0.65, 0.69, 0.68], level);
      thinMember(out, 'metal', at(a, y, r), at(b, hi, rh), 0.08, [0.7, 0.74, 0.73], level);
      thinMember(out, 'metal', at(a, hi, rh), at(b, hi, rh), 0.09, [0.73, 0.75, 0.73], level);
    }
  }
  for (let y = 389; y < 421; y += 4) {
    const hi = Math.min(y + 4, 421),
      r = Math.max(0.12, 0.98 - (y - 389) * 0.026);
    profile(
      out,
      'metal',
      [
        [y, r],
        [hi, Math.max(0.045, r - 0.1)],
      ],
      center,
      Math.floor((y - 389) / 4) % 2 ? [0.74, 0.22, 0.19] : [0.86, 0.86, 0.82],
      level === 'skyline' ? 4 : level === 'district' ? 6 : c.sides / 2,
      near,
    );
    if (!near && hi === 421)
      mappedCap(
        out,
        'metal',
        radialRing(
          421,
          Math.max(0.045, r - 0.1),
          Math.max(0.045, r - 0.1),
          level === 'skyline' ? 4 : 6,
          center,
        ).map((p) => [p[0], p[2]]),
        421,
        [0.74, 0.22, 0.19],
      );
  }
  for (const a of boxAngles) skyBox(out, a, center, level);
}
export function buildKlTowerReviewedMaster(out) {
  build(out, 'source');
}
export function buildKlTowerCloseup(out) {
  build(out, 'closeup');
}
export function buildKlTowerStreet(out) {
  build(out, 'street');
}
export function buildKlTowerDistrict(out) {
  build(out, 'district');
}
export function buildKlTowerSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = {
          stone: 'stone_granite',
          metal: 'metal_painted',
          pink: 'metal_painted',
          concrete: 'concrete_plain',
          stainless: 'metal_stainless',
        }[component],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
