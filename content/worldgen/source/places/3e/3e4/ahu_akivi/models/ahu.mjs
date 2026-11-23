import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  tuff: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.99 },
  wall: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.99 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.99 },
};
const ash = rgb('737365');
const tawny = rgb('8f8067');
const darkWall = rgb('777964');
const fill = rgb('929780');
const scoria = rgb('a4634d');

// Height, half width, half depth, forward shift, mid-face ridge, and eye recess.
const humanProfile = [
  [0, 0.105, 0.075, 0, 0, 0],
  [0.025, 0.122, 0.085, 0, 0, 0],
  [0.15, 0.139, 0.106, 0.013, 0, 0],
  [0.24, 0.146, 0.117, 0.016, 0, 0],
  [0.35, 0.143, 0.109, 0.01, 0, 0],
  [0.45, 0.153, 0.091, -0.003, 0, 0],
  [0.502, 0.131, 0.078, -0.006, 0, 0],
  [0.542, 0.111, 0.08, -0.006, 0, 0],
  [0.574, 0.111, 0.085, 0, 0.011, 0],
  [0.609, 0.125, 0.101, 0.013, 0.02, 0],
  [0.64, 0.119, 0.093, 0.01, 0.017, 0],
  [0.654, 0.115, 0.093, 0.008, 0.009, 0],
  [0.69, 0.116, 0.094, 0.01, 0.027, 0],
  [0.727, 0.117, 0.089, 0.008, 0.06, 0],
  [0.769, 0.118, 0.09, 0.006, 0.046, 0.007],
  [0.801, 0.116, 0.091, 0.003, 0.033, 0.03],
  [0.825, 0.117, 0.092, 0.005, 0.024, 0.023],
  [0.853, 0.122, 0.098, 0.004, 0.027, 0],
  [0.886, 0.118, 0.096, 0.003, 0.013, 0],
  [0.931, 0.116, 0.09, 0, 0, 0],
  [0.972, 0.108, 0.086, 0.001, 0, 0],
  [1, 0.086, 0.075, 0.003, 0, 0],
];
const profiles = [
  [0, 3, 5, 9, 13, 17, 21],
  [0, 2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21],
  [0, 1, 3, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 19, 20, 21],
  humanProfile.map((_, i) => i),
];

function statue(out, form, y0, detail, coastal) {
  const {
    center: [x, z],
    height,
    angleDegrees,
    widthFactor,
    pukao,
  } = form;
  const frame = transform(out, (-angleDegrees * Math.PI) / 180, [x, y0, z]);
  const tint = coastal ? tawny : ash;
  const sides = [4, 8, 16, 24][detail];
  const silhouette = profiles[detail].map((j) => {
    const [y, r, d, shift, nose, eye] = humanProfile[j];
    return Array.from({ length: sides }, (_, i) => {
      const angle = Math.PI / 2 - (i * 2 * Math.PI) / sides,
        c = Math.cos(angle),
        s = Math.sin(angle);
      const face = Math.max(0, s);
      const ridge = Math.max(0, 1 - 3.4 * Math.abs(c));
      const orbital = Math.max(0, 1 - 5 * Math.abs(Math.abs(c) - 0.45));
      const crackle = detail === 3 ? Math.sin(i * 2.93 + j * 4.7) * 0.0022 : 0;
      const armTrack = 0.07 + 1.63 * y;
      const arm =
        detail < 2 || y < 0.09 || y > 0.46
          ? 0
          : Math.max(0, 1 - 7 * Math.abs(Math.abs(c) - armTrack)) * 0.015;
      const ear =
        detail < 2 || y < 0.65 || y > 0.9 ? 0 : Math.max(0, 1 - 4 * Math.abs(s - 0.27)) * 0.018;
      return [
        c * (r + crackle + ear) * height * widthFactor,
        y * height,
        (d * s + shift + face * (ridge * nose - orbital * eye + arm) + crackle) * height,
      ];
    });
  });
  loft(frame, 'tuff', silhouette, tint);
  if (pukao) {
    const crown = [
      [0.985, 0.096],
      [1.017, 0.118],
      [1.161, 0.123],
      [1.177, 0.099],
      [1.192, 0.045],
    ].map(([y, r]) =>
      radialRing(y * height, r * height, r * height, [8, 12, 18, 24][detail], [0, 0.013 * height]),
    );
    loft(frame, 'tuff', crown, scoria);
  }
}

function cap(out, ring, heights) {
  const mesh = new MeshBufferBuilder();
  const grade = new Map(ring.map((p, i) => [p, heights[i]]));
  if (
    !mesh.addCap(
      'wall',
      'palette:#ffffff',
      ring,
      [],
      (p) => grade.get(p) ?? heights[0],
      [0, 1, 0],
      (p) => p,
      fill,
    )
  )
    throw new Error('Could not triangulate the mapped stone apron');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3));
    out.addTriangle(
      'gravel',
      'palette:#ffffff',
      p,
      [0, 1, 0],
      p.map((q) => [q[0], q[2]]),
      fill,
    );
  }
}

function platform(out, site, detail) {
  const { rear, front, start, end, centerElevation, cornerGrades } = site.platform;
  const ring = outwardRing(site.plan);
  const height = ring.map((p) =>
    Math.min(cornerGrades[site.plan.indexOf(p)] + 0.34, centerElevation - 0.16),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      j = (i + 1) % ring.length,
      b = ring[j];
    const foot =
      Math.min(cornerGrades[site.plan.indexOf(a)], cornerGrades[site.plan.indexOf(b)]) - 0.52;
    quad4(
      out,
      'wall',
      [a[0], foot, a[1]],
      [b[0], foot, b[1]],
      [b[0], height[j], b[1]],
      [a[0], height[i], a[1]],
      darkWall,
    );
  }
  cap(out, ring, height);
  const terraceEdge = site.moai[0].center[1] + 3.07;
  abox(out, 'wall', [start, -0.48, rear + 0.02], [end, centerElevation, terraceEdge], darkWall);
  if (detail === 0) return;
  stoneApron(out, start, end, terraceEdge, front, centerElevation, detail);
  if (detail >= 2)
    for (const {
      center: [x, z],
      height,
      widthFactor,
    } of site.moai) {
      const r = 0.164 * height * widthFactor;
      abox(
        out,
        'wall',
        [x - r, centerElevation - 0.035, z - r * 0.77],
        [x + r, centerElevation + 0.16, z + r * 0.77],
        darkWall,
      );
    }
}

function stoneApron(out, start, end, topEdge, front, height, detail) {
  const near = topEdge - 0.08,
    far = front - 0.3;
  const y0 = height - 0.22,
    y1 = height * 0.25;
  const left = start + 0.12,
    right = end - 0.12;
  quad4(
    out,
    'gravel',
    [left, y0, near],
    [left, y1, far],
    [right, y1, far],
    [right, y0, near],
    fill,
  );
  quad4(
    out,
    'wall',
    [left, -0.45, far],
    [right, -0.45, far],
    [right, y1, far],
    [left, y1, far],
    darkWall,
  );
  quad4(
    out,
    'wall',
    [left, -0.45, near],
    [left, -0.45, far],
    [left, y1, far],
    [left, y0, near],
    darkWall,
  );
  quad4(
    out,
    'wall',
    [right, -0.45, far],
    [right, -0.45, near],
    [right, y0, near],
    [right, y1, far],
    darkWall,
  );
  if (detail < 2) return;
  const rows = detail === 3 ? 5 : 2;
  const spacing = detail === 3 ? 0.59 : 1.19;
  for (let row = 0; row < rows; row++) {
    const f = (row + 1) / (rows + 1),
      z = near + (far - near) * f;
    const y = y0 + (y1 - y0) * f;
    const n = Math.floor((right - left) / spacing);
    for (let i = 0; i < n; i++) {
      const seed = Math.sin((i + 1) * 3.9 + (row + 1) * 17.6);
      const x = left + (i + 0.5) * spacing + seed * spacing * 0.13;
      const r = spacing * (0.28 + seed * 0.08),
        w = r * 0.78;
      const p = [x, z];
      const rings = [
        radialRing(y - 0.085, r, w, 5, p),
        radialRing(y + 0.016, r * 0.92, w * 0.92, 5, p),
        radialRing(y + 0.092, r * 0.53, w * 0.53, 5, p),
      ];
      loft(out, 'wall', rings, seed > 0.35 ? ash : darkWall, { cap: false });
    }
  }
}

export function buildAhu(out, site, detail) {
  const frame = transform(out, (-site.planAngleDegrees * Math.PI) / 180);
  platform(frame, site, detail);
  for (const form of site.moai)
    statue(
      frame,
      form,
      site.platform.centerElevation + (detail >= 2 ? 0.15 : 0),
      detail,
      site.moai.length > 7,
    );
}
