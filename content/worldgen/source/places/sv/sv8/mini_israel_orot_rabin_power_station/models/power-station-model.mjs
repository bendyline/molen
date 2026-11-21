import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { exhibitGlyphs, exhibitLettering } from './exhibit-sign-lettering.mjs';

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
  apron: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
};

const ivory = [0.78, 0.77, 0.69];
const zinc = [0.49, 0.53, 0.53];
const steel = [0.31, 0.36, 0.38];
const braces = [0.54, 0.56, 0.53];
const beige = [0.74, 0.68, 0.51];
const yellow = [0.87, 0.61, 0.13];
const blue = [0.094, 0.36, 0.57];
const charcoal = [0.19, 0.21, 0.22];
const coal = [0.054, 0.058, 0.056];
const rust = [0.43, 0.19, 0.15];
const base = 0.075;

// The canal-side rim recedes behind the chimney in the November 2011 view.
export const plantApronOutline = [
  [-3.04, -2.625],
  [-3.91, 0.42],
  [-3.91, 1.445],
  [3.91, 1.445],
  [3.91, -2.625],
];
export const visitorApronOutline = [
  [-3.87, 1.445],
  [-3.87, 2.645],
  [3.89, 2.645],
  [3.89, 1.445],
];

// The buried part extends below the mapped basin so the bank closes against its water surface.
const foundationBase = -1.35;

function block(out, slot, x, y, z, width, height, depth, tint) {
  box(
    out,
    slot,
    [x - width / 2, y, z - depth / 2],
    [x + width / 2, y + height, z + depth / 2],
    tint,
  );
}

function frustum(out, slot, x, y, z, width, height, depth, slopeX, slopeZ, tint) {
  const corners = (h, w, d) => [
    [x - w, h, z - d],
    [x - w, h, z + d],
    [x + w, h, z + d],
    [x + w, h, z - d],
  ];
  loft(
    out,
    slot,
    [corners(y, width / 2, depth / 2), corners(y + height, width / 2 - slopeX, depth / 2 - slopeZ)],
    tint,
  );
}

function stack(out, detail) {
  const x = -2.48;
  const z = -0.26;
  const sides = [10, 16, 24, 36, 48][detail];
  // The clear November 2011 view gives about 3.97 m from the shaft foot to the cap.
  const rings = [
    [base + 0.1, 0.31],
    [0.69, 0.275],
    [1.619, 0.226],
    [2.632, 0.172],
    [4.103, 0.124],
  ];
  const ring = (y, radius) => radialRing(y, radius, radius, sides, [x, z]);
  block(out, 'concrete', x, base, z, 0.86, 0.11, 0.78, zinc);
  loft(
    out,
    'concrete',
    rings.map(([y, r]) => ring(y, r)),
    ivory,
  );
  loft(out, 'frame', [ring(4.095, 0.136), ring(4.14, 0.136)], zinc);
  if (detail === 0) return;
  for (const [y, r] of rings.slice(1, -1)) {
    loft(out, 'frame', [ring(y - 0.015, r + 0.011), ring(y + 0.018, r + 0.011)], zinc);
  }
  if (detail >= 2) {
    block(out, 'concrete', x - 0.025, 0.132, z + 0.235, 0.32, 0.34, 0.23, ivory);
    block(out, 'paint', x - 0.025, 0.145, z + 0.353, 0.1, 0.21, 0.014, charcoal);
  }
}

function boiler(out, detail, x, z, width, depth, height, annex = false) {
  const foot = base + 0.035;
  const h = height - 0.24;
  const left = x - width / 2;
  const right = x + width / 2;
  const front = z + depth / 2;
  const back = z - depth / 2;
  block(out, 'frame', x, foot, z, width * 0.67, h, depth * 0.69, annex ? steel : charcoal);
  block(out, 'frame', x, h, z, width + 0.09, 0.23, depth + 0.09, zinc);
  block(out, 'concrete', x, height - 0.014, z, width + 0.12, 0.043, depth + 0.12, ivory);
  const fullStories = annex ? 6 : 10;
  const stories = [2, fullStories - 3, fullStories, fullStories, fullStories][detail];
  const faces = [
    [
      [left, front],
      [right, front],
    ],
    [
      [right, front],
      [right, back],
    ],
    [
      [right, back],
      [left, back],
    ],
    [
      [left, back],
      [left, front],
    ],
  ];
  for (const [[ax, az], [bx, bz]] of faces) {
    beam(out, 'frame', [ax, foot, az], [ax, h, az], 0.045, 0.045, braces);
    if (detail === 0 && ax === bx) continue;
    for (let story = 0; story <= stories; story++) {
      const y = foot + ((h - foot) * story) / stories;
      beam(out, 'frame', [ax, y, az], [bx, y, bz], 0.028, 0.031, zinc);
      if (detail === 0 || story === stories) continue;
      const upper = foot + ((h - foot) * (story + 1)) / stories;
      const middleX = (ax + bx) / 2;
      const middleZ = (az + bz) / 2;
      if (detail === 1) {
        beam(out, 'frame', [ax, y, az], [bx, upper, bz], 0.016, 0.018, braces);
        continue;
      }
      const direction = story % 2 === 0;
      beam(
        out,
        'frame',
        [ax, direction ? y : upper, az],
        [middleX, direction ? upper : y, middleZ],
        0.012,
        0.012,
        braces,
      );
      beam(
        out,
        'frame',
        [bx, direction ? y : upper, bz],
        [middleX, direction ? upper : y, middleZ],
        0.012,
        0.012,
        braces,
      );
    }
    if (detail >= 2) {
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      beam(out, 'frame', [mx, foot, mz], [mx, h, mz], 0.027, 0.027, zinc);
      for (let i = 1; i < 7; i++) {
        const k = i / 7;
        const tx = ax + (bx - ax) * k;
        const tz = az + (bz - az) * k;
        beam(out, 'frame', [tx, h, tz], [tx, h + 0.22, tz], 0.015, 0.015, braces);
      }
    }
  }
  if (detail >= 2 && !annex) {
    for (const dx of [-0.28, 0.12]) {
      beam(
        out,
        'frame',
        [x + dx, 0.19, front - 0.083],
        [x + dx, h, front - 0.083],
        0.041,
        0.041,
        rust,
      );
    }
  }
}

function serviceBuildings(out, detail) {
  block(out, 'concrete', 1.87, base, -0.42, 0.91, 1.32, 1.17, beige);
  block(out, 'concrete', 1.85, 1.39, -0.42, 0.98, 0.062, 1.23, ivory);
  for (const y of [0.37, 0.48]) {
    block(out, 'paint', 1.87, y, 0.17, 0.915, 0.056, 0.018, blue);
    block(out, 'paint', 2.326, y, -0.42, 0.014, 0.056, 1.17, blue);
  }
  block(out, 'frame', -1.61, base + 0.01, -0.05, 0.55, 0.49, 1.71, steel);
  const duct = [
    [-2.2, 0.39, -0.26],
    [-1.91, 0.91, -0.26],
    [-1.34, 0.91, -0.26],
    [-0.57, 0.47, 0.32],
    [-0.21, 0.47, 0.32],
  ];
  for (let i = 1; i < duct.length; i++) {
    beam(out, 'frame', duct[i - 1], duct[i], 0.32, 0.38, zinc);
  }
  for (const [x, z] of [
    [2.68, -1.87],
    [3.36, -1.83],
  ]) {
    const ring = (y, r) => radialRing(y, r, r, [10, 14, 20, 28, 32][detail], [x, z]);
    loft(out, 'concrete', [ring(base, 0.28), ring(0.51, 0.28), ring(0.56, 0.24)], beige);
  }
  block(out, 'frame', 3.61, base, -0.73, 0.51, 0.34, 0.66, zinc);
  if (detail === 0) return;
  for (const x of [2.53, 2.82, 3.27]) {
    beam(out, 'frame', [x, base, 0.41], [x + 0.06, 0.67, -0.29], 0.055, 0.05, yellow);
  }
  beam(out, 'frame', [2.47, 0.64, -0.28], [3.42, 0.64, -0.28], 0.075, 0.063, yellow);
  if (detail < 2) return;
  for (const y of [0.31, 0.41]) {
    beam(out, 'frame', [-1.94, y, 0.92], [-0.99, y, 0.92], 0.022, 0.024, yellow);
  }
  for (let i = 0; i < 7; i++) {
    const x = -1.94 + i * 0.157;
    beam(out, 'frame', [x, 0.26, 0.92], [x, 0.421, 0.92], 0.016, 0.017, yellow);
  }
  for (const x of [-1.43, -1.07, -0.8]) {
    block(out, 'frame', x, 0.545, 0.05, 0.19, 0.36, 0.23, zinc);
  }
}

function conveyor(out, detail) {
  const transfer = [1.53, 1.795, -0.11];
  const quay = [3.73, 0.435, -0.67];
  // The enclosed inclined belt connects the upper gallery to the small quay headhouse.
  beam(out, 'frame', transfer, quay, 0.19, 0.14, zinc);
  if (detail === 0) return;
  const galleryStart = [-0.15, 1.795, -0.11];
  beam(out, 'concrete', galleryStart, transfer, 0.165, 0.105, ivory);
  beam(out, 'concrete', [1.53, 1.862, -0.11], [3.73, 0.502, -0.67], 0.211, 0.032, ivory);
  block(out, 'frame', 3.68, 0.37, -0.68, 0.32, 0.17, 0.33, steel);
  if (detail < 2) return;
  for (const x of [2.46, 3.21]) {
    const fraction = (x - transfer[0]) / (quay[0] - transfer[0]);
    const y = transfer[1] + fraction * (quay[1] - transfer[1]) - 0.05;
    const z = transfer[2] + fraction * (quay[2] - transfer[2]);
    for (const dz of [-0.087, 0.087]) {
      beam(out, 'frame', [x, base, z + dz], [x, y, z + dz], 0.024, 0.024, steel);
    }
    beam(out, 'frame', [x, base, z - 0.087], [x, y, z + 0.087], 0.018, 0.018, zinc);
  }
  for (let bay = 0; bay < 8; bay++) {
    const x = galleryStart[0] + (bay * (transfer[0] - galleryStart[0])) / 8;
    beam(out, 'frame', [x, 1.65, 0.045], [x + 0.206, 1.746, 0.045], 0.016, 0.016, steel);
  }
  beam(out, 'frame', [-0.15, 1.65, 0.045], [1.53, 1.65, 0.045], 0.022, 0.024, zinc);
}

function coalWall(out, detail) {
  frustum(out, 'concrete', 0.02, base, 1.03, 7.52, 0.45, 0.93, 0.02, 0.21, beige);
  block(out, 'paint', 0.02, 0.52, 1.02, 7.46, 0.09, 0.41, coal);
  if (detail === 0) return;
  const count = [0, 24, 45, 60, 72][detail];
  for (let i = 0; i < count; i++) {
    const x = -3.62 + (i * 7.27) / (count - 1);
    const height = 0.065 + ((i * 17 + 21) % 23) * 0.003;
    const r = (7.4 / count) * (0.43 + (i % 4) * 0.045);
    const z = 1.03 + (((i * 13) % 11) - 5) * 0.011;
    const tint = i % 3 === 0 ? [0.084, 0.089, 0.084] : coal;
    loft(
      out,
      'paint',
      [
        radialRing(0.58, r, 0.16, 5, [x, z], i * 0.23),
        radialRing(0.58 + height, r * 0.58, 0.087, 5, [x + r * 0.21, z], i * 0.23),
      ],
      tint,
    );
  }
  if (detail < 2) return;
  for (const x of [-1.46, 1.07, 3.16]) {
    for (const dx of [-0.047, 0.047]) {
      beam(out, 'frame', [x + dx, 0.081, 1.502], [x + dx, 0.538, 1.269], 0.013, 0.013, zinc);
    }
    for (let i = 0; i < 7; i++) {
      const y = 0.109 + i * 0.062;
      const z = 1.491 - i * 0.032;
      beam(out, 'frame', [x - 0.047, y, z], [x + 0.047, y, z], 0.012, 0.013, zinc);
    }
  }
}

function visitorArea(out, detail) {
  loft(
    out,
    'apron',
    [foundationBase, base].map((y) => plantApronOutline.map(([x, z]) => [x, y, z])),
    [0.59, 0.57, 0.5],
  );
  block(out, 'apron', 0.01, foundationBase, 2.045, 7.76, -foundationBase, 1.2, [0.59, 0.57, 0.5]);
  block(out, 'apron', 0.01, 0, 2.02, 7.76, 0.052, 1.25, [0.42, 0.43, 0.43]);
  block(out, 'concrete', -2.45, 0.05, 1.94, 1.22, 0.035, 0.45, beige);
  block(out, 'paint', -2.09, 0.085, 2.04, 0.89, 0.23, 0.39, blue);
  const visitorRing = (y, r) =>
    radialRing(y, r, r * 0.87, [10, 14, 24, 32, 40][detail], [-2.7, 2.05]);
  loft(out, 'paint', [visitorRing(0.085, 0.47), visitorRing(0.341, 0.47)], yellow);
  loft(out, 'concrete', [visitorRing(0.338, 0.51), visitorRing(0.372, 0.5)], ivory);
  block(out, 'paint', 1.69, 0.053, 2.31, 0.32, 0.18, 0.22, yellow);
  block(out, 'frame', 1.69, 0.233, 2.31, 0.37, 0.039, 0.27, zinc);
  if (detail < 2) return;
  for (let i = 0; i < 18; i++) {
    const x = -1.04 + i * 0.25;
    if (i === 10 || i === 11) continue;
    block(out, 'paint', x, 0.052, 1.757, 0.013, 0.0025, 0.29, ivory);
  }
  block(out, 'paint', 1.69, 0.127, 2.423, 0.238, 0.058, 0.012, blue);
  block(out, 'paint', -2.7, 0.125, 2.462, 0.16, 0.163, 0.012, blue);
  for (const [x, z, tint] of [
    [-0.61, 1.75, [0.69, 0.08, 0.052]],
    [0.67, 1.73, zinc],
    [2.27, 1.76, blue],
    [3.09, 1.74, ivory],
  ]) {
    block(out, 'paint', x, 0.059, z, 0.087, 0.056, 0.173, tint);
    block(out, 'paint', x, 0.115, z - 0.01, 0.075, 0.028, 0.094, charcoal);
    if (detail >= 3) {
      for (const dx of [-0.045, 0.045]) {
        for (const dz of [-0.046, 0.046]) {
          block(out, 'paint', x + dx, 0.055, z + dz, 0.018, 0.032, 0.036, charcoal);
        }
      }
    }
  }
}

function exhibitSign(out, detail) {
  const x = -1.5;
  const z = 2.51;
  const faceZ = z + 0.026;
  const mustard = [0.8, 0.59, 0.26];
  const backing = [0.29, 0.42, 0.5];
  const ink = [0.06, 0.075, 0.1];
  block(out, 'frame', x, 0.05, z - 0.046, 0.062, 0.68, 0.062, zinc);
  block(out, 'frame', x, 0.45, z - 0.014, 0.07, 0.12, 0.026, zinc);
  block(out, 'frame', x, 0.622, z, 0.7, 0.356, 0.033, backing);
  block(out, 'paint', x - 0.088, 0.696, z + 0.018, 0.493, 0.262, 0.012, mustard);
  block(out, 'paint', x + 0.249, 0.696, z + 0.018, 0.162, 0.262, 0.012, blue);
  block(out, 'paint', x, 0.412, z + 0.01, 0.54, 0.196, 0.026, mustard);

  const flat = (u, v) => [x + u, v, faceZ];
  const disk = (u, v, width, height, color, count = 16) => {
    const face = Array.from({ length: count }, (_, i) => {
      const angle = (i * Math.PI * 2) / count;
      return flat(u + width * Math.cos(angle), v + height * Math.sin(angle));
    });
    out.addConvexPolygon('paint', 'palette:#ffffff', face, [0, 0, 1], () => [0, 0], color);
  };
  disk(-0.248, 0.658, 0.05, 0.028, [0.58, 0.13, 0.13]);
  disk(0.11, 0.658, 0.035, 0.027, ivory);
  const shore = [
    [0.202, 0.698],
    [0.324, 0.698],
    [0.324, 0.953],
    [0.298, 0.953],
    [0.275, 0.874],
    [0.237, 0.816],
  ].map(([u, v]) => flat(u, v));
  out.addConvexPolygon('paint', 'palette:#ffffff', shore, [0, 0, 1], () => [0, 0], mustard);
  if (detail < 3) return;

  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 19; i++) {
      const u = -0.322 + i * 0.018;
      if (u > -0.3 && u < -0.193) continue;
      if (u > 0.071 && u < 0.15) continue;
      disk(u, 0.637 + row * 0.045, 0.0032, 0.0032, ink, 6);
    }
  }
  for (const [line, { run, scale, y }] of exhibitLettering.entries()) {
    for (const [id, offset] of run) {
      const { positions, indices } = exhibitGlyphs[id];
      for (let i = 0; i < indices.length; i += 3) {
        const points = indices
          .slice(i, i + 3)
          .map((index) => [
            x + offset + positions[index * 2] * scale,
            y + positions[index * 2 + 1] * scale,
            faceZ + 0.001,
          ]);
        out.addTriangle(
          'paint',
          'palette:#ffffff',
          points,
          [0, 0, 1],
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          line === 5 ? ivory : ink,
        );
      }
    }
  }
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };

export function buildPowerStation(out, tier) {
  const detail = tiers[tier];
  visitorArea(out, detail);
  stack(out, detail);
  // Both main boiler roofs measure near 2.1 m from the two closest archive views.
  boiler(out, detail, -0.32, -1.56, 0.94, 0.81, 2.07);
  boiler(out, detail, 0.65, -0.33, 1.22, 1.08, 2.07);
  if (detail === 0) {
    block(out, 'frame', 1.29, base, 0.11, 0.42, 1.75, 0.6, steel);
  } else {
    boiler(out, detail, 1.29, 0.11, 0.43, 0.57, 1.76, true);
  }
  serviceBuildings(out, detail);
  conveyor(out, detail);
  coalWall(out, detail);
  if (detail >= 2) exhibitSign(out, detail);
}

export const buildSkyline = (out) => buildPowerStation(out, 'skyline');
export const buildDistrict = (out) => buildPowerStation(out, 'district');
export const buildStreet = (out) => buildPowerStation(out, 'street');
export const buildCloseup = (out) => buildPowerStation(out, 'closeup');
