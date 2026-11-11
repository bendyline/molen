/** Potala Palace's battered walls, Red Palace, White Palace court and hill stairs. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.84 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  gilding: { slot: 'roof', graph: 'metal_painted', roughness: 0.71, metallic: 0.18 },
};
const tones = {
  white: [0.865, 0.825, 0.742],
  shadeWhite: [0.735, 0.69, 0.613],
  red: [0.395, 0.064, 0.051],
  darkRed: [0.255, 0.044, 0.036],
  gold: [0.78, 0.47, 0.135],
  sunGold: [0.91, 0.64, 0.18],
  limestone: [0.54, 0.49, 0.41],
  paving: [0.61, 0.55, 0.46],
  stoneDark: [0.44, 0.39, 0.323],
  dark: [0.107, 0.09, 0.074],
  cloth: [0.83, 0.78, 0.66],
  frame: [0.23, 0.16, 0.119],
  glass: [0.112, 0.137, 0.139],
  tile: [0.48, 0.33, 0.25],
  roofDark: [0.31, 0.253, 0.215],
  ochre: [0.7, 0.36, 0.102],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rod = (out, slot, tone, a, b, w, h = w) => beam(out, slot, a, b, w, h, tones[tone]);
function tri(out, slot, tone, points, n) {
  let normal = normalFor(...points);
  if (normal.reduce((v, c, i) => v + c * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (Math.hypot(...normal) > 0.5)
    out.addTriangle(slot, ref, points, normal, undefined, tones[tone]);
}
function quad(out, slot, tone, a, b, c, d, n) {
  tri(out, slot, tone, [a, b, c], n);
  tri(out, slot, tone, [a, c, d], n);
}
function flat(out, slot, tone, outer, holes, y, normal = up) {
  const ps = [...outer, ...holes.flat()],
    cut = [];
  let index = outer.length;
  for (const h of holes) {
    cut.push(index);
    index += h.length;
  }
  const indices = earcut(ps.flat(), cut);
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tone,
      indices.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]),
      normal,
    );
}
function centroid(ring) {
  return [0, 1].map((i) => ring.reduce((a, p) => a + p[i], 0) / ring.length);
}
function areaSign(ring) {
  return Math.sign(
    ring.reduce((s, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
}
function window(out, point, x, y, w, h, tier, tone, n) {
  const L = x - w / 2,
    R = x + w / 2,
    T = y + h;
  const frame = tier === 1 ? 0.11 : tier === 2 ? 0.17 : 0.22;
  const a = point(L - frame, y - 0.07, 0.048),
    b = point(R + frame, y - 0.07, 0.048),
    c = point(R + frame * 0.77, T + 0.12, 0.048),
    d = point(L - frame * 0.77, T + 0.12, 0.048);
  quad(out, 'wood', tone === 'red' ? 'darkRed' : 'dark', a, b, c, d, n);
  if (tier < 2) return;
  quad(
    out,
    'wood',
    'glass',
    point(L, y, 0.068),
    point(R, y, 0.068),
    point(R - frame * 0.32, T, 0.068),
    point(L + frame * 0.32, T, 0.068),
    n,
  );
  quad(
    out,
    'wood',
    'frame',
    point(L - 0.29, T + 0.08, 0.15),
    point(R + 0.29, T + 0.08, 0.15),
    point(R + 0.19, T + 0.32, 0.15),
    point(L - 0.19, T + 0.32, 0.15),
    n,
  );
  if (tier < 3) return;
  const paint = tone === 'white' ? 'cloth' : 'frame';
  quad(
    out,
    'wood',
    paint,
    point(L - 0.02, y - 0.05, 0.09),
    point(L + 0.1, y - 0.05, 0.09),
    point(L + 0.16, T, 0.09),
    point(L + 0.04, T, 0.09),
    n,
  );
  quad(
    out,
    'wood',
    paint,
    point(R - 0.1, y - 0.05, 0.09),
    point(R + 0.02, y - 0.05, 0.09),
    point(R - 0.04, T, 0.09),
    point(R - 0.16, T, 0.09),
    n,
  );
  quad(
    out,
    'wood',
    'frame',
    point(x - 0.043, y, 0.093),
    point(x + 0.043, y, 0.093),
    point(x + 0.043, T, 0.093),
    point(x - 0.043, T, 0.093),
    n,
  );
  quad(
    out,
    'wood',
    'frame',
    point(L, y + h * 0.6, 0.094),
    point(R, y + h * 0.6, 0.094),
    point(R, y + h * 0.65, 0.094),
    point(L, y + h * 0.65, 0.094),
    n,
  );
}
function displayPanel(out, point, u, bottom, width, height, tier, n, court = false) {
  const a = u - width / 2,
    b = u + width / 2;
  quad(
    out,
    'wood',
    'dark',
    point(a, bottom, 0.19),
    point(b, bottom, 0.19),
    point(b - 0.18, bottom + height, 0.19),
    point(a + 0.18, bottom + height, 0.19),
    n,
  );
  const count = tier === 1 ? 5 : tier === 2 ? 9 : 14;
  for (let i = 0; i < count; i++) {
    const y = bottom + ((i + 1) * height) / (count + 1);
    quad(
      out,
      'wood',
      court ? 'cloth' : 'gold',
      point(a + 0.21, y, 0.21),
      point(b - 0.21, y, 0.21),
      point(b - 0.21, y + 0.089, 0.21),
      point(a + 0.21, y + 0.089, 0.21),
      n,
    );
  }
  if (tier >= 2) {
    const h = bottom + height;
    quad(
      out,
      'wood',
      'darkRed',
      point(a - 0.42, h, 0.27),
      point(b + 0.42, h, 0.27),
      point(b + 0.32, h + 0.37, 0.27),
      point(a - 0.32, h + 0.37, 0.27),
      n,
    );
    quad(
      out,
      'gilding',
      'gold',
      point(a - 0.54, h + 0.35, 0.32),
      point(b + 0.54, h + 0.35, 0.32),
      point(b + 0.41, h + 0.47, 0.32),
      point(a - 0.41, h + 0.47, 0.32),
      n,
    );
  }
  if (tier < 3 || !court) return;
  for (const x of [u - width * 0.25, u + width * 0.25]) {
    const y = bottom + height * 0.3,
      r = 0.64;
    const at = (ang, rad) => point(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 0.225);
    for (let j = 0; j < 8; j++) {
      const p = (j / 8) * Math.PI * 2,
        q = ((j + 1) / 8) * Math.PI * 2;
      quad(out, 'gilding', 'sunGold', at(p, r), at(q, r), at(q, r * 0.66), at(p, r * 0.66), n);
    }
  }
}
function courtEntrance(out, point, u, n, tier) {
  const y = layout.court.top,
    width = 8.4;
  displayPanel(out, point, u, y + 0.42, width, 13.75, tier, n, true);
  if (tier < 2) return;
  for (const [height, w] of [
    [y + 6.6, 7.86],
    [y + 11.25, 8.21],
    [y + 15.0, 8.84],
    [y + 18.22, 9.2],
  ]) {
    const a = u - w * 0.5,
      b = u + w * 0.5;
    quad(
      out,
      'wood',
      'darkRed',
      point(a, height, 0.34),
      point(b, height, 0.34),
      point(b, height + 0.55, 0.34),
      point(a, height + 0.55, 0.34),
      n,
    );
    quad(
      out,
      'wood',
      'cloth',
      point(a + 0.18, height + 0.32, 0.38),
      point(b - 0.18, height + 0.32, 0.38),
      point(b - 0.18, height + 0.42, 0.38),
      point(a + 0.18, height + 0.42, 0.38),
      n,
    );
    if (tier >= 3) {
      quad(
        out,
        'tile',
        'roofDark',
        point(a - 0.17, height + 0.55, 0.83),
        point(b + 0.17, height + 0.55, 0.83),
        point(b + 0.17, height + 0.55, 0.1),
        point(a - 0.17, height + 0.55, 0.1),
        up,
      );
      for (let i = 1; i < 8; i++) {
        const x = mix(a, b, i / 8);
        quad(
          out,
          'wood',
          'gold',
          point(x - 0.08, height + 0.07, 0.391),
          point(x + 0.08, height + 0.07, 0.391),
          point(x + 0.08, height + 0.22, 0.391),
          point(x - 0.08, height + 0.22, 0.391),
          n,
        );
      }
    }
  }
}
function block(out, b, tier) {
  const { holes, top, batter, rows, role, tone } = b;
  const controls = b.outer.map((p, i) => [p, b.base[i]]);
  const points =
    tier === 0 && controls.length > 11 && !b.skylineKeepOutline
      ? controls.filter((_, i) => i % 2 === 0)
      : controls;
  const outer = points.map(([p]) => p),
    base = points.map(([, y]) => y),
    center = centroid(outer);
  const topRing = outer.map(([x, z]) => [mix(x, center[0], batter), mix(z, center[1], batter)]);
  const fill = tone === 'gold' ? 'ochre' : tone;
  flat(out, 'tile', role === 'retaining-base' ? 'tile' : 'roofDark', topRing, holes, top);
  for (const [i, ring] of [outer, ...holes].entries()) {
    const upper = i === 0 ? topRing : ring,
      sign = areaSign(ring) * (i === 0 ? 1 : -1);
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length,
        [x, z] = ring[j],
        [a, b] = ring[k],
        dx = a - x,
        dz = b - z,
        l = Math.hypot(dx, dz);
      if (l < 0.045) continue;
      const lowerY =
        i === 0 ? [base[j], base[k]] : [layout.court.top - 0.86, layout.court.top - 0.86];
      const [p, q] = [upper[j], upper[k]],
        normal = [(sign * dz) / l, 0, (-sign * dx) / l];
      const point = (u, y, depth = 0) => {
        const t = u / l,
          low = mix(...lowerY, t),
          f = Math.max(0, Math.min(1, (y - low) / (top - low)));
        return [
          mix(mix(x, a, t), mix(p[0], q[0], t), f) + depth * normal[0],
          y,
          mix(mix(z, b, t), mix(p[1], q[1], t), f) + depth * normal[2],
        ];
      };
      quad(
        out,
        'plaster',
        fill,
        [x, lowerY[0], z],
        [a, lowerY[1], b],
        [q[0], top, q[1]],
        [p[0], top, p[1]],
        normal,
      );
      if (l < 0.7 || tier === 0) continue;
      const edge = role === 'retaining-base' ? 0.37 : 0.61;
      quad(
        out,
        'wood',
        'darkRed',
        point(0, top - edge, 0.19),
        point(l, top - edge, 0.19),
        point(l, top + 0.12, 0.19),
        point(0, top + 0.12, 0.19),
        normal,
      );
      if (tier >= 2) {
        quad(
          out,
          'tile',
          'tile',
          point(0, top + 0.12, 0.31),
          point(l, top + 0.12, 0.31),
          point(l, top + 0.12, -0.26),
          point(0, top + 0.12, -0.26),
          up,
        );
        if (role !== 'retaining-base')
          quad(
            out,
            'wood',
            'frame',
            point(0, top - 1.02, 0.13),
            point(l, top - 1.02, 0.13),
            point(l, top - 0.77, 0.13),
            point(0, top - 0.77, 0.13),
            normal,
          );
      }
      if (l < 2.9 || i > 0) continue;
      const decorated =
        (role === 'red-palace-front' || role === 'red-palace-east-wing') &&
        normal[2] > 0.65 &&
        l > 29;
      const gate = role === 'white-court-tower' && normal[0] > 0.6 && l > 15;
      if (role === 'retaining-base' && Math.abs(normal[2]) < 0.32) continue;
      const spacing = tier === 1 ? 9.5 : tier === 2 ? 6.28 : tier === 3 ? 4.2 : 3.62;
      const bays = Math.max(1, Math.floor(l / spacing)),
        pitch = l / bays;
      const maxRows =
        tier === 1
          ? Math.min(rows, 2)
          : tier === 2
            ? Math.min(rows, 3)
            : tier === 3
              ? Math.min(rows, 6)
              : rows;
      for (let row = 0; row < maxRows; row++) {
        const y = top - 3.32 - row * (role === 'retaining-base' ? 3.13 : 3.08),
          h = tone === 'red' ? 1.52 : 1.82;
        for (let u = 0; u < bays; u++) {
          const x = pitch * (u + 0.5);
          if (y < mix(...lowerY, x / l) + 1.05) continue;
          if (gate && Math.abs(x - l * 0.49) < 3.68 && y < layout.court.top + 22) continue;
          if (decorated && Math.abs(x - l * 0.52) < 3.45 && y > top - 19.7) continue;
          window(
            out,
            point,
            x,
            y,
            Math.min(pitch * 0.54, tone === 'red' ? 1.46 : 1.58),
            h,
            tier,
            fill,
            normal,
          );
        }
      }
      if (decorated) {
        displayPanel(out, point, l * 0.52, top - 19.5, 5.77, 16.9, tier, normal);
        if (tier >= 2)
          for (const y of [top - 0.8, top - 1.42]) {
            quad(
              out,
              'gilding',
              'gold',
              point(0.62, y, 0.209),
              point(l - 0.62, y, 0.209),
              point(l - 0.62, y + 0.1, 0.209),
              point(0.62, y + 0.1, 0.209),
              normal,
            );
          }
        if (tier >= 3)
          for (const u of [0.16, 0.36, 0.66, 0.86]) {
            const at = (j, r) =>
              point(
                l * u + r * Math.cos((j * Math.PI) / 5),
                top - 2.2 + r * Math.sin((j * Math.PI) / 5),
                0.231,
              );
            for (let j = 0; j < 10; j++)
              quad(
                out,
                'gilding',
                'gold',
                at(j, 0.59),
                at(j + 1, 0.59),
                at(j + 1, 0.43),
                at(j, 0.43),
                normal,
              );
          }
      }
      if (gate) courtEntrance(out, point, l * 0.49, normal, tier);
    }
  }
}
function court(out, tier) {
  const { court, galleries } = layout,
    y = court.top;
  flat(out, 'stone', 'paving', court.outer, [], y);
  for (const { a, b, inside, depth } of galleries) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = tier === 0 ? 3 : Math.max(3, Math.round(l / (tier === 1 ? 4.8 : 3.23)));
    const at = (u, h, o) => [
      mix(a[0], b[0], u) + o * inside[0],
      h,
      mix(a[1], b[1], u) + o * inside[1],
    ];
    const normal = [inside[0], 0, inside[1]],
      eave = y + 4.82;
    quad(out, 'plaster', 'white', at(0, y, 0), at(1, y, 0), at(1, eave, 0), at(0, eave, 0), normal);
    quad(
      out,
      'tile',
      'tile',
      at(0, eave + 0.13, -0.1),
      at(1, eave + 0.13, -0.1),
      at(1, eave + 0.06, depth + 0.25),
      at(0, eave + 0.06, depth + 0.25),
      up,
    );
    quad(
      out,
      'wood',
      'darkRed',
      at(0, eave - 0.49, depth + 0.2),
      at(1, eave - 0.49, depth + 0.2),
      at(1, eave + 0.13, depth + 0.2),
      at(0, eave + 0.13, depth + 0.2),
      normal,
    );
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      if (tier === 0)
        quad(
          out,
          'wood',
          'darkRed',
          at(u - 0.005, y, depth),
          at(u + 0.005, y, depth),
          at(u + 0.005, eave, depth),
          at(u - 0.005, eave, depth),
          normal,
        );
      else rod(out, 'wood', 'darkRed', at(u, y, depth), at(u, eave, depth), 0.25, 0.29);
      if (tier < 2) continue;
      rod(out, 'stone', 'limestone', at(u, y, depth), at(u, y + 0.24, depth), 0.41, 0.44);
      rod(
        out,
        'wood',
        'frame',
        at(u, eave - 0.44, depth - 0.25),
        at(u, eave - 0.17, depth + 0.18),
        0.36,
        0.3,
      );
      if (i < count && tier >= 3)
        quad(
          out,
          'wood',
          'cloth',
          at(u + 0.032, eave - 0.98, depth + 0.13),
          at(u + 1 / count - 0.032, eave - 0.98, depth + 0.13),
          at(u + 1 / count - 0.032, eave - 0.46, depth + 0.13),
          at(u + 0.032, eave - 0.46, depth + 0.13),
          normal,
        );
    }
  }
}
function turret(out, t, tier) {
  const { x, z, rx, rz, base, top } = t,
    n = [7, 9, 14, 20, 26][tier];
  loft(
    out,
    'plaster',
    [radialRing(base, rx, rz, n, [x, z]), radialRing(top, rx * 0.9, rz * 0.9, n, [x, z])],
    tones.white,
  );
  if (tier > 0)
    loft(
      out,
      'wood',
      [
        radialRing(top - 0.5, rx * 0.908, rz * 0.908, n, [x, z]),
        radialRing(top + 0.29, rx * 0.914, rz * 0.914, n, [x, z]),
      ],
      tones.darkRed,
    );
}
function roof(out, { x, z, rx, rz, y, h }, tier) {
  const sides = tier === 0 ? 1 : tier === 1 ? 3 : tier === 2 ? 5 : 7,
    steps = tier === 0 ? 1 : tier === 1 ? 2 : 5,
    ledge = y + h * 0.34;
  const point = (u, t, s, d = 0) => [
    x + u * rx * (1 - 0.23 * t),
    ledge +
      h *
        (0.61 * t * t + 0.065 * Math.abs(u) * (1 - t) + 0.11 * Math.pow(Math.abs(u), 4) * (1 - t)) +
      d,
    z + s * rz * (1 - t),
  ];
  const wall = radialRing(y, rx * 0.79, rz * 0.66, 4, [x, z], Math.PI / 4);
  loft(out, 'wood', [wall, wall.map((p) => [p[0], ledge, p[2]])], tones.darkRed);
  for (const side of [-1, 1]) {
    for (let i = 0; i < sides; i++)
      for (let j = 0; j < steps; j++) {
        const a = -1 + (2 * i) / sides,
          b = -1 + (2 * (i + 1)) / sides,
          c = j / steps,
          d = (j + 1) / steps;
        quad(
          out,
          'gilding',
          i % 4 ? 'sunGold' : 'gold',
          point(a, c, side),
          point(b, c, side),
          point(b, d, side),
          point(a, d, side),
          up,
        );
      }
    if (tier > 0)
      for (let i = 0; i < sides; i++) {
        const a = -1 + (2 * i) / sides,
          b = -1 + (2 * (i + 1)) / sides;
        rod(out, 'wood', 'darkRed', point(a, 0, side, -0.17), point(b, 0, side, -0.17), 0.26, 0.25);
      }
    if (tier >= 3) {
      const count = Math.ceil((rx * 2) / 0.59);
      for (let i = 0; i < count; i++) {
        const a = -1 + (2 * (i + 0.46)) / count,
          b = a + 0.074 / rx;
        for (let j = 0; j < steps; j++) {
          const c = j / steps,
            d = (j + 1) / steps;
          quad(
            out,
            'gilding',
            i % 4 ? 'gold' : 'sunGold',
            point(a, c, side, 0.025),
            point(b, c, side, 0.025),
            point(b, d, side, 0.025),
            point(a, d, side, 0.025),
            up,
          );
        }
      }
    }
  }
  for (const side of [-1, 1])
    for (let i = 0; i < steps; i++) {
      const a = i / steps,
        b = (i + 1) / steps;
      for (const cross of [-1, 1]) {
        const p = point(side, a, cross),
          q = point(side, b, cross);
        quad(out, 'wood', 'darkRed', [p[0], ledge - 0.2, p[2]], [q[0], ledge - 0.2, q[2]], q, p, [
          side,
          0,
          0,
        ]);
      }
    }
  if (tier === 0) return;
  const ridge = point(0, 1, 1, 0.1);
  rod(out, 'gilding', 'gold', point(-1, 1, 1, 0.1), point(1, 1, 1, 0.1), 0.32, 0.43);
  for (const dx of tier === 1 ? [0] : [-0.72, 0, 0.72]) {
    const cx = ridge[0] + dx * rx,
      top = ridge[1],
      rings = [
        [top, 0.42],
        [top + 0.23, 0.51],
        [top + 0.41, 0.32],
        [top + 0.79, 0.19],
        [top + 1.12, 0.037],
      ];
    loft(
      out,
      'gilding',
      rings.map(([h, r]) => radialRing(h, r, r, tier === 1 ? 5 : 8, [cx, z])),
      tones.sunGold,
      { cap: false },
    );
  }
}
function stairs(out, tier) {
  for (const { points, width, foundation } of layout.stairs)
    for (let j = 1; j < points.length; j++) {
      const [a, b] = points.slice(j - 1, j + 1),
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len;
      const n =
        tier <= 1 ? 1 : Math.max(1, Math.ceil(Math.abs(b[1] - a[1]) / (tier === 2 ? 0.43 : 0.29)));
      const at = (t, y, o) => [mix(a[0], b[0], t) + nx * o, y, mix(a[2], b[2], t) + nz * o],
        w = width / 2;
      for (let i = 1; i <= n; i++) {
        const u = (i - 1) / n,
          v = i / n,
          lo = mix(a[1], b[1], u),
          hi = mix(a[1], b[1], v);
        const low = n === 1 ? lo : Math.min(lo, hi),
          high = n === 1 ? hi : low;
        quad(
          out,
          'stone',
          'paving',
          at(u, low, -w),
          at(u, low, w),
          at(v, high, w),
          at(v, high, -w),
          up,
        );
        if (n > 1) {
          const t = lo < hi ? v : u,
            upper = Math.max(lo, hi),
            normal = [(-Math.sign(hi - lo) * dx) / len, 0, (-Math.sign(hi - lo) * dz) / len];
          quad(
            out,
            'stone',
            'limestone',
            at(t, low, -w),
            at(t, low, w),
            at(t, upper, w),
            at(t, upper, -w),
            normal,
          );
        }
        for (const side of [-1, 1]) {
          const base = side * w,
            direction = [side * nx, 0, side * nz],
            from = mix(foundation[j - 1], foundation[j], u),
            to = mix(foundation[j - 1], foundation[j], v);
          quad(
            out,
            'plaster',
            'white',
            at(u, from, base),
            at(v, to, base),
            at(v, high + 1.04, base),
            at(u, low + 1.04, base),
            direction,
          );
          if (tier === 0 || tier === 2) continue;
          quad(
            out,
            'wood',
            'darkRed',
            at(u, low + 0.98, base + 0.04 * side),
            at(v, high + 0.98, base + 0.04 * side),
            at(v, high + 1.17, base + 0.04 * side),
            at(u, low + 1.17, base + 0.04 * side),
            direction,
          );
          quad(
            out,
            'stone',
            'limestone',
            at(u, low + 1.16, base),
            at(v, high + 1.16, base),
            at(v, high + 1.16, base - 0.35 * side),
            at(u, low + 1.16, base - 0.35 * side),
            up,
          );
        }
      }
    }
  if (tier >= 2)
    for (const { points, width } of layout.stairs)
      for (const [x, y, z] of points.slice(1, -1)) {
        const radius = width * 0.5,
          ring = radialRing(y + 0.015, radius, radius, 8, [x, z]);
        flat(
          out,
          'stone',
          'paving',
          ring.map(([x, , z]) => [x, z]),
          [],
          y + 0.015,
        );
      }
}
export function buildPotalaLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Potala Palace tier ${level}`);
  for (const b of [...layout.podium, ...layout.buildings]) block(out, b, tier);
  court(out, tier);
  for (const t of layout.turrets) turret(out, t, tier);
  for (const r of layout.roofs) roof(out, r, tier);
  stairs(out, tier);
}
export const buildPotalaSkyline = (out) => buildPotalaLevel(out, 'skyline');
export const buildPotalaDistrict = (out) => buildPotalaLevel(out, 'district');
export const buildPotalaStreet = (out) => buildPotalaLevel(out, 'street');
export const buildPotalaCloseup = (out) => buildPotalaLevel(out, 'closeup');
