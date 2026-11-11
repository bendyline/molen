/** The west towers, nave and apse of Minsk Holy Spirit Cathedral in May 2019. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const parts = new Map(frame.features.map((f) => [f.role, f]));
const {
  foundationBottom,
  baseCourse,
  westThreshold,
  westFront,
  mainEntryCenter,
  wallEaves,
  roofRidge,
  aisleEaves,
  aisleRidge,
  towerCornices,
  spireTop,
  finialTop,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.22 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.77, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'f1eddf',
    cornice: 'e0ddcf',
    stone: '53544e',
    step: '7c7971',
    roof: '51775a',
    darkRoof: '353d3c',
    window: '3c4646',
    recess: '383733',
    reveal: 'b8b3a5',
    door: '745034',
    wood: '98734b',
    iron: '4b4540',
    gold: 'b59a53',
    icon: '827154',
    red: '885d4d',
    teal: '54746d',
  }).map(([key, value]) => [key, rgb(value)]),
);
const white = 'palette:#ffffff';
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    point: (u, y, p = 0) => [a[0] + u * dx + p * n[0], y, a[1] + u * dz + p * n[2]],
  };
}
function edges(ring) {
  const sign = Math.sign(area(ring));
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, e, a, b, bottom, top, p, tint) {
  face(
    out,
    slot,
    [e.point(a, bottom, p), e.point(b, bottom, p), e.point(b, top, p), e.point(a, top, p)],
    e.n,
    tint,
  );
}
function walls(out, ring, bottom, top, slot = 'wall', tint = colors.wall) {
  for (const e of edges(ring)) panel(out, slot, e, 0, e.length, bottom, top, 0, tint);
}
const arch = (center, half, spring, top, count) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [center - half * Math.cos(t), spring + (top - spring) * Math.sin(t)];
  });
function archPanel(out, e, center, half, bottom, spring, top, p, tint, count) {
  panel(out, 'detail', e, center - half, center + half, bottom, spring, p, tint);
  const a = arch(center, half, spring, top, count);
  const hub = e.point(center, spring, p);
  for (let i = 1; i < a.length; i++)
    face(out, 'detail', [hub, e.point(...a[i - 1], p), e.point(...a[i], p)], e.n, tint);
}
function windows(out, e, u, w, bottom, top, lod, blind = false) {
  const h = w / 2,
    spring = top - w * 0.32,
    count = lod >= 2 ? 8 : 4;
  if (lod === 0) {
    if (!blind) panel(out, 'detail', e, u - h, u + h, bottom, top, 0.027, colors.window);
    return;
  }
  archPanel(out, e, u, h + 0.1, bottom - 0.065, spring, top + 0.12, 0.024, colors.reveal, count);
  archPanel(out, e, u, h, bottom, spring, top, 0.048, blind ? colors.wall : colors.window, count);
  if (!blind && lod >= 1) {
    panel(out, 'detail', e, u - 0.034, u + 0.034, bottom, top - 0.07, 0.065, colors.wood);
    panel(out, 'detail', e, u - h, u + h, spring - 0.035, spring + 0.035, 0.067, colors.wood);
  }
  if (lod >= 2)
    panel(
      out,
      'stone',
      e,
      u - h - 0.14,
      u + h + 0.14,
      bottom - 0.115,
      bottom + 0.012,
      0.082,
      colors.reveal,
    );
}
function molding(out, ring, y, depth, height, lod) {
  const es = edges(ring);
  for (const e of es) {
    const spread = depth * 0.55;
    panel(out, 'wall', e, -spread, e.length + spread, y, y + height, depth, colors.cornice);
    if (lod)
      face(
        out,
        'wall',
        [
          e.point(-spread, y + height, depth),
          e.point(e.length + spread, y + height, depth),
          e.point(e.length, y + height),
          e.point(0, y + height),
        ],
        [0, 1, 0],
        colors.wall,
      );
    if (lod >= 1)
      panel(
        out,
        'wall',
        e,
        -spread,
        e.length + spread,
        y - 0.115,
        y - 0.035,
        depth * 0.55,
        colors.wall,
      );
  }
}
const lower = cleanRing(parts.get('front-lower-facade').outline);
const middle = cleanRing(parts.get('front-middle-facade').outline);
const entablature = cleanRing(parts.get('front-entablature').outline);
const perimeter = cleanRing(outline);
const front = edge([10.43, westFront], [-10.93, westFront]);
const westU = (x) => 10.43 - x;

function lowerChurch(out, lod) {
  walls(out, perimeter, foundationBottom, baseCourse, 'stone', colors.stone);
  walls(out, perimeter, baseCourse, aisleEaves);
  walls(out, lower, aisleEaves, towerCornices[0]);
  walls(out, middle, towerCornices[0], towerCornices[1]);
  walls(out, entablature, towerCornices[1], towerCornices[2]);
  molding(out, lower, 8.27, 0.24, 0.24, lod);
  molding(out, middle, 12.56, 0.28, 0.27, lod);
  molding(out, entablature, 13.23, 0.32, 0.28, lod);
  const upper = edge([10.2, 12.45], [-10.7, 12.45]);
  for (const x of [-7.56, -0.34, 7.06]) {
    const u = westU(x);
    if (Math.abs(x) > 1) windows(out, front, u, 1.11, 2.25, 4.71, lod);
    windows(out, upper, 10.2 - x, 1.35, 9.42, 11.92, lod);
  }
  const south = edge([10.43, 5.95], [10.43, 12.68]);
  const north = edge([-10.93, 12.68], [-10.93, 5.95]);
  for (const e of [south, north]) {
    windows(out, e, e.length * 0.52, 1.25, 3.77, 6.28, lod, true);
    archPanel(out, e, e.length * 0.5, 0.62, baseCourse, 2.35, 2.75, 0.051, colors.door, 4);
  }
  const sideBays = [
    [2, 3, [0.5]],
    [3, 4, [0.32, 0.79]],
    [4, 5, [0.52]],
    [11, 12, [0.52]],
    [12, 13, [0.3, 0.75]],
    [13, 14, [0.52]],
  ];
  const perimeterSign = Math.sign(area(outline));
  for (const [a, b, bays] of sideBays) {
    const e = edge(outline[a], outline[b], perimeterSign);
    for (const f of bays) windows(out, e, e.length * f, 1.14, 3.01, 6.29, lod);
  }
}

const nave = [
  [-4.68, -17.01],
  [-2.28, -20],
  [1.67, -20.02],
  [4.26, -16.99],
  [4.25, 11.12],
  [-4.7, 11.11],
];
function roofs(out, lod) {
  walls(out, nave, aisleEaves, wallEaves);
  for (const [a, b] of [
    [nave[0], nave[5]],
    [nave[4], nave[3]],
  ]) {
    const e = edge(a, b, -1);
    for (const z of [-13.4, -8.2, -2.9, 2.5])
      windows(out, e, e.length * Math.abs((z - a[1]) / (b[1] - a[1])), 1.3, 10.37, 12.63, lod);
  }
  for (let i = 0; i < 3; i++) {
    const e = edge(nave[i], nave[i + 1]);
    if (i !== 1 || lod > 0) windows(out, e, e.length / 2, 1.03, 9.24, 12.1, lod);
  }
  const ridgeNear = [-0.24, roofRidge, 11.19],
    ridgeFar = [-0.24, roofRidge, -17.02];
  for (const [x0, z0, x1, z1] of [
    [-4.85, -17.09, -4.86, 11.2],
    [4.42, -17.09, 4.42, 11.2],
  ]) {
    const a = [x0, wallEaves, z0],
      b = [x1, wallEaves, z1];
    face(out, 'roof', [a, b, ridgeNear, ridgeFar], [0, 1, 0], colors.roof);
    if (lod >= 2)
      for (const t of [0.18, 0.39, 0.6, 0.81]) {
        const z = z0 + (z1 - z0) * t;
        beam(
          out,
          'roof',
          [x0, wallEaves + 0.029, z],
          [-0.24, roofRidge + 0.026, z],
          0.046,
          0.044,
          colors.roof,
        );
      }
  }
  const apse = [
    [-4.85, -17.09],
    [-2.35, -20.13],
    [1.76, -20.16],
    [4.42, -17.09],
  ];
  for (let i = 1; i < apse.length; i++)
    face(
      out,
      'roof',
      [ridgeFar, [apse[i - 1][0], wallEaves, apse[i - 1][1]], [apse[i][0], wallEaves, apse[i][1]]],
      [0, 1, 0],
      colors.roof,
    );
  for (const [x0, x1, z0, z1, z2] of [
    [-9.23, -4.69, -17.14, 5.97, 6.02],
    [8.89, 4.26, -17.1, 5.96, 5.98],
  ]) {
    const outerStart = [x0, aisleEaves, z0],
      innerStart = [x1, aisleRidge, z0 + 2.36];
    face(
      out,
      'roof',
      [outerStart, [x0, aisleEaves, z1], [x1, aisleRidge, z2], innerStart],
      [0, 1, 0],
      colors.roof,
    );
    face(out, 'roof', [outerStart, innerStart, [x1, aisleEaves, z0]], [0, 1, 0], colors.roof);
    if (lod >= 2)
      for (const z of [-12, -8, -4, 0, 4])
        beam(
          out,
          'roof',
          [x0, aisleEaves + 0.03, z],
          [x1, aisleRidge + 0.03, z],
          0.041,
          0.04,
          colors.roof,
        );
  }
}

function belfryFace(out, e, bottom, top, lod) {
  const length = e.length;
  if (length < 0.89) {
    panel(out, 'wall', e, 0, length, bottom, top, 0, colors.wall);
    return;
  }
  const center = length / 2,
    half = Math.min(length * 0.2, 0.76);
  const sill = bottom + (top - bottom) * 0.17,
    head = top - (top - bottom) * 0.12;
  const spring = head - half * 0.8,
    count = lod >= 2 ? 8 : 4;
  const a = arch(center, half, spring, head, count);
  panel(out, 'wall', e, 0, center - half, bottom, top, 0, colors.wall);
  panel(out, 'wall', e, center + half, length, bottom, top, 0, colors.wall);
  panel(out, 'wall', e, center - half, center + half, bottom, sill, 0, colors.wall);
  const depth = lod >= 1 ? -0.39 : -0.1;
  for (let i = 1; i < a.length; i++) {
    const [u, h] = a[i - 1],
      [v, k] = a[i];
    face(
      out,
      'wall',
      [e.point(u, h), e.point(v, k), e.point(v, top), e.point(u, top)],
      e.n,
      colors.wall,
    );
    face(
      out,
      'detail',
      [e.point(u, h), e.point(v, k), e.point(v, k, depth), e.point(u, h, depth)],
      [0, -1, 0],
      colors.reveal,
    );
  }
  for (const side of [-1, 1]) {
    const u = center + side * half;
    face(
      out,
      'detail',
      [e.point(u, sill), e.point(u, spring), e.point(u, spring, depth), e.point(u, sill, depth)],
      e.point(center, 0).map((v, i) => v - e.point(u, 0)[i]),
      colors.reveal,
    );
  }
  archPanel(out, e, center, half, sill, spring, head, depth, colors.recess, count);
  if (lod >= 2) {
    panel(
      out,
      'stone',
      e,
      center - half - 0.1,
      center + half + 0.1,
      sill - 0.09,
      sill + 0.013,
      0.11,
      colors.reveal,
    );
    if (top - bottom > 3)
      panel(out, 'detail', e, center - 0.028, center + 0.028, sill, spring, 0.021, colors.iron);
  }
}
function chamfered(ring, fraction) {
  return ring.flatMap((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    return [a, b].map((q) => p.map((v, k) => v + (q[k] - v) * fraction));
  });
}
function radial(centerX, centerZ, r, y, count) {
  return Array.from({ length: count }, (_, i) => {
    const t = (2 * Math.PI * (i + 0.5)) / count;
    return [centerX + r * Math.cos(t), y, centerZ + r * Math.sin(t)];
  });
}
function spire(out, x, z, lod) {
  const count = lod >= 1 ? 12 : 8;
  const profile = [
    [25.37, 1.39],
    [25.64, 1.47],
    [26.04, 1.3],
    [26.58, 0.93],
    [26.85, 0.52],
    [27.2, 0.48],
    [27.48, 0.53],
    [27.83, 0.41],
    [28.2, 0.26],
    [28.45, 0.34],
    [29.05, 0.27],
    [29.72, 0.16],
    [30.35, 0.1],
    [spireTop, 0.06],
  ];
  const bands = lod ? profile : profile.filter((_, i) => [0, 2, 4, 6, 9, 11, 13].includes(i));
  for (let j = 1; j < bands.length; j++) {
    const a = radial(x, z, bands[j - 1][1], bands[j - 1][0], count),
      b = radial(x, z, bands[j][1], bands[j][0], count);
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count;
      face(
        out,
        'roof',
        [a[i], a[k], b[k], b[i]],
        [a[i][0] + a[k][0] - 2 * x, 0, a[i][2] + a[k][2] - 2 * z],
        colors.darkRoof,
      );
    }
  }
  beam(out, 'detail', [x, spireTop, z], [x, finialTop, z], 0.085, 0.085, colors.gold);
  beam(out, 'detail', [x - 0.42, 32.55, z], [x + 0.42, 32.55, z], 0.083, 0.077, colors.gold);
  if (lod >= 2) {
    beam(out, 'detail', [x - 0.28, 32.18, z], [x + 0.28, 32.18, z], 0.056, 0.057, colors.gold);
    beam(out, 'detail', [x - 0.28, 31.76, z], [x + 0.28, 31.95, z], 0.057, 0.057, colors.gold);
  }
}
function towers(out, lod) {
  for (const [side, x, z] of [
    ['north', -7.56, 9.25],
    ['south', 7.06, 9.34],
  ]) {
    const base = chamfered(cleanRing(parts.get(side + '-tower-lower-belfry').outline), 0.09);
    const upper = chamfered(cleanRing(parts.get(side + '-tower-upper-belfry').outline), 0.13);
    const lantern = radial(x, z, 1.43, 0, 8).map(([px, , pz]) => [px, pz]);
    for (const [ring, bottom, top] of [
      [base, 13.48, 19.3],
      [upper, 19.26, 23.5],
      [lantern, 23.46, 25.45],
    ]) {
      for (const e of edges(ring)) {
        if (lod === 0) {
          panel(out, 'wall', e, 0, e.length, bottom, top, 0, colors.wall);
          if (e.length >= 0.89)
            archPanel(
              out,
              e,
              e.length / 2,
              Math.min(e.length * 0.2, 0.76),
              bottom + (top - bottom) * 0.17,
              top - (top - bottom) * 0.35,
              top - (top - bottom) * 0.12,
              0.025,
              colors.recess,
              4,
            );
        } else belfryFace(out, e, bottom, top, lod);
        if (lod >= 2 && e.length > 1.18)
          for (const u of [0.12, e.length - 0.27])
            panel(out, 'wall', e, u, u + 0.15, bottom + 0.06, top - 0.18, 0.043, colors.cornice);
      }
      molding(out, ring, top - 0.25, 0.19, 0.27, lod);
    }
    spire(out, x, z, lod);
  }
}

function centerBay(out, lod) {
  const x = mainEntryCenter,
    z = 11.93,
    e = edge([2.62, z], [-3.35, z]),
    u = 2.62 - x;
  box(out, 'wall', -0.365, 13.36, 11.48, 5.97, 4.12, 1.31, colors.wall);
  const left = [-3.47, 17.2, 12.2],
    right = [2.74, 17.2, 12.2],
    peak = [x, 19.31, 12.16];
  face(out, 'wall', [left, right, peak], [0, 0, 1], colors.wall);
  face(
    out,
    'wall',
    [left, right, peak].map(([px, y]) => [px, y, 10.65]),
    [0, 0, -1],
    colors.wall,
  );
  for (const [a, b] of [
    [left, peak],
    [right, peak],
  ]) {
    const c = [a[0], a[1], 10.65],
      d = [b[0], b[1], 10.65];
    face(out, 'roof', [a, b, d, c], [0, 1, 0], colors.darkRoof);
    if (lod) beam(out, 'wall', a, b, 0.16, 0.18, colors.cornice);
  }
  archPanel(out, e, u, 1.08, 14.08, 16.54, 17.18, 0.28, colors.gold, 6);
  archPanel(out, e, u, 0.81, 14.31, 16.51, 16.96, 0.31, colors.icon, 6);
  if (lod >= 1) {
    panel(out, 'detail', e, u - 0.38, u + 0.38, 14.47, 15.56, 0.34, colors.teal);
    panel(out, 'detail', e, u - 0.23, u + 0.23, 15.56, 16.22, 0.34, colors.red);
    archPanel(out, e, u, 0.22, 16.19, 16.42, 16.64, 0.345, colors.gold, 5);
  }
  for (const i of [-1, 1]) {
    box(out, 'wall', x + i * 2.43, 13.49, 12.02, 0.24, 3.62, 0.48, colors.cornice);
    if (lod >= 2) box(out, 'wall', x + i * 2.43, 16.89, 12.08, 0.37, 0.26, 0.48, colors.wall);
  }
}
function entrance(out, lod) {
  const u = westU(mainEntryCenter);
  const count = lod >= 2 ? 10 : 6,
    half = 1.52;
  archPanel(out, front, u, half + 0.15, westThreshold, 3.23, 4.04, 0.021, colors.reveal, count);
  archPanel(out, front, u, half, westThreshold, 3.18, 3.88, 0.051, colors.door, count);
  windows(out, front, u, 1.62, 4.82, 6.78, lod);
  for (const d of [-1, 1]) {
    const v = u + d * 2.17;
    panel(out, 'wall', front, v - 0.18, v + 0.18, westThreshold, 4.44, 0.084, colors.cornice);
    if (lod) archPanel(out, front, v + d * 0.47, 0.42, 1.28, 2.94, 3.28, 0.075, colors.gold, count);
    if (lod >= 2) {
      archPanel(
        out,
        front,
        v + d * 0.47,
        0.33,
        1.38,
        2.82,
        3.15,
        0.09,
        d < 0 ? colors.red : colors.teal,
        count,
      );
      for (const y of [1.2, 2.04, 2.88])
        panel(
          out,
          'detail',
          front,
          u + d * 0.7 - 0.41,
          u + d * 0.7 + 0.41,
          y,
          y + 0.18,
          0.075,
          colors.wood,
        );
    }
  }
  if (lod)
    panel(out, 'detail', front, u - 0.037, u + 0.037, westThreshold, 3.82, 0.079, colors.iron);
  const canopy = arch(u, 1.63, 3.2, 4.03, count);
  if (lod === 3)
    for (const d of [-1, 1]) {
      const v = u + d * 1.58;
      for (const q of [0.32, 0.62, 0.92])
        beam(
          out,
          'detail',
          front.point(v, 3.13, q),
          front.point(v + d * 0.08, 3.27, q + 0.13),
          0.045,
          0.043,
          colors.iron,
        );
      panel(
        out,
        'detail',
        front,
        u + d * 0.22 - 0.044,
        u + d * 0.22 + 0.044,
        1.44,
        1.59,
        0.09,
        colors.gold,
      );
    }
  for (let i = 1; i < canopy.length; i++) {
    const [a, b] = [canopy[i - 1], canopy[i]];
    const inner = 0.085,
      outer = 1.28;
    face(
      out,
      'roof',
      [
        front.point(...a, inner),
        front.point(...b, inner),
        front.point(...b, outer),
        front.point(...a, outer),
      ],
      [0, 1, 0],
      colors.darkRoof,
    );
    if (lod >= 2)
      beam(
        out,
        'detail',
        front.point(...a, outer),
        front.point(...b, outer),
        0.053,
        0.065,
        colors.gold,
      );
  }
  if (lod)
    for (const d of [-1, 1]) {
      const v = u + d * 1.57;
      beam(
        out,
        'detail',
        front.point(v, 2.69, 0.16),
        front.point(v, 3.29, 1.23),
        0.08,
        0.071,
        colors.iron,
      );
    }
  const width = 3.82,
    low = -0.21,
    stairCount = lod ? 4 : 2;
  for (let i = 0; i < stairCount; i++) {
    const depth = 0.48 + 0.25 * i,
      top = westThreshold - (0.76 * i) / stairCount;
    box(
      out,
      'stone',
      mainEntryCenter,
      low,
      westFront + depth / 2,
      width,
      top - low,
      depth,
      colors.step,
    );
  }
}
function buildLevel(out, lod) {
  lowerChurch(out, lod);
  roofs(out, lod);
  towers(out, lod);
  centerBay(out, lod);
  entrance(out, lod);
}
export const minskSkyline = (out) => buildLevel(out, 0);
export const minskDistrict = (out) => buildLevel(out, 1);
export const minskStreet = (out) => buildLevel(out, 2);
export const minskCloseup = (out) => buildLevel(out, 3);

const recipe = 'minsk-cathedral-model.mjs',
  camera = [34, 24, 50],
  lookAt = [0, 14.5, 1.6];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'minskDistrict', 0.22],
    ['street', 'minskStreet', 0.08],
    ['closeup', 'minskCloseup', 0.03],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const minskCathedralModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: minskCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Holy Spirit Cathedral in Minsk in May 2019, with twin Baroque spires, recessed belfries, white stepped cornices, a green-roofed nave and aisles, and the carved portal canopy.',
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
    outline,
    minimumCoverage: 0.94,
    basis:
      'Nineteen native points of the cathedral proper. The adjacent convent is a separate mapped building.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'metal_standing_seam', 'stone_granite'],
  qaCameras: [
    { name: 'west-portal-and-twin-towers', position: [0, 14, 62], lookAt: [0, 15.1, 9] },
    { name: 'nave-roofs-and-polygonal-apse', position: [24, 34, -38], lookAt: [0, 13, -4] },
    { name: 'stepped-belfry-and-spire-details', position: [21, 28, 33], lookAt: [0, 23, 9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-minsk-cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'minskSkyline',
    errorMeters: 0.42,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Three exact Rakoon Qualla reference photos under CC0.',
};
