import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  retaining: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  terraces: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  platform: { slot: 'wall', graph: 'metal_painted', roughness: 0.88 },
  rig: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.16 },
  seating: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
};

const sand = [0.54, 0.441, 0.32];
const concrete = [0.52, 0.48, 0.414];
const steel = [0.5, 0.54, 0.53];
const rails = [0.315, 0.349, 0.328];
const cladding = [0.052, 0.058, 0.056];
const decks = [0.129, 0.133, 0.111];
const seating = [0.35, 0.367, 0.251];
const tint = (color, factor) => color.map((value) => value * factor);
const stageWidth = 19.5;
const apronZ = 6.6;
const stageY = 0.94;
const apronY = 0.3;
const firstTierY = 0.96;
const lastTierY = 4.83;
const floorY = -2.9;
const rowCount = 20;

// Local +Z faces the audience. The two profiles trace the visible seating terrace edges.
export const audienceFront = [
  [-12.8, 13.9],
  [-7.9, 11.1],
  [0.7, 9.85],
  [7.95, 9.22],
  [13.3, 9.9],
];
export const audienceBack = [
  [-19.85, 25.45],
  [-10.2, 33.0],
  [1.9, 32.16],
  [14.1, 29.47],
  [22.25, 21.2],
];
export const siteOutline = [
  [-10.87, -4.39],
  [11.62, -4.64],
  [12.46, 4.92],
  ...[0, 0.15, 0.3, 0.391, 0.55, 0.7, 0.743, 0.85, 1]
    .map((progress) => terracePoint(1, progress, 0))
    .map(([x, , z]) => [x, z]),
  ...audienceBack.slice(0, -1).toReversed(),
  [-12.8, 13.9],
  [-10.83, 6.8],
];

const sectors = [
  { start: 0.016, end: 0.285 },
  { start: 0.321, end: 0.661 },
  { start: 0.704, end: 0.982 },
];

function blend(a, b, t) {
  return a.map((value, i) => value + (b[i] - value) * t);
}

function profile(points, t) {
  const u = t * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(u));
  return blend(points[i], points[i + 1], u - i);
}

export function terracePoint(t, progress, y) {
  const [x, z] = blend(profile(audienceFront, t), profile(audienceBack, t), progress);
  // The west retaining wall bends inward by the visitor path.
  const [edgeX, edgeZ] = blend(audienceFront.at(-1), audienceBack.at(-1), progress);
  const pathX =
    edgeZ <= 14.32
      ? 15.28 + (14.32 - edgeZ) * 0.649
      : edgeZ <= 18.29
        ? 15.28 + (edgeZ - 14.32) * 1.39
        : 20.8 + (edgeZ - 18.29) * 2.34;
  const pathBend = Math.max(0, edgeX + 3.12 - pathX) * Math.pow(t, 4);
  return [x - pathBend, y, z];
}

function face(out, slot, corners, color) {
  quad(out, slot, corners, normalFor(...corners), color);
}

function audienceDeck(out, detail) {
  const divisions = detail.bowlDivisions;
  const segment = (progress, elevation, i) => terracePoint(i / divisions, progress, elevation);
  let previousY = apronY;
  for (let step = 0; step < detail.rows; step++) {
    const near = step / detail.rows;
    const far = (step + 1) / detail.rows;
    const y = firstTierY + (step * (lastTierY - firstTierY)) / (detail.rows - 1);
    const color = tint(concrete, 0.92 + (step % 4) * 0.023);
    for (let i = 0; i < divisions; i++) {
      const nearLeft = segment(near, y, i);
      const nearRight = segment(near, y, i + 1);
      face(
        out,
        'terraces',
        [nearLeft, segment(far, y, i), segment(far, y, i + 1), nearRight],
        color,
      );
      face(
        out,
        'terraces',
        [nearLeft, nearRight, segment(near, previousY, i + 1), segment(near, previousY, i)],
        tint(color, 0.87),
      );
    }
    for (const end of [0, divisions]) {
      const wall = [
        segment(near, floorY, end),
        segment(near, y, end),
        segment(far, y, end),
        segment(far, floorY, end),
      ];
      face(
        out,
        'retaining',
        end === 0 ? wall.toReversed() : wall,
        tint(sand, 0.93 + (step % 3) * 0.037),
      );
    }
    previousY = y;
  }
  for (let i = 0; i < divisions; i++) {
    const edge = [
      segment(1, floorY, i),
      segment(1, floorY, i + 1),
      segment(1, previousY, i + 1),
      segment(1, previousY, i),
    ];
    face(out, 'retaining', edge, sand);
    if (detail.rails) {
      beam(
        out,
        'rig',
        segment(1, previousY + 1.03, i),
        segment(1, previousY + 1.03, i + 1),
        0.045,
        0.045,
        rails,
      );
      beam(
        out,
        'rig',
        segment(1, previousY, i),
        segment(1, previousY + 1.03, i),
        0.045,
        0.045,
        rails,
      );
    }
  }
}

function chairs(out, detail) {
  for (let row = 0; row < detail.rows; row++) {
    const progress = (row + 0.5) / detail.rows;
    const y = firstTierY + (row * (lastTierY - firstTierY)) / (detail.rows - 1);
    for (const { start, end } of sectors) {
      const [lx, , lz] = terracePoint(start, progress, y);
      const [rx, , rz] = terracePoint(end, progress, y);
      const length = Math.hypot(rx - lx, rz - lz);
      const count = detail.chairs
        ? Math.floor(length / detail.seatInterval)
        : Math.ceil(length / 4.3);
      for (let i = 0; i < count; i++) {
        const mid = start + ((i + 0.5) * (end - start)) / count;
        const span = (((end - start) / count) * (detail.chairs ? 0.82 : 1.006)) / 2;
        const [a, b] = [
          terracePoint(mid - span, progress, y),
          terracePoint(mid + span, progress, y),
        ];
        const [x, , z] = terracePoint(mid, progress, y);
        const color = tint(seating, 0.92 + 0.14 * Math.sin(row * 0.6 + i * 0.54));
        if (!detail.chairs) {
          beam(out, 'seating', [a[0], y + 0.47, a[2]], [b[0], y + 0.47, b[2]], 0.135, 0.25, color);
          continue;
        }
        beam(
          out,
          'seating',
          [a[0], y + 0.74, a[2] + 0.08],
          [b[0], y + 0.74, b[2] + 0.08],
          0.13,
          0.2,
          color,
        );
        beam(
          out,
          'seating',
          [a[0], y + 0.42, a[2] - 0.08],
          [b[0], y + 0.42, b[2] - 0.08],
          0.34,
          0.087,
          tint(color, 0.94),
        );
        if (detail.posts) beam(out, 'rig', [x, y + 0.05, z], [x, y + 0.55, z], 0.042, 0.043, rails);
      }
    }
  }
}

function truss(out, start, end, ribs) {
  const [x, y, z] = start;
  const [ex, ey, ez] = end;
  const vertical = y !== ey;
  const yOff = vertical ? 0 : 0.22;
  const zOff = vertical ? 0.22 : 0;
  for (const sign of [-1, 1]) {
    beam(
      out,
      'rig',
      [x, y + yOff * sign, z + zOff * sign],
      [ex, ey + yOff * sign, ez + zOff * sign],
      0.09,
      0.09,
      steel,
    );
  }
  for (let i = 0; i < ribs; i++) {
    const [a, b] = [blend(start, end, i / ribs), blend(start, end, (i + 1) / ribs)];
    const sign = i % 2 ? 1 : -1;
    beam(
      out,
      'rig',
      [a[0], a[1] + yOff * sign, a[2] + zOff * sign],
      [b[0], b[1] - yOff * sign, b[2] - zOff * sign],
      0.038,
      0.038,
      steel,
    );
  }
}

function stage(out, detail) {
  const half = stageWidth / 2;
  const top = 8.62;
  box(out, 'retaining', [-10.85, floorY, -4.3], [11.54, -0.19, 6.75], sand);
  box(out, 'platform', [-half, -0.19, -3.62], [half, stageY, apronZ], decks);
  box(out, 'platform', [-half, stageY, -3.48], [half, 5.02, -3.17], cladding);
  for (const side of [-1, 1]) {
    const x = side * (half - 0.22);
    box(out, 'platform', [x - 0.24, stageY, -3.46], [x + 0.24, 2.95, -0.67], cladding);
    for (const z of [-3.05, 5.92]) {
      truss(out, [x, stageY, z], [x, top, z], detail.diagonals);
    }
    truss(out, [x, top, -3.05], [x, top, 5.92], detail.diagonals);
    for (let step = 0; step < 3; step++) {
      const y = stageY - step * 0.21;
      const sx = side * (half - 1.25);
      box(
        out,
        'terraces',
        [sx - 0.82, -0.24, apronZ + step * 0.31],
        [sx + 0.82, y, apronZ + (step + 1) * 0.31],
        concrete,
      );
    }
  }
  for (const z of [-3.05, 0, 2.99, 5.92])
    truss(out, [-half + 0.22, top, z], [half - 0.22, top, z], detail.diagonals + 1);
  for (const x of [-3.25, 3.25]) truss(out, [x, top, -3.05], [x, top, 5.92], detail.diagonals);
  for (let i = 0; i < audienceFront.length - 1; i++) {
    const t = i / (audienceFront.length - 1);
    const next = (i + 1) / (audienceFront.length - 1);
    const innerA = [-10.85 + 22.39 * t, apronY, 6.61];
    const innerB = [-10.85 + 22.39 * next, apronY, 6.61];
    face(
      out,
      'terraces',
      [innerA, terracePoint(t, 0, apronY), terracePoint(next, 0, apronY), innerB],
      tint(sand, 0.78),
    );
  }
  for (const [t, x] of [
    [0, -10.85],
    [1, 11.54],
  ]) {
    const rim = terracePoint(t, 0, apronY);
    const side = [[x, floorY, 6.61], [x, apronY, 6.61], rim, [rim[0], floorY, rim[2]]];
    face(out, 'retaining', t === 0 ? side.toReversed() : side, tint(sand, 0.85));
  }
  for (const t of [0.305, 0.683]) {
    const [x, , z] = terracePoint(t, 0, apronY);
    box(out, 'terraces', [x - 0.59, apronY, z - 0.81], [x + 0.59, 0.52, z - 0.52], concrete);
    box(out, 'terraces', [x - 0.59, apronY, z - 0.52], [x + 0.59, 0.74, z - 0.25], concrete);
    box(out, 'terraces', [x - 0.59, apronY, z - 0.25], [x + 0.59, 0.955, z + 0.04], concrete);
  }
  if (!detail.rails) return;
  for (let x = -8.7; x <= 8.8; x += 1.16) {
    beam(out, 'platform', [x, stageY, -3.16], [x, 4.98, -3.16], 0.035, 0.04, decks);
  }
  for (const x of [-13.1, 13.35]) {
    beam(out, 'rig', [x, -0.22, 7.6], [x, 6.26, 7.6], 0.11, 0.11, steel);
    beam(out, 'rig', [x - 0.56, 6.29, 7.6], [x + 0.56, 6.29, 7.6], 0.16, 0.15, steel);
  }
}

function build(out, detail) {
  audienceDeck(out, detail);
  if (detail.rows > 7) chairs(out, detail);
  stage(out, detail);
}

export const buildSkyline = (out) => build(out, { rows: 5, bowlDivisions: 4, diagonals: 1 });
export const buildDistrict = (out) => build(out, { rows: 10, bowlDivisions: 8, diagonals: 3 });
export const buildStreet = (out) =>
  build(out, { rows: rowCount, bowlDivisions: 12, diagonals: 7, rails: true });
export const buildCloseup = (out) =>
  build(out, {
    rows: rowCount,
    bowlDivisions: 16,
    diagonals: 9,
    rails: true,
    chairs: true,
    seatInterval: 0.53,
  });
export const buildMaster = (out) =>
  build(out, {
    rows: rowCount,
    bowlDivisions: 20,
    diagonals: 12,
    rails: true,
    chairs: true,
    seatInterval: 0.51,
    posts: true,
  });
