import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../opera-plan.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93 },
  dressed: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.87 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.26 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'bayreuth-window-recesses',
    roughness: 0.58,
  },
};
const stone = rgb('bfb096'),
  trim = rgb('c4b59a'),
  worn = rgb('a5947d'),
  charcoal = rgb('4d5157');
const door = rgb('b8bbb6'),
  glass = rgb('535659'),
  offwhite = rgb('cfcac0'),
  iron = rgb('565857');
const face = facade(site.facade.center, site.facade.along);
const eaves = 14.61;
function capMesh(out) {
  return {
    ...out,
    addCap(slot, ref, r, holes, height, normal, uv, color) {
      const m = new MeshBufferBuilder();
      if (!m.addCap('wall', ref, r, holes, height, normal, uv, color)) return false;
      const { positions, indices } = m.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, slot, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}
function shell(out, level) {
  const outline = outwardRing(site.shell);
  extrude(out, 'ashlar', outline, site.foundation, eaves, stone);
  const dress = (lo, hi, d) => {
    for (let i = 0; i < outline.length; i++) {
      const f = wallFace(outline[i], outline[(i + 1) % outline.length]);
      fbox(out, 'dressed', f, 0, f.length, lo, hi, -0.04, d, trim);
    }
  };
  if (level) {
    dress(0.2, 0.46, 0.12);
    dress(13.79, 14.08, 0.18);
  }
}
function mansard(out, level) {
  const edge = outwardRing(site.roofBase),
    shoulder = site.roofBreak,
    ridge = site.roofRidge;
  const p = ([x, z], y) => [x, y, z];
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length;
    const p0 = p(edge[i], eaves),
      p1 = p(edge[j], eaves);
    const q0 = p(shoulder[i], 19.26),
      q1 = p(shoulder[j], 19.26);
    const s = p(ridge[i], 25.36),
      t = p(ridge[j], 25.36);
    quad4(out, 'slate', p0, p1, q1, q0, charcoal);
    tri(out, 'slate', q0, q1, t, charcoal);
    if (Math.hypot(s[0] - t[0], s[2] - t[2]) > 1e-5) tri(out, 'slate', q0, t, s, charcoal);
    if (level) {
      beam(out, 'slate', p0, p1, 0.18, 0.19, charcoal);
      beam(out, 'slate', q0, q1, 0.14, 0.18, charcoal);
    }
  }
  if (level) {
    for (const [u, d, y] of [
      [-9.3, -0.91, 17.78],
      [-3.22, -1.45, 17.81],
      [3.15, -1.45, 17.81],
      [9.08, -1.12, 17.72],
    ]) {
      fbox(
        out,
        'slate',
        face,
        u - 0.77,
        u + 0.77,
        y - 0.62,
        y + 0.75,
        d - 0.93,
        d + 0.13,
        charcoal,
      );
      tri(
        out,
        'slate',
        face.P(u - 0.94, y + 0.75, d + 0.14),
        face.P(u + 0.94, y + 0.75, d + 0.14),
        face.P(u, y + 1.32, d + 0.14),
        charcoal,
      );
      quad4(
        out,
        'slate',
        face.P(u - 0.94, y + 0.75, d + 0.14),
        face.P(u, y + 1.32, d + 0.14),
        face.P(u, y + 1.32, d - 0.95),
        face.P(u - 0.94, y + 0.75, d - 0.95),
        charcoal,
      );
      quad4(
        out,
        'slate',
        face.P(u, y + 1.32, d + 0.14),
        face.P(u + 0.94, y + 0.75, d + 0.14),
        face.P(u + 0.94, y + 0.75, d - 0.95),
        face.P(u, y + 1.32, d - 0.95),
        charcoal,
      );
      window(out, face, u, y - 0.55, 1.03, 1.18, level, d + 0.15);
    }
  }
}
function window(out, f, u, y, w, h, level, d = 0.044, head = 'tudor') {
  opening(out, f, u, y, w, h, {
    head,
    rise: h * 0.13,
    glassSlot: 'glass',
    frameSlot: 'dressed',
    glass,
    frame: trim,
    frameWidth: level > 1 ? 0.147 : 0,
    frameDepth: d + 0.17,
    sill: level > 1,
    mullions: 0,
    d,
  });
  if (level < 2) return;
  const n = level === 3 ? 3 : 2;
  for (let i = 1; i <= n; i++) {
    const x = u + w * (i / (n + 1) - 0.5);
    fbox(
      out,
      'wood',
      f,
      x - 0.037,
      x + 0.037,
      y + 0.042,
      y + h * 0.9,
      d + 0.01,
      d + 0.074,
      offwhite,
    );
  }
  for (const j of [0.25, 0.49, 0.71]) {
    const x = y + j * h;
    fbox(
      out,
      'wood',
      f,
      u - w * 0.45,
      u + w * 0.45,
      x - 0.037,
      x + 0.037,
      d + 0.01,
      d + 0.074,
      offwhite,
    );
  }
}
function balusters(out, f, u, U, y, Y, d, level, count) {
  fbox(out, 'dressed', f, u, U, y, y + 0.19, d - 0.18, d + 0.18, trim);
  fbox(out, 'dressed', f, u, U, Y - 0.19, Y, d - 0.22, d + 0.22, trim);
  if (!level) return;
  const nBays = level === 1 ? Math.ceil(count * 0.7) : count;
  for (let i = 0; i < nBays; i++) {
    const s = u + ((i + 0.5) * (U - u)) / nBays;
    if (level === 1) {
      fbox(out, 'dressed', f, s - 0.075, s + 0.075, y + 0.16, Y - 0.16, d - 0.082, d + 0.082, trim);
      continue;
    }
    const anchor = f.P(s, 0, d);
    const n = level > 1 ? 8 : 5,
      a = y + 0.16,
      b = Y - 0.15,
      m = (a + b) * 0.5;
    lathe(
      out,
      'dressed',
      [anchor[0], anchor[2]],
      [
        [a, 0.126, 0.126],
        [a + 0.13, 0.153, 0.153],
        [m - 0.04, 0.107, 0.107],
        [m + 0.21, 0.073, 0.073],
        [b, 0.118, 0.118],
      ],
      n,
      trim,
    );
  }
}
function column(out, u, level) {
  const x = face.P(u, 0, 0.42),
    c = [x[0], x[2]],
    n = [7, 10, 16, 20][level];
  fbox(out, 'dressed', face, u - 0.52, u + 0.52, 5.22, 5.5, -0.07, 0.8, worn);
  lathe(
    out,
    'dressed',
    c,
    [
      [5.47, 0.438, 0.438],
      [5.6, 0.475, 0.475],
      [5.77, 0.38, 0.38],
      [6.09, 0.348, 0.348],
      [11.65, 0.289, 0.289],
      [11.8, 0.33, 0.33],
    ],
    n,
    trim,
  );
  if (level) {
    lathe(
      out,
      'dressed',
      c,
      [
        [11.8, 0.3, 0.3],
        [11.97, 0.38, 0.38],
        [12.31, 0.48, 0.48],
        [12.49, 0.52, 0.52],
      ],
      n,
      trim,
    );
    fbox(out, 'dressed', face, u - 0.535, u + 0.535, 12.45, 12.6, -0.08, 0.9, trim);
  }
  if (level > 1) {
    const count = level === 2 ? 5 : 8;
    for (let i = 0; i < count; i++) {
      const k = (i * 2 * Math.PI) / count,
        p = [c[0] + 0.37 * Math.cos(k), c[1] + 0.37 * Math.sin(k)];
      lathe(
        out,
        'dressed',
        p,
        [
          [11.86, 0.067, 0.067],
          [12.04, 0.117, 0.117],
          [12.31, 0.075, 0.075],
          [12.36, 0.022, 0.022],
        ],
        6,
        worn,
      );
    }
  }
}
function statue(out, u, y, index, level) {
  const d = 0.19,
    p = face.P(u, 0, d),
    c = [p[0], p[2]],
    n = level > 1 ? 9 : 6;
  fbox(out, 'dressed', face, u - 0.37, u + 0.37, y - 0.1, y + 0.12, d - 0.28, d + 0.3, worn);
  lathe(
    out,
    'dressed',
    c,
    [
      [y + 0.1, 0.228, 0.178],
      [y + 0.34, 0.27, 0.14],
      [y + 0.91, 0.2, 0.121],
      [y + 1.19, 0.238, 0.151],
      [y + 1.39, 0.18, 0.129],
      [y + 1.48, 0.09, 0.088],
    ],
    n,
    worn,
  );
  lathe(
    out,
    'dressed',
    c,
    [
      [y + 1.465, 0.066, 0.074],
      [y + 1.55, 0.12, 0.11],
      [y + 1.72, 0.112, 0.112],
      [y + 1.78, 0.053, 0.055],
    ],
    n,
    trim,
  );
  if (level > 1) {
    const a = index % 2 === 0 ? -1 : 1;
    beam(
      out,
      'dressed',
      face.P(u + 0.17 * a, y + 1.28, d),
      face.P(u + 0.35 * a, y + 0.96, d + 0.26),
      0.11,
      0.12,
      worn,
    );
    beam(
      out,
      'dressed',
      face.P(u + 0.35 * a, y + 0.96, d + 0.26),
      face.P(u + 0.21 * a, y + 0.8, d + 0.39),
      0.092,
      0.094,
      trim,
    );
  }
}
function baroqueFront(out, level) {
  const faceDepth = 0.064;
  fbox(out, 'dressed', face, -7, 7, 4.85, 5.16, -0.02, 1.44, trim);
  fbox(out, 'dressed', face, -7.22, 7.22, 5.15, 5.42, -0.02, 1.52, trim);
  for (const [y, d, h] of [
    [4.58, 0.39, 0.19],
    [12.55, 0.43, 0.25],
    [12.84, 0.55, 0.21],
    [13.16, 0.67, 0.24],
    [13.49, 0.78, 0.36],
  ]) {
    fbox(out, 'dressed', face, -11.91, 12.21, y, y + h, -0.35, d, trim);
  }
  for (const u of [-6.08, -2.04, 2.02, 6.08]) column(out, u, level);
  for (const u of [-11.43, -7.34, 7.54, 11.76]) {
    fbox(out, 'dressed', face, u - 0.3, u + 0.3, 5.33, 12.44, -0.65, 0.146, trim);
    if (level) fbox(out, 'dressed', face, u - 0.42, u + 0.42, 12.19, 12.5, -0.57, 0.19, worn);
  }
  const top = 13.84;
  const ends = [-11.27, -7.61, -4.2, 0, 4.08, 7.94, 11.96];
  for (let i = 0; i < ends.length; i++) {
    const u = ends[i];
    fbox(out, 'dressed', face, u - 0.43, u + 0.43, top - 0.061, top + 1.06, -0.23, 0.51, trim);
    if (level) statue(out, u, top + 1.04, i, level);
    const next = ends[i + 1];
    if (next !== undefined)
      balusters(
        out,
        face,
        u + 0.43,
        next - 0.43,
        top + 0.02,
        top + 0.99,
        0.29,
        level,
        countRail(next - u),
      );
  }
  if (!level) return;
  for (const u of [-4.03, 0, 4.06]) {
    const d = faceDepth;
    opening(out, face, u, 0.35, 2.93, 3.92, {
      head: 'round',
      glassSlot: 'wood',
      frameSlot: 'dressed',
      glass: u > 3 ? rgb('625d55') : door,
      frame: trim,
      frameWidth: 0.205,
      frameDepth: 0.37,
      mullions: 0,
      sill: false,
      d,
    });
    fbox(out, 'iron', face, u - 1.35, u + 1.35, 2.83, 2.95, d + 0.025, d + 0.135, iron);
    for (const offset of [-0.64, 0, 0.64])
      fbox(
        out,
        'wood',
        face,
        u + offset - 0.04,
        u + offset + 0.04,
        0.46,
        2.79,
        d + 0.024,
        d + 0.125,
        offwhite,
      );
    window(out, face, u, 6.18, 1.69, 2.74, level, 0.057);
    window(out, face, u, 10.1, 1.57, 1.74, level, 0.055);
    if (level > 1) {
      fbox(out, 'dressed', face, u - 0.97, u + 0.97, 9.21, 9.46, 0.012, 0.217, trim);
      const m = face.P(u, 9.1, 0.087);
      lathe(
        out,
        'dressed',
        [m[0], m[2]],
        [
          [8.81, 0.081, 0.081],
          [8.94, 0.156, 0.156],
          [9.15, 0.183, 0.183],
          [9.23, 0.032, 0.032],
        ],
        8,
        worn,
      );
      for (const offset of [-0.98, 0.98])
        fbox(
          out,
          'dressed',
          face,
          u + offset - 0.13,
          u + offset + 0.13,
          4.62,
          5.01,
          0.03,
          0.85,
          worn,
        );
    }
  }
  for (const u of [-9.42, 9.7]) {
    fbox(out, 'wood', face, u - 0.76, u + 0.76, 0.16, 2.76, -0.77, -0.62, door);
    window(out, face, u, 6.52, 1.42, 2.07, level, -0.65);
    window(out, face, u, 10.08, 1.28, 1.54, level, -0.65);
  }
  if (level > 1) {
    fbox(out, 'iron', face, -6.95, 6.95, 6.24, 6.34, 1.39, 1.47, iron);
    const count = level === 3 ? 48 : 25;
    for (let i = 0; i <= count; i++) {
      const u = -6.89 + (i * 13.78) / count;
      fbox(out, 'iron', face, u - 0.028, u + 0.028, 5.39, 6.25, 1.41, 1.46, iron);
    }
    for (const u of [-5.98, -2.02, 2.08, 6.09]) {
      fbox(out, 'iron', face, u - 0.048, u + 0.048, 5.38, 6.39, 1.38, 1.48, iron);
    }
  }
}
const countRail = (span) => Math.max(3, Math.round((span - 0.86) / 0.36));
function rearFront(out, level) {
  if (!level) return;
  const f = wallFace(site.rear[0], site.rear[1]),
    mid = f.length * 0.48;
  opening(out, f, mid, 0.19, 4.14, 6.89, {
    head: 'round',
    glassSlot: 'wood',
    frameSlot: 'dressed',
    glass: door,
    frame: worn,
    frameWidth: 0.26,
    frameDepth: 0.22,
    sill: false,
    d: 0.037,
  });
  for (const h of [3.96, 6.97, 10.16, 12.31]) {
    const bays = h < 7 ? [0.22, 0.78] : [0.24, 0.43, 0.59, 0.76];
    for (const k of bays) window(out, f, k * f.length, h - 1.1, 1.16, 1.61, level, 0.032);
  }
  const jambs = [1.13, f.length - 1.14];
  for (const u of jambs) fbox(out, 'dressed', f, u - 0.25, u + 0.25, 0.2, 14.13, -0.05, 0.13, worn);
  if (level > 1)
    for (const y of [3.94, 8.01])
      fbox(out, 'dressed', f, 0, f.length, y, y + 0.13, -0.02, 0.086, worn);
}
function build(target, level) {
  const out = capMesh(target);
  shell(out, level);
  mansard(out, level);
  baroqueFront(out, level);
  rearFront(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
