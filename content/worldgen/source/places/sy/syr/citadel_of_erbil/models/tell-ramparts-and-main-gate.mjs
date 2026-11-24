import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../citadel-layout.json' with { type: 'json' };

export const surfaces = {
  ground: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98 },
  adobe: { slot: 'wall', graph: 'earth_adobe', roughness: 0.95 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  cornice: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'earth_rammed', roughness: 0.96 },
  dark: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'erbil-masonry-openings',
    roughness: 0.93,
  },
};
const clay = rgb('a77f61'),
  earth = rgb('a28769'),
  cliff = rgb('ad8c6d');
const outerBrick = rgb('ad8060'),
  ochre = rgb('bd9470'),
  trim = rgb('c0a181'),
  shadow = rgb('594b40');
const lerp = (a, b, t) => a + (b - a) * t;
const faces = (ring) => outwardRing(ring).map((q, i, r) => wallFace(q, r[(i + 1) % r.length]));
function meshWithCaps(out) {
  return {
    ...out,
    addCap(slot, ref, outline, holes, height, normal, uv, color) {
      const mesh = new MeshBufferBuilder();
      if (!mesh.addCap('wall', ref, outline, holes, height, normal, uv, color)) return false;
      const { positions, indices } = mesh.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const at = (j) => [...positions.subarray(indices[i + j] * 3, indices[i + j] * 3 + 3)];
        tri(out, slot, at(0), at(1), at(2), color);
      }
      return true;
    },
  };
}
function mound(out, level) {
  const rows = site.terrain[level],
    edge = rows[0],
    width = edge.length;
  for (let j = 0; j < rows.length - 1; j++) {
    const outer = rows[j],
      inner = rows[j + 1];
    for (let i = 0; i < width; i++) {
      const k = (i + 1) % width,
        a = outer[i],
        b = outer[k],
        c = inner[k],
        d = inner[i];
      const rise = Math.abs((a[1] + b[1] - c[1] - d[1]) * 0.5);
      const run = Math.hypot(d[0] - a[0], d[2] - a[2]);
      const weathering = Math.min(1, rise / (run * 0.58 + 0.01));
      const color = earth.map((value, channel) => lerp(value, cliff[channel], weathering));
      tri(out, 'ground', a, b, c, color);
      tri(out, 'ground', a, c, d, color);
    }
  }
  const inside = rows.at(-1),
    center = [site.centre[0], site.centreGrade, site.centre[1]];
  for (let i = 0; i < width; i++) {
    const k = (i + 1) % width;
    tri(out, 'ground', inside[i], inside[k], center, earth);
    if (level > 0) {
      const [a, b] = [edge[i], edge[k]];
      quad4(out, 'ground', [a[0], a[1] - 1.08, a[2]], [b[0], b[1] - 1.08, b[2]], b, a, earth);
    }
  }
}
function wall(out, level) {
  for (const [i, [a, b, base0, base1, top0, top1]] of site.walls.entries()) {
    const f = wallFace(a, b),
      length = f.length,
      depth = 1.93;
    const Step = (u, h, d) => f.P(u, lerp(top0, top1, u / length) + h, d);
    const A = f.P(0, base0),
      B = f.P(length, base1);
    const C = Step(length, 0, 0),
      D = Step(0, 0, 0);
    quad4(out, 'brick', A, B, C, D, i % 4 === 0 ? clay : outerBrick);
    quad4(out, 'cornice', D, C, Step(length, 0, -depth), Step(0, 0, -depth), trim);
    if (!level) continue;
    quad4(
      out,
      'adobe',
      f.P(length, base1, -depth),
      f.P(0, base0, -depth),
      Step(0, 0, -depth),
      Step(length, 0, -depth),
      clay,
    );
    for (const end of [0, length]) {
      const y = end === 0 ? base0 : base1,
        t = end === 0 ? top0 : top1;
      fbox(
        out,
        'adobe',
        f,
        Math.max(0, end - 0.1),
        Math.min(length, end + 0.1),
        y,
        t,
        -depth,
        0.036,
        ochre,
      );
    }
    quad4(
      out,
      'cornice',
      Step(0, -0.43, 0.079),
      Step(length, -0.43, 0.079),
      Step(length, -0.1, 0.079),
      Step(0, -0.1, 0.079),
      trim,
    );
    if (level < 2) continue;
    const n = Math.max(1, Math.floor(length / 3.36)),
      step = length / n;
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) * step,
        d = 0.045;
      quad4(
        out,
        'dark',
        Step(u - 0.21, -2.26, d),
        Step(u + 0.21, -2.26, d),
        Step(u + 0.21, -1.82, d),
        Step(u - 0.21, -1.82, d),
        shadow,
      );
      if (level > 2 && j % 3 === 1 && length > 7.1) {
        const y = lerp(top0, top1, u / length);
        fbox(out, 'cornice', f, u - 0.28, u + 0.28, y - 3.46, y - 0.55, 0.029, 0.25, ochre);
      }
    }
  }
}
function mainGate(out, g, level) {
  const {
      position,
      normal: [x, z],
      grade: y,
      span,
      portal,
      slope,
    } = g,
    f = facade(position, [z, -x]);
  const half = span * 0.5,
    tower = 5.4,
    depth = 4.15;
  const plinth = y - 7.2,
    spring = y + portal * 0.65,
    rise = portal * 0.35,
    roof = y + portal + 1.94;
  const dim = 3.06;
  for (const sign of [-1, 1]) {
    const u = sign * half,
      U = sign * (half + tower);
    fbox(
      out,
      'brick',
      f,
      Math.min(u, U),
      Math.max(u, U),
      plinth,
      roof + 0.89,
      -depth,
      depth,
      outerBrick,
    );
    if (level)
      fbox(
        out,
        'cornice',
        f,
        Math.min(u, U) - 0.18,
        Math.max(u, U) + 0.18,
        roof + 0.56,
        roof + 0.91,
        -depth - 0.19,
        depth + 0.19,
        trim,
      );
    if (level) {
      opening(out, f, sign * (half + tower * 0.5), roof - 3.39, 0.89, 1.31, {
        head: 'pointed',
        rise: 0.35,
        glassSlot: 'dark',
        frameSlot: 'cornice',
        glass: shadow,
        frame: ochre,
        frameWidth: level === 3 ? 0.19 : 0,
        frameDepth: depth + 0.13,
        sill: false,
        d: depth + 0.028,
      });
    }
  }
  const stations = pointedArch(half, rise, level > 1 ? 8 : 4).map(([u, h]) => [u, spring + h]);
  for (let q = 0; q < stations.length - 1; q++) {
    const [u, h] = stations[q],
      [U, H] = stations[q + 1];
    const A = f.P(u, h, dim),
      B = f.P(U, H, dim);
    quad4(out, 'brick', A, B, f.P(U, roof, dim), f.P(u, roof, dim), outerBrick);
    quad4(
      out,
      'adobe',
      f.P(U, H, -dim),
      f.P(u, h, -dim),
      f.P(u, roof, -dim),
      f.P(U, roof, -dim),
      clay,
    );
    quad4(out, 'cornice', B, A, f.P(u, h, -dim), f.P(U, H, -dim), trim);
  }
  fbox(out, 'cornice', f, -half, half, roof, roof + 0.28, -dim - 0.15, dim + 0.15, trim);
  if (level > 1) {
    const edge = half + tower,
      count = 10;
    for (let i = 0; i < count; i++) {
      const u = -edge + (i + 0.5) * ((2 * edge) / count);
      const height = roof + (Math.abs(u) > half ? 0.85 : 0.27);
      fbox(
        out,
        'brick',
        f,
        u - 0.37,
        u + 0.37,
        height - 0.04,
        height + 0.62,
        dim - 0.4,
        dim + 0.14,
        ochre,
      );
    }
  }
  const r = (u, d) => f.P(u, y + d * slope + 0.055, d);
  if (level > 0)
    quad4(
      out,
      'cornice',
      r(half - 0.29, 25),
      r(-half + 0.29, 25),
      r(-half + 0.29, -19),
      r(half - 0.29, -19),
      trim,
    );
}
function mainGateWing(out, level) {
  for (const { outline, holes, foot, floor, height } of site.gateWings) {
    const top = floor + height;
    extrude(out, 'brick', outline, foot, top, outerBrick, {
      holes,
      topSlot: 'roof',
      topColor: earth,
    });
    if (level > 0) {
      extrude(out, 'cornice', outline, top - 0.35, top + 0.16, trim, { holes });
    }
    if (level > 1) {
      for (const face of faces(outline)) {
        if (face.length < 5.3) continue;
        const count = Math.max(1, Math.floor(face.length / 3.6));
        for (let i = 0; i < count; i++) {
          const u = ((i + 0.5) * face.length) / count;
          opening(out, face, u, top - 3.8, 0.74, 1.25, {
            head: 'pointed',
            rise: 0.32,
            glassSlot: 'dark',
            frameSlot: 'cornice',
            glass: shadow,
            frame: ochre,
            frameWidth: level === 3 ? 0.12 : 0,
            sill: false,
            d: 0.042,
          });
        }
      }
    }
  }
}
function build(target, level) {
  const out = meshWithCaps(target);
  mound(out, level);
  wall(out, level);
  mainGate(out, site.gates[0], level);
  mainGateWing(out, level);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
