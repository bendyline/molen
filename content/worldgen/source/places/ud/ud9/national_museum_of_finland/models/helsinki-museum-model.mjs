/** The National Museum of Finland, Helsinki, August 2012. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const outer = frame.geometry.polygons[0],
  holes = frame.geometry.holes;
const {
  foundationBottom,
  lowerWallTop,
  mainThreshold,
  entrance,
  tower,
  roofMasses,
  roundTurret,
  easternOriel,
} = plan.section;

const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.84, metallic: 0.1 },
  dark: { slot: 'trim', localRef: 'palette:#fffdfe', roughness: 0.79, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    granite: 'aaa695',
    plaster: 'c8b78f',
    roof: '655b58',
    brick: 'ab694c',
    copper: '87a499',
    dark: '55564e',
    trim: 'c0b399',
    base: '979488',
    turret: 'b5aa91',
    warm: 'cbb88e',
    pane: '535d5b',
    wood: '65594b',
  }).map(([k, v]) => [k, rgb(v)]),
);

function face(out, slot, points, expected, color = colors[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function block(out, slot, [x0, x1, z0, z1], low, high, color = colors[slot]) {
  box(out, slot, (x0 + x1) / 2, low, (z0 + z1) / 2, x1 - x0, high - low, z1 - z0, color);
}
function pointAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}
function edge(a, b, reverse = false) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / l,
    dz = (b[1] - a[1]) / l,
    sign = reverse ? -1 : 1;
  return {
    length: l,
    n: [dz * sign, 0, -dx * sign],
    point: (u, y, p = 0) => [a[0] + u * dx + p * dz * sign, y, a[1] + u * dz - p * dx * sign],
  };
}
const area = (ring) =>
  ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
function strip(out, slot, e, l, r, b, t, d = 0, color = colors[slot]) {
  face(
    out,
    slot,
    [e.point(l, b, d), e.point(r, b, d), e.point(r, t, d), e.point(l, t, d)],
    e.n,
    color,
  );
}
function cap(out, slot, ring, inner, y, color = colors[slot]) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      'palette:#ffffff',
      ring,
      inner,
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Museum roof deck could not be triangulated');
  const { indices, positions } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      Array.from(indices.slice(i, i + 3), (j) => Array.from(positions.slice(j * 3, j * 3 + 3))),
      [0, 1, 0],
      color,
    );
}
function archPanel(
  out,
  e,
  center,
  width,
  base,
  spring,
  rise,
  lod,
  d = 0.027,
  color = colors.pane,
  frameSlot = 'granite',
) {
  const half = width / 2,
    count = [4, 6, 8, 12][lod];
  strip(out, 'dark', e, center - half, center + half, base, spring, d, color);
  const a = (theta, r) =>
    e.point(center + half * r * Math.cos(theta), spring + rise * r * Math.sin(theta), d);
  for (let i = 0; i < count; i++) {
    const x = (Math.PI * i) / count,
      y = (Math.PI * (i + 1)) / count;
    face(out, 'dark', [e.point(center, spring, d), a(x, 1), a(y, 1)], e.n, color);
    if (lod >= 2) {
      const p = (angle, r) =>
        e.point(
          center + half * r * Math.cos(angle),
          spring + rise * r * Math.sin(angle),
          d + 0.036,
        );
      face(out, frameSlot, [p(x, 1), p(y, 1), p(y, 1.13), p(x, 1.13)], e.n, colors.trim);
    }
  }
  if (lod >= 2) {
    strip(
      out,
      frameSlot,
      e,
      center - half - 0.125,
      center - half,
      base,
      spring,
      d + 0.044,
      colors.trim,
    );
    strip(
      out,
      frameSlot,
      e,
      center + half,
      center + half + 0.125,
      base,
      spring,
      d + 0.044,
      colors.trim,
    );
    strip(
      out,
      frameSlot,
      e,
      center - 0.045,
      center + 0.045,
      base,
      spring + rise * 0.89,
      d + 0.052,
      colors.trim,
    );
  }
}
function circle(out, e, u, y, r, lod, d = 0.034, color = colors.dark) {
  const count = lod >= 2 ? 16 : 8;
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count,
      b = (2 * Math.PI * (i + 1)) / count;
    face(
      out,
      'dark',
      [
        e.point(u, y, d),
        e.point(u + r * Math.cos(a), y + r * Math.sin(a), d),
        e.point(u + r * Math.cos(b), y + r * Math.sin(b), d),
      ],
      e.n,
      color,
    );
  }
}
function walls(out, ring, inner, lod) {
  const reverse = area(ring) < 0 !== inner;
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring[i], ring[(i + 1) % ring.length], reverse),
      l = e.length;
    if (l < 0.03) continue;
    const split = inner ? 4.6 : 3.9;
    if (lod) {
      strip(out, 'granite', e, 0, l, foundationBottom, split, 0, colors.base);
      strip(
        out,
        inner ? 'plaster' : 'granite',
        e,
        0,
        l,
        split,
        lowerWallTop,
        0,
        inner ? colors.warm : colors.granite,
      );
      strip(out, 'granite', e, 0, l, split - 0.12, split + 0.05, 0.073, colors.trim);
    } else strip(out, inner ? 'plaster' : 'granite', e, 0, l, foundationBottom, lowerWallTop, 0);
    if (lod < 1 || l < 4.7) continue;
    // The entrance bay is detailed on the tower itself.
    const p = e.point(l / 2, 0);
    if (!inner && Math.abs(p[0] - entrance[0]) < 6 && Math.abs(p[2] - entrance[1]) < 1) continue;
    const n = Math.max(1, Math.round(l / (lod === 1 ? 5.6 : 3.6))),
      step = l / n;
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * step,
        w = Math.min(step * 0.51, 1.63);
      archPanel(out, e, u, w, split + 0.83, split + 2.51, 0.63, lod);
      if (lod >= 2)
        strip(out, 'dark', e, u - w * 0.36, u + w * 0.36, split - 2.02, split - 0.52, 0.041);
      if (lod === 3)
        strip(
          out,
          'granite',
          e,
          u - w * 0.58,
          u + w * 0.58,
          split + 0.7,
          split + 0.87,
          0.14,
          colors.trim,
        );
    }
  }
}
function gabled(out, { name, bounds: [x0, x1, z0, z1], eaves, ridge, axis }, lod) {
  const alongZ = axis === 'z',
    lo = alongZ ? x0 : z0,
    hi = alongZ ? x1 : z1,
    a = alongZ ? z0 : x0,
    b = alongZ ? z1 : x1;
  const mid = (lo + hi) / 2,
    over = 0.32;
  const p = (x, y, z) => (alongZ ? [x, y, z] : [z, y, x]);
  const granite = name.includes('gable') || name.includes('southern');
  const wall = granite ? 'granite' : 'plaster';
  block(out, wall, [x0, x1, z0, z1], lowerWallTop - 0.08, eaves);
  for (const v of [lo - over, hi + over])
    face(
      out,
      'roof',
      [
        p(v, eaves, a - over),
        p(v, eaves, b + over),
        p(mid, ridge, b + over),
        p(mid, ridge, a - over),
      ],
      [0, 1, 0],
    );
  for (const [v, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const normal = alongZ ? [0, 0, sign] : [sign, 0, 0];
    face(out, wall, [p(lo, eaves, v), p(hi, eaves, v), p(mid, ridge, v)], normal);
    if (lod) {
      for (const side of [lo - over, hi + over]) {
        const o = v + over * sign;
        if (lod >= 2)
          beam(out, 'copper', p(side, eaves, o), p(mid, ridge, o), 0.11, 0.14, colors.copper);
        else
          face(
            out,
            'copper',
            [
              p(side, eaves - 0.11, o),
              p(mid, ridge - 0.11, o),
              p(mid, ridge, o),
              p(side, eaves, o),
            ],
            normal,
          );
      }
      const e = edge(
        [p(lo, 0, v)[0], p(lo, 0, v)[2]],
        [p(hi, 0, v)[0], p(hi, 0, v)[2]],
        sign === (alongZ ? 1 : -1),
      );
      const detail = granite ? [-1.89, 0, 1.89] : [0];
      for (const u of detail)
        archPanel(
          out,
          e,
          e.length / 2 + u,
          granite ? 1.38 : 1.22,
          eaves - 0.56,
          eaves + 1.84,
          0.63,
          lod,
          0.045,
        );
    }
  }
  if (lod) {
    for (const [v, sign] of [
      [lo, -1],
      [hi, 1],
    ]) {
      const e = edge(
        [p(v, 0, a)[0], p(v, 0, a)[2]],
        [p(v, 0, b)[0], p(v, 0, b)[2]],
        sign === (alongZ ? -1 : 1),
      );
      const n = Math.max(1, Math.floor(e.length / 5.1)),
        gap = e.length / n;
      for (let j = 0; j < n; j++) {
        const u = gap * (j + 0.5);
        strip(out, 'dark', e, u - 0.74, u + 0.74, eaves - 2.21, eaves - 0.52, 0.032, colors.pane);
        if (lod >= 2)
          strip(
            out,
            'granite',
            e,
            u - 0.045,
            u + 0.045,
            eaves - 2.19,
            eaves - 0.55,
            0.072,
            colors.trim,
          );
      }
      if (lod >= 2 && b - a > 15) {
        const dormers = Math.round((b - a) / 5.2),
          step = (b - a) / dormers;
        for (let k = 0; k < dormers; k++) {
          const u = a + (k + 0.5) * step,
            f = v - sign * 0.84,
            y = eaves + 0.55;
          const normal = alongZ ? [sign, 0, 0] : [0, 0, sign];
          face(out, 'copper', [p(f, y, u - 0.74), p(f, y, u + 0.74), p(f, y + 0.99, u)], normal);
          face(
            out,
            'dark',
            [
              p(f + sign * 0.022, y + 0.12, u - 0.49),
              p(f + sign * 0.022, y + 0.12, u + 0.49),
              p(f + sign * 0.022, y + 0.77, u),
            ],
            normal,
          );
        }
      }
    }
  }
}
function squareBand(
  out,
  slot,
  x,
  z,
  w,
  d,
  low,
  high,
  scale = 1,
  highScale = scale,
  color = colors[slot],
) {
  const offsets = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ];
  const p = (u, v, y, s) => [x + (u * w * s) / 2, y, z + (v * d * s) / 2];
  for (let i = 0; i < offsets.length; i++) {
    const [a, b] = offsets[i],
      [c, d] = offsets[(i + 1) % offsets.length];
    face(
      out,
      slot,
      [
        p(a, b, low, scale),
        p(c, d, low, scale),
        p(c, d, high, highScale),
        p(a, b, high, highScale),
      ],
      [a + c, 0, b + d],
      color,
    );
  }
}
function mainTower(out, lod) {
  const {
    center: [x, z],
    width: w,
    depth: d,
    stoneTop,
    redLowerTop,
    copperTransitionTop,
    redUpperTop,
    spireTop,
  } = tower;
  const bounds = [x - w / 2, x + w / 2, z - d / 2, z + d / 2],
    front = entrance[1];
  block(out, 'granite', bounds, foundationBottom, stoneTop, colors.granite);
  squareBand(out, 'brick', x, z, w, d, stoneTop, redLowerTop, 1);
  squareBand(out, 'copper', x, z, w, d, redLowerTop, copperTransitionTop, 1.025, 0.7);
  squareBand(out, 'brick', x, z, w, d, copperTransitionTop, redUpperTop, 0.7);
  squareBand(out, 'copper', x, z, w, d, redUpperTop, spireTop, 0.725, 0.012);
  const f = edge([x - w / 2, front], [x + w / 2, front], true),
    u = w / 2;
  archPanel(out, f, u, 3.24, mainThreshold, mainThreshold + 2.72, 1.14, lod, 0.054, colors.wood);
  for (const sy of [15.45, 22.4, 28.84])
    strip(out, 'dark', f, u - 0.29, u + 0.29, sy, sy + 1.59, 0.044);
  for (const dx of [-0.64, 0.64])
    strip(out, 'dark', f, u + dx - 0.31, u + dx + 0.31, stoneTop - 4.16, stoneTop - 1.16, 0.034);
  circle(out, f, u, (stoneTop + redLowerTop) / 2, 0.71, lod, 0.044);
  block(
    out,
    'granite',
    [x - 1.38, x + 1.38, front - 0.05, front + 0.66],
    stoneTop - 4.67,
    stoneTop - 4.19,
    colors.trim,
  );
  const ends = [
    edge([x - w * 0.35, z + d * 0.35], [x + w * 0.35, z + d * 0.35], true),
    edge([x + w * 0.35, z + d * 0.35], [x + w * 0.35, z - d * 0.35], true),
    edge([x + w * 0.35, z - d * 0.35], [x - w * 0.35, z - d * 0.35], true),
    edge([x - w * 0.35, z - d * 0.35], [x - w * 0.35, z + d * 0.35], true),
  ];
  for (const e of ends)
    for (const k of [-1, 1])
      archPanel(
        out,
        e,
        e.length / 2 + k * 0.78,
        0.93,
        copperTransitionTop + 0.6,
        copperTransitionTop + 1.85,
        0.49,
        lod,
        0.042,
        colors.dark,
        'brick',
      );
  const foot = front + 7.15,
    ground = pointAt(x, foot) + 0.075;
  if (ground < mainThreshold - 0.08) {
    const n = lod ? 12 : 4,
      run = foot - front,
      low = Math.min(ground, pointAt(x - 4.7, foot), pointAt(x + 4.7, foot)) - 0.34;
    for (let i = 0; i < n; i++) {
      const y = mainThreshold - ((mainThreshold - ground) * i) / n,
        half = 4.4 + (i / n) * 0.64;
      block(
        out,
        'granite',
        [x - half, x + half, front + (run * i) / n, front + (run * (i + 1)) / n],
        low,
        y,
        colors.trim,
      );
    }
  }
  if (lod >= 2) {
    for (const k of [-1, 1]) {
      const xx = x + k * 1.39;
      block(
        out,
        'granite',
        [xx - 0.15, xx + 0.15, front + 0.23, front + 0.72],
        stoneTop - 4.18,
        stoneTop - 3.33,
        colors.trim,
      );
      for (const d of [-0.64, 0, 0.64])
        strip(
          out,
          'granite',
          f,
          u + d - 0.065,
          u + d + 0.065,
          stoneTop - 4.15,
          stoneTop - 3.42,
          0.66,
          colors.trim,
        );
    }
    for (const dx of [-2.68, -1.91, 1.91, 2.68]) {
      block(
        out,
        'granite',
        [x + dx - 0.13, x + dx + 0.13, front - 0.01, front + 0.2],
        mainThreshold + 2.85,
        mainThreshold + 9.4,
        colors.trim,
      );
    }
  }
}
function rounded(out, slot, center, profile, sides, color = colors[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 8)),
    color,
    { cap },
  );
}
function turrets(out, lod) {
  const { center, radius: r, stoneTop, capTop, lanternTop } = roundTurret;
  const n = [8, 12, 18, 24][lod];
  rounded(
    out,
    'granite',
    center,
    [
      [lowerWallTop - 0.27, r],
      [stoneTop, r * 0.99],
    ],
    n,
  );
  rounded(
    out,
    'roof',
    center,
    [
      [stoneTop - 0.12, r * 1.02],
      [stoneTop + 1.55, r * 0.92],
      [capTop - 1.7, r * 0.64],
      [capTop, r * 0.35],
    ],
    n,
  );
  rounded(
    out,
    'copper',
    center,
    [
      [capTop - 0.2, r * 0.43],
      [capTop + 0.29, r * 0.43],
    ],
    n,
  );
  if (lod) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        x = center[0] + 0.32 * r * Math.cos(a),
        z = center[1] + 0.32 * r * Math.sin(a);
      block(
        out,
        'copper',
        [x - 0.115, x + 0.115, z - 0.115, z + 0.115],
        capTop + 0.28,
        capTop + 2.12,
      );
      const t = ((i + 0.5) * Math.PI) / 4;
      const p = (a, r) => [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
      const e = edge(p(t - 0.23, r * 0.941), p(t + 0.23, r * 0.941));
      circle(out, e, e.length / 2, stoneTop - 1.81, 0.53, lod, 0.29);
    }
  } else
    rounded(
      out,
      'copper',
      center,
      [
        [capTop + 0.29, r * 0.31],
        [capTop + 2.12, r * 0.31],
      ],
      n,
    );
  rounded(
    out,
    'copper',
    center,
    [
      [capTop + 2.12, r * 0.39],
      [capTop + 2.65, r * 0.28],
      [lanternTop, 0.07],
    ],
    n,
  );

  const { center: q, radius, base, top, capTop: crest } = easternOriel;
  rounded(
    out,
    'granite',
    q,
    [
      [base - 1.55, 0.66],
      [base, radius],
      [top, radius * 0.97],
    ],
    8,
    colors.turret,
  );
  rounded(
    out,
    'roof',
    q,
    [
      [top - 0.13, radius * 1.06],
      [crest - 0.42, 0.49],
      [crest, 0.18],
    ],
    8,
  );
  if (lod)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8,
        b = a + Math.PI / 4,
        p = (u) => [q[0] + radius * 0.985 * Math.cos(u), q[1] + radius * 0.985 * Math.sin(u)];
      const e = edge(p(a), p(b));
      for (const y of [base + 1.36, base + 4.42])
        strip(out, 'dark', e, 0.24, e.length - 0.24, y, y + 1.63, 0.04);
      if (lod >= 2)
        strip(out, 'granite', e, 0.27, e.length - 0.27, top - 1.53, top - 0.88, 0.083, colors.trim);
    }
}
function courtDetails(out, lod) {
  if (!lod) return;
  const court = holes[0],
    a = court[6],
    b = court[7],
    e = edge(a, b, area(court) > 0);
  const u = e.length * 0.54,
    p = e.point(u, 0, 0.038),
    floor = Math.min(7.2, pointAt(p[0], p[2]) + 0.26);
  archPanel(out, e, u, 2.66, floor, floor + 2.17, 0.86, lod, 0.07, colors.wood);
  if (lod >= 2) {
    for (const q of [u - 1.65, u + 1.65])
      strip(out, 'granite', e, q - 0.12, q + 0.12, floor, floor + 3.26, 0.16, colors.trim);
    strip(out, 'granite', e, u - 1.83, u + 1.83, floor + 3.24, floor + 3.56, 0.2, colors.trim);
  }
}
function build(out, _frame, lod = 3) {
  walls(out, outer, false, lod);
  for (const ring of holes) walls(out, ring, true, lod);
  cap(out, 'roof', outer, holes, lowerWallTop);
  for (const mass of roofMasses) gabled(out, mass, lod);
  mainTower(out, lod);
  turrets(out, lod);
  courtDetails(out, lod);
}
export const helsinkiSkyline = (out) => build(out, undefined, 0);
export const helsinkiDistrict = (out) => build(out, undefined, 1);
export const helsinkiStreet = (out) => build(out, undefined, 2);
export const helsinkiCloseup = (out) => build(out, undefined, 3);

const recipe = 'helsinki-museum-model.mjs',
  camera = [105, 76, 129],
  lookAt = [-1, 18, -6];
export const helsinkiModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Helsinki museum’s irregular granite wings, open courts and 58-meter copper-spired tower in 2012.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.95,
    basis:
      'Use the mapped historic museum outline only for the dated generic-building replacement.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'plaster_lime',
    'slate',
    'brick_flemish',
    'metal_copper',
  ],
  qaCameras: [
    { name: 'granite-entrance-and-tower', position: [72, 37, 96], lookAt: [9, 24, 4] },
    { name: 'linnanpiha-and-halkopiha', position: [-64, 108, -72], lookAt: [0, 13, -8] },
    { name: 'avenue-gallery-and-oriels', position: [95, 35, -41], lookAt: [12, 20, -14] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-finnish-national-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'helsinkiSkyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'helsinkiDistrict', 0.24],
        ['street', 'helsinkiStreet', 0.088],
        ['closeup', 'helsinkiCloseup', 0.032],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The outline and courtyards are from OpenStreetMap. Exterior architecture is based on verified CC0 photographs by Daderot.',
};
