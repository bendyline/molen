import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.91 },
  masonry: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  graphite: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82 },
  wire: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
};
const buff = rgb('aea087');
const cement = rgb('b3ada1');
const brick = rgb('965c44');
const graphite = rgb('535750');
const wire = rgb('454640');
const rock = rgb('83795f');
const white = rgb('dedbd0');
const shadow = rgb('373233');
const grade = site.gate.grade;
const bottom = -5.9;
const entry = wallFace(...site.gate.edge);
const additionalGlyphs = {
  W: [
    [0, 1],
    [0.17, 0],
    [0.45, 0.67],
    [0.72, 0],
    [0.95, 1],
  ],
  O: [
    [0.22, 0],
    [0.73, 0],
    [0.92, 0.23],
    [0.92, 0.77],
    [0.73, 1],
    [0.22, 1],
    [0.03, 0.77],
    [0.03, 0.23],
    [0.22, 0],
  ],
  '-': [
    [0.05, 0.45],
    [0.86, 0.45],
  ],
};

function texturedCaps(out) {
  return {
    ...out,
    addCap(slot, ref, outline, holes, grade, normal, uv, color) {
      const builder = new MeshBufferBuilder();
      if (!builder.addCap('roof', ref, outline, holes, grade, normal, uv, color)) return false;
      const { positions, indices } = builder.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const points = Array.from(indices.slice(i, i + 3), (j) =>
          positions.slice(j * 3, j * 3 + 3),
        );
        out.addTriangle(
          slot,
          ref,
          points,
          normal,
          points.map((p) => uv([p[0], p[2]])),
          color,
        );
      }
      return true;
    },
  };
}

function entrance(out, detail, roofHeight) {
  const { center, width, approach } = site.gate;
  const a = center - width / 2,
    b = center + width / 2;
  const P = entry.P;
  fbox(out, 'concrete', entry, 0, a, bottom, roofHeight, -0.72, 0, buff);
  fbox(out, 'concrete', entry, b, entry.length, bottom, roofHeight, -0.72, 0, buff);
  fbox(out, 'concrete', entry, a, b, grade + 3.61, roofHeight, -0.83, 0, buff, { bottom: true });
  fbox(out, 'concrete', entry, a, b, bottom, grade, -2.6, 0, cement);
  const { length, landing } = approach;
  quad4(
    out,
    'concrete',
    P(a, landing, length),
    P(b, landing, length),
    P(b, grade, 0),
    P(a, grade, 0),
    cement,
  );
  quad4(
    out,
    'concrete',
    P(a, bottom, length),
    P(b, bottom, length),
    P(b, landing, length),
    P(a, landing, length),
    cement,
  );
  quad4(
    out,
    'concrete',
    P(a, bottom, 0),
    P(a, bottom, length),
    P(a, landing, length),
    P(a, grade, 0),
    cement,
  );
  quad4(
    out,
    'concrete',
    P(b, bottom, length),
    P(b, bottom, 0),
    P(b, grade, 0),
    P(b, landing, length),
    cement,
  );
  fbox(out, 'concrete', entry, a, b, grade, grade + 3.58, -2.66, -2.55, shadow);
  const gap = 1.3;
  for (const [x, y] of [
    [a, center - gap - 0.25],
    [center - 0.3, center + 0.3],
    [center + gap + 0.25, b],
  ])
    fbox(out, 'masonry', entry, x, y, grade, grade + 3.64, -1.74, -0.29, brick);
  fbox(
    out,
    'graphite',
    entry,
    a - 0.12,
    b + 0.12,
    grade + 3.26,
    grade + 3.4,
    -0.22,
    3.17,
    graphite,
    { bottom: true },
  );
  for (const offset of [-1.1, 1.1]) {
    const u = center + offset;
    fbox(out, 'wire', entry, u - 0.68, u + 0.68, grade + 3.16, grade + 3.29, 2.91, 3.29, wire);
    fbox(
      out,
      'concrete',
      entry,
      u - 0.65,
      u + 0.65,
      grade + 2.91,
      grade + 3.23,
      3.13,
      3.159,
      white,
    );
    if (detail > 1) {
      for (const side of [-1, 1])
        fbox(
          out,
          'wire',
          entry,
          u + side * 0.54 - 0.035,
          u + side * 0.54 + 0.035,
          grade,
          grade + 2.67,
          -1.41,
          -1.29,
          wire,
        );
      for (let i = 0; i < 9; i++) {
        const y = grade + 0.24 + i * 0.264;
        fbox(out, 'wire', entry, u - 0.51, u + 0.51, y, y + 0.032, -1.36, -1.33, wire);
      }
    }
    if (detail === 3) {
      const text = offset < 0 ? 'WHITES' : 'NON-WHITES';
      lettering(
        deform(out, (p) => P(p[0] + u, p[1], p[2])),
        text.replace(/[WO-]/g, ' '),
        {
          width: 1.1,
          height: 0.159,
          y: grade + 2.989,
          z: 3.17,
          slot: 'wire',
          stroke: 0.023,
          color: shadow,
        },
      );
      const advance = 1.1 / text.length;
      for (let i = 0; i < text.length; i++) {
        const path = additionalGlyphs[text[i]];
        if (path)
          beamPath(
            out,
            'wire',
            path.map(([x, y]) =>
              P(u + (i - text.length / 2 + x * 0.75) * advance, grade + 2.989 + y * 0.159, 3.17),
            ),
            0.023,
            0.023,
            shadow,
          );
      }
    }
  }
}

function hall(out, detail) {
  const { outline, height, grade } = site.main;
  const top = grade + height;
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (f.origin[0] === entry.origin[0] && f.origin[1] === entry.origin[1]) {
      entrance(out, detail, top);
      continue;
    }
    fbox(out, 'masonry', f, 0, f.length, bottom, grade + 2.38, -0.09, 0, brick);
    fbox(out, 'graphite', f, 0, f.length, grade + 2.38, top, -0.09, 0.034, graphite);
    if (detail > 1 && f.length > 20) {
      fbox(out, 'concrete', f, 0, f.length, grade + 2.25, grade + 2.42, -0.055, 0.085, buff);
      fbox(out, 'wire', f, 0.17, f.length - 0.17, top - 0.16, top + 0.05, -0.11, 0.105, wire);
    }
  }
  out.addCap(
    'graphite',
    '',
    outline,
    [],
    () => top,
    [0, 1, 0],
    (p) => p,
    graphite,
  );
  const long = wallFace(outline[0], outline[1]);
  const P = long.P;
  quad4(
    out,
    'graphite',
    P(long.length, top + 0.1, 0),
    P(0, top + 0.1, 0),
    P(0, top + 1.79, 6.7),
    P(long.length, top + 1.79, 6.7),
    graphite,
  );
  quad4(
    out,
    'graphite',
    P(long.length, top + 1.79, 6.7),
    P(0, top + 1.79, 6.7),
    P(0, top + 0.16, 13.45),
    P(long.length, top + 0.16, 13.45),
    wire,
  );
  tri(
    out,
    'graphite',
    P(0, top + 0.1, 0),
    P(0, top + 1.79, 6.7),
    P(0, top + 0.16, 13.45),
    graphite,
  );
  tri(
    out,
    'graphite',
    P(long.length, top + 0.16, 13.45),
    P(long.length, top + 1.79, 6.7),
    P(long.length, top + 0.1, 0),
    graphite,
  );
  const start = P(0, top + 1.76, 6.7),
    finish = P(long.length, top + 1.76, 6.7);
  const ridge = wallFace([start[0], start[2]], [finish[0], finish[2]]);
  fbox(out, 'wire', ridge, 0, ridge.length, top + 1.76, top + 1.88, -0.11, 0.11, wire);
}

function forecourt(out, detail) {
  for (let i = 0; i < site.gabions.length - 1; i++) {
    const f = wallFace(site.gabions[i], site.gabions[i + 1]);
    const step = Math.ceil(f.length / 3.1);
    const x = f.length / step;
    const high = i === 0 ? 4.05 : 3.3;
    fbox(out, 'stone', f, 0, f.length, bottom, high, -0.83, 0, rock);
    if (detail === 0) continue;
    fbox(out, 'wire', f, 0, f.length, high - 0.04, high + 0.046, -0.86, 0.027, wire);
    for (let b = 0; b <= step; b++) {
      const u = b * x;
      fbox(out, 'wire', f, u - 0.044, u + 0.044, -1.4, high + 0.037, -0.91, 0.075, wire);
    }
    if (detail > 1) {
      for (let y = -0.7; y < high; y += detail === 3 ? 0.25 : 0.46)
        fbox(out, 'wire', f, 0, f.length, y - 0.014, y + 0.014, -0.873, 0.024, wire);
      for (let u = 0.26; u < f.length; u += detail === 3 ? 0.26 : 0.55)
        fbox(out, 'wire', f, u - 0.013, u + 0.013, -0.7, high, -0.874, 0.025, wire);
    }
  }
  const { start, end, count } = site.columns;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const [x, z] = start.map((p, j) => p * (1 - t) + end[j] * t);
    abox(out, 'concrete', [x - 0.33, bottom, z - 0.34], [x + 0.33, 7.64, z + 0.34], cement);
    if (detail > 1)
      abox(out, 'stone', [x - 0.71, -0.68, z - 0.71], [x + 0.71, -0.21, z + 0.71], rock);
  }
}

function build(out, detail) {
  const skin = texturedCaps(out);
  hall(skin, detail);
  for (const [i, wing] of site.wings.entries()) {
    extrude(
      skin,
      i === 0 ? 'masonry' : 'concrete',
      wing.outline,
      bottom,
      wing.grade + wing.height,
      i === 0 ? brick : buff,
      { topSlot: 'graphite', topColor: graphite },
    );
  }
  forecourt(skin, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
