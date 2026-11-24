import {
  facade,
  fbox,
  lathe,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96 },
  coping: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  sculpture: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
};

const stone = rgb('a6a092'),
  deep = rgb('938b7a'),
  coping = rgb('b2a994'),
  relief = rgb('c2b59b');
const tones = ['a09a8b', 'a4a093', 'a8a193', '9e988b', 'ada494', 'a49b8d'].map(rgb);
const lerp = (a, b, t) => a + (b - a) * t;
const xz = ([x, , z]) => [x, z];
const nominal = (length, type) =>
  Math.max(0.64, Math.min(type === 'lower' ? 1.29 : 1.1, length * 0.16));

function strip(out, f, y, Y, z, Z, d, D, material, color) {
  const p = f.P,
    l = f.length;
  quad4(out, material, p(0, y, D), p(l, Y, D), p(l, Z, D), p(0, z, D), color);
  quad4(out, material, p(l, Y, d), p(0, y, d), p(0, z, d), p(l, Z, d), color);
  quad4(out, material, p(0, z, D), p(l, Z, D), p(l, Z, d), p(0, z, d), color);
}

function batter(out, f, mid, y, Y, w, W, d, D, detail, color) {
  const p = f.P;
  const ring = (u, h, v) => [
    p(mid - u, h, v),
    p(mid + u, h, v),
    p(mid + u, h, -v),
    p(mid - u, h, -v),
  ];
  const a = ring(w, y, d),
    b = ring(W, Y, D);
  quad4(out, 'granite', a[0], a[1], b[1], b[0], color);
  quad4(out, 'granite', a[2], a[3], b[3], b[2], color);
  if (detail > 0) {
    quad4(out, 'granite', a[1], a[2], b[2], b[1], color);
    quad4(out, 'granite', a[3], a[0], b[0], b[3], color);
  }
  if (detail > 1) {
    fbox(
      out,
      'coping',
      f,
      mid - W - 0.12,
      mid + W + 0.12,
      Y - 0.27,
      Y + 0.018,
      -D - 0.13,
      D + 0.13,
      coping,
    );
    if (detail > 2 && Y - y > 9.0) {
      const h = y + (Y - y) * 0.39;
      fbox(
        out,
        'granite',
        f,
        mid - lerp(w, W, 0.39) - 0.032,
        mid + lerp(w, W, 0.39) + 0.032,
        h - 0.26,
        h + 0.18,
        -lerp(d, D, 0.39) - 0.045,
        lerp(d, D, 0.39) + 0.045,
        color,
      );
    }
  }
}

function geometry(f, a, b, type) {
  const length = f.length,
    half = length / 2,
    width = nominal(length, type);
  const opening = half - width;
  const rise = opening * (type === 'pointed' ? 1.14 : type === 'lower' ? 1.12 : 0.92);
  const thickness = type === 'lower' ? 1.03 : type === 'upper' ? 0.85 : 0.94;
  const top = (u) => lerp(a.height, b.height, u / length) + (type === 'lower' ? -8.03 : -0.83);
  const lip = type === 'upper' ? 0.69 : 0.97;
  const spring = (u) => top(u) - rise - lip;
  const footing = (s) =>
    type === 'upper' ? s.height - 8.3 : Math.min(s.grade, s.height - rise - 3.2) - 1.18;
  return { length, half, width, opening, rise, thickness, top, lip, spring, footing };
}

function arch(out, f, a, b, type, detail, index) {
  const g = geometry(f, a, b, type);
  const { length, half, width, opening, rise, thickness, top, spring, footing } = g,
    P = f.P;
  const tone = tones[(index + (type === 'upper' ? 3 : 0)) % tones.length];
  const pillarTop = detail > 1 ? spring(0) + 0.12 : top(0) + 0.078;
  const footW = type === 'lower' ? width * 1.16 : width * 1.04;
  const footDepth = type === 'lower' ? thickness + 0.32 : thickness + 0.1;
  batter(out, f, 0, footing(a), pillarTop, footW, width, footDepth, thickness, detail, tone);
  if (index === 0 && detail > 1 && type === 'lower')
    fbox(
      out,
      'granite',
      f,
      -footW - 0.13,
      footW + 0.13,
      footing(a) - 0.12,
      footing(a) + 1.16,
      -footDepth - 0.13,
      footDepth + 0.13,
      deep,
    );
  if (detail === 0) return;
  const n = [0, 3, 6, 11][detail];
  const p =
    type === 'pointed'
      ? pointedArch(opening, rise, detail === 1 ? 2 : n)
      : roundArch(opening, n).map(([u, h]) => [u, (h * rise) / opening]);
  // The spandrel stays above the opening; the soffit forms a separate continuous vault.
  for (let i = 0; i < p.length - 1; i++) {
    const [u, y0] = p[i],
      [u1, y1] = p[i + 1],
      x = u + half,
      z = u1 + half;
    const y = spring(x) + y0,
      Y = spring(z) + y1;
    const A = P(x, y, thickness),
      B = P(z, Y, thickness),
      C = P(z, Y, -thickness),
      D = P(x, y, -thickness);
    const c = detail === 3 ? tones[(i + index * 3) % tones.length] : tone;
    quad4(
      out,
      'granite',
      A,
      B,
      P(z, top(z) + 0.075, thickness),
      P(x, top(x) + 0.075, thickness),
      c,
    );
    quad4(
      out,
      'granite',
      C,
      D,
      P(x, top(x) + 0.075, -thickness),
      P(z, top(z) + 0.075, -thickness),
      c,
    );
    if (detail > 1) quad4(out, 'granite', D, C, B, A, deep);
    if (detail > 2) {
      // Individual voussoirs are colored wedge faces, with relief confined to the arch rim.
      const band = type === 'lower' ? 0.48 : 0.31;
      const dx = ((x - half) * band) / opening,
        dz = ((z - half) * band) / opening;
      const h = (y0 / rise) * band * 0.8,
        H = (y1 / rise) * band * 0.8;
      for (const d of [-1, 1]) {
        const patch = [
          P(x, y, d * (thickness + 0.052)),
          P(z, Y, d * (thickness + 0.052)),
          P(z + dz, Y + H, d * (thickness + 0.037)),
          P(x + dx, y + h, d * (thickness + 0.037)),
        ];
        if (d < 0) patch.reverse();
        quad4(out, 'granite', ...patch, tones[(index + i * 5 + 1) % tones.length]);
      }
    }
  }
  const bridge = (u, U) => {
    for (const side of [-1, 1]) {
      const patch = [
        P(u, spring(u) - 0.015, thickness * side),
        P(U, spring(U) - 0.015, thickness * side),
        P(U, top(U) + 0.082, thickness * side),
        P(u, top(u) + 0.082, thickness * side),
      ];
      if (side < 0) patch.reverse();
      quad4(out, 'granite', ...patch, tone);
    }
  };
  if (detail > 1) {
    bridge(0, width + 0.02);
    bridge(length - width - 0.02, length);
  }
}

function topCourse(out, f, h, H, detail, isDouble) {
  strip(out, f, h - 1.06, H - 1.06, h - 0.24, H - 0.24, -0.99, 0.99, 'granite', stone);
  if (isDouble)
    strip(out, f, h - 8.29, H - 8.29, h - 7.78, H - 7.78, -1.14, 1.14, 'coping', coping);
  if (detail < 2) {
    strip(out, f, h - 0.32, H - 0.32, h, H, -0.89, 0.89, 'coping', coping);
    return;
  }
  for (const [d, D] of [
    [-0.91, -0.36],
    [0.36, 0.91],
  ]) {
    strip(out, f, h - 0.27, H - 0.27, h, H, d, D, 'coping', coping);
  }
  strip(out, f, h - 0.42, H - 0.42, h - 0.37, H - 0.37, -0.37, 0.37, 'granite', deep);
}

function endWall(out, f, a, b, detail) {
  strip(
    out,
    f,
    a.grade - 1.05,
    b.grade - 1.05,
    a.height - 0.22,
    b.height - 0.22,
    -0.76,
    0.76,
    'granite',
    stone,
  );
  topCourse(out, f, a.height, b.height, detail, false);
}

function section(out, s, detail) {
  const { stations, style } = s,
    isDouble = style === 'double';
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1],
      f = wallFace(a.position, b.position);
    if (style === 'wall') {
      endWall(out, f, a, b, detail);
      continue;
    }
    const types = isDouble ? ['lower', 'upper'] : [style];
    for (const type of types) arch(out, f, a, b, type, detail, i);
    if (i === stations.length - 2) {
      for (const type of types) {
        const g = geometry(f, a, b, type);
        const height = detail > 1 ? g.spring(f.length) + 0.12 : g.top(f.length) + 0.08;
        batter(
          out,
          f,
          f.length,
          g.footing(b),
          height,
          g.width,
          g.width,
          g.thickness,
          g.thickness,
          detail,
          stone,
        );
      }
    }
  }
  if (style !== 'wall') {
    const path = s.channel;
    for (let j = 1; j < path.length; j++) {
      const [a, h] = path[j - 1],
        [b, H] = path[j];
      topCourse(out, wallFace(a, b), h, H, detail, isDouble);
    }
  }
}

function plazaNiche(out, detail) {
  if (detail < 2) return;
  const s = site.sections.find((s) => s.style === 'double'),
    i = s.plazaPier;
  const a = s.stations[i],
    b = s.stations[i + 1],
    f = wallFace(a.position, b.position);
  const y = a.height - 6.29;
  for (const sign of [-1, 1]) {
    const along = f.along.map((v) => v * sign);
    const q = facade(xz(f.P(0, 0, sign * 0.904)), along);
    fbox(out, 'sculpture', q, -0.84, 0.84, y - 0.24, y + 2.11, -0.06, 0.23, relief);
    fbox(out, 'granite', q, -0.46, 0.46, y + 0.26, y + 1.91, 0.229, 0.245, deep);
    fbox(out, 'sculpture', q, -0.89, 0.89, y + 0.05, y + 0.24, 0.09, 0.41, coping);
    const c = xz(q.P(0, 0, 0.285));
    lathe(
      out,
      'sculpture',
      c,
      [
        [y + 0.23, 0.23, 0.15],
        [y + 0.71, 0.36, 0.22],
        [y + 1.21, 0.24, 0.17],
        [y + 1.63, 0.16, 0.129],
      ],
      detail === 2 ? 6 : 10,
      relief,
    );
  }
}

function build(out, detail) {
  for (const s of site.sections) section(out, s, detail);
  plazaNiche(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
