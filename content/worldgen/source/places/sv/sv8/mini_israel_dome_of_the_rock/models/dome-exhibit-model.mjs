import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  masonry: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  paving: { slot: 'foundation', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  blue: { slot: 'wall', graph: 'tile_mosaic', roughness: 0.79, metallic: 0 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76, metallic: 0.05 },
  gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.51, metallic: 0.25 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.85, metallic: 0 },
};

const ref = 'palette:#ffffff';
const ivory = [0.77, 0.71, 0.57];
const wallStone = [0.59, 0.5, 0.36];
const courtStone = [0.74, 0.67, 0.53];
const blue = [0.16, 0.29, 0.48];
const blueLight = [0.38, 0.54, 0.66];
const blueDeep = [0.066, 0.115, 0.23];
const lead = [0.32, 0.44, 0.47];
const gold = [0.88, 0.64, 0.22];
const bronze = [0.56, 0.36, 0.11];
const door = [0.073, 0.1, 0.1];

const tiers = {
  skyline: { dome: 10, rings: 4, arches: 2, details: 0 },
  district: { dome: 20, rings: 7, arches: 5, details: 1 },
  street: { dome: 32, rings: 10, arches: 8, details: 2 },
  closeup: { dome: 56, rings: 15, arches: 12, details: 3 },
  master: { dome: 72, rings: 20, arches: 16, details: 4 },
};

// Local +Z is the visitor stair front shown head-on in the reference.
export const court = { x0: -3.1, x1: 3.25, z0: -2.65, z1: 2.38, top: 0.48 };
const bodyRadius = 1.06;
const wallTop = court.top + 0.57;
const roofRim = wallTop + 0.075;
const domeBase = court.top + 0.95;

function ring(radius, y, count, center = [0, 0], rotation = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = rotation - (i * 2 * Math.PI) / count;
    return [center[0] + radius * Math.cos(a), y, center[1] + radius * Math.sin(a)];
  });
}

function octagon(out, slot, profile, color) {
  loft(
    out,
    slot,
    profile.map(([r, y]) => ring(r, y, 8, [0, 0], Math.PI / 8)),
    color,
  );
}

function face(out, slot, points, color) {
  const n = normalFor(points[0], points[1], points[2]);
  out.addQuad(slot, ref, points, n, [], color);
}

function panel(out, slot, project, x0, x1, y0, y1, d, color) {
  const p = (x, y) => project(x, y, d);
  face(out, slot, [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], color);
}

function archPanel(out, slot, project, u, bottom, spring, r, rise, d, color, segments) {
  const shape = [project(u - r, bottom, d), project(u + r, bottom, d)];
  for (let i = 0; i <= segments; i++) {
    const a = (i * Math.PI) / segments;
    shape.push(project(u + r * Math.cos(a), spring + rise * Math.sin(a), d));
  }
  out.addConvexPolygon(slot, ref, shape, normalFor(shape[0], shape[1], shape[2]), [], color);
}

function entranceHood(out, project, d, segments) {
  const spring = court.top + 0.247;
  const hoodPoint = (i, depth) => {
    const a = (i * Math.PI) / segments;
    return project(0.117 * Math.cos(a), spring + 0.102 * Math.sin(a), depth);
  };
  for (let i = 0; i < segments; i++) {
    face(
      out,
      'lead',
      [hoodPoint(i, d), hoodPoint(i + 1, d), hoodPoint(i + 1, d + 0.17), hoodPoint(i, d + 0.17)],
      lead,
    );
  }
  for (const x of [-0.111, 0.111]) {
    panel(out, 'masonry', project, x - 0.01, x + 0.01, court.top + 0.012, spring, d + 0.156, ivory);
  }
}

function dome(out, slot, center, base, radius, rise, tiers, color, seams = false) {
  const profile = Array.from({ length: tiers.rings }, (_, i) => {
    const a = (i * Math.PI) / (2 * tiers.rings);
    return ring(radius * Math.cos(a), base + rise * Math.sin(a), tiers.dome, center);
  });
  for (let j = 1; j < profile.length; j++) {
    for (let i = 0; i < tiers.dome; i++) {
      const k = (i + 1) % tiers.dome;
      const tint = seams && i % 4 === 0 ? color.map((v) => v * 0.9) : color;
      face(out, slot, [profile[j - 1][i], profile[j - 1][k], profile[j][k], profile[j][i]], tint);
    }
  }
  const last = profile.at(-1);
  const top = [center[0], base + rise, center[1]];
  for (let i = 0; i < last.length; i++) {
    const points = [last[i], last[(i + 1) % last.length], top];
    out.addTriangle(slot, ref, points, normalFor(...points), [], color);
  }
}

function shrine(out, tier) {
  octagon(
    out,
    'masonry',
    [
      [bodyRadius, court.top],
      [bodyRadius, court.top + 0.23],
    ],
    ivory,
  );
  octagon(
    out,
    'blue',
    [
      [bodyRadius, court.top + 0.23],
      [bodyRadius, wallTop],
    ],
    blue,
  );
  octagon(
    out,
    'blue',
    [
      [1.078, wallTop - 0.045],
      [1.078, roofRim],
    ],
    blueDeep,
  );
  octagon(
    out,
    'lead',
    [
      [1.059, roofRim - 0.053],
      [0.493, roofRim + 0.11],
    ],
    lead,
  );
  octagon(
    out,
    'masonry',
    [
      [1.08, roofRim],
      [1.08, roofRim + 0.018],
    ],
    ivory,
  );
  loft(
    out,
    'blue',
    [roofRim + 0.085, domeBase].map((y) => ring(0.486, y, 16)),
    blue,
  );
  loft(
    out,
    'gold',
    [domeBase - 0.016, domeBase + 0.01].map((y) => ring(0.502, y, tier.dome)),
    bronze,
  );
  dome(out, 'gold', [0, 0], domeBase, 0.491, 0.59, tier, gold, tier.details >= 2);
  const cap = domeBase + 0.59;
  const finial = tier.details
    ? [
        [0.025, cap - 0.007],
        [0.025, cap + 0.021],
        [0.012, cap + 0.04],
        [0.009, cap + 0.093],
        [0.003, cap + 0.124],
      ]
    : [
        [0.022, cap - 0.007],
        [0.003, cap + 0.124],
      ];
  loft(
    out,
    'gold',
    finial.map(([r, y]) => ring(r, y, 8)),
    gold,
  );

  const apothem = bodyRadius * Math.cos(Math.PI / 8);
  const halfSide = bodyRadius * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const project = (u, y, d) => [
      u * Math.cos(a) + d * Math.sin(a),
      y,
      -u * Math.sin(a) + d * Math.cos(a),
    ];
    const front = apothem + 0.005;
    panel(
      out,
      'blue',
      project,
      -halfSide,
      halfSide,
      wallTop - 0.09,
      wallTop - 0.065,
      front,
      blueLight,
    );
    panel(
      out,
      'blue',
      project,
      -halfSide,
      halfSide,
      wallTop - 0.14,
      wallTop - 0.126,
      front,
      blueDeep,
    );
    const portal = i % 2 === 0;
    if (portal) {
      archPanel(
        out,
        'dark',
        project,
        0,
        court.top + 0.014,
        court.top + 0.25,
        0.085,
        0.078,
        front,
        door,
        tier.arches,
      );
      panel(
        out,
        'masonry',
        project,
        -0.109,
        -0.085,
        court.top + 0.017,
        court.top + 0.25,
        front + 0.003,
        ivory,
      );
      panel(
        out,
        'masonry',
        project,
        0.085,
        0.109,
        court.top + 0.017,
        court.top + 0.25,
        front + 0.003,
        ivory,
      );
      if (tier.details > 1) entranceHood(out, project, front, tier.arches);
    }
    if (!tier.details) continue;
    for (let j = 0; j < 7; j++) {
      if (portal && j === 3) continue;
      const u = (j - 3) * 0.108;
      const low = court.top + 0.25;
      const spring = court.top + 0.36;
      archPanel(
        out,
        'blue',
        project,
        u,
        low,
        spring,
        0.044,
        0.046,
        front + 0.002,
        blueLight,
        tier.arches,
      );
      archPanel(
        out,
        'blue',
        project,
        u,
        low + 0.01,
        spring - 0.002,
        0.031,
        0.035,
        front + 0.004,
        j % 2 ? blue : blueDeep,
        tier.arches,
      );
      if (tier.details < 2) continue;
      panel(
        out,
        'masonry',
        project,
        u - 0.042,
        u + 0.042,
        court.top + 0.033,
        court.top + 0.196,
        front,
        j % 2 ? courtStone : ivory,
      );
      if (tier.details >= 3) {
        const y = court.top + 0.11;
        face(
          out,
          'blue',
          [
            project(u - 0.021, y, front + 0.003),
            project(u, y - 0.027, front + 0.003),
            project(u + 0.021, y, front + 0.003),
            project(u, y + 0.027, front + 0.003),
          ],
          blue,
        );
      }
    }
    const drumRadius = 0.48;
    for (const offset of [-Math.PI / 16, Math.PI / 16]) {
      const b = a + offset;
      const drumProject = (u, y, d) => [
        u * Math.cos(b) + d * Math.sin(b),
        y,
        -u * Math.sin(b) + d * Math.cos(b),
      ];
      panel(
        out,
        'blue',
        drumProject,
        -0.058,
        0.058,
        roofRim + 0.119,
        domeBase - 0.026,
        drumRadius,
        blueDeep,
      );
      panel(
        out,
        'blue',
        drumProject,
        -0.043,
        0.043,
        roofRim + 0.13,
        domeBase - 0.038,
        drumRadius + 0.004,
        blueLight,
      );
      panel(
        out,
        'blue',
        drumProject,
        -0.011,
        0.011,
        roofRim + 0.154,
        domeBase - 0.056,
        drumRadius + 0.007,
        blue,
      );
    }
  }
}

function arcade(out, tier, x, z, width, count) {
  const spring = court.top + 0.225;
  const step = width / count;
  const inner = step * 0.4;
  const outer = step * 0.5;
  const top = spring + outer;
  const depth = 0.065;
  for (let i = 0; i <= count; i++) {
    const u = x - width / 2 + i * step;
    const pier = i === 0 || i === count ? 0.064 : 0.034;
    box(
      out,
      'masonry',
      [u - pier, court.top, z - depth],
      [u + pier, spring, z + depth],
      i % count ? ivory : wallStone,
    );
  }
  for (let j = 0; j < count; j++) {
    const u = x - width / 2 + (j + 0.5) * step;
    for (let i = 0; i < tier.arches; i++) {
      const a = (i * Math.PI) / tier.arches;
      const b = ((i + 1) * Math.PI) / tier.arches;
      const point = (r, t, d) => [u + r * Math.cos(t), spring + r * Math.sin(t), z + d];
      const tint = tier.details > 1 && i % 2 ? ivory : wallStone;
      for (const d of [-depth, depth]) {
        const p = [point(inner, a, d), point(outer, a, d), point(outer, b, d), point(inner, b, d)];
        face(out, 'masonry', d < 0 ? p.reverse() : p, tint);
      }
      face(
        out,
        'masonry',
        [
          point(inner, a, -depth),
          point(inner, a, depth),
          point(inner, b, depth),
          point(inner, b, -depth),
        ],
        wallStone,
      );
      face(
        out,
        'masonry',
        [
          point(outer, b, -depth),
          point(outer, b, depth),
          point(outer, a, depth),
          point(outer, a, -depth),
        ],
        ivory,
      );
    }
  }
  box(
    out,
    'masonry',
    [x - width / 2 - 0.064, top - 0.006, z - 0.085],
    [x + width / 2 + 0.064, top + 0.058, z + 0.085],
    ivory,
  );
}

function steps(out, tier, x, z, width, run) {
  const count = [2, 8, 15, 23, 29][tier.details];
  // Treads touch at the riser faces. The broad stair is open below the terrace arcade.
  for (let i = 0; i < count; i++) {
    const low = (run * i) / count;
    const hi = (run * (i + 1)) / count;
    box(
      out,
      'paving',
      [x - width / 2, -0.1, z + low],
      [x + width / 2, court.top * (1 - i / count), z + hi],
      courtStone,
    );
  }
}

function stairHouse(out, tier, x, z, tower) {
  const width = 0.34;
  const y = tower ? 0.52 : 0.39;
  box(out, 'masonry', [x - width / 2, -0.13, z - 0.16], [x + width / 2, y, z + 0.18], wallStone);
  box(
    out,
    'paving',
    [x - width / 2 - 0.012, y, z - 0.172],
    [x + width / 2 + 0.012, y + 0.022, z + 0.192],
    ivory,
  );
  if (tower) {
    box(out, 'masonry', [x - 0.1, y, z - 0.089], [x + 0.1, y + 0.17, z + 0.101], ivory);
    dome(out, 'masonry', [x, z], y + 0.17, 0.096, 0.053, { dome: 8, rings: 3 }, courtStone);
  }
  const front = (u, height, depth) => [x + u, height, z + depth];
  archPanel(out, 'dark', front, 0, 0.014, 0.21, 0.07, 0.053, 0.182, door, tier.arches);
}

function pavilion(out, tier, x, z, radius) {
  const bottom = court.top;
  if (!tier.details) {
    const rim = bottom + radius * 1.75;
    loft(out, 'masonry', [ring(radius, bottom, 6, [x, z]), ring(radius, rim, 6, [x, z])], ivory);
    dome(out, 'masonry', [x, z], rim, radius, radius * 0.78, { dome: 6, rings: 2 }, courtStone);
    return;
  }
  loft(
    out,
    'masonry',
    [ring(radius * 1.12, bottom, 8, [x, z]), ring(radius * 1.12, bottom + 0.035, 8, [x, z])],
    wallStone,
  );
  const y = bottom + radius * 1.75;
  for (const [px, , pz] of ring(radius * 0.84, bottom, 6, [x, z])) {
    const w = radius * 0.13;
    box(out, 'masonry', [px - w, bottom + 0.034, pz - w], [px + w, y, pz + w], ivory);
  }
  loft(out, 'masonry', [ring(radius, y, 8, [x, z]), ring(radius, y + 0.022, 8, [x, z])], ivory);
  dome(
    out,
    'masonry',
    [x, z],
    y + 0.02,
    radius * 0.93,
    radius * 0.78,
    { dome: 10, rings: tier.details > 1 ? 5 : 3 },
    courtStone,
  );
}

const chainPavilionCenter = [-1.53, -0.51];

function chainPavilion(out, tier) {
  const center = chainPavilionCenter;
  const floor = court.top + 0.028;
  const eave = court.top + 0.329;
  const roof = [0.095, 0.23, 0.32];
  const top = (r, y) => ring(r, y, tier.details ? 8 : 6, center, Math.PI / 8);
  loft(out, 'masonry', [top(0.352, court.top), top(0.352, floor)], wallStone);
  if (!tier.details) {
    loft(out, 'masonry', [top(0.322, floor), top(0.322, eave)], ivory);
  } else {
    for (const [x, , z] of top(0.314, floor)) {
      box(
        out,
        'masonry',
        [x - 0.028, floor, z - 0.028],
        [x + 0.028, floor + 0.038, z + 0.028],
        wallStone,
      );
      box(
        out,
        'masonry',
        [x - 0.016, floor + 0.038, z - 0.016],
        [x + 0.016, eave - 0.03, z + 0.016],
        ivory,
      );
      box(
        out,
        'masonry',
        [x - 0.027, eave - 0.04, z - 0.027],
        [x + 0.027, eave, z + 0.027],
        courtStone,
      );
    }
    loft(out, 'masonry', [top(0.369, eave - 0.038), top(0.369, eave)], ivory);
  }
  loft(
    out,
    'lead',
    [
      top(0.403, eave - 0.002),
      top(0.403, eave + 0.015),
      top(0.194, eave + 0.093),
      top(0.162, eave + 0.093),
    ],
    roof,
  );
  dome(
    out,
    'lead',
    center,
    eave + 0.092,
    0.164,
    0.121,
    {
      dome: tier.details > 1 ? 16 : 8,
      rings: tier.details > 1 ? 6 : 2,
    },
    roof,
    tier.details > 1,
  );
}

function stairPlanters(out) {
  // The elongated wells sit below the terrace between the open stair flights.
  for (const [left, right] of [
    [-1.98, -0.63],
    [1.2, 1.97],
  ]) {
    const front = 2.67;
    const back = court.z1 + 0.013;
    const rim = 0.146;
    box(out, 'masonry', [left, 0.02, back], [right, rim, back + 0.025], ivory);
    box(out, 'masonry', [left, 0.02, front - 0.028], [right, rim, front], ivory);
    for (const x of [left, right - 0.027]) {
      box(out, 'masonry', [x, 0.02, back + 0.025], [x + 0.027, rim, front - 0.028], wallStone);
    }
    box(
      out,
      'masonry',
      [left + 0.027, 0.021, back + 0.025],
      [right - 0.027, 0.057, front - 0.028],
      [0.206, 0.172, 0.114],
    );
  }
}

function westFacade(out) {
  const turn = ([x, y, z]) => [-z, y, x];
  return {
    addQuad: (slot, ref, points, n, uv, color) =>
      out.addQuad(slot, ref, points.map(turn), turn(n), uv, color),
  };
}

export function buildDomeExhibit(out, level = 'master') {
  const tier = tiers[level];
  const { x0, x1, z0, z1, top } = court;
  box(out, 'masonry', [x0, -0.32, z0], [x1, top - 0.016, z1], wallStone);
  box(
    out,
    'paving',
    [x0 - 0.014, top - 0.016, z0 - 0.014],
    [x1 + 0.014, top, z1 + 0.014],
    courtStone,
  );
  for (const [x, width, count, run] of [
    [-2.51, 0.91, 3, 0.84],
    [0.2, 1.12, 4, 0.9],
    [2.55, 0.74, 3, 0.68],
  ]) {
    arcade(out, tier, x, z1 - 0.11, width, count);
    steps(out, tier, x, z1, width, run);
  }
  shrine(out, tier);
  chainPavilion(out, tier);
  pavilion(out, tier, -1.64, 1.0, 0.17);
  if (tier.details) {
    const west = westFacade(out);
    for (const z of [-1.65, 0.08]) arcade(west, tier, z, -x0 - 0.12, 0.64, 3);
    pavilion(out, tier, -2.66, -1.57, 0.13);
    for (const x of [-1.73, -1.32, -0.82, 0.94, 1.44, 1.91, 3.04]) {
      box(out, 'masonry', [x - 0.039, 0.036, z1], [x + 0.039, top - 0.039, z1 + 0.07], ivory);
    }
  }
  if (tier.details >= 2) {
    stairPlanters(out);
    stairHouse(out, tier, -0.54, 2.61, true);
    stairHouse(out, tier, 0.94, 2.61, false);
    stairHouse(out, tier, 2.0, 2.58, true);
    stairHouse(out, tier, 3.1, 2.58, false);
  }
}

export const buildSkyline = (out) => buildDomeExhibit(out, 'skyline');
export const buildDistrict = (out) => buildDomeExhibit(out, 'district');
export const buildStreet = (out) => buildDomeExhibit(out, 'street');
export const buildCloseup = (out) => buildDomeExhibit(out, 'closeup');
